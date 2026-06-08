import { dataService } from '../services/DataService';
import { inventoryService } from '../services/InventoryService';
import { transferService } from '../services/TransferService';
import { authService } from '../services/AuthService';

import type { UserProfile } from '../services/UserService';

export const TransferPage = async (userProfile?: UserProfile | null) => {
  const isAdmin = userProfile?.role === 'ADMIN';
  const allWarehouses = dataService.getWarehouses();
  
  const filteredWarehouses = isAdmin 
    ? allWarehouses 
    : allWarehouses.filter(w => userProfile?.allowedWarehouses?.includes(w.id));

  const transfers = await transferService.getTransfers();

  return `
    <div class="fade-in-up content-area">
      <h1 class="page-title"><i class="fa-solid fa-truck-ramp-box" style="color: var(--accent-cyan);"></i> Malzeme Transfer İşlemleri</h1>
      
      <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 2rem;">
        <!-- Transfer Form -->
        <div class="glass-panel" style="padding: 2rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 2rem;">Yeni Transfer Talebi</h3>
          <form id="transfer-form">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
              <div class="form-group">
                <label>NEREDEN (ÇIKIŞ)</label>
                <select id="from-site" class="cyber-input" required>
                  <option value="">Depo Seçin</option>
                  ${filteredWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>NEREYE (VARIŞ)</label>
                <select id="to-site" class="cyber-input" required>
                  <option value="">Depo Seçin</option>
                  ${filteredWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
                </select>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem; position: relative;">
              <label>MALZEME SEÇİMİ (SAP)</label>
              <input type="text" id="transfer-material-search" class="cyber-input" placeholder="Malzeme adı veya kodu yazın..." autocomplete="off">
              <div id="transfer-material-results" class="search-dropdown hidden"></div>
              <input type="hidden" id="selected-material-code">
              <input type="hidden" id="selected-material-name">
            </div>

            <div class="form-group" style="margin-bottom: 2rem;">
              <label>ADET / MİKTAR</label>
              <input type="number" id="transfer-qty" class="cyber-input" value="1" min="1" required>
            </div>

            <button type="submit" class="btn-cyber" style="width: 100%; justify-content: center; padding: 1rem;">
              TRANSFERİ BAŞLAT <i class="fa-solid fa-paper-plane" style="margin-left: 0.5rem;"></i>
            </button>
          </form>
        </div>

        <!-- Recent Transfers List -->
        <div class="glass-panel" style="padding: 1.5rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem;">Son Transferler</h3>
          <div style="overflow-y: auto; max-height: 500px;">
            ${transfers.length === 0 ? `
              <div style="padding: 3rem; text-align: center; color: var(--text-muted);">
                <i class="fa-solid fa-clock-rotate-left" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.2;"></i>
                <p>Henüz transfer kaydı yok.</p>
              </div>
            ` : `
              <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem;">
                <thead>
                  <tr style="text-align: left; color: var(--text-muted); border-bottom: 1px solid var(--glass-border);">
                    <th style="padding: 0.75rem;">ROTA</th>
                    <th style="padding: 0.75rem;">MALZEME</th>
                    <th style="padding: 0.75rem;">MİKTAR</th>
                    <th style="padding: 0.75rem;">DURUM</th>
                  </tr>
                </thead>
                <tbody>
                  ${transfers.map(t => {
                    const fromWh = allWarehouses.find(w => w.id === t.fromSiteId);
                    const toWh = allWarehouses.find(w => w.id === t.toSiteId);
                    return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      <td style="padding: 0.75rem;">
                        <div style="font-weight: 700; font-size: 0.7rem; color: var(--text-main);">
                          ${fromWh?.name || t.fromSiteId} 
                          <i class="fa-solid fa-arrow-right" style="font-size: 0.5rem; color: var(--accent-cyan); margin: 0 4px;"></i> 
                          ${toWh?.name || t.toSiteId}
                        </div>
                      </td>
                      <td style="padding: 0.75rem;">
                        <div style="color: var(--text-main);">${t.materialName}</div>
                        <div style="font-size: 0.65rem; color: var(--text-muted);">${t.materialCode}</div>
                      </td>
                      <td style="padding: 0.75rem; font-weight: 800; color: var(--accent-cyan);">${t.quantity}</td>
                      <td style="padding: 0.75rem;">
                        ${(() => {
                          let style = 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted);';
                          let text: string = t.status;
                          if (t.status === 'PENDING') {
                            style = 'background: rgba(255, 193, 7, 0.1); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.2);';
                            text = 'ONAY BEKLİYOR';
                          } else if (t.status === 'COMPLETED') {
                            style = 'background: rgba(40, 167, 69, 0.1); color: #28a745; border: 1px solid rgba(40, 167, 69, 0.2);';
                            text = 'TAMAMLANDI';
                          } else if (t.status === 'REJECTED') {
                            style = 'background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid rgba(220, 53, 69, 0.2);';
                            text = 'REDDEDİLDİ';
                          }
                          return `
                            <span class="badge" style="${style} font-size: 0.55rem; font-weight: 800; padding: 4px 8px; border-radius: 6px;">
                              ${text}
                            </span>
                            ${t.status === 'PENDING' ? `
                              <div style="font-size: 0.5rem; color: var(--text-muted); margin-top: 4px; display: flex; align-items: center; gap: 4px;">
                                <i class="fa-solid fa-user-clock"></i> Hurşit Akter onayı bekleniyor
                              </div>
                            ` : ''}
                          `;
                        })()}
                      </td>
                    </tr>
                  `}).join('')}
                </tbody>
              </table>
            `}
          </div>
        </div>
      </div>
    </div>
  `;
};

// Event Handlers for Transfers
(window as any).initTransferLogic = () => {
  const searchInput = document.getElementById('transfer-material-search') as HTMLInputElement;
  const resultsDiv = document.getElementById('transfer-material-results');
  const form = document.getElementById('transfer-form');

  if (searchInput && resultsDiv) {
    searchInput.addEventListener('input', async (e) => {
      const query = (e.target as HTMLInputElement).value;
      if (query.length < 2) {
        resultsDiv.classList.add('hidden');
        return;
      }

      const results = await inventoryService.searchMaterials(query);
      resultsDiv.innerHTML = results.slice(0, 10).map(m => `
        <div class="search-item" onclick="window.selectTransferMaterial('${m.n}', '${m.d}')">
          <div style="font-weight: 700; color: var(--accent-cyan);">${m.n}</div>
          <div style="font-size: 0.7rem; color: var(--text-muted);">${m.d}</div>
        </div>
      `).join('');
      resultsDiv.classList.remove('hidden');
    });
  }

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fromSite = (document.getElementById('from-site') as HTMLSelectElement).value;
      const toSite = (document.getElementById('to-site') as HTMLSelectElement).value;
      const materialCode = (document.getElementById('selected-material-code') as HTMLInputElement).value;
      const materialName = (document.getElementById('selected-material-name') as HTMLInputElement).value;
      const quantity = parseInt((document.getElementById('transfer-qty') as HTMLInputElement).value);

      if (!fromSite || !toSite || !materialCode || fromSite === toSite) {
        alert('Lütfen geçerli bir rota ve malzeme seçin.');
        return;
      }

      try {
        await transferService.createTransfer({
          fromSiteId: fromSite,
          toSiteId: toSite,
          materialCode,
          materialName,
          quantity,
          status: 'PENDING',
          requestedBy: authService.getCurrentUser()?.email || 'Admin'
        });
        alert('Transfer talebi oluşturuldu!');
        (window as any).navigate('transfers');
      } catch (err) {
        alert('Hata oluştu!');
      }
    });
  }
};

(window as any).selectTransferMaterial = (code: string, name: string) => {
  const input = document.getElementById('transfer-material-search') as HTMLInputElement;
  const codeHidden = document.getElementById('selected-material-code') as HTMLInputElement;
  const nameHidden = document.getElementById('selected-material-name') as HTMLInputElement;
  const resultsDiv = document.getElementById('transfer-material-results');

  if (input && codeHidden && nameHidden && resultsDiv) {
    input.value = `${code} - ${name}`;
    codeHidden.value = code;
    nameHidden.value = name;
    resultsDiv.classList.add('hidden');
  }
};
