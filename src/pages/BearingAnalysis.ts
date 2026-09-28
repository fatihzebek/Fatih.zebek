import { bearingAgent } from '../agents/BearingAgent';
import type { GreaseAnalysisResult, AcousticAnalysisResult } from '../agents/BearingAgent';
import { dataService } from '../services/DataService';
import { bearingService } from '../services/BearingService';
import type { BearingRecord, BearingConditionStatus, BearingInspection } from '../services/BearingService';
import { authService } from '../services/AuthService';

export const BearingAnalysisPage = async () => {
  const sites = dataService.getSortedSites();
  const allTurbines: { id: string; name: string; siteId: string; siteName: string }[] = [];
  
  sites.forEach(site => {
    const siteTurbines = dataService.getTurbinesBySite(site.id) || [];
    siteTurbines.forEach(t => {
      // Exclude non-turbine communications / RTU units
      if (t.label === 'RTU' || t.label === 'FCU' || t.label === 'SAI') return;
      allTurbines.push({
        id: t.id,
        name: t.label || `E-${t.type || 'Enercon'}`,
        siteId: site.id,
        siteName: site.name
      });
    });
  });

  // Global state for fleet filter
  (window as any).currentFleetTurbines = allTurbines;
  (window as any).currentFleetFilter = 'ALL';

  return `
    <div class="fade-in-up content-area" style="font-size: 0.9rem; color: #a0a5b0;">
      <!-- Premium Title Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px;">
            <i class="fa-solid fa-microchip" style="color: var(--accent-cyan); margin-right: 10px;"></i> Rulman Filo Sağlığı & Karar Destek Ajanı
          </h1>
          <p style="color: #8a8f98; margin: 0; font-size: 0.9rem;">
            ENERCON standartlarına (TD-esc-07, D03220088/0.0 & D02980100) uyumlu ön rulman değişimi, metal çapak/aşınma izleme ve otonom teşhis merkezi.
          </p>
        </div>
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="window.openBearingEditModal('')" class="cyber-button" style="background: rgba(0, 242, 254, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 0.5rem 1rem; border-radius: 6px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-plus"></i> Durum Güncelle / Kayıt Ekle
          </button>
          <div style="background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.15); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00ff66; box-shadow: 0 0 8px #00ff66;"></span>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem; letter-spacing: 0.5px;">AJAN AKTİF / ONLINE</span>
          </div>
        </div>
      </div>

      <!-- Tab Navigation Menu -->
      <div style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px; overflow-x: auto; white-space: nowrap;">
        <button id="tab-btn-fleet" class="tab-nav-btn active" onclick="window.switchBearingTab('fleet')">
          <i class="fa-solid fa-shield-halved" style="margin-right: 8px; color: var(--accent-cyan);"></i> 1. Rulman Filo Sağlığı & Takip Paneli
        </button>
        <button id="tab-btn-acoustics" class="tab-nav-btn" onclick="window.switchBearingTab('acoustics')">
          <i class="fa-solid fa-microphone-lines" style="margin-right: 8px;"></i> 2. Akustik & Vibrasyon Uyum Modülü
        </button>
        <button id="tab-btn-grease" class="tab-nav-btn" onclick="window.switchBearingTab('grease')">
          <i class="fa-solid fa-flask" style="margin-right: 8px;"></i> 3. Gres Laboratuvarı & RAG Eşleştirici
        </button>
        <button id="tab-btn-history" class="tab-nav-btn" onclick="window.switchBearingTab('history')">
          <i class="fa-solid fa-clipboard-list" style="margin-right: 8px;"></i> 4. Saha Analiz Kayıtları & Geçmiş (Tarihçe)
        </button>
      </div>

      <!-- ========================================== -->
      <!-- TAB 1: FLEET HEALTH & BEARING STATUS FILTER -->
      <!-- ========================================== -->
      <div id="bearing-tab-fleet" class="bearing-tab-content active-tab">
        
        <!-- KPI Özet Sayaçları (4 Kart) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          
          <!-- Toplam Türbin -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(0, 242, 254, 0.15); display: flex; align-items: center; gap: 1rem;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 242, 254, 0.1); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.25rem;">
              <i class="fa-solid fa-wind"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #8a8f98; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Toplam İzlenen</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-total">${allTurbines.length}</div>
            </div>
          </div>

          <!-- Ön Rulmanı Değişenler -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(168, 85, 247, 0.25); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('REPLACED')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(168, 85, 247, 0.12); display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 1.25rem;">
              <i class="fa-solid fa-arrows-rotate"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #c084fc; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Ön Rulmanı Değişen</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-replaced">0</div>
            </div>
          </div>

          <!-- Metal Çapak / Aşınma Takibinde -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(239, 68, 68, 0.25); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('METAL')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(239, 68, 68, 0.12); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 1.25rem;">
              <i class="fa-solid fa-magnet"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #f87171; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Çapak Takibinde</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-metal">0</div>
            </div>
          </div>

          <!-- Sağlam / Temiz -->
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 10px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(0, 230, 118, 0.2); display: flex; align-items: center; gap: 1rem; cursor: pointer; transition: transform 0.2s;" onclick="window.setFleetFilter('HEALTHY')" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 230, 118, 0.1); display: flex; align-items: center; justify-content: center; color: #00e676; font-size: 1.25rem;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div style="font-size: 0.75rem; color: #81c784; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Sağlam / Normal</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; font-weight: 800; color: #fff; line-height: 1.1;" id="kpi-count-healthy">${allTurbines.length}</div>
            </div>
          </div>

        </div>

        <!-- Filtre ve Arama Çubuğu -->
        <div class="glass-panel" style="padding: 1rem 1.2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap;">
          
          <!-- Filtre Butonları Grubu -->
          <div style="display: flex; gap: 8px; flex-wrap: wrap;" id="fleet-filter-btn-group">
            <button class="fleet-filter-btn active" data-filter="ALL" onclick="window.setFleetFilter('ALL')">
              <i class="fa-solid fa-globe"></i> TÜMÜ (<span id="btn-count-all">${allTurbines.length}</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="REPLACED" onclick="window.setFleetFilter('REPLACED')">
              <i class="fa-solid fa-arrows-rotate" style="color: #c084fc;"></i> ÖN RULMANI DEĞİŞENLER (<span id="btn-count-replaced">0</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="METAL" onclick="window.setFleetFilter('METAL')">
              <i class="fa-solid fa-magnet" style="color: #f87171;"></i> ÇAPAK TAKİBİNDE (<span id="btn-count-metal">0</span>)
            </button>
            <button class="fleet-filter-btn" data-filter="HEALTHY" onclick="window.setFleetFilter('HEALTHY')">
              <i class="fa-solid fa-circle-check" style="color: #00e676;"></i> SAĞLAM (<span id="btn-count-healthy">${allTurbines.length}</span>)
            </button>
          </div>

          <!-- Sağ Taraf: Santral Seçimi & Arama -->
          <div style="display: flex; align-items: center; gap: 10px; flex-grow: 1; justify-content: flex-end; min-width: 280px;">
            <select id="fleet-site-filter" onchange="window.handleFleetFilterChange()" style="height: 36px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
              <option value="ALL" style="background: #0b0f19;">🌐 Tüm Sahalar (${sites.length} Santral)</option>
              ${sites.map(s => `<option value="${s.id}" style="background: #0b0f19;">${s.name} (${s.turbineCount} Türbin)</option>`).join('')}
            </select>

            <div style="position: relative; width: 220px;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: #8a8f98; font-size: 0.8rem;"></i>
              <input id="fleet-search-input" oninput="window.handleFleetFilterChange()" type="text" placeholder="Türbin ara (T-01, Seri No...)" style="height: 36px; width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding-left: 30px; padding-right: 10px; font-size: 0.85rem; outline: none;">
            </div>
          </div>

        </div>

        <!-- Türbin Kartları Grid'i -->
        <div id="fleet-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(290px, 1fr)); gap: 1rem;">
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: #8a8f98;">
            <i class="fa-solid fa-circle-notch fa-spin fa-2x" style="color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
            <div>Rulman kayıtları yükleniyor...</div>
          </div>
        </div>

      </div>

      <!-- ========================================== -->
      <!-- TAB 2: ACOUSTICS & PORTABLE VIBRATION -->
      <!-- ========================================== -->
      <div id="bearing-tab-acoustics" class="bearing-tab-content" style="display: none;">
        
        <!-- Turbine Selection Banner -->
        <div class="glass-panel" style="padding: 1.2rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.05); backdrop-filter: blur(10px); margin-bottom: 1.5rem; display: flex; align-items: center; gap: 20px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-wind" style="color: var(--accent-cyan); font-size: 1.2rem;"></i>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: #fff; font-size: 1rem;">HEDEF TÜRBİN SEÇİMİ:</span>
          </div>
          <div style="flex-grow: 1;">
            <select id="analysis-turbine-select" style="height: 38px; width: 100%; max-width: 450px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.9rem; outline: none; font-family: inherit;">
              ${allTurbines.map(t => `<option value="${t.id}" style="background: #0b0f19; color: #fff;">${t.siteName} - ${t.name} (Seri: ${t.id})</option>`).join('')}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          
          <!-- Column 2.1: Live Audio Recording -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-blue); padding-left: 10px;">
                  1. AKUSTİK ANALİZ (CANLI SAHA KAYDI)
                </h3>
                <i class="fa-solid fa-wave-square" style="color: var(--accent-blue); font-size: 1.1rem;"></i>
              </div>
              
              <p style="color: #8a8f98; margin: 0 0 1.2rem 0; font-size: 0.85rem; line-height: 1.4;">
                Mikrofon yardımıyla sahada canlı ses kaydı alınır. Yaw (sapma) motorunun dişli veya fren uğultuları tespit edilirse analiz iptal edilir.
              </p>

              <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
                <!-- Yaw simulation mode switch -->
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
                  <div>
                    <div style="font-weight: 700; color: #fff; font-size: 0.85rem;">Yaw (Sapma) Motoru Durumu</div>
                    <div style="font-size: 0.75rem; color: #8a8f98;">Analiz esnasında yaw motor sesi simülasyonu</div>
                  </div>
                  <div style="display: flex; gap: 8px;">
                    <button id="yaw-off-btn" class="yaw-toggle-btn active" onclick="window.setYawSimulation(false)" style="height: 30px; padding: 0 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">DEVR DIŞI</button>
                    <button id="yaw-on-btn" class="yaw-toggle-btn" onclick="window.setYawSimulation(true)" style="height: 30px; padding: 0 12px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 4px; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s;">DEVREDE</button>
                  </div>
                </div>

                <!-- Canlı Ses Kaydet Button -->
                <button id="live-audio-btn" onclick="window.startLiveAudioRecording()" style="height: 42px; width: 100%; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 6px; color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; position: relative; outline: none;">
                  <i class="fa-solid fa-microphone" id="mic-icon" style="color: var(--accent-cyan);"></i>
                  <span id="mic-text">Canlı Ses Kaydet (1 Dk)</span>
                </button>
              </div>
            </div>

            <!-- Acoustic Output Area -->
            <div id="acoustic-result-area" class="hidden-result" style="display: none; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1rem; animation: fadeIn 0.4s ease; margin-top: 1rem;">
              <div id="acoustic-loader" style="text-align: center; padding: 1rem 0;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
                <div style="font-size: 0.8rem; color: #8a8f98;">Akustik spektrum taranıyor, pitch/fren gürültüleri eleniyor...</div>
              </div>
              <div id="acoustic-content" style="display: none;"></div>
            </div>
          </div>

          <!-- Column 2.2: Vibration compliance calculator -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-magenta); padding-left: 10px;">
                2. VİBRASYON UYUMLULUK ASİSTANI (D03220088/0.0)
              </h3>
              <i class="fa-solid fa-circle-check" style="color: var(--accent-magenta); font-size: 1.1rem;"></i>
            </div>
            
            <p style="color: #8a8f98; margin: 0 0 1.2rem 0; font-size: 0.85rem; line-height: 1.4;">
              Mobil vibrasyon ölçüm kurulumunuzun ENERCON asgari standartlarına uygunluğunu denetleyin. Uyumsuz ölçüm raporları kabul edilmez.
            </p>

            <!-- Select Vibration Setup/Device Type -->
            <div style="display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1rem; background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.04);">
              <label style="font-size: 0.8rem; color: #fff; font-weight: 700;">Vibrasyon Ölçüm Cihazı Tercihi</label>
              <select id="vib-setup-type" onchange="window.handleVibSetupChange(this.value)" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit; cursor: pointer;">
                <option value="taşınabilir_cihaz" style="background: #0b0f19;">Taşınabilir Cihaz Mevcut (Kurulum Denetimi)</option>
                <option value="sabit_cms" style="background: #0b0f19;">Türbin Sabit CMS Değerleri (SCADA Raporu)</option>
                <option value="cihaz_yok" style="background: #0b0f19;">Vibrasyon Cihazı Yok (Akustik & Gres RAG ile Geç)</option>
              </select>
            </div>

            <!-- Bypass Info Banner for "Cihaz Yok" option -->
            <div id="vib-bypass-banner" style="display: none; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.15); padding: 1.2rem; border-radius: 8px; margin-bottom: 1rem; animation: fadeIn 0.3s ease;">
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); font-size: 1.2rem; margin-top: 2px;"></i>
                <div>
                  <div style="font-weight: 700; color: #fff; font-size: 0.85rem; margin-bottom: 4px;">VİBRASYON OLMAKSIZIN TEŞHİS MÜMKÜN</div>
                  <div style="font-size: 0.8rem; color: #cbd0d8; line-height: 1.45;">
                    Rulman hasar analizi yapmak için mobil vibrasyon analizörü **zorunlu değildir**. Telefon/tablet mikrofonu yardımıyla alacağınız 1 dakikalık canlı akustik ses kaydı ve görsel gres RAG analizleri, rulman durumunu doğru teşhis etmek için tek başına tamamen yeterlidir.
                  </div>
                  <div style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700; margin-top: 8px; border-top: 1px solid rgba(0, 242, 254, 0.1); padding-top: 6px;">
                    💡 Diğer analiz kanallarıyla devam etmek için bu adımı bypass edebilirsiniz.
                  </div>
                </div>
              </div>
            </div>

            <!-- Measurement Parameter Inputs Wrapper -->
            <div id="vib-inputs-container">
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem; background: rgba(255,255,255,0.01); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); margin-bottom: 1rem;">
                
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Rotor Hızı (% Nominal)</label>
                  <input id="vib-rotor-speed" type="number" value="80" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Hız Dalgalanması (± %)</label>
                  <input id="vib-fluctuation" type="number" value="6" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Ölçüm Süresi (Saniye)</label>
                  <input id="vib-duration" type="number" value="65" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Geçmiş Ölçüm Sayısı</label>
                  <input id="vib-count" type="number" value="3" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Sensör Hassasiyeti (mV/g)</label>
                  <input id="vib-sensitivity" type="number" value="100" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Sensör Doğrusallık Alt (Hz)</label>
                  <input id="vib-freq-min" type="number" step="0.01" value="0.33" style="height: 34px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>

                <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                  <input id="vib-noyaw" type="checkbox" checked style="width: 16px; height: 16px; accent-color: var(--accent-magenta);">
                  <label for="vib-noyaw" style="font-size: 0.8rem; color: #fff; font-weight: 600; cursor: pointer;">Ölçümde Yaw Sabit mi?</label>
                </div>

                <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                  <input id="vib-noice" type="checkbox" checked style="width: 16px; height: 16px; accent-color: var(--accent-magenta);">
                  <label for="vib-noice" style="font-size: 0.8rem; color: #fff; font-weight: 600; cursor: pointer;">Rotorda Buz Yok mu?</label>
                </div>
              </div>
            </div>

            <button id="vib-calc-btn" onclick="window.triggerVibrationCompliance()" style="height: 36px; width: 100%; background: rgba(240, 18, 190, 0.08); border: 1px solid rgba(240, 18, 190, 0.2); border-radius: 6px; color: #fff; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit;">
              <i class="fa-solid fa-calculator"></i> Kurulum Uyumunu Analiz Et
            </button>

            <!-- Vibration Output Area -->
            <div id="vibration-result-area" style="display: none; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1rem; margin-top: 1rem; animation: fadeIn 0.4s ease;">
              <div id="vibration-content"></div>
            </div>

          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- TAB 3: GREASE LAB & RAG DECISION CENTRE -->
      <!-- ========================================== -->
      <div id="bearing-tab-grease" class="bearing-tab-content" style="display: none;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          
          <!-- Column 3.1: Input Parameters -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem; margin-bottom: 0.5rem;">
              <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-magenta); padding-left: 10px;">
                GRES FİZİKSEL & KİMYASAL BULGULARI
              </h3>
              <i class="fa-solid fa-microscope" style="color: var(--accent-magenta); font-size: 1.1rem;"></i>
            </div>

            <!-- Chemical measurements -->
            <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04); display: flex; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">1. Laboratuvar Kimyasal Eşikleri</div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Fe (Demir) Miktarı (ppm)</label>
                  <input id="grease-fe-ppm" type="number" value="180" style="height: 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: &lt; 3000 ppm</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">PQ İndeksi</label>
                  <input id="grease-pq-index" type="number" value="45" style="height: 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: &lt; 300</span>
                </div>
              </div>

              <!-- VRing invalidation check -->
              <div style="display: flex; align-items: center; gap: 10px; background: rgba(255, 59, 48, 0.05); padding: 0.6rem 0.8rem; border-radius: 6px; border: 1px solid rgba(255, 59, 48, 0.15); margin-top: 5px;">
                <input id="grease-is-vring" type="checkbox" style="width: 16px; height: 16px; accent-color: #ff3b30; cursor: pointer;">
                <div>
                  <label for="grease-is-vring" style="font-size: 0.8rem; color: #ff8e89; font-weight: 700; cursor: pointer; display: block;">Sızıntı gresi mi? (V-Halkası)</label>
                  <span style="font-size: 0.7rem; color: #ff8e89; opacity: 0.8;">V-Ring sızıntı alanından toplanan numuneler geçersiz sayılır!</span>
                </div>
              </div>
            </div>

            <!-- Visual damage descriptors -->
            <div style="background: rgba(255,255,255,0.01); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); display: flex; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px;">2. Fiziksel / Görsel Bulgular (RAG Sınıfları)</div>
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Renk ve Görünüm</label>
                  <select id="grease-color" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="eski_net">Kırmızı (Mobil SHC 460 WT) - Temiz</option>
                    <option value="koyu_kırmızı">Koyu kırmızı ila kahverengi - Hafif yıpranmış</option>
                    <option value="gri_yesil">Bej (Mobil SHC 461 WT) - Griye çalan</option>
                    <option value="kahverengi_antrasit">Sarı (Klüberplex BEM 41-141) - Antrasit çalan</option>
                    <option value="siyah">Antrasit ila siyah - Kirli</option>
                    <option value="pirinc">Pirinç rengi / Altın sarısı metalik</option>
                    <option value="siyah_kırık">Katran siyahı ve metalik kırıklar</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Manyetizma Kriteri (Mıknatıs Testi)</label>
                  <select id="grease-magnetism" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="manyetik_degil">Manyetik Değil (Çekim Yok - Sağlam)</option>
                    <option value="hafif_manyetik">Hafif Manyetik</option>
                    <option value="manyetik">Manyetik (Belirgin Çekim ⚠️)</option>
                    <option value="cok_manyetik">Çok Manyetik (Ciddi Mıknatıslanma 🚨)</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Metal Parçacık Boyutu</label>
                  <select id="grease-particles" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="parlaklik">Çok ince bir metalik parlaklık</option>
                    <option value="tek_parcacık">Tekil / İzole metal parçacıklar</option>
                    <option value="cok_sayıda">Çok sayıda küçük metal parçacık</option>
                    <option value="zorlukla_ayirt_edilen">Çok sayıda, zorlukla ayırt edilen mikro parçacık</option>
                    <option value="kırık_yatak">Yatak parçaları ve makro eleman kırılması</option>
                  </select>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Viskozite / Akışkanlık</label>
                  <select id="grease-viscosity" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="normal">Normal Akışkanlık (Viskozite kaybı yok)</option>
                    <option value="hafif_akıskan">Hafif viskozite değişimi</option>
                    <option value="artan_koyu">Koyulaşmış gres (Artan viskozite)</option>
                    <option value="katılasmıs_yanık">Katılaşmış gres yapısı / Yanık kokusu</option>
                  </select>
                </div>
              </div>
            </div>

            <!-- Hidden File Input -->
            <input type="file" id="grease-photo-input" accept="image/*" style="display: none;" onchange="window.handleGreasePhotoUpload(event)">

            <!-- Upload Photo Box -->
            <div id="photo-upload-box" style="border: 2px dashed rgba(240, 18, 190, 0.25); background: rgba(240, 18, 190, 0.02); border-radius: 8px; padding: 1.5rem; text-align: center; cursor: pointer; transition: all 0.3s;" onclick="document.getElementById('grease-photo-input').click()">
              <i class="fa-solid fa-camera-retro" style="font-size: 1.8rem; color: var(--accent-magenta); margin-bottom: 0.5rem; opacity: 0.9;"></i>
              <div style="font-weight: 700; color: #fff; font-size: 0.85rem; margin-bottom: 2px;">Gres Fotoğrafı / Laboratuvar Raporunu Seç</div>
              <div style="font-size: 0.75rem; color: #8a8f98; margin-bottom: 8px;">Kameradan canlı çekin veya galeri/dosya seçin</div>
              <div id="uploaded-photo-preview-container" style="display: none; margin-top: 10px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); position: relative;">
                <img id="uploaded-photo-preview" src="" style="max-height: 120px; width: 100%; object-fit: cover;">
                <button type="button" onclick="event.stopPropagation(); window.removeUploadedGreasePhoto();" style="position: absolute; top: 5px; right: 5px; background: rgba(0,0,0,0.6); border: none; border-radius: 50%; width: 24px; height: 24px; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; outline: none;">
                  <i class="fa-solid fa-xmark" style="font-size: 0.8rem;"></i>
                </button>
              </div>
            </div>

            <!-- Run RAG Match / Analyze button -->
            <button id="grease-analyze-btn" onclick="window.triggerGreaseAnalysis()" style="height: 42px; width: 100%; background: rgba(240, 18, 190, 0.12); border: 1px solid rgba(240, 18, 190, 0.3); border-radius: 6px; color: #fff; font-size: 0.9rem; font-weight: 700; cursor: pointer; transition: all 0.3s; display: flex; align-items: center; justify-content: center; gap: 8px; font-family: inherit; margin-top: 5px; outline: none;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> RAG Karar Motorunu Çalıştır
            </button>
          </div>

          <!-- Column 3.2: RAG Output -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255, 255, 255, 0.05); backdrop-filter: blur(10px); display: flex; flex-direction: column; justify-content: flex-start; min-height: 100%;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.8rem; margin-bottom: 1rem;">
              <h3 style="margin: 0; font-size: 1.1rem; font-family: 'Rajdhani', sans-serif; color: #fff; font-weight: 700; border-left: 3px solid var(--accent-cyan); padding-left: 10px;">
                OTONOM RAG TEŞHİS RAPORU
              </h3>
              <i class="fa-solid fa-clipboard-list" style="color: var(--accent-cyan); font-size: 1.1rem;"></i>
            </div>

            <!-- Grease Output Area -->
            <div id="grease-result-area" class="hidden-result" style="display: none; background: rgba(0, 0, 0, 0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 1.2rem; animation: fadeIn 0.4s ease; flex-grow: 1;">
              <div id="grease-loader" style="text-align: center; padding: 3rem 0;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-magenta); margin-bottom: 1rem;"></i>
                <div style="font-size: 0.9rem; color: #8a8f98;">Görsel katman taranıyor, TD-esc-07 RAG standart veri seti eşleştiriliyor...</div>
              </div>
              <div id="grease-content" style="display: none;"></div>
            </div>

            <!-- Empty Placeholder -->
            <div id="grease-placeholder" style="text-align: center; padding: 4rem 1.5rem; opacity: 0.4; flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;">
              <i class="fa-solid fa-flask-vial" style="font-size: 2.5rem; color: #8a8f98;"></i>
              <div style="font-weight: 700; font-size: 0.95rem;">Henüz gres analizi yapılmadı</div>
              <div style="font-size: 0.8rem; max-width: 280px; margin: 0 auto;">Sol taraftaki fiziksel ve laboratuvar kimyasal bulgularını tamamlayıp raporu tetikleyin.</div>
            </div>

          </div>
        </div>
      </div>

      <!-- ========================================== -->
      <!-- MODAL: BEARING STATUS EDIT / UPDATE -->
      <!-- ========================================== -->
      <div id="bearing-edit-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
        <div class="glass-panel" style="background: #0d131f; border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 14px; width: 100%; max-width: 580px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; box-shadow: 0 10px 40px rgba(0,0,0,0.8); animation: fadeIn 0.3s ease;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem; margin-bottom: 1.2rem;">
            <div>
              <h3 id="modal-bearing-title" style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #fff;">
                <i class="fa-solid fa-arrows-rotate" style="color: var(--accent-cyan); margin-right: 8px;"></i> Rulman Durumunu Güncelle
              </h3>
              <div id="modal-bearing-subtitle" style="font-size: 0.8rem; color: #8a8f98; margin-top: 2px;"></div>
            </div>
            <button onclick="window.closeBearingEditModal()" style="background: none; border: none; color: #8a8f98; font-size: 1.2rem; cursor: pointer; padding: 4px;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <form id="bearing-edit-form" onsubmit="window.saveBearingEditModal(event)" style="display: flex; flex-direction: column; gap: 1rem;">
            <input type="hidden" id="modal-turbine-id">
            <input type="hidden" id="modal-site-id">
            <input type="hidden" id="modal-site-name">
            <input type="hidden" id="modal-turbine-label">

            <!-- Türbin Seçimi (Eğer üstteki butondan açıldıysa) -->
            <div id="modal-turbine-select-container" style="display: none; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.8rem; color: #fff; font-weight: 700;">Hedef Türbin</label>
              <select id="modal-target-turbine" onchange="window.handleModalTurbineSelect(this.value)" style="height: 38px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                <option value="">-- Türbin Seçiniz --</option>
                ${allTurbines.map(t => `<option value="${t.id}" data-site="${t.siteId}" data-sitename="${t.siteName}" data-label="${t.name}">${t.siteName} - ${t.name} (${t.id})</option>`).join('')}
              </select>
            </div>

            <!-- Rulman Sağlık Durumu Seçimi -->
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.85rem; color: #fff; font-weight: 700;">Rulman Durumu</label>
              <select id="modal-status-select" onchange="window.handleModalStatusChange(this.value)" style="height: 40px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.9rem; font-weight: 700; outline: none;">
                <option value="HEALTHY" style="background: #0b0f19; color: #00e676;">✅ SAĞLAM / TEMİZ (Rutin Yağlama)</option>
                <option value="FRONT_BEARING_REPLACED" style="background: #0b0f19; color: #c084fc;">🔄 ÖN RULMANI DEĞİŞTİRİLDİ</option>
                <option value="METAL_PARTICLE_DETECTED" style="background: #0b0f19; color: #f87171;">⚠️ METAL ÇAPAK TESPİT EDİLDİ (İzlemede / Riskli)</option>
              </select>
            </div>

            <!-- =============================== -->
            <!-- SECTION: ÖN RULMAN DEĞİŞİMİ -->
            <!-- =============================== -->
            <div id="modal-section-replaced" style="display: none; background: rgba(168, 85, 247, 0.05); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 8px; padding: 1rem; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #c084fc; font-size: 0.85rem; border-bottom: 1px solid rgba(168,85,247,0.15); padding-bottom: 4px;">
                <i class="fa-solid fa-arrows-rotate" style="margin-right: 6px;"></i> Ön Rulman Değişim Detayları
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Değişim Tarihi</label>
                  <input id="modal-repl-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Takılan Rulman Marka/Model</label>
                  <input id="modal-repl-model" type="text" placeholder="Örn: FAG 241/600 veya SKF" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">Değişim Nedeni</label>
                <input id="modal-repl-reason" type="text" placeholder="Örn: İç bilezikte çatlak / yorulma hasarı" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">İşlemi Yapan Teknisyen / Ekip</label>
                <input id="modal-repl-tech" type="text" placeholder="Örn: Fatih Zebek / Saha Ekibi" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>
            </div>

            <!-- =============================== -->
            <!-- SECTION: METAL ÇAPAK TESPİTİ -->
            <!-- =============================== -->
            <div id="modal-section-metal" style="display: none; background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; padding: 1rem; flex-direction: column; gap: 0.8rem;">
              <div style="font-weight: 700; color: #f87171; font-size: 0.85rem; border-bottom: 1px solid rgba(239, 68, 68, 0.15); padding-bottom: 4px;">
                <i class="fa-solid fa-magnet" style="margin-right: 6px;"></i> Metal Çapak & Aşınma Bulguları
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">İlk Tespit Tarihi</label>
                  <input id="modal-metal-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Mıknatıs Testi</label>
                  <select id="modal-metal-magnet" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                    <option value="POSITIVE" style="background: #0b0f19; color: #f87171;">🧲 Pozitif (Mıknatıs Çekiyor ⚠️)</option>
                    <option value="NEGATIVE" style="background: #0b0f19; color: #00e676;">Temiz / Negatif</option>
                  </select>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Fe (Demir) Miktarı (ppm)</label>
                  <input id="modal-metal-fe" type="number" placeholder="Örn: 3400" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">PQ İndeksi</label>
                  <input id="modal-metal-pq" type="number" placeholder="Örn: 350" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.8rem;">
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Flushing (Yıkama) Yapıldı mı?</label>
                  <select id="modal-metal-flushing" onchange="document.getElementById('modal-flushing-date-box').style.display = this.value === 'YES' ? 'flex' : 'none'" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none;">
                    <option value="NO" style="background: #0b0f19;">Bekliyor / Henüz Yapılmadı</option>
                    <option value="YES" style="background: #0b0f19;">Evet (Taze gres ile yıkandı)</option>
                  </select>
                </div>
                <div id="modal-flushing-date-box" style="display: none; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.75rem; color: #cbd0d8;">Flushing Tarihi</label>
                  <input id="modal-flushing-date" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                </div>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                <label style="font-size: 0.75rem; color: #cbd0d8;">Bir Sonraki Kontrol Tarihi (3 Aylık Takvim)</label>
                <input id="modal-metal-next" type="date" style="height: 36px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
              </div>
            </div>

            <!-- Genel Notlar -->
            <div style="display: flex; flex-direction: column; gap: 0.3rem;">
              <label style="font-size: 0.75rem; color: #cbd0d8;">Rulman Notları & Saha Açıklaması</label>
              <textarea id="modal-notes" rows="2" placeholder="Türbin rulman durumuyla ilgili özel notlar..." style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 8px 10px; font-size: 0.85rem; outline: none; font-family: inherit; resize: vertical;"></textarea>
            </div>

            <!-- Form Butonları -->
            <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
              <button type="button" onclick="window.closeBearingEditModal()" style="padding: 0.5rem 1.2rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.85rem; font-weight: 600; cursor: pointer;">
                İptal
              </button>
              <button type="submit" class="cyber-button" style="padding: 0.5rem 1.4rem; background: rgba(0, 242, 254, 0.15); border: 1px solid var(--accent-cyan); border-radius: 6px; color: var(--accent-cyan); font-size: 0.85rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-floppy-disk"></i> Kaydet
              </button>
            </div>

          </form>

      </div>
    </div>

    <!-- ========================================== -->
    <!-- TAB 4: SAHA ANALİZ KAYITLARI & GEÇMİŞ (TARİHÇE) -->
    <!-- ========================================== -->
    <div id="bearing-tab-history" class="bearing-tab-content" style="display: none;">
      <!-- Filter Controls -->
      <div class="glass-panel" style="padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; background: rgba(10, 15, 24, 0.6); border: 1px solid rgba(255,255,255,0.06);">
        <div style="display: flex; flex-wrap: wrap; gap: 10px; align-items: center; flex: 1;">
          <!-- Saha Filtresi -->
          <select id="insp-site-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Sahalar</option>
            ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
          </select>

          <!-- Analiz Türü Filtresi -->
          <select id="insp-type-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Analiz Türleri</option>
            <option value="ACOUSTIC">Akustik Ses Analizi</option>
            <option value="GREASE">Gres & Hasar Sınıfı Analizi</option>
          </select>

          <!-- Durum Filtresi -->
          <select id="insp-status-filter" onchange="window.updateInspectionsUI()" style="height: 36px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
            <option value="ALL">Tüm Durumlar</option>
            <option value="NORMAL">Normal / Temiz</option>
            <option value="WARNING">Uyarı / İnceleme</option>
            <option value="CRITICAL">Kritik / Hasar</option>
          </select>

          <!-- Arama Kutusu -->
          <input type="text" id="insp-search-input" oninput="window.updateInspectionsUI()" placeholder="Türbin no, teknisyen veya not ara..." style="height: 36px; min-width: 200px; flex: 1; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
        </div>

        <div style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: #8a8f98; font-weight: 700;">
          Kayıt Sayısı: <span id="insp-total-count" style="color: var(--accent-cyan); font-weight: 800; font-size: 1.1rem;">0</span>
        </div>
      </div>

      <!-- Inspections List Container -->
      <div id="bearing-inspections-list" style="display: flex; flex-direction: column; gap: 0.75rem;">
        <div style="text-align: center; padding: 3rem 0; color: #8a8f98;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: var(--accent-cyan); margin-bottom: 0.5rem;"></i>
          <div>Kayıtlar yükleniyor...</div>
        </div>
      </div>
    </div>

    <!-- Quiet Luxury Interactive Styles -->
    <style>
      .hidden-result { display: none; }
      .tab-nav-btn {
        background: none;
        border: none;
        outline: none;
        cursor: pointer;
        padding: 12px 20px;
        color: #8a8f98;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 1rem;
        transition: all 0.3s ease;
        position: relative;
      }
      .tab-nav-btn.active {
        color: #fff;
      }
      .tab-nav-btn.active::after {
        content: '';
        position: absolute;
        bottom: -2px;
        left: 0;
        width: 100%;
        height: 2px;
        background: var(--accent-cyan);
        box-shadow: 0 0 8px var(--accent-cyan);
      }
      .bearing-tab-content {
        display: none;
        animation: fadeIn 0.4s ease;
      }
      .bearing-tab-content.active-tab {
        display: block;
      }
      .fleet-filter-btn {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 6px;
        color: #8a8f98;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        font-size: 0.85rem;
        padding: 6px 14px;
        cursor: pointer;
        transition: all 0.2s ease;
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .fleet-filter-btn:hover {
        background: rgba(255, 255, 255, 0.08);
        color: #fff;
      }
      .fleet-filter-btn.active {
        background: rgba(0, 242, 254, 0.12);
        border-color: var(--accent-cyan);
        color: #fff;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
      }
      .yaw-toggle-btn.active {
        background: var(--accent-blue) !important;
        border-color: var(--accent-blue) !important;
        color: #000 !important;
      }
      .yaw-toggle-btn:hover {
        background: rgba(255, 255, 255, 0.1);
      }
      #live-audio-btn:hover {
        background: rgba(0, 242, 254, 0.15) !important;
        border-color: var(--accent-cyan) !important;
        box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
      }
      #photo-upload-box:hover {
        border-color: var(--accent-magenta) !important;
        background: rgba(240, 18, 190, 0.05) !important;
        box-shadow: 0 0 15px rgba(240, 18, 190, 0.1);
      }
      @keyframes rosePulse {
        0% {
          box-shadow: 0 0 0 0 rgba(244, 63, 94, 0.4);
        }
        70% {
          box-shadow: 0 0 0 10px rgba(244, 63, 94, 0);
        }
        100% {
          box-shadow: 0 0 0 0 rgba(244, 63, 94, 0);
        }
      }
      .recording-pulse {
        animation: rosePulse 1.5s infinite;
        background: rgba(244, 63, 94, 0.15) !important;
        border-color: rgba(244, 63, 94, 0.5) !important;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(8px); }
        to { opacity: 1; transform: translateY(0); }
      }
    </style>
  `;
};

