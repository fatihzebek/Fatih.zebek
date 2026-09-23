import { dataService } from '../services/DataService';
import { taskService } from '../services/TaskService';
import { statusService } from '../services/StatusService';
import { maintenanceService } from '../services/MaintenanceService';
import { warehouseService } from '../services/WarehouseService';

let formLocationMode: 'TURBINE' | 'WAREHOUSE' = 'TURBINE';
let currentWarehouseDefects: any[] = [];
let selectedDefectItem: any = null;

export const NewTaskForm = async () => {
  const templates = await maintenanceService.fetchTemplates();
  const warehouses = dataService.getWarehouses();
  currentWarehouseDefects = [];
  selectedDefectItem = null;

  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const userRole = (currentUser?.role || '').toUpperCase();
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const userName = (currentUser?.displayName || currentUser?.name || '').toLowerCase().trim();
  const canCreatePoolTask = userRole === 'ADMIN' || 
                            userEmail === 'furkan.yildirim@demirerholding.com' || 
                            userEmail.includes('furkan.yildirim') || 
                            userName.includes('furkan yıldırım') || 
                            userName.includes('furkan yildirim');

  const allowedTeams = dataService.getAllowedTeams();
  const isSingleTeam = allowedTeams.length === 1;
  const initialTeamValue = isSingleTeam ? allowedTeams[0] : '';
  
  // Group templates by turbine model
  const groupedTemplates: Record<string, typeof templates> = {};
  templates.forEach(t => {
    if (!groupedTemplates[t.turbineModel]) groupedTemplates[t.turbineModel] = [];
    groupedTemplates[t.turbineModel].push(t);
  });

  setTimeout(() => {
    // Bind custom dropdowns
    const dropdowns = [
      { id: 'nt-task-type', label: 'Görev Türü Seçiniz...' },
      { id: 'nt-team', label: 'Atanacak Ekip Seçiniz...' },
      { id: 'nt-warehouse', label: 'Depo / Tesis Seçiniz...' }
    ];

    dropdowns.forEach(dd => {
      const trigger = document.getElementById(`${dd.id}-trigger`);
      const options = document.getElementById(`${dd.id}-options`);
      const hiddenInput = document.getElementById(dd.id) as HTMLInputElement;
      const selectedLabel = document.getElementById(`${dd.id}-selected-label`);
      
      if (trigger && options && hiddenInput) {
        // Toggle dropdown
        trigger.addEventListener('click', (e) => {
          e.stopPropagation();
          
          // Close other dropdowns first
          dropdowns.forEach(other => {
            if (other.id !== dd.id) {
              const otherOpt = document.getElementById(`${other.id}-options`);
              const otherTrig = document.getElementById(`${other.id}-trigger`);
              const otherWrap = document.getElementById(`${other.id}-dropdown-wrapper`);
              otherOpt?.classList.add('hidden');
              otherTrig?.querySelector('.fa-chevron-down')?.classList.remove('rotate-180');
              if (otherWrap) otherWrap.style.zIndex = '30';
            }
          });

          const isOpening = options.classList.contains('hidden');
          options.classList.toggle('hidden');
          const wrapper = document.getElementById(`${dd.id}-dropdown-wrapper`);
          if (wrapper) {
            wrapper.style.zIndex = isOpening ? '1000' : '30';
          }

          const icon = trigger.querySelector('.fa-chevron-down');
          if (icon) {
            if (isOpening) {
              icon.classList.add('rotate-180');
            } else {
              icon.classList.remove('rotate-180');
            }
          }

          if (isOpening) {
            // Center trigger into view on mobile so full dropdown options list is clearly visible
            setTimeout(() => {
              trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 80);

            // Focus on search input only on desktop (prevent mobile keyboard overlay)
            if (dd.id === 'nt-team' && window.innerWidth > 768) {
              const searchInput = document.getElementById('nt-team-search') as HTMLInputElement;
              if (searchInput) {
                setTimeout(() => searchInput.focus(), 100);
              }
            }
          }
        });
        
        // Select option
        options.querySelectorAll('.custom-dropdown-option').forEach(opt => {
          opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const val = opt.getAttribute('data-value') || '';
            hiddenInput.value = val;
            
            if (selectedLabel) {
              selectedLabel.textContent = opt.querySelector('span')?.textContent || opt.textContent || dd.label;
              selectedLabel.style.color = val ? '#ffffff' : 'var(--text-muted)';
            }
            
            // Update active class
            options.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
            opt.classList.add('active');
            
            // Close dropdown
            options.classList.add('hidden');
            const icon = trigger.querySelector('.fa-chevron-down');
            if (icon) icon.classList.remove('rotate-180');

            // Reset search input and show all options again
            if (dd.id === 'nt-team') {
              const searchInput = document.getElementById('nt-team-search') as HTMLInputElement;
              if (searchInput) {
                searchInput.value = '';
                options.querySelectorAll('.custom-dropdown-option').forEach(o => {
                  (o as HTMLElement).style.display = 'flex';
                });
              }
            }

            // Trigger change logic
            if (dd.id === 'nt-task-type') {
              (window as any).handleTaskTypeChange(val);
            } else if (dd.id === 'nt-warehouse') {
              (window as any).handleWarehouseSelect(val);
            }
          });
        });
      }
    });

    // Handle team search filter input events
    const teamSearchInput = document.getElementById('nt-team-search') as HTMLInputElement;
    const teamOptionsWrapper = document.getElementById('nt-team-options');
    if (teamSearchInput && teamOptionsWrapper) {
      teamSearchInput.addEventListener('input', (e) => {
        const query = ((e.target as HTMLInputElement).value || '').trim().toLowerCase();
        const allOptionElements = teamOptionsWrapper.querySelectorAll('.custom-dropdown-option');
        
        allOptionElements.forEach(opt => {
          const val = opt.getAttribute('data-value') || '';
          if (!val) {
            (opt as HTMLElement).style.display = query ? 'none' : 'flex';
            return;
          }
          
          const teamText = opt.querySelector('span')?.textContent?.toLowerCase() || '';
          const matchNumber = val.toLowerCase().replace('team', '').trim().includes(query) || 
                              val.toLowerCase().replace('team 0', '').trim().includes(query) ||
                              val.toLowerCase().replace('team ', '').trim().includes(query);
          
          if (teamText.includes(query) || val.toLowerCase().includes(query) || matchNumber) {
            (opt as HTMLElement).style.display = 'flex';
          } else {
            (opt as HTMLElement).style.display = 'none';
          }
        });
      });

      teamSearchInput.addEventListener('click', (e) => e.stopPropagation());
      teamSearchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const firstVisible = teamOptionsWrapper.querySelector('.custom-dropdown-option:not([style*="display: none"]):not([data-value=""])') as HTMLElement;
          if (firstVisible) {
            firstVisible.click();
          }
        }
      });
    }

    // Global document click to close dropdowns
    document.addEventListener('click', (e) => {
      dropdowns.forEach(dd => {
        const wrapper = document.getElementById(`${dd.id}-dropdown-wrapper`);
        if (wrapper && !wrapper.contains(e.target as Node)) {
          const options = document.getElementById(`${dd.id}-options`);
          const trigger = document.getElementById(`${dd.id}-trigger`);
          options?.classList.add('hidden');
          trigger?.querySelector('.fa-chevron-down')?.classList.remove('rotate-180');
        }
      });
    });

    // Prefill from appState if opened from another page
    const activeTask = (window as any).appState?.activeTask;
    if (activeTask) {
      if (activeTask.prefilledSerial) {
        const serialInput = document.getElementById('nt-serial') as HTMLInputElement;
        if (serialInput) {
          serialInput.value = activeTask.prefilledSerial;
          (window as any).handleSerialAutoFill(activeTask.prefilledSerial);
        }
      }
      if (activeTask.prefilledTaskType) {
        const typeInput = document.getElementById('nt-task-type') as HTMLInputElement;
        const typeLabel = document.getElementById('nt-task-type-selected-label');
        if (typeInput) {
          typeInput.value = activeTask.prefilledTaskType;
          if (typeLabel) {
            typeLabel.textContent = activeTask.prefilledTaskType === 'Türbin Arıza Formu' ? '🚨 Türbin Arıza Formu' : activeTask.prefilledTaskType;
            typeLabel.style.color = '#ffffff';
          }
          const options = document.getElementById('nt-task-type-options');
          if (options) {
            options.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
            const matchOpt = options.querySelector(`[data-value="${activeTask.prefilledTaskType}"]`);
            if (matchOpt) {
              matchOpt.classList.add('active');
            }
          }
          (window as any).handleTaskTypeChange(activeTask.prefilledTaskType);
        }
      }
      (window as any).appState.activeTask = null;
    }

    if (isSingleTeam && initialTeamValue) {
      const teamInput = document.getElementById('nt-team') as HTMLInputElement;
      const teamLabel = document.getElementById('nt-team-selected-label');
      if (teamInput) teamInput.value = initialTeamValue;
      if (teamLabel) {
        teamLabel.textContent = initialTeamValue;
        teamLabel.style.color = '#ffffff';
      }
    }
  }, 100);

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; align-items: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; width: 100%; max-width: 750px;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.25rem;">
            <i class="fa-solid fa-circle-plus" style="color: var(--accent-cyan); text-shadow: 0 0 10px rgba(0,243,255,0.3);"></i> Yeni İş Emri Oluştur
          </h1>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.85rem;">Türbin veya Depo bazlı yeni operasyonel iş emri atama formu.</p>
        </div>
      </div>

      <div class="glass-panel" style="padding: 2rem; width: 100%; max-width: 750px; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; background: rgba(13, 18, 30, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.6); position: relative; overflow: visible !important;">
        <div style="position: absolute; top: -5%; left: 10%; width: 150px; height: 100px; background: rgba(0, 243, 255, 0.03); filter: blur(60px); border-radius: 50%;"></div>
        
        <!-- Compact Location Selector Buttons -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.5rem;">
          <button type="button" class="location-btn selected" id="loc-btn-turbine" 
                  onclick="window.switchFormLocationMode('TURBINE')" 
                  style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border-radius: 8px; border: 1px solid var(--accent-cyan); background: rgba(0, 243, 255, 0.12); color: #fff; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; box-shadow: 0 0 12px rgba(0, 243, 255, 0.15);">
            <i class="fa-solid fa-wind" style="color: var(--accent-cyan); font-size: 1rem;"></i>
            <span>Türbin İş Emri Oluştur</span>
          </button>

          <button type="button" class="location-btn" id="loc-btn-warehouse" 
                  onclick="window.switchFormLocationMode('WAREHOUSE')" 
                  style="display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: var(--text-muted); font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;">
            <i class="fa-solid fa-warehouse" style="color: #10B981; font-size: 1rem;"></i>
            <span>Depo ve Tesis Görevleri Oluştur</span>
          </button>
        </div>

        <form id="new-task-form" onsubmit="window.handleNewTaskSubmit(event)">
          
          <!-- Section 1: Verification -->
          <div class="cyber-form-section-title" id="section-1-title">
            <i class="fa-solid fa-satellite-dish"></i> 01. Türbin Doğrulama
          </div>
          
          <!-- Turbine Serial Input (Turbine Mode) -->
          <div class="form-group" id="group-turbine-serial" style="margin-bottom: 1.25rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">TÜRBİN SERİ NO SORGULA</label>
            <div style="position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.9rem;"></i>
              <input type="text" id="nt-serial" class="cyber-input" placeholder="Türbin seri numarası girin (Örn: 41193)..." oninput="window.handleSerialAutoFill(this.value)" autocomplete="off" style="padding-left: 42px; font-size: 0.95rem; height: 46px; border-radius: 10px;">
            </div>
            <div id="nt-serial-error" style="color: var(--accent-orange); font-size: 0.8rem; margin-top: 0.75rem; display: none; font-weight: 600; padding: 10px 12px; background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255, 170, 0, 0.2); border-radius: 8px;">
              <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Yetkisiz saha işlemi! Farklı seri numarası girerseniz, iş emri oluşturmasını teknik destekten talep edin.
            </div>
          </div>

          <!-- Warehouse Select Input (Warehouse Mode) -->
          <div class="form-group" id="group-warehouse-select" style="margin-bottom: 1.25rem; display: none;">
            <label style="color: #10B981; font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">SANTRAL & DEPO SEÇİNİZ</label>
            <div class="custom-dropdown" id="nt-warehouse-dropdown-wrapper" style="position: relative; width: 100%;">
              <div class="cyber-input custom-dropdown-trigger" id="nt-warehouse-trigger" style="padding-left: 42px; font-size: 0.9rem; height: 46px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(16, 185, 129, 0.35);">
                <i class="fa-solid fa-warehouse" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #10B981; font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
                <span id="nt-warehouse-selected-label" style="color: var(--text-muted);">Depo / Tesis Seçiniz...</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s;"></i>
              </div>
              <div class="custom-dropdown-options hidden glass-panel" id="nt-warehouse-options" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: rgba(13, 18, 30, 0.98); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); max-height: min(250px, 45vh); overflow-y: auto; z-index: 99999;">
                <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
                  Depo / Tesis Seçiniz...
                </div>
                ${warehouses.map(w => `
                  <div class="custom-dropdown-option" data-value="${w.id}" data-name="${w.name}" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-boxes-stacked" style="color: #10B981; font-size: 0.8rem;"></i>
                    <span>${w.name}</span>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="nt-warehouse">
            </div>
          </div>

          <!-- Telemetry readouts (Only in Turbine Mode) -->
          <div id="telemetry-readouts-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 1.5rem;">
            <div id="telemetry-turbine-card" class="telemetry-card" style="position: relative; display: flex; flex-direction: column; gap: 6px; padding: 1rem 1.25rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span id="label-unit-card" style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase;">
                  <i class="fa-solid fa-fan" style="margin-right: 5px;"></i> TÜRBİN NO
                </span>
                <div class="status-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #374151; box-shadow: 0 0 8px rgba(0,0,0,0.5); transition: all 0.3s;"></div>
              </div>
              <input type="text" id="nt-turbine" class="cyber-telemetry-input" readonly style="background: transparent; border: none; font-size: 1.15rem; font-weight: 800; color: var(--text-muted); padding: 0; outline: none; width: 100%; pointer-events: none; text-transform: uppercase; font-family: 'Rajdhani', sans-serif;" placeholder="Sorgu Bekleniyor...">
            </div>
            <div id="telemetry-site-card" class="telemetry-card" style="position: relative; display: flex; flex-direction: column; gap: 6px; padding: 1rem 1.25rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase;">
                  <i class="fa-solid fa-map-location-dot" style="margin-right: 5px;"></i> BÖLGE / SAHA
                </span>
                <div class="status-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #374151; box-shadow: 0 0 8px rgba(0,0,0,0.5); transition: all 0.3s;"></div>
              </div>
              <input type="text" id="nt-site" class="cyber-telemetry-input" readonly style="background: transparent; border: none; font-size: 1.05rem; font-weight: 800; color: var(--text-muted); padding: 0; outline: none; width: 100%; pointer-events: none; font-family: 'Rajdhani', sans-serif;" placeholder="Sorgu Bekleniyor...">
            </div>
            <input type="hidden" id="nt-site-id">
          </div>

          <!-- Section 2: Task Definition -->
          <div class="cyber-form-section-title" style="margin-top: 1.75rem;">
            <i class="fa-solid fa-clipboard-list"></i> 02. Görev Tanımlama ve Şablon
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">GÖREV KATEGORİSİ</label>
            <div class="custom-dropdown" id="nt-task-type-dropdown-wrapper" style="position: relative; width: 100%;">
              <div class="cyber-input custom-dropdown-trigger" id="nt-task-type-trigger" style="padding-left: 42px; font-size: 0.9rem; height: 46px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15);">
                <i class="fa-solid fa-list-check" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
                <span id="nt-task-type-selected-label" style="color: var(--text-muted);">Görev Türü Seçiniz...</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s;"></i>
              </div>
              <div class="custom-dropdown-options hidden glass-panel" id="nt-task-type-options" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: rgba(13, 18, 30, 0.98); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 10px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); max-height: min(250px, 45vh); overflow-y: auto; z-index: 99999;">
                <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
                  Görev Türü Seçiniz...
                </div>
                <div class="custom-dropdown-option" data-value="Türbin Arıza Formu" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
                  <span>🚨 Türbin Arıza Formu</span>
                </div>
                <div class="custom-dropdown-option" data-value="Bakım" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
                  <span>🔧 Periyodik Bakım Görevi</span>
                </div>
                <div class="custom-dropdown-option" data-value="Planlı Duruş" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
                  <span>📅 Planlı Operasyonel Duruş</span>
                </div>
              </div>
              <input type="hidden" id="nt-task-type" required>
            </div>
          </div>

          <!-- Warehouse Defect Materials Interactive Section (Strictly 1 Material per Task) -->
          <div id="nt-warehouse-material-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.5rem; padding: 1.25rem; border: 1px dashed rgba(16, 185, 129, 0.4); border-radius: 12px; background: rgba(16, 185, 129, 0.03);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.6rem;">
              <label style="color: #10B981; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; margin: 0; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-wrench"></i> BU DEPODAKİ DEFECT (ARIZALI) MALZEME SEÇİMİ
              </label>
              <span id="nt-defect-count-badge" style="font-size: 0.68rem; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 12px; padding: 2px 8px; font-weight: 700;">Yükleniyor...</span>
            </div>

            <!-- Fast SAP Search Filter Box -->
            <div style="position: relative; margin-bottom: 0.75rem;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.85rem;"></i>
              <input type="text" id="nt-defect-search" class="cyber-input" placeholder="🔍 SAP No veya Parça Adı yazarak anında filtreleyin (Örn: 96030 veya Fan)..." oninput="window.filterDefectMaterials(this.value)" autocomplete="off" style="padding-left: 36px; height: 38px; border-radius: 8px; font-size: 0.82rem; border-color: rgba(16, 185, 129, 0.3);">
            </div>

            <!-- Defect List Container -->
            <div id="nt-defect-list-container" style="max-height: 160px; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; margin-bottom: 1rem; padding-right: 4px;">
              <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Depo arızalı stoğu taranıyor...
              </div>
            </div>

            <!-- Selected Single Material (Strictly 1 Unit) -->
            <div style="padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06);">
              <label style="font-size: 0.68rem; color: #10B981; display: block; margin-bottom: 4px; font-weight: 700;">
                <i class="fa-solid fa-circle-check"></i> SEÇİLEN TEKİL MALZEME (1 ADET ONARIM İÇİN)
              </label>
              <input type="text" id="nt-wh-sap" class="cyber-input" placeholder="Yukarıdaki listeden bir parça seçiniz..." readonly style="height: 42px; border-radius: 8px; font-size: 0.88rem; font-weight: 700; background: rgba(0,0,0,0.4); width: 100%; box-sizing: border-box;">
              <input type="hidden" id="nt-wh-qty" value="1">
            </div>
          </div>

          <!-- General Description / Operational Note -->
          <div id="nt-planned-stop-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.25rem;">
            <label id="nt-desc-label" style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">GÖREV AÇIKLAMASI & TALİMATLAR</label>
            <div style="position: relative;">
              <i class="fa-solid fa-align-left" style="position: absolute; left: 14px; top: 14px; color: var(--accent-cyan); font-size: 0.9rem; z-index: 5;"></i>
              <textarea id="nt-planned-stop-desc" class="cyber-input" placeholder="Lütfen görevin hedefini, açıklamasını veya talimatlarını yazınız..." style="padding-left: 42px; padding-top: 10px; height: 75px; border-radius: 10px; resize: none; font-size: 0.9rem; font-family: 'Rajdhani', sans-serif; box-sizing: border-box; width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15); color: #fff;"></textarea>
            </div>
          </div>
          
          <!-- Fault Code Input (Dynamic) -->
          <div id="nt-fault-code-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.25rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">ARIZA HATA KODU SEÇİNİZ</label>
            <div style="position: relative;">
              <i class="fa-solid fa-triangle-exclamation" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #ff4d4d; font-size: 0.9rem;"></i>
              <input type="text" id="nt-fault-search" class="cyber-input" placeholder="Arıza kodu veya açıklaması yazarak arayın..." oninput="window.handleFaultSearch(this.value)" autocomplete="off" style="padding-left: 42px; height: 46px; border-radius: 10px;">
              <div id="nt-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; top: 100%; z-index: 100; border-color: rgba(255, 77, 77, 0.25); background: rgba(13, 18, 30, 0.98); box-shadow: 0 10px 30px rgba(0,0,0,0.6); max-height: 220px; overflow-y: auto; border-radius: 10px;"></div>
              <input type="hidden" id="nt-fault-code-value">
            </div>
          </div>

          <!-- Maintenance Template Input (Dynamic) -->
          <div id="nt-maintenance-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.25rem; padding: 1.25rem; border: 1px dashed rgba(0, 243, 255, 0.25); border-radius: 12px; background: rgba(0, 243, 255, 0.015);">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">UYGULANACAK BAKIM ŞABLONU</label>
            <div style="position: relative;">
              <i class="fa-solid fa-screwdriver-wrench" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
              <select id="nt-maintenance-template" class="cyber-input" onchange="window.handleMaintenanceTemplateChange(this.value)" style="padding-left: 42px; font-size: 0.9rem; height: 44px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                <option value="">Bakım Şablonu Seçiniz...</option>
                ${Object.keys(groupedTemplates).sort().map(model => `
                  <optgroup label="${model} SERİSİ" style="background: #0d1117; color: #fff;">
                    ${groupedTemplates[model].map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
                  </optgroup>
                `).join('')}
              </select>
            </div>
            
            <div id="nt-template-preview" class="glass-panel mt-3 hidden" style="background: rgba(0,0,0,0.3); border-color: rgba(0, 243, 255, 0.15); padding: 1rem; border-radius: 8px;">
              <h4 style="color: var(--accent-cyan); font-size: 0.65rem; font-weight: 900; margin: 0 0 0.8rem 0; letter-spacing: 1.5px; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
                <i class="fa-solid fa-list-check"></i> Şablon Kontrol Adımları
              </h4>
              <div id="nt-preview-checklist" class="space-y-1" style="max-height: 150px; overflow-y: auto; padding-right: 5px; font-family: 'Inter', sans-serif;"></div>
            </div>
          </div>

          <!-- Section 3: Dispatch & Allocation -->
          <div class="cyber-form-section-title" style="margin-top: 1.75rem;">
            <i class="fa-solid fa-people-carry-box"></i> 03. Ekip Atama ve Koordinasyon
          </div>

          <div class="form-group" style="margin-bottom: 2rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">GÖREV İÇİN EKİP ATAMA</label>
            <div class="custom-dropdown" id="nt-team-dropdown-wrapper" style="position: relative; width: 100%;">
              <div class="cyber-input custom-dropdown-trigger" id="nt-team-trigger" style="padding-left: 42px; font-size: 0.9rem; height: 46px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15);">
                <i class="fa-solid fa-users" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
                <span id="nt-team-selected-label" style="${initialTeamValue ? 'color: #ffffff;' : 'color: var(--text-muted);'}">${initialTeamValue || 'Atanacak Ekip Seçiniz...'}</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s;"></i>
              </div>
              <div class="custom-dropdown-options hidden glass-panel" id="nt-team-options" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: rgba(13, 18, 30, 0.98); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 10px; box-shadow: 0 12px 35px rgba(0,0,0,0.85); max-height: min(250px, 45vh); overflow-y: auto; z-index: 99999;">
                ${allowedTeams.length > 5 ? `
                  <div class="dropdown-search-wrapper" style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); position: sticky; top: 0; background: rgba(13, 18, 30, 0.98); z-index: 10;">
                    <input type="text" id="nt-team-search" placeholder="Ekip No Yazın (Örn: 5)..." style="width: 100%; padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 6px; color: #fff; font-size: 0.8rem; outline: none; box-sizing: border-box; font-family: 'Inter', sans-serif;" autocomplete="off">
                  </div>
                ` : ''}
                ${!isSingleTeam ? `
                  <div class="custom-dropdown-option ${!initialTeamValue ? 'active' : ''}" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
                    Atanacak Ekip Seçiniz...
                  </div>
                ` : ''}
                ${canCreatePoolTask ? `
                  <div class="custom-dropdown-option" data-value="HAVUZ" style="padding: 10px 16px; font-size: 0.85rem; color: #fbbf24; cursor: pointer; border-bottom: 1px solid rgba(245, 158, 11, 0.25); background: rgba(245, 158, 11, 0.08); display: flex; align-items: center; gap: 8px; font-weight: 700;">
                    <i class="fa-solid fa-users-viewfinder" style="font-size: 0.85rem; color: #fbbf24;"></i>
                    <span>🌐 Bölge Ortak Görevi (Ekip Seçilmeyecek)</span>
                  </div>
                ` : ''}
                ${allowedTeams.map(team => `
                  <div class="custom-dropdown-option ${initialTeamValue === team ? 'active' : ''}" data-value="${team}" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-user-group" style="font-size: 0.75rem; color: var(--accent-cyan); opacity: 0.7;"></i>
                    <span>${team}</span>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="nt-team" value="${initialTeamValue}" required>
            </div>
          </div>

          <!-- Form Submit Button -->
          <div style="display: flex; justify-content: flex-end;">
            <button type="submit" id="nt-submit-btn" class="btn-cyber" style="background: var(--accent-cyan); color: #000; font-weight: 800; font-size: 0.9rem; padding: 12px 28px; border-radius: 10px; display: flex; align-items: center; gap: 10px; letter-spacing: 0.5px; box-shadow: 0 0 20px rgba(0, 243, 255, 0.3);">
              <i class="fa-solid fa-paper-plane"></i> GÖREVİ ATAMASINI GERÇEKLEŞTİR
            </button>
          </div>

        </form>
      </div>
    </div>

    <style>
      .cyber-form-section-title {
        font-size: 0.78rem;
        font-weight: 800;
        color: var(--accent-cyan);
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 1.25rem;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid rgba(0, 243, 255, 0.1);
        padding-bottom: 8px;
        text-shadow: 0 0 8px rgba(0, 243, 255, 0.15);
      }
      .defect-item-card {
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        transition: all 0.2s;
      }
      .defect-item-card:hover {
        background: rgba(239, 68, 68, 0.08);
        border-color: rgba(239, 68, 68, 0.4);
        transform: translateY(-1px);
      }
      .defect-item-card.selected {
        background: rgba(16, 185, 129, 0.15) !important;
        border-color: #10B981 !important;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.25);
      }
      .custom-dropdown-trigger {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 243, 255, 0.15);
      }
      .custom-dropdown-trigger:hover {
        border-color: rgba(0, 243, 255, 0.45) !important;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.15) !important;
      }
      .custom-dropdown-option {
        padding: 10px 16px;
        min-height: 42px;
        box-sizing: border-box;
        font-size: 0.85rem;
        color: #c9d1d9;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        transition: all 0.2s ease;
        touch-action: manipulation;
        -webkit-tap-highlight-color: rgba(0, 243, 255, 0.15);
      }
      .custom-dropdown-option:hover {
        background: rgba(0, 243, 255, 0.08) !important;
        color: #00f3ff !important;
      }
      .custom-dropdown-option.active {
        background: rgba(0, 243, 255, 0.05);
        color: #00f3ff !important;
        font-weight: 700;
      }
      .rotate-180 {
        transform: rotate(180deg);
      }
    </style>
  `;
};

// --- DOM Etkileşim Fonksiyonları ---

(window as any).switchFormLocationMode = (mode: 'TURBINE' | 'WAREHOUSE') => {
  formLocationMode = mode;
  const btnTurbine = document.getElementById('loc-btn-turbine');
  const btnWarehouse = document.getElementById('loc-btn-warehouse');
  const groupTurbine = document.getElementById('group-turbine-serial');
  const groupWarehouse = document.getElementById('group-warehouse-select');
  const sec1Title = document.getElementById('section-1-title');
  const telemetryContainer = document.getElementById('telemetry-readouts-container');
  const taskTypeOptions = document.getElementById('nt-task-type-options');
  const taskTypeLabel = document.getElementById('nt-task-type-selected-label');
  const taskTypeInput = document.getElementById('nt-task-type') as HTMLInputElement;

  resetTelemetryCards();

  if (mode === 'WAREHOUSE') {
    if (btnTurbine) {
      btnTurbine.style.borderColor = 'rgba(255,255,255,0.08)';
      btnTurbine.style.background = 'rgba(255,255,255,0.02)';
      btnTurbine.style.color = 'var(--text-muted)';
      btnTurbine.style.boxShadow = 'none';
    }
    if (btnWarehouse) {
      btnWarehouse.style.borderColor = '#10B981';
      btnWarehouse.style.background = 'rgba(16, 185, 129, 0.15)';
      btnWarehouse.style.color = '#fff';
      btnWarehouse.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.25)';
    }
    if (groupTurbine) groupTurbine.style.display = 'none';
    if (groupWarehouse) groupWarehouse.style.display = 'block';
    if (telemetryContainer) telemetryContainer.style.display = 'none'; // Duplicate boxes hidden
    if (sec1Title) sec1Title.innerHTML = '<i class="fa-solid fa-warehouse" style="color: #10B981;"></i> 01. Depo & Tesis Doğrulama';

    // Populate warehouse categories in task type options
    if (taskTypeOptions) {
      taskTypeOptions.innerHTML = `
        <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
          Depo Görev Türü Seçiniz...
        </div>
        <div class="custom-dropdown-option" data-value="Saha İçi Defect Malzeme Onarım Çalışması (Tamir Edilebilir Malzemeler İçin)" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🛠️ Saha İçi Defect Malzeme Onarım Çalışması (Tamir Edilebilir Malzemeler İçin)</span>
        </div>
        <div class="custom-dropdown-option" data-value="Depo Sayımı, Raf Düzenleme & Depo Temizliği" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>📦 Depo Sayımı, Raf Düzenleme & Depo Temizliği</span>
        </div>
        <div class="custom-dropdown-option" data-value="El Aletleri & Ekipman Bakımı" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🔧 El Aletleri & Ekipman Bakımı</span>
        </div>
        <div class="custom-dropdown-option" data-value="Hurda Malzeme Ayrıştırma & Atık Ayrıştırma" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🛡️ Hurda Malzeme Ayrıştırma & Atık Ayrıştırma</span>
        </div>
        <div class="custom-dropdown-option" data-value="Tesis İçerisinde Yapılan Çalışmalar" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🏢 Tesis İçerisinde Yapılan Çalışmalar</span>
        </div>
      `;

      taskTypeOptions.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.getAttribute('data-value') || '';
          if (taskTypeInput) taskTypeInput.value = val;
          if (taskTypeLabel) {
            taskTypeLabel.textContent = opt.querySelector('span')?.textContent || opt.textContent || 'Depo Görev Türü Seçiniz...';
            taskTypeLabel.style.color = val ? '#ffffff' : 'var(--text-muted)';
          }
          taskTypeOptions.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          taskTypeOptions.classList.add('hidden');
          (window as any).handleTaskTypeChange(val);
        });
      });
    }

    if (taskTypeLabel) {
      taskTypeLabel.textContent = 'Depo Görev Türü Seçiniz...';
      taskTypeLabel.style.color = 'var(--text-muted)';
    }
    if (taskTypeInput) taskTypeInput.value = '';

  } else {
    // Turbine Mode
    if (btnTurbine) {
      btnTurbine.style.borderColor = 'var(--accent-cyan)';
      btnTurbine.style.background = 'rgba(0, 243, 255, 0.12)';
      btnTurbine.style.color = '#fff';
      btnTurbine.style.boxShadow = '0 0 12px rgba(0, 243, 255, 0.15)';
    }
    if (btnWarehouse) {
      btnWarehouse.style.borderColor = 'rgba(255,255,255,0.08)';
      btnWarehouse.style.background = 'rgba(255,255,255,0.02)';
      btnWarehouse.style.color = 'var(--text-muted)';
      btnWarehouse.style.boxShadow = 'none';
    }
    if (groupTurbine) groupTurbine.style.display = 'block';
    if (groupWarehouse) groupWarehouse.style.display = 'none';
    if (telemetryContainer) telemetryContainer.style.display = 'grid';
    if (sec1Title) sec1Title.innerHTML = '<i class="fa-solid fa-satellite-dish"></i> 01. Türbin Doğrulama';

    // Populate turbine categories
    if (taskTypeOptions) {
      taskTypeOptions.innerHTML = `
        <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03);">
          Görev Türü Seçiniz...
        </div>
        <div class="custom-dropdown-option" data-value="Türbin Arıza Formu" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🚨 Türbin Arıza Formu</span>
        </div>
        <div class="custom-dropdown-option" data-value="Bakım" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>🔧 Periyodik Bakım Görevi</span>
        </div>
        <div class="custom-dropdown-option" data-value="Planlı Duruş" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px;">
          <span>📅 Planlı Operasyonel Duruş</span>
        </div>
      `;

      taskTypeOptions.querySelectorAll('.custom-dropdown-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
          e.stopPropagation();
          const val = opt.getAttribute('data-value') || '';
          if (taskTypeInput) taskTypeInput.value = val;
          if (taskTypeLabel) {
            taskTypeLabel.textContent = opt.querySelector('span')?.textContent || opt.textContent || 'Görev Türü Seçiniz...';
            taskTypeLabel.style.color = val ? '#ffffff' : 'var(--text-muted)';
          }
          taskTypeOptions.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
          opt.classList.add('active');
          taskTypeOptions.classList.add('hidden');
          (window as any).handleTaskTypeChange(val);
        });
      });
    }

    if (taskTypeLabel) {
      taskTypeLabel.textContent = 'Görev Türü Seçiniz...';
      taskTypeLabel.style.color = 'var(--text-muted)';
    }
    if (taskTypeInput) taskTypeInput.value = '';
  }
};

(window as any).handleWarehouseSelect = async (warehouseId: string) => {
  const warehouses = dataService.getWarehouses();
  const matched = warehouses.find(w => w.id === warehouseId);
  const turbineInput = document.getElementById('nt-turbine') as HTMLInputElement;
  const siteInput = document.getElementById('nt-site') as HTMLInputElement;
  const siteIdInput = document.getElementById('nt-site-id') as HTMLInputElement;

  if (!matched) {
    resetTelemetryCards();
    return;
  }

  if (turbineInput) turbineInput.value = matched.name;
  if (siteInput) siteInput.value = matched.name.replace(' Deposu', ' RES').replace(' Atölye', '');
  if (siteIdInput) siteIdInput.value = matched.id;

  // Auto select team if assigned to this site and within allowedTeams
  const allSites = dataService.getSites();
  const siteMatch = allSites.find(s => s.id === matched.id || s.name.includes(matched.name.replace(' Deposu', '')));
  if (siteMatch && (siteMatch as any).assignedTeam) {
    const siteTeam = (siteMatch as any).assignedTeam;
    const allowed = dataService.getAllowedTeams();
    if (allowed.includes(siteTeam)) {
      const teamHidden = document.getElementById('nt-team') as HTMLInputElement;
      const teamLabel = document.getElementById('nt-team-selected-label');
      if (teamHidden) teamHidden.value = siteTeam;
      if (teamLabel) {
        teamLabel.textContent = siteTeam;
        teamLabel.style.color = '#ffffff';
      }
    }
  }

  // Fetch defect materials for this warehouse
  await (window as any).loadWarehouseDefectMaterials(matched.id);
};

(window as any).loadWarehouseDefectMaterials = async (warehouseId: string) => {
  const container = document.getElementById('nt-defect-list-container');
  const badge = document.getElementById('nt-defect-count-badge');
  if (!container || !badge) return;

  container.innerHTML = `
    <div style="padding: 12px; text-align: center; color: var(--text-muted); font-size: 0.8rem; background: rgba(0,0,0,0.2); border-radius: 8px;">
      <i class="fa-solid fa-spinner fa-spin" style="margin-right: 6px;"></i> Depo arızalı stoğu taranıyor...
    </div>
  `;

  try {
    const inventory = await warehouseService.getInventory(warehouseId);
    const defectItems = inventory.filter(i => (i.condition === 'DEFECT' || (i as any).status === 'DEFECT') && Number(i.quantity) > 0);
    currentWarehouseDefects = defectItems;
    selectedDefectItem = null;

    badge.textContent = `${defectItems.length} Kalem Arızalı`;
    badge.style.background = defectItems.length > 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)';
    badge.style.color = defectItems.length > 0 ? '#EF4444' : '#10B981';
    badge.style.borderColor = defectItems.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)';

    (window as any).renderFilteredDefects(defectItems);

  } catch (e) {
    console.error("Defect malzeme getirme hatası:", e);
    container.innerHTML = `
      <div style="padding: 10px; color: #EF4444; font-size: 0.78rem; text-align: center;">
        Arızalı malzemeler yüklenirken hata oluştu.
      </div>
    `;
  }
};

(window as any).filterDefectMaterials = (query: string) => {
  const q = (query || '').trim().toLowerCase();
  if (!q) {
    (window as any).renderFilteredDefects(currentWarehouseDefects);
    return;
  }
  const filtered = currentWarehouseDefects.filter(item => {
    const sapMatch = String(item.sapNo || '').toLowerCase().includes(q);
    const descMatch = String(item.description || '').toLowerCase().includes(q);
    return sapMatch || descMatch;
  });
  (window as any).renderFilteredDefects(filtered);
};

(window as any).renderFilteredDefects = (items: any[]) => {
  const container = document.getElementById('nt-defect-list-container');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `
      <div style="padding: 12px; text-align: center; color: #94A3B8; font-size: 0.78rem; background: rgba(0,0,0,0.25); border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
        <i class="fa-solid fa-circle-check" style="color: #10B981; margin-right: 6px;"></i> Eşleşen arızalı malzeme bulunamadı.
      </div>
    `;
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="defect-item-card ${selectedDefectItem?.id === item.id ? 'selected' : ''}" 
         onclick="window.selectDefectMaterial('${item.id}')">
      <div style="display: flex; align-items: center; gap: 8px; overflow: hidden;">
        <span style="background: #EF4444; color: #000; font-weight: 900; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; flex-shrink: 0;">DEFECT</span>
        <span style="font-weight: 800; font-size: 0.8rem; color: #00f3ff; font-family: monospace;">${item.sapNo}</span>
        <span style="color: var(--text-muted); font-size: 0.75rem;">-</span>
        <span style="font-size: 0.78rem; color: #CBD5E1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${item.description}</span>
      </div>
      <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
        <span style="font-size: 0.75rem; color: #F87171; font-weight: 800; background: rgba(239, 68, 68, 0.1); padding: 2px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.2);">
          ${item.quantity} Adet
        </span>
        <i class="fa-solid ${selectedDefectItem?.id === item.id ? 'fa-circle-check' : 'fa-circle-plus'}" style="color: ${selectedDefectItem?.id === item.id ? '#10B981' : 'var(--text-muted)'}; font-size: 0.95rem;"></i>
      </div>
    </div>
  `).join('');
};

