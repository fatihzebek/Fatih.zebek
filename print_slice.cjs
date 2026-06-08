const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/extracted_html2.txt', 'utf8');

const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const slice = text.substring(bpIdx, bpIdx + 500);

console.log(slice);
