const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');

let currentIndex = bpIdx;
let ends = [];
while (true) {
    let nextIdx = text.indexOf('\`;', currentIndex);
    if (nextIdx === -1 || nextIdx > bpIdx + 100000) break;
    ends.push(nextIdx);
    currentIndex = nextIdx + 2;
}

// Print the last 10 occurrences
const last10 = ends.slice(-10);
for (const idx of last10) {
    console.log('--- Found \`; at', idx, '---');
    console.log(text.substring(idx - 60, idx + 60));
}
