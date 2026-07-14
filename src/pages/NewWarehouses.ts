import { dataService } from '../services/DataService';
import { db } from '../firebase';
import { doc, onSnapshot, setDoc, deleteDoc, getDoc, serverTimestamp, writeBatch, collection, getCountFromServer, query, where } from 'firebase/firestore';
import { formatTeamName } from '../utils/formatters';
import { warehouseService } from '../services/WarehouseService';
import { warehouseAgent } from '../agents/WarehouseAgent';
import { fileService } from '../services/FileService';
import { excelService } from '../services/ExcelService';
import { serviceReportService } from '../services/ServiceReportService';
import { ImageCompressor } from '../utils/imageCompressor';
import type { IMalzeme } from '../types/depo';
import QRCode from 'qrcode';
import { Html5QrcodeScanner, Html5Qrcode } from 'html5-qrcode';
import { inventoryService } from '../services/InventoryService';
const getUserProfile = (): any => {
  let userProfile = (window as any).appState?.userProfile || (window as any).currentUser;
  if (!userProfile) {
    try {
      // 1. Try auth fallback cache
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
      
      // 2. Try looking up any general user profile in localStorage as a last resort
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

const formatDepoUser = (user: string): string => {
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

const renderWarehouseDashboardHTML = (allowedMain: any[], allowedTeams: any[]) => {
  return `
    <style>
      .wh-agent-card {
        background: rgba(10, 15, 25, 0.45);
        border: 1px solid rgba(0, 242, 254, 0.12);
        border-radius: 14px;
        padding: 1.1rem;
        position: relative;
        overflow: hidden;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        backdrop-filter: blur(10px);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 120px;
        box-sizing: border-box;
      }
      
      .wh-agent-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(90deg, #00f3ff, transparent);
        opacity: 0.6;
        transition: opacity 0.3s;
      }

      .wh-agent-card.team::before {
        background: linear-gradient(90deg, #8f94fb, transparent);
      }

      .wh-agent-card:hover {
        transform: translateY(-4px);
        border-color: rgba(0, 242, 254, 0.35);
        box-shadow: 0 10px 25px rgba(0, 242, 254, 0.08), inset 0 0 12px rgba(0, 242, 254, 0.03);
      }

      .wh-agent-card.team {
        border-color: rgba(143, 148, 251, 0.12);
      }

      .wh-agent-card.team:hover {
        border-color: rgba(143, 148, 251, 0.35);
        box-shadow: 0 10px 25px rgba(143, 148, 251, 0.08), inset 0 0 12px rgba(143, 148, 251, 0.03);
      }

      .wh-agent-card:hover::before {
        opacity: 1;
      }

      .wh-agent-card .wh-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        background: rgba(0, 242, 254, 0.06);
        border: 1px solid rgba(0, 242, 254, 0.15);
        display: flex;
        align-items: center;
        justify-content: center;
        color: #00f3ff;
        font-size: 1.1rem;
        flex-shrink: 0;
        transition: all 0.3s;
      }

      .wh-agent-card.team .wh-icon-box {
        background: rgba(143, 148, 251, 0.06);
        border: 1px solid rgba(143, 148, 251, 0.15);
        color: #8f94fb;
      }

      .wh-agent-card:hover .wh-icon-box {
        background: rgba(0, 242, 254, 0.12);
        border-color: rgba(0, 242, 254, 0.3);
        transform: scale(1.05);
      }

      .wh-agent-card.team:hover .wh-icon-box {
        background: rgba(143, 148, 251, 0.12);
        border-color: rgba(143, 148, 251, 0.3);
      }

      .wh-agent-card .wh-name {
        margin: 0;
        font-size: 0.95rem;
        font-weight: 700;
        color: #ffffff;
        font-family: 'Rajdhani', sans-serif;
        letter-spacing: 0.5px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wh-agent-card .wh-desc {
        font-size: 0.72rem;
        color: #94a3b8;
        display: block;
        margin-top: 2px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .wh-agent-card .enter-btn {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.72rem;
        font-weight: 800;
        color: #94a3b8;
        transition: all 0.2s;
        font-family: 'Rajdhani', sans-serif;
      }

      .wh-agent-card:hover .enter-btn {
        color: #00f3ff;
      }

      .wh-agent-card.team:hover .enter-btn {
        color: #8f94fb;
      }

      .wh-agent-card:hover .enter-btn i {
        transform: translateX(2px);
      }

      .wh-dash-section-title {
        font-size: 0.9rem;
        font-weight: 800;
        color: #94A3B8;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 1.25rem;
        display: flex;
        align-items: center;
        gap: 0.5rem;
      }
    </style>

    <div style="background-color: #0A0E17; min-height: 100vh; color: #E2E8F0; font-family: 'Inter', sans-serif; padding: 2rem; box-sizing: border-box;">
      <!-- Header -->
      <div style="margin-bottom: 2.5rem;">
        <h1 style="font-size: 1.75rem; font-weight: 800; color: #FFFFFF; margin: 0; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff;"></i> Servis Depoları & Zimmetler
        </h1>
        <div style="font-size: 0.9rem; color: #64748B; margin-top: 0.25rem;">Sahaların stok, envanter ve mobil zimmet yönetim paneli</div>
      </div>

      <!-- Main Warehouses Section -->
      ${allowedMain.length > 0 ? `
        <div class="wh-dash-section-title" style="color: #00f3ff;">
          <i class="fa-solid fa-warehouse"></i> Ana Saha Depoları
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 3rem;">
          ${allowedMain.map(wh => `
            <div class="wh-agent-card main" onclick="window.selectWarehouseAndNavigate('${wh.id}')">
              <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                <div class="wh-icon-box">
                  <i class="fa-solid fa-warehouse"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                  <h3 class="wh-name" title="${wh.name}">${wh.name}</h3>
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-top: 4px; gap: 8px;">
                    <span class="wh-desc" title="${wh.description || 'Saha Deposu'}" style="margin: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;">${wh.description || 'Saha Deposu'}</span>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; margin-top: -2px;">
                      <span id="wh-count-${wh.id}" style="font-size: 0.7rem; color: #00f3ff; font-weight: bold; background: rgba(0, 242, 254, 0.08); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(0, 242, 254, 0.15); white-space: nowrap;">Stok: ... Adet</span>
                      <span id="wh-defect-${wh.id}" style="font-size: 0.65rem; color: #EF4444; font-weight: bold; background: rgba(239, 68, 68, 0.08); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.15); white-space: nowrap; display: none;">Defekt: 0 Adet</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.6rem; margin-top: 0.5rem;">
                <span style="font-family: monospace; font-size: 0.72rem; font-weight: 700; color: #00f3ff; background: rgba(0, 242, 254, 0.08); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(0, 242, 254, 0.15);">ID: ${wh.id}</span>
                <div class="enter-btn">
                  <span>GİRİŞ</span>
                  <i class="fa-solid fa-chevron-right"></i>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <!-- Team Warehouses Section -->
      ${allowedTeams.length > 0 ? `
        <div class="wh-dash-section-title" style="color: #8f94fb;">
          <i class="fa-solid fa-truck-ramp-box"></i> Ekiplerin Mobil Zimmetleri
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem; margin-bottom: 3rem;">
          ${allowedTeams.map(wh => `
            <div class="wh-agent-card team" onclick="window.selectWarehouseAndNavigate('${wh.id}')">
              <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
                <div class="wh-icon-box">
                  <i class="fa-solid fa-truck-ramp-box"></i>
                </div>
                <div style="min-width: 0; flex: 1;">
                  <h3 class="wh-name" title="${wh.name}">${wh.name}</h3>
                  <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-top: 4px; gap: 8px;">
                    <span class="wh-desc" title="${wh.description || 'Zimmet Deposu'}" style="margin: 0; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; flex: 1;">${wh.description || 'Zimmet Deposu'}</span>
                    <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0; margin-top: -2px;">
                      <span id="wh-count-${wh.id}" style="font-size: 0.7rem; color: #8f94fb; font-weight: bold; background: rgba(143, 148, 251, 0.08); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(143, 148, 251, 0.15); white-space: nowrap;">Stok: ... Adet</span>
                      <span id="wh-defect-${wh.id}" style="font-size: 0.65rem; color: #EF4444; font-weight: bold; background: rgba(239, 68, 68, 0.08); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.15); white-space: nowrap; display: none;">Defekt: 0 Adet</span>
                    </div>
                  </div>
                </div>
              </div>
              
              <div style="display: flex; align-items: center; justify-content: space-between; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 0.6rem; margin-top: 0.5rem;">
                <span style="font-family: monospace; font-size: 0.72rem; font-weight: 700; color: #8f94fb; background: rgba(143, 148, 251, 0.08); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(143, 148, 251, 0.15);">ID: ${wh.id.replace('team_', '').replace(/_/g, '')}</span>
                <div class="enter-btn">
                  <span>GİRİŞ</span>
                  <i class="fa-solid fa-chevron-right"></i>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      ${allowedMain.length === 0 && allowedTeams.length === 0 ? `
        <div style="padding: 4rem 2rem; color: #64748B; text-align: center; border: 1px dashed rgba(255,255,255,0.05); border-radius: 16px;">
          <i class="fa-solid fa-warehouse" style="font-size: 2.5rem; color: rgba(255,255,255,0.15); margin-bottom: 1rem; display: block;"></i>
          <p style="font-size: 1rem; font-weight: 600; color: #94A3B8;">Erişebileceğiniz Kayıtlı Depo Bulunmamaktadır</p>
          <p style="font-size: 0.8rem; margin-top: 0.25rem;">Depoları görüntülemek için yetkilendirilmiş olmanız gerekir.</p>
        </div>
      ` : ''}
    </div>
  `;
};

export const NewWarehousePage = async (warehouseId?: string | null) => {
  const allWarehouses = dataService.getWarehouses();
  const userProfile = getUserProfile();
  const isMaterialManager = userProfile?.role === 'ADMIN' || userProfile?.role === 'MALZEME_YONETIMI' || userProfile?.role === 'TAMİR' || userProfile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
  const hasWarehouseDeletePerm = isMaterialManager || userProfile?.allowedTabs?.warehouses?.deleteItem || userProfile?.allowedTabs?.team_warehouses?.deleteItem;
  const hasWarehouseManagePerm = isMaterialManager || userProfile?.allowedTabs?.warehouses?.manageStock || userProfile?.allowedTabs?.team_warehouses?.manageStock;

  const getTeamResponsibleSites = (whId: string): string[] => {
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
      const site = allSites.find(s => s.id === id);
      return site ? site.name : id;
    });
  };

  const getWarehouseSite = (warehouse: any): string => {
    if (warehouse.id.startsWith('team_')) {
      const sites = getTeamResponsibleSites(warehouse.id);
      return `<strong>Sorumlu Olduğu Sahalar (${sites.length}):</strong> ${sites.join(', ')}`;
    } else {
      const allSites = dataService.getSites();
      const whNameBase = warehouse.name.toLowerCase().replace('depo', '').trim();
      const site = allSites.find(s => {
        const siteNameBase = s.name.toLowerCase().trim();
        return whNameBase.includes(siteNameBase) || siteNameBase.includes(whNameBase);
      });
      return `<strong>Bağlı Olduğu Saha:</strong> ${site ? site.name : warehouse.name}`;
    }
  };

  if (!warehouseId) {
    const allowedMainWarehouses = userProfile?.role === 'ADMIN' || isMaterialManager
      ? allWarehouses
      : allWarehouses.filter(w => (userProfile?.allowedWarehouses || []).includes(w.id));

    const teamWarehouses: { id: string; name: string; description: string }[] = [];
    for (let i = 1; i <= 15; i++) {
      const teamName = `Team ${String(i).padStart(2, '0')}`;
      const teamId = `team_${teamName.replace(/\s+/g, '_')}`;
      const userTeamCanonical = userProfile?.team ? formatTeamName(userProfile.team) : '';
      const isUserOwnTeam = userTeamCanonical === teamName;
      const isAllowed = userProfile?.role === 'ADMIN' || isMaterialManager || isUserOwnTeam || (userProfile?.allowedWarehouses || []).includes(teamId);
      if (isAllowed) {
        teamWarehouses.push({
          id: teamId,
          name: `${teamName} Deposu`,
          description: `${teamName} Mobil Zimmet Deposu`
        });
      }
    }
    
    // Load warehouse item counts asynchronously
    setTimeout(async () => {
      try {
        const allWhIds = [
          ...allowedMainWarehouses.map(w => w.id),
          ...teamWarehouses.map(w => w.id)
        ];
        
        await Promise.all(allWhIds.map(async (whId) => {
          try {
            const collRef = collection(db, 'warehouses', whId, 'inventory_v2');
            
            // 1. Get total count
            const totalSnapshot = await getCountFromServer(collRef);
            const totalCount = totalSnapshot.data().count;
            
            // 2. Get defect count
            const defectQuery = query(collRef, where('condition', '==', 'DEFECT'));
            const defectSnapshot = await getCountFromServer(defectQuery);
            const defectCount = defectSnapshot.data().count;
            
            // 3. Normal count is total minus defect
            const normalCount = Math.max(0, totalCount - defectCount);

            const el = document.getElementById(`wh-count-${whId}`);
            if (el) {
              el.innerText = `Stok: ${normalCount} Adet`;
            }
            
            const defectEl = document.getElementById(`wh-defect-${whId}`);
            if (defectEl) {
              defectEl.innerText = `Defekt: ${defectCount} Adet`;
              if (defectCount > 0) {
                defectEl.style.display = 'inline-block';
              } else {
                defectEl.style.display = 'none';
              }
            }
          } catch (e) {
            console.warn(`Failed to fetch count for warehouse ${whId}`, e);
            const el = document.getElementById(`wh-count-${whId}`);
            if (el) el.innerText = 'Stok: 0 Adet';
            const defectEl = document.getElementById(`wh-defect-${whId}`);
            if (defectEl) defectEl.style.display = 'none';
          }
        }));
      } catch (err) {
        console.error("Failed to load warehouse counts:", err);
      }
    }, 50);

    return renderWarehouseDashboardHTML(allowedMainWarehouses, teamWarehouses);
  }

  let currentWarehouse = allWarehouses.find(w => w.id === warehouseId);

  if (!currentWarehouse && warehouseId && warehouseId.startsWith('team_')) {
    const teamNameClean = warehouseId.replace('team_', '').replace(/_/g, ' ');
    currentWarehouse = {
      id: warehouseId,
      name: `${teamNameClean} Deposu`,
      description: `${teamNameClean} Mobil Zimmet Deposu`
    } as any;
  }

  if (!currentWarehouse) {
    return `<div style="padding: 2rem; color: #94A3B8; text-align: center;">Kayıtlı depo bulunamadı.</div>`;
  }

  (window as any).currentWarehouseId = currentWarehouse.id;

  const isMobileWarehouse = currentWarehouse.id.startsWith('team_');

  const targetOptions: { id: string, name: string }[] = [];
  if (hasWarehouseManagePerm) {
    allWarehouses.forEach(w => {
      if (w.id !== currentWarehouse.id) {
        targetOptions.push({ id: w.id, name: w.name });
      }
    });
    for (let i = 1; i <= 15; i++) {
      const teamName = `Team ${String(i).padStart(2, '0')}`;
      const teamId = `team_${teamName.replace(/\s+/g, '_')}`;
      if (teamId !== currentWarehouse.id) {
        targetOptions.push({ id: teamId, name: `${teamName} Deposu` });
      }
    }
  } else if (userProfile?.team) {
    const teamName = userProfile.team;
    const teamId = `team_${teamName.replace(/\s+/g, '_')}`;
    
    // Determine allowed team warehouses from userProfile.allowedWarehouses
    const allowedTeamWhs: { id: string, name: string }[] = [];
    if (userProfile.allowedWarehouses && Array.isArray(userProfile.allowedWarehouses)) {
      userProfile.allowedWarehouses.forEach((whId: string) => {
        if (whId.startsWith('team_') && whId !== currentWarehouse.id) {
          const displayLabel = whId.replace('team_', '').replace('_', ' ') + ' Deposu';
          allowedTeamWhs.push({ id: whId, name: displayLabel });
        }
      });
    }

    if (currentWarehouse.id.startsWith('team_')) {
      // Ekip kendi zimmet sayfasındaysa, malzemeyi iade edebileceği ana depoları listele
      allWarehouses.forEach(w => {
        targetOptions.push({ id: w.id, name: w.name });
      });
      // Ayrıca yetkisi olan diğer ekipleri de listele
      allowedTeamWhs.forEach(opt => {
        if (opt.id !== currentWarehouse.id) {
          targetOptions.push(opt);
        }
      });
    } else {
      // Ekip ana depodaysa, kendi zimmetine çekebilir
      if (teamId !== currentWarehouse.id) {
        targetOptions.push({ id: teamId, name: `Zimmetim (${teamName})` });
      }
      // Ayrıca yetkisi olan diğer ekipleri de listele
      allowedTeamWhs.forEach(opt => {
        if (opt.id !== teamId) {
          targetOptions.push(opt);
        }
      });
    }
  }

  (window as any)._warehouseTargetOptions = targetOptions;

  const currentTab = ((window as any).currentWarehouseTab || 'inventory').toUpperCase();
  const currentPeriod = localStorage.getItem('warehouse_analytics_period') || 'this-month';

  // Fetch and Process Service Reports for Turbine Material Consumption
  let reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });

  const now = new Date();
  reports = reports.filter(r => {
    const rDate = new Date(r.date);
    if (currentPeriod === 'this-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      return rDate >= monday;
    } else if (currentPeriod === 'this-month') {
      return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'last-month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
    } else if (currentPeriod === 'this-year') {
      return rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'custom') {
      const startStr = localStorage.getItem('warehouse_analytics_start');
      const endStr = localStorage.getItem('warehouse_analytics_end');
      if (startStr && endStr) {
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        return rDate >= start && rDate <= end;
      }
      return true;
    }
    return true;
  });

  const turbineData: Record<string, { totalUsed: number; totalDefect: number; items: any[] }> = {};
  
  if (currentWarehouse) {
      // Filter reports by warehouse's associated site. (Warehouse name e.g. "Anemon İntepe Depo", site name e.g. "Anemon Intepe")
      const whNameBase = currentWarehouse.name.toLowerCase().replace('depo', '').trim();
      
      reports.forEach(report => {
         if (!report.materials || report.materials.length === 0) return;
         
         const isMobileWarehouse = currentWarehouse.id.startsWith('team_');
         let isMatch = false;
         if (isMobileWarehouse) {
           const whTeam = formatTeamName(currentWarehouse.id);
           const reportCreatorTeam = report.createdBy ? formatTeamName(report.createdBy.split('@')[0]) : '';
           const reportPersonnelStr = Array.isArray(report.personnel) ? report.personnel.join(', ') : (report.personnel || '');
           const reportPersonnelTeam = reportPersonnelStr ? formatTeamName(reportPersonnelStr) : '';
           const reportTeamField = report.team ? formatTeamName(report.team) : '';
           isMatch = (whTeam === reportCreatorTeam || whTeam === reportPersonnelTeam || whTeam === reportTeamField);
         } else {
           const reportSiteBase = (report.siteName || '').toLowerCase().trim();
           isMatch = whNameBase.includes(reportSiteBase) || reportSiteBase.includes(whNameBase) || whNameBase === 'merkez';
         }
         
         if (!isMatch) return;
         
         const turbineId = (report.siteName ? report.siteName + ' ' : '') + (report.turbineNo || report.turbineSerial || 'Bilinmeyen');
         const searchSAP = (localStorage.getItem('warehouse_analytics_sap') || '').toLowerCase().trim();
         
         report.materials.forEach(mat => {
            if (mat.used > 0 || mat.defectCount > 0) {
               // SAP / İsim Filtresi
               if (searchSAP) {
                 const sapMatch = (mat.sapNo || '').toLowerCase().includes(searchSAP);
                 const nameMatch = (mat.description || '').toLowerCase().includes(searchSAP);
                 if (!sapMatch && !nameMatch) return; // Filtreye uymazsa atla
               }

               if (!turbineData[turbineId]) {
                  turbineData[turbineId] = { totalUsed: 0, totalDefect: 0, items: [] };
               }
               
               turbineData[turbineId].items.push({
                  reportId: report.reportNo || report.id || '',
                  reportDocId: report.id || '',
                  date: report.date,
                  matFormNo: report.matFormNo || '-',
                  sapNo: mat.sapNo || '-',
                  serialNo: mat.serialNo || '-',
                  description: mat.description,
                  used: mat.used || 0,
                  defect: mat.defectCount || 0,
                  faultCode: report.faultCode || '-',
                  faultDesc: report.faultDesc || '-'
               });
               turbineData[turbineId].totalUsed += (mat.used || 0);
               turbineData[turbineId].totalDefect += (mat.defectCount || 0);
            }
         });
      });
  }

  // Collect all uninstalled (defectCount > 0) items for this site's reports
  const defectReportItems: any[] = [];
  if (currentWarehouse) {
    const isMobileWarehouse = currentWarehouse.id.startsWith('team_');
    const whNameBase = currentWarehouse.name.toLowerCase().replace('depo', '').trim();
    
    reports.forEach(report => {
      if (!report.materials || report.materials.length === 0 || !report.date) return;
      
      let isMatch = false;
      if (isMobileWarehouse) {
        const whTeam = formatTeamName(currentWarehouse.id);
        const reportCreatorTeam = report.createdBy ? formatTeamName(report.createdBy.split('@')[0]) : '';
        const reportPersonnelStr = Array.isArray(report.personnel) ? report.personnel.join(', ') : (report.personnel || '');
        const reportPersonnelTeam = reportPersonnelStr ? formatTeamName(reportPersonnelStr) : '';
        const reportTeamField = report.team ? formatTeamName(report.team) : '';
        isMatch = (whTeam === reportCreatorTeam || whTeam === reportPersonnelTeam || whTeam === reportTeamField);
      } else {
        const reportSiteBase = (report.siteName || '').toLowerCase().trim();
        isMatch = whNameBase.includes(reportSiteBase) || reportSiteBase.includes(whNameBase) || whNameBase === 'merkez';
      }
      
      if (!isMatch) return;
      
      report.materials.forEach(mat => {
        if (mat.defectCount > 0) {
          defectReportItems.push({
            reportId: report.reportNo || report.id || '',
            reportDocId: report.id || '',
            date: report.date,
            matFormNo: report.matFormNo || '-',
            turbineNo: (report.siteName ? report.siteName + ' ' : '') + (report.turbineNo || report.turbineSerial || 'Bilinmeyen'),
            type: report.type || 'ARIZA',
            sapNo: mat.sapNo || '-',
            serialNo: mat.serialNo || '-',
            description: mat.description,
            defect: mat.defectCount || 0,
            faultCode: report.faultCode || '-',
            faultDesc: report.faultDesc || '-',
            siteName: report.siteName || '-'
          });
        }
      });
    });
  }
  defectReportItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const sortedTurbines = Object.entries(turbineData).sort((a, b) => (b[1].totalUsed + b[1].totalDefect) - (a[1].totalUsed + a[1].totalDefect));

  // Store data globally for Excel export
  (window as any).currentTurbineData = turbineData;
  (window as any).currentWarehouseName = currentWarehouse ? currentWarehouse.name : '';

  const warehouseName = currentWarehouse ? currentWarehouse.name : 'Depo Seçilmedi';
  
  // Fetch draft reservations
  let draftReservations = { bySap: {} as Record<string, number>, details: [] as any[] };
  if (currentWarehouse) {
    try {
      draftReservations = await warehouseService.getReservationsFromDrafts(currentWarehouse.id);
    } catch (e) {
      console.error("Failed to load draft reservations:", e);
    }
  }
  (window as any).draftReservations = draftReservations;

  // Fetch live inventory items
  let inventoryItems: any[] = [];
  let inventoryWithQRs: any[] = [];
  let onlyShowCritical = false;
  if (currentWarehouse) {
    const rawItems = await warehouseService.getInventory(currentWarehouse.id, true);
    inventoryItems = rawItems.map(item => {
      let resolvedName = (item as any).name || item.description || '';
      if (!resolvedName || resolvedName === 'Bilinmeyen Malzeme') {
        const dictMat = inventoryService.getMaterialBySap(item.sapNo);
        if (dictMat && dictMat.d) {
          resolvedName = dictMat.d;
        }
      }
      if (!resolvedName) {
        resolvedName = 'Bilinmeyen Malzeme';
      }
      return { ...item, name: resolvedName };
    });
    (window as any).currentInventoryData = inventoryItems;
    inventoryWithQRs = inventoryItems.map(item => ({ ...item, qrDataUrl: '' }));
  }

  // Fetch pending repair returns (SENT_BACK status, matching targetWarehouseId)
  let pendingReturns: any[] = [];
  let allRepairs: any[] = [];
  if (currentWarehouse) {
    try {
      const { repairService } = await import('../services/RepairService');
      allRepairs = await repairService.getRepairs();
      if (hasWarehouseManagePerm) {
        pendingReturns = allRepairs.filter(r => r.status === 'SENT_BACK' && r.targetWarehouseId === currentWarehouse.id);
      }
    } catch (err) {
      console.error("Failed to load repairs:", err);
    }
  }
  
  // Attach logic to window so it runs when rendered
  (window as any).initNewWarehouseLogic = () => {
    (window as any).toggleDefectGroupCollapse = (groupKey: string) => {
      const headerRow = document.getElementById(`group-header-${groupKey}`);
      const rows = document.querySelectorAll(`.group-row-${groupKey}`);
      if (!headerRow) return;
      const icon = headerRow.querySelector('.toggle-icon') as HTMLElement;
      const textSpan = headerRow.querySelector('.expand-text');
      
      const isCollapsed = rows[0] ? (rows[0] as HTMLElement).style.display === 'none' : true;
      
      rows.forEach((row: any) => {
        row.style.display = isCollapsed ? '' : 'none';
      });
      
      if (icon) {
        if (isCollapsed) {
          icon.style.transform = 'rotate(90deg)';
          if (textSpan) textSpan.innerHTML = '<i class="fa-solid fa-compress"></i> Gizle';
        } else {
          icon.style.transform = 'rotate(0deg)';
          if (textSpan) textSpan.innerHTML = '<i class="fa-solid fa-expand"></i> Göster';
        }
      }
    };

    (window as any).toggleDefectGroup = (groupCheckbox: HTMLInputElement, groupKey: string) => {
      const checkboxes = document.querySelectorAll(`.group-checkbox-${groupKey}`);
      checkboxes.forEach((cb: any) => {
        cb.checked = groupCheckbox.checked;
      });
    };

    (window as any).filterDefectListBySite = (button: HTMLElement, siteName: string) => {
      const buttons = document.querySelectorAll('.site-filter-btn');
      buttons.forEach((btn: any) => {
        btn.classList.remove('active');
        btn.style.background = 'rgba(255,255,255,0.03)';
        btn.style.color = '#94A3B8';
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
      });
      
      button.classList.add('active');
      button.style.background = 'rgba(20, 241, 149, 0.2)';
      button.style.color = '#14F195';
      button.style.borderColor = 'rgba(20, 241, 149, 0.4)';
      
      const headerRows = document.querySelectorAll('tr[id^="group-header-"]');
      
      headerRows.forEach((header: any) => {
        const groupKey = header.id.replace('group-header-', '');
        const childRows = document.querySelectorAll(`.group-row-${groupKey}`);
        
        let hasMatch = false;
        if (siteName === 'all') {
          hasMatch = true;
        } else {
          childRows.forEach((child: any) => {
            const childSite = child.getAttribute('data-site');
            if (childSite === siteName) {
              hasMatch = true;
            }
          });
        }
        
        if (hasMatch) {
          header.style.display = '';
          childRows.forEach((child: any) => {
            if (siteName === 'all') {
              child.style.display = 'none';
            } else {
              const childSite = child.getAttribute('data-site');
              child.style.display = (childSite === siteName) ? '' : 'none';
            }
          });
          
          const icon = header.querySelector('.toggle-icon') as HTMLElement;
          const textSpan = header.querySelector('.expand-text');
          if (icon) {
            if (siteName === 'all') {
              icon.style.transform = 'rotate(0deg)';
              if (textSpan) textSpan.innerHTML = '<i class="fa-solid fa-expand"></i> Göster';
            } else {
              icon.style.transform = 'rotate(90deg)';
              if (textSpan) textSpan.innerHTML = '<i class="fa-solid fa-compress"></i> Gizle';
            }
          }
        } else {
          header.style.display = 'none';
          childRows.forEach((child: any) => {
            child.style.display = 'none';
          });
        }
      });
    };

    // Inventory Drag & Drop Sidebar handlers
    (window as any).warehouseInventoryDragStart = async (event: DragEvent, itemId: string) => {
      event.dataTransfer?.setData('text/plain', itemId);
      (window as any).draggedWarehouseItemId = itemId;

      const tr = event.currentTarget as HTMLElement;
      if (tr) tr.classList.add('warehouse-item-dragging');

      let drawer = document.getElementById('warehouse-quick-transfer-drawer');
      if (!drawer) {
        drawer = document.createElement('div');
        drawer.id = 'warehouse-quick-transfer-drawer';
        drawer.className = 'warehouse-quick-transfer-drawer glass-panel';
        drawer.style.cssText = `
          position: fixed;
          top: 0;
          right: -340px;
          width: 320px;
          height: 100vh;
          background: rgba(10, 14, 23, 0.95);
          border-left: 1px solid rgba(20, 241, 149, 0.25);
          box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6);
          z-index: 999999;
          backdrop-filter: blur(16px);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          box-sizing: border-box;
          transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        `;

        drawer.innerHTML = `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 0.8rem; color: #14f195;">
            <i class="fa-solid fa-truck-fast" style="font-size: 1.4rem; text-shadow: 0 0 10px rgba(20,241,149,0.3);"></i>
            <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; margin: 0; font-weight: 800; letter-spacing: 1px;">HIZLI TRANSFER</h3>
          </div>
          <p style="font-size: 0.72rem; color: #94A3B8; margin: 0 0 1.25rem 0; line-height: 1.4;">
            Malzemeyi sevk etmek istediğiniz hedef deponun veya ekibin üzerine bırakın.
          </p>
          
          <div id="warehouse-drawer-targets-container" class="warehouse-drop-targets-container" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; padding-right: 4px;">
            <div style="color: #94A3B8; text-align: center; padding: 2rem; font-size: 0.8rem;">
              <i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Depo seçenekleri yükleniyor...
            </div>
          </div>
          
          <style>
            .warehouse-drop-target.drag-over {
              background: rgba(20, 241, 149, 0.08) !important;
              border-color: #14f195 !important;
              border-style: solid !important;
              color: #14f195 !important;
              box-shadow: 0 0 15px rgba(20, 241, 149, 0.2);
              transform: scale(1.02);
            }
            .warehouse-item-dragging {
              opacity: 0.45;
              background: rgba(20, 241, 149, 0.05) !important;
              border: 1px dashed #14f195 !important;
            }
          </style>
        `;
        document.body.appendChild(drawer);
      }

      setTimeout(() => {
        if (drawer) drawer.style.right = '0';
      }, 10);

      // Asynchronously resolve target options for this specific item!
      try {
        const item = (inventoryItems || []).find((i: any) => i.id === itemId);
        let matchedWh: any = null;
        
        if (currentWarehouse.id.startsWith('team_') && !isMaterialManager && item) {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const logsRef = collection(db, 'warehouses', currentWarehouse.id, 'logs');
          const q = query(
            logsRef, 
            where('sapNo', '==', item.sapNo), 
            where('type', '==', 'TRANSFER')
          );
          const snapshot = await getDocs(q);
          const logsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
          
          logsList.sort((a, b) => {
            const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
            const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
            return bTime - aTime;
          });

          for (const logData of logsList) {
            if (logData.quantity > 0 && logData.note) {
              const noteLower = logData.note.toLowerCase();
              const foundWh = allWarehouses.find(w => {
                const cleanName = w.name.toLowerCase().replace('depo', '').trim();
                return noteLower.includes(cleanName);
              });
              if (foundWh) {
                matchedWh = foundWh;
                break;
              }
            }
          }
        }

        let options = (window as any)._warehouseTargetOptions || [];
        if (matchedWh) {
          options = [{ id: matchedWh.id, name: matchedWh.name }];
        }

        const container = document.getElementById('warehouse-drawer-targets-container');
        if (container) {
          if (options.length === 0) {
            container.innerHTML = `<div style="color: #EF4444; text-align: center; padding: 2rem; font-size: 0.8rem;">İade edilebilecek geçerli depo bulunamadı.</div>`;
          } else {
            container.innerHTML = options.map((opt: any) => `
              <div class="warehouse-drop-target" 
                   ondragover="event.preventDefault(); this.classList.add('drag-over')" 
                   ondragleave="this.classList.remove('drag-over')"
                   ondrop="window.handleWarehouseItemDrop(event, '${opt.id}')"
                   style="background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 12px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.85rem; text-align: center; color: #fff; cursor: pointer; transition: all 0.2s;">
                <i class="fa-solid fa-truck-moving" style="margin-right: 6px; font-size: 0.75rem; color: #5b9aff;"></i> ${opt.name}
              </div>
            `).join('');
          }
        }
      } catch (err) {
        console.error("Error resolving warehouse targets for item drag:", err);
      }
    };

    (window as any).warehouseInventoryDragEnd = (event: DragEvent) => {
      const tr = event.currentTarget as HTMLElement;
      if (tr) tr.classList.remove('warehouse-item-dragging');

      const drawer = document.getElementById('warehouse-quick-transfer-drawer');
      if (drawer) {
        drawer.style.right = '-340px';
        setTimeout(() => {
          drawer.remove();
        }, 300);
      }
    };

    (window as any).handleWarehouseItemDrop = async (event: DragEvent, destWarehouseId: string) => {
      event.preventDefault();
      
      const itemId = (window as any).draggedWarehouseItemId || event.dataTransfer?.getData('text/plain');
      if (!itemId) return;

      const item = (inventoryItems || []).find((i: any) => i.id === itemId);
      if (!item) return;

      (window as any).openTransferModal(item.id, item.sapNo, item.name.replace(/'/g, "\\'"), item.quantity, destWarehouseId);
    };

    let html5QrcodeScanner: Html5QrcodeScanner | null = null;
    let auditMode: 'info' | 'audit' = 'info';
    let auditResults: any[] = [];
    let currentPage = 1;
    let itemsPerPage = 25;
    let currentAuditPage = 1;

    // Set up real-time listener for tasks (reservations)
    if ((window as any)._tasksUnsubscribe) {
      try { (window as any)._tasksUnsubscribe(); } catch(e) {}
      (window as any)._tasksUnsubscribe = null;
    }

    if (currentWarehouse) {
      (async () => {
        try {
          const { collection, query, where, onSnapshot } = await import('firebase/firestore');
          const tasksQuery = query(collection(db, 'tasks'), where('taskInfo.siteId', '==', currentWarehouse.id));
          (window as any)._tasksUnsubscribe = onSnapshot(tasksQuery, (snap: any) => {
             const bySap: Record<string, number> = {};
             const details: any[] = [];
             
             snap.docs.forEach((docSnap: any) => {
               const data = docSnap.data();
               if (data.workflow?.durum === 'Tamamlandı') return;
               
               const materials = data.maintenanceData?.materials || [];
               const usedMaterials: any[] = [];
               
               materials.forEach((mat: any) => {
                 const typeUpper = mat.type?.toUpperCase();
                 const isTakilan = !mat.type || typeUpper === 'T';
                 if (mat.sapNo && mat.used > 0 && isTakilan) {
                   const sap = String(mat.sapNo).trim();
                   bySap[sap] = (bySap[sap] || 0) + Number(mat.used);
                   usedMaterials.push({
                     sapNo: sap,
                     description: mat.description || '',
                     used: Number(mat.used)
                   });
                 }
               });
               
               if (usedMaterials.length > 0) {
                 details.push({
                   taskId: docSnap.id,
                   team: data.assignment?.assignedTeam || '-',
                   turbinNo: data.taskInfo?.turbinNo || '-',
                   sablon: data.taskInfo?.secilenSablon || '-',
                   durum: data.workflow?.durum || '-',
                   createdBy: data.assignment?.createdBy || '-',
                   personnel: data.maintenanceData?.teamPersonnel?.map((p: any) => typeof p === 'string' ? p : p.name || '-') || [],
                   materials: usedMaterials
                 });
               }
             });
             
             draftReservations = { bySap, details };
             (window as any).draftReservations = draftReservations;
             
             if ((window as any).updateRealTimeReservationsAndStats) {
               (window as any).updateRealTimeReservationsAndStats();
             }
          });
        } catch (e) {
          console.error("Failed to set up real-time tasks listener:", e);
        }
      })();
    }

    // Set up real-time listener for warehouse inventory items
    if ((window as any)._inventoryUnsubscribe) {
      try { (window as any)._inventoryUnsubscribe(); } catch(e) {}
      (window as any)._inventoryUnsubscribe = null;
    }

    if (currentWarehouse) {
      (async () => {
        try {
          const { collection, onSnapshot } = await import('firebase/firestore');
          const invCol = collection(db, 'warehouses', currentWarehouse.id, 'inventory_v2');
          (window as any)._inventoryUnsubscribe = onSnapshot(invCol, (snap: any) => {
             const rawItems = snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
             inventoryItems = rawItems.map((item: any) => {
               let resolvedName = (item as any).name || item.description || '';
               if (!resolvedName || resolvedName === 'Bilinmeyen Malzeme') {
                 const dictMat = inventoryService.getMaterialBySap(item.sapNo);
                 if (dictMat && dictMat.d) {
                   resolvedName = dictMat.d;
                 }
               }
               if (!resolvedName) {
                 resolvedName = 'Bilinmeyen Malzeme';
               }
               return { ...item, name: resolvedName };
             });
             
             inventoryWithQRs = inventoryItems.map(item => ({ ...item, qrDataUrl: '' }));
             (window as any).inventoryItems = inventoryItems;
             (window as any).inventoryWithQRs = inventoryWithQRs;

             if ((window as any).updateRealTimeReservationsAndStats) {
               (window as any).updateRealTimeReservationsAndStats();
             }
             if ((window as any).renderInventoryTable) {
               (window as any).renderInventoryTable();
             }
          });
        } catch (e) {
          console.error("Failed to set up real-time inventory listener:", e);
        }
      })();
    }

    (window as any).setInventoryCriticalFilter = (val: boolean) => {
       onlyShowCritical = val;
       currentPage = 1;
       
       const totalCard = document.getElementById('total-kalem-card');
       const kritikCard = document.getElementById('kritik-stok-card');
       
       if (totalCard) {
          if (!val) {
             totalCard.style.borderColor = '#3B82F6';
             totalCard.style.backgroundColor = 'rgba(59, 130, 246, 0.05)';
          } else {
             totalCard.style.borderColor = '#1E293B';
             totalCard.style.backgroundColor = '#111827';
          }
       }
       
       if (kritikCard) {
          if (val) {
             kritikCard.style.borderColor = '#EF4444';
             kritikCard.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
          } else {
             kritikCard.style.borderColor = 'rgba(239, 68, 68, 0.25)';
             kritikCard.style.backgroundColor = '#111827';
          }
       }
       
       if (typeof (window as any).renderInventoryTable === 'function') {
          (window as any).renderInventoryTable();
       }
    };

    // Dom update helper for reservations & stats card
    (window as any).updateRealTimeReservationsAndStats = () => {
      const totalKalemEl = document.getElementById('total-kalem-count');
      const kritikStokEl = document.getElementById('kritik-stok-count');
      
      const totalKalemCount = inventoryItems.filter(i => i.condition !== 'DEFECT').length;
      const kritikStokCount = inventoryItems.filter(i => i.condition !== 'DEFECT' && i.quantity <= (i.minStock || 0)).length;
      
      if (totalKalemEl) totalKalemEl.innerText = String(totalKalemCount);
      if (kritikStokEl) kritikStokEl.innerText = String(kritikStokCount);
      
      const tbody = document.getElementById('reservations-tbody');
      if (tbody) {
        const rows: any[] = [];
        
        // 1. Task-based reservations
        draftReservations.details.forEach((d: any) => {
          d.materials.forEach((m: any) => {
            const invItem = inventoryItems.find((item: any) => String(item.sapNo).trim() === String(m.sapNo).trim());
            const shelf = invItem ? (invItem.shelfNo || '-') : '-';
            rows.push({
              team: d.team,
              sapNo: m.sapNo,
              description: m.description,
              qty: m.used,
              shelf: shelf
            });
          });
        });

        // 2. Transfer-based reservations
        inventoryItems.forEach((item: any) => {
          if (item.reservations) {
            Object.entries(item.reservations).forEach(([tId, qty]) => {
              const numericQty = Number(qty);
              if (numericQty > 0) {
                const cleanTeam = tId.replace('team_', '').replace(/_/g, ' ');
                const exists = rows.some((r: any) => 
                  String(r.team).toLowerCase().trim() === cleanTeam.toLowerCase().trim() && 
                  String(r.sapNo).trim() === String(item.sapNo).trim()
                );
                if (!exists) {
                  rows.push({
                    team: cleanTeam,
                    sapNo: item.sapNo,
                    description: item.name || item.description || '-',
                    qty: numericQty,
                    shelf: item.shelfNo || '-'
                  });
                }
              }
            });
          }
        });

        const htmlRows = rows.map((r: any) => `
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); color: #E2E8F0;">
            <td style="padding: 0.4rem 0.5rem; font-weight: bold; color: #ff9800;">${r.team}</td>
            <td style="padding: 0.4rem 0.5rem; font-family: monospace;">${r.sapNo}</td>
            <td style="padding: 0.4rem 0.5rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">${r.description}</td>
            <td style="padding: 0.4rem 0.5rem; text-align: center; font-weight: 600; color: #14F195;">${r.qty} Adet</td>
            <td style="padding: 0.4rem 0.5rem; text-align: right; color: #94A3B8;">${r.shelf}</td>
          </tr>
        `);

        tbody.innerHTML = htmlRows.length > 0 ? htmlRows.join('') : `
          <tr>
            <td colspan="5" style="padding: 1.5rem 0.5rem; text-align: center; color: #64748B;">
              Aktif ekip rezervasyonu bulunmuyor.
            </td>
          </tr>
        `;
      }
    };

    // Set up real-time Firestore listener for draft audit collaboration
    if ((window as any)._draftAuditUnsubscribe) {
      try {
        (window as any)._draftAuditUnsubscribe();
      } catch (e) {
        console.error(e);
      }
      (window as any)._draftAuditUnsubscribe = null;
    }

    let draftData: any = {};
    if (currentWarehouse) {
      const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
      (window as any)._draftAuditUnsubscribe = onSnapshot(draftDocRef, (snap: any) => {
        let incomingDraft: any = {};
        let updatedBy = '';
        let lastUpdated: any = null;
        if (snap.exists()) {
          const data = snap.data();
          incomingDraft = data.draftData || {};
          updatedBy = data.updatedBy || '';
          lastUpdated = data.lastUpdated;
        }
        draftData = incomingDraft;
        (window as any).currentDraftData = draftData;

        // Update the collaboration banner
        const banner = document.getElementById('manual-audit-collaboration-banner');
        const bannerText = document.getElementById('collaboration-banner-text');
        if (banner && bannerText) {
          if (updatedBy) {
            const timeStr = lastUpdated?.toDate ? lastUpdated.toDate().toLocaleTimeString('tr-TR') : new Date().toLocaleTimeString('tr-TR');
            bannerText.innerHTML = `<strong>Ortak Sayım Aktif</strong>: En son <strong>${updatedBy}</strong> tarafından saat <strong>${timeStr}</strong> civarında güncellendi. Kaldığı yerden devam edebilirsiniz.`;
            banner.style.display = 'flex';
          } else {
            banner.style.display = 'none';
          }
        }

        // Update input elements on screen, except the one currently focused
        const activeElId = document.activeElement ? document.activeElement.id : null;
        
        const qtyInputs = document.querySelectorAll('.manual-audit-input');
        qtyInputs.forEach((input: any) => {
          const itemId = input.dataset.id;
          const val = draftData[itemId]?.qty || '';
          if (input.id !== activeElId) {
            input.value = val;
          }
        });
        
        const shelfInputs = document.querySelectorAll('.manual-audit-shelf');
        shelfInputs.forEach((input: any) => {
          const itemId = input.dataset.id;
          const val = draftData[itemId]?.shelf !== undefined ? draftData[itemId].shelf : (input.dataset.original || '');
          if (input.id !== activeElId) {
            input.value = val;
          }
        });

        qtyInputs.forEach((input: any) => {
          const itemId = input.dataset.id;
          const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
          if (noteInput && noteInput.id !== activeElId) {
            const val = draftData[itemId]?.note || '';
            const qtyVal = draftData[itemId]?.qty || '';
            noteInput.value = val;
            const sysQty = parseFloat(input.dataset.sysqty || '0');
            if (qtyVal !== '' && parseFloat(qtyVal) !== sysQty) {
              noteInput.style.display = 'block';
            } else {
              noteInput.style.display = 'none';
            }
          }
        });

        if ((window as any).updateManualSummaryBar) {
          (window as any).updateManualSummaryBar();
        }
      });
    }

    (window as any).changePage = (page: number) => {
       currentPage = page;
       (window as any).renderInventoryTable();
    };


    (window as any).changeItemsPerPage = (limit: string) => {
       itemsPerPage = limit === 'all' ? 999999 : parseInt(limit, 10);
       currentPage = 1;
       (window as any).renderInventoryTable();
    };

    (window as any).filterInventory = () => {
       currentPage = 1;
       (window as any).renderInventoryTable();
    };


    let renderRetryCount = 0;
    (window as any).renderInventoryTable = async () => {
      const tbody = document.getElementById('inventory-tbody');
      if (!tbody) {
        if (renderRetryCount < 10) {
          renderRetryCount++;
          setTimeout(() => {
            if (typeof (window as any).renderInventoryTable === 'function') {
              (window as any).renderInventoryTable();
            }
          }, 50);
        }
        return;
      }
      renderRetryCount = 0; 

      try {
        const searchInput = document.getElementById('inventory-search-input') as HTMLInputElement;
        const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

        // 1. Sort the full inventoryWithQRs array (excluding DEFECT items, unless in W11)
        const sortedItems = [...inventoryWithQRs]
          .filter(item => {
            if (currentWarehouse.id === 'MTA') return true;
            if (item.condition === 'DEFECT') return false;
            if (isMobileWarehouse && item.quantity <= 0 && (item.reservedQuantity || 0) <= 0) {
              return false;
            }
            if (onlyShowCritical) {
              if (item.quantity > (item.minStock || 0)) {
                return false;
              }
            }
            return true;
          })
          .sort((a, b) => {
            const locA = String(a.shelfNo || '').trim().toUpperCase();
            const locB = String(b.shelfNo || '').trim().toUpperCase();
            if (!locA && locB) return 1;
            if (locA && !locB) return -1;
            let locCmp = 0;
            if (locA && locB) {
                locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
            }
            if (locCmp !== 0) return locCmp;
            const sapA = String(a.sapNo || '').trim();
            const sapB = String(b.sapNo || '').trim();
            if (sapA && sapB) {
                const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
                if (sapCmp !== 0) return sapCmp;
            }
            return String(a.name || '').localeCompare(String(b.name || ''));
          });

      // 2. Filter sorted items by search term
      const filteredItems = sortedItems.filter(item => {
        const sap = String(item.sapNo || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        return term === '' || sap.includes(term) || name.includes(term);
      });

      // 3. Paginate
      const totalItems = filteredItems.length;
      const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
      
      if (currentPage > totalPages) currentPage = totalPages;
      if (currentPage < 1) currentPage = 1;

      const startIndex = (currentPage - 1) * itemsPerPage;
      const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
      const paginatedItems = filteredItems.slice(startIndex, endIndex);

      // Async generate QRs for only the paginated slice
      await Promise.all(paginatedItems.map(async (item) => {
        if (!item.qrDataUrl) {
          try {
            const qrData = JSON.stringify({ id: item.id, sapNo: item.sapNo, warehouseId: currentWarehouse.id });
            item.qrDataUrl = await QRCode.toDataURL(qrData, { width: 64, margin: 1 });
          } catch (e) {
            item.qrDataUrl = '';
          }
        }
      }));

      // 4. Render Rows
      if (paginatedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #94A3B8;">Aramaya uygun malzeme bulunamadı.</td></tr>`;
      } else {
        tbody.innerHTML = paginatedItems.map(item => {
          const kritik = (item.minStock || 0);
          const rezerve = (item.reservedQuantity || 0);
          const isKritik = item.quantity <= kritik;
          
          // Escape single quotes for safely passing inside onclick strings
          const cleanName = item.name.replace(/'/g, "");
          const cleanNameEscaped = item.name.replace(/'/g, "\\'");
          
          return `
            <tr class="inventory-row" 
                draggable="true" 
                ondragstart="window.warehouseInventoryDragStart(event, '${item.id}')"
                ondragend="window.warehouseInventoryDragEnd(event)"
                data-sap="${item.sapNo}" 
                data-name="${item.name.toLowerCase()}"
                style="cursor: grab;"
                title="Sürükleyip açılan sağ menüdeki depolara bırakarak hızlı transfer başlatabilirsiniz">
              <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);"><input type="checkbox" class="item-checkbox" value="${item.id}" onclick="window.onItemCheckboxClick(this)" /></td>
              <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.sapNo}</td>
              <td id="img-cell-${item.id}" style="padding: 1rem; color: #E2E8F0; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 500; display: flex; align-items: center;">
                ${item.qrDataUrl ? `<div onclick="window.showBigQR('${item.id}', '${item.sapNo}', '${cleanName}', '${item.qrDataUrl}')" style="width:36px; height:36px; border-radius:6px; background-color: #111827; border: 1px solid #1E293B; margin-right:8px; display:flex; align-items:center; justify-content:center; color:#14F195; cursor: pointer; transition: all 0.2s;" title="Büyük QR Gör" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#111827'"><i class="fa-solid fa-qrcode"></i></div>` : ''}
                ${item.imageUrl 
                  ? `<div id="img-btn-${item.id}" onclick="window.showBigImage('${item.imageUrl}', '${cleanName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>` 
                  : `<div id="img-btn-${item.id}" onclick="window.triggerImageUpload('${item.id}', '${item.sapNo}')" style="width:36px; height:36px; border-radius:6px; background-color: #1E293B; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#64748B; cursor: pointer; transition: all 0.2s;" title="Görsel Ekle" onmouseover="this.style.backgroundColor='#334155'" onmouseout="this.style.backgroundColor='#1E293B'"><i class="fa-solid fa-image"></i></div>`
                }
                <div style="display: flex; flex-direction: column; flex: 1; min-width: 0;">
                  <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    <span style="word-break: break-word;">${item.name}</span>
                    ${currentWarehouse.id !== 'MTA' && item.condition && item.condition !== 'NEW' ? `
                      <span style="font-size: 0.7rem; font-weight: 700; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; 
                        ${item.condition === 'DEFECT' ? 'background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3);' : 
                          item.condition === 'REVISED' ? 'background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3);' : 
                          item.condition === 'SCRAP' ? 'background: rgba(156, 163, 175, 0.15); color: #9CA3AF; border: 1px solid rgba(156, 163, 175, 0.3);' : ''}">
                        ${item.condition === 'DEFECT' ? 'Arızalı (Defect)' : item.condition === 'REVISED' ? 'Revize' : item.condition === 'SCRAP' ? 'Hurda' : item.condition}
                      </span>
                    ` : ''}
                  </div>
                  
                  ${currentWarehouse.id === 'MTA' ? `
                    <div style="font-size: 0.78rem; color: #10B981; margin-top: 4px; font-weight: 700; font-family: monospace;">
                      Seri No: <span style="color: #FFF; font-weight: normal;">${item.serialNo || '-'}</span>
                    </div>
                    ${item.note ? `
                      <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 2px; font-weight: 500;">
                        Not: <span style="color: #E2E8F0;">${item.note}</span>
                      </div>
                    ` : ''}
                  ` : ''}

                  ${currentWarehouse.id === 'MTA' ? (() => {
                    const matchingRepairs = (allRepairs || []).filter(r => String(r.sapNo).trim() === String(item.sapNo).trim());
                    matchingRepairs.sort((a,b) => {
                      const timeA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt).getTime();
                      const timeB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt).getTime();
                      return timeB - timeA;
                    });
                    const latestRepair = matchingRepairs[0];
                    if (!latestRepair) return '';
                    const sourceWh = allWarehouses.find(w => w.id === latestRepair.sourceWarehouseId);
                    const sourceName = sourceWh ? sourceWh.name : (latestRepair.sourceWarehouseId === 'EXTERNAL' ? 'Harici Giriş' : latestRepair.sourceWarehouseId || '-');
                    
                    return `
                      <div style="font-size: 0.78rem; color: #94A3B8; margin-top: 6px; display: flex; flex-direction: column; gap: 3px; border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 6px; width: 100%;">
                        <div><strong style="color: #E2E8F0;">Kaynak:</strong> ${sourceName}</div>
                        ${latestRepair.faultCode && latestRepair.faultCode !== '-' ? `<div><strong style="color: #F59E0B;">Arıza:</strong> ${latestRepair.faultCode} ${latestRepair.faultDesc && latestRepair.faultDesc !== '-' ? `(${latestRepair.faultDesc})` : ''}</div>` : ''}
                        ${latestRepair.receiveNote ? `<div><strong style="color: #14F195;">Kabul Notu:</strong> ${latestRepair.receiveNote}</div>` : ''}
                        ${latestRepair.repairNotes ? `<div><strong style="color: #3B82F6;">Onarım Notu:</strong> ${latestRepair.repairNotes}</div>` : ''}
                      </div>
                    `;
                  })() : ''}
                </div>
              </td>
              <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                <span style="background-color: ${isKritik ? 'rgba(239, 68, 68, 0.1)' : 'rgba(20, 241, 149, 0.1)'}; color: ${isKritik ? '#EF4444' : '#14F195'}; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.8rem; font-weight: 600;">
                  ${item.quantity} Adet
                </span>
              </td>
              <td style="padding: 1rem; color: ${rezerve > 0 ? '#F59E0B' : '#94A3B8'}; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                ${(() => {
                  if (rezerve > 0) {
                    const resDetails: string[] = [];
                    if (item.reservations) {
                      Object.entries(item.reservations).forEach(([tId, qty]) => {
                        if (Number(qty) > 0) {
                          const cleanTeam = tId.replace('team_', '').replace(/_/g, ' ');
                          resDetails.push(`${cleanTeam}: ${qty}`);
                        }
                      });
                    }
                    if (resDetails.length > 0) {
                      return `
                        <span style="font-weight: 700; color: #F59E0B;" title="${resDetails.join(', ')}">
                          ${rezerve} <span style="font-size: 0.75rem; font-weight: 500; color: #94A3B8; margin-left: 2px;">(${resDetails.join(', ')})</span>
                        </span>
                      `;
                    }
                    return `<span style="font-weight: 700; color: #F59E0B;">${rezerve}</span>`;
                  }
                  return '0';
                })()}
              </td>
              <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">${item.shelfNo || '-'}</td>
              <td style="padding: 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5); text-align: right; white-space: nowrap;">
                ${currentWarehouse.id === 'MTA' ? `
                  <i id="edit-btn-${item.id}" onclick="window.openMtaEditModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', '${item.serialNo || ''}', '${item.note || ''}', '${item.shelfNo || ''}', ${item.quantity})" class="fa-solid fa-pen-to-square" style="cursor: pointer; opacity: 0.7; color: #14F195; margin-left: 0.75rem; transition: opacity 0.2s; font-size: 1.15rem;" onmouseover="this.style.opacity='1'; this.style.color='#00cc6a'" onmouseout="this.style.opacity='0.7'; this.style.color='#14F195'" title="Seri No / Not Düzenle"></i>
                  ${hasWarehouseDeletePerm ? `
                    <i onclick="window.deleteItem('${item.id}', '${cleanNameEscaped}')" class="fa-solid fa-trash" style="cursor: pointer; opacity: 0.7; color: #EF4444; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Sil"></i>
                  ` : ''}
                ` : `
                  ${isMobileWarehouse ? `
                    <i onclick="window.openP2PTransferModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity})" class="fa-solid fa-qrcode" style="cursor: pointer; opacity: 0.7; color: #14F195; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="QR Transfer Kodu Oluştur"></i>
                    <i onclick="window.openHistoryModal('${item.id}', '${cleanNameEscaped}')" class="fa-solid fa-clock-rotate-left" style="cursor: pointer; opacity: 0.7; color: #3B82F6; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Geçmiş"></i>
                    <i id="edit-btn-${item.id}" onclick="window.openEditModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity}, '${item.shelfNo || ''}', '${item.imageUrl || ''}', ${item.minStock || 0})" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.7; color: #E2E8F0; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Düzenle"></i>
                  ` : `
                    ${item.condition === 'DEFECT' && hasWarehouseManagePerm ? `
                      <i onclick="window.openSendToRepairModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity})" class="fa-solid fa-screwdriver-wrench" style="cursor: pointer; opacity: 0.7; color: #14F195; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Tamire Gönder"></i>
                      <i onclick="window.scrapDefectiveItem('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity})" class="fa-solid fa-dumpster" style="cursor: pointer; opacity: 0.7; color: #EF4444; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Hurdaya Ayır"></i>
                    ` : ''}
                    <i onclick="window.openHistoryModal('${item.id}', '${cleanNameEscaped}')" class="fa-solid fa-clock-rotate-left" style="cursor: pointer; opacity: 0.7; color: #3B82F6; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Geçmiş"></i>
                    ${hasWarehouseManagePerm ? `
                      <i onclick="window.openTransferModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity})" class="fa-solid fa-truck-fast" style="cursor: pointer; opacity: 0.7; color: #F59E0B; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Transfer Et"></i>
                    ` : ''}
                    <i id="edit-btn-${item.id}" onclick="window.openEditModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity}, '${item.shelfNo || ''}', '${item.imageUrl || ''}', ${item.minStock || 0})" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.7; color: #E2E8F0; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Düzenle"></i>
                    ${hasWarehouseDeletePerm ? `
                      <i onclick="window.deleteItem('${item.id}', '${cleanNameEscaped}')" class="fa-solid fa-trash" style="cursor: pointer; opacity: 0.7; color: #EF4444; margin-left: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Sil"></i>
                    ` : ''}
                  `}
                `}
              </td>
            </tr>
          `;
        }).join('');
      }

      // Update header checkbox
      const selectAllCb = document.getElementById('select-all-checkbox') as HTMLInputElement;
      if (selectAllCb) {
        const itemCbs = document.querySelectorAll('.item-checkbox');
        if (itemCbs.length > 0) {
          selectAllCb.checked = Array.from(itemCbs).every((cb: any) => cb.checked);
        } else {
          selectAllCb.checked = false;
        }
      }

      // 5. Render Pagination Controls
      const paginationDiv = document.getElementById('inventory-pagination');
      if (paginationDiv) {
        if (totalItems === 0) {
          paginationDiv.innerHTML = '';
          return;
        }

        const showingStart = totalItems === 0 ? 0 : startIndex + 1;
        const showingEnd = endIndex;
        
        let selectOptions = '';
        [25, 50, 100, 250].forEach(opt => {
          selectOptions += `<option value="${opt}" ${itemsPerPage === opt ? 'selected' : ''}>${opt} Satır</option>`;
        });
        selectOptions += `<option value="all" ${itemsPerPage > 10000 ? 'selected' : ''}>Tümü</option>`;

        paginationDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #111827; border-top: 1px solid #1E293B; flex-wrap: wrap; gap: 1rem;">
            <div style="color: #64748B; font-size: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
              <span>${totalItems} malzeme arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
              <select onchange="window.changeItemsPerPage(this.value)" style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 2px 6px; font-size: 0.8rem; outline: none; cursor: pointer;">
                ${selectOptions}
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button onclick="window.changePage(1)" ${currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-left"></i>
              </button>
              <button onclick="window.changePage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-left"></i>
              </button>
              
              <span style="color: #E2E8F0; font-size: 0.85rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${currentPage} / ${totalPages}</span>
              
              <button onclick="window.changePage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-right"></i>
              </button>
              <button onclick="window.changePage(${totalPages})" ${currentPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
        `;
      }
      } catch (err: any) {
        console.error("renderInventoryTable error:", err);
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #EF4444; font-weight: bold; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 6px;">Hata: ${err.message || err}</td></tr>`;
      }
    };

    (window as any).changeManualAuditPage = (page: number) => {
       currentAuditPage = page;
       (window as any).renderManualAuditTable();
    };

    let auditRenderRetryCount = 0;
    (window as any).renderManualAuditTable = () => {
        const tbody = document.getElementById('manual-audit-tbody');
        if (!tbody) {
          if (auditRenderRetryCount < 10) {
            auditRenderRetryCount++;
            setTimeout(() => {
              if (typeof (window as any).renderManualAuditTable === 'function') {
                (window as any).renderManualAuditTable();
              }
            }, 50);
          }
          return;
        }
        auditRenderRetryCount = 0; 

       const searchInput = document.getElementById('manual-audit-search') as HTMLInputElement;
       const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
       
       const auditInventoryItems = currentWarehouse.id === 'MTA'
          ? inventoryItems
          : inventoryItems.filter(item => item.condition !== 'DEFECT');

       // 1. Sort the items
       const sortedItems = [...auditInventoryItems].sort((a, b) => {
          const locA = String(a.shelfNo || '').trim().toUpperCase();
          const locB = String(b.shelfNo || '').trim().toUpperCase();
          if (!locA && locB) return 1;
          if (locA && !locB) return -1;
          let locCmp = 0;
          if (locA && locB) {
              locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
          }
          if (locCmp !== 0) return locCmp;
          const sapA = String(a.sapNo || '').trim();
          const sapB = String(b.sapNo || '').trim();
          if (sapA && sapB) {
              const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
              if (sapCmp !== 0) return sapCmp;
          }
          return String(a.name || '').localeCompare(String(b.name || ''));
       });

       // 2. Filter by search term
       const filteredItems = sortedItems.filter(item => {
          const sap = String(item.sapNo || '').toLowerCase();
          const name = String(item.name || '').toLowerCase();
          return term === '' || sap.includes(term) || name.includes(term);
       });

       const totalItems = filteredItems.length;
       const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

       if (currentAuditPage > totalPages) currentAuditPage = totalPages;
       if (currentAuditPage < 1) currentAuditPage = 1;

       const startIndex = (currentAuditPage - 1) * itemsPerPage;
       const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
       const paginatedItems = filteredItems.slice(startIndex, endIndex);

       if (paginatedItems.length === 0) {
          tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94A3B8;">Aramaya uygun malzeme bulunamadı.</td></tr>`;
       } else {
          tbody.innerHTML = paginatedItems.map(item => {
             const draftQty = draftData[item.id]?.qty || '';
             const draftNote = draftData[item.id]?.note || '';
             const draftShelf = draftData[item.id]?.shelf !== undefined ? draftData[item.id].shelf : (item.shelfNo || '');
             const isNoteVisible = draftQty !== '' && parseFloat(draftQty) !== item.quantity;
             return `
                <tr class="manual-audit-row" data-sap="${item.sapNo.toLowerCase()}" data-name="${item.name.toLowerCase()}">
                  <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.sapNo}</td>
                  <td style="padding: 1rem; color: #E2E8F0; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">${item.name}</td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="text" id="manual-shelf-${item.id}" class="manual-audit-shelf" data-id="${item.id}" data-original="${item.shelfNo || ''}" value="${draftShelf}" oninput="window.saveDraftAudit()" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #94A3B8; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Raf No" />
                  </td>
                  <td style="padding: 1rem; color: #14F195; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="number" id="manual-qty-${item.id}" class="manual-audit-input" data-id="${item.id}" data-sap="${item.sapNo}" data-name="${item.name.replace(/"/g, '&quot;')}" data-sysqty="${item.quantity}" oninput="window.onManualQtyChange('manual-qty-${item.id}', 'manual-note-${item.id}', ${item.quantity})" value="${draftQty}" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Sayı..." />
                  </td>
                  <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                    <input type="text" id="manual-note-${item.id}" value="${draftNote}" oninput="window.saveDraftAudit()" style="display: ${isNoteVisible ? 'block' : 'none'}; width: 100%; height: 36px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.85rem;" placeholder="Zorunlu Not" />
                  </td>
                </tr>
             `;
          }).join('');
       }

       // Render pagination controls for Sayım
       const paginationDiv = document.getElementById('manual-audit-pagination');
       if (paginationDiv) {
          if (totalItems === 0) {
             paginationDiv.innerHTML = '';
             return;
          }
          const showingStart = startIndex + 1;
          const showingEnd = endIndex;
          paginationDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #111827; border-top: 1px solid #1E293B; flex-wrap: wrap; gap: 1rem;">
              <div style="color: #64748B; font-size: 0.85rem;">
                <span>${totalItems} malzeme arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
              </div>
              <div style="display: flex; align-items: center; gap: 4px;">
                <button onclick="window.changeManualAuditPage(1)" ${currentAuditPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                  <i class="fa-solid fa-angles-left"></i>
                </button>
                <button onclick="window.changeManualAuditPage(${currentAuditPage - 1})" ${currentAuditPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                  <i class="fa-solid fa-angle-left"></i>
                </button>
                
                <span style="color: #E2E8F0; font-size: 0.85rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${currentAuditPage} / ${totalPages}</span>
                
                <button onclick="window.changeManualAuditPage(${currentAuditPage + 1})" ${currentAuditPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                  <i class="fa-solid fa-angle-right"></i>
                </button>
                <button onclick="window.changeManualAuditPage(${totalPages})" ${currentAuditPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                  <i class="fa-solid fa-angles-right"></i>
                </button>
              </div>
            </div>
          `;
       }
    };

    (window as any).startQRScanner = () => {
       auditMode = 'info';
       document.getElementById('qr-modal')!.style.display = 'flex';
       startScanner();
    };

    (window as any).startFastAudit = () => {
       auditMode = 'audit';
       auditResults = [];
       document.getElementById('qr-modal')!.style.display = 'flex';
       startScanner();
    };

    (window as any).closeQRModal = () => {
       document.getElementById('qr-modal')!.style.display = 'none';
       if (html5QrcodeScanner) {
         html5QrcodeScanner.clear().catch(e => console.error(e));
       }
    };

    const startScanner = () => {
      document.getElementById('qr-reader-results')!.innerHTML = '';
      if (html5QrcodeScanner) html5QrcodeScanner.clear();
      html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
      html5QrcodeScanner.render(onScanSuccess, onScanFailure);
    };

    const handleP2PTransfer = async (p2pData: {
      type: string;
      sourceWarehouseId: string;
      sourceItemId: string;
      sapNo: string;
      name: string;
      quantity: number;
    }) => {
      const resultsDiv = document.getElementById('qr-reader-results')!;
      
      const userProfile = getUserProfile();
      const userName = userProfile?.displayName || userProfile?.name || 'Bilinmeyen Kullanıcı';
      
      let targetWarehouseId = '';
      let targetWarehouseName = '';
      
      if (userProfile?.team) {
        targetWarehouseId = `team_${userProfile.team.replace(/\s+/g, '_')}`;
        targetWarehouseName = `${userProfile.team} Deposu (Zimmetiniz)`;
      }
      
      const sourceNameClean = p2pData.sourceWarehouseId.replace('team_', '').replace(/_/g, ' ');
      
      resultsDiv.innerHTML = `
        <div style="background: #1E293B; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; border: 1px solid #14F195; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.15); text-align: left;">
          <div style="width: 48px; height: 48px; background: rgba(20, 241, 149, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #14F195; font-size: 1.5rem;">
            <i class="fa-solid fa-right-left-arrows"></i>
          </div>
          <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 700; text-align: center;">P2P Hızlı Transfer Talebi</h4>
          
          <div style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <span style="color: #64748B;">Gönderen Depo:</span>
              <span style="color: #F59E0B; font-weight: 600;">${sourceNameClean}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <span style="color: #64748B;">Malzeme SAP:</span>
              <span style="color: #E2E8F0; font-weight: 600;">${p2pData.sapNo}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <span style="color: #64748B;">Malzeme Adı:</span>
              <span style="color: #E2E8F0; font-weight: 600; text-align: right; max-width: 60%;">${p2pData.name}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
              <span style="color: #64748B; font-size: 0.9rem;">Transfer Miktarı:</span>
              <span style="color: #14F195; font-weight: 700; font-size: 1.1rem;">${p2pData.quantity} Adet</span>
            </div>
          </div>

          ${targetWarehouseId ? `
            <div style="background: rgba(20, 241, 149, 0.05); border: 1px dashed rgba(20, 241, 149, 0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 1.25rem; text-align: center;">
              <span style="color: #94A3B8; font-size: 0.8rem; display: block; margin-bottom: 2px;">Alıcı Depo (Sizin Deponuz):</span>
              <strong style="color: #14F195; font-size: 0.95rem;">${targetWarehouseName}</strong>
            </div>
          ` : `
            <div style="margin-bottom: 1.25rem;">
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Alıcı Depo Seçin</label>
              <select id="p2p-target-select" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                ${allWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                ${Array.from({length: 15}, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`).map(tName => {
                  const tId = `team_${tName.replace(/\s+/g, '_')}`;
                  return `<option value="${tId}">${tName} Deposu</option>`;
                }).join('')}
              </select>
            </div>
          `}

          <div style="display: flex; gap: 0.75rem;">
            <button id="p2p-confirm-btn" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Transferi Onayla</button>
            <button onclick="window.closeQRModal()" style="padding: 0.75rem 1.25rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">İptal</button>
          </div>
        </div>
      `;

      const confirmBtn = document.getElementById('p2p-confirm-btn') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const originalText = confirmBtn.innerText;
          confirmBtn.innerText = 'İşleniyor...';
          confirmBtn.disabled = true;
          
          try {
            const finalTargetId = targetWarehouseId || (document.getElementById('p2p-target-select') as HTMLSelectElement).value;
            if (!finalTargetId) {
              alert('Lütfen hedef depo seçin.');
              confirmBtn.innerText = originalText;
              confirmBtn.disabled = false;
              return;
            }

            await warehouseService.transferMaterial(
              p2pData.sourceWarehouseId,
              finalTargetId,
              p2pData.sourceItemId,
              p2pData.quantity,
              userName
            );

            alert('P2P Transfer başarıyla tamamlandı!');
            (window as any).closeQRModal();
            
            if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
            }
          } catch (err: any) {
            console.error(err);
            alert('P2P Transfer Hatası: ' + err.message);
            confirmBtn.innerText = originalText;
            confirmBtn.disabled = false;
          }
        };
      }
    };

    const handleCustodyScanning = async (sapNo: string, scannedWarehouseId: string = '') => {
      const resultsDiv = document.getElementById('qr-reader-results')!;
      const userProfile = getUserProfile();
      const userName = userProfile?.displayName || userProfile?.name || 'Bilinmeyen Kullanıcı';
      
      const lastSourceWarehouseId = localStorage.getItem('last_p2p_source_warehouse') || '';
      const defaultSourceId = scannedWarehouseId || lastSourceWarehouseId;

      let materialDesc = 'Bilinmeyen Malzeme';

      // 1. Try resolving description from the default source warehouse inventory
      if (defaultSourceId) {
        try {
          const inv = await warehouseService.getInventory(defaultSourceId);
          const item = inv.find(i => String(i.sapNo).trim() === sapNo.trim());
          if (item) {
            materialDesc = item.description || materialDesc;
          }
        } catch (e) {
          console.warn("Could not retrieve default source inventory for description", e);
        }
      }

      // 2. Fallback to dictionary
      if (materialDesc === 'Bilinmeyen Malzeme') {
        try {
          const material = inventoryService.getMaterialBySap(sapNo);
          if (material) {
            materialDesc = material.d || materialDesc;
          }
        } catch (e) {}
      }

      resultsDiv.innerHTML = `
        <div style="background: #1E293B; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; border: 1px solid #14F195; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.15); text-align: left;">
          <div style="width: 48px; height: 48px; background: rgba(20, 241, 149, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #14F195; font-size: 1.5rem;">
            <i class="fa-solid fa-truck-moving"></i>
          </div>
          <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 700; text-align: center;">Zimmete Malzeme Ekle</h4>
          
          <div style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <span style="color: #64748B;">Malzeme SAP:</span>
              <span style="color: #14F195; font-weight: 600;">${sapNo}</span>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
              <span style="color: #64748B;">Malzeme Adı:</span>
              <span style="color: #E2E8F0; font-weight: 600; text-align: right; max-width: 60%;">${materialDesc}</span>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Kaynak Depo (Nereden Alınıyor)</label>
            <select id="custody-source-select" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
              ${allWarehouses.map(w => `<option value="${w.id}" ${w.id === defaultSourceId ? 'selected' : ''}>${w.name}</option>`).join('')}
            </select>
          </div>

          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Alınacak Miktar</label>
            <input id="custody-qty-input" type="number" min="1" value="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <button id="custody-confirm-btn" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Zimmetime Al</button>
            <button onclick="window.closeQRModal()" style="padding: 0.75rem 1.25rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">İptal</button>
          </div>
        </div>
      `;

      const confirmBtn = document.getElementById('custody-confirm-btn') as HTMLButtonElement;
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const originalText = confirmBtn.innerText;
          confirmBtn.innerText = 'İşleniyor...';
          confirmBtn.disabled = true;
          
          try {
            const sourceWarehouseId = (document.getElementById('custody-source-select') as HTMLSelectElement).value;
            const quantity = parseInt((document.getElementById('custody-qty-input') as HTMLInputElement).value);
            
            if (!sourceWarehouseId || isNaN(quantity) || quantity <= 0) {
              alert('Lütfen geçerli kaynak depo ve miktar girin.');
              confirmBtn.innerText = originalText;
              confirmBtn.disabled = false;
              return;
            }

            localStorage.setItem('last_p2p_source_warehouse', sourceWarehouseId);

            const sourceInventory = await warehouseService.getInventory(sourceWarehouseId);
            const sourceItem = sourceInventory.find(i => String(i.sapNo).trim() === sapNo.trim());
            
            if (!sourceItem) {
              alert('Seçilen kaynak depoda bu SAP numaralı malzeme bulunamadı.');
              confirmBtn.innerText = originalText;
              confirmBtn.disabled = false;
              return;
            }

            if (sourceItem.quantity < quantity) {
              alert(`Kaynak depoda yeterli stok yok. Mevcut: ${sourceItem.quantity} Adet`);
              confirmBtn.innerText = originalText;
              confirmBtn.disabled = false;
              return;
            }

            await warehouseService.transferMaterial(
              sourceWarehouseId,
              currentWarehouse.id,
              sourceItem.id!,
              quantity,
              userName
            );

            alert('Malzeme başarıyla zimmetinize alındı!');
            (window as any).closeQRModal();
            
            if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
            }
          } catch (err: any) {
            console.error(err);
            alert('Zimmet Alma Hatası: ' + err.message);
            confirmBtn.innerText = originalText;
            confirmBtn.disabled = false;
          }
        };
      }

      // Auto focus and select quantity input for fastest entry
      const qtyInput = document.getElementById('custody-qty-input') as HTMLInputElement;
      if (qtyInput) {
        qtyInput.focus();
        qtyInput.select();
        qtyInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmBtn.click();
          }
        });
      }
    };

    const onScanSuccess = (decodedText: string) => {
      let searchId = '';
      let searchSap = '';
      let scannedWarehouseId = '';

      try {
        // Try to parse as JSON first (standard format)
        const data = JSON.parse(decodedText);
        if (data && typeof data === 'object') {
          if (data.type === 'p2p_transfer') {
            if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(e => console.error(e));
            handleP2PTransfer(data);
            return;
          }
          searchId = data.id ? String(data.id).trim() : '';
          searchSap = data.sapNo ? String(data.sapNo).trim() : '';
          scannedWarehouseId = data.warehouseId ? String(data.warehouseId).trim() : '';
        } else {
          // Fallback if parsed but not an object (e.g. numeric SAP number string like "25342")
          const cleanText = decodedText.trim();
          searchId = cleanText;
          searchSap = cleanText;
        }
      } catch (e) {
        // Fallback for plain text QR codes (backward compatibility)
        console.log('[Scanner] QR is plain text, using direct search:', decodedText);
        const cleanText = decodedText.trim();
        searchId = cleanText;
        searchSap = cleanText;
      }

      if (isMobileWarehouse) {
        if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(e => console.error(e));
        handleCustodyScanning(searchSap || searchId, scannedWarehouseId);
        return;
      }

      // First try to match by ID (most specific)
      let item = searchId ? inventoryWithQRs.find(i => String(i.id).trim().toLowerCase() === searchId.toLowerCase()) : null;
      
      // Fallback to SAP number if not found by ID
      if (!item && searchSap) {
        item = inventoryWithQRs.find(i => String(i.sapNo).trim().toLowerCase() === searchSap.toLowerCase());
      }

      if (item) {
        if (html5QrcodeScanner) html5QrcodeScanner.clear(); // pause scanning
        if (auditMode === 'info') {
           showInfo(item);
        } else {
           showAuditInput(item);
        }
      } else {
        console.warn('[Scanner] No matching material found for:', decodedText);
        const resultsDiv = document.getElementById('qr-reader-results')!;
        const whName = (window as any).currentWarehouseName || 'Bilinmeyen Depo';
        resultsDiv.innerHTML = `
          <div style="background: #1E293B; border-radius: 12px; padding: 1.25rem; margin-top: 1rem; text-align: center; border: 1px solid #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
            <div style="width: 42px; height: 42px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: #ef4444; font-size: 1.25rem;">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 700;">Malzeme Eşleşmedi</h4>
            <p style="color: #94A3B8; font-size: 0.85rem; margin: 0 0 1.25rem 0; line-height: 1.4;">
              Okutulan kod depodaki herhangi bir malzeme (SAP No veya ID) ile eşleşmedi.
            </p>
            <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.25rem; text-align: left;">
              <span style="color: #FCA5A5; font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">⚠️ DEPO KONTROLÜ:</span>
              <span style="color: #E2E8F0; font-size: 0.82rem; line-height: 1.35; display: block;">
                Lütfen şu an işlem yaptığınız depoyu kontrol edin.<br>
                Şu An Seçili Depo: <strong style="color: #FCA5A5;">${whName}</strong>
              </span>
            </div>
            <button onclick="window.startQRScanner()" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#2563EB'" onmouseout="this.style.background='#3B82F6'">Yeni QR Tara</button>
            <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">Kapat</button>
          </div>
        `;
        if (html5QrcodeScanner) html5QrcodeScanner.clear().catch(e => console.error(e));
      }
    };

    const onScanFailure = (error: any) => { /* ignore */ };

    const showInfo = (item: any) => {
       const resultsDiv = document.getElementById('qr-reader-results')!;
       resultsDiv.innerHTML = `
         <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem; text-align: center;">
           ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />` : ''}
           <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
           <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">SAP No: ${item.sapNo}</div>
           <div style="background: #0A0E17; border-radius: 6px; padding: 1rem;">
             <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Güncel Stok</div>
             <div style="font-size: 2rem; font-weight: 700; color: #14F195;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</div>
           </div>
           <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
           <button onclick="window.startQRScanner()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #1E293B; border: 1px solid #334155; color: white; font-weight: 600; cursor: pointer;">Yeni QR Tara</button>
         </div>
       `;
    };

    const showAuditInput = (item: any) => {
       const resultsDiv = document.getElementById('qr-reader-results')!;
       resultsDiv.innerHTML = `
         <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
           <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
           <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">Sistem Stoğu: <strong>${item.quantity}</strong></div>
           
           <div style="margin-bottom: 1rem;">
             <label style="display: block; font-size: 0.85rem; color: #94A3B8; margin-bottom: 0.5rem;">Fiziksel Sayım (Adet)</label>
             <input type="number" id="audit-qty-input" placeholder="Sayım miktarı..." style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
           </div>

           <div id="audit-note-container" style="display: none; margin-bottom: 1rem;">
             <label style="display: block; font-size: 0.85rem; color: #EF4444; margin-bottom: 0.5rem;">Fark Açıklaması (Zorunlu)</label>
             <input type="text" id="audit-note-input" placeholder="Neden eksik/fazla?" style="width: 100%; height: 42px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
           </div>

           <button id="save-audit-item-btn" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 600; cursor: pointer;">Kaydet ve Devam Et</button>
           <button onclick="window.finishAudit()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Sayımı Bitir</button>
         </div>
       `;

       const qtyInput = document.getElementById('audit-qty-input') as HTMLInputElement;
       const noteContainer = document.getElementById('audit-note-container')!;
       const noteInput = document.getElementById('audit-note-input') as HTMLInputElement;
       const saveBtn = document.getElementById('save-audit-item-btn')!;

       qtyInput.addEventListener('input', () => {
         const val = parseFloat(qtyInput.value);
         if (!isNaN(val) && val !== item.quantity) {
           noteContainer.style.display = 'block';
         } else {
           noteContainer.style.display = 'none';
         }
       });

       saveBtn.addEventListener('click', () => {
         const qty = parseFloat(qtyInput.value);
         if (isNaN(qty)) return alert('Geçerli bir miktar girin.');
         const diff = qty - item.quantity;
         if (diff !== 0 && !noteInput.value.trim()) {
           return alert('Lütfen fark açıklamasını girin!');
         }

         auditResults.push({
           itemId: item.id,
           sapNo: item.sapNo,
           description: item.name,
           systemQty: item.quantity,
           physicalQty: qty,
           diff: diff,
           note: diff !== 0 ? noteInput.value.trim() : ''
         });

         startScanner();
       });
    };

    (window as any).finishAudit = async () => {
       if (auditResults.length === 0) {
         (window as any).closeQRModal();
         return;
       }

       const confirmBtn = confirm('Sayımı tamamlamak ve stokları güncellemek istediğinize emin misiniz?');
       if (!confirmBtn) return;

       try {
         const totalDiff = auditResults.reduce((sum, r) => sum + r.diff, 0);
         const userProfile = getUserProfile();
         const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
         
         await warehouseService.saveAudit(currentWarehouse.id, {
           user: user,
           totalItems: auditResults.length,
           totalDiff: totalDiff,
           results: auditResults
         });

         alert('Sayım başarıyla kaydedildi ve stoklar güncellendi!');
         (window as any).closeQRModal();
         if ((window as any).selectWarehouseAndNavigate) {
           (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
         }
       } catch (error) {
         console.error(error);
         alert('Sayım kaydedilirken bir hata oluştu.');
       }
    };

    (window as any).toggleSelectAll = (headerCheckbox: HTMLInputElement) => {
       const rows = document.querySelectorAll('.inventory-row');
       rows.forEach((row: any) => {
           if (row.style.display !== 'none') {
               const cb = row.querySelector('.item-checkbox') as HTMLInputElement;
               if (cb) cb.checked = headerCheckbox.checked;
           }
       });
    };

    (window as any).onItemCheckboxClick = (cb: HTMLInputElement) => {
       const headerCheckbox = document.getElementById('select-all-checkbox') as HTMLInputElement;
       if (headerCheckbox) {
          const checkboxes = document.querySelectorAll('.item-checkbox');
          const allChecked = Array.from(checkboxes).every((c: any) => c.checked);
          headerCheckbox.checked = allChecked;
       }
    };

    (window as any).showBigQR = (id: string, sapNo: string, name: string, qrUrl: string) => {
       document.getElementById('big-qr-img')!.setAttribute('src', qrUrl);
       const titleDiv = document.getElementById('big-qr-title')!;
       titleDiv.innerHTML = `
          <div style="font-size: 1.15rem; font-weight: 700; color: #FFFFFF; line-height: 1.3;">${name}</div>
          <div style="font-size: 0.95rem; color: #14F195; margin-top: 6px; font-weight: 700;">SAP NO: ${sapNo}</div>
       `;
       (window as any)._currentBigQRItem = { id, sapNo, description: name, warehouseId: currentWarehouse.id };
       document.getElementById('big-qr-modal')!.style.display = 'flex';
    };

    (window as any).closeBigQR = () => {
       document.getElementById('big-qr-modal')!.style.display = 'none';
       (window as any)._currentBigQRItem = null;
    };

     (window as any).showRecoveryInfoList = (itemId: string) => {
        const inventory = (window as any).currentInventoryData || [];
        const item = inventory.find((i: any) => i.id === itemId);
        if (!item) return;

        let notes: string[] = [];
        if (item.recoveryNotes && Array.isArray(item.recoveryNotes)) {
          notes = item.recoveryNotes;
        } else if (item.recoveryNote) {
          notes = [item.recoveryNote];
        }

        if (notes.length === 0) return;

        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); 
          backdrop-filter: blur(4px); z-index: 999999; display: flex; 
          align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
        `;

        let cardsHtml = notes.map((recoveryNote, index) => {
          let turbine = '-';
          let report = '-';
          let serial = '-';
          let desc = recoveryNote;

          const turbineMatch = recoveryNote.match(/Türbin:\s*([^,]+)/);
          const reportMatch = recoveryNote.match(/Rapor:\s*([^,]+)/);
          const serialMatch = recoveryNote.match(/Seri No:\s*([^,]+)/);
          const descMatch = recoveryNote.match(/Açıklama:\s*(.+)$/);

          if (turbineMatch) turbine = turbineMatch[1].trim();
          if (reportMatch) report = reportMatch[1].trim();
          if (serialMatch) serial = serialMatch[1].trim();
          if (descMatch) desc = descMatch[1].trim();

          return `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px; display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="font-weight: 700; color: #14F195; font-size: 0.85rem;">Kayıt #${index + 1}</span>
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; font-size: 0.8rem;">
                <div>
                  <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Söküldüğü Türbin</span>
                  <span style="color: #FFF; font-weight: 700;">${turbine}</span>
                </div>
                <div>
                  <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Rapor No</span>
                  <span style="color: #F59E0B; font-weight: 700; font-family: monospace;">${report}</span>
                </div>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem;">Seri Numarası</span>
                <span style="color: #10B981; font-weight: bold; font-family: monospace; font-size: 0.85rem; background: rgba(16, 185, 129, 0.05); padding: 2px 6px; border-radius: 4px; border: 1px dashed rgba(16, 185, 129, 0.15);">${serial}</span>
              </div>
              <div>
                <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; margin-bottom: 0.2rem;">Açıklama / Gerekçe</span>
                <div style="background: rgba(0,0,0,0.2); padding: 0.5rem 0.75rem; border-radius: 6px; color: #E2E8F0; font-size: 0.85rem; line-height: 1.4;">
                  ${desc}
                </div>
              </div>
            </div>
          `;
        }).join('');

        modal.innerHTML = `
          <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 520px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.2s; display: flex; flex-direction: column; max-height: 80vh;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem; margin-bottom: 1.25rem;">
              <h3 style="font-size: 1.25rem; font-weight: 700; color: #60A5FA; margin: 0; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-circle-info" style="margin-right: 8px;"></i> Malzeme Geri Kazanım Geçmişi
              </h3>
              <i class="fa-solid fa-xmark" id="btn-close-recovery-modal" style="cursor: pointer; color: #64748B; font-size: 1.1rem;"></i>
            </div>
            
            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 1.25rem; padding-right: 4px; margin-bottom: 1.5rem;">
              ${cardsHtml}
            </div>

            <div style="display: flex; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
              <button id="btn-close-recovery-ok" style="background: #3B82F6; color: #FFF; border: none; padding: 0.5rem 1.5rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 700; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#2563EB';" onmouseout="this.style.backgroundColor='#3B82F6';">
                Anlaşıldı
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => {
          modal.style.opacity = '1';
          (modal.firstElementChild as HTMLElement).style.transform = 'scale(1)';
        }, 10);

        const closeModal = () => {
          modal.style.opacity = '0';
          (modal.firstElementChild as HTMLElement).style.transform = 'scale(0.95)';
          setTimeout(() => modal.remove(), 200);
        };

        document.getElementById('btn-close-recovery-modal')?.addEventListener('click', closeModal);
        document.getElementById('btn-close-recovery-ok')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });
     };

     (window as any).returnDefectToInventory = async (itemId: string, sapNo: string, name: string, initialSerial: string = '', turbineNo: string = '', reportId: string = '') => {
        const modal = document.createElement('div');
        modal.style.cssText = `
          position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.6); 
          backdrop-filter: blur(4px); z-index: 999999; display: flex; 
          align-items: center; justify-content: center; opacity: 0; transition: opacity 0.2s;
        `;
        modal.innerHTML = `
          <div onclick="event.stopPropagation()" onmousedown="event.stopPropagation()" onmouseup="event.stopPropagation()" onkeydown="event.stopPropagation()" onkeyup="event.stopPropagation()" oninput="event.stopPropagation()" style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.2s;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin-top: 0; margin-bottom: 1rem; font-family: 'Rajdhani', sans-serif;">
              <i class="fa-solid fa-reply-all" style="margin-right: 8px;"></i> Stoğa Geri Kazanım
            </h3>
            <p style="color: #E2E8F0; font-size: 0.9rem; line-height: 1.5; margin-bottom: 1.25rem;">
              <strong>"${name}"</strong> sökülen (defect) malzemesinin sağlam olduğu anlaşıldı. Lütfen detayları girip geri alım durumunu seçin:
            </p>
            
            <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
              ${turbineNo || reportId ? `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem;">
                <div>
                  <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Türbin</span>
                  <span style="color: #FFF; font-weight: 700;">${turbineNo || '-'}</span>
                </div>
                <div>
                  <span style="color: #64748B; display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">Rapor</span>
                  <span style="color: #F59E0B; font-weight: 700; font-family: monospace;">${reportId || '-'}</span>
                </div>
              </div>
              ` : ''}
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 0.75rem;">
                <div>
                  <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase;">SAP No</label>
                  <input id="return-sap-input" type="text" value="${sapNo}" placeholder="SAP No" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; font-family: monospace; outline: none;">
                </div>
                <div>
                  <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase;">Malzeme Adı / Versiyon</label>
                  <input id="return-name-input" type="text" value="${name}" placeholder="Malzeme Adı" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase;">Malzeme Seri No (İsteğe Bağlı)</label>
                <input id="return-serial-input" type="text" value="${initialSerial && initialSerial !== '-' ? initialSerial : ''}" placeholder="Seri numarası girin (varsa)" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; font-family: monospace; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.35rem; font-weight: 600; text-transform: uppercase;">Gerekçe Açıklaması</label>
                <textarea id="return-desc-input" rows="3" style="width: 100%; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0.5rem 0.75rem; font-size: 0.85rem; outline: none; resize: none; line-height: 1.4;">Sıfır kart takıldı, çıkan kartın sağlam olduğu tespit edildi. Arıza farklı malzemeden çıktığı için stoğa geri alıyorum.</textarea>
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem;">
              <button id="btn-return-revised" style="height: 42px; background: linear-gradient(135deg, #3B82F6 0%, #2563EB 100%); color: #FFF; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem;">
                <i class="fa-solid fa-wrench" style="margin-right: 6px;"></i> REVİZE (Kullanılabilir/İkinci El) Olarak Al
              </button>
              <button id="btn-return-new" style="height: 42px; background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 700; border: none; border-radius: 8px; cursor: pointer; transition: all 0.2s; font-size: 0.9rem;">
                <i class="fa-solid fa-box" style="margin-right: 6px;"></i> SIFIR (Yeni/Kullanılmamış) Olarak Al
              </button>
            </div>
            <div style="display: flex; justify-content: flex-end;">
              <button id="btn-return-cancel" style="background: none; border: 1px solid #334155; color: #94A3B8; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; font-weight: 600; transition: all 0.2s;">
                İptal Et
              </button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        setTimeout(() => {
          modal.style.opacity = '1';
          (modal.firstElementChild as HTMLElement).style.transform = 'scale(1)';
        }, 10);

        const closeModal = () => {
          modal.style.opacity = '0';
          (modal.firstElementChild as HTMLElement).style.transform = 'scale(0.95)';
          setTimeout(() => modal.remove(), 200);
        };

        const handleReturn = async (cond: 'NEW' | 'REVISED') => {
          try {
            const btnRevised = document.getElementById('btn-return-revised') as HTMLButtonElement;
            const btnNew = document.getElementById('btn-return-new') as HTMLButtonElement;
            const btnCancel = document.getElementById('btn-return-cancel') as HTMLButtonElement;
            
            const sapInput = document.getElementById('return-sap-input') as HTMLInputElement;
            const nameInput = document.getElementById('return-name-input') as HTMLInputElement;
            const serialInput = document.getElementById('return-serial-input') as HTMLInputElement;
            const descInput = document.getElementById('return-desc-input') as HTMLTextAreaElement;
            
            const enteredSap = sapInput ? sapInput.value.trim() : sapNo;
            const enteredName = nameInput ? nameInput.value.trim() : name;
            const enteredSerial = serialInput ? serialInput.value.trim() : '';
            const enteredDesc = descInput ? descInput.value.trim() : '';

            if (!enteredSap) {
              alert('Lütfen geçerli bir SAP Numarası girin.');
              return;
            }
            if (!enteredName) {
              alert('Lütfen geçerli bir Malzeme Adı girin.');
              return;
            }

            if (btnRevised) btnRevised.disabled = true;
            if (btnNew) btnNew.disabled = true;
            if (btnCancel) btnCancel.disabled = true;

            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            const email = currentUser.email || 'Sistem';

            const finalRecoveryNote = `Türbin: ${turbineNo || '-'}, Rapor: ${reportId || '-'}, Seri No: ${enteredSerial || '-'}, Açıklama: ${enteredDesc}`;

            await warehouseService.returnDefectToInventory(currentWarehouse.id, itemId, cond, email, enteredSerial, finalRecoveryNote, enteredSap, enteredName);
            closeModal();
            
            if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
            }
          } catch (err) {
            console.error(err);
            alert('Geri alım işlemi sırasında hata oluştu.');
            closeModal();
          }
        };

        document.getElementById('btn-return-revised')?.addEventListener('click', () => handleReturn('REVISED'));
        document.getElementById('btn-return-new')?.addEventListener('click', () => handleReturn('NEW'));
        document.getElementById('btn-return-cancel')?.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
          if (e.target === modal) closeModal();
        });
        
        // Auto dictionary lookup on SAP input change
        const sapInput = document.getElementById('return-sap-input') as HTMLInputElement;
        const nameInput = document.getElementById('return-name-input') as HTMLInputElement;
        if (sapInput && nameInput) {
          sapInput.addEventListener('input', () => {
            const val = sapInput.value.trim();
            if (val.length >= 4) {
              const match = inventoryService.getMaterialBySap(val);
              if (match && match.d) {
                nameInput.value = match.d;
              }
            }
          });
        }
     };

    (window as any).printSingleQRFromModal = async () => {
       const item = (window as any)._currentBigQRItem;
       if (!item) return;
       const { qrService } = await import('../services/QRService');
       
       const qrText = JSON.stringify({ id: item.id, sapNo: item.sapNo, warehouseId: item.warehouseId });
       const dataUrl = await qrService.generateDataURL(qrText);
       
       const printWindow = window.open('', '_blank');
       if (!printWindow) return;
       
       const sapLabel = `SAP: ${item.sapNo}`;
       const descLabel = (item.description || '').toLocaleUpperCase('tr-TR');
       const boxIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#000000" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-top:-2px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;
       
       printWindow.document.write(`
         <html>
           <head>
             <title>Malzeme Barkodu - ${item.sapNo}</title>
             <style>
               @page { size: 99.1mm 38.1mm; margin: 0; }
               @media print {
                   body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
               }
               body {
                 margin: 0;
                 padding: 0;
                 font-family: 'Inter', system-ui, sans-serif;
                 background: white;
                 display: flex;
                 align-items: center;
                 justify-content: center;
                 height: 100vh;
                 width: 100vw;
                 box-sizing: border-box;
               }
               .label-box {
                 width: 99.1mm;
                 height: 38.1mm;
                 box-sizing: border-box;
                 padding: 4mm;
                 display: flex;
                 align-items: center;
                 justify-content: space-between;
                 overflow: hidden;
               }
               .details { 
                 flex: 1; 
                 min-width: 0; 
                 display: flex; 
                 flex-direction: column; 
                 justify-content: center; 
                 text-align: left;
                 padding-right: 3mm;
               }
               .sap { 
                 font-size: 14pt; 
                 font-weight: 900; 
                 color: #000; 
                 margin-bottom: 2mm; 
                 display: flex; 
                 align-items: center; 
                 gap: 6px; 
                 line-height: 1.1; 
               }
               .desc { 
                 font-size: 9pt; 
                 font-weight: 700; 
                 color: #333; 
                 line-height: 1.2; 
                 width: 100%;
                 word-break: break-word;
                 display: -webkit-box; 
                 -webkit-line-clamp: 2; 
                 -webkit-box-orient: vertical; 
                 overflow: hidden; 
                 text-overflow: ellipsis; 
               }
               .qr-img { 
                 width: 30mm; 
                 height: 30mm; 
                 flex-shrink: 0; 
                 object-fit: contain; 
               }
             </style>
           </head>
           <body>
             <div class="label-box">
               <div class="details">
                 <div class="sap">
                   ${boxIcon}
                   <span>${sapLabel}</span>
                 </div>
                 <div class="desc">${descLabel}</div>
               </div>
               <img class="qr-img" src="${dataUrl}">
             </div>
             <script>
               window.onload = () => { 
                 setTimeout(() => {
                   window.print();
                   setTimeout(() => window.close(), 500);
                 }, 300);
               }
             </script>
           </body>
         </html>
       `);
       printWindow.document.close();
    };

    (window as any).showBigImage = (url: string, title: string) => {
       document.getElementById('big-image-img')!.setAttribute('src', url);
       document.getElementById('big-image-title')!.innerText = title;
       document.getElementById('big-image-modal')!.style.display = 'flex';
    };

    (window as any).triggerImageUpload = (itemId: string, sapNo: string) => {
         const input = document.getElementById('item-image-upload') as HTMLInputElement;
         if (input) {
             input.onchange = null; // reset
             input.onchange = async (e: any) => {
                 const file = e.target.files?.[0];
                 if (!file) return;
                 
                 const path = `inventory/${currentWarehouse.id}/${itemId}_${Date.now()}`;
                 
                 // OPTIMISTIC UI: Sadece DOM'daki ikonları güncelle (Veritabanı refresh yapmadan)
                 const localPreviewUrl = URL.createObjectURL(file);
                 const inventoryArray = (window as any).currentInventoryData || [];
                 const item = inventoryArray.find((i: any) => i.id === itemId);
                 
                 const safeName = item ? item.name.replace(/'/g, "") : '';
                 const safeNameForEdit = item ? item.name.replace(/'/g, '\\\'') : '';
                 
                 const imgBtn = document.getElementById(`img-btn-${itemId}`);
                 if (imgBtn) {
                     imgBtn.outerHTML = `<div id="img-btn-${itemId}" onclick="window.showBigImage('${localPreviewUrl}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt (Yükleniyor...)" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>`;
                 }
                 
                 const editBtn = document.getElementById(`edit-btn-${itemId}`);
                 if (editBtn && item) {
                     editBtn.setAttribute('onclick', `window.openEditModal('${item.id}', '${item.sapNo}', '${safeNameForEdit}', ${item.quantity}, '${item.shelfNo || ''}', '${localPreviewUrl}', ${item.minStock || 0})`);
                 }
                 if(input) input.value = '';

                 // Arkaplanda Sıkıştırma ve Yükleme (Kullanıcı beklemez)
            let compressedFilePromise;
            try {
                compressedFilePromise = ImageCompressor.compressImage(file, 800, 800, 0.7)
                    .catch((err) => {
                        console.warn("Sıkıştırma başarısız, orijinal dosya yükleniyor...", err);
                        return file;
                    });
            } catch(e) {
                compressedFilePromise = Promise.resolve(file);
            }
            
            compressedFilePromise
              .then((compressedFile: File) => {
                 // Timeout'suz saf arka plan yüklemesi (Firebase kendi yönetir)
                 return fileService.uploadImage(compressedFile, path);
              })
              .then((url: string) => warehouseService.updateMaterialImage(currentWarehouse.id, itemId, url, sapNo).then(() => url))
              .then((url: string) => {
                  console.log("Arkaplan yüklemesi başarıyla tamamlandı:", url);
              })
              .catch(err => {
                  console.error("Arkaplan yükleme hatası: ", err);
                  alert("Arka planda resim sunucuya yüklenirken bir hata oluştu. Lütfen yöneticinize şu hatayı iletin: " + (err.message || err));
              });
             };
             input.click();
         }
    };

    const modal = document.getElementById('add-new-modal');
    const sapInput = document.getElementById('new-sap-input') as HTMLInputElement;
    const nameInput = document.getElementById('new-name-input') as HTMLInputElement;
    const quantityInput = document.getElementById('new-qty-input') as HTMLInputElement;
    const unitInput = document.getElementById('new-unit-input') as HTMLInputElement;
    const locationInput = document.getElementById('new-loc-input') as HTMLInputElement;

    (window as any).openAddNewModal = () => {
      if(modal) modal.style.display = 'flex';
      
      // Clear log inputs
      const sourceInput = document.getElementById('new-source-input') as HTMLInputElement;
      if (sourceInput) sourceInput.value = '';
      const deliveryInput = document.getElementById('new-delivery-input') as HTMLInputElement;
      if (deliveryInput) deliveryInput.value = '';
      const invoiceInput = document.getElementById('new-invoice-input') as HTMLInputElement;
      if (invoiceInput) invoiceInput.value = '';
      const noteInput = document.getElementById('new-entry-note-input') as HTMLInputElement;
      if (noteInput) noteInput.value = '';
      
      const userProfile = getUserProfile();
      const user = userProfile ? userProfile.displayName || userProfile.email : '';
      const updatedByInput = document.getElementById('new-updatedby-input') as HTMLInputElement;
      if (updatedByInput) updatedByInput.value = user;

      setTimeout(() => sapInput?.focus(), 100);
    };

    (window as any).closeAddNewModal = () => {
      if(modal) modal.style.display = 'none';
      if(sapInput) sapInput.value = '';
      if(nameInput) nameInput.value = '';
      if(quantityInput) quantityInput.value = '';
      if(locationInput) locationInput.value = '';
      const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
      if (imgInput) imgInput.value = '';
      const imgLabel = document.getElementById('new-img-label');
      if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
      // Soft-reload UI to show new items
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
      }
    };

    let sapTimeout: any;
    if(sapInput) {
      sapInput.addEventListener('input', (e) => {
        clearTimeout(sapTimeout);
        const val = (e.target as HTMLInputElement).value;
        if(val.length > 0) {
          nameInput.value = 'Aranıyor...';
          sapTimeout = setTimeout(async () => {
            try {
              const res = await warehouseAgent.resolveSapNumber(val);
              if (res.found) {
                nameInput.value = res.name || '';
              } else {
                nameInput.value = 'Sözlükte bulunamadı. Manuel giriniz.';
              }
            } catch(err) {
              nameInput.value = 'Hata oluştu';
            }
          }, 400); // 400ms debounce
        } else {
          nameInput.value = '';
        }
      });
    }

    (window as any).saveNewItem = async (btn: HTMLButtonElement) => {
      if(!sapInput.value || !nameInput.value || !quantityInput.value) {
        alert('Lütfen zorunlu alanları doldurun!');
        return;
      }
      
      const existingSap = inventoryItems.find(i => i.sapNo === sapInput.value && i.condition !== 'DEFECT');
      if (existingSap) {
        alert(`Hata: Bu SAP numarası depoda zaten kayıtlı! Lütfen yeni malzeme eklemek yerine mevcut "${existingSap.name || existingSap.description || ''}" malzemesini güncellerin.`);
        return;
      }

      const originalText = btn.innerText;
      btn.innerText = 'Kaydediliyor...';
      btn.disabled = true;

      try {
        const imgInput = document.getElementById('new-img-input') as HTMLInputElement;
        const inputNameValue = nameInput.value;

        const sourceVal = (document.getElementById('new-source-input') as HTMLInputElement)?.value.trim() || '';
        const deliveryVal = (document.getElementById('new-delivery-input') as HTMLInputElement)?.value.trim() || '';
        const invoiceVal = (document.getElementById('new-invoice-input') as HTMLInputElement)?.value.trim() || '';
        const updatedByVal = (document.getElementById('new-updatedby-input') as HTMLInputElement)?.value.trim() || '';
        const entryNoteVal = (document.getElementById('new-entry-note-input') as HTMLInputElement)?.value.trim() || '';
        
        const logDetails = {
          sourceWh: sourceVal || '-',
          deliveryNote: deliveryVal || '-',
          invoiceNo: invoiceVal || '-',
          updatedBy: updatedByVal || 'Sistem',
          entryNote: entryNoteVal || ''
        };

        const result = await warehouseService.addMaterial(currentWarehouse.id, {
          sapNo: sapInput.value,
          description: nameInput.value,
          quantity: parseInt(quantityInput.value),
          unit: unitInput.value || 'Adet',
          shelfNo: locationInput.value || 'GİRİLMEMİŞ',
          condition: 'NEW',
          criticalLimit: 0,
          imageUrl: '', // Initial empty
          notes: ''
        } as any, logDetails); // Type assertion until models are fully unified
        
        // Background fire and forget for image upload
        if (imgInput && imgInput.files && imgInput.files.length > 0) {
          const file = imgInput.files[0];
          const path = `materials/${sapInput.value}_${Date.now()}_${file.name}`;
          
          if (ImageCompressor) {
              ImageCompressor.compressImage(file, 800, 800, 0.7).then((compressedFile: File) => {
                  fileService.uploadImage(compressedFile, path).then(url => {
                    warehouseService.updateMaterialImage(currentWarehouse.id, result.id, url, sapInput.value).then(() => {
                      const cell = document.getElementById(`img-cell-${result.id}`);
                      if (cell) {
                        const safeName = inputNameValue.replace(/'/g, "");
                        cell.innerHTML = `<div onclick="window.showBigImage('${url}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>${inputNameValue}`;
                      }
                    });
                  }).catch(err => console.error('Arkaplan görsel yükleme hatası:', err))
                    .finally(() => {
                        imgInput.value = '';
                    });
              });
          } else {
              imgInput.value = '';
          }
        }
        
        // Reset form for next entry
        sapInput.value = '';
        nameInput.value = '';
        quantityInput.value = '';
        locationInput.value = '';
        if (imgInput) imgInput.value = '';
        const imgLabel = document.getElementById('new-img-label');
        if (imgLabel) { imgLabel.innerText = 'Görsel Yükle'; imgLabel.style.color = '#94A3B8'; }
        sapInput.focus();
        
        btn.innerText = 'Başarıyla Eklendi!';
        btn.style.backgroundColor = '#10B981'; // Success green
        
        setTimeout(() => {
          btn.innerText = originalText;
          btn.style.backgroundColor = '#14F195'; // Original green
          btn.disabled = false;
        }, 1500);

      } catch (err) {
        console.error(err);
        alert('Eklenirken hata oluştu.');
        btn.innerText = originalText;
        btn.disabled = false;
      }
    };

    (window as any).deleteItem = async (itemId: string, name: string) => {
      if(confirm(`"${name}" malzemesini silmek istediğinize emin misiniz?`)) {
        await warehouseService.deleteMaterial(currentWarehouse.id, itemId);
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      }
    };

    (window as any).deleteAnalyticsReport = async (reportDocId: string, reportNo: string) => {
      if (confirm(`"${reportNo}" numaralı saha servis raporunu silmek istediğinize emin misiniz? Bu işlem bu rapora bağlı tüm tüketimleri silecektir.`)) {
        try {
          const { serviceReportService } = await import('../services/ServiceReportService');
          await serviceReportService.deleteReport(reportDocId);
          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (error: any) {
          console.error("Rapor silme hatası:", error);
          alert("Rapor silinirken bir hata oluştu: " + error.message);
        }
      }
    };
    
    (window as any).compressImage = (file: File, maxWidth: number, maxHeight: number, quality: number): Promise<File> => {
      return new Promise((resolve) => {
        // file.type kontrolünü kaldırdık çünkü mobilde bazen type boş ("") gelebiliyor.
        
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        
        img.onerror = () => {
           URL.revokeObjectURL(objectUrl);
           resolve(file);
        };
        
        img.onload = () => {
            URL.revokeObjectURL(objectUrl);
            const canvas = document.createElement('canvas');
            let width = img.width;
            let height = img.height;

            if (width > height) {
              if (width > maxWidth) {
                height *= maxWidth / width;
                width = maxWidth;
              }
            } else {
              if (height > maxHeight) {
                width *= maxHeight / height;
                height = maxHeight;
              }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if(ctx) ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob((blob) => {
              if (blob) {
                resolve(new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() }));
              } else {
                resolve(file); // fallback
              }
            }, 'image/jpeg', quality);
          };
          img.src = objectUrl;
      });
    };

    (window as any).openEditModal = (id: string, sap: string, name: string, qty: number, loc: string, imageUrl?: string, minStock?: number) => {
       const modal = document.getElementById('new-warehouse-edit-modal');
       if(modal) {
         (document.getElementById('edit-item-id') as HTMLInputElement).value = id;
         (document.getElementById('edit-sap-input') as HTMLInputElement).value = sap;
         (document.getElementById('edit-name-input') as HTMLInputElement).value = name;
         (document.getElementById('edit-qty-input') as HTMLInputElement).value = qty.toString();
         (document.getElementById('edit-loc-input') as HTMLInputElement).value = loc || '';
         
         const oldQtyInput = document.getElementById('edit-old-qty-input') as HTMLInputElement;
         if (oldQtyInput) oldQtyInput.value = qty.toString();

         // Reset stock entry details inputs
         const sourceInput = document.getElementById('edit-source-input') as HTMLInputElement;
         if (sourceInput) sourceInput.value = '';
         const deliveryInput = document.getElementById('edit-delivery-input') as HTMLInputElement;
         if (deliveryInput) deliveryInput.value = '';
         const invoiceInput = document.getElementById('edit-invoice-input') as HTMLInputElement;
         if (invoiceInput) invoiceInput.value = '';
         const noteInput = document.getElementById('edit-entry-note-input') as HTMLInputElement;
         if (noteInput) noteInput.value = '';
         
         const userProfile = getUserProfile();
         const user = userProfile ? userProfile.displayName || userProfile.email : '';
         const updatedByInput = document.getElementById('edit-updatedby-input') as HTMLInputElement;
         if (updatedByInput) updatedByInput.value = user;

         const detailsDiv = document.getElementById('edit-stock-entry-details');
         if (detailsDiv) detailsDiv.style.display = 'none';

         // Set listener on qty input to dynamically show/hide entry details
         const qtyInput = document.getElementById('edit-qty-input') as HTMLInputElement;
         if (qtyInput) {
             qtyInput.oninput = (e: any) => {
                 const newQty = parseInt(e.target.value) || 0;
                 if (detailsDiv) {
                     if (newQty > qty) {
                         detailsDiv.style.display = 'flex';
                     } else {
                         detailsDiv.style.display = 'none';
                     }
                 }
             };
         }
         
         const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
         if (minStockInput) minStockInput.value = minStock !== undefined ? minStock.toString() : '0';
         
         const imgPreview = document.getElementById('edit-img-preview') as HTMLImageElement;
         if (imgPreview) {
             if (imageUrl && imageUrl !== 'undefined' && imageUrl !== 'null') {
                 imgPreview.src = imageUrl;
                 imgPreview.style.display = 'block';
             } else {
                 imgPreview.src = '';
                 imgPreview.style.display = 'none';
             }
         }
         
         const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
         if (imgInput) imgInput.value = '';
         
         modal.style.display = 'flex';
       }
    };
    
    (window as any).closeEditModal = () => {
       const modal = document.getElementById('new-warehouse-edit-modal');
       if(modal) modal.style.display = 'none';
    };
    
    (window as any).saveEditItem = async (btn: HTMLButtonElement) => {
       const id = (document.getElementById('edit-item-id') as HTMLInputElement).value;
       const sap = (document.getElementById('edit-sap-input') as HTMLInputElement).value;
       const name = (document.getElementById('edit-name-input') as HTMLInputElement).value;
       const qty = parseInt((document.getElementById('edit-qty-input') as HTMLInputElement).value);
       const loc = (document.getElementById('edit-loc-input') as HTMLInputElement).value;
       const minStockInput = document.getElementById('edit-min-stock-input') as HTMLInputElement;
       const minStock = minStockInput && minStockInput.value ? parseInt(minStockInput.value) : 0;
       
       const oldQty = parseInt((document.getElementById('edit-old-qty-input') as HTMLInputElement).value) || 0;
       
       let logDetails: any = undefined;
       if (qty > oldQty) {
           const source = (document.getElementById('edit-source-input') as HTMLInputElement).value.trim();
           const delivery = (document.getElementById('edit-delivery-input') as HTMLInputElement).value.trim();
           const invoice = (document.getElementById('edit-invoice-input') as HTMLInputElement).value.trim();
           const updatedBy = (document.getElementById('edit-updatedby-input') as HTMLInputElement).value.trim();
           const entryNote = (document.getElementById('edit-entry-note-input') as HTMLInputElement).value.trim();
           
           logDetails = {
               sourceWh: source || '-',
               deliveryNote: delivery || '-',
               invoiceNo: invoice || '-',
               updatedBy: updatedBy
           };
       }
       
       const originalText = btn.innerText;
       btn.innerText = 'Kaydediliyor...';
       btn.disabled = true;
       
       try {
         await warehouseService.updateMaterial(currentWarehouse.id, id, {
           sapNo: sap, description: name, quantity: qty, shelfNo: loc, criticalLimit: minStock || 0
         } as any, logDetails);

         const imgInput = document.getElementById('edit-img-input') as HTMLInputElement;
         const path = `inventory/${currentWarehouse.id}/${id}_${Date.now()}`;
         if (imgInput && imgInput.files && imgInput.files.length > 0) {
            const file = imgInput.files[0];
            try {
                const localPreviewUrl = URL.createObjectURL(file);
                const inventoryArray = (window as any).currentInventoryData || [];
                const item = inventoryArray.find((i: any) => i.id === id);
                if (item) {
                    item.imageUrl = localPreviewUrl;
                }

                (window as any).closeEditModal();
                
                const safeName = name.replace(/'/g, "");
                const safeNameForEdit = name.replace(/'/g, '\\\'');
                
                const imgBtn = document.getElementById(`img-btn-${id}`);
                if (imgBtn) {
                    imgBtn.outerHTML = `<div id="img-btn-${id}" onclick="window.showBigImage('${localPreviewUrl}', '${safeName}')" style="width:36px; height:36px; border-radius:6px; background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s;" title="Görseli Büyüt (Yükleniyor...)" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'"><i class="fa-solid fa-image"></i></div>`;
                }
                
                const editBtn = document.getElementById(`edit-btn-${id}`);
                if (editBtn) {
                    const qty = (document.getElementById('edit-qty-input') as HTMLInputElement).value;
                    const loc = (document.getElementById('edit-loc-input') as HTMLInputElement).value;
                    const minSt = (document.getElementById('edit-min-stock-input') as HTMLInputElement)?.value || 0;
                    editBtn.setAttribute('onclick', `window.openEditModal('${id}', '${sap}', '${safeNameForEdit}', ${qty}, '${loc}', '${localPreviewUrl}', ${minSt})`);
                }

                let compressedFile: File;
                try {
                    compressedFile = await ImageCompressor.compressImage(file, 800, 800, 0.7);
                } catch (compressionErr) {
                    console.warn("Sıkıştırma başarısız, orijinal dosya yükleniyor...", compressionErr);
                    compressedFile = file;
                }
                
                const url = await fileService.uploadImage(compressedFile, path);
                await warehouseService.updateMaterialImage(currentWarehouse.id, id, url as string, sap);
                console.log('Arkaplan görsel güncellemesi tamamlandı.');
                
            } catch (err: any) {
                console.error('Görsel yükleme hatası (Arkaplan):', err);
            } finally {
                imgInput.value = '';
            }
          } else {
             (window as any).closeEditModal();
             if ((window as any).selectWarehouseAndNavigate) {
               (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
             }
          }

        } catch(e) { console.error(e); alert('Hata oluştu'); }
        finally { btn.innerText = originalText; btn.disabled = false; }
    };
    
    (window as any).deleteEditImage = async () => {
         const id = (document.getElementById('edit-item-id') as HTMLInputElement).value;
         if (!id) return;
         if (!confirm("Görseli silmek istediğinize emin misiniz?")) return;
         
         const imgPreview = document.getElementById('edit-img-preview') as HTMLImageElement;
         if (imgPreview) imgPreview.style.display = 'none';
         
         const inventoryArray = (window as any).currentInventoryData || [];
         const item = inventoryArray.find((i: any) => i.id === id);
         if (item) {
             item.imageUrl = null;
         }
         
         try {
             await warehouseService.updateMaterialImage(currentWarehouse.id, id, '', item ? item.sapNo : '');
             
             const safeName = item ? item.name.replace(/'/g, "") : '';
             const safeNameForEdit = item ? item.name.replace(/'/g, '\\\'') : '';
             
             const imgBtn = document.getElementById(`img-btn-${id}`);
             if (imgBtn) {
                 imgBtn.outerHTML = `<div id="img-btn-${id}" onclick="window.triggerImageUpload('${id}', '${item ? item.sapNo : ''}')" style="width:36px; height:36px; border-radius:6px; background-color: #1E293B; margin-right:12px; display:flex; align-items:center; justify-content:center; color:#64748B; cursor: pointer; transition: all 0.2s;" title="Görsel Ekle" onmouseover="this.style.backgroundColor='#334155'" onmouseout="this.style.backgroundColor='#1E293B'"><i class="fa-solid fa-image"></i></div>`;
             }
             
             const editBtn = document.getElementById(`edit-btn-${id}`);
             if (editBtn && item) {
                 editBtn.setAttribute('onclick', `window.openEditModal('${item.id}', '${item.sapNo}', '${safeNameForEdit}', ${item.quantity}, '${item.shelfNo || ''}', '', ${item.minStock || 0})`);
             }
             
             alert("Görsel başarıyla silindi!");
         } catch(e: any) {
             alert("Silinirken hata oluştu: " + e.message);
         }
     };

     (window as any).openMtaEditModal = (id: string, sap: string, name: string, serial: string, note: string, loc: string, qty: number) => {
        const modal = document.getElementById('new-warehouse-mta-edit-modal');
        if (modal) {
          (document.getElementById('mta-edit-item-id') as HTMLInputElement).value = id;
          const nameText = document.getElementById('mta-edit-name-text');
          if (nameText) nameText.innerText = name;
          const sapText = document.getElementById('mta-edit-sap-text');
          if (sapText) sapText.innerText = sap;
          (document.getElementById('mta-edit-qty-input') as HTMLInputElement).value = qty !== undefined ? qty.toString() : '0';
          (document.getElementById('mta-edit-serial-input') as HTMLInputElement).value = (serial === 'undefined' || serial === 'null') ? '' : serial;
          (document.getElementById('mta-edit-note-input') as HTMLTextAreaElement).value = (note === 'undefined' || note === 'null') ? '' : note;
          (document.getElementById('mta-edit-loc-input') as HTMLInputElement).value = (loc === 'undefined' || loc === 'null') ? '' : loc;
          modal.style.display = 'flex';
        }
     };
     
     (window as any).closeMtaEditModal = () => {
        const modal = document.getElementById('new-warehouse-mta-edit-modal');
        if (modal) modal.style.display = 'none';
     };
     
     (window as any).saveMtaEditItem = async (btn: HTMLButtonElement) => {
        const id = (document.getElementById('mta-edit-item-id') as HTMLInputElement).value;
        const qty = parseInt((document.getElementById('mta-edit-qty-input') as HTMLInputElement).value) || 0;
        const serial = (document.getElementById('mta-edit-serial-input') as HTMLInputElement).value.trim();
        const note = (document.getElementById('mta-edit-note-input') as HTMLTextAreaElement).value.trim();
        const loc = (document.getElementById('mta-edit-loc-input') as HTMLInputElement).value.trim();
        
        const originalText = btn.innerText;
        btn.innerText = 'Kaydediliyor...';
        btn.disabled = true;
        
        try {
          await warehouseService.updateMaterial(currentWarehouse.id, id, {
            quantity: qty,
            serialNo: serial,
            note: note,
            shelfNo: loc
          });
          
          (window as any).closeMtaEditModal();
          
          (window as any).showToast('Başarılı', 'Malzeme bilgileri başarıyla güncellendi.', 'success');
          
          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (err: any) {
          console.error('Error saving W11 details:', err);
          alert('Kaydedilemedi: ' + err.message);
          btn.innerText = originalText;
          btn.disabled = false;
        }
      };

     (window as any).openDefectEditModal = (id: string, sap: string, name: string, serial: string, reportDocId: string = '') => {
        const modal = document.getElementById('new-warehouse-defect-edit-modal');
        if (modal) {
          (document.getElementById('defect-edit-item-id') as HTMLInputElement).value = id;
          const reportDocIdInput = document.getElementById('defect-edit-report-doc-id') as HTMLInputElement;
          if (reportDocIdInput) reportDocIdInput.value = reportDocId;
          const nameText = document.getElementById('defect-edit-name-text');
          if (nameText) nameText.innerText = name;
          const sapText = document.getElementById('defect-edit-sap-text');
          if (sapText) sapText.innerText = sap;
          (document.getElementById('defect-edit-serial-input') as HTMLInputElement).value = (serial === 'undefined' || serial === 'null' || serial === '-') ? '' : serial;
          modal.style.display = 'flex';
        }
     };

     (window as any).closeDefectEditModal = () => {
        const modal = document.getElementById('new-warehouse-defect-edit-modal');
        if (modal) modal.style.display = 'none';
     };

     (window as any).saveDefectEditItem = async (btn: HTMLButtonElement) => {
        const id = (document.getElementById('defect-edit-item-id') as HTMLInputElement).value;
        const serial = (document.getElementById('defect-edit-serial-input') as HTMLInputElement).value.trim();
        const reportDocId = (document.getElementById('defect-edit-report-doc-id') as HTMLInputElement)?.value || '';
        const sapTextEl = document.getElementById('defect-edit-sap-text');
        const sapNo = sapTextEl ? sapTextEl.innerText.trim() : '';

        const originalText = btn.innerText;
        btn.innerText = 'Kaydediliyor...';
        btn.disabled = true;

        try {
          await warehouseService.updateMaterial(currentWarehouse.id, id, {
            serialNo: serial
          });

          if (reportDocId && sapNo) {
            try {
              const { doc, getDoc, updateDoc } = await import('firebase/firestore');
              const reportRef = doc(db, 'serviceReports', reportDocId);
              const snap = await getDoc(reportRef);
              if (snap.exists()) {
                const data = snap.data();
                const materials = data.materials || [];
                let updated = false;
                for (const mat of materials) {
                  if (String(mat.sapNo).trim() === String(sapNo).trim() && mat.defectCount > 0) {
                    mat.serialNo = serial;
                    updated = true;
                    break;
                  }
                }
                if (updated) {
                  await updateDoc(reportRef, { materials });
                }
              }
            } catch (reportErr) {
              console.error('Failed to sync report material serial:', reportErr);
            }
          }

          (window as any).closeDefectEditModal();

          (window as any).showToast('Başarılı', 'Seri numarası başarıyla güncellendi.', 'success');

          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (err: any) {
          console.error('Error saving defect serial details:', err);
          alert('Kaydedilemedi: ' + err.message);
          btn.innerText = originalText;
          btn.disabled = false;
        }
     };

     (window as any).editAnalizSerial = async (reportDocId: string, sapNo: string, isDefect: boolean, currentSerial: string) => {
        const newSerial = prompt("Lütfen bu malzeme için yeni seri numarasını girin:", currentSerial);
        if (newSerial === null) return;
        const trimmed = newSerial.trim();

        try {
          const { doc, getDoc, updateDoc } = await import('firebase/firestore');

          const reportRef = doc(db, 'serviceReports', reportDocId);
          const snap = await getDoc(reportRef);
          if (!snap.exists()) {
             alert("Rapor kaydı bulunamadı.");
             return;
          }

          const data = snap.data();
          const materials = data.materials || [];
          let updated = false;
          for (const mat of materials) {
            const matchesSap = String(mat.sapNo).trim() === String(sapNo).trim();
            const isCorrectType = isDefect ? (mat.defectCount > 0) : (mat.used > 0);
            if (matchesSap && isCorrectType) {
              mat.serialNo = trimmed;
              updated = true;
              break;
            }
          }

          if (updated) {
            await updateDoc(reportRef, { materials });
          } else {
             alert("Raporda eşleşen malzeme satırı bulunamadı.");
             return;
          }

          if (isDefect) {
            try {
              const { getDocs, collection, query, where, updateDoc: updateDocInventory } = await import('firebase/firestore');
              const colRef = collection(db, 'warehouses', currentWarehouse.id, 'inventory_v2');
              const q = query(colRef, where('sapNo', '==', sapNo), where('condition', '==', 'DEFECT'));
              const snapshot = await getDocs(q);
              if (!snapshot.empty) {
                for (const dDoc of snapshot.docs) {
                  await updateDocInventory(dDoc.ref, { serialNo: trimmed });
                }
              }
            } catch (invErr) {
              console.error("Failed to sync defect inventory item serial:", invErr);
            }
          }

          (window as any).showToast('Başarılı', 'Seri numarası başarıyla güncellendi.', 'success');

          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (err: any) {
          console.error("Failed to edit analiz serial:", err);
          alert("Güncelleme sırasında hata oluştu: " + err.message);
        }
     };

     (window as any).toggleAllDefects = (master: HTMLInputElement) => {
        const checkboxes = document.querySelectorAll('.defect-row-checkbox') as NodeListOf<HTMLInputElement>;
        checkboxes.forEach(cb => {
          cb.checked = master.checked;
        });
     };

     (window as any).bulkSendToRepair = () => {
        const checked = Array.from(document.querySelectorAll('.defect-row-checkbox:checked')) as HTMLInputElement[];
        if (checked.length === 0) {
          (window as any).showToast('Uyarı', 'Lütfen tamire sevk etmek istediğiniz malzemeleri seçin.', 'warning');
          return;
        }

        const items = checked.map(cb => ({
          id: cb.getAttribute('data-id')!,
          sapNo: cb.getAttribute('data-sap')!,
          description: cb.getAttribute('data-name')!,
          quantity: parseInt(cb.getAttribute('data-qty')!),
          serialNo: cb.getAttribute('data-serial')!,
          faultCode: cb.getAttribute('data-faultcode')!,
          faultDesc: cb.getAttribute('data-faultdesc')!
        }));

        (window as any).openBulkSendToRepairModal(items);
     };

     (window as any).bulkScrap = () => {
        const checked = Array.from(document.querySelectorAll('.defect-row-checkbox:checked')) as HTMLInputElement[];
        if (checked.length === 0) {
          (window as any).showToast('Uyarı', 'Lütfen hurdaya ayırmak istediğiniz malzemeleri seçin.', 'warning');
          return;
        }

        const items = checked.map(cb => ({
          id: cb.getAttribute('data-id')!,
          sapNo: cb.getAttribute('data-sap')!,
          description: cb.getAttribute('data-name')!,
          quantity: parseInt(cb.getAttribute('data-qty')!)
        }));

        (window as any).openBulkScrapModal(items);
     };

     (window as any).openBulkSendToRepairModal = (items: Array<{
        id: string;
        sapNo: string;
        description: string;
        quantity: number;
        serialNo: string;
        faultCode: string;
        faultDesc: string;
     }>) => {
        const modal = document.createElement('div');
        modal.id = 'bulk-send-repair-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
          background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
          z-index: 10002; display: flex; align-items: center; justify-content: center;
        `;

        const dispatchNo = `SV-${new Date().getFullYear()}${(new Date().getMonth()+1).toString().padStart(2,'0')}${new Date().getDate().toString().padStart(2,'0')}-${Math.floor(100 + Math.random() * 900)}`;

        let itemsRows = items.map((item, idx) => `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
            <span style="font-weight:700; color:#FFF; font-size:0.85rem;">${idx + 1}. ${item.description}</span>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
              <span>SAP: ${item.sapNo} | Seri: ${item.serialNo}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>Miktar:</span>
                <input type="number" class="bulk-qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="${item.quantity}" style="width:60px; height:26px; background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-size:0.8rem; outline:none;">
              </div>
            </div>
          </div>
        `).join('');

        modal.innerHTML = `
          <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
              <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
                <i class="fa-solid fa-screwdriver-wrench" style="margin-right:8px;"></i> TOPLU TAMİRE SEVK
              </h3>
              <button onclick="document.getElementById('bulk-send-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            
            <div style="margin-bottom:1.25rem; font-size:0.85rem; color:#E2E8F0; flex-shrink:0;">
              <strong>Sevk No (Otomatik):</strong> <span style="font-family:monospace; color:#14F195; font-weight:bold; font-size:0.95rem; margin-left:4px;">${dispatchNo}</span>
            </div>

            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
              <p style="color:#94A3B8; font-size:0.85rem; margin:0; font-weight:600;">Sevk Edilecek Malzemeler (${items.length} Kalem)</p>
              ${itemsRows}
            </div>

            <div class="form-group" style="margin-bottom:1.5rem; flex-shrink:0;">
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Tamir İstasyonu</label>
              <select id="bulk-send-repair-workshop" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
                <option value="Merkez Tamir Atölyesi">Merkez Tamir Atölyesi</option>
              </select>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; flex-shrink:0;">
              <button onclick="document.getElementById('bulk-send-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
              <button id="bulk-confirm-send-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">SEVK ET</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        const confirmBtn = document.getElementById('bulk-confirm-send-repair-btn');
        if (confirmBtn) {
          confirmBtn.onclick = async () => {
            const workshopSelect = document.getElementById('bulk-send-repair-workshop') as HTMLSelectElement;
            const qtyInputs = document.querySelectorAll('.bulk-qty-input') as NodeListOf<HTMLInputElement>;
            
            const itemsWithQty = items.map(item => {
              const input = Array.from(qtyInputs).find(inp => inp.getAttribute('data-id') === item.id);
              const qty = parseInt(input?.value || '0', 10);
              return { ...item, sendQty: qty };
            });

            for (const item of itemsWithQty) {
              if (isNaN(item.sendQty) || item.sendQty <= 0 || item.sendQty > item.quantity) {
                alert(`Lütfen "${item.description}" için 1 ile ${item.quantity} arasında geçerli bir miktar girin.`);
                return;
              }
            }

            confirmBtn.setAttribute('disabled', 'true');
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sevk Ediliyor...';

            try {
              const { repairService } = await import('../services/RepairService');
              const currentUser = (window as any).currentUser;
              const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

              for (const item of itemsWithQty) {
                await repairService.createRepair({
                  sapNo: item.sapNo,
                  serialNo: item.serialNo,
                  description: item.description,
                  quantity: item.sendQty,
                  sourceWarehouseId: currentWarehouse.id,
                  workshopId: workshopSelect.value,
                  sentBy: userEmail,
                  faultCode: item.faultCode,
                  faultDesc: item.faultDesc,
                  dispatchNo: dispatchNo
                } as any);

                await warehouseService.updateStockBySap(
                  currentWarehouse.id,
                  item.sapNo,
                  -item.sendQty,
                  {
                    user: userEmail,
                    reason: `Toplu sevk kapsamında tamir atölyesine gönderildi. Sevk No: ${dispatchNo}`
                  },
                  'DEFECT'
                );
              }

              (window as any).showToast('Başarılı', `Malzemeler ${dispatchNo} sevk numarası ile başarıyla sevk edildi.`, 'success');
              modal.remove();

              if ((window as any).selectWarehouseAndNavigate) {
                (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
              }
            } catch (e: any) {
              console.error(e);
              alert('Toplu sevk esnasında bir hata oluştu: ' + e.message);
              confirmBtn.removeAttribute('disabled');
              confirmBtn.innerHTML = 'SEVK ET';
            }
          };
        }
     };

     (window as any).openBulkScrapModal = (items: Array<{
        id: string;
        sapNo: string;
        description: string;
        quantity: number;
     }>) => {
        const modal = document.createElement('div');
        modal.id = 'bulk-scrap-modal';
        modal.className = 'modal-overlay';
        modal.style.cssText = `
          position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
          background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
          z-index: 10002; display: flex; align-items: center; justify-content: center;
        `;

        let itemsRows = items.map((item, idx) => `
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px; display:flex; flex-direction:column; gap:6px;">
            <span style="font-weight:700; color:#FFF; font-size:0.85rem;">${idx + 1}. ${item.description}</span>
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.75rem; color:#94A3B8;">
              <span>SAP: ${item.sapNo}</span>
              <div style="display:flex; align-items:center; gap:8px;">
                <span>Miktar:</span>
                <input type="number" class="bulk-scrap-qty-input" data-id="${item.id}" value="${item.quantity}" min="1" max="${item.quantity}" style="width:60px; height:26px; background:rgba(0,0,0,0.3); border:1px solid #1E293B; border-radius:4px; color:#FFF; text-align:center; font-size:0.8rem; outline:none;">
              </div>
            </div>
          </div>
        `).join('');

        modal.innerHTML = `
          <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem; flex-shrink:0;">
              <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px;">
                <i class="fa-solid fa-dumpster" style="margin-right:8px;"></i> TOPLU HURDAYA AYIR
              </h3>
              <button onclick="document.getElementById('bulk-scrap-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
              <p style="color:#94A3B8; font-size:0.85rem; margin:0; font-weight:600;">Hurdaya Ayrılacak Malzemeler (${items.length} Kalem)</p>
              ${itemsRows}
            </div>

            <div class="form-group" style="margin-bottom:1.5rem; flex-shrink:0;">
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Gerekçe / Hurda Notu</label>
              <textarea id="bulk-scrap-note" class="cyber-input" placeholder="Hurdaya ayrılma gerekçesini yazınız..." style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); height:80px; resize:none;" required></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; flex-shrink:0;">
              <button onclick="document.getElementById('bulk-scrap-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
              <button id="bulk-confirm-scrap-btn" class="btn-cyber" style="background:linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color:#FFF; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(239,68,68,0.3);">HURDAYA AYIR</button>
            </div>
          </div>
        `;

        document.body.appendChild(modal);

        const confirmBtn = document.getElementById('bulk-confirm-scrap-btn');
        if (confirmBtn) {
          confirmBtn.onclick = async () => {
            const noteInput = document.getElementById('bulk-scrap-note') as HTMLTextAreaElement;
            const note = noteInput?.value.trim() || '';
            const qtyInputs = document.querySelectorAll('.bulk-scrap-qty-input') as NodeListOf<HTMLInputElement>;

            if (!note) {
              alert('Lütfen hurdaya ayırma gerekçesini yazın.');
              return;
            }

            const itemsWithQty = items.map(item => {
              const input = Array.from(qtyInputs).find(inp => inp.getAttribute('data-id') === item.id);
              const qty = parseInt(input?.value || '0', 10);
              return { ...item, scrapQty: qty };
            });

            for (const item of itemsWithQty) {
              if (isNaN(item.scrapQty) || item.scrapQty <= 0 || item.scrapQty > item.quantity) {
                alert(`Lütfen "${item.description}" için 1 ile ${item.quantity} arasında geçerli bir miktar girin.`);
                return;
              }
            }

            confirmBtn.setAttribute('disabled', 'true');
            confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

            try {
              const currentUser = (window as any).currentUser;
              const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

              for (const item of itemsWithQty) {
                await warehouseService.updateStockBySap(
                  currentWarehouse.id,
                  item.sapNo,
                  -item.scrapQty,
                  {
                    user: userEmail,
                    reason: `Toplu hurdaya ayrıldı. Gerekçe: ${note}`
                  },
                  'DEFECT'
                );

                await warehouseService.updateStockBySap(
                  currentWarehouse.id,
                  item.sapNo,
                  item.scrapQty,
                  {
                    user: userEmail,
                    reason: `Toplu hurda stok girişi. Gerekçe: ${note}`
                  },
                  'SCRAP'
                );
              }

              (window as any).showToast('Başarılı', 'Seçilen malzemeler başarıyla hurdaya ayrıldı.', 'success');
              modal.remove();

              if ((window as any).selectWarehouseAndNavigate) {
                (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
              }
            } catch (e: any) {
              console.error(e);
              alert('Toplu hurdaya ayırma esnasında bir hata oluştu: ' + e.message);
              confirmBtn.removeAttribute('disabled');
              confirmBtn.innerHTML = 'HURDAYA AYIR';
            }
          };
        }
     };

        (window as any).openP2PTransferModal = (id: string, sap: string, name: string, maxQty: number) => {
        const modal = document.getElementById('p2p-transfer-modal');
        if (modal) {
          (document.getElementById('p2p-item-id') as HTMLInputElement).value = id;
          (document.getElementById('p2p-item-sap') as HTMLInputElement).value = sap;
          (document.getElementById('p2p-item-name') as HTMLInputElement).value = name;
          
          const infoDiv = document.getElementById('p2p-info');
          if (infoDiv) {
            infoDiv.innerText = `${sap} - ${name} (Zimmetinizdeki Mevcut: ${maxQty})`;
          }
          
          const qtyInput = document.getElementById('p2p-qty-input') as HTMLInputElement;
          qtyInput.max = maxQty.toString();
          qtyInput.value = '1';
          
          document.getElementById('p2p-input-container')!.style.display = 'block';
          document.getElementById('p2p-qr-display')!.style.display = 'none';
          
          modal.style.display = 'flex';
        }
     };
     
     (window as any).closeP2PTransferModal = () => {
        const modal = document.getElementById('p2p-transfer-modal');
        if (modal) modal.style.display = 'none';
     };
     
     (window as any).generateP2PQR = async () => {
        const id = (document.getElementById('p2p-item-id') as HTMLInputElement).value;
        const sap = (document.getElementById('p2p-item-sap') as HTMLInputElement).value;
        const name = (document.getElementById('p2p-item-name') as HTMLInputElement).value;
        const qtyInput = document.getElementById('p2p-qty-input') as HTMLInputElement;
        const qty = parseInt(qtyInput.value);
        const maxQty = parseInt(qtyInput.max || '0');
        
        if (isNaN(qty) || qty <= 0 || qty > maxQty) {
          alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
          return;
        }
        
        try {
          const payload = {
            type: 'p2p_transfer',
            sourceWarehouseId: currentWarehouse.id,
            sourceItemId: id,
            sapNo: sap,
            name: name,
            quantity: qty
          };
          
          const qrString = JSON.stringify(payload);
          const qrUrl = await QRCode.toDataURL(qrString, { width: 256, margin: 1 });
          
          const qrImg = document.getElementById('p2p-qr-img') as HTMLImageElement;
          if (qrImg) qrImg.src = qrUrl;
          
          document.getElementById('p2p-input-container')!.style.display = 'none';
          document.getElementById('p2p-qr-display')!.style.display = 'block';
        } catch (err: any) {
          console.error(err);
          alert('QR kod oluşturulurken hata: ' + err.message);
        }
     };

     (window as any).openTransferModal = async (id: string, sap: string, name: string, maxQty: number, preselectedTargetWarehouseId?: string) => {
        const modal = document.getElementById('new-warehouse-transfer-modal');
        if(modal) {
          (document.getElementById('transfer-item-id') as HTMLInputElement).value = id;
          (document.getElementById('transfer-info') as HTMLElement).innerText = `${sap} - ${name} (Mevcut: ${maxQty})`;
          (document.getElementById('transfer-qty-input') as HTMLInputElement).max = maxQty.toString();
          (document.getElementById('transfer-qty-input') as HTMLInputElement).value = '1';

          const targetSelect = document.getElementById('transfer-target-input') as HTMLSelectElement;
          if (targetSelect) {
             targetSelect.innerHTML = '<option value="">Yükleniyor...</option>';
             
             let optionsHtml = '';
             let matchedWh: any = null;

             if (currentWarehouse.id.startsWith('team_') && !isMaterialManager) {
               try {
                 const { collection, query, where, getDocs } = await import('firebase/firestore');
                 const logsRef = collection(db, 'warehouses', currentWarehouse.id, 'logs');
                 const q = query(
                   logsRef, 
                   where('sapNo', '==', sap), 
                   where('type', '==', 'TRANSFER')
                 );
                 const snapshot = await getDocs(q);
                 const logsList = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as any));
                 
                 logsList.sort((a, b) => {
                   const aTime = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : 0;
                   const bTime = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : 0;
                   return bTime - aTime;
                 });

                 for (const logData of logsList) {
                   if (logData.quantity > 0 && logData.note) {
                     const noteLower = logData.note.toLowerCase();
                     const foundWh = allWarehouses.find(w => {
                       const cleanName = w.name.toLowerCase().replace('depo', '').trim();
                       return noteLower.includes(cleanName);
                     });
                     if (foundWh) {
                       matchedWh = foundWh;
                       break;
                     }
                   }
                 }
               } catch (e) {
                 console.error('Error fetching logs to determine source warehouse:', e);
               }
             }

             if (matchedWh) {
               optionsHtml = `<option value="${matchedWh.id}">${matchedWh.name}</option>`;
             } else {
               optionsHtml = targetOptions.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
             }
             
             targetSelect.innerHTML = optionsHtml;
             if (preselectedTargetWarehouseId) {
               targetSelect.value = preselectedTargetWarehouseId;
             }
          }

          modal.style.display = 'flex';
        }
     };
    
    (window as any).closeTransferModal = () => {
       const modal = document.getElementById('new-warehouse-transfer-modal');
       if(modal) modal.style.display = 'none';
    };
    
    (window as any).saveTransferItem = async (btn: HTMLButtonElement) => {
       const id = (document.getElementById('transfer-item-id') as HTMLInputElement).value;
       const targetId = (document.getElementById('transfer-target-input') as HTMLSelectElement).value;
       const qty = parseInt((document.getElementById('transfer-qty-input') as HTMLInputElement).value);
       
       if(!targetId || isNaN(qty) || qty <= 0) {
         alert('Lütfen geçerli bir hedef depo ve miktar girin.');
         return;
       }
       
       const originalText = btn.innerText;
       btn.innerText = 'Transfer Ediliyor...';
       btn.disabled = true;
       
       try {
          const userProfile = getUserProfile();
          const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
          await warehouseService.transferMaterial(currentWarehouse.id, targetId, id, qty, user);
         (window as any).closeTransferModal();
         if ((window as any).selectWarehouseAndNavigate) {
           (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
         }
       } catch(e) { console.error(e); alert('Transfer sırasında hata oluştu: ' + (e as Error).message); }
       finally { btn.innerText = originalText; btn.disabled = false; }
    };
    
    (window as any).closeHistoryModal = () => {
       const modal = document.getElementById('new-warehouse-history-modal');
       if(modal) modal.style.display = 'none';
    };
    
    (window as any).openHistoryModal = async (id: string, name: string) => {
       const modal = document.getElementById('new-warehouse-history-modal');
       if(modal) {
         (document.getElementById('history-title') as HTMLElement).innerText = `Geçmiş: ${name}`;
         const list = document.getElementById('history-list');
         if(list) list.innerHTML = '<div style="text-align:center; padding:1rem;">Yükleniyor...</div>';
         modal.style.display = 'flex';
         
         try {
           const logs = await warehouseService.getLogs(currentWarehouse.id);
           const itemLogs = logs.filter(l => l.itemId === id).sort((a,b:any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
           if(list) {
             if(itemLogs.length === 0) {
               list.innerHTML = '<div style="text-align:center; padding:1rem; color:#94A3B8;">Geçmiş kayıt bulunamadı.</div>';
             } else {
               list.innerHTML = itemLogs.map(l => {
                 const date = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000).toLocaleString('tr-TR') : '-';
                 let typeColor = '#94A3B8';
                 let typeText: string = l.type;
                 if(l.type === 'ADD') {
                   const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                   const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                   const isIncrease = l.oldQty !== undefined && l.oldQty > 0;
                   if (isDefect) {
                     typeColor = '#F59E0B';
                     typeText = 'DEFECT';
                   } else if (isScrap) {
                     typeColor = '#94A3B8';
                     typeText = 'Hurda Girişi';
                   } else if (isIncrease) {
                     typeColor = '#10B981';
                     typeText = 'Stok Artışı';
                   } else {
                     typeColor = '#60A5FA';
                     typeText = 'Stok Giriş';
                   }
                 }
                 if(l.type === 'REMOVE') {
                   const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                   const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                   if (isDefect) {
                     typeColor = '#F59E0B';
                     typeText = 'DEFECT Çıkış';
                   } else if (isScrap) {
                     typeColor = '#94A3B8';
                     typeText = 'Hurda Çıkışı';
                   } else {
                     typeColor = '#EF4444';
                     typeText = 'Stok Çıkış';
                   }
                 }
                 if(l.type === 'TRANSFER') { typeColor = '#3B82F6'; typeText = 'Transfer'; }
                 if(l.type === 'UPDATE') { typeColor = '#F59E0B'; typeText = 'Güncelleme'; }
                 return `
                   <div style="padding:0.75rem; border-bottom:1px solid #1E293B; font-size:0.85rem;">
                     <div style="display:flex; justify-content:space-between; margin-bottom:0.25rem;">
                       <span style="color:${typeColor}; font-weight:600;">${typeText} (${l.quantity > 0 ? '+'+l.quantity : l.quantity})</span>
                       <span style="color:#64748B;">${date}</span>
                     </div>
                     <div style="color:#E2E8F0; margin-bottom:0.25rem;">${(window as any).formatDepoUser ? (window as any).formatDepoUser(l.user) : (l.user || 'Sistem')}</div>
                     <div style="color:#94A3B8; font-size:0.8rem;">${l.note || ''}</div>
                   </div>
                 `;
               }).join('');
             }
           }
         } catch(e) {
           console.error(e);
           if(list) list.innerHTML = '<div style="text-align:center; padding:1rem; color:#EF4444;">Yüklenirken hata oluştu.</div>';
         }
       }
    };
    
    (window as any).toggleDateGroup = (dayStr: string) => {
      const rows = document.querySelectorAll(`tr[data-group-date="${dayStr}"]`);
      const icon = document.querySelector(`i[data-group-icon-date="${dayStr}"]`) as HTMLElement | null;
      if (rows.length === 0) return;
      
      const isHidden = (rows[0] as HTMLElement).style.display === 'none';
      rows.forEach((row: any) => {
        row.style.display = isHidden ? '' : 'none';
      });
      
      if (icon) {
        icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
      }
    };

    (window as any).renderDepoHareketleriLogs = (filteredLogs?: any[]) => {
       const container = document.getElementById('depo-hareketleri-container');
       if (!container) return;
       
       const logsToRender = filteredLogs || (window as any).__cachedDepoLogs || [];
       if (logsToRender.length === 0) {
         container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Herhangi bir hareket kaydı bulunamadı.</div>';
         return;
       }
       
       const sortedLogs = [...logsToRender].sort((a: any, b: any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
       
       // Group logs by day string (toLocaleDateString)
       const groupedLogs: Record<string, any[]> = {};
       const daysOrder: string[] = [];
       sortedLogs.forEach((l: any) => {
         const logDate = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : null;
         const dayStr = logDate ? logDate.toLocaleDateString('tr-TR') : 'Bilinmeyen Tarih';
         if (!groupedLogs[dayStr]) {
           groupedLogs[dayStr] = [];
           daysOrder.push(dayStr);
         }
         groupedLogs[dayStr].push(l);
       });

       container.innerHTML = `
         <div style="border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; background-color: #111827;">
           <div style="overflow-x: auto;">
             <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; min-width: 800px;">
               <thead>
                 <tr style="background-color: #0F172A; border-bottom: 1px solid #1E293B;">
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Saat</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Yapan</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">İşlem</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Rota</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Malzeme</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Miktar</th>
                   <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Açıklama</th>
                   ${isMaterialManager ? `<th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Aksiyon</th>` : ''}
                 </tr>
               </thead>
               <tbody>
                 ${daysOrder.map(dayStr => {
                   const dayLogs = groupedLogs[dayStr];
                   
                   const headerRowHtml = `
                     <tr class="date-group-header" onclick="window.toggleDateGroup('${dayStr}')" style="background-color: rgba(30, 41, 59, 0.6); cursor: pointer; user-select: none; border-bottom: 1px solid #1E293B;">
                       <td colspan="${isMaterialManager ? 8 : 7}" style="padding: 0.75rem 1rem; font-weight: 700; color: #14F195;">
                         <div style="display: flex; align-items: center; gap: 8px;">
                           <i class="fa-solid fa-chevron-down date-group-icon" data-group-icon-date="${dayStr}" style="transition: transform 0.2s; color: #14F195;"></i>
                           <span style="font-family: 'Rajdhani', sans-serif; font-size: 1rem; letter-spacing: 0.5px;">${dayStr}</span>
                           <span style="font-size: 0.75rem; background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.2); padding: 2px 6px; border-radius: 4px; color: #14F195; font-weight: 600;">${dayLogs.length} İşlem</span>
                         </div>
                       </td>
                     </tr>
                   `;
                   
                   const rowsHtml = dayLogs.map((l: any) => {
                     const logDate = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : null;
                     const timeStr = logDate ? logDate.toLocaleTimeString('tr-TR') : '-';
                     
                     const formatUser = (user: string): string => {
                        if (!user) return 'Sistem';
                        const trimmed = user.trim();
                        
                        // Match TMXX Bakım Teknisyeni
                        const match0 = trimmed.match(/^TM(\d+)\s*Bakım\s*Teknisyeni$/i);
                        if (match0) {
                          return `Team${match0[1]}`;
                        }

                        // Match dh-tmXX@demirerholding.com
                        const match = trimmed.match(/^dh-tm(\d+)@demirerholding\.com$/i);
                        if (match) {
                          return `Team${match[1]}`;
                        }
  
                        // Match dhtmXX@demirerholding.com
                        const match2 = trimmed.match(/^dhtm(\d+)@demirerholding\.com$/i);
                        if (match2) {
                          return `Team${match2[1]}`;
                        }
  
                        // Match dh-tmXX
                        const match3 = trimmed.match(/^dh-tm(\d+)$/i);
                        if (match3) {
                          return `Team${match3[1]}`;
                        }
  
                        // Match TeamXX or Team XX
                        const match4 = trimmed.match(/^team\s*(\d+)$/i);
                        if (match4) {
                          return `Team${match4[1]}`;
                        }
                        
                        if (trimmed.startsWith('team_')) {
                          return trimmed.replace('team_', '').replace(/_/g, ' ');
                        }

                        if (trimmed.includes('@')) {
                          return trimmed.split('@')[0];
                        }

                        return trimmed;
                      };
                      
                      const baseBadgeStyle = "display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; width: 120px;";
                      let badgeHtml = '';
                      if (l.type === 'ADD') {
                        const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                        const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                        const isIncrease = l.oldQty !== undefined && l.oldQty > 0;
                        
                        if (isDefect) {
                          badgeHtml = `
                            <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                              <i class="fa-solid fa-screwdriver-wrench" style="font-size: 0.75rem; margin-right: 4px;"></i> SÖKÜLEN PARÇA
                            </span>
                          `;
                        } else if (isScrap) {
                          badgeHtml = `
                            <span style="${baseBadgeStyle} background: rgba(100, 116, 139, 0.15); color: #94A3B8; border: 1px solid rgba(100, 116, 139, 0.3); box-shadow: 0 0 6px rgba(100, 116, 139, 0.15);">
                              <i class="fa-solid fa-trash" style="font-size: 0.75rem; margin-right: 4px;"></i> HURDA GİRİŞİ
                            </span>
                          `;
                        } else {
                          badgeHtml = `
                            <span style="${baseBadgeStyle} background: ${isIncrease ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; color: ${isIncrease ? '#10B981' : '#60A5FA'}; border: 1px solid ${isIncrease ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}; box-shadow: 0 0 6px ${isIncrease ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'};">
                              <i class="fa-solid ${isIncrease ? 'fa-chart-line' : 'fa-circle-plus'}" style="font-size: 0.75rem; margin-right: 4px;"></i> ${isIncrease ? 'STOK ARTIŞI' : 'STOK GİRİŞ'}
                            </span>
                          `;
                        }
                      } else if (l.type === 'REMOVE') {
                        const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                        const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                        
                        if (isDefect) {
                          badgeHtml = `
                            <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                              <i class="fa-solid fa-arrow-right-from-bracket" style="font-size: 0.75rem; margin-right: 4px;"></i> ARIZALI ÇIKIŞ
                            </span>
                          `;
                        } else if (isScrap) {
                          badgeHtml = `
                            <span style="${baseBadgeStyle} background: rgba(100, 116, 139, 0.15); color: #94A3B8; border: 1px solid rgba(100, 116, 139, 0.3); box-shadow: 0 0 6px rgba(100, 116, 139, 0.15);">
                              <i class="fa-solid fa-trash" style="font-size: 0.75rem; margin-right: 4px;"></i> HURDA ÇIKIŞI
                            </span>
                          `;
                        } else {
                          const isReportUse = l.note && l.note.includes('Saha Raporu');
                          if (isReportUse) {
                            badgeHtml = `
                              <span style="${baseBadgeStyle} background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); box-shadow: 0 0 6px rgba(16, 185, 129, 0.15);">
                                <i class="fa-solid fa-wrench" style="font-size: 0.75rem; margin-right: 4px;"></i> TAKILAN PARÇA
                              </span>
                            `;
                          } else {
                            badgeHtml = `
                              <span style="${baseBadgeStyle} background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 0 6px rgba(239, 68, 68, 0.15);">
                                <i class="fa-solid fa-circle-minus" style="font-size: 0.75rem; margin-right: 4px;"></i> STOK ÇIKIŞ
                              </span>
                            `;
                          }
                        }
                      } else if (l.type === 'TRANSFER') {
                        badgeHtml = `
                          <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                            <i class="fa-solid fa-circle-arrow-right" style="font-size: 0.75rem; margin-right: 4px;"></i> TRANSFER
                          </span>
                        `;
                      } else {
                        badgeHtml = `
                          <span style="${baseBadgeStyle} background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 0 6px rgba(59, 130, 246, 0.15);">
                            <i class="fa-solid fa-pen" style="font-size: 0.75rem; margin-right: 4px;"></i> GÜNCELLEME
                          </span>
                        `;
                      }
                     
                      let isQtyDecrease = l.type === 'REMOVE';
                      if (l.type === 'TRANSFER') {
                        if (l.note && l.note.includes(' deposuna transfer edildi.')) {
                          isQtyDecrease = true;
                        } else if (l.transferInfo && currentWarehouse.id === l.transferInfo.from) {
                          isQtyDecrease = true;
                        }
                      }
                      
                      let isReturnToMain = false;
                      if (l.type === 'TRANSFER' && l.transferInfo) {
                        if (l.transferInfo.from.startsWith('team_') && !l.transferInfo.to.startsWith('team_')) {
                          isReturnToMain = true;
                        }
                      }

                      const isReportUse = l.type === 'REMOVE' && l.note && l.note.includes('Saha Raporu');
                      const isDefectAdd = l.type === 'ADD' && l.note && l.note.includes('[Durum: DEFECT]');

                      let qtyColor = '#10B981';
                      let qtyText = '';

                      if (isReportUse) {
                        qtyColor = '#10B981'; // Takılan Parça is Green (+)
                        qtyText = `+${Math.abs(l.quantity)}`;
                      } else if (isDefectAdd) {
                        qtyColor = '#EF4444'; // Sökülen Parça is Red (-)
                        qtyText = `-${Math.abs(l.quantity)}`;
                      } else {
                        qtyColor = (isQtyDecrease && !isReturnToMain) ? '#EF4444' : '#10B981';
                        qtyText = isQtyDecrease ? `-${Math.abs(l.quantity)}` : `+${Math.abs(l.quantity)}`;
                      }
  
                      // DIRECTION INDICATOR FOR TRANSFER OR REPORT CONSUMPTION
                      let directionHtml = '';
                      if (l.type === 'TRANSFER' || (l.note && (l.note.includes('Konum:') || l.note.includes('Saha Raporu')))) {
                        const currentWhName = currentWarehouse.name.replace(/\s*[Dd]epo(su)?\s*$/, '').trim();
                        let otherWhName = '';
                        let isIncoming = l.type === 'TRANSFER' ? l.quantity > 0 : l.type === 'ADD';
                        
                        if (l.transferInfo) {
                          if (currentWarehouse.id === l.transferInfo.from) {
                            otherWhName = l.transferInfo.toName;
                            isIncoming = false;
                          } else {
                            otherWhName = l.transferInfo.fromName;
                            isIncoming = true;
                          }
                        } else if (l.note && l.type === 'TRANSFER') {
                          if (l.note.includes(' deposuna transfer edildi.')) {
                            otherWhName = l.note.replace(' deposuna transfer edildi.', '').trim();
                            isIncoming = false;
                          } else if (l.note.includes(' deposundan transfer edildi.')) {
                            otherWhName = l.note.replace(' deposundan transfer edildi.', '').trim();
                            isIncoming = true;
                          }
                        } else if (l.note && (l.type === 'REMOVE' || l.type === 'ADD')) {
                          // Try to extract site name from "Konum: Alize Sarıkaya - T01"
                          const locMatch = l.note.match(/Konum:\s*([^-\)\]\(\[#]+)/i);
                          if (locMatch) {
                            otherWhName = locMatch[1].trim();
                          }
                        }
                        
                        if (!otherWhName) {
                          otherWhName = 'Diğer Depo';
                        }
                       
                       const cleanCurrent = formatUser(currentWhName);
                       const cleanOther = formatUser(otherWhName);
                       
                       if (isIncoming) {
                          directionHtml = `
                            <div style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; color: #10B981; font-weight: 600;">
                              <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); white-space: nowrap;">${cleanOther}</span>
                              <i class="fa-solid fa-arrow-right-long" style="font-size: 0.7rem; opacity: 0.8;"></i>
                              <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap;">${cleanCurrent}</span>
                            </div>
                          `;
                        } else {
                          directionHtml = `
                            <div style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; color: #EF4444; font-weight: 600;">
                              <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap;">${cleanCurrent}</span>
                              <i class="fa-solid fa-arrow-right-long" style="font-size: 0.7rem; opacity: 0.8;"></i>
                              <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); white-space: nowrap;">${cleanOther}</span>
                            </div>
                          `;
                        }
                      }

                      let serialNo = l.serialNo || '';
                      if (!serialNo && inventoryItems) {
                        const matched = inventoryItems.find((inv: any) => inv.id === l.itemId || inv.sapNo === l.sapNo);
                        if (matched) {
                          serialNo = matched.serialNo || '';
                        }
                      }
                      
                      let displayNote = l.note || '';
                      const reportIdMatch = displayNote.match(/Rapor:\s*(AL_SR[A-Za-z0-9_]+)/i);
                      if (reportIdMatch) {
                        const reportId = reportIdMatch[1];
                        const detailedPattern = new RegExp(`Rapor:\\s*${reportId},\\s*Arıza\\s*Kodu:`, 'i');
                        if (detailedPattern.test(displayNote)) {
                          const standalonePattern = new RegExp(`\\s*\\(Rapor:\\s*${reportId}\\)`, 'gi');
                          displayNote = displayNote.replace(standalonePattern, '');
                        }
                      }
                      displayNote = displayNote.replace(/\s*\[Durum:\s*(NEW|DEFECT|SCRAP)\]/gi, '').trim();

                      let resolvedLogName = l.materialName || '';
                      if (!resolvedLogName || resolvedLogName === 'Bilinmeyen Malzeme' || resolvedLogName === 'Bilinmeyen') {
                        const dictMat = inventoryService.getMaterialBySap(l.sapNo);
                        if (dictMat && dictMat.d) {
                          resolvedLogName = dictMat.d;
                        }
                      }
                      if (!resolvedLogName) {
                        resolvedLogName = 'Bilinmeyen Malzeme';
                      }

                     return `
                       <tr data-group-date="${dayStr}" style="border-bottom: 1px solid rgba(30, 41, 59, 0.5); transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(30, 41, 59, 0.2)'" onmouseout="this.style.backgroundColor='transparent'">
                         <td style="padding: 1rem; color: #E2E8F0; white-space: nowrap; vertical-align: top; text-align: center;">${timeStr}</td>
                         <td style="padding: 1rem; color: #E2E8F0; font-weight: 500; white-space: nowrap; vertical-align: top; text-align: center;">${formatUser(l.user)}</td>
                         <td style="padding: 1rem; white-space: nowrap; vertical-align: top; text-align: center;">${badgeHtml}</td>
                         <td style="padding: 1rem; white-space: nowrap; vertical-align: top; text-align: center;">${directionHtml || '<span style="color: #475569; font-size: 0.85rem;">-</span>'}</td>
                         <td style="padding: 1rem; color: #E2E8F0; vertical-align: top;">
                           <div style="display: flex; flex-direction: column; gap: 4px;">
                             <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                               <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background-color: rgba(59, 130, 246, 0.1); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap; width: 85px; flex-shrink: 0;">SAP: ${l.sapNo}</span>
                               <span style="font-weight: 600; color: #FFF; font-size: 0.8rem; line-height: 1.2; margin-top: 3px;">${resolvedLogName}</span>
                             </div>
                             ${serialNo && serialNo !== '-' && serialNo.toUpperCase() !== 'N/A' ? `
                               <div style="font-size: 0.8rem; color: #10B981; font-weight: 600; font-family: monospace; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                                 <i class="fa-solid fa-microchip" style="font-size: 0.75rem;"></i> Seri No: <span style="color: #FFF; font-weight: normal;">${serialNo}</span>
                               </div>
                             ` : ''}
                           </div>
                         </td>
                         <td style="padding: 1rem; color: ${qtyColor}; font-weight: 700; white-space: nowrap; vertical-align: top; text-align: center;">${qtyText} Adet</td>
                         <td style="padding: 1rem; color: #94A3B8; vertical-align: top;">${displayNote}</td>
                         ${isMaterialManager ? `
                          <td style="padding: 1rem; text-align: center; vertical-align: top;">
                            <button onclick="window.deleteDepoLog('${l.id}')" style="background: transparent; border: none; color: #EF4444; cursor: pointer; font-size: 1.1rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.backgroundColor='transparent'" title="Kayıt Sil">
                              <i class="fa-solid fa-trash-can"></i>
                            </button>
                          </td>
                          ` : ''}
                       </tr>
                     `;
                   }).join('');
                   
                   return headerRowHtml + rowsHtml;
                 }).join('')}
               </tbody>
             </table>
           </div>
         </div>
       `;
     };

    (window as any).loadDepoHareketleriLogs = async () => {
         const container = document.getElementById('depo-hareketleri-container');
         if (container) {
           container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
           try {
             const { warehouseService } = await import('../services/WarehouseService');
             const activeWhId = (window as any).currentWarehouseId || 'MTA';
             const logs = await warehouseService.getLogs(activeWhId);
             (window as any).__cachedDepoLogs = logs;
             if (typeof (window as any).renderDepoHareketleriLogs === 'function') {
               (window as any).renderDepoHareketleriLogs();
             }
           } catch (err: any) {
             console.error(err);
             container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu: ${err.message}</div>`;
           }
         }
     };

    (window as any).toggleAuditDetails = (auditId: string) => {
      const el = document.getElementById(`audit-details-${auditId}`);
      const icon = document.getElementById(`audit-toggle-icon-${auditId}`);
      if (el) {
        if (el.style.display === 'none') {
          el.style.display = 'block';
          if (icon) {
            icon.className = 'fa-solid fa-chevron-up';
          }
        } else {
          el.style.display = 'none';
          if (icon) {
            icon.className = 'fa-solid fa-chevron-down';
          }
        }
      }
    };

    (window as any).loadSayimGecmisi = async () => {
           const container = document.getElementById('audit-history-container');
           if (container) {
             container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
             try {
               const { warehouseService } = await import('../services/WarehouseService');
               const activeWhId = (window as any).currentWarehouseId || 'MTA';
               const audits = await warehouseService.getAuditHistory(activeWhId);
               (window as any).__cachedAudits = audits;
               if (audits.length === 0) {
                 container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Henüz sayım geçmişi bulunmuyor.</div>';
               } else {
                 container.innerHTML = audits.map(audit => {
                   const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
                   const diffColor = audit.totalDiff < 0 ? '#EF4444' : (audit.totalDiff > 0 ? '#F59E0B' : '#14F195');
                   const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
                   
                   const sortedResults = [...audit.results].map(r => {
                      let shelfNo = r.shelfNo || '';
                      if (!shelfNo && (window as any).currentInventoryData) {
                        const invItem = (window as any).currentInventoryData.find((i: any) => i.sapNo === r.sapNo || (i.sapNo === '' && i.name === r.description));
                        if (invItem) shelfNo = invItem.shelfNo || '';
                      }
                      return { ...r, calculatedShelfNo: shelfNo };
                   }).sort((a, b) => {
                      const locA = String(a.calculatedShelfNo || '').trim().toUpperCase();
                      const locB = String(b.calculatedShelfNo || '').trim().toUpperCase();
                      if (!locA && locB) return 1;
                      if (locA && !locB) return -1;
                      let locCmp = 0;
                      if (locA && locB) {
                          locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
                      }
                      if (locCmp !== 0) return locCmp;
                      return String(a.sapNo || '').localeCompare(String(b.sapNo || ''));
                   });

                   return `
                     <div class="audit-history-card" style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                       <div style="display: flex; justify-content: space-between; align-items: center;">
                         <div onclick="window.toggleAuditDetails('${audit.id}')" style="cursor: pointer; flex-grow: 1; display: flex; align-items: center; gap: 10px;">
                           <i id="audit-toggle-icon-${audit.id}" class="fa-solid fa-chevron-down" style="color: #64748B; font-size: 0.85rem; transition: transform 0.2s;"></i>
                           <div>
                             <div style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem;">${date}</div>
                             <div style="font-size: 0.8rem; color: #64748B;">Sayan: ${audit.user || 'Bilinmeyen'} | Toplam Kalem: ${audit.results?.length || 0}</div>
                           </div>
                         </div>
                         <div style="display: flex; align-items: center; gap: 0.75rem;">
                           <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: ${diffColor}; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px;">Fark: ${totalDiffText}</div>
                           <button onclick="window.downloadSingleAuditExcel('${audit.id}')" style="background: transparent; border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;" onmouseover="this.style.background='rgba(16, 185, 129, 0.1)'" onmouseout="this.style.background='transparent'">
                             <i class="fa-solid fa-file-excel"></i> Excel
                           </button>
                         </div>
                       </div>
                       
                       <div id="audit-details-${audit.id}" style="overflow-x: auto; max-height: 350px; overflow-y: auto; display: none; margin-top: 1rem; border-top: 1px solid #1E293B; padding-top: 1rem;">
                         <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                           <thead>
                             <tr style="border-bottom: 1px solid #1E293B; color: #64748B;">
                               <th style="padding: 0.5rem;">Konum</th>
                               <th style="padding: 0.5rem;">SAP No</th>
                               <th style="padding: 0.5rem;">Tanım</th>
                               <th style="padding: 0.5rem; text-align: right;">Sistem</th>
                               <th style="padding: 0.5rem; text-align: right;">Fiziksel</th>
                               <th style="padding: 0.5rem; text-align: right;">Fark</th>
                               <th style="padding: 0.5rem;">Açıklama</th>
                             </tr>
                           </thead>
                           <tbody>
                             ${sortedResults.map(r => {
                               const diff = r.diff;
                               const diffText = diff > 0 ? '+' + diff : diff;
                               const diffCl = diff < 0 ? '#EF4444' : (diff > 0 ? '#F59E0B' : '#14F195');
                               return `
                                 <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                                   <td style="padding: 0.4rem 0.5rem; color: #94A3B8;">${r.calculatedShelfNo || '-'}</td>
                                   <td style="padding: 0.4rem 0.5rem; font-family: monospace; color: #FFF;">${r.sapNo}</td>
                                   <td style="padding: 0.4rem 0.5rem; color: #E2E8F0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">${r.description}</td>
                                   <td style="padding: 0.4rem 0.5rem; text-align: right; color: #FFF;">${r.systemQty}</td>
                                   <td style="padding: 0.4rem 0.5rem; text-align: right; color: #FFF;">${r.physicalQty}</td>
                                   <td style="padding: 0.4rem 0.5rem; text-align: right; font-weight: 700; color: ${diffCl};">${diffText}</td>
                                   <td style="padding: 0.4rem 0.5rem; color: #94A3B8; font-size: 0.75rem;">${r.note || ''}</td>
                                 </tr>
                                `;
                             }).join('')}
                           </tbody>
                         </table>
                       </div>
                     </div>
                   `;
                 }).join('');
               }
             } catch (err: any) {
               console.error(err);
               container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu: ${err.message}</div>`;
             }
           }
     };

     (window as any).deleteDepoLog = async (logId: string) => {
        if (!confirm("Bu hareket kaydını silmek istediğinize emin misiniz?")) {
          return;
        }
        try {
          await warehouseService.deleteLog(currentWarehouse.id, logId);
          (window as any).showToast('Başarılı', 'Kayıt silindi.', 'success');
          if (typeof (window as any).selectWarehouseAndNavigate === 'function') {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (err: any) {
          alert("Hata oluştu: " + err.message);
        }
     };

     (window as any).clearAllDepoLogs = async () => {
        if (!confirm("Bu depoya ait tüm hareket geçmişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
          return;
        }
        try {
          (window as any).showToast('Bilgi', 'Temizleniyor, lütfen bekleyin...', 'info');
          await warehouseService.clearAllLogs(currentWarehouse.id);
          (window as any).showToast('Başarılı', 'Tüm hareket geçmişi başarıyla temizlendi.', 'success');
          if (typeof (window as any).selectWarehouseAndNavigate === 'function') {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
        } catch (err: any) {
          alert("Hata oluştu: " + err.message);
        }
     };

     (window as any).filterDepoHareketleri = (searchTerm: string) => {
       const term = searchTerm.toLowerCase().trim();
       if (!term) {
         (window as any).renderDepoHareketleriLogs();
         return;
       }
       
       const filtered = ((window as any).__cachedDepoLogs || []).filter((l: any) => {
         const sap = String(l.sapNo || '').toLowerCase();
         const matName = String(l.materialName || '').toLowerCase();
         const note = String(l.note || '').toLowerCase();
         const user = String(l.user || '').toLowerCase();
         
         let opTypeStr = '';
         if (l.type === 'ADD') {
           if (l.note && l.note.includes('[Durum: DEFECT]')) {
             opTypeStr = 'sökülen girişi defect';
           } else if (l.note && l.note.includes('[Durum: SCRAP]')) {
             opTypeStr = 'hurda girişi';
           } else {
             opTypeStr = (l.oldQty !== undefined && l.oldQty > 0) ? 'stok artışı' : 'stok giriş';
           }
         } else if (l.type === 'REMOVE') {
           if (l.note && l.note.includes('[Durum: DEFECT]')) {
             opTypeStr = 'sökülen çıkışı defect';
           } else if (l.note && l.note.includes('[Durum: SCRAP]')) {
             opTypeStr = 'hurda çıkışı';
           } else {
             opTypeStr = 'stok çıkış';
           }
         } else if (l.type === 'TRANSFER') {
           opTypeStr = 'transfer';
         } else {
           opTypeStr = 'güncelleme';
         }

         return sap.includes(term) || matName.includes(term) || note.includes(term) || user.includes(term) || opTypeStr.includes(term);
       });
       
       (window as any).renderDepoHareketleriLogs(filtered);
     };

    let warehouseTransfersFilter = 'HEPSİ';
    let warehouseTransfersDirection = 'ALL';
    let warehouseTransfersSearchQuery = '';
    let cachedWarehouseTransfers: any[] = [];
    let warehouseTransfersPage = 1;
    const warehouseTransfersPageSize = 20;

     (window as any).filterWarehouseTransfers = (status: string) => {
       warehouseTransfersFilter = status;
       warehouseTransfersPage = 1;
       (window as any).renderWarehouseTransfersList();
     };

     (window as any).changeWarehouseTransfersPage = (direction: number) => {
       warehouseTransfersPage += direction;
       (window as any).renderWarehouseTransfersList();
     };

     (window as any).setTransferDirection = (direction: string) => {
       warehouseTransfersDirection = direction;
       warehouseTransfersPage = 1;
       
       const dirs = { 'ALL': 'all', 'INCOMING': 'in', 'OUTGOING': 'out' };
       Object.entries(dirs).forEach(([dir, suffix]) => {
         const btn = document.getElementById('btn-dir-' + suffix);
         if (btn) {
           if (dir === direction) {
             btn.style.background = 'rgba(20,241,149,0.15)';
             btn.style.color = '#14F195';
           } else {
             btn.style.background = 'transparent';
             btn.style.color = '#94A3B8';
           }
         }
       });

       (window as any).renderWarehouseTransfersList();
     };

     (window as any).onTransferSearchInput = () => {
       const input = document.getElementById('transfer-search-input') as HTMLInputElement;
       warehouseTransfersSearchQuery = input ? input.value.trim().toLowerCase() : '';
       warehouseTransfersPage = 1;
       (window as any).renderWarehouseTransfersList();
     };

     (window as any).getFilteredTransfersList = () => {
       const currentWarehouseId = currentWarehouse.id;
       const now = new Date();

       let filtered = cachedWarehouseTransfers;

       // 1. Status Filter
       if (warehouseTransfersFilter === 'GELEN_YOLDA') {
         filtered = filtered.filter(t => {
           const s = t.status || 'YOLDA';
           const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
           return normStatus === 'YOLDA' && t.toSiteId === currentWarehouseId;
         });
       } else if (warehouseTransfersFilter === 'GIDEN_YOLDA') {
         filtered = filtered.filter(t => {
           const s = t.status || 'YOLDA';
           const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
           return normStatus === 'YOLDA' && t.toSiteId !== currentWarehouseId;
         });
       } else if (warehouseTransfersFilter === 'GECIKEN') {
         filtered = filtered.filter(t => {
           const s = t.status || 'YOLDA';
           const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
           if (normStatus !== 'YOLDA') return false;
           if (t.createdAt?.seconds) {
             const createdDate = new Date(t.createdAt.seconds * 1000);
             const diffHours = Math.abs(now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
             return diffHours > 48;
           }
           return false;
         });
       } else if (warehouseTransfersFilter === 'TAMAMLANDI') {
         filtered = filtered.filter(t => {
           const s = t.status || 'YOLDA';
           const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
           return normStatus === 'TAMAMLANDI';
         });
       } else if (warehouseTransfersFilter === 'IPTAL_EDILDI') {
         filtered = filtered.filter(t => {
           const s = t.status || 'YOLDA';
           const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
           return normStatus === 'IPTAL_EDILDI';
         });
       }

       // 2. Direction Filter (Incoming vs Outgoing)
       if (warehouseTransfersDirection === 'INCOMING') {
         filtered = filtered.filter(t => t.toSiteId === currentWarehouseId);
       } else if (warehouseTransfersDirection === 'OUTGOING') {
         filtered = filtered.filter(t => t.fromSiteId === currentWarehouseId);
       }

       // 3. Search Query Filter (SAP, Material Name, MSF, MÇF/MFÇ, Site Names)
       if (warehouseTransfersSearchQuery) {
         const q = warehouseTransfersSearchQuery;
         filtered = filtered.filter(t => {
           const msfNo = (t.msfNo || '').toLowerCase();
           const mcfNo = (t.mcfNo || t.formNo || '').toLowerCase();
           const docId = (t.id || '').toLowerCase();
           const fromName = ((window as any)._warehousesMap[t.fromSiteId] || t.fromSiteId).toLowerCase();
           const toName = ((window as any)._warehousesMap[t.toSiteId] || t.toSiteId).toLowerCase();
           const reqBy = (t.requestedBy || '').toLowerCase();
           const hasSiteMatch = fromName.includes(q) || toName.includes(q) || msfNo.includes(q) || mcfNo.includes(q) || docId.includes(q) || reqBy.includes(q);

           if (hasSiteMatch) return true;

           if (Array.isArray(t.items)) {
             return t.items.some((it: any) => 
               (it.materialCode || '').toLowerCase().includes(q) || 
               (it.materialName || '').toLowerCase().includes(q)
             );
           } else {
             return (t.materialCode || '').toLowerCase().includes(q) || 
                    (t.materialName || '').toLowerCase().includes(q);
           }
         });
       }

       return filtered;
     };

     (window as any).exportTransfersListToExcel = async () => {
       try {
         const { excelService } = await import('../services/ExcelService');
         const filteredForExport = (window as any).getFilteredTransfersList();
         if (filteredForExport.length === 0) {
           alert("İndirilecek transfer kaydı bulunamadı!");
           return;
         }
         const fileName = `${currentWarehouse.name.replace(/\s+/g, '_')}_Sevk_Raporu`;
         await excelService.exportTransfersToExcel(filteredForExport, fileName);
       } catch (err: any) {
         alert("Excel indirilirken hata oluştu: " + err.message);
       }
     };

     (window as any).renderWarehouseTransfersList = () => {
       const listContainer = document.getElementById('warehouse-transfers-cards-list');
       if (!listContainer) return;

       const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
       const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MALZEME_YONETIMI' || currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
       const currentWarehouseId = currentWarehouse.id;

       // Compute tracker stats
       const stats = {
         all: cachedWarehouseTransfers.length,
         incomingPending: 0,
         outgoingPending: 0,
         delayed: 0,
         completed: 0,
         cancelled: 0
       };

       const now = new Date();

       cachedWarehouseTransfers.forEach((t: any) => {
         const s = t.status || 'YOLDA';
         const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
         const isIncoming = t.toSiteId === currentWarehouseId;

         if (normStatus === 'YOLDA') {
           let isDelayed = false;
           if (t.createdAt?.seconds) {
             const createdDate = new Date(t.createdAt.seconds * 1000);
             const diffHours = Math.abs(now.getTime() - createdDate.getTime()) / (1000 * 60 * 60);
             if (diffHours > 48) {
               isDelayed = true;
               stats.delayed++;
             }
           }
           if (isIncoming) stats.incomingPending++;
           else stats.outgoingPending++;
         } else if (normStatus === 'TAMAMLANDI') {
           stats.completed++;
         } else if (normStatus === 'IPTAL_EDILDI') {
           stats.cancelled++;
         }
       });

       const agendaContainer = document.getElementById('transfer-tracker-agenda');
       if (agendaContainer) {
         let assistantNote = '';
         let assistantStatus = 'NORMAL';
         
         if (stats.delayed > 0) {
           assistantStatus = 'CRITICAL';
           assistantNote = `⚠️ <strong>KRİTİK GECİKME UYARISI:</strong> Deponuzla ilişkili <strong>${stats.delayed} sevk</strong> 48 saattir yolda görünüyor. Lütfen kargo takip bilgilerini veya taşıyıcı personeli kontrol ediniz.`;
         } else if (stats.incomingPending > 0) {
           assistantStatus = 'INFO';
           assistantNote = `🔔 <strong>ASİSTAN NOTU:</strong> Deponuza doğru gelmekte olan <strong>${stats.incomingPending} sevk</strong> bulunuyor. Malzemeler ulaştığında <strong>"Teslim Al"</strong> butonu ile stoğa işleyebilirsiniz.`;
         } else {
           assistantNote = `✅ <strong>SİSTEM DURUMU:</strong> Şu an için depoya bağlı tüm transfer ve sevk hareketleri güncel ve planlandığı şekilde ilerliyor.`;
         }

         let assistantGlowColor = 'rgba(20, 241, 149, 0.15)';
         let assistantBorderColor = '#14F195';
         if (assistantStatus === 'CRITICAL') {
           assistantGlowColor = 'rgba(239, 68, 68, 0.15)';
           assistantBorderColor = '#EF4444';
         } else if (assistantStatus === 'INFO') {
           assistantGlowColor = 'rgba(59, 130, 246, 0.15)';
           assistantBorderColor = '#3b82f6';
         }

         agendaContainer.innerHTML = `
           <div class="glass-panel" style="background: rgba(10,20,30,0.4); padding: 1.25rem; border-radius: 12px; border: 1px solid ${assistantBorderColor}; box-shadow: 0 4px 30px ${assistantGlowColor}; transition: all 0.3s; margin-bottom: 1.25rem;">
             
             <!-- Title -->
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.5rem;">
               <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px;">
                 <i class="fa-solid fa-calendar-check" style="animation: pulse 2s infinite;"></i> SEVK TAKİP AJANDASI & ASİSTAN
               </div>
               <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: bold; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                 <span style="width: 6px; height: 6px; border-radius: 50%; background: #14F195; display: inline-block;"></span> SİSTEM TAKİBİ ETKİN
               </span>
             </div>

             <!-- Metrics Grid -->
             <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 1rem;">
               
               <!-- TÜMÜ -->
               <div onclick="window.filterWarehouseTransfers('HEPSİ')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'HEPSİ' ? 'rgba(20,241,149,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'HEPSİ' ? '#14F195' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'HEPSİ' ? '0 0 10px rgba(20,241,149,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'HEPSİ' ? '#14F195' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Tüm Sevkler</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif;">${stats.all}</span>
               </div>

               <!-- GELEN (YOLDA) -->
               <div onclick="window.filterWarehouseTransfers('GELEN_YOLDA')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'GELEN_YOLDA' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'GELEN_YOLDA' ? '#3b82f6' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'GELEN_YOLDA' ? '0 0 10px rgba(59,130,246,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'GELEN_YOLDA' ? '#3b82f6' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Gelen (Yolda)</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: #3b82f6; font-family: 'Rajdhani', sans-serif;">${stats.incomingPending}</span>
               </div>

               <!-- GİDEN (YOLDA) -->
               <div onclick="window.filterWarehouseTransfers('GIDEN_YOLDA')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'GIDEN_YOLDA' ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'GIDEN_YOLDA' ? '#a855f7' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'GIDEN_YOLDA' ? '0 0 10px rgba(168,85,247,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'GIDEN_YOLDA' ? '#a855f7' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Giden (Yolda)</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: #a855f7; font-family: 'Rajdhani', sans-serif;">${stats.outgoingPending}</span>
               </div>

               <!-- GECİKEN SEVK -->
               <div onclick="window.filterWarehouseTransfers('GECIKEN')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'GECIKEN' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'GECIKEN' ? '#EF4444' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'GECIKEN' ? '0 0 10px rgba(239,68,68,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'GECIKEN' ? '#EF4444' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Geciken Sevk</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: ${stats.delayed > 0 ? '#EF4444' : '#FFF'}; font-family: 'Rajdhani', sans-serif;">${stats.delayed}</span>
               </div>

               <!-- TAMAMLANANLAR -->
               <div onclick="window.filterWarehouseTransfers('TAMAMLANDI')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'TAMAMLANDI' ? 'rgba(20,241,149,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'TAMAMLANDI' ? '#14F195' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'TAMAMLANDI' ? '0 0 10px rgba(20,241,149,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'TAMAMLANDI' ? '#14F195' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Tamamlanan</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: #14F195; font-family: 'Rajdhani', sans-serif;">${stats.completed}</span>
               </div>

               <!-- İPTAL EDİLENLER -->
               <div onclick="window.filterWarehouseTransfers('IPTAL_EDILDI')" style="cursor: pointer; background: ${warehouseTransfersFilter === 'IPTAL_EDILDI' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseTransfersFilter === 'IPTAL_EDILDI' ? '#EF4444' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s; box-shadow: ${warehouseTransfersFilter === 'IPTAL_EDILDI' ? '0 0 10px rgba(239,68,68,0.15)' : 'none'};" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseTransfersFilter === 'IPTAL_EDILDI' ? '#EF4444' : 'rgba(255,255,255,0.05)'}'">
                 <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">İptal Edilenler</span>
                 <span style="font-size: 1.4rem; font-weight: 800; color: #EF4444; font-family: 'Rajdhani', sans-serif;">${stats.cancelled}</span>
               </div>

             </div>

             <!-- Assistant Note -->
             <div style="background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; color: #E2E8F0; line-height: 1.45;">
               ${assistantNote}
             </div>

           </div>
         `;
       }

       const filtered = (window as any).getFilteredTransfersList();

       if (filtered.length === 0) {
         listContainer.innerHTML = `
           <div style="padding: 4rem 2rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.01); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05); margin-top: 1rem;">
             <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.15; color: var(--accent-cyan);"></i>
             <p style="font-size: 0.85rem; margin: 0;">Bu filtreye uygun sevk/transfer kaydı bulunamadı.</p>
           </div>
         `;
         return;
       }

       // Pagination calculations
       const totalCount = filtered.length;
       const totalPages = Math.ceil(totalCount / warehouseTransfersPageSize) || 1;
       if (warehouseTransfersPage > totalPages) warehouseTransfersPage = totalPages;
       if (warehouseTransfersPage < 1) warehouseTransfersPage = 1;

       const startIndex = (warehouseTransfersPage - 1) * warehouseTransfersPageSize;
       const endIndex = startIndex + warehouseTransfersPageSize;
       const paginated = filtered.slice(startIndex, endIndex);

       const cardsHtml = paginated.map((t: any) => {
         const isV2 = Array.isArray(t.items);
         const msfNo = t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`;
         
         const fromName = (window as any)._warehousesMap[t.fromSiteId] || t.fromSiteId;
         const toName = (window as any)._warehousesMap[t.toSiteId] || t.toSiteId;
         
         const s = t.status || 'YOLDA';
         const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
         
         let statusStyle = '';
         let statusText = '';
         let cardBorderColor = 'rgba(255,255,255,0.05)';
         let statusGlow = 'rgba(0,0,0,0)';
         
         if (normStatus === 'YOLDA') {
           statusStyle = 'background: rgba(245, 158, 11, 0.08); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.25);';
           statusText = '<i class="fa-solid fa-circle-nodes fa-pulse" style="margin-right: 4px;"></i> YOLDA';
           cardBorderColor = '#F59E0B';
           statusGlow = 'rgba(245, 158, 11, 0.1)';
         } else if (normStatus === 'TAMAMLANDI') {
           let shelfInfo = '';
           if (Array.isArray(t.receivedItemsDetails) && t.receivedItemsDetails.length > 0) {
             shelfInfo = ` (${t.receivedItemsDetails.map((it: any) => it.shelfNo || 'Raf Belirtilmedi').join(', ')})`;
           }
           statusStyle = 'background: rgba(16, 185, 129, 0.08); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);';
           statusText = `<i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i> TESLİM EDİLDİ${shelfInfo}`;
           cardBorderColor = '#10B981';
           statusGlow = 'rgba(16, 185, 129, 0.1)';
         } else {
           statusStyle = 'background: rgba(239, 68, 68, 0.08); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.25);';
           statusText = '<i class="fa-solid fa-ban" style="margin-right: 4px;"></i> İPTAL EDİLDİ';
           cardBorderColor = '#EF4444';
           statusGlow = 'rgba(239, 68, 68, 0.1)';
         }

         const isIncoming = t.toSiteId === currentWarehouseId;
         const directionBadge = isIncoming 
           ? `<span style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-down-left"></i> GELEN</span>`
           : `<span style="background: rgba(168, 85, 247, 0.12); color: #a855f7; border: 1px solid rgba(168,85,247,0.25); font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-up-right"></i> GİDEN</span>`;

         let deliveryMethodStr = 'Klasik Transfer';
         let deliveryDetailStr = 'Bilinmiyor';
         if (t.deliveryMethod === 'PERSON') {
           deliveryMethodStr = '<i class="fa-solid fa-user-tie"></i> Personel';
           deliveryDetailStr = t.shippedBy || 'Belirtilmedi';
         } else if (t.deliveryMethod === 'CARGO') {
           deliveryMethodStr = '<i class="fa-solid fa-truck-fast"></i> Kargo';
           deliveryDetailStr = `${t.cargoCarrier || 'Kargo'} (${t.cargoTrackingNo || 'Belirtilmedi'})`;
         }

         let itemsMarkup = '';
         if (isV2) {
           itemsMarkup = t.items.map((item: any) => `
             <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.03); padding: 5px 0;">
               <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
                 <span style="font-family: monospace; font-size: 0.7rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 6px rgba(0,243,255,0.05);">${item.materialCode}</span>
                 <span>${item.materialName}</span>
               </span>
               <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 1px 8px; border-radius: 20px; box-shadow: 0 0 8px rgba(20,241,149,0.05);">${item.quantity} Adet</span>
             </div>
           `).join('');
         } else {
           itemsMarkup = `
             <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.03); padding: 5px 0;">
               <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
                 <span style="font-family: monospace; font-size: 0.7rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 6px rgba(0,243,255,0.05);">${t.materialCode}</span>
                 <span>${t.materialName}</span>
               </span>
               <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 1px 8px; border-radius: 20px; box-shadow: 0 0 8px rgba(20,241,149,0.05);">${t.quantity} Adet</span>
             </div>
           `;
         }

         const isReceiver = t.toSiteId === currentWarehouseId && (currentUser?.allowedWarehouses?.includes(t.toSiteId) || isAdmin);
         const showActions = normStatus === 'YOLDA' && isReceiver;

         const createdDateStr = t.createdAt?.toDate 
           ? t.createdAt.toDate().toLocaleString('tr-TR') 
           : (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString('tr-TR') : 'Bugün');
           
         const resolvedDateStrHTML = t.resolvedAt?.toDate 
           ? t.resolvedAt.toDate().toLocaleString('tr-TR') 
           : (t.resolvedAt?.seconds ? new Date(t.resolvedAt.seconds * 1000).toLocaleString('tr-TR') : (normStatus === 'YOLDA' ? '<span style="color: #F59E0B; font-weight:bold;">Yolda</span>' : '---'));

         return `
           <div class="glass-panel" style="padding: 1.25rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 12px; transition: all 0.3s ease; border: 1px solid rgba(255, 255, 255, 0.04); border-left: 4px solid ${cardBorderColor}; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" onmouseover="this.style.background='rgba(15, 23, 42, 0.55)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(15, 23, 42, 0.4)'; this.style.transform='none';">
             
             <!-- Header -->
             <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.6rem; margin-bottom: 0.6rem;">
               <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                 <span style="font-family: monospace; font-size: 1rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px;">${msfNo}</span>
                 ${directionBadge}
                 <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-main); background: rgba(0, 0, 0, 0.2); padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.04);">
                   <i class="fa-solid fa-warehouse" style="color: #64748B;"></i>
                   <span>${fromName}</span>
                   <i class="fa-solid fa-arrow-right-long" style="color: var(--accent-cyan); font-size: 0.75rem;"></i>
                   <i class="fa-solid fa-location-dot" style="color: #EF4444;"></i>
                   <span>${toName}</span>
                 </div>
               </div>
               
               <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                 <button onclick="window.printWarehouseMsfVoucher('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: var(--text-main); border-color: rgba(255,255,255,0.15); background: transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.color='var(--accent-cyan)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='var(--text-main)'">
                   <i class="fa-solid fa-print"></i> Yazdır
                 </button>
                 
                 ${showActions ? `
                   <button onclick="window.rejectWarehouseMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'; this.style.borderColor='#EF4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.3)'">
                     <i class="fa-solid fa-ban"></i> Reddet
                   </button>
                   <button onclick="window.approveWarehouseMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 12px; color: #10B981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); font-weight: 700; transition: all 0.2s; box-shadow: 0 0 10px rgba(16,185,129,0.05);" onmouseover="this.style.background='rgba(16,185,129,0.18)'; this.style.borderColor='#10B981'; this.style.boxShadow='0 0 15px rgba(16,185,129,0.15)';" onmouseout="this.style.background='rgba(16,185,129,0.08)'; this.style.borderColor='rgba(16, 185, 129, 0.3)'; this.style.boxShadow='0 0 10px rgba(16,185,129,0.05)'">
                     <i class="fa-solid fa-circle-check"></i> Teslim Al
                   </button>
                 ` : ''}

                 <span style="${statusStyle} font-size: 0.68rem; font-weight: 800; padding: 4px 12px; border-radius: 30px; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 8px ${statusGlow};">
                   ${statusText}
                 </span>
               </div>
             </div>

             <!-- Shipping & Metadata Grid -->
             <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 8px 12px; font-size: 0.72rem; margin-bottom: 0.75rem;">
               <div>
                 <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-user-circle"></i> TALEBİ OLUŞTURAN</span>
                 <span style="color: var(--text-main); font-weight: 600; font-family: monospace; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${t.requestedBy}">${t.requestedBy}</span>
               </div>
               <div>
                 <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-paper-plane"></i> SEVK YÖNTEMİ</span>
                 <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${deliveryMethodStr}</span>
               </div>
               <div>
                 <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-info"></i> TAŞIYICI DETAYI</span>
                 <span style="color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${deliveryDetailStr}">${deliveryDetailStr}</span>
               </div>
               <div>
                 <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-clock"></i> GÖNDERİM TARİHİ</span>
                 <span style="color: var(--text-main); font-weight: 600;">${createdDateStr}</span>
               </div>
               <div>
                 <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-check"></i> TESLİM TARİHİ</span>
                 <span style="color: var(--text-main); font-weight: 600;">${resolvedDateStrHTML}</span>
               </div>
             </div>

             <!-- Materials Section -->
             <div style="background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.02); border-radius: 8px; padding: 8px 12px;">
               <span style="font-size: 0.6rem; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;"><i class="fa-solid fa-box-open"></i> Sevk Edilen Malzemeler</span>
               <div style="font-size: 0.74rem; display: flex; flex-direction: column; gap: 3px;">
                 ${itemsMarkup}
               </div>
             </div>

             ${t.rejectionReason ? `
               <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 8px 12px; font-size: 0.72rem; color: #ef4444; margin-top: 0.6rem; display: flex; align-items: start; gap: 8px;">
                 <i class="fa-solid fa-circle-info" style="margin-top: 2px; font-size: 0.85rem;"></i>
                 <div>
                   <strong>Red/İptal Gerekçesi:</strong> ${t.rejectionReason}
                 </div>
               </div>
             ` : ''}

           </div>
         `;
       }).join('');

       // pagination controls markup
       const paginationMarkup = `
         <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.03);">
           <button onclick="window.changeWarehouseTransfersPage(-1)" class="btn-cyber-mini" ${warehouseTransfersPage === 1 ? 'disabled style="opacity: 0.5; pointer-events: none;"' : 'style="cursor: pointer;"'}>
             <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
           </button>
           <span style="font-family: 'Rajdhani', sans-serif; font-weight: bold; font-size: 0.82rem; color: #FFF; background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.02);">
             Sayfa ${warehouseTransfersPage} / ${totalPages} <span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 5px;">(Toplam: ${totalCount})</span>
           </span>
           <button onclick="window.changeWarehouseTransfersPage(1)" class="btn-cyber-mini" ${warehouseTransfersPage === totalPages ? 'disabled style="opacity: 0.5; pointer-events: none;"' : 'style="cursor: pointer;"'}>
             Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
           </button>
         </div>
       `;

       listContainer.innerHTML = cardsHtml + paginationMarkup;
     };

     (window as any).loadWarehouseTransfers = () => {
       const container = document.getElementById('warehouse-transfers-container');
       if (!container) return;

       const dirStyle = (dir: string) => {
         return warehouseTransfersDirection === dir 
           ? 'background: rgba(20, 241, 149, 0.15); color: #14F195;' 
           : 'background: transparent; color: #94A3B8;';
       };

       container.innerHTML = `
          <!-- Controls Panel (Search, Direction, Excel) -->
          <div style="display: flex; gap: 10px; margin-bottom: 1.25rem; flex-wrap: wrap; align-items: center; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 8px;">
            
            <!-- Search Input -->
            <div style="flex: 1; min-width: 220px; position: relative;">
              <input type="text" id="transfer-search-input" oninput="window.onTransferSearchInput()" value="${warehouseTransfersSearchQuery}" placeholder="SAP No, Malzeme, Depo veya MSF No Ara..." style="width: 100%; box-sizing: border-box; padding: 6px 10px 6px 30px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.8rem;"></i>
            </div>

            <!-- Direction Selector -->
            <div style="display: flex; background: #0A0E17; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 2px;">
              <button onclick="window.setTransferDirection('ALL')" id="btn-dir-all" style="font-size: 0.72rem; border: none; border-radius: 4px; padding: 4px 10px; ${dirStyle('ALL')} font-family: 'Rajdhani', sans-serif; font-weight: bold; cursor: pointer; transition: all 0.2s;">Tümü</button>
              <button onclick="window.setTransferDirection('INCOMING')" id="btn-dir-in" style="font-size: 0.72rem; border: none; border-radius: 4px; padding: 4px 10px; ${dirStyle('INCOMING')} font-family: 'Rajdhani', sans-serif; font-weight: bold; cursor: pointer; transition: all 0.2s;">Gelenler</button>
              <button onclick="window.setTransferDirection('OUTGOING')" id="btn-dir-out" style="font-size: 0.72rem; border: none; border-radius: 4px; padding: 4px 10px; ${dirStyle('OUTGOING')} font-family: 'Rajdhani', sans-serif; font-weight: bold; cursor: pointer; transition: all 0.2s;">Gidenler</button>
            </div>

            <!-- Excel Export Button -->
            <button onclick="window.exportTransfersListToExcel()" class="btn-cyber-mini" style="font-size: 0.75rem; padding: 6px 12px; color: #10B981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); font-weight: bold; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-file-excel"></i> Excel İndir
            </button>

          </div>

          <div id="warehouse-transfers-cards-list">
            <div style="color: var(--accent-cyan); text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Transferler Listeleniyor...</div>
          </div>
       `;

       if (!(window as any)._warehousesMap) {
         (window as any)._warehousesMap = {};
         const allWh = dataService.getWarehouses();
         allWh.forEach((w: any) => { (window as any)._warehousesMap[w.id] = w.name; });
         for (let i = 1; i <= 15; i++) {
           const tName = `Team \${String(i).padStart(2, '0')}`;
           const tId = `team_\${tName.replace(/\\s+/g, '_')}`;
           (window as any)._warehousesMap[tId] = `\${tName} Deposu`;
         }
       }

       import('../firebase').then(({ db }) => {
          import('firebase/firestore').then(({ collection, query, orderBy, onSnapshot }) => {
             const q = query(collection(db, 'transfers'), orderBy('createdAt', 'desc'));
             
             if ((window as any)._warehouseTransfersUnsubscribe) {
               (window as any)._warehouseTransfersUnsubscribe();
             }

             (window as any)._warehouseTransfersUnsubscribe = onSnapshot(q, (snapshot) => {
               const allTransfers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
               cachedWarehouseTransfers = allTransfers.filter((t: any) => 
                 t.fromSiteId === currentWarehouse.id || t.toSiteId === currentWarehouse.id
               );
               (window as any).renderWarehouseTransfersList();
             });
          });
       });
     };


     (window as any).approveWarehouseMsfTransfer = async (transferId: string) => {
       const adminEmail = ((window as any).currentUser || (window as any).appState?.userProfile)?.email || 'Admin';
       
       try {
         const { db } = await import('../firebase');
         const { doc, getDoc } = await import('firebase/firestore');
         const { transferService } = await import('../services/TransferService');
         
         const docRef = doc(db, 'transfers', transferId);
         const docSnap = await getDoc(docRef);
         if (!docSnap.exists()) {
           alert("Transfer kaydı bulunamadı!");
           return;
         }
         
         const transfer = docSnap.data();
         const items = Array.isArray(transfer.items) 
           ? transfer.items 
           : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

         // Create the modal element
         const modal = document.createElement('div');
         modal.id = 'approve-transfer-modal';
         modal.style.position = 'fixed';
         modal.style.inset = '0';
         modal.style.backgroundColor = 'rgba(0,0,0,0.6)';
         modal.style.backdropFilter = 'blur(4px)';
         modal.style.display = 'flex';
         modal.style.alignItems = 'center';
         modal.style.justifyContent = 'center';
         modal.style.zIndex = '10000';
         modal.style.fontFamily = "'Rajdhani', sans-serif";

         // Build items rows
         const currentInventory = (window as any).currentInventoryData || [];
         const itemsHtml = items.map((item: any) => {
           const invItem = currentInventory.find((i: any) => i.sapNo === item.materialCode);
           const existingShelf = invItem ? (invItem.shelfNo || 'Tanımsız') : 'Tanımsız';
           
           return `
             <div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 10px; display: flex; flex-direction: column; gap: 8px;">
               <div style="display: flex; justify-content: space-between; align-items: start;">
                 <span style="color: #FFF; font-weight: 700; font-size: 0.8rem;">
                   ${item.materialName}
                   <span style="font-family: monospace; font-size: 0.7rem; color: #60A5FA; background: rgba(59,130,246,0.1); border: 1px solid rgba(59,130,246,0.2); padding: 1px 4px; border-radius: 3px; margin-left: 4px;">${item.materialCode}</span>
                 </span>
                 <span style="color: var(--accent-cyan); font-weight: 800; font-family: monospace; font-size: 0.8rem;">${item.quantity} Adet</span>
               </div>
               
               <div style="display: flex; gap: 10px; align-items: center;">
                 <div style="flex: 1;">
                   <label style="font-size: 0.65rem; color: #94A3B8; display: block; font-weight: bold; margin-bottom: 2px;">RAF SEÇİMİ</label>
                   <input type="text" id="modal-shelf-${item.materialCode}" value="${existingShelf}" placeholder="Örn: B-1, D-2" style="width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 4px; border: 1px solid #1E293B; background: #0A0E17; color: #FFF; font-family: monospace; font-size: 0.75rem;">
                 </div>
                 <div style="flex: 1;">
                   <label style="font-size: 0.65rem; color: #94A3B8; display: block; font-weight: bold; margin-bottom: 2px;">MALZEME DURUMU</label>
                   <select id="modal-cond-${item.materialCode}" style="width: 100%; box-sizing: border-box; padding: 5px 8px; border-radius: 4px; border: 1px solid #1E293B; background: #0A0E17; color: #FFF; font-size: 0.75rem; font-weight: bold; cursor: pointer;">
                     <option value="NEW" selected>Kusursuz (Yeni)</option>
                     <option value="DEFECT">Hasarlı / Defect</option>
                     <option value="REVISED">Revize Edilmiş</option>
                     <option value="SCRAP">Hurda (Scrap)</option>
                   </select>
                 </div>
               </div>
             </div>
           `;
         }).join('');

         modal.innerHTML = `
           <div class="glass-panel" style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 480px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
             
             <!-- Header -->
             <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
               <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: var(--accent-cyan); display: flex; align-items: center; gap: 6px;">
                 <i class="fa-solid fa-circle-check"></i> MALZEME TESLİM KABULÜ
               </div>
               <button id="modal-close-btn" style="background: transparent; border: none; color: #64748B; cursor: pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'">&times;</button>
             </div>

             <!-- Description -->
             <p style="font-size: 0.78rem; color: #94A3B8; margin-top: 0; margin-bottom: 1rem; line-height: 1.45;">
               Malzemeleri depoya kabul etmek için lütfen raflarını ve kondisyon durumlarını seçin. Kusursuz gelenler için <strong>Kusursuz (Yeni)</strong> seçeneğini bırakabilirsiniz.
             </p>

             <!-- Items List Container -->
             <div style="display: flex; flex-direction: column; gap: 10px; max-height: 280px; overflow-y: auto; padding-right: 4px; margin-bottom: 1.5rem;">
               ${itemsHtml}
             </div>

             <!-- Footer Actions -->
             <div style="display: flex; justify-content: flex-end; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.75rem;">
               <button id="modal-cancel-btn" class="btn-cyber-mini" style="font-size: 0.75rem; padding: 6px 15px; color: #94A3B8; border-color: rgba(255,255,255,0.1); background: transparent;">
                 İptal Et
               </button>
               <button id="modal-submit-btn" class="btn-cyber-mini" style="font-size: 0.75rem; padding: 6px 20px; color: #10B981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); font-weight: bold; box-shadow: 0 0 10px rgba(16,185,129,0.05);">
                 Onayla ve Teslim Al
               </button>
             </div>

           </div>
         `;

         document.body.appendChild(modal);

         // Add Event Listeners
         const closeModal = () => {
           document.body.removeChild(modal);
         };

         modal.querySelector('#modal-close-btn')?.addEventListener('click', closeModal);
         modal.querySelector('#modal-cancel-btn')?.addEventListener('click', closeModal);

         modal.querySelector('#modal-submit-btn')?.addEventListener('click', async () => {
           const submitBtn = modal.querySelector('#modal-submit-btn');
           if (submitBtn) (submitBtn as any).disabled = true;

           const itemDetails = items.map((item: any) => {
             const shelfInput = modal.querySelector(`#modal-shelf-${item.materialCode}`);
             const condSelect = modal.querySelector(`#modal-cond-${item.materialCode}`);
             return {
               materialCode: item.materialCode,
               shelfNo: shelfInput ? (shelfInput as any).value.trim() || 'Tanımsız' : 'Tanımsız',
               condition: condSelect ? (condSelect as any).value : 'NEW'
             };
           });

           try {
             await transferService.approveMultiItemTransfer(transferId, adminEmail, itemDetails);
             closeModal();
             alert("✅ Sevk başarıyla teslim alındı ve belirtilen raflara yerleştirilerek stoğa girildi!");
             if ((window as any).renderInventoryTable) (window as any).renderInventoryTable();
           } catch (err) {
             alert("Kabul işlemi sırasında hata oluştu: " + (err as any).message);
             if (submitBtn) (submitBtn as any).disabled = false;
           }
         });

       } catch (err) {
         alert("Hata: " + (err as any).message);
       }
     };

     (window as any).rejectWarehouseMsfTransfer = async (transferId: string) => {
       const reason = prompt("Sevk talebini reddetme / iptal etme gerekçesini giriniz:\n(İptal edildiğinde tüm stoklar çıkış deposuna geri iade edilecektir.)");
       if (reason === null) return;
       if (!reason.trim()) {
         alert("Lütfen gerekçe belirtin!");
         return;
       }
       const adminEmail = ((window as any).currentUser || (window as any).appState?.userProfile)?.email || 'Admin';
       try {
         const { transferService } = await import('../services/TransferService');
         await transferService.rejectMultiItemTransfer(transferId, adminEmail, reason);
         alert("❌ Sevk iptal edildi.");
       } catch (err: any) {
         alert("Hata: " + err.message);
       }
     };

     (window as any).printWarehouseMsfVoucher = (transferId: string) => {
       getDoc(doc(db, 'transfers', transferId)).then((docSnap: any) => {
          if (!docSnap.exists()) return;
          const transfer = { id: docSnap.id, ...docSnap.data() };
          
          const msfNo = transfer.msfNo || `TRF-${transfer.id?.substring(0, 8).toUpperCase()}`;
          const fromName = (window as any)._warehousesMap[transfer.fromSiteId] || transfer.fromSiteId;
          const toName = (window as any)._warehousesMap[transfer.toSiteId] || transfer.toSiteId;
          const dateStr = transfer.createdAt?.toDate ? transfer.createdAt.toDate().toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR');
          
          let deliveryDetails = '';
          if (transfer.deliveryMethod === 'PERSON') {
            deliveryDetails = `<strong>Teslimat Tipi:</strong> Personel ile<br><strong>Taşıyan Kişi:</strong> ${transfer.shippedBy || 'Belirtilmedi'}`;
          } else if (transfer.deliveryMethod === 'CARGO') {
            deliveryDetails = `<strong>Teslimat Tipi:</strong> Kargo ile gönderildi<br><strong>Kargo Firması:</strong> ${transfer.cargoCarrier || 'Belirtilmedi'}<br><strong>Takip / Fatura No:</strong> ${transfer.cargoTrackingNo || 'Belirtilmedi'}`;
          } else {
            deliveryDetails = `<strong>Teslimat Tipi:</strong> Depolar Arası Klasik Transfer`;
          }

          if (transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') {
            const resolvedDateStr = transfer.resolvedAt?.toDate 
              ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') 
              : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : 'Belirtilmedi');
            const receiver = transfer.resolvedBy || transfer.approvedBy || 'Belirtilmedi';
            deliveryDetails += `<br><br><span style="color:#10b981; font-weight:bold;">🟢 TESLİM EDİLDİ</span><br><strong>Teslim Tarihi:</strong> ${resolvedDateStr}<br><strong>Teslim Alan:</strong> ${receiver}`;
          }

          const items = Array.isArray(transfer.items) 
            ? transfer.items 
            : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

          const tableRows = items.map((it: any, idx: number) => `
            <tr>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
              <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${it.materialCode}</td>
              <td style="border: 1px solid #000; padding: 6px;">${it.materialName}</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${it.quantity}</td>
              <td style="border: 1px solid #000; padding: 6px; text-align: center;">Adet</td>
            </tr>
          `).join('');

          const printWindow = window.open('', '_blank');
          if (!printWindow) return;

          printWindow.document.write(`
            <html>
              <head>
                <title>Malzeme Sevk Formu - ${msfNo}</title>
                <style>
                  body { font-family: 'Segoe UI', Arial, sans-serif; margin: 20px; color: #000; background: #fff; font-size: 12px; }
                  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
                  .logo { font-size: 20px; font-weight: bold; letter-spacing: 1px; }
                  .title { text-align: right; }
                  .title h1 { margin: 0; font-size: 18px; font-weight: 800; }
                  .title span { font-size: 12px; color: #555; }
                  .meta-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
                  .meta-table td { padding: 4px 0; vertical-align: top; }
                  .items-table { width: 100%; border-collapse: collapse; margin-top: 15px; margin-bottom: 30px; }
                  .items-table th { border: 1px solid #000; background-color: #f2f2f2; padding: 8px; text-align: left; font-weight: bold; }
                  .signatures { margin-top: 50px; display: flex; justify-content: space-between; }
                  .signature-box { width: 30%; text-align: center; border-top: 1px dashed #000; padding-top: 10px; }
                  @media print { body { margin: 10px; } .no-print { display: none; } }
                </style>
              </head>
              <body>
                <div class="no-print" style="margin-bottom: 20px; background: #e5e7eb; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
                  <span style="color:#374151; font-weight: bold;">MSF Yazdırma Önizleme</span>
                  <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding: 6px 15px; border-radius: 4px; font-weight:bold; cursor:pointer;">Yazdır / PDF Kaydet</button>
                </div>
                <div class="header">
                  <div class="logo">DEMİRER <span style="font-weight: 300;">HOLDİNG</span></div>
                  <div class="title">
                    <h1>MALZEME SEVK FORMU (MSF)</h1>
                    <span style="font-family: monospace; font-weight: bold; font-size: 13px;">No: ${msfNo}</span>
                  </div>
                </div>
                <table class="meta-table">
                  <tr>
                    <td style="width: 50%;">
                      <strong>ÇIKIŞ DEPOSU (SEVK EDEN):</strong><br>${fromName}<br><br>
                      <strong>VARIŞ DEPOSU (SEVK EDİLEN):</strong><br>${toName}
                    </td>
                    <td style="width: 50%; text-align: right;">
                      <strong>Sevk Tarihi:</strong> ${dateStr}<br>
                      <strong>Oluşturan / Sevk Eden:</strong> ${transfer.requestedBy}<br><br>
                      ${deliveryDetails}
                    </td>
                  </tr>
                </table>
                <h3 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px;">Sevk Edilen Malzeme Listesi</h3>
                <table class="items-table">
                  <thead>
                    <tr>
                      <th style="width: 5%; text-align: center;">S.No</th>
                      <th style="width: 25%;">SAP No / Kod</th>
                      <th style="width: 50%;">Malzeme Açıklaması / Adı</th>
                      <th style="width: 10%; text-align: center;">Miktar</th>
                      <th style="width: 10%; text-align: center;">Birim</th>
                    </tr>
                  </thead>
                  <tbody>${tableRows}</tbody>
                </table>
                <div style="font-size: 11px; margin-top: 40px; border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
                  <strong>Sevk Açıklaması:</strong> Bu belge ile yukarıda dökümü yapılan malzemelerin çıkış deposundan sevk edildiği, alıcı deponun malzemeleri eksiksiz teslim alıp stoğa işlemesi gerektiği beyan edilir.
                </div>
                <div class="signatures">
                  <div class="signature-box">
                    <strong>Teslim Eden (Sevk Eden)</strong><br><br>
                    <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.requestedBy || ''}</span><br>
                    <span style="font-size: 10px; color: #555;">Tarih: ${dateStr}</span>
                  </div>
                  <div class="signature-box">
                    <strong>Taşıyan Personel / Kargo</strong><br><br>
                    ${transfer.deliveryMethod === 'PERSON' && transfer.shippedBy ? `
                      <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.shippedBy}</span>
                    ` : (transfer.deliveryMethod === 'CARGO' && transfer.cargoCarrier ? `
                      <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.cargoCarrier}</span><br>
                      <span style="font-size: 10px; color: #555;">Takip No: ${transfer.cargoTrackingNo || ''}</span>
                    ` : 'İmza / Tarih')}
                  </div>
                  <div class="signature-box">
                    <strong>Teslim Alan (Kabul Eden)</strong><br><br>
                    ${(transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') ? `
                      <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.resolvedBy || transfer.approvedBy || ''}</span><br>
                      <span style="font-size: 10px; color: #555;">Tarih: ${transfer.resolvedAt?.toDate ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : '')}</span>
                    ` : 'İmza / Tarih'}
                  </div>
                </div>
              </body>
            </html>
          `);
          printWindow.document.close();
       });
     };


     (window as any).switchTab = async (tabName: string, id: string) => {
       const tabs = ['tab-ENVANTER', 'tab-ANALİZ', 'tab-SAYIM', 'tab-SAYIM_GECMISI', 'tab-DEPO_HAREKETLERI', 'tab-DEFECT', 'tab-TRANSFERLER'];
      const views = ['view-ENVANTER', 'view-ANALİZ', 'view-SAYIM', 'view-SAYIM_GECMISI', 'view-DEPO_HAREKETLERI', 'view-DEFECT', 'view-TRANSFERLER'];
      
      tabs.forEach(t => {
        const el = document.getElementById(t);
        if (el) {
          if (t === id) {
            el.dataset.active = 'true';
            el.style.color = '#14F195';
            el.style.border = '1px solid #14F195';
          } else {
            el.dataset.active = 'false';
            el.style.color = '#94A3B8';
            el.style.border = '1px solid transparent';
          }
        }
      });

      views.forEach(v => {
        const el = document.getElementById(v);
        if (el) {
          if (v === 'view-' + tabName) {
            el.style.display = 'block';
          } else {
            el.style.display = 'none';
          }
        }
      });
      
      const actionBar = document.getElementById('inventory-action-bar');
      if (actionBar) {
        actionBar.style.display = (tabName === 'ENVANTER') ? 'flex' : 'none';
      }

      (window as any).currentWarehouseTab = tabName === 'ENVANTER' ? 'INVENTORY' : tabName;

      if (tabName === 'SAYIM') {
         if ((window as any).renderManualAuditTable) {
           (window as any).renderManualAuditTable();
         }
         if ((window as any).updateManualSummaryBar) {
           (window as any).updateManualSummaryBar();
         }
      }

      if (tabName === 'ENVANTER') {
         if ((window as any).renderInventoryTable) {
           (window as any).renderInventoryTable();
         }
      }

      if (tabName === 'TRANSFERLER') {
         if ((window as any).loadWarehouseTransfers) {
            (window as any).loadWarehouseTransfers();
         }
      }

      if (tabName === 'DEPO_HAREKETLERI') {
         const searchInput = document.getElementById('depo-hareketleri-search') as HTMLInputElement;
         if (searchInput) {
           searchInput.value = '';
         }
         if (typeof (window as any).loadDepoHareketleriLogs === 'function') {
           (window as any).loadDepoHareketleriLogs();
         }
      }

      if (tabName === 'SAYIM_GECMISI') {
         if (typeof (window as any).loadSayimGecmisi === 'function') {
           (window as any).loadSayimGecmisi();
         }
      }

      // Fetch audit history if needed
      if (false && tabName === 'SAYIM_GECMISI') {
          const container = document.getElementById('audit-history-container') as any;
          if (container) {
            container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
            try {
              const audits = await warehouseService.getAuditHistory((currentWarehouse as any).id);
              (window as any).__cachedAudits = audits;
              if (audits.length === 0) {
                container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Henüz sayım geçmişi bulunmuyor.</div>';
              } else {
                container.innerHTML = audits.map(audit => {
                  const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
                  const diffColor = audit.totalDiff < 0 ? '#EF4444' : (audit.totalDiff > 0 ? '#F59E0B' : '#14F195');
                  const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
                  
                  const sortedResults = [...audit.results].map(r => {
                     let shelfNo = r.shelfNo || '';
                     if (!shelfNo && (window as any).currentInventoryData) {
                       const invItem = (window as any).currentInventoryData.find((i: any) => i.sapNo === r.sapNo || (i.sapNo === '' && i.name === r.description));
                       if (invItem) shelfNo = invItem.shelfNo || '';
                     }
                     return { ...r, calculatedShelfNo: shelfNo };
                  }).sort((a, b) => {
                     const locA = String(a.calculatedShelfNo || '').trim().toUpperCase();
                     const locB = String(b.calculatedShelfNo || '').trim().toUpperCase();
                     if (!locA && locB) return 1;
                     if (locA && !locB) return -1;
                     let locCmp = 0;
                     if (locA && locB) {
                         locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
                     }
                     if (locCmp !== 0) return locCmp;
                     const sapA = String(a.sapNo || '').trim();
                     const sapB = String(b.sapNo || '').trim();
                     if (sapA && sapB) {
                         const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
                         if (sapCmp !== 0) return sapCmp;
                     }
                     return String(a.description || '').localeCompare(String(b.description || ''));
                  });

                  const resultsHtml = sortedResults.map(r => {
                     const isDiff = r.diff !== 0;
                     const rColor = r.diff < 0 ? '#EF4444' : (r.diff > 0 ? '#F59E0B' : '#14F195');
                     const shelfNo = r.calculatedShelfNo || '---';

                     return `
                       <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-size: 0.85rem; align-items: center;">
                         <span style="color: #E2E8F0; width: 35%; display: flex; align-items: center; gap: 0.5rem; min-width: 0;">
                            <span style="background-color: rgba(59, 130, 246, 0.15); color: #60A5FA; padding: 0.2rem 0; width: 95px; display: inline-flex; justify-content: center; align-items: center; flex-shrink: 0; border-radius: 4px; font-size: 0.75rem; font-weight: 600; white-space: nowrap; border: 1px solid rgba(59, 130, 246, 0.3);">SAP: ${r.sapNo || '-'}</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.description}">${r.description}</span>
                         </span>
                         <span style="color: #10B981; font-weight: 600; width: 15%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"><i class="fa-solid fa-box" style="margin-right: 0.3rem; opacity: 0.7;"></i>Raf: ${shelfNo}</span>
                         <span style="color: #94A3B8; width: 12%;">Sys: ${r.systemQty}</span>
                         <span style="color: #94A3B8; width: 12%;">Fizik: ${r.physicalQty}</span>
                         <span style="color: ${rColor}; font-weight: 600; width: 11%;">Fark: ${r.diff > 0 ? '+'+r.diff : r.diff}</span>
                         <span style="color: #64748B; width: 15%; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${r.note || 'Sayılan Uyumlu'}">${r.note || 'Sayılan Uyumlu'}</span>
                       </div>
                     `;
                  }).join('');

                  return `
                    <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 8px; margin-bottom: 1rem; overflow: hidden;">
                      <div onclick="window.toggleAuditCollapse(this)" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; cursor: pointer; background-color: #0F172A; border-bottom: 1px solid #1E293B; transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#0F172A'">
                        <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                          <span style="font-weight: 600; color: #FFFFFF; font-size: 0.95rem;"><i class="fa-solid fa-calendar-day" style="color: #3B82F6; margin-right: 0.5rem;"></i>${date}</span>
                          <span style="color: #94A3B8; font-size: 0.8rem;"><i class="fa-solid fa-user" style="margin-right: 0.3rem;"></i>${audit.user}</span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem; height: 32px;">
                          <div style="display: flex; flex-direction: column; text-align: right; justify-content: center; gap: 2px; line-height: 1.1;">
                            <span style="font-weight: 600; color: #E2E8F0; font-size: 0.8rem;">Kalem: <strong style="color: #FFF;">${audit.totalItems}</strong></span>
                            <span style="font-weight: 600; color: ${diffColor}; font-size: 0.8rem;">Fark: <strong>${totalDiffText}</strong></span>
                          </div>
                          ${audit.imported ? `
                              <button disabled style="background-color: rgba(16, 185, 129, 0.12); border: 1px solid #10B981; color: #10B981; padding: 0 0.8rem; height: 32px; border-radius: 6px; cursor: default; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; box-sizing: border-box;">
                                <i class="fa-solid fa-circle-check"></i> Aktarıldı
                              </button>
                            ` : `
                              <button onclick="event.stopPropagation(); window.importAuditToInventory('${audit.id}')" style="background-color: rgba(59, 130, 246, 0.1); border: 1px solid #3B82F6; color: #3B82F6; padding: 0 0.8rem; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s; box-sizing: border-box;" onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.1)'; this.style.color='#3B82F6'">
                                <i class="fa-solid fa-file-import"></i> Aktar
                              </button>
                            `}
                          <button onclick="event.stopPropagation(); window.downloadSingleAuditExcel('${audit.id}')" style="background-color: rgba(16, 185, 129, 0.1); border: 1px solid #10B981; color: #10B981; padding: 0 0.8rem; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s; box-sizing: border-box;" onmouseover="this.style.backgroundColor='#10B981'; this.style.color='#0A0E17'" onmouseout="this.style.backgroundColor='rgba(16, 185, 129, 0.1)'; this.style.color='#10B981'">
                            <i class="fa-solid fa-file-excel"></i> Excel
                          </button>
                          ${isMaterialManager ? `
                            <button onclick="event.stopPropagation(); window.deleteAuditRecord('${audit.id}')" style="background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; color: #EF4444; padding: 0 0.8rem; height: 32px; border-radius: 6px; cursor: pointer; font-size: 0.8rem; font-weight: 600; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; transition: all 0.2s; box-sizing: border-box;" onmouseover="this.style.backgroundColor='#EF4444'; this.style.color='#FFF'" onmouseout="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'; this.style.color='#EF4444'">
                              <i class="fa-solid fa-trash"></i> Sil
                            </button>
                          ` : ''}
                          <div style="width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; background-color: #1E293B; border-radius: 6px; box-sizing: border-box;">
                            <i class="fa-solid fa-chevron-down" style="color: #94A3B8; font-size: 0.8rem; transition: transform 0.2s;"></i>
                          </div>
                        </div>
                      </div>
                      <div style="display: none; padding: 1rem; max-height: 400px; overflow-y: auto; background-color: #0A0E17;">
                         ${resultsHtml}
                       </div>
                    </div>
                  `;
                }).join('');
              }
            } catch(e) {
              console.error(e);
              container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu.</div>';
            }
          }
       }
    };

    (window as any).updateManualSummaryBar = () => {
      let totalCounted = 0;
      let matched = 0;
      let surplus = 0;
      let deficit = 0;

      Object.keys(draftData).forEach((itemId) => {
        const item = inventoryItems.find(i => i.id === itemId);
        if (!item) return;

        const draftItem = draftData[itemId];
        if (draftItem && draftItem.qty !== '') {
          totalCounted++;
          const physicalQty = parseFloat(draftItem.qty);
          const systemQty = item.quantity;
          const diff = physicalQty - systemQty;
          
          if (diff === 0) matched++;
          else if (diff > 0) surplus++;
          else if (diff < 0) deficit++;
        }
      });

      const bar = document.getElementById('manual-summary-bar');
      if (bar) {
        if (totalCounted > 0) {
          bar.innerHTML = `
            <span style="color: #94A3B8; font-weight: 500; margin-right: 1rem;"><i class="fa-solid fa-list-check"></i> ${totalCounted} Ürün Sayıldı</span>
            <span style="color: #14F195; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-check"></i> ${matched} Uyumlu</span>
            <span style="color: #F59E0B; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-arrow-trend-up"></i> ${surplus} Fazla</span>
            <span style="color: #EF4444; font-weight: 600;"><i class="fa-solid fa-arrow-trend-down"></i> ${deficit} Eksik</span>
          `;
          bar.style.display = 'flex';
        } else {
          bar.style.display = 'none';
        }
      }
    };

    (window as any).saveManualAudit = async (btn: HTMLButtonElement) => {
      const manualResults: any[] = [];
      const shelfUpdates: any[] = [];
      let hasError = false;
      let firstErrorItemId = '';

      const auditInventoryItems = currentWarehouse.id === 'MTA'
        ? inventoryItems
        : inventoryItems.filter(item => item.condition !== 'DEFECT');

      const sortedItems = [...auditInventoryItems].sort((a, b) => {
         const locA = String(a.shelfNo || '').trim().toUpperCase();
         const locB = String(b.shelfNo || '').trim().toUpperCase();
         if (!locA && locB) return 1;
         if (locA && !locB) return -1;
         let locCmp = 0;
         if (locA && locB) {
             locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
         }
         if (locCmp !== 0) return locCmp;
         const sapA = String(a.sapNo || '').trim();
         const sapB = String(b.sapNo || '').trim();
         if (sapA && sapB) {
             const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
             if (sapCmp !== 0) return sapCmp;
         }
         return String(a.name || '').localeCompare(String(b.name || ''));
      });

      const searchInput = document.getElementById('manual-audit-search') as HTMLInputElement;
      const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
      const filteredItems = sortedItems.filter(item => {
         const sap = String(item.sapNo || '').toLowerCase();
         const name = String(item.name || '').toLowerCase();
         return term === '' || sap.includes(term) || name.includes(term);
      });

      for (const item of auditInventoryItems) {
        const itemId = item.id;
        const sapNo = item.sapNo;
        const name = item.name;
        const systemQty = item.quantity;

        const draftItem = draftData[itemId];
        const shelfVal = draftItem?.shelf !== undefined ? draftItem.shelf.trim() : (item.shelfNo || '').trim();
        const originalShelf = (item.shelfNo || '').trim();

        if (shelfVal !== originalShelf) {
           shelfUpdates.push({ itemId, shelfNo: shelfVal });
        }

        if (draftItem && draftItem.qty !== '') {
          const physicalQty = parseFloat(draftItem.qty);
          const diff = physicalQty - systemQty;

          if (diff !== 0) {
            const noteVal = (draftItem.note || '').trim();
            if (!noteVal) {
              hasError = true;
              if (!firstErrorItemId) {
                firstErrorItemId = itemId;
              }
            } else {
              manualResults.push({
                itemId, sapNo, description: name, systemQty, physicalQty, diff, note: noteVal, shelfNo: shelfVal
              });
            }
          } else {
            manualResults.push({
               itemId, sapNo, description: name, systemQty, physicalQty, diff, note: 'Sayım Uyumlu', shelfNo: shelfVal
            });
          }
        }
      }

      if (hasError && firstErrorItemId) {
        const idx = filteredItems.findIndex(i => i.id === firstErrorItemId);
        if (idx !== -1) {
          const page = Math.floor(idx / (window as any).itemsPerPage) + 1;
          if((window as any).changeManualAuditPage) {
            (window as any).changeManualAuditPage(page);
          }
          
          setTimeout(() => {
            const errNote = document.getElementById('manual-note-' + firstErrorItemId);
            if (errNote) {
              errNote.style.border = '2px solid #EF4444';
              errNote.focus();
            }
          }, 100);
        }
        alert('Lütfen stoğu değişen ürünler için zorunlu fark açıklamasını (not) doldurun.');
        return;
      }

      if (manualResults.length === 0 && shelfUpdates.length === 0) {
        alert('Herhangi bir sayım girişi veya konum değişikliği yapılmadı.');
        return;
      }

      let confirmMessage = '';
      if (manualResults.length > 0 && shelfUpdates.length > 0) {
          confirmMessage = `${manualResults.length} adet malzemenin sayım sonucunu ve ${shelfUpdates.length} adet konum değişikliğini kaydetmek istediğinize emin misiniz?`;
      } else if (manualResults.length > 0) {
          confirmMessage = `${manualResults.length} adet malzemenin sayım sonucunu kaydetmek istediğinize emin misiniz?`;
      } else {
          confirmMessage = `${shelfUpdates.length} adet konum değişikliğini kaydetmek istediğinize emin misiniz?`;
      }

      if (!confirm(confirmMessage)) return;

      const startTime = localStorage.getItem(`draft_audit_start_time_${currentWarehouse.id}`) || new Date().toISOString();
      const endTime = new Date().toISOString();

      const originalText = btn.innerText;
      btn.innerText = 'Kaydediliyor...';
      btn.disabled = true;

      try {
        if (manualResults.length > 0) {
            const totalDiff = manualResults.reduce((sum: number, r: any) => sum + r.diff, 0);
            const userProfile = getUserProfile();
            const displayName = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
            const user = userProfile?.team ? `${displayName} (${userProfile.team})` : displayName;
            
            await warehouseService.saveAudit(currentWarehouse.id, {
              user: user,
              totalItems: manualResults.length,
              totalDiff: totalDiff,
              results: manualResults,
              startTime: startTime,
              endTime: endTime
            });
        }

        if (shelfUpdates.length > 0) {
            await Promise.all(
              shelfUpdates.map(update =>
                warehouseService.updateMaterial(currentWarehouse.id, update.itemId, { shelfNo: update.shelfNo })
              )
            );
        }

        // Clear Firestore draft audit document
        try {
          const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
          await deleteDoc(draftDocRef);
        } catch (e) {
          console.error("Failed to clear Firestore draft on save:", e);
        }

        localStorage.removeItem(`draft_audit_${currentWarehouse.id}`);
        localStorage.removeItem(`draft_audit_start_time_${currentWarehouse.id}`);

        alert('Değişiklikler başarıyla kaydedildi!');
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Kaydedilirken hata oluştu.');
        btn.innerText = originalText;
        btn.disabled = false;
      }
    };

    (window as any).openSendToRepairModal = async (itemId: string, sapNo: string, description: string, maxQty: number, serialNo: string = '-', faultCode: string = '-', faultDesc: string = '-') => {
      const modal = document.createElement('div');
      modal.id = 'send-repair-modal';
      modal.className = 'modal-overlay';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
        z-index: 10002; display: flex; align-items: center; justify-content: center;
      `;

      modal.innerHTML = `
        <div class="glass-panel fade-in-up" style="width: 100%; max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
            <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
              <i class="fa-solid fa-screwdriver-wrench" style="margin-right:8px;"></i> TAMİRE SEVK ET
            </h3>
            <button onclick="document.getElementById('send-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div style="margin-bottom:1.25rem;">
            <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
              <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
              <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Seri No: ${serialNo} | Maksimum Sevk: ${maxQty} Adet</span>
              ${faultCode !== '-' ? `<div style="font-size:0.75rem; color:#F59E0B; margin-top:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Arıza Kodu: ${faultCode}</div>` : ''}
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1.25rem;">
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Sevk Miktarı</label>
            <input type="number" id="send-repair-qty" class="cyber-input" value="${maxQty}" min="1" max="${maxQty}" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
          </div>

          <div class="form-group" style="margin-bottom:1.5rem;">
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Tamir İstasyonu</label>
            <select id="send-repair-workshop" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
              <option value="Merkez Tamir Atölyesi">Merkez Tamir Atölyesi</option>
            </select>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
            <button onclick="document.getElementById('send-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
            <button id="confirm-send-repair-btn" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">GÖNDER</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const confirmBtn = document.getElementById('confirm-send-repair-btn');
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const qtyInput = document.getElementById('send-repair-qty') as HTMLInputElement;
          const workshopSelect = document.getElementById('send-repair-workshop') as HTMLSelectElement;
          const qty = parseInt(qtyInput?.value || '0', 10);
          
          if (isNaN(qty) || qty <= 0 || qty > maxQty) {
            alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
            return;
          }

          confirmBtn.setAttribute('disabled', 'true');
          confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Gönderiliyor...';

          try {
            const { repairService } = await import('../services/RepairService');
            const currentUser = (window as any).currentUser;
            const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

            // 1. Create Repair Record
            await repairService.createRepair({
              sapNo,
              serialNo,
              description,
              quantity: qty,
              sourceWarehouseId: currentWarehouse.id,
              workshopId: workshopSelect.value,
              sentBy: userEmail,
              faultCode,
              faultDesc
            });

            // 2. Deduct DEFECT stock from current warehouse
            await warehouseService.updateStockBySap(
              currentWarehouse.id,
              sapNo,
              -qty,
              {
                user: userEmail,
                reason: `Tamir atölyesine sevk edildi (${workshopSelect.value})`
              },
              'DEFECT'
            );



            (window as any).showToast('Başarılı', 'Malzeme tamir atölyesine başarıyla sevk edildi.', 'success');
            modal.remove();
            
            // Reload warehouse view
            if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
            }
          } catch (e) {
            console.error(e);
            alert('Tamire gönderim esnasında hata oluştu.');
            confirmBtn.removeAttribute('disabled');
            confirmBtn.innerHTML = 'GÖNDER';
          }
        };
      }
    };

    (window as any).scrapDefectiveItem = async (itemId: string, sapNo: string, description: string, maxQty: number) => {
      const modal = document.createElement('div');
      modal.id = 'scrap-defect-modal';
      modal.className = 'modal-overlay';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
        z-index: 10002; display: flex; align-items: center; justify-content: center;
      `;

      modal.innerHTML = `
        <div class="glass-panel fade-in-up" style="width: 100%; max-width: 450px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
            <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px;">
              <i class="fa-solid fa-dumpster" style="margin-right:8px;"></i> HURDAYA AYIR
            </h3>
            <button onclick="document.getElementById('scrap-defect-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div style="margin-bottom:1.25rem;">
            <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
            <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
              <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
              <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Maksimum Hurda: ${maxQty} Adet</span>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:1.25rem;">
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Miktar</label>
            <input type="number" id="scrap-qty" class="cyber-input" value="${maxQty}" min="1" max="${maxQty}" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4);">
          </div>

          <div class="form-group" style="margin-bottom:1.5rem;">
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">Gerekçe / Hurda Notu</label>
            <textarea id="scrap-note" class="cyber-input" placeholder="Hurdaya ayrılma gerekçesini yazınız..." style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); height:80px; resize:none;" required></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
            <button onclick="document.getElementById('scrap-defect-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
            <button id="confirm-scrap-btn" class="btn-cyber" style="background:linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color:#FFF; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(239,68,68,0.3);">HURDAYA AYIR</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      const confirmBtn = document.getElementById('confirm-scrap-btn');
      if (confirmBtn) {
        confirmBtn.onclick = async () => {
          const qtyInput = document.getElementById('scrap-qty') as HTMLInputElement;
          const noteInput = document.getElementById('scrap-note') as HTMLTextAreaElement;
          const qty = parseInt(qtyInput?.value || '0', 10);
          const note = noteInput?.value.trim() || '';

          if (isNaN(qty) || qty <= 0 || qty > maxQty) {
            alert(`Lütfen 1 ile ${maxQty} arasında geçerli bir miktar girin.`);
            return;
          }
          if (!note) {
            alert('Lütfen hurdaya ayırma gerekçesini yazın.');
            return;
          }

          confirmBtn.setAttribute('disabled', 'true');
          confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

          try {
            const currentUser = (window as any).currentUser;
            const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

            // 1. Deduct from DEFECT
            await warehouseService.updateStockBySap(
              currentWarehouse.id,
              sapNo,
              -qty,
              {
                user: userEmail,
                reason: `Hurdaya ayrıldı. Gerekçe: ${note}`
              },
              'DEFECT'
            );

            // 2. Add to SCRAP stock (so it is visible as Scrap in inventory)
            await warehouseService.updateStockBySap(
              currentWarehouse.id,
              sapNo,
              qty,
              {
                user: userEmail,
                reason: `Hurda stok girişi. Gerekçe: ${note}`
              },
              'SCRAP'
            );

            (window as any).showToast('Başarılı', 'Malzeme başarıyla hurdaya ayrıldı ve hurda stoğuna eklendi.', 'success');
            modal.remove();

            // Reload warehouse view
            if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
            }
          } catch (e) {
            console.error(e);
            alert('Hurdaya ayırma esnasında hata oluştu.');
            confirmBtn.removeAttribute('disabled');
            confirmBtn.innerHTML = 'HURDAYA AYIR';
          }
        };
      }
    };

    (window as any).acceptRepairReturn = async (repairId: string) => {
      if (!confirm('Bu malzemenin atölyeden sağlam şekilde geri döndüğünü ve depoya kabul edilerek envantere (Revize) ekleneceğini onaylıyor musunuz?')) return;

      try {
        (window as any).showToast('İşlem', 'Malzeme depoya kabul ediliyor...', 'info');
        const { repairService } = await import('../services/RepairService');
        
        // Retrieve repair details
        const repairs = await repairService.getRepairs();
        const rep = repairs.find(r => r.id === repairId);
        if (!rep) {
          alert('Tamir kaydı bulunamadı.');
          return;
        }

        const currentUser = (window as any).currentUser;
        const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

        await repairService.acceptReturnedRepair(rep, userEmail);

        (window as any).showToast('Başarılı', 'Malzeme başarıyla kabul edildi ve Revize stok olarak envantere eklendi.', 'success');
        
        // Reload warehouse view
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Kabul işlemi esnasında bir hata oluştu.');
      }
    };

    (window as any).importAuditToInventory = async (auditId: string) => {
      if(!confirm('Bu sayım geçmişindeki ürünleri mevcut envantere direkt eklemek istediğinize emin misiniz? (Envanterde varsa güncellenir, yoksa yeni eklenir)')) return;
      const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
      if(!audit) return;

      // 1. Create and inject cyber progress overlay
      const overlay = document.createElement('div');
      overlay.id = 'audit-transfer-progress-overlay';
      overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,14,23,0.94); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 2rem; box-sizing: border-box; transition: all 0.3s ease;';
      
      overlay.innerHTML = `
        <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2.5rem; text-align: center; border-top: 4px solid var(--accent-cyan); box-shadow: 0 20px 50px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; gap: 1.5rem; background: #111827; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
          <div style="color: #00f2ff; text-shadow: 0 0 12px rgba(0,242,255,0.4);">
            <i class="fa-solid fa-cloud-arrow-up fa-spin-pulse" style="font-size: 3rem;"></i>
          </div>
          
          <div>
            <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0 0 0.5rem 0; font-weight: 800; letter-spacing: 2px; color: #fff;">SAYIM VERİLERİ AKTARILIYOR</h3>
            <p style="font-size: 0.8rem; color: #94A3B8; margin: 0; line-height: 1.4;">Sayım sonuçları toplu işlemle sistem envanterine işleniyor. Lütfen tarayıcınızı kapatmayınız.</p>
          </div>
          
          <!-- Progress Bar Container -->
          <div style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
            <div id="transfer-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f2ff, #00ff87); transition: width 0.1s ease; border-radius: 6px;"></div>
          </div>
          
          <!-- Percent Text -->
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 2rem; color: #00f2ff; text-shadow: 0 0 10px rgba(0,242,255,0.35);">
            <span id="transfer-progress-percent">0%</span>
          </div>
          
          <!-- Item Counter -->
          <div style="font-size: 0.8rem; font-weight: 700; color: #94A3B8; font-family: monospace; letter-spacing: 0.5px;">
            İşlenen: <span id="transfer-progress-counter" style="color: #fff;">0 / 0</span>
          </div>
        </div>
      `;
      document.body.appendChild(overlay);
      
      try {
        let addedCount = 0;
        let updatedCount = 0;

        // Filter results: only update materials where the physical quantity is actually different from the current quantity!
        const itemsToUpdate = audit.results.filter((res: any) => {
          const existingItem = inventoryItems.find((item: any) => item.sapNo === res.sapNo || (item.sapNo === '' && item.name === res.description));
          if (!existingItem) return true; // New item, need to add
          return existingItem.quantity !== res.physicalQty; // Quantity has changed, need to update
        });

        const totalToUpdate = itemsToUpdate.length;

        const progressPercentEl = document.getElementById('transfer-progress-percent');
        const progressBarEl = document.getElementById('transfer-progress-bar');
        const progressCounterEl = document.getElementById('transfer-progress-counter');
        
        if (progressCounterEl) progressCounterEl.innerText = `0 / ${totalToUpdate}`;

        if (totalToUpdate > 0) {
          for (let i = 0; i < totalToUpdate; i++) {
            const res = itemsToUpdate[i];
            const existingItem = inventoryItems.find((item: any) => item.sapNo === res.sapNo || (item.sapNo === '' && item.name === res.description));

            if (existingItem) {
               await warehouseService.updateMaterial(currentWarehouse.id, existingItem.id, { quantity: res.physicalQty });
               updatedCount++;
            } else {
               await warehouseService.addMaterial(currentWarehouse.id, {
                  sapNo: res.sapNo || '',
                  description: res.description || 'Bilinmeyen Malzeme',
                  quantity: res.physicalQty,
                  shelfNo: 'Tanımsız'
               });
               addedCount++;
            }

            // Update Progress UI
            const pct = Math.round(((i + 1) / totalToUpdate) * 100);
            if (progressPercentEl) progressPercentEl.innerText = `${pct}%`;
            if (progressBarEl) progressBarEl.style.width = `${pct}%`;
            if (progressCounterEl) progressCounterEl.innerText = `${i + 1} / ${totalToUpdate}`;

            // Relinquish control briefly
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        } else {
          // If no changes, complete immediately
          if (progressPercentEl) progressPercentEl.innerText = '100%';
          if (progressBarEl) progressBarEl.style.width = '100%';
          if (progressCounterEl) progressCounterEl.innerText = '0 / 0';
        }
        
        // Mark as imported in Firestore
        await warehouseService.updateAudit(currentWarehouse.id, auditId, { imported: true });
        
        if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err: any) {
        console.error(err);
        alert('Aktarım sırasında hata oluştu: ' + (err?.message || err));
      } finally {
        // Always clean up overlay
        overlay.remove();
      }
    };

    (window as any).handleExcelUpload = async (event: any) => {
      const file = event.target.files?.[0];
      if (!file) return;

      const wipeExisting = confirm('Excel yüklenmeden önce bu deponun mevcut envanteri TAMAMEN silinsin mi? (Bu işlem geri alınamaz!) \\n\\nİptal derseniz silinmeden üstüne eklenir.');
      
      try {
        const btn = document.getElementById('btn-upload-excel');
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...'; btn.style.pointerEvents = 'none'; }

        const items = await excelService.parseExcel(file);
        
        if (wipeExisting) {
            const deletePromises = inventoryItems.map(i => warehouseService.deleteMaterial(currentWarehouse.id, i.id));
            await Promise.all(deletePromises);
        }

        let addedCount = 0;
        const totalItems = items.length;
        for (let i = 0; i < totalItems; i++) {
           const item = items[i];
           if (!item.description && !item.sapNo) continue; // Skip empty rows
           await warehouseService.addMaterial(currentWarehouse.id, {
             sapNo: String(item.sapNo || '').trim(),
             description: String(item.description || '').trim() || 'Bilinmeyen Malzeme',
             quantity: Number(item.quantity) || 0,
             shelfNo: String(item.shelfNo || '').trim() || 'Tanımsız'
           });
           addedCount++;
           
           if (btn) {
               const percentage = Math.round(((i + 1) / totalItems) * 100);
               btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> %${percentage} Yükleniyor...`;
           }
        }

        alert(`Başarıyla ${addedCount} ürün yüklendi!`);
        if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
        }
      } catch (err) {
        console.error(err);
        alert('Excel yüklenirken hata oluştu. Lütfen Excel formatınızın doğru olduğundan emin olun (Sütunlar: SAP NO, AÇIKLAMA, ADET, RAF NO).');
        const btn = document.getElementById('btn-upload-excel');
        if(btn) { btn.innerHTML = '<i class="fa-solid fa-upload"></i> Yükle'; btn.style.pointerEvents = 'auto'; }
      }
      event.target.value = ''; // Reset file input
    };

    (window as any).toggleAuditCollapse = (el: HTMLElement) => {
       const content = el.nextElementSibling as HTMLElement;
       if (!content) return;
       const icon = el.querySelector('.fa-chevron-down, .fa-chevron-up') as HTMLElement;
       const isHidden = content.style.display === 'none' || content.style.display === '';
       if (isHidden) {
          content.style.display = 'block';
          if (icon) {
             icon.classList.remove('fa-chevron-down');
             icon.classList.add('fa-chevron-up');
          }
       } else {
          content.style.display = 'none';
          if (icon) {
             icon.classList.remove('fa-chevron-up');
             icon.classList.add('fa-chevron-down');
          }
       }
    };

    (window as any).deleteAuditRecord = async (auditId: string) => {
       if (!confirm('Bu sayım geçmişi kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
       try {
          await warehouseService.deleteAudit(currentWarehouse.id, auditId);
          alert('Sayım geçmişi başarıyla silindi.');
          if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(currentWarehouse.id, 'SAYIM_GECMISI');
          }
       } catch (err) {
          console.error(err);
          alert('Silinirken hata oluştu.');
       }
    };
    
    (window as any).saveDraftAudit = async () => {
       const inputs = document.querySelectorAll('.manual-audit-input');
       const newDraftData = { ...draftData };
       inputs.forEach((input: any) => {
         const itemId = input.dataset.id;
         const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
         const shelfVal = shelfInput ? shelfInput.value.trim() : '';
         const originalShelf = shelfInput ? (shelfInput.dataset.original || '').trim() : '';
         const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
         const noteVal = noteInput ? noteInput.value.trim() : '';

         if (input.value !== '' || (shelfVal !== originalShelf)) {
           newDraftData[itemId] = { 
               qty: input.value, 
               note: noteVal, 
               shelf: shelfVal 
           };
         } else {
           delete newDraftData[itemId];
         }
       });
       draftData = newDraftData;

       if (currentWarehouse) {
         try {
           const userProfile = getUserProfile();
           const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
           const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
           await setDoc(draftDocRef, {
             draftData: newDraftData,
             updatedBy: user,
             lastUpdated: serverTimestamp()
           });
         } catch (e) {
           console.error("Failed to save draft to Firestore:", e);
         }
       }

       localStorage.setItem(`draft_audit_${currentWarehouse.id}`, JSON.stringify(draftData));
       if ((window as any).updateManualSummaryBar) {
         (window as any).updateManualSummaryBar();
       }
    };

    (window as any).filterManualAudit = (query: string) => {
       currentAuditPage = 1;
       (window as any).renderManualAuditTable();
    };

    (window as any).clearDraftAudit = async () => {
       if(confirm('Mevcut sayım taslağını tamamen silip sıfırdan başlamak istediğinize emin misiniz?')) {
          if (currentWarehouse) {
            try {
              const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
              await deleteDoc(draftDocRef);
            } catch (e) {
              console.error("Failed to clear draft in Firestore:", e);
            }
          }
          localStorage.removeItem(`draft_audit_${currentWarehouse.id}`);
          draftData = {};
          if ((window as any).selectWarehouseAndNavigate) {
            (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
          }
       }
    };

    (window as any).onManualQtyChange = async (inputId: string, noteId: string, sysQty: number) => {
      const input = document.getElementById(inputId) as HTMLInputElement;
      const noteInput = document.getElementById(noteId) as HTMLInputElement;
      if (!input || !noteInput) return;
      
      const val = parseFloat(input.value);
      if (!isNaN(val) && val !== sysQty) {
        noteInput.style.display = 'block';
      } else {
        noteInput.style.display = 'none';
        noteInput.value = '';
      }
      
      const itemId = inputId.replace('manual-qty-', '');
      const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
      const shelfVal = shelfInput ? shelfInput.value.trim() : '';
      
      const newDraftData = { ...draftData };
      newDraftData[itemId] = {
        qty: input.value,
        note: noteInput.value.trim(),
        shelf: shelfVal
      };

      if (input.value === '' && shelfVal === (shelfInput ? (shelfInput.dataset.original || '').trim() : '')) {
         delete newDraftData[itemId];
      }
      draftData = newDraftData;

      // Ensure startTime is set
      let localStartTime = localStorage.getItem(`draft_audit_start_time_${currentWarehouse.id}`);
      if (!localStartTime) {
         localStartTime = new Date().toISOString();
         localStorage.setItem(`draft_audit_start_time_${currentWarehouse.id}`, localStartTime);
      }

      if (currentWarehouse) {
        try {
          const userProfile = getUserProfile();
          const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
          const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
          await setDoc(draftDocRef, {
            draftData: newDraftData,
            updatedBy: user,
            lastUpdated: serverTimestamp(),
            startTime: localStartTime
          });
        } catch (e) {
          console.error("Failed to save draft to Firestore:", e);
        }
      }

      localStorage.setItem(`draft_audit_${currentWarehouse.id}`, JSON.stringify(draftData));

      if ((window as any).updateManualSummaryBar) {
        (window as any).updateManualSummaryBar();
      }
    };

    // --- INITIAL RENDER CALLS ON PAGE LOAD ---
    if (currentTab === 'SAYIM') {
       if (typeof (window as any).renderManualAuditTable === 'function') {
           (window as any).renderManualAuditTable();
        }
     }
     if (currentTab === 'INVENTORY' || currentTab === 'ENVANTER') {
        if (typeof (window as any).renderInventoryTable === 'function') {
           (window as any).renderInventoryTable();
        }
     }
     if (currentTab === 'DEPO_HAREKETLERI') {
        if (typeof (window as any).loadDepoHareketleriLogs === 'function') {
           (window as any).loadDepoHareketleriLogs();
        }
     }
     if (currentTab === 'SAYIM_GECMISI') {
        if (typeof (window as any).loadSayimGecmisi === 'function') {
           (window as any).loadSayimGecmisi();
        }
     }
     if (currentTab === 'TRANSFERLER') {
        if (typeof (window as any).loadWarehouseTransfers === 'function') {
           (window as any).loadWarehouseTransfers();
        }
     }
     // Auto-search/filter from quick navigation if set
     if ((window as any)._globalWarehouseSearchQuery) {
         const searchInput = document.getElementById('inventory-search-input') as HTMLInputElement;
         if (searchInput) {
             searchInput.value = (window as any)._globalWarehouseSearchQuery;
             (window as any)._globalWarehouseSearchQuery = null; // Clear it
             if ((window as any).filterInventory) {
                 (window as any).filterInventory();
             }
         }
     }
  };

  // Load draft data for manual audit
  let draftData: any = {};
  let startTime = '';
  if (currentWarehouse) {
    try {
      const draftDocRef = doc(db, 'warehouses', currentWarehouse.id, 'active_audit', 'draft');
      const draftSnap = await getDoc(draftDocRef);
      if (draftSnap.exists()) {
        const data = draftSnap.data();
        draftData = data.draftData || {};
        startTime = data.startTime || '';
      }
    } catch (e) {
      console.error("Failed to load initial Firestore draft audit:", e);
    }
    
    // Fallback to localStorage if Firestore draft is empty or failed
    if (Object.keys(draftData).length === 0) {
      try {
        const localDraft = localStorage.getItem(`draft_audit_${currentWarehouse.id}`);
        if (localDraft) {
          draftData = JSON.parse(localDraft) || {};
        }
      } catch (err) {
        console.error("Failed to load localStorage draft fallback:", err);
      }
    }

    // Set start time if active draft but no start time, or initialize it
    if (Object.keys(draftData).length > 0) {
       if (!startTime) {
          startTime = localStorage.getItem(`draft_audit_start_time_${currentWarehouse.id}`) || '';
       }
       if (!startTime) {
          startTime = new Date().toISOString();
          localStorage.setItem(`draft_audit_start_time_${currentWarehouse.id}`, startTime);
       }
    }
  }

  return `
    <div style="background-color: #0A0E17; min-height: 100vh; color: #E2E8F0; font-family: 'Inter', sans-serif; padding: 2rem; box-sizing: border-box; position: relative;">
      
      <!-- Header Section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <button onclick="window.selectWarehouseAndNavigate(null)" style="background: none; border: none; color: #94A3B8; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.5rem; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.color='#FFFFFF'; this.style.backgroundColor='#1E293B';" onmouseout="this.style.color='#94A3B8'; this.style.backgroundColor='transparent';">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 style="font-size: 1.5rem; font-weight: 600; color: #FFFFFF; margin: 0;">${warehouseName}</h1>
            <div style="font-size: 0.85rem; color: #64748B; margin-top: 0.25rem;">Stok ve Envanter Sistemi</div>
          </div>
        </div>
        <div id="inventory-action-bar" style="display: ${currentTab === 'INVENTORY' ? 'flex' : 'none'}; gap: 0.5rem; align-items: center;">
          <input 
            id="inventory-search-input"
            oninput="window.filterInventory()"
            type="text" 
            placeholder="Parça adı veya SAP numarası..." 
            style="height: 34px; background-color: #111827; border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.8rem; width: 220px; outline: none; transition: all 0.2s;"
          />
          ${currentWarehouse.id === 'MTA' ? '' : `
            ${isMobileWarehouse ? '' : `
            <button onclick="window.startFastAudit()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
              <i class="fa-solid fa-bolt"></i> Hızlı Sayım
            </button>
            `}
            <button onclick="window.startQRScanner()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.8rem; font-weight: 500; cursor: pointer;">
              <i class="fa-solid fa-qrcode"></i> QR Tara
            </button>
            <button onclick="window.downloadInventoryExcel()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.8rem; font-weight: 500; cursor: pointer;">
              <i class="fa-solid fa-download"></i> İndir
            </button>
            ${isMobileWarehouse ? '' : `
            <button onclick="window.printWarehouseQR()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.8rem; font-weight: 500; cursor: pointer;" title="Tüm Depo Malzeme Etiketlerini QR Olarak Yazdır (Tanex TW-2014)">
              <i class="fa-solid fa-qrcode"></i> QR Etiket Bas
            </button>
            <input type="file" id="excel-upload-input" accept=".xlsx, .xls" style="display: none;" onchange="window.handleExcelUpload(event)" />
            <button id="btn-upload-excel" onclick="document.getElementById('excel-upload-input').click()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.8rem; font-weight: 500; cursor: pointer;">
              <i class="fa-solid fa-upload"></i> Yükle
            </button>
            <button onclick="window.openAddNewModal()" style="height: 34px; padding: 0 0.75rem; border-radius: 6px; border: none; background-color: #FFFFFF; color: #000000; font-size: 0.8rem; font-weight: 600; cursor: pointer;">
              + Yeni Ekle
            </button>
            `}
          `}
        </div>
      </div>

      <!-- Add New Modal -->
      <div id="add-new-modal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(10, 14, 23, 0.8); z-index: 1000; justify-content: center; align-items: center; backdrop-filter: blur(4px);">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; width: 500px; padding: 2rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h2 style="margin: 0; font-size: 1.25rem; color: #FFF;">Yeni Malzeme Ekle</h2>
            <i class="fa-solid fa-times" onclick="window.closeAddNewModal()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası (Otomatik Aranır)</label>
              <input id="new-sap-input" type="text" autocomplete="off" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #14F195; padding: 0 1rem; font-size: 1rem; outline: none; font-weight: 600;" placeholder="Örn: 32">
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
              <input id="new-name-input" type="text" style="width: 100%; height: 42px; background-color: rgba(10, 14, 23, 0.5); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Sözlükten bulunacak...">
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
                <input id="new-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="0">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Birim</label>
                <select id="new-unit-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                  <option value="Adet">Adet</option>
                  <option value="Kutu">Kutu</option>
                  <option value="Litre">Litre</option>
                  <option value="Set">Set</option>
                </select>
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
              <input id="new-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;" placeholder="Örn: A-12">
            </div>

            <div id="new-stock-entry-details" style="display: flex; flex-direction: column; gap: 0.75rem; border-top: 1px dashed #1E293B; padding-top: 0.75rem; margin-top: 0.5rem; text-align: left;">
              <h4 style="font-size: 0.8rem; font-weight: 700; color: #14F195; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Malzeme Giriş Bilgileri</h4>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Malzeme Nereden Geldi?</label>
                <input id="new-source-input" type="text" placeholder="Örn: Merkez Depo, Tedarikçi, Saha vb." style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                  <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">İrsaliye / Delivery Note</label>
                  <input id="new-delivery-input" type="text" placeholder="Varsa irsaliye no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Fatura Numarası</label>
                  <input id="new-invoice-input" type="text" placeholder="Varsa fatura no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Güncelleyen Personel</label>
                <input id="new-updatedby-input" type="text" placeholder="Ad Soyad" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Not / Açıklama</label>
                <input id="new-entry-note-input" type="text" placeholder="Varsa eklemek istediğiniz not" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #14F195; margin-bottom: 0.5rem; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;"><i class="fa-solid fa-image" style="margin-right:0.25rem;"></i> Malzeme Görseli</label>
              <div 
                onclick="document.getElementById('new-img-input').click()" 
                style="width: 100%; height: 160px; background-color: #0A0E17; border: 1px dashed #334155; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;"
                onmouseover="this.style.borderColor='#14F195'; this.style.backgroundColor='#0d131f';"
                onmouseout="this.style.borderColor='#334155'; this.style.backgroundColor='#0A0E17';"
              >
                <i class="fa-solid fa-camera" style="font-size: 2.5rem; color: #475569; margin-bottom: 0.75rem; transition: color 0.2s;"></i>
                <div id="new-img-label" style="color: #94A3B8; font-size: 0.9rem; font-weight: 500;">Görsel Yükle</div>
                <input id="new-img-input" type="file" accept="image/*" style="display: none;" onchange="document.getElementById('new-img-label').innerText = this.files[0] ? this.files[0].name : 'Görsel Yükle'; document.getElementById('new-img-label').style.color = this.files[0] ? '#14F195' : '#94A3B8'; if(this.files[0]) this.previousElementSibling.previousElementSibling.style.color = '#14F195'; else this.previousElementSibling.previousElementSibling.style.color = '#475569';">
              </div>
            </div>

            <button onclick="window.saveNewItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">
              Malzemeyi Kaydet
            </button>
          </div>
        </div>
      </div>

      <!-- Tabs Section -->
      <div style="display: flex; gap: 0.75rem; border-bottom: 1px solid #1E293B; margin-bottom: 2rem; padding-bottom: 0.5rem; overflow-x: auto;">
        <div onclick="window.switchTab('ENVANTER', 'tab-ENVANTER')" id="tab-ENVANTER" data-active="${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
          <i class="fa-solid fa-layer-group"></i> ENVANTER
        </div>
        ${isMobileWarehouse ? `
          <div onclick="window.switchTab('ANALİZ', 'tab-ANALİZ')" id="tab-ANALİZ" data-active="${currentTab === 'ANALİZ' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'ANALİZ' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'ANALİZ' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-screwdriver-wrench"></i> KULLANIMLAR
          </div>
          <div onclick="window.switchTab('DEPO_HAREKETLERI', 'tab-DEPO_HAREKETLERI')" id="tab-DEPO_HAREKETLERI" data-active="${currentTab === 'DEPO_HAREKETLERI' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEPO_HAREKETLERI' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEPO_HAREKETLERI' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-clock-rotate-left"></i> DEPO HAREKETLERİ
          </div>
          <div onclick="window.switchTab('DEFECT', 'tab-DEFECT')" id="tab-DEFECT" data-active="${currentTab === 'DEFECT' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEFECT' ? '#EF4444' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEFECT' ? '#EF4444' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-triangle-exclamation"></i> DEFECT LİSTESİ
          </div>
          <div onclick="window.switchTab('TRANSFERLER', 'tab-TRANSFERLER')" id="tab-TRANSFERLER" data-active="${currentTab === 'TRANSFERLER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'TRANSFERLER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'TRANSFERLER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-truck-ramp-box"></i> TRANSFERLER
          </div>
        ` : `
          ${currentWarehouse.id !== 'MTA' ? `
            <div onclick="window.switchTab('ANALİZ', 'tab-ANALİZ')" id="tab-ANALİZ" data-active="${currentTab === 'ANALİZ' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'ANALİZ' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'ANALİZ' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
              <i class="fa-solid fa-screwdriver-wrench"></i> KULLANIMLAR
            </div>
          ` : ''}
          <div onclick="window.switchTab('SAYIM', 'tab-SAYIM')" id="tab-SAYIM" data-active="${currentTab === 'SAYIM' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'SAYIM' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-clipboard-check"></i> SAYIM
          </div>
          <div onclick="window.switchTab('SAYIM_GECMISI', 'tab-SAYIM_GECMISI')" id="tab-SAYIM_GECMISI" data-active="${currentTab === 'SAYIM_GECMISI' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-file-invoice"></i> SAYIM GEÇMİŞİ
          </div>
          ${currentWarehouse.id !== 'MTA' ? `
            <div onclick="window.switchTab('DEFECT', 'tab-DEFECT')" id="tab-DEFECT" data-active="${currentTab === 'DEFECT' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEFECT' ? '#EF4444' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEFECT' ? '#EF4444' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
              <i class="fa-solid fa-triangle-exclamation"></i> DEFECT LİSTESİ
            </div>
            <div onclick="window.switchTab('TRANSFERLER', 'tab-TRANSFERLER')" id="tab-TRANSFERLER" data-active="${currentTab === 'TRANSFERLER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'TRANSFERLER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'TRANSFERLER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
              <i class="fa-solid fa-truck-ramp-box"></i> TRANSFERLER
            </div>
          ` : ''}
        `}
      </div>

      <div id="view-ENVANTER" style="display: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'block' : 'none'};">
      <!-- Summary Cards -->
      ${(currentWarehouse.id !== 'MTA' && !isMobileWarehouse) ? `
      <div style="display: grid; grid-template-columns: 260px 1fr; gap: 0.75rem; margin-bottom: 1.5rem; align-items: start;">
        <!-- Sol Sütun: Toplam Kalem & Kritik Stok -->
        <div style="display: flex; flex-direction: column; gap: 0.6rem; justify-content: space-between; height: 86px; box-sizing: border-box;">
          <div id="total-kalem-card" onclick="window.setInventoryCriticalFilter(false)" style="background-color: ${onlyShowCritical ? '#111827' : 'rgba(59, 130, 246, 0.05)'}; border: 1px solid ${onlyShowCritical ? '#1E293B' : '#3B82F6'}; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; flex: 1; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
              <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Kalem</div>
            </div>
            <div id="total-kalem-count" style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${inventoryItems.filter(i => i.condition !== 'DEFECT').length}</div>
          </div>
          <div id="kritik-stok-card" onclick="window.setInventoryCriticalFilter(true)" style="background-color: ${onlyShowCritical ? 'rgba(239, 68, 68, 0.1)' : '#111827'}; border: 1px solid ${onlyShowCritical ? '#EF4444' : 'rgba(239, 68, 68, 0.25)'}; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; flex: 1; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #EF4444; font-size: 0.9rem;"></i>
              <div style="font-size: 0.75rem; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Kritik Stok</div>
            </div>
            <div id="kritik-stok-count" style="font-size: 1.15rem; font-weight: 800; color: #EF4444;">${inventoryItems.filter(i => i.condition !== 'DEFECT' && i.quantity <= (i.minStock || 0)).length}</div>
          </div>
        </div>

        <!-- Sağ Sütun: EKİPLERİN REZERVASYON DETAYLARI -->
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 0.6rem 0.85rem; display: flex; flex-direction: column; min-height: 86px; max-height: 350px; height: auto; box-sizing: border-box;">
          <h3 style="margin-top: 0; margin-bottom: 0.35rem; font-family: 'Rajdhani', sans-serif; font-size: 0.82rem; color: #ff9800; font-weight: 800; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.4rem; text-transform: uppercase;">
            <i class="fa-solid fa-bookmark"></i> EKİPLERİN REZERVASYON DETAYLARI
          </h3>
          <div style="flex: 1; overflow-y: auto; padding-right: 0.25rem;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.72rem; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); color: #64748B;">
                  <th style="padding: 0.2rem 0.3rem; font-weight: 700;">EKİP</th>
                  <th style="padding: 0.2rem 0.3rem; font-weight: 700;">SAP NO</th>
                  <th style="padding: 0.2rem 0.3rem; font-weight: 700;">MALZEME TANIMI</th>
                  <th style="padding: 0.2rem 0.3rem; font-weight: 700; text-align: center;">MİKTAR</th>
                  <th style="padding: 0.2rem 0.3rem; font-weight: 700; text-align: right;">RAF KONUMU</th>
                </tr>
              </thead>
              <tbody id="reservations-tbody">
                ${(() => {
                  const rows: any[] = [];
                  
                  // 1. Gather task-based reservations
                  draftReservations.details.forEach((d: any) => {
                    d.materials.forEach((m: any) => {
                      const invItem = inventoryItems.find((item: any) => String(item.sapNo).trim() === String(m.sapNo).trim());
                      const shelf = invItem ? (invItem.shelfNo || '-') : '-';
                      rows.push({
                        team: d.team,
                        sapNo: m.sapNo,
                        description: m.description,
                        qty: m.used,
                        shelf: shelf
                      });
                    });
                  });

                  // 2. Gather transfer-based reservations from inventory items
                  inventoryItems.forEach((item: any) => {
                    if (item.reservations) {
                      Object.entries(item.reservations).forEach(([tId, qty]) => {
                        const numericQty = Number(qty);
                        if (numericQty > 0) {
                          const cleanTeam = tId.replace('team_', '').replace(/_/g, ' ');
                          
                          // Check if we already have this exact combination of team + sapNo to prevent duplicates
                          const exists = rows.some((r: any) => 
                            String(r.team).toLowerCase().trim() === cleanTeam.toLowerCase().trim() && 
                            String(r.sapNo).trim() === String(item.sapNo).trim()
                          );
                          
                          if (!exists) {
                            rows.push({
                              team: cleanTeam,
                              sapNo: item.sapNo,
                              description: item.name || item.description || '-',
                              qty: numericQty,
                              shelf: item.shelfNo || '-'
                            });
                          }
                        }
                      });
                    }
                  });

                  const htmlRows = rows.map((r: any) => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); color: #E2E8F0;">
                      <td style="padding: 0.2rem 0.3rem; font-weight: bold; color: #ff9800;">${r.team}</td>
                      <td style="padding: 0.2rem 0.3rem; font-family: monospace;">${r.sapNo}</td>
                      <td style="padding: 0.2rem 0.3rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">${r.description}</td>
                      <td style="padding: 0.2rem 0.3rem; text-align: center; font-weight: 700; color: #14F195;">${r.qty} Adet</td>
                      <td style="padding: 0.2rem 0.3rem; text-align: right; color: #94A3B8;">${r.shelf}</td>
                    </tr>
                  `);
                  
                  return htmlRows.length > 0 ? htmlRows.join('') : `
                    <tr>
                      <td colspan="5" style="padding: 0.6rem 0.3rem; text-align: center; color: #475569; font-size: 0.72rem;">
                        Aktif ekip rezervasyonu bulunmuyor.
                      </td>
                    </tr>
                  `;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      ` : `
        ${currentWarehouse.id === 'MTA' ? `
          <!-- Repair Workshop (W11) Stats -->
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; width: 260px; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
                <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Kalem</div>
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${inventoryItems.length}</div>
            </div>
          </div>
        ` : `
          <!-- Mobile Warehouse Summary -->
          <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
            <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; width: 260px; box-sizing: border-box;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
                <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Zimmetli Kalem</div>
              </div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${inventoryItems.filter(item => item.condition !== 'DEFECT' && (item.quantity > 0 || (item.reservedQuantity || 0) > 0)).length}</div>
            </div>
          </div>
        `}
      `}
      ${isMaterialManager && pendingReturns.length > 0 ? `
      <div class="glass-panel fade-in-up" style="border: 1px solid rgba(20, 241, 149, 0.3); background: rgba(20, 241, 149, 0.02); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
        <h3 style="margin-top: 0; margin-bottom: 1rem; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; color: #14F195; font-weight: 700; display: flex; align-items: center; gap: 0.5rem;">
          <i class="fa-solid fa-screwdriver-wrench"></i> ONAY BEKLEYEN ATÖLYE DÖNÜŞLERİ (KABUL BEKLEYEN)
        </h3>
        <p style="color: #94A3B8; font-size: 0.85rem; margin-bottom: 1rem;">
          Merkez Tamir Atölyesi tarafından tamiri tamamlanan ve depoya sevk edilen malzemelerin fiziksel olarak teslim alındığını onaylayıp envantere (Revize stok olarak) girişini yapın.
        </p>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: #94A3B8;">
                <th style="padding: 0.75rem 1rem;">Sevk Tarihi</th>
                <th style="padding: 0.75rem 1rem;">Malzeme (SAP)</th>
                <th style="padding: 0.75rem 1rem;">Miktar</th>
                <th style="padding: 0.75rem 1rem;">Sevk Eden Atölye Yetkilisi</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              ${pendingReturns.map(rep => {
                const formatTime = (ts: any) => {
                  if (!ts) return '-';
                  const date = ts.toDate ? ts.toDate() : new Date(ts);
                  return date.toLocaleString('tr-TR');
                };
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 0.75rem 1rem; color: #94A3B8;">${formatTime(rep.repairedAt || rep.sentAt)}</td>
                    <td style="padding: 0.75rem 1rem;">
                      <div style="font-weight: bold; color: #FFF;">${rep.description}</div>
                      <div style="font-size: 0.75rem; color: #94A3B8;"><i class="fa-solid fa-barcode"></i> ${rep.sapNo}</div>
                    </td>
                    <td style="padding: 0.75rem 1rem; font-weight: bold; color: #14F195;">${rep.quantity} Adet</td>
                    <td style="padding: 0.75rem 1rem; color: #E2E8F0;">${rep.receivedBy || 'Atölye Sorumlusu'}</td>
                    <td style="padding: 0.75rem 1rem; text-align: right;">
                      <button onclick="window.acceptRepairReturn('${rep.id}')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; border: none; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 10px rgba(20, 241, 149, 0.2);" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                        <i class="fa-solid fa-square-check" style="margin-right: 4px;"></i> Kabul Et
                      </button>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
      ` : ''}

      <!-- Inventory Table -->
      <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden;">
        <table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
          <thead>
            <tr>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 40px;"><input type="checkbox" id="select-all-checkbox" onclick="window.toggleSelectAll(this)" /></th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">SAP No</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Malzeme Tanımı</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Stok</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Rezerve</th>
              <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Konum</th>
              <th style="padding: 1rem; text-align: right; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody id="inventory-tbody">
            <tr><td colspan="7" style="padding: 2rem; text-align: center; color: #94A3B8;">Yükleniyor...</td></tr>
          </tbody>
        </table>
        <div id="inventory-pagination"></div>
      </div>
      </div> <!-- End of view-ENVANTER -->

      <!-- ANALİZ View -->
      <div id="view-ANALİZ" style="display: ${currentTab === 'ANALİZ' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <h2 style="color: #FFFFFF; margin: 0; font-size: 1.25rem;">Türbin Bazlı Malzeme Tüketim Analizi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Bu sahaya ait servis raporlarında takılan ve sökülen malzemeler türbin bazında listelenmektedir.</div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" id="warehouse-analytics-sap" class="cyber-input" style="padding: 8px 12px; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 6px; color: #14F195; width: 250px; font-weight: 600; outline: none;" placeholder="SAP Kodu veya Malzeme Adı..." value="${localStorage.getItem('warehouse_analytics_sap') || ''}" onkeypress="if(event.key==='Enter') window.setWarehouseAnalyticsSap(this.value)">
                <button onclick="window.setWarehouseAnalyticsSap(document.getElementById('warehouse-analytics-sap').value)" style="padding: 8px 16px; border-radius: 6px; cursor: pointer; background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); font-weight: bold; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'">
                  <i class="fa-solid fa-search"></i> Filtrele
                </button>
              </div>
            </div>
            
            <div class="filter-group" style="display: flex; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
              <button class="btn-filter ${currentPeriod === 'this-week' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-week')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-week' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-week' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU HAFTA</button>
              <button class="btn-filter ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-month')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-month' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-month' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU AY</button>
              <button class="btn-filter ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('last-month')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'last-month' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'last-month' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">ÖNCEKİ AY</button>
              <button class="btn-filter ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('this-year')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'this-year' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'this-year' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">BU YIL</button>
              <button class="btn-filter ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setWarehouseAnalyticsPeriod('all')" style="padding: 0.5rem 1rem; border-radius: 6px; background: ${currentPeriod === 'all' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'all' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;">TÜMÜ</button>
              

              
              <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
              
              <input type="date" id="warehouse-analytics-start" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${localStorage.getItem('warehouse_analytics_start') || ''}">
              <span style="color: #94A3B8; font-size: 0.8rem;">-</span>
              <input type="date" id="warehouse-analytics-end" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${localStorage.getItem('warehouse_analytics_end') || ''}">
              <button onclick="window.setCustomWarehouseAnalyticsPeriod()" style="padding: 4px 12px; border-radius: 4px; background: ${currentPeriod === 'custom' ? '#3B82F6' : 'transparent'}; color: ${currentPeriod === 'custom' ? '#FFF' : '#94A3B8'}; border: none; cursor: pointer;" title="Tarih aralığına göre filtrele">
                <i class="fa-solid fa-filter"></i>
              </button>
              
              <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
              
              <button onclick="window.exportTurbineAnalytics()" style="padding: 0.5rem 1rem; border-radius: 6px; background: #10B981; color: #FFF; border: none; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 0.5rem;" title="Türbin Analizini Excel Olarak İndir">
                <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
              </button>
            </div>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${sortedTurbines.length > 0 ? sortedTurbines.map(([turbineId, data], index) => `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
                <!-- Accordion Header -->
                <div onclick="window.toggleTurbineAccordion('turbine-acc-${index}')" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                  <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 700; color: #E2E8F0; display: flex; align-items: center; gap: 10px;">
                    <i class="fa-solid fa-chevron-down" id="turbine-acc-icon-${index}" style="transition: transform 0.3s; font-size: 0.8rem; color: #94A3B8;"></i>
                    ${turbineId}
                  </div>
                  <div style="display: flex; gap: 1rem;">
                    ${data.totalUsed > 0 ? `<span style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalUsed} Takılan</span>` : ''}
                    ${data.totalDefect > 0 ? `<span style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalDefect} Sökülen</span>` : ''}
                  </div>
                </div>
                
                <!-- Accordion Content -->
                <div id="turbine-acc-${index}" style="display: none; padding: 0; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                  <div style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                      <thead>
                        <tr style="background: rgba(255,255,255,0.02); color: #94A3B8;">
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Tarih</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Rapor No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">MÇF No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Arıza Kodu</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Arıza Açıklaması</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">SAP No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Seri No</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Malzeme Açıklaması</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #4ade80;">Takılan</th>
                          <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #f87171;">Sökülen</th>
                          ${hasWarehouseDeletePerm ? `<th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: right;">Aksiyon</th>` : ''}
                        </tr>
                      </thead>
                      <tbody>
                        ${data.items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => `
                          <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                            <td style="padding: 0.75rem 1rem; color: #E2E8F0;">${new Date(item.date).toLocaleDateString('tr-TR')}</td>
                            <td style="padding: 0.75rem 1rem; color: #94A3B8; font-family: monospace;">${item.reportId}</td>
                            <td style="padding: 0.75rem 1rem; color: #F59E0B; font-weight: 600;">${item.matFormNo}</td>
                            <td style="padding: 0.75rem 1rem; color: #E2E8F0; font-weight: 600;">${item.faultCode || '-'}</td>
                            <td style="padding: 0.75rem 1rem; color: #94A3B8; font-size: 0.8rem; max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${(item.faultDesc || '').replace(/"/g, '&quot;')}">${item.faultDesc || '-'}</td>
                            <td style="padding: 0.75rem 1rem; color: #3B82F6; font-family: monospace;">${item.sapNo}</td>
                            <td style="padding: 0.75rem 1rem; color: #10B981; font-family: monospace; font-weight: 600;">
                              <div style="display: inline-flex; align-items: center; gap: 8px;">
                                <span>${item.serialNo || '-'}</span>
                                ${hasWarehouseManagePerm && item.reportDocId ? `
                                  <i onclick="window.editAnalizSerial('${item.reportDocId}', '${item.sapNo}', ${item.defect > 0}, '${item.serialNo && item.serialNo !== '-' ? item.serialNo.replace(/'/g, "\\'") : ''}')" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.5; color: #94A3B8; font-size: 0.75rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.5'" title="Seri No Düzenle"></i>
                                ` : ''}
                              </div>
                            </td>
                            <td style="padding: 0.75rem 1rem; font-weight: 500; color: #E2E8F0;">${item.description}</td>
                            <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #4ade80;">${item.used > 0 ? `+${item.used}` : '-'}</td>
                            <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #f87171;">${item.defect > 0 ? `-${item.defect}` : '-'}</td>
                            ${hasWarehouseDeletePerm ? `
                              <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap;">
                                ${item.reportDocId ? `
                                  <i onclick="window.deleteAnalyticsReport('${item.reportDocId}', '${item.reportId}')" class="fa-solid fa-trash" style="cursor: pointer; opacity: 0.7; color: #EF4444; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Raporu Sil (Tüm Tüketimleri Kaldırır)"></i>
                                ` : '-'}
                              </td>
                            ` : ''}
                          </tr>
                        `).join('')}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            `).join('') : '<div style="text-align: center; padding: 3rem; color: #94A3B8; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">Seçili tarih aralığında bu sahada türbin bazlı malzeme tüketimi bulunamadı.</div>'}
          </div>
        </div>
      </div>

      <!-- Manual Audit View -->
      <div id="view-SAYIM" style="display: ${currentTab === 'SAYIM' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <!-- Collaboration Banner -->
          <div id="manual-audit-collaboration-banner" style="display: none; align-items: center; gap: 0.75rem; background-color: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; color: #14F195; font-size: 0.9rem;">
            <i class="fa-solid fa-users" style="font-size: 1.1rem;"></i>
            <span id="collaboration-banner-text"></span>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.25rem;">Manuel Sayım Ekranı</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Listedeki ürünlerin fiziksel sayılarını girerek hızlıca stokları güncelleyebilirsiniz. Değişiklik olmayan sayımlar geçmişe uyumlu olarak kaydedilecektir.</div>
            </div>
            <div style="display: flex; align-items: center; gap: 0.75rem; justify-content: space-between; flex-wrap: nowrap; width: 100%;">
              <div style="display: flex; align-items: center; gap: 0.75rem; flex: 1;">
                <div style="position: relative;">
                  <i class="fa-solid fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B;"></i>
                  <input type="text" id="manual-audit-search" oninput="window.filterManualAudit(this.value)" placeholder="SAP No veya Tanım ara..." style="width: 250px; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #FFFFFF; padding: 0 1rem 0 2.5rem; outline: none; font-size: 0.9rem;" />
                </div>
                <div id="manual-summary-bar" style="display: none; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.85rem; align-items: center; height: 42px; box-sizing: border-box; white-space: nowrap;">
                  <!-- Dynamically populated via updateManualSummaryBar -->
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0;">
                ${currentWarehouse.id === 'MTA' ? '' : `
                <button onclick="window.startFastAudit()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; white-space: nowrap;">
                  <i class="fa-solid fa-bolt"></i> Hızlı Sayım (QR)
                </button>
                <button onclick="window.startQRScanner()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.9rem; font-weight: 500; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; white-space: nowrap;" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#111827'">
                  <i class="fa-solid fa-qrcode"></i> QR Tara
                </button>
                `}
                ${isMaterialManager ? `
                <button onclick="window.clearDraftAudit()" style="height: 42px; padding: 0 1.25rem; border-radius: 8px; border: 1px solid #1E293B; background-color: transparent; color: #EF4444; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; white-space: nowrap;" onmouseover="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.backgroundColor='transparent'">
                  <i class="fa-solid fa-trash-can"></i> Taslağı Sil
                </button>
                ` : ''}
                <button onclick="window.saveManualAudit(this)" style="height: 42px; padding: 0 1.25rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.9rem; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; white-space: nowrap;">
                  <i class="fa-solid fa-save"></i> Tüm Sayımı Kaydet
                </button>
              </div>
            </div>
          </div>
          
          <table id="manual-audit-table" style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">
            <thead>
              <tr>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">SAP No</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Malzeme Tanımı</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 150px;">Konum</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase;">Sistem Stoğu</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 150px;">Fiziksel Sayım</th>
                <th style="padding: 1rem; text-align: left; color: #64748B; font-weight: 600; border-bottom: 1px solid #1E293B; font-size: 0.85rem; text-transform: uppercase; width: 250px;">Fark Açıklaması</th>
              </tr>
            </thead>
            <tbody id="manual-audit-tbody">
              <tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94A3B8;">Yükleniyor...</td></tr>
            </tbody>
          </table>
          <div id="manual-audit-pagination"></div>
        </div>
      </div>
      <!-- End of view-SAYIM -->

      <!-- Audit History View -->
      <div id="view-SAYIM_GECMISI" style="display: ${currentTab === 'SAYIM_GECMISI' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.25rem;">Sayım Geçmişi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Geçmişte yapılan tüm QR ve Manuel sayım kayıtlarını burada inceleyebilirsiniz.</div>
            </div>
            <div>
              <button onclick="window.downloadAllAuditsExcel()" style="height: 42px; padding: 0 1rem; border-radius: 8px; border: 1px solid #1E293B; background-color: #111827; color: #E2E8F0; font-size: 0.9rem; font-weight: 500; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#1E293B'" onmouseout="this.style.backgroundColor='#111827'">
                <i class="fa-solid fa-file-excel" style="color: #10B981; margin-right: 0.5rem;"></i> Toplu Excel İndir
              </button>
            </div>
          </div>
          <div id="audit-history-container">
            <!-- Dynamically populated when tab is opened -->
          </div>
        </div>
      </div>
      <!-- End of view-SAYIM_GECMISI -->

      <!-- Depo Hareketleri View -->
      <div id="view-DEPO_HAREKETLERI" style="display: ${currentTab === 'DEPO_HAREKETLERI' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.25rem;">Zimmet & Depo Hareketleri</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Malzemelerin depodan zimmete alınması, saha raporlarında kullanılması ve depoya iade edilme geçmişi.</div>
            </div>
            <div style="display: flex; gap: 10px; align-items: center;">
              <input 
                id="depo-hareketleri-search" 
                type="text" 
                placeholder="SAP No veya Tanım ara..." 
                oninput="window.filterDepoHareketleri(this.value)"
                style="height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none; font-size: 0.9rem; width: 280px; transition: all 0.2s;"
                onfocus="this.style.borderColor='#14F195'"
                onblur="this.style.borderColor='#1E293B'"
              />
              ${isMaterialManager ? `
              <button onclick="window.clearAllDepoLogs()" class="btn-cyber" style="background: linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color: #FFF; font-weight: 800; border: none; height: 42px; padding: 0 1.25rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-trash-can"></i> GEÇMİŞİ TEMİZLE
              </button>
              ` : ''}
            </div>
          </div>
          <div id="depo-hareketleri-container">
            <!-- Dynamically populated when tab is opened -->
          </div>
        </div>
      </div>
      <!-- End of view-DEPO_HAREKETLERI -->

      <!-- DEFECT LİSTESİ View -->
      <div id="view-DEFECT" style="display: ${currentTab === 'DEFECT' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0; font-size: 1.25rem;">Depo Defect (Sökülen) Malzeme Listesi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Saha servis raporlarında söküldüğü belirtilen ve depoda bulunan defect malzemelerin listesi ve aksiyonları.</div>
              <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 10px;">
                <div style="align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; font-size: 0.8rem; color: var(--accent-cyan);">
                  <i class="fa-solid fa-location-dot"></i>
                  <span>${getWarehouseSite(currentWarehouse)}</span>
                </div>
                ${isMobileWarehouse ? (() => {
                  const sites = getTeamResponsibleSites(currentWarehouse.id);
                  return `
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                      <span style="font-size: 0.8rem; color: #94A3B8; font-weight: bold;">Hızlı Filtre:</span>
                      <div class="defect-site-filters" style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="site-filter-btn active" onclick="window.filterDefectListBySite(this, 'all')" style="background: rgba(20, 241, 149, 0.2); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: all 0.2s;">
                          <i class="fa-solid fa-layer-group"></i> Tümü
                        </button>
                        ${sites.map(siteName => `
                          <button class="site-filter-btn" onclick="window.filterDefectListBySite(this, '${siteName.replace(/'/g, "\\'")}')" style="background: rgba(255,255,255,0.03); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); padding: 4px 12px; border-radius: 6px; font-size: 0.8rem; font-weight: bold; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'" onmouseout="if(!this.classList.contains('active')) this.style.background='rgba(255,255,255,0.03)'">
                            <i class="fa-solid fa-location-dot"></i> ${siteName}
                          </button>
                        `).join('')}
                      </div>
                    </div>
                  `;
                })() : ''}
              </div>
            </div>
            ${hasWarehouseManagePerm ? `
            <div style="display: flex; gap: 8px;">
              <button onclick="window.bulkSendToRepair()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(20, 241, 149, 0.2);" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-screwdriver-wrench"></i> Seçilenleri Tamire Gönder
              </button>
              <button onclick="window.bulkScrap()" class="btn-cyber" style="background: linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color: #FFF; font-weight: 800; border: none; padding: 0.5rem 1rem; border-radius: 8px; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(239, 68, 68, 0.2);" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-dumpster"></i> Seçilenleri Hurdaya Ayır
              </button>
            </div>
            ` : ''}
          </div>
          
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
              <thead>
                <tr style="background: rgba(255,255,255,0.02); color: #94A3B8; border-bottom: 1px solid #1E293B;">
                  ${hasWarehouseManagePerm ? `
                  <th style="padding: 1rem; width: 40px; text-align: center;">
                    <input type="checkbox" id="defect-select-all" onclick="window.toggleAllDefects(this)" style="cursor: pointer; width: 16px; height: 16px;">
                  </th>
                  ` : ''}
                  <th style="padding: 1rem;">Tarih</th>
                  <th style="padding: 1rem;">Türbin</th>
                  <th style="padding: 1rem;">Rapor No</th>
                  <th style="padding: 1rem;">MÇF No</th>
                  <th style="padding: 1rem;">İşlem Türü</th>
                  <th style="padding: 1rem;">SAP No</th>
                  <th style="padding: 1rem;">Seri No</th>
                  <th style="padding: 1rem;">Malzeme Açıklaması</th>
                  <th style="padding: 1rem;">Arıza Kodu / Nedeni</th>
                  <th style="padding: 1rem;">Konum (Raf)</th>
                  <th style="padding: 1rem; text-align: center;">Sökülen</th>
                  <th style="padding: 1rem; text-align: right;">Aksiyonlar</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  const activeDefects = inventoryItems
                    .filter(inv => inv.condition === 'DEFECT' && inv.quantity > 0)
                    .map(inv => {
                      const reportItem = defectReportItems.find(rep => 
                        String(rep.sapNo).trim() === String(inv.sapNo).trim()
                      );
                      
                      let finalReportItem = reportItem;
                      if (!finalReportItem && currentWarehouse.id === 'MTA') {
                        for (const report of reports) {
                          if (report.materials) {
                            const mat = report.materials.find(m => String(m.sapNo).trim() === String(inv.sapNo).trim() && m.defectCount > 0);
                            if (mat) {
                              finalReportItem = {
                                reportId: report.reportNo || report.id || '',
                                reportDocId: report.id || '',
                                date: report.date,
                                matFormNo: report.matFormNo || '-',
                                turbineNo: (report.siteName ? report.siteName + ' ' : '') + (report.turbineNo || report.turbineSerial || 'Bilinmeyen'),
                                type: report.type || 'ARIZA',
                                sapNo: mat.sapNo || '-',
                                serialNo: mat.serialNo || '-',
                                description: mat.description,
                                defect: mat.defectCount || 0,
                                faultCode: report.faultCode || '-',
                                faultDesc: report.faultDesc || '-'
                              };
                              break;
                            }
                          }
                        }
                      }
                      
                      let displayDate = '-';
                      if (finalReportItem && finalReportItem.date) {
                        try {
                          displayDate = new Date(finalReportItem.date).toLocaleDateString('tr-TR');
                        } catch (e) {}
                      } else if (inv.lastUpdated) {
                        try {
                          const parsedDate = inv.lastUpdated.toDate ? inv.lastUpdated.toDate() : new Date(inv.lastUpdated);
                          displayDate = parsedDate.toLocaleDateString('tr-TR');
                        } catch (e) {
                          displayDate = new Date().toLocaleDateString('tr-TR');
                        }
                      }
                      
                      return {
                        id: inv.id,
                        sapNo: inv.sapNo,
                        description: inv.description,
                        shelfNo: (inv.shelfNo && inv.shelfNo !== 'Tanımsız') ? inv.shelfNo : 'Defect Rafı',
                        quantity: inv.quantity,
                        minStock: inv.minStock || 0,
                        imageUrl: inv.imageUrl || '',
                        displayDate,
                        turbineNo: finalReportItem?.turbineNo || '-',
                        reportId: finalReportItem?.reportId || '-',
                        reportDocId: finalReportItem?.reportDocId || '',
                        matFormNo: finalReportItem?.matFormNo || '-',
                        type: finalReportItem?.type || 'ARIZA',
                        serialNo: inv.serialNo || finalReportItem?.serialNo || '-',
                        faultCode: finalReportItem?.faultCode || '-',
                        faultDesc: finalReportItem?.faultDesc || '-',
                        defect: finalReportItem?.defect || inv.quantity || 1,
                        recoveryNotes: inv.recoveryNotes || [],
                        recoveryNote: inv.recoveryNote || '',
                        siteName: finalReportItem?.siteName || '-'
                      };
                    });

                  if (activeDefects.length === 0) {
                    return `
                      <tr>
                        <td colspan="${isMaterialManager ? 13 : 12}" style="text-align: center; padding: 3rem; color: #94A3B8; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                          Bu sahaya ait sökülen (defect) malzeme kaydı bulunamadı.
                        </td>
                      </tr>
                    `;
                  }

                  // Group by reportId (fallback to manual)
                  const groups = new Map();
                  activeDefects.forEach(item => {
                    const groupKey = item.reportId !== '-' ? item.reportId : 'manual';
                    if (!groups.has(groupKey)) {
                      groups.set(groupKey, {
                        displayDate: item.displayDate,
                        turbineNo: item.turbineNo !== '-' ? item.turbineNo : (groupKey === 'manual' ? 'Manuel Eklenenler' : 'Belirsiz Türbin'),
                        reportId: item.reportId,
                        matFormNo: item.matFormNo,
                        type: item.type,
                        faultCode: item.faultCode,
                        faultDesc: item.faultDesc,
                        items: []
                      });
                    }
                    groups.get(groupKey).items.push(item);
                  });

                  let htmlResult = '';
                  groups.forEach((group: any, key: string) => {
                    const cleanKey = key.replace(/[^a-zA-Z0-9-]/g, '_');
                    const totalQty = group.items.reduce((sum: number, it: any) => sum + (it.defect || 1), 0);
                    
                    // Group Header Row
                    htmlResult += `
                      <tr id="group-header-${cleanKey}" onclick="window.toggleDefectGroupCollapse('${cleanKey}')" style="cursor: pointer; background: rgba(20, 241, 149, 0.03); border-bottom: 1px solid rgba(255,255,255,0.06); font-weight: bold; transition: background 0.2s;" onmouseover="this.style.background='rgba(20, 241, 149, 0.06)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.03)'">
                        ${hasWarehouseManagePerm ? `
                        <td style="padding: 0.75rem 1rem; text-align: center;" onclick="event.stopPropagation();">
                          <input type="checkbox" onchange="window.toggleDefectGroup(this, '${cleanKey}')" style="cursor: pointer; width: 16px; height: 16px;">
                        </td>
                        ` : ''}
                        <td style="padding: 0.75rem 1rem; color: #14F195; white-space: nowrap;">
                          <i class="fa-solid fa-chevron-right toggle-icon" style="margin-right: 8px; transition: transform 0.2s; display: inline-block;"></i>
                          ${group.displayDate}
                        </td>
                        <td style="padding: 0.75rem 1rem; color: #FFF; font-weight: 700;">${group.turbineNo}</td>
                        <td style="padding: 0.75rem 1rem; color: #94A3B8; font-family: monospace;">${group.reportId}</td>
                        <td style="padding: 0.75rem 1rem; color: #F59E0B; font-weight: 800;">${group.matFormNo}</td>
                        <td style="padding: 0.75rem 1rem;">
                          ${group.reportId !== '-' ? `
                            <span style="padding: 2px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;
                              ${group.type === 'BAKIM' ? 'background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3);' : 
                                'background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3);'}">
                              ${group.type === 'BAKIM' ? 'Bakım' : 'Arıza'}
                            </span>
                          ` : '-'}
                        </td>
                        <td colspan="5" style="padding: 0.75rem 1rem; color: #E2E8F0; font-size: 0.8rem; font-weight: normal;">
                          ${group.reportId !== '-' && group.faultCode !== '-' ? `
                            <span style="font-weight: 600; color: #FFF; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1); margin-right: 8px;">${group.faultCode}</span>
                            ${group.faultDesc && group.faultDesc !== '-' ? `<span style="color: #94A3B8;">${group.faultDesc}</span>` : ''}
                          ` : (key === 'manual' ? '<span style="color: #94A3B8; font-style: italic;">Manuel Depo Kayıtları</span>' : '-')}
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: center; color: #f87171; font-weight: 800; font-family: monospace; font-size: 0.9rem;">
                          ${totalQty} Ad.
                        </td>
                        <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap;" onclick="event.stopPropagation(); window.toggleDefectGroupCollapse('${cleanKey}')">
                          <span class="expand-text" style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: bold; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.2); padding: 3px 8px; border-radius: 4px; transition: all 0.2s;"><i class="fa-solid fa-expand"></i> Göster</span>
                        </td>
                      </tr>
                    `;

                    // Child rows
                    group.items.forEach((item: any) => {
                      const cleanNameEscaped = (item.description || 'Bilinmeyen Malzeme').replace(/'/g, "\\'");
                      
                      htmlResult += `
                        <tr class="defect-row group-row-${cleanKey}" data-site="${item.siteName}" style="display: none; border-bottom: 1px solid rgba(255,255,255,0.02); background: rgba(0, 0, 0, 0.22); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='rgba(0, 0, 0, 0.22)'">
                          ${hasWarehouseManagePerm ? `
                          <td style="padding: 0.75rem 1rem; text-align: center;">
                            <input type="checkbox" class="defect-row-checkbox group-checkbox-${cleanKey}" 
                              data-id="${item.id}" 
                              data-sap="${item.sapNo}" 
                              data-name="${cleanNameEscaped}" 
                              data-qty="${item.defect}" 
                              data-serial="${item.serialNo || '-'}" 
                              data-faultcode="${item.faultCode || '-'}" 
                              data-faultdesc="${item.faultDesc ? item.faultDesc.replace(/'/g, "\\'") : '-'}" 
                              style="cursor: pointer; width: 16px; height: 16px;">
                          </td>
                          ` : ''}
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.4); font-size: 0.8rem; padding-left: 2rem; white-space: nowrap;">↳ ${item.displayDate}</td>
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.5); font-size: 0.8rem;">${item.turbineNo}</td>
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.4); font-family: monospace; font-size: 0.75rem;">${item.reportId}</td>
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.4); font-size: 0.8rem;">${item.matFormNo}</td>
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.3); font-size: 0.8rem;">-</td>
                          <td style="padding: 0.75rem 1rem; color: var(--accent-cyan); font-family: monospace; font-weight: bold;">${item.sapNo}</td>
                          <td style="padding: 0.75rem 1rem; color: #10B981; font-family: monospace; font-weight: bold;">${item.serialNo || '-'}</td>
                          <td style="padding: 0.75rem 1rem; font-weight: 500; color: #E2E8F0;">${item.description}</td>
                          <td style="padding: 0.75rem 1rem; color: rgba(255,255,255,0.6); font-size: 0.8rem;">
                            ${item.faultCode !== '-' ? `
                              <span style="font-weight: 600; color: #94A3B8;">${item.faultCode}</span>
                              ${item.faultDesc && item.faultDesc !== '-' ? `<div style="font-size: 0.7rem; color: rgba(255,255,255,0.4); margin-top: 1px;">${item.faultDesc}</div>` : ''}
                            ` : '-'}
                          </td>
                          <td style="padding: 0.75rem 1rem; color: #14F195; font-weight: 600;">${item.shelfNo}</td>
                          <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #f87171; font-family: monospace;">${item.defect}</td>
                          <td style="padding: 0.75rem 1rem; text-align: right; white-space: nowrap;">
                            <div style="display: flex; gap: 8px; justify-content: flex-end; align-items: center;">
                              ${(hasWarehouseManagePerm || hasWarehouseDeletePerm) ? `
                                ${hasWarehouseManagePerm ? `
                                  <i onclick="window.returnDefectToInventory('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', '${item.serialNo !== '-' ? item.serialNo : ''}', '${item.turbineNo !== '-' ? item.turbineNo : ''}', '${item.reportId !== '-' ? item.reportId : ''}')" class="fa-solid fa-reply" style="cursor: pointer; opacity: 0.7; color: #14F195; margin-right: 0.5rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Sağlam Olarak Stoğa Geri Al"></i>
                                ` : ''}
                                ${item.recoveryNotes || item.recoveryNote ? `
                                  <i onclick="window.showRecoveryInfoList('${item.id}')" class="fa-solid fa-circle-info" style="cursor: pointer; opacity: 0.7; color: #60A5FA; margin-right: 0.5rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Geri Kazanım Geçmişini Gör"></i>
                                ` : ''}
                                ${hasWarehouseManagePerm ? `
                                  <i id="edit-btn-${item.id}" onclick="window.openDefectEditModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', '${item.serialNo || ''}', '${item.reportDocId || ''}')" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.7; color: #E2E8F0; margin-right: 0.5rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Seri No Düzenle"></i>
                                ` : ''}
                                ${hasWarehouseDeletePerm ? `
                                  <i onclick="window.deleteItem('${item.id}', '${cleanNameEscaped}')" class="fa-solid fa-trash" style="cursor: pointer; opacity: 0.7; color: #EF4444; margin-right: 0.5rem; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.7'" title="Sil"></i>
                                ` : ''}
                              ` : `
                                <span style="color: #64748B; font-size: 0.75rem; font-style: italic;"><i class="fa-solid fa-info-circle"></i> Sadece Bilgi</span>
                              `}
                            </div>
                          </td>
                        </tr>
                      `;
                    });
                  });
                  return htmlResult;
                })()}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <!-- End of view-DEFECT -->

      <!-- view-TRANSFERLER -->
      <div id="view-TRANSFERLER" style="display: ${currentTab === 'TRANSFERLER' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 1.5rem;">
          <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; color: var(--accent-cyan); font-weight: 800; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
            <i class="fa-solid fa-truck-ramp-box"></i> Depo Transferleri / Sevk Hareketleri (MSF)
          </h3>
          <div id="warehouse-transfers-container">
            <!-- Dynamic transfers list will render here -->
          </div>
        </div>
      </div>


      <!-- Defect Edit Modal -->
      <div id="new-warehouse-defect-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 450px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <i class="fa-solid fa-pen-to-square" style="margin-right: 8px;"></i> Seri No Düzenle (Defect)
            </h3>
            <button onclick="window.closeDefectEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <input type="hidden" id="defect-edit-item-id">
            <input type="hidden" id="defect-edit-report-doc-id">
            
            <div>
              <p style="color: #94A3B8; font-size: 0.8rem; margin: 0 0 0.25rem 0; font-weight: 600;">MALZEME TANIMI</p>
              <div id="defect-edit-name-text" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; color: #FFF; font-weight: 500; font-size: 0.9rem;"></div>
            </div>

            <div>
              <span style="color: #64748B; font-size: 0.75rem;">SAP Numarası:</span>
              <span id="defect-edit-sap-text" style="color: #14F195; font-weight: 600; display: block; font-family: monospace; font-size: 0.95rem; margin-top: 2px;"></span>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Seri Numarası</label>
              <input id="defect-edit-serial-input" type="text" placeholder="Seri numarasını girin" style="width: 100%; height: 42px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.95rem; font-family: monospace; outline: none;">
            </div>
            
            <button onclick="window.saveDefectEditItem(this)" style="height: 44px; margin-top: 0.5rem; border-radius: 8px; border: none; background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-size: 0.95rem; font-weight: 800; cursor: pointer; width: 100%; box-shadow: 0 0 15px rgba(20,241,149,0.25); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">Değişiklikleri Kaydet</button>
          </div>
        </div>
      </div>

      <!-- MTA Edit Modal -->
      <div id="new-warehouse-mta-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 450px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
            <h3 style="font-size: 1.25rem; font-weight: 700; color: #14F195; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <i class="fa-solid fa-pen-to-square" style="margin-right: 8px;"></i> Seri No & Not Düzenle
            </h3>
            <button onclick="window.closeMtaEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <input type="hidden" id="mta-edit-item-id">
            
            <div>
              <p style="color: #94A3B8; font-size: 0.8rem; margin: 0 0 0.25rem 0; font-weight: 600;">MALZEME TANIMI</p>
              <div id="mta-edit-name-text" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; color: #FFF; font-weight: 500; font-size: 0.9rem;"></div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem;">
              <div>
                <span style="color: #64748B; font-size: 0.75rem;">SAP Numarası:</span>
                <span id="mta-edit-sap-text" style="color: #14F195; font-weight: 600; display: block; font-family: monospace; font-size: 0.95rem; margin-top: 2px;"></span>
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.75rem;">Miktar:</span>
                <input id="mta-edit-qty-input" type="number" min="0" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.5rem; font-size: 0.9rem; outline: none; margin-top: 2px;">
              </div>
              <div>
                <span style="color: #64748B; font-size: 0.75rem;">Raf Konumu (MTA):</span>
                <input id="mta-edit-loc-input" type="text" placeholder="Örn: A-1" style="width: 100%; height: 38px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.5rem; font-size: 0.9rem; outline: none; margin-top: 2px;">
              </div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Seri Numarası</label>
              <input id="mta-edit-serial-input" type="text" placeholder="Seri numarasını girin" style="width: 100%; height: 42px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.95rem; font-family: monospace; outline: none;">
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; font-weight: 700; text-transform: uppercase;">Not / Açıklama</label>
              <textarea id="mta-edit-note-input" placeholder="Malzeme hakkında eklemek istediğiniz not..." style="width: 100%; height: 90px; background-color: rgba(0,0,0,0.3); border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0.75rem 1rem; font-size: 0.9rem; outline: none; resize: none;"></textarea>
            </div>
            
            <button onclick="window.saveMtaEditItem(this)" style="height: 44px; margin-top: 0.5rem; border-radius: 8px; border: none; background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-size: 0.95rem; font-weight: 800; cursor: pointer; width: 100%; box-shadow: 0 0 15px rgba(20,241,149,0.25); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">Değişiklikleri Kaydet</button>
          </div>
        </div>
      </div>

      <!-- Edit Modal -->
      <div id="new-warehouse-edit-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Malzemeyi Düzenle</h3>
            <button onclick="window.closeEditModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="edit-item-id">
            
            <div style="display: flex; gap: 1rem; align-items: flex-start;">
                <div style="width: 100px; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                    <img id="edit-img-preview" src="" style="display: none; width: 100px; height: 100px; object-fit: cover; border-radius: 8px; border: 1px solid #1E293B; background: #111827;">
                    <div style="display: flex; flex-direction: column; width: 100%; gap: 0.25rem;">
                        <label for="edit-img-input" style="width: 100%; text-align: center; font-size: 0.75rem; color: #94A3B8; cursor: pointer; padding: 4px; border: 1px dashed #334155; border-radius: 6px; transition: color 0.2s;" onmouseover="this.style.color='#14F195'" onmouseout="this.style.color='#94A3B8'">
                            <i class="fa-solid fa-camera" style="margin-right: 4px;"></i> Resmi Değiştir
                        </label>
                        <button onclick="window.deleteEditImage()" style="width: 100%; text-align: center; font-size: 0.75rem; color: #EF4444; background: transparent; cursor: pointer; padding: 4px; border: 1px solid #EF4444; border-radius: 6px; transition: background 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.1)'" onmouseout="this.style.background='transparent'">
                            <i class="fa-solid fa-trash" style="margin-right: 4px;"></i> Resmi Sil
                        </button>
                    </div>
                    <input id="edit-img-input" type="file" accept="image/*" style="display: none;" onchange="
                        const file = this.files[0];
                        if (file) {
                            const reader = new FileReader();
                            reader.onload = e => {
                                const preview = document.getElementById('edit-img-preview');
                                preview.src = e.target.result;
                                preview.style.display = 'block';
                            };
                            reader.readAsDataURL(file);
                        }
                    ">
                </div>
                
                <div style="flex: 1; display: flex; flex-direction: column; gap: 1rem;">
                    <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">SAP Numarası</label>
              <input id="edit-sap-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Malzeme Tanımı</label>
              <input id="edit-name-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Miktar</label>
                <input id="edit-qty-input" type="number" min="0" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Raf Konumu</label>
                <input id="edit-loc-input" type="text" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
              </div>
            </div>
            
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Kritik Limit (Opsiyonel)</label>
              <input id="edit-min-stock-input" type="number" min="0" placeholder="Örn: 5" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>

            <input type="hidden" id="edit-old-qty-input">
            
            <div id="edit-stock-entry-details" style="display: none; flex-direction: column; gap: 0.75rem; border-top: 1px dashed #1E293B; padding-top: 0.75rem; margin-top: 0.5rem; text-align: left;">
              <h4 style="font-size: 0.8rem; font-weight: 700; color: #14F195; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Malzeme Giriş Bilgileri (Miktar Artışı)</h4>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Malzeme Nereden Geldi?</label>
                <input id="edit-source-input" type="text" placeholder="Örn: Merkez Depo, Tedarikçi, Saha vb." style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                  <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">İrsaliye / Delivery Note</label>
                  <input id="edit-delivery-input" type="text" placeholder="Varsa irsaliye no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
                </div>
                <div>
                  <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Fatura Numarası</label>
                  <input id="edit-invoice-input" type="text" placeholder="Varsa fatura no" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
                </div>
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Güncelleyen Personel</label>
                <input id="edit-updatedby-input" type="text" placeholder="Ad Soyad" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
              <div>
                <label style="display: block; font-size: 0.75rem; color: #94A3B8; margin-bottom: 0.25rem; text-transform: uppercase;">Not / Açıklama</label>
                <input id="edit-entry-note-input" type="text" placeholder="Varsa eklemek istediğiniz not" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 0.75rem; font-size: 0.85rem; outline: none;">
              </div>
            </div>
            
            </div> <!-- End of inputs flex: 1 -->
            </div> <!-- End of main image+inputs flex container -->
            
            <button onclick="window.saveEditItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Değişiklikleri Kaydet</button>
          </div>
        </div>
      </div>

      <!-- Transfer Modal -->
      <div id="new-warehouse-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Transfer Et</h3>
            <button onclick="window.closeTransferModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="transfer-item-id">
            <div id="transfer-info" style="color: #E2E8F0; font-size: 0.9rem; margin-bottom: 0.5rem;"></div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Hedef Depo</label>
              <select id="transfer-target-input" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
                ${targetOptions.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Transfer Miktarı</label>
              <input id="transfer-qty-input" type="number" min="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
            </div>
            <button onclick="window.saveTransferItem(this)" style="height: 42px; margin-top: 0.5rem; border-radius: 8px; border: none; background-color: #3B82F6; color: #FFFFFF; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Transferi Başlat</button>
          </div>
        </div>
      </div>

      <!-- History Modal -->
      <div id="new-warehouse-history-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 id="history-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">Geçmiş</h3>
            <button onclick="window.closeHistoryModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="history-list" style="display: flex; flex-direction: column; max-height: 400px; overflow-y: auto;">
          </div>
        </div>
      </div>

      <!-- QR Scanner Modal -->
      <div id="qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 500px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;"><i class="fa-solid fa-qrcode" style="color: #14F195; margin-right: 8px;"></i> QR Barkod Okuyucu</h3>
            <button onclick="window.closeQRModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="qr-reader" style="width: 100%; margin-bottom: 1rem; border-radius: 12px; overflow: hidden; border: 2px solid #1E293B;"></div>
          <div id="qr-reader-results"></div>
        </div>
      </div>

      <!-- Big QR Display Modal -->
      <div id="big-qr-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;">
          <h3 id="big-qr-title" style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0 0 1.5rem 0;">Ürün QR Kodu</h3>
          <img id="big-qr-img" src="" style="width: 100%; max-width: 300px; border-radius: 8px; margin-bottom: 1.5rem; border: 4px solid #FFFFFF; background: #FFFFFF;" />
          <div style="display: flex; gap: 0.5rem; margin-top: 1rem;">
            <button onclick="window.printSingleQRFromModal()" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Yazdır</button>
            <button onclick="window.closeBigQR()" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
          </div>
        </div>
      </div>

      <!-- Big Image Display Modal -->
      <div id="big-image-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 90%; max-width: 600px; padding: 2rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center; position: relative;">
          <button onclick="document.getElementById('big-image-modal').style.display='none'" style="position: absolute; top: 1rem; right: 1rem; background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.5rem; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#64748B'"><i class="fa-solid fa-xmark"></i></button>
          <h3 id="big-image-title" style="font-size: 1.1rem; font-weight: 600; color: #E2E8F0; margin: 0 0 1.5rem 0; padding-right: 2rem; text-align: left;">Ürün Görseli</h3>
          <img id="big-image-img" src="" style="width: 100%; max-height: 60vh; object-fit: contain; border-radius: 8px; margin-bottom: 0;" />
        </div>
      </div>

      <!-- P2P QR Transfer Modal -->
      <div id="p2p-transfer-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.8); backdrop-filter: blur(4px); z-index: 1000; align-items: center; justify-content: center;">
        <div style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 16px; width: 100%; max-width: 400px; padding: 1.5rem; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); text-align: center;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h3 style="font-size: 1.25rem; font-weight: 600; color: #FFFFFF; margin: 0;">QR Transfer Kodu Oluştur</h3>
            <button onclick="window.closeP2PTransferModal()" style="background: none; border: none; color: #64748B; cursor: pointer; font-size: 1.25rem;"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div style="display: flex; flex-direction: column; gap: 1rem; text-align: left;">
            <input type="hidden" id="p2p-item-id">
            <input type="hidden" id="p2p-item-sap">
            <input type="hidden" id="p2p-item-name">
            <div id="p2p-info" style="color: #E2E8F0; font-size: 0.9rem; margin-bottom: 0.5rem; font-weight: 500;"></div>
            
            <div id="p2p-input-container">
              <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Transfer Edilecek Miktar</label>
              <input id="p2p-qty-input" type="number" min="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; margin-bottom: 1rem;">
              <button onclick="window.generateP2PQR()" style="height: 42px; border-radius: 8px; border: none; background-color: #14F195; color: #0A0E17; font-size: 0.95rem; font-weight: 700; cursor: pointer; width: 100%;">QR Kod Üret</button>
            </div>

            <div id="p2p-qr-display" style="display: none; text-align: center; margin-top: 0.5rem;">
              <div style="background: #FFFFFF; padding: 1rem; border-radius: 8px; display: inline-block; margin-bottom: 1rem;">
                <img id="p2p-qr-img" src="" style="width: 200px; height: 200px;" />
              </div>
              <p style="color: #94A3B8; font-size: 0.85rem; line-height: 1.4; margin: 0 0 1rem 0;">
                Karşı taraftaki teknisyen bu QR kodu kendi cihazından <strong>QR Okuyucu</strong> ile taradığında transfer gerçekleşecektir.
              </p>
              <button onclick="window.closeP2PTransferModal()" style="height: 42px; border-radius: 8px; border: 1px solid #334155; background: #1E293B; color: #E2E8F0; font-size: 0.95rem; font-weight: 600; cursor: pointer; width: 100%;">Kapat</button>
            </div>
          </div>
        </div>
      </div>

      <input type="file" id="item-image-upload" accept="image/*" style="display:none;" />

    </div>
  `;
};

// Expose filter functions
(window as any).setWarehouseAnalyticsPeriod = (period: string) => {
  localStorage.setItem('warehouse_analytics_period', period);
  if ((window as any).updateWarehouseUI) {
      (window as any).updateWarehouseUI(undefined, undefined, undefined, undefined, 'ANALİZ');
  }
};

(window as any).setWarehouseAnalyticsSap = (sap: string) => {
  localStorage.setItem('warehouse_analytics_sap', sap);
  if ((window as any).updateWarehouseUI) {
      (window as any).updateWarehouseUI(undefined, undefined, undefined, undefined, 'ANALİZ');
  }
};

(window as any).setCustomWarehouseAnalyticsPeriod = () => {
  const start = (document.getElementById('warehouse-analytics-start') as HTMLInputElement)?.value;
  const end = (document.getElementById('warehouse-analytics-end') as HTMLInputElement)?.value;
  if (start && end) {
    localStorage.setItem('warehouse_analytics_start', start);
    localStorage.setItem('warehouse_analytics_end', end);
    (window as any).setWarehouseAnalyticsPeriod('custom');
  } else {
    alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
  }
};

(window as any).exportTurbineAnalytics = async () => {
   const data = (window as any).currentTurbineData;
   const name = (window as any).currentWarehouseName;
   const period = localStorage.getItem('warehouse_analytics_period') || 'this-month';
   if (!data || Object.keys(data).length === 0) {
      alert('Dışa aktarılacak analiz verisi bulunamadı.');
      return;
   }
   const { excelService } = await import('../services/ExcelService');
   await excelService.exportTurbineAnalytics(data, name, period);
};

(window as any).downloadInventoryExcel = async () => {
   const inventory = (window as any).currentInventoryData || [];
   const audits = (window as any).__cachedAudits || [];
   const name = (window as any).currentWarehouseName || 'Depo';
   
   if (inventory.length === 0) {
      alert('İndirilecek envanter verisi bulunamadı veya henüz yüklenmedi.');
      return;
   }
   
   const { excelService } = await import('../services/ExcelService');
   await excelService.exportToExcel(inventory, audits, name + ' Envanteri');
};

(window as any).downloadSingleAuditExcel = async (auditId: string) => {
   const audits = (window as any).__cachedAudits || [];
   const audit = audits.find((a: any) => a.id === auditId);
   const name = (window as any).currentWarehouseName || 'Depo';
   const inventory = (window as any).currentInventoryData || [];
   
   if (!audit) {
      alert('İndirilecek sayım kaydı bulunamadı.');
      return;
   }
   
   const { excelService } = await import('../services/ExcelService');
   const { warehouseService } = await import('../services/WarehouseService');
   const activeWhId = (window as any).currentWarehouseId || 'MTA';
   const logs = await warehouseService.getLogs(activeWhId);
   
   excelService.exportSingleAuditToExcel(audit, name, inventory, audits, logs);
};

(window as any).downloadAllAuditsExcel = async () => {
   const audits = (window as any).__cachedAudits || [];
   const name = (window as any).currentWarehouseName || 'Depo';
   const inventory = (window as any).currentInventoryData || [];
   
   if (audits.length === 0) {
      alert('İndirilecek sayım geçmişi bulunamadı veya henüz yüklenmedi.');
      return;
   }
   
   const { excelService } = await import('../services/ExcelService');
   excelService.exportAllAuditsToExcel(audits, name, inventory);
};

(window as any).loadDepoHareketleriLogs = async () => {
  const container = document.getElementById('depo-hareketleri-container');
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
    try {
      const { warehouseService } = await import('../services/WarehouseService');
      const activeWhId = (window as any).currentWarehouseId || 'MTA';
      const logs = await warehouseService.getLogs(activeWhId);
      (window as any).__cachedDepoLogs = logs;
      if (typeof (window as any).renderDepoHareketleriLogs === 'function') {
        (window as any).renderDepoHareketleriLogs();
      }
    } catch (err: any) {
      console.error(err);
      container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu: ${err.message}</div>`;
    }
  }
};

(window as any).toggleAuditDetails = (auditId: string) => {
  const el = document.getElementById(`audit-details-${auditId}`);
  const icon = document.getElementById(`audit-toggle-icon-${auditId}`);
  if (el) {
    if (el.style.display === 'none') {
      el.style.display = 'block';
      if (icon) {
        icon.className = 'fa-solid fa-chevron-up';
      }
    } else {
      el.style.display = 'none';
      if (icon) {
        icon.className = 'fa-solid fa-chevron-down';
      }
    }
  }
};

(window as any).printWarehouseQR = async () => {
   const inventory = (window as any).currentInventoryData || [];
   const name = (window as any).currentWarehouseName || 'Depo';
   
   if (inventory.length === 0) {
      alert('Basılacak envanter verisi bulunamadı veya henüz yüklenmedi.');
      return;
   }

   // Get selected item IDs
   const checkboxes = document.querySelectorAll('.item-checkbox:checked');
   const checkedIds = Array.from(checkboxes).map((cb: any) => cb.value);

   let itemsToPrint = [];
   if (checkedIds.length > 0) {
      itemsToPrint = inventory.filter((item: any) => checkedIds.includes(item.id));
      if (!confirm(`${itemsToPrint.length} adet seçili malzeme için QR etiket şablonu (TW-2014) hazırlanacak. Devam edilsin mi?`)) {
          return;
      }
   } else {
      if (!confirm(`Herhangi bir malzeme seçilmedi. Tüm envanter (${inventory.length} adet malzeme) için toplu QR etiket basılsın mı?`)) {
          return;
      }
      itemsToPrint = inventory;
   }
   
   const { qrService } = await import('../services/QRService');
   const items = itemsToPrint.map((item: any) => ({
       id: item.id,
       sapNo: item.sapNo,
       description: item.description,
       warehouseId: (window as any).currentWarehouseId
   }));
   
   await qrService.printBulkLabels(items);
};

// Global toggle for UI
(window as any).toggleTurbineAccordion = (id: string) => {
  const content = document.getElementById(id);
  const icon = document.getElementById(id.replace('acc-', 'acc-icon-'));
  if (content && icon) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.style.transform = 'rotate(180deg)';
    } else {
      content.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
};
