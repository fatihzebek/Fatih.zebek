import { warehouseState, getUserProfile } from './WarehouseState';
import { ensureSingleModalInBody } from './WarehouseModals';
import { showAuditInput } from './WarehouseAudit';
import { db } from '../../firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { warehouseService } from '../../services/WarehouseService';
import { dataService } from '../../services/DataService';
import { excelService } from '../../services/ExcelService';
import { inventoryService } from '../../services/InventoryService';
import { soundService } from '../../services/SoundService';
import { Html5QrcodeScanner } from 'html5-qrcode';

// --- QR Scanner Controls ---

export const startQRScanner = async () => {
   warehouseState.auditMode = 'info';
   if ((!warehouseState.inventoryItems || warehouseState.inventoryItems.length === 0) && warehouseState.currentWarehouse?.id) {
       try {
           warehouseState.inventoryItems = await warehouseService.getInventory(warehouseState.currentWarehouse.id);
       } catch (e) {
           console.error("Failed to load inventory for QR scanner:", e);
       }
   }
   const modal = ensureSingleModalInBody('qr-modal');
   if (modal) modal.style.display = 'flex';
   startScanner();
};

export const startFastAudit = async () => {
   warehouseState.auditMode = 'audit';
   warehouseState.auditResults = [];
   if ((!warehouseState.inventoryItems || warehouseState.inventoryItems.length === 0) && warehouseState.currentWarehouse?.id) {
       try {
           warehouseState.inventoryItems = await warehouseService.getInventory(warehouseState.currentWarehouse.id);
       } catch (e) {
           console.error("Failed to load inventory for fast audit:", e);
       }
   }
   const modal = ensureSingleModalInBody('qr-modal');
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
  const modal = ensureSingleModalInBody('qr-modal');
  const resultsDiv = modal ? modal.querySelector('#qr-reader-results') : document.getElementById('qr-reader-results');
  if (resultsDiv) resultsDiv.innerHTML = '';
  if (warehouseState.html5QrcodeScanner) {
    try {
      warehouseState.html5QrcodeScanner.clear().catch(() => {});
    } catch (e) {}
  }

  const qrboxFunction = (viewfinderWidth: number, viewfinderHeight: number) => {
    const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
    const edge = Math.max(220, Math.floor(minEdge * 0.75));
    return { width: edge, height: edge };
  };

  warehouseState.html5QrcodeScanner = new Html5QrcodeScanner(
    "qr-reader", 
    { 
      fps: 20, 
      qrbox: qrboxFunction,
      aspectRatio: 1.0,
      experimentalFeatures: {
        useBarCodeDetectorIfSupported: true
      }
    }, 
    false
  );
  warehouseState.html5QrcodeScanner.render(onScanSuccess, onScanFailure);
};

export const onScanFailure = (error: any) => { /* ignore */ };

