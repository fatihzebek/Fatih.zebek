import { dataService } from '../services/DataService'
import { taskService } from '../services/TaskService'
import { serviceReportService } from '../services/ServiceReportService'
import { turbineNoteService } from '../services/TurbineNoteService'
import { authService } from '../services/AuthService'
import { fileService } from '../services/FileService'
import { formatTeamName } from '../utils/formatters'

const cleanSablonName = (sablonName: string) => {
  return (sablonName || '')
    .replace(/\s*[Tt]alimatı\s*/g, '')
    .replace(/\s*[Tt]alimati\s*/g, '')
    .trim();
};

export const TurbinesPage = () => {
  // Clear map instances to prevent leaflet container reuse issues
  if ((window as any).sitesMapInstance) {
    try { (window as any).sitesMapInstance.remove(); } catch(e) {}
    (window as any).sitesMapInstance = null;
  }
  if ((window as any).siteMapInstance) {
    try { (window as any).siteMapInstance.remove(); } catch(e) {}
    (window as any).siteMapInstance = null;
  }

  // Start task subscription for main map and badge updates
  if (!(window as any).globalTurbinesTasksSubscribed) {
    (window as any).globalTurbinesTasksSubscribed = true;
    taskService.subscribeTasks((allTasks) => {
      (window as any).latestTurbineTasks = allTasks;
      // If sites map is initialized and visible, update it
      if ((window as any).sitesMapInstance) {
        (window as any).initSitesMap();
      }
    });
  }

  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  return `
    <div class="fade-in-up content-area">
      <div id="turbine-detail-container">
        
        <div style="text-align: center; margin-bottom: 2.2rem; margin-top: 2rem;">
          <div style="display: inline-block; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.3); color: var(--accent-cyan); padding: 6px 16px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 2px; margin-bottom: 1.2rem; box-shadow: 0 0 15px rgba(0,243,255,0.2);">
            <i class="fa-solid fa-circle" style="font-size: 0.5rem; margin-right: 6px; text-shadow: 0 0 5px var(--accent-cyan);"></i> SİSTEM ÇEVRİMİÇİ
          </div>
          <h1 style="font-family: 'Rajdhani', sans-serif; font-size: clamp(2rem, 4vw, 3.5rem); margin: 0 0 1rem 0; font-weight: 900; letter-spacing: 1px; color: var(--text-main); text-shadow: 0 0 20px rgba(255,255,255,0.1);">
            <i class="fa-solid fa-network-wired" style="color: var(--accent-cyan); margin-right: 10px;"></i> SAHA MERKEZİ
          </h1>
          <p style="color: var(--text-muted); font-size: 1.1rem; max-width: 600px; margin: 0 auto; line-height: 1.6;">
            Bölgesel türbin kontrolü ve servis optimizasyon paneli. İşlem yapmak istediğiniz sahayı haritadan seçiniz.
          </p>
        </div>

        <div id="sites-map-container" style="width: 100%; max-width: 1200px; margin: 0 auto 4rem auto; height: 600px; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.2); overflow: hidden; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
          <!-- Floating Map Layer Switcher -->
          <div style="position: absolute; top: 12px; right: 12px; z-index: 1000; display: flex; gap: 6px; background: rgba(10, 15, 25, 0.75); padding: 4px; border-radius: 8px; border: 1px solid rgba(0, 243, 255, 0.2); backdrop-filter: blur(10px); box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
            <button id="sites-map-layer-dark" onclick="window.switchMainMapLayer('dark')" class="cyber-map-layer-btn active">
              <i class="fa-solid fa-moon"></i> KARANLIK
            </button>
            <button id="sites-map-layer-satellite" onclick="window.switchMainMapLayer('satellite')" class="cyber-map-layer-btn">
              <i class="fa-solid fa-satellite"></i> UYDU
            </button>
          </div>
          <div id="sites-map" style="width: 100%; height: 100%;"></div>
        </div>

      </div>
    </div>
  `
}

