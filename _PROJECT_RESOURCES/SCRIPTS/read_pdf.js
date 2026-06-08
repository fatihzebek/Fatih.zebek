import fs from 'fs';
import pdf from 'pdf-parse';

let dataBuffer = fs.readFileSync('2026-04-27_T09_821058.pdf');

pdf(dataBuffer).then(function(data) {
    console.log(data.text);
}).catch(err => console.error(err));
