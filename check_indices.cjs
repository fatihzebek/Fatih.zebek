const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/extracted_html2.txt', 'utf8');

const bp = '<input type="text" id="modal-description"';
const bpIdx = text.indexOf(bp);
const endIdx = text.indexOf('window.closeAddMaterialModal');

console.log('bpIdx:', bpIdx, 'endIdx:', endIdx);
