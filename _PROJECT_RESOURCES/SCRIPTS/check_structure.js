import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:/Users/FatihZebek/Desktop/Dh_Servis/src/presentation/TUREK_Conference/Türbin Servis Bilgileri.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Print first 50 rows to see the structure
    console.log(JSON.stringify(data.slice(0, 50), null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}
