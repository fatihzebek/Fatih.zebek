const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const slice = text.substring(bpIdx, bpIdx + 150000);

const findClosingStr = slice.lastIndexOf('\`');
console.log('length:', slice.length);
console.log('Last backtick at:', findClosingStr);
if (findClosingStr !== -1) {
    console.log(slice.substring(findClosingStr - 50, findClosingStr + 50));
}
