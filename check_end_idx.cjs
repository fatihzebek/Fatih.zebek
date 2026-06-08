const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const endIdx = text.indexOf('window.handleInventorySearch=', bpIdx);
console.log('bpIdx:', bpIdx);
console.log('endIdx:', endIdx);
if (endIdx !== -1) {
    console.log(text.substring(endIdx - 10, endIdx + 20));
}
