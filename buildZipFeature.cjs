const fs = require('fs');

let code = fs.readFileSync('src/pages/ReportArchive.ts', 'utf8');

// 1. Add month/year selection UI and "Toplu PDF İndir (ZIP)" button
const uiTargetStr = `      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.25rem;">
            <i class="fa-solid fa-box-archive" style="color: var(--accent-blue);"></i> \${site?.name} Rapor Arşivi
          </h1>
          <p style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">TOPLAM \${visibleReports.length} RAPOR BULUNDU</p>
        </div>
        <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--glass-border);">
          <span style="font-size: 0.7rem; color: var(--text-muted);">SAHA ID:</span>
          <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan);">\${siteId}</span>
        </div>
      </div>`;

const uiReplacementStr = `      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.25rem;">
            <i class="fa-solid fa-box-archive" style="color: var(--accent-blue);"></i> \${site?.name} Rapor Arşivi
          </h1>
          <p style="color: var(--text-muted); font-size: 0.8rem; font-weight: 600;">TOPLAM \${visibleReports.length} RAPOR BULUNDU</p>
        </div>
        
        <div style="display: flex; gap: 1rem; align-items: center;">
            <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid var(--glass-border); display: flex; gap: 0.5rem; align-items: center;">
              <select id="archive-month" onchange="window.filterArchiveByMonth()" style="background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--glass-border); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; outline: none;">
                <option value="all">Tüm Aylar</option>
                <option value="0">Ocak</option>
                <option value="1">Şubat</option>
                <option value="2">Mart</option>
                <option value="3">Nisan</option>
                <option value="4">Mayıs</option>
                <option value="5">Haziran</option>
                <option value="6">Temmuz</option>
                <option value="7">Ağustos</option>
                <option value="8">Eylül</option>
                <option value="9">Ekim</option>
                <option value="10">Kasım</option>
                <option value="11">Aralık</option>
              </select>
              <select id="archive-year" onchange="window.filterArchiveByMonth()" style="background: rgba(0,0,0,0.5); color: #fff; border: 1px solid var(--glass-border); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; outline: none;">
                <option value="all">Tüm Yıllar</option>
                <option value="2024">2024</option>
                <option value="2025">2025</option>
                <option value="2026">2026</option>
                <option value="2027">2027</option>
              </select>
            </div>
            
            <button onclick="window.downloadSelectedAsZip('\${site?.name}', '\${siteId}')" class="cyber-button" style="background: rgba(0, 242, 254, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 8px 16px;">
              <i class="fa-solid fa-file-zipper"></i> SEÇİLENLERİ ZIP İNDİR
            </button>
            
            <div style="background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 10px; border: 1px solid var(--glass-border);">
              <span style="font-size: 0.7rem; color: var(--text-muted);">SAHA ID:</span>
              <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--accent-cyan);">\${siteId}</span>
            </div>
        </div>
      </div>`;

// 2. Table Header
const thTargetStr = `                <tr style="text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--glass-border);">
                  <th style="padding: 1rem;">TARİH</th>
                  <th style="padding: 1rem;">RAPOR NO</th>`;

const thReplacementStr = `                <tr style="text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--glass-border);">
                  <th style="padding: 1rem; width: 40px; text-align: center;"><input type="checkbox" id="archive-select-all" onchange="window.toggleAllArchiveCheckboxes(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-cyan);"></th>
                  <th style="padding: 1rem;">TARİH</th>
                  <th style="padding: 1rem;">RAPOR NO</th>`;

// 3. Table row Checkbox
const trTargetStr = `                  <tr class="archive-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.3s;">
                    <td style="padding: 1rem; color: var(--text-muted); font-weight: 600;">\${new Date(report.date).toLocaleDateString('tr-TR')}</td>`;

const trReplacementStr = `                  <tr class="archive-row" data-date="\${report.date}" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.3s;">
                    <td style="padding: 1rem; text-align: center;">
                        <input type="checkbox" class="archive-checkbox" value="\${report.reportNo}" data-type="\${report.templateName ? 'Bakim' : 'Ariza'}" data-turbin="\${report.turbineNo}" data-template="\${report.templateName || report.faultCode || 'Rapor'}" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-cyan);">
                    </td>
                    <td style="padding: 1rem; color: var(--text-muted); font-weight: 600;">\${new Date(report.date).toLocaleDateString('tr-TR')}</td>`;

