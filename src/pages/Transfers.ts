import { dataService } from '../services/DataService';
import { warehouseService } from '../services/WarehouseService';
import { transferService } from '../services/TransferService';
import { authService } from '../services/AuthService';
import type { UserProfile } from '../services/UserService';
import type { TransferV2, TransferItem } from '../services/TransferService';



export const TransferPage = async (userProfile?: UserProfile | null) => {
  const isAdmin = userProfile?.role === 'ADMIN' || userProfile?.role === 'MALZEME_YONETIMI' || userProfile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
  const allWarehouses = dataService.getWarehouses();
  
  const filteredWarehouses = (isAdmin || !userProfile?.allowedWarehouses || userProfile.allowedWarehouses.length === 0)
    ? allWarehouses
    : allWarehouses.filter(w => userProfile.allowedWarehouses!.includes(w.id));

  // Load dispatches/transfers
  const transfers = await transferService.getTransfers();

  // Generated MSF number  const now = new Date();
  const day = String(new Date().getDate()).padStart(2, '0');
  const month = String(new Date().getMonth() + 1).padStart(2, '0');
  const year = new Date().getFullYear();
  const dateStr = `${day}${month}${year}`;
  const initialMsfNo = `MSF-${dateStr}-XXXX`;

  return `
    <div class="fade-in-up content-area">
      <h1 class="page-title"><i class="fa-solid fa-truck-ramp-box" style="color: var(--accent-cyan);"></i> Malzeme Transfer İşlemleri (MSF)</h1>
      
      <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem; align-items: stretch;">
        <!-- Transfer Form -->
        <div class="glass-panel" style="padding: 2rem; border: 1px solid rgba(0, 243, 255, 0.15); box-shadow: 0 4px 30px rgba(0, 243, 255, 0.05); display: flex; flex-direction: column;">
          <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 2rem; display: flex; align-items: center; justify-content: space-between; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px;">
            <span>Yeni Transfer Sevk Formu (MSF)</span>
            <span id="msf-no-display" style="font-family: monospace; font-size: 0.85rem; color: var(--accent-cyan); background: rgba(0, 243, 255, 0.06); padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.25); box-shadow: 0 0 8px rgba(0, 243, 255, 0.05);">${initialMsfNo}</span>
          </h3>
          
          <form id="transfer-form" style="display: flex; flex-direction: column; flex-grow: 1; justify-content: space-between; height: 100%;">
            <div>
              <input type="hidden" id="msf-no-input" value="${initialMsfNo}">
              
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
                <div class="form-group">
                  <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">NEREDEN (ÇIKIŞ SANTRALİ)</label>
                  <select id="from-site" class="cyber-input" required style="border: 1px solid rgba(255,255,255,0.08); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
                    <option value="">Depo Seçin</option>
                    ${filteredWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">NEREYE (VARIŞ SANTRALİ)</label>
                  <select id="to-site" class="cyber-input" required style="border: 1px solid rgba(255,255,255,0.08); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
                    <option value="">Depo Seçin</option>
                    ${allWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                  </select>
                </div>
              </div>

              <!-- Sevk Yöntemi -->
              <div class="form-group" style="margin-bottom: 1.5rem;">
                <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">SEVK YÖNTEMİ</label>
                <div style="display: flex; gap: 10px; margin-bottom: 1rem;">
                  <button type="button" id="delivery-person-btn" onclick="window.setDeliveryMethod('PERSON')" class="btn-cyber" style="flex: 1; text-align: center; justify-content: center; font-size: 0.8rem; padding: 0.5rem 1rem;">
                    <i class="fa-solid fa-user-tie" style="margin-right: 6px;"></i> Personel ile
                  </button>
                  <button type="button" id="delivery-cargo-btn" onclick="window.setDeliveryMethod('CARGO')" class="btn-cyber-outline" style="flex: 1; text-align: center; justify-content: center; font-size: 0.8rem; padding: 0.5rem 1rem;">
                    <i class="fa-solid fa-truck-fast" style="margin-right: 6px;"></i> Kargo ile
                  </button>
                </div>
                
                <div id="delivery-person-fields" class="form-group">
                  <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">TESLİM EDEN PERSONEL</label>
                  <input type="text" id="shipped-by" class="cyber-input" placeholder="Ad Soyad giriniz..." required style="border: 1px solid rgba(255,255,255,0.08); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
                </div>
                
                <div id="delivery-cargo-fields" class="form-group" style="display: none;">
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                    <div>
                      <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">KARGO FİRMASI</label>
                      <select id="cargo-carrier" class="cyber-input" style="border: 1px solid rgba(255,255,255,0.08); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
                        <option value="YURTICI">Yurtiçi Kargo</option>
                        <option value="ARAS">Aras Kargo</option>
                        <option value="MNG">MNG Kargo</option>
                        <option value="PTT">PTT Kargo</option>
                        <option value="SURAT">Sürat Kargo</option>
                      </select>
                    </div>
                    <div>
                      <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 4px; display: block; text-transform: uppercase;">TAKİP NUMARASI</label>
                      <input type="text" id="cargo-tracking-no" class="cyber-input" placeholder="Takip no giriniz..." style="border: 1px solid rgba(255,255,255,0.08); background: #0A0E17; color: #FFF; font-size: 0.78rem;">
                    </div>
                  </div>
                </div>
              </div>

              <!-- Materials List Title -->
              <div style="margin-top: 2rem; border-top: 1px solid rgba(255, 255, 255, 0.05); padding-top: 1.5rem; display: flex; flex-direction: column; flex-grow: 1;">
                <label style="font-weight: 700; font-size: 0.65rem; color: var(--text-muted); letter-spacing: 0.5px; margin-bottom: 12px; display: block; text-transform: uppercase;">SEVK EDİLECEK MALZEMELER</label>
                <div id="msf-items-container">
                  <div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 1.5rem; border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 8px;">
                    Lütfen önce bir Çıkış Santrali (Nereden) seçiniz.
                  </div>
                </div>
              </div>
            </div>
            
            <button type="submit" class="btn-cyber" style="width: 100%; margin-top: 2rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 8px; font-weight: 700; font-size: 0.85rem; letter-spacing: 0.5px;">
              SEVKİYATI BAŞLAT & MSF KAYDET <i class="fa-solid fa-paper-plane"></i>
            </button>
          </form>
        </div>

        <!-- Dispatches List -->
        <div class="glass-panel" style="padding: 2rem; border: 1px solid rgba(0, 243, 255, 0.15); box-shadow: 0 4px 30px rgba(0, 243, 255, 0.05); display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; margin: 0;">
              <i class="fa-solid fa-list-check" style="color: var(--accent-cyan);"></i> SON SEVKLER (MSF LİSTESİ)
            </h3>
            
            <!-- Filters -->
            <div style="display: flex; gap: 6px;">
              <button type="button" onclick="window.filterMsfTransfers('HEPSİ')" id="filter-msf-all" class="btn-cyber" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">HEPSİ</button>
              <button type="button" onclick="window.filterMsfTransfers('YOLDA')" id="filter-msf-yolda" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">YOLDA</button>
              <button type="button" onclick="window.filterMsfTransfers('TAMAMLANDI')" id="filter-msf-tamamlandi" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">TAMAMLANAN</button>
              <button type="button" onclick="window.filterMsfTransfers('IPTAL_EDILDI')" id="filter-msf-iptal" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">İPTAL EDİLEN</button>
            </div>
          </div>
          
          <div id="msf-list-container" style="flex-grow: 1; display: flex; flex-direction: column;">
            <!-- Will be populated by JS -->
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global variables to hold State
let departureInventory: any[] = [];
let currentDeliveryMethod: 'PERSON' | 'CARGO' = 'PERSON';
let msfRowCounter = 0;
let activeFilter = 'HEPSİ';
let loadedTransfersList: any[] = [];
let warehousesMap: Record<string, string> = {};
let msfListUnsubscribe: (() => void) | null = null;
let msfPage = 1;
const msfPageSize = 5;

(window as any).changeMsfPage = (delta: number) => {
  msfPage += delta;
  (window as any).renderMsfCards();
};

(window as any).initTransferLogic = async () => {
  // Populate warehouses map
  const allWh = dataService.getWarehouses();
  allWh.forEach(w => { warehousesMap[w.id] = w.name; });
  for (let i = 1; i <= 15; i++) {
    const tName = `Team ${String(i).padStart(2, '0')}`;
    const tId = `team_${tName.replace(/\s+/g, '_')}`;
    warehousesMap[tId] = `${tName} Deposu`;
  }

  const fromSiteSelect = document.getElementById('from-site') as HTMLSelectElement;
  const form = document.getElementById('transfer-form');

  // Load departure inventory when warehouse is selected
  if (fromSiteSelect) {
    fromSiteSelect.addEventListener('change', async () => {
      const warehouseId = fromSiteSelect.value;
      const itemsContainer = document.getElementById('msf-items-container');
      if (itemsContainer) itemsContainer.innerHTML = '';
      msfRowCounter = 0;

      const display = document.getElementById('msf-no-display');
      const input = document.getElementById('msf-no-input') as HTMLInputElement;

      if (!warehouseId) {
        departureInventory = [];
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`;
        if (display) display.innerText = `MSF-${dateStr}-XXXX`;
        if (input) input.value = `MSF-${dateStr}-XXXX`;
        return;
      }

      // 1. Update MSF number display with live preview from Firestore
      try {
        const nextSeq = await transferService.previewNextSequenceNumber(warehouseId);
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`;
        const newMsfNo = `MSF-${dateStr}-${nextSeq}`;

        if (display) display.innerText = newMsfNo;
        if (input) input.value = newMsfNo;
      } catch (e) {
        console.error("Failed to update MSF number preview:", e);
      }
      
      // 2. Show loading indicator and load inventory
      if (itemsContainer) {
        itemsContainer.innerHTML = '<div style="color: var(--accent-cyan); font-size: 0.8rem; text-align: center; padding: 1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Envanter Yükleniyor...</div>';
      }

      try {
        departureInventory = await warehouseService.getInventory(warehouseId);
        if (itemsContainer) {
          itemsContainer.innerHTML = '';
          // Add initial empty row
          (window as any).addMsfItemRow();
        }
      } catch (err) {
        console.error("Failed to load inventory:", err);
        departureInventory = [];
        if (itemsContainer) itemsContainer.innerHTML = '<div style="color: #ef4444; font-size: 0.8rem; text-align: center; padding: 1rem;">Envanter yüklenemedi!</div>';
      }
    });
  }

  // Delivery Method toggles
  (window as any).setDeliveryMethod = (method: 'PERSON' | 'CARGO') => {
    currentDeliveryMethod = method;
    const personBtn = document.getElementById('delivery-person-btn');
    const cargoBtn = document.getElementById('delivery-cargo-btn');
    const personFields = document.getElementById('delivery-person-fields');
    const cargoFields = document.getElementById('delivery-cargo-fields');
    const shippedByInput = document.getElementById('shipped-by') as HTMLInputElement;

    if (method === 'PERSON') {
      personBtn?.classList.remove('btn-cyber-outline');
      personBtn?.classList.add('btn-cyber');
      cargoBtn?.classList.remove('btn-cyber');
      cargoBtn?.classList.add('btn-cyber-outline');

      if (personFields) personFields.style.display = 'block';
      if (cargoFields) cargoFields.style.display = 'none';
      if (shippedByInput) shippedByInput.required = true;
    } else {
      personBtn?.classList.remove('btn-cyber');
      personBtn?.classList.add('btn-cyber-outline');
      cargoBtn?.classList.remove('btn-cyber-outline');
      cargoBtn?.classList.add('btn-cyber');

      if (personFields) personFields.style.display = 'none';
      if (cargoFields) cargoFields.style.display = 'block';
      if (shippedByInput) shippedByInput.required = false;
    }
  };

  // Add Item Row dynamically
  (window as any).addMsfItemRow = () => {
    const container = document.getElementById('msf-items-container');
    if (!container) return;
    
    // Clear loading if any
    const loader = container.querySelector('div');
    if (loader && loader.innerText.includes('Yükleniyor')) {
      container.innerHTML = '';
    }

    const rowIdx = msfRowCounter++;
    const rowHTML = `
      <div id="msf-row-${rowIdx}" class="msf-item-row" style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; position: relative;">
        <div style="display: grid; grid-template-columns: 2fr 1fr 40px; gap: 0.75rem; align-items: start;">
          <div style="position: relative;">
            <input type="text" id="msf-search-${rowIdx}" class="cyber-input msf-autocomplete" data-row="${rowIdx}" placeholder="Malzeme SAP No veya Adı ara..." autocomplete="off">
            <div id="msf-results-${rowIdx}" class="search-results-dropdown hidden" style="z-index: 99999;"></div>
            <input type="hidden" id="msf-sap-${rowIdx}">
            <input type="hidden" id="msf-name-${rowIdx}">
            <div id="msf-stock-lbl-${rowIdx}" style="font-size: 0.65rem; color: var(--text-muted); margin-top: 4px; font-weight: bold;"></div>
          </div>
          <div>
            <input type="number" id="msf-qty-${rowIdx}" class="cyber-input" placeholder="Miktar" value="1" min="1" disabled>
          </div>
          <div>
            <button type="button" onclick="window.removeMsfItemRow(${rowIdx})" class="btn-cyber-mini" style="background: rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2); color: #ef4444; height: 38px; width: 38px; display: flex; align-items: center; justify-content: center; padding: 0;" title="Satırı Sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </div>
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', rowHTML);

    // Set up Autocomplete listener for this row
    const searchInput = document.getElementById(`msf-search-${rowIdx}`) as HTMLInputElement;
    const resultsDiv = document.getElementById(`msf-results-${rowIdx}`) as HTMLDivElement;

    if (searchInput && resultsDiv) {
      searchInput.addEventListener('input', () => {
        const query = searchInput.value.toLowerCase().trim();
        if (query.length < 2) {
          resultsDiv.classList.add('hidden');
          return;
        }

        const matches = departureInventory.filter(item => {
          const sap = String(item.sapNo || '').toLowerCase();
          const name = String(item.name || item.description || '').toLowerCase();
          return sap.includes(query) || name.includes(query);
        });

        resultsDiv.innerHTML = matches.slice(0, 10).map(m => `
          <div class="search-item" onclick="window.selectMsfRowMaterial(${rowIdx}, '${m.sapNo}', '${(m.name || m.description || 'Bilinmeyen').replace(/'/g, "\\'")}', ${m.quantity})">
            <div style="font-weight: 700; color: var(--accent-cyan);">${m.sapNo}</div>
            <div style="font-size: 0.7rem; color: var(--text-main); font-weight: 500;">${m.name || m.description}</div>
            <div style="font-size: 0.65rem; color: #14F195; font-weight: 700; margin-top: 2px;">Mevcut Stok: ${m.quantity} Adet</div>
          </div>
        `).join('');

        if (matches.length > 0) {
          resultsDiv.classList.remove('hidden');
        } else {
          resultsDiv.innerHTML = '<div style="padding: 0.75rem; color: #ef4444; font-size: 0.75rem;">Stokta eşleşen malzeme bulunamadı.</div>';
          resultsDiv.classList.remove('hidden');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (e.target !== searchInput && !resultsDiv.contains(e.target as Node)) {
          resultsDiv.classList.add('hidden');
        }
      });
    }
  };

  (window as any).removeMsfItemRow = (idx: number) => {
    const row = document.getElementById(`msf-row-${idx}`);
    if (row) row.remove();
  };

  (window as any).selectMsfRowMaterial = (rowIdx: number, sapNo: string, name: string, maxQty: number) => {
    const searchInput = document.getElementById(`msf-search-${rowIdx}`) as HTMLInputElement;
    const sapInput = document.getElementById(`msf-sap-${rowIdx}`) as HTMLInputElement;
    const nameInput = document.getElementById(`msf-name-${rowIdx}`) as HTMLInputElement;
    const qtyInput = document.getElementById(`msf-qty-${rowIdx}`) as HTMLInputElement;
    const label = document.getElementById(`msf-stock-lbl-${rowIdx}`) as HTMLDivElement;
    const resultsDiv = document.getElementById(`msf-results-${rowIdx}`) as HTMLDivElement;

    if (searchInput && sapInput && nameInput && qtyInput && label) {
      searchInput.value = `${sapNo} - ${name}`;
      sapInput.value = sapNo;
      nameInput.value = name;
      
      qtyInput.disabled = false;
      qtyInput.max = maxQty.toString();
      qtyInput.value = "1";

      label.innerHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px; margin-top: 8px; line-height: 1.4; color: var(--text-main);">
          <div style="font-weight: 700; font-size: 0.8rem; margin-bottom: 4px; word-break: break-word;">${name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.68rem; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 4px;">
            <span style="color: var(--text-muted);">SAP Kod: <strong style="color: var(--accent-cyan); font-family: monospace;">${sapNo}</strong></span>
            <span style="color: #14F195;"><i class="fa-solid fa-circle-check"></i> Stok: <strong style="font-size: 0.75rem;">${maxQty} Adet</strong></span>
          </div>
        </div>
      `;
      
      if (resultsDiv) resultsDiv.classList.add('hidden');
    }
  };

  // Form Submission
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromSite = (document.getElementById('from-site') as HTMLSelectElement).value;
      const toSite = (document.getElementById('to-site') as HTMLSelectElement).value;
      const msfNo = (document.getElementById('msf-no-input') as HTMLInputElement).value;

      if (!fromSite || !toSite || fromSite === toSite) {
        alert('Lütfen geçerli çıkış ve varış depoları seçin.');
        return;
      }

      // Collect items from rows
      const items: TransferItem[] = [];
      const rows = document.querySelectorAll('#msf-items-container .msf-item-row');
      
      let validationError = null;

      rows.forEach(row => {
        const idStr = row.id.split('-').pop();
        const sap = (document.getElementById(`msf-sap-${idStr}`) as HTMLInputElement).value;
        const name = (document.getElementById(`msf-name-${idStr}`) as HTMLInputElement).value;
        const qtyVal = parseInt((document.getElementById(`msf-qty-${idStr}`) as HTMLInputElement).value);
        const qtyMax = parseInt((document.getElementById(`msf-qty-${idStr}`) as HTMLInputElement).max);

        if (!sap || !name || isNaN(qtyVal) || qtyVal <= 0) {
          validationError = "Lütfen sevk listesindeki tüm malzeme satırlarını doldurun.";
          return;
        }

        if (qtyVal > qtyMax) {
          validationError = `${sap} kodlu malzeme için sevk miktarı (${qtyVal}), mevcut çıkış stoğunu (${qtyMax}) aşamaz!`;
          return;
        }

        // Check duplicates
        const existing = items.find(i => i.materialCode === sap);
        if (existing) {
          existing.quantity += qtyVal;
        } else {
          items.push({
            materialCode: sap,
            materialName: name,
            quantity: qtyVal
          });
        }
      });

      if (validationError) {
        alert(validationError);
        return;
      }

      if (items.length === 0) {
        alert("Lütfen en az bir malzeme satırı ekleyin.");
        return;
      }

      // Prepare payload
      const userEmail = authService.getCurrentUser()?.email || 'Admin';
      const payload: Omit<TransferV2, 'id' | 'createdAt'> = {
        msfNo,
        fromSiteId: fromSite,
        toSiteId: toSite,
        items,
        deliveryMethod: currentDeliveryMethod,
        status: 'YOLDA',
        requestedBy: userEmail
      };

      if (currentDeliveryMethod === 'PERSON') {
        payload.shippedBy = (document.getElementById('shipped-by') as HTMLInputElement).value;
      } else {
        payload.cargoCarrier = (document.getElementById('cargo-carrier') as HTMLSelectElement).value;
        payload.cargoTrackingNo = (document.getElementById('cargo-tracking-no') as HTMLInputElement).value;
      }

      const submitBtn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sevk Kaydediliyor...';

      try {
        await transferService.createMultiItemTransfer(payload);
        alert(`✅ ${msfNo} nolu sevk başarıyla oluşturuldu ve stoklar düşüldü!`);
        (window as any).navigate('transfers');
      } catch (err: any) {
        console.error(err);
        alert('Sevk oluşturulurken hata: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }

  // Load and display dispatches list
  await (window as any).loadMsfList();
};

// Load transfers list and filter
(window as any).loadMsfList = async () => {
  const container = document.getElementById('msf-list-container');
  if (!container) return;

  if (msfListUnsubscribe) {
    msfListUnsubscribe();
    msfListUnsubscribe = null;
  }

  container.innerHTML = '<div style="color: var(--accent-cyan); text-align: center; padding: 2rem;"><i class="fa-solid fa-spinner fa-spin"></i> Sevkler Listeleniyor...</div>';
  
  try {
    const { db } = await import('../firebase');
    const { collection, query, orderBy, onSnapshot } = await import('firebase/firestore');

    const q = query(collection(db, 'transfers'), orderBy('createdAt', 'desc'));

    msfListUnsubscribe = onSnapshot(q, (snapshot) => {
      loadedTransfersList = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data()
      }));
      (window as any).renderMsfCards();
    }, (err) => {
      console.error(err);
      container.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 2rem;">Kayıtlar yüklenemedi!</div>';
    });
  } catch (e) {
    container.innerHTML = '<div style="color: #ef4444; text-align: center; padding: 2rem;">Kayıtlar yüklenemedi!</div>';
  }
};

(window as any).filterMsfTransfers = (status: string) => {
  activeFilter = status;
  msfPage = 1;
  // Update tab highlights
  ['all', 'yolda', 'tamamlandi', 'iptal'].forEach(t => {
    const el = document.getElementById(`filter-msf-${t}`);
    if (el) {
      el.className = 'btn-cyber-outline';
      el.style.fontSize = '0.65rem';
      el.style.padding = '4px 8px';
      el.style.fontWeight = '600';
    }
  });

  const tabId = status === 'HEPSİ' ? 'all' : status === 'YOLDA' ? 'yolda' : status === 'TAMAMLANDI' ? 'tamamlandi' : 'iptal';
  const activeEl = document.getElementById(`filter-msf-${tabId}`);
  if (activeEl) {
    activeEl.className = 'btn-cyber';
    activeEl.style.fontSize = '0.65rem';
    activeEl.style.padding = '4px 8px';
    activeEl.style.fontWeight = '600';
  }

  (window as any).renderMsfCards();
};

(window as any).renderMsfCards = () => {
  const container = document.getElementById('msf-list-container');
  if (!container) return;

  // Filter list
  let filtered = loadedTransfersList;

  // Hide other teams' dispatches for non-admin users
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdminUser = currentUser?.role === 'ADMIN' || currentUser?.role === 'MALZEME_YONETIMI' || currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
  if (!isAdminUser) {
    const allowedWh = currentUser?.allowedWarehouses || [];
    filtered = filtered.filter(t => 
      allowedWh.includes(t.fromSiteId) || allowedWh.includes(t.toSiteId)
    );
  }

  if (activeFilter !== 'HEPSİ') {
    filtered = filtered.filter(t => {
      // Map old status to TransferV2 statuses
      const s = t.status || 'YOLDA';
      const normalizedStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
      return normalizedStatus === activeFilter;
    });
  }

  const totalCount = filtered.length;
  if (totalCount === 0) {
    container.innerHTML = `
      <div style="padding: 3rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.01); border-radius: 12px; border: 1px dashed rgba(255,255,255,0.05);">
        <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.2; color: var(--accent-cyan);"></i>
        <p>Eşleşen transfer kaydı bulunamadı.</p>
      </div>
    `;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / msfPageSize));
  if (msfPage > totalPages) {
    msfPage = totalPages;
  }
  if (msfPage < 1) {
    msfPage = 1;
  }

  const startIndex = (msfPage - 1) * msfPageSize;
  const endIndex = startIndex + msfPageSize;
  const pagedItems = filtered.slice(startIndex, endIndex);

  const cardsHtml = pagedItems.map(t => {
    const isV2 = Array.isArray(t.items);
    const msfNo = t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`;
    const fromName = warehousesMap[t.fromSiteId] || t.fromSiteId;
    const toName = warehousesMap[t.toSiteId] || t.toSiteId;
    
    // Status mappings
    const s = t.status || 'YOLDA';
    const normStatus = s === 'PENDING' ? 'YOLDA' : s === 'COMPLETED' ? 'TAMAMLANDI' : s === 'REJECTED' ? 'IPTAL_EDILDI' : s;
    
    let statusStyle = '';
    let statusText = '';
    let cardBorderColor = 'rgba(255,255,255,0.05)';
    let statusGlow = 'rgba(0,0,0,0)';
    
    if (normStatus === 'YOLDA') {
      statusStyle = 'background: rgba(245, 158, 11, 0.08); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.25);';
      statusText = '<i class="fa-solid fa-circle-nodes fa-pulse" style="margin-right: 4px;"></i> YOLDA';
      cardBorderColor = '#F59E0B';
      statusGlow = 'rgba(245, 158, 11, 0.1)';
    } else if (normStatus === 'TAMAMLANDI') {
      let shelfInfo = '';
      if (Array.isArray(t.receivedItemsDetails) && t.receivedItemsDetails.length > 0) {
        shelfInfo = ` (${t.receivedItemsDetails.map((it: any) => it.shelfNo || 'Raf Belirtilmedi').join(', ')})`;
      }
      statusStyle = 'background: rgba(16, 185, 129, 0.08); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.25);';
      statusText = `<i class="fa-solid fa-circle-check" style="margin-right: 4px;"></i> TESLİM EDİLDİ${shelfInfo}`;
      cardBorderColor = '#10B981';
      statusGlow = 'rgba(16, 185, 129, 0.1)';
    } else {
      statusStyle = 'background: rgba(239, 68, 68, 0.08); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.25);';
      statusText = '<i class="fa-solid fa-ban" style="margin-right: 4px;"></i> İPTAL EDİLDİ';
      cardBorderColor = '#EF4444';
      statusGlow = 'rgba(239, 68, 68, 0.1)';
    }

    // Direction badge based on allowedWarehouses
    const allowedWh = currentUser?.allowedWarehouses || [];
    const isIncoming = allowedWh.includes(t.toSiteId);
    const isOutgoing = allowedWh.includes(t.fromSiteId);
    let directionBadge = '';
    if (isIncoming && !isOutgoing) {
      directionBadge = `<span style="background: rgba(59, 130, 246, 0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-down-left"></i> GELEN</span>`;
    } else if (isOutgoing && !isIncoming) {
      directionBadge = `<span style="background: rgba(168, 85, 247, 0.12); color: #a855f7; border: 1px solid rgba(168,85,247,0.25); font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-up-right"></i> GİDEN</span>`;
    }

    // Delivery method string
    let deliveryMethodStr = 'Klasik Transfer';
    let deliveryDetailStr = 'Bilinmiyor';
    if (t.deliveryMethod === 'PERSON') {
      deliveryMethodStr = '<i class="fa-solid fa-user-tie"></i> Personel';
      deliveryDetailStr = t.shippedBy || 'Belirtilmedi';
    } else if (t.deliveryMethod === 'CARGO') {
      deliveryMethodStr = '<i class="fa-solid fa-truck-fast"></i> Kargo';
      deliveryDetailStr = `${t.cargoCarrier || 'Kargo'} (${t.cargoTrackingNo || 'Belirtilmedi'})`;
    }

    // Items list markup
    let itemsMarkup = '';
    if (isV2) {
      itemsMarkup = t.items.map((item: TransferItem) => `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.03); padding: 5px 0;">
          <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
            <span style="font-family: monospace; font-size: 0.7rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 6px rgba(0,243,255,0.05);">${item.materialCode}</span>
            <span>${item.materialName}</span>
          </span>
          <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 1px 8px; border-radius: 20px; box-shadow: 0 0 8px rgba(20,241,149,0.05);">${item.quantity} Adet</span>
        </div>
      `).join('');
    } else {
      itemsMarkup = `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.03); padding: 5px 0;">
          <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 8px; font-size: 0.76rem;">
            <span style="font-family: monospace; font-size: 0.7rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px; box-shadow: 0 0 6px rgba(0,243,255,0.05);">${t.materialCode}</span>
            <span>${t.materialName}</span>
          </span>
          <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 1px 8px; border-radius: 20px; box-shadow: 0 0 8px rgba(20,241,149,0.05);">${t.quantity} Adet</span>
        </div>
      `;
    }

    const isReceiver = currentUser?.allowedWarehouses?.includes(t.toSiteId) || currentUser?.role === 'ADMIN' || currentUser?.role === 'MALZEME_YONETIMI';
    const showActions = normStatus === 'YOLDA' && isReceiver;

    const createdDateStr = t.createdAt?.toDate 
      ? t.createdAt.toDate().toLocaleString('tr-TR') 
      : (t.createdAt?.seconds ? new Date(t.createdAt.seconds * 1000).toLocaleString('tr-TR') : 'Bugün');
      
    const resolvedDateStrHTML = t.resolvedAt?.toDate 
      ? t.resolvedAt.toDate().toLocaleString('tr-TR') 
      : (t.resolvedAt?.seconds ? new Date(t.resolvedAt.seconds * 1000).toLocaleString('tr-TR') : (normStatus === 'YOLDA' ? '<span style="color: #F59E0B; font-weight:bold;">Yolda</span>' : '---'));

    return `
      <div class="glass-panel" style="padding: 1.25rem; margin-bottom: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 12px; transition: all 0.3s ease; border: 1px solid rgba(255, 255, 255, 0.04); border-left: 4px solid ${cardBorderColor}; box-shadow: 0 4px 20px rgba(0,0,0,0.15);" onmouseover="this.style.background='rgba(15, 23, 42, 0.55)'; this.style.transform='translateY(-2px)';" onmouseout="this.style.background='rgba(15, 23, 42, 0.4)'; this.style.transform='none';">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.6rem; margin-bottom: 0.6rem;">
          <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
            <span style="font-family: monospace; font-size: 1rem; font-weight: 800; color: var(--accent-cyan); letter-spacing: 0.5px;">${msfNo}</span>
            ${directionBadge}
            <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700; color: var(--text-main); background: rgba(0, 0, 0, 0.2); padding: 3px 10px; border-radius: 20px; border: 1px solid rgba(255,255,255,0.04);">
              <i class="fa-solid fa-warehouse" style="color: #64748B;"></i>
              <span>${fromName}</span>
              <i class="fa-solid fa-arrow-right-long" style="color: var(--accent-cyan); font-size: 0.75rem;"></i>
              <i class="fa-solid fa-location-dot" style="color: #EF4444;"></i>
              <span>${toName}</span>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <button onclick="window.printMsfVoucher('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: var(--text-main); border-color: rgba(255,255,255,0.15); background: transparent; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.color='var(--accent-cyan)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.15)'; this.style.color='var(--text-main)'">
              <i class="fa-solid fa-print"></i> Yazdır
            </button>
            
            ${showActions ? `
              <button onclick="window.rejectMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'; this.style.borderColor='#EF4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.3)'">
                <i class="fa-solid fa-ban"></i> Reddet
              </button>
              <button onclick="window.approveMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 12px; color: #10B981; border-color: rgba(16, 185, 129, 0.3); background: rgba(16, 185, 129, 0.08); font-weight: 700; transition: all 0.2s; box-shadow: 0 0 10px rgba(16,185,129,0.05);" onmouseover="this.style.background='rgba(16,185,129,0.18)'; this.style.borderColor='#10B981'; this.style.boxShadow='0 0 15px rgba(16,185,129,0.15)';" onmouseout="this.style.background='rgba(16,185,129,0.08)'; this.style.borderColor='rgba(16, 185, 129, 0.3)'; this.style.boxShadow='0 0 10px rgba(16,185,129,0.05)'">
                <i class="fa-solid fa-circle-check"></i> Teslim Al
              </button>
            ` : ''}

            <span style="${statusStyle} font-size: 0.68rem; font-weight: 800; padding: 4px 12px; border-radius: 30px; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 8px ${statusGlow};">
              ${statusText}
            </span>
          </div>
        </div>

        <!-- Shipping & Metadata Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 8px; padding: 8px 12px; font-size: 0.72rem; margin-bottom: 0.75rem;">
          <div>
            <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-user-circle"></i> TALEBİ OLUŞTURAN</span>
            <span style="color: var(--text-main); font-weight: 600; font-family: monospace; font-size: 0.7rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${t.requestedBy}">${t.requestedBy}</span>
          </div>
          <div>
            <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-paper-plane"></i> SEVK YÖNTEMİ</span>
            <span style="color: var(--text-main); font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">${deliveryMethodStr}</span>
          </div>
          <div>
            <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-info"></i> TAŞIYICI DETAYI</span>
            <span style="color: var(--text-main); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;" title="${deliveryDetailStr}">${deliveryDetailStr}</span>
          </div>
          <div>
            <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-clock"></i> GÖNDERİM TARİHİ</span>
            <span style="color: var(--text-main); font-weight: 600;">${createdDateStr}</span>
          </div>
          <div>
            <span style="color: #64748B; font-weight: 700; font-size: 0.58rem; display: block; text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 3px;"><i class="fa-solid fa-circle-check"></i> TESLİM TARİHİ</span>
            <span style="color: var(--text-main); font-weight: 600;">${resolvedDateStrHTML}</span>
          </div>
        </div>

        <!-- Materials Section -->
        <div style="background: rgba(0,0,0,0.1); border: 1px solid rgba(255,255,255,0.02); border-radius: 8px; padding: 8px 12px;">
          <span style="font-size: 0.6rem; color: #64748B; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; display: block; margin-bottom: 6px;"><i class="fa-solid fa-box-open"></i> Sevk Edilen Malzemeler</span>
          <div style="font-size: 0.74rem; display: flex; flex-direction: column; gap: 3px;">
            ${itemsMarkup}
          </div>
        </div>

        ${t.rejectionReason ? `
          <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 8px; padding: 8px 12px; font-size: 0.72rem; color: #ef4444; margin-top: 0.6rem; display: flex; align-items: start; gap: 8px;">
            <i class="fa-solid fa-circle-info" style="margin-top: 2px; font-size: 0.85rem;"></i>
            <div>
              <strong>Red/İptal Gerekçesi:</strong> ${t.rejectionReason}
            </div>
          </div>
        ` : ''}

      </div>
    `;
  }).join('');

  // pagination controls markup
  const paginationMarkup = `
    <div style="display: flex; justify-content: center; align-items: center; gap: 15px; margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.03);">
      <button onclick="window.changeMsfPage(-1)" ${msfPage === 1 
        ? 'disabled style="font-family: \'Rajdhani\', sans-serif; font-size: 0.75rem; font-weight: bold; padding: 6px 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03); background: rgba(255,255,255,0.01); color: var(--text-muted); pointer-events: none; opacity: 0.45; transition: all 0.2s;"' 
        : 'style="font-family: \'Rajdhani\', sans-serif; font-size: 0.75rem; font-weight: bold; padding: 6px 15px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.25); background: rgba(0, 243, 255, 0.04); color: var(--accent-cyan); cursor: pointer; transition: all 0.2s; box-shadow: 0 0 10px rgba(0, 243, 255, 0.04);" onmouseover="this.style.background=\'rgba(0, 243, 255, 0.12)\'; this.style.boxShadow=\'0 0 15px rgba(0, 243, 255, 0.25)\'" onmouseout="this.style.background=\'rgba(0, 243, 255, 0.04)\'; this.style.boxShadow=\'0 0 10px rgba(0, 243, 255, 0.04)\'"'}>
        <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
      </button>
      
      <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.82rem; color: var(--text-main); background: rgba(0, 0, 0, 0.35); padding: 6px 16px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.04); box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.2);">
        Sayfa ${msfPage} / ${totalPages} <span style="color: var(--text-muted); font-size: 0.72rem; margin-left: 5px; font-weight: 600;">(Toplam: ${totalCount})</span>
      </span>
      
      <button onclick="window.changeMsfPage(1)" ${msfPage === totalPages 
        ? 'disabled style="font-family: \'Rajdhani\', sans-serif; font-size: 0.75rem; font-weight: bold; padding: 6px 15px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.03); background: rgba(255,255,255,0.01); color: var(--text-muted); pointer-events: none; opacity: 0.45; transition: all 0.2s;"' 
        : 'style="font-family: \'Rajdhani\', sans-serif; font-size: 0.75rem; font-weight: bold; padding: 6px 15px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.25); background: rgba(0, 243, 255, 0.04); color: var(--accent-cyan); cursor: pointer; transition: all 0.2s; box-shadow: 0 0 10px rgba(0, 243, 255, 0.04);" onmouseover="this.style.background=\'rgba(0, 243, 255, 0.12)\'; this.style.boxShadow=\'0 0 15px rgba(0, 243, 255, 0.25)\'" onmouseout="this.style.background=\'rgba(0, 243, 255, 0.04)\'; this.style.boxShadow=\'0 0 10px rgba(0, 243, 255, 0.04)\'"'}>
        Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
      </button>
    </div>
  `;

  container.innerHTML = cardsHtml + paginationMarkup;
};

// Approve Multi-Item Transfer
(window as any).approveMsfTransfer = async (transferId: string) => {
  if (!confirm("Sevk malzemelerini eksiksiz teslim aldığınızı onaylıyor musunuz?\nKabul edildiğinde malzemeler varış deposunun stoğuna eklenecektir.")) return;

  const adminEmail = authService.getCurrentUser()?.email || 'Admin';
  
  try {
    const t = loadedTransfersList.find(x => x.id === transferId);
    if (!t) return;
    
    const isV2 = Array.isArray(t.items);
    if (isV2) {
      await transferService.approveMultiItemTransfer(transferId, adminEmail);
    } else {
      // Legacy compatibility
      await transferService.approveTransfer(t, adminEmail);
    }
    
    alert("✅ Sevk başarıyla teslim alındı ve stoğa girildi!");
    (window as any).navigate('transfers');
  } catch (err: any) {
    console.error(err);
    alert("Kabul işlemi sırasında hata oluştu: " + err.message);
  }
};

// Reject Multi-Item Transfer
(window as any).rejectMsfTransfer = async (transferId: string) => {
  const reason = prompt("Sevk talebini reddetme / iptal etme gerekçesini giriniz:\n(İptal edildiğinde tüm stoklar çıkış deposuna geri iade edilecektir.)");
  if (reason === null) return;
  if (!reason.trim()) {
    alert("Lütfen bir iptal gerekçesi belirtin!");
    return;
  }

  const adminEmail = authService.getCurrentUser()?.email || 'Admin';
  
  try {
    const t = loadedTransfersList.find(x => x.id === transferId);
    if (!t) return;

    const isV2 = Array.isArray(t.items);
    if (isV2) {
      await transferService.rejectMultiItemTransfer(transferId, adminEmail, reason);
    } else {
      // Legacy compatibility
      await transferService.rejectTransfer(transferId, adminEmail, reason);
    }
    
    alert("❌ Sevk iptal edildi ve stoklar çıkış deposuna geri iade edildi.");
    (window as any).navigate('transfers');
  } catch (err: any) {
    console.error(err);
    alert("İptal işlemi sırasında hata oluştu: " + err.message);
  }
};

// Print MSF Voucher
(window as any).printMsfVoucher = (transferId: string) => {
  const transfer = loadedTransfersList.find(x => x.id === transferId);
  if (!transfer) return;

  const msfNo = transfer.msfNo || `TRF-${transfer.id?.substring(0, 8).toUpperCase()}`;
  const fromName = warehousesMap[transfer.fromSiteId] || transfer.fromSiteId;
  const toName = warehousesMap[transfer.toSiteId] || transfer.toSiteId;
  const dateStr = transfer.createdAt?.toDate ? transfer.createdAt.toDate().toLocaleString('tr-TR') : new Date().toLocaleString('tr-TR');
  
  let deliveryDetails = '';
  if (transfer.deliveryMethod === 'PERSON') {
    deliveryDetails = `<strong>Teslimat Tipi:</strong> Personel ile<br><strong>Taşıyan Kişi:</strong> ${transfer.shippedBy || 'Belirtilmedi'}`;
  } else if (transfer.deliveryMethod === 'CARGO') {
    deliveryDetails = `<strong>Teslimat Tipi:</strong> Kargo ile gönderildi<br><strong>Kargo Firması:</strong> ${transfer.cargoCarrier || 'Belirtilmedi'}<br><strong>Takip / Fatura No:</strong> ${transfer.cargoTrackingNo || 'Belirtilmedi'}`;
  } else {
    deliveryDetails = `<strong>Teslimat Tipi:</strong> Depolar Arası Klasik Transfer`;
  }

  const items = Array.isArray(transfer.items) 
    ? transfer.items 
    : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

  const tableRows = items.map((it: any, idx: number) => `
    <tr>
      <td style="border: 1px solid #000; padding: 6px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 6px; font-family: monospace;">${it.materialCode}</td>
      <td style="border: 1px solid #000; padding: 6px;">${it.materialName}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${it.quantity}</td>
      <td style="border: 1px solid #000; padding: 6px; text-align: center;">Adet</td>
    </tr>
  `).join('');

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>Malzeme Sevk Formu - ${msfNo}</title>
        <style>
          body {
            font-family: 'Segoe UI', Arial, sans-serif;
            margin: 20px;
            color: #000;
            background: #fff;
            font-size: 12px;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #000;
            padding-bottom: 15px;
            margin-bottom: 20px;
          }
          .logo {
            font-size: 20px;
            font-weight: bold;
            letter-spacing: 1px;
          }
          .title {
            text-align: right;
          }
          .title h1 {
            margin: 0;
            font-size: 18px;
            font-weight: 800;
          }
          .title span {
            font-size: 12px;
            color: #555;
          }
          .meta-table {
            width: 100%;
            margin-bottom: 20px;
            border-collapse: collapse;
          }
          .meta-table td {
            padding: 4px 0;
            vertical-align: top;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            margin-bottom: 30px;
          }
          .items-table th {
            border: 1px solid #000;
            background-color: #f2f2f2;
            padding: 8px;
            text-align: left;
            font-weight: bold;
          }
          .signatures {
            margin-top: 50px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            width: 30%;
            text-align: center;
            border-top: 1px dashed #000;
            padding-top: 10px;
          }
          @media print {
            body { margin: 10px; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="no-print" style="margin-bottom: 20px; background: #e5e7eb; padding: 10px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center;">
          <span style="color:#374151; font-weight: bold;">MSF Yazdırma Önizleme</span>
          <button onclick="window.print()" style="background:#10b981; color:#fff; border:none; padding: 6px 15px; border-radius: 4px; font-weight:bold; cursor:pointer;">
            Yazdır / PDF Kaydet
          </button>
        </div>

        <div class="header">
          <div class="logo">
            <span style="color: #000;">DEMİRER</span> <span style="font-weight: 300;">HOLDİNG</span>
          </div>
          <div class="title">
            <h1>MALZEME SEVK FORMU (MSF)</h1>
            <span style="font-family: monospace; font-weight: bold; font-size: 13px;">No: ${msfNo}</span>
          </div>
        </div>

        <table class="meta-table">
          <tr>
            <td style="width: 50%;">
              <strong>ÇIKIŞ DEPOSU (SEVK EDEN):</strong><br>
              ${fromName}<br><br>
              <strong>VARIŞ DEPOSU (SEVK EDİLEN):</strong><br>
              ${toName}
            </td>
            <td style="width: 50%; text-align: right;">
              <strong>Sevk Tarihi:</strong> ${dateStr}<br>
              <strong>Oluşturan / Sevk Eden:</strong> ${transfer.requestedBy}<br><br>
              ${deliveryDetails}
            </td>
          </tr>
        </table>

        <h3 style="border-bottom: 1px solid #000; padding-bottom: 5px; margin-top: 30px;">Sevk Edilen Malzeme Listesi</h3>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">S.No</th>
              <th style="width: 25%;">SAP No / Kod</th>
              <th style="width: 50%;">Malzeme Açıklaması / Adı</th>
              <th style="width: 10%; text-align: center;">Miktar</th>
              <th style="width: 10%; text-align: center;">Birim</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>

        <div style="font-size: 11px; margin-top: 40px; border: 1px solid #ccc; padding: 10px; border-radius: 4px;">
          <strong>Sevk Açıklaması:</strong> Bu belge ile yukarıda dökümü yapılan malzemelerin çıkış deposundan sevk edildiği, alıcı deponun malzemeleri eksiksiz teslim alıp stoğa işlemesi gerektiği beyan edilir.
        </div>

        <div class="signatures">
          <div class="signature-box">
            <strong>Teslim Eden (Sevk Eden)</strong><br><br><br>
            İmza / Tarih
          </div>
          <div class="signature-box">
            <strong>Taşıyan Personel / Kargo</strong><br><br><br>
            İmza / Tarih
          </div>
          <div class="signature-box">
            <strong>Teslim Alan (Kabul Eden)</strong><br><br><br>
            İmza / Tarih
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};
