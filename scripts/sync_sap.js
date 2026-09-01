import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

async function main() {
  try {
    const excelFileName = 'sap_list.xlsx';
    console.log(`Reading master Excel file: ${excelFileName}...`);
    
    if (!fs.existsSync(excelFileName)) {
      console.error(`\n[HATA] Ana dizinde "${excelFileName}" dosyası bulunamadı!`);
      console.error(`Lütfen güncellediğiniz Excel dosyasını "${path.resolve(excelFileName)}" konumuna kaydedip komutu tekrar çalıştırın.\n`);
      process.exit(1);
    }

    const workbook = XLSX.readFile(excelFileName);
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    console.log(`Loading sheet: "${firstSheetName}"...`);
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    console.log(`Total rows read from Excel: ${rows.length}`);

    const materialsArray = [];
    const sapDictionary = {};

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;

      const rawSap = row[0];
      const rawDesc = row[1];

      if (rawSap === undefined || rawSap === null || rawSap === '') continue;
      
      const sapStr = String(rawSap).trim();
      // Skip header row if repeated
      if (sapStr.toLowerCase() === 'sap-nr.' || sapStr.toLowerCase() === 'sap no') continue;

      const descStr = rawDesc ? String(rawDesc).trim() : 'Bilinmeyen Malzeme';

      materialsArray.push({ n: sapStr, d: descStr });
      sapDictionary[sapStr] = descStr;
    }

    console.log(`Processed ${materialsArray.length} valid SAP materials.`);

    // Write to src/data/materials.json
    const materialsPath = path.join('src', 'data', 'materials.json');
    fs.writeFileSync(materialsPath, JSON.stringify(materialsArray), 'utf8');
    console.log(`Successfully updated: ${materialsPath}`);

    // Write to public/sap_dictionary.json
    const dictPath = path.join('public', 'sap_dictionary.json');
    fs.writeFileSync(dictPath, JSON.stringify(sapDictionary, null, 2), 'utf8');
    console.log(`Successfully updated: ${dictPath}`);

    console.log('\n[BAŞARILI] Tüm SAP malzeme listeleri başarıyla güncellendi! Uygulamanızı yenileyip kullanabilirsiniz.\n');
  } catch (error) {
    console.error('Senkronizasyon sırasında bir hata oluştu:', error);
  }
}

main();
