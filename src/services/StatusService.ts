import faultCodes from '../data/fault_codes.json';
import statusCodesMap from '../data/status_codes_map.json';

export interface FaultCode {
  KOD: string;
  Aciklama: string;
}

export interface ResolvedFaultInfo {
  code: string;
  description: string;
  category?: string;
  fullText: string;
}

export interface ScadaStatusClassification {
  code: string;
  mainCode: string;
  colonCode: string;
  timeCategory: 'T1' | 'T3' | 'T4' | 'T5' | 'T6' | 'W' | 'I' | 'UNKNOWN';
  category: string;
  description: string;
  fullText: string;
  isFault: boolean;
  isMaintenance: boolean;
  isLackOfWind: boolean;
  isGridWait: boolean;
  badgeText: string;
  badgeColor: string;
  cardStatus: 'online' | 'maintenance' | 'scada_fault' | 'grid_wait' | 'standby';
  isBladesPaused: boolean;
}

class StatusService {
  private codes: FaultCode[] = faultCodes;
  private map: Record<string, { category?: string; description?: string; type?: string }> = statusCodesMap as any;

  getAllCodes(): FaultCode[] {
    return this.codes;
  }

  searchCodes(query: string): FaultCode[] {
    if (!query) return [];
    const lowerQuery = query.toLowerCase().trim();
    const results: FaultCode[] = [];
    const seen = new Set<string>();

    for (const c of this.codes) {
      if (c.KOD.toLowerCase().includes(lowerQuery) || c.Aciklama.toLowerCase().includes(lowerQuery)) {
        results.push(c);
        seen.add(c.KOD.toLowerCase().replace(':', '-'));
        if (results.length >= 50) return results;
      }
    }

    for (const [key, val] of Object.entries(this.map)) {
      const hyphenKey = key.replace(':', '-');
      if (seen.has(hyphenKey.toLowerCase())) continue;
      const descParts = [val.category, val.description].filter(Boolean);
      const desc = descParts.join(' - ').replace(/\s*-\s*T\d+\s*$/i, '').trim();
      if (hyphenKey.toLowerCase().includes(lowerQuery) || desc.toLowerCase().includes(lowerQuery)) {
        results.push({ KOD: hyphenKey, Aciklama: desc });
        seen.add(hyphenKey.toLowerCase());
        if (results.length >= 50) return results;
      }
    }

    return results;
  }

  getCodeByKod(kod: string): FaultCode | undefined {
    if (!kod) return undefined;
    let clean = kod.replace(/^enercon\s*/i, '').trim();
    const parts = clean.split(/[,:]/).map(s => s.trim()).filter(Boolean);
    if (parts.length >= 2) {
      clean = `${parts[0]}-${parts[1]}`;
    }
    const normalizedHyphen = clean.replace(':', '-').toLowerCase();
    const normalizedColon = clean.replace('-', ':').toLowerCase();

    // 1. Match in status_codes_map.json
    const mapEntry = this.map[normalizedColon] || this.map[clean] || this.map[normalizedHyphen];
    if (mapEntry && mapEntry.description) {
      const descParts = [mapEntry.category, mapEntry.description].filter(Boolean);
      return {
        KOD: normalizedHyphen,
        Aciklama: descParts.join(' - ').replace(/\s*-\s*T\d+\s*$/i, '').trim()
      };
    }

    // 2. Direct match in fault_codes.json
    const directMatch = this.codes.find(c => {
      const cLower = c.KOD.trim().toLowerCase();
      return cLower === normalizedHyphen || cLower === normalizedColon || cLower === clean.toLowerCase();
    });
    if (directMatch) return directMatch;

    return undefined;
  }

