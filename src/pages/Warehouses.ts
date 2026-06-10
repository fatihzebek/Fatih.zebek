import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import type { InventoryItem, InventoryLog } from '../services/WarehouseService';

// Global state variables matching the minified bundle's cache
(window as any).lastSortBy = (window as any).lastSortBy || 'sapNo';
(window as any).lastSortDir = (window as any).lastSortDir || 'asc';
(window as any).currentWarehouseId = (window as any).currentWarehouseId || null;
(window as any).pendingMaterialImage = null;
(window as any).cachedWarehouseId = null;
(window as any).cachedInventory = null;
(window as any).cachedReservations = null;
(window as any).cachedTrends = null;
(window as any).cachedOccupancy = null;
(window as any).cachedLogs = null;
(window as any).cachedAudits = null;

(window as any).invalidateWarehouseCache = () => {
  console.log('[Warehouse Cache] Invalidating client-side warehouse cache...');
  (window as any).cachedWarehouseId = null;
  (window as any).cachedInventory = null;
  (window as any).cachedReservations = null;
  (window as any).cachedTrends = null;
  (window as any).cachedOccupancy = null;
  (window as any).cachedLogs = null;
  (window as any).cachedAudits = null;
};

// ... updateWarehouseUI to be implemented later


(window as any).openAddMaterialModal = (warehouseId: string) => {
  const modal = document.getElementById('add-material-modal');
  if (modal) {
    if (modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    const wId = document.getElementById('modal-warehouse-id') as HTMLInputElement;
    if (wId) wId.value = warehouseId;
    
    const iId = document.getElementById('modal-item-id') as HTMLInputElement;
    if (iId) iId.value = '';
    
    const sapNo = document.getElementById('modal-sap-no') as HTMLInputElement;
    if (sapNo) {
      sapNo.value = '';
      sapNo.oninput = async (e) => {
        const val = (e.target as HTMLInputElement).value;
        if (val.length >= 3) {
          const inventory = (window as any).cachedInventory || [];
          let existing = inventory.find((i: any) => i.sapNo === val);
          
          if (!existing && val.length >= 5) {
            existing = await warehouseService.getMaterialInfoBySapGlobally(val);
          }
          
          if (existing) {
            const descInput = document.getElementById('modal-description') as HTMLInputElement;
            if (descInput && !descInput.value) descInput.value = existing.description || '';
            
            const shelfInput = document.getElementById('modal-shelf') as HTMLInputElement;
            if (shelfInput && !shelfInput.value && existing.shelfNo) shelfInput.value = existing.shelfNo;
          }
        }
      };
    }
    
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
      await ws.updateMaterial(warehouseId, itemId, itemData);
    } else {
      await ws.addMaterial(warehouseId, itemData);
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

export const WarehousePage = async (
  warehouseId?: string | null,
  userProfile?: any,
  sortKey: string = 'sapNo',
  sortDir: 'asc' | 'desc' = 'asc',
  searchQuery: string = '',
  tab: 'inventory' | 'history' | 'audit' | 'analytics' | 'audit_history' = 'inventory'
) => {
  if (warehouseId) {
    (window as any).currentWarehouseId = warehouseId;
  }

  const isAdmin = userProfile?.role?.toLowerCase() === 'admin';
  const allowedTabs = userProfile?.allowedTabs?.warehouses || {};
  const hasAddMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.addMaterial);
  const hasEditMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.editMaterial);
  const hasDeleteMaterial = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.deleteMaterial);
  const hasUploadImage = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.uploadImage);
  const hasCountStock = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.countStock);
  const hasUploadExcel = isAdmin || (typeof allowedTabs === 'object' && !!allowedTabs.uploadExcel);

  const allWarehouses = dataService.getWarehouses() || [];
  const accessibleWarehouses = isAdmin 
    ? allWarehouses 
    : allWarehouses.filter(w => userProfile?.allowedWarehouses?.includes(w.id));

  // Sort warehouses naturally or by custom order (like in original code)
  accessibleWarehouses.sort((a, b) => a.name.localeCompare(b.name));

  let inventory: InventoryItem[] = [];
  let logs: InventoryLog[] = [];
  let reservations: any = { bySap: {}, details: [] };
  let trends: any = {};
  let occupancy: any = {};
  let audits: any[] = [];

  const wnd = window as any;

  if (wnd.cachedWarehouseId === warehouseId && wnd.cachedInventory) {
    inventory = wnd.cachedInventory;
    reservations = wnd.cachedReservations || { bySap: {}, details: [] };
    trends = wnd.cachedTrends || {};
    occupancy = wnd.cachedOccupancy || {};
    logs = wnd.cachedLogs || [];
    
    if (warehouseId && tab === 'audit_history') {
      if (wnd.cachedAudits) {
        audits = wnd.cachedAudits;
      } else {
        try {
          audits = await warehouseService.getAuditHistory(warehouseId);
          wnd.cachedAudits = audits;
        } catch(e) {
          console.error(e);
        }
      }
    }
    console.log('[WarehousePage] Serving all data from client-side local cache.');
  } else {
    console.log('[WarehousePage] Cache missing or stale. Fetching fresh data from Firestore.');
    if (warehouseId) {
      try {
        inventory = await warehouseService.getInventory(warehouseId);
        if (wnd.deletedItemIds) {
          inventory = inventory.filter(e => !wnd.deletedItemIds.includes(e.id));
        }
        wnd.cachedWarehouseId = warehouseId;
        wnd.cachedInventory = inventory;
        
        occupancy = await warehouseService.getShelfOccupancy(warehouseId, inventory);
        wnd.cachedOccupancy = occupancy;
        
        reservations = wnd.cachedReservations || { bySap: {}, details: [] };
        logs = wnd.cachedLogs || [];
        trends = wnd.cachedTrends || {};
        
        // Background load logs & reservations
        if (!wnd.bgLoadStartedFor || wnd.bgLoadStartedFor !== warehouseId) {
          wnd.bgLoadStartedFor = warehouseId;
          Promise.all([
            warehouseService.getReservationsFromDrafts(warehouseId),
            warehouseService.getLogs(warehouseId)
          ]).then(async ([res, logData]) => {
            wnd.cachedReservations = res;
            wnd.cachedLogs = logData;
            const tr = await warehouseService.calculateConsumptionTrends(warehouseId, inventory, logData);
            wnd.cachedTrends = tr;
            if (wnd.currentWarehouseId === warehouseId) {
              if (wnd.updateWarehouseUI) wnd.updateWarehouseUI(warehouseId);
            }
          }).catch(console.error);
        }
        
        if (tab === 'audit_history') {
          audits = await warehouseService.getAuditHistory(warehouseId);
          wnd.cachedAudits = audits;
        }
      } catch(e) {
        console.error(e);
      }
    }
  }

  wnd.currentTrends = trends;
  wnd.currentOccupancy = occupancy;
  wnd.currentInventoryData = inventory;
  wnd.currentUser = userProfile;

  const warehouseInfo = accessibleWarehouses.find(w => w.id === warehouseId);
  const criticalItemsCount = inventory.filter(i => i.quantity <= (i.criticalLimit || 0)).length;

  // Render logic will go here
  return `
      <style>
        :root {
          --bg-dark: #0a0a0a;
          --card-bg: rgba(15, 20, 25, 0.8);
          --accent-blue: var(--accent-cyan);
          --accent-glow: rgba(0, 243, 255, 0.15);
          --text-main: #ffffff;
          --text-dim: rgba(255, 255, 255, 0.6);
          --danger: #ff4d4d;
        }

        /* YENI İPAD VE MOBİL UYUMLU RESPONSIVE IZGARA YAPISI (Simetri Garantili) */
        .premium-card {
          background: rgba(10, 15, 25, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0, 243, 255, 0.15);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 243, 255, 0.05);
          overflow: hidden;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }

        .stats-card {
          padding: 1.5rem;
          background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);
          border: 1px solid rgba(0, 243, 255, 0.1);
          border-radius: 16px;
          position: relative;
          transition: transform 0.3s, border-color 0.3s;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          text-align: center;
        }
        
        .stats-card:hover {
          transform: translateY(-4px);
          border-color: rgba(0, 243, 255, 0.4);
        }

        .stats-label {
          font-size: 0.8rem;
          font-weight: 800;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 0.5rem;
        }

        .stats-value {
          font-size: 2.2rem;
          font-weight: 900;
          color: var(--text-main);
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
        }

        .action-header {
          display: flex;
          flex-wrap: wrap;
          gap: 1.5rem;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .header-buttons {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          align-items: center;
        }

        .btn-cyber {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 12px 20px;
          border-radius: 12px;
          font-weight: 800;
          font-size: 0.8rem;
          transition: all 0.2s ease;
          border: none;
          cursor: pointer;
        }
        
        .btn-cyber:hover {
          filter: brightness(1.2);
          transform: translateY(-2px);
        }

        .cyber-input {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(0, 243, 255, 0.2);
          border-radius: 12px;
          color: var(--text-main);
          padding: 12px 16px;
          outline: none;
          transition: border-color 0.3s;
          width: 100%;
        }
        .cyber-input:focus {
          border-color: rgba(0, 243, 255, 0.8);
        }

        .tab-container {
          display: flex;
          overflow-x: auto;
          gap: 0.5rem;
          background: rgba(255,255,255,0.02);
          padding: 8px;
          border-radius: 16px;
          margin-bottom: 2rem;
          border: 1px solid rgba(255,255,255,0.05);
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
        }
        .tab-container::-webkit-scrollbar {
          display: none;
        }

        .tab-btn {
          padding: 12px 24px;
          border-radius: 12px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-dim);
          font-weight: 800;
          font-size: 0.85rem;
          white-space: nowrap;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .tab-btn.active {
          background: rgba(0, 243, 255, 0.1);
          border-color: rgba(0, 243, 255, 0.3);
          color: var(--accent-blue);
          box-shadow: 0 4px 15px rgba(0, 243, 255, 0.1);
        }
        .tab-btn:hover:not(.active) {
          background: rgba(255,255,255,0.05);
          color: var(--text-main);
        }

        .table-responsive-wrapper {
          width: 100%;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          border-radius: 12px;
          background: rgba(0,0,0,0.2);
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          min-width: 900px;
        }
        th, td {
          padding: 1rem;
          text-align: left;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        th {
          font-size: 0.75rem;
          font-weight: 900;
          color: var(--accent-blue);
          text-transform: uppercase;
          letter-spacing: 1px;
          background: rgba(0, 243, 255, 0.03);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        tbody tr {
          transition: background 0.2s;
        }
        tbody tr:hover {
          background: rgba(255,255,255,0.02);
        }

        @media (max-width: 768px) {
          .action-header {
            flex-direction: column;
            align-items: stretch;
          }
          .header-buttons {
            justify-content: space-between;
          }
          .stats-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      </style>

      <div class="content-area zoom-tablet" style="zoom: 0.7; padding: 1.5rem; max-width: 1600px; margin: 0 auto; animation: fadeIn 0.4s ease-out;">
        
        <!-- ÜST BAŞLIK VE EYLEMLER -->
        <header class="action-header">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <button onclick="window.navigate('warehouses')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: white; padding: 12px; border-radius: 12px;">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 style="margin: 0; font-size: 2rem; font-weight: 900; color: var(--text-main);">${accessibleWarehouses.find(w => w.id === warehouseId)?.name || 'Depo Yönetimi'}</h1>
              <p style="margin: 5px 0 0 0; color: var(--text-dim); font-size: 0.9rem;">${accessibleWarehouses.find(w => w.id === warehouseId)?.location || 'Stok ve Envanter Sistemi'}</p>
            </div>
          </div>
          
          <div class="header-buttons">
            <div style="position: relative; flex: 1; min-width: 250px;">
              <input type="text" id="inventory-search" placeholder="Parça adı veya SAP numarası ara..." 
                     value="${searchQuery}" class="cyber-input"
                     onkeypress="if(event.key==='Enter') window.updateWarehouseUI(undefined, undefined, undefined, this.value)">
              <button onclick="window.updateWarehouseUI(undefined, undefined, undefined, document.getElementById('inventory-search').value)" 
                      style="position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: var(--accent-blue); border: none; color: #000; width: 32px; height: 32px; border-radius: 8px; cursor: pointer;">
                <i class="fa-solid fa-search"></i>
              </button>
            </div>

            <button onclick="window.startQuickAudit('${warehouseId}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda, #48bb78); color: #000;">
              <i class="fa-solid fa-bolt"></i> HIZLI SAYIM
            </button>

            <button onclick="window.startQRScanner('${warehouseId}')" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); border: 1px solid rgba(100,255,218,0.3);">
              <i class="fa-solid fa-qrcode"></i> QR TARA
            </button>

            <button onclick="window.downloadExcel('${warehouseId}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main);">
              <i class="fa-solid fa-file-export" style="color: #2ecc71;"></i> İNDİR
            </button>
            
            ${hasUploadExcel ? `
            <button onclick="window.triggerExcelUpload('${warehouseId}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main);">
              <i class="fa-solid fa-file-import" style="color: var(--accent-blue);"></i> YÜKLE
            </button>
            ` : ''}

            ${hasAddMaterial ? `
            <button onclick="window.openAddMaterialModal('${warehouseId}')" class="btn-cyber" style="background: #fff; color: #000;">
              <i class="fa-solid fa-plus"></i> YENİ EKLE
            </button>
            ` : ''}
          </div>
        </header>

        <!-- İSTATİSTİKLER (SIMETRIK GRID) -->
        <div class="stats-grid">
          <div class="stats-card">
            <div class="stats-label">TOPLAM ÜRÜN ÇEŞİDİ</div>
            <div class="stats-value">${inventory.length}</div>
          </div>
          <div class="stats-card" style="border-bottom: 4px solid var(--danger);">
            <div class="stats-label" style="color: var(--danger);">KRİTİK STOKTA OLANLAR</div>
            <div class="stats-value" style="color: var(--danger);">${inventory.filter(i => i.quantity <= (i.criticalLimit || 0)).length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">SON YAPILAN İŞLEMLER</div>
            <div class="stats-value">${logs.length}</div>
          </div>
          <div class="stats-card" style="background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.2);">
            <div class="stats-label" style="color: var(--accent-blue);">SİSTEM DURUMU</div>
            <div class="stats-value" style="color: var(--accent-blue); font-size: 1.5rem;">ÇEVRİMİÇİ</div>
          </div>
        </div>

        <!-- SEKMELER (TABS) -->
        <div class="tab-container">
          <button onclick="window.updateWarehouseUI('${warehouseId}', undefined, undefined, undefined, 'inventory')" class="tab-btn ${tab==='inventory'?'active':''}">
            <i class="fa-solid fa-box-open"></i> ENVANTER (STOK)
          </button>
          <button onclick="window.updateWarehouseUI('${warehouseId}', undefined, undefined, undefined, 'history')" class="tab-btn ${tab==='history'?'active':''}">
            <i class="fa-solid fa-clock-rotate-left"></i> İŞLEM GEÇMİŞİ
          </button>
          <button onclick="window.updateWarehouseUI('${warehouseId}', undefined, undefined, undefined, 'audit')" class="tab-btn ${tab==='audit'?'active':''}">
            <i class="fa-solid fa-clipboard-check"></i> SAYIM MODÜLÜ
          </button>
          <button onclick="window.updateWarehouseUI('${warehouseId}', undefined, undefined, undefined, 'audit_history')" class="tab-btn ${tab==='audit_history'?'active':''}">
            <i class="fa-solid fa-folder-open"></i> SAYIM KAYITLARI
          </button>
        </div>

        <!-- TAB İÇERİĞİ -->
        <div class="premium-card">
          ${tab === 'inventory' ? `
            <div class="table-responsive-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>GÖRSEL</th>
                    <th>SAP NUMARASI</th>
                    <th>ÜRÜN ADI / AÇIKLAMA</th>
                    <th>MEVCUT MİKTAR</th>
                    <th>RAF KONUMU</th>
                    <th>SON İŞLEM</th>
                    <th>İŞLEMLER</th>
                  </tr>
                </thead>
                <tbody>
                  ${inventory.length > 0 ? inventory.map(item => `
                    <tr>
                      <td>
                        <div style="width: 40px; height: 40px; background: rgba(255,255,255,0.05); border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                          ${item.imageUrl ? `<img src="${item.imageUrl}" style="width:100%; height:100%; object-fit:cover; cursor:pointer;" onclick="window.previewImage('${item.imageUrl}')">` : `<i class="fa-solid fa-image" style="color: rgba(255,255,255,0.2);"></i>`}
                        </div>
                      </td>
                      <td style="font-weight: 800; font-family: monospace; font-size: 1.1rem;">${item.sapNo}</td>
                      <td style="font-weight: 500;">${item.description}</td>
                      <td>
                        <span style="background: ${item.quantity <= (item.criticalLimit || 0) ? 'rgba(255, 77, 77, 0.1)' : 'rgba(100, 255, 218, 0.1)'}; color: ${item.quantity <= (item.criticalLimit || 0) ? '#ff4d4d' : 'var(--accent-blue)'}; padding: 6px 12px; border-radius: 8px; font-weight: 900; font-size: 1rem;">
                          ${item.quantity} ADET
                        </span>
                      </td>
                      <td>${item.shelfNo || 'GİRİLMEMİŞ'}</td>
                      <td style="font-size: 0.8rem; color: var(--text-dim);">${item.lastUpdated ? new Date(item.lastUpdated?.seconds ? item.lastUpdated.seconds * 1000 : item.lastUpdated).toLocaleDateString('tr-TR') : '-'}</td>
                      <td>
                        <div style="display: flex; gap: 8px;">
                          ${hasEditMaterial ? `<button onclick="window.editMaterial('${item.id}')" class="btn-cyber" style="padding: 8px; background: rgba(255,255,255,0.05);"><i class="fa-solid fa-pen"></i></button>` : ''}
                          ${hasDeleteMaterial ? `<button onclick="window.deleteMaterial('${item.id}')" class="btn-cyber" style="padding: 8px; background: rgba(255, 77, 77, 0.1); color: var(--danger);"><i class="fa-solid fa-trash"></i></button>` : ''}
                        </div>
                      </td>
                    </tr>
                  `).join('') : `<tr><td colspan="7" style="text-align:center; padding: 3rem; color: var(--text-dim);">Bu depoda henüz malzeme bulunmuyor veya aramanıza uygun sonuç yok.</td></tr>`}
                </tbody>
              </table>
            </div>
          ` : ''}

          ${tab === 'history' ? `
            <div style="padding: 3rem; text-align: center; color: var(--text-dim);">İşlem Geçmişi modülü yapım aşamasında...</div>
          ` : ''}
          
          ${tab === 'audit' ? `
            <div style="padding: 3rem; text-align: center; color: var(--text-dim);">Sayım modülü yapım aşamasında...</div>
          ` : ''}

          ${tab === 'audit_history' ? `
            <div style="padding: 3rem; text-align: center; color: var(--text-dim);">Sayım Kayıtları modülü yapım aşamasında...</div>
          ` : ''}
        </div>
        
      <!-- Add/Edit Material Modal -->
      <div id="add-material-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10001; align-items: center; justify-content: center;">
        <div class="premium-card modal-content" style="max-width: 720px; width: 95%; max-height: 90vh; overflow-y: auto; overflow-x: hidden; padding: 0; border: 1px solid rgba(100, 255, 218, 0.1); background: #0d1117; box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 28px; position: relative;">
          <div class="modal-inner-content" style="padding: 2.5rem;">
            
            <button type="button" onclick="window.closeAddMaterialModal()" style="position: absolute; top: 20px; right: 20px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.4rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>

            <div style="margin-bottom: 2rem;">
              <h3 id="modal-title" style="margin: 0; color: #64ffda; font-size: 1.8rem; font-weight: 800; text-transform: uppercase;">YENİ MALZEME EKLE</h3>
              <p style="margin: 0.5rem 0 0 0; color: var(--text-dim); font-size: 0.9rem;">Sistem kayıtlarını yüksek hassasiyetle güncelleyin.</p>
            </div>

            <form id="add-material-form" onsubmit="window.handleWarehouseFormSubmit(event)">
              <input type="hidden" id="modal-warehouse-id">
              <input type="hidden" id="modal-item-id">
              
              <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 2.5rem;">
                
                <!-- Left Column: Text Inputs -->
                <div style="display: grid; gap: 1.5rem;">
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">SAP NUMARASI</label>
                    <input type="text" id="modal-sap-no" required class="cyber-input" placeholder=" Örn: 1002345">
                  </div>

                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">AÇIKLAMA / ÜRÜN ADI</label>
                    <input type="text" id="modal-description" required class="cyber-input" placeholder="Malzeme adını girin...">
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                      <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">MİKTAR</label>
                      <input type="number" id="modal-quantity" required class="cyber-input" placeholder="0">
                    </div>
                    <div>
                      <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">KRİTİK LİMİT</label>
                      <input type="number" id="modal-critical-limit" class="cyber-input" placeholder="Limit yok">
                    </div>
                  </div>

                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">RAF KONUMU</label>
                    <input type="text" id="modal-shelf" class="cyber-input" placeholder=" Örn: A-12-3">
                  </div>
                </div>

                <!-- Right Column: Image Upload -->
                <div>
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; margin-bottom: 8px; text-transform: uppercase;">MALZEME GÖRSELİ</label>
                  <div style="border: 2px dashed rgba(255, 255, 255, 0.1); border-radius: 16px; height: 240px; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-dim); background: rgba(0, 0, 0, 0.2); cursor: pointer; transition: all 0.3s ease;">
                    <i class="fa-solid fa-camera" style="font-size: 2.5rem; margin-bottom: 1rem; color: rgba(255, 255, 255, 0.2);"></i>
                    <span style="font-weight: 600; font-size: 0.9rem;">Görsel Yükle</span>
                  </div>
                </div>

              </div>

              <!-- Action Buttons -->
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 1rem; margin-top: 3rem;">
                <button type="button" onclick="window.closeAddMaterialModal()" class="btn-cyber" style="background: rgba(255,255,255,0.1); color: white; height: 54px; font-weight: 700;">İPTAL</button>
                <button type="submit" id="modal-submit-btn" class="btn-cyber" style="background: #64ffda; color: #000; height: 54px; font-weight: 800;">DEĞİŞİKLİKLERİ KAYDET</button>
              </div>
            </form>
          </div>
        </div>
      </div>

      </div>
`;
};
