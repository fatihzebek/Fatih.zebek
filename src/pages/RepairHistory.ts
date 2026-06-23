import { repairService } from '../services/RepairService';
import type { RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

export const RepairHistoryPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Sistem';

  // Get active tab and filters from window state
  (window as any)._repairHistoryTab = (window as any)._repairHistoryTab || 'active';
  (window as any)._repairHistorySite = (window as any)._repairHistorySite || 'all';
  (window as any)._repairHistorySearch = (window as any)._repairHistorySearch || '';

  const currentTab = (window as any)._repairHistoryTab;
  const selectedSite = (window as any)._repairHistorySite;
  const searchQuery = (window as any)._repairHistorySearch;

  // Fetch all repair records
  const repairs = await repairService.getRepairs();
  const warehouses = dataService.getWarehouses();

  // Set global handlers
  (window as any).setRepairHistoryTab = (tab: 'active' | 'archive') => {
    (window as any)._repairHistoryTab = tab;
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any).setRepairHistorySite = (siteId: string) => {
    (window as any)._repairHistorySite = siteId;
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any).setRepairHistorySearch = (query: string) => {
    (window as any)._repairHistorySearch = query;
  };

  (window as any).triggerRepairHistorySearch = () => {
    const input = document.getElementById('repair-search-input') as HTMLInputElement;
    (window as any).setRepairHistorySearch(input?.value || '');
    if ((window as any).navigate) (window as any).navigate('repair-history');
  };

  (window as any)._allRepairs = repairs;

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
      (window as any).showToast('İşlem', 'Tamir kaydı siliniyor...', 'info');
      await repairService.deleteRepair(repairId);
      (window as any).showToast('Başarılı', 'Tamir kaydı başarıyla silindi.', 'success');
      
      if ((window as any).navigate) {
         (window as any).navigate('repair-history');
      }
    } catch (e) {
      console.error(e);
      alert('Kayıt silinirken bir hata oluştu.');
    }
  };

  // Global handler to open Process Timeline Modal
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
    `;

    // Fetch same-serial repairs (sorted newest first) to check repeating arrivals
    const sameSerialRepairs = (rep.serialNo && rep.serialNo !== '-')
      ? allRepairs.filter(r => r.serialNo === rep.serialNo).sort((a, b) => {
          const dateA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt || 0).getTime();
          const dateB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt || 0).getTime();
          return dateB - dateA;
        })
      : [];
    const totalArrivals = sameSerialRepairs.length;

    // Fetch all reports to find if/where this card was used later
    let usageReport: any = null;
    if (rep.serialNo && rep.serialNo !== '-') {
      try {
        const allReports = await serviceReportService.getAllReports();
        usageReport = allReports.find(report => {
          if (!report.materials) return false;
          return report.materials.some(mat => {
            const cleanSapMat = String(mat.sapNo || '').trim().toUpperCase();
            const cleanSapRep = String(rep.sapNo || '').trim().toUpperCase();
            const cleanSerialMat = String(mat.serialNo || '').trim();
            const cleanSerialRep = String(rep.serialNo || '').trim();
            
            const isSapMatch = cleanSapMat === cleanSapRep || cleanSapMat === ('R' + cleanSapRep) || ('R' + cleanSapRep) === cleanSapRep;
            const isSerialMatch = cleanSerialMat === cleanSerialRep;
            const isUsed = (mat.used || 0) > 0;
            
            return isSapMatch && isSerialMatch && isUsed;
          });
        });
      } catch (err) {
        console.error("Error finding card usage in reports:", err);
      }
    }

    const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId;
    const targetWh = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : '-';

    const steps = [
      {
        title: 'Söküldü ve Sevk Edildi',
        time: rep.sentAt,
        user: rep.sentBy,
        detail: `Kaynak Depo: ${sourceWh}`,
        image: '',
        done: !!rep.sentAt
      },
      {
        title: 'Atölyeye Ulaştı (Kabul Edildi)',
        time: rep.receivedAt,
        user: rep.receivedBy,
        detail: `Malzeme fiziksel olarak atölye envanterine kabul edildi.`,
        image: '',
        done: !!rep.receivedAt
      },
      {
        title: 'Tamir Edildi / Onarım Notu',
        time: rep.repairedAt,
        user: rep.repairedBy,
        detail: rep.repairNotes ? `İşlemler: "${rep.repairNotes}"` : '',
        image: rep.repairImageUrl,
        done: !!rep.repairedAt
      },
      {
        title: 'Depoya Geri Sevk Edildi',
        time: rep.dispatchedAt,
        user: rep.dispatchedBy,
        detail: `Hedef Depo: ${targetWh}`,
        image: '',
        done: !!rep.dispatchedAt
      },
      {
        title: 'Depo Tarafından Teslim Alındı',
        time: rep.completedAt,
        user: 'Malzeme Yönetimi',
        detail: `Parça revize (R) kodu ile hedef depo envanterine eklendi.`,
        image: '',
        done: !!rep.completedAt
      }
    ];

    if (usageReport) {
      const installedReportId = usageReport.reportNo || usageReport.id || '-';
      const installedDate = usageReport.date;
      const installedTurbine = (usageReport.siteName ? usageReport.siteName + ' ' : '') + (usageReport.turbineNo || 'Bilinmeyen');
      const installedBy = usageReport.createdBy || usageReport.personnel?.[0] || 'Bilinmeyen';

      steps.push({
        title: 'Türbinde Yeniden Kullanıldı (Montaj)',
        time: installedDate,
        user: installedBy,
        detail: `Montaj Edilen Türbin: ${installedTurbine} | Servis Raporu: ${installedReportId}`,
        image: '',
        done: true
      });
    }

    const timelineHtml = steps.map((step, idx) => {
      const color = step.done ? '#14F195' : '#475569';
      const glow = step.done ? 'box-shadow: 0 0 10px #14F195;' : '';
      const borderStyle = idx === steps.length - 1 ? '' : `border-left: 2px dashed ${color};`;
      const timeStr = step.time ? formatDateTime(step.time) : '-';
      
      return `
        <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; position: relative; ${borderStyle} padding-left: 20px; margin-left: 10px;">
          <div style="position: absolute; left: -6px; top: 0; width: 14px; height: 14px; border-radius: 50%; background: ${color}; ${glow}"></div>
          <div style="flex-grow: 1; margin-top: -3px; background: rgba(255,255,255,0.01); border: 1px solid ${step.done ? 'rgba(20, 241, 149, 0.1)' : 'rgba(255,255,255,0.03)'}; padding: 0.75rem 1rem; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-weight: 700; color: ${step.done ? '#FFF' : '#64748B'}; font-size: 0.9rem;">${step.title}</span>
              <span style="font-size: 0.75rem; color: #94A3B8; font-family: monospace;">${timeStr}</span>
            </div>
            ${step.user ? `<div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">İşlem Yapan: ${step.user.split('@')[0]}</div>` : ''}
            ${step.detail ? `<div style="font-size: 0.8rem; color: #94A3B8; margin-top: 6px; font-style: italic; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">${step.detail}</div>` : ''}
            ${step.image ? `<div style="margin-top: 8px; text-align: left;"><img src="${step.image}" style="max-width: 100%; max-height: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="window.open('${step.image}', '_blank')" title="Büyütmek için tıklayın" /></div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 550px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i> ONARIM SÜREÇ TAKİBİ
          </h3>
          <button onclick="document.getElementById('repair-timeline-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.5rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
          <span style="font-weight:700; color:#FFF; display:block; font-size:0.95rem;">${rep.description}</span>
          <span style="font-size:0.78rem; color:#94A3B8;">
            <i class="fa-solid fa-barcode"></i> SAP: ${rep.sapNo} | Seri No: <strong style="color: #10B981;">${rep.serialNo || '-'}</strong> | Miktar: ${rep.quantity} Adet
            ${totalArrivals > 1 ? `
              <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 5px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">
                <i class="fa-solid fa-arrows-spin"></i> TEKRARLI ARIZA (${totalArrivals}. Geliş)
              </span>
            ` : ''}
          </span>
          ${rep.faultCode && rep.faultCode !== '-' ? `
            <div style="font-size:0.78rem; color:#F59E0B; margin-top:6px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> <strong>Sökülme Arıza Kodu:</strong> ${rep.faultCode} ${rep.faultDesc && rep.faultDesc !== '-' ? `(${rep.faultDesc})` : ''}
            </div>
          ` : ''}
        </div>
 
        <div style="margin-bottom:1.5rem;">
          ${timelineHtml}
        </div>

        ${totalArrivals > 1 ? `
          <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-family:'Rajdhani', sans-serif; font-size: 1.05rem; color: #F59E0B; font-weight: 800; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
              <i class="fa-solid fa-clock-rotate-left"></i> KARTIN ATÖLYE GEÇMİŞİ (TOPLAM ${totalArrivals} GELİŞ)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 180px; overflow-y: auto; padding-right: 4px;">
              ${sameSerialRepairs.map((r, i) => {
                const isCurrent = r.id === rep.id;
                const arrivalNum = totalArrivals - i;
                const repairDate = r.sentAt ? formatDateTime(r.sentAt).split(' ')[0] : '-';
                const compDate = r.completedAt ? formatDateTime(r.completedAt).split(' ')[0] : (r.status === 'REPAIRED' ? 'Atölyede (Onarıldı)' : 'İşlemde');
                return `
                  <div style="background: ${isCurrent ? 'rgba(20,241,149,0.04)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isCurrent ? 'rgba(20,241,149,0.3)' : 'rgba(255,255,255,0.04)'}; padding: 0.65rem; border-radius: 8px; font-size: 0.78rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-weight: 700; color: ${isCurrent ? '#14F195' : '#FFF'}; font-size: 0.8rem;">
                        ${arrivalNum}. Geliş ${isCurrent ? '<span style="font-size:0.7rem; color:#14F195; font-weight: normal; margin-left: 4px;">(Mevcut Kayıt)</span>' : ''}
                      </span>
                      <span style="font-size: 0.7rem; color: #94A3B8; font-family: monospace;">Tarih: ${repairDate} &rarr; ${compDate}</span>
                    </div>
                    <div style="color: #94A3B8; font-size: 0.75rem;">
                      <strong>Arıza:</strong> <span style="color: #F59E0B;">${r.faultCode || '-'}</span> ${r.faultDesc && r.faultDesc !== '-' ? `(${r.faultDesc})` : ''}
                    </div>
                    ${r.repairNotes ? `
                      <div style="margin-top: 4px; color: #E2E8F0; font-style: italic; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
                        <strong>Onarım Notu:</strong> "${r.repairNotes}"
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('repair-timeline-modal').remove()" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">KAPAT</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // Filter repairs
  let filtered = repairs;

  // 1. Site Filter
  if (selectedSite !== 'all') {
    filtered = filtered.filter(r => r.sourceWarehouseId === selectedSite || r.targetWarehouseId === selectedSite);
  }

  // 2. Search Filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(r => 
      (r.sapNo || '').toLowerCase().includes(q) ||
      (r.serialNo || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.repairNotes || '').toLowerCase().includes(q) ||
      (r.sentBy || '').toLowerCase().includes(q)
    );
  }

  // 3. Tab Filter
  if (currentTab === 'active') {
    filtered = filtered.filter(r => r.status === 'PENDING_ARRIVAL' || r.status === 'UNDER_REPAIR' || r.status === 'REPAIRED' || r.status === 'SENT_BACK');
  } else {
    filtered = filtered.filter(r => r.status === 'COMPLETED');
  }

  // Render Rows
  const renderRows = () => {
    if (filtered.length === 0) {
      return `<tr><td colspan="6" style="text-align: center; padding: 3rem; color: var(--text-dim); border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">Filtrelere uygun herhangi bir tamir hareketi bulunamadı.</td></tr>`;
    }

    const user = (window as any).currentUser;
    const isAdmin = user?.email?.toLowerCase().includes('admin') || user?.email === 'fatih.zebek@demirerholding.com';

    // Sort: Active is sorted by sentAt (newest first). Archive is sorted by repairedAt (newest first).
    const sorted = [...filtered].sort((a, b) => {
      const timeA = currentTab === 'active' ? (a.sentAt?.seconds || 0) : (a.completedAt?.seconds || 0);
      const timeB = currentTab === 'active' ? (b.sentAt?.seconds || 0) : (b.completedAt?.seconds || 0);
      return timeB - timeA;
    });

    return sorted.map(rep => {
      const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId;
      const targetWhName = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : '-';

      let statusBadge = '';
      if (rep.status === 'PENDING_ARRIVAL') {
        statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Atölyeye Sevk Edildi</span>`;
      } else if (rep.status === 'UNDER_REPAIR') {
        statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Atölyede (Onarımda)</span>`;
      } else if (rep.status === 'REPAIRED') {
        statusBadge = `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Tamir Edildi (Atölye Stoğunda)</span>`;
      } else if (rep.status === 'SENT_BACK') {
        statusBadge = `<span style="background: rgba(139, 92, 246, 0.15); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Depoya Geri Gönderildi</span>`;
      } else if (rep.status === 'COMPLETED') {
        statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Tamamlandı (Stokta)</span>`;
      }

      const deleteBtn = isAdmin ? `
        <button onclick="window.deleteRepairRecord('${rep.id}')" class="btn-cyber" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; margin-left: 8px; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#EF4444'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#EF4444';" title="Kaydı Sil">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      ` : '';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 1rem; font-size: 0.85rem; color: var(--text-dim); line-height: 1.5;">
            <div><strong>Sevk:</strong> ${formatDateTime(rep.sentAt)}</div>
            ${rep.receivedAt ? `<div style="margin-top: 4px;"><strong>Atölye Kabul:</strong> ${formatDateTime(rep.receivedAt)}</div>` : ''}
            ${rep.repairedAt ? `<div style="margin-top: 4px;"><strong>Tamir:</strong> ${formatDateTime(rep.repairedAt)}</div>` : ''}
            ${rep.completedAt ? `<div style="margin-top: 4px;"><strong>Kapanış:</strong> ${formatDateTime(rep.completedAt)}</div>` : ''}
          </td>
          <td style="padding: 1rem; font-size: 0.85rem; color: #E2E8F0; font-weight: 600; line-height: 1.5;">
            <div><strong>Kaynak:</strong> ${sourceWhName}</div>
            ${rep.dispatchNo ? `<div style="font-size: 0.72rem; color: #14F195; font-family: monospace; margin-top: 2px; font-weight: bold;"><i class="fa-solid fa-truck-ramp-box" style="margin-right: 2px;"></i> ${rep.dispatchNo}</div>` : ''}
            ${rep.targetWarehouseId ? `<div style="margin-top: 4px; color: #8B5CF6;"><strong>Hedef:</strong> ${targetWhName}</div>` : ''}
          </td>
          <td style="padding: 1rem;">
            <div style="font-weight: 700; color: #FFF;">${rep.description}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-family: monospace; margin-top: 2px;">
              <i class="fa-solid fa-barcode"></i> SAP: ${rep.sapNo} | Seri No: <span style="color: #10B981; font-weight: bold;">${rep.serialNo || '-'}</span>
            </div>
            ${rep.faultCode && rep.faultCode !== '-' ? `<div style="font-size: 0.72rem; color: #F59E0B; font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 2px;"></i> Arıza: ${rep.faultCode}</div>` : ''}
          </td>
          <td style="padding: 1rem; font-weight: 800; color: #14F195; text-align: center; font-size: 0.9rem;">${rep.quantity} Adet</td>
          <td style="padding: 1rem; font-size: 0.85rem; color: #E2E8F0;">
            ${rep.repairNotes ? `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px 12px; border-radius: 6px; font-size: 0.8rem; line-height: 1.4; color: #E2E8F0; max-width: 350px; word-break: break-word;">
                <span style="color: #F59E0B; font-weight: 700;"><i class="fa-solid fa-comment-medical" style="margin-right: 4px;"></i>Yapılan Onarım:</span>
                <div style="margin-top: 4px; font-style: italic;">"${rep.repairNotes}"</div>
              </div>
              <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">Usta/Teknisyen: ${rep.repairedBy || 'Bilinmeyen'}</div>
            ` : '<span style="color: var(--text-dim); font-style: italic;">Onarım bilgisi girilmemiş veya henüz tamamlanmamış.</span>'}
          </td>
          <td style="padding: 1rem; text-align: right;">
            <div style="display: flex; align-items: center; justify-content: flex-end; gap: 8px; white-space: nowrap;">
              <div>${statusBadge}</div>
              <i onclick="window.openRepairTimelineModal('${rep.id}')" class="fa-solid fa-circle-info" style="cursor: pointer; color: #3B82F6; font-size: 1.1rem; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="Süreç Detayı"></i>
              ${deleteBtn}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 4px;">Sevk Eden: ${rep.sentBy?.split('@')[0]}</div>
            ${rep.receivedBy ? `<div style="font-size: 0.72rem; color: var(--text-dim); margin-top: 2px;">Kabul Eden: ${rep.receivedBy?.split('@')[0]}</div>` : ''}
          </td>
        </tr>
      `;
    }).join('');
  };

  const siteOptions = warehouses.map(w => `<option value="${w.id}" ${selectedSite === w.id ? 'selected' : ''}>${w.name}</option>`).join('');

  return `
    <div class="fade-in-up content-area">
      <!-- Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right: 0.5rem;"></i> Tamir Hareketleri
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Santrallerden sökülen arızalı malzemelerin sevk, atölye onarım ve depo kabul geçmişi.</p>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
          
          <!-- Tab selector -->
          <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <button onclick="window.setRepairHistoryTab('active')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${currentTab === 'active' 
                ? 'background: #14F195; color: #0A0E17;' 
                : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${currentTab}'!=='active') this.style.color='#FFF'"
              onmouseout="if('${currentTab}'!=='active') this.style.color='#94A3B8'">
              <i class="fa-solid fa-gears" style="margin-right: 4px;"></i> AKTİF TAMİRLER (${repairs.filter(r => r.status !== 'COMPLETED').length})
            </button>
            <button onclick="window.setRepairHistoryTab('archive')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${currentTab === 'archive' 
                ? 'background: #14F195; color: #0A0E17;' 
                : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${currentTab}'!=='archive') this.style.color='#FFF'"
              onmouseout="if('${currentTab}'!=='archive') this.style.color='#94A3B8'">
              <i class="fa-solid fa-box-archive" style="margin-right: 4px;"></i> TAMAMLAYANLAR ARŞİVİ (${repairs.filter(r => r.status === 'COMPLETED').length})
            </button>
          </div>

          <!-- Site Selector Filter -->
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <label style="color: #94A3B8; font-size: 0.85rem; font-weight: 600;"><i class="fa-solid fa-filter" style="margin-right: 4px;"></i>Saha Filtresi:</label>
            <select onchange="window.setRepairHistorySite(this.value)" class="cyber-input" style="padding: 0.45rem 1rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.05); color: #FFF; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; outline: none; min-width: 200px;">
              <option value="all" ${selectedSite === 'all' ? 'selected' : ''}>Tüm Sahalar (Depolar)</option>
              ${siteOptions}
            </select>
          </div>

        </div>

        <!-- Search Bar Row -->
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="position: relative; flex-grow: 1;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B;"></i>
            <input type="text" id="repair-search-input" class="cyber-input" placeholder="SAP No, Malzeme Tanımı, Onarım Notu veya Personel ara..." value="${searchQuery}" style="width: 100%; padding: 0.65rem 1rem 0.65rem 36px; background: rgba(0,0,0,0.4);" onkeydown="if(event.key==='Enter') window.triggerRepairHistorySearch()" />
          </div>
          <button onclick="window.triggerRepairHistorySearch()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; border: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">ARA</button>
        </div>
      </div>

      <!-- Repairs Table -->
      <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; overflow-x: auto;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main);">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); font-size: 0.85rem; text-align: left;">
              <th style="padding: 1rem; width: 200px;">Tarih Bilgileri</th>
              <th style="padding: 1rem; width: 220px;">Saha Bilgisi</th>
              <th style="padding: 1rem;">Malzeme (SAP)</th>
              <th style="padding: 1rem; text-align: center; width: 100px;">Miktar</th>
              <th style="padding: 1rem;">Yapılan Onarım İşlemleri</th>
              <th style="padding: 1rem; text-align: right; width: 180px;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows()}
          </tbody>
        </table>
      </div>
    </div>
  `;
};
