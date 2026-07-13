// NATIVE INDEXEDDB CACHE CLEAR (ON VERSION UPGRADE)
if (typeof window !== 'undefined') {
  const cacheVersion = 'v1.0.5';
  if (localStorage.getItem('firestore_cache_ver') !== cacheVersion) {
    try {
      window.indexedDB.deleteDatabase('firestore/[DEFAULT]/dh-servis-rapor/main');
      localStorage.setItem('firestore_cache_ver', cacheVersion);
    } catch (e) {}
  }
}

import './style.css'
import { offlineSyncService } from './services/OfflineSyncService';

// --- SERVICE WORKER AUTO-UPDATE AND CACHE RELOADER ---
function showUpdateOverlay() {
  if (document.getElementById('system-update-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'system-update-overlay';
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.backgroundColor = 'rgba(10, 15, 25, 0.85)';
  overlay.style.backdropFilter = 'blur(12px)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '999999';
  overlay.style.color = 'white';
  overlay.style.fontFamily = "'Rajdhani', sans-serif";
  
  overlay.innerHTML = `
    <div style="position: relative; background: rgba(13, 18, 30, 0.85); border: 1px solid rgba(20, 241, 149, 0.25); box-shadow: 0 0 50px rgba(20, 241, 149, 0.15), inset 0 0 20px rgba(20, 241, 149, 0.05); border-radius: 24px; width: 100%; max-width: 440px; padding: 3.5rem 2.5rem; text-align: center; overflow: hidden; backdrop-filter: blur(20px);">
      <!-- Cyber Scanlines -->
      <div class="cyber-scanlines" style="position: absolute; inset: 0; background: linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06)); background-size: 100% 4px, 6px 100%; pointer-events: none; opacity: 0.4;"></div>
      
      <!-- Ambient Glow Circles inside the Card -->
      <div style="position: absolute; top: -20%; left: -20%; width: 150px; height: 150px; background: rgba(20, 241, 149, 0.15); filter: blur(50px); border-radius: 50%; pointer-events: none;"></div>
      <div style="position: absolute; bottom: -20%; right: -20%; width: 150px; height: 150px; background: rgba(0, 242, 254, 0.1); filter: blur(50px); border-radius: 50%; pointer-events: none;"></div>

      <!-- Icon Container with Double Ring -->
      <div style="position: relative; width: 100px; height: 100px; margin: 0 auto 2rem auto; display: flex; align-items: center; justify-content: center;">
        <!-- Pulsing Outer Ring -->
        <div style="position: absolute; inset: -10px; border: 2px dashed rgba(20, 241, 149, 0.3); border-radius: 50%; animation: spin-clockwise 20s linear infinite;"></div>
        <!-- Inner Glowing Rotating Ring -->
        <div style="position: absolute; inset: -4px; border: 3px solid transparent; border-top-color: #14F195; border-bottom-color: #14F195; border-radius: 50%; animation: spin-counter-clockwise 3s cubic-bezier(0.53, 0.21, 0.29, 0.67) infinite; filter: drop-shadow(0 0 8px rgba(20, 241, 149, 0.5));"></div>
        
        <!-- Glowing Check Icon -->
        <div style="background: linear-gradient(135deg, #14f195, #00f2fe); width: 76px; height: 76px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #0d121e; font-size: 2.2rem; box-shadow: 0 0 30px rgba(20, 241, 149, 0.6); animation: pulse-icon 2s infinite; z-index: 2;">
          <i class="fa-solid fa-check" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));"></i>
        </div>
      </div>

      <!-- Animated Glow Title -->
      <h2 class="neon-title" style="font-size: 2.1rem; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 1rem 0; font-family: 'Rajdhani', sans-serif; background: linear-gradient(90deg, #14F195, #00f2fe); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-shadow: 0 0 15px rgba(20, 241, 149, 0.25);">
        SİSTEM GÜNCELLEMESİ
      </h2>
      
      <!-- Subtext -->
      <p style="font-size: 1.05rem; color: #a0aec0; line-height: 1.6; margin: 0 0 2rem 0; font-family: 'Inter', sans-serif; font-weight: 500;">
        Uygulamanın yeni bir sürümü başarıyla yüklendi.<br>
        <span style="color: rgba(255,255,255,0.7); display: inline-flex; align-items: center; gap: 2px;">
          Sayfa yenileniyor<span class="dot-1">.</span><span class="dot-2">.</span><span class="dot-3">.</span>
        </span>
      </p>

      <!-- Tech Progress Bar loader -->
      <div style="width: 100%; height: 4px; background: rgba(255, 255, 255, 0.05); border-radius: 10px; overflow: hidden; position: relative;">
        <div style="position: absolute; top: 0; left: 0; height: 100%; width: 50%; background: linear-gradient(90deg, transparent, #14F195, #00f2fe); border-radius: 10px; animation: loading-bar-flow 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;"></div>
      </div>
    </div>
    <style>
      @keyframes spin-clockwise {
        to { transform: rotate(360deg); }
      }
      @keyframes spin-counter-clockwise {
        to { transform: rotate(-360deg); }
      }
      @keyframes pulse-icon {
        0% { transform: scale(1); box-shadow: 0 0 20px rgba(20, 241, 149, 0.5); }
        50% { transform: scale(1.05); box-shadow: 0 0 35px rgba(20, 241, 149, 0.8), 0 0 15px rgba(0, 242, 254, 0.4); }
        100% { transform: scale(1); box-shadow: 0 0 20px rgba(20, 241, 149, 0.5); }
      }
      @keyframes loading-bar-flow {
        0% { left: -50%; }
        100% { left: 100%; }
      }
      .dot-1 { animation: dot-blink 1.4s infinite; animation-delay: 0.0s; }
      .dot-2 { animation: dot-blink 1.4s infinite; animation-delay: 0.2s; }
      .dot-3 { animation: dot-blink 1.4s infinite; animation-delay: 0.4s; }
      @keyframes dot-blink {
        0% { opacity: 0.2; }
        50% { opacity: 1; }
        100% { opacity: 0.2; }
      }
    </style>
  `;
  document.body.appendChild(overlay);
}

if ('serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    console.log("New service worker activated. Reloading page to apply updates...");
    showUpdateOverlay();
    setTimeout(() => {
      window.location.reload();
    }, 2500);
  });
}