  resolveFaultInfo(rawInput: string | undefined): ResolvedFaultInfo {
    if (!rawInput) {
      return { code: 'ARIZA', description: 'SCADA Arızası', fullText: 'SCADA Arızası' };
    }

    // Strip "Enercon" prefix and whitespace
    let cleaned = rawInput.replace(/^enercon\s*/i, '').trim();

    // If already in "KOD - Description" format (and not just hyphenated code like 240-246)
    if (cleaned.includes(' - ') && !cleaned.match(/^\d+-\d+$/)) {
      const parts = cleaned.split(' - ');
      const codePart = parts[0].trim();
      const descPart = parts.slice(1).join(' - ').trim();
      return {
        code: codePart,
        description: descPart,
        fullText: cleaned
      };
    }

    // If rawInput contains comma or colon array e.g. "240,246,1,0,10,0,0" or "240:246"
    // Extract only first two numbers: 240 and 246 -> "240-246"
    const arrayParts = cleaned.split(/[,:]/).map(s => s.trim()).filter(Boolean);
    let hyphenCode = cleaned.replace(':', '-');
    let colonCode = cleaned.replace('-', ':');

    if (arrayParts.length >= 2) {
      hyphenCode = `${arrayParts[0]}-${arrayParts[1]}`;
      colonCode = `${arrayParts[0]}:${arrayParts[1]}`;
    }

    // 1. Check statusCodesMap first (precise Enercon SCADA definitions)
    const mapEntry = this.map[colonCode] || this.map[hyphenCode];
    if (mapEntry && mapEntry.description) {
      const descParts = [mapEntry.category, mapEntry.description].filter(Boolean);
      const desc = descParts.join(' - ').replace(/\s*-\s*T\d+\s*$/i, '').trim();
      return {
        code: hyphenCode,
        description: desc,
        category: mapEntry.category,
        fullText: `${hyphenCode} - ${desc}`
      };
    }

    // 2. Check faultCodes dictionary
    const fc = this.codes.find(c => {
      const cLower = c.KOD.trim().toLowerCase();
      return cLower === hyphenCode.toLowerCase() || cLower === colonCode.toLowerCase();
    });
    if (fc && fc.Aciklama) {
      const parts = fc.Aciklama.split('-').map(s => s.trim()).filter(Boolean);
      const desc = (parts.length >= 2 ? parts[1].replace(/\s+(T\d+|Fault|Warning|Information \/ Warnings)\s*$/i, '').trim() : parts[0]).replace(/\s*-\s*T\d+\s*$/i, '').trim();
      return {
        code: hyphenCode,
        description: desc,
        fullText: `${hyphenCode} - ${desc}`
      };
    }

    // Fallback if no specific dictionary entry exists
    return {
      code: hyphenCode,
      description: 'SCADA Arıza Bildirimi',
      fullText: `${hyphenCode} - SCADA Arızası`
    };
  }

