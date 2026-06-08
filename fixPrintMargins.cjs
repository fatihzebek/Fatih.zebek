const fs = require('fs');
let code = fs.readFileSync('src/pages/ReportArchive.ts', 'utf8');

// Reduce print margins from 10mm to 5mm to give more horizontal space
code = code.replace(
    '@page { size: A4 portrait; margin: 10mm; }',
    '@page { size: A4 portrait; margin: 5mm; }'
);

fs.writeFileSync('src/pages/ReportArchive.ts', code, 'utf8');