async function checkSystemVersion() {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`);
    if (!res.ok) return;
    const data = await res.json();
    const serverVersion = data.version;
    const localVersion = localStorage.getItem('app_version');
    
    if (!localVersion) {
      localStorage.setItem('app_version', serverVersion);
      return;
    }
    
    if (localVersion !== serverVersion) {
      showUpdateOverlay();
      localStorage.setItem('app_version', serverVersion);
      setTimeout(() => {
        window.location.reload();
      }, 2500);
    }
  } catch (e) {
    console.error("Version check error:", e);
  }
}

// Check version on load and every 15 seconds for instant detection
checkSystemVersion();
setInterval(checkSystemVersion, 15000);

// --- GLOBAL ERROR TRACKER ---
(window as any).getSystemErrors = () => JSON.parse(localStorage.getItem('system_errors') || '[]');
window.onerror = (msg, url, line, col, err) => {
  const logs = JSON.parse(localStorage.getItem('system_errors') || '[]');
  logs.push({ msg, url, line, col, stack: err?.stack, time: new Date().toLocaleString() });
  localStorage.setItem('system_errors', JSON.stringify(logs.slice(-20)));
  return false; 
};
console.log("%c DH SERVIS STABILITY PATCH V3 - GLOBAL MODAL ACTIVE ", "background: #00f3ff; color: #000; font-weight: bold; padding: 4px;");

(window as any).syncOfflineReports = async () => {
  try {
    const queued = await offlineSyncService.getQueuedReports();
    if (queued.length === 0) return;
    
    (window as any).showToast?.('SENKRONİZASYON', `${queued.length} çevrimdışı rapor sisteme yükleniyor...`, 'info');
    const { serviceReportService } = await import('./services/ServiceReportService');
    
    for (const item of queued) {
      try {
        const files = item.files.map((f: any) => offlineSyncService.base64ToFile(f.data, f.name, f.type));
        await serviceReportService.saveReport(item.report, files);
        await offlineSyncService.removeReportFromQueue(item.id);
        
        // Send notification to ADMIN
        const { db } = await import('./firebase');
        const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
        await addDoc(collection(db, 'system_notifications'), {
          userId: 'ADMIN', 
          type: 'system',
          title: 'Çevrimdışı Rapor Yüklendi',
          message: `${item.report.reportNo} numaralı rapor başarıyla sisteme aktarıldı.`,
          link: 'analytics',
          createdAt: serverTimestamp(),
          read: false
        });
        
      } catch (err) {
        console.error("Senkronizasyon hatası (Rapor ID: " + item.id + "):", err);
      }
    }
    
    (window as any).showToast?.('BAŞARILI', `Çevrimdışı raporlar başarıyla senkronize edildi.`, 'success');
  } catch (e) {
    console.error("Kuyruk okuma hatası:", e);
  }
};

import { dataService, DataService } from './services/DataService'
import { authService } from './services/AuthService'
import { taskService } from './services/TaskService'
import { userService } from './services/UserService'
import type { UserProfile } from './services/UserService'
import { formatTeamName, formatDisplayName } from './utils/formatters'
import { TurbineDetailModal } from './components/TurbineDetailModal';

// Types
type Page = 'dashboard' | 'tasks' | 'inventory' | 'turbines' | 'teams' | 'new-task' | 'login' | 'warehouses' | 'transfers' | 'users' | 'templates' | 'analytics' |
  'form-ariza' | 'form-gen-ariza' | 'form-rulman-ariza' |
  'form-e44e48-ana' | 'form-e44e48-yag' | 'form-e44e48-4yil' |
  'form-e70-all' | 'form-e82-all' | 'form-e82e2-ana' | 'form-yag-4yil' |
  'form-e92-ana' | 'form-e92-yag' | 'form-e92-4yil' | 'form-ruzgar' |
  'reports-archive' | 'task-create' | 'MALZEME_YONETIMI' | 'material-analytics' | 'global-history' | 'repair-history' | 'form-template-edit' | 'siparis' | 'bakim-planlama' | 'bearing-analysis' | 'predictive-agent' | 'code-advisor-agent' | 'tsi-library' | 'asset-custody' | 'tickets-page' | 'visual-bom' | 'purchase-requests' | 'online-users' | 'image-pool' | 'workshop' | 'workshop-stock' | 'kkd-kontrol' | 'olcu-aletleri' | 'tork-aletleri' | 'overtime-approvals' | 'personnel-management';

interface AppState {
  currentPage: Page
  selectedSiteId?: string
  selectedWarehouseId?: string | null
  selectedTemplate?: string | null
  userProfile: UserProfile | null
  activeTask?: any
  selectedReportSiteId?: string
  inventorySortKey: string;
  inventorySortDirection: 'asc' | 'desc';
  inventorySearchQuery: string;
  warehouseTab: string;
}

const state: AppState = {
  currentPage: 'dashboard',
  userProfile: null,
  activeTask: null,
  selectedReportSiteId: 'TÜMÜ',
  selectedWarehouseId: null,
  selectedTemplate: null,
  inventorySortKey: 'sapNo',
  inventorySortDirection: 'asc',
  inventorySearchQuery: '',
  warehouseTab: 'inventory',
};
(window as any).appState = state;

// Components
const Sidebar = () => {
  const sites = dataService.getSites();
  const warehouses = dataService.getWarehouses();
  const profile = state.userProfile;

  // Filter warehouses based on permissions
  const rawWarehouses = warehouses.filter(w => {
    if ((profile?.role as any) === 'ADMIN' || (profile?.role as any) === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com') return true;
    if ((profile?.role as any) === 'TAMİR' || (profile?.role as any) === 'TAMIR') return w.id === 'MTA';
    return profile?.allowedWarehouses?.includes(w.id);
  });

  const filteredWarehouses = rawWarehouses.sort((a, b) => {
    const cleanA = a.name.replace(' Depo', '').trim();
    const cleanB = b.name.replace(' Depo', '').trim();
    const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === cleanA.toLowerCase());
    const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === cleanB.toLowerCase());
    if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Filter sites and tabs based on permissions
  const filteredSites = (sites || [])
    .filter(s => {
      if ((profile?.role as any) === 'ADMIN') return true;
      return profile?.allowedSites?.includes(s.id);
    })
    .sort((a, b) => {
      const indexA = DataService.customOrder.findIndex(o => o.toLowerCase() === a.name.toLowerCase());
      const indexB = DataService.customOrder.findIndex(o => o.toLowerCase() === b.name.toLowerCase());
      if (indexA === -1 && indexB === -1) return a.name.localeCompare(b.name);
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });

  const isAllowed = (tab: string) => {
    if (!profile) return false;
    const userRole = profile?.role?.toUpperCase();
    const email = profile?.email?.toLowerCase();
    
    // ADMIN has full access
    if (userRole === 'ADMIN') return true;
    
    // Special coordinator override for hursit.akter@demirerholding.com or role MALZEME_YONETIMI
    if (email === 'hursit.akter@demirerholding.com' || userRole === 'MALZEME_YONETIMI') {
      const allowedForMalzemeYonetimi = [
        'material-analytics', 'purchase-requests', 'warehouses', 'transfers', 
        'reports-archive', 'global-history', 'asset-custody', 'repair-history', 'workshop', 'workshop-stock'
      ];
      if (allowedForMalzemeYonetimi.includes(tab)) return true;
      return false; // Absolutely restrict from tasks, turbines, etc.
    }

    // TAMİR role access
    if ((userRole as any) === 'TAMİR' || (userRole as any) === 'TAMIR') {
      const allowedForTamir = ['workshop', 'workshop-stock', 'warehouses'];
      if (allowedForTamir.includes(tab)) return true;
      return false;
    }

    const tabs = profile.allowedTabs;
    if (tabs) {
      if (tab === 'new-task') {
        if (Array.isArray(tabs)) return false; // Array indicates old structure
        const tasksPerm = (tabs as any)['tasks'];
        if (typeof tasksPerm === 'object') return !!tasksPerm.createTask;
        return false;
      }

      if (Array.isArray(tabs) && tabs.length > 0) {
        return tabs.includes(tab);
      }
      if (typeof tabs === 'object' && Object.keys(tabs).length > 0) {
        const val = (tabs as any)[tab];
        if (typeof val === 'object' && val !== null) {
          return !!val.access;
        }
        return !!val;
      }
    }
    
    // Default allowed for all logged in users if no custom tab configuration is set
    if (['dashboard', 'tasks', 'turbines', 'siparis', 'bearing-analysis', 'visual-bom'].includes(tab)) return true;
    return false;
  };

  const isMaterialManager = profile?.role === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';

  return `
    <aside class="sidebar">
      <div class="sidebar-logo">
        <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
          <div class="turbine-icon-wrapper" style="color: var(--accent-cyan); width: 30px; height: 40px; transform: scale(0.7);">
            <div class="turbine-tower" style="height: 25px;"></div>
            <div class="turbine-head" style="bottom: 0px; width: 40px; height: 40px;">
              <svg class="turbine-blades-svg" viewBox="0 0 100 100">
                <g transform="translate(50, 50)">
                  <g id="logo-blade">
                    <path d="M-2,0 C-2,-10 2,-10 2,0 L1,-38 C1,-40 -1,-40 -1,-38 Z" fill="currentColor" />
                  </g>
                  <use href="#logo-blade" transform="rotate(120)" />
                  <use href="#logo-blade" transform="rotate(240)" />
                  <circle r="3" fill="currentColor" />
                </g>
              </svg>
            </div>
          </div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px; color: var(--text-main); font-size: ${isMaterialManager ? '1.1rem' : '1.25rem'}; line-height: 1.1;">
            ${isMaterialManager ? 'MALZEME<br><span style="color: var(--accent-cyan); font-size: 0.9rem;">YÖNETİM SİSTEMİ</span>' : 'DH_<span style="color: var(--accent-cyan);">SERVİS</span>'}
          </h2>
        </div>
      </div>
      
      <nav class="nav-menu">
        ${isAllowed('dashboard') ? `
          <li class="nav-item ${state.currentPage === 'dashboard' ? 'active' : ''}" onclick="window.navigate('dashboard')">
            <i class="fa-solid fa-gauge-high"></i> Dashboard
          </li>
        ` : ''}

        ${(isAllowed('tasks') || isAllowed('new-task') || isAllowed('turbines') || isAllowed('warehouses') || isAllowed('reports-archive') || isAllowed('bakim-planlama') || isAllowed('tickets-page') || isAllowed('workshop') || profile?.role === 'TAMİR' || isAllowed('tsi-library')) ? `
          <div class="nav-section-label">Saha Operasyon Bölümü</div>
        ` : ''}

        ${isAllowed('tasks') ? `
          <li class="nav-item ${state.currentPage === 'tasks' ? 'active' : ''}" onclick="window.navigate('tasks')">
            <i class="fa-solid fa-list-check"></i> İş Emirleri
          </li>
        ` : ''}
        ${isAllowed('new-task') ? `
          <li class="nav-item ${state.currentPage === 'new-task' ? 'active' : ''}" onclick="window.navigate('new-task')">
            <i class="fa-solid fa-plus-circle"></i> Yeni İş Emri
          </li>
        ` : ''}
        ${isAllowed('turbines') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'turbines' ? 'active' : ''}" onclick="window.toggleSubmenuAndNavigate('regions', 'turbines')">
            <i class="fa-solid fa-map-location-dot"></i> Servis Bölgeleri
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'turbines' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="regions-submenu" class="sub-menu ${state.currentPage === 'turbines' ? '' : 'hidden'}">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.selectedSiteId === site.id ? 'active' : ''}" onclick="window.selectSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-charging-station" style="font-size: 0.6rem; opacity: 0.5;"></i> ${site.name}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${isAllowed('warehouses') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'warehouses' ? 'active' : ''}" onclick="window.toggleSubmenuAndNavigate('warehouses', 'warehouses')">
            <i class="fa-solid fa-warehouse"></i> Servis Depoları
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'warehouses' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="warehouses-submenu" class="sub-menu ${state.currentPage === 'warehouses' ? '' : 'hidden'}">
            ${filteredWarehouses.map(wh => `
              <li class="sub-item ${state.selectedWarehouseId === wh.id ? 'active' : ''}" 
                  ondragover="if(window.warehouseSidebarDragOver) window.warehouseSidebarDragOver(event)" 
                  ondragleave="if(window.warehouseSidebarDragLeave) window.warehouseSidebarDragLeave(event)" 
                  ondrop="if(window.warehouseSidebarDrop) window.warehouseSidebarDrop(event, '${wh.id}')"
                  onclick="window.selectWarehouseAndNavigate('${wh.id}')">
                <i class="fa-solid fa-boxes-stacked" style="font-size: 0.6rem; opacity: 0.5;"></i> ${wh.name}
              </li>
            `).join('')}
            ${(profile?.role === 'ADMIN' || isMaterialManager || profile?.team || (profile?.allowedWarehouses || []).some(wId => wId.startsWith('team_'))) ? `
              <li style="padding: 0.5rem 1rem; font-size: 0.75rem; color: #64748B; text-transform: uppercase; font-weight: 700; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 0.5rem;">Ekiplerin Zimmeti</li>
              ${Array.from({length: 15}, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`).map(teamName => {
                const teamId = `team_${teamName.replace(/\s+/g, '_')}`;
                const userTeamCanonical = profile?.team ? formatTeamName(profile.team) : '';
                const isUserOwnTeam = userTeamCanonical === teamName;
                const isAllowed = profile?.role === 'ADMIN' || isMaterialManager || isUserOwnTeam || (profile?.allowedWarehouses || []).includes(teamId);
                if (!isAllowed) return '';
                
                return `
                  <li class="sub-item ${state.selectedWarehouseId === teamId ? 'active' : ''}" 
                      ondragover="if(window.warehouseSidebarDragOver) window.warehouseSidebarDragOver(event)" 
                      ondragleave="if(window.warehouseSidebarDragLeave) window.warehouseSidebarDragLeave(event)" 
                      ondrop="if(window.warehouseSidebarDrop) window.warehouseSidebarDrop(event, '${teamId}')"
                      onclick="window.selectWarehouseAndNavigate('${teamId}')" style="color: ${isUserOwnTeam ? '#14F195' : '#60A5FA'};">
                    <i class="fa-solid ${isUserOwnTeam ? 'fa-truck-ramp-box' : 'fa-truck-moving'}" style="font-size: 0.65rem; opacity: 0.7; margin-right: 4px;"></i> ${teamName} Deposu
                  </li>
                `;
              }).join('')}
            ` : ''}
          </ul>
        ` : ''}
        ${isAllowed('reports-archive') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'reports-archive' ? 'active' : ''}" onclick="window.toggleSubmenuAndNavigate('reports-archive', 'reports-archive')">
            <i class="fa-solid fa-box-archive"></i> Rapor Arşivi
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'reports-archive' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="reports-archive-submenu" class="sub-menu ${state.currentPage === 'reports-archive' ? '' : 'hidden'}">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.selectedReportSiteId === site.id ? 'active' : ''}" onclick="window.selectReportSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-file-pdf" style="font-size: 0.6rem; opacity: 0.5;"></i> Rapor_${(site.name || 'Bilinmeyen').replace('Alize ', '').replace('Anemon ', '')}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${isAllowed('visual-bom') ? `
          <li class="nav-item ${state.currentPage === 'visual-bom' ? 'active' : ''}" onclick="window.navigate('visual-bom')">
            <i class="fa-solid fa-cube"></i> Türbin Dijital İkizi
          </li>
        ` : ''}
        ${isAllowed('bakim-planlama') ? `
          <li class="nav-item ${state.currentPage === 'bakim-planlama' ? 'active' : ''}" onclick="window.navigate('bakim-planlama')">
            <i class="fa-solid fa-calendar-check"></i> Bakım Planlama
          </li>
        ` : ''}
        ${isAllowed('tickets-page') ? `
          <li class="nav-item ${state.currentPage === 'tickets-page' ? 'active' : ''}" onclick="window.navigate('tickets-page')">
            <i class="fa-solid fa-headset" style="color: var(--accent-cyan);"></i> Saha Destek
          </li>
        ` : ''}
        ${isAllowed('workshop') || profile?.role === 'TAMİR' ? `
          <li class="nav-item ${state.currentPage === 'workshop' ? 'active' : ''}" onclick="window.navigate('workshop')">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #14F195;"></i> Merkez Tamir Atölyesi
          </li>
        ` : ''}
        ${isAllowed('tsi-library') ? `
          <li class="nav-item ${state.currentPage === 'tsi-library' ? 'active' : ''}" onclick="window.navigate('tsi-library')">
            <i class="fa-solid fa-book-bookmark" style="color: var(--accent-cyan);"></i> Servis Teknik Information
          </li>
        ` : ''}

        ${(isAllowed('siparis') || isAllowed('transfers') || isAllowed('asset-custody') || profile?.role === 'ADMIN' || isAllowed('material-analytics') || isAllowed('repair-history') || isAllowed('workshop-stock') || isAllowed('global-history') || isMaterialManager || (isAllowed('warehouses') && profile?.role !== 'TECHNICIAN') || isAllowed('image-pool')) ? `
          <div class="nav-section-label">Depo Yönetimi</div>
        ` : ''}

        ${isAllowed('siparis') ? `
          <li class="nav-item ${state.currentPage === 'siparis' ? 'active' : ''}" onclick="window.navigate('siparis')">
            <i class="fa-solid fa-cart-plus"></i> Sipariş Oluştur
          </li>
        ` : ''}
        ${isAllowed('transfers') ? `
          <li class="nav-item ${state.currentPage === 'transfers' ? 'active' : ''}" onclick="window.navigate('transfers')">
            <i class="fa-solid fa-truck-ramp-box"></i> Malzeme Transferi
          </li>
        ` : ''}
        ${isAllowed('asset-custody') ? `
          <li class="nav-item ${state.currentPage === 'asset-custody' ? 'active' : ''}" onclick="window.navigate('asset-custody')">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #f59e0b;"></i> Malzeme Zimmeti
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('material-analytics')) ? `
          <li class="nav-item ${state.currentPage === 'material-analytics' ? 'active' : ''}" onclick="window.navigate('material-analytics')">
            <i class="fa-solid fa-cart-shopping"></i> Malzeme Analizi
          </li>
        ` : ''}
        ${isAllowed('repair-history') ? `
          <li class="nav-item ${state.currentPage === 'repair-history' ? 'active' : ''}" onclick="window.navigate('repair-history')">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #14F195;"></i> Tamir Hareketleri
          </li>
        ` : ''}
        ${isAllowed('workshop-stock') ? `
          <li class="nav-item ${state.currentPage === 'workshop-stock' ? 'active' : ''}" onclick="window.navigate('workshop-stock')">
            <i class="fa-solid fa-warehouse" style="color: #3B82F6;"></i> Atölye Tamir Stoğu
          </li>
        ` : ''}
        ${isAllowed('global-history') ? `
          <li class="nav-item ${state.currentPage === 'global-history' ? 'active' : ''}" onclick="window.navigate('global-history')">
            <i class="fa-solid fa-clock-rotate-left"></i> Depo Hareketleri
          </li>
        ` : ''}
        ${((isMaterialManager || profile?.role === 'ADMIN' || isAllowed('warehouses')) && profile?.role !== 'TECHNICIAN') ? `
          <li class="nav-item ${state.currentPage === 'warehouses' ? 'active' : ''}" onclick="window.navigate('warehouses')">
            <i class="fa-solid fa-warehouse"></i> Depo İzleme
          </li>
        ` : ''}
        ${isAllowed('image-pool') ? `
          <li class="nav-item ${state.currentPage === 'image-pool' ? 'active' : ''}" onclick="window.navigate('image-pool')">
            <i class="fa-solid fa-images" style="color: #0ea5e9;"></i> Resim Havuzu
          </li>
        ` : ''}

        ${(isAllowed('analytics') || isAllowed('templates') || profile?.role === 'ADMIN' || isAllowed('purchase-requests') || isAllowed('users') || isAllowed('personnel-management')) ? `
          <div class="nav-section-label">Yönetim</div>
        ` : ''}

        ${isAllowed('analytics') ? `
          <li class="nav-item ${state.currentPage === 'analytics' ? 'active' : ''}" onclick="window.navigate('analytics')">
            <i class="fa-solid fa-brain"></i> Adam Saat Analizi
          </li>
        ` : ''}
        ${isAllowed('templates') ? `
          <li class="nav-item ${state.currentPage === 'templates' ? 'active' : ''}" onclick="window.navigate('templates')">
            <i class="fa-solid fa-file-invoice"></i> Arıza & Bakım Şablonları
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('purchase-requests')) ? `
          <li class="nav-item ${state.currentPage === 'purchase-requests' ? 'active' : ''}" onclick="window.navigate('purchase-requests')">
            <i class="fa-solid fa-file-invoice-dollar" style="color: #fbbf24;"></i> Satın Alma Yönetimi
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN') ? `
          <li class="nav-item ${state.currentPage === 'overtime-approvals' ? 'active' : ''}" onclick="window.navigate('overtime-approvals')">
            <i class="fa-solid fa-file-signature" style="color: var(--accent-cyan);"></i> Mesai & Sodexo Onayları
          </li>
          <li class="nav-item ${state.currentPage === 'online-users' ? 'active' : ''}" onclick="window.navigate('online-users')">
            <i class="fa-solid fa-users-viewfinder" style="color: #14F195;"></i> Aktif Kullanıcılar
          </li>
          
          <!-- 🟨 PERİYODİK KONTROLLER SUBMENU -->
          <li class="nav-item has-submenu ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? 'active' : ''}" onclick="window.toggleSubmenu('periodic-controls')" style="color: #fbbf24; font-weight: 700;">
            <i class="fa-solid fa-clock-rotate-left" style="color: #fbbf24;"></i> Periyodik Kontroller
            <i class="fa-solid fa-chevron-down submenu-arrow ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? 'rotate-180' : ''}" style="color: #fbbf24; margin-left: auto;"></i>
          </li>
          <ul id="periodic-controls-submenu" class="sub-menu ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? '' : 'hidden'}">
            <li class="sub-item ${state.currentPage === 'kkd-kontrol' ? 'active' : ''}" onclick="window.navigate('kkd-kontrol')">
              <i class="fa-solid fa-helmet-safety" style="font-size: 0.65rem; opacity: 0.7;"></i> KKD Kontrolü
            </li>
            <li class="sub-item ${state.currentPage === 'olcu-aletleri' ? 'active' : ''}" onclick="window.navigate('olcu-aletleri')">
              <i class="fa-solid fa-gauge" style="font-size: 0.65rem; opacity: 0.7;"></i> Ölçü Aletleri Kalibrasyon
            </li>
            <li class="sub-item ${state.currentPage === 'tork-aletleri' ? 'active' : ''}" onclick="window.navigate('tork-aletleri')">
              <i class="fa-solid fa-wrench" style="font-size: 0.65rem; opacity: 0.7;"></i> Tork Aletleri Kalibrasyon
            </li>
          </ul>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('users')) ? `
          <li class="nav-item ${state.currentPage === 'users' ? 'active' : ''}" onclick="window.navigate('users')">
            <i class="fa-solid fa-user-gear"></i> Kullanıcı Yetki
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('personnel-management')) ? `
          <li class="nav-item ${state.currentPage === 'personnel-management' ? 'active' : ''}" onclick="window.navigate('personnel-management')">
            <i class="fa-solid fa-people-group"></i> Personel & Şirket Yetki
          </li>
        ` : ''}

        ${(isAllowed('bearing-analysis') || profile?.role === 'ADMIN') ? `
          <div class="nav-section-label">AJANLAR</div>
        ` : ''}

        ${isAllowed('bearing-analysis') ? `
          <li class="nav-item ${state.currentPage === 'bearing-analysis' ? 'active' : ''}" onclick="window.navigate('bearing-analysis')">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan);"></i> Rulman Analiz Ajanı
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN') ? `
          <li class="nav-item ${state.currentPage === 'predictive-agent' ? 'active' : ''}" onclick="window.navigate('predictive-agent')">
            <i class="fa-solid fa-radar" style="color: var(--accent-red);"></i> Önleyici Bakım Ajanı
          </li>
          <li class="nav-item ${state.currentPage === 'code-advisor-agent' ? 'active' : ''}" onclick="window.navigate('code-advisor-agent')">
            <i class="fa-solid fa-code" style="color: #14f195;"></i> AI Kod Danışmanı
          </li>
        ` : ''}
      </nav>

      <div class="sidebar-footer" style="padding: 1rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
        <div id="connectivity-badge" class="connection-status ${navigator.onLine ? 'online' : 'offline'}" style="margin-bottom: 1rem; cursor: pointer;" onclick="window.manualSync()" title="Manuel Senkronizasyon">
          <div class="status-dot"></div>
          <span style="display: flex; align-items: center;">
            <svg class="ekg-svg" viewBox="0 0 60 20">
              <path class="ekg-line ${navigator.onLine ? 'ekg-online' : 'ekg-offline'}" 
                    d="${navigator.onLine ? 'M0 10 L15 10 L20 2 L25 18 L30 10 L60 10' : 'M0 10 L60 10'}"></path>
            </svg>
          </span>
          <i class="fa-solid fa-rotate" id="sync-icon" style="margin-left: auto; font-size: 0.6rem; opacity: 0.5;"></i>
        </div>

        <div class="nav-item logout-btn" onclick="window.logout()" style="color: var(--accent-red); margin-bottom: 1rem; border-left: none; padding: 0.5rem;">
          <i class="fa-solid fa-power-off"></i> Çıkış Yap
        </div>
        
        <div class="user-badge" style="display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div class="user-avatar" style="width: 32px; height: 32px; font-size: 0.8rem;">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div style="text-align: left;">
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.8rem; color: var(--text-main); line-height: 1.2;">
              ${formatDisplayName(state.userProfile?.displayName || profile?.email || '') || 'YÜKLENİYOR...'}
              <span id="session-count-badge"></span>
            </div>
            ${state.userProfile?.managedTeams && state.userProfile.managedTeams.length > 0 ? `<div style="font-size: 0.55rem; color: #f97316; font-weight: 800; letter-spacing: 1px; margin-top: 2px;">EKİP LİDERİ</div>` : ''}
            <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; ${state.userProfile?.role === 'TECHNICIAN' ? '' : 'text-transform: uppercase;'}">
              ${state.userProfile?.role === 'TECHNICIAN' ? 'technician' : (state.userProfile?.role || '...')}
            </div>
          </div>
        </div>
      </div>
    </aside>
  `
}

