const fs = require('fs');
let t = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');

// find the last occurrence of "(window as any).openAddMaterialModal"
const openIdx = t.lastIndexOf('(window as any).openAddMaterialModal');
if (openIdx !== -1) {
    t = t.substring(0, openIdx);
}

t += (window as any).openAddMaterialModal = (warehouseId: string) => {
  const modal = document.getElementById('add-material-modal');
  const whInput = document.getElementById('modal-warehouse-id') as HTMLInputElement;
  const form = document.getElementById('add-material-form') as HTMLFormElement;
  if (modal && whInput) {
    if (form) form.reset();
    const title = document.getElementById('modal-title');
    if (title) title.innerText = 'YENÝ MALZEME EKLE';
    whInput.value = warehouseId;
    const itemInput = document.getElementById('modal-item-id') as HTMLInputElement;
    if (itemInput) itemInput.value = '';
    
    const imgPreview = document.getElementById('modal-image-preview') as HTMLImageElement;
    if (imgPreview) imgPreview.src = '';
    const imgContainer = document.getElementById('modal-image-preview-container');
    if (imgContainer) imgContainer.style.display = 'none';
    const noImg = document.getElementById('modal-no-image-placeholder');
    if (noImg) noImg.style.display = 'flex';
    
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content') as HTMLElement;
    if (content) {
      content.style.transform = 'scale(0.9)';
      setTimeout(() => content.style.transform = 'scale(1)', 10);
    }
  }
};

(window as any).editMaterial = (warehouseId: string, itemId: string) => {
  const material = (window as any).cachedInventory?.find((i: any) => i.id === itemId);
  if (!material) {
      alert('Malzeme bilgisi bulunamadý.');
      return;
  }
  const modal = document.getElementById('add-material-modal');
  const whInput = document.getElementById('modal-warehouse-id') as HTMLInputElement;
  const form = document.getElementById('add-material-form') as HTMLFormElement;
  if (modal && whInput) {
    if (form) form.reset();
    const title = document.getElementById('modal-title');
    if (title) title.innerText = 'MALZEME DÜZENLE';
    whInput.value = warehouseId;
    const itemInput = document.getElementById('modal-item-id') as HTMLInputElement;
    if (itemInput) itemInput.value = itemId;
    
    const sapNoInput = document.getElementById('modal-sap-no') as HTMLInputElement;
    if (sapNoInput) sapNoInput.value = material.sapNo || '';
    
    const descInput = document.getElementById('modal-description') as HTMLInputElement;
    if (descInput) descInput.value = material.description || '';
    
    const qtyInput = document.getElementById('modal-quantity') as HTMLInputElement;
    if (qtyInput) qtyInput.value = material.quantity || 0;
    
    const limitInput = document.getElementById('modal-critical-limit') as HTMLInputElement;
    if (limitInput) limitInput.value = material.criticalLimit || '';
    
    const unitInput = document.getElementById('modal-unit') as HTMLInputElement;
    if (unitInput) unitInput.value = material.unit || 'Adet';
    
    const shelfInput = document.getElementById('modal-shelf-no') as HTMLInputElement;
    if (shelfInput) shelfInput.value = material.shelfNo || '';
    
    const imgPreview = document.getElementById('modal-image-preview') as HTMLImageElement;
    const imgContainer = document.getElementById('modal-image-preview-container');
    const noImg = document.getElementById('modal-no-image-placeholder');
    
    if (material.imageUrl && imgPreview && imgContainer && noImg) {
        imgPreview.src = material.imageUrl;
        imgContainer.style.display = 'block';
        noImg.style.display = 'none';
    } else if (imgPreview && imgContainer && noImg) {
        imgPreview.src = '';
        imgContainer.style.display = 'none';
        noImg.style.display = 'flex';
    }
    
    modal.style.display = 'flex';
    const content = modal.querySelector('.modal-content') as HTMLElement;
    if (content) {
      content.style.transform = 'scale(0.9)';
      setTimeout(() => content.style.transform = 'scale(1)', 10);
    }
  }
};
\n;
fs.writeFileSync('src/pages/Warehouses.ts', t);
