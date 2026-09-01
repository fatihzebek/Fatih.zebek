import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { inventoryService } from '../services/InventoryService';
import { warehouseService } from '../services/WarehouseService';
import * as XLSX from 'xlsx';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

const formatDateOnly = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleDateString('tr-TR');
};

export const generateMtaSerialNo = (sapNo: string, allRepairs: RepairRecord[]): string => {
  const cleanSap = (sapNo || 'CARD').trim();
  const prefix = `MTA-${cleanSap}-`;
  let maxSeq = 0;
  allRepairs.forEach(r => {
    if (r.serialNo && r.serialNo.toUpperCase().startsWith(prefix.toUpperCase())) {
      const numPart = r.serialNo.toUpperCase().replace(prefix.toUpperCase(), '').trim();
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `MTA-${cleanSap}-${nextSeq}`;
};

export const WorkshopStockPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role === 'ADMIN' || currentUser?.email === 'fatih.zebek@demirerholding.com' || (currentUser?.email?.includes('fatih.zebek') ?? false);
  const username = currentUser?.displayName || currentUser?.email || 'Merkez Tamir Atölyesi';

  // Fetch all unassigned warehouse repair records (exclude sent back and exclude items currently on the bench)
  const rawRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const allRepairs: RepairRecord[] = rawRepairs.filter(r => 
    r.status !== 'SENT_BACK' && 
    r.status !== 'COMPLETED' && 
    r.status !== 'SCRAPPED' && 
    r.status !== 'REJECTED' &&
    !r.rejectedAt
  );
  const warehouses = dataService.getWarehouses();

  (window as any)._allStockRepairs = allRepairs;
  (window as any)._workshopStockTab = (window as any)._workshopStockTab || 'ALL';
  (window as any)._workshopStockSearch = (window as any)._workshopStockSearch || '';
  (window as any)._workshopStockSapFilter = (window as any)._workshopStockSapFilter || '';
  (window as any)._workshopStockViewMode = (window as any)._workshopStockViewMode || 'DETAILED';
  (window as any)._workshopStockPage = (window as any)._workshopStockPage || 1;
  const PAGE_SIZE = 50;

  // Helper to normalize Turkish strings and remove spaces/punctuation
  const normalizeKey = (str: string): string => {
    return (str || '')
      .replace(/İ/g, 'i')
      .replace(/I/g, 'i')
      .replace(/ı/g, 'i')
      .replace(/Ş/g, 's')
      .replace(/ş/g, 's')
      .replace(/Ğ/g, 'g')
      .replace(/ğ/g, 'g')
      .replace(/Ü/g, 'u')
      .replace(/ü/g, 'u')
      .replace(/Ö/g, 'o')
      .replace(/ö/g, 'o')
      .replace(/Ç/g, 'c')
      .replace(/ç/g, 'c')
      .toLowerCase()
      .replace(/[\s_\-.:/()]/g, '');
  };

  // Pre-normalize all repair items into memory for ultra-fast instant search (< 1ms)
  allRepairs.forEach((rep: any) => {
    const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '';
    rep._normSap = normalizeKey(rep.sapNo || '');
    rep._normSerial = normalizeKey(rep.serialNo || '');
    rep._normDesc = normalizeKey(rep.description || '');
    rep._normFault = normalizeKey(`${rep.faultCode || ''} ${rep.faultDesc || ''}`);
    rep._normWh = normalizeKey(sourceWh);
    rep._normShelf = normalizeKey(rep.shelfNo || '');
    rep._fullSearchStr = `${rep._normSap} ${rep._normSerial} ${rep._normDesc} ${rep._normFault} ${rep._normWh} ${rep._normShelf}`;
  });

  // Pre-calculate past completed dispatches once in O(N) map
  const pastDispatchCountMap = new Map<string, number>();
  const cardHistoryMap = new Map<string, RepairRecord[]>();

  rawRepairs.forEach(r => {
    if (r.serialNo && r.serialNo !== '-' && r.serialNo.trim() !== '') {
      const key = `${(r.sapNo || '').trim()}___${r.serialNo.trim().toLowerCase()}`;
      if (r.status === 'SENT_BACK' || r.status === 'COMPLETED') {
        pastDispatchCountMap.set(key, (pastDispatchCountMap.get(key) || 0) + 1);
      }
      if (!cardHistoryMap.has(key)) {
        cardHistoryMap.set(key, []);
      }
      cardHistoryMap.get(key)!.push(r);
    }
  });

  // Calculate visit counts in O(1)
  const getCardVisitCount = (sapNo: string, serialNo?: string): number => {
    if (!serialNo || serialNo === '-' || serialNo.trim() === '') {
      return 1;
    }
    const key = `${(sapNo || '').trim()}___${serialNo.trim().toLowerCase()}`;
    const pastDispatches = pastDispatchCountMap.get(key) || 0;
    return pastDispatches + 1;
  };

  // Get historical repair records in O(1)
  const getCardHistory = (sapNo: string, serialNo?: string): RepairRecord[] => {
    if (!serialNo || serialNo === '-' || serialNo.trim() === '') {
      return [];
    }
    const key = `${(sapNo || '').trim()}___${serialNo.trim().toLowerCase()}`;
    return cardHistoryMap.get(key) || [];
  };

  // Calculate waiting days in stock
  const getDaysInStock = (dateVal: any): { days: number; badgeHtml: string } => {
    if (!dateVal) return { days: 0, badgeHtml: '' };
    const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return { days: 0, badgeHtml: '' };

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    if (diffMs < 0) {
      return {
        days: 0,
        badgeHtml: `
          <div style="margin-top: 3px;">
            <span style="background: rgba(52, 211, 153, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.71rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;" title="Depoya Gelişinden Bu Yana Geçen Süre">
              <i class="fa-regular fa-clock" style="font-size: 0.65rem;"></i> Bugün Geldi
            </span>
          </div>
        `
      };
    }
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let color = '#34d399'; // 0-6 days: Green
    let bg = 'rgba(52, 211, 153, 0.12)';
    let border = 'rgba(52, 211, 153, 0.3)';
    let icon = 'fa-regular fa-clock';

    if (days >= 30) {
      color = '#EF4444'; // 30+ days: Critical Red
      bg = 'rgba(239, 68, 68, 0.15)';
      border = 'rgba(239, 68, 68, 0.35)';
      icon = 'fa-solid fa-fire';
    } else if (days >= 15) {
      color = '#F59E0B'; // 15-29 days: Orange
      bg = 'rgba(245, 158, 11, 0.15)';
      border = 'rgba(245, 158, 11, 0.35)';
      icon = 'fa-solid fa-hourglass-half';
    } else if (days >= 7) {
      color = '#60a5fa'; // 7-14 days: Blue
      bg = 'rgba(59, 130, 246, 0.15)';
      border = 'rgba(59, 130, 246, 0.35)';
      icon = 'fa-regular fa-calendar-days';
    }

    const text = days === 0 ? 'Bugün Geldi' : `${days} Gündür Depoda`;
    const badgeHtml = `
      <div style="margin-top: 3px;">
        <span style="background: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 2px 7px; border-radius: 4px; font-size: 0.71rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;" title="Depoya Gelişinden Bu Yana Geçen Süre">
          <i class="${icon}" style="font-size: 0.65rem;"></i> ${text}
        </span>
      </div>
    `;
    return { days, badgeHtml };
  };

  // Group all repairs by SAP Model & calculate stats
  interface SapModelSummary {
    sapNo: string;
    description: string;
    totalCount: number;
    pendingCount: number;
    underRepairCount: number;
    repairedCount: number;
    waitingTurnaround: number;
    criticalCount: number;
  }

  const sapGroupsMap = new Map<string, SapModelSummary>();
  allRepairs.forEach(rep => {
    const sap = rep.sapNo || 'Bilinmeyen';
    let g = sapGroupsMap.get(sap);
    if (!g) {
      g = {
        sapNo: sap,
        description: rep.description || `SAP-${sap}`,
        totalCount: 0,
        pendingCount: 0,
        underRepairCount: 0,
        repairedCount: 0,
        waitingTurnaround: 0,
        criticalCount: 0
      };
      sapGroupsMap.set(sap, g);
    }
    const qty = rep.quantity || 1;
    g.totalCount += qty;
    if (rep.status === 'PENDING_ARRIVAL') g.pendingCount += qty;
    else if (rep.status === 'UNDER_REPAIR') g.underRepairCount += qty;
    else if (rep.status === 'REPAIRED') g.repairedCount += qty;

    if (rep.priority === 'CRITICAL' || rep.priority === 'HIGH') g.criticalCount++;
    g.waitingTurnaround = g.pendingCount + g.underRepairCount;
  });

  // Sort by waiting turnaround (most repair backlog first!)
  const sortedSapSummaries = Array.from(sapGroupsMap.values()).sort((a, b) => b.waitingTurnaround - a.waitingTurnaround || b.totalCount - a.totalCount);

  // Filter items based on active tab, search, SAP filter, and Warehouse filter (Ultra Fast O(N))
  const filterItems = () => {
    const tab = (window as any)._workshopStockTab || 'ALL';
    const rawQuery = ((window as any)._workshopStockSearch || '').trim();
    const cleanQ = normalizeKey(rawQuery);
    const sapFilter = (window as any)._workshopStockSapFilter || '';
    const whFilter = (window as any)._workshopStockWarehouseFilter || '';

    // Check exact match in O(1) across pre-indexed items
    let hasExactMatch = false;
    if (cleanQ) {
      hasExactMatch = allRepairs.some((r: any) => 
        (r._normSerial && r._normSerial !== '-' && r._normSerial === cleanQ) || 
        (r._normSap && r._normSap === cleanQ)
      );
    }

    return allRepairs.filter((rep: any) => {
      // SAP Filter
      if (sapFilter && rep.sapNo !== sapFilter) return false;

      // Warehouse / Saha Filter
      if (whFilter && rep.sourceWarehouseId !== whFilter) return false;

      // Tab filter
      if (tab === 'DEFECT' && rep.status !== 'PENDING_ARRIVAL') return false;
      if (tab === 'WAITING_STOCK' || tab === 'UNDER_REPAIR') {
        const isWaiting = rep.status === 'UNDER_REPAIR' && (!rep.assignedTo || rep.assignedTo.trim() === '' || rep.assignedTo === '-') && !rep.repairStage;
        if (!isWaiting) return false;
      }
      if (tab === 'ACTIVE_TASK') {
        const isActive = rep.status === 'UNDER_REPAIR' && ((!!rep.assignedTo && rep.assignedTo.trim() !== '' && rep.assignedTo !== '-') || !!rep.repairStage);
        if (!isActive) return false;
      }
      if (tab === 'REPAIRED' && rep.status !== 'REPAIRED') return false;
      if (tab === 'NO_SERIAL') {
        const hasNoSerial = !rep.serialNo || rep.serialNo.trim() === '' || rep.serialNo === '-' || rep.serialNo.toLowerCase() === 'yok' || rep.serialNo.toLowerCase() === 'tanımsız';
        if (!hasNoSerial) return false;
      }

      // Search query filter (instant string matching)
      if (cleanQ) {
        if (hasExactMatch) {
          return rep._normSerial === cleanQ || rep._normSap === cleanQ;
        }
        return rep._fullSearchStr.includes(cleanQ);
      }

      return true;
    });
  };

  // Counts for Stats Cards
  const totalCount = allRepairs.length;
  const pendingDefectCount = allRepairs.filter(r => r.status === 'PENDING_ARRIVAL').length;
  const waitingStockCount = allRepairs.filter(r => r.status === 'UNDER_REPAIR' && (!r.assignedTo || r.assignedTo.trim() === '' || r.assignedTo === '-') && !r.repairStage).length;
  const activeWorkOrderCount = allRepairs.filter(r => r.status === 'UNDER_REPAIR' && ((!!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-') || !!r.repairStage)).length;
  const repairedReadyCount = allRepairs.filter(r => r.status === 'REPAIRED').length;
  const noSerialStockCount = allRepairs.filter(r => (r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL') && (!r.serialNo || r.serialNo.trim() === '' || r.serialNo === '-' || r.serialNo.toLowerCase() === 'yok' || r.serialNo.toLowerCase() === 'tanımsız')).length;

  // Global window functions
  (window as any).setWorkshopStockTab = (tab: string) => {
    (window as any)._workshopStockTab = tab;
    (window as any)._workshopStockPage = 1;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-stock');
    }
  };
  const renderPagination = (totalCount: number, page: number) => {
    const totalP = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const start = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(page * PAGE_SIZE, totalCount);

    if (totalCount <= PAGE_SIZE) {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; color: #94A3B8; font-size: 0.8rem; font-weight: 700; background: rgba(0,0,0,0.25); border-top: 1px solid rgba(255,255,255,0.06); border-radius: 0 0 12px 12px;">
          <span>Toplam <strong style="color: #14F195;">${totalCount}</strong> kart listeleniyor.</span>
        </div>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); border-radius: 0 0 12px 12px;">
        <div style="color: #94A3B8; font-size: 0.82rem; font-weight: 700;">
          <strong style="color: #00f3ff;">${start} - ${end}</strong> arası gösteriliyor (Toplam: <strong style="color: #14F195;">${totalCount}</strong> Kart)
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <!-- First Page -->
          <button onclick="window.setWorkshopStockPage(1)" ${page === 1 ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.7rem; border-radius: 6px; font-size: 0.75rem; background: ${page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; color: ${page === 1 ? '#475569' : '#FFF'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; border: 1px solid rgba(255,255,255,0.08);" title="İlk Sayfa">
            <i class="fa-solid fa-angles-left"></i>
          </button>

          <!-- Prev Page -->
          <button onclick="window.setWorkshopStockPage(${page - 1})" ${page === 1 ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.78rem; font-weight: 800; background: ${page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(20, 241, 149, 0.15)'}; color: ${page === 1 ? '#475569' : '#14F195'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; border: 1px solid ${page === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(20,241,149,0.3)'};">
            <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
          </button>

          <!-- Current Page Info -->
          <span style="padding: 0.4rem 0.85rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 6px; font-family: monospace; font-weight: 900; color: #00f3ff; font-size: 0.82rem;">
            Sayfa ${page} / ${totalP}
          </span>

          <!-- Next Page -->
          <button onclick="window.setWorkshopStockPage(${page + 1})" ${page >= totalP ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.78rem; font-weight: 800; background: ${page >= totalP ? 'rgba(255,255,255,0.02)' : 'rgba(20, 241, 149, 0.15)'}; color: ${page >= totalP ? '#475569' : '#14F195'}; cursor: ${page >= totalP ? 'not-allowed' : 'pointer'}; border: 1px solid ${page >= totalP ? 'rgba(255,255,255,0.08)' : 'rgba(20,241,149,0.3)'};">
            Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
          </button>

          <!-- Last Page -->
          <button onclick="window.setWorkshopStockPage(${totalP})" ${page >= totalP ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.7rem; border-radius: 6px; font-size: 0.75rem; background: ${page >= totalP ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; color: ${page >= totalP ? '#475569' : '#FFF'}; cursor: ${page >= totalP ? 'not-allowed' : 'pointer'}; border: 1px solid rgba(255,255,255,0.08);" title="Son Sayfa">
            <i class="fa-solid fa-angles-right"></i>
          </button>
        </div>
      </div>
    `;
  };

  (window as any).setWorkshopStockPage = (page: number) => {
    const filtered = filterItems();
    const totalP = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safeP = Math.min(Math.max(1, page), totalP);
    (window as any)._workshopStockPage = safeP;
    
    const start = (safeP - 1) * PAGE_SIZE;
    const paged = filtered.slice(start, start + PAGE_SIZE);
    
    const tbody = document.getElementById('workshop-stock-tbody');
    const paginationContainer = document.getElementById('workshop-stock-pagination');
    if (tbody) {
      tbody.innerHTML = renderTableRows(paged);
    }
    if (paginationContainer) {
      paginationContainer.innerHTML = renderPagination(filtered.length, safeP);
    }
    window.scrollTo({ top: 300, behavior: 'smooth' });
  };

  let _searchDebounceTimer: any = null;
  (window as any).debounceWorkshopSearch = (val: string) => {
    clearTimeout(_searchDebounceTimer);
    _searchDebounceTimer = setTimeout(() => {
      (window as any).filterWorkshopStock(val);
    }, 100);
  };

  (window as any).filterWorkshopStock = (query: string) => {
    (window as any)._workshopStockSearch = query;
    (window as any)._workshopStockPage = 1;

    // If currently in summary mode and user searches, auto switch to detailed list so found cards are immediately visible
    if (query.trim() && (window as any)._workshopStockViewMode === 'SUMMARY') {
      (window as any)._workshopStockViewMode = 'DETAILED';
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
        return;
      }
    }

    const tbody = document.getElementById('workshop-stock-tbody');
    const paginationContainer = document.getElementById('workshop-stock-pagination');
    const filtered = filterItems();
    const paged = filtered.slice(0, PAGE_SIZE);
    if (tbody) {
      tbody.innerHTML = renderTableRows(paged);
    }
    if (paginationContainer) {
      paginationContainer.innerHTML = renderPagination(filtered.length, 1);
    }
  };

  (window as any).filterWorkshopBySap = (sapNo: string) => {
    (window as any)._workshopStockSapFilter = sapNo;
    (window as any)._workshopStockPage = 1;
    (window as any)._workshopStockViewMode = 'DETAILED';
    if ((window as any).navigate) {
      (window as any).navigate('workshop-stock');
    }
  };

  (window as any).filterWorkshopByWarehouse = (whId: string) => {
    (window as any)._workshopStockWarehouseFilter = whId;
    (window as any)._workshopStockPage = 1;
    (window as any)._workshopStockViewMode = 'DETAILED';
    if ((window as any).navigate) {
      (window as any).navigate('workshop-stock');
    }
  };

  (window as any).clearWorkshopSapFilter = () => {
    (window as any)._workshopStockSapFilter = '';
    (window as any)._workshopStockWarehouseFilter = '';
    (window as any)._workshopStockPage = 1;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-stock');
    }
  };

  (window as any).setWorkshopStockViewMode = (mode: 'DETAILED' | 'SUMMARY') => {
    (window as any)._workshopStockViewMode = mode;
    (window as any)._workshopStockPage = 1;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-stock');
    }
  };


  // Auto-generate serial for manual card entry
  (window as any).autoGenerateManualStockSerial = async () => {
    const sapInput = (document.getElementById('manual-sap-input') as HTMLInputElement)?.value.trim();
    const serialInput = document.getElementById('manual-serial-input') as HTMLInputElement;
    if (!sapInput) {
      alert("Lütfen önce SAP Numarasını giriniz.");
      return;
    }
    const allRepairsList = await repairService.getRepairs(true);
    const generated = generateMtaSerialNo(sapInput, allRepairsList);
    if (serialInput) {
      serialInput.value = generated;
      serialInput.style.borderColor = '#14F195';
      (window as any).showToast?.('Bilgi', `"${generated}" seri numarası üretildi.`, 'info');
    }
  };

  // Assign auto serial to an existing serial-less repair item
  (window as any).assignAutoSerialToCard = async (repairId: string, sapNo: string) => {
    try {
      const allRepairsList: RepairRecord[] = await repairService.getRepairs(true);
      const generated = generateMtaSerialNo(sapNo, allRepairsList);
      
      (window as any).showToast?.('İşlem', `${generated} seri numarası atanıyor...`, 'info');
      await repairService.updateRepair(repairId, {
        serialNo: generated
      });

      repairService.invalidateCache();
      (window as any).showToast?.('Başarılı', `Kart için "${generated}" seri numarası oluşturuldu ve atölye stoğuna eklendi.`, 'success');

      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
    }
  };

  // Batch assign auto serials to all serial-less cards in workshop
  (window as any).batchAssignAutoSerialsToAll = async () => {
    const allRepairsList: RepairRecord[] = await repairService.getRepairs(true);
    const noSerialCards = allRepairsList.filter(r => 
      !r.serialNo || r.serialNo.trim() === '' || r.serialNo === '-' || r.serialNo.toLowerCase() === 'yok' || r.serialNo.toLowerCase() === 'tanımsız'
    );

    if (noSerialCards.length === 0) {
      alert("Seri numarası eksik kart bulunamadı.");
      return;
    }

    if (!confirm(`Seri numarası olmayan ${noSerialCards.length} adet karta otomatik benzersiz MTA seri numarası atanacaktır. Onaylıyor musunuz?`)) {
      return;
    }

    try {
      (window as any).showToast?.('İşlem', 'Seri numaraları atanıyor...', 'info');
      const { writeBatch, doc } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      const batch = writeBatch(db);

      let workingList = [...allRepairsList];
      for (const card of noSerialCards) {
        if (!card.id) continue;
        const generated = generateMtaSerialNo(card.sapNo, workingList);
        card.serialNo = generated; // track in memory for collision avoidance
        const docRef = doc(db, 'repairs', card.id);
        batch.update(docRef, { serialNo: generated });
      }

      await batch.commit();
      repairService.invalidateCache();

      (window as any).showToast?.('Başarılı', `${noSerialCards.length} adet karta otomatik seri numarası atandı!`, 'success');
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      alert("Toplu atama hatası: " + err.message);
    }
  };

  // Take card from MTA stock to technician's workbench
  (window as any).takeCardToMyBench = async (repairId: string) => {
    try {
      (window as any).showToast?.('İşlem', 'Kart masanıza alınıyor...', 'info');
      await repairService.assignTechnician(repairId, username);
      await repairService.updateRepairStage(repairId, 'DIAGNOSIS');
      (window as any).showToast?.('Başarılı', `Kart ${username} masasına alındı. Tamir Paneline yönlendiriliyorsunuz...`, 'success');
      setTimeout(() => {
        if ((window as any).navigate) (window as any).navigate('workshop');
      }, 400);
    } catch(err) {
      console.error(err);
      alert('İşlem gerçekleştirilemedi.');
    }
  };

  // 1. START / RECEIVE REPAIR ACTION
  (window as any).openReceiveRepairModal = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'receive-repair-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '-';

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 520px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.25); box-shadow: 0 20px 40px rgba(0,0,0,0.6); max-height: 95vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-hand-holding-hand"></i> KARTI TESLİM AL & STOĞA ONAYLA
          </h3>
          <button onclick="document.getElementById('receive-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700; text-transform:uppercase;">Gelen Malzeme Bilgileri</p>
          <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); padding:0.85rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block; font-size:0.95rem;">${rep.description}</span>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:6px; font-size:0.78rem; color:#94A3B8;">
              <span><i class="fa-solid fa-barcode" style="color:#00f3ff;"></i> SAP: <strong style="color:#FFF;">${rep.sapNo}</strong></span>
              <span><i class="fa-solid fa-hashtag" style="color:#fbbf24;"></i> Seri No: <strong style="color:#FFF;">${rep.serialNo || '-'}</strong></span>
              <span><i class="fa-solid fa-boxes-stacked" style="color:#14F195;"></i> Miktar: <strong style="color:#FFF;">${rep.quantity} Adet</strong></span>
            </div>
            <div style="margin-top:8px; padding-top:6px; border-top:1px dashed rgba(255,255,255,0.07); font-size:0.78rem; color:#94A3B8; display:flex; flex-direction:column; gap:4px;">
              <div><i class="fa-solid fa-warehouse" style="color:#60A5FA;"></i> Gönderen Saha: <strong style="color:#FFF;">${sourceWhName}</strong></div>
              ${rep.dispatchNo ? `<div><i class="fa-solid fa-truck-ramp-box" style="color:#14F195;"></i> Sevk No: <strong style="color:#14F195; font-family:monospace;">${rep.dispatchNo}</strong></div>` : ''}
              ${rep.faultCode ? `<div><i class="fa-solid fa-triangle-exclamation" style="color:#EF4444;"></i> Arıza: <strong style="color:#EF4444;">${rep.faultCode}</strong> ${rep.faultDesc ? `(${rep.faultDesc})` : ''}</div>` : ''}
            </div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">ATÖLYE RAF / KONUM (MTA)</label>
            <input type="text" id="receive-shelf-input" class="cyber-input" placeholder="Örn: Raf-B2, Kutu-04" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4); border: 1px solid #1E293B; border-radius: 8px; color: #FFF;" value="${rep.shelfNo || ''}">
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700;">TESLİM ALMA & FİZİKSEL KONTROL NOTU</label>
            <textarea id="receive-note-input" class="cyber-input" placeholder="Paket sağlam, fiziksel hasar yok, vb..." style="width: 100%; height: 75px; padding: 0.85rem; background: rgba(0,0,0,0.4); border: 1px solid #1E293B; border-radius: 8px; color: #FFF; resize: none;"></textarea>
          </div>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('receive-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.7rem 1.25rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);">İptal</button>
          <button id="confirm-receive-btn" onclick="window.submitReceiveRepairItem('${rep.id}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.7rem 1.5rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 15px rgba(20,241,149,0.3);">
            <i class="fa-solid fa-check"></i> KABUL ET VE STOĞA EKLE
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).submitReceiveRepairItem = async (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;
    
    const shelfInput = document.getElementById('receive-shelf-input') as HTMLInputElement;
    const noteInput = document.getElementById('receive-note-input') as HTMLTextAreaElement;
    
    const shelfNo = shelfInput?.value.trim() || 'Tanımsız';
    const note = noteInput?.value.trim() || '';
    
    const confirmBtn = document.getElementById('confirm-receive-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      (window as any).showToast?.('İşlem', 'Malzeme teslim alınıyor ve MTA deposuna aktarılıyor...', 'info');
      await repairService.receiveRepair(repairId, username, shelfNo, note);
      
      await warehouseService.updateStockBySap(
        'MTA',
        rep.sapNo,
        rep.quantity,
        {
          user: username,
          reason: `Atölyede teslim alındı. Raf: ${shelfNo}${note ? ' | Not: ' + note : ''}`,
          materialName: rep.description
        },
        'DEFECT',
        shelfNo,
        undefined,
        rep.serialNo || undefined
      );

      (window as any).showToast?.('Başarılı', 'Malzeme başarıyla teslim alındı ve Atölye Stoğuna eklendi.', 'success');
      document.getElementById('receive-repair-modal')?.remove();
      
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (e: any) {
      console.error("Receive repair error:", e);
      alert("Teslim alma başarısız: " + (e?.message || e));
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<i class="fa-solid fa-check"></i> KABUL ET VE STOĞA EKLE';
      }
    }
  };

  (window as any).openRejectRepairModal = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const existing = document.getElementById('reject-repair-modal');
    if (existing) existing.remove();

    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '-';

    const modal = document.createElement('div');
    modal.id = 'reject-repair-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#EF4444; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-ban"></i> MALZEMEYİ REDDET & İADE ET
          </h3>
          <button onclick="document.getElementById('reject-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div style="margin-bottom:1.25rem;">
          <div style="background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.15); padding:0.85rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block;">${rep.description}</span>
            <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${rep.sapNo} | Seri No: ${rep.serialNo || '-'} | Miktar: ${rep.quantity} Adet</span>
            <div style="margin-top:6px; font-size:0.75rem; color:#60A5FA;">
              <i class="fa-solid fa-warehouse"></i> Gönderen Saha: <strong>${sourceWhName}</strong>
            </div>
            ${rep.dispatchNo ? `
              <div style="font-size:0.75rem; color:#14F195; font-family:monospace; font-weight:bold; margin-top:4px;">
                <i class="fa-solid fa-truck-ramp-box"></i> Sevk No: ${rep.dispatchNo}
              </div>
            ` : ''}
          </div>
          <p style="color: #F87171; font-size: 0.8rem; margin-top: 8px; line-height: 1.4;">
            <i class="fa-solid fa-triangle-exclamation"></i> Bu işlem onaylandığında malzeme Atölye kabul listesinden çıkarılarak gönderen <strong>${sourceWhName}</strong> deposunun arızalı stoğuna iade edilecektir.
          </p>
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display:block; color:#FFF; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">RED / İADE GEREKÇESİ <span style="color:#EF4444;">*</span></label>
          <textarea id="reject-reason-input" class="cyber-input" placeholder="Örn: Yanlış parça sevk edilmiş / Fiziksel kırık hasarlı / Kutu eksik..." style="width: 100%; height: 90px; padding: 0.85rem; background: rgba(0,0,0,0.4); resize: none;"></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('reject-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem; cursor:pointer;">İPTAL</button>
          <button id="confirm-reject-btn" onclick="window.submitRejectRepairItem('${rep.id}')" class="btn-cyber" style="background:linear-gradient(135deg, #EF4444 0%, #DC2626 100%); color:#FFF; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; cursor:pointer; box-shadow:0 0 15px rgba(239,68,68,0.3);">
            <i class="fa-solid fa-arrow-rotate-left"></i> REDDET VE GERİ GÖNDER
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).submitRejectRepairItem = async (repairId: string) => {
    const input = document.getElementById('reject-reason-input') as HTMLTextAreaElement;
    const reason = input?.value.trim();
    if (!reason) {
      alert('Lütfen red/iade gerekçesini belirtiniz.');
      return;
    }

    const confirmBtn = document.getElementById('confirm-reject-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      (window as any).showToast('İşlem', 'Malzeme reddediliyor ve depoya iade ediliyor...', 'info');
      await repairService.rejectRepair(repairId, username, reason);
      (window as any).showToast('Başarılı', 'Malzeme reddedildi ve kaynak depoya iade edildi.', 'success');
      document.getElementById('reject-repair-modal')?.remove();
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch(e) {
      console.error(e);
      alert('İşlem gerçekleştirilemedi.');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'REDDET VE GERİ GÖNDER';
      }
    }
  };

  // 2. DISPATCH REPAIRED MODAL
  (window as any).openDispatchRepairedModal = (repairId: string, sapNo: string, description: string, quantity: number, serialNo: string = '-') => {
    const modal = document.createElement('div');
    modal.id = 'dispatch-repaired-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    const warehouseOptions = warehouses.filter(w => w.id !== 'MTA').map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.35rem; color:#14F195; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-truck-ramp-box"></i> MALZEMEYİ SAHAYA SEVK ET (TRANSFER)
          </h3>
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.08); padding:0.85rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block; font-size:0.95rem;">${description}</span>
            <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:6px; font-size:0.78rem; color:#94A3B8;">
              <span><i class="fa-solid fa-barcode" style="color:#00f3ff;"></i> SAP: <strong style="color:#FFF;">${sapNo}</strong></span>
              <span><i class="fa-solid fa-hashtag" style="color:#fbbf24;"></i> Seri No: <strong style="color:#FFF;">${serialNo}</strong></span>
              <span><i class="fa-solid fa-boxes-stacked" style="color:#14F195;"></i> Miktar: <strong style="color:#FFF;">${quantity} Adet</strong></span>
            </div>
          </div>
        </div>

        <div style="margin-bottom:1.25rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700; text-transform:uppercase;">Hedef Santral / Depo</label>
          <select id="repaired-target-warehouse" style="width:100%; padding:0.75rem; background:#0F172A; border:1px solid #1E293B; color:#FFF; border-radius:8px; outline:none; font-size:0.9rem;">
            ${warehouseOptions}
          </select>
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.4rem; font-weight:700; text-transform:uppercase;">Kargo / İrsaliye No veya Sevk Notu (Opsiyonel)</label>
          <input type="text" id="repaired-dispatch-note" placeholder="Örn: Yurtiçi Kargo 12345678" style="width:100%; padding:0.75rem; background:#0F172A; border:1px solid #1E293B; color:#FFF; border-radius:8px; outline:none; font-size:0.85rem; box-sizing:border-box;">
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.65rem 1.25rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:1px solid rgba(255,255,255,0.1);">İptal</button>
          <button id="btn-submit-repaired-dispatch" onclick="window.submitRepairedDispatch('${repairId}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.65rem 1.5rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 15px rgba(20,241,149,0.3);">
            <i class="fa-solid fa-paper-plane"></i> SEVKİ BAŞLAT
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitRepairedDispatch = async (repairId: string) => {
    const targetSelect = document.getElementById('repaired-target-warehouse') as HTMLSelectElement;
    const noteInput = document.getElementById('repaired-dispatch-note') as HTMLInputElement;
    if (!targetSelect || !targetSelect.value) {
      alert('Lütfen hedef sevk deposunu seçin.');
      return;
    }

    const btn = document.getElementById('btn-submit-repaired-dispatch');
    if (btn) btn.setAttribute('disabled', 'true');

    try {
      (window as any).showToast?.('İşlem', 'Malzeme sevk ediliyor...', 'info');
      await repairService.dispatchRepair(repairId, targetSelect.value, username);

      if (noteInput && noteInput.value.trim()) {
        await repairService.updateRepair(repairId, {
          dispatchNo: noteInput.value.trim()
        });
      }

      (window as any).showToast?.('Başarılı', 'Malzeme başarıyla hedef santral deposuna sevk edildi.', 'success');
      
      const modal = document.getElementById('dispatch-repaired-modal');
      if (modal) modal.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (e: any) {
      console.error(e);
      alert('Sevk işlemi gerçekleştirilemedi: ' + (e?.message || e));
      if (btn) btn.removeAttribute('disabled');
    }
  };

  // 3. EDIT SHELF MODAL
  (window as any).openEditShelfModal = (repairId: string, sapNo: string, currentShelf: string = '') => {
    const newShelf = prompt(`SAP ${sapNo} için yeni Raf Konumu giriniz:`, currentShelf === '-' ? '' : currentShelf);
    if (newShelf === null) return;

    repairService.updateRepair(repairId, { shelfNo: newShelf.trim() || '-' }).then(() => {
      (window as any).showToast?.('Başarılı', 'Raf konumu güncellendi.', 'success');
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    }).catch((err) => {
      alert("Raf konumu güncellenemedi: " + err);
    });
  };

  // 4. DETAILED CARD TIMELINE & HISTORY MODAL
  (window as any).openCardHistoryModal = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const historyItems = getCardHistory(rep.sapNo, rep.serialNo);
    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Merkez';

    const modal = document.createElement('div');
    modal.id = 'card-history-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 720px; max-height: 90vh; overflow-y: auto; padding: 2rem; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.3); box-shadow: 0 25px 50px rgba(0,0,0,0.8); background: #0A0E17;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1rem;">
          <div>
            <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#00f3ff; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
              <i class="fa-solid fa-microchip"></i> KART VE İŞLEM DETAYI
            </h3>
            <span style="font-size:0.8rem; color:#94A3B8;">Parçanın tamir geçmişi, söküldüğü saha ve arıza dökümü</span>
          </div>
          <button onclick="document.getElementById('card-history-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.3rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <!-- Info Header Card -->
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span style="font-size: 1.1rem; font-weight: 800; color: #FFF; display: block;">${rep.description}</span>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 8px; font-size: 0.82rem; color: #94A3B8;">
                <span><i class="fa-solid fa-barcode" style="color: #00f3ff;"></i> SAP: <strong style="color: #FFF; font-family: monospace;">${rep.sapNo}</strong></span>
                <span><i class="fa-solid fa-hashtag" style="color: #fbbf24;"></i> Seri No: <strong style="color: #FFF; font-family: monospace;">${rep.serialNo || '-'}</strong></span>
                <span><i class="fa-solid fa-box-archive" style="color: #a78bfa;"></i> Kutu/Raf: <strong style="color: #FFF;">${rep.shelfNo || rep.boxNo || '-'}</strong></span>
                ${rep.revisionNo ? `<span><i class="fa-solid fa-code-branch" style="color: #34d399;"></i> Rev: <strong style="color: #FFF;">${rep.revisionNo}</strong></span>` : ''}
                ${rep.countNo ? `<span><i class="fa-solid fa-list-ol" style="color: #f472b6;"></i> Sayım No: <strong style="color: #FFF;">${rep.countNo}</strong></span>` : ''}
                ${rep.rmrstNo ? `<span><i class="fa-solid fa-file-lines" style="color: #38bdf8;"></i> RMRST: <strong style="color: #FFF;">${rep.rmrstNo}</strong></span>` : ''}
                ${rep.mctNo || rep.dispatchNo ? `<span><i class="fa-solid fa-truck-ramp-box" style="color: #fb923c;"></i> MÇT: <strong style="color: #FFF;">${rep.mctNo || rep.dispatchNo}</strong></span>` : ''}
                <span><i class="fa-solid fa-rotate-right" style="color: #f472b6;"></i> Toplam Geliş: <strong style="color: #FFF;">${historyItems.length} Kez</strong></span>
              </div>
            </div>
            ${rep.repairImageUrl ? `
              <div style="text-align: center;">
                <img src="${rep.repairImageUrl}" style="width: 60px; height: 60px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(20,241,149,0.3); cursor: pointer;" onclick="window.open('${rep.repairImageUrl}', '_blank')" title="Büyütmek için tıklayın" />
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Current Repair Details -->
        <h4 style="color: #14F195; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.5px;">
          <i class="fa-solid fa-clipboard-list" style="margin-right: 6px;"></i> Güncel Tamir Süreci Bilgileri
        </h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.85rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: #94A3B8; display: block; text-transform: uppercase;">Söküldüğü Saha / Depo</span>
            <span style="font-weight: 700; color: #FFF; font-size: 0.9rem;">${sourceWhName}</span>
            ${rep.sentBy ? `<div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Sevk Eden: ${rep.sentBy}</div>` : ''}
            <div style="font-size: 0.75rem; color: #64748B; margin-top: 2px;">Geliş Tarihi: ${formatDateOnly(rep.sentAt || rep.receivedAt)}</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.85rem; border-radius: 8px;">
            <span style="font-size: 0.75rem; color: #94A3B8; display: block; text-transform: uppercase;">Arıza Kodu & Detayı</span>
            <span style="font-weight: 700; color: #F59E0B; font-size: 0.9rem;">${rep.faultCode && rep.faultCode !== '-' ? rep.faultCode : 'Belirtilmemiş'}</span>
            <div style="font-size: 0.8rem; color: #CBD5E1; margin-top: 4px;">${rep.faultDesc || 'Açıklama girilmedi.'}</div>
          </div>
        </div>

        ${rep.repairNotes ? `
          <div style="background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.2); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
            <span style="font-size: 0.78rem; color: #14F195; font-weight: 800; text-transform: uppercase; display: block; margin-bottom: 4px;">
              <i class="fa-solid fa-wrench"></i> Yapılan Onarım / Notlar
            </span>
            <p style="margin: 0; font-size: 0.85rem; color: #E2E8F0; line-height: 1.5;">${rep.repairNotes}</p>
            ${rep.repairedBy ? `<div style="font-size: 0.75rem; color: #64748B; margin-top: 6px;">Onarımı Yapan: ${rep.repairedBy} (${formatDateTime(rep.repairedAt)})</div>` : ''}
          </div>
        ` : ''}

        <!-- Historical Visits Timeline -->
        <h4 style="color: #a78bfa; font-size: 0.9rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.5px;">
          <i class="fa-solid fa-timeline" style="margin-right: 6px;"></i> Tüm Geliş Geçmişi (${historyItems.length} Kayıt)
        </h4>
        <div style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem;">
          ${historyItems.map((h, idx) => {
            const hSource = warehouses.find(w => w.id === h.sourceWarehouseId)?.name || h.sourceWarehouseId || 'Merkez';
            const isCurrent = h.id === rep.id;
            return `
              <div style="background: ${isCurrent ? 'rgba(0, 243, 255, 0.05)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isCurrent ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; padding: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="background: rgba(168, 85, 247, 0.2); color: #c084fc; font-weight: 800; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">#${historyItems.length - idx}. Geliş</span>
                    <strong style="color: #FFF; font-size: 0.85rem;">${hSource}</strong>
                    ${isCurrent ? `<span style="background: rgba(0, 243, 255, 0.2); color: #00f3ff; font-size: 0.7rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Şu Anki Kayıt</span>` : ''}
                  </div>
                  <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 4px;">
                    <span>Tarih: ${formatDateOnly(h.sentAt || h.receivedAt)}</span> | 
                    <span>Arıza: ${h.faultCode || '-'}</span> | 
                    <span>Durum: <strong style="color: #FFF;">${h.status}</strong></span>
                  </div>
                  ${h.repairNotes ? `<div style="font-size: 0.75rem; color: #CBD5E1; font-style: italic; margin-top: 2px;">"${h.repairNotes}"</div>` : ''}
                </div>
                <div style="text-align: right; font-size: 0.75rem; color: #64748B;">
                  ${h.dispatchedAt ? `Sevk: ${formatDateOnly(h.dispatchedAt)}` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="display:flex; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('card-history-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.08); color:#FFF; font-weight:700; padding:0.65rem 1.5rem; font-size:0.85rem; border-radius:6px; cursor:pointer; border:1px solid rgba(255,255,255,0.15);">
            KAPAT
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // 5. EXPORT TO EXCEL
  (window as any).exportWorkshopStockExcel = () => {
    const items = filterItems();
    if (items.length === 0) {
      alert("Dışa aktarılacak kayıt bulunamadı.");
      return;
    }

    const excelData = items.map(item => {
      const sourceWhName = warehouses.find(w => w.id === item.sourceWarehouseId)?.name || item.sourceWarehouseId || 'Merkez';
      return {
        'SAP NO': item.sapNo,
        'SERİ NO': item.serialNo || '-',
        'MALZEME TANIMI': item.description,
        'DURUM': item.status,
        'RAF KONUMU': item.shelfNo || '-',
        'SÖKÜLDÜĞÜ SAHA': sourceWhName,
        'ARIZA KODU': item.faultCode || '-',
        'ARIZA AÇIKLAMASI': item.faultDesc || '-',
        'ONARIM NOTLARI': item.repairNotes || '-',
        'MİKTAR': item.quantity,
        'GELİŞ TARİHİ': formatDateOnly(item.sentAt || item.receivedAt),
        'TAMİR TARİHİ': formatDateOnly(item.repairedAt),
        'SEVK TARİHİ': formatDateOnly(item.dispatchedAt)
      };
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Atölye Tamir Stoğu');
    XLSX.writeFile(wb, `Atolye_Tamir_Stogu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Helper to safely get value from row with flexible key matching
  const getRowVal = (row: any, ...keys: string[]): any => {
    const rowKeys = Object.keys(row);
    for (const k of keys) {
      const cleanK = normalizeKey(k);
      const matchedKey = rowKeys.find(rk => normalizeKey(rk) === cleanK);
      if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
        const val = row[matchedKey];
        if (typeof val === 'string') return val.trim();
        return val;
      }
    }
    return '';
  };

  // Helper to parse Excel dates safely (handles serial numbers, unix ms, and strings)
  const parseExcelDate = (val: any): Date | null => {
    if (val === undefined || val === null || val === '') return null;
    
    // 1. If it's already a Date object
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? null : val;
    }
    
    // 2. If it's a number (Excel serial or Unix timestamp)
    if (typeof val === 'number') {
      if (isNaN(val)) return null;
      // Excel day serial number (e.g. 44510 or 44510.5 for dates)
      if (val > 1000 && val < 200000) {
        const utcMs = Math.round((val - 25569) * 86400 * 1000);
        const d = new Date(utcMs);
        const tzOffsetMs = d.getTimezoneOffset() * 60 * 1000;
        const localDate = new Date(utcMs + tzOffsetMs);
        return (!isNaN(localDate.getTime()) && localDate.getFullYear() >= 1970 && localDate.getFullYear() <= 2100) ? localDate : d;
      }
      // Unix timestamp in ms
      if (val > 1000000000000) {
        const d = new Date(val);
        return (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) ? d : null;
      }
      // Unix timestamp in seconds
      if (val > 1000000000 && val <= 10000000000) {
        const d = new Date(val * 1000);
        return (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) ? d : null;
      }
      return null;
    }
    
    // 3. If it's a string
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (!trimmed || trimmed === '-' || trimmed === 'null' || trimmed === 'undefined' || trimmed === '#N/A') return null;
      
      // If it's a numeric string (e.g. "44510" or "44510.5")
      if (/^\d+(\.\d+)?$/.test(trimmed)) {
        const numVal = parseFloat(trimmed);
        return parseExcelDate(numVal);
      }

      // Turkish month names support (e.g. "10 Kasım 2021" or "18 Haz 2025")
      const trMonths: { [key: string]: number } = {
        'ocak': 0, 'subat': 1, 'şubat': 1, 'mart': 2, 'nisan': 3, 'mayis': 4, 'mayıs': 4,
        'haziran': 5, 'haz': 5, 'temmuz': 6, 'tem': 6, 'agustos': 7, 'ağustos': 7, 'agu': 7,
        'eylul': 8, 'eylül': 8, 'eyl': 8, 'ekim': 9, 'eki': 9, 'kasim': 10, 'kasım': 10, 'kas': 10,
        'aralik': 11, 'aralık': 11, 'ara': 11
      };

      const lowerStr = trimmed.toLowerCase();
      for (const [mName, mIdx] of Object.entries(trMonths)) {
        if (lowerStr.includes(mName)) {
          const digits = trimmed.match(/\d+/g);
          if (digits && digits.length >= 2) {
            const day = parseInt(digits[0]);
            let year = parseInt(digits[digits.length - 1]);
            if (year < 100) year += 2000;
            if (year >= 1970 && year <= 2100 && day >= 1 && day <= 31) {
              return new Date(year, mIdx, day);
            }
          }
        }
      }

      // Handle standard DD.MM.YYYY, DD/MM/YYYY, YYYY-MM-DD
      const datePart = trimmed.split(' ')[0].split('T')[0];
      const parts = datePart.split(/[./-]/);
      if (parts.length === 3) {
        let year = 0, month = 0, day = 0;
        if (parts[0].length === 4) {
          // YYYY-MM-DD
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          day = parseInt(parts[2]);
        } else if (parts[2].length === 4 || parts[2].length === 2) {
          // DD.MM.YYYY or DD/MM/YY
          day = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1;
          year = parseInt(parts[2]);
          if (year < 100) year += 2000;
        }
        if (year >= 1970 && year <= 2100 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
          const d = new Date(year, month, day);
          if (!isNaN(d.getTime())) return d;
        }
      }
      
      // Fallback JS Date parsing
      const d = new Date(trimmed);
      if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
        return d;
      }
    }
    return null;
  };

  // 6. EXCEL TEMPLATE DOWNLOAD (10 Active Columns)
  (window as any).downloadWorkshopCardsTemplate = () => {
    const sampleData = [
      {
        'SERİ NO': '10-73605',
        'SAP NO': '59368',
        'MALZEME ADI': 'PCB capacitor-board V1.1',
        'SAHA ADI': 'KELTEPE',
        'ARIZA NO': '44;105',
        'ARIZA AÇIKLAMASI': 'Fault emergency stop capacitor:Capacitor test 175V blade A***',
        'TAMİRE GELİŞ TARİHİ': '23.06.2025',
        'TAMİR ÖNCESİ NOT': 'Görsel inceleme yapıldı',
        'TAMİR AÇIKLAMASI': 'onarım bekliyor',
        'MÇT NO': '97'
      },
      {
        'SERİ NO': '10-2859',
        'SAP NO': '72544',
        'MALZEME ADI': 'PCB rectifier driver board V3.1',
        'SAHA ADI': 'KELTEPE',
        'ARIZA NO': '66;51',
        'ARIZA AÇIKLAMASI': 'Fault Rectifier:Thermo switch rectifier 1',
        'TAMİRE GELİŞ TARİHİ': '23.06.2025',
        'TAMİR ÖNCESİ NOT': '',
        'TAMİR AÇIKLAMASI': 'hazır ve denenecek',
        'MÇT NO': '5'
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tamir Kartları');
    XLSX.writeFile(wb, 'Atolye_Tamir_Karti_Yukleme_Sablonu.xlsx');
  };

  // 7. EXCEL BULK UPLOAD HANDLER (20 Columns Resilient Mapping)
  (window as any).uploadWorkshopCardsFromExcel = async (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Show Cyberpunk Progress Modal
    const modalHtml = `
      <div id="excel-upload-progress-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999;">
        <div class="glass-panel" style="background: #0B101B; border: 1px solid #14F195; border-radius: 14px; padding: 2rem; width: 90%; max-width: 480px; text-align: center; box-shadow: 0 0 30px rgba(20,241,149,0.3);">
          <div style="font-size: 2.2rem; color: #14F195; margin-bottom: 0.5rem;"><i class="fa-solid fa-cloud-arrow-up fa-bounce"></i></div>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #FFF; font-weight: 800; margin: 0 0 0.5rem 0;">KARTLAR SİSTEME AKTARILIYOR</h3>
          <p id="upload-progress-status" style="color: #94A3B8; font-size: 0.88rem; margin-bottom: 1.25rem;">Excel dosyası çözümleniyor...</p>
          <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; border: 1px solid rgba(20,241,149,0.3); margin-bottom: 0.75rem;">
            <div id="upload-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #14F195 0%, #00e5ff 100%); transition: width 0.3s ease; box-shadow: 0 0 10px #14F195;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; font-family: monospace;">
            <span id="upload-progress-count" style="color: #60a5fa;">0 / 0 Satır</span>
            <span id="upload-progress-percent" style="color: #14F195;">%0</span>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild!);

    const updateUIProgress = (processed: number, total: number) => {
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
      const bar = document.getElementById('upload-progress-bar');
      const countEl = document.getElementById('upload-progress-count');
      const pctEl = document.getElementById('upload-progress-percent');
      const statusEl = document.getElementById('upload-progress-status');
      if (bar) bar.style.width = `${pct}%`;
      if (countEl) countEl.innerText = `${processed} / ${total} Satır`;
      if (pctEl) pctEl.innerText = `%${pct}`;
      if (statusEl) statusEl.innerText = `Veritabanına kaydediliyor (%${pct})...`;
    };

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      
      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rawData || rawData.length === 0) {
        document.getElementById('excel-upload-progress-modal')?.remove();
        alert("Seçilen Excel dosyasında veri bulunamadı.");
        return;
      }

      let headerRowIdx = 0;
      for (let r = 0; r < Math.min(10, rawData.length); r++) {
        const rowStr = (rawData[r] || []).map(c => normalizeKey(String(c || ''))).join(' ');
        if (rowStr.includes('sap') || rowStr.includes('seri') || rowStr.includes('malzeme') || rowStr.includes('saha')) {
          headerRowIdx = r;
          break;
        }
      }

      const headerRow = (rawData[headerRowIdx] || []).map(c => String(c || '').trim());
      const dataRows = rawData.slice(headerRowIdx + 1);

      const rows: any[] = dataRows.map(row => {
        const obj: any = {};
        headerRow.forEach((h, idx) => {
          if (h) obj[h] = row[idx] !== undefined ? row[idx] : '';
        });
        return obj;
      });

      const recordsToCreate: Partial<RepairRecord>[] = [];
      let skippedCount = 0;

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i];
        // 1. SAP NO (Mandatory)
        const sapNo = getRowVal(row, 'SAP NO', 'SAPNO', 'SAP', 'SAP KODU', 'SAP_NO');
        if (!sapNo || sapNo === '-' || String(sapNo).toLowerCase() === 'sap no') {
          skippedCount++;
          continue;
        }

        // 2. MALZEME ADI
        let description = getRowVal(row, 'MALZEME ADI', 'MALZEME TANIMI', 'MALZEME', 'TANIM', 'AÇIKLAMA', 'DESCRIPTION', 'MALZEME_ADI');
        if (!description) {
          const dictMat = inventoryService.getMaterialBySap(String(sapNo));
          description = dictMat?.d || `SAP-${sapNo}`;
        }

        // 3. SERİ NO
        const serialNo = getRowVal(row, 'SERİ NO', 'SERI NO', 'SERİ', 'SERI', 'SERIAL NO', 'SERIALNO', 'SERI_NO') || '-';

        // 4. SAYIM NO & RMRST NO
        const countNo = getRowVal(row, 'SAYIM NO', 'SAYIMNO', 'SAYIM');
        const rmrstNo = getRowVal(row, 'RMRST NO', 'RMRSTNO', 'RMRST', 'RMS NO', 'RMSNO', 'RAPOR NO');

        // 5. SAHA ADI / GELDİĞİ SAHA
        const rawSaha = String(getRowVal(row, 'SAHA ADI', 'GELDİĞİ SAHA', 'SAHA', 'DEPO', 'KAYNAK SAHA', 'SAHA_ADI') || '');
        let sourceWhId = 'MTA';
        if (rawSaha) {
          const matchedWh = warehouses.find(w => 
            normalizeKey(w.name).includes(normalizeKey(rawSaha)) || 
            normalizeKey(w.id) === normalizeKey(rawSaha)
          );
          sourceWhId = matchedWh ? matchedWh.id : rawSaha;
        }

        // 6. ARIZA NO & ARIZA AÇIKLAMASI
        const faultCode = getRowVal(row, 'ARIZA NO', 'ARIZA KODU', 'ARIZANO', 'ARIZAKODU', 'ARIZA_NO') || '-';
        const faultDesc = getRowVal(row, 'ARIZA AÇIKLAMASI', 'ARIZA ACIKLAMASI', 'ARIZA DETAYI', 'ARIZA', 'ARIZA_ACIKLAMASI');

        // 7. TAMİRE GELİŞ TARİHİ
        const rawSentDate = getRowVal(row, 
          'TAMİRE GELİŞ TARİHİ', 'TAMIRE GELIS TARIHI', 'TAMİRE GELIS TARIHI', 'TAMIRE GELİŞ TARIHI',
          'GELİŞ TARİHİ', 'GELIS TARIHI', 'GELİŞ', 'GELIS',
          'GİRİŞ TARİHİ', 'GIRIS TARIHI', 'GİRİŞ', 'GIRIS',
          'KABUL TARİHİ', 'KABUL TARIHI', 'KABUL',
          'TAMİR TARİHİ', 'TAMIR TARIHI',
          'TARİH', 'TARIH', 'DATE', 'TAMIRE_GELIS_TARIHI'
        );
        const parsedSentDate = parseExcelDate(rawSentDate);

        // 8. ADET
        const rawQty = getRowVal(row, 'ADET', 'MİKTAR', 'MIKTAR', 'QTY', 'QUANTITY');
        const qty = parseInt(String(rawQty || '1')) || 1;

        // 9. REVİZYON NO
        const revisionNo = getRowVal(row, 'REVİZYON NO', 'REVIZYON NO', 'REVİZYON', 'REVIZYON', 'REV NO');

        // 10. TAMİR ÖNCESİ NOT
        const preRepairNote = getRowVal(row, 'TAMİR ÖNCESİ NOT', 'TAMIR ONCESI NOT', 'KABUL NOTU', 'ÖN İNCELEME');

        // 11. TAMİR AÇIKLAMASI
        const repairNotes = getRowVal(row, 'TAMİR AÇIKLAMASI', 'TAMIR ACIKLAMASI', 'ONARIM NOTLARI', 'ONARIM', 'İŞLEM', 'TAMIR_ACIKLAMASI');

        // 12. KUTU / RAF
        const shelfNo = getRowVal(row, 'KUTU', 'KUTU NO', 'RAF', 'RAF KONUMU', 'KONUM', 'LOKASYON') || '-';

        // 13. TAMİR DURUMU (Resilient status mapping)
        const rawStatus = String(getRowVal(row, 'TAMİR DURUMU', 'TAMIR DURUMU', 'DURUM', 'STATUS', 'TAMIR_DURUMU') || '').toLowerCase();
        let status: 'PENDING_ARRIVAL' | 'UNDER_REPAIR' | 'REPAIRED' | 'SENT_BACK' = 'UNDER_REPAIR';
        if (rawStatus.includes('hazır') || rawStatus.includes('hazir') || rawStatus.includes('revize') || rawStatus.includes('sağlam') || rawStatus.includes('tamam') || rawStatus.includes('bitti') || rawStatus.includes('repaired')) {
          status = 'REPAIRED';
        } else if (rawStatus.includes('sevk') || rawStatus.includes('gitti') || rawStatus.includes('gönder') || rawStatus.includes('sent')) {
          status = 'SENT_BACK';
        } else if (rawStatus.includes('kabul') || rawStatus.includes('yol') || rawStatus.includes('pending')) {
          status = 'PENDING_ARRIVAL';
        } else {
          status = 'UNDER_REPAIR';
        }

        // Test durumu
        let testStatus: 'TESTED' | 'UNTESTED' = 'TESTED';
        const rawTest = String(getRowVal(row, 'TEST DURUMU', 'TEST', 'TEST DURUM', 'TEST_DURUMU', 'DENENDİ', 'DENEME') || '').toLowerCase();
        if (rawTest.includes('türbin') || rawTest.includes('turbin') || rawTest.includes('denenmedi') || rawTest.includes('edilmedi') || rawTest.includes('saha') || rawTest.includes('untested')) {
          testStatus = 'UNTESTED';
        }

        // 14. MÇT NO & TRANSFER ALANLARI
        const mctNo = getRowVal(row, 'MÇT NO', 'MCT NO', 'MÇT', 'MCT', 'SEVK NO', 'İRSALİYE NO');
        const transferStatus = getRowVal(row, 'TRANSFER DURUMU', 'TRANSFER DURUM');
        const rawTransferDate = getRowVal(row, 'TRANSFER TARİHİ', 'TRANSFER TARIHI', 'SEVK TARİHİ');
        const parsedTransferDate = parseExcelDate(rawTransferDate);
        const transferSite = getRowVal(row, 'TRANSFER SAHASI', 'HEDEF SAHA', 'GİTTİĞİ SAHA', 'HEDEF DEPO');

        // 15. NOT
        const generalNote = getRowVal(row, 'NOT', 'GENEL NOT', 'AÇIKLAMA');

        recordsToCreate.push({
          sapNo: String(sapNo),
          serialNo: String(serialNo),
          description: String(description),
          quantity: qty,
          sourceWarehouseId: sourceWhId,
          workshopId: 'MTA',
          sentBy: username,
          sentAt: parsedSentDate || undefined,
          status: status,
          testStatus: status === 'REPAIRED' ? testStatus : undefined,
          shelfNo: String(shelfNo),
          boxNo: String(shelfNo),
          faultCode: String(faultCode),
          faultDesc: String(faultDesc),
          repairNotes: String(repairNotes),
          preRepairNote: String(preRepairNote),
          countNo: String(countNo),
          rmrstNo: String(rmrstNo),
          revisionNo: String(revisionNo),
          mctNo: String(mctNo),
          dispatchNo: String(mctNo),
          transferStatus: String(transferStatus),
          dispatchedAt: parsedTransferDate || undefined,
          transferSite: String(transferSite),
          generalNote: String(generalNote)
        });
      }

      updateUIProgress(0, recordsToCreate.length);
      const totalCreated = await repairService.createRepairsBulk(recordsToCreate, (processed, total) => {
        updateUIProgress(processed, total);
      });

      document.getElementById('excel-upload-progress-modal')?.remove();
      (window as any).showToast?.('Başarılı', `${totalCreated} adet tamir kartı başarıyla yüklendi!`, 'success');
      alert(`Tebrikler! ${totalCreated} adet kart başarıyla sisteme aktarıldı.${skippedCount > 0 ? ` (${skippedCount} boş satır atlandı)` : ''}`);

      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      document.getElementById('excel-upload-progress-modal')?.remove();
      console.error("Excel import error:", err);
      alert("Excel yükleme sırasında bir hata oluştu: " + (err?.message || err));
    } finally {
      event.target.value = '';
    }
  };

  // 8. SELECT ALL & BULK DELETE HANDLERS
  (window as any).toggleSelectAllWorkshopStock = (checked: boolean) => {
    const checkboxes = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb');
    checkboxes.forEach(cb => { cb.checked = checked; });
    (window as any).onWorkshopStockSelectChange();
  };

  (window as any).onWorkshopStockSelectChange = () => {
    const checkedCbs = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb:checked');
    const allCbs = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb');
    const deleteBtn = document.getElementById('workshop-stock-bulk-delete-btn');
    const takeBtn = document.getElementById('workshop-stock-bulk-take-btn');
    const countSpan = document.getElementById('workshop-stock-selected-count');
    const takeCountSpan = document.getElementById('workshop-stock-take-selected-count');

    if (deleteBtn) {
      deleteBtn.style.display = checkedCbs.length > 0 ? 'inline-flex' : 'none';
    }
    if (takeBtn) {
      takeBtn.style.display = checkedCbs.length > 0 ? 'inline-flex' : 'none';
    }
    if (countSpan) {
      countSpan.textContent = String(checkedCbs.length);
    }
    if (takeCountSpan) {
      takeCountSpan.textContent = String(checkedCbs.length);
    }

    const selectAllCb = document.getElementById('workshop-stock-select-all') as HTMLInputElement;
    if (selectAllCb) {
      selectAllCb.checked = allCbs.length > 0 && checkedCbs.length === allCbs.length;
    }
  };

  (window as any).takeSelectedWorkshopStockToBench = async () => {
    const checkedCbs = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb:checked');
    const ids = Array.from(checkedCbs).map(cb => cb.value).filter(Boolean);
    if (ids.length === 0) {
      alert("Lütfen masaya almak için en az bir kart seçin.");
      return;
    }

    if (!confirm(`Seçilen ${ids.length} adet kartı Kart Tamir Merkezi masanıza almak istiyor musunuz?`)) {
      return;
    }

    try {
      (window as any).showToast?.('İşlem', `${ids.length} adet kart masaya alınıyor...`, 'info');
      for (const id of ids) {
        await repairService.assignTechnician(id, username);
        await repairService.updateRepairStage(id, 'DIAGNOSIS');
      }
      (window as any).showToast?.('Başarılı', `${ids.length} adet kart masaya alındı. Kart Tamir Merkezi'ne aktarılıyorsunuz...`, 'success');
      setTimeout(() => {
        if ((window as any).navigate) (window as any).navigate('workshop');
      }, 400);
    } catch (err: any) {
      console.error("Masaya alma hatası:", err);
      alert("İşlem sırasında bir hata oluştu: " + (err?.message || err));
    }
  };

  (window as any).clearAllWorkshopStock = async () => {
    if (!confirm("⚠️ DİKKAT: Atölye Tamir Stoğundaki TÜM kart kayıtları silinecek ve liste tamamen sıfırlanacaktır.\n\nEmin misiniz?")) {
      return;
    }
    const secondConfirm = prompt("İşlemi onaylamak için lütfen 'SIFIRLA' yazınız:");
    if (secondConfirm !== 'SIFIRLA') {
      alert("İşlem iptal edildi.");
      return;
    }

    // Show Red Cyberpunk Progress Modal
    const modalHtml = `
      <div id="clear-stock-progress-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999;">
        <div class="glass-panel" style="background: #0B101B; border: 1px solid #EF4444; border-radius: 14px; padding: 2rem; width: 90%; max-width: 480px; text-align: center; box-shadow: 0 0 30px rgba(239,68,68,0.3);">
          <div style="font-size: 2.2rem; color: #EF4444; margin-bottom: 0.5rem;"><i class="fa-solid fa-trash-can fa-bounce"></i></div>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #FFF; font-weight: 800; margin: 0 0 0.5rem 0;">ATÖLYE LİSTESİ SIFIRLANIYOR</h3>
          <p id="clear-progress-status" style="color: #94A3B8; font-size: 0.88rem; margin-bottom: 1.25rem;">Kart kayıtları taranıyor...</p>
          <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; border: 1px solid rgba(239,68,68,0.3); margin-bottom: 0.75rem;">
            <div id="clear-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #EF4444 0%, #f97316 100%); transition: width 0.2s ease; box-shadow: 0 0 10px #EF4444;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; font-family: monospace;">
            <span id="clear-progress-count" style="color: #f87171;">0 / 0 Kart</span>
            <span id="clear-progress-percent" style="color: #EF4444;">%0</span>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild!);

    const updateClearUIProgress = (processed: number, total: number) => {
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
      const bar = document.getElementById('clear-progress-bar');
      const countEl = document.getElementById('clear-progress-count');
      const pctEl = document.getElementById('clear-progress-percent');
      const statusEl = document.getElementById('clear-progress-status');
      if (bar) bar.style.width = `${pct}%`;
      if (countEl) countEl.innerText = `${processed} / ${total} Kart`;
      if (pctEl) pctEl.innerText = `%${pct}`;
      if (statusEl) statusEl.innerText = `Kartlar veritabanından siliniyor (%${pct})...`;
    };

    try {
      const allItems = await repairService.getRepairs(true);
      const allIds = allItems.map(i => i.id).filter(Boolean) as string[];

      updateClearUIProgress(0, allIds.length);
      const deletedCount = await repairService.deleteRepairsBulk(allIds, (processed, total) => {
        updateClearUIProgress(processed, total);
      });

      document.getElementById('clear-stock-progress-modal')?.remove();
      (window as any).showToast?.('Başarılı', `${deletedCount} adet kart başarıyla sıfırlandı.`, 'success');
      alert(`Tüm atölye kartları başarıyla sıfırlandı (${deletedCount} adet kayıt silindi).`);
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      document.getElementById('clear-stock-progress-modal')?.remove();
      console.error("Sıfırlama hatası:", err);
      alert("Sıfırlama sırasında hata oluştu: " + (err?.message || err));
    }
  };

  (window as any).deleteSelectedWorkshopStock = async () => {
    const checkedCbs = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb:checked');
    const ids = Array.from(checkedCbs).map(cb => cb.value).filter(Boolean);
    if (ids.length === 0) {
      alert("Lütfen silmek için en az bir kart seçin.");
      return;
    }

    if (!confirm(`Seçilen ${ids.length} adet tamir kartını sistemden silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`)) {
      return;
    }

    try {
      (window as any).showToast?.('İşlem', `${ids.length} adet kart siliniyor...`, 'info');
      await repairService.deleteRepairsBulk(ids);
      (window as any).showToast?.('Başarılı', `${ids.length} adet kart başarıyla silindi.`, 'success');
      alert(`Seçilen ${ids.length} adet kart başarıyla silindi.`);
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      console.error("Silme hatası:", err);
      alert("Silme işlemi sırasında bir hata oluştu: " + (err?.message || err));
    }
  };

  (window as any).deleteSingleWorkshopRepair = async (id: string, sapNo: string, serialNo: string) => {
    if (!confirm(`SAP: ${sapNo} (Seri: ${serialNo}) tamir kartını silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await repairService.deleteRepair(id);
      (window as any).showToast?.('Başarılı', 'Kart silindi.', 'success');
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (err: any) {
      console.error("Silme hatası:", err);
      alert("Kart silinemedi: " + (err?.message || err));
    }
  };

  (window as any).quickPrintSingleCardLabel = async (repairId: string) => {
    let rep = rawRepairs.find(r => r.id === repairId);
    if (!rep) {
      const fetched = await repairService.getRepairs();
      rep = fetched.find(r => r.id === repairId);
    }
    if (!rep) return;

    const { qrService } = await import('../services/QRService');
    await qrService.printWorkshopCardLabel({
      id: rep.id,
      sapNo: rep.sapNo,
      serialNo: rep.serialNo,
      description: rep.description,
      testStatus: rep.testStatus || (rep.status === 'REPAIRED' ? 'TESTED' : 'UNTESTED'),
      repairNotes: rep.repairNotes,
      shelfNo: rep.shelfNo
    });
  };

  (window as any).printSelectedStockCardsLabels = async () => {
    const checkedCbs = document.querySelectorAll<HTMLInputElement>('.workshop-stock-item-cb:checked');
    const ids = Array.from(checkedCbs).map(cb => cb.value).filter(Boolean);
    if (ids.length === 0) {
      alert("Lütfen etiket basmak için en az bir kart seçin.");
      return;
    }

    const selectedCards = rawRepairs.filter(r => ids.includes(r.id!));
    if (selectedCards.length === 0) return;

    const { qrService } = await import('../services/QRService');
    const cards = selectedCards.map(item => ({
      id: item.id,
      sapNo: item.sapNo,
      serialNo: item.serialNo,
      description: item.description,
      testStatus: (item.testStatus || (item.status === 'REPAIRED' ? 'TESTED' : 'UNTESTED')) as 'TESTED' | 'UNTESTED',
      repairNotes: item.repairNotes,
      shelfNo: item.shelfNo
    }));

    await qrService.printBulkWorkshopCardLabels(cards);
  };

  // Render Table Rows
  const renderTableRows = (items: RepairRecord[]) => {
    if (items.length === 0) {
      return `
        <tr>
          <td colspan="10" style="text-align: center; padding: 3rem; color: #64748B; border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px;">
            <i class="fa-solid fa-box-open" style="font-size: 2rem; margin-bottom: 0.5rem; display: block; opacity: 0.5;"></i>
            Seçilen filtrelere uygun herhangi bir tamir stoğu veya kart bulunamadı.
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const cleanNameEscaped = (item.description || 'Bilinmeyen Malzeme').replace(/'/g, "\\'");
      const sourceWhName = warehouses.find(w => w.id === item.sourceWarehouseId)?.name || item.sourceWarehouseId || 'Merkez';
      const visitCount = getCardVisitCount(item.sapNo, item.serialNo);
      const daysInStock = getDaysInStock(item.sentAt || item.receivedAt);

      // Status Badge
      let statusBadge = '';
      if (item.status === 'PENDING_ARRIVAL') {
        statusBadge = `<span style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-truck"></i> Yolda (Kabul Bekliyor)</span>`;
      } else if (item.status === 'UNDER_REPAIR') {
        const hasActiveTask = (!!item.assignedTo && item.assignedTo.trim() !== '' && item.assignedTo !== '-') || !!item.repairStage;
        if (hasActiveTask) {
          statusBadge = `<span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="İş emri açılmış, masada onarımda"><i class="fa-solid fa-bolt"></i> Masada Onarımda ${item.assignedTo ? `(${item.assignedTo})` : ''}</span>`;
        } else {
          statusBadge = `<span style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;" title="Atölye ambarında / rafta bekleyen arızalı kart"><i class="fa-solid fa-boxes-stacked"></i> Arızalı Stokta</span>`;
        }
      } else if (item.status === 'REPAIRED') {
        statusBadge = `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> Revize Sağlam (Sevk Bekliyor)</span>`;
      } else if (item.status === 'SENT_BACK' || item.status === 'COMPLETED') {
        statusBadge = `<span style="background: rgba(148, 163, 184, 0.15); color: #94a3b8; border: 1px solid rgba(148, 163, 184, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-box-archive"></i> Sevki Yapıldı</span>`;
      }

      // Visit Count Badge
      const visitBadge = visitCount > 1
        ? `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-rotate-right"></i> ${visitCount}. Kez Atölyede</span>`
        : `<span style="background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-sparkles"></i> 1. Geliş (İlk)</span>`;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          
          <!-- CHECKBOX -->
          <td style="padding: 0.85rem 0.5rem; text-align: center;">
            <input type="checkbox" class="workshop-stock-item-cb" value="${item.id}" onchange="window.updateWorkshopStockSelection()" style="cursor: pointer; width: 16px; height: 16px; accent-color: #ef4444;" />
          </td>

          <!-- SAP NO -->
          <td style="padding: 0.85rem 0.75rem; color: #00f3ff; font-family: monospace; font-weight: 800; font-size: 0.85rem;">
            ${item.sapNo}
          </td>

          <!-- SERİ NO -->
          <td style="padding: 0.85rem 0.75rem; color: #E2E8F0; font-family: monospace; font-weight: 700; font-size: 0.85rem; white-space: nowrap;">
            ${item.serialNo && item.serialNo !== '-' && item.serialNo.toLowerCase() !== 'yok' && item.serialNo.toLowerCase() !== 'tanımsız' 
              ? item.serialNo 
              : `<span style="background: rgba(236, 72, 153, 0.12); color: #f472b6; border: 1px solid rgba(236, 72, 153, 0.35); padding: 3px 8px; border-radius: 4px; font-size: 0.73rem; font-weight: 800; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.7rem;"></i> Seri No Yok
                </span>`
            }
          </td>

          <!-- MALZEME TANIMI -->
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 700; color: #FFF; font-size: 0.88rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.description}">
              ${item.description}
            </div>
            <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">
              Miktar: <strong style="color: #14F195;">${item.quantity} Adet</strong>
            </div>
          </td>

          <!-- DURUM / REVİZE -->
          <td style="padding: 0.85rem 0.75rem;">
            ${statusBadge}
          </td>

          <!-- RAF / KONUM -->
          <td style="padding: 0.85rem 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 5px; color: #CBD5E1; font-size: 0.82rem; font-weight: 600;">
              <i class="fa-solid fa-location-dot" style="color: #a78bfa; font-size: 0.75rem;"></i>
              ${item.shelfNo || '<span style="color: #64748B;">-</span>'}
              <i onclick="window.openEditShelfModal('${item.id}', '${item.sapNo}', '${item.shelfNo || ''}')" class="fa-solid fa-pen" style="cursor: pointer; opacity: 0.6; font-size: 0.68rem; margin-left: 3px;" title="Rafı Değiştir" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'"></i>
            </span>
          </td>

          <!-- GELDİĞİ SAHA / DEPO & BEKLEME SÜRESİ -->
          <td style="padding: 0.85rem 0.75rem; color: #E2E8F0; font-size: 0.83rem; font-weight: 600;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c; font-size: 0.75rem;"></i>
              <span>${sourceWhName}</span>
            </div>
            <div style="font-size: 0.7rem; color: #64748B; margin-top: 2px;">
              Geliş: ${formatDateOnly(item.sentAt || item.receivedAt)}
            </div>
            ${daysInStock.badgeHtml}
          </td>

          <!-- ARIZA KODU & AÇIKLAMA -->
          <td style="padding: 0.85rem 0.75rem; max-width: 220px;">
            ${item.faultCode && item.faultCode !== '-' ? `
              <div style="font-size: 0.76rem; color: #F59E0B; font-weight: 700;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.7rem; margin-right: 3px;"></i> ${item.faultCode}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.75rem;">Kod yok</span>'}
            <div style="font-size: 0.74rem; color: #94A3B8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-top: 2px;" title="${item.faultDesc || ''}">
              ${item.faultDesc || '-'}
            </div>
          </td>

          <!-- TAMİR GEÇMİŞİ (KAÇINCI GELİŞİ) -->
          <td style="padding: 0.85rem 0.75rem; text-align: center;">
            ${visitBadge}
          </td>

          <!-- AKSİYONLAR -->
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 6px;">
              ${(!item.serialNo || item.serialNo === '-' || item.serialNo.toLowerCase() === 'yok' || item.serialNo.toLowerCase() === 'tanımsız') ? `
                <button onclick="window.assignAutoSerialToCard('${item.id}', '${item.sapNo}')" style="background: linear-gradient(135deg, #EC4899 0%, #be185d 100%); color: #FFF; border: none; padding: 5px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; height: 28px; box-sizing: border-box; transition: all 0.2s; box-shadow: 0 0 10px rgba(236,72,153,0.3);" onmouseover="this.style.filter='brightness(1.15)';" onmouseout="this.style.filter='none';" title="Otomatik Benzersiz Seri No Üret & Ata">
                  <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 0.72rem;"></i> Seri No Ata
                </button>
              ` : ''}

              <!-- Teslim Al ve Reddet (Sadece Kabul bekleyenler için) -->
              ${item.status === 'PENDING_ARRIVAL' ? `
                <button onclick="window.openReceiveRepairModal('${item.id}')" style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 5px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; height: 28px; box-sizing: border-box;" title="Atölyede Teslim Al">
                  <i class="fa-solid fa-hand-holding-hand"></i> Teslim Al
                </button>
                <button onclick="window.openRejectRepairModal('${item.id}')" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 5px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; height: 28px; box-sizing: border-box;" title="Reddet ve Depoya Geri Gönder" onmouseover="this.style.background='#EF4444'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#EF4444';">
                  <i class="fa-solid fa-ban"></i> Reddet
                </button>
              ` : ''}

              <!-- Tüm Süreç Detayları Butonu -->
              <button onclick="window.openCardHistoryModal('${item.id}')" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.3); padding: 5px 9px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 5px; height: 28px; box-sizing: border-box;" onmouseover="this.style.background='rgba(0, 243, 255, 0.2)'" onmouseout="this.style.background='rgba(0, 243, 255, 0.08)'" title="Tüm Süreç ve Geçmiş Detayları">
                <i class="fa-solid fa-circle-info"></i> Süreç Detayı
              </button>

              ${isAdmin ? `
                <!-- Single Delete Button -->
                <button onclick="window.deleteSingleWorkshopRepair('${item.id}', '${item.sapNo}', '${(item.serialNo || '-').replace(/'/g, "\\'")}')" style="background: rgba(239, 68, 68, 0.1); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 5px 8px; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s; height: 28px; box-sizing: border-box;" title="Bu Kartı Sil">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Render Summary Table (SAP Model Breakdown & Backlog Priority)
  const renderSummaryTable = (summaries: SapModelSummary[]) => {
    if (summaries.length === 0) {
      return `<tr><td colspan="7" style="text-align: center; padding: 2.5rem; color: #94A3B8;">Herhangi bir kart modeli bulunamadı.</td></tr>`;
    }

    return summaries.map(s => {
      let priorityBadge = '';
      if (s.waitingTurnaround >= 10) {
        priorityBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 8px; border-radius: 4px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-fire"></i> YÜKSEK BİRİKİM</span>`;
      } else if (s.waitingTurnaround >= 3) {
        priorityBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-bolt"></i> ORTA BİRİKİM</span>`;
      } else {
        priorityBadge = `<span style="background: rgba(16, 185, 129, 0.12); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 4px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> DENGELİ</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 0.85rem 0.75rem;">${priorityBadge}</td>
          <td style="padding: 0.85rem 0.75rem; color: #00f3ff; font-family: monospace; font-weight: 800; font-size: 0.9rem;">
            ${s.sapNo}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 800; color: #FFF; font-size: 0.88rem;">${s.description}</div>
            ${s.criticalCount > 0 ? `<div style="font-size: 0.72rem; color: #EF4444; font-weight: 700; margin-top: 2px;"><i class="fa-solid fa-triangle-exclamation"></i> ${s.criticalCount} adet kritik arıza bildirilmiş</div>` : ''}
          </td>
          <td style="padding: 0.85rem 0.75rem; font-weight: 900; font-size: 0.95rem; color: #FFF;">
            ${s.totalCount} Adet
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <div style="display: flex; gap: 6px; flex-wrap: wrap; font-size: 0.74rem;">
              ${s.pendingCount > 0 ? `<span style="background: rgba(234, 179, 8, 0.15); color: #eab308; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Yolda: ${s.pendingCount}</span>` : ''}
              ${s.underRepairCount > 0 ? `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Tamirde: ${s.underRepairCount}</span>` : ''}
              ${s.repairedCount > 0 ? `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; padding: 2px 6px; border-radius: 4px; font-weight: 700;">Revize Sağlam: ${s.repairedCount}</span>` : ''}
            </div>
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: center;">
            <span style="font-size: 1.1rem; font-weight: 900; font-family: 'Rajdhani', sans-serif; color: ${s.waitingTurnaround >= 10 ? '#EF4444' : s.waitingTurnaround > 0 ? '#F59E0B' : '#14F195'};">
              ${s.waitingTurnaround} Adet
            </span>
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <button onclick="window.filterWorkshopBySap('${s.sapNo}')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.45rem 0.9rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 0 10px rgba(20,241,149,0.25);">
              <i class="fa-solid fa-list-check"></i> Kartları Listele (${s.totalCount})
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  const activeTab = (window as any)._workshopStockTab || 'ALL';
  const sapFilter = (window as any)._workshopStockSapFilter || '';
  const warehouseFilter = (window as any)._workshopStockWarehouseFilter || '';
  const viewMode = (window as any)._workshopStockViewMode || 'DETAILED';
  const currentPage = (window as any)._workshopStockPage || 1;
  const initialFilteredItems = filterItems();
  const totalPages = Math.max(1, Math.ceil(initialFilteredItems.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  (window as any)._workshopStockPage = safeCurrentPage;

  const startIndex = (safeCurrentPage - 1) * PAGE_SIZE;
  const pagedItems = initialFilteredItems.slice(startIndex, startIndex + PAGE_SIZE);

  const topWaiting = sortedSapSummaries.filter(s => s.waitingTurnaround > 0).slice(0, 3);
  const activeFilteredSapObj = sapFilter ? sortedSapSummaries.find(s => s.sapNo === sapFilter) : null;
  const activeFilteredWhObj = warehouseFilter ? (warehouses.find(w => w.id === warehouseFilter)?.name || warehouseFilter) : null;

  // Build unique source warehouse summaries
  const sourceWarehouseMap = new Map<string, { id: string; name: string; count: number }>();
  allRepairs.forEach(r => {
    const whId = r.sourceWarehouseId || 'MTA';
    const whObj = warehouses.find(w => w.id === whId);
    const whName = whObj ? whObj.name : whId;
    if (!sourceWarehouseMap.has(whId)) {
      sourceWarehouseMap.set(whId, { id: whId, name: whName, count: 0 });
    }
    sourceWarehouseMap.get(whId)!.count++;
  });
  const sourceWarehouseSummaries = Array.from(sourceWarehouseMap.values()).sort((a, b) => b.count - a.count);

  return `
    <div class="fade-in-up content-area">
      
      <!-- Top Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-warehouse" style="margin-right: 0.4rem; color: #3B82F6;"></i> ATÖLYE TAMİR STOĞU
            </h2>
          </div>
          <p style="color: var(--text-dim); margin: 0.35rem 0 0 0; font-size: 0.88rem;">
            Merkez Tamir Atölyesi bünyesindeki arızalı, işlemdeki ve revize edilmiş sağlam parçaların detaylı stok ve takip paneli.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <button onclick="window.openManualRepairEntryModal()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; height: 34px; padding: 0 0.85rem; border-radius: 6px; font-size: 0.76rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 12px rgba(20,241,149,0.25);" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
            <i class="fa-solid fa-plus-circle"></i> + MANUEL KART GİRİŞİ
          </button>
          <button id="workshop-stock-bulk-take-btn" onclick="window.takeSelectedWorkshopStockToBench()" class="btn-cyber" style="display: none; background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='#14F195'; this.style.color='#0A0E17'" onmouseout="this.style.background='rgba(20, 241, 149, 0.15)'; this.style.color='#14F195'">
            <i class="fa-solid fa-screwdriver-wrench"></i> SEÇİLENLERİ ONARIMA AL (<span id="workshop-stock-take-selected-count">0</span>)
          </button>
          ${isAdmin ? `
            <button id="workshop-stock-bulk-delete-btn" onclick="window.deleteSelectedWorkshopStock()" class="btn-cyber" style="display: none; background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(239, 68, 68, 0.3)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'">
              <i class="fa-solid fa-trash-can"></i> SEÇİLENLERİ SİL (<span id="workshop-stock-selected-count">0</span>)
            </button>
          ` : ''}
          <button onclick="window.downloadWorkshopCardsTemplate()" class="btn-cyber" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'" title="Toplu kart girişi için örnek Excel şablonunu indir">
            <i class="fa-solid fa-file-excel"></i> ŞABLON İNDİR
          </button>
          <input type="file" id="workshop-stock-excel-upload-input" accept=".xlsx, .xls" style="display: none;" onchange="window.uploadWorkshopCardsFromExcel(event)" />
          <button onclick="document.getElementById('workshop-stock-excel-upload-input').click()" class="btn-cyber" style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'" title="Excel dosyasından toplu kart yükle">
            <i class="fa-solid fa-file-arrow-up"></i> EXCEL İLE KART YÜKLE
          </button>
          ${isAdmin ? `
            <button onclick="window.clearAllWorkshopStock()" class="btn-cyber" style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.35); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.12)'" title="Atölye kart kayıtlarını tamamen sıfırla">
              <i class="fa-solid fa-trash-can"></i> LİSTEYİ SIFIRLA
            </button>
          ` : ''}
          <button onclick="window.exportWorkshopStockExcel()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.1); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <i class="fa-solid fa-download"></i> LİSTEYİ İNDİR
          </button>
          <button onclick="window.navigate('workshop-dispatches')" class="btn-cyber" style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); height: 34px; padding: 0 0.75rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" title="Sevk edilen malzemeleri görüntüle">
            <i class="fa-solid fa-truck-fast"></i> SEVK EDİLENLER
          </button>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; height: 34px; padding: 0 0.95rem; border-radius: 6px; font-size: 0.78rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 15px rgba(20,241,149,0.25);" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">
            <i class="fa-solid fa-microchip"></i> KART TAMİR MERKEZİNE GEÇ
          </button>
        </div>
      </div>

      <!-- Smart Workshop Advisor Banner (Seri / Toplu Tamir Tavsiyesi) -->
      ${topWaiting.length > 0 ? `
        <div class="glass-panel fade-in-up" style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.08) 0%, rgba(59, 130, 246, 0.1) 100%); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; box-shadow: 0 0 25px rgba(20,241,149,0.12);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(20, 241, 149, 0.2); border: 1px solid #14F195; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.3rem;">
              <i class="fa-solid fa-lightbulb"></i>
            </div>
            <div>
              <div style="font-size: 0.92rem; font-weight: 800; color: #14F195; letter-spacing: 0.5px; text-transform: uppercase;">
                🎯 AKILLI ATÖLYE YÖNLENDİRMESİ — ÖNERİLEN SERİ TAMİR ODAĞI
              </div>
              <div style="font-size: 0.8rem; color: #E2E8F0; margin-top: 3px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                <span>Atölyede en çok biriken ve seri tamire uygun modeller:</span>
                ${topWaiting.map((t, idx) => `
                  <button onclick="window.filterWorkshopBySap('${t.sapNo}')" style="cursor: pointer; background: rgba(0,0,0,0.45); border: 1px solid ${idx === 0 ? '#14F195' : 'rgba(255,255,255,0.15)'}; padding: 2px 8px; border-radius: 4px; color: ${idx === 0 ? '#14F195' : '#60a5fa'}; font-weight: 800; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 4px;" title="Bu modelin ${t.waitingTurnaround} adet kartını aç">
                    <span>#${idx + 1}</span> <strong>SAP ${t.sapNo}</strong> (${t.waitingTurnaround} Adet Bekliyor)
                  </button>
                `).join('')}
              </div>
            </div>
          </div>
          
          <div style="display: flex; gap: 6px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
            <button onclick="window.setWorkshopStockViewMode('SUMMARY')" style="background: ${viewMode === 'SUMMARY' ? '#14F195' : 'transparent'}; color: ${viewMode === 'SUMMARY' ? '#0A0E17' : '#94A3B8'}; font-weight: 800; padding: 0.45rem 0.85rem; border-radius: 6px; border: none; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
              <i class="fa-solid fa-chart-pie"></i> Kart Yoğunluk Tablosu (${sortedSapSummaries.length})
            </button>
            <button onclick="window.setWorkshopStockViewMode('DETAILED')" style="background: ${viewMode === 'DETAILED' ? '#14F195' : 'transparent'}; color: ${viewMode === 'DETAILED' ? '#0A0E17' : '#94A3B8'}; font-weight: 800; padding: 0.45rem 0.85rem; border-radius: 6px; border: none; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
              <i class="fa-solid fa-list-check"></i> Detaylı Seri Listesi (${totalCount})
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Quick Stats Counters -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem;">
        
        <!-- Total -->
        <div onclick="window.setWorkshopStockTab('ALL')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); cursor: pointer;" title="Tüm Kartları Listele">
          <div>
            <div style="font-size: 0.74rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Toplam Atölye Stoğu</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${totalCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.25); display: flex; align-items: center; justify-content: center; color: #00f3ff; font-size: 1.15rem;">
            <i class="fa-solid fa-warehouse"></i>
          </div>
        </div>

        <!-- Defect / Pending Arrival -->
        <div onclick="window.setWorkshopStockTab('DEFECT')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(234, 179, 8, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(234, 179, 8, 0.04); cursor: pointer;" title="Kabul Bekleyen Kargoları Listele">
          <div>
            <div style="font-size: 0.74rem; color: #eab308; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Kabul Bekleyen (Yolda)</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #eab308; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${pendingDefectCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(234, 179, 8, 0.15); border: 1px solid rgba(234, 179, 8, 0.3); display: flex; align-items: center; justify-content: center; color: #eab308; font-size: 1.15rem;">
            <i class="fa-solid fa-truck"></i>
          </div>
        </div>

        <!-- Waiting in Stock (Rafta Bekleyen Arızalılar) -->
        <div onclick="window.setWorkshopStockTab('WAITING_STOCK')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(59, 130, 246, 0.04); cursor: pointer;" title="Rafta / Ambarda Bekleyen Arızalı Kartlar">
          <div>
            <div style="font-size: 0.74rem; color: #60a5fa; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Arızalı Stok (Bekleyen)</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #60a5fa; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${waitingStockCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 1.15rem;">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
        </div>

        <!-- Active Work Orders (Masada Onarımda) -->
        <div onclick="window.setWorkshopStockTab('ACTIVE_TASK')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(20, 241, 149, 0.3); display: flex; align-items: center; justify-content: space-between; background: rgba(20, 241, 149, 0.04); cursor: pointer;" title="İş Emri Açılmış / Masada Onarımda Olan Kartlar">
          <div>
            <div style="font-size: 0.74rem; color: #14F195; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Masada Onarımda</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #14F195; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${activeWorkOrderCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.15rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
        </div>

        <!-- Repaired Ready -->
        <div onclick="window.setWorkshopStockTab('REPAIRED')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.04); cursor: pointer;" title="Revize Sağlam Kartları Listele">
          <div>
            <div style="font-size: 0.74rem; color: #34d399; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Revize Sağlam (Hazır)</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #34d399; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${repairedReadyCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: #34d399; font-size: 1.15rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <!-- No Serial Cards Counter Card -->
        <div onclick="window.setWorkshopStockTab('NO_SERIAL')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(236, 72, 153, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(236, 72, 153, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(236,72,153,0.09)'" onmouseout="this.style.background='rgba(236,72,153,0.04)'" title="Seri Numarası Olmayan Kartları Filtrele">
          <div>
            <div style="font-size: 0.74rem; color: #f472b6; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Seri Numarasızlar</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #f472b6; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${noSerialStockCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(236, 72, 153, 0.15); border: 1px solid rgba(236, 72, 153, 0.3); display: flex; align-items: center; justify-content: center; color: #f472b6; font-size: 1.15rem;">
            <i class="fa-solid fa-wand-magic-sparkles"></i>
          </div>
        </div>

      </div>

      <!-- Filters & Live Search Toolbar (Single Row) -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; gap: 0.75rem; flex-wrap: wrap;">
        
        <!-- Tab Pills -->
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button onclick="window.setWorkshopStockTab('ALL')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'ALL' ? '#00f3ff' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'ALL' ? 'rgba(0,243,255,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'ALL' ? '#00f3ff' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            TÜMÜ (${totalCount})
          </button>
          <button onclick="window.setWorkshopStockTab('DEFECT')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'DEFECT' ? '#eab308' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'DEFECT' ? 'rgba(234,179,8,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'DEFECT' ? '#eab308' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-truck" style="margin-right: 6px;"></i> KABUL BEKLEYEN (${pendingDefectCount})
          </button>
          <button onclick="window.setWorkshopStockTab('WAITING_STOCK')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${(activeTab === 'WAITING_STOCK' || activeTab === 'UNDER_REPAIR') ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; background: ${(activeTab === 'WAITING_STOCK' || activeTab === 'UNDER_REPAIR') ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${(activeTab === 'WAITING_STOCK' || activeTab === 'UNDER_REPAIR') ? '#60a5fa' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-boxes-stacked" style="margin-right: 6px;"></i> ARIZALI STOK (${waitingStockCount})
          </button>
          <button onclick="window.setWorkshopStockTab('ACTIVE_TASK')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'ACTIVE_TASK' ? '#14F195' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'ACTIVE_TASK' ? 'rgba(20,241,149,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'ACTIVE_TASK' ? '#14F195' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-screwdriver-wrench" style="margin-right: 6px;"></i> MASADA ONARIMDA (${activeWorkOrderCount})
          </button>
          <button onclick="window.setWorkshopStockTab('REPAIRED')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'REPAIRED' ? '#10B981' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'REPAIRED' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'REPAIRED' ? '#34d399' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> REVİZE SAĞLAM (${repairedReadyCount})
          </button>
          
          <!-- 6. SERİ NUMARASIZ KARTLAR TAB -->
          <button onclick="window.setWorkshopStockTab('NO_SERIAL')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${activeTab === 'NO_SERIAL' ? '#EC4899' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'NO_SERIAL' ? 'rgba(236,72,153,0.18)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'NO_SERIAL' ? '#f472b6' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-wand-magic-sparkles" style="margin-right: 6px; color: #f472b6;"></i> SERİ NUMARASIZLAR (${noSerialStockCount})
          </button>
          
          ${activeTab === 'NO_SERIAL' && noSerialStockCount > 0 ? `
            <button onclick="window.batchAssignAutoSerialsToAll()" class="btn-cyber" style="height: 38px; padding: 0 1rem; background: linear-gradient(135deg, #EC4899 0%, #be185d 100%); color: #FFF; font-weight: 900; border-radius: 8px; font-size: 0.78rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 15px rgba(236,72,153,0.35);">
              <i class="fa-solid fa-wand-magic-sparkles"></i> TÜMÜNE SERİ NO ATA (${noSerialStockCount})
            </button>
          ` : ''}
        </div>

        <!-- Search and SAP Model Selector & Warehouse Selector (Single Row Right) -->
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
          
          <!-- Warehouse / Source Site Selector Dropdown -->
          <select onchange="window.filterWorkshopByWarehouse(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.9); border: 1px solid ${warehouseFilter ? '#3B82F6' : 'rgba(255,255,255,0.1)'}; color: ${warehouseFilter ? '#60a5fa' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; width: 195px; box-sizing: border-box;">
            <option value="" ${!warehouseFilter ? 'selected' : ''}>🏢 Tüm Sahalar (${totalCount})</option>
            ${sourceWarehouseSummaries.map(w => `
              <option value="${w.id}" ${warehouseFilter === w.id ? 'selected' : ''} style="background: #0B101B; color: #FFF;">
                ${w.name} (${w.count})
              </option>
            `).join('')}
          </select>

          <!-- SAP Model Selector Dropdown -->
          <select onchange="window.filterWorkshopBySap(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.9); border: 1px solid ${sapFilter ? '#14F195' : 'rgba(255,255,255,0.1)'}; color: ${sapFilter ? '#14F195' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; width: 220px; box-sizing: border-box;">
            <option value="" ${!sapFilter ? 'selected' : ''}>📦 Tüm Kart Tipleri (${totalCount})</option>
            ${sortedSapSummaries.map(s => `
              <option value="${s.sapNo}" ${sapFilter === s.sapNo ? 'selected' : ''} style="background: #0B101B; color: ${s.waitingTurnaround > 0 ? '#60a5fa' : '#FFF'};">
                ${s.sapNo} - ${s.description.slice(0, 18)} (${s.totalCount})
              </option>
            `).join('')}
          </select>

          <!-- Search Input -->
          <div style="position: relative; width: 220px; height: 38px;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.82rem;"></i>
            <input 
              type="text" 
              placeholder="Seri, Arıza veya Raf ara..." 
              value="${(window as any)._workshopStockSearch || ''}"
              oninput="window.debounceWorkshopSearch(this.value)" 
              style="width: 100%; height: 38px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #FFF; padding-left: 34px; padding-right: 12px; font-size: 0.82rem; outline: none; box-sizing: border-box;"
            />
          </div>

          ${sapFilter || warehouseFilter || (window as any)._workshopStockSearch ? `
            <button onclick="window.clearWorkshopSapFilter(); window.filterWorkshopStock('');" class="btn-cyber" style="height: 38px; padding: 0 0.85rem; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;" title="Filtreleri Temizle">
              <i class="fa-solid fa-filter-circle-xmark"></i>
            </button>
          ` : ''}

        </div>

      </div>

      <!-- Active SAP or Warehouse Filter Highlight Alert Bar -->
      ${(activeFilteredSapObj || activeFilteredWhObj) ? `
        <div class="glass-panel fade-in-up" style="background: rgba(0, 243, 255, 0.06); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 8px; padding: 0.65rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            ${activeFilteredWhObj ? `
              <span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight: 800; font-size: 0.76rem; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-charging-station"></i> ${activeFilteredWhObj}
              </span>
            ` : ''}
            ${activeFilteredSapObj ? `
              <span style="background: #00f3ff; color: #0A0E17; font-weight: 900; font-size: 0.75rem; padding: 2px 7px; border-radius: 4px; font-family: monospace;">
                SAP ${activeFilteredSapObj.sapNo}
              </span>
              <span style="font-weight: 800; color: #FFF; font-size: 0.85rem;">
                ${activeFilteredSapObj.description}
              </span>
            ` : ''}
            <span style="color: #94A3B8; font-size: 0.78rem;">
              (Filtrelenen Toplam: <strong style="color: #14F195;">${initialFilteredItems.length} Adet</strong>)
            </span>
          </div>
          <button onclick="window.clearWorkshopSapFilter()" style="background: transparent; border: none; color: #00f3ff; font-weight: 700; font-size: 0.78rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-xmark"></i> Filtreyi Kaldır
          </button>
        </div>
      ` : ''}

      <!-- Main Content View: Summary Table or Detailed Serial Table -->
      ${viewMode === 'SUMMARY' ? `
        <!-- SUMMARY TABLE VIEW (SAP MODEL BREAKDOWN) -->
        <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
          <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 1rem 0.75rem; width: 140px;">BİRİKİM / ÖNCELİK</th>
                <th style="padding: 1rem 0.75rem; width: 100px;">SAP NO</th>
                <th style="padding: 1rem 0.75rem;">KART / MALZEME TANIMI</th>
                <th style="padding: 1rem 0.75rem; width: 110px;">TOPLAM STOK</th>
                <th style="padding: 1rem 0.75rem; width: 220px;">DURUM DAĞILIMI</th>
                <th style="padding: 1rem 0.75rem; width: 140px; text-align: center;">TAMİR BEKLEYEN</th>
                <th style="padding: 1rem 0.75rem; text-align: right; width: 180px;">AKSİYON</th>
              </tr>
            </thead>
            <tbody>
              ${renderSummaryTable(sortedSapSummaries)}
            </tbody>
          </table>
        </div>
      ` : `
        <!-- DETAILED SERIAL TABLE VIEW -->
        <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
          <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 1rem 0.5rem; width: 40px; text-align: center;">
                  <input type="checkbox" id="workshop-stock-select-all" onchange="window.toggleSelectAllWorkshopStock(this.checked)" style="cursor: pointer; width: 16px; height: 16px; accent-color: #ef4444;" title="Tümünü Seç / Kaldır" />
                </th>
                <th style="padding: 1rem 0.75rem; width: 100px;">SAP NO</th>
                <th style="padding: 1rem 0.75rem; width: 120px;">SERİ NO</th>
                <th style="padding: 1rem 0.75rem;">MALZEME TANIMI</th>
                <th style="padding: 1rem 0.75rem; width: 150px;">DURUM / REVİZE</th>
                <th style="padding: 1rem 0.75rem; width: 100px;">RAF / KONUM</th>
                <th style="padding: 1rem 0.75rem; width: 150px;">GELDİĞİ SAHA / DEPO</th>
                <th style="padding: 1rem 0.75rem; width: 180px;">ARIZA KODU & AÇIKLAMA</th>
                <th style="padding: 1rem 0.75rem; width: 140px; text-align: center;">TAMİR GEÇMİŞİ</th>
                <th style="padding: 1rem 0.75rem; text-align: right; width: 160px;">AKSİYONLAR</th>
              </tr>
            </thead>
            <tbody id="workshop-stock-tbody">
              ${renderTableRows(pagedItems)}
            </tbody>
          </table>
          <div id="workshop-stock-pagination">
            ${renderPagination(initialFilteredItems.length, safeCurrentPage)}
          </div>
        </div>
      `}

    </div>
  `;
};
