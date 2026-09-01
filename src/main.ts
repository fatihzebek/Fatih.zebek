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
import './components/VoiceAgentModal';
import { checkAndShowChangelogNotice, showChangelogModal, closeChangelogModal } from './components/ChangelogModal';

function mountVoiceAgentFloatingButton() {
  // Sesli asistan butonu geçici olarak kaldırıldı
  return;
  if (document.getElementById('floating-voice-agent-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'floating-voice-agent-btn';
  btn.onclick = () => (window as any).openVoiceAgentModal?.();
  btn.style.position = 'fixed';
  btn.style.bottom = '24px';
  btn.style.right = '24px';
  btn.style.zIndex = '9999';
  btn.style.background = 'linear-gradient(135deg, #14F195 0%, #00F2FE 100%)';
  btn.style.color = '#0A0E17';
  btn.style.border = 'none';
  btn.style.borderRadius = '50px';
  btn.style.padding = '0.75rem 1.4rem';
  btn.style.fontWeight = '900';
  btn.style.fontFamily = "'Rajdhani', sans-serif";
  btn.style.fontSize = '0.95rem';
  btn.style.letterSpacing = '1px';
  btn.style.cursor = 'pointer';
  btn.style.boxShadow = '0 0 25px rgba(20, 241, 149, 0.5), 0 8px 25px rgba(0, 0, 0, 0.4)';
  btn.style.display = 'flex';
  btn.style.alignItems = 'center';
  btn.style.gap = '10px';
  btn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
  
  btn.innerHTML = `
    <i class="fa-solid fa-microphone-lines" style="font-size: 1.1rem; animation: pulse 2s infinite;"></i>
    <span>SESLİ ASİSTAN</span>
  `;

  btn.onmouseover = () => {
    btn.style.transform = 'scale(1.06) translateY(-2px)';
    btn.style.boxShadow = '0 0 35px rgba(20, 241, 149, 0.8), 0 12px 30px rgba(0, 0, 0, 0.5)';
  };
  btn.onmouseout = () => {
    btn.style.transform = 'scale(1) translateY(0)';
    btn.style.boxShadow = '0 0 25px rgba(20, 241, 149, 0.5), 0 8px 25px rgba(0, 0, 0, 0.4)';
  };

  document.body.appendChild(btn);
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountVoiceAgentFloatingButton);
  } else {
    mountVoiceAgentFloatingButton();
  }
}

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
    
    if (localVersion && localVersion !== serverVersion) {
      console.log(`[VersionCheck] New version detected! Local: ${localVersion}, Server: ${serverVersion}. Purging caches...`);
      localStorage.setItem('app_version', serverVersion);
      
      // Force Service Worker unregistration and clear cache to fetch new assets immediately
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (let registration of registrations) {
            await registration.unregister();
          }
        } catch(e) {}
      }
      
      if ('caches' in window) {
        try {
          const keys = await caches.keys();
          for (let key of keys) {
            await caches.delete(key);
          }
        } catch(e) {}
      }
      
      showUpdateOverlay();
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } else if (!localVersion) {
      localStorage.setItem('app_version', serverVersion);
    }
  } catch (e) {
    console.error("Version check error:", e);
  }
}

// Check version on load and every 30 seconds for instant live updates
checkSystemVersion();
setInterval(checkSystemVersion, 30000);

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
  'reports-archive' | 'task-create' | 'MALZEME_YONETIMI' | 'material-analytics' | 'material-pricing' | 'global-history' | 'repair-history' | 'form-template-edit' | 'siparis' | 'saha-siparisleri' | 'bakim-planlama' | 'bearing-analysis' | 'predictive-agent' | 'code-advisor-agent' | 'tsi-library' | 'asset-custody' | 'tickets-page' | 'visual-bom' | 'purchase-requests' | 'online-users' | 'image-pool' | 'workshop' | 'workshop-stock' | 'workshop-tasks' | 'workshop-components' | 'workshop-dispatches' | 'workshop-returned' | 'workshop-scrap' | 'field-scraps' | 'card-passport' | 'kkd-kontrol' | 'olcu-aletleri' | 'tork-aletleri' | 'overtime-approvals' | 'personnel-management' | 'scada-reset-logs' | 'parameter-audit' | 'leave-management' | 'fault-library' | 'vehicle-management';

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
    if ((profile?.role as any) === 'ADMIN' || (profile?.role as any) === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || profile?.email?.toLowerCase() === 'emir.unver@demirerholding.com') return true;
    if ((profile?.role as any) === 'TAMİR' || (profile?.role as any) === 'TAMIR') return w.id === 'MTA';
    const isWhAllowed = profile?.allowedWarehouses?.some(whId => whId === w.id || whId.includes(w.id) || w.id.includes(whId));
    const isSiteAllowed = profile?.allowedSites?.some(sId => sId === w.id || sId.includes(w.id) || w.id.includes(sId));
    return isWhAllowed || isSiteAllowed;
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
      if ((profile?.role as any) === 'ADMIN' || (profile?.role as any) === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || profile?.email?.toLowerCase() === 'emir.unver@demirerholding.com') return true;
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
    
    // tickets-page (Saha Destek), image-pool (Resim Havuzu) and saha-siparisleri (Saha Siparişleri) are hidden for TAMİR role
    if (tab === 'tickets-page' || tab === 'image-pool' || tab === 'saha-siparisleri') {
      if ((userRole as any) === 'TAMİR' || (userRole as any) === 'TAMIR') {
        return false;
      }
      return true;
    }

    // Strict security lock: 'siparis' is ONLY accessible by ADMIN or MALZEME_YONETIMI
    if (tab === 'siparis') {
      return userRole === 'ADMIN' || 
             userRole === 'MALZEME_YONETIMI' || 
             email === 'hursit.akter@demirerholding.com' || 
             email === 'emir.unver@demirerholding.com';
    }

    // Strict super admin lock: 'users' (Kullanıcı Yetkileri) is ONLY accessible by Fatih Zebek
    if (tab === 'users') {
      return email === 'fatih.zebek@demirerholding.com' || (email?.includes('fatih.zebek') ?? false);
    }

    // Strict role locks for Workshop & Repair tabs: ONLY ADMIN, MALZEME_YONETIMI, TAMIR, and Furkan YILDIRIM
    const workshopAndRepairTabs = ['workshop', 'workshop-stock', 'workshop-tasks', 'workshop-components', 'repair-history', 'workshop-dispatches', 'workshop-returned', 'workshop-scrap', 'field-scraps', 'card-passport'];
    if (workshopAndRepairTabs.includes(tab)) {
      if (userRole === 'ADMIN') return true;
      if (email === 'hursit.akter@demirerholding.com' || userRole === 'MALZEME_YONETIMI') return true;
      if (email === 'furkan.yildirim@demirerholding.com' || (email?.includes('furkan.yildirim') ?? false)) return true;
      if ((userRole as any) === 'TAMİR' || (userRole as any) === 'TAMIR') return true;
      return false; // Absolute restriction for all other roles
    }

    // ADMIN has full access for all other tabs
    if (userRole === 'ADMIN') return true;
    
    // Special coordinator override for hursit.akter@demirerholding.com or role MALZEME_YONETIMI
    if (email === 'hursit.akter@demirerholding.com' || userRole === 'MALZEME_YONETIMI') {
      const allowedForMalzemeYonetimi = [
        'siparis', 'turbines', 'material-pricing', 'material-analytics', 'purchase-requests', 'warehouses', 'transfers', 
        'reports-archive', 'global-history', 'asset-custody', 'repair-history', 'workshop', 'workshop-stock', 'workshop-tasks', 'workshop-components', 'workshop-dispatches', 'workshop-returned', 'workshop-scrap'
      ];
      if (allowedForMalzemeYonetimi.includes(tab)) return true;
      return false; // Absolutely restrict from tasks, etc.
    }

    // TAMİR role access for other tabs
    if ((userRole as any) === 'TAMİR' || (userRole as any) === 'TAMIR') {
      const allowedForTamir = ['workshop', 'workshop-stock', 'workshop-tasks', 'workshop-components', 'repair-history', 'workshop-dispatches', 'workshop-returned', 'workshop-scrap', 'warehouses'];
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

      if (Array.isArray(tabs)) {
        return tabs.includes(tab);
      }
      if (typeof tabs === 'object') {
        const val = (tabs as any)[tab];
        if (typeof val === 'object' && val !== null) {
          return !!val.access;
        }
        return !!val;
      }
    }
    
    // Default allowed for all logged in users if no custom tab configuration is set
    if (['dashboard', 'leave-management'].includes(tab)) return true;
    return false;
  };

