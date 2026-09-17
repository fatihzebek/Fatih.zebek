import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';
import { warehouseService } from '../services/WarehouseService';
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

const formatShelfNo = (rawShelf?: string | null): string => {
  if (!rawShelf || rawShelf === '-' || rawShelf.trim() === '') return '-';
  const trimmed = rawShelf.trim().toUpperCase();
  const match = trimmed.match(/^([A-ZÇĞİÖŞÜ]+)[\s\-_]*(\d+)$/i);
  if (match) {
    const letters = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    const paddedNum = num < 10 ? `0${num}` : `${num}`;
    return `${letters}-${paddedNum}`;
  }
  return trimmed;
};

export const WorkshopReturnedPage = async () => {
  const currentUser = (window as any).currentUser;
  const username = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Atölye Teknisyeni';
  const allRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const warehouses = dataService.getWarehouses();

  (window as any).formatShelfNo = formatShelfNo;

  // 1. INCOMING DISPATCHES (Sahalardan gönderilen, kabul masasında bekleyen kargolar)
  const incomingItems = allRepairs.filter(r => r.status === 'PENDING_ARRIVAL');

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
    // Sevkiyatta hasar görüp sahadan geri gönderilen malzemeler
    if (r.faultCode === 'SEVK_HASARI' && (r.status === 'PENDING_ARRIVAL' || r.status === 'UNDER_REPAIR' || r.status === 'REPAIRED')) {
      return true;
    }

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

  // State Management
  const activeTab: 'INCOMING' | 'REPEATED' = (window as any)._workshopReturnedTab || 'INCOMING';
  (window as any)._workshopReturnedTab = activeTab;
  (window as any)._workshopReturnedSearch = (window as any)._workshopReturnedSearch || '';
  (window as any)._workshopReturnedSiteFilter = (window as any)._workshopReturnedSiteFilter || 'ALL';

  // Filter incoming items
  const filterIncomingItems = () => {
    const query = ((window as any)._workshopReturnedSearch || '').trim();
    const siteFilter = (window as any)._workshopReturnedSiteFilter || 'ALL';

    return incomingItems.filter(rep => {
      if (siteFilter !== 'ALL' && (rep.sourceWarehouseId || '') !== siteFilter) {
        return false;
      }
      if (query) {
        const cleanQ = normalizeKey(query);
        const sapMatch = normalizeKey(rep.sapNo || '').includes(cleanQ);
        const serialMatch = normalizeKey(rep.serialNo || '').includes(cleanQ);
        const descMatch = normalizeKey(rep.description || '').includes(cleanQ);
        const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '';
        const whMatch = normalizeKey(sourceWh).includes(cleanQ);
        const senderMatch = normalizeKey(rep.sentBy || '').includes(cleanQ);
        const dispatchMatch = normalizeKey(rep.dispatchNo || '').includes(cleanQ);
        const faultMatch = normalizeKey(rep.faultCode || '').includes(cleanQ) || normalizeKey(rep.faultDesc || '').includes(cleanQ);

        return sapMatch || serialMatch || descMatch || whMatch || senderMatch || dispatchMatch || faultMatch;
      }
      return true;
    });
  };

  // Filter returned repetitive items
  const filterReturnedItems = () => {
    const query = ((window as any)._workshopReturnedSearch || '').trim();
    const siteFilter = (window as any)._workshopReturnedSiteFilter || 'ALL';

    return returnedItems.filter(rep => {
      if (siteFilter !== 'ALL' && (rep.sourceWarehouseId || '') !== siteFilter) {
        return false;
      }
      if (query) {
        const cleanQ = normalizeKey(query);
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

  // Tab & Filter Handlers
  (window as any).setWorkshopReturnedTab = (tab: 'INCOMING' | 'REPEATED') => {
    (window as any)._workshopReturnedTab = tab;
    (window as any)._workshopReturnedSiteFilter = 'ALL';
    (window as any)._workshopReturnedSearch = '';
    if ((window as any).navigate) {
      (window as any).navigate('workshop-returned');
    }
  };

  (window as any).filterWorkshopReturned = (query: string) => {
    (window as any)._workshopReturnedSearch = query;
    const tbody = document.getElementById('workshop-returned-tbody');
    if (tbody) {
      if (activeTab === 'INCOMING') {
        tbody.innerHTML = renderIncomingRows(filterIncomingItems());
      } else {
        tbody.innerHTML = renderReturnedRows(filterReturnedItems());
      }
    }
  };

  (window as any).setWorkshopReturnedSiteFilter = (siteId: string) => {
    (window as any)._workshopReturnedSiteFilter = siteId;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-returned');
    }
  };

  // Excel Export Handler
  (window as any).exportWorkshopReturnedExcel = () => {
    if (activeTab === 'INCOMING') {
      const items = filterIncomingItems();
      if (items.length === 0) {
        alert("Dışa aktarılacak kabul bekleyen kayıt bulunamadı.");
        return;
      }
      const excelData = items.map((r, idx) => ({
        'SIRA': idx + 1,
        'SEVK FORM NO': r.dispatchNo || 'Formsuz',
        'SEVK TARİHİ': formatDateTime(r.sentAt || r.receivedAt || (r as any).createdAt),
        'GÖNDEREN SAHA': warehouses.find(w => w.id === r.sourceWarehouseId)?.name || r.sourceWarehouseId || '-',
        'GÖNDEREN PERSONEL': r.sentBy || '-',
        'SAP NO': r.sapNo,
        'SERİ NO': r.serialNo || '-',
        'MALZEME TANIMI': r.description,
        'MİKTAR': r.quantity || 1,
        'ARIZA KODU': r.faultCode || '-',
        'ARIZA AÇIKLAMASI': r.faultDesc || '-',
        'DURUM': 'Kabul Bekliyor'
      }));

      const ws = XLSX.utils.json_to_sheet(excelData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Kabul Bekleyen Kargolar");
      XLSX.writeFile(wb, `MTA_Kabul_Bekleyen_Kargolar_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } else {
      const items = filterReturnedItems();
      if (items.length === 0) {
        alert("Dışa aktarılacak kayıt bulunamadı.");
        return;
      }
      const excelData = items.map((r, idx) => ({
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
    }
  };

  // Card Passport Navigation
  (window as any).openCardPassportInReturned = (query: string) => {
    (window as any)._cardPassportQuery = query;
    if ((window as any).navigate) {
      (window as any).navigate('card-passport');
    }
  };

  // =================== RECEIVE MODAL (TESLİM AL) ===================
  (window as any).openReceiveRepairModalInReturned = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const existing = document.getElementById('ret-receive-modal');
    if (existing) existing.remove();

    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Saha';

    const modal = document.createElement('div');
    modal.id = 'ret-receive-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 540px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.7); max-height: 95vh; overflow-y: auto;">
        
        <!-- Header -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-hand-holding-hand"></i> KARTI TESLİM AL & STOĞA AKTAR
          </h3>
          <button onclick="document.getElementById('ret-receive-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <!-- Incoming Info Box -->
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.78rem; margin-bottom:0.4rem; font-weight:700; text-transform:uppercase; letter-spacing:0.5px;">Gelen Malzeme & Sevk Detayları</p>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:0.9rem; border-radius:10px;">
            <span style="font-weight:800; color:#FFF; display:block; font-size:0.95rem; line-height:1.3;">${rep.description}</span>
            <div style="display:flex; flex-wrap:wrap; gap:12px; margin-top:8px; font-size:0.8rem; color:#94A3B8;">
              <span><i class="fa-solid fa-barcode" style="color:#00f3ff;"></i> SAP: <strong style="color:#FFF; font-family:monospace;">${rep.sapNo}</strong></span>
              <span><i class="fa-solid fa-hashtag" style="color:#fbbf24;"></i> Seri No: <strong style="color:#FFF; font-family:monospace;">${rep.serialNo || 'Seri No Yok'}</strong></span>
              <span><i class="fa-solid fa-boxes-stacked" style="color:#14F195;"></i> Miktar: <strong style="color:#FFF;">${rep.quantity || 1} Adet</strong></span>
            </div>
            <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,0.08); font-size:0.8rem; color:#94A3B8; display:flex; flex-direction:column; gap:5px;">
              <div><i class="fa-solid fa-warehouse" style="color:#60A5FA;"></i> Gönderen Saha: <strong style="color:#FFF;">${sourceWhName}</strong></div>
              ${rep.sentBy ? `<div><i class="fa-solid fa-user" style="color:#F59E0B;"></i> Gönderen Kişi: <strong style="color:#FFF;">${rep.sentBy}</strong></div>` : ''}
              ${rep.dispatchNo ? `<div><i class="fa-solid fa-file-invoice" style="color:#14F195;"></i> Sevk / Form No: <strong style="color:#14F195; font-family:monospace;">${rep.dispatchNo}</strong></div>` : ''}
              ${rep.faultCode ? `<div><i class="fa-solid fa-triangle-exclamation" style="color:#EF4444;"></i> Söküm Arızası: <strong style="color:#EF4444;">${rep.faultCode}</strong> ${rep.faultDesc ? `(${rep.faultDesc})` : ''}</div>` : ''}
            </div>
          </div>
        </div>

        <!-- Inputs -->
        <div style="display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">
              ATÖLYE RAF / KONUM NUMARASI (MTA)
            </label>
            <input 
              type="text" 
              id="ret-receive-shelf-input" 
              class="cyber-input" 
              placeholder="Örn: A-01, B-08, Raf-3..." 
              style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.45); border: 1px solid rgba(20,241,149,0.3); border-radius: 8px; color: #FFF; font-weight: 700; font-family: monospace;" 
              value="${formatShelfNo(rep.shelfNo)}"
              onblur="this.value = window.formatShelfNo(this.value)"
            />
            <span style="color:#64748B; font-size:0.72rem; margin-top:3px; display:block;">Standart raf formatı (örn: A-01, B-09) otomatik uygulanır.</span>
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">
              TESLİM ALMA & FİZİKSEL KONTROL NOTU
            </label>
            <textarea 
              id="ret-receive-note-input" 
              class="cyber-input" 
              placeholder="Kargo ambalajı sağlam, fiziksel hasar kontrolü yapıldı, vb..." 
              style="width: 100%; height: 75px; padding: 0.85rem; background: rgba(0,0,0,0.45); border: 1px solid #1E293B; border-radius: 8px; color: #FFF; resize: none; font-size: 0.82rem;"
            ></textarea>
          </div>
        </div>
        
        <!-- Buttons -->
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:1.25rem;">
          <button onclick="document.getElementById('ret-receive-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.7rem 1.25rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);">İptal</button>
          <button id="ret-confirm-receive-btn" onclick="window.submitReceiveRepairInReturned('${rep.id}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.7rem 1.5rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 15px rgba(20,241,149,0.35);">
            <i class="fa-solid fa-check"></i> KABUL ET VE STOĞA AKTAR
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).submitReceiveRepairInReturned = async (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;

    const shelfInput = document.getElementById('ret-receive-shelf-input') as HTMLInputElement;
    const noteInput = document.getElementById('ret-receive-note-input') as HTMLTextAreaElement;

    const rawShelf = shelfInput?.value.trim() || 'Tanımsız';
    const shelfNo = formatShelfNo(rawShelf);
    const note = noteInput?.value.trim() || '';

    const confirmBtn = document.getElementById('ret-confirm-receive-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      (window as any).showToast?.('İşlem', 'Malzeme teslim alınıyor ve Atölye Stoğuna aktarılıyor...', 'info');
      await repairService.receiveRepair(repairId, username, shelfNo, note);

      await warehouseService.updateStockBySap(
        'MTA',
        rep.sapNo,
        rep.quantity || 1,
        {
          user: username,
          reason: `Atölyede teslim alındı. Raf: ${shelfNo}${note ? ' | Not: ' + note : ''}`,
          materialName: rep.description
        },
        'DEFECT',
        shelfNo,
        rep.serialNo || undefined,
        note || undefined
      );

      (window as any).showToast?.('Başarılı', 'Malzeme başarıyla teslim alındı ve Atölye Stoğuna eklendi.', 'success');
      document.getElementById('ret-receive-modal')?.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop-returned');
      }
    } catch (e: any) {
      console.error("Receive repair error:", e);
      alert("Teslim alma başarısız: " + (e?.message || e));
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> KABUL ET VE STOĞA AKTAR';
      }
    }
  };

  // =================== REJECT MODAL (REDDET) ===================
  (window as any).openRejectRepairModalInReturned = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const existing = document.getElementById('ret-reject-modal');
    if (existing) existing.remove();

    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Saha';

    const modal = document.createElement('div');
    modal.id = 'ret-reject-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.7); max-height: 95vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-ban"></i> MALZEMEYİ REDDET & İADE ET
          </h3>
          <button onclick="document.getElementById('ret-reject-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div style="margin-bottom:1.25rem;">
          <div style="background:rgba(239, 68, 68, 0.05); border:1px solid rgba(239, 68, 68, 0.2); padding:0.9rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block; font-size:0.92rem;">${rep.description}</span>
            <div style="font-size:0.8rem; color:#94A3B8; margin-top:5px;">
              <span>SAP: <strong style="color:#FFF;">${rep.sapNo}</strong></span> | 
              <span>Seri: <strong style="color:#FFF;">${rep.serialNo || '-'}</strong></span> | 
              <span>Kaynak: <strong style="color:#FFF;">${sourceWhName}</strong></span>
            </div>
            ${rep.dispatchNo ? `<div style="font-size:0.75rem; color:#14F195; margin-top:4px;">Sevk No: ${rep.dispatchNo}</div>` : ''}
          </div>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">RED / İADE GEREKÇESİ (ZORUNLU)</label>
          <textarea id="ret-reject-reason-input" class="cyber-input" placeholder="Paketleme uygunsuz, kargo hasarlı, yanlış malzeme sevk edilmiş, vb..." style="width: 100%; height: 85px; padding: 0.85rem; background: rgba(0,0,0,0.45); border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; color: #FFF; resize: none; font-size: 0.82rem;"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.08); padding-top:1.25rem;">
          <button onclick="document.getElementById('ret-reject-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.7rem 1.25rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);">Vazgeç</button>
          <button id="ret-confirm-reject-btn" onclick="window.submitRejectRepairInReturned('${rep.id}')" class="btn-cyber" style="background:#EF4444; color:#FFF; font-weight:900; padding:0.7rem 1.5rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 15px rgba(239,68,68,0.3);">
            <i class="fa-solid fa-ban"></i> REDDET VE GERİ GÖNDER
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).submitRejectRepairInReturned = async (repairId: string) => {
    const reasonInput = document.getElementById('ret-reject-reason-input') as HTMLTextAreaElement;
    const reason = reasonInput?.value.trim();
    if (!reason) {
      alert("Lütfen red gerekçesini yazınız.");
      return;
    }

    const confirmBtn = document.getElementById('ret-confirm-reject-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Reddediliyor...';
    }

    try {
      await repairService.rejectRepair(repairId, username, reason);
      (window as any).showToast?.('Başarılı', 'Malzeme reddedildi ve sevk eden depoya iade edildi.', 'success');
      document.getElementById('ret-reject-modal')?.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop-returned');
      }
    } catch (e: any) {
      console.error("Reject repair error:", e);
      alert("Reddetme işlemi başarısız: " + (e?.message || e));
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-ban"></i> REDDET VE GERİ GÖNDER';
      }
    }
  };

  // =================== RENDER INCOMING DISPATCH ROWS ===================
  const renderIncomingRows = (items: RepairRecord[]) => {
    if (items.length === 0) {
      return `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3.5rem 1.5rem; color: #94A3B8;">
            <i class="fa-solid fa-truck-ramp-box" style="font-size: 2.5rem; display: block; margin-bottom: 0.75rem; opacity: 0.4; color: #14F195;"></i>
            <div style="font-weight: 800; font-size: 1rem; color: #E2E8F0;">Kabul Bekleyen Kargo Bulunmuyor</div>
            <div style="font-size: 0.82rem; color: #64748B; margin-top: 4px;">
              Sahalardan veya depolardan tamir merkezine yeni sevk edilen arızalı kartlar olduğunda burada listelenecek ve teslim alma işlemlerini yapabileceksiniz.
            </div>
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const sourceWhName = warehouses.find(w => w.id === item.sourceWarehouseId)?.name || item.sourceWarehouseId || 'Saha / Depo';
      const senderDisplay = item.sentBy && item.sentBy.includes('@') ? item.sentBy.split('@')[0] : (item.sentBy || 'Saha Ekibi');

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          
          <!-- 1. Sevk No & Sevk Tarihi -->
          <td style="padding: 0.75rem 0.6rem; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-family: monospace; font-weight: 800; font-size: 0.84rem; color: #14F195; background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 6px; border-radius: 4px;">
                <i class="fa-solid fa-file-invoice" style="font-size: 0.72rem;"></i> ${item.dispatchNo || 'Formsuz'}
              </span>
            </div>
            <div style="font-size: 0.71rem; color: #94A3B8; margin-top: 3px;">
              <i class="fa-regular fa-calendar" style="color: #F59E0B; margin-right: 3px;"></i> ${formatDateTime(item.sentAt || item.receivedAt || (item as any).createdAt)}
            </div>
          </td>

          <!-- 2. Gönderen Saha / Depo -->
          <td style="padding: 0.75rem 0.6rem;">
            <div style="display: flex; align-items: center; gap: 5px; font-weight: 700; color: #FFF; font-size: 0.83rem; max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${sourceWhName}">
              <i class="fa-solid fa-warehouse" style="color: #60a5fa; flex-shrink: 0;"></i>
              <span style="overflow: hidden; text-overflow: ellipsis;">${sourceWhName}</span>
            </div>
          </td>

          <!-- 3. Gönderen Personel -->
          <td style="padding: 0.75rem 0.6rem;">
            <div style="display: flex; align-items: center; gap: 5px; font-weight: 700; color: #E2E8F0; font-size: 0.81rem; max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.sentBy || 'Saha Ekibi'}">
              <i class="fa-solid fa-user" style="color: #F59E0B; flex-shrink: 0;"></i>
              <span style="overflow: hidden; text-overflow: ellipsis;">${senderDisplay}</span>
            </div>
          </td>

          <!-- 4. SAP & Malzeme Tanımı -->
          <td style="padding: 0.75rem 0.6rem;">
            <div style="color: #00f3ff; font-family: monospace; font-weight: 800; font-size: 0.84rem;">
              <i class="fa-solid fa-barcode"></i> ${item.sapNo}
            </div>
            <div style="font-weight: 700; color: #FFF; font-size: 0.85rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 1px;" title="${item.description}">
              ${item.description}
            </div>
            <div style="font-size: 0.71rem; color: #64748B; margin-top: 1px;">
              Miktar: <strong style="color: #14F195;">${item.quantity || 1} Adet</strong>
            </div>
          </td>

          <!-- 5. Seri No -->
          <td style="padding: 0.75rem 0.6rem; white-space: nowrap;">
            ${(item.serialNo && item.serialNo !== '-' && item.serialNo.toLowerCase() !== 'yok' && item.serialNo.toLowerCase() !== 'tanımsız') 
              ? `<span style="color: #FFF; font-family: monospace; font-weight: 800; font-size: 0.82rem; background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.1);">${item.serialNo}</span>` 
              : `<span style="background: rgba(236, 72, 153, 0.12); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.35); padding: 2px 6px; border-radius: 4px; font-size: 0.71rem; font-weight: 700;">
                  <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.65rem;"></i> Seri Yok
                </span>`
            }
          </td>

          <!-- 6. Arıza Bilgisi & Açıklama -->
          <td style="padding: 0.75rem 0.6rem; max-width: 160px;">
            ${item.faultCode && item.faultCode !== '-' ? `
              <div style="font-weight: 800; color: #EF4444; font-size: 0.75rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.faultCode}">
                <i class="fa-solid fa-triangle-exclamation"></i> ${item.faultCode}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.72rem;">Arıza kodu yok</span>'}
            ${item.faultDesc && item.faultDesc !== '-' ? `
              <div style="font-size: 0.72rem; color: #CBD5E1; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.faultDesc}">
                ${item.faultDesc}
              </div>
            ` : ''}
            ${item.repairImageUrl ? `
              <div style="margin-top: 2px;">
                <a href="${item.repairImageUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; font-size: 0.71rem; text-decoration: underline; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-camera"></i> Fotoğraf
                </a>
              </div>
            ` : ''}
          </td>

          <!-- 7. Durum -->
          <td style="padding: 0.75rem 0.6rem; white-space: nowrap;">
            <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 7px; border-radius: 5px; font-weight: 800; font-size: 0.73rem; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-truck-ramp-box"></i> Kabul Bekliyor
            </span>
          </td>

          <!-- 8. Aksiyonlar -->
          <td style="padding: 0.75rem 0.6rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 5px;">
              <button onclick="window.openReceiveRepairModalInReturned('${item.id}')" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 4px 9px; border-radius: 6px; font-size: 0.74rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; height: 28px; box-sizing: border-box; box-shadow: 0 0 10px rgba(20,241,149,0.3); transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.15)';" onmouseout="this.style.filter='none';" title="Atölyede Teslim Al ve Rafa Koy">
                <i class="fa-solid fa-check"></i> Teslim Al
              </button>
              <button onclick="window.openRejectRepairModalInReturned('${item.id}')" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; height: 28px; box-sizing: border-box; transition: all 0.2s;" onmouseover="this.style.background='#EF4444'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#EF4444';" title="Reddet ve Depoya Geri İade Et">
                <i class="fa-solid fa-ban"></i> Reddet
              </button>
              <button onclick="window.openCardPassportInReturned('${item.serialNo || item.sapNo}')" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); padding: 4px 7px; border-radius: 6px; font-size: 0.74rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; height: 28px; box-sizing: border-box;" title="Kart Yaşam Döngüsü & Pasaport">
                <i class="fa-solid fa-passport"></i> Pasaport
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // =================== RENDER REPETITIVE RETURN ROWS ===================
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
      
      const history = cardHistoryMap.get(`${cleanSap}___${cleanSerial}`) || [];
      const visits = history.length;
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
            <div style="display: flex; align-items: center; gap: 6px; margin-top: 3px; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: #10B981; font-family: monospace; font-weight: 700;">
                Seri: ${item.serialNo || '-'}
              </span>
              ${item.faultCode === 'SEVK_HASARI' ? `
                <span style="background: rgba(239, 68, 68, 0.2); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.5); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">
                  <i class="fa-solid fa-triangle-exclamation"></i> SEVKİYAT HASARI
                </span>
              ` : `
                <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">
                  ${visits}. Geliş (Tekrarlı)
                </span>
              `}
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
                <i class="fa-solid fa-triangle-exclamation"></i> ${item.faultCode === 'SEVK_HASARI' ? 'Sevkiyat Hasarı' : `Arıza: ${item.faultCode}`}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.75rem;">Arıza kodu girilmemiş</span>'}
            ${item.faultDesc && item.faultDesc !== '-' ? `
              <div style="font-size: 0.73rem; color: #CBD5E1; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.faultDesc}">
                ${item.faultDesc}
              </div>
            ` : ''}
            ${item.repairImageUrl ? `
              <div style="margin-top: 4px;">
                <a href="${item.repairImageUrl}" target="_blank" rel="noopener noreferrer" style="color: #38BDF8; font-size: 0.72rem; text-decoration: underline; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-camera"></i> Hasar Görselini İncele
                </a>
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
              ${item.status === 'PENDING_ARRIVAL' ? `
                <button onclick="window.openReceiveRepairModalInReturned('${item.id}')" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-check"></i> Teslim Al
                </button>
              ` : ''}
              <button onclick="window.openCardPassportInReturned('${item.serialNo || item.sapNo}')" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Kart Yaşam Döngüsü & Pasaport">
                <i class="fa-solid fa-passport"></i> Pasaport
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const currentItems = activeTab === 'INCOMING' ? filterIncomingItems() : filterReturnedItems();
  const selectedSite = (window as any)._workshopReturnedSiteFilter || 'ALL';

  // Extract unique source sites based on current tab pool
  const currentPool = activeTab === 'INCOMING' ? incomingItems : returnedItems;
  const siteIds = Array.from(new Set(currentPool.map(r => r.sourceWarehouseId).filter(Boolean)));

  return `
    <div class="fade-in-up content-area" style="max-width: 99%; width: 100%; padding: 1.25rem 1.25rem 4rem 1.25rem;">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-truck-ramp-box" style="margin-right: 0.4rem; color: #F59E0B;"></i> SAHADAN SEVK EDİLENLER & KABUL MASASI
            </h2>
            <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 3px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 800;">
              MTA Kargo & Giriş Kabul Merkezi
            </span>
          </div>
          <p style="color: var(--text-dim); margin: 0.35rem 0 0 0; font-size: 0.88rem;">
            Sahalardan ve depolardan tamir merkezine sevk edilen arızalı kartların kargo kabulü ve tekrarlı arıza / garanti takip masası.
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
            <i class="fa-solid fa-microchip"></i> KART TAMİR MERKEZİ
          </button>
        </div>
      </div>

      <!-- Stats Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div class="glass-panel" onclick="window.setWorkshopReturnedTab('INCOMING')" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(245, 158, 11, 0.35); display: flex; align-items: center; justify-content: space-between; background: ${activeTab === 'INCOMING' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.03)'}; cursor: pointer; transition: all 0.2s;">
          <div>
            <div style="font-size: 0.74rem; color: #F59E0B; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Kabul Bekleyen Kargo</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #F59E0B; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${incomingItems.length} Sevkiyat</div>
            <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">Sahalardan yolda / ambar girişinde</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.25rem;">
            <i class="fa-solid fa-truck-ramp-box"></i>
          </div>
        </div>

        <div class="glass-panel" onclick="window.setWorkshopReturnedTab('REPEATED')" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(168, 85, 247, 0.3); display: flex; align-items: center; justify-content: space-between; background: ${activeTab === 'REPEATED' ? 'rgba(168, 85, 247, 0.1)' : 'rgba(168, 85, 247, 0.03)'}; cursor: pointer; transition: all 0.2s;">
          <div>
            <div style="font-size: 0.74rem; color: #c084fc; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Tekrarlı Arıza & Garanti</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #c084fc; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${returnedItems.length} Kart</div>
            <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">Sahada çalışıp 2.+ kez dönenler</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(168, 85, 247, 0.2); border: 1px solid rgba(168, 85, 247, 0.4); display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 1.25rem;">
            <i class="fa-solid fa-arrows-spin"></i>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(59, 130, 246, 0.04);">
          <div>
            <div style="font-size: 0.74rem; color: #60a5fa; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Aktif Sevkiyat Sahaları</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #60a5fa; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${siteIds.length} Saha</div>
            <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">Kart gönderimi yapan depolar</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 1.25rem;">
            <i class="fa-solid fa-charging-station"></i>
          </div>
        </div>

      </div>

      <!-- Tab Buttons & Filters Toolbar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        
        <!-- Tab Navigation Buttons -->
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button 
            onclick="window.setWorkshopReturnedTab('INCOMING')" 
            style="height: 38px; padding: 0 1.2rem; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'INCOMING' ? '#14F195' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'INCOMING' ? 'rgba(20,241,149,0.18)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'INCOMING' ? '#14F195' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif;"
          >
            <i class="fa-solid fa-truck-ramp-box" style="font-size: 0.9rem;"></i> 
            SAHADAN SEVK EDİLEN KARTLAR (KABUL MASASI) 
            <span style="background: ${activeTab === 'INCOMING' ? '#14F195' : 'rgba(255,255,255,0.1)'}; color: ${activeTab === 'INCOMING' ? '#0A0E17' : '#FFF'}; padding: 1px 7px; border-radius: 10px; font-size: 0.72rem; font-weight: 900;">${incomingItems.length}</span>
          </button>

          <button 
            onclick="window.setWorkshopReturnedTab('REPEATED')" 
            style="height: 38px; padding: 0 1.2rem; border-radius: 8px; font-size: 0.8rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'REPEATED' ? '#c084fc' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'REPEATED' ? 'rgba(168,85,247,0.18)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'REPEATED' ? '#c084fc' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif;"
          >
            <i class="fa-solid fa-arrows-spin" style="font-size: 0.9rem;"></i> 
            TEKRARLI ARIZA & GARANTİ TAKİBİ 
            <span style="background: ${activeTab === 'REPEATED' ? '#c084fc' : 'rgba(255,255,255,0.1)'}; color: ${activeTab === 'REPEATED' ? '#0A0E17' : '#FFF'}; padding: 1px 7px; border-radius: 10px; font-size: 0.72rem; font-weight: 900;">${returnedItems.length}</span>
          </button>
        </div>

        <!-- Filter Dropdown & Search -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          
          <!-- Site Dropdown Filter -->
          <select onchange="window.setWorkshopReturnedSiteFilter(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.85); border: 1px solid ${selectedSite !== 'ALL' ? '#14F195' : 'rgba(255,255,255,0.1)'}; color: ${selectedSite !== 'ALL' ? '#14F195' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; min-width: 190px; box-sizing: border-box;">
            <option value="ALL" ${selectedSite === 'ALL' ? 'selected' : ''}>🌐 Tüm Sahalar (${currentPool.length})</option>
            ${siteIds.map(sId => {
              const name = warehouses.find(w => w.id === sId)?.name || sId;
              const count = currentPool.filter(r => r.sourceWarehouseId === sId).length;
              return `<option value="${sId}" ${selectedSite === sId ? 'selected' : ''} style="background: #0B101B; color: #FFF;">${name} (${count})</option>`;
            }).join('')}
          </select>

          <!-- Live Search Input -->
          <div style="position: relative; width: 280px; height: 38px;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.82rem;"></i>
            <input 
              type="text" 
              placeholder="Form No, Gönderen, SAP, Seri..." 
              value="${(window as any)._workshopReturnedSearch || ''}"
              oninput="window.filterWorkshopReturned(this.value)" 
              style="width: 100%; height: 38px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #FFF; padding-left: 34px; padding-right: 12px; font-size: 0.82rem; outline: none; box-sizing: border-box;"
            />
          </div>

        </div>

      </div>

      <!-- Main Dispatches Table -->
      <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
          <thead>
            ${activeTab === 'INCOMING' ? `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 0.85rem 0.6rem; width: 135px;">SEVK FORM NO & TARİH</th>
                <th style="padding: 0.85rem 0.6rem; width: 130px;">GÖNDEREN SAHA</th>
                <th style="padding: 0.85rem 0.6rem; width: 130px;">GÖNDEREN KİŞİ</th>
                <th style="padding: 0.85rem 0.6rem;">MALZEME TANIMI & SAP</th>
                <th style="padding: 0.85rem 0.6rem; width: 115px;">SERİ NO</th>
                <th style="padding: 0.85rem 0.6rem; width: 140px;">SÖKÜM ARIZASI</th>
                <th style="padding: 0.85rem 0.6rem; width: 110px;">DURUM</th>
                <th style="padding: 0.85rem 0.6rem; text-align: right; width: 180px;">KABUL İŞLEMLERİ</th>
              </tr>
            ` : `
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 0.85rem 0.6rem; width: 130px;">GELİŞ TARİHİ</th>
                <th style="padding: 0.85rem 0.6rem; width: 140px;">SAP & SERİ NO</th>
                <th style="padding: 0.85rem 0.6rem;">MALZEME TANIMI</th>
                <th style="padding: 0.85rem 0.6rem; width: 140px;">GELDİĞİ SAHA</th>
                <th style="padding: 0.85rem 0.6rem; width: 150px;">SÖKÜLME ARIZASI</th>
                <th style="padding: 0.85rem 0.6rem;">ÖNCEKİ ONARIM BİLGİSİ</th>
                <th style="padding: 0.85rem 0.6rem; width: 115px;">DURUM</th>
                <th style="padding: 0.85rem 0.6rem; text-align: right; width: 140px;">İŞLEMLER</th>
              </tr>
            `}
          </thead>
          <tbody id="workshop-returned-tbody">
            ${activeTab === 'INCOMING' ? renderIncomingRows(currentItems) : renderReturnedRows(currentItems)}
          </tbody>
        </table>
      </div>

    </div>
  `;
};
