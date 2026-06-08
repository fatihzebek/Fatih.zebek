const fs = require('fs');
let t = fs.readFileSync('dist/assets/index-CRn0G-Xo.js', 'utf8');

// Find the start of WarehousePage logic
let startIdx = t.indexOf('window.invalidateWarehouseCache');
if (startIdx === -1) startIdx = t.indexOf('window.updateWarehouseUI');
if (startIdx === -1) startIdx = t.indexOf('var vy=async(');

let endIdx = t.indexOf('window.openAddMaterialModal=', startIdx);
if (endIdx === -1) endIdx = t.indexOf('window.editMaterial=', startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    let chunk = t.substring(startIdx, endIdx);
    fs.writeFileSync('C:\\\\Users\\\\FatihZebek\\\\Desktop\\\\Dh_Servis\\\\minified_warehouse.js', chunk);
    console.log('Extracted minified warehouse chunk! Length:', chunk.length);
} else {
    console.log('Could not find boundaries.', startIdx, endIdx);
}
