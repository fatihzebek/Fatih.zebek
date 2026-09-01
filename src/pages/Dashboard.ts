import { dataService } from '../services/DataService';
import { taskService } from '../services/TaskService';
import { agentHealthService } from '../services/AgentHealthService';
import { warehouseService } from '../services/WarehouseService';
import { serviceReportService } from '../services/ServiceReportService';
import { turbineReminderService } from '../services/TurbineReminderService';
import { personnelService } from '../services/PersonnelService';
import { transferService } from '../services/TransferService';
import { formatDisplayName, formatTeamName } from '../utils/formatters';
import { getGreetingPrefixHTML, getUserBadgeHTML } from './Dashboard/DashboardHeader';
import { DashboardAgenda } from './Dashboard/DashboardAgenda';
import { DashboardFeed } from './Dashboard/DashboardFeed';

const cleanSablonName = (sablonName: string) => {
  return (sablonName || '').replace(/\s*[Tt]alimat[ıi]\s*/g, '').trim().toUpperCase();
};
const isGenericFault = (code: string) => !code || code.includes('---') || code.toUpperCase().includes('GENEL GÖREV');

// Stale-while-revalidate cache for instant 0ms Dashboard rendering
let cachedDashboardData: {
  tasks?: any[];
  pendingLeaves?: any[];
  reminders?: any[];
  transfers?: any[];
  reports?: any[];
} = {};

