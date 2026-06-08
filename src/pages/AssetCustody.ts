import { assetCustodyService } from '../services/AssetCustodyService';
import type { CustodyItem } from '../services/AssetCustodyService';
import { dataService } from '../services/DataService';

let allItems: CustodyItem[] = [];
let filterTeam = 'all';
let filterCondition = 'all';
let filterLocation = 'all';
let searchQuery = '';

export const AssetCustodyPage = async () => {
  allItems = await assetCustodyService.getAll();
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  setTimeout(() => {
    (window as any).filterCustodyItems?.();
  }, 100);

  return `
    <div class="fade-in-up content-area" style="padding: 1rem;">
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin: 0; display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #f59e0b;"></i> Malzeme Zimmeti
          </h1>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">Ekip ve personel üzerindeki demirbaş el aletleri ve ekipmanların takibi</p>
        </div>
        ${isAdmin ? `
        <button class="btn-cyber" onclick="window.openCustodyModal()" style="gap: 8px;">
          <i class="fa-solid fa-plus"></i> YENİ ZİMMET KAYDI
        </button>
        ` : ''}
      </div>

      <!-- STATS STRIP -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="glass-panel" style="padding: 1rem; border-left: 3px solid #10b981; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'saglam').length}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">SAĞLAM</div>
        </div>
        <div class="glass-panel" style="padding: 1rem; border-left: 3px solid #f59e0b; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #f59e0b; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'arizali').length}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">ARIZALI</div>
        </div>
        <div class="glass-panel" style="padding: 1rem; border-left: 3px solid #ef4444; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #ef4444; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'hurda').length}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">HURDA</div>
        </div>
        <div class="glass-panel" style="padding: 1rem; border-left: 3px solid #a78bfa; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #a78bfa; font-family: 'Rajdhani';">${allItems.filter(i => i.location === 'depo').length}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">DEPODA</div>
        </div>
        <div class="glass-panel" style="padding: 1rem; border-left: 3px solid var(--accent-cyan); text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: var(--accent-cyan); font-family: 'Rajdhani';">${allItems.length}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">TOPLAM</div>
        </div>
      </div>

      <!-- FILTERS -->
      <div class="glass-panel" style="padding: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        <div style="position: relative; flex: 1; min-width: 200px;">
          <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.75rem;"></i>
          <input type="text" id="custody-search" placeholder="Ürün kodu, adı veya kişi ara..." 
            style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 12px 10px 36px; border-radius: 10px; font-size: 0.85rem; outline: none; box-sizing: border-box;"
            oninput="window.filterCustodyItems()">
        </div>
        <select id="custody-filter-team" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
          <option value="all">Tüm Ekipler</option>
          ${Array.from({length: 15}, (_, i) => `<option value="Team ${String(i+1).padStart(2,'0')}">Team ${String(i+1).padStart(2,'0')}</option>`).join('')}
        </select>
        <select id="custody-filter-condition" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
          <option value="all">Tüm Durumlar</option>
          <option value="saglam">✅ Sağlam</option>
          <option value="arizali">⚠️ Arızalı</option>
          <option value="hurda">❌ Hurda</option>
        </select>
        <select id="custody-filter-location" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
          <option value="all">Tüm Lokasyonlar</option>
          <option value="team">👥 Ekipte</option>
          <option value="depo">🏭 Depoda</option>
        </select>
      </div>

      <!-- TABLE -->
      <div class="glass-panel" style="padding: 0; overflow: hidden;">
        <div style="overflow-x: auto;">
          <table class="custody-table">
            <thead>
              <tr>
                <th>ÜRÜN KODU</th>
                <th>ÜRÜN ADI</th>
                <th>KATEGORİ</th>
                <th>ZİMMETLİ KİŞİ / EKİP</th>
                <th>KONUM</th>
                <th>DURUM</th>
                <th>NOT</th>
                ${isAdmin ? '<th style="width: 80px;">İŞLEM</th>' : ''}
              </tr>
            </thead>
            <tbody id="custody-table-body">
              ${allItems.length === 0 ? `
              <tr><td colspan="${isAdmin ? 8 : 7}" style="text-align: center; padding: 4rem; color: var(--text-muted);">
                <i class="fa-solid fa-toolbox" style="font-size: 2.5rem; opacity: 0.15; margin-bottom: 1rem; display: block;"></i>
                Henüz zimmet kaydı bulunmuyor. Yeni kayıt eklemek için üst kısımdaki butonu kullanın.
              </td></tr>
              ` : allItems.map(item => renderRow(item, isAdmin)).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- ADD/EDIT MODAL -->
    <div id="custody-modal" class="modal-overlay hidden" style="z-index: 99999;">
      <div class="glass-panel" style="max-width: 550px; width: 95%; margin: auto; border: 1px solid rgba(167, 139, 250, 0.3); box-shadow: 0 0 30px rgba(167,139,250,0.1);">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(167,139,250,0.05);">
          <h3 style="margin: 0; font-family: 'Rajdhani'; font-size: 1.2rem; color: #a78bfa; letter-spacing: 1px;" id="custody-modal-title">
            <i class="fa-solid fa-screwdriver-wrench"></i> YENİ ZİMMET KAYDI
          </h3>
          <button onclick="window.closeCustodyModal()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
          <input type="hidden" id="custody-edit-id">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">ÜRÜN KODU</label>
              <input type="text" id="custody-code" class="cyber-input" placeholder="Ör: DA-001" style="width: 100%; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">ÜRÜN ADI</label>
              <input type="text" id="custody-name" class="cyber-input" placeholder="Ör: Kombine Anahtar Takımı" style="width: 100%; box-sizing: border-box;">
            </div>
          </div>
          <div>
            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">KATEGORİ</label>
            <select id="custody-category" class="cyber-input" style="width: 100%; box-sizing: border-box;">
              <option value="El Aleti">🔧 El Aleti</option>
              <option value="Ölçü Aleti">📏 Ölçü Aleti</option>
              <option value="Elektrik Aleti">⚡ Elektrik Aleti</option>
              <option value="Güvenlik Ekipmanı">🦺 Güvenlik Ekipmanı</option>
              <option value="Hidrolik Ekipman">🔴 Hidrolik Ekipman</option>
              <option value="Diğer">📦 Diğer</option>
            </select>
          </div>
          <div>
            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">AÇIKLAMA</label>
            <input type="text" id="custody-desc" class="cyber-input" placeholder="Detaylı açıklama..." style="width: 100%; box-sizing: border-box;">
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">ZİMMETLİ KİŞİ</label>
              <input type="text" id="custody-person" class="cyber-input" placeholder="Ad Soyad" style="width: 100%; box-sizing: border-box;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">EKİP</label>
              <select id="custody-team" class="cyber-input" style="width: 100%; box-sizing: border-box;">
                <option value="">Seçiniz</option>
                ${Array.from({length: 15}, (_, i) => `<option value="Team ${String(i+1).padStart(2,'0')}">Team ${String(i+1).padStart(2,'0')}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">KONUM</label>
              <select id="custody-location" class="cyber-input" onchange="window.toggleCustodyWarehouse()" style="width: 100%; box-sizing: border-box;">
                <option value="team">👥 Ekipte</option>
                <option value="depo">🏭 Depoda</option>
              </select>
            </div>
            <div id="custody-warehouse-group" style="display: none;">
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">DEPO</label>
              <select id="custody-warehouse" class="cyber-input" style="width: 100%; box-sizing: border-box;">
                ${dataService.getWarehouses().map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div id="custody-condition-group">
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">DURUM</label>
              <select id="custody-condition" class="cyber-input" style="width: 100%; box-sizing: border-box;">
                <option value="saglam">✅ Sağlam</option>
                <option value="arizali">⚠️ Arızalı</option>
                <option value="hurda">❌ Hurda</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block;">DURUM NOTU (Opsiyonel)</label>
            <input type="text" id="custody-condition-note" class="cyber-input" placeholder="Arıza detayı veya not..." style="width: 100%; box-sizing: border-box;">
          </div>
          <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
            <button onclick="window.closeCustodyModal()" class="btn-cyber-outline" style="flex: 1;">VAZGEÇ</button>
            <button onclick="window.saveCustodyItem()" class="btn-cyber" style="flex: 2; justify-content: center;">
              <i class="fa-solid fa-floppy-disk"></i> KAYDET
            </button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .custody-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .custody-table thead { background: rgba(0,0,0,0.3); }
      .custody-table th { padding: 1rem; text-align: left; font-size: 0.6rem; font-weight: 900; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.05); white-space: nowrap; }
      .custody-table td { padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
      .custody-table tbody tr { transition: all 0.2s; }
      .custody-table tbody tr:hover { background: rgba(167, 139, 250, 0.03); }
      .custody-code { font-family: 'Rajdhani', monospace; font-weight: 800; color: var(--accent-cyan); font-size: 0.85rem; }
      .custody-name { font-weight: 700; color: var(--text-main); }
      .custody-cat-badge { font-size: 0.6rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-person { font-weight: 600; color: var(--text-main); font-size: 0.8rem; }
      .custody-team-tag { font-size: 0.6rem; font-weight: 800; color: #a78bfa; background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2); padding: 2px 8px; border-radius: 12px; }
      .custody-loc-badge { font-size: 0.6rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-loc-badge.team { background: rgba(0,242,254,0.1); color: var(--accent-cyan); border: 1px solid rgba(0,242,254,0.2); }
      .custody-loc-badge.depo { background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }
      .custody-cond-badge { font-size: 0.6rem; font-weight: 900; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-cond-badge.saglam { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
      .custody-cond-badge.arizali { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
      .custody-cond-badge.hurda { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
      .custody-action-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s; font-size: 0.85rem; }
      .custody-action-btn:hover { color: var(--accent-cyan); background: rgba(0,242,254,0.1); }
      .custody-action-btn.red:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
      .custody-note-text { font-size: 0.7rem; color: var(--text-muted); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    </style>
  `;
};

function renderRow(item: CustodyItem, isAdmin: boolean): string {
  const condLabel: Record<string, string> = { saglam: '✅ Sağlam', arizali: '⚠️ Arızalı', hurda: '❌ Hurda' };
  const catColors: Record<string, string> = { 
    'El Aleti': 'rgba(245,158,11,0.15)', 
    'Ölçü Aleti': 'rgba(59,130,246,0.15)',
    'Elektrik Aleti': 'rgba(234,179,8,0.15)',
    'Güvenlik Ekipmanı': 'rgba(16,185,129,0.15)',
    'Hidrolik Ekipman': 'rgba(239,68,68,0.15)',
    'Diğer': 'rgba(255,255,255,0.05)' 
  };
  
  return `
    <tr data-team="${item.assignedTeam}" data-condition="${item.condition}" data-location="${item.location}" data-search="${(item.productCode + ' ' + item.productName + ' ' + item.assignedTo + ' ' + item.description).toLowerCase()}">
      <td><span class="custody-code">${item.productCode}</span></td>
      <td><span class="custody-name">${item.productName}</span></td>
      <td><span class="custody-cat-badge" style="background: ${catColors[item.category] || catColors['Diğer']}; color: var(--text-main);">${item.category}</span></td>
      <td>
        <div class="custody-person">${item.assignedTo || '-'}</div>
        ${item.assignedTeam ? `<span class="custody-team-tag">${item.assignedTeam}</span>` : ''}
      </td>
      <td><span class="custody-loc-badge ${item.location}">${item.location === 'team' ? '👥 Ekipte' : '🏭 Depoda'}</span></td>
      <td><span class="custody-cond-badge ${item.condition}">${condLabel[item.condition] || 'Bilinmiyor'}</span></td>
      <td><span class="custody-note-text" title="${item.conditionNote || ''}">${item.conditionNote || '-'}</span></td>
      ${isAdmin ? `
      <td style="white-space: nowrap;">
        <button class="custody-action-btn" onclick="window.editCustodyItem('${item.id}')" title="Düzenle"><i class="fa-solid fa-pencil"></i></button>
        <button class="custody-action-btn red" onclick="window.deleteCustodyItem('${item.id}')" title="Sil"><i class="fa-solid fa-trash-can"></i></button>
      </td>
      ` : ''}
    </tr>
  `;
}

// === WINDOW FUNCTIONS ===
(window as any).openCustodyModal = (editItem?: CustodyItem) => {
  const modal = document.getElementById('custody-modal');
  const title = document.getElementById('custody-modal-title');
  if (!modal) return;
  
  // Reset form
  (document.getElementById('custody-edit-id') as HTMLInputElement).value = editItem?.id || '';
  (document.getElementById('custody-code') as HTMLInputElement).value = editItem?.productCode || '';
  (document.getElementById('custody-name') as HTMLInputElement).value = editItem?.productName || '';
  (document.getElementById('custody-category') as HTMLSelectElement).value = editItem?.category || 'El Aleti';
  (document.getElementById('custody-desc') as HTMLInputElement).value = editItem?.description || '';
  (document.getElementById('custody-person') as HTMLInputElement).value = editItem?.assignedTo || '';
  (document.getElementById('custody-team') as HTMLSelectElement).value = editItem?.assignedTeam || '';
  (document.getElementById('custody-location') as HTMLSelectElement).value = editItem?.location || 'team';
  (document.getElementById('custody-condition') as HTMLSelectElement).value = editItem?.condition || 'saglam';
  (document.getElementById('custody-condition-note') as HTMLInputElement).value = editItem?.conditionNote || '';
  
  if (editItem?.warehouseId) {
    (document.getElementById('custody-warehouse') as HTMLSelectElement).value = editItem.warehouseId;
  }
  
  if (title) title.innerHTML = editItem 
    ? '<i class="fa-solid fa-pencil"></i> ZİMMET KAYDINI DÜZENLE' 
    : '<i class="fa-solid fa-screwdriver-wrench"></i> YENİ ZİMMET KAYDI';
  
  (window as any).toggleCustodyWarehouse();
  modal.classList.remove('hidden');
};

(window as any).closeCustodyModal = () => {
  document.getElementById('custody-modal')?.classList.add('hidden');
};

(window as any).toggleCustodyWarehouse = () => {
  const loc = (document.getElementById('custody-location') as HTMLSelectElement)?.value;
  const whGroup = document.getElementById('custody-warehouse-group');
  if (whGroup) whGroup.style.display = loc === 'depo' ? 'block' : 'none';
};

(window as any).saveCustodyItem = async () => {
  const id = (document.getElementById('custody-edit-id') as HTMLInputElement).value;
  const data = {
    productCode: (document.getElementById('custody-code') as HTMLInputElement).value.trim(),
    productName: (document.getElementById('custody-name') as HTMLInputElement).value.trim(),
    category: (document.getElementById('custody-category') as HTMLSelectElement).value,
    description: (document.getElementById('custody-desc') as HTMLInputElement).value.trim(),
    assignedTo: (document.getElementById('custody-person') as HTMLInputElement).value.trim(),
    assignedTeam: (document.getElementById('custody-team') as HTMLSelectElement).value,
    location: (document.getElementById('custody-location') as HTMLSelectElement).value as 'team' | 'depo',
    warehouseId: (document.getElementById('custody-warehouse') as HTMLSelectElement)?.value || '',
    condition: (document.getElementById('custody-condition') as HTMLSelectElement).value as 'saglam' | 'arizali' | 'hurda',
    conditionNote: (document.getElementById('custody-condition-note') as HTMLInputElement).value.trim(),
    createdBy: (window as any).currentUser?.displayName || 'Admin'
  };

  if (!data.productCode || !data.productName) {
    (window as any).showToast?.('HATA', 'Ürün kodu ve adı zorunludur.', 'error');
    return;
  }

  try {
    if (id) {
      await assetCustodyService.update(id, data);
      (window as any).showToast?.('BAŞARILI', 'Zimmet kaydı güncellendi.', 'success');
    } else {
      await assetCustodyService.add(data);
      (window as any).showToast?.('BAŞARILI', 'Yeni zimmet kaydı eklendi.', 'success');
    }
    (window as any).closeCustodyModal();
    (window as any).navigate('asset-custody');
  } catch (e) {
    (window as any).showToast?.('HATA', 'Kayıt sırasında bir hata oluştu.', 'error');
  }
};

(window as any).editCustodyItem = (id: string) => {
  const item = allItems.find(i => i.id === id);
  if (item) (window as any).openCustodyModal(item);
};

(window as any).deleteCustodyItem = async (id: string) => {
  if (!confirm('Bu zimmet kaydını silmek istediğinize emin misiniz?')) return;
  try {
    await assetCustodyService.remove(id);
    (window as any).showToast?.('BİLGİ', 'Zimmet kaydı silindi.', 'info');
    (window as any).navigate('asset-custody');
  } catch (e) {
    (window as any).showToast?.('HATA', 'Silme işlemi başarısız.', 'error');
  }
};

(window as any).filterCustodyItems = () => {
  searchQuery = ((document.getElementById('custody-search') as HTMLInputElement)?.value || '').toLowerCase();
  filterTeam = (document.getElementById('custody-filter-team') as HTMLSelectElement)?.value || 'all';
  filterCondition = (document.getElementById('custody-filter-condition') as HTMLSelectElement)?.value || 'all';
  filterLocation = (document.getElementById('custody-filter-location') as HTMLSelectElement)?.value || 'all';

  const rows = document.querySelectorAll('#custody-table-body tr[data-team]');
  rows.forEach((row: any) => {
    const team = row.getAttribute('data-team');
    const condition = row.getAttribute('data-condition');
    const location = row.getAttribute('data-location');
    const searchStr = row.getAttribute('data-search');
    
    let show = true;
    if (filterTeam !== 'all' && team !== filterTeam) show = false;
    if (filterCondition !== 'all' && condition !== filterCondition) show = false;
    if (filterLocation !== 'all' && location !== filterLocation) show = false;
    if (searchQuery && !searchStr.includes(searchQuery)) show = false;
    
    row.style.display = show ? '' : 'none';
  });
};
