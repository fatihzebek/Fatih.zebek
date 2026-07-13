import { serviceReportService } from '../services/ServiceReportService';
import { dataService } from '../services/DataService';
import { formatTeamName, formatDisplayName } from '../utils/formatters';
import { renderReportPDF } from '../components/ReportTemplate';

const getReportBadge = (report: any) => {
    const name = (report.templateName || report.faultCode || '').toLowerCase();
    const type = (report.type || '').toUpperCase();
    
    // Check if it is a maintenance report
    const isBakim = type === 'BAKIM' || name.includes('bakım') || name.includes('bakim') || name.includes('yağ') || name.includes('temizlik') || name.includes('kontrol') || name.includes('t44') || name.includes('t13');
    
    let color = '#ef4444'; // Crimson red for faults / duruşlar
    let bg = 'rgba(239, 68, 68, 0.1)';
    let border = 'rgba(239, 68, 68, 0.25)';
    let icon = 'fa-solid fa-circle-exclamation';
    let badgeText = 'ARIZA FORMU';
    
    if (isBakim) {
        color = '#10b981'; // Emerald green for maintenance
        bg = 'rgba(16, 185, 129, 0.1)';
        border = 'rgba(16, 185, 129, 0.25)';
        icon = 'fa-solid fa-screwdriver-wrench';
        badgeText = report.templateName || 'BAKIM RAPORU';
    }
    
    return `
      <span class="report-badge" style="background: ${bg}; color: ${color}; border: 1px solid ${border}; display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 0.7rem; width: 220px; text-transform: uppercase;">
        <i class="${icon}" style="font-size: 0.75rem;"></i> ${badgeText}
      </span>
    `;
};


(window as any).toggleAllArchiveCheckboxes = (el: HTMLInputElement) => {
    const checkboxes = document.querySelectorAll('.archive-checkbox');
    checkboxes.forEach((cb: any) => cb.checked = el.checked);
};

(window as any).archiveCurrentPage = 1;
const archiveItemsPerPage = 50;

(window as any).changeArchivePage = (page: number) => {
    (window as any).archiveCurrentPage = page;
    (window as any).renderArchiveTable();
};

(window as any).filterArchiveByMonth = () => {
    (window as any).archiveCurrentPage = 1;
    (window as any).renderArchiveTable();
};

