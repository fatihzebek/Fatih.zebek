import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { inventoryAgent } from '../agents/InventoryAgent';
import { serviceReportService } from '../services/ServiceReportService';

export const MaterialAnalyticsPage = async () => {
  const currentPeriod = localStorage.getItem('analytics_period') || 'this-month';
  // Fetch all warehouses
  const warehouses = dataService.getWarehouses();
  
  let allInventory: any[] = [];
  let allLogs: any[] = [];

  // Parallel fetch inventory and logs for all warehouses
  await Promise.all(warehouses.map(async (w) => {
    try {
      const inv = await warehouseService.getInventory(w.id);
      allInventory = allInventory.concat(inv.map(i => ({...i, warehouseName: w.name, warehouseId: w.id})));
      
      const logs = await warehouseService.getLogs(w.id);
      allLogs = allLogs.concat(logs.map(l => ({...l, warehouseName: w.name, warehouseId: w.id})));
    } catch (e) {
      console.warn('Error fetching data for warehouse', w.id, e);
    }
  }));

  // Run AI Analysis
  const aiAnalysis = inventoryAgent.analyze(allInventory, allLogs);

  // Analyze Inventory Value
  let valueTRY = 0, valueUSD = 0, valueEUR = 0;
  let conditionCounts = { NEW: 0, REVISED: 0, DEFECT: 0, SCRAP: 0 };
  let criticalCount = 0;

  allInventory.forEach(item => {
    // Condition
    const cond = item.condition || 'NEW';
    (conditionCounts as any)[cond] = ((conditionCounts as any)[cond] || 0) + item.quantity;
    
    // Critical
    if (item.criticalLimit && item.quantity <= item.criticalLimit) {
      criticalCount++;
    }

    // Value
    if (item.price && item.quantity > 0) {
      const val = item.price * item.quantity;
      if (item.currency === 'USD') valueUSD += val;
      else if (item.currency === 'EUR') valueEUR += val;
      else valueTRY += val;
    }
  });

  const consumptionLogs = allLogs.filter(l => l.type === 'REMOVE');
  
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const fastMovingMap: {[sap: string]: {desc: string, qty: number, count: number}} = {};
  const siteConsumptionMap: {[site: string]: number} = {};

  consumptionLogs.forEach(log => {
    let logDate = new Date();
    if (log.timestamp?.toDate) logDate = log.timestamp.toDate();
    else if (log.timestamp) logDate = new Date(log.timestamp);

    if (logDate >= thirtyDaysAgo) {
      const sap = log.sapNo || 'UNKNOWN';
      if (!fastMovingMap[sap]) fastMovingMap[sap] = {desc: log.materialName, qty: 0, count: 0};
      fastMovingMap[sap].qty += log.quantity;
      fastMovingMap[sap].count += 1;
    }

    if (log.turbineNo) {
      const turbine = dataService.findTurbineBySerial(log.turbineNo);
      const siteName = turbine ? turbine.siteName : 'Bilinmeyen Saha';
      siteConsumptionMap[siteName] = (siteConsumptionMap[siteName] || 0) + log.quantity;
    }
  });

  const fastMoving = Object.values(fastMovingMap).sort((a,b) => b.qty - a.qty).slice(0, 10);
  const topSites = Object.entries(siteConsumptionMap).sort((a,b) => b[1] - a[1]);

  // Fetch and Process Service Reports for Turbine Material Consumption
  let reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });

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

  const turbineData: Record<string, { totalUsed: number; totalDefect: number; items: any[] }> = {};
  reports.forEach(report => {
     if (!report.materials || report.materials.length === 0) return;
     const turbineId = (report.siteName ? report.siteName + ' ' : '') + (report.turbineNo || report.turbineSerial || 'Bilinmeyen');
     
     if (!turbineData[turbineId]) {
        turbineData[turbineId] = { totalUsed: 0, totalDefect: 0, items: [] };
     }

     report.materials.forEach(mat => {
        if (mat.used > 0 || mat.defectCount > 0) {
           turbineData[turbineId].items.push({
              reportId: report.reportNo || report.id || '',
              date: report.date,
              matFormNo: report.matFormNo || '-',
              sapNo: mat.sapNo || '-',
              description: mat.description,
              used: mat.used || 0,
              defect: mat.defectCount || 0
           });
           turbineData[turbineId].totalUsed += (mat.used || 0);
           turbineData[turbineId].totalDefect += (mat.defectCount || 0);
        }
     });
  });

  const sortedTurbines = Object.entries(turbineData)
      .sort((a, b) => (b[1].totalUsed + b[1].totalDefect) - (a[1].totalUsed + a[1].totalDefect))
      .filter(([_, data]) => data.totalUsed > 0 || data.totalDefect > 0);

  // Expose filter functions
  (window as any).setAnalyticsPeriod = (period: string) => {
    localStorage.setItem('analytics_period', period);
    if ((window as any).navigate) {
        (window as any).navigate('material-analytics');
    }
  };

  (window as any).setCustomAnalyticsPeriod = () => {
    const start = (document.getElementById('analytics-start') as HTMLInputElement)?.value;
    const end = (document.getElementById('analytics-end') as HTMLInputElement)?.value;
    if (start && end) {
      localStorage.setItem('analytics_start', start);
      localStorage.setItem('analytics_end', end);
      (window as any).setAnalyticsPeriod('custom');
    } else {
      alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
    }
  };

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-boxes-stacked" style="margin-right: 0.5rem;"></i> Malzeme Analiz Merkezi
          </h2>
          <div class="filter-group" style="display: flex; align-items: center; flex-wrap: wrap; background: rgba(255,255,255,0.02); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); gap: 4px; margin-top: 1rem;">
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
        <button class="btn-cyber" onclick="window.print()" style="padding: 0.75rem 1.5rem; background: rgba(100,255,218,0.1); color: #64ffda; border-color: rgba(100,255,218,0.2);">
          <i class="fa-solid fa-print" style="margin-right: 0.5rem;"></i> RAPOR YAZDIR
        </button>
      </div>

      <!-- AI Alerts Section -->
      ${aiAnalysis.alerts.length > 0 ? `
      <div class="glass-panel" style="margin-bottom: 1.5rem; border-left: 4px solid #f59e0b; background: rgba(245, 158, 11, 0.05); padding: 1rem 1.5rem;">
        <h4 style="color: #f59e0b; margin: 0 0 0.5rem 0; font-family: 'Rajdhani', sans-serif;"><i class="fa-solid fa-robot"></i> Tedarik Ajanı Önerileri</h4>
        <ul style="margin: 0; padding-left: 1.5rem; color: var(--text-main); font-size: 0.85rem;">
          ${aiAnalysis.alerts.map(a => `<li style="margin-bottom: 0.25rem;">${a}</li>`).join('')}
        </ul>
      </div>
      ` : ''}

      <div class="analytics-grid" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 1rem; margin-bottom: 2rem;">
        <div class="glass-panel stat-card" style="border-left: 4px solid #64ffda; background: #161b22; padding: 1.2rem; border-radius: 12px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">TOPLAM ENVANTER DEĞERİ</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #64ffda; margin-top: 8px;">
            ${valueTRY.toLocaleString('tr-TR')} ₺
          </div>
        </div>

        <div class="glass-panel stat-card" style="border-left: 4px solid #3b82f6; background: #161b22; padding: 1.2rem; border-radius: 12px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">TOPLAM KALEM (SKU)</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #3b82f6; margin-top: 8px;">
            ${allInventory.length} <span style="font-size: 0.8rem; color: var(--text-dim);">Çeşit</span>
          </div>
        </div>

        <div class="glass-panel stat-card" style="border-left: 4px solid #ef4444; background: #161b22; padding: 1.2rem; border-radius: 12px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">KRİTİK STOK</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #ef4444; margin-top: 8px;">
            ${criticalCount} <span style="font-size: 0.8rem; color: var(--text-dim);">Uyarı</span>
          </div>
        </div>

        <div class="glass-panel stat-card" style="border-left: 4px solid #8b5cf6; background: #161b22; padding: 1.2rem; border-radius: 12px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">ÖLÜ STOK DEĞERİ (+1 YIL)</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #8b5cf6; margin-top: 8px;">
            ${aiAnalysis.deadStockValue.toLocaleString('tr-TR')} ₺
          </div>
        </div>

        <div class="glass-panel stat-card" style="border-left: 4px solid #f59e0b; background: #161b22; padding: 1.2rem; border-radius: 12px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">TAHMİNİ BÜTÇE (6 AY)</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #f59e0b; margin-top: 8px;">
            ${aiAnalysis.projectedCost6Months.toLocaleString('tr-TR')} ₺
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem;">
        
        <!-- Hızlı Tüketilenler Listesi -->
        <div class="glass-panel" style="padding: 1.5rem; background: #161b22; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #fcd34d; margin-bottom: 1rem; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-bolt"></i> EN HIZLI TÜKETİLEN MALZEMELER (SON 30 GÜN)
          </h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-size: 0.75rem;">
                  <th style="padding: 1rem 0.5rem;">MALZEME TANIMI</th>
                  <th style="padding: 1rem 0.5rem; text-align: center;">TÜKETİM MİKTARI</th>
                  <th style="padding: 1rem 0.5rem; text-align: center;">İŞLEM SAYISI</th>
                </tr>
              </thead>
              <tbody>
                ${fastMoving.length > 0 ? fastMoving.map(item => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="padding: 1rem 0.5rem; font-weight: 600; color: var(--text-main); font-size: 0.9rem;">${item.desc}</td>
                    <td style="padding: 1rem 0.5rem; text-align: center; color: #ef4444; font-weight: 800;">${item.qty} Adet</td>
                    <td style="padding: 1rem 0.5rem; text-align: center; color: var(--text-dim); font-size: 0.85rem;">${item.count} kez</td>
                  </tr>
                `).join('') : '<tr><td colspan="3" style="text-align: center; padding: 2rem; color: var(--text-dim);">Son 30 güne ait tüketim verisi bulunamadı.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Malzeme Durum Dağılımı -->
          <div class="glass-panel" style="padding: 1.5rem; background: #161b22; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; margin-bottom: 1rem;">DURUM DAĞILIMI</h3>
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color: var(--text-main); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #00ff7f;"></div> Sağlam (Yeni)
                </span>
                <span style="font-weight: 800; color: #00ff7f;">${conditionCounts.NEW}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color: var(--text-main); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #3b82f6;"></div> Revizyonlu
                </span>
                <span style="font-weight: 800; color: #3b82f6;">${conditionCounts.REVISED}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 8px;">
                <span style="color: var(--text-main); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #f59e0b;"></div> Arızalı (Defect)
                </span>
                <span style="font-weight: 800; color: #f59e0b;">${conditionCounts.DEFECT}</span>
              </div>
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: var(--text-main); font-size: 0.9rem; display: flex; align-items: center; gap: 8px;">
                  <div style="width: 10px; height: 10px; border-radius: 50%; background: #ef4444;"></div> Hurda (Scrap)
                </span>
                <span style="font-weight: 800; color: #ef4444;">${conditionCounts.SCRAP}</span>
              </div>
            </div>
          </div>

          <!-- Saha Bazlı Tüketim -->
          <div class="glass-panel" style="padding: 1.5rem; background: #161b22; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
            <h3 style="font-family: 'Rajdhani', sans-serif; color: #a855f7; margin-bottom: 1rem;">SAHA BAZLI TÜKETİM</h3>
            <div style="display: flex; flex-direction: column; gap: 10px;">
              ${topSites.length > 0 ? topSites.map(([site, qty]) => `
                <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 8px 12px; border-radius: 8px;">
                  <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main);">${site}</span>
                  <span style="font-size: 0.85rem; font-weight: 800; color: #a855f7;">${qty} Adet</span>
                </div>
              `).join('') : '<div style="color: var(--text-dim); font-size: 0.85rem; text-align: center;">Kayıt bulunamadı.</div>'}
            </div>
          </div>

        </div>
      </div>

      <!-- Türbin Bazlı Tüketim Analizi (Servis Raporlarından) -->
      <div class="glass-panel" style="margin-top: 2rem; padding: 1.5rem; background: #161b22; border-radius: 16px; border: 1px solid rgba(255,255,255,0.05);">
        <h3 style="font-family: 'Rajdhani', sans-serif; color: #00f3ff; margin-bottom: 1rem; display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-wind"></i> TÜRBİN BAZLI MALZEME TÜKETİM ANALİZİ (SERVİS RAPORLARI)
        </h3>
        
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${sortedTurbines.length > 0 ? sortedTurbines.map(([turbineId, data], index) => `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden;">
              <!-- Accordion Header -->
              <div onclick="window.toggleTurbineAccordion('turbine-acc-${index}')" style="padding: 1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='transparent'">
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 10px;">
                  <i class="fa-solid fa-chevron-down" id="turbine-acc-icon-${index}" style="transition: transform 0.3s; font-size: 0.8rem; color: var(--text-muted);"></i>
                  ${turbineId}
                </div>
                <div style="display: flex; gap: 1rem;">
                  ${data.totalUsed > 0 ? `<span style="background: rgba(34, 197, 94, 0.1); border: 1px solid rgba(34, 197, 94, 0.3); color: #4ade80; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalUsed} Takılan</span>` : ''}
                  ${data.totalDefect > 0 ? `<span style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #f87171; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700;">${data.totalDefect} Sökülen</span>` : ''}
                </div>
              </div>
              
              <!-- Accordion Content -->
              <div id="turbine-acc-${index}" style="display: none; padding: 0; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2);">
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                    <thead>
                      <tr style="background: rgba(255,255,255,0.02); color: var(--text-muted);">
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Tarih</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Rapor No</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">MÇF No</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">SAP No</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Malzeme Açıklaması</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #4ade80;">Takılan (Used)</th>
                        <th style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #f87171;">Sökülen (Defect)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                          <td style="padding: 0.75rem 1rem; color: var(--text-main);">${new Date(item.date).toLocaleDateString('tr-TR')}</td>
                          <td style="padding: 0.75rem 1rem; color: var(--text-muted); font-family: monospace;">${item.reportId}</td>
                          <td style="padding: 0.75rem 1rem; color: var(--accent-orange); font-weight: 600;">${item.matFormNo}</td>
                          <td style="padding: 0.75rem 1rem; color: var(--accent-cyan); font-family: monospace;">${item.sapNo}</td>
                          <td style="padding: 0.75rem 1rem; font-weight: 500; color: var(--text-main);">${item.description}</td>
                          <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #4ade80;">${item.used > 0 ? `+${item.used}` : '-'}</td>
                          <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #f87171;">${item.defect > 0 ? `-${item.defect}` : '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `).join('') : '<div style="text-align: center; padding: 3rem; color: var(--text-muted); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px;">Seçili tarih aralığında türbin bazlı malzeme tüketimi bulunamadı.</div>'}
        </div>
      </div>

    </div>
  `;
};

// Global toggle for UI
(window as any).toggleTurbineAccordion = (id: string) => {
  const content = document.getElementById(id);
  const icon = document.getElementById(id.replace('acc-', 'acc-icon-'));
  if (content && icon) {
    if (content.style.display === 'none') {
      content.style.display = 'block';
      icon.style.transform = 'rotate(180deg)';
    } else {
      content.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
};
