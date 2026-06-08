import { dataService } from '../services/DataService';
import { workOrderAgent } from '../agents/WorkOrderAgent';
import { weatherAgent } from '../agents/WeatherAgent';
import { maintenanceService } from '../services/MaintenanceService';
import { formatTeamName } from '../utils/formatters';

let currentStep = 1;
let wizardData: any = {
  siteId: '',
  sahaBilgisi: '',
  turbinSeriNo: '',
  kategori: '',
  assignedTeam: '',
  yoneticiNotu: '',
  weatherStatus: 'APPROVED',
  weatherBypassed: false,
  forceTeamAssign: false
};
let weatherResult: any = null;
let isWeatherChecking = false;

export const TaskCreationForm = async (templateId: string) => {
  const sites = dataService.getSortedSites();
  
  // State reset on entry
  currentStep = 1;
  wizardData = { siteId: '', sahaBilgisi: '', turbinSeriNo: '', kategori: templateId, assignedTeam: '', yoneticiNotu: '', weatherStatus: 'APPROVED', weatherBypassed: false, forceTeamAssign: false };
  weatherResult = null;
  isWeatherChecking = false;

  const runWeatherCheck = async () => {
    isWeatherChecking = true;
    renderWizard();
    try {
      const res = await weatherAgent.checkLightningSafety(wizardData.turbinSeriNo);
      weatherResult = res;
      wizardData.weatherStatus = res.status;
    } catch (e) {
      weatherResult = {
        distance: 0,
        safe: false,
        status: 'HOLD_WEATHER',
        message: 'Hava durumu telemetri hatası!'
      };
      wizardData.weatherStatus = 'HOLD_WEATHER';
    } finally {
      isWeatherChecking = false;
      renderWizard();
    }
  };

  const renderWizard = () => {
    const container = document.getElementById('wizard-container');
    if (!container) return;

    container.innerHTML = `
      <div class="stepper-header">
        ${[1, 2, 3, 4].map(s => `
          <div class="step-item ${currentStep === s ? 'active' : ''} ${currentStep > s ? 'completed' : ''}">
            <div class="step-number">${currentStep > s ? '<i class="fa-solid fa-check"></i>' : s}</div>
            <div class="step-label">${['Türbin', 'Kategori', 'Ekip', 'Onay'][s-1]}</div>
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
          <button class="btn-cyber" onclick="window.nextStep()" 
            ${(currentStep === 2 && (isWeatherChecking || (weatherResult && !weatherResult.safe && !wizardData.weatherBypassed))) ? 'disabled style="background: rgba(255,255,255,0.05); color: rgba(255,255,255,0.2); cursor: not-allowed; border-color: rgba(255,255,255,0.05);"' : 'style="background: var(--accent-cyan); color: #000;"'}>
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
            <h3 style="color: var(--accent-cyan); margin-bottom: 1.5rem;">Adım 1: Türbin Doğrulama</h3>
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
          </div>
        `;
      case 2:
        if (!weatherResult && !isWeatherChecking) {
          setTimeout(runWeatherCheck, 50);
        }
        
        let weatherHtml = '';
        if (isWeatherChecking) {
          const turbineInfo = dataService.findTurbineBySerial(wizardData.turbinSeriNo);
          const nameTag = turbineInfo 
            ? `${turbineInfo.siteName} ${turbineInfo.turbineNo}`
            : `Seri No: ${wizardData.turbinSeriNo}`;

          const coordTag = turbineInfo && turbineInfo.latitude && turbineInfo.longitude
            ? ` (${turbineInfo.latitude}, ${turbineInfo.longitude})`
            : '';

          weatherHtml = `
            <div class="glass-panel" style="margin-top: 1.5rem; padding: 1.5rem; border-color: rgba(0, 242, 254, 0.2);">
              <h4 style="color: var(--accent-cyan); font-size: 0.8rem; font-weight: 700; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">
                <i class="fa-solid fa-cloud-bolt fa-pulse" style="color: var(--accent-cyan);"></i> Güvenlik ve İzolasyon Protokolü
              </h4>
              <div style="height: 42px; display: flex; align-items: center; justify-content: center; background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 8px; font-size: 0.9rem; color: var(--accent-cyan); gap: 0.8rem; font-weight: 600;">
                <i class="fa-solid fa-satellite-dish fa-spin"></i> Weather & Environment Agent ${nameTag}${coordTag} için yıldırım aktivitesini tarıyor...
              </div>
            </div>
          `;
        } else if (weatherResult) {
          const turbineInfo = dataService.findTurbineBySerial(wizardData.turbinSeriNo);
          const lat = turbineInfo?.latitude || 38.981;
          const lon = turbineInfo?.longitude || 29.358;

          if (weatherResult.safe) {
            weatherHtml = `
              <div class="glass-panel" style="margin-top: 1.5rem; padding: 1.5rem; border-color: rgba(0, 255, 136, 0.3); background: rgba(0, 255, 136, 0.02);">
                <h4 style="color: var(--accent-green); font-size: 0.8rem; font-weight: 700; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">
                  <i class="fa-solid fa-shield-check"></i> Güvenlik ve İzolasyon Protokolü
                </h4>
                <div style="height: auto; min-height: 42px; display: flex; flex-direction: column; gap: 0.8rem; padding: 1rem 1.2rem; background: rgba(0, 255, 136, 0.1); border: 1px solid rgba(0, 255, 136, 0.3); border-radius: 8px; font-size: 0.9rem; color: var(--accent-green); font-weight: 600; box-shadow: 0 0 15px rgba(0, 255, 136, 0.15);">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <span style="display: flex; align-items: center; gap: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85%;">
                      <i class="fa-solid fa-circle-check"></i> ${weatherResult.message}
                    </span>
                    <span class="badge" style="background: var(--accent-green); color: #000; font-weight: 900; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">APPROVED</span>
                  </div>
                  
                  <div style="margin-top: 0.5rem; display: flex; gap: 0.75rem; align-items: center;">
                    <a href="https://map.blitzortung.org/#10/${lat}/${lon}" target="_blank" class="btn-cyber" style="background: rgba(0, 255, 136, 0.05); border-color: rgba(0, 255, 136, 0.3); color: var(--accent-green); text-decoration: none; padding: 4px 10px; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 6px; font-weight: 700;">
                      <i class="fa-solid fa-bolt"></i> Blitzortung Haritasını Aç <i class="fa-solid fa-up-right-from-square" style="font-size: 0.6rem;"></i>
                    </a>
                  </div>
                </div>
              </div>
            `;
          } else {
            weatherHtml = `
              <div class="glass-panel" style="margin-top: 1.5rem; padding: 1.5rem; border-color: rgba(255, 30, 86, 0.3); background: rgba(255, 30, 86, 0.02);">
                <h4 style="color: #ff1e56; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.8rem; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; letter-spacing: 1px;">
                  <i class="fa-solid fa-triangle-exclamation"></i> Güvenlik ve İzolasyon Protokolü
                </h4>
                <div style="height: auto; min-height: 42px; display: flex; flex-direction: column; gap: 0.8rem; padding: 1rem 1.2rem; background: rgba(255, 30, 86, 0.1); border: 1px solid rgba(255, 30, 86, 0.3); border-radius: 8px; font-size: 0.9rem; color: #ff1e56; font-weight: 600; box-shadow: 0 0 15px rgba(255, 30, 86, 0.15);">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
                    <span style="display: flex; align-items: center; gap: 0.6rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 85%;">
                      <i class="fa-solid fa-ban"></i> ${weatherResult.message}
                    </span>
                    <span class="badge" style="background: #ff1e56; color: #000; font-weight: 900; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px;">HOLD_WEATHER</span>
                  </div>
                  
                  <div style="margin-top: 0.5rem; display: flex; flex-direction: column; gap: 0.75rem;">
                    <a href="https://map.blitzortung.org/#10/${lat}/${lon}" target="_blank" class="btn-cyber" style="background: rgba(255, 170, 0, 0.1); border-color: var(--accent-orange); color: var(--accent-orange); text-decoration: none; padding: 6px 12px; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700; width: fit-content;">
                      <i class="fa-solid fa-bolt"></i> BLITZORTUNG CANLI YILDIRIM RADARI <i class="fa-solid fa-up-right-from-square" style="font-size: 0.6rem;"></i>
                    </a>
                    
                    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: var(--text-muted); cursor: pointer; user-select: none; margin-top: 0.25rem;">
                      <input type="checkbox" id="wiz-bypass-weather" style="width: 16px; height: 16px; accent-color: var(--accent-cyan);" ${wizardData.weatherBypassed ? 'checked' : ''} onchange="window.toggleWeatherBypass(this.checked)">
                      Yönetici İnisiyatifi ile Devam Et (İSG Sorumluluk Onayı)
                    </label>
                  </div>
                </div>
              </div>
            `;
          }
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
            ${weatherHtml}
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
                ${Array.from({length: 15}, (_, i) => {
                  const t = `Team ${String(i + 1).padStart(2, '0')}`;
                  return `<option value="${t}" ${wizardData.assignedTeam === t ? 'selected' : ''}>${formatTeamName(t)}</option>`;
                }).join('')}
              </select>
            </div>
            <div class="form-group" style="margin-top: 1.5rem;">
              <label>YÖNETİCİ NOTU</label>
              <textarea class="cyber-input" rows="3" oninput="window.updateWizData('yoneticiNotu', this.value)">${wizardData.yoneticiNotu}</textarea>
            </div>
          </div>
        `;
      case 4:
        return `
          <div class="glass-panel" style="padding: 2rem;">
            <h3 style="color: var(--accent-green); margin-bottom: 1.5rem;">Adım 4: Son Kontrol</h3>
            <div class="space-y-4">
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">TÜRBİN:</span>
                <span style="font-weight: 700;">${wizardData.turbinSeriNo}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">KATEGORİ:</span>
                <span style="font-weight: 700; color: var(--accent-cyan);">${wizardData.kategori}</span>
              </div>
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
                <span style="color: var(--text-muted);">ATANAN EKİP:</span>
                <span style="font-weight: 700; color: var(--accent-green);">${formatTeamName(wizardData.assignedTeam)}</span>
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
  (window as any).nextStep = () => {
    if (currentStep === 1) {
      if (!wizardData.siteId || !wizardData.turbinSeriNo) {
        (window as any).showToast('Lütfen türbin bilgilerini doldurunuz.', 'error');
        return;
      }
      
      const currentUser = (window as any).currentUser;
      const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
      
      if (!isAdmin) {
        const turbineInfo = dataService.findTurbineBySerial(wizardData.turbinSeriNo);
        const allowedSites = dataService.getSites(); // This is auto-filtered for technicians
        
        // Check if the found turbine's site is in the allowed sites list
        const isAllowed = turbineInfo && allowedSites.some(s => s.id === turbineInfo.siteId);
        
        if (!isAllowed) {
          const errDiv = document.getElementById('wiz-serial-error');
          if (errDiv) errDiv.style.display = 'block';
          return; // Block next step
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
    const btn = document.querySelector('button[onclick="window.finalizeTask()"]') as HTMLButtonElement;
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> İŞLENİYOR...';
    }

    try {
      const response = await workOrderAgent.createWorkOrderWizard({
        serialNumber: wizardData.turbinSeriNo,
        type: wizardData.kategori,
        teamId: wizardData.assignedTeam,
        description: wizardData.yoneticiNotu,
        weatherStatus: wizardData.weatherStatus || 'APPROVED',
        forceAssign: force || wizardData.forceTeamAssign
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
