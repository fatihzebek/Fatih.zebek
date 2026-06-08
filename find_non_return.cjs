const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');

let currentIndex = bpIdx;
while (true) {
    let nextIdx = text.indexOf('\`;', currentIndex);
    if (nextIdx === -1 || nextIdx > bpIdx + 50000) break;
    
    const prevText = text.substring(nextIdx - 10, nextIdx);
    if (!prevText.includes('return')) {
        console.log('Found non-return \`; at:', nextIdx);
        console.log(text.substring(nextIdx - 40, nextIdx + 40).replace(/\n/g, '\\n'));
    }
    currentIndex = nextIdx + 2;
}
