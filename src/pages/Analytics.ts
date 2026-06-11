import { analyticsService } from '../services/AnalyticsService';
import { serviceReportService } from '../services/ServiceReportService';
import { taskService } from '../services/TaskService';
import { dataService } from '../services/DataService';
import { agentHealthService } from '../services/AgentHealthService';
import * as XLSX from 'xlsx';

export const AnalyticsPage = async () => {
  const currentPeriod = localStorage.getItem('analytics_period') || 'this-month';
  const allReports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
  let reports = [...allReports];
  const tasks = await taskService.getTasks();

  // Period Filtering Logic
  const now = new Date();
  reports = reports.filter(r => {
    const rDate = new Date(r.date);
    if (currentPeriod === 'this-week') {
      const monday = new Date(now);
      monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
      monday.setHours(0, 0, 0, 0);
      return rDate >= monday;
    } else if (currentPeriod === 'this-month') {
      return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'last-month') {
      const lastMonth = new Date(now);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
    } else if (currentPeriod === 'this-year') {
      return rDate.getFullYear() === now.getFullYear();
    } else if (currentPeriod === 'custom') {
      const startStr = localStorage.getItem('analytics_start');
      const endStr = localStorage.getItem('analytics_end');
      if (startStr && endStr) {
        const start = new Date(startStr);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        return rDate >= start && rDate <= end;
      }
      return true;
    }
    return true;
  });

  const data = analyticsService.generateUnifiedAnalysis(reports, tasks);

  // Filter & Refresh function
  (window as any).setAnalyticsPeriod = (period: string) => {
    localStorage.setItem('analytics_period', period);
    (window as any).navigate('analytics');
  };

  (window as any).setCustomAnalyticsPeriod = () => {
    const start = (document.getElementById('analytics-start') as HTMLInputElement)?.value;
    const end = (document.getElementById('analytics-end') as HTMLInputElement)?.value;
    if (start && end) {
      localStorage.setItem('analytics_start', start);
      localStorage.setItem('analytics_end', end);
      (window as any).setAnalyticsPeriod('custom');
    } else {
      (window as any).showToast?.('EKSİK TARİH', 'Lütfen başlangıç ve bitiş tarihlerini seçiniz.', 'error') || alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
    }
  };

  (window as any).voidOvertime = async (reportId: string, personnelName: string) => {
    if (!confirm(`${personnelName} adlı personelin bu mesai kaydı sıfırlanacak. Onaylıyor musunuz?`)) return;
    try {
      const { doc, getDoc, updateDoc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const ref = doc(db, 'service_reports', reportId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const existing = snap.data().voidedOvertimes || [];
        if (!existing.includes(personnelName)) {
          await updateDoc(ref, { voidedOvertimes: [...existing, personnelName] });
        }
        (window as any).showToast?.('BAŞARILI', 'Mesai kaydı sıfırlandı. Sayfa güncelleniyor...', 'success');
        setTimeout(() => window.location.reload(), 1500);
      }
    } catch (e) {
      console.error(e);
      alert("İşlem sırasında hata oluştu.");
    }
  };
  
  (window as any).applyModalDateFilter = () => {
    const s = (document.getElementById('modal-analytics-start') as HTMLInputElement).value;
    const e = (document.getElementById('modal-analytics-end') as HTMLInputElement).value;
    if (s && e) {
      localStorage.setItem('analytics_start', s);
      localStorage.setItem('analytics_end', e);
      (window as any).setAnalyticsPeriod('custom');
      const modal = document.querySelector('.cyber-modal-overlay');
      if (modal) modal.remove();
    } else {
      (window as any).showToast?.('HATA', 'Lütfen başlangıç ve bitiş tarihi seçin.', 'error') || alert('Lütfen başlangıç ve bitiş tarihi seçin.');
    }
  };
  
  // Mesai Detaylarını Göster
  (window as any).showOvertimeDetails = () => {
    const details = data.overtimeDetails;
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    const content = `
      <div class="glass-panel" style="width: 90%; max-width: 1000px; max-height: 85vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-orange); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-orange); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
          <i class="fa-solid fa-clock-rotate-left"></i> 18:00 SONRASI MESAİ DETAYLARI
        </h3>

        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1.5rem; background: rgba(0,0,0,0.2); padding: 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-calendar-days" style="color: var(--text-muted);"></i>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">TARİH ARALIĞI:</span>
          </div>
          <input type="date" id="modal-analytics-start" class="cyber-input" style="padding: 0.5rem; max-width: 150px;" value="${localStorage.getItem('analytics_start') || ''}">
          <span style="color: var(--text-muted);"> - </span>
          <input type="date" id="modal-analytics-end" class="cyber-input" style="padding: 0.5rem; max-width: 150px;" value="${localStorage.getItem('analytics_end') || ''}">
          <button onclick="window.applyModalDateFilter()" class="btn-cyber-mini" style="padding: 0.5rem 1rem;">FİLTRELE</button>
        </div>

        <div style="overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>TARİH</th>
                <th>PERSONEL</th>
                <th style="text-align: center;">TÜRBİN</th>
                <th style="text-align: center;">MESAİ ARALIĞI</th>
                <th style="text-align: center;">SÜRE</th>
                <th style="text-align: right;">RAPOR</th>
                ${(window as any).currentUser?.role === 'ADMIN' ? '<th style="text-align: right; width: 60px;">İŞLEM</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${details.length > 0 ? details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => `
                <tr>
                  <td style="font-weight: 600;">${new Date(d.date).toLocaleDateString('tr-TR')}</td>
                  <td style="color: var(--text-main); font-weight: 700;">${d.personnelName}</td>
                  <td style="text-align: center; color: var(--accent-cyan); font-weight: 800;">
                    ${(d.siteName ? d.siteName + ' ' : '') + (d.turbineNo || d.turbineSerial)}
                  </td>
                  <td style="text-align: center; font-family: monospace; letter-spacing: 1px;">
                    <span style="color: var(--text-muted);">${d.startTime}</span> 
                    <i class="fa-solid fa-arrow-right" style="font-size: 0.6rem; margin: 0 5px; opacity: 0.3;"></i> 
                    <span style="color: var(--accent-orange);">${d.endTime}</span>
                  </td>
                  <td style="text-align: center; font-weight: 900; color: var(--accent-orange);">+${d.overtimeHours} h</td>
                  <td style="text-align: right; font-size: 0.7rem; color: var(--text-muted); opacity: 0.5;">#${d.reportId.slice(-6)}</td>
                  ${(window as any).currentUser?.role === 'ADMIN' ? `<td style="text-align: right;"><button onclick="window.voidOvertime('${d.reportId}', '${d.personnelName}')" class="btn-cyber-mini" style="padding: 2px 8px; color: #ff4d4d; border-color: rgba(255, 77, 77, 0.3); background: rgba(255,0,0,0.1);" title="Mesaiyi Sıfırla"><i class="fa-solid fa-trash"></i></button></td>` : ''}
                </tr>
              `).join('') : `<tr><td colspan="${(window as any).currentUser?.role === 'ADMIN' ? '7' : '6'}" style="text-align: center; padding: 3rem; color: var(--text-muted);">Henüz mesai kaydı bulunmamaktadır.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 1rem;">
          <button class="btn-cyber-mini" onclick="window.exportOvertimeToExcel()" style="background: rgba(34, 197, 94, 0.1); border-color: var(--accent-green); color: var(--accent-green);">
            <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i> EXCEL OLARAK İNDİR
          </button>
          <button class="btn-cyber-mini" onclick="this.closest('.cyber-modal-overlay').remove()">KAPAT</button>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
  };

  // Ekip Müdahale Hızı Analizi Göster
  (window as any).showTeamSpeedAnalysis = () => {
    const allArizaReports = allReports.filter(r => r.type === 'ARIZA');
    const filteredArizaReports = reports.filter(r => r.type === 'ARIZA');
    
    const faultAverages: Record<string, { totalHrs: number, count: number, avg: number }> = {};
    allArizaReports.forEach(r => {
        const code = r.faultCode || r.faultDesc;
        if (!code) return;
        
        let [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
        let hrs = h + (m / 60);
        
        if ((isNaN(hrs) || hrs <= 0) && r.workSessions && r.workSessions.length > 0) {
            hrs = 0;
            r.workSessions.forEach((ws: any) => {
                const [wh, wm] = (ws.duration || '00:00').split(':').map(Number);
                hrs += wh + (wm / 60);
            });
        }
        
        if (isNaN(hrs) || hrs <= 0) return;
        
        if (!faultAverages[code]) faultAverages[code] = { totalHrs: 0, count: 0, avg: 0 };
        faultAverages[code].totalHrs += hrs;
        faultAverages[code].count++;
    });
    
    Object.keys(faultAverages).forEach(k => {
        if (faultAverages[k].count > 1) {
            faultAverages[k].avg = faultAverages[k].totalHrs / faultAverages[k].count;
        } else {
            delete faultAverages[k];
        }
    });

    const formatHHMM = (decimalHours: number) => {
        if (isNaN(decimalHours) || decimalHours < 0) return '0:00';
        const totalMinutes = Math.round(decimalHours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    const speedRows: any[] = [];
    filteredArizaReports.forEach(r => {
        const code = r.faultCode || r.faultDesc;
        if (!code || !faultAverages[code]) return;
        
        const avg = faultAverages[code].avg;
        
        let reportHrs = 0;
        let [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
        reportHrs = h + (m / 60);
        
        if ((isNaN(reportHrs) || reportHrs <= 0) && r.workSessions && r.workSessions.length > 0) {
            reportHrs = 0;
            r.workSessions.forEach((ws: any) => {
                const [wh, wm] = (ws.duration || '00:00').split(':').map(Number);
                reportHrs += wh + (wm / 60);
            });
        }
        
        if (!isNaN(reportHrs) && reportHrs > 0) {
            speedRows.push({
                date: r.date,
                personnel: (r.personnel || []).join(', '),
                siteAndTurbine: (r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial),
                faultCode: code,
                reportId: r.id,
                hrs: reportHrs,
                avg: avg
            });
        }
    });

    const groupedByFault: Record<string, { code: string, avg: number, totalMudahale: number, reports: any[] }> = {};

    speedRows.forEach(row => {
       if (!groupedByFault[row.faultCode]) {
           groupedByFault[row.faultCode] = { code: row.faultCode, avg: row.avg, totalMudahale: faultAverages[row.faultCode].count, reports: [] };
       }
       groupedByFault[row.faultCode].reports.push(row);
    });

    const faultHtml = Object.keys(groupedByFault).length > 0 ? Object.values(groupedByFault).sort((a,b) => b.totalMudahale - a.totalMudahale).map(fault => {
       fault.reports.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());

       return `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 1rem; overflow: hidden; transition: all 0.3s ease;">
           <h4 onclick="const content = this.nextElementSibling; const icon = this.querySelector('.chevron-icon'); if(content.style.display === 'none'){content.style.display = 'block'; icon.style.transform = 'rotate(180deg)'; this.style.background = 'rgba(0, 242, 254, 0.05)';}else{content.style.display = 'none'; icon.style.transform = 'rotate(0deg)'; this.style.background = 'transparent';}" style="color: var(--accent-cyan); margin: 0; padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; user-select: none; transition: background 0.3s ease;">
              <span style="display: flex; align-items: center; gap: 0.75rem;">
                <i class="fa-solid fa-chevron-down chevron-icon" style="font-size: 0.9rem; transition: transform 0.3s ease; color: var(--text-muted);"></i>
                <i class="fa-solid fa-wrench"></i> ARIZA KODU: ${fault.code}
              </span>
              <span style="font-size: 0.85rem; color: var(--text-muted); background: rgba(0,0,0,0.3); padding: 4px 12px; border-radius: 12px;">Genel Ortalama: <strong style="color: var(--accent-orange);">${formatHHMM(fault.avg)}</strong> (${fault.totalMudahale} Kayıt)</span>
           </h4>
           <div style="display: none; padding: 0 1.5rem 1.5rem 1.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
             <table class="cyber-table" style="font-size: 0.85rem; margin-top: 1rem;">
               <thead>
                 <tr>
                   <th>TARİH</th>
                   <th style="text-align: center;">SAHA / TÜRBİN</th>
                   <th>MÜDAHALE EDEN EKİP</th>
                   <th style="text-align: center;">MÜDAHALE SÜRESİ</th>
                   <th style="text-align: center;">HIZ / PERFORMANS</th>
                   <th style="text-align: right;">RAPOR NO</th>
                 </tr>
               </thead>
               <tbody>
                 ${fault.reports.map(r => {
                     const rDate = new Date(r.date);
                     rDate.setHours(0,0,0,0);
                     const rTime = rDate.getTime();
                     
                     const isRepeated = fault.reports.some(newer => {
                         if (newer.reportId === r.reportId || newer.siteAndTurbine !== r.siteAndTurbine) return false;
                         const newerDate = new Date(newer.date);
                         newerDate.setHours(0,0,0,0);
                         const diffDays = (newerDate.getTime() - rTime) / (1000 * 60 * 60 * 24);
                         return diffDays > 0 && diffDays <= 2;
                     });

                     const isFixingRepeat = fault.reports.some(older => {
                         if (older.reportId === r.reportId || older.siteAndTurbine !== r.siteAndTurbine) return false;
                         const olderDate = new Date(older.date);
                         olderDate.setHours(0,0,0,0);
                         const diffDays = (rTime - olderDate.getTime()) / (1000 * 60 * 60 * 24);
                         return diffDays > 0 && diffDays <= 2;
                     });

                     let perfHtml = '';
                     if (isFixingRepeat && !isRepeated) {
                         perfHtml = `<span title="Tekrarlayan bir arızaya müdahale edip kalıcı çözüm sağlandı. Kök neden tespiti süresi norm olarak kabul edilir." style="color: #fbbf24; font-weight: 800; background: rgba(251, 191, 36, 0.1); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(251, 191, 36, 0.3);"><i class="fa-solid fa-award"></i> KALICI ÇÖZÜM</span>`;
                     } else {
                         const ratio = r.hrs / fault.avg;
                         if (ratio < 0.85) {
                             const pct = Math.round((1 - ratio) * 100);
                             perfHtml = `<span style="color: var(--accent-green); font-weight: 800; background: rgba(34, 197, 94, 0.1); padding: 4px 8px; border-radius: 4px;">🚀 %${pct} HIZLI</span>`;
                         } else if (ratio > 1.15) {
                             const pct = Math.round((ratio - 1) * 100);
                             perfHtml = `<span style="color: #ef4444; font-weight: 800; background: rgba(239, 68, 68, 0.1); padding: 4px 8px; border-radius: 4px;">🐢 %${pct} YAVAŞ</span>`;
                         } else {
                             perfHtml = `<span style="color: var(--text-muted); font-weight: 700;">~ NORM</span>`;
                         }
                     }

                     if (isRepeated) {
                         perfHtml = `
                           <div style="display: flex; flex-direction: column; gap: 4px; align-items: center;">
                              ${perfHtml}
                              <span title="Bu müdahaleden sonraki 48 saat içinde arıza aynı türbinde tekrar etti! Kalıcı çözüm sağlanamamış olabilir." style="color: #f59e0b; font-size: 0.7rem; font-weight: 800; background: rgba(245, 158, 11, 0.1); padding: 2px 6px; border-radius: 4px; border: 1px dashed #f59e0b; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-rotate-right"></i> TEKRAR ETTİ</span>
                           </div>
                         `;
                     }

                    return `
                      <tr>
                        <td style="font-weight: 600; color: var(--text-muted);">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
                        <td style="text-align: center; color: var(--accent-cyan); font-weight: 700;">${r.siteAndTurbine}</td>
                        <td style="font-weight: 700; color: var(--text-main);">${r.personnel}</td>
                        <td style="text-align: center; color: var(--accent-cyan); font-weight: 800;">${formatHHMM(r.hrs)}</td>
                        <td style="text-align: center;">${perfHtml}</td>
                        <td style="text-align: right;">
                          <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${r.reportId}'), 300); this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="padding: 2px 8px; background: rgba(0, 242, 254, 0.1); border-color: var(--accent-cyan); color: var(--text-muted);" title="Raporu Aç">
                            #${r.reportId.slice(-6)} <i class="fa-solid fa-arrow-up-right-from-square" style="margin-left: 4px; color: var(--accent-cyan);"></i>
                          </button>
                        </td>
                      </tr>
                    `;
                 }).join('')}
               </tbody>
             </table>
           </div>
        </div>
       `;
    }).join('') : `<div style="text-align: center; padding: 3rem; color: var(--text-muted);">Analiz edilebilir (en az 2 defa tekrarlanmış) arıza kaydı bulunmamaktadır.</div>`;

    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    const content = `
      <div class="glass-panel" style="width: 95%; max-width: 1200px; max-height: 85vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-green); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-green); margin-bottom: 1rem; display: flex; align-items: center; gap: 0.75rem;">
          <i class="fa-solid fa-gauge-high"></i> ARIZA KODLARINA GÖRE EKİP HIZ VE PERFORMANS LİDERLİĞİ
        </h3>

        <div style="overflow-y: auto; flex: 1; padding-right: 1rem;" class="custom-scrollbar">
          ${faultHtml}
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
  };

  // Personel Detaylarını (Modal) Göster
  (window as any).showPersonnelDetails = (personnelName: string, startStr?: string, endStr?: string) => {
    const existing = document.getElementById('personnel-details-modal');
    if (existing) existing.remove();

    const upperName = personnelName.toUpperCase();
    let pReports = reports.filter(r => 
        r.personnel && r.personnel.some((name: string) => name.toUpperCase() === upperName)
    );

    if (startStr && endStr) {
        const start = new Date(startStr); start.setHours(0,0,0,0);
        const end = new Date(endStr); end.setHours(23,59,59,999);
        pReports = pReports.filter(r => {
            if(!r.date) return false;
            const d = new Date(r.date);
            return d >= start && d <= end;
        });
    }

    pReports.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const modal = document.createElement('div');
    modal.id = 'personnel-details-modal';
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    const getHours = (r: any) => {
        let hours = 0;
        if (r.workSessions && r.workSessions.length > 0) {
            r.workSessions.forEach((ws: any) => {
                if (ws.personnel && ws.personnel.some((name: string) => name.toUpperCase() === upperName)) {
                    const [h, m] = (ws.duration || '00:00').split(':').map(Number);
                    hours += h + (m / 60);
                }
            });
        } else {
            const [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
            hours = h + (m / 60);
        }
        return isNaN(hours) ? 0 : Number(hours.toFixed(1));
    };

    const isRepeat = (r: any) => {
        if (r.type !== 'ARIZA') return false;
        const reportDate = new Date(r.date);
        const sevenDaysLater = new Date(reportDate.getTime() + (7 * 24 * 60 * 60 * 1000));
        return reports.some(otherR => 
            otherR.id !== r.id && 
            otherR.turbineSerial === r.turbineSerial && 
            otherR.type === 'ARIZA' &&
            new Date(otherR.date) > reportDate &&
            new Date(otherR.date) <= sevenDaysLater
        );
    };

    const formatHHMM = (decimalHours: number) => {
        if (isNaN(decimalHours) || decimalHours < 0) return '0:00';
        const totalMinutes = Math.round(decimalHours * 60);
        const h = Math.floor(totalMinutes / 60);
        const m = totalMinutes % 60;
        return `${h}:${m.toString().padStart(2, '0')}`;
    };

    (window as any).filterPModal = () => {
        const s = (document.getElementById('p-modal-start') as HTMLInputElement).value;
        const e = (document.getElementById('p-modal-end') as HTMLInputElement).value;
        if (s && e) {
            (window as any).showPersonnelDetails(personnelName, s, e);
        }
    };

    (window as any).filterPModalQuick = (days: number) => {
        const end = new Date();
        const start = new Date();
        start.setDate(end.getDate() - days);
        const sStr = start.toISOString().split('T')[0];
        const eStr = end.toISOString().split('T')[0];
        (window as any).showPersonnelDetails(personnelName, sStr, eStr);
    };

    const getFaultAverage = (r: any) => {
        if (r.type !== 'ARIZA') return null;
        const code = r.faultCode || r.faultDesc;
        if (!code) return null;
        
        const matchingReports = allReports.filter((or: any) => 
            or.type === 'ARIZA' && 
            (or.faultCode === code || or.faultDesc === code)
        );
        
        if (matchingReports.length < 2) return null;
        
        let totalHrs = 0;
        let count = 0;
        matchingReports.forEach((mr: any) => {
            let [h, m] = (mr.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
            let hrs = h + (m / 60);
            
            if ((isNaN(hrs) || hrs <= 0) && mr.workSessions && mr.workSessions.length > 0) {
                hrs = 0;
                mr.workSessions.forEach((ws: any) => {
                    const [wh, wm] = (ws.duration || '00:00').split(':').map(Number);
                    hrs += wh + (wm / 60);
                });
            }

            if (!isNaN(hrs) && hrs > 0) {
                totalHrs += hrs;
                count++;
            }
        });
        
        return count > 0 ? (totalHrs / count) : null;
    };

    let totalFilteredHours = 0;
    const rowsHtml = pReports.map(r => {
        const rep = isRepeat(r);
        const hrs = getHours(r);
        totalFilteredHours += hrs;
        const badgeColor = r.type === 'BAKIM' ? 'var(--accent-green)' : 'var(--accent-blue)';
        const badgeBg = r.type === 'BAKIM' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)';
        
        const avg = getFaultAverage(r);
        let perfHtml = `<span style="color: var(--text-muted); opacity: 0.3;">-</span>`;
        if (avg !== null && r.type === 'ARIZA' && hrs > 0) {
            const ratio = hrs / avg;
            if (ratio < 0.85) {
                const p = Math.round((1 - ratio) * 100);
                perfHtml = `<span title="Genel ortalamadan (${formatHHMM(avg)}) %${p} daha hızlı" style="color: var(--accent-green); font-size: 0.75rem; font-weight: 800; background: rgba(34, 197, 94, 0.1); padding: 2px 6px; border-radius: 4px;">🚀 %${p} HIZLI</span>`;
            } else if (ratio > 1.15) {
                const p = Math.round((ratio - 1) * 100);
                perfHtml = `<span title="Genel ortalamadan (${formatHHMM(avg)}) %${p} daha yavaş" style="color: #ef4444; font-size: 0.75rem; font-weight: 800; background: rgba(239, 68, 68, 0.1); padding: 2px 6px; border-radius: 4px;">🐢 %${p} YAVAŞ</span>`;
            } else {
                perfHtml = `<span title="Genel ortalama hızda (${formatHHMM(avg)})" style="color: var(--text-muted); font-size: 0.75rem; font-weight: 700;">~ NORM</span>`;
            }
        }

        return `
        <tr>
          <td style="font-weight: 600;">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
          <td style="text-align: center;">
            <span class="badge" style="background: ${badgeBg}; color: ${badgeColor}; border: 1px solid ${badgeColor}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; max-width: 150px; display: inline-block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; vertical-align: middle;" title="${r.type === 'ARIZA' ? (r.faultCode || r.faultDesc || r.type) : r.type}">
              ${r.type === 'ARIZA' ? (r.faultCode || r.faultDesc || r.type) : r.type}
            </span>
          </td>
          <td style="text-align: center; color: var(--accent-cyan); font-weight: 800;">
            ${(r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial)}
          </td>
          <td style="text-align: center;">
            ${rep ? '<span title="Aynı türbinde 7 gün içinde tekrar eden arıza tespit edildi!" style="color: #ef4444; font-size: 1.1rem; cursor: help;">🚩</span>' : '<span style="color: var(--text-muted); opacity: 0.3;">-</span>'}
          </td>
          <td style="text-align: center; font-weight: 900; color: var(--accent-cyan);">${formatHHMM(hrs)}</td>
          <td style="text-align: center;">${perfHtml}</td>
          <td style="text-align: right;">
            <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${r.id}'), 300); document.getElementById('personnel-details-modal').remove()" class="btn-cyber-mini" style="padding: 4px 10px; background: rgba(0, 242, 254, 0.1); border-color: var(--accent-cyan); color: var(--accent-cyan);" title="PDF Görüntüle">
              <i class="fa-solid fa-file-pdf"></i>
            </button>
          </td>
        </tr>
      `}).join('');

    let days = 1;
    if (startStr && endStr) {
        const s = new Date(startStr);
        const e = new Date(endStr);
        days = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    } else if (pReports.length > 0) {
        const dates = pReports.map(r => new Date(r.date).getTime()).filter(t => !isNaN(t));
        if (dates.length > 0) {
            const min = Math.min(...dates);
            const max = Math.max(...dates);
            days = Math.max(1, Math.round((max - min) / (1000 * 60 * 60 * 24)) + 1);
        }
    }
    
    // Türkiye Yasal Çalışma Süresi: Aylık 225 Saat -> Günlük 7.5 Saat
    const targetHours = days * 7.5; 
    const effortRatio = targetHours > 0 ? (totalFilteredHours / targetHours) * 100 : 0;
    
    let barColor = "var(--accent-green)";
    if (effortRatio > 80) barColor = "var(--accent-cyan)";
    if (effortRatio > 100) barColor = "var(--accent-orange)";
    if (effortRatio > 120) barColor = "var(--accent-red)";

    const content = `
      <div class="glass-panel" style="width: 90%; max-width: 1000px; max-height: 85vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-cyan); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-cyan); margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <i class="fa-solid fa-user-gear"></i> ${personnelName.toUpperCase()} - GÖREV GEÇMİŞİ
          </div>
          <div style="font-size: 1.1rem; color: #fff; background: rgba(255,255,255,0.05); padding: 0.5rem 1rem; border-radius: 8px; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
            <div>TOPLAM EFOR: <span style="color: var(--accent-cyan); font-weight: 900;">${formatHHMM(totalFilteredHours)}</span></div>
            <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; align-items: center; gap: 6px;" title="Türkiye yasal çalışma süresine göre (Aylık 225 saat / Günlük 7.5 saat) kapasite kullanımı">
              <span style="font-family: monospace;">KAPASİTE KULLANIMI: <strong style="color: ${barColor}">%${Math.round(effortRatio)}</strong></span>
              <div style="width: 60px; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden;">
                <div style="width: ${Math.min(100, effortRatio)}%; height: 100%; background: ${barColor};"></div>
              </div>
            </div>
          </div>
        </h3>

        <div style="display: flex; gap: 1rem; align-items: center; margin-bottom: 1rem; background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <i class="fa-solid fa-calendar-days" style="color: var(--text-muted);"></i>
            <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: 700;">TARİH ARALIĞI:</span>
          </div>
          <input type="date" id="p-modal-start" class="cyber-input" style="padding: 0.5rem; max-width: 150px;" value="${startStr || ''}">
          <span style="color: var(--text-muted);"> - </span>
          <input type="date" id="p-modal-end" class="cyber-input" style="padding: 0.5rem; max-width: 150px;" value="${endStr || ''}">
          <button onclick="window.filterPModal()" class="btn-cyber-mini" style="padding: 0.5rem 1rem;">FİLTRELE</button>
          
          <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 0.5rem;"></div>
          
          <button onclick="window.filterPModalQuick(7)" class="btn-cyber-mini" style="padding: 0.5rem 1rem; background: transparent; border-style: dashed;">HAFTALIK</button>
          <button onclick="window.filterPModalQuick(30)" class="btn-cyber-mini" style="padding: 0.5rem 1rem; background: transparent; border-style: dashed;">AYLIK</button>

          ${(startStr && endStr) ? `<button onclick="window.showPersonnelDetails('${personnelName}')" class="btn-cyber-mini" style="padding: 0.5rem 1rem; background: rgba(255,77,77,0.1); border-color: rgba(255,77,77,0.3); color: #ff4d4d; margin-left: auto;">TEMİZLE</button>` : ''}
        </div>

        <div style="overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>TARİH</th>
                <th style="text-align: center;">KAYIT TÜRÜ</th>
                <th style="text-align: center;">BÖLGE / TÜRBİN</th>
                <th style="text-align: center;">TEKRAR</th>
                <th style="text-align: center;">ADAM-SAAT</th>
                <th style="text-align: center;">HIZ / PERFORMANS</th>
                <th style="text-align: right;">GÖRÜNTÜLE</th>
              </tr>
            </thead>
            <tbody>
              ${pReports.length > 0 ? rowsHtml : `<tr><td colspan="7" style="text-align: center; padding: 3rem; color: var(--text-muted);">Görev kaydı bulunmamaktadır.</td></tr>`}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
          <button class="btn-cyber-mini" onclick="this.closest('.cyber-modal-overlay').remove()">KAPAT</button>
        </div>
      </div>
    `;
    
    modal.innerHTML = content;
    document.body.appendChild(modal);
  };

  // Mesai Detaylarını Excel'e Aktar
  (window as any).exportOvertimeToExcel = () => {
    const details = data.overtimeDetails;
    if (details.length === 0) {
      alert("İndirilecek mesai verisi bulunamadı.");
      return;
    }
    
    const headers = ['Tarih', 'Personel', 'Turbin', 'Baslangic', 'Bitis', 'Mesai (Saat)', 'Rapor ID'];
    const rows = details.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(d => [
      new Date(d.date).toLocaleDateString('tr-TR'),
      d.personnelName,
      (d.siteName ? d.siteName + ' ' : '') + (d.turbineNo || d.turbineSerial),
      d.startTime,
      d.endTime,
      d.overtimeHours,
      d.reportId
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Mesai Detaylari");
    
    XLSX.writeFile(workbook, `DH_Servis_Mesai_Detaylari_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Attach export function to window directly in TS scope
  (window as any).exportAnalyticsToExcel = () => {
    const metrics = data.personnelMetrics;
    const headers = ['Personel', 'Uzmanlik', 'Bakim (Adet)', 'Ariza (Adet)', 'Tekrar (7 Gun)', 'Toplam Saat', 'Mesai (Saat)', 'Yol Suresi (Saat)', 'Verimlilik (%)', 'Turbinler'];
    
    const rows = metrics.map(p => [
      p.name,
      p.specialization,
      p.bakimCount,
      p.arizaCount,
      p.repeatFaultCount,
      p.totalHours,
      p.overtimeHours,
      p.roadHours || 0,
      Math.round(p.avgEfficiency * 100),
      p.turbines.join(' | ')
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Personel Analizi");
    
    XLSX.writeFile(workbook, `DH_Servis_AdamSaat_Analizi_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Agent Health Monitoring Subscription
  setTimeout(() => {
    const currentUser = (window as any).currentUser;
    if (currentUser?.role !== 'ADMIN') return;

    const agentGrid = document.getElementById('agent-health-grid');
    if (agentGrid) {
      agentHealthService.subscribeToAgents((agents) => {
        agentGrid.innerHTML = agents.map(agent => `
          <div class="agent-mini-card" style="display: flex; align-items: center; gap: 0.75rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <div class="status-pulse ${agent.status}" style="width: 10px; height: 10px; border-radius: 50%;"></div>
            <div style="flex: 1;">
              <div style="font-weight: 700; font-size: 0.8rem; color: var(--text-main);">${agent.name.toUpperCase()}</div>
              <div style="font-size: 0.65rem; color: var(--text-muted);">${agent.type} • ${agent.latency || 0}ms</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 0.6rem; color: var(--text-muted);">${new Date(agent.lastSeen).toLocaleTimeString()}</div>
              <div style="font-size: 0.65rem; font-weight: 800; color: ${agent.status === 'online' ? 'var(--accent-green)' : (agent.status === 'busy' ? 'var(--accent-orange)' : 'var(--accent-red)')};">
                ${agent.status.toUpperCase()}
              </div>
            </div>
          </div>
        `).join('');
      });
    }
  }, 100);

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: var(--text-main); text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-chart-line" style="color: var(--accent-cyan); margin-right: 0.5rem;"></i> Adam-Saat Analizi
          </h2>
          <div class="filter-group" style="display: flex; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
            <button class="btn-filter ${currentPeriod === 'this-week' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-week')">BU HAFTA</button>
            <button class="btn-filter ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-month')">BU AY</button>
            <button class="btn-filter ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('last-month')">ÖNCEKİ AY</button>
            <button class="btn-filter ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-year')">BU YIL</button>
            <button class="btn-filter ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('all')">TÜMÜ</button>
            
            <div style="width: 1px; height: 24px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
            
            <input type="date" id="analytics-start" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-main);" value="${localStorage.getItem('analytics_start') || ''}">
            <span style="color: var(--text-muted); font-size: 0.8rem;">-</span>
            <input type="date" id="analytics-end" class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-main);" value="${localStorage.getItem('analytics_end') || ''}">
            <button class="btn-filter ${currentPeriod === 'custom' ? 'active' : ''}" onclick="window.setCustomAnalyticsPeriod()" style="padding: 4px 12px; border-radius: 4px;" title="Tarih aralığına göre filtrele">
              <i class="fa-solid fa-filter"></i>
            </button>
          </div>
        </div>
        <div style="display: flex; gap: 1rem;">
          <button class="btn-cyber-mini" onclick="window.showTeamSpeedAnalysis()" style="padding: 0.75rem 1.5rem; background: rgba(34, 197, 94, 0.1); border-color: var(--accent-green); color: var(--accent-green);">
            <i class="fa-solid fa-gauge-high" style="margin-right: 0.5rem;"></i> HIZ ANALİZİ
          </button>
          <button class="btn-cyber-mini" onclick="window.exportAnalyticsToExcel()" style="padding: 0.75rem 1.5rem;">
            <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i> EXCEL'E AKTAR
          </button>
        </div>
      </div>

      <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1.5rem; margin-bottom: 2rem;">
        <div class="glass-panel stat-card" style="border-left: 4px solid var(--accent-cyan);">
          <span class="stat-label">TOPLAM TÜRBİN DURUŞU</span>
          <div class="stat-value">${data.operationSummary.totalTurbineHours} <span style="font-size: 1rem; color: var(--text-muted);">h</span></div>
          <span class="stat-desc">Türbinin başında geçen saf süre</span>
        </div>
        <div class="glass-panel stat-card" style="border-left: 4px solid var(--accent-green);">
          <span class="stat-label">TOPLAM ADAM-SAAT</span>
          <div class="stat-value">${data.operationSummary.totalManHours} <span style="font-size: 1rem; color: var(--text-muted);">h</span></div>
          <span class="stat-desc">Gerçekleşen toplam efor</span>
        </div>
        <div class="glass-panel stat-card clickable-card" onclick="window.showOvertimeDetails()" style="border-left: 4px solid var(--accent-orange); cursor: pointer; transition: all 0.3s ease;">
          <style>
            .clickable-card:hover { transform: translateY(-5px); background: rgba(255,157,0,0.05) !important; border-color: var(--accent-orange) !important; }
          </style>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="stat-label">TOPLAM FAZLA MESAİ</span>
            <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem; color: var(--accent-orange); opacity: 0.5;"></i>
          </div>
          <div class="stat-value" style="color: var(--accent-orange);">${data.operationSummary.totalOvertimeHours} <span style="font-size: 1rem; color: var(--text-muted);">h</span></div>
          <span class="stat-desc">18:00 sonrası gerçekleşen çalışma</span>
        </div>
        <div class="glass-panel stat-card" style="border-left: 4px solid #a855f7;">
          <span class="stat-label">TOPLAM YOL SÜRESİ</span>
          <div class="stat-value" style="color: #c084fc;">${data.operationSummary.totalRoadHours} <span style="font-size: 1rem; color: var(--text-muted);">h</span></div>
          <span class="stat-desc">Şantiye & türbin arası intikal süresi</span>
        </div>
        <div class="glass-panel stat-card" style="border-left: 4px solid var(--accent-cyan);">
          <span class="stat-label">VERİMLİLİK SKORU</span>
          <div class="stat-value">%${Math.round(data.operationSummary.efficiencyScore * 100)}</div>
          <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
            <span style="font-size: 0.7rem; color: var(--accent-cyan);">Bakım: %${data.operationSummary.bakimRatio}</span>
            <span style="font-size: 0.7rem; color: var(--accent-orange);">Arıza: %${data.operationSummary.arizaRatio}</span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2.5fr 1fr; gap: 1.5rem;">
        <!-- Personel Performans Matrisi -->
        <div class="glass-panel" style="padding: 1.5rem; display: flex; flex-direction: column; max-height: 800px;">
          <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.75rem;">
            <i class="fa-solid fa-users-gears" style="color: var(--accent-cyan);"></i> Personel Yetkinlik & Performans Detayları
          </h3>
          <div style="overflow-y: auto; flex: 1; padding-right: 0.5rem;" class="custom-scrollbar">
            <table class="cyber-table">
              <thead>
                <tr>
                  <th>PERSONEL</th>
                  <th style="text-align: center;">BAKIM (ADET)</th>
                  <th style="text-align: center;">ARIZA (ADET)</th>
                  <th style="text-align: center;">TEKRAR (7 GÜN)</th>
                  <th style="text-align: center;">TOPLAM SAAT</th>
                  <th style="text-align: center; color: var(--accent-orange);">MESAİ</th>
                  <th style="text-align: center; color: #c084fc;">YOL</th>
                  <th style="text-align: center;">VERİMLİLİK</th>
                  <th style="text-align: right;">DURUM</th>
                </tr>
              </thead>
              <tbody>
                ${data.personnelMetrics.map(p => `
                  <tr class="clickable-row" onclick="window.showPersonnelDetails('${p.name}')" style="cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 242, 254, 0.05)'" onmouseout="this.style.background='transparent'">
                    <td>
                    <div style="font-weight: 600; color: var(--text-main);">${p.name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 4px;">${p.specialization}</div>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      ${p.turbines.map(t => {
                        const turbine = dataService.findTurbineBySerial(t);
                        const label = (turbine ? turbine.siteName + ' ' + (turbine.turbineNo || t) : t);
                        return `<span style="font-size: 10px; padding: 1px 4px; background: rgba(255,255,255,0.05); border-radius: 3px; color: var(--accent-cyan); border: 1px solid rgba(0,255,255,0.1);">${label}</span>`;
                      }).join('')}
                    </div>
                    </td>
                    <td style="text-align: center;">
                      <span class="badge" style="background: rgba(34, 197, 94, 0.1); color: var(--accent-green); border: 1px solid rgba(34, 197, 94, 0.2); padding: 2px 8px; border-radius: 4px;">
                        ${p.bakimCount}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      <span class="badge" style="background: rgba(59, 130, 246, 0.1); color: var(--accent-blue); border: 1px solid rgba(59, 130, 246, 0.2); padding: 2px 8px; border-radius: 4px;">
                        ${p.arizaCount}
                      </span>
                    </td>
                    <td style="text-align: center;">
                      ${p.repeatFaultCount > 0 ? `
                        <span class="badge" style="background: rgba(239, 68, 68, 0.1); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.2); padding: 2px 8px; border-radius: 4px; font-weight: bold;">
                          🚩 ${p.repeatFaultCount}
                        </span>
                      ` : '<span style="color: var(--text-muted); opacity: 0.3;">-</span>'}
                    </td>
                    <td style="text-align: center; font-weight: 600; color: var(--accent-cyan);">
                      ${p.totalHours} <span style="font-size: 0.7rem; color: var(--text-muted);">h</span>
                    </td>
                    <td style="text-align: center; font-weight: 800; color: var(--accent-orange);">
                      ${p.overtimeHours > 0 ? p.overtimeHours + ' h' : '<span style="opacity: 0.2;">0</span>'}
                    </td>
                    <td style="text-align: center; font-weight: 800; color: #c084fc;">
                      ${p.roadHours > 0 ? p.roadHours + ' h' : '<span style="opacity: 0.2;">0</span>'}
                    </td>
                    <td style="text-align: center;">
                      <div style="display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
                        <div style="flex: 1; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; width: 40px;">
                          <div style="height: 100%; width: ${p.avgEfficiency * 100}%; background: ${p.avgEfficiency > 0.85 ? 'var(--accent-green)' : (p.avgEfficiency > 0.7 ? 'var(--accent-cyan)' : '#f59e0b')}; border-radius: 2px;"></div>
                        </div>
                        <span style="font-size: 0.8rem; font-weight: 600;">%${Math.round(p.avgEfficiency * 100)}</span>
                      </div>
                    </td>
                    <td style="text-align: right;">
                      <span class="status-pill ${p.totalHours > 40 ? 'completed' : 'pending'}" style="font-size: 0.65rem;">
                        ${p.totalHours > 40 ? 'YÜKSEK EFOR' : 'NORMAL'}
                      </span>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Yan Panel: Yıldızlar ve Öneriler -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Ayın Yıldızları (Sıralama) -->
          <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid #fcd34d;">
            <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem; font-size: 1rem; color: #fcd34d;">
              <i class="fa-solid fa-crown"></i> DÖNEMİN YILDIZLARI
            </h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${[...data.personnelMetrics]
                .sort((a, b) => b.totalHours - a.totalHours)
                .slice(0, 3)
                .map((p, idx) => `
                <div style="display: flex; align-items: center; gap: 1rem; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 12px;">
                  <div style="width: 32px; height: 32px; background: ${idx === 0 ? '#fcd34d' : (idx === 1 ? '#94a3b8' : '#b45309')}; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #000; font-size: 0.9rem;">
                    ${idx + 1}
                  </div>
                  <div style="flex: 1;">
                    <div style="font-weight: 600; font-size: 0.9rem;">${p.name}</div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${p.totalHours} Saat Mesai</div>
                  </div>
                  <i class="fa-solid fa-trophy" style="color: ${idx === 0 ? '#fcd34d' : 'rgba(255,255,255,0.1)'};"></i>
                </div>
              `).join('')}
            </div>
          </div>

          <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid var(--accent-orange);">
            <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem; font-size: 1rem;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: var(--accent-orange);"></i> Atama Önerileri
            </h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${data.backlogRecommendations.length > 0 ? data.backlogRecommendations.slice(0, 3).map(rec => `
                <div style="background: rgba(255,255,255,0.02); padding: 1rem; border-radius: 12px; border-left: 2px solid var(--accent-orange);">
                  <div style="font-size: 0.75rem; color: var(--accent-orange); font-weight: 700; margin-bottom: 0.25rem;">GÖREV #${rec.taskId.slice(-4).toUpperCase()}</div>
                  <div style="font-size: 0.9rem; font-weight: 600; margin-bottom: 0.5rem;">${rec.recommendedPersonnel}</div>
                  <div style="font-size: 0.75rem; color: var(--text-muted); line-height: 1.4;">${rec.reason}</div>
                </div>
              `).join('') : '<p style="color: var(--text-muted); font-size: 0.8rem; text-align: center;">Öneri bulunamadı.</p>'}
            </div>
          </div>

          <div class="glass-panel" style="padding: 1.5rem; background: linear-gradient(135deg, rgba(255,107,107,0.05) 0%, rgba(0,0,0,0) 100%);">
            <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1rem; font-size: 1rem; color: var(--accent-red);">
              <i class="fa-solid fa-triangle-exclamation"></i> Kritik Sapmalar
            </h3>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem;">+%20 üzerinde adam-saat sapması olan raporlar.</p>
            <div style="font-family: 'Rajdhani'; font-weight: 700; color: var(--accent-red); font-size: 1.2rem;">0 Kayıt</div>
          </div>

          <!-- SİSTEM AJANLARI DURUMU (NEW) -->
          <div class="glass-panel" style="padding: 1.5rem; border-top: 3px solid var(--accent-cyan);">
            <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.25rem; font-size: 1rem; color: var(--accent-cyan); display: flex; justify-content: space-between; align-items: center;">
              <span><i class="fa-solid fa-microchip"></i> AGENT MONITORING</span>
              <span style="font-size: 0.6rem; background: rgba(0,243,255,0.1); padding: 2px 6px; border-radius: 4px;">LIVE</span>
            </h3>
            ${(window as any).currentUser?.role === 'ADMIN' ? `
            <div id="agent-health-grid" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.8rem;">
                <i class="fa-solid fa-spinner fa-spin"></i> Ajanlar taranıyor...
              </div>
            </div>
            ` : ''}
          </div>
        </div>
      </div>
    </div>

    <style>
      .cyber-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .cyber-table th {
        text-align: left;
        padding: 1rem;
        color: var(--text-muted);
        font-family: 'Rajdhani', sans-serif;
        text-transform: uppercase;
        letter-spacing: 1px;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }
      .cyber-table td {
        padding: 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.02);
      }
      .badge-mini {
        padding: 0.2rem 0.5rem;
        background: rgba(0, 243, 255, 0.05);
        border: 1px solid rgba(0, 243, 255, 0.1);
        border-radius: 4px;
        color: var(--accent-cyan);
        font-size: 0.7rem;
      }
      .btn-filter {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 0.5rem 1rem;
        font-size: 0.75rem;
        font-weight: 600;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
        font-family: 'Rajdhani', sans-serif;
      }
      .btn-filter:hover {
        background: rgba(255,255,255,0.05);
        color: var(--text-main);
      }
      .btn-filter.active {
        background: var(--accent-cyan);
        color: #000;
      }
      .btn-cyber-mini {
        background: rgba(255, 159, 67, 0.1);
        color: var(--accent-orange);
        border: 1px solid rgba(255, 159, 67, 0.2);
        padding: 0.5rem;
        border-radius: 6px;
        font-size: 0.7rem;
        font-family: 'Rajdhani';
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-cyber-mini:hover {
        background: var(--accent-orange);
        color: white;
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.02);
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--accent-cyan);
        border-radius: 10px;
        opacity: 0.5;
      }
      
      /* Status Pulse Animations */
      .status-pulse {
        position: relative;
      }
      .status-pulse.online { background: var(--accent-green); box-shadow: 0 0 10px var(--accent-green); }
      .status-pulse.busy { background: var(--accent-orange); box-shadow: 0 0 10px var(--accent-orange); }
      .status-pulse.offline { background: var(--text-muted); }
      .status-pulse.error { background: var(--accent-red); box-shadow: 0 0 10px var(--accent-red); animation: pulse-error 1s infinite; }
      
      .status-pulse.online::after {
        content: '';
        position: absolute;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: inherit;
        animation: pulse-ring 2s infinite;
      }
      
      @keyframes pulse-ring {
        0% { transform: scale(1); opacity: 0.8; }
        100% { transform: scale(2.5); opacity: 0; }
      }
      @keyframes pulse-error {
        0% { opacity: 1; }
        50% { opacity: 0.4; }
        100% { opacity: 1; }
      }
    </style>
  `;
};
