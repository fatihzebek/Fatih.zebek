import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { emailService } from '../services/EmailService';
import { serviceReportService } from '../services/ServiceReportService';
import { getSiteTeamLeader, formatDisplayName } from '../utils/formatters';
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

// Group dispatched items by Form No / MÇT No
export interface DispatchGroup {
  groupId: string;
  dispatchNo: string;
  targetWarehouseId: string;
  targetWarehouseName: string;
  dispatchedAt: any;
  dispatchedBy: string;
  repairNotes?: string;
  items: RepairRecord[];
}

// Helper to determine whether the card was 5. Onarıldı & Test Edildi vs 6. Onarıldı (Türbinde Test)
export const getRepairNoteOrTestStatus = (rep: any): { text: string; isTurbine: boolean } => {
  const rawNotes = String(rep.repairNotes || '').trim();
  const isTurbineTest = rep.testStatus === 'UNTESTED' || 
                        rep.repairStage === 'TURBINE_TEST' || 
                        rawNotes.toLowerCase().includes('türbinde') || 
                        rawNotes.toLowerCase().includes('turbinde');

  if (isTurbineTest) {
    const hasCustom = rawNotes && 
                      rawNotes.toLowerCase() !== 'onarım bekliyor' && 
                      rawNotes.toLowerCase() !== 'onarim bekliyor' &&
                      !rawNotes.includes('6. Onarıldı');
    return { text: hasCustom ? `6. Onarıldı (Türbinde Test) - ${rawNotes}` : '6. Onarıldı (Türbinde Test)', isTurbine: true };
  }

  const hasCustom = rawNotes && 
                    rawNotes.toLowerCase() !== 'onarım bekliyor' && 
                    rawNotes.toLowerCase() !== 'onarim bekliyor' &&
                    !rawNotes.includes('5. Onarıldı');
  return { text: hasCustom ? `5. Onarıldı & Test Edildi - ${rawNotes}` : '5. Onarıldı & Test Edildi', isTurbine: false };
};

