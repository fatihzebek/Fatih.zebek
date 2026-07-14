import { dataService } from '../services/DataService';

// WMO weather code to Turkish description and FontAwesome icon
function getWeatherDetails(code: number) {
  switch (code) {
    case 0:
      return { icon: 'fa-sun', color: '#ffb900', desc: 'Açık / Güneşli' };
    case 1:
    case 2:
    case 3:
      return { icon: 'fa-cloud-sun', color: '#94a3b8', desc: 'Parçalı Bulutlu' };
    case 45:
    case 48:
      return { icon: 'fa-smog', color: '#cbd5e1', desc: 'Sisli' };
    case 51:
    case 53:
    case 55:
      return { icon: 'fa-cloud-rain', color: '#60a5fa', desc: 'Hafif Çiseleme' };
    case 61:
    case 63:
    case 65:
      return { icon: 'fa-cloud-showers-heavy', color: '#3b82f6', desc: 'Yağmurlu' };
    case 71:
    case 73:
    case 75:
      return { icon: 'fa-snowflake', color: '#38bdf8', desc: 'Karlı' };
    case 80:
    case 81:
    case 82:
      return { icon: 'fa-cloud-showers-water', color: '#2563eb', desc: 'Sağanak Yağışlı' };
    case 95:
    case 96:
    case 99:
      return { icon: 'fa-cloud-bolt', color: '#f59e0b', desc: 'Gökgürültülü Sağanak' };
    default:
      return { icon: 'fa-cloud', color: '#64748b', desc: 'Bulutlu' };
  }
}

// Convert wind direction degrees to Turkish compass points
function getWindDirectionText(degrees: number) {
  if (degrees >= 337.5 || degrees < 22.5) return 'K (Kuzey)';
  if (degrees >= 22.5 && degrees < 67.5) return 'KD (Kuzeydoğu)';
  if (degrees >= 67.5 && degrees < 112.5) return 'D (Doğu)';
  if (degrees >= 112.5 && degrees < 157.5) return 'GD (Güneydoğu)';
  if (degrees >= 157.5 && degrees < 202.5) return 'G (Güney)';
  if (degrees >= 202.5 && degrees < 247.5) return 'GB (Güneybatı)';
  if (degrees >= 247.5 && degrees < 292.5) return 'B (Batı)';
  if (degrees >= 292.5 && degrees < 337.5) return 'KB (Kuzeybatı)';
  return String(degrees) + '°';
}

// Calculate the center coordinate of a site from its turbines
function getSiteCenterCoordinates(siteId: string) {
  const turbines = dataService.getTurbinesBySite(siteId);
  const valid = turbines.filter(t => t.latitude && t.longitude);
  if (valid.length > 0) {
    const lat = valid.reduce((acc, t) => acc + (t.latitude || 0), 0) / valid.length;
    const lon = valid.reduce((acc, t) => acc + (t.longitude || 0), 0) / valid.length;
    return { lat, lon };
  }
  // Safe fallbacks for Demirer sites
  switch (siteId) {
    case '3213': return { lat: 36.78, lon: 27.68 }; // Dares Datça
    case '2688': return { lat: 38.28, lon: 26.49 }; // Anemon İntepe
    case '3439': return { lat: 39.11, lon: 27.21 }; // Alize Sarıkaya
    case '2990': return { lat: 38.64, lon: 26.79 }; // Doğal Sayalar
    case '3793': return { lat: 39.06, lon: 27.18 }; // Alize Kuyucak
    default: return { lat: 38.3, lon: 27.1 }; // Izmir region default
  }
}

