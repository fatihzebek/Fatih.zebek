/**
 * Formats a raw display name (either a person's name or a team indicator) into a standardized format.
 * Examples:
 * - "fatih zebek" -> "Fatih ZEBEK"
 * - "Ahmet oğuz özmutlu" -> "Ahmet Oğuz ÖZMUTLU"
 * - "dh-tm04" -> "Team04"
 * - "Team13" -> "Team13"
 * - "dh-tm13@demirerholding.com" -> "Team13"
 * - "hursit.akter@demirerholding.com" -> "Hurşit AKTER"
 */
export const formatDisplayName = (name: string): string => {
  if (!name) return '';
  const clean = name.trim();
  const cleanLower = clean.toLowerCase();

  // Specific mapping for Hurşit AKTER
  if (cleanLower.includes('hursit.akter') || cleanLower.includes('hurşit akter')) {
    return 'Hurşit AKTER';
  }

  // Specific mapping for Fatih ZEBEK
  if (cleanLower.includes('fatih.check') || cleanLower.includes('fatih.zebek') || cleanLower.includes('fatih zebek')) {
    return 'Fatih ZEBEK';
  }

  // Handle email addresses
  if (clean.includes('@')) {
    const prefix = clean.split('@')[0];
    return formatDisplayName(prefix);
  }

  // Check if it's a team (like tm04, team 4, team04, tm-04, etc.)
  const teamMatch = cleanLower.match(/(?:dh-)?tm\s*(\d+)|team\s*(\d+)/i);
  if (teamMatch) {
    const num = parseInt(teamMatch[1] || teamMatch[2]);
    return `Team${String(num).padStart(2, '0')}`;
  }

  // Fallback for just digit codes in username like "04"
  const directNum = parseInt(cleanLower);
  if (!isNaN(directNum) && directNum > 0 && directNum <= 100) {
    return `Team${String(directNum).padStart(2, '0')}`;
  }

  // If it contains a name in email prefix (e.g. ahmet.yilmaz)
  if (clean.includes('.')) {
    const parts = clean.split('.');
    const formattedParts = parts.map((part, index) => {
      if (index === parts.length - 1) {
        return part.toLocaleUpperCase('tr-TR');
      }
      return part.charAt(0).toLocaleUpperCase('tr-TR') + part.slice(1).toLocaleLowerCase('tr-TR');
    });
    return formattedParts.join(' ');
  }

  // For person names, format as First Names Capitalized, Surname UPPERCASE
  const parts = clean.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].toLocaleUpperCase('tr-TR');
  }
  const lastName = parts.pop()!.toLocaleUpperCase('tr-TR');
  const firstNames = parts.map(part => {
    if (!part) return '';
    const firstChar = part.charAt(0).toLocaleUpperCase('tr-TR');
    const rest = part.slice(1).toLocaleLowerCase('tr-TR');
    return firstChar + rest;
  });
  return [...firstNames, lastName].join(' ');
};

/**
 * Formats a raw team string (email prefix, team id, etc.) into a standardized "TeamXX" format.
 * Examples:
 * - "dh-tm03" -> "Team03"
 * - "DH-TM03" -> "Team03"
 * - "Team 03" -> "Team03"
 * - "Team 3" -> "Team03"
 * - "dh-tm15" -> "Team15"
 */
