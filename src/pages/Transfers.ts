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
  const initialMsfNo = `XXXX-MSF-${dateStr}`;

  return `
    <div class="fade-in-up content-area">
      <style>
        /* Overrides for Transfers page buttons */
        .content-area .btn-cyber,
        .content-area .btn-cyber-outline {
          min-height: unset !important;
          height: 34px !important;
          padding: 0 12px !important;
          border-radius: 6px !important;
          font-family: 'Rajdhani', sans-serif !important;
          font-weight: 800 !important;
          font-size: 0.72rem !important;
          transition: all 0.2s !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          box-shadow: none !important;
        }

        /* Active filter / active delivery mode */
        .content-area .btn-cyber,
        .content-area #delivery-person-btn.btn-cyber,
        .content-area #delivery-cargo-btn.btn-cyber {
          background: rgba(0, 242, 255, 0.08) !important;
          border: 1px solid rgba(0, 242, 255, 0.35) !important;
          color: #00f2ff !important;
          box-shadow: 0 0 10px rgba(0, 242, 255, 0.08) !important;
        }

        /* Inactive state */
        .content-area .btn-cyber-outline,
        .content-area #delivery-person-btn.btn-cyber-outline,
        .content-area #delivery-cargo-btn.btn-cyber-outline {
          background: transparent !important;
          border: 1px solid rgba(255, 255, 255, 0.1) !important;
          color: #94A3B8 !important;
        }

        /* Hover states */
        .content-area .btn-cyber:hover,
        .content-area .btn-cyber-outline:hover,
        .content-area #delivery-person-btn:hover,
        .content-area #delivery-cargo-btn:hover {
          background: rgba(0, 242, 255, 0.15) !important;
          border-color: rgba(0, 242, 255, 0.5) !important;
          color: #fff !important;
        }

        /* Giant Submit button at the bottom left */
        .content-area button[type="submit"].btn-cyber {
          height: 42px !important;
          font-size: 0.85rem !important;
          background: rgba(0, 242, 255, 0.08) !important;
          border: 1px solid rgba(0, 242, 255, 0.35) !important;
          color: #00f2ff !important;
          box-shadow: 0 0 15px rgba(0, 242, 255, 0.1) !important;
          width: 100% !important;
        }

        .content-area button[type="submit"].btn-cyber:hover {
          background: rgba(0, 242, 255, 0.15) !important;
          border-color: rgba(0, 242, 255, 0.5) !important;
          color: #fff !important;
          box-shadow: 0 0 20px rgba(0, 242, 255, 0.2) !important;
        }
      </style>
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
                <div id="msf-adder-container" style="display: none; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.04); padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                  <div style="display: flex; gap: 0.75rem; align-items: flex-end; width: 100%;">
                    <div style="flex: 1; position: relative; min-width: 0;">
                      <label style="font-size: 0.62rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px; text-transform: uppercase;">MALZEME ARA</label>
                      <input type="text" id="msf-search-input" class="cyber-input" placeholder="Malzeme SAP No veya Adı ara..." autocomplete="off" style="font-size: 0.78rem; height: 44px !important; min-height: 44px !important; padding: 0 16px !important; line-height: 44px !important; box-sizing: border-box; width: 100%;">
                      <div id="msf-search-results" class="search-results-dropdown hidden" style="z-index: 99999;"></div>
                      
                      <input type="hidden" id="msf-selected-sap">
                      <input type="hidden" id="msf-selected-name">
                      <input type="hidden" id="msf-selected-condition">
                      <input type="hidden" id="msf-selected-max-qty">
                    </div>
                    <div style="width: 80px; flex-shrink: 0;">
                      <label style="font-size: 0.62rem; font-weight: 700; color: var(--text-muted); display: block; margin-bottom: 4px; text-transform: uppercase;">MİKTAR</label>
                      <input type="number" id="msf-qty-input" class="cyber-input" placeholder="Miktar" value="1" min="1" disabled style="font-size: 0.78rem; text-align: center; height: 44px !important; min-height: 44px !important; padding: 0 !important; line-height: 44px !important; box-sizing: border-box; width: 100%;">
                    </div>
                    <div style="width: 90px; flex-shrink: 0;">
                      <button type="button" id="msf-add-to-list-btn" onclick="window.addMsfSelectedMaterialToList()" class="btn-cyber" style="height: 44px !important; min-height: 44px !important; width: 100%; box-sizing: border-box; font-size: 0.78rem; padding: 0 !important; display: flex; align-items: center; justify-content: center; gap: 6px; font-weight: 700;" disabled>
                        <i class="fa-solid fa-plus"></i> Ekle
                      </button>
                    </div>
                  </div>
                  <div id="msf-selected-stock-lbl" style="margin-top: 8px;"></div>
                </div>

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
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 12px;">
            <h3 style="font-family: 'Rajdhani', sans-serif; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; margin: 0;">
              <i class="fa-solid fa-list-check" style="color: var(--accent-cyan);"></i> SON SEVKLER (MSF LİSTESİ)
            </h3>
            
            <!-- Filters -->
            <div style="display: flex; gap: 6px; align-items: center;">
              <button type="button" onclick="window.filterMsfTransfers('HEPSİ')" id="filter-msf-all" class="btn-cyber" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">HEPSİ</button>
              <button type="button" onclick="window.filterMsfTransfers('YOLDA')" id="filter-msf-yolda" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">YOLDA</button>
              <button type="button" onclick="window.filterMsfTransfers('TAMAMLANDI')" id="filter-msf-tamamlandi" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">TAMAMLANAN</button>
              <button type="button" onclick="window.filterMsfTransfers('IPTAL_EDILDI')" id="filter-msf-iptal" class="btn-cyber-outline" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600;">İPTAL EDİLEN</button>
              <button type="button" onclick="window.exportTransfersListToExcel()" class="btn-cyber" style="font-size: 0.65rem; padding: 4px 8px; font-weight: 600; background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3); color: #10B981; margin-left: 8px; display: inline-flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='rgba(16, 185, 129, 0.18)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(16, 185, 129, 0.08)'; this.style.color='#10B981'">
                <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
              </button>
            </div>
          </div>

          <!-- Warehouse Search / Filter Row -->
          <div style="display: flex; gap: 12px; margin-bottom: 1.5rem; background: rgba(0, 0, 0, 0.2); border: 1px solid rgba(255,255,255,0.03); padding: 10px 15px; border-radius: 8px; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.72rem; font-weight: 800; color: var(--accent-cyan); display: inline-flex; align-items: center; gap: 6px; text-transform: uppercase;">
              <i class="fa-solid fa-filter"></i> Saha Filtresi:
            </span>
            <div style="display: flex; align-items: center; gap: 6px; min-width: 220px; flex: 1;">
              <span style="font-size: 0.65rem; color: #64748B; font-weight: 800;">NEREDEN:</span>
              <select id="msf-filter-departure" class="cyber-input" style="height: 34px; padding: 0 10px; font-size: 0.75rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); border-radius: 6px; flex: 1; color: #fff; outline: none; cursor: pointer;">
                <option value="HEPSİ">Tüm Çıkış Depoları</option>
              </select>
            </div>
            <div style="display: flex; align-items: center; gap: 6px; min-width: 220px; flex: 1;">
              <span style="font-size: 0.65rem; color: #64748B; font-weight: 800;">NEREYE:</span>
              <select id="msf-filter-destination" class="cyber-input" style="height: 34px; padding: 0 10px; font-size: 0.75rem; border-color: rgba(255,255,255,0.08); background: rgba(0,0,0,0.3); border-radius: 6px; flex: 1; color: #fff; outline: none; cursor: pointer;">
                <option value="HEPSİ">Tüm Varış Depoları</option>
              </select>
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
let filterDeparture = 'HEPSİ';
let filterDestination = 'HEPSİ';
let loadedTransfersList: any[] = [];
let warehousesMap: Record<string, string> = {};
let msfListUnsubscribe: (() => void) | null = null;
let msfPage = 1;
const msfPageSize = 5;
let msfAddedItems: Array<{ materialCode: string, materialName: string, quantity: number, condition?: 'NEW' | 'REVISED' | 'DEFECT' | 'SCRAP' }> = [];

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

  const filterDepSelect = document.getElementById('msf-filter-departure') as HTMLSelectElement;
  const filterDestSelect = document.getElementById('msf-filter-destination') as HTMLSelectElement;

  if (filterDepSelect && filterDestSelect) {
    // Clear first (keep HEPSİ option)
    filterDepSelect.innerHTML = '<option value="HEPSİ">Tüm Çıkış Depoları</option>';
    filterDestSelect.innerHTML = '<option value="HEPSİ">Tüm Varış Depoları</option>';

    // Sort warehouses alphabetically
    const sortedWhs = Object.entries(warehousesMap)
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, 'tr'));

    sortedWhs.forEach(wh => {
      const opt1 = document.createElement('option');
      opt1.value = wh.id;
      opt1.innerText = wh.name;
      filterDepSelect.appendChild(opt1);

      const opt2 = document.createElement('option');
      opt2.value = wh.id;
      opt2.innerText = wh.name;
      filterDestSelect.appendChild(opt2);
    });

    filterDepSelect.value = filterDeparture;
    filterDestSelect.value = filterDestination;

    filterDepSelect.addEventListener('change', () => {
      filterDeparture = filterDepSelect.value;
      msfPage = 1;
      (window as any).renderMsfCards();
    });

    filterDestSelect.addEventListener('change', () => {
      filterDestination = filterDestSelect.value;
      msfPage = 1;
      (window as any).renderMsfCards();
    });
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
        msfAddedItems = [];
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`;
        if (display) display.innerText = `XXXX-MSF-${dateStr}`;
        if (input) input.value = `XXXX-MSF-${dateStr}`;
        
        const adderContainer = document.getElementById('msf-adder-container');
        if (adderContainer) adderContainer.style.display = 'none';
        
        const itemsContainer = document.getElementById('msf-items-container');
        if (itemsContainer) {
          itemsContainer.innerHTML = `
            <div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 1.5rem; border: 1px dashed rgba(255, 255, 255, 0.1); border-radius: 8px;">
              Lütfen önce bir Çıkış Santrali (Nereden) seçiniz.
            </div>
          `;
        }
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
        const newMsfNo = `${nextSeq}-MSF-${dateStr}`;

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
        msfAddedItems = [];
        
        const adderContainer = document.getElementById('msf-adder-container');
        if (adderContainer) adderContainer.style.display = 'block';
        
        (window as any).renderMsfAddedItemsTable();
        (window as any).setupMsfSearchListener();
      } catch (err) {
        console.error("Failed to load inventory:", err);
        departureInventory = [];
        msfAddedItems = [];
        const adderContainer = document.getElementById('msf-adder-container');
        if (adderContainer) adderContainer.style.display = 'none';
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

  // Setup autocomplete search listener on the adder input
  (window as any).setupMsfSearchListener = () => {
    const searchInput = document.getElementById('msf-search-input') as HTMLInputElement;
    const resultsDiv = document.getElementById('msf-search-results') as HTMLDivElement;

    if (searchInput && resultsDiv) {
      // Clone searchInput to remove previous event listeners
      const newSearchInput = searchInput.cloneNode(true) as HTMLInputElement;
      searchInput.parentNode?.replaceChild(newSearchInput, searchInput);

      newSearchInput.addEventListener('input', () => {
        const query = newSearchInput.value.toLowerCase().trim();
        if (query.length < 2) {
          resultsDiv.classList.add('hidden');
          return;
        }

        const matches = departureInventory.filter(item => {
          if (item.condition === 'DEFECT') return false;
          const sap = String(item.sapNo || '').toLowerCase();
          const name = String(item.name || item.description || '').toLowerCase();
          return sap.includes(query) || name.includes(query);
        });

        resultsDiv.innerHTML = matches.slice(0, 10).map(m => {
          const cond = m.condition || 'NEW';
          const condLabel = cond === 'REVISED' ? 'Revize' : cond === 'DEFECT' ? 'Arızalı' : cond === 'SCRAP' ? 'Hurda' : '';
          const condColor = cond === 'DEFECT' ? '#EF4444' : cond === 'REVISED' ? '#3B82F6' : cond === 'SCRAP' ? '#9CA3AF' : '';
          const condBg = cond === 'DEFECT' ? 'rgba(239,68,68,0.15)' : cond === 'REVISED' ? 'rgba(59,130,246,0.15)' : cond === 'SCRAP' ? 'rgba(156,163,175,0.15)' : '';
          const condBorder = cond === 'DEFECT' ? 'rgba(239,68,68,0.3)' : cond === 'REVISED' ? 'rgba(59,130,246,0.3)' : cond === 'SCRAP' ? 'rgba(156,163,175,0.3)' : '';

          return `
            <div class="search-item" onclick="window.selectMsfMaterialForAdder('${m.sapNo}', '${(m.name || m.description || 'Bilinmeyen').replace(/'/g, "\\'")}', ${m.quantity}, '${cond}')">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                <div style="font-weight: 700; color: var(--accent-cyan); font-family: monospace; font-size: 0.85rem;">${m.sapNo}</div>
                ${condLabel ? `<span style="font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid ${condBorder}; background: ${condBg}; color: ${condColor}; text-transform: uppercase;">${condLabel}</span>` : ''}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-main); font-weight: 500; line-height: 1.3;">${m.name || m.description}</div>
              <div style="font-size: 0.65rem; color: #14F195; font-weight: 700; margin-top: 4px;">Mevcut Stok: ${m.quantity} Adet</div>
            </div>
          `;
        }).join('');

        if (matches.length > 0) {
          resultsDiv.classList.remove('hidden');
        } else {
          resultsDiv.innerHTML = '<div style="padding: 0.75rem; color: #ef4444; font-size: 0.75rem;">Stokta eşleşen malzeme bulunamadı.</div>';
          resultsDiv.classList.remove('hidden');
        }
      });

      // Close dropdown when clicking outside
      document.addEventListener('click', (e) => {
        if (e.target !== newSearchInput && !resultsDiv.contains(e.target as Node)) {
          resultsDiv.classList.add('hidden');
        }
      });
    }
  };

  // Triggered when item is selected in autocomplete list
  (window as any).selectMsfMaterialForAdder = (sapNo: string, name: string, maxQty: number, condition: 'NEW' | 'REVISED' | 'DEFECT' | 'SCRAP' = 'NEW') => {
    const searchInput = document.getElementById('msf-search-input') as HTMLInputElement;
    const sapInput = document.getElementById('msf-selected-sap') as HTMLInputElement;
    const nameInput = document.getElementById('msf-selected-name') as HTMLInputElement;
    const condInput = document.getElementById('msf-selected-condition') as HTMLInputElement;
    const maxQtyInput = document.getElementById('msf-selected-max-qty') as HTMLInputElement;
    const qtyInput = document.getElementById('msf-qty-input') as HTMLInputElement;
    const addBtn = document.getElementById('msf-add-to-list-btn') as HTMLButtonElement;
    const label = document.getElementById('msf-selected-stock-lbl') as HTMLDivElement;
    const resultsDiv = document.getElementById('msf-search-results') as HTMLDivElement;

    if (searchInput && sapInput && nameInput && qtyInput && label) {
      searchInput.value = `${sapNo} - ${name}`;
      sapInput.value = sapNo;
      nameInput.value = name;
      if (condInput) condInput.value = condition;
      if (maxQtyInput) maxQtyInput.value = maxQty.toString();
      
      qtyInput.disabled = false;
      qtyInput.max = maxQty.toString();
      qtyInput.value = "1";
      if (addBtn) addBtn.disabled = false;

      const condLabel = condition === 'REVISED' ? 'Revize' : condition === 'DEFECT' ? 'Arızalı' : condition === 'SCRAP' ? 'Hurda' : '';
      const condColor = condition === 'DEFECT' ? '#EF4444' : condition === 'REVISED' ? '#3B82F6' : condition === 'SCRAP' ? '#9CA3AF' : '';
      const condBg = condition === 'DEFECT' ? 'rgba(239,68,68,0.15)' : condition === 'REVISED' ? 'rgba(59,130,246,0.15)' : condition === 'SCRAP' ? 'rgba(156,163,175,0.15)' : '';
      const condBorder = condition === 'DEFECT' ? 'rgba(239,68,68,0.3)' : condition === 'REVISED' ? 'rgba(59,130,246,0.3)' : condition === 'SCRAP' ? 'rgba(156,163,175,0.3)' : '';

      label.innerHTML = `
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 6px; padding: 8px 12px; margin-top: 8px; line-height: 1.4; color: var(--text-main);">
          <div style="font-weight: 700; font-size: 0.8rem; margin-bottom: 4px; word-break: break-word;">${name}</div>
          <div style="display: flex; justify-content: space-between; font-size: 0.68rem; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px; margin-top: 4px;">
            <span style="color: var(--text-muted);">SAP Kod: <strong style="color: var(--accent-cyan); font-family: monospace;">${sapNo}</strong></span>
            ${condLabel ? `<span style="font-size: 0.65rem; font-weight: 700; padding: 1px 6px; border-radius: 4px; border: 1px solid ${condBorder}; background: ${condBg}; color: ${condColor}; text-transform: uppercase;">${condLabel}</span>` : ''}
            <span style="color: #14F195;"><i class="fa-solid fa-circle-check"></i> Stok: <strong style="font-size: 0.75rem;">${maxQty} Adet</strong></span>
          </div>
        </div>
      `;
      
      if (resultsDiv) resultsDiv.classList.add('hidden');
    }
  };

  // Add the selected material row into the local state table
  (window as any).addMsfSelectedMaterialToList = () => {
    const sapInput = document.getElementById('msf-selected-sap') as HTMLInputElement;
    const nameInput = document.getElementById('msf-selected-name') as HTMLInputElement;
    const condInput = document.getElementById('msf-selected-condition') as HTMLInputElement;
    const maxQtyInput = document.getElementById('msf-selected-max-qty') as HTMLInputElement;
    const qtyInput = document.getElementById('msf-qty-input') as HTMLInputElement;

    const sap = sapInput ? sapInput.value : '';
    const name = nameInput ? nameInput.value : '';
    const condition = (condInput ? condInput.value : 'NEW') as any;
    const maxQty = maxQtyInput ? parseInt(maxQtyInput.value) : 0;
    const qty = qtyInput ? parseInt(qtyInput.value) : 0;

    if (!sap || !name || isNaN(qty) || qty <= 0) {
      alert("Lütfen geçerli bir malzeme seçin ve miktar girin.");
      return;
    }

    if (qty > maxQty) {
      alert(`Girilen miktar (${qty}), mevcut çıkış stoğunu (${maxQty}) aşamaz!`);
      return;
    }

    // Check duplicates in local array
    const existingIndex = msfAddedItems.findIndex(i => i.materialCode === sap && i.condition === condition);
    if (existingIndex !== -1) {
      const totalQty = msfAddedItems[existingIndex].quantity + qty;
      if (totalQty > maxQty) {
        alert(`Toplam sevk miktarı (${totalQty}), mevcut çıkış stoğunu (${maxQty}) aşamaz!`);
        return;
      }
      msfAddedItems[existingIndex].quantity = totalQty;
    } else {
      msfAddedItems.push({
        materialCode: sap,
        materialName: name,
        quantity: qty,
        condition: condition
      });
    }

    // Reset adder inputs
    const searchInput = document.getElementById('msf-search-input') as HTMLInputElement;
    if (searchInput) searchInput.value = '';
    if (sapInput) sapInput.value = '';
    if (nameInput) nameInput.value = '';
    if (condInput) condInput.value = '';
    if (maxQtyInput) maxQtyInput.value = '';
    if (qtyInput) {
      qtyInput.value = '1';
      qtyInput.disabled = true;
    }

    const stockLbl = document.getElementById('msf-selected-stock-lbl');
    if (stockLbl) stockLbl.innerHTML = '';

    const addBtn = document.getElementById('msf-add-to-list-btn') as HTMLButtonElement;
    if (addBtn) addBtn.disabled = true;

    // Render list table
    (window as any).renderMsfAddedItemsTable();
  };

  // Remove added item from state array
  (window as any).removeMsfAddedItem = (index: number) => {
    if (index >= 0 && index < msfAddedItems.length) {
      msfAddedItems.splice(index, 1);
      (window as any).renderMsfAddedItemsTable();
    }
  };

  // Render local state array to HTML table representation
  (window as any).renderMsfAddedItemsTable = () => {
    const container = document.getElementById('msf-items-container');
    if (!container) return;

    if (msfAddedItems.length === 0) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.75rem; text-align: center; padding: 1.5rem; border: 1px dashed rgba(255, 255, 255, 0.08); border-radius: 8px;">
          Sevk listesi boş. Lütfen yukarıdan malzeme ekleyin.
        </div>
      `;
      return;
    }

    const rowsHTML = msfAddedItems.map((item, index) => {
      const cond = item.condition || 'NEW';
      const condLabel = cond === 'REVISED' ? 'Revize' : cond === 'DEFECT' ? 'Arızalı' : cond === 'SCRAP' ? 'Hurda' : '';
      const condColor = cond === 'DEFECT' ? '#EF4444' : cond === 'REVISED' ? '#3B82F6' : cond === 'SCRAP' ? '#9CA3AF' : '';
      const condBg = cond === 'DEFECT' ? 'rgba(239,68,68,0.15)' : cond === 'REVISED' ? 'rgba(59,130,246,0.15)' : cond === 'SCRAP' ? 'rgba(156,163,175,0.15)' : '';
      const condBorder = cond === 'DEFECT' ? 'rgba(239,68,68,0.3)' : cond === 'REVISED' ? 'rgba(59,130,246,0.3)' : cond === 'SCRAP' ? 'rgba(156,163,175,0.3)' : '';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
          <td style="padding: 10px 8px; color: var(--accent-cyan); font-family: monospace; font-size: 0.78rem; font-weight: 700;">${item.materialCode}</td>
          <td style="padding: 10px 8px; color: var(--text-main); font-weight: 500; font-size: 0.78rem;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${item.materialName}</span>
              ${condLabel ? `<span style="font-size: 0.6rem; font-weight: 700; padding: 1px 5px; border-radius: 4px; border: 1px solid ${condBorder}; background: ${condBg}; color: ${condColor}; text-transform: uppercase;">${condLabel}</span>` : ''}
            </div>
          </td>
          <td style="padding: 10px 8px; color: #14F195; font-weight: 700; font-size: 0.78rem; text-align: center;">${item.quantity} Adet</td>
          <td style="padding: 10px 8px; text-align: right;">
            <button type="button" onclick="window.removeMsfAddedItem(${index})" class="btn-cyber-mini" style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); color: #ef4444; height: 28px; width: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border-radius: 6px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.15)';" onmouseout="this.style.background='rgba(239, 68, 68, 0.06)';" title="Sil">
              <i class="fa-solid fa-trash-can" style="font-size: 0.65rem;"></i>
            </button>
          </td>
        </tr>
      `;
    }).join('');

    container.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem;">
        <thead>
          <tr style="border-bottom: 1px solid rgba(255,255,255,0.06); text-align: left;">
            <th style="padding: 8px; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">SAP Kodu</th>
            <th style="padding: 8px; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700;">Malzeme Tanımı</th>
            <th style="padding: 8px; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; text-align: center;">Miktar</th>
            <th style="padding: 8px; font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: 700; text-align: right;">Aksiyon</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHTML}
        </tbody>
      </table>
    `;
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

      // Collect items from local state array
      const items: TransferItem[] = [...msfAddedItems];

      if (items.length === 0) {
        alert("Lütfen en az bir sevk edilecek malzeme ekleyin.");
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

  if (filterDeparture !== 'HEPSİ') {
    filtered = filtered.filter(t => t.fromSiteId === filterDeparture);
  }

  if (filterDestination !== 'HEPSİ') {
    filtered = filtered.filter(t => t.toSiteId === filterDestination);
  }

  (window as any)._filteredTransfersForExcel = filtered;

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
    const formatMsfNo = (msf: string): string => {
      if (!msf) return '';
      const parts = msf.split('-');
      if (parts.length === 3 && parts[0] === 'MSF') {
        return `${parts[2]}-MSF-${parts[1]}`;
      }
      return msf;
    };
    const msfNo = formatMsfNo(t.msfNo || `TRF-${t.id?.substring(0, 8).toUpperCase()}`);
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
    const isSystemAdmin = currentUser?.role === 'ADMIN' || 
                          currentUser?.role === 'MALZEME_YONETIMI' || 
                          currentUser?.email?.toLowerCase() === 'fatih.zebek@demirerholding.com' ||
                          currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
    
    const showApprove = normStatus === 'YOLDA' && isReceiver;
    const showReject = normStatus === 'YOLDA' && isReceiver && !isSystemAdmin;
    const showCancel = normStatus === 'YOLDA' && isSystemAdmin;

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
            
            ${showCancel ? `
              <button onclick="window.rejectMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'; this.style.borderColor='#EF4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.3)'">
                <i class="fa-solid fa-ban"></i> İptal Et (Sil)
              </button>
            ` : ''}

            ${showReject ? `
              <button onclick="window.rejectMsfTransfer('${t.id}')" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 4px 10px; color: #ef4444; border-color: rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); transition: all 0.2s;" onmouseover="this.style.background='rgba(239,68,68,0.18)'; this.style.borderColor='#EF4444'" onmouseout="this.style.background='rgba(239, 68, 68, 0.08)'; this.style.borderColor='rgba(239, 68, 68, 0.3)'">
                <i class="fa-solid fa-ban"></i> Reddet
              </button>
            ` : ''}

            ${showApprove ? `
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
  const t = loadedTransfersList.find(x => x.id === transferId);
  if (!t) return;

  const adminEmail = authService.getCurrentUser()?.email || 'Admin';
  const items = Array.isArray(t.items) 
    ? t.items 
    : [{ materialCode: t.materialCode, materialName: t.materialName, quantity: t.quantity, condition: 'NEW' }];

  // 1. Create a dynamic modal container if not exists
  let modal = document.getElementById('msf-approval-modal');
  if (modal) {
    modal.remove();
  }
  
  modal = document.createElement('div');
  modal.id = 'msf-approval-modal';
  modal.className = 'lightbox-fade-in';
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.background = 'rgba(5, 8, 15, 0.85)';
  modal.style.backdropFilter = 'blur(12px)';
  modal.style.zIndex = '9999';
  modal.style.display = 'flex';
  modal.style.justifyContent = 'center';
  modal.style.alignItems = 'center';
  modal.style.padding = '20px';

  // Generate HTML for each item inputs
  const itemsInputsHtml = items.map((item: any) => {
    const itemCond = item.condition || 'NEW';
    return `
      <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 6px;">
          <span style="font-weight: 700; color: var(--text-main); font-size: 0.85rem; display: inline-flex; align-items: center; gap: 6px;">
            <span style="font-family: monospace; font-size: 0.72rem; color: #00f3ff; background: rgba(0, 243, 255, 0.05); border: 1px solid rgba(0, 243, 255, 0.15); padding: 2px 6px; border-radius: 4px;">${item.materialCode}</span>
            <span>${item.materialName}</span>
          </span>
          <span style="color: #14F195; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.82rem;">${item.quantity} Adet</span>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
          <div>
            <label style="display: block; font-size: 0.65rem; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Giriş Rafı (Konum)</label>
            <input type="text" id="appr-shelf-${item.materialCode}" class="cyber-input" placeholder="Raf No (örn: A-12)" value="" style="width: 100%; font-size: 0.8rem; height: 38px; padding: 0 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: #fff; border-radius: 6px;">
          </div>
          <div>
            <label style="display: block; font-size: 0.65rem; color: #64748B; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Malzeme Durumu</label>
            <select id="appr-cond-${item.materialCode}" class="cyber-input" style="width: 100%; font-size: 0.8rem; height: 38px; padding: 0 12px; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.08); color: #fff; border-radius: 6px; cursor: pointer;">
              <option value="NEW" ${itemCond === 'NEW' ? 'selected' : ''}>Yeni</option>
              <option value="REVISED" ${itemCond === 'REVISED' ? 'selected' : ''}>Revize</option>
              <option value="DEFECT" ${itemCond === 'DEFECT' ? 'selected' : ''}>Arızalı</option>
              <option value="SCRAP" ${itemCond === 'SCRAP' ? 'selected' : ''}>Hurda</option>
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');

  modal.innerHTML = `
    <div class="glass-panel lightbox-scale-up" style="width: 100%; max-width: 500px; background: rgba(15, 23, 42, 0.95); border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 16px; box-shadow: 0 10px 40px rgba(0, 243, 255, 0.15), 0 0 2px rgba(0, 243, 255, 0.4); padding: 1.5rem; display: flex; flex-direction: column; max-height: 90vh; overflow-y: auto;">
      
      <!-- Modal Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 12px; margin-bottom: 16px;">
        <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.2rem; font-weight: 800; color: var(--text-main); margin: 0; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-warehouse" style="color: var(--accent-cyan);"></i> Depo Girişi Raf ve Durum Belirleme
        </h3>
        <button onclick="document.getElementById('msf-approval-modal').remove()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='var(--text-muted)'">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <!-- Scrollable Content -->
      <div style="flex: 1; overflow-y: auto; padding-right: 4px; margin-bottom: 16px;">
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 0; margin-bottom: 12px; line-height: 1.4;">
          Lütfen teslim alınan malzemelerin yerleştirileceği raf numarasını ve fiziki durumunu kontrol ederek belirtiniz.
        </p>
        ${itemsInputsHtml}
      </div>

      <!-- Action Buttons -->
      <div style="display: flex; justify-content: flex-end; gap: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
        <button onclick="document.getElementById('msf-approval-modal').remove()" class="btn-cyber-mini" style="font-size: 0.8rem; padding: 8px 16px; border-color: rgba(255,255,255,0.15); background: transparent; color: var(--text-main); height: 38px;">
          Vazgeç
        </button>
        <button id="msf-approve-submit-btn" class="btn-cyber-mini" style="font-size: 0.8rem; padding: 8px 20px; border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.1); color: #10B981; font-weight: 700; height: 38px; box-shadow: 0 0 10px rgba(16,185,129,0.05);" onmouseover="this.style.background='rgba(16,185,129,0.2)'; this.style.borderColor='#10B981'; this.style.boxShadow='0 0 15px rgba(16,185,129,0.2)';" onmouseout="this.style.background='rgba(16,185,129,0.1)'; this.style.borderColor='rgba(16, 185, 129, 0.4)'; this.style.boxShadow='0 0 10px rgba(16,185,129,0.05)'">
          <i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i> Depoya Giriş Yap
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);

  // Bind Submit Button Click
  const submitBtn = document.getElementById('msf-approve-submit-btn');
  if (submitBtn) {
    submitBtn.onclick = async () => {
      // Gather inputs
      const details = items.map((item: any) => {
        const shelfInput = document.getElementById(`appr-shelf-${item.materialCode}`) as HTMLInputElement;
        const condSelect = document.getElementById(`appr-cond-${item.materialCode}`) as HTMLSelectElement;
        
        const shelfVal = shelfInput ? shelfInput.value.trim() : '';
        const condVal = condSelect ? condSelect.value : 'NEW';

        return {
          materialCode: item.materialCode,
          shelfNo: shelfVal || 'Belirtilmedi',
          condition: condVal as 'NEW' | 'DEFECT' | 'REVISED' | 'SCRAP'
        };
      });

      // Show loader on button
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';

      try {
        await transferService.approveMultiItemTransfer(transferId, adminEmail, details);

        modal.remove();
        alert("✅ Sevk başarıyla teslim alındı, belirtilen raflara ve durumlarına göre stoğa girildi!");
        (window as any).navigate('transfers');
      } catch (err: any) {
        console.error(err);
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = '<i class="fa-solid fa-check-circle" style="margin-right: 4px;"></i> Depoya Giriş Yap';
        alert("Kabul işlemi sırasında hata oluştu: " + err.message);
      }
    };
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

  const formatMsfNo = (msf: string): string => {
    if (!msf) return '';
    const parts = msf.split('-');
    if (parts.length === 3 && parts[0] === 'MSF') {
      return `${parts[2]}-MSF-${parts[1]}`;
    }
    return msf;
  };
  const msfNo = formatMsfNo(transfer.msfNo || `TRF-${transfer.id?.substring(0, 8).toUpperCase()}`);
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

  if (transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') {
    const resolvedDateStr = transfer.resolvedAt?.toDate 
      ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') 
      : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : 'Belirtilmedi');
    const receiver = transfer.resolvedBy || transfer.approvedBy || 'Belirtilmedi';
    deliveryDetails += `<br><br><span style="color:#10b981; font-weight:bold;">🟢 TESLİM EDİLDİ</span><br><strong>Teslim Tarihi:</strong> ${resolvedDateStr}<br><strong>Teslim Alan:</strong> ${receiver}`;
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
            <strong>Teslim Eden (Sevk Eden)</strong><br><br>
            <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.requestedBy || ''}</span><br>
            <span style="font-size: 10px; color: #555;">Tarih: ${dateStr}</span>
          </div>
          <div class="signature-box">
            <strong>Taşıyan Personel / Kargo</strong><br><br>
            ${transfer.deliveryMethod === 'PERSON' && transfer.shippedBy ? `
              <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.shippedBy}</span>
            ` : (transfer.deliveryMethod === 'CARGO' && transfer.cargoCarrier ? `
              <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.cargoCarrier}</span><br>
              <span style="font-size: 10px; color: #555;">Takip No: ${transfer.cargoTrackingNo || ''}</span>
            ` : 'İmza / Tarih')}
          </div>
          <div class="signature-box">
            <strong>Teslim Alan (Kabul Eden)</strong><br><br>
            ${(transfer.status === 'TAMAMLANDI' || transfer.status === 'COMPLETED') ? `
              <span style="font-size: 11px; font-weight: bold; color: #000;">${transfer.resolvedBy || transfer.approvedBy || ''}</span><br>
              <span style="font-size: 10px; color: #555;">Tarih: ${transfer.resolvedAt?.toDate ? transfer.resolvedAt.toDate().toLocaleString('tr-TR') : (transfer.approvedAt?.toDate ? transfer.approvedAt.toDate().toLocaleString('tr-TR') : '')}</span>
            ` : 'İmza / Tarih'}
          </div>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).exportTransfersListToExcel = async () => {
  try {
    const list = (window as any)._filteredTransfersForExcel || [];
    if (list.length === 0) {
      alert("İndirilecek transfer kaydı bulunamadı!");
      return;
    }
    const { excelService } = await import('../services/ExcelService');
    const fileName = `Demirer_Holding_Transfer_Raporu`;
    await excelService.exportTransfersToExcel(list, fileName);
  } catch (err: any) {
    alert("Excel indirilirken hata oluştu: " + err.message);
  }
};
