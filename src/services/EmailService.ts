import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ServiceReport } from './ServiceReportService';
import { renderReportPDF } from '../components/ReportTemplate';
import { getSiteTeamLeader, fixTurkishWarehouseName, formatRepairDuration, formatDisplayName, formatSafeDateTime } from '../utils/formatters';
import { emailSettingsService } from './EmailSettingsService';

/**
 * Returns the email API endpoint URL.
 * Production: Firebase Cloud Function (europe-west1)
 * Development: Local Vite dev server middleware (/api/send-email)
 */
function getEmailEndpoint(): string {
  const isDev = typeof window !== 'undefined' && (
    window.location.hostname === 'localhost' || 
    window.location.hostname === '127.0.0.1'
  );
  if (isDev) {
    return '/api/send-email';
  }
  return 'https://europe-west1-dh-servis-rapor.cloudfunctions.net/sendEmail';
}

export const DEFAULT_REPORT_EMAIL = 'servis.rapor@demirerholding.com';
export const DEFAULT_DISPATCH_EMAILS = 'fatih.zebek@demirerholding.com, emir.unver@demirerholding.com, hursit.akter@demirerholding.com';

class EmailService {
  /**
   * Generates HTML email content and sends report email + PDF attachment to target address.
   */
  async sendReportEmail(
    report: ServiceReport, 
    customRecipient?: string
  ): Promise<{ success: boolean; message: string }> {
    let recipient = customRecipient;
    if (!recipient) {
      try {
        const configured = await emailSettingsService.getRecipients('reportEmails');
        recipient = configured.length > 0 ? configured.join(', ') : DEFAULT_REPORT_EMAIL;
      } catch {
        recipient = DEFAULT_REPORT_EMAIL;
      }
    }
    const reportNo = report.reportNo || 'Bilinmeyen Rapor';
    const turbineStr = (report as any).turbineNo || (report as any).turbineName || '';
    const siteTurbine = `${report.siteName || ''} ${turbineStr ? '- ' + turbineStr : ''}`.trim();
    const reportType = report.type === 'BAKIM' ? 'BAKIM RAPORU' : 'ARIZA RAPORU';
    
    console.log(`[EmailService] Rapor maili ve PDF eki hazırlanıyor... Rapor No: ${reportNo}, Alıcı: ${recipient}`);

    // 1. Build HTML Email Body
    const htmlBody = this.buildReportEmailHTML(report);
    const subject = `[DH-SERVİS ${reportType}] ${siteTurbine} (${reportNo})`;
    const techs = (report as any).technicians || (report as any).personnel || [];
    const replyTo = (report as any).createdBy || (Array.isArray(techs) && techs.length > 0 ? techs[0] : DEFAULT_REPORT_EMAIL);

    try {
      // 2. Generate Real A4 PDF File Attachment
      const pdfFile = await this.generatePDFFile(report);
      let base64Content = '';
      
      if (pdfFile) {
        base64Content = await this.blobToBase64(pdfFile);
      }

      const d = new Date(report.date || Date.now());
      const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
      const actionStr = (report.templateName || (report as any).faultCode || 'Rapor').replace(/\s+/g, '_');
      const siteStr = (report.siteName || 'Saha').replace(/\s+/g, '_');
      const turbStr = (turbineStr || 'T').replace(/\s+/g, '_');
      let safeFileName = `${dateStr}-${siteStr}-${actionStr}-${turbStr}-${reportNo}.pdf`;
      safeFileName = safeFileName
        .replace(/[\\/:*?"<>|]/g, '-')
        .trim();

      // 3. Dispatch via Cloud Function / Gmail SMTP Service (dhservisrapor@gmail.com)
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          html: htmlBody,
          pdfBase64: base64Content,
          filename: safeFileName
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Rapor ve PDF eki Gmail (dhrapor@gmail.com) üzerinden başarıyla iletildi: ${reportNo}`);
        if ((window as any).showToast) {
          (window as any).showToast('BAŞARILI', 'Rapor ve resmi PDF eki Servis Merkezine iletildi.', 'success');
        }
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] E-Posta gönderim uyarısı:', errStr);
        if ((window as any).showToast) {
          (window as any).showToast('E-POSTA UYARISI', `Gönderim Durumu: ${errStr}`, 'warning');
        }
      }

      return {
        success: true,
        message: 'Rapor e-postası ve resmi PDF eki Servis Merkezine başarıyla iletildi.'
      };
    } catch (err: any) {
      console.error('[EmailService] E-posta gönderim hatası:', err);
      return {
        success: false,
        message: `E-posta gönderilemedi: ${err?.message || err}`
      };
    }
  }

  /**
   * Helper to convert Blob to Base64 string for email attachment payload.
   */
  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64 = dataUrl.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Dynamically loads html2pdf.js library if not present on page.
   */
  private async ensureHtml2PdfLoaded(): Promise<boolean> {
    if ((window as any).html2pdf) return true;
    return new Promise((resolve) => {
      console.log('[EmailService] html2pdf.js kütüphanesi yükleniyor...');
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  }

  /**
   * Generates a real A4 PDF file from report HTML template matching ReportArchive export.
   */
  private async generatePDFFile(report: ServiceReport): Promise<File | null> {
    try {
      await this.ensureHtml2PdfLoaded();

      const reportNo = report.reportNo || 'Rapor';
      const htmlContent = renderReportPDF(report);

      // Create temporary container offscreen
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 720px; background: #ffffff; z-index: -99999;';
      wrapper.innerHTML = htmlContent;
      document.body.appendChild(wrapper);

      const targetElement = (wrapper.querySelector('#pdf-container') || wrapper.firstElementChild || wrapper) as HTMLElement;

      // Wait for images to load inside target
      const images = wrapper.querySelectorAll('img');
      if (images.length > 0) {
          await Promise.all(Array.from(images).map((img: any) => {
              if (img.complete) return Promise.resolve();
              return new Promise(res => { img.onload = res; img.onerror = res; });
          }));
      }
      await new Promise(r => setTimeout(r, 400));

      const opt = {
          margin: [8, 8, 8, 8],
          filename: `Servis_Raporu_${reportNo}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { 
              scale: 2, 
              useCORS: true, 
              backgroundColor: '#ffffff',
              scrollY: 0
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { 
              mode: ['css', 'legacy'], 
              before: '.html2pdf__page-break', 
              avoid: ['tr', '.pdf-no-break', '.report-section', '.ohs-day-card', 'img'] 
          }
      };

      let pdfBlob: Blob | null = null;
      try {
          pdfBlob = await (window as any).html2pdf().set(opt).from(targetElement).outputPdf('blob');
      } finally {
          if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      }

      if (pdfBlob && pdfBlob.size > 1000) {
        console.log(`[EmailService] Resmi tam A4 PDF dosyası başarıyla üretildi: Servis_Raporu_${reportNo}.pdf (${pdfBlob.size} bytes)`);
        return new File([pdfBlob], `Servis_Raporu_${reportNo}.pdf`, { type: 'application/pdf' });
      }
    } catch (e) {
      console.warn('[EmailService] PDF üretimi hatası:', e);
    }
    return null;
  }

  /**
   * Builds clean, inline-styled HTML for email clients (Outlook, Gmail, Apple Mail).
   */
  private buildReportEmailHTML(report: ServiceReport): string {
    const isMaintenance = report.type === 'BAKIM';
    const reportTitle = isMaintenance ? ((report as any).templateName || 'BAKIM RAPORU') : 'ARIZA RAPORU';
    const reportNo = report.reportNo || (report as any).id || (report as any).reportId || '-';
    const date = report.date ? new Date(report.date).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
    const site = report.siteName || '-';
    const turbine = (report as any).turbineNo || (report as any).turbineName || '-';
    const turbineSerial = report.turbineSerial ? `(Seri: ${report.turbineSerial})` : '';
    const techs = (report as any).technicians || (report as any).personnel || [];
    const technicians = Array.isArray(techs) ? techs.join(', ') : (techs || '-');
    const team = (report as any).team ? `[${(report as any).team}] ` : '';

    // Arıza Kodu / Tanımı / Bakım Talimatı
    const faultCode = (report as any).faultCode || (report as any).code || '';
    const faultDesc = (report as any).faultDesc || (report as any).faultDescription || (report as any).templateName || '';

    // Yapılan İşlemler / Notlar (PDF ile birebir aynı öncelik)
    const reportDesc = (report as any).notes || 
      (report as any).description || 
      (report as any).faultDescription || 
      (report as any).details || 
      (report as any).operations || 
      (report as any).summary || 
      'Açıklama girilmedi.';

    // MÇF No
    const matFormNo = (report as any).matFormNo || '';

    // Çalışma Süresi Özeti
    const sessions = (report as any).workSessions || [];
    let totalWorkDuration = '';
    if (sessions.length > 0) {
      const durMinutes = sessions.reduce((sum: number, s: any) => {
        if (!s.startTime || !s.endTime) return sum;
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        let m = (eh * 60 + em) - (sh * 60 + sm);
        if (m < 0) m += 24 * 60;
        return sum + m;
      }, 0);
      if (durMinutes > 0) {
        const h = Math.floor(durMinutes / 60);
        const m = durMinutes % 60;
        totalWorkDuration = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
      }
    }

    // Materials list (PDF ile %100 Birebir Uyumlu: POZ, S/T, SAP NO, SERİ NO, MALZEME AÇIKLAMASI, ADET)
    const materials = (report as any).materials || [];
    let materialsHtml = '';
    if (materials.length > 0) {
      materialsHtml = `
        <div style="margin-top: 24px;">
          <div style="background: #E8ECF1; padding: 6px 12px; font-weight: 800; font-size: 14px; border: 1px solid #CBD5E1; border-bottom: none; display: flex; justify-content: space-between; align-items: center; color: #0F172A;">
            <span>📦 MALZEME YÖNETİMİ</span>
            <span style="font-weight: 700; font-size: 13px;">MÇF No: <strong style="color: #DC2626;">${matFormNo || '-'}</strong></span>
          </div>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; text-align: center; border: 1px solid #CBD5E1;">
            <thead>
              <tr style="background-color: #F1F5F9; color: #334155; font-size: 12px;">
                <th style="padding: 7px 4px; border: 1px solid #CBD5E1; width: 45px; text-align: center; font-weight: 700;">POZ</th>
                <th style="padding: 7px 4px; border: 1px solid #CBD5E1; width: 45px; text-align: center; font-weight: 700;">S/T</th>
                <th style="padding: 7px 6px; border: 1px solid #CBD5E1; width: 90px; text-align: center; font-weight: 700;">SAP NO</th>
                <th style="padding: 7px 6px; border: 1px solid #CBD5E1; width: 105px; text-align: center; font-weight: 700;">SERİ NO</th>
                <th style="padding: 7px 8px; border: 1px solid #CBD5E1; text-align: left; font-weight: 700;">MALZEME AÇIKLAMASI</th>
                <th style="padding: 7px 4px; border: 1px solid #CBD5E1; width: 55px; text-align: center; font-weight: 700;">ADET</th>
              </tr>
            </thead>
            <tbody>
              ${materials.map((mat: any, idx: number) => {
                const isSokulen = (mat.type || '').toUpperCase() === 'S';
                const stBadge = isSokulen 
                  ? '<strong style="color: #DC2626; font-size: 14px; font-weight: 900;">S</strong>'
                  : '<strong style="color: #16A34A; font-size: 14px; font-weight: 900;">T</strong>';
                const qty = isSokulen 
                  ? (mat.defectCount !== undefined && mat.defectCount !== null ? mat.defectCount : (mat.quantity || mat.used || 1))
                  : (mat.used !== undefined && mat.used !== null ? mat.used : (mat.quantity || 1));
                
                return `
                  <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                    <td style="padding: 6px 4px; border: 1px solid #E2E8F0; font-weight: bold; color: #475569;">${mat.poz || (idx + 1)}</td>
                    <td style="padding: 6px 4px; border: 1px solid #E2E8F0; text-align: center;">${stBadge}</td>
                    <td style="padding: 6px 6px; border: 1px solid #E2E8F0; font-family: monospace; font-weight: 600; color: #0F172A;">${mat.sapNo || '-'}</td>
                    <td style="padding: 6px 6px; border: 1px solid #E2E8F0; font-family: monospace; color: #334155; word-break: break-word;">${mat.serialNo || '-'}</td>
                    <td style="padding: 6px 8px; border: 1px solid #E2E8F0; text-align: left; color: #1E293B; word-break: break-word;">${mat.description || mat.name || '-'}</td>
                    <td style="padding: 6px 4px; border: 1px solid #E2E8F0; text-align: center; font-weight: bold; color: #0F172A;">${qty}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // Images
    const images = report.imageUrls || [];
    let imagesHtml = '';
    if (images.length > 0) {
      imagesHtml = `
        <div style="margin-top: 20px;">
          <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #2563EB; padding-bottom: 4px;">🖼️ Saha Fotoğrafları (${images.length} Adet)</h3>
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 10px;">
            ${images.map((imgUrl, idx) => `
              <a href="${imgUrl}" target="_blank" style="display: inline-block; border: 1px solid #E2E8F0; border-radius: 6px; padding: 4px; background: #F8FAFC; text-decoration: none;">
                <img src="${imgUrl}" alt="Foto ${idx + 1}" style="width: 120px; height: 90px; object-fit: cover; border-radius: 4px; display: block;" />
                <span style="font-size: 10px; color: #2563EB; text-align: center; display: block; margin-top: 4px;">Görsel ${idx + 1} ↗</span>
              </a>
            `).join('')}
          </div>
        </div>
      `;
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 700px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 4px solid #14F195; }
          .content { padding: 24px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
          .info-label { font-weight: bold; color: #64748B; width: 32%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .desc-box { background-color: #F8FAFC; border-left: 4px solid #3B82F6; padding: 14px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1E293B; margin-top: 10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #14F195;">DEMİRER HOLDİNG SERVİS RAPORU</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #94A3B8;">${reportTitle} • Rapor No: <strong style="color: #FFFFFF;">${reportNo}</strong></p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">📍 Santral / Türbin:</td>
                <td class="info-val" style="color: #2563EB;">${site} - ${turbine} <span style="font-size: 12px; color: #64748B; font-weight: normal;">${turbineSerial}</span></td>
              </tr>
              <tr>
                <td class="info-label">🔖 Rapor No:</td>
                <td class="info-val" style="color: #DC2626; font-family: monospace; font-weight: 800;">${reportNo}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Rapor Tarihi:</td>
                <td class="info-val">${date}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Teknisyen(ler):</td>
                <td class="info-val">${team}${technicians}</td>
              </tr>
              <tr>
                <td class="info-label">⚙️ Rapor Tipi:</td>
                <td class="info-val"><span style="background: ${isMaintenance ? '#DCFCE7' : '#FEF2F2'}; color: ${isMaintenance ? '#166534' : '#991B1B'}; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: 700;">${reportTitle}</span></td>
              </tr>
              ${!isMaintenance && faultCode ? `
                <tr>
                  <td class="info-label">⚠️ Arıza Kodu:</td>
                  <td class="info-val" style="color: #DC2626; font-family: monospace; font-weight: 800;">${faultCode}</td>
                </tr>
              ` : ''}
              ${faultDesc ? `
                <tr>
                  <td class="info-label">${isMaintenance ? '📋 Bakım Talimatı:' : '📋 Arıza Tanımı:'}</td>
                  <td class="info-val">${faultDesc}</td>
                </tr>
              ` : ''}
              ${totalWorkDuration ? `
                <tr>
                  <td class="info-label">⏱️ Çalışma Süresi:</td>
                  <td class="info-val" style="color: #0284C7; font-family: monospace; font-weight: 700;">${totalWorkDuration} Saat</td>
                </tr>
              ` : ''}
              ${matFormNo ? `
                <tr>
                  <td class="info-label">📦 MÇF No:</td>
                  <td class="info-val" style="color: #D97706; font-family: monospace; font-weight: 700;">${matFormNo}</td>
                </tr>
              ` : ''}
            </table>

            <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #2563EB; padding-bottom: 4px;">📝 Yapılan İşlemler / Notlar</h3>
            <div class="desc-box">
              ${reportDesc}
            </div>

            ${materialsHtml}
            ${imagesHtml}
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates a crystal-clear, standard A4 PDF file for official Demirer Holding Dispatch Form.
   */
  public async generateDispatchPDFFile(data: {
    dispatchNo: string;
    targetWarehouseName: string;
    recipientName: string;
    senderName: string;
    note?: string;
    items: Array<{
      sapNo: string;
      serialNo?: string;
      description: string;
      quantity: number;
      repairNotes?: string;
      faultCode?: string;
    }>;
  }): Promise<File | null> {
    try {
      await this.ensureHtml2PdfLoaded();

      const dateStr = new Date().toLocaleString('tr-TR');
      const totalQty = data.items.reduce((sum, it) => sum + (it.quantity || 1), 0);

      const formatPersonName = (raw: string) => {
        if (!raw) return '-';
        if (raw.includes('@')) {
          const part = raw.split('@')[0];
          return part.split('.').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
        }
        return raw;
      };

      const formattedSender = formatPersonName(data.senderName);
      const resolvedRecipient = (!data.recipientName || data.recipientName.includes('Ekibi') || data.recipientName.includes('Sorumlusu') || data.recipientName === 'Hurşit Akter')
        ? getSiteTeamLeader(data.targetWarehouseName)
        : data.recipientName;
      const formattedRecipient = formatPersonName(resolvedRecipient);
      const displayFormNo = data.dispatchNo && (data.dispatchNo.toUpperCase().includes('FORM') || data.dispatchNo.toUpperCase().includes('MÇT'))
        ? data.dispatchNo
        : `Form NO: ${data.dispatchNo || '-'}`;

      const rows = data.items.map((it, idx) => `
        <tr style="page-break-inside: avoid; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #475569; padding: 5px 3px; text-align: center; font-weight: bold; font-size: 10px;">${idx + 1}</td>
          <td style="border: 1px solid #475569; padding: 5px 4px; font-family: monospace; font-weight: bold; font-size: 10px; color: #1e40af;">${it.sapNo}</td>
          <td style="border: 1px solid #475569; padding: 5px 4px; font-family: monospace; font-weight: bold; font-size: 10px; color: #047857;">${it.serialNo || '-'}</td>
          <td style="border: 1px solid #475569; padding: 5px 6px; font-size: 10px;">
            <div style="font-weight: 700; color: #0f172a;">${it.description}</div>
            ${(() => {
              const raw = String(it.repairNotes || '').trim();
              const isTurbine = raw.toLowerCase().includes('türbinde') || raw.toLowerCase().includes('turbinde');
              const hasCustom = raw && raw.toLowerCase() !== 'onarım bekliyor' && raw.toLowerCase() !== 'onarim bekliyor' && !raw.includes('Onarıldı');
              const text = isTurbine
                ? (hasCustom ? `6. Onarıldı (Türbinde Test) - ${raw}` : '6. Onarıldı (Türbinde Test)')
                : (hasCustom ? `5. Onarıldı & Test Edildi - ${raw}` : '5. Onarıldı & Test Edildi');
              const color = isTurbine ? '#b45309' : '#047857';
              const icon = isTurbine ? '⚠️' : '✅';
              return `<div style="font-size: 9px; font-weight: 700; color: ${color}; margin-top: 1.5px;">${icon} ${text}</div>`;
            })()}
            ${it.faultCode && it.faultCode !== '-' ? `<div style="font-size: 8.5px; color: #b45309; margin-top: 1px;">Arıza: ${it.faultCode}</div>` : ''}
          </td>
          <td style="border: 1px solid #475569; padding: 5px 3px; text-align: center; font-weight: bold; font-size: 11px;">${it.quantity}</td>
          <td style="border: 1px solid #475569; padding: 5px 3px; text-align: center; font-size: 10px;">Adet</td>
        </tr>
      `).join('');

      const htmlContent = `
        <div id="dispatch-pdf-container" style="font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 12px; box-sizing: border-box; width: 710px; max-width: 710px;">
          <!-- Top Header Table -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 2px solid #002d6b; padding-bottom: 8px; margin-bottom: 10px;">
            <tr>
              <td style="width: 30%; vertical-align: middle;">
                <div style="font-weight: 900; font-size: 17px; color: #002d6b; letter-spacing: 0.5px;">DEMİRER HOLDİNG</div>
                <div style="font-size: 9px; color: #64748b; font-weight: 600; margin-top: 1px;">RÜZGAR ENERJİ SANTRALLERİ</div>
              </td>
              <td style="width: 44%; text-align: center; vertical-align: middle;">
                <div style="font-size: 13px; font-weight: 900; color: #0f172a; text-transform: uppercase;">MERKEZ TAMİR ATÖLYESİ (MTA)</div>
                <div style="font-size: 11px; font-weight: 700; color: #002d6b; margin-top: 2px;">REVİZE MALZEME SEVK & TESLİM-TESELLÜM FORMU</div>
              </td>
              <td style="width: 26%; text-align: right; vertical-align: middle;">
                <div style="font-size: 12px; font-weight: 800; font-family: monospace; color: #002d6b; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; white-space: nowrap;">${displayFormNo}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 3px; white-space: nowrap;">Tarih: ${dateStr}</div>
              </td>
            </tr>
          </table>

          <!-- Meta Information Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px;">
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">🏢 Çıkış Deposu:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 700; width: 28%;">Merkez Tamir Atölyesi (MTA)</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">📍 Hedef Saha / Depo:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #002d6b; font-size: 11.5px; width: 28%;">${data.targetWarehouseName}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">👨‍🔧 Teslim Eden (Atölye):</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 700;">${formattedSender}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">👤 Teslim Alacak Sorumlu:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #b45309;">${formattedRecipient}</td>
            </tr>
            ${data.note ? `
              <tr>
                <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">📝 Kargo / Sevk Notu:</td>
                <td colspan="3" style="padding: 5px 6px; border: 1px solid #cbd5e1; color: #334155;">${data.note}</td>
              </tr>
            ` : ''}
          </table>

          <!-- Materials Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 6px; table-layout: fixed;">
            <thead>
              <tr style="background: #e2e8f0; color: #0f172a;">
                <th style="border: 1px solid #475569; padding: 6px 3px; width: 26px; text-align: center; font-size: 10.5px;">#</th>
                <th style="border: 1px solid #475569; padding: 6px 4px; width: 75px; font-size: 10.5px; text-align: left;">SAP No</th>
                <th style="border: 1px solid #475569; padding: 6px 4px; width: 85px; font-size: 10.5px; text-align: left;">Seri No</th>
                <th style="border: 1px solid #475569; padding: 6px 6px; font-size: 10.5px; text-align: left;">Malzeme Tanımı & Onarım Özeti</th>
                <th style="border: 1px solid #475569; padding: 6px 3px; width: 48px; text-align: center; font-size: 10.5px;">Miktar</th>
                <th style="border: 1px solid #475569; padding: 6px 3px; width: 44px; text-align: center; font-size: 10.5px;">Birim</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9;">
                <td colspan="4" style="border: 1px solid #475569; padding: 6px 8px; text-align: right; font-weight: 800; font-size: 10.5px;">TOPLAM SEVK MİKTARI:</td>
                <td style="border: 1px solid #475569; padding: 6px 3px; text-align: center; font-weight: 900; font-size: 11.5px; color: #002d6b;">${totalQty}</td>
                <td style="border: 1px solid #475569; padding: 6px 3px; text-align: center; font-weight: bold; font-size: 10.5px;">Adet</td>
              </tr>
            </tfoot>
          </table>

          <!-- Signatures Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 24px; page-break-inside: avoid;">
            <tr>
              <td style="width: 48%; border: 1px solid #64748b; padding: 8px 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 10.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  TESLİM EDEN (MTA ATÖLYE SORUMLUSU)
                </div>
                <div style="font-size: 10.5px; margin-top: 6px; font-weight: 600;">Ad Soyad: ${formattedSender}</div>
                <div style="font-size: 10.5px; margin-top: 22px; color: #64748b;">İmza: ___________________________</div>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; border: 1px solid #64748b; padding: 8px 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 10.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  TESLİM ALAN (LOJİSTİK & AMBAR SORUMLUSU)
                </div>
                <div style="font-size: 10.5px; margin-top: 6px; font-weight: 600;">Ad Soyad: ${formattedRecipient}</div>
                <div style="font-size: 10.5px; margin-top: 22px; color: #64748b;">İmza: ___________________________</div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 18px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            Bu resmi belge Demirer Holding Saha Servis & Atölye Yönetim Sistemi (DH-Servis) tarafından üretilmiştir.
          </div>
        </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 710px; background: #ffffff; z-index: -99999;';
      wrapper.innerHTML = htmlContent;
      document.body.appendChild(wrapper);

      const targetElement = (wrapper.querySelector('#dispatch-pdf-container') || wrapper.firstElementChild || wrapper) as HTMLElement;
      if (targetElement) {
        targetElement.style.width = '710px';
        targetElement.style.minWidth = '710px';
        targetElement.style.maxWidth = '710px';
        targetElement.style.margin = '0';
        targetElement.style.padding = '12px';
        targetElement.style.boxSizing = 'border-box';
        targetElement.style.background = '#ffffff';
      }

      await new Promise(r => setTimeout(r, 400));

      const opt = {
        margin: [8, 8, 8, 8],
        filename: `Malzeme_Sevk_Formu_${data.dispatchNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff'
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], before: ['.html2pdf__page-break', '.section-break'], avoid: ['tr', '.pdf-no-break', 'img'] }
      };

      const originalHtmlFontSize = document.documentElement.style.fontSize;
      document.documentElement.style.fontSize = '12px';

      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = await (window as any).html2pdf().set(opt).from(targetElement).outputPdf('blob');
      } finally {
        document.documentElement.style.fontSize = originalHtmlFontSize;
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      }

      if (pdfBlob && pdfBlob.size > 1000) {
        console.log(`[EmailService] Resmi Sevk Formu PDF'i üretildi: Malzeme_Sevk_Formu_${data.dispatchNo}.pdf (${pdfBlob.size} bytes)`);
        return new File([pdfBlob], `Malzeme_Sevk_Formu_${data.dispatchNo}.pdf`, { type: 'application/pdf' });
      }
    } catch (e) {
      console.warn('[EmailService] Sevk PDF üretimi hatası:', e);
    }
    return null;
  }

  /**
   * Sends formal workshop dispatch email notification for repaired materials with A4 PDF attachment.
   */
  async sendWorkshopDispatchEmail(
    dispatchData: {
      dispatchNo: string;
      targetWarehouseName: string;
      recipientName: string;
      senderName: string;
      note?: string;
      items: Array<{
        sapNo: string;
        serialNo?: string;
        description: string;
        quantity: number;
        repairNotes?: string;
        faultCode?: string;
      }>;
    },
    customRecipient?: string
  ): Promise<{ success: boolean; message: string }> {
    let recipient = customRecipient;
    if (!recipient) {
      try {
        const configured = await emailSettingsService.getRecipients('dispatchEmails');
        recipient = configured.length > 0 ? configured.join(', ') : DEFAULT_DISPATCH_EMAILS;
      } catch {
        recipient = DEFAULT_DISPATCH_EMAILS;
      }
    }
    const subject = `[DH-SERVİS MALZEME SEVK] Merkez Tamir Atölyesi ➔ ${dispatchData.targetWarehouseName} (${dispatchData.dispatchNo})`;
    const htmlBody = this.buildDispatchEmailHTML(dispatchData);

    try {
      // Generate Real A4 PDF Attachment for Sevk Formu
      const pdfFile = await this.generateDispatchPDFFile(dispatchData);
      let base64Content = '';
      if (pdfFile) {
        base64Content = await this.blobToBase64(pdfFile);
      }

      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          html: htmlBody,
          pdfBase64: base64Content,
          filename: `Malzeme_Sevk_Formu_${dispatchData.dispatchNo}.pdf`
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Malzeme sevk maili ve PDF eki başarıyla iletildi: ${dispatchData.dispatchNo}`);
        if ((window as any).showToast) {
          (window as any).showToast('E-POSTA & PDF GÖNDERİLDİ', `Sevk bildirimi ve resmi PDF formu iletildi.`, 'success');
        }
        return { success: true, message: 'E-posta ve PDF başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] E-posta gönderim uyarısı:', errStr);
        if ((window as any).showToast) {
          (window as any).showToast('E-POSTA BİLDİRİMİ', `Durum: ${errStr}`, 'info');
        }
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] E-posta gönderim hatası:', err);
      return { success: false, message: `E-posta gönderilemedi: ${err?.message || err}` };
    }
  }

  private buildDispatchEmailHTML(data: {
    dispatchNo: string;
    targetWarehouseName: string;
    recipientName: string;
    senderName: string;
    note?: string;
    items: Array<{
      sapNo: string;
      serialNo?: string;
      description: string;
      quantity: number;
      repairNotes?: string;
      faultCode?: string;
    }>;
  }): string {
    const dateStr = new Date().toLocaleString('tr-TR');
    const totalQty = data.items.reduce((sum, it) => sum + (it.quantity || 1), 0);

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 700px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 4px solid #14F195; }
          .content { padding: 24px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .materials-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 10px; }
          .materials-table th { background-color: #F1F5F9; color: #475569; padding: 10px 8px; border: 1px solid #CBD5E1; text-align: left; font-weight: 700; }
          .materials-table td { padding: 8px; border: 1px solid #E2E8F0; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #14F195; letter-spacing: 1px;">DEMİRER HOLDİNG - MALZEME SEVK BİLDİRİMİ</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #94A3B8;">Merkez Tamir Atölyesi (MTA) ➔ Onarılan Malzeme Transferi</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">📄 Sevk / MÇT No:</td>
                <td class="info-val" style="color: #2563EB; font-family: monospace; font-size: 15px;">${data.dispatchNo}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Sevk Tarihi:</td>
                <td class="info-val">${dateStr}</td>
              </tr>
              <tr>
                <td class="info-label">🏢 Çıkış Deposu:</td>
                <td class="info-val">Merkez Tamir Atölyesi (MTA)</td>
              </tr>
              <tr>
                <td class="info-label">📍 Hedef Saha / Depo:</td>
                <td class="info-val" style="color: #10B981; font-weight: 700;">${data.targetWarehouseName}</td>
              </tr>
              <tr>
                <td class="info-label">👨‍🔧 Sevk Eden (Atölye):</td>
                <td class="info-val">${data.senderName}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Teslim Alacak Sorumlu:</td>
                <td class="info-val" style="color: #D97706; font-weight: 700;">${data.recipientName}</td>
              </tr>
              ${data.note ? `
                <tr>
                  <td class="info-label">📝 Sevk Notu:</td>
                  <td class="info-val" style="color: #475569;">${data.note}</td>
                </tr>
              ` : ''}
            </table>

            <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #14F195; padding-bottom: 4px;">
              📦 Sevk Edilen Revize Sağlam Malzemeler (${data.items.length} Kalem, ${totalQty} Adet)
            </h3>
            
            <table class="materials-table">
              <thead>
                <tr>
                  <th style="width: 30px; text-align: center;">#</th>
                  <th style="width: 80px;">SAP No</th>
                  <th style="width: 100px;">Seri No</th>
                  <th>Malzeme Tanımı & Onarım Notu</th>
                  <th style="width: 60px; text-align: center;">Miktar</th>
                </tr>
              </thead>
              <tbody>
                ${data.items.map((it, idx) => `
                  <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                    <td style="text-align: center; font-weight: bold; color: #64748B;">${idx + 1}</td>
                    <td style="font-family: monospace; font-weight: bold; color: #2563EB;">${it.sapNo}</td>
                    <td style="font-family: monospace; font-weight: bold; color: #10B981;">${it.serialNo || '-'}</td>
                    <td>
                      <div style="font-weight: 600; color: #0F172A;">${it.description}</div>
                      ${(() => {
                        const raw = String(it.repairNotes || '').trim();
                        const isTurbine = raw.toLowerCase().includes('türbinde') || raw.toLowerCase().includes('turbinde');
                        const hasCustom = raw && raw.toLowerCase() !== 'onarım bekliyor' && raw.toLowerCase() !== 'onarim bekliyor' && !raw.includes('Onarıldı');
                        const text = isTurbine
                          ? (hasCustom ? `6. Onarıldı (Türbinde Test) - ${raw}` : '6. Onarıldı (Türbinde Test)')
                          : (hasCustom ? `5. Onarıldı & Test Edildi - ${raw}` : '5. Onarıldı & Test Edildi');
                        const color = isTurbine ? '#d97706' : '#059669';
                        const icon = isTurbine ? '⚠️' : '✅';
                        return `<div style="font-size: 11px; font-weight: 700; color: ${color}; margin-top: 2px;">${icon} ${text}</div>`;
                      })()}
                      ${it.faultCode && it.faultCode !== '-' ? `<div style="font-size: 11px; color: #D97706; margin-top: 1px;">⚠️ Arıza: ${it.faultCode}</div>` : ''}
                    </td>
                    <td style="text-align: center; font-weight: 700; color: #0F172A;">${it.quantity} Adet</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <div class="footer">
            Bu e-posta <strong>DH-Servis Otomasyon Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Merkez Tamir Atölyesi (MTA) ve Saha Depoları Malzeme Takip Modülü.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Sends email notification when a damaged material is rejected at warehouse and returned to MTA.
   */
  async sendDamageReturnEmail(data: {
    returnFormNo: string;
    warehouseName: string;
    user: string;
    reason: string;
    damageImageUrl?: string;
    item: {
      sapNo: string;
      serialNo?: string;
      description: string;
      quantity?: number;
      originalDispatchNo?: string;
      faultCode?: string;
    };
  }): Promise<{ success: boolean; message: string }> {
    let recipient = DEFAULT_DISPATCH_EMAILS;
    try {
      const configured = await emailSettingsService.getRecipients('damageReturnEmails');
      if (configured.length > 0) recipient = configured.join(', ');
    } catch {
      recipient = DEFAULT_DISPATCH_EMAILS;
    }
    const subject = `[DH-SERVİS SEVK HASARI İADESİ] ${data.warehouseName} ➔ MTA (${data.returnFormNo})`;
    const htmlBody = this.buildDamageReturnEmailHTML(data);

    try {
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          html: htmlBody
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Hasar iade maili başarıyla iletildi: ${data.returnFormNo}`);
        if ((window as any).showToast) {
          (window as any).showToast('İADE BİLDİRİMİ GÖNDERİLDİ', 'Hasar tutanağı ve bildirim e-postası yöneticilere iletildi.', 'success');
        }
        return { success: true, message: 'E-posta başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] Hasar iade e-posta uyarısı:', errStr);
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] Hasar iade e-posta hatası:', err);
      return { success: false, message: `E-posta gönderilemedi: ${err?.message || err}` };
    }
  }

  private buildDamageReturnEmailHTML(data: {
    returnFormNo: string;
    warehouseName: string;
    user: string;
    reason: string;
    damageImageUrl?: string;
    item: {
      sapNo: string;
      serialNo?: string;
      description: string;
      quantity?: number;
      originalDispatchNo?: string;
      faultCode?: string;
    };
  }): string {
    const dateStr = new Date().toLocaleString('tr-TR');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 680px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #7F1D1D 0%, #1E1B4B 100%); color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 4px solid #EF4444; }
          .content { padding: 24px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .info-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .reason-box { background: #FEF2F2; border: 1px solid #FECACA; border-left: 4px solid #EF4444; border-radius: 6px; padding: 14px 16px; margin: 16px 0; }
          .photo-box { text-align: center; margin: 16px 0; padding: 14px; background: #F8FAFC; border: 1px dashed #CBD5E1; border-radius: 8px; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #FCA5A5; letter-spacing: 0.5px;">DEMİRER HOLDİNG - SEVK HASARI İADE TUTANAĞI</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #E2E8F0;">${data.warehouseName} ➔ Merkez Tamir Atölyesi (MTA)</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">📋 İade Form No:</td>
                <td class="info-val" style="color: #DC2626; font-family: monospace; font-size: 15px; font-weight: 800;">${data.returnFormNo}</td>
              </tr>
              <tr>
                <td class="info-label">🏢 İade Eden Saha / Depo:</td>
                <td class="info-val">${data.warehouseName}</td>
              </tr>
              <tr>
                <td class="info-label">📦 Gelen Sevk / MÇT No:</td>
                <td class="info-val" style="font-family: monospace;">${data.item.originalDispatchNo || '-'}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Bildiren Personel:</td>
                <td class="info-val">${data.user}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Tutanak Tarihi:</td>
                <td class="info-val">${dateStr}</td>
              </tr>
            </table>

            <h3 style="font-size: 15px; color: #0F172A; margin: 18px 0 8px 0; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">İade Edilen Malzeme Bilgileri</h3>
            <table class="info-table">
              <tr>
                <td class="info-label">SAP No:</td>
                <td class="info-val" style="font-family: monospace; color: #0284C7; font-weight: 800;">${data.item.sapNo}</td>
              </tr>
              <tr>
                <td class="info-label">Seri No:</td>
                <td class="info-val" style="font-family: monospace; font-weight: 800;">${data.item.serialNo || '-'}</td>
              </tr>
              <tr>
                <td class="info-label">Malzeme Tanımı:</td>
                <td class="info-val">${data.item.description}</td>
              </tr>
              <tr>
                <td class="info-label">Miktar:</td>
                <td class="info-val" style="color: #DC2626; font-weight: 800;">${data.item.quantity || 1} Adet</td>
              </tr>
            </table>

            <div class="reason-box">
              <strong style="color: #991B1B; display: block; margin-bottom: 6px; font-size: 14px;">⚠️ Hasar Açıklaması / Tespit Tutanağı:</strong>
              <div style="color: #7F1D1D; font-size: 13.5px; line-height: 1.5; white-space: pre-wrap;">${data.reason}</div>
            </div>

            ${data.damageImageUrl ? `
              <div class="photo-box">
                <strong style="color: #475569; display: block; margin-bottom: 8px; font-size: 13px;">📷 Tutanak Fotoğrafı / Hasar Görseli:</strong>
                <a href="${data.damageImageUrl}" target="_blank" style="display: inline-block; text-decoration: none;">
                  <img src="${data.damageImageUrl}" alt="Hasar Fotoğrafı" style="max-width: 100%; max-height: 280px; border-radius: 8px; border: 1px solid #CBD5E1; box-shadow: 0 2px 4px rgba(0,0,0,0.1);" />
                  <span style="display: block; font-size: 12px; color: #2563EB; margin-top: 6px;">🔍 Fotoğrafı Tam Boyutta Görüntülemek İçin Tıklayın</span>
                </a>
              </div>
            ` : ''}

          </div>

          <div class="footer">
            Bu e-posta <strong>DH-Servis Otomasyon Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Merkez Tamir Atölyesi (MTA) ve Saha Depoları Sevk Kontrol Modülü.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Sends Warehouse Inventory Audit Report to managers (Fatih Zebek, Hurşit Akter, Emir Ünver).
   */
  async sendAuditReportEmail(data: {
    warehouseName: string;
    warehouseId: string;
    user: string;
    date: string;
    time?: string;
    totalItems: number;
    compliantItems: number;
    surplusItems: number;
    deficitItems: number;
    totalDiff: number;
    discrepancies: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): Promise<{ success: boolean; message: string }> {
    let recipient = 'fatih.zebek@demirerholding.com, hursit.akter@demirerholding.com, emir.unver@demirerholding.com';
    try {
      const configured = await emailSettingsService.getRecipients('auditReportEmails');
      if (configured.length > 0) recipient = configured.join(', ');
    } catch {
      recipient = 'fatih.zebek@demirerholding.com, hursit.akter@demirerholding.com, emir.unver@demirerholding.com';
    }
    const hasDiscrepancy = data.discrepancies.length > 0;
    const diffStatus = hasDiscrepancy ? `⚠️ ${data.discrepancies.length} Kalem Fark Bulundu` : `✅ 0 Fark (Birebir Uyumlu)`;
    const subject = `[DH-SERVİS SAYIM RAPORU] ${data.warehouseName} - ${data.user} (${diffStatus})`;
    const htmlBody = this.buildAuditReportEmailHTML(data);

    try {
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          html: htmlBody
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Sayım raporu başarıyla iletildi: ${data.warehouseName}`);
        if ((window as any).showToast) {
          (window as any).showToast('SAYIM RAPORU İLETİLDİ', `Sayım raporu ve fark detayları yöneticilere e-posta ile gönderildi.`, 'success');
        }
        return { success: true, message: 'Sayım raporu e-postası başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] Sayım raporu gönderim uyarısı:', errStr);
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] Sayım raporu mail hatası:', err);
      return { success: false, message: err?.message || 'E-posta gönderilemedi' };
    }
  }

  /**
   * Sends Warehouse Inventory Audit Approval notification to managers and the counting team.
   */
  async sendAuditApprovalEmail(data: {
    warehouseName: string;
    warehouseId: string;
    approver: string;
    user: string;
    userEmail?: string;
    date: string;
    time?: string;
    totalItems: number;
    totalDiff: number;
    discrepancies?: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): Promise<{ success: boolean; message: string }> {
    let managers = ['fatih.zebek@demirerholding.com', 'hursit.akter@demirerholding.com', 'emir.unver@demirerholding.com'];
    try {
      const configured = await emailSettingsService.getRecipients('auditApprovalEmails');
      if (configured.length > 0) managers = configured;
    } catch {
      // fallback to managers
    }
    const recipientList = new Set<string>();
    
    if (data.userEmail && data.userEmail.includes('@')) {
      recipientList.add(data.userEmail.trim());
    }
    managers.forEach(m => recipientList.add(m));

    const to = Array.from(recipientList).join(', ');
    const subject = `[DH-SERVİS SAYIM ONAYI] ${data.warehouseName} - Sayım Onaylandı (${data.approver})`;
    const htmlBody = this.buildAuditApprovalEmailHTML(data);

    try {
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to,
          subject: subject,
          html: htmlBody
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Sayım onay bildirimi iletildi: ${data.warehouseName} -> ${to}`);
        if ((window as any).showToast) {
          (window as any).showToast('SAYIM ONAYLANDI', `Sayım onaylandı ve onay bildirimi e-posta ile iletildi.`, 'success');
        }
        return { success: true, message: 'Sayım onay bildirimi e-postası başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] Sayım onay bildirimi mail uyarısı:', errStr);
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] Sayım onay bildirimi mail hatası:', err);
      return { success: false, message: err?.message || 'E-posta gönderilemedi' };
    }
  }

  /**
   * Builds executive HTML email for warehouse count approval.
   */
  private buildAuditApprovalEmailHTML(data: {
    warehouseName: string;
    warehouseId: string;
    approver: string;
    user: string;
    date: string;
    time?: string;
    totalItems: number;
    totalDiff: number;
    discrepancies?: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): string {
    const timeStr = data.time || new Date().toLocaleTimeString('tr-TR');
    const totalDiffText = data.totalDiff > 0 ? `+${data.totalDiff}` : `${data.totalDiff}`;
    const discrepancies = data.discrepancies || [];
    const hasDiscrepancy = discrepancies.length > 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 12px; }
          .card { max-width: 680px; width: 100%; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF; padding: 20px; text-align: center; border-bottom: 4px solid #10B981; }
          .content { padding: 18px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .info-table td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .badge-approved { background-color: #D1FAE5; color: #065F46; border: 1px solid #A7F3D0; padding: 6px 14px; border-radius: 6px; font-weight: 800; font-size: 13px; display: inline-block; }
          .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; }
          .diff-table { width: 100%; min-width: 320px; border-collapse: collapse; font-size: 12px; }
          .diff-table th { background: #0F172A; color: #FFFFFF; padding: 8px 6px; text-align: left; font-size: 11px; border: 1px solid #334155; text-transform: uppercase; }
          .diff-table td { padding: 8px 6px; border: 1px solid #E2E8F0; vertical-align: top; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 14px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #10B981;">DEMİRER HOLDİNG SAYIM ONAY BİLDİRİMİ</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #E2E8F0;">${data.warehouseName} - Depo Stokları Güncellendi</p>
          </div>
          
          <div class="content">
            <div style="margin-bottom: 16px; text-align: center;">
              <span class="badge-approved">✅ SAYIM YÖNETİCİ TARAFINDAN ONAYLANDI & STOKLAR GÜNCELLENDİ</span>
            </div>

            <table class="info-table">
              <tr>
                <td class="info-label">🏢 Depo:</td>
                <td class="info-val">${data.warehouseName}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Onaylayan Yönetici:</td>
                <td class="info-val" style="color: #10B981; font-weight: 800;">${data.approver}</td>
              </tr>
              <tr>
                <td class="info-label">👷 Sayımı Gerçekleştiren Ekip:</td>
                <td class="info-val">${data.user}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Onay Tarihi / Saati:</td>
                <td class="info-val">${data.date} - ${timeStr}</td>
              </tr>
              <tr>
                <td class="info-label">📦 Toplam Sayılan Kalem:</td>
                <td class="info-val" style="font-weight: 800;">${data.totalItems} Kalem</td>
              </tr>
              <tr>
                <td class="info-label">📊 Toplam Net Stok Farkı:</td>
                <td class="info-val" style="font-weight: 800; color: ${data.totalDiff < 0 ? '#EF4444' : (data.totalDiff > 0 ? '#F59E0B' : '#10B981')}; font-family: monospace;">${totalDiffText} Adet</td>
              </tr>
            </table>

            ${hasDiscrepancy ? `
              <h3 style="font-size: 14px; color: #0F172A; margin: 18px 0 8px 0; border-bottom: 2px solid #E2E8F0; padding-bottom: 6px;">
                📋 Onaylanan Stok Farkları & Düzenlemeler (${discrepancies.length} Kalem)
              </h3>
              <div class="table-responsive">
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th style="width: 24px; text-align: center;">#</th>
                      <th>Malzeme & Açıklama</th>
                      <th style="text-align: center; width: 44px;">Sistem</th>
                      <th style="text-align: center; width: 44px;">Fizik</th>
                      <th style="text-align: center; width: 58px;">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${discrepancies.map((d, idx) => `
                      <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                        <td style="text-align: center; color: #64748B; font-weight: bold; font-size: 11px;">${idx + 1}</td>
                        <td>
                          <div style="margin-bottom: 2px;">
                            <span style="font-family: monospace; font-weight: 700; color: #0F172A; font-size: 12px;">${d.sapNo}</span>
                            ${d.shelfNo ? `<span style="color: #64748B; font-size: 11px; margin-left: 6px; background: #F1F5F9; padding: 1px 5px; border-radius: 3px;">📍 ${d.shelfNo}</span>` : ''}
                          </div>
                          <div style="font-weight: 600; color: #334155; font-size: 12px; line-height: 1.3;">${d.description}</div>
                          ${d.note ? `
                            <div style="margin-top: 5px; padding: 4px 8px; background: #F0FDF4; border-left: 3px solid #10B981; border-radius: 3px; font-size: 11px; color: #065F46; font-weight: 600; line-height: 1.3;">
                              💬 <em>"${d.note}"</em>
                            </div>
                          ` : ''}
                        </td>
                        <td style="text-align: center; font-weight: 600; font-size: 12px;">${d.systemQty}</td>
                        <td style="text-align: center; font-weight: 700; color: #0F172A; font-size: 12px;">${d.physicalQty}</td>
                        <td style="text-align: center; font-weight: 800; font-size: 12px; color: ${d.diff < 0 ? '#EF4444' : '#F59E0B'};">
                          <span style="background: ${d.diff < 0 ? '#FEE2E2' : '#FEF3C7'}; color: ${d.diff < 0 ? '#991B1B' : '#92400E'}; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                            ${d.diff > 0 ? '+' + d.diff : d.diff}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 12px; border-radius: 6px; font-size: 13px; color: #166534; text-align: center;">
                ✨ Sayım sonucunda sistem stoğu ile fiziksel stok arasında 0 fark tespit edilmiştir. Tüm kalemler birebir uyumludur.
              </div>
            `}
          </div>

          <div class="footer">
            Bu bildirim <strong>DH-Servis Saha & Depo Yönetim Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Demirer Holding Rüzgar Enerji Santralleri Teknik Operasyonlar
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Builds clean, executive HTML email for warehouse count report.
   */
  private buildAuditReportEmailHTML(data: {
    warehouseName: string;
    warehouseId: string;
    user: string;
    date: string;
    time?: string;
    totalItems: number;
    compliantItems: number;
    surplusItems: number;
    deficitItems: number;
    totalDiff: number;
    discrepancies: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): string {
    const timeStr = data.time || new Date().toLocaleTimeString('tr-TR');
    const totalDiffText = data.totalDiff > 0 ? `+${data.totalDiff}` : `${data.totalDiff}`;
    const hasDiscrepancy = data.discrepancies.length > 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 12px; }
          .card { max-width: 680px; width: 100%; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF; padding: 20px; text-align: center; border-bottom: 4px solid #F59E0B; }
          .content { padding: 18px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .info-table td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; }
          .diff-table { width: 100%; min-width: 320px; border-collapse: collapse; font-size: 12px; }
          .diff-table th { background: #0F172A; color: #FFFFFF; padding: 8px 6px; text-align: left; font-size: 11px; border: 1px solid #334155; text-transform: uppercase; }
          .diff-table td { padding: 8px 6px; border: 1px solid #E2E8F0; vertical-align: top; }
          .notice-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px; border-radius: 4px; font-size: 12px; color: #92400E; margin-top: 20px; line-height: 1.5; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 14px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #F59E0B;">DEMİRER HOLDİNG DEPO SAYIM RAPORU</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #E2E8F0;">${data.warehouseName} - Saha Depo Sayımı</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">🏢 Sayım Yapılan Depo:</td>
                <td class="info-val" style="color: #2563EB; font-size: 14px;">${data.warehouseName}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Sayımı Yapan Personel:</td>
                <td class="info-val">${data.user}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Sayım Tarihi & Saati:</td>
                <td class="info-val">${data.date} - ${timeStr}</td>
              </tr>
              <tr>
                <td class="info-label">⚡ Sayım Durumu:</td>
                <td class="info-val">
                  <span style="background: #FEF3C7; color: #92400E; padding: 3px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; border: 1px solid #FCD34D;">
                    ⏳ YÖNETİCİ ONAYI BEKLİYOR (Stoklar Değişmedi)
                  </span>
                </td>
              </tr>
            </table>

            <!-- KPI STATS -->
            <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 10px; margin-bottom: 18px;">
              <table style="width: 100%; border-collapse: collapse; text-align: center; table-layout: fixed;">
                <tr>
                  <td style="padding: 4px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 16px; font-weight: 800; color: #0F172A;">${data.totalItems}</div>
                    <div style="font-size: 9px; color: #64748B; font-weight: bold; line-height: 1.1;">TOPLAM</div>
                  </td>
                  <td style="padding: 4px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 16px; font-weight: 800; color: #10B981;">${data.compliantItems}</div>
                    <div style="font-size: 9px; color: #10B981; font-weight: bold; line-height: 1.1;">UYUMLU</div>
                  </td>
                  <td style="padding: 4px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 16px; font-weight: 800; color: #F59E0B;">${data.surplusItems}</div>
                    <div style="font-size: 9px; color: #F59E0B; font-weight: bold; line-height: 1.1;">FAZLA</div>
                  </td>
                  <td style="padding: 4px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 16px; font-weight: 800; color: #EF4444;">${data.deficitItems}</div>
                    <div style="font-size: 9px; color: #EF4444; font-weight: bold; line-height: 1.1;">EKSİK</div>
                  </td>
                  <td style="padding: 4px;">
                    <div style="font-size: 16px; font-weight: 800; color: ${data.totalDiff < 0 ? '#EF4444' : (data.totalDiff > 0 ? '#F59E0B' : '#10B981')};">${totalDiffText}</div>
                    <div style="font-size: 9px; color: #64748B; font-weight: bold; line-height: 1.1;">NET FARK</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- DISCREPANCY TABLE -->
            <h3 style="color: #0F172A; font-size: 14px; margin-bottom: 8px; border-bottom: 2px solid ${hasDiscrepancy ? '#EF4444' : '#10B981'}; padding-bottom: 4px;">
              ${hasDiscrepancy ? `⚠️ FARK ÇIKAN MALZEMELER (${data.discrepancies.length} Kalem)` : `✅ TÜM MALZEMELER STOKLA BİREBİR UYUMLU`}
            </h3>

            ${hasDiscrepancy ? `
              <div class="table-responsive">
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th style="width: 24px; text-align: center;">#</th>
                      <th>Malzeme & Açıklama</th>
                      <th style="width: 44px; text-align: center;">Sistem</th>
                      <th style="width: 44px; text-align: center;">Fizik</th>
                      <th style="width: 58px; text-align: center;">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.discrepancies.map((d, idx) => {
                      const isDeficit = d.diff < 0;
                      const diffBadge = isDeficit 
                        ? `<span style="background: #FEE2E2; color: #991B1B; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 11px; display: inline-block;">${d.diff}</span>`
                        : `<span style="background: #FEF3C7; color: #92400E; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 11px; display: inline-block;">+${d.diff}</span>`;

                      return `
                        <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                          <td style="text-align: center; color: #64748B; font-weight: bold; font-size: 11px;">${idx + 1}</td>
                          <td>
                            <div style="margin-bottom: 2px;">
                              <span style="font-family: monospace; font-weight: 700; color: #2563EB; font-size: 12px;">${d.sapNo}</span>
                              ${d.shelfNo ? `<span style="color: #64748B; font-size: 11px; margin-left: 6px; background: #F1F5F9; padding: 1px 5px; border-radius: 3px;">📍 ${d.shelfNo}</span>` : ''}
                            </div>
                            <div style="font-weight: 700; color: #0F172A; font-size: 12px; line-height: 1.3;">${d.description}</div>
                            ${d.note ? `
                              <div style="margin-top: 5px; padding: 4px 8px; background: #FFFBEB; border-left: 3px solid #F59E0B; border-radius: 3px; font-size: 11px; color: #92400E; font-weight: 600; line-height: 1.3;">
                                💬 <em>"${d.note}"</em>
                              </div>
                            ` : ''}
                          </td>
                          <td style="text-align: center; font-weight: 600; color: #475569; font-size: 12px;">${d.systemQty}</td>
                          <td style="text-align: center; font-weight: 700; color: #0F172A; font-size: 12px;">${d.physicalQty}</td>
                          <td style="text-align: center;">${diffBadge}</td>
                        </tr>
                      `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            ` : `
              <div style="background: #DCFCE7; border: 1px solid #86EFAC; color: #166534; padding: 12px; border-radius: 6px; font-size: 13px; text-align: center; font-weight: 600;">
                Bu sayımda tüm kalemler sistem kayıtlarıyla birebir (%100) uyumlu çıkmıştır.
              </div>
            `}

            <!-- MANAGER NOTICE BOX -->
            <div class="notice-box">
              <strong>🔒 EMNİYET & KONTROL BİLGİLENDİRMESİ:</strong><br>
              Depo stokları personelin sayımı sonrası <strong>otomatik olarak değiştirilmemiştir</strong>.<br>
              Fiziksel sayım miktarlarının sistem stoğuna yansıtılması için <strong>Emir Ünver</strong> veya <strong>Hurşit Akter</strong> tarafından DH-Servis sistemindeki <em>"Depo Yönetimi ➔ Sayım Geçmişi"</em> ekranından onaylanması gerekmektedir.
            </div>

          </div>

          <div class="footer">
            Bu e-posta <strong>DH-Servis Otomasyon Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Demirer Holding Depo Sayım ve Malzeme Yönetim Modülü.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Sends Warehouse Inventory Audit Revision / Correction request to the team who performed the count.
   */
  async sendAuditRevisionEmail(data: {
    warehouseName: string;
    warehouseId: string;
    user: string;
    userEmail?: string;
    managerName: string;
    note: string;
    date?: string;
    discrepancies?: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): Promise<{ success: boolean; message: string }> {
    let managers = ['fatih.zebek@demirerholding.com', 'hursit.akter@demirerholding.com', 'emir.unver@demirerholding.com'];
    try {
      const configured = await emailSettingsService.getRecipients('auditRevisionEmails');
      if (configured.length > 0) managers = configured;
    } catch {
      // fallback to managers
    }
    const recipientList = new Set<string>();
    
    if (data.userEmail && data.userEmail.includes('@')) {
      recipientList.add(data.userEmail.trim());
    }
    managers.forEach(m => recipientList.add(m));

    const to = Array.from(recipientList).join(', ');
    const subject = `[DH-SERVİS DÜZELTME TALEBİ] ${data.warehouseName} - Sayım Kontrolü İsteği (${data.user})`;
    const htmlBody = this.buildAuditRevisionEmailHTML(data);

    try {
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: to,
          subject: subject,
          html: htmlBody
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Sayım düzeltme talebi iletildi: ${data.warehouseName} -> ${to}`);
        if ((window as any).showToast) {
          (window as any).showToast('DÜZELTME TALEBİ İLETİLDİ', `Sayım düzeltme talebi ekibe (${data.user}) e-posta ile gönderildi.`, 'warning');
        }
        return { success: true, message: 'Düzeltme talebi e-postası başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] Düzeltme talebi mail uyarısı:', errStr);
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] Düzeltme talebi mail hatası:', err);
      return { success: false, message: err?.message || 'E-posta gönderilemedi' };
    }
  }

  /**
   * Builds clean HTML email for audit revision request.
   */
  private buildAuditRevisionEmailHTML(data: {
    warehouseName: string;
    warehouseId: string;
    user: string;
    managerName: string;
    note: string;
    date?: string;
    discrepancies?: Array<{
      sapNo: string;
      description: string;
      shelfNo?: string;
      systemQty: number;
      physicalQty: number;
      diff: number;
      note?: string;
    }>;
  }): string {
    const dateStr = data.date || new Date().toLocaleString('tr-TR');
    const hasDiscrepancy = data.discrepancies && data.discrepancies.length > 0;

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 12px; }
          .card { max-width: 680px; width: 100%; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #78350F 0%, #D97706 100%); color: #FFFFFF; padding: 20px; text-align: center; border-bottom: 4px solid #B45309; }
          .content { padding: 18px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          .info-table td { padding: 8px 10px; border-bottom: 1px solid #F1F5F9; font-size: 13px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .alert-box { background-color: #FEF3C7; border: 2px solid #F59E0B; border-radius: 8px; padding: 14px; margin: 16px 0; }
          .action-box { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 12px; border-radius: 4px; font-size: 12px; color: #1E40AF; margin-top: 18px; line-height: 1.5; }
          .table-responsive { width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch; margin-top: 10px; }
          .diff-table { width: 100%; min-width: 320px; border-collapse: collapse; font-size: 12px; }
          .diff-table th { background: #0F172A; color: #FFFFFF; padding: 8px 6px; text-align: left; font-size: 11px; border: 1px solid #334155; }
          .diff-table td { padding: 8px 6px; border: 1px solid #E2E8F0; vertical-align: top; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 14px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #FFFFFF;">⚠️ SAYIM DÜZELTME & YENİDEN KONTROL TALEBİ</h1>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #FEF3C7;">${data.warehouseName} - Depo Sayım İncelemesi</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">🏢 Depo:</td>
                <td class="info-val" style="color: #2563EB; font-size: 14px;">${data.warehouseName}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Sayımı Yapan Ekip / Personel:</td>
                <td class="info-val">${data.user}</td>
              </tr>
              <tr>
                <td class="info-label">👨‍💼 Düzeltme İsteyen Yönetici:</td>
                <td class="info-val" style="color: #D97706; font-weight: 800;">${data.managerName}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Talep Tarihi:</td>
                <td class="info-val">${dateStr}</td>
              </tr>
            </table>

            <!-- MANAGER DIRECTIVE -->
            <div class="alert-box">
              <div style="color: #92400E; font-size: 12px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">
                📢 YÖNETİCİ TALİMATI / DÜZELTME NOTU:
              </div>
              <div style="color: #78350F; font-size: 14px; font-weight: 700; white-space: pre-wrap; line-height: 1.5;">
                "${data.note}"
              </div>
            </div>

            ${hasDiscrepancy ? `
              <h3 style="color: #0F172A; font-size: 14px; margin-bottom: 8px; border-bottom: 2px solid #F59E0B; padding-bottom: 4px;">
                🔍 Kontrol Edilmesi Gereken Farklı Kalemler (${data.discrepancies!.length} Kalem)
              </h3>
              <div class="table-responsive">
                <table class="diff-table">
                  <thead>
                    <tr>
                      <th style="width: 24px; text-align: center;">#</th>
                      <th>Malzeme & Personel Notu</th>
                      <th style="width: 44px; text-align: center;">Sistem</th>
                      <th style="width: 44px; text-align: center;">Fizik</th>
                      <th style="width: 58px; text-align: center;">Fark</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${data.discrepancies!.map((d, idx) => `
                      <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                        <td style="text-align: center; color: #64748B; font-weight: bold; font-size: 11px;">${idx + 1}</td>
                        <td>
                          <div style="margin-bottom: 2px;">
                            <span style="font-family: monospace; font-weight: bold; color: #2563EB; font-size: 12px;">${d.sapNo}</span>
                            ${d.shelfNo ? `<span style="color: #64748B; font-size: 11px; margin-left: 6px; background: #F1F5F9; padding: 1px 5px; border-radius: 3px;">📍 ${d.shelfNo}</span>` : ''}
                          </div>
                          <div style="font-weight: 600; color: #0F172A; font-size: 12px; line-height: 1.3;">${d.description}</div>
                          ${d.note ? `
                            <div style="margin-top: 5px; padding: 4px 8px; background: #FEF3C7; border-left: 3px solid #F59E0B; border-radius: 3px; font-size: 11px; color: #92400E; font-weight: 600; line-height: 1.3;">
                              💬 <em>"${d.note}"</em>
                            </div>
                          ` : ''}
                        </td>
                        <td style="text-align: center; color: #475569; font-size: 12px;">${d.systemQty}</td>
                        <td style="text-align: center; font-weight: 700; color: #0F172A; font-size: 12px;">${d.physicalQty}</td>
                        <td style="text-align: center; font-weight: 800; font-size: 12px; color: ${d.diff < 0 ? '#EF4444' : '#F59E0B'};">
                          <span style="background: ${d.diff < 0 ? '#FEE2E2' : '#FEF3C7'}; color: ${d.diff < 0 ? '#991B1B' : '#92400E'}; padding: 2px 6px; border-radius: 4px; display: inline-block;">
                            ${d.diff > 0 ? '+' + d.diff : d.diff}
                          </span>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            ` : ''}

            <!-- ACTION INSTRUCTIONS -->
            <div class="action-box">
              <strong>ℹ️ YAPILMASI GEREKEN İŞLEMLER:</strong><br>
              1. Belirtilen malzemeleri ve rafları depoda fiziki olarak tekrar kontrol ediniz.<br>
              2. <strong>DH-Servis</strong> uygulamasında <em>"Depo Yönetimi ➔ Sayım"</em> sekmesini açınız (Mevcut girdiğiniz sayım değerleriniz ekranda korunmaktadır).<br>
              3. İlgili malzemelerin fiziksel kutucuklarını güncelleyip <strong>"Tüm Sayımı Kaydet"</strong> butonuna basınız.
            </div>
          </div>

          <div class="footer">
            Bu e-posta <strong>DH-Servis Otomasyon Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Demirer Holding Depo Sayım ve Denetim Modülü.
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Generates formal A4 PDF file for Field Material Maintenance & Repair Form (Saha Malzeme Bakım & Onarım Formu).
   */
  async generateTeamRepairPDFFile(data: TeamRepairFormData): Promise<File | null> {
    try {
      await this.ensureHtml2PdfLoaded();
      if (!(window as any).html2pdf) {
        console.warn('[EmailService] html2pdf kütüphanesi yüklenemedi.');
        return null;
      }

      const dateStr = formatSafeDateTime(data.completedAt || data.date);
      const cleanWarehouseName = fixTurkishWarehouseName(data.warehouseName);
      const cleanDuration = formatRepairDuration(data.repairDuration);
      const displayFormNo = data.formNo || `Servis Onarım ${data.newSapNo}_001`;
      const cleanTech = formatDisplayName(data.technician || 'Saha Teknisyeni');
      const cleanTurbine = data.turbine || data.turbineNo || '-';

      let usedMaterialsRows = '';
      if (data.usedMaterials && data.usedMaterials.length > 0) {
        usedMaterialsRows = data.usedMaterials.map((m: any, idx: number) => {
          const isFromStock = m.deductedFromStock === true;
          const matMcf = m.mcfNo || data.mcfNo || '';
          const mcfText = (isFromStock && matMcf && matMcf !== '-') ? ` (MÇF: ${matMcf})` : '';
          const badgeText = isFromStock ? `[Depo Stoğu${mcfText}]` : '[Harici Sarf]';
          const badgeColor = isFromStock ? '#059669' : '#64748b';
          return `
          <tr style="border-bottom: 1px solid #cbd5e1;">
            <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px;">${idx + 1}</td>
            <td style="padding: 4px 8px; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 600;">
              <span style="color: ${badgeColor}; font-weight: 700; margin-right: 4px;">${badgeText}</span>
              ${m.name || m.description || '-'}
            </td>
            <td style="padding: 4px 6px; text-align: center; border: 1px solid #cbd5e1; font-size: 10px; font-weight: 700;">${m.qty} Adet</td>
          </tr>
        `;
        }).join('');
      } else {
        usedMaterialsRows = `
          <tr>
            <td colspan="3" style="padding: 6px 8px; text-align: center; color: #64748b; font-style: italic; border: 1px solid #cbd5e1; font-size: 10px;">
              Onarım esnasında harici sarf malzeme / yedek parça kullanılmamıştır.
            </td>
          </tr>
        `;
      }

      const htmlContent = `
        <div id="team-repair-pdf-container" style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #0f172a; width: 710px; background: #ffffff; line-height: 1.35; padding: 12px; box-sizing: border-box;">
          <!-- Header -->
          <table style="width: 100%; border-bottom: 2px solid #002d6b; padding-bottom: 8px; margin-bottom: 12px;">
            <tr>
              <td style="width: 30%; vertical-align: middle;">
                <div style="font-size: 18px; font-weight: 900; color: #002d6b; letter-spacing: -0.5px;">DEMİRER HOLDİNG</div>
              </td>
              <td style="width: 45%; text-align: center; vertical-align: middle;">
                <div style="font-size: 13.5px; font-weight: 900; color: #002d6b; text-transform: uppercase; letter-spacing: 0.5px;">MALZEME BAKIM & ONARIM FORMU</div>
              </td>
              <td style="width: 25%; text-align: right; vertical-align: middle;">
                <div style="font-size: 11px; font-weight: 800; font-family: monospace; color: #002d6b; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block;">${displayFormNo}</div>
                <div style="font-size: 9px; color: #64748b; margin-top: 3px;">Tarih: ${dateStr}</div>
              </td>
            </tr>
          </table>

          <!-- Warehouse & General Info Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 10.5px;">
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">📍 Saha / Depo:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #002d6b; width: 28%;">${cleanWarehouseName}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">👨‍🔧 Onarımı Yapan:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 700; width: 28%;">${cleanTech}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">⏱️ Onarım Süresi:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 700; color: #0284c7;">${cleanDuration}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">📦 Yeni Raf No:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 800; color: #b45309;">${data.shelfNo}</td>
            </tr>
          </table>

          <!-- Material Details Section -->
          <div style="background: #002d6b; color: #ffffff; padding: 4px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; margin-top: 8px; border-radius: 4px 4px 0 0;">
            📦 ONARILAN MALZEME KÜNYESİ
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10.5px;">
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">Orijinal SAP No:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; width: 28%;">${data.originalSapNo}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">Yeni Stok SAP No:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: 800; color: #2563eb; width: 28%;">${data.newSapNo} (TAMİRLİ)</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Malzeme Açıklaması:</td>
              <td colspan="3" style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 700; color: #0f172a;">${data.description}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Seri Numarası:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-family: monospace; font-weight: bold; color: #16a34a;">${data.serialNo || '-'}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Onarılan Miktar:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: bold;">${data.quantity} Adet</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Söküldüğü Türbin:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-weight: 600;">${cleanTurbine}</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Rapor & MÇF No:</td>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; font-size: 10px;">${data.reportNo || '-'} ${data.mcfNo ? `(MÇF: ${data.mcfNo})` : ''}</td>
            </tr>
            <tr>
              <td style="padding: 5px 6px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">Arıza Kodu & Nedeni:</td>
              <td colspan="3" style="padding: 5px 6px; border: 1px solid #cbd5e1; color: #b91c1c; font-weight: 600;">
                ${data.faultCode || '-'} ${data.faultDesc ? `| ${data.faultDesc}` : ''}
              </td>
            </tr>
          </table>

          <!-- Actions Taken Section -->
          <div style="background: #002d6b; color: #ffffff; padding: 4px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 4px 4px 0 0;">
            🛠️ YAPILAN İŞLEMLER VE ONARIM DETAYI
          </div>
          <div style="border: 1px solid #cbd5e1; border-top: none; padding: 10px 12px; font-size: 10.5px; background: #ffffff; color: #1e293b; min-height: 70px; white-space: pre-wrap; margin-bottom: 12px;">
            ${data.actionNotes || 'Detay girilmedi.'}
          </div>

          <!-- Used Materials Section -->
          <div style="background: #002d6b; color: #ffffff; padding: 4px 8px; font-size: 11px; font-weight: 800; text-transform: uppercase; border-radius: 4px 4px 0 0;">
            🔩 ONARIMDA KULLANILAN SARF MALZEMELER / PARÇALAR
          </div>
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 10px;">
            <thead>
              <tr style="background: #e2e8f0; color: #0f172a;">
                <th style="border: 1px solid #cbd5e1; padding: 4px; width: 30px; text-align: center;">#</th>
                <th style="border: 1px solid #cbd5e1; padding: 4px 8px; text-align: left;">Parça Adı / SAP No</th>
                <th style="border: 1px solid #cbd5e1; padding: 4px; width: 80px; text-align: center;">Miktar</th>
              </tr>
            </thead>
            <tbody>
              ${usedMaterialsRows}
            </tbody>
          </table>

          <!-- Signatures Section -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 14px; page-break-inside: avoid;">
            <tr>
              <td style="width: 48%; border: 1px solid #64748b; padding: 8px 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 10.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  ONARIMI YAPAN TEKNİSYEN
                </div>
                <div style="font-size: 10.5px; margin-top: 6px; font-weight: 600;">Ad Soyad: ${cleanTech}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Kullanıcı: ${data.completedBy}</div>
                <div style="font-size: 10.5px; margin-top: 20px; color: #64748b;">İmza: ___________________________</div>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; border: 1px solid #64748b; padding: 8px 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 10.5px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  TESLİM ALAN / MALZEME YÖNETİMİ
                </div>
                <div style="font-size: 10.5px; margin-top: 6px; font-weight: 600;">Ad Soyad: ___________________________</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 4px;">Raf Kaydı Onayı: [ ${data.shelfNo} ]</div>
                <div style="font-size: 10.5px; margin-top: 20px; color: #64748b;">İmza: ___________________________</div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 16px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            Bu resmi bakım formu Demirer Holding Saha Servis & Depo Yönetim Sistemi (DH-Servis) tarafından otomatik olarak üretilmiştir.
          </div>
        </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: absolute; left: -9999px; top: 0; width: 710px; background: #ffffff; z-index: -99999;';
      wrapper.innerHTML = htmlContent;
      document.body.appendChild(wrapper);

      const targetElement = (wrapper.querySelector('#team-repair-pdf-container') || wrapper.firstElementChild || wrapper) as HTMLElement;
      if (targetElement) {
        targetElement.style.width = '710px';
        targetElement.style.minWidth = '710px';
        targetElement.style.maxWidth = '710px';
        targetElement.style.margin = '0';
        targetElement.style.padding = '12px';
        targetElement.style.boxSizing = 'border-box';
        targetElement.style.background = '#ffffff';
      }

      await new Promise(r => setTimeout(r, 400));

      const formNoClean = displayFormNo.replace(/\s+/g, '_');
      const opt = {
        margin: [8, 8, 8, 8],
        filename: `${formNoClean}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          logging: false,
          scrollY: 0,
          scrollX: 0
        },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.pdf-no-break'] }
      };

      const originalHtmlFontSize = document.documentElement.style.fontSize;
      document.documentElement.style.fontSize = '12px';

      let pdfBlob: Blob | null = null;
      try {
        pdfBlob = await (window as any).html2pdf().set(opt).from(targetElement).outputPdf('blob');
      } finally {
        document.documentElement.style.fontSize = originalHtmlFontSize;
        if (wrapper.parentNode) wrapper.parentNode.removeChild(wrapper);
      }

      if (pdfBlob && pdfBlob.size > 1000) {
        console.log(`[EmailService] Saha Onarım Formu PDF'i üretildi: ${formNoClean}.pdf (${pdfBlob.size} bytes)`);
        return new File([pdfBlob], `${formNoClean}.pdf`, { type: 'application/pdf' });
      }
    } catch (e) {
      console.warn('[EmailService] Saha Onarım PDF üretimi hatası:', e);
    }
    return null;
  }

  /**
   * Generates clean white-themed email HTML body for completed field team repairs.
   */
  buildTeamRepairEmailHTML(data: TeamRepairFormData): string {
    const dateStr = formatSafeDateTime(data.completedAt || data.date);
    const cleanWarehouseName = fixTurkishWarehouseName(data.warehouseName);
    const cleanDuration = formatRepairDuration(data.repairDuration);
    const displayFormNo = data.formNo || `Servis Onarım ${data.newSapNo}_001`;
    const cleanTech = formatDisplayName(data.technician || 'Saha Teknisyeni');
    const cleanTurbine = data.turbine || data.turbineNo || '-';

    let usedMatList = '';
    if (data.usedMaterials && data.usedMaterials.length > 0) {
      usedMatList = data.usedMaterials.map((m: any) => {
        const isFromStock = m.deductedFromStock === true;
        const matMcf = m.mcfNo || data.mcfNo || '';
        const mcfText = (isFromStock && matMcf && matMcf !== '-') ? ` - MÇF: ${matMcf}` : '';
        const badge = isFromStock 
          ? `<span style="background: #DCFCE7; color: #166534; border: 1px solid #86EFAC; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-left: 6px;">Depo Stoğundan Düşüldü${mcfText}</span>`
          : '<span style="background: #F1F5F9; color: #475569; border: 1px solid #CBD5E1; padding: 1px 6px; border-radius: 4px; font-size: 11px; font-weight: 700; margin-left: 6px;">Harici Sarf / Stok Etkilenmedi</span>';
        return `<li style="margin-bottom: 6px;"><strong>${m.name || m.description || '-'}:</strong> ${m.qty} Adet ${badge}</li>`;
      }).join('');
    } else {
      usedMatList = '<li style="color: #64748B;"><em>Kullanılan harici parça yok.</em></li>';
    }

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 680px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05); overflow: hidden; }
          .header { background: linear-gradient(135deg, #002d6b 0%, #0284c7 100%); color: #FFFFFF; padding: 22px 24px; border-bottom: 4px solid #14F195; }
          .banner { background: #DCFCE7; border-bottom: 1px solid #86EFAC; padding: 12px 24px; color: #166534; font-weight: 700; font-size: 13px; }
          .content { padding: 24px; }
          .info-box { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 16px; margin-bottom: 20px; }
          .info-title { font-size: 16px; font-weight: 800; color: #0F172A; margin-bottom: 10px; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12.5px; }
          .info-label { color: #64748B; font-weight: 600; }
          .desc-box { background-color: #F8FAFC; border-left: 4px solid #0284C7; padding: 14px; border-radius: 4px; font-size: 13px; line-height: 1.6; white-space: pre-wrap; color: #1E293B; margin-top: 6px; border: 1px solid #E2E8F0; border-left: 4px solid #0284C7; }
          .tech-box { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; font-size: 12.5px; background: #F8FAFC; padding: 12px 16px; border-radius: 6px; border: 1px solid #E2E8F0; }
          .section-title { font-size: 14px; font-weight: 800; color: #0F172A; margin: 0 0 8px 0; border-bottom: 2px solid #0284C7; padding-bottom: 4px; }
        </style>
      </head>
      <body>
        <div class="card">
          <!-- Header -->
          <div class="header">
            <div style="font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; opacity: 0.9;">DEMİRER HOLDİNG</div>
            <h2 style="margin: 6px 0 0 0; font-size: 19px; font-weight: 800; color: #FFFFFF;">MALZEME BAKIM & ONARIM FORMU</h2>
            <div style="font-size: 12px; margin-top: 4px; opacity: 0.95;">Form No: <strong style="font-family: monospace; color: #FFFFFF;">${displayFormNo}</strong> • ${dateStr}</div>
          </div>

          <!-- Status Banner -->
          <div class="banner">
            ✅ Parça saha onarımı tamamlanmış ve <strong>${data.newSapNo}</strong> koduyla <strong>TAMİRLİ</strong> stoğa alınmıştır.
          </div>

          <div class="content">
            <!-- Material Card -->
            <div class="info-box">
              <div class="info-title">${data.description}</div>
              <div class="info-grid">
                <div><span class="info-label">Orijinal SAP:</span> <strong style="color: #D97706; font-family: monospace;">${data.originalSapNo}</strong></div>
                <div><span class="info-label">Yeni Tamirli SAP:</span> <strong style="color: #0284C7; font-family: monospace;">${data.newSapNo}</strong></div>
                <div><span class="info-label">Seri No:</span> <strong style="color: #059669; font-family: monospace;">${data.serialNo || '-'}</strong></div>
                <div><span class="info-label">Miktar:</span> <strong>${data.quantity} Adet</strong></div>
                <div><span class="info-label">Depo / Saha:</span> <strong style="color: #0F172A;">${cleanWarehouseName}</strong></div>
                <div><span class="info-label">Raf Numarası:</span> <strong style="color: #D97706; font-family: monospace;">${data.shelfNo}</strong></div>
                <div><span class="info-label">Söküldüğü Türbin:</span> <strong>${cleanTurbine}</strong></div>
                <div><span class="info-label">Rapor / MÇF:</span> <strong>${data.reportNo || '-'} (MÇF: ${data.mcfNo || '-'})</strong></div>
              </div>
            </div>

            <!-- Repair Actions -->
            <div style="margin-bottom: 20px;">
              <h4 class="section-title">🛠️ Yapılan İşlemler / Onarım Detayı</h4>
              <div class="desc-box">${data.actionNotes}</div>
            </div>

            <!-- Technician & Duration -->
            <div class="tech-box">
              <div><span class="info-label">Onarımı Yapan Teknisyen:</span><br><strong style="color: #0F172A; font-size: 13px;">${cleanTech}</strong></div>
              <div><span class="info-label">Onarım Süresi:</span><br><strong style="color: #0284C7; font-size: 13px;">${cleanDuration}</strong></div>
            </div>

            <!-- Used Materials -->
            <div style="margin-bottom: 10px;">
              <h4 class="section-title">🔩 Kullanılan Sarf Malzemeler / Parçalar</h4>
              <ul style="margin: 0; padding-left: 20px; font-size: 12.5px; color: #334155; line-height: 1.6;">
                ${usedMatList}
              </ul>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  /**
   * Sends formal field team repair completion email with A4 PDF attachment.
   * Default recipients: Fatih Zebek, Emir Ünver, Hurşit Akter.
   */
  async sendTeamRepairCompletedEmail(
    formData: TeamRepairFormData,
    customRecipient?: string
  ): Promise<{ success: boolean; message: string }> {
    let recipient = customRecipient;
    if (!recipient) {
      try {
        const configured = await emailSettingsService.getRecipients('teamRepairEmails');
        recipient = configured.length > 0 ? configured.join(', ') : DEFAULT_DISPATCH_EMAILS;
      } catch {
        recipient = DEFAULT_DISPATCH_EMAILS;
      }
    }
    const cleanWarehouseName = fixTurkishWarehouseName(formData.warehouseName);
    const displayFormNo = formData.formNo || `Servis Onarım ${formData.newSapNo}_001`;
    const subject = `[DH-SERVİS SAHA ONARIM FORMU] ${cleanWarehouseName} - ${displayFormNo} - ${formData.description}`;
    const htmlBody = this.buildTeamRepairEmailHTML(formData);

    try {
      // 1. Generate A4 PDF Attachment
      const pdfFile = await this.generateTeamRepairPDFFile(formData);
      let base64Content = '';
      if (pdfFile) {
        base64Content = await this.blobToBase64(pdfFile);
      }

      const formNoClean = displayFormNo.replace(/\s+/g, '_');
      const filename = `${formNoClean}.pdf`;

      // 2. Dispatch email
      const res = await fetch(getEmailEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: recipient,
          subject: subject,
          html: htmlBody,
          pdfBase64: base64Content,
          filename: filename
        })
      });

      const resData = await res.json().catch(() => null);
      if (resData?.success) {
        console.log(`[EmailService] Saha onarım maili ve PDF eki başarıyla iletildi: ${formData.newSapNo} -> ${recipient}`);
        if ((window as any).showToast) {
          (window as any).showToast('E-POSTA & PDF GÖNDERİLDİ', 'Saha onarım formu ve PDF eki Servis Merkezine iletildi.', 'success');
        }
        return { success: true, message: 'E-posta ve PDF Servis Merkezine başarıyla iletildi.' };
      } else {
        const errStr = resData?.error || 'E-posta servisi yanıt vermedi';
        console.warn('[EmailService] E-posta gönderim uyarısı:', errStr);
        return { success: false, message: errStr };
      }
    } catch (err: any) {
      console.error('[EmailService] Saha onarım e-posta hatası:', err);
      return { success: false, message: err?.message || err };
    }
  }
}

export interface TeamRepairFormData {
  formNo: string;
  date?: string;
  warehouseName: string;
  warehouseId: string;
  originalSapNo: string;
  newSapNo: string;
  description: string;
  newDescription: string;
  serialNo?: string;
  quantity: number;
  turbine?: string;
  turbineNo?: string;
  reportNo?: string;
  mcfNo?: string;
  faultCode?: string;
  faultDesc?: string;
  assignedTeam?: string;
  sentBy?: string;
  actionNotes: string;
  technician: string;
  repairDuration?: string;
  shelfNo: string;
  usedMaterials?: Array<{
    name: string;
    qty: number;
    sapNo?: string;
    description?: string;
    deductedFromStock?: boolean;
    shelfNo?: string;
  }>;
  completedBy: string;
  completedAt?: any;
}

export const emailService = new EmailService();
