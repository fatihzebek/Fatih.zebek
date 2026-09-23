import { dataService } from '../services/DataService';
import { workOrderAgent } from '../agents/WorkOrderAgent';
import { maintenanceService } from '../services/MaintenanceService';
import { formatTeamName } from '../utils/formatters';

let currentStep = 1;
let wizardData: any = {
  taskLocationType: 'TURBINE', // 'TURBINE' | 'WAREHOUSE'
  siteId: '',
  sahaBilgisi: '',
  turbinSeriNo: '',
  warehouseId: '',
  warehouseName: '',
  kategori: '',
  depoKategori: '',
  repairedSapNo: '',
  repairedSapName: '',
  repairedQty: 1,
  assignedTeam: '',
  yoneticiNotu: '',
  weatherStatus: 'APPROVED',
  weatherBypassed: false,
  forceTeamAssign: false
};

export const TaskCreationForm = async (templateId: string) => {
  const sites = dataService.getSortedSites();
  const mainWarehouses = dataService.getWarehouses();
  
  // State reset on entry
  currentStep = 1;
  const initialKategori = (templateId || '').toLowerCase().includes('ariza') || (templateId || '').toLowerCase().includes('arıza') ? 'form-ariza' : 'Bakım Formu';
  wizardData = { 
    taskLocationType: 'TURBINE',
    siteId: '', 
    sahaBilgisi: '', 
    turbinSeriNo: '', 
    warehouseId: '',
    warehouseName: '',
    kategori: initialKategori, 
    depoKategori: 'Saha İçi Defect Malzeme Onarım Çalışması (Tamir Edilebilir Malzemeler İçin)',
    repairedSapNo: '',
    repairedSapName: '',
    repairedQty: 1,
    assignedTeam: '', 
    yoneticiNotu: '', 
    weatherStatus: 'APPROVED', 
    weatherBypassed: false, 
    forceTeamAssign: false 
  };

  const renderWizard = () => {
    const container = document.getElementById('wizard-container');
    if (!container) return;

    const step1Label = wizardData.taskLocationType === 'WAREHOUSE' ? 'Depo & Tesis' : 'Türbin';

    container.innerHTML = `
      <div class="stepper-header">
        ${[1, 2, 3, 4].map(s => `
          <div class="step-item ${currentStep === s ? 'active' : ''} ${currentStep > s ? 'completed' : ''}">
            <div class="step-number">${currentStep > s ? '<i class="fa-solid fa-check"></i>' : s}</div>
            <div class="step-label">${[step1Label, 'Kategori', 'Ekip', 'Onay'][s-1]}</div>
          </div>
        `).join('')}
      </div>

      <div class="wizard-content fade-in">
        ${renderStep()}
      </div>

      <div style="display: flex; justify-content: space-between; margin-top: 3rem;">
        ${currentStep > 1 ? `
          <button class="btn-cyber" onclick="window.prevStep()" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1);">
            <i class="fa-solid fa-arrow-left"></i> GERİ
          </button>
        ` : '<div></div>'}
        
        ${currentStep < 4 ? `
          <button class="btn-cyber" onclick="window.nextStep()" style="background: var(--accent-cyan); color: #000;">
            İLERLE <i class="fa-solid fa-arrow-right"></i>
          </button>
        ` : `
          <button class="btn-cyber" onclick="window.finalizeTask()" style="background: var(--accent-green); color: #000; width: 200px;">
            GÖREVİ BAŞLAT <i class="fa-solid fa-paper-plane"></i>
          </button>
        `}
      </div>
    `;
  };

  const renderStep = () => {
    switch(currentStep) {
      case 1:
        return `
          <div class="glass-panel" style="padding: 2rem;">
            <h3 style="color: var(--accent-cyan); margin-bottom: 1.25rem;">Adım 1: Görev Konumu & Doğrulama</h3>
            
            <!-- Location Switcher Buttons -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div class="glass-panel wizard-card ${wizardData.taskLocationType === 'TURBINE' ? 'selected' : ''}" 
                   onclick="window.setTaskLocationType('TURBINE')" 
                   style="padding: 1.25rem; text-align: center; cursor: pointer; border-radius: 10px; border: 1px solid ${wizardData.taskLocationType === 'TURBINE' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'}; background: ${wizardData.taskLocationType === 'TURBINE' ? 'rgba(0, 242, 254, 0.1)' : 'rgba(255,255,255,0.02)'};">
                <i class="fa-solid fa-wind" style="font-size: 1.8rem; color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
                <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">🌪️ TÜRBİN GÖREVİ</h4>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0 0;">Kule içi arıza, bakım veya kontrol</p>
              </div>

              <div class="glass-panel wizard-card ${wizardData.taskLocationType === 'WAREHOUSE' ? 'selected' : ''}" 
                   onclick="window.setTaskLocationType('WAREHOUSE')" 
                   style="padding: 1.25rem; text-align: center; cursor: pointer; border-radius: 10px; border: 1px solid ${wizardData.taskLocationType === 'WAREHOUSE' ? 'var(--accent-green)' : 'rgba(255,255,255,0.1)'}; background: ${wizardData.taskLocationType === 'WAREHOUSE' ? 'rgba(0, 255, 136, 0.1)' : 'rgba(255,255,255,0.02)'};">
                <i class="fa-solid fa-warehouse" style="font-size: 1.8rem; color: var(--accent-green); margin-bottom: 0.5rem;"></i>
                <h4 style="margin: 0; font-size: 0.95rem; color: #fff;">📦 DEPO & TESİS İŞİ</h4>
                <p style="font-size: 0.72rem; color: var(--text-muted); margin: 4px 0 0 0;">Parça revizyonu, sayım, atölye veya düzenleme</p>
              </div>
            </div>

            ${wizardData.taskLocationType === 'TURBINE' ? `
              <!-- Turbine Inputs -->
              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label>SAHA SEÇİNİZ</label>
                <select id="wiz-site" class="cyber-input" onchange="window.updateWizData('siteId', this.value)">
                  <option value="">Seçiniz...</option>
                  ${sites.map(s => `<option value="${s.id}" ${wizardData.siteId === s.id ? 'selected' : ''}>${s.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>TÜRBİN SERİ NO</label>
                <input type="text" id="wiz-serial" class="cyber-input" placeholder="Örn: 41193" value="${wizardData.turbinSeriNo}" oninput="window.updateWizData('turbinSeriNo', this.value)">
                <div id="wiz-serial-error" style="color: var(--accent-orange); font-size: 0.8rem; margin-top: 0.5rem; display: none; font-weight: 600;">
                  <i class="fa-solid fa-triangle-exclamation"></i> Yetkisiz saha işlemi! Farklı seri numarası girerseniz, iş emri oluşturmasını teknik destekten talep edin.
                </div>
              </div>
            ` : `
              <!-- Warehouse Inputs -->
              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label>SANTRAL & DEPO SEÇİNİZ</label>
                <select id="wiz-wh-select" class="cyber-input" onchange="window.onWarehouseSelected(this.value)">
                  <option value="">Depo / Atölye Seçiniz...</option>
                  ${mainWarehouses.map(w => `<option value="${w.id}" ${wizardData.warehouseId === w.id ? 'selected' : ''}>📦 ${w.name}</option>`).join('')}
                </select>
              </div>
              <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 0.85rem 1rem; font-size: 0.8rem; color: #CBD5E1; display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid fa-circle-info" style="color: #10B981; font-size: 1.1rem;"></i>
                <span>Depo ve tesis içi görevlerde hava durumu engeli (yıldırım vs.) uygulanmaz, kule tırmanışı gerektirmez.</span>
              </div>
            `}
          </div>
        `;
      case 2:
        if (wizardData.taskLocationType === 'WAREHOUSE') {
          // Warehouse Categories Grid
          const depoCategories = [
            { id: 'Saha İçi Defect Malzeme Onarım Çalışması (Tamir Edilebilir Malzemeler İçin)', name: '🛠️ Saha İçi Defect Malzeme Onarım Çalışması (Tamir Edilebilir Malzemeler İçin)', icon: 'fa-screwdriver-wrench', color: '#10B981' },
            { id: 'Depo Sayımı, Raf Düzenleme & Depo Temizliği', name: '📦 Depo Sayımı, Raf Düzenleme & Depo Temizliği', icon: 'fa-boxes-stacked', color: '#00f2ff' },
            { id: 'El Aletleri & Ekipman Bakımı', name: '🔧 El Aletleri & Ekipman Bakımı', icon: 'fa-wrench', color: '#f59e0b' },
            { id: 'Hurda Malzeme Ayrıştırma & Atık Ayrıştırma', name: '🛡️ Hurda Malzeme Ayrıştırma & Atık Ayrıştırma', icon: 'fa-recycle', color: '#ec4899' },
            { id: 'Tesis İçerisinde Yapılan Çalışmalar', name: '🏢 Tesis İçerisinde Yapılan Çalışmalar', icon: 'fa-building', color: '#38bdf8' }
          ];

          return `
            <div>
              <h3 style="color: var(--accent-green); margin-bottom: 1.25rem;">Adım 2: Depo / Tesis İşi Kategorisi</h3>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
                ${depoCategories.map(cat => `
                  <div class="glass-panel wizard-card ${wizardData.depoKategori === cat.id ? 'selected' : ''}" 
                       onclick="window.selectDepoKategori('${cat.id}')" 
                       style="padding: 1.25rem; text-align: left; cursor: pointer; border-radius: 10px; border: 1px solid ${wizardData.depoKategori === cat.id ? cat.color : 'rgba(255,255,255,0.08)'}; background: ${wizardData.depoKategori === cat.id ? `${cat.color}18` : 'rgba(255,255,255,0.02)'}; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                      <i class="fa-solid ${cat.icon}" style="font-size: 1.2rem; color: ${cat.color}; flex-shrink: 0;"></i>
                      <h4 style="margin: 0; font-size: 0.88rem; color: #fff; line-height: 1.35;">${cat.name}</h4>
                    </div>
                  </div>
                `).join('')}
              </div>

              <!-- Extra inputs for material revision -->
              ${((wizardData.depoKategori || '').includes('Defect') || (wizardData.depoKategori || '').includes('Onarım') || (wizardData.depoKategori || '').includes('Revizyon')) ? `
                <div class="glass-panel" style="padding: 1.25rem; border-left: 3px solid #10B981; margin-top: 1rem;">
                  <h4 style="color: #10B981; font-size: 0.85rem; margin: 0 0 0.75rem 0;">
                    <i class="fa-solid fa-cube"></i> Revize Edilecek Malzeme Detayı (Opsiyonel)
                  </h4>
                  <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
                    <div>
                      <label style="font-size: 0.75rem; color: #94A3B8; display: block; margin-bottom: 4px;">SAP NO VEYA MALZEME TANIMI</label>
                      <input type="text" class="cyber-input" placeholder="Örn: 113426 veya Hidrolik Valf" value="${wizardData.repairedSapName}" oninput="window.updateWizData('repairedSapName', this.value)">
                    </div>
                    <div>
                      <label style="font-size: 0.75rem; color: #94A3B8; display: block; margin-bottom: 4px;">MİKTAR (ADET)</label>
                      <input type="number" min="1" class="cyber-input" value="${wizardData.repairedQty || 1}" oninput="window.updateWizData('repairedQty', this.value)">
                    </div>
                  </div>
                </div>
              ` : ''}
            </div>
          `;
        }

        return `
          <div>
            <div class="grid grid-cols-2 gap-4">
              <div class="glass-panel wizard-card ${wizardData.kategori === 'form-ariza' ? 'selected' : ''}" onclick="window.selectKategori('form-ariza')" style="padding: 2rem; text-align: center;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem; color: #ff1e56; margin-bottom: 1rem;"></i>
                <h4 style="margin:0;">ARIZA FORMU</h4>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">Beklenmedik duruş ve tamir işlemleri</p>
              </div>
              <div class="glass-panel wizard-card ${wizardData.kategori !== 'form-ariza' ? 'selected' : ''}" onclick="window.selectKategori('Bakım Formu')" style="padding: 2rem; text-align: center;">
                <i class="fa-solid fa-calendar-check" style="font-size: 2.5rem; color: var(--accent-cyan); margin-bottom: 1rem;"></i>
                <h4 style="margin:0;">PERİYODİK BAKIM</h4>
                <p style="font-size: 0.7rem; color: var(--text-muted); margin-top: 0.5rem;">Planlı kontrol ve yağlama işlemleri</p>
              </div>
            </div>
          </div>
        `;
      case 3:
        return `
          <div class="glass-panel" style="padding: 2rem;">
            <h3 style="color: var(--accent-cyan); margin-bottom: 1.5rem;">Adım 3: Ekip Atama</h3>
            <div class="form-group">
              <label>MÜSAİT EKİPLER (TEAM 01-15)</label>
              <select id="wiz-team" class="cyber-input" onchange="window.updateWizData('assignedTeam', this.value)">
                <option value="">Ekip Seçiniz...</option>
                ${(() => {
                  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
                  const userRole = (currentUser?.role || '').toUpperCase();
                  const userEmail = (currentUser?.email || '').toLowerCase().trim();
                  const userName = (currentUser?.displayName || currentUser?.name || '').toLowerCase().trim();
                  const canCreatePoolTask = userRole === 'ADMIN' || 
                                            userEmail === 'furkan.yildirim@demirerholding.com' || 
                                            userEmail.includes('furkan.yildirim') || 
                                            userName.includes('furkan yıldırım') || 
                                            userName.includes('furkan yildirim');
                  return canCreatePoolTask ? `
                    <option value="HAVUZ" ${wizardData.assignedTeam === 'HAVUZ' ? 'selected' : ''} style="color: #fbbf24; font-weight: 800; background: #1f1b0a;">🌐 Bölge Ortak Görevi (Ekip Seçilmeyecek)</option>
                  ` : '';
                })()}
                ${(() => {
                  const allTeams = Array.from({ length: 15 }, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`);
                  let filteredTeams = allTeams;
                  
                  const targetSiteId = wizardData.taskLocationType === 'WAREHOUSE' ? wizardData.siteId : wizardData.siteId;
                  if (targetSiteId) {
                    const siteInfo: any = sites.find(s => s.id === targetSiteId);
                    if (siteInfo && siteInfo.assignedTeam) {
                      const primaryTeam = siteInfo.assignedTeam;
                      filteredTeams = [
                        primaryTeam,
                        ...allTeams.filter(t => t !== primaryTeam)
                      ];
                    }
                  }

                  return filteredTeams.map((t: string) => `
                    <option value="${t}" ${wizardData.assignedTeam === t ? 'selected' : ''}>${formatTeamName(t)}</option>
                  `).join('');
                })()}
              </select>
            </div>
            <div class="form-group" style="margin-top: 1.5rem;">
              <label>YÖNETİCİ NOTU / İŞ TANIMI</label>
              <textarea class="cyber-input" rows="3" placeholder="Görevin detayını, hedefini veya özel talimatları buraya yazınız..." oninput="window.updateWizData('yoneticiNotu', this.value)">${wizardData.yoneticiNotu}</textarea>
            </div>
          </div>
        `;
      case 4:
        const locationDisplay = wizardData.taskLocationType === 'WAREHOUSE' 
          ? `<span style="color: var(--accent-green); font-weight: 800;">📦 ${wizardData.warehouseName || 'Santral Deposu'}</span>`
          : `<span style="font-weight: 700;">${wizardData.turbinSeriNo} (${wizardData.sahaBilgisi || 'Saha'})</span>`;

        const categoryDisplay = wizardData.taskLocationType === 'WAREHOUSE'
          ? `<span style="font-weight: 800; color: var(--accent-green);">${wizardData.depoKategori}</span>`
          : `<span style="font-weight: 700; color: var(--accent-cyan);">${wizardData.kategori}</span>`;

        return `
          <div class="glass-panel" style="padding: 2rem;">
            <h3 style="color: var(--accent-green); margin-bottom: 1.5rem;">Adım 4: Son Kontrol ve Onay</h3>
            <div class="space-y-4">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">GÖREV TİPİ:</span>
                <span style="font-weight: 800; color: ${wizardData.taskLocationType === 'WAREHOUSE' ? 'var(--accent-green)' : 'var(--accent-cyan)'};">
                  ${wizardData.taskLocationType === 'WAREHOUSE' ? '📦 DEPO & TESİS İŞİ' : '🌪️ TÜRBİN GÖREVİ'}
                </span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">KONUM / BİRİM:</span>
                ${locationDisplay}
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">KATEGORİ:</span>
                ${categoryDisplay}
              </div>
              ${wizardData.repairedSapName ? `
                <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                  <span style="color: var(--text-muted);">REVİZE PARÇA:</span>
                  <span style="font-weight: 700; color: #FFF;">${wizardData.repairedSapName} (${wizardData.repairedQty || 1} Adet)</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">ATANAN EKİP:</span>
                <span style="font-weight: 800; color: ${wizardData.assignedTeam === 'HAVUZ' ? '#fbbf24' : 'var(--accent-green)'};">
                  ${wizardData.assignedTeam === 'HAVUZ' ? '🌐 Bölge Ortak Görevi' : formatTeamName(wizardData.assignedTeam)}
                </span>
              </div>
              <div style="margin-top: 1rem; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 8px;">
                <span style="color: var(--text-muted); font-size: 0.6rem; display: block; margin-bottom: 0.5rem;">YÖNETİCİ NOTU:</span>
                <p style="font-size: 0.8rem; margin: 0;">${wizardData.yoneticiNotu || 'Not eklenmedi.'}</p>
              </div>
            </div>
          </div>
        `;
    }
  };

  // Exposed Actions
  (window as any).setTaskLocationType = (type: 'TURBINE' | 'WAREHOUSE') => {
    wizardData.taskLocationType = type;
    if (type === 'WAREHOUSE') {
      wizardData.weatherStatus = 'APPROVED';
      wizardData.weatherBypassed = true;
    }
    renderWizard();
  };

  (window as any).onWarehouseSelected = (warehouseId: string) => {
    wizardData.warehouseId = warehouseId;
    const matched = mainWarehouses.find(w => w.id === warehouseId);
    if (matched) {
      wizardData.warehouseName = matched.name;
      wizardData.sahaBilgisi = matched.name;
      wizardData.siteId = matched.id;
    }
    renderWizard();
  };

  (window as any).selectDepoKategori = (depoKat: string) => {
    wizardData.depoKategori = depoKat;
    wizardData.kategori = depoKat;
    renderWizard();
  };

  (window as any).nextStep = () => {
    if (currentStep === 1) {
      if (wizardData.taskLocationType === 'WAREHOUSE') {
        if (!wizardData.warehouseId) {
          (window as any).showToast('Lütfen görev yapılacak depoyu seçiniz.', 'error');
          return;
        }
      } else {
        if (!wizardData.siteId || !wizardData.turbinSeriNo) {
          (window as any).showToast('Lütfen türbin bilgilerini doldurunuz.', 'error');
          return;
        }
        
        const currentUser = (window as any).currentUser;
        const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
        
        if (!isAdmin) {
          const turbineInfo = dataService.findTurbineBySerial(wizardData.turbinSeriNo);
          const allowedSites = dataService.getSites();
          const isAllowed = turbineInfo && allowedSites.some(s => s.id === turbineInfo.siteId);
          
          if (!isAllowed) {
            const errDiv = document.getElementById('wiz-serial-error');
            if (errDiv) errDiv.style.display = 'block';
            return;
          }
        }
      }
    }
    
    if (currentStep === 3 && !wizardData.assignedTeam) {
      (window as any).showToast('Lütfen bir ekip seçiniz.', 'error');
      return;
    }
    currentStep++;
    renderWizard();
  };

  (window as any).prevStep = () => {
    currentStep--;
    renderWizard();
  };

  (window as any).updateWizData = (key: string, val: string) => {
    wizardData[key] = val;
    if (key === 'siteId') {
      const site = sites.find(s => s.id === val);
      if (site) wizardData.sahaBilgisi = site.name;
    }
    if (key === 'turbinSeriNo') {
      const errDiv = document.getElementById('wiz-serial-error');
      if (errDiv) {
        if (val.trim() === '') {
          errDiv.style.display = 'none';
        } else {
          const currentUser = (window as any).currentUser;
          const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
          if (!isAdmin) {
            const turbineInfo = dataService.findTurbineBySerial(val);
            const allowedSites = dataService.getSites();
            const isAllowed = turbineInfo && allowedSites.some(s => s.id === turbineInfo.siteId);
            
            if (!isAllowed) {
              errDiv.style.display = 'block';
            } else {
              errDiv.style.display = 'none';
            }
          }
        }
      }
    }
  };

  (window as any).selectKategori = (kat: string) => {
    wizardData.kategori = kat;
    renderWizard();
  };

  (window as any).toggleWeatherBypass = (checked: boolean) => {
    wizardData.weatherBypassed = checked;
    renderWizard();
  };

  (window as any).finalizeTask = async (force: boolean = false) => {
    if (!wizardData.assignedTeam) {
      (window as any).showToast('Ekip atanmadan görev başlatılamaz! Lütfen geri dönüp ekip seçin.', 'error');
      return;
    }

    const btn = document.querySelector('button[onclick="window.finalizeTask()"]') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> İŞLENİYOR...';
    }

    try {
      const isWarehouse = wizardData.taskLocationType === 'WAREHOUSE';
      const response = await workOrderAgent.createWorkOrderWizard({
        taskLocationType: wizardData.taskLocationType,
        warehouseId: wizardData.warehouseId,
        warehouseName: wizardData.warehouseName,
        siteId: wizardData.siteId || wizardData.warehouseId,
        siteName: wizardData.sahaBilgisi || wizardData.warehouseName,
        serialNumber: isWarehouse ? 'DEPO' : wizardData.turbinSeriNo,
        type: isWarehouse ? (wizardData.depoKategori || 'Depo İşi') : (wizardData.kategori === 'form-ariza' ? 'Arıza' : 'Bakım'),
        teamId: wizardData.assignedTeam,
        description: wizardData.yoneticiNotu,
        weatherStatus: isWarehouse ? 'APPROVED' : (wizardData.weatherStatus || 'APPROVED'),
        forceAssign: force || wizardData.forceTeamAssign,
        repairedMaterial: wizardData.repairedSapName ? {
          sapNo: wizardData.repairedSapNo || '',
          description: wizardData.repairedSapName,
          quantity: Number(wizardData.repairedQty) || 1
        } : undefined
      });

      if (response.success) {
        (window as any).showToast('İş emri otonom olarak oluşturuldu.', 'success');
        (window as any).navigate('tasks');
      } else {
        const err: any = (response as any).error;
        if (err && err.requiresBypass) {
          const confirmBypass = confirm(`${err.message}\n\nBu ekibe yinede atama yapmak istiyor musunuz?`);
          if (confirmBypass) {
            wizardData.forceTeamAssign = true;
            (window as any).finalizeTask(true);
            return;
          }
        }
        (window as any).showToast((response as any).error?.message || 'Bir hata oluştu.', 'error');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'GÖREVİ BAŞLAT <i class="fa-solid fa-paper-plane"></i>';
        }
      }
    } catch (e) {
      (window as any).showToast('Sistem hatası!', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = 'GÖREVİ BAŞLAT <i class="fa-solid fa-paper-plane"></i>';
      }
    }
  };

  // Initial render setup
  setTimeout(renderWizard, 0);

  return `
    <div class="fade-in-up wizard-container">
      <div style="margin-bottom: 2rem; text-align: center;">
        <h1 class="page-title" style="margin-bottom: 0.5rem;">
          <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-cyan);"></i> AKILLI İŞ EMRİ SİHİRBAZI
        </h1>
        <p style="color: var(--text-muted); font-size: 0.8rem;">Enterprise CMMS Otonom Atama Sistemi</p>
      </div>

      <div id="wizard-container"></div>
    </div>
  `;
};
