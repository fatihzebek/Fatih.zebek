import './style.css'
import { offlineSyncService } from './services/OfflineSyncService';

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

import { NewTaskForm } from './components/FormWizard'
import { InventoryPage } from './pages/Inventory'
import { TurbinesPage } from './pages/Turbines'
import { TeamsPage } from './pages/Teams'
import { LoginPage } from './pages/Login'
import { TasksPage } from './pages/Tasks'
import { ReportArchivePage } from './pages/ReportArchive'
import { UserManagementPage } from './pages/UserManagement'
import { NewWarehousePage } from './pages/NewWarehouses'
import { TransferPage } from './pages/Transfers'
import { TemplatesPage } from './pages/Templates'
import { DashboardPage } from './pages/Dashboard'
import { SiparisPage } from './pages/Siparis'
import { FaultFormPage } from './pages/FaultForm'
import { TaskCreationForm } from './pages/TaskCreation'
import { AnalyticsPage } from './pages/Analytics'
import { GlobalWarehouseHistoryPage } from './pages/GlobalWarehouseHistory'
import { MaterialManagementPage } from './pages/MaterialManagement'
import { AssetCustodyPage } from './pages/AssetCustody'
import { TicketsPage } from './pages/Tickets'
import { MaintenancePlanningPage } from './pages/MaintenancePlanning'
import { BearingAnalysisPage } from './pages/BearingAnalysis'
import { PredictiveAgentPage } from './pages/PredictiveAgent'
import { dataService, DataService } from './services/DataService'
import { authService } from './services/AuthService'
import { taskService } from './services/TaskService'
import { userService } from './services/UserService'
import type { UserProfile } from './services/UserService'
import { formatTeamName } from './utils/formatters'
import { TsiLibraryPage, initTsiLibrary, destroyTsiLibrary } from './pages/TsiLibrary'