// Global exposure for interactions
(window as any).selectSite = async (siteId: string) => {
  const container = document.getElementById('turbine-detail-container');
  if (!container) return;

  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  // --- REAL-TIME CLEANUP ---
  if ((window as any).turbineGridUnsubscribe) {
    (window as any).turbineGridUnsubscribe();
    (window as any).turbineGridUnsubscribe = null;
  }

  // Clear previous site map instance
  if ((window as any).siteMapInstance) {
    try { (window as any).siteMapInstance.remove(); } catch(e) {}
    (window as any).siteMapInstance = null;
  }

  const site = dataService.getSites().find(s => s.id === siteId);
  if (!site) return;

  (window as any).activeSiteIdForMap = siteId;
  (window as any).activeSiteNameForMap = site.name;
  (window as any).activeSiteViewMode = 'grid';

  container.innerHTML = `
    <div style="display: flex; align-items: center; gap: 1.5rem; margin-bottom: 2rem; max-width: 1600px; margin-left: auto; margin-right: auto; animation: fadeIn 0.4s ease-out;">
      <button onclick="window.navigate('turbines')" class="action-icon-btn" style="width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-main); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
        <i class="fa-solid fa-arrow-left"></i>
      </button>
      <div style="flex: 1;">
        <h2 id="selected-site-title" style="margin: 0; color: var(--text-main); font-size: clamp(1.5rem, 2.5vw, 2.2rem); font-weight: 900; letter-spacing: -1px; text-transform: uppercase;">${site.name.toUpperCase()}</h2>
        <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">Bölgesel Saha Türbin Yönetimi</p>
      </div>
      ${isAdmin ? `<button onclick="window.printSiteTurbineQRs('${siteId}')" class="cyber-button" style="background: rgba(0, 243, 255, 0.1); color: var(--accent-cyan); border: 1px solid var(--accent-cyan); display: flex; align-items: center; gap: 8px; padding: 0.5rem 1rem;">
        <i class="fa-solid fa-print"></i> <span class="hide-mobile">TÜM QR ETİKETLERİ YAZDIR</span>
      </button>` : ''}
    </div>

    <!-- View Mode Toggles for Site -->
    <div style="display: flex; margin-bottom: 1.5rem; max-width: 1600px; margin-left: auto; margin-right: auto;">
      <div class="cyber-toggle-container">
        <button id="site-view-grid" onclick="window.switchSiteViewMode('grid')" class="cyber-toggle-btn active">
          <i class="fa-solid fa-border-all"></i> KART GÖRÜNÜMÜ
        </button>
        <button id="site-view-map" onclick="window.switchSiteViewMode('map')" class="cyber-toggle-btn">
          <i class="fa-solid fa-map-location-dot"></i> HARİTA GÖRÜNÜMÜ
        </button>
      </div>
    </div>

    <div id="turbine-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 0.75rem; max-width: 1600px; margin: 0 auto;">
      <div style="grid-column: 1 / -1; display: flex; justify-content: center; padding: 3rem;"><i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--accent-cyan);"></i></div>
    </div>

    <div id="site-map-container" class="hidden" style="width: 100%; max-width: 1600px; margin: 0 auto 3rem auto; height: 550px; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.2); overflow: hidden; position: relative; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
      <!-- Floating Map Layer Switcher -->
      <div style="position: absolute; top: 12px; right: 12px; z-index: 1000; display: flex; gap: 6px; background: rgba(10, 15, 25, 0.75); padding: 4px; border-radius: 8px; border: 1px solid rgba(0, 243, 255, 0.2); backdrop-filter: blur(10px); box-shadow: 0 4px 15px rgba(0,0,0,0.5);">
        <button id="site-map-layer-dark" onclick="window.switchMapLayer('dark')" class="cyber-map-layer-btn">
          <i class="fa-solid fa-moon"></i> KARANLIK
        </button>
        <button id="site-map-layer-satellite" onclick="window.switchMapLayer('satellite')" class="cyber-map-layer-btn active">
          <i class="fa-solid fa-satellite"></i> UYDU
        </button>
      </div>
      <div id="site-turbines-map" style="width: 100%; height: 100%;"></div>
    </div>
  `;

  const grid = document.getElementById('turbine-grid');
  const title = document.getElementById('selected-site-title');
  
  if (!grid || !title) return;

  try {
    const activeTaskSites = (window as any).activeTaskSites || [];
    if (!isAdmin && !(currentUser?.allowedSites || []).includes(siteId) && !activeTaskSites.includes(siteId)) {
      grid.innerHTML = `<div style="grid-column: 1 / -1; padding: 2rem; color: #ff4444; text-align: center;">Bu sahaya erişim yetkiniz bulunmamaktadır.</div>`;
      return;
    }

    (window as any).turbineGridUnsubscribe = taskService.subscribeTasks((allTasks) => {
      (window as any).latestTurbineTasks = allTasks;
      
      // Ensure we have the current grid element (avoid stale closures after shell re-render)
      const currentGrid = document.getElementById('turbine-grid');
      if (!currentGrid) return;

      // Helper to normalize IDs (e.g., T-01 vs T-1)
      const normalizeId = (id: string | undefined) => {
        if (!id) return "";
        return id.toString().replace(/^T-0?/, 'T').trim().toUpperCase();
      };

      const currentSiteName = site.name.trim().toLowerCase();

      // Filter tasks by this site first
      const siteTasks = allTasks.filter(task => 
        (task.realSiteId === siteId || task.siteId.trim().toLowerCase() === currentSiteName) && 
        task.status !== 'Tamamlandı'
      );
      
      const turbines = dataService.getTurbinesBySite(siteId);

      // --- TURBINE GRID RENDERING ---
      const renderGrid = () => {
        currentGrid.innerHTML = turbines.map(t => {
          const labelText = t.label ? t.label : `T-${t.no.toString().padStart(2, '0')}`;
        const normalizedLabel = normalizeId(labelText);
        const turbineSerial = (t as any).serial || t.id; // Support both properties if they exist
        const normalizedSerial = turbineSerial.toString().trim().toUpperCase();
        
        // Find active fault or maintenance for THIS turbine in THIS site
        const turbineFault = siteTasks.find(task => {
          const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
          const taskTurbineId = normalizeId(task.turbineId);
          
          // Match primarily by SERIAL, secondarily by LABEL
          const isMatch = (taskSerial === normalizedSerial) || (taskTurbineId === normalizedLabel);
          return isMatch && task.secilenSablon === 'Türbin Arıza Formu';
        });
        
        const turbineMaintenance = siteTasks.find(task => {
          const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
          const taskTurbineId = normalizeId(task.turbineId);
          
          const isMatch = (taskSerial === normalizedSerial) || (taskTurbineId === normalizedLabel);
          return isMatch && task.secilenSablon !== 'Türbin Arıza Formu';
        });

        const isFaulty = !!turbineFault;
        const isMaintenance = !!turbineMaintenance;
        
        // Status logic based on manual tasks only
        const status = isFaulty ? 'fault' : (isMaintenance ? 'maintenance' : 'online');
        const color = status === 'fault' ? '#e74c3c' : (status === 'maintenance' ? '#ccff00' : 'var(--accent-cyan)');
        
        const displayStatusLabel = isFaulty ? `${(turbineFault as any).faultCode || 'ARIZA BİLDİRİMİ'}` : 
                                   (isMaintenance ? cleanSablonName((turbineMaintenance as any).secilenSablon).toUpperCase() : 'ONLINE');

        const isPaused = status !== 'online';

        let iconHtml = '';
        
        if (t.label === 'RTU' || t.label === 'FCU' || t.label === 'SAI') {
          const equipIcon = t.label === 'RTU' ? 'fa-microchip' : t.label === 'FCU' ? 'fa-gears' : 'fa-ethernet';
          const equipColor = t.label === 'RTU' ? 'var(--accent-cyan)' : t.label === 'FCU' ? 'var(--accent-orange)' : 'var(--accent-blue)';
          iconHtml = `
            <div style="width: 28px; height: 28px; background: rgba(255,255,255,0.03); border: 1px solid ${equipColor}44; border-radius: 6px; display: flex; align-items: center; justify-content: center; color: ${equipColor}; box-shadow: 0 0 10px ${equipColor}22;">
              <i class="fa-solid ${equipIcon}" style="font-size: 0.8rem;"></i>
            </div>
          `;
        } else {
          iconHtml = `
            <div class="turbine-icon-wrapper no-glow" style="color: ${color}; transform: scale(0.85);">
              <div class="turbine-tower"></div>
              <div class="turbine-head">
                <svg class="turbine-blades-svg ${isPaused ? 'paused' : ''}" viewBox="0 0 100 100">
                  <g transform="translate(50, 50)">
                    <g transform="rotate(0)">
                      <path d="M-2,0 C-2,-10 2,-10 2,0 L1,-38 C1,-40 -1,-40 -1,-38 Z" fill="currentColor" />
                    </g>
                    <g transform="rotate(120)">
                      <path d="M-2,0 C-2,-10 2,-10 2,0 L1,-38 C1,-40 -1,-40 -1,-38 Z" fill="currentColor" />
                    </g>
                    <g transform="rotate(240)">
                      <path d="M-2,0 C-2,-10 2,-10 2,0 L1,-38 C1,-40 -1,-40 -1,-38 Z" fill="currentColor" />
                    </g>
                  </g>
                </svg>
              </div>
            </div>
          `;
        }

        return `
          <div class="turbine-card glass-panel" 
               role="button" 
               tabindex="0"
               data-action="show-details"
               data-id="${t.id}"
               data-label="${labelText}"
               data-site-id="${siteId}"
               data-site-name="${site.name.replace(/'/g, "\\'")}"
               style="border-color: ${color}44; padding: 0.75rem; min-height: 110px; cursor: pointer; transition: all 0.3s; position: relative; overflow: hidden; display: flex; align-items: center; gap: 0.75rem;">
            ${isFaulty ? `<div style="position: absolute; top: 0; left: 0; width: 4px; height: 100%; background: ${color}; box-shadow: 0 0 10px ${color}88;"></div>` : ''}
            
            <div style="flex-shrink: 0; pointer-events: none;">
              ${iconHtml}
            </div>

            <div style="flex: 1; min-width: 0; pointer-events: none;">
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: #fff; letter-spacing: 0.5px; display: flex; justify-content: space-between; margin-bottom: 2px;">
                <span>${labelText}</span>
                <span style="font-size: 0.65rem; color: ${color}; font-weight: 800; opacity: 0.8;">${status.toUpperCase()}</span>
              </div>
              <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${t.id}
              </div>
              <div style="margin-top: 6px; font-size: 0.6rem; font-weight: 700; color: ${color}; letter-spacing: 0.5px;">
                ${displayStatusLabel}
              </div>
            </div>
          </div>
        `;
        }).join('');

        // --- ADD EVENT DELEGATION FOR RELIABILITY ---
        currentGrid.onclick = (e) => {
          const target = (e.target as HTMLElement).closest('.turbine-card') as HTMLElement;
          if (target && target.dataset.action === 'show-details') {
            const { id, label, siteId: sid, siteName: sname } = target.dataset;
            if (id && label && sid && sname) {
              (window as any).showTurbineDetails(id, label, sid, sname);
            }
          }
        };
      };

      // Initial render
      renderGrid();

      // Update turbine map if active
      if ((window as any).activeSiteViewMode === 'map') {
        (window as any).renderSiteTurbinesMap();
      }

      // Auto-open from QR Scanner
      setTimeout(() => {
        const autoOpenId = localStorage.getItem('autoOpenTurbineId');
        if (autoOpenId) {
          const tNode = document.querySelector(`.turbine-card[data-id="${autoOpenId}"]`) as HTMLElement;
          if (tNode) {
            const { id, label, siteId: sid, siteName: sname } = tNode.dataset;
            if (id && label && sid && sname) {
              (window as any).showTurbineDetails(id, label, sid, sname);
            }
          }
          localStorage.removeItem('autoOpenTurbineId');
        }
      }, 100);

    });
  } catch (error) {
    console.error("Error updating turbine grid:", error);
    grid.innerHTML = `<div style="grid-column: 1 / -1; color: var(--accent-red); padding: 2rem; text-align: center;">Veriler yüklenirken bir hata oluştu.</div>`;
  }
};

