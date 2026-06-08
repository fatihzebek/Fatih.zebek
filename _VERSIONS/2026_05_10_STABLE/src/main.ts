import './style.css'
import { NewTaskForm } from './components/FormWizard'
import { InventoryPage } from './pages/Inventory'
import { TurbinesPage } from './pages/Turbines'
import { TeamsPage } from './pages/Teams'
import { LoginPage } from './pages/Login'
import { TasksPage } from './pages/Tasks'
import { ReportArchivePage } from './pages/ReportArchive'
import { UserManagementPage } from './pages/UserManagement'
import { WarehousePage } from './pages/Warehouses'
import { TransferPage } from './pages/Transfers'
import { TemplatesPage } from './pages/Templates'

import { dataService } from './services/DataService'
import { authService } from './services/AuthService'
import { taskService } from './services/TaskService'
import { userService } from './services/UserService'
import type { UserProfile } from './services/UserService'

// Types
type Page = 'dashboard' | 'tasks' | 'inventory' | 'turbines' | 'teams' | 'new-task' | 'login' | 'warehouses' | 'transfers' | 'users' | 'templates' | 'analytics' |
  'form-ariza' | 'form-gen-ariza' | 'form-rulman-ariza' |
  'form-e44e48-ana' | 'form-e44e48-yag' | 'form-e44e48-4yil' |
  'form-e70-all' | 'form-e82-all' | 'form-e82e2-ana' | 'form-yag-4yil' |
  'form-e92-ana' | 'form-e92-yag' | 'form-e92-4yil' | 'form-ruzgar' |
  'reports-archive' | 'task-create' | 'MALZEME_YONETIMI' | 'global-history' | 'form-template-edit';

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
  const filteredWarehouses = warehouses.filter(w => {
    if (profile?.role === 'ADMIN') return true;
    return profile?.allowedWarehouses?.includes(w.id);
  });

  // Filter sites and tabs based on permissions
  const filteredSites = (sites || []).filter(s => {
    if (profile?.role === 'ADMIN') return true;
    if (profile?.allowedSites && Array.isArray(profile.allowedSites)) {
      return profile.allowedSites.includes(s.id);
    }
    return false;
  });

  const isAllowed = (tab: string) => {
    if (!profile) return false;
    const userRole = profile?.role?.toUpperCase();
    if (userRole === 'ADMIN') return true;
    
    const tabs = profile.allowedTabs;
    if (tabs) {
      if (Array.isArray(tabs)) {
        return tabs.includes(tab);
      }
      if (typeof tabs === 'object') {
        return !!tabs[tab];
      }
    }
    
    // Default allowed for all logged in users
    if (['dashboard', 'tasks', 'turbines'].includes(tab)) return true;
    return false;
  };

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
          <h2 style="font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 2px; color: var(--text-main); font-size: 1.25rem; line-height: 1;">
            DH_<span style="color: var(--accent-cyan);">SERVİS</span>
          </h2>
        </div>
      </div>
      
      <nav class="nav-menu">
        ${isAllowed('dashboard') ? `
          <li class="nav-item ${state.currentPage === 'dashboard' ? 'active' : ''}" onclick="window.navigate('dashboard')">
            <i class="fa-solid fa-gauge-high"></i> Dashboard
          </li>
        ` : ''}

        <div class="nav-section-label">OPERASYON</div>
        
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
        ${isAllowed('dashboard') ? `
          <li class="nav-item ${state.currentPage === 'analytics' ? 'active' : ''}" onclick="window.navigate('analytics')">
            <i class="fa-solid fa-brain"></i> Adam Saat Analizi
          </li>
        ` : ''}

        <div class="nav-section-label">VARLIK YÖNETİMİ</div>
        
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
        ${isAllowed('warehouses') ? `
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

        ${profile?.role === 'ADMIN' ? `
          <div class="nav-section-label">YÖNETİM</div>
          

          <li class="nav-item ${state.currentPage === 'users' ? 'active' : ''}" onclick="window.navigate('users')">
            <i class="fa-solid fa-user-gear"></i> Kullanıcı Yetki
          </li>

          ${isAllowed('MALZEME_YONETIMI') ? `
            <li class="nav-item ${state.currentPage === 'MALZEME_YONETIMI' ? 'active' : ''}" onclick="window.navigate('MALZEME_YONETIMI')">
              <i class="fa-solid fa-cart-shopping"></i> Malzeme Yönetimi
            </li>
          ` : ''}
        ` : ''}
        
        ${state.userProfile?.role === 'MALZEME_YONETIMI' ? `
          <div class="nav-section-label">YÖNETİM</div>
          <li class="nav-item ${state.currentPage === 'MALZEME_YONETIMI' ? 'active' : ''}" onclick="window.navigate('MALZEME_YONETIMI')">
            <i class="fa-solid fa-cart-shopping"></i> Malzeme Yönetimi
          </li>
          <li class="nav-item ${state.currentPage === 'warehouses' ? 'active' : ''}" onclick="window.navigate('warehouses')">
            <i class="fa-solid fa-warehouse"></i> Depo İzleme
          </li>
        ` : ''}
      </nav>

      <div class="sidebar-footer">
        <div class="nav-item logout-btn" onclick="window.logout()" style="color: var(--accent-red); margin-bottom: 1rem; border-left: none;">
          <i class="fa-solid fa-power-off"></i> Çıkış Yap
        </div>
        
        <div class="user-profile sidebar-profile">
          <div class="user-avatar">
            <i class="fa-solid fa-user-shield"></i>
          </div>
          <div style="text-align: left;">
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.8rem; color: var(--text-main); line-height: 1.2;">${state.userProfile?.displayName || profile?.email?.split('@')[0]?.toUpperCase() || 'YÜKLENİYOR...'}</div>
            <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; text-transform: uppercase;">${state.userProfile?.role || '...'}</div>
          </div>
        </div>
      </div>
    </aside>
  `
}

