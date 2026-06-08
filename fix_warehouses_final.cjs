const fs = require('fs');

// 1. Get the minified source
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

// 2. Extract the exact missing chunk
const startMissing = 4562153; // !t.lastAuditDate)return``
const endMissing = 4609042; // `};window.handleWarehouseSearch=
const missingChunk = text.substring(startMissing, endMissing);

// 3. Read the broken Warehouses.ts
const tsPath = 'C:/Users/FatihZebek/Desktop/Dh_Servis/src/pages/Warehouses.ts';
let tsContent = fs.readFileSync(tsPath, 'utf8');

// 4. Find where it's broken in Warehouses.ts
const breakPointStr = '${(()=>{if(!t.lastAuditDate)return`\n`;\n};\n\n(window as any).handleWarehouseFormSubmit = async (e: Event) => {';
// Wait, in my previous fix I added `};\n\n(window as any)...`
// Let's just find the exact string to replace!
// Actually, it's safer to use regex or substring
const searchStart = '${(()=>{if(!t.lastAuditDate)return`';
const idxStart = tsContent.indexOf(searchStart);

if (idxStart === -1) {
    console.log('Could not find the break point in Warehouses.ts!');
    process.exit(1);
}

const searchEnd = '(window as any).handleWarehouseFormSubmit = async (e: Event) => {';
const idxEnd = tsContent.indexOf(searchEnd);

if (idxEnd === -1) {
    console.log('Could not find handleWarehouseFormSubmit in Warehouses.ts!');
    process.exit(1);
}

// 5. Replace everything between idxStart and idxEnd with the missing chunk!
// Wait, missingChunk starts with `!t.lastAuditDate)return``;`
// And we are replacing from `${(()=>{if(!t.lastAuditDate)return\``
// So the replacement string should be `${(()=>{if(` + missingChunk + '\n\n';

const newContent = tsContent.substring(0, idxStart) + '${(()=>{if(' + missingChunk + '\n\n' + tsContent.substring(idxEnd);

fs.writeFileSync(tsPath, newContent);
console.log('Warehouses.ts FIXED!!');
