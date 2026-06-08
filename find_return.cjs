const fs = require('fs');
let t = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');
let idx = t.indexOf('return `');
console.log('Found:', idx !== -1);
if (idx !== -1) console.log(t.substring(idx, idx + 300));
