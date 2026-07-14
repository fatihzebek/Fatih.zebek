import { db } from '../firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export const ScadaResetLogsPage = async () => {
  const currentUserProfile = (window as any).currentUser;
  const isAdmin = currentUserProfile?.role === 'ADMIN';

  let resetLogsHtml = '';
  const logs: any[] = [];
  try {
    const q = query(collection(db, 'turbineResetRequests'), orderBy('requestedAt', 'desc'), limit(100));
    const querySnapshot = await getDocs(q);
    querySnapshot.forEach((doc) => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    if (logs.length === 0) {
      resetLogsHtml = `
        <tr>
          <td colspan="${isAdmin ? 8 : 7}" style="text-align: center; color: var(--text-muted); padding: 3rem; font-size: 0.9rem;">
            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 8px; color: var(--accent-orange);"></i> Henüz hiçbir reset isteği bulunmuyor.
          </td>
        </tr>
      `;
    } else {
      resetLogsHtml = logs.map(log => {
        const dateStr = log.requestedAt ? new Date(log.requestedAt).toLocaleString('tr-TR') : 'Bilinmiyor';
        let statusBadge = '';
        if (log.status === 'success') {
          statusBadge = `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); font-size: 0.7rem; padding: 2px 8px;">BAŞARILI</span>`;
        } else if (log.status === 'failed') {
          statusBadge = `<span class="badge" style="background: rgba(239, 68, 68, 0.15); color: var(--accent-red); border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.7rem; padding: 2px 8px;">BAŞARISIZ</span>`;
        } else if (log.status === 'processing') {
          statusBadge = `<span class="badge" style="background: rgba(245, 158, 11, 0.15); color: var(--accent-orange); border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.7rem; padding: 2px 8px;"><i class="fa-solid fa-spinner fa-spin"></i> İŞLENİYOR</span>`;
        } else {
          statusBadge = `<span class="badge" style="background: rgba(156, 163, 175, 0.15); color: #9ca3af; border: 1px solid rgba(156, 163, 175, 0.3); font-size: 0.7rem; padding: 2px 8px;">BEKLEMEDE</span>`;
        }

        return `
          <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;">
            <td style="padding: 12px 10px; color: var(--text-main); font-weight: 500;">${dateStr}</td>
            <td style="padding: 12px 10px; color: #fff;">${log.requestedBy || 'Bilinmeyen Kullanıcı'}</td>
            <td style="padding: 12px 10px; color: var(--accent-cyan); font-weight: 700;">${log.siteName || log.siteId || '-'}</td>
            <td style="padding: 12px 10px; color: #fff; font-weight: bold;">${log.turbineId || log.no || '-'}</td>
            <td style="padding: 12px 10px; color: var(--text-muted); font-family: monospace;">${log.serial || '-'}</td>
            <td style="padding: 12px 10px;">${statusBadge}</td>
            <td style="padding: 12px 10px; color: ${log.status === 'failed' ? 'var(--accent-red)' : 'var(--text-muted)'}; max-width: 350px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${log.error || ''}">${log.error || '-'}</td>
            ${isAdmin ? `
              <td style="padding: 12px 10px; text-align: center;">
                <button class="action-icon-btn red" onclick="window.deleteResetLog('${log.id}')" title="Log kaydını sil" style="margin: 0 auto; background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </td>
            ` : ''}
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error("Error loading reset logs:", err);
    resetLogsHtml = `
      <tr>
        <td colspan="${isAdmin ? 8 : 7}" style="text-align: center; color: var(--accent-red); padding: 3rem;">Günlükler yüklenirken bir hata oluştu: ${err}</td>
      </tr>
    `;
  }

  // Register action functions on window
  (window as any).deleteResetLog = async (logId: string) => {
    if (!confirm("Bu reset günlüğü kaydını silmek istediğinize emin misiniz?")) return;
    try {
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'turbineResetRequests', logId));
      (window as any).showToast('Başarılı', 'Log kaydı silindi.', 'success');
      (window as any).navigate('scada-reset-logs');
    } catch (err) {
      console.error(err);
      (window as any).showToast('Hata', 'Kayıt silinemedi: ' + err, 'error');
    }
  };

  (window as any).clearAllResetLogs = async () => {
    if (!confirm("Tüm reset günlüğü geçmişini silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!")) return;
    try {
      const { getDocs, writeBatch, doc } = await import('firebase/firestore');
      const querySnapshot = await getDocs(collection(db, 'turbineResetRequests'));
      const batch = writeBatch(db);
      querySnapshot.forEach((document) => {
        batch.delete(doc(db, 'turbineResetRequests', document.id));
      });
      await batch.commit();
      (window as any).showToast('Başarılı', 'Tüm log geçmişi temizlendi.', 'success');
      (window as any).navigate('scada-reset-logs');
    } catch (err) {
      console.error(err);
      (window as any).showToast('Hata', 'Loglar temizlenirken hata oluştu: ' + err, 'error');
    }
  };

  // Render Charts in background
  if (logs.length > 0) {
    setTimeout(async () => {
      const turbineCounts: Record<string, number> = {};
      const siteCounts: Record<string, number> = {};
      
      logs.forEach(log => {
        const site = log.siteName || log.siteId || 'Bilinmeyen Saha';
        const turbine = log.turbineId || log.no || '-';
        const turbineKey = `${site} T-${turbine}`;
        
        turbineCounts[turbineKey] = (turbineCounts[turbineKey] || 0) + 1;
        siteCounts[site] = (siteCounts[site] || 0) + 1;
      });

      // Top 5 Turbines
      const sortedTurbines = Object.entries(turbineCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

      const turbineLabels = sortedTurbines.map(t => t[0]);
      const turbineValues = sortedTurbines.map(t => t[1]);

      // Sites
      const siteLabels = Object.keys(siteCounts);
      const siteValues = Object.values(siteCounts);

      try {
        const { Chart, registerables } = await import('chart.js');
        Chart.register(...registerables);

        // Turbine Chart
        const tCanvas = document.getElementById('reset-turbines-chart') as HTMLCanvasElement;
        if (tCanvas) {
          new Chart(tCanvas, {
            type: 'bar',
            data: {
              labels: turbineLabels,
              datasets: [{
                label: 'Reset Sayısı',
                data: turbineValues,
                backgroundColor: 'rgba(0, 243, 255, 0.2)',
                borderColor: '#00f3ff',
                borderWidth: 1.5,
                borderRadius: 6,
                hoverBackgroundColor: 'rgba(0, 243, 255, 0.4)',
                hoverBorderColor: '#00f3ff'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  backgroundColor: 'rgba(13, 18, 30, 0.95)',
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  borderColor: 'rgba(0, 243, 255, 0.3)',
                  borderWidth: 1
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  grid: { color: 'rgba(255,255,255,0.03)' },
                  ticks: { color: '#94a3b8', font: { family: 'Rajdhani', size: 11, weight: 'bold' } }
                },
                x: {
                  grid: { display: false },
                  ticks: { color: '#94a3b8', font: { family: 'Rajdhani', size: 10, weight: 'bold' } }
                }
              }
            }
          });
        }

        // Site Chart
        const sCanvas = document.getElementById('reset-sites-chart') as HTMLCanvasElement;
        if (sCanvas) {
          const siteColorsMap: Record<string, { bg: string, border: string }> = {
            'Anemon İntepe': { bg: 'rgba(0, 243, 255, 0.35)', border: '#00f3ff' },
            'Alize Sarıkaya': { bg: 'rgba(179, 127, 235, 0.35)', border: '#b37feb' },
            'Doğal Sayalar': { bg: 'rgba(16, 185, 129, 0.35)', border: '#10b981' },
            'Alize Kuyucak': { bg: 'rgba(245, 158, 11, 0.35)', border: '#f59e0b' }
          };

          const siteColors = siteLabels.map(label => {
            const matchedKey = Object.keys(siteColorsMap).find(k => label.includes(k) || k.includes(label));
            return matchedKey ? siteColorsMap[matchedKey] : { bg: 'rgba(156, 163, 175, 0.35)', border: '#9ca3af' };
          });

          const siteBgs = siteColors.map(c => c.bg);
          const siteBorders = siteColors.map(c => c.border);

          new Chart(sCanvas, {
            type: 'doughnut',
            data: {
              labels: siteLabels,
              datasets: [{
                data: siteValues,
                backgroundColor: siteBgs,
                borderColor: siteBorders,
                borderWidth: 1.5
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              layout: {
                padding: {
                  top: 10,
                  bottom: 15,
                  left: 10,
                  right: 10
                }
              },
              plugins: {
                legend: {
                  position: 'right',
                  labels: {
                    color: '#94a3b8',
                    font: { family: 'Rajdhani', size: 11, weight: 'bold' },
                    boxWidth: 12
                  }
                },
                tooltip: {
                  backgroundColor: 'rgba(13, 18, 30, 0.95)',
                  titleColor: '#fff',
                  bodyColor: '#fff',
                  borderColor: 'rgba(0, 243, 255, 0.2)',
                  borderWidth: 1
                }
              }
            }
          });
        }
      } catch (chartErr) {
        console.error("Failed to render reset charts:", chartErr);
      }
    }, 100);
  }

  return `
    <div class="fade-in-up content-area">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 1rem;">
        <h1 class="page-title" style="margin-bottom: 0; text-shadow: 0 0 15px rgba(0, 243, 255, 0.2);">
          <i class="fa-solid fa-bolt" style="color: var(--accent-cyan); margin-right: 8px;"></i> SCADA Türbin Reset Günlükleri
        </h1>
        <div style="display: flex; gap: 10px;">
          ${isAdmin ? `
            <button class="btn-cyber" onclick="window.clearAllResetLogs()" style="background: rgba(239, 68, 68, 0.05); border-color: rgba(239, 68, 68, 0.25); color: #ef4444; font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-trash-can"></i> TÜMÜNÜ TEMİZLE
            </button>
          ` : ''}
          <button class="btn-cyber" onclick="window.navigate('scada-reset-logs')" style="background: rgba(0, 243, 255, 0.05); border-color: rgba(0, 243, 255, 0.25); color: var(--accent-cyan); font-size: 0.8rem; font-weight: bold; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-rotate"></i> YENİLE
          </button>
        </div>
      </div>

      <!-- Reset Analiz Grafik Paneli -->
      ${logs.length > 0 ? `
        <div style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 1.5rem; margin-bottom: 2rem;">
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 12px; height: 320px; display: flex; flex-direction: column; background: rgba(13, 18, 30, 0.45); box-sizing: border-box;">
            <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; text-shadow: 0 0 10px rgba(0, 243, 255, 0.25);">
              <i class="fa-solid fa-chart-bar"></i> EN ÇOK RESET ATILAN TÜRBİNLER (TOP 5)
            </h3>
            <div style="position: relative; height: 210px; width: 100%;">
              <canvas id="reset-turbines-chart"></canvas>
            </div>
          </div>
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 12px; height: 320px; display: flex; flex-direction: column; background: rgba(13, 18, 30, 0.45); box-sizing: border-box;">
            <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px; text-transform: uppercase; text-shadow: 0 0 10px rgba(0, 243, 255, 0.25);">
              <i class="fa-solid fa-chart-pie"></i> SAHA BAZLI RESET DAĞILIMI
            </h3>
            <div style="position: relative; height: 210px; width: 100%; display: flex; justify-content: center; align-items: center;">
              <canvas id="reset-sites-chart"></canvas>
            </div>
          </div>
        </div>
      ` : ''}

      <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow-x: auto; box-shadow: 0 0 20px rgba(0,0,0,0.4);">
        <table class="cyber-table" style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-weight: bold; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <th style="padding: 12px 10px;">Tarih</th>
              <th style="padding: 12px 10px;">Kullanıcı</th>
              <th style="padding: 12px 10px;">Saha</th>
              <th style="padding: 12px 10px;">Türbin</th>
              <th style="padding: 12px 10px;">Seri No</th>
              <th style="padding: 12px 10px;">Durum</th>
              <th style="padding: 12px 10px;">Açıklama / Hata Mesajı</th>
              ${isAdmin ? '<th style="padding: 12px 10px; text-align: center; width: 80px;">İşlem</th>' : ''}
            </tr>
          </thead>
          <tbody>
            ${resetLogsHtml}
          </tbody>
        </table>
      </div>

      <style>
        .cyber-row:hover {
          background: rgba(0, 243, 255, 0.03) !important;
        }
        .action-icon-btn.red:hover {
          color: #ff4d4d !important;
          background: rgba(255, 77, 77, 0.1) !important;
        }
      </style>
    </div>
  `;
};

