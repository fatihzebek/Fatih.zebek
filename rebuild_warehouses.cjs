const fs = require('fs');

let ts = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');
let chunk = fs.readFileSync('extracted_chunk_fixed.txt', 'utf8');

// 1. Add missing variables before the return statement
let varsToInject = `
    const r = auditData;
    const v = integrityScore;
    const y = criticalItems;
`;
ts = ts.replace('    const e = selectedWarehouseId;\n\n    return `', '    const e = selectedWarehouseId;' + varsToInject + '\n    return `');

// 2. Find exact index
let startIdx = ts.indexOf('// MISSING LINE 300');
let endIdx = ts.indexOf('(window as any).openAddMaterialModal =', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let before = ts.substring(0, startIdx);
    let after = ts.substring(endIdx);
    
    // Stitch them together
    let newTs = before + chunk + '\n\n' + after;
    fs.writeFileSync('src/pages/Warehouses.ts', newTs);
    console.log('Successfully rebuilt Warehouses.ts! Length:', newTs.length);
} else {
    console.log('Failed to match indices!', startIdx, endIdx);
}
