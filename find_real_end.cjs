const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const searchStr = '};window.handleWarehouseSearch=';
const searchStr2 = '`};window.handleWarehouseSearch=';

let idx = text.indexOf(searchStr);
console.log('idx:', idx);

let idx2 = text.indexOf(searchStr2);
console.log('idx2:', idx2);

if (idx2 !== -1) {
    console.log(text.substring(idx2 - 100, idx2 + 100));
}
