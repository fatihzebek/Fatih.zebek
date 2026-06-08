const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const searchStr = 'AÇIKLAMA / ÜRÜN ADI';
const idx = text.indexOf(searchStr);

if (idx !== -1) {
    const extract = text.substring(Math.max(0, idx - 8000), Math.min(text.length, idx + 150000));
    fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/pure_html_detail.txt', extract);
    console.log('Detail HTML extracted.');
} else {
    console.log('Not found');
}
