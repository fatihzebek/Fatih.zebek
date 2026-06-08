const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/pure_html_detail.txt', 'utf8');

const searchStr = 'AÇIKLAMA / ÜRÜN ADI';
const idx = text.indexOf(searchStr);

// Find the start of the string literal
let startIdx = text.lastIndexOf('\`', idx);
let endIdx = text.indexOf('\`', idx);

if (startIdx !== -1 && endIdx !== -1) {
    const extract = text.substring(startIdx + 1, endIdx);
    fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/isolated_html.txt', extract);
    console.log('Isolated.');
} else {
    console.log('Not found');
}
