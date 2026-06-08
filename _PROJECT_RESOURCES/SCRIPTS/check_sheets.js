import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:/Users/FatihZebek/Desktop/Dh_Servis/src/presentation/TUREK_Conference/Türbin Servis Bilgileri.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    console.log('Sheet Names:', workbook.SheetNames);
    
    workbook.SheetNames.forEach(name => {
        const sheet = workbook.Sheets[name];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`Sheet: ${name}, Rows: ${data.length}`);
    });
} catch (error) {
    console.error('Error reading excel:', error);
}
