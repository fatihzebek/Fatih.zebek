const fs = require('fs');
let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

// 1. Add page break before OHS
code = code.replace(
    '<div style="height:0; overflow:hidden;" class="html2pdf__page-break"></div>',
    '<div style="page-break-before: always; break-before: page; height: 0; overflow: hidden;" class="html2pdf__page-break"></div>'
);

// 2. Add page break before Checklist
code = code.replace(
    /checklistHtml \+= `\s*<div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">/,
    'checklistHtml += `<div style="page-break-before: always; break-before: page;" class="html2pdf__page-break"></div>`;\n      checklistHtml += `\n        <div style="text-align: center; margin-bottom: 8px; border-bottom: 2px solid #000; padding-bottom: 8px;">'
);

// 3. Make PDF container wider for preview
// We already did this in ReportArchive.ts using CSS for the preview! But to reduce margins in print:
// In ReportArchive.ts we set @page { margin: 10mm }. We can change it to 5mm if the user wants "sayfaya sigdirabiliriz".
// But let's check if there's any hardcoded padding in ReportTemplate.ts that restricts width in print.
// In ReportTemplate.ts: id="pdf-container" style="padding: 30px 40px;"
code = code.replace(
    'padding: 30px 40px; width: 100%; max-width: 900px;',
    'padding: 10px 20px; width: 100%; max-width: 1000px;'
);

fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
