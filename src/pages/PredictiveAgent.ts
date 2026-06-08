import { aiService } from '../services/AiService';
import { dataService } from '../services/DataService';

export const PredictiveAgentPage = () => {
  return `
    <div class="glass-panel" style="padding: 2rem; border-color: rgba(0, 243, 255, 0.3);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 class="page-title" style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan);"></i>
            YAPAY ZEKA ÖNLEYİCİ BAKIM AJANI
          </h2>
          <p style="color: var(--text-muted); font-size: 0.9rem; max-width: 600px; line-height: 1.5; margin-top: 0.5rem;">
            Geçmiş arıza raporlarınızı ve görev geçmişinizi analiz ederek, önümüzdeki ay arıza yapma ihtimali yüksek olan parçaları tahmin eder.
          </p>
        </div>
        
        <div style="display: flex; gap: 1rem; align-items: center; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid rgba(0,243,255,0.1);">
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.7rem; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif;">TARİH ARALIĞI</label>
            <select id="pred-date-filter" class="cyber-input" style="min-width: 120px;">
              <option value="1">Son 1 Ay</option>
              <option value="3">Son 3 Ay</option>
              <option value="6" selected>Son 6 Ay</option>
              <option value="12">Son 1 Yıl</option>
              <option value="24">Son 2 Yıl</option>
            </select>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label style="font-size: 0.7rem; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif;">SANTRAL SEÇİMİ</label>
            <select id="pred-site-filter" class="cyber-input" style="min-width: 150px;">
              <option value="all">Tüm Santraller</option>
              ${dataService.getSites().map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>

          <button id="start-prediction-btn" class="cyber-button primary" onclick="window.runPredictions()" style="font-size: 1rem; padding: 0.8rem 1.5rem; letter-spacing: 1px; height: 42px; margin-top: 18px;">
            <i class="fa-solid fa-radar"></i> ANALİZİ BAŞLAT
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div id="prediction-loading" class="hidden" style="text-align: center; padding: 4rem 0;">
        <div class="cyber-loader" style="width: 80px; height: 80px; margin: 0 auto 2rem;"></div>
        <h3 style="color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; letter-spacing: 3px; font-size: 1.2rem;" class="loading-text">
          YAPAY ZEKA GEÇMİŞ VERİLERİ ANALİZ EDİYOR...
        </h3>
        <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 0.5rem;">
          Bu işlem verinizin büyüklüğüne göre 10-30 saniye sürebilir. Lütfen bekleyin.
        </p>
      </div>

      <!-- Results Container -->
      <div id="prediction-results" class="hidden">
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(350px, 1fr)); gap: 1.5rem;" id="prediction-cards-container">
          <!-- Cards will be injected here -->
        </div>
      </div>
      
      <!-- Empty/Error State -->
      <div id="prediction-empty" class="hidden" style="text-align: center; padding: 3rem; background: rgba(255,255,255,0.02); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.1);">
        <i class="fa-solid fa-check-circle" style="font-size: 3rem; color: var(--accent-green); margin-bottom: 1rem;"></i>
        <h3 style="color: var(--text-main); font-family: 'Rajdhani'; font-size: 1.2rem; margin-bottom: 0.5rem;">Kritik Bir Risk Bulunamadı</h3>
        <p style="color: var(--text-muted); font-size: 0.9rem;">Yapay zeka analizine göre yakın zamanda yüksek arıza riski taşıyan bir parça tespit edilmedi.</p>
      </div>

    </div>
  `;
};

