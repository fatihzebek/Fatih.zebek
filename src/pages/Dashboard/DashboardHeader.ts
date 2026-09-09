import { formatDisplayName, formatTeamName } from '../../utils/formatters';
import { personnelService } from '../../services/PersonnelService';

export const getGreetingPrefixHTML = (): string => {
  const h = new Date().getHours();
  let greetingPrefix = '';
  let icon = '';
  if (h < 6) {
    icon = '<i class="fa-solid fa-moon" style="color: #a29bfe; margin-right: 10px;"></i>';
    greetingPrefix = 'İYİ GECELER';
  } else if (h < 12) {
    icon = '<i class="fa-solid fa-sun" style="color: #ffd93d; margin-right: 10px;"></i>';
    greetingPrefix = 'GÜNAYDINN';
  } else if (h < 18) {
    icon = '<i class="fa-solid fa-cloud-sun" style="color: #ff9f43; margin-right: 10px;"></i>';
    greetingPrefix = 'İYİ GÜNLER';
  } else {
    icon = '<i class="fa-solid fa-star" style="color: #a29bfe; margin-right: 10px;"></i>';
    greetingPrefix = 'İYİ AKŞAMLAR';
  }
  return `${icon} ${greetingPrefix}`;
};

export const getUserBadgeHTML = (currentUser: any): string => {
  if (!currentUser) return '';
  
  // 1. Team determination (only if explicit team is set or account is a team like dh-tm13 / Team 13)
  const explicitTeam = currentUser.team || '';
  const teamFromEmailOrName = formatTeamName(currentUser.displayName || currentUser.email || '');
  const isTeamAccount = explicitTeam.toLowerCase().includes('team') || teamFromEmailOrName.startsWith('Team');
  const canonicalTeam = isTeamAccount ? formatTeamName(explicitTeam || teamFromEmailOrName) : '';

  // 2. Role or Header Tag (Cyan upper text)
  let roleOrTeam = 'KULLANICI';
  const role = (currentUser.role || '').toUpperCase();
  if (role === 'ADMIN') {
    roleOrTeam = 'YÖNETİCİ';
  } else if (role === 'MALZEME_YONETIMI') {
    roleOrTeam = 'MALZEME YÖNETİMİ';
  } else if (role === 'TAMİR' || role === 'TAMIR') {
    roleOrTeam = 'MERKEZ TAMİR ATÖLYESİ';
  } else if (canonicalTeam) {
    roleOrTeam = canonicalTeam.toUpperCase();
  } else if (role === 'USER') {
    roleOrTeam = 'KULLANICI';
  } else if (role === 'TECHNICIAN') {
    roleOrTeam = 'TEKNİSYEN';
  } else if (role) {
    roleOrTeam = role;
  }

  // 3. User Name or Team Personnel (White lower text)
  let userName = formatDisplayName(currentUser.displayName || currentUser.email || 'Kullanıcı');
  if (role !== 'ADMIN' && canonicalTeam) {
    const teamPersonnel = personnelService.getPersonnelDetailsList().filter(p => {
      return p.team && formatTeamName(p.team) === canonicalTeam;
    });
    if (teamPersonnel.length > 0) {
      teamPersonnel.sort((a, b) => {
        if (a.name.includes("Harun DALKIRAN")) return -1;
        if (b.name.includes("Harun DALKIRAN")) return 1;
        return a.name.localeCompare(b.name, 'tr');
      });
      userName = teamPersonnel.map(p => p.name).join(' - ');
    }
  }

  return `
    <span style="font-size: 0.7rem; font-weight: 800; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; letter-spacing: 1px; text-transform: uppercase; text-align: center; width: 100%;">${roleOrTeam}</span>
    <span style="font-size: 0.8rem; font-weight: bold; color: var(--text-main); margin-top: 2px; text-align: center; width: 100%;">${userName}</span>
  `;
};
