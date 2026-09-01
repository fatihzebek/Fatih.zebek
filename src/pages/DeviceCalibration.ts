import { deviceCalibrationService } from '../services/DeviceCalibrationService';
import type { CalibrationDevice, CalibrationHistoryLog } from '../services/DeviceCalibrationService';
import { dataService } from '../services/DataService';
import { authService } from '../services/AuthService';
import { qrService } from '../services/QRService';
import * as XLSX from 'xlsx';

// Function to calculate countdown and remaining days based on next calibration date
export function getCalibrationDaysInfo(nextCalibrationDateStr: string) {
  if (!nextCalibrationDateStr) return { expired: true, text: 'Girilmedi', class: 'lifespan-critical', daysRemaining: 0 };
  
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const nextCal = new Date(nextCalibrationDateStr);
    nextCal.setHours(0, 0, 0, 0);
    
    const diffTime = nextCal.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { 
        expired: true, 
        text: `SÜRESİ GEÇTİ (${Math.abs(diffDays)} Gün Gecikti)`, 
        class: 'lifespan-critical', 
        daysRemaining: diffDays 
      };
    } else if (diffDays === 0) {
      return { 
        expired: true, 
        text: `BUGÜN SON GÜN`, 
        class: 'lifespan-critical', 
        daysRemaining: 0 
      };
    } else if (diffDays <= 30) {
      return { 
        expired: false, 
        text: `${diffDays} Gün Kaldı (Kritik)`, 
        class: 'lifespan-warning', 
        daysRemaining: diffDays 
      };
    } else {
      return { 
        expired: false, 
        text: `${diffDays} Gün Kaldı`, 
        class: 'lifespan-ok', 
        daysRemaining: diffDays 
      };
    }
  } catch (e) {
    return { expired: true, text: 'Tarih Hatası', class: 'lifespan-critical', daysRemaining: 0 };
  }
}

// Open PDF base64 helper
(window as any).openPdfBase64 = (base64Url: string, fileName: string) => {
  if (!base64Url) {
    alert('Rapor bulunamadı.');
    return;
  }
  try {
    const arr = base64Url.split(',');
    const mime = arr[0].match(/:(.*?);/)?.[1] || 'application/pdf';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    const blob = new Blob([u8arr], { type: mime });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.download = fileName || 'calibration_certificate.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (err) {
    console.error(err);
    alert('PDF açılırken bir hata oluştu: ' + (err as Error).message);
  }
};

