const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const auditIdx = text.indexOf('audit_history`?', bpIdx);
console.log('auditIdx:', auditIdx);
if (auditIdx !== -1) {
    console.log(text.substring(auditIdx, auditIdx + 4000));
}
