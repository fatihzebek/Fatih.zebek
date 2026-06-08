const fs = require('fs');
let t = fs.readFileSync('dist/assets/index-CRn0G-Xo.js', 'utf8');
console.log('padding:', t.indexOf('padding: 10px 15px;'));
console.log('lastAuditDate:', t.indexOf('${(()=>{if(!n.lastAuditDate)'));
