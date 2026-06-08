const fs = require('fs');
let t = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');
let lines = t.split('\n');
let chunk = lines.slice(300, 1646).join('\n');
let backticks = chunk.match(/`/g);
console.log('Backticks:', backticks ? backticks.length : 0);
let last = chunk.lastIndexOf('`');
if (last !== -1) {
    console.log(chunk.substring(Math.max(0, last - 50), last + 50));
}