const Topbar = () => {
  const isLight = document.body.classList.contains('light-mode');
  return `
    <header class="topbar">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="menu-toggle" onclick="window.toggleSidebar()">
          <i class="fa-solid fa-bars"></i>
        </button>

      </div>
      
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button id="topbar-ticket-bell" onclick="window.navigate('tickets-page')" class="btn-cyber-outline" style="width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1rem; border-color: rgba(255,255,255,0.1); position: relative;">
          <i class="fa-solid fa-bell"></i>
        </button>
        <button onclick="window.toggleTheme()" class="btn-cyber-outline" style="width: 38px; height: 38px; padding: 0; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-size: 1rem; border-color: rgba(255,255,255,0.1);">
          <i class="fa-solid ${isLight ? 'fa-moon' : 'fa-sun'}" style="color: ${isLight ? '#94a3b8' : '#ff9900'}"></i>
        </button>
      </div>
    </header>
  `
}

const render = async (options: { skipShell?: boolean } = {}) => {
  const app = document.querySelector<HTMLDivElement>('#app');
  if (!app) return;

  // Check if we need to show the maintenance screen
  if (localStorage.getItem('show_maintenance_reason')) {
    app.innerHTML = `
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 100vh; background: #0b0e17; color: white; font-family: 'Rajdhani', sans-serif; text-align: center; padding: 2rem;">
        <div class="glass-panel" style="max-width: 500px; padding: 3.5rem 2.5rem; border: 1px solid rgba(0, 243, 255, 0.25); box-shadow: 0 0 35px rgba(0, 243, 255, 0.15); border-radius: 20px; background: rgba(13, 18, 30, 0.85); backdrop-filter: blur(15px); position: relative; overflow: hidden;">
          <!-- Glowing background circles -->
          <div style="position: absolute; top: -10%; left: -10%; width: 120px; height: 120px; background: rgba(0, 243, 255, 0.1); filter: blur(50px); border-radius: 50%;"></div>
          <div style="position: absolute; bottom: -10%; right: -10%; width: 120px; height: 120px; background: rgba(0, 255, 170, 0.08); filter: blur(50px); border-radius: 50%;"></div>
          
          <div style="font-size: 5rem; color: #00f3ff; margin-bottom: 2rem; filter: drop-shadow(0 0 15px rgba(0, 243, 255, 0.4));">
            <i class="fa-solid fa-screwdriver-wrench fa-bounce"></i>
          </div>
          <h2 style="font-size: 2.2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 3px; margin: 0 0 1.25rem 0; background: linear-gradient(90deg, #00f3ff, #00ffaa); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: 'Rajdhani', sans-serif;">
            Sistem Güncellemesi
          </h2>
          <p style="font-size: 1.05rem; color: #a0aec0; line-height: 1.6; margin: 0 0 2rem 0; font-family: 'Inter', sans-serif;">
            Hesabınız üzerinde bakım ve güncelleme çalışmaları yapılmaktadır. Bu süreçte sisteme erişiminiz geçici olarak askıya alınmıştır.
          </p>
          <div style="font-size: 0.85rem; color: rgba(255,255,255,0.4); padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); font-family: 'Inter', sans-serif;">
            Lütfen sistem yöneticisiyle iletişime geçin.
          </div>
          <button class="btn-cyber" style="margin-top: 1.75rem; padding: 10px 28px; font-size: 0.85rem; letter-spacing: 1px;" onclick="localStorage.removeItem('show_maintenance_reason'); window.location.reload();">
            <i class="fa-solid fa-rotate-right" style="margin-right: 6px;"></i> TEKRAR GİRİŞ YAP
          </button>
        </div>
      </div>
    `;
    return;
  }

  // Intercept public KKD query from QR code scans on-site
  const urlParams = new URLSearchParams(window.location.search);
  const pageParam = urlParams.get('page');
  const snParam = urlParams.get('sn');

  if (pageParam === 'kkd-sorgu' && snParam) {
    try {
      const { renderKkdPublicQueryPage } = await import('./pages/KkdSorgu');
      app.innerHTML = await renderKkdPublicQueryPage(snParam);
    } catch (err) {
      console.error("Failed to render public KKD query page:", err);
      app.innerHTML = `<div style="color:red; padding:2rem; font-family:sans-serif;">Muayene sorgu sayfası yüklenirken hata oluştu.</div>`;
    }
    return;
  }

  // If auth is not ready (e.g. background anonymous sign-in pending), show loading screen
  if (!authService.isAuthReady()) {
    app.innerHTML = `
      <div style="height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: #050a10; color: #00f3ff; font-family: 'Inter', sans-serif;">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; margin-bottom: 1.5rem; text-shadow: 0 0 10px #00f3ff;"></i>
        <div style="font-size: 0.9rem; letter-spacing: 2px; text-transform: uppercase; font-weight: 500;">Bağlantı Kuruluyor...</div>
      </div>
    `;
    return;
  }

  // Trigger Service Worker update check on render
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistration().then(reg => {
      if (reg) {
        reg.update().catch(err => console.debug("SW update check skipped:", err));
      }
    }).catch(() => {});
  }

  const user = authService.getCurrentUser();
  if (!user) {
    const { LoginPage } = await import('./pages/Login');
    app.innerHTML = LoginPage();
    // Re-bind login logic
    const form = document.getElementById('login-form');
    if (form) {
      form.removeEventListener('submit', (window as any).handleLogin);
      form.addEventListener('submit', (window as any).handleLogin);
    }
    return;
  }

  // --- PROFILE LOADING (DIRECT FIRESTORE NO CACHE) ---
  if (!state.userProfile || state.userProfile.uid !== user.uid) {
    try {
      const profile = await userService.getProfile(user.uid);
      if (profile) {
        // Block inactive users (except ADMINs to prevent lockout)
        if (profile.isActive === false && profile.role?.toUpperCase() !== 'ADMIN') {
          console.warn("[Auth] Inactive user detected, logging out & showing maintenance page.");
          localStorage.setItem('show_maintenance_reason', 'true');
          state.userProfile = null;
          authService.logout().catch(console.error);
          return;
        }

        // Auto-detect and set team if missing
        if (!profile.team) {
          const autoTeam = formatTeamName(profile.displayName || profile.email || '');
          if (autoTeam && autoTeam.startsWith('Team')) {
            profile.team = autoTeam;
            await userService.saveProfile(profile);
            console.log(`[Auth] Auto-detected and saved team: ${autoTeam} for user ${profile.displayName}`);
          }
        }

        state.userProfile = profile;

        // Run silent self-healing database audit for admins
        if (profile.role === 'ADMIN' || profile.role === 'MALZEME_YONETIMI' || profile.email?.toLowerCase() === 'hursit.akter@demirerholding.com') {
          import('./agents/WarehouseAgent').then(({ warehouseAgent }) => {
            warehouseAgent.runSelfHealingAudit().catch(err => console.error("[Self-Healing] Error:", err));
          }).catch(err => console.error("[Self-Healing] Import failed:", err));
        }
      } else {
        console.warn("No user profile found, auto-creating default technician profile...");
        const autoTeam = formatTeamName(user.displayName || user.email || '');
        const defaultProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
          role: 'TECHNICIAN',
          team: autoTeam.startsWith('Team') ? autoTeam : '',
          allowedTabs: {
            dashboard: true,
            tasks: { access: true, createTask: false, deleteTask: false, completeTask: true, transferTask: false },
            'bearing-analysis': true
          },
          allowedSites: [],
          allowedWarehouses: []
        };
        await userService.saveProfile(defaultProfile);
        state.userProfile = defaultProfile;
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }

  if (state.userProfile) {
    // Expand "all" permissions so that all subpages and checks work seamlessly
    if (state.userProfile.allowedSites?.includes('all')) {
      state.userProfile.allowedSites = dataService.getAllSites().map(s => s.id);
    }
    if (state.userProfile.allowedWarehouses?.includes('all')) {
      state.userProfile.allowedWarehouses = dataService.getWarehouses().map(w => w.id);
    }

    (window as any).currentUser = state.userProfile;
    (window as any).currentUserTeam = state.userProfile.team || formatTeamName(state.userProfile.displayName || user.email || '');
    
    // Redirect Material Manager to Material Analytics instead of Dashboard
    const isMaterialManager = state.userProfile.role === 'MALZEME_YONETIMI' || state.userProfile.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
    if (isMaterialManager && state.currentPage === 'dashboard') {
      state.currentPage = 'material-analytics';
    }

    // Redirect TAMİR to workshop instead of Dashboard
    const isTamirRole = state.userProfile.role === 'TAMİR';
    if (isTamirRole && state.currentPage === 'dashboard') {
      state.currentPage = 'workshop';
    }

    // --- GLOBAL TICKET NOTIFICATION LISTENER ---
    if (!(window as any)._globalTicketUnsubscribe) {
      const isAdmin = state.userProfile.role?.toUpperCase() === 'ADMIN';
      import('./services/TicketService').then(({ ticketService }) => {
        (window as any)._globalTicketUnsubscribe = ticketService.subscribeToTickets(isAdmin, state.userProfile!.uid, (tickets) => {
          const unreadCount = tickets.filter(t => isAdmin ? t.unreadAdmin : t.unreadUser).length;
          const bell = document.getElementById('topbar-ticket-bell');
          if (bell) {
            if (unreadCount > 0) {
              bell.innerHTML = `<i class="fa-solid fa-bell fa-shake" style="color: #f59e0b;"></i><span class="notification-dot" style="position:absolute; top:-5px; right:-5px; background:red; color:white; border-radius:50%; width:18px; height:18px; font-size:10px; display:flex; align-items:center; justify-content:center; font-weight:bold;">${unreadCount}</span>`;
            } else {
              bell.innerHTML = `<i class="fa-solid fa-bell"></i>`;
            }
          }
        });
      });
    }

    // --- GLOBAL SESSION LISTENER (ADMIN ONLY) ---
    if (!(window as any)._globalSessionUnsubscribe && state.userProfile.role?.toUpperCase() === 'ADMIN') {
       import('./services/PresenceService').then(({ presenceService }) => {
          (window as any)._globalSessionUnsubscribe = presenceService.subscribeToUserSessions(state.userProfile!.uid, (sessions) => {
             const count = sessions.length;
             const badge = document.getElementById('session-count-badge');
             if (badge) {
                if (count > 1) {
                   badge.innerHTML = `<span style="color: var(--accent-red); font-size: 0.65rem; font-weight: bold; margin-left: 4px;">(${count} Cihaz)</span>`;
                } else {
                   badge.innerHTML = ``;
                }
             }
          });
       });
    }
  }

  
  try {
    const hasShell = !!document.querySelector('.app-container');
    const pageContent = document.getElementById('page-content');
    
    // Only show loader if it takes more than 200ms
    let loaderTimeout: any;
    
    if (!hasShell) {
      const sidebarHtml = Sidebar();
      const topbarHtml = Topbar();
      app.innerHTML = `
        <div class="app-container">
          ${sidebarHtml}
          <main class="main-content">
            ${topbarHtml}
            <div id="page-content">
               <div id="page-inner-content"></div>
            </div>
          </main>
        </div>
        
        <!-- GLOBAL MODALS (Persistent) -->
        <div id="turbine-modal-root"></div>
        <div id="resolve-deficiency-modal-root"></div>
      `;
      
      // Inject modal HTML only once if not already there
      const modal = document.getElementById('turbine-modal');
      if (modal) {
        modal.classList.add('hidden');
        modal.style.display = 'none';
      }
      const modalRoot = document.getElementById('turbine-modal-root');
      if (modalRoot && !modalRoot.innerHTML) {
        modalRoot.innerHTML = TurbineDetailModal();
      }
    } else {
      // Shell already exists, just update sidebar active class and submenus dynamically
      // to prevent sidebar scroll resetting to top on navigation.
      const updateSidebarActiveState = () => {
        document.querySelectorAll('.sidebar .nav-item, .sidebar .sub-item').forEach(el => {
          el.classList.remove('active');
        });

        // 1. Top-level nav item active classes
        const currentNav = document.querySelector(`.sidebar .nav-item[onclick*="navigate('${state.currentPage}')"]`);
        if (currentNav) {
          currentNav.classList.add('active');
        }

        // 2. Submenu items active classes
        if (state.currentPage === 'turbines' && state.selectedSiteId) {
          const subItem = document.getElementById('regions-submenu')?.querySelector(`.sub-item[onclick*="selectSiteAndNavigate('${state.selectedSiteId}')"]`);
          if (subItem) subItem.classList.add('active');
        }
        if (state.currentPage === 'warehouses' && state.selectedWarehouseId) {
          const subItem = document.getElementById('warehouses-submenu')?.querySelector(`.sub-item[onclick*="selectWarehouseAndNavigate('${state.selectedWarehouseId}')"]`);
          if (subItem) subItem.classList.add('active');
        }

        // 3. Submenus visibility
        const regionsSub = document.getElementById('regions-submenu');
        const regionsArrow = document.querySelector('.nav-item[onclick*="regions"]')?.querySelector('.submenu-arrow');
        if (regionsSub) {
          if (state.currentPage === 'turbines') {
            regionsSub.classList.remove('hidden');
            if (regionsArrow) regionsArrow.classList.add('rotate-180');
          } else {
            regionsSub.classList.add('hidden');
            if (regionsArrow) regionsArrow.classList.remove('rotate-180');
          }
        }

        const warehousesSub = document.getElementById('warehouses-submenu');
        const warehousesArrow = document.querySelector('.nav-item[onclick*="warehouses"]')?.querySelector('.submenu-arrow');
        if (warehousesSub) {
          if (state.currentPage === 'warehouses') {
            warehousesSub.classList.remove('hidden');
            if (warehousesArrow) warehousesArrow.classList.add('rotate-180');
          } else {
            warehousesSub.classList.add('hidden');
            if (warehousesArrow) warehousesArrow.classList.remove('rotate-180');
          }
        }
      };
      
      try {
        updateSidebarActiveState();
      } catch (err) {
        console.error("Failed to update sidebar active state dynamically", err);
      }
    }

    const targetContent = document.getElementById('page-inner-content') || document.getElementById('page-content');
    if (!targetContent) return;

    // Start loader timer
    loaderTimeout = setTimeout(() => {
      if (!targetContent.innerHTML || targetContent.innerHTML.length < 100) {
        targetContent.innerHTML = `
          <div class="loading-full-overlay" style="position: relative; height: 300px;">
            <div class="loader-cyber"></div>
            <div style="margin-top: 1rem; font-family: 'Rajdhani'; letter-spacing: 2px; color: var(--accent-cyan);">VERİLER SENKRONİZE EDİLİYOR...</div>
          </div>
        `;
      }
    }, 200);

    // Cleanup before route change
    if ((window as any)._currentUnsubscribe) {
      (window as any)._currentUnsubscribe();
      (window as any)._currentUnsubscribe = null;
    }
    import('./pages/TsiLibrary').then(m => m.destroyTsiLibrary?.()).catch(() => {});

    (window as any).currentWarehouseTab = state.warehouseTab;
    const content = await getContent();
    clearTimeout(loaderTimeout);
    targetContent.innerHTML = content;

    // Removing the setTimeout for switchTab since we now handle it at render time
    // --- PAGE SPECIFIC INITIALIZATION ---
    if (state.currentPage === 'tsi-library') {
      import('./pages/TsiLibrary').then(m => m.initTsiLibrary?.()).catch(e => console.error(e));
    }
    if (state.currentPage === 'code-advisor-agent') {
      setTimeout(() => {
        if ((window as any).initCodeAdvisorPage) {
          (window as any).initCodeAdvisorPage();
        }
      }, 50);
    }
    if (state.currentPage === 'form-ariza' || state.currentPage === 'form-template-edit') (window as any).initFaultFormLogic?.();
    if (state.currentPage === 'new-task') {
      const form = document.getElementById('wizard-form');
      if (form) form.addEventListener('submit', (window as any).handleWizardSubmit);
    }
    if (state.currentPage === 'transfers') (window as any).initTransferLogic?.();
    if (state.currentPage === 'warehouses' && state.selectedWarehouseId) {
      if ((window as any).initNewWarehouseLogic) {
        (window as any).initNewWarehouseLogic();
      } else {
        (window as any).initWarehouseLogic?.();
      }
    }
    if (state.currentPage === 'bakim-planlama') (window as any).initMaintenancePlanning?.();
    if (state.currentPage === 'turbines') {
      setTimeout(() => {
        (window as any).initSitesMap?.();
      }, 50);
    }
    if (state.currentPage === 'global-history') (window as any).renderGlobalHistoryMain?.();
    // Initial sync if online
    if (navigator.onLine && (window as any).syncOfflineReports) {
      setTimeout(() => {
        (window as any).syncOfflineReports();
      }, 3000);
    }

  } catch (e) {
    console.error("Critical Render Error:", e);
    const errMsg = e instanceof Error ? e.message : String(e);
    const isImportError = errMsg.toLowerCase().includes('failed to fetch dynamically imported module') || 
                          errMsg.toLowerCase().includes('dynamically imported module') ||
                          errMsg.toLowerCase().includes('importing a module');
    if (isImportError) {
      console.warn("Dynamic import failed (likely due to a new deployment). Attempting auto-reload...");
      const now = Date.now();
      const lastReload = Number(sessionStorage.getItem('last_auto_reload') || '0');
      if (now - lastReload > 10000) { // 10 seconds threshold
        sessionStorage.setItem('last_auto_reload', String(now));
        window.location.reload();
        return;
      } else {
        console.error("Auto-reload loop detected. Showing error page instead.");
      }
    }
    const target = document.getElementById('page-content') || app;
    target.innerHTML = `
      <div class="glass-panel" style="margin: 2rem; padding: 2rem; border: 1px solid var(--accent-red);">
        <h3 style="color: var(--accent-red); margin-bottom: 1rem;"><i class="fa-solid fa-triangle-exclamation"></i> SİSTEM HATASI</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 1.5rem;">Uygulama yüklenirken bir hata oluştu. Lütfen yetkilerinizi kontrol edin veya sayfayı yenileyin.</p>
        <button class="btn-cyber" onclick="window.location.reload()">SAYFAYI YENİLE</button>
        <pre style="margin-top: 1.5rem; padding: 1rem; background: rgba(0,0,0,0.3); border-radius: 8px; font-size: 0.7rem; color: #ff6b6b; overflow-x: auto;">${e instanceof Error ? e.message : 'Bilinmeyen Hata'}</pre>
      </div>
    `;
  } finally {
    const loader = document.querySelector('.loading-full-overlay');
    if (loader) loader.remove();
  }
}

