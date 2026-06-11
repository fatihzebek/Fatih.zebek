import { dataService } from '../services/DataService';
import { taskService } from '../services/TaskService';
import { agentHealthService } from '../services/AgentHealthService';
import { warehouseService } from '../services/WarehouseService';
import { serviceReportService } from '../services/ServiceReportService';

const cleanSablonName = (sablonName: string) => {
  return (sablonName || '').replace(/\s*[Tt]alimat[ıi]\s*/g, '').trim().toUpperCase();
};
const isGenericFault = (code: string) => !code || code.includes('---') || code.toUpperCase().includes('GENEL GÖREV');

export const DashboardPage = async () => {
  let tasks = await taskService.getTasks();
  
  // Sadece ilgili ekibin görevlerini göster (Eğer kullanıcı TECHNICIAN ise)
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  if (currentUser && currentUser.role === 'TECHNICIAN') {
    const userTeam = ((window as any).currentUserTeam || currentUser.displayName || '').toUpperCase().trim();
    if (userTeam) {
      tasks = tasks.filter(t => {
        const taskPersonnel = String(t.personnel || '').toUpperCase().trim();
        const searchTeam = userTeam.toUpperCase().trim();
        
        // "SİSTEM" veya boş olanları herkese göster
        if (!taskPersonnel || taskPersonnel === 'SİSTEM' || taskPersonnel === 'ATANMADI') return true;
        
        const taskNum = taskPersonnel.replace(/[^0-9]/g, '');
        const userNum = searchTeam.replace(/[^0-9]/g, '');
        
        if (taskNum && userNum && parseInt(taskNum) === parseInt(userNum)) return true;
        
        return taskPersonnel.includes(searchTeam) || searchTeam.includes(taskPersonnel);
      });
    }
  }

  const sites = dataService.getSites();
  const reports = await serviceReportService.getAllReports();
  
  // Filter for OPEN tasks (Maintenance or Fault)
  const openTasks = tasks.filter(t => t.status !== 'Tamamlandı');
  const activeTasksCount = openTasks.length;
  const emergencyTasksCount = openTasks.filter(t => t.secilenSablon?.toLowerCase().includes('arıza')).length;
  
  // Maintenance Tracking Logic
  const maintenancePlan = (() => {
    const plan: { siteName: string, turbineNo: string, lastDate: string, lastType: string, nextDate: Date, nextType: string, status: 'safe' | 'warning' | 'overdue' }[] = [];
    const now = new Date();

    sites.forEach(site => {
      const siteTurbines = dataService.getTurbinesBySite(site.id);
      siteTurbines.forEach(t => {
        // Find last maintenance report for this turbine
        const turbineReports = reports.filter(r => r.turbineSerial === t.id);
        const lastMaint = turbineReports
          .filter(r => r.type?.toLowerCase().includes('ana') || r.type?.toLowerCase().includes('yağ') || r.type?.toLowerCase().includes('yag'))
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastMaint) {
          const lastDate = new Date(lastMaint.date);
          const nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 6); // Add 6 months

          const isLastAna = lastMaint.type.toLowerCase().includes('ana');
          const nextType = isLastAna ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';
          const lastType = isLastAna ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';

          // Status calculation
          const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let status: 'safe' | 'warning' | 'overdue' = 'safe';
          if (diffDays < 0) status = 'overdue';
          else if (diffDays < 30) status = 'warning';

          plan.push({
            siteName: site.name,
            turbineNo: t.no.toString(),
            lastDate: lastMaint.date,
            lastType,
            nextDate,
            nextType,
            status
          });
        }
      });
    });

    return plan.sort((a, b) => a.nextDate.getTime() - b.nextDate.getTime());
  })();

  // Real-time Agent Monitoring + Counter Animation + Agenda
  setTimeout(() => {
    // Counter-up animation for stat values
    document.querySelectorAll('.dash-stat-card .value[data-count]').forEach(el => {
      const target = parseInt(el.getAttribute('data-count') || '0');
      if (target === 0) { el.textContent = '0'; return; }
      let current = 0;
      const increment = Math.max(1, Math.ceil(target / 25));
      const timer = setInterval(() => {
        current += increment;
        if (current >= target) { current = target; clearInterval(timer); el.classList.add('counted'); }
        el.textContent = String(current);
      }, 30);
    });

    const currentUser = (window as any).currentUser;

    // Agent monitoring (admin only)
    if (currentUser?.role === 'ADMIN') {
      const agentGrid = document.getElementById('dash-agent-grid');
      if (agentGrid) {
        agentHealthService.subscribeToAgents((agents) => {
          agentGrid.innerHTML = agents.slice(0, 4).map(agent => `
            <div class="agent-mini-tag ${agent.status}">
              <span class="pulse-dot"></span>
              <span class="agent-name">${agent.name.split(' ')[0]}</span>
            </div>
          `).join('');
        });
      }
    }

    // ===== AJANDA WIDGET LOGIC =====
    const trMonths = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık'];
    const trDays = ['Pt','Sa','Ça','Pe','Cu','Ct','Pz'];
    let agendaDate = new Date();

    // Collect all agenda events
    type AgendaEvent = { date: Date; title: string; subtitle: string; type: 'task' | 'maintenance' | 'overdue'; icon: string };
    const agendaEvents: AgendaEvent[] = [];

    // Add tasks
    openTasks.forEach(t => {
      const d = t.createdAt?.toDate ? t.createdAt.toDate() : null;
      if (d) {
        const isEmergency = t.secilenSablon?.toLowerCase().includes('arıza');
        agendaEvents.push({
          date: d,
          title: `${t.siteId} / ${t.turbineId}`,
          subtitle: `${t.personnel || 'Atanmadı'} • ${cleanSablonName(t.secilenSablon)}`,
          type: isEmergency ? 'overdue' : 'task',
          icon: isEmergency ? 'fa-bolt-lightning' : 'fa-wrench'
        });
      }
    });

    // Add maintenance plans
    maintenancePlan.forEach(p => {
      agendaEvents.push({
        date: p.nextDate,
        title: `${p.siteName} / T${p.turbineNo}`,
        subtitle: p.nextType,
        type: p.status === 'overdue' ? 'overdue' : 'maintenance',
        icon: p.status === 'overdue' ? 'fa-triangle-exclamation' : 'fa-calendar-check'
      });
    });

    agendaEvents.sort((a, b) => a.date.getTime() - b.date.getTime());

    function renderAgendaCalendar() {
      const cal = document.getElementById('agenda-mini-calendar');
      const label = document.getElementById('agenda-month-label');
      if (!cal || !label) return;

      const year = agendaDate.getFullYear();
      const month = agendaDate.getMonth();
      label.textContent = `${trMonths[month]} ${year}`;

      const firstDay = new Date(year, month, 1);
      let startDow = firstDay.getDay() - 1;
      if (startDow < 0) startDow = 6;
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const today = new Date();

      // Collect event dates for this month
      const eventDates = new Map<number, string>();
      agendaEvents.forEach(e => {
        if (e.date.getFullYear() === year && e.date.getMonth() === month) {
          const day = e.date.getDate();
          if (!eventDates.has(day) || e.type === 'overdue') {
            eventDates.set(day, e.type);
          }
        }
      });

      let html = '<div class="cal-header-row">';
      trDays.forEach(d => { html += `<span class="cal-day-name">${d}</span>`; });
      html += '</div><div class="cal-grid">';

      for (let i = 0; i < startDow; i++) {
        html += '<span class="cal-day empty"></span>';
      }

      for (let d = 1; d <= daysInMonth; d++) {
        const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;
        const evType = eventDates.get(d) || '';
        const classes = ['cal-day'];
        if (isToday) classes.push('today');
        if (evType) classes.push('has-event', evType);
        html += `<span class="${classes.join(' ')}">${d}</span>`;
      }

      html += '</div>';
      cal.innerHTML = html;
    }

    function renderAgendaTimeline() {
      const timeline = document.getElementById('agenda-timeline');
      if (!timeline) return;

      const now = new Date();
      const upcoming = agendaEvents
        .filter(e => e.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7))
        .slice(0, 8);

      if (upcoming.length === 0) {
        timeline.innerHTML = '<div style="text-align: center; padding: 2rem 1rem; color: var(--text-dim); font-size: 0.8rem;"><i class="fa-solid fa-calendar-xmark" style="font-size: 1.5rem; opacity: 0.2; margin-bottom: 0.5rem; display: block;"></i>Yaklaşan olay bulunmuyor.</div>';
        return;
      }

      timeline.innerHTML = upcoming.map(e => {
        const dayStr = e.date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
        const isPast = e.date < now;
        const colorMap: Record<string, string> = { task: '#f59e0b', overdue: '#ef4444', maintenance: '#a78bfa' };
        const color = colorMap[e.type] || '#a78bfa';

        return `
          <div class="agenda-event-item ${isPast ? 'past' : ''}" style="--ev-color: ${color}">
            <div class="agenda-event-date">${dayStr}</div>
            <div class="agenda-event-line"><span class="agenda-event-dot"></span></div>
            <div class="agenda-event-body">
              <div class="agenda-event-title"><i class="fa-solid ${e.icon}" style="color: ${color}; margin-right: 6px; font-size: 0.65rem;"></i>${e.title}</div>
              <div class="agenda-event-sub">${e.subtitle}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    (window as any).agendaPrevMonth = () => {
      agendaDate.setMonth(agendaDate.getMonth() - 1);
      renderAgendaCalendar();
    };
    (window as any).agendaNextMonth = () => {
      agendaDate.setMonth(agendaDate.getMonth() + 1);
      renderAgendaCalendar();
    };

    renderAgendaCalendar();
    renderAgendaTimeline();
  }, 100);

  // Global Stock Search Handler
  (window as any).searchGlobalStock = async () => {
    const sapInput = document.getElementById('global-sap-search') as HTMLInputElement;
    const resultArea = document.getElementById('global-stock-results');
    const sapNo = sapInput?.value.trim();

    if (!sapNo) return;

    resultArea!.innerHTML = '<div class="loader-mini">Taranıyor...</div>';
    
    try {
      const results: { siteName: string, quantity: number, description: string }[] = [];
      const sites = dataService.getSites();
      
      for (const site of sites) {
        const inventory = await warehouseService.getInventory(site.id);
        const item = inventory.find(i => i.sapNo === sapNo);
        if (item && item.quantity > 0) {
          results.push({ siteName: site.name, quantity: item.quantity, description: item.description });
        }
      }

      if (results.length === 0) {
        resultArea!.innerHTML = '<div class="no-results">Bu SAP numarası ile hiçbir depoda stok bulunamadı.</div>';
      } else {
        resultArea!.innerHTML = results.map(r => `
          <div class="stock-result-item">
            <div class="site-info">
              <span class="site">${r.siteName}</span>
              <span class="desc">${r.description}</span>
            </div>
            <span class="qty">${r.quantity} Adet</span>
          </div>
        `).join('');
      }
    } catch (error) {
      resultArea!.innerHTML = '<div class="error">Arama sırasında hata oluştu.</div>';
    }
  };

  // Turbine QR Scanner Logic
  (window as any).scanTurbineQR = async () => {
    const { Html5QrcodeScanner } = await import('html5-qrcode');
    
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    modal.innerHTML = `
      <div class="glass-panel" style="width: 90%; max-width: 400px; padding: 2rem; position: relative; border-top: 4px solid var(--accent-cyan); display: flex; flex-direction: column; align-items: center; text-align: center;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="width: 50px; height: 50px; background: rgba(0, 243, 255, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.5rem; margin-bottom: 1rem;">
          <i class="fa-solid fa-qrcode"></i>
        </div>
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-cyan); margin-bottom: 0.5rem; font-size: 1.2rem; letter-spacing: 1px;">TÜRBİN SİCİL TARAYICI</h3>
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">Türbin üzerindeki sicil barkodunu okutun.</p>
        
        <div id="turbine-qr-reader" style="width: 100%; min-height: 250px; border-radius: 12px; overflow: hidden; border: 2px solid rgba(0, 243, 255, 0.2);"></div>
      </div>
    `;
    document.body.appendChild(modal);

    const scanner = new Html5QrcodeScanner('turbine-qr-reader', { fps: 10, qrbox: { width: 250, height: 250 }, aspectRatio: 1.0 }, false);
    
    scanner.render(async (decodedText) => {
      scanner.clear();
      modal.remove();
      
      let serial = decodedText;
      let targetSiteId: string | undefined = undefined;
      
      if (decodedText.startsWith('turbine:')) {
        const parts = decodedText.split(':');
        if (parts.length === 3) {
          // Format: turbine:siteId:turbineId
          targetSiteId = parts[1];
          serial = parts[2];
        } else {
          // Legacy format: turbine:turbineId
          serial = parts[1];
        }
      }

      const turbine = dataService.findTurbineBySerial(serial, targetSiteId);
      if (turbine) {
        (window as any).showToast?.('BAŞARILI', `Türbin bulundu: ${turbine.siteName} / ${turbine.turbineNo}`, 'success');
        localStorage.setItem('autoOpenTurbineId', serial); // serial or id
        (window as any).selectSiteAndNavigate(turbine.siteId);
      } else {
        (window as any).showToast?.('HATA', `Sistemde kayıtlı türbin bulunamadı. (Okunan: ${serial})`, 'error');
      }
    }, (error) => {});
  };

  return `
    <div class="fade-in-up dashboard-container">
      <!-- HEADER & WELCOME -->
      <div class="dash-header">
        <div class="welcome-text">
          <h1>${(() => { const h = new Date().getHours(); return h < 6 ? '<i class="fa-solid fa-moon" style="color: #a29bfe; margin-right: 10px;"></i> İYİ GECELER' : h < 12 ? '<i class="fa-solid fa-sun" style="color: #ffd93d; margin-right: 10px;"></i> GÜNAYDINN' : h < 18 ? '<i class="fa-solid fa-cloud-sun" style="color: #ff9f43; margin-right: 10px;"></i> İYİ GÜNLER' : '<i class="fa-solid fa-star" style="color: #a29bfe; margin-right: 10px;"></i> İYİ AKŞAMLAR'; })()} <span class="v-tag">V3.4</span></h1>
          <p>Sistem genel durumu, bakım planı ve global stok verileri.</p>
        </div>
        ${(window as any).currentUser?.role === 'ADMIN' ? `
        <div id="dash-agent-grid" class="agent-summary-strip">
          <!-- Agents injected here -->
        </div>
        ` : ''}
      </div>

      <!-- MAIN STATS GRID -->
      <div class="dash-stats-grid">
        <div class="dash-stat-card primary">
          <div class="stat-icon"><i class="fa-solid fa-person-digging"></i></div>
          <div class="stat-content">
            <span class="label">AKTİF EKİPLER</span>
            <span class="value" data-count="${activeTasksCount}">0</span>
            <span class="sub-label">Sahadaki Toplam İş</span>
          </div>
          <div class="card-glow primary"></div>
        </div>

        <div class="dash-stat-card danger">
          <div class="stat-icon"><i class="fa-solid fa-bolt-lightning"></i></div>
          <div class="stat-content">
            <span class="label">ARIZA DURUMU</span>
            <span class="value" data-count="${emergencyTasksCount}">0</span>
            <span class="sub-label">Müdahale Edilen Arıza</span>
          </div>
          <div class="card-glow danger"></div>
        </div>

        <div class="dash-stat-card info" onclick="window.navigate('bakim-planlama')">
          <div class="stat-icon"><i class="fa-solid fa-calendar-check"></i></div>
          <div class="stat-content">
            <span class="label">YAKLAŞAN BAKIM</span>
            <span class="value" data-count="${maintenancePlan.filter(p => p.status !== 'safe').length}">0</span>
            <span class="sub-label">Kritik Planlama Listesi</span>
          </div>
          <div class="card-glow info"></div>
        </div>

        <div class="dash-stat-card warning">
          <div class="stat-icon"><i class="fa-solid fa-warehouse"></i></div>
          <div class="stat-content">
            <span class="label">LOJİSTİK NOKTA</span>
            <span class="value" data-count="${sites.length}">0</span>
            <span class="sub-label">Bağlı Depo Sayısı</span>
          </div>
          <div class="card-glow warning"></div>
        </div>
      </div>

      <!-- AGENDA + SECONDARY GRID -->
      <div class="dash-agenda-row">
        <!-- 📅 AJANDA WIDGET -->
        <div class="glass-panel dash-agenda-widget">
          <div class="section-header" style="margin-bottom: 0.75rem;">
            <h3><i class="fa-solid fa-calendar-days" style="color: #a78bfa;"></i> AJANDA</h3>
            <div style="display: flex; gap: 6px; align-items: center;">
              <button onclick="window.agendaPrevMonth()" class="agenda-nav-btn"><i class="fa-solid fa-chevron-left"></i></button>
              <span id="agenda-month-label" style="font-size: 0.75rem; font-weight: 800; color: #a78bfa; min-width: 100px; text-align: center; letter-spacing: 1px;"></span>
              <button onclick="window.agendaNextMonth()" class="agenda-nav-btn"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
          </div>

          <!-- Mini Calendar -->
          <div id="agenda-mini-calendar" class="agenda-mini-cal"></div>

          <!-- Upcoming Events Timeline -->
          <div style="margin-top: 1rem;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 0.75rem;">
              <span style="font-size: 0.6rem; font-weight: 900; color: rgba(255,255,255,0.3); letter-spacing: 2px; text-transform: uppercase;">YAKLASAN OLAYLAR</span>
              <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.05);"></div>
            </div>
            <div id="agenda-timeline" class="agenda-timeline custom-scrollbar"></div>
          </div>

          <!-- Legend -->
          <div style="display: flex; gap: 12px; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04);">
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #f59e0b;"></span>Görev</span>
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #ef4444;"></span>Gecikmiş</span>
            <span class="agenda-legend-item"><span class="agenda-legend-dot" style="background: #a78bfa;"></span>Bakım</span>
          </div>
        </div>

        <!-- RIGHT SIDE: Existing Sections -->
        <div class="dash-agenda-right">
          <!-- Live Activity Feed -->
          <div class="glass-panel dash-feed-section">
            <div class="section-header">
              <h3><i class="fa-solid fa-person-running"></i> AKTİF GÖREV AKIŞI</h3>
              <span class="count-tag">${activeTasksCount} GÖREV</span>
            </div>
            <div class="feed-container custom-scrollbar">
              ${openTasks.length > 0 ? openTasks.map(t => {
                const isEmergency = t.secilenSablon?.toLowerCase().includes('arıza');
                return `
                  <div class="feed-item ${isEmergency ? 'emergency' : ''}" onclick="window.navigate('tasks')">
                    <div class="feed-marker"></div>
                    <div class="feed-content">
                      <div class="feed-header">
                        <span class="site-tag">${t.siteId} / ${t.turbineId}</span>
                        <span class="task-type">${cleanSablonName(t.secilenSablon)}${t.faultCode && !isGenericFault(t.faultCode) ? ` • ${t.faultCode}` : ''}</span>
                      </div>
                      <div class="personnel-row">
                        <i class="fa-solid fa-users"></i> 
                        <strong>${t.personnel || 'EKİP ATANMAMIŞ'}</strong>
                      </div>
                      ${t.yoneticiNotu ? `<div class="task-desc-row"><i class="fa-solid fa-circle-info"></i> ${t.yoneticiNotu}</div>` : ''}
                      <div class="status-row">
                        <span class="status-text">${t.status}</span>
                        <span class="time-text">${t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('tr-TR') : ''}</span>
                      </div>
                    </div>
                  </div>
                `;
              }).join('') : '<div class="empty-feed">Şu an aktif bir görev bulunmuyor.</div>'}
            </div>
          </div>

          <!-- Global Stock Search + Quick Actions -->
          <div class="dash-sidebar-section">
            <div class="glass-panel stock-search-card">
              <h3><i class="fa-solid fa-magnifying-glass-chart"></i> GLOBAL STOK SORGULAMA</h3>
              <div class="search-box">
                <input type="text" id="global-sap-search" placeholder="SAP Numarası girin..." onkeypress="if(event.key==='Enter') window.searchGlobalStock()">
                <button onclick="window.searchGlobalStock()"><i class="fa-solid fa-search"></i></button>
              </div>
              <div id="global-stock-results" class="results-container custom-scrollbar">
                <div class="placeholder">SAP numarası girerek tüm depolardaki stok miktarını anlık sorgulayabilirsiniz.</div>
              </div>
            </div>
            <div class="quick-actions-grid">
              <button class="action-btn" onclick="window.navigate('task-create')">
                <i class="fa-solid fa-plus"></i>
                <span>GÖREV OLUŞTUR</span>
              </button>
              <button class="action-btn" onclick="window.navigate('inventory')">
                <i class="fa-solid fa-boxes-stacked"></i>
                <span>ENVANTER</span>
              </button>
              <button class="action-btn" onclick="window.scanTurbineQR()" style="grid-column: span 2; background: rgba(0, 243, 255, 0.05); border-color: rgba(0, 243, 255, 0.1); color: var(--accent-cyan);">
                <i class="fa-solid fa-qrcode"></i>
                <span>TÜRBİN QR SİCİL OKUT</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <style>
      .dashboard-container { padding: 1rem; display: flex; flex-direction: column; gap: 1.5rem; }
      .dash-header { display: flex; justify-content: space-between; align-items: center; }
      .welcome-text h1 { font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; letter-spacing: 2px; margin: 0; color: var(--text-main); display: flex; align-items: center; }
      .welcome-text .v-tag { font-size: 0.6rem; background: linear-gradient(135deg, #64ffda, #00bcd4); color: #000; padding: 3px 8px; border-radius: 6px; vertical-align: middle; margin-left: 12px; font-weight: 900; letter-spacing: 1px; }
      .welcome-text p { color: var(--text-muted); font-size: 0.85rem; margin: 4px 0 0 0; }
      
      .agent-summary-strip { display: flex; gap: 8px; }
      .agent-mini-tag { background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); padding: 4px 10px; border-radius: 20px; display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 700; color: var(--text-muted); }
      .agent-mini-tag.online .pulse-dot { background: var(--accent-green); box-shadow: 0 0 5px var(--accent-green); }
      .pulse-dot { width: 6px; height: 6px; border-radius: 50%; }

      /* Stats Grid */
      .dash-stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1.25rem; }
      .dash-stat-card { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 18px; padding: 1.4rem; display: flex; align-items: center; gap: 1.25rem; position: relative; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
      .dash-stat-card:hover { transform: translateY(-6px); background: rgba(255,255,255,0.04); }
      .dash-stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px; background: linear-gradient(90deg, transparent, currentColor, transparent); opacity: 0; transition: opacity 0.4s; }
      .dash-stat-card:hover::before { opacity: 0.5; }
      
      /* Card glow effect */
      .card-glow { position: absolute; top: -50%; right: -50%; width: 100%; height: 100%; border-radius: 50%; filter: blur(60px); opacity: 0.06; transition: opacity 0.4s; pointer-events: none; }
      .dash-stat-card:hover .card-glow { opacity: 0.12; }
      .card-glow.primary { background: #00f3ff; }
      .card-glow.danger { background: #ff4d4d; }
      .card-glow.info { background: #a29bfe; }
      .card-glow.warning { background: #ff9f43; }

      .dash-stat-card .stat-icon { width: 52px; height: 52px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; transition: all 0.4s; }
      .dash-stat-card:hover .stat-icon { transform: scale(1.1) rotate(-5deg); }
      .dash-stat-card.primary .stat-icon { background: rgba(0, 243, 255, 0.1); color: var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 243, 255, 0.08); }
      .dash-stat-card.danger .stat-icon { background: rgba(255, 77, 77, 0.1); color: var(--accent-red); box-shadow: 0 0 20px rgba(255, 77, 77, 0.08); }
      .dash-stat-card.info .stat-icon { background: rgba(162, 155, 254, 0.1); color: #a29bfe; box-shadow: 0 0 20px rgba(162, 155, 254, 0.08); }
      .dash-stat-card.warning .stat-icon { background: rgba(255, 159, 67, 0.1); color: var(--accent-orange); box-shadow: 0 0 20px rgba(255, 159, 67, 0.08); }
      .dash-stat-card .label { font-size: 0.63rem; font-weight: 800; color: rgba(255,255,255,0.4); letter-spacing: 1.5px; }
      .dash-stat-card .value { font-size: 2rem; font-weight: 900; color: #fff; font-family: 'Rajdhani', sans-serif; line-height: 1.1; margin: 2px 0; }
      .dash-stat-card .sub-label { font-size: 0.68rem; color: var(--text-dim); }
      
      /* Counter animation */
      @keyframes countPulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
      .dash-stat-card .value.counted { animation: countPulse 0.4s ease-out; }
      
      /* Stat card entrance animation */
      @keyframes statCardIn { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      .dash-stat-card { animation: statCardIn 0.5s ease-out backwards; }
      .dash-stat-card:nth-child(1) { animation-delay: 0.05s; }
      .dash-stat-card:nth-child(2) { animation-delay: 0.12s; }
      .dash-stat-card:nth-child(3) { animation-delay: 0.19s; }
      .dash-stat-card:nth-child(4) { animation-delay: 0.26s; }

      /* Maintenance Plan Section */
      .maintenance-plan-section { padding: 1.5rem; }
      .maintenance-plan-section .legend { display: flex; gap: 1rem; }
      .l-item { font-size: 0.65rem; display: flex; align-items: center; gap: 6px; font-weight: 700; color: var(--text-muted); }
      .l-item::before { content: ''; width: 8px; height: 8px; border-radius: 50%; }
      .l-item.overdue::before { background: var(--accent-red); }
      .l-item.warning::before { background: var(--accent-orange); }
      .l-item.safe::before { background: var(--accent-green); }

      .plan-table-container { max-height: 400px; overflow-y: auto; margin-top: 1rem; }
      .plan-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
      .plan-table th { text-align: left; padding: 1rem; color: var(--text-muted); font-family: 'Rajdhani'; letter-spacing: 1px; border-bottom: 2px solid rgba(255,255,255,0.05); }
      .plan-table td { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.02); }
      
      .plan-table tr.overdue td { background: rgba(255, 77, 77, 0.05); }
      .plan-table tr.warning td { background: rgba(255, 159, 67, 0.05); }
      
      .m-tag { font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 4px; }
      .m-tag.next { border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-weight: 700; }

      .plan-status-pill { font-size: 0.65rem; font-weight: 900; padding: 4px 10px; border-radius: 4px; }
      .plan-status-pill.overdue { background: var(--accent-red); color: #fff; }
      .plan-status-pill.warning { background: var(--accent-orange); color: #fff; }
      .plan-status-pill.safe { background: var(--accent-green); color: #000; }

      /* Main Grid */
      .dash-agenda-row { display: grid; grid-template-columns: 340px 1fr; gap: 1.5rem; }
      @media (max-width: 1200px) { .dash-agenda-row { grid-template-columns: 1fr; } }
      .dash-agenda-right { display: grid; grid-template-columns: 1fr 350px; gap: 1.5rem; }
      @media (max-width: 1024px) { .dash-agenda-right { grid-template-columns: 1fr; } }

      .section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; }
      .section-header h3 { font-family: 'Rajdhani', sans-serif; font-size: 1rem; color: var(--text-main); letter-spacing: 1px; margin: 0; }
      .count-tag { font-size: 0.65rem; background: var(--accent-cyan); color: #000; font-weight: 900; padding: 2px 8px; border-radius: 4px; }

      .feed-container { display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto; overflow-x: hidden; padding: 4px 8px 4px 4px; }
      .feed-item { background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); padding: 1rem; border-radius: 12px; display: flex; gap: 1rem; cursor: pointer; transition: all 0.2s; position: relative; overflow: hidden; flex-shrink: 0; }
      .feed-item:hover { background: rgba(255,255,255,0.03); border-color: var(--accent-cyan); transform: translateX(5px); }
      .feed-item.emergency { border-left: 4px solid var(--accent-red); }
      
      .feed-marker { width: 4px; height: 100%; position: absolute; left: 0; top: 0; background: var(--accent-cyan); opacity: 0.3; }
      .feed-item.emergency .feed-marker { background: var(--accent-red); opacity: 1; }

      .feed-content { flex: 1; display: flex; flex-direction: column; gap: 6px; }
      .feed-header { display: flex; justify-content: space-between; align-items: center; }
      .site-tag { font-size: 0.9rem; font-weight: 800; color: #fff; }
      .task-type { font-size: 0.65rem; color: var(--accent-cyan); font-weight: 700; text-transform: uppercase; }
      
      .personnel-row { font-size: 0.8rem; color: var(--text-main); display: flex; align-items: center; gap: 8px; }
      .personnel-row i { color: var(--accent-orange); font-size: 0.7rem; }
      
      .task-desc-row { font-size: 0.75rem; color: var(--text-muted); padding: 4px 8px; background: rgba(255,255,255,0.02); border-radius: 4px; margin-top: 2px; line-height: 1.4; display: flex; align-items: flex-start; gap: 8px; }
      .task-desc-row i { color: var(--accent-cyan); font-size: 0.65rem; margin-top: 3px; }

      .status-row { display: flex; justify-content: space-between; align-items: center; margin-top: 4px; }
      .status-text { font-size: 0.7rem; color: var(--text-muted); font-weight: 600; text-transform: uppercase; }
      .time-text { font-size: 0.65rem; color: var(--text-dim); }

      /* Stock Search Card */
      .stock-search-card { padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .stock-search-card h3 { font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; color: var(--accent-cyan); margin: 0; }
      
      .search-box { display: flex; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 4px; }
      .search-box input { flex: 1; background: transparent; border: none; color: #fff; padding: 8px 12px; font-size: 0.85rem; outline: none; }
      .search-box button { background: var(--accent-cyan); border: none; color: #000; width: 36px; height: 36px; border-radius: 6px; cursor: pointer; }
      
      .results-container { min-height: 150px; max-height: 300px; overflow-y: auto; overflow-x: hidden; display: flex; flex-direction: column; gap: 8px; }
      .placeholder { font-size: 0.75rem; color: var(--text-dim); text-align: center; padding: 2rem 1rem; line-height: 1.5; }
      .no-results { color: var(--accent-red); font-size: 0.75rem; text-align: center; padding: 1rem; }
      .loader-mini { color: var(--accent-cyan); font-size: 0.75rem; text-align: center; padding: 1rem; }
      
      .stock-result-item { background: rgba(255,255,255,0.03); padding: 10px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; border-left: 3px solid var(--accent-green); gap: 12px; }
      .stock-result-item .site-info { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
      .stock-result-item .site { font-size: 0.75rem; font-weight: 700; color: var(--text-main); }
      .stock-result-item .desc { font-size: 0.65rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .stock-result-item .qty { font-size: 0.85rem; font-weight: 900; color: var(--accent-green); font-family: 'Rajdhani'; flex-shrink: 0; }

      .quick-actions-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: auto; }
      .action-btn { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all 0.2s; }
      .action-btn:hover { background: rgba(0, 243, 255, 0.05); border-color: rgba(0, 243, 255, 0.1); transform: translateY(-3px); }
      .action-btn i { font-size: 1.2rem; color: var(--accent-cyan); }
      .action-btn span { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }

      .custom-scrollbar::-webkit-scrollbar { width: 4px; }
      .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); }
      .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--accent-cyan); border-radius: 10px; }

      /* ===== AJANDA WIDGET STYLES ===== */
      .dash-agenda-widget {
        padding: 1.25rem;
        border-top: 2px solid #a78bfa;
        position: relative;
        overflow: hidden;
      }
      .dash-agenda-widget::before {
        content: '';
        position: absolute;
        top: -40%;
        right: -40%;
        width: 80%;
        height: 80%;
        background: radial-gradient(circle, rgba(167, 139, 250, 0.06) 0%, transparent 70%);
        pointer-events: none;
      }

      /* Nav Buttons */
      .agenda-nav-btn {
        background: rgba(167, 139, 250, 0.1);
        border: 1px solid rgba(167, 139, 250, 0.2);
        color: #a78bfa;
        width: 28px;
        height: 28px;
        border-radius: 8px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.65rem;
        transition: all 0.2s;
      }
      .agenda-nav-btn:hover {
        background: rgba(167, 139, 250, 0.2);
        transform: scale(1.1);
      }

      /* Mini Calendar */
      .agenda-mini-cal { user-select: none; }
      .cal-header-row {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
        margin-bottom: 4px;
      }
      .cal-day-name {
        text-align: center;
        font-size: 0.55rem;
        font-weight: 900;
        color: rgba(255,255,255,0.25);
        letter-spacing: 1px;
        padding: 4px 0;
      }
      .cal-grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 2px;
      }
      .cal-day {
        text-align: center;
        font-size: 0.7rem;
        padding: 5px 2px;
        border-radius: 6px;
        color: rgba(255,255,255,0.5);
        transition: all 0.2s;
        font-weight: 600;
        position: relative;
      }
      .cal-day.empty { visibility: hidden; }
      .cal-day.today {
        background: rgba(167, 139, 250, 0.2);
        color: #a78bfa;
        font-weight: 900;
        box-shadow: 0 0 10px rgba(167, 139, 250, 0.15);
        border: 1px solid rgba(167, 139, 250, 0.3);
      }
      .cal-day.has-event::after {
        content: '';
        position: absolute;
        bottom: 2px;
        left: 50%;
        transform: translateX(-50%);
        width: 4px;
        height: 4px;
        border-radius: 50%;
      }
      .cal-day.has-event.task::after { background: #f59e0b; }
      .cal-day.has-event.overdue::after { background: #ef4444; box-shadow: 0 0 4px rgba(239,68,68,0.5); }
      .cal-day.has-event.maintenance::after { background: #a78bfa; }

      /* Timeline */
      .agenda-timeline {
        display: flex;
        flex-direction: column;
        gap: 0;
        max-height: 280px;
        overflow-y: auto;
        padding-right: 4px;
      }
      .agenda-event-item {
        display: grid;
        grid-template-columns: 50px 20px 1fr;
        align-items: center;
        padding: 8px 0;
        border-bottom: 1px solid rgba(255,255,255,0.03);
        transition: all 0.2s;
      }
      .agenda-event-item:hover {
        background: rgba(255,255,255,0.02);
        border-radius: 8px;
        padding-left: 6px;
      }
      .agenda-event-item.past { opacity: 0.5; }
      .agenda-event-date {
        font-size: 0.65rem;
        font-weight: 800;
        color: rgba(255,255,255,0.4);
        text-align: right;
        padding-right: 8px;
      }
      .agenda-event-line {
        display: flex;
        justify-content: center;
        position: relative;
      }
      .agenda-event-line::before {
        content: '';
        position: absolute;
        top: -12px;
        bottom: -12px;
        width: 1px;
        background: rgba(255,255,255,0.06);
      }
      .agenda-event-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: var(--ev-color);
        box-shadow: 0 0 6px var(--ev-color);
        position: relative;
        z-index: 1;
      }
      .agenda-event-body { padding-left: 8px; }
      .agenda-event-title {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-main);
        display: flex;
        align-items: center;
      }
      .agenda-event-sub {
        font-size: 0.6rem;
        color: var(--text-muted);
        margin-top: 2px;
      }

      /* Legend */
      .agenda-legend-item {
        display: flex;
        align-items: center;
        gap: 5px;
        font-size: 0.6rem;
        font-weight: 700;
        color: rgba(255,255,255,0.35);
      }
      .agenda-legend-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
      }
    </style>
  `;
};
