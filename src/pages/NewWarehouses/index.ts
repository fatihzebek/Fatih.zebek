import { formatTeamName } from '../../utils/formatters';
import { dataService } from '../../services/DataService';
import { db } from '../../firebase';
import { collection, query, where, onSnapshot, doc, getDoc, getCountFromServer, orderBy, getDocs } from 'firebase/firestore';
import { warehouseState, getUserProfile, getTeamResponsibleSites, getWarehouseSite } from './WarehouseState';
import { renderTabsHTML } from './WarehouseTabs';
import { renderModalsHTML } from './WarehouseModals';
import { inventoryService } from '../../services/InventoryService';
import { warehouseService } from '../../services/WarehouseService';
import QRCode from 'qrcode';

// Import sub-modules to register their window-attached functions
import './WarehouseState';
import './WarehouseTabs';
import './WarehouseModals';
import './WarehouseAudit';
import './WarehouseOperations';

export const renderWarehouseDashboardHTML = (allowedMain: any[], allowedTeams: any[]) => {
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

      .wh-agent-card:hover {
        color: #00f3ff;
      }

      .wh-agent-card.team:hover {
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
        <div style="font-size: 0.9rem; color: #64748B; margin-top: 0.25rem;">Sahaların stok, envanter and mobil zimmet yönetim paneli</div>
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

  warehouseState.userProfile = userProfile;
  warehouseState.isMaterialManager = isMaterialManager;
  warehouseState.hasWarehouseDeletePerm = hasWarehouseDeletePerm;
  warehouseState.hasWarehouseManagePerm = hasWarehouseManagePerm;

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
    
    setTimeout(async () => {
      try {
        const allWhIds = [
          ...allowedMainWarehouses.map(w => w.id),
          ...teamWarehouses.map(w => w.id)
        ];
        
        await Promise.all(allWhIds.map(async (whId) => {
          try {
            const collRef = collection(db, 'warehouses', whId, 'inventory_v2');
            const totalSnapshot = await getCountFromServer(collRef);
            const totalCount = totalSnapshot.data().count;
            
            const defectQuery = query(collRef, where('condition', '==', 'DEFECT'));
            const defectSnapshot = await getCountFromServer(defectQuery);
            const defectCount = defectSnapshot.data().count;
            
            const normalCount = Math.max(0, totalCount - defectCount);

            const el = document.getElementById(`wh-count-${whId}`);
            if (el) el.innerText = `Stok: ${normalCount} Adet`;
            
            const defectEl = document.getElementById(`wh-defect-${whId}`);
            if (defectEl) {
              defectEl.innerText = `Defekt: ${defectCount} Adet`;
              if (defectCount > 0) defectEl.style.display = 'inline-block';
              else defectEl.style.display = 'none';
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
    };
  }

  if (!currentWarehouse) {
    return `<div style="padding: 2rem; color: #EF4444;">Depo bulunamadı veya erişim izniniz yok.</div>`;
  }

  warehouseState.currentWarehouse = currentWarehouse;
  (window as any).currentWarehouseId = currentWarehouse.id;
  (window as any).currentWarehouseName = currentWarehouse.name;

  const isMobileWarehouse = currentWarehouse.id.startsWith('team_');
  warehouseState.isMobileWarehouse = isMobileWarehouse;

  const targetOptions = allWarehouses
    .filter(w => w.id !== currentWarehouse.id)
    .map(w => ({ id: w.id, name: w.name }));
  
  for (let i = 1; i <= 15; i++) {
    const teamName = `Team ${String(i).padStart(2, '0')}`;
    const teamId = `team_${teamName.replace(/\s+/g, '_')}`;
    if (teamId !== currentWarehouse.id) {
      targetOptions.push({ id: teamId, name: `${teamName} Deposu` });
    }
  }
  warehouseState.targetOptions = targetOptions;
  (window as any)._warehouseTargetOptions = targetOptions;

  // Real-time notifications and returns
  let pendingReturns: any[] = [];
  try {
     const { repairService } = await import('../../services/RepairService');
     const allRepairs = await repairService.getRepairs();
     pendingReturns = allRepairs.filter(r => r.status === 'SENT_BACK' && r.targetWarehouseId === currentWarehouse.id);
  } catch (err) {
     console.warn("Could not retrieve pending returns:", err);
  }
  warehouseState.pendingReturns = pendingReturns;

  const currentTab = ((window as any).currentWarehouseTab || 'inventory').toUpperCase();
  const currentPeriod = localStorage.getItem('warehouse_analytics_period') || 'this-month';
  const customStart = localStorage.getItem('warehouse_analytics_start') || '';
  const customEnd = localStorage.getItem('warehouse_analytics_end') || '';
  const analyticsSap = localStorage.getItem('warehouse_analytics_sap') || '';

  // Load analytics reports
  let defectReportItems: any[] = [];
  let sortedTurbines: any[] = [];
  let reports: any[] = [];

  if (currentWarehouse.id !== 'MTA') {
    try {
      const { serviceReportService } = await import('../../services/ServiceReportService');
      const allReports = await serviceReportService.getAllReports();
      const responsibleSites = getTeamResponsibleSites(currentWarehouse.id);
      
      reports = allReports.filter((rep: any) => {
         if (isMobileWarehouse) {
            const assignmentTeam = rep.assignment?.assignedTeam ? formatTeamName(rep.assignment.assignedTeam) : '';
            const whTeam = formatTeamName(currentWarehouse.name.replace('Deposu', ''));
            return assignmentTeam === whTeam;
         } else {
            const matchesSite = responsibleSites.some(siteName => {
               const repSiteLower = String(rep.siteName || '').toLowerCase().trim();
               const targetSiteLower = String(siteName).toLowerCase().trim();
               return repSiteLower.includes(targetSiteLower) || targetSiteLower.includes(repSiteLower);
            });
            return matchesSite;
         }
      });

      // Filter by period
      const now = new Date();
      reports = reports.filter((rep: any) => {
        if (!rep.date) return false;
        const repDate = new Date(rep.date);
        
        if (currentPeriod === 'this-week') {
          const oneWeekAgo = new Date();
          oneWeekAgo.setDate(now.getDate() - 7);
          return repDate >= oneWeekAgo;
        } else if (currentPeriod === 'this-month') {
          return repDate.getMonth() === now.getMonth() && repDate.getFullYear() === now.getFullYear();
        } else if (currentPeriod === 'last-month') {
          const lm = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
          const ly = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
          return repDate.getMonth() === lm && repDate.getFullYear() === ly;
        } else if (currentPeriod === 'this-year') {
          return repDate.getFullYear() === now.getFullYear();
        } else if (currentPeriod === 'custom' && customStart && customEnd) {
          const start = new Date(customStart);
          const end = new Date(customEnd);
          end.setHours(23, 59, 59, 999);
          return repDate >= start && repDate <= end;
        }
        return true; // 'all'
      });

      // Map defect items from reports
      reports.forEach((rep: any) => {
        const materials = rep.materials || [];
        materials.forEach((m: any) => {
          if (m.defectCount > 0) {
            defectReportItems.push({
              reportId: rep.reportNo || rep.id || '',
              reportDocId: rep.id || '',
              date: rep.date,
              matFormNo: rep.matFormNo || '-',
              turbineNo: (rep.siteName ? rep.siteName + ' ' : '') + (rep.turbineNo || rep.turbineSerial || 'Bilinmeyen'),
              type: rep.type || 'ARIZA',
              sapNo: m.sapNo || '-',
              serialNo: m.serialNo || '-',
              description: m.description,
              defect: m.defectCount || 0,
              faultCode: rep.faultCode || '-',
              faultDesc: rep.faultDesc || '-',
              siteName: rep.siteName || '-'
            });
          }
        });
      });

      // Group and sort turbine analytics data
      const turbineGroups: Record<string, { totalUsed: number; totalDefect: number; items: any[] }> = {};
      reports.forEach((rep: any) => {
        const tId = (rep.siteName ? rep.siteName + ' ' : '') + (rep.turbineNo || rep.turbineSerial || 'Bilinmeyen');
        const materials = rep.materials || [];
        
        materials.forEach((m: any) => {
          const matchesSap = !analyticsSap || 
            String(m.sapNo).includes(analyticsSap) || 
            String(m.description).toLowerCase().includes(analyticsSap.toLowerCase());
            
          if (matchesSap && (m.used > 0 || m.defectCount > 0)) {
            if (!turbineGroups[tId]) {
              turbineGroups[tId] = { totalUsed: 0, totalDefect: 0, items: [] };
            }
            turbineGroups[tId].totalUsed += m.used || 0;
            turbineGroups[tId].totalDefect += m.defectCount || 0;
            turbineGroups[tId].items.push({
              date: rep.date,
              reportId: rep.reportNo || rep.id || '',
              reportDocId: rep.id || '',
              matFormNo: rep.matFormNo || '-',
              faultCode: rep.faultCode || '-',
              faultDesc: rep.faultDesc || '-',
              sapNo: m.sapNo || '-',
              serialNo: m.serialNo || '-',
              description: m.description,
              used: m.used || 0,
              defect: m.defectCount || 0
            });
          }
        });
      });

      sortedTurbines = Object.entries(turbineGroups).sort((a, b) => b[0].localeCompare(a[0]));
      (window as any).currentTurbineData = turbineGroups;

    } catch (err) {
       console.error("Failed to load warehouse report analytics:", err);
    }
  }

  // Load draft data for manual audit
  let draftData: any = {};
  let startTime = '';
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

  if (Object.keys(draftData).length > 0) {
     if (!startTime) {
        startTime = localStorage.getItem(`draft_audit_start_time_${currentWarehouse.id}`) || '';
     }
     if (!startTime) {
        startTime = new Date().toISOString();
        localStorage.setItem(`draft_audit_start_time_${currentWarehouse.id}`, startTime);
     }
  }
  
  warehouseState.draftData = draftData;
  warehouseState.startTime = startTime;

  // Set up all Logic callbacks in window object (coordinating registration)
  (window as any).initNewWarehouseLogic = () => {
     setupWarehouseLogic(currentWarehouse);
  };

  // HTML Layout
  return `
    <div style="background-color: #0A0E17; min-height: 100vh; color: #E2E8F0; font-family: 'Inter', sans-serif; padding: 2rem; box-sizing: border-box; position: relative;">
      
      <!-- Header Section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <button onclick="window.selectWarehouseAndNavigate(null)" style="background: none; border: none; color: #94A3B8; font-size: 1.5rem; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 0.5rem; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.color='#FFFFFF'; this.style.backgroundColor='#1E293B';" onmouseout="this.style.color='#94A3B8'; this.style.backgroundColor='transparent';">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <h1 style="font-size: 1.5rem; font-weight: 600; color: #FFFFFF; margin: 0;">${currentWarehouse.name}</h1>
            <div style="font-size: 0.85rem; color: #64748B; margin-top: 0.25rem;">Stok ve Envanter Sistemi</div>
          </div>
        </div>
        <div id="inventory-action-bar" style="display: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'flex' : 'none'}; gap: 0.5rem; align-items: center;">
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

      <!-- Tabs -->
      ${renderTabsHTML(currentWarehouse.id, currentTab, isMobileWarehouse)}

      <!-- ENVANTER View -->
      <div id="view-ENVANTER" style="display: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'block' : 'none'};">
        <!-- Summary Cards -->
        ${(currentWarehouse.id !== 'MTA' && !isMobileWarehouse) ? `
        <div style="display: grid; grid-template-columns: 260px 1fr; gap: 0.75rem; margin-bottom: 1.5rem; align-items: start;">
          <div style="display: flex; flex-direction: column; gap: 0.6rem; justify-content: space-between; height: 86px; box-sizing: border-box;">
            <div id="total-kalem-card" onclick="window.setInventoryCriticalFilter(false)" style="background-color: ${warehouseState.onlyShowCritical ? '#111827' : 'rgba(59, 130, 246, 0.05)'}; border: 1px solid ${warehouseState.onlyShowCritical ? '#1E293B' : '#3B82F6'}; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; flex: 1; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
                <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Kalem</div>
              </div>
              <div id="total-kalem-count" style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${warehouseState.inventoryItems.filter(i => i.condition !== 'DEFECT').length}</div>
            </div>
            <div id="kritik-stok-card" onclick="window.setInventoryCriticalFilter(true)" style="background-color: ${warehouseState.onlyShowCritical ? 'rgba(239, 68, 68, 0.1)' : '#111827'}; border: 1px solid ${warehouseState.onlyShowCritical ? '#EF4444' : 'rgba(239, 68, 68, 0.25)'}; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; flex: 1; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-triangle-exclamation" style="color: #EF4444; font-size: 0.9rem;"></i>
                <div style="font-size: 0.75rem; color: #EF4444; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Kritik Stok</div>
              </div>
              <div id="kritik-stok-count" style="font-size: 1.15rem; font-weight: 800; color: #EF4444;">${warehouseState.inventoryItems.filter(i => i.condition !== 'DEFECT' && i.quantity <= (i.minStock || 0)).length}</div>
            </div>
          </div>

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
                  <!-- Realtime loaded -->
                </tbody>
              </table>
            </div>
          </div>
        </div>
        ` : `
          ${currentWarehouse.id === 'MTA' ? `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; width: 260px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
                  <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Kalem</div>
                </div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${warehouseState.inventoryItems.length}</div>
              </div>
            </div>
          ` : `
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
              <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 0.5rem 0.85rem; display: flex; align-items: center; justify-content: space-between; width: 260px; box-sizing: border-box;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <i class="fa-solid fa-boxes-stacked" style="color: #00f3ff; font-size: 0.9rem;"></i>
                  <div style="font-size: 0.75rem; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 700;">Toplam Zimmetli Kalem</div>
                </div>
                <div style="font-size: 1.15rem; font-weight: 800; color: #FFFFFF;">${warehouseState.inventoryItems.filter(item => item.condition !== 'DEFECT' && (item.quantity > 0 || (item.reservedQuantity || 0) > 0)).length}</div>
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
      </div>

      <!-- ANALİZ View -->
      <div id="view-ANALİZ" style="display: ${currentTab === 'ANALİZ' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem;">
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
              <h2 style="color: #FFFFFF; margin: 0; font-size: 1.25rem;">Türbin Bazlı Malzeme Tüketim Analizi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Bu sahaya ait servis raporlarında takılan ve sökülen malzemeler türbin bazında listelenmektedir.</div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
                <input type="text" id="warehouse-analytics-sap" class="cyber-input" style="padding: 8px 12px; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 6px; color: #14F195; width: 250px; font-weight: 600; outline: none;" placeholder="SAP Kodu veya Malzeme Adı..." value="${analyticsSap}" onkeypress="if(event.key==='Enter') window.setWarehouseAnalyticsSap((this as any).value)">
                <button onclick="window.setWarehouseAnalyticsSap((document.getElementById('warehouse-analytics-sap') as HTMLInputElement).value)" style="padding: 8px 16px; border-radius: 6px; cursor: pointer; background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); font-weight: bold; display: flex; align-items: center; gap: 6px;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'">
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
              
              <input type="date" id="warehouse-analytics-start" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${customStart}">
              <span style="color: #94A3B8; font-size: 0.8rem;">-</span>
              <input type="date" id="warehouse-analytics-end" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #FFF;" value="${customEnd}">
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
                        ${data.items.sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()).map((item: any) => `
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
                  <!-- Filled via updateManualSummaryBar -->
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

      <!-- Sayım Geçmişi View -->
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
            <!-- Loaded via loadSayimGecmisi -->
          </div>
        </div>
      </div>

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
                oninput="window.filterDepoHareketleri((this as any).value)"
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
            <!-- Loaded via loadDepoHareketleriLogs -->
          </div>
        </div>
      </div>

      <!-- DEFECT LİSTESİ View -->
      <div id="view-DEFECT" style="display: ${currentTab === 'DEFECT' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; padding: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 style="color: #FFFFFF; margin: 0; font-size: 1.25rem;">Depo Defect (Sökülen) Malzeme Listesi</h2>
              <div style="color: #94A3B8; font-size: 0.9rem;">Saha servis raporlarında söküldüğü belirtilen ve depoda bulunan defect malzemelerin listesi ve aksiyonları.</div>
              <div style="margin-top: 0.75rem; display: flex; flex-direction: column; gap: 10px;">
                <div style="align-self: flex-start; display: inline-flex; align-items: center; gap: 8px; padding: 4px 10px; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; font-size: 0.8rem; color: #00f2ff;">
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
                  const activeDefects = warehouseState.inventoryItems
                    .filter(inv => inv.condition === 'DEFECT' && inv.quantity > 0)
                    .map(inv => {
                      const reportItem = defectReportItems.find(rep => 
                        String(rep.sapNo).trim() === String(inv.sapNo).trim()
                      );
                      
                      let finalReportItem = reportItem;
                      if (!finalReportItem && currentWarehouse.id === 'MTA') {
                        for (const report of reports) {
                          if (report.materials) {
                            const mat = report.materials.find((m: any) => String(m.sapNo).trim() === String(inv.sapNo).trim() && m.defectCount > 0);
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
                        <td colspan="${hasWarehouseManagePerm ? 13 : 12}" style="text-align: center; padding: 3rem; color: #94A3B8; border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">
                          Bu sahaya ait sökülen (defect) malzeme kaydı bulunamadı.
                        </td>
                      </tr>
                    `;
                  }

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
                          <span class="expand-text" style="font-size: 0.75rem; color: #00f2ff; font-weight: bold; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.2); padding: 3px 8px; border-radius: 4px; transition: all 0.2s;"><i class="fa-solid fa-expand"></i> Göster</span>
                        </td>
                      </tr>
                    `;

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
                          <td style="padding: 0.75rem 1rem; color: #00f2ff; font-family: monospace; font-weight: bold;">${item.sapNo}</td>
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
                                ${item.recoveryNotes.length > 0 || item.recoveryNote ? `
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

      <!-- view-TRANSFERLER -->
      <div id="view-TRANSFERLER" style="display: ${currentTab === 'TRANSFERLER' ? 'block' : 'none'};">
        <div style="background-color: #111827; border: 1px solid #1E293B; border-radius: 10px; padding: 1.5rem;">
          <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; color: #00f2ff; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
            <i class="fa-solid fa-truck-ramp-box"></i> Depo Transferleri / Sevk Hareketleri (MSF)
          </h3>
          <div id="transfer-tracker-agenda"></div>
          <div id="warehouse-transfers-container">
            <!-- Dynamic transfers list will render here -->
          </div>
        </div>
      </div>

      <!-- Static Modals Template -->
      ${renderModalsHTML(targetOptions, isMobileWarehouse)}

      <input type="file" id="item-image-upload" accept="image/*" style="display:none;" />

    </div>
  `;
};

// Coordinator helper to wire up listeners and local actions
function setupWarehouseLogic(currentWarehouse: any) {
  const isMobileWarehouse = warehouseState.isMobileWarehouse;
  const isMaterialManager = warehouseState.isMaterialManager;
  const hasWarehouseDeletePerm = warehouseState.hasWarehouseDeletePerm;
  const hasWarehouseManagePerm = warehouseState.hasWarehouseManagePerm;
  const targetOptions = warehouseState.targetOptions;
  const allWarehouses = dataService.getWarehouses();

  let renderRetryCount = 0;

  // Window-attached UI Table Renderers
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

      const sortedItems = [...warehouseState.inventoryWithQRs]
        .filter(item => {
          if (currentWarehouse.id === 'MTA') return true;
          if (item.condition === 'DEFECT') return false;
          if (isMobileWarehouse && item.quantity <= 0 && (item.reservedQuantity || 0) <= 0) {
            return false;
          }
          if (warehouseState.onlyShowCritical) {
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

      const filteredItems = sortedItems.filter(item => {
        const sap = String(item.sapNo || '').toLowerCase();
        const name = String(item.name || '').toLowerCase();
        return term === '' || sap.includes(term) || name.includes(term);
      });

      const totalItems = filteredItems.length;
      const totalPages = Math.ceil(totalItems / warehouseState.itemsPerPage) || 1;
      
      if (warehouseState.currentPage > totalPages) warehouseState.currentPage = totalPages;
      if (warehouseState.currentPage < 1) warehouseState.currentPage = 1;

      const startIndex = (warehouseState.currentPage - 1) * warehouseState.itemsPerPage;
      const endIndex = Math.min(startIndex + warehouseState.itemsPerPage, totalItems);
      const paginatedItems = filteredItems.slice(startIndex, endIndex);

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

      if (paginatedItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #94A3B8;">Aramaya uygun malzeme bulunamadı.</td></tr>`;
      } else {
        tbody.innerHTML = paginatedItems.map(item => {
          const kritik = (item.minStock || 0);
          const rezerve = (item.reservedQuantity || 0);
          const isKritik = item.quantity <= kritik;
          
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
                    const matchingRepairs = (warehouseState.allRepairs || []).filter(r => String(r.sapNo).trim() === String(item.sapNo).trim());
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

      const selectAllCb = document.getElementById('select-all-checkbox') as HTMLInputElement;
      if (selectAllCb) {
        const itemCbs = document.querySelectorAll('.item-checkbox');
        if (itemCbs.length > 0) {
          selectAllCb.checked = Array.from(itemCbs).every((cb: any) => cb.checked);
        } else {
          selectAllCb.checked = false;
        }
      }

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
          selectOptions += `<option value="${opt}" ${warehouseState.itemsPerPage === opt ? 'selected' : ''}>${opt} Satır</option>`;
        });
        selectOptions += `<option value="all" ${warehouseState.itemsPerPage > 10000 ? 'selected' : ''}>Tümü</option>`;

        paginationDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #111827; border-top: 1px solid #1E293B; flex-wrap: wrap; gap: 1rem;">
            <div style="color: #64748B; font-size: 0.85rem; display: flex; align-items: center; gap: 0.75rem;">
              <span>${totalItems} malzeme arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
              <select onchange="window.changeItemsPerPage(this.value)" style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 6px; color: #E2E8F0; padding: 2px 6px; font-size: 0.8rem; outline: none; cursor: pointer;">
                ${selectOptions}
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button onclick="window.changePage(1)" ${warehouseState.currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-left"></i>
              </button>
              <button onclick="window.changePage(${warehouseState.currentPage - 1})" ${warehouseState.currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-left"></i>
              </button>
              
              <span style="color: #E2E8F0; font-size: 0.85rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${warehouseState.currentPage} / ${totalPages}</span>
              
              <button onclick="window.changePage(${warehouseState.currentPage + 1})" ${warehouseState.currentPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-right"></i>
              </button>
              <button onclick="window.changePage(${totalPages})" ${warehouseState.currentPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
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

  (window as any).changePage = (page: number) => {
     warehouseState.currentPage = page;
     (window as any).renderInventoryTable();
  };

  (window as any).changeItemsPerPage = (limit: string) => {
     warehouseState.itemsPerPage = limit === 'all' ? 999999 : parseInt(limit, 10);
     warehouseState.currentPage = 1;
     (window as any).renderInventoryTable();
  };

  (window as any).filterInventory = () => {
     warehouseState.currentPage = 1;
     (window as any).renderInventoryTable();
  };

  (window as any).setInventoryCriticalFilter = (val: boolean) => {
     warehouseState.onlyShowCritical = val;
     warehouseState.currentPage = 1;
     
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
    
    const totalKalemCount = warehouseState.inventoryItems.filter(i => i.condition !== 'DEFECT').length;
    const kritikStokCount = warehouseState.inventoryItems.filter(i => i.condition !== 'DEFECT' && i.quantity <= (i.minStock || 0)).length;
    
    if (totalKalemEl) totalKalemEl.innerText = String(totalKalemCount);
    if (kritikStokEl) kritikStokEl.innerText = String(kritikStokCount);
    
    const tbody = document.getElementById('reservations-tbody');
    if (tbody) {
      const rows: any[] = [];
      
      // 1. Task-based reservations
      warehouseState.draftReservations.details.forEach((d: any) => {
        d.materials.forEach((m: any) => {
          const invItem = warehouseState.inventoryItems.find((item: any) => String(item.sapNo).trim() === String(m.sapNo).trim());
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
      warehouseState.inventoryItems.forEach((item: any) => {
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

  // Drag & drop handlers
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
        position: fixed; top: 0; right: -340px; width: 320px; height: 100vh;
        background: rgba(10, 14, 23, 0.95); border-left: 1px solid rgba(20, 241, 149, 0.25);
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.6); z-index: 999999; backdrop-filter: blur(16px);
        padding: 1.5rem; display: flex; flex-direction: column; box-sizing: border-box;
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

    try {
      const item = (warehouseState.inventoryItems || []).find((i: any) => i.id === itemId);
      let matchedWh: any = null;
      
      if (currentWarehouse.id.startsWith('team_') && !isMaterialManager && item) {
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
      setTimeout(() => drawer.remove(), 300);
    }
  };

  (window as any).handleWarehouseItemDrop = async (event: DragEvent, destWarehouseId: string) => {
    event.preventDefault();
    const itemId = (window as any).draggedWarehouseItemId || event.dataTransfer?.getData('text/plain');
    if (!itemId) return;

    const item = (warehouseState.inventoryItems || []).find((i: any) => i.id === itemId);
    if (!item) return;

    (window as any).openTransferModal(item.id, item.sapNo, item.name.replace(/'/g, "\\'"), item.quantity, destWarehouseId);
  };

  // Checkboxes
  (window as any).onItemCheckboxClick = (cb: HTMLInputElement) => {
     const selectAllCb = document.getElementById('select-all-checkbox') as HTMLInputElement;
     if (selectAllCb) {
       const itemCbs = document.querySelectorAll('.item-checkbox');
       selectAllCb.checked = Array.from(itemCbs).every((c: any) => c.checked);
     }
  };

  (window as any).toggleSelectAll = (master: HTMLInputElement) => {
     const itemCbs = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
     itemCbs.forEach(cb => {
       cb.checked = master.checked;
     });
  };

  // Image Upload Trigger
  (window as any).triggerImageUpload = (itemId: string, sapNo: string) => {
       const input = document.getElementById('item-image-upload') as HTMLInputElement;
       if (input) {
           input.onchange = null;
           input.onchange = async (e: any) => {
               const file = e.target.files?.[0];
               if (!file) return;
               
               const path = `inventory/${currentWarehouse.id}/${itemId}_${Date.now()}`;
               const localPreviewUrl = URL.createObjectURL(file);
               const item = warehouseState.inventoryItems.find((i: any) => i.id === itemId);
               
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
               input.value = '';

               try {
                 const { ImageCompressor } = await import('../../utils/imageCompressor');
                 const { fileService } = await import('../../services/FileService');
                 const compressedFile = await ImageCompressor.compressImage(file, 800, 800, 0.7).catch(() => file);
                 const url = await fileService.uploadImage(compressedFile, path);
                 await warehouseService.updateMaterialImage(currentWarehouse.id, itemId, url, sapNo);
                 console.log("Arkaplan resim yüklemesi tamamlandı:", url);
               } catch (err) {
                 console.error("Arkaplan resim yükleme hatası:", err);
               }
           };
           input.click();
       }
  };

  // Actions
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
        const { serviceReportService } = await import('../../services/ServiceReportService');
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

       (window as any).showToast?.('Başarılı', 'Seri numarası başarıyla güncellendi.', 'success');
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

  (window as any).toggleAllCheckboxes = (master: HTMLInputElement) => {
     const checkboxes = document.querySelectorAll('.item-checkbox') as NodeListOf<HTMLInputElement>;
     checkboxes.forEach(cb => {
       cb.checked = master.checked;
     });
  };

  (window as any).bulkSendToRepair = () => {
     const checked = Array.from(document.querySelectorAll('.defect-row-checkbox:checked')) as HTMLInputElement[];
     if (checked.length === 0) {
       (window as any).showToast?.('Uyarı', 'Lütfen tamire sevk etmek istediğiniz malzemeleri seçin.', 'warning');
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
       (window as any).showToast?.('Uyarı', 'Lütfen hurdaya ayırmak istediğiniz malzemeleri seçin.', 'warning');
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

  // Defect Accordion Collapse/Expand
  (window as any).toggleDefectGroupCollapse = (key: string) => {
    const rows = document.querySelectorAll(`.group-row-${key}`) as NodeListOf<HTMLElement>;
    const header = document.getElementById(`group-header-${key}`);
    if (rows.length === 0 || !header) return;

    const icon = header.querySelector('.toggle-icon') as HTMLElement;
    const textSpan = header.querySelector('.expand-text') as HTMLElement;
    const isExpanded = rows[0].style.display !== 'none';

    rows.forEach(r => {
      r.style.display = isExpanded ? 'none' : '';
    });

    if (icon) icon.style.transform = isExpanded ? 'rotate(0deg)' : 'rotate(90deg)';
    if (textSpan) textSpan.innerHTML = isExpanded 
      ? '<i class="fa-solid fa-expand"></i> Göster' 
      : '<i class="fa-solid fa-compress"></i> Gizle';
  };

  (window as any).toggleDefectGroup = (master: HTMLInputElement, key: string) => {
    const checkboxes = document.querySelectorAll(`.group-checkbox-${key}`) as NodeListOf<HTMLInputElement>;
    checkboxes.forEach(cb => {
      cb.checked = master.checked;
    });
  };

  (window as any).filterDefectListBySite = (btn: HTMLElement, siteName: string) => {
    const btns = document.querySelectorAll('.site-filter-btn');
    btns.forEach(b => {
      b.classList.remove('active');
      (b as HTMLElement).style.background = 'rgba(255,255,255,0.03)';
      (b as HTMLElement).style.color = '#94A3B8';
      (b as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
    });

    btn.classList.add('active');
    btn.style.background = 'rgba(20, 241, 149, 0.2)';
    btn.style.color = '#14F195';
    btn.style.borderColor = 'rgba(20, 241, 149, 0.4)';

    const rows = document.querySelectorAll('.defect-row') as NodeListOf<HTMLElement>;
    rows.forEach(row => {
      const site = row.getAttribute('data-site') || '';
      const belongsToGroupKey = Array.from(row.classList).find(c => c.startsWith('group-row-'))?.replace('group-row-', '') || '';
      
      const shouldShow = siteName === 'all' || site === siteName;
      if (shouldShow) {
        const header = document.getElementById(`group-header-${belongsToGroupKey}`);
        if (header) {
          const rowsInGroup = document.querySelectorAll(`.group-row-${belongsToGroupKey}`) as NodeListOf<HTMLElement>;
          const isGroupExpanded = Array.from(rowsInGroup).some(r => r.style.display !== 'none');
          row.style.display = isGroupExpanded ? '' : 'none';
        }
      } else {
        row.style.display = 'none';
      }
    });

    // Handle group header rows visibility
    const groupHeaders = document.querySelectorAll('.date-group-header') as NodeListOf<HTMLElement>;
    // Wait, date group headers or defect group headers? In our HTML we have: id="group-header-${cleanKey}"
    // Let's filter defect group headers
    const groupHeadersDefects = document.querySelectorAll('[id^="group-header-"]') as NodeListOf<HTMLElement>;
    groupHeadersDefects.forEach(header => {
      const key = header.id.replace('group-header-', '');
      const childRows = document.querySelectorAll(`.group-row-${key}`) as NodeListOf<HTMLElement>;
      const hasVisibleChildren = Array.from(childRows).some(row => {
        const site = row.getAttribute('data-site') || '';
        return siteName === 'all' || site === siteName;
      });
      header.style.display = hasVisibleChildren ? '' : 'none';
    });
  };

  (window as any).acceptRepairReturn = async (repairId: string) => {
    if (!confirm('Bu malzemenin atölyeden sağlam şekilde geri döndüğünü ve depoya kabul edilerek envantere (Revize) ekleneceğini onaylıyor musunuz?')) return;

    try {
      (window as any).showToast?.('İşlem', 'Malzeme depoya kabul ediliyor...', 'info');
      const { repairService } = await import('../../services/RepairService');
      
      const repairs = await repairService.getRepairs();
      const rep = repairs.find(r => r.id === repairId);
      if (!rep) {
        alert('Tamir kaydı bulunamadı.');
        return;
      }

      const currentUser = (window as any).currentUser;
      const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';

      await repairService.acceptReturnedRepair(rep, userEmail);

      (window as any).showToast?.('Başarılı', 'Malzeme başarıyla kabul edildi ve Revize stok olarak envantere eklendi.', 'success');
      
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(currentWarehouse.id);
      }
    } catch (err) {
      console.error(err);
      alert('Kabul işlemi esnasında bir hata oluştu.');
    }
  };

  // Real-Time Listeners for coordinating state
  if ((window as any)._tasksUnsubscribe) {
    try { (window as any)._tasksUnsubscribe(); } catch(e) {}
    (window as any)._tasksUnsubscribe = null;
  }

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
     
     warehouseState.draftReservations = { bySap, details };
     
     if ((window as any).updateRealTimeReservationsAndStats) {
       (window as any).updateRealTimeReservationsAndStats();
     }
  });

  if ((window as any)._inventoryUnsubscribe) {
    try { (window as any)._inventoryUnsubscribe(); } catch(e) {}
    (window as any)._inventoryUnsubscribe = null;
  }

  const invCol = collection(db, 'warehouses', currentWarehouse.id, 'inventory_v2');
  (window as any)._inventoryUnsubscribe = onSnapshot(invCol, (snap: any) => {
     const rawItems = snap.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
     warehouseState.inventoryItems = rawItems.map((item: any) => {
       let resolvedName = item.name || item.description || '';
       if (!resolvedName || resolvedName === 'Bilinmeyen Malzeme') {
         const dictMat = inventoryService.getMaterialBySap(item.sapNo);
         if (dictMat && dictMat.d) {
           resolvedName = dictMat.d;
         }
       }
       if (!resolvedName) resolvedName = 'Bilinmeyen Malzeme';
       return { ...item, name: resolvedName };
     });
     
     warehouseState.inventoryWithQRs = warehouseState.inventoryItems.map(item => ({ ...item, qrDataUrl: '' }));
     (window as any).currentInventoryData = warehouseState.inventoryItems;

     if ((window as any).updateRealTimeReservationsAndStats) {
       (window as any).updateRealTimeReservationsAndStats();
     }
     if ((window as any).renderInventoryTable) {
       (window as any).renderInventoryTable();
     }
     if ((window as any).renderManualAuditTable) {
       (window as any).renderManualAuditTable();
     }
  });

  if ((window as any)._draftAuditUnsubscribe) {
    try { (window as any)._draftAuditUnsubscribe(); } catch(e) {}
    (window as any)._draftAuditUnsubscribe = null;
  }

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
    warehouseState.draftData = incomingDraft;
    (window as any).currentDraftData = incomingDraft;

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

    const activeElId = document.activeElement ? document.activeElement.id : null;
    
    const qtyInputs = document.querySelectorAll('.manual-audit-input');
    qtyInputs.forEach((input: any) => {
      const itemId = input.dataset.id;
      const val = incomingDraft[itemId]?.qty || '';
      if (input.id !== activeElId) {
        input.value = val;
      }
    });
    
    const shelfInputs = document.querySelectorAll('.manual-audit-shelf');
    shelfInputs.forEach((input: any) => {
      const itemId = input.dataset.id;
      const val = incomingDraft[itemId]?.shelf !== undefined ? incomingDraft[itemId].shelf : (input.dataset.original || '');
      if (input.id !== activeElId) {
        input.value = val;
      }
    });

    qtyInputs.forEach((input: any) => {
      const itemId = input.dataset.id;
      const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
      if (noteInput && noteInput.id !== activeElId) {
        const val = incomingDraft[itemId]?.note || '';
        const qtyVal = incomingDraft[itemId]?.qty || '';
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

  // Load repairs (real-time or once)
  const fetchRepairs = async () => {
    try {
      const { repairService } = await import('../../services/RepairService');
      const allRepairs = await repairService.getRepairs();
      warehouseState.allRepairs = allRepairs;
      if ((window as any).renderInventoryTable) (window as any).renderInventoryTable();
    } catch (e) {
      console.warn("Could not retrieve repairs list", e);
    }
  };
  fetchRepairs();

  // Load Transfers list logic (same as original, inside coordinator)
  const dirStyle = (dir: string) => {
    return warehouseState.warehouseTransfersDirection === dir 
      ? 'background: rgba(20, 241, 149, 0.15); color: #14F195;' 
      : 'background: transparent; color: #94A3B8;';
  };

  (window as any).filterWarehouseTransfers = (status: string) => {
    warehouseState.warehouseTransfersFilter = status;
    warehouseState.warehouseTransfersPage = 1;
    (window as any).renderWarehouseTransfersList();
  };

  (window as any).changeWarehouseTransfersPage = (direction: number) => {
    warehouseState.warehouseTransfersPage += direction;
    (window as any).renderWarehouseTransfersList();
  };

  (window as any).setTransferDirection = (direction: string) => {
    warehouseState.warehouseTransfersDirection = direction;
    warehouseState.warehouseTransfersPage = 1;
    
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
    warehouseState.warehouseTransfersSearchQuery = input ? input.value.trim().toLowerCase() : '';
    warehouseState.warehouseTransfersPage = 1;
    (window as any).renderWarehouseTransfersList();
  };

  (window as any).getFilteredTransfersList = () => {
    const currentWarehouseId = currentWarehouse.id;
    const now = new Date();
    let filtered = warehouseState.cachedWarehouseTransfers;

    if (warehouseState.warehouseTransfersFilter === 'GELEN_YOLDA') {
      filtered = filtered.filter(t => {
        const s = t.status || 'YOLDA';
        const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
        return normStatus === 'YOLDA' && t.toSiteId === currentWarehouseId;
      });
    } else if (warehouseState.warehouseTransfersFilter === 'GIDEN_YOLDA') {
      filtered = filtered.filter(t => {
        const s = t.status || 'YOLDA';
        const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
        return normStatus === 'YOLDA' && t.toSiteId !== currentWarehouseId;
      });
    } else if (warehouseState.warehouseTransfersFilter === 'GECIKEN') {
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
    } else if (warehouseState.warehouseTransfersFilter === 'TAMAMLANDI') {
      filtered = filtered.filter(t => {
        const s = t.status || 'YOLDA';
        const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
        return normStatus === 'TAMAMLANDI';
      });
    } else if (warehouseState.warehouseTransfersFilter === 'IPTAL_EDILDI') {
      filtered = filtered.filter(t => {
        const s = t.status || 'YOLDA';
        const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
        return normStatus === 'IPTAL_EDILDI';
      });
    }

    if (warehouseState.warehouseTransfersDirection === 'INCOMING') {
      filtered = filtered.filter(t => t.toSiteId === currentWarehouseId);
    } else if (warehouseState.warehouseTransfersDirection === 'OUTGOING') {
      filtered = filtered.filter(t => t.fromSiteId === currentWarehouseId);
    }

    if (warehouseState.warehouseTransfersSearchQuery) {
      const q = warehouseState.warehouseTransfersSearchQuery;
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

  (window as any).renderWarehouseTransfersList = () => {
    const warehouseTransfersPageSize = 20;
    const listContainer = document.getElementById('warehouse-transfers-cards-list');
    if (!listContainer) return;

    const currentUser = getUserProfile();
    const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.role === 'MALZEME_YONETIMI' || currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
    const currentWarehouseId = currentWarehouse.id;

    const stats = {
      all: warehouseState.cachedWarehouseTransfers.length,
      incomingPending: 0,
      outgoingPending: 0,
      delayed: 0,
      completed: 0,
      cancelled: 0
    };

    const now = new Date();
    warehouseState.cachedWarehouseTransfers.forEach((t: any) => {
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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-size: 1rem; font-weight: 800; color: #00f2ff; letter-spacing: 0.5px;">
              <i class="fa-solid fa-calendar-check" style="animation: pulse 2s infinite;"></i> SEVK TAKİP AJANDASI & ASİSTAN
            </div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: bold; background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
              <span style="width: 6px; height: 6px; border-radius: 50%; background: #14F195; display: inline-block;"></span> SİSTEM TAKİBİ ETKİN
            </span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 10px; margin-bottom: 1rem;">
            <div onclick="window.filterWarehouseTransfers('HEPSİ')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'HEPSİ' ? 'rgba(20,241,149,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'HEPSİ' ? '#14F195' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'HEPSİ' ? '#14F195' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Tüm Sevkler</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif;">${stats.all}</span>
            </div>

            <div onclick="window.filterWarehouseTransfers('GELEN_YOLDA')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'GELEN_YOLDA' ? 'rgba(59,130,246,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'GELEN_YOLDA' ? '#3b82f6' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'GELEN_YOLDA' ? '#3b82f6' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Gelen (Yolda)</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: #3b82f6; font-family: 'Rajdhani', sans-serif;">${stats.incomingPending}</span>
            </div>

            <div onclick="window.filterWarehouseTransfers('GIDEN_YOLDA')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'GIDEN_YOLDA' ? 'rgba(168,85,247,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'GIDEN_YOLDA' ? '#a855f7' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'GIDEN_YOLDA' ? '#a855f7' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Giden (Yolda)</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: #a855f7; font-family: 'Rajdhani', sans-serif;">${stats.outgoingPending}</span>
            </div>

            <div onclick="window.filterWarehouseTransfers('GECIKEN')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'GECIKEN' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'GECIKEN' ? '#EF4444' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'GECIKEN' ? '#EF4444' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Geciken Sevk</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: ${stats.delayed > 0 ? '#EF4444' : '#FFF'}; font-family: 'Rajdhani', sans-serif;">${stats.delayed}</span>
            </div>

            <div onclick="window.filterWarehouseTransfers('TAMAMLANDI')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'TAMAMLANDI' ? 'rgba(20,241,149,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'TAMAMLANDI' ? '#14F195' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'TAMAMLANDI' ? '#14F195' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">Tamamlanan</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: #14F195; font-family: 'Rajdhani', sans-serif;">${stats.completed}</span>
            </div>

            <div onclick="window.filterWarehouseTransfers('IPTAL_EDILDI')" style="cursor: pointer; background: ${warehouseState.warehouseTransfersFilter === 'IPTAL_EDILDI' ? 'rgba(239,68,68,0.1)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${warehouseState.warehouseTransfersFilter === 'IPTAL_EDILDI' ? '#EF4444' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 8px 10px; text-align: center; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(255,255,255,0.2)'" onmouseout="this.style.borderColor='${warehouseState.warehouseTransfersFilter === 'IPTAL_EDILDI' ? '#EF4444' : 'rgba(255,255,255,0.05)'}'">
              <span style="font-size: 0.58rem; color: #94A3B8; display: block; font-weight: 800; text-transform: uppercase; letter-spacing: 0.3px;">İptal Edilenler</span>
              <span style="font-size: 1.4rem; font-weight: 800; color: #EF4444; font-family: 'Rajdhani', sans-serif;">${stats.cancelled}</span>
            </div>
          </div>

          <div style="background: rgba(0,0,0,0.15); border: 1px solid rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px; font-size: 0.75rem; color: #E2E8F0; line-height: 1.45;">
            ${assistantNote}
          </div>
        </div>
      `;
    }

    const filtered = (window as any).getFilteredTransfersList();

    if (filtered.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 4rem 2rem; text-align: center; color: #64748B; background: rgba(255,255,255,0.01); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05); margin-top: 1rem;">
          <i class="fa-solid fa-clock-rotate-left" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.15; color: #00f2ff;"></i>
          <p style="font-size: 0.85rem; margin: 0;">Bu filtreye uygun sevk/transfer kaydı bulunamadı.</p>
        </div>
      `;
      return;
    }

    const totalCount = filtered.length;
    const totalPages = Math.ceil(totalCount / warehouseTransfersPageSize) || 1;
    if (warehouseState.warehouseTransfersPage > totalPages) warehouseState.warehouseTransfersPage = totalPages;
    if (warehouseState.warehouseTransfersPage < 1) warehouseState.warehouseTransfersPage = 1;

    const startIndex = (warehouseState.warehouseTransfersPage - 1) * warehouseTransfersPageSize;
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
            <span style="color: #E2E8F0; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
              <span style="font-family: monospace; font-size: 0.7rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 6px rgba(0,243,255,0.05);">${item.materialCode}</span>
              <span>${item.materialName}</span>
            </span>
            <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 1px 8px; border-radius: 20px; box-shadow: 0 0 8px rgba(20,241,149,0.05);">${item.quantity} Adet</span>
          </div>
        `).join('');
      } else {
        itemsMarkup = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.03); padding: 5px 0;">
            <span style="color: #E2E8F0; font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
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
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.6rem; margin-bottom: 0.6rem;">
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <span style="font-family: monospace; font-size: 1rem; font-weight: 800; color: #00f2ff; letter-spacing: 0.5px;">${msfNo}</span>
              ${directionBadge}
              <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: #E2E8F0; background: rgba(0, 0, 0, 0.2); padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.04);">
                <i class="fa-solid fa-warehouse" style="color: #64748B;"></i>
                <span>${fromName}</span>
                <i class="fa-solid fa-arrow-right-long" style="color: #00f2ff; font-size: 0.75rem;"></i>
                <i class="fa-solid fa-location-dot" style="color: #EF4444;"></i>
                <span>${toName}</span>
              </div>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <button onclick="window.printWarehouseMsfVoucher('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: #E2E8F0; border-color: rgba(255,255,255,0.15); background: transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='#00f2ff'; this.style.color='#00f2ff'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='#E2E8F0'">
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

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 8px 12px; font-size: 0.72rem; margin-bottom: 0.75rem;">
            <div>
              <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-user-circle"></i> TALEBİ OLUŞTURAN</span>
              <span style="color: #E2E8F0; font-weight: 600; font-family: monospace; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${t.requestedBy}">${t.requestedBy}</span>
            </div>
            <div>
              <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-paper-plane"></i> SEVK YÖNTEMİ</span>
              <span style="color: #E2E8F0; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${deliveryMethodStr}</span>
            </div>
            <div>
              <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-info"></i> TAŞIYICI DETAYI</span>
              <span style="color: #E2E8F0; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${deliveryDetailStr}">${deliveryDetailStr}</span>
            </div>
            <div>
              <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-clock"></i> GÖNDERİM TARİHİ</span>
              <span style="color: #E2E8F0; font-weight: 600;">${createdDateStr}</span>
            </div>
            <div>
              <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-check"></i> TESLİM TARİHİ</span>
              <span style="color: #E2E8F0; font-weight: 600;">${resolvedDateStrHTML}</span>
            </div>
          </div>

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

    // totalPages already declared above
    const paginationMarkup = `
      <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.03);">
        <button onclick="window.changeWarehouseTransfersPage(-1)" class="btn-cyber-mini" ${warehouseState.warehouseTransfersPage === 1 ? 'disabled style="opacity: 0.5; pointer-events: none;"' : 'style="cursor: pointer;"'}>
          <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
        </button>
        <span style="font-family: 'Rajdhani', sans-serif; font-weight: bold; font-size: 0.82rem; color: #FFF; background: rgba(0,0,0,0.2); padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.02);">
          Sayfa ${warehouseState.warehouseTransfersPage} / ${totalPages} <span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 5px;">(Toplam: ${totalCount})</span>
        </span>
        <button onclick="window.changeWarehouseTransfersPage(1)" class="btn-cyber-mini" ${warehouseState.warehouseTransfersPage === totalPages ? 'disabled style="opacity: 0.5; pointer-events: none;"' : 'style="cursor: pointer;"'}>
          Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
        </button>
      </div>
    `;

    listContainer.innerHTML = cardsHtml + paginationMarkup;
  };

  // Real-time listener for warehouse transfers
  if ((window as any)._warehouseTransfersUnsubscribe) {
    try { (window as any)._warehouseTransfersUnsubscribe(); } catch(e) {}
    (window as any)._warehouseTransfersUnsubscribe = null;
  }

  if (currentWarehouse) {
     if (!(window as any)._warehousesMap) {
       (window as any)._warehousesMap = {};
       const allWh = dataService.getWarehouses();
       allWh.forEach((w: any) => { (window as any)._warehousesMap[w.id] = w.name; });
       for (let i = 1; i <= 15; i++) {
         const tName = `Team ${String(i).padStart(2, '0')}`;
         const tId = `team_${tName.replace(/\s+/g, '_')}`;
         (window as any)._warehousesMap[tId] = `${tName} Deposu`;
       }
     }

     const transfersQuery = query(collection(db, 'transfers'), orderBy('createdAt', 'desc'));
     (window as any)._warehouseTransfersUnsubscribe = onSnapshot(transfersQuery, (snapshot: any) => {
       const allTransfers = snapshot.docs.map((docSnap: any) => ({ id: docSnap.id, ...docSnap.data() }));
       warehouseState.cachedWarehouseTransfers = allTransfers.filter((t: any) => 
         t.fromSiteId === currentWarehouse.id || t.toSiteId === currentWarehouse.id
       );
       if ((window as any).renderWarehouseTransfersList) {
         (window as any).renderWarehouseTransfersList();
       }
     });
  }

  // Accordion
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
}
