const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const searchStr = '===`audit_history`';
const idx = text.indexOf(searchStr);
console.log('idx:', idx);
if (idx !== -1) {
    const endStr = text.indexOf('\`;', idx);
    console.log('endStr:', endStr);
    console.log(text.substring(endStr - 100, endStr + 100));
}
