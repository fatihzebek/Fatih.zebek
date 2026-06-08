import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { inventoryAgent } from '../agents/InventoryAgent';

export const MaterialAnalyticsPage = async () => {
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

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-boxes-stacked" style="margin-right: 0.5rem;"></i> Malzeme Analiz Merkezi
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Genel envanter durumu, değerleme ve yapay zeka destekli saha tüketim analizi.</p>
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
    </div>
  `;
};