(window as any).filterArchiveByTurbine = (turbineId: string) => {
    (window as any).selectedArchiveTurbine = turbineId;
    (window as any).archiveCurrentPage = 1;
    const buttons = document.querySelectorAll('.cyber-tab-btn');
    buttons.forEach((btn: any) => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[onclick="window.filterArchiveByTurbine('${turbineId}')"]`);
    if (activeBtn) activeBtn.classList.add('active');
    if ((window as any).renderArchiveTable) {
        (window as any).renderArchiveTable();
    }
};

(window as any).renderArchiveTable = () => {
    const tbody = document.getElementById('archive-tbody');
    if (!tbody) return;

    const monthSelect = document.getElementById('archive-month') as HTMLSelectElement;
    const yearSelect = document.getElementById('archive-year') as HTMLSelectElement;
    const searchInput = document.getElementById('archive-search-input') as HTMLInputElement;

    const mVal = monthSelect ? monthSelect.value : 'all';
    const yVal = yearSelect ? yearSelect.value : 'all';
    const searchVal = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // Handle pagination reset when search query changes
    if (searchVal !== ((window as any).lastArchiveSearchVal || '')) {
        (window as any).lastArchiveSearchVal = searchVal;
        (window as any).archiveCurrentPage = 1;
    }

    const reports = (window as any).archiveReports || [];
    const activeTurbine = (window as any).selectedArchiveTurbine || 'all';
    const siteId = (window as any).archiveSiteId;
    const turbinesOfSite = dataService.getTurbinesBySite(siteId) || [];

    const filtered = reports.filter((report: any) => {
        if (activeTurbine !== 'all') {
            const selectedTurbine = turbinesOfSite.find(t => t.id === activeTurbine);
            if (selectedTurbine) {
                const targetName = selectedTurbine.no > 0 ? `T-${selectedTurbine.no}` : (selectedTurbine.label || selectedTurbine.id);
                const rName = report.turbineNo || '';
                const matchesTurbine = rName === targetName || rName.replace('T-', '') === targetName.replace('T-', '') || report.turbineSerial === activeTurbine;
                if (!matchesTurbine) return false;
            }
        }

        if (searchVal) {
            const reportNo = (report.reportNo || '').toLowerCase();
            const faultCode = (report.faultCode || '').toLowerCase();
            const faultDesc = (report.faultDesc || '').toLowerCase();
            const turbineNo = (report.turbineNo || '').toLowerCase();
            const turbineSerial = (report.turbineSerial || '').toLowerCase();
            const templateName = (report.templateName || '').toLowerCase();
            const teamName = (report.team || '').toLowerCase();

            const matches = 
                reportNo.includes(searchVal) ||
                faultCode.includes(searchVal) ||
                faultDesc.includes(searchVal) ||
                turbineNo.includes(searchVal) ||
                turbineSerial.includes(searchVal) ||
                templateName.includes(searchVal) ||
                teamName.includes(searchVal);

            if (!matches) return false;
        }

        if (!report.date) return true;
        const d = new Date(report.date);
        if (mVal !== 'all' && d.getMonth().toString() !== mVal) return false;
        if (yVal !== 'all' && d.getFullYear().toString() !== yVal) return false;
        return true;
    });

    // Sort by date descending
    filtered.sort((a: any, b: any) => {
       const dateA = new Date(a.date).getTime() || 0;
       const dateB = new Date(b.date).getTime() || 0;
       return dateB - dateA;
    });

    const totalItems = filtered.length;
    const totalPages = Math.ceil(totalItems / archiveItemsPerPage) || 1;

    let currPage = (window as any).archiveCurrentPage || 1;
    if (currPage > totalPages) currPage = totalPages;
    if (currPage < 1) currPage = 1;
    (window as any).archiveCurrentPage = currPage;

    const startIndex = (currPage - 1) * archiveItemsPerPage;
    const endIndex = Math.min(startIndex + archiveItemsPerPage, totalItems);
    const paginated = filtered.slice(startIndex, endIndex);

    const counterText = document.getElementById('archive-counter');
    if (counterText) {
        counterText.innerText = `TOPLAM ${totalItems} RAPOR BULUNDU`;
    }

    const canEdit = (window as any).archiveCanEdit;
    const canDelete = (window as any).archiveCanDelete;
    const canReturn = (window as any).archiveCanReturn;
    const isAdmin = (window as any).archiveIsAdmin;

    const showBulkActions = (window as any).archiveShowBulkActions;

    if (paginated.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${showBulkActions ? 7 : 6}" style="padding: 3rem; text-align: center; color: var(--text-muted);">Seçilen filtrelere uygun rapor bulunamadı.</td></tr>`;
    } else {
        tbody.innerHTML = paginated.map((report: any) => {
           const isDownloaded = report.isDownloaded;
           const name = (report.templateName || report.faultCode || '').toLowerCase();
           const type = (report.type || '').toUpperCase();
           const isBakim = type === 'BAKIM' || name.includes('bakım') || name.includes('bakim') || name.includes('yağ') || name.includes('temizlik') || name.includes('kontrol') || name.includes('t44') || name.includes('t13');
           
           const descriptionLine = isBakim 
             ? (report.faultDesc || '') 
             : `ARIZA KODU: ${report.faultCode || '---'} - ${report.faultDesc || ''}`;

           return `
             <tr class="archive-row">
                ${showBulkActions ? `
                <td style="padding: 1rem; text-align: center;">
                    <input type="checkbox" class="archive-checkbox" value="${report.reportNo}" data-id="${report.id}" data-type="${report.type === 'BAKIM' ? 'Bakim' : 'Ariza'}" data-turbin="${report.turbineNo}" data-template="${report.templateName || report.faultCode || 'Rapor'}" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-cyan);">
                </td>
                ` : ''}
                <td style="padding: 1rem; text-align: center; color: var(--text-muted); font-weight: 600;">${new Date(report.date).toLocaleDateString('tr-TR')}</td>
                <td style="padding: 1rem; text-align: center;">
                  <span style="font-family: 'Rajdhani', sans-serif; font-weight: 700; color: var(--accent-cyan); font-size: 0.95rem; letter-spacing: 0.5px;">${report.reportNo}</span>
                  ${isDownloaded ? `<div style="margin-top: 4px; display: flex; justify-content: center;"><span style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid #22c55e; padding: 2px 6px; border-radius: 4px; font-weight: 700; font-size: 0.65rem;"><i class="fa-solid fa-check-double"></i> İNDİRİLDİ</span></div>` : ''}
                </td>
                <td style="padding: 1rem; text-align: center;">
                  <div style="font-weight: 700;">${report.turbineNo}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted);">${report.turbineSerial}</div>
                </td>
                <td style="padding: 1rem;">
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                      ${getReportBadge(report)}
                      ${isAdmin && report.auditMetrics?.isSuspiciouslyFast ? `
                      <span style="background: rgba(255, 0, 85, 0.15); color: #ff0055; border: 1px solid #ff0055; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.65rem; width: fit-content; box-shadow: 0 0 8px rgba(255,0,85,0.25); display: flex; align-items: center; gap: 4px;" title="${report.auditMetrics.suspicionReason || 'Hızlı doldurma şüphesi'}">
                        <i class="fa-solid fa-triangle-exclamation"></i> ŞÜPHELİ HIZLI
                      </span>
                      ` : ''}
                    </div>
                    <span style="font-size: 0.7rem; color: var(--text-muted); max-width: 450px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 600; text-transform: uppercase;" title="${descriptionLine}">
                      ${descriptionLine}
                    </span>
                  </div>
                </td>
                <td style="padding: 1rem; text-align: center;">
                  <span style="background: rgba(255,255,255,0.03); color: #fff; padding: 4px 10px; border-radius: 4px; font-weight: 700; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.08); display: inline-block;">
                    ${formatTeamName(report.team)}
                  </span>
                </td>
                <td style="padding: 1rem; text-align: center; white-space: nowrap;">
                  <div style="display: flex; gap: 0.5rem; justify-content: center; align-items: center;">
                    <button class="cyber-action-btn view-btn" title="Görüntüle" onclick="window.viewArchiveReport('${report.reportNo}')">
                      <i class="fa-solid fa-eye"></i>
                    </button>
                    ${canEdit ? `
                    <button class="cyber-action-btn edit-btn" title="Düzenle" onclick="window.editArchiveReport('${report.reportNo}')">
                      <i class="fa-solid fa-pen-to-square"></i>
                    </button>
                    ` : ''}
                    ${canReturn ? `
                    <button class="cyber-action-btn return-btn" title="Ekibe Geri Gönder" onclick="window.sendReportBackToTeam('${report.id}', '${report.reportNo}', '${siteId}')">
                      <i class="fa-solid fa-reply"></i>
                    </button>
                    ` : ''}
                    ${canDelete ? `
                    <button class="cyber-action-btn delete-btn" title="Sil" onclick="window.deleteArchiveReport('${report.id}', '${report.reportNo}', '${siteId}')">
                      <i class="fa-solid fa-trash-can"></i>
                    </button>
                    ` : ''}
                  </div>
                </td>
              </tr>
            `;
        }).join('');
    }

    const paginationDiv = document.getElementById('archive-pagination');
    if (paginationDiv) {
       if (totalItems === 0) {
          paginationDiv.innerHTML = '';
          return;
       }
       const showingStart = startIndex + 1;
       const showingEnd = endIndex;
       paginationDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: rgba(255,255,255,0.02); border-top: 1px solid var(--glass-border); flex-wrap: wrap; gap: 1rem; border-radius: 0 0 12px 12px;">
            <div style="color: var(--text-muted); font-size: 0.8rem;">
              <span>${totalItems} rapor arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button onclick="window.changeArchivePage(1)" ${currPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1e293b; border: 1px solid var(--glass-border); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-left"></i>
              </button>
              <button onclick="window.changeArchivePage(${currPage - 1})" ${currPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1e293b; border: 1px solid var(--glass-border); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-left"></i>
              </button>
              
              <span style="color: #E2E8F0; font-size: 0.8rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${currPage} / ${totalPages}</span>
              
              <button onclick="window.changeArchivePage(${currPage + 1})" ${currPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1e293b; border: 1px solid var(--glass-border); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-right"></i>
              </button>
              <button onclick="window.changeArchivePage(${totalPages})" ${currPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1e293b; border: 1px solid var(--glass-border); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
       `;
    }
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
    modal.innerHTML = `
        <div style="background: #1e293b; padding: 2rem; border-radius: 12px; border: 1px solid var(--accent-cyan); width: 400px; max-width: 90vw; text-align: center; box-shadow: 0 0 30px rgba(0,242,254,0.2);">
            <i class="fa-solid fa-file-zipper fa-bounce" style="font-size: 3rem; color: var(--accent-cyan); margin-bottom: 1rem;"></i>
            <h3 style="margin-bottom: 1rem;">ZIP Arşivi Hazırlanıyor...</h3>
            <div style="width: 100%; background: rgba(0,0,0,0.5); border-radius: 8px; height: 16px; margin-bottom: 1rem; overflow: hidden;">
                <div id="zip-progress-bar" style="width: 0%; height: 100%; background: var(--accent-cyan); transition: width 0.3s;"></div>
            </div>
            <p id="zip-progress-text" style="color: var(--text-muted); font-size: 0.9rem;">0 / ${checkboxes.length} rapor işlendi</p>
            <p style="color: #ffcc00; font-size: 0.75rem; margin-top: 1rem;"><i class="fa-solid fa-triangle-exclamation"></i> Lütfen bu pencereyi kapatmayın veya sayfayı yenilemeyin.</p>
        </div>
    `;
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
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff', width: 900 },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'], before: ['.html2pdf__page-break', '.section-break'], avoid: ['tr', '.pdf-no-break', 'img'] }
        };

        const originalHtmlFontSize = document.documentElement.style.fontSize;
        document.documentElement.style.fontSize = '12px';

        try {
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
                
                // Give browser time to render DOM, CSS, and images
                const images = wrapper.querySelectorAll('img');
                if (images.length > 0) {
                  await Promise.all(Array.from(images).map((img: any) => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(res => { img.onload = res; img.onerror = res; });
                  }));
                }
                await new Promise(r => setTimeout(r, 500));
                
                // Get PDF as blob (must pass the container, not the fixed wrapper)
                const targetElement = wrapper.querySelector('#pdf-container') || wrapper.firstElementChild || wrapper;
                const pdfBlob = await (window as any).html2pdf().set(baseOpt).from(targetElement).outputPdf('blob');
                
                // Add to zip folder
                const d = new Date(report.date);
                const y = d.getFullYear();
                const m = String(d.getMonth() + 1).padStart(2, '0');
                const day = String(d.getDate()).padStart(2, '0');
                const dateStr = `${y}.${m}.${day}`;
                
                const mcfStr = report.matFormNo ? ` (MÇF ${report.matFormNo})` : '';
                const actionStr = type === 'Bakim' ? report.templateName : report.faultCode;
                
                const replaceTr = (s: string) => (s||'').replace(/Ğ/g,'G').replace(/ğ/g,'g').replace(/Ü/g,'U').replace(/ü/g,'u').replace(/Ş/g,'S').replace(/ş/g,'s').replace(/İ/g,'I').replace(/ı/g,'i').replace(/Ö/g,'O').replace(/ö/g,'o').replace(/Ç/g,'C').replace(/ç/g,'c');
                
                let fileName = `${dateStr}-${report.siteName}-${actionStr}-${turbineNo}${mcfStr}.pdf`;
                fileName = replaceTr(fileName).replace(/[\\/:*?"<>|]/g, '-');
                
                if (type === 'Bakim') {
                    bakimFolder.file(fileName, pdfBlob);
                } else {
                    arizaFolder.file(fileName, pdfBlob);
                }
                
                // Clean up DOM
                document.body.removeChild(wrapper);
                
                completed++;
                document.getElementById('zip-progress-bar')!.style.width = `${(completed / checkboxes.length) * 100}%`;
                document.getElementById('zip-progress-text')!.innerText = `${completed} / ${checkboxes.length} rapor işlendi`;
            }
        } finally {
            document.documentElement.style.fontSize = originalHtmlFontSize;
        }
        
        // Generate Zip and trigger download
        document.getElementById('zip-progress-text')!.innerText = "ZIP dosyası oluşturuluyor, lütfen bekleyin...";
        const zipBlob = await zip.generateAsync({ type: "blob" });
        (window as any).saveAs(zipBlob, `${cleanSiteName}_Raporlar.zip`);
        
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

