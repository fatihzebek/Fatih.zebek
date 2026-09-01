import { warehouseState, getUserProfile } from './WarehouseState';
import { ensureSingleModalInBody } from './WarehouseModals';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { excelService } from '../../services/ExcelService';
import { soundService } from '../../services/SoundService';
import { emailService } from '../../services/EmailService';

export const changeManualAuditPage = (page: number) => {
   warehouseState.currentAuditPage = page;
   renderManualAuditTable();
};

export const filterManualAudit = (query: string) => {
   warehouseState.currentAuditPage = 1;
   renderManualAuditTable();
};

export const renderManualAuditTable = () => {
   const tbody = document.getElementById('manual-audit-tbody');
   if (!tbody) return;

   const searchInput = document.getElementById('manual-audit-search') as HTMLInputElement;
   const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
   
   const auditInventoryItems = warehouseState.currentWarehouse.id === 'MTA'
      ? warehouseState.inventoryItems
      : warehouseState.inventoryItems.filter(item => item.condition !== 'DEFECT');

   // 1. Sort the items
   const sortedItems = [...auditInventoryItems].sort((a, b) => {
      const locA = String(a.shelfNo || '').trim().toUpperCase();
      const locB = String(b.shelfNo || '').trim().toUpperCase();
      if (!locA && locB) return 1;
      if (locA && !locB) return -1;
      let locCmp = 0;
      if (locA && locB) {
          locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
      }
      if (locCmp !== 0) return locCmp;
      const sapA = String(a.sapNo || '').trim();
      const sapB = String(b.sapNo || '').trim();
      if (sapA && sapB) {
          const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
          if (sapCmp !== 0) return sapCmp;
      }
      return String(a.name || '').localeCompare(String(b.name || ''));
   });

   // 2. Filter by search term
   const filteredItems = sortedItems.filter(item => {
      const sap = String(item.sapNo || '').toLowerCase();
      const name = String(item.name || '').toLowerCase();
      return term === '' || sap.includes(term) || name.includes(term);
   });

   const totalItems = filteredItems.length;
   const totalPages = Math.ceil(totalItems / warehouseState.itemsPerPage) || 1;

   if (warehouseState.currentAuditPage > totalPages) warehouseState.currentAuditPage = totalPages;
   if (warehouseState.currentAuditPage < 1) warehouseState.currentAuditPage = 1;

   const startIndex = (warehouseState.currentAuditPage - 1) * warehouseState.itemsPerPage;
   const endIndex = Math.min(startIndex + warehouseState.itemsPerPage, totalItems);
   const paginatedItems = filteredItems.slice(startIndex, endIndex);

   if (paginatedItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #94A3B8;">Aramaya uygun malzeme bulunamadı.</td></tr>`;
   } else {
      tbody.innerHTML = paginatedItems.map(item => {
         const draftQty = warehouseState.draftData[item.id]?.qty || '';
         const draftNote = warehouseState.draftData[item.id]?.note || '';
         const draftShelf = warehouseState.draftData[item.id]?.shelf !== undefined ? warehouseState.draftData[item.id].shelf : (item.shelfNo || '');
         const isNoteVisible = draftQty !== '' && parseFloat(draftQty) !== item.quantity;
         return `
            <tr class="manual-audit-row" data-sap="${item.sapNo.toLowerCase()}" data-name="${item.name.toLowerCase()}">
              <td style="padding: 1rem; color: #94A3B8; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.sapNo}</td>
              <td style="padding: 1rem; color: #E2E8F0; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">${item.name}</td>
              <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                <input type="text" id="manual-shelf-${item.id}" class="manual-audit-shelf" data-id="${item.id}" data-original="${item.shelfNo || ''}" value="${draftShelf}" oninput="window.saveDraftAudit()" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #94A3B8; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Raf No" />
              </td>
              <td style="padding: 1rem; color: #14F195; border-bottom: 1px solid rgba(30, 41, 59, 0.5); font-weight: 600;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</td>
              <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                <input type="number" id="manual-qty-${item.id}" class="manual-audit-input" data-id="${item.id}" data-sap="${item.sapNo}" data-name="${item.name.replace(/"/g, '&quot;')}" data-sysqty="${item.quantity}" oninput="window.onManualQtyChange('manual-qty-${item.id}', 'manual-note-${item.id}', ${item.quantity})" value="${draftQty}" style="width: 100%; height: 36px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.9rem;" placeholder="Sayı..." />
              </td>
              <td style="padding: 0.5rem 1rem; border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
                <input type="text" id="manual-note-${item.id}" value="${draftNote}" oninput="window.saveDraftAudit()" style="display: ${isNoteVisible ? 'block' : 'none'}; width: 100%; height: 36px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #334155; border-radius: 6px; color: #FFFFFF; padding: 0 0.75rem; outline: none; font-size: 0.85rem;" placeholder="Zorunlu Not" />
              </td>
            </tr>
         `;
      }).join('');
   }

   const paginationDiv = document.getElementById('manual-audit-pagination');
   if (paginationDiv) {
      if (totalItems === 0) {
         paginationDiv.innerHTML = '';
         return;
      }
      const showingStart = startIndex + 1;
      const showingEnd = endIndex;
      paginationDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background-color: #111827; border-top: 1px solid #1E293B; flex-wrap: wrap; gap: 1rem;">
          <div style="color: #64748B; font-size: 0.85rem;">
            <span>${totalItems} malzeme arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <button onclick="window.changeManualAuditPage(1)" ${warehouseState.currentAuditPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-angles-left"></i>
            </button>
            <button onclick="window.changeManualAuditPage(${warehouseState.currentAuditPage - 1})" ${warehouseState.currentAuditPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-angle-left"></i>
            </button>
            
            <span style="color: #E2E8F0; font-size: 0.85rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${warehouseState.currentAuditPage} / ${totalPages}</span>
            
            <button onclick="window.changeManualAuditPage(${warehouseState.currentAuditPage + 1})" ${warehouseState.currentAuditPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-angle-right"></i>
            </button>
            <button onclick="window.changeManualAuditPage(${totalPages})" ${warehouseState.currentAuditPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
              <i class="fa-solid fa-angles-right"></i>
            </button>
          </div>
        </div>
      `;
   }
};

export const updateManualSummaryBar = () => {
  let totalCounted = 0;
  let matched = 0;
  let surplus = 0;
  let deficit = 0;

  Object.keys(warehouseState.draftData).forEach((itemId) => {
    const item = warehouseState.inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    const draftItem = warehouseState.draftData[itemId];
    if (draftItem && draftItem.qty !== '') {
      totalCounted++;
      const physicalQty = parseFloat(draftItem.qty);
      const systemQty = item.quantity;
      const diff = physicalQty - systemQty;
      
      if (diff === 0) matched++;
      else if (diff > 0) surplus++;
      else if (diff < 0) deficit++;
    }
  });

  const bar = document.getElementById('manual-summary-bar');
  if (bar) {
    if (totalCounted > 0) {
      bar.innerHTML = `
        <span style="color: #94A3B8; font-weight: 500; margin-right: 1rem;"><i class="fa-solid fa-list-check"></i> ${totalCounted} Ürün Sayıldı</span>
        <span style="color: #14F195; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-check"></i> ${matched} Uyumlu</span>
        <span style="color: #F59E0B; font-weight: 600; margin-right: 1rem;"><i class="fa-solid fa-arrow-trend-up"></i> ${surplus} Fazla</span>
        <span style="color: #EF4444; font-weight: 600;"><i class="fa-solid fa-arrow-trend-down"></i> ${deficit} Eksik</span>
      `;
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }
};

export const onManualQtyChange = async (inputId: string, noteId: string, sysQty: number) => {
  const input = document.getElementById(inputId) as HTMLInputElement;
  const noteInput = document.getElementById(noteId) as HTMLInputElement;
  if (!input || !noteInput) return;
  
  const val = parseFloat(input.value);
  if (!isNaN(val) && val !== sysQty) {
    noteInput.style.display = 'block';
  } else {
    noteInput.style.display = 'none';
    noteInput.value = '';
  }
  
  const itemId = inputId.replace('manual-qty-', '');
  const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
  const shelfVal = shelfInput ? shelfInput.value.trim() : '';
  
  warehouseState.draftData[itemId] = {
    qty: input.value,
    note: noteInput.value.trim(),
    shelf: shelfVal
  };

  if (input.value === '' && shelfVal === (shelfInput ? (shelfInput.dataset.original || '').trim() : '')) {
     delete warehouseState.draftData[itemId];
  }

  let localStartTime = localStorage.getItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`);
  if (!localStartTime) {
     localStartTime = new Date().toISOString();
     localStorage.setItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`, localStartTime);
  }

  if (warehouseState.currentWarehouse) {
    try {
      const userProfile = getUserProfile();
      const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
      const draftDocRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'active_audit', 'draft');
      await setDoc(draftDocRef, {
        draftData: warehouseState.draftData,
        updatedBy: user,
        lastUpdated: serverTimestamp(),
        startTime: localStartTime
      });
    } catch (e) {
      console.error("Failed to save draft to Firestore:", e);
    }
  }

  localStorage.setItem(`draft_audit_${warehouseState.currentWarehouse.id}`, JSON.stringify(warehouseState.draftData));

  updateManualSummaryBar();
};

export const saveDraftAudit = async () => {
   const inputs = document.querySelectorAll('.manual-audit-input');
   const newDraftData = { ...warehouseState.draftData };
   inputs.forEach((input: any) => {
     const itemId = input.dataset.id;
     const shelfInput = document.getElementById('manual-shelf-' + itemId) as HTMLInputElement;
     const shelfVal = shelfInput ? shelfInput.value.trim() : '';
     const originalShelf = shelfInput ? (shelfInput.dataset.original || '').trim() : '';
     const noteInput = document.getElementById('manual-note-' + itemId) as HTMLInputElement;
     const noteVal = noteInput ? noteInput.value.trim() : '';

     if (input.value !== '' || (shelfVal !== originalShelf)) {
       newDraftData[itemId] = { 
           qty: input.value, 
           note: noteVal, 
           shelf: shelfVal 
       };
     } else {
       delete newDraftData[itemId];
     }
   });
   warehouseState.draftData = newDraftData;

   if (warehouseState.currentWarehouse) {
     try {
       const userProfile = getUserProfile();
       const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
       const draftDocRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'active_audit', 'draft');
       await setDoc(draftDocRef, {
         draftData: newDraftData,
         updatedBy: user,
         lastUpdated: serverTimestamp()
       });
     } catch (e) {
       console.error("Failed to save draft to Firestore:", e);
     }
   }

   localStorage.setItem(`draft_audit_${warehouseState.currentWarehouse.id}`, JSON.stringify(warehouseState.draftData));
   updateManualSummaryBar();
};

export const clearDraftAudit = async () => {
   if(confirm('Mevcut sayım taslağını tamamen silip sıfırdan başlamak istediğinize emin misiniz?')) {
      if (warehouseState.currentWarehouse) {
        try {
          const draftDocRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'active_audit', 'draft');
          await deleteDoc(draftDocRef);
        } catch (e) {
          console.error("Failed to clear draft in Firestore:", e);
        }
      }
      localStorage.removeItem(`draft_audit_${warehouseState.currentWarehouse.id}`);
      localStorage.removeItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`);
      warehouseState.draftData = {};
      warehouseState.auditResults = [];
      (window as any).currentDraftData = {};
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
      }
   }
};

export const saveManualAudit = async (btn: HTMLButtonElement) => {
  const manualResults: any[] = [];
  const shelfUpdates: any[] = [];
  const criticalLimitUpdates: any[] = [];
  let hasError = false;
  let firstErrorItemId = '';

  const auditInventoryItems = warehouseState.currentWarehouse.id === 'MTA'
    ? warehouseState.inventoryItems
    : warehouseState.inventoryItems.filter(item => item.condition !== 'DEFECT');

  const sortedItems = [...auditInventoryItems].sort((a, b) => {
     const locA = String(a.shelfNo || '').trim().toUpperCase();
     const locB = String(b.shelfNo || '').trim().toUpperCase();
     if (!locA && locB) return 1;
     if (locA && !locB) return -1;
     let locCmp = 0;
     if (locA && locB) {
         locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
     }
     if (locCmp !== 0) return locCmp;
     const sapA = String(a.sapNo || '').trim();
     const sapB = String(b.sapNo || '').trim();
     if (sapA && sapB) {
         const sapCmp = sapA.localeCompare(sapB, undefined, { numeric: true });
         if (sapCmp !== 0) return sapCmp;
     }
     return String(a.name || '').localeCompare(String(b.name || ''));
  });

  sortedItems.forEach((item) => {
     const draftItem = warehouseState.draftData[item.id];
     
     const qtyVal = draftItem ? draftItem.qty : '';
     const noteVal = draftItem ? draftItem.note : '';
     const shelfVal = draftItem ? draftItem.shelf : (item.shelfNo || '');
     const originalShelf = (item.shelfNo || '').trim();
     
     if (shelfVal.trim() !== originalShelf) {
       shelfUpdates.push({ itemId: item.id, shelfNo: shelfVal.trim() });
     }

     const currentLimit = item.criticalLimit !== undefined ? item.criticalLimit : (item.minStock || 0);
     if (draftItem && draftItem.criticalLimit !== undefined && draftItem.criticalLimit !== '') {
       const newLimit = parseInt(draftItem.criticalLimit);
       if (!isNaN(newLimit) && newLimit !== currentLimit) {
         criticalLimitUpdates.push({ itemId: item.id, criticalLimit: newLimit });
       }
     }

     if (qtyVal !== '') {
       const qty = parseFloat(qtyVal);
       const diff = qty - item.quantity;
       if (diff !== 0 && !noteVal.trim()) {
         hasError = true;
         if (!firstErrorItemId) firstErrorItemId = item.id;
       }
       
       manualResults.push({
         itemId: item.id,
         sapNo: item.sapNo,
         description: item.name || item.description || '-',
         systemQty: item.quantity,
         physicalQty: qty,
         diff: diff,
         note: diff !== 0 ? noteVal.trim() : '',
         shelfNo: shelfVal
       });
     } else {
       manualResults.push({
         itemId: item.id,
         sapNo: item.sapNo,
         description: item.name || item.description || '-',
         systemQty: item.quantity,
         physicalQty: item.quantity,
         diff: 0,
         note: '',
         shelfNo: shelfVal
       });
     }
  });

  if (hasError) {
    alert('Farklı çıkan sayımlar için açıklama yazılması zorunludur!');
    const errorEl = document.getElementById(`manual-note-${firstErrorItemId}`);
    errorEl?.focus();
    return;
  }

  if (manualResults.length === 0 && shelfUpdates.length === 0 && criticalLimitUpdates.length === 0) {
    alert('Herhangi bir sayım veya konum bilgisi girilmedi!');
    return;
  }

  const confirmBtn = confirm('Sayımı tamamlayıp Sayım Raporunu yöneticilere (Fatih Zebek, Hurşit Akter, Emir Ünver) iletmek istediğinize emin misiniz?');
  if (!confirmBtn) return;

  const originalText = btn.innerText;
  btn.innerText = 'Rapor İletiliyor...';
  btn.disabled = true;

  try {
    const totalDiff = manualResults.reduce((sum, r) => sum + r.diff, 0);
    const discrepancies = manualResults.filter(r => r.diff !== 0);
    const compliantCount = manualResults.filter(r => r.diff === 0).length;
    const surplusCount = manualResults.filter(r => r.diff > 0).length;
    const deficitCount = manualResults.filter(r => r.diff < 0).length;

    const userProfile = getUserProfile();
    const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
    const userEmail = userProfile?.email || '';
    const team = userProfile?.team || '';
    const warehouseName = warehouseState.currentWarehouse.name || warehouseState.currentWarehouse.id;
    const warehouseId = warehouseState.currentWarehouse.id;

    if (manualResults.length > 0) {
        await warehouseService.saveAudit(warehouseId, {
          user: user,
          userEmail: userEmail,
          team: team,
          totalItems: manualResults.length,
          totalDiff: totalDiff,
          discrepantItems: discrepancies.length,
          surplusItems: surplusCount,
          deficitItems: deficitCount,
          results: manualResults,
          status: 'PENDING_APPROVAL'
        }, false);
    }

    if (shelfUpdates.length > 0) {
        await Promise.all(
          shelfUpdates.map(update =>
            warehouseService.updateMaterial(warehouseId, update.itemId, { shelfNo: update.shelfNo })
          )
        );
    }

    if (criticalLimitUpdates.length > 0) {
        await Promise.all(
          criticalLimitUpdates.map(update =>
            warehouseService.updateMaterial(warehouseId, update.itemId, { criticalLimit: update.criticalLimit })
          )
        );
    }

    // Send email report to Fatih Zebek, Hurşit Akter, Emir Ünver
    try {
      await emailService.sendAuditReportEmail({
        warehouseName: warehouseName,
        warehouseId: warehouseId,
        user: user,
        date: new Date().toLocaleDateString('tr-TR'),
        time: new Date().toLocaleTimeString('tr-TR'),
        totalItems: manualResults.length,
        compliantItems: compliantCount,
        surplusItems: surplusCount,
        deficitItems: deficitCount,
        totalDiff: totalDiff,
        discrepancies: discrepancies
      });
    } catch (mailErr) {
      console.error("Failed to send audit report email:", mailErr);
    }

    alert('Sayım Raporu yöneticilere (Fatih Zebek, Hurşit Akter, Emir Ünver) e-posta olarak iletildi!\n\nYöneticiler sayımı onaylayana kadar sayım ekranındaki verileriniz korunmaktadır. Düzeltme gerekirse sayıları güncelleyip tekrar rapor gönderebilirsiniz.');
    btn.innerText = originalText;
    btn.disabled = false;

    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(warehouseId, 'SAYIM_GECMISI');
    }
  } catch (err) {
    console.error(err);
    alert('Kaydedilirken hata oluştu.');
    btn.innerText = originalText;
    btn.disabled = false;
  }
};

export const finishAudit = async () => {
   if (warehouseState.auditResults.length === 0) {
     (window as any).closeQRModal();
     return;
   }

   const confirmBtn = confirm('Sayımı tamamlayıp Sayım Raporunu yöneticilere (Fatih Zebek, Hurşit Akter, Emir Ünver) iletmek istediğinize emin misiniz?');
   if (!confirmBtn) return;

   try {
     const totalDiff = warehouseState.auditResults.reduce((sum, r) => sum + r.diff, 0);
     const discrepancies = warehouseState.auditResults.filter(r => r.diff !== 0);
     const compliantCount = warehouseState.auditResults.filter(r => r.diff === 0).length;
     const surplusCount = warehouseState.auditResults.filter(r => r.diff > 0).length;
     const deficitCount = warehouseState.auditResults.filter(r => r.diff < 0).length;

     const userProfile = getUserProfile();
     const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
     const userEmail = userProfile?.email || '';
     const team = userProfile?.team || '';
     const warehouseName = warehouseState.currentWarehouse.name || warehouseState.currentWarehouse.id;
     const warehouseId = warehouseState.currentWarehouse.id;

     await warehouseService.saveAudit(warehouseId, {
       user: user,
       userEmail: userEmail,
       team: team,
       totalItems: warehouseState.auditResults.length,
       totalDiff: totalDiff,
       discrepantItems: discrepancies.length,
       surplusItems: surplusCount,
       deficitItems: deficitCount,
       results: warehouseState.auditResults,
       status: 'PENDING_APPROVAL'
     }, false);

     // Send email report to managers
     try {
       await emailService.sendAuditReportEmail({
         warehouseName: warehouseName,
         warehouseId: warehouseId,
         user: user,
         date: new Date().toLocaleDateString('tr-TR'),
         time: new Date().toLocaleTimeString('tr-TR'),
         totalItems: warehouseState.auditResults.length,
         compliantItems: compliantCount,
         surplusItems: surplusCount,
         deficitItems: deficitCount,
         totalDiff: totalDiff,
         discrepancies: discrepancies
       });
     } catch (mailErr) {
       console.error("Failed to send QR audit report email:", mailErr);
     }

     alert('Sayım Raporu yöneticilere iletildi!\n\nYöneticiler sayımı onaylayana kadar sayım ekranındaki verileriniz korunmaktadır.');
     (window as any).closeQRModal();
     if ((window as any).selectWarehouseAndNavigate) {
       (window as any).selectWarehouseAndNavigate(warehouseId, 'SAYIM_GECMISI');
     }
   } catch (error) {
     console.error(error);
     alert('Sayım kaydedilirken bir hata oluştu.');
   }
};

export const deleteAuditRecord = async (auditId: string) => {
   if (!confirm('Bu sayım geçmişi kaydını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
   try {
      await warehouseService.deleteAudit(warehouseState.currentWarehouse.id, auditId);
      alert('Sayım geçmişi başarıyla silindi.');
      if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id, 'SAYIM_GECMISI');
      }
   } catch (err) {
      console.error(err);
      alert('Silinirken hata oluştu.');
   }
};

export const loadSayimGecmisi = async () => {
   const container = document.getElementById('audit-history-container');
   if (container) {
     container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
     try {
       const currentUser = getUserProfile();
       const isApprover = currentUser?.email === 'fatih.zebek@demirerholding.com' || currentUser?.email === 'hursit.akter@demirerholding.com' || currentUser?.email === 'emir.unver@demirerholding.com' || currentUser?.role === 'ADMIN' || (currentUser?.email?.includes('fatih.zebek') ?? false);

       const activeWhId = warehouseState.currentWarehouse.id || 'MTA';
       const audits = await warehouseService.getAuditHistory(activeWhId);
       (window as any).__cachedAudits = audits;
       const latestPendingAudit = audits.find(a => a.status !== 'APPROVED');

       if (audits.length === 0) {
         container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Henüz sayım geçmişi bulunmuyor.</div>';
       } else {
         container.innerHTML = audits.map(audit => {
           const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
           const diffColor = audit.totalDiff < 0 ? '#EF4444' : (audit.totalDiff > 0 ? '#F59E0B' : '#14F195');
           const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
           const isApproved = audit.status === 'APPROVED';
           const isRevisionRequested = audit.status === 'REVISION_REQUESTED';
           const isLatestPending = !isApproved && (audit.id === latestPendingAudit?.id);
           
           const sortedResults = [...audit.results].map(r => {
              let shelfNo = r.shelfNo || '';
              if (!shelfNo && warehouseState.inventoryItems) {
                const invItem = warehouseState.inventoryItems.find((i: any) => i.sapNo === r.sapNo || (i.sapNo === '' && i.name === r.description));
                if (invItem) shelfNo = invItem.shelfNo || '';
              }
              return { ...r, calculatedShelfNo: shelfNo };
           }).sort((a, b) => {
              const locA = String(a.calculatedShelfNo || '').trim().toUpperCase();
              const locB = String(b.calculatedShelfNo || '').trim().toUpperCase();
              if (!locA && locB) return 1;
              if (locA && !locB) return -1;
              let locCmp = 0;
              if (locA && locB) {
                  locCmp = locA.localeCompare(locB, undefined, { numeric: true, sensitivity: 'base' });
              }
              if (locCmp !== 0) return locCmp;
              return String(a.sapNo || '').localeCompare(String(b.sapNo || ''));
           });

           return `
             <div class="audit-history-card" style="background-color: #0A0E17; border: 1px solid ${isApproved ? '#1E293B' : (isRevisionRequested ? 'rgba(239, 68, 68, 0.4)' : (isLatestPending ? 'rgba(245, 158, 11, 0.4)' : 'rgba(255,255,255,0.06)'))}; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
               <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                 <div onclick="window.toggleAuditDetails('${audit.id}')" style="cursor: pointer; flex-grow: 1; display: flex; align-items: center; gap: 10px;">
                   <i id="audit-toggle-icon-${audit.id}" class="fa-solid fa-chevron-down" style="color: #64748B; font-size: 0.85rem; transition: transform 0.2s;"></i>
                   <div>
                     <div style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                       <span>${date}</span>
                       ${isApproved ? `
                         <span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.35); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                           <i class="fa-solid fa-check-double"></i> Onaylandı ${audit.approvedBy ? `(${audit.approvedBy})` : ''}
                         </span>
                       ` : isLatestPending ? `
                         ${isRevisionRequested ? `
                           <span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                             <i class="fa-solid fa-triangle-exclamation"></i> Düzeltme İstendi (${audit.revisionRequestedBy || 'Yönetici'})
                           </span>
                         ` : `
                           <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                             <i class="fa-solid fa-clock"></i> Onay Bekliyor (En Son Sayım)
                           </span>
                         `}
                       ` : `
                         <span style="background: rgba(148, 163, 184, 0.1); color: #94A3B8; border: 1px solid rgba(148, 163, 184, 0.2); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">
                           <i class="fa-solid fa-box-archive"></i> Eski Sayım (Arşiv)
                         </span>
                       `}
                     </div>
                     <div style="font-size: 0.8rem; color: #64748B; margin-top: 2px;">
                       Sayan: ${audit.user || 'Bilinmeyen'} ${audit.team ? `(${audit.team})` : ''} | Toplam Kalem: ${audit.results?.length || 0}
                     </div>
                     ${audit.revisionNote ? `
                       <div style="margin-top: 6px; padding: 6px 10px; background: rgba(245, 158, 11, 0.08); border-left: 3px solid #F59E0B; border-radius: 4px; font-size: 0.78rem; color: #FCD34D;">
                         <strong>📢 Yönetici Talimatı (${audit.revisionRequestedBy}):</strong> "${audit.revisionNote}"
                       </div>
                     ` : ''}
                   </div>
                 </div>
                 <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                   <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: ${diffColor}; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px;">Fark: ${totalDiffText}</div>
                   
                   ${(isLatestPending && isApprover) ? `
                     <button onclick="window.openAuditRevisionModal('${audit.id}')" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); padding: 5px 11px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; font-family: 'Rajdhani', sans-serif;" title="Ekibe düzeltme ve yeniden sayım talebi ilet">
                       <i class="fa-solid fa-rotate-left"></i> Düzeltme İste
                     </button>
                     <button onclick="window.approveAndApplyAuditStock('${audit.id}')" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; border: none; padding: 5px 12px; border-radius: 6px; font-size: 0.76rem; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; box-shadow: 0 0 10px rgba(20,241,149,0.25); font-family: 'Rajdhani', sans-serif;" title="Sayımı onayla ve depo stoklarını güncelle">
                       <i class="fa-solid fa-bolt"></i> Stokları Güncelle & Onayla
                     </button>
                   ` : ''}

                   <button onclick="window.downloadSingleAuditExcel('${audit.id}')" style="background: transparent; border: 1px solid rgba(16, 185, 129, 0.3); color: #10B981; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; display: inline-flex; align-items: center; gap: 4px;" onmouseover="this.style.background='rgba(16, 185, 129, 0.1)'" onmouseout="this.style.background='transparent'">
                     <i class="fa-solid fa-file-excel"></i> Excel
                   </button>
                 </div>
               </div>
               
               <div id="audit-details-${audit.id}" style="overflow-x: auto; max-height: 350px; overflow-y: auto; display: none; margin-top: 1rem; border-top: 1px solid #1E293B; padding-top: 1rem;">
                 <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
                   <thead>
                     <tr style="border-bottom: 1px solid #1E293B; color: #64748B;">
                       <th style="padding: 0.5rem;">Konum</th>
                       <th style="padding: 0.5rem;">SAP No</th>
                       <th style="padding: 0.5rem;">Tanım</th>
                       <th style="padding: 0.5rem; text-align: right;">Sistem</th>
                       <th style="padding: 0.5rem; text-align: right;">Fiziksel</th>
                       <th style="padding: 0.5rem; text-align: right;">Fark</th>
                       <th style="padding: 0.5rem;">Açıklama</th>
                     </tr>
                   </thead>
                   <tbody>
                     ${sortedResults.map(r => {
                       const diff = r.diff;
                       const diffText = diff > 0 ? '+' + diff : diff;
                       const diffCl = diff < 0 ? '#EF4444' : (diff > 0 ? '#F59E0B' : '#14F195');
                       return `
                         <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td style="padding: 0.4rem 0.5rem; color: #94A3B8;">${r.calculatedShelfNo || '-'}</td>
                           <td style="padding: 0.4rem 0.5rem; font-family: monospace; color: #FFF;">${r.sapNo}</td>
                           <td style="padding: 0.4rem 0.5rem; color: #E2E8F0; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.description}">${r.description}</td>
                           <td style="padding: 0.4rem 0.5rem; text-align: right; color: #FFF;">${r.systemQty}</td>
                           <td style="padding: 0.4rem 0.5rem; text-align: right; color: #FFF;">${r.physicalQty}</td>
                           <td style="padding: 0.4rem 0.5rem; text-align: right; font-weight: 700; color: ${diffCl};">${diffText}</td>
                           <td style="padding: 0.4rem 0.5rem; color: #94A3B8; font-size: 0.75rem;">${r.note || ''}</td>
                         </tr>
                        `;
                     }).join('')}
                   </tbody>
                 </table>
               </div>
             </div>
           `;
         }).join('');
       }
     } catch (err: any) {
       console.error(err);
       container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu: ${err.message}</div>`;
     }
   }
};

export const importAuditToInventory = async (auditId: string) => {
  if(!confirm('Bu sayım geçmişindeki ürünleri mevcut envantere direkt eklemek istediğinize emin misiniz? (Envanterde varsa güncellenir, yoksa yeni eklenir)')) return;
  const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
  if(!audit) return;

  const overlay = document.createElement('div');
  overlay.id = 'audit-transfer-progress-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(10,14,23,0.94); z-index:999999; display:flex; flex-direction:column; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 2rem; box-sizing: border-box; transition: all 0.3s ease;';
  
  overlay.innerHTML = `
    <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2.5rem; text-align: center; border-top: 4px solid var(--accent-cyan); box-shadow: 0 20px 50px rgba(0,0,0,0.8); display: flex; flex-direction: column; align-items: center; gap: 1.5rem; background: #111827; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08);">
      <div style="color: #00f2ff; text-shadow: 0 0 12px rgba(0,242,255,0.4);">
        <i class="fa-solid fa-cloud-arrow-up fa-spin-pulse" style="font-size: 3rem;"></i>
      </div>
      
      <div>
        <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0 0 0.5rem 0; font-weight: 800; letter-spacing: 2px; color: #fff;">SAYIM VERİLERİ AKTARILIYOR</h3>
        <p style="font-size: 0.8rem; color: #94A3B8; margin: 0; line-height: 1.4;">Sayım sonuçları toplu işlemle sistem envanterine işleniyor. Lütfen tarayıcınızı kapatmayınız.</p>
      </div>
      
      <div style="width: 100%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); height: 12px; border-radius: 6px; overflow: hidden; position: relative;">
        <div id="transfer-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f2ff, #00ff87); transition: width 0.1s ease; border-radius: 6px;"></div>
      </div>
      
      <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 2rem; color: #00f2ff; text-shadow: 0 0 10px rgba(0,242,255,0.35);">
        <span id="transfer-progress-percent">0%</span>
      </div>
      
      <div style="font-size: 0.8rem; font-weight: 700; color: #94A3B8; font-family: monospace; letter-spacing: 0.5px;">
        İşlenen: <span id="transfer-progress-counter" style="color: #fff;">0 / 0</span>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  
  try {
    let addedCount = 0;
    let updatedCount = 0;

    const itemsToUpdate = audit.results.filter((res: any) => {
      const existingItem = warehouseState.inventoryItems.find((item: any) => item.sapNo === res.sapNo || (item.sapNo === '' && item.name === res.description));
      if (!existingItem) return true;
      return existingItem.quantity !== res.physicalQty;
    });

    const totalToUpdate = itemsToUpdate.length;

    const progressPercentEl = document.getElementById('transfer-progress-percent');
    const progressBarEl = document.getElementById('transfer-progress-bar');
    const progressCounterEl = document.getElementById('transfer-progress-counter');
    
    if (progressCounterEl) progressCounterEl.innerText = `0 / ${totalToUpdate}`;

    if (totalToUpdate > 0) {
      for (let i = 0; i < totalToUpdate; i++) {
        const res = itemsToUpdate[i];
        const existingItem = warehouseState.inventoryItems.find((item: any) => item.sapNo === res.sapNo || (item.sapNo === '' && item.name === res.description));

        if (existingItem) {
           await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, existingItem.id, { quantity: res.physicalQty });
           updatedCount++;
        } else {
           await warehouseService.addMaterial(warehouseState.currentWarehouse.id, {
              sapNo: res.sapNo || '',
              description: res.description || 'Bilinmeyen Malzeme',
              quantity: res.physicalQty,
              shelfNo: 'Tanımsız'
           });
           addedCount++;
        }

        const pct = Math.round(((i + 1) / totalToUpdate) * 100);
        if (progressPercentEl) progressPercentEl.innerText = `${pct}%`;
        if (progressBarEl) progressBarEl.style.width = `${pct}%`;
        if (progressCounterEl) progressCounterEl.innerText = `${i + 1} / ${totalToUpdate}`;

        await new Promise(resolve => setTimeout(resolve, 10));
      }
    } else {
      if (progressPercentEl) progressPercentEl.innerText = '100%';
      if (progressBarEl) progressBarEl.style.width = '100%';
      if (progressCounterEl) progressCounterEl.innerText = '0 / 0';
    }
    
    await warehouseService.updateAudit(warehouseState.currentWarehouse.id, auditId, { imported: true });
    
    if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err: any) {
    console.error(err);
    alert('Aktarım sırasında hata oluştu: ' + (err?.message || err));
  } finally {
    overlay.remove();
  }
};

