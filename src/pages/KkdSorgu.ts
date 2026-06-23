import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

interface KkdItem {
  id: string;
  name: string; // e.g. "Emniyet Kemeri"
  serialNumber: string;
  brandModel: string;
  manufactureDate: string; // YYYY-MM
  lifespanYears: number;
  assignedPerson?: string;
  lastInspectionDate?: string;
  nextInspectionDate?: string;
  status: 'OK' | 'REJECT' | 'RETIRED';
  notes?: string;
  order?: number;
}

interface KkdInspection {
  id: string;
  itemId: string;
  inspectionDate: string;
  inspector: string;
  status: 'OK' | 'REJECT' | 'RETIRED';
  notes: string;
  checklist: Record<string, boolean>;
  images?: string[];
}

const CHECKLIST_LABELS: Record<string, string> = {
  webbing: 'Dokuma Kolon ve Halat Durumu (Yıpranma, Kesik, Aşınma)',
  stitching: 'Dikişlerin Durumu (Sökülme, Aşınma, Kopma)',
  metalParts: 'Metal Aksam, Karabina ve Bağlantı Halkaları (Korozyon, Deformasyon)',
  buckles: 'Ayar Tokaları ve Kilit Mekanizmaları (Fonksiyon Kontrolü)',
  labelReadable: 'Ürün Etiketi ve Seri Numarası Okunabilirliği',
  shockAbsorber: 'Şok Emici Durumu (Varsa Aktifleşme Kontrolü)',
  rescueKitSeal: 'Kurtarma Kiti Çantası ve Mühür Bütünlüğü (Varsa)'
};

function getLifespanInfo(mfgDate: string | undefined, lifespanYears: number = 10) {
  if (!mfgDate) return { yearsLeft: 10, monthsLeft: 0, expired: false, text: 'Bilinmiyor', expiryDate: '' };
  
  const [year, month] = mfgDate.split('-').map(Number);
  const mfg = new Date(year, (month || 1) - 1, 1);
  const expiry = new Date(mfg.getFullYear() + lifespanYears, mfg.getMonth(), 1);
  
  const today = new Date();
  const diffTime = expiry.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    return { yearsLeft: 0, monthsLeft: 0, expired: true, text: 'Kullanım Ömrü Dolan', expiryDate: expiry.toISOString().split('T')[0] };
  }
  
  const yearsLeft = Math.floor(diffDays / 365);
  const monthsLeft = Math.floor((diffDays % 365) / 30);
  
  let text = '';
  if (yearsLeft > 0) text += `${yearsLeft} Yıl `;
  text += `${monthsLeft} Ay Kaldı`;
  
  return { yearsLeft, monthsLeft, expired: false, text, expiryDate: expiry.toISOString().split('T')[0] };
}