(window as any).selectDefectMaterial = (itemId: string) => {
  const item = currentWarehouseDefects.find(i => i.id === itemId);
  if (!item) return;

  selectedDefectItem = item;
  const sapInput = document.getElementById('nt-wh-sap') as HTMLInputElement;
  const qtyInput = document.getElementById('nt-wh-qty') as HTMLInputElement;

  if (sapInput) {
    sapInput.value = `${item.sapNo} - ${item.description}`;
    sapInput.style.borderColor = '#10B981';
    sapInput.style.color = '#fff';
  }
  if (qtyInput) {
    qtyInput.value = '1';
    qtyInput.max = String(item.quantity || 1);
  }

  // Update card selected state (single selection)
  const cards = document.querySelectorAll('.defect-item-card');
  cards.forEach(c => c.classList.remove('selected'));
  const clickedCard = document.querySelector(`.defect-item-card[onclick*="${itemId}"]`);
  if (clickedCard) clickedCard.classList.add('selected');
};

(window as any).handleTaskTypeChange = (type: string) => {
  const maintenanceSection = document.getElementById('nt-maintenance-section');
  const maintenanceTemplate = document.getElementById('nt-maintenance-template') as HTMLSelectElement;
  const whMaterialSection = document.getElementById('nt-warehouse-material-section');
  const plannedStopSection = document.getElementById('nt-planned-stop-section');
  const plannedStopDesc = document.getElementById('nt-planned-stop-desc') as HTMLTextAreaElement;
  const descLabel = document.getElementById('nt-desc-label');
  const faultSection = document.getElementById('nt-fault-code-section');
  const faultSearch = document.getElementById('nt-fault-search') as HTMLInputElement;
  
  if (maintenanceSection) {
    if (type === 'Bakım') {
      maintenanceSection.style.display = 'block';
      if (maintenanceTemplate) maintenanceTemplate.required = true;
    } else {
      maintenanceSection.style.display = 'none';
      if (maintenanceTemplate) {
        maintenanceTemplate.required = false;
        maintenanceTemplate.value = '';
      }
    }
  }

  // Warehouse Material Section (Strictly in revision mode)
  if (whMaterialSection) {
    if (type.includes('Defect') || type.includes('Onarım') || type.includes('Revizyon') || type.includes('Mekanik')) {
      whMaterialSection.style.display = 'block';
    } else {
      whMaterialSection.style.display = 'none';
    }
  }

  // Arıza Kodu Bölümü
  if (faultSection) {
    if (type === 'Türbin Arıza Formu') {
      faultSection.style.display = 'block';
      if (faultSearch) faultSearch.required = true;
    } else {
      faultSection.style.display = 'none';
      if (faultSearch) {
        faultSearch.required = false;
        faultSearch.value = '';
      }
      const valInput = document.getElementById('nt-fault-code-value') as HTMLInputElement;
      if (valInput) valInput.value = '';
    }
  }

  // Planlı Duruş / Açıklama Bölümü
  if (plannedStopSection) {
    if (type === 'Planlı Duruş' || formLocationMode === 'WAREHOUSE') {
      plannedStopSection.style.display = 'block';
      if (descLabel) {
        descLabel.textContent = formLocationMode === 'WAREHOUSE' ? 'GÖREV AÇIKLAMASI & TALİMATLAR' : 'PLANLI DURUŞ AÇIKLAMASI';
      }
    } else {
      plannedStopSection.style.display = 'none';
      if (plannedStopDesc) {
        plannedStopDesc.required = false;
        plannedStopDesc.value = '';
      }
    }
  }

  const preview = document.getElementById('nt-template-preview');
  if (preview) preview.classList.add('hidden');
};

