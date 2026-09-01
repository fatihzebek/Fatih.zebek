import type { ServiceReport } from '../services/ServiceReportService';
import { formatTeamName } from '../utils/formatters';
import * as DateTimeUtils from '../utils/DateTimeUtils';

// Saat dönüştürme yardımcı fonksiyonu (Ondalık saati Saat:Dakika formatına çevirir)
function formatHoursToHm(decimalHours: number): string {
  if (isNaN(decimalHours) || decimalHours <= 0) return '00:00';
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hStr = hours < 10 ? `0${hours}` : `${hours}`;
  const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
  return `${hStr}:${mStr}`;
}

// Adam-saat hesaplama yardımcı fonksiyonu
function calculateManHours(workSessions: any[], dateStr?: string) {
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

    const personnelCount = ws.personnel?.length || 0;
    const sDate = ws.date || dateStr || new Date().toISOString().split('T')[0];

    // Turbine downtime boundaries: only for type ÇALIŞMA, WORK, or BEKLEME
    if (ws.type === 'ÇALIŞMA' || ws.type === 'WORK' || ws.type === 'BEKLEME') {
      totalTurbineHours += durationH;
    }

    // Road travel:
    if (ws.type === 'EVDEN TÜRBİNE' || ws.type === 'TÜRBİNDEN EVE' || ws.type === 'TÜRBİNDEN TÜRBİNE' || ws.type === 'GİDİŞ YOLU' || ws.type === 'DÖNÜŞ YOLU' || ws.type === 'TRAVEL' || ws.type === 'YOL') {
      totalRoadHours += durationH;
    }

    // Overtime
    let wsNormalManHours = 0;
    let wsOvertimeManHours = 0;
    const pList = Array.isArray(ws.personnel) ? ws.personnel : [ws.personnel || ''];

    pList.forEach((name: string) => {
      const ot = DateTimeUtils.calculateOvertimeHours(
        sDate,
        ws.startTime,
        ws.endTime,
        ws.isOffDay || false,
        name
      );
      const overtimeH = Math.min(durationH, ot);
      const normalH = Math.max(0, durationH - overtimeH);
      wsNormalManHours += normalH;
      wsOvertimeManHours += overtimeH;
    });

    totalNormalManHours += wsNormalManHours;
    totalOvertimeManHours += wsOvertimeManHours;
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

export const renderReportPDF = (report: ServiceReport) => {
  const getCORSUrl = (url: string) => {
    if (!url) return '';
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}t=${Date.now()}`;
  };

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
  const isMaintenance = report.type === 'BAKIM';
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
        <tr style="background: ${rowBg}; page-break-inside: avoid; break-inside: avoid;">
          <td style="border: 1px solid #bbb; padding: 4px 2px; text-align: center; font-weight: 700; color: #555;">${(idx + 1).toString().padStart(2, '0')}</td>
          <td style="border: 1px solid #bbb; padding: 4px 6px; font-weight: ${item.status === 'NOT_OK' ? '700' : '400'};${item.status === 'NOT_OK' ? ' color: #b91c1c;' : ''}; word-break: break-word;">
            ${item.text}
            ${advHtml}
          </td>
          <td style="border: 1px solid #bbb; padding: 4px 2px; text-align: center;">
            <span style="background: ${statusBg}; color: ${statusColor}; padding: 1px 4px; border-radius: 3px; font-weight: 800; font-size: 0.85rem; border: 1px solid ${statusColor}33; display: inline-block;">${statusLabel}</span>
          </td>
          <td style="border: 1px solid #bbb; padding: 4px 6px; font-size: 0.92rem; color: ${item.status === 'NOT_OK' ? '#b91c1c' : '#666'}; font-style: ${item.comment ? 'normal' : 'italic'}; word-break: break-word;">
            ${item.comment || '-'}
          </td>
        </tr>`;
    };

    checklistHtml += `<div class="html2pdf__page-break" style="page-break-before: always; break-before: page; height: 0;"></div>`;
    checklistHtml += `<div style="padding-top: 5px;">`;
    
    checklistHtml += `
      <div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <h1 style="font-size: 1.25rem; margin: 0 0 2px; font-weight: 900; letter-spacing: 0.5px;">BAKIM KONTROL LİSTESİ</h1>
        <div style="font-size: 0.9rem; color: #555;">${report.templateName || ''} | Rapor No: <strong>${report.reportNo}</strong> | Türbin: <strong>${report.turbineNo}</strong> (${report.turbineSerial}) | Saha: <strong>${report.siteName}</strong> | Tarih: <strong>${new Date(report.date).toLocaleDateString('tr-TR')}</strong></div>
      </div>
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 0.95rem; table-layout: fixed;">
        <tr>
          <td style="width: 33.3%; padding: 0 3px 0 0;">
            <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 4px; padding: 4px 6px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #16a34a; text-transform: uppercase;">Tamamlandı: </span>
              <span style="font-size: 1.1rem; font-weight: 900; color: #15803d;">${okCount} / ${totalChecklist}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 2px;">
            <div style="background: #fef2f2; border: 1px solid #ef4444; border-radius: 4px; padding: 4px 6px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #dc2626; text-transform: uppercase;">Tamamlanmadı: </span>
              <span style="font-size: 1.1rem; font-weight: 900; color: #b91c1c;">${notOkCount}</span>
            </div>
          </td>
          <td style="width: 33.3%; padding: 0 0 0 3px;">
            <div style="background: #f5f5f5; border: 1px solid #aaa; border-radius: 4px; padding: 4px 6px; text-align: center;">
              <span style="font-size: 0.75rem; font-weight: 700; color: #666; text-transform: uppercase;">Opsiyon Dışı: </span>
              <span style="font-size: 1.1rem; font-weight: 900; color: #555;">${naCount}</span>
            </div>
          </td>
        </tr>
      </table>
      <div style="margin-bottom: 8px;">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none;">
          BAKIM DENETİM LİSTESİ
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.92rem; table-layout: fixed;">
          <colgroup>
            <col style="width: 32px;">
            <col>
            <col style="width: 105px;">
            <col style="width: 130px;">
          </colgroup>
          <tr style="background: #f5f7fa; page-break-inside: avoid; break-inside: avoid;">
            <th style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700; text-align: center;">NO</th>
            <th style="border: 1px solid #bbb; padding: 4px 6px; text-align: left; font-weight: 700;">KONTROL MADDESİ</th>
            <th style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700; text-align: center;">DURUM</th>
            <th style="border: 1px solid #bbb; padding: 4px 6px; font-weight: 700; text-align: left;">AÇIKLAMA</th>
          </tr>`;
          
    checklist.forEach((item, i) => {
      checklistHtml += renderRow(item, i);
    });
    
    checklistHtml += `</table></div>`;
    
    if (notOkCount > 0) {
      checklistHtml += `
        <div style="margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
          <div style="background: #fef2f2; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #ef4444; border-bottom: none; color: #b91c1c;">
            🚨 ANALİZ VE BULGULAR (${notOkCount})
          </div>
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ef4444; font-size: 0.92rem; table-layout: fixed;">
            <colgroup>
              <col style="width: 32px;">
              <col style="width: 40%;">
              <col style="width: 55%;">
            </colgroup>
            <tr style="background: #fef2f2; page-break-inside: avoid; break-inside: avoid;">
              <th style="border: 1px solid #ef4444; padding: 4px 2px; font-weight: 700; text-align: center;">NO</th>
              <th style="border: 1px solid #ef4444; padding: 4px 6px; text-align: left; font-weight: 700;">Kontrol Maddesi</th>
              <th style="border: 1px solid #ef4444; padding: 4px 6px; text-align: left; font-weight: 700;">Tamamlanamama Nedeni / Arıza Bulgusu</th>
            </tr>
            ${checklist.filter(item => item.status === 'NOT_OK').map((item) => {
              const originalIndex = checklist.indexOf(item);
              return `
                <tr style="background: #fff; page-break-inside: avoid; break-inside: avoid;">
                  <td style="border: 1px solid #ef4444; padding: 4px 2px; text-align: center; font-weight: 800; color: #b91c1c;">${(originalIndex + 1).toString().padStart(2, '0')}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px 6px; font-weight: 600; word-break: break-word;">${item.text}</td>
                  <td style="border: 1px solid #ef4444; padding: 4px 6px; color: #b91c1c; font-weight: 500; word-break: break-word;">${item.comment || 'Açıklama girilmemiş'}</td>
                </tr>`;
            }).join('')}
          </table>
        </div>`;
    } else {
      checklistHtml += `
        <div style="background: #e6f9e8; border: 1px solid #22c55e; border-radius: 8px; padding: 12px; text-align: center; margin-bottom: 12px; page-break-inside: avoid; break-inside: avoid;">
          <div style="font-size: 1.4rem; margin-bottom: 2px;">✅</div>
          <div style="font-weight: 700; color: #15803d; font-size: 1.05rem;">Tüm maddeler başarıyla tamamlandı.</div>
          <div style="font-size: 0.9rem; color: #16a34a;">Olumsuz bir bulguya rastlanmadı.</div>
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
            <div class="html2pdf__page-break" style="page-break-before: always; break-before: page; height: 0;"></div>
            <table class="ohs-table-block" style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.92rem; table-layout: fixed; margin-top: 5px; margin-bottom: 15px;">
              <colgroup>
                <col style="width: 32px;">
                <col>
                <col style="width: 130px;">
                <col style="width: 130px;">
              </colgroup>
              <tr style="page-break-inside: avoid; break-inside: avoid;">
                <td colspan="4" style="background: #e8ecf1; padding: 6px 10px; font-weight: 800; font-size: 1.1rem; border: 1px solid #bbb;">${dayIndex + 1}. GÜN İSG VE SAHA GÜVENLİK ONAYLARI</td>
              </tr>
              <tr style="page-break-inside: avoid; break-inside: avoid;">
                <td colspan="4" style="background: #e8ecf1; padding: 0 10px 6px; border: 1px solid #bbb; text-align: right; font-weight: 800; font-size: 0.95rem;">
                  ${dateStr || ''}
                </td>
              </tr>
              <tr style="background: #f5f7fa; page-break-inside: avoid; break-inside: avoid;">
                <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700; text-align: center;">NO</th>
                <th style="border: 1px solid #bbb; padding: 5px 6px; font-weight: 700; text-align: left;">İSG KONTROL MADDESİ</th>
                <th style="border: 1px solid #bbb; padding: 5px 4px; font-weight: 700; text-align: center;">ONAYLAYAN PERSONEL</th>
                <th style="border: 1px solid #bbb; padding: 5px 4px; font-weight: 700; text-align: left;">EKLENEN NOT / SORUN</th>
              </tr>
              ${itemsHtml}
            </table>
          `;
      }).join('');
    }
  }

  return `
    <div id="pdf-container" style="background: #fff; color: #000; padding: 6px 8px; width: 780px; max-width: 780px; min-width: 780px; box-sizing: border-box; margin: 0 auto; font-family: Arial, Helvetica, sans-serif;">
      
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
            width: 780px !important;
            max-width: 780px !important;
            margin: 0 auto;
            padding: 6px 8px;
            box-sizing: border-box !important;
          }

          tr, td, th, img, .info-card, .chart-container, .scada-data, .pdf-no-break, .report-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }

          table {
            display: table !important;
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
          }

          .section-break, .html2pdf__page-break {
            page-break-before: always !important;
            break-before: page !important;
          }
        }

        #pdf-container { width: 780px !important; max-width: 780px !important; min-width: 780px !important; box-sizing: border-box !important; }
        #pdf-container table { display: table !important; width: 100% !important; border-collapse: collapse !important; table-layout: fixed !important; }
        #pdf-container table tr { page-break-inside: avoid !important; break-inside: avoid !important; }
        #pdf-container table th, #pdf-container table td { word-wrap: break-word !important; overflow-wrap: break-word !important; box-sizing: border-box !important; }
        #pdf-container .pdf-no-break { page-break-inside: avoid !important; break-inside: avoid !important; }
        #pdf-container .report-section { page-break-inside: avoid !important; break-inside: avoid !important; margin-bottom: 12px; }
        .html2pdf__page-break { page-break-before: always !important; break-before: page !important; height: 0 !important; margin: 0 !important; padding: 0 !important; border: none !important; }
      </style>

      <!-- ═══════════════════════════════════════════ -->
      <!-- SAYFA 1: GENEL BİLGİLER                    -->
      <!-- ═══════════════════════════════════════════ -->

      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-bottom: 14px; border-bottom: 3px solid #002d6b; padding-bottom: 10px; box-sizing: border-box;">
        <div style="display: flex; gap: 12px; align-items: center;">
            <div style="flex-shrink: 0; width: 55px; height: 55px; background-color: #002d6b; border-radius: 8px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 6px rgba(0,0,0,0.1);">
              <span style="font-family: Arial, sans-serif; font-weight: 900; font-size: 34px; color: #ffffff; letter-spacing: -2px; line-height: 1; display: inline-block;">dh</span>
            </div>
          <div>
            <h1 style="font-size: 1.35rem; margin: 0 0 2px; font-weight: 900; letter-spacing: 0.5px; color: #002d6b; line-height: 1.2;">DEMİRER HOLDİNG</h1>
            <div style="font-size: 0.95rem; color: #555; font-weight: 700;">TEKNİK SERVİS ${isMaintenance ? 'BAKIM' : 'ARIZA'} RAPORU</div>
          </div>
        </div>
        <div style="text-align: right; flex-shrink: 0;">
          <div style="font-size: 1.1rem; font-weight: 800; color: #cc0000; margin-bottom: 2px;">Rapor No: ${report.reportNo}</div>
          <div style="font-size: 0.85rem; color: #666; font-weight: 600;">Tarih: ${new Date(report.date).toLocaleDateString('tr-TR')}</div>
          ${report.templateName ? `<div style="font-size: 0.8rem; color: #888; margin-top: 2px; max-width: 260px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${report.templateName}</div>` : ''}
        </div>
      </div>

      <!-- SERVİS AYRINTILARI -->
      <div class="report-section">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none;">
          SERVİS AYRINTILARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.9rem; table-layout: fixed;">
          <colgroup>
            <col style="width: 16%;">
            <col style="width: 34%;">
            <col style="width: 16%;">
            <col style="width: 34%;">
          </colgroup>
          <tr>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">Tarih</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px;">${new Date(report.date).toLocaleDateString('tr-TR')}</td>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700; white-space: nowrap;">Bölge / Saha</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px; word-break: break-word;">${report.siteName}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">Türbin Seri No</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px;">${report.turbineSerial}</td>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">Türbin No</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px;">${report.turbineNo}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Planlı Kontrol' : (isMaintenance ? 'Bakım Türü' : 'Arıza Kodu');
            })()}</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px; font-weight: 700; word-break: break-word;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Planlı Duruş' : (isMaintenance ? (report.templateName || (report.faultCode !== '-' ? report.faultCode : '') || 'Bakım') : (report.faultCode || '-'));
            })()}</td>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">Ekip</th>
            <td style="border: 1px solid #bbb; padding: 5px 8px; font-weight: 700;">${formatTeamName(report.team)}</td>
          </tr>
          <tr>
            <th style="border: 1px solid #bbb; padding: 5px 8px; text-align: left; background: #f5f7fa; font-weight: 700;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              return isPlanli ? 'Açıklama' : (isMaintenance ? 'Bakım Talimatı' : 'Arıza Tanımı');
            })()}</th>
            <td colspan="3" style="border: 1px solid #bbb; padding: 5px 8px; font-size: 0.92rem; word-break: break-word;">${(() => {
              const isPlanli = !isMaintenance && (report.faultCode === 'Planlı Duruş' || report.templateName === 'Planlı Duruş' || (report.faultCode && report.faultCode.toLowerCase().includes('planlı')) || (report.templateName && report.templateName.toLowerCase().includes('planlı')));
              if (isPlanli) {
                return report.faultDesc || 'Planlı Duruş';
              }
              if (isMaintenance) {
                let code = (report as any).instructionCode || (report as any).templateInstructionCode || '';
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
      <div class="report-section">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none;">
          ÇALIŞMA ZAMANLARI
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.92rem; text-align: center; table-layout: fixed;">
          <colgroup>
            <col style="width: 14%;">
            <col style="width: 25%;">
            <col style="width: 14%;">
            <col style="width: 11%;">
            <col style="width: 11%;">
            <col style="width: 10%;">
            <col style="width: 15%;">
          </colgroup>
          <tr style="background: #f5f7fa; page-break-inside: avoid; break-inside: avoid;">
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Kayıt Türü</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Personel</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Tarih</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Başlangıç</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Bitiş</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Süre</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Açıklama</th>
          </tr>
          ${sessions.length > 0 ? sessions.filter((s: any) => s.startTime && s.endTime).map((session: any) => {
            const personnelList = Array.isArray(session.personnel) ? session.personnel.join(', ') : (session.personnel || '-');
            const typeLabel = session.type || 'ÇALIŞMA';
            return `
              <tr style="page-break-inside: avoid; break-inside: avoid;">
                <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 600;">${typeLabel}</td>
                <td style="border: 1px solid #bbb; padding: 4px 2px; word-break: break-word;">${personnelList}</td>
                <td style="border: 1px solid #bbb; padding: 4px 2px;">${session.date ? new Date(session.date).toLocaleDateString('tr-TR') : '-'}</td>
                <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 600;">${session.startTime || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 600;">${session.endTime || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700; color: #0055aa;">${session.duration || '-'}</td>
                <td style="border: 1px solid #bbb; padding: 4px 4px; text-align: left; font-size: 0.85rem; word-break: break-word;">${session.note || session.comment || '-'}</td>
              </tr>
            `;
          }).join('') : `
            <tr><td colspan="7" style="border: 1px solid #bbb; padding: 10px; color: #999;">Çalışma kaydı bulunmamaktadır.</td></tr>
          `}
        </table>

        <!-- Adam-Saat Özeti -->
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; border-top: none; font-size: 0.92rem; text-align: center; table-layout: fixed;">
          <colgroup>
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
            <col style="width: 20%;">
          </colgroup>
          <tr style="background: #eaeff5; page-break-inside: avoid; break-inside: avoid;">
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Türbin Süresi</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Yol Süresi</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Normal Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Mesai Adam-Saat</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">Toplam Adam-Saat</th>
          </tr>
          <tr style="page-break-inside: avoid; break-inside: avoid;">
            <td style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 800; color: #0055aa;">${manHours.turbine}</td>
            <td style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 800; color: #0055aa;">${manHours.travel}</td>
            <td style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 800; color: #0055aa;">${manHours.normal}</td>
            <td style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 800; color: #cc6600;">${manHours.overtime}</td>
            <td style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 900; color: #006633;">${manHours.total}</td>
          </tr>
        </table>
      </div>

      <!-- YAPILAN İŞLEMLER VE FOTOĞRAFLAR -->
      <div class="report-section">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none;">
          YAPILAN İŞLEMLER VE FOTOĞRAFLAR
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.9rem; table-layout: fixed;">
          <colgroup>
            <col style="width: 50%;">
            <col style="width: 50%;">
          </colgroup>
          <tr>
            <td style="border: 1px solid #bbb; padding: 10px; vertical-align: top; word-break: break-word;">
              <div style="font-weight: 700; font-size: 0.95rem; color: #555; margin-bottom: 4px;">YAPILAN İŞLEMLER / NOTLAR</div>
              <div style="white-space: pre-wrap;">${report.notes || '<span style="color: #999;">Not girilmemiştir.</span>'}</div>
            </td>
            <td style="border: 1px solid #bbb; padding: 10px; vertical-align: top;">
              <div style="font-weight: 700; font-size: 0.95rem; color: #555; margin-bottom: 4px;">FOTOĞRAFLAR</div>
              ${report.imageUrls && report.imageUrls.length > 0 ? `
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px;">
                  ${report.imageUrls.slice(0, 4).map(url => `
                    <img src="${getCORSUrl(url)}" style="width: 100%; height: 90px; object-fit: cover; border: 1px solid #ddd; border-radius: 4px;" crossorigin="anonymous">
                  `).join('')}
                </div>
              ` : '<span style="color: #999;">Fotoğraf eklenmemiştir.</span>'}
            </td>
          </tr>
        </table>
      </div>

      <!-- MALZEME YÖNETİMİ -->
      <div class="report-section">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none; display: flex; justify-content: space-between; align-items: center;">
          <span>MALZEME YÖNETİMİ</span>
          <span style="font-weight: 600; font-size: 0.95rem;">MÇF No: <strong style="color: #cc0000;">${report.matFormNo || '-'}</strong></span>
        </div>
        <table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.9rem; text-align: center; table-layout: fixed;">
          <colgroup>
            <col style="width: 35px;">
            <col style="width: 35px;">
            <col style="width: 80px;">
            <col style="width: 95px;">
            <col>
            <col style="width: 55px;">
          </colgroup>
          <tr style="background: #f5f7fa; font-size: 0.8rem; line-height: 1.1; page-break-inside: avoid; break-inside: avoid;">
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">POZ</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">S/T</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">SAP NO</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">SERİ NO</th>
            <th style="border: 1px solid #bbb; padding: 5px 6px; text-align: left; font-weight: 700;">MALZEME AÇIKLAMASI</th>
            <th style="border: 1px solid #bbb; padding: 5px 2px; font-weight: 700;">ADET</th>
          </tr>
          ${(report.materials || []).length > 0 ? (report.materials || []).map(mat => `
            <tr style="page-break-inside: avoid; break-inside: avoid;">
              <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700;">${mat.poz}</td>
              <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700; color: ${mat.type === 'S' ? '#cc0000' : '#006633'};">${mat.type}</td>
              <td style="border: 1px solid #bbb; padding: 4px 2px;">${mat.sapNo}</td>
              <td style="border: 1px solid #bbb; padding: 4px 2px; word-break: break-word;">${mat.serialNo || '-'}</td>
              <td style="border: 1px solid #bbb; padding: 4px 6px; text-align: left; word-break: break-word;">${mat.description}</td>
              <td style="border: 1px solid #bbb; padding: 4px 2px; font-weight: 700;">${mat.type === 'S' ? (mat.defectCount || 0) : (mat.used || 0)}</td>
            </tr>
          `).join('') : `
            <tr><td colspan="6" style="border: 1px solid #bbb; padding: 10px; color: #999;">Malzeme kaydı bulunmamaktadır.</td></tr>
          `}
        </table>
      </div>

      ${ohsHtml}
      ${checklistHtml}

      ${report.imageUrls && report.imageUrls.length > 0 ? `
      <!-- FOTOĞRAF GALERİSİ -->
      <div class="report-section" style="margin-top: 15px; page-break-inside: avoid; break-inside: avoid;">
        <div style="background: #e8ecf1; padding: 4px 10px; font-weight: 800; font-size: 1rem; border: 1px solid #bbb; border-bottom: none;">
          İŞLEM VE ARIZA FOTOĞRAFLARI (${report.imageUrls.length} FOTOĞRAF)
        </div>
        <div style="border: 1px solid #bbb; padding: 8px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: #fff;">
          ${report.imageUrls.map((url, idx) => `
            <div style="border: 1px solid #ddd; border-radius: 4px; overflow: hidden; background: #f8fafc; text-align: center; padding: 3px;">
              <img src="${getCORSUrl(url)}" style="width: 100%; height: 140px; object-fit: cover; border-radius: 2px;" crossorigin="anonymous">
              <div style="font-size: 0.75rem; font-weight: 700; color: #555; margin-top: 2px;">Fotoğraf #${idx + 1}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <!-- Footer -->
      <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #bbb; display: flex; justify-content: space-between; font-size: 0.85rem; color: #888;">
        <span>DH Servis | Demirer Holding</span>
        <span>Oluşturulma: ${new Date(report.date).toLocaleDateString('tr-TR')}</span>
      </div>

    </div>
  `;
};