export const WeatherForecastPage = async () => {
  const allowedSites = dataService.getSites();
  if (allowedSites.length === 0) {
    return `
      <div class="content-area">
        <h2>Yetkili Saha Bulunamadı</h2>
        <p style="color: var(--text-muted);">Hava durumunu görüntülemek için yetkilendirilmiş bir sahanız olmalıdır.</p>
      </div>
    `;
  }

  // Get active site name from sessionStorage or default to first allowed site
  const initialSiteId = sessionStorage.getItem('activeWeatherSiteId') || allowedSites[0].id;
  const initialSite = allowedSites.find(s => s.id === initialSiteId) || allowedSites[0];
  (window as any).selectedWeatherSiteId = initialSite.id;

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; gap: 20px; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
        <div>
          <h1 class="page-title" style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; letter-spacing: 1.5px; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-cloud-bolt" style="color: var(--accent-cyan);"></i> SAHA HAVA TAHMİNLERİ
          </h1>
          <p style="color: var(--text-muted); margin: 5px 0 0 0; font-size: 0.9rem;">
            Rüzgar hızı, hamlesi ve yıldırım olasılığı analizleri (Güvenli tırmanma limitleri kontrolü).
          </p>
        </div>
        <div style="position: relative; width: 220px;">
          <select id="weather-site-select" onchange="window.handleWeatherSiteChange(this.value)" class="cyber-input" style="width: 100%; height: 38px; font-size: 0.85rem; font-weight: 700; background: #161b22; border: 1px solid rgba(0, 242, 254, 0.2); color: #fff; border-radius: 8px; cursor: pointer; padding-right: 30px; appearance: none; -webkit-appearance: none;">
            ${allowedSites.map(s => `
              <option value="${s.id}" ${s.id === initialSite.id ? 'selected' : ''}>${s.name}</option>
            `).join('')}
          </select>
          <i class="fa-solid fa-chevron-down" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); pointer-events: none; font-size: 0.8rem;"></i>
        </div>
      </div>

      <!-- Main Weather Dashboard Container -->
      <div id="weather-dashboard-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 6rem; background: rgba(10,15,25,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.03);">
        <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--accent-cyan); margin-bottom: 1.2rem;"></i>
        <span style="font-weight: 700; color: #fff; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">HAH HAVA TAHMİN VERİLERİ YÜKLENİYOR...</span>
      </div>

      <div id="weather-dashboard-content" style="display: none; flex-direction: column; gap: 20px;">
        <!-- Top Row: Current weather summary + Safety warning -->
        <div style="display: flex; gap: 20px; flex-wrap: wrap;">
          <!-- Left: Current Conditions Card -->
          <div class="glass-panel" style="flex: 3; min-width: 320px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; border: 1px solid rgba(255,255,255,0.05); position: relative; overflow: hidden;">
            <div style="display: flex; flex-direction: column; gap: 15px; z-index: 2;">
              <div>
                <div style="font-size: 0.75rem; font-weight: 800; color: var(--text-muted); text-transform: uppercase; letter-spacing: 1px;" id="current-site-header">YÜKLENİYOR...</div>
                <div style="display: flex; align-items: baseline; gap: 8px; margin-top: 5px;">
                  <span id="current-temp" style="font-size: 3.5rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #fff; line-height: 1;">-°</span>
                  <span style="font-size: 1rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;" id="current-desc">-</span>
                </div>
              </div>
              <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px 30px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 15px;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <i class="fa-solid fa-wind" style="color: var(--accent-cyan); font-size: 1.1rem; width: 20px; text-align: center;"></i>
                  <div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700;">RÜZGAR HIZI</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #fff;" id="current-wind-speed">- m/s</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <i class="fa-solid fa-compass" id="compass-icon" style="color: var(--accent-cyan); font-size: 1.1rem; width: 20px; text-align: center; transition: transform 1s ease;"></i>
                  <div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700;">RÜZGAR YÖNÜ</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #fff;" id="current-wind-dir">-</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <span style="color: var(--accent-cyan); font-size: 1.1rem; width: 20px; text-align: center; display: inline-block;">🌀</span>
                  <div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700;">RÜZGAR HAMLESİ</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #fff;" id="current-wind-gust">- m/s</div>
                  </div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                  <i class="fa-solid fa-bolt" style="color: #ff9f43; font-size: 1.1rem; width: 20px; text-align: center;"></i>
                  <div>
                    <div style="font-size: 0.6rem; color: var(--text-muted); font-weight: 700;">YILDIRIM OLASILIĞI</div>
                    <div style="font-size: 0.9rem; font-weight: 700; color: #fff;" id="current-lightning-prob">%0</div>
                  </div>
                </div>
              </div>
            </div>
            <!-- Large Weather Icon wrapper -->
            <div id="current-weather-icon-wrapper" style="width: 120px; height: 120px; display: flex; align-items: center; justify-content: center; z-index: 2; text-shadow: 0 0 25px currentColor;">
              <i id="current-weather-icon" class="fa-solid fa-sun" style="font-size: 5rem; color: rgb(255, 185, 0);"></i>
            </div>
            <!-- Background glow -->
            <div id="card-glow" style="position: absolute; right: -50px; bottom: -50px; width: 250px; height: 250px; border-radius: 50%; background: radial-gradient(circle, rgba(0,242,255,0.08) 0%, transparent 70%); filter: blur(30px); pointer-events: none; z-index: 1;"></div>
          </div>

          <!-- Right: Safety Alert Banner -->
          <div class="glass-panel" id="safety-alert-card" style="flex: 2; min-width: 280px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: center; gap: 12px; border: 1px solid rgba(255,255,255,0.05); position: relative;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div id="safety-status-icon-wrapper" style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
                <i id="safety-status-icon" class="fa-solid fa-check-circle"></i>
              </div>
              <div>
                <div style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">İş Güvenliği Durumu</div>
                <div style="font-size: 1.25rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; margin-top: 1px;" id="safety-status-title">SAHA GÜVENLİ</div>
              </div>
            </div>
            <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.5; margin: 0;" id="safety-status-desc">
              Saha rüzgar hızı tırmanma limitinin (12 m/s) altında ve yıldırım/fırtına riski bulunmamaktadır.
            </p>
            <div style="font-family: monospace; font-size: 0.7rem; color: var(--text-muted); border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 5px;" id="safety-last-updated">
              Son Güncelleme: 00:00
            </div>
          </div>
        </div>

        <!-- 7-Day Forecast Grid -->
        <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 15px; border: 1px solid rgba(255,255,255,0.05);">
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-calendar-days" style="color: var(--accent-cyan);"></i> 7 GÜNLÜK DETAYLI HAVA TAHMİNİ
          </h3>
          <div id="forecast-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 12px;">
            <!-- 7 days vertical cards -->
          </div>
        </div>

        <!-- Chart Mode Toggle & Title -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-chart-line" style="color: var(--accent-cyan);"></i> TAHMİN GRAFİKLERİ
          </h3>
          <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.25); padding: 3px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <button id="btn-mode-hourly" class="btn-cyber-mini" style="background: rgba(0, 242, 254, 0.15); border-color: var(--accent-cyan); color: #fff; font-size: 0.7rem; font-weight: 700; border-radius: 6px; padding: 5px 12px; cursor: pointer; transition: all 0.2s;" onclick="window.setWeatherChartMode('hourly')">
              Saatlik (24 Saat)
            </button>
            <button id="btn-mode-weekly" class="btn-cyber-mini" style="background: transparent; border-color: transparent; color: var(--text-muted); font-size: 0.7rem; font-weight: 700; border-radius: 6px; padding: 5px 12px; cursor: pointer; transition: all 0.2s;" onclick="window.setWeatherChartMode('weekly')">
              Haftalık (7 Gün)
            </button>
          </div>
        </div>

        <!-- Charts Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 20px;">
          <!-- Wind Chart -->
          <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 15px; border: 1px solid rgba(255,255,255,0.05); min-height: 360px; position: relative;">
            <h4 id="wind-chart-title" style="font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 0.8px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-wind" style="color: var(--accent-cyan);"></i> RÜZGAR HIZI VE HAMLESİ TAHMİNİ (SAATLİK)
            </h4>
            <div style="flex: 1; position: relative; width: 100%; height: 260px;">
              <canvas id="hourly-wind-chart"></canvas>
            </div>
          </div>

          <!-- Lightning Chart -->
          <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 15px; border: 1px solid rgba(255,255,255,0.05); min-height: 360px; position: relative;">
            <h4 id="lightning-chart-title" style="font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 800; color: #fff; margin: 0; letter-spacing: 0.8px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-bolt" style="color: #ff9f43;"></i> YILDIRIM VE YAĞIŞ RISKİ (SAATLİK)
            </h4>
            <div style="flex: 1; position: relative; width: 100%; height: 260px;">
              <canvas id="hourly-lightning-chart"></canvas>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global callback for site select change