export const ReportArchivePage = async (siteId?: string) => {
  try {
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

    if (!siteId || siteId === 'TÜMÜ') {
      const activeTaskSites = (window as any).activeTaskSites || [];
      const sites = dataService.getSites().filter(s => isAdmin || (currentUser?.allowedSites || []).includes(s.id) || activeTaskSites.includes(s.id));
      return `
        <div class="fade-in-up content-area" style="max-width: 1200px; margin: 0 auto; padding: 2rem 1.5rem;">
          <div style="margin-bottom: 2.5rem; text-align: center;">
            <h1 class="page-title" style="font-size: 2.2rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px; color: #fff; margin-bottom: 0.5rem; text-shadow: 0 0 20px rgba(0, 242, 254, 0.2); display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
              <i class="fa-solid fa-box-archive" style="color: var(--accent-blue);"></i> RAPOR ARŞİVİ
            </h1>
            <p style="color: var(--text-muted); font-size: 0.95rem; font-weight: 500; margin: 0;">Raporlarını incelemek istediğiniz sahayı seçiniz</p>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.75rem;">
            ${sites.map(site => {
              return `
                <div onclick="window.selectReportSiteAndNavigate('${site.id}')" class="site-select-card hover-scale-card" style="padding: 2.2rem 2rem; border-radius: 16px; cursor: pointer; position: relative; overflow: hidden; display: flex; flex-direction: column; gap: 1.25rem; align-items: center; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); background: rgba(17, 24, 39, 0.7); transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);">
                  <!-- Glowing Background Effect -->
                  <div class="glow-overlay" style="position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; background: radial-gradient(circle at center, rgba(0, 242, 254, 0.08) 0%, transparent 60%); pointer-events: none; transition: opacity 0.3s; opacity: 0.4;"></div>
                  
                  <div class="site-icon-wrapper" style="position: relative; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                    <!-- Pulse rings -->
                    <div class="pulse-ring" style="position: absolute; inset: -4px; border: 1.5px dashed rgba(0, 242, 254, 0.2); border-radius: 50%; animation: spin-dashed 12s linear infinite;"></div>
                    <div class="site-icon-box" style="width: 54px; height: 54px; border-radius: 50%; background: rgba(0, 242, 254, 0.06); border: 1px solid rgba(0, 242, 254, 0.2); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.6rem; transition: all 0.3s; box-shadow: 0 0 15px rgba(0,242,254,0.1);">
                      <i class="fa-solid fa-folder-open"></i>
                    </div>
                  </div>
                  
                  <div style="z-index: 1;">
                    <h3 style="margin: 0 0 4px 0; font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; font-weight: 800; color: #fff; letter-spacing: 0.5px; text-transform: uppercase;">${site.name}</h3>
                    <span style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700; letter-spacing: 1px; opacity: 0.85;">SAHA KODU: ${site.id}</span>
                  </div>

                  <div class="cyber-enter-btn" style="margin-top: 0.5rem; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: var(--accent-cyan); padding: 8px 20px; border-radius: 8px; font-size: 0.75rem; font-weight: 800; display: flex; align-items: center; gap: 8px; transition: all 0.3s; font-family: 'Rajdhani'; letter-spacing: 0.5px;">
                    ARŞİVE GİRİŞ <i class="fa-solid fa-chevron-right" style="font-size: 0.7rem; transition: transform 0.2s;"></i>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
        
        <style>
          .hover-scale-card { transition: all 0.3s ease; }
          .hover-scale-card:hover {
            transform: translateY(-5px);
            border-color: rgba(0, 242, 254, 0.3) !important;
            box-shadow: 0 15px 35px rgba(0, 242, 254, 0.1) !important;
          }
          .hover-scale-card:hover > div:nth-child(2) {
            background: rgba(0, 242, 254, 0.2) !important;
            box-shadow: 0 0 15px rgba(0, 242, 254, 0.3);
            transform: scale(1.05);
          }
        </style>
      `;
    }

    const perms = currentUser?.allowedTabs?.['reports-archive'] || {};
    const canEdit = isAdmin || perms.editReport;
    const canDelete = isAdmin || perms.deleteReport;
    const canDownloadPdf = isAdmin || perms.downloadPdf;
    const canReturn = isAdmin || perms.returnReport;
    const canUseAi = isAdmin || perms.useAi;

    const site = dataService.getSites().find(s => s.id === siteId);
    const activeTaskSites = (window as any).activeTaskSites || [];
    if (!isAdmin && !(currentUser?.allowedSites || []).includes(siteId) && !activeTaskSites.includes(siteId)) {
      return `<div style="padding: 2rem; color: #ff4444; text-align: center;">Bu sahaya erişim yetkiniz bulunmamaktadır.</div>`;
    }
    const reports = await serviceReportService.getReportsBySite(siteId);
    const visibleReports = reports.filter(r => r.status !== 'returned' && r.team !== 'MANUEL' && !(r.reportNo || '').startsWith('MAN-'));

    // Fetch site turbines and calculate report counts per turbine (normal turbines first, special units at the end)
    const siteTurbines = dataService.getTurbinesBySite(siteId) || [];
    const sortedTurbines = [...siteTurbines].sort((a, b) => {
      const isNormalA = a.no > 0;
      const isNormalB = b.no > 0;
      if (isNormalA && !isNormalB) return -1;
      if (!isNormalA && isNormalB) return 1;
      if (isNormalA && isNormalB) return a.no - b.no;
      // Both are special/non-turbine units (RTU, FCU, SAI, etc.)
      const labelA = a.label || a.id || '';
      const labelB = b.label || b.id || '';
      return labelA.localeCompare(labelB);
    });
    const turbineReportCounts = sortedTurbines.map(t => {
      const isNormal = t.no > 0;
      const tName = isNormal ? `T-${t.no}` : (t.label || t.id);
      // Show serial number in parentheses after the turbine name
      const displayLabel = isNormal ? `${tName} (${t.id})` : tName;
      const count = visibleReports.filter(r => {
        const rName = r.turbineNo || '';
        return rName === tName || rName.replace('T-', '') === tName.replace('T-', '') || r.turbineSerial === t.id;
      }).length;
      return {
        id: t.id,
        name: displayLabel,
        count
      };
    });

    const selectedTurbine = (window as any).selectedArchiveTurbine || 'all';
    const showBulkActions = isAdmin || currentUser?.role?.toUpperCase() === 'MALZEME_YONETIMI';

    (window as any).archiveReports = visibleReports;
    (window as any).archiveSiteId = siteId;
    (window as any).archiveSiteName = site?.name || '';
    (window as any).archiveCanEdit = canEdit;
    (window as any).archiveCanDelete = canDelete;
    (window as any).archiveCanReturn = canReturn;
    (window as any).archiveIsAdmin = isAdmin;
    (window as any).archiveShowBulkActions = showBulkActions;

    setTimeout(() => {
        if ((window as any).renderArchiveTable) {
           (window as any).renderArchiveTable();
        }
    }, 100);

     return `
    <div class="fade-in-up content-area" style="display: flex; gap: 1.5rem; align-items: flex-start; max-width: 100%; margin: 0; padding: 0 1.5rem 0 0.5rem; box-sizing: border-box;">
      
      <!-- Left Column: Turbine Sidebar (White box area) -->
      <div class="glass-panel" style="width: 250px; flex-shrink: 0; max-height: calc(100vh - 120px); overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.5rem; scrollbar-width: thin; position: sticky; top: 20px; z-index: 10;">
         <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; font-weight: 800; color: #FFF; margin: 0 0 0.5rem 0; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.5rem; display: flex; align-items: center; gap: 8px; text-transform: uppercase; letter-spacing: 0.5px;">
           <i class="fa-solid fa-wind" style="color: var(--accent-cyan); text-shadow: 0 0 8px var(--accent-cyan);"></i> TÜRBİNLER
         </h4>
         
         <button onclick="window.filterArchiveByTurbine('all')" class="cyber-tab-btn ${(!selectedTurbine || selectedTurbine === 'all') ? 'active' : ''}" style="width: 100%; padding: 10px 14px; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 700; border-radius: 8px; border: 1px solid rgba(0, 242, 254, 0.2); background: rgba(0, 242, 254, 0.05); color: #fff; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
           <span><i class="fa-solid fa-layer-group" style="margin-right: 8px; color: var(--accent-cyan);"></i> Tüm Üniteler</span>
           <span style="background: rgba(255,255,255,0.1); padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-family: monospace; font-weight: bold;">${visibleReports.length}</span>
         </button>
         
         ${turbineReportCounts.map(tc => {
           const hasSerial = tc.name.includes('(');
           const nameOnly = hasSerial ? tc.name.split(' ')[0] : tc.name;
           const serialOnly = hasSerial ? tc.name.match(/\(([^)]+)\)/)?.[1] || '' : '';
           
           return `
             <button onclick="window.filterArchiveByTurbine('${tc.id}')" class="cyber-tab-btn ${(selectedTurbine === tc.id) ? 'active' : ''}" style="width: 100%; padding: 10px 14px; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; font-weight: 700; border-radius: 8px; border: 1px solid ${tc.count > 0 ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255,255,255,0.05)'}; background: ${tc.count > 0 ? 'rgba(0, 242, 254, 0.02)' : 'rgba(255,255,255,0.01)'}; color: ${tc.count > 0 ? '#fff' : '#64748B'}; cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.2s;">
               <span style="display: flex; flex-direction: column; align-items: flex-start; gap: 2px; text-align: left;">
                 <span style="font-weight: 800;">${nameOnly}</span>
                 ${serialOnly ? `<span style="font-size: 0.7rem; color: #64748B; font-weight: 600; font-family: monospace;">S/N: ${serialOnly}</span>` : ''}
               </span>
               <span style="background: ${tc.count > 0 ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255,255,255,0.03)'}; color: ${tc.count > 0 ? 'var(--accent-cyan)' : '#64748B'}; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem; font-family: monospace; font-weight: bold;">${tc.count}</span>
             </button>
           `;
         }).join('')}
      </div>

      <!-- Right Column: Main Content -->
      <div style="flex-grow: 1; min-width: 0; display: flex; flex-direction: column;">
        <!-- Title Area -->
        <div style="display: flex; align-items: center; gap: 1.25rem; margin-bottom: 2rem;">
          <button onclick="window.selectReportSiteAndNavigate('')" class="cyber-back-btn" style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.25s;" onmouseover="this.style.background='rgba(255,255,255,0.08)'; this.style.borderColor='rgba(0, 242, 254, 0.3)'; this.style.boxShadow='0 0 10px rgba(0, 242, 254, 0.15)';" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.08)'; this.style.boxShadow='none';">
            <i class="fa-solid fa-arrow-left" style="font-size: 1rem;"></i>
          </button>
          <div>
            <h1 class="page-title" style="margin: 0 0 4px 0; font-family:'Rajdhani',sans-serif; font-size: 2.2rem; font-weight: 900; letter-spacing: -0.5px; display: flex; align-items: center; gap: 0.5rem; text-transform: uppercase; white-space: nowrap;">
              <i class="fa-solid fa-box-archive" style="color: var(--accent-cyan); text-shadow: 0 0 15px rgba(0,242,254,0.35);"></i> ${site?.name} Rapor Arşivi
            </h1>
            <p id="archive-counter" style="color: var(--text-dim); font-size: 0.85rem; font-weight: 600; margin: 0; font-family: monospace; letter-spacing: 0.5px;">[ TOPLAM ${visibleReports.length} RAPOR BULUNDU ]</p>
          </div>
        </div>
      <style>
        .cyber-tab-btn.active {
          background: rgba(0, 242, 254, 0.15) !important;
          border-color: var(--accent-cyan) !important;
          color: var(--accent-cyan) !important;
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);
        }
        .cyber-tab-btn:hover {
          border-color: var(--accent-cyan) !important;
          color: #fff !important;
        }
      </style>

      <!-- Cyber Control Bar -->
      <div class="cyber-control-bar" style="display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; margin-bottom: 2rem; padding: 1rem; border-radius: 12px; background: rgba(10, 15, 25, 0.4); border: 1px solid rgba(0, 243, 255, 0.15); box-shadow: 0 5px 20px rgba(0,0,0,0.3); flex-wrap: wrap;">
        <!-- Left Side: Dropdown Filters -->
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.25); padding: 4px 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <i class="fa-regular fa-calendar" style="color: var(--accent-cyan); font-size: 0.9rem;"></i>
            <select id="archive-month" onchange="window.filterArchiveByMonth()" class="cyber-dropdown-select" style="background: transparent; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; outline: none; font-weight: 700; font-family: 'Rajdhani', sans-serif; cursor: pointer;">
              <option value="all" style="background:#0f172a;">Tüm Aylar</option>
              <option value="0" style="background:#0f172a;">Ocak</option>
              <option value="1" style="background:#0f172a;">Şubat</option>
              <option value="2" style="background:#0f172a;">Mart</option>
              <option value="3" style="background:#0f172a;">Nisan</option>
              <option value="4" style="background:#0f172a;">Mayıs</option>
              <option value="5" style="background:#0f172a;">Haziran</option>
              <option value="6" style="background:#0f172a;">Temmuz</option>
              <option value="7" style="background:#0f172a;">Ağustos</option>
              <option value="8" style="background:#0f172a;">Eylül</option>
              <option value="9" style="background:#0f172a;">Ekim</option>
              <option value="10" style="background:#0f172a;">Kasım</option>
              <option value="11" style="background:#0f172a;">Aralık</option>
            </select>
            <span style="opacity: 0.2; color: #fff;">|</span>
            <select id="archive-year" onchange="window.filterArchiveByMonth()" class="cyber-dropdown-select" style="background: transparent; color: #fff; border: none; padding: 6px 12px; border-radius: 4px; font-size: 0.85rem; outline: none; font-weight: 700; font-family: 'Rajdhani', sans-serif; cursor: pointer;">
              <option value="all" style="background:#0f172a;">Tüm Yıllar</option>
              <option value="2024" style="background:#0f172a;">2024</option>
              <option value="2025" style="background:#0f172a;">2025</option>
              <option value="2026" style="background:#0f172a;">2026</option>
              <option value="2027" style="background:#0f172a;">2027</option>
            </select>
          </div>

          <!-- Real-time Cyber Search Input -->
          <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.25); padding: 4px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--accent-cyan); font-size: 0.85rem;"></i>
            <input type="text" id="archive-search-input" placeholder="Rapor No, Kod veya Açıklama Ara..." oninput="window.renderArchiveTable()" style="background: transparent; color: #fff; border: none; padding: 6px 4px; font-size: 0.85rem; outline: none; width: 220px; font-family: 'Rajdhani', sans-serif; font-weight: 700;">
          </div>
          
          <div style="background: rgba(0, 242, 254, 0.05); padding: 6px 14px; border-radius: 8px; border: 1px solid rgba(0, 242, 254, 0.15); display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-family: monospace;">
            <span style="color: var(--text-dim);">SAHA ID:</span>
            <span style="font-weight: 800; color: var(--accent-cyan);">${siteId}</span>
          </div>
        </div>

        <!-- Right Side: Cyber Buttons -->
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
          ${showBulkActions ? `
          <button onclick="window.downloadSelectedAsZip('${site?.name}', '${siteId}')" class="cyber-action-bar-btn" style="background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); color: var(--accent-cyan); display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Rajdhani'; font-weight: 800; letter-spacing: 0.5px; transition: all 0.25s;">
            <i class="fa-solid fa-file-zipper" style="font-size: 0.9rem;"></i> SEÇİLENLERİ ZIP İNDİR
          </button>
          ` : ''}
          
          ${(showBulkActions && canDelete) ? `
          <button onclick="window.deleteSelectedReports('${siteId}')" class="cyber-action-bar-btn delete" style="background: rgba(255, 0, 85, 0.08); border: 1px solid rgba(255, 0, 85, 0.25); color: #ff0055; display: flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Rajdhani'; font-weight: 800; letter-spacing: 0.5px; transition: all 0.25s;">
            <i class="fa-solid fa-trash-can" style="font-size: 0.9rem;"></i> SEÇİLENLERİ SİL
          </button>
          ` : ''}
          
          ${canUseAi ? `
          <button onclick="window.openAiExecutiveSummary()" class="cyber-ai-btn" style="position: relative; display: flex; align-items: center; gap: 8px; padding: 8px 18px; border-radius: 8px; font-family: 'Rajdhani'; font-weight: 800; letter-spacing: 0.5px; cursor: pointer;">
            <i class="fa-solid fa-wand-magic-sparkles" style="color: #e0b0ff;"></i> RAPOR ANALİZİ BAŞLAT
          </button>
          ` : ''}
        </div>
      </div>

      <div class="glass-panel" style="padding: 1.5rem;">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
          <thead>
            <tr class="archive-header-row">
              ${showBulkActions ? `<th style="padding: 1.1rem 1rem; width: 50px; text-align: center;"><input type="checkbox" id="archive-select-all" onchange="window.toggleAllArchiveCheckboxes(this)" style="cursor: pointer; width: 16px; height: 16px; accent-color: var(--accent-cyan);"></th>` : ''}
              <th style="padding: 1.1rem 1rem; width: 110px; text-align: center;">TARİH</th>
              <th style="padding: 1.1rem 1rem; width: 120px; text-align: center;">RAPOR NO</th>
              <th style="padding: 1.1rem 1rem; width: 130px; text-align: center;">TÜRBİN / SERİ</th>
              <th style="padding: 1.1rem 1rem;">ARIZA / BAKIM</th>
              <th style="padding: 1.1rem 1rem; width: 120px; text-align: center;">EKİP</th>
              <th style="padding: 1.1rem 1rem; width: 150px; text-align: center;">AKSİYON</th>
            </tr>
          </thead>
          <tbody id="archive-tbody">
            <tr><td colspan="${showBulkActions ? 7 : 6}" style="padding: 2rem; text-align: center; color: var(--text-muted);">Yükleniyor...</td></tr>
          </tbody>
          </table>
          <div id="archive-pagination"></div>
        </div>
      </div>
    </div>
    </div>
    <div id="report-modal" class="hidden" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: #050a10; z-index: 9999; display: flex; flex-direction: column; overflow-y: auto; overflow-x: hidden; scroll-behavior: smooth; animation: fadeIn 0.3s ease;">
      <!-- Premium Preview Header -->
      <div style="position: sticky; top: 0; z-index: 100; background: rgba(5, 10, 16, 0.9); border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding: 1rem 2rem; display: flex; justify-content: space-between; align-items: center; backdrop-filter: blur(20px);">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="background: var(--accent-cyan); width: 40px; height: 40px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-weight: 900;">DH</div>
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.2rem; color: #fff;">RAPOR ÖNİZLEME</h3>
            <span id="preview-report-no" style="font-size: 0.7rem; color: var(--accent-cyan); letter-spacing: 1px;">Yükleniyor...</span>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button onclick="window.closeReport()" class="cyber-button" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); color: #fff; padding: 8px 16px; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i> KAPAT
          </button>
        </div>
      </div>
      <div id="report-modal-content" style="padding: 2rem 1rem; background: radial-gradient(circle at center, rgba(0, 242, 254, 0.03) 0%, transparent 70%); overflow: visible; scroll-behavior: smooth;"></div>
    </div>
    
    <!-- AI Modal -->
    ${isAdmin ? `
    <div id="ai-summary-modal" class="hidden" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(10px); z-index: 99999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease;">
      <div style="background: linear-gradient(180deg, #131b2f 0%, #0b101d 100%); border: 1px solid #9b59b2; border-radius: 20px; padding: 2rem; width: 800px; max-width: 95vw; max-height: 90vh; display: flex; flex-direction: column; box-shadow: 0 0 50px rgba(155, 89, 182, 0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(155,89,182,0.3); padding-bottom: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <div style="width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #9b59b2, #00f2fe); display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #fff; box-shadow: 0 0 20px rgba(0,242,254,0.4);">
              <i class="fa-solid fa-robot"></i>
            </div>
            <div>
              <h2 style="margin: 0; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 1px; font-size: 1.5rem;">YAPAY ZEKA STRATEJİ PANELİ</h2>
              <p style="margin: 4px 0 0; color: #e0b0ff; font-size: 0.8rem; font-weight: 600;">Son 30 Günlük Tüm Saha Verilerinin Yönetici Özeti</p>
            </div>
          </div>
          <button onclick="document.getElementById('ai-summary-modal').classList.add('hidden')" style="background: transparent; border: none; color: var(--text-muted); font-size: 1.5rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-muted)'"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div id="ai-summary-content" style="flex: 1; overflow-y: auto; padding-right: 1rem; color: #e2e8f0; font-size: 0.95rem; line-height: 1.7; font-family: 'Inter', sans-serif;">
          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; gap: 1.5rem;">
            <i class="fa-solid fa-microchip fa-fade" style="font-size: 4rem; color: #9b59b2;"></i>
            <h3 style="color: #fff; margin: 0; font-weight: 400;">Raporlar Analiz Ediliyor...</h3>
            <p style="color: var(--text-muted); text-align: center; max-width: 400px; margin: 0;">Yapay Zeka tüm sahalardaki son 1 aylık verileri tarıyor ve stratejik yönetici özetini hazırlıyor. Lütfen bekleyin.</p>
            <div style="width: 200px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; position: relative;">
               <div style="position: absolute; top: 0; left: 0; height: 100%; width: 50%; background: linear-gradient(90deg, #9b59b2, #00f2fe); animation: loadingBar 1.5s infinite ease-in-out;"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
    ` : ''}
    
      <style>
        /* Santral Seçim Kartları */
        .site-select-card {
          background: linear-gradient(135deg, rgba(15, 23, 42, 0.6) 0%, rgba(30, 41, 59, 0.4) 100%) !important;
          border: 1px solid rgba(255, 255, 255, 0.05) !important;
          backdrop-filter: blur(15px);
        }
        .site-select-card:hover {
          transform: translateY(-5px);
          border-color: rgba(0, 242, 254, 0.35) !important;
          box-shadow: 0 15px 35px rgba(0, 242, 254, 0.12) !important;
        }
        .site-select-card:hover .site-icon-box {
          background: rgba(0, 242, 254, 0.15) !important;
          box-shadow: 0 0 15px rgba(0, 242, 254, 0.3) !important;
          transform: scale(1.05);
        }
        .site-select-card:hover .cyber-enter-btn {
          background: rgba(0, 242, 254, 0.15) !important;
          border-color: rgba(0, 242, 254, 0.5) !important;
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.2);
        }
        .site-select-card:hover .cyber-enter-btn i {
          transform: translateX(3px);
        }
        .site-select-card:hover .glow-overlay {
          opacity: 0.8 !important;
        }

        /* Radar Animasyonu */
        @keyframes spin-dashed {
          100% { transform: rotate(360deg); }
        }

        /* Tablo Satırı Efekti */
        .archive-row {
          border-bottom: 1px solid rgba(255, 255, 255, 0.03) !important;
          transition: all 0.25s ease !important;
        }
        .archive-row:hover {
          background: rgba(0, 242, 254, 0.02) !important;
          box-shadow: inset 3px 0 0 var(--accent-cyan);
        }

        .archive-header-row {
          background: rgba(0, 242, 254, 0.03) !important;
          border-bottom: 2px solid rgba(0, 242, 254, 0.15) !important;
          text-align: left;
          color: rgba(255, 255, 255, 0.8);
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          letter-spacing: 0.5px;
          font-size: 0.9rem;
        }

        /* Kontrol Bar Butonları */
        .cyber-action-bar-btn {
          transition: all 0.25s ease !important;
        }
        .cyber-action-bar-btn:hover {
          background: rgba(0, 242, 254, 0.15) !important;
          border-color: rgba(0, 242, 254, 0.5) !important;
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.15);
        }
        .cyber-action-bar-btn.delete:hover {
          background: rgba(255, 0, 85, 0.15) !important;
          border-color: rgba(255, 0, 85, 0.5) !important;
          box-shadow: 0 0 10px rgba(255, 0, 85, 0.15);
        }

        /* Yapay Zeka Butonu */
        .cyber-ai-btn {
          background: linear-gradient(135deg, rgba(155, 89, 182, 0.2), rgba(0, 242, 254, 0.2)) !important;
          border: 1px solid #9b59b2 !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(155, 89, 182, 0.25) !important;
          transition: all 0.3s ease !important;
          overflow: hidden;
        }
        .cyber-ai-btn::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent);
          transform: translateX(-100%);
          transition: transform 0.6s ease;
        }
        .cyber-ai-btn:hover {
          box-shadow: 0 0 25px rgba(155, 89, 182, 0.5), 0 0 10px rgba(0, 242, 254, 0.2) !important;
          border-color: #00f2fe !important;
          transform: scale(1.02);
        }
        .cyber-ai-btn:hover::after {
          transform: translateX(100%);
        }

        /* Yuvarlak Dairesel Aksiyon Butonları */
        .cyber-action-btn {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          color: rgba(255,255,255,0.6);
          font-size: 0.8rem;
        }
        .cyber-action-btn:hover {
          transform: scale(1.1);
          color: #fff;
        }
        
        .cyber-action-btn.view-btn:hover {
          background: rgba(0, 242, 254, 0.15) !important;
          border-color: var(--accent-cyan) !important;
          color: var(--accent-cyan) !important;
          box-shadow: 0 0 10px rgba(0, 242, 254, 0.3) !important;
        }
        .cyber-action-btn.edit-btn:hover {
          background: rgba(255, 153, 0, 0.15) !important;
          border-color: #ff9900 !important;
          color: #ff9900 !important;
          box-shadow: 0 0 10px rgba(255, 153, 0, 0.3) !important;
        }
        .cyber-action-btn.return-btn:hover {
          background: rgba(155, 89, 182, 0.15) !important;
          border-color: #9b59b2 !important;
          color: #9b59b2 !important;
          box-shadow: 0 0 10px rgba(155, 89, 182, 0.3) !important;
        }
        .cyber-action-btn.delete-btn:hover {
          background: rgba(255, 0, 85, 0.15) !important;
          border-color: #ff0055 !important;
          color: #ff0055 !important;
          box-shadow: 0 0 10px rgba(255, 0, 85, 0.3) !important;
        }

        .hidden { display: none !important; }
        .cyber-button { border-radius: 4px; font-weight: 600; transition: all 0.2s; }
        .cyber-button:hover { opacity: 0.8; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        @keyframes loadingBar {
          0% { left: -50%; }
          100% { left: 100%; }
        }
        
        /* Premium Full-Screen Preview Styles */
        #report-modal-content {
          padding: 2rem 1rem !important;
          display: flex !important;
          flex-direction: column !important;
          align-items: center !important;
          flex: none !important;
          height: auto !important;
          overflow: visible !important;
          margin-bottom: 40px;
        }
        #report-modal-content #pdf-container {
          max-width: 950px !important;
          width: 100% !important;
          border-radius: 12px !important;
          box-shadow: 0 20px 40px rgba(0,0,0,0.4) !important;
          padding: 40px 60px !important;
          transform-origin: top center;
          display: flex !important;
          flex-direction: column !important;
          flex: none !important;
          min-height: 1200px !important;
          background-color: #fff !important;
          margin: 0 auto 30px auto !important;
          box-sizing: border-box !important;
          /* Scale up fonts for readability on wide screens */
          font-size: 1.1rem !important;
        }
        #report-modal-content #pdf-container > div:last-child {
          margin-top: auto !important;
          padding-top: 30px !important;
        }
        
        /* Increase table readability in preview */
        #report-modal-content #pdf-container table {
          font-size: 1rem !important;
          min-width: 0 !important;
        }
        #report-modal-content #pdf-container h1 {
          font-size: 2rem !important;
        }
        #report-modal-content #pdf-container td, 
        #report-modal-content #pdf-container th {
          padding: 10px 14px !important;
        }
        
        @media print {
          body * { visibility: hidden !important; }
          #report-modal, #report-modal *, #pdf-container, #pdf-container * { visibility: visible !important; }
          #report-modal { position: absolute; left: 0; top: 0; right: 0; margin: 0; padding: 0; background: none; }
          #pdf-container { position: relative; left: 0; top: 0; margin: 0; padding: 0; width: 100%; max-width: 100%; box-shadow: none !important; transform: none !important; }
          .no-print { display: none !important; }
        }
      </style>
  `;
  } catch (error: any) {
    return `
      <div style="padding: 3rem; text-align: center; color: var(--accent-red);">
        <i class="fa-solid fa-bug" style="font-size: 3rem; margin-bottom: 1rem;"></i>
        <h3>Rapor Arşivi Hatası</h3>
        <p style="font-family: monospace; background: rgba(255,0,0,0.1); padding: 1rem; border-radius: 8px; text-align: left; overflow: auto;">
          ${error?.message || error?.toString() || 'Unknown error'}
          <br><br>${error?.stack || ''}
        </p>
      </div>
    `;
  }
};

(window as any).closeReport = () => {
    const modal = document.body.querySelector(':scope > #report-modal') || document.getElementById('report-modal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.style.overflow = 'auto';
    }
};

(window as any).openAiExecutiveSummary = async () => {
  const modal = document.getElementById('ai-summary-modal');
  const content = document.getElementById('ai-summary-content');
  if (!modal || !content) return;
  
  modal.classList.remove('hidden');
  
  // Show loading state
  content.innerHTML = `
    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 300px; gap: 1.5rem;">
      <i class="fa-solid fa-microchip fa-fade" style="font-size: 4rem; color: #9b59b2;"></i>
      <h3 style="color: #fff; margin: 0; font-weight: 400;">Veriler Analiz Ediliyor...</h3>
      <p style="color: var(--text-muted); text-align: center; max-width: 400px; margin: 0;">Yapay Zeka tüm sahalardaki son 1 aylık verileri okuyup stratejik özet çıkarıyor. Bu işlem 10-15 saniye sürebilir.</p>
    </div>
  `;

  try {
    const { aiService } = await import('../services/AiService');
    const resultText = await aiService.generateExecutiveSummary();
    
    // Basit Markdown to HTML çevirici (kalın, liste vb.)
    let htmlText = resultText
      .replace(/\*\*(.*?)\*\*/g, '<strong style="color: #fff;">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em style="color: #00f2fe;">$1</em>')
      .replace(/^\* (.*?)$/gm, '<li style="margin-bottom: 8px;">$1</li>')
      .replace(/^\d+\. (.*?)$/gm, '<li style="margin-bottom: 8px;">$1</li>')
      .replace(/\n/g, '<br>');
      
    // Eğer liste varsa <ul> ile sar
    htmlText = htmlText.replace(/(<li.*?>.*?<\/li>)/g, '<ul style="margin-top: 10px; margin-bottom: 20px; padding-left: 20px;">$1</ul>');
    htmlText = htmlText.replace(/<\/ul><br><ul.*?>/g, ''); // Bitişik listeleri birleştir

    // Daktilo Efekti
    content.innerHTML = `<div id="ai-typewriter" style="opacity: 0;">${htmlText}</div>`;
    const tw = document.getElementById('ai-typewriter');
    if (tw) {
      tw.style.transition = 'opacity 0.5s ease';
      setTimeout(() => { tw.style.opacity = '1'; }, 100);
    }
    
  } catch (err: any) {
    content.innerHTML = `
      <div style="text-align: center; padding: 3rem;">
        <i class="fa-solid fa-triangle-exclamation" style="font-size: 4rem; color: #ff0055; margin-bottom: 1rem;"></i>
        <h3 style="color: #ff0055; margin-bottom: 1rem;">Bağlantı Hatası</h3>
        <p style="color: var(--text-muted);">Yapay Zeka servisine ulaşılamadı. Lütfen .env.local dosyasında API anahtarınızın yapılandırıldığından emin olun.</p>
        <p style="font-family: monospace; background: rgba(255,0,0,0.1); padding: 1rem; border-radius: 8px; text-align: left; margin-top: 1rem; font-size: 0.8rem; color: #ffb3c6;">${err.message}</p>
      </div>
    `;
  }
};

(window as any).editArchiveReport = async (reportNo: string) => {
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    const perms = currentUser?.allowedTabs?.['reports-archive'] || {};
    if (!isAdmin && !perms.editReport) {
        alert("Bu işlemi yapmak için yetkiniz bulunmamaktadır.");
        return;
    }
    const report = await serviceReportService.getReportByNo(reportNo);
    if (report) {
        (window as any).navigate('form-ariza', { ...report, isEditMode: true });
    } else {
        alert("Rapor verileri çekilemedi.");
    }
};

(window as any).sendReportBackToTeam = async (id: string, reportNo: string, siteId: string) => {
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    const perms = currentUser?.allowedTabs?.['reports-archive'] || {};
    if (!isAdmin && !perms.editReport) {
        alert("Bu işlemi yapmak için yetkiniz bulunmamaktadır.");
        return;
    }

    const report = await serviceReportService.getReportByNo(reportNo);
    if (!report) {
        alert("Rapor bulunamadı.");
        return;
    }

    const { formatTeamName } = await import('../utils/formatters');
    const defaultTeam = report.team || '';
    const upperTeam = defaultTeam.toUpperCase().trim();

    // If the report already belongs to a valid team, bypass the modal and directly send it back to that team!
    if (upperTeam && (upperTeam.startsWith('TEAM') || upperTeam.startsWith('EKIP'))) {
        const reason = prompt(`Lütfen ${defaultTeam} ekibine geri gönderme nedenini yazınız.\n(Bu açıklama ekibin işlem notlarına eklenecektir)`);
        if (!reason || reason.trim() === '') {
            alert("Geri gönderme işlemi iptal edildi. Geçerli bir neden belirtmelisiniz.");
            return;
        }
        try {
            await serviceReportService.sendReportBack(id, defaultTeam, reason.trim());
            alert(`Rapor başarıyla ${defaultTeam} ekibine geri gönderildi.`);
            (window as any).navigate('reports-archive', siteId);
        } catch (error) {
            alert("Hata oluştu: " + error);
        }
        return;
    }

    // Kullanıcılardan ekip listesini çek
    const { userService } = await import('../services/UserService');
    let users: any[] = [];
    try {
      users = await userService.getAllUsers();
    } catch (e) {
      console.error('Kullanıcı listesi alınamadı:', e);
    }

    // TECHNICIAN rolündeki kullanıcılardan benzersiz ekip isimleri (sadece Team ile başlayanlar)
    const teamSet = new Set<string>();
    users.forEach(u => {
      if (u.role === 'TECHNICIAN' && u.email) {
        const tName = formatTeamName(u.email.split('@')[0]);
        if (tName && tName.toUpperCase().startsWith('TEAM')) {
          teamSet.add(tName);
        }
      }
    });
    const teams = Array.from(teamSet).sort((a, b) => {
      const numA = parseInt(a.replace(/[^0-9]/g, '') || '0');
      const numB = parseInt(b.replace(/[^0-9]/g, '') || '0');
      return numA - numB;
    });

    // Modal HTML oluştur
    const existingModal = document.getElementById('team-select-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'team-select-modal';
    modal.innerHTML = `
      <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(8px); z-index: 99999; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.2s ease;">
        <div style="background: linear-gradient(145deg, rgba(15,20,30,0.98), rgba(10,14,22,0.98)); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 2rem; width: 420px; max-width: 90vw; box-shadow: 0 25px 60px rgba(0,0,0,0.5);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <div>
              <h3 style="margin: 0; color: #fff; font-size: 1.1rem; font-weight: 800;">
                <i class="fa-solid fa-reply" style="color: #9b59b2; margin-right: 8px;"></i>Ekibe Geri Gönder
              </h3>
              <p style="margin: 4px 0 0; font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">${reportNo}</p>
            </div>
            <button onclick="document.getElementById('team-select-modal')?.remove()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; width: 32px; height: 32px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; font-weight: 600;">Düzenleme görevini göndermek istediğiniz ekibi seçin:</p>

          <div style="display: flex; flex-direction: column; gap: 8px; max-height: 300px; overflow-y: auto; padding-right: 4px;">
            ${teams.length > 0 ? teams.map(team => `
              <button class="team-select-btn" data-team="${team}" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px 16px; color: #fff; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s; text-align: left;" onmouseover="this.style.background='rgba(155,89,182,0.15)'; this.style.borderColor='rgba(155,89,182,0.4)'" onmouseout="this.style.background='rgba(255,255,255,0.03)'; this.style.borderColor='rgba(255,255,255,0.06)'">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, rgba(155,89,182,0.3), rgba(0,114,255,0.2)); display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.9rem; color: #e0b0ff; flex-shrink: 0;">
                  ${team.replace(/[^0-9]/g, '') || '?'}
                </div>
                <div>
                  <div style="font-weight: 800; font-size: 0.9rem; letter-spacing: 0.5px;">${team}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600; margin-top: 2px;">
                    ${users.filter(u => u.role === 'TECHNICIAN' && formatTeamName(u.email?.split('@')[0] || '') === team).map(u => formatDisplayName(u.displayName || u.email?.split('@')[0])).join(', ') || 'Ekip Üyesi'}
                  </div>
                </div>
                <i class="fa-solid fa-chevron-right" style="margin-left: auto; opacity: 0.3; font-size: 0.7rem;"></i>
              </button>
            `).join('') : `
              <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                <i class="fa-solid fa-users-slash" style="font-size: 2rem; margin-bottom: 0.5rem; opacity: 0.3;"></i>
                <p style="font-size: 0.8rem;">Kayıtlı ekip bulunamadı.</p>
              </div>
            `}
          </div>

          <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); text-align: right;">
            <button onclick="document.getElementById('team-select-modal')?.remove()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); padding: 8px 20px; border-radius: 8px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'">
              İptal
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Ekip butonlarına click handler
    modal.querySelectorAll('.team-select-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectedTeam = btn.getAttribute('data-team');
        if (!selectedTeam) return;

        const reason = prompt(`Lütfen ${selectedTeam} ekibine geri gönderme nedenini yazınız.\n(Bu açıklama ekibin işlem notlarına eklenecektir)`);
        if (!reason || reason.trim() === '') {
          alert("Geri gönderme işlemi iptal edildi. Geçerli bir neden belirtmelisiniz.");
          return;
        }

        // Butonu loading state'e al
        (btn as HTMLElement).style.background = 'rgba(155,89,182,0.3)';
        (btn as HTMLElement).style.borderColor = '#9b59b2';
        (btn as HTMLElement).innerHTML = `
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(155,89,182,0.4); display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            <i class="fa-solid fa-spinner fa-spin" style="color: #e0b0ff;"></i>
          </div>
          <div style="font-weight: 800; color: #e0b0ff;">Gönderiliyor...</div>
        `;

        try {
          await serviceReportService.sendReportBack(id, selectedTeam, reason.trim());
          modal.remove();
          alert(`Rapor başarıyla ${selectedTeam} ekibine geri gönderildi.`);
          (window as any).navigate('reports-archive', siteId);
        } catch (error) {
          alert("Hata oluştu: " + error);
          modal.remove();
        }
      });
    });
};



