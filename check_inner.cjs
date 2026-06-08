const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');
const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const sliceBefore = text.substring(bpIdx - 10000, bpIdx);
const innerIdx = sliceBefore.lastIndexOf('innerHTML=`');
console.log('innerIdx relative to slice:', innerIdx);
if (innerIdx !== -1) {
    console.log(sliceBefore.substring(innerIdx, innerIdx + 100));
}