export const WorkshopDispatchesPage = async () => {
  const currentUser = (window as any).currentUser;
  const allRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const warehouses = dataService.getWarehouses();

  // Pre-fetch all service reports to check if any dispatched card has been mounted in a turbine
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
          if (matSerial && matSerial !== '-' && matSerial !== 'yok') {
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
    console.error("Error loading service reports for dispatches:", err);
  }

  // Filter only dispatched and completed items
  const dispatchedItems = allRepairs.filter((r: RepairRecord) => r.status === 'SENT_BACK' || r.status === 'COMPLETED');

  (window as any)._allDispatchedRepairs = dispatchedItems;
  (window as any)._workshopDispatchSearch = (window as any)._workshopDispatchSearch || '';
  (window as any)._workshopDispatchSiteFilter = (window as any)._workshopDispatchSiteFilter || 'ALL';

  const groupDispatches = (items: RepairRecord[]): DispatchGroup[] => {
    const groupsMap = new Map<string, DispatchGroup>();

    items.forEach(item => {
      const dNo = (item.dispatchNo || item.mctNo || '').trim();
      const targetWh = item.targetWarehouseId || item.sourceWarehouseId || 'UNKNOWN';
      const targetWhName = warehouses.find(w => w.id === targetWh)?.name || item.sourceWarehouseId || 'Saha Deposu';

      const groupKey = dNo && dNo !== '-'
        ? `${dNo.toLowerCase().replace(/[^a-z0-9]/g, '_')}___${targetWh}`
        : `single___${item.id}`;

      if (!groupsMap.has(groupKey)) {
        groupsMap.set(groupKey, {
          groupId: groupKey,
          dispatchNo: dNo || '-',
          targetWarehouseId: targetWh,
          targetWarehouseName: targetWhName,
          dispatchedAt: item.dispatchedAt || item.completedAt,
          dispatchedBy: item.dispatchedBy || item.repairedBy || 'Merkez Atölye',
          repairNotes: item.repairNotes,
          items: []
        });
      }

      groupsMap.get(groupKey)!.items.push(item);
    });

    return Array.from(groupsMap.values());
  };

  const filterDispatchGroups = (): DispatchGroup[] => {
    const query = ((window as any)._workshopDispatchSearch || '').trim();
    const siteFilter = (window as any)._workshopDispatchSiteFilter || 'ALL';
    const allGroups = groupDispatches(dispatchedItems);

    return allGroups.filter(grp => {
      // 1. Site filter
      if (siteFilter !== 'ALL') {
        if (grp.targetWarehouseId !== siteFilter) return false;
      }

      // 2. Query filter
      if (query) {
        const cleanQ = normalizeKey(query);
        if (grp.dispatchNo && grp.dispatchNo !== '-' && normalizeKey(grp.dispatchNo).includes(cleanQ)) {
          return true;
        }
        if (normalizeKey(grp.targetWarehouseName).includes(cleanQ)) {
          return true;
        }
        return grp.items.some(item => {
          const s = normalizeKey(item.serialNo || '');
          const sap = normalizeKey(item.sapNo || '');
          const desc = normalizeKey(item.description || '');
          const note = normalizeKey(item.repairNotes || '') + ' ' + normalizeKey(item.faultDesc || '');
          const fault = normalizeKey(item.faultCode || '');
          return s.includes(cleanQ) || sap.includes(cleanQ) || desc.includes(cleanQ) || note.includes(cleanQ) || fault.includes(cleanQ);
        });
      }

      return true;
    });
  };

  // Handlers
  (window as any).filterWorkshopDispatches = (query: string) => {
    (window as any)._workshopDispatchSearch = query;
    const tbody = document.getElementById('workshop-dispatches-tbody');
    if (tbody) {
      tbody.innerHTML = renderDispatchRows(filterDispatchGroups());
    }
  };

  (window as any).setWorkshopDispatchSiteFilter = (siteId: string) => {
    (window as any)._workshopDispatchSiteFilter = siteId;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-dispatches');
    }
  };

  (window as any).toggleDispatchGroup = (groupId: string) => {
    const row = document.getElementById('subrow-' + groupId);
    const chevron = document.getElementById('chevron-' + groupId);
    const btn = document.getElementById('togglebtn-' + groupId);
    if (!row) return;
    const isHidden = row.style.display === 'none';
    row.style.display = isHidden ? 'table-row' : 'none';
    if (chevron) {
      chevron.className = isHidden ? 'fa-solid fa-chevron-up' : 'fa-solid fa-chevron-down';
    }
    if (btn) {
      const cnt = row.getAttribute('data-count') || '';
      btn.innerHTML = isHidden 
        ? `<i class="fa-solid fa-chevron-up"></i> ${cnt} Malzeme`
        : `<i class="fa-solid fa-chevron-down"></i> ${cnt} Malzeme`;
    }
  };

  // Quick print single label from workshop dispatches
  (window as any).quickPrintSingleCardLabel = async (repairId: string) => {
    let rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      const fetched = await repairService.getRepairs();
      rep = fetched.find(r => r.id === repairId);
    }
    if (!rep) return;

    try {
      const { qrService } = await import('../services/QRService');
      await qrService.printWorkshopCardLabel({
        id: rep.id,
        sapNo: rep.sapNo,
        serialNo: rep.serialNo,
        description: rep.description,
        testStatus: rep.testStatus || (rep.status === 'REPAIRED' ? 'TESTED' : 'UNTESTED'),
        repairNotes: getRepairNoteOrTestStatus(rep).text,
        shelfNo: rep.shelfNo
      });
    } catch (e) {
      console.error(e);
      alert("Etiket yazdırılamadı: " + e);
    }
  };

  // Open card passport history in-page modal dialog
  (window as any).openCardHistoryModal = (repairId: string) => {
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const cleanSerial = (rep.serialNo || '').trim().toLowerCase();
    const cleanSap = (rep.sapNo || '').trim();
    const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
    const usage = (cleanSerial && cleanSerial !== '-' && cleanSerial !== 'yok')
      ? turbineUsageMap.get(`${rawSap}___${cleanSerial}`)
      : undefined;

    const statusInfo = getRepairNoteOrTestStatus(rep);
    const sourceWhName = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Merkez';
    const targetWhName = warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId || '-';

    document.getElementById('dispatch-card-detail-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'dispatch-card-detail-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10005; display: flex; align-items: center; justify-content: center; padding: 1.5rem; box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 760px; max-height: 90vh; overflow-y: auto; padding: 2rem; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.3); box-shadow: 0 25px 50px rgba(0,0,0,0.8); background: #0A0E17;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; color: #00f3ff; font-weight: 800; letter-spacing: 1px; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-microchip"></i> KART VE İŞLEM DETAYI
            </h3>
            <p style="margin: 4px 0 0 0; color: #94A3B8; font-size: 0.8rem;">
              SAP: <strong style="color: #FFF;">${rep.sapNo}</strong> | Seri No: <strong style="color: #10B981;">${rep.serialNo || '-'}</strong> | Sevk Form No: <strong style="color: #60a5fa;">${rep.dispatchNo || rep.mctNo || '-'}</strong>
            </p>
          </div>
          <button onclick="document.getElementById('dispatch-card-detail-modal')?.remove()" style="background: transparent; border: none; color: #94A3B8; font-size: 1.3rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Info Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem;">
          
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.85rem; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Malzeme Tanımı</div>
            <div style="color: #FFF; font-weight: 700; font-size: 0.88rem; margin-top: 3px;">${rep.description}</div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.85rem; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Onarım & Test Durumu</div>
            <div style="margin-top: 4px;">
              <span style="background: ${statusInfo.isTurbine ? 'rgba(245, 158, 11, 0.15)' : 'rgba(20, 241, 149, 0.15)'}; color: ${statusInfo.isTurbine ? '#F59E0B' : '#14F195'}; border: 1px solid ${statusInfo.isTurbine ? 'rgba(245, 158, 11, 0.4)' : 'rgba(20, 241, 149, 0.4)'}; padding: 3px 8px; border-radius: 5px; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                <i class="fa-solid ${statusInfo.isTurbine ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i> ${statusInfo.text}
              </span>
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.85rem; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Çıkış Deposu ➔ Hedef Saha</div>
            <div style="color: #E2E8F0; font-weight: 700; font-size: 0.85rem; margin-top: 3px;">
              <i class="fa-solid fa-arrow-right-from-bracket" style="color: #64748B; margin-right: 4px;"></i> ${sourceWhName} ➔ <i class="fa-solid fa-charging-station" style="color: #fb923c; margin: 0 4px;"></i> ${targetWhName}
            </div>
          </div>

          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); padding: 0.85rem; border-radius: 8px;">
            <div style="font-size: 0.72rem; color: #64748B; font-weight: 700; text-transform: uppercase;">Arıza Kodu & Sevk Tarihi</div>
            <div style="color: #F59E0B; font-weight: 700; font-size: 0.85rem; margin-top: 3px; font-family: monospace;">
              ${rep.faultCode && rep.faultCode !== '-' ? rep.faultCode : 'Belirtilmedi'}
              <span style="color: #64748B; font-weight: normal; margin-left: 6px;">(${formatDateTime(rep.dispatchedAt || rep.repairedAt)})</span>
            </div>
          </div>

        </div>

        <!-- Canlı Türbin Montaj Durumu (Eğer varsa) -->
        ${usage ? `
          <div style="background: rgba(20, 241, 149, 0.08); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-bolt" style="color: #14F195; font-size: 1.4rem;"></i>
              <div>
                <div style="color: #14F195; font-weight: 800; font-size: 0.88rem;">BU KART ŞU ANDA TÜRBİNDE TAKILI VE ÇALIŞIYOR</div>
                <div style="color: #CBD5E1; font-size: 0.78rem; margin-top: 2px;">
                  <strong>${usage.siteName}</strong> Santrali, <strong>${usage.turbineNo}</strong> no'lu türbine <strong>${usage.date}</strong> tarihinde <strong>${usage.personnel}</strong> tarafından takıldı.
                </div>
              </div>
            </div>
            <span style="background: rgba(20, 241, 149, 0.2); color: #14F195; padding: 4px 10px; border-radius: 6px; font-family: monospace; font-weight: 800; font-size: 0.78rem;">
              Rapor #${usage.reportNo}
            </span>
          </div>
        ` : ''}

        <!-- Process Logs & Repair Timeline -->
        <div style="margin-bottom: 1.5rem;">
          <h4 style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: #94A3B8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
            <i class="fa-solid fa-clock-rotate-left" style="color: #00f3ff; margin-right: 5px;"></i> Atölye İşlem ve Aşama Geçmişi
          </h4>
          <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; max-height: 220px; overflow-y: auto;">
            ${(rep.noteLogs && rep.noteLogs.length > 0) ? `
              <div style="display: flex; flex-direction: column; gap: 0.65rem;">
                ${rep.noteLogs.map(log => `
                  <div style="display: flex; gap: 10px; font-size: 0.78rem; border-left: 2px solid #00f3ff; padding-left: 10px;">
                    <div style="color: #64748B; font-family: monospace; white-space: nowrap;">${formatDateTime(log.date)}</div>
                    <div style="color: #00f3ff; font-weight: 700; white-space: nowrap;">${formatDisplayName(log.user || '')}:</div>
                    <div style="color: #E2E8F0;">${log.text}</div>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div style="color: #64748B; font-size: 0.8rem; text-align: center; padding: 0.75rem;">Detaylı işlem log kaydı bulunmuyor.</div>
            `}
          </div>
        </div>

        <!-- Used Components if any -->
        ${(rep.usedComponents && rep.usedComponents.length > 0) ? `
          <div style="margin-bottom: 1.5rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-size: 0.85rem; color: #94A3B8; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
              <i class="fa-solid fa-microchip" style="color: #10B981; margin-right: 5px;"></i> Onarımda Sarf Edilen Komponentler
            </h4>
            <div style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.75rem;">
              <div style="display: flex; flex-wrap: wrap; gap: 6px;">
                ${rep.usedComponents.map((c: any) => `
                  <span style="background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700;">
                    ${c.name || c.componentName} (${c.quantity || 1} Adet)
                  </span>
                `).join('')}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Actions Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
          <button 
            type="button" 
            onclick="window.open('/card-passport?id=${rep.id}', '_blank')" 
            class="btn-cyber" 
            style="background: rgba(0, 243, 255, 0.12); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.35); font-weight: 800; padding: 0.55rem 1.1rem; border-radius: 8px; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-id-card"></i> Resmi Pasaportu Yeni Sekmede Aç
          </button>

          <div style="display: flex; gap: 8px;">
            <button 
              type="button" 
              onclick="window.quickPrintSingleCardLabel('${rep.id}')" 
              class="btn-cyber" 
              style="background: rgba(255, 235, 59, 0.12); color: #fef08a; border: 1px solid rgba(255, 235, 59, 0.35); font-weight: 800; padding: 0.55rem 1rem; border-radius: 8px; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;"
            >
              <i class="fa-solid fa-print"></i> 80x40 Etiket Yazdır
            </button>
            <button 
              type="button" 
              onclick="document.getElementById('dispatch-card-detail-modal')?.remove()" 
              class="btn-cyber" 
              style="background: rgba(255,255,255,0.08); color: #FFF; font-weight: 700; padding: 0.55rem 1.25rem; border-radius: 8px; font-size: 0.82rem; cursor: pointer;"
            >
              Kapat
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  // Download official Dispatch PDF for the ENTIRE group under Form No
  (window as any).downloadDispatchPDF = async (identifier: string) => {
    const allGroups = groupDispatches(dispatchedItems);
    const grp = allGroups.find(g => g.groupId === identifier || g.items.some(it => it.id === identifier));
    if (!grp) {
      alert("Sevk kaydı bulunamadı.");
      return;
    }

    try {
      (window as any).showToast?.('İşlem', `${grp.dispatchNo} sevk formu PDF olarak hazırlanıyor...`, 'info');
      
      const pdfItems = grp.items.map(rep => {
        const statusInfo = getRepairNoteOrTestStatus(rep);
        return {
          sapNo: rep.sapNo,
          description: rep.description,
          quantity: rep.quantity || 1,
          serialNo: rep.serialNo || '-',
          repairNotes: statusInfo.text,
          faultCode: rep.faultCode || '-'
        };
      });

      const cleanNote = grp.repairNotes && 
                        grp.repairNotes.toLowerCase() !== 'onarım bekliyor' && 
                        grp.repairNotes.toLowerCase() !== 'onarim bekliyor'
        ? grp.repairNotes
        : 'Tamiri ve testleri tamamlanmış revize sağlam malzeme.';

      const recipient = getSiteTeamLeader(grp.targetWarehouseId || grp.targetWarehouseName);

      const pdfFile = await emailService.generateDispatchPDFFile({
        dispatchNo: grp.dispatchNo !== '-' ? grp.dispatchNo : `MÇT-${Date.now().toString().slice(-5)}`,
        targetWarehouseName: grp.targetWarehouseName,
        senderName: formatDisplayName(grp.dispatchedBy || currentUser?.displayName || currentUser?.email || 'Fatih Zebek'),
        recipientName: recipient,
        note: cleanNote,
        items: pdfItems
      });

      if (!pdfFile) {
        alert('PDF oluşturulamadı.');
        return;
      }

      // Trigger browser download
      const url = URL.createObjectURL(pdfFile);
      const a = document.createElement('a');
      a.href = url;
      a.download = pdfFile.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      (window as any).showToast?.('Başarılı', `${grp.dispatchNo} resmi sevk formu (${pdfItems.length} kalem) PDF olarak indirildi.`, 'success');
    } catch(err) {
      console.error(err);
      alert('PDF oluşturulamadı: ' + err);
    }
  };

  // Export Excel with clear Form No grouping
  (window as any).exportWorkshopDispatchesExcel = () => {
    const groups = filterDispatchGroups();
    if (groups.length === 0) {
      alert("Dışa aktarılacak sevk kaydı bulunamadı.");
      return;
    }

    const excelData: any[] = [];
    let rowIdx = 1;

    groups.forEach(grp => {
      grp.items.forEach(r => {
        excelData.push({
          'SIRA': rowIdx++,
          'SEVK / FORM NO': grp.dispatchNo || '-',
          'SAP NO': r.sapNo,
          'SERİ NO': r.serialNo || '-',
          'MALZEME TANIMI': r.description,
          'ADET': r.quantity || 1,
          'GÖNDERİLEN SAHA': grp.targetWarehouseName,
          'SEVK TARİHİ': formatDateTime(grp.dispatchedAt),
          'SEVK EDEN': grp.dispatchedBy,
          'YAPILAN ONARIM / NOT': getRepairNoteOrTestStatus(r).text,
          'ARIZA KODU': r.faultCode || '-'
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sevk Edilenler");
    XLSX.writeFile(wb, `MTA_Sevk_Edilenler_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderDispatchRows = (groups: DispatchGroup[]) => {
    if (groups.length === 0) {
      return `
        <tr>
          <td colspan="4" style="text-align: center; padding: 3.5rem 1.5rem; color: #94A3B8;">
            <i class="fa-solid fa-box-open" style="font-size: 2.2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4;"></i>
            <div style="font-weight: 700; font-size: 0.95rem; color: #CBD5E1;">Henüz Atölyeden Sevk Edilmiş Malzeme Bulunmuyor</div>
            <div style="font-size: 0.8rem; color: #64748B; margin-top: 4px;">Atölyede onarımı tamamlanan parçaları "Atölye Stoğu" sayfasından sevk edebilirsiniz.</div>
          </td>
        </tr>
      `;
    }

    return groups.map(grp => {
      const usedItems = grp.items.filter(it => {
        const cleanSerial = (it.serialNo || '').trim().toLowerCase();
        const cleanSap = (it.sapNo || '').trim();
        const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
        return (cleanSerial && cleanSerial !== '-' && cleanSerial !== 'yok') &&
          (turbineUsageMap.has(`${rawSap}___${cleanSerial}`) || turbineUsageMap.has(`${cleanSap}___${cleanSerial}`));
      });

      const allUsed = usedItems.length === grp.items.length && grp.items.length > 0;
      const someUsed = usedItems.length > 0 && !allUsed;

      let statusBadge = `
        <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">
          <i class="fa-solid fa-truck-fast"></i> Sevk Edildi (${grp.items.length} Kalem)
        </span>
      `;

      if (allUsed) {
        statusBadge = `
          <span style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.5); padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(20,241,149,0.25);">
            <i class="fa-solid fa-bolt" style="color: #00f3ff;"></i> TÜRBİNDE TAKILI (${grp.items.length}/${grp.items.length})
          </span>
        `;
      } else if (someUsed) {
        statusBadge = `
          <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-bolt"></i> ${usedItems.length}/${grp.items.length} Türbinde Takılı
          </span>
        `;
      }

      const totalQuantity = grp.items.reduce((sum, i) => sum + (i.quantity || 1), 0);

      const query = ((window as any)._workshopDispatchSearch || '').trim();
      const cleanQ = normalizeKey(query);

      // If query matches dispatchNo or targetWarehouseName, show all items; otherwise filter items matching the search query
      const isGroupLevelMatch = !cleanQ || 
        (grp.dispatchNo && grp.dispatchNo !== '-' && normalizeKey(grp.dispatchNo).includes(cleanQ)) ||
        normalizeKey(grp.targetWarehouseName).includes(cleanQ);

      const displayItems = isGroupLevelMatch ? grp.items : grp.items.filter(item => {
        const s = normalizeKey(item.serialNo || '');
        const sap = normalizeKey(item.sapNo || '');
        const desc = normalizeKey(item.description || '');
        const note = normalizeKey(item.repairNotes || '') + ' ' + normalizeKey(item.faultDesc || '');
        const fault = normalizeKey(item.faultCode || '');
        return s.includes(cleanQ) || sap.includes(cleanQ) || desc.includes(cleanQ) || note.includes(cleanQ) || fault.includes(cleanQ);
      });

      return `
        <!-- MASTER FORM ROW -->
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'">
          
          <!-- 1. FORM NO & TOGGLE -->
          <td style="padding: 0.9rem 1rem; vertical-align: middle; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <button onclick="window.toggleDispatchGroup('${grp.groupId}')" style="background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.35); color: #10B981; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; flex-shrink: 0; transition: all 0.2s;" title="Malzemeleri Göster / Gizle">
                <i class="fa-solid fa-chevron-up" id="chevron-${grp.groupId}"></i>
              </button>
              <div>
                <span style="font-family: monospace; font-weight: 900; font-size: 1.05rem; color: #10B981; letter-spacing: 0.5px;">
                  #${grp.dispatchNo}
                </span>
                <div style="font-size: 0.72rem; color: #64748B; margin-top: 1px;">
                  MTA Çıkış Formu
                </div>
              </div>
            </div>
          </td>

          <!-- 2. HEDEF SANTRAL & TARİH -->
          <td style="padding: 0.9rem 1rem; vertical-align: middle;">
            <div style="font-weight: 800; color: #F8FAFC; font-size: 0.95rem; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c; flex-shrink: 0;"></i>
              <span>${grp.targetWarehouseName}</span>
            </div>
            <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 3px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span><i class="fa-regular fa-calendar-check" style="color: #10B981; margin-right: 4px;"></i>${formatDateTime(grp.dispatchedAt)}</span>
              <span style="color: #475569;">•</span>
              <span><i class="fa-solid fa-user-check" style="margin-right: 4px;"></i>${formatDisplayName(grp.dispatchedBy)}</span>
            </div>
          </td>

          <!-- 3. DURUM -->
          <td style="padding: 0.9rem 1rem; white-space: nowrap; vertical-align: middle;">
            ${statusBadge}
          </td>

          <!-- 4. AKSİYONLAR (SEVK FORMU) -->
          <td style="padding: 0.9rem 1rem; text-align: right; white-space: nowrap; vertical-align: middle;">
            <div style="display: inline-flex; align-items: center; justify-content: flex-end; gap: 6px;">
              <!-- TEK SEVK FORMU PDF İNDİR -->
              <button 
                type="button"
                onclick="window.downloadDispatchPDF('${grp.groupId}')" 
                style="background: linear-gradient(135deg, rgba(59, 130, 246, 0.25) 0%, rgba(37, 99, 235, 0.25) 100%); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.5); padding: 4px 12px; border-radius: 6px; font-size: 0.74rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; height: 26px; min-height: unset; box-sizing: border-box; line-height: 1; transition: all 0.15s;" 
                onmouseover="this.style.filter='brightness(1.2)'"
                onmouseout="this.style.filter='none'"
                title="Bu Sevk Formuna Ait Tüm Malzemeleri Tek Bir PDF'te İndir"
              >
                <i class="fa-solid fa-file-pdf" style="color: #60a5fa;"></i> SEVK FORMU
              </button>
            </div>
          </td>
        </tr>

        <!-- SUBROW: SEVK İÇİNDEKİ MALZEMELERİN LİSTESİ -->
        <tr id="subrow-${grp.groupId}" style="display: table-row;" data-count="${displayItems.length}">
          <td colspan="4" style="padding: 0.6rem 1rem 1.25rem 2.5rem; background: rgba(10, 14, 23, 0.6); border-bottom: 2px solid rgba(16, 185, 129, 0.3);">
            <div style="border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; overflow-x: auto; background: #0B111E; box-shadow: 0 4px 12px rgba(0,0,0,0.5);">
              <div style="background: rgba(255, 255, 255, 0.03); padding: 0.5rem 1rem; border-bottom: 1px solid rgba(255, 255, 255, 0.06); display: flex; justify-content: space-between; align-items: center; min-width: 1150px;">
                <span style="font-size: 0.76rem; font-weight: 800; color: #10B981; text-transform: uppercase; letter-spacing: 0.5px;">
                  <i class="fa-solid fa-boxes-stacked" style="margin-right: 4px;"></i> ${grp.dispatchNo} Sevkine Dahil Olan Malzemeler ${displayItems.length === grp.items.length ? `(${grp.items.length} Kalem)` : `<span style="color: #00f3ff; background: rgba(0, 243, 255, 0.12); border: 1px solid rgba(0, 243, 255, 0.3); padding: 2px 7px; border-radius: 4px; margin-left: 6px; font-size: 0.72rem;"><i class="fa-solid fa-filter" style="font-size: 0.65rem; margin-right: 3px;"></i>${displayItems.length} / ${grp.items.length} Kalem Eşleşti</span>`}
                </span>
                <span style="font-size: 0.72rem; color: #94A3B8;">
                  Hedef: <strong>${grp.targetWarehouseName}</strong>
                </span>
              </div>
              <table style="width: 100%; min-width: 1150px; table-layout: fixed; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                <thead>
                  <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); color: #64748B; font-size: 0.72rem; text-transform: uppercase;">
                    <th style="padding: 0.5rem 0.75rem; width: 40px; text-align: center;">#</th>
                    <th style="padding: 0.5rem 0.75rem; width: 110px;">SAP NO</th>
                    <th style="padding: 0.5rem 0.75rem; width: 130px;">SERİ NO</th>
                    <th style="padding: 0.5rem 0.75rem; width: 280px;">MALZEME TANIMI</th>
                    <th style="padding: 0.5rem 0.75rem; width: 85px; text-align: center;">MİKTAR</th>
                    <th style="padding: 0.5rem 0.75rem; width: 115px;">ARIZA KODU</th>
                    <th style="padding: 0.5rem 0.75rem; width: 190px;">ONARIM NOTU</th>
                    <th style="padding: 0.5rem 0.75rem; width: 140px;">CANLI DURUM</th>
                    <th style="padding: 0.5rem 0.75rem; text-align: right; width: 100px;">İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayItems.map((item, idx) => {
                    const cleanSerial = (item.serialNo || '').trim().toLowerCase();
                    const cleanSap = (item.sapNo || '').trim();
                    const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
                    const usage = (cleanSerial && cleanSerial !== '-' && cleanSerial !== 'yok') 
                      ? (turbineUsageMap.get(`${rawSap}___${cleanSerial}`) || turbineUsageMap.get(`${cleanSap}___${cleanSerial}`)) 
                      : null;

                    return `
                      <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.04); transition: background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 0.6rem 0.75rem; text-align: center; color: #64748B; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
                        <td style="padding: 0.6rem 0.75rem; font-family: monospace; font-weight: 800; color: #00f3ff; vertical-align: middle; white-space: nowrap;">
                          <i class="fa-solid fa-barcode" style="font-size: 0.7rem; margin-right: 3px;"></i> ${item.sapNo}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; font-family: monospace; font-weight: 700; color: #10B981; vertical-align: middle; white-space: nowrap;">
                          <i class="fa-solid fa-microchip" style="font-size: 0.7rem; margin-right: 3px;"></i> ${item.serialNo && item.serialNo !== '-' ? item.serialNo : '-'}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; color: #E2E8F0; font-weight: 600; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.description}">
                          ${item.description}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: center; font-weight: 800; color: #14F195; vertical-align: middle; white-space: nowrap;">
                          ${item.quantity || 1} Adet
                        </td>
                        <td style="padding: 0.6rem 0.75rem; color: #F59E0B; font-family: monospace; font-weight: 700; vertical-align: middle; white-space: nowrap;">
                          ${item.faultCode && item.faultCode !== '-' ? item.faultCode : '-'}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; vertical-align: middle; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                          ${(() => {
                            const statusInfo = getRepairNoteOrTestStatus(item);
                            const badgeBg = statusInfo.isTurbine ? 'rgba(245, 158, 11, 0.15)' : 'rgba(20, 241, 149, 0.15)';
                            const badgeBorder = statusInfo.isTurbine ? 'rgba(245, 158, 11, 0.4)' : 'rgba(20, 241, 149, 0.4)';
                            const badgeColor = statusInfo.isTurbine ? '#F59E0B' : '#14F195';
                            const icon = statusInfo.isTurbine ? 'fa-triangle-exclamation' : 'fa-circle-check';
                            return `
                              <span style="background: ${badgeBg}; border: 1px solid ${badgeBorder}; color: ${badgeColor}; padding: 3px 8px; border-radius: 5px; font-size: 0.72rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap;" title="${statusInfo.text}">
                                <i class="fa-solid ${icon}"></i> ${statusInfo.text}
                              </span>
                            `;
                          })()}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; white-space: nowrap; vertical-align: middle;">
                          ${usage ? `
                            <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;" title="${usage.siteName} ${usage.turbineNo} türbinine ${usage.date} tarihinde takıldı (Rapor: #${usage.reportNo})">
                              <i class="fa-solid fa-bolt"></i> Türbinde: ${usage.siteName ? usage.siteName + ' ' : ''}${usage.turbineNo}
                            </span>
                          ` : item.status === 'COMPLETED' ? `
                            <span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;" title="Saha deposu tarafından sağlam teslim alındı ve envantere eklendi">
                              <i class="fa-solid fa-check-double" style="font-size: 0.65rem;"></i> Depo Stokunda
                            </span>
                          ` : item.status === 'REJECTED' ? `
                            <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;" title="Saha deposunda hasar tespit edildi ve tutanakla MTA'ya iade edildi">
                              <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.65rem;"></i> Hasarlı İade Edildi
                            </span>
                          ` : `
                            <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;" title="MTA'dan sevk edildi, henüz hedef depo tarafından onaylanıp teslim alınmadı">
                              <i class="fa-solid fa-truck" style="font-size: 0.65rem;"></i> Yolda (Kabul Bekliyor)
                            </span>
                          `}
                        </td>
                        <td style="padding: 0.6rem 0.75rem; text-align: right; white-space: nowrap; vertical-align: middle;">
                          <!-- Detay / Pasaport -->
                          <button 
                            type="button" 
                            onclick="window.openCardHistoryModal('${item.id}')" 
                            style="background: rgba(0, 243, 255, 0.1); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.3); padding: 4px 10px; border-radius: 5px; font-size: 0.74rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; height: 26px; box-sizing: border-box; line-height: 1; transition: all 0.15s;" 
                            onmouseover="this.style.background='rgba(0, 243, 255, 0.2)'" 
                            onmouseout="this.style.background='rgba(0, 243, 255, 0.1)'" 
                            title="Kart Süreç Geçmişi & Detay"
                          >
                            <i class="fa-solid fa-circle-info"></i> Detay
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const initialFilteredGroups = filterDispatchGroups();
  const selectedSite = (window as any)._workshopDispatchSiteFilter || 'ALL';

  // Extract unique sites where items were dispatched
  const targetSiteIds = Array.from(new Set(dispatchedItems.map(r => r.targetWarehouseId || r.sourceWarehouseId).filter(Boolean)));

  return `
    <div class="fade-in-up content-area">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #10B981; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-truck-fast" style="margin-right: 0.4rem; color: #10B981;"></i> ATÖLYE SEVK EDİLENLER
            </h2>
            <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 9px; border-radius: 6px; font-size: 0.76rem; font-weight: 800;">
              MTA Sevk & Çıkış Arşivi
            </span>
          </div>
          <p style="color: var(--text-dim); margin: 0.35rem 0 0 0; font-size: 0.88rem;">
            Merkez Tamir Atölyesinde onarımı ve testleri tamamlanarak sahalara geri gönderilmiş tüm revize sağlam malzemelerin arşivi ve resmi sevk formları.
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
          <button onclick="window.exportWorkshopDispatchesExcel()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.12); padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
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
        
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(16, 185, 129, 0.04);">
          <div>
            <div style="font-size: 0.76rem; color: #10B981; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Toplam Sevk Edilen</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #10B981; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${dispatchedItems.length} Adet</div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); display: flex; align-items: center; justify-content: center; color: #10B981; font-size: 1.2rem;">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 12px; border: 1px solid rgba(59, 130, 246, 0.25); display: flex; align-items: center; justify-content: space-between; background: rgba(59, 130, 246, 0.04);">
          <div>
            <div style="font-size: 0.76rem; color: #60a5fa; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Geri Gönderilen Sahalar</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #60a5fa; font-family: 'Rajdhani', sans-serif; margin-top: 2px;">${targetSiteIds.length} Saha</div>
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
          <select onchange="window.setWorkshopDispatchSiteFilter(this.value)" class="cyber-input" style="height: 38px; padding: 0 0.85rem; background: rgba(15, 23, 42, 0.85); border: 1px solid ${selectedSite !== 'ALL' ? '#10B981' : 'rgba(255,255,255,0.1)'}; color: ${selectedSite !== 'ALL' ? '#10B981' : '#FFF'}; font-size: 0.8rem; font-weight: 700; border-radius: 8px; cursor: pointer; min-width: 180px; box-sizing: border-box;">
            <option value="ALL" ${selectedSite === 'ALL' ? 'selected' : ''}>🌐 Tüm Sahalar & Depolar</option>
            ${targetSiteIds.map(sId => {
              const name = warehouses.find(w => w.id === sId)?.name || sId;
              const count = dispatchedItems.filter(r => (r.targetWarehouseId || r.sourceWarehouseId) === sId).length;
              return `<option value="${sId}" ${selectedSite === sId ? 'selected' : ''} style="background: #0B101B; color: #FFF;">${name} (${count} Sevk)</option>`;
            }).join('')}
          </select>
        </div>

        <!-- Live Search Input -->
        <div style="position: relative; width: 320px; height: 38px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
          <input 
            type="text" 
            placeholder="MÇT No, SAP, Seri No, Malzeme veya Saha ara..." 
            value="${(window as any)._workshopDispatchSearch || ''}"
            oninput="window.filterWorkshopDispatches(this.value)" 
            style="width: 100%; height: 38px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #FFF; padding-left: 36px; padding-right: 12px; font-size: 0.82rem; outline: none; box-sizing: border-box;"
          />
        </div>

      </div>

      <!-- Main Dispatches Table -->
      <div class="glass-panel" style="padding: 0.5rem 1rem 1rem 1rem; border-radius: 12px; overflow-x: auto; background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main); font-size: 0.85rem;">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.78rem; text-align: left; text-transform: uppercase; letter-spacing: 0.5px;">
              <th style="padding: 0.9rem 1rem; width: 220px;">SEVK / FORM NO</th>
              <th style="padding: 0.9rem 1rem;">GÖNDERİLEN SAHA & TARİH</th>
              <th style="padding: 0.9rem 1rem; width: 180px;">DURUM</th>
              <th style="padding: 0.9rem 1rem; text-align: right; width: 160px;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="workshop-dispatches-tbody">
            ${renderDispatchRows(initialFilteredGroups)}
          </tbody>
        </table>
      </div>

    </div>
  `;
};
