import { db } from '../firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import type { ServiceReport } from './ServiceReportService';
import { renderReportPDF } from '../components/ReportTemplate';

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

export const DEFAULT_REPORT_EMAIL = 'fatih.zebek@demirerholding.com';
export const DEFAULT_DISPATCH_EMAILS = 'fatih.zebek@demirerholding.com, emir.unver@demirerholding.com, hursit.akter@demirerholding.com';

class EmailService {
  /**
   * Generates HTML email content and sends report email + PDF attachment to target address.
   */
  async sendReportEmail(
    report: ServiceReport, 
    customRecipient?: string
  ): Promise<{ success: boolean; message: string }> {
    const recipient = customRecipient || DEFAULT_REPORT_EMAIL;
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
      const actionStr = report.templateName || (report as any).faultCode || 'Rapor';
      let safeFileName = `${dateStr}-${report.siteName || 'Saha'}-${actionStr}-${turbineStr || 'T'}-${reportNo}.pdf`;
      safeFileName = safeFileName
        .replace(/Ğ/g,'G').replace(/ğ/g,'g')
        .replace(/Ü/g,'U').replace(/ü/g,'u')
        .replace(/Ş/g,'S').replace(/ş/g,'s')
        .replace(/İ/g,'I').replace(/ı/g,'i')
        .replace(/Ö/g,'O').replace(/ö/g,'o')
        .replace(/Ç/g,'C').replace(/ç/g,'c')
        .replace(/[\\/:*?"<>|]/g, '-')
        .replace(/\s+/g, '_');

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
          (window as any).showToast('BAŞARILI', `Rapor ve resmi PDF eki (${recipient}) adresine iletildi.`, 'success');
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
        message: `Rapor e-postası ve resmi PDF eki (${recipient}) adresine başarıyla iletildi.`
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
              backgroundColor: '#ffffff'
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { 
              mode: ['css', 'legacy'], 
              before: '.html2pdf__page-break', 
              avoid: ['tr', 'img'] 
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
    const reportNo = report.reportNo || '-';
    const date = report.date || new Date().toLocaleDateString('tr-TR');
    const site = report.siteName || '-';
    const turbine = (report as any).turbineNo || (report as any).turbineName || '-';
    const techs = (report as any).technicians || (report as any).personnel || [];
    const technicians = Array.isArray(techs) ? techs.join(', ') : (techs || '-');
    const reportDesc = (report as any).description || (report as any).faultDescription || (report as any).summary || 'Açıklama girilmedi.';

    // Materials list
    const materials = (report as any).materials || [];
    let materialsHtml = '';
    if (materials.length > 0) {
      materialsHtml = `
        <div style="margin-top: 20px;">
          <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #2563EB; padding-bottom: 4px;">📦 Kullanılan / Değişen Malzemeler</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 8px;">
            <thead>
              <tr style="background-color: #F1F5F9; text-align: left; color: #475569;">
                <th style="padding: 8px; border: 1px solid #CBD5E1;">SAP No</th>
                <th style="padding: 8px; border: 1px solid #CBD5E1;">Malzeme Tanımı</th>
                <th style="padding: 8px; border: 1px solid #CBD5E1; text-align: center;">Miktar</th>
                <th style="padding: 8px; border: 1px solid #CBD5E1; text-align: center;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${materials.map((m: any, idx: number) => `
                <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                  <td style="padding: 8px; border: 1px solid #E2E8F0; font-family: monospace; font-weight: bold; color: #2563EB;">${m.sapNo || '-'}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0;">${m.name || m.description || '-'}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: center; font-weight: bold;">${m.quantity || m.used || 1} ${m.unit || 'Adet'}</td>
                  <td style="padding: 8px; border: 1px solid #E2E8F0; text-align: center;">${m.condition === 'REVISED' ? 'Revize' : 'Yeni'}</td>
                </tr>
              `).join('')}
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
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .desc-box { background-color: #F8FAFC; border-left: 4px solid #3B82F6; padding: 14px; border-radius: 4px; font-size: 14px; line-height: 1.6; white-space: pre-wrap; color: #1E293B; margin-top: 10px; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px; font-weight: 700; color: #14F195;">DEMİRER HOLDİNG SERVİS RAPORU</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #94A3B8;">${reportTitle} - No: <strong style="color: #FFFFFF;">${reportNo}</strong></p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">📍 Santral / Türbin:</td>
                <td class="info-val" style="color: #2563EB;">${site} - ${turbine}</td>
              </tr>
              <tr>
                <td class="info-label">📅 Rapor Tarihi:</td>
                <td class="info-val">${date}</td>
              </tr>
              <tr>
                <td class="info-label">👤 Teknisyen(ler):</td>
                <td class="info-val">${technicians}</td>
              </tr>
              <tr>
                <td class="info-label">⚙️ Rapor Tipi:</td>
                <td class="info-val"><span style="background: ${isMaintenance ? '#DCFCE7' : '#FEF2F2'}; color: ${isMaintenance ? '#166534' : '#991B1B'}; padding: 3px 8px; border-radius: 4px; font-size: 12px;">${reportTitle}</span></td>
              </tr>
            </table>

            <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid #2563EB; padding-bottom: 4px;">📝 Yapılan İşlemler & Arıza Detayları</h3>
            <div class="desc-box">
              ${reportDesc}
            </div>

            ${materialsHtml}
            ${imagesHtml}
          </div>

          <div class="footer">
            Bu e-posta <strong>DH-Servis Otomasyon Sistemi</strong> tarafından otomatik olarak üretilmiştir.<br>
            Raporun resmi A4 çıktı dokümanı <strong>Servis_Raporu_${reportNo}.pdf</strong> olarak e-posta ekinde yer almaktadır.
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

      const rows = data.items.map((it, idx) => `
        <tr style="page-break-inside: avoid; background-color: ${idx % 2 === 0 ? '#ffffff' : '#f8fafc'};">
          <td style="border: 1px solid #475569; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 11px;">${idx + 1}</td>
          <td style="border: 1px solid #475569; padding: 6px 4px; font-family: monospace; font-weight: bold; font-size: 11px; color: #1e40af;">${it.sapNo}</td>
          <td style="border: 1px solid #475569; padding: 6px 4px; font-family: monospace; font-weight: bold; font-size: 11px; color: #047857;">${it.serialNo || '-'}</td>
          <td style="border: 1px solid #475569; padding: 6px 8px; font-size: 11px;">
            <div style="font-weight: 700; color: #0f172a;">${it.description}</div>
            ${it.repairNotes ? `<div style="font-size: 10px; color: #059669; margin-top: 2px;">🔧 Onarım Notu: ${it.repairNotes}</div>` : ''}
            ${it.faultCode && it.faultCode !== '-' ? `<div style="font-size: 10px; color: #b45309;">⚠️ Arıza: ${it.faultCode}</div>` : ''}
          </td>
          <td style="border: 1px solid #475569; padding: 6px 4px; text-align: center; font-weight: bold; font-size: 12px;">${it.quantity}</td>
          <td style="border: 1px solid #475569; padding: 6px 4px; text-align: center; font-size: 11px;">Adet</td>
        </tr>
      `).join('');

      const htmlContent = `
        <div id="dispatch-pdf-container" style="font-family: 'Segoe UI', Arial, sans-serif; background: #ffffff; color: #0f172a; padding: 16px; box-sizing: border-box; width: 880px;">
          <!-- Top Header Table -->
          <table style="width: 100%; border-collapse: collapse; border-bottom: 3px solid #002d6b; padding-bottom: 10px; margin-bottom: 14px;">
            <tr>
              <td style="width: 32%; vertical-align: middle;">
                <div style="font-weight: 900; font-size: 20px; color: #002d6b; letter-spacing: 0.5px;">DEMİRER HOLDİNG</div>
                <div style="font-size: 10px; color: #64748b; font-weight: 600; margin-top: 1px;">RÜZGAR ENERJİ SANTRALLERİ</div>
              </td>
              <td style="width: 42%; text-align: center; vertical-align: middle;">
                <div style="font-size: 14px; font-weight: 900; color: #0f172a; text-transform: uppercase;">MERKEZ TAMİR ATÖLYESİ (MTA)</div>
                <div style="font-size: 12px; font-weight: 700; color: #002d6b; margin-top: 2px;">REVİZE MALZEME SEVK & TESLİM-TESELLÜM FORMU</div>
              </td>
              <td style="width: 26%; text-align: right; vertical-align: middle;">
                <div style="font-size: 13px; font-weight: 800; font-family: monospace; color: #002d6b; background: #f1f5f9; padding: 3px 8px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block;">${data.dispatchNo}</div>
                <div style="font-size: 10px; color: #64748b; margin-top: 3px;">Tarih: ${dateStr}</div>
              </td>
            </tr>
          </table>

          <!-- Meta Information Table -->
          <table style="width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px;">
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">🏢 Çıkış Deposu:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700; width: 28%;">Merkez Tamir Atölyesi (MTA)</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; width: 22%; color: #475569;">📍 Hedef Saha / Depo:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #002d6b; font-size: 12px; width: 28%;">${data.targetWarehouseName}</td>
            </tr>
            <tr>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">👨‍🔧 Teslim Eden (Atölye):</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 700;">${data.senderName}</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">👤 Teslim Alacak Sorumlu:</td>
              <td style="padding: 6px 8px; border: 1px solid #cbd5e1; font-weight: 800; color: #b45309;">${data.recipientName}</td>
            </tr>
            ${data.note ? `
              <tr>
                <td style="padding: 6px 8px; border: 1px solid #cbd5e1; background: #f8fafc; font-weight: bold; color: #475569;">📝 Kargo / Sevk Notu:</td>
                <td colspan="3" style="padding: 6px 8px; border: 1px solid #cbd5e1; color: #334155;">${data.note}</td>
              </tr>
            ` : ''}
          </table>

          <!-- Materials Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
            <thead>
              <tr style="background: #e2e8f0; color: #0f172a;">
                <th style="border: 1px solid #475569; padding: 7px 4px; width: 30px; text-align: center; font-size: 11px;">#</th>
                <th style="border: 1px solid #475569; padding: 7px 6px; width: 85px; font-size: 11px; text-align: left;">SAP No</th>
                <th style="border: 1px solid #475569; padding: 7px 6px; width: 95px; font-size: 11px; text-align: left;">Seri No</th>
                <th style="border: 1px solid #475569; padding: 7px 8px; font-size: 11px; text-align: left;">Malzeme Tanımı & Onarım Özeti</th>
                <th style="border: 1px solid #475569; padding: 7px 4px; width: 50px; text-align: center; font-size: 11px;">Miktar</th>
                <th style="border: 1px solid #475569; padding: 7px 4px; width: 45px; text-align: center; font-size: 11px;">Birim</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
            <tfoot>
              <tr style="background: #f1f5f9;">
                <td colspan="4" style="border: 1px solid #475569; padding: 7px 8px; text-align: right; font-weight: 800; font-size: 11px;">TOPLAM SEVK MİKTARI:</td>
                <td style="border: 1px solid #475569; padding: 7px 4px; text-align: center; font-weight: 900; font-size: 12px; color: #002d6b;">${totalQty}</td>
                <td style="border: 1px solid #475569; padding: 7px 4px; text-align: center; font-weight: bold; font-size: 11px;">Adet</td>
              </tr>
            </tfoot>
          </table>

          <!-- Signatures Table -->
          <table style="width: 100%; border-collapse: collapse; margin-top: 28px; page-break-inside: avoid;">
            <tr>
              <td style="width: 48%; border: 1px solid #64748b; padding: 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 11px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  TESLİM EDEN (MTA ATÖLYE SORUMLUSU)
                </div>
                <div style="font-size: 11px; margin-top: 6px; font-weight: 600;">Ad Soyad: ${data.senderName}</div>
                <div style="font-size: 11px; margin-top: 24px; color: #64748b;">İmza: ___________________________</div>
              </td>
              <td style="width: 4%;"></td>
              <td style="width: 48%; border: 1px solid #64748b; padding: 10px; vertical-align: top; background: #ffffff;">
                <div style="font-weight: 800; font-size: 11px; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px; color: #0f172a;">
                  TESLİM ALAN (LOJİSTİK & AMBAR SORUMLUSU)
                </div>
                <div style="font-size: 11px; margin-top: 6px; font-weight: 600;">Ad Soyad: ${data.recipientName}</div>
                <div style="font-size: 11px; margin-top: 24px; color: #64748b;">İmza: ___________________________</div>
              </td>
            </tr>
          </table>

          <div style="margin-top: 20px; text-align: center; font-size: 9px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 6px;">
            Bu resmi belge Demirer Holding Saha Servis & Atölye Yönetim Sistemi (DH-Servis) tarafından üretilmiştir.
          </div>
        </div>
      `;

      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'position: fixed; left: 0; top: 0; width: 900px; background: #ffffff; z-index: -99999; opacity: 0; pointer-events: none;';
      wrapper.innerHTML = htmlContent;
      document.body.appendChild(wrapper);

      const targetElement = (wrapper.querySelector('#dispatch-pdf-container') || wrapper.firstElementChild || wrapper) as HTMLElement;
      if (targetElement) {
        targetElement.style.width = '880px';
        targetElement.style.minWidth = '880px';
        targetElement.style.maxWidth = '880px';
        targetElement.style.margin = '0';
        targetElement.style.padding = '16px';
        targetElement.style.boxSizing = 'border-box';
        targetElement.style.background = '#ffffff';
      }

      await new Promise(r => setTimeout(r, 400));

      const opt = {
        margin: [8, 6, 8, 6],
        filename: `Malzeme_Sevk_Formu_${data.dispatchNo}.pdf`,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { 
          scale: 2, 
          useCORS: true, 
          backgroundColor: '#ffffff',
          x: 0,
          y: 0,
          scrollX: 0,
          scrollY: 0,
          width: 880,
          windowWidth: 900
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
    const recipient = customRecipient || DEFAULT_DISPATCH_EMAILS;
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
                      ${it.repairNotes ? `<div style="font-size: 11px; color: #059669; margin-top: 2px;">🔧 Onarım: ${it.repairNotes}</div>` : ''}
                      ${it.faultCode && it.faultCode !== '-' ? `<div style="font-size: 11px; color: #D97706;">⚠️ Arıza: ${it.faultCode}</div>` : ''}
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
    const recipient = 'fatih.zebek@demirerholding.com, hursit.akter@demirerholding.com, emir.unver@demirerholding.com';
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
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 780px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 4px solid #F59E0B; }
          .content { padding: 24px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .stats-grid { display: table; width: 100%; margin-bottom: 20px; }
          .stat-cell { display: table-cell; width: 20%; padding: 10px; text-align: center; border: 1px solid #E2E8F0; background: #F8FAFC; }
          .stat-num { font-size: 18px; font-weight: 800; }
          .stat-lbl { font-size: 11px; color: #64748B; text-transform: uppercase; margin-top: 4px; font-weight: bold; }
          .diff-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          .diff-table th { background: #0F172A; color: #FFFFFF; padding: 8px 6px; text-align: left; font-size: 11px; border: 1px solid #334155; text-transform: uppercase; }
          .diff-table td { padding: 7px 6px; border: 1px solid #E2E8F0; }
          .notice-box { background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 14px; border-radius: 4px; font-size: 13px; color: #92400E; margin-top: 20px; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #F59E0B;">DEMİRER HOLDİNG DEPO SAYIM RAPORU</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #E2E8F0;">${data.warehouseName} - Saha Depo Sayımı</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">🏢 Sayım Yapılan Depo:</td>
                <td class="info-val" style="color: #2563EB; font-size: 15px;">${data.warehouseName}</td>
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
            <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
              <table style="width: 100%; border-collapse: collapse; text-align: center;">
                <tr>
                  <td style="padding: 6px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 18px; font-weight: 800; color: #0F172A;">${data.totalItems}</div>
                    <div style="font-size: 10px; color: #64748B; font-weight: bold;">TOPLAM KALEM</div>
                  </td>
                  <td style="padding: 6px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 18px; font-weight: 800; color: #10B981;">${data.compliantItems}</div>
                    <div style="font-size: 10px; color: #10B981; font-weight: bold;">UYUMLU (0 FARK)</div>
                  </td>
                  <td style="padding: 6px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 18px; font-weight: 800; color: #F59E0B;">${data.surplusItems}</div>
                    <div style="font-size: 10px; color: #F59E0B; font-weight: bold;">FAZLA KALEM</div>
                  </td>
                  <td style="padding: 6px; border-right: 1px solid #E2E8F0;">
                    <div style="font-size: 18px; font-weight: 800; color: #EF4444;">${data.deficitItems}</div>
                    <div style="font-size: 10px; color: #EF4444; font-weight: bold;">EKSİK KALEM</div>
                  </td>
                  <td style="padding: 6px;">
                    <div style="font-size: 18px; font-weight: 800; color: ${data.totalDiff < 0 ? '#EF4444' : (data.totalDiff > 0 ? '#F59E0B' : '#10B981')};">${totalDiffText}</div>
                    <div style="font-size: 10px; color: #64748B; font-weight: bold;">NET FARK ADEDİ</div>
                  </td>
                </tr>
              </table>
            </div>

            <!-- DISCREPANCY TABLE -->
            <h3 style="color: #0F172A; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid ${hasDiscrepancy ? '#EF4444' : '#10B981'}; padding-bottom: 4px;">
              ${hasDiscrepancy ? `⚠️ FARK ÇIKAN MALZEMELER & AÇIKLAMALARI (${data.discrepancies.length} Kalem)` : `✅ TÜM MALZEMELER STOKLA BİREBİR UYUMLU`}
            </h3>

            ${hasDiscrepancy ? `
              <table class="diff-table">
                <thead>
                  <tr>
                    <th style="width: 25px; text-align: center;">#</th>
                    <th style="width: 70px;">SAP No</th>
                    <th>Malzeme Tanımı</th>
                    <th style="width: 65px;">Konum</th>
                    <th style="width: 50px; text-align: right;">Sistem</th>
                    <th style="width: 50px; text-align: right;">Fiziksel</th>
                    <th style="width: 55px; text-align: right;">Fark</th>
                    <th>Personel Açıklaması</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.discrepancies.map((d, idx) => {
                    const isDeficit = d.diff < 0;
                    const diffBadge = isDeficit 
                      ? `<span style="background: #FEE2E2; color: #991B1B; padding: 2px 5px; border-radius: 4px; font-weight: 800;">${d.diff} Adet</span>`
                      : `<span style="background: #FEF3C7; color: #92400E; padding: 2px 5px; border-radius: 4px; font-weight: 800;">+${d.diff} Adet</span>`;

                    return `
                      <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                        <td style="text-align: center; color: #64748B; font-weight: bold;">${idx + 1}</td>
                        <td style="font-family: monospace; font-weight: bold; color: #2563EB;">${d.sapNo}</td>
                        <td>
                          <div style="font-weight: 700; color: #0F172A;">${d.description}</div>
                        </td>
                        <td style="color: #64748B; font-size: 11px;">${d.shelfNo || '-'}</td>
                        <td style="text-align: right; font-weight: 600; color: #475569;">${d.systemQty}</td>
                        <td style="text-align: right; font-weight: 700; color: #0F172A;">${d.physicalQty}</td>
                        <td style="text-align: right;">${diffBadge}</td>
                        <td style="color: #92400E; font-size: 11px; font-weight: 600; background: ${isDeficit ? 'rgba(239, 68, 68, 0.04)' : 'rgba(245, 158, 11, 0.04)'};">
                          ${d.note ? `"${d.note}"` : '<span style="color: #94A3B8;">Açıklama girilmedi</span>'}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            ` : `
              <div style="background: #DCFCE7; border: 1px solid #86EFAC; color: #166534; padding: 12px; border-radius: 6px; font-size: 13px; text-align: center; font-weight: 600;">
                Bu sayımda tüm kalemler sistem kayıtlarıyla birebir (%100) uyumlu çıkmıştır.
              </div>
            `}

            <!-- MANAGER NOTICE BOX -->
            <div class="notice-box">
              <strong>🔒 EMNİYET & KONTROL BİLGİLENDİRMESİ:</strong><br>
              Depo stokları personelin sayımı sonrası <strong>otomatik olarak değiştirilmemiştir</strong>.<br>
              Fiziksel sayım miktarlarının sistem stoğuna yansıtılması için <strong>Fatih Zebek</strong>, <strong>Hurşit Akter</strong> veya <strong>Emir Ünver</strong> tarafından DH-Servis sistemindeki <em>"Depo Yönetimi ➔ Sayım Geçmişi"</em> ekranından onaylanması gerekmektedir.
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
    const managers = ['fatih.zebek@demirerholding.com', 'hursit.akter@demirerholding.com', 'emir.unver@demirerholding.com'];
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
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #F8FAFC; color: #334155; margin: 0; padding: 20px; }
          .card { max-width: 780px; margin: 0 auto; background: #FFFFFF; border-radius: 12px; border: 1px solid #E2E8F0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden; }
          .header { background: linear-gradient(135deg, #78350F 0%, #D97706 100%); color: #FFFFFF; padding: 24px; text-align: center; border-bottom: 4px solid #B45309; }
          .content { padding: 24px; }
          .info-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          .info-table td { padding: 8px 12px; border-bottom: 1px solid #F1F5F9; font-size: 14px; }
          .info-label { font-weight: bold; color: #64748B; width: 35%; }
          .info-val { color: #0F172A; font-weight: 600; }
          .alert-box { background-color: #FEF3C7; border: 2px solid #F59E0B; border-radius: 8px; padding: 16px; margin: 20px 0; }
          .action-box { background-color: #EFF6FF; border-left: 4px solid #3B82F6; padding: 14px; border-radius: 4px; font-size: 13px; color: #1E40AF; margin-top: 20px; }
          .diff-table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px; }
          .diff-table th { background: #0F172A; color: #FFFFFF; padding: 8px 6px; text-align: left; font-size: 11px; border: 1px solid #334155; }
          .diff-table td { padding: 7px 6px; border: 1px solid #E2E8F0; }
          .footer { background-color: #F1F5F9; text-align: center; padding: 16px; font-size: 12px; color: #94A3B8; border-top: 1px solid #E2E8F0; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">⚠️ SAYIM DÜZELTME & YENİDEN KONTROL TALEBİ</h1>
            <p style="margin: 6px 0 0 0; font-size: 14px; color: #FEF3C7;">${data.warehouseName} - Depo Sayım İncelemesi</p>
          </div>
          
          <div class="content">
            <table class="info-table">
              <tr>
                <td class="info-label">🏢 Depo:</td>
                <td class="info-val" style="color: #2563EB; font-size: 15px;">${data.warehouseName}</td>
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
              <div style="color: #92400E; font-size: 13px; font-weight: 800; text-transform: uppercase; margin-bottom: 6px;">
                📢 YÖNETİCİ TALİMATI / DÜZELTME NOTU:
              </div>
              <div style="color: #78350F; font-size: 15px; font-weight: 700; white-space: pre-wrap; line-height: 1.5;">
                "${data.note}"
              </div>
            </div>

            ${hasDiscrepancy ? `
              <h3 style="color: #0F172A; font-size: 14px; margin-bottom: 8px; border-bottom: 2px solid #F59E0B; padding-bottom: 4px;">
                🔍 Kontrol Edilmesi Gereken Farklı Kalemler (${data.discrepancies!.length} Kalem)
              </h3>
              <table class="diff-table">
                <thead>
                  <tr>
                    <th style="width: 25px; text-align: center;">#</th>
                    <th style="width: 70px;">SAP No</th>
                    <th>Malzeme Tanımı</th>
                    <th style="width: 60px;">Konum</th>
                    <th style="width: 50px; text-align: right;">Sistem</th>
                    <th style="width: 50px; text-align: right;">Fiziksel</th>
                    <th style="width: 55px; text-align: right;">Fark</th>
                    <th>Personel Notu</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.discrepancies!.map((d, idx) => `
                    <tr style="background-color: ${idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
                      <td style="text-align: center; color: #64748B; font-weight: bold;">${idx + 1}</td>
                      <td style="font-family: monospace; font-weight: bold; color: #2563EB;">${d.sapNo}</td>
                      <td><div style="font-weight: 600; color: #0F172A;">${d.description}</div></td>
                      <td style="color: #64748B; font-size: 11px;">${d.shelfNo || '-'}</td>
                      <td style="text-align: right; color: #475569;">${d.systemQty}</td>
                      <td style="text-align: right; font-weight: 700; color: #0F172A;">${d.physicalQty}</td>
                      <td style="text-align: right; font-weight: 800; color: ${d.diff < 0 ? '#EF4444' : '#F59E0B'};">${d.diff > 0 ? '+' + d.diff : d.diff}</td>
                      <td style="color: #64748B; font-size: 11px;">${d.note || '-'}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
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
}

export const emailService = new EmailService();
