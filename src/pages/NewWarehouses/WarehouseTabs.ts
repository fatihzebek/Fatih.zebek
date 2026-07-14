import { warehouseState } from './WarehouseState';

export const switchTab = async (tabName: string, id: string) => {
  const tabs = ['tab-ENVANTER', 'tab-ANALİZ', 'tab-SAYIM', 'tab-SAYIM_GECMISI', 'tab-DEPO_HAREKETLERI', 'tab-DEFECT', 'tab-TRANSFERLER'];
  const views = ['view-ENVANTER', 'view-ANALİZ', 'view-SAYIM', 'view-SAYIM_GECMISI', 'view-DEPO_HAREKETLERI', 'view-DEFECT', 'view-TRANSFERLER'];
  
  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      if (t === id) {
        el.dataset.active = 'true';
        el.style.color = '#14F195';
        el.style.border = '1px solid #14F195';
      } else {
        el.dataset.active = 'false';
        el.style.color = '#94A3B8';
        el.style.border = '1px solid transparent';
      }
    }
  });

  views.forEach(v => {
    const el = document.getElementById(v);
    if (el) {
      if (v === 'view-' + tabName) {
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }
  });
  
  const actionBar = document.getElementById('inventory-action-bar');
  if (actionBar) {
    actionBar.style.display = (tabName === 'ENVANTER') ? 'flex' : 'none';
  }

  (window as any).currentWarehouseTab = tabName === 'ENVANTER' ? 'INVENTORY' : tabName;

  if (tabName === 'SAYIM') {
     if ((window as any).renderManualAuditTable) {
       (window as any).renderManualAuditTable();
     }
     if ((window as any).updateManualSummaryBar) {
       (window as any).updateManualSummaryBar();
     }
  }

  if (tabName === 'ENVANTER') {
     if ((window as any).renderInventoryTable) {
       (window as any).renderInventoryTable();
     }
  }

  if (tabName === 'TRANSFERLER') {
     if ((window as any).loadWarehouseTransfers) {
        (window as any).loadWarehouseTransfers();
     }
  }

  if (tabName === 'DEPO_HAREKETLERI') {
     const searchInput = document.getElementById('depo-hareketleri-search') as HTMLInputElement;
     if (searchInput) {
       searchInput.value = '';
     }
     if (typeof (window as any).loadDepoHareketleriLogs === 'function') {
       (window as any).loadDepoHareketleriLogs();
     }
  }

  if (tabName === 'SAYIM_GECMISI') {
     if (typeof (window as any).loadSayimGecmisi === 'function') {
       (window as any).loadSayimGecmisi();
     }
  }
};

(window as any).switchTab = switchTab;

export const renderTabsHTML = (currentWarehouseId: string, currentTab: string, isMobileWarehouse: boolean) => {
  return `
    <div style="display: flex; gap: 0.75rem; border-bottom: 1px solid #1E293B; margin-bottom: 2rem; padding-bottom: 0.5rem; overflow-x: auto;">
      <div onclick="window.switchTab('ENVANTER', 'tab-ENVANTER')" id="tab-ENVANTER" data-active="${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
        <i class="fa-solid fa-layer-group"></i> ENVANTER
      </div>
      ${isMobileWarehouse ? `
        <div onclick="window.switchTab('ANALİZ', 'tab-ANALİZ')" id="tab-ANALİZ" data-active="${currentTab === 'ANALİZ' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'ANALİZ' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'ANALİZ' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-screwdriver-wrench"></i> KULLANIMLAR
        </div>
        <div onclick="window.switchTab('DEPO_HAREKETLERI', 'tab-DEPO_HAREKETLERI')" id="tab-DEPO_HAREKETLERI" data-active="${currentTab === 'DEPO_HAREKETLERI' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEPO_HAREKETLERI' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEPO_HAREKETLERI' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-clock-rotate-left"></i> DEPO HAREKETLERİ
        </div>
        <div onclick="window.switchTab('DEFECT', 'tab-DEFECT')" id="tab-DEFECT" data-active="${currentTab === 'DEFECT' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEFECT' ? '#EF4444' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEFECT' ? '#EF4444' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-triangle-exclamation"></i> DEFECT LİSTESİ
        </div>
        <div onclick="window.switchTab('TRANSFERLER', 'tab-TRANSFERLER')" id="tab-TRANSFERLER" data-active="${currentTab === 'TRANSFERLER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'TRANSFERLER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'TRANSFERLER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-truck-ramp-box"></i> TRANSFERLER
        </div>
      ` : `
        ${currentWarehouseId !== 'MTA' ? `
          <div onclick="window.switchTab('ANALİZ', 'tab-ANALİZ')" id="tab-ANALİZ" data-active="${currentTab === 'ANALİZ' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'ANALİZ' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'ANALİZ' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-screwdriver-wrench"></i> KULLANIMLAR
          </div>
        ` : ''}
        <div onclick="window.switchTab('SAYIM', 'tab-SAYIM')" id="tab-SAYIM" data-active="${currentTab === 'SAYIM' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'SAYIM' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-clipboard-check"></i> SAYIM
        </div>
        <div onclick="window.switchTab('SAYIM_GECMISI', 'tab-SAYIM_GECMISI')" id="tab-SAYIM_GECMISI" data-active="${currentTab === 'SAYIM_GECMISI' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'SAYIM_GECMISI' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-file-invoice"></i> SAYIM GEÇMİŞİ
        </div>
        ${currentWarehouseId !== 'MTA' ? `
          <div onclick="window.switchTab('DEFECT', 'tab-DEFECT')" id="tab-DEFECT" data-active="${currentTab === 'DEFECT' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'DEFECT' ? '#EF4444' : '#94A3B8'}; border: 1px solid ${currentTab === 'DEFECT' ? '#EF4444' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-triangle-exclamation"></i> DEFECT LİSTESİ
          </div>
          <div onclick="window.switchTab('TRANSFERLER', 'tab-TRANSFERLER')" id="tab-TRANSFERLER" data-active="${currentTab === 'TRANSFERLER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'TRANSFERLER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'TRANSFERLER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
            <i class="fa-solid fa-truck-ramp-box"></i> TRANSFERLER
          </div>
        ` : ''}
      `}
    </div>
  `;
};
