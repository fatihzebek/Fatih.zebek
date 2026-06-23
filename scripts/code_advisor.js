import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Simple parser for .env.local to avoid extra dependencies
const loadEnv = () => {
  try {
    const envPath = path.join(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8').replace(/\r/g, '');
      content.split('\n').forEach(line => {
        const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)$/);
        if (match) {
          const key = match[1].trim();
          let val = match[2].trim();
          if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
          if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
          process.env[key] = val;
        }
      });
    }
  } catch (err) {
    console.warn("⚠️ .env.local yüklenirken uyarı:", err.message);
  }
};

loadEnv();

const apiKey = process.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error("❌ HATA: VITE_GEMINI_API_KEY .env.local dosyasında bulunamadı.");
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

// Scan directory recursively to find all .ts or .js files
const getSourceFiles = (dir, fileList = []) => {
  if (!fs.existsSync(dir)) return fileList;
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && !file.startsWith('.')) {
        getSourceFiles(filePath, fileList);
      }
    } else if (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx')) {
      fileList.push(filePath);
    }
  });
  return fileList;
};

const runAnalysis = async (filePath) => {
  console.log(`\n🔍 [AI Ajanı] ${path.basename(filePath)} analiz ediliyor...\n`);
  
  try {
    const code = fs.readFileSync(filePath, 'utf8');
    const relativePath = path.relative(process.cwd(), filePath);

    const prompt = `
    Sen "DH Servis" rüzgar enerjisi saha operasyon yazılımını inceleyen uzman bir Yapay Zeka QA (Kalite Güvence), Güvenlik ve Mimari Danışman Ajanısın.
    Aşağıda sana kod içeriğini verdiğim dosyayı derinlemesine analiz et.
    
    Lütfen şu konularda geri bildirim sağla:
    1. Mantıksal Hatalar ve Riskler: Kodda olası yarış durumları (race conditions), bellek sızıntıları, Firebase yetkilendirme veya veri tutarsızlığı açıkları var mı?
    2. Tasarım & Mimari Eleştirisi: Fonksiyonların büyüklüğü, HTML/CSS/Veri lojiğinin iç içe geçme durumu ve modülerlik açısından önerilerin neler?
    3. Fikirler ve Güncelleme Önerileri ("Şunu da yapsak güzel olurdu" diyeceğimiz şeyler): Kullanıcı deneyimini (UX), performansı artıracak veya operasyonu kolaylaştıracak 2-3 adet yaratıcı fikir sun.

    Yanıtını samimi, yapıcı ve doğrudan geliştiriciye hitap eden profesyonel bir tonda Türkçe olarak yaz. Gereksiz giriş paragraflarından kaçın, doğrudan madde madde analize başla.

    Analiz Edilen Dosya Yolu: ${relativePath}
    Kod İçeriği:
    \`\`\`
    ${code}
    \`\`\`
    `;

    let result;
    let retries = 3;
    let delay = 2000;
    for (let i = 0; i < retries; i++) {
      try {
        result = await model.generateContent(prompt);
        break;
      } catch (e) {
        const isRateLimitOr503 = e.message.includes('503') || e.message.includes('ResourceExhausted') || e.message.includes('Service Unavailable') || e.message.includes('high demand');
        if (isRateLimitOr503 && i < retries - 1) {
          console.warn(`⚠️ Google Gemini API yoğun/meşgul (Hata: ${e.message}). ${delay / 1000} saniye sonra tekrar deneniyor (${i + 1}/${retries})...`);
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 2;
        } else {
          throw e;
        }
      }
    }

    const response = await result.response;
    
    console.log("================================================================================");
    console.log(`🤖 AI KOD DANIŞMANI AJANI - ANALİZ RAPORU (${relativePath})`);
    console.log("================================================================================");
    console.log(response.text());
    console.log("================================================================================");
    
    // Save report to a local folder for reference
    const reportsDir = path.join(process.cwd(), 'scratch', 'reports');
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }
    const reportFile = path.join(reportsDir, `${path.basename(filePath)}.analysis.md`);
    fs.writeFileSync(reportFile, response.text(), 'utf8');
    console.log(`💾 Analiz raporu kaydedildi: ${path.relative(process.cwd(), reportFile)}`);

    // Save to public/reports for web UI access
    const publicReportsDir = path.join(process.cwd(), 'public', 'reports');
    if (!fs.existsSync(publicReportsDir)) {
      fs.mkdirSync(publicReportsDir, { recursive: true });
    }
    const publicReportFile = path.join(publicReportsDir, `${path.basename(filePath)}.analysis.md`);
    fs.writeFileSync(publicReportFile, response.text(), 'utf8');

    // Update index.json
    const indexPath = path.join(publicReportsDir, 'index.json');
    let indexData = [];
    if (fs.existsSync(indexPath)) {
      try {
        indexData = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
      } catch (e) {
        indexData = [];
      }
    }
    
    const relPath = path.relative(process.cwd(), filePath);
    const existingIdx = indexData.findIndex(item => item.file === relPath);
    const newEntry = {
      file: relPath,
      name: path.basename(filePath),
      date: new Date().toLocaleString('tr-TR'),
      timestamp: Date.now(),
      reportUrl: `/reports/${path.basename(filePath)}.analysis.md`
    };
    
    if (existingIdx !== -1) {
      indexData[existingIdx] = newEntry;
    } else {
      indexData.push(newEntry);
    }
    
    fs.writeFileSync(indexPath, JSON.stringify(indexData, null, 2), 'utf8');
    console.log(`💾 Ajan raporu Web arayüzü için kaydedildi ve indeks güncellendi.\n`);

  } catch (err) {
    console.error("❌ Analiz sırasında hata oluştu:", err.message);
  }
};

