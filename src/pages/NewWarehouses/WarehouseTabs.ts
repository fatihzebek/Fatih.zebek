import { warehouseState, isUserFatihZebek, isPcbMaterial, isIgbtMaterial } from './WarehouseState';

export const switchTab = async (tabName: string, id: string) => {
  const tabs = ['tab-ENVANTER', 'tab-PCB', 'tab-IGBT', 'tab-ANALİZ', 'tab-SAYIM', 'tab-SAYIM_GECMISI', 'tab-DEPO_HAREKETLERI', 'tab-DEFECT', 'tab-TRANSFERLER', 'tab-UNPRICED'];
  const views = ['view-ENVANTER', 'view-ANALİZ', 'view-SAYIM', 'view-SAYIM_GECMISI', 'view-DEPO_HAREKETLERI', 'view-DEFECT', 'view-TRANSFERLER', 'view-UNPRICED'];
  
  tabs.forEach(t => {
    const el = document.getElementById(t);
    if (el) {
      if (t === id) {
        el.dataset.active = 'true';
        let activeColor = '#14F195';
        if (t === 'tab-DEFECT') activeColor = '#EF4444';
        else if (t === 'tab-UNPRICED') activeColor = '#F59E0B';
        else if (t === 'tab-PCB') activeColor = '#38BDF8';
        else if (t === 'tab-IGBT') activeColor = '#A855F7';
        
        el.style.color = activeColor;
        el.style.border = `1px solid ${activeColor}`;
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
      if (v === 'view-' + tabName || ((tabName === 'PCB' || tabName === 'IGBT') && v === 'view-ENVANTER')) {
        el.style.display = 'block';
      } else {
        el.style.display = 'none';
      }
    }
  });
  
  const actionBar = document.getElementById('inventory-action-bar');
  if (actionBar) {
    actionBar.style.display = (tabName === 'ENVANTER' || tabName === 'UNPRICED' || tabName === 'PCB' || tabName === 'IGBT') ? 'flex' : 'none';
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

  if (tabName === 'ENVANTER' || tabName === 'PCB' || tabName === 'IGBT') {
     if ((window as any).renderInventoryTable) {
       (window as any).renderInventoryTable();
     }
  }

  if (tabName === 'UNPRICED') {
     if ((window as any).renderUnpricedTable) {
       (window as any).renderUnpricedTable();
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
  const canViewPrices = warehouseState.canViewPrices;
  const unpricedCount = warehouseState.unpricedItems?.length || 0;
  const isFatihZebek = isUserFatihZebek();

  const validItems = (warehouseState.inventoryItems || []).filter(i => i.condition !== 'DEFECT' && i.condition !== 'SCRAP' && i.status !== 'HURDAYA_AYRILDI');
  const pcbCount = validItems.filter(i => isPcbMaterial(i)).length;
  const igbtCount = validItems.filter(i => isIgbtMaterial(i)).length;

  return `
    <div style="display: flex; gap: 0.75rem; border-bottom: 1px solid #1E293B; margin-bottom: 2rem; padding-bottom: 0.5rem; overflow-x: auto;">
      <div onclick="window.switchTab('ENVANTER', 'tab-ENVANTER')" id="tab-ENVANTER" data-active="${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : '#94A3B8'}; border: 1px solid ${currentTab === 'INVENTORY' || currentTab === 'ENVANTER' ? '#14F195' : 'transparent'}; border-radius: 6px; font-weight: 600; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
        <i class="fa-solid fa-layer-group"></i> ENVANTER
      </div>
      ${isFatihZebek ? `
        <div onclick="window.switchTab('PCB', 'tab-PCB')" id="tab-PCB" data-active="${currentTab === 'PCB' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'PCB' ? '#38BDF8' : '#94A3B8'}; border: 1px solid ${currentTab === 'PCB' ? '#38BDF8' : 'transparent'}; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-microchip" style="color: #38BDF8;"></i> 📟 PCB (KARTLAR) (<span id="pcb-tab-count">${pcbCount}</span>)
        </div>
        <div onclick="window.switchTab('IGBT', 'tab-IGBT')" id="tab-IGBT" data-active="${currentTab === 'IGBT' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'IGBT' ? '#A855F7' : '#94A3B8'}; border: 1px solid ${currentTab === 'IGBT' ? '#A855F7' : 'transparent'}; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-bolt" style="color: #A855F7;"></i> ⚡ IGBT & MODÜL (<span id="igbt-tab-count">${igbtCount}</span>)
        </div>
      ` : ''}
      ${canViewPrices ? `
        <div onclick="window.switchTab('UNPRICED', 'tab-UNPRICED')" id="tab-UNPRICED" data-active="${currentTab === 'UNPRICED' ? 'true' : 'false'}" style="padding: 0.35rem 0.75rem; font-size: 0.78rem; color: ${currentTab === 'UNPRICED' ? '#F59E0B' : '#94A3B8'}; border: 1px solid ${currentTab === 'UNPRICED' ? '#F59E0B' : 'transparent'}; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;" onmouseover="this.style.color='#E2E8F0'" onmouseout="if(this.dataset.active!=='true')this.style.color='#94A3B8'">
          <i class="fa-solid fa-tags" style="color: #F59E0B;"></i> FİYATI GİRİLMEYENLER (<span id="unpriced-tab-count">${unpricedCount}</span>)
        </div>
      ` : ''}
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