export const showAuditInput = (item: any) => {
   const modal = ensureSingleModalInBody('qr-modal');
   const resultsDiv = (modal ? modal.querySelector('#qr-reader-results') : document.getElementById('qr-reader-results')) as HTMLElement;
   if (!resultsDiv) return;

   const existingDraft = warehouseState.draftData[item.id];
   const currentDraftQty = existingDraft ? existingDraft.qty : '';
   const currentDraftNote = existingDraft ? existingDraft.note : '';
   const existingMinStock = existingDraft && existingDraft.criticalLimit !== undefined 
     ? existingDraft.criticalLimit 
     : (item.criticalLimit !== undefined ? item.criticalLimit : (item.minStock !== undefined ? item.minStock : ''));

   resultsDiv.innerHTML = `
     <div style="background: #1E293B; border-radius: 12px; padding: 1.25rem; margin-top: 1rem; border: 1px solid #14F195; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.15);">
       <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 0.75rem;">
         <div style="text-align: left;">
           <h4 style="color: #FFFFFF; margin: 0 0 0.25rem 0; font-size: 1.05rem;">${item.name || item.description || ''}</h4>
           <div style="color: #94A3B8; font-size: 0.85rem;">SAP No: <strong style="color: #14F195;">${item.sapNo}</strong></div>
         </div>
         <div style="text-align: right; background: #0A0E17; border: 1px solid #334155; padding: 0.35rem 0.65rem; border-radius: 6px;">
           <div style="font-size: 0.7rem; color: #94A3B8; text-transform: uppercase;">Sistem Stoğu</div>
           <div style="font-size: 1rem; font-weight: 700; color: #14F195;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</div>
         </div>
       </div>
       
       <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem; text-align: left;">
         <div>
           <label style="display: block; font-size: 0.85rem; color: #E2E8F0; margin-bottom: 0.4rem; font-weight: 600;">Fiziksel Sayım Miktarı</label>
           <input type="number" id="audit-qty-input" value="${currentDraftQty}" placeholder="Sayılan adet..." style="width: 100%; height: 44px; background-color: #0A0E17; border: 2px solid #14F195; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none; font-size: 1.1rem; font-weight: 700;" autofocus />
         </div>
         <div>
           <label style="display: block; font-size: 0.85rem; color: #94A3B8; margin-bottom: 0.4rem; font-weight: 600;">Kritik Stok Limiti <span style="font-size: 0.7rem; color: #64748B;">(Opsiyonel)</span></label>
           <input type="number" id="audit-min-stock-input" min="0" value="${existingMinStock !== '' && existingMinStock !== undefined ? existingMinStock : ''}" placeholder="${item.minStock || item.criticalLimit ? `Mevcut: ${item.minStock || item.criticalLimit}` : 'Limit belirle...'}" style="width: 100%; height: 44px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #F59E0B; padding: 0 1rem; outline: none; font-size: 1.05rem; font-weight: 700;" />
         </div>
       </div>

       <div id="audit-note-container" style="display: ${currentDraftQty !== '' && parseFloat(currentDraftQty) !== item.quantity ? 'block' : 'none'}; margin-bottom: 0.85rem; text-align: left;">
         <label style="display: block; font-size: 0.85rem; color: #EF4444; margin-bottom: 0.4rem; font-weight: 600;">Fark Açıklaması (Zorunlu)</label>
         <input type="text" id="audit-note-input" value="${currentDraftNote}" placeholder="Neden eksik/fazla? Açıklama yazınız..." style="width: 100%; height: 40px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none; font-size: 0.85rem;" />
       </div>

       <button id="save-audit-item-btn" style="width: 100%; padding: 0.85rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 800; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
         <i class="fa-solid fa-check"></i> Kaydet ve Devam Et (Yeni QR)
       </button>
       <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 0.5rem; padding: 0.65rem; border-radius: 8px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif; transition: all 0.2s;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.12)'" onmouseout="this.style.backgroundColor='rgba(255,255,255,0.06)'">
         <i class="fa-solid fa-xmark" style="margin-right: 4px;"></i> Kapat / Sayıma Dön
       </button>
     </div>
   `;

   const qtyInput = document.getElementById('audit-qty-input') as HTMLInputElement;
   const minStockInput = document.getElementById('audit-min-stock-input') as HTMLInputElement;
   const noteContainer = document.getElementById('audit-note-container')!;
   const noteInput = document.getElementById('audit-note-input') as HTMLInputElement;
   const saveBtn = document.getElementById('save-audit-item-btn')!;

   if (qtyInput) {
     setTimeout(() => { qtyInput.focus(); qtyInput.select(); }, 100);
   }

   qtyInput.addEventListener('input', () => {
     const val = parseFloat(qtyInput.value);
     if (!isNaN(val) && val !== item.quantity) {
       noteContainer.style.display = 'block';
     } else {
       noteContainer.style.display = 'none';
     }
   });

   const handleSaveAndNext = async () => {
     const qtyStr = qtyInput.value.trim();
     if (qtyStr === '') return alert('Lütfen geçerli bir miktar girin.');
     const qty = parseFloat(qtyStr);
     if (isNaN(qty) || qty < 0) return alert('Lütfen geçerli pozitif bir miktar girin.');
     
     const diff = qty - item.quantity;
     if (diff !== 0 && !noteInput.value.trim()) {
       return alert('Sistem stoğu ile girdiğiniz adet farklı! Lütfen fark açıklamasını girin.');
     }

     const shelfVal = item.shelfNo || '';
     const noteVal = diff !== 0 ? noteInput.value.trim() : '';

     const minStockStr = minStockInput ? minStockInput.value.trim() : '';
     let parsedMinStock: number | undefined = undefined;
     if (minStockStr !== '') {
       const parsed = parseInt(minStockStr);
       if (!isNaN(parsed) && parsed >= 0) {
         parsedMinStock = parsed;
       }
     }

     // Update critical limit immediately in Firestore & memory so all devices see it instantly
     if (parsedMinStock !== undefined && warehouseState.currentWarehouse?.id) {
       item.criticalLimit = parsedMinStock;
       item.minStock = parsedMinStock;
       const invItem = warehouseState.inventoryItems?.find((i: any) => i.id === item.id);
       if (invItem) {
         invItem.criticalLimit = parsedMinStock;
         invItem.minStock = parsedMinStock;
       }
       try {
         await warehouseService.updateMaterial(warehouseState.currentWarehouse.id, item.id, {
           criticalLimit: parsedMinStock
         });
       } catch (critErr) {
         console.error("Failed to update critical limit immediately:", critErr);
       }
     }

     // 1. Update draftData in memory
     warehouseState.draftData[item.id] = {
       qty: String(qty),
       note: noteVal,
       shelf: shelfVal,
       ...(parsedMinStock !== undefined ? { criticalLimit: parsedMinStock } : (existingDraft?.criticalLimit !== undefined ? { criticalLimit: existingDraft.criticalLimit } : {}))
     };

     // 2. Persist to localStorage & Firestore shared draft
     if (warehouseState.currentWarehouse?.id) {
       localStorage.setItem(`draft_audit_${warehouseState.currentWarehouse.id}`, JSON.stringify(warehouseState.draftData));
       
       let localStartTime = localStorage.getItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`);
       if (!localStartTime) {
          localStartTime = new Date().toISOString();
          localStorage.setItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`, localStartTime);
       }

       try {
         const userProfile = getUserProfile();
         const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
         const draftDocRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'active_audit', 'draft');
         await setDoc(draftDocRef, {
           draftData: warehouseState.draftData,
           updatedBy: user,
           lastUpdated: serverTimestamp(),
           startTime: localStartTime
         });
       } catch (e) {
         console.error("Failed to save draft to Firestore:", e);
       }
     }

     // 3. Keep auditResults in sync
     const existingResIdx = warehouseState.auditResults.findIndex(r => r.itemId === item.id);
     const resData = {
       itemId: item.id,
       sapNo: item.sapNo,
       description: item.name || item.description || '',
       systemQty: item.quantity,
       physicalQty: qty,
       diff: diff,
       note: noteVal,
       shelfNo: shelfVal
     };
     if (existingResIdx >= 0) {
       warehouseState.auditResults[existingResIdx] = resData;
     } else {
       warehouseState.auditResults.push(resData);
     }

     // 4. Update the background table & summary bar
     renderManualAuditTable();
     updateManualSummaryBar();

     // Play success confirmation tone
     soundService.playSuccessSound();

     // 5. Restart scanner for next QR code
     if ((window as any).startScanner) (window as any).startScanner();
   };

   saveBtn.addEventListener('click', handleSaveAndNext);

   // Allow Enter key to quickly save and scan next
   qtyInput.addEventListener('keydown', (e) => {
     if (e.key === 'Enter') {
       if (noteContainer.style.display === 'block' && !noteInput.value.trim()) {
         noteInput.focus();
       } else {
         handleSaveAndNext();
       }
     }
   });

   minStockInput.addEventListener('keydown', (e) => {
     if (e.key === 'Enter') {
       if (noteContainer.style.display === 'block' && !noteInput.value.trim()) {
         noteInput.focus();
       } else {
         handleSaveAndNext();
       }
     }
   });

   noteInput.addEventListener('keydown', (e) => {
     if (e.key === 'Enter') {
       handleSaveAndNext();
     }
   });
};

