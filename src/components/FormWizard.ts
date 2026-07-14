import { dataService } from '../services/DataService';
import { taskService } from '../services/TaskService';
import { statusService } from '../services/StatusService';
import { maintenanceService } from '../services/MaintenanceService';

export const NewTaskForm = async () => {
  const templates = await maintenanceService.fetchTemplates();
  
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
      { id: 'nt-team', label: 'Atanacak Ekip Seçiniz...' }
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
              otherOpt?.classList.add('hidden');
              otherTrig?.querySelector('.fa-chevron-down')?.classList.remove('rotate-180');
            }
          });

          options.classList.toggle('hidden');
          const icon = trigger.querySelector('.fa-chevron-down');
          if (icon) {
            icon.classList.toggle('rotate-180');
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

            // Trigger change logic
            if (dd.id === 'nt-task-type') {
              (window as any).handleTaskTypeChange(val);
            }
          });
        });
      }
    });

    // Close on outside click
    document.addEventListener('click', () => {
      dropdowns.forEach(dd => {
        const options = document.getElementById(`${dd.id}-options`);
        const trigger = document.getElementById(`${dd.id}-trigger`);
        options?.classList.add('hidden');
        const icon = trigger?.querySelector('.fa-chevron-down');
        if (icon) icon.classList.remove('rotate-180');
      });
    });

    // Check if task creation was triggered with pre-filled parameters
    const activeTask = (window as any).appState?.activeTask;
    if (activeTask && activeTask.prefilledSerial) {
      const serialInput = document.getElementById('nt-serial') as HTMLInputElement;
      if (serialInput) {
        serialInput.value = activeTask.prefilledSerial;
        // Set tempActiveTask so handleSerialAutoFill can access prefilledMaintType
        (window as any).tempActiveTask = activeTask;
        // Trigger autofill to resolve site and turbine number
        (window as any).handleSerialAutoFill(activeTask.prefilledSerial);
      }
      if (activeTask.prefilledTaskType) {
        const taskTypeInput = document.getElementById('nt-task-type') as HTMLInputElement;
        if (taskTypeInput) {
          taskTypeInput.value = activeTask.prefilledTaskType;
          const selectedLabel = document.getElementById('nt-task-type-selected-label');
          if (selectedLabel) {
            if (activeTask.prefilledTaskType === 'Bakım') {
              selectedLabel.textContent = '🔧 Periyodik Bakım Görevi';
            } else if (activeTask.prefilledTaskType === 'Türbin Arıza Formu') {
              selectedLabel.textContent = '🚨 Türbin Arıza Formu';
            } else {
              selectedLabel.textContent = activeTask.prefilledTaskType;
            }
            selectedLabel.style.color = '#ffffff';
          }
          const options = document.getElementById('nt-task-type-options');
          if (options) {
            options.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
            const matchOpt = options.querySelector(`[data-value="${activeTask.prefilledTaskType}"]`);
            if (matchOpt) {
              matchOpt.classList.add('active');
            }
          }
          // Fire the task type changed event handler
          (window as any).handleTaskTypeChange(activeTask.prefilledTaskType);
        }
      }
      // Clear parameter from state so it does not repeat
      (window as any).appState.activeTask = null;
    }
  }, 100);

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; align-items: center;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; width: 100%; max-width: 750px;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.25rem;">
            <i class="fa-solid fa-circle-plus" style="color: var(--accent-cyan); text-shadow: 0 0 10px rgba(0,243,255,0.3);"></i> Yeni İş Emri Oluştur
          </h1>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.85rem;">Türbin bazlı yeni operasyonel iş emri atama formu.</p>
        </div>
      </div>

      <div class="glass-panel" style="padding: 2.5rem; width: 100%; max-width: 750px; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; background: rgba(13, 18, 30, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.6); position: relative;">
        <div style="position: absolute; top: -5%; left: 10%; width: 150px; height: 100px; background: rgba(0, 243, 255, 0.03); filter: blur(60px); border-radius: 50%;"></div>
        
        <form id="new-task-form" onsubmit="window.handleNewTaskSubmit(event)">
          
          <!-- Section 1: Telemetry Verification -->
          <div class="cyber-form-section-title">
            <i class="fa-solid fa-satellite-dish"></i> 01. Türbin Doğrulama
          </div>
          
          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">TÜRBİN SERİ NO SORGULA</label>
            <div style="position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.9rem;"></i>
              <input type="text" id="nt-serial" class="cyber-input" placeholder="Türbin seri numarası girin (Örn: 41193)..." oninput="window.handleSerialAutoFill(this.value)" autocomplete="off" required style="padding-left: 42px; font-size: 0.95rem; height: 48px; border-radius: 10px;">
            </div>
            <div id="nt-serial-error" style="color: var(--accent-orange); font-size: 0.8rem; margin-top: 0.75rem; display: none; font-weight: 600; padding: 10px 12px; background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255, 170, 0, 0.2); border-radius: 8px;">
              <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> Yetkisiz saha işlemi! Farklı seri numarası girerseniz, iş emri oluşturmasını teknik destekten talep edin.
            </div>
          </div>

          <!-- Telemetry readouts -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem; margin-bottom: 2rem;">
            <div id="telemetry-turbine-card" class="telemetry-card" style="position: relative; display: flex; flex-direction: column; gap: 6px; padding: 1rem 1.25rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <span style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase;">
                  <i class="fa-solid fa-fan" style="margin-right: 5px;"></i> TÜRBİN NO
                </span>
                <div class="status-indicator" style="width: 8px; height: 8px; border-radius: 50%; background: #374151; box-shadow: 0 0 8px rgba(0,0,0,0.5); transition: all 0.3s;"></div>
              </div>
              <input type="text" id="nt-turbine" class="cyber-telemetry-input" readonly style="background: transparent; border: none; font-size: 1.2rem; font-weight: 800; color: var(--text-muted); padding: 0; outline: none; width: 100%; pointer-events: none; text-transform: uppercase; font-family: 'Rajdhani', sans-serif;" placeholder="Sorgu Bekleniyor...">
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
          <div class="cyber-form-section-title" style="margin-top: 2rem;">
            <i class="fa-solid fa-clipboard-list"></i> 02. Görev Tanımlama ve Şablon
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">GÖREV KATEGORİSİ</label>
            <div class="custom-dropdown" id="nt-task-type-dropdown-wrapper" style="position: relative; width: 100%;">
              <div class="cyber-input custom-dropdown-trigger" id="nt-task-type-trigger" style="padding-left: 42px; font-size: 0.9rem; height: 48px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15);">
                <i class="fa-solid fa-list-check" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
                <span id="nt-task-type-selected-label" style="color: var(--text-muted);">Görev Türü Seçiniz...</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s;"></i>
              </div>
              <div class="custom-dropdown-options hidden glass-panel" id="nt-task-type-options" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: rgba(13, 18, 30, 0.98); border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); max-height: 250px; overflow-y: auto; z-index: 100;">
                <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;">
                  Görev Türü Seçiniz...
                </div>
                <div class="custom-dropdown-option" data-value="Türbin Arıza Formu" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                  <span>🚨 Türbin Arıza Formu</span>
                </div>
                <div class="custom-dropdown-option" data-value="Bakım" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                  <span>🔧 Periyodik Bakım Görevi</span>
                </div>
                <div class="custom-dropdown-option" data-value="Planlı Duruş" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                  <span>📅 Planlı Operasyonel Duruş</span>
                </div>
              </div>
              <input type="hidden" id="nt-task-type" required>
            </div>
          </div>

          <!-- Planned Stop Description Input (Dynamic) -->
          <div id="nt-planned-stop-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.5rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">PLANLI DURUŞ AÇIKLAMASI</label>
            <div style="position: relative;">
              <i class="fa-solid fa-align-left" style="position: absolute; left: 14px; top: 15px; color: var(--accent-cyan); font-size: 0.9rem; z-index: 5;"></i>
              <textarea id="nt-planned-stop-desc" class="cyber-input" placeholder="Lütfen duruş nedenini/açıklamasını yazın (Örn: Rulman Onarımı, Kanat Revizyonu vb.)..." style="padding-left: 42px; padding-top: 12px; height: 100px; border-radius: 10px; resize: none; font-size: 0.95rem; font-family: 'Rajdhani', sans-serif; box-sizing: border-box; width: 100%; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15); color: #fff;"></textarea>
            </div>
          </div>
          
          <!-- Fault Code Input (Dynamic) -->
          <div id="nt-fault-code-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.5rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">ARIZA HATA KODU SEÇİNİZ</label>
            <div style="position: relative;">
              <i class="fa-solid fa-triangle-exclamation" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #ff4d4d; font-size: 0.9rem;"></i>
              <input type="text" id="nt-fault-search" class="cyber-input" placeholder="Arıza kodu veya açıklaması yazarak arayın..." oninput="window.handleFaultSearch(this.value)" autocomplete="off" style="padding-left: 42px; height: 48px; border-radius: 10px;">
              <div id="nt-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; top: 100%; z-index: 100; border-color: rgba(255, 77, 77, 0.25); background: rgba(13, 18, 30, 0.98); box-shadow: 0 10px 30px rgba(0,0,0,0.6); max-height: 220px; overflow-y: auto; border-radius: 10px;"></div>
              <input type="hidden" id="nt-fault-code-value">
            </div>
          </div>

          <!-- Maintenance Template Input (Dynamic) -->
          <div id="nt-maintenance-section" class="form-group fade-in-up" style="display: none; margin-bottom: 1.5rem; padding: 1.25rem; border: 1px dashed rgba(0, 243, 255, 0.25); border-radius: 12px; background: rgba(0, 243, 255, 0.015);">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">UYGULANACAK BAKIM ŞABLONU</label>
            <div style="position: relative;">
              <i class="fa-solid fa-screwdriver-wrench" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
              <select id="nt-maintenance-template" class="cyber-input" onchange="window.handleMaintenanceTemplateChange(this.value)" style="padding-left: 42px; font-size: 0.9rem; height: 46px; border-radius: 8px; cursor: pointer; font-weight: 600; width: 100%;">
                <option value="">Bakım Şablonu Seçiniz...</option>
                ${Object.keys(groupedTemplates).sort().map(model => `
                  <optgroup label="${model} SERİSİ" style="background: #0d1117; color: #fff;">
                    ${groupedTemplates[model].map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
                  </optgroup>
                `).join('')}
              </select>
            </div>
            
            <!-- Template Checklist Preview Panel -->
            <div id="nt-template-preview" class="glass-panel mt-3 hidden" style="background: rgba(0,0,0,0.3); border-color: rgba(0, 243, 255, 0.15); padding: 1rem; border-radius: 8px;">
              <h4 style="color: var(--accent-cyan); font-size: 0.65rem; font-weight: 900; margin: 0 0 0.8rem 0; letter-spacing: 1.5px; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
                <i class="fa-solid fa-list-check"></i> Şablon Kontrol Adımları
              </h4>
              <div id="nt-preview-checklist" class="space-y-1" style="max-height: 150px; overflow-y: auto; padding-right: 5px; font-family: 'Inter', sans-serif;">
                <!-- Checklist items populating dynamically -->
              </div>
            </div>
          </div>

          <!-- Section 3: Dispatch & Allocation -->
          <div class="cyber-form-section-title" style="margin-top: 2rem;">
            <i class="fa-solid fa-people-carry-box"></i> 03. Ekip Atama ve Koordinasyon
          </div>

          <div class="form-group" style="margin-bottom: 2.5rem;">
            <label style="color: var(--text-dim); font-size: 0.7rem; font-weight: 800; letter-spacing: 1px; display: block; margin-bottom: 0.5rem;">GÖREV İÇİN EKİP ATAMA</label>
            <div class="custom-dropdown" id="nt-team-dropdown-wrapper" style="position: relative; width: 100%;">
              <div class="cyber-input custom-dropdown-trigger" id="nt-team-trigger" style="padding-left: 42px; font-size: 0.9rem; height: 48px; border-radius: 10px; cursor: pointer; font-weight: 700; display: flex; align-items: center; justify-content: space-between; box-sizing: border-box; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 243, 255, 0.15);">
                <i class="fa-solid fa-users" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; pointer-events: none; z-index: 5;"></i>
                <span id="nt-team-selected-label" style="color: var(--text-muted);">Atanacak Ekip Seçiniz...</span>
                <i class="fa-solid fa-chevron-down" style="font-size: 0.75rem; color: var(--text-muted); transition: transform 0.2s;"></i>
              </div>
              <div class="custom-dropdown-options hidden glass-panel" id="nt-team-options" style="position: absolute; top: 100%; left: 0; right: 0; margin-top: 6px; background: rgba(13, 18, 30, 0.98); border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 10px; box-shadow: 0 10px 30px rgba(0,0,0,0.7); max-height: 250px; overflow-y: auto; z-index: 100;">
                <div class="custom-dropdown-option active" data-value="" style="padding: 10px 16px; font-size: 0.85rem; color: var(--text-muted); cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;">
                  Atanacak Ekip Seçiniz...
                </div>
                ${dataService.getAllowedTeams().map(team => `
                  <div class="custom-dropdown-option" data-value="${team}" style="padding: 10px 16px; font-size: 0.85rem; color: #c9d1d9; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.03); display: flex; align-items: center; gap: 8px; transition: all 0.2s;">
                    <i class="fa-solid fa-user-group" style="font-size: 0.75rem; color: var(--accent-cyan); opacity: 0.7;"></i>
                    <span>${team}</span>
                  </div>
                `).join('')}
              </div>
              <input type="hidden" id="nt-team" required>
            </div>
          </div>

          <!-- Form Submit Button -->
          <div style="border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 1.75rem; display: flex; justify-content: flex-end;">
            <button type="submit" id="nt-submit-btn" class="btn-cyber" style="width: 100%; max-width: 320px; padding: 12px 24px; font-size: 0.85rem; background: var(--accent-cyan); border-color: var(--accent-cyan); box-shadow: 0 4px 20px rgba(0, 242, 254, 0.2); font-weight: 800; height: 48px; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 8px;">
              <i class="fa-solid fa-paper-plane" style="font-size: 0.95rem;"></i> GÖREVİ ATAMASINI GERÇEKLEŞTİR
            </button>
          </div>

        </form>
      </div>
    </div>

    <style>
      .cyber-form-section-title {
        font-family: 'Rajdhani', sans-serif;
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--accent-cyan);
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 1.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
        border-bottom: 1px solid rgba(0, 243, 255, 0.1);
        padding-bottom: 8px;
        text-shadow: 0 0 8px rgba(0, 243, 255, 0.15);
      }
      .cyber-telemetry-input::placeholder {
        color: rgba(255, 255, 255, 0.15) !important;
        font-weight: 700;
      }
      .telemetry-card {
        box-shadow: inset 0 2px 4px rgba(0,0,0,0.4);
      }
      .custom-dropdown-trigger {
        position: relative;
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: space-between;
      }
      .custom-dropdown-trigger:hover {
        border-color: rgba(0, 243, 255, 0.45) !important;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.15) !important;
      }
      .custom-dropdown-option {
        padding: 10px 16px;
        font-size: 0.85rem;
        color: #c9d1d9;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        transition: all 0.2s ease;
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

(window as any).handleTaskTypeChange = (type: string) => {
  const maintenanceSection = document.getElementById('nt-maintenance-section');
  const maintenanceTemplate = document.getElementById('nt-maintenance-template') as HTMLSelectElement;
  
  if (!maintenanceSection || !maintenanceTemplate) return;

  if (type === 'Bakım') {
    maintenanceSection.style.display = 'block';
    maintenanceTemplate.required = true;
  } else {
    maintenanceSection.style.display = 'none';
    maintenanceTemplate.required = false;
    maintenanceTemplate.value = '';
  }

  // Arıza Kodu Bölümü
  const faultSection = document.getElementById('nt-fault-code-section');
  const faultSearch = document.getElementById('nt-fault-search') as HTMLInputElement;
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

  // Planlı Duruş Açıklama Bölümü
  const plannedStopSection = document.getElementById('nt-planned-stop-section');
  const plannedStopDesc = document.getElementById('nt-planned-stop-desc') as HTMLTextAreaElement;
  if (plannedStopSection) {
    if (type === 'Planlı Duruş') {
      plannedStopSection.style.display = 'block';
      if (plannedStopDesc) plannedStopDesc.required = true;
    } else {
      plannedStopSection.style.display = 'none';
      if (plannedStopDesc) {
        plannedStopDesc.required = false;
        plannedStopDesc.value = '';
      }
    }
  }

  // Preview'ı da temizle
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

  const teamInput = document.getElementById('nt-team') as HTMLInputElement;
  const teamLabel = document.getElementById('nt-team-selected-label');
  const teamOptions = document.getElementById('nt-team-options');
  if (teamInput) teamInput.value = '';
  if (teamLabel) {
    teamLabel.innerText = 'Atanacak Ekip Seçiniz...';
    teamLabel.style.color = 'var(--text-muted)';
  }
  if (teamOptions) {
    teamOptions.querySelectorAll('.custom-dropdown-option').forEach(o => o.classList.remove('active'));
    teamOptions.querySelector('[data-value=""]')?.classList.add('active');
  }
};

(window as any).autoSelectBestTemplate = (turbineType: string, maintType: string) => {
  const selectEl = document.getElementById('nt-maintenance-template') as HTMLSelectElement;
  if (!selectEl) return;
  
  const tModel = turbineType.replace(/[^0-9a-zA-Z]/g, '').toUpperCase(); // E-48 -> E48
  const searchType = maintType.toUpperCase().includes('YAĞ') ? 'YAĞ' : 'ANA';
  
  let matchedOptionValue = '';
  for (let i = 0; i < selectEl.options.length; i++) {
    const opt = selectEl.options[i];
    const optText = opt.text.toUpperCase();
    const optVal = opt.value;
    
    // Skip 4-year templates as requested by the user
    if (/4\s*YIL|4\.YIL|4-YIL/.test(optText)) {
      continue;
    }
    
    if (optText.includes(tModel) && (searchType === 'YAĞ' ? (optText.includes('YAĞ') || optText.includes('YAG')) : optText.includes('ANA'))) {
      matchedOptionValue = optVal;
      break;
    }
  }
  
  // Fallback: match model only (still skipping 4-year templates)
  if (!matchedOptionValue) {
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optText = opt.text.toUpperCase();
      
      if (/4\s*YIL|4\.YIL|4-YIL/.test(optText)) {
        continue;
      }
      
      if (optText.includes(tModel)) {
        matchedOptionValue = opt.value;
        break;
      }
    }
  }
  
  if (matchedOptionValue) {
    selectEl.value = matchedOptionValue;
    // Trigger any change handler
    const event = new Event('change');
    selectEl.dispatchEvent(event);
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

  // Seri no üzerinden türbin ve saha bulma
  const sites = dataService.getSites();
  let found = false;

  for (const site of sites) {
    const turbines = dataService.getTurbinesBySite(site.id);
    const matchedTurbine = turbines.find(t => t.id === serial);
    
    if (matchedTurbine) {
      turbineInput.value = matchedTurbine.label || `T-${matchedTurbine.no}`;
      siteInput.value = site.name;
      siteIdInput.value = site.id;
      
      // Cyber glow effect
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

      // Prefilled template logic
      const activeTask = (window as any).tempActiveTask;
      if (activeTask && activeTask.prefilledMaintType) {
        // Auto select best template based on type
        (window as any).autoSelectBestTemplate(matchedTurbine.type || '', activeTask.prefilledMaintType);
        (window as any).tempActiveTask = null; // Clear
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
    
    // Check if the serial actually exists globally but the user is not authorized
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

  // Validation
  const siteId = (document.getElementById('nt-site-id') as HTMLInputElement).value;
  if (!siteId) {
    alert("Geçerli bir Türbin Seri No giriniz.");
    return;
  }

  const originalText = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> ATANIYOR...';

  try {
    const serial = (document.getElementById('nt-serial') as HTMLInputElement).value;
    const turbine = (document.getElementById('nt-turbine') as HTMLInputElement).value;
    const site = (document.getElementById('nt-site') as HTMLInputElement).value;
    const taskType = (document.getElementById('nt-task-type') as HTMLSelectElement).value;
    const team = (document.getElementById('nt-team') as HTMLSelectElement).value;
    const faultCode = (document.getElementById('nt-fault-code-value') as HTMLInputElement).value;
    
    if (!team) {
      alert("Lütfen görev için atanacak bir ekip seçiniz.");
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }

    if (taskType === 'Türbin Arıza Formu' && !faultCode) {
      alert('Lütfen arama sonuçlarından geçerli bir Arıza Kodu seçiniz. (Arama kutusuna yazdıktan sonra çıkan listeden tıklamalısınız)');
      btn.disabled = false;
      btn.innerHTML = originalText;
      return;
    }
    
    let templateName = taskType;
    let maintenanceData = undefined;

    if (taskType === 'Bakım') {
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
    } else if (taskType === 'Türbin Arıza Formu') {
      const templateObj = await maintenanceService.getTemplate('form-ariza');
      if (templateObj) {
        maintenanceData = {
          templateId: templateObj.id,
          checklist: templateObj.checklist,
          materials: templateObj.materials
        };
      }
    }


    const plannedStopDesc = (document.getElementById('nt-planned-stop-desc') as HTMLTextAreaElement)?.value || '';

    // Logic Engineer'ın motoruna gönder
    await taskService.createNewTask({
      secilenSablon: templateName,
      sahaBilgisi: site,
      siteId: siteId,
      turbinSeriNo: serial,
      turbinNo: turbine,
      statuKodu: faultCode,
      yoneticiNotu: taskType === 'Planlı Duruş' ? (plannedStopDesc || 'Planlı Operasyonel Duruş') : `Sistemden atanan ${templateName} görevi.`,
      assignedTeam: team,
      maintenanceData
    });


    // Başarılı
    btn.style.background = 'var(--accent-green)';
    btn.style.borderColor = 'var(--accent-green)';
    btn.innerHTML = '<i class="fa-solid fa-check-double"></i> BAŞARIYLA ATANDI';
    
    (document.getElementById('new-task-form') as HTMLFormElement).reset();
    (window as any).handleTaskTypeChange(''); // Form sıfırlanınca bakım menüsünü gizle
    
    resetTelemetryCards();

  } catch (error) {
    console.error("Görev atama hatası:", error);
    btn.style.background = 'var(--accent-red)';
    btn.style.borderColor = 'var(--accent-red)';
    btn.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> HATA OLUŞTU';
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.style.background = 'var(--accent-cyan)';
      btn.style.borderColor = 'var(--accent-cyan)';
      btn.innerHTML = originalText;
    }, 3000);
  }
};
