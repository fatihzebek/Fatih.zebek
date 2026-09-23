const { onRequest } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const crypto = require("crypto");

// Firebase Admin SDK başlat (Cloud Functions ortamında otomatik credentials)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

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

/* ========================================================================
 * SCADA Telemetry Endpoint
 * 
 * Demirer Enerji'nin 13 rüzgâr santralindeki XmlDaAktarici.exe programından
 * gelen SCADA verilerini alan, doğrulayan ve Firestore'a kaydeden endpoint.
 * 
 * Protokol: HTTPS POST, JSON gövde, X-API-Key header ile kimlik doğrulama
 * Sıklık: Santral başına ~10 sn'de bir; 13 santral → ~1,3 istek/sn
 * ======================================================================== */

// --- Santral API Key SHA-256 Hash'leri ---
// Gelen X-API-Key header'ının SHA-256 özeti bu değerlerle karşılaştırılır.
// Anahtarların kendisi bilinmiyor; yalnız hash'leri verildi.
const API_KEY_HASHES = {
  "cakil":     "9b324e43038a4f801a3b212375d6094f5bdef9e14fa84101f7fc0dc883d93ef1",
  "camseki":   "f99db588f80bec4f794fddcd6c2d98032af23f5dc43bcff7dabe40213437758d",
  "cataltepe": "8caffa8d18c745f6f137e6f29a2570cea67f834d5909f5950c47ed7abba51558",
  "datca":     "0abdbc409c44da36238bd0603c2073bd0609c16b139ee591534ba11e572aa963",
  "germiyan":  "bd4a99476aef6e7a4d94e082591b3a2f1d751624bc4a037a664e371345522493",
  "intepe":    "bb603bb299f1deccb8254004d152740c97d0f1cd5fc1fffe41df669a09503bb3",
  "keltepe":   "2b8534811e6f514f84240b3ef48ec31b57683f7ffcd7e0de93c9542215ccfb1c",
  "kozbeyli":  "3e106e2311fadaa0721472bd02058bad37b5b973a5e0f65d4d244d5ddc68dd7a",
  "kuyucak":   "84a5656b342469af9d2bd21d095333aa0486a1bdb56c0e66e2300309f859c196",
  "mare":      "b00849969b8937a02eae420c137254b5104d77ae8f9532359adee41d454077de",
  "samurlu":   "1857b1acb19306cdf25dc0d85c3e65760f4b92bf878c6c921d845e48c681d34d",
  "sarikaya":  "0e5d6f34ef1177eef29b037130d56e5f0ed3469397a3e1eb68898a0595d888d4",
  "sayalar":   "572b76d8722c2a81f537616897fcc0f554fe1d982ce3be8658ea9017f2af4929"
};

// --- Geçerli santral listesi ---
const VALID_PLANTS = new Set(Object.keys(API_KEY_HASHES));

/**
 * API Key doğrulama: SHA-256 hash karşılaştırma (sabit zamanlı)
 * @param {string} apiKey - X-API-Key header değeri
 * @param {string} plantId - Gövdedeki plant_id
 * @returns {boolean} Doğrulama sonucu
 */