// Types
type Page = 'dashboard' | 'tasks' | 'inventory' | 'turbines' | 'teams' | 'new-task' | 'login' | 'warehouses' | 'transfers' | 'users' | 'templates' | 'analytics' |
  'form-ariza' | 'form-gen-ariza' | 'form-rulman-ariza' |
  'form-e44e48-ana' | 'form-e44e48-yag' | 'form-e44e48-4yil' |
  'form-e70-all' | 'form-e82-all' | 'form-e82e2-ana' | 'form-yag-4yil' |
  'form-e92-ana' | 'form-e92-yag' | 'form-e92-4yil' | 'form-ruzgar' |
  'reports-archive' | 'task-create' | 'MALZEME_YONETIMI' | 'material-analytics' | 'global-history' | 'form-template-edit' | 'siparis' | 'bakim-planlama' | 'bearing-analysis' | 'predictive-agent' | 'tsi-library' | 'asset-custody' | 'tickets-page' | 'visual-bom' | 'purchase-requests' | 'online-users';

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
  warehouseTab: 'inventory' | 'history';
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
    if ((profile?.role as any) === 'ADMIN') return true;
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
        'material-analytics', 'visual-bom', 'purchase-requests', 'warehouses', 'transfers', 
        'reports-archive', 'global-history', 'asset-custody'
      ];
      if (allowedForMalzemeYonetimi.includes(tab)) return true;
      return false; // Absolutely restrict from tasks, turbines, etc.
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
    if (['dashboard', 'tasks', 'turbines', 'siparis', 'bearing-analysis'].includes(tab)) return true;
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
        ${isMaterialManager ? `
          <li class="nav-item ${state.currentPage === 'material-analytics' ? 'active' : ''}" onclick="window.navigate('material-analytics')">
            <i class="fa-solid fa-chart-line"></i> Analiz Merkezi
          </li>
          <div class="nav-section-label">MALZEME YÖNETİMİ</div>
          <li class="nav-item ${state.currentPage === 'visual-bom' ? 'active' : ''}" onclick="window.navigate('visual-bom')">
            <i class="fa-solid fa-wind" style="color: var(--accent-cyan);"></i> Görsel Parça Haritası
          </li>
          <li class="nav-item ${state.currentPage === 'purchase-requests' ? 'active' : ''}" onclick="window.navigate('purchase-requests')">
            <i class="fa-solid fa-file-invoice-dollar" style="color: #fbbf24;"></i> Satın Alma Yönetimi
          </li>
        ` : `
          ${isAllowed('dashboard') ? `
            <li class="nav-item ${state.currentPage === 'dashboard' ? 'active' : ''}" onclick="window.navigate('dashboard')">
              <i class="fa-solid fa-gauge-high"></i> Dashboard
            </li>
          ` : ''}
          <div class="nav-section-label">OPERASYON</div>
        `}
        
        ${isAllowed('new-task') ? `
          <li class="nav-item ${state.currentPage === 'new-task' ? 'active' : ''}" onclick="window.navigate('new-task')">
            <i class="fa-solid fa-plus-circle"></i> Yeni İş Emri
          </li>
        ` : ''}
        ${isAllowed('tasks') ? `
          <li class="nav-item ${state.currentPage === 'tasks' ? 'active' : ''}" onclick="window.navigate('tasks')">
            <i class="fa-solid fa-list-check"></i> İş Emirleri
          </li>
        ` : ''}
        ${isAllowed('siparis') ? `
          <li class="nav-item ${state.currentPage === 'siparis' ? 'active' : ''}" onclick="window.navigate('siparis')">
            <i class="fa-solid fa-cart-plus"></i> Sipariş Oluştur
          </li>
        ` : ''}
        ${isAllowed('analytics') ? `
          <li class="nav-item ${state.currentPage === 'analytics' ? 'active' : ''}" onclick="window.navigate('analytics')">
            <i class="fa-solid fa-brain"></i> Adam Saat Analizi
          </li>
        ` : ''}
        ${isAllowed('bakim-planlama') ? `
          <li class="nav-item ${state.currentPage === 'bakim-planlama' ? 'active' : ''}" onclick="window.navigate('bakim-planlama')">
            <i class="fa-solid fa-calendar-check"></i> Bakım Planlama
          </li>
        ` : ''}

        <div class="nav-section-label">${isMaterialManager ? 'DEPOLAR VE ENVANTER' : 'VARLIK YÖNETİMİ'}</div>
        
        ${isAllowed('turbines') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'turbines' ? 'active' : ''}" onclick="window.toggleSubmenu('regions')">
            <i class="fa-solid fa-map-location-dot"></i> Servis Bölgeleri
            <i class="fa-solid fa-chevron-down submenu-arrow"></i>
          </li>
          <ul id="regions-submenu" class="sub-menu hidden">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.selectedSiteId === site.id ? 'active' : ''}" onclick="window.selectSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-charging-station" style="font-size: 0.6rem; opacity: 0.5;"></i> ${site.name}
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${isAllowed('warehouses') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'warehouses' ? 'active' : ''}" onclick="window.toggleSubmenu('warehouses')">
            <i class="fa-solid fa-warehouse"></i> Servis Depoları
            <i class="fa-solid fa-chevron-down submenu-arrow"></i>
          </li>
          <ul id="warehouses-submenu" class="sub-menu hidden">
            ${filteredWarehouses.map(wh => `
              <li class="sub-item ${state.selectedWarehouseId === wh.id ? 'active' : ''}" onclick="window.selectWarehouseAndNavigate('${wh.id}')">
                <i class="fa-solid fa-boxes-stacked" style="font-size: 0.6rem; opacity: 0.5;"></i> ${wh.name}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${isAllowed('tsi-library') ? `
          <li class="nav-item ${state.currentPage === 'tsi-library' ? 'active' : ''}" onclick="window.navigate('tsi-library')">
            <i class="fa-solid fa-book-bookmark" style="color: var(--accent-cyan);"></i> Servis Teknik Information
          </li>
        ` : ''}
        ${isAllowed('templates') ? `
          <li class="nav-item ${state.currentPage === 'templates' ? 'active' : ''}" onclick="window.navigate('templates')">
            <i class="fa-solid fa-file-invoice"></i> Arıza & Bakım Şablonları
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
        ${isAllowed('tickets-page') ? `
          <li class="nav-item ${state.currentPage === 'tickets-page' ? 'active' : ''}" onclick="window.navigate('tickets-page')">
            <i class="fa-solid fa-headset" style="color: var(--accent-cyan);"></i> Saha Destek
          </li>
        ` : ''}
        ${isAllowed('global-history') ? `
          <li class="nav-item ${state.currentPage === 'global-history' ? 'active' : ''}" onclick="window.navigate('global-history')">
            <i class="fa-solid fa-clock-rotate-left"></i> Depo Hareketleri
          </li>
        ` : ''}
        
        ${isAllowed('reports-archive') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'reports-archive' ? 'active' : ''}" onclick="window.toggleSubmenu('reports-archive')">
            <i class="fa-solid fa-box-archive"></i> Rapor Arşivi
            <i class="fa-solid fa-chevron-down submenu-arrow"></i>
          </li>
          <ul id="reports-archive-submenu" class="sub-menu hidden">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.selectedReportSiteId === site.id ? 'active' : ''}" onclick="window.selectReportSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-file-pdf" style="font-size: 0.6rem; opacity: 0.5;"></i> Rapor_${(site.name || 'Bilinmeyen').replace('Alize ', '').replace('Anemon ', '')}
              </li>
            `).join('')}
          </ul>
        ` : ''}

        ${isAllowed('bearing-analysis') ? `
          <div class="nav-section-label">AJANLAR</div>
          <li class="nav-item ${state.currentPage === 'bearing-analysis' ? 'active' : ''}" onclick="window.navigate('bearing-analysis')">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan);"></i> Rulman Analiz Ajanı
          </li>
        ` : ''}

        ${(profile?.role === 'ADMIN') ? `
          <li class="nav-item ${state.currentPage === 'predictive-agent' ? 'active' : ''}" onclick="window.navigate('predictive-agent')">
            <i class="fa-solid fa-radar" style="color: var(--accent-red);"></i> Önleyici Bakım Ajanı
          </li>
        ` : ''}

        ${(profile?.role === 'ADMIN' || profile?.role === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com') ? `
          <div class="nav-section-label">YÖNETİM</div>
          
          ${(profile?.role === 'ADMIN' || isAllowed('users')) ? `
            <li class="nav-item ${state.currentPage === 'users' ? 'active' : ''}" onclick="window.navigate('users')">
              <i class="fa-solid fa-user-gear"></i> Kullanıcı Yetki
            </li>
          ` : ''}

          ${(profile?.role === 'ADMIN' || isAllowed('material-analytics')) ? `
            <li class="nav-item ${state.currentPage === 'material-analytics' ? 'active' : ''}" onclick="window.navigate('material-analytics')">
              <i class="fa-solid fa-cart-shopping"></i> Malzeme Analizi
            </li>
          ` : ''}

          ${(profile?.role === 'ADMIN' || isAllowed('visual-bom')) ? `
            <li class="nav-item ${state.currentPage === 'visual-bom' ? 'active' : ''}" onclick="window.navigate('visual-bom')">
              <i class="fa-solid fa-wind" style="color: var(--accent-cyan);"></i> Görsel Parça Haritası
            </li>
          ` : ''}

          ${(profile?.role === 'ADMIN' || isAllowed('purchase-requests')) ? `
            <li class="nav-item ${state.currentPage === 'purchase-requests' ? 'active' : ''}" onclick="window.navigate('purchase-requests')">
              <i class="fa-solid fa-file-invoice-dollar" style="color: #fbbf24;"></i> Satın Alma Yönetimi
            </li>
          ` : ''}
          
          ${(isMaterialManager || profile?.role === 'ADMIN' || isAllowed('warehouses')) ? `
            <li class="nav-item ${state.currentPage === 'warehouses' ? 'active' : ''}" onclick="window.navigate('warehouses')">
              <i class="fa-solid fa-warehouse"></i> Depo İzleme
            </li>
          ` : ''}

          ${(profile?.role === 'ADMIN') ? `
            <div class="nav-section-title" style="margin-top: 1rem; margin-bottom: 0.5rem; padding-left: 1rem; font-size: 0.7rem; color: rgba(255,255,255,0.4); font-weight: bold; letter-spacing: 1px; text-transform: uppercase;">Yönetim</div>
            <li class="nav-item ${state.currentPage === 'online-users' ? 'active' : ''}" onclick="window.navigate('online-users')">
              <i class="fa-solid fa-users-viewfinder" style="color: #14F195;"></i> Aktif Kullanıcılar
            </li>
          ` : ''}
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
              ${state.userProfile?.displayName || profile?.email?.split('@')[0]?.toUpperCase() || 'YÜKLENİYOR...'}
              <span id="session-count-badge"></span>
            </div>
            ${state.userProfile?.managedTeams && state.userProfile.managedTeams.length > 0 ? `<div style="font-size: 0.55rem; color: #f97316; font-weight: 800; letter-spacing: 1px; margin-top: 2px;">EKİP LİDERİ</div>` : ''}
            <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">${state.userProfile?.role || '...'}</div>
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

  const user = authService.getCurrentUser();
  if (!user) {
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
        state.userProfile = profile;
      } else {
        console.warn("No user profile found, auto-creating default technician profile...");
        const defaultProfile: UserProfile = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'Kullanıcı',
          role: 'TECHNICIAN',
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
    (window as any).currentUser = state.userProfile;
    (window as any).currentUserTeam = state.userProfile.team || user.email?.split('@')[0].toUpperCase();
    
    // Redirect Material Manager to Material Analytics instead of Dashboard
    const isMaterialManager = state.userProfile.role === 'MALZEME_YONETIMI' || state.userProfile.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
    if (isMaterialManager && state.currentPage === 'dashboard') {
      state.currentPage = 'material-analytics';
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
    
    if (!options.skipShell || !hasShell) {
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
        modalRoot.innerHTML = `
          <div id="turbine-modal" class="modal-overlay hidden" style="display: none; z-index: 99999;">
            <div class="modal-content glass-panel">
              <div class="modal-header">
                <div style="display: flex; align-items: center; gap: 14px;">
                  <div class="modal-icon-container">
                    <i class="fa-solid fa-wind"></i>
                  </div>
                  <div>
                    <h2 class="modal-title">TÜRBİN DETAYI</h2>
                    <div id="modal-turbine-title" class="modal-subtitle">---</div>
                  </div>
                </div>
                <button onclick="window.closeTurbineDetails()" class="modal-close-btn">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
              
              <div class="modal-tabs">
                <button class="turbine-tab-btn active" onclick="window.switchTurbineTab('tasks')"><i class="fa-solid fa-list-check"></i> İŞ EMİRLERİ</button>
                <button class="turbine-tab-btn" onclick="window.switchTurbineTab('materials')"><i class="fa-solid fa-boxes-stacked"></i> MALZEMELER</button>
                <button class="turbine-tab-btn" onclick="window.switchTurbineTab('reports')"><i class="fa-solid fa-file-pdf"></i> ARŞİV</button>
                <button class="turbine-tab-btn" onclick="window.switchTurbineTab('deficiencies')"><i class="fa-solid fa-triangle-exclamation"></i> EKSİKLER</button>
                <button class="turbine-tab-btn" onclick="window.switchTurbineTab('notes')"><i class="fa-solid fa-note-sticky"></i> NOTLAR</button>
              </div>

              <div class="modal-body-scrollable">
                <div id="turbine-modal-loading" class="modal-loader-overlay">
                  <i class="fa-solid fa-circle-notch fa-spin fa-3x"></i>
                </div>

                <div id="tab-tasks" class="turbine-tab-content">
                  <h3 class="tab-section-title">Aktif ve Tamamlanan Görevler</h3>
                  <div id="modal-tasks-list" class="task-list-container"></div>
                </div>
                
                <div id="tab-materials" class="turbine-tab-content hidden">
                  <h3 class="tab-section-title">Değişen Parçalar</h3>
                  <div class="table-responsive">
                    <table class="data-table">
                      <thead>
                        <tr><th>Tarih</th><th>Rapor No</th><th>Malzeme Kodu</th><th>Açıklama</th><th>Miktar</th></tr>
                      </thead>
                      <tbody id="modal-materials-list"></tbody>
                    </table>
                  </div>
                </div>
                
                <div id="tab-reports" class="turbine-tab-content hidden">
                  <div id="reports-list-container">
                    <h3 class="tab-section-title">Geçmiş Raporlar</h3>
                    <div id="modal-reports-list" class="report-list-container"></div>
                  </div>
                  <div id="pdf-viewer-container" class="hidden">
                    <div class="pdf-viewer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                      <h3 id="pdf-viewer-title" style="margin: 0; color: var(--accent-cyan);">Rapor Görüntüleyici</h3>
                      <button onclick="window.closeTurbinePdf()" class="cyber-button secondary" style="padding: 4px 12px; font-size: 0.8rem;"><i class="fa-solid fa-arrow-left"></i> LİSTEYE DÖN</button>
                    </div>
                    <div id="pdf-iframe" style="background: white; color: black; padding: 2rem; border-radius: 8px; max-height: 65vh; overflow-y: auto; overflow-x: auto; font-size: 14px;"></div>
                  </div>
                </div>

                <div id="tab-deficiencies" class="turbine-tab-content hidden">
                  <h3 class="tab-section-title">Eksik Takibi</h3>
                  <div id="modal-deficiencies-list"></div>
                </div>

                <div id="tab-notes" class="turbine-tab-content hidden">
                  <h3 class="tab-section-title">Notlar & To-Do</h3>
                  <div class="note-input-group" style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                    <input type="text" id="new-turbine-note-input" class="cyber-input" placeholder="Yeni bir not veya to-do ekle..." style="flex: 1;">
                    <button onclick="window.addTurbineNote()" class="btn-cyber" style="min-width: 100px; font-weight: bold; letter-spacing: 1px;"><i class="fa-solid fa-plus"></i> EKLE</button>
                  </div>
                  <div id="modal-notes-list"></div>
                </div>
              </div>
            </div>
          </div>
        `;
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
    destroyTsiLibrary(); // Cleanup TSI listeners

    (window as any).currentWarehouseTab = state.warehouseTab;
    const content = await getContent();
    clearTimeout(loaderTimeout);
    targetContent.innerHTML = content;

    // Removing the setTimeout for switchTab since we now handle it at render time
    // --- PAGE SPECIFIC INITIALIZATION ---
    if (state.currentPage === 'tsi-library') initTsiLibrary();
    if (state.currentPage === 'form-ariza' || state.currentPage === 'form-template-edit') (window as any).initFaultFormLogic?.();
    if (state.currentPage === 'new-task') {
      const form = document.getElementById('wizard-form');
      if (form) form.addEventListener('submit', (window as any).handleWizardSubmit);
    }
    if (state.currentPage === 'transfers') (window as any).initTransferLogic?.();
    if (state.currentPage === 'warehouses' && state.selectedWarehouseId) (window as any).initWarehouseLogic?.();
    if (state.currentPage === 'bakim-planlama') (window as any).initMaintenancePlanning?.();
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

import { PurchaseRequestsPage } from './pages/PurchaseRequests';

const getContent = async () => {
  switch (state.currentPage) {
    case 'dashboard': return await DashboardPage();

    case 'new-task': return await NewTaskForm();
    case 'form-ariza': {
      return FaultFormPage(state.activeTask);
    }
    case 'form-template-edit': {
      return FaultFormPage({ id: 'TEMPLATE_MODE', secilenSablon: state.selectedTemplate || 'ŞABLON DÜZENLE' } as any);
    }
    case 'task-create': {
      return await TaskCreationForm(state.selectedTemplate || 'Arıza Formu');
    }
    case 'inventory': return InventoryPage();
    case 'visual-bom': {
      const { VisualBOMPage } = await import('./pages/VisualBOM');
      return await VisualBOMPage();
    }
    case 'purchase-requests': return await PurchaseRequestsPage();
    case 'turbines': return TurbinesPage();
    case 'teams': return TeamsPage();
    case 'tasks': return await TasksPage();
    case 'users': return await UserManagementPage();
    case 'warehouses': return await NewWarehousePage(state.selectedWarehouseId);
    case 'transfers': return await TransferPage(state.userProfile);
    case 'templates': return await TemplatesPage();
    case 'analytics': {
      return await AnalyticsPage();
    }
    case 'reports-archive': return await ReportArchivePage(state.selectedReportSiteId);
    case 'global-history': {
      return await GlobalWarehouseHistoryPage();
    }
    case 'MALZEME_YONETIMI': {
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
    case 'siparis': return await SiparisPage(state.userProfile);
    case 'bakim-planlama': {
      return await MaintenancePlanningPage();
    }
    case 'bearing-analysis': {
      return await BearingAnalysisPage();
    }
    case 'predictive-agent': {
      return PredictiveAgentPage();
    }
    case 'tsi-library': {
      return await TsiLibraryPage();
    }
    case 'asset-custody': return await AssetCustodyPage();
    case 'tickets-page': return await TicketsPage();
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

(window as any).selectWarehouseAndNavigate = (siteId: string) => {
  state.currentPage = 'warehouses';
  state.selectedWarehouseId = siteId;
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

window.addEventListener('auth-state-changed', () => {
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

