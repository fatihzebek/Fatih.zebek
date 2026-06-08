const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const searchStr = '!t.lastAuditDate)return``';
const searchStr2 = '!t.lastAuditDate)return`';
let idx = text.indexOf(searchStr);
if (idx === -1) idx = text.indexOf(searchStr2);

console.log('idx:', idx);
if (idx !== -1) {
    const endStr = text.indexOf('</div></div></div>`;', idx);
    console.log('endStr:', endStr);
    if (endStr !== -1) {
        console.log(text.substring(idx, endStr + 20));
        // Write the rest to a file so we can see it
        fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/rest_of_html.txt', text.substring(idx, endStr + 20));
        console.log('Wrote rest_of_html.txt');
    } else {
        console.log(text.substring(idx, idx + 2000));
    }
}