export const DeviceCalibrationPage = async (type: 'OLCU' | 'TORK') => {
  const isOlcu = type === 'OLCU';
  const pageTitle = isOlcu ? 'ÖLÇÜ ALETLERİ KALİBRASYON TAKİBİ' : 'TORK ALETLERİ KALİBRASYON TAKİBİ';
  const pageIcon = isOlcu ? 'fa-gauge' : 'fa-wrench';
  const colorTheme = isOlcu ? 'var(--accent-cyan)' : '#fbbf24';

  const sites = dataService.getSites();

  return `
    <style>
      .cal-container {
        padding: 1.5rem 2rem;
        max-width: 1750px;
        margin: 0 auto;
        padding-bottom: 120px;
      }
      .cal-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1.5rem;
        margin-bottom: 2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 1.2rem;
      }
      .cal-title-group h1 {
        font-size: 1.8rem;
        font-weight: 800;
        color: var(--text-main);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 2px;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .cal-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
        gap: 0.75rem;
        margin-bottom: 1.25rem;
      }
      .cal-stat-card {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 8px;
        padding: 0.6rem 1rem;
        display: flex;
        flex-direction: column;
        justify-content: center;
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
        min-height: 70px;
      }
      .cal-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.1);
      }
      .cal-stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 3px;
        height: 100%;
      }
      .cal-stat-card.total::before { background: ${colorTheme}; }
      .cal-stat-card.ok::before { background: var(--accent-green); }
      .cal-stat-card.warning::before { background: var(--accent-amber); }
      .cal-stat-card.overdue::before { background: var(--accent-red); }
      .cal-stat-card.reject::before { background: #dc2626; }

      .cal-stat-value {
        font-size: 1.5rem;
        font-weight: 900;
        margin-bottom: 0.1rem;
        line-height: 1.1;
      }
      .cal-stat-label {
        font-size: 0.65rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      
      .site-pills-container {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        margin-bottom: 1.5rem;
        padding: 0.5rem;
        background: rgba(15, 23, 42, 0.2);
        border-radius: 30px;
        border: 1px solid rgba(255, 255, 255, 0.02);
      }
      .site-pill {
        background: transparent;
        border: 1px solid transparent;
        color: rgba(255, 255, 255, 0.6);
        padding: 6px 16px;
        border-radius: 30px;
        font-size: 0.8rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.25s ease;
      }
      .site-pill:hover {
        background: rgba(255, 255, 255, 0.03);
        color: white;
      }
      .site-pill.active {
        background: rgba(255, 255, 255, 0.08);
        border-color: ${colorTheme};
        color: ${colorTheme};
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.05);
      }

      .cal-actions-bar {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }
      .cal-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        flex: 1;
      }
      .cal-filter-input, .cal-filter-select {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        min-width: 160px;
        transition: border-color 0.2s;
      }
      .cal-filter-input:focus, .cal-filter-select:focus {
        outline: none;
        border-color: ${colorTheme};
      }
      
      .cal-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        padding: 0.5rem 1.2rem;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 8px;
        transition: all 0.2s;
      }
      .cal-btn:hover {
        background: rgba(255, 255, 255, 0.1);
        border-color: rgba(255, 255, 255, 0.2);
      }
      .cal-btn-primary {
        background: ${colorTheme};
        border-color: transparent;
        color: #0f172a;
      }
      .cal-btn-primary:hover {
        background: white;
        color: #0f172a;
        box-shadow: 0 0 15px rgba(255,255,255,0.2);
      }
      .cal-btn-outline {
        border-color: rgba(255, 255, 255, 0.15);
        background: transparent;
      }
      
      .cal-table-wrapper {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        overflow-x: auto;
        margin-bottom: 2rem;
      }
      .cal-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.85rem;
      }
      .cal-table th {
        background: rgba(15, 23, 42, 0.8);
        padding: 1rem 1.25rem;
        color: var(--text-muted);
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .cal-table td {
        padding: 1rem 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        vertical-align: middle;
      }
      .cal-table tr:hover td {
        background: rgba(255, 255, 255, 0.01);
      }
      .cal-table tr.highlighted td {
        background: rgba(0, 243, 255, 0.04) !important;
        border-bottom: 1px solid rgba(0, 243, 255, 0.2);
        border-top: 1px solid rgba(0, 243, 255, 0.2);
      }
      
      .lifespan-ok { color: var(--accent-green); font-weight: 700; }
      .lifespan-warning { color: var(--accent-amber); font-weight: 700; }
      .lifespan-critical { color: var(--accent-red); font-weight: 700; }

      .cal-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        z-index: 20000;
        display: none;
        align-items: center;
        justify-content: center;
      }
      .cal-modal.active {
        display: flex;
      }
      .cal-modal-content {
        background: #0f172a;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        width: 100%;
        max-width: 550px;
        max-height: 90vh;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      }
      .cal-modal-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .cal-modal-title {
        font-size: 1.1rem;
        font-weight: 800;
        color: white;
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .cal-modal-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 1.5rem;
        cursor: pointer;
      }
      .cal-modal-close:hover {
        color: white;
      }
      .cal-modal-body {
        padding: 1.5rem;
        flex: 1;
      }
      .cal-modal-footer {
        padding: 1.25rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
        display: flex;
        justify-content: flex-end;
        gap: 0.75rem;
        background: rgba(0, 0, 0, 0.2);
      }
      
      .cal-form-group {
        margin-bottom: 1.25rem;
      }
      .cal-form-group label {
        display: block;
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-bottom: 0.4rem;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .cal-form-group input, .cal-form-group select, .cal-form-group textarea {
        width: 100%;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        padding: 0.6rem 0.8rem;
        font-size: 0.85rem;
        transition: all 0.2s;
      }
      .cal-form-group input:focus, .cal-form-group select:focus, .cal-form-group textarea:focus {
        outline: none;
        border-color: ${colorTheme};
        background: rgba(0, 0, 0, 0.5);
      }
    </style>

    <div class="cal-container">
      
      <!-- Top Title Bar -->
      <div class="cal-header">
        <div class="cal-title-group">
          <h1><i class="fa-solid ${pageIcon}" style="color: ${colorTheme};"></i> ${pageTitle}</h1>
        </div>
        <div style="display: flex; gap: 8px;">
          <button class="cal-btn cal-btn-outline" onclick="window.scanDeviceQR()" title="QR / Barkod Tara">
            <i class="fa-solid fa-qrcode" style="color: var(--accent-green);"></i> QR / Barkod Tara
          </button>
          <button class="cal-btn cal-btn-outline" onclick="window.printBulkDeviceQR()" title="Toplu Barkod Yazdır">
            <i class="fa-solid fa-print" style="color: var(--accent-cyan);"></i> Toplu Barkod Yazdır
          </button>
          <button class="cal-btn cal-btn-outline" onclick="window.downloadCalibrationTemplate()" title="Excel Şablonu İndir">
            <i class="fa-solid fa-download" style="color: var(--accent-cyan);"></i> Şablon İndir
          </button>
          <button class="cal-btn cal-btn-outline" onclick="document.getElementById('cal-excel-import-file').click()" title="Excel'den Cihaz Yükle">
            <i class="fa-solid fa-upload" style="color: #a855f7;"></i> Excel'den Yükle
          </button>
          <input type="file" id="cal-excel-import-file" style="display: none;" accept=".xlsx, .xls" onchange="window.importCalibrationFromExcel(event)">
          
          <button class="cal-btn cal-btn-primary" onclick="window.openAddDeviceModal()">
            <i class="fa-solid fa-plus"></i> Yeni Cihaz Kaydı Ekle
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="cal-stats">
        <div class="cal-stat-card total" onclick="window.filterCalibrationByCard('total')" title="Tümünü Filtrele">
          <div id="cal-stat-total" class="cal-stat-value" style="color: ${colorTheme};">0</div>
          <div class="cal-stat-label">Toplam Cihaz</div>
        </div>
        <div class="cal-stat-card ok" onclick="window.filterCalibrationByCard('ok')" title="Kalibrasyonu Uygun Olanlar">
          <div id="cal-stat-ok" class="cal-stat-value" style="color: var(--accent-green);">0</div>
          <div class="cal-stat-label">Uygun (OK)</div>
        </div>
        <div class="cal-stat-card warning" onclick="window.filterCalibrationByCard('warning')" title="Kalibrasyonu 30 Gün Altında Kalanlar">
          <div id="cal-stat-warning" class="cal-stat-value" style="color: var(--accent-amber);">0</div>
          <div class="cal-stat-label">Kritik (&lt;30 Gün)</div>
        </div>
        <div class="cal-stat-card overdue" onclick="window.filterCalibrationByCard('overdue')" title="Kalibrasyon Süresi Dolanlar">
          <div id="cal-stat-overdue" class="cal-stat-value" style="color: var(--accent-red);">0</div>
          <div class="cal-stat-label">Süresi Dolan</div>
        </div>
        <div class="cal-stat-card reject" onclick="window.filterCalibrationByCard('reject')" title="Kalibrasyon Sonucu Uygun Olmayanlar">
          <div id="cal-stat-reject" class="cal-stat-value" style="color: #dc2626;">0</div>
          <div class="cal-stat-label">Uygun Değil (RED)</div>
        </div>
      </div>

      <!-- Sahalar Filter (Sub-tabs) -->
      <div class="site-pills-container">
        <button class="site-pill active" data-site="ALL" onclick="window.selectCalibrationSite('ALL')">HEPSİ</button>
        ${sites.map(s => `
          <button class="site-pill" data-site="${s.id}" onclick="window.selectCalibrationSite('${s.id}')">${s.name}</button>
        `).join('')}
      </div>

      <!-- Search & Filters -->
      <div class="cal-actions-bar">
        <div class="cal-filters">
          <input type="text" id="cal-search-input" class="cal-filter-input" placeholder="Seri No, Zimmetli Kişi, Marka/Model ara..." oninput="window.filterCalibrationTable()" style="flex: 1; min-width: 250px;">
          
          <select id="cal-status-filter" class="cal-filter-select" onchange="window.filterCalibrationTable()">
            <option value="ALL">Tüm Durumlar</option>
            <option value="OK">Uygun (OK)</option>
            <option value="REJECT">Uygun Değil (RED)</option>
          </select>
          
          <select id="cal-time-filter" class="cal-filter-select" onchange="window.filterCalibrationTable()">
            <option value="ALL">Tüm Süreler</option>
            <option value="OVERDUE">Kalibrasyonu Dolanlar</option>
            <option value="COMING">Kalibrasyonu Yaklaşanlar (&lt; 30 Gün)</option>
            <option value="OK_TIME">Kalibrasyonu Geçerli</option>
          </select>
        </div>
      </div>

      <!-- Data Table -->
      <div class="cal-table-wrapper">
        <table class="cal-table" id="cal-main-table">
          <thead>
            <tr>
              <th>Zimmetli Kişi</th>
              <th>Saha</th>
              <th>Marka / Model</th>
              <th>Seri Numarası</th>
              <th>Kalibrasyon Firması</th>
              <th>Kalibrasyon Tarihi</th>
              <th>Gelecek Kalibrasyon</th>
              <th>Durum / Kalan Süre</th>
              <th style="text-align: center;">Sertifika (PDF)</th>
              <th style="text-align: right;">İşlemler</th>
            </tr>
          </thead>
          <tbody id="cal-table-body">
            <tr>
              <td colspan="10" style="text-align: center; padding: 3rem; color: var(--accent-cyan);">
                <i class="fa-solid fa-spinner fa-spin" style="margin-right: 8px;"></i> Veriler yükleniyor...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

    </div>

    <!-- MODAL 1: ADD/EDIT DEVICE -->
    <div id="modal-cal-device" class="cal-modal">
      <div class="cal-modal-content">
        <div class="cal-modal-header">
          <h3 class="cal-modal-title" id="cal-device-modal-title">Yeni Cihaz Kaydı Ekle</h3>
          <button class="cal-modal-close" onclick="window.closeCalibrationModal('modal-cal-device')">&times;</button>
        </div>
        <div class="cal-modal-body">
          <input type="hidden" id="device-id-field">
          
          <div class="cal-form-group">
            <label>Marka / Model *</label>
            <input type="text" id="device-brand-model" placeholder="Örn: Fluke 179 veya Norbar TTi300" required>
          </div>
          
          <div class="cal-form-group">
            <label>Seri Numarası *</label>
            <input type="text" id="device-serial-number" placeholder="Örn: SN-938210" required>
          </div>
          
          <div class="cal-form-group">
            <label>Zimmetli Personel / Ekip</label>
            <input type="text" id="device-assigned-person" placeholder="Örn: Ahmet Yılmaz veya Alize Ekibi">
          </div>
          
          <div class="cal-form-group">
            <label>Bulunduğu Saha / Lokasyon *</label>
            <select id="device-site-id" required>
              <option value="" disabled selected>Saha Seçiniz</option>
              ${sites.map(s => `<option value="${s.id}">${s.name}</option>`).join('')}
            </select>
          </div>
          
          <div class="cal-form-group">
            <label>Kalibrasyon Firması</label>
            <input type="text" id="device-calibration-company" placeholder="Örn: Kal-Met Kalibrasyon">
          </div>
          
          <div class="cal-form-group">
            <label>Kalibrasyon Tarihi</label>
            <input type="date" id="device-calibration-date">
          </div>
          
          <div class="cal-form-group">
            <label>Kalibrasyon Durumu</label>
            <select id="device-status">
              <option value="OK">UYGUN (OK)</option>
              <option value="REJECT">UYGUN DEĞİL (RED)</option>
            </select>
          </div>
          
          <div class="cal-form-group">
            <label>Sertifika / Rapor (PDF)</label>
            <input type="file" id="device-pdf-input" accept="application/pdf" onchange="window.handleCertificateUpload(event)">
            <div id="device-pdf-status-text" style="font-size: 0.75rem; color: ${colorTheme}; margin-top: 5px;"></div>
          </div>
          
          <div class="cal-form-group">
            <label>Cihaz Resmi (Görsel)</label>
            <input type="file" id="device-image-input" accept="image/*" onchange="window.handleDeviceImageUpload(event)">
            <div id="device-image-preview-container" style="margin-top: 10px; display: none; position: relative; width: 100px; height: 100px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.2);">
              <img id="device-image-preview" style="width: 100%; height: 100%; object-fit: cover;">
              <button onclick="window.removeDeviceImage()" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); color: white; border: none; border-radius: 50%; width: 22px; height: 22px; font-size: 12px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold; line-height: 1;">&times;</button>
            </div>
          </div>
          
          <div class="cal-form-group">
            <label>Açıklama / Notlar</label>
            <textarea id="device-notes" rows="2" placeholder="Cihaz veya kalibrasyon ile ilgili notlar..."></textarea>
          </div>
        </div>
        <div class="cal-modal-footer">
          <button class="cal-btn cal-btn-outline" onclick="window.closeCalibrationModal('modal-cal-device')">Vazgeç</button>
          <button class="cal-btn cal-btn-primary" onclick="window.saveDevice()">Kaydet</button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: PERFORM CALIBRATION / RENEW -->
    <div id="modal-cal-renew" class="cal-modal">
      <div class="cal-modal-content">
        <div class="cal-modal-header">
          <h3 class="cal-modal-title">Kalibrasyon Yenileme Kaydı</h3>
          <button class="cal-modal-close" onclick="window.closeCalibrationModal('modal-cal-renew')">&times;</button>
        </div>
        <div class="cal-modal-body">
          <input type="hidden" id="renew-device-id">
          
          <div style="background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.05);">
            <div><strong>Cihaz:</strong> <span id="renew-device-info">Fluke 179 (SN-938210)</span></div>
          </div>

          <div class="cal-form-group">
            <label>Yeni Kalibrasyon Tarihi *</label>
            <input type="date" id="renew-calibration-date" required>
          </div>

          <div class="cal-form-group">
            <label>Kalibrasyon Firması *</label>
            <input type="text" id="renew-calibration-company" placeholder="Örn: Kal-Met Kalibrasyon" required>
          </div>

          <div class="cal-form-group">
            <label>Kalibrasyon Durumu *</label>
            <select id="renew-status" required>
              <option value="OK">UYGUN (OK)</option>
              <option value="REJECT">UYGUN DEĞİL (RED)</option>
            </select>
          </div>

          <div class="cal-form-group">
            <label>Yeni Sertifika / Rapor (PDF)</label>
            <input type="file" id="renew-pdf-input" accept="application/pdf" onchange="window.handleCertificateUpload(event, true)">
            <div id="renew-pdf-status-text" style="font-size: 0.75rem; color: ${colorTheme}; margin-top: 5px;"></div>
          </div>

          <div class="cal-form-group">
            <label>Açıklama / Notlar</label>
            <textarea id="renew-notes" rows="2" placeholder="Tarih uzatma, bulgular veya yeni sertifika detayları..."></textarea>
          </div>
        </div>
        <div class="cal-modal-footer">
          <button class="cal-btn cal-btn-outline" onclick="window.closeCalibrationModal('modal-cal-renew')">Vazgeç</button>
          <button class="cal-btn cal-btn-primary" onclick="window.saveCalibrationLog()">Kalibrasyonu Yenile</button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: VIEW CALIBRATION HISTORY -->
    <div id="modal-cal-history" class="cal-modal">
      <div class="cal-modal-content" style="max-width: 600px;">
        <div class="cal-modal-header">
          <h3 class="cal-modal-title"><i class="fa-solid fa-clock-rotate-left"></i> Kalibrasyon Geçmişi</h3>
          <button class="cal-modal-close" onclick="window.closeCalibrationModal('modal-cal-history')">&times;</button>
        </div>
        <div class="cal-modal-body">
          <div style="background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: 8px; margin-bottom: 1.25rem; font-size: 0.8rem; border: 1px solid rgba(255,255,255,0.05);">
            <div><strong>Cihaz:</strong> <span id="history-device-info">Fluke 179 (SN-938210)</span></div>
          </div>
          
          <div id="history-logs-container" style="max-height: 400px; overflow-y: auto;">
            <!-- Render history logs here -->
          </div>
        </div>
        <div class="cal-modal-footer">
          <button class="cal-btn cal-btn-outline" onclick="window.closeCalibrationModal('modal-cal-history')">Kapat</button>
        </div>
      </div>
    </div>

    <!-- MODAL 4: DETAILED VIEW (SCAN RESULT) -->
    <div id="modal-cal-device-detail" class="cal-modal">
      <div class="cal-modal-content" style="max-width: 500px; background: rgba(10, 20, 38, 0.95); border: 1px solid rgba(0, 243, 255, 0.25); box-shadow: 0 0 25px rgba(0, 243, 255, 0.15);">
        <div class="cal-modal-header" style="border-bottom: 1px solid rgba(0, 243, 255, 0.15);">
          <h3 class="cal-modal-title" style="color: var(--accent-cyan); display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-gauge-high"></i> Cihaz Detay Kartı
          </h3>
          <button class="cal-modal-close" onclick="window.closeCalibrationModal('modal-cal-device-detail')">&times;</button>
        </div>
        <div class="cal-modal-body" id="device-detail-modal-body" style="padding-top: 15px;">
          <!-- Dynamically populated details will go here -->
        </div>
        <div class="cal-modal-footer" style="border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; gap: 8px;">
            <button class="cal-btn" id="detail-btn-renew" style="color: var(--accent-green); border-color: rgba(20, 241, 149, 0.2); padding: 6px 12px; font-size: 0.75rem;" title="Kalibrasyonu Yenile">
              <i class="fa-solid fa-arrows-rotate"></i> Yenile
            </button>
            <button class="cal-btn" id="detail-btn-edit" style="color: var(--text-main); border-color: rgba(255, 255, 255, 0.1); padding: 6px 12px; font-size: 0.75rem;" title="Düzenle">
              <i class="fa-solid fa-pen"></i> Düzenle
            </button>
          </div>
          <button class="cal-btn cal-btn-outline" onclick="window.closeCalibrationModal('modal-cal-device-detail')">Kapat</button>
        </div>
      </div>
    </div>
  `;
};

