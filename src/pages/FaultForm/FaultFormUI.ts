import { formatTeamName } from '../../utils/formatters';
import personnelList from '../../data/personnel.json';
import { statusService } from '../../services/StatusService';

export const FaultFormUI = {
    renderLoadingState: () => `
        <div style="padding: 4rem; text-align: center; color: var(--accent-cyan); border: 1px dashed rgba(0, 242, 254, 0.1); border-radius: 12px; background: rgba(0,0,0,0.2);">
            <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; margin-bottom: 1rem;"></i>
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 600; letter-spacing: 2px;">VERİLER SENKRONİZE EDİLİYOR...</div>
        </div>
    `,

    renderMainLayout: (currentTask: any) => {
        const isMaintenanceTask = currentTask?.isMaintenance || 
                                 ['bak-m', 'bakim', 'bakım', 'yag', 'yağ', 'kont', 'ana', 'bak'].some(k => (currentTask?.secilenSablon || '').toLowerCase().includes(k)) &&
                                 !(currentTask?.secilenSablon || '').toLowerCase().includes('ariza');
        const isDeficiencyTask = currentTask?.type === 'EKSİKLİK';
        const hideFaultFields = isMaintenanceTask || isDeficiencyTask;
        const isSmartEditor = localStorage.getItem('currentEditingTemplateId') !== null;

        const initialFaultCode = currentTask?.faultCode || currentTask?.rawFaultCode || '';
        let initialFaultDesc = currentTask?.faultDesc || '';
        
        if (initialFaultCode) {
            const exact = statusService.getCodeByKod(initialFaultCode);
            if (exact) {
                initialFaultDesc = exact.Aciklama;
            }
        }

        if (isSmartEditor) {
            return `
                <div class="fade-in-up content-area">
                  <div style="padding: 0.8rem 2rem; background: rgba(15,23,42,0.95); border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: space-between;">
                    <div style="display: flex; align-items: center; gap: 0.8rem;">
                        <button onclick="window.navigate('templates')" 
                                style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--accent-cyan); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;"
                                onmouseover="this.style.background='rgba(100, 255, 218, 0.1)'"
                                onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                            <i class="fa-solid fa-arrow-left" style="font-size: 0.8rem;"></i>
                        </button>
                        <div style="display: flex; flex-direction: column;">
                          <h1 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                             <i class="fa-solid fa-file-pen" style="color: var(--accent-cyan); font-size: 0.9rem;"></i>
                             <span id="header-title">BAKIM ŞABLONU DÜZENLEME</span>
                          </h1>
                          <p style="color: var(--accent-cyan); font-size: 0.65rem; font-weight: 800; margin: 0; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">
                            <span id="header-subtitle">BAKIM TALİMATNAMESİ</span>
                          </p>
                        </div>
                    </div>
                  </div>
                  <div id="smart-audit-container" style="padding: 1rem 2rem;">
                     <div class="glass-panel" style="padding: 2rem; text-align: center;">
                        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2rem; color: var(--accent-cyan);"></i>
                        <p style="margin-top: 1rem;">Akıllı Denetim Verileri Yükleniyor...</p>
                     </div>
                  </div>
                  <div class="glass-panel" style="padding: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem; margin-top: 2rem; margin-bottom: 5rem;">
                     <button type="button" class="btn-cyber-outline" style="width: 150px;" onclick="window.navigate('templates')">İPTAL</button>
                     <button type="button" class="btn-cyber" style="width: 250px; background: var(--accent-green); border-color: var(--accent-green);" onclick="window.handleTemplateSave()">ŞABLONU KAYDET</button>
                  </div>
                </div>
            `;
        }

        const backAction = `(function(){ if(localStorage.getItem('fromTemplates') === 'true') { localStorage.removeItem('fromTemplates'); window.navigate('templates'); } else { window.navigate('tasks'); } })()`;

        return `
            <div class="fade-in-up content-area">
              <div style="padding: 0.8rem 2rem; background: rgba(15,23,42,0.95); border-bottom: 1px solid rgba(255,255,255,0.08); position: sticky; top: 0; z-index: 100; backdrop-filter: blur(20px); display: flex; align-items: center; justify-content: space-between;">
                <div style="display: flex; align-items: center; gap: 0.8rem;">
                    <button onclick="${backAction}" 
                            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--accent-cyan); width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;"
                            onmouseover="this.style.background='rgba(100, 255, 218, 0.1)'"
                            onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                        <i class="fa-solid fa-arrow-left" style="font-size: 0.8rem;"></i>
                    </button>
                    <div style="display: flex; flex-direction: column;">
                      <h1 style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                         <i class="fa-solid fa-file-pen" style="color: var(--accent-cyan); font-size: 0.9rem;"></i>
                         <span id="header-title">${currentTask?.secilenSablon || 'ARIZA MÜDAHALE FORMU'}</span>
                      </h1>
                      <p style="color: var(--accent-cyan); font-size: 0.65rem; font-weight: 800; margin: 0; opacity: 0.9; letter-spacing: 0.5px; text-transform: uppercase;">
                        <span id="header-subtitle">${isMaintenanceTask ? 'PERİYODİK BAKIM VE KONTROL RAPORU' : 'SERVİS VE MÜDAHALE KAYIT FORMU'}</span>
                      </p>
                    </div>
                </div>
              </div>

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

                  <div id="tab-content-service">
                    <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid var(--accent-cyan);">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                          <i class="fa-solid fa-circle-info"></i> SERVİS AYRINTILARI
                        </h3>
                      </div>
                      <div style="display: flex; flex-direction: column; gap: 1.5rem; width: 100%;">
                        <!-- Row 1: Tarih, Türbin Seri No, Türbin No, Bölge -->
                        <div class="fault-form-top-row" style="display: grid; width: 100%;">
                          <div class="form-group">
                            <label>TARİH</label>
                            <input type="date" id="form-date" class="cyber-input" value="${currentTask?.date ? currentTask.date.split('T')[0] : new Date().toISOString().split('T')[0]}" required>
                          </div>
                          <div class="form-group">
                            <label>TÜRBİN SERİ NO</label>
                            <input type="text" id="turbin-seri" class="cyber-input" placeholder="Örn: 41193" oninput="window.handleSerialLookup(this.value)" autocomplete="off" required value="${currentTask?.turbinSeriNo || ''}">
                          </div>
                          <div class="form-group">
                            <label>TÜRBİN NO</label>
                            <input type="text" id="turbin-no" class="cyber-input" placeholder="Oto dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed;" value="${currentTask?.turbineId || ''}">
                          </div>
                          <div class="form-group">
                            <label>BÖLGE</label>
                            <input type="text" id="form-site-name" class="cyber-input" placeholder="Oto dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed;" value="${currentTask?.siteName || ''}">
                            <input type="hidden" id="form-site" value="${currentTask?.realSiteId || currentTask?.siteId || ''}">
                          </div>
                        </div>

                        <!-- Row 2: Arıza Kodu & Arıza Açıklaması -->
                        <div style="display: ${hideFaultFields ? 'none' : 'flex'}; gap: 1.5rem; flex-wrap: wrap; width: 100%;">
                          <div class="form-group" style="flex: 1; min-width: 200px;">
                            <label>ARIZA KODU</label>
                            <div style="position: relative;">
                              <input type="text" id="form-fault-search" class="cyber-input" placeholder="Kod ara..." oninput="window.searchFaultCodes(this.value)" autocomplete="off" ${hideFaultFields ? '' : 'required'} value="${currentTask?.rawFaultCode || ''}">
                              <div id="form-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; position: absolute; top: 100%; z-index: 1000; padding: 0;"></div>
                            </div>
                          </div>
                          <div class="form-group" style="flex: 2; min-width: 300px;">
                            <label>ARIZA TANIMI / AÇIKLAMASI</label>
                            <textarea id="ariza-tanimi" class="cyber-input" rows="2" placeholder="Kod seçilince dolacak..." readonly style="background: rgba(0,0,0,0.2); cursor: not-allowed; font-size: 0.8rem; line-height: 1.4; height: 38px; resize: none; overflow: hidden;">${initialFaultDesc}</textarea>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 3px solid var(--accent-orange); position: relative; z-index: 1000;">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                        <h3 style="font-size: 0.8rem; color: var(--accent-orange); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                          <i class="fa-solid fa-clock-rotate-left"></i> ÇALIŞMA ZAMANLARI
                        </h3>
                      </div>
                      
                      <!-- Global Personnel Row -->
                      <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                        <button type="button" class="btn-cyber" style="padding: 0 0.6rem !important; font-size: 0.65rem !important; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); color: var(--accent-cyan); display: flex; align-items: center; gap: 0.3rem; height: 28px !important; min-height: 28px !important; border-radius: 4px; line-height: 1 !important;" onclick="window.addGlobalPersonnelInput()">
                          <i class="fa-solid fa-user-plus" style="font-size: 0.7rem;"></i> PERSONEL EKLE
                        </button>
                        <div id="global-personnel-inputs-container" style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;"></div>
                      </div>
                      
                      <div id="work-sessions-container" style="display: flex; flex-direction: column; gap: 0.35rem; margin-top: 0.25rem; width: 100%;"></div>
                      
                      <!-- GÖSTERGE PANALİ / ANALYTICS SUMMARY CARDS -->
                      <div id="sessions-summary-card" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem; margin-top: 1rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 1rem;">
                        <!-- TÜRBİN DURUŞ SÜRESİ -->
                        <div class="glass-panel" style="padding: 0.6rem; border: 1px solid rgba(255, 171, 0, 0.15); background: rgba(255, 171, 0, 0.02); border-radius: 6px; text-align: center;">
                          <div style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; font-size: 0.55rem; color: var(--accent-orange); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                            <i class="fa-solid fa-hourglass-half"></i> TÜRBİN DURUŞ SÜRESİ
                          </div>
                          <div id="total-turbine-hours-display" style="font-size: 0.95rem; font-weight: 900; color: #fff; margin-top: 0.25rem; font-family: monospace;">0.00 SAAT</div>
                          <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 0.1rem;">İlk Başla - Son Bitiş Arası</div>
                        </div>

                        <!-- YOL SÜRESİ -->
                        <div class="glass-panel" style="padding: 0.6rem; border: 1px solid rgba(0, 242, 254, 0.15); background: rgba(0, 242, 254, 0.02); border-radius: 6px; text-align: center;">
                          <div style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; font-size: 0.55rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                            <i class="fa-solid fa-route"></i> YOL SÜRESİ
                          </div>
                          <div id="total-road-hours-display" style="font-size: 0.95rem; font-weight: 900; color: #fff; margin-top: 0.25rem; font-family: monospace;">0.00 SAAT</div>
                          <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 0.1rem;">Toplam Seyahat</div>
                        </div>

                        <!-- NORMAL ADAM-SAAT -->
                        <div class="glass-panel" style="padding: 0.6rem; border: 1px solid rgba(0, 230, 118, 0.15); background: rgba(0, 230, 118, 0.02); border-radius: 6px; text-align: center;">
                          <div style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; font-size: 0.55rem; color: var(--accent-green); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                            <i class="fa-solid fa-user-clock"></i> NORMAL ADAM-SAAT
                          </div>
                          <div id="total-normal-man-hours-display" style="font-size: 0.95rem; font-weight: 900; color: #fff; margin-top: 0.25rem; font-family: monospace;">0.00 SAAT</div>
                          <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 0.1rem;">Mesai Dışı Toplam Emek</div>
                        </div>

                        <!-- MESAİ ADAM-SAAT -->
                        <div class="glass-panel" style="padding: 0.6rem; border: 1px solid rgba(255, 51, 102, 0.15); background: rgba(255, 51, 102, 0.02); border-radius: 6px; text-align: center;">
                          <div style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; font-size: 0.55rem; color: var(--accent-red); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                            <i class="fa-solid fa-fire"></i> MESAİ ADAM-SAAT
                          </div>
                          <div id="total-overtime-man-hours-display" style="font-size: 0.95rem; font-weight: 900; color: #fff; margin-top: 0.25rem; font-family: monospace;">0.00 SAAT</div>
                          <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 0.1rem;">Hafta Sonu / Ekstra Emek</div>
                        </div>

                        <!-- TOPLAM ADAM-SAAT -->
                        <div class="glass-panel" style="padding: 0.6rem; border: 1px solid rgba(255, 255, 255, 0.15); background: rgba(255, 255, 255, 0.02); border-radius: 6px; text-align: center;">
                          <div style="display: flex; align-items: center; justify-content: center; gap: 0.3rem; font-size: 0.55rem; color: #fff; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">
                            <i class="fa-solid fa-users"></i> TOPLAM ADAM-SAAT
                          </div>
                          <div id="total-man-hours-display" style="font-size: 0.95rem; font-weight: 900; color: #fff; margin-top: 0.25rem; font-family: monospace;">0.00 SAAT</div>
                          <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 0.1rem;">Genel Toplam İş Gücü</div>
                        </div>
                      </div>

                      <div style="display: flex; justify-content: flex-start; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255, 255, 255, 0.05);">
                        <button type="button" class="btn-cyber" style="padding: 0 0.8rem !important; font-size: 0.65rem !important; background: rgba(255, 171, 0, 0.1); border: 1px solid rgba(255, 171, 0, 0.3); color: var(--accent-orange); display: flex; align-items: center; gap: 0.3rem; height: 28px !important; min-height: 28px !important; border-radius: 4px; line-height: 1 !important;" onclick="window.addWorkSession()">
                          <i class="fa-solid fa-plus" style="font-size: 0.7rem;"></i> YENİ SATIR EKLE
                        </button>
                      </div>
                    </div>

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
                              <th style="padding: 0.5rem; text-align: center; width: 40px;">POZ</th>
                              <th style="padding: 0.5rem; text-align: center; width: 45px;">S/T</th>
                              <th style="padding: 0.5rem; text-align: left; width: 120px;">SAP NO</th>
                              <th style="padding: 0.5rem; text-align: left; width: 140px;">SERİ NO</th>
                              <th style="padding: 0.5rem; text-align: left;">MALZEME AÇIKLAMASI</th>
                              <th style="padding: 0.5rem; text-align: center; width: 85px;">DEPODAN ALINAN</th>
                              <th style="padding: 0.5rem; text-align: center; width: 85px;">DEPOYA İADE</th>
                              <th style="padding: 0.5rem; text-align: center; width: 85px;">KULLANILAN</th>
                              <th style="padding: 0.5rem; text-align: center; width: 85px;">DEFECT</th>
                            </tr>
                          </thead>
                          <tbody id="material-rows"></tbody>
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
                      <button type="button" class="btn-cyber-outline" onclick="${backAction}">İPTAL</button>
                      <button type="submit" id="submit-form-btn" class="btn-cyber" style="width: 250px; background: var(--accent-green); border-color: var(--accent-green); box-shadow: 0 0 15px rgba(0, 230, 118, 0.2);">RAPORU KAYDET VE GÖNDER</button>
                    </div>
                  </div>
                </form>
              </div>
            </div>
        `;
    },

    renderMaterialRow: (poz: number, type: 'S' | 'T', data?: any) => `
        <tr data-type="${type}" style="border-bottom: 1px solid rgba(${type === 'S' ? '255, 0, 85' : '0, 230, 118'}, 0.1);">
            <td style="padding: 0.25rem 0.35rem; text-align: center; color: ${type === 'S' ? '#ff0055' : '#00e676'}; font-weight: 800; font-size: 0.8rem;">${poz}</td>
            <td style="padding: 0.25rem 0.35rem; text-align: center; color: ${type === 'S' ? '#ff0055' : '#00e676'}; font-weight: 800; font-size: 0.8rem;">${type}</td>
            <td style="padding: 0.25rem 0.35rem;"><input type="text" class="cyber-input" style="width: 100%; height: 26px !important; padding: 2px 6px !important; font-size: 0.8rem; box-sizing: border-box; text-align: center; font-family: monospace; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.sapNo || ''}" oninput="window.handleSapLookup(this)"></td>
            <td style="padding: 0.25rem 0.35rem;"><input type="text" class="cyber-input" style="width: 100%; height: 26px !important; padding: 2px 6px !important; font-size: 0.8rem; box-sizing: border-box; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.serialNo || ''}"></td>
            <td style="padding: 0.25rem 0.35rem;">
                <div style="position: relative; display: flex; align-items: center; width: 100%;">
                    <input type="text" class="cyber-input" style="width: 100%; height: 26px !important; padding: 2px 6px !important; padding-right: 80px !important; font-size: 0.8rem; box-sizing: border-box; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.description || ''}">
                    ${type === 'T' ? `<span class="stock-badge" style="display: none; position: absolute; right: 6px; padding: 0.1rem 0.3rem; font-size: 0.6rem; border-radius: 4px; font-weight: 800; font-family: monospace; white-space: nowrap; pointer-events: none; z-index: 2;"></span>` : ''}
                </div>
            </td>
            <td style="padding: 0.25rem 0.35rem;"><input type="number" class="cyber-input" style="width: 65px; height: 26px !important; padding: 2px 4px !important; font-size: 0.8rem; text-align: center; margin: 0 auto; display: block; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.received || 0}"></td>
            <td style="padding: 0.25rem 0.35rem;"><input type="number" class="cyber-input" style="width: 65px; height: 26px !important; padding: 2px 4px !important; font-size: 0.8rem; text-align: center; margin: 0 auto; display: block; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.returned || 0}"></td>
            <td style="padding: 0.25rem 0.35rem;"><input type="number" class="cyber-input" style="width: 65px; height: 26px !important; padding: 2px 4px !important; font-size: 0.8rem; text-align: center; margin: 0 auto; display: block; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.used || 0}"></td>
            <td style="padding: 0.25rem 0.35rem;"><input type="number" class="cyber-input" style="width: 65px; height: 26px !important; padding: 2px 4px !important; font-size: 0.8rem; text-align: center; margin: 0 auto; display: block; border-color: rgba(${type === 'S' ? '255,0,85' : '0,230,118'},0.3);" value="${data?.defectCount || 0}"></td>
        </tr>
    `,
    renderWorkSessionRow: (ws: any, isLast: boolean) => {
        const teamList = ((window as any).teamPersonnel || []).filter((p: string) => p && p.trim() !== '');
        const isSessionLocked = ws.locked === true || !isLast;
        let rowPersonnel = isSessionLocked 
            ? (Array.isArray(ws.personnel) && ws.personnel.length > 0 ? ws.personnel : []) 
            : teamList;
        
        if (isSessionLocked && rowPersonnel.length === 0) {
            rowPersonnel = ws.personnel && typeof ws.personnel === 'string' ? [ws.personnel] : ['-- Personel Yok --'];
        }
            
        const displayNames = rowPersonnel.length > 0 ? rowPersonnel.join(', ') : 'Lütfen önce personel ekleyin';
        const disabledAttr = isSessionLocked ? 'disabled' : '';

        return `
        <div class="session-card" style="display: flex; gap: 0.5rem; align-items: center; background: rgba(255, 255, 255, 0.015); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 6px; padding: 0.35rem 0.5rem; min-height: 38px; box-sizing: border-box; width: 100%; min-width: 850px;">
            <!-- Personel (Kilitli/Otomatik) -->
            <div style="flex: 1.5; min-width: 130px; font-size: 0.75rem; color: #fff; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 4px; min-height: 28px; height: auto; display: flex; align-items: center; padding: 4px 6px; box-sizing: border-box; word-break: break-word; line-height: 1.25;" title="${displayNames}">
                ${displayNames}
            </div>

            <!-- Kayıt Türü Seçici -->
            <div style="flex: 1.5; min-width: 120px;">
                <select class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; padding: 0 4px !important; font-size: 0.7rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #fff;" 
                    onchange="window.updateSessionField('${ws.id}', 'type', this.value)" ${disabledAttr}>
                    <option value="ÇALIŞMA" ${(ws.type === 'ÇALIŞMA' || !ws.type) ? 'selected' : ''}>ÇALIŞMA</option>
                    <option value="EVDEN TÜRBİNE" ${ws.type === 'EVDEN TÜRBİNE' ? 'selected' : ''}>EVDEN TÜRBİNE</option>
                    <option value="TÜRBİNDEN EVE" ${ws.type === 'TÜRBİNDEN EVE' ? 'selected' : ''}>TÜRBİNDEN EVE</option>
                    <option value="BEKLEME" ${ws.type === 'BEKLEME' ? 'selected' : ''}>BEKLEME</option>
                </select>
            </div>

            <!-- Tarih Seçici -->
            <div style="flex: 1.2; min-width: 120px;">
                <input type="date" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; line-height: 28px !important; padding: 0 2px !important; font-size: 0.7rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #fff;" 
                    value="${ws.date || ''}" 
                    onchange="window.updateSessionField('${ws.id}', 'date', this.value)" ${disabledAttr}>
            </div>

            <!-- Başlangıç Saati -->
            <div style="flex: 0.8; min-width: 85px;">
                <input type="time" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; text-align: center; padding: 0 4px !important; font-size: 0.7rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #fff;" 
                    value="${ws.startTime || ''}" 
                    onchange="window.updateSessionField('${ws.id}', 'startTime', this.value)" ${disabledAttr}>
            </div>

            <!-- Bitiş Saati -->
            <div style="flex: 0.8; min-width: 85px;">
                <input type="time" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; text-align: center; padding: 0 4px !important; font-size: 0.7rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #fff;" 
                    value="${ws.endTime || ''}" 
                    onchange="window.updateSessionField('${ws.id}', 'endTime', this.value)" ${disabledAttr}>
            </div>

            <!-- Açıklama -->
            <div style="flex: 2.5; min-width: 160px;">
                <input type="text" class="cyber-input" placeholder="Açıklama..." style="width: 100%; height: 28px !important; min-height: 28px !important; padding: 0 6px !important; font-size: 0.7rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.2); color: #fff;" 
                    value="${ws.comment || ''}" 
                    onchange="window.updateSessionField('${ws.id}', 'comment', this.value)" ${disabledAttr}>
            </div>

            <!-- Silme / Kilitleme Butonları -->
            <div style="width: 80px; text-align: center; display: flex; justify-content: center; gap: 0.35rem; flex-shrink: 0;">
                ${!isSessionLocked ? `
                <button type="button" class="btn-cyber-outline" style="border-color: rgba(0, 230, 118, 0.4); color: var(--accent-green); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 4px; background: transparent; cursor: pointer;" 
                    onclick="window.lockWorkSession('${ws.id}')" title="Satırı Kaydet">
                    <i class="fa-solid fa-floppy-disk" style="font-size: 0.75rem;"></i>
                </button>
                ` : ''}
                <button type="button" class="btn-cyber-outline" style="border-color: rgba(255, 23, 68, 0.3); color: var(--accent-red); width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border-radius: 4px; background: transparent; cursor: pointer;" 
                    onclick="window.removeWorkSession('${ws.id}')" title="Satırı Sil">
                    <i class="fa-solid fa-trash-can" style="font-size: 0.75rem;"></i>
                </button>
            </div>
        </div>
        `;
    },

    renderAdvancedMeasurement: (item: any, index: number) => {
        if (!item.measurementConfig || item.measurementConfig.type === 'standard') return '';
        const config = item.measurementConfig;
        const vals = item.measurementValues || [];
        
        let html = '<div style="display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; border: 1px solid rgba(255,255,255,0.05);">';
        
        if (config.type === 'numeric_multiple') {
            const count = config.inputCount || 1;
            const unit = config.unit ? ` <span style="color: var(--text-muted); font-size: 0.6rem;">${config.unit}</span>` : '';
            
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 0.5rem;">`;
            for (let i = 0; i < count; i++) {
                const val = vals[i] || '';
                let isValid = true;
                let msg = '';
                
                if (val !== '') {
                    const numVal = parseFloat(val);
                    if (config.minLimit !== undefined && numVal < config.minLimit) {
                        isValid = false;
                        msg = 'Limit altındadır';
                    } else if (config.maxLimit !== undefined && numVal > config.maxLimit) {
                        isValid = false;
                        msg = 'Limit üstündedir';
                    } else {
                        msg = 'Uygundur';
                    }
                }
                
                const borderColor = val === '' ? 'rgba(255,255,255,0.1)' : (isValid ? 'var(--accent-green)' : 'var(--accent-red)');
                const bgColor = val === '' ? 'rgba(0,0,0,0.2)' : (isValid ? 'rgba(0, 230, 118, 0.05)' : 'rgba(255, 51, 102, 0.05)');
                const msgColor = isValid ? 'var(--accent-green)' : 'var(--accent-red)';
                
                const labelText = config.measurementLabels && config.measurementLabels[i] ? config.measurementLabels[i] : `Ölçüm ${i + 1}`;
                
                html += `
                <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                    <label style="font-size: 0.6rem; color: #8892b0;">${labelText}${unit}</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="number" step="any" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${borderColor}; background: ${bgColor}; color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                            value="${val}" 
                            onchange="window.updateAdvMeasurement(${index}, ${i}, this.value)">
                    </div>
                    ${val !== '' ? `<div style="font-size: 0.55rem; color: ${msgColor}; font-weight: 700;">${msg}</div>` : ''}
                </div>
                `;
            }
            html += `</div>`;
            
            if (config.requireSignature) {
                const sigVal = vals[count] || '';
                html += `
                <div style="margin-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0, 230, 118, 0.03); border: 1px solid rgba(0, 230, 118, 0.15); padding: 0.8rem; border-radius: 6px;">
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <i class="fa-solid fa-file-signature" style="color: var(--accent-green); font-size: 0.9rem; margin-top: 0.1rem;"></i>
                        <div style="font-size: 0.7rem; color: #e2e8f0; line-height: 1.4; font-weight: 500;">
                            Yukarıdaki ölçümleri bizzat yaptım ve talimatlara uygunluğunu teyit ediyorum.
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <label style="font-size: 0.6rem; color: var(--accent-green);">Ölçümü Yapan Personel (Ad Soyad)</label>
                        <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${sigVal ? 'var(--accent-green)' : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px; transition: all 0.3s ease;" 
                            value="${sigVal}" 
                            placeholder="İmza yerine geçer..."
                            onchange="window.updateAdvMeasurement(${index}, ${count}, this.value)">
                    </div>
                </div>
                `;
            }
        } else if (config.type === 'dropdown') {
            const opts = config.dropdownOptions || [];
            const criticals = config.criticalOptions || [];
            const val = vals[0] || '';
            const isCritical = criticals.includes(val);
            const borderColor = val === '' ? 'rgba(255,255,255,0.1)' : (isCritical ? 'var(--accent-red)' : 'var(--accent-green)');
            
            html += `
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                <label style="font-size: 0.6rem; color: #8892b0;">Seçim Yapınız</label>
                <select class="cyber-select" style="width: 100%; height: 28px; background: rgba(0,0,0,0.2); border: 1px solid ${borderColor}; color: #fff; border-radius: 4px; padding: 0 0.4rem;" onchange="window.updateAdvMeasurement(${index}, 0, this.value)">
                    <option value="">Seçiniz...</option>
                    ${opts.map((opt: string) => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                </select>
                ${val !== '' && isCritical ? `
                <div style="font-size: 0.55rem; color: var(--accent-red); font-weight: 700; margin-top: 0.1rem;">Kritik Seçim! Lütfen açıklama veya adet giriniz:</div>
                <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; border: 1px solid rgba(255,51,102,0.3); background: rgba(255,51,102,0.05); color: #fff; border-radius: 4px; padding: 0 0.4rem; margin-top: 0.1rem;" placeholder="Açıklama / Adet / Sayı..." value="${vals[1] || ''}" onchange="window.updateAdvMeasurement(${index}, 1, this.value)">
                ` : ''}
            </div>
            `;
        } else if (config.type === 'version_control') {
            const versionItems = config.versionItems || [];
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.5rem;">`;
            
            for (let i = 0; i < versionItems.length; i++) {
                const vItem = versionItems[i];
                const val = vals[i] || '';
                let isValid = true;
                let msg = '';
                
                if (val !== '') {
                    const cleanExpected = (vItem.expected || '').toLowerCase().replace(/\\s/g, '').replace(/,/g, '.');
                    const cleanVal = val.toLowerCase().replace(/\\s/g, '').replace(/,/g, '.');
                    if (cleanVal === 'yok' || cleanVal === 'na' || cleanVal === '-') {
                        isValid = true;
                        msg = 'Türbinde Bulunmuyor';
                    } else if (cleanExpected === cleanVal) {
                        isValid = true;
                        msg = 'Güncel';
                    } else {
                        isValid = false;
                        msg = `Türbinde olması gereken mevcut yazılım: ${vItem.expected}`;
                    }
                }
                
                const borderColor = val === '' ? 'rgba(255,255,255,0.1)' : (isValid ? 'var(--accent-green)' : 'var(--accent-red)');
                const bgColor = val === '' ? 'rgba(0,0,0,0.2)' : (isValid ? 'rgba(0, 230, 118, 0.05)' : 'rgba(255, 51, 102, 0.05)');
                const msgColor = isValid ? 'var(--accent-green)' : 'var(--accent-red)';
                
                html += `
                <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                    <label style="font-size: 0.6rem; color: #8892b0;">${vItem.label}</label>
                    <div style="position: relative; display: flex; align-items: center;">
                        <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${borderColor}; background: ${bgColor}; color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                            value="${val}" 
                            placeholder="Versiyon girin..."
                            onchange="window.updateAdvMeasurement(${index}, ${i}, this.value)">
                    </div>
                    ${val !== '' ? `<div style="font-size: 0.55rem; color: ${msgColor}; font-weight: 700; line-height: 1.1;">${msg}</div>` : ''}
                </div>
                `;
            }
            html += `</div>`;
        } else if (config.type === 'transformer_control') {
            const valName = vals[0] || '';
            const valOpen = vals[1] || '';
            const valClose = vals[2] || '';
            
            html += `<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.8rem;">`;
            
            html += `
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                <label style="font-size: 0.6rem; color: #8892b0;">İletişim Kurulan Kişi</label>
                <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                    value="${valName}" 
                    placeholder="İsim Soyisim..."
                    onchange="window.updateAdvMeasurement(${index}, 0, this.value)">
            </div>
            `;
            
            html += `
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                <label style="font-size: 0.6rem; color: #8892b0;">Trafo Açma Saati</label>
                <input type="time" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                    value="${valOpen}" 
                    onchange="window.updateAdvMeasurement(${index}, 1, this.value)">
            </div>
            `;
            
            html += `
            <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                <label style="font-size: 0.6rem; color: #8892b0;">Trafo Kapatma Saati</label>
                <input type="time" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.1); background: rgba(0,0,0,0.2); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                    value="${valClose}" 
                    onchange="window.updateAdvMeasurement(${index}, 2, this.value)">
            </div>
            `;
            
            html += `</div>`;
        } else if (config.type === 'signature_control') {
            const valSignature = vals[0] || '';
            
            html += `
            <div style="display: flex; flex-direction: column; gap: 0.8rem; background: rgba(0, 230, 118, 0.03); border: 1px solid rgba(0, 230, 118, 0.15); padding: 1rem; border-radius: 6px;">
                <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                    <i class="fa-solid fa-file-signature" style="color: var(--accent-green); font-size: 1rem; margin-top: 0.1rem;"></i>
                    <div style="font-size: 0.75rem; color: #e2e8f0; line-height: 1.4; font-weight: 500;">
                        İlgili maddenin talimata uygun kontrollerini eksiksiz yaptım.
                    </div>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label style="font-size: 0.6rem; color: var(--accent-green);">İşlemi Yapan Personel (Ad Soyad)</label>
                    <input type="text" class="cyber-input" style="width: 100%; height: 32px !important; min-height: 32px !important; font-size: 0.8rem; border: 1px solid ${valSignature ? 'var(--accent-green)' : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.6rem; border-radius: 4px; transition: all 0.3s ease;" 
                        value="${valSignature}" 
                        placeholder="İmza yerine geçer..."
                        onchange="window.updateAdvMeasurement(${index}, 0, this.value)">
                </div>
            </div>
            `;
        } else if (config.type === 'crane_control') {
            const CRANE_MODELS = [
                { id: 'pla_c_250_5', name: 'Planeta PLA-C-250 V2 (5 mm)', nominal: 5, min: 4.5 },
                { id: 'pla_c_250_6', name: 'Planeta PLA-C-250 V2 (6 mm)', nominal: 6, min: 5.4 },
                { id: 'pla_c_300_6', name: 'Planeta PLA-C-300 V2 (6 mm)', nominal: 6, min: 5.4 },
                { id: 'pla_180_4',   name: 'Planeta PLA-180 B (4 mm)', nominal: 4, min: 3.6 },
                { id: 'pla_180_45',  name: 'Planeta PLA-180 B (4,5 mm)', nominal: 4.5, min: 4.05 },
                { id: 'mc_250_5',    name: 'Planeta MC 250 B/Sp (5 mm)', nominal: 5, min: 4.5 },
                { id: 'mc_250_6',    name: 'Planeta MC 250 B/Sp (6 mm)', nominal: 6, min: 5.4 },
                { id: 'mc_950_6',    name: 'Planeta MC 950 B/Sp (6 mm)', nominal: 6, min: 5.4 },
                { id: 'e40_e2_v2_5', name: 'Planeta E40-E2-V2-B (5 mm)', nominal: 5, min: 4.5 },
                { id: 'certex_c180_5',name: 'CERTEX C180 (5 mm)', nominal: 5, min: 4.5 }
            ];

            const valModelId = vals[0] || '';
            const valDiameter = vals[1] || '';
            const valBreak30 = vals[2] || '';
            const valBreak60 = vals[3] || '';
            const valBreak300 = vals[4] || '';
            const valSignature = vals[5] || '';

            const selectedModel = CRANE_MODELS.find(m => m.id === valModelId);
            let diaIsValid = true;
            let diaMsg = '';
            let diaColor = 'rgba(255,255,255,0.1)';
            
            if (valDiameter !== '' && selectedModel) {
                const numDia = parseFloat(valDiameter);
                if (numDia < selectedModel.min) {
                    diaIsValid = false;
                    diaMsg = `Asgari limitin (${selectedModel.min} mm) altında! Halat değişimi gerekir.`;
                    diaColor = 'var(--accent-red)';
                } else {
                    diaMsg = `Çap uygundur.`;
                    diaColor = 'var(--accent-green)';
                }
            } else if (valDiameter !== '') {
                diaColor = 'var(--accent-amber)';
                diaMsg = 'Önce vinç tipi seçiniz.';
            }

            const checkBreaks = (val: string, max: number) => {
                if (!val) return { color: 'rgba(255,255,255,0.1)', msg: '' };
                const num = parseInt(val);
                if (num > max) return { color: 'var(--accent-red)', msg: `Max limiti (${max}) aştı!` };
                return { color: 'var(--accent-green)', msg: 'Uygundur.' };
            };

            const b30 = checkBreaks(valBreak30, 4);
            const b60 = checkBreaks(valBreak60, 6);
            const b300 = checkBreaks(valBreak300, 16);

            html += `
            <div style="display: flex; flex-direction: column; gap: 1rem; background: rgba(147, 51, 234, 0.05); border: 1px solid rgba(147, 51, 234, 0.15); padding: 1rem; border-radius: 6px;">
                
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label style="font-size: 0.7rem; color: #d8b4fe;">Elektrikli Vinç Tipi</label>
                    <select class="cyber-select" style="width: 100%; height: 36px; background: rgba(0,0,0,0.4); border: 1px solid ${valModelId ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)'}; color: #fff; padding: 0 0.5rem; border-radius: 4px;"
                        onchange="window.updateAdvMeasurement(${index}, 0, this.value); window.updateAdvMeasurement(${index}, 1, '');">
                        <option value="">-- Vinç Tipi Seçiniz --</option>
                        ${CRANE_MODELS.map(m => `<option value="${m.id}" ${valModelId === m.id ? 'selected' : ''}>${m.name} (Asgari: ${m.min}mm)</option>`).join('')}
                    </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label style="font-size: 0.7rem; color: #d8b4fe;">Ölçülen Halat Çapı (mm)</label>
                    <input type="number" step="any" class="cyber-input" style="width: 100%; height: 36px !important; font-size: 0.9rem; border: 1px solid ${diaColor}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.6rem; border-radius: 4px;" 
                        value="${valDiameter}" 
                        ${!valModelId ? 'disabled placeholder="Önce vinç tipi seçiniz"' : 'placeholder="Kumpas ile ölçülen değer"'}
                        onchange="window.updateAdvMeasurement(${index}, 1, this.value)">
                    ${diaMsg ? `<div style="font-size: 0.6rem; color: ${diaColor}; font-weight: bold;">${diaMsg}</div>` : ''}
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-top: 0.5rem;">
                    <label style="font-size: 0.7rem; color: #d8b4fe;">Tel Kopması Kontrolü</label>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                            <label style="font-size: 0.55rem; color: #a78bfa;">30mm (Max: 4)</label>
                            <input type="number" min="0" class="cyber-input" style="width: 100%; height: 28px !important; font-size: 0.75rem; border: 1px solid ${b30.color}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                                value="${valBreak30}" onchange="window.updateAdvMeasurement(${index}, 2, this.value)">
                            ${b30.msg ? `<div style="font-size: 0.5rem; color: ${b30.color};">${b30.msg}</div>` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                            <label style="font-size: 0.55rem; color: #a78bfa;">60mm (Max: 6)</label>
                            <input type="number" min="0" class="cyber-input" style="width: 100%; height: 28px !important; font-size: 0.75rem; border: 1px solid ${b60.color}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                                value="${valBreak60}" onchange="window.updateAdvMeasurement(${index}, 3, this.value)">
                            ${b60.msg ? `<div style="font-size: 0.5rem; color: ${b60.color};">${b60.msg}</div>` : ''}
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                            <label style="font-size: 0.55rem; color: #a78bfa;">300mm (Max: 16)</label>
                            <input type="number" min="0" class="cyber-input" style="width: 100%; height: 28px !important; font-size: 0.75rem; border: 1px solid ${b300.color}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px;" 
                                value="${valBreak300}" onchange="window.updateAdvMeasurement(${index}, 4, this.value)">
                            ${b300.msg ? `<div style="font-size: 0.5rem; color: ${b300.color};">${b300.msg}</div>` : ''}
                        </div>
                    </div>
                </div>

                <div style="margin-top: 1rem; border-top: 1px solid rgba(147, 51, 234, 0.2); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; gap: 0.5rem; align-items: flex-start;">
                        <i class="fa-solid fa-file-signature" style="color: var(--accent-purple); font-size: 0.9rem; margin-top: 0.1rem;"></i>
                        <div style="font-size: 0.7rem; color: #e2e8f0; line-height: 1.4; font-weight: 500;">
                            Vinç halatı kontrollerini talimata uygun olarak yaptım.
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <label style="font-size: 0.6rem; color: var(--accent-purple);">İşlemi Yapan Personel (Ad Soyad)</label>
                        <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${valSignature ? 'var(--accent-purple)' : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px; transition: all 0.3s ease;" 
                            value="${valSignature}" 
                            placeholder="İmza yerine geçer..."
                            onchange="window.updateAdvMeasurement(${index}, 5, this.value)">
                    </div>
                </div>
            </div>
            `;
        } else if (config.type === 'safety_equipment_control') {
            const isFirstAid = config.safetyEquipmentType === 'first_aid';
            const eqLabel = isFirstAid ? 'İlk Yardım Çantası' : 'Yangın Söndürücü';
            const iconStr = isFirstAid ? 'fa-briefcase-medical' : 'fa-fire-extinguisher';
            
            const valDate = vals[0] || '';
            const valCheck = vals[1] === 'true';
            const valSignature = vals[2] || '';
            
            let dateMsg = '';
            let dateColor = 'rgba(255,255,255,0.1)';
            
            if (valDate) {
                const [y, m] = valDate.split('-');
                const targetDate = new Date(parseInt(y), parseInt(m) - 1, 1);
                const today = new Date();
                
                // Compare months
                const diffMonths = (targetDate.getFullYear() - today.getFullYear()) * 12 + (targetDate.getMonth() - today.getMonth());
                
                if (diffMonths < 0) {
                    dateMsg = 'Kullanım süresi çoktan dolmuştur! Derhal yenilenmeli.';
                    dateColor = 'var(--accent-red)';
                } else if (diffMonths < 6) {
                    dateMsg = `Kullanım ömrü 6 aydan az kalmış (${diffMonths} ay)! Değiştirilmeli.`;
                    dateColor = 'var(--accent-red)';
                } else {
                    dateMsg = 'Kullanım süresi uygundur (6 aydan fazla).';
                    dateColor = 'var(--accent-green)';
                }
            }

            html += `
            <div style="display: flex; flex-direction: column; gap: 1rem; background: rgba(255, 170, 0, 0.05); border: 1px solid rgba(255, 170, 0, 0.15); padding: 1rem; border-radius: 6px;">
                <div style="display: flex; gap: 0.5rem; align-items: center;">
                    <i class="fa-solid ${iconStr}" style="color: var(--accent-amber); font-size: 1.2rem;"></i>
                    <div style="font-size: 0.8rem; color: #fff; font-weight: bold;">${eqLabel} Kontrolü</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                    <label style="font-size: 0.7rem; color: var(--accent-amber);">${isFirstAid ? 'Son Kullanma Tarihi' : 'Muayene Plaketi - Sonraki Bakım Tarihi'}</label>
                    <input type="month" class="cyber-input" style="width: 100%; height: 36px !important; font-size: 0.9rem; border: 1px solid ${dateColor}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.6rem; border-radius: 4px;" 
                        value="${valDate}" 
                        onblur="window.updateAdvMeasurement(${index}, 0, this.value)">
                    ${dateMsg ? `<div style="font-size: 0.6rem; color: ${dateColor}; font-weight: bold;">${dateMsg}</div>` : ''}
                </div>
                
                ${isFirstAid ? `
                <div style="display: flex; align-items: flex-start; gap: 0.5rem; margin-top: 0.5rem;">
                    <input type="checkbox" id="saf-chk-${index}" ${valCheck ? 'checked' : ''} style="width: 16px; height: 16px; margin-top: 0.1rem; cursor: pointer;"
                        onchange="window.updateAdvMeasurement(${index}, 1, this.checked ? 'true' : 'false')">
                    <label for="saf-chk-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                        İlk yardım çantası içeriği eksiksizdir ve iç folyosunda herhangi bir hasar yoktur.
                    </label>
                </div>
                ` : ''}

                <div style="margin-top: 0.5rem; border-top: 1px solid rgba(255, 170, 0, 0.2); padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <label style="font-size: 0.6rem; color: var(--accent-amber);">İşlemi Yapan Personel (Ad Soyad)</label>
                        <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${valSignature ? 'var(--accent-amber)' : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px; transition: all 0.3s ease;" 
                            value="${valSignature}" 
                            placeholder="Kontrolleri bizzat yaptım..."
                            onchange="window.updateAdvMeasurement(${index}, 2, this.value)">
                    </div>
                </div>
            </div>
            `;
        } else if (config.type === 'bearing_control') {
            const valCheck = vals[0] === 'true';
            const valClassFront = vals[1] || '';
            const valClassRear = vals[2] || '';
            const valSignature = vals[3] || '';

            const getStyle = (val: string) => {
                if (val === 'A' || val === 'B') return { color: 'var(--accent-green)', msg: 'Rulman durumu uygun görünüyor.' };
                if (val === 'C') return { color: 'var(--accent-amber)', msg: 'Dikkat: Metal parçacıklar artmış. Gözlem altında tutulmalı.' };
                if (val === 'D' || val === 'E' || val === 'F') return { color: 'var(--accent-red)', msg: 'KRİTİK HASAR! Lütfen Yetkili Teknik Servis Merkezine haber verin!' };
                return { color: 'rgba(255,255,255,0.2)', msg: '' };
            };

            const fStyle = getStyle(valClassFront);
            const rStyle = getStyle(valClassRear);

            // Determine overall box color based on worst case
            let boxBg = 'rgba(255, 255, 255, 0.02)';
            let boxBorder = 'rgba(255, 255, 255, 0.1)';
            if (fStyle.color === 'var(--accent-red)' || rStyle.color === 'var(--accent-red)') {
                boxBg = 'rgba(244, 63, 94, 0.1)';
                boxBorder = 'rgba(244, 63, 94, 0.3)';
            } else if (fStyle.color === 'var(--accent-amber)' || rStyle.color === 'var(--accent-amber)') {
                boxBg = 'rgba(255, 170, 0, 0.05)';
                boxBorder = 'rgba(255, 170, 0, 0.15)';
            } else if (valClassFront && valClassRear) {
                boxBg = 'rgba(0, 230, 118, 0.05)';
                boxBorder = 'rgba(0, 230, 118, 0.15)';
            }

            const getOptions = (selectedVal: string) => `
                <option value="">-- Durum Seçiniz --</option>
                <option value="A" ${selectedVal === 'A' ? 'selected' : ''}>Sınıf A: Eski renk belirgin, ince parlaklık, manyetik değil</option>
                <option value="B" ${selectedVal === 'B' ? 'selected' : ''}>Sınıf B: Koyu renk (kırmızı/kahverengi/gri), tek tük metal, manyetik değil</option>
                <option value="C" ${selectedVal === 'C' ? 'selected' : ''}>Sınıf C: Kahverengi/Antrasit, çok metal parçacık, hafif manyetik</option>
                <option value="D" ${selectedVal === 'D' ? 'selected' : ''}>Sınıf D: Antrasit/Siyah, çok metal, artan viskozite, manyetik</option>
                <option value="E" ${selectedVal === 'E' ? 'selected' : ''}>Sınıf E: Siyah/Pirinç rengi, yoğun metal, çok manyetik</option>
                <option value="F" ${selectedVal === 'F' ? 'selected' : ''}>Sınıf F: Sınıf D veya E gibi + Yatak parçaları kırılmış</option>
            `;

            html += `
            <div style="display: flex; flex-direction: column; gap: 1rem; background: ${boxBg}; border: 1px solid ${boxBorder}; padding: 1rem; border-radius: 6px; transition: all 0.3s ease;">
                
                <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                    <input type="checkbox" id="bear-chk-${index}" ${valCheck ? 'checked' : ''} style="width: 16px; height: 16px; margin-top: 0.1rem; cursor: pointer;"
                        onchange="window.updateAdvMeasurement(${index}, 0, this.checked ? 'true' : 'false')">
                    <label for="bear-chk-${index}" style="font-size: 0.7rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                        <strong>Talimat Onayı:</strong> Rotor kilitlendi. Yağlama kanalından kablo bağı yardımıyla kullanılmış gres numunesi alındı, beyaz temizlik bezi üzerine yayıldı. Kuvvetli ışık ve mıknatıs ile testleri yapıldı.
                    </label>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                        <label style="font-size: 0.75rem; font-weight: bold; color: ${fStyle.color !== 'rgba(255,255,255,0.2)' ? fStyle.color : '#fff'};">ÖN Rulman Gres Hasar Sınıfı</label>
                        <select class="cyber-select" style="width: 100%; height: 36px; background: rgba(0,0,0,0.4); border: 1px solid ${fStyle.color}; color: #fff; padding: 0 0.5rem; border-radius: 4px;"
                            onchange="window.updateAdvMeasurement(${index}, 1, this.value)">
                            ${getOptions(valClassFront)}
                        </select>
                        ${fStyle.msg ? `<div style="font-size: 0.65rem; color: ${fStyle.color}; font-weight: bold; margin-top: 0.2rem;">${fStyle.msg}</div>` : ''}
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                        <label style="font-size: 0.75rem; font-weight: bold; color: ${rStyle.color !== 'rgba(255,255,255,0.2)' ? rStyle.color : '#fff'};">ARKA Rulman Gres Hasar Sınıfı</label>
                        <select class="cyber-select" style="width: 100%; height: 36px; background: rgba(0,0,0,0.4); border: 1px solid ${rStyle.color}; color: #fff; padding: 0 0.5rem; border-radius: 4px;"
                            onchange="window.updateAdvMeasurement(${index}, 2, this.value)">
                            ${getOptions(valClassRear)}
                        </select>
                        ${rStyle.msg ? `<div style="font-size: 0.65rem; color: ${rStyle.color}; font-weight: bold; margin-top: 0.2rem;">${rStyle.msg}</div>` : ''}
                    </div>
                </div>

                <div style="margin-top: 0.5rem; border-top: 1px solid ${boxBorder}; padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <label style="font-size: 0.6rem; color: ${boxBorder !== 'rgba(255, 255, 255, 0.1)' ? fStyle.color : '#fb7185'};">İşlemi Yapan Personel (Ad Soyad)</label>
                        <input type="text" class="cyber-input" style="width: 100%; height: 28px !important; min-height: 28px !important; font-size: 0.75rem; border: 1px solid ${valSignature ? (boxBorder !== 'rgba(255, 255, 255, 0.1)' ? fStyle.color : '#fb7185') : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.4rem; border-radius: 4px; transition: all 0.3s ease;" 
                            value="${valSignature}" 
                            placeholder="Gres testini bizzat yaptım..."
                            onchange="window.updateAdvMeasurement(${index}, 3, this.value)">
                    </div>
                </div>
            </div>
            `;
        } else if (config.type === 'final_checkout_control') {
            const chk1 = vals[0] === 'true';
            const chk2 = vals[1] === 'true';
            const chk3 = vals[2] === 'true';
            const chk4 = vals[3] === 'true';
            const chk5 = vals[4] === 'true';
            const valSignature = vals[5] || '';

            const allChecked = chk1 && chk2 && chk3 && chk4 && chk5;
            const borderColor = allChecked ? 'var(--accent-cyan)' : 'var(--accent-red)';
            const bgClass = allChecked ? 'rgba(14, 165, 233, 0.05)' : 'rgba(244, 63, 94, 0.05)';

            html += `
            <div style="display: flex; flex-direction: column; gap: 0.8rem; background: ${bgClass}; border: 1px solid ${borderColor}; padding: 1rem; border-radius: 6px; transition: all 0.3s ease;">
                <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.5rem;">
                    <i class="fa-solid fa-flag-checkered" style="color: ${borderColor}; font-size: 1.2rem;"></i>
                    <div style="font-size: 0.8rem; color: #fff; font-weight: bold;">Bakım Sonu Final Kontrolü (Check-out)</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.6rem;">
                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <input type="checkbox" id="chk1-${index}" ${chk1 ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 0.1rem; cursor: pointer;"
                            onchange="window.updateAdvMeasurement(${index}, 0, this.checked ? 'true' : 'false')">
                        <label for="chk1-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                            Türbin içinde, kulede veya çevresinde hiçbir el aleti, malzeme, <strong>atık bez</strong> veya çöp bırakılmamıştır.
                        </label>
                    </div>

                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <input type="checkbox" id="chk2-${index}" ${chk2 ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 0.1rem; cursor: pointer;"
                            onchange="window.updateAdvMeasurement(${index}, 1, this.checked ? 'true' : 'false')">
                        <label for="chk2-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                            Tespit edilen tüm hasarlar, arızalar ve eksiklikler servis raporuna eksiksiz olarak işlenmiştir.
                        </label>
                    </div>

                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <input type="checkbox" id="chk3-${index}" ${chk3 ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 0.1rem; cursor: pointer;"
                            onchange="window.updateAdvMeasurement(${index}, 2, this.checked ? 'true' : 'false')">
                        <label for="chk3-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                            Makine dairesinde ve kule tabanındaki tüm elektrik panoları/kapakları güvenli bir şekilde kapatılmıştır.
                        </label>
                    </div>

                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.3rem 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                        <input type="checkbox" id="chk4-${index}" ${chk4 ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 0.1rem; cursor: pointer;"
                            onchange="window.updateAdvMeasurement(${index}, 3, this.checked ? 'true' : 'false')">
                        <label for="chk4-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                            Türbin çalıştırılıp dinleme testi yapılmış olup olağandışı bir ses veya titreşim olmadan tamamlanmıştır.
                        </label>
                    </div>

                    <div style="display: flex; align-items: flex-start; gap: 0.5rem; padding: 0.3rem 0;">
                        <input type="checkbox" id="chk5-${index}" ${chk5 ? 'checked' : ''} style="width: 18px; height: 18px; margin-top: 0.1rem; cursor: pointer;"
                            onchange="window.updateAdvMeasurement(${index}, 4, this.checked ? 'true' : 'false')">
                        <label for="chk5-${index}" style="font-size: 0.75rem; color: #e2e8f0; cursor: pointer; user-select: none; line-height: 1.4;">
                            Türbin devreye alınmıştır ve türbin defterine ilgili bakım talimatı ve açıklamalar yazılmıştır.
                        </label>
                    </div>
                </div>

                <div style="margin-top: 0.5rem; border-top: 1px solid ${borderColor}; padding-top: 1rem; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.2rem;">
                        <label style="font-size: 0.6rem; color: ${borderColor};">Bakım Sorumlusu (Ad Soyad)</label>
                        <input type="text" class="cyber-input" style="width: 100%; height: 32px !important; min-height: 32px !important; font-size: 0.8rem; border: 1px solid ${valSignature ? borderColor : 'rgba(255,255,255,0.2)'}; background: rgba(0,0,0,0.4); color: #fff; padding: 0 0.6rem; border-radius: 4px; transition: all 0.3s ease;" 
                            value="${valSignature}" 
                            placeholder="Tüm kontrolleri bizzat yaptım..."
                            ${!allChecked ? 'disabled title="Tüm kutucukları işaretlemeden imza atılamaz!"' : ''}
                            onchange="window.updateAdvMeasurement(${index}, 5, this.value)">
                        ${!allChecked ? '<div style="font-size: 0.6rem; color: var(--accent-red); margin-top: 0.2rem;">* İmza atabilmek için tüm kontrolleri işaretlemelisiniz.</div>' : ''}
                    </div>
                </div>
            </div>
            `;
        }
        
        html += '</div>';
        return html;
    },

    renderSmartAuditLayout: (items: any[], isTemplateMode: boolean, templateData?: any) => {
        const currentTask = (window as any).currentTaskContext || {};
        if (isTemplateMode) {
            const auditItems = Array.isArray(items) ? items : [];
            let completedCount = 0;
            let failedCount = 0;
            let naCount = 0;
            const total = auditItems.length;

            auditItems.forEach((item: any) => {
                if (item.status === 'OK') completedCount++;
                else if (item.status === 'NOT_OK') failedCount++;
                else if (item.status === 'NA') naCount++;
            });

            const isYaglama = (templateData?.name || '').toLowerCase().includes('yağlama') || 
                              (templateData?.category === 'YAĞLAMA') || 
                              auditItems.some((item: any) => (item.text || item.title || item.stepName || '').toLowerCase().includes('yağlama'));

            const isLockedTemplate = isTemplateMode && templateData && !templateData.id.includes('copy') && !templateData.id.includes('custom') && templateData.id !== 'form-ariza';
            
            const panelPadding = isYaglama ? '0.8rem' : '1.5rem';
            const panelMarginBottom = isYaglama ? '0.6rem' : '2rem';
            const listGap = isYaglama ? '0.2rem' : '0.8rem';
            const itemPadding = isYaglama ? '0.2rem 0.4rem' : '0.4rem 0.6rem';
            const buttonMarginTop = isYaglama ? '0.6rem' : '1.5rem';
            const inputHeight = isYaglama ? '26px' : '32px';
            const itemFontSize = isYaglama ? '0.8rem' : '0.85rem';

            let html = `
              <div class="template-header-editor glass-panel" style="padding: 1.5rem; margin-bottom: 2rem; border-left: 4px solid var(--accent-cyan);">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem;">
                   <div class="form-group">
                      <label style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 0.5rem; display: block;">ŞABLON BAŞLIĞI (BAKIM ADI)</label>
                      <input type="text" id="template-name-input" class="cyber-input" value="${templateData?.name || ''}" placeholder="Örn: E44 Yağlama Bakımı" oninput="window.updateTemplateMetadata('name', this.value)">
                   </div>
                   <div class="form-group">
                      <label style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 800; margin-bottom: 0.5rem; display: block;">TALİMAT KODU / REVİZYON</label>
                      <input type="text" id="template-code-input" class="cyber-input" value="${templateData?.instructionCode || ''}" placeholder="Örn: TD-esc-08..." oninput="window.updateTemplateMetadata('instructionCode', this.value)">
                   </div>
                </div>
              </div>

              <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                  <div class="stat-box" style="flex:1; background: rgba(0,230,118,0.05); border: 1px solid var(--accent-green); padding: 1rem; border-radius: 8px; text-align: center;">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--accent-green); font-weight: 700; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-circle-check"></i> TAMAMLANDI
                      </div>
                      <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-green);">${completedCount} / ${total}</div>
                  </div>
                  <div class="stat-box" style="flex:1; background: rgba(255,51,102,0.05); border: 1px solid var(--accent-red); padding: 1rem; border-radius: 8px; text-align: center;">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--accent-red); font-weight: 700; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-circle-xmark"></i> TAMAMLANMADI (TÜRBİN EKSİKLERİ)
                      </div>
                      <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-red);">${failedCount}</div>
                  </div>
                  <div class="stat-box" style="flex:1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-circle-dot"></i> OPSİYON DIŞI
                      </div>
                      <div style="font-size: 1.5rem; font-weight: 900; color: var(--text-muted);">${naCount}</div>
                  </div>
              </div>

              <div class="glass-panel" style="padding: ${panelPadding}; margin-bottom: ${panelMarginBottom};">
                <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 0; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
                    <i class="fa-solid fa-list-check"></i> BAKIM DENETİM LİSTESİ
                </h3>

                <div class="template-items-list" style="display: flex; flex-direction: column; gap: ${listGap};">
            `;
            
            auditItems.forEach((item: any, index: number) => {
                const isNotOk = item.status === 'NOT_OK';
                html += `
                  <div class="audit-item" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: ${itemPadding}; display: flex; flex-direction: column; gap: 0.2rem;">
                     <!-- Top Row: Grid -->
                     <div class="item-row" style="display: grid; grid-template-columns: 24px 1fr ${!isTemplateMode && item.requiresMeasurement ? '120px ' : ''}180px ${isTemplateMode ? (isYaglama ? '26px 26px 26px' : '32px 32px 32px') : ''}; gap: 0.6rem; align-items: stretch !important;">
                        <div style="font-weight: 900; color: var(--text-muted); display: flex; align-items: center; justify-content: center; font-size: ${itemFontSize}; text-align: center;">${(index + 1).toString().padStart(2, '0')}</div>
                        
                        ${isTemplateMode ? `
                        <input type="text" class="cyber-input" style="padding: 0 0.6rem !important; font-size: ${itemFontSize}; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.08); color: #fff; border-radius: 4px;" 
                               value="${item.text || item.title || item.stepName || ''}" 
                               oninput="window.updateTemplateStep(${index}, 'text', this.value)" 
                               placeholder="İşlem adımı...">
                        ` : `
                        <div style="padding: 0 0.6rem !important; font-size: ${itemFontSize}; min-height: ${inputHeight} !important; height: auto !important; box-sizing: border-box !important; margin: 0 !important; background: transparent; border: none; color: #fff; display: flex; align-items: center; line-height: 1.2;">
                            ${item.text || item.title || item.stepName || ''}
                        </div>
                        `}

                        ${!isTemplateMode && item.requiresMeasurement ? `
                        <input type="text" class="cyber-input" style="padding: 0 0.6rem !important; font-size: ${itemFontSize}; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; background: rgba(0, 242, 254, 0.05); border: 1px solid var(--accent-cyan); color: #fff; border-radius: 4px; text-align: center;" 
                               value="${item.measurementValue || ''}" 
                               oninput="window.updateTemplateStep(${index}, 'measurementValue', this.value)" 
                               placeholder="Ölçüm Değeri...">
                        ` : ''}

                        <select class="cyber-select" onchange="window.updateTemplateStep(${index}, 'status', this.value)" 
                                style="padding: 0 0.6rem !important; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; font-size: ${itemFontSize}; background: rgba(15, 23, 42, 0.8); border: 1px solid ${isNotOk ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.15)'}; color: #fff; border-radius: 4px; cursor: pointer; outline: none; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                            <option value="PENDING" style="background: #0f172a; color: #fff;" ${item.status !== 'OK' && item.status !== 'NOT_OK' && item.status !== 'NA' ? 'selected' : ''}>⚫ SEÇİNİZ...</option>
                            <option value="OK" style="background: #0f172a; color: #fff;" ${item.status === 'OK' ? 'selected' : ''}>✅ TAMAMLANDI</option>
                            <option value="NOT_OK" style="background: #0f172a; color: #fff;" ${item.status === 'NOT_OK' ? 'selected' : ''}>❌ TAMAMLANMADI</option>
                            <option value="NA" style="background: #0f172a; color: #fff;" ${item.status === 'NA' ? 'selected' : ''}>➖ OPSİYON DIŞI</option>
                        </select>
                        
                        ${isTemplateMode ? `
                        <button type="button" onclick="window.openAdvancedMeasurementSettings(${index})" title="Gelişmiş Ölçüm Ayarları" style="width: ${isYaglama ? '26px' : '32px'} !important; min-width: ${isYaglama ? '26px' : '32px'} !important; max-width: ${isYaglama ? '26px' : '32px'} !important; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: ${(item.measurementConfig && item.measurementConfig.type !== 'standard') ? 'rgba(255, 170, 0, 0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${(item.measurementConfig && item.measurementConfig.type !== 'standard') ? 'var(--accent-amber)' : 'rgba(255,255,255,0.1)'} !important; color: ${(item.measurementConfig && item.measurementConfig.type !== 'standard') ? 'var(--accent-amber)' : 'var(--text-muted)'}; border-radius: 4px; cursor: pointer;">
                            <i class="fa-solid fa-gear"></i>
                        </button>
                        <button type="button" onclick="window.updateTemplateStep(${index}, 'requiresMeasurement', ${!item.requiresMeasurement})" title="${item.requiresMeasurement ? 'Ölçüm Değeri İsteniyor (Kaldırmak için tıkla)' : 'Ölçüm Değeri İste'}" style="width: ${isYaglama ? '26px' : '32px'} !important; min-width: ${isYaglama ? '26px' : '32px'} !important; max-width: ${isYaglama ? '26px' : '32px'} !important; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: ${item.requiresMeasurement ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255,255,255,0.05)'}; border: 1px solid ${item.requiresMeasurement ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.1)'} !important; color: ${item.requiresMeasurement ? 'var(--accent-cyan)' : 'var(--text-muted)'}; border-radius: 4px; cursor: pointer;">
                            <i class="fa-solid fa-ruler"></i>
                        </button>
                        <button type="button" class="btn-cyber secondary" onclick="window.removeTemplateStep(${index})" 
                                style="width: ${isYaglama ? '26px' : '32px'} !important; min-width: ${isYaglama ? '26px' : '32px'} !important; max-width: ${isYaglama ? '26px' : '32px'} !important; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important; background: rgba(255,51,102,0.1); border: 1px solid rgba(255,51,102,0.2) !important; color: var(--accent-red); border-radius: 4px;">
                            <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                        </button>
                        ` : ''}
                     </div>
                     
                     <!-- Bottom Row: Comment Section (Only if status is NOT_OK) -->
                     ${isNotOk ? `
                     <div style="padding-left: 30px; padding-right: 38px; display: flex; flex-direction: column; gap: 0.2rem;">
                         <label style="font-size: 0.55rem; color: var(--accent-red); font-weight: 800; letter-spacing: 0.3px;">TAMAMLANAMAMA NEDENİ / ARIZA BULGUSU</label>
                         <textarea class="cyber-input" 
                                   style="width: 100%; background: rgba(255, 51, 102, 0.02); border: 1px solid rgba(255, 51, 102, 0.15); color: #ff3366; min-height: 32px; height: 32px; font-size: 0.7rem; resize: vertical; padding: 0.25rem 0.5rem; border-radius: 4px; outline: none;" 
                                   placeholder="Açıklama giriniz..."
                                   oninput="window.updateTemplateStep(${index}, 'comment', this.value)"
                         >${item.comment || ''}</textarea>
                     </div>
                     ` : ''}
                     
                     <!-- Bottom Row: Advanced Measurements (Only if status is OK and config exists) -->
                     ${item.status === 'OK' && item.measurementConfig && item.measurementConfig.type !== 'standard' ? `
                     <div style="padding-left: 30px; padding-right: 38px; margin-top: 0.5rem;">
                         ${FaultFormUI.renderAdvancedMeasurement(item, index)}
                     </div>
                     ` : ''}
                  </div>
                `;
            });

            html += `
                </div>
                <button type="button" class="btn-cyber" onclick="window.addTemplateStep()" style="margin-top: 1.5rem; width: 100%; border-style: dashed; background: transparent; color: var(--accent-cyan);">
                  <i class="fa-solid fa-plus"></i> YENİ ADIM EKLE
                </button>
              </div>

              <!-- BOTTOM ANALİZ VE BULGULAR SECTION FOR TEMPLATE MODE -->
              <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid var(--accent-red); margin-bottom: 2rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                      <h3 style="font-size: 0.8rem; color: var(--accent-red); margin: 0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
                          <i class="fa-solid fa-triangle-exclamation"></i> ANALİZ VE BULGULAR (${failedCount})
                      </h3>
                  </div>
                  
                  <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                      ${failedCount > 0 ? auditItems.map((item: any, idx: number) => {
                          if (item.status !== 'NOT_OK') return '';
                          return `
                              <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 51, 102, 0.03); border: 1px solid rgba(255, 51, 102, 0.1); padding: 0.8rem 1.2rem; border-radius: 8px;">
                                  <div style="font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                                      <span class="failed-title-${idx}" style="color: #fff; font-weight: 700;">${idx + 1}. ${item.text || item.title || item.stepName}</span>
                                      <span class="summary-comment-${idx}" style="color: #ff3366; font-weight: 500; margin-left: 0.5rem;">${item.comment || '<span style="opacity: 0.3; font-style: italic;">Henüz açıklama girilmedi...</span>'}</span>
                                  </div>
                                  <div style="background: rgba(255, 51, 102, 0.15); color: #ff3366; border: 1px solid rgba(255, 51, 102, 0.3); font-size: 0.65rem; font-weight: 800; padding: 0.3rem 0.6rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                                      ${(templateData?.name || 'YAĞLAMA BAKIMI').toUpperCase()}
                                  </div>
                              </div>
                          `;
                      }).join('') : `
                          <div style="text-align: center; color: var(--accent-green); font-size: 0.8rem; padding: 1rem 0; font-weight: 600;">
                              <i class="fa-solid fa-circle-check"></i> Tüm denetim adımları başarıyla tamamlandı. Tamamlanmayan madde bulunmamaktadır.
                          </div>
                      `}
                  </div>
              </div>
            `;
            return html;
        }

        // FORM FILLING MODE
        const auditItems = Array.isArray(items) ? items : [];
        let completedCount = 0;
        let failedCount = 0;
        let naCount = 0;

        auditItems.forEach((item: any) => {
            if (item.status === 'OK') completedCount++;
            else if (item.status === 'NOT_OK') failedCount++;
            else if (item.status === 'NA') naCount++;
        });

        const total = auditItems.length;
        const progressPercent = total > 0 ? Math.round(((completedCount + naCount) / total) * 100) : 0;

        let failedHtml = 'Tüm maddeler başarıyla tamamlandı.';
        if (failedCount > 0) {
            failedHtml = auditItems.filter((i: any) => i.status === 'NOT_OK').map((i: any) => `• ${i.text || i.title || i.stepName}`).join('<br>');
        }

        const getStatusColor = (s: string) => {
            if (s === 'OK') return 'var(--accent-green)';
            if (s === 'NOT_OK') return 'var(--accent-red)';
            if (s === 'NA') return 'var(--text-muted)';
            return 'rgba(255,255,255,0.1)';
        };

        const isYaglama = (currentTask?.secilenSablon || '').toLowerCase().includes('yağlama') ||
                          auditItems.some((item: any) => (item.text || item.title || item.stepName || '').toLowerCase().includes('yağlama'));

        const panelPadding = isYaglama ? '0.8rem' : '1.5rem';
        const panelMarginBottom = isYaglama ? '0.6rem' : '2rem';
        const listGap = isYaglama ? '0.2rem' : '0.8rem';
        const itemPadding = isYaglama ? '0.2rem 0.4rem' : '0.4rem 0.6rem';
        const inputHeight = isYaglama ? '26px' : '32px';
        const itemFontSize = isYaglama ? '0.8rem' : '0.85rem';

        let analizBulgularHtml = '';
        if (failedCount > 0) {
            analizBulgularHtml = auditItems.map((item: any, idx: number) => {
                if (item.status !== 'NOT_OK') return '';
                return `
                    <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255, 51, 102, 0.03); border: 1px solid rgba(255, 51, 102, 0.1); padding: 0.8rem 1.2rem; border-radius: 8px;">
                        <div style="font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
                            <span style="color: #fff; font-weight: 700;">${idx + 1}. ${item.text || item.title || item.stepName}</span>
                            <span class="summary-comment-${idx}" style="color: #ff3366; font-weight: 500; margin-left: 0.5rem;">${item.comment || '<span style="opacity: 0.3; font-style: italic;">Henüz açıklama girilmedi...</span>'}</span>
                        </div>
                        <div style="background: rgba(255, 51, 102, 0.15); color: #ff3366; border: 1px solid rgba(255, 51, 102, 0.3); font-size: 0.65rem; font-weight: 800; padding: 0.3rem 0.6rem; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px;">
                            ${(currentTask?.secilenSablon || 'YAĞLAMA BAKIMI').toUpperCase()}
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            analizBulgularHtml = `
                <div style="text-align: center; color: var(--accent-green); font-size: 0.8rem; padding: 1rem 0; font-weight: 600;">
                    <i class="fa-solid fa-circle-check"></i> Tüm denetim adımları başarıyla tamamlandı. Tamamlanmayan madde bulunmamaktadır.
                </div>
            `;
        }

        return `
            <div class="smart-audit-wrapper">
                <div style="display: flex; gap: 1rem; margin-bottom: 1.5rem;">
                    <div class="stat-box" style="flex:1; background: rgba(0,230,118,0.05); border: 1px solid var(--accent-green); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--accent-green); font-weight: 700; margin-bottom: 0.5rem;">
                          <i class="fa-solid fa-circle-check"></i> TAMAMLANDI
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-green);">${completedCount} / ${total}</div>
                    </div>
                    <div class="stat-box" style="flex:1; background: rgba(255,51,102,0.05); border: 1px solid var(--accent-red); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--accent-red); font-weight: 700; margin-bottom: 0.5rem;">
                          <i class="fa-solid fa-circle-xmark"></i> TAMAMLANMADI (TÜRBİN EKSİKLERİ)
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-red);">${failedCount}</div>
                    </div>
                    <div class="stat-box" style="flex:1; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); padding: 1rem; border-radius: 8px; text-align: center;">
                        <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-size: 0.65rem; color: var(--text-muted); font-weight: 700; margin-bottom: 0.5rem;">
                          <i class="fa-solid fa-circle-dot"></i> OPSİYON DIŞI
                        </div>
                        <div style="font-size: 1.5rem; font-weight: 900; color: var(--text-muted);">${naCount}</div>
                    </div>
                </div>

                <div class="glass-panel" style="padding: ${panelPadding}; margin-bottom: ${panelMarginBottom};">
                    <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin-top: 0; margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
                        <i class="fa-solid fa-list-check"></i> BAKIM DENETİM LİSTESİ
                    </h3>
                    
                    <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); padding: 0.6rem 1rem; border-radius: 6px; display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; font-weight: 800; color: var(--text-muted); margin-bottom: 1.5rem; text-transform: uppercase; letter-spacing: 0.5px;">
                        <i class="fa-solid fa-lock" style="color: var(--accent-cyan);"></i> KURUMSAL ŞABLON (DÜZENLENEMEZ)
                    </div>
                    
                    <div id="audit-items-list" style="display: flex; flex-direction: column; gap: ${listGap};">
                        ${auditItems.map((item: any, index: number) => {
                            const isNotOk = item.status === 'NOT_OK';
                            return `
                            <div class="audit-item" style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; padding: ${itemPadding}; display: flex; flex-direction: column; gap: 0.2rem;">
                                <!-- Top Row: Grid -->
                                <div style="display: grid; grid-template-columns: 24px 1fr 180px; gap: 0.6rem; align-items: stretch !important;">
                                    <div style="color: var(--text-muted); font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: ${itemFontSize}; text-align: center;">${(index + 1).toString().padStart(2, '0')}</div>
                                    <input type="text" class="cyber-input" readonly 
                                           style="padding: 0 0.6rem !important; font-size: ${itemFontSize}; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255, 255, 255, 0.05); color: #e2e8f0; border-radius: 4px; cursor: default; width: 100%; outline: none;" 
                                           value="${item.text || item.title || item.stepName || 'Kontrol Adımı'}">
                                    <select onchange="window.toggleAuditItem(${index}, this.value)" class="cyber-select" 
                                            style="width: 100%; min-height: ${inputHeight} !important; height: ${inputHeight} !important; max-height: ${inputHeight} !important; box-sizing: border-box !important; margin: 0 !important; font-size: ${itemFontSize}; padding: 0 0.6rem !important; background: rgba(15, 23, 42, 0.8); border: 1px solid ${isNotOk ? 'var(--accent-red)' : 'rgba(255, 255, 255, 0.15)'}; color: #fff; border-radius: 4px; cursor: pointer; outline: none; box-shadow: 0 2px 8px rgba(0,0,0,0.5);">
                                        <option value="PENDING" style="background: #0f172a; color: #fff;" ${item.status !== 'OK' && item.status !== 'NOT_OK' && item.status !== 'NA' ? 'selected' : ''}>⚫ SEÇİNİZ...</option>
                                        <option value="OK" style="background: #0f172a; color: #fff;" ${item.status === 'OK' ? 'selected' : ''}>✅ TAMAMLANDI</option>
                                        <option value="NOT_OK" style="background: #0f172a; color: #fff;" ${item.status === 'NOT_OK' ? 'selected' : ''}>❌ TAMAMLANMADI</option>
                                        <option value="NA" style="background: #0f172a; color: #fff;" ${item.status === 'NA' ? 'selected' : ''}>➖ OPSİYON DIŞI</option>
                                    </select>
                                </div>
                                
                                
                                <!-- Bottom Row: Comment Section (Only if status is NOT_OK) -->
                                ${isNotOk ? `
                                <div style="padding-left: 30px; padding-right: 0px; display: flex; flex-direction: column; gap: 0.2rem;">
                                    <label style="font-size: 0.55rem; color: var(--accent-red); font-weight: 800; letter-spacing: 0.3px;">TAMAMLANAMAMA NEDENİ / ARIZA BULGUSU</label>
                                    <textarea class="cyber-input" 
                                              style="width: 100%; background: rgba(255, 51, 102, 0.02); border: 1px solid rgba(255, 51, 102, 0.15); color: #ff3366; min-height: 32px; height: 32px; font-size: 0.7rem; resize: vertical; padding: 0.25rem 0.5rem; border-radius: 4px; outline: none;" 
                                              placeholder="Açıklama giriniz..."
                                              oninput="window.updateAuditComment(${index}, this.value)"
                                    >${item.comment || ''}</textarea>
                                </div>
                                ` : ''}

                                <!-- Bottom Row: Advanced Measurements (Only if status is OK and config exists) -->
                                ${item.status === 'OK' && item.measurementConfig && item.measurementConfig.type !== 'standard' ? `
                                <div style="padding-left: 30px; padding-right: 0px; margin-top: 0.5rem;">
                                    ${FaultFormUI.renderAdvancedMeasurement(item, index)}
                                </div>
                                ` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid var(--accent-red); margin-bottom: 2rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                        <h3 style="font-size: 0.8rem; color: var(--accent-red); margin: 0; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase;">
                            <i class="fa-solid fa-triangle-exclamation"></i> ANALİZ VE BULGULAR (${failedCount})
                        </h3>
                    </div>
                    
                    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
                        ${analizBulgularHtml}
                    </div>
                </div>
            </div>
        `;
    }
};
