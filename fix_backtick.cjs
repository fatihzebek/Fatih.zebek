const fs = require('fs');

let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const startMissing = 4562153; 
const endMissing = 4609042; 
const missingChunk = text.substring(startMissing, endMissing);

const tsPath = 'C:/Users/FatihZebek/Desktop/Dh_Servis/src/pages/Warehouses.ts';
let tsContent = fs.readFileSync(tsPath, 'utf8');

const searchStart = '${(()=>{if(!t.lastAuditDate)return`';
const idxStart = tsContent.indexOf(searchStart);

const searchEnd = '(window as any).handleWarehouseFormSubmit = async (e: Event) => {';
const idxEnd = tsContent.indexOf(searchEnd);

const newContent = tsContent.substring(0, idxStart) + '${(()=>{if(' + missingChunk + '`;\n};\n\n' + tsContent.substring(idxEnd);

fs.writeFileSync(tsPath, newContent);
console.log('Fixed with closing backtick!');