// Global variables for page state
let calibrationDevicesList: CalibrationDevice[] = [];
let filteredDevicesList: CalibrationDevice[] = [];
let unsubscribeDevices: any = null;
let currentDeviceType: 'OLCU' | 'TORK' = 'OLCU';
let activeSiteFilter: string = 'ALL';
let activeStatFilter: string = 'ALL';

// Temporal file upload cache
let uploadedCertificateBase64 = '';
let uploadedCertificateName = '';
let uploadedDeviceImageBase64 = '';

(window as any).initDeviceCalibrationPage = (type: 'OLCU' | 'TORK') => {
  currentDeviceType = type;
  activeSiteFilter = 'ALL';
  activeStatFilter = 'ALL';
  
  // Set default values for modal dates to today
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('device-calibration-date') as HTMLInputElement;
  if (dateInput) dateInput.value = todayStr;
  
  const renewDateInput = document.getElementById('renew-calibration-date') as HTMLInputElement;
  if (renewDateInput) renewDateInput.value = todayStr;

  // Clear file uploads cache
  uploadedCertificateBase64 = '';
  uploadedCertificateName = '';
  uploadedDeviceImageBase64 = '';
  
  const tableBody = document.getElementById('cal-table-body');
  if (!tableBody) return;

  // Unsubscribe previous observer if active
  if (unsubscribeDevices) {
    unsubscribeDevices();
    unsubscribeDevices = null;
  }

  // Subscribe to live Firestore device inventory updates
  unsubscribeDevices = deviceCalibrationService.subscribeDevices(type, (devices) => {
    calibrationDevicesList = devices;
    (window as any).filterCalibrationTable();
    (window as any).updateCalibrationStats();
  });
};