(window as any).handleNavDragStart = (e: DragEvent, itemId: string) => {
  e.dataTransfer?.setData('text/plain', itemId);
  (window as any)._draggedNavId = itemId;
  const target = e.currentTarget as HTMLElement;
  if (target) target.style.opacity = '0.4';
};

(window as any).handleNavDragEnd = (e: DragEvent) => {
  const target = e.currentTarget as HTMLElement;
  if (target) target.style.opacity = '1';
};

(window as any).handleNavDragOver = (e: DragEvent) => {
  e.preventDefault();
  const target = e.currentTarget as HTMLElement;
  if (target) target.style.borderTop = '2px solid #64ffda';
};

(window as any).handleNavDragLeave = (e: DragEvent) => {
  const target = e.currentTarget as HTMLElement;
  if (target) target.style.borderTop = '';
};

(window as any).handleNavDrop = (e: DragEvent, targetItemId: string) => {
  e.preventDefault();
  const target = e.currentTarget as HTMLElement;
  if (target) target.style.borderTop = '';

  const draggedId = (window as any)._draggedNavId || e.dataTransfer?.getData('text/plain');
  if (!draggedId || draggedId === targetItemId) return;

  const draggedEl = document.querySelector(`[data-nav-id="${draggedId}"]`);
  const targetEl = document.querySelector(`[data-nav-id="${targetItemId}"]`);

  if (draggedEl && targetEl && targetEl.parentNode) {
    targetEl.parentNode.insertBefore(draggedEl, targetEl);
    
    const allNavs = Array.from(document.querySelectorAll('.nav-menu > [data-nav-id]'));
    const newOrder = allNavs.map(el => el.getAttribute('data-nav-id')).filter(Boolean);
    localStorage.setItem('custom_sidebar_order', JSON.stringify(newOrder));
    
    // Re-render to cleanly place submenus under their triggers
    (window as any).render();
  }
};

(window as any).addCustomSectionHeader = () => {
  const title = prompt("Yeni Bölüm Başlığı Girin:");
  if (!title || !title.trim()) return;
  
  const cleanTitle = title.trim().toUpperCase();
  const headerId = 'sec-custom-' + Date.now();

  try {
    const customHeadersStr = localStorage.getItem('custom_sidebar_headers') || '{}';
    const customHeaders = JSON.parse(customHeadersStr);
    customHeaders[headerId] = cleanTitle;
    localStorage.setItem('custom_sidebar_headers', JSON.stringify(customHeaders));

    const savedOrderStr = localStorage.getItem('custom_sidebar_order');
    let order: string[] = savedOrderStr ? JSON.parse(savedOrderStr) : [];
    order.push(headerId);
    localStorage.setItem('custom_sidebar_order', JSON.stringify(order));

    (window as any).render();
  } catch(e) {
    console.error("Failed to add custom section header", e);
  }
};