(window as any).handleMaintenanceTemplateChange = async (templateId: string) => {
  const preview = document.getElementById('nt-template-preview');
  const checklistContainer = document.getElementById('nt-preview-checklist');
  
  if (!preview || !checklistContainer) return;

  if (!templateId) {
    preview.classList.add('hidden');
    return;
  }

  const template = await maintenanceService.getTemplate(templateId);
  if (template) {
    preview.classList.remove('hidden');
    checklistContainer.innerHTML = template.checklist.length > 0 
      ? template.checklist.map(c => `
          <div style="font-size: 0.7rem; color: #ccc; border-left: 2px solid var(--accent-cyan); padding-left: 8px; margin-bottom: 4px; background: rgba(255,255,255,0.02); padding-top: 3px; padding-bottom: 3px;">
            ${c.text}
          </div>
        `).join('')
      : '<div style="font-size: 0.7rem; color: #555; font-style: italic;">Checklist tanımlanmamış</div>';
  } else {
    preview.classList.add('hidden');
  }
};

(window as any).handleFaultSearch = (query: string) => {
  const resultsDiv = document.getElementById('nt-fault-results');
  if (!resultsDiv) return;
  if (query.length < 1) { resultsDiv.classList.add('hidden'); return; }

  const results = statusService.searchCodes(query);
  if (results.length === 0) { resultsDiv.classList.add('hidden'); return; }

  resultsDiv.classList.remove('hidden');
  resultsDiv.innerHTML = results.map(r => `
    <div class="search-item" onclick="window.selectTaskFaultCode('${r.KOD}', '${r.Aciklama}')" style="padding: 0.8rem 1rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);">
      <span style="color: var(--accent-cyan); font-weight: 700;">${r.KOD}</span> - ${r.Aciklama}
    </div>
  `).join('');
};