// Update Statistics Display
(window as any).updateCalibrationStats = () => {
  if (!calibrationDevicesList) return;

  const todayStr = new Date().toISOString().split('T')[0];
  
  const total = calibrationDevicesList.length;
  const ok = calibrationDevicesList.filter(d => d.status === 'OK' && d.nextCalibrationDate > todayStr && getCalibrationDaysInfo(d.nextCalibrationDate).daysRemaining > 30).length;
  const warning = calibrationDevicesList.filter(d => d.status === 'OK' && d.nextCalibrationDate > todayStr && getCalibrationDaysInfo(d.nextCalibrationDate).daysRemaining <= 30).length;
  const overdue = calibrationDevicesList.filter(d => d.nextCalibrationDate <= todayStr).length;
  const reject = calibrationDevicesList.filter(d => d.status === 'REJECT').length;

  const setVal = (id: string, val: number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  setVal('cal-stat-total', total);
  setVal('cal-stat-ok', ok);
  setVal('cal-stat-warning', warning);
  setVal('cal-stat-overdue', overdue);
  setVal('cal-stat-reject', reject);
};

// Handle site pill selection
(window as any).selectCalibrationSite = (siteId: string) => {
  activeSiteFilter = siteId;
  
  // Highlight active pill
  document.querySelectorAll('.site-pill').forEach((pill: any) => {
    if (pill.dataset.site === siteId) {
      pill.classList.add('active');
    } else {
      pill.classList.remove('active');
    }
  });

  (window as any).filterCalibrationTable();
};

// Filter based on statistic card click
(window as any).filterCalibrationByCard = (cardType: string) => {
  if (activeStatFilter === cardType) {
    activeStatFilter = 'ALL'; // toggle off
    document.querySelectorAll('.cal-stat-card').forEach(c => (c as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.05)');
  } else {
    activeStatFilter = cardType;
    document.querySelectorAll('.cal-stat-card').forEach(c => (c as HTMLElement).style.borderColor = 'rgba(255, 255, 255, 0.05)');
    const cardEl = document.querySelector(`.cal-stat-card.${cardType}`) as HTMLElement;
    if (cardEl) {
      const isOlcu = currentDeviceType === 'OLCU';
      cardEl.style.borderColor = cardType === 'total' ? (isOlcu ? 'var(--accent-cyan)' : '#fbbf24') : 
                                cardType === 'ok' ? 'var(--accent-green)' : 
                                cardType === 'warning' ? 'var(--accent-amber)' : 
                                cardType === 'overdue' ? 'var(--accent-red)' : '#dc2626';
    }
  }
  (window as any).filterCalibrationTable();
};

// Filter and Render Table Rows
(window as any).filterCalibrationTable = (highlightedId?: string) => {
  const tableBody = document.getElementById('cal-table-body');
  if (!tableBody) return;

  const searchVal = (document.getElementById('cal-search-input') as HTMLInputElement)?.value.toLowerCase().trim() || '';
  const statusFilter = (document.getElementById('cal-status-filter') as HTMLSelectElement)?.value || 'ALL';
  const timeFilter = (document.getElementById('cal-time-filter') as HTMLSelectElement)?.value || 'ALL';
  const todayStr = new Date().toISOString().split('T')[0];

  let filtered = [...calibrationDevicesList];

  // 1. Filter by site sub-tab
  if (activeSiteFilter !== 'ALL') {
    filtered = filtered.filter(d => d.siteId === activeSiteFilter);
  }

  // 2. Filter by search text
  if (searchVal) {
    filtered = filtered.filter(d => 
      (d.serialNumber || '').toLowerCase().includes(searchVal) ||
      (d.brandModel || '').toLowerCase().includes(searchVal) ||
      (d.assignedPerson || '').toLowerCase().includes(searchVal) ||
      (d.calibrationCompany || '').toLowerCase().includes(searchVal)
    );
  }

  // 3. Filter by dropdown status
  if (statusFilter !== 'ALL') {
    filtered = filtered.filter(d => d.status === statusFilter);
  }

  // 4. Filter by dropdown time status
  if (timeFilter !== 'ALL') {
    filtered = filtered.filter(d => {
      const daysInfo = getCalibrationDaysInfo(d.nextCalibrationDate);
      if (timeFilter === 'OVERDUE') return d.nextCalibrationDate <= todayStr;
      if (timeFilter === 'COMING') return d.nextCalibrationDate > todayStr && daysInfo.daysRemaining <= 30;
      if (timeFilter === 'OK_TIME') return d.status === 'OK' && d.nextCalibrationDate > todayStr && daysInfo.daysRemaining > 30;
      return true;
    });
  }

  // 5. Filter by stat card click
  if (activeStatFilter !== 'ALL') {
    filtered = filtered.filter(d => {
      const daysInfo = getCalibrationDaysInfo(d.nextCalibrationDate);
      if (activeStatFilter === 'total') return true;
      if (activeStatFilter === 'ok') return d.status === 'OK' && d.nextCalibrationDate > todayStr && daysInfo.daysRemaining > 30;
      if (activeStatFilter === 'warning') return d.status === 'OK' && d.nextCalibrationDate > todayStr && daysInfo.daysRemaining <= 30;
      if (activeStatFilter === 'overdue') return d.nextCalibrationDate <= todayStr;
      if (activeStatFilter === 'reject') return d.status === 'REJECT';
      return true;
    });
  }

  filteredDevicesList = filtered;

  if (filtered.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="10" style="text-align: center; padding: 3rem; color: rgba(255,255,255,0.4); font-style: italic;">
          Kayıtlı kalibrasyon cihazı bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filtered.map(d => {
    const isHighlighted = highlightedId && d.id === highlightedId;
    const daysInfo = getCalibrationDaysInfo(d.nextCalibrationDate);
    const dateFormatted = d.calibrationDate ? new Date(d.calibrationDate).toLocaleDateString('tr-TR') : '-';
    const nextFormatted = d.nextCalibrationDate ? new Date(d.nextCalibrationDate).toLocaleDateString('tr-TR') : '-';

    const statusBadge = d.status === 'REJECT' ? `
      <span style="background: rgba(220, 38, 38, 0.15); color: #ef4444; border: 1px solid rgba(220, 38, 38, 0.3); padding: 4px 10px; border-radius: 30px; font-weight: 800; font-size: 0.7rem; text-transform: uppercase;">UYGUN DEĞİL (RED)</span>
    ` : `
      <span class="${daysInfo.class}">${daysInfo.text}</span>
    `;

    const docLink = d.certificateUrl ? `
      <button onclick="window.openPdfBase64('${d.certificateUrl.replace(/'/g, "\\'")}', '${(d.certificateName || 'sertifika.pdf').replace(/'/g, "\\'")}')" class="cal-btn cal-btn-outline" style="padding: 4px 10px; font-size: 0.7rem; color: var(--accent-cyan); border-color: rgba(0, 243, 255, 0.2); background: rgba(0, 243, 255, 0.02);">
        <i class="fa-solid fa-file-pdf"></i> Sertifika
      </button>
    ` : `
      <span style="opacity: 0.35; font-size: 0.75rem; font-style: italic;">Rapor Yok</span>
    `;

    return `
      <tr id="device-row-${d.id}" class="${isHighlighted ? 'highlighted' : ''}">
        <td style="font-weight: 700; color: white;">${d.assignedPerson || '-'}</td>
        <td style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${d.siteName || '-'}</td>
        <td style="font-weight: 500;">${d.brandModel || '-'}</td>
        <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${d.serialNumber || '-'}</td>
        <td>${d.calibrationCompany || '-'}</td>
        <td>${dateFormatted}</td>
        <td>${nextFormatted}</td>
        <td>${statusBadge}</td>
        <td style="text-align: center;">${docLink}</td>
        <td style="text-align: right;">
          <div style="display: inline-flex; gap: 6px;">
            <button onclick="window.openRenewCalibrationModal('${d.id}')" class="cal-btn" style="padding: 4px 8px; font-size: 0.7rem; color: var(--accent-green); border-color: rgba(20, 241, 149, 0.2);" title="Kalibrasyonu Yenile">
              <i class="fa-solid fa-arrows-rotate"></i> Yenile
            </button>
            <button onclick="window.openCalibrationHistoryModal('${d.id}')" class="cal-btn" style="padding: 4px 8px; font-size: 0.7rem;" title="Kalibrasyon Geçmişi">
              <i class="fa-solid fa-history"></i>
            </button>
            <button onclick="window.printDeviceQR('${d.id}')" class="cal-btn" style="padding: 4px 8px; font-size: 0.7rem; color: var(--accent-cyan); border-color: rgba(0, 243, 255, 0.2);" title="Barkod Yazdır">
              <i class="fa-solid fa-qrcode"></i>
            </button>
            <button onclick="window.openEditDeviceModal('${d.id}')" class="cal-btn" style="padding: 4px 8px; font-size: 0.7rem;" title="Düzenle">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button onclick="window.deleteDevice('${d.id}')" class="cal-btn" style="padding: 4px 8px; font-size: 0.7rem; color: var(--accent-red); border-color: rgba(255, 0, 85, 0.2);" title="Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (highlightedId) {
    const el = document.getElementById(`device-row-${highlightedId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

// Modal Operations
(window as any).closeCalibrationModal = (id: string) => {
  const el = document.getElementById(id);
  if (el) el.classList.remove('active');
  
  // Clear file caches when modal is closed
  uploadedCertificateBase64 = '';
  uploadedCertificateName = '';
  uploadedDeviceImageBase64 = '';
  
  const statusTxt = document.getElementById('device-pdf-status-text');
  if (statusTxt) statusTxt.textContent = '';
  const statusTxtRenew = document.getElementById('renew-pdf-status-text');
  if (statusTxtRenew) statusTxtRenew.textContent = '';
  
  const fileInput = document.getElementById('device-pdf-input') as HTMLInputElement;
  if (fileInput) fileInput.value = '';
  const fileInputRenew = document.getElementById('renew-pdf-input') as HTMLInputElement;
  if (fileInputRenew) fileInputRenew.value = '';

  const imageInput = document.getElementById('device-image-input') as HTMLInputElement;
  if (imageInput) imageInput.value = '';
  const previewContainer = document.getElementById('device-image-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const previewImg = document.getElementById('device-image-preview') as HTMLImageElement;
  if (previewImg) previewImg.src = '';
};

// PDF File Selection & Reading
(window as any).handleCertificateUpload = (event: Event, isRenew = false) => {
  const input = event.target as HTMLInputElement;
  const statusText = document.getElementById(isRenew ? 'renew-pdf-status-text' : 'device-pdf-status-text');
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    if (file.type !== 'application/pdf') {
      alert('Lütfen geçerli bir PDF dosyası seçiniz.');
      input.value = '';
      if (statusText) statusText.textContent = '';
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) { // 2MB Limit
      alert('Seçilen sertifika çok büyük (Maksimum limit 2MB).');
      input.value = '';
      if (statusText) statusText.textContent = '';
      return;
    }

    if (statusText) statusText.textContent = 'Dosya okunuyor...';

    const reader = new FileReader();
    reader.onload = () => {
      uploadedCertificateBase64 = reader.result as string;
      uploadedCertificateName = file.name;
      if (statusText) statusText.textContent = `✓ Yüklendi: ${file.name} (${Math.round(file.size / 1024)} KB)`;
    };
    reader.onerror = () => {
      alert('Dosya okunurken bir hata oluştu.');
      input.value = '';
      if (statusText) statusText.textContent = '';
    };
    reader.readAsDataURL(file);
  }
};

// Device Image Selection, Compression & Reading
(window as any).handleDeviceImageUpload = (event: Event) => {
  const input = event.target as HTMLInputElement;
  const previewContainer = document.getElementById('device-image-preview-container');
  const previewImg = document.getElementById('device-image-preview') as HTMLImageElement;
  
  if (input.files && input.files[0]) {
    const file = input.files[0];
    
    if (!file.type.startsWith('image/')) {
      alert('Lütfen geçerli bir görsel dosyası seçiniz.');
      input.value = '';
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // Limit raw file upload size to 5MB, canvas will resize it anyway
      alert('Seçilen görsel çok büyük (Maksimum limit 5MB).');
      input.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.src = reader.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 600;
        const MAX_HEIGHT = 600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          uploadedDeviceImageBase64 = canvas.toDataURL('image/jpeg', 0.7); // 70% quality jpeg
        } else {
          uploadedDeviceImageBase64 = reader.result as string;
        }

        if (previewImg) previewImg.src = uploadedDeviceImageBase64;
        if (previewContainer) previewContainer.style.display = 'block';
      };
    };
    reader.onerror = () => {
      alert('Görsel dosyası okunurken hata oluştu.');
      input.value = '';
    };
    reader.readAsDataURL(file);
  }
};

(window as any).removeDeviceImage = () => {
  uploadedDeviceImageBase64 = '';
  const input = document.getElementById('device-image-input') as HTMLInputElement;
  if (input) input.value = '';
  const previewContainer = document.getElementById('device-image-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const previewImg = document.getElementById('device-image-preview') as HTMLImageElement;
  if (previewImg) previewImg.src = '';
};

// Add New Device Modal
(window as any).openAddDeviceModal = () => {
  const titleEl = document.getElementById('cal-device-modal-title');
  if (titleEl) titleEl.textContent = 'Yeni Cihaz Kaydı Ekle';

  // Clear inputs
  document.querySelectorAll('#modal-cal-device input, #modal-cal-device select, #modal-cal-device textarea').forEach((el: any) => {
    if (el.id !== 'device-id-field') el.value = '';
  });

  const idField = document.getElementById('device-id-field') as HTMLInputElement;
  if (idField) idField.value = '';

  const statusSelect = document.getElementById('device-status') as HTMLSelectElement;
  if (statusSelect) statusSelect.value = 'OK';

  // Set default date to today
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('device-calibration-date') as HTMLInputElement;
  if (dateInput) dateInput.value = todayStr;

  // Clear file & image caches
  uploadedCertificateBase64 = '';
  uploadedCertificateName = '';
  uploadedDeviceImageBase64 = '';

  const statusText = document.getElementById('device-pdf-status-text');
  if (statusText) statusText.textContent = '';
  
  const previewContainer = document.getElementById('device-image-preview-container');
  if (previewContainer) previewContainer.style.display = 'none';
  const previewImg = document.getElementById('device-image-preview') as HTMLImageElement;
  if (previewImg) previewImg.src = '';

  const modal = document.getElementById('modal-cal-device');
  if (modal) modal.classList.add('active');
};

// Edit Device Modal
(window as any).openEditDeviceModal = (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const titleEl = document.getElementById('cal-device-modal-title');
  if (titleEl) titleEl.textContent = 'Cihaz Kaydını Düzenle';

  const idField = document.getElementById('device-id-field') as HTMLInputElement;
  const brandEl = document.getElementById('device-brand-model') as HTMLInputElement;
  const serialEl = document.getElementById('device-serial-number') as HTMLInputElement;
  const personEl = document.getElementById('device-assigned-person') as HTMLInputElement;
  const siteEl = document.getElementById('device-site-id') as HTMLSelectElement;
  const companyEl = document.getElementById('device-calibration-company') as HTMLInputElement;
  const dateEl = document.getElementById('device-calibration-date') as HTMLInputElement;
  const statusEl = document.getElementById('device-status') as HTMLSelectElement;
  const notesEl = document.getElementById('device-notes') as HTMLTextAreaElement;

  if (idField) idField.value = device.id;
  if (brandEl) brandEl.value = device.brandModel || '';
  if (serialEl) serialEl.value = device.serialNumber || '';
  if (personEl) personEl.value = device.assignedPerson || '';
  if (siteEl) siteEl.value = device.siteId || '';
  if (companyEl) companyEl.value = device.calibrationCompany || '';
  if (dateEl) dateEl.value = device.calibrationDate || '';
  if (statusEl) statusEl.value = device.status || 'OK';
  if (notesEl) notesEl.value = device.notes || '';

  // Setup file cache in case they don't upload a new one
  uploadedCertificateBase64 = device.certificateUrl || '';
  uploadedCertificateName = device.certificateName || '';
  uploadedDeviceImageBase64 = device.deviceImage || '';

  const statusText = document.getElementById('device-pdf-status-text');
  if (statusText && device.certificateUrl) {
    statusText.textContent = `Mevcut Sertifika: ${device.certificateName || 'Sertifika.pdf'}`;
  }

  // Populate image preview if it exists
  const previewContainer = document.getElementById('device-image-preview-container');
  const previewImg = document.getElementById('device-image-preview') as HTMLImageElement;
  if (device.deviceImage) {
    if (previewImg) previewImg.src = device.deviceImage;
    if (previewContainer) previewContainer.style.display = 'block';
  } else {
    if (previewContainer) previewContainer.style.display = 'none';
    if (previewImg) previewImg.src = '';
  }

  const modal = document.getElementById('modal-cal-device');
  if (modal) modal.classList.add('active');
};

// Save Add/Edit Form
(window as any).saveDevice = async () => {
  const id = (document.getElementById('device-id-field') as HTMLInputElement)?.value;
  const brandModel = (document.getElementById('device-brand-model') as HTMLInputElement)?.value.trim();
  const serialNumber = (document.getElementById('device-serial-number') as HTMLInputElement)?.value.trim();
  const assignedPerson = (document.getElementById('device-assigned-person') as HTMLInputElement)?.value.trim();
  const siteId = (document.getElementById('device-site-id') as HTMLSelectElement)?.value;
  const calibrationCompany = (document.getElementById('device-calibration-company') as HTMLInputElement)?.value.trim();
  const calibrationDate = (document.getElementById('device-calibration-date') as HTMLInputElement)?.value;
  const status = (document.getElementById('device-status') as HTMLSelectElement)?.value as 'OK' | 'REJECT';
  const notes = (document.getElementById('device-notes') as HTMLTextAreaElement)?.value.trim();

  if (!brandModel || !serialNumber || !siteId) {
    alert('Lütfen yıldızlı (*) tüm zorunlu alanları doldurunuz.');
    return;
  }

  const site = dataService.getSites().find(s => s.id === siteId);
  const siteName = site ? site.name : '';

  // Calculate next calibration date (exactly 1 year later) if calibrationDate is provided
  let nextCalibrationDate = '';
  if (calibrationDate) {
    try {
      const calDate = new Date(calibrationDate);
      calDate.setFullYear(calDate.getFullYear() + 1);
      nextCalibrationDate = calDate.toISOString().split('T')[0];
    } catch (err) {
      console.error(err);
    }
  }

  const deviceData: Omit<CalibrationDevice, 'id'> = {
    type: currentDeviceType,
    brandModel,
    serialNumber,
    assignedPerson,
    siteId,
    siteName,
    calibrationCompany,
    calibrationDate,
    nextCalibrationDate,
    status,
    notes,
    certificateUrl: uploadedCertificateBase64 || '',
    certificateName: uploadedCertificateName || '',
    deviceImage: uploadedDeviceImageBase64 || ''
  };

  try {
    if (id) {
      await deviceCalibrationService.updateDevice(id, deviceData);
      alert('✅ Cihaz kaydı başarıyla güncellendi.');
    } else {
      const newId = await deviceCalibrationService.addDevice(deviceData);
      alert('✅ Yeni cihaz kaydı başarıyla oluşturuldu.');
    }
    
    (window as any).closeCalibrationModal('modal-cal-device');
  } catch (err) {
    console.error(err);
    alert('❌ Kayıt sırasında hata oluştu: ' + (err as Error).message);
  }
};

// Delete Device
(window as any).deleteDevice = async (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const msg = `${device.brandModel} (${device.serialNumber}) cihazını kalibrasyon listesinden tamamen silmek istediğinize emin misiniz?`;
  if (!confirm(msg)) return;

  try {
    await deviceCalibrationService.deleteDevice(deviceId);
    alert('🗑️ Cihaz kalibrasyon kaydı silindi.');
  } catch (err) {
    console.error(err);
    alert('❌ Silme işlemi sırasında hata oluştu: ' + (err as Error).message);
  }
};

// Open Renew Calibration Modal
(window as any).openRenewCalibrationModal = (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const idField = document.getElementById('renew-device-id') as HTMLInputElement;
  const infoEl = document.getElementById('renew-device-info');
  const companyEl = document.getElementById('renew-calibration-company') as HTMLInputElement;
  const dateEl = document.getElementById('renew-calibration-date') as HTMLInputElement;
  const statusEl = document.getElementById('renew-status') as HTMLSelectElement;
  const notesEl = document.getElementById('renew-notes') as HTMLTextAreaElement;

  if (idField) idField.value = device.id;
  if (infoEl) infoEl.textContent = `${device.brandModel} (SN: ${device.serialNumber})`;
  if (companyEl) companyEl.value = device.calibrationCompany || '';
  
  // Set default date to today
  const todayStr = new Date().toISOString().split('T')[0];
  if (dateEl) dateEl.value = todayStr;
  if (statusEl) statusEl.value = 'OK';
  if (notesEl) notesEl.value = '';

  uploadedCertificateBase64 = '';
  uploadedCertificateName = '';

  const modal = document.getElementById('modal-cal-renew');
  if (modal) modal.classList.add('active');
};

// Save Renew/Calibration Log (updates device and inserts history record)
(window as any).saveCalibrationLog = async () => {
  const deviceId = (document.getElementById('renew-device-id') as HTMLInputElement)?.value;
  const calibrationDate = (document.getElementById('renew-calibration-date') as HTMLInputElement)?.value;
  const calibrationCompany = (document.getElementById('renew-calibration-company') as HTMLInputElement)?.value.trim();
  const status = (document.getElementById('renew-status') as HTMLSelectElement)?.value as 'OK' | 'REJECT';
  const notes = (document.getElementById('renew-notes') as HTMLTextAreaElement)?.value.trim();

  if (!deviceId || !calibrationDate || !calibrationCompany) {
    alert('Lütfen yıldızlı (*) tüm alanları doldurunuz.');
    return;
  }

  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const userEmail = authService.getCurrentUser()?.email || 'admin@dh-servis.com';

  // Calculate next calibration date (exactly 1 year later)
  const calDate = new Date(calibrationDate);
  calDate.setFullYear(calDate.getFullYear() + 1);
  const nextCalibrationDate = calDate.toISOString().split('T')[0];

  const logData: Omit<CalibrationHistoryLog, 'id' | 'deviceId' | 'createdAt'> = {
    deviceSerialNumber: device.serialNumber,
    calibrator: userEmail,
    calibrationCompany,
    calibrationDate,
    nextCalibrationDate,
    status,
    notes,
    certificateUrl: uploadedCertificateBase64 || '',
    certificateName: uploadedCertificateName || ''
  };

  try {
    await deviceCalibrationService.performCalibration(deviceId, logData, nextCalibrationDate);
    alert('✅ Kalibrasyon periyodu başarıyla yenilendi.');
    (window as any).closeCalibrationModal('modal-cal-renew');
  } catch (err) {
    console.error(err);
    alert('❌ Kalibrasyon yenileme sırasında hata oluştu: ' + (err as Error).message);
  }
};

// Open Calibration History Modal
(window as any).openCalibrationHistoryModal = async (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const infoEl = document.getElementById('history-device-info');
  if (infoEl) infoEl.textContent = `${device.brandModel} (SN: ${device.serialNumber})`;

  const container = document.getElementById('history-logs-container');
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: var(--accent-cyan);">
        <i class="fa-solid fa-spinner fa-spin"></i> Geçmiş kayıtları yükleniyor...
      </div>
    `;
  }

  const modal = document.getElementById('modal-cal-history');
  if (modal) modal.classList.add('active');

  try {
    const logs = await deviceCalibrationService.getCalibrationHistory(deviceId);
    
    if (!container) return;

    if (logs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: rgba(255,255,255,0.4); font-style: italic;">
          Cihaza ait eski kalibrasyon kaydı bulunamadı.
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(log => {
      const dateFormatted = log.calibrationDate ? new Date(log.calibrationDate).toLocaleDateString('tr-TR') : '-';
      const nextFormatted = log.nextCalibrationDate ? new Date(log.nextCalibrationDate).toLocaleDateString('tr-TR') : '-';
      
      const badge = log.status === 'OK' ? `
        <span style="background: rgba(20, 241, 149, 0.15); color: var(--accent-green); border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">UYGUN</span>
      ` : `
        <span style="background: rgba(220, 38, 38, 0.15); color: #ef4444; border: 1px solid rgba(220, 38, 38, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: bold; font-size: 0.65rem;">UYGUN DEĞİL</span>
      `;

      const certLink = log.certificateUrl ? `
        <button onclick="window.openPdfBase64('${log.certificateUrl.replace(/'/g, "\\'")}', '${(log.certificateName || 'sertifika.pdf').replace(/'/g, "\\'")}')" class="cal-btn cal-btn-outline" style="padding: 2px 6px; font-size: 0.65rem; color: var(--accent-cyan); border-color: rgba(0, 243, 255, 0.2); background: rgba(0, 243, 255, 0.01);">
          <i class="fa-solid fa-file-pdf"></i> Sertifika Aç
        </button>
      ` : `
        <span style="opacity: 0.4; font-size: 0.65rem;">Sertifika Yok</span>
      `;

      return `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 10px; font-size: 0.75rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <div><strong>Tarih:</strong> ${dateFormatted}</div>
            <div>${badge}</div>
          </div>
          <div style="margin-bottom: 4px;"><strong>Firma:</strong> ${log.calibrationCompany || '-'}</div>
          <div style="margin-bottom: 4px;"><strong>Gelecek Kalibrasyon:</strong> ${nextFormatted}</div>
          <div style="margin-bottom: 4px;"><strong>Kayıt Yapan:</strong> ${log.calibrator || '-'}</div>
          ${log.notes ? `<div style="margin-bottom: 6px; opacity: 0.7;"><strong>Notlar:</strong> ${log.notes}</div>` : ''}
          <div style="display: flex; justify-content: flex-end; margin-top: 6px;">
            ${certLink}
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    if (container) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2rem; color: var(--accent-red);">
          ❌ Kayıtlar yüklenirken bir hata oluştu.
        </div>
      `;
    }
  }
};

// Helper to normalize dates from Excel (supporting Date, strings, serials)
const normalizeCalibrationDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const str = String(val).trim();
  if (!str) return '';
  
  // Check if numeric serial (Excel date serial)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const dateObj = new Date((Number(str) - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = String(dateObj.getMonth() + 1).padStart(2, '0');
      const d = String(dateObj.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }

  // Parse YYYY-MM-DD
  const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (yyyymmddMatch) {
    return `${yyyymmddMatch[1]}-${yyyymmddMatch[2].padStart(2, '0')}-${yyyymmddMatch[3].padStart(2, '0')}`;
  }

  // Parse DD.MM.YYYY
  const ddMMyyyyMatch = str.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (ddMMyyyyMatch) {
    return `${ddMMyyyyMatch[3]}-${ddMMyyyyMatch[2].padStart(2, '0')}-${ddMMyyyyMatch[1].padStart(2, '0')}`;
  }

  // Parse YYYY-MM
  if (/^\d{4}-\d{2}$/.test(str)) {
    return `${str}-01`;
  }

  return str;
};

// Excel Download Template
(window as any).downloadCalibrationTemplate = () => {
  const isOlcu = currentDeviceType === 'OLCU';
  
  const sampleData = [
    {
      'Marka / Model': isOlcu ? 'Fluke 179 Multimetre' : 'Norbar TTi300 Tork Anahtarı',
      'Seri Numarası': isOlcu ? 'SN-938210' : 'SN-552910',
      'Zimmetli Personel / Ekip': 'Ahmet Yılmaz (Teknisyen)',
      'Saha': 'Alize',
      'Kalibrasyon Firması': 'Kal-Met Kalibrasyon Laboratuvarı',
      'Kalibrasyon Tarihi': '25.06.2026',
      'Kalibrasyon Durumu (UYGUN veya UYGUN DEĞİL)': 'UYGUN',
      'Notlar': 'Cihaz koruyucu çantası ile birlikte teslim edildi.'
    },
    {
      'Marka / Model': isOlcu ? 'Megger MIT515 İzolasyon Test Cihazı' : 'Gedore Dremometer DX 1000 Nm',
      'Seri Numarası': isOlcu ? 'SN-481920' : 'SN-293810',
      'Zimmetli Personel / Ekip': 'Saha Bakım Ekibi',
      'Saha': 'Anemon',
      'Kalibrasyon Firması': 'Met-Test Kalibrasyon',
      'Kalibrasyon Tarihi': '10.05.2026',
      'Kalibrasyon Durumu (UYGUN veya UYGUN DEĞİL)': 'UYGUN',
      'Notlar': 'Yıllık rutin periyodik kontrol'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Kalibrasyon Sablon');
  
  // Column widths
  worksheet['!cols'] = [
    { wch: 30 }, // Brand/Model
    { wch: 18 }, // SN
    { wch: 25 }, // Assigned
    { wch: 15 }, // Site
    { wch: 35 }, // Company
    { wch: 18 }, // Calibration Date
    { wch: 35 }, // Status
    { wch: 45 }  // Notes
  ];

  const fileName = `DH_Servis_${isOlcu ? 'Olcu_Aletleri' : 'Tork_Aletleri'}_Yukleme_Sablonu.xlsx`;
  XLSX.writeFile(workbook, fileName);
  (window as any).showToast?.('Şablon Excel dosyası indirildi.', 'success');
};

// Excel Upload Parser
(window as any).importCalibrationFromExcel = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('Seçilen Excel dosyasında veri bulunamadı.');
        return;
      }

      const sites = dataService.getSites();
      let successCount = 0;
      let duplicateCount = 0;
      let failCount = 0;

      // Existing serials set to prevent duplicate adds
      const existingSerials = new Set((calibrationDevicesList || []).map(d => d.serialNumber.toLowerCase().trim()));

      for (const row of jsonData) {
        const brandModel = String(row['Marka / Model'] || '').trim();
        const serialNumber = String(row['Seri Numarası'] || '').trim();
        const assignedPerson = String(row['Zimmetli Personel / Ekip'] || '').trim();
        const siteInput = String(row['Saha'] || '').trim().toLowerCase();
        const calibrationCompany = String(row['Kalibrasyon Firması'] || '').trim();
        const rawDate = row['Kalibrasyon Tarihi'];
        const rawStatus = String(row['Kalibrasyon Durumu (UYGUN veya UYGUN DEĞİL)'] || 'UYGUN').trim().toUpperCase();
        const notes = String(row['Notlar'] || '').trim();

        if (!brandModel || !serialNumber) {
          failCount++;
          continue;
        }

        // Prevent duplicate serial numbers
        if (existingSerials.has(serialNumber.toLowerCase())) {
          duplicateCount++;
          continue;
        }

        // Resolve Site
        let siteId = '';
        let siteName = '';
        if (siteInput) {
          const matchedSite = sites.find(s => s.name.toLowerCase().includes(siteInput) || siteInput.includes(s.name.toLowerCase()));
          if (matchedSite) {
            siteId = matchedSite.id;
            siteName = matchedSite.name;
          } else {
            siteId = sites[0]?.id || 'OTHER';
            siteName = sites[0]?.name || 'Diğer / Saha Dışı';
          }
        } else {
          siteId = sites[0]?.id || 'OTHER';
          siteName = sites[0]?.name || 'Diğer / Saha Dışı';
        }

        // Normalize calibration date
        let calibrationDate = '';
        let nextCalibrationDate = '';
        if (rawDate) {
          const normalized = normalizeCalibrationDate(rawDate);
          if (normalized) {
            calibrationDate = normalized;
            try {
              const calDate = new Date(calibrationDate);
              calDate.setFullYear(calDate.getFullYear() + 1);
              nextCalibrationDate = calDate.toISOString().split('T')[0];
            } catch (err) {
              console.warn('Next calibration date calculation failed', err);
            }
          }
        }

        // Resolve Status
        const status: 'OK' | 'REJECT' = (rawStatus.includes('DEĞİL') || rawStatus.includes('RED') || rawStatus.includes('REJECT') || rawStatus === 'NOK') ? 'REJECT' : 'OK';

        const deviceData: Omit<CalibrationDevice, 'id'> = {
          type: currentDeviceType,
          brandModel,
          serialNumber,
          assignedPerson,
          siteId,
          siteName,
          calibrationCompany,
          calibrationDate,
          nextCalibrationDate,
          status,
          notes,
          certificateUrl: '',
          certificateName: ''
        };

        try {
          await deviceCalibrationService.addDevice(deviceData);
          successCount++;
        } catch (err) {
          console.error(err);
          failCount++;
        }
      }

      alert(`✅ Excel yükleme tamamlandı!\nBaşarılı: ${successCount}\nMükerrer (Eklenmedi): ${duplicateCount}\nHatalı Satır: ${failCount}`);
      input.value = ''; // clear input
    } catch (err) {
      console.error(err);
      alert('Excel dosyası çözümlenirken hata oluştu: ' + (err as Error).message);
    }
  };

  reader.readAsArrayBuffer(file);
};

// Single QR Print Action
(window as any).printDeviceQR = async (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const targetUrl = `${window.location.origin}/?page=cihaz-sorgu&id=${device.id}`;
  const qrDataUrl = await qrService.generateDataURL(targetUrl);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Açılır pencere engellendi. Lütfen izin verin.');
    return;
  }

  const dateFormatted = device.nextCalibrationDate 
    ? new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR') 
    : 'Bilinmiyor';

  printWindow.document.write(`
    <html>
      <head>
        <title>Cihaz Etiketi - ${device.serialNumber}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #fff;
          }
          .label-card {
            width: 280px;
            border: 2px dashed #334155;
            padding: 15px;
            text-align: center;
            border-radius: 8px;
            background: #fff;
            box-sizing: border-box;
          }
          .logo-text {
            font-size: 11px;
            font-weight: bold;
            color: #002D6B;
            letter-spacing: 1px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .qr-img {
            width: 140px;
            height: 140px;
            margin: 8px 0;
          }
          .item-name {
            font-size: 12px;
            font-weight: bold;
            color: #1e293b;
            margin: 4px 0;
          }
          .item-detail {
            font-size: 10px;
            color: #64748b;
            margin: 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .item-sn {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            background: #f1f5f9;
            padding: 4px 0;
            border-radius: 4px;
            margin-top: 8px;
            border: 1px solid #e2e8f0;
          }
        </style>
      </head>
      <body>
        <div class="label-card">
          <div class="logo-text">DH DEMİRER HOLDİNG</div>
          <div style="font-size: 9px; color: #64748b; margin-top: -5px;">Kalibrasyon Takip Sistemi</div>
          <img src="${qrDataUrl}" class="qr-img" onload="window.print(); setTimeout(() => window.close(), 1000);" />
          <div class="item-name">${device.brandModel}</div>
          <div class="item-detail">Saha: ${device.siteName || '-'}</div>
          <div class="item-detail">Sorumlu: ${device.assignedPerson || '-'}</div>
          <div class="item-detail">Sonraki Kalibrasyon: ${dateFormatted}</div>
          <div class="item-sn">${device.serialNumber}</div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// Bulk QR Print Action
(window as any).printBulkDeviceQR = async () => {
  const devices = filteredDevicesList;
  if (devices.length === 0) {
    alert('Yazdırılacak cihaz bulunamadı.');
    return;
  }

  if (!confirm(`${devices.length} adet cihaz için barkod etiketi yazdırılacak. Devam etmek istiyor musunuz?`)) {
    return;
  }

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından izin verin.');
    return;
  }

  printWindow.document.write(`
    <html><head><title>Etiketler Hazırlanıyor...</title></head>
    <body style="display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;">
        <h2>QR Kodlar oluşturuluyor, lütfen bekleyin...</h2>
    </body></html>
  `);

  const itemsWithQR = await Promise.all(devices.map(async d => {
    const targetUrl = `${window.location.origin}/?page=cihaz-sorgu&id=${d.id}`;
    const dataUrl = await qrService.generateDataURL(targetUrl);
    const dateFormatted = d.nextCalibrationDate 
      ? new Date(d.nextCalibrationDate).toLocaleDateString('tr-TR') 
      : 'Bilinmiyor';
    return { ...d, dataUrl, dateFormatted };
  }));

  const pages = [];
  for (let i = 0; i < itemsWithQR.length; i += 14) {
    pages.push(itemsWithQR.slice(i, i + 14));
  }

  const pagesHtml = pages.map(pageItems => `
    <div class="page">
        ${pageItems.map(d => `
        <div class="label-box">
            <div class="details">
                <div class="logo-text">DH DEMİRER HOLDİNG</div>
                <div class="title-sub">Kalibrasyon Takip</div>
                <div class="item-name">${d.brandModel}</div>
                <div class="item-detail">Saha: ${d.siteName || '-'}</div>
                <div class="item-detail">Sorumlu: ${d.assignedPerson || '-'}</div>
                <div class="item-detail">Sonraki Kal.: ${d.dateFormatted}</div>
                <div class="item-sn">${d.serialNumber}</div>
            </div>
            <img class="qr-img" src="${d.dataUrl}">
        </div>`).join('')}
    </div>
  `).join('');

  printWindow.document.open();
  printWindow.document.write(`
    <html>
        <head>
            <title>Toplu Cihaz Etiketleri</title>
            <style>
                @page { size: A4; margin: 0; }
                @media print {
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
                body { 
                    margin: 0; 
                    padding: 0; 
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; 
                    background: white; 
                    box-sizing: border-box; 
                }
                .page {
                    width: 210mm;
                    height: 297mm;
                    padding-top: 15.15mm;
                    padding-left: 5.9mm;
                    padding-right: 5.9mm;
                    box-sizing: border-box;
                    display: grid;
                    grid-template-columns: 99.1mm 99.1mm;
                    grid-template-rows: repeat(7, 38.1mm);
                    page-break-after: always;
                    overflow: hidden;
                }
                .page:last-child {
                    page-break-after: auto;
                }
                .label-box {
                    width: 99.1mm;
                    height: 38.1mm;
                    box-sizing: border-box;
                    padding: 3mm 4mm;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    overflow: hidden;
                    border: 1px dashed #e2e8f0;
                }
                .details { 
                    flex: 1; 
                    min-width: 0; 
                    display: flex; 
                    flex-direction: column; 
                    justify-content: center; 
                    text-align: left;
                    padding-right: 2mm;
                }
                .logo-text {
                    font-size: 8pt;
                    font-weight: bold;
                    color: #002D6B;
                    letter-spacing: 0.5px;
                    text-transform: uppercase;
                }
                .title-sub {
                    font-size: 6pt;
                    color: #64748b;
                    margin-bottom: 1mm;
                }
                .item-name { 
                    font-size: 9pt; 
                    font-weight: 800; 
                    color: #0f172a; 
                    margin-bottom: 0.5mm;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .item-detail {
                    font-size: 7pt;
                    color: #475569;
                    line-height: 1.1;
                }
                .item-sn { 
                    font-size: 8pt; 
                    font-weight: 900; 
                    color: #0f172a; 
                    background: #f1f5f9;
                    padding: 1px 4px;
                    border-radius: 2px;
                    margin-top: 1mm;
                    display: inline-block;
                    width: fit-content;
                }
                .qr-img { 
                    width: 28mm; 
                    height: 28mm; 
                    flex-shrink: 0; 
                    object-fit: contain; 
                }
            </style>
        </head>
        <body>
            ${pagesHtml}
            <script>
                window.onload = () => { 
                    setTimeout(() => {
                        window.print();
                    }, 500);
                }
            </script>
        </body>
    </html>
  `);
  printWindow.document.close();
};

// Open Scan Result Detail Modal
(window as any).openDeviceDetailModal = (deviceId: string) => {
  const device = calibrationDevicesList.find(d => d.id === deviceId);
  if (!device) return;

  const bodyEl = document.getElementById('device-detail-modal-body');
  if (!bodyEl) return;

  const todayStr = new Date().toISOString().split('T')[0];
  const daysInfo = getCalibrationDaysInfo(device.nextCalibrationDate);

  let statusHtml = '';
  if (device.status === 'REJECT') {
    statusHtml = `<div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 15px; font-size: 0.9rem;"><i class="fa-solid fa-circle-xmark"></i> KALİBRASYON UYGUN DEĞİL (RED)</div>`;
  } else if (device.nextCalibrationDate <= todayStr) {
    statusHtml = `<div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 15px; font-size: 0.9rem;"><i class="fa-solid fa-triangle-exclamation"></i> KALİBRASYON SÜRESİ GEÇMİŞ (${Math.abs(daysInfo.daysRemaining)} Gün)</div>`;
  } else if (daysInfo.daysRemaining <= 30) {
    statusHtml = `<div style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); color: #F59E0B; padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 15px; font-size: 0.9rem;"><i class="fa-solid fa-clock"></i> KALİBRASYON YAKLAŞTI (${daysInfo.daysRemaining} Gün Kaldı)</div>`;
  } else {
    statusHtml = `<div style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; padding: 12px; border-radius: 8px; font-weight: bold; text-align: center; margin-bottom: 15px; font-size: 0.9rem;"><i class="fa-solid fa-circle-check"></i> UYGUN (${daysInfo.daysRemaining} Gün Kaldı)</div>`;
  }

  const deviceIcon = device.type === 'OLCU' ? 'fa-gauge' : 'fa-wrench';
  const imageHtml = device.deviceImage 
    ? `<div style="width: 100%; height: 200px; border-radius: 12px; overflow: hidden; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1);"><img src="${device.deviceImage}" style="width: 100%; height: 100%; object-fit: cover;"></div>`
    : `<div style="width: 100%; height: 150px; border-radius: 12px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.1); display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 15px; color: rgba(255,255,255,0.3);"><i class="fa-solid ${deviceIcon} fa-3x" style="margin-bottom: 10px;"></i><span style="font-size: 0.8rem;">Görsel Bulunmuyor</span></div>`;

  const dateFormatted = device.calibrationDate ? new Date(device.calibrationDate).toLocaleDateString('tr-TR') : '-';
  const nextFormatted = device.nextCalibrationDate ? new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR') : '-';

  const docLink = device.certificateUrl ? `
    <button onclick="window.openPdfBase64('${device.certificateUrl.replace(/'/g, "\\'")}', '${(device.certificateName || 'sertifika.pdf').replace(/'/g, "\\'")}')" class="cal-btn cal-btn-outline" style="width: 100%; padding: 10px; margin-top: 15px; color: var(--accent-cyan); border-color: rgba(0, 243, 255, 0.2); display: flex; align-items: center; justify-content: center; gap: 8px;">
      <i class="fa-solid fa-file-pdf"></i> Mevcut Sertifikayı Görüntüle
    </button>
  ` : '';

  bodyEl.innerHTML = `
    ${imageHtml}
    ${statusHtml}
    
    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 0.85rem;">
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Cihaz Sınıfı:</span>
        <span style="font-weight: bold; color: white;">${device.type === 'OLCU' ? 'Ölçü Aleti' : 'Tork Aleti'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Marka / Model:</span>
        <span style="font-weight: bold; color: white;">${device.brandModel || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Seri Numarası:</span>
        <span style="font-weight: bold; color: var(--accent-cyan); font-family: monospace;">${device.serialNumber || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Zimmetli Kişi / Ekip:</span>
        <span style="font-weight: bold; color: white;">${device.assignedPerson || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Bulunduğu Saha:</span>
        <span style="font-weight: bold; color: white;">${device.siteName || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Kalibrasyon Firması:</span>
        <span style="font-weight: bold; color: white;">${device.calibrationCompany || '-'}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Son Kalibrasyon:</span>
        <span style="font-weight: bold; color: white;">${dateFormatted}</span>
      </div>
      <div style="display: flex; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px;">
        <span style="color: rgba(255,255,255,0.5);">Sonraki Kalibrasyon:</span>
        <span style="font-weight: bold; color: white;">${nextFormatted}</span>
      </div>
      ${device.notes ? `
      <div style="margin-top: 5px;">
        <div style="color: rgba(255,255,255,0.5); margin-bottom: 4px;">Açıklama:</div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; color: rgba(255,255,255,0.85); font-style: italic;">${device.notes}</div>
      </div>
      ` : ''}
    </div>
    ${docLink}
  `;

  // Bind Actions
  const renewBtn = document.getElementById('detail-btn-renew');
  if (renewBtn) {
    renewBtn.onclick = () => {
      (window as any).closeCalibrationModal('modal-cal-device-detail');
      setTimeout(() => {
        (window as any).openRenewCalibrationModal(device.id);
      }, 300);
    };
  }

  const editBtn = document.getElementById('detail-btn-edit');
  if (editBtn) {
    editBtn.onclick = () => {
      (window as any).closeCalibrationModal('modal-cal-device-detail');
      setTimeout(() => {
        (window as any).openEditDeviceModal(device.id);
      }, 300);
    };
  }

  const modal = document.getElementById('modal-cal-device-detail');
  if (modal) modal.classList.add('active');
};

// Scan QR Action (In-app)
(window as any).scanDeviceQR = async () => {
  try {
    const decodedText = await qrService.scanQRCode();
    if (!decodedText) return;

    const cleanText = decodedText.trim();
    let searchKey = cleanText;

    // Check if it is a URL and extract parameter
    if (cleanText.includes('page=cihaz-sorgu')) {
      try {
        const urlObj = new URL(cleanText);
        searchKey = urlObj.searchParams.get('id') || urlObj.searchParams.get('sn') || cleanText;
      } catch (e) {
        const idMatch = cleanText.match(/[?&]id=([^&]+)/);
        const snMatch = cleanText.match(/[?&]sn=([^&]+)/);
        searchKey = idMatch ? decodeURIComponent(idMatch[1]) : (snMatch ? decodeURIComponent(snMatch[1]) : cleanText);
      }
    }

    // Search in local devices list
    // First try by ID
    let foundDevice = calibrationDevicesList.find(d => d.id === searchKey);
    // If not found, try by serialNumber (case insensitive)
    if (!foundDevice) {
      foundDevice = calibrationDevicesList.find(d => 
        d.serialNumber.toLowerCase() === searchKey.toLowerCase() ||
        d.serialNumber.toLowerCase().includes(searchKey.toLowerCase()) ||
        searchKey.toLowerCase().includes(d.serialNumber.toLowerCase())
      );
    }

    if (foundDevice) {
      (window as any).showToast?.(`Cihaz bulundu: ${foundDevice.brandModel} (${foundDevice.serialNumber})`, 'success');
      
      // Auto-filter search box
      const searchBox = document.getElementById('cal-search-input') as HTMLInputElement;
      if (searchBox) {
        searchBox.value = foundDevice.serialNumber;
        // Trigger filter event
        const event = new Event('input', { bubbles: true });
        searchBox.dispatchEvent(event);
      }

      // Open detail modal
      setTimeout(() => {
        (window as any).openDeviceDetailModal(foundDevice.id);
      }, 500);
    } else {
      if (confirm(`"${searchKey}" seri numaralı cihaz sistemde bulunamadı. Yeni bir cihaz kaydı oluşturmak ister misiniz?`)) {
        (window as any).openAddDeviceModal();
        const snInput = document.getElementById('device-serial-number') as HTMLInputElement;
        if (snInput) snInput.value = searchKey;
      }
    }
  } catch (err: any) {
    if (err.message !== 'Canceled') {
      console.error(err);
      alert('Barkod okuma sırasında hata oluştu.');
    }
  }
};