export const approveAndApplyAuditStock = async (auditId: string) => {
  const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
  if (!audit) {
    alert("Sayım kaydı bulunamadı.");
    return;
  }

  const warehouseName = warehouseState.currentWarehouse?.name || warehouseState.currentWarehouse?.id || 'Depo';
  const confirmApprove = confirm(`Bu sayım sonuçlarını onaylayıp ${warehouseName} stoklarını güncellemek istediğinize emin misiniz?\n\nToplam ${audit.results?.length || 0} kalemin fiziksel sayım miktarları doğrudan envanter stoklarına yansıtılacaktır.`);
  if (!confirmApprove) return;

  try {
    const userProfile = getUserProfile();
    const approver = userProfile ? userProfile.displayName || userProfile.email : 'Yönetici';
    const activeWhId = warehouseState.currentWarehouse.id || 'MTA';

    (window as any).showToast?.('İşlem Yapılıyor', 'Stoklar güncelleniyor ve sayım onaylanıyor...', 'info');
    await warehouseService.approveAuditAndApplyStock(activeWhId, auditId, approver);

    // Completely clear shared draft for this warehouse so next count starts fresh
    try {
      const draftDocRef = doc(db, 'warehouses', activeWhId, 'active_audit', 'draft');
      await deleteDoc(draftDocRef);
    } catch (e) {
      console.error("Failed to clear Firestore draft on approval:", e);
    }

    localStorage.removeItem(`draft_audit_${activeWhId}`);
    localStorage.removeItem(`draft_audit_start_time_${activeWhId}`);
    warehouseState.draftData = {};
    warehouseState.auditResults = [];
    (window as any).currentDraftData = {};

    alert('Sayım başarıyla onaylandı ve depo stokları güncellendi!\n\nSayım ekranı bir sonraki yeni sayım için sıfırlandı.');
    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(activeWhId, 'SAYIM_GECMISI');
    }
  } catch (err: any) {
    console.error(err);
    alert('Onaylama sırasında hata oluştu: ' + (err?.message || err));
  }
};

