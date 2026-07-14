import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';

interface CalibrationDevice {
  id: string;
  type: 'OLCU' | 'TORK';
  brandModel: string;
  serialNumber: string;
  assignedPerson: string;
  siteId: string;
  siteName: string;
  calibrationCompany: string;
  calibrationDate: string;
  nextCalibrationDate: string;
  status: 'OK' | 'REJECT';
  notes?: string;
  certificateUrl?: string;
  certificateName?: string;
  deviceImage?: string;
}

interface CalibrationHistoryLog {
  id: string;
  deviceId: string;
  deviceSerialNumber: string;
  calibrator: string;
  calibrationCompany: string;
  calibrationDate: string;
  nextCalibrationDate: string;
  status: 'OK' | 'REJECT';
  notes: string;
  certificateUrl?: string;
  certificateName?: string;
}

// Function to calculate countdown
function getCalibrationDaysInfo(nextCalDateStr: string | undefined) {
  if (!nextCalDateStr) return { daysRemaining: 0, text: 'Tarih Belirtilmemiş', class: 'overdue' };
  
  const today = new Date();
  today.setHours(0,0,0,0);
  const nextDate = new Date(nextCalDateStr);
  nextDate.setHours(0,0,0,0);
  
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { daysRemaining: diffDays, text: `Süresi Geçmiş (${Math.abs(diffDays)} Gün Gecikti)`, class: 'overdue' };
  } else if (diffDays === 0) {
    return { daysRemaining: diffDays, text: 'Son Gün! Kalibrasyon Gerekli', class: 'warning' };
  } else if (diffDays <= 30) {
    return { daysRemaining: diffDays, text: `${diffDays} Gün Kaldı (Kritik)`, class: 'warning' };
  } else {
    return { daysRemaining: diffDays, text: `${diffDays} Gün Kaldı (Uygun)`, class: 'ok' };
  }
}

