import { dataService } from '../services/DataService';
import { statusService } from '../services/StatusService';
import { inventoryService } from '../services/InventoryService';
import { serviceReportService } from '../services/ServiceReportService';
import { taskService, type Task } from '../services/TaskService';
import { userService } from '../services/UserService';
import { auth, db } from '../firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';

export const FaultFormPage = (task?: Task): string => {
  const savedContext = localStorage.getItem('activeTaskContext');
  const currentTask = task || (savedContext ? JSON.parse(savedContext) : null);
  
  if (currentTask) {
    localStorage.setItem('activeTaskContext', JSON.stringify(currentTask));
    (window as any).currentTaskContext = currentTask;
  }

  const isTemplateMode = localStorage.getItem('currentEditingTemplateId') !== null;
  
  const sablonName = currentTask?.secilenSablon || '';
  const isMaintenanceTask = currentTask?.isMaintenance || 
                           ['bak-m', 'bakim', 'bakım', 'yag', 'yağ', 'kont', 'ana', 'bak'].some(k => sablonName.toLowerCase().includes(k)) &&
                           !sablonName.toLowerCase().includes('ariza');

  const isSmartEditor = isTemplateMode; 
  const isDeficiencyTask = currentTask?.type === 'EKSİKLİK';
  const hideFaultFields = isMaintenanceTask || isDeficiencyTask;

  (window as any).currentEditingTemplate = null;
  (window as any).smartAuditItems = [];
  (window as any).workSessions = [];

  setTimeout(async () => {
    (window as any).initFaultFormLogic();
  }, 50);

  return `
    <div class="fade-in-up content-area">
      <div style="padding: 0.8rem 2rem; background: rgba(15,23,42,0.95); border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: space-between;">
        <div style="display: flex; align-items: center; gap: 0.8rem;">
            <button onclick="(window as any).navigate('tasks')" 
                    style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--accent-cyan); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;"
                    onmouseover="this.style.background='rgba(100, 255, 218, 0.1)'"
                    onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                <i class="fa-solid fa-arrow-left" style="font-size: 0.8rem;"></i>
            </button>

            <div style="display: flex; flex-direction: column;">
              <h1 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                 <i class="fa-solid fa-file-pen" style="color: var(--accent-cyan); font-size: 0.9rem;"></i>
                 <span id="header-title">${isSmartEditor ? 'BAKIM ŞABLONU DÜZENLEME' : (currentTask?.secilenSablon || 'ARIZA MÜDAHALE FORMU')}</span>
              </h1>
              <p style="color: var(--accent-cyan); font-size: 0.65rem; font-weight: 800; margin: 0; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">
                <span id="header-subtitle">${isSmartEditor ? 'BAKIM TALİMATNAMESİ' : 'SERVİS VE MÜDAHALE KAYIT FORMU'}</span>
              </p>
            </div>
        </div>

        ${isSmartEditor ? `
          <div id="smart-summary-stats" style="display: flex; gap: 0.8rem;">
            <!-- Compact Stats -->
          </div>
        ` : ''}
      </div>

      ${isSmartEditor ? `
        <div id="smart-audit-container" style="padding: 1rem 2rem;">
           <div class="glass-panel" style="padding: 2rem; text-align: center;">
              <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--accent-cyan);"></i>
              <p style="margin-top: 1rem;">Akıllı Denetim Verileri Yükleniyor...</p>
           </div>
        </div>
        
        <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; margin-bottom: 5rem;">
           <button type="button" class="btn-cyber-outline" style="width: 150px;" onclick="(window as any).navigate('templates')">İPTAL</button>
           <button type="button" class="btn-cyber" style="width: 250px; background: var(--accent-green); border-color: var(--accent-green);" 
                   onclick="window.handleTemplateSave()">
             ŞABLONU KAYDET
           </button>
        </div>
      ` : `
      <div class="main-container" style="max-width: 1200px; padding: 2rem; margin: 0 auto;">
      <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: rgba(15,23,42,0.8); padding: 1.5rem; border-radius: 15px; border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px);">
        <div>
          <h2 style="font-size: 1.5rem; color: #fff; margin: 0; font-weight: 900; letter-spacing: 1px; display: flex; align-items: center; gap: 1rem;">
             <i class="fa-solid fa-file-signature" style="color: var(--accent-cyan);"></i>
             ${currentTask?.secilenSablon || 'ARIZA MÜDAHALE FORMU'}
          </h2>
          <p style="color: var(--text-muted); font-size: 0.75rem; margin: 0.3rem 0 0 2.5rem; font-weight: 500;">
            ${isMaintenanceTask ? 'Periyodik Bakım ve Kontrol Raporu' : 'Servis ve Müdahale Kayıt Formu'}
          </p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">REFERANS NO</div>
          <div style="font-size: 1rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px;">#${currentTask?.id?.slice(-6).toUpperCase() || 'NEW-FORM'}</div>
        </div>
      </header>

      <!-- TAB NAVIGATION -->
      ${isMaintenanceTask ? `
      <div class="form-tabs-wrapper" style="display: flex; gap: 1rem; margin-bottom: 2rem;">
        <button id="tab-btn-service" class="tab-btn active" onclick="window.switchFormTab('service')" style="flex: 1; padding: 1rem; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; color: #fff; font-weight: 800; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.8rem; border-color: rgba(0, 242, 254, 0.3);">
          <i class="fa-solid fa-list"></i> GENEL BİLGİLER
        </button>
        <button id="tab-btn-audit" class="tab-btn" onclick="window.switchFormTab('audit')" style="flex: 1; padding: 1rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; color: var(--text-muted); font-weight: 800; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 0.8rem;">
          <i class="fa-solid fa-clipboard-check"></i> BAKIM KONTROL LİSTESİ <span id="audit-tab-count"></span>
        </button>
      </div>
      ` : ''}

      <form id="detailed-ariza-form" class="cyber-form">
        <input type="hidden" id="form-task-id" value="${currentTask?.id || ''}">
        <input type="hidden" id="is-deficiency-task" value="${isDeficiencyTask ? 'true' : 'false'}">

        <!-- TAB CONTENT: SERVICE INFO -->
        <div id="tab-content-service">
          <!-- SECTION 1: GENEL BILGILER -->
          <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid var(--accent-cyan);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
              <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-circle-info"></i> SERVİS AYRINTILARI
              </h3>
            </div>
            <div class="fault-form-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1.5rem;">
            <div class="form-group">
              <label>TÜRBİN SERİ NO</label>
              <input type="text" id="turbin-seri" class="cyber-input" placeholder="Örn: 41193" oninput="window.handleSerialLookup(this.value)" autocomplete="off" required value="${currentTask?.turbinSeriNo || ''}">
            </div>
            <div class="form-group">
              <label>TARİH</label>
              <input type="date" id="form-date" class="cyber-input" value="${new Date().toISOString().split('T')[0]}" required>
            </div>
            
            <div class="form-group" style="display: ${hideFaultFields ? 'none' : 'block'};">
              <label>ARIZA KODU</label>
              <div style="position: relative;">
                <input type="text" id="form-fault-search" class="cyber-input" placeholder="Kod ara..." oninput="window.searchFaultCodes(this.value)" autocomplete="off" ${hideFaultFields ? '' : 'required'} value="${currentTask?.rawFaultCode || ''}">
                <div id="form-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; position: absolute; top: 100%; z-index: 1000; padding: 0;"></div>
              </div>
            </div>

            <div class="form-group">
              <label>TÜRBİN NO</label>
              <input type="text" id="turbin-no" class="cyber-input" placeholder="Oto dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed;" value="${currentTask?.turbineId || ''}">
            </div>
            <div class="form-group">
              <label>BÖLGE / SAHA</label>
              <input type="text" id="form-site-name" class="cyber-input" placeholder="Oto dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed;" value="${currentTask?.siteName || ''}">
              <input type="hidden" id="form-site" value="${currentTask?.realSiteId || currentTask?.siteId || ''}">
            </div>
            
            <div class="form-group" style="display: ${hideFaultFields ? 'none' : 'block'};">
              <label>ARIZA TANIMI</label>
              <textarea id="ariza-tanimi" class="cyber-input" rows="2" placeholder="Kod seçilince dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed; font-size: 0.8rem; line-height: 1.4;"></textarea>
            </div>
          </div>
        </div>

        <div style="display: none;">
            <input type="hidden" id="time-arrival">
            <input type="hidden" id="time-notification">
            <input type="hidden" id="wec-downtime">
            <input type="hidden" id="maint-on">
            <input type="hidden" id="maint-off">
            <input type="hidden" id="intervention-duration">
        </div>

        <!-- SECTION 2 & 3: ÇALIŞMA ZAMANLARI -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid var(--accent-orange); position: relative; z-index: 10;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 0.8rem; color: var(--accent-orange); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              <i class="fa-solid fa-clock-rotate-left"></i> ÇALIŞMA ZAMANLARI
            </h3>
            <button type="button" class="btn-cyber" style="padding: 0.4rem 1rem; font-size: 0.7rem; background: var(--accent-cyan); color: #000;" onclick="window.addWorkSession()">
              <i class="fa-solid fa-plus"></i> YENİ VARDİYA EKLE
            </button>
          </div>
          
          <div id="work-sessions-container" style="display: flex; flex-direction: column; gap: 1rem;">
             <!-- Sessions will be rendered here -->
          </div>

          <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: flex-end; align-items: center; gap: 2rem;">
             <div style="text-align: right;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">TOPLAM TÜRBİN SÜRESİ</span>
                <span id="total-turbine-hours-display" style="font-size: 1.4rem; font-weight: 900; color: var(--accent-cyan);">0.00</span>
             </div>
             <div style="text-align: right; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 2rem;">
                <span style="font-size: 0.7rem; color: var(--text-muted); display: block;">TOPLAM ADAM-SAAT</span>
                <span id="total-man-hours-display" style="font-size: 1.4rem; font-weight: 900; color: var(--accent-green);">0.00</span>
             </div>
          </div>
        </div>
        
        <!-- SECTION 5: YAPILAN İŞLEMLER VE FOTOĞRAFLAR -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid var(--accent-cyan);">
          <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-comment-medical"></i> YAPILAN İŞLEMLER VE FOTOĞRAFLAR
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem;">
            <div class="form-group">
              <label>YAPILAN İŞLEMLER / NOTLAR</label>
              <textarea id="form-notes" class="cyber-input" rows="6" placeholder="Yapılan müdahaleyi detaylıca açıklayınız..." style="min-height: 150px; line-height: 1.6;"></textarea>
            </div>
            <div class="form-group">
              <label>FOTOĞRAFLAR (MAX 5)</label>
              <div style="background: rgba(255,255,255,0.02); border: 2px dashed rgba(255,255,255,0.1); border-radius: 12px; padding: 1.5rem; text-align: center; border-color: var(--accent-cyan);">
                <input type="file" id="fault-images" multiple accept="image/*" style="display: none;">
                <button type="button" class="btn-cyber" onclick="document.getElementById('fault-images').click()" style="background: var(--accent-cyan); color: #000; margin-bottom: 1rem; width: 100%;">
                  <i class="fa-solid fa-camera"></i> FOTOĞRAF EKLE / ÇEK
                </button>
                <div id="image-previews" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; min-height: 80px;">
                  <div id="no-photo-msg" style="color: var(--text-muted); font-size: 0.8rem; font-style: italic; margin: auto;">Henüz fotoğraf seçilmedi</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- SECTION 7: MALZEME YÖNETİMİ -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; border-top: 3px solid var(--accent-green);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="font-size: 0.7rem; font-weight: 900; color: var(--accent-green); margin: 0; display: flex; align-items: center; gap: 0.5rem; letter-spacing: 1px;">
              <i class="fa-solid fa-boxes-stacked"></i> MALZEME YÖNETİMİ
            </h3>
            <div style="display: flex; align-items: center; gap: 2rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <label style="font-size: 0.7rem; color: var(--text-muted); margin: 0;">MALZEME ÇIKIŞ FORM NO:</label>
                <input type="text" id="mat-form-no" class="cyber-input" style="width: 150px; height: 30px; color: var(--accent-red); text-align: center; font-weight: 800;" placeholder="MÇF NO">
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <button type="button" class="btn-cyber" style="padding: 0.4rem 0.8rem; font-size: 0.65rem; background: var(--accent-green);" onclick="window.addMaterialRow()">MALZEME EKLE</button>
                <button type="button" class="btn-cyber" style="padding: 0.4rem 0.8rem; font-size: 0.65rem; background: var(--accent-red);" onclick="window.removeSelectedMaterials()">SATIR SİL</button>
              </div>
            </div>
          </div>
          
          <div style="overflow-x: auto;">
            <table class="cyber-table" style="width: 100%; border-collapse: collapse; font-size: 0.7rem;">
              <thead>
                <tr style="background: rgba(255,255,255,0.05);">
                  <th style="padding: 0.5rem; text-align: left;">POZ</th>
                  <th style="padding: 0.5rem; text-align: left;">S/T</th>
                  <th style="padding: 0.5rem; text-align: left;">SAP NO</th>
                  <th style="padding: 0.5rem; text-align: left;">SERİ NO</th>
                  <th style="padding: 0.5rem; text-align: left;">MALZEME AÇIKLAMASI</th>
                  <th style="padding: 0.5rem; text-align: center;">DEPODAN ALINAN</th>
                  <th style="padding: 0.5rem; text-align: center;">DEPOYA İADE</th>
                  <th style="padding: 0.5rem; text-align: center;">KULLANILAN</th>
                  <th style="padding: 0.5rem; text-align: center;">DEFECT</th>
                </tr>
              </thead>
              <tbody id="material-rows">
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div id="tab-content-audit" style="display: none;">
         <div id="smart-audit-container"></div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-bottom: 4rem;">
        <button type="button" id="save-draft-btn" class="btn-cyber-outline" style="border-color: var(--accent-orange); color: var(--accent-orange);" onclick="window.saveMaintenanceDraft()">
          <i class="fa-solid fa-floppy-disk"></i> TASLAĞI KAYDET
        </button>
        <div style="display: flex; gap: 1rem;">
          <button type="button" class="btn-cyber-outline" onclick="(window as any).navigate('tasks')">İPTAL</button>
          <button type="submit" id="submit-form-btn" class="btn-cyber" style="width: 250px; background: var(--accent-green); border-color: var(--accent-green); box-shadow: 0 0 15px rgba(0, 230, 118, 0.2);">RAPORU KAYDET VE GÖNDER</button>
        </div>
      </div>
      </form>
      </div>
      `}
    </div>
  `;
};

