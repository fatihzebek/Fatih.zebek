import { statusService } from '../services/StatusService';
import { serviceReportService } from '../services/ServiceReportService';

export const FaultLibraryPage = async () => {
  return `
    <div class="fade-in-up content-area zoom-tablet" style="max-width: 1400px; margin: 0 auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.5rem;">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan); filter: drop-shadow(0 0 8px rgba(0, 242, 254, 0.4));"></i> 
            Arıza Çözüm Kütüphanesi
          </h1>
          <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">
            Geçmiş servis raporlarının verileriyle beslenen akıllı arıza teşhis ve çözüm arşivi
          </p>
        </div>
      </div>

      <div class="glass-panel" style="padding: 1.5rem; border-radius: 24px; background: rgba(13, 20, 33, 0.4); margin-bottom: 1.5rem; position: relative; z-index: 2000;">
        <div style="position: relative; width: 100%;">
          <label style="display: block; font-size: 0.7rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1.5px; margin-bottom: 0.8rem; text-transform: uppercase;">ARIZA KODU SORGULA</label>
          <div style="position: relative; display: flex; gap: 1rem;">
            <div style="position: relative; flex-grow: 1;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.95rem; opacity: 0.7;"></i>
              <input type="text" id="lib-fault-search" placeholder="Hata kodu veya açıklama yazarak arayın... (Örn: 438-208)" 
                     style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.9rem 1rem 0.9rem 3rem; border-radius: 16px; width: 100%; font-size: 0.95rem; font-weight: 500; outline: none; transition: all 0.3s; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);"
                     oninput="window.handleLibFaultSearch(this.value)"
                     autocomplete="off">
              <div id="lib-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; position: absolute; top: 100%; left: 0; z-index: 1000; padding: 0; max-height: 250px; overflow-y: auto; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(255,255,255,0.1);"></div>
            </div>
          </div>
        </div>
      </div>

      <div id="lib-analysis-container">
        <div class="glass-panel" style="padding: 4rem 2rem; text-align: center; color: var(--text-dim); border-radius: 24px; background: rgba(13, 20, 33, 0.2);">
          <div style="opacity: 0.4;">
            <i class="fa-solid fa-keyboard" style="font-size: 3.5rem; color: var(--accent-cyan); margin-bottom: 1.5rem; display: block; filter: drop-shadow(0 0 10px rgba(0,242,254,0.2));"></i>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--text-main); margin-bottom: 0.5rem;">Sorgulamak İçin Kod Seçin</h3>
            <p style="font-size: 0.8rem;">Yukarıdaki arama çubuğunu kullanarak geçmiş çözüm detaylarını, sık değişen malzemeleri ve arıza istatistiklerini görmek istediğiniz arıza kodunu yazıp seçin.</p>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global handlers for search
(window as any).handleLibFaultSearch = (term: string) => {
  const dropdown = document.getElementById('lib-fault-results');
  if (!dropdown) return;
  
  if (term.trim().length < 1) {
    dropdown.classList.add('hidden');
    return;
  }

  const results = statusService.searchCodes(term);
  if (results.length === 0) {
    dropdown.classList.add('hidden');
    return;
  }

  dropdown.classList.remove('hidden');
  dropdown.innerHTML = results.map((r: any) => `
    <div class="search-item" onclick="window.selectLibFault('${r.KOD}')" style="padding: 0.8rem 1.2rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.78rem; transition: background 0.2s;" onmouseover="this.style.background='rgba(0,242,254,0.1)'" onmouseout="this.style.background=''">
      <span style="color: var(--accent-cyan); font-weight: 700; font-family: monospace; font-size: 0.82rem; margin-right: 6px;">${r.KOD}</span> - ${r.Aciklama}
    </div>
  `).join('');
};

(window as any).selectLibFault = async (kod: string) => {
  const input = document.getElementById('lib-fault-search') as HTMLInputElement;
  const dropdown = document.getElementById('lib-fault-results');
  const container = document.getElementById('lib-analysis-container');

  if (input) input.value = kod;
  if (dropdown) dropdown.classList.add('hidden');
  if (!container) return;

  const exact = statusService.getCodeByKod(kod);
  const titleText = exact ? exact.Aciklama : 'Arıza Bilgisi';

  container.innerHTML = `
    <div class="glass-panel" style="padding: 2rem; border-radius: 24px; background: rgba(13, 20, 33, 0.4); display: flex; align-items: center; justify-content: center; gap: 10px;">
      <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-cyan); font-size: 1.5rem;"></i>
      <span style="font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: var(--accent-cyan); font-weight: 700; letter-spacing: 1.5px;">TÜM GEÇMİŞ SAHA VERİLERİ ANALİZ EDİLİYOR...</span>
    </div>
  `;

  try {
    const allReports = await serviceReportService.getAllReports();
    const similar = allReports.filter((r: any) => {
      if (!r.faultCode) return false;
      const rCode = r.faultCode.includes(' - ') ? r.faultCode.split(' - ')[0].trim() : r.faultCode.trim();
      return rCode === kod.trim();
    });

    if (similar.length === 0) {
      container.innerHTML = `
        <div class="glass-panel" style="padding: 3rem 2rem; border-radius: 24px; text-align: center; border-left: 4px solid var(--accent-orange); background: rgba(255, 165, 0, 0.02);">
          <i class="fa-solid fa-circle-info" style="color: var(--accent-orange); font-size: 2rem; margin-bottom: 1rem;"></i>
          <h3 style="font-size: 1rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.5rem;">Geçmiş Kayıt Bulunamadı</h3>
          <p style="font-size: 0.8rem; color: var(--text-dim); max-width: 600px; margin: 0 auto;">
            Seçtiğiniz <strong>${kod}</strong> arıza kodu için geçmiş servis kayıtları arasında henüz onaylanmış bir müdahale raporu bulunmamaktadır.
          </p>
        </div>
      `;
      return;
    }

    const getCleanTurbineName = (tNo: any) => {
      if (!tNo) return 'Türbin Bilinmiyor';
      const clean = String(tNo).trim();
      const numOnly = clean.replace(/^T-?/i, '');
      return `T${numOnly}`;
    };

    // Material analysis
    const materialCounts: { [key: string]: { sapNo: string; desc: string; count: number; usages: { siteName: string; turbineNo: string; reportNo: string }[] } } = {};
    const turbineCounts: { [key: string]: number } = {};
    const siteCounts: { [key: string]: number } = {};

    similar.forEach((r: any) => {
      // Materials
      if (Array.isArray(r.materials)) {
        r.materials.forEach((m: any) => {
          if (m.sapNo && m.used > 0) {
            const key = m.sapNo;
            if (!materialCounts[key]) {
              materialCounts[key] = {
                sapNo: m.sapNo,
                desc: m.description || 'Tanımsız Parça',
                count: 0,
                usages: []
              };
            }
            materialCounts[key].count += m.used;
            
            const siteName = r.siteName || 'Bölge Bilinmiyor';
            const turbineNo = getCleanTurbineName(r.turbineNo);
            const reportNo = r.reportNo || '';
            const exists = materialCounts[key].usages.some(u => u.reportNo === reportNo);
            if (!exists) {
              materialCounts[key].usages.push({ siteName, turbineNo, reportNo });
            }
          }
        });
      }

      // Turbines
      if (r.turbineNo) {
        const tKey = getCleanTurbineName(r.turbineNo);
        turbineCounts[tKey] = (turbineCounts[tKey] || 0) + 1;
      }

      // Sites
      if (r.siteName) {
        siteCounts[r.siteName] = (siteCounts[r.siteName] || 0) + 1;
      }
    });

    const sortedMaterials = Object.values(materialCounts).sort((a, b) => b.count - a.count);
    const sortedTurbines = Object.entries(turbineCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sortedSites = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    // Notes
    const resolutionNotes = similar
      .map((r: any) => {
        const dateStr = r.date || 'Tarih Bilinmiyor';
        const teamName = r.team || 'Atanmamış Ekip';
        const turbineName = getCleanTurbineName(r.turbineNo);
        const siteName = r.siteName || 'Bölge Bilinmiyor';
        const noteText = (r.notes || '').trim();
        const reportNo = r.reportNo || '';
        return { dateStr, teamName, turbineName, siteName, noteText, reportNo };
      })
      .filter(item => item.noteText && item.noteText !== 'Genel Görev' && item.noteText.length > 5);

    // Build parts UI
    let materialsHtml = '';
    if (sortedMaterials.length > 0) {
      materialsHtml = sortedMaterials.map(m => {
        const usagesStr = m.usages.map(u => `${u.siteName} (${u.turbineNo})`).join(', ');
        return `
          <div style="display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; margin-bottom: 8px;">
            <div style="display: flex; align-items: center; justify-content: space-between; width: 100%;">
              <div style="display: flex; flex-direction: column; gap: 3px;">
                <span style="font-weight: 700; color: var(--text-main); font-size: 0.78rem;">${m.desc}</span>
                <span style="font-family: monospace; color: var(--text-muted); font-size: 0.68rem;">SAP: ${m.sapNo}</span>
              </div>
              <span class="badge" style="background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan); font-weight: 800; padding: 4px 10px; border-radius: 12px; font-size: 0.7rem; letter-spacing: 0.5px;">${m.count} Adet</span>
            </div>
            <div style="font-size: 0.62rem; color: var(--text-muted); border-top: 1px dashed rgba(255,255,255,0.05); padding-top: 4px; line-height: 1.3;">
              <i class="fa-solid fa-map-pin" style="color: var(--accent-orange); margin-right: 4px;"></i> Kullanılan Yer: <strong style="color: var(--text-main); opacity: 0.85;">${usagesStr}</strong>
            </div>
          </div>
        `;
      }).join('');
    } else {
      materialsHtml = `
        <div style="text-align: center; padding: 2.5rem; color: var(--text-dim); font-size: 0.75rem; font-style: italic; opacity: 0.5;">
          <i class="fa-solid fa-cube" style="font-size: 2rem; margin-bottom: 0.5rem; display: block;"></i>
          Bu arıza müdahalelerinde herhangi bir yedek parça değişim kaydı bulunamadı.
        </div>
      `;
    }

    // Build stats HTML
    let statsHtml = `
      <div class="glass-card" style="padding: 1.2rem; border-color: rgba(0, 242, 254, 0.1); background: rgba(10,25,50,0.15); border-radius: 16px; margin-bottom: 1.5rem;">
        <div style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; margin-bottom: 1rem; text-transform: uppercase;">
          <i class="fa-solid fa-chart-simple"></i> Arıza İstatistikleri (Toplam ${similar.length} Müdahale)
        </div>
        <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 120px; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.02);">
            <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700;">EN ÇOK HATA VEREN SAHA</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sortedSites[0]?.[0] || '-'}">${sortedSites[0]?.[0] || '-'}</div>
            <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 600; margin-top: 2px;">${sortedSites[0]?.[1] || 0} kez</div>
          </div>
          <div style="flex: 1; min-width: 120px; background: rgba(0,0,0,0.2); padding: 0.8rem; border-radius: 10px; border: 1px solid rgba(255,255,255,0.02);">
            <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 700;">EN SIK HATA VEREN TÜRBİN</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-main); margin-top: 4px;">${sortedTurbines[0]?.[0] || '-'}</div>
            <div style="font-size: 0.6rem; color: var(--accent-cyan); font-weight: 600; margin-top: 2px;">${sortedTurbines[0]?.[1] || 0} kez</div>
          </div>
        </div>
      </div>
    `;

    // Build notes UI
    let notesHtml = '';
    if (resolutionNotes.length > 0) {
      notesHtml = resolutionNotes.map(n => `
        <div style="padding: 14px; background: rgba(0, 242, 254, 0.01); border-left: 3px solid var(--accent-cyan); border-radius: 0 16px 16px 0; margin-bottom: 12px; border-top: 1px solid rgba(255,255,255,0.02); border-right: 1px solid rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.02); transition: transform 0.2s;" onmouseover="this.style.transform='translateX(4px)'" onmouseout="this.style.transform=''">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; color: var(--text-muted); font-size: 0.68rem; font-weight: 700;">
            <span style="display: flex; align-items: center; gap: 8px;">
              <span style="color: var(--text-main); opacity: 0.9; font-weight: 800;"><i class="fa-regular fa-calendar" style="color: var(--accent-cyan);"></i> ${n.dateStr}</span>
              <span style="color: var(--text-muted); opacity: 0.5;">|</span>
              <span style="color: var(--accent-orange); font-weight: 800;"><i class="fa-solid fa-charging-station"></i> ${n.siteName} (${n.turbineName})</span>
            </span>
            <span style="background: rgba(255,255,255,0.05); padding: 1px 6px; border-radius: 4px; font-family: monospace;">${n.reportNo}</span>
          </div>
          <div style="color: var(--text-main); font-size: 0.76rem; font-weight: 500; line-height: 1.45; word-break: break-word;">"${n.noteText}"</div>
          <div style="display: flex; justify-content: flex-end; align-items: center; margin-top: 6px; font-size: 0.62rem; color: var(--text-muted); font-weight: 700;">
            <span>Müdahale Eden: <strong style="color: var(--text-main); opacity: 0.85;">${n.teamName}</strong></span>
          </div>
        </div>
      `).join('');
    } else {
      notesHtml = `
        <div style="text-align: center; padding: 3rem; color: var(--text-dim); font-size: 0.75rem; font-style: italic; opacity: 0.5;">
          <i class="fa-solid fa-comment-slash" style="font-size: 2.2rem; margin-bottom: 0.5rem; display: block;"></i>
          Bu arıza müdahaleleri için detaylı bir açıklama/not girilmemiş.
        </div>
      `;
    }

    container.innerHTML = `
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap; width: 100%; align-items: flex-start;">
        <!-- Left Panel: Info & Materials -->
        <div style="flex: 1; min-width: 320px; display: flex; flex-direction: column;">
          <!-- Fault Card Info -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 20px; background: rgba(13, 20, 33, 0.4); margin-bottom: 1.5rem; border-top: 3px solid var(--accent-cyan);">
            <div style="font-size: 0.55rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 4px;">SORGULANAN KOD</div>
            <div style="font-family: monospace; font-size: 1.8rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px; margin-bottom: 8px;">${kod}</div>
            <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-main); line-height: 1.45;">${titleText}</div>
          </div>

          ${statsHtml}

          <!-- Materials Card -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 20px; background: rgba(13, 20, 33, 0.4); border-top: 3px solid var(--accent-orange);">
            <div style="font-size: 0.7rem; color: var(--accent-orange); font-weight: 800; letter-spacing: 1px; margin-bottom: 1rem; text-transform: uppercase;">
              <i class="fa-solid fa-wrench"></i> ÇÖZÜMDE KULLANILAN MALZEMELER
            </div>
            ${materialsHtml}
          </div>
        </div>

        <!-- Right Panel: Resolution Notes -->
        <div style="flex: 2; min-width: 450px;" class="glass-panel">
          <div style="padding: 1.5rem; border-radius: 20px; background: rgba(13, 20, 33, 0.4); border-top: 3px solid var(--accent-cyan); width: 100%;">
            <div style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; margin-bottom: 1.2rem; text-transform: uppercase;">
              <i class="fa-solid fa-clock-rotate-left"></i> SAHA MÜDAHALE ÇÖZÜM AÇIKLAMALARI
            </div>
            <div style="max-height: 650px; overflow-y: auto; padding-right: 6px;">
              ${notesHtml}
            </div>
          </div>
        </div>
      </div>
    `;
  } catch (err) {
    console.error("Fault library select error:", err);
    container.innerHTML = `
      <div class="glass-panel" style="padding: 2rem; border-radius: 24px; text-align: center; border-left: 4px solid var(--accent-red); background: rgba(255, 0, 0, 0.02);">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 2rem; margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.5rem;">Sistem Hatası</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted);">Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.</p>
      </div>
    `;
  }
};