  classifyStatus(rawInput: string | undefined, statusCode?: number | string): ScadaStatusClassification {
    if (!rawInput && (statusCode === undefined || statusCode === null)) {
      return {
        code: '0-0',
        mainCode: '0-0',
        colonCode: '0:0',
        timeCategory: 'T1',
        category: '',
        description: 'Turbine in operation',
        fullText: '0-0 - Turbine in operation',
        isFault: false,
        isMaintenance: false,
        isLackOfWind: false,
        isGridWait: false,
        badgeText: 'ONLINE',
        badgeColor: 'var(--accent-cyan)',
        cardStatus: 'online',
        isBladesPaused: false
      };
    }

    let cleaned = String(rawInput || (statusCode !== undefined ? String(statusCode) : '')).replace(/^enercon\s*/i, '').trim();
    const arrayParts = cleaned.split(/[,:]/).map(s => s.trim()).filter(Boolean);
    let hyphenCode = cleaned.replace(':', '-');
    let colonCode = cleaned.replace('-', ':');

    if (arrayParts.length >= 2) {
      hyphenCode = `${arrayParts[0]}-${arrayParts[1]}`;
      colonCode = `${arrayParts[0]}:${arrayParts[1]}`;
    }

    const firstNum = arrayParts[0] || '';

    // 1. Look up in merged Enercon SCADA codes (CS40, CS48, CS82 - 3.103 definitions)
    const mapEntry = this.map[colonCode] || this.map[hyphenCode];
    const timeCategory = (mapEntry?.type as any) || (firstNum === '0' || firstNum === '1' ? 'T1' : (firstNum === '2' ? 'T1' : (firstNum === '8' ? 'T6' : (firstNum === '60' || firstNum === '61' ? 'T3' : 'UNKNOWN'))));
    const category = mapEntry?.category || (firstNum === '2' ? 'Lack of wind' : (firstNum === '8' ? 'Maintenance' : (firstNum === '60' || firstNum === '61' ? 'Mains failure' : '')));
    const description = mapEntry?.description || this.resolveFaultInfo(cleaned).description || '';
    const fullText = description ? `${hyphenCode} - ${description}` : hyphenCode;

    // 2. Bakım Kontrolü (8:x, 0:8, Maintenance)
    const isMaintenance = firstNum === '8' || hyphenCode === '0-8' || colonCode === '0:8' || 
                          category.toLowerCase().includes('maintenance') || 
                          description.toLowerCase().includes('maintenance') || 
                          cleaned.toLowerCase().includes('bakım');

    if (isMaintenance) {
      return {
        code: hyphenCode,
        mainCode: hyphenCode,
        colonCode,
        timeCategory: 'T6',
        category: 'Maintenance',
        description: description || 'Bakım Modu',
        fullText,
        isFault: false,
        isMaintenance: true,
        isLackOfWind: false,
        isGridWait: false,
        badgeText: 'BAKIM',
        badgeColor: '#ccff00',
        cardStatus: 'maintenance',
        isBladesPaused: true
      };
    }

    // 3. Rüzgar Yetersizliği / Bekleme (2:x, Lack of wind, T1)
    const isLackOfWind = firstNum === '2' || category.toLowerCase().includes('lack of wind') || description.toLowerCase().includes('lack of wind') || description.toLowerCase().includes('wind speed too low') || description.toLowerCase().includes('rotor speed to low');

    if (isLackOfWind) {
      return {
        code: hyphenCode,
        mainCode: hyphenCode,
        colonCode,
        timeCategory: 'T1',
        category: 'Lack of wind',
        description: description || 'Wind speed too low',
        fullText,
        isFault: false,
        isMaintenance: false,
        isLackOfWind: true,
        isGridWait: false,
        badgeText: 'BEKLEMEDE',
        badgeColor: '#38bdf8', // Canlı açık mavi / cyan
        cardStatus: 'standby',
        isBladesPaused: true
      };
    }

    // 4. Şebeke Kesintisi / TEİAŞ Beklemesi (T3 veya 60:x, 61:x)
    const isGridWait = timeCategory === 'T3' || firstNum === '60' || firstNum === '61' || category.toLowerCase().includes('mains failure') || category.toLowerCase().includes('mains breakdown');

    if (isGridWait) {
      return {
        code: hyphenCode,
        mainCode: hyphenCode,
        colonCode,
        timeCategory: 'T3',
        category: category || 'Mains failure',
        description: description || 'Şebeke Kesintisi',
        fullText,
        isFault: false,
        isMaintenance: false,
        isLackOfWind: false,
        isGridWait: true,
        badgeText: 'ŞEBEKE',
        badgeColor: '#f59e0b', // Amber / Turuncu
        cardStatus: 'grid_wait',
        isBladesPaused: true
      };
    }

    // 5. Normal İşletim Durumları (0:x, 1:x, T1, OK, Run vb.)
    const isNormal = timeCategory === 'T1' || firstNum === '0' || firstNum === '1' || ['OK', 'Run', '0-0', '0-1', '0-2', '0-4', '0-5'].includes(hyphenCode);

    if (isNormal) {
      return {
        code: hyphenCode,
        mainCode: hyphenCode,
        colonCode,
        timeCategory: 'T1',
        category,
        description: description || 'Turbine in operation',
        fullText,
        isFault: false,
        isMaintenance: false,
        isLackOfWind: false,
        isGridWait: false,
        badgeText: 'ONLINE',
        badgeColor: 'var(--accent-cyan)',
        cardStatus: 'online',
        isBladesPaused: false
      };
    }

    // 6. Gerçek Arıza (T5 veya Bakım dışındaki T6 veya tanımsız arıza kodları)
    const isFault = timeCategory === 'T5' || timeCategory === 'T6' || (Number(statusCode) > 0) || (arrayParts.length >= 2 && !['0', '1', '2', '8'].includes(firstNum));

    return {
      code: hyphenCode,
      mainCode: hyphenCode,
      colonCode,
      timeCategory: (timeCategory as any) || 'T6',
      category: category || 'SCADA Arızası',
      description: description || 'SCADA Arıza Bildirimi',
      fullText,
      isFault: isFault,
      isMaintenance: false,
      isLackOfWind: false,
      isGridWait: false,
      badgeText: 'ARIZA',
      badgeColor: '#ef4444',
      cardStatus: 'scada_fault',
      isBladesPaused: true
    };
  }
}

export const statusService = new StatusService();