const main = async () => {
  let selectedFile = process.argv[2];

  const safeExit = (code = 0) => {
    setTimeout(() => {
      process.exit(code);
    }, 100);
  };

  if (selectedFile) {
    const fullPath = path.resolve(selectedFile);
    if (fs.existsSync(fullPath)) {
      await runAnalysis(fullPath);
      safeExit(0);
      return;
    } else {
      console.error(`❌ HATA: '${selectedFile}' dosyası bulunamadı.`);
      safeExit(1);
      return;
    }
  }

  // Interactive CLI Selection
  console.log("=================================================");
  console.log("🤖 DH SERVIS AI KOD DANIŞMANI VE QA AJANI");
  console.log("=================================================");
  console.log("Sistemdeki kaynak dosyaları taranıyor...");
  
  const srcFiles = [
    ...getSourceFiles(path.join(process.cwd(), 'src', 'pages')),
    ...getSourceFiles(path.join(process.cwd(), 'src', 'services')),
    ...getSourceFiles(path.join(process.cwd(), 'src', 'utils')),
    ...getSourceFiles(path.join(process.cwd(), 'agents'))
  ];

  if (srcFiles.length === 0) {
    console.log("❌ Tarama alanında (.ts/.js) dosyası bulunamadı.");
    safeExit(0);
    return;
  }

  // Sort files for better presentation
  srcFiles.sort((a, b) => a.localeCompare(b));

  console.log("\nAnaliz etmek istediğiniz dosyayı seçin:");
  srcFiles.forEach((file, index) => {
    const rel = path.relative(process.cwd(), file);
    console.log(`[${index + 1}] ${rel}`);
  });

  const rlInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rlInterface.question('\nSeçiminiz (Sayı girin veya çıkmak için Enter): ', async (answer) => {
    rlInterface.close();
    const idx = parseInt(answer.trim()) - 1;
    if (!isNaN(idx) && idx >= 0 && idx < srcFiles.length) {
      await runAnalysis(srcFiles[idx]);
    } else {
      console.log("👋 Çıkış yapıldı.");
    }
    safeExit(0);
  });
};

main();