(window as any).deleteArchiveReport = async (id: string, reportNo: string, siteId: string) => {
    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    const perms = currentUser?.allowedTabs?.['reports-archive'] || {};
    if (!isAdmin && !perms.deleteReport) {
        alert("Silme yetkiniz bulunmamaktadır.");
        return;
    }
    if (confirm(`"${reportNo}" numaralı raporu silmek istediğinize emin misiniz?`)) {
        try {
            await serviceReportService.deleteReport(id);
            alert("Rapor başarıyla silindi.");
            (window as any).navigate('reports-archive', siteId);
        } catch (error) {
            alert("Silme sırasında hata oluştu: " + error);
        }
    }
};

(window as any).deleteSelectedReports = async (siteId: string) => {
    const checkboxes = document.querySelectorAll('.archive-checkbox:checked');
    if (checkboxes.length === 0) {
        alert("Lütfen silmek istediğiniz raporları seçin.");
        return;
    }

    const currentUser = (window as any).currentUser;
    const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
    const perms = currentUser?.allowedTabs?.['reports-archive'] || {};
    if (!isAdmin && !perms.deleteReport) {
        alert("Silme yetkiniz bulunmamaktadır.");
        return;
    }

    if (confirm(`Seçilen ${checkboxes.length} adet raporu kalıcı olarak silmek istediğinize emin misiniz?`)) {
        try {
            const deletePromises = Array.from(checkboxes).map(async (cb: any) => {
                const docId = cb.getAttribute('data-id');
                if (docId) {
                    await serviceReportService.deleteReport(docId);
                }
            });
            
            await Promise.all(deletePromises);
            alert("Seçilen raporlar başarıyla silindi.");
            (window as any).navigate('reports-archive', siteId);
        } catch (error) {
            alert("Toplu silme sırasında hata oluştu: " + error);
        }
    }
};

