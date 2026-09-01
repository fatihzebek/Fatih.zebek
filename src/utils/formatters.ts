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
