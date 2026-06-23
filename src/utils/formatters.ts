/**
 * Formats a raw team string (email prefix, team id, etc.) into a standardized "TEAM X" format.
 * Examples:
 * - "dh-tm03" -> "TEAM 3"
 * - "DH-TM03" -> "TEAM 3"
 * - "Team 03" -> "TEAM 3"
 * - "Team 3" -> "TEAM 3"
 * - "dh-tm15" -> "TEAM 15"
 */
export const formatTeamName = (teamStr: string): string => {
  if (!teamStr) return 'SİSTEM';
  
  // Normalize: handle email-like strings or team codes
  const clean = teamStr.toLowerCase().trim().replace(/_/g, ' ');

  // Specific mapping for Hurşit AKTER (with Turkish character support)
  if (clean.includes('hursit.akter')) {
    return 'Hurşit AKTER';
  }

  // General email formatting for other personnel
  if (clean.includes('@')) {
    const prefix = clean.split('@')[0];
    const teamMatch = prefix.match(/tm(\d+)|team\s*(\d+)/i);
    if (!teamMatch) {
      const parts = prefix.split('.');
      if (parts.length > 1) {
        const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        const last = parts[parts.length - 1].toUpperCase();
        return `${first} ${last}`;
      }
      return prefix.toUpperCase();
    }
  }
  
  // Extract number using regex
  const match = clean.match(/tm(\d+)|team\s*(\d+)/i);
  if (match) {
    const num = parseInt(match[1] || match[2]);
    return `TEAM ${num}`;
  }

  // Fallback for strings that might just be "03" or "3"
  const directNum = parseInt(clean);
  if (!isNaN(directNum) && directNum > 0 && directNum <= 100) {
    return `TEAM ${directNum}`;
  }

  // If it's a known personnel name (based on provided context), we might want to keep it or flag it
  // But user said: "burada isim yazmayacak"
  // So if we can't format it as a team, we return it as-is but uppercase
  return teamStr.toUpperCase();
};
