const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const tableIdx = text.indexOf('<table', bpIdx);
console.log('tableIdx:', tableIdx);
const endTableIdx = text.indexOf('</table>', tableIdx);
console.log('endTableIdx:', endTableIdx);

const searchAfterTable = text.substring(endTableIdx, endTableIdx + 5000);
console.log('after table:');
console.log(searchAfterTable);