(window as any).runPredictions = async () => {
  const btn = document.getElementById('start-prediction-btn') as HTMLButtonElement;
  const loading = document.getElementById('prediction-loading');
  const results = document.getElementById('prediction-results');
  const container = document.getElementById('prediction-cards-container');
  const emptyState = document.getElementById('prediction-empty');

  if (!btn || !loading || !results || !container || !emptyState) return;

  const dateFilter = (document.getElementById('pred-date-filter') as HTMLSelectElement)?.value || '6';
  const siteFilter = (document.getElementById('pred-site-filter') as HTMLSelectElement)?.value || 'all';

  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ANALİZ EDİLİYOR...';
  btn.style.opacity = '0.7';

  loading.classList.remove('hidden');
  results.classList.add('hidden');
  emptyState.classList.add('hidden');
  container.innerHTML = '';

  try {
    const predictions = await aiService.runPredictiveMaintenanceAnalysis(siteFilter, parseInt(dateFilter, 10));

    if (!predictions || predictions.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      predictions.sort((a, b) => b.probability - a.probability); // Sort by highest probability

      predictions.forEach((pred: any) => {
        // Find turbine details
        const sites = dataService.getSites();
        let turbineName = pred.turbineNo;
        let siteName = 'Bilinmeyen Saha';
        let siteId = '';
        
        // Search through turbines across all sites
        for (const site of sites) {
          const turbines = dataService.getTurbinesBySite(site.id);
          const t = turbines.find(t => t.id === pred.turbineNo || (t.label || t.no.toString()) === pred.turbineNo);
          if (t) {
            turbineName = t.label || `T${t.no.toString().padStart(2, '0')}`;
            siteId = site.id;
            siteName = site.name;
            break;
          }
        }

        const probColor = pred.probability >= 80 ? 'var(--accent-red)' : (pred.probability >= 50 ? 'var(--accent-amber)' : 'var(--accent-green)');
        
        const cardHtml = `
          <div class="task-card-premium" style="flex-direction: column; align-items: stretch; border-left: 4px solid ${probColor}; background: rgba(0,0,0,0.3);">
            
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
              <div>
                <div style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; margin-bottom: 4px;">
                  <i class="fa-solid fa-location-dot"></i> ${siteName} | ${turbineName}
                </div>
                <h3 style="font-size: 1.1rem; color: var(--text-main); font-family: 'Rajdhani', sans-serif; font-weight: 700; margin: 0;">
                  ${pred.component}
                </h3>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.5rem; font-weight: 800; color: ${probColor}; font-family: 'Rajdhani'; line-height: 1;">
                  %${pred.probability}
                </div>
                <div style="font-size: 0.6rem; color: var(--text-muted); text-transform: uppercase;">Arıza İhtimali</div>
              </div>
            </div>

            <!-- Progress Bar -->
            <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; margin-bottom: 1rem;">
              <div style="width: ${pred.probability}%; height: 100%; background: ${probColor}; box-shadow: 0 0 10px ${probColor}; transition: width 1s ease;"></div>
            </div>

            <div style="background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05);">
              <div style="font-size: 0.75rem; color: #cbd5e1; line-height: 1.4; margin-bottom: 8px;">
                <strong><i class="fa-solid fa-robot" style="color: var(--accent-cyan);"></i> AI Tespit:</strong> ${pred.reason}
              </div>
              <div style="font-size: 0.75rem; color: var(--accent-green); line-height: 1.4; font-weight: 600;">
                <i class="fa-solid fa-wrench"></i> Öneri: ${pred.recommendedAction}
              </div>
            </div>

            <button onclick="window.createPreventiveTask('${encodeURIComponent(JSON.stringify({ ...pred, siteName, siteId, turbineName }))}')" class="btn-cyber-outline" style="width: 100%; justify-content: center; border-color: ${probColor}; color: ${probColor};">
              <i class="fa-solid fa-bolt"></i> ÖNLEYİCİ İŞ EMRİ BAŞLAT
            </button>

          </div>
        `;
        container.insertAdjacentHTML('beforeend', cardHtml);
      });
      results.classList.remove('hidden');
    }

  } catch (err: any) {
    console.error("Prediction Error:", err);
    if ((window as any).showToast) {
      (window as any).showToast('ANALİZ HATASI', err.message || 'Yapay Zeka sunucusuna ulaşılamadı.', 'error');
    } else {
      alert("Analiz sırasında hata: " + err.message);
    }
  } finally {
    loading.classList.add('hidden');
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-radar"></i> ANALİZİ YENİLE';
    btn.style.opacity = '1';
  }
};

(window as any).createPreventiveTask = (predStr: string) => {
  const pred = JSON.parse(decodeURIComponent(predStr));
  
  if (!confirm(`"${pred.turbineName}" türbinindeki "${pred.component}" parçası için önleyici iş emri oluşturulacak. Onaylıyor musunuz?`)) {
    return;
  }

  // Pre-fill a new task and navigate to new task form
  const taskData = {
    secilenSablon: 'Genel Arıza / Bakım Formu', // or 'Önleyici Bakım'
    sahaBilgisi: pred.siteName,
    siteId: pred.siteId,
    turbinNo: pred.turbineName,
    yoneticiNotu: `YAPAY ZEKA ÖNLEYİCİ BAKIM TAVSİYESİ:\n\nParça: ${pred.component}\nRisk Oranı: %${pred.probability}\nTespit: ${pred.reason}\nÖnerilen Aksiyon: ${pred.recommendedAction}`,
    // Set to automatically open as a draft or pre-filled form
  };

  // We can pass this to navigate as a param
  if ((window as any).navigate) {
    (window as any).navigate('new-task', taskData);
    if ((window as any).showToast) {
      (window as any).showToast('TASLAK OLUŞTURULDU', 'Yapay zeka verileriyle iş emri taslağı hazırlandı.', 'success');
    }
  }
};
