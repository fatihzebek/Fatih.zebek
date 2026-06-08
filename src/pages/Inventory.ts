import { inventoryService } from '../services/InventoryService';

export const InventoryPage = () => `
  <div class="fade-in-up content-area zoom-tablet" style="max-width: 1400px; margin: 0 auto;">
    <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem;">
        <div>
            <h1 class="page-title" style="margin-bottom: 0.5rem;">
                <i class="fa-solid fa-boxes-stacked" style="color: var(--accent-orange);"></i> 
                Merkez Katalog & Stok
            </h1>
            <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">54.000+ kalem malzemenin merkezi yönetim ve takip paneli</p>
        </div>
        <div style="display: flex; gap: 1rem;">
            <div class="glass-card" style="padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 12px; border-color: rgba(255, 165, 0, 0.2);">
                <i class="fa-solid fa-database" style="color: var(--accent-orange); font-size: 1.2rem; opacity: 0.7;"></i>
                <div>
                    <div style="font-size: 0.55rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px;">SİSTEM KAYDI</div>
                    <div style="font-size: 1.1rem; font-weight: 900; color: var(--text-main);">54.218</div>
                </div>
            </div>
            <button class="cyber-button primary" style="background: var(--accent-orange); box-shadow: 0 10px 20px rgba(255, 165, 0, 0.15);">
                <i class="fa-solid fa-file-export"></i> DIŞA AKTAR
            </button>
        </div>
    </div>
    
    <div class="glass-panel" style="padding: 1.5rem; border-radius: 24px; background: rgba(13, 20, 33, 0.4);">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; gap: 1.5rem;">
        <div style="display: flex; gap: 1rem; flex-grow: 1; position: relative;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--accent-orange); font-size: 0.9rem; opacity: 0.7;"></i>
            <input type="text" id="inv-search" placeholder="SAP no, malzeme ismi veya teknik açıklama ile akıllı arama yapın..." 
                   style="background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.9rem 1rem 0.9rem 3rem; border-radius: 16px; width: 100%; font-size: 0.95rem; font-weight: 500; outline: none; transition: all 0.3s; box-shadow: inset 0 2px 10px rgba(0,0,0,0.2);"
                   oninput="window.handleInventorySearch(this.value)"
                   onfocus="this.style.borderColor='rgba(255, 165, 0, 0.4)'; this.style.boxShadow='inset 0 2px 10px rgba(0,0,0,0.2), 0 0 20px rgba(255, 165, 0, 0.05)';"
                   onblur="this.style.borderColor='rgba(255,255,255,0.08)';"
                   autocomplete="off">
        </div>
        <div style="display: flex; gap: 0.5rem;">
            <button class="action-icon-btn" style="width: 44px; height: 44px; border-radius: 12px; background: rgba(255,255,255,0.03);"><i class="fa-solid fa-sliders"></i></button>
        </div>
      </div>

      <div id="inv-results-container" style="overflow-x: auto; min-height: 400px;">
        <table style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
          <thead>
            <tr style="text-align: left; color: var(--text-dim); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 1.5px; font-weight: 800;">
              <th style="padding: 1rem 1.5rem;">SAP NO</th>
              <th style="padding: 1rem 1.5rem;">MALZEME TANIMI</th>
              <th style="padding: 1rem 1.5rem;">LOKASYON</th>
              <th style="padding: 1rem 1.5rem; text-align: center;">DURUM</th>
              <th style="padding: 1rem 1.5rem; text-align: right;">AKSİYON</th>
            </tr>
          </thead>
          <tbody id="inventory-tbody">
            <tr>
              <td colspan="5" style="padding: 6rem 3rem; text-align: center; color: var(--text-dim);">
                <div style="opacity: 0.3;">
                    <i class="fa-solid fa-keyboard" style="font-size: 3rem; margin-bottom: 1.5rem; display: block;"></i>
                    <p style="font-size: 1rem; font-weight: 600;">Arama Yapmak İçin Yazmaya Başlayın</p>
                    <p style="font-size: 0.8rem; margin-top: 0.5rem;">SAP No veya isim ile anlık filtreleme yapabilirsiniz</p>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
`;

(window as any).handleInventorySearch = (query: string) => {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  if (query.length < 2) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 6rem 3rem; text-align: center; color: var(--text-dim); opacity: 0.3;">
            <i class="fa-solid fa-keyboard" style="font-size: 3rem; margin-bottom: 1.5rem; display: block;"></i>
            <p style="font-size: 1rem; font-weight: 600;">Arama Yapmak İçin Yazmaya Başlayın</p>
        </td>
      </tr>
    `;
    return;
  }

  const results = inventoryService.searchMaterials(query);
  
  if (results.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="padding: 6rem 3rem; text-align: center; color: var(--text-dim); opacity: 0.3;">
          <i class="fa-solid fa-ghost" style="font-size: 3rem; margin-bottom: 1.5rem; display: block;"></i>
          <p style="font-size: 1rem; font-weight: 600;">Eşleşen Kayıt Bulunamadı</p>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = results.map(item => `
    <tr class="hover-row-premium" style="background: rgba(255,255,255,0.02); border-radius: 12px; transition: all 0.3s;">
      <td style="padding: 1.2rem 1.5rem; border-top-left-radius: 12px; border-bottom-left-radius: 12px;">
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-family: 'JetBrains Mono', monospace; color: var(--accent-orange); font-weight: 800; font-size: 0.9rem; background: rgba(255, 165, 0, 0.05); padding: 4px 10px; border-radius: 6px;">${item.n}</span>
            <button class="action-icon-btn" style="width: 24px; height: 24px; font-size: 0.6rem; border: none; background: none;" onclick="window.copyToClipboard('${item.n}')"><i class="fa-solid fa-copy"></i></button>
        </div>
      </td>
      <td style="padding: 1.2rem 1.5rem;">
        <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-main);">${item.d}</div>
        <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 4px;">TEKNİK MALZEME KODU: ${item.n}</div>
      </td>
      <td style="padding: 1.2rem 1.5rem;">
        <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-warehouse" style="font-size: 0.7rem; color: var(--text-dim);"></i>
            <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-dim);">MERKEZ KATALOG</span>
        </div>
      </td>
      <td style="padding: 1.2rem 1.5rem; text-align: center;">
         <span style="padding: 4px 12px; border-radius: 20px; font-size: 0.6rem; font-weight: 900; background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); border: 1px solid rgba(100, 255, 218, 0.2);">AKTİF</span>
      </td>
      <td style="padding: 1.2rem 1.5rem; text-align: right; border-top-right-radius: 12px; border-bottom-right-radius: 12px;">
        <button class="cyber-button" style="padding: 0.5rem 1rem; font-size: 0.7rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
            <i class="fa-solid fa-circle-info"></i> DETAY
        </button>
      </td>
    </tr>
  `).join('');
};

