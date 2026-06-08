const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const tableSearch = '<table class="premium-table"';
let idx = text.indexOf(tableSearch);
console.log('first premium-table:', idx);
if (idx !== -1) {
    let nextIdx = text.indexOf(tableSearch, idx + 1);
    console.log('second premium-table:', nextIdx);
}