(window as any).viewArchiveReport = async (reportNo: string) => {
    try {
        const report = await serviceReportService.getReportByNo(reportNo);
        if (report) {
            const { renderReportPDF } = await import('../components/ReportTemplate');
            const htmlContent = renderReportPDF(report);
            
            // Portal the modal to document.body to prevent parent layout clipping
            let modal = document.body.querySelector(':scope > #report-modal') as HTMLElement;
            if (!modal) {
                const templateModal = document.getElementById('report-modal');
                if (templateModal) {
                    document.body.appendChild(templateModal);
                    modal = templateModal;
                }
            } else {
                const duplicates = document.querySelectorAll('#report-modal');
                duplicates.forEach(dup => {
                    if (dup !== modal) dup.remove();
                });
            }

            const modalContent = modal?.querySelector('#report-modal-content') as HTMLElement;
            const previewReportNo = modal?.querySelector('#preview-report-no') as HTMLElement;
            
            if (modal && modalContent) {
                if (previewReportNo) previewReportNo.innerText = report.reportNo;
                
                // Add Admin Telemetry Analysis Card if user is Admin
                const currentUser = (window as any).currentUser;
                const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
                let telemetryHtml = '';
                
                if (isAdmin) {
                    if (report.auditMetrics) {
                        const metrics = report.auditMetrics;
                        const isSuspicious = metrics.isSuspiciouslyFast;
                        telemetryHtml = `
                        <div class="no-print" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid ${isSuspicious ? 'rgba(255, 0, 85, 0.3)' : 'rgba(0, 242, 254, 0.3)'}; margin: 15px auto ${isSuspicious ? '5px' : '15px'} auto; max-width: 950px; border-radius: 8px; padding: 10px 16px; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 15px; font-family: 'Inter', sans-serif;">
                          
                          <div style="display: flex; align-items: center; gap: 12px; min-width: max-content;">
                            <i class="fa-solid ${isSuspicious ? 'fa-triangle-exclamation' : 'fa-circle-check'}" style="font-size: 1.4rem; color: ${isSuspicious ? '#ff0055' : '#00f2fe'};"></i>
                            <div>
                              <div style="display: flex; align-items: center; gap: 8px;">
                                <h4 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">ADMİN TELEMETRİSİ</h4>
                                <span style="background: ${isSuspicious ? 'rgba(255, 0, 85, 0.15)' : 'rgba(0, 242, 254, 0.15)'}; color: ${isSuspicious ? '#ff0055' : '#00f2fe'}; border: 1px solid ${isSuspicious ? '#ff0055' : '#00f2fe'}; padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.6rem; letter-spacing: 0.5px;">
                                  ${isSuspicious ? '⚠️ ŞÜPHELİ' : '🟢 GÜVENİLİR'}
                                </span>
                              </div>
                              <p style="margin: 2px 0 0; font-size: 0.6rem; color: var(--text-muted); font-weight: 600;">Sadece yöneticilere gösterilir. PDF çıktısında yer almaz.</p>
                            </div>
                          </div>
                          
                          <div style="display: flex; align-items: center; gap: 16px; flex: 1; justify-content: flex-end; flex-wrap: wrap;">
                            <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: max-content;">
                              <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Toplam Süre</div>
                              <div style="font-size: 0.95rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #fff;">${metrics.totalFillTimeSeconds || 0} sn</div>
                            </div>
                            
                            <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.1);"></div>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: max-content;">
                              <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">İşaretleme</div>
                              <div style="font-size: 0.95rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #fff;">${metrics.clickCount || 0} tık</div>
                            </div>
                            
                            <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.1);"></div>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: max-content;">
                              <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Ort. Hız</div>
                              <div style="font-size: 0.95rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: ${metrics.averageClickIntervalMs < 1800 ? '#ff0055' : '#00f2fe'};">
                                ${metrics.averageClickIntervalMs ? (metrics.averageClickIntervalMs / 1000).toFixed(1) : 0} sn
                              </div>
                            </div>
                            
                            <div style="width: 1px; height: 28px; background: rgba(255,255,255,0.1);"></div>
                            <div style="display: flex; flex-direction: column; align-items: flex-start; min-width: max-content;">
                              <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">Hızlı Seçim</div>
                              <div style="font-size: 0.95rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: ${metrics.maxConsecutiveFastSameStatus >= 8 ? '#ff0055' : '#fff'};">
                                ${metrics.maxConsecutiveFastSameStatus || 0} defa
                              </div>
                            </div>
                          </div>
                          
                        </div>
                        ${isSuspicious && metrics.suspicionReason ? `
                        <div class="no-print" style="margin: 0 auto 15px auto; max-width: 950px; background: rgba(255, 0, 85, 0.08); border: 1px dashed rgba(255, 0, 85, 0.3); padding: 8px 12px; border-radius: 6px; font-size: 0.65rem; color: #ffb3c6; display: flex; gap: 8px; align-items: center; font-family: 'Inter', sans-serif;">
                          <i class="fa-solid fa-circle-info" style="color: #ff0055;"></i>
                          <div><span style="font-weight: 700;">Şüphe Nedeni:</span> ${metrics.suspicionReason}</div>
                        </div>
                        ` : ''}
                        `;
                    } else {
                        telemetryHtml = `
                        <div class="no-print" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.95)); border: 1px solid rgba(255, 255, 255, 0.1); margin: 15px auto; max-width: 950px; border-radius: 8px; padding: 10px 16px; color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.5); display: flex; align-items: center; gap: 12px; font-family: 'Inter', sans-serif;">
                          <i class="fa-clock-rotate-left fa-solid" style="font-size: 1.4rem; color: var(--text-muted);"></i>
                          <div>
                            <h4 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; font-weight: 800; color: var(--text-muted); letter-spacing: 0.5px; text-transform: uppercase;">ANALİZ VERİSİ BULUNMUYOR (ESKİ RAPOR)</h4>
                            <p style="margin: 2px 0 0; font-size: 0.6rem; color: var(--text-muted); font-weight: 600;">Bu rapor analiz sisteminin aktif edilmesinden önce oluşturulduğu için doğrululuk analizi verileri bulunmamaktadır.</p>
                          </div>
                        </div>
                        `;
                    }
                }
                
                modalContent.innerHTML = telemetryHtml + htmlContent;
                modal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            } else {
                const printWindow = window.open('', '_blank');
                if (printWindow) {
                    printWindow.document.write(`
                        <html>
                            <head>
                                <title>${report.reportNo} - Rapor Önizleme</title>
                                <style>
                                    body { margin: 0; padding: 20px; background: #f0f2f5; }
                                    @media print {
                                        body { background: white; padding: 0; }
                                    }
                                </style>
                            </head>
                            <body>
                                ${htmlContent}
                            </body>
                        </html>
                    `);
                    printWindow.document.close();
                }
            }
        } else {
            alert("Rapor bulunamadı.");
        }
    } catch (error) {
        alert("Rapor görüntülenirken hata oluştu: " + error);
    }
};


