import { formatTeamName } from '../../utils/formatters';
import { dataService } from '../../services/DataService';
import { db } from '../../firebase';
import { collection, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';

export const PREDEFINED_TURBINE_TYPES = [
  'E44 - E48',
  'E70 - E82',
  'E82/E2 - E92',
  'RTU - FCU'
];

export const sapMetadataMap = new Map<string, { cabinet?: string; turbineType?: string }>();
let sapMetadataFetched = false;

export const fetchSapMetadata = async (forceRefresh = false): Promise<Map<string, { cabinet?: string; turbineType?: string }>> => {
  if (sapMetadataFetched && !forceRefresh && sapMetadataMap.size > 0) {
    return sapMetadataMap;
  }
  try {
    const snap = await getDocs(collection(db, 'material_sap_metadata'));
    snap.forEach(docSnap => {
      const data = docSnap.data();
      const sap = docSnap.id.trim();
      if (sap) {
        sapMetadataMap.set(sap, {
          cabinet: (data.cabinet || '').trim(),
          turbineType: (data.turbineType || '').trim()
        });
      }
    });
    sapMetadataFetched = true;
  } catch (err) {
    console.warn('[WarehouseState] Failed to fetch material_sap_metadata:', err);
  }
  return sapMetadataMap;
};

export const saveSapMetadata = async (sapNo: string, data: { cabinet?: string; turbineType?: string }) => {
  const cleanSap = String(sapNo || '').trim();
  if (!cleanSap) return;
  const existing = sapMetadataMap.get(cleanSap) || {};
  const updated = {
    ...existing,
    ...data
  };
  sapMetadataMap.set(cleanSap, updated);

  try {
    const user = getUserProfile() || (window as any).currentUser;
    const userEmail = (user?.email || '').toLowerCase().trim();
    await setDoc(doc(db, 'material_sap_metadata', cleanSap), {
      sapNo: cleanSap,
      ...updated,
      updatedAt: serverTimestamp(),
      updatedBy: userEmail
    }, { merge: true });
  } catch (err) {
    console.error('[WarehouseState] Error saving material_sap_metadata:', err);
  }
};

export const getEffectiveCabinet = (item: any): string => {
  const sap = String(item?.sapNo || '').trim();
  const meta = sap ? sapMetadataMap.get(sap) : null;
  return (item?.cabinet || meta?.cabinet || '').trim();
};

export const getEffectiveTurbineType = (item: any): string => {
  const sap = String(item?.sapNo || '').trim();
  const meta = sap ? sapMetadataMap.get(sap) : null;
  return (item?.turbineType || meta?.turbineType || '').trim();
};

export const warehouseState = {
  userProfile: null as any,
  isMaterialManager: false,
  hasWarehouseDeletePerm: false,
  hasWarehouseManagePerm: false,
  currentWarehouse: null as any,
  isMobileWarehouse: false,
  targetOptions: [] as { id: string; name: string }[],
  
  // Price view permissions and cache
  canViewPrices: false,
  pricesMap: new Map<string, any>(),
  unpricedItems: [] as any[],
  
  // Scrap / Hurda items state
  scrapItems: [] as any[],
  allFieldScraps: [] as any[],
  
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

  // Defect view filter (default: only show pending/unprocessed defects)
  defectShowCompleted: false,

  // Selected materials for bulk operations & QR label printing across pages
  selectedMaterialIds: new Set<string>(),

  // Fatih Zebek exclusive filters
  selectedCabinetFilter: 'ALL' as string,
  selectedTurbineTypeFilter: 'ALL' as string,
};

export const getAvailableCabinets = (): string[] => {
  const distinct = new Set<string>();
  (warehouseState.inventoryItems || []).forEach(item => {
    const raw = getEffectiveCabinet(item);
    if (raw) {
      distinct.add(raw);
      if (raw.includes(' _ ') || raw.includes(' / ') || raw.includes(',')) {
        const parts = raw.split(/\s+_\s+|\s*\/\s*|,\s*/);
        parts.forEach((p: string) => {
          const cleanPart = p.trim();
          if (cleanPart && cleanPart.length > 1) {
            distinct.add(cleanPart);
          }
        });
      }
    }
  });
  sapMetadataMap.forEach(meta => {
    const raw = (meta.cabinet || '').trim();
    if (raw) {
      distinct.add(raw);
      if (raw.includes(' _ ') || raw.includes(' / ') || raw.includes(',')) {
        const parts = raw.split(/\s+_\s+|\s*\/\s*|,\s*/);
        parts.forEach((p: string) => {
          const cleanPart = p.trim();
          if (cleanPart && cleanPart.length > 1) {
            distinct.add(cleanPart);
          }
        });
      }
    }
  });
  return Array.from(distinct).sort((a, b) => a.localeCompare(b, 'tr', { sensitivity: 'base', numeric: true }));
};

export const getAvailableTurbineTypes = (): string[] => {
  const distinct = new Set<string>(PREDEFINED_TURBINE_TYPES);
  (warehouseState.inventoryItems || []).forEach(item => {
    const raw = getEffectiveTurbineType(item);
    if (raw) distinct.add(raw);
  });
  sapMetadataMap.forEach(meta => {
    const raw = (meta.turbineType || '').trim();
    if (raw) distinct.add(raw);
  });
  return Array.from(distinct);
};

export const isUserFatihZebek = (userProfile?: any): boolean => {
  const user = userProfile || getUserProfile() || (window as any).appState?.userProfile || (window as any).currentUser;
  const userEmail = (user?.email || '').toLowerCase().trim();
  return userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
};

export const isPcbMaterial = (item: any): boolean => {
  if (!item) return false;
  const text = `${item.name || ''} ${item.description || ''} ${item.category || ''} ${item.sapNo || ''}`.toLowerCase().trim();
  return /^(pcb|kart)\b/i.test(text) || 
         /pcb|kart\b|kartı\b|kartlar|board\b|plata\b|platine|leiterplatte|cpu\b|controller|ana\s*kart|sürücü\s*kart|tetikleme|haberleşme|modül\s*kart|power\s*board|io\s*board|dsp\b|motherboard|anaboard|devre\s*kart|driver\s*board|interface\s*board|sub-rack/i.test(text);
};

export const isIgbtMaterial = (item: any): boolean => {
  if (!item) return false;
  // If it's a PCB / electronic board, it strictly belongs to PCB (Cards) tab
  if (isPcbMaterial(item)) return false;

  const text = `${item.name || ''} ${item.description || ''} ${item.category || ''} ${item.sapNo || ''}`.toLowerCase().trim();
  return /igbt|skm\d|ff\d{2,4}|skkd|skkt|semikron|eupec|infineon|thyristor|tristör|rectifier|bridge\s*rectifier|diode\s*module|diyot\s*modül|power\s*block|güç\s*bloğu|köprü\s*diyot|chopper\s*modul|power\s*module/i.test(text);
};

export const canViewWarehousePrices = (userProfile?: any): boolean => {
  const user = userProfile || getUserProfile() || (window as any).appState?.userProfile || (window as any).currentUser;
  const userRole = (user?.role || '').toUpperCase().trim();
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = userRole === 'ADMIN' || userRole === 'YONETICI' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
  const isMaterialManager = userRole === 'MALZEME_YONETIMI' || 
    userEmail === 'hursit.akter@demirerholding.com' ||
    userEmail === 'emir.unver@demirerholding.com';
  return Boolean(isAdmin || isMaterialManager);
};

export const canViewTamirBekleyenler = (userProfile?: any): boolean => {
  const user = userProfile || warehouseState.userProfile || getUserProfile() || (window as any).appState?.userProfile || (window as any).currentUser;
  const userRole = (user?.role || '').toUpperCase().trim();
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isAdmin = userRole === 'ADMIN' || userRole === 'YONETICI' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
  const isMaterialManager = userRole === 'MALZEME_YONETIMI' || 
    userRole === 'TAMİR' || 
    userRole === 'TAMIR' || 
    userEmail === 'hursit.akter@demirerholding.com' ||
    userEmail === 'emir.unver@demirerholding.com' ||
    Boolean(warehouseState.isMaterialManager);
  return Boolean(isAdmin || isMaterialManager);
};

export const canEditMcfNumber = (userProfile?: any): boolean => {
  const user = userProfile || warehouseState.userProfile || getUserProfile() || (window as any).appState?.userProfile || (window as any).currentUser;
  const userRole = (user?.role || '').toUpperCase().trim();
  const userEmail = (user?.email || '').toLowerCase().trim();
  const isFatih = userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
  const isAdmin = userRole === 'ADMIN' || isFatih;
  const isMaterialManager = userRole === 'MALZEME_YONETIMI' || 
    userEmail === 'hursit.akter@demirerholding.com' ||
    userEmail === 'hursit.aktar@demirerholding.com';
  return Boolean(isAdmin || isMaterialManager);
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