(window as any).selectTaskFaultCode = (kod: string, aciklama: string) => {
  const searchInput = document.getElementById('nt-fault-search') as HTMLInputElement;
  const valueInput = document.getElementById('nt-fault-code-value') as HTMLInputElement;
  const resultsDiv = document.getElementById('nt-fault-results');

  if (searchInput && valueInput) {
    searchInput.value = `${kod} - ${aciklama}`;
    valueInput.value = kod;
    resultsDiv?.classList.add('hidden');
  }
};

const resetTelemetryCards = () => {
  const turbineCard = document.getElementById('telemetry-turbine-card');
  const siteCard = document.getElementById('telemetry-site-card');
  const turbineInput = document.getElementById('nt-turbine') as HTMLInputElement;
  const siteInput = document.getElementById('nt-site') as HTMLInputElement;
  const siteIdInput = document.getElementById('nt-site-id') as HTMLInputElement;
  const whInput = document.getElementById('nt-warehouse') as HTMLInputElement;
  const whLabel = document.getElementById('nt-warehouse-selected-label');
  selectedDefectItem = null;
  
  if (turbineInput) {
    turbineInput.value = '';
    turbineInput.placeholder = 'Sorgu Bekleniyor...';
    turbineInput.style.color = 'var(--text-muted)';
  }
  if (siteInput) {
    siteInput.value = '';
    siteInput.placeholder = 'Sorgu Bekleniyor...';
    siteInput.style.color = 'var(--text-muted)';
  }
  if (siteIdInput) siteIdInput.value = '';
  if (whInput) whInput.value = '';
  if (whLabel) {
    whLabel.textContent = 'Depo / Tesis Seçiniz...';
    whLabel.style.color = 'var(--text-muted)';
  }
  
  if (turbineCard && siteCard) {
    turbineCard.style.borderColor = 'rgba(255, 255, 255, 0.05)';
    turbineCard.style.background = 'rgba(0,0,0,0.3)';
    const ind = turbineCard.querySelector('.status-indicator');
    if (ind) ind.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #374151; box-shadow: 0 0 8px rgba(0,0,0,0.5);');
    
    siteCard.style.borderColor = 'rgba(255, 255, 255, 0.05)';
    siteCard.style.background = 'rgba(0,0,0,0.3)';
    const ind2 = siteCard.querySelector('.status-indicator');
    if (ind2) ind2.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #374151; box-shadow: 0 0 8px rgba(0,0,0,0.5);');
  }

  // Reset custom dropdowns
  const taskTypeInput = document.getElementById('nt-task-type') as HTMLInputElement;
  const taskTypeLabel = document.getElementById('nt-task-type-selected-label');
  const taskTypeOptions = document.getElementById('nt-task-type-options');
  if (taskTypeInput) taskTypeInput.value = '';
  if (taskTypeLabel) {
    taskTypeLabel.innerText = 'Görev Türü Seçiniz...';
    taskTypeLabel.style.color = 'var(--text-muted)';
  }
  if (taskTypeOptions) {
    taskTypeOptions.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
    taskTypeOptions.querySelector('[data-value=""]')?.classList.add('active');
  }
};

