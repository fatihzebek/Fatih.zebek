const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const auditIdx = text.indexOf('audit_history', bpIdx);
if (auditIdx !== -1) {
    const endIdx = text.indexOf('\`;', auditIdx);
    console.log('endIdx:', endIdx);
    console.log(text.substring(endIdx - 50, endIdx + 50));
}