// --- LOGIC ---
(window as any).initFaultFormLogic = async () => {
    console.log("Initializing Fault Form Logic...");
    
    const isSmartEditor = localStorage.getItem('currentEditingTemplateId') !== null;
    const { maintenanceService } = await import('../services/MaintenanceService');

    if (isSmartEditor) {
        const templateId = localStorage.getItem('currentEditingTemplateId');
        if (templateId) {
            try {
                const tpl = await maintenanceService.getTemplate(templateId);
                if (tpl) {
                    (window as any).currentEditingTemplate = tpl;
                    (window as any).smartAuditItems = tpl.checklist || [];
                    
                    // Sync Header
                    const titleEl = document.getElementById('header-title');
                    const subtitleEl = document.getElementById('header-subtitle');
                    if (titleEl) titleEl.textContent = tpl.name || 'BAKIM ŞABLONU';
                    if (subtitleEl) subtitleEl.textContent = tpl.instructionCode || 'BAKIM TALİMATNAMESİ';

                    if (typeof (window as any).renderSmartAuditUI === 'function') {
                        (window as any).renderSmartAuditUI();
                    }
                }
            } catch (e) {
                console.error("Template load error:", e);
                const container = document.getElementById('smart-audit-container');
                if (container) container.innerHTML = `<div style="color:var(--accent-red); padding:2rem; text-align:center;">Şablon yüklenemedi!</div>`;
            }
        }
        return; 
    }

    const currentTask = (window as any).currentTaskContext;
    const sablonName = currentTask?.secilenSablon || '';
    const isMaintenance = ['bak-m', 'bakim', 'bakım', 'yag', 'yağ', 'kont', 'ana', 'bak'].some(k => sablonName.toLowerCase().includes(k)) && !sablonName.toLowerCase().includes('ariza');

    if (isMaintenance) {
        const templates = await maintenanceService.fetchTemplates();
        const tpl = templates.find(t => t.name === currentTask?.secilenSablon);
        if (tpl) {
            const subtitleEl = document.getElementById('header-subtitle');
            if (subtitleEl) subtitleEl.textContent = tpl.instructionCode || 'BAKIM TALİMATNAMESİ';
        }
    }

    const serialInput = document.getElementById('turbin-seri') as HTMLInputElement;
    if (serialInput && serialInput.value) {
        (window as any).handleSerialLookup(serialInput.value);
    }
    
    // Auto load materials if available
    const matRows = document.getElementById('material-rows');
    if (matRows && matRows.children.length === 0) {
        if (currentTask?.maintenanceData?.materials && currentTask.maintenanceData.materials.length > 0) {
            const mats = currentTask.maintenanceData.materials;
            const pairs = [];
            for (let i = 0; i < mats.length; i += 2) {
                pairs.push({ s: mats[i], t: mats[i + 1] });
            }
            pairs.forEach((p: any) => {
                if ((window as any).addMaterialRow) (window as any).addMaterialRow(p.s, p.t);
            });
        }
    }

    // Work Sessions Init
    if (!(window as any).workSessions || (window as any).workSessions.length === 0) {
        if (currentTask?.maintenanceData?.workSessions) {
            (window as any).workSessions = JSON.parse(JSON.stringify(currentTask.maintenanceData.workSessions));
        } else {
            (window as any).workSessions = [{
                id: Date.now().toString(),
                date: new Date().toISOString().split('T')[0],
                startTime: '',
                endTime: '',
                personnel: [],
                duration: '00:00'
            }];
        }
    }
    (window as any).renderWorkSessionsUI();

    // Checklist Init
    if (!(window as any).smartAuditItems || (window as any).smartAuditItems.length === 0) {
        if (currentTask?.maintenanceData?.checklist) {
            (window as any).smartAuditItems = JSON.parse(JSON.stringify(currentTask.maintenanceData.checklist));
        } else {
            (window as any).smartAuditItems = []; // Ideally loaded from template
        }
    }

    // Notes & Mat Form No
    if (currentTask?.maintenanceData) {
        const notes = document.getElementById('form-notes') as HTMLTextAreaElement;
        if (notes && currentTask.maintenanceData.notes) notes.value = currentTask.maintenanceData.notes;
        const matFormNo = document.getElementById('mat-form-no') as HTMLInputElement;
        if (matFormNo && currentTask.maintenanceData.matFormNo) matFormNo.value = currentTask.maintenanceData.matFormNo;
    }

    // Image Input
    const imgInput = document.getElementById('fault-images');
    if (imgInput) {
        imgInput.onchange = (e: any) => {
            if ((window as any).handleImagePreviews) (window as any).handleImagePreviews(e.target);
        };
    }

    // Cache Personnel
    const allUsers = await userService.getAllUsers();
    (window as any).allPersonnelNames = allUsers.map((u: any) => u.displayName?.toUpperCase() || 'İSİMSİZ');

    // Pre-fill fault code
    if (currentTask?.rawFaultCode) {
        (window as any).selectFormFault(currentTask.rawFaultCode);
    }
};

