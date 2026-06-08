const fs = require('fs');
let code = fs.readFileSync('src/pages/ReportArchive.ts', 'utf8');

// 1. Update ZIP pagebreak config
code = code.replace(
  "pagebreak: { mode: ['css', 'legacy'] }",
  "pagebreak: { mode: ['css', 'legacy'], before: '.html2pdf__page-break', avoid: ['tr', '.pdf-no-break'] }"
);

// 2. Remove resetStyle from ZIP logic
code = code.replace(/const resetStyle = document\.createElement\('style'\);[\s\S]*?wrapper\.appendChild\(resetStyle\);/, '');

// 3. Remove resetStyle from single PDF logic
code = code.replace(/const resetStyle = document\.createElement\('style'\);[\s\S]*?wrapper\.appendChild\(resetStyle\);/, '');

fs.writeFileSync('src/pages/ReportArchive.ts', code, 'utf8');
