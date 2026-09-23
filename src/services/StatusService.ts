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
      const descParts = [val.category, val.description, val.type].filter(Boolean);
      const desc = descParts.join(' - ');
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
      const descParts = [mapEntry.category, mapEntry.description, mapEntry.type].filter(Boolean);
      return {
        KOD: normalizedHyphen,
        Aciklama: descParts.join(' - ')
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
      const descParts = [mapEntry.category, mapEntry.description, mapEntry.type].filter(Boolean);
      const desc = descParts.join(' - ');
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
      const desc = parts.length >= 2 ? parts[1].replace(/\s+(T\d+|Fault|Warning|Information \/ Warnings)\s*$/i, '').trim() : parts[0];
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
}

export const statusService = new StatusService();