(window as any).deleteCustomSectionHeader = (headerId: string, e: Event) => {
  e.stopPropagation();
  if (!confirm("Bu özel başlığı silmek istediğinize emin misiniz?")) return;

  try {
    const customHeadersStr = localStorage.getItem('custom_sidebar_headers') || '{}';
    const customHeaders = JSON.parse(customHeadersStr);
    delete customHeaders[headerId];
    localStorage.setItem('custom_sidebar_headers', JSON.stringify(customHeaders));

    const savedOrderStr = localStorage.getItem('custom_sidebar_order');
    if (savedOrderStr) {
      let order: string[] = JSON.parse(savedOrderStr);
      order = order.filter(id => id !== headerId);
      localStorage.setItem('custom_sidebar_order', JSON.stringify(order));
    }

    (window as any).render();
  } catch(e) {
    console.error("Failed to delete custom section header", e);
  }
};

  const isMaterialManager = profile?.role === 'MALZEME_YONETIMI' || profile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
  const navDragAttr = (id: string) => `data-nav-id="${id}" draggable="true" ondragstart="window.handleNavDragStart(event, '${id}')" ondragend="window.handleNavDragEnd(event)" ondragover="window.handleNavDragOver(event)" ondragleave="window.handleNavDragLeave(event)" ondrop="window.handleNavDrop(event, '${id}')"`;

  return `
    <aside class="sidebar">
      <div class="sidebar-logo" style="position: relative; overflow: hidden; padding: 1rem 1rem 1.4rem 1rem; min-height: 70px;">
        <!-- Faint Rotating Wind Turbine Watermark in Background -->
        <div style="position: absolute; right: -10px; top: -14px; width: 76px; height: 76px; opacity: 0.20; color: var(--accent-cyan); pointer-events: none; z-index: 0; display: flex; align-items: center; justify-content: center;">
          <svg viewBox="0 0 100 100" style="width: 100%; height: 100%;">
            <!-- Tower -->
            <path d="M48 95 L49.4 45 L50.6 45 L52 95 Z" fill="currentColor" />
            <!-- Rotor Hub -->
            <circle cx="50" cy="45" r="3.5" fill="currentColor" />
            <!-- Spinning Blades -->
            <g style="transform-origin: 50px 45px; animation: logo-turbine-spin 15s linear infinite;">
              <path d="M49.2 45 L49.6 8 C49.8 6, 50.2 6, 50.4 8 L50.8 45 Z" fill="currentColor" />
              <g transform="rotate(120, 50, 45)">
                <path d="M49.2 45 L49.6 8 C49.8 6, 50.2 6, 50.4 8 L50.8 45 Z" fill="currentColor" />
              </g>
              <g transform="rotate(240, 50, 45)">
                <path d="M49.2 45 L49.6 8 C49.8 6, 50.2 6, 50.4 8 L50.8 45 Z" fill="currentColor" />
              </g>
            </g>
          </svg>
        </div>

        <!-- Brand Logo Row -->
        <div style="display: flex; align-items: flex-end; gap: 0.6rem; margin-bottom: 1.5rem; position: relative; z-index: 1;">
          <!-- Official Corporate Blue DH Badge -->
          <div style="width: 34px; height: 34px; background-color: #1a3b75; display: flex; align-items: center; justify-content: center; border-radius: 3px; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);">
            <span style="font-family: 'Georgia', 'Times New Roman', serif; font-weight: bold; font-size: 1.45rem; color: #fff; line-height: 1; user-select: none;">dh</span>
          </div>
          
          <!-- demirer holding text and its underline aligned to the badge bottom -->
          <div style="border-bottom: 1.5px solid #1a3b75; padding-bottom: 2px; white-space: nowrap; line-height: 1.1; width: fit-content; position: relative; overflow: visible;">
            <span style="font-family: 'Georgia', 'Times New Roman', serif; font-size: 0.95rem; color: #fff; letter-spacing: 0.3px; user-select: none;">demirer holding</span>
            <span style="position: absolute; top: 100%; left: 0; width: 100%; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.68rem; color: var(--accent-cyan); letter-spacing: 2.5px; margin-top: 4px; user-select: none; text-align: center; display: block;">Servis</span>
          </div>
        </div>
      </div>
      
      <nav class="nav-menu">
        ${isAllowed('dashboard') ? `
          <li class="nav-item ${state.currentPage === 'dashboard' ? 'active' : ''}" ${navDragAttr('dashboard')} onclick="window.navigate('dashboard')">
            <i class="fa-solid fa-gauge-high" style="color: var(--accent-cyan);"></i> Dashboard
          </li>
        ` : ''}

        ${(isAllowed('tasks') || isAllowed('new-task') || isAllowed('turbines') || isAllowed('warehouses') || isAllowed('reports-archive') || isAllowed('bakim-planlama') || isAllowed('tickets-page') || isAllowed('workshop') || profile?.role === 'TAMİR' || isAllowed('tsi-library') || isAllowed('fault-library')) ? `
          <div class="nav-section-label" ${navDragAttr('sec-saha')}>Saha Operasyon Bölümü</div>
        ` : ''}

        ${isAllowed('tasks') ? `
          <li class="nav-item ${state.currentPage === 'tasks' ? 'active' : ''}" ${navDragAttr('tasks')} onclick="window.navigate('tasks')">
            <i class="fa-solid fa-list-check" style="color: #60a5fa;"></i> İş Emirleri
          </li>
        ` : ''}
        ${isAllowed('new-task') ? `
          <li class="nav-item ${state.currentPage === 'new-task' ? 'active' : ''}" ${navDragAttr('new-task')} onclick="window.navigate('new-task')">
            <i class="fa-solid fa-plus-circle" style="color: #34d399;"></i> Yeni İş Emri
          </li>
        ` : ''}
        ${isAllowed('turbines') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'turbines' ? 'active' : ''}" ${navDragAttr('turbines')} onclick="window.toggleSubmenuAndNavigate('regions', 'turbines')">
            <i class="fa-solid fa-map-location-dot" style="color: #c084fc;"></i> Servis Bölgeleri
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'turbines' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="regions-submenu" class="sub-menu ${state.currentPage === 'turbines' ? '' : 'hidden'}">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.currentPage === 'turbines' && state.selectedSiteId === site.id ? 'active' : ''}" onclick="window.selectSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-charging-station" style="font-size: 0.6rem; opacity: 0.5;"></i> ${site.name}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${(isAllowed('warehouses') && (profile?.role as any) !== 'TAMİR' && (profile?.role as any) !== 'TAMIR') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'warehouses' ? 'active' : ''}" ${navDragAttr('warehouses')} onclick="window.toggleSubmenuAndNavigate('warehouses', 'warehouses')">
            <i class="fa-solid fa-warehouse" style="color: #fb923c;"></i> Servis Depoları
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'warehouses' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="warehouses-submenu" class="sub-menu ${state.currentPage === 'warehouses' ? '' : 'hidden'}">
            ${filteredWarehouses.map(wh => `
              <li class="sub-item ${state.currentPage === 'warehouses' && state.selectedWarehouseId === wh.id ? 'active' : ''}" 
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
                const currentTeamCanonical = formatTeamName(teamName);
                const isUserOwnTeam = !!userTeamCanonical && userTeamCanonical === currentTeamCanonical;
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
          <li class="nav-item has-submenu ${state.currentPage === 'reports-archive' ? 'active' : ''}" ${navDragAttr('reports-archive')} onclick="window.toggleSubmenuAndNavigate('reports-archive', 'reports-archive')">
            <i class="fa-solid fa-box-archive" style="color: #f87171;"></i> Rapor Arşivi
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'reports-archive' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="reports-archive-submenu" class="sub-menu ${state.currentPage === 'reports-archive' ? '' : 'hidden'}">
            ${filteredSites.map(site => `
              <li class="sub-item ${state.currentPage === 'reports-archive' && state.selectedReportSiteId === site.id ? 'active' : ''}" onclick="window.selectReportSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-file-pdf" style="font-size: 0.6rem; opacity: 0.5;"></i> Rapor_${(site.name || 'Bilinmeyen').replace('Alize ', '').replace('Anemon ', '')}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${isAllowed('visual-bom') ? `
          <li class="nav-item ${state.currentPage === 'visual-bom' ? 'active' : ''}" ${navDragAttr('visual-bom')} onclick="window.navigate('visual-bom')">
            <i class="fa-solid fa-cube" style="color: #38bdf8;"></i> Türbin Dijital İkizi
          </li>
        ` : ''}
        ${isAllowed('bakim-planlama') ? `
          <li class="nav-item has-submenu ${state.currentPage === 'bakim-planlama' ? 'active' : ''}" ${navDragAttr('bakim-planlama')} onclick="window.toggleSubmenuAndNavigate('bakim-planlama', 'bakim-planlama')">
            <i class="fa-solid fa-calendar-check" style="color: #fbbf24;"></i> Bakım Planlama
            <i class="fa-solid fa-chevron-down submenu-arrow ${state.currentPage === 'bakim-planlama' ? 'rotate-180' : ''}"></i>
          </li>
          <ul id="bakim-planlama-submenu" class="sub-menu ${state.currentPage === 'bakim-planlama' ? '' : 'hidden'}">
            <li class="sub-item" onclick="window.selectMaintSiteAndNavigate('ALL')">
              <i class="fa-solid fa-border-all" style="font-size: 0.6rem; opacity: 0.5;"></i> Tüm Sahalar
            </li>
            ${filteredSites.map(site => `
              <li class="sub-item" onclick="window.selectMaintSiteAndNavigate('${site.id}')">
                <i class="fa-solid fa-charging-station" style="font-size: 0.6rem; opacity: 0.5;"></i> ${site.name}
              </li>
            `).join('')}
          </ul>
        ` : ''}
        ${isAllowed('tickets-page') ? `
          <li class="nav-item ${state.currentPage === 'tickets-page' ? 'active' : ''}" ${navDragAttr('tickets-page')} onclick="window.navigate('tickets-page')">
            <i class="fa-solid fa-headset" style="color: var(--accent-cyan);"></i> Saha Destek
          </li>
        ` : ''}
        ${isAllowed('workshop') || profile?.role === 'TAMİR' ? `
          <li class="nav-item ${state.currentPage === 'workshop' ? 'active' : ''}" ${navDragAttr('workshop')} onclick="window.navigate('workshop')">
            <i class="fa-solid fa-microchip" style="color: #14F195;"></i> Kart Tamir Merkezi
          </li>
        ` : ''}
        ${isAllowed('tsi-library') ? `
          <li class="nav-item ${state.currentPage === 'tsi-library' ? 'active' : ''}" ${navDragAttr('tsi-library')} onclick="window.navigate('tsi-library')">
            <i class="fa-solid fa-book-bookmark" style="color: var(--accent-cyan);"></i> Servis Teknik Information
          </li>
        ` : ''}
        
        ${isAllowed('fault-library') ? `
          <li class="nav-item ${state.currentPage === 'fault-library' ? 'active' : ''}" ${navDragAttr('fault-library')} onclick="window.navigate('fault-library')">
            <i class="fa-solid fa-brain" style="color: #00F2FE; filter: drop-shadow(0 0 4px rgba(0, 242, 254, 0.4));"></i> Arıza Kütüphanesi
          </li>
        ` : ''}

        ${(isAllowed('workshop-tasks') || isAllowed('repair-history') || isAllowed('workshop-stock') || isAllowed('workshop-components') || isAllowed('workshop-dispatches') || isAllowed('workshop-returned') || isAllowed('workshop-scrap') || isAllowed('workshop') || profile?.role === 'ADMIN' || (profile?.role as any) === 'TAMİR' || (profile?.role as any) === 'TAMIR') ? `
          <div class="nav-section-label" ${navDragAttr('sec-workshop')}>Merkez Tamir Atölyesi</div>
        ` : ''}

        ${(isAllowed('workshop-tasks') || isAllowed('workshop') || profile?.role === 'ADMIN' || (profile?.role as any) === 'TAMİR' || (profile?.role as any) === 'TAMIR') ? `
          <li class="nav-item ${state.currentPage === 'workshop-tasks' ? 'active' : ''}" ${navDragAttr('workshop-tasks')} onclick="window.navigate('workshop-tasks')">
            <i class="fa-solid fa-clipboard-list" style="color: #14F195;"></i> Kart İş Emirleri
          </li>
        ` : ''}
        ${isAllowed('repair-history') ? `
          <li class="nav-item ${state.currentPage === 'repair-history' ? 'active' : ''}" ${navDragAttr('repair-history')} onclick="window.navigate('repair-history')">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #14F195;"></i> Tamir Hareketleri
          </li>
        ` : ''}
        ${isAllowed('workshop-stock') ? `
          <li class="nav-item ${state.currentPage === 'workshop-stock' ? 'active' : ''}" ${navDragAttr('workshop-stock')} onclick="window.navigate('workshop-stock')">
            <i class="fa-solid fa-warehouse" style="color: #3B82F6;"></i> Atölye Tamir Stoğu
          </li>
        ` : ''}
        ${isAllowed('workshop-components') ? `
          <li class="nav-item ${state.currentPage === 'workshop-components' ? 'active' : ''}" ${navDragAttr('workshop-components')} onclick="window.navigate('workshop-components')">
            <i class="fa-solid fa-microchip" style="color: #00f2ff;"></i> Malzeme Stoğu
          </li>
        ` : ''}
        ${isAllowed('workshop-dispatches') ? `
          <li class="nav-item ${state.currentPage === 'workshop-dispatches' ? 'active' : ''}" ${navDragAttr('workshop-dispatches')} onclick="window.navigate('workshop-dispatches')">
            <i class="fa-solid fa-truck-fast" style="color: #10B981;"></i> Atölye Sevk Edilenler
          </li>
        ` : ''}
        ${(isAllowed('workshop-returned') || isAllowed('workshop-dispatches')) ? `
          <li class="nav-item ${state.currentPage === 'workshop-returned' ? 'active' : ''}" ${navDragAttr('workshop-returned')} onclick="window.navigate('workshop-returned')">
            <i class="fa-solid fa-arrows-spin" style="color: #F59E0B;"></i> Sahadan Geri Gelen Kartlar
          </li>
        ` : ''}
        ${isAllowed('workshop-scrap') ? `
          <li class="nav-item ${state.currentPage === 'workshop-scrap' ? 'active' : ''}" ${navDragAttr('workshop-scrap')} onclick="window.navigate('workshop-scrap')">
            <i class="fa-solid fa-dumpster-fire" style="color: #EF4444;"></i> Hurdaya Ayrılanlar
          </li>
        ` : ''}

        ${(isAllowed('siparis') || isAllowed('saha-siparisleri') || isAllowed('transfers') || isAllowed('asset-custody') || profile?.role === 'ADMIN' || isAllowed('material-analytics') || isAllowed('global-history') || isMaterialManager || (isAllowed('warehouses') && profile?.role !== 'TECHNICIAN') || isAllowed('image-pool')) ? `
          <div class="nav-section-label" ${navDragAttr('sec-depo')}>Depo Yönetimi</div>
        ` : ''}

        ${(isAllowed('saha-siparisleri') && (profile?.role as any) !== 'TAMİR' && (profile?.role as any) !== 'TAMIR') ? `
          <li class="nav-item ${state.currentPage === 'saha-siparisleri' ? 'active' : ''}" ${navDragAttr('saha-siparisleri')} onclick="window.navigate('saha-siparisleri')">
            <i class="fa-solid fa-list-check" style="color: #38bdf8;"></i> Saha Siparişleri
          </li>
        ` : ''}
        ${isAllowed('siparis') ? `
          <li class="nav-item ${state.currentPage === 'siparis' ? 'active' : ''}" ${navDragAttr('siparis')} onclick="window.navigate('siparis')">
            <i class="fa-solid fa-cart-plus" style="color: #818cf8;"></i> Sipariş Oluştur
          </li>
        ` : ''}
        ${isAllowed('transfers') ? `
          <li class="nav-item ${state.currentPage === 'transfers' ? 'active' : ''}" ${navDragAttr('transfers')} onclick="window.navigate('transfers')">
            <i class="fa-solid fa-truck-ramp-box" style="color: #34d399;"></i> Malzeme Transferi
          </li>
        ` : ''}
        ${isAllowed('asset-custody') ? `
          <li class="nav-item ${state.currentPage === 'asset-custody' ? 'active' : ''}" ${navDragAttr('asset-custody')} onclick="window.navigate('asset-custody')">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #f59e0b;"></i> Malzeme Zimmeti
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('material-analytics')) ? `
          <li class="nav-item ${state.currentPage === 'material-analytics' ? 'active' : ''}" ${navDragAttr('material-analytics')} onclick="window.navigate('material-analytics')">
            <i class="fa-solid fa-cart-shopping" style="color: #f472b6;"></i> Malzeme Analizi
          </li>
        ` : ''}
        ${((isAllowed('field-scraps') && (profile?.role as any) !== 'TAMİR' && (profile?.role as any) !== 'TAMIR') || profile?.role === 'ADMIN' || isMaterialManager) ? `
          <li class="nav-item ${state.currentPage === 'field-scraps' ? 'active' : ''}" ${navDragAttr('field-scraps')} onclick="window.navigate('field-scraps')">
            <i class="fa-solid fa-dumpster" style="color: #F87171;"></i> Sahalardan Çıkan Hurdalar
          </li>
        ` : ''}
        ${isAllowed('global-history') ? `
          <li class="nav-item ${state.currentPage === 'global-history' ? 'active' : ''}" ${navDragAttr('global-history')} onclick="window.navigate('global-history')">
            <i class="fa-solid fa-clock-rotate-left" style="color: #a78bfa;"></i> Depo Hareketleri
          </li>
        ` : ''}

        ${isAllowed('image-pool') ? `
          <li class="nav-item ${state.currentPage === 'image-pool' ? 'active' : ''}" ${navDragAttr('image-pool')} onclick="window.navigate('image-pool')">
            <i class="fa-solid fa-images" style="color: #0ea5e9;"></i> Görsel Ürün Tarama
          </li>
        ` : ''}

        ${(isAllowed('analytics') || isAllowed('templates') || profile?.role === 'ADMIN' || isAllowed('purchase-requests') || isAllowed('users') || isAllowed('personnel-management')) ? `
          <div class="nav-section-label" ${navDragAttr('sec-yonetim')}>Yönetim</div>
        ` : ''}

        ${isAllowed('analytics') ? `
          <li class="nav-item ${state.currentPage === 'analytics' ? 'active' : ''}" ${navDragAttr('analytics')} onclick="window.navigate('analytics')">
            <i class="fa-solid fa-brain" style="color: #38bdf8;"></i> Adam Saat Analizi
          </li>
        ` : ''}
        ${isAllowed('templates') ? `
          <li class="nav-item ${state.currentPage === 'templates' ? 'active' : ''}" ${navDragAttr('templates')} onclick="window.navigate('templates')">
            <i class="fa-solid fa-file-invoice" style="color: #f472b6;"></i> Arıza & Bakım Şablonları
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('purchase-requests')) ? `
          <li class="nav-item ${state.currentPage === 'purchase-requests' ? 'active' : ''}" ${navDragAttr('purchase-requests')} onclick="window.navigate('purchase-requests')">
            <i class="fa-solid fa-file-invoice-dollar" style="color: #fbbf24;"></i> Satın Alma Yönetimi
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || (profile?.managedTeams && profile.managedTeams.length > 0)) ? `
          <li class="nav-item ${state.currentPage === 'overtime-approvals' ? 'active' : ''}" ${navDragAttr('overtime-approvals')} onclick="window.navigate('overtime-approvals')">
            <i class="fa-solid fa-file-signature" style="color: var(--accent-cyan);"></i> Mesai & Sodexo Onayları
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN') ? `
          <li class="nav-item ${state.currentPage === 'online-users' ? 'active' : ''}" ${navDragAttr('online-users')} onclick="window.navigate('online-users')">
            <i class="fa-solid fa-users-viewfinder" style="color: #14F195;"></i> Aktif Kullanıcılar
          </li>
        ` : ''}
        
        ${(profile?.role === 'ADMIN' || isAllowed('kkd-kontrol') || isAllowed('olcu-aletleri') || isAllowed('tork-aletleri')) ? `
          <!-- 🟨 PERİYODİK KONTROLLER SUBMENU -->
          <li class="nav-item has-submenu ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? 'active' : ''}" ${navDragAttr('periodic-controls')} onclick="window.toggleSubmenu('periodic-controls')" style="color: #fbbf24; font-weight: 700;">
            <i class="fa-solid fa-clock-rotate-left" style="color: #fbbf24;"></i> Periyodik Kontroller
            <i class="fa-solid fa-chevron-down submenu-arrow ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? 'rotate-180' : ''}" style="color: #fbbf24; margin-left: auto;"></i>
          </li>
          <ul id="periodic-controls-submenu" class="sub-menu ${(state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') ? '' : 'hidden'}">
            ${(profile?.role === 'ADMIN' || isAllowed('kkd-kontrol')) ? `
              <li class="sub-item ${state.currentPage === 'kkd-kontrol' ? 'active' : ''}" onclick="window.navigate('kkd-kontrol')">
                <i class="fa-solid fa-helmet-safety" style="font-size: 0.65rem; opacity: 0.7;"></i> KKD Kontrolü
              </li>
            ` : ''}
            ${(profile?.role === 'ADMIN' || isAllowed('olcu-aletleri')) ? `
              <li class="sub-item ${state.currentPage === 'olcu-aletleri' ? 'active' : ''}" onclick="window.navigate('olcu-aletleri')">
                <i class="fa-solid fa-gauge" style="font-size: 0.65rem; opacity: 0.7;"></i> Ölçü Aletleri Kalibrasyon
              </li>
            ` : ''}
            ${(profile?.role === 'ADMIN' || isAllowed('tork-aletleri')) ? `
              <li class="sub-item ${state.currentPage === 'tork-aletleri' ? 'active' : ''}" onclick="window.navigate('tork-aletleri')">
                <i class="fa-solid fa-wrench" style="font-size: 0.65rem; opacity: 0.7;"></i> Tork Aletleri Kalibrasyon
              </li>
            ` : ''}
          </ul>
        ` : ''}

        ${(profile?.role === 'ADMIN' || isAllowed('scada-reset-logs')) ? `
          <li class="nav-item ${state.currentPage === 'scada-reset-logs' ? 'active' : ''}" ${navDragAttr('scada-reset-logs')} onclick="window.navigate('scada-reset-logs')">
            <i class="fa-solid fa-bolt" style="color: var(--accent-orange);"></i> SCADA Reset Günlükleri
          </li>
        ` : ''}
        
        ${(profile?.role === 'ADMIN' || isAllowed('parameter-audit')) ? `
          <li class="nav-item ${state.currentPage === 'parameter-audit' ? 'active' : ''}" ${navDragAttr('parameter-audit')} onclick="window.navigate('parameter-audit')">
            <i class="fa-solid fa-sliders" style="color: var(--accent-cyan);"></i> Parametre Denetimi
          </li>
        ` : ''}
        ${((state.userProfile?.email || profile?.email || '').toLowerCase().includes('fatih.zebek')) ? `
          <li class="nav-item ${state.currentPage === 'users' ? 'active' : ''}" ${navDragAttr('users')} onclick="window.navigate('users')">
            <i class="fa-solid fa-user-gear" style="color: #f43f5e;"></i> Kullanıcı Yetki
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('personnel-management')) ? `
          <li class="nav-item ${state.currentPage === 'personnel-management' ? 'active' : ''}" ${navDragAttr('personnel-management')} onclick="window.navigate('personnel-management')">
            <i class="fa-solid fa-people-group" style="color: #10b981;"></i> Personel & Şirket Yetki
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN' || isAllowed('leave-management')) ? `
          <li class="nav-item ${state.currentPage === 'leave-management' ? 'active' : ''}" ${navDragAttr('leave-management')} onclick="window.navigate('leave-management')">
            <i class="fa-solid fa-calendar-check" style="color: #a78bfa;"></i> İzin Yönetimi
          </li>
        ` : ''}
        ${((state.userProfile?.email || profile?.email || '').toLowerCase().includes('fatih.zebek')) ? `
          <li class="nav-item ${state.currentPage === 'vehicle-management' ? 'active' : ''}" ${navDragAttr('vehicle-management')} onclick="window.navigate('vehicle-management')">
            <i class="fa-solid fa-car" style="color: #38bdf8;"></i> Araç & Sürücü Filosu
          </li>
        ` : ''}

        ${(isAllowed('bearing-analysis') || profile?.role === 'ADMIN') ? `
          <div class="nav-section-label" ${navDragAttr('sec-ajanlar')}>AJANLAR</div>
        ` : ''}

        ${isAllowed('bearing-analysis') ? `
          <li class="nav-item ${state.currentPage === 'bearing-analysis' ? 'active' : ''}" ${navDragAttr('bearing-analysis')} onclick="window.navigate('bearing-analysis')">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan);"></i> Rulman Analiz Ajanı
          </li>
        ` : ''}
        ${(profile?.role === 'ADMIN') ? `
          <li class="nav-item ${state.currentPage === 'predictive-agent' ? 'active' : ''}" ${navDragAttr('predictive-agent')} onclick="window.navigate('predictive-agent')">
            <i class="fa-solid fa-radar" style="color: var(--accent-red);"></i> Önleyici Bakım Ajanı
          </li>
          <li class="nav-item ${state.currentPage === 'code-advisor-agent' ? 'active' : ''}" ${navDragAttr('code-advisor-agent')} onclick="window.navigate('code-advisor-agent')">
            <i class="fa-solid fa-code" style="color: #14f195;"></i> AI Kod Danışmanı
          </li>
        ` : ''}

        ${(() => {
          let customHtml = '';
          try {
            const customHeadersStr = localStorage.getItem('custom_sidebar_headers') || '{}';
            const customHeaders = JSON.parse(customHeadersStr);
            Object.keys(customHeaders).forEach(hId => {
              customHtml += `
                <div class="nav-section-label" ${navDragAttr(hId)} style="display: flex; align-items: center; justify-content: space-between; margin-top: 1rem;">
                  <span>${customHeaders[hId]}</span>
                  <i class="fa-solid fa-trash" onclick="window.deleteCustomSectionHeader('${hId}', event)" title="Başlığı Sil" style="cursor: pointer; opacity: 0.5; font-size: 0.75rem; padding: 2px 4px;" onmouseover="this.style.color='#ef4444'; this.style.opacity='1';" onmouseout="this.style.color=''; this.style.opacity='0.5';"></i>
                </div>
              `;
            });
          } catch(e) {}
          return customHtml;
        })()}

        ${(() => {
          const userEmail = (state.userProfile?.email || profile?.email || '').toLowerCase();
          const isAdmin = (state.userProfile?.role === 'ADMIN' || profile?.role === 'ADMIN') || userEmail.includes('fatih.zebek') || userEmail.includes('hursit.akter') || userEmail.includes('emir.unver');
          return isAdmin ? `
            <li class="nav-item" onclick="window.showChangelogModal()" style="border-left-color: #a855f7; margin-top: 0.5rem;">
              <i class="fa-solid fa-rocket" style="color: #c084fc;"></i> Sürüm Notları
            </li>
          ` : '';
        })()}

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
  `;
};

