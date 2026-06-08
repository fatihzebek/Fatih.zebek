const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const endIdx = text.indexOf('</div></div></div>\`;', bpIdx);
console.log('endIdx:', endIdx);