export const showInfo = (item: any) => {
   const modal = ensureSingleModalInBody('qr-modal');
   const resultsDiv = (modal ? modal.querySelector('#qr-reader-results') : document.getElementById('qr-reader-results')) as HTMLElement;
   if (!resultsDiv) return;
   resultsDiv.innerHTML = `
     <div style="background: #1E293B; border-radius: 8px; padding: 1rem; margin-top: 1rem; text-align: center;">
       ${item.imageUrl ? `<img src="${item.imageUrl}" style="width: 80px; height: 80px; object-fit: cover; border-radius: 8px; margin-bottom: 1rem;" />` : ''}
       <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0;">${item.name || item.description || ''}</h4>
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

export const onScanSuccess = async (decodedText: string) => {
  // 1. Play instant barcode scanner beep & haptic feedback
  soundService.playScannerBeep();

  let searchId = '';
  let searchSap = '';
  let scannedWarehouseId = '';

  const rawText = (decodedText || '').trim();

  try {
    const data = JSON.parse(rawText);
    if (data && typeof data === 'object') {
      if (data.type === 'p2p_transfer') {
        if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
        handleP2PTransfer(data);
        return;
      }
      searchId = data.id ? String(data.id).trim() : '';
      searchSap = data.sapNo ? String(data.sapNo).trim() : '';
      scannedWarehouseId = data.warehouseId ? String(data.warehouseId).trim() : '';
    }
  } catch (e) {
    // Plain text QR
  }

  // If searchSap wasn't in JSON, extract from raw text
  if (!searchSap) {
    // Handle prefixes like "SAP: 721", "SAP NO: DE010", "SAP:DE010"
    const sapPrefixMatch = rawText.match(/^(?:SAP\s*(?:NO|NUMARASI)?\s*[:\-.]?\s*)([A-Za-z0-9\-_./]+)/i);
    if (sapPrefixMatch && sapPrefixMatch[1]) {
      searchSap = sapPrefixMatch[1].trim();
    } else {
      searchSap = rawText;
    }
  }

  if (!searchId && rawText.length > 15 && !rawText.includes(' ') && !rawText.includes(':')) {
    searchId = rawText;
  }

  if (warehouseState.isMobileWarehouse) {
    if (warehouseState.html5QrcodeScanner) warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
    handleCustodyScanning(searchSap || searchId || rawText, scannedWarehouseId);
    return;
  }

  if ((!warehouseState.inventoryItems || warehouseState.inventoryItems.length === 0) && warehouseState.currentWarehouse?.id) {
    try {
      warehouseState.inventoryItems = await warehouseService.getInventory(warehouseState.currentWarehouse.id);
    } catch(e) {}
  }

  const allInventory = [
    ...(warehouseState.inventoryItems || [])
  ];

  // Helper normalizers for exact comparison
  const norm = (s: string) => String(s || '').trim().toLowerCase();
  const stripZero = (s: string) => norm(s).replace(/^0+/, '');

  const targetSapNorm = norm(searchSap);
  const targetSapClean = stripZero(searchSap);
  const targetId = norm(searchId);

  // 1. Strict Exact ID Match
  let item = targetId ? allInventory.find(i => norm(i.id) === targetId) : undefined;

  // 2. Strict Exact SAP Match (Case-insensitive, supports alphanumeric e.g. DE010 and numbers e.g. 721)
  if (!item && targetSapNorm) {
    const sapMatches = allInventory.filter(i => {
      const iSapNorm = norm(i.sapNo);
      const iSapClean = stripZero(i.sapNo);
      return iSapNorm === targetSapNorm || (targetSapClean && iSapClean === targetSapClean);
    });

    if (sapMatches.length > 0) {
      // Prioritize NEW / active condition over DEFECT
      item = sapMatches.find(i => i.condition === 'NEW') || sapMatches.find(i => i.condition !== 'DEFECT') || sapMatches[0];
    }
  }

  // Fallback: If still not found in local memory, query directly from Firestore
  if (!item && searchSap && warehouseState.currentWarehouse?.id) {
    try {
      const remoteStock = await warehouseService.getStockBySapAndCondition(warehouseState.currentWarehouse.id, searchSap, 'NEW');
      if (remoteStock) {
        item = {
          id: remoteStock.id,
          sapNo: remoteStock.sapNo,
          name: remoteStock.description,
          description: remoteStock.description,
          quantity: remoteStock.quantity,
          unit: (remoteStock as any).unit || 'Adet',
          shelfNo: remoteStock.shelfNo || '',
          criticalLimit: remoteStock.criticalLimit
        };
      }
    } catch(e) {
      console.warn("Remote stock fallback lookup failed:", e);
    }
  }

  if (warehouseState.html5QrcodeScanner) {
    warehouseState.html5QrcodeScanner.clear().catch((e: any) => console.error(e));
  }

  if (item) {
    if (warehouseState.auditMode === 'info') {
       showInfo(item);
    } else {
       showAuditInput(item);
    }
  } else {
    soundService.playErrorSound();
    console.warn('[Scanner] No matching material found for:', decodedText);
    const modal = ensureSingleModalInBody('qr-modal');
    const resultsDiv = (modal ? modal.querySelector('#qr-reader-results') : document.getElementById('qr-reader-results')) as HTMLElement;
    const whName = warehouseState.currentWarehouse?.name || 'Bilinmeyen Depo';
    
    if (resultsDiv) {
      resultsDiv.innerHTML = `
        <div style="background: #1E293B; border-radius: 12px; padding: 1.25rem; margin-top: 1rem; text-align: center; border: 1px solid #ef4444; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.15);">
          <div style="width: 42px; height: 42px; background: rgba(239, 68, 68, 0.2); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem auto; color: #ef4444; font-size: 1.25rem;">
            <i class="fa-solid fa-triangle-exclamation"></i>
          </div>
          <h4 style="color: #FFFFFF; margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 700;">Malzeme Eşleşmedi</h4>
          <p style="color: #94A3B8; font-size: 0.85rem; margin: 0 0 1.25rem 0; line-height: 1.4;">
            Okutulan kod depodaki herhangi bir malzeme (SAP / Kod: <strong>${searchSap || searchId || rawText}</strong>) ile eşleşmedi.
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
    }
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
   
   // If user has filtered by Critical Stock (warehouseState.onlyShowCritical === true)
   if (warehouseState.onlyShowCritical) {
      const criticalItems = inventory.filter((i: any) => i.condition !== 'DEFECT' && (i.quantity <= (i.minStock || 0)));
      if (criticalItems.length === 0) {
         alert('Kritik stok seviyesinde malzeme bulunamadı.');
         return;
      }
      await excelService.exportCriticalStockToExcel(criticalItems, name);
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
    
    // FETCH APPROVED TRANSFERS TO THIS WAREHOUSE TO PROTECT TRANSFERRED MATERIALS
    const { transferService } = await import('../../services/TransferService');
    const transfers = await transferService.getTransfers();
    const currentWarehouseId = warehouseState.currentWarehouse.id.toLowerCase();
    const transferredSapNos = new Set(
      transfers
        .filter(t => t.toSiteId && t.toSiteId.toLowerCase() === currentWarehouseId && t.status === 'APPROVED')
        .map(t => String(t.materialCode || '').trim())
    );
    
    if (wipeExisting) {
        // Delete only materials that were NOT received via transfer
        const deletePromises = warehouseState.inventoryItems
          .filter(i => !transferredSapNos.has(String(i.sapNo || '').trim()))
          .map(i => warehouseService.deleteMaterial(warehouseState.currentWarehouse.id, i.id));
        await Promise.all(deletePromises);
    }

    let addedCount = 0;
    const totalItems = items.length;
    for (let i = 0; i < totalItems; i++) {
       const item = items[i];
       if (!item.description && !item.sapNo) continue;
       
       const sapTrimmed = String(item.sapNo || '').trim();
       
       // If we wiped existing and this item was transferred, we already preserved it.
       // Skip re-adding to avoid duplication.
       if (wipeExisting && transferredSapNos.has(sapTrimmed)) {
         continue;
       }
       
       await warehouseService.addMaterial(warehouseState.currentWarehouse.id, {
         sapNo: sapTrimmed,
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

   // 1. Gather all selected IDs from warehouseState.selectedMaterialIds (persistent across all pages)
   const stateSelectedIds = Array.from(warehouseState.selectedMaterialIds || []);
   const domCheckboxes = document.querySelectorAll('.item-checkbox:checked');
   const domCheckedIds = Array.from(domCheckboxes).map((cb: any) => cb.value);
   
   const allSelectedIds = Array.from(new Set([...stateSelectedIds, ...domCheckedIds]));

   let itemsToPrint = [];
   if (allSelectedIds.length > 0) {
      itemsToPrint = inventory.filter((item: any) => allSelectedIds.includes(item.id));
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

export const toggleDateGroup = (dayStr: string) => {
  const rows = document.querySelectorAll(`tr[data-group-date="${dayStr}"]`);
  const icon = document.querySelector(`i[data-group-icon-date="${dayStr}"]`) as HTMLElement | null;
  if (rows.length === 0) return;
  
  const isHidden = (rows[0] as HTMLElement).style.display === 'none';
  rows.forEach((row: any) => {
    row.style.display = isHidden ? '' : 'none';
  });
  
  if (icon) {
    icon.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
  }
};

export const renderDepoHareketleriLogs = (filteredLogs?: any[]) => {
   const container = document.getElementById('depo-hareketleri-container');
   if (!container) return;
   
   const logsToRender = filteredLogs || (window as any).__cachedDepoLogs || [];
   if (logsToRender.length === 0) {
     container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Herhangi bir hareket kaydı bulunamadı.</div>';
     return;
   }
   
   const sortedLogs = [...logsToRender].sort((a: any, b: any) => ((b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0)));
   
   const groupedLogs: Record<string, any[]> = {};
   const daysOrder: string[] = [];
   sortedLogs.forEach((l: any) => {
     const logDate = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : null;
     const dayStr = logDate ? logDate.toLocaleDateString('tr-TR') : 'Bilinmeyen Tarih';
     if (!groupedLogs[dayStr]) {
       groupedLogs[dayStr] = [];
       daysOrder.push(dayStr);
     }
     groupedLogs[dayStr].push(l);
   });

   const isMaterialManager = warehouseState.isMaterialManager;

   container.innerHTML = `
     <div style="border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; background-color: #111827;">
       <div style="overflow-x: auto;">
         <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.9rem; min-width: 800px;">
           <thead>
             <tr style="background-color: #0F172A; border-bottom: 1px solid #1E293B;">
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Saat</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Yapan</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">İşlem</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Rota</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Malzeme</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Miktar</th>
               <th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Açıklama</th>
               ${isMaterialManager ? `<th style="padding: 1rem; color: #94A3B8; font-weight: 600; text-align: center;">Aksiyon</th>` : ''}
             </tr>
           </thead>
           <tbody>
             ${daysOrder.map(dayStr => {
               const dayLogsRaw = groupedLogs[dayStr].filter((l: any) => !(l.note && (l.note.includes('Otomatik Veri Senkronizasyonu') || l.note.includes('Self-healing'))));
                
                // Deduplicate repetitive auto-sync logs for the exact same report, SAP and note
                const seenAutoLogs = new Set<string>();
                const dayLogs = dayLogsRaw.filter((l: any) => {
                  const note = l.note || '';
                  if (note.includes('Otomatik Eşitleme:')) {
                    const key = `${l.sapNo}_${l.fromSiteId || ''}_${l.toSiteId || ''}_${note}`;
                    if (seenAutoLogs.has(key)) {
                      return false;
                    }
                    seenAutoLogs.add(key);
                  }
                  return true;
                });

               if (dayLogs.length === 0) return '';
               
               const headerRowHtml = `
                 <tr class="date-group-header" onclick="window.toggleDateGroup('${dayStr}')" style="background-color: rgba(30, 41, 59, 0.6); cursor: pointer; user-select: none; border-bottom: 1px solid #1E293B;">
                   <td colspan="${isMaterialManager ? 8 : 7}" style="padding: 0.75rem 1rem; font-weight: 700; color: #14F195;">
                     <div style="display: flex; align-items: center; gap: 8px;">
                       <i class="fa-solid fa-chevron-down date-group-icon" data-group-icon-date="${dayStr}" style="transition: transform 0.2s; color: #14F195;"></i>
                       <span style="font-family: 'Rajdhani', sans-serif; font-size: 1rem; letter-spacing: 0.5px;">${dayStr}</span>
                       <span style="font-size: 0.75rem; background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.2); padding: 2px 6px; border-radius: 4px; color: #14F195; font-weight: 600;">${dayLogs.length} İşlem</span>
                     </div>
                   </td>
                 </tr>
               `;
               
               const rowsHtml = dayLogs.map((l: any) => {
                 const logDate = l.timestamp?.seconds ? new Date(l.timestamp.seconds * 1000) : null;
                 const timeStr = logDate ? logDate.toLocaleTimeString('tr-TR') : '-';
                 
                 const formatUser = (window as any).formatDepoUser || ((u: string) => u);
                 
                 const baseBadgeStyle = "display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; width: 120px;";
                 let badgeHtml = '';
                 if (l.type === 'ADD') {
                   const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                   const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                   const isIncrease = l.oldQty !== undefined && l.oldQty > 0;
                   
                   if (isDefect) {
                     badgeHtml = `
                       <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                         <i class="fa-solid fa-screwdriver-wrench" style="font-size: 0.75rem; margin-right: 4px;"></i> SÖKÜLEN PARÇA
                       </span>
                     `;
                   } else if (isScrap) {
                     badgeHtml = `
                       <span style="${baseBadgeStyle} background: rgba(100, 116, 139, 0.15); color: #94A3B8; border: 1px solid rgba(100, 116, 139, 0.3); box-shadow: 0 0 6px rgba(100, 116, 139, 0.15);">
                         <i class="fa-solid fa-trash" style="font-size: 0.75rem; margin-right: 4px;"></i> HURDA GİRİŞİ
                       </span>
                     `;
                   } else {
                     badgeHtml = `
                       <span style="${baseBadgeStyle} background: ${isIncrease ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'}; color: ${isIncrease ? '#10B981' : '#60A5FA'}; border: 1px solid ${isIncrease ? 'rgba(16, 185, 129, 0.3)' : 'rgba(59, 130, 246, 0.3)'}; box-shadow: 0 0 6px ${isIncrease ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)'};">
                         <i class="fa-solid ${isIncrease ? 'fa-chart-line' : 'fa-circle-plus'}" style="font-size: 0.75rem; margin-right: 4px;"></i> ${isIncrease ? 'STOK ARTIŞI' : 'STOK GİRİŞ'}
                       </span>
                     `;
                   }
                 } else if (l.type === 'REMOVE') {
                   const isDefect = l.note && l.note.includes('[Durum: DEFECT]');
                   const isScrap = l.note && l.note.includes('[Durum: SCRAP]');
                   
                   if (isDefect) {
                     badgeHtml = `
                       <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                         <i class="fa-solid fa-arrow-right-from-bracket" style="font-size: 0.75rem; margin-right: 4px;"></i> ARIZALI ÇIKIŞ
                       </span>
                     `;
                   } else if (isScrap) {
                     badgeHtml = `
                       <span style="${baseBadgeStyle} background: rgba(100, 116, 139, 0.15); color: #94A3B8; border: 1px solid rgba(100, 116, 139, 0.3); box-shadow: 0 0 6px rgba(100, 116, 139, 0.15);">
                         <i class="fa-solid fa-trash" style="font-size: 0.75rem; margin-right: 4px;"></i> HURDA ÇIKIŞI
                       </span>
                     `;
                   } else {
                     const isReportUse = l.note && (l.note.includes('Saha Raporu') || l.note.includes('Rapor Güncelleme'));
                     if (isReportUse) {
                       badgeHtml = `
                         <span style="${baseBadgeStyle} background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); box-shadow: 0 0 6px rgba(16, 185, 129, 0.15);">
                           <i class="fa-solid fa-wrench" style="font-size: 0.75rem; margin-right: 4px;"></i> TAKILAN PARÇA
                         </span>
                       `;
                     } else {
                       badgeHtml = `
                         <span style="${baseBadgeStyle} background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); box-shadow: 0 0 6px rgba(239, 68, 68, 0.15);">
                           <i class="fa-solid fa-circle-minus" style="font-size: 0.75rem; margin-right: 4px;"></i> STOK ÇIKIŞ
                         </span>
                       `;
                     }
                   }
                 } else if (l.type === 'TRANSFER') {
                   badgeHtml = `
                     <span style="${baseBadgeStyle} background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); box-shadow: 0 0 6px rgba(245, 158, 11, 0.15);">
                       <i class="fa-solid fa-circle-arrow-right" style="font-size: 0.75rem; margin-right: 4px;"></i> TRANSFER
                     </span>
                   `;
                 } else {
                   badgeHtml = `
                     <span style="${baseBadgeStyle} background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); box-shadow: 0 0 6px rgba(59, 130, 246, 0.15);">
                       <i class="fa-solid fa-pen" style="font-size: 0.75rem; margin-right: 4px;"></i> GÜNCELLEME
                     </span>
                   `;
                 }
                
                 let isQtyDecrease = l.type === 'REMOVE';
                 if (l.type === 'TRANSFER') {
                   if (l.note && l.note.includes(' deposuna transfer edildi.')) {
                     isQtyDecrease = true;
                   } else if (l.transferInfo && warehouseState.currentWarehouse?.id === l.transferInfo.from) {
                     isQtyDecrease = true;
                   }
                 }
                 
                 let isReturnToMain = false;
                 if (l.type === 'TRANSFER' && l.transferInfo) {
                   if (l.transferInfo.from.startsWith('team_') && !l.transferInfo.to.startsWith('team_')) {
                     isReturnToMain = true;
                   }
                 }

                 const isReportUse = l.type === 'REMOVE' && l.note && (l.note.includes('Saha Raporu') || l.note.includes('Rapor Güncelleme'));
                 const isDefectAdd = l.type === 'ADD' && l.note && l.note.includes('[Durum: DEFECT]');

                 let qtyColor = '#10B981';
                 let qtyText = '';

                 if (isReportUse) {
                   qtyColor = '#10B981';
                   qtyText = `+${Math.abs(l.quantity)}`;
                 } else if (isDefectAdd) {
                   qtyColor = '#EF4444';
                   qtyText = `-${Math.abs(l.quantity)}`;
                 } else {
                   qtyColor = (isQtyDecrease && !isReturnToMain) ? '#EF4444' : '#10B981';
                   qtyText = isQtyDecrease ? `-${Math.abs(l.quantity)}` : `+${Math.abs(l.quantity)}`;
                 }
             
                 let directionHtml = '';
                 if (l.type === 'TRANSFER' || (l.note && (l.note.includes('Konum:') || l.note.includes('Saha Raporu')))) {
                   const currentWhName = warehouseState.currentWarehouse?.name.replace(/\s*[Dd]epo(su)?\s*$/, '').trim() || 'Depo';
                   let otherWhName = '';
                   let isIncoming = l.type === 'TRANSFER' ? l.quantity > 0 : l.type === 'ADD';
                   
                   if (l.transferInfo) {
                     if (warehouseState.currentWarehouse?.id === l.transferInfo.from) {
                       otherWhName = l.transferInfo.toName;
                       isIncoming = false;
                     } else {
                       otherWhName = l.transferInfo.fromName;
                       isIncoming = true;
                     }
                   } else if (l.note && l.type === 'TRANSFER') {
                     if (l.note.includes(' deposuna transfer edildi.')) {
                       otherWhName = l.note.replace(' deposuna transfer edildi.', '').trim();
                       isIncoming = false;
                     } else if (l.note.includes(' deposundan transfer edildi.')) {
                       otherWhName = l.note.replace(' deposundan transfer edildi.', '').trim();
                       isIncoming = true;
                     }
                   } else if (l.note && (l.type === 'REMOVE' || l.type === 'ADD')) {
                     const locMatch = l.note.match(/Konum:\s*([^-\)\]\(\[#]+)/i);
                     if (locMatch) {
                       otherWhName = locMatch[1].trim();
                     }
                   }
                   
                   if (!otherWhName) {
                     otherWhName = 'Diğer Depo';
                   }
                  
                   const cleanCurrent = formatUser(currentWhName);
                   const cleanOther = formatUser(otherWhName);
                   
                   if (isIncoming) {
                     directionHtml = `
                       <div style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; color: #10B981; font-weight: 600;">
                         <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.2); white-space: nowrap;">${cleanOther}</span>
                         <i class="fa-solid fa-arrow-right-long" style="font-size: 0.7rem; opacity: 0.8;"></i>
                         <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap;">${cleanCurrent}</span>
                       </div>
                     `;
                   } else {
                     directionHtml = `
                       <div style="font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; color: #EF4444; font-weight: 600;">
                         <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap;">${cleanCurrent}</span>
                         <i class="fa-solid fa-arrow-right-long" style="font-size: 0.7rem; opacity: 0.8;"></i>
                         <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); white-space: nowrap;">${cleanOther}</span>
                       </div>
                     `;
                   }
                 }

                 let serialNo = l.serialNo || '';
                 if (!serialNo && warehouseState.inventoryItems) {
                   const matched = warehouseState.inventoryItems.find((inv: any) => inv.id === l.itemId || inv.sapNo === l.sapNo);
                   if (matched) {
                     serialNo = matched.serialNo || '';
                   }
                 }
                 
                 let displayNote = l.note || '';
                 const reportIdMatch = displayNote.match(/Rapor:\s*(AL_SR[A-Za-z0-9_]+)/i);
                 if (reportIdMatch) {
                   const reportId = reportIdMatch[1];
                   const detailedPattern = new RegExp(`Rapor:\\s*${reportId},\\s*Arıza\\s*Kodu:`, 'i');
                   if (detailedPattern.test(displayNote)) {
                     const standalonePattern = new RegExp(`\\s*\\(Rapor:\\s*${reportId}\\)`, 'gi');
                     displayNote = displayNote.replace(standalonePattern, '');
                   }
                 }
                 displayNote = displayNote.replace(/\s*\[Durum:\s*(NEW|DEFECT|SCRAP)\]/gi, '').trim();

                 let resolvedLogName = l.materialName || '';
                 if (!resolvedLogName || resolvedLogName === 'Bilinmeyen Malzeme' || resolvedLogName === 'Bilinmeyen') {
                   const dictMat = inventoryService.getMaterialBySap(l.sapNo);
                   if (dictMat && dictMat.d) {
                     resolvedLogName = dictMat.d;
                   }
                 }
                 if (!resolvedLogName) {
                   resolvedLogName = 'Bilinmeyen Malzeme';
                 }

                return `
                  <tr data-group-date="${dayStr}" style="border-bottom: 1px solid rgba(30, 41, 59, 0.5); transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(30, 41, 59, 0.2)'" onmouseout="this.style.backgroundColor='transparent'">
                    <td style="padding: 1rem; color: #E2E8F0; white-space: nowrap; vertical-align: top; text-align: center;">${timeStr}</td>
                    <td style="padding: 1rem; color: #E2E8F0; font-weight: 500; white-space: nowrap; vertical-align: top; text-align: center;">${formatUser(l.user)}</td>
                    <td style="padding: 1rem; white-space: nowrap; vertical-align: top; text-align: center;">${badgeHtml}</td>
                    <td style="padding: 1rem; white-space: nowrap; vertical-align: top; text-align: center;">${directionHtml || '<span style="color: #475569; font-size: 0.85rem;">-</span>'}</td>
                    <td style="padding: 1rem; color: #E2E8F0; vertical-align: top;">
                      <div style="display: flex; flex-direction: column; gap: 4px;">
                        <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                          <span style="display: inline-flex; align-items: center; justify-content: center; height: 22px; box-sizing: border-box; padding: 0 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; line-height: 1; background-color: rgba(59, 130, 246, 0.1); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.2); white-space: nowrap; width: 85px; flex-shrink: 0;">SAP: ${l.sapNo}</span>
                          <span style="font-weight: 600; color: #FFF; font-size: 0.8rem; line-height: 1.2; margin-top: 3px;">${resolvedLogName}</span>
                        </div>
                        ${serialNo && serialNo !== '-' && serialNo.toUpperCase() !== 'N/A' ? `
                          <div style="font-size: 0.8rem; color: #10B981; font-weight: 600; font-family: monospace; display: flex; align-items: center; gap: 4px; margin-top: 2px;">
                            <i class="fa-solid fa-microchip" style="font-size: 0.75rem;"></i> Seri No: <span style="color: #FFF; font-weight: normal;">${serialNo}</span>
                          </div>
                        ` : ''}
                      </div>
                    </td>
                    <td style="padding: 1rem; color: ${qtyColor}; font-weight: 700; white-space: nowrap; vertical-align: top; text-align: center;">${qtyText} Adet</td>
                    <td style="padding: 1rem; color: #94A3B8; vertical-align: top;">${displayNote}</td>
                    ${isMaterialManager ? `
                     <td style="padding: 1rem; text-align: center; vertical-align: top;">
                       <button onclick="window.deleteDepoLog('${l.id}')" style="background: transparent; border: none; color: #EF4444; cursor: pointer; font-size: 1.1rem; padding: 4px 8px; border-radius: 4px; transition: all 0.2s;" onmouseover="this.style.backgroundColor='rgba(239, 68, 68, 0.1)'" onmouseout="this.style.backgroundColor='transparent'" title="Kayıt Sil">
                         <i class="fa-solid fa-trash-can"></i>
                       </button>
                     </td>
                     ` : ''}
                  </tr>
                `;
              }).join('');
              
              return headerRowHtml + rowsHtml;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

export const loadDepoHareketleriLogs = async () => {
  const container = document.getElementById('depo-hareketleri-container');
  if (container) {
    container.innerHTML = '<div style="text-align:center; padding: 2rem; color: #94A3B8;">Yükleniyor...</div>';
    try {
      const activeWhId = warehouseState.currentWarehouse?.id || 'MTA';
      const logs = await warehouseService.getLogs(activeWhId);
      (window as any).__cachedDepoLogs = logs;
      renderDepoHareketleriLogs();
    } catch (err: any) {
      console.error(err);
      container.innerHTML = `<div style="text-align:center; padding: 2rem; color: #EF4444;">Yüklenirken hata oluştu: ${err.message}</div>`;
    }
  }
};

export const deleteDepoLog = async (logId: string) => {
  if (!confirm("Bu hareket kaydını silmek istediğinize emin misiniz?")) {
    return;
  }
  try {
    await warehouseService.deleteLog(warehouseState.currentWarehouse.id, logId);
    (window as any).showToast('Başarılı', 'Kayıt silindi.', 'success');
    if (typeof (window as any).selectWarehouseAndNavigate === 'function') {
      (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err: any) {
    alert("Hata oluştu: " + err.message);
  }
};

export const clearAllDepoLogs = async () => {
  if (!confirm("Bu depoya ait tüm hareket geçmişini kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
    return;
  }
  try {
    (window as any).showToast('Bilgi', 'Temizleniyor, lütfen bekleyin...', 'info');
    await warehouseService.clearAllLogs(warehouseState.currentWarehouse.id);
    (window as any).showToast('Başarılı', 'Tüm hareket geçmişi başarıyla temizlendi.', 'success');
    if (typeof (window as any).selectWarehouseAndNavigate === 'function') {
      (window as any).selectWarehouseAndNavigate(warehouseState.currentWarehouse.id);
    }
  } catch (err: any) {
    alert("Hata oluştu: " + err.message);
  }
};

export const filterDepoHareketleri = (searchTerm: string) => {
  const term = searchTerm.toLowerCase().trim();
  if (!term) {
    renderDepoHareketleriLogs();
    return;
  }
  
  const filtered = ((window as any).__cachedDepoLogs || []).filter((l: any) => {
    const sap = String(l.sapNo || '').toLowerCase();
    const matName = String(l.materialName || '').toLowerCase();
    const note = String(l.note || '').toLowerCase();
    const user = String(l.user || '').toLowerCase();
    
    let opTypeStr = '';
    if (l.type === 'ADD') {
      if (l.note && l.note.includes('[Durum: DEFECT]')) {
        opTypeStr = 'sökülen girişi defect';
      } else if (l.note && l.note.includes('[Durum: SCRAP]')) {
        opTypeStr = 'hurda girişi';
      } else {
        opTypeStr = (l.oldQty !== undefined && l.oldQty > 0) ? 'stok artışı' : 'stok giriş';
      }
    } else if (l.type === 'REMOVE') {
      if (l.note && l.note.includes('[Durum: DEFECT]')) {
        opTypeStr = 'sökülen çıkışı defect';
      } else if (l.note && l.note.includes('[Durum: SCRAP]')) {
        opTypeStr = 'hurda çıkışı';
      } else {
        opTypeStr = 'stok çıkış';
      }
    } else if (l.type === 'TRANSFER') {
      opTypeStr = 'transfer';
    } else {
      opTypeStr = 'güncelleme';
    }

    return sap.includes(term) || matName.includes(term) || note.includes(term) || user.includes(term) || opTypeStr.includes(term);
  });
  
  renderDepoHareketleriLogs(filtered);
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
(window as any).toggleDateGroup = toggleDateGroup;
(window as any).renderDepoHareketleriLogs = renderDepoHareketleriLogs;
(window as any).loadDepoHareketleriLogs = loadDepoHareketleriLogs;
(window as any).deleteDepoLog = deleteDepoLog;
(window as any).clearAllDepoLogs = clearAllDepoLogs;
(window as any).filterDepoHareketleri = filterDepoHareketleri;
