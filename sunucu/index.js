const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { exec } = require('child_process');

const app = express();
app.use(cors());
app.use(express.json());

const ARCHIVE_DIR = 'C:\\Dh_Rapor_Arsivi';
const BACKEND_DIR = 'C:\\Dh_Servis_Backend';
const SERVICE_ACCOUNT_PATH = path.join(BACKEND_DIR, 'serviceAccountKey.json');

function logMessage(msg) {
  const time = new Date().toISOString();
  const logLine = `[${time}] ${msg}\n`;
  console.log(msg);
  try {
    fs.appendFileSync(path.join(ARCHIVE_DIR, 'archive_log.txt'), logLine);
  } catch(e) {}
}

if (!fs.existsSync(ARCHIVE_DIR)) {
  fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
}

app.use('/archive', express.static(ARCHIVE_DIR));

app.get('/status', (req, res) => {
  const reportsDir = path.join(ARCHIVE_DIR, 'Reports');
  res.json({
    status: 'RUNNING',
    archiveCount: fs.existsSync(reportsDir) ? fs.readdirSync(reportsDir).length : 0,
    timestamp: new Date().toISOString()
  });
});

app.get('/resync-reports', async (req, res) => {
  try {
    const snapshot = await db.collection('serviceReports').get();
    let count = 0;
    for (const doc of snapshot.docs) {
      await archiveReport(doc.id, doc.data());
      count++;
    }
    res.json({ status: 'SUCCESS', updatedCount: count, message: `${count} adet servis raporu yeni şablonla yeniden üretildi.` });
  } catch (err) {
    res.status(500).json({ status: 'ERROR', error: err.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  logMessage(`Local archive server running on port ${PORT}`);
});

// --- HELPER FUNCTIONS FOR SHARP AND ELEGANT REPORT TEMPLATE ---
const TURKISH_HOLIDAYS_2026 = [
  '2026-01-01', // Yılbaşı
  '2026-03-19', // Ramazan Bayramı Arifesi (Yarım)
  '2026-03-20', '2026-03-21', '2026-03-22', // Ramazan Bayramı
  '2026-04-23', // Ulusal Egemenlik
  '2026-05-01', // Emek ve Dayanışma
  '2026-05-19', // Gençlik ve Spor
  '2026-05-26', // Kurban Bayramı Arifesi (Yarım)
  '2026-05-27', '2026-05-28', '2026-05-29', '2026-05-30', // Kurban Bayramı
  '2026-07-15', // Demokrasi ve Milli Birlik
  '2026-08-30', // Zafer Bayramı
  '2026-10-28', // Cumhuriyet Bayramı Arifesi (Yarım)
  '2026-10-29'  // Cumhuriyet Bayramı
];

const HALF_DAY_HOLIDAYS_2026 = ['2026-03-19', '2026-05-26', '2026-10-28'];

function isPublicHoliday(date) {
  return TURKISH_HOLIDAYS_2026.includes(date);
}

function isSunday(date) {
  return new Date(date).getDay() === 0;
}

function calculateOvertimeHours(date, start, end, isOffDay) {
  if (!start || !end) return 0;
  
  const isHoliday = isPublicHoliday(date) || isOffDay;
  const isHalfDay = HALF_DAY_HOLIDAYS_2026.includes(date);
  
  const [h1, m1] = start.split(':').map(Number);
  const [h2, m2] = end.split(':').map(Number);
  
  let startMinutes = h1 * 60 + m1;
  let endMinutes = h2 * 60 + m2;
  if (endMinutes < startMinutes) endMinutes += 1440; 

  const totalMinutes = endMinutes - startMinutes;

  if (isHoliday && !isHalfDay) {
      return totalMinutes / 60;
  }

  const normalStart = 8 * 60; // 08:00
  const normalEnd = isHalfDay ? (13 * 60) : (18 * 60); // 13:00 veya 18:00

  const intersectionStart = Math.max(startMinutes, normalStart);
  const intersectionEnd = Math.min(endMinutes, normalEnd);

  let normalMinutes = 0;
  if (intersectionEnd > intersectionStart) {
      normalMinutes = intersectionEnd - intersectionStart;
  }

  const overtimeMinutes = Math.max(0, totalMinutes - normalMinutes);
  return overtimeMinutes / 60;
}

function formatTeamName(teamStr) {
  if (!teamStr) return 'SİSTEM';
  const clean = teamStr.toLowerCase().trim().replace(/_/g, ' ');

  if (clean.includes('hursit.akter') || clean.includes('hurşit akter')) {
    return 'Hurşit AKTER';
  }

  let prefix = clean;
  if (clean.includes('@')) {
    prefix = clean.split('@')[0];
  }

  const teamMatch = prefix.match(/(?:dh-)?tm\s*(\d+)|team\s*(\d+)/i);
  if (teamMatch) {
    const num = parseInt(teamMatch[1] || teamMatch[2]);
    return `Team${String(num).padStart(2, '0')}`;
  }

  const directNum = parseInt(prefix);
  if (!isNaN(directNum) && directNum > 0 && directNum <= 100) {
    return `Team${String(directNum).padStart(2, '0')}`;
  }

  return teamStr;
}

function formatHoursToHm(decimalHours) {
  if (isNaN(decimalHours) || decimalHours <= 0) return '00:00';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hStr}:${mStr}`;
}

function calculateManHours(workSessions, dateStr) {
  let totalRoadHours = 0;
  let totalNormalManHours = 0;
  let totalOvertimeManHours = 0;
  let totalManHours = 0;
  let totalTurbineHours = 0;

  (workSessions || []).forEach(ws => {
    if (!ws.startTime || !ws.endTime) return;
    const [sh, sm] = ws.startTime.split(':').map(Number);
    let [eh, em] = ws.endTime.split(':').map(Number);
    let durationH = (eh + em / 60) - (sh + sm / 60);
    if (durationH < 0) durationH += 24;

    const personnelCount = ws.personnel ? ws.personnel.length : 0;
    const sDate = ws.date || dateStr || new Date().toISOString().split('T')[0];

    if (ws.type === 'ÇALIŞMA' || ws.type === 'WORK' || ws.type === 'BEKLEME') {
      totalTurbineHours += durationH;
    }

    if (ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE' || ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'YOL') {
      totalRoadHours += durationH;
    }

    const ot = calculateOvertimeHours(
      sDate,
      ws.startTime,
      ws.endTime,
      ws.isOffDay || false
    );
    const overtimeH = Math.min(durationH, ot);
    const normalH = Math.max(0, durationH - overtimeH);

    totalNormalManHours += normalH * personnelCount;
    totalOvertimeManHours += overtimeH * personnelCount;
    totalManHours += durationH * personnelCount;
  });

  return {
    turbine: formatHoursToHm(totalTurbineHours),
    travel: formatHoursToHm(totalRoadHours),
    normal: formatHoursToHm(totalNormalManHours),
    overtime: formatHoursToHm(totalOvertimeManHours),
    total: formatHoursToHm(totalManHours)
  };
}

function renderReportPDF(report) {
  const sessions = report.workSessions || [];
  const manHours = calculateManHours(sessions, report.date);
  const checklist = report.checklist || [];
  const hasChecklist = checklist.length > 0;
  
  const okCount = checklist.filter(i => i.status === 'OK').length;
  const notOkCount = checklist.filter(i => i.status === 'NOT_OK').length;
  const naCount = checklist.filter(i => i.status === 'NA').length;
  const totalChecklist = checklist.length;

  const isMaintenance = report.type === 'BAKIM' || 
    (report.reportNo && report.reportNo.startsWith('MR_')) ||
    (report.templateName && report.templateName !== 'Planlı Duruş' && !report.templateName.toLowerCase().includes('arıza'));

  let checklistHtml = '';
  if (hasChecklist) {
    const renderRow = (item, idx) => {
      const isOk = item.status === 'OK';
      const isNa = item.status === 'NA';
      const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
      const statusColor = isOk ? '#16a34a' : (isNa ? '#666666' : '#dc2626');
      const statusBg = isOk ? '#e6f9e8' : (isNa ? '#f5f5f5' : '#fef2f2');
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#fcfcfc';
      
      let advHtml = '';
      if (item.measurementConfig && item.measurementConfig.type !== 'standard' && item.measurementValues && item.measurementValues.length > 0) {
        const type = item.measurementConfig.type;
        const vals = item.measurementValues;
        let details = '';
        
        if (type === 'torque_control') details = `<strong>Değer:</strong> ${vals[0] || '-'} | <strong>İmza:</strong> ${vals[1] || '-'}`;
        else if (type === 'oil_sample') details = `<strong>Numune Alındı:</strong> ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | <strong>Miktar:</strong> ${vals[1] || '-'} | <strong>İmza:</strong> ${vals[2] || '-'}`;
        else if (type === 'oil_level_control') details = `<strong>Seviye:</strong> ${vals[0] || '-'} | <strong>Eklenen:</strong> ${vals[1] || '-'} | <strong>İmza:</strong> ${vals[2] || '-'}`;
        else if (type === 'filter_change') details = `<strong>Değişti:</strong> ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | <strong>Temizlendi:</strong> ${vals[1] === 'true' ? 'Evet' : 'Hayır'} | <strong>İmza:</strong> ${vals[2] || '-'}`;
        else if (type === 'signature_approval') details = `<strong>İmza/Onay:</strong> ${vals[0] || '-'}`;
        else if (type === 'crane_control') details = `<strong>Vinç Tipi:</strong> ${vals[0] || '-'} | <strong>Halat Çapı:</strong> ${vals[1] || '-'} mm | <strong>Kopuk:</strong> (30:${vals[2]||'0'}, 60:${vals[3]||'0'}, 300:${vals[4]||'0'}) | <strong>İmza:</strong> ${vals[5] || '-'}`;
        else if (type === 'safety_equipment_control') details = `<strong>Son Kontrol (Ay/Yıl):</strong> ${vals[0] || '-'} | <strong>Eksiksiz/Hasarsız:</strong> ${vals[1] === 'true' ? 'Evet' : 'Hayır'} | <strong>İmza:</strong> ${vals[2] || '-'}`;
        else if (type === 'bearing_control') details = `<strong>Numune Alındı:</strong> ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | <strong>ÖN Gres:</strong> ${vals[1] || '-'} | <strong>ARKA Gres:</strong> ${vals[2] || '-'} | <strong>İmza:</strong> ${vals[3] || '-'}`;
        else if (type === 'final_checkout_control') {
            details = `
                <div style="font-weight: 700; margin-bottom: 2px;">Bakım Sonu Final Kontrolü:</div>
                <div style="margin-left: 8px;">
                    <div>${vals[0] === 'true' ? '☑' : '☐'} Türbin içinde, kulede veya çevresinde hiçbir el aleti, malzeme, atık bez veya çöp bırakılmamıştır.</div>
                    <div>${vals[1] === 'true' ? '☑' : '☐'} Tespit edilen tüm hasarlar, arızalar ve eksiklikler servis raporuna eksiksiz olarak işlenmiştir.</div>
                    <div>${vals[2] === 'true' ? '☑' : '☐'} Makine dairesinde ve kule tabanındaki tüm elektrik panoları/kapakları güvenli bir şekilde kapatılmıştır.</div>
                    <div>${vals[3] === 'true' ? '☑' : '☐'} Türbin çalıştırılıp dinleme testi yapılmış olup olağandışı bir ses veya titreşim olmadan tamamlanmıştır.</div>
                    <div>${vals[4] === 'true' ? '☑' : '☐'} Türbin devreye alınmıştır ve türbin defterine ilgili bakım talimatı ve açıklamalar yazılmıştır.</div>
                </div>
                <div style="margin-top: 4px;"><strong>Sorumlu İmza:</strong> ${vals[5] || '-'}</div>
            `;
        }
        else if (type === 'numeric_multiple') {
            const labels = item.measurementConfig.measurementLabels || [];
            details = vals.map((v, i) => {
                if (item.measurementConfig.requireSignature && i === vals.length - 1 && vals.length > item.measurementConfig.inputCount) return `<strong>İmza:</strong> ${v || '-'}`;
                return `<strong>${labels[i] || 'Ölçüm '+(i+1)}:</strong> ${v || '-'}`;
            }).join(' | ');
        }
        else if (type === 'version_control') {
            const items = item.measurementConfig.versionItems || [];
            details = vals.map((v, i) => `<strong>${items[i]?.label || 'Kart '+(i+1)}:</strong> ${v || '-'}`).join('<br>');
        }
        else if (type === 'dropdown') {
            details = `<strong>Seçim:</strong> ${vals[0] || '-'}`;
        }
        if (details) advHtml = `<div style="margin-top: 4px; padding: 4px 6px; background: rgba(0,85,170,0.06); border: 1px solid rgba(0,85,170,0.1); border-radius: 4px; font-size: 0.96rem; color: #004488;">${details}</div>`;
      }

      return `
        <tr style="background: ${rowBg}; page-break-inside: avoid;">
          <td style="border: 1px solid #bbb; padding: 3px; text-align: center; font-weight: 700; color: #555;">${(idx + 1).toString().padStart(2, '0')}</td>
          <td style="border: 1px solid #bbb; padding: 3px 6px; font-weight: ${item.status === 'NOT_OK' ? '700' : '400'};${item.status === 'NOT_OK' ? ' color: #b91c1c;' : ''}">
            ${item.text}
            ${advHtml}
          </td>
          <td style="border: 1px solid #bbb; padding: 3px; text-align: center;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 1px 6px; border-radius: 3px; font-weight: 800; font-size: 0.96rem; border: 1px solid ${statusColor}33;">${statusLabel}</span>
          </td>
          <td style="border: 1px solid #bbb; padding: 3px 6px; font-size: 1.02rem; color: ${item.status === 'NOT_OK' ? '#b91c1c' : '#666'}; font-style: ${item.comment ? 'normal' : 'italic'};">
            ${item.comment || '-'}
          </td>
        </tr>`;
    };

    checklistHtml += `<div style="padding-top: 5px;">`;
    
    checklistHtml += `
      <div style="page-break-before: always; break-before: page; text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 1.32rem; margin: 0 0 2px; font-weight: 900; letter-spacing: 1px;">BAKIM KONTROL LİSTESİ</h1>
        <div style="font-size: 1.02rem; color: #555;">${report.templateName || ''} | Rapor No: <strong>${report.reportNo}</strong> | Türbin: <strong>${report.turbineNo}</strong> (${report.turbineSerial}) | Saha: <strong>${report.siteName}</strong> | Tarih: <strong>${new Date(report.date).toLocaleDateString('tr-TR')}</strong></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 1.08rem;">
        <tr>
          <td style="width: 33.3%; padding: 0 3px 0 0;">
            <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #16a34a; text-transform: uppercase;">Tamamlandı: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #15803d;">${okCount} / ${totalChecklist}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 2px;">
            <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626; text-transform: uppercase;">Tamamlanmadı: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #b91c1c;">${notOkCount}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 0 0 3px;">
            <div style="background: #f5f5f5; border: 1px solid #aaa; border-radius: 4px; padding: 4px 8px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #666; text-transform: uppercase;">Opsiyon Dışı: </span>
              <span style="font-size: 1.2rem; font-weight: 900; color: #555;">${naCount}</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="margin-bottom: 8px;">
        <div style="background: #e8ecf1; padding: 4px 12px; font-weight: 800; font-size: 1.14rem; border: 1px solid #bbb; border-bottom: none;">
          BAKIM DENETİM LİSTESİ
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem;">
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 4px; width: 30px; font-weight: 700; text-align: center;">NO</th>
            <th style="border: 1px solid #bbb; padding: 4px; text-align: left; font-weight: 700;">KONTROL MADDESİ</th>
            <th style="border: 1px solid #bbb; padding: 4px; width: 110px; font-weight: 700; text-align: center;">DURUM</th>
            <th style="border: 1px solid #bbb; padding: 4px; width: 180px; font-weight: 700; text-align: left;">AÇIKLAMA</th>
          </tr>`;
          
    checklist.forEach((item, i) => {
      checklistHtml += renderRow(item, i);
    });
    
    checklistHtml += `</table></div>`;
    
    if (notOkCount > 0) {
      checklistHtml += `
        <div style="margin-bottom: 12px; page-break-inside: avoid;">
          <div style="background: #fef2f2; padding: 4px 12px; font-weight: 800; font-size: 1.14rem; border: 1px solid #ef4444; border-bottom: none; color: #b91c1c;">
            🚨 ANALİZ VE BULGULAR (${notOkCount})
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ef4444; font-size: 1.08rem;">
            <tr style="background: #fef2f2;">
              <th style="border: 1px solid #ef4444; padding: 4px; width: 30px; font-weight: 700; text-align: center;">NO</th>
              <th style="border: 1px solid #ef4444; padding: 4px; text-align: left; font-weight: 700;">Kontrol Maddesi</th>
              <th style="border: 1px solid #ef4444; padding: 4px; text-align: left; font-weight: 700;">Tamamlanamama Nedeni / Arıza Bulgusu</th>
            </tr>
            ${checklist.filter(item => item.status === 'NOT_OK').map((item) => {
              const originalIndex = checklist.indexOf(item);
              return `
                <tr style="background: #fff; page-break-inside: avoid;">
                  <td style="border: 1px solid #ef4444; padding: 4px; text-align: center; font-weight: 800; color: #b91c1c;">${(originalIndex + 1).toString().padStart(2, '0')}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px; font-weight: 600;">${item.text}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px; color: #b91c1c; font-weight: 500;">${item.comment || 'Açıklama girilmemiş'}</td>
                </tr>`;
            }).join('')}
          </table>
        </div>`;
    } else {
      checklistHtml += `
        <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 8px; padding: 15px; text-align: center; margin-bottom: 12px; page-break-inside: avoid;">
          <div style="font-size: 1.56rem; margin-bottom: 4px;">✅</div>
          <div style="font-weight: 700; color: #15803d; font-size: 1.2rem;">Tüm maddeler başarıyla tamamlandı.</div>
          <div style="font-size: 1.02rem; color: #16a34a;">Olumsuz bir bulguya rastlanmadı.</div>
        </div>`;
    }
    checklistHtml += `</div>`;
  }
  
  let ohsHtml = '';
  if (report.ohsData) {
    const ohsList = Array.isArray(report.ohsData) ? report.ohsData : (report.ohsData.q1 ? [report.ohsData] : []);
    
    if (ohsList.length > 0) {
      ohsHtml = ohsList.map((ohs, dayIndex) => {
        const questions = [
          "Türbinde yapacağım bakım/arıza çalışması öncesinde kullanmam gereken temel kişisel koruyucu donanımlarımı (Baret, İş ayakkabısı, emniyet kemeri, Lanyard, runner) kontrol ettim.",
          "Bakım/arıza öncesinde yanımda bulundurmam gereken ilave ekipmanları (Göz duşu, koruyucu gözlük, kulak koruyucu, toz maskesi, tam yüz maske, yangın söndürme cihazı, ilkyardım çantası, “Dikkat bakım var” levhası) yanıma aldım.",
          "Adam kurtarma seti kullanıma hazır şekilde türbine çıkarılacaktır.",
          "Bakım/arıza öncesinde Acil duruma yönelik diğer iletişim araçları (telsiz) kontrol ettim, yanıma aldım.",
          "Türbinde yapacağım faaliyet süresince, aldığım İSG eğitimleri ve tarafıma tebliğ edilmiş talimatlarda (DH-TA-005, BA_bl_1001 ve diğer Enercon talimatları) bahsedilen konulara azami dikkat göstererek çalışılması konusunda ekip arkadaşlarımı bilgilendirdim."
        ];

        let itemsHtml = '';
        questions.forEach((q, index) => {
          const i = index + 1;
          const name = ohs[`q${i}Name`] || '';
          const note = ohs[`q${i}Note`] || '';
          
          itemsHtml += `
            <tr style="background: ${index % 2 === 0 ? '#fff' : '#fafbfd'};">
              <td style="border: 1px solid #bbb; padding: 6px; font-weight: 700; text-align: center; color: #555;">${i}</td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-size: 1.08rem;">${q}</td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-weight: 700; text-align: center; color: #16a34a;">${name} <br><span style="font-size: 0.75rem; color:#555;">(Onaylandı)</span></td>
              <td style="border: 1px solid #bbb; padding: 6px 10px; font-size: 1.08rem; color: #cc0000; font-style: ${note ? 'normal' : 'italic'};">${note || '-'}</td>
            </tr>
          `;
        });

        let dateStr = ohs.date;
        if (dateStr) {
          const parts = dateStr.split('-');
          if (parts.length === 3) dateStr = `${parts[2]}.${parts[1]}.${parts[0]}`;
        }

        return `
            <table class="ohs-table-block" style="page-break-before: always; break-before: page; width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem; margin-top: 5px; margin-bottom: 20px;">
              <tr>
                <td colspan="4" style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb;">${dayIndex + 1}. GÜN İSG VE SAHA GÜVENLİK ONAYLARI</td>
              </tr>
              <tr>
                <td colspan="4" style="background: #e8ecf1; padding: 0; border: 1px solid #bbb; text-align: right; font-weight: 800; font-size: 1.2rem;">
                  <div style="padding: 0 12px 6px; text-align: right;">${dateStr || ''}</div>
                </td>
              </tr>
              <tr style="background: #f5f7fa;">
                <th style="border: 1px solid #bbb; padding: 6px; width: 30px; font-weight: 700; text-align: center;">NO</th>
                <th style="border: 1px solid #bbb; padding: 6px; font-weight: 700; text-align: left;">İSG KONTROL MADDESİ</th>
                <th style="border: 1px solid #bbb; padding: 6px; width: 140px; font-weight: 700; text-align: center;">ONAYLAYAN PERSONEL</th>
                <th style="border: 1px solid #bbb; padding: 6px; width: 160px; font-weight: 700; text-align: left;">EKLENEN NOT / SORUN</th>
              </tr>
              ${itemsHtml}
            </table>
          `;
      }).join('');
    }
  }

  const reportsTitleText = isMaintenance ? 'BAKIM RAPORU' : 'ARIZA RAPORU';

  return `
    <div id="pdf-container" style="background: #fff; color: #000; padding: 10px 20px; width: 100%; min-width: 820px; max-width: none; box-sizing: border-box; margin: 0 auto; font-family: Arial, sans-serif;">
      
      <style>
        @media print {
          .no-print, button, .btn-cyber, .cyber-button, nav, .menu, #sidebar {
            display: none !important;
          }

          body, html {
            width: 100%;
            margin: 0;
            padding: 0;
          }

          #pdf-container {
            width: 100%;
            margin: 0 auto;
            padding: 0;
          }

          tr, td, th, img, .info-card, .chart-container, .scada-data, .pdf-no-break, .report-section {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          table {
            display: table;
            width: 100%;
            border-collapse: collapse;
          }

          .section-break {
            page-break-before: always;
            break-before: page;
          }
        }

        #pdf-container table { display: table; width: 100%; border-collapse: collapse; min-width: 0 !important; }
        #pdf-container table tr { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container table th, #pdf-container table td { word-wrap: break-word; }
        #pdf-container .pdf-no-break { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container .report-section { page-break-inside: avoid; break-inside: avoid; }
      </style>

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #002d6b; padding-bottom: 15px;">
        <div style="display: flex; gap: 15px; align-items: center;">
            <div style="flex-shrink: 0; width: 70px; height: 70px; background-color: #002d6b; border-radius: 10px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <span style="font-family: Arial, sans-serif; font-weight: 900; font-size: 44px; color: #ffffff; letter-spacing: -3px; line-height: 1; display: inline-block; margin-top: -2px;">dh</span>
            </div>
          <div>
            <h1 style="font-size: 1.6rem; margin: 0 0 4px; font-weight: 900; letter-spacing: 0.5px; color: #002d6b;">DEMİRER HOLDİNG</h1>
            <div style="font-size: 1.1rem; color: #555; font-weight: 700;">TEKNİK SERVİS ${reportsTitleText}</div>
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 1.2rem; font-weight: 800; color: #cc0000; margin-bottom: 4px;">Rapor No: ${report.reportNo}</div>
          <div style="font-size: 0.95rem; color: #666; font-weight: 600;">Tarih: ${new Date(report.date).toLocaleDateString('tr-TR')}</div>
          ${report.templateName ? `<div style="font-size: 0.85rem; color: #888; margin-top: 4px; max-width: 250px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${report.templateName}</div>` : ''}
        </div>
      </div>

      <!-- SERVİS AYRINTILARI -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          SERVİS AYRINTILARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.98rem;">
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; width: 15%; background: #f5f7fa; font-weight: 700;">Tarih</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; width: 35%;">${new Date(report.date).toLocaleDateString('tr-TR')}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; width: 15%; background: #f5f7fa; font-weight: 700;">Bölge / Saha</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; width: 35%;">${report.siteName}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Türbin Seri No</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px;">${report.turbineSerial}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Türbin No</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px;">${report.turbineNo}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Planlı Kontrol' : (isMaintenance ? 'Bakım Türü' : 'Arıza Kodu');
            })()}</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Planlı Duruş' : (isMaintenance ? (report.templateName || (report.faultCode !== '-' ? report.faultCode : '') || 'Bakım') : (report.faultCode || '-'));
            })()}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Ekip</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${formatTeamName(report.team)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Açıklama' : (isMaintenance ? 'Bakım Talimatı' : 'Arıza Tanımı');
            })()}</th>
            <td colspan="3" style="border: 1px solid #bbb; padding: 7px 10px; font-size: 1.14rem;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              if (isPlanli) {
                return report.faultDesc || 'Planlı Duruş';
              }
              if (isMaintenance) {
                let code = report.instructionCode || report.templateInstructionCode || '';
                if (!code) {
                  const norm = ((report.templateName || '') + ' ' + (report.faultCode || '') + ' ' + (report.faultDesc || '')).toLowerCase();
                  if (norm.includes('e82/e2') || norm.includes('e82-e2') || (norm.includes('e82') && norm.includes('e2'))) {
                    if (norm.includes('ana')) code = 'D0847069/8.0-tr/DC';
                    else code = 'TD-esc-08-de-tr-11-002 Rev004';
                  } else if (norm.includes('e82')) {
                    if (norm.includes('ana')) code = 'D0847068/8.0-tr/DC';
                    else code = 'TD-esc-08-de-tr-14-018 Rev003';
                  } else if (norm.includes('e70')) {
                    if (norm.includes('ana')) code = 'D0847062/8.0-tr';
                    else code = 'TD-esc-08-de-tr-10-052 Rev005';
                  } else if (norm.includes('e44') || norm.includes('e48') || norm.includes('e-44')) {
                    if (norm.includes('yaglama') || norm.includes('yağlama')) {
                      code = 'TD-esc-08-de-tr-11-017 Rev004 Yağlama bakımı E-44, E-48, E-53';
                    } else if (norm.includes('ana')) {
                      code = 'TD-esc-08-de-tr-15-090 Rev011 Ana bakım E-44 - E48 (CS48a)';
                    }
                  } else if (norm.includes('jenerat')) {
                    code = 'TD-esc-03-de-tr-15-009 Rev001';
                  }
                }
                return code || (report.faultDesc && report.faultDesc !== 'Genel Görev' ? report.faultDesc : '-');
              }
              return report.faultDesc || '-';
            })()}</td>
          </tr>
        </table>
      </div>

      <!-- ÇALIŞMA ZAMANLARI -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          ÇALIŞMA ZAMANLARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.14rem; text-align: center;">
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Kayıt Türü</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Personel</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Tarih</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Başlangıç</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Bitiş</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Süre</th>
            <th style="border: 1px solid #bbb; padding: 7px; font-weight: 700;">Açıklama / Not</th>
          </tr>
          ${sessions.length > 0 ? sessions.filter(s => s.startTime && s.endTime).map(session => {
            const personnelList = Array.isArray(session.personnel) ? session.personnel.join(', ') : (session.personnel || '-');
            const typeLabel = session.type === 'TRAVEL' || session.type === 'YOL' ? 'YOL' : 'ÇALIŞMA';
            return `
              <tr>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${typeLabel}</td>
                <td style="border: 1px solid #bbb; padding: 6px;">${personnelList}</td>
                <td style="border: 1px solid #bbb; padding: 6px;">${session.date ? new Date(session.date).toLocaleDateString('tr-TR') : '-'}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${session.startTime || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 600;">${session.endTime || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 6px; font-weight: 700; color: #0055aa;">${session.duration || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 6px; text-align: left; font-size: 1.08rem;">${session.note || session.comment || '-'}</td>
              </tr>
            `;
          }).join('') : `
            <tr><td colspan="7" style="border: 1px solid #bbb; padding: 15px; color: #999;">Çalışma kaydı bulunmamaktadır.</td></tr>
          `}
        </table>

        <!-- Adam-Saat Özeti -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; border-top: none; font-size: 1.14rem; text-align: center;">
          <tr style="background: #eaeff5;">
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Türbin Süresi</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Yol Süresi</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Normal Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Mesai Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 8px; font-weight: 700;">Toplam Adam-Saat</th>
          </tr>
          <tr>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.turbine}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.travel}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #0055aa;">${manHours.normal}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 800; color: #cc6600;">${manHours.overtime}</td>
            <td style="border: 1px solid #bbb; padding: 8px; font-weight: 900; color: #006633;">${manHours.total}</td>
          </tr>
        </table>
      </div>

      <!-- YAPILAN İŞLEMLER VE FOTOĞRAFLAR -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none;">
          YAPILAN İŞLEMLER VE FOTOĞRAFLAR
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.98rem;">
          <tr>
            <td style="border: 1px solid #bbb; padding: 15px; vertical-align: top; width: 50%; min-height: 100px;">
              <div style="font-weight: 700; font-size: 1.08rem; color: #555; margin-bottom: 6px;">YAPILAN İŞLEMLER / NOTLAR</div>
              <div style="white-space: pre-wrap;">${report.notes || '<span style="color: #999;">Not girilmemiştir.</span>'}</div>
            </td>
            <td style="border: 1px solid #bbb; padding: 15px; vertical-align: top; width: 50%;">
              <div style="font-weight: 700; font-size: 1.08rem; color: #555; margin-bottom: 6px;">FOTOĞRAFLAR</div>
              ${report.imageUrls && report.imageUrls.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px;">
                  ${report.imageUrls.map((url, idx) => {
                    const cleanSite = String(report.siteName || 'Genel').replace(/[\/\\:*?"<>|]/g, '-').trim();
                    const isMaint = report.type === 'BAKIM';
                    const catFolder = isMaint ? 'Bakımlar' : 'Arızalar';
                    return `
                      <img src="../../../Images/${cleanSite}/${catFolder}/${report.reportNo}_image_${idx + 1}.jpg" style="width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;">
                    `;
                  }).join('')}
                </div>
              ` : '<span style="color: #999;">Fotoğraf eklenmemiştir.</span>'}
            </td>
          </tr>
        </table>
      </div>

      <!-- MALZEME YÖNETİMİ -->
      <div class="report-section" style="margin-bottom: 20px;">
        <div style="background: #e8ecf1; padding: 6px 12px; font-weight: 800; font-size: 1.2rem; border: 1px solid #bbb; border-bottom: none; display: flex; justify-content: space-between; align-items: center;">
          <span>MALZEME YÖNETİMİ</span>
          <span style="font-weight: 600; font-size: 1.14rem;">MÇF No: <strong style="color: #cc0000;">${report.matFormNo || '-'}</strong></span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 1.08rem; text-align: center;">
          <tr style="background: #f5f7fa; font-size: 0.8rem; line-height: 1.1;">
            <th style="border: 1px solid #bbb; padding: 6px 2px; width: 35px; font-weight: 700; vertical-align: middle;">POZ</th>
            <th style="border: 1px solid #bbb; padding: 6px 2px; width: 30px; font-weight: 700; vertical-align: middle;">S/T</th>
            <th style="border: 1px solid #bbb; padding: 6px 2px; width: 85px; font-weight: 700; vertical-align: middle;">SAP NO</th>
            <th style="border: 1px solid #bbb; padding: 6px 2px; width: 100px; font-weight: 700; vertical-align: middle;">SERİ NO</th>
            <th style="border: 1px solid #bbb; padding: 6px 8px; text-align: left; font-weight: 700; vertical-align: middle;">MALZEME AÇIKLAMASI</th>
            <th style="border: 1px solid #bbb; padding: 6px 2px; width: 80px; font-weight: 700; vertical-align: middle;">ADET</th>
          </tr>
          ${(report.materials || []).length > 0 ? (report.materials || []).map(mat => `
            <tr>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700;">${mat.poz}</td>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700; color: ${mat.type === 'S' ? '#cc0000' : '#006633'};">${mat.type}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.sapNo}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.serialNo || '-'}</td>
              <td style="border: 1px solid #bbb; padding: 5px; text-align: left;">${mat.description}</td>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700;">${mat.type === 'S' ? (mat.defectCount || 0) : (mat.used || 0)}</td>
            </tr>
          `).join('') : `
            <tr><td colspan="6" style="border: 1px solid #bbb; padding: 15px; color: #999;">Malzeme kaydı bulunmamaktadır.</td></tr>
          `}
        </table>
      </div>

      ${ohsHtml}
      ${checklistHtml}

      <!-- Footer -->
      <div style="margin-top: 30px; padding-top: 15px; border-top: 1px solid #bbb; display: flex; justify-content: space-between; font-size: 1.02rem; color: #999;">
        <span>DH Servis | Demirer Holding</span>
        <span>Oluşturulma: ${new Date(report.date).toLocaleDateString('tr-TR')} ${hasChecklist ? '| Sayfa 1-2' : ''}</span>
      </div>

    </div>
  `;
}