(window as any).downloadReportExcel = async (event: Event) => {
    const btn = event.currentTarget as HTMLButtonElement;
    const reportNoEl = document.getElementById('preview-report-no');
    if (!reportNoEl) return;
    
    const reportNo = reportNoEl.innerText;
    
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HAZIRLANIYOR...';
    btn.disabled = true;

    try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        const report = await serviceReportService.getReportByNo(reportNo);
        if (!report) throw new Error("Rapor bulunamadı.");

        const xlsx = await import('xlsx');
        
        // --- 1. GENEL BİLGİLER ---
        const wsData = [];
        wsData.push(["BAKIM KONTROL LİSTESİ - GENEL BİLGİLER"]);
        wsData.push(["Rapor No", report.reportNo]);
        wsData.push(["Şablon", report.templateName]);
        wsData.push(["Türbin", report.turbineNo]);
        wsData.push(["Seri No", report.turbineSerial]);
        wsData.push(["Saha", report.siteName]);
        wsData.push(["Tarih", new Date(report.date).toLocaleDateString('tr-TR')]);
        wsData.push([]);
        
        // --- 2. KONTROL MADDELERİ ---
        if (report.checklist && report.checklist.length > 0) {
            wsData.push(["KONTROL MADDELERİ"]);
            wsData.push(["NO", "KONTROL MADDESİ", "DURUM", "AÇIKLAMA", "ALT DETAYLAR (ÖLÇÜM / İMZA / vs)"]);
            
            report.checklist.forEach((item: any, idx: number) => {
                const isOk = item.status === 'OK';
                const isNa = item.status === 'NA';
                const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
                
                let details = '';
                if (item.measurementConfig && item.measurementConfig.type !== 'standard' && item.measurementValues && item.measurementValues.length > 0) {
                    const type = item.measurementConfig.type;
                    const vals = item.measurementValues;
                    
                    if (type === 'torque_control') details = `Değer: ${vals[0] || '-'} | İmza: ${vals[1] || '-'}`;
                    else if (type === 'oil_sample') details = `Numune: ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | Miktar: ${vals[1] || '-'} | İmza: ${vals[2] || '-'}`;
                    else if (type === 'oil_level_control') details = `Seviye: ${vals[0] || '-'} | Eklenen: ${vals[1] || '-'} | İmza: ${vals[2] || '-'}`;
                    else if (type === 'filter_change') details = `Değişti: ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | Temizlendi: ${vals[1] === 'true' ? 'Evet' : 'Hayır'} | İmza: ${vals[2] || '-'}`;
                    else if (type === 'signature_approval') details = `İmza/Onay: ${vals[0] || '-'}`;
                    else if (type === 'crane_control') details = `Vinç: ${vals[0] || '-'} | Çap: ${vals[1] || '-'} | Kopuk: (30:${vals[2]||'0'}, 60:${vals[3]||'0'}, 300:${vals[4]||'0'}) | İmza: ${vals[5] || '-'}`;
                    else if (type === 'safety_equipment_control') details = `Son Kontrol: ${vals[0] || '-'} | Eksiksiz/Hasarsız: ${vals[1] === 'true' ? 'Evet' : 'Hayır'} | İmza: ${vals[2] || '-'}`;
                    else if (type === 'bearing_control') details = `Numune: ${vals[0] === 'true' ? 'Evet' : 'Hayır'} | ÖN Gres: ${vals[1] || '-'} | ARKA Gres: ${vals[2] || '-'} | İmza: ${vals[3] || '-'}`;
                    else if (type === 'final_checkout_control') {
                        details = `1:${vals[0]==='true'?'☑':'☐'} 2:${vals[1]==='true'?'☑':'☐'} 3:${vals[2]==='true'?'☑':'☐'} 4:${vals[3]==='true'?'☑':'☐'} 5:${vals[4]==='true'?'☑':'☐'} | İmza:${vals[5]||'-'}`;
                    }
                    else if (type === 'numeric_multiple') {
                        const labels = item.measurementConfig.measurementLabels || [];
                        details = vals.map((v: any, i: number) => {
                            if (item.measurementConfig.requireSignature && i === vals.length - 1 && vals.length > item.measurementConfig.inputCount) return `İmza: ${v || '-'}`;
                            return `${labels[i] || 'Ölçüm '+(i+1)}: ${v || '-'}`;
                        }).join(' | ');
                    }
                    else if (type === 'version_control') {
                        const items = item.measurementConfig.versionItems || [];
                        details = vals.map((v: any, i: number) => `${items[i]?.label || 'Kart '+(i+1)}: ${v || '-'}`).join(' | ');
                    }
                    else if (type === 'dropdown') {
                        details = `Seçim: ${vals[0] || '-'}`;
                    }
                }
                
                wsData.push([
                    (idx + 1).toString(),
                    item.text,
                    statusLabel,
                    item.comment || '',
                    details
                ]);
            });
            wsData.push([]);
        }
        
        // --- 3. İSG KONTROLLERİ ---
        if ((report as any).ohsItems && (report as any).ohsItems.length > 0) {
            wsData.push(["İSG KONTROLLERİ"]);
            wsData.push(["NO", "İSG MADDESİ", "DURUM", "AÇIKLAMA"]);
            
            (report as any).ohsItems.forEach((item: any, idx: number) => {
                const isOk = item.status === 'OK';
                const isNa = item.status === 'NA';
                const statusLabel = isOk ? 'TAMAMLANDI' : (isNa ? 'OPSİYON DIŞI' : 'TAMAMLANMADI');
                
                wsData.push([
                    (idx + 1).toString(),
                    item.text,
                    statusLabel,
                    item.comment || ''
                ]);
            });
            wsData.push([]);
        }

        // --- 4. EXCEL DOSYASINI OLUŞTUR VE İNDİR ---
        const ws = xlsx.utils.aoa_to_sheet(wsData);
        
        // Basit Sütun Genişliği Ayarı
        ws['!cols'] = [
            { wch: 5 },   // NO
            { wch: 60 },  // KONTROL MADDESİ
            { wch: 15 },  // DURUM
            { wch: 40 },  // AÇIKLAMA
            { wch: 70 }   // ALT DETAYLAR
        ];

                const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, "Rapor");
        
        xlsx.writeFile(wb, `DH_Servis_Rapor_${reportNo}.xlsx`);

    } catch (err: any) {
        console.error("Excel Download error", err);
        alert("Excel indirilirken bir hata oluştu: " + err.message);
    } finally {
        btn.innerHTML = originalHtml;
        btn.disabled = false;
    }
};

