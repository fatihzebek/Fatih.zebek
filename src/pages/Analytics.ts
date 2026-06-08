import { analyticsService } from '../services/AnalyticsService';
import { serviceReportService } from '../services/ServiceReportService';
import { taskService } from '../services/TaskService';
import { dataService } from '../services/DataService';
import { agentHealthService } from '../services/AgentHealthService';
import * as XLSX from 'xlsx';

export const AnalyticsPage = async () => {
  const currentPeriod = localStorage.getItem('analytics_period') || 'this-month';
  let reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
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
        <button class="btn-cyber-mini" onclick="window.exportAnalyticsToExcel()" style="padding: 0.75rem 1.5rem;">
          <i class="fa-solid fa-file-excel" style="margin-right: 0.5rem;"></i> EXCEL'E AKTAR
        </button>
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
                  <tr>
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