// 4. İndirildi Badge
const badgeTargetStr = `                    <td style="padding: 1rem;">
                      <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan);">\${report.reportNo}</span>
                    </td>`;
const badgeReplacementStr = `                    <td style="padding: 1rem;">
                      <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan);">\${report.reportNo}</span>
                      \${report.isDownloaded ? \`<div style="margin-top: 4px;"><span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.65rem;"><i class="fa-solid fa-check-double"></i> İNDİRİLDİ</span></div>\` : ''}
                    </td>`;


// 5. ZIP Download Logic
const zipLogicStr = `
(window as any).toggleAllArchiveCheckboxes = (el: HTMLInputElement) => {
    const checkboxes = document.querySelectorAll('.archive-checkbox:not(:closest(.hidden))');
    checkboxes.forEach((cb: any) => cb.checked = el.checked);
};

(window as any).filterArchiveByMonth = () => {
    const month = document.getElementById('archive-month') as HTMLSelectElement;
    const year = document.getElementById('archive-year') as HTMLSelectElement;
    const mVal = month.value;
    const yVal = year.value;
    
    const rows = document.querySelectorAll('.archive-row');
    rows.forEach((row: any) => {
        const dateStr = row.getAttribute('data-date');
        if (!dateStr) return;
        const d = new Date(dateStr);
        let show = true;
        if (mVal !== 'all' && d.getMonth().toString() !== mVal) show = false;
        if (yVal !== 'all' && d.getFullYear().toString() !== yVal) show = false;
        
        if (show) row.classList.remove('hidden');
        else row.classList.add('hidden');
    });
};

(window as any).downloadSelectedAsZip = async (siteName: string, siteId: string) => {
    const checkboxes = document.querySelectorAll('.archive-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Lütfen indirilecek en az 1 rapor seçin.");
        return;
    }
    
    // Create Progress Modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:999999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);';
    modal.innerHTML = \`
        <div style="background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid var(--accent-cyan); width: 400px; max-width: 90vw; text-align: center; box-shadow: 0 0 30px rgba(0,242,254,0.2);">
            <i class="fa-solid fa-file-zipper fa-bounce" style="font-size: 3rem; color: var(--accent-cyan); margin-bottom: 1rem;"></i>
            <h3 style="margin-bottom: 1rem;">ZIP Arşivi Hazırlanıyor...</h3>
            <div style="width: 100%; background: rgba(0,0,0,0.5); border-radius: 8px; height: 16px; margin-bottom: 1rem; overflow: hidden;">
                <div id="zip-progress-bar" style="width: 0%; height: 100%; background: var(--accent-cyan); transition: width 0.3s;"></div>
            </div>
            <p id="zip-progress-text" style="color: var(--text-muted); font-size: 0.9rem;">0 / \${checkboxes.length} rapor işlendi</p>
            <p style="color: #ffcc00; font-size: 0.75rem; margin-top: 1rem;"><i class="fa-solid fa-triangle-exclamation"></i> Lütfen bu pencereyi kapatmayın veya sayfayı yenilemeyin.</p>
        </div>
    \`;
    document.body.appendChild(modal);
    
    try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        
        // Dynamically load JSZip and html2pdf
        if (!(window as any).html2pdf) {
            await new Promise((res, rej) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                script.onload = res; script.onerror = rej;
                document.head.appendChild(script);
            });
        }
        if (!(window as any).JSZip) {
            await new Promise((res, rej) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
                script.onload = res; script.onerror = rej;
                document.head.appendChild(script);
            });
        }
        if (!(window as any).saveAs) {
            await new Promise((res, rej) => {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/FileSaver.js/2.0.5/FileSaver.min.js';
                script.onload = res; script.onerror = rej;
                document.head.appendChild(script);
            });
        }

        const zip = new (window as any).JSZip();
        // Create root folder
        const cleanSiteName = siteName.replace(/[^a-zA-Z0-9]/g, '_');
        const rootFolder = zip.folder(cleanSiteName);
        const arizaFolder = rootFolder.folder('Ariza');
        const bakimFolder = rootFolder.folder('Bakim');
        
        let completed = 0;
        const downloadedIds: string[] = [];
        
        // Render helper
        const baseOpt = {
            margin: 10,
            image: { type: 'png', quality: 1 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 900, letterRendering: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        };

        for (let i = 0; i < checkboxes.length; i++) {
            const cb = checkboxes[i] as HTMLInputElement;
            const reportNo = cb.value;
            const type = cb.getAttribute('data-type'); // 'Bakim' or 'Ariza'
            const turbineNo = cb.getAttribute('data-turbin');
            const template = cb.getAttribute('data-template');
            
            const report = await serviceReportService.getReportByNo(reportNo);
            if (!report) continue;
            
            if (report.id) downloadedIds.push(report.id);
            
            const htmlStr = await renderReportPDF(report);
            
            // Create invisible DOM element for html2pdf
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position:fixed;left:-9999px;top:0;width:900px;background:#fff;z-index:-1;';
            wrapper.innerHTML = htmlStr;
            document.body.appendChild(wrapper);
            
            // Apply table fixes
            const resetStyle = document.createElement('style');
            resetStyle.textContent = \`
              #temp-pdf-wrapper table { display: table !important; width: 100% !important; white-space: normal !important; overflow: visible !important; max-width: none !important; table-layout: auto !important; }
              #temp-pdf-wrapper table thead { display: table-header-group !important; }
              #temp-pdf-wrapper table tbody { display: table-row-group !important; }
              #temp-pdf-wrapper table tr { display: table-row !important; }
              #temp-pdf-wrapper table th, #temp-pdf-wrapper table td { display: table-cell !important; white-space: normal !important; overflow: visible !important; max-width: none !important; text-overflow: clip !important; }
            \`;
            wrapper.id = 'temp-pdf-wrapper';
            wrapper.appendChild(resetStyle);
            
            // Get PDF as blob
            const pdfBlob = await (window as any).html2pdf().set(baseOpt).from(wrapper).output('blob');
            
            // Add to zip folder
            const safeTurbine = (turbineNo || 'Turbin').replace(/[^a-zA-Z0-9-]/g, '_');
            const safeTemplate = (template || 'Rapor').replace(/[^a-zA-Z0-9-]/g, '_').substring(0, 30);
            const fileName = \`\${safeTurbine}_\${safeTemplate}_\${reportNo}.pdf\`;
            
            if (type === 'Bakim') {
                bakimFolder.file(fileName, pdfBlob);
            } else {
                arizaFolder.file(fileName, pdfBlob);
            }
            
            // Clean up DOM
            document.body.removeChild(wrapper);
            
            completed++;
            document.getElementById('zip-progress-bar')!.style.width = \`\${(completed / checkboxes.length) * 100}%\`;
            document.getElementById('zip-progress-text')!.innerText = \`\${completed} / \${checkboxes.length} rapor işlendi\`;
        }
        
        // Generate Zip and trigger download
        document.getElementById('zip-progress-text')!.innerText = "ZIP dosyası oluşturuluyor, lütfen bekleyin...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        (window as any).saveAs(zipBlob, \`\${cleanSiteName}_Raporlar.zip\`);
        
        // Mark as downloaded in DB
        if (downloadedIds.length > 0) {
            await serviceReportService.markAsDownloaded(downloadedIds);
        }
        
        document.body.removeChild(modal);
        alert("Toplu arşivleme başarıyla tamamlandı!");
        // Refresh page
        (window as any).navigate('reports-archive', siteId);
        
    } catch (err: any) {
        console.error("ZIP Error", err);
        document.body.removeChild(modal);
        alert("Toplu indirme sırasında bir hata oluştu: " + err.message);
    }
};
`;

code = code.replace(uiTargetStr, uiReplacementStr);
code = code.replace(thTargetStr, thReplacementStr);
code = code.replace(trTargetStr, trReplacementStr);
code = code.replace(badgeTargetStr, badgeReplacementStr);

// Insert zip logic before export const ReportArchivePage...
const exportIndex = code.indexOf('export const ReportArchivePage');
code = code.substring(0, exportIndex) + zipLogicStr + '\n' + code.substring(exportIndex);

fs.writeFileSync('src/pages/ReportArchive.ts', code, 'utf8');
console.log('Successfully injected ZIP feature into ReportArchive.ts');