(window as any).handleWeatherSiteChange = (siteId: string) => {
  (window as any).selectedWeatherSiteId = siteId;
  sessionStorage.setItem('activeWeatherSiteId', siteId);
  (window as any).initWeatherForecastPage?.();
};

let windChartInstance: any = null;
let lightningChartInstance: any = null;
let cachedWeatherData: any = null;
let weatherChartMode = 'hourly';

// Set graph mode (hourly / weekly)
(window as any).setWeatherChartMode = (mode: string) => {
  weatherChartMode = mode;
  
  const btnHourly = document.getElementById('btn-mode-hourly');
  const btnWeekly = document.getElementById('btn-mode-weekly');
  
  if (btnHourly && btnWeekly) {
    if (mode === 'hourly') {
      btnHourly.style.background = 'rgba(0, 242, 254, 0.15)';
      btnHourly.style.borderColor = 'var(--accent-cyan)';
      btnHourly.style.color = '#fff';
      
      btnWeekly.style.background = 'transparent';
      btnWeekly.style.borderColor = 'transparent';
      btnWeekly.style.color = 'var(--text-muted)';
    } else {
      btnWeekly.style.background = 'rgba(0, 242, 254, 0.15)';
      btnWeekly.style.borderColor = 'var(--accent-cyan)';
      btnWeekly.style.color = '#fff';
      
      btnHourly.style.background = 'transparent';
      btnHourly.style.borderColor = 'transparent';
      btnHourly.style.color = 'var(--text-muted)';
    }
  }

  if (cachedWeatherData) {
    (window as any).renderWeatherChartsOnly();
  }
};

