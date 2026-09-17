import { repairService, type RepairRecord } from '../services/RepairService';
import { serviceReportService } from '../services/ServiceReportService';
import { dataService } from '../services/DataService';
import { formatDisplayName } from '../utils/formatters';
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

const parseTimestamp = (val: any): number => {
  if (!val) return 0;
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const parsed = Date.parse(val);
    if (!isNaN(parsed)) return parsed;
  }
  if (val?.toDate && typeof val.toDate === 'function') {
    return val.toDate().getTime();
  }
  if (val?.seconds) {
    return val.seconds * 1000;
  }
  return 0;
};

const calculateDaysBetween = (startMs: number, endMs: number): number => {
  if (!startMs || !endMs || endMs < startMs) return 1;
  return Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
};

export type CardStatus = 'INSTALLED' | 'WAREHOUSE' | 'IN_TRANSIT' | 'DISMANTLED';

export interface CardHistoryEvent {
  id: string;
  type: 'TURBINE_DISMANTLE' | 'WORKSHOP_ARRIVAL' | 'WORKSHOP_REPAIR' | 'DISPATCH_SENT' | 'WAREHOUSE_RECEIVED' | 'TURBINE_INSTALLED' | 'OTHER';
  timestamp: number;
  dateFormatted: string;
  title: string;
  siteName?: string;
  turbineNo?: string;
  warehouseName?: string;
  personnel?: string;
  reportNo?: string;
  dispatchNo?: string;
  faultCode?: string;
  faultDesc?: string;
  notes?: string;
  components?: string[];
  testStatus?: string;
  imageUrl?: string;
  durationNote?: string;
  badgeText: string;
  badgeColor: string;
  badgeBg: string;
  icon: string;
}

export interface TrackedCard {
  cardKey: string;
  repairId: string;
  sapNo: string;
  serialNo: string;
  description: string;
  dispatchNo: string;
  dispatchDate: string;
  dispatchTimestamp: number;
  targetWarehouseName: string;
  targetWarehouseId: string;
  currentStatus: CardStatus;
  currentLocationText: string;
  currentLocationDetails: string;
  durationBadgeText: string;
  durationSubText: string;
  durationText: string;
  durationBadgeColor: string;
  durationBadgeBg: string;
  lastEventDate: string;
  lastEventTimestamp: number;
  lastPersonnel: string;
  events: CardHistoryEvent[];
  rawRepair: RepairRecord;
}

