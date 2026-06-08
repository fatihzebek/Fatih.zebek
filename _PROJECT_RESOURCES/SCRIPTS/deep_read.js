import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:/Users/FatihZebek/Desktop/Dh_Servis/src/presentation/TUREK_Conference/Türbin Servis Bilgileri.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    // Filter and map all rows
    const cleanedData = data.slice(3).map(row => ({
        Customer: row[0],
        WPP: row[1],
        SerialNo: row[2],
        ServiceEndDate: row[3],
        PowerKW: row[4],
        WEC_Count: row[5]
    })).filter(item => item.WPP);

    console.log(JSON.stringify(cleanedData, null, 2));
} catch (error) {
    console.error('Error reading excel:', error);
}
