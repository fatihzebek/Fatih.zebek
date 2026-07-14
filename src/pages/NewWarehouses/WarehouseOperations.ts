import { warehouseState, getUserProfile } from './WarehouseState';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { dataService } from '../../services/DataService';
import { excelService } from '../../services/ExcelService';
import { inventoryService } from '../../services/InventoryService';
import { Html5QrcodeScanner } from 'html5-qrcode';

// --- QR Scanner Controls ---

export const startQRScanner = () => {
   warehouseState.auditMode = 'info';
   const modal = document.getElementById('qr-modal');
   if (modal) modal.style.display = 'flex';
   startScanner();
};

export const startFastAudit = () => {
   warehouseState.auditMode = 'audit';
   warehouseState.auditResults = [];
   const modal = document.getElementById('qr-modal');
   if (modal) modal.style.display = 'flex';
   startScanner();
};

export const closeQRModal = () => {
   const modal = document.getElementById('qr-modal');
   if (modal) modal.style.display = 'none';
   if (warehouseState.html5QrcodeScanner) {
     warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
   }
};

export const startScanner = () => {
  const resultsDiv = document.getElementById('qr-reader-results');
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear();
  warehouseState.html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: {width: 250, height: 250} }, false);
  warehouseState.html5QrcodeScanner.render(onScanSuccess, onScanFailure);
};

export const onScanFailure = (error: any) => { /* ignore */ };

