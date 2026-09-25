const { onRequest } = require("firebase-functions/v2/https");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");
const crypto = require("crypto");

// Firebase Admin SDK başlat (Cloud Functions ortamında otomatik credentials)
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const webpush = require("web-push");

// Load status code mappings for SCADA fault notifications
let statusCodesMap = {};
let faultCodesList = [];
try {
  statusCodesMap = require("./status_codes_map.json");
} catch (e) {
  console.warn("[SCADA] status_codes_map.json yüklenemedi:", e.message);
}
try {
  faultCodesList = require("./fault_codes.json");
} catch (e) {
  console.warn("[SCADA] fault_codes.json yüklenemedi:", e.message);
}

// VAPID Configuration for Web Push
const VAPID_PUBLIC_KEY = "BBRUMqEX4JSbeW-4hrlYVPkR0kyAprwYoZMPIqQZkso8mhF7IlsENJfhv9VeNwReKqPzNsJyjFT2-rH_h79_f0U";
const VAPID_PRIVATE_KEY = "8ybSNqDupGv2mDe_oUJCU-0BoPzQ7aSHzagVrmNGK2A";
const VAPID_SUBJECT = "mailto:fatih.zebek@demirerholding.com";

try {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (vapidErr) {
  console.error("[webpush] setVapidDetails hatası:", vapidErr);
}

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

    // Mare Manastır: E-82 türbinleri (826427 - 826432) SCADA'da T1-T6 gelir, sistemde T50 - T55 olarak eşlenir
    if (plantId === "mare") {
      const serial = String(t.serial_no || "").trim();
      if (serial === "826427") num = 50;
      else if (serial === "826428") num = 51;
      else if (serial === "826429") num = 52;
      else if (serial === "826430") num = 53;
      else if (serial === "826431") num = 54;
      else if (serial === "826432") num = 55;
      else if (num >= 1 && num <= 6 && (t.type === "E-82" || t.controlType === "CS82" || (t.name && t.name.includes("E-82")))) {
        num = num + 49;
      }
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

  // Datça: numarası 36'dan büyük türbin kayıtlarını at (DH-Servis sadece T01 - T36 servisidir)
  if (plantId === "datca") {
    result = result.filter(t => (t._num || 0) <= 36);
  }

  // Çamseki: Demirer Holding sadece T01 - T11 arası türbinlerin servisini yapar; T12 ve yukarısını filtrele
  if (plantId === "camseki") {
    result = result.filter(t => (t._num || 0) <= 11);
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

// --- Santral ID -> Saha ID & Adı Eşleme Tablosu ---
const PLANT_TO_SITE = {
  "germiyan":  { siteId: "0752", name: "Alize Germiyan" },
  "mare":      { siteId: "2678", name: "Mare Manastır" },
  "intepe":    { siteId: "2688", name: "Anemon İntepe" },
  "sayalar":   { siteId: "2990", name: "Doğal Sayalar" },
  "datca":     { siteId: "3213", name: "Dares Datça" },
  "camseki":   { siteId: "3243", name: "Alize Çamseki" },
  "keltepe":   { siteId: "3245", name: "Alize Keltepe" },
  "sarikaya":  { siteId: "3439", name: "Alize Sarıkaya" },
  "kuyucak":   { siteId: "3793", name: "Alize Kuyucak" },
  "cataltepe": { siteId: "3892", name: "Alize Çataltepe" },
  "cakil":     { siteId: "cakil", name: "Çakıl RES" },
  "kozbeyli":  { siteId: "kozbeyli", name: "Kozbeyli RES" },
  "samurlu":   { siteId: "samurlu", name: "Samurlu RES" }
};

// --- Bildirim Gönderilmeyecek Santraller (Bakımını DH-Servis'in yapmadığı sahalar) ---
const EXCLUDED_ALERT_PLANTS = new Set(["cakil", "kozbeyli", "samurlu"]);

// --- Saha Ekip Numarası Eşleşmeleri (Birebir Eşleşme - Team 15 asla Team 1 ile karışmaz) ---
const TEAM_NUM_TO_SITES = {
  1:  ['2678', '0752'], // Çeşme (Mare & Germiyan)
  2:  ['2678', '0752'],
  12: ['2678', '0752'],
  3:  ['2688', '3439', '3243'], // Çanakkale (İntepe, Sarıkaya, Çamseki)
  4:  ['2688', '3439', '3243'],
  13: ['2688', '3439', '3243'],
  15: ['2688', '3439', '3243'],
  6:  ['2990', '3793'], // Balıkesir (Sayalar, Kuyucak)
  8:  ['2990', '3793'],
  9:  ['2990', '3793'],
  14: ['2990', '3793'],
  5:  ['3213'],         // Datça
  10: ['3213'],
  7:  ['3245', '3892'], // Keltepe & Çataltepe
  11: ['3245', '3892']
};

// --- Bölge İsimleri -> Saha ID Eşleştirmesi ---
const REGION_TO_SITES = {
  'canakkale': ['2688', '3439', '3243'],
  'çanakkale': ['2688', '3439', '3243'],
  'intepe': ['2688', '3439', '3243'],
  'balikesir': ['2990', '3793'],
  'balıkesir': ['2990', '3793'],
  'sarkoy': ['2990', '3793'],
  'şarköy': ['2990', '3793'],
  'sayalar': ['2990', '3793'],
  'cesme': ['2678', '0752'],
  'çeşme': ['2678', '0752'],
  'germiyan': ['2678', '0752'],
  'mare': ['2678', '0752'],
  'mugla': ['3213', '3245', '3892'],
  'muğla': ['3213', '3245', '3892'],
  'datca': ['3213'],
  'datça': ['3213'],
  'keltepe': ['3245', '3892']
};

/**
 * Herhangi bir metinden (Team 03, dh-tm03@..., team3 vb.) ekip numarasını tam sayı olarak çıkarır
 */
function extractTeamNum(val) {
  if (!val) return null;
  const m = String(val).toLowerCase().match(/(?:team|ekip|tm)[\s_-]*0*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// Bireysel kurumsal maille giren personellerin ekip bilgilerini Firestore users tablosundan önbellekle
let cachedUserTeamMap = null;
let lastUserMapFetch = 0;
async function getUserTeamMap() {
  const now = Date.now();
  if (cachedUserTeamMap && (now - lastUserMapFetch) < 5 * 60 * 1000) {
    return cachedUserTeamMap;
  }
  const map = new Map();
  try {
    const usersSnap = await db.collection("users").get();
    usersSnap.forEach(d => {
      const u = d.data();
      const email = (u.email || d.id || '').toLowerCase().trim();
      const team = u.team || '';
      if (email && team) {
        map.set(email, team);
      }
    });
    cachedUserTeamMap = map;
    lastUserMapFetch = now;
  } catch (e) {
    console.warn("[getUserTeamMap] users okuma uyarısı:", e.message);
    if (cachedUserTeamMap) return cachedUserTeamMap;
  }
  return map;
}

/**
 * Abonenin ekip numarasını çözer (Doğrudan veriden veya users tablosundaki ekip kaydından)
 */
function getSubscriberTeamNum(sub, userTeamMap) {
  if (!sub) return null;
  // 1. sub üzerindeki team, displayName veya user (email) metninden ekip numarası çıkar
  let teamNum = extractTeamNum(sub.team) || extractTeamNum(sub.displayName) || extractTeamNum(sub.user);
  if (teamNum !== null) return teamNum;

  // 2. Kişisel şirket mailiyle (ad.soyad@...) girmiş teknisyenler için users tablosundaki ekibe bak
  if (userTeamMap) {
    const userEmail = (sub.user || '').toLowerCase().trim();
    const mappedTeam = userTeamMap.get(userEmail);
    if (mappedTeam) {
      teamNum = extractTeamNum(mappedTeam);
      if (teamNum !== null) return teamNum;
    }
  }
  return null;
}

/**
 * SCADA Arıza Kodu ve Açıklamasını Çözümler (Tanımsız kodlarda asla 'Enercon' yazmaz)
 */
function resolveFaultInfo(rawInput, fallbackText) {
  if (!rawInput) {
    return {
      code: "ARIZA",
      description: "SCADA Arızası"
    };
  }

  let cleaned = String(rawInput).replace(/^enercon\s*/i, '').trim();
  let cleanFallback = String(fallbackText || '').replace(/^enercon\s*/i, '').trim();
  if (cleanFallback.toLowerCase() === 'enercon' || cleanFallback.toLowerCase() === 'scada arızası') {
    cleanFallback = '';
  }

  const arrayParts = cleaned.split(/[,:]/).map(s => s.trim()).filter(Boolean);
  let hyphenCode = cleaned.replace(':', '-');
  let colonCode = cleaned.replace('-', ':');

  if (arrayParts.length >= 2) {
    hyphenCode = `${arrayParts[0]}-${arrayParts[1]}`;
    colonCode = `${arrayParts[0]}:${arrayParts[1]}`;
  }

  // 1. status_codes_map.json (3.300+ resmi Enercon SCADA tanımı)
  const mapEntry = statusCodesMap[colonCode] || statusCodesMap[hyphenCode];
  if (mapEntry && mapEntry.description) {
    const descParts = [mapEntry.category, mapEntry.description].filter(Boolean);
    const cleanDesc = descParts.join(" - ").replace(/\s*-\s*T\d+\s*$/i, '').trim();
    return {
      code: hyphenCode,
      description: cleanDesc
    };
  }

  // 2. fault_codes.json yedek sözlük
  if (Array.isArray(faultCodesList)) {
    const fc = faultCodesList.find(c => {
      const cLower = (c.KOD || "").trim().toLowerCase();
      return cLower === hyphenCode.toLowerCase() || cLower === colonCode.toLowerCase();
    });
    if (fc && fc.Aciklama) {
      const parts = fc.Aciklama.split('-').map(s => s.trim()).filter(Boolean);
      const desc = (parts.length >= 2 ? parts[1].replace(/\s+(T\d+|Fault|Warning|Information \/ Warnings)\s*$/i, '').trim() : parts[0]).replace(/\s*-\s*T\d+\s*$/i, '').trim();
      return {
        code: hyphenCode,
        description: desc
      };
    }
  }

  // Tanımlı olmayan kodlar için Enercon yazma; sadece kodun kendisini veya temiz açıklamayı döndür
  const finalDesc = (cleanFallback || `Arıza Kodu: ${hyphenCode}`).replace(/\s*-\s*T\d+\s*$/i, '').trim();
  return {
    code: hyphenCode,
    description: finalDesc
  };
}

/**
 * Türbinin arıza durumunu analiz eder (T5 & T6 kuralı: 2:1 Lack of wind ve normal durumlar arıza sayılmaz)
 */
function checkTurbineFault(t) {
  if (!t) return { isFault: false, mainCode: '', isMaint: false, statusText: '' };
  const rawStatus = t.enercon_status || (t.status_code ? String(t.status_code) : '');
  const stParts = (rawStatus || '').split(/[,:]/).map(s => s.trim()).filter(Boolean);
  const mainCode = stParts.length >= 2 ? `${stParts[0]}-${stParts[1]}` : (rawStatus || '');
  const colonCode = stParts.length >= 2 ? `${stParts[0]}:${stParts[1]}` : (rawStatus || '');

  // 1. Bakım kontrolü (8:0, 0:8 vb.)
  const isMaintCode = ['8-0', '8:0', '0-8', '0:8', '8-1', '8:1', '8-2', '8:2', '8-3', '8:3', '8-4', '8:4', '8-5', '8:5', '8-6', '8:6', '8-7', '8:7', '8-8', '8:8'].includes(mainCode) || stParts[0] === '8' || (t.status_text || '').toLowerCase().includes('maintenance');
  if (isMaintCode) {
    return { isFault: false, mainCode, isMaint: true, statusText: t.status_text || '' };
  }

  // 2. Normal işletim kontrolü (0:0, 0:1, vb. veya 0 ile başlayanlar)
  const isNorm = ['0-0', '0:0', '0-1', '0:1', '0-2', '0:2', '0-4', '0:4', '0-5', '0:5', '0', '1', 'OK'].includes(mainCode) || stParts[0] === '0';
  if (isNorm) {
    return { isFault: false, mainCode, isMaint: false, statusText: t.status_text || '' };
  }

  // 3. Enercon statusCodesMap ve T5/T6 kontrolü (T1 ve T3/T4 elenir; 2:1 Lack of wind gibi durumlar asla arıza değildir)
  const mapEntry = statusCodesMap[colonCode] || statusCodesMap[mainCode];
  if (mapEntry) {
    const isRealFault = (mapEntry.type === 'T5' || mapEntry.type === 'T6') && mapEntry.category !== 'Maintenance';
    return {
      isFault: isRealFault,
      mainCode: mainCode,
      isMaint: false,
      statusText: t.status_text || ''
    };
  }

  // 4. Haritada tanımlı olmayan kodlar:
  // Eğer stParts[0] === '2' ise (Lack of wind türevleri), arıza sayma!
  if (stParts[0] === '2') {
    return { isFault: false, mainCode, isMaint: false, statusText: t.status_text || '' };
  }

  // 0, 2, 8 dışındaki bilinmeyen durumlar için status_code > 0 ise arıza say
  const isUnknownFault = (Number(t.status_code) > 0 || (stParts.length >= 2 && !['0', '2', '8'].includes(stParts[0])));
  return {
    isFault: !!isUnknownFault,
    mainCode: mainCode,
    isMaint: false,
    statusText: t.status_text || ''
  };
}

/**
 * Bir abonenin belirtilen santral için bildirim almaya yetkili olup olmadığını kontrol eder
 */
function isSubscriberEligibleForSite(sub, siteId, userTeamMap) {
  const email = (sub.user || '').toLowerCase().trim();
  const role = (sub.role || '').toUpperCase().trim();

  // 1. Adminler, Fatih ZEBEK ve Furkan YILDIRIM tüm santrallerden bildirim alır
  if (
    role === 'ADMIN' ||
    email.includes('fatih.zebek') ||
    email.includes('furkan.yildirim')
  ) {
    return true;
  }

  // 2. Özel izin verilen sahalar kontrolü (varsa en öncelikli)
  const allowedSites = Array.isArray(sub.allowedSites) ? sub.allowedSites : [];
  if (allowedSites.includes(siteId) || allowedSites.includes('all')) {
    return true;
  }
  if (allowedSites.length > 0) {
    return false; // Belirli sahalar tanımlıysa başka saha bildirimi alamaz
  }

  // 3. Saha ekip numarası birebir tam sayı eşleşmesi (Team 15 asla Team 1 ile karışmaz)
  const teamNum = getSubscriberTeamNum(sub, userTeamMap);
  if (teamNum !== null && TEAM_NUM_TO_SITES[teamNum]) {
    return TEAM_NUM_TO_SITES[teamNum].includes(siteId);
  }

  return false;
}

/**
 * Sahaya atanmış abonelere ve tüm santrallerden sorumlu yöneticilere Web Push gönderir
 */
async function sendWebPushToSite(siteId, title, body, url, tag) {
  try {
    const [subsSnap, userTeamMap] = await Promise.all([
      db.collection("push_subscriptions").get(),
      getUserTeamMap()
    ]);
    if (subsSnap.empty) return;

    const payload = JSON.stringify({
      title: title,
      body: body,
      url: url || `/turbines?site=${siteId}`,
      tag: tag || `scada-fault-${siteId}-${Date.now()}`,
      vibrate: [400, 200, 400, 200, 600],
      requireInteraction: true
    });

    const promises = [];
    subsSnap.forEach((docSnap) => {
      const sub = docSnap.data();
      if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return;

      if (isSubscriberEligibleForSite(sub, siteId, userTeamMap)) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };

        const p = webpush.sendNotification(pushSubscription, payload)
          .catch(async (err) => {
            console.warn(`[webpush] Gönderim uyarısı (${sub.user || docSnap.id}):`, err.statusCode || err.message);
            if (err.statusCode === 404 || err.statusCode === 410) {
              try {
                await docSnap.ref.delete();
              } catch (_) {}
            }
          });
        promises.push(p);
      }
    });

    await Promise.allSettled(promises);
    console.log(`[webpush] ${promises.length} aboneye bildirim iletildi (${siteId}).`);
  } catch (err) {
    console.error("[webpush] Gönderim hatası:", err);
  }
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

      // --- 5. Firestore referansları ve Mevcut Veriyi Oku ---
      const liveRef = db.collection("scada_live").doc(plantId);
      const now = admin.firestore.FieldValue.serverTimestamp();
      const ekTam = body.ek_tam === true;

      let existing = null;
      try {
        const liveDoc = await liveRef.get();
        if (liveDoc.exists) {
          existing = liveDoc.data();
        }
      } catch (err) {
        console.warn(`[scadaTelemetry] liveDoc okuma uyarısı (${plantId}):`, err.message);
      }

      // --- 6. ek_tam birleştirme mantığı ---
      let finalData = { ...body };
      delete finalData.ek_tam; // Firestore'da ayrıca saklamaya gerek yok

      if (!ekTam && existing) {
        finalData.ek_genel = mergeEk(existing.ek_genel, finalData.ek_genel);
        finalData.turbines = mergeTurbineEks(existing.turbines, finalData.turbines);
        finalData.grid_meters = mergeGridMeterEks(existing.grid_meters, finalData.grid_meters);
      }

      // --- 7. OTOMATİK SCADA ARIZA VE BAKIM BİLDİRİMİ TESPİTİ ---
      // Çakıl, Kozbeyli, Samurlu gibi DH-Servis'in bakmadığı santraller bildirim üretmez
      const shouldAlert = !EXCLUDED_ALERT_PLANTS.has(plantId);
      const plantInfo = PLANT_TO_SITE[plantId] || { siteId: plantId, name: plantId.toUpperCase() };
      const prevTurbineMap = new Map();
      if (existing && Array.isArray(existing.turbines)) {
        for (const pt of existing.turbines) {
          const key = pt.serial_no || pt.id;
          if (key) prevTurbineMap.set(key, pt);
        }
      }

      const pushAlerts = [];
      const COOLDOWN_MS = 5 * 60 * 1000; // Aynı arıza kodu için 5 dakika cooldown

      if (shouldAlert && existing && Array.isArray(finalData.turbines)) {
        for (const t of finalData.turbines) {
          const key = t.serial_no || t.id;
          const prev = prevTurbineMap.get(key);
          const prevInfo = checkTurbineFault(prev);
          const newInfo = checkTurbineFault(t);
          const turbineLabel = t.id || t.name || key;

          // 1. Bakıma Alındı / Bakımdan Çıkarıldı Geçişleri
          const isMaintEntry = !prevInfo.isMaint && newInfo.isMaint;
          const isMaintExit = prevInfo.isMaint && !newInfo.isMaint;

          if (isMaintEntry) {
            pushAlerts.push({
              title: `🛠️ SCADA: ${plantInfo.name} - ${turbineLabel} Bakıma Alındı`,
              body: `Türbin bakım moduna (dh_servis 8:0) alındı.`,
              tag: `maint-entry-${plantId}-${turbineLabel}`,
              url: `/turbines?site=${plantInfo.siteId}&turbine=${encodeURIComponent(turbineLabel)}`
            });
          } else if (isMaintExit) {
            pushAlerts.push({
              title: `✅ SCADA: ${plantInfo.name} - ${turbineLabel} Bakımdan Çıkarıldı`,
              body: `Türbin bakım modundan çıkarıldı.`,
              tag: `maint-exit-${plantId}-${turbineLabel}`,
              url: `/turbines?site=${plantInfo.siteId}&turbine=${encodeURIComponent(turbineLabel)}`
            });
          }

          // 2. Gerçek Arızaya Geçiş Koşulu (Yalnızca T5 ve T6 kodları):
          // - Önceden arıza yokken şimdi arızaya geçti
          // VEYA
          // - Önceden de arızadaydı ama arıza kodu DEĞİŞTİ (yeni bir arıza)
          const isTransition = newInfo.isFault && (
            !prevInfo.isFault || (prevInfo.isFault && prevInfo.mainCode !== newInfo.mainCode)
          );

          // Arıza başlangıç zamanı ve 5 dk otomatik görev takibi
          if (isTransition) {
            t.fault_started_at = Date.now();
            t.auto_task_created = false;
          } else if (newInfo.isFault && prev?.fault_started_at) {
            t.fault_started_at = prev.fault_started_at;
            t.auto_task_created = prev.auto_task_created || false;
            t.auto_task_id = prev.auto_task_id || null;
          } else if (!newInfo.isFault) {
            delete t.fault_started_at;
            delete t.auto_task_created;
            delete t.auto_task_id;
            delete t.last_fault_alert;
          }

          // Cooldown kontrolü: aynı kodla son 5 dk içinde bildirim gitmiş mi?
          const lastAlert = prev?.last_fault_alert;
          const isThrottled = isTransition && lastAlert && 
            lastAlert.code === newInfo.mainCode && 
            (Date.now() - (lastAlert.sent_at || 0)) < COOLDOWN_MS;

          if (isTransition && !isThrottled) {
            const faultInfo = resolveFaultInfo(t.enercon_status || t.status_code, t.status_text);
            
            // Damgala: bu türbin için bildirim zamanını ve kodunu kaydet
            t.last_fault_alert = {
              code: newInfo.mainCode,
              sent_at: Date.now()
            };

            pushAlerts.push({
              title: `⚠️ SCADA Arıza: ${plantInfo.name} - ${turbineLabel}`,
              body: `${faultInfo.code} — ${faultInfo.description}`,
              tag: `scada-fault-${plantId}-${turbineLabel}`,
              url: `/turbines?site=${plantInfo.siteId}&turbine=${encodeURIComponent(turbineLabel)}&action=claim`
            });
          } else if (prev?.last_fault_alert && newInfo.isFault) {
            // Arıza devam ediyorsa son alert bilgisini muhafaza et
            t.last_fault_alert = prev.last_fault_alert;
          }

          // 3. Kalıcı Arıza Takibi: Arıza kesintisiz 5 dakika sürdüyse otomatik havuz görevi oluştur
          const AUTO_TASK_DURATION_MS = 5 * 60 * 1000; // 5 dakika kalıcı arıza eşiği
          if (newInfo.isFault && t.fault_started_at && !t.auto_task_created) {
            const faultDuration = Date.now() - t.fault_started_at;
            if (faultDuration >= AUTO_TASK_DURATION_MS) {
              const faultInfo = resolveFaultInfo(t.enercon_status || t.status_code, t.status_text);
              const serialStr = String(t.serial_no || key || '').trim();

              // Mükerrer görev kontrolü: Türbinde henüz tamamlanmamış açık/işlemde görev var mı?
              let hasActiveTask = false;
              try {
                if (serialStr) {
                  const existingTasksSnap = await db.collection("tasks")
                    .where("taskInfo.turbinSeriNo", "==", serialStr)
                    .where("metadata.isDeleted", "==", false)
                    .get();

                  hasActiveTask = existingTasksSnap.docs.some(docSnap => {
                    const st = docSnap.data().workflow?.durum;
                    return st !== 'Tamamlandı' && st !== 'İptal' && st !== 'İptal Edildi';
                  });
                }
              } catch (checkErr) {
                console.warn(`[scadaTelemetry] Mükerrer görev kontrol hatası (${turbineLabel}):`, checkErr.message);
              }

              if (!hasActiveTask) {
                try {
                  const newTaskDoc = {
                    taskInfo: {
                      secilenSablon: 'Türbin Arıza Formu',
                      sahaBilgisi: plantInfo.name,
                      siteId: plantInfo.siteId,
                      turbinSeriNo: serialStr,
                      turbinNo: turbineLabel,
                      taskLocationType: 'TURBINE',
                      warehouseId: '',
                      warehouseName: '',
                      tamirFormNo: '',
                      revisionNo: '',
                      matFormNo: ''
                    },
                    repairedMaterial: null,
                    faultData: {
                      statuKodu: faultInfo.code,
                      statuAciklamasi: faultInfo.description
                    },
                    assignment: {
                      assignedTeam: 'HAVUZ',
                      isPoolTask: true,
                      yoneticiNotu: `[SCADA OTOMATİK GÖREV]\n${plantInfo.name} ${turbineLabel} türbininde 5 dakikadır devam eden ${faultInfo.code} (${faultInfo.description}) arızası için otomatik oluşturuldu. Müdahaleye giden ekip görevi üstlenip servis raporunu doldurabilir.`,
                      resolvedDeficiencyId: '',
                      createdBy: 'SCADA Otomasyonu'
                    },
                    workflow: {
                      durum: 'Açık Görev',
                      olusturulmaTarihi: admin.firestore.FieldValue.serverTimestamp(),
                      guncellenmeTarihi: admin.firestore.FieldValue.serverTimestamp(),
                      tamamlanmaTarihi: null,
                      claimedBy: null,
                      claimedAt: null
                    },
                    formVerileri: {},
                    metadata: {
                      isDeleted: false,
                      version: '1.0',
                      autoCreatedByScada: true,
                      scadaPlantId: plantId,
                      scadaFaultCode: faultInfo.code
                    },
                    maintenanceData: null
                  };

                  const createdDocRef = await db.collection("tasks").add(newTaskDoc);
                  t.auto_task_id = createdDocRef.id;
                  console.log(`[scadaTelemetry] 5 dk kalıcı arıza için otomatik havuz görevi açıldı: ID ${createdDocRef.id} (${plantInfo.name} - ${turbineLabel})`);

                  // Web Push Bildirimi ekle
                  pushAlerts.push({
                    title: `📋 SCADA Görevi Havuzda: ${plantInfo.name} - ${turbineLabel}`,
                    body: `5 dakikadır süren ${faultInfo.code} arızası için havuzda görev oluşturuldu. Görevi üstlenebilirsiniz.`,
                    tag: `scada-task-${plantId}-${turbineLabel}`,
                    url: `/turbines?site=${plantInfo.siteId}&turbine=${encodeURIComponent(turbineLabel)}`
                  });

                  // Uygulama içi Bildirim & Duyuru Merkezi (announcements) kaydı
                  try {
                    await db.collection("announcements").add({
                      title: `📋 SCADA Görevi Havuzda: ${plantInfo.name} - ${turbineLabel}`,
                      message: `${turbineLabel} türbininde 5 dakikadır devam eden "${faultInfo.code} — ${faultInfo.description}" arızası için havuza otomatik iş emri açıldı.`,
                      category: 'task',
                      targetAudience: 'SITE',
                      targetValue: plantInfo.siteId,
                      createdBy: 'scada_automation',
                      createdByName: 'SCADA Otomasyonu',
                      createdAt: Date.now(),
                      active: true
                    });
                  } catch (annErr) {
                    console.warn("[scadaTelemetry] Announcement kaydı uyarısı:", annErr);
                  }
                } catch (taskErr) {
                  console.error(`[scadaTelemetry] Otomatik görev oluşturulamadı (${turbineLabel}):`, taskErr);
                }
              } else {
                console.log(`[scadaTelemetry] ${plantInfo.name} - ${turbineLabel} için zaten aktif görev var, mükerrer açılmadı.`);
              }

              // Görev açıldı (veya zaten aktif görev olduğu için pas geçildi) olarak işaretle
              t.auto_task_created = true;
            }
          }
        }
      }

      // --- 8. Bildirimleri yalnız ilgili cihazlara Web Push olarak ilet ---
      for (const alertItem of pushAlerts) {
        try {
          await sendWebPushToSite(
            plantInfo.siteId,
            alertItem.title,
            alertItem.body,
            alertItem.url || `/turbines?site=${plantInfo.siteId}`,
            alertItem.tag
          );
          console.log(`[scadaTelemetry] Web Push iletildi: ${alertItem.title}`);
        } catch (alertErr) {
          console.error(`[scadaTelemetry] Web Push bildirim hatası:`, alertErr);
        }
      }

      // --- 9. Canlı durumu güncelle (scada_live/{plant_id}) ---
      finalData.received_at = now;
      finalData.ek_tam_last = ekTam ? (body.timestamp || new Date().toISOString()) : (finalData.ek_tam_last || null);

      await liveRef.set(finalData, { merge: false });

      // --- 10. Tam paketleri geçmişe kaydet (10 dakikada bir) ---
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

/**
 * Bildirim & Duyuru Merkezi'nden gönderilen duyuruları hedeflenen cihazlara Web Push olarak iletir
 */
async function sendBroadcastWebPush(title, body, targetAudience, targetValue, category) {
  try {
    const [subsSnap, userTeamMap] = await Promise.all([
      db.collection("push_subscriptions").get(),
      getUserTeamMap()
    ]);
    if (subsSnap.empty) {
      console.log("[sendBroadcastWebPush] Kayıtlı push aboneliği yok.");
      return { success: true, count: 0 };
    }

    const isUrgent = category === "urgent" || category === "safety";
    const payload = JSON.stringify({
      title: title || "DH-Servis Duyurusu",
      body: body || "",
      url: "/dashboard",
      tag: `announcement-${Date.now()}`,
      vibrate: isUrgent ? [500, 200, 500, 200, 500] : [300, 150, 300],
      requireInteraction: isUrgent
    });

    const promises = [];

    subsSnap.forEach((docSnap) => {
      const sub = docSnap.data();
      if (!sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) return;

      let eligible = false;
      if (!targetAudience || targetAudience === "ALL") {
        eligible = true;
      } else if (targetAudience === "TEAM") {
        const targetTeamNum = extractTeamNum(targetValue);
        const subTeamNum = getSubscriberTeamNum(sub, userTeamMap);
        eligible = targetTeamNum !== null && subTeamNum !== null && targetTeamNum === subTeamNum;
      } else if (targetAudience === "REGION") {
        const targetRegionLower = (targetValue || "").toLowerCase();
        let regionSites = [];
        for (const [key, sites] of Object.entries(REGION_TO_SITES)) {
          if (targetRegionLower.includes(key)) {
            regionSites = sites;
            break;
          }
        }
        if (regionSites.length > 0) {
          eligible = regionSites.some(sId => isSubscriberEligibleForSite(sub, sId, userTeamMap));
        } else {
          eligible = isSubscriberEligibleForSite(sub, targetValue, userTeamMap);
        }
      } else if (targetAudience === "SITE") {
        eligible = isSubscriberEligibleForSite(sub, targetValue, userTeamMap);
      } else if (targetAudience === "SELF") {
        const subUser = (sub.user || "").toLowerCase().trim();
        const targetUser = (targetValue || "").toLowerCase().trim();
        eligible = targetUser ? (subUser === targetUser || subUser.includes(targetUser)) : subUser.includes("fatih.zebek");
      } else {
        eligible = true;
      }

      if (eligible) {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.keys.p256dh,
            auth: sub.keys.auth
          }
        };

        const p = webpush.sendNotification(pushSubscription, payload)
          .catch(async (err) => {
            console.warn(`[sendBroadcastWebPush] Gönderim uyarısı (${sub.user || docSnap.id}):`, err.statusCode || err.message);
            if (err.statusCode === 404 || err.statusCode === 410) {
              try {
                await docSnap.ref.delete();
              } catch (_) {}
            }
          });
        promises.push(p);
      }
    });

    await Promise.allSettled(promises);
    console.log(`[sendBroadcastWebPush] Toplam ${promises.length} cihaza Web Push bildirimi iletildi.`);
    return { success: true, count: promises.length };
  } catch (err) {
    console.error("[sendBroadcastWebPush] HATA:", err);
    return { success: false, error: err.message };
  }
}

/**
 * Cloud Function (HTTPS): broadcastNotification
 * Admin panelinden "BİLDİRİMİ GÖNDER" dendiğinde anında tetiklenir
 */
exports.broadcastNotification = onRequest(
  {
    region: "europe-west1",
    cors: true,
    maxInstances: 5,
    timeoutSeconds: 30
  },
  async (req, res) => {
    // CORS headers
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    if (req.method !== "POST") {
      res.status(405).json({ success: false, error: "Method Not Allowed" });
      return;
    }

    try {
      const { title, message, targetAudience, targetValue, category } = req.body || {};
      if (!title || !message) {
        res.status(400).json({ success: false, error: "Başlık ve mesaj alanları zorunludur" });
        return;
      }

      const result = await sendBroadcastWebPush(title, message, targetAudience, targetValue, category);
      res.status(200).json(result);
    } catch (err) {
      console.error("[broadcastNotification] HATA:", err);
      res.status(500).json({ success: false, error: err.message });
    }
  }
);
