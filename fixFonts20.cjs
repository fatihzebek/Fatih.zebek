const fs = require('fs');
let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

// Replace exactly these values to increase them by roughly 20%
const fontMap = {
    '0.6rem': '0.75rem',
    '0.8rem': '0.96rem',
    '0.82rem': '0.98rem',
    '0.85rem': '1.02rem',
    '0.9rem': '1.08rem',
    '0.95rem': '1.14rem',
    '1rem': '1.2rem',
    '1.1rem': '1.32rem',
    '1.3rem': '1.56rem'
};

for (const [oldVal, newVal] of Object.entries(fontMap)) {
    const regex = new RegExp(`font-size:\\s*${oldVal.replace('.', '\\.')}`, 'g');
    code = code.replace(regex, `font-size: ${newVal}`);
}

fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
