const fs = require('fs');
let code = fs.readFileSync('src/pages/Warehouses.ts', 'utf8');

const jsLogic = `
(window as any).openAddMaterialModal = (warehouseId: string) => {
  const modal = document.getElementById('add-material-modal');
  if (modal) {
    (document.getElementById('modal-warehouse-id') as HTMLInputElement).value = warehouseId;
    (document.getElementById('modal-item-id') as HTMLInputElement).value = '';
    (document.getElementById('modal-sap-no') as HTMLInputElement).value = '';
    (document.getElementById('modal-description') as HTMLInputElement).value = '';
    (document.getElementById('modal-quantity') as HTMLInputElement).value = '';
    (document.getElementById('modal-critical-limit') as HTMLInputElement).value = '';
    (document.getElementById('modal-shelf') as HTMLInputElement).value = '';
    (window as any).pendingMaterialImage = null;
    
    const previewContainer = document.getElementById('modal-image-preview-container');
    const noImage = document.getElementById('modal-no-image');
    if (previewContainer) previewContainer.style.display = 'none';
    if (noImage) noImage.style.display = 'flex';
    
    document.getElementById('modal-title')!.innerText = 'Yeni Malzeme Kaydı';
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

    const ws = require('../services/WarehouseService').warehouseService;
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

if (!code.includes('openAddMaterialModal')) {
  code = code.replace('export const WarehousePage', jsLogic + '\nexport const WarehousePage');
}

const htmlModal = `
      <!-- Add/Edit Material Modal -->
      <div id="add-material-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,8,20,0.9); backdrop-filter: blur(20px); z-index: 10001; align-items: center; justify-content: center;">
        <div class="premium-card modal-content" style="max-width: 720px; width: 95%; max-height: 90vh; overflow-y: auto; overflow-x: hidden; padding: 0; border: 1px solid rgba(100, 255, 218, 0.1); background: #0d1117; box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 28px; position: relative;">
          <div class="modal-inner-content" style="padding: 2.5rem;">
            
            <button type="button" onclick="window.closeAddMaterialModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.4rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>

            <div style="margin-bottom: 2rem;">
              <h3 id="modal-title" style="margin: 0; color: #64ffda; font-size: 1.8rem; font-weight: 700;">Yeni Malzeme Kaydı</h3>
            </div>

            <form id="add-material-form" onsubmit="window.handleWarehouseFormSubmit(event)">
              <input type="hidden" id="modal-warehouse-id">
              <input type="hidden" id="modal-item-id">
              
              <div style="display: grid; gap: 1.5rem;">
                <div>
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;">SAP NUMARASI</label>
                  <input type="text" id="modal-sap-no" required class="cyber-input" placeholder="Örn: 1002345">
                </div>

                <div>
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;">AÇIKLAMA / ÜRÜN ADI</label>
                  <input type="text" id="modal-description" required class="cyber-input" placeholder="Malzeme adını girin...">
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;">MİKTAR</label>
                    <input type="number" id="modal-quantity" required class="cyber-input" placeholder="0">
                  </div>
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;">KRİTİK LİMİT</label>
                    <input type="number" id="modal-critical-limit" class="cyber-input" placeholder="Limit yok">
                  </div>
                </div>

                <div>
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px;">RAF KONUMU</label>
                  <input type="text" id="modal-shelf" class="cyber-input" placeholder="Örn: A-12-3">
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; margin-top: 2rem;">
                <button type="button" onclick="window.closeAddMaterialModal()" class="btn-cyber" style="background: rgba(255,255,255,0.1); color: white; height: 50px;">İPTAL</button>
                <button type="submit" id="modal-submit-btn" class="btn-cyber" style="background: #64ffda; color: #000; height: 50px;">KAYDET</button>
              </div>
            </form>
          </div>
        </div>
      </div>
`;

if (!code.includes('add-material-modal')) {
  code = code.replace('</div>\n      </div>\n`;', htmlModal + '\n</div>\n      </div>\n`;');
}

fs.writeFileSync('src/pages/Warehouses.ts', code);
console.log('Modal injected!');
