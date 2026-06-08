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
  const clean = teamStr.toLowerCase().trim();
  
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
