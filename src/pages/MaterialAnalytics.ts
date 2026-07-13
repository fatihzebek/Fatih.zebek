import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { inventoryAgent } from '../agents/InventoryAgent';
import { serviceReportService } from '../services/ServiceReportService';
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

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

  // Excel Price Upload Handler
  (window as any).handleExcelPriceUpload = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const originalBtn = document.getElementById('btn-excel-price');
    const originalBtnHtml = originalBtn ? originalBtn.innerHTML : '';
    if (originalBtn) {
      originalBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
      (originalBtn as HTMLButtonElement).disabled = true;
    }

    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        throw new Error('Seçilen Excel dosyası boş veya okunamadı.');
      }

      // Detect headers
      const sampleRow = jsonData[0];
      let sapKey = '';
      let priceKey = '';
      let currencyKey = '';

      Object.keys(sampleRow).forEach(key => {
        const lowerKey = key.toLowerCase().trim();
        if (lowerKey === 'sap' || lowerKey === 'sap no' || lowerKey === 'sap kodu' || lowerKey === 'malzeme kodu' || lowerKey === 'material' || lowerKey === 'n' || lowerKey.includes('sap')) {
          sapKey = key;
        }
        if (lowerKey === 'fiyat' || lowerKey === 'birim fiyat' || lowerKey === 'price' || lowerKey === 'tutar' || lowerKey === 'değer' || lowerKey === 'fiyatı' || lowerKey.includes('fiyat')) {
          priceKey = key;
        }
        if (lowerKey === 'para birimi' || lowerKey === 'currency' || lowerKey === 'birim' || lowerKey === 'döviz' || lowerKey.includes('birim') || lowerKey.includes('döviz')) {
          currencyKey = key;
        }
      });

      if (!sapKey) {
        throw new Error('SAP numarası sütunu bulunamadı. Lütfen sütun adını "SAP" veya "Malzeme Kodu" yapın.');
      }
      if (!priceKey) {
        throw new Error('Fiyat sütunu bulunamadı. Lütfen sütun adını "Fiyat" veya "Birim Fiyat" yapın.');
      }

      let successCount = 0;
      const batchSize = 30;

      for (let i = 0; i < jsonData.length; i += batchSize) {
        const batch = jsonData.slice(i, i + batchSize);
        await Promise.all(batch.map(async (row) => {
          const rawSap = row[sapKey];
          const rawPrice = row[priceKey];
          if (!rawSap) return;

          const sapNo = String(rawSap).trim();
          const price = parseFloat(String(rawPrice).replace(/[^0-9.,]/g, '').replace(',', '.')) || 0;
          let currency: 'TRY' | 'USD' | 'EUR' = 'TRY';

          if (currencyKey && row[currencyKey]) {
            const rawCurr = String(row[currencyKey]).toUpperCase().trim();
            if (rawCurr.includes('USD') || rawCurr.includes('$')) currency = 'USD';
            else if (rawCurr.includes('EUR') || rawCurr.includes('€')) currency = 'EUR';
          }

          const safeSapNo = sapNo.replace(/\//g, '_');
          const docRef = doc(db, 'GlobalMaterialImages', safeSapNo);
          const updates = {
            price,
            currency,
            lastUpdated: serverTimestamp()
          };

          await setDoc(docRef, { sapNo, ...updates }, { merge: true });
          await warehouseService.syncMaterialCardGlobally(sapNo, updates);
          successCount++;
        }));
      }

      alert(`✅ Fiyatlar başarıyla güncellendi! Toplam ${successCount} malzeme güncellendi.`);
      if ((window as any).navigate) {
        (window as any).navigate('material-analytics');
      }
    } catch (err: any) {
      console.error('[ExcelPriceUpload] Error:', err);
      alert('❌ Yükleme başarısız: ' + err.message);
    } finally {
      if (originalBtn) {
        originalBtn.innerHTML = originalBtnHtml;
        (originalBtn as HTMLButtonElement).disabled = false;
      }
      event.target.value = '';
    }
  };

  // Calculations for charts
  const totalItems = conditionCounts.NEW + conditionCounts.REVISED + conditionCounts.DEFECT + conditionCounts.SCRAP || 1;
  const newPct = ((conditionCounts.NEW / totalItems) * 100).toFixed(1);
  const revisedPct = ((conditionCounts.REVISED / totalItems) * 100).toFixed(1);
  const defectPct = ((conditionCounts.DEFECT / totalItems) * 100).toFixed(1);
  const scrapPct = ((conditionCounts.SCRAP / totalItems) * 100).toFixed(1);

  const maxMovingQty = fastMoving.reduce((max, item) => item.qty > max ? item.qty : max, 1);
  const maxSiteQty = topSites.reduce((max, [_, qty]) => qty > max ? qty : max, 1);

  return `
    <div class="fade-in-up content-area" style="padding: 1.5rem; max-width: 1600px; margin: 0 auto; color: #E2E8F0;">
      
      <!-- Top header section -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 style="font-family: 'Rajdhani', sans-serif; font-size: 2.2rem; font-weight: 800; background: linear-gradient(90deg, #14F195, #00F2FE); -webkit-background-clip: text; -webkit-text-fill-color: transparent; text-transform: uppercase; letter-spacing: 2px; margin: 0; display: flex; align-items: center; gap: 12px; filter: drop-shadow(0 0 15px rgba(20,241,149,0.15));">
            <i class="fa-solid fa-chart-line" style="font-size: 1.8rem;"></i> Malzeme Analiz ve Röntgen Raporu
          </h1>
          <p style="color: #94A3B8; font-size: 0.88rem; margin: 5px 0 0 0; font-family: 'Inter', sans-serif;">
            Depolarınızdaki malzemelerin finansal durumunu, sirkülasyon hızlarını ve türbin bazlı tüketimlerini analiz edin.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <!-- Excel price upload -->
          <button id="btn-excel-price" class="btn-cyber" onclick="document.getElementById('excel-price-upload').click()" style="padding: 0.6rem 1.2rem; background: rgba(0,242,254,0.05); color: #00F2FE; border: 1px solid rgba(0,242,254,0.3); border-radius: 10px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-file-excel" style="color: #10B981;"></i> Excel'den Fiyat Yükle
          </button>
          <input type="file" id="excel-price-upload" style="display: none;" accept=".xlsx, .xls" onchange="window.handleExcelPriceUpload(event)">

          <div class="filter-group" style="display: flex; align-items: center; background: rgba(13,18,30,0.6); padding: 4px; border-radius: 10px; border: 1px solid rgba(20,241,149,0.2); box-shadow: 0 0 15px rgba(0,0,0,0.3); gap: 4px;">
            <button class="btn-filter-cyber ${currentPeriod === 'this-week' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-week')">BU HAFTA</button>
            <button class="btn-filter-cyber ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-month')">BU AY</button>
            <button class="btn-filter-cyber ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('last-month')">ÖNCEKİ AY</button>
            <button class="btn-filter-cyber ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-year')">BU YIL</button>
            <button class="btn-filter-cyber ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('all')">TÜMÜ</button>
            
            <div style="width: 1px; height: 20px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
            
            <input type="date" id="analytics-start" class="cyber-input" style="padding: 4px 6px; font-size: 0.72rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #FFF; width: 105px;" value="${localStorage.getItem('analytics_start') || ''}">
            <span style="color: #64748B; font-size: 0.75rem;">-</span>
            <input type="date" id="analytics-end" class="cyber-input" style="padding: 4px 6px; font-size: 0.72rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #FFF; width: 105px;" value="${localStorage.getItem('analytics_end') || ''}">
            <button class="btn-filter-cyber ${currentPeriod === 'custom' ? 'active' : ''}" onclick="window.setCustomAnalyticsPeriod()" style="padding: 4px 8px; border-radius: 6px;" title="Tarih aralığına göre filtrele">
              <i class="fa-solid fa-filter"></i>
            </button>
          </div>

          <button class="btn-cyber" onclick="window.print()" style="padding: 0.6rem 1.2rem; background: rgba(20,241,149,0.05); color: #14F195; border: 1px solid rgba(20,241,149,0.3); border-radius: 10px; font-weight: bold; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; box-shadow: 0 0 10px rgba(20,241,149,0.05);" onmouseover="this.style.background='rgba(20,241,149,0.12)'; this.style.boxShadow='0 0 15px rgba(20,241,149,0.25)';" onmouseout="this.style.background='rgba(20,241,149,0.05)'; this.style.boxShadow='0 0 10px rgba(20,241,149,0.05)'">
            <i class="fa-solid fa-print"></i> Rapor Yazdır
          </button>
        </div>
      </div>

      <!-- AI Alerts Section (Compact, limit to top 3 and expandable) -->
      ${aiAnalysis.alerts.length > 0 ? `
      <div class="glass-panel" style="margin-bottom: 2rem; border: 1px solid rgba(245, 158, 11, 0.25); background: linear-gradient(135deg, rgba(245, 158, 11, 0.06), rgba(0, 0, 0, 0.15)); border-radius: 16px; padding: 1.25rem 1.5rem; box-shadow: 0 10px 30px rgba(245,158,11,0.03); position: relative; overflow: hidden;">
        <div style="position: absolute; top: -15px; right: -15px; font-size: 4rem; color: rgba(245, 158, 11, 0.04); pointer-events: none;"><i class="fa-solid fa-robot"></i></div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h4 style="color: #FBBF24; margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; display: flex; align-items: center; gap: 8px; letter-spacing: 0.5px;">
            <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#FBBF24; animation: pulse-glow 2s infinite;"></span>
            <i class="fa-solid fa-robot"></i> Yapay Zeka Tedarik Teşhisleri (${aiAnalysis.alerts.length} Teşhis)
          </h4>
          ${aiAnalysis.alerts.length > 3 ? `
            <button onclick="window.toggleAllAiAlerts()" id="btn-toggle-alerts" style="background: transparent; border: 1px solid rgba(245,158,11,0.3); color: #FBBF24; padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; cursor: pointer; font-family: 'Rajdhani', sans-serif; transition: all 0.2s;" onmouseover="this.style.background='rgba(245,158,11,0.1)'" onmouseout="this.style.background='transparent'">
              TÜMÜNÜ GÖSTER
            </button>
          ` : ''}
        </div>
        <div id="ai-alerts-compact" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem;">
          ${aiAnalysis.alerts.slice(0, 3).map(a => `
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; color: #E2E8F0; line-height: 1.4; display: flex; gap: 8px; align-items: flex-start;">
              <i class="fa-solid fa-wand-magic-sparkles" style="color: #FBBF24; margin-top: 2px; font-size: 0.85rem;"></i>
              <span>${a}</span>
            </div>
          `).join('')}
        </div>
        ${aiAnalysis.alerts.length > 3 ? `
          <div id="ai-alerts-full" style="display: none; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.75rem; margin-top: 0.75rem; border-top: 1px solid rgba(245,158,11,0.15); padding-top: 0.75rem;">
            ${aiAnalysis.alerts.slice(3).map(a => `
              <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 8px 12px; font-size: 0.8rem; color: #E2E8F0; line-height: 1.4; display: flex; gap: 8px; align-items: flex-start;">
                <i class="fa-solid fa-wand-magic-sparkles" style="color: #FBBF24; margin-top: 2px; font-size: 0.85rem;"></i>
                <span>${a}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
      ` : ''}

      <!-- Main statistics grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.25rem; margin-bottom: 2.5rem;">
        
        <!-- Total Value -->
        <div class="glass-panel" style="background: linear-gradient(135deg, rgba(13,18,30,0.85), rgba(20,241,149,0.03)); border: 1px solid rgba(20,241,149,0.15); padding: 1.5rem; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1.25rem; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, rgba(20,241,149,0.1), rgba(0,242,254,0.05)); border: 1px solid rgba(20,241,149,0.3); display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.5rem; box-shadow: 0 0 15px rgba(20,241,149,0.15);">
            <i class="fa-solid fa-coins"></i>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: 800; letter-spacing: 1.5px; display: block; text-transform: uppercase;">Toplam Envanter Değeri</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #14F195; margin-top: 4px; letter-spacing: 0.5px;">
              ${valueTRY.toLocaleString('tr-TR')} <span style="font-size: 1.1rem; font-weight: 600;">₺</span>
            </div>
            ${valueUSD > 0 || valueEUR > 0 ? `
              <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">
                ${valueUSD > 0 ? `$${valueUSD.toLocaleString('tr-TR')} USD` : ''} 
                ${valueUSD > 0 && valueEUR > 0 ? ' | ' : ''} 
                ${valueEUR > 0 ? `€${valueEUR.toLocaleString('tr-TR')} EUR` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Total SKU -->
        <div class="glass-panel" style="background: linear-gradient(135deg, rgba(13,18,30,0.85), rgba(59,130,246,0.03)); border: 1px solid rgba(59,130,246,0.15); padding: 1.5rem; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1.25rem; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, rgba(59,130,246,0.1), rgba(147,51,234,0.05)); border: 1px solid rgba(59,130,246,0.3); display: flex; align-items: center; justify-content: center; color: #3B82F6; font-size: 1.5rem; box-shadow: 0 0 15px rgba(59,130,246,0.15);">
            <i class="fa-solid fa-barcode"></i>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: 800; letter-spacing: 1.5px; display: block; text-transform: uppercase;">Toplam Malzeme Çeşidi (SKU)</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #3B82F6; margin-top: 4px; letter-spacing: 0.5px;">
              ${allInventory.length} <span style="font-size: 1rem; color: #94A3B8; font-weight: 500;">Çeşit</span>
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">Aktif olarak izlenen farklı SAP kodlu malzemeler.</div>
          </div>
        </div>

        <!-- Critical stock -->
        <div class="glass-panel" style="background: linear-gradient(135deg, rgba(13,18,30,0.85), rgba(239,68,68,0.03)); border: 1px solid rgba(239,68,68,0.15); padding: 1.5rem; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1.25rem; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, rgba(239,68,68,0.1), rgba(249,115,22,0.05)); border: 1px solid rgba(239,68,68,0.3); display: flex; align-items: center; justify-content: center; color: #EF4444; font-size: 1.5rem; box-shadow: 0 0 15px rgba(239,68,68,0.15);">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: 800; letter-spacing: 1.5px; display: block; text-transform: uppercase;">Kritik Stok Uyarısı</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #EF4444; margin-top: 4px; letter-spacing: 0.5px;">
              ${criticalCount} <span style="font-size: 1rem; color: #94A3B8; font-weight: 500;">Malzeme</span>
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">Stok seviyesi kritik limitlerin altına düşmüş ürünler.</div>
          </div>
        </div>

        <!-- Dead stock value -->
        <div class="glass-panel" style="background: linear-gradient(135deg, rgba(13,18,30,0.85), rgba(139,92,246,0.03)); border: 1px solid rgba(139,92,246,0.15); padding: 1.5rem; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1.25rem; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, rgba(139,92,246,0.1), rgba(236,72,153,0.05)); border: 1px solid rgba(139,92,246,0.3); display: flex; align-items: center; justify-content: center; color: #8B5CF6; font-size: 1.5rem; box-shadow: 0 0 15px rgba(139,92,246,0.15);">
            <i class="fa-solid fa-hourglass-end"></i>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: 800; letter-spacing: 1.5px; display: block; text-transform: uppercase;">Atıl / Ölü Stok Değeri (+1 Yıl)</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #8B5CF6; margin-top: 4px; letter-spacing: 0.5px;">
              ${aiAnalysis.deadStockValue.toLocaleString('tr-TR')} <span style="font-size: 1.1rem; font-weight: 600;">₺</span>
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">Son 12 aydır depoda hiç hareket görmemiş malzemeler.</div>
          </div>
        </div>

        <!-- Projected budget cost -->
        <div class="glass-panel" style="background: linear-gradient(135deg, rgba(13,18,30,0.85), rgba(245,158,11,0.03)); border: 1px solid rgba(245,158,11,0.15); padding: 1.5rem; border-radius: 18px; box-shadow: 0 10px 25px rgba(0,0,0,0.3); display: flex; align-items: center; gap: 1.25rem; position: relative;">
          <div style="width: 52px; height: 52px; border-radius: 12px; background: linear-gradient(135deg, rgba(245,158,11,0.1), rgba(251,191,36,0.05)); border: 1px solid rgba(245,158,11,0.3); display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.5rem; box-shadow: 0 0 15px rgba(245,158,11,0.15);">
            <i class="fa-solid fa-chart-line"></i>
          </div>
          <div>
            <span style="font-size: 0.65rem; color: #94A3B8; font-weight: 800; letter-spacing: 1.5px; display: block; text-transform: uppercase;">Tahmini Bütçe İhtiyacı (6 Ay)</span>
            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #F59E0B; margin-top: 4px; letter-spacing: 0.5px;">
              ${aiAnalysis.projectedCost6Months.toLocaleString('tr-TR')} <span style="font-size: 1.1rem; font-weight: 600;">₺</span>
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">Tüketim hızına göre 6 aylık tahmini satın alma ihtiyacı.</div>
          </div>
        </div>

      </div>

      <!-- Main statistics and distribution section -->
      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1.5rem; margin-bottom: 2.5rem; align-items: stretch; flex-wrap: wrap;">
        
        <!-- Hızlı Tüketilenler Listesi -->
        <div class="glass-panel" style="padding: 2rem; background: rgba(13,18,30,0.4); border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.25); display: flex; flex-direction: column;">
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #FBBF24; font-size: 1.25rem; font-weight: 800; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 10px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
            <i class="fa-solid fa-bolt" style="color: #FBBF24; font-size: 1.4rem;"></i> EN HIZLI TÜKETİLEN MALZEMELER (SON 30 GÜN)
          </h3>
          
          <div style="overflow-x: auto; flex-grow: 1;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
              <thead>
                <tr style="color: #94A3B8; font-size: 0.72rem; font-weight: 800; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.08); text-transform: uppercase;">
                  <th style="padding: 10px 8px;">Malzeme Açıklaması</th>
                  <th style="padding: 10px 8px; text-align: center; width: 140px;">Tüketim Miktarı</th>
                  <th style="padding: 10px 8px; text-align: center; width: 120px;">Sıklık Skoru</th>
                  <th style="padding: 10px 8px; width: 180px;">Yoğunluk Grafiği</th>
                </tr>
              </thead>
              <tbody>
                ${fastMoving.length > 0 ? fastMoving.map(item => {
                  const pct = Math.max(5, (item.qty / maxMovingQty) * 100);
                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
                      <td style="padding: 12px 8px; font-weight: 600; color: #FFF; font-size: 0.82rem;">${item.desc}</td>
                      <td style="padding: 12px 8px; text-align: center; color: #EF4444; font-weight: 800; font-family: monospace;">${item.qty} Adet</td>
                      <td style="padding: 12px 8px; text-align: center; color: #94A3B8; font-weight: 500;">${item.count} Kez Çıktı</td>
                      <td style="padding: 12px 8px;">
                        <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; position: relative;">
                          <div style="position: absolute; left: 0; top: 0; bottom: 0; width: ${pct}%; background: linear-gradient(90deg, #F59E0B, #EF4444); border-radius: 10px;"></div>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="4" style="text-align: center; padding: 3rem; color: #64748B;">Seçilen dönemde malzeme tüketim hareketi bulunamadı.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.5rem; justify-content: space-between;">
          
          <!-- Malzeme Durum Dağılımı (Progress Meterlar ile zenginleştirilmiş) -->
          <div class="glass-panel" style="padding: 1.75rem; background: rgba(13,18,30,0.4); border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.25);">
            <h3 style="font-family: 'Rajdhani', sans-serif; color: #14F195; font-size: 1.25rem; font-weight: 800; margin: 0 0 1.25rem 0; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
              <i class="fa-solid fa-pie-chart" style="color: #14F195;"></i> Envanter Durum Dağılımı
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 1.2rem;">
              
              <!-- Yeni (Sağlam) -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
                  <span style="color: #FFF; display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981;"></span> Sağlam (Kusursuz / Yeni)</span>
                  <span style="color: #10B981;">${conditionCounts.NEW} Adet (${newPct}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; position: relative;">
                  <div style="position: absolute; left:0; top:0; bottom:0; width:${newPct}%; background:#10B981; border-radius: 10px; box-shadow: 0 0 8px rgba(16,185,129,0.3);"></div>
                </div>
              </div>

              <!-- Revizyonlu -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
                  <span style="color: #FFF; display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #3B82F6;"></span> Revizyonlu (Yenilenmiş)</span>
                  <span style="color: #3B82F6;">${conditionCounts.REVISED} Adet (${revisedPct}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; position: relative;">
                  <div style="position: absolute; left:0; top:0; bottom:0; width:${revisedPct}%; background:#3B82F6; border-radius: 10px; box-shadow: 0 0 8px rgba(59,130,246,0.3);"></div>
                </div>
              </div>

              <!-- Defect -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
                  <span style="color: #FFF; display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #F59E0B;"></span> Arızalı (Tamir Bekleyen)</span>
                  <span style="color: #F59E0B;">${conditionCounts.DEFECT} Adet (${defectPct}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; position: relative;">
                  <div style="position: absolute; left:0; top:0; bottom:0; width:${defectPct}%; background:#F59E0B; border-radius: 10px; box-shadow: 0 0 8px rgba(245,158,11,0.3);"></div>
                </div>
              </div>

              <!-- Scrap -->
              <div>
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-bottom: 4px; font-weight: 600;">
                  <span style="color: #FFF; display: flex; align-items: center; gap: 6px;"><span style="width: 8px; height: 8px; border-radius: 50%; background: #EF4444;"></span> Hurda (Kullanım Dışı)</span>
                  <span style="color: #EF4444;">${conditionCounts.SCRAP} Adet (${scrapPct}%)</span>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.05); border-radius: 10px; overflow: hidden; position: relative;">
                  <div style="position: absolute; left:0; top:0; bottom:0; width:${scrapPct}%; background:#EF4444; border-radius: 10px; box-shadow: 0 0 8px rgba(239,68,68,0.3);"></div>
                </div>
              </div>

            </div>
          </div>

          <!-- Saha Bazlı Tüketim (Görsel Grafikler ile) -->
          <div class="glass-panel" style="padding: 1.75rem; background: rgba(13,18,30,0.4); border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.25);">
            <h3 style="font-family: 'Rajdhani', sans-serif; color: #A855F7; font-size: 1.25rem; font-weight: 800; margin: 0 0 1.25rem 0; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
              <i class="fa-solid fa-industry" style="color: #A855F7;"></i> Saha Bazlı Tüketim Dağılımı
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 0.95rem;">
              ${topSites.length > 0 ? topSites.slice(0, 5).map(([site, qty]) => {
                const sitePct = Math.max(5, (qty / maxSiteQty) * 100);
                return `
                  <div>
                    <div style="display: flex; justify-content: space-between; font-size: 0.78rem; margin-bottom: 3px; font-weight: 600;">
                      <span style="color: #E2E8F0;">${site}</span>
                      <span style="color: #A855F7; font-family: monospace; font-weight: bold;">${qty} Adet</span>
                    </div>
                    <div style="width: 100%; height: 5px; background: rgba(255,255,255,0.04); border-radius: 10px; overflow: hidden; position: relative;">
                      <div style="position: absolute; left:0; top:0; bottom:0; width:${sitePct}%; background:linear-gradient(90deg, #A855F7, #EC4899); border-radius: 10px;"></div>
                    </div>
                  </div>
                `;
              }).join('') : '<div style="color: #64748B; font-size: 0.8rem; text-align: center; padding: 1.5rem;">Saha tüketim verisi bulunamadı.</div>'}
            </div>
          </div>

        </div>
      </div>

      <!-- Türbin Bazlı Tüketim Analizi (Servis Raporlarından) -->
      <div class="glass-panel" style="padding: 2rem; background: rgba(13,18,30,0.4); border-radius: 20px; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 15px 35px rgba(0,0,0,0.25);">
        <h3 style="font-family: 'Rajdhani', sans-serif; color: #00F2FE; font-size: 1.3rem; font-weight: 800; margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 10px; letter-spacing: 0.5px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
          <i class="fa-solid fa-wind" style="color: #00F2FE; font-size: 1.5rem;"></i> TÜRBİN BAZLI DETAYLI TÜKETİM ANALİZİ (SERVİS RAPORLARI)
        </h3>
        
        <div style="display: flex; flex-direction: column; gap: 0.85rem;">
          ${sortedTurbines.length > 0 ? sortedTurbines.map(([turbineId, data], index) => `
            <div style="background: rgba(10,15,25,0.4); border: 1px solid rgba(255,255,255,0.04); border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
              <!-- Accordion Header -->
              <div onclick="window.toggleTurbineAccordion('turbine-acc-${index}')" style="padding: 1.1rem 1.5rem; display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(20,241,149,0.03)'" onmouseout="this.style.background='transparent'">
                <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 700; color: #FFF; display: flex; align-items: center; gap: 12px;">
                  <i class="fa-solid fa-chevron-right" id="turbine-acc-icon-${index}" style="transition: transform 0.3s; font-size: 0.85rem; color: #00F2FE;"></i>
                  <span>${turbineId}</span>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                  ${data.totalUsed > 0 ? `<span style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); color: #10B981; padding: 4px 14px; border-radius: 30px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-circle-plus" style="font-size: 0.7rem;"></i> +${data.totalUsed} Takılan</span>` : ''}
                  ${data.totalDefect > 0 ? `<span style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); color: #EF4444; padding: 4px 14px; border-radius: 30px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-circle-minus" style="font-size: 0.7rem;"></i> -${data.totalDefect} Sökülen</span>` : ''}
                </div>
              </div>
              
              <!-- Accordion Content -->
              <div id="turbine-acc-${index}" style="display: none; border-top: 1px solid rgba(255,255,255,0.04); background: rgba(0,0,0,0.25);">
                <div style="overflow-x: auto;">
                  <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
                    <thead>
                      <tr style="background: rgba(255,255,255,0.02); color: #94A3B8; text-transform: uppercase; font-size: 0.68rem; font-weight: 800; letter-spacing: 1px;">
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Tarih</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); font-family: monospace;">Rapor No</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">MÇF No</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">SAP No</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05);">Malzeme Açıklaması</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #10B981; width: 100px;">Takılan</th>
                        <th style="padding: 12px 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); text-align: center; color: #EF4444; width: 100px;">Sökülen</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${data.items.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(item => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.01)'" onmouseout="this.style.background='transparent'">
                          <td style="padding: 12px 1.5rem; color: #FFF; font-weight: 500;">${new Date(item.date).toLocaleDateString('tr-TR')}</td>
                          <td style="padding: 12px 1.5rem; color: #94A3B8; font-family: monospace;">${item.reportId}</td>
                          <td style="padding: 12px 1.5rem; color: #F59E0B; font-weight: 700; font-family: monospace;">${item.matFormNo}</td>
                          <td style="padding: 12px 1.5rem; color: #00F2FE; font-family: monospace; font-weight: 600;">${item.sapNo}</td>
                          <td style="padding: 12px 1.5rem; font-weight: 500; color: #FFF;">${item.description}</td>
                          <td style="padding: 12px 1.5rem; text-align: center; font-weight: 800; color: #10B981; font-family: monospace; font-size: 0.9rem;">${item.used > 0 ? `+${item.used}` : '-'}</td>
                          <td style="padding: 12px 1.5rem; text-align: center; font-weight: 800; color: #EF4444; font-family: monospace; font-size: 0.9rem;">${item.defect > 0 ? `-${item.defect}` : '-'}</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          `).join('') : '<div style="text-align: center; padding: 4rem; color: #64748B; border: 1px dashed rgba(255,255,255,0.08); border-radius: 12px; background: rgba(0,0,0,0.1);">Seçili tarih aralığında türbin bazlı malzeme tüketimi bulunamadı.</div>'}
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
      icon.style.transform = 'rotate(90deg)';
    } else {
      content.style.display = 'none';
      icon.style.transform = 'rotate(0deg)';
    }
  }
};

(window as any).toggleAllAiAlerts = () => {
  const fullAlerts = document.getElementById('ai-alerts-full');
  const btn = document.getElementById('btn-toggle-alerts');
  if (fullAlerts && btn) {
    if (fullAlerts.style.display === 'none') {
      fullAlerts.style.display = 'grid';
      btn.innerText = 'DAHA AZ GÖSTER';
    } else {
      fullAlerts.style.display = 'none';
      btn.innerText = 'TÜMÜNÜ GÖSTER';
    }
  }
};