// Helper function to render charts only
(window as any).renderWeatherChartsOnly = async () => {
  if (!cachedWeatherData) return;
  const data = cachedWeatherData;

  const windTitle = document.getElementById('wind-chart-title');
  const lightningTitle = document.getElementById('lightning-chart-title');

  let labels: string[] = [];
  let windSpeed: number[] = [];
  let windGust: number[] = [];
  let lightningProb: number[] = [];
  let precip: number[] = [];
  let precipLabel = '';
  let yAxisMax: number | undefined = undefined;

  if (weatherChartMode === 'hourly') {
    // 24 Hour values
    labels = data.hourly.time.slice(0, 24).map((t: string) => {
      const d = new Date(t);
      return d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    });
    windSpeed = data.hourly.windspeed_10m.slice(0, 24);
    windGust = data.hourly.windgusts_10m.slice(0, 24);
    precip = data.hourly.precipitation_probability.slice(0, 24);
    lightningProb = data.hourly.thunderstorm_probability.slice(0, 24);
    precipLabel = 'Yağış İhtimali (%)';
    yAxisMax = 100;

    if (windTitle) windTitle.innerHTML = `<i class="fa-solid fa-wind" style="color: var(--accent-cyan);"></i> RÜZGAR HIZI VE HAMLESİ TAHMİNİ (SAATLİK)`;
    if (lightningTitle) lightningTitle.innerHTML = `<i class="fa-solid fa-bolt" style="color: #ff9f43;"></i> YILDIRIM VE YAĞIŞ RISKİ (SAATLİK)`;
  } else {
    // 7 Day values
    const weekdaysShort = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    labels = data.daily.time.map((t: string) => {
      const d = new Date(t);
      return `${weekdaysShort[d.getDay()]} (${d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })})`;
    });
    windSpeed = data.daily.windspeed_10m_max;
    windGust = data.daily.windgusts_10m_max;
    precip = data.daily.precipitation_sum; // Daily rainfall in mm
    precipLabel = 'Yağış Miktarı (mm)';
    yAxisMax = undefined; // Auto-scale mm precipitation

    // Calculate max thunderstorm probability for each day
    for (let i = 0; i < 7; i++) {
      const dayHourly = data.hourly.thunderstorm_probability.slice(i * 24, (i + 1) * 24);
      lightningProb.push(Math.max(...dayHourly) || 0);
    }

    if (windTitle) windTitle.innerHTML = `<i class="fa-solid fa-wind" style="color: var(--accent-cyan);"></i> EN YÜKSEK RÜZGAR VE HAMLE TRENDİ (7 GÜNLÜK)`;
    if (lightningTitle) lightningTitle.innerHTML = `<i class="fa-solid fa-bolt" style="color: #ff9f43;"></i> MAKSİMUM YILDIRIM RISKİ VE YAĞIŞ MİKTARI (7 GÜNLÜK)`;
  }

  const { Chart, registerables } = await import('chart.js');
  Chart.register(...registerables);

  // Clean old instances
  if (windChartInstance) windChartInstance.destroy();
  if (lightningChartInstance) lightningChartInstance.destroy();

  // Draw Wind Chart
  const windCtx = (document.getElementById('hourly-wind-chart') as HTMLCanvasElement)?.getContext('2d');
  if (windCtx) {
    windChartInstance = new Chart(windCtx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Ortalama Rüzgar (m/s)',
            data: windSpeed,
            borderColor: '#00f2fe',
            backgroundColor: 'rgba(0, 242, 254, 0.05)',
            borderWidth: 2.5,
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#00f2fe',
            pointRadius: 1,
            pointHoverRadius: 4
          },
          {
            label: 'Rüzgar Hamlesi (m/s)',
            data: windGust,
            borderColor: '#ff4d4d',
            backgroundColor: 'transparent',
            borderWidth: 2,
            borderDash: [4, 4],
            fill: false,
            tension: 0.3,
            pointBackgroundColor: '#ff4d4d',
            pointRadius: 0,
            pointHoverRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94a3b8',
              font: { family: 'Rajdhani', weight: 'bold', size: 10 }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            ticks: { color: '#64748b', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 9 } },
            suggestedMin: 0,
            suggestedMax: 15
          }
        }
      }
    });
  }

  // Draw Lightning Chart
  const lightningCtx = (document.getElementById('hourly-lightning-chart') as HTMLCanvasElement)?.getContext('2d');
  if (lightningCtx) {
    lightningChartInstance = new Chart(lightningCtx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            type: 'line',
            label: 'Yıldırım Olasılığı (%)',
            data: lightningProb,
            borderColor: '#f59e0b',
            backgroundColor: 'transparent',
            borderWidth: 2.5,
            tension: 0.25,
            pointBackgroundColor: '#f59e0b',
            pointRadius: 2
          },
          {
            type: 'bar',
            label: precipLabel,
            data: precip,
            backgroundColor: 'rgba(59, 130, 246, 0.25)',
            borderColor: '#3b82f6',
            borderWidth: 1,
            borderRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: {
              color: '#94a3b8',
              font: { family: 'Rajdhani', weight: 'bold', size: 10 }
            }
          },
          tooltip: {
            mode: 'index',
            intersect: false
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: '#64748b', font: { size: 9 } }
          },
          y: {
            grid: { color: 'rgba(255, 255, 255, 0.05)' },
            ticks: { color: '#64748b', font: { size: 9 } },
            min: 0,
            max: yAxisMax
          }
        }
      }
    });
  }
};

