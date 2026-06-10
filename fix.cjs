const fs = require('fs');
let code = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');
code = code.replace(/\\'/g, "'").replace(/\\`/g, "`");
fs.writeFileSync('src/pages/Warehouses.ts', code);
console.log('Fixed escape characters in TS file.');