function validateApiKey(apiKey, plantId) {
  const expectedHash = API_KEY_HASHES[plantId];
  if (!expectedHash) return false;

  // Gelen anahtarın SHA-256 özetini hesapla
  const incomingHash = crypto.createHash("sha256").update(apiKey, "utf8").digest("hex");

  // Sabit zamanlı karşılaştırma (timing attack önlemi)
  try {
    return crypto.timingSafeEqual(
      Buffer.from(incomingHash, "hex"),
      Buffer.from(expectedHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Türbin kimlik düzeltmeleri (§6 — Demirer portalıyla aynı numaralar)
 * 
 * 1. T + iki haneli format (T7 → T07)
 * 2. Kozbeyli: T18 → T15
 * 3. Samurlu: T17→T16, T18→T17, T19→T18, T20→T19
 * 4. Datça: id > T40 olan türbinleri at
 * 5. name alanının başındaki eski kimliği yeni kimlikle değiştir; listeyi numaraya göre sırala
 */
function fixTurbineIds(turbines, plantId) {
  if (!Array.isArray(turbines)) return [];

  let result = turbines.map(t => {
    let rawId = t.id || "";
    // T'den sonraki sayıyı al, yoksa ilk sayı grubunu
    let match = rawId.match(/T(\d+)/i) || rawId.match(/(\d+)/);
    if (!match) return { ...t };

    let num = parseInt(match[1], 10);

    // Kozbeyli: T18 → T15
    if (plantId === "kozbeyli" && num === 18) {
      num = 15;
    }

    // Samurlu: T17→T16, T18→T17, T19→T18, T20→T19 (SCADA'da 16 atlanmış)
    if (plantId === "samurlu") {
      if (num === 17) num = 16;
      else if (num === 18) num = 17;
      else if (num === 19) num = 18;
      else if (num === 20) num = 19;
    }

    // İki haneli format: T7 → T07
    const newId = "T" + String(num).padStart(2, "0");

    // name alanının başındaki eski kimliği yeni kimlikle değiştir
    let newName = t.name || "";
    if (newName && rawId) {
      newName = newName.replace(rawId, newId);
    }

    return { ...t, id: newId, name: newName, _num: num };
  });

  // Datça: numarası 40'tan büyük türbin kayıtlarını at
  if (plantId === "datca") {
    result = result.filter(t => (t._num || 0) <= 40);
  }

  // Numaraya göre sırala ve geçici _num alanını kaldır
  result.sort((a, b) => (a._num || 0) - (b._num || 0));
  result.forEach(t => delete t._num);

  return result;
}

/**
 * ek alanlarını birleştir (ek_tam: false ise kısmi güncelleme)
 * Yeni gelen ek değerleri mevcut üzerine merge edilir.
 * @param {object|null} existingEk - Firestore'daki mevcut ek
 * @param {object|null} incomingEk - Gelen paketteki ek
 * @returns {object|null} Birleştirilmiş ek
 */
function mergeEk(existingEk, incomingEk) {
  if (!incomingEk) return existingEk || null;
  if (!existingEk) return incomingEk;
  return { ...existingEk, ...incomingEk };
}

/**
 * Türbin ek alanlarını birleştir (ek_tam: false durumu)
 * Mevcut türbin listesindeki ek değerlerini gelen kısmi ek ile güncelle
 */
function mergeTurbineEks(existingTurbines, incomingTurbines) {
  if (!Array.isArray(existingTurbines) || !Array.isArray(incomingTurbines)) {
    return incomingTurbines || [];
  }

  // Mevcut türbinlerin ek'lerini id bazlı map'e al
  const existingEkMap = {};
  for (const t of existingTurbines) {
    if (t.id && t.ek) {
      existingEkMap[t.id] = t.ek;
    }
  }

  // Gelen türbinlerin ek'lerini mevcut ile birleştir
  return incomingTurbines.map(t => {
    if (t.id && existingEkMap[t.id] && t.ek) {
      return { ...t, ek: { ...existingEkMap[t.id], ...t.ek } };
    }
    if (t.id && existingEkMap[t.id] && !t.ek) {
      return { ...t, ek: existingEkMap[t.id] };
    }
    return t;
  });
}

/**
 * Grid meter ek alanlarını birleştir (source bazlı eşleştirme)
 */
function mergeGridMeterEks(existingMeters, incomingMeters) {
  if (!Array.isArray(existingMeters) || !Array.isArray(incomingMeters)) {
    return incomingMeters || [];
  }

  const existingEkMap = {};
  for (const m of existingMeters) {
    if (m.source && m.ek) {
      existingEkMap[m.source] = m.ek;
    }
  }

  return incomingMeters.map(m => {
    if (m.source && existingEkMap[m.source] && m.ek) {
      return { ...m, ek: { ...existingEkMap[m.source], ...m.ek } };
    }
    if (m.source && existingEkMap[m.source] && !m.ek) {
      return { ...m, ek: existingEkMap[m.source] };
    }
    return m;
  });
}

exports.scadaTelemetry = onRequest(
  {
    region: "europe-west1",
    cors: false,            // Server-to-server; browser CORS gerekmiyor
    maxInstances: 5,        // 13 santral, ~1,3 istek/sn; 5 instance yeterli
    timeoutSeconds: 30,
    // Gövde sınırını 2 MB üzerinde tut (belgede ≥ 2 MB isteniyor)
    // firebase-functions v2'de rawBody limiti varsayılan 10 MB
  },
  async (req, res) => {
    // --- 1. Yalnız POST kabul et ---
    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method Not Allowed" });
      return;
    }

    try {
      const body = req.body;

      // --- 2. plant_id kontrolü ---
      const plantId = body && body.plant_id;
      if (!plantId || !VALID_PLANTS.has(plantId)) {
        console.warn(`[scadaTelemetry] Tanımsız plant_id: ${plantId}`);
        res.status(400).json({ success: false, error: "Tanımsız plant_id" });
        return;
      }

      // --- 3. API Key doğrulama ---
      const apiKey = req.headers["x-api-key"] || "";
      if (!apiKey || !validateApiKey(apiKey, plantId)) {
        console.warn(`[scadaTelemetry] Geçersiz API key, plant: ${plantId}`);
        res.status(401).json({ success: false, error: "Geçersiz API anahtarı" });
        return;
      }

      // Hızlı yanıt: İşlemi kabul et, arka planda kaydet
      // (Gönderen 20 sn bekler; hızlı dönmek önemli)
      res.status(200).json({ success: true });

      // --- 4. Türbin ID düzeltmeleri ---
      if (body.turbines) {
        body.turbines = fixTurbineIds(body.turbines, plantId);
      }

      // --- 5. Firestore referansları ---
      const liveRef = db.collection("scada_live").doc(plantId);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const ekTam = body.ek_tam === true;

      // --- 6. ek_tam birleştirme mantığı ---
      let finalData = { ...body };
      delete finalData.ek_tam; // Firestore'da ayrıca saklamaya gerek yok

      if (!ekTam) {
        // Kısmi paket: mevcut ek değerleri ile birleştir
        try {
          const liveDoc = await liveRef.get();
          if (liveDoc.exists) {
            const existing = liveDoc.data();

            // ek_genel birleştir
            finalData.ek_genel = mergeEk(existing.ek_genel, finalData.ek_genel);

            // Türbin ek'lerini birleştir
            finalData.turbines = mergeTurbineEks(existing.turbines, finalData.turbines);

            // Grid meter ek'lerini birleştir
            finalData.grid_meters = mergeGridMeterEks(existing.grid_meters, finalData.grid_meters);
          }
        } catch (mergeErr) {
          console.error(`[scadaTelemetry] ek birleştirme hatası (${plantId}):`, mergeErr);
          // Birleştirme başarısız olsa da gelen veriyi yaz
        }
      }

      // --- 7. Canlı durumu güncelle (scada_live/{plant_id}) ---
      finalData.received_at = now;
      finalData.ek_tam_last = ekTam ? (body.timestamp || new Date().toISOString()) : (finalData.ek_tam_last || null);

      await liveRef.set(finalData, { merge: false });

      // --- 8. Tam paketleri geçmişe kaydet (10 dakikada bir) ---
      if (ekTam) {
        const ts = body.timestamp || new Date().toISOString();
        // Zaman damgasını Firestore-uyumlu ID'ye çevir (: ve + karakterleri sorun çıkarabilir)
        const readingId = ts.replace(/[:.+]/g, "-");
        const historyRef = db.collection("scada_history").doc(plantId)
          .collection("readings").doc(readingId);

        const historyData = { ...finalData };
        historyData.received_at = now;

        await historyRef.set(historyData);
        console.log(`[scadaTelemetry] Tam paket kaydedildi: ${plantId} @ ${ts}`);
      }

      console.log(`[scadaTelemetry] ${plantId} verisi alındı (ek_tam: ${ekTam})`);

    } catch (err) {
      console.error("[scadaTelemetry] HATA:", err);
      // Yanıt zaten gönderilmiş olabilir; kontrol et
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: "Sunucu hatası" });
      }
    }
  }
);