export const showInfo = (item: any) => {
   const resultsDiv = document.getElementById('qr-reader-results')!;
   resultsDiv.innerHTML = `
     <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem; text-align: center;">
       ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />` : ''}
       <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name}</h4>
       <div style="color: #94A3B8; font-size: 0.9rem; margin-bottom: 1rem;">SAP No: ${item.sapNo}</div>
       <div style="background: #0A0E17; border-radius: 6px; padding: 1rem;">
         <div style="font-size: 0.8rem; color: #94A3B8; text-transform: uppercase;">Güncel Stok</div>
         <div style="font-size: 2rem; font-weight: 700; color: #14F195;">${item.quantity} ${item.unit && item.unit !== 'undefined' && item.unit !== 'null' ? item.unit : 'Adet'}</div>
       </div>
       <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 1rem; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer;">Kapat</button>
       <button onclick="window.startQRScanner()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: #1E293B; border: 1px solid #334155; color: white; font-weight: 600; cursor: pointer;">Yeni QR Tara</button>
     </div>
   `;
};

export const onScanSuccess = (decodedText: string) => {
  let searchId = '';
  let searchSap = '';
  let scannedWarehouseId = '';

  try {
    const data = JSON.parse(decodedText);
    if (data && typeof data === 'object') {
      if (data.type === 'p2p_transfer') {
        if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
        handleP2PTransfer(data);
        return;
      }
      searchId = data.id ? String(data.id).trim() : '';
      searchSap = data.sapNo ? String(data.sapNo).trim() : '';
      scannedWarehouseId = data.warehouseId ? String(data.warehouseId).trim() : '';
    } else {
      const cleanText = decodedText.trim();
      searchId = cleanText;
      searchSap = cleanText;
    }
  } catch (e) {
    console.log('[Scanner] QR is plain text, using direct search:', decodedText);
    const cleanText = decodedText.trim();
    searchId = cleanText;
    searchSap = cleanText;
  }

  if (warehouseState.isMobileWarehouse) {
    if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
    handleCustodyScanning(searchSap || searchId, scannedWarehouseId);
    return;
  }

  let item = searchId ? warehouseState.inventoryWithQRs.find(i => String(i.id).trim().toLowerCase() === searchId.toLowerCase()) : null;
  
  if (!item && searchSap) {
    item = warehouseState.inventoryWithQRs.find(i => String(i.sapNo).trim().toLowerCase() === searchSap.toLowerCase());
  }

  if (item) {
    if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear();
    if (warehouseState.auditMode === 'info') {
       showInfo(item);
    } else {
       if ((window as any).showAuditInput) {
         (window as any).showAuditInput(item);
       }
    }
  } else {
    console.warn('[Scanner] No matching material found for:', decodedText);
    const resultsDiv = document.getElementById('qr-reader-results')!;
    const whName = warehouseState.currentWarehouse?.name || 'Bilinmeyen Depo';
    resultsDiv.innerHTML = `
      <div style="background: #1E293B; border-radius: 12px; padding: 1.25rem; margin-top: 1rem; text-align: center; border: 1px solid #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
        <div style="width: 42px; height: 42px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: #ef4444; font-size: 1.25rem;">
          <i class="fa-solid fa-triangle-exclamation"></i>
        </div>
        <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 700;">Malzeme Eşleşmedi</h4>
        <p style="color: #94A3B8; font-size: 0.85rem; margin: 0 0 1.25rem 0; line-height: 1.4;">
          Okutulan kod depodaki herhangi bir malzeme (SAP No veya ID) ile eşleşmedi.
        </p>
        <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 0.75rem; border-radius: 6px; margin-bottom: 1.25rem; text-align: left;">
          <span style="color: #FCA5A5; font-size: 0.75rem; font-weight: 700; display: block; margin-bottom: 3px; letter-spacing: 0.5px;">⚠️ DEPO KONTROLÜ:</span>
          <span style="color: #E2E8F0; font-size: 0.82rem; line-height: 1.35; display: block;">
            Lütfen şu an işlem yaptığınız depoyu kontrol edin.<br>
            Şu An Seçili Depo: <strong style="color: #FCA5A5;">${whName}</strong>
          </span>
        </div>
        <button onclick="window.startQRScanner()" style="width: 100%; padding: 0.75rem; border-radius: 8px; background: #3B82F6; border: none; color: white; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#2563EB'" onmouseout="this.style.background='#3B82F6'">Yeni QR Tara</button>
        <button onclick="window.closeQRModal()" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">Kapat</button>
      </div>
    `;
    if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
  }
};

export const handleP2PTransfer = async (p2pData: {
  type: string;
  sourceWarehouseId: string;
  sourceItemId: string;
  sapNo: string;
  name: string;
  quantity: number;
}) => {
  const resultsDiv = document.getElementById('qr-reader-results')!;
  const userProfile = getUserProfile();
  const userName = userProfile?.displayName || userProfile?.name || 'Bilinmeyen Kullanıcı';
  
  let targetWarehouseId = '';
  let targetWarehouseName = '';
  
  if (userProfile?.team) {
    targetWarehouseId = `team_${userProfile.team.replace(/\s+/g, '_')}`;
    targetWarehouseName = `${userProfile.team} Deposu (Zimmetiniz)`;
  }
  
  const sourceNameClean = p2pData.sourceWarehouseId.replace('team_', '').replace(/_/g, ' ');
  
  resultsDiv.innerHTML = `
    <div style="background: #1E293B; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; border: 1px solid #14F195; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.15); text-align: left;">
      <div style="width: 48px; height: 48px; background: rgba(20, 241, 149, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #14F195; font-size: 1.5rem;">
        <i class="fa-solid fa-right-left-arrows"></i>
      </div>
      <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 700; text-align: center;">P2P Hızlı Transfer Talebi</h4>
      
      <div style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <span style="color: #64748B;">Gönderen Depo:</span>
          <span style="color: #F59E0B; font-weight: 600;">${sourceNameClean}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <span style="color: #64748B;">Malzeme SAP:</span>
          <span style="color: #E2E8F0; font-weight: 600;">${p2pData.sapNo}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <span style="color: #64748B;">Malzeme Adı:</span>
          <span style="color: #E2E8F0; font-weight: 600; text-align: right; max-width: 60%;">${p2pData.name}</span>
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; padding-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05);">
          <span style="color: #64748B; font-size: 0.9rem;">Transfer Miktarı:</span>
          <span style="color: #14F195; font-weight: 700; font-size: 1.1rem;">${p2pData.quantity} Adet</span>
        </div>
      </div>

      ${targetWarehouseId ? `
        <div style="background: rgba(20, 241, 149, 0.05); border: 1px dashed rgba(20, 241, 149, 0.3); border-radius: 8px; padding: 0.75rem; margin-bottom: 1.25rem; text-align: center;">
          <span style="color: #94A3B8; font-size: 0.8rem; display: block; margin-bottom: 2px;">Alıcı Depo (Sizin Deponuz):</span>
          <strong style="color: #14F195; font-size: 0.95rem;">${targetWarehouseName}</strong>
        </div>
      ` : `
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Alıcı Depo Seçin</label>
          <select id="p2p-target-select" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
            ${dataService.getWarehouses().map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
            ${Array.from({length: 15}, (_, i) => `Team ${String(i + 1).padStart(2, '0')}`).map(tName => {
              const tId = `team_${tName.replace(/\s+/g, '_')}`;
              return `<option value="${tId}">${tName} Deposu</option>`;
            }).join('')}
          </select>
        </div>
      `}

      <div style="display: flex; gap: 0.75rem;">
        <button id="p2p-confirm-btn" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Transferi Onayla</button>
        <button onclick="window.closeQRModal()" style="padding: 0.75rem 1.25rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">İptal</button>
      </div>
    </div>
  `;

  const confirmBtn = document.getElementById('p2p-confirm-btn') as HTMLButtonElement;
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const originalText = confirmBtn.innerText;
      confirmBtn.innerText = 'İşleniyor...';
      confirmBtn.disabled = true;
      
      try {
        const finalTargetId = targetWarehouseId || (document.getElementById('p2p-target-select') as HTMLSelectElement).value;
        if (!finalTargetId) {
          alert('Lütfen hedef depo seçin.');
          confirmBtn.innerText = originalText;
          confirmBtn.disabled = false;
          return;
        }

        await warehouseService.transferMaterial(
          p2pData.sourceWarehouseId,
          finalTargetId,
          p2pData.sourceItemId,
          p2pData.quantity,
          userName
        );

        alert('P2P Transfer başarıyla tamamlandı!');
        closeQRModal();
        
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
        }
      } catch (err: any) {
        console.error(err);
        alert('P2P Transfer Hatası: ' + err.message);
        confirmBtn.innerText = originalText;
        confirmBtn.disabled = false;
      }
    };
  }
};

export const handleCustodyScanning = async (sapNo: string, scannedWarehouseId: string = '') => {
  const resultsDiv = document.getElementById('qr-reader-results')!;
  const userProfile = getUserProfile();
  const userName = userProfile?.displayName || userProfile?.name || 'Bilinmeyen Kullanıcı';
  
  const lastSourceWarehouseId = localStorage.getItem('last_p2p_source_warehouse') || '';
  const defaultSourceId = scannedWarehouseId || lastSourceWarehouseId;

  let materialDesc = 'Bilinmeyen Malzeme';

  if (defaultSourceId) {
    try {
      const inv = await warehouseService.getInventory(defaultSourceId);
      const item = inv.find(i => String(i.sapNo).trim() === sapNo.trim());
      if (item) {
        materialDesc = item.description || materialDesc;
      }
    } catch (e) {
      console.warn("Could not retrieve default source inventory for description", e);
    }
  }

  if (materialDesc === 'Bilinmeyen Malzeme') {
    try {
      const material = inventoryService.getMaterialBySap(sapNo);
      if (material) {
        materialDesc = material.d || materialDesc;
      }
    } catch (e) {}
  }

  resultsDiv.innerHTML = `
    <div style="background: #1E293B; border-radius: 12px; padding: 1.5rem; margin-top: 1rem; border: 1px solid #14F195; box-shadow: 0 4px 20px rgba(20, 241, 149, 0.15); text-align: left;">
      <div style="width: 48px; height: 48px; background: rgba(20, 241, 149, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: #14F195; font-size: 1.5rem;">
        <i class="fa-solid fa-truck-moving"></i>
      </div>
      <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 700; text-align: center;">Zimmete Malzeme Ekle</h4>
      
      <div style="background: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <span style="color: #64748B;">Malzeme SAP:</span>
          <span style="color: #14F195; font-weight: 600;">${sapNo}</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
          <span style="color: #64748B;">Malzeme Adı:</span>
          <span style="color: #E2E8F0; font-weight: 600; text-align: right; max-width: 60%;">${materialDesc}</span>
        </div>
      </div>

      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Kaynak Depo (Nereden Alınıyor)</label>
        <select id="custody-source-select" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none; appearance: none;">
          ${dataService.getWarehouses().map(w => `<option value="${w.id}" ${w.id === defaultSourceId ? 'selected' : ''}>${w.name}</option>`).join('')}
        </select>
      </div>

      <div style="margin-bottom: 1.25rem;">
        <label style="display: block; font-size: 0.8rem; color: #94A3B8; margin-bottom: 0.5rem; text-transform: uppercase;">Alınacak Miktar</label>
        <input id="custody-qty-input" type="number" min="1" value="1" style="width: 100%; height: 42px; background-color: #0A0E17; border: 1px solid #1E293B; border-radius: 8px; color: #E2E8F0; padding: 0 1rem; font-size: 0.9rem; outline: none;">
      </div>

      <div style="display: flex; gap: 0.75rem;">
        <button id="custody-confirm-btn" style="flex: 1; padding: 0.75rem; border-radius: 8px; background: #14F195; border: none; color: #0A0E17; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">Zimmetime Al</button>
        <button onclick="window.closeQRModal()" style="padding: 0.75rem 1.25rem; border-radius: 8px; background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #E2E8F0; font-weight: 600; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.15)'" onmouseout="this.style.background='rgba(255,255,255,0.08)'">İptal</button>
      </div>
    </div>
  `;

  const confirmBtn = document.getElementById('custody-confirm-btn') as HTMLButtonElement;
  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const originalText = confirmBtn.innerText;
      confirmBtn.innerText = 'İşleniyor...';
      confirmBtn.disabled = true;
      
      try {
        const sourceWarehouseId = (document.getElementById('custody-source-select') as HTMLSelectElement).value;
        const quantity = parseInt((document.getElementById('custody-qty-input') as HTMLInputElement).value);
        
        if (!sourceWarehouseId || isNaN(quantity) || quantity <= 0) {
          alert('Lütfen geçerli kaynak depo ve miktar girin.');
          confirmBtn.innerText = originalText;
          confirmBtn.disabled = false;
          return;
        }

        localStorage.setItem('last_p2p_source_warehouse', sourceWarehouseId);

        const sourceInventory = await warehouseService.getInventory(sourceWarehouseId);
        const sourceItem = sourceInventory.find(i => String(i.sapNo).trim() === sapNo.trim());
        
        if (!sourceItem) {
          alert('Seçilen kaynak depoda bu SAP numaralı malzeme bulunamadı.');
          confirmBtn.innerText = originalText;
          confirmBtn.disabled = false;
          return;
        }

        if (sourceItem.quantity < quantity) {
          alert(`Kaynak depoda yeterli stok yok. Mevcut: ${sourceItem.quantity} Adet`);
          confirmBtn.innerText = originalText;
          confirmBtn.disabled = false;
          return;
        }

        await warehouseService.transferMaterial(
          sourceWarehouseId,
          warehouseState.currentWarehouse.id,
          sourceItem.id!,
          quantity,
          userName
        );

        alert('Malzeme başarıyla zimmetinize alındı!');
        closeQRModal();
        
        if ((window as any).selectWarehouseAndNavigate) {
          (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
        }
      } catch (err: any) {
        console.error(err);
        alert('Zimmet Alma Hatası: ' + err.message);
        confirmBtn.innerText = originalText;
        confirmBtn.disabled = false;
      }
    };
  }

  const qtyInput = document.getElementById('custody-qty-input') as HTMLInputElement;
  if (qtyInput) {
    qtyInput.focus();
    qtyInput.select();
    qtyInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmBtn.click();
      }
    });
  }
};

// --- Excel Handling & Export / Import ---

export const downloadInventoryExcel = async () => {
   const inventory = warehouseState.inventoryItems || [];
   const audits = (window as any).__cachedAudits || [];
   const name = warehouseState.currentWarehouse?.name || 'Depo';
   
   if (inventory.length === 0) {
      alert('İndirilecek envanter verisi bulunamadı veya henüz yüklenmedi.');
      return;
   }
   
   await excelService.exportToExcel(inventory, audits, name + ' Envanteri');
};

export const downloadSingleAuditExcel = async (auditId: string) => {
   const audits = (window as any).__cachedAudits || [];
   const audit = audits.find((a: any) => a.id === auditId);
   const name = warehouseState.currentWarehouse?.name || 'Depo';
   const inventory = warehouseState.inventoryItems || [];
   
   if (!audit) {
      alert('İndirilecek sayım kaydı bulunamadı.');
      return;
   }
   
   const activeWhId = warehouseState.currentWarehouse.id || 'MTA';
   const logs = await warehouseService.getLogs(activeWhId);
   
   excelService.exportSingleAuditToExcel(audit, name, inventory, audits, logs);
};

export const downloadAllAuditsExcel = async () => {
   const audits = (window as any).__cachedAudits || [];
   const name = warehouseState.currentWarehouse?.name || 'Depo';
   const inventory = warehouseState.inventoryItems || [];
   
   if (audits.length === 0) {
      alert('İndirilecek sayım geçmişi bulunamadı veya henüz yüklenmedi.');
      return;
   }
   
   excelService.exportAllAuditsToExcel(audits, name, inventory);
};

export const exportTurbineAnalytics = async () => {
   const data = (window as any).currentTurbineData;
   const name = warehouseState.currentWarehouse?.name || '';
   const period = localStorage.getItem('warehouse_analytics_period') || 'this-month';
   if (!data || Object.keys(data).length === 0) {
      alert('Dışa aktarılacak analiz verisi bulunamadı.');
      return;
   }
   await excelService.exportTurbineAnalytics(data, name, period);
};

export const exportTransfersListToExcel = async () => {
  try {
    const filteredForExport = (window as any).getFilteredTransfersList?.() || [];
    if (filteredForExport.length === 0) {
      alert("İndirilecek transfer kaydı bulunamadı!");
      return;
    }
    const fileName = `${warehouseState.currentWarehouse.name.replace(/\s+/g, '_')}_Sevk_Raporu`;
    await excelService.exportTransfersToExcel(filteredForExport, fileName);
  } catch (err: any) {
    alert("Excel indirilirken hata oluştu: " + err.message);
  }
};

export const handleExcelUpload = async (event: any) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const wipeExisting = confirm('Excel yüklenmeden önce bu deponun mevcut envanteri TAMAMEN silinsin mi? (Bu işlem geri alınamaz!) \n\nİptal derseniz silinmeden üstüne eklenir.');
  
  try {
    const btn = document.getElementById('btn-upload-excel');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...'; btn.style.pointerEvents = 'none'; }

    const items = await excelService.parseExcel(file);
    
    if (wipeExisting) {
        const deletePromises = warehouseState.inventoryItems.map(i => warehouseService.deleteMaterial(warehouseState.currentWarehouse.id, i.id));
        await Promise.all(deletePromises);
    }

    let addedCount = 0;
    const totalItems = items.length;
    for (let i = 0; i < totalItems; i++) {
       const item = items[i];
       if (!item.description && !item.sapNo) continue;
       await warehouseService.addMaterial(warehouseState.currentWarehouse.id, {
         sapNo: String(item.sapNo || '').trim(),
         description: String(item.description || '').trim() || 'Bilinmeyen Malzeme',
         quantity: Number(item.quantity) || 0,
         shelfNo: String(item.shelfNo || '').trim() || 'Tanımsız'
       });
       addedCount++;
       
       if (btn) {
           const percentage = Math.round(((i + 1) / totalItems) * 100);
           btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> %${percentage} Yükleniyor...`;
       }
    }

    alert(`Başarıyla ${addedCount} ürün yüklendi!`);
    if ((window as any).selectWarehouseAndNavigate) {
        (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err) {
    console.error(err);
    alert('Excel yüklenirken hata oluştu. Lütfen Excel formatınızın doğru olduğundan emin olun (Sütunlar: SAP NO, AÇIKLAMA, ADET, RAF NO).');
    const btn = document.getElementById('btn-upload-excel');
    if(btn) { btn.innerHTML = '<i class="fa-solid fa-upload"></i> Yükle'; btn.style.pointerEvents = 'auto'; }
  }
  event.target.value = '';
};

