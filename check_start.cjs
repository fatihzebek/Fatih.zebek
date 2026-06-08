const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const sliceBefore = text.substring(bpIdx - 10000, bpIdx);
const r1 = sliceBefore.lastIndexOf('return `');
const r2 = sliceBefore.lastIndexOf('return`');
const r3 = sliceBefore.lastIndexOf('=`');
console.log('r1:', r1, 'r2:', r2, 'r3:', r3);
if (r3 !== -1) console.log(sliceBefore.substring(r3 - 50, r3 + 50));
