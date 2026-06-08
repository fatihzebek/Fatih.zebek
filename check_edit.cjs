const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const searchStr = 'catch(e){console.error(`[EditMaterial] Error:`';
const idx = text.indexOf(searchStr);
console.log('idx:', idx);
if (idx !== -1) {
    console.log(text.substring(idx - 100, idx + 100));
}
