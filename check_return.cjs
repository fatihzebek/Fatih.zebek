const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const sliceBefore = text.substring(bpIdx - 10000, bpIdx);
const returnIdx = sliceBefore.lastIndexOf('return`');
console.log('returnIdx relative to slice:', returnIdx);
if (returnIdx !== -1) {
    console.log(sliceBefore.substring(returnIdx, returnIdx + 100));
}
