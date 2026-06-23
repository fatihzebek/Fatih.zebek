import { repairService } from '../services/RepairService';
import { dataService } from '../services/DataService';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

export const WorkshopStockPage = async () => {
  const currentUser = (window as any).currentUser;
  const username = currentUser?.displayName || currentUser?.email || 'Malzeme Yönetimi';

  // Fetch repair records and warehouses
  const repairs = await repairService.getRepairs();
  const warehouses = dataService.getWarehouses();

  // Filter for repaired items that are currently in workshop stock
  const repairedStockItems = repairs.filter(r => r.status === 'REPAIRED');
  // Attach global functions to window
  (window as any).openDispatchRepairedModal = (repairId: string, sapNo: string, description: string, quantity: number, serialNo: string = '-') => {
    const modal = document.createElement('div');
    modal.id = 'dispatch-repaired-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    const warehouseOptions = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-truck-ramp-box" style="margin-right:8px;"></i> MALZEMEYİ SEVK ET (TRANSFER)
          </h3>
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
            <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Seri No: ${serialNo} | Miktar: ${quantity} Adet</span>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700; text-transform:uppercase;">Sevk Edilecek Hedef Depo</label>
          <select id="repaired-target-warehouse" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); color:#FFF; border-radius:8px;">
            ${warehouseOptions}
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
          <button id="btn-submit-repaired-dispatch" onclick="window.submitRepairedDispatch('${repairId}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">SEVK ET (YOLA ÇIKAR)</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitRepairedDispatch = async (repairId: string) => {
    const targetSelect = document.getElementById('repaired-target-warehouse') as HTMLSelectElement;
    if (!targetSelect || !targetSelect.value) {
      alert('Lütfen hedef sevk deposunu seçin.');
      return;
    }

    const btn = document.getElementById('btn-submit-repaired-dispatch');
    if (btn) btn.setAttribute('disabled', 'true');

    try {
      (window as any).showToast('İşlem', 'Malzeme sevk ediliyor...', 'info');
      await repairService.dispatchRepair(repairId, targetSelect.value, username);

      // Deduct REVISED stock from W11
      const rep = repairedStockItems.find(r => r.id === repairId);
      if (rep) {
        const { warehouseService } = await import('../services/WarehouseService');
        const sapNoWithR = rep.sapNo.toUpperCase().startsWith('R') ? rep.sapNo : 'R' + rep.sapNo;
        await warehouseService.updateStockBySap(
          'W11',
          sapNoWithR,
          -rep.quantity,
          {
            user: username,
            reason: `Malzeme ${targetSelect.options[targetSelect.selectedIndex].text} deposuna sevk edildi.`
          },
          'REVISED'
        );
      }

      (window as any).showToast('Başarılı', 'Malzeme başarıyla hedef depoya sevk edildi.', 'success');
      
      const modal = document.getElementById('dispatch-repaired-modal');
      if (modal) modal.remove();

      // Reload page
      if ((window as any).navigate) {
        (window as any).navigate('workshop-stock');
      }
    } catch (e) {
      console.error(e);
      alert('Sevk işlemi gerçekleştirilemedi.');
      if (btn) btn.removeAttribute('disabled');
    }
  };

  // Render Rows for repaired items
  const renderRows = () => {
    if (repairedStockItems.length === 0) {
      return `<tr><td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-dim); border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">Atölyede tamir edilmiş ve sevk bekleyen herhangi bir parça bulunamadı.</td></tr>`;
    }

    return repairedStockItems.map(item => {
      const cleanNameEscaped = item.description.replace(/'/g, "\\'");
      const sourceWhName = warehouses.find(w => w.id === item.sourceWarehouseId)?.name || item.sourceWarehouseId;
      
      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 1rem; font-size: 0.85rem; color: var(--text-dim);">${formatDateTime(item.repairedAt || item.sentAt)}</td>
          <td style="padding: 1rem; font-size: 0.85rem; color: #E2E8F0; font-weight: 600;">
            <div>${sourceWhName}</div>
            ${item.dispatchNo ? `<div style="font-size: 0.72rem; color: #14F195; font-family: monospace; font-weight: bold; margin-top: 4px;"><i class="fa-solid fa-truck-ramp-box" style="margin-right: 2px;"></i> ${item.dispatchNo}</div>` : ''}
          </td>
          <td style="padding: 1rem; color: #3B82F6; font-family: monospace;">${item.sapNo}</td>
          <td style="padding: 1rem; font-size: 0.85rem; color: #10B981; font-family: monospace; font-weight: bold;">${item.serialNo || '-'}</td>
          <td style="padding: 1rem;">
            <div style="font-weight: 700; color: #FFF;">${item.description}</div>
            ${item.faultCode && item.faultCode !== '-' ? `<div style="font-size: 0.72rem; color: #F59E0B; font-weight: 600; margin-top: 4px;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 2px;"></i> Arıza: ${item.faultCode}</div>` : ''}
          </td>
          <td style="padding: 1rem; font-weight: 800; color: #14F195; text-align: center;">${item.quantity} Adet</td>
          <td style="padding: 1rem; color: #E2E8F0; font-style: italic; font-size: 0.8rem; max-width: 300px; word-break: break-word;">
            "${item.repairNotes || '-'}"
          </td>
          <td style="padding: 1rem; text-align: right; white-space: nowrap;">
            <button onclick="window.openDispatchRepairedModal('${item.id}', '${item.sapNo}', '${cleanNameEscaped}', ${item.quantity}, '${item.serialNo || '-'}')" class="btn-cyber" style="background: linear-gradient(135deg, #3B82F6 0%, #1d4ed8 100%); color: #FFF; font-weight: 800; border: none; padding: 0.45rem 0.9rem; border-radius: 6px; font-size: 0.78rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 8px rgba(59, 130, 246, 0.2);" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
              <i class="fa-solid fa-truck-ramp-box" style="font-size: 0.72rem;"></i> Sahaya Sevk Et
            </button>
          </td>
        </tr>
      `;
    }).join('');
  };

  return `
    <div class="fade-in-up content-area">
      <!-- Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-warehouse" style="margin-right: 0.5rem;"></i> Atölye Tamir Stoğu
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Merkez Tamir Atölyesi'nde tamiri tamamlanıp sahalara sevk edilmeyi bekleyen malzemelerin merkezi listesi.</p>
        </div>
      </div>

      <!-- Repairs Table -->
      <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; overflow-x: auto;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main);">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); font-size: 0.85rem; text-align: left;">
              <th style="padding: 1rem; width: 160px;">Tamir Tarihi</th>
              <th style="padding: 1rem; width: 180px;">Söküldüğü Saha</th>
              <th style="padding: 1rem; width: 120px;">SAP No</th>
              <th style="padding: 1rem; width: 120px;">Seri No</th>
              <th style="padding: 1rem;">Malzeme Açıklaması</th>
              <th style="padding: 1rem; text-align: center; width: 100px;">Miktar</th>
              <th style="padding: 1rem;">Onarım Notu</th>
              <th style="padding: 1rem; text-align: right; width: 150px;">Aksiyonlar</th>
            </tr>
          </thead>
          <tbody>
            ${renderRows()}
          </tbody>
        </table>
      </div>
    </div>
  `;
};