(window as any).handleSerialAutoFill = (serial: string) => {
  const turbineInput = document.getElementById('nt-turbine') as HTMLInputElement;
  const siteInput = document.getElementById('nt-site') as HTMLInputElement;
  const siteIdInput = document.getElementById('nt-site-id') as HTMLInputElement;
  const errDiv = document.getElementById('nt-serial-error');
  const turbineCard = document.getElementById('telemetry-turbine-card');
  const siteCard = document.getElementById('telemetry-site-card');

  if (!turbineInput || !siteInput) return;
  if (errDiv) errDiv.style.display = 'none';

  if (serial.length < 3) {
    resetTelemetryCards();
    return;
  }

  const sites = dataService.getAllSites();
  let found = false;

  for (const site of sites) {
    const turbines = dataService.getTurbinesBySite(site.id);
    const matchedTurbine = turbines.find(t => t.id === serial);
    
    if (matchedTurbine) {
      turbineInput.value = matchedTurbine.label || `T-${matchedTurbine.no}`;
      siteInput.value = site.name;
      siteIdInput.value = site.id;
      
      turbineInput.classList.add('auto-filled');
      siteInput.classList.add('auto-filled');
      turbineInput.style.color = '#00f3ff';
      siteInput.style.color = '#00f3ff';

      if (turbineCard && siteCard) {
        turbineCard.style.borderColor = 'rgba(0, 243, 255, 0.4)';
        turbineCard.style.background = 'rgba(0, 243, 255, 0.03)';
        turbineCard.querySelector('.status-indicator')?.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #00f3ff; box-shadow: 0 0 10px #00f3ff;');
        
        siteCard.style.borderColor = 'rgba(0, 243, 255, 0.4)';
        siteCard.style.background = 'rgba(0, 243, 255, 0.03)';
        siteCard.querySelector('.status-indicator')?.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #00f3ff; box-shadow: 0 0 10px #00f3ff;');
      }

      found = true;
      break;
    }
  }

  if (!found) {
    turbineInput.value = 'Kayıt Bulunamadı';
    siteInput.value = 'Kayıt Bulunamadı';
    siteIdInput.value = '';
    turbineInput.classList.remove('auto-filled');
    siteInput.classList.remove('auto-filled');
    turbineInput.style.color = '#ff4d4d';
    siteInput.style.color = '#ff4d4d';

    if (turbineCard && siteCard) {
      turbineCard.style.borderColor = 'rgba(255, 77, 77, 0.3)';
      turbineCard.style.background = 'rgba(255, 77, 77, 0.02)';
      turbineCard.querySelector('.status-indicator')?.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 10px #ff4d4d;');
      
      siteCard.style.borderColor = 'rgba(255, 77, 77, 0.3)';
      siteCard.style.background = 'rgba(255, 77, 77, 0.02)';
      siteCard.querySelector('.status-indicator')?.setAttribute('style', 'width: 8px; height: 8px; border-radius: 50%; background: #ff4d4d; box-shadow: 0 0 10px #ff4d4d;');
    }
    
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    if (!isAdmin && serial.length >= 3) {
      const globalTurbineInfo = dataService.findTurbineBySerial(serial);
      if (globalTurbineInfo && errDiv) {
        errDiv.style.display = 'block';
      }
    }
  }
};