(window as any).renderWorkSessionsUI = () => {
    const container = document.getElementById('work-sessions-container');
    if (container) {
        container.innerHTML = ((window as any).workSessions || []).map((ws: any) => `
            <div class="session-row glass-panel" style="padding: 1rem; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.05); position: relative; margin-bottom: 1rem;">
                <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr auto; gap: 1rem; align-items: end;">
                    <div class="form-group">
                        <label style="font-size: 0.6rem;">TARİH</label>
                        <input type="date" class="cyber-input" value="${ws.date}" onchange="window.updateSessionField('${ws.id}', 'date', this.value)">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.6rem;">BAŞLANGIÇ</label>
                        <input type="time" class="cyber-input" value="${ws.startTime}" onchange="window.updateSessionField('${ws.id}', 'startTime', this.value)">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.6rem;">BİTİŞ</label>
                        <input type="time" class="cyber-input" value="${ws.endTime}" onchange="window.updateSessionField('${ws.id}', 'endTime', this.value)">
                    </div>
                    <div class="form-group">
                        <label style="font-size: 0.6rem;">SÜRE (SAAT)</label>
                        <input type="text" class="cyber-input" value="${ws.duration}" readonly style="background: rgba(0,0,0,0.1); color: var(--accent-cyan);">
                    </div>
                    <button type="button" class="btn-cyber" style="background: var(--accent-red); padding: 0.5rem;" onclick="window.removeWorkSession('${ws.id}')">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>
                
                <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <label style="font-size: 0.6rem; color: var(--text-muted);">GÖREVLİ PERSONELLER</label>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">
                        ${ws.personnel.map((p: string) => `
                            <span class="personnel-chip" style="background: rgba(0, 242, 254, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 0.2rem 0.5rem; border-radius: 4px; font-size: 0.7rem; display: flex; align-items: center; gap: 0.3rem;">
                                ${p} <i class="fa-solid fa-xmark" style="cursor: pointer;" onclick="window.removePersonnelFromSession('${ws.id}', '${p}')"></i>
                            </span>
                        `).join('')}
                        <div style="position: relative; flex: 1; min-width: 200px;">
                            <input type="text" class="cyber-input" style="height: 25px; font-size: 0.7rem;" placeholder="Personel ekle..." oninput="window.searchPersonnelForSession('${ws.id}', this)" autocomplete="off">
                            <div class="glass-panel hidden search-results-dropdown" style="width: 100%; position: absolute; top: 100%; z-index: 1000; padding: 0;"></div>
                        </div>
                    </div>
                </div>
            </div>
        `).join('');
    }
    (window as any).calculateTotalManHours();
};