const Topbar = () => {
  const isLight = document.body.classList.contains('light-mode');
  const userEmail = (state.userProfile?.email || '').toLowerCase();
  const isFatihBey = userEmail.includes('fatih.zebek');

  return `
    <header class="topbar">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="menu-toggle" onclick="window.toggleSidebar()">
          <i class="fa-solid fa-bars"></i>
        </button>

      </div>
      
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        ${((state.userProfile?.role === 'ADMIN') || userEmail.includes('fatih.zebek') || userEmail.includes('hursit.akter') || userEmail.includes('emir.unver')) ? `
          <button onclick="window.showChangelogModal()" class="btn-cyber-outline" style="height: 38px; padding: 0 12px; display: flex; align-items: center; gap: 6px; border-radius: 19px; font-size: 0.75rem; border-color: rgba(168, 85, 247, 0.4); color: #c084fc; background: rgba(168, 85, 247, 0.1); cursor: pointer;" title="Sürüm Notları & Yenilikler">
            <i class="fa-solid fa-rocket" style="color: #c084fc;"></i>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 0.5px;">YENİLİKLER</span>
          </button>
        ` : ''}
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
  const idParam = urlParams.get('id');

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

  if (pageParam === 'leave-verify' && idParam) {
    try {
      const { renderLeavePublicVerifyPage } = await import('./pages/LeaveVerify');
      app.innerHTML = await renderLeavePublicVerifyPage(idParam);
    } catch (err) {
      console.error("Failed to render public leave verify page:", err);
      app.innerHTML = `<div style="color:red; padding:2rem; font-family:sans-serif;">İzin doğrulama sayfası yüklenirken hata oluştu.</div>`;
    }
    return;
  }

  if (pageParam === 'card-passport' || window.location.pathname === '/card-passport' || window.location.pathname.startsWith('/card-passport')) {
    try {
      const { CardPassportPage } = await import('./pages/CardPassport');
      app.innerHTML = await CardPassportPage();
    } catch (err) {
      console.error("Failed to render public card passport page:", err);
      app.innerHTML = `<div style="color:red; padding:2rem; font-family:sans-serif;">Kart karne sayfası yüklenirken hata oluştu.</div>`;
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
        if (profile.role === 'ADMIN' || profile.role === 'MALZEME_YONETIMI' || profile.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || profile.email?.toLowerCase() === 'emir.unver@demirerholding.com') {
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
            tasks: { access: true, createTask: false, deleteTask: false, completeTask: true, transferTask: false, delegateTask: false },
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

    // --- SÜRÜM NOTLARI & GÜNCELLEME KONTROLÜ ---
    checkAndShowChangelogNotice();

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
        
        <!-- Global Lightbox Modal -->
        <div id="global-lightbox-modal" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.95); backdrop-filter: blur(10px); z-index: 99999; display: none; align-items: center; justify-content: center; cursor: zoom-out;" onclick="window.closeImageLightbox()">
          <button style="position: absolute; top: 1.5rem; right: 1.5rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; color: #fff; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; font-size: 1.25rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,77,77,0.15)'; this.style.color='#ff4d4d';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#fff';" onclick="window.closeImageLightbox(); event.stopPropagation();">
            <i class="fa-solid fa-xmark"></i>
          </button>
          <img id="global-lightbox-image" src="" style="max-width: 90%; max-height: 85%; object-fit: contain; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); box-shadow: 0 20px 50px rgba(0,0,0,0.5); transform: scale(0.95); transition: transform 0.2s ease-out; cursor: default;" onclick="event.stopPropagation();">
        </div>
      `;
      
      // Restore user's custom drag-and-drop sidebar order if saved
      try {
        const savedOrderStr = localStorage.getItem('custom_sidebar_order');
        if (savedOrderStr) {
          const savedOrder = JSON.parse(savedOrderStr);
          const navMenu = document.querySelector('.nav-menu');
          const hasSectionHeaders = Array.isArray(savedOrder) && savedOrder.some((id: string) => typeof id === 'string' && id.startsWith('sec-'));
          if (!hasSectionHeaders) {
            // Remove old stale order that corrupted section headers
            localStorage.removeItem('custom_sidebar_order');
          } else if (navMenu && Array.isArray(savedOrder)) {
            savedOrder.forEach((navId: string) => {
              const item = navMenu.querySelector(`[data-nav-id="${navId}"]`);
              if (item) {
                // Find and keep the next sibling if it is a submenu
                const next = item.nextElementSibling;
                const hasSubmenu = next && next.classList.contains('sub-menu');
                
                navMenu.appendChild(item);
                
                if (hasSubmenu) {
                  navMenu.appendChild(next);
                }
              }
            });
          }
        }
      } catch(e) {}

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

        // 1. Top-level nav item active classes (including submenu triggers)
        const currentNav = document.querySelector(`.sidebar .nav-item[onclick*="navigate('${state.currentPage}')"]`) ||
                           document.querySelector(`.sidebar .nav-item[onclick*="'${state.currentPage}'"]`);
        if (currentNav) {
          currentNav.classList.add('active');
        }
        
        // Active classes for sidebar sub-items
        const currentSub = document.querySelector(`.sidebar .sub-item[onclick*="navigate('${state.currentPage}')"]`);
        if (currentSub) {
          currentSub.classList.add('active');
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
        if (state.currentPage === 'reports-archive' && state.selectedReportSiteId) {
          const subItem = document.getElementById('reports-archive-submenu')?.querySelector(`.sub-item[onclick*="selectReportSiteAndNavigate('${state.selectedReportSiteId}')"]`);
          if (subItem) subItem.classList.add('active');
        }
        if (state.currentPage === 'bakim-planlama') {
          const currentSiteName = sessionStorage.getItem('activeMaintSiteName') || 'TÜM SAHALAR';
          let targetSiteId = 'ALL';
          if (currentSiteName !== 'TÜM SAHALAR') {
            const siteObj = dataService.getSites().find(s => s.name === currentSiteName);
            if (siteObj) targetSiteId = siteObj.id;
          }
          const subItem = document.getElementById('bakim-planlama-submenu')?.querySelector(`.sub-item[onclick*="selectMaintSiteAndNavigate('${targetSiteId}')"]`);
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

        const reportsSub = document.getElementById('reports-archive-submenu');
        const reportsArrow = document.querySelector('.nav-item[onclick*="reports-archive"]')?.querySelector('.submenu-arrow');
        if (reportsSub) {
          if (state.currentPage === 'reports-archive') {
            reportsSub.classList.remove('hidden');
            if (reportsArrow) reportsArrow.classList.add('rotate-180');
          } else {
            reportsSub.classList.add('hidden');
            if (reportsArrow) reportsArrow.classList.remove('rotate-180');
          }
        }

        const maintSub = document.getElementById('bakim-planlama-submenu');
        const maintArrow = document.querySelector('.nav-item[onclick*="bakim-planlama"]')?.querySelector('.submenu-arrow');
        if (maintSub) {
          if (state.currentPage === 'bakim-planlama') {
            maintSub.classList.remove('hidden');
            if (maintArrow) maintArrow.classList.add('rotate-180');
          } else {
            maintSub.classList.add('hidden');
            if (maintArrow) maintArrow.classList.remove('rotate-180');
          }
        }

        const periodicSub = document.getElementById('periodic-controls-submenu');
        const periodicArrow = document.querySelector('.nav-item[onclick*="periodic-controls"]')?.querySelector('.submenu-arrow');
        if (periodicSub) {
          if (state.currentPage === 'kkd-kontrol' || state.currentPage === 'olcu-aletleri' || state.currentPage === 'tork-aletleri') {
            periodicSub.classList.remove('hidden');
            if (periodicArrow) periodicArrow.classList.add('rotate-180');
            const parentLi = document.querySelector('.nav-item[onclick*="periodic-controls"]');
            if (parentLi) parentLi.classList.add('active');
          } else {
            periodicSub.classList.add('hidden');
            if (periodicArrow) periodicArrow.classList.remove('rotate-180');
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

    // Cleanup all page-specific active Firestore listeners before route change
    const globalUnsubs = [
      '_currentUnsubscribe',
      '_draftAuditUnsubscribe',
      'scadaUnsubscribe',
      '_tasksUnsubscribe',
      '_inventoryUnsubscribe',
      '_warehouseTransfersUnsubscribe',
      'msfListUnsubscribe',
      '_overtimeUnsubscribe'
    ];
    globalUnsubs.forEach(key => {
      try {
        const unsub = (window as any)[key];
        if (typeof unsub === 'function') {
          unsub();
        }
      } catch (e) {
        console.error(`Failed to unsubscribe listener: ${key}`, e);
      }
      (window as any)[key] = null;
    });
    import('./pages/TsiLibrary').then(m => m.destroyTsiLibrary?.()).catch(() => {});

    (window as any).currentWarehouseTab = state.warehouseTab;
    const content = await getContent();
    clearTimeout(loaderTimeout);
    targetContent.innerHTML = content;
    disableAutocompleteGlobally();

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

const getUnderConstructionPage = (pageTitle: string) => {
  return `
    <div style="display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 120px); font-family: 'Rajdhani', sans-serif; text-align: center; padding: 2rem;">
      <div class="glass-panel" style="max-width: 500px; padding: 3.5rem 2.5rem; border: 1px solid rgba(0, 243, 255, 0.25); box-shadow: 0 0 35px rgba(0, 243, 255, 0.15); border-radius: 20px; background: rgba(13, 18, 30, 0.65); backdrop-filter: blur(15px); position: relative; overflow: hidden; width: 100%;">
        <!-- Glowing background circles -->
        <div style="position: absolute; top: -10%; left: -10%; width: 120px; height: 120px; background: rgba(0, 243, 255, 0.1); filter: blur(50px); border-radius: 50%;"></div>
        <div style="position: absolute; bottom: -10%; right: -10%; width: 120px; height: 120px; background: rgba(251, 191, 36, 0.08); filter: blur(50px); border-radius: 50%;"></div>
        
        <div style="font-size: 4.5rem; color: #fbbf24; margin-bottom: 2rem; filter: drop-shadow(0 0 15px rgba(251, 191, 36, 0.4));">
          <i class="fa-solid fa-person-digging fa-bounce"></i>
        </div>
        <h2 style="font-size: 2rem; font-weight: 900; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 1.25rem 0; background: linear-gradient(90deg, #fbbf24, #f59e0b); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-family: 'Rajdhani', sans-serif;">
          ${pageTitle}
        </h2>
        <p style="font-size: 1.1rem; color: #a0aec0; line-height: 1.6; margin: 0 0 2rem 0; font-family: 'Inter', sans-serif; font-weight: 500;">
          Bu modül şu anda yapım aşamasındadır ve güncellenmektedir. Çok yakında hizmete açılacaktır.
        </p>
        <div style="font-size: 0.85rem; color: rgba(255,255,255,0.4); padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); font-family: 'Inter', sans-serif;">
          Gösterdiğiniz sabır için teşekkür ederiz.
        </div>
      </div>
    </div>
  `;
};

const pageModulesCache: Record<string, any> = {};

const getModule = async (key: string, fn: () => Promise<any>) => {
  if (pageModulesCache[key]) return pageModulesCache[key];
  const mod = await fn();
  pageModulesCache[key] = mod;
  return mod;
};

// Preload all popular page modules in background
const preloadModulesInBackground = () => {
  const load = () => {
    import('./pages/Dashboard').then(m => pageModulesCache['dashboard'] = m).catch(() => {});
    import('./pages/Tasks').then(m => pageModulesCache['tasks'] = m).catch(() => {});
    import('./pages/ImagePool').then(m => pageModulesCache['image-pool'] = m).catch(() => {});
    import('./pages/Inventory').then(m => pageModulesCache['inventory'] = m).catch(() => {});
    import('./pages/Transfers').then(m => pageModulesCache['transfers'] = m).catch(() => {});
    import('./pages/GlobalWarehouseHistory').then(m => pageModulesCache['global-history'] = m).catch(() => {});
    import('./components/FormWizard').then(m => pageModulesCache['new-task'] = m).catch(() => {});
    import('./pages/FaultLibrary').then(m => pageModulesCache['fault-library'] = m).catch(() => {});
    import('./pages/TsiLibrary').then(m => pageModulesCache['tsi-library'] = m).catch(() => {});
    import('./pages/Turbines').then(m => pageModulesCache['turbines'] = m).catch(() => {});
    import('./pages/MaintenancePlanning').then(m => pageModulesCache['bakim-planlama'] = m).catch(() => {});
    import('./pages/ReportArchive').then(m => pageModulesCache['reports-archive'] = m).catch(() => {});
    import('./pages/VisualBOM').then(m => pageModulesCache['visual-bom'] = m).catch(() => {});
    import('./pages/UserManagement').then(m => pageModulesCache['users'] = m).catch(() => {});
    import('./pages/PersonnelManagement').then(m => pageModulesCache['personnel-management'] = m).catch(() => {});
    import('./pages/LeaveManagement').then(m => pageModulesCache['leave-management'] = m).catch(() => {});
    import('./pages/AssetCustody').then(m => pageModulesCache['asset-custody'] = m).catch(() => {});
    import('./pages/MaterialManagement').then(m => pageModulesCache['material-analytics'] = m).catch(() => {});
    import('./pages/WorkshopDashboard').then(m => pageModulesCache['workshop'] = m).catch(() => {});
    import('./pages/FieldScraps').then(m => pageModulesCache['field-scraps'] = m).catch(() => {});
    import('./pages/Analytics').then(m => pageModulesCache['analytics'] = m).catch(() => {});
  };
  if ('requestIdleCallback' in window) {
    (window as any).requestIdleCallback(load);
  } else {
    setTimeout(load, 400);
  }
};
preloadModulesInBackground();

const getContent = async () => {
  switch (state.currentPage) {
    case 'dashboard': {
      const { DashboardPage } = await getModule('dashboard', () => import('./pages/Dashboard'));
      return await DashboardPage();
    }
    case 'new-task': {
      const { NewTaskForm } = await getModule('new-task', () => import('./components/FormWizard'));
      return await NewTaskForm();
    }
    case 'fault-library': {
      const { FaultLibraryPage } = await getModule('fault-library', () => import('./pages/FaultLibrary'));
      return await FaultLibraryPage();
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
      // const { PurchaseRequestsPage } = await import('./pages/PurchaseRequests');
      // return await PurchaseRequestsPage();
      return getUnderConstructionPage('Satın Alma Yönetimi');
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
      const email = (state.userProfile?.email || '').toLowerCase();
      if (!email.includes('fatih.zebek')) {
        return `<div style="padding: 3rem; text-align: center; color: #f43f5e; font-family: 'Rajdhani', sans-serif;">
          <h2><i class="fa-solid fa-lock"></i> Bu Sayfaya Erişim Yetkiniz Bulunmamaktadır</h2>
          <p style="color: #94A3B8;">Kullanıcı yetkilerini yönetme izni yalnızca Ana Yöneticiye aittir.</p>
        </div>`;
      }
      const { UserManagementPage } = await import('./pages/UserManagement');
      return await UserManagementPage();
    }
    case 'personnel-management': {
      const { PersonnelManagementPage } = await import('./pages/PersonnelManagement');
      return await PersonnelManagementPage();
    }
    case 'warehouses': {
      const { NewWarehousePage } = await import('./pages/NewWarehouses/index');
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
    case 'workshop-tasks': {
      const { WorkshopTasksPage } = await import('./pages/WorkshopTasks');
      return await WorkshopTasksPage();
    }
    case 'workshop-stock': {
      const { WorkshopStockPage } = await import('./pages/WorkshopStock');
      return await WorkshopStockPage();
    }
    case 'workshop-components': {
      const { WorkshopComponentsPage } = await import('./pages/WorkshopComponents');
      return await WorkshopComponentsPage();
    }
    case 'workshop-dispatches': {
      (window as any)._workshopDispatchTab = 'DISPATCHED';
      const { WorkshopDispatchesPage } = await import('./pages/WorkshopDispatches');
      return await WorkshopDispatchesPage();
    }
    case 'workshop-returned': {
      const { WorkshopReturnedPage } = await import('./pages/WorkshopReturned');
      return await WorkshopReturnedPage();
    }
    case 'workshop-scrap': {
      const { WorkshopScrapPage } = await import('./pages/WorkshopScrap');
      return await WorkshopScrapPage();
    }
    case 'field-scraps': {
      const { FieldScrapsPage } = await import('./pages/FieldScraps');
      return await FieldScrapsPage();
    }
    case 'MALZEME_YONETIMI': {
      const { MaterialManagementPage } = await import('./pages/MaterialManagement');
      return await MaterialManagementPage(state.userProfile);
    }
    case 'material-analytics': {
      // const { MaterialAnalyticsPage } = await import('./pages/MaterialAnalytics');
      // return await MaterialAnalyticsPage();
      return getUnderConstructionPage('Malzeme Analizi');
    }
    case 'material-pricing': {
      const { MaterialPricingPage } = await import('./pages/MaterialPricing');
      setTimeout(() => {
        if ((window as any).initMaterialPricing) {
          (window as any).initMaterialPricing();
        }
      }, 50);
      return await MaterialPricingPage(state.userProfile);
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
    case 'scada-reset-logs': {
      const { ScadaResetLogsPage } = await import('./pages/ScadaResetLogs');
      return await ScadaResetLogsPage();
    }
    case 'parameter-audit': {
      const { ParameterAuditPage } = await import('./pages/ParameterAudit');
      return await ParameterAuditPage();
    }
    case 'leave-management': {
      const { LeaveManagementPage } = await import('./pages/LeaveManagement');
      return await LeaveManagementPage();
    }
    case 'vehicle-management': {
      const userEmail = (state.userProfile?.email || '').toLowerCase();
      if (!userEmail.includes('fatih.zebek')) {
        return `<div style="padding: 3rem; color: #EF4444; text-align: center; font-weight: bold; font-family: 'Rajdhani', sans-serif; font-size: 1.2rem;"><i class="fa-solid fa-lock"></i> Bu modül şu anda geliştirme aşamasında olup sadece yetkili yönetici erişimine açıktır.</div>`;
      }
      const { renderVehicleManagement, initVehicleManagementEvents } = await import('./pages/VehicleManagement');
      setTimeout(() => {
        initVehicleManagementEvents();
      }, 50);
      return renderVehicleManagement(state.userProfile);
    }
    case 'saha-siparisleri': {
      const { SahaSiparisleriPage } = await import('./pages/SahaSiparisleri');
      setTimeout(() => {
        if ((window as any).initSahaSiparisleriPage) {
          (window as any).initSahaSiparisleriPage();
        }
      }, 50);
      return await SahaSiparisleriPage(state.userProfile);
    }
    case 'siparis': {
      const userRole = (state.userProfile?.role || '').toUpperCase();
      const userEmail = (state.userProfile?.email || '').toLowerCase();
      const isAuthorized = userRole === 'ADMIN' || 
                           userRole === 'MALZEME_YONETIMI' || 
                           userEmail === 'hursit.akter@demirerholding.com' || 
                           userEmail === 'emir.unver@demirerholding.com';
      if (!isAuthorized) {
        return `
          <div class="cyber-card" style="margin: 2rem; padding: 2.5rem; text-align: center; border-color: rgba(239, 68, 68, 0.4); max-width: 600px; margin: 4rem auto;">
            <i class="fa-solid fa-shield-halved" style="font-size: 3rem; color: #ef4444; margin-bottom: 1rem;"></i>
            <h2 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.3rem;">Yetkisiz Erişim</h2>
            <p style="color: #94a3b8; font-size: 0.88rem;">Sipariş Yönetimi ve Satınalma ekranına yalnızca Admin ve Malzeme Yönetimi yetkilileri erişebilir.</p>
          </div>
        `;
      }
      const { SiparisPage } = await import('./pages/Siparis');
      setTimeout(() => {
        if ((window as any).initSiparisPage) {
          (window as any).initSiparisPage();
        }
      }, 50);
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

(window as any).showImageLightbox = (src: string) => {
  const modal = document.getElementById('global-lightbox-modal');
  const img = document.getElementById('global-lightbox-image') as HTMLImageElement;
  if (modal && img) {
    img.src = src;
    modal.style.display = 'flex';
    setTimeout(() => {
      img.style.transform = 'scale(1)';
    }, 10);
  }
};

(window as any).closeImageLightbox = () => {
  const modal = document.getElementById('global-lightbox-modal');
  const img = document.getElementById('global-lightbox-image') as HTMLImageElement;
  if (modal && img) {
    img.style.transform = 'scale(0.95)';
    setTimeout(() => {
      modal.style.display = 'none';
      img.src = '';
    }, 200);
  }
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

(window as any).navigateToVehicleTab = async (tabId: string) => {
  const { setActiveTab } = await import('./pages/VehicleManagement');
  setActiveTab(tabId);
  (window as any).navigate('vehicle-management');
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
    } else if (page === 'bakim-planlama' && sessionStorage.getItem('activeMaintSiteName') !== 'TÜM SAHALAR') {
      sessionStorage.setItem('activeMaintSiteName', 'TÜM SAHALAR');
      (window as any).navigate(page);
    } else {
      (window as any).toggleSubmenu(id);
    }
  }
};

(window as any).selectMaintSiteAndNavigate = (siteId: string) => {
  if (siteId === 'ALL') {
    sessionStorage.setItem('activeMaintSiteName', 'TÜM SAHALAR');
  } else {
    const siteObj = dataService.getSites().find(s => s.id === siteId);
    if (siteObj) {
      sessionStorage.setItem('activeMaintSiteName', siteObj.name);
    }
  }
  (window as any).navigate('bakim-planlama');
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
  } else if (state.warehouseTab) {
    // Keep current active tab when switching warehouses
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
const updateConnectivityBadge = () => {
  const badge = document.getElementById('connectivity-badge');
  const pageBadge = document.getElementById('offline-status-badge');
  const isOnline = navigator.onLine;

  let pendingCount = 0;
  try {
    const queue = JSON.parse(localStorage.getItem('offline_reports_queue') || '[]');
    pendingCount = queue.length;
  } catch (e) {}

  if (badge) {
    badge.className = `connection-status ${isOnline ? 'online' : 'offline'}`;
    const pendingTxt = pendingCount > 0 ? ` (${pendingCount} BEKLEYEN)` : '';
    badge.innerHTML = `<div class="status-dot"></div><span>${isOnline ? 'ONLINE MOD' : 'ÇEVRİMDİŞİ MOD'}${pendingTxt}</span><i class="fa-solid fa-rotate" id="sync-icon" style="margin-left: auto; font-size: 0.6rem; opacity: 0.5;"></i>`;
  }

  if (pageBadge) {
    pageBadge.style.background = isOnline ? 'rgba(0, 230, 118, 0.1)' : 'rgba(255, 170, 0, 0.1)';
    pageBadge.style.color = isOnline ? 'var(--accent-green)' : 'var(--accent-amber)';
    const icon = isOnline ? 'fa-wifi' : 'fa-plane-slash';
    const pendingTxt = pendingCount > 0 ? ` (${pendingCount} Rapor Bekliyor)` : '';
    pageBadge.innerHTML = `<i class="fa-solid ${icon}" style="margin-right: 4px;"></i>${isOnline ? 'ONLINE MOD' : 'ÇEVRİMDİŞİ'}${pendingTxt}`;
  }
};

window.addEventListener('online', () => {
  updateConnectivityBadge();
  (window as any).showToast?.('BAĞLANTI KURULDU', 'Sistem çevrimiçi. Veriler senkronize ediliyor...', 'success');
  if ((window as any).syncOfflineReports) {
    (window as any).syncOfflineReports();
  }
});

window.addEventListener('offline', () => {
  updateConnectivityBadge();
  (window as any).showToast?.('BAĞLANTI KESİLDİ', 'Sistem çevrimdışı modda. Raporlar telefona kaydedilecek.', 'info');
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

// Intercept focusin events to enforce autocomplete="off" immediately when focused
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT') {
    target.setAttribute('autocomplete', 'off');
  }
});

render();

