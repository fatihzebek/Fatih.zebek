const fs = require('fs');
let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

// 1. Fix OHS Page break
code = code.replace(
    '<div style="page-break-before: always; break-before: page; height: 0; overflow: hidden;" class="html2pdf__page-break"></div>',
    ''
);
code = code.replace(
    '<table class="ohs-table-block" style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.78rem; margin-top: 5px; margin-bottom: 20px;">',
    '<table class="ohs-table-block" style="page-break-before: always; break-before: page; width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.9rem; margin-top: 5px; margin-bottom: 20px;">'
);

// 2. Fix Checklist Page break
code = code.replace(
    'checklistHtml += `<div style="page-break-before: always; break-before: page;" class="html2pdf__page-break"></div>`;',
    ''
);
code = code.replace(
    '<div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">',
    '<div style="page-break-before: always; break-before: page; text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">'
);

// 3. Increase Font Sizes Globally in the template for readability
code = code.replace(/font-size: 0\.75rem/g, 'font-size: 0.9rem');
code = code.replace(/font-size: 0\.78rem/g, 'font-size: 0.9rem');
code = code.replace(/font-size: 0\.8rem/g, 'font-size: 0.95rem');
code = code.replace(/font-size: 0\.85rem/g, 'font-size: 1rem');
code = code.replace(/font-size: 0\.7rem/g, 'font-size: 0.85rem');
code = code.replace(/font-size: 0\.65rem/g, 'font-size: 0.8rem');

fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