// Form Gönderimi
(window as any).handleNewTaskSubmit = async (e: Event) => {
  e.preventDefault();
  const btn = document.getElementById('nt-submit-btn') as HTMLButtonElement;
  if (!btn) return;

  const isWarehouse = formLocationMode === 'WAREHOUSE';
  const siteId = (document.getElementById('nt-site-id') as HTMLInputElement).value;
  
  if (!siteId) {
    alert(isWarehouse ? "Lütfen bir Depo / Tesis seçiniz." : "Geçerli bir Türbin Seri No giriniz.");
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ATANIYOR...';

  try {
    const serial = isWarehouse ? 'DEPO' : (document.getElementById('nt-serial') as HTMLInputElement).value;
    const turbine = (document.getElementById('nt-turbine') as HTMLInputElement).value;
    const site = (document.getElementById('nt-site') as HTMLInputElement).value;
    const taskType = (document.getElementById('nt-task-type') as HTMLSelectElement).value;
    const team = (document.getElementById('nt-team') as HTMLSelectElement).value;
    const faultCode = (document.getElementById('nt-fault-code-value') as HTMLInputElement)?.value || '';
    const whQty = parseInt((document.getElementById('nt-wh-qty') as HTMLInputElement)?.value || '1', 10);
    const plannedStopDesc = (document.getElementById('nt-planned-stop-desc') as HTMLTextAreaElement)?.value.trim() || '';
    
    if (!taskType) {
      alert("Lütfen bir Görev Kategorisi seçiniz.");
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    if (isWarehouse && (taskType.includes('Defect') || taskType.includes('Onarım') || taskType.includes('Revizyon')) && !selectedDefectItem) {
      alert("Lütfen onarılacak arızalı (DEFECT) malzemeyi listeden seçiniz.");
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    const isPool = team === 'HAVUZ' || team === 'Atanmadı';
    const allowed = dataService.getAllowedTeams();
    if (!isPool && (!team || !allowed.includes(team))) {
      alert("Lütfen görev için yetkili olduğunuz bir ekip seçiniz veya Bölge Havuzu'nu belirleyin.");
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    if (!isWarehouse && taskType === 'Türbin Arıza Formu') {
      if (!faultCode || faultCode === '---' || !statusService.getCodeByKod(faultCode)) {
        alert('Lütfen arama sonuçlarından geçerli bir Arıza Kodu seçiniz.');
        btn.disabled = false;
        btn.innerHTML = originalText;
        return;
      }
    }

    if (!isWarehouse && taskType === 'Planlı Duruş' && !plannedStopDesc) {
      alert("Lütfen planlı duruş için bir açıklama giriniz.");
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }
    
    let templateName = taskType;
    let maintenanceData = undefined;

    if (!isWarehouse && taskType === 'Bakım') {
      const templateId = (document.getElementById('nt-maintenance-template') as HTMLSelectElement).value;
      const templateObj = await maintenanceService.getTemplate(templateId);
      if (templateObj) {
        templateName = templateObj.name;
        maintenanceData = {
          templateId: templateObj.id,
          checklist: templateObj.checklist,
          materials: templateObj.materials
        };
      }
    } else if (!isWarehouse && taskType === 'Türbin Arıza Formu') {
      const templateObj = await maintenanceService.getTemplate('form-ariza');
      if (templateObj) {
        maintenanceData = {
          templateId: templateObj.id,
          checklist: templateObj.checklist,
          materials: templateObj.materials
        };
      }
    }

    let note = '';
    if (isWarehouse) {
      if (selectedDefectItem) {
        note = `Depo Onarım Görevi: ${selectedDefectItem.sapNo} - ${selectedDefectItem.description} (${whQty} Adet)${plannedStopDesc ? ` | Not: ${plannedStopDesc}` : ''}`;
      } else {
        note = `Depo Görevi: ${taskType}${plannedStopDesc ? ` | Not: ${plannedStopDesc}` : ''}`;
      }
    } else {
      note = taskType === 'Planlı Duruş' ? plannedStopDesc : `Sistemden atanan ${templateName} görevi.`;
    }

    // Logic Engine'e kaydet
    await taskService.createNewTask({
      secilenSablon: isWarehouse ? `Depo İşi: ${taskType}` : templateName,
      sahaBilgisi: site,
      siteId: siteId,
      turbinSeriNo: serial,
      turbinNo: turbine,
      statuKodu: faultCode,
      yoneticiNotu: note,
      assignedTeam: isPool ? 'HAVUZ' : team,
      isPoolTask: isPool,
      customStatus: isPool ? 'Açık Görev' : undefined,
      taskLocationType: isWarehouse ? 'WAREHOUSE' : 'TURBINE',
      warehouseId: isWarehouse ? siteId : undefined,
      warehouseName: isWarehouse ? turbine : undefined,
      repairedMaterial: isWarehouse && selectedDefectItem ? {
        itemId: selectedDefectItem.id || '',
        sapNo: String(selectedDefectItem.sapNo || ''),
        description: selectedDefectItem.description || '',
        quantity: whQty || 1
      } : undefined,
      maintenanceData
    });

    // Başarılı
    btn.style.background = isPool ? '#f59e0b' : 'var(--accent-green)';
    btn.style.borderColor = isPool ? '#f59e0b' : 'var(--accent-green)';
    btn.innerHTML = isPool ? '<i class="fa-solid fa-users-viewfinder"></i> BÖLGE ORTAK GÖREVİNE EKLENDİ' : '<i class="fa-solid fa-check-double"></i> BAŞARIYLA ATANDI';
    
    (document.getElementById('new-task-form') as HTMLFormElement).reset();
    (window as any).handleTaskTypeChange('');
    resetTelemetryCards();

    const allowedOnReset = dataService.getAllowedTeams();
    if (allowedOnReset.length === 1) {
      const defaultTeam = allowedOnReset[0];
      const teamHidden = document.getElementById('nt-team') as HTMLInputElement;
      const teamLabel = document.getElementById('nt-team-selected-label');
      if (teamHidden) teamHidden.value = defaultTeam;
      if (teamLabel) {
        teamLabel.textContent = defaultTeam;
        teamLabel.style.color = '#ffffff';
      }
    }

  } catch (error) {
    console.error("Görev atama hatası:", error);
    btn.style.background = 'var(--accent-red)';
    btn.style.borderColor = 'var(--accent-red)';
    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> HATA OLUŞTU';
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.style.background = '';
      btn.style.borderColor = '';
      btn.innerHTML = originalText;
    }, 3000);
  }
};
