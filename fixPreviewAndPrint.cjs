const fs = require('fs');

let code = fs.readFileSync('src/pages/ReportArchive.ts', 'utf8');

// 1. Update Modal CSS to make the preview huge and elegant
const styleToInject = `
      <style>
        .archive-row:hover {
          background: rgba(255, 255, 255, 0.05) !important;
        }
        .hidden { display: none !important; }
        .cyber-button { border-radius: 4px; font-weight: 600; transition: all 0.2s; }
        .cyber-button:hover { opacity: 0.8; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        /* Premium Full-Screen Preview Styles */
        #report-modal-content {
          padding: 2rem !important;
        }
        #report-modal-content #pdf-container {
          max-width: 100% !important;
          width: 100% !important;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4) !important;
          padding: 40px 60px !important;
          transform-origin: top center;
          /* Scale up fonts for readability on wide screens */
          font-size: 1.1rem !important;
        }
        
        /* Increase table readability in preview */
        #report-modal-content #pdf-container table {
          font-size: 1rem !important;
        }
        #report-modal-content #pdf-container h1 {
          font-size: 2rem !important;
        }
        #report-modal-content #pdf-container td, 
        #report-modal-content #pdf-container th {
          padding: 10px 14px !important;
        }
        
        @media print {
`;

code = code.replace(/<style>\s*\.archive-row:hover[\s\S]*?@media print \{/, styleToInject);


// 2. Rewrite downloadReportPDF to use native window.print() for flawless PDFs
const nativePrintFunc = `(window as any).downloadReportPDF = async (event: Event) => {
    const reportNo = document.getElementById('preview-report-no')?.innerText;
    if (!reportNo) {
        alert("Rapor numaras bulunamad!");
        return;
    }
    
    const btn = event.currentTarget as HTMLButtonElement;
    const originalHtml = btn.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HAZIRLANIYOR...';
        btn.disabled = true;
    }
  
    try {
        const report = await (window as any).serviceReportService.getReportByNo(reportNo);
        if (report) {
            const { renderReportPDF } = await import('../components/ReportTemplate');
            const htmlContent = renderReportPDF(report);
            
            const printWindow = window.open('', '_blank');
            if (printWindow) {
                printWindow.document.write(\`
                    <!DOCTYPE html>
                    <html>
                        <head>
                            <title>\${report.reportNo} - Servis Raporu</title>
                            <style>
                                @page { size: A4 portrait; margin: 10mm; }
                                body { margin: 0; padding: 0; background: white; font-family: Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                                table { page-break-inside: auto; width: 100%; border-collapse: collapse; }
                                tr { page-break-inside: avoid; break-inside: avoid; page-break-after: auto; }
                                thead { display: table-header-group; }
                                tfoot { display: table-footer-group; }
                                .pdf-no-break { page-break-inside: avoid; break-inside: avoid; }
                            </style>
                        </head>
                        <body>
                            \${htmlContent}
                            <script>
                                window.onload = () => {
                                    setTimeout(() => {
                                        window.print();
                                    }, 500);
                                };
                            </script>
                        </body>
                    </html>
                \`);
                printWindow.document.close();
            }
        }
    } catch (err) {
        console.error("PDF Download error", err);
        alert("PDF indirilirken bir hata olutu.");
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};`;

code = code.replace(/\(window as any\)\.downloadReportPDF = async \(event: Event\) => \{[\s\S]*?btn\.disabled = false;\s*\}\s*\};\s*/, nativePrintFunc + '\n\n');

fs.writeFileSync('src/pages/ReportArchive.ts', code, 'utf8');
