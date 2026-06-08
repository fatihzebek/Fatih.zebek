const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

let currentIndex = 4562153;
let ends = [];
while (true) {
    let nextIdx = text.indexOf('\`;', currentIndex);
    if (nextIdx === -1 || nextIdx > 4610000) break;
    ends.push(nextIdx);
    currentIndex = nextIdx + 2;
}

for (const idx of ends) {
    console.log('--- Found \`; at', idx, '---');
    console.log(text.substring(idx - 60, idx + 60));
}
