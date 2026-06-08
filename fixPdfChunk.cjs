const fs = require('fs');

let code = fs.readFileSync('src/components/ReportTemplate.ts', 'utf8');

const targetStr = `    checklist.forEach((item, i) => {
      checklistHtml += renderRow(item, i);
    });`;

const replacement = `    checklist.forEach((item, i) => {
      // Her 33 maddede bir tabloyu kapatıp yeni sayfada tabloyu devam ettir
      if (i > 0 && i % 33 === 0) {
        checklistHtml += '</table></div>';
        checklistHtml += '<div class="html2pdf__page-break"></div>';
        checklistHtml += '<div style="padding-top: 15px; margin-bottom: 8px;">';
        checklistHtml += '<div style="background: #e8ecf1; padding: 4px 12px; font-weight: 800; font-size: 0.8rem; border: 1px solid #bbb; border-bottom: none;">BAKIM DENETİM LİSTESİ (DEVAMI)</div>';
        checklistHtml += '<table style="width: 100%; border-collapse: collapse; border: 1px solid #bbb; font-size: 0.75rem;">';
        checklistHtml += '<tr style="background: #f5f7fa;">';
        checklistHtml += '<th style="border: 1px solid #bbb; padding: 4px; width: 30px; font-weight: 700; text-align: center;">NO</th>';
        checklistHtml += '<th style="border: 1px solid #bbb; padding: 4px; text-align: left; font-weight: 700;">KONTROL MADDESİ</th>';
        checklistHtml += '<th style="border: 1px solid #bbb; padding: 4px; width: 110px; font-weight: 700; text-align: center;">DURUM</th>';
        checklistHtml += '<th style="border: 1px solid #bbb; padding: 4px; width: 180px; font-weight: 700; text-align: left;">AÇIKLAMA</th>';
        checklistHtml += '</tr>';
      }
      checklistHtml += renderRow(item, i);
    });`;

if (code.includes(targetStr)) {
    code = code.replace(targetStr, replacement);
    fs.writeFileSync('src/components/ReportTemplate.ts', code, 'utf8');
    console.log('Fixed ReportTemplate chunking');
} else {
    console.error('Target string not found in ReportTemplate.ts!');
}
