const fs = require('fs');
let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

code = code.replace(
    'max-width: 1000px;',
    'max-width: none;'
);

fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
