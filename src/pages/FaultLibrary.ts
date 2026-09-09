import { statusService } from '../services/StatusService';
import { serviceReportService } from '../services/ServiceReportService';

export const FaultLibraryPage = async () => {
  const user = (window as any).currentUser;
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const userEmail = (user?.email || userProfile?.email || '').toLowerCase().trim();
  const isAdmin = userProfile?.role === 'ADMIN' || userEmail.includes('fatih.zebek');

  if (!isAdmin) {
    return `
      <div class="fade-in-up content-area zoom-tablet" style="max-width: 900px; margin: 3rem auto; text-align: center; font-family: 'Rajdhani', sans-serif;">
        <div class="glass-panel" style="padding: 4rem 2rem; border-radius: 24px; border: 1px solid rgba(0, 242, 254, 0.3); background: rgba(13, 20, 33, 0.7); box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
          <div style="width: 80px; height: 80px; border-radius: 50%; background: rgba(0, 242, 254, 0.1); border: 2px solid rgba(0, 242, 254, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 0 30px rgba(0, 242, 254, 0.2);">
            <i class="fa-solid fa-screwdriver-wrench" style="font-size: 2.5rem; color: var(--accent-cyan);"></i>
          </div>
          <h2 style="font-size: 1.8rem; font-weight: 800; color: #fff; margin-bottom: 0.75rem; letter-spacing: 0.5px;">Geliştirme & Güncelleme Aşamasında</h2>
          <p style="font-size: 1rem; color: var(--text-dim); max-width: 550px; margin: 0 auto 1.5rem auto; line-height: 1.6;">
            Arıza Çözüm Kütüphanesi modülü şu anda veri kalitesi ve model eğitimi geliştirmeleri için güncellenmektedir. Çok yakında tüm ekiplerimizin kullanımına açılacaktır.
          </p>
          <button onclick="window.navigate('dashboard')" class="cyber-btn cyber-btn-primary" style="padding: 10px 24px; font-weight: 800; font-size: 0.9rem; border-radius: 8px;">
            <i class="fa-solid fa-house" style="margin-right: 6px;"></i> Ana Sayfaya Dön
          </button>
        </div>
      </div>
    `;
  }

  return `
    <div class="fade-in-up content-area zoom-tablet" style="max-width: 1400px; margin: 0 auto; padding-bottom: 3rem; font-family: 'Rajdhani', sans-serif;">
      
      <!-- Page Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: inline-flex; align-items: center; gap: 8px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.25); padding: 4px 12px; border-radius: 20px; color: var(--accent-cyan); font-size: 0.72rem; font-weight: 800; letter-spacing: 1px; margin-bottom: 0.6rem;">
            <i class="fa-solid fa-microchip"></i> SAHA TECRÜBESİ & AKILLI TEŞHİS MERKEZİ
          </div>
          <h1 class="page-title" style="margin-bottom: 0.35rem; font-size: 1.85rem; font-weight: 800; letter-spacing: 0.5px;">
            <i class="fa-solid fa-brain" style="color: var(--accent-cyan); filter: drop-shadow(0 0 10px rgba(0, 242, 254, 0.5)); margin-right: 8px;"></i> 
            Arıza Çözüm Kütüphanesi
          </h1>
          <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">
            Geçmiş servis raporlarındaki gerçek teknisyen tecrübeleri, çözümlerde kullanılan parçalar ve saha müdahale geçmişi
          </p>
        </div>
      </div>

      <!-- Search & Quick Filter Bar -->
      <div class="glass-panel" style="padding: 1.4rem; border-radius: 22px; background: linear-gradient(135deg, rgba(13, 20, 33, 0.7), rgba(18, 28, 48, 0.5)); border: 1px solid rgba(0, 242, 254, 0.2); box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5); margin-bottom: 1.5rem; position: relative; z-index: 2000;">
        <div style="position: relative; width: 100%;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
            <label style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase;">
              <i class="fa-solid fa-magnifying-glass" style="margin-right: 4px;"></i> ARIZA KODU VEYA AÇIKLAMA İLE SORGULA
            </label>
            <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">(Örn: 69-19, 42-305, 438-208, Pitch, Fren vb.)</span>
          </div>

          <div style="position: relative; display: flex; gap: 1rem;">
            <div style="position: relative; flex-grow: 1;">
              <i class="fa-solid fa-search" style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 1.05rem; opacity: 0.8;"></i>
              <input type="text" id="lib-fault-search" placeholder="Arıza kodu veya açıklaması yazmaya başlayın..." 
                     style="background: rgba(0,0,0,0.45); border: 1px solid rgba(0, 242, 254, 0.25); color: #fff; padding: 0.95rem 1rem 0.95rem 3.2rem; border-radius: 14px; width: 100%; font-size: 1rem; font-weight: 600; outline: none; transition: all 0.3s; box-shadow: inset 0 2px 10px rgba(0,0,0,0.3);"
                     oninput="window.handleLibFaultSearch(this.value)"
                     autocomplete="off">
              <div id="lib-fault-results" class="glass-panel hidden search-results-dropdown" style="width: 100%; position: absolute; top: 105%; left: 0; z-index: 1000; padding: 0; max-height: 280px; overflow-y: auto; background: rgba(15, 23, 42, 0.98); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 14px; box-shadow: 0 15px 35px rgba(0,0,0,0.8);"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Dynamic Content / Analysis Container -->
      <div id="lib-analysis-container">
        <div class="glass-panel" style="padding: 4.5rem 2rem; text-align: center; color: var(--text-dim); border-radius: 24px; background: rgba(13, 20, 33, 0.3); border: 1px dashed rgba(255,255,255,0.08);">
          <div style="opacity: 0.6;">
            <div style="width: 76px; height: 76px; border-radius: 50%; background: rgba(0, 242, 254, 0.08); border: 2px solid rgba(0, 242, 254, 0.3); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem auto; box-shadow: 0 0 25px rgba(0, 242, 254, 0.15);">
              <i class="fa-solid fa-magnifying-glass-chart" style="font-size: 2.2rem; color: var(--accent-cyan); filter: drop-shadow(0 0 8px rgba(0,242,254,0.4));"></i>
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #fff; margin-bottom: 0.5rem; letter-spacing: 0.5px;">Sorgulamak İçin Bir Arıza Kodu Seçin</h3>
            <p style="font-size: 0.88rem; max-width: 650px; margin: 0 auto; color: var(--text-dim); line-height: 1.6;">
              Yukarıdaki arama çubuğunu kullanarak veya sık karşılaşılan hızlı butonlara tıklayarak geçmiş müdahale notlarını, sık değişen parçaları, canlı depo stok durumlarını ve saha istatistiklerini inceleyebilirsiniz.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global Handler: Start Report With Fault Code Pre-filled (Deprecated/Optional)
(window as any).startReportWithFaultCode = (kod: string, desc?: string) => {
  const code = (kod || '').trim();
  const description = (desc || '').trim();
  const fullCode = description ? `${code} - ${description}` : code;
  
  // Clear any dangling task editing keys
  localStorage.removeItem('currentEditingTemplateId');
  localStorage.removeItem('activeTask');
  localStorage.setItem('fromTemplates', 'false');

  (window as any).navigate('form-ariza', {
    faultCode: fullCode,
    rawFaultCode: code,
    faultDesc: description
  });
};

// Global Handler: Live Search
(window as any).handleLibFaultSearch = (term: string) => {
  const dropdown = document.getElementById('lib-fault-results');
  if (!dropdown) return;
  
  if (term.trim().length < 1) {
    dropdown.classList.add('hidden');
    return;
  }

  const results = statusService.searchCodes(term);
  if (results.length === 0) {
    dropdown.classList.remove('hidden');
    dropdown.innerHTML = `
      <div style="padding: 1rem; text-align: center; color: var(--text-dim); font-size: 0.8rem;">
        <i class="fa-solid fa-circle-xmark" style="color: var(--accent-red); margin-right: 6px;"></i> Eşleşen TSI arıza kodu bulunamadı.
      </div>
    `;
    return;
  }

  dropdown.classList.remove('hidden');
  dropdown.innerHTML = results.map((r: any) => `
    <div class="search-item" onclick="window.selectLibFault('${r.KOD}')" style="padding: 0.85rem 1.2rem; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.06); font-size: 0.84rem; transition: background 0.2s; display: flex; align-items: center; justify-content: space-between;" onmouseover="this.style.background='rgba(0,242,254,0.12)'" onmouseout="this.style.background=''">
      <div>
        <span style="color: var(--accent-cyan); font-weight: 800; font-family: monospace; font-size: 0.9rem; margin-right: 8px;">${r.KOD}</span>
        <span style="color: #e2e8f0; font-weight: 600;">${r.Aciklama}</span>
      </div>
      <span style="font-size: 0.68rem; color: var(--text-muted);"><i class="fa-solid fa-arrow-right"></i></span>
    </div>
  `).join('');
};

// Global Handler: Select Fault and Calculate Full Intelligence
(window as any).selectLibFault = async (kod: string) => {
  const input = document.getElementById('lib-fault-search') as HTMLInputElement;
  const dropdown = document.getElementById('lib-fault-results');
  const container = document.getElementById('lib-analysis-container');

  if (input) input.value = kod;
  if (dropdown) dropdown.classList.add('hidden');
  if (!container) return;

  const exact = statusService.getCodeByKod(kod);
  const titleText = exact ? exact.Aciklama : 'Arıza Bilgisi';

  // Render Futuristic Loading State
  container.innerHTML = `
    <div class="glass-panel" style="padding: 3.5rem 2rem; border-radius: 24px; background: rgba(13, 20, 33, 0.6); display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; border: 1px solid rgba(0, 242, 254, 0.2);">
      <i class="fa-solid fa-circle-notch fa-spin" style="color: var(--accent-cyan); font-size: 2.2rem; filter: drop-shadow(0 0 10px rgba(0, 242, 254, 0.6));"></i>
      <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; color: #fff; font-weight: 700; letter-spacing: 1px;">
        <span style="color: var(--accent-cyan); font-weight: 900; font-family: monospace; margin-right: 6px;">${kod}</span> İÇİN SAHA RAPORLARI VE ÇÖZÜMLER ANALİZ EDİLİYOR...
      </div>
      <p style="font-size: 0.78rem; color: var(--text-muted); margin: 0;">Geçmiş teknisyen notları, değişen malzemeler ve saha istatistikleri taranıyor</p>
    </div>
  `;

  try {
    const allReports = await serviceReportService.getAllReports();
    const similar = allReports.filter((r: any) => {
      if (!r.faultCode) return false;
      const rCode = r.faultCode.includes(' - ') ? r.faultCode.split(' - ')[0].trim() : r.faultCode.trim();
      return rCode === kod.trim();
    });

    const getCleanTurbineName = (tNo: any) => {
      if (!tNo) return 'Bilinmiyor';
      const clean = String(tNo).trim();
      const numOnly = clean.replace(/^T-?/i, '');
      return `T${numOnly.padStart(2, '0')}`;
    };

    // Duration formatter helper (hours & mins)
    const formatDurationHoursMins = (totalMins: number): string => {
      if (!totalMins || isNaN(totalMins) || totalMins <= 0) return 'Kayıt Yok';
      const positiveMins = Math.abs(Math.round(totalMins));
      const hours = Math.floor(positiveMins / 60);
      const mins = positiveMins % 60;
      if (hours > 0 && mins > 0) return `~${hours} sa ${mins} dk`;
      if (hours > 0) return `~${hours} sa`;
      return `~${mins} dk`;
    };

    // If no past reports found
    if (similar.length === 0) {
      container.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Fault Header Bar -->
          <div class="glass-panel" style="padding: 1.5rem 1.8rem; border-radius: 20px; background: linear-gradient(135deg, rgba(13, 20, 33, 0.8), rgba(20, 30, 50, 0.7)); border-left: 4px solid var(--accent-cyan); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="font-size: 0.68rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">SORGULANAN ARIZA KODU</div>
              <div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;">
                <span style="font-family: monospace; font-size: 2rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px;">${kod}</span>
                <span style="font-size: 1.15rem; font-weight: 700; color: #fff;">${titleText}</span>
              </div>
            </div>
          </div>

          <!-- Empty State Box -->
          <div class="glass-panel" style="padding: 3.5rem 2rem; border-radius: 22px; text-align: center; border: 1px solid rgba(245, 158, 11, 0.3); background: rgba(245, 158, 11, 0.03);">
            <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(245, 158, 11, 0.1); border: 2px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.2rem auto;">
              <i class="fa-solid fa-circle-info" style="color: #fbbf24; font-size: 2rem;"></i>
            </div>
            <h3 style="font-size: 1.2rem; color: #fff; font-weight: 800; margin-bottom: 0.5rem;">Henüz Onaylanmış Geçmiş Müdahale Kaydı Bulunmuyor</h3>
            <p style="font-size: 0.88rem; color: var(--text-dim); max-width: 620px; margin: 0 auto; line-height: 1.6;">
              Seçtiğiniz <strong style="color: var(--accent-cyan); font-family: monospace;">${kod}</strong> kodu için sistemde kayıtlı geçmiş bir saha raporu bulunmuyor.
            </p>
          </div>
        </div>
      `;
      return;
    }

    // Process materials & usage locations with deduplication counts
    const materialCounts: { [key: string]: { sapNo: string; desc: string; count: number; locationCounts: { [loc: string]: number } } } = {};
    const turbineCounts: { [key: string]: number } = {};
    const siteCounts: { [key: string]: number } = {};
    let totalDurationMins = 0;
    let durationCount = 0;

    similar.forEach((r: any) => {
      // Materials
      if (Array.isArray(r.materials)) {
        r.materials.forEach((m: any) => {
          const usedQty = Number(m.used) || 0;
          if (m.sapNo && usedQty > 0) {
            const cleanSap = String(m.sapNo).trim();
            if (!materialCounts[cleanSap]) {
              materialCounts[cleanSap] = {
                sapNo: cleanSap,
                desc: m.description || 'Tanımsız Yedek Parça',
                count: 0,
                locationCounts: {}
              };
            }
            materialCounts[cleanSap].count += usedQty;
            
            const siteName = r.siteName || 'Bölge Bilinmiyor';
            const turbineNo = getCleanTurbineName(r.turbineNo);
            const locKey = `${siteName} (${turbineNo})`;
            materialCounts[cleanSap].locationCounts[locKey] = (materialCounts[cleanSap].locationCounts[locKey] || 0) + 1;
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

      // Duration estimate from workSessions
      if (Array.isArray(r.workSessions) && r.workSessions.length > 0) {
        r.workSessions.forEach((s: any) => {
          if (s.duration) {
            const parts = String(s.duration).split(':');
            if (parts.length === 2) {
              const rawMins = parseInt(parts[0]) * 60 + parseInt(parts[1]);
              const mins = Math.abs(rawMins);
              if (!isNaN(mins) && mins > 0 && mins < 1440) {
                totalDurationMins += mins;
                durationCount++;
              }
            }
          }
        });
      }
    });

    const sortedMaterials = Object.values(materialCounts).sort((a, b) => b.count - a.count);
    const sortedTurbines = Object.entries(turbineCounts).sort((a, b) => b[1] - a[1]);
    const sortedSites = Object.entries(siteCounts).sort((a, b) => b[1] - a[1]);
    
    const avgDurationStr = durationCount > 0 
      ? formatDurationHoursMins(totalDurationMins / durationCount) 
      : 'Kayıt Yok';

    // Extract real resolution notes
    const resolutionNotes = similar
      .map((r: any) => {
        const dateStr = r.date || 'Tarih Bilinmiyor';
        const teamName = r.team || 'Atanmamış Ekip';
        const turbineName = getCleanTurbineName(r.turbineNo);
        const siteName = r.siteName || 'Bölge Bilinmiyor';
        const noteText = (r.notes || '').trim();
        const reportNo = r.reportNo || '';
        const personnelStr = Array.isArray(r.personnel) && r.personnel.length > 0 ? r.personnel.join(', ') : '';
        return { dateStr, teamName, turbineName, siteName, noteText, reportNo, personnelStr };
      })
      .filter(item => item.noteText && item.noteText !== 'Genel Görev' && item.noteText !== '-' && item.noteText.length > 3)
      .reverse(); // Newest first

    // Build Materials List
    let materialsHtml = '';
    if (sortedMaterials.length > 0) {
      materialsHtml = sortedMaterials.map(m => {
        // Form clean deduplicated usage string
        const locEntries = Object.entries(m.locationCounts || {});
        const usagesStr = locEntries.slice(0, 3).map(([loc, count]) => {
          return (count as number) > 1 ? `${loc} (${count}x)` : loc;
        }).join(', ') + (locEntries.length > 3 ? ` ve ${locEntries.length - 3} yer daha` : '');

        return `
          <div style="display: flex; flex-direction: column; gap: 8px; padding: 12px 15px; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 14px; margin-bottom: 10px; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(0,242,254,0.3)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.06)'">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 10px;">
              <div style="display: flex; flex-direction: column; gap: 2px;">
                <span style="font-weight: 800; color: #fff; font-size: 0.88rem; line-height: 1.3;">${m.desc}</span>
                <span style="font-family: monospace; color: var(--accent-cyan); font-size: 0.74rem; font-weight: 700;">SAP: ${m.sapNo}</span>
              </div>
              <span class="badge" style="background: rgba(0, 242, 254, 0.12); color: var(--accent-cyan); font-weight: 800; padding: 4px 10px; border-radius: 8px; font-size: 0.74rem; white-space: nowrap; border: 1px solid rgba(0, 242, 254, 0.3);">
                ${m.count} Adet Değişti
              </span>
            </div>

            <!-- Replacement Location -->
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; font-size: 0.72rem; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.06);">
              <span style="color: var(--text-muted); font-size: 0.7rem;" title="${usagesStr}">
                <i class="fa-solid fa-location-dot" style="color: var(--accent-orange); margin-right: 4px;"></i> Değiştiği Yer: <strong style="color: #e2e8f0;">${usagesStr}</strong>
              </span>
            </div>
          </div>
        `;
      }).join('');
    } else {
      materialsHtml = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-dim); font-size: 0.8rem; font-style: italic; opacity: 0.6;">
          <i class="fa-solid fa-cubes-stacked" style="font-size: 2.2rem; margin-bottom: 0.6rem; display: block; color: var(--text-muted);"></i>
          Bu arıza müdahalelerinde herhangi bir malzeme değişimi kaydedilmemiş.
        </div>
      `;
    }

    // Build Stats HTML
    const statsHtml = `
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 18px; background: rgba(13, 20, 33, 0.5); border: 1px solid rgba(0, 242, 254, 0.15); margin-bottom: 1.25rem;">
        <div style="font-size: 0.72rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; margin-bottom: 0.9rem; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between;">
          <span><i class="fa-solid fa-chart-line" style="margin-right: 5px;"></i> SAHA İSTATİSTİKLERİ</span>
          <span style="background: rgba(0,242,254,0.1); color: var(--accent-cyan); padding: 2px 8px; border-radius: 6px; font-size: 0.68rem;">Toplam ${similar.length} Müdahale</span>
        </div>
        
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
          <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
            <div style="font-size: 0.62rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">EN ÇOK GÖRÜLEN SANTRAL</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #fff; margin-top: 3px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sortedSites[0]?.[0] || '-'}">${sortedSites[0]?.[0] || '-'}</div>
            <div style="font-size: 0.68rem; color: var(--accent-cyan); font-weight: 700; margin-top: 2px;">${sortedSites[0]?.[1] || 0} Kez Raporlandı</div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
            <div style="font-size: 0.62rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">EN SIK HATA VEREN TÜRBİN</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #fff; margin-top: 3px;">${sortedTurbines[0]?.[0] || '-'}</div>
            <div style="font-size: 0.68rem; color: var(--accent-cyan); font-weight: 700; margin-top: 2px;">${sortedTurbines[0]?.[1] || 0} Müdahale</div>
          </div>

          <div style="background: rgba(0,0,0,0.3); padding: 0.75rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.04);">
            <div style="font-size: 0.62rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">ORT. ÇÖZÜM SÜRESİ</div>
            <div style="font-size: 0.92rem; font-weight: 800; color: #10b981; margin-top: 3px;">${avgDurationStr}</div>
            <div style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600; margin-top: 2px;">Saha Müdahalesi</div>
          </div>
        </div>
      </div>
    `;

    // Build Notes HTML
    let notesHtml = '';
    if (resolutionNotes.length > 0) {
      notesHtml = resolutionNotes.map(n => `
        <div style="padding: 14px 16px; background: rgba(15, 23, 42, 0.55); border-left: 3px solid var(--accent-cyan); border-radius: 0 16px 16px 0; margin-bottom: 12px; border-top: 1px solid rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.04); border-bottom: 1px solid rgba(255,255,255,0.04); transition: transform 0.2s, background 0.2s;" onmouseover="this.style.transform='translateX(4px)'; this.style.background='rgba(15, 23, 42, 0.8)';" onmouseout="this.style.transform=''; this.style.background='rgba(15, 23, 42, 0.55)';">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 0.74rem; font-weight: 700; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span style="color: #fff; font-weight: 800;">
                <i class="fa-regular fa-calendar" style="color: var(--accent-cyan); margin-right: 4px;"></i> ${n.dateStr}
              </span>
              <span style="color: var(--text-muted); opacity: 0.4;">|</span>
              <span style="color: var(--accent-orange); font-weight: 800;">
                <i class="fa-solid fa-wind" style="margin-right: 4px;"></i> ${n.siteName} (${n.turbineName})
              </span>
            </div>
            
            <span style="background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); padding: 2px 8px; border-radius: 6px; font-family: monospace; font-size: 0.72rem; font-weight: 800; border: 1px solid rgba(0, 242, 254, 0.2);">
              #${n.reportNo}
            </span>
          </div>

          <div style="color: #e2e8f0; font-size: 0.84rem; font-weight: 500; line-height: 1.55; word-break: break-word; background: rgba(0,0,0,0.25); padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.03); font-style: italic;">
            "${n.noteText}"
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.68rem; color: var(--text-muted); font-weight: 700;">
            <span>${n.personnelStr ? `<i class="fa-solid fa-user-group" style="margin-right: 4px;"></i> ${n.personnelStr}` : ''}</span>
            <span>Müdahale Eden: <strong style="color: var(--accent-cyan);">${n.teamName}</strong></span>
          </div>
        </div>
      `).join('');
    } else {
      notesHtml = `
        <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-dim); font-size: 0.82rem; font-style: italic; opacity: 0.6;">
          <i class="fa-solid fa-comment-slash" style="font-size: 2.5rem; margin-bottom: 0.6rem; display: block; color: var(--text-muted);"></i>
          Bu arıza müdahaleleri için detaylı bir metin notu kaydedilmemiş.
        </div>
      `;
    }

    // Render Full Two-Column Intelligence Dashboard
    container.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Action / Header Banner -->
        <div class="glass-panel" style="padding: 1.5rem 1.8rem; border-radius: 20px; background: linear-gradient(135deg, rgba(13, 20, 33, 0.85), rgba(20, 30, 50, 0.75)); border-left: 4px solid var(--accent-cyan); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; box-shadow: 0 10px 30px -10px rgba(0,0,0,0.5);">
          <div>
            <div style="font-size: 0.68rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1.5px; text-transform: uppercase; margin-bottom: 4px;">SORGULANAN ARIZA KODU</div>
            <div style="display: flex; align-items: baseline; gap: 12px; flex-wrap: wrap;">
              <span style="font-family: monospace; font-size: 2rem; font-weight: 900; color: var(--accent-cyan); letter-spacing: 1px;">${kod}</span>
              <span style="font-size: 1.15rem; font-weight: 700; color: #fff;">${titleText}</span>
            </div>
          </div>
        </div>

        <!-- 2-Column Responsive Layout -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; align-items: flex-start;">
          
          <!-- Left Column: Statistics & Used Materials -->
          <div style="display: flex; flex-direction: column; gap: 1.5rem;">
            ${statsHtml}

            <div class="glass-panel" style="padding: 1.5rem; border-radius: 20px; background: rgba(13, 20, 33, 0.5); border: 1px solid rgba(245, 158, 11, 0.25);">
              <div style="font-size: 0.74rem; color: #fbbf24; font-weight: 800; letter-spacing: 1px; margin-bottom: 1.2rem; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between;">
                <span><i class="fa-solid fa-wrench" style="margin-right: 5px;"></i> ÇÖZÜMDE DEĞİŞEN MALZEMELER</span>
                <span style="font-size: 0.68rem; color: var(--text-muted); font-weight: 600;">(Kullanım Sıklığına Göre)</span>
              </div>
              <div style="max-height: 480px; overflow-y: auto; padding-right: 4px;">
                ${materialsHtml}
              </div>
            </div>
          </div>

          <!-- Right Column: Colleague Field Notes & Experiences -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 20px; background: rgba(13, 20, 33, 0.5); border: 1px solid rgba(0, 242, 254, 0.25);">
            <div style="font-size: 0.74rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 1px; margin-bottom: 1.2rem; text-transform: uppercase; display: flex; align-items: center; justify-content: space-between;">
              <span><i class="fa-solid fa-clock-rotate-left" style="margin-right: 5px;"></i> SAHA MÜDAHALE ÇÖZÜM NOTLARI</span>
              <span style="background: rgba(0,242,254,0.1); color: var(--accent-cyan); padding: 2px 8px; border-radius: 6px; font-size: 0.68rem; font-weight: 800;">
                ${resolutionNotes.length} Çözüm Kaydı
              </span>
            </div>
            
            <div style="max-height: 600px; overflow-y: auto; padding-right: 6px;">
              ${notesHtml}
            </div>
          </div>

        </div>

      </div>
    `;

  } catch (err) {
    console.error("Fault library select error:", err);
    container.innerHTML = `
      <div class="glass-panel" style="padding: 2.5rem; border-radius: 22px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.04);">
        <i class="fa-solid fa-triangle-exclamation" style="color: var(--accent-red); font-size: 2.2rem; margin-bottom: 1rem;"></i>
        <h3 style="font-size: 1.1rem; color: #fff; font-weight: 800; margin-bottom: 0.5rem;">Sistem Hatası Oluştu</h3>
        <p style="font-size: 0.84rem; color: var(--text-muted); max-width: 500px; margin: 0 auto;">Veriler yüklenirken bir hata meydana geldi. Lütfen tekrar deneyiniz.</p>
      </div>
    `;
  }
};
