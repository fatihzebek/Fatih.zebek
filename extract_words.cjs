const fs = require('fs');
let t = fs.readFileSync('extracted_chunk_full.txt', 'utf8');

// Find all unique words containing \uFFFD
let matches = [...t.matchAll(/[\w\uFFFD!]+\uFFFD[\w\uFFFD!]*/g)];
let words = new Set();
for (let m of matches) {
    words.add(m[0]);
}

console.log(Array.from(words));
