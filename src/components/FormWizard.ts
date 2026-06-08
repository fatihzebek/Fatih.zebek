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

  return `
    <div class="fade-in-up content-area">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h1 class="page-title" style="margin-bottom: 0;">
          <i class="fa-solid fa-plus-circle" style="color: var(--accent-cyan);"></i> Yeni İş Emri Oluştur
        </h1>
        <div class="badge" style="background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); border: 1px solid var(--accent-cyan);">
          DİNAMİK FORM
        </div>
      </div>

      <div class="glass-panel" style="padding: 2.5rem; max-width: 800px; margin: 0 auto; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <form id="new-task-form" onsubmit="window.handleNewTaskSubmit(event)">
          
          <!-- 1. Türbin Arama Bölümü -->
          <div class="form-group" style="margin-bottom: 2rem;">
            <label><i class="fa-solid fa-magnifying-glass"></i> TÜRBİN SERİ NO ARA</label>
            <input type="text" id="nt-serial" class="cyber-input" placeholder="Seri numarası girin (Örn: 41193)..." oninput="window.handleSerialAutoFill(this.value)" autocomplete="off" required>
            <div id="nt-serial-error" style="color: var(--accent-orange); font-size: 0.8rem; margin-top: 0.5rem; display: none; font-weight: 600;">
              <i class="fa-solid fa-triangle-exclamation"></i> Yetkisiz saha işlemi! Farklı seri numarası girerseniz, iş emri oluşturmasını teknik destekten talep edin.
            </div>
          </div>

          <!-- 2. Otomatik Doldurulacak Alanlar -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; margin-bottom: 2.5rem; padding: 1.5rem; background: rgba(0,0,0,0.2); border: 1px solid var(--glass-border); border-radius: 10px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label><i class="fa-solid fa-fan"></i> TÜRBİN NO</label>
              <input type="text" id="nt-turbine" class="cyber-input" readonly style="background: rgba(255,255,255,0.02); color: var(--text-muted); cursor: not-allowed;" placeholder="Otomatik doldurulacak...">
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label><i class="fa-solid fa-map-location-dot"></i> BÖLGE / SAHA</label>
              <input type="text" id="nt-site" class="cyber-input" readonly style="background: rgba(255,255,255,0.02); color: var(--text-muted); cursor: not-allowed;" placeholder="Otomatik doldurulacak...">
            </div>
            <input type="hidden" id="nt-site-id">
          </div>

          <!-- 3. Görev Seçim Bölümü -->
          <div class="form-group" style="margin-bottom: 2rem;">
            <label><i class="fa-solid fa-list-check"></i> GÖREV TÜRÜ</label>
            <select id="nt-task-type" class="cyber-input" onchange="window.handleTaskTypeChange(this.value)" required style="cursor: pointer;">
              <option value="">Seçiniz...</option>
              <option value="Türbin Arıza Formu">Türbin Arıza Formu</option>
              <option value="Bakım">Bakım</option>
              <option value="Planlı Duruş">Planlı Duruş</option>
            </select>
          </div>
          
          <!-- 3.1 Arıza Kodu Arama (Sadece Arıza Formu için) -->
          <div id="nt-fault-code-section" class="form-group fade-in-up" style="display: none; margin-bottom: 2rem;">
            <label><i class="fa-solid fa-triangle-exclamation"></i> ARIZA KODU</label>
            <div style="position: relative;">
              <input type="text" id="nt-fault-search" class="cyber-input" placeholder="Kod veya açıklama ile ara..." oninput="window.handleFaultSearch(this.value)" autocomplete="off">
              <div id="nt-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; top: 100%; z-index: 100;"></div>
              <input type="hidden" id="nt-fault-code-value">
            </div>
          </div>

          <!-- 4. Gizli/Dinamik Bakım Bölümü -->
          <div id="nt-maintenance-section" class="form-group fade-in-up" style="display: none; margin-bottom: 2rem; padding: 1.5rem; border: 1px dashed var(--accent-cyan); border-radius: 10px; background: rgba(0, 242, 254, 0.03);">
            <label><i class="fa-solid fa-screwdriver-wrench"></i> BAKIM ŞABLONU</label>
            <select id="nt-maintenance-template" class="cyber-input" onchange="window.handleMaintenanceTemplateChange(this.value)" style="cursor: pointer;">
              <option value="">Bakım Türünü Seçiniz...</option>
              ${Object.keys(groupedTemplates).sort().map(model => `
                <optgroup label="${model} SERİSİ">
                  ${groupedTemplates[model].map(t => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
                </optgroup>
              `).join('')}
            </select>
            
            <!-- Şablon Önizleme Paneli (Checklist İçin) -->
            <div id="nt-template-preview" class="glass-panel mt-4 hidden" style="background: rgba(0,0,0,0.3); border-color: rgba(0, 242, 254, 0.2); padding: 1rem;">
              <h4 style="color: var(--accent-cyan); font-size: 0.7rem; font-weight: 900; margin-bottom: 0.8rem; letter-spacing: 1px; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-list-check"></i> ŞABLON KONTROL ADIMLARI
              </h4>
              <div id="nt-preview-checklist" class="space-y-1" style="max-height: 150px; overflow-y: auto; padding-right: 5px;">
                <!-- Kontrol adımları buraya gelecek -->
              </div>
            </div>
          </div>

          <!-- 5. Ekip Atama Bölümü -->
          <div class="form-group" style="margin-bottom: 3rem;">
            <label><i class="fa-solid fa-users"></i> GÖREVLENDİRİLECEK EKİP</label>
            <select id="nt-team" class="cyber-input" required style="cursor: pointer;">
              <option value="">Ekip Seçiniz...</option>
              ${dataService.getAllowedTeams().map(team => `<option value="${team}">${team}</option>`).join('')}
            </select>
          </div>

          <!-- Aksiyon Butonu -->
          <div style="text-align: right; border-top: 1px solid var(--glass-border); padding-top: 1.5rem;">
            <button type="submit" id="nt-submit-btn" class="btn-cyber" style="width: 100%; max-width: 300px; padding: 1rem; font-size: 0.9rem; background: var(--accent-cyan); border-color: var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 242, 254, 0.2);">
              <i class="fa-solid fa-paper-plane"></i> GÖREVİ ATA
            </button>
          </div>

        </form>
      </div>
    </div>
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

(window as any).handleSerialAutoFill = (serial: string) => {
  const turbineInput = document.getElementById('nt-turbine') as HTMLInputElement;
  const siteInput = document.getElementById('nt-site') as HTMLInputElement;
  const siteIdInput = document.getElementById('nt-site-id') as HTMLInputElement;
  const errDiv = document.getElementById('nt-serial-error');

  if (!turbineInput || !siteInput) return;
  if (errDiv) errDiv.style.display = 'none';

  if (serial.length < 3) {
    turbineInput.value = '';
    siteInput.value = '';
    siteIdInput.value = '';
    turbineInput.classList.remove('auto-filled');
    siteInput.classList.remove('auto-filled');
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


    // Logic Engineer'ın motoruna gönder
    await taskService.createNewTask({
      secilenSablon: templateName,
      sahaBilgisi: site,
      siteId: siteId,
      turbinSeriNo: serial,
      turbinNo: turbine,
      statuKodu: faultCode,
      yoneticiNotu: `Sistemden atanan ${templateName} görevi.`,
      assignedTeam: team,
      maintenanceData
    });


    // Başarılı
    btn.style.background = 'var(--accent-green)';
    btn.style.borderColor = 'var(--accent-green)';
    btn.innerHTML = '<i class="fa-solid fa-check-double"></i> BAŞARIYLA ATANDI';
    
    (document.getElementById('new-task-form') as HTMLFormElement).reset();
    (window as any).handleTaskTypeChange(''); // Form sıfırlanınca bakım menüsünü gizle
    
    // Türbin ve saha inputlarını temizle
    const turbineInput = document.getElementById('nt-turbine') as HTMLInputElement;
    const siteInput = document.getElementById('nt-site') as HTMLInputElement;
    if (turbineInput) { turbineInput.value = ''; turbineInput.classList.remove('auto-filled'); }
    if (siteInput) { siteInput.value = ''; siteInput.classList.remove('auto-filled'); }

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