// Global state variables
let isYawActive = false;
let mediaRecorder: any = null;
let audioChunks: any[] = [];
let recordingInterval: any = null;
let isRecording = false;
let simulationTimeout: any = null;
let bearingFleetUnsub: any = null;
let bearingInspectionsUnsub: any = null;

// ========================================================
// FLEET MANAGEMENT LOGIC & SUBSCRIBER
// ========================================================

const initFleetSubscription = () => {
  if (bearingFleetUnsub) {
    bearingFleetUnsub();
    bearingFleetUnsub = null;
  }

  bearingFleetUnsub = bearingService.subscribeAllRecords((records) => {
    (window as any).bearingFleetRecords = records;
    updateFleetUI();
  });

  if (bearingInspectionsUnsub) {
    bearingInspectionsUnsub();
    bearingInspectionsUnsub = null;
  }

  bearingInspectionsUnsub = bearingService.subscribeInspections((list) => {
    (window as any).bearingInspectionsList = list;
    updateInspectionsUI();
  });
};

const updateFleetUI = () => {
  const records: Record<string, BearingRecord> = (window as any).bearingFleetRecords || bearingService.getCachedRecords();
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const currentFilter = (window as any).currentFleetFilter || 'ALL';

  const siteFilterEl = document.getElementById('fleet-site-filter') as HTMLSelectElement;
  const searchInputEl = document.getElementById('fleet-search-input') as HTMLInputElement;
  const siteFilter = siteFilterEl ? siteFilterEl.value : 'ALL';
  const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  // KPI Calculations
  let replacedCount = 0;
  let metalCount = 0;
  let healthyCount = 0;

  allTurbines.forEach(t => {
    const rec = records[t.id];
    if (rec?.status === 'FRONT_BEARING_REPLACED') {
      replacedCount++;
    } else if (rec?.status === 'METAL_PARTICLE_DETECTED') {
      metalCount++;
    } else {
      healthyCount++;
    }
  });

  // Update KPI counters
  const kpiReplaced = document.getElementById('kpi-count-replaced');
  const kpiMetal = document.getElementById('kpi-count-metal');
  const kpiHealthy = document.getElementById('kpi-count-healthy');
  const btnReplaced = document.getElementById('btn-count-replaced');
  const btnMetal = document.getElementById('btn-count-metal');
  const btnHealthy = document.getElementById('btn-count-healthy');

  if (kpiReplaced) kpiReplaced.textContent = replacedCount.toString();
  if (kpiMetal) kpiMetal.textContent = metalCount.toString();
  if (kpiHealthy) kpiHealthy.textContent = healthyCount.toString();
  if (btnReplaced) btnReplaced.textContent = replacedCount.toString();
  if (btnMetal) btnMetal.textContent = metalCount.toString();
  if (btnHealthy) btnHealthy.textContent = healthyCount.toString();

  // Filter turbines
  const filteredTurbines = allTurbines.filter(t => {
    // 1. Site Filter
    if (siteFilter !== 'ALL' && t.siteId !== siteFilter) return false;

    // 2. Search Filter
    if (searchTerm) {
      const matchName = t.name.toLowerCase().includes(searchTerm);
      const matchId = t.id.toLowerCase().includes(searchTerm);
      const matchSite = t.siteName.toLowerCase().includes(searchTerm);
      if (!matchName && !matchId && !matchSite) return false;
    }

    // 3. Status Filter
    const rec = records[t.id];
    const status = rec?.status || 'HEALTHY';
    if (currentFilter === 'REPLACED' && status !== 'FRONT_BEARING_REPLACED') return false;
    if (currentFilter === 'METAL' && status !== 'METAL_PARTICLE_DETECTED') return false;
    if (currentFilter === 'HEALTHY' && status !== 'HEALTHY') return false;

    return true;
  });

  // Render cards
  const grid = document.getElementById('fleet-cards-grid');
  if (!grid) return;

  if (filteredTurbines.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 4rem 1.5rem; opacity: 0.5;">
        <i class="fa-solid fa-filter fa-2x" style="color: #8a8f98; margin-bottom: 0.5rem;"></i>
        <div style="font-weight: 700; font-size: 1rem; color: #fff;">Bu filtre kriterine uygun türbin bulunamadı</div>
        <div style="font-size: 0.8rem; color: #8a8f98;">Farklı bir filtre seçebilir veya arama terimini temizleyebilirsiniz.</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filteredTurbines.map(t => {
    const rec = records[t.id];
    const status: BearingConditionStatus = rec?.status || 'HEALTHY';

    let badgeHtml = '';
    let detailsHtml = '';
    let cardBorder = 'rgba(255, 255, 255, 0.05)';
    let cardGlow = 'none';

    if (status === 'FRONT_BEARING_REPLACED') {
      cardBorder = 'rgba(168, 85, 247, 0.35)';
      cardGlow = '0 0 15px rgba(168, 85, 247, 0.08)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #c084fc; background: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.4); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-arrows-rotate"></i> ÖN RULMAN DEĞİŞTİRİLDİ
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(168, 85, 247, 0.04); border: 1px solid rgba(168, 85, 247, 0.15); border-radius: 6px; padding: 8px; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Değişim Tarihi:</span>
            <strong style="color: #fff;">${rec?.replacementDate || 'Kayıtlı'}</strong>
          </div>
          ${rec?.replacedBearingModel ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Takılan Model:</span>
            <span style="color: #c084fc; font-weight: 700;">${rec.replacedBearingModel}</span>
          </div>` : ''}
          ${rec?.replacementReason ? `
          <div style="color: #a0a5b0; font-size: 0.72rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
            <i class="fa-solid fa-info-circle" style="color: #c084fc;"></i> ${rec.replacementReason}
          </div>` : ''}
        </div>
      `;
    } else if (status === 'METAL_PARTICLE_DETECTED') {
      cardBorder = 'rgba(239, 68, 68, 0.4)';
      cardGlow = '0 0 15px rgba(239, 68, 68, 0.1)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #f87171; background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-magnet"></i> ÇAPAK TAKİBİNDE
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 8px; font-size: 0.75rem; display: flex; flex-direction: column; gap: 4px; margin-top: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Mıknatıs Testi:</span>
            <span style="color: #f87171; font-weight: 800;">${rec?.magnetTestResult === 'POSITIVE' ? '🧲 Metal Çekiyor ⚠️' : 'Negatif'}</span>
          </div>
          ${rec?.fePpm || rec?.pqIndex ? `
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Kimyasal Limit:</span>
            <span style="color: #fff; font-weight: 700;">Fe: ${rec.fePpm || '-'} ppm | PQ: ${rec.pqIndex || '-'}</span>
          </div>` : ''}
          <div style="display: flex; justify-content: space-between;">
            <span style="color: #8a8f98;">Flushing (Yıkama):</span>
            <span style="font-weight: 700; color: ${rec?.flushingDone ? '#00e676' : '#ff9800'};">
              ${rec?.flushingDone ? '✅ Yapıldı' : '⏳ BEKLİYOR'}
            </span>
          </div>
          ${rec?.nextInspectionDate ? `
          <div style="display: flex; justify-content: space-between; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 2px;">
            <span style="color: #8a8f98;">Sonraki Kontrol:</span>
            <strong style="color: var(--accent-cyan);">${rec.nextInspectionDate}</strong>
          </div>` : ''}
        </div>
      `;
    } else {
      cardBorder = 'rgba(255, 255, 255, 0.05)';
      badgeHtml = `
        <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.72rem; font-weight: 800; color: #00e676; background: rgba(0, 230, 118, 0.08); border: 1px solid rgba(0, 230, 118, 0.25); padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 5px;">
          <i class="fa-solid fa-circle-check"></i> SAĞLAM / TEMİZ
        </span>
      `;
      detailsHtml = `
        <div style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 6px; padding: 8px; font-size: 0.75rem; color: #8a8f98; margin-top: 8px;">
          Rutin yağlama yapıldı. Metalik talaş veya aşınma bulgusu yok.
        </div>
      `;
    }

    return `
      <div class="glass-panel" style="background: rgba(10, 15, 24, 0.7); border: 1px solid ${cardBorder}; border-radius: 12px; padding: 1rem; box-shadow: ${cardGlow}; display: flex; flex-direction: column; justify-content: space-between; transition: all 0.2s;">
        <div>
          <!-- Header: Turbine Name & Badge -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; margin-bottom: 6px;">
            <div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; line-height: 1.2;">
                ${t.siteName} - ${t.name}
              </div>
              <div style="font-size: 0.72rem; color: #8a8f98; font-family: monospace; margin-top: 1px;">
                Seri No: ${t.id}
              </div>
            </div>
            ${badgeHtml}
          </div>

          <!-- Dynamic Details -->
          ${detailsHtml}

          ${rec?.notes ? `
          <div style="font-size: 0.72rem; color: #cbd0d8; font-style: italic; margin-top: 6px; padding-left: 6px; border-left: 2px solid rgba(255,255,255,0.2);">
            "${rec.notes}"
          </div>` : ''}

          ${rec?.lastInspectionDate ? `
          <div style="font-size: 0.72rem; color: #8a8f98; margin-top: 8px; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px;">
            <span><i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-cyan); margin-right: 4px;"></i>Son Ölçüm:</span>
            <strong style="color: ${rec.lastAcousticStatus === 'CRITICAL' ? '#ff3b30' : (rec.lastAcousticStatus === 'WARNING' ? '#ffcc00' : '#00ff66')};">${rec.lastInspectionDate} (${rec.lastAcousticStatus || 'Kayıt'})</strong>
          </div>` : ''}
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; gap: 8px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
          <button onclick="window.openBearingEditModal('${t.id}')" style="flex: 1; height: 32px; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;">
            <i class="fa-solid fa-pen-to-square"></i> Düzenle
          </button>
          <button onclick="window.selectTurbineForAnalysis('${t.id}', 'acoustics')" style="height: 32px; padding: 0 10px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 6px; color: var(--accent-cyan); font-size: 0.75rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 5px;" title="Akustik ve Gres Analizine Geç">
            <i class="fa-solid fa-microscope"></i> Analiz
          </button>
        </div>
      </div>
    `;
  }).join('');
};

// Filter handlers
(window as any).setFleetFilter = (filterType: 'ALL' | 'REPLACED' | 'METAL' | 'HEALTHY') => {
  (window as any).currentFleetFilter = filterType;
  const btnGroup = document.getElementById('fleet-filter-btn-group');
  if (btnGroup) {
    const buttons = btnGroup.querySelectorAll('.fleet-filter-btn');
    buttons.forEach((btn: any) => {
      if (btn.dataset.filter === filterType) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }
  updateFleetUI();
};

(window as any).handleFleetFilterChange = () => {
  updateFleetUI();
};

(window as any).selectTurbineForAnalysis = (turbineId: string, tab: 'acoustics' | 'grease') => {
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (selectEl) {
    selectEl.value = turbineId;
  }
  (window as any).switchBearingTab(tab);
};

// Modal handlers
(window as any).openBearingEditModal = (turbineId?: string) => {
  const modal = document.getElementById('bearing-edit-modal');
  if (!modal) return;

  const records: Record<string, BearingRecord> = (window as any).bearingFleetRecords || bearingService.getCachedRecords();
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];

  const titleEl = document.getElementById('modal-bearing-title');
  const subtitleEl = document.getElementById('modal-bearing-subtitle');
  const targetTurbineContainer = document.getElementById('modal-turbine-select-container');
  const targetTurbineSelect = document.getElementById('modal-target-turbine') as HTMLSelectElement;
  const statusSelect = document.getElementById('modal-status-select') as HTMLSelectElement;

  const idInput = document.getElementById('modal-turbine-id') as HTMLInputElement;
  const siteIdInput = document.getElementById('modal-site-id') as HTMLInputElement;
  const siteNameInput = document.getElementById('modal-site-name') as HTMLInputElement;
  const labelInput = document.getElementById('modal-turbine-label') as HTMLInputElement;

  const replDate = document.getElementById('modal-repl-date') as HTMLInputElement;
  const replModel = document.getElementById('modal-repl-model') as HTMLInputElement;
  const replReason = document.getElementById('modal-repl-reason') as HTMLInputElement;
  const replTech = document.getElementById('modal-repl-tech') as HTMLInputElement;

  const metalDate = document.getElementById('modal-metal-date') as HTMLInputElement;
  const metalMagnet = document.getElementById('modal-metal-magnet') as HTMLSelectElement;
  const metalFe = document.getElementById('modal-metal-fe') as HTMLInputElement;
  const metalPq = document.getElementById('modal-metal-pq') as HTMLInputElement;
  const metalFlushing = document.getElementById('modal-metal-flushing') as HTMLSelectElement;
  const flushingDate = document.getElementById('modal-flushing-date') as HTMLInputElement;
  const metalNext = document.getElementById('modal-metal-next') as HTMLInputElement;
  const notesInput = document.getElementById('modal-notes') as HTMLTextAreaElement;

  if (turbineId) {
    const t = allTurbines.find(item => item.id === turbineId);
    const rec = records[turbineId];

    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-arrows-rotate" style="color: var(--accent-cyan); margin-right: 8px;"></i> ${t ? t.siteName + ' - ' + t.name : turbineId}`;
    if (subtitleEl) subtitleEl.textContent = `Seri No: ${turbineId} | Rulman Sağlık Durum Güncellemesi`;
    if (targetTurbineContainer) targetTurbineContainer.style.display = 'none';

    idInput.value = turbineId;
    siteIdInput.value = t?.siteId || rec?.siteId || '';
    siteNameInput.value = t?.siteName || rec?.siteName || '';
    labelInput.value = t?.name || rec?.turbineLabel || '';

    statusSelect.value = rec?.status || 'HEALTHY';
    replDate.value = rec?.replacementDate || '';
    replModel.value = rec?.replacedBearingModel || '';
    replReason.value = rec?.replacementReason || '';
    replTech.value = rec?.replacementTechnician || '';

    metalDate.value = rec?.metalDetectedDate || '';
    metalMagnet.value = rec?.magnetTestResult || 'POSITIVE';
    metalFe.value = rec?.fePpm ? rec.fePpm.toString() : '';
    metalPq.value = rec?.pqIndex ? rec.pqIndex.toString() : '';
    metalFlushing.value = rec?.flushingDone ? 'YES' : 'NO';
    flushingDate.value = rec?.flushingDate || '';
    metalNext.value = rec?.nextInspectionDate || '';
    notesInput.value = rec?.notes || '';
  } else {
    // Açık seçim
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-plus" style="color: var(--accent-cyan); margin-right: 8px;"></i> Yeni Rulman Durum Kaydı`;
    if (subtitleEl) subtitleEl.textContent = `Aşağıdan türbin seçip rulman durumunu güncelleyin.`;
    if (targetTurbineContainer) targetTurbineContainer.style.display = 'flex';
    if (targetTurbineSelect) targetTurbineSelect.value = '';

    idInput.value = '';
    siteIdInput.value = '';
    siteNameInput.value = '';
    labelInput.value = '';
    statusSelect.value = 'HEALTHY';
    replDate.value = '';
    replModel.value = '';
    replReason.value = '';
    replTech.value = '';
    metalDate.value = '';
    metalMagnet.value = 'POSITIVE';
    metalFe.value = '';
    metalPq.value = '';
    metalFlushing.value = 'NO';
    flushingDate.value = '';
    metalNext.value = '';
    notesInput.value = '';
  }

  (window as any).handleModalStatusChange(statusSelect.value);
  modal.style.display = 'flex';
};

(window as any).closeBearingEditModal = () => {
  const modal = document.getElementById('bearing-edit-modal');
  if (modal) modal.style.display = 'none';
};

(window as any).handleModalTurbineSelect = (turbineId: string) => {
  const select = document.getElementById('modal-target-turbine') as HTMLSelectElement;
  if (!select || !turbineId) return;

  const selectedOpt = select.selectedOptions[0];
  const idInput = document.getElementById('modal-turbine-id') as HTMLInputElement;
  const siteIdInput = document.getElementById('modal-site-id') as HTMLInputElement;
  const siteNameInput = document.getElementById('modal-site-name') as HTMLInputElement;
  const labelInput = document.getElementById('modal-turbine-label') as HTMLInputElement;

  if (idInput) idInput.value = turbineId;
  if (siteIdInput) siteIdInput.value = selectedOpt.dataset.site || '';
  if (siteNameInput) siteNameInput.value = selectedOpt.dataset.sitename || '';
  if (labelInput) labelInput.value = selectedOpt.dataset.label || '';
};

(window as any).handleModalStatusChange = (status: string) => {
  const replSection = document.getElementById('modal-section-replaced');
  const metalSection = document.getElementById('modal-section-metal');
  if (!replSection || !metalSection) return;

  if (status === 'FRONT_BEARING_REPLACED') {
    replSection.style.display = 'flex';
    metalSection.style.display = 'none';
  } else if (status === 'METAL_PARTICLE_DETECTED') {
    replSection.style.display = 'none';
    metalSection.style.display = 'flex';
  } else {
    replSection.style.display = 'none';
    metalSection.style.display = 'none';
  }
};

(window as any).saveBearingEditModal = async (e: Event) => {
  e.preventDefault();
  const turbineId = (document.getElementById('modal-turbine-id') as HTMLInputElement)?.value;
  if (!turbineId) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }

  const siteId = (document.getElementById('modal-site-id') as HTMLInputElement)?.value || '';
  const siteName = (document.getElementById('modal-site-name') as HTMLInputElement)?.value || '';
  const turbineLabel = (document.getElementById('modal-turbine-label') as HTMLInputElement)?.value || '';
  const status = (document.getElementById('modal-status-select') as HTMLSelectElement)?.value as BearingConditionStatus;

  const record: BearingRecord = {
    id: turbineId,
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    status,
    notes: (document.getElementById('modal-notes') as HTMLTextAreaElement)?.value || ''
  };

  if (status === 'FRONT_BEARING_REPLACED') {
    record.replacementDate = (document.getElementById('modal-repl-date') as HTMLInputElement)?.value || '';
    record.replacedBearingModel = (document.getElementById('modal-repl-model') as HTMLInputElement)?.value || '';
    record.replacementReason = (document.getElementById('modal-repl-reason') as HTMLInputElement)?.value || '';
    record.replacementTechnician = (document.getElementById('modal-repl-tech') as HTMLInputElement)?.value || '';
  } else if (status === 'METAL_PARTICLE_DETECTED') {
    record.metalDetectedDate = (document.getElementById('modal-metal-date') as HTMLInputElement)?.value || '';
    record.magnetTestResult = (document.getElementById('modal-metal-magnet') as HTMLSelectElement)?.value as any;
    record.fePpm = parseFloat((document.getElementById('modal-metal-fe') as HTMLInputElement)?.value) || undefined;
    record.pqIndex = parseFloat((document.getElementById('modal-metal-pq') as HTMLInputElement)?.value) || undefined;
    record.flushingDone = (document.getElementById('modal-metal-flushing') as HTMLSelectElement)?.value === 'YES';
    record.flushingDate = (document.getElementById('modal-flushing-date') as HTMLInputElement)?.value || '';
    record.nextInspectionDate = (document.getElementById('modal-metal-next') as HTMLInputElement)?.value || '';
  }

  try {
    await bearingService.saveRecord(record);
    (window as any).closeBearingEditModal();
  } catch (error) {
    alert("Rulman kaydı kaydedilirken hata oluştu: " + error);
  }
};

// Automatic initialization when entering page
setTimeout(() => {
  initFleetSubscription();
}, 50);

// Tab switcher binding
(window as any).switchBearingTab = (tabId: 'fleet' | 'acoustics' | 'grease' | 'history') => {
  const fleetTab = document.getElementById('bearing-tab-fleet');
  const acousticTab = document.getElementById('bearing-tab-acoustics');
  const greaseTab = document.getElementById('bearing-tab-grease');
  const historyTab = document.getElementById('bearing-tab-history');

  const fleetBtn = document.getElementById('tab-btn-fleet');
  const acousticBtn = document.getElementById('tab-btn-acoustics');
  const greaseBtn = document.getElementById('tab-btn-grease');
  const historyBtn = document.getElementById('tab-btn-history');

  const tabs = [
    { id: 'fleet', tab: fleetTab, btn: fleetBtn },
    { id: 'acoustics', tab: acousticTab, btn: acousticBtn },
    { id: 'grease', tab: greaseTab, btn: greaseBtn },
    { id: 'history', tab: historyTab, btn: historyBtn }
  ];

  tabs.forEach(t => {
    if (t.tab && t.btn) {
      if (t.id === tabId) {
        t.tab.classList.add('active-tab');
        t.tab.style.display = 'block';
        t.btn.classList.add('active');
        t.btn.style.color = '#fff';
      } else {
        t.tab.classList.remove('active-tab');
        t.tab.style.display = 'none';
        t.btn.classList.remove('active');
        t.btn.style.color = '#8a8f98';
      }
    }
  });

  if (tabId === 'fleet') {
    updateFleetUI();
  } else if (tabId === 'history') {
    updateInspectionsUI();
  }
};

const updateInspectionsUI = () => {
  const container = document.getElementById('bearing-inspections-list');
  if (!container) return;

  const list: BearingInspection[] = (window as any).bearingInspectionsList || bearingService.getCachedInspections() || [];

  const siteFilterEl = document.getElementById('insp-site-filter') as HTMLSelectElement;
  const typeFilterEl = document.getElementById('insp-type-filter') as HTMLSelectElement;
  const statusFilterEl = document.getElementById('insp-status-filter') as HTMLSelectElement;
  const searchInputEl = document.getElementById('insp-search-input') as HTMLInputElement;

  const siteFilter = siteFilterEl ? siteFilterEl.value : 'ALL';
  const typeFilter = typeFilterEl ? typeFilterEl.value : 'ALL';
  const statusFilter = statusFilterEl ? statusFilterEl.value : 'ALL';
  const searchTerm = searchInputEl ? searchInputEl.value.trim().toLowerCase() : '';

  const filtered = list.filter(insp => {
    if (siteFilter !== 'ALL' && insp.siteId !== siteFilter) return false;
    if (typeFilter !== 'ALL' && insp.type !== typeFilter) return false;
    if (statusFilter !== 'ALL' && insp.condition !== statusFilter) return false;
    if (searchTerm) {
      const matchLabel = (insp.turbineLabel || '').toLowerCase().includes(searchTerm);
      const matchId = (insp.turbineId || '').toLowerCase().includes(searchTerm);
      const matchTech = (insp.inspector || '').toLowerCase().includes(searchTerm);
      const matchNotes = (insp.notes || '').toLowerCase().includes(searchTerm);
      const matchSite = (insp.siteName || '').toLowerCase().includes(searchTerm);
      if (!matchLabel && !matchId && !matchTech && !matchNotes && !matchSite) return false;
    }
    return true;
  });

  const countEl = document.getElementById('insp-total-count');
  if (countEl) countEl.innerText = String(filtered.length);

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="glass-panel" style="text-align: center; padding: 3rem 1rem; border-radius: 8px; color: #8a8f98; background: rgba(10, 15, 24, 0.4); border: 1px dashed rgba(255,255,255,0.08);">
        <i class="fa-solid fa-clipboard-question" style="font-size: 2.2rem; color: #5a6070; margin-bottom: 0.8rem;"></i>
        <div style="font-weight: 700; color: #cbd0d8; font-size: 1rem; margin-bottom: 4px;">Kayıtlı Analiz Raporu Bulunamadı</div>
        <div style="font-size: 0.85rem; max-width: 450px; margin: 0 auto;">
          Akustik veya Gres modülünden analiz tamamlandıktan sonra "Analiz Raporunu Kaydet" butonuna basarak saha testlerini buraya arşivleyebilirsiniz.
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(insp => {
    const isCritical = insp.condition === 'CRITICAL';
    const isWarning = insp.condition === 'WARNING';
    const borderColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');
    const badgeBg = isCritical ? 'rgba(255, 59, 48, 0.12)' : (isWarning ? 'rgba(255, 204, 0, 0.12)' : 'rgba(0, 255, 102, 0.12)');
    const badgeColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');

    const isAcoustic = insp.type === 'ACOUSTIC';
    const typeBadge = isAcoustic
      ? `<span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;"><i class="fa-solid fa-microphone-lines"></i> Akustik Ses</span>`
      : `<span style="display: inline-flex; align-items: center; gap: 4px; background: rgba(168, 85, 247, 0.1); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;"><i class="fa-solid fa-flask"></i> Gres RAG</span>`;

    return `
      <div class="glass-panel" style="border-radius: 8px; background: rgba(10, 15, 24, 0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid ${borderColor}; padding: 1rem; display: flex; flex-direction: column; gap: 0.6rem; transition: background 0.2s;">
        <!-- Top Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 800; color: #fff; font-size: 1rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              ${insp.siteName || ''} - ${insp.turbineLabel || insp.turbineId}
            </span>
            <span style="font-size: 0.72rem; color: #8a8f98; font-family: monospace;">(Seri: ${insp.turbineId})</span>
            ${typeBadge}
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 0.78rem; color: #8a8f98;"><i class="fa-regular fa-clock" style="margin-right: 4px;"></i>${insp.dateFormatted || insp.createdAt}</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 0.78rem; font-family: 'Rajdhani', sans-serif;">
              ${insp.condition}
            </span>
            <button onclick="window.deleteInspectionRecord('${insp.id}')" style="background: none; border: none; color: #8a8f98; cursor: pointer; padding: 4px; font-size: 0.85rem;" title="Raporu Sil">
              <i class="fa-solid fa-trash-can" onmouseover="this.style.color='#ff3b30'" onmouseout="this.style.color='#8a8f98'"></i>
            </button>
          </div>
        </div>

        <!-- Metrics Row -->
        <div style="display: flex; flex-wrap: wrap; gap: 12px; background: rgba(255,255,255,0.02); padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.8rem;">
          ${isAcoustic ? `
            <div><span style="color: #8a8f98;">Pik Frekans:</span> <strong style="color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.95rem;">${insp.peakFrequency || '--'} Hz</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Vuruntu:</span> ${insp.knocksDetected ? '<strong style="color: #ff3b30;">MEVCUT</strong>' : '<strong style="color: #00ff66;">TEMİZ</strong>'}</div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Sürtünme:</span> ${insp.frictionDetected ? '<strong style="color: #ffcc00;">TESPİT EDİLDİ</strong>' : '<strong style="color: #00ff66;">TEMİZ</strong>'}</div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Yaw:</span> <strong style="color: #cbd0d8;">${insp.yawSimulationMode === 'WITH_YAW' ? 'Devrede' : 'Sabit'}</strong></div>
          ` : `
            <div><span style="color: #8a8f98;">Hasar Sınıfı:</span> <strong style="color: ${badgeColor}; font-weight: 800;">Sınıf ${insp.greaseClass || '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Fe:</span> <strong style="color: #cbd0d8;">${insp.fePpm !== undefined ? insp.fePpm + ' ppm' : '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">PQ:</span> <strong style="color: #cbd0d8;">${insp.pqIndex !== undefined ? insp.pqIndex : '--'}</strong></div>
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1);"></div>
            <div><span style="color: #8a8f98;">Renk:</span> <strong style="color: #cbd0d8;">${insp.greaseColor || '--'}</strong></div>
          `}
          <div style="margin-left: auto; color: #8a8f98;">
            <i class="fa-solid fa-user-check" style="margin-right: 4px; color: var(--accent-cyan);"></i>${insp.inspector || 'Teknisyen'}
          </div>
        </div>

        <!-- Message / Notes -->
        ${insp.message ? `<div style="font-size: 0.82rem; color: #cbd0d8; line-height: 1.35;"><strong style="color: #8a8f98;">Ajan Teşhisi:</strong> ${insp.message}</div>` : ''}
        ${insp.notes ? `<div style="font-size: 0.82rem; color: #ffeb3b; background: rgba(255, 235, 59, 0.05); border: 1px solid rgba(255, 235, 59, 0.15); border-radius: 4px; padding: 4px 8px; line-height: 1.35;"><i class="fa-regular fa-comment-dots" style="margin-right: 5px;"></i><strong>Teknisyen Notu:</strong> ${insp.notes}</div>` : ''}

        ${isCritical ? `
          <div style="display: flex; justify-content: flex-end; margin-top: 4px;">
            <button onclick="window.selectTurbineForAnalysis('${insp.turbineId}', 'acoustics'); window.createFlushingWorkOrder();" style="height: 30px; padding: 0 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 4px; color: #fff; font-weight: 700; font-size: 0.75rem; cursor: pointer; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> Flushing İş Emri Aç
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
};

(window as any).updateInspectionsUI = updateInspectionsUI;

(window as any).deleteInspectionRecord = async (id: string) => {
  if (!confirm("Bu analiz raporunu silmek istediğinizden emin misiniz?")) return;
  try {
    await bearingService.deleteInspection(id);
    if ((window as any).showToast) {
      (window as any).showToast('Silindi', 'Analiz raporu başarıyla silindi.', 'info');
    }
  } catch (err: any) {
    alert("Rapor silinirken hata oluştu: " + err.message);
  }
};

// Vibration setup handler
(window as any).handleVibSetupChange = (value: string) => {
  const inputsContainer = document.getElementById('vib-inputs-container');
  const bypassBanner = document.getElementById('vib-bypass-banner');
  const calcBtn = document.getElementById('vib-calc-btn');
  const resultArea = document.getElementById('vibration-result-area');

  if (inputsContainer && bypassBanner && calcBtn) {
    if (value === 'cihaz_yok') {
      inputsContainer.style.display = 'none';
      bypassBanner.style.display = 'block';
      calcBtn.style.display = 'none';
      if (resultArea) resultArea.style.display = 'none';
    } else {
      inputsContainer.style.display = 'block';
      bypassBanner.style.display = 'none';
      calcBtn.style.display = 'flex';
    }
  }
};

// Grease photo upload helper
(window as any).handleGreasePhotoUpload = (event: any) => {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e: any) => {
    const previewImg = document.getElementById('uploaded-photo-preview') as HTMLImageElement;
    const previewContainer = document.getElementById('uploaded-photo-preview-container');
    if (previewImg && previewContainer) {
      previewImg.src = e.target.result;
      previewContainer.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// Remove grease photo
(window as any).removeUploadedGreasePhoto = () => {
  const fileInput = document.getElementById('grease-photo-input') as HTMLInputElement;
  const previewImg = document.getElementById('uploaded-photo-preview') as HTMLImageElement;
  const previewContainer = document.getElementById('uploaded-photo-preview-container');

  if (fileInput) fileInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
};

(window as any).setYawSimulation = (active: boolean) => {
  isYawActive = active;
  const offBtn = document.getElementById('yaw-off-btn');
  const onBtn = document.getElementById('yaw-on-btn');
  if (offBtn && onBtn) {
    if (active) {
      onBtn.classList.add('active');
      offBtn.classList.remove('active');
    } else {
      offBtn.classList.add('active');
      onBtn.classList.remove('active');
    }
  }
};

(window as any).startLiveAudioRecording = async () => {
  const btn = document.getElementById('live-audio-btn');
  const micIcon = document.getElementById('mic-icon');
  const micText = document.getElementById('mic-text');
  const resultArea = document.getElementById('acoustic-result-area');
  const loader = document.getElementById('acoustic-loader');
  const content = document.getElementById('acoustic-content');

  if (!btn || !micIcon || !micText || !resultArea || !loader || !content) return;

  const stopAndProcess = async (blob?: Blob) => {
    isRecording = false;
    clearInterval(recordingInterval);
    btn.classList.remove('recording-pulse');
    micIcon.className = 'fa-solid fa-microphone';
    micIcon.style.color = 'var(--accent-cyan)';
    micText.innerText = 'Canlı Ses Kaydet (1 Dk)';

    resultArea.style.display = 'block';
    loader.style.display = 'block';
    content.style.display = 'none';

    const result: AcousticAnalysisResult = await bearingAgent.analyzeAcoustics(
      blob ? 'live_recording.wav' : 'technician_audio_upload.wav',
      isYawActive ? 'WITH_YAW' : 'NO_YAW'
    );

    loader.style.display = 'none';
    content.style.display = 'block';

    if (result.status === 'CANCELLED') {
      content.innerHTML = `
        <div style="background: rgba(255, 59, 48, 0.08); border: 1px solid rgba(255, 59, 48, 0.2); border-radius: 6px; padding: 1rem; display: flex; align-items: flex-start; gap: 12px;">
          <i class="fa-solid fa-triangle-exclamation" style="color: #ff3b30; font-size: 1.2rem; margin-top: 2px;"></i>
          <div>
            <div style="font-weight: 700; color: #ff3b30; font-size: 0.9rem; margin-bottom: 4px;">ANALİZ İPTAL EDİLDİ</div>
            <div style="color: #ff8e89; font-weight: 600; font-size: 0.9rem;">"${result.message}"</div>
          </div>
        </div>
      `;
    } else {
      const isCritical = result.bearingCondition === 'CRITICAL';
      const isWarning = result.bearingCondition === 'WARNING';
      const badgeColor = isCritical ? '#ff3b30' : (isWarning ? '#ffcc00' : '#00ff66');
      const badgeBg = isCritical ? 'rgba(255, 59, 48, 0.1)' : (isWarning ? 'rgba(255, 204, 0, 0.1)' : 'rgba(0, 255, 102, 0.1)');

      content.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 700; color: #fff;">Spektrum Analiz Sonucu:</span>
            <span style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 3px 10px; border-radius: 4px; font-weight: 800; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif;">
              ${result.bearingCondition}
            </span>
          </div>

          <p style="margin: 0; color: #e0e4ec; line-height: 1.4; font-size: 0.9rem;">${result.message}</p>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03);">
            <div>
              <div style="font-size: 0.8rem; color: #8a8f98;">Vuruntu Algılama</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                ${result.knocksDetected ? '<span style="color: #ff3b30;">MEVCUT (VURUNTU VAR)</span>' : '<span style="color: #00ff66;">TEMİZ</span>'}
              </div>
            </div>
            <div>
              <div style="font-size: 0.8rem; color: #8a8f98;">Sürtünme Metalik Ses</div>
              <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                ${result.frictionDetected ? '<span style="color: #ffcc00;">TESPİT EDİLDİ</span>' : '<span style="color: #00ff66;">TEMİZ</span>'}
              </div>
            </div>
            <div style="grid-column: span 2; margin-top: 5px; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 5px;">
              <div style="font-size: 0.8rem; color: #8a8f98;">Pik Spektral Frekans</div>
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan); font-size: 1.1rem;">
                ${result.peakFrequency} Hz <span style="font-size: 0.8rem; font-weight: 500; color: #8a8f98;">(Normal Limit: &lt; 200 Hz)</span>
              </div>
            </div>
          </div>

          <!-- Save Acoustic Analysis Action Block -->
          <div style="margin-top: 5px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <input type="text" id="acoustic-technician-note" placeholder="Saha teknisyeni gözlem notu (Opsiyonel)..." style="flex: 1; min-width: 200px; height: 38px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
              <button id="save-acoustic-analysis-btn" onclick="window.saveCurrentAcousticAnalysis()" style="height: 38px; padding: 0 16px; background: rgba(0, 255, 102, 0.15); border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s;">
                <i class="fa-solid fa-floppy-disk"></i> Analiz Raporunu Kaydet
              </button>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8a8f98;">
              <span><i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); margin-right: 4px;"></i>Kaydettiğinizde türbin geçmişine ve 'Saha Analiz Kayıtları' sekmesine işlenir.</span>
              <button onclick="window.switchBearingTab('history')" style="background: none; border: none; color: var(--accent-cyan); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
                Geçmiş Kayıtları Gör &rarr;
              </button>
            </div>
          </div>
        </div>
      `;

      (window as any).lastAcousticResult = { result, isYawActive };
    }
  };

  if (isRecording) {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    } else {
      if (simulationTimeout) clearTimeout(simulationTimeout);
      stopAndProcess();
    }
    return;
  }

  resultArea.style.display = 'none';
  content.style.display = 'none';

  isRecording = true;
  btn.classList.add('recording-pulse');
  micIcon.className = 'fa-solid fa-circle fa-beat';
  micIcon.style.color = '#f43f5e';
  
  let seconds = 0;
  micText.innerText = `Kaydı Durdur ve Analiz Et (00:00 / 01:00)`;

  recordingInterval = setInterval(() => {
    seconds++;
    const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
    const ss = String(seconds % 60).padStart(2, '0');
    micText.innerText = `Kaydı Durdur ve Analiz Et (${mm}:${ss} / 01:00)`;
    if (seconds >= 60) {
      clearInterval(recordingInterval);
    }
  }, 1000);

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'audio/ogg' };
    }
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: '' };
    }

    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event: any) => {
      if (event.data && event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      stream.getTracks().forEach(track => track.stop());
      stopAndProcess(audioBlob);
    };

    mediaRecorder.start();

    simulationTimeout = setTimeout(() => {
      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }, 60000);

  } catch (error) {
    console.warn('Microphone access not available or denied, running simulation mode.', error);
    simulationTimeout = setTimeout(() => {
      stopAndProcess();
    }, 60000);
  }
};

// Portable vibration requirements checker
(window as any).triggerVibrationCompliance = () => {
  const resultArea = document.getElementById('vibration-result-area');
  const content = document.getElementById('vibration-content');

  if (!resultArea || !content) return;

  const rotorSpeedPct = parseFloat((document.getElementById('vib-rotor-speed') as HTMLInputElement)?.value) || 0;
  const speedFluctuation = parseFloat((document.getElementById('vib-fluctuation') as HTMLInputElement)?.value) || 0;
  const measurementDuration = parseFloat((document.getElementById('vib-duration') as HTMLInputElement)?.value) || 0;
  const measurementsCount = parseInt((document.getElementById('vib-count') as HTMLInputElement)?.value) || 0;
  const sensorSensitivity = parseFloat((document.getElementById('vib-sensitivity') as HTMLInputElement)?.value) || 0;
  const sensorFrequencyRangeMin = parseFloat((document.getElementById('vib-freq-min') as HTMLInputElement)?.value) || 0.33;
  
  const noYawDuringMeasurement = (document.getElementById('vib-noyaw') as HTMLInputElement)?.checked;
  const noIceBuildUp = (document.getElementById('vib-noice') as HTMLInputElement)?.checked;

  const complianceInput = {
    rotorSpeedPct,
    speedFluctuation,
    measurementDuration,
    measurementsCount,
    noYawDuringMeasurement,
    noIceBuildUp,
    sensorSensitivity,
    sensorFrequencyRangeMin,
    sensorFrequencyRangeMax: 450, // standard value from checklist
    channelCount: 2, // standard value
    samplingRate: 4800 // standard value (>4000 Hz)
  };

  const result = bearingAgent.validateVibrationCompliance(complianceInput);

  resultArea.style.display = 'block';
  
  const headerColor = result.isFullyCompliant ? '#00ff66' : '#ffcc00';
  const headerBg = result.isFullyCompliant ? 'rgba(0, 255, 102, 0.08)' : 'rgba(255, 204, 0, 0.08)';

  let checksHtml = '';
  for (const [key, check] of Object.entries(result.checks)) {
    const icon = check.status ? 'fa-solid fa-circle-check text-success' : 'fa-solid fa-circle-xmark text-danger';
    const color = check.status ? '#00ff66' : '#ff3b30';
    
    // Friendly name map for UI display
    const labelMap: Record<string, string> = {
      rotorSpeed: "Nominal Rotor Hızı oranı",
      speedFluctuation: "Hız Dalgalanması",
      measurementDuration: "Kayıt/Ölçüm Süresi",
      measurementsCount: "Periyodik Ölçüm Sayısı",
      noYaw: "Nacelle (Sapma) Kararlılığı",
      noIce: "Rotor Kanat Temizliği (Buz)",
      sensorSensitivity: "Sensör Duyarlılığı",
      sensorFreqRange: "Frekans Doğrusallık Aralığı",
      channelCount: "Sistem Kanal Sayısı",
      samplingRate: "Örnekleme Hızı (Sampling)"
    };
    const friendlyName = labelMap[key] || key;

    checksHtml += `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
        <td style="padding: 6px 0; color: #e0e4ec; font-size: 0.85rem; font-weight: 600;">${friendlyName}</td>
        <td style="padding: 6px 0; color: #a0a5b0; font-size: 0.8rem;">${check.value}</td>
        <td style="padding: 6px 0; color: #8a8f98; font-size: 0.8rem; font-style: italic;">${check.target}</td>
        <td style="padding: 6px 0; text-align: right; color: ${color}; font-size: 0.9rem;">
          <i class="${icon}"></i>
        </td>
      </tr>
    `;
  }

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      <div style="background: ${headerBg}; border: 1px solid ${headerColor}; padding: 0.8rem; border-radius: 6px; display: flex; align-items: flex-start; gap: 10px;">
        <i class="${result.isFullyCompliant ? 'fa-solid fa-circle-check' : 'fa-solid fa-triangle-exclamation'}" style="color: ${headerColor}; font-size: 1.1rem; margin-top: 2px;"></i>
        <div>
          <div style="font-weight: 700; color: ${headerColor}; font-size: 0.85rem;">ENERCON D03220088/0.0 UYUMLULUK DENETİMİ</div>
          <div style="font-size: 0.8rem; color: #e0e4ec; margin-top: 2px; font-weight: 600; line-height: 1.3;">${result.summaryText}</div>
        </div>
      </div>

      <div style="max-height: 250px; overflow-y: auto; margin-top: 5px;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); font-size: 0.75rem; color: #8a8f98;">
              <th style="padding-bottom: 6px;">Denetlenen Kriter</th>
              <th style="padding-bottom: 6px;">Ölçülen Değer</th>
              <th style="padding-bottom: 6px;">Asgari Hedef</th>
              <th style="padding-bottom: 6px; text-align: right;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${checksHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

// RAG visual and chemical grease analysis
(window as any).triggerGreaseAnalysis = async () => {
  const resultArea = document.getElementById('grease-result-area');
  const placeholder = document.getElementById('grease-placeholder');
  const loader = document.getElementById('grease-loader');
  const content = document.getElementById('grease-content');

  if (!resultArea || !loader || !content || !placeholder) return;

  placeholder.style.display = 'none';
  resultArea.style.display = 'block';
  loader.style.display = 'block';
  content.style.display = 'none';

  const color = (document.getElementById('grease-color') as HTMLSelectElement)?.value;
  const magnetism = (document.getElementById('grease-magnetism') as HTMLSelectElement)?.value;
  const particles = (document.getElementById('grease-particles') as HTMLSelectElement)?.value;
  const viscosity = (document.getElementById('grease-viscosity') as HTMLSelectElement)?.value;
  
  const isVRingSample = (document.getElementById('grease-is-vring') as HTMLInputElement)?.checked;
  const fePpm = parseFloat((document.getElementById('grease-fe-ppm') as HTMLInputElement)?.value) || 0;
  const pqIndex = parseFloat((document.getElementById('grease-pq-index') as HTMLInputElement)?.value) || 0;

  const result: GreaseAnalysisResult = await bearingAgent.analyzeGrease(
    'technician_grease_upload.jpg',
    { color, magnetism, particles, viscosity, isVRingSample, fePpm, pqIndex }
  );

  loader.style.display = 'none';
  content.style.display = 'block';

  (window as any).lastGreaseResult = {
    result,
    color,
    magnetism,
    particles,
    viscosity,
    isVRingSample,
    fePpm,
    pqIndex
  };

  const isSevere = ['D', 'E', 'F'].includes(result.detectedClass);
  const isModerate = result.detectedClass === 'C';
  const themeColor = isSevere ? '#ff3b30' : (isModerate ? '#ff9900' : '#00ff66');
  const themeBg = isSevere ? 'rgba(255, 59, 48, 0.1)' : (isModerate ? 'rgba(255, 153, 0, 0.1)' : 'rgba(0, 255, 102, 0.1)');

  const lab = result.chemicalAssessment;
  let labStatusHtml = '';

  if (lab) {
    const labColor = lab.status === 'CRITICAL' ? '#ff3b30' : (lab.status === 'WARNING' ? '#ffcc00' : '#00ff66');
    const labBg = lab.status === 'CRITICAL' ? 'rgba(255, 59, 48, 0.08)' : (lab.status === 'WARNING' ? 'rgba(255, 204, 0, 0.08)' : 'rgba(0, 255, 102, 0.08)');
    
    labStatusHtml = `
      <div style="background: ${labBg}; border: 1px solid ${labColor}; padding: 0.8rem; border-radius: 6px; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 4px; margin-bottom: 4px;">
          <span style="font-weight: 700; color: #fff; font-size: 0.8rem;">KİMYASAL & LABORATUVAR DURUMU:</span>
          <span style="color: ${labColor}; font-weight: 800; font-size: 0.8rem;">${lab.status}</span>
        </div>
        <div style="font-size: 0.8rem; color: #e0e4ec; line-height: 1.3;">${lab.evaluationText}</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-top: 6px; font-size: 0.75rem;">
          <div style="color: #8a8f98;">Numune Tipi: <strong style="color: #fff;">${lab.greaseType}</strong></div>
          <div style="color: #8a8f98;">Renk Karşılığı: <strong style="color: #fff;">${lab.greaseColor}</strong></div>
        </div>
      </div>
    `;
  }

  // Flushing CTA button if critical
  const showFlushingBtn = (lab && lab.status === 'CRITICAL' && !lab.isVRingSample) || isSevere;

  content.innerHTML = `
    <div style="display: flex; flex-direction: column; gap: 0.8rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.4rem;">
        <div>
          <div style="font-size: 0.75rem; color: #8a8f98;">HEDEF REFERANS TALİMATNAMESİ</div>
          <div style="font-weight: 700; color: #fff; font-size: 0.85rem;">TD-esc-07-de-tr-17-004 Rev002 / D02980100</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 0.75rem; color: #8a8f98;">RAG Eşleşme Skoru</div>
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan); font-size: 1.1rem;">%${result.confidence}</div>
        </div>
      </div>

      <!-- Chemical Assessment Badge -->
      ${labStatusHtml}

      <!-- Detected Class Display -->
      <div style="display: flex; align-items: center; gap: 0.8rem; background: ${themeBg}; border: 1px solid ${themeColor}; padding: 0.8rem; border-radius: 8px;">
        <div style="width: 42px; height: 42px; border-radius: 8px; background: rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-family: 'Rajdhani', sans-serif; font-weight: 900; font-size: 1.5rem; color: ${themeColor}; border: 1px solid ${themeColor}40;">
          ${result.detectedClass}
        </div>
        <div>
          <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">${result.className}</div>
          <div style="font-size: 0.8rem; color: #cbd0d8; margin-top: 1px;">Hasar Kategorisi Tespiti</div>
        </div>
      </div>

      <!-- Match Description -->
      <div style="display: flex; flex-direction: column; gap: 2px;">
        <span style="font-weight: 700; color: #fff; font-size: 0.8rem;">Görsel / Fiziksel Spektral Bulgular:</span>
        <p style="margin: 0; color: #a0a5b0; font-size: 0.85rem; line-height: 1.35;">${result.description}</p>
      </div>

      <!-- Action Required -->
      <div style="background: rgba(255, 255, 255, 0.02); border-left: 3px solid ${themeColor}; padding: 0.7rem; border-radius: 0 6px 6px 0;">
        <div style="font-weight: 700; color: #fff; font-size: 0.8rem; margin-bottom: 2px;">TALİMATNAME GEREĞİ AKSİYON:</div>
        <p style="margin: 0; color: #cbd0d8; font-size: 0.85rem; line-height: 1.35; font-weight: 600;">${result.actionRequired}</p>
      </div>

      ${showFlushingBtn ? `
      <!-- Flushing Action Button -->
      <button onclick="window.createFlushingWorkOrder()" style="height: 40px; background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; border-radius: 6px; color: #fff; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 5px; box-shadow: 0 0 12px rgba(239, 68, 68, 0.25);">
        <i class="fa-solid fa-triangle-exclamation" style="color: #ef4444;"></i> 🚨 ENERCON FLUSHING (YIKAMA) İŞ EMRİ OLUŞTUR
      </button>
      ` : ''}

      <!-- Save Grease Analysis Action Block -->
      <div style="margin-top: 5px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <input type="text" id="grease-technician-note" placeholder="Numune / saha teknisyen notu (Opsiyonel)..." style="flex: 1; min-width: 200px; height: 38px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;" />
          <button id="save-grease-analysis-btn" onclick="window.saveCurrentGreaseAnalysis()" style="height: 38px; padding: 0 16px; background: rgba(0, 255, 102, 0.15); border: 1px solid #00ff66; border-radius: 6px; color: #00ff66; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; transition: all 0.2s;">
            <i class="fa-solid fa-floppy-disk"></i> Gres Analizini Kaydet
          </button>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #8a8f98;">
          <span><i class="fa-solid fa-circle-info" style="color: var(--accent-cyan); margin-right: 4px;"></i>Kaydettiğinizde türbin geçmişine ve 'Saha Analiz Kayıtları' sekmesine işlenir.</span>
          <button onclick="window.switchBearingTab('history')" style="background: none; border: none; color: var(--accent-cyan); font-size: 0.75rem; cursor: pointer; text-decoration: underline;">
            Geçmiş Kayıtları Gör &rarr;
          </button>
        </div>
      </div>
    </div>
  `;
};

(window as any).createFlushingWorkOrder = () => {
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  const turbineId = selectEl ? selectEl.value : '';
  alert(`Seçilen türbin (${turbineId}) için Enercon D02980100 standardı uyarınca Rulman Gres Flushing (Yıkama) iş emri oluşturuluyor...`);
  if (typeof (window as any).navigate === 'function') {
    (window as any).navigate('task-create');
  }
};

(window as any).saveCurrentAcousticAnalysis = async () => {
  const last = (window as any).lastAcousticResult;
  if (!last || !last.result) {
    alert("Kaydedilecek analiz sonucu bulunamadı.");
    return;
  }
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (!selectEl || !selectEl.value) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }
  const turbineId = selectEl.value;
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turbineObj = allTurbines.find(t => t.id === turbineId);
  const siteId = turbineObj?.siteId || '';
  const siteName = turbineObj?.siteName || '';
  const turbineLabel = turbineObj?.name || turbineId;

  const noteInput = document.getElementById('acoustic-technician-note') as HTMLInputElement;
  const notes = noteInput ? noteInput.value.trim() : '';

  const saveBtn = document.getElementById('save-acoustic-analysis-btn');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...`;
    (saveBtn as HTMLButtonElement).disabled = true;
  }

  const currentUser = authService.getCurrentUser();
  const inspector = (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Saha Teknisyeni';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const inspection: Omit<BearingInspection, 'id'> = {
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    type: 'ACOUSTIC',
    createdAt: now.toISOString(),
    dateFormatted,
    inspector,
    condition: last.result.bearingCondition || 'NORMAL',
    peakFrequency: last.result.peakFrequency,
    knocksDetected: last.result.knocksDetected,
    frictionDetected: last.result.frictionDetected,
    yawSimulationMode: last.isYawActive ? 'WITH_YAW' : 'NO_YAW',
    message: last.result.message,
    notes
  };

  try {
    await bearingService.saveInspection(inspection);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Kaydedildi!`;
      saveBtn.style.background = 'rgba(0, 255, 102, 0.25)';
      saveBtn.style.borderColor = '#00ff66';
      (saveBtn as HTMLButtonElement).disabled = true;
    }
    if ((window as any).showToast) {
      (window as any).showToast('Başarılı', `${turbineLabel} için akustik analiz kaydı oluşturuldu.`, 'success');
    } else {
      alert(`${turbineLabel} için akustik analiz kaydı başarıyla oluşturuldu.`);
    }
  } catch (err: any) {
    console.error("Analiz kaydetme hatası:", err);
    alert("Analiz kaydedilemedi: " + err.message);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Tekrar Dene`;
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  }
};

(window as any).saveCurrentGreaseAnalysis = async () => {
  const last = (window as any).lastGreaseResult;
  if (!last || !last.result) {
    alert("Kaydedilecek gres analiz sonucu bulunamadı.");
    return;
  }
  const selectEl = document.getElementById('analysis-turbine-select') as HTMLSelectElement;
  if (!selectEl || !selectEl.value) {
    alert("Lütfen bir türbin seçiniz.");
    return;
  }
  const turbineId = selectEl.value;
  const allTurbines: any[] = (window as any).currentFleetTurbines || [];
  const turbineObj = allTurbines.find(t => t.id === turbineId);
  const siteId = turbineObj?.siteId || '';
  const siteName = turbineObj?.siteName || '';
  const turbineLabel = turbineObj?.name || turbineId;

  const noteInput = document.getElementById('grease-technician-note') as HTMLInputElement;
  const notes = noteInput ? noteInput.value.trim() : '';

  const saveBtn = document.getElementById('save-grease-analysis-btn');
  if (saveBtn) {
    saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...`;
    (saveBtn as HTMLButtonElement).disabled = true;
  }

  const currentUser = authService.getCurrentUser();
  const inspector = (currentUser as any)?.displayName || (currentUser as any)?.name || currentUser?.email || 'Saha Teknisyeni';

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

  const isCritical = ['D', 'E', 'F'].includes(last.result.detectedClass);
  const isWarning = last.result.detectedClass === 'C';
  const condition: 'NORMAL' | 'WARNING' | 'CRITICAL' = isCritical ? 'CRITICAL' : (isWarning ? 'WARNING' : 'NORMAL');

  const inspection: Omit<BearingInspection, 'id'> = {
    turbineId,
    turbineLabel,
    siteId,
    siteName,
    type: 'GREASE',
    createdAt: now.toISOString(),
    dateFormatted,
    inspector,
    condition,
    greaseClass: last.result.detectedClass,
    greaseClassName: last.result.className,
    greaseColor: last.color,
    fePpm: last.fePpm,
    pqIndex: last.pqIndex,
    message: `${last.result.description} (RAG Güven: %${last.result.confidence})`,
    actionRequired: last.result.actionRequired,
    notes
  };

  try {
    await bearingService.saveInspection(inspection);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> Kaydedildi!`;
      saveBtn.style.background = 'rgba(0, 255, 102, 0.25)';
      saveBtn.style.borderColor = '#00ff66';
      (saveBtn as HTMLButtonElement).disabled = true;
    }
    if ((window as any).showToast) {
      (window as any).showToast('Başarılı', `${turbineLabel} için gres analiz kaydı oluşturuldu.`, 'success');
    } else {
      alert(`${turbineLabel} için gres analiz kaydı başarıyla oluşturuldu.`);
    }
  } catch (err: any) {
    console.error("Gres analiz kaydetme hatası:", err);
    alert("Gres analizi kaydedilemedi: " + err.message);
    if (saveBtn) {
      saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Tekrar Dene`;
      (saveBtn as HTMLButtonElement).disabled = false;
    }
  }
};
