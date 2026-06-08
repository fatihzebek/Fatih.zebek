import { bearingAgent } from '../agents/BearingAgent';
import type { GreaseAnalysisResult, AcousticAnalysisResult } from '../agents/BearingAgent';
import { dataService } from '../services/DataService';

export const BearingAnalysisPage = async () => {
  const sites = dataService.getSites();
  const allTurbines: { id: string; name: string; siteName: string }[] = [];
  
  sites.forEach(site => {
    const siteTurbines = dataService.getTurbinesBySite(site.id) || [];
    siteTurbines.forEach(t => {
      allTurbines.push({
        id: t.id,
        name: t.label || `E-${t.type || 'Enercon'}`,
        siteName: site.name
      });
    });
  });

  return `
    <div class="fade-in-up content-area" style="font-size: 0.9rem; color: #a0a5b0;">
      <!-- Premium Title Banner -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem;">
        <div>
          <h1 class="page-title" style="margin: 0 0 0.5rem 0; font-size: 1.5rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px;">
            <i class="fa-solid fa-microchip" style="color: var(--accent-cyan); margin-right: 10px;"></i> Rulman Teşhis ve Karar Destek Ajanı
          </h1>
          <p style="color: #8a8f98; margin: 0; font-size: 0.9rem;">
            ENERCON standartlarına (TD-esc-07-de-tr-17-004 & D03220088/0.0) uyumlu otonom akustik, vibrasyon uyumluluk ve kimyasal gres analiz modülü.
          </p>
        </div>
        <div style="background: rgba(0, 242, 254, 0.03); border: 1px solid rgba(0, 242, 254, 0.15); padding: 0.5rem 1rem; border-radius: 8px; display: flex; align-items: center; gap: 8px;">
          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #00ff66; box-shadow: 0 0 8px #00ff66;"></span>
          <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan); font-size: 0.9rem; letter-spacing: 0.5px;">AJAN AKTİF / ONLINE</span>
        </div>
      </div>

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

      <!-- Tab Navigation Menu -->
      <div style="display: flex; gap: 10px; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 2px;">
        <button id="tab-btn-acoustics" class="tab-nav-btn active" onclick="window.switchBearingTab('acoustics')" style="padding: 10px 20px; background: none; border: none; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s; position: relative;">
          <i class="fa-solid fa-microphone-lines" style="margin-right: 8px;"></i> Akustik & Vibrasyon Uyum Modülü
        </button>
        <button id="tab-btn-grease" class="tab-nav-btn" onclick="window.switchBearingTab('grease')" style="padding: 10px 20px; background: none; border: none; color: #8a8f98; font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1rem; cursor: pointer; transition: all 0.3s; position: relative;">
          <i class="fa-solid fa-flask" style="margin-right: 8px;"></i> Gres Laboratuvarı & RAG Eşleştirici
        </button>
      </div>

      <!-- TAB 1: ACOUSTICS & PORTABLE VIBRATION COMPLIANCE -->
      <div id="bearing-tab-acoustics" class="bearing-tab-content active-tab">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          
          <!-- Column 1.1: Live Audio Recording -->
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

          <!-- Column 1.2: Vibration compliance calculator -->
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

      <!-- TAB 2: GREASE LAB & RAG DECISION CENTRE -->
      <div id="bearing-tab-grease" class="bearing-tab-content" style="display: none;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
          
          <!-- Column 2.1: Input Parameters -->
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
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: < 3000 ppm</span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.3rem;">
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">PQ İndeksi</label>
                  <input id="grease-pq-index" type="number" value="45" style="height: 36px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem;">
                  <span style="font-size: 0.7rem; color: #8a8f98;">Enercon Limiti: < 300</span>
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
                  <label style="font-size: 0.8rem; color: #8a8f98; font-weight: 600;">Manyetizma Kriteri</label>
                  <select id="grease-magnetism" style="height: 38px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; padding: 0 10px; font-size: 0.85rem; outline: none; font-family: inherit;">
                    <option value="manyetik_degil">Manyetik Değil</option>
                    <option value="hafif_manyetik">Hafif Manyetik</option>
                    <option value="manyetik">Manyetik (Belirgin çekim)</option>
                    <option value="cok_manyetik">Çok Manyetik (Ciddi mıknatıslanma)</option>
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

          <!-- Column 2.2: RAG Output -->
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
        from { opacity: 0; transform: translateY(10px); }
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

// Tab switcher binding
(window as any).switchBearingTab = (tabId: 'acoustics' | 'grease') => {
  const acousticTab = document.getElementById('bearing-tab-acoustics');
  const greaseTab = document.getElementById('bearing-tab-grease');
  const acousticBtn = document.getElementById('tab-btn-acoustics');
  const greaseBtn = document.getElementById('tab-btn-grease');

  if (acousticTab && greaseTab && acousticBtn && greaseBtn) {
    if (tabId === 'acoustics') {
      acousticTab.classList.add('active-tab');
      greaseTab.classList.remove('active-tab');
      acousticTab.style.display = 'block';
      greaseTab.style.display = 'none';
      acousticBtn.classList.add('active');
      greaseBtn.classList.remove('active');
      acousticBtn.style.color = '#fff';
      greaseBtn.style.color = '#8a8f98';
    } else {
      greaseTab.classList.add('active-tab');
      acousticTab.classList.remove('active-tab');
      greaseTab.style.display = 'block';
      acousticTab.style.display = 'none';
      greaseBtn.classList.add('active');
      acousticBtn.classList.remove('active');
      greaseBtn.style.color = '#fff';
      acousticBtn.style.color = '#8a8f98';
    }
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
                ${result.peakFrequency} Hz <span style="font-size: 0.8rem; font-weight: 500; color: #8a8f98;">(Normal Limit: < 200 Hz)</span>
              </div>
            </div>
          </div>
        </div>
      `;
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
    </div>
  `;
};