// --- Labels Printing ---

export const printWarehouseQR = async () => {
   const inventory = warehouseState.inventoryItems || [];
   
   if (inventory.length === 0) {
      alert('Basılacak envanter verisi bulunamadı veya henüz yüklenmedi.');
      return;
   }

   const checkboxes = document.querySelectorAll('.item-checkbox:checked');
   const checkedIds = Array.from(checkboxes).map((cb: any) => cb.value);

   let itemsToPrint = [];
   if (checkedIds.length > 0) {
      itemsToPrint = inventory.filter((item: any) => checkedIds.includes(item.id));
      if (!confirm(`${itemsToPrint.length} adet seçili malzeme için QR etiket şablonu (TW-2014) hazırlanacak. Devam edilsin mi?`)) {
          return;
      }
   } else {
      if (!confirm(`Herhangi bir malzeme seçilmedi. Tüm envanter (${inventory.length} adet malzeme) için toplu QR etiket basılsın mı?`)) {
          return;
      }
      itemsToPrint = inventory;
   }
   
   const { qrService } = await import('../../services/QRService');
   const items = itemsToPrint.map((item: any) => ({
       id: item.id,
       sapNo: item.sapNo,
       description: item.description,
       warehouseId: warehouseState.currentWarehouse.id
   }));
   
   await qrService.printBulkLabels(items);
};

// Register methods to window
(window as any).startQRScanner = startQRScanner;
(window as any).startFastAudit = startFastAudit;
(window as any).closeQRModal = closeQRModal;
(window as any).startScanner = startScanner;
(window as any).onScanSuccess = onScanSuccess;
(window as any).onScanFailure = onScanFailure;
(window as any).showInfo = showInfo;
(window as any).handleP2PTransfer = handleP2PTransfer;
(window as any).handleCustodyScanning = handleCustodyScanning;
(window as any).downloadInventoryExcel = downloadInventoryExcel;
(window as any).downloadSingleAuditExcel = downloadSingleAuditExcel;
(window as any).downloadAllAuditsExcel = downloadAllAuditsExcel;
(window as any).exportTurbineAnalytics = exportTurbineAnalytics;
(window as any).exportTransfersListToExcel = exportTransfersListToExcel;
(window as any).handleExcelUpload = handleExcelUpload;
(window as any).printWarehouseQR = printWarehouseQR;