export const openAuditRevisionModal = (auditId: string) => {
  const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
  if (!audit) {
    alert("Sayım kaydı bulunamadı.");
    return;
  }

  // Remove existing modal if any
  const existing = document.getElementById('audit-revision-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'audit-revision-modal';
  modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(10, 14, 23, 0.85); backdrop-filter: blur(5px); z-index: 9999; display: flex; justify-content: center; align-items: center; padding: 1rem;';

  const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
  const userDisplay = audit.user || 'Sayımı Yapan Ekip';
  const warehouseName = warehouseState.currentWarehouse?.name || warehouseState.currentWarehouse?.id || 'Depo';

  modal.innerHTML = `
    <div style="background: #111827; border: 1px solid #F59E0B; border-radius: 12px; max-width: 580px; width: 100%; padding: 1.5rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 0 20px rgba(245, 158, 11, 0.2); color: #FFF; font-family: 'Rajdhani', sans-serif;">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #1E293B; padding-bottom: 0.75rem; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.15rem; color: #F59E0B; font-weight: 800; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-rotate-left"></i> Sayım Düzeltme & Kontrol Talebi
        </h3>
        <i class="fa-solid fa-xmark" onclick="document.getElementById('audit-revision-modal').remove()" style="cursor: pointer; color: #64748B; font-size: 1.25rem;"></i>
      </div>

      <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 10px 14px; margin-bottom: 1rem; font-size: 0.85rem;">
        <div style="color: #94A3B8;">🏢 Depo: <strong style="color: #FFF;">${warehouseName}</strong></div>
        <div style="color: #94A3B8; margin-top: 3px;">👤 Sayımı Yapan Ekip: <strong style="color: #2563EB;">${userDisplay}</strong> ${audit.userEmail ? `<span style="color: #64748B;">(${audit.userEmail})</span>` : ''}</div>
        <div style="color: #94A3B8; margin-top: 3px;">📅 Sayım Tarihi: <strong style="color: #E2E8F0;">${date}</strong></div>
      </div>

      <div style="margin-bottom: 0.75rem;">
        <label style="display: block; font-size: 0.85rem; font-weight: 700; color: #F59E0B; margin-bottom: 6px;">
          📝 Düzeltme Notu / Ekibe Talimat:
        </label>
        <textarea id="audit-revision-note" rows="4" placeholder="Örn: A-2 rafındaki IGBT modüllerini ve kontaktörleri tekrar kontrol edin, 3 adet eksik görünüyor..." style="width: 100%; box-sizing: border-box; background: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFF; padding: 10px; font-size: 0.9rem; resize: vertical; outline: none; font-family: sans-serif;"></textarea>
      </div>

      <!-- Quick Template Tags -->
      <div style="margin-bottom: 1.25rem;">
        <div style="font-size: 0.75rem; color: #64748B; font-weight: bold; margin-bottom: 4px;">⚡ Hızlı Şablonlar:</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button type="button" onclick="document.getElementById('audit-revision-note').value += 'Eksik çıkan malzemeleri ve kutuları depoda tekrar kontrol edip sayıları güncelleyiniz. '" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;">
            + Eksik Çıkanları Kontrol Edin
          </button>
          <button type="button" onclick="document.getElementById('audit-revision-note').value += 'A ve B raflarındaki kutuları tekrar sayarak farkları düzeltiniz. '" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;">
            + Rafları Tekrar Sayın
          </button>
          <button type="button" onclick="document.getElementById('audit-revision-note').value += 'Sayımlarda büyük fark tespit edilmiştir. Lütfen fiziksel sayımı baştan kontrol ediniz. '" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; padding: 3px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;">
            + Yeniden Kontrol Edin
          </button>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px;">
        <button onclick="document.getElementById('audit-revision-modal').remove()" style="background: transparent; border: 1px solid #475569; color: #94A3B8; padding: 8px 16px; border-radius: 6px; font-weight: 700; cursor: pointer;">
          İptal
        </button>
        <button id="btn-submit-audit-revision" onclick="window.submitAuditRevision('${audit.id}')" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #0A0E17; border: none; padding: 8px 18px; border-radius: 6px; font-weight: 900; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 10px rgba(245, 158, 11, 0.3);">
          <i class="fa-solid fa-paper-plane"></i> Düzeltme Talebini E-Posta ile Gönder
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  document.getElementById('audit-revision-note')?.focus();
};

export const submitAuditRevision = async (auditId: string) => {
  const noteInput = document.getElementById('audit-revision-note') as HTMLTextAreaElement;
  const note = noteInput ? noteInput.value.trim() : '';

  if (!note) {
    alert('Lütfen ekibe iletilecek düzeltme notunu / talimatını yazınız!');
    noteInput?.focus();
    return;
  }

  const audit = (window as any).__cachedAudits?.find((a: any) => a.id === auditId);
  if (!audit) {
    alert('Sayım kaydı bulunamadı.');
    return;
  }

  const btn = document.getElementById('btn-submit-audit-revision') as HTMLButtonElement;
  if (btn) {
    btn.innerText = 'Gönderiliyor...';
    btn.disabled = true;
  }

  try {
    const userProfile = getUserProfile();
    const managerName = userProfile ? userProfile.displayName || userProfile.email : 'Yönetici';
    const activeWhId = warehouseState.currentWarehouse.id || 'MTA';
    const warehouseName = warehouseState.currentWarehouse?.name || warehouseState.currentWarehouse?.id || 'Depo';

    // 1. Update Firestore status to REVISION_REQUESTED
    await warehouseService.requestAuditRevision(activeWhId, auditId, managerName, note);

    // 2. Send official email to the team & managers
    const discrepancies = audit.results?.filter((r: any) => r.diff !== 0) || [];
    await emailService.sendAuditRevisionEmail({
      warehouseName: warehouseName,
      warehouseId: activeWhId,
      user: audit.user || 'Sayım Ekibi',
      userEmail: audit.userEmail || '',
      managerName: managerName,
      note: note,
      date: new Date().toLocaleString('tr-TR'),
      discrepancies: discrepancies
    });

    document.getElementById('audit-revision-modal')?.remove();
    alert(`Düzeltme talebi başarıyla kaydedildi ve ekibe (${audit.user}) e-posta ile iletildi!`);

    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(activeWhId, 'SAYIM_GECMISI');
    }
  } catch (err: any) {
    console.error(err);
    alert('Gönderilirken hata oluştu: ' + (err?.message || err));
    if (btn) {
      btn.innerText = 'Düzeltme Talebini E-Posta ile Gönder';
      btn.disabled = false;
    }
  }
};

// Register methods to window
(window as any).changeManualAuditPage = changeManualAuditPage;
(window as any).filterManualAudit = filterManualAudit;
(window as any).renderManualAuditTable = renderManualAuditTable;
(window as any).updateManualSummaryBar = updateManualSummaryBar;
(window as any).onManualQtyChange = onManualQtyChange;
(window as any).saveDraftAudit = saveDraftAudit;
(window as any).clearDraftAudit = clearDraftAudit;
(window as any).showAuditInput = showAuditInput;
(window as any).saveManualAudit = saveManualAudit;
(window as any).finishAudit = finishAudit;
(window as any).deleteAuditRecord = deleteAuditRecord;
(window as any).loadSayimGecmisi = loadSayimGecmisi;
(window as any).importAuditToInventory = importAuditToInventory;
(window as any).approveAndApplyAuditStock = approveAndApplyAuditStock;
(window as any).openAuditRevisionModal = openAuditRevisionModal;
(window as any).submitAuditRevision = submitAuditRevision;