export const DashboardPage = async () => {
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  
  (window as any).switchLeaveTabAndGo = (tabName: string) => {
    (window as any).leaveCurrentTab = tabName;
    (window as any).navigate('leave-management');
  };

  // If cache is empty, load data synchronously first to prevent blank/zero screen on first load
  const isCacheEmpty = !cachedDashboardData.tasks;
  if (isCacheEmpty) {
    try {
      const [freshTasks, freshLeaves, freshReminders, freshTransfers, freshReports] = await Promise.all([
        taskService.getTasks(),
        (async () => {
          let freshLeaves: any[] = [];
          try {
            const { db } = await import('../firebase');
            const { collection, getDocs, query, where } = await import('firebase/firestore');
            const userEmail = (currentUser?.email || '').toLowerCase().trim();
            const isAdminUser = currentUser?.role === 'ADMIN';
            const isApprover = isAdminUser || userEmail === 'furkan.yildirim@demirerholding.com' || userEmail === 'fatih.zebek@demirerholding.com' || userEmail === 'emre.aydogdu@demirerholding.com';
            if (isApprover) {
              const snap = await getDocs(query(collection(db, 'leaveRequests'), where('status', 'in', ['PENDING_FIRST', 'PENDING_FINAL'])));
              snap.forEach(d => freshLeaves.push({ id: d.id, ...d.data() }));
              if (userEmail === 'furkan.yildirim@demirerholding.com' || userEmail === 'fatih.zebek@demirerholding.com' || isAdminUser) {
                freshLeaves = freshLeaves.filter(r => r.status === 'PENDING_FIRST' || r.status === 'PENDING_FINAL');
              } else if (userEmail === 'emre.aydogdu@demirerholding.com') {
                freshLeaves = freshLeaves.filter(r => r.status === 'PENDING_FINAL');
              } else {
                freshLeaves = [];
              }
            }
          } catch (e) {}
          return freshLeaves;
        })(),
        turbineReminderService.getPendingReminders(),
        transferService.getTransfers(),
        serviceReportService.getAllReports()
      ]);

      cachedDashboardData = {
        tasks: freshTasks,
        pendingLeaves: freshLeaves,
        reminders: freshReminders,
        transfers: freshTransfers,
        reports: freshReports
      };
    } catch (err) {
      console.error("Failed initial dashboard data load:", err);
    }
  }

  // Use cached arrays if available for instant 0ms HTML generation
  let tasks: any[] = cachedDashboardData.tasks || [];
  let pendingLeaves: any[] = cachedDashboardData.pendingLeaves || [];
  let reminders: any[] = cachedDashboardData.reminders || [];
  let transfers: any[] = cachedDashboardData.transfers || [];
  let reports: any[] = cachedDashboardData.reports || [];

  const todayStr = new Date().toISOString().split('T')[0];
  const todayTime = new Date(todayStr).getTime();
  const isAdmin = currentUser?.role === 'ADMIN';
  const allowedSites = currentUser?.allowedSites || [];
  const userTeam = ((window as any).currentUserTeam || currentUser?.team || '').trim();
  const userTeamId = userTeam ? `team_${userTeam.toLowerCase().replace(/\s+/g, '_')}` : '';

  const pendingTransfers = transfers.filter(t => {
    const isPending = t.status === 'YOLDA' || t.status === 'PENDING';
    if (!isPending) return false;
    if (isAdmin) return true;
    const fromMatches = allowedSites.includes(t.fromSiteId) || (userTeamId && t.fromSiteId.toLowerCase() === userTeamId);
    const toMatches = allowedSites.includes(t.toSiteId) || (userTeamId && t.toSiteId.toLowerCase() === userTeamId);
    return fromMatches || toMatches;
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const warningTransfers = pendingTransfers.map(t => {
    let createdDate = new Date();
    let dateText = 'Bilinmeyen Tarih';
    if (t.createdAt) {
      createdDate = t.createdAt.toDate ? t.createdAt.toDate() : new Date(t.createdAt);
      dateText = createdDate.toLocaleDateString('tr-TR');
    } else {
      dateText = new Date().toLocaleDateString('tr-TR');
    }
    const startOfCreated = new Date(createdDate);
    startOfCreated.setHours(0, 0, 0, 0);
    const daysPending = Math.max(0, Math.round((startOfToday.getTime() - startOfCreated.getTime()) / (1000 * 60 * 60 * 24)));
    return { ...t, dateText, daysPending };
  });
  
  const isFatihOrAdmin = currentUser?.role === 'ADMIN' || 
                         (currentUser?.email || '').toLowerCase().includes('fatih.zebek') ||
                         (currentUser?.displayName || '').toLowerCase().includes('fatih zebek');

  const dueReminders = reminders.filter(r => {
    const rTime = new Date(r.reminderDate).getTime();
    if (rTime > todayTime) return false;
    if (isFatihOrAdmin) return true;
    const creatorEmail = (r.createdBy || '').toLowerCase().trim();
    const myEmail = (currentUser?.email || '').toLowerCase().trim();
    if (myEmail && creatorEmail && myEmail === creatorEmail) return true;
    const rSiteId = (r.siteId || '').toLowerCase().trim();
    const rSiteName = (r.siteName || '').toLowerCase().trim();
    return (currentUser?.allowedSites || []).some((s: string) => {
      const cleanS = s.toLowerCase().trim();
      return cleanS === rSiteId || cleanS.includes(rSiteId) || rSiteId.includes(cleanS) || rSiteName.includes(cleanS) || cleanS.includes(rSiteName);
    });
  });

  const priorityOrder: Record<string, number> = { CRITICAL: 0, MEDIUM: 1, LOW: 2 };
  dueReminders.sort((a, b) => {
    const orderA = priorityOrder[a.priority || 'LOW'] ?? 2;
    const orderB = priorityOrder[b.priority || 'LOW'] ?? 2;
    if (orderA !== orderB) return orderA - orderB;
    return a.reminderDate.localeCompare(b.reminderDate);
  });

  (window as any).updateDashboardUserBadge = () => {
    const badge = document.querySelector('.user-profile-badge');
    if (badge) {
      badge.innerHTML = getUserBadgeHTML(currentUser);
    }
  };

  const isAllowedSub = (subId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    const allowedTabs = currentUser.allowedTabs || {};
    const dashPerms = allowedTabs['dashboard'];
    if (typeof dashPerms === 'object') {
      return !!dashPerms[subId];
    }
    return !!dashPerms;
  };

  if (currentUser && currentUser.role === 'TECHNICIAN') {
    const allowedSites = dataService.getSites().map(s => s.id);
    tasks = tasks.filter(t => {
      let tSiteId = t.siteId || '';
      if (tSiteId && isNaN(Number(tSiteId))) {
        const siteObj = dataService.getAllSites().find(s => s.name.toLowerCase() === tSiteId.toLowerCase() || s.name.toLowerCase().includes(tSiteId.toLowerCase()));
        if (siteObj) tSiteId = siteObj.id;
      }
      return allowedSites.includes(tSiteId);
    });

    const userTeamStr = ((window as any).currentUserTeam || currentUser.displayName || '').toUpperCase().trim();
    if (userTeamStr) {
      const managedTeams = (currentUser?.managedTeams || []).map((mt: string) => mt.toUpperCase().trim());
      tasks = tasks.filter(t => {
        const taskPersonnel = String(t.personnel || '').toUpperCase().trim();
        if (!taskPersonnel || taskPersonnel === 'SİSTEM' || taskPersonnel === 'ATANMADI') return true;
        if (managedTeams.some((mt: string) => taskPersonnel.includes(mt))) return true;
        const taskNum = taskPersonnel.replace(/[^0-9]/g, '');
        const userNum = userTeamStr.replace(/[^0-9]/g, '');
        if (taskNum && userNum) {
          const tN = parseInt(taskNum);
          const uN = parseInt(userNum);
          if (tN === uN) return true;
          if ((tN === 5 && uN === 10) || (tN === 10 && uN === 5)) return true;
        }
        return taskPersonnel.includes(userTeamStr) || userTeamStr.includes(taskPersonnel);
      });
    }
  }

  const sites = dataService.getSites();
  const openTasks = tasks.filter(t => t.status !== 'Tamamlandı');
  const activeTasksCount = openTasks.length;
  const emergencyTasksCount = openTasks.filter(t => t.secilenSablon?.toLowerCase().includes('arıza')).length;
  
  const maintenancePlan = (() => {
    const plan: { siteName: string, turbineNo: string, lastDate: string, lastType: string, nextDate: Date, nextType: string, status: 'safe' | 'warning' | 'overdue' }[] = [];
    const now = new Date();
    sites.forEach(site => {
      const siteTurbines = dataService.getTurbinesBySite(site.id);
      siteTurbines.forEach(t => {
        const turbineReports = reports.filter(r => r.turbineSerial === t.id);
        const lastMaint = turbineReports
          .filter(r => {
            const typeLower = (r.type || '').toLowerCase();
            const templateLower = (r.templateName || '').toLowerCase();
            const faultLower = (r.faultCode || '').toLowerCase();
            return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
                   templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
                   faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastMaint) {
          const lastDate = new Date(lastMaint.date);
          const nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 6);
          const searchStr = `${lastMaint.type} ${lastMaint.templateName} ${lastMaint.faultCode}`.toLowerCase();
          const isLastAna = searchStr.includes('ana');
          const nextType = isLastAna ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';
          const lastType = isLastAna ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
          const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let status: 'safe' | 'warning' | 'overdue' = 'safe';
          if (diffDays < 0) status = 'overdue';
          else if (diffDays < 30) status = 'warning';
          plan.push({ siteName: site.name, turbineNo: t.no.toString(), lastDate: lastMaint.date, lastType, nextDate, nextType, status });
        }
      });
    });
    return plan.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  })();

  // Background Async Data Hydration
  setTimeout(async () => {
    try {
      const freshTasks = await taskService.getTasks();
      cachedDashboardData.tasks = freshTasks;

      // Pending leaves
      let freshLeaves: any[] = [];
      try {
        const { db } = await import('../firebase');
        const { collection, getDocs, query, where } = await import('firebase/firestore');
        const userEmail = (currentUser?.email || '').toLowerCase().trim();
        const isAdminUser = currentUser?.role === 'ADMIN';
        const isApprover = isAdminUser || userEmail === 'furkan.yildirim@demirerholding.com' || userEmail === 'fatih.zebek@demirerholding.com' || userEmail === 'emre.aydogdu@demirerholding.com';
        if (isApprover) {
          const snap = await getDocs(query(collection(db, 'leaveRequests'), where('status', 'in', ['PENDING_FIRST', 'PENDING_FINAL'])));
          snap.forEach(d => freshLeaves.push({ id: d.id, ...d.data() }));
          if (userEmail === 'furkan.yildirim@demirerholding.com' || userEmail === 'fatih.zebek@demirerholding.com' || isAdminUser) {
            freshLeaves = freshLeaves.filter(r => r.status === 'PENDING_FIRST' || r.status === 'PENDING_FINAL');
          } else if (userEmail === 'emre.aydogdu@demirerholding.com') {
            freshLeaves = freshLeaves.filter(r => r.status === 'PENDING_FINAL');
          } else {
            freshLeaves = [];
          }
        }
      } catch (err) {}
      cachedDashboardData.pendingLeaves = freshLeaves;

      // Pending reminders
      try {
        cachedDashboardData.reminders = await turbineReminderService.getPendingReminders();
      } catch (err) {}

      // Transfers
      try {
        cachedDashboardData.transfers = await transferService.getTransfers();
      } catch (err) {}

      // Reports
      try {
        cachedDashboardData.reports = await serviceReportService.getAllReports();
      } catch (err) {}

      // Re-trigger counter animation if numbers changed
      const openT = (cachedDashboardData.tasks || []).filter(t => t.status !== 'Tamamlandı');
      const activeCount = openT.length;
      const emCount = openT.filter(t => t.secilenSablon?.toLowerCase().includes('arıza')).length;
      DashboardFeed.updateStatValues(activeCount, emCount);
    } catch (err) {
      console.error("Dashboard async background refresh failed:", err);
    }
  }, 10);

  // Real-time Agent Monitoring + Counter Animation + Agenda
  setTimeout(() => {
    DashboardFeed.initCounterAnimations();
    const currentUser = (window as any).currentUser;
    DashboardFeed.initAgentMonitoring(currentUser?.role);

    // ===== AJANDA WIDGET LOGIC =====
    DashboardAgenda.init(openTasks, maintenancePlan, cleanSablonName);
  }, 100);

  // Global Stock Search Handler
  (window as any).searchGlobalStock = async () => {
    const sapInput = document.getElementById('global-sap-search') as HTMLInputElement;
    const resultArea = document.getElementById('global-stock-results');
    const sapNo = sapInput?.value.trim();

    if (!sapNo) return;

    resultArea!.innerHTML = '<div class="loader-mini">Taranıyor...</div>';
    
    try {
      const results: { siteName: string, quantity: number, description: string }[] = [];
      const sites = dataService.getAllSites();
      
      for (const site of sites) {
        const inventory = await warehouseService.getInventory(site.id);
        const item = inventory.find(i => i.sapNo === sapNo);
        if (item && item.quantity > 0) {
          results.push({ 
            siteName: site.name, 
            quantity: item.quantity, 
            description: item.description || (item as any).name || 'Bilinmeyen Malzeme' 
          });
        }
      }

      if (results.length === 0) {
        resultArea!.innerHTML = '<div class="no-results">Bu SAP numarası ile hiçbir depoda stok bulunamadı.</div>';
      } else {
        const totalQty = results.reduce((sum, r) => sum + r.quantity, 0);
        const totalHtml = `
          <div class="stock-total-badge" style="background: rgba(20, 241, 149, 0.08); border: 1px solid rgba(20, 241, 149, 0.2); padding: 0.75rem 1rem; border-radius: 12px; margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 0 15px rgba(20, 241, 149, 0.05);">
            <span style="font-weight: 700; color: #94A3B8; font-size: 0.8rem; letter-spacing: 0.5px;">TOPLAM STOK</span>
            <span style="font-weight: 900; color: #14F195; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">${totalQty} Adet</span>
          </div>
        `;
        
        resultArea!.innerHTML = totalHtml + results.map(r => `
          <div class="stock-result-item">
            <div class="site-info">
              <span class="site">${r.siteName}</span>
              <span class="desc">${r.description}</span>
            </div>
            <span class="qty">${r.quantity} Adet</span>
          </div>
        `).join('');
      }
    } catch (error) {
      resultArea!.innerHTML = '<div class="error">Arama sırasında hata oluştu.</div>';
    }
  };

  // Turbine QR Scanner Logic
  (window as any).scanTurbineQR = async () => {
    const { Html5QrcodeScanner } = await import('html5-qrcode');
    const { soundService } = await import('../services/SoundService');
    
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    modal.innerHTML = `
      <div class="glass-panel" style="width: 90%; max-width: 400px; padding: 2rem; position: relative; border-top: 4px solid var(--accent-cyan); display: flex; flex-direction: column; align-items: center; text-align: center;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="width: 50px; height: 50px; background: rgba(0, 243, 255, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="fa-solid fa-qrcode"></i>
        </div>
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-cyan); margin-bottom: 0.5rem; font-size: 1.2rem; letter-spacing: 1px;">TÜRBİN SİCİL TARAYICI</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">Türbin üzerindeki sicil barkodunu okutun.</p>
        
        <div id="turbine-qr-reader" style="width: 100%; min-height: 250px; border-radius: 12px; overflow: hidden; border: 2px solid rgba(0, 243, 255, 0.2);"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
      const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
      const edge = Math.max(220, Math.floor(minEdge * 0.75));
      return { width: edge, height: edge };
    };

    const scanner = new Html5QrcodeScanner('turbine-qr-reader', { 
      fps: 20, 
      qrbox: qrboxFunction, 
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    }, false);
    
    scanner.render(async (decodedText) => {
      soundService.playScannerBeep();
      scanner.clear();
      modal.remove();
      
      let serial = decodedText;
      let targetSiteId: string | undefined = undefined;
      
      if (decodedText.startsWith('turbine:')) {
        const parts = decodedText.split(':');
        if (parts.length === 3) {
          // Format: turbine:siteId:turbineId
          targetSiteId = parts[1];
          serial = parts[2];
        } else {
          // Legacy format: turbine:turbineId
          serial = parts[1];
        }
      }

      const turbine = dataService.findTurbineBySerial(serial, targetSiteId);
      if (turbine) {
        (window as any).showToast?.('BAŞARILI', `Türbin bulundu: ${turbine.siteName} / ${turbine.turbineNo}`, 'success');
        localStorage.setItem('autoOpenTurbineId', serial); // serial or id
        (window as any).selectSiteAndNavigate(turbine.siteId);
      } else {
        (window as any).showToast?.('HATA', `Sistemde kayıtlı türbin bulunamadı. (Okunan: ${serial})`, 'error');
      }
    }, (error) => {});
  };

  let currentFeedPage = 1;
  (window as any).changeFeedPage = (delta: number) => {
    const totalPages = Math.ceil(openTasks.length / 5);
    const newPage = currentFeedPage + delta;
    if (newPage < 1 || newPage > totalPages) return;

    const oldPageEl = document.getElementById(`feed-page-${currentFeedPage}`);
    if (oldPageEl) oldPageEl.style.display = 'none';

    currentFeedPage = newPage;

    const newPageEl = document.getElementById(`feed-page-${currentFeedPage}`);
    if (newPageEl) newPageEl.style.display = 'flex';

    const infoEl = document.getElementById('feed-page-info');
    if (infoEl) infoEl.innerText = `SAYFA ${currentFeedPage} / ${totalPages}`;

    const prevBtn = document.getElementById('feed-prev-btn') as HTMLButtonElement;
    const nextBtn = document.getElementById('feed-next-btn') as HTMLButtonElement;
    if (prevBtn) prevBtn.disabled = currentFeedPage === 1;
    if (nextBtn) nextBtn.disabled = currentFeedPage === totalPages;
  };

  // Precompute paginated feed HTML for active tasks flow
  let activeFeedHtml = '';
  if (openTasks.length === 0) {
    activeFeedHtml = `
      <div class="empty-feed">
        <i class="fa-solid fa-circle-check"></i>
        <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; margin-top: 4px;">TÜM GÖREVLER TAMAMLANDI</div>
        <div style="font-size: 0.75rem; color: var(--text-muted); max-width: 250px; line-height: 1.4; margin-top: 2px;">Şu an aktif olarak takip edilen bir saha görevi bulunmamaktadır.</div>
      </div>
    `;
  } else {
    const pageSize = 5;
    const totalPages = Math.ceil(openTasks.length / pageSize);
    const pagesHtml: string[] = [];

    for (let p = 0; p < totalPages; p++) {
      const pageItems = openTasks.slice(p * pageSize, (p + 1) * pageSize);
      const pageItemsHtml = pageItems.map(t => {
        const isEmergency = t.secilenSablon?.toLowerCase().includes('arıza');
        const cleanName = cleanSablonName(t.secilenSablon);
        const faultDetails = t.faultCode && !isGenericFault(t.faultCode) ? ` • ${t.faultCode}` : '';
        const createdDate = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : '';
        const descRow = t.yoneticiNotu ? `<div class="task-desc-row"><i class="fa-solid fa-circle-info"></i> ${t.yoneticiNotu}</div>` : '';

        return `
          <div class="feed-item ${isEmergency ? 'emergency' : ''}" onclick="window.navigate('tasks')" style="margin-bottom: 0.75rem;">
            <div class="feed-marker"></div>
            <div class="feed-content">
              <div class="feed-header">
                <span class="site-tag">${t.siteId} / ${t.turbineId}</span>
                <span class="task-type">${cleanName}${faultDetails}</span>
              </div>
              <div class="personnel-row">
                <i class="fa-solid fa-users"></i> 
                <strong>${t.personnel || 'EKİP ATANMAMIŞ'}</strong>
              </div>
              ${descRow}
              <div class="status-row">
                <span class="status-text">${t.status}</span>
                <span class="time-text">${createdDate}</span>
              </div>
            </div>
          </div>
        `;
      }).join('');

      pagesHtml.push(`
        <div class="feed-page-container" id="feed-page-${p + 1}" style="display: ${p === 0 ? 'flex' : 'none'}; flex-direction: column;">
          ${pageItemsHtml}
        </div>
      `);
    }

    const paginationControl = totalPages > 1 ? `
      <div class="feed-pagination" style="display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); font-family: 'Rajdhani', sans-serif;">
        <button id="feed-prev-btn" onclick="window.changeFeedPage(-1)" disabled class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 700; height: 26px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; min-width: 65px; justify-content: center;">
          <i class="fa-solid fa-angle-left"></i> ÖNCEKİ
        </button>
        <span id="feed-page-info" style="color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; letter-spacing: 0.5px;">SAYFA 1 / ${totalPages}</span>
        <button id="feed-next-btn" onclick="window.changeFeedPage(1)" class="btn-cyber" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 700; height: 26px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; min-width: 65px; justify-content: center;">
          SONRAKİ <i class="fa-solid fa-angle-right"></i>
        </button>
      </div>
    ` : '';

    activeFeedHtml = pagesHtml.join('') + paginationControl;
  }

  return `
    <div class="fade-in-up dashboard-container">
      <!-- Glowing background elements for premium ambient look -->
      <div style="position: absolute; top: -150px; left: -100px; width: 550px; height: 550px; background: radial-gradient(circle, rgba(0, 243, 255, 0.16) 0%, transparent 75%); pointer-events: none; z-index: 0; filter: blur(70px);"></div>
      <div style="position: absolute; bottom: -100px; right: -150px; width: 600px; height: 600px; background: radial-gradient(circle, rgba(167, 139, 250, 0.13) 0%, transparent 75%); pointer-events: none; z-index: 0; filter: blur(80px);"></div>
      <div style="position: absolute; top: 30%; left: 15%; width: 700px; height: 700px; background: radial-gradient(circle, rgba(20, 241, 149, 0.08) 0%, transparent 80%); pointer-events: none; z-index: 0; filter: blur(90px);"></div>

      <!-- HEADER & WELCOME -->
      <div class="dash-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.5rem; width: 100%; position: relative; z-index: 2;">
        <div class="welcome-text" style="flex: 1; min-width: 250px;">
          <h1>${getGreetingPrefixHTML()} ${currentUser?.role === 'ADMIN' ? '<span class="v-tag">V3.4</span>' : ''}</h1>
          <p>Sistem genel durumu, bakım planı ve global stok verileri.</p>
        </div>

        <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
          ${(window as any).currentUser?.role === 'ADMIN' ? `
          <div id="dash-agent-grid" class="agent-summary-strip" style="margin: 0;">
            <!-- Agents injected here -->
          </div>
          ` : ''}
          <div class="user-profile-badge" style="display: flex; flex-direction: column; align-items: center; text-align: center; background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 255, 0.08); padding: 0.4rem 0.85rem; border-radius: 8px; backdrop-filter: blur(5px);">
            ${getUserBadgeHTML(currentUser)}
          </div>
        </div>
      </div>

      ${pendingLeaves.length > 0 ? `
      <!-- PENDING LEAVES ALERT PANEL -->
      <div class="glass-panel" style="padding: 1.25rem; margin-bottom: 1.5rem; border-top: 3px solid #fbbf24; background: rgba(251, 191, 36, 0.03); box-shadow: 0 0 20px rgba(251, 191, 36, 0.05); display: flex; flex-direction: column; gap: 0.75rem;">
        <h3 style="font-size: 0.85rem; color: #fbbf24; margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
          <i class="fa-solid fa-umbrella-beach fa-bounce" style="color: #fbbf24;"></i> BEKLEYEN İZİN ONAYLARI (${pendingLeaves.length})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 4px;">
          ${pendingLeaves.map(l => {
            const dateText = `${new Date(l.startDate).toLocaleDateString('tr-TR')} - ${new Date(l.endDate).toLocaleDateString('tr-TR')}`;
            const typeLabel = l.type === 'YILLIK_IZIN' ? 'Yıllık İzin' : (l.type === 'RAPOR' ? 'Sağlık Raporu' : (l.type === 'MAZERET' ? 'Mazeret İzni' : 'Ücretsiz İzin'));
            
            let statusText = '';
            if (l.status === 'PENDING_FIRST') {
              statusText = `<span style="font-size: 0.65rem; color: #fbbf24; font-weight: bold; background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.25); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; font-family: 'Rajdhani', sans-serif;"><i class="fa-solid fa-hourglass-half"></i> İlk Onay Bekliyor</span>`;
            } else if (l.status === 'PENDING_FINAL') {
              statusText = `<span style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: bold; background: rgba(0,243,255,0.08); border: 1px solid rgba(0,243,255,0.25); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; font-family: 'Rajdhani', sans-serif;"><i class="fa-solid fa-user-clock"></i> Son Onayda (Ön Onay: ${l.firstApprovedBy || '---'})</span>`;
            }

            return `
              <div onclick="window.switchLeaveTabAndGo('approvals')" class="reminder-alert-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(251, 191, 36, 0.2); border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-weight: 700; color: #fff; font-size: 0.85rem; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                    ${l.userName} (${l.team || '---'})
                    <span style="font-size: 0.65rem; font-weight: 800; color: #fbbf24; background: rgba(251, 191, 36, 0.15); border: 1px solid rgba(251, 191, 36, 0.35); padding: 2px 6px; border-radius: 4px;">${typeLabel}</span>
                    ${statusText}
                  </span>
                  <span style="font-size: 0.8rem; color: var(--text-muted); font-family: 'Rajdhani', sans-serif;">
                    Talep Edilen: <strong>${l.duration} Gün</strong> (Açıklama: "${l.description}")
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 0.7rem; font-weight: 700; color: var(--accent-cyan); background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.2); padding: 3px 8px; border-radius: 4px;">${dateText}</span>
                  <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 0.8rem;"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      ${dueReminders.length > 0 ? `
      <!-- DUE REMINDERS PANEL -->
      <div class="glass-panel" style="padding: 1.25rem; margin-bottom: 1.5rem; border-top: 3px solid #ef4444; background: rgba(239, 68, 68, 0.03); box-shadow: 0 0 20px rgba(239, 68, 68, 0.05); display: flex; flex-direction: column; gap: 0.75rem;">
        <h3 style="font-size: 0.85rem; color: #ef4444; margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
          <i class="fa-solid fa-bell fa-shake"></i> ZAMANI GELEN TÜRBİN HATIRLATICILARI (${dueReminders.length})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 4px;">
          ${dueReminders.map(r => {
            const dateText = new Date(r.reminderDate).toLocaleDateString('tr-TR');
            const turbine = dataService.findTurbineBySerial(r.turbineId);
            const clickAction = turbine ? `onclick="window.showTurbineDetails('${r.turbineId}', '${turbine.turbineNo}', '${r.siteId}', '${r.siteName.replace(/'/g, "\\'")}')" style="cursor: pointer;"` : '';
            
            const priority = r.priority || 'LOW';
            let priorityBadge = '';
            let itemBorderColor = 'rgba(255, 255, 255, 0.05)';
            let itemGlowStyle = '';
            
            if (priority === 'CRITICAL') {
              priorityBadge = `<span style="font-size: 0.65rem; font-weight: 800; color: #ef4444; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; animation: pulse 2s infinite;"><i class="fa-solid fa-triangle-exclamation"></i> KRİTİK</span>`;
              itemBorderColor = 'rgba(239, 68, 68, 0.3)';
              itemGlowStyle = 'box-shadow: 0 0 10px rgba(239, 68, 68, 0.08);';
            } else if (priority === 'MEDIUM') {
              priorityBadge = `<span style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">ORTA</span>`;
              itemBorderColor = 'rgba(245, 158, 11, 0.2)';
            } else {
              priorityBadge = `<span style="font-size: 0.65rem; font-weight: 800; color: var(--accent-cyan); background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.2); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">DÜŞÜK</span>`;
            }

            return `
              <div ${clickAction} class="reminder-alert-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid ${itemBorderColor}; border-radius: 8px; transition: all 0.2s; ${itemGlowStyle}" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-weight: 700; color: #fff; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    ${r.siteName} — ${turbine ? turbine.turbineNo : r.turbineId}
                    ${priorityBadge}
                  </span>
                  <span style="font-size: 0.8rem; color: var(--text-muted);">${r.content}</span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 0.7rem; font-weight: 700; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); padding: 3px 8px; border-radius: 4px;">${dateText}</span>
                  <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 0.8rem;"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      ${warningTransfers.length > 0 ? `
      <!-- PENDING TRANSFERS ALERT PANEL -->
      <div class="glass-panel" style="padding: 1.25rem; margin-bottom: 1.5rem; border-top: 3px solid #f59e0b; background: rgba(245, 158, 11, 0.03); box-shadow: 0 0 20px rgba(245, 158, 11, 0.05); display: flex; flex-direction: column; gap: 0.75rem;">
        <h3 style="font-size: 0.85rem; color: #f59e0b; margin: 0; display: flex; align-items: center; gap: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
          <i class="fa-solid fa-truck-fast"></i> YOLDA / BEKLEYEN SEVKİYATLAR (${warningTransfers.length})
        </h3>
        <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding-right: 4px;">
          ${warningTransfers.map(t => {
            const daysLabel = t.daysPending >= 3 
              ? `<span style="font-size: 0.65rem; font-weight: 800; color: #ef4444; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px; animation: pulse 2s infinite;"><i class="fa-solid fa-clock"></i> ${t.daysPending} GÜNDÜR YOLDA</span>`
              : `<span style="font-size: 0.65rem; font-weight: 800; color: var(--accent-cyan); background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.2); padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 3px;">${t.daysPending} GÜNDÜR YOLDA</span>`;
            
            const getWhName = (id: string): string => {
              if (!id) return '-';
              if (id.startsWith('team_')) {
                const teamName = id.replace('team_', '').replace(/_/g, ' ');
                return `${teamName} (Ekip)`;
              }
              const wh = dataService.getWarehouses().find(w => w.id === id);
              return wh ? wh.name.replace(/\s*[Dd]epo(su)?\s*$/, '') : id;
            };

            const fromName = getWhName(t.fromSiteId);
            const toName = getWhName(t.toSiteId);
            
            // Format items description
            let itemsSummary = '';
            if (t.items && Array.isArray(t.items)) {
              itemsSummary = t.items.map((it: any) => `${it.materialName} (${it.quantity} ${it.unit || 'Adet'})`).join(', ');
            } else if (t.materialName) {
              itemsSummary = `${t.materialName} (${t.quantity} ${t.unit || 'Adet'})`;
            }
            if (itemsSummary.length > 90) {
              itemsSummary = itemsSummary.substring(0, 87) + '...';
            }

            return `
              <div onclick="window.navigate('transfers')" class="reminder-alert-item" style="cursor: pointer; display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: rgba(255,255,255,0.02); border: 1px solid ${t.daysPending >= 3 ? 'rgba(239, 68, 68, 0.25)' : 'rgba(245, 158, 11, 0.2)'}; border-radius: 8px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
                <div style="display: flex; flex-direction: column; gap: 2px;">
                  <span style="font-weight: 700; color: #fff; font-size: 0.85rem; display: flex; align-items: center; gap: 8px;">
                    ${fromName} ➔ ${toName}
                    ${daysLabel}
                  </span>
                  <span style="font-size: 0.8rem; color: var(--text-muted); font-family: 'Rajdhani', sans-serif;">
                    <strong style="color: var(--accent-cyan);">${t.msfNo || 'Sevk'}</strong>: ${itemsSummary}
                  </span>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="font-size: 0.7rem; font-weight: 700; color: var(--accent-orange); background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.2); padding: 3px 8px; border-radius: 4px;">${t.dateText}</span>
                  <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 0.8rem;"></i>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <!-- MAIN STATS GRID -->
      <div class="dash-stats-grid">
        ${isAllowedSub('dash_activeTeams') ? `
        <div class="dash-stat-card primary">
          <div class="stat-icon"><i class="fa-solid fa-person-digging"></i></div>
          <div class="stat-content">
            <span class="label">AKTİF EKİPLER</span>
            <span class="value" id="dash-stat-active-val" data-count="${activeTasksCount}">${activeTasksCount}</span>
            <span class="sub-label">Sahadaki Toplam İş</span>
          </div>
          <div class="card-glow primary"></div>
        </div>
        ` : ''}

        ${isAllowedSub('dash_faultStatus') ? `
        <div class="dash-stat-card danger">
          <div class="stat-icon"><i class="fa-solid fa-bolt-lightning"></i></div>
          <div class="stat-content">
            <span class="label">ARIZA DURUMU</span>
            <span class="value" id="dash-stat-em-val" data-count="${emergencyTasksCount}">${emergencyTasksCount}</span>
            <span class="sub-label">Müdahale Edilen Arıza</span>
          </div>
          <div class="card-glow danger"></div>
        </div>
        ` : ''}

        ${isAllowedSub('dash_upcomingMaintenance') ? `
        <div class="dash-stat-card info" onclick="window.navigate('bakim-planlama')">
          <div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="stat-content">
            <span class="label">YAKLAŞAN BAKIM</span>
            <span class="value" id="dash-stat-maint-val" data-count="${maintenancePlan.filter(p => p.status !== 'safe').length}">${maintenancePlan.filter(p => p.status !== 'safe').length}</span>
            <span class="sub-label">Kritik Planlama Listesi</span>
          </div>
          <div class="card-glow info"></div>
        </div>
        ` : ''}

        ${isAllowedSub('dash_logisticsPoint') ? `
        <div class="dash-stat-card warning">
          <div class="stat-icon"><i class="fa-solid fa-warehouse"></i></div>
          <div class="stat-content">
            <span class="label">LOJİSTİK NOKTA</span>
            <span class="value" id="dash-stat-sites-val" data-count="${sites.length}">${sites.length}</span>
            <span class="sub-label">Bağlı Depo Sayısı</span>
          </div>
          <div class="card-glow warning"></div>
        </div>
        ` : ''}
      </div>

      <!-- AGENDA + SECONDARY GRID -->
      <div class="dash-agenda-row" style="${!isAllowedSub('dash_agenda') ? 'display: block;' : ''}">
        <!-- 📅 AJANDA WIDGET -->
        ${isAllowedSub('dash_agenda') ? `
        <div class="glass-panel dash-agenda-widget">
          <div class="section-header" style="margin-bottom: 0.75rem;">
            <h3><i class="fa-solid fa-calendar-days" style="color: #a78bfa;"></i> AJANDA</h3>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button onclick="window.agendaPrevMonth()" class="agenda-nav-btn"><i class="fa-solid fa-chevron-left"></i></button>
              <span id="agenda-month-label" style="font-size: 0.75rem; font-weight: 800; color: #a78bfa; min-width: 100px; text-align: center; letter-spacing: 1px;"></span>
              <button onclick="window.agendaNextMonth()" class="agenda-nav-btn"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>

          <!-- Mini Calendar -->
          <div id="agenda-mini-calendar" class="agenda-mini-cal"></div>

          <!-- Upcoming Events Timeline -->
          <div style="margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem;">
              <span style="font-size: 0.6rem; font-weight: 900; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase;">YAKLASAN OLAYLAR</span>
              <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
            </div>
            <div id="agenda-timeline" class="agenda-timeline custom-scrollbar"></div>
          </div>

          <!-- Legend -->
          <div style="display: flex; gap: 12px; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04);">
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #f59e0b;"></span>Görev</span>
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #ef4444;"></span>Gecikmiş</span>
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #a78bfa;"></span>Bakım</span>
          </div>
        </div>
        ` : ''}

        <!-- RIGHT SIDE: Existing Sections -->
        <div class="dash-agenda-right" style="${!isAllowedSub('dash_agenda') ? 'grid-template-columns: 1fr 350px;' : ''}">
          <!-- Live Activity Feed -->
          ${isAllowedSub('dash_activeTaskFlow') ? `
          <div class="glass-panel dash-feed-section">
            <div class="section-header">
              <h3><i class="fa-solid fa-person-running"></i> AKTİF GÖREV AKIŞI</h3>
              <span class="count-tag">${activeTasksCount} GÖREV</span>
            </div>
            <div class="feed-container custom-scrollbar" style="display: flex; flex-direction: column;">
              ${activeFeedHtml}
            </div>
          </div>
          ` : ''}

          <!-- Global Stock Search + Quick Actions -->
          <div class="dash-sidebar-section" style="${!isAllowedSub('dash_activeTaskFlow') ? 'grid-column: span 2;' : ''}">
            ${isAllowedSub('dash_globalStockQuery') ? `
            <div class="glass-panel stock-search-card">
              <h3><i class="fa-solid fa-magnifying-glass-chart"></i> GLOBAL STOK SORGULAMA</h3>
              <div class="search-box">
                <input type="text" id="global-sap-search" placeholder="SAP Numarası girin..." onkeypress="if(event.key==='Enter') window.searchGlobalStock()">
                <button onclick="window.searchGlobalStock()"><i class="fa-solid fa-search"></i></button>
              </div>
              <div id="global-stock-results" class="results-container custom-scrollbar">
                <div class="placeholder">SAP numarası girerek tüm depolardaki stok miktarını anlık sorgulayabilirsiniz.</div>
              </div>
            </div>
            ` : ''}
            <div class="quick-actions-grid" style="${!isAllowedSub('dash_globalStockQuery') ? 'margin-top: 0;' : ''}">
              ${isAllowedSub('dash_createTask') ? `
              <button class="action-btn" onclick="window.navigate('task-create')">
                <i class="fa-solid fa-plus"></i>
                <span>GÖREV OLUŞTUR</span>
              </button>
              ` : ''}
              ${isAllowedSub('dash_inventory') ? `
              <button class="action-btn" onclick="window.navigate('inventory')">
                <i class="fa-solid fa-boxes-stacked"></i>
                <span>ENVANTER</span>
              </button>
              ` : ''}
              ${isAllowedSub('dash_turbineQrScan') ? `
              <button class="action-btn" onclick="window.scanTurbineQR()" style="${(!isAllowedSub('dash_createTask') || !isAllowedSub('dash_inventory')) ? 'grid-column: span 2;' : 'grid-column: span 2;'} background: rgba(0, 243, 255, 0.05); border-color: rgba(0, 243, 255, 0.1); color: var(--accent-cyan);">
                <i class="fa-solid fa-qrcode"></i>
                <span>TÜRBİN QR SİCİL OKUT</span>
              </button>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .dashboard-container { 
        padding: 1.25rem; 
        display: flex; 
        flex-direction: column; 
        gap: 1.5rem; 
        position: relative; 
        z-index: 1; 
        max-width: 100%;
        box-sizing: border-box;
        overflow-x: hidden;
      }
      .dash-header { display: flex; justify-content: space-between; align-items: center; position: relative; z-index: 2; }
      .welcome-text h1 { 
        font-family: 'Rajdhani', sans-serif; 
        font-size: 1.6rem; 
        font-weight: 900; 
        letter-spacing: 1.5px; 
        margin: 0; 
        color: #fff; 
        display: flex; 
        align-items: center; 
        text-transform: uppercase; 
        text-shadow: 0 0 10px rgba(0, 243, 255, 0.25); 
      }
      .welcome-text .v-tag { font-size: 0.55rem; background: linear-gradient(135deg, #64ffda, #00bcd4); color: #000; padding: 2px 6px; border-radius: 5px; vertical-align: middle; margin-left: 8px; font-weight: 900; letter-spacing: 1px; }
      .welcome-text p { 
        color: var(--accent-cyan) !important; 
        font-family: 'Rajdhani', sans-serif; 
        font-weight: 700; 
        letter-spacing: 1px; 
        text-transform: uppercase; 
        font-size: 0.7rem; 
        margin: 4px 0 0 0; 
        opacity: 0.85; 
        text-shadow: 0 0 6px rgba(0, 243, 255, 0.15);
      }

      /* HUD Animations */
      .hologram-blade-group {
        animation: turbine-rotate 10s linear infinite;
      }
      .hud-circle {
        animation: spin-clockwise 25s linear infinite;
      }
      .radar-bezel {
        animation: spin-clockwise 35s linear infinite;
      }
      .radar-sweep {
        animation: spin-clockwise 4s linear infinite;
      }
      @keyframes turbine-rotate {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes spin-clockwise {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }

      /* Frosted Glass Override */
      .dashboard-container .glass-panel {
        background: linear-gradient(135deg, rgba(16, 22, 37, 0.75), rgba(9, 13, 22, 0.95)) !important;
        backdrop-filter: blur(25px) !important;
        border: 1px solid rgba(0, 243, 255, 0.08) !important;
        border-top: 2px solid rgba(0, 243, 255, 0.2) !important;
        border-radius: 16px !important;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        position: relative;
        overflow: hidden;
        z-index: 2;
      }
      .dashboard-container .glass-panel::after {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, rgba(255,255,255,0.02) 0%, rgba(255,255,255,0) 100%);
        pointer-events: none;
      }
      .dashboard-container .glass-panel:hover {
        border-color: rgba(0, 243, 255, 0.15) !important;
        box-shadow: 0 20px 55px rgba(0, 243, 255, 0.04) !important;
        transform: translateY(-2px);
      }
      
      .agent-summary-strip { display: flex; gap: 8px; }
      .agent-mini-tag { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-muted); }
      .agent-mini-tag.online .pulse-dot { background: var(--accent-green); box-shadow: 0 0 5px var(--accent-green); }
      .pulse-dot { width: 6px; height: 6px; border-radius: 50%; }

      /* Stats Grid */
      .dash-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1.25rem; max-width: 100%; box-sizing: border-box; }
      .dash-stat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 0.8rem 1.1rem; display: flex; align-items: center; gap: 1rem; position: relative; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
      .dash-stat-card:hover { transform: translateY(-5px); background: rgba(255,255,255,0.04); }
      .dash-stat-card.primary:hover { border-color: rgba(0, 243, 255, 0.35) !important; box-shadow: 0 12px 30px rgba(0, 243, 255, 0.12), inset 0 1px 0 rgba(255,255,255,0.1) !important; }
      .dash-stat-card.danger:hover { border-color: rgba(255, 77, 77, 0.35) !important; box-shadow: 0 12px 30px rgba(255, 77, 77, 0.12), inset 0 1px 0 rgba(255,255,255,0.1) !important; }
      .dash-stat-card.info:hover { border-color: rgba(162, 155, 254, 0.35) !important; box-shadow: 0 12px 30px rgba(162, 155, 254, 0.12), inset 0 1px 0 rgba(255,255,255,0.1) !important; }
      .dash-stat-card.warning:hover { border-color: rgba(255, 159, 67, 0.35) !important; box-shadow: 0 12px 30px rgba(255, 159, 67, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.1) !important; }
      .dash-stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, currentColor, transparent); opacity: 0; transition: opacity 0.4s; }
      .dash-stat-card:hover::before { opacity: 0.5; }
      
      /* Card glow effect */
      .card-glow { position: absolute; top: -50%; right: -50%; width: 100%; height: 100%; border-radius: 50%; filter: blur(60px); opacity: 0.06; transition: opacity 0.4s; pointer-events: none; }
      .dash-stat-card:hover .card-glow { opacity: 0.12; }
      .card-glow.primary { background: #00f3ff; }
      .card-glow.danger { background: #ff4d4d; }
      .card-glow.info { background: #a29bfe; }
      .card-glow.warning { background: #ff9f43; }
 
      .dash-stat-card .stat-icon { width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: all 0.4s; }
      .dash-stat-card:hover .stat-icon { transform: scale(1.1) rotate(-5deg); }
      .dash-stat-card.primary .stat-icon { background: rgba(0, 243, 255, 0.1); color: var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 243, 255, 0.08); }
      .dash-stat-card.danger .stat-icon { background: rgba(255, 77, 77, 0.1); color: var(--accent-red); box-shadow: 0 0 20px rgba(255, 77, 77, 0.08); }
      .dash-stat-card.info .stat-icon { background: rgba(162, 155, 254, 0.1); color: #a29bfe; box-shadow: 0 0 20px rgba(162, 155, 254, 0.08); }
      .dash-stat-card.warning .stat-icon { background: rgba(255, 159, 67, 0.1); color: var(--accent-orange); box-shadow: 0 0 20px rgba(255, 159, 67, 0.08); }
      .dash-stat-card .label { font-size: 0.62rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.2px; text-transform: uppercase; }
      .dash-stat-card .value { font-size: 1.5rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif; line-height: 1.1; margin: 1px 0; }
      .dash-stat-card .sub-label { font-size: 0.65rem; color: var(--text-dim); }
      
      /* Counter animation */
      @keyframes countPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      .dash-stat-card .value.counted { animation: countPulse 0.4s ease-out; }
      
      /* Stat card entrance animation */
      @keyframes statCardIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .dash-stat-card { animation: statCardIn 0.5s ease-out backwards; }
      .dash-stat-card:nth-child(1) { animation-delay: 0.05s; }
      .dash-stat-card:nth-child(2) { animation-delay: 0.12s; }
      .dash-stat-card:nth-child(3) { animation-delay: 0.19s; }
      .dash-stat-card:nth-child(4) { animation-delay: 0.26s; }

      /* Maintenance Plan Section */
      .maintenance-plan-section { padding: 1.5rem; }
      .maintenance-plan-section .legend { display: flex; gap: 1rem; }
      .l-item { font-size: 0.65rem; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text-muted); }
      .l-item::before { content: ''; width: 8px; height: 8px; border-radius: 50%; }
      .l-item.overdue::before { background: var(--accent-red); }
      .l-item.warning::before { background: var(--accent-orange); }
      .l-item.safe::before { background: var(--accent-green); }

      .plan-table-container { max-height: 400px; overflow-y: auto; margin-top: 1rem; }
      .plan-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .plan-table th { text-align: left; padding: 1rem; color: var(--text-muted); font-family: 'Rajdhani'; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.05); }
      .plan-table td { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.02); }
      
      .plan-table tr.overdue td { background: rgba(255, 77, 77, 0.05); }
      .plan-table tr.warning td { background: rgba(255, 159, 67, 0.05); }
      
      .m-tag { font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; }
      .m-tag.next { border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-weight: 700; }

      .plan-status-pill { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 4px; }
      .plan-status-pill.overdue { background: var(--accent-red); color: #fff; }
      .plan-status-pill.warning { background: var(--accent-orange); color: #fff; }
      .plan-status-pill.safe { background: var(--accent-green); color: #000; }

      /* Main Grid */
      .dash-agenda-row { display: grid; grid-template-columns: minmax(280px, 320px) minmax(0, 1fr); gap: 1.25rem; max-width: 100%; box-sizing: border-box; }
      @media (max-width: 1280px) { .dash-agenda-row { grid-template-columns: 1fr; } }
      .dash-agenda-right { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 320px); gap: 1.25rem; max-width: 100%; box-sizing: border-box; }
      @media (max-width: 1024px) { .dash-agenda-right { grid-template-columns: 1fr; } }

      .dash-feed-section { 
        padding: 1.5rem; 
        display: flex; 
        flex-direction: column; 
        border-top: 3px solid #00f3ff !important;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.45), 0 0 20px rgba(0, 243, 255, 0.08) !important;
      }
      .empty-feed {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        text-align: center;
        padding: 3.5rem 1.5rem;
        color: var(--text-dim);
        font-size: 0.85rem;
        background: rgba(255, 255, 255, 0.01);
        border: 1px dashed rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        gap: 0.75rem;
      }
      .empty-feed i {
        font-size: 2rem;
        color: var(--accent-cyan);
        opacity: 0.4;
        animation: pulseSlow 3s infinite ease-in-out;
      }
      @keyframes pulseSlow {
        0%, 100% { opacity: 0.4; transform: scale(1); }
        50% { opacity: 0.7; transform: scale(1.08); }
      }

      .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
      .section-header h3 { font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: var(--text-main); letter-spacing: 1px; margin: 0; }
      .count-tag { font-size: 0.65rem; background: var(--accent-cyan); color: #000; font-weight: 900; padding: 2px 8px; border-radius: 4px; }

      .feed-container { display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto; overflow-x: hidden; padding: 4px 8px 4px 4px; }
      
      .feed-item {
        background: rgba(255, 255, 255, 0.01) !important;
        border: 1px solid rgba(255, 255, 255, 0.04) !important;
        padding: 0.9rem 1.1rem !important;
        border-radius: 12px !important;
        display: flex;
        gap: 0.75rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      .feed-item::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        width: 3px;
        height: 100%;
        background: var(--accent-cyan);
        opacity: 0.4;
        transition: all 0.3s;
      }
      .feed-item.emergency::before {
        background: var(--accent-red);
        opacity: 1;
        box-shadow: 0 0 10px var(--accent-red);
      }
      .feed-item:hover {
        background: rgba(0, 243, 255, 0.02) !important;
        border-color: rgba(0, 243, 255, 0.2) !important;
        transform: translateX(4px) scale(1.01);
      }
      .feed-item:hover::before {
        opacity: 1;
        width: 4px;
        box-shadow: 0 0 12px var(--accent-cyan);
      }

      .feed-marker { display: none; }

      .feed-content { flex: 1; display: flex; flex-direction: column; gap: 6px; position: relative; z-index: 2; }
      .feed-header { display: flex; justify-content: space-between; align-items: center; }
      .site-tag { font-size: 0.9rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif; }
      .task-type { font-size: 0.65rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; }
      
      .personnel-row { font-size: 0.8rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
      .personnel-row i { color: var(--accent-orange); font-size: 0.7rem; }
      
      .task-desc-row { font-size: 0.75rem; color: var(--text-muted); padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; margin-top: 2px; line-height: 1.4; display: flex; align-items: flex-start; gap: 8px; }
      .task-desc-row i { color: var(--accent-cyan); font-size: 0.65rem; margin-top: 3px; }

      .status-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
      .status-text { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
      .time-text { font-size: 0.65rem; color: var(--text-dim); }

      /* Stock Search Card */
      .stock-search-card { 
        padding: 1.5rem; 
        display: flex; 
        flex-direction: column; 
        gap: 1rem; 
        border-top: 3px solid var(--accent-orange) !important;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.45), 0 0 20px rgba(255, 159, 67, 0.08) !important;
      }
      .stock-search-card h3 { font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: var(--accent-cyan); margin: 0; }
      
      .search-box { display: flex; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 4px; }
      .search-box input { flex: 1; background: transparent; border: none; color: #fff; padding: 8px 12px; font-size: 0.85rem; outline: none; font-family: 'Rajdhani', sans-serif; font-weight: 600; letter-spacing: 0.5px; }
      .search-box button { background: var(--accent-cyan); border: none; color: #000; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; transition: all 0.2s; }
      .search-box button:hover { background: #fff; transform: scale(1.05); }
      
      .results-container { min-height: 150px; max-height: 300px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 8px; }
      .placeholder { font-size: 0.75rem; color: var(--text-dim); text-align: center; padding: 2rem 1rem; line-height: 1.5; }
      .no-results { color: var(--accent-red); font-size: 0.75rem; text-align: center; padding: 1rem; }
      .loader-mini { color: var(--accent-cyan); font-size: 0.75rem; text-align: center; padding: 1rem; }
      
      .stock-result-item { background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--accent-green); gap: 12px; }
      .stock-result-item .site-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .stock-result-item .site { font-size: 0.75rem; font-weight: 700; color: var(--text-main); }
      .stock-result-item .desc { font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .stock-result-item .qty { font-size: 0.85rem; font-weight: 900; color: var(--accent-green); font-family: 'Rajdhani'; flex-shrink: 0; }

      .quick-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: auto; }
      .action-btn { background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
      .action-btn:hover { background: rgba(0, 243, 255, 0.04); border-color: rgba(0, 243, 255, 0.2); transform: translateY(-3px); box-shadow: 0 8px 20px rgba(0, 243, 255, 0.05); }
      .action-btn i { font-size: 1.2rem; color: var(--accent-cyan); transition: transform 0.3s; }
      .action-btn:hover i { transform: scale(1.15) rotate(5deg); }
      .action-btn span { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }

      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 10px; }

      /* ===== AJANDA WIDGET STYLES ===== */
      .dash-agenda-widget {
        padding: 1.25rem;
        border-top: 3px solid #a78bfa !important;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.45), 0 0 20px rgba(167, 139, 250, 0.08) !important;
        position: relative;
        overflow: hidden;
      }
      .dash-agenda-widget::before {
        content: '';
        position: absolute;
        top: -40%;
        right: -40%;
        width: 80%;
        height: 80%;
        background: radial-gradient(circle, rgba(167, 139, 250, 0.06) 0%, transparent 70%);
        pointer-events: none;
      }

      /* Nav Buttons */
      .agenda-nav-btn {
        background: rgba(167, 139, 250, 0.1);
        border: 1px solid rgba(167, 139, 250, 0.2);
        color: #a78bfa;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        transition: all 0.2s;
      }
      .agenda-nav-btn:hover {
        background: rgba(167, 139, 250, 0.2);
        transform: scale(1.1);
      }

      /* Mini Calendar */
      .agenda-mini-cal { user-select: none; }
      .cal-header-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-bottom: 4px;
      }
      .cal-day-name {
        text-align: center;
        font-size: 0.55rem;
        font-weight: 900;
        color: rgba(255,255,255,0.25);
        letter-spacing: 1px;
        padding: 4px 0;
      }
      .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .cal-day {
        text-align: center;
        font-size: 0.7rem;
        padding: 5px 2px;
        border-radius: 6px;
        color: rgba(255,255,255,0.5);
        transition: all 0.2s;
        font-weight: 600;
        position: relative;
        cursor: pointer;
      }
      .cal-day:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }
      .cal-day.empty { visibility: hidden; cursor: default; }
      .cal-day.empty:hover { background: transparent; }
      .cal-day.selected {
        background: rgba(0, 242, 255, 0.25) !important;
        color: #00f2ff !important;
        font-weight: 800;
        box-shadow: 0 0 10px rgba(0, 242, 255, 0.2);
        border: 1.2px solid rgba(0, 242, 255, 0.45);
      }
      .cal-day.today {
        background: rgba(167, 139, 250, 0.2);
        color: #a78bfa;
        font-weight: 900;
        box-shadow: 0 0 10px rgba(167, 139, 250, 0.15);
        border: 1px solid rgba(167, 139, 250, 0.3);
      }
      .cal-day.has-event::after {
        content: '';
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
      }
      .cal-day.has-event.task::after { background: #f59e0b; }
      .cal-day.has-event.overdue::after { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.5); }
      .cal-day.has-event.maintenance::after { background: #a78bfa; }

      /* Timeline */
      .agenda-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .agenda-event-item {
        display: grid;
        grid-template-columns: 50px 20px 1fr;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        transition: all 0.2s;
      }
      .agenda-event-item:hover {
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        padding-left: 6px;
      }
      .agenda-event-item.past { opacity: 0.5; }
      .agenda-event-date {
        font-size: 0.65rem;
        font-weight: 800;
        color: rgba(255,255,255,0.4);
        text-align: right;
        padding-right: 8px;
      }
      .agenda-event-line {
        display: flex;
        justify-content: center;
        position: relative;
      }
      .agenda-event-line::before {
        content: '';
        position: absolute;
        top: -12px;
        bottom: -12px;
        width: 1px;
        background: rgba(255,255,255,0.06);
      }
      .agenda-event-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ev-color);
        box-shadow: 0 0 6px var(--ev-color);
        position: relative;
        z-index: 1;
      }
      .agenda-event-body { padding-left: 8px; }
      .agenda-event-title {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-main);
        display: flex;
        align-items: center;
      }
      .agenda-event-sub {
        font-size: 0.6rem;
        color: var(--text-muted);
        margin-top: 2px;
      }

      /* Legend */
      .agenda-legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.6rem;
        font-weight: 700;
        color: rgba(255,255,255,0.35);
      }
      .agenda-legend-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
    </style>
  `;
};
