import { repairService } from '../services/RepairService';
import type { RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';

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
  return String(val)
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

export const RepairHistoryPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Sistem';

  // Get active tab and filters from window state
  (window as any)._repairHistoryTab = (window as any)._repairHistoryTab || 'all';
  (window as any)._repairHistorySite = (window as any)._repairHistorySite || 'all';
  (window as any)._repairHistorySearch = (window as any)._repairHistorySearch || '';
  (window as any)._repairHistoryPage = (window as any)._repairHistoryPage || 1;
  const PAGE_SIZE = 50;

  const currentTab = (window as any)._repairHistoryTab;
  const selectedSite = (window as any)._repairHistorySite;
  const searchQuery = (window as any)._repairHistorySearch;

  // Fetch all repair records
  const repairs = await repairService.getRepairs(true);
  const warehouses = dataService.getWarehouses();

  (window as any)._allRepairs = repairs;

  // Pre-calculate card history maps and turbine usage from service reports for O(1) lookups
  const cardMap = new Map<string, RepairRecord[]>();
  repairs.forEach(r => {
    if (r.serialNo && r.serialNo !== '-' && r.serialNo.trim() !== '') {
      const key = `${(r.sapNo || '').trim()}___${r.serialNo.trim().toLowerCase()}`;
      if (!cardMap.has(key)) cardMap.set(key, []);
      cardMap.get(key)!.push(r);
    }
  });

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
          if (matSerial && matSerial !== '-') {
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
    console.error("Error loading service reports for repair history:", err);
  }

  // Global handlers
  (window as any).setRepairHistoryTab = (tab: string) => {
    (window as any)._repairHistoryTab = tab;
    (window as any)._repairHistoryPage = 1;
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any).setRepairHistorySite = (siteId: string) => {
    (window as any)._repairHistorySite = siteId;
    (window as any)._repairHistoryPage = 1;
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any).setRepairHistoryPage = (page: number) => {
    (window as any)._repairHistoryPage = page;
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any).filterRepairHistory = (query: string) => {
    (window as any)._repairHistorySearch = query;
    (window as any)._repairHistoryPage = 1;
    const tbody = document.getElementById('repair-history-tbody');
    const paginationContainer = document.getElementById('repair-history-pagination');
    const filtered = getFilteredRepairs();
    const paged = filtered.slice(0, PAGE_SIZE);
    if (tbody) {
      tbody.innerHTML = renderRows(paged);
    }
    if (paginationContainer) {
      paginationContainer.innerHTML = renderPagination(filtered.length, 1);
    }
  };

  // Global handler to delete a repair record (admin only)
  (window as any).deleteRepairRecord = async (repairId: string) => {
    const user = (window as any).currentUser;
    const isAdmin = user?.email?.toLowerCase().includes('admin') || user?.email === 'fatih.zebek@demirerholding.com';
    if (!isAdmin) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    
    if (!confirm('Bu tamir kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    
    try {
      (window as any).showToast?.('İşlem', 'Tamir kaydı siliniyor...', 'info');
      await repairService.deleteRepair(repairId);
      (window as any).showToast?.('Başarılı', 'Tamir kaydı başarıyla silindi.', 'success');
      
      if ((window as any).navigate) {
         (window as any).navigate('repair-history');
      }
    } catch (e) {
      console.error(e);
      alert('Kayıt silinirken bir hata oluştu.');
    }
  };

  // Global handler to open Process Timeline Modal (Full Lifecycle Tracking)
  (window as any).openRepairTimelineModal = async (repairId: string) => {
    const allRepairs: RepairRecord[] = (window as any)._allRepairs || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;

    const modal = document.createElement('div');
    modal.id = 'repair-timeline-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
      padding: 1rem; box-sizing: border-box;
    `;

    // Fetch same-serial repairs (sorted newest first) to check repeating arrivals
    const cleanSerial = rep.serialNo ? rep.serialNo.trim().toLowerCase() : '';
    const cleanSap = (rep.sapNo || '').trim();
    const key = `${cleanSap}___${cleanSerial}`;
    const sameSerialRepairs = (cleanSerial && cleanSerial !== '-')
      ? (cardMap.get(key) || []).slice().sort((a, b) => {
          const dateA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt || 0).getTime();
          const dateB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt || 0).getTime();
          return dateB - dateA;
        })
      : [];
    const totalArrivals = sameSerialRepairs.length || 1;

    // Fetch service reports to track turbine installation & disassembly history
    let installedReports: any[] = [];
    let removedReports: any[] = [];

    if (cleanSerial && cleanSerial !== '-') {
      try {
        const allReports = await serviceReportService.getAllReports();
        allReports.forEach(report => {
          if (!report.materials) return;
          report.materials.forEach((mat: any) => {
            const matSap = String(mat.sapNo || '').trim();
            const matSerial = String(mat.serialNo || '').trim().toLowerCase();
            
            const isSapMatch = matSap === cleanSap || matSap === ('R' + cleanSap) || ('R' + matSap) === cleanSap;
            const isSerialMatch = matSerial === cleanSerial;
            
            if (isSapMatch && isSerialMatch) {
              if ((mat.used || 0) > 0) {
                installedReports.push({ report, mat });
              }
              if ((mat.removed || 0) > 0) {
                removedReports.push({ report, mat });
              }
            }
          });
        });
      } catch (err) {
        console.error("Error finding card usage in reports:", err);
      }
    }

    const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Bilinmeyen Saha';
    const targetWh = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : (rep.transferSite || '-');

    const steps: Array<{
      title: string;
      time: any;
      user?: string;
      detail: string;
      image?: string;
      done: boolean;
      badgeColor?: string;
    }> = [
      {
        title: '1. Santralden Söküldü ve Atölyeye Sevk Edildi',
        time: rep.sentAt,
        user: rep.sentBy,
        detail: `Kaynak Depo / Saha: ${sourceWh} ${rep.faultCode ? `| Arıza Kodu: ${rep.faultCode}` : ''}`,
        done: !!rep.sentAt,
        badgeColor: '#fb923c'
      },
      {
        title: '2. Atölyeye Ulaştı (Kabul Edildi)',
        time: rep.receivedAt,
        user: rep.receivedBy,
        detail: `Malzeme fiziksel olarak atölye envanterine kabul edildi. Raf: ${rep.shelfNo || '-'}`,
        done: !!rep.receivedAt,
        badgeColor: '#60a5fa'
      },
      {
        title: '3. Onarım / Teşhis & Parça Değişimi',
        time: rep.repairedAt,
        user: rep.repairedBy || rep.assignedTo,
        detail: rep.repairNotes ? `Onarım Notu: "${rep.repairNotes}"` : (rep.assignedTo ? `Teknisyen masasında onarımda (${rep.assignedTo})` : 'Onarım aşamasında'),
        image: rep.repairImageUrl,
        done: !!rep.repairedAt || rep.status === 'UNDER_REPAIR',
        badgeColor: '#38bdf8'
      },
      {
        title: '4. Revize Sağlam & Sahaya Sevk Edildi',
        time: rep.dispatchedAt,
        user: rep.dispatchedBy,
        detail: `Hedef Depo: ${targetWh} ${rep.dispatchNo || rep.mctNo ? `| Sevk No / İrsaliye: ${rep.dispatchNo || rep.mctNo}` : ''}`,
        done: !!rep.dispatchedAt || rep.status === 'SENT_BACK',
        badgeColor: '#14F195'
      },
      {
        title: '5. Depo Tarafından Teslim Alındı (Hazır Stok)',
        time: rep.completedAt,
        user: 'Malzeme Yönetimi',
        detail: `Parça revize koduyla ${targetWh} stoklarına kabul edildi.`,
        done: !!rep.completedAt || rep.status === 'COMPLETED',
        badgeColor: '#10B981'
      }
    ];

    // Add turbine installation history from Service Reports
    installedReports.forEach(item => {
      const repObj = item.report;
      const turbineStr = `${repObj.siteName || ''} Türbin: ${repObj.turbineNo || '-'}`;
      steps.push({
        title: '⚡ 6. Türbinde Yeniden Kullanıldı (Montaj)',
        time: repObj.date,
        user: repObj.createdBy || repObj.personnel?.[0] || 'Teknisyen',
        detail: `Takılan Santral/Türbin: ${turbineStr} | Servis Raporu: #${repObj.reportNo || repObj.id || '-'}`,
        done: true,
        badgeColor: '#a78bfa'
      });
    });

    // Add turbine removal history if found
    removedReports.forEach(item => {
      const repObj = item.report;
      const turbineStr = `${repObj.siteName || ''} Türbin: ${repObj.turbineNo || '-'}`;
      steps.push({
        title: '⚠️ 7. Türbinden Tekrar Söküldü (Yeni Arıza)',
        time: repObj.date,
        user: repObj.createdBy || repObj.personnel?.[0] || 'Teknisyen',
        detail: `Sökülen Türbin: ${turbineStr} | Arıza Nedeni: ${item.mat?.faultReason || item.mat?.notes || 'Bilinmiyor'} | Rapor: #${repObj.reportNo || repObj.id || '-'}`,
        done: true,
        badgeColor: '#EF4444'
      });
    });

    const timelineHtml = steps.map((step, idx) => {
      const color = step.done ? (step.badgeColor || '#14F195') : '#475569';
      const glow = step.done ? `box-shadow: 0 0 10px ${color};` : '';
      const borderStyle = idx === steps.length - 1 ? '' : `border-left: 2px dashed ${color};`;
      const timeStr = step.time ? formatDateTime(step.time) : '-';
      
      return `
        <div style="display: flex; gap: 1.25rem; margin-bottom: 1.25rem; position: relative; ${borderStyle} padding-left: 20px; margin-left: 10px;">
          <div style="position: absolute; left: -6px; top: 0; width: 14px; height: 14px; border-radius: 50%; background: ${color}; ${glow}"></div>
          <div style="flex-grow: 1; margin-top: -3px; background: rgba(255,255,255,0.02); border: 1px solid ${step.done ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.03)'}; padding: 0.75rem 1rem; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 6px;">
              <span style="font-weight: 800; color: ${step.done ? '#FFF' : '#64748B'}; font-size: 0.88rem;">${step.title}</span>
              <span style="font-size: 0.75rem; color: #94A3B8; font-family: monospace;">${timeStr}</span>
            </div>
            ${step.user ? `<div style="font-size: 0.75rem; color: #64748B; margin-top: 3px;">İşlem Yapan: <strong>${step.user.split('@')[0]}</strong></div>` : ''}
            ${step.detail ? `<div style="font-size: 0.8rem; color: #E2E8F0; margin-top: 5px; font-style: italic; background: rgba(0,0,0,0.3); padding: 5px 9px; border-radius: 5px; border: 1px solid rgba(255,255,255,0.05);">${step.detail}</div>` : ''}
            ${step.image ? `<div style="margin-top: 8px; text-align: left;"><img src="${step.image}" style="max-width: 100%; max-height: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); cursor: pointer;" onclick="window.open('${step.image}', '_blank')" title="Büyütmek için tıklayın" /></div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 620px; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 20px 50px rgba(0,0,0,0.7); max-height: 90vh; overflow-y: auto; background: #0B101B;">
        
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.85rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(20,241,149,0.15); border: 1px solid #14F195; display: flex; align-items: center; justify-content: center; color: #14F195;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </div>
            <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.35rem; color:#14F195; font-weight:800; letter-spacing:1px;">
              DİJİTAL KART YAŞAM DÖNGÜSÜ & ONARIM GEÇMİŞİ
            </h3>
          </div>
          <button onclick="document.getElementById('repair-timeline-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.3rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <!-- Card Details Header -->
        <div style="margin-bottom:1.25rem; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); padding:0.85rem 1rem; border-radius:10px;">
          <div style="font-weight:800; color:#FFF; font-size:0.95rem; margin-bottom: 4px;">${rep.description}</div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap; font-size: 0.78rem; color: #94A3B8;">
            <span style="background: #00f3ff; color: #0A0E17; font-weight: 900; padding: 2px 6px; border-radius: 4px; font-family: monospace;">SAP ${rep.sapNo}</span>
            <span style="background: rgba(20,241,149,0.15); color: #14F195; border: 1px solid rgba(20,241,149,0.3); font-weight: 800; padding: 2px 6px; border-radius: 4px; font-family: monospace;">Seri No: ${rep.serialNo || '-'}</span>
            <span style="color: #CBD5E1;">Miktar: <strong>${rep.quantity} Adet</strong></span>
            ${totalArrivals > 1 ? `
              <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid fa-arrows-spin"></i> TEKRARLI ARIZA (${totalArrivals}. Kez Atölyede)
              </span>
            ` : `
              <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                ✨ 1. Geliş (İlk)
              </span>
            `}
          </div>
          ${rep.faultCode && rep.faultCode !== '-' ? `
            <div style="font-size:0.78rem; color:#F59E0B; margin-top:8px; border-top:1px dashed rgba(255,255,255,0.06); padding-top:6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> <strong>İlk Sökülme Arızası:</strong> ${rep.faultCode} ${rep.faultDesc && rep.faultDesc !== '-' ? `(${rep.faultDesc})` : ''}
            </div>
          ` : ''}
        </div>
 
        <!-- Timeline Steps -->
        <div style="margin-bottom:1.5rem;">
          ${timelineHtml}
        </div>

        <!-- Previous Cycles History if multiple visits -->
        ${totalArrivals > 1 ? `
          <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-family:'Rajdhani', sans-serif; font-size: 1.05rem; color: #F59E0B; font-weight: 800; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-rotate-left"></i> GEÇMİŞ TÜM ATÖLYE ONARIM DÖNGÜLERİ (${totalArrivals} KAYIT)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 180px; overflow-y: auto; padding-right: 4px;">
              ${sameSerialRepairs.map((r, i) => {
                const isCurrent = r.id === rep.id;
                const arrivalNum = totalArrivals - i;
                const repairDate = r.sentAt ? formatDateOnly(r.sentAt) : '-';
                const compDate = r.completedAt ? formatDateOnly(r.completedAt) : (r.status === 'REPAIRED' ? 'Onarıldı' : r.status === 'SENT_BACK' ? 'Sevk Edildi' : 'İşlemde');
                return `
                  <div style="background: ${isCurrent ? 'rgba(20,241,149,0.05)' : 'rgba(255,255,255,0.02)'}; border: 1px solid ${isCurrent ? 'rgba(20,241,149,0.3)' : 'rgba(255,255,255,0.05)'}; padding: 0.65rem; border-radius: 8px; font-size: 0.78rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-weight: 800; color: ${isCurrent ? '#14F195' : '#FFF'};">
                        ${arrivalNum}. Geliş ${isCurrent ? '<span style="color:#14F195; font-weight: normal; margin-left: 4px;">(Bu Kayıt)</span>' : ''}
                      </span>
                      <span style="font-size: 0.72rem; color: #94A3B8; font-family: monospace;">Tarih: ${repairDate} &rarr; ${compDate}</span>
                    </div>
                    <div style="color: #94A3B8; font-size: 0.75rem;">
                      <strong>Arıza:</strong> <span style="color: #F59E0B;">${r.faultCode || '-'}</span> ${r.faultDesc && r.faultDesc !== '-' ? `(${r.faultDesc})` : ''}
                    </div>
                    ${r.repairNotes ? `
                      <div style="margin-top: 4px; color: #E2E8F0; font-style: italic; background: rgba(0,0,0,0.3); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
                        <strong>Onarım Notu:</strong> "${r.repairNotes}"
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid rgba(255,255,255,0.08); padding-top:1.25rem;">
          <a href="/?page=card-passport&id=${rep.id}&sap=${encodeURIComponent(rep.sapNo)}&serial=${encodeURIComponent(rep.serialNo || '')}" target="_blank" style="background: rgba(0, 243, 255, 0.12); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.3); padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.8rem; font-weight: 800; text-decoration: none; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-passport"></i> Kart Pasaportunu Yeni Sekmede Aç
          </a>
          <button onclick="document.getElementById('repair-timeline-modal').remove()" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.6rem 1.25rem; font-size:0.85rem; border:none; border-radius:8px; cursor:pointer; box-shadow:0 0 15px rgba(20,241,149,0.3);">KAPAT</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // Filter repairs (dynamically reading window state to ensure live search works instantly)
  const getFilteredRepairs = () => {
    let filtered = repairs;
    const activeSearch = ((window as any)._repairHistorySearch || '').trim();
    const activeSite = (window as any)._repairHistorySite || 'all';
    const activeTab = (window as any)._repairHistoryTab || 'all';

    // 1. Site Filter
    if (activeSite !== 'all') {
      filtered = filtered.filter(r => r.sourceWarehouseId === activeSite || r.targetWarehouseId === activeSite);
    }

    // 2. Search Filter (SAP, Serial, Description, Fault, Technician, Notes, Warehouse)
    if (activeSearch) {
      const q = normalizeKey(activeSearch);

      filtered = filtered.filter(r => {
        const sourceWh = warehouses.find(w => w.id === r.sourceWarehouseId)?.name || r.sourceWarehouseId || '';
        const targetWh = warehouses.find(w => w.id === r.targetWarehouseId)?.name || r.targetWarehouseId || '';
        const normSap = normalizeKey(r.sapNo || '');
        const normSerial = normalizeKey(r.serialNo || '');
        const normDesc = normalizeKey(r.description || '');
        const normNotes = normalizeKey(r.repairNotes || '');
        const normFault = normalizeKey(`${r.faultCode || ''} ${r.faultDesc || ''}`);
        const normTech = normalizeKey(`${r.repairedBy || ''} ${r.assignedTo || ''} ${r.sentBy || ''}`);
        const normWh = normalizeKey(`${sourceWh} ${targetWh} ${r.shelfNo || ''} ${r.dispatchNo || ''}`);

        return (
          normSap.includes(q) ||
          normSerial.includes(q) ||
          normDesc.includes(q) ||
          normNotes.includes(q) ||
          normFault.includes(q) ||
          normTech.includes(q) ||
          normWh.includes(q)
        );
      });
    }

    // 3. Tab Filter
    if (activeTab === 'waiting_stock') {
      filtered = filtered.filter(r => r.status === 'UNDER_REPAIR' && (!r.assignedTo || r.assignedTo.trim() === '' || r.assignedTo === '-') && !r.repairStage);
    } else if (activeTab === 'in_progress' || activeTab === 'active_task') {
      filtered = filtered.filter(r => r.status === 'UNDER_REPAIR' && ((!!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-') || !!r.repairStage));
    } else if (activeTab === 'repaired') {
      filtered = filtered.filter(r => r.status === 'REPAIRED');
    } else if (activeTab === 'dispatched') {
      filtered = filtered.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED');
    } else if (activeTab === 'scrapped') {
      filtered = filtered.filter(r => r.status === 'SCRAPPED');
    }

    return filtered;
  };

  const filteredRepairs = getFilteredRepairs();
  const totalFilteredCount = filteredRepairs.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, (window as any)._repairHistoryPage || 1), totalPages);
  (window as any)._repairHistoryPage = currentPage;

  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const pagedRepairs = filteredRepairs.slice(startIndex, startIndex + PAGE_SIZE);

  // Pagination UI generator
  const renderPagination = (totalCount: number, page: number) => {
    const totalP = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    const start = totalCount > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(page * PAGE_SIZE, totalCount);

    if (totalCount <= PAGE_SIZE) {
      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; color: #94A3B8; font-size: 0.8rem; font-weight: 700; background: rgba(0,0,0,0.25); border-top: 1px solid rgba(255,255,255,0.06); border-radius: 0 0 12px 12px;">
          <span>Toplam <strong style="color: #14F195;">${totalCount}</strong> tamir hareketi listeleniyor.</span>
        </div>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1rem; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.35); border-top: 1px solid rgba(255,255,255,0.06); border-radius: 0 0 12px 12px;">
        <div style="color: #94A3B8; font-size: 0.82rem; font-weight: 700;">
          <strong style="color: #00f3ff;">${start} - ${end}</strong> arası gösteriliyor (Toplam: <strong style="color: #14F195;">${totalCount}</strong> Hareket)
        </div>

        <div style="display: flex; align-items: center; gap: 6px;">
          <button onclick="window.setRepairHistoryPage(1)" ${page === 1 ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.7rem; border-radius: 6px; font-size: 0.75rem; background: ${page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; color: ${page === 1 ? '#475569' : '#FFF'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; border: 1px solid rgba(255,255,255,0.08);" title="İlk Sayfa">
            <i class="fa-solid fa-angles-left"></i>
          </button>
          <button onclick="window.setRepairHistoryPage(${page - 1})" ${page === 1 ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.78rem; font-weight: 800; background: ${page === 1 ? 'rgba(255,255,255,0.02)' : 'rgba(20, 241, 149, 0.15)'}; color: ${page === 1 ? '#475569' : '#14F195'}; cursor: ${page === 1 ? 'not-allowed' : 'pointer'}; border: 1px solid ${page === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(20,241,149,0.3)'};">
            <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
          </button>
          <span style="padding: 0.4rem 0.85rem; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 6px; font-family: monospace; font-weight: 900; color: #00f3ff; font-size: 0.82rem;">
            Sayfa ${page} / ${totalP}
          </span>
          <button onclick="window.setRepairHistoryPage(${page + 1})" ${page >= totalP ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.78rem; font-weight: 800; background: ${page >= totalP ? 'rgba(255,255,255,0.02)' : 'rgba(20, 241, 149, 0.15)'}; color: ${page >= totalP ? '#475569' : '#14F195'}; cursor: ${page >= totalP ? 'not-allowed' : 'pointer'}; border: 1px solid ${page >= totalP ? 'rgba(255,255,255,0.08)' : 'rgba(20,241,149,0.3)'};">
            Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
          </button>
          <button onclick="window.setRepairHistoryPage(${totalP})" ${page >= totalP ? 'disabled' : ''} class="btn-cyber" style="padding: 0.4rem 0.7rem; border-radius: 6px; font-size: 0.75rem; background: ${page >= totalP ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.08)'}; color: ${page >= totalP ? '#475569' : '#FFF'}; cursor: ${page >= totalP ? 'not-allowed' : 'pointer'}; border: 1px solid rgba(255,255,255,0.08);" title="Son Sayfa">
            <i class="fa-solid fa-angles-right"></i>
          </button>
        </div>
      </div>
    `;
  };

  // Render Rows
  const renderRows = (items: RepairRecord[]) => {
    if (items.length === 0) {
      return `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-dim); border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">Filtrelere uygun herhangi bir tamir hareketi bulunamadı.</td></tr>`;
    }

    const user = (window as any).currentUser;
    const isAdmin = user?.email?.toLowerCase().includes('admin') || user?.email === 'fatih.zebek@demirerholding.com' || user?.email === 'furkan.yildirim@demirerholding.com';

    return items.map(rep => {
      const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Merkez';
      const targetWhName = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : (rep.transferSite || '-');

      let statusBadge = '';
      if (rep.status === 'PENDING_ARRIVAL') {
        statusBadge = `<span style="background: rgba(234, 179, 8, 0.15); color: #eab308; border: 1px solid rgba(234, 179, 8, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-truck" style="margin-right: 4px;"></i> KABUL BEKLİYOR</span>`;
      } else if (rep.status === 'UNDER_REPAIR') {
        const hasActiveTask = (!!rep.assignedTo && rep.assignedTo.trim() !== '' && rep.assignedTo !== '-') || !!rep.repairStage;
        if (hasActiveTask) {
          statusBadge = `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;" title="İş emri açılmış, masada onarımda"><i class="fa-solid fa-bolt" style="margin-right: 4px;"></i> MASADA ONARIMDA</span>`;
        } else {
          statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;" title="Atölye stoğunda / rafta bekleyen arızalı kart"><i class="fa-solid fa-boxes-stacked" style="margin-right: 4px;"></i> ATÖLYE STOĞUNDA</span>`;
        }
      } else if (rep.status === 'REPAIRED') {
        statusBadge = `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i> REVİZE SAĞLAM</span>`;
      } else if (rep.status === 'SENT_BACK') {
        statusBadge = `<span style="background: rgba(139, 92, 246, 0.15); color: #c084fc; border: 1px solid rgba(139, 92, 246, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-truck-fast" style="margin-right: 4px;"></i> SAHAYA SEVK EDİLDİ</span>`;
      } else if (rep.status === 'COMPLETED') {
        statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-box" style="margin-right: 4px;"></i> DEPO STOKUNDA</span>`;
      } else if (rep.status === 'SCRAPPED') {
        statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-dumpster-fire" style="margin-right: 4px;"></i> HURDAYA AYRILDI</span>`;
      } else if (rep.status === 'REJECTED') {
        statusBadge = `<span style="background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid rgba(244, 63, 94, 0.3); padding: 0.3rem 0.6rem; border-radius: 6px; font-size: 0.75rem; font-weight: 800;" title="Reddetme sebebi: ${rep.rejectReason || '-'}"><i class="fa-solid fa-ban" style="margin-right: 4px;"></i> REDDEDİLDİ / İADE</span>`;
      }

      // Check visit count
      const cleanSerial = rep.serialNo ? rep.serialNo.trim().toLowerCase() : '';
      const cleanSap = (rep.sapNo || '').trim();
      const visits = (cleanSerial && cleanSerial !== '-') ? (cardMap.get(`${cleanSap}___${cleanSerial}`)?.length || 1) : 1;

      const deleteBtn = isAdmin ? `
        <button onclick="window.deleteRepairRecord('${rep.id}')" class="btn-cyber" style="background: rgba(239, 68, 68, 0.12); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#EF4444'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(239, 68, 68, 0.12)'; this.style.color='#EF4444';" title="Kaydı Sil">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      ` : '';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          
          <!-- Tarih Bilgileri -->
          <td style="padding: 0.85rem 0.75rem; font-size: 0.82rem; color: var(--text-dim); line-height: 1.5;">
            <div><strong style="color: #CBD5E1;">Geliş:</strong> ${formatDateOnly(rep.sentAt || rep.receivedAt)}</div>
            ${rep.repairedAt ? `<div style="margin-top: 2px;"><strong style="color: #60a5fa;">Onarım:</strong> ${formatDateOnly(rep.repairedAt)}</div>` : ''}
            ${rep.dispatchedAt ? `<div style="margin-top: 2px;"><strong style="color: #14F195;">Sevk:</strong> ${formatDateOnly(rep.dispatchedAt)}</div>` : ''}
          </td>

          <!-- Saha & Depo Bilgisi -->
          <td style="padding: 0.85rem 0.75rem; font-size: 0.83rem; color: #E2E8F0; font-weight: 600; line-height: 1.4;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c; font-size: 0.75rem;"></i>
              <span>${sourceWhName}</span>
            </div>
            ${rep.targetWarehouseId || rep.transferSite ? `
              <div style="margin-top: 3px; color: #c084fc; font-size: 0.78rem;">
                <i class="fa-solid fa-arrow-right-to-bracket" style="font-size: 0.7rem;"></i> Hedef: ${targetWhName}
              </div>
            ` : ''}
            ${rep.dispatchNo || rep.mctNo ? `<div style="font-size: 0.72rem; color: #14F195; font-family: monospace; margin-top: 2px;"><i class="fa-solid fa-truck-ramp-box"></i> ${rep.dispatchNo || rep.mctNo}</div>` : ''}
          </td>

          <!-- Malzeme Tanımı & SAP / Seri -->
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 800; color: #FFF; font-size: 0.88rem; max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${rep.description}">
              ${rep.description}
            </div>
            <div style="display: flex; gap: 6px; align-items: center; margin-top: 3px; flex-wrap: wrap;">
              <span style="background: #00f3ff; color: #0A0E17; font-weight: 900; font-size: 0.72rem; padding: 1px 5px; border-radius: 3px; font-family: monospace;">SAP ${rep.sapNo}</span>
              <span style="color: #CBD5E1; font-family: monospace; font-weight: 700; font-size: 0.78rem;">Seri: ${rep.serialNo || '-'}</span>
              ${visits > 1 ? `
                <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 5px; border-radius: 3px; font-size: 0.68rem; font-weight: 800;">
                  ${visits}. Geliş
                </span>
              ` : ''}
            </div>
            ${rep.faultCode && rep.faultCode !== '-' ? `<div style="font-size: 0.74rem; color: #F59E0B; font-weight: 600; margin-top: 3px;"><i class="fa-solid fa-triangle-exclamation" style="font-size: 0.7rem;"></i> ${rep.faultCode}</div>` : ''}
          </td>

          <!-- Miktar -->
          <td style="padding: 0.85rem 0.75rem; font-weight: 900; color: #14F195; text-align: center; font-size: 0.88rem;">
            ${rep.quantity} Adet
          </td>

          <!-- Yapılan Onarım & Notlar -->
          <td style="padding: 0.85rem 0.75rem; font-size: 0.82rem; color: #E2E8F0; max-width: 280px;">
            ${(() => {
              const hasActiveTask = (!!rep.assignedTo && rep.assignedTo.trim() !== '' && rep.assignedTo !== '-') || !!rep.repairStage;
              const hasRealNotes = rep.repairNotes && rep.repairNotes.trim() !== '' && rep.repairNotes.toLowerCase() !== 'onarım bekliyor';
              
              if (hasRealNotes) {
                return `
                  <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 6px 9px; border-radius: 6px; font-size: 0.78rem; line-height: 1.35; color: #E2E8F0;">
                    <span style="color: #F59E0B; font-weight: 700;">Onarım Notu:</span> "${rep.repairNotes}"
                  </div>
                  <div style="font-size: 0.72rem; color: #64748B; margin-top: 3px;">Teknisyen: <strong style="color: #14F195;">${rep.repairedBy || rep.assignedTo || 'Atölye'}</strong></div>
                `;
              } else if (hasActiveTask) {
                return `
                  <div style="background: rgba(20,241,149,0.05); border: 1px solid rgba(20,241,149,0.2); padding: 5px 8px; border-radius: 6px; font-size: 0.76rem; color: #14F195; font-weight: 700;">
                    <i class="fa-solid fa-screwdriver-wrench"></i> Masada Onarımda
                  </div>
                  <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 3px;">Teknisyen: <strong>${rep.assignedTo || 'Teknisyen'}</strong></div>
                `;
              } else if (rep.preRepairNote || rep.generalNote || (rep.faultDesc && rep.faultDesc !== '-')) {
                return `
                  <div style="font-size: 0.78rem; color: #94A3B8; font-style: italic;">
                    "${rep.preRepairNote || rep.generalNote || rep.faultDesc}"
                  </div>
                  <div style="font-size: 0.7rem; color: #64748B; margin-top: 3px;">
                    <i class="fa-solid fa-boxes-stacked"></i> Rafta Bekliyor (İş Emri Açılmadı)
                  </div>
                `;
              } else {
                return `
                  <span style="color: #64748B; font-style: italic; font-size: 0.76rem;">
                    <i class="fa-solid fa-boxes-stacked"></i> Rafta Bekliyor (İş Emri Açılmadı)
                  </span>
                `;
              }
            })()}
          </td>

          <!-- Durum & Aksiyonlar -->
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                ${statusBadge}
                ${(() => {
                  if (rep.status !== 'SENT_BACK' && rep.status !== 'COMPLETED') return '';
                  const cleanSerial = (rep.serialNo || '').trim().toLowerCase();
                  const cleanSap = (rep.sapNo || '').trim();
                  const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
                  const usage = (cleanSerial && cleanSerial !== '-') ? (turbineUsageMap.get(`${rawSap}___${cleanSerial}`) || turbineUsageMap.get(`${cleanSap}___${cleanSerial}`)) : null;
                  if (usage) {
                    return `
                      <span style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.5); padding: 2px 6px; border-radius: 5px; font-size: 0.7rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 8px rgba(20,241,149,0.25);" title="${usage.siteName} ${usage.turbineNo} türbinine ${usage.date} tarihinde ${usage.personnel} tarafından takıldı (Servis Raporu: #${usage.reportNo})">
                        <i class="fa-solid fa-bolt" style="color: #00f3ff; font-size: 0.68rem;"></i> TÜRBİNDE TAKILI: ${usage.siteName ? usage.siteName + ' ' : ''}${usage.turbineNo}
                      </span>
                    `;
                  } else {
                    return `
                      <span style="background: rgba(148, 163, 184, 0.1); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.2); padding: 1px 5px; border-radius: 4px; font-size: 0.68rem; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;" title="Malzeme sevk edildiği depoda hazır bekliyor.">
                        <i class="fa-solid fa-boxes-stacked" style="font-size: 0.65rem;"></i> Depo Stokunda
                      </span>
                    `;
                  }
                })()}
              </div>
              
              <!-- Süreç Zaman Çizelgesi Butonu -->
              <button onclick="window.openRepairTimelineModal('${rep.id}')" style="background: rgba(0, 243, 255, 0.1); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.3); padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Tüm Süreç ve Yaşam Döngüsü Detayı">
                <i class="fa-solid fa-clock-rotate-left"></i>
              </button>

              <!-- Pasaport & Yaşam Döngüsü Butonu -->
              <button onclick="window.openRepairTimelineModal('${rep.id}')" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.35); padding: 0.35rem 0.55rem; border-radius: 6px; font-size: 0.75rem; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Dijital Kart Pasaportu & Yaşam Döngüsü">
                <i class="fa-solid fa-passport"></i>
              </button>

              ${deleteBtn}
            </div>
            <div style="font-size: 0.7rem; color: #64748B; margin-top: 3px;">Kayıt: ${rep.sentBy?.split('@')[0] || 'Sistem'}</div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const totalAllCount = repairs.length;
  const waitingStockCount = repairs.filter(r => r.status === 'UNDER_REPAIR' && (!r.assignedTo || r.assignedTo.trim() === '' || r.assignedTo === '-') && !r.repairStage).length;
  const activeRepairCount = repairs.filter(r => r.status === 'UNDER_REPAIR' && ((!!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-') || !!r.repairStage)).length;
  const repairedCount = repairs.filter(r => r.status === 'REPAIRED').length;
  const dispatchedCount = repairs.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED').length;
  const scrappedCount = repairs.filter(r => r.status === 'SCRAPPED').length;

  const siteOptions = warehouses.map(w => `<option value="${w.id}" ${selectedSite === w.id ? 'selected' : ''}>${w.name}</option>`).join('');

  return `
    <div class="fade-in-up content-area">
      
      <!-- Top Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.4rem; color: #3B82F6;"></i> TAMİR HAREKETLERİ
            </h2>
          </div>
          <p style="color: var(--text-dim); margin: 0.35rem 0 0 0; font-size: 0.88rem;">
            Santrallerden atölyeye sevk edilen, onarılan, depoya gönderilen ve türbinlerde kullanılan kartların anlık yaşam döngüsü ve hareket takibi.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="window.navigate('workshop-stock')" class="btn-cyber" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-warehouse"></i> ATÖLYE STOĞU
          </button>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 0.6rem 1.25rem; border-radius: 8px; font-size: 0.85rem; font-weight: 900; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 15px rgba(20,241,149,0.25);">
            <i class="fa-solid fa-microchip"></i> KART TAMİR MERKEZİ
          </button>
        </div>
      </div>

      <!-- Quick Stats Counters -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div onclick="window.setRepairHistoryTab('all')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.6); cursor: pointer;" title="Tüm Hareketleri Listele">
          <div>
            <div style="font-size: 0.74rem; color: #94A3B8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Toplam Tamir Hareketi</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${totalAllCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(0, 243, 255, 0.1); border: 1px solid rgba(0, 243, 255, 0.25); display: flex; align-items: center; justify-content: center; color: #00f3ff; font-size: 1.15rem;">
            <i class="fa-solid fa-list-check"></i>
          </div>
        </div>

        <div onclick="window.setRepairHistoryTab('waiting_stock')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(59, 130, 246, 0.04); cursor: pointer;" title="Rafta / Ambarda Bekleyen Arızalı Kartlar">
          <div>
            <div style="font-size: 0.74rem; color: #60a5fa; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Arızalı Stok (Bekleyen)</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #60a5fa; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${waitingStockCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #3b82f6; font-size: 1.15rem;">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
        </div>

        <div onclick="window.setRepairHistoryTab('active_task')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(20, 241, 149, 0.3); display: flex; align-items: center; justify-content: space-between; background: rgba(20, 241, 149, 0.04); cursor: pointer;" title="İş Emri Açılmış / Masada Onarımda Olan Kartlar">
          <div>
            <div style="font-size: 0.74rem; color: #14F195; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">Masada Onarımda</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #14F195; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${activeRepairCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.15rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
        </div>

        <div onclick="window.setRepairHistoryTab('repaired')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.04); cursor: pointer;" title="Revize Sağlam Kartları Listele">
          <div>
            <div style="font-size: 0.74rem; color: #34d399; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Revize Sağlam</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #34d399; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${repairedCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: #34d399; font-size: 1.15rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <div onclick="window.setRepairHistoryTab('dispatched')" class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(139, 92, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(139, 92, 246, 0.04); cursor: pointer;" title="Sevk Edilen Kartları Listele">
          <div>
            <div style="font-size: 0.74rem; color: #c084fc; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Sevk Edilen / Depoda</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #c084fc; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${dispatchedCount}</div>
          </div>
          <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(139, 92, 246, 0.15); border: 1px solid rgba(139, 92, 246, 0.3); display: flex; align-items: center; justify-content: center; color: #a78bfa; font-size: 1.15rem;">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
        </div>

      </div>

      <!-- Controls & Filter Toolbar (Single Row) -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; gap: 0.75rem; flex-wrap: wrap;">
        
        <!-- Tab selector pills -->
        <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
          <button onclick="window.setRepairHistoryTab('all')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${currentTab === 'all' ? '#00f3ff' : 'rgba(255,255,255,0.08)'}; background: ${currentTab === 'all' ? 'rgba(0,243,255,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${currentTab === 'all' ? '#00f3ff' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            TÜMÜ (${totalAllCount})
          </button>
          <button onclick="window.setRepairHistoryTab('waiting_stock')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${currentTab === 'waiting_stock' ? '#3b82f6' : 'rgba(255,255,255,0.08)'}; background: ${currentTab === 'waiting_stock' ? 'rgba(59,130,246,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${currentTab === 'waiting_stock' ? '#60a5fa' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-boxes-stacked" style="margin-right: 6px;"></i> ARIZALI STOK (${waitingStockCount})
          </button>
          <button onclick="window.setRepairHistoryTab('active_task')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${(currentTab === 'active_task' || currentTab === 'in_progress') ? '#14F195' : 'rgba(255,255,255,0.08)'}; background: ${(currentTab === 'active_task' || currentTab === 'in_progress') ? 'rgba(20,241,149,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${(currentTab === 'active_task' || currentTab === 'in_progress') ? '#14F195' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-screwdriver-wrench" style="margin-right: 6px;"></i> MASADA ONARIMDA (${activeRepairCount})
          </button>
          <button onclick="window.setRepairHistoryTab('repaired')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${currentTab === 'repaired' ? '#10B981' : 'rgba(255,255,255,0.08)'}; background: ${currentTab === 'repaired' ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${currentTab === 'repaired' ? '#34d399' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> REVİZE SAĞLAM (${repairedCount})
          </button>
          <button onclick="window.setRepairHistoryTab('dispatched')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${currentTab === 'dispatched' ? '#c084fc' : 'rgba(255,255,255,0.08)'}; background: ${currentTab === 'dispatched' ? 'rgba(139,92,246,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${currentTab === 'dispatched' ? '#c084fc' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-truck-fast" style="margin-right: 6px;"></i> SEVK EDİLENLER (${dispatchedCount})
          </button>
          <button onclick="window.setRepairHistoryTab('scrapped')" style="height: 38px; padding: 0 1rem; border-radius: 8px; font-size: 0.78rem; font-weight: 800; cursor: pointer; border: 1px solid ${currentTab === 'scrapped' ? '#EF4444' : 'rgba(255,255,255,0.08)'}; background: ${currentTab === 'scrapped' ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.02)'}; color: ${currentTab === 'scrapped' ? '#EF4444' : '#94A3B8'}; transition: all 0.2s; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;">
            <i class="fa-solid fa-dumpster-fire" style="margin-right: 6px;"></i> HURDAYA AYRILANLAR (${scrappedCount})
          </button>
        </div>

        <!-- Filter Dropdown & Search (Single Row Right) -->
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0; flex-wrap: wrap;">
          
          <!-- Site Filter -->
          <select onchange="window.setRepairHistorySite(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.9); border: 1px solid ${selectedSite !== 'all' ? '#3B82F6' : 'rgba(255,255,255,0.1)'}; color: ${selectedSite !== 'all' ? '#60a5fa' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; width: 195px; box-sizing: border-box;">
            <option value="all" ${selectedSite === 'all' ? 'selected' : ''}>🏢 Tüm Sahalar (Depolar)</option>
            ${siteOptions}
          </select>

          <!-- Search Input -->
          <div style="position: relative; width: 240px; height: 38px;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.82rem;"></i>
            <input 
              type="text" 
              placeholder="SAP, Seri, Teknisyen, Arıza ara..." 
              value="${searchQuery}" 
              oninput="window.filterRepairHistory(this.value)"
              style="width: 100%; height: 38px; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #FFF; padding-left: 34px; padding-right: 12px; font-size: 0.82rem; outline: none; box-sizing: border-box;"
            />
          </div>

          ${selectedSite !== 'all' || searchQuery ? `
            <button onclick="window.setRepairHistorySite('all'); window.filterRepairHistory('');" class="btn-cyber" style="height: 38px; padding: 0 0.85rem; background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239,68,68,0.3); border-radius: 8px; font-size: 0.78rem; font-weight: 700; cursor: pointer; white-space: nowrap; display: inline-flex; align-items: center; justify-content: center; box-sizing: border-box;" title="Filtreleri Sıfırla">
              <i class="fa-solid fa-filter-circle-xmark"></i>
            </button>
          ` : ''}

        </div>
      </div>

      <!-- Repairs Table -->
      <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 1rem 0.75rem; width: 170px;">TARİH BİLGİLERİ</th>
              <th style="padding: 1rem 0.75rem; width: 180px;">SAHA & DEPO BİLGİSİ</th>
              <th style="padding: 1rem 0.75rem;">MALZEME TANIMI & SAP</th>
              <th style="padding: 1rem 0.75rem; text-align: center; width: 80px;">MİKTAR</th>
              <th style="padding: 1rem 0.75rem;">YAPILAN ONARIM & NOTLAR</th>
              <th style="padding: 1rem 0.75rem; text-align: right; width: 220px;">DURUM & AKSİYONLAR</th>
            </tr>
          </thead>
          <tbody id="repair-history-tbody">
            ${renderRows(pagedRepairs)}
          </tbody>
        </table>

        <!-- Pagination Bar -->
        <div id="repair-history-pagination">
          ${renderPagination(totalFilteredCount, currentPage)}
        </div>
      </div>

    </div>
  `;
};