const getContent = async () => {
  switch (state.currentPage) {
    case 'dashboard': {
      const { DashboardPage } = await import('./pages/Dashboard');
      return await DashboardPage();
    }
    case 'new-task': {
      const { NewTaskForm } = await import('./components/FormWizard');
      return await NewTaskForm();
    }
    case 'form-ariza': {
      const { FaultFormPage } = await import('./pages/FaultForm');
      return FaultFormPage(state.activeTask);
    }
    case 'form-template-edit': {
      const { FaultFormPage } = await import('./pages/FaultForm');
      return FaultFormPage({ id: 'TEMPLATE_MODE', secilenSablon: state.selectedTemplate || 'ŞABLON DÜZENLE' } as any);
    }
    case 'task-create': {
      const { TaskCreationForm } = await import('./pages/TaskCreation');
      return await TaskCreationForm(state.selectedTemplate || 'Arıza Formu');
    }
    case 'inventory': {
      const { InventoryPage } = await import('./pages/Inventory');
      return InventoryPage();
    }
    case 'visual-bom': {
      const { VisualBOMPage } = await import('./pages/VisualBOM');
      return await VisualBOMPage();
    }
    case 'purchase-requests': {
      const { PurchaseRequestsPage } = await import('./pages/PurchaseRequests');
      return await PurchaseRequestsPage();
    }
    case 'turbines': {
      const { TurbinesPage } = await import('./pages/Turbines');
      return TurbinesPage();
    }
    case 'teams': {
      const { TeamsPage } = await import('./pages/Teams');
      return TeamsPage();
    }
    case 'tasks': {
      const { TasksPage } = await import('./pages/Tasks');
      return await TasksPage();
    }
    case 'users': {
      const { UserManagementPage } = await import('./pages/UserManagement');
      return await UserManagementPage();
    }
    case 'personnel-management': {
      const { PersonnelManagementPage } = await import('./pages/PersonnelManagement');
      return await PersonnelManagementPage();
    }
    case 'warehouses': {
      const { NewWarehousePage } = await import('./pages/NewWarehouses');
      return await NewWarehousePage(state.selectedWarehouseId);
    }
    case 'workshop': {
      const { WorkshopDashboardPage } = await import('./pages/WorkshopDashboard');
      return await WorkshopDashboardPage();
    }
    case 'transfers': {
      const { TransferPage } = await import('./pages/Transfers');
      return await TransferPage(state.userProfile);
    }
    case 'templates': {
      const { TemplatesPage } = await import('./pages/Templates');
      return await TemplatesPage();
    }
    case 'analytics': {
      const { AnalyticsPage } = await import('./pages/Analytics');
      return await AnalyticsPage();
    }
    case 'reports-archive': {
      const { ReportArchivePage } = await import('./pages/ReportArchive');
      return await ReportArchivePage(state.selectedReportSiteId);
    }
    case 'global-history': {
      const { GlobalWarehouseHistoryPage } = await import('./pages/GlobalWarehouseHistory');
      return await GlobalWarehouseHistoryPage();
    }
    case 'repair-history': {
      const { RepairHistoryPage } = await import('./pages/RepairHistory');
      return await RepairHistoryPage();
    }
    case 'workshop-stock': {
      const { WorkshopStockPage } = await import('./pages/WorkshopStock');
      return await WorkshopStockPage();
    }
    case 'MALZEME_YONETIMI': {
      const { MaterialManagementPage } = await import('./pages/MaterialManagement');
      return await MaterialManagementPage(state.userProfile);
    }
    case 'material-analytics': {
      const { MaterialAnalyticsPage } = await import('./pages/MaterialAnalytics');
      return await MaterialAnalyticsPage();
    }
    case 'online-users': {
      const { OnlineUsersPage } = await import('./pages/OnlineUsers');
      setTimeout(() => {
         if ((window as any).initOnlineUsersPage) {
            (window as any).initOnlineUsersPage();
         }
      }, 50);
      return await OnlineUsersPage();
    }
    case 'kkd-kontrol': {
      const { KkdControlPage } = await import('./pages/KkdControl');
      setTimeout(() => {
         if ((window as any).initKkdControlPage) {
            (window as any).initKkdControlPage();
         }
      }, 50);
      return await KkdControlPage();
    }
    case 'overtime-approvals': {
      const { OvertimeApprovalsPage } = await import('./pages/OvertimeApprovals');
      return await OvertimeApprovalsPage();
    }
    case 'olcu-aletleri': {
      const { DeviceCalibrationPage } = await import('./pages/DeviceCalibration');
      setTimeout(() => {
         if ((window as any).initDeviceCalibrationPage) {
            (window as any).initDeviceCalibrationPage('OLCU');
         }
      }, 50);
      return await DeviceCalibrationPage('OLCU');
    }
    case 'tork-aletleri': {
      const { DeviceCalibrationPage } = await import('./pages/DeviceCalibration');
      setTimeout(() => {
         if ((window as any).initDeviceCalibrationPage) {
            (window as any).initDeviceCalibrationPage('TORK');
         }
      }, 50);
      return await DeviceCalibrationPage('TORK');
    }
    case 'siparis': {
      const { SiparisPage } = await import('./pages/Siparis');
      return await SiparisPage(state.userProfile);
    }
    case 'bakim-planlama': {
      const { MaintenancePlanningPage } = await import('./pages/MaintenancePlanning');
      return await MaintenancePlanningPage();
    }
    case 'bearing-analysis': {
      const { BearingAnalysisPage } = await import('./pages/BearingAnalysis');
      return await BearingAnalysisPage();
    }
    case 'predictive-agent': {
      const { PredictiveAgentPage } = await import('./pages/PredictiveAgent');
      return PredictiveAgentPage();
    }
    case 'code-advisor-agent': {
      const { CodeAdvisorAgentPage } = await import('./pages/CodeAdvisorAgent');
      return await CodeAdvisorAgentPage();
    }
    case 'tsi-library': {
      const { TsiLibraryPage } = await import('./pages/TsiLibrary');
      return await TsiLibraryPage();
    }
    case 'asset-custody': {
      const { AssetCustodyPage } = await import('./pages/AssetCustody');
      return await AssetCustodyPage();
    }
    case 'tickets-page': {
      const { TicketsPage } = await import('./pages/Tickets');
      return await TicketsPage();
    }
    case 'image-pool': {
      const { ImagePoolPage } = await import('./pages/ImagePool');
      return await ImagePoolPage();
    }
    default: return `<h2>Sayfa Bulunamadı</h2>`
  }
}

