import XLSX from 'xlsx';
import fs from 'fs';

const filePath = 'c:/Users/FatihZebek/Desktop/Dh_Servis/src/presentation/TUREK_Conference/Türbin Servis Bilgileri.xlsx';

try {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheet = workbook.Sheets['DE_Türbin Bilgileri'];
    const data = XLSX.utils.sheet_to_json(sheet);

    const stats = {
        models: {},
        wpp_models: {},
        total_kw: 0,
        total_wec: 0
    };

    data.slice(1).forEach(row => {
        const model = row['__EMPTY_4'];
        const kw = parseFloat(row['__EMPTY_5']) || 0;
        const wpp = row['__EMPTY'];

        if (model && model !== 'WEC type') {
            stats.models[model] = (stats.models[model] || 0) + 1;
            stats.total_kw += kw;
            stats.total_wec += 1;

            if (wpp) {
                if (!stats.wpp_models[wpp]) stats.wpp_models[wpp] = new Set();
                stats.wpp_models[wpp].add(model);
            }
        }
    });

    // Convert sets to arrays for JSON
    for (const wpp in stats.wpp_models) {
        stats.wpp_models[wpp] = Array.from(stats.wpp_models[wpp]);
    }

    console.log(JSON.stringify(stats, null, 2));
} catch (error) {
    console.error('Error processing data:', error);
}
