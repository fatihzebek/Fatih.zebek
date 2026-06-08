const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/pure_html_detail.txt', 'utf8');

const searchStr = 'AÇIKLAMA / ÜRÜN ADI';
const idx = text.indexOf(searchStr);

// Find the closest `<style>` backwards
let startIdx = text.lastIndexOf('<style>', idx);

// Find the start of the Javascript functions forwards.
// The Javascript functions usually start with `const payload` or `window.` or `}catch` or something.
// But we can just find the end of the HTML by looking for the last `</div>` before we see `window.closeAddMaterialModal=` or similar.
let endIdx = text.indexOf('const payload:', idx);
if (endIdx === -1) endIdx = text.indexOf('window.closeAddMaterialModal', idx);
if (endIdx === -1) endIdx = text.indexOf('const y=', idx);
if (endIdx === -1) endIdx = text.indexOf('function(', idx);

// Just grab up to the first script-like token
let htmlEnd = text.lastIndexOf('</div>', endIdx !== -1 ? endIdx : text.length);

if (startIdx !== -1) {
    const extract = text.substring(startIdx, htmlEnd + 6);
    fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/isolated_html.txt', extract);
    console.log('Isolated.');
} else {
    console.log('Not found');
}