(window as any).updateWarehouseUI = (warehouseId?: string, sortKey?: string, sortDir?: 'asc' | 'desc', search?: string, tab?: 'inventory' | 'history') => {
  if (warehouseId !== undefined) state.selectedWarehouseId = warehouseId;
  if (sortKey !== undefined) state.inventorySortKey = sortKey;
  if (sortDir !== undefined) state.inventorySortDirection = sortDir;
  if (search !== undefined) state.inventorySearchQuery = search;
  if (tab !== undefined) state.warehouseTab = tab;
  render({ skipShell: true });
};

(window as any).toggleSidebar = () => {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.toggle('mobile-active');
};

(window as any).showToast = (title: string, message: string, type: 'success' | 'error' | 'info' = 'info') => {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'fa-circle-check' : type === 'error' ? 'fa-triangle-exclamation' : 'fa-circle-info';
  
  toast.innerHTML = `
    <i class="fa-solid ${icon} toast-icon"></i>
    <div class="toast-content">
      <div class="toast-title">${title.toUpperCase()}</div>
      <div class="toast-message">${message}</div>
    </div>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

(window as any).navigate = (page: string, param?: any) => {
  if ((window as any)._draftAuditUnsubscribe) {
    try {
      (window as any)._draftAuditUnsubscribe();
    } catch (e) {
      console.error("Failed to unsubscribe draft audit:", e);
    }
    (window as any)._draftAuditUnsubscribe = null;
  }
  state.currentPage = page as Page;
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-active');

  if (param) {
    if (page === 'warehouses' && typeof param === 'string') {
      state.selectedWarehouseId = param;
    } else if (typeof param === 'string') {
      state.selectedTemplate = param;
      if (page === 'form-template-edit') {
        localStorage.setItem('currentEditingTemplateId', param);
      }

    } else {
      state.activeTask = param;
      localStorage.removeItem('currentEditingTemplateId'); // Ensure clean state if it's a real task
    }
  } else {
    state.activeTask = undefined;
    state.selectedWarehouseId = undefined;
    state.warehouseTab = 'inventory';
  }
  state.selectedSiteId = undefined;
  render();
};

(window as any).logout = async () => {
  state.userProfile = null;
  await authService.logout();
  window.location.reload();
};

(window as any).toggleSubmenu = (id: string) => {
  const el = document.getElementById(`${id}-submenu`);
  const arrow = el?.previousElementSibling?.querySelector('.submenu-arrow');
  if (el) {
    el.classList.toggle('hidden');
    if (arrow) arrow.classList.toggle('rotate-180');
  }
};

(window as any).toggleSubmenuAndNavigate = (id: string, page: string) => {
  if (state.currentPage !== page) {
    (window as any).navigate(page);
  } else {
    // If we are already on the page but viewing a specific item (e.g. site or warehouse), go back to general list
    if (page === 'warehouses' && state.selectedWarehouseId) {
      (window as any).navigate(page);
    } else if (page === 'turbines' && state.selectedSiteId) {
      (window as any).navigate(page);
    } else if (page === 'reports-archive' && state.selectedReportSiteId !== 'TÜMÜ') {
      state.selectedReportSiteId = 'TÜMÜ';
      (window as any).navigate(page);
    } else {
      (window as any).toggleSubmenu(id);
    }
  }
};

(window as any).selectWarehouseAndNavigate = (siteId: string | null, tabName?: string) => {
  if ((window as any)._draftAuditUnsubscribe) {
    try {
      (window as any)._draftAuditUnsubscribe();
    } catch (e) {
      console.error("Failed to unsubscribe draft audit:", e);
    }
    (window as any)._draftAuditUnsubscribe = null;
  }
  if (!siteId) {
    state.currentPage = 'warehouses';
    state.selectedWarehouseId = undefined;
    state.warehouseTab = 'inventory';
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.remove('mobile-active');
    render();
    return;
  }
  const isSameWarehouse = state.selectedWarehouseId === siteId;
  state.currentPage = 'warehouses';
  state.selectedWarehouseId = siteId;
  if (tabName) {
    state.warehouseTab = tabName;
  } else if (isSameWarehouse && (window as any).currentWarehouseTab) {
    state.warehouseTab = (window as any).currentWarehouseTab;
  } else {
    state.warehouseTab = 'inventory';
  }
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-active');
  render();
};

(window as any).selectSiteAndNavigate = (siteId: string) => {
  state.currentPage = 'turbines';
  state.selectedSiteId = siteId;
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) sidebar.classList.remove('mobile-active');
  render().then(() => {
    setTimeout(() => {
      if ((window as any).selectSite) (window as any).selectSite(siteId);
    }, 100);
  });
};

(window as any).selectReportSiteAndNavigate = (siteId: string) => {
  state.selectedReportSiteId = siteId;
  state.currentPage = 'reports-archive';
  render();
};

(window as any).render = render;

let agentsStarted = false;

const startSystemAgents = async () => {
  if (agentsStarted) return;
  agentsStarted = true;
  try {
    const [bearing, notification, weather, workOrder] = await Promise.all([
      import('./agents/BearingAgent'),
      import('./agents/NotificationAgent'),
      import('./agents/WeatherAgent'),
      import('./agents/WorkOrderAgent')
    ]);
    // Call start explicitly to make sure they are active
    await Promise.all([
      bearing.bearingAgent.start(),
      notification.notificationAgent.start(),
      weather.weatherAgent.start(),
      workOrder.workOrderAgent.start()
    ]);
    console.log('[System Agents] All system agents started.');
  } catch (err) {
    console.error('[System Agents] Failed to start system agents:', err);
    agentsStarted = false;
  }
};

const stopSystemAgents = async () => {
  if (!agentsStarted) return;
  agentsStarted = false;
  try {
    const [bearing, notification, weather, workOrder] = await Promise.all([
      import('./agents/BearingAgent'),
      import('./agents/NotificationAgent'),
      import('./agents/WeatherAgent'),
      import('./agents/WorkOrderAgent')
    ]);
    bearing.bearingAgent.stop();
    notification.notificationAgent.stop();
    weather.weatherAgent.stop();
    workOrder.workOrderAgent.stop();
    console.log('[System Agents] All system agents stopped.');
  } catch (err) {
    console.error('[System Agents] Failed to stop system agents:', err);
  }
};

// Check on load
if (authService.getCurrentUser() && authService.isAuthReady()) {
  startSystemAgents();
}

window.addEventListener('auth-state-changed', () => {
  const user = authService.getCurrentUser();
  if (user && authService.isAuthReady()) {
    startSystemAgents();
  } else {
    stopSystemAgents();
  }
  render();
});

(window as any).toggleTheme = () => {
  const isLight = document.body.classList.toggle('light-mode');
  localStorage.setItem('theme', isLight ? 'light' : 'dark');
  render({ skipShell: false }); // Re-render shell to update icon
};

// Apply theme on load
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'light') {
  document.body.classList.add('light-mode');
}


// Handle Connectivity Changes
window.addEventListener('online', () => {
  const badge = document.getElementById('connectivity-badge');
  const pageBadge = document.getElementById('offline-status-badge');
  if (badge) {
    badge.className = 'connection-status online';
    badge.innerHTML = '<div class="status-dot"></div><span>ONLINE MOD</span><i class="fa-solid fa-rotate" id="sync-icon" style="margin-left: auto; font-size: 0.6rem; opacity: 0.5;"></i>';
  }
  if (pageBadge) {
    pageBadge.style.background = 'rgba(0, 230, 118, 0.1)';
    pageBadge.style.color = 'var(--accent-green)';
    pageBadge.innerHTML = '<i class="fa-solid fa-wifi" style="margin-right: 4px;"></i>ONLINE MOD';
  }
  (window as any).showToast?.('BAĞLANTI KURULDU', 'Sistem tekrar çevrimiçi modda.', 'success');
  
  if ((window as any).syncOfflineReports) {
    (window as any).syncOfflineReports();
  }
});


window.addEventListener('offline', () => {
  const badge = document.getElementById('connectivity-badge');
  const pageBadge = document.getElementById('offline-status-badge');
  if (badge) {
    badge.className = 'connection-status offline';
    badge.innerHTML = '<div class="status-dot"></div><span>OFFLINE MOD</span><i class="fa-solid fa-rotate" id="sync-icon" style="margin-left: auto; font-size: 0.6rem; opacity: 0.5;"></i>';
  }
  if (pageBadge) {
    pageBadge.style.background = 'rgba(255, 170, 0, 0.1)';
    pageBadge.style.color = 'var(--accent-amber)';
    pageBadge.innerHTML = '<i class="fa-solid fa-plane-slash" style="margin-right: 4px;"></i>OFFLINE MOD';
  }
  (window as any).showToast?.('BAĞLANTI KESİLDİ', 'Sistem çevrimdışı modda çalışıyor.', 'info');
});

(window as any).manualSync = async () => {
  const icon = document.getElementById('sync-icon');
  if (icon) icon.classList.add('fa-spin');
  
  if (!navigator.onLine) {
    (window as any).showToast?.('BAĞLANTI YOK', 'Şu an çevrimdışısınız. İnternet geldiğinde otomatik senkronize edilecek.', 'error');
    setTimeout(() => icon?.classList.remove('fa-spin'), 1000);
    return;
  }

  try {
    // Force a reload of the current view to ensure data is fresh
    (window as any).showToast?.('SENKRONİZASYON', 'Veriler merkezle senkronize ediliyor...', 'info');
    await (window as any).render();
    setTimeout(() => {
      icon?.classList.remove('fa-spin');
      (window as any).showToast?.('BAŞARILI', 'Tüm veriler güncellendi.', 'success');
    }, 800);
  } catch (e) {
    icon?.classList.remove('fa-spin');
  }
};

// --- GLOBAL AUTOCOMPLETE DISABLER (HEPSİ İÇİN GEÇERLİ) ---
const disableAutocompleteGlobally = () => {
  const inputs = document.querySelectorAll('input');
  inputs.forEach(input => {
    input.setAttribute('autocomplete', 'off');
  });
};

// Listen for dynamic DOM mutations
const autocompleteObserver = new MutationObserver(() => {
  disableAutocompleteGlobally();
});
autocompleteObserver.observe(document.documentElement, { childList: true, subtree: true });

// Fallback: intercept focusin events to enforce autocomplete="off" immediately when focused
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT') {
    target.setAttribute('autocomplete', 'off');
  }
});

render();