export const formatTeamName = (teamStr: string): string => {
  if (!teamStr) return 'SİSTEM';
  const clean = teamStr.toLowerCase().trim().replace(/_/g, ' ');

  // Specific mapping for Hurşit AKTER
  if (clean.includes('hursit.akter') || clean.includes('hurşit akter')) {
    return 'Hurşit AKTER';
  }

  // Specific mapping for Fatih ZEBEK
  if (clean.includes('fatih.check') || clean.includes('fatih.zebek') || clean.includes('fatih zebek')) {
    return 'Fatih ZEBEK';
  }

  // Handle email prefix if it contains @
  let prefix = clean;
  if (clean.includes('@')) {
    prefix = clean.split('@')[0];
  }

  // Check if it's a team (like tm04, team 4, team04, tm-04, etc.)
  const teamMatch = prefix.match(/(?:dh-)?tm\s*(\d+)|team\s*(\d+)/i);
  if (teamMatch) {
    const num = parseInt(teamMatch[1] || teamMatch[2]);
    return `Team${String(num).padStart(2, '0')}`;
  }

  // Fallback if it's just a number
  const directNum = parseInt(prefix);
  if (!isNaN(directNum) && directNum > 0 && directNum <= 100) {
    return `Team${String(directNum).padStart(2, '0')}`;
  }

  // If it contains a name in email prefix (e.g. fatih.zebek)
  if (clean.includes('@')) {
    const parts = prefix.split('.');
    if (parts.length > 1) {
      const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
      const last = parts[parts.length - 1].toUpperCase();
      return `${first} ${last}`;
    }
    return prefix.toUpperCase();
  }

  // For person names or other strings, apply formatDisplayName
  return formatDisplayName(teamStr);
};

/**
 * Returns the designated field team leader responsible for a given site or warehouse.
 * Mappings:
 * - Anemon İntepe, Alize Sarıkaya, Alize Çamseki -> Harun DALKIRAN
 * - Dares Datça -> Süleyman AŞKIN
 * - Mare Manastır, Alize Germiyan -> Gökmen KÖKSAL
 * - Alize Keltepe, Alize Çataltepe -> EMRE ACAR
 * - Doğal Sayalar, Alize Kuyucak -> İbrahim ÖZKARA
 */
export const getSiteTeamLeader = (siteOrWarehouse: string): string => {
  if (!siteOrWarehouse) return 'Saha Ekip Lideri';
  const val = siteOrWarehouse.toLowerCase();

  // Anemon İntepe (2688), Alize Sarıkaya (3439), Alize Çamseki (3243)
  if (
    val.includes('anemon') || val.includes('intepe') || val.includes('i̇ntepe') || val.includes('2688') ||
    val.includes('sarıkaya') || val.includes('sarikaya') || val.includes('3439') ||
    val.includes('çamseki') || val.includes('camseki') || val.includes('3243')
  ) {
    return 'Harun DALKIRAN';
  }

  // Dares Datça (3213)
  if (val.includes('dares') || val.includes('datça') || val.includes('datca') || val.includes('3213')) {
    return 'Süleyman AŞKIN';
  }

  // Mare Manastır (2678), Alize Germiyan (0752)
  if (
    val.includes('mare') || val.includes('manastır') || val.includes('manastir') || val.includes('2678') ||
    val.includes('germiyan') || val.includes('0752')
  ) {
    return 'Gökmen KÖKSAL';
  }

  // Alize Keltepe (3245), Alize Çataltepe (3892)
  if (
    val.includes('keltepe') || val.includes('3245') ||
    val.includes('çataltepe') || val.includes('cataltepe') || val.includes('çataltape') || val.includes('cataltape') || val.includes('3892')
  ) {
    return 'EMRE ACAR';
  }

  // Doğal Sayalar (2990), Alize Kuyucak (3793)
  if (
    val.includes('sayalar') || val.includes('2990') ||
    val.includes('kuyucak') || val.includes('3793')
  ) {
    return 'İbrahim ÖZKARA';
  }

  return 'Saha Ekip Lideri';
};

/**
 * Returns the email address of the designated field team leader for a given site or warehouse.
 */
export const getSiteTeamLeaderEmail = (siteOrWarehouse: string): string => {
  const leader = getSiteTeamLeader(siteOrWarehouse);
  if (leader.includes('Harun')) return 'harun.dalkiran@demirerholding.com';
  if (leader.includes('Süleyman') || leader.includes('Suleyman') || leader.includes('AŞKIN')) return 'suleyman.askin@demirerholding.com';
  if (leader.includes('Gökmen') || leader.includes('Gokmen') || leader.includes('KÖKSAL')) return 'gokmen.koksal@demirerholding.com';
  if (leader.includes('Emre') || leader.includes('ACAR')) return 'emre.acar@demirerholding.com';
  if (leader.includes('İbrahim') || leader.includes('Ibrahim') || leader.includes('ÖZKARA')) return 'ibrahim.ozkara@demirerholding.com';
  return '';
};

