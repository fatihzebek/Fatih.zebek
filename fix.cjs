const fs = require('fs');
let t = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');
const openIdx = t.lastIndexOf('(window as any).openAddMaterialModal');
if (openIdx !== -1) {
    t = t.substring(0, openIdx);
}
let appendText = fs.readFileSync('append.txt', 'utf8');
t += appendText;
fs.writeFileSync('src/pages/Warehouses.ts', t);