if (fs.existsSync(SERVICE_ACCOUNT_PATH)) {
  try {
    const serviceAccount = require(SERVICE_ACCOUNT_PATH);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    
    const db = admin.firestore();
    logMessage('Firebase Admin SDK initialized successfully.');
    
    // 1. SERVİS RAPORLARINI DİNLE
    // Klasör karmaşasını önlemek için ilk açılışta eski Reports klasörünü temizle
    const reportsDir = path.join(ARCHIVE_DIR, 'Reports');
    if (fs.existsSync(reportsDir)) {
      try {
        fs.rmSync(reportsDir, { recursive: true, force: true });
        logMessage('Eski Reports klasoru temizlendi.');
      } catch (e) {
        logMessage(`Eski klasor silme hatasi: ${e.message}`);
      }
    }

    db.collection('serviceReports').onSnapshot(async (snapshot) => {
      for (const change of snapshot.docChanges()) {
        const reportData = change.doc.data();
        const reportId = change.doc.id;
        if (change.type === 'added' || change.type === 'modified') {
          await archiveReport(reportId, reportData);
        } else if (change.type === 'removed') {
          await deleteArchivedReport(reportId, reportData);
        }
      }
    }, (error) => {
      logMessage(`Firestore serviceReports dinleme hatasi: ${error.message}`);
    });

    // 2. DEPOLARI, ENVANTERLERİ VE SAYIMLARI DİNLE
    logMessage('Depolar (warehouses) dinleyicileri baslatiliyor...');
    const WAREHOUSES = [
      { id: '2688', name: 'Anemon İntepe Depo' },
      { id: '3439', name: 'Alize Sarıkaya Depo' },
      { id: '3243', name: 'Alize Çamseki Depo' },
      { id: '2678', name: 'Mare Manastır Depo' },
      { id: '0752', name: 'Alize Germiyan Depo' },
      { id: '2990', name: 'Doğal Sayalar Depo' },
      { id: '3213', name: 'Dares Datça Depo' },
      { id: '3245', name: 'Alize Keltepe Depo' },
      { id: '3793', name: 'Alize Kuyucak Depo' },
      { id: '3892', name: 'Alize Çataltape Depo' },
      { id: 'MTA', name: 'Merkez Tamir Atölyesi Deposu' }
    ];

    WAREHOUSES.forEach((wh) => {
      try {
        const whId = wh.id;
        const rawWhName = wh.name;
        const siteName = getSiteNameFromWarehouse(rawWhName);
        const cleanSiteName = sanitize(siteName);
        const whName = sanitize(rawWhName);

        logMessage(`Depo dinleniyor: ${whName} (${whId}) -> Site: ${cleanSiteName}`);
        const whFolder = path.join(ARCHIVE_DIR, 'Reports', cleanSiteName, 'Depo_Envanteri');
        if (!fs.existsSync(whFolder)) {
          fs.mkdirSync(whFolder, { recursive: true });
        }
        
        const whMetadataFolder = path.join(whFolder, 'metadata');
        if (!fs.existsSync(whMetadataFolder)) {
          fs.mkdirSync(whMetadataFolder, { recursive: true });
        }
        try {
          exec(`attrib +h "${whMetadataFolder}"`);
        } catch (e) {}
        
        fs.writeFileSync(path.join(whMetadataFolder, 'metadata.json'), JSON.stringify(wh, null, 2));

        // Deponun Anlık Stok Durumunu Dinle
        db.collection('warehouses').doc(whId).collection('inventory_v2').onSnapshot((invSnapshot) => {
          try {
            const inventory = [];
            invSnapshot.forEach(doc => {
              inventory.push({ id: doc.id, ...doc.data() });
            });
            fs.writeFileSync(path.join(whMetadataFolder, 'inventory.json'), JSON.stringify(inventory, null, 2));
            generateInventoryHtml(whName, inventory, whFolder);
            logMessage(`Depo envanteri guncellendi: ${whName}`);
          } catch (innerErr) {
            logMessage(`Depo envanter yazma hatasi (${whName}): ${innerErr.message}`);
          }
        }, (error) => {
          logMessage(`Depo envanteri dinleme hatasi (${whName}): ${error.message}`);
        });

        // Deponun Geçmiş Sayımlarını Dinle
        db.collection('warehouses').doc(whId).collection('audits').onSnapshot((auditSnapshot) => {
          try {
            const auditFolder = path.join(whFolder, 'Sayımlar');
            if (!fs.existsSync(auditFolder)) {
              fs.mkdirSync(auditFolder, { recursive: true });
            }
            
            const auditMetadataFolder = path.join(auditFolder, 'metadata');
            if (!fs.existsSync(auditMetadataFolder)) {
              fs.mkdirSync(auditMetadataFolder, { recursive: true });
            }
            try {
              exec(`attrib +h "${auditMetadataFolder}"`);
            } catch (e) {}

            auditSnapshot.docChanges().forEach(change => {
              const auditData = change.doc.data();
              const auditId = change.doc.id;
              if (change.type === 'added' || change.type === 'modified') {
                fs.writeFileSync(path.join(auditMetadataFolder, `${auditId}.json`), JSON.stringify(auditData, null, 2));
                generateAuditHtml(whName, auditId, auditData, auditFolder);
                logMessage(`Depo sayimi arsivlendi: ${whName} -> ${auditId}`);
              } else if (change.type === 'removed') {
                deleteArchivedAudit(whName, auditId, auditData, auditFolder);
              }
            });
          } catch (innerErr) {
            logMessage(`Depo sayimi yazma hatasi (${whName}): ${innerErr.message}`);
          }
        }, (error) => {
          logMessage(`Depo sayimi dinleme hatasi (${whName}): ${error.message}`);
        });
      } catch (err) {
        logMessage(`Depo baslatma hatasi (${wh.name}): ${err.message}`);
      }
    });

  } catch (err) {
    logMessage(`Baslatma hatasi: ${err.message}`);
  }

  function sanitize(val) {
    return String(val || '').replace(/[\/\\:*?"<>|]/g, '-').trim();
  }

  function getSiteNameFromWarehouse(whName) {
    if (!whName) return 'Genel';
    let clean = String(whName).trim();
    if (clean.endsWith(' Deposu')) {
      clean = clean.substring(0, clean.length - 7);
    } else if (clean.endsWith(' Depo')) {
      clean = clean.substring(0, clean.length - 5);
    }
    return clean;
  }

  // Akıllı Türbin Normalleştirici (T-1, T01, 1 -> T01 yapar)
  function normalizeTurbine(turb) {
    let cleanTurb = sanitize(turb).toUpperCase().replace(/[-_ ]/g, '');
    if (cleanTurb === 'GENEL' || !cleanTurb) return 'Genel';
    
    let numPart = cleanTurb;
    if (cleanTurb.startsWith('T')) {
      numPart = cleanTurb.substring(1);
    }
    // Tek basamakli sayilara (1, 2, 7 vb.) basina 0 ekle (T01, T07 yapar)
    if (/^\d$/.test(numPart)) {
      numPart = '0' + numPart;
    }
    return 'T' + numPart;
  }

  function getSiteAbbreviation(siteName, reportNo) {
    if (reportNo) {
      const prefixes = ['AN_IN', 'MR_MN', 'AL_GR', 'AL_KL', 'DR_DT', 'DG_SY', 'AL_KY', 'AL_ÇM', 'AL_SR', 'AL_ÇT', 'BK', 'AR'];
      for (const pref of prefixes) {
        if (reportNo.startsWith(pref)) {
          if (pref === 'AL_SR') return 'AL-SR';
          return pref;
        }
      }
    }

    if (!siteName) return 'GENEL';
    const name = siteName.toLowerCase().trim();
    if (name.includes('germiyan')) return 'AL_GR';
    if (name.includes('manastır') || name.includes('manastir')) return 'MR_MN';
    if (name.includes('i̇ntepe') || name.includes('intepe')) return 'AN_IN';
    if (name.includes('sayalar')) return 'DG_SY';
    if (name.includes('datça') || name.includes('datca')) return 'DR_DT';
    if (name.includes('çamseki') || name.includes('camseki')) return 'AL_ÇM';
    if (name.includes('keltepe')) return 'AL_KL';
    if (name.includes('sarıkaya') || name.includes('sarikaya')) return 'AL-SR';
    if (name.includes('kuyucak')) return 'AL_KY';
    if (name.includes('çataltape') || name.includes('cataltape')) return 'AL_ÇT';
    if (name.includes('atölye') || name.includes('atolye')) return 'MTA';
    return 'GENEL';
  }

  function getReportFilename(report) {
    const isMaintenance = report.type === 'BAKIM';
    const dateParts = (report.date || '').split('-');
    const formattedDate = dateParts.length === 3 ? `${dateParts[0]}.${dateParts[1]}.${dateParts[2]}` : 'TarihBelirsiz';
    const siteCode = getSiteAbbreviation(report.siteName, report.reportNo);
    const turb = normalizeTurbine(report.turbineNo);
    const mcfPart = report.matFormNo && report.matFormNo !== '-' ? `-(MÇF ${sanitize(report.matFormNo)})` : '';

    let filename = '';
    if (isMaintenance) {
      // 2026.06.08-AL-SR-T02-Yaglama bakimi (MÇF 904)
      const mainName = sanitize(report.templateName || 'Bakim Raporu');
      filename = `${formattedDate}-${siteCode}-${turb}-${mainName}${mcfPart}`;
    } else {
      // 2026.07.16-AN_IN-T02-(91-12)-Semiconductor fuse blown - Rectifier system 2 - Fault-(MÇF 923)
      const desc = sanitize(report.faultDesc || 'Ariza Raporu');
      const codePart = report.faultCode ? `-(${sanitize(report.faultCode)})` : '';
      filename = `${formattedDate}-${siteCode}-${turb}${codePart}-${desc}${mcfPart}`;
    }
    // Clean up consecutive spaces and trim
    return filename.replace(/\s+/g, ' ').trim();
  }

  async function archiveReport(reportId, data) {
    try {
      // Manuel planlama bakımlarını arşive kaydetmiyoruz
      const templateName = data.templateName || '';
      if (templateName.toLowerCase().includes('manuel')) {
        return;
      }

      const site = sanitize(data.siteName || 'Genel');
      const safeTurb = normalizeTurbine(data.turbineNo);
      const rNo = sanitize(data.reportNo || reportId);
      const isMaintenance = data.type === 'BAKIM';
      const categoryFolder = isMaintenance ? 'Bakımlar' : 'Arızalar';

      // We group reports inside Reports/{Site}/{Category}/
      const reportFolder = path.join(ARCHIVE_DIR, 'Reports', site, categoryFolder);
      if (!fs.existsSync(reportFolder)) {
        fs.mkdirSync(reportFolder, { recursive: true });
      }

      // Subfolder for metadata to keep the main category folder clean
      const metadataFolder = path.join(ARCHIVE_DIR, 'Metadata', site, categoryFolder);
      if (!fs.existsSync(metadataFolder)) {
        fs.mkdirSync(metadataFolder, { recursive: true });
      }

      // Subfolder for images to keep the main category folder clean
      const imagesFolder = path.join(ARCHIVE_DIR, 'Images', site, categoryFolder);
      if (!fs.existsSync(imagesFolder)) {
        fs.mkdirSync(imagesFolder, { recursive: true });
      }

      // Metadata file is uniquely named to avoid conflict
      const metaName = `metadata_${rNo}.json`;
      const metaPath = path.join(metadataFolder, metaName);

      // Clean up old descriptive HTML / PDF file if it exists and metadata changed
      if (fs.existsSync(metaPath)) {
        try {
          const oldData = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const oldReport = {
            reportNo: oldData.reportNo || rNo,
            date: oldData.date || '-',
            templateName: oldData.templateName || '',
            type: oldData.type || 'ARIZA',
            siteName: oldData.siteName || site,
            turbineNo: oldData.turbineNo || safeTurb,
            faultCode: oldData.faultCode || '',
            faultDesc: oldData.faultDesc || '',
            matFormNo: oldData.matFormNo || oldData.mcfNo || '-'
          };
          const oldDescName = getReportFilename(oldReport);
          const oldHtmlPath = path.join(reportFolder, `${oldDescName}.html`);
          if (fs.existsSync(oldHtmlPath)) {
            fs.unlinkSync(oldHtmlPath);
          }
          const oldPdfPath = path.join(reportFolder, `${oldDescName}.pdf`);
          if (fs.existsSync(oldPdfPath)) {
            fs.unlinkSync(oldPdfPath);
          }
        } catch (e) {
          logMessage(`Eski rapor temizleme hatasi: ${e.message}`);
        }
      }

      fs.writeFileSync(metaPath, JSON.stringify(data, null, 2));
      await generateHtmlReport(rNo, site, safeTurb, data, reportFolder);

      if (data.imageUrls && Array.isArray(data.imageUrls)) {
        for (let i = 0; i < data.imageUrls.length; i++) {
          const imageUrl = data.imageUrls[i];
          if (imageUrl && imageUrl.startsWith('http')) {
            const fileName = `${rNo}_image_${i + 1}.jpg`;
            const localPath = path.join(imagesFolder, fileName);
            if (!fs.existsSync(localPath)) {
              await downloadFile(imageUrl, localPath);
            }
          }
        }
      }
    } catch (err) {
      logMessage(`Rapor yedekleme hatasi ${reportId}: ${err.message}`);
    }
  }

  async function deleteArchivedReport(reportId, data) {
    try {
      const site = sanitize(data.siteName || 'Genel');
      const safeTurb = normalizeTurbine(data.turbineNo);
      const rNo = sanitize(data.reportNo || reportId);
      const isMaintenance = data.type === 'BAKIM';
      const categoryFolder = isMaintenance ? 'Bakımlar' : 'Arızalar';
      const reportFolder = path.join(ARCHIVE_DIR, 'Reports', site, categoryFolder);
      
      const metadataFolder = path.join(ARCHIVE_DIR, 'Metadata', site, categoryFolder);
      const metaName = `metadata_${rNo}.json`;
      const metaPath = path.join(metadataFolder, metaName);
      
      const descName = getReportFilename(data);
      
      // Delete PDF
      const pdfPath = path.join(reportFolder, `${descName}.pdf`);
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        logMessage(`Rapor PDF'i silindi (Firestore'dan silindiği için): ${descName}.pdf`);
      }
      
      // Delete temporary HTML
      const htmlPath = path.join(reportFolder, `${descName}.html`);
      if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
      }
      
      // Delete metadata file
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
      
      // Delete downloaded images if they exist
      const imagesFolder = path.join(ARCHIVE_DIR, 'Images', site, categoryFolder);
      if (data.imageUrls && Array.isArray(data.imageUrls)) {
        for (let i = 0; i < data.imageUrls.length; i++) {
          const fileName = `${rNo}_image_${i + 1}.jpg`;
          const localPath = path.join(imagesFolder, fileName);
          if (fs.existsSync(localPath)) {
            fs.unlinkSync(localPath);
          }
        }
      }
    } catch (e) {
      logMessage(`Rapor silme hatası: ${e.message}`);
    }
  }

  // HTML Servis Raporu Sablonu (ELEGANT DESIGN - SAME AS ARCHIVE PREVIEW)
  async function generateHtmlReport(rNo, site, turb, data, folderPath) {
    const report = {
      reportNo: data.reportNo || rNo,
      date: data.date || '-',
      templateName: data.templateName || '',
      type: data.type || 'ARIZA',
      siteName: data.siteName || site,
      turbineSerial: data.turbineSerial || data.turbineSerialNo || '-',
      turbineNo: data.turbineNo || turb,
      faultCode: data.faultCode || '',
      faultDesc: data.faultDesc || '',
      team: data.team || '',
      notes: data.notes || '',
      imageUrls: data.imageUrls || [],
      matFormNo: data.matFormNo || data.mcfNo || '-',
      materials: data.materials || [],
      workSessions: data.workSessions || [],
      checklist: data.checklist || [],
      ohsData: data.ohsData || null
    };

    const bodyContent = renderReportPDF(report);

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Rapor: ${report.reportNo}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #f9f9f9; }
    .print-btn-container { text-align: center; padding: 20px; background: #fafafa; border-bottom: 1px solid #ddd; }
    .print-btn { background: #002d6b; color: #fff; border: none; padding: 10px 25px; font-weight: bold; border-radius: 6px; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
    .print-btn:hover { background: #001f4d; }
    @media print {
      .no-print, .print-btn-container { display: none !important; }
      body { background: #fff; }
    }
  </style>
</head>
<body>
  <div class="print-btn-container no-print">
    <button class="print-btn" onclick="window.print()">Yazdir veya PDF Kaydet</button>
  </div>
  ${bodyContent}
</body>
</html>`;

    // Save with descriptive filename (no more view_report.html since all reports share the same folder)
    const descName = getReportFilename(report);
    const htmlPath = path.join(folderPath, `${descName}.html`);
    const pdfPath = path.join(folderPath, `${descName}.pdf`);

    // Write temp html file
    fs.writeFileSync(htmlPath, html);

    // Convert to PDF using Google Chrome or Microsoft Edge (Headless)
    try {
      const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ];
      
      let browserPath = null;
      for (const p of paths) {
        if (p && fs.existsSync(p)) {
          browserPath = p;
          break;
        }
      }

      if (!browserPath) {
        logMessage(`PDF dönüştürme başarısız: Sunucuda ne Google Chrome ne de Microsoft Edge bulunabildi!`);
        return;
      }

      const cmd = `"${browserPath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;
      
      await new Promise((resolve) => {
        exec(cmd, (error) => {
          if (error) {
            logMessage(`PDF dönüştürme başarısız (Browser): ${error.message}`);
          } else {
            logMessage(`Rapor başarıyla PDF olarak kaydedildi: ${descName}.pdf`);
            // Delete the temporary HTML file so only PDF remains in the folder!
            try {
              if (fs.existsSync(htmlPath)) {
                fs.unlinkSync(htmlPath);
              }
            } catch (unlinkErr) {}
          }
          resolve();
        });
      });
    } catch (e) {
      logMessage(`PDF oluşturma sırasında genel hata: ${e.message}`);
    }
  }

  // HTML Depo Stok Envanter Sablonu
  function generateInventoryHtml(whName, inventory, folderPath) {
    let rows = '';
    inventory.forEach(item => {
      const code = item.sapNo || item.materialCode || '-';
      const qty = item.quantity ?? 0;
      const res = item.reserved ?? 0;
      const avail = item.available ?? (qty - res);
      rows += `
      <tr>
        <td>${code}</td>
        <td>${item.description || '-'}</td>
        <td style="text-align: center; font-weight: bold;">${qty}</td>
        <td style="text-align: center; color: #ff9800;">${res}</td>
        <td style="text-align: center; color: #00c3ff; font-weight: bold;">${avail}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${whName} - Depo Envanteri</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #333; background-color: #f9f9f9; }
    .card { background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 1000px; margin: 0 auto; border-top: 5px solid #00f3ff; }
    h1 { color: #111; margin-bottom: 5px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 14px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px 15px; text-align: left; font-size: 13px; border-bottom: 1px solid #eee; }
    th { background-color: #f5f7fa; color: #555; font-weight: 600; }
    tr:hover { background-color: #fafafa; }
    .print-btn { background: #00f3ff; color: #000; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; display: block; margin: 20px auto 0 auto; }
    @media print {
      body { margin: 0; background: #fff; }
      .card { box-shadow: none; padding: 0; border: none; max-width: 100%; }
      .print-btn { display: none; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${whName} - Depo Envanteri</h1>
    <div class="subtitle">Mevcut Stok Durumu | Son Guncelleme: ${new Date().toLocaleString('tr-TR')}</div>
    <table>
      <thead>
        <tr>
          <th>SAP / Malzeme Kodu</th>
          <th>Malzeme Aciklamasi</th>
          <th style="text-align: center;">Toplam Stok</th>
          <th style="text-align: center;">Rezerv</th>
          <th style="text-align: center;">Kullanilabilir</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="text-align:center; color:#999;">Depoda malzeme bulunmamaktadir.</td></tr>'}
      </tbody>
    </table>
    <button class="print-btn" onclick="window.print()">Yazdir veya PDF Kaydet</button>
  </div>
</body>
</html>`;
    fs.writeFileSync(path.join(folderPath, 'Envanter_Durumu.html'), html);
  }

  // HTML Sayim Rapor Sablonu
  // HTML Sayim Rapor Sablonu
  async function generateAuditHtml(whName, auditId, auditData, folderPath) {
    const date = auditData.date || (auditData.createdAt ? new Date(auditData.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-');
    const auditor = auditData.user || auditData.by || auditData.createdBy || 'Bilinmeyen';
    
    const rawItems = auditData.results || auditData.items || [];
    // Sort items matching UI sorting logic (natural sorting by shelfNo, then by sapNo)
    const sortedItems = [...rawItems].sort((a, b) => {
      const locA = String(a.shelfNo || '').trim().toUpperCase();
      const locB = String(b.shelfNo || '').trim().toUpperCase();
      if (!locA && locB) return 1;
      if (locA && !locB) return -1;
      let locCmp = 0;
      if (locA && locB) {
          locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (locCmp !== 0) return locCmp;
      return String(a.sapNo || '').localeCompare(String(b.sapNo || ''));
    });

    let rows = '';
    sortedItems.forEach(item => {
      const shelf = item.shelfNo || '-';
      const sap = item.sapNo || '-';
      const desc = item.description || '-';
      const sys = item.systemQty ?? 0;
      const phys = item.physicalQty ?? 0;
      const diff = item.diff ?? (phys - sys);
      const note = item.note || '-';
      
      let diffStyle = 'color: #666;';
      if (diff > 0) diffStyle = 'color: #16a34a; font-weight: bold;';
      else if (diff < 0) diffStyle = 'color: #dc2626; font-weight: bold;';
      
      rows += `
      <tr>
        <td style="font-family: monospace; font-weight: bold;">${shelf}</td>
        <td style="font-family: monospace;">${sap}</td>
        <td>${desc}</td>
        <td style="text-align: center;">${sys}</td>
        <td style="text-align: center; font-weight: bold;">${phys}</td>
        <td style="text-align: center; ${diffStyle}">${diff > 0 ? '+' + diff : diff}</td>
        <td style="font-size: 11px; color: #555;">${note}</td>
      </tr>`;
    });

    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Sayim Raporu: ${whName}</title>
  <style>
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 40px; color: #333; background-color: #f9f9f9; }
    .card { background: #fff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); max-width: 100%; margin: 0 auto; border-top: 5px solid #ff9800; }
    h1 { color: #111; margin-bottom: 5px; font-size: 22px; }
    .subtitle { color: #666; margin-bottom: 20px; font-size: 13px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px; }
    .info-box { background: #f5f7fa; padding: 12px 15px; border-radius: 6px; }
    .info-box strong { color: #555; font-size: 11px; display: block; text-transform: uppercase; margin-bottom: 3px; }
    .info-box span { font-size: 14px; font-weight: 600; color: #111; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; table-layout: auto; }
    th, td { padding: 8px 10px; text-align: left; font-size: 12px; border-bottom: 1px solid #eee; word-break: break-word; }
    th { background-color: #f5f7fa; color: #555; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .print-btn-container { display: flex; justify-content: center; margin-top: 20px; }
    .print-btn { background: #ff9800; color: #fff; border: none; padding: 10px 20px; font-weight: bold; border-radius: 6px; cursor: pointer; }
    @media print {
      body { margin: 0; background: #fff; }
      .card { box-shadow: none; padding: 0; border: none; max-width: 100%; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${whName} - Depo Sayım Raporu</h1>
    <div class="subtitle">Sayım ID: ${auditId}</div>
    
    <div class="grid">
      <div class="info-box">
        <strong>Sayım Tarihi</strong>
        <span>${date}</span>
      </div>
      <div class="info-box">
        <strong>Sayımı Yapan Personel</strong>
        <span>${auditor}</span>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width: 10%;">Konum</th>
          <th style="width: 15%;">SAP No</th>
          <th style="width: 35%;">Malzeme Açıklaması</th>
          <th style="text-align: center; width: 10%;">Sistem</th>
          <th style="text-align: center; width: 10%;">Fiziksel</th>
          <th style="text-align: center; width: 10%;">Fark</th>
          <th style="width: 10%;">Açıklama</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="7" style="text-align:center; color:#999; padding: 2rem;">Sayımda kalem bulunmamaktadır.</td></tr>'}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    // Save as [Date]_[Warehouse] depo sayim.pdf
    const cleanWh = whName.replace(/ depo$/i, '').replace(/ deposu$/i, '').trim();
    const cleanDate = date.split(' ')[0].replace(/[\/\\?%*:|"<>\s]/g, '_');
    const descName = `${cleanDate}_${cleanWh} depo sayım`.replace(/[\/\\?%*:|"<>]/g, '_').trim();
    const htmlPath = path.join(folderPath, `${descName}.html`);
    const pdfPath = path.join(folderPath, `${descName}.pdf`);

    fs.writeFileSync(htmlPath, html);

    try {
      const paths = [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ];
      
      let browserPath = null;
      for (const p of paths) {
        if (p && fs.existsSync(p)) {
          browserPath = p;
          break;
        }
      }

      if (!browserPath) {
        logMessage(`PDF dönüştürme başarısız (Sayım): Sunucuda ne Google Chrome ne de Microsoft Edge bulunabildi!`);
        return;
      }

      const cmd = `"${browserPath}" --headless --disable-gpu --print-to-pdf="${pdfPath}" "${htmlPath}"`;
      
      await new Promise((resolve) => {
        exec(cmd, (error) => {
          if (error) {
            logMessage(`PDF dönüştürme başarısız (Sayım - Browser): ${error.message}`);
          } else {
            logMessage(`Depo sayımı başarıyla PDF olarak kaydedildi: ${descName}.pdf`);
            // Delete temporary HTML
            try {
              if (fs.existsSync(htmlPath)) {
                fs.unlinkSync(htmlPath);
              }
            } catch (e) {}
            // Also clean up any old plain Sayim_auditId.html file if it exists in the folder
            try {
              const oldHtmlFile = path.join(folderPath, `Sayim_${auditId}.html`);
              if (fs.existsSync(oldHtmlFile)) {
                fs.unlinkSync(oldHtmlFile);
              }
            } catch (e) {}
          }
          resolve();
        });
      });
    } catch (e) {
      logMessage(`PDF oluşturma sırasında genel hata (Sayım): ${e.message}`);
    }
  }

  function deleteArchivedAudit(whName, auditId, auditData, folderPath) {
    try {
      const date = auditData.date || (auditData.createdAt ? new Date(auditData.createdAt.seconds * 1000).toLocaleDateString('tr-TR') : '-');
      const cleanWh = whName.replace(/ depo$/i, '').replace(/ deposu$/i, '').trim();
      const cleanDate = date.split(' ')[0].replace(/[\/\\?%*:|"<>\s]/g, '_');
      const descName = `${cleanDate}_${cleanWh} depo sayım`;
      
      const pdfPath = path.join(folderPath, `${descName}.pdf`);
      if (fs.existsSync(pdfPath)) {
        fs.unlinkSync(pdfPath);
        logMessage(`Depo sayımı PDF'i silindi (Firestore'dan silindiği için): ${descName}.pdf`);
      }
      
      const htmlPath = path.join(folderPath, `${descName}.html`);
      if (fs.existsSync(htmlPath)) {
        fs.unlinkSync(htmlPath);
      }
      
      const auditMetadataFolder = path.join(folderPath, 'metadata');
      const metaPath = path.join(auditMetadataFolder, `${auditId}.json`);
      if (fs.existsSync(metaPath)) {
        fs.unlinkSync(metaPath);
      }
    } catch (e) {
      logMessage(`Depo sayımı silme hatası: ${e.message}`);
    }
  }

  async function downloadFile(url, destPath) {
    const writer = fs.createWriteStream(destPath);
    try {
      const response = await axios({
        url,
        method: 'GET',
        responseType: 'stream'
      });
      response.data.pipe(writer);
      return new Promise((resolve, reject) => {
        writer.on('finish', resolve);
        writer.on('error', reject);
      });
    } catch (e) {
      logMessage(`URL indirme basarisiz ${url}: ${e.message}`);
    }
  }
} else {
  logMessage('serviceAccountKey.json bulunamadi.');
}
