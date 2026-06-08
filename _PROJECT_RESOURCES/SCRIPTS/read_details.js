import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:/Users/FatihZebek/Desktop/Dh_Servis/src/presentation/TUREK_Conference/Türbin Servis Bilgileri.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets['DE_Türbin Bilgileri'];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Print first 20 rows of the detailed data
    console.log(JSON.stringify(data.slice(0, 20), null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}
