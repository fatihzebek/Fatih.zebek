const fs = require('fs');
let text = fs.readFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/dist/assets/index-BkZhrJKe.js', 'utf8');

const bpIdx = text.indexOf('<input type="text" id="modal-description"');
const slice = text.substring(bpIdx, bpIdx + 40000);

fs.writeFileSync('C:/Users/FatihZebek/Desktop/Dh_Servis/chunk.txt', slice);
console.log('Chunk written!');