export async function renderKkdPublicQueryPage(serialNumber: string): Promise<string> {
  // Add CSS styles specifically for public queries
  const styleId = 'kkd-public-styles';
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
        padding: 20px;
        border-radius: 12px;
        text-align: center;
        font-size: 1.1rem;
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
      .status-badge-lg.overdue {
        background: rgba(245, 158, 11, 0.1);
        border: 1px solid rgba(245, 158, 11, 0.3);
        color: #F59E0B;
      }
      .status-badge-lg.reject {
        background: rgba(239, 68, 68, 0.1);
        border: 1px solid rgba(239, 68, 68, 0.3);
        color: #EF4444;
      }
      .status-badge-lg.retired {
        background: rgba(100, 116, 139, 0.1);
        border: 1px solid rgba(100, 116, 139, 0.3);
        color: #94A3B8;
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
        font-size: 0.9rem;
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
      .pub-timeline-item.retired::before { background: #94A3B8; }
      .pub-timeline-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 10px;
      }
      .chk-table {
        width: 100%;
        border-collapse: collapse;
        margin-top: 6px;
      }
      .chk-table td {
        font-size: 0.75rem;
        padding: 5px;
        border-bottom: 1px solid rgba(255,255,255,0.03);
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

  try {
    // Query item
    const invCol = collection(db, 'kkd_inventory');
    const qItem = query(invCol, where('serialNumber', '==', serialNumber));
    const snapshotItem = await getDocs(qItem);
    
    if (snapshotItem.empty) {
      return `
        <div class="public-body">
          <div class="public-card" style="text-align: center;">
            <div style="color: #EF4444; font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-triangle-exclamation"></i></div>
            <h2 style="color: #ffffff; margin-bottom: 0.5rem;">Ekipman Bulunamadı</h2>
            <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 2rem;">
              "${serialNumber}" seri numaralı Kişisel Koruyucu Donanım sistem envanterinde kayıtlı değildir. Lütfen seri numarasını kontrol ediniz.
            </p>
          </div>
        </div>
      `;
    }

    const doc = snapshotItem.docs[0];
    const item = { id: doc.id, ...doc.data() } as KkdItem;
    
    // Fetch inspections
    const inspectCol = collection(db, 'kkd_inspections');
    const qInspect = query(inspectCol, where('itemId', '==', item.id));
    const snapshotInspect = await getDocs(qInspect);
    const logs = snapshotInspect.docs.map(d => ({ id: d.id, ...d.data() } as KkdInspection));
    // Sort in memory descending by inspectionDate
    logs.sort((a, b) => b.inspectionDate.localeCompare(a.inspectionDate));

    // Determine status
    const todayStr = new Date().toISOString().split('T')[0];
    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);
    
    let displayStatus: 'OK' | 'OVERDUE' | 'REJECT' | 'RETIRED' = item.status;
    let statusText = 'KULLANIMA UYGUN';
    let statusClass = 'ok';
    let statusIcon = '<i class="fa-solid fa-shield-check" style="font-size: 2.5rem;"></i>';

    if (item.status === 'REJECT') {
      statusText = 'KULLANIMA UYGUN DEĞİL (RED)';
      statusClass = 'reject';
      statusIcon = '<i class="fa-solid fa-circle-xmark" style="font-size: 2.5rem;"></i>';
    } else if (item.status === 'RETIRED') {
      statusText = 'EMEKLİ / HURDAYA AYRILMIŞ';
      statusClass = 'retired';
      statusIcon = '<i class="fa-solid fa-trash-can" style="font-size: 2.5rem;"></i>';
    } else if (!item.lastInspectionDate) {
      displayStatus = 'OVERDUE';
      statusText = 'KONTROL BEKLİYOR';
      statusClass = 'overdue';
      statusIcon = '<i class="fa-solid fa-triangle-exclamation" style="font-size: 2.5rem;"></i>';
    } else if (item.nextInspectionDate && item.nextInspectionDate <= todayStr) {
      displayStatus = 'OVERDUE';
      statusText = 'PERİYODİK KONTROLÜ GECİKMİŞ';
      statusClass = 'overdue';
      statusIcon = '<i class="fa-solid fa-calendar-warning" style="font-size: 2.5rem;"></i>';
    } else if (lifeInfo.expired) {
      statusText = 'KULLANIM ÖMRÜ DOLDU';
      statusClass = 'reject';
      statusIcon = '<i class="fa-solid fa-hourglass-end" style="font-size: 2.5rem;"></i>';
    }

    const formatDisplayDate = (val: string | undefined) => {
      if (!val) return '---';
      if (val.length === 7) {
        const [y, m] = val.split('-');
        return `${m}.${y}`;
      }
      const dateObj = new Date(val);
      if (isNaN(dateObj.getTime())) return val;
      return dateObj.toLocaleDateString('tr-TR');
    };

    // Last inspection details
    const lastLog = logs[0];
    let checklistHtml = '';
    if (lastLog && lastLog.checklist && Object.keys(lastLog.checklist).length > 0) {
      checklistHtml = `
        <div class="section-subtitle-pub">Son Muayene Kontrol Listesi</div>
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px;">
          <table class="chk-table">
            ${Object.entries(lastLog.checklist).map(([key, value]) => {
              const label = CHECKLIST_LABELS[key] || key;
              return `
                <tr>
                  <td style="color:#e2e8f0; text-align:left;">${label}</td>
                  <td style="width: 60px; font-weight:bold; text-align:right; color:${value ? '#10B981' : '#EF4444'};">
                    ${value ? 'TAM' : 'UYSUZ'}
                  </td>
                </tr>
              `;
            }).join('')}
          </table>
        </div>
      `;
    }

    // Timeline logs html
    const historyHtml = logs.map(l => {
      let lClass = 'ok';
      let lText = 'Kullanıma Uygun';
      if (l.status === 'REJECT') { lClass = 'reject'; lText = 'Reddedildi'; }
      else if (l.status === 'RETIRED') { lClass = 'retired'; lText = 'Hurdaya Ayrıldı'; }
      return `
        <div class="pub-timeline-item ${lClass}">
          <div style="font-size: 0.7rem; color: #94a3b8; font-weight: bold; margin-bottom: 2px;">
            ${new Date(l.inspectionDate).toLocaleDateString('tr-TR')}
          </div>
          <div class="pub-timeline-card">
            <div style="display:flex; justify-content:space-between; font-size:0.75rem; margin-bottom:4px;">
              <span style="color:#00f3ff; font-weight:bold;">${l.inspector}</span>
              <span style="font-weight:bold; color:${l.status === 'OK' ? '#10B981' : l.status === 'REJECT' ? '#EF4444' : '#64748B'};">${lText}</span>
            </div>
            <div style="font-size:0.75rem; color:#e2e8f0; line-height:1.3;">${l.notes || 'Açıklama girilmedi.'}</div>
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="public-body">
        <div class="public-card">
          <div class="public-logo-header">
            <!-- Inline SVG Logo -->
            <svg width="36" height="36" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect width="50" height="50" rx="8" fill="#002D6B"/>
              <text x="25" y="36" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="900" font-size="34" text-anchor="middle" letter-spacing="-2">dh</text>
            </svg>
            <div>
              <h2 style="font-size: 1rem; margin: 0; font-weight: 900; letter-spacing: 0.5px; color: #00f3ff;">DEMİRER HOLDİNG</h2>
              <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: bold;">KKD Periyodik Muayene Bilgi Kartı</div>
            </div>
          </div>

          <div class="status-badge-lg ${statusClass}">
            ${statusIcon}
            <span>${statusText}</span>
          </div>

          <div class="section-subtitle-pub">Ekipman Künye Bilgileri</div>
          <div>
            <div class="field-row">
              <div class="field-label">Ekipman Tipi</div>
              <div class="field-value" style="color: #00f3ff;">${item.name}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Seri Numarası (S/N)</div>
              <div class="field-value">${item.serialNumber}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Marka / Model</div>
              <div class="field-value">${item.brandModel}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Üretim Tarihi</div>
              <div class="field-value">${formatDisplayDate(item.manufactureDate)}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Kullanım Ömrü</div>
              <div class="field-value ${lifeInfo.expired ? 'text-red' : ''}" style="color:${lifeInfo.expired ? '#EF4444' : '#10B981'};">
                ${lifeInfo.text} (${formatDisplayDate(lifeInfo.expiryDate)} son)
              </div>
            </div>
            <div class="field-row">
              <div class="field-label">Zimmetli Personel</div>
              <div class="field-value">${item.assignedPerson || 'Depo / Atanmamış'}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Son Muayene Tarihi</div>
              <div class="field-value">${formatDisplayDate(item.lastInspectionDate)}</div>
            </div>
            <div class="field-row">
              <div class="field-label">Sonraki Muayene Tarihi</div>
              <div class="field-value" style="color:${displayStatus === 'OVERDUE' ? '#EF4444' : '#00f3ff'}; font-weight:900;">
                ${formatDisplayDate(item.nextInspectionDate)}
              </div>
            </div>
          </div>

          ${checklistHtml}

          ${historyHtml ? `
            <div class="section-subtitle-pub">Muayene Geçmişi</div>
            <div class="pub-timeline" style="margin-top: 10px;">
              ${historyHtml}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  } catch (err) {
    console.error('KKD sorgulama hatası:', err);
    return `
      <div class="public-body">
        <div class="public-card" style="text-align: center;">
          <div style="color: #EF4444; font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-bug"></i></div>
          <h2 style="color: #ffffff; margin-bottom: 0.5rem;">Sistem Hatası</h2>
          <p style="color: #94a3b8; font-size: 0.9rem; line-height: 1.5; margin-bottom: 2rem;">
            Veriler sorgulanırken geçici bir sunucu hatası meydana geldi. Lütfen daha sonra tekrar deneyiniz.
          </p>
          <button class="back-btn" onclick="window.location.reload()">
            <i class="fa-solid fa-rotate-right"></i> Tekrar Dene
          </button>
        </div>
      </div>
    `;
  }
}
