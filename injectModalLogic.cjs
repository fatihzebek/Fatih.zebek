const fs = require('fs');
let code = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');

const jsLogic = `
(window as any).openAddMaterialModal = (warehouseId: string) => {
  const modal = document.getElementById('add-material-modal');
  if (modal) {
    const wId = document.getElementById('modal-warehouse-id') as HTMLInputElement;
    if (wId) wId.value = warehouseId;
    
    const iId = document.getElementById('modal-item-id') as HTMLInputElement;
    if (iId) iId.value = '';
    
    const sapNo = document.getElementById('modal-sap-no') as HTMLInputElement;
    if (sapNo) sapNo.value = '';
    
    const desc = document.getElementById('modal-description') as HTMLInputElement;
    if (desc) desc.value = '';
    
    const qty = document.getElementById('modal-quantity') as HTMLInputElement;
    if (qty) qty.value = '';
    
    const crit = document.getElementById('modal-critical-limit') as HTMLInputElement;
    if (crit) crit.value = '';
    
    const shelf = document.getElementById('modal-shelf') as HTMLInputElement;
    if (shelf) shelf.value = '';
    
    (window as any).pendingMaterialImage = null;
    
    const previewContainer = document.getElementById('modal-image-preview-container');
    const noImage = document.getElementById('modal-no-image');
    if (previewContainer) previewContainer.style.display = 'none';
    if (noImage) noImage.style.display = 'flex';
    
    const title = document.getElementById('modal-title');
    if (title) title.innerText = 'Yeni Malzeme Kaydı';
    
    modal.style.display = 'flex';
  }
};

(window as any).closeAddMaterialModal = () => {
  const modal = document.getElementById('add-material-modal');
  if (modal) modal.style.display = 'none';
};

(window as any).handleWarehouseFormSubmit = async (e: Event) => {
  e.preventDefault();
  const btn = document.getElementById('modal-submit-btn') as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    const warehouseId = (document.getElementById('modal-warehouse-id') as HTMLInputElement).value;
    const itemId = (document.getElementById('modal-item-id') as HTMLInputElement).value;
    
    const itemData = {
      sapNo: (document.getElementById('modal-sap-no') as HTMLInputElement).value,
      description: (document.getElementById('modal-description') as HTMLInputElement).value,
      quantity: Number((document.getElementById('modal-quantity') as HTMLInputElement).value) || 0,
      criticalLimit: Number((document.getElementById('modal-critical-limit') as HTMLInputElement).value) || 0,
      shelfNo: (document.getElementById('modal-shelf') as HTMLInputElement).value,
      lastUpdated: new Date()
    };

    // Lazy load the service to prevent circular dependencies at top level
    const ws = (await import('../services/WarehouseService')).warehouseService;
    const userProfile = (window as any).currentUser;

    if (itemId) {
      await ws.updateMaterial(warehouseId, itemId, itemData, userProfile?.name || 'Kullanıcı');
    } else {
      await ws.addMaterial(warehouseId, itemData, userProfile?.name || 'Kullanıcı');
    }

    (window as any).invalidateWarehouseCache();
    if ((window as any).updateWarehouseUI) {
      await (window as any).updateWarehouseUI(warehouseId);
    }
    (window as any).closeAddMaterialModal();

    alert('Malzeme başarıyla kaydedildi!');
  } catch (error) {
    console.error('Save failed', error);
    alert('Hata oluştu!');
  } finally {
    if (btn) btn.disabled = false;
  }
};
`;

if (!code.includes('(window as any).openAddMaterialModal =')) {
  code = code.replace('export const WarehousePage = async', jsLogic + '\nexport const WarehousePage = async');
  fs.writeFileSync('src/pages/Warehouses.ts', code);
  console.log('JS injected successfully.');
} else {
  console.log('JS already present.');
}