export async function renderDevicePublicQueryPage(id?: string | null, sn?: string | null): Promise<string> {
  // Add CSS styles specifically for public queries
  const styleId = 'device-public-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      .public-body {
        background: #050a10;
        color: #f8fafc;
        font-family: 'Inter', system-ui, sans-serif;
        min-height: 100vh;
        display: flex;
        justify-content: center;
        padding: 1rem;
        box-sizing: border-box;
      }
      .public-card {
        width: 100%;
        max-width: 520px;
        background: rgba(13, 25, 41, 0.7);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 16px;
        padding: 1.5rem;
        box-shadow: 0 8px 32px rgba(0,0,0,0.5);
        backdrop-filter: blur(12px);
        margin: auto;
      }
      .public-logo-header {
        display: flex;
        align-items: center;
        gap: 12px;
        border-bottom: 2px solid #002d6b;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .status-badge-lg {
        padding: 16px;
        border-radius: 12px;
        text-align: center;
        font-size: 1rem;
        font-weight: 800;
        margin-bottom: 20px;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        box-shadow: inset 0 0 12px rgba(255,255,255,0.05);
      }
      .status-badge-lg.ok {
        background: rgba(16, 185, 129, 0.1);
        border: 1px solid rgba(16, 185, 129, 0.3);
        color: #10B981;
      }
      .status-badge-lg.warning {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #F59E0B;
      }
      .status-badge-lg.overdue {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #EF4444;
      }
      .field-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 0.85rem;
      }
      .field-label {
        color: #94a3b8;
        font-weight: 500;
      }
      .field-value {
        color: #ffffff;
        font-weight: bold;
      }
      .section-subtitle-pub {
        font-size: 0.85rem;
        font-weight: bold;
        color: #00f3ff;
        margin-top: 24px;
        margin-bottom: 10px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .pub-timeline {
        border-left: 2px solid rgba(0, 243, 255, 0.15);
        padding-left: 16px;
        margin-left: 8px;
        margin-top: 15px;
      }
      .pub-timeline-item {
        position: relative;
        margin-bottom: 16px;
      }
      .pub-timeline-item::before {
        content: '';
        position: absolute;
        left: -23px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #00f3ff;
        border: 2px solid #050a10;
      }
      .pub-timeline-item.ok::before { background: #10B981; }
      .pub-timeline-item.reject::before { background: #EF4444; }
      .pub-timeline-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 10px;
        font-size: 0.75rem;
      }
      .pub-image-container {
        width: 100%;
        height: 220px;
        border-radius: 12px;
        overflow: hidden;
        margin-bottom: 15px;
        border: 1px solid rgba(0, 243, 255, 0.15);
        box-sizing: border-box;
      }
      .pub-image-placeholder {
        width: 100%;
        height: 150px;
        border-radius: 12px;
        background: rgba(255,255,255,0.02);
        border: 1px dashed rgba(255,255,255,0.1);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-bottom: 15px;
        color: rgba(255,255,255,0.25);
      }
      .back-btn {
        width: 100%;
        padding: 12px;
        border-radius: 8px;
        background: #002d6b;
        color: #ffffff;
        border: 1px solid #00f3ff;
        font-size: 0.85rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;
        margin-top: 25px;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }
      .back-btn:hover {
        background: #00f3ff;
        color: #050a10;
      }
    `;
    document.head.appendChild(style);
  }

  // Setup global function to view PDF
  if (!(window as any).openPdfBase64) {
    (window as any).openPdfBase64 = (base64Data: string, fileName: string) => {
      try {
        const base64Parts = base64Data.split(';base64,');
        const mimeType = base64Parts[0].split(':')[1] || 'application/pdf';
        const rawData = window.atob(base64Parts[1] || base64Data);
        
        const rawDataLength = rawData.length;
        const uInt8Array = new Uint8Array(rawDataLength);
        
        for (let i = 0; i < rawDataLength; ++i) {
          uInt8Array[i] = rawData.charCodeAt(i);
        }
        
        const blob = new Blob([uInt8Array], { type: mimeType });
        const blobUrl = URL.createObjectURL(blob);
        
        const win = window.open(blobUrl, '_blank');
        if (win) {
          win.focus();
        } else {
          // If popup is blocked, download instead
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = fileName || 'rapor.pdf';
          link.click();
        }
      } catch (err) {
        console.error('PDF view error:', err);
        alert('Belge açılırken hata oluştu.');
      }
    };
  }

  try {
    let device: CalibrationDevice | null = null;

    if (id) {
      const docRef = doc(db, 'calibrated_devices', id);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        device = { id: docSnap.id, ...docSnap.data() } as CalibrationDevice;
      }
    } else if (sn) {
      const qItem = query(collection(db, 'calibrated_devices'), where('serialNumber', '==', sn));
      const snapshotItem = await getDocs(qItem);
      if (!snapshotItem.empty) {
        const d = snapshotItem.docs[0];
        device = { id: d.id, ...d.data() } as CalibrationDevice;
      }
    }

    if (!device) {
      return `
        <div class="public-body">
          <div class="public-card" style="text-align: center;">
            <div style="color: #EF4444; font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2 style="color: #ffffff; margin-bottom: 0.5rem;">Cihaz Bulunamadı</h2>
            <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 2rem;">
              Aradığınız kalibrasyon cihazı bulunamadı. Lütfen QR kodunu veya seri numarasını kontrol ediniz.
            </p>
          </div>
        </div>
      `;
    }

    // Fetch History Logs
    const historyCol = collection(db, 'device_calibrations_history');
    const qHistory = query(historyCol, where('deviceId', '==', device.id));
    const snapshotHistory = await getDocs(qHistory);
    const logs = snapshotHistory.docs.map(d => ({ id: d.id, ...d.data() } as CalibrationHistoryLog));
    logs.sort((a, b) => b.calibrationDate.localeCompare(a.calibrationDate));

    // Calculate countdown
    const todayStr = new Date().toISOString().split('T')[0];
    const daysInfo = getCalibrationDaysInfo(device.nextCalibrationDate);

    let displayStatus: 'OK' | 'WARNING' | 'OVERDUE' = 'OK';
    let statusText = 'KALİBRASYON UYGUN';
    let statusClass = 'ok';
    let statusIcon = '<i class="fa-solid fa-circle-check" style="font-size: 2.2rem;"></i>';

    if (device.status === 'REJECT') {
      displayStatus = 'OVERDUE';
      statusText = 'KALİBRASYON UYGUN DEĞİL';
      statusClass = 'overdue';
      statusIcon = '<i class="fa-solid fa-circle-xmark" style="font-size: 2.2rem;"></i>';
    } else if (device.nextCalibrationDate <= todayStr) {
      displayStatus = 'OVERDUE';
      statusText = `KALİBRASYON SÜRESİ GEÇMİŞ`;
      statusClass = 'overdue';
      statusIcon = '<i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem;"></i>';
    } else if (daysInfo.daysRemaining <= 30) {
      displayStatus = 'WARNING';
      statusText = 'KALİBRASYON SÜRESİ YAKLAŞTI';
      statusClass = 'warning';
      statusIcon = '<i class="fa-solid fa-clock" style="font-size: 2.2rem;"></i>';
    }

    const imageHtml = device.deviceImage
      ? `<div class="pub-image-container"><img src="${device.deviceImage}" style="width: 100%; height: 100%; object-fit: cover;"></div>`
      : `<div class="pub-image-placeholder">
          <i class="fa-solid ${device.type === 'OLCU' ? 'fa-gauge' : 'fa-wrench'} fa-2x" style="margin-bottom: 8px;"></i>
          <span style="font-size: 0.75rem;">Cihaz Görseli Bulunmuyor</span>
        </div>`;

    const calDateFormatted = device.calibrationDate ? new Date(device.calibrationDate).toLocaleDateString('tr-TR') : '-';
    const nextDateFormatted = device.nextCalibrationDate ? new Date(device.nextCalibrationDate).toLocaleDateString('tr-TR') : '-';

    const currentCertButton = device.certificateUrl ? `
      <button onclick="window.openPdfBase64('${device.certificateUrl.replace(/'/g, "\\'")}', '${(device.certificateName || 'sertifika.pdf').replace(/'/g, "\\'")}')" class="back-btn" style="margin-top: 15px; border-color: rgba(0,243,255,0.4); background: rgba(0,243,255,0.05);">
        <i class="fa-solid fa-file-pdf"></i> Güncel Kalibrasyon Sertifikası (PDF)
      </button>
    ` : '';

    const historyHtml = logs.length > 0 ? `
      <div class="section-subtitle-pub">Kalibrasyon Geçmişi</div>
      <div class="pub-timeline">
        ${logs.map(log => {
          const logCalFormatted = log.calibrationDate ? new Date(log.calibrationDate).toLocaleDateString('tr-TR') : '-';
          const logNextFormatted = log.nextCalibrationDate ? new Date(log.nextCalibrationDate).toLocaleDateString('tr-TR') : '-';
          const dotClass = log.status === 'OK' ? 'ok' : 'reject';
          const statusTextInner = log.status === 'OK' ? 'UYGUN' : 'UYGUN DEĞİL';
          const colorText = log.status === 'OK' ? '#10B981' : '#EF4444';

          const pdfLink = log.certificateUrl ? `
            <div style="margin-top: 8px; text-align: right;">
              <a href="#" onclick="window.openPdfBase64('${log.certificateUrl.replace(/'/g, "\\'")}', '${(log.certificateName || 'rapor.pdf').replace(/'/g, "\\'")}')" style="color:#00f3ff; text-decoration:none; font-weight:bold; font-size:0.7rem; display:inline-flex; align-items:center; gap:4px;">
                <i class="fa-solid fa-file-pdf"></i> Sertifikayı Aç
              </a>
            </div>
          ` : '';

          return `
            <div class="pub-timeline-item ${dotClass}">
              <div class="pub-timeline-card">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-weight:bold;">
                  <span>${logCalFormatted}</span>
                  <span style="color: ${colorText};">${statusTextInner}</span>
                </div>
                <div><strong>Firma:</strong> ${log.calibrationCompany || '-'}</div>
                <div><strong>Geçerlilik Tarihi:</strong> ${logNextFormatted}</div>
                ${log.notes ? `<div style="margin-top:4px; opacity:0.8; font-style:italic;">"${log.notes}"</div>` : ''}
                ${pdfLink}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    ` : '';

    return `
      <div class="public-body">
        <div class="public-card">
          
          <div class="public-logo-header">
            <div style="background: linear-gradient(135deg, #00f3ff, #002d6b); width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(0,243,255,0.3);">
              <i class="fa-solid ${device.type === 'OLCU' ? 'fa-gauge-high' : 'fa-screwdriver-wrench'}" style="color: #050a10; font-size: 1.1rem;"></i>
            </div>
            <div>
              <div style="font-size: 0.85rem; font-weight: 800; color: #ffffff; letter-spacing: 1px; line-height: 1;">DH DEMİRER HOLDİNG</div>
              <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 500; text-transform: uppercase; margin-top: 2px;">Kalibrasyon Kontrol Paneli</div>
            </div>
          </div>

          ${imageHtml}

          <div class="status-badge-lg ${statusClass}">
            ${statusIcon}
            <div>${statusText}</div>
            <div style="font-size: 0.8rem; font-weight: 500; opacity: 0.9;">
              ${displayStatus === 'OVERDUE' ? daysInfo.text : `${daysInfo.daysRemaining} Gün Kaldı`}
            </div>
          </div>

          <div class="section-subtitle-pub">Cihaz Bilgileri</div>
          <div class="field-row">
            <span class="field-label">Cihaz Sınıfı:</span>
            <span class="field-value">${device.type === 'OLCU' ? 'Ölçü Aleti' : 'Tork Aleti'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Marka / Model:</span>
            <span class="field-value">${device.brandModel || '-'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Seri Numarası:</span>
            <span class="field-value" style="color: #00f3ff; font-family: monospace;">${device.serialNumber || '-'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Zimmetli Kişi / Ekip:</span>
            <span class="field-value">${device.assignedPerson || '-'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Bulunduğu Saha:</span>
            <span class="field-value">${device.siteName || '-'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Kalibrasyon Firması:</span>
            <span class="field-value">${device.calibrationCompany || '-'}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Son Kalibrasyon Tarihi:</span>
            <span class="field-value">${calDateFormatted}</span>
          </div>
          <div class="field-row">
            <span class="field-label">Gelecek Kalibrasyon Tarihi:</span>
            <span class="field-value">${nextDateFormatted}</span>
          </div>
          ${device.notes ? `
          <div style="margin-top: 12px; font-size: 0.8rem;">
            <div style="color: #94a3b8; margin-bottom: 4px;">Açıklama / Not:</div>
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 6px; color: rgba(255,255,255,0.85); font-style: italic; line-height: 1.4;">${device.notes}</div>
          </div>
          ` : ''}

          ${currentCertButton}
          ${historyHtml}

          <button onclick="window.location.href='/'" class="back-btn">
            <i class="fa-solid fa-home"></i> Ana Sayfaya Git
          </button>

        </div>
      </div>
    `;
  } catch (err: any) {
    console.error("Public query error:", err);
    return `
      <div class="public-body">
        <div class="public-card" style="text-align: center;">
          <div style="color: #EF4444; font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-circle-xmark"></i></div>
          <h2 style="color: #ffffff; margin-bottom: 0.5rem;">Sistem Hatası</h2>
          <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">
            Cihaz bilgileri Firestore veritabanından çekilirken teknik bir sorunla karşılaşıldı.
          </p>
        </div>
      </div>
    `;
  }
}
