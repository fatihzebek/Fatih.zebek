const fs = require('fs');
let t = fs.readFileSync('extracted_chunk_full.txt', 'utf8');

// Find all occurrences of \uFFFD and extract context
let matches = [...t.matchAll(/\uFFFD/g)];
let contexts = new Set();
for (let m of matches) {
    let idx = m.index;
    let context = t.substring(Math.max(0, idx - 10), Math.min(t.length, idx + 10));
    contexts.add(context.replace(/\n/g, '\\n'));
}

console.log(Array.from(contexts));