export async function CardTrackingPage(): Promise<string> {
  const warehouses = dataService.getWarehouses();

  let allRepairs: RepairRecord[] = [];
  try {
    allRepairs = await repairService.getRepairs();
  } catch (err) {
    console.error("CardTracking: Error fetching repairs", err);
  }

  let allReports: any[] = [];
  try {
    allReports = await serviceReportService.getAllReports();
  } catch (err) {
    console.error("CardTracking: Error fetching reports", err);
  }

  // 1. Build Turbine Usage & Dismantle Map from Service Reports
  const turbineUsageMap = new Map<string, {
    siteName: string;
    turbineNo: string;
    date: string;
    timestamp: number;
    personnel: string;
    reportNo: string;
    title?: string;
  }>();

  const turbineDismantleMap = new Map<string, {
    siteName: string;
    turbineNo: string;
    date: string;
    timestamp: number;
    personnel: string;
    reportNo: string;
    reason?: string;
  }>();

  allReports.forEach(report => {
    if (!report.materials || !Array.isArray(report.materials)) return;
    const reportDate = report.date ? formatDateOnly(report.date) : '-';
    const reportTs = parseTimestamp(report.date || report.createdAt);
    const siteName = report.siteName || '';
    const turbineNo = report.turbineNo || 'Türbin';
    const reportNo = report.reportNo || report.id || '-';
    const techName = formatDisplayName(report.createdBy || report.personnel?.[0] || 'Saha Teknisyeni');

    report.materials.forEach((mat: any) => {
      const matSerial = String(mat.serialNo || '').trim().toLowerCase();
      if (!matSerial || matSerial === '-' || matSerial === 'yok' || matSerial === 'yoktur' || matSerial === 'null') return;
      const matSap = String(mat.sapNo || '').trim();
      const rawSap = matSap.startsWith('R') ? matSap.slice(1) : matSap;
      const key1 = `${rawSap}___${matSerial}`;
      const key2 = `${matSap}___${matSerial}`;

      // Takılan Malzeme (Türbine Montaj)
      if ((mat.used || 0) > 0 || mat.type === 'T') {
        const usageInfo = {
          siteName,
          turbineNo,
          date: reportDate,
          timestamp: reportTs,
          personnel: techName,
          reportNo,
          title: report.title || 'Türbinde montajı tamamlandı'
        };
        // If multiple reports exist, keep the latest
        const existing = turbineUsageMap.get(key1);
        if (!existing || reportTs >= existing.timestamp) {
          turbineUsageMap.set(key1, usageInfo);
          turbineUsageMap.set(key2, usageInfo);
        }
      }

      // Sökülen Malzeme (Türbinden Söküm)
      if ((mat.defectCount || 0) > 0 || mat.type === 'S') {
        const dismantleInfo = {
          siteName,
          turbineNo,
          date: reportDate,
          timestamp: reportTs,
          personnel: techName,
          reportNo,
          reason: mat.defectReason || report.title || 'Arızalı söküldü'
        };
        const existing = turbineDismantleMap.get(key1);
        if (!existing || reportTs >= existing.timestamp) {
          turbineDismantleMap.set(key1, dismantleInfo);
          turbineDismantleMap.set(key2, dismantleInfo);
        }
      }
    });
  });

  // 2. FILTER EXACTLY LIKE WorkshopDispatches: Only SENT_BACK or COMPLETED items!
  const dispatchedItems = allRepairs.filter((r: RepairRecord) => {
    const s = (r.serialNo || '').trim().toLowerCase();
    if (!s || s === '-' || s === 'yok' || s === 'yoktur' || s === 'null') return false;
    return r.status === 'SENT_BACK' || r.status === 'COMPLETED';
  });

  const nowMs = Date.now();

  // 3. Construct TrackedCard for each dispatched item
  const trackedCards: TrackedCard[] = dispatchedItems.map(item => {
    const cleanSerial = (item.serialNo || '').trim().toLowerCase();
    const cleanSap = (item.sapNo || '').trim();
    const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
    const cardKey = `${rawSap}___${cleanSerial}`;

    const targetWhId = item.targetWarehouseId || item.sourceWarehouseId || 'UNKNOWN';
    const targetWhName = warehouses.find(w => w.id === targetWhId)?.name || item.sourceWarehouseId || 'Saha Deposu';

    const rawDNo = (item.dispatchNo && item.dispatchNo !== '-' ? item.dispatchNo : (item.mctNo || '-')).trim();
    // Clean prefix like "Form NO: 61" -> "61"
    const cleanDispatchNo = rawDNo.replace(/^(form\s*no:?\s*|sevk\s*no:?\s*|#\s*)/i, '').trim();

    const dispatchTs = parseTimestamp(item.dispatchedAt || item.completedAt || item.lastUpdated);
    const dispatchDate = formatDateOnly(item.dispatchedAt || item.completedAt || item.lastUpdated);

    const usage = turbineUsageMap.get(cardKey) || turbineUsageMap.get(`${cleanSap}___${cleanSerial}`);
    const dismantle = turbineDismantleMap.get(cardKey) || turbineDismantleMap.get(`${cleanSap}___${cleanSerial}`);

    let currentStatus: CardStatus = 'IN_TRANSIT';
    let currentLocationText = '';
    let currentLocationDetails = '';
    let durationBadgeText = '';
    let durationSubText = '';
    let durationText = '';
    let durationBadgeColor = '#60a5fa';
    let durationBadgeBg = 'rgba(96, 165, 250, 0.15)';

    // Chronological Events
    const events: CardHistoryEvent[] = [];

    // Event 1: MTA Arrival
    const arrivalTs = parseTimestamp(item.sentAt || item.receivedAt || item.createdAt);
    if (arrivalTs > 0) {
      events.push({
        id: `arrival_${item.id}`,
        type: 'WORKSHOP_ARRIVAL',
        timestamp: arrivalTs,
        dateFormatted: formatDateOnly(item.sentAt || item.receivedAt),
        title: "MTA Atölyesine Kabul Edildi",
        warehouseName: 'Merkez Tamir Atölyesi',
        personnel: formatDisplayName(item.sentBy || item.receivedBy || 'Atölye Sorumlusu'),
        faultCode: item.faultCode,
        faultDesc: item.faultDesc,
        notes: item.faultDesc ? `Bildirilen Arıza: ${item.faultDesc}` : undefined,
        badgeText: 'MTA GİRİŞİ',
        badgeColor: '#38bdf8',
        badgeBg: 'rgba(56, 189, 248, 0.15)',
        icon: 'fa-box-archive'
      });
    }

    // Event 2: MTA Repair
    const repairTs = parseTimestamp(item.repairedAt || item.lastUpdated || item.sentAt);
    const testDone = item.testStatus === 'TESTED';
    events.push({
      id: `repair_${item.id}`,
      type: 'WORKSHOP_REPAIR',
      timestamp: repairTs || (arrivalTs + 3600000),
      dateFormatted: formatDateOnly(item.repairedAt || item.lastUpdated || item.sentAt),
      title: "MTA Onarımı ve Test Masası Doğrulaması",
      warehouseName: 'Merkez Tamir Atölyesi',
      personnel: formatDisplayName(item.repairedBy || 'Atölye Teknisyeni'),
      notes: item.repairNotes || 'Onarım ve test masası kontrolleri tamamlandı',
      testStatus: testDone ? 'Test Masasında Doğrulandı' : 'Onarım Yapıldı',
      components: item.usedComponents?.map((c: any) => `${c.name || c.code || 'Parça'}${c.value ? ` (${c.value})` : ''}`),
      imageUrl: item.repairImageUrl,
      badgeText: testDone ? 'TEST EDİLDİ' : 'ONARILDI',
      badgeColor: '#14F195',
      badgeBg: 'rgba(20, 241, 149, 0.15)',
      icon: 'fa-circle-check'
    });

    // Event 3: MTA Dispatch
    events.push({
      id: `dispatch_${item.id}`,
      type: 'DISPATCH_SENT',
      timestamp: dispatchTs || (repairTs + 7200000),
      dateFormatted: dispatchDate,
      title: `MTA'dan Sahaya Sevk Edildi ➔ ${targetWhName}`,
      siteName: targetWhName,
      warehouseName: targetWhName,
      personnel: formatDisplayName(item.dispatchedBy || 'Atölye Sorumlusu'),
      dispatchNo: cleanDispatchNo,
      notes: `Sevk Formu #${cleanDispatchNo} ile ${targetWhName} deposuna gönderildi`,
      badgeText: `SEVK #${cleanDispatchNo}`,
      badgeColor: '#60a5fa',
      badgeBg: 'rgba(96, 165, 250, 0.15)',
      icon: 'fa-truck-fast'
    });

    // Event 4: Warehouse Received (If completed)
    if (item.status === 'COMPLETED') {
      const compTs = parseTimestamp(item.completedAt || item.lastUpdated);
      events.push({
        id: `completed_${item.id}`,
        type: 'WAREHOUSE_RECEIVED',
        timestamp: compTs || (dispatchTs + 86400000),
        dateFormatted: formatDateOnly(item.completedAt || item.lastUpdated),
        title: `${targetWhName} Deposuna Teslim Alındı (Yedek Stok)`,
        siteName: targetWhName,
        warehouseName: targetWhName,
        personnel: formatDisplayName((item as any).completedBy || 'Saha Ekibi'),
        notes: `Saha deposu tarafından sağlam teslim alındı ve yedek parça stoğuna eklendi`,
        badgeText: 'DEPO YEDEĞİNDE',
        badgeColor: '#10B981',
        badgeBg: 'rgba(16, 185, 129, 0.15)',
        icon: 'fa-check-double'
      });
    }

    // Event 5: Turbine Install & Dismantle
    if (usage && (!dispatchTs || usage.timestamp >= dispatchTs - 86400000)) {
      const isLaterDismantled = dismantle && dismantle.timestamp > usage.timestamp;

      events.push({
        id: `usage_${item.id}`,
        type: 'TURBINE_INSTALLED',
        timestamp: usage.timestamp,
        dateFormatted: usage.date,
        title: `${usage.siteName} ${usage.turbineNo} Türbinine Montajı Yapıldı`,
        siteName: usage.siteName,
        turbineNo: usage.turbineNo,
        reportNo: usage.reportNo,
        personnel: usage.personnel,
        notes: usage.title || 'Türbinde montajı tamamlandı ve devreye alındı',
        durationNote: isLaterDismantled 
          ? `Bu türbinde ${calculateDaysBetween(usage.timestamp, dismantle.timestamp)} gün görev yaptıktan sonra söküldü.`
          : `Şu anda ${calculateDaysBetween(usage.timestamp, nowMs)} gündür bu türbinde kesintisiz çalışıyor.`,
        badgeText: `TÜRBİNDE AKTİF (${usage.turbineNo})`,
        badgeColor: '#14F195',
        badgeBg: 'rgba(20, 241, 149, 0.18)',
        icon: 'fa-bolt'
      });

      if (isLaterDismantled) {
        const daysWorked = calculateDaysBetween(usage.timestamp, dismantle.timestamp);
        events.push({
          id: `dismantle_${item.id}`,
          type: 'TURBINE_DISMANTLE',
          timestamp: dismantle.timestamp,
          dateFormatted: dismantle.date,
          title: `${dismantle.siteName} ${dismantle.turbineNo} Türbininden Söküldü`,
          siteName: dismantle.siteName,
          turbineNo: dismantle.turbineNo,
          reportNo: dismantle.reportNo,
          personnel: dismantle.personnel,
          notes: dismantle.reason || 'Arıza / bakım nedeniyle türbinden söküldü',
          durationNote: `Türbinde ${daysWorked} gün kesintisiz çalıştıktan sonra söküldü.`,
          badgeText: `SÖKÜLDÜ (${dismantle.turbineNo})`,
          badgeColor: '#f87171',
          badgeBg: 'rgba(248, 113, 113, 0.15)',
          icon: 'fa-arrow-down-from-bracket'
        });

        currentStatus = 'DISMANTLED';
        currentLocationText = `${dismantle.siteName} / ${dismantle.turbineNo} (Söküldü)`;
        currentLocationDetails = `${dismantle.date} tarihinde türbinden söküldü (Rapor #${dismantle.reportNo})`;
        durationBadgeText = `${daysWorked} Gün Sonra Söküldü`;
        durationSubText = `Türbinden Söküldü`;
        durationText = `Türbinde ${daysWorked} Gün Çalıştıktan Sonra Söküldü`;
        durationBadgeColor = '#f87171';
        durationBadgeBg = 'rgba(239, 68, 68, 0.15)';
      } else {
        // STILL RUNNING IN TURBINE
        const activeDays = calculateDaysBetween(usage.timestamp, nowMs);
        currentStatus = 'INSTALLED';
        currentLocationText = `${usage.siteName} / ${usage.turbineNo}`;
        currentLocationDetails = `${usage.date} tarihinde takıldı (Rapor #${usage.reportNo})`;
        durationBadgeText = `${activeDays} Gündür Çalışıyor`;
        durationSubText = `Türbinde Kesintisiz`;
        durationText = `${activeDays} Gündür Kesintisiz Çalışıyor`;
        durationBadgeColor = '#14F195';
        durationBadgeBg = 'rgba(20, 241, 149, 0.15)';
      }
    } else if (item.status === 'COMPLETED') {
      // IN WAREHOUSE STOCK
      const daysInWh = calculateDaysBetween(parseTimestamp(item.completedAt || item.dispatchedAt), nowMs);
      currentStatus = 'WAREHOUSE';
      currentLocationText = `${targetWhName} Depo Stokunda`;
      currentLocationDetails = `Saha deposu teslim aldı, montaja hazır yedek olarak bekliyor`;
      durationBadgeText = `${daysInWh} Gündür Depoda`;
      durationSubText = `Saha Stoğunda Yedek`;
      durationText = `${daysInWh} Gündür Depo Stoğunda Yedek Bekliyor`;
      durationBadgeColor = '#10B981';
      durationBadgeBg = 'rgba(16, 185, 129, 0.15)';
    } else {
      // IN TRANSIT (SENT_BACK)
      const daysInTransit = calculateDaysBetween(dispatchTs, nowMs);
      currentStatus = 'IN_TRANSIT';
      currentLocationText = `Yolda ➔ ${targetWhName}`;
      currentLocationDetails = `MTA'dan sevk edildi, henüz hedef depo tarafından teslim alınmadı`;
      durationBadgeText = `${daysInTransit} Gündür Yolda`;
      durationSubText = `Saha Kabulü Bekleniyor`;
      durationText = `${daysInTransit} Gündür Yolda (Kabul Bekliyor)`;
      durationBadgeColor = '#60a5fa';
      durationBadgeBg = 'rgba(96, 165, 250, 0.15)';
    }

    // Sort events chronological
    events.sort((a, b) => a.timestamp - b.timestamp);
    const lastEvent = events[events.length - 1];

    return {
      cardKey,
      repairId: item.id || '',
      sapNo: item.sapNo,
      serialNo: item.serialNo || '-',
      description: item.description || 'Elektronik Kart',
      dispatchNo: cleanDispatchNo,
      dispatchDate,
      dispatchTimestamp: dispatchTs,
      targetWarehouseName: targetWhName,
      targetWarehouseId: targetWhId,
      currentStatus,
      currentLocationText,
      currentLocationDetails,
      durationBadgeText,
      durationSubText,
      durationText,
      durationBadgeColor,
      durationBadgeBg,
      lastEventDate: lastEvent?.dateFormatted || dispatchDate,
      lastEventTimestamp: lastEvent?.timestamp || dispatchTs,
      lastPersonnel: lastEvent?.personnel || formatDisplayName(item.dispatchedBy || 'Atölye Sorumlusu'),
      events,
      rawRepair: item
    };
  });

  // Sort: Newest dispatch first
  trackedCards.sort((a, b) => b.dispatchTimestamp - a.dispatchTimestamp);

  // Global state for filtering
  (window as any)._allTrackedCards = trackedCards;
  (window as any)._cardTrackingStatusFilter = (window as any)._cardTrackingStatusFilter || 'ALL';
  (window as any)._cardTrackingSiteFilter = (window as any)._cardTrackingSiteFilter || 'ALL';
  (window as any)._cardTrackingSearch = (window as any)._cardTrackingSearch || '';

  const normalizeKey = (s: string): string => {
    return (s || '').toLowerCase()
      .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
      .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
      .trim();
  };

  const getFilteredCards = (): TrackedCard[] => {
    const list: TrackedCard[] = (window as any)._allTrackedCards || [];
    const statusF: string = (window as any)._cardTrackingStatusFilter || 'ALL';
    const siteF: string = (window as any)._cardTrackingSiteFilter || 'ALL';
    const query: string = normalizeKey((window as any)._cardTrackingSearch || '');

    return list.filter(card => {
      // 1. Status Filter
      if (statusF !== 'ALL' && card.currentStatus !== statusF) {
        return false;
      }

      // 2. Site Filter
      if (siteF !== 'ALL') {
        const matchesSite = card.targetWarehouseId === siteF ||
                            card.targetWarehouseName === siteF ||
                            card.events.some(e => e.siteName === siteF || e.warehouseName === siteF) ||
                            normalizeKey(card.currentLocationText).includes(normalizeKey(siteF));
        if (!matchesSite) return false;
      }

      // 3. Search Query Filter
      if (query) {
        const s = normalizeKey(card.serialNo);
        const sap = normalizeKey(card.sapNo);
        const desc = normalizeKey(card.description);
        const dNo = normalizeKey(card.dispatchNo);
        const loc = normalizeKey(card.currentLocationText + ' ' + card.currentLocationDetails);
        const eventsMatch = card.events.some(e => {
          return normalizeKey(e.siteName || '').includes(query) ||
                 normalizeKey(e.turbineNo || '').includes(query) ||
                 normalizeKey(e.reportNo || '').includes(query) ||
                 normalizeKey(e.dispatchNo || '').includes(query) ||
                 normalizeKey(e.personnel || '').includes(query);
        });

        if (!s.includes(query) && !sap.includes(query) && !desc.includes(query) && !dNo.includes(query) && !loc.includes(query) && !eventsMatch) {
          return false;
        }
      }

      return true;
    });
  };

  // KPI Calculations
  const totalCount = trackedCards.length;
  const installedCount = trackedCards.filter(c => c.currentStatus === 'INSTALLED').length;
  const warehouseCount = trackedCards.filter(c => c.currentStatus === 'WAREHOUSE').length;
  const inTransitCount = trackedCards.filter(c => c.currentStatus === 'IN_TRANSIT').length;
  const dismantledCount = trackedCards.filter(c => c.currentStatus === 'DISMANTLED').length;

  const renderStatusBadge = (card: TrackedCard) => {
    switch (card.currentStatus) {
      case 'INSTALLED':
        return `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.2) 0%, rgba(59, 130, 246, 0.2) 100%); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.5); padding: 4px 9px; border-radius: 6px; font-weight: 900; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 0 10px rgba(20,241,149,0.25); width: fit-content;">
              <i class="fa-solid fa-bolt" style="color: #00f3ff;"></i> TÜRBİNDE AKTİF ÇALIŞIYOR
            </span>
            <span style="font-weight: 800; color: #FFF; font-size: 0.88rem; margin-top: 2px;">
              <i class="fa-solid fa-wind" style="color: #14F195; margin-right: 4px;"></i> ${card.currentLocationText}
            </span>
            <span style="font-size: 0.72rem; color: #94A3B8;">${card.currentLocationDetails}</span>
          </div>
        `;
      case 'WAREHOUSE':
        return `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 4px 9px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; width: fit-content;">
              <i class="fa-solid fa-check-double"></i> SAHA DEPOSUNDA YEDEK
            </span>
            <span style="font-weight: 700; color: #E2E8F0; font-size: 0.85rem; margin-top: 2px;">
              <i class="fa-solid fa-warehouse" style="color: #10B981; margin-right: 4px;"></i> ${card.currentLocationText}
            </span>
            <span style="font-size: 0.72rem; color: #94A3B8;">${card.currentLocationDetails}</span>
          </div>
        `;
      case 'IN_TRANSIT':
        return `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="background: rgba(96, 165, 250, 0.15); color: #60a5fa; border: 1px solid rgba(96, 165, 250, 0.4); padding: 4px 9px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; width: fit-content;">
              <i class="fa-solid fa-truck-fast"></i> SEVK EDİLDİ / YOLDA
            </span>
            <span style="font-weight: 700; color: #93c5fd; font-size: 0.85rem; margin-top: 2px;">
              ${card.currentLocationText}
            </span>
            <span style="font-size: 0.72rem; color: #94A3B8;">${card.currentLocationDetails}</span>
          </div>
        `;
      case 'DISMANTLED':
        return `
          <div style="display: flex; flex-direction: column; gap: 3px;">
            <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 4px 9px; border-radius: 6px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; width: fit-content;">
              <i class="fa-solid fa-arrow-down-from-bracket"></i> TÜRBİNDEN SÖKÜLDÜ
            </span>
            <span style="font-weight: 700; color: #fca5a5; font-size: 0.85rem; margin-top: 2px;">
              ${card.currentLocationText}
            </span>
            <span style="font-size: 0.72rem; color: #94A3B8;">${card.currentLocationDetails}</span>
          </div>
        `;
      default:
        return `<span style="color: #94A3B8;">-</span>`;
    }
  };

  const renderTableRows = (cards: TrackedCard[]) => {
    if (cards.length === 0) {
      return `
        <tr>
          <td colspan="7" style="text-align: center; padding: 3.5rem 1.5rem; color: #94A3B8;">
            <i class="fa-solid fa-truck-fast" style="font-size: 2.2rem; display: block; margin-bottom: 0.75rem; opacity: 0.3; color: #00f3ff;"></i>
            <div style="font-weight: 700; font-size: 0.95rem; color: #CBD5E1;">Aramanıza Uygun Sevk Edilmiş Kart Bulunamadı</div>
            <div style="font-size: 0.8rem; color: #64748B; margin-top: 4px;">Bu sayfada yalnızca MTA Atölyesi'nden sevk edilmiş olan kartlar listelenir.</div>
          </td>
        </tr>
      `;
    }

    return cards.map((c, idx) => {
      return `
        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.03)'" onmouseout="this.style.background='transparent'">
          <!-- # -->
          <td style="padding: 0.85rem 0.65rem; text-align: center; color: #64748B; font-weight: bold; vertical-align: middle; width: 40px; box-sizing: border-box;">
            ${idx + 1}
          </td>

          <!-- SERİ NO & SAP -->
          <td style="padding: 0.85rem 0.65rem; vertical-align: middle; white-space: nowrap; width: 145px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; flex-direction: column; gap: 3px;">
              <div style="font-family: monospace; font-weight: 900; font-size: 0.95rem; color: #10B981; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-microchip" style="font-size: 0.85rem; color: #10B981;"></i>
                <span>${c.serialNo}</span>
              </div>
              <div style="font-family: monospace; font-size: 0.75rem; color: #00f3ff; display: flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-barcode" style="font-size: 0.7rem;"></i> SAP: ${c.sapNo}
              </div>
            </div>
          </td>

          <!-- MALZEME TANIMI -->
          <td style="padding: 0.85rem 0.75rem; vertical-align: middle; width: 230px; box-sizing: border-box; overflow: hidden;">
            <div style="color: #F8FAFC; font-weight: 700; font-size: 0.86rem; line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${c.description}">
              ${c.description}
            </div>
          </td>

          <!-- SEVK BİLGİSİ (FORM NO & SANTRAL) -->
          <td style="padding: 0.85rem 0.65rem; vertical-align: middle; white-space: nowrap; width: 170px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; flex-direction: column; gap: 2px;">
              <span style="font-family: monospace; font-weight: 800; font-size: 0.84rem; color: #60a5fa; display: flex; align-items: center; gap: 5px;">
                <i class="fa-solid fa-file-invoice"></i> Sevk Formu #${c.dispatchNo}
              </span>
              <div style="font-size: 0.78rem; color: #F1F5F9; font-weight: 600; overflow: hidden; text-overflow: ellipsis;">
                <i class="fa-solid fa-charging-station" style="color: #fb923c; margin-right: 4px;"></i> ${c.targetWarehouseName}
              </div>
              <div style="font-size: 0.7rem; color: #64748B;">
                <i class="fa-regular fa-calendar-check" style="margin-right: 3px;"></i> ${c.dispatchDate}
              </div>
            </div>
          </td>

          <!-- GÜNCEL DURUM & LOKASYON -->
          <td style="padding: 0.85rem 0.75rem; vertical-align: middle; width: 220px; box-sizing: border-box; overflow: hidden;">
            ${renderStatusBadge(c)}
          </td>

          <!-- ÇALIŞMA / DAYANIM SÜRESİ -->
          <td style="padding: 0.85rem 0.65rem; vertical-align: middle; width: 180px; box-sizing: border-box; overflow: hidden;">
            <div style="display: flex; flex-direction: column; gap: 4px; align-items: flex-start;">
              <span style="background: ${c.durationBadgeBg}; color: ${c.durationBadgeColor}; border: 1px solid ${c.durationBadgeColor}40; border-radius: 6px; padding: 4px 8px; font-weight: 800; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 5px; max-width: 100%; box-sizing: border-box; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                <i class="fa-regular fa-hourglass-half" style="font-size: 0.75rem; flex-shrink: 0;"></i>
                <span style="overflow: hidden; text-overflow: ellipsis;">${c.durationBadgeText}</span>
              </span>
              <span style="font-size: 0.7rem; color: #64748B; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%;">
                ${c.durationSubText}
              </span>
            </div>
          </td>

          <!-- İŞLEM: ZAMAN ÇİZELGESİ MODAL -->
          <td style="padding: 0.85rem 0.65rem; vertical-align: middle; text-align: center; white-space: nowrap; width: 110px; box-sizing: border-box;">
            <button 
              type="button" 
              onclick="window.openCardJourneyModal('${c.cardKey}')" 
              style="background: linear-gradient(135deg, rgba(0, 243, 255, 0.15) 0%, rgba(59, 130, 246, 0.15) 100%); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.4); padding: 5px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; transition: all 0.2s;" 
              onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 4px 12px rgba(0,243,255,0.25)'" 
              onmouseout="this.style.transform='none'; this.style.boxShadow='none'"
              title="Kartın Söküm, Onarım, Sevk ve Türbin Çalışma Sürelerini Gör"
            >
              <i class="fa-solid fa-timeline"></i> Pasaport
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Window Handlers
  (window as any).setCardTrackingStatusTab = (status: string) => {
    (window as any)._cardTrackingStatusFilter = status;
    const tabs = document.querySelectorAll('.card-tracking-tab-btn');
    tabs.forEach((tab: any) => {
      if (tab.getAttribute('data-status') === status) {
        tab.style.background = 'rgba(0, 243, 255, 0.2)';
        tab.style.borderColor = '#00f3ff';
        tab.style.color = '#00f3ff';
      } else {
        tab.style.background = 'rgba(255, 255, 255, 0.04)';
        tab.style.borderColor = 'rgba(255, 255, 255, 0.1)';
        tab.style.color = '#94A3B8';
      }
    });
    const tbody = document.getElementById('card-tracking-tbody');
    if (tbody) {
      tbody.innerHTML = renderTableRows(getFilteredCards());
    }
  };

  (window as any).filterCardTrackingSearch = (query: string) => {
    (window as any)._cardTrackingSearch = query;
    const tbody = document.getElementById('card-tracking-tbody');
    if (tbody) {
      tbody.innerHTML = renderTableRows(getFilteredCards());
    }
  };

  (window as any).setCardTrackingSite = (siteId: string) => {
    (window as any)._cardTrackingSiteFilter = siteId;
    const tbody = document.getElementById('card-tracking-tbody');
    if (tbody) {
      tbody.innerHTML = renderTableRows(getFilteredCards());
    }
  };

  (window as any).exportCardTrackingExcel = () => {
    const list = getFilteredCards();
    if (list.length === 0) {
      alert("Dışa aktarılacak kart bulunamadı.");
      return;
    }

    const rows = list.map(c => ({
      "Seri No": c.serialNo,
      "SAP No": c.sapNo,
      "Malzeme Tanımı": c.description,
      "Sevk Form No": c.dispatchNo,
      "Sevk Tarihi": c.dispatchDate,
      "Hedef Santral": c.targetWarehouseName,
      "Güncel Durum": c.currentStatus,
      "Güncel Konum": c.currentLocationText,
      "Çalışma / Dayanım Süresi": c.durationText,
      "Son Hareket Tarihi": c.lastEventDate,
      "Son İşlem Yapan": c.lastPersonnel
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sevk_Kart_Takip");
    XLSX.writeFile(wb, `Sevk_Edilen_Kart_Takip_Raporu_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Card Journey / Passport Modal
  (window as any).openCardJourneyModal = (cardKey: string) => {
    const card = (window as any)._allTrackedCards.find((c: TrackedCard) => c.cardKey === cardKey);
    if (!card) {
      alert("Kart detayları bulunamadı.");
      return;
    }

    document.getElementById('card-journey-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'card-journey-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0, 8, 20, 0.88); backdrop-filter: blur(12px); 
      z-index: 10010; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;
    `;

    const timelineEvents = [...card.events].reverse();

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 820px; max-height: 92vh; overflow-y: auto; padding: 2rem; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.35); box-shadow: 0 25px 50px rgba(0,0,0,0.85); background: #0A0E17;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(0, 243, 255, 0.15); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.35); padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase;">
                DİJİTAL KART PASAPORTU
              </span>
              <span style="color: #64748B; font-size: 0.75rem;">•</span>
              <span style="color: #94A3B8; font-size: 0.78rem;">Sevk Sonrası Saha & Türbin Yaşam Döngüsü</span>
            </div>
            <h3 style="margin: 6px 0 0 0; font-family: 'Rajdhani', sans-serif; font-size: 1.6rem; color: #FFF; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-microchip" style="color: #10B981;"></i>
              <span>${card.serialNo}</span>
              <span style="font-size: 0.95rem; color: #00f3ff; font-family: monospace; font-weight: normal; background: rgba(0, 243, 255, 0.1); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(0, 243, 255, 0.2);">SAP: ${card.sapNo}</span>
            </h3>
            <div style="color: #CBD5E1; font-weight: 600; font-size: 0.9rem; margin-top: 4px;">
              ${card.description}
            </div>
          </div>
          <button onclick="document.getElementById('card-journey-modal')?.remove()" style="background: transparent; border: none; color: #94A3B8; font-size: 1.4rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Current Status & Lifespan Highlight Box -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="font-size: 0.72rem; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">GÜNCEL DURUM VE LOKASYON</span>
              <div style="margin-top: 4px;">
                ${renderStatusBadge(card)}
              </div>
            </div>

            <!-- Lifespan Indicator -->
            <div style="border-left: 1px solid rgba(255,255,255,0.08); padding-left: 1.5rem;">
              <span style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase; font-weight: 700;">Çalışma / Dayanım Süresi</span>
              <div style="margin-top: 4px;">
                <span style="background: ${card.durationBadgeBg}; color: ${card.durationBadgeColor}; border: 1px solid ${card.durationBadgeColor}50; padding: 6px 12px; border-radius: 8px; font-weight: 900; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-hourglass-half"></i> ${card.durationText}
                </span>
              </div>
            </div>
          </div>
        </div>

        <!-- Timeline Section -->
        <h4 style="color: #00f3ff; font-size: 0.95rem; font-weight: 800; text-transform: uppercase; margin-bottom: 1.25rem; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-timeline"></i> ZAMAN ÇİZELGESİ (KRONOLOJİK SÜREÇ)
        </h4>

        <div style="position: relative; padding-left: 2rem; border-left: 2px solid rgba(0, 243, 255, 0.25); margin-left: 1rem; display: flex; flex-direction: column; gap: 1.5rem;">
          ${timelineEvents.map((ev) => {
            return `
              <div style="position: relative;">
                <!-- Glowing Node Circle -->
                <div style="position: absolute; left: -2.6rem; top: 0.1rem; width: 22px; height: 22px; border-radius: 50%; background: #0A0E17; border: 2px solid ${ev.badgeColor}; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px ${ev.badgeColor};">
                  <div style="width: 8px; height: 8px; border-radius: 50%; background: ${ev.badgeColor};"></div>
                </div>

                <!-- Timeline Item Card -->
                <div style="background: rgba(255, 255, 255, 0.025); border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 10px; padding: 1rem 1.25rem; transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.025)'">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div>
                      <span style="background: ${ev.badgeBg}; color: ${ev.badgeColor}; border: 1px solid ${ev.badgeColor}40; padding: 3px 8px; border-radius: 5px; font-size: 0.72rem; font-weight: 800; display: inline-flex; align-items: center; gap: 5px;">
                        <i class="fa-solid ${ev.icon}"></i> ${ev.badgeText}
                      </span>
                      <span style="color: #FFF; font-weight: 800; font-size: 0.95rem; margin-left: 8px;">
                        ${ev.title}
                      </span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px; font-size: 0.75rem; color: #94A3B8;">
                      <span><i class="fa-regular fa-clock" style="margin-right: 4px; color: #00f3ff;"></i>${ev.dateFormatted}</span>
                      ${ev.reportNo ? `<span style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; font-family: monospace; color: #E2E8F0;">Rapor #${ev.reportNo}</span>` : ''}
                      ${ev.dispatchNo ? `<span style="background: rgba(96,165,250,0.15); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 700;">Sevk #${ev.dispatchNo}</span>` : ''}
                    </div>
                  </div>

                  ${ev.durationNote ? `
                    <div style="margin: 6px 0; background: rgba(20, 241, 149, 0.08); border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 6px; padding: 6px 10px; font-size: 0.8rem; font-weight: 700; color: #14F195; display: flex; align-items: center; gap: 6px;">
                      <i class="fa-solid fa-stopwatch"></i> ${ev.durationNote}
                    </div>
                  ` : ''}

                  ${ev.notes ? `
                    <div style="color: #CBD5E1; font-size: 0.84rem; line-height: 1.4; margin-top: 6px; background: rgba(0,0,0,0.25); padding: 8px 12px; border-radius: 6px; border-left: 3px solid ${ev.badgeColor};">
                      ${ev.notes}
                    </div>
                  ` : ''}

                  ${ev.components && ev.components.length > 0 ? `
                    <div style="margin-top: 8px; display: flex; flex-wrap: wrap; gap: 5px; align-items: center;">
                      <span style="font-size: 0.72rem; color: #64748B; font-weight: 700;">Değiştirilen Komponentler:</span>
                      ${ev.components.map((cmp: string) => `
                        <span style="background: rgba(0, 243, 255, 0.1); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-family: monospace;">
                          ${cmp}
                        </span>
                      `).join('')}
                    </div>
                  ` : ''}

                  ${ev.imageUrl ? `
                    <div style="margin-top: 8px;">
                      <img src="${ev.imageUrl}" style="max-height: 80px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" onclick="window.open('${ev.imageUrl}', '_blank')" title="Büyütmek için tıklayın" />
                    </div>
                  ` : ''}

                  <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 0.74rem; color: #64748B;">
                    <span>İşlem Yapan: <strong style="color: #94A3B8;">${ev.personnel || '-'}</strong></span>
                    ${ev.siteName ? `<span>Lokasyon: <strong style="color: #94A3B8;">${ev.siteName}</strong></span>` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div style="text-align: right; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
          <button 
            type="button" 
            onclick="document.getElementById('card-journey-modal')?.remove()" 
            style="background: rgba(255,255,255,0.08); color: #FFF; border: 1px solid rgba(255,255,255,0.15); padding: 6px 18px; border-radius: 6px; font-weight: 700; font-size: 0.85rem; cursor: pointer;"
          >
            Kapat
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  const initialCards = getFilteredCards();

  // Extract site list for dropdown
  const uniqueSites = Array.from(new Set(
    trackedCards.map(c => c.targetWarehouseName).filter(s => s && s !== '-')
  )).sort() as string[];

  return `
    <div class="fade-in-up content-area">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #00f3ff; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800; display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-bolt" style="color: #00f3ff;"></i> SEVK EDİLEN KART & TÜRBİN TAKİBİ
            </h2>
            <span style="background: rgba(0, 243, 255, 0.15); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.35); padding: 3px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 800;">
              CANLI SAHA & TÜRBİN TAKİBİ
            </span>
          </div>
          <p style="color: #94A3B8; margin: 4px 0 0 0; font-size: 0.85rem;">
            MTA Atölyesi'nden sevk edilen kartların depo yedek durumu, türbine montajı ve türbindeki kesintisiz çalışma gün sayısı takibi
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <!-- Excel Export -->
          <button 
            type="button"
            onclick="window.exportCardTrackingExcel()"
            style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 7px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;"
            onmouseover="this.style.background='rgba(16, 185, 129, 0.25)'"
            onmouseout="this.style.background='rgba(16, 185, 129, 0.15)'"
            title="Sevk Edilen Kartlar Listesini Excel Tablosu Olarak İndir"
          >
            <i class="fa-solid fa-file-excel"></i> EXCEL DIŞA AKTAR
          </button>

          <!-- Refresh -->
          <button 
            type="button"
            onclick="window.navigate('card-tracking')"
            style="background: rgba(255, 255, 255, 0.05); color: #CBD5E1; border: 1px solid rgba(255, 255, 255, 0.15); padding: 7px 14px; border-radius: 8px; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;"
            onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'"
            onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'"
            title="Listeyi Yenile"
          >
            <i class="fa-solid fa-rotate"></i> Yenile
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards (Purely Dispatched-Focused) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- Total Dispatched Cards -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(15, 23, 42, 0.6); position: relative; overflow: hidden;">
          <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 700; text-transform: uppercase;">Toplam Sevk Edilen Kart</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; font-family: monospace; margin-top: 4px;">
            ${totalCount}
          </div>
          <div style="font-size: 0.72rem; color: #64748B; margin-top: 2px;">MTA çıkışı yapılmış elektronik kartlar</div>
          <i class="fa-solid fa-truck-ramp-box" style="position: absolute; right: 1rem; bottom: 1rem; font-size: 2.2rem; color: rgba(255,255,255,0.04);"></i>
        </div>

        <!-- In Turbine -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(20, 241, 149, 0.35); background: rgba(20, 241, 149, 0.05); position: relative; overflow: hidden; box-shadow: 0 0 15px rgba(20,241,149,0.08);">
          <div style="font-size: 0.75rem; color: #14F195; font-weight: 800; text-transform: uppercase;">Türbinde Takılı & Aktif</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #14F195; font-family: monospace; margin-top: 4px;">
            ${installedCount}
          </div>
          <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Sahada türbin içinde çalışanlar</div>
          <i class="fa-solid fa-bolt" style="position: absolute; right: 1rem; bottom: 1rem; font-size: 2.2rem; color: rgba(20, 241, 149, 0.12);"></i>
        </div>

        <!-- In Warehouse (Yedek) -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.05); position: relative; overflow: hidden;">
          <div style="font-size: 0.75rem; color: #10B981; font-weight: 800; text-transform: uppercase;">Saha Deposunda Yedek</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #10B981; font-family: monospace; margin-top: 4px;">
            ${warehouseCount}
          </div>
          <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Montaja hazır rafta bekleyenler</div>
          <i class="fa-solid fa-warehouse" style="position: absolute; right: 1rem; bottom: 1rem; font-size: 2.2rem; color: rgba(16, 185, 129, 0.1);"></i>
        </div>

        <!-- In Transit -->
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(96, 165, 250, 0.3); background: rgba(96, 165, 250, 0.05); position: relative; overflow: hidden;">
          <div style="font-size: 0.75rem; color: #60a5fa; font-weight: 800; text-transform: uppercase;">Sevk Edildi / Yolda</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #60a5fa; font-family: monospace; margin-top: 4px;">
            ${inTransitCount}
          </div>
          <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Saha kabulü bekleyen transferler</div>
          <i class="fa-solid fa-truck-fast" style="position: absolute; right: 1rem; bottom: 1rem; font-size: 2.2rem; color: rgba(96, 165, 250, 0.1);"></i>
        </div>

        <!-- Dismantled -->
        ${dismantledCount > 0 ? `
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); position: relative; overflow: hidden;">
            <div style="font-size: 0.75rem; color: #f87171; font-weight: 800; text-transform: uppercase;">Türbinden Tekrar Sökülen</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #f87171; font-family: monospace; margin-top: 4px;">
              ${dismantledCount}
            </div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Arıza veya revizyonla sökülen</div>
            <i class="fa-solid fa-arrow-down-from-bracket" style="position: absolute; right: 1rem; bottom: 1rem; font-size: 2.2rem; color: rgba(239, 68, 68, 0.1);"></i>
          </div>
        ` : ''}

      </div>

      <!-- Controls & Filter Bar -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255, 255, 255, 0.08);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          
          <!-- Search Input -->
          <div style="flex: 1; min-width: 280px; position: relative;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.9rem;"></i>
            <input 
              type="text" 
              id="card-tracking-search-input"
              value="${(window as any)._cardTrackingSearch || ''}"
              oninput="window.filterCardTrackingSearch(this.value)" 
              placeholder="Kart seri no (örn: 10-11016), SAP no, sevk form no (örn: 61), santral veya türbin ara..." 
              style="width: 100%; box-sizing: border-box; background: rgba(10, 14, 23, 0.8); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 8px; padding: 0.65rem 1rem 0.65rem 2.5rem; color: #FFF; font-size: 0.85rem; outline: none; transition: border-color 0.2s;"
              onfocus="this.style.borderColor='#00f3ff'"
              onblur="this.style.borderColor='rgba(0, 243, 255, 0.25)'"
            />
          </div>

          <!-- Site Dropdown Filter -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <label style="font-size: 0.78rem; color: #94A3B8; font-weight: 700; white-space: nowrap;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c; margin-right: 4px;"></i> Hedef Santral:
            </label>
            <select 
              onchange="window.setCardTrackingSite(this.value)" 
              style="background: rgba(10, 14, 23, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); color: #FFF; padding: 0.55rem 0.85rem; border-radius: 8px; font-size: 0.82rem; outline: none; cursor: pointer;"
            >
              <option value="ALL" ${(window as any)._cardTrackingSiteFilter === 'ALL' ? 'selected' : ''}>Tüm Sevk Sahaları & Depolar</option>
              ${uniqueSites.map(s => `
                <option value="${s}" ${(window as any)._cardTrackingSiteFilter === s ? 'selected' : ''}>${s}</option>
              `).join('')}
            </select>
          </div>

        </div>

        <!-- Status Filter Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-top: 1rem; flex-wrap: wrap; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.85rem;">
          <button 
            type="button" 
            class="card-tracking-tab-btn"
            data-status="ALL"
            onclick="window.setCardTrackingStatusTab('ALL')" 
            style="background: ${(window as any)._cardTrackingStatusFilter === 'ALL' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${(window as any)._cardTrackingStatusFilter === 'ALL' ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)'}; color: ${(window as any)._cardTrackingStatusFilter === 'ALL' ? '#00f3ff' : '#94A3B8'}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer;"
          >
            TÜM SEVK EDİLENLER (${totalCount})
          </button>
          <button 
            type="button" 
            class="card-tracking-tab-btn"
            data-status="INSTALLED"
            onclick="window.setCardTrackingStatusTab('INSTALLED')" 
            style="background: ${(window as any)._cardTrackingStatusFilter === 'INSTALLED' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${(window as any)._cardTrackingStatusFilter === 'INSTALLED' ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)'}; color: ${(window as any)._cardTrackingStatusFilter === 'INSTALLED' ? '#00f3ff' : '#94A3B8'}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer;"
          >
            <i class="fa-solid fa-bolt" style="color: #14F195; margin-right: 4px;"></i> Türbinde Takılı (${installedCount})
          </button>
          <button 
            type="button" 
            class="card-tracking-tab-btn"
            data-status="WAREHOUSE"
            onclick="window.setCardTrackingStatusTab('WAREHOUSE')" 
            style="background: ${(window as any)._cardTrackingStatusFilter === 'WAREHOUSE' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${(window as any)._cardTrackingStatusFilter === 'WAREHOUSE' ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)'}; color: ${(window as any)._cardTrackingStatusFilter === 'WAREHOUSE' ? '#00f3ff' : '#94A3B8'}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer;"
          >
            <i class="fa-solid fa-check-double" style="color: #10B981; margin-right: 4px;"></i> Saha Deposunda Yedek (${warehouseCount})
          </button>
          <button 
            type="button" 
            class="card-tracking-tab-btn"
            data-status="IN_TRANSIT"
            onclick="window.setCardTrackingStatusTab('IN_TRANSIT')" 
            style="background: ${(window as any)._cardTrackingStatusFilter === 'IN_TRANSIT' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${(window as any)._cardTrackingStatusFilter === 'IN_TRANSIT' ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)'}; color: ${(window as any)._cardTrackingStatusFilter === 'IN_TRANSIT' ? '#00f3ff' : '#94A3B8'}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer;"
          >
            <i class="fa-solid fa-truck-fast" style="color: #60a5fa; margin-right: 4px;"></i> Sevk Edildi / Yolda (${inTransitCount})
          </button>
          ${dismantledCount > 0 ? `
            <button 
              type="button" 
              class="card-tracking-tab-btn"
              data-status="DISMANTLED"
              onclick="window.setCardTrackingStatusTab('DISMANTLED')" 
              style="background: ${(window as any)._cardTrackingStatusFilter === 'DISMANTLED' ? 'rgba(0, 243, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)'}; border: 1px solid ${(window as any)._cardTrackingStatusFilter === 'DISMANTLED' ? '#00f3ff' : 'rgba(255, 255, 255, 0.1)'}; color: ${(window as any)._cardTrackingStatusFilter === 'DISMANTLED' ? '#00f3ff' : '#94A3B8'}; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; cursor: pointer;"
            >
              <i class="fa-solid fa-arrow-down-from-bracket" style="color: #f87171; margin-right: 4px;"></i> Sökülenler (${dismantledCount})
            </button>
          ` : ''}
        </div>

      </div>

      <!-- Main Data Table -->
      <div class="glass-panel" style="border-radius: 12px; overflow: hidden; background: #0B111E; border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 4px 20px rgba(0,0,0,0.4);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; min-width: 1095px; table-layout: fixed; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
            <thead>
              <tr style="background: rgba(255, 255, 255, 0.03); border-bottom: 1px solid rgba(255, 255, 255, 0.08); color: #64748B; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px;">
                <th style="padding: 0.85rem 0.65rem; text-align: center; width: 40px; box-sizing: border-box;">#</th>
                <th style="padding: 0.85rem 0.65rem; width: 145px; box-sizing: border-box;">SERİ NO & SAP</th>
                <th style="padding: 0.85rem 0.75rem; width: 230px; box-sizing: border-box;">KART / PARÇA TANIMI</th>
                <th style="padding: 0.85rem 0.65rem; width: 170px; box-sizing: border-box;">SEVK FORMU & SANTRAL</th>
                <th style="padding: 0.85rem 0.75rem; width: 220px; box-sizing: border-box;">GÜNCEL DURUM & KONUM</th>
                <th style="padding: 0.85rem 0.65rem; width: 180px; box-sizing: border-box;">SÜRE / DAYANIM</th>
                <th style="padding: 0.85rem 0.65rem; text-align: center; width: 110px; box-sizing: border-box;">PASAPORT</th>
              </tr>
            </thead>
            <tbody id="card-tracking-tbody">
              ${renderTableRows(initialCards)}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
