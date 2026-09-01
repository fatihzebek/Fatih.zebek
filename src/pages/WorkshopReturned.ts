import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';
import * as XLSX from 'xlsx';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const formatDateOnly = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR');
};

const normalizeKey = (val: string): string => {
  if (!val) return '';
  return val
    .trim()
    .toLowerCase()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c');
};

export const WorkshopReturnedPage = async () => {
  const currentUser = (window as any).currentUser;
  const username = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Atölye Teknisyeni';
  const allRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const warehouses = dataService.getWarehouses();

  // Pre-fetch all service reports to check turbine mounting history
  const turbineUsageMap = new Map<string, {
    siteName: string;
    turbineNo: string;
    date: string;
    personnel: string;
    reportNo: string;
  }>();

  try {
    const allReports = await serviceReportService.getAllReports();
    allReports.forEach(report => {
      if (!report.materials) return;
      report.materials.forEach((mat: any) => {
        if ((mat.used || 0) > 0) {
          const matSap = String(mat.sapNo || '').trim();
          const matSerial = String(mat.serialNo || '').trim().toLowerCase();
          if (matSerial && matSerial !== '-' && matSerial !== 'yok' && matSerial !== 'yoktur') {
            const rawSap = matSap.startsWith('R') ? matSap.slice(1) : matSap;
            const usageInfo = {
              siteName: report.siteName || '',
              turbineNo: report.turbineNo || 'Türbin',
              date: formatDateOnly(report.date),
              personnel: report.createdBy || report.personnel?.[0] || 'Teknisyen',
              reportNo: report.reportNo || report.id || '-'
            };
            turbineUsageMap.set(`${rawSap}___${matSerial}`, usageInfo);
            turbineUsageMap.set(`${matSap}___${matSerial}`, usageInfo);
          }
        }
      });
    });
  } catch (err) {
    console.error("Error loading service reports for returned cards:", err);
  }

  // Pre-calculate card history maps strictly for VALID UNIQUE SERIAL NUMBERS
  const cardHistoryMap = new Map<string, RepairRecord[]>();
  allRepairs.forEach(r => {
    const s = (r.serialNo || '').trim().toLowerCase();
    const sap = (r.sapNo || '').trim();
    // Exclude empty, dash, 'yok', 'yoktur'
    if (s && s !== '-' && s !== 'yok' && s !== 'yoktur') {
      const key = `${sap}___${s}`;
      if (!cardHistoryMap.has(key)) cardHistoryMap.set(key, []);
      cardHistoryMap.get(key)!.push(r);
    }
  });

  // A card is strictly 'Returned from Field' IF:
  // 1. It has a valid unique serial number
  // 2. Its history contains at least one PREVIOUS dispatch (SENT_BACK or COMPLETED)
  // 3. AND it has a newer arrival / repair record after that dispatch
  const returnedItems = allRepairs.filter(r => {
    const s = (r.serialNo || '').trim().toLowerCase();
    const sap = (r.sapNo || '').trim();
    if (!s || s === '-' || s === 'yok' || s === 'yoktur') return false;

    const history = cardHistoryMap.get(`${sap}___${s}`);
    if (!history || history.length < 2) return false;

    // Must have at least one previous dispatch
    const hasPriorDispatch = history.some(h => h.status === 'SENT_BACK' || h.status === 'COMPLETED');
    if (!hasPriorDispatch) return false;

    // Only show current active / arrival records (not the old dispatched record itself unless it is the latest return)
    return r.status === 'PENDING_ARRIVAL' || r.status === 'UNDER_REPAIR' || r.status === 'REPAIRED';
  });

  (window as any)._allReturnedRepairs = returnedItems;
  (window as any)._workshopReturnedSearch = (window as any)._workshopReturnedSearch || '';
  (window as any)._workshopReturnedSiteFilter = (window as any)._workshopReturnedSiteFilter || 'ALL';

  const filterReturnedItems = () => {
    const query = ((window as any)._workshopReturnedSearch || '').trim();
    const siteFilter = (window as any)._workshopReturnedSiteFilter || 'ALL';

    return returnedItems.filter(rep => {
      // Site filter
      if (siteFilter !== 'ALL') {
        const sourceWhId = rep.sourceWarehouseId || '';
        if (sourceWhId !== siteFilter) return false;
      }

      // Search query filter with EXACT MATCH priority on Serial and SAP
      if (query) {
        const cleanQ = normalizeKey(query);

        const hasExactMatch = returnedItems.some(r => {
          const s = normalizeKey(r.serialNo || '');
          const sap = normalizeKey(r.sapNo || '');
          return (s !== '' && s !== '-' && s === cleanQ) || (sap !== '' && sap === cleanQ);
        });

        if (hasExactMatch) {
          const s = normalizeKey(rep.serialNo || '');
          const sap = normalizeKey(rep.sapNo || '');
          return s === cleanQ || sap === cleanQ;
        }

        const sapMatch = normalizeKey(rep.sapNo || '').includes(cleanQ);
        const serialMatch = normalizeKey(rep.serialNo || '').includes(cleanQ);
        const descMatch = normalizeKey(rep.description || '').includes(cleanQ);
        const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '';
        const whMatch = normalizeKey(sourceWh).includes(cleanQ);
        const faultMatch = normalizeKey(rep.faultCode || '').includes(cleanQ) || normalizeKey(rep.faultDesc || '').includes(cleanQ);
        const noteMatch = normalizeKey(rep.repairNotes || '').includes(cleanQ);

        return sapMatch || serialMatch || descMatch || whMatch || faultMatch || noteMatch;
      }

      return true;
    });
  };

  // Handlers
  (window as any).filterWorkshopReturned = (query: string) => {
    (window as any)._workshopReturnedSearch = query;
    const tbody = document.getElementById('workshop-returned-tbody');
    if (tbody) {
      tbody.innerHTML = renderReturnedRows(filterReturnedItems());
    }
  };

  (window as any).setWorkshopReturnedSiteFilter = (siteId: string) => {
    (window as any)._workshopReturnedSiteFilter = siteId;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-returned');
    }
  };

  // Export Excel
  (window as any).exportWorkshopReturnedExcel = () => {
    const filtered = filterReturnedItems();
    if (filtered.length === 0) {
      alert("Dışa aktarılacak kayıt bulunamadı.");
      return;
    }

    const excelData = filtered.map((r, idx) => ({
      'SIRA': idx + 1,
      'SAP NO': r.sapNo,
      'SERİ NO': r.serialNo || '-',
      'MALZEME TANIMI': r.description,
      'ADET': r.quantity || 1,
      'GELDİĞİ SAHA': warehouses.find(w => w.id === r.sourceWarehouseId)?.name || r.sourceWarehouseId || '-',
      'GELİŞ TARİHİ': formatDateTime(r.sentAt || r.receivedAt),
      'GÖNDEREN TEKNİSYEN': r.sentBy || '-',
      'SÖKÜM ARIZA KODU': r.faultCode || '-',
      'ARIZA AÇIKLAMASI': r.faultDesc || '-',
      'DURUM': r.status === 'UNDER_REPAIR' ? 'Onarımda' : r.status === 'REPAIRED' ? 'Revize Sağlam' : 'Kabul Bekleyen'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sahadan Geri Gelenler");
    XLSX.writeFile(wb, `MTA_Sahadan_Geri_Gelen_Kartlar_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderReturnedRows = (items: RepairRecord[]) => {
    if (items.length === 0) {
      return `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3.5rem 1.5rem; color: #94A3B8;">
            <i class="fa-solid fa-arrows-spin" style="font-size: 2.2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; color: #F59E0B;"></i>
            <div style="font-weight: 700; font-size: 0.95rem; color: #CBD5E1;">Sahadan Geri Dönen Kart Bulunmuyor</div>
            <div style="font-size: 0.8rem; color: #64748B; margin-top: 4px;">
              Atölyeden onarılıp sahalara sevk edilen kartlar, sahada çalıştıktan sonra tekrar arızalanıp atölyeye geldiğinde otomatik olarak bu ekranda listelenecektir.
            </div>
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const sourceWhName = warehouses.find(w => w.id === item.sourceWarehouseId)?.name || item.sourceWarehouseId || 'Saha';
      const cleanSerial = (item.serialNo || '').trim().toLowerCase();
      const cleanSap = (item.sapNo || '').trim();
      const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
      
      const history = cardHistoryMap.get(`${cleanSap}___${cleanSerial}`) || [];
      const visits = history.length;
      const usage = (cleanSerial && cleanSerial !== '-' && cleanSerial !== 'yok') ? (turbineUsageMap.get(`${rawSap}___${cleanSerial}`) || turbineUsageMap.get(`${cleanSap}___${cleanSerial}`)) : null;

      // Find previous repair info
      const prevRepair = history.find(h => (h.status === 'SENT_BACK' || h.status === 'COMPLETED' || h.status === 'REPAIRED') && h.id !== item.id);

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          
          <!-- 1. Geliş Tarihi & Kayıt Eden -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            <div style="font-weight: 700; color: #CBD5E1; font-size: 0.8rem;">
              <i class="fa-regular fa-calendar" style="color: #F59E0B; margin-right: 3px;"></i> ${formatDateTime(item.sentAt || item.receivedAt)}
            </div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">
              <i class="fa-solid fa-user" style="margin-right: 3px;"></i> ${item.sentBy || 'Saha Ekibi'}
            </div>
          </td>

          <!-- 2. SAP & Seri No + Geliş Sayısı -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            <div style="color: #00f3ff; font-family: monospace; font-weight: 800; font-size: 0.85rem;">
              <i class="fa-solid fa-barcode"></i> ${item.sapNo}
            </div>
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px;">
              <span style="font-size: 0.75rem; color: #10B981; font-family: monospace; font-weight: 700;">
                Seri: ${item.serialNo}
              </span>
              <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">
                ${visits}. Geliş (Tekrarlı)
              </span>
            </div>
          </td>

          <!-- 3. Malzeme Tanımı -->
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 800; color: #FFF; font-size: 0.88rem;">${item.description}</div>
            <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 2px;">
              Miktar: <strong style="color: #14F195;">${item.quantity || 1} Adet</strong>
            </div>
          </td>

          <!-- 4. Geldiği Saha / Depo -->
          <td style="padding: 0.85rem 0.75rem; color: #E2E8F0; font-size: 0.82rem; font-weight: 700; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c;"></i>
              <span>${sourceWhName}</span>
            </div>
          </td>

          <!-- 5. Sökülme Arıza Kodu & Açıklama -->
          <td style="padding: 0.85rem 0.75rem; max-width: 220px;">
            ${item.faultCode && item.faultCode !== '-' ? `
              <div style="font-weight: 800; color: #EF4444; font-size: 0.78rem;">
                <i class="fa-solid fa-triangle-exclamation"></i> Arıza: ${item.faultCode}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.75rem;">Arıza kodu girilmemiş</span>'}
            ${item.faultDesc && item.faultDesc !== '-' ? `
              <div style="font-size: 0.73rem; color: #CBD5E1; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.faultDesc}">
                ${item.faultDesc}
              </div>
            ` : ''}
          </td>

          <!-- 6. Önceki Onarım Bilgisi -->
          <td style="padding: 0.85rem 0.75rem; max-width: 220px;">
            ${prevRepair ? `
              <div style="font-size: 0.75rem; color: #94A3B8; background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.08); padding: 4px 8px; border-radius: 4px;">
                <div><strong style="color: #60a5fa;">Önceki Teknisyen:</strong> ${prevRepair.repairedBy || 'Atölye'}</div>
                ${prevRepair.repairNotes ? `<div style="color: #CBD5E1; font-style: italic; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${prevRepair.repairNotes}">"${prevRepair.repairNotes}"</div>` : ''}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.75rem;">-</span>'}
          </td>

          <!-- 7. Durum -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            ${item.status === 'UNDER_REPAIR' ? `
              <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem;">
                <i class="fa-solid fa-screwdriver-wrench"></i> Onarımda
              </span>
            ` : item.status === 'REPAIRED' ? `
              <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem;">
                <i class="fa-solid fa-check"></i> Revize Sağlam
              </span>
            ` : `
              <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem;">
                <i class="fa-solid fa-clock"></i> Kabul Bekliyor
              </span>
            `}
          </td>

          <!-- 8. Aksiyonlar -->
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 5px;">
              
              <!-- Onarıma Al Butonu -->
              ${item.status === 'PENDING_ARRIVAL' ? `
                <button onclick="window.takeCardToMyBench('${item.id}')" style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Kartı Masama Al ve Onarıma Başla">
                  <i class="fa-solid fa-screwdriver-wrench"></i> Onarıma Al
                </button>
              ` : ''}

              <!-- Etiket Yazdır Butonu -->
              <button onclick="window.quickPrintSingleCardLabel('${item.id}')" class="btn-cyber" style="background: rgba(255, 235, 59, 0.12); color: #fef08a; border: 1px solid rgba(255, 235, 59, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Etiket Yazdır">
                <i class="fa-solid fa-print"></i> Etiket
              </button>

              <!-- Pasaport & Süreç Butonu -->
              <button onclick="window.openCardHistoryModal('${item.id}')" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Kart Yaşam Döngüsü & Pasaport">
                <i class="fa-solid fa-passport"></i> Pasaport
              </button>

            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const initialFiltered = filterReturnedItems();
  const selectedSite = (window as any)._workshopReturnedSiteFilter || 'ALL';

  // Extract unique source sites
  const returnSiteIds = Array.from(new Set(returnedItems.map(r => r.sourceWarehouseId).filter(Boolean)));

  return `
    <div class="fade-in-up content-area">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #F59E0B; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-arrows-spin" style="margin-right: 0.4rem; color: #F59E0B;"></i> SAHADAN GERİ GELEN KARTLAR
            </h2>
            <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 800;">
              Tekrarlı Arıza & Dönüş Takibi
            </span>
          </div>
          <p style="color: var(--text-dim); margin: 0.35rem 0 0 0; font-size: 0.88rem;">
            Atölyemizde onarılıp sahalara sevk edildikten sonra, sahada çalışırken tekrar arızalanarak atölyeye 2. veya daha fazla kez geri gelen kartların yaşam döngüsü.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="window.exportWorkshopReturnedExcel()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.12); padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <i class="fa-solid fa-file-excel" style="color: #10B981;"></i> EXCEL'E AKTAR
          </button>
          <button onclick="window.navigate('workshop-stock')" class="btn-cyber" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.35); padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-warehouse"></i> ATÖLYE STOĞUNA GEÇ
          </button>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-size: 0.85rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 15px rgba(20,241,149,0.25);">
            <i class="fa-solid fa-screwdriver-wrench"></i> ONARIM MASASINA GEÇ
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(245, 158, 11, 0.04);">
          <div>
            <div style="font-size: 0.76rem; color: #F59E0B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Toplam Geri Dönen Kart</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #F59E0B; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${returnedItems.length} Kart</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.3); display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.2rem;">
            <i class="fa-solid fa-arrows-spin"></i>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(59, 130, 246, 0.04);">
          <div>
            <div style="font-size: 0.76rem; color: #60a5fa; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Dönüş Yapan Sahalar</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #60a5fa; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${returnSiteIds.length} Saha</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 1.2rem;">
            <i class="fa-solid fa-charging-station"></i>
          </div>
        </div>

      </div>

      <!-- Filters & Live Search Toolbar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        
        <!-- Site Dropdown Filter -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          <select onchange="window.setWorkshopReturnedSiteFilter(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.85); border: 1px solid ${selectedSite !== 'ALL' ? '#F59E0B' : 'rgba(255,255,255,0.1)'}; color: ${selectedSite !== 'ALL' ? '#F59E0B' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; min-width: 180px; box-sizing: border-box;">
            <option value="ALL" ${selectedSite === 'ALL' ? 'selected' : ''}>🌐 Tüm Sahalar & Depolar</option>
            ${returnSiteIds.map(sId => {
              const name = warehouses.find(w => w.id === sId)?.name || sId;
              const count = returnedItems.filter(r => r.sourceWarehouseId === sId).length;
              return `<option value="${sId}" ${selectedSite === sId ? 'selected' : ''} style="background: #0B101B; color: #FFF;">${name} (${count} Kart)</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Live Search Input -->
        <div style="position: relative; width: 320px; height: 38px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
          <input 
            type="text" 
            placeholder="SAP, Seri No, Malzeme, Arıza veya Saha ara..." 
            value="${(window as any)._workshopReturnedSearch || ''}"
            oninput="window.filterWorkshopReturned(this.value)" 
            style="width: 100%; height: 38px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #FFF; padding-left: 36px; padding-right: 12px; font-size: 0.82rem; outline: none; box-sizing: border-box;"
          />
        </div>

      </div>

      <!-- Main Dispatches Table -->
      <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 1rem 0.75rem; width: 140px;">GELİŞ TARİHİ</th>
              <th style="padding: 1rem 0.75rem; width: 160px;">SAP & SERİ NO</th>
              <th style="padding: 1rem 0.75rem;">MALZEME TANIMI</th>
              <th style="padding: 1rem 0.75rem; width: 160px;">GELDİĞİ SAHA</th>
              <th style="padding: 1rem 0.75rem; width: 160px;">SÖKÜLME ARIZASI</th>
              <th style="padding: 1rem 0.75rem;">ÖNCEKİ ONARIM BİLGİSİ</th>
              <th style="padding: 1rem 0.75rem; width: 120px;">DURUM</th>
              <th style="padding: 1rem 0.75rem; text-align: right; width: 170px;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="workshop-returned-tbody">
            ${renderReturnedRows(initialFiltered)}
          </tbody>
        </table>
      </div>

    </div>
  `;
};