(window as any).addWorkSession = () => {
    (window as any).workSessions.push({
        id: Date.now().toString(),
        date: new Date().toISOString().split('T')[0],
        startTime: '',
        endTime: '',
        personnel: [],
        duration: '00:00'
    });
    (window as any).renderWorkSessionsUI();
};

(window as any).removeWorkSession = (id: string) => {
    if ((window as any).workSessions.length <= 1) {
        alert("En az bir çalışma oturumu bulunmalıdır.");
        return;
    }
    (window as any).workSessions = (window as any).workSessions.filter((ws: any) => ws.id !== id);
    (window as any).renderWorkSessionsUI();
};

(window as any).updateSessionField = (id: string, field: string, value: string) => {
    const ws = (window as any).workSessions.find((w: any) => w.id === id);
    if (ws) {
        ws[field] = value;
        if (field === 'startTime' || field === 'endTime') {
            ws.duration = (window as any).calculateSessionDuration(ws.startTime, ws.endTime);
        }
        (window as any).renderWorkSessionsUI();
    }
};

(window as any).calculateSessionDuration = (start: string, end: string) => {
    if (!start || !end) return '00:00';
    const [h1, m1] = start.split(':').map(Number);
    const [h2, m2] = end.split(':').map(Number);
    let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
    if (diff < 0) diff += 1440;
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

(window as any).searchPersonnelForSession = (id: string, input: HTMLInputElement) => {
    const dropdown = input.nextElementSibling as HTMLElement;
    if (!dropdown) return;
    const term = input.value.toUpperCase();
    if (term.length < 1) { dropdown.classList.add('hidden'); return; }
    
    const all = (window as any).allPersonnelNames || [];
    const results = all.filter((n: string) => n.includes(term)).slice(0, 5);
    
    if (results.length === 0) { dropdown.classList.add('hidden'); return; }
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = results.map((r: string) => `
        <div class="search-item" onclick="window.addPersonnelToSession('${id}', '${r}')" style="padding: 0.5rem; font-size: 0.7rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05);" onmouseover="this.style.background='rgba(0,242,254,0.1)'" onmouseout="this.style.background=''">
            ${r}
        </div>
    `).join('');
};

(window as any).addPersonnelToSession = (id: string, name: string) => {
    const ws = (window as any).workSessions.find((w: any) => w.id === id);
    if (ws && !ws.personnel.includes(name)) {
        ws.personnel.push(name);
        (window as any).renderWorkSessionsUI();
    }
};

(window as any).removePersonnelFromSession = (id: string, name: string) => {
    const ws = (window as any).workSessions.find((w: any) => w.id === id);
    if (ws) {
        ws.personnel = ws.personnel.filter((p: string) => p !== name);
        (window as any).renderWorkSessionsUI();
    }
};

(window as any).calculateTotalManHours = () => {
    let manHours = 0;
    let turbineHours = 0;
    ((window as any).workSessions || []).forEach((ws: any) => {
        const [h, m] = (ws.duration || '00:00').split(':').map(Number);
        const durationH = h + (m / 60);
        turbineHours += durationH;
        manHours += durationH * (ws.personnel?.length || 0);
    });
    const mhEl = document.getElementById('total-man-hours-display');
    const thEl = document.getElementById('total-turbine-hours-display');
    if (mhEl) mhEl.innerText = manHours.toFixed(2);
    if (thEl) thEl.innerText = turbineHours.toFixed(2);
};

// FAULT SEARCH
(window as any).searchFaultCodes = async (term: string) => {
    const dropdown = document.getElementById('form-fault-results');
    if (!dropdown) return;
    if (term.length < 1) { dropdown.classList.add('hidden'); return; }
    
    // Quick check if exact match
    const exact = statusService.getCodeByKod(term);
    if (exact) {
        (window as any).selectFormFault(exact.KOD);
        dropdown.classList.add('hidden');
        return;
    }

    const results = statusService.searchCodes(term);
    if (results.length === 0) { dropdown.classList.add('hidden'); return; }
    
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = results.map((r: any) => `
        <div class="search-item" onclick="window.selectFormFault('${r.KOD}')" style="padding: 0.8rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.75rem;" onmouseover="this.style.background='rgba(0,242,254,0.1)'" onmouseout="this.style.background=''">
            <span style="color: var(--accent-cyan); font-weight: 700;">${r.KOD}</span> - ${r.Aciklama}
        </div>
    `).join('');
};

(window as any).selectFormFault = async (kod: string) => {
    const input = document.getElementById('form-fault-search') as HTMLInputElement;
    const desc = document.getElementById('ariza-tanimi') as HTMLTextAreaElement;
    const dropdown = document.getElementById('form-fault-results');
    const exact = statusService.getCodeByKod(kod);
    if (input && exact) {
        input.value = exact.KOD;
        if (desc) desc.value = exact.Aciklama;
        if (dropdown) dropdown.classList.add('hidden');
    }
};

(window as any).handleSerialLookup = async (serial: string) => {
    if (!serial) return;
    const turbine = dataService.findTurbineBySerial(serial);
    
    const siteNameEl = document.getElementById('form-site-name') as HTMLInputElement;
    const turbineNoEl = document.getElementById('turbin-no') as HTMLInputElement;
    const siteIdEl = document.getElementById('form-site') as HTMLInputElement;
    
    if (turbine) {
        if (siteNameEl) siteNameEl.value = turbine.siteName || '';
        if (turbineNoEl) turbineNoEl.value = turbine.turbineNo || '';
        if (siteIdEl) siteIdEl.value = turbine.siteId || '';
    }
};

(window as any).switchFormTab = (tab: string) => {
    const service = document.getElementById('tab-content-service');
    const audit = document.getElementById('tab-content-audit');
    const btnService = document.getElementById('tab-btn-service');
    const btnAudit = document.getElementById('tab-btn-audit');

    if (tab === 'service') {
        if (service) service.style.display = 'block';
        if (audit) audit.style.display = 'none';
        if (btnService) { btnService.classList.add('active'); btnService.style.background = 'rgba(0, 242, 254, 0.1)'; btnService.style.color = '#fff'; btnService.style.borderColor = 'rgba(0, 242, 254, 0.3)'; }
        if (btnAudit) { btnAudit.classList.remove('active'); btnAudit.style.background = 'rgba(255,255,255,0.02)'; btnAudit.style.color = 'var(--text-muted)'; btnAudit.style.borderColor = 'rgba(255,255,255,0.05)'; }
    } else {
        if (service) service.style.display = 'none';
        if (audit) audit.style.display = 'block';
        if (btnService) { btnService.classList.remove('active'); btnService.style.background = 'rgba(255,255,255,0.02)'; btnService.style.color = 'var(--text-muted)'; btnService.style.borderColor = 'rgba(255,255,255,0.05)'; }
        if (btnAudit) { btnAudit.classList.add('active'); btnAudit.style.background = 'rgba(0, 242, 254, 0.1)'; btnAudit.style.color = '#fff'; btnAudit.style.borderColor = 'rgba(0, 242, 254, 0.3)'; }
        if (typeof (window as any).renderSmartAuditUI === 'function') (window as any).renderSmartAuditUI();
    }
};

// IMAGES
(window as any).selectedFaultFiles = [];
(window as any).handleImagePreviews = (input: HTMLInputElement) => {
    if (!input.files) return;
    const files = Array.from(input.files);
    const container = document.getElementById('image-previews');
    const noMsg = document.getElementById('no-photo-msg');
    
    if (files.length + (window as any).selectedFaultFiles.length > 5) {
        alert("En fazla 5 fotoğraf yükleyebilirsiniz.");
        return;
    }
    
    if (files.length > 0 && noMsg) noMsg.style.display = 'none';
    
    files.forEach((file: File) => {
        (window as any).selectedFaultFiles.push(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            const wrapper = document.createElement('div');
            wrapper.style.position = 'relative';
            wrapper.style.width = '60px';
            wrapper.style.height = '60px';
            wrapper.style.borderRadius = '8px';
            wrapper.style.overflow = 'hidden';
            wrapper.style.border = '1px solid rgba(255,255,255,0.1)';
            
            const img = document.createElement('img');
            img.src = e.target?.result as string;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            
            const btn = document.createElement('button');
            btn.innerHTML = '<i class="fa-solid fa-times"></i>';
            btn.style.cssText = 'position:absolute; top:2px; right:2px; background:var(--accent-red); color:white; border:none; border-radius:50%; width:16px; height:16px; font-size:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;';
            btn.onclick = () => {
                wrapper.remove();
                (window as any).selectedFaultFiles = (window as any).selectedFaultFiles.filter((f: File) => f !== file);
                if ((window as any).selectedFaultFiles.length === 0 && noMsg) noMsg.style.display = 'block';
            };
            
            wrapper.appendChild(img);
            wrapper.appendChild(btn);
            if (container) container.appendChild(wrapper);
        };
        reader.readAsDataURL(file);
    });
    input.value = '';
};

// MATERIAL MANAGMENT
(window as any).addMaterialRow = (sData?: any, tData?: any) => {
    const tbody = document.getElementById('material-rows');
    if (tbody) {
        const poz = Math.floor(tbody.children.length / 2) + 1;
        
        const trS = document.createElement('tr');
        trS.setAttribute('data-type', 'S');
        trS.style.borderBottom = '1px solid rgba(255, 0, 85, 0.1)';
        trS.innerHTML = `
            <td style="padding: 0.5rem; color: #ff0055; font-weight: 800;">${poz}</td>
            <td style="padding: 0.5rem; color: #ff0055; font-weight: 800;">S</td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(255,0,85,0.3);" value="${sData?.sapNo || ''}" onchange="window.handleSapLookup(this)"></td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(255,0,85,0.3);" value="${sData?.serialNo || ''}"></td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(255,0,85,0.3);" value="${sData?.description || ''}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(255,0,85,0.3);" value="${sData?.received || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(255,0,85,0.3);" value="${sData?.returned || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(255,0,85,0.3);" value="${sData?.used || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(255,0,85,0.3);" value="${sData?.defectCount || 0}"></td>
        `;

        const trT = document.createElement('tr');
        trT.setAttribute('data-type', 'T');
        trT.style.borderBottom = '1px solid rgba(0, 230, 118, 0.1)';
        trT.innerHTML = `
            <td style="padding: 0.5rem; color: #00e676; font-weight: 800;">${poz}</td>
            <td style="padding: 0.5rem; color: #00e676; font-weight: 800;">T</td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(0,230,118,0.3);" value="${tData?.sapNo || ''}" onchange="window.handleSapLookup(this)"></td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(0,230,118,0.3);" value="${tData?.serialNo || ''}"></td>
            <td style="padding: 0.5rem;"><input type="text" class="cyber-input" style="width: 100%; border-color: rgba(0,230,118,0.3);" value="${tData?.description || ''}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(0,230,118,0.3);" value="${tData?.received || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(0,230,118,0.3);" value="${tData?.returned || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(0,230,118,0.3);" value="${tData?.used || 0}"></td>
            <td style="padding: 0.5rem;"><input type="number" class="cyber-input" style="width: 100%; text-align: center; border-color: rgba(0,230,118,0.3);" value="${tData?.defectCount || 0}"></td>
        `;

        tbody.appendChild(trS);
        tbody.appendChild(trT);
    }
};

(window as any).removeSelectedMaterials = () => {
    const tbody = document.getElementById('material-rows');
    if (tbody && tbody.children.length >= 2) {
        tbody.removeChild(tbody.lastElementChild!);
        tbody.removeChild(tbody.lastElementChild!);
    }
};

(window as any).handleSapLookup = async (input: HTMLInputElement) => {
    const material = await inventoryService.getMaterialBySap(input.value);
    if (material) {
        const row = input.closest('tr');
        const inputs = row?.querySelectorAll('input');
        if (inputs && inputs[4]) inputs[4].value = material.d || '';
    }
};

// SUBMIT & DRAFT
(window as any).getMaterialData = () => {
    return Array.from(document.querySelectorAll('#material-rows tr')).map(row => {
        const cells = (row as HTMLTableRowElement).cells;
        const inputs = row.querySelectorAll('input');
        if (inputs.length < 7) return null;
        const sapNo = inputs[0].value.trim();
        if (!sapNo) return null;
        const type = cells[1].textContent?.trim() || '';
        return {
            poz: cells[0].textContent?.trim(),
            type: type.toUpperCase(),
            sapNo: sapNo,
            serialNo: inputs[1].value.trim(),
            description: inputs[2].value.trim(),
            received: parseFloat(inputs[3].value) || 0,
            returned: parseFloat(inputs[4].value) || 0,
            used: parseFloat(inputs[5].value) || 0,
            defectCount: parseFloat(inputs[6].value) || 0
        };
    }).filter(e => e !== null);
};

document.addEventListener('submit', async (e: Event) => {
    const target = e.target as HTMLElement;
    if (target && target.id === 'detailed-ariza-form') {
        e.preventDefault();
        const btn = document.getElementById('submit-form-btn') as HTMLButtonElement;
        if (!btn) return;
        const orgHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> GÖNDERİLİYOR...';

        try {
            const currentTask = (window as any).currentTaskContext;
            const turbineSerial = (document.getElementById('turbin-seri') as HTMLInputElement).value.trim();
            const siteId = (document.getElementById('form-site') as HTMLInputElement).value.trim();
            const siteName = (document.getElementById('form-site-name') as HTMLInputElement).value.trim();
            const faultCode = document.getElementById('form-fault-search') ? (document.getElementById('form-fault-search') as HTMLInputElement).value.trim() : '';
            const faultDesc = document.getElementById('ariza-tanimi') ? (document.getElementById('ariza-tanimi') as HTMLTextAreaElement).value.trim() : '';
            const isDeficiency = (document.getElementById('is-deficiency-task') as HTMLInputElement)?.value === 'true';
            const isMaintenance = document.querySelector('.form-tabs-wrapper') !== null;
            
            if (!isMaintenance && !isDeficiency && !faultCode) throw new Error("Lütfen bir Arıza Kodu seçiniz.");
            
            const materials = (window as any).getMaterialData();
            const matFormNo = (document.getElementById('mat-form-no') as HTMLInputElement).value.trim();
            if (materials.length > 0 && !matFormNo) throw new Error("Malzeme listesi boş değil. Lütfen MÇF NO (Malzeme Çıkış Form No) giriniz.");

            const workSessions = (window as any).workSessions || [];
            const personnel = Array.from(new Set(workSessions.flatMap((ws: any) => ws.personnel)));
            if (personnel.length === 0) throw new Error("Lütfen en az bir personel ismi giriniz.");

            const currentUser = auth.currentUser;

            const reportData: any = {
                type: isMaintenance || isDeficiency ? 'BAKIM' : 'ARIZA',
                reportNo: (isMaintenance || isDeficiency ? 'BK-' : 'AR-') + Date.now().toString().slice(-6),
                turbineSerial: turbineSerial,
                turbineNo: (document.getElementById('turbin-no') as HTMLInputElement).value,
                siteId: siteId,
                siteName: siteName,
                date: (document.getElementById('form-date') as HTMLInputElement).value,
                team: currentUser?.email?.split('@')[0].toUpperCase() || 'SİSTEM',
                templateName: currentTask?.secilenSablon || '',
                faultCode: faultCode,
                faultDesc: faultDesc,
                timeManagement: {
                    arrival: '',
                    notification: '',
                    wecDowntime: '',
                    maintenanceOn: workSessions[0]?.startTime || '',
                    maintenanceOff: workSessions[workSessions.length - 1]?.endTime || '',
                    interventionDuration: ''
                },
                workSessions: workSessions,
                personnel: personnel,
                matFormNo: matFormNo,
                notes: (document.getElementById('form-notes') as HTMLTextAreaElement).value,
                materials: materials,
                checklist: isMaintenance ? ((window as any).smartAuditItems || []) : [],
                createdBy: currentUser?.email || 'Admin'
            };

            const files = (window as any).selectedFaultFiles || [];
            await serviceReportService.saveReport(reportData, files);
            
            if (currentTask && currentTask.id) {
                await taskService.updateTaskStatus(currentTask.id, 'Tamamlandı');
                localStorage.removeItem('activeTaskContext');
                delete (window as any).currentTaskContext;
            }

            alert("Rapor başarıyla kaydedildi!");
            (window as any).navigate('tasks');
        } catch (err: any) {
            console.error("Submit Error:", err);
            alert("Form gönderilirken bir hata oluştu: " + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = orgHtml;
        }
    }
});

(window as any).saveMaintenanceDraft = async () => {
    const currentTask = (window as any).currentTaskContext;
    if (!currentTask?.id) { alert("Görev kimliği bulunamadı. Taslak kaydedilemiyor."); return; }
    
    const btn = document.getElementById('save-draft-btn') as HTMLButtonElement;
    if (btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...'; btn.disabled = true; }
    
    try {
        const checklist = (window as any).smartAuditItems || [];
        const workSessions = (window as any).workSessions || [];
        const materials = (window as any).getMaterialData ? (window as any).getMaterialData() : [];
        const notes = (document.getElementById('form-notes') as HTMLTextAreaElement)?.value || '';
        const matFormNo = (document.getElementById('mat-form-no') as HTMLInputElement)?.value || '';

        const docRef = doc(db, 'tasks', currentTask.id);
        await updateDoc(docRef, {
            'maintenanceData.checklist': checklist,
            'maintenanceData.workSessions': workSessions,
            'maintenanceData.materials': materials,
            'maintenanceData.notes': notes,
            'maintenanceData.matFormNo': matFormNo,
            'workflow.guncellenmeTarihi': serverTimestamp()
        });

        currentTask.maintenanceData = currentTask.maintenanceData || {};
        currentTask.maintenanceData.checklist = checklist;
        currentTask.maintenanceData.workSessions = workSessions;
        currentTask.maintenanceData.materials = materials;
        currentTask.maintenanceData.notes = notes;
        currentTask.maintenanceData.matFormNo = matFormNo;
        localStorage.setItem('activeTaskContext', JSON.stringify(currentTask));
        
        alert("Bakım taslağı başarıyla kaydedildi.");
    } catch (err: any) {
        alert("Taslak kaydedilirken hata: " + err.message);
    } finally {
        if (btn) { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> TASLAĞI KAYDET'; btn.disabled = false; }
    }
};

(window as any).renderSmartAuditUI = () => {
    const container = document.getElementById('smart-audit-container');
    const statsContainer = document.getElementById('smart-summary-stats');
    if (!container) return;

    const isTemplateEditor = localStorage.getItem('currentEditingTemplateId') !== null;
    const checklistItems = (window as any).smartAuditItems || [];

    if (isTemplateEditor) {
        let html = `
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; background: rgba(0,242,254,0.02); padding: 1rem; border-radius: 12px; border: 1px solid rgba(0,242,254,0.1);">
             <div>
                <h3 style="color: var(--accent-cyan); font-weight: 800; margin: 0; font-size: 1rem;">KONTROL LİSTESİ MADDELERİ</h3>
                <p style="color: var(--text-muted); font-size: 0.7rem; margin: 0;">Toplam ${checklistItems.length} işlem basamağı tanımlandı.</p>
             </div>
             <button type="button" class="btn-cyber" onclick="window.addTemplateStep()" style="padding: 0.6rem 1.2rem; font-size: 0.75rem; background: var(--accent-cyan); color: #000; border: none; border-radius: 8px; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; box-shadow: 0 0 15px rgba(0, 242, 254, 0.2);">
               <i class="fa-solid fa-plus-circle"></i> YENİ MADDE EKLE
             </button>
          </div>
          <div class="template-items-list" style="display: flex; flex-direction: column; gap: 0.8rem;">
        `;
        
        checklistItems.forEach((item: any, index: number) => {
            html += `
              <div class="glass-panel item-row" style="display: flex; gap: 1rem; align-items: center; padding: 0.8rem 1rem; border-left: 4px solid var(--accent-cyan); background: rgba(255,255,255,0.01); transition: all 0.3s ease;">
                 <div style="font-weight: 900; color: var(--accent-cyan); width: 40px; text-align: center; font-size: 0.9rem; opacity: 0.5;">${(index + 1).toString().padStart(2, '0')}</div>
                 <input type="text" class="cyber-input" style="flex: 1; padding: 0.8rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; color: #fff; font-size: 0.85rem;" 
                        value="${item.text || item.title || item.stepName || ''}" 
                        oninput="window.updateTemplateStep(${index}, this.value)" 
                        placeholder="Kontrol adımı açıklamasını girin...">
                 <button type="button" onclick="window.removeTemplateStep(${index})" 
                         style="background: rgba(255,82,82,0.1); border: 1px solid rgba(255,82,82,0.2); color: #ff5252; width: 42px; height: 42px; border-radius: 8px; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center;"
                         onmouseover="this.style.background='rgba(255,82,82,0.2)'"
                         onmouseout="this.style.background='rgba(255,82,82,0.1)'">
                    <i class="fa-solid fa-trash-can" style="font-size: 0.9rem;"></i>
                 </button>
              </div>
            `;
        });

        html += `</div>`;
        container.innerHTML = html;
        if (statsContainer) statsContainer.innerHTML = '';
        return;
    }

    // FORM FILLING MODE
    let completedCount = 0;
    let failedCount = 0;
    let naCount = 0;

    checklistItems.forEach((item: any) => {
        if (item.status === 'OK') completedCount++;
        else if (item.status === 'NOT_OK') failedCount++;
        else if (item.status === 'NA') naCount++;
    });

    const total = checklistItems.length;
    const progressPercent = total > 0 ? Math.round(((completedCount + naCount) / total) * 100) : 0;

    let failedHtml = 'Tüm maddeler başarıyla tamamlandı.';
    if (failedCount > 0) {
        failedHtml = checklistItems.filter((i: any) => i.status === 'NOT_OK').map((i: any) => `• ${i.text || i.title || i.stepName}`).join('<br>');
    }

    container.innerHTML = `
        <div class="smart-audit-wrapper">
            <!-- Stats Row -->
            <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="stat-box" style="flex:1; background: rgba(0,230,118,0.05); border: 1px solid var(--accent-green); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">TAMAMLANAN</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-green);">${completedCount}</div>
                </div>
                <div class="stat-box" style="flex:1; background: rgba(255,51,102,0.05); border: 1px solid var(--accent-red); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">TAMAMLANMADI</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-red);">${failedCount}</div>
                </div>
                <div class="stat-box" style="flex:1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
                    <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">OPSİYON DIŞI</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: var(--text-muted);">${naCount}</div>
                </div>
            </div>

            <!-- List Container -->
            <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 2rem;">
                <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
                    <i class="fa-solid fa-list-check"></i> BAKIM ŞABLONU VE DENETİM MASASI
                </h3>
                
                <div style="display: grid; grid-template-columns: 50px 1fr 150px; gap: 1rem; font-size: 0.7rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 1rem; padding: 0 1rem;">
                    <div>NO</div>
                    <div>İŞLEM BASAMAĞI AÇIKLAMASI</div>
                    <div style="text-align: right;">DURUM SEÇİMİ</div>
                </div>
                
                <div id="audit-items-list" style="display: flex; flex-direction: column; gap: 0.5rem;">
                </div>
            </div>

            <!-- Analysis Container -->
            <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid var(--accent-cyan);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                        <i class="fa-solid fa-magnifying-glass-chart"></i> MADDE ANALİZİ VE BULGULAR
                    </h3>
                    <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 800;">
                        TOPLAM MADDE: <span>${total}</span>
                    </div>
                </div>
                
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px;">
                        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem; font-size: 0.75rem;">
                            <span style="color: var(--text-muted);">Tamamlanma Oranı:</span>
                            <span style="color: var(--accent-green); font-weight: 900;">%${progressPercent}</span>
                        </div>
                        <div style="height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden;">
                            <div style="height: 100%; width: ${progressPercent}%; background: var(--accent-green); transition: width 0.3s;"></div>
                        </div>
                    </div>
                    
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1.5rem; border-radius: 8px;">
                        <div style="font-size: 0.7rem; color: var(--accent-red); font-weight: 800; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem;">
                            <i class="fa-solid fa-triangle-exclamation"></i> TAMAMLANAMAYAN MADDELER (${failedCount})
                        </div>
                        <div style="font-size: 0.7rem; color: ${failedCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)'};">
                            ${failedHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const listContainer = document.getElementById('audit-items-list');
    if (!listContainer) return;

    if (checklistItems.length === 0) {
        listContainer.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.8rem; padding: 1rem;">Bu görev için kontrol listesi bulunamadı.</div>';
    }

    const getStatusColor = (s: string) => {
        if (s === 'OK') return 'var(--accent-green)';
        if (s === 'NOT_OK') return 'var(--accent-red)';
        if (s === 'NA') return 'var(--text-muted)';
        return 'rgba(255,255,255,0.1)';
    };

    checklistItems.forEach((item: any, index: number) => {
        const el = document.createElement('div');
        el.className = 'audit-item';
        el.style.cssText = `
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.05);
            border-radius: 8px;
            padding: 1rem;
            display: grid;
            grid-template-columns: 50px 1fr 150px;
            gap: 1rem;
            align-items: center;
        `;
        
        el.innerHTML = `
            <div style="color: var(--text-muted); font-weight: 800; font-size: 0.8rem;">${index + 1}</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: #fff;">${item.text || item.title || item.stepName || 'Kontrol Adımı'}</div>
            <div>
                <select onchange="window.toggleAuditItem(${index}, this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid ${getStatusColor(item.status)}; color: #fff; padding: 0.5rem; border-radius: 6px; font-size: 0.7rem; outline: none; cursor: pointer;">
                    <option value="PENDING" ${item.status !== 'OK' && item.status !== 'NOT_OK' && item.status !== 'NA' ? 'selected' : ''}>SEÇİNİZ</option>
                    <option value="OK" ${item.status === 'OK' ? 'selected' : ''}>UYGUN</option>
                    <option value="NOT_OK" ${item.status === 'NOT_OK' ? 'selected' : ''}>DEĞİL</option>
                    <option value="NA" ${item.status === 'NA' ? 'selected' : ''}>OPSİYON DIŞI</option>
                </select>
            </div>
        `;
        listContainer.appendChild(el);
    });

    const tabCount = document.getElementById('audit-tab-count');
    if (tabCount) tabCount.textContent = `(${completedCount}/${total})`;
};

(window as any).toggleAuditItem = (index: number, status: string) => {
    if ((window as any).smartAuditItems && (window as any).smartAuditItems[index]) {
        (window as any).smartAuditItems[index].status = status;
        (window as any).renderSmartAuditUI();
    }
};

(window as any).addTemplateStep = () => {
    if (!(window as any).smartAuditItems) (window as any).smartAuditItems = [];
    (window as any).smartAuditItems.push({
        id: 'step_' + Date.now(),
        text: 'Yeni Kontrol Adımı',
        category: 'Genel',
        status: 'BOŞ'
    });
    (window as any).renderSmartAuditUI();
};

(window as any).removeTemplateStep = (index: number) => {
    if(confirm("Bu maddeyi silmek istediğinize emin misiniz?")) {
        (window as any).smartAuditItems.splice(index, 1);
        (window as any).renderSmartAuditUI();
    }
};

(window as any).updateTemplateStep = (index: number, val: string) => {
    if ((window as any).smartAuditItems && (window as any).smartAuditItems[index]) {
        (window as any).smartAuditItems[index].text = val;
    }
};

(window as any).handleTemplateSave = async () => {
    const templateId = localStorage.getItem('currentEditingTemplateId');
    if (!templateId) {
        alert("Şablon ID bulunamadı!");
        return;
    }
    
    const saveBtn = document.querySelector('.btn-cyber[onclick="window.handleTemplateSave()"]') as HTMLButtonElement;
    const orgHtml = saveBtn ? saveBtn.innerHTML : 'ŞABLONU KAYDET';
    
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
    }
    
    try {
        const { maintenanceService } = await import('../services/MaintenanceService');
        await maintenanceService.updateTemplate(templateId, { 
            checklist: (window as any).smartAuditItems 
        });
        
        alert("Şablon başarıyla güncellendi.");
        localStorage.removeItem('currentEditingTemplateId');
        (window as any).navigate('templates');
    } catch (error: any) {
        console.error("Şablon kaydetme hatası:", error);
        alert("Hata: " + error.message);
    } finally {
        if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = orgHtml;
        }
    }
};

