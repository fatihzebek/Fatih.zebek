import type { ServiceReport } from '../services/ServiceReportService';
import { formatTeamName } from '../utils/formatters';
import * as DateTimeUtils from '../utils/DateTimeUtils';

// Adam-saat hesaplama yardımcı fonksiyonu
function calculateManHours(workSessions: any[], dateStr?: string) {
  let firstStart: any = null;
  let lastEnd: any = null;
  let totalRoadHours = 0;
  let totalNormalManHours = 0;
  let totalOvertimeManHours = 0;
  let totalManHours = 0;

  (workSessions || []).forEach(ws => {
    if (!ws.startTime || !ws.endTime) return;
    const [sh, sm] = ws.startTime.split(':').map(Number);
    let [eh, em] = ws.endTime.split(':').map(Number);
    let durationH = (eh + em / 60) - (sh + sm / 60);
    if (durationH < 0) durationH += 24;

    const personnelCount = ws.personnel?.length || 0;
    const sDate = ws.date || dateStr || new Date().toISOString().split('T')[0];

    // Turbine downtime boundaries: only for type ÇALIŞMA, WORK, or BEKLEME
    if (ws.type === 'ÇALIŞMA' || ws.type === 'WORK' || ws.type === 'BEKLEME') {
      const startDt = new Date(`${sDate}T${ws.startTime}:00`);
      let endDt = new Date(`${sDate}T${ws.endTime}:00`);
      if (!isNaN(startDt.getTime()) && !isNaN(endDt.getTime())) {
        if (endDt.getTime() < startDt.getTime()) {
          endDt = new Date(endDt.getTime() + 24 * 60 * 60 * 1000);
        }
        if (!firstStart || startDt < firstStart) {
          firstStart = startDt;
        }
        if (!lastEnd || endDt > lastEnd) {
          lastEnd = endDt;
        }
      }
    }

    // Road travel:
    if (ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE' || ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'YOL') {
      totalRoadHours += durationH;
    }

    // Overtime
    const ot = DateTimeUtils.calculateOvertimeHours(
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

  let totalTurbineHours = 0;
  if (firstStart && lastEnd) {
    totalTurbineHours = (lastEnd.getTime() - firstStart.getTime()) / (1000 * 60 * 60);
  }

  return {
    turbine: `${totalTurbineHours.toFixed(2)} SAAT`,
    travel: `${totalRoadHours.toFixed(2)} SAAT`,
    normal: `${totalNormalManHours.toFixed(2)} SAAT`,
    overtime: `${totalOvertimeManHours.toFixed(2)} SAAT`,
    total: `${totalManHours.toFixed(2)} SAAT`
  };
}

export const renderReportPDF = (report: ServiceReport) => {
  const sessions = (report as any).workSessions || [];
  const manHours = calculateManHours(sessions, report.date);
  const checklist = report.checklist || [];
  const hasChecklist = checklist.length > 0;
  
  // Checklist istatistikleri
  const okCount = checklist.filter(i => i.status === 'OK').length;
  const notOkCount = checklist.filter(i => i.status === 'NOT_OK').length;
  const naCount = checklist.filter(i => i.status === 'NA').length;
  const totalChecklist = checklist.length;

  // Rapor tipi belirleme
  const isMaintenance = (report.type !== 'ARIZA') || hasChecklist;
  const reportTitle = isMaintenance 
    ? `${report.templateName || 'BAKIM RAPORU'}` 
    : 'ARIZA RAPORU';

  let checklistHtml = '';
  if (hasChecklist) {
    const renderRow = (item: any, idx: number) => {
      const isOk = item.status === 'OK';
      const isNa = item.status === 'NA';
      const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
      const statusColor = isOk ? '#16a34a' : (isNa ? '#666666' : '#dc2626');
      const statusBg = isOk ? '#e6f9e8' : (isNa ? '#f5f5f5' : '#fef2f2');
      const rowBg = idx % 2 === 0 ? '#ffffff' : '#fcfcfc';
      
      let advHtml = '';
      if (item.measurementConfig && item.measurementConfig.type !== 'standard' && item.measurementValues && item.measurementValues.length > 0) {
        const type = item.measurementConfig?.type;
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
            details = vals.map((v: any, i: number) => {
                if (item.measurementConfig.requireSignature && i === vals.length - 1 && vals.length > item.measurementConfig.inputCount) return `<strong>İmza:</strong> ${v || '-'}`;
                return `<strong>${labels[i] || 'Ölçüm '+(i+1)}:</strong> ${v || '-'}`;
            }).join(' | ');
        }
        else if (type === 'version_control') {
            const items = item.measurementConfig.versionItems || [];
            details = vals.map((v: any, i: number) => `<strong>${items[i]?.label || 'Kart '+(i+1)}:</strong> ${v || '-'}`).join('<br>');
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

    checklistHtml += `<div class="html2pdf__page-break"></div>`;
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
    const ohsList = Array.isArray(report.ohsData) ? report.ohsData : (report.ohsData?.q1 ? [report.ohsData] : []);
    
    if (ohsList.length > 0) {
      ohsHtml = ohsList.map((ohs: any, dayIndex: number) => {
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

  return `
    <div id="pdf-container" style="background: #fff; color: #000; padding: 10px 20px; width: 100%; max-width: none; box-sizing: border-box; margin: 0 auto; font-family: Arial, sans-serif;">
      
      <!-- CSS Isolation directly injected to guarantee it works even with caching -->
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

        #pdf-container table { display: table; width: 100%; border-collapse: collapse; }
        #pdf-container table tr { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container table th, #pdf-container table td { word-wrap: break-word; }
        #pdf-container .pdf-no-break { page-break-inside: avoid; break-inside: avoid; }
        #pdf-container .report-section { page-break-inside: avoid; break-inside: avoid; }
      </style>

      <!-- ═══════════════════════════════════════════ -->
      <!-- SAYFA 1: GENEL BİLGİLER                    -->
      <!-- ═══════════════════════════════════════════ -->

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 3px solid #002d6b; padding-bottom: 15px;">
        <div style="display: flex; gap: 15px; align-items: center;">
          <div style="flex-shrink: 0;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" style="width: 70px; height: 70px; border-radius: 10px; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
              <rect width="120" height="120" fill="#002d6b"/>
              <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="75" fill="#ffffff" letter-spacing="-2">dh</text>
            </svg>
          </div>
          <div>
            <h1 style="font-size: 1.6rem; margin: 0 0 4px; font-weight: 900; letter-spacing: 0.5px; color: #002d6b;">DEMİRER HOLDİNG</h1>
            <div style="font-size: 1.1rem; color: #555; font-weight: 700;">TEKNİK SERVİS ${isMaintenance ? 'BAKIM' : 'ARIZA'} RAPORU</div>
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
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Arıza Kodu</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${report.faultCode || '-'}</td>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Personel / Ekip</th>
            <td style="border: 1px solid #bbb; padding: 7px 10px; font-weight: 700;">${formatTeamName(report.team)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 7px 10px; text-align: left; background: #f5f7fa; font-weight: 700;">Arıza Tanımı</th>
            <td colspan="3" style="border: 1px solid #bbb; padding: 7px 10px; font-size: 1.14rem;">${report.faultDesc || '-'}</td>
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
          ${sessions.length > 0 ? sessions.filter((s: any) => s.startTime && s.endTime).map((session: any) => {
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
                  ${report.imageUrls.map(url => `
                    <img src="${url}" style="width: 100%; height: auto; border: 1px solid #ddd; border-radius: 4px;" crossorigin="anonymous">
                  `).join('')}
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
          <tr style="background: #f5f7fa;">
            <th style="border: 1px solid #bbb; padding: 6px; width: 35px; font-weight: 700;">POZ</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 30px; font-weight: 700;">S/T</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">SAP NO</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">SERİ NO</th>
            <th style="border: 1px solid #bbb; padding: 6px; text-align: left; font-weight: 700;">MALZEME AÇIKLAMASI</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">DEPODAN ALINAN</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 60px; font-weight: 700;">DEPOYA İADE</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 70px; font-weight: 700;">KULLANILAN</th>
            <th style="border: 1px solid #bbb; padding: 6px; width: 55px; font-weight: 700;">DEFECT</th>
          </tr>
          ${report.materials.length > 0 ? report.materials.map(mat => `
            <tr>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700;">${mat.poz}</td>
              <td style="border: 1px solid #bbb; padding: 5px; font-weight: 700; color: ${mat.type === 'S' ? '#cc0000' : '#006633'};">${mat.type}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.sapNo}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.serialNo || '-'}</td>
              <td style="border: 1px solid #bbb; padding: 5px; text-align: left;">${mat.description}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.received || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.returned || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.used || 0}</td>
              <td style="border: 1px solid #bbb; padding: 5px;">${mat.defectCount || 0}</td>
            </tr>
          `).join('') : `
            <tr><td colspan="9" style="border: 1px solid #bbb; padding: 15px; color: #999;">Malzeme kaydı bulunmamaktadır.</td></tr>
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
};