(window as any).showTurbineDetails = async (turbineId: string, turbineLabel: string, siteId: string, siteName: string) => {
  console.log("Opening details for:", turbineLabel);
  
  const modal = document.getElementById('turbine-modal');
  const title = document.getElementById('modal-turbine-title');
  const loader = document.getElementById('turbine-modal-loading');
  
  if (!modal || !title || !loader) {
    alert("HATA: Modal elemanları bulunamadı! Sayfayı yenileyin.");
    return;
  }

  // Force show modal immediately
  modal.classList.remove('hidden');
  modal.style.display = 'flex';
  modal.style.zIndex = '99999';
  loader.style.display = 'flex';
  
  (window as any).currentActiveTurbineId = turbineId;
  (window as any).currentActiveTurbineLabel = turbineLabel;
  
  title.innerText = `${siteName} — ${turbineLabel}`;
  
  try {
    const allTasks = (window as any).latestTurbineTasks || [];
    console.log(`Filtering ${allTasks.length} tasks for ${turbineLabel} in site ${siteName}`);
    
    const currentSiteNameLower = siteName.trim().toLowerCase();
    
    // Normalize for comparison
    const normLabel = turbineLabel.replace(/^T-0?/, 'T').trim().toUpperCase();
    const normSerial = turbineId.toString().trim().toUpperCase();

    const turbineTasks = allTasks.filter((t: any) => {
      // Sadece bu sahaya ait görevleri al
      const isSiteMatch = t.realSiteId === siteId || (t.siteId && t.siteId.trim().toLowerCase() === currentSiteNameLower) || t.siteName?.trim().toLowerCase() === currentSiteNameLower;
      if (!isSiteMatch) return false;

      const tLabel = (t.turbineId || "").toString().replace(/^T-0?/, 'T').trim().toUpperCase();
      const tSerial = (t.turbinSeriNo || "").toString().trim().toUpperCase();
      return tLabel === normLabel || tSerial === normSerial;
    });
      
    const tasksList = document.getElementById('modal-tasks-list');
    if (tasksList) {
      if (turbineTasks.length === 0) {
        tasksList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
          <i class="fa-solid fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
          Bu türbine ait aktif görev bulunamadı.
        </div>`;
      } else {
        const currentUser = authService.getCurrentUser();
        const isAdmin = currentUser?.email?.toLowerCase().includes('admin') || 
                        currentUser?.email === 'fatih.zebek@demirerholding.com';

        tasksList.innerHTML = turbineTasks.map((t: any) => {
          const isCompleted = t.status === 'Tamamlandı';
          const color = isCompleted ? 'var(--accent-green)' : 'var(--accent-orange)';
          const icon = isCompleted ? 'fa-check-circle' : 'fa-clock';
          const dateStr = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : 'Bilinmeyen Tarih';
          
          const deleteBtn = isAdmin ? `
            <button onclick="event.stopPropagation(); window.deleteTurbineTask('${t.id}')" 
                    style="width: 32px; height: 32px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); border-radius: 8px; color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: all 0.2s; margin-left: 8px;"
                    onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                    onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                    title="Bu iş emrini sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : '';

          const clickAction = isCompleted 
            ? `event.stopPropagation(); window.viewCompletedTaskReport('${t.secilenSablon}', '${dateStr}');`
            : `window.navigate('tasks', ${JSON.stringify(t).replace(/"/g, '&quot;')})`;

          return `
            <div class="task-card glass-panel" onclick="${clickAction}" style="cursor: pointer; padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid ${color}; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
              <div style="flex: 1; min-width: 0;">
                <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                  <i class="fa-solid ${icon}" style="color: ${color}; font-size: 1.1rem;"></i>
                  <span style="font-weight: 700; color: #fff; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(t.rawFaultCode && t.rawFaultCode !== '---') ? t.faultCode : (cleanSablonName(t.secilenSablon) || 'İş Emri')}</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 15px; flex-wrap: wrap;">
                  <span><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i>${dateStr}</span>
                  <span><i class="fa-regular fa-user" style="margin-right: 6px;"></i>${t.personnel ? formatTeamName(t.personnel) : 'Atanmamış'}</span>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                <span style="font-size: 0.7rem; font-weight: 800; color: ${color}; background: ${color}11; padding: 6px 10px; border-radius: 6px; border: 1px solid ${color}33; text-transform: uppercase;">
                  ${t.status}
                </span>
                <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 0.9rem;"></i>
                ${deleteBtn}
              </div>
            </div>
          `;
        }).join('');
      }
    }

      // --- REAL-TIME REPORTS & DEFICIENCIES SUBSCRIPTION ---
      if ((window as any).currentReportsUnsubscribe) {
        (window as any).currentReportsUnsubscribe();
      }
      if ((window as any).currentTasksDeficiencyUnsubscribe) {
        (window as any).currentTasksDeficiencyUnsubscribe();
      }

      let turbineReports: any[] = [];
      let activeTasksForDeficiencies: any[] = [];

      const updateDeficienciesUI = () => {
        const deficienciesList = document.getElementById('modal-deficiencies-list');
        if (!deficienciesList) return;

        let allDeficiencies: any[] = [];

        const activeResolutionIds = new Set<string>();
        const completedResolutionIds = new Set<string>();

        activeTasksForDeficiencies.forEach(t => {
          if (t.resolvedDeficiencyId) activeResolutionIds.add(t.resolvedDeficiencyId);
        });

        turbineReports.forEach(r => {
          if (r.resolvedDeficiencyId) completedResolutionIds.add(r.resolvedDeficiencyId);
        });

        // 1. Collect from submitted reports (Historical)
        turbineReports.forEach(r => {
          if (r.checklist && Array.isArray(r.checklist)) {
            r.checklist.forEach((item: any, index: number) => {
              const deficiencyId = `${r.id}_${item.id}`;
              if ((item.status === 'HATA' || item.status === 'NOT_OK') && !completedResolutionIds.has(deficiencyId) && !activeResolutionIds.has(deficiencyId)) {
                allDeficiencies.push({
                  ...item,
                  reportNo: r.reportNo,
                  reportDate: r.date,
                  reportType: r.type || 'Bakım',
                  team: r.team || 'SİSTEM',
                  isLive: false,
                  deficiencyId,
                  displayId: String(index + 1).padStart(2, '0')
                });
              }
            });
          }
        });

        // Sadece raporlardan gelen eksikler (CANLI BULGULAR kaldırıldı)
        if (allDeficiencies.length === 0) {
          deficienciesList.innerHTML = `
            <div style="padding: 2rem; text-align: center; color: var(--accent-green); background: rgba(46, 204, 113, 0.05); border: 1px dashed rgba(46, 204, 113, 0.2); border-radius: 8px;">
              <i class="fa-solid fa-circle-check" style="font-size: 2rem; margin-bottom: 1rem; display: block;"></i>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 700;">AÇIK BULGU BULUNAMADI</div>
              <p style="font-size: 0.8rem; margin: 0.5rem 0 0; opacity: 0.7;">Bu türbin için tüm bakım maddeleri başarıyla tamamlanmış.</p>
            </div>
          `;
        } else {
          // Sort by state (Live ones first, then by date)
          const sortedDeficiencies = allDeficiencies.sort((a, b) => {
            if (a.isLive && !b.isLive) return -1;
            if (!a.isLive && b.isLive) return 1;
            
            const dateA = new Date(a.reportDate.split('.').reverse().join('-')).getTime();
            const dateB = new Date(b.reportDate.split('.').reverse().join('-')).getTime();
            return dateB - dateA;
          });

          deficienciesList.innerHTML = sortedDeficiencies.map(def => `
            <div style="background: ${def.isLive ? 'rgba(0, 184, 212, 0.03)' : 'rgba(255,23,68,0.03)'}; border-left: 4px solid ${def.isLive ? 'var(--accent-cyan)' : 'var(--accent-red)'}; padding: 1.2rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem;">
                <div style="flex: 1;">
                  <!-- Üst Bilgi Satırı -->
                  <div style="font-family: 'Orbitron', sans-serif; font-size: 0.65rem; letter-spacing: 1.5px; margin-bottom: 8px; display: flex; align-items: center; gap: 8px;">
                    <span style="color: ${def.isLive ? 'var(--accent-cyan)' : 'var(--accent-red)'}; font-weight: 800;">
                      ${def.isLive ? '<i class="fa-solid fa-satellite-dish fa-spin"></i> CANLI BULGU' : '<i class="fa-solid fa-file-invoice"></i> RAPOR EKSİĞİ'}
                    </span>
                    <span style="opacity: 0.2; color: white;">|</span>
                    <span style="color: white; opacity: 0.9; text-transform: uppercase;">${def.reportType}</span>
                    <span style="opacity: 0.2; color: white;">|</span>
                    <span style="color: var(--accent-orange); font-weight: 700;">${def.team}</span>
                  </div>
                  
                  <!-- Ana Başlık Satırı -->
                  <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 700; color: white; line-height: 1.3;">
                    ${def.displayId}. ${def.text}
                    ${def.comment ? `<span style="color: ${def.isLive ? '#99f3ff' : '#ff99aa'}; font-weight: 500; font-style: italic;"> (${def.comment})</span>` : ''}
                  </div>

                  <!-- Aksiyon Butonu -->
                  <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
                      <button onclick="window.handleResolveDeficiency('${encodeURIComponent(JSON.stringify(def))}', '${turbineLabel}', '${turbineId}', '${siteId}', '${siteName}')" 
                              class="cyber-button primary" 
                              style="padding: 0.4rem 1rem; font-size: 0.7rem; background: var(--accent-green); color: black; font-weight: 800; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 15px rgba(0, 230, 118, 0.15);">
                        <i class="fa-solid fa-wrench" style="font-size: 0.7rem;"></i> EKSİK İŞ (GÖREV OLUŞTUR)
                      </button>
                  </div>
                </div>
                
                <div style="text-align: right; margin-left: 20px;">
                  <div style="font-size: 0.75rem; color: white; font-weight: 600; opacity: 0.8;">${def.reportDate}</div>
                  <div style="font-size: 0.6rem; color: var(--accent-cyan); font-family: monospace; letter-spacing: 0.5px; margin-top: 4px;">${def.reportNo}</div>
                </div>
              </div>
            </div>
          `).join('');
        }
      };

      (window as any).currentReportsUnsubscribe = serviceReportService.subscribeReportsBySite(siteId, (allReports) => {
        const normLabel = turbineLabel.replace(/^T-0?/, 'T').trim().toUpperCase();
        turbineReports = allReports.filter(r => {
          const isSerialMatch = r.turbineSerial && r.turbineSerial.toString() === turbineId.toString();
          const rNorm = (r.turbineNo || "").toString().replace(/^T-0?/, 'T').trim().toUpperCase();
          return isSerialMatch || rNorm === normLabel;
        });
        (window as any).currentTurbineReports = turbineReports;
        
        const reportsList = document.getElementById('modal-reports-list');
        const materialsList = document.getElementById('modal-materials-list');
        
        let allMaterials: any[] = [];

        if (reportsList) {
          const pdfReports = turbineReports.filter(r => !r.reportNo?.startsWith('MAN-'));
          if (pdfReports.length === 0) {
            reportsList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 4px;">Bu türbine ait PDF rapor bulunamadı.</div>`;
          } else {
            reportsList.innerHTML = pdfReports.map(r => {
              if (r.materials && Array.isArray(r.materials)) {
                r.materials.forEach((m: any, mIndex: number) => {
                  const usedQty = Number(m.used || 0);
                  if (usedQty > 0) {
                    allMaterials.push({
                      ...m,
                      reportId: r.id,
                      materialIndex: mIndex,
                      reportDate: r.date,
                      reportNo: r.reportNo,
                      matFormNo: r.matFormNo || '-'
                    });
                  }
                });
              }
              
              const currentUser = authService.getCurrentUser();
              const isAdmin = currentUser?.email?.toLowerCase().includes('admin') || 
                              currentUser?.email === 'fatih.zebek@demirerholding.com';

              const reportDeleteBtn = isAdmin ? `
                <button onclick="event.stopPropagation(); window.deleteTurbineReport('${r.id}', '${r.reportNo}')" 
                        style="width: 30px; height: 30px; background: rgba(255, 77, 77, 0.06); border: 1px solid rgba(255, 77, 77, 0.12); border-radius: 8px; color: rgba(255, 77, 77, 0.5); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; transition: all 0.2s; flex-shrink: 0;"
                        onmouseover="this.style.background='rgba(255,77,77,0.15)'; this.style.color='#ff4d4d'; this.style.borderColor='rgba(255,77,77,0.4)'"
                        onmouseout="this.style.background='rgba(255,77,77,0.06)'; this.style.color='rgba(255,77,77,0.5)'; this.style.borderColor='rgba(255,77,77,0.12)'"
                        title="Bu raporu sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : '';
              
              return `
                <div style="background: rgba(255,255,255,0.02); border-left: 3px solid var(--accent-cyan); padding: 1rem; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                  <div style="flex: 1; min-width: 0;">
                    <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem;">Rapor No: ${r.reportNo}</div>
                    <div style="font-size: 0.75rem; color: var(--text-muted);">Tarih: ${r.date} | Arıza: ${r.faultDesc || r.faultCode}</div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                    <button onclick="window.viewTurbinePdf('${r.id}', '${r.reportNo}')" 
                            class="btn-cyber-outline" 
                            style="padding: 0 10px; font-size: 0.7rem; border-radius: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 700; height: 30px; display: inline-flex; align-items: center; gap: 6px; letter-spacing: 0.5px; border: 1px solid rgba(0, 242, 254, 0.35); background: rgba(0, 242, 254, 0.05); color: var(--accent-cyan); cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.background='rgba(0, 242, 254, 0.15)'; this.style.borderColor='rgba(0, 242, 254, 0.65)'; this.style.boxShadow='0 0 12px rgba(0, 242, 254, 0.25)'"
                            onmouseout="this.style.background='rgba(0, 242, 254, 0.05)'; this.style.borderColor='rgba(0, 242, 254, 0.35)'; this.style.boxShadow='none'">
                      <i class="fa-solid fa-file-invoice" style="font-size: 0.75rem;"></i> RAPORU GÖSTER
                    </button>
                    ${reportDeleteBtn}
                  </div>
                </div>
              `;
            }).join('');
          }
        }

        if (materialsList) {
          if (allMaterials.length === 0) {
            materialsList.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 1rem;">Geçmiş raporlarda malzeme kullanımı bulunamadı.</td></tr>`;
          } else {
            const currentUser = authService.getCurrentUser();
            const isAdmin = currentUser?.email?.toLowerCase().includes('admin') || 
                            currentUser?.email === 'fatih.zebek@demirerholding.com';

            materialsList.innerHTML = allMaterials.map(m => `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                <td style="color: var(--text-muted); padding: 0.75rem 0.5rem; vertical-align: middle; font-size: 0.8rem; white-space: nowrap;">${m.reportDate}</td>
                <td style="padding: 0.75rem 0.5rem; vertical-align: middle;">
                  <div style="color: var(--accent-cyan); font-weight: 600; font-family: monospace; font-size: 0.85rem; word-break: break-all;">${m.reportNo}</div>
                  <div style="font-size: 0.7rem; color: #F59E0B; margin-top: 2px; font-weight: bold;">MÇF: ${m.matFormNo || '-'}</div>
                </td>
                <td style="padding: 0.75rem 0.5rem; vertical-align: middle;">
                  <div style="font-family: monospace; font-weight: 700; color: #fff; font-size: 0.85rem;">${m.sapNo || '-'}</div>
                  ${(m.serialNo || m.serial) ? `<div style="font-size: 0.7rem; color: #10B981; margin-top: 2px; font-weight: bold; font-family: monospace; word-break: break-all;">S/N: ${m.serialNo || m.serial}</div>` : ''}
                </td>
                <td style="padding: 0.75rem 0.5rem; vertical-align: middle; font-size: 0.85rem; color: #E2E8F0; line-height: 1.4;">${m.description || m.type || '-'}</td>
                <td style="padding: 0.75rem 0.5rem; vertical-align: middle; text-align: center;">
                  <div style="font-weight: 700; color: var(--accent-orange); font-size: 0.85rem; display: flex; flex-direction: column; align-items: center; gap: 4px; justify-content: center;">
                    <span>${m.used || m.received || 0} Adet</span>
                    ${isAdmin ? `<button onclick="window.deleteMaterialFromReport('${m.reportId}', ${m.materialIndex})" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); border-radius: 6px; color: var(--accent-red); cursor: pointer; padding: 3px 8px; font-size: 0.75rem; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px;" title="Bu malzemeyi rapordan sil"><i class="fa-solid fa-trash-can"></i> Sil</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join('');
          }
        }

        updateDeficienciesUI();
      });

      (window as any).currentTasksDeficiencyUnsubscribe = taskService.subscribeTasks((allTasks) => {
        const normLabel = turbineLabel.replace(/^T-0?/, 'T').trim().toUpperCase();
        const currentSiteNameLower = siteName.trim().toLowerCase();
        const normSerial = turbineId.toString().trim().toUpperCase();
        
        activeTasksForDeficiencies = allTasks.filter(t => {
          const isSiteMatch = t.realSiteId === siteId || (t.siteId && t.siteId.trim().toLowerCase() === currentSiteNameLower) || (t as any).siteName?.trim().toLowerCase() === currentSiteNameLower;
          if (!isSiteMatch) return false;

          const tNorm = (t.turbineId || "").toString().replace(/^T-0?/, 'T').trim().toUpperCase();
          const isSerialMatch = t.turbinSeriNo && t.turbinSeriNo.toString() === turbineId.toString();
          return isSerialMatch || tNorm === normLabel;
        });
        updateDeficienciesUI();

        // Update the tasks list dynamically
        const tasksList = document.getElementById('modal-tasks-list');
        if (tasksList) {
          if (activeTasksForDeficiencies.length === 0) {
            tasksList.innerHTML = `<div style="padding: 2rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
              <i class="fa-solid fa-folder-open" style="font-size: 2rem; display: block; margin-bottom: 1rem; opacity: 0.3;"></i>
              Bu türbine ait aktif görev bulunamadı.
            </div>`;
          } else {
            const currentUser = authService.getCurrentUser();
            const isAdmin = currentUser?.email?.toLowerCase().includes('admin') || 
                            currentUser?.email === 'fatih.zebek@demirerholding.com';

            tasksList.innerHTML = activeTasksForDeficiencies.map((t: any) => {
              const isCompleted = t.status === 'Tamamlandı';
              const color = isCompleted ? 'var(--accent-green)' : 'var(--accent-orange)';
              const icon = isCompleted ? 'fa-check-circle' : 'fa-clock';
              const dateStr = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : 'Bilinmeyen Tarih';
              
              const deleteBtn = isAdmin ? `
                <button onclick="event.stopPropagation(); window.deleteTurbineTask('${t.id}')" 
                        style="width: 32px; height: 32px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); border-radius: 8px; color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; transition: all 0.2s; margin-left: 8px;"
                        onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                        onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                        title="Bu iş emrini sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : '';

              const clickAction = isCompleted 
                ? `event.stopPropagation(); window.viewCompletedTaskReport('${t.secilenSablon}', '${dateStr}');`
                : `window.navigate('tasks', ${JSON.stringify(t).replace(/"/g, '&quot;')})`;

              return `
                <div class="task-card glass-panel" onclick="${clickAction}" style="cursor: pointer; padding: 1.25rem; margin-bottom: 1rem; border-left: 4px solid ${color}; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
                  <div style="flex: 1; min-width: 0;">
                    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 6px;">
                      <i class="fa-solid ${icon}" style="color: ${color}; font-size: 1.1rem;"></i>
                      <span style="font-weight: 700; color: #fff; font-size: 1rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${(t.rawFaultCode && t.rawFaultCode !== '---') ? t.faultCode : (cleanSablonName(t.secilenSablon) || 'İş Emri')}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 15px; flex-wrap: wrap;">
                      <span><i class="fa-regular fa-calendar" style="margin-right: 6px;"></i>${dateStr}</span>
                      <span><i class="fa-regular fa-user" style="margin-right: 6px;"></i>${t.personnel ? formatTeamName(t.personnel) : 'Atanmamış'}</span>
                    </div>
                  </div>
                  <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                    <span style="font-size: 0.7rem; font-weight: 800; color: ${color}; background: ${color}11; padding: 6px 10px; border-radius: 6px; border: 1px solid ${color}33; text-transform: uppercase;">
                      ${t.status}
                    </span>
                    <i class="fa-solid fa-chevron-right" style="color: rgba(255,255,255,0.2); font-size: 0.9rem;"></i>
                    ${deleteBtn}
                  </div>
                </div>
              `;
            }).join('');
          }
        }
      });


      // Reset and load notes tab
      const notesTab = document.getElementById('tab-notes');
      if (notesTab) {
        // --- REAL-TIME NOTES SUBSCRIPTION ---
        if ((window as any).currentNoteUnsubscribe) {
          (window as any).currentNoteUnsubscribe();
        }
        
        (window as any).currentNoteUnsubscribe = turbineNoteService.subscribeNotes(turbineId, (notes) => {
          (window as any).renderTurbineNotes(notes);
        });
      }

    } catch (err) {
      console.error("Türbin detayları yüklenirken hata:", err);
    } finally {
      loader.style.display = 'none';
      (window as any).switchTurbineTab('tasks');
    }
};

(window as any).closeTurbineDetails = () => {
  const modal = document.getElementById('turbine-modal');
  if (modal) {
    modal.classList.add('hidden');
    modal.style.display = 'none';
  }
  
  // Cleanup subscriptions
  if ((window as any).currentNoteUnsubscribe) {
    (window as any).currentNoteUnsubscribe();
    (window as any).currentNoteUnsubscribe = null;
  }

  if ((window as any).currentReportsUnsubscribe) {
    (window as any).currentReportsUnsubscribe();
    (window as any).currentReportsUnsubscribe = null;
  }

  if ((window as any).currentTasksDeficiencyUnsubscribe) {
    (window as any).currentTasksDeficiencyUnsubscribe();
    (window as any).currentTasksDeficiencyUnsubscribe = null;
  }

  (window as any).closeTurbinePdf();
};

(window as any).switchTurbineTab = (tabName: 'tasks' | 'materials' | 'reports' | 'notes' | 'deficiencies') => {
  document.querySelectorAll('.turbine-tab-btn').forEach(btn => {
    btn.classList.remove('active');
    (btn as HTMLElement).style.borderBottomColor = 'transparent';
    (btn as HTMLElement).style.color = 'var(--text-muted)';
  });
  
  const activeBtn = document.querySelector(`.turbine-tab-btn[onclick="window.switchTurbineTab('${tabName}')"]`) as HTMLElement;
  if (activeBtn) {
    activeBtn.classList.add('active');
    activeBtn.style.borderBottomColor = 'var(--accent-cyan)';
    activeBtn.style.color = 'var(--accent-cyan)';
  }

  document.querySelectorAll('.turbine-tab-content').forEach(content => {
    content.classList.add('hidden');
  });
  
  const activeContent = document.getElementById(`tab-${tabName}`);
  if (activeContent) {
    activeContent.classList.remove('hidden');
  }
};

(window as any).viewTurbinePdf = async (reportId: string, reportNo: string) => {
  const listContainer = document.getElementById('reports-list-container');
  const viewerContainer = document.getElementById('pdf-viewer-container');
  const viewerContent = document.getElementById('pdf-iframe');
  const title = document.getElementById('pdf-viewer-title');
  
  if (listContainer && viewerContainer && viewerContent && title) {
    try {
      title.innerText = `Rapor: ${reportNo}`;
      viewerContent.innerHTML = `<div style="text-align: center; padding: 3rem; color: var(--accent-cyan);"><i class="fa-solid fa-spinner fa-spin fa-3x"></i><p style="margin-top: 1rem; font-weight: 700;">Rapor Oluşturuluyor...</p></div>`;
      
      listContainer.classList.add('hidden');
      viewerContainer.classList.remove('hidden');

      const { serviceReportService } = await import('../services/ServiceReportService');
      const report = await serviceReportService.getReportByNo(reportNo);
      
      if (report) {
          const { renderReportPDF } = await import('../components/ReportTemplate');
          const htmlContent = renderReportPDF(report);
          viewerContent.innerHTML = htmlContent;
      } else {
          viewerContent.innerHTML = `<div style="text-align: center; color: red;">Rapor bulunamadı.</div>`;
      }
    } catch(err) {
      viewerContent.innerHTML = `<div style="text-align: center; color: red;">Hata: ${err}</div>`;
    }
  }
};

(window as any).closeTurbinePdf = () => {
  const listContainer = document.getElementById('reports-list-container');
  const viewerContainer = document.getElementById('pdf-viewer-container');
  const viewerContent = document.getElementById('pdf-iframe');
  
  if (listContainer && viewerContainer && viewerContent) {
    viewerContent.innerHTML = '';
    viewerContainer.classList.add('hidden');
    listContainer.classList.remove('hidden');
  }
};

(window as any).handleResolveDeficiency = async (defStr: string, tNo: string, tSerial: string, siteId: string, siteName: string) => {
  const def = JSON.parse(decodeURIComponent(defStr));
  
  if (!confirm(`"${def.displayId || def.id}. ${def.text}" maddesi için otomatik eksik giderme görevi başlatılacak. Onaylıyor musunuz?`)) {
    return;
  }

  try {
    const taskData = {
      secilenSablon: 'Eksik İş Görev Tamamlama',
      sahaBilgisi: siteName,
      siteId: siteId,
      turbinSeriNo: tSerial,
      turbinNo: tNo,
      yoneticiNotu: `EKSİKLİK GİDERME GÖREVİ:\n${def.reportType} raporunda (No: ${def.reportNo}) tespit edilen "${def.displayId || def.id}. ${def.text}" maddesi için otomatik oluşturuldu.\nSahadaki Not: ${def.comment || 'Yok'}`,
      assignedTeam: def.team && def.team !== 'SİSTEM' ? def.team : 'Atanmamış',
      resolvedDeficiencyId: def.deficiencyId,
      status: 'İşlemde' // Kullanıcının isteği üzerine işlemi başlatır
    };

    const result = await taskService.createNewTask(taskData);
    if (result.success) {
      if ((window as any).showToast) {
        (window as any).showToast('GÖREV BAŞLATILDI', 'Eksik giderme görevi başarıyla oluşturuldu ve işleme alındı.', 'success');
      } else {
        alert('Eksik giderme görevi başarıyla oluşturuldu ve işleme alındı.');
      }
    }
  } catch (err) {
    console.error("Görev oluşturma hatası:", err);
    alert("Görev oluşturulurken bir hata oluştu.");
  }
};

(window as any).renderTurbineNotes = (notes: any[]) => {
  const list = document.getElementById('modal-notes-list');
  if (list) {
    if (notes.length === 0) {
      list.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-muted); display: flex; flex-direction: column; align-items: center; gap: 1rem;">
        <i class="fa-solid fa-note-sticky fa-3x" style="opacity: 0.2;"></i>
        Henüz not eklenmemiş.
      </div>`;
      return;
    }

    const currentUser = authService.getCurrentUser();
    const isAdmin = currentUser?.email?.toLowerCase().includes('admin') || 
                    currentUser?.email === 'fatih.zebek@demirerholding.com';

    list.innerHTML = notes.map(n => {
      const deleteBtn = isAdmin ? `
        <button onclick="window.deleteTurbineNote('${n.id}')" 
                style="background: none; border: none; outline: none; box-shadow: none; color: rgba(255,255,255,0.25); cursor: pointer; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 6px; transition: all 0.2s; flex-shrink: 0;"
                onmouseover="this.style.color='#ff4d4d'; this.style.background='rgba(255,77,77,0.1)';" 
                onmouseout="this.style.color='rgba(255,255,255,0.25)'; this.style.background='none';"
                title="Notu Sil">
          <i class="fa-solid fa-trash-can" style="font-size: 0.85rem;"></i>
        </button>
      ` : '';

      return `
        <div class="note-item cyber-notebook" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.1); border-left: 4px solid ${n.isCompleted ? '#2ecc71' : 'var(--accent-cyan)'}; padding: 1.2rem; border-radius: 12px; display: flex; flex-direction: column; gap: 1rem; transition: all 0.3s; position: relative; backdrop-filter: blur(15px); box-shadow: 0 10px 30px rgba(0,0,0,0.2);">
          <div style="display: flex; align-items: flex-start; gap: 1rem;">
            <div class="custom-checkbox ${n.isCompleted ? 'checked' : ''}" onclick="window.toggleTurbineNote('${n.id}', ${!n.isCompleted})" style="cursor: pointer; width: 24px; height: 24px; border: 2px solid ${n.isCompleted ? '#2ecc71' : 'rgba(255,255,255,0.2)'}; border-radius: 6px; display: flex; align-items: center; justify-content: center; transition: all 0.2s; background: ${n.isCompleted ? '#2ecc7122' : 'transparent'}; color: ${n.isCompleted ? '#2ecc71' : 'white'};">
              ${n.isCompleted ? '<i class="fa-solid fa-check" style="font-size: 0.9rem;"></i>' : ''}
            </div>
            <div style="flex: 1; ${n.isCompleted ? 'text-decoration: line-through; opacity: 0.4;' : ''}">
              <div style="font-size: 1rem; line-height: 1.6; color: #fff; font-weight: 300; font-family: 'Inter', sans-serif;">${n.content}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 10px; display: flex; align-items: center; gap: 0.8rem; font-family: 'Rajdhani', sans-serif;">
                <span style="color: var(--accent-cyan); display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-user-astronaut"></i> ${n.createdBy}</span>
                <span style="opacity: 0.3;">|</span>
                <span style="display: flex; align-items: center; gap: 0.4rem;"><i class="fa-solid fa-clock"></i> ${n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString('tr-TR') : 'Şimdi'}</span>
              </div>
            </div>
            ${deleteBtn}
          </div>
          ${n.imageUrl ? `
            <div style="margin-left: 2.5rem; border-radius: 10px; overflow: hidden; max-width: 350px; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 5px 15px rgba(0,0,0,0.3);">
              <img src="${n.imageUrl}" onclick="window.open(this.src)" style="width: 100%; display: block; cursor: pointer; transition: transform 0.4s ease-out;" onmouseover="this.style.transform='scale(1.08)'" onmouseout="this.style.transform='scale(1)'">
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }
};

(window as any).handleNoteImageSelect = (input: HTMLInputElement) => {
  const file = input.files?.[0];
  const previewContainer = document.getElementById('note-image-preview-container');
  const previewImg = document.getElementById('note-image-preview') as HTMLImageElement;
  
  if (file && previewContainer && previewImg) {
    const reader = new FileReader();
    reader.onload = (e) => {
      previewImg.src = e.target?.result as string;
      previewContainer.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  }
};

(window as any).clearNoteImage = () => {
  const input = document.getElementById('note-image-input') as HTMLInputElement;
  const previewContainer = document.getElementById('note-image-preview-container');
  if (input) input.value = '';
  if (previewContainer) previewContainer.classList.add('hidden');
};

(window as any).addTurbineNote = async () => {
  const input = document.getElementById('new-turbine-note-input') as HTMLInputElement;
  const imageInput = document.getElementById('note-image-input') as HTMLInputElement;
  const addBtn = document.getElementById('add-note-btn') as HTMLButtonElement;
  
  const content = input?.value.trim();
  const turbineId = (window as any).currentActiveTurbineId;
  const user = authService.getCurrentUser();

  if (!content && !imageInput?.files?.[0]) return;
  if (!turbineId || !user) return;

  try {
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i>';
    }

    let imageUrl = '';
    if (imageInput?.files?.[0]) {
      const file = imageInput.files[0];
      const path = `turbine_notes/${turbineId}/${Date.now()}_${file.name}`;
      imageUrl = await fileService.uploadImage(file, path);
    }

    await turbineNoteService.addNote(turbineId, content || 'Resim eklendi', user.displayName || user.email || 'Anonim', imageUrl);
    
    input.value = '';
    (window as any).clearNoteImage();
  } catch (err: any) {
    console.error("Note Add Error:", err);
    alert("Not eklenirken bir hata oluştu: " + (err.message || "Bilinmeyen hata"));
  } finally {
    if (addBtn) {
      addBtn.disabled = false;
      addBtn.innerHTML = '<i class="fa-solid fa-plus"></i> EKLE';
    }
  }
};

(window as any).toggleTurbineNote = async (noteId: string, isCompleted: boolean) => {
  try {
    await turbineNoteService.toggleNote(noteId, isCompleted);
    // Auto-update via subscription
  } catch (err) {
    console.error(err);
  }
};

(window as any).deleteTurbineNote = async (noteId: string) => {
  const user = authService.getCurrentUser();
  const isAdmin = user?.email?.toLowerCase().includes('admin') || 
                  user?.email === 'fatih.zebek@demirerholding.com';
  
  if (!isAdmin) {
    alert('Bu işlem için yetkiniz bulunmamaktadır.');
    return;
  }

  if (confirm('Bu notu silmek istediğinize emin misiniz?')) {
    try {
      const userName = user?.displayName || user?.email || 'Anonim';
      await turbineNoteService.deleteNote(noteId, userName);
      // Auto-update via subscription
    } catch (err) {
      console.error(err);
      alert("Not silinirken bir hata oluştu.");
    }
  }
};

(window as any).deleteTurbineTask = async (taskId: string, taskName: string) => {
  const user = authService.getCurrentUser();
  const isAdmin = user?.email?.toLowerCase().includes('admin') || 
                  user?.email === 'fatih.zebek@demirerholding.com';
  
  if (!isAdmin) {
    alert('Bu işlem için yetkiniz bulunmamaktadır.');
    return;
  }

  if (!confirm(`"${taskName}" görevini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) return;

  try {
    await taskService.deleteTask(taskId);
    
    // Refresh the current turbine modal view
    const turbineId = (window as any).currentActiveTurbineId;
    const turbineLabel = (window as any).currentActiveTurbineLabel;
    if (turbineId && turbineLabel) {
      // Re-fetch and re-render tasks list
      const allTasks = await taskService.getTasks();
      const turbineTasks = allTasks.filter(t => t.turbineId === turbineLabel || t.turbinSeriNo === turbineId);
      
      const tasksList = document.getElementById('modal-tasks-list');
      if (tasksList) {
        if (turbineTasks.length === 0) {
          tasksList.innerHTML = `<div style="padding: 1rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.02); border-radius: 4px;">Bu türbine ait görev bulunamadı.</div>`;
        } else {
          tasksList.innerHTML = turbineTasks.map(t => {
            const isCompleted = t.status === 'Tamamlandı';
            const color = isCompleted ? 'var(--accent-green)' : 'var(--accent-orange)';
            const icon = isCompleted ? 'fa-check-circle' : 'fa-clock';
            const dateStr = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : 'Bilinmeyen Tarih';
            
            const deleteBtn = `
              <button onclick="event.stopPropagation(); window.deleteTurbineTask('${t.id}', '${(t.secilenSablon || 'İş Emri').replace(/'/g, "\\'")}')" 
                      style="width: 32px; height: 32px; background: rgba(255, 77, 77, 0.06); border: 1px solid rgba(255, 77, 77, 0.12); border-radius: 8px; color: rgba(255, 77, 77, 0.5); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; transition: all 0.2s; flex-shrink: 0;"
                      onmouseover="this.style.background='rgba(255,77,77,0.15)'; this.style.color='#ff4d4d'; this.style.borderColor='rgba(255,77,77,0.4)'"
                      onmouseout="this.style.background='rgba(255,77,77,0.06)'; this.style.color='rgba(255,77,77,0.5)'; this.style.borderColor='rgba(255,77,77,0.12)'"
                      title="Bu görevi sil">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            `;

            return `
              <div class="task-card-premium">
                <div style="flex: 1; min-width: 0;">
                  <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 700; color: var(--accent-cyan); margin-bottom: 0.25rem;">${(t.rawFaultCode && t.rawFaultCode !== '---') ? t.faultCode : (cleanSablonName(t.secilenSablon) || 'İş Emri')}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${t.faultCode} | Personel: ${t.personnel} | Tarih: ${dateStr}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
                  <div class="status-badge-mini" style="background: ${isCompleted ? 'rgba(46, 204, 113, 0.1)' : 'rgba(243, 156, 18, 0.1)'}; color: ${color}; border: 1px solid ${color}33;">
                    <i class="fa-solid ${icon}"></i> ${t.status}
                  </div>
                  ${deleteBtn}
                </div>
              </div>
            `;
          }).join('');
        }
      }
    }
  } catch (err) {
    console.error("Görev silme hatası:", err);
    alert("Görev silinirken bir hata oluştu.");
  }
};

(window as any).deleteTurbineTask = async (taskId: string) => {
  const user = authService.getCurrentUser();
  const isAdmin = user?.email?.toLowerCase().includes('admin') || 
                  user?.email === 'fatih.zebek@demirerholding.com';
  
  if (!isAdmin) {
    alert('Bu işlem için yetkiniz bulunmamaktadır.');
    return;
  }

  if (confirm('Bu iş emrini (ve varsa test verilerini) silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) {
    try {
      await taskService.deleteTask(taskId);
      if((window as any).showToast) (window as any).showToast('SİLİNDİ', 'İş emri başarıyla silindi.', 'success');
      // Tablo otomatik güncellenecek (subscribeTasks)
    } catch (err: any) {
      console.error("Task deletion failed:", err);
      alert('İş emri silinirken bir hata oluştu: ' + err.message);
    }
  }
};

(window as any).deleteMaterialFromReport = async (reportId: string, materialIndex: number) => {
  const user = authService.getCurrentUser();
  const isAdmin = user?.email?.toLowerCase().includes('admin') || 
                  user?.email === 'fatih.zebek@demirerholding.com';
  
  if (!isAdmin) {
    alert('Bu işlem için yetkiniz bulunmamaktadır.');
    return;
  }

  if (confirm('Bu malzemeyi rapordan tamamen silmek istediğinize emin misiniz? (Stok etkilenmez, sadece rapor güncellenir)')) {
    try {
      const reports = (window as any).currentTurbineReports || [];
      const report = reports.find((r: any) => r.id === reportId);
      
      if (!report || !report.materials) {
        alert('Rapor veya malzeme bulunamadı.');
        return;
      }

      const newMaterials = [...report.materials];
      newMaterials.splice(materialIndex, 1);

      await serviceReportService.updateReport(reportId, { materials: newMaterials }, []);
      
      if((window as any).showToast) (window as any).showToast('SİLİNDİ', 'Malzeme rapordan başarıyla çıkarıldı.', 'success');
    } catch (err: any) {
      console.error("Material deletion failed:", err);
      alert('Malzeme silinirken bir hata oluştu: ' + err.message);
    }
  }
};

(window as any).viewCompletedTaskReport = (templateName: string, dateStr: string) => {
  const reports = (window as any).currentTurbineReports || [];
  
  // Try to find matching report
  const match = reports.find((r: any) => {
    const nameMatch = r.templateName === templateName || r.faultCode === templateName || r.type === 'BAKIM';
    const rDateStr = r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString('tr-TR') : r.date;
    const dateMatch = rDateStr === dateStr;
    return nameMatch && dateMatch;
  });

  if (match) {
    (window as any).switchTurbineTab('reports');
    (window as any).viewTurbinePdf(match.id, match.reportNo);
    return;
  }

  // Fallback
  (window as any).switchTurbineTab('reports');
  if((window as any).showToast) (window as any).showToast('BİLGİ', 'Göreve ait rapor Arşiv sekmesinde listelenmektedir.', 'info');
};

(window as any).deleteTurbineReport = async (reportId: string, reportNo: string) => {
  const user = authService.getCurrentUser();
  const isAdmin = user?.email?.toLowerCase().includes('admin') || 
                  user?.email === 'fatih.zebek@demirerholding.com';
  
  if (!isAdmin) {
    alert('Bu işlem için yetkiniz bulunmamaktadır.');
    return;
  }

  if (!confirm(`"${reportNo}" numaralı raporu silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz.`)) return;

  try {
    await serviceReportService.deleteReport(reportId);
    // List auto-refreshes via the existing subscription (subscribeReportsBySite)
  } catch (err) {
    console.error("Rapor silme hatası:", err);
    alert("Rapor silinirken bir hata oluştu.");
  }
};

(window as any).printSiteTurbineQRs = async (siteId: string) => {
  const { dataService } = await import('../services/DataService');
  const { qrService } = await import('../services/QRService');
  
  const site = dataService.getSites().find((s: any) => s.id === siteId);
  if (!site) {
    alert("Saha bulunamadı.");
    return;
  }
  
  const turbines = dataService.getTurbinesBySite(siteId);
  if (!turbines || turbines.length === 0) {
    alert("Bu sahaya ait türbin bulunamadı.");
    return;
  }
  
  const items = turbines.map(t => {
    const turbineNo = t.label ? t.label : `T-${t.no.toString().padStart(2, '0')}`;
    // If we have a serial, encode it directly. Otherwise use siteId fallback.
    const qrPayload = t.id ? `turbine:${t.id}` : `turbine:${site.id}:${turbineNo}`;
    return {
      id: qrPayload,
      sapNo: turbineNo,
      description: site.name.toUpperCase()
    };
  });
  
  await qrService.printBulkLabels(items);
};

// --- MAP VIEWS AND TOGGLE LOGIC ---

(window as any).switchViewMode = (mode: 'grid' | 'map') => {
  const gridEl = document.getElementById('sites-grid');
  const mapContainer = document.getElementById('sites-map-container');
  const btnGrid = document.getElementById('view-mode-grid');
  const btnMap = document.getElementById('view-mode-map');
  
  if (!gridEl || !mapContainer || !btnGrid || !btnMap) return;

  if (mode === 'grid') {
    gridEl.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    btnGrid.classList.add('active');
    btnMap.classList.remove('active');
  } else {
    gridEl.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    btnGrid.classList.remove('active');
    btnMap.classList.add('active');
    
    // Initialize map
    (window as any).initSitesMap();
  }
};

(window as any).initSitesMap = () => {
  if ((window as any).sitesMapInstance) {
    try {
      (window as any).sitesMapInstance.remove();
    } catch (e) {
      console.error("Error removing old map instance:", e);
    }
    (window as any).sitesMapInstance = null;
  }

  const L = (window as any).L;
  if (!L) {
    console.error("Leaflet is not loaded.");
    return;
  }

  // Create map instance centered on Turkey
  const map = L.map('sites-map', {
    zoomControl: true,
    attributionControl: false
  }).setView([39.0, 35.0], 6);

  (window as any).sitesMapInstance = map;

  L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  const bounds: any[] = [];
  const allSites = dataService.getSites() || [];
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const activeTaskSites = (window as any).activeTaskSites || [];
  const allowedSites = isAdmin 
    ? allSites 
    : allSites.filter(s => (currentUser?.allowedSites || []).includes(s.id) || activeTaskSites.includes(s.id));

  const siteTasks = (window as any).latestTurbineTasks || [];

  allowedSites.forEach((site: any) => {
    const turbines = dataService.getTurbinesBySite(site.id);
    const validTurbines = turbines.filter((t: any) => t.latitude && t.longitude);
    if (validTurbines.length === 0) return;

    const sumLat = validTurbines.reduce((sum: number, t: any) => sum + t.latitude, 0);
    const sumLng = validTurbines.reduce((sum: number, t: any) => sum + t.longitude, 0);
    const centerLat = sumLat / validTurbines.length;
    const centerLng = sumLng / validTurbines.length;
    const center = [centerLat, centerLng];
    bounds.push(center);

    const siteTasksFiltered = siteTasks.filter((task: any) => 
      (task.realSiteId === site.id || task.siteId.trim().toLowerCase() === site.name.trim().toLowerCase()) && 
      task.status !== 'Tamamlandı'
    );

    let faultyCount = 0;
    let maintCount = 0;

    turbines.forEach((t: any) => {
      const isFaulty = siteTasksFiltered.some((task: any) => {
        const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
        const taskTurbineId = task.turbineId?.toString().replace(/^T-0?/, 'T').trim().toUpperCase();
        const tLabel = t.label ? t.label : `T-${t.no.toString().padStart(2, '0')}`;
        const normalizedLabel = tLabel.replace(/^T-0?/, 'T').trim().toUpperCase();
        const normalizedSerial = t.id.toString().trim().toUpperCase();
        return (taskSerial === normalizedSerial || taskTurbineId === normalizedLabel) && task.secilenSablon === 'Türbin Arıza Formu';
      });
      const isMaint = siteTasksFiltered.some((task: any) => {
        const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
        const taskTurbineId = task.turbineId?.toString().replace(/^T-0?/, 'T').trim().toUpperCase();
        const tLabel = t.label ? t.label : `T-${t.no.toString().padStart(2, '0')}`;
        const normalizedLabel = tLabel.replace(/^T-0?/, 'T').trim().toUpperCase();
        const normalizedSerial = t.id.toString().trim().toUpperCase();
        return (taskSerial === normalizedSerial || taskTurbineId === normalizedLabel) && task.secilenSablon !== 'Türbin Arıza Formu';
      });

      if (isFaulty) faultyCount++;
      else if (isMaint) maintCount++;
    });

    let markerColor = '#00f2ff';
    if (faultyCount > 0) markerColor = '#ff4d4d';
    else if (maintCount > 0) markerColor = '#ccff00';

    const markerIcon = L.divIcon({
      className: 'custom-leaflet-marker-with-label',
      html: `
        <div style="display: flex; align-items: center; gap: 8px; position: relative;">
          <div class="cyber-pulse-marker" style="border-color: ${markerColor}; background: ${markerColor}33; box-shadow: 0 0 10px ${markerColor}; flex-shrink: 0; width: 14px; height: 14px;"></div>
          <span class="cyber-marker-label" style="color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; font-weight: 800; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8); background: rgba(10, 15, 25, 0.65); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap; pointer-events: none;">${site.name.toUpperCase()}</span>
        </div>
      `,
      iconSize: [120, 24],
      iconAnchor: [7, 12]
    });

    const marker = L.marker(center, { icon: markerIcon }).addTo(map);

    const popupContent = `
      <div class="cyber-map-popup" style="color:#fff; font-family:'Rajdhani',sans-serif; min-width:180px; padding: 5px;">
        <h4 style="margin:0 0 8px 0; font-size:1.1rem; color:var(--accent-cyan); font-weight:800; border-bottom:1px solid rgba(0,242,255,0.2); padding-bottom:5px; text-transform:uppercase;">${site.name}</h4>
        <div style="font-size:0.75rem; line-height:1.5; margin-bottom:12px; color:rgba(255,255,255,0.85);">
          <div><i class="fa-solid fa-fan" style="margin-right:6px;"></i> Toplam Türbin: <strong style="color:#fff">${site.turbineCount}</strong></div>
          ${faultyCount > 0 ? `<div style="color:#ff4d4d;"><i class="fa-solid fa-triangle-exclamation" style="margin-right:6px;"></i> Arızalı: <strong>${faultyCount}</strong></div>` : ''}
          ${maintCount > 0 ? `<div style="color:#ccff00;"><i class="fa-solid fa-screwdriver-wrench" style="margin-right:6px;"></i> Bakımda: <strong>${maintCount}</strong></div>` : ''}
          ${(faultyCount === 0 && maintCount === 0) ? `<div style="color:#1ed760;"><i class="fa-solid fa-circle-check" style="margin-right:6px;"></i> Durum: <strong>Sorunsuz</strong></div>` : ''}
        </div>
        <button onclick="window.selectSite('${site.id}')" class="maint-action-btn" style="width:100%; display:flex; justify-content:center; gap:6px; background:rgba(0,242,255,0.1); border-color:var(--accent-cyan); color:var(--accent-cyan); cursor:pointer; font-family:'Rajdhani'; font-weight:800;">
          SAHAYI GÖRÜNTÜLE <i class="fa-solid fa-arrow-right"></i>
        </button>
      </div>
    `;

    marker.bindPopup(popupContent, { className: 'cyber-popup-theme' });
  });

  if (bounds.length > 0) {
    map.fitBounds(bounds, { padding: [50, 50] });
  }
};

(window as any).switchSiteViewMode = (mode: 'grid' | 'map') => {
  const gridEl = document.getElementById('turbine-grid');
  const mapContainer = document.getElementById('site-map-container');
  const btnGrid = document.getElementById('site-view-grid');
  const btnMap = document.getElementById('site-view-map');
  
  if (!gridEl || !mapContainer || !btnGrid || !btnMap) return;

  if (mode === 'grid') {
    gridEl.classList.remove('hidden');
    mapContainer.classList.add('hidden');
    btnGrid.classList.add('active');
    btnMap.classList.remove('active');
    (window as any).activeSiteViewMode = 'grid';
  } else {
    gridEl.classList.add('hidden');
    mapContainer.classList.remove('hidden');
    btnGrid.classList.remove('active');
    btnMap.classList.add('active');
    (window as any).activeSiteViewMode = 'map';
    
    // Trigger map render/update
    (window as any).renderSiteTurbinesMap();
  }
};

(window as any).renderSiteTurbinesMap = () => {
  const mapContainer = document.getElementById('site-map-container');
  if (!mapContainer || mapContainer.classList.contains('hidden')) return;

  const L = (window as any).L;
  if (!L) return;

  const siteId = (window as any).activeSiteIdForMap;
  if (!siteId) return;

  const turbines = dataService.getTurbinesBySite(siteId);
  const validTurbines = turbines.filter((t: any) => t.latitude && t.longitude);
  if (validTurbines.length === 0) {
    document.getElementById('site-turbines-map')!.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:center; height:100%; color:var(--text-muted); font-size:0.9rem;">
        <i class="fa-solid fa-map-pin" style="margin-right:8px; color:var(--accent-orange);"></i> Bu sahaya ait türbin koordinat bilgisi bulunamadı.
      </div>
    `;
    return;
  }

  // Initialize map
  if ((window as any).siteMapInstance) {
    try {
      (window as any).siteMapInstance.remove();
    } catch (e) {
      console.error("Error removing old site map instance:", e);
    }
    (window as any).siteMapInstance = null;
  }

  const map = L.map('site-turbines-map', {
    zoomControl: true,
    attributionControl: false
  });
  (window as any).siteMapInstance = map;

  // Use Google Satellite Hybrid as default for detailed map
  L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
    maxZoom: 20
  }).addTo(map);

  const btnDark = document.getElementById('site-map-layer-dark');
  const btnSat = document.getElementById('site-map-layer-satellite');
  if (btnDark && btnSat) {
    btnDark.classList.remove('active');
    btnSat.classList.add('active');
  }
  
  // Clear existing markers/layers
  if ((window as any).siteMapMarkersGroup) {
    map.removeLayer((window as any).siteMapMarkersGroup);
  }

  const markersGroup = L.featureGroup().addTo(map);
  (window as any).siteMapMarkersGroup = markersGroup;

  const siteName = (window as any).activeSiteNameForMap;
  const siteTasks = ((window as any).latestTurbineTasks || []).filter((task: any) => 
    (task.realSiteId === siteId || task.siteId.trim().toLowerCase() === siteName.trim().toLowerCase()) && 
    task.status !== 'Tamamlandı'
  );

  const normalizeId = (id: string | undefined) => {
    if (!id) return "";
    return id.toString().replace(/^T-0?/, 'T').trim().toUpperCase();
  };

  validTurbines.forEach((t: any) => {
    const labelText = t.label ? t.label : `T-${t.no.toString().padStart(2, '0')}`;
    const normalizedLabel = normalizeId(labelText);
    const turbineSerial = (t as any).serial || t.id;
    const normalizedSerial = turbineSerial.toString().trim().toUpperCase();

    const turbineFault = siteTasks.find((task: any) => {
      const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
      const taskTurbineId = normalizeId(task.turbineId);
      return (taskSerial === normalizedSerial || taskTurbineId === normalizedLabel) && task.secilenSablon === 'Türbin Arıza Formu';
    });

    const turbineMaint = siteTasks.find((task: any) => {
      const taskSerial = task.turbinSeriNo?.toString().trim().toUpperCase();
      const taskTurbineId = normalizeId(task.turbineId);
      return (taskSerial === normalizedSerial || taskTurbineId === normalizedLabel) && task.secilenSablon !== 'Türbin Arıza Formu';
    });

    const isFaulty = !!turbineFault;
    const isMaint = !!turbineMaint;
    
    const status = isFaulty ? 'fault' : (isMaint ? 'maintenance' : 'online');
    const markerColor = status === 'fault' ? '#ff4d4d' : (status === 'maintenance' ? '#ccff00' : '#00f2ff');

    const markerIcon = L.divIcon({
      className: 'custom-leaflet-marker-with-label',
      html: `
        <div style="display: flex; align-items: center; gap: 8px; position: relative;">
          <div class="cyber-pulse-marker" style="border-color: ${markerColor}; background: ${markerColor}33; box-shadow: 0 0 10px ${markerColor}; flex-shrink: 0; width: 14px; height: 14px;"></div>
          <span class="cyber-marker-label" style="color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 0.8rem; font-weight: 800; text-shadow: -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 8px rgba(0,0,0,0.8); background: rgba(10, 15, 25, 0.65); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); white-space: nowrap; pointer-events: none;">${labelText}</span>
        </div>
      `,
      iconSize: [120, 24],
      iconAnchor: [7, 12]
    });

    const marker = L.marker([t.latitude, t.longitude], { icon: markerIcon }).addTo(markersGroup);

    const displayStatusLabel = isFaulty ? `ARIZA: ${(turbineFault as any).faultCode || 'HATA BİLDİRİMİ'}` : 
                               (isMaint ? cleanSablonName((turbineMaint as any).secilenSablon).toUpperCase() : 'SORUNSUZ / ÇEVRİMİÇİ');

    const popupContent = `
      <div class="cyber-map-popup" style="color:#fff; font-family:'Rajdhani',sans-serif; min-width:180px; padding:5px;">
        <h4 style="margin:0 0 6px 0; font-size:1.1rem; color:var(--accent-cyan); font-weight:800; border-bottom:1px solid rgba(0,242,255,0.2); padding-bottom:4px; text-transform:uppercase;">${labelText}</h4>
        <div style="font-size:0.65rem; color:rgba(255,255,255,0.6); margin-bottom:8px; font-family:monospace;">Seri: ${t.id}</div>
        
        <div style="font-size:0.75rem; line-height:1.5; margin-bottom:12px;">
          <div>Tip: <strong style="color:#fff">${t.type || 'Bilinmiyor'}</strong></div>
          <div>Kontrolör: <strong style="color:#fff">${t.controlType || '-'}</strong></div>
          <div style="color: ${markerColor}; margin-top: 6px; font-weight: 800;">
            <i class="fa-solid fa-circle" style="font-size:0.55rem; margin-right:5px; text-shadow:0 0 5px ${markerColor};"></i> ${displayStatusLabel}
          </div>
        </div>
        
        <button onclick="window.showTurbineDetails('${t.id}', '${labelText}', '${siteId}', '${siteName.replace(/'/g, "\\'")}')" 
                class="maint-action-btn" 
                style="width:100%; display:flex; justify-content:center; gap:6px; background:rgba(0,242,255,0.1); border-color:var(--accent-cyan); color:var(--accent-cyan); cursor:pointer; font-family:'Rajdhani'; font-weight:800;">
          DETAYLARI GÖSTER <i class="fa-solid fa-chevron-right"></i>
        </button>
      </div>
    `;

    marker.bindPopup(popupContent, {
      className: 'cyber-popup-theme'
    });
  });

  if (validTurbines.length > 0) {
    map.fitBounds(markersGroup.getBounds(), { padding: [40, 40] });
  }

  setTimeout(() => {
    map.invalidateSize();
  }, 100);
};

// Add global styles for leaflet custom nodes
if (!document.getElementById('leaflet-cyber-styles')) {
  const style = document.createElement('style');
  style.id = 'leaflet-cyber-styles';
  style.innerHTML = `
    .cyber-pulse-marker {
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid #fff;
      box-shadow: 0 0 8px currentColor;
      position: relative;
      box-sizing: border-box;
      transition: all 0.3s ease;
    }
    .cyber-pulse-marker::after {
      content: '';
      position: absolute;
      top: -5px;
      left: -5px;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 1.5px solid inherit;
      box-shadow: 0 0 8px inherit;
      animation: marker-pulse 1.6s infinite;
      opacity: 0;
      box-sizing: border-box;
    }
    @keyframes marker-pulse {
      0% { transform: scale(0.4); opacity: 0; }
      50% { opacity: 0.5; }
      100% { transform: scale(1.6); opacity: 0; }
    }
    .cyber-popup-theme .leaflet-popup-content-wrapper {
      background: rgba(10, 15, 25, 0.95) !important;
      border: 1px solid rgba(0, 242, 255, 0.35) !important;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8) !important;
      border-radius: 12px !important;
      backdrop-filter: blur(10px) !important;
      color: #fff !important;
    }
    .cyber-popup-theme .leaflet-popup-tip {
      background: rgba(10, 15, 25, 0.95) !important;
      border-left: 1px solid rgba(0, 242, 255, 0.35) !important;
      border-bottom: 1px solid rgba(0, 242, 255, 0.35) !important;
    }

    .custom-leaflet-marker-with-label {
      background: transparent !important;
      border: none !important;
      width: auto !important;
      height: auto !important;
      overflow: visible !important;
    }
    
    .leaflet-container {
      background: #0b0f19 !important;
    }
    
    .leaflet-tile {
      margin: -1px !important;
      padding: 1px !important;
    }

    /* Cyber Toggle Buttons */
    .cyber-toggle-container {
      display: flex;
      background: rgba(6, 10, 18, 0.6);
      border: 1px solid rgba(0, 243, 255, 0.15);
      padding: 4px;
      border-radius: 10px;
      box-shadow: 0 0 20px rgba(0, 0, 0, 0.4);
      width: fit-content;
      backdrop-filter: blur(10px);
    }
    
    .cyber-toggle-btn {
      background: transparent;
      border: 1px solid transparent;
      color: rgba(255, 255, 255, 0.6);
      padding: 8px 18px;
      border-radius: 8px;
      font-family: 'Rajdhani', sans-serif;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 1px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      transition: all 0.25s ease;
    }
    
    .cyber-toggle-btn i {
      font-size: 0.95rem;
      transition: transform 0.25s ease;
    }
    
    .cyber-toggle-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.03);
    }
    
    .cyber-toggle-btn.active {
      color: #00f3ff;
      background: rgba(0, 243, 255, 0.1);
      border-color: rgba(0, 243, 255, 0.4);
      box-shadow: 0 0 12px rgba(0, 243, 255, 0.15), inset 0 0 8px rgba(0, 243, 255, 0.1);
      text-shadow: 0 0 8px rgba(0, 243, 255, 0.5);
    }
    
    .cyber-toggle-btn.active i {
      transform: scale(1.1);
    }

    /* Cyber Map Layer Button */
    .cyber-map-layer-btn {
      background: transparent;
      border: 1px solid transparent;
      color: rgba(255, 255, 255, 0.6);
      padding: 6px 12px;
      border-radius: 6px;
      font-family: 'Rajdhani', sans-serif;
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.5px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }
    
    .cyber-map-layer-btn:hover {
      color: #fff;
      background: rgba(255, 255, 255, 0.05);
    }
    
    .cyber-map-layer-btn.active {
      color: #00f3ff;
      background: rgba(0, 243, 255, 0.15);
      border-color: rgba(0, 243, 255, 0.4);
      box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);
      text-shadow: 0 0 5px rgba(0, 243, 255, 0.5);
    }
  `;
  document.head.appendChild(style);
}

const switchMapInstanceLayer = (mapInstance: any, mode: 'dark' | 'satellite') => {
  if (!mapInstance) return;
  const L = (window as any).L;
  if (!L) return;

  mapInstance.eachLayer((layer: any) => {
    if (layer instanceof L.TileLayer) {
      mapInstance.removeLayer(layer);
    }
  });

  if (mode === 'satellite') {
    L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', {
      maxZoom: 20
    }).addTo(mapInstance);
  } else {
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(mapInstance);
  }
};

(window as any).switchMainMapLayer = (mode: 'dark' | 'satellite') => {
  const map = (window as any).sitesMapInstance;
  if (!map) return;
  switchMapInstanceLayer(map, mode);

  const btnDark = document.getElementById('sites-map-layer-dark');
  const btnSat = document.getElementById('sites-map-layer-satellite');
  if (btnDark && btnSat) {
    if (mode === 'dark') {
      btnDark.classList.add('active');
      btnSat.classList.remove('active');
    } else {
      btnDark.classList.remove('active');
      btnSat.classList.add('active');
    }
  }
};

(window as any).switchMapLayer = (mode: 'dark' | 'satellite') => {
  const map = (window as any).siteMapInstance;
  if (!map) return;
  switchMapInstanceLayer(map, mode);

  const btnDark = document.getElementById('site-map-layer-dark');
  const btnSat = document.getElementById('site-map-layer-satellite');
  if (btnDark && btnSat) {
    if (mode === 'dark') {
      btnDark.classList.add('active');
      btnSat.classList.remove('active');
    } else {
      btnDark.classList.remove('active');
      btnSat.classList.add('active');
    }
  }
};
