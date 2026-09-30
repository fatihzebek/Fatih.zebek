const fs = require('fs');
const path = require('path');

function syncParameters() {
  console.log('🔄 [sync_parameters] Türbin sabit parametreleri işleniyor...');

  const paramDir = path.resolve(__dirname, '../Türbin parametreleri');
  if (!fs.existsSync(paramDir)) {
    console.error(`❌ [sync_parameters] Klasör bulunamadı: ${paramDir}`);
    return;
  }

  const files = fs.readdirSync(paramDir).filter(f => f.endsWith('_bes.csv'));
  console.log(`📁 [sync_parameters] ${files.length} adet BES CSV dosyası bulundu.`);

  const defs = {}; // paramId -> { desc, unit }
  const serials = {}; // serial -> { [paramId]: { val, raw, unit } }

  for (const file of files) {
    const serial = file.replace('_bes.csv', '').trim();
    const filePath = path.join(paramDir, file);
    const content = fs.readFileSync(filePath, 'latin1');
    const lines = content.split(/\r?\n/);

    serials[serial] = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      const parts = line.split(';');
      if (parts.length < 4) continue;

      let codeStr = parts[0].trim();
      if (codeStr.includes('\t')) {
        codeStr = codeStr.split('\t')[0].trim();
      }
      const paramId = String(parseInt(codeStr, 10));
      if (isNaN(paramId) || paramId === '0') continue;

      // English description is parts[2], fallback to parts[1]
      const descEn = parts[2] ? parts[2].trim() : (parts[1] ? parts[1].trim() : '');
      let rawVal = parts[3] ? parts[3].trim() : '';
      rawVal = rawVal.replace(/^[\u00B4\´]/, '').trim();
      const unit = parts[4] ? parts[4].trim() : '';

      // Extract normalized value for enum if present e.g. "(00) OFF" -> "0", "(01) ON" -> "1"
      let normVal = rawVal;
      const enumMatch = rawVal.match(/^\((\d+)\)/);
      if (enumMatch) {
        normVal = String(parseInt(enumMatch[1], 10));
      }

      if (!defs[paramId]) {
        defs[paramId] = {
          desc: descEn,
          unit: unit
        };
      } else if (!defs[paramId].desc && descEn) {
        defs[paramId].desc = descEn;
      }

      serials[serial][paramId] = {
        val: normVal,
        raw: rawVal,
        unit: unit
      };
    }
  }

  // Cross-reference with DataService to find missing turbines
  const dataServicePath = path.resolve(__dirname, '../src/services/DataService.ts');
  const dsContent = fs.readFileSync(dataServicePath, 'utf8');

  const siteNames = {
    '0752': 'Alize Germiyan',
    '2678': 'Mare Manastır',
    '2688': 'Anemon İntepe',
    '2990': 'Doğal Sayalar',
    '3213': 'Dares Datça',
    '3243': 'Alize Çamseki',
    '3245': 'Alize Keltepe',
    '3439': 'Alize Sarıkaya',
    '3793': 'Alize Kuyucak',
    '3892': 'Alize Çataltepe'
  };

  const missingTurbines = [];
  const existingSerialsSet = new Set(Object.keys(serials));

  for (const [siteId, sName] of Object.entries(siteNames)) {
    const sitePattern = new RegExp(`'${siteId}':\\s*\\[([\\s\\S]*?)\\]\\s*(?=,\\s*'[0-9]{4}'|\\s*};)`);
    const match = dsContent.match(sitePattern);
    if (!match) continue;

    const listStr = match[1];
    const tRegex = /{\s*no:\s*(\d+),\s*serial:\s*["'](\d+)["'](?:,\s*controlType:\s*["']([^"']*)["'])?(?:,\s*type:\s*["']([^"']*)["'])?/g;
    let tMatch;
    while ((tMatch = tRegex.exec(listStr)) !== null) {
      const no = parseInt(tMatch[1], 10);
      const serial = tMatch[2];
      const type = tMatch[4] || tMatch[3] || 'Bilinmiyor';

      if (!existingSerialsSet.has(serial)) {
        missingTurbines.push({
          siteId,
          siteName: sName,
          turbineNo: no,
          serial,
          type
        });
      }
    }
  }

  // Output paths
  const outDir = path.resolve(__dirname, '../src/data');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  const baselineOutPath = path.join(outDir, 'turbine_baseline_parameters.json');
  fs.writeFileSync(baselineOutPath, JSON.stringify({ defs, serials }), 'utf8');

  const missingOutPath = path.join(outDir, 'missing_turbine_parameters.json');
  fs.writeFileSync(missingOutPath, JSON.stringify(missingTurbines, null, 2), 'utf8');

  console.log(`✅ [sync_parameters] Tamamlandı!`);
  console.log(`   - Toplam ${Object.keys(serials).length} türbin sabit parametresi yazıldı: ${baselineOutPath}`);
  console.log(`   - Toplam ${missingTurbines.length} eksik türbin dosyası tespit edildi: ${missingOutPath}`);
}

if (require.main === module) {
  syncParameters();
}

module.exports = { syncParameters };
