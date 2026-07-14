import { formatTeamName } from '../../utils/formatters';
import { dataService } from '../../services/DataService';

export const warehouseState = {
  userProfile: null as any,
  isMaterialManager: false,
  hasWarehouseDeletePerm: false,
  hasWarehouseManagePerm: false,
  currentWarehouse: null as any,
  isMobileWarehouse: false,
  targetOptions: [] as { id: string; name: string }[],
  
  // Inventory pagination and state
  inventoryItems: [] as any[],
  inventoryWithQRs: [] as any[],
  onlyShowCritical: false,
  currentPage: 1,
  itemsPerPage: 25,
  
  // Audit state
  auditMode: 'info' as 'info' | 'audit',
  auditResults: [] as any[],
  currentAuditPage: 1,
  draftData: {} as any,
  startTime: '',
  
  // Repairs / returns state
  allRepairs: [] as any[],
  pendingReturns: [] as any[],
  
  // Transfers state
  warehouseTransfersFilter: 'HEPSİ',
  warehouseTransfersDirection: 'ALL',
  warehouseTransfersSearchQuery: '',
  cachedWarehouseTransfers: [] as any[],
  warehouseTransfersPage: 1,
  warehouseTransfersPageSize: 20,
  
  // Draft reservations
  draftReservations: { bySap: {} as Record<string, number>, details: [] as any[] },

  // Global scanner reference
  html5QrcodeScanner: null as any,
};

export const getUserProfile = (): any => {
  let userProfile = (window as any).appState?.userProfile || (window as any).currentUser;
  if (!userProfile) {
    try {
      const storedFallback = localStorage.getItem('dh_auth_fallback');
      if (storedFallback) {
        const authData = JSON.parse(storedFallback);
        const uid = authData?.user?.uid;
        if (uid) {
          const cachedProfile = localStorage.getItem(`currentUserProfile_${uid}`);
          if (cachedProfile) {
            userProfile = JSON.parse(cachedProfile);
          }
        }
      }
      
      if (!userProfile) {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('currentUserProfile_')) {
            const val = localStorage.getItem(key);
            if (val) {
              userProfile = JSON.parse(val);
              break;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve user profile from cache", e);
    }
  }
  return userProfile;
};

export const formatDepoUser = (user: string): string => {
  if (!user) return 'Sistem';
  const trimmed = user.trim();
  
  const match0 = trimmed.match(/^TM(\d+)\s*Bakım\s*Teknisyeni$/i);
  if (match0) return `Team${match0[1]}`;

  const match = trimmed.match(/^dh-tm(\d+)@demirerholding\.com$/i);
  if (match) return `Team${match[1]}`;

  const match2 = trimmed.match(/^dhtm(\d+)@demirerholding\.com$/i);
  if (match2) return `Team${match2[1]}`;

  const match3 = trimmed.match(/^dh-tm(\d+)$/i);
  if (match3) return `Team${match3[1]}`;

  const match4 = trimmed.match(/^team\s*(\d+)$/i);
  if (match4) return `Team${match4[1]}`;

  if (trimmed.startsWith('team_')) return trimmed.replace('team_', '').replace(/_/g, ' ');
  if (trimmed.includes('@')) return trimmed.split('@')[0];

  return trimmed;
};

(window as any).formatDepoUser = formatDepoUser;

export const getTeamResponsibleSites = (whId: string): string[] => {
  const teamName = whId.startsWith('team_') 
    ? whId.replace('team_', '').replace(/_/g, ' ').trim() 
    : whId;
    
  const teamMapping: Record<string, string[]> = {
    'Team 01': ['2678', '0752'],
    'Team 02': ['2678', '0752'],
    'Team 12': ['2678', '0752'],
    'Team 03': ['2688', '3439', '3243'],
    'Team 04': ['2688', '3439', '3243'],
    'Team 13': ['2688', '3439', '3243'],
    'Team 15': ['2688', '3439', '3243'],
    'Team 06': ['2990', '3793'],
    'Team 08': ['2990', '3793'],
    'Team 09': ['2990', '3793'],
    'Team 14': ['2990', '3793'],
    'Team 05': ['3213'],
    'Team 10': ['3213'],
    'Team 07': ['3245', '3892'],
    'Team 11': ['3245', '3892']
  };
  
  const siteIds = teamMapping[teamName] || [];
  const allSites = dataService.getSites();
  return siteIds.map(id => {
    const site = allSites.find((s: any) => s.id === id);
    return site ? site.name : id;
  });
};

export const getWarehouseSite = (warehouse: any): string => {
  if (warehouse.id.startsWith('team_')) {
    const sites = getTeamResponsibleSites(warehouse.id);
    return `<strong>Sorumlu Olduğu Sahalar (${sites.length}):</strong> ${sites.join(', ')}`;
  } else {
    const allSites = dataService.getSites();
    const whNameBase = warehouse.name.toLowerCase().replace('depo', '').trim();
    const site = allSites.find((s: any) => {
      const siteNameBase = s.name.toLowerCase().trim();
      return whNameBase.includes(siteNameBase) || siteNameBase.includes(whNameBase);
    });
    return `<strong>Bağlı Olduğu Saha:</strong> ${site ? site.name : warehouse.name}`;
  }
};