(window as any).initWeatherForecastPage = async () => {
  const loading = document.getElementById('weather-dashboard-loading');
  const dashboard = document.getElementById('weather-dashboard-content');
  if (!loading || !dashboard) return;

  const siteId = (window as any).selectedWeatherSiteId;
  if (!siteId) return;

  // Show loader, hide dashboard
  loading.style.display = 'flex';
  dashboard.style.display = 'none';

  const siteObj = dataService.getSites().find(s => s.id === siteId);
  if (!siteObj) return;

  // Calculate coordinates
  const { lat, lon } = getSiteCenterCoordinates(siteId);

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,windspeed_10m,windgusts_10m,precipitation_probability,weathercode,cape,thunderstorm_probability&daily=weathercode,temperature_2m_max,temperature_2m_min,windspeed_10m_max,windgusts_10m_max,winddirection_10m_dominant,precipitation_sum&windspeed_unit=ms&timezone=auto`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.daily || !data.hourly) {
      throw new Error("API'den geçersiz veri döndü.");
    }

    // Cache the data
    cachedWeatherData = data;

    // 1. Populate current conditions
    const currentSiteHeader = document.getElementById('current-site-header');
    const currentTemp = document.getElementById('current-temp');
    const currentDesc = document.getElementById('current-desc');
    const currentWindSpeed = document.getElementById('current-wind-speed');
    const currentWindDir = document.getElementById('current-wind-dir');
    const currentWindGust = document.getElementById('current-wind-gust');
    const currentLightningProb = document.getElementById('current-lightning-prob');
    const currentWeatherIcon = document.getElementById('current-weather-icon') as HTMLElement;
    const compassIcon = document.getElementById('compass-icon') as HTMLElement;
    
    // Find closest hourly index matching current local time
    const localNow = new Date();
    let closestIdx = 0;
    let minDiff = Infinity;
    
    const times = data.hourly.time;
    for (let i = 0; i < times.length; i++) {
      const t = new Date(times[i]);
      const diff = Math.abs(t.getTime() - localNow.getTime());
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = i;
      }
    }

    const cTemp = Math.round(data.hourly.temperature_2m[closestIdx]);
    const cWindSpeed = data.hourly.windspeed_10m[closestIdx];
    const cWindGust = data.hourly.windgusts_10m[closestIdx];
    const cWeatherCode = data.hourly.weathercode[closestIdx];
    const cThunderProb = data.hourly.thunderstorm_probability[closestIdx] || 0;
    
    // Wind direction (use daily dominant direction for today)
    const cWindDirDeg = data.daily.winddirection_10m_dominant[0] || 0;
    const cWindDirText = getWindDirectionText(cWindDirDeg);

    if (currentSiteHeader) currentSiteHeader.textContent = siteObj.name.toUpperCase();
    if (currentTemp) currentTemp.textContent = `${cTemp}°C`;
    if (currentWindSpeed) currentWindSpeed.textContent = `${cWindSpeed.toFixed(1)} m/s`;
    if (currentWindGust) currentWindGust.textContent = `${cWindGust.toFixed(1)} m/s`;
    if (currentWindDir) currentWindDir.textContent = cWindDirText;
    if (currentLightningProb) currentLightningProb.textContent = `%${cThunderProb}`;

    // Update weather icon
    const weatherDetails = getWeatherDetails(cWeatherCode);
    if (currentDesc) currentDesc.textContent = weatherDetails.desc;
    if (currentWeatherIcon) {
      currentWeatherIcon.className = `fa-solid ${weatherDetails.icon}`;
      currentWeatherIcon.style.color = weatherDetails.color;
    }
    
    // Rotate compass icon
    if (compassIcon) {
      compassIcon.style.transform = `rotate(${cWindDirDeg}deg)`;
    }

    // 2. Calculate and render safety warning banner
    const safetyCard = document.getElementById('safety-alert-card');
    const safetyIcon = document.getElementById('safety-status-icon');
    const safetyIconWrapper = document.getElementById('safety-status-icon-wrapper');
    const safetyTitle = document.getElementById('safety-status-title');
    const safetyDesc = document.getElementById('safety-status-desc');
    const safetyUpdated = document.getElementById('safety-last-updated');

    if (safetyCard && safetyIcon && safetyIconWrapper && safetyTitle && safetyDesc) {
      let isRed = cWindSpeed > 12 || cThunderProb > 50;
      let isYellow = (!isRed) && (cWindSpeed >= 10 || cThunderProb >= 20 || cWindGust > 15);
      
      if (isRed) {
        // Red warning (danger!)
        safetyCard.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        safetyCard.style.background = 'rgba(239, 68, 68, 0.05)';
        safetyIcon.className = 'fa-solid fa-triangle-exclamation';
        safetyIconWrapper.style.background = 'rgba(239, 68, 68, 0.15)';
        safetyIconWrapper.style.color = '#ef4444';
        safetyTitle.textContent = '🚨 KRİTİK GÜVENLİK UYARISI';
        safetyTitle.style.color = '#ef4444';
        
        let reasons = [];
        if (cWindSpeed > 12) reasons.push(`rüzgar hızı limitin üzerinde (${cWindSpeed.toFixed(1)} m/s)`);
        if (cThunderProb > 50) reasons.push(`yüksek yıldırım riski var (%${cThunderProb})`);
        
        safetyDesc.textContent = `Saha genelinde ${reasons.join(' ve ')} bulunuyor. Kule içi ve kule üstü tüm servis çalışmaları acilen DURDURULMALIDIR!`;
      } else if (isYellow) {
        // Yellow warning (caution)
        safetyCard.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        safetyCard.style.background = 'rgba(245, 158, 11, 0.05)';
        safetyIcon.className = 'fa-solid fa-circle-exclamation';
        safetyIconWrapper.style.background = 'rgba(245, 158, 11, 0.15)';
        safetyIconWrapper.style.color = '#f59e0b';
        safetyTitle.textContent = '⚠️ DİKKAT: SAHA KOŞULLARI';
        safetyTitle.style.color = '#f59e0b';
        
        let warnings = [];
        if (cWindSpeed >= 10) warnings.push(`rüzgar hızı limit sınıra yakın (${cWindSpeed.toFixed(1)} m/s)`);
        if (cThunderProb >= 20) warnings.push(`yıldırım ihtimali bulunuyor (%${cThunderProb})`);
        if (cWindGust > 15) warnings.push(`rüzgar hamlesi yüksek (${cWindGust.toFixed(1)} m/s)`);
        
        safetyDesc.textContent = `Sahada ${warnings.join(', ')} tespit edildi. Çalışma esnasında güvenlik kurallarına ve tırmanma limitlerine maksimum dikkat gösterilmelidir.`;
      } else {
        // Green status (safe)
        safetyCard.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        safetyCard.style.background = 'rgba(16, 185, 129, 0.03)';
        safetyIcon.className = 'fa-solid fa-circle-check';
        safetyIconWrapper.style.background = 'rgba(16, 185, 129, 0.1)';
        safetyIconWrapper.style.color = '#10b981';
        safetyTitle.textContent = '✅ SAHA ÇALIŞMAYA GÜVENLİ';
        safetyTitle.style.color = '#10b981';
        safetyDesc.textContent = `Saha koşulları çalışmaya uygundur. Rüzgar hızı (${cWindSpeed.toFixed(1)} m/s) tırmanma sınırının altında ve yıldırım riski bulunmamaktadır.`;
      }
    }

    if (safetyUpdated) {
      const nowStr = localNow.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
      safetyUpdated.textContent = `Son Güncelleme: Bugün ${nowStr} (Koordinat: ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E)`;
    }

    // 3. Render 7-Day Forecast Grid
    const forecastGrid = document.getElementById('forecast-grid');
    if (forecastGrid) {
      let gridHtml = '';
      const weekdays = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      
      for (let i = 0; i < 7; i++) {
        const dateObj = new Date(data.daily.time[i]);
        const dayLabel = weekdays[dateObj.getDay()];
        const dateStr = dateObj.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' });
        
        const wCode = data.daily.weathercode[i];
        const wDetails = getWeatherDetails(wCode);
        const tMax = Math.round(data.daily.temperature_2m_max[i]);
        const tMin = Math.round(data.daily.temperature_2m_min[i]);
        const maxWind = data.daily.windspeed_10m_max[i];
        const maxGust = data.daily.windgusts_10m_max[i];
        
        // Calculate max daily thunderstorm probability from hourly segments
        const dayHourlyThunder = data.hourly.thunderstorm_probability.slice(i * 24, (i + 1) * 24);
        const maxThunderProb = Math.max(...dayHourlyThunder) || 0;
        
        // Determine borders/color depending on wind speed
        let windColor = '#10b981'; // Green
        if (maxWind > 12 || maxThunderProb > 50) {
          windColor = '#ef4444'; // Red
        } else if (maxWind >= 10 || maxThunderProb >= 20 || maxGust > 15) {
          windColor = '#f59e0b'; // Yellow
        }

        gridHtml += `
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-top: 3px solid ${windColor}; border-radius: 8px; padding: 10px; display: flex; flex-direction: column; align-items: center; text-align: center; gap: 8px;">
            <div style="font-weight: 800; font-size: 0.75rem; color: #fff; font-family: 'Rajdhani', sans-serif;">${dayLabel}</div>
            <div style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${dateStr}</div>
            
            <div style="font-size: 1.6rem; margin: 4px 0; text-shadow: 0 0 10px ${wDetails.color}33;">
              <i class="fa-solid ${wDetails.icon}" style="color: ${wDetails.color};"></i>
            </div>
            
            <div style="font-size: 0.65rem; font-weight: 700; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;" title="${wDetails.desc}">
              ${wDetails.desc}
            </div>

            <div style="font-size: 0.75rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif;">
              ${tMax}° / <span style="color: var(--text-muted); font-weight: 500;">${tMin}°</span>
            </div>

            <div style="width: 100%; border-top: 1px solid rgba(255,255,255,0.03); padding-top: 6px; display: flex; flex-direction: column; gap: 3px; font-size: 0.62rem; color: var(--text-muted); font-family: monospace; text-align: left;">
              <div style="display: flex; justify-content: space-between;">
                <span>Rüzgar:</span>
                <span style="font-weight: 700; color: ${maxWind > 12 ? '#ef4444' : '#fff'};">${maxWind.toFixed(1)} m/s</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Hamle:</span>
                <span style="font-weight: 700; color: ${maxGust > 15 ? '#f59e0b' : '#fff'};">${maxGust.toFixed(1)} m/s</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span>Yıldırım:</span>
                <span style="font-weight: 700; color: ${maxThunderProb > 40 ? '#ef4444' : '#fff'};">%${maxThunderProb}</span>
              </div>
            </div>
          </div>
        `;
      }
      forecastGrid.innerHTML = gridHtml;
    }

    // 4. Render charts
    (window as any).renderWeatherChartsOnly();

    // Show dashboard
    loading.style.display = 'none';
    dashboard.style.display = 'flex';

  } catch (err) {
    console.error("Hava durumu verileri yüklenirken hata:", err);
    loading.innerHTML = `
      <i class="fa-solid fa-circle-exclamation" style="font-size: 2.5rem; color: #ef4444; margin-bottom: 1.2rem;"></i>
      <span style="font-weight: 700; color: #ef4444; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">HATA: HAVA TAHMİN VERİLERİ ÇEKİLEMEDİ!</span>
      <p style="color: var(--text-muted); font-size: 0.8rem; margin-top: 5px;">Bağlantınızı kontrol edip lütfen tekrar deneyin. (${err})</p>
      <button onclick="window.initWeatherForecastPage()" class="btn-cyber-mini" style="margin-top: 15px; font-size: 0.7rem;">YENİDEN DENE</button>
    `;
  }
};
