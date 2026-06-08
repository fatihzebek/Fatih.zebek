const fs = require('fs');
const mapData = JSON.parse(fs.readFileSync('source_map.json', 'utf8'));

let targetSource = null;
let targetIndex = -1;

for (let i = 0; i < mapData.sources.length; i++) {
    if (mapData.sources[i].includes('Warehouses.ts')) {
        targetSource = mapData.sources[i];
        targetIndex = i;
        break;
    }
}

if (targetIndex !== -1) {
    const originalContent = mapData.sourcesContent[targetIndex];
    fs.writeFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\src\\\\pages\\\\Warehouses.ts', originalContent);
    console.log('Successfully recovered Warehouses.ts! Length:', originalContent.length);
} else {
    console.log('Warehouses.ts not found in source map.');
    console.log('Available sources:', mapData.sources.filter(s => s.includes('ts')));
}