(window as any).downloadReportPDF = async (event: Event) => {
    const reportNo = document.getElementById('preview-report-no')?.innerText;
    if (!reportNo) {
        alert("Rapor numarası bulunamadı!");
        return;
    }
    
    const btn = event.currentTarget as HTMLButtonElement;
    const originalHtml = btn.innerHTML;
    if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> HAZIRLANIYOR...';
        btn.disabled = true;
    }
  
    try {
        const report = await serviceReportService.getReportByNo(reportNo);
        if (report) {
            const { renderReportPDF } = await import('../components/ReportTemplate');
            const htmlContent = renderReportPDF(report);

            // Load html2pdf.js dynamically if not present
            if (!(window as any).html2pdf) {
                await new Promise((res, rej) => {
                    const script = document.createElement('script');
                    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
                    script.onload = res; script.onerror = rej;
                    document.head.appendChild(script);
                });
            }

            // Dosya adı oluştur
            const d = new Date(report.date);
            const dateStr = `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
            const actionStr = report.templateName || report.faultCode || 'Rapor';
            let fileName = `${dateStr}-${report.siteName}-${actionStr}-${report.turbineNo}.pdf`;
            fileName = fileName.replace(/Ğ/g,'G').replace(/ğ/g,'g').replace(/Ü/g,'U').replace(/ü/g,'u').replace(/Ş/g,'S').replace(/ş/g,'s').replace(/İ/g,'I').replace(/ı/g,'i').replace(/Ö/g,'O').replace(/ö/g,'o').replace(/Ç/g,'C').replace(/ç/g,'c');
            fileName = fileName.replace(/[\\/:*?"<>|]/g, '-');

            // Create temporary container that mimics the exact print layout at A4 aspect ratio (margin: 0 in html2pdf)
            const wrapper = document.createElement('div');
            wrapper.style.cssText = 'position: fixed; left: -9999px; top: 0; width: 794px; z-index: -9999;';

            // Create target inner element to hold content with A4 margins/padding
            const target = document.createElement('div');
            target.id = 'pdf-download-target';
            target.style.cssText = `
                width: 794px;
                background: #ffffff;
                box-sizing: border-box;
                padding: 30px 38px; /* 8mm top/bottom, 10mm left/right margins in pixels */
            `;

            // Inject styles to override #pdf-container layout and tables for direct conversion
            const overrideStyle = `
                <style>
                    #pdf-download-target #pdf-container {
                        width: 100% !important;
                        max-width: none !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        background: #ffffff !important;
                    }
                    /* Ensure tables are correctly padded and borders remain fine */
                    #pdf-download-target #pdf-container table {
                        width: 100% !important;
                        border-collapse: collapse !important;
                    }
                    #pdf-download-target #pdf-container tr, 
                    #pdf-download-target #pdf-container td, 
                    #pdf-download-target #pdf-container th {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                </style>
            `;
            target.innerHTML = overrideStyle + htmlContent;
            wrapper.appendChild(target);
            document.body.appendChild(wrapper);

            // Wait for images to load inside target
            const images = target.querySelectorAll('img');
            if (images.length > 0) {
                await Promise.all(Array.from(images).map((img: any) => {
                    if (img.complete) return Promise.resolve();
                    return new Promise(res => { img.onload = res; img.onerror = res; });
                }));
            }
            await new Promise(r => setTimeout(r, 600));

            // Set A4 options with 0 margin since margins are pre-built inside the wrapper padding
            const opt = {
                margin: 0,
                filename: fileName,
                image: { type: 'png', quality: 1 },
                html2canvas: { 
                    scale: 2, 
                    useCORS: true, 
                    backgroundColor: '#ffffff', 
                    width: 794
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
                pagebreak: { mode: ['css', 'legacy'], before: ['.html2pdf__page-break', '.section-break'], avoid: ['tr', '.pdf-no-break', 'img'] }
            };

            const originalHtmlFontSize = document.documentElement.style.fontSize;
            document.documentElement.style.fontSize = '12px';

            try {
                // Direct PDF download using target element
                await (window as any).html2pdf().set(opt).from(target).save();
            } finally {
                document.documentElement.style.fontSize = originalHtmlFontSize;
            }

            // Clean up DOM
            document.body.removeChild(wrapper);
        }
    } catch (err) {
        console.error("PDF Download error", err);
        alert("PDF indirilirken bir hata oluştu: " + err);
    } finally {
        if (btn) {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }
    }
};

