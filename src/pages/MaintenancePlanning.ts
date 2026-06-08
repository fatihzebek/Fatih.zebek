import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';

export const MaintenancePlanningPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const allSites = dataService.getSites();
  const sites = isAdmin ? allSites : allSites.filter(s => currentUser?.allowedSites?.includes(s.id));
  const reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
  const now = new Date();

  // Maintenance Tracking Logic
  const maintenancePlan = (() => {
    const plan: any[] = [];

    sites.forEach(site => {
      const siteTurbines = dataService.getTurbinesBySite(site.id);
      siteTurbines.forEach(t => {
        const turbineReports = reports.filter(r => r.turbineSerial === t.id);
        const lastMaint = turbineReports
          .filter(r => {
            const typeLower = (r.type || '').toLowerCase();
            const templateLower = (r.templateName || '').toLowerCase();
            const faultLower = (r.faultCode || '').toLowerCase();
            return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
                   templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
                   faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastMaint) {
          const lastDate = new Date(lastMaint.date);
          const nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 6);

          const searchStr = `${lastMaint.type} ${lastMaint.templateName} ${lastMaint.faultCode}`.toLowerCase();
          const isLastAna = searchStr.includes('ana');
          const lastType = isLastAna ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
          const nextType = isLastAna ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';

          const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let status: 'safe' | 'warning' | 'overdue' = 'safe';
          if (diffDays < 0) status = 'overdue';
          else if (diffDays < 30) status = 'warning';

          plan.push({
            siteName: site.name,
            turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
            lastDate: lastMaint.date,
            lastType,
            nextDate: nextDate.toISOString(),
            nextType,
            status,
            daysRemaining: diffDays
          });
        } else {
          plan.push({
            siteName: site.name,
            turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
            lastDate: '-',
            lastType: 'VERİ YOK',
            nextDate: null,
            nextType: 'BELİRLENMEDİ',
            status: 'safe',
            daysRemaining: 0
          });
        }
      });
    });

    return plan;
  })();

  const groupedPlan: Record<string, any[]> = {};
  maintenancePlan.forEach(p => {
    if (!groupedPlan[p.siteName]) groupedPlan[p.siteName] = [];
    groupedPlan[p.siteName].push(p);
  });

  const customOrder = [
    'Alize Germiyan',
    'Mare Manastır',
    'Anemon İntepe',
    'Doğal Sayalar',
    'Dares Datça',
    'Alize Çamseki',
    'Alize Keltepe',
    'Alize Sarıkaya',
    'Alize Kuyucak',
    'Alize Çataltape'
  ];

  const siteList = Object.keys(groupedPlan).sort((a, b) => {
    const indexA = customOrder.findIndex(o => o.toLowerCase() === a.toLowerCase());
    const indexB = customOrder.findIndex(o => o.toLowerCase() === b.toLowerCase());
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  // Expose to window for initialization
  (window as any).maintData = groupedPlan;
  (window as any).initMaintenancePlanning = () => {
    const maintData = (window as any).maintData;
    const body = document.getElementById('maint-data-body');
    const title = document.getElementById('active-site-title');
    if (!body || !title) return;

    function updateTable(siteName: string) {
      const items = maintData[siteName] || [];
      title!.textContent = siteName.toUpperCase();
      
      let html = '';
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dateStr = item.lastDate === '-' ? '-' : new Date(item.lastDate).toLocaleDateString('tr-TR');
        const isNoData = item.lastType === 'VERİ YOK';
        const tNo = String(item.turbineNo || '');
        const tName = tNo.startsWith('T-') ? tNo : 'T-' + tNo;
        const daysTxt = isNoData ? '-' : (item.daysRemaining < 0 ? Math.abs(item.daysRemaining) + ' GÜN GEÇTİ' : item.daysRemaining + ' GÜN');
        const statusTxt = isNoData ? 'KAYIT YOK' : (item.status === 'overdue' ? 'KRİTİK GECİKME' : (item.status === 'warning' ? 'YAKLAŞIYOR' : 'PLANLI'));
        const statusClass = isNoData ? 'none' : item.status;
        
        html += '<tr style="opacity: ' + (isNoData ? '0.6' : '1') + '">';
        html += '<td class="t-no">' + tName + '</td>';
        html += '<td>' + dateStr + '</td>';
        html += '<td><span class="type-badge">' + item.lastType + '</span></td>';
        html += '<td><span class="type-badge next">' + item.nextType + '</span></td>';
        html += '<td class="days-val ' + item.status + '">' + daysTxt + '</td>';
        html += '<td style="text-align: right;"><span class="status-pill ' + statusClass + '">' + statusTxt + '</span></td>';
        html += '</tr>';
      }
      body!.innerHTML = html;
    }

    // Initialize first site
    const firstSite = siteList[0] || '';
    if (firstSite) updateTable(firstSite);

    // Event listeners
    document.querySelectorAll('.site-menu-item').forEach(item => {
      item.addEventListener('click', function(this: HTMLElement) {
        document.querySelectorAll('.site-menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const s = this.getAttribute('data-site');
        if (s) updateTable(s);
      });
    });

    const searchInput = document.getElementById('maint-site-search');
    if (searchInput) {
      searchInput.addEventListener('input', function(this: HTMLInputElement) {
        const q = this.value.toLowerCase();
        document.querySelectorAll('.site-menu-item').forEach(it => {
          const n = (it as HTMLElement).getAttribute('data-site')?.toLowerCase() || '';
          (it as HTMLElement).style.display = n.indexOf(q) > -1 ? 'flex' : 'none';
        });
      });
    }
  };

  return `
    <div class="fade-in-up maintenance-planning-container">
      <div class="page-header">
        <div class="header-content">
          <h1><i class="fa-solid fa-calendar-check"></i> BAKIM PLANLAMA MERKEZİ</h1>
          <p>6 Aylık periyodik bakım döngüsü ve saha bazlı takip merkezi.</p>
        </div>
        <div class="header-stats">
          <div class="h-stat overdue">
            <span class="v">${maintenancePlan.filter(p => p.status === 'overdue').length}</span>
            <span class="l">GECİKMİŞ</span>
          </div>
          <div class="h-stat warning">
            <span class="v">${maintenancePlan.filter(p => p.status === 'warning').length}</span>
            <span class="l">KRİTİK</span>
          </div>
        </div>
      </div>

      <div class="maintenance-planning-layout">
        <!-- Sidebar -->
        <div class="sites-sidebar glass-panel">
          <div class="sidebar-header">
            <div class="search-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="maint-site-search" placeholder="Saha ara...">
            </div>
          </div>
          <div class="sites-list custom-scrollbar">
            ${siteList.map((siteName, idx) => `
              <div class="site-menu-item ${idx === 0 ? 'active' : ''}" data-site="${siteName}">
                <i class="fa-solid fa-charging-station"></i>
                <span class="s-name">${siteName}</span>
                ${groupedPlan[siteName].some(i => i.status === 'overdue') ? '<span class="alert-dot"></span>' : ''}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Main Content -->
        <div class="maintenance-main-content glass-panel">
          <div class="view-header">
            <div class="site-title-box">
              <i class="fa-solid fa-wind"></i>
              <h2 id="active-site-title">${siteList[0]?.toUpperCase() || 'SAHA SEÇİN'}</h2>
            </div>
            <div class="maint-legend">
              <span class="leg-box overdue">Gecikmiş</span>
              <span class="leg-box warning">Kritik</span>
              <span class="leg-box safe">Planlı</span>
            </div>
          </div>
          
          <div class="table-frame custom-scrollbar">
            <table class="maint-data-table">
              <thead>
                <tr>
                  <th>TÜRBİN</th>
                  <th>SON BAKIM</th>
                  <th>SON TİP</th>
                  <th>HEDEF BAKIM</th>
                  <th>KALAN GÜN</th>
                  <th style="text-align: right;">DURUM</th>
                </tr>
              </thead>
              <tbody id="maint-data-body">
                <!-- Data will be injected by init function -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <style>
      .maintenance-planning-container { padding: 25px; display: flex; flex-direction: column; gap: 20px; height: 100%; }
      .page-header { display: flex; justify-content: space-between; align-items: center; }
      .header-content h1 { font-family: 'Rajdhani'; font-size: 1.8rem; color: #fff; margin: 0; letter-spacing: 2px; display: flex; align-items: center; gap: 15px; }
      .header-content p { color: var(--text-muted); margin: 5px 0 0 0; font-size: 0.9rem; }
      
      .header-stats { display: flex; gap: 12px; }
      .h-stat { background: rgba(255,255,255,0.03); padding: 8px 15px; border-radius: 10px; display: flex; flex-direction: column; align-items: center; min-width: 90px; border: 1px solid rgba(255,255,255,0.05); }
      .h-stat.overdue { border-bottom: 3px solid #ff4d4d; }
      .h-stat.warning { border-bottom: 3px solid #ff9f43; }
      .h-stat .v { font-family: 'Rajdhani'; font-size: 1.3rem; font-weight: 800; color: #fff; }
      .h-stat .l { font-size: 0.6rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; }

      .maintenance-planning-layout { display: flex; gap: 20px; flex: 1; min-height: 0; }
      .sites-sidebar { width: 280px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.05); background: rgba(10, 15, 25, 0.4); flex-shrink: 0; }
      .sidebar-header { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .sites-list { flex: 1; overflow-y: auto; padding: 10px; }
      
      .site-menu-item { 
        display: flex; align-items: center; gap: 12px; padding: 10px 15px; border-radius: 8px; cursor: pointer; 
        transition: all 0.2s; color: var(--text-muted); position: relative; margin-bottom: 4px;
      }
      .site-menu-item i { font-size: 1rem; opacity: 0.6; color: #a0aec0; }
      .site-menu-item .s-name { font-weight: 500; font-size: 0.9rem; }
      .site-menu-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
      .site-menu-item.active { background: rgba(0, 242, 255, 0.1); color: var(--accent-cyan); border-left: 3px solid var(--accent-cyan); border-radius: 0 8px 8px 0; }
      .site-menu-item.active i { opacity: 1; color: var(--accent-cyan); }
      
      .alert-dot { width: 6px; height: 6px; background: #ff4d4d; border-radius: 50%; position: absolute; right: 12px; box-shadow: 0 0 10px #ff4d4d; }

      .maintenance-main-content { flex: 1; display: flex; flex-direction: column; padding: 25px; border: 1px solid rgba(255,255,255,0.05); background: rgba(10, 15, 25, 0.4); }
      .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px; }
      .site-title-box { display: flex; align-items: center; gap: 12px; }
      .site-title-box i { color: var(--accent-cyan); font-size: 1.2rem; }
      .site-title-box h2 { margin: 0; font-family: 'Rajdhani'; letter-spacing: 2px; color: #fff; font-size: 1.4rem; }
      
      .maint-legend { display: flex; gap: 15px; }
      .leg-box { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
      .leg-box::before { content: ''; width: 8px; height: 8px; border-radius: 50%; }
      .leg-box.overdue::before { background: #ff4d4d; box-shadow: 0 0 8px #ff4d4d; }
      .leg-box.warning::before { background: #ff9f43; }
      .leg-box.safe::before { background: #1ed760; }

      .table-frame { flex: 1; overflow-y: auto; }
      .maint-data-table { width: 100%; border-collapse: collapse; }
      .maint-data-table th { text-align: left; padding: 12px; color: var(--text-muted); font-family: 'Rajdhani'; border-bottom: 2px solid rgba(255,255,255,0.05); position: sticky; top: 0; background: #0f141c; z-index: 10; font-size: 0.75rem; letter-spacing: 1px; }
      .maint-data-table td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); color: var(--text-main); font-size: 0.85rem; }
      
      .t-no { font-family: 'Rajdhani'; font-weight: 800; color: #fff; font-size: 1.1rem; }
      .type-badge { background: rgba(255,255,255,0.05); padding: 3px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; color: var(--text-muted); }
      .type-badge.next { border: 1px solid rgba(0, 242, 255, 0.3); color: var(--accent-cyan); }
      .days-val { font-family: 'Rajdhani'; font-weight: 700; }
      .days-val.overdue { color: #ff4d4d; }
      .days-val.warning { color: #ff9f43; }
      
      .status-pill { padding: 4px 10px; border-radius: 4px; font-size: 0.65rem; font-weight: 900; letter-spacing: 0.5px; }
      .status-pill.overdue { background: rgba(255, 77, 77, 0.2); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.3); }
      .status-pill.warning { background: rgba(255, 159, 67, 0.2); color: #ff9f43; }
      .status-pill.safe { background: rgba(30, 215, 96, 0.2); color: #1ed760; }
      .status-pill.none { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); }

      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }

      @media (max-width: 768px) {
        .maintenance-planning-container { padding: 10px; gap: 15px; }
        .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
        .maintenance-planning-layout { flex-direction: column; }
        .sites-sidebar { width: 100%; height: 300px; }
        .maintenance-main-content { padding: 15px; overflow-x: auto; }
        .maint-data-table { min-width: 600px; }
      }
    </style>
  `;
};