const Topbar = () => {
  return `
    <header class="topbar">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="menu-toggle" onclick="window.toggleSidebar()">
          <i class="fa-solid fa-bars"></i>
        </button>
        <div class="status-indicator">
          <div class="pulse-dot"></div>
          SİSTEM ÇALIŞIYOR
        </div>
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

  // --- PROFILE LOADING ---
  if (!state.userProfile || state.userProfile.uid !== user.uid) {
    try {
      const profile = await userService.getProfile(user.uid);
      if (profile) {
        state.userProfile = profile;
        // Navigation fixes for technician role if needed
      } else {
        // No profile found, logout to be safe
        console.warn("No user profile found, logging out...");
        await authService.logout();
      }
    } catch (e) {
      console.error("Profile fetch error:", e);
    }
  }

  
  try {
    const hasShell = !!document.querySelector('.app-container');
    if (!options.skipShell || !hasShell) {
      const sidebarHtml = Sidebar();
      const topbarHtml = Topbar();
      app.innerHTML = `
        <div class="app-container">
          ${sidebarHtml}
          <main class="main-content">
            ${topbarHtml}
            <div id="page-content">
              <div class="loading-full-overlay">
                <div class="loader-cyber"></div>
                <div style="margin-top: 1rem; font-family: 'Rajdhani'; letter-spacing: 2px; color: var(--accent-cyan);">SİSTEM BAŞLATILIYOR...</div>
              </div>
            </div>
          </main>
        </div>
      `;
    }

    const pageContent = document.getElementById('page-content');
    if (!pageContent) return;

    const content = await getContent();
    pageContent.innerHTML = content;

    // --- PAGE SPECIFIC INITIALIZATION ---
    if (state.currentPage === 'form-ariza' || state.currentPage === 'form-template-edit') (window as any).initFaultFormLogic?.();
    if (state.currentPage === 'new-task') {
      const form = document.getElementById('wizard-form');
      if (form) form.addEventListener('submit', (window as any).handleWizardSubmit);
    }
    if (state.currentPage === 'transfers') (window as any).initTransferLogic?.();
    if (state.currentPage === 'warehouses' && state.selectedWarehouseId) (window as any).initWarehouseLogic?.();
  } catch (e) {
    console.error("Critical Render Error:", e);
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
      const tasks = await taskService.getTasks();
      const activeTasks = tasks.filter(t => t.status !== 'Tamamlandı').length;
      return `
        <div class="fade-in-up content-area">
          <h1 class="page-title"><i class="fa-solid fa-chart-pie" style="color: var(--accent-cyan);"></i> Gösterge Paneli</h1>
          <div class="stats-grid">
             <div class="glass-card stat-card red"><div class="stat-label">AKTİF İŞ EMİRLERİ</div><div class="stat-value">${activeTasks}</div></div>
             <div class="glass-card stat-card cyan"><div class="stat-label">SAHA SAYISI</div><div class="stat-value">${dataService.getSites().length}</div></div>
             <div class="glass-card stat-card orange"><div class="stat-label">PERSONEL</div><div class="stat-value">32</div></div>
             <div class="glass-card stat-card orange"><div class="stat-label">MALZEME</div><div class="stat-value">54K+</div></div>
          </div>
          <div class="glass-panel" style="padding: 1.5rem; margin-top: 1.5rem;">
             <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem;">Son Aktivite Takibi</h3>
             <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                  <tbody>
                    ${tasks.slice(0, 3).map(t => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <td style="padding: 0.75rem; color: var(--accent-cyan); font-weight: 700;">${t.siteId} / ${t.turbineId}</td>
                        <td style="padding: 0.75rem;">${t.personnel}</td>
                        <td style="padding: 0.75rem; text-align: right; color: var(--text-muted);">${t.status}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
             </div>
          </div>
        </div>
      `;
    }
    case 'new-task': return await NewTaskForm();
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
    case 'inventory': return InventoryPage();
    case 'turbines': return TurbinesPage();
    case 'teams': return TeamsPage();
    case 'tasks': return await TasksPage();
    case 'users': return await UserManagementPage();
    case 'warehouses': return await WarehousePage(state.selectedWarehouseId, state.userProfile, state.inventorySortKey, state.inventorySortDirection, state.inventorySearchQuery, state.warehouseTab);
    case 'transfers': return await TransferPage(state.userProfile);
    case 'templates': return await TemplatesPage();
    case 'analytics': {
      const { AnalyticsPage } = await import('./pages/Analytics');
      return await AnalyticsPage();
    }
    case 'reports-archive': return await ReportArchivePage(state.selectedReportSiteId);
    case 'global-history': {
      const { GlobalWarehouseHistoryPage } = await import('./pages/GlobalWarehouseHistory');
      return await GlobalWarehouseHistoryPage();
    }
    case 'MALZEME_YONETIMI': {
      const { MaterialManagementPage } = await import('./pages/MaterialManagement');
      return await MaterialManagementPage();
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
  render();
};

(window as any).selectSiteAndNavigate = (siteId: string) => {
  state.currentPage = 'turbines';
  state.selectedSiteId = siteId;
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

render();

