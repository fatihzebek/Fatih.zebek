const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const logModalIdx = text.indexOf('id="log-detail-modal"', bpIdx);
console.log('logModalIdx:', logModalIdx);
if (logModalIdx !== -1) {
    const endIdx = text.indexOf('\`;', logModalIdx);
    console.log('endIdx:', endIdx);
    console.log(text.substring(endIdx - 50, endIdx + 50));
}
