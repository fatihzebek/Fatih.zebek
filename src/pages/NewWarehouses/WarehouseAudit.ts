import { warehouseState, getUserProfile } from './WarehouseState';
import { db } from '../../firebase';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { excelService } from '../../services/ExcelService';

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
      warehouseState.draftData = {};
      if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
      }
   }
};

export const saveManualAudit = async (btn: HTMLButtonElement) => {
  const manualResults: any[] = [];
  const shelfUpdates: any[] = [];
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

  if (manualResults.length === 0 && shelfUpdates.length === 0) {
    alert('Herhangi bir sayım veya konum bilgisi girilmedi!');
    return;
  }

  const confirmBtn = confirm('Sayımı tamamlamak ve stokları güncellemek istediğinize emin misiniz?');
  if (!confirmBtn) return;

  const originalText = btn.innerText;
  btn.innerText = 'Kaydediliyor...';
  btn.disabled = true;

  try {
    const totalDiff = manualResults.reduce((sum, r) => sum + r.diff, 0);
    const userProfile = getUserProfile();
    const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
    
    if (manualResults.length > 0) {
        await warehouseService.saveAudit(warehouseState.currentWarehouse.id, {
          user: user,
          totalItems: manualResults.length,
          totalDiff: totalDiff,
          results: manualResults
        });
    }

    if (shelfUpdates.length > 0) {
        await Promise.all(
          shelfUpdates.map(update =>
            warehouseService.updateMaterial(warehouseState.currentWarehouse.id, update.itemId, { shelfNo: update.shelfNo })
          )
        );
    }

    try {
      const draftDocRef = doc(db, 'warehouses', warehouseState.currentWarehouse.id, 'active_audit', 'draft');
      await deleteDoc(draftDocRef);
    } catch (e) {
      console.error("Failed to clear Firestore draft on save:", e);
    }

    localStorage.removeItem(`draft_audit_${warehouseState.currentWarehouse.id}`);
    localStorage.removeItem(`draft_audit_start_time_${warehouseState.currentWarehouse.id}`);

    alert('Değişiklikler başarıyla kaydedildi!');
    if ((window as any).selectWarehouseAndNavigate) {
      (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
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

   const confirmBtn = confirm('Sayımı tamamlamak ve stokları güncellemek istediğinize emin misiniz?');
   if (!confirmBtn) return;

   try {
     const totalDiff = warehouseState.auditResults.reduce((sum, r) => sum + r.diff, 0);
     const userProfile = getUserProfile();
     const user = userProfile ? userProfile.displayName || userProfile.email : 'Bilinmeyen Kullanıcı';
     
     await warehouseService.saveAudit(warehouseState.currentWarehouse.id, {
       user: user,
       totalItems: warehouseState.auditResults.length,
       totalDiff: totalDiff,
       results: warehouseState.auditResults
     });

     alert('Sayım başarıyla kaydedildi ve stoklar güncellendi!');
     (window as any).closeQRModal();
     if ((window as any).selectWarehouseAndNavigate) {
       (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
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
       const activeWhId = warehouseState.currentWarehouse.id || 'MTA';
       const audits = await warehouseService.getAuditHistory(activeWhId);
       (window as any).__cachedAudits = audits;
       if (audits.length === 0) {
         container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Henüz sayım geçmişi bulunmuyor.</div>';
       } else {
         container.innerHTML = audits.map(audit => {
           const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : audit.date;
           const diffColor = audit.totalDiff < 0 ? '#EF4444' : (audit.totalDiff > 0 ? '#F59E0B' : '#14F195');
           const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
           
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
             <div class="audit-history-card" style="background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
               <div style="display: flex; justify-content: space-between; align-items: center;">
                 <div onclick="window.toggleAuditDetails('${audit.id}')" style="cursor: pointer; flex-grow: 1; display: flex; align-items: center; gap: 10px;">
                   <i id="audit-toggle-icon-${audit.id}" class="fa-solid fa-chevron-down" style="color: #64748B; font-size: 0.85rem; transition: transform 0.2s;"></i>
                   <div>
                     <div style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem;">${date}</div>
                     <div style="font-size: 0.8rem; color: #64748B;">Sayan: ${audit.user || 'Bilinmeyen'} | Toplam Kalem: ${audit.results?.length || 0}</div>
                   </div>
                 </div>
                 <div style="display: flex; align-items: center; gap: 0.75rem;">
                   <div style="font-family: monospace; font-size: 0.95rem; font-weight: 700; color: ${diffColor}; padding: 0.25rem 0.5rem; background: rgba(255,255,255,0.02); border-radius: 4px;">Fark: ${totalDiffText}</div>
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
   const resultsDiv = document.getElementById('qr-reader-results')!;
   resultsDiv.innerHTML = `
     <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem;">
       <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
       <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">Sistem Stoğu: <strong>${item.quantity}</strong></div>
       
       <div style="margin-bottom: 1rem;">
         <label style="display: block; font-size: 0.85rem; color: #94A3B8; margin-bottom: 0.5rem;">Fiziksel Sayım (Adet)</label>
         <input type="number" id="audit-qty-input" placeholder="Sayım miktarı..." style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
       </div>

       <div id="audit-note-container" style="display: none; margin-bottom: 1rem;">
         <label style="display: block; font-size: 0.85rem; color: #EF4444; margin-bottom: 0.5rem;">Fark Açıklaması (Zorunlu)</label>
         <input type="text" id="audit-note-input" placeholder="Neden eksik/fazla?" style="width: 100%; height: 42px; background-color: rgba(239, 68, 68, 0.1); border: 1px solid #EF4444; border-radius: 8px; color: #FFFFFF; padding: 0 1rem; outline: none;" />
       </div>

       <button id="save-audit-item-btn" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 600; cursor: pointer;">Kaydet ve Devam Et</button>
       <button onclick="window.finishAudit()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Sayımı Bitir</button>
     </div>
   `;

   const qtyInput = document.getElementById('audit-qty-input') as HTMLInputElement;
   const noteContainer = document.getElementById('audit-note-container')!;
   const noteInput = document.getElementById('audit-note-input') as HTMLInputElement;
   const saveBtn = document.getElementById('save-audit-item-btn')!;

   qtyInput.addEventListener('input', () => {
     const val = parseFloat(qtyInput.value);
     if (!isNaN(val) && val !== item.quantity) {
       noteContainer.style.display = 'block';
     } else {
       noteContainer.style.display = 'none';
     }
   });

   saveBtn.addEventListener('click', () => {
     const qty = parseFloat(qtyInput.value);
     if (isNaN(qty)) return alert('Geçerli bir miktar girin.');
     const diff = qty - item.quantity;
     if (diff !== 0 && !noteInput.value.trim()) {
       return alert('Lütfen fark açıklamasını girin!');
     }

     warehouseState.auditResults.push({
       itemId: item.id,
       sapNo: item.sapNo,
       description: item.name,
       systemQty: item.quantity,
       physicalQty: qty,
       diff: diff,
       note: diff !== 0 ? noteInput.value.trim() : ''
     });

     if ((window as any).startScanner) (window as any).startScanner();
   });
};

// Register methods to window
(window as any).changeManualAuditPage = changeManualAuditPage;
(window as any).filterManualAudit = filterManualAudit;
(window as any).renderManualAuditTable = renderManualAuditTable;
(window as any).updateManualSummaryBar = updateManualSummaryBar;
(window as any).onManualQtyChange = onManualQtyChange;
(window as any).saveDraftAudit = saveDraftAudit;
(window as any).clearDraftAudit = clearDraftAudit;
(window as any).saveManualAudit = saveManualAudit;
(window as any).finishAudit = finishAudit;
(window as any).deleteAuditRecord = deleteAuditRecord;
(window as any).loadSayimGecmisi = loadSayimGecmisi;
(window as any).importAuditToInventory = importAuditToInventory;
