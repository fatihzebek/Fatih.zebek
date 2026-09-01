const { onRequest } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");

/**
 * Firebase Cloud Function: sendEmail
 * 
 * Gmail SMTP üzerinden e-posta gönderimi.
 * Desteklenen parametreler: to, subject, html, pdfBase64, filename
 * 
 * Kullanım alanları:
 * - Servis Raporu e-postaları (PDF ekli)
 * - Malzeme Sevk Formu bildirimleri (PDF ekli)
 * - Depo Sayım Raporu e-postaları
 * - Sayım Düzeltme Talimatı e-postaları
 */
exports.sendEmail = onRequest(
  { 
    region: "europe-west1",
    cors: true,
    maxInstances: 10,
    timeoutSeconds: 60
  },
  async (req, res) => {
    // Only allow POST
    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method Not Allowed" });
      return;
    }

    try {
      const { to, subject, html, pdfBase64, filename } = req.body;

      if (!to || !subject || !html) {
        res.status(400).json({ 
          success: false, 
          error: "Eksik parametre: to, subject ve html zorunludur." 
        });
        return;
      }

      // Gmail SMTP Transporter (App Password)
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
          user: "dhservisrapor@gmail.com",
          pass: "mulm vszx xrwj nshx"
        }
      });

      const mailOptions = {
        from: '"DH-Servis Rapor" <dhservisrapor@gmail.com>',
        replyTo: 'servis.rapor@demirerholding.com',
        to: to,
        subject: subject,
        html: html
      };

      // PDF eki varsa ekle
      if (pdfBase64 && filename) {
        mailOptions.attachments = [
          {
            filename: filename,
            content: Buffer.from(pdfBase64, "base64"),
            contentType: "application/pdf"
          }
        ];
      }

      const info = await transporter.sendMail(mailOptions);
      console.log("[Cloud Function sendEmail] E-posta başarıyla gönderildi:", info.messageId);

      res.status(200).json({ success: true, messageId: info.messageId });
    } catch (err) {
      console.error("[Cloud Function sendEmail] HATA:", err);
      res.status(500).json({ success: false, error: err.message || "E-posta gönderilemedi" });
    }
  }
);
