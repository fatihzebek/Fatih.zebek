const fs = require('fs');
let t = fs.readFileSync('dist/assets/index-CRn0G-Xo.js', 'utf8');

// The start of the missing block in reconstructed_Warehouses.ts
let searchStart = 'padding: 10px 15px;';
let startIdx = t.indexOf(searchStart);

// The end of the UI and minified JS, right before the manual functions
let searchEnd = 'window.openAddMaterialModal=';
let endIdx = t.indexOf(searchEnd, startIdx);

if (startIdx !== -1 && endIdx !== -1) {
    // We want the chunk starting from AFTER `padding: 10px 15px;`
    // In Warehouses.ts, `padding: 10px 15px;` is present, followed by `// MISSING LINE`
    let chunk = t.substring(startIdx + searchStart.length, endIdx);
    
    fs.writeFileSync('extracted_chunk_full.txt', chunk);
    console.log('Extracted successfully. Length:', chunk.length);
} else {
    console.log('Could not find boundaries.', startIdx, endIdx);
}
