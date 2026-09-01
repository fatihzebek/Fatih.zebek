import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { emailService } from '../services/EmailService';
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
  const dispatchedItems = allRepairs.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED');

  (window as any)._allDispatchedRepairs = dispatchedItems;
  (window as any)._workshopDispatchSearch = (window as any)._workshopDispatchSearch || '';
  (window as any)._workshopDispatchSiteFilter = (window as any)._workshopDispatchSiteFilter || 'ALL';

  const filterDispatches = () => {
    const query = ((window as any)._workshopDispatchSearch || '').trim();
    const siteFilter = (window as any)._workshopDispatchSiteFilter || 'ALL';

    return dispatchedItems.filter(rep => {
      // Site filter
      if (siteFilter !== 'ALL') {
        const targetWhId = rep.targetWarehouseId || rep.sourceWarehouseId || '';
        if (targetWhId !== siteFilter) return false;
      }

      // Search query filter with EXACT MATCH priority on Serial and SAP
      if (query) {
        const cleanQ = normalizeKey(query);

        const hasExactMatch = dispatchedItems.some(r => {
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
        const mctMatch = normalizeKey(rep.dispatchNo || rep.mctNo || '').includes(cleanQ);
        const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '';
        const targetWh = warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId || '';
        const whMatch = normalizeKey(sourceWh).includes(cleanQ) || normalizeKey(targetWh).includes(cleanQ);
        const noteMatch = normalizeKey(rep.repairNotes || '').includes(cleanQ) || normalizeKey(rep.faultDesc || '').includes(cleanQ);

        return sapMatch || serialMatch || descMatch || mctMatch || whMatch || noteMatch;
      }

      return true;
    });
  };

  // Handlers
  (window as any).filterWorkshopDispatches = (query: string) => {
    (window as any)._workshopDispatchSearch = query;
    const tbody = document.getElementById('workshop-dispatches-tbody');
    if (tbody) {
      tbody.innerHTML = renderDispatchRows(filterDispatches());
    }
  };

  (window as any).setWorkshopDispatchSiteFilter = (siteId: string) => {
    (window as any)._workshopDispatchSiteFilter = siteId;
    if ((window as any).navigate) {
      (window as any).navigate('workshop-dispatches');
    }
  };

  // Download official Dispatch PDF for a single record
  (window as any).downloadDispatchPDF = async (repairId: string) => {
    const rep = dispatchedItems.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    try {
      (window as any).showToast?.('İşlem', 'Sevk formu PDF olarak hazırlanıyor...', 'info');
      const targetWhName = warehouses.find(w => w.id === (rep.targetWarehouseId || rep.sourceWarehouseId))?.name || 'Saha Deposu';
      
      const pdfFile = await emailService.generateDispatchPDFFile({
        dispatchNo: rep.dispatchNo || rep.mctNo || `MÇT-${Date.now().toString().slice(-5)}`,
        targetWarehouseName: targetWhName,
        senderName: rep.dispatchedBy || currentUser?.displayName || currentUser?.email || 'Fatih Zebek',
        recipientName: 'Hurşit Akter',
        note: rep.repairNotes || 'Tamiri ve testleri tamamlanmış revize sağlam malzeme.',
        items: [{
          sapNo: rep.sapNo,
          description: rep.description,
          quantity: rep.quantity || 1,
          serialNo: rep.serialNo || '-',
          repairNotes: rep.repairNotes || 'Revize Sağlam',
          faultCode: rep.faultCode || '-'
        }]
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

      (window as any).showToast?.('Başarılı', 'Sevk formu PDF olarak indirildi.', 'success');
    } catch(err) {
      console.error(err);
      alert('PDF oluşturulamadı.');
    }
  };

  // Export Excel
  (window as any).exportWorkshopDispatchesExcel = () => {
    const filtered = filterDispatches();
    if (filtered.length === 0) {
      alert("Dışa aktarılacak sevk kaydı bulunamadı.");
      return;
    }

    const excelData = filtered.map((r, idx) => ({
      'SIRA': idx + 1,
      'SEVK / MÇT NO': r.dispatchNo || r.mctNo || '-',
      'SAP NO': r.sapNo,
      'SERİ NO': r.serialNo || '-',
      'MALZEME TANIMI': r.description,
      'ADET': r.quantity || 1,
      'GÖNDERİLEN SAHA': warehouses.find(w => w.id === (r.targetWarehouseId || r.sourceWarehouseId))?.name || r.sourceWarehouseId || '-',
      'SEVK TARİHİ': formatDateTime(r.dispatchedAt || r.completedAt),
      'SEVK EDEN': r.dispatchedBy || r.repairedBy || '-',
      'YAPILAN ONARIM / NOT': r.repairNotes || '-',
      'ARIZA KODU': r.faultCode || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(excelData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sevk Edilenler");
    XLSX.writeFile(wb, `MTA_Sevk_Edilenler_Listesi_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const renderDispatchRows = (items: RepairRecord[]) => {
    if (items.length === 0) {
      return `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3.5rem 1.5rem; color: #94A3B8;">
            <i class="fa-solid fa-box-open" style="font-size: 2.2rem; display: block; margin-bottom: 0.75rem; opacity: 0.4;"></i>
            <div style="font-weight: 700; font-size: 0.95rem; color: #CBD5E1;">Henüz Atölyeden Sevk Edilmiş Malzeme Bulunmuyor</div>
            <div style="font-size: 0.8rem; color: #64748B; margin-top: 4px;">Atölyede onarımı tamamlanan parçaları "Atölye Stoğu" sayfasından sevk edebilirsiniz.</div>
          </td>
        </tr>
      `;
    }

    return items.map(item => {
      const targetWhName = warehouses.find(w => w.id === (item.targetWarehouseId || item.sourceWarehouseId))?.name || item.sourceWarehouseId || 'Saha';
      const dispatchNo = item.dispatchNo || item.mctNo || '-';
      const cleanSerial = (item.serialNo || '').trim().toLowerCase();
      const cleanSap = (item.sapNo || '').trim();
      const rawSap = cleanSap.startsWith('R') ? cleanSap.slice(1) : cleanSap;
      const usage = (cleanSerial && cleanSerial !== '-' && cleanSerial !== 'yok') ? (turbineUsageMap.get(`${rawSap}___${cleanSerial}`) || turbineUsageMap.get(`${cleanSap}___${cleanSerial}`)) : null;

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          
          <!-- 1. MÇT / SEVK NO -->
          <td style="padding: 0.85rem 0.75rem;">
            <span style="background: rgba(16, 185, 129, 0.12); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-family: monospace; font-weight: 800; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-file-invoice"></i> ${dispatchNo}
            </span>
          </td>

          <!-- 2. SAP & SERİ NO -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            <div style="color: #00f3ff; font-family: monospace; font-weight: 800; font-size: 0.85rem;">
              <i class="fa-solid fa-barcode"></i> ${item.sapNo}
            </div>
            <div style="font-size: 0.74rem; color: #10B981; font-family: monospace; font-weight: 700; margin-top: 2px;">
              <i class="fa-solid fa-microchip"></i> Seri: ${item.serialNo && item.serialNo !== '-' ? item.serialNo : '-'}
            </div>
          </td>

          <!-- 3. MALZEME TANIMI & MİKTAR -->
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 800; color: #FFF; font-size: 0.88rem;">${item.description}</div>
            <div style="font-size: 0.74rem; color: #94A3B8; margin-top: 2px;">
              Miktar: <strong style="color: #14F195;">${item.quantity || 1} Adet</strong>
              ${item.faultCode && item.faultCode !== '-' ? ` | <span style="color: #F59E0B;">Arıza: ${item.faultCode}</span>` : ''}
            </div>
          </td>

          <!-- 4. GÖNDERİLEN SAHA -->
          <td style="padding: 0.85rem 0.75rem; color: #E2E8F0; font-size: 0.82rem; font-weight: 700; white-space: nowrap;">
            <div style="display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-charging-station" style="color: #fb923c;"></i>
              <span>${targetWhName}</span>
            </div>
          </td>

          <!-- 5. SEVK TARİHİ & SEVK EDEN -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            <div style="font-weight: 700; color: #CBD5E1; font-size: 0.8rem;">
              <i class="fa-regular fa-calendar-check" style="color: #10B981; margin-right: 3px;"></i> ${formatDateTime(item.dispatchedAt || item.completedAt)}
            </div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">
              <i class="fa-solid fa-user-check" style="margin-right: 3px;"></i> ${item.dispatchedBy || item.repairedBy || 'Merkez Atölye'}
            </div>
          </td>

          <!-- 6. TAMİR / ONARIM NOTU -->
          <td style="padding: 0.85rem 0.75rem; max-width: 260px;">
            ${item.repairNotes ? `
              <div style="font-size: 0.75rem; color: #E2E8F0; background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.1); padding: 4px 8px; border-radius: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.repairNotes}">
                <i class="fa-solid fa-note-sticky" style="color: #14F195; margin-right: 3px;"></i> ${item.repairNotes}
              </div>
            ` : '<span style="color: #64748B; font-size: 0.75rem;">-</span>'}
          </td>

          <!-- 7. DURUM ROZETİ & CANLI TÜRBİN BİLDİRİMİ -->
          <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
            <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 3px 8px; border-radius: 5px; font-weight: 800; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 4px;">
              <i class="fa-solid fa-square-check"></i> Sevk Edildi
            </span>

            ${usage ? `
              <div style="margin-top: 5px;">
                <span style="background: linear-gradient(135deg, rgba(20, 241, 149, 0.18) 0%, rgba(59, 130, 246, 0.18) 100%); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.5); padding: 3px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 900; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(20,241,149,0.25);" title="${usage.siteName} ${usage.turbineNo} türbinine ${usage.date} tarihinde ${usage.personnel} tarafından takıldı (Servis Raporu: #${usage.reportNo})">
                  <i class="fa-solid fa-bolt" style="color: #00f3ff;"></i> TÜRBİNDE TAKILI: ${usage.siteName ? usage.siteName + ' ' : ''}${usage.turbineNo}
                </span>
              </div>
            ` : `
              <div style="margin-top: 5px;">
                <span style="background: rgba(148, 163, 184, 0.1); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.2); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;" title="Malzeme sevk edildiği depoda hazır bekliyor.">
                  <i class="fa-solid fa-boxes-stacked" style="font-size: 0.68rem;"></i> Depo Stokunda
                </span>
              </div>
            `}
          </td>

          <!-- 8. AKSİYONLAR -->
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; align-items: center; gap: 5px;">
              
              <!-- PDF İndir Butonu -->
              <button onclick="window.downloadDispatchPDF('${item.id}')" class="btn-cyber" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Sevk Formu PDF İndir">
                <i class="fa-solid fa-file-pdf"></i> Sevk Formu
              </button>

              <!-- Etiket Yazdır Butonu (Xprinter XP-470B) -->
              <button onclick="window.quickPrintSingleCardLabel('${item.id}')" class="btn-cyber" style="background: rgba(255, 235, 59, 0.12); color: #fef08a; border: 1px solid rgba(255, 235, 59, 0.35); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Xprinter Etiketini Doğrudan Yazdır (80x40 mm)">
                <i class="fa-solid fa-print"></i> Etiket
              </button>

              <!-- Detay Butonu -->
              <button onclick="window.openCardHistoryModal('${item.id}')" style="background: rgba(0, 243, 255, 0.08); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); padding: 4px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Kart Süreç Geçmişi & Pasaport">
                <i class="fa-solid fa-circle-info"></i> Detay
              </button>

            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  const initialFiltered = filterDispatches();
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
              <th style="padding: 1rem 0.75rem; width: 140px;">MÇT / SEVK NO</th>
              <th style="padding: 1rem 0.75rem; width: 140px;">SAP & SERİ NO</th>
              <th style="padding: 1rem 0.75rem;">MALZEME TANIMI</th>
              <th style="padding: 1rem 0.75rem; width: 160px;">GÖNDERİLEN SAHA</th>
              <th style="padding: 1rem 0.75rem; width: 160px;">SEVK TARİHİ & EDEN</th>
              <th style="padding: 1rem 0.75rem;">ONARIM NOTU</th>
              <th style="padding: 1rem 0.75rem; width: 140px;">DURUM</th>
              <th style="padding: 1rem 0.75rem; text-align: right; width: 170px;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="workshop-dispatches-tbody">
            ${renderDispatchRows(initialFiltered)}
          </tbody>
        </table>
      </div>

    </div>
  `;
};