/**
 * Normalizes warehouse names to ensure proper Turkish characters (e.g. Sarikaya -> Sarıkaya).
 */
export const fixTurkishWarehouseName = (name?: string | null): string => {
  if (!name) return '';
  return name
    .replace(/Sarikaya/gi, 'Sarıkaya')
    .replace(/Camseki/gi, 'Çamseki')
    .replace(/Cataltepe/gi, 'Çataltepe')
    .replace(/Degirmentepe/gi, 'Değirmentepe')
    .replace(/Koytepe/gi, 'Köytepe')
    .replace(/Intepe/gi, 'İntepe')
    .replace(/Gokceada/gi, 'Gökçeada');
};

/**
 * Standardizes repair duration into 'H:MM dk' format (e.g. 45 -> '0:45 dk', 90 -> '1:30 dk').
 */
export const formatRepairDuration = (val?: string | null): string => {
  if (!val) return '-';
  const trimmed = val.trim();
  if (trimmed.includes('dk') || trimmed.includes('saat')) return trimmed;

  // If just digits like '45'
  if (/^\d+$/.test(trimmed)) {
    const num = parseInt(trimmed, 10);
    if (num < 60) {
      return `0:${String(num).padStart(2, '0')} dk`;
    } else {
      const h = Math.floor(num / 60);
      const m = num % 60;
      return `${h}:${String(m).padStart(2, '0')} dk`;
    }
  }

  // If '0:45' or '1:30'
  if (/^\d+:\d+$/.test(trimmed)) {
    const [h, m] = trimmed.split(':').map(Number);
    return `${h}:${String(m).padStart(2, '0')} dk`;
  }

  return `${trimmed} dk`;
};

/**
 * Safely parses any date input (Firestore Timestamp, ISO string, DD.MM.YYYY string, number, or Date)
 * into a valid Date object. Falls back to new Date() if invalid.
 */
export const parseSafeDate = (raw: any): Date => {
  if (!raw) return new Date();

  // Firestore Timestamp with toDate()
  if (typeof raw.toDate === 'function') {
    try {
      const d = raw.toDate();
      if (d instanceof Date && !isNaN(d.getTime())) return d;
    } catch (e) {}
  }

  // Already a Date object
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? new Date() : raw;
  }

  // Number (epoch ms or seconds)
  if (typeof raw === 'number') {
    const ms = raw < 10000000000 ? raw * 1000 : raw;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? new Date() : d;
  }

  // Firestore timestamp-like plain object { seconds: number, nanoseconds: number }
  if (typeof raw === 'object' && typeof raw.seconds === 'number') {
    const d = new Date(raw.seconds * 1000);
    if (!isNaN(d.getTime())) return d;
  }

  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed || trimmed.toLowerCase().includes('invalid')) return new Date();

    // Check Turkish DD.MM.YYYY [HH:mm[:ss]]
    const trMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
    if (trMatch) {
      const day = parseInt(trMatch[1], 10);
      const month = parseInt(trMatch[2], 10) - 1;
      const year = parseInt(trMatch[3], 10);
      const hour = trMatch[4] ? parseInt(trMatch[4], 10) : 0;
      const min = trMatch[5] ? parseInt(trMatch[5], 10) : 0;
      const sec = trMatch[6] ? parseInt(trMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      if (!isNaN(d.getTime())) return d;
    }

    // Try standard Date.parse (ISO 8601 etc)
    const parsed = new Date(trimmed);
    if (!isNaN(parsed.getTime())) return parsed;
  }

  return new Date();
};

/**
 * Formats any date input into 'DD.MM.YYYY HH:mm' Turkish format safely.
 */
export const formatSafeDateTime = (raw: any): string => {
  const d = parseSafeDate(raw);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${day}.${month}.${year} ${hours}:${minutes}`;
};
