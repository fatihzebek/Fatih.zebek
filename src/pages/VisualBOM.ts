import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { turbineBOMData } from '../data/turbineBOMData';

export const VisualBOMPage = async () => {
  // Load custom parts from LocalStorage and merge into turbineBOMData, and filter deleted parts
  try {
    const customBOMDataRaw = localStorage.getItem('_customBOMParts');
    const deletedPartsRaw = localStorage.getItem('_deletedBOMParts');
    const deletedParts = deletedPartsRaw ? JSON.parse(deletedPartsRaw) : {};
    
    if (customBOMDataRaw) {
      const customBOMData = JSON.parse(customBOMDataRaw);
      for (const [systemId, parts] of Object.entries(customBOMData)) {
        for (const model of Object.keys(turbineBOMData)) {
          for (const category of ['nacelle', 'rotor', 'tower'] as const) {
            const systems = turbineBOMData[model]?.[category] || [];
            const sys = systems.find(s => s.id === systemId);
            if (sys) {
              sys.parts = sys.parts || [];
              for (const customPart of (parts as any[])) {
                const existingIdx = sys.parts.findIndex(p => p.sapNo === customPart.sapNo);
                if (existingIdx > -1) {
                  sys.parts[existingIdx] = customPart;
                } else {
                  sys.parts.push(customPart);
                }
              }
            }
          }
        }
      }
    }

    // Apply deletion filter
    for (const [systemId, sapNos] of Object.entries(deletedParts)) {
      for (const model of Object.keys(turbineBOMData)) {
        for (const category of ['nacelle', 'rotor', 'tower'] as const) {
          const systems = turbineBOMData[model]?.[category] || [];
          const sys = systems.find(s => s.id === systemId);
          if (sys && sys.parts) {
            sys.parts = sys.parts.filter(p => !(sapNos as string[]).includes(p.sapNo));
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading custom/deleted BOM parts from local storage', e);
  }

  // Fetch all inventory across all warehouses for real-time stock lookup
  const warehouses = dataService.getWarehouses();
  let allInventory: any[] = [];
  
  await Promise.all(warehouses.map(async (w) => {
    try {
      const inv = await warehouseService.getInventory(w.id);
      allInventory = allInventory.concat(inv.map(i => ({...i, warehouseName: w.name, warehouseId: w.id})));
    } catch (e) {
      console.warn('Error fetching data for warehouse', w.id, e);
    }
  }));

  // Attach data to window for interactions
  (window as any)._allInventory = allInventory;
  (window as any)._selectedModel = (window as any)._selectedModel || 'E92';
  (window as any)._selectedCategory = (window as any)._selectedCategory || 'nacelle';
  (window as any)._selectedSystemId = (window as any)._selectedSystemId || '';

  // Setup helper functions
  (window as any).selectTurbineModel = (model: string) => {
    (window as any)._selectedModel = model;
    (window as any)._selectedSystemId = '';
    const systems = turbineBOMData[model]?.[(window as any)._selectedCategory as 'nacelle' | 'rotor' | 'tower'] || [];
    if (systems.length > 0) {
      (window as any)._selectedSystemId = systems[0].id;
    }
    (window as any).render();
  };

  (window as any).selectBOMCategory = (category: string) => {
    (window as any)._selectedCategory = category;
    (window as any)._selectedSystemId = '';
    const model = (window as any)._selectedModel;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    if (systems.length > 0) {
      (window as any)._selectedSystemId = systems[0].id;
    }
    (window as any).render();
    
    // Highlight active SVG element manually if needed
    document.querySelectorAll('.svg-hotspot').forEach(el => el.classList.remove('active'));
    const hotspot = document.getElementById(`hotspot-${category}`);
    if (hotspot) hotspot.classList.add('active');
  };

  (window as any).selectBOMSystem = (systemId: string) => {
    (window as any)._selectedSystemId = systemId;
    (window as any).renderBOMDetailPanel();
    
    // Highlight list item
    document.querySelectorAll('.system-list-item').forEach(el => el.classList.remove('active-item'));
    const item = document.getElementById(`sys-item-${systemId}`);
    if (item) item.classList.add('active-item');
  };

  (window as any).handleBOMSearch = (value: string) => {
    (window as any)._bomSearchQuery = value;
    (window as any).renderBOMSystemsList();
    
    const clearBtn = document.getElementById('bom-clear-btn');
    if (clearBtn) {
      clearBtn.style.display = value ? 'block' : 'none';
    }
  };

  (window as any).clearBOMSearch = () => {
    (window as any)._bomSearchQuery = '';
    const input = document.getElementById('bom-search-input') as HTMLInputElement;
    if (input) input.value = '';
    const clearBtn = document.getElementById('bom-clear-btn');
    if (clearBtn) clearBtn.style.display = 'none';
    (window as any).renderBOMSystemsList();
  };

  (window as any).selectBOMSearchResult = (model: string, category: string, systemId: string, sapNo: string) => {
    (window as any)._selectedModel = model;
    (window as any)._selectedCategory = category;
    (window as any)._selectedSystemId = systemId;
    (window as any)._highlightBOMSap = sapNo;
    (window as any)._bomSearchQuery = '';
    (window as any).render();
  };

  (window as any).renderBOMSystemsList = () => {
    const container = document.getElementById('bom-systems-container');
    if (!container) return;

    const query = ((window as any)._bomSearchQuery || '').trim().toLowerCase();

    if (query) {
      const results: any[] = [];

      for (const [model, categories] of Object.entries(turbineBOMData)) {
        for (const [category, systems] of Object.entries(categories as any)) {
          for (const sys of (systems as any[])) {
            if (sys.parts) {
              for (const part of sys.parts) {
                const sapNoStr = String(part.sapNo || '').toLowerCase();
                const altSapStr = String(part.alternativeSap || '').toLowerCase();
                const nameStr = String(part.name || '').toLowerCase();
                const descStr = String(part.desc || '').toLowerCase();

                if (sapNoStr.includes(query) || altSapStr.includes(query) || nameStr.includes(query) || descStr.includes(query)) {
                  results.push({
                    model,
                    category,
                    systemId: sys.id,
                    systemName: sys.name,
                    sapNo: part.sapNo,
                    alternativeSap: part.alternativeSap,
                    name: part.name,
                    desc: part.desc
                  });
                }
              }
            }
          }
        }
      }

      if (results.length === 0) {
        container.innerHTML = `
          <div style="text-align: center; color: var(--text-dim); padding: 2rem 1rem;">
            <i class="fa-solid fa-magnifying-glass-minus fa-2x" style="opacity: 0.3; margin-bottom: 0.5rem; color: #ef4444;"></i>
            <p style="font-size: 0.75rem; margin: 0;">Arama kriterine uygun malzeme bulunamadı.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = results.map(res => {
        const isMatchedModel = (window as any)._selectedModel === res.model;
        const isMatchedCat = (window as any)._selectedCategory === res.category;
        const isMatchedSys = (window as any)._selectedSystemId === res.systemId;
        const isActive = isMatchedModel && isMatchedCat && isMatchedSys;
        
        const catLabel = res.category === 'nacelle' ? 'Nacelle' : res.category === 'rotor' ? 'Rotor' : 'Kule';
        const modelLabel = res.model === 'E44' ? 'E44-E48' : res.model === 'E70' ? 'E70-E82' : 'E82/E2-E92';

        return `
          <div class="system-list-item ${isActive ? 'active-item' : ''}" 
               onclick="window.selectBOMSearchResult('${res.model}', '${res.category}', '${res.systemId}', '${res.sapNo}')"
               style="padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: all 0.2s; margin-bottom: 6px;">
            <div style="font-size: 0.8rem; font-weight: bold; color: ${isActive ? '#64ffda' : '#fff'}; display: flex; align-items: center; justify-content: space-between; gap: 8px;">
              <span style="display: flex; align-items: center; gap: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                <i class="fa-solid fa-cube" style="font-size: 0.75rem; color: ${isActive ? '#64ffda' : 'var(--accent-cyan)'}; flex-shrink: 0;"></i>
                ${res.name}
              </span>
              <span style="font-family: monospace; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 800; flex-shrink: 0;">${res.sapNo}</span>
            </div>
            <div style="font-size: 0.65rem; color: var(--text-dim); margin-top: 4px; line-height: 1.3;">
              Şema: <strong>${res.systemName}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.6rem; color: rgba(255,255,255,0.35);">
              <span>Model: ${modelLabel}</span>
              <span style="text-transform: uppercase; background: rgba(255,255,255,0.05); padding: 1px 4px; border-radius: 3px;">${catLabel}</span>
            </div>
          </div>
        `;
      }).join('');

    } else {
      const model = (window as any)._selectedModel;
      const category = (window as any)._selectedCategory;
      const listSystems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];

      container.innerHTML = listSystems.map(sys => {
        const isActive = (window as any)._selectedSystemId === sys.id;
        const hasPreExtracted = sys.parts && sys.parts.length > 0;
        return `
          <div id="sys-item-${sys.id}" 
               class="system-list-item ${isActive ? 'active-item' : ''}" 
               onclick="window.selectBOMSystem('${sys.id}')"
               style="padding: 10px 12px; border-radius: 8px; background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); cursor: pointer; transition: all 0.2s; margin-bottom: 6px;">
            <div style="font-size: 0.8rem; font-weight: bold; color: ${isActive ? '#64ffda' : '#fff'}; display: flex; align-items: center; gap: 6px;">
               <i class="fa-solid fa-file-image" style="font-size: 0.75rem; color: ${isActive ? '#64ffda' : 'var(--text-dim)'};"></i>
               ${sys.name}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 0.65rem; color: var(--text-dim);">
              <span style="font-family: monospace;">${sys.imageName.split(' ')[0]} / ${sys.imageName.slice(-7)}</span>
              ${hasPreExtracted ? `
                <span style="color: var(--accent-green); font-weight: 800; display: flex; align-items: center; gap: 2px;">
                  <span style="width: 5px; height: 5px; background: #00e676; border-radius: 50%;"></span> SAP Eşleşti
                </span>
              ` : `
                <span style="color: var(--text-dim);">Görsel İncele</span>
              `}
            </div>
          </div>
        `;
      }).join('');
    }
  };

  (window as any).zoomBOMImage = (src: string, title: string) => {
    let modal = document.getElementById('bom-zoom-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bom-zoom-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 14, 23, 0.95);
        z-index: 999999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
      <div style="position: absolute; top: 20px; right: 20px; display: flex; gap: 1rem;">
        <button class="btn-cyber" onclick="document.getElementById('bom-zoom-modal').remove()" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: #fff;">KAPAT <i class="fa-solid fa-xmark"></i></button>
      </div>
      <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; font-size: 1.5rem; margin-bottom: 1.5rem; letter-spacing: 1px;">${title}</h3>
      <div style="max-width: 90%; max-height: 80%; overflow: auto; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; background: rgba(0,0,0,0.3); padding: 10px;">
        <img src="${src}" style="max-width: 100%; max-height: 75vh; object-fit: contain;">
      </div>
      <p style="color: var(--text-dim); font-size: 0.8rem; margin-top: 1rem;"><i class="fa-solid fa-magnifying-glass-plus"></i> Mouse tekerleğiyle resmi kaydırabilirsiniz.</p>
    `;
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
  };

  (window as any).copyBOMSap = (sap: string) => {
    navigator.clipboard.writeText(sap).then(() => {
      (window as any).showToast?.('KOPYALANDI', `SAP Kodu (${sap}) panoya kopyalandı.`, 'success');
    }).catch(() => {
      alert(`SAP Kodu: ${sap}`);
    });
  };

  (window as any).openAddBOMPartModal = (systemId: string) => {
    let modal = document.getElementById('bom-add-part-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bom-add-part-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 14, 23, 0.95);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background: #0b0f17; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 12px; padding: 2rem; width: 450px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; margin: 0; font-size: 1.25rem;"><i class="fa-solid fa-plus-circle"></i> SİSTEME YENİ MALZEME EKLE</h3>
          <button onclick="document.getElementById('bom-add-part-modal').remove()" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="add-bom-part-form" onsubmit="event.preventDefault(); window.saveCustomBOMPart('${systemId}')">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">SAP NO *</label>
            <input type="text" id="add-part-sap" required placeholder="Örn: 32484" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">MALZEME ADI / TANIM *</label>
            <input type="text" id="add-part-name" required placeholder="Örn: cover sheet airlead" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">AÇIKLAMA / EK DETAY (OPSİYONEL)</label>
            <input type="text" id="add-part-desc" placeholder="Örn: drawing number: D0051871-6" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">ALTERNATİF SAP NO (OPSİYONEL)</label>
            <input type="text" id="add-part-alt" placeholder="Örn: 77188" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" onclick="document.getElementById('bom-add-part-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.1);">İPTAL</button>
            <button type="submit" class="btn-cyber" style="background: rgba(100, 255, 218, 0.15); color: #64ffda; border-color: #64ffda;">KAYDET</button>
          </div>
        </form>
      </div>
    `;
  };

  (window as any).openAddAlternativeSapModal = (systemId: string, sapNo: string, partName: string) => {
    let modal = document.getElementById('bom-add-part-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bom-add-part-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 14, 23, 0.95);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(modal);
    }

    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    const system = systems.find(s => s.id === systemId);
    const part = system?.parts?.find(p => p.sapNo === sapNo);

    modal.innerHTML = `
      <div style="background: #0b0f17; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 12px; padding: 2rem; width: 450px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; margin: 0; font-size: 1.25rem;"><i class="fa-solid fa-pen-to-square"></i> ALTERNATİF MALZEME EKLE / DÜZENLE</h3>
          <button onclick="document.getElementById('bom-add-part-modal').remove()" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="add-bom-part-form" onsubmit="event.preventDefault(); window.saveCustomBOMPart('${systemId}')">
          <div style="margin-bottom: 1rem; opacity: 0.6;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">ANA SAP NO (Salt Okunur)</label>
            <input type="text" id="add-part-sap" readonly value="${sapNo}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: #aaa; box-sizing: border-box; cursor: not-allowed;">
          </div>
          <div style="margin-bottom: 1rem; opacity: 0.6;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">MALZEME / TANIM (Salt Okunur)</label>
            <input type="text" id="add-part-name" readonly value="${partName}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: #aaa; box-sizing: border-box; cursor: not-allowed;">
          </div>
          <div style="margin-bottom: 1rem; display: none;">
            <input type="text" id="add-part-desc" value="${part?.desc || ''}">
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.75rem; color: var(--accent-amber); margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">ALTERNATİF SAP NO *</label>
            <input type="text" id="add-part-alt" required value="${part?.alternativeSap || ''}" placeholder="Örn: 77188" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" onclick="document.getElementById('bom-add-part-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.1);">İPTAL</button>
            <button type="submit" class="btn-cyber" style="background: rgba(249, 115, 22, 0.15); color: var(--accent-amber); border-color: var(--accent-amber);">KAYDET</button>
          </div>
        </form>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('add-part-alt')?.focus();
    }, 50);
  };

  (window as any).saveCustomBOMPart = (systemId: string) => {
    const sapVal = (document.getElementById('add-part-sap') as HTMLInputElement).value.trim();
    const nameVal = (document.getElementById('add-part-name') as HTMLInputElement).value.trim();
    const descVal = (document.getElementById('add-part-desc') as HTMLInputElement).value.trim();
    const altVal = (document.getElementById('add-part-alt') as HTMLInputElement).value.trim();

    if (!sapVal || !nameVal) return;

    // 1. Remove from deleted parts list in case they re-add a deleted part
    try {
      const deletedPartsRaw = localStorage.getItem('_deletedBOMParts');
      if (deletedPartsRaw) {
        const deletedParts = JSON.parse(deletedPartsRaw);
        if (deletedParts[systemId]) {
          deletedParts[systemId] = deletedParts[systemId].filter((s: string) => s !== sapVal);
          localStorage.setItem('_deletedBOMParts', JSON.stringify(deletedParts));
        }
      }
    } catch (e) {
      console.error(e);
    }

    const customBOMDataRaw = localStorage.getItem('_customBOMParts');
    const customBOMData = customBOMDataRaw ? JSON.parse(customBOMDataRaw) : {};

    customBOMData[systemId] = customBOMData[systemId] || [];
    const existingIdx = customBOMData[systemId].findIndex((p: any) => p.sapNo === sapVal);
    const newPart: any = { sapNo: sapVal, name: nameVal, desc: descVal || 'SAP Part details from drawing' };
    if (altVal) newPart.alternativeSap = altVal;

    if (existingIdx > -1) {
      customBOMData[systemId][existingIdx] = newPart;
    } else {
      customBOMData[systemId].push(newPart);
    }

    localStorage.setItem('_customBOMParts', JSON.stringify(customBOMData));

    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    const system = systems.find(s => s.id === systemId);
    if (system) {
      system.parts = system.parts || [];
      const memIdx = system.parts.findIndex(p => p.sapNo === sapVal);
      if (memIdx > -1) {
        system.parts[memIdx] = newPart;
      } else {
        system.parts.push(newPart);
      }
    }

    document.getElementById('bom-add-part-modal')?.remove();
    (window as any).renderBOMDetailPanel();
    (window as any).showToast?.('BAŞARILI', 'Malzeme listesi güncellendi.', 'success');
  };

  (window as any).deleteBOMPart = (systemId: string, sapNo: string) => {
    if (!confirm('Bu malzemeyi silmek istediğinize emin misiniz?')) return;
    
    // 1. Add to deleted parts list in LocalStorage
    try {
      const deletedPartsRaw = localStorage.getItem('_deletedBOMParts') || '{}';
      const deletedParts = JSON.parse(deletedPartsRaw);
      deletedParts[systemId] = deletedParts[systemId] || [];
      if (!deletedParts[systemId].includes(sapNo)) {
        deletedParts[systemId].push(sapNo);
      }
      localStorage.setItem('_deletedBOMParts', JSON.stringify(deletedParts));
    } catch (e) {
      console.error(e);
    }
    
    // 2. Remove from custom parts in LocalStorage
    try {
      const customBOMDataRaw = localStorage.getItem('_customBOMParts');
      if (customBOMDataRaw) {
        const customBOMData = JSON.parse(customBOMDataRaw);
        if (customBOMData[systemId]) {
          customBOMData[systemId] = customBOMData[systemId].filter((p: any) => String(p.sapNo).trim() !== String(sapNo).trim());
          localStorage.setItem('_customBOMParts', JSON.stringify(customBOMData));
        }
      }
    } catch (e) {
      console.error(e);
    }
    
    // 3. Remove from active in-memory turbineBOMData
    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    const system = systems.find(s => s.id === systemId);
    if (system && system.parts) {
      system.parts = system.parts.filter(p => String(p.sapNo).trim() !== String(sapNo).trim());
    }
    
    (window as any).renderBOMDetailPanel();
    (window as any).showToast?.('BAŞARILI', 'Malzeme başarıyla silindi.', 'success');
  };

  (window as any).saveDirectBOMPart = (systemId: string) => {
    const sapVal = (document.getElementById('direct-part-sap') as HTMLInputElement).value.trim();
    const nameVal = (document.getElementById('direct-part-name') as HTMLInputElement).value.trim();
    const descVal = (document.getElementById('direct-part-desc') as HTMLInputElement).value.trim();
    const altVal = (document.getElementById('direct-part-alt') as HTMLInputElement).value.trim();

    if (!sapVal || !nameVal) return;

    // 1. Remove from deleted parts list in case they re-add a deleted part
    try {
      const deletedPartsRaw = localStorage.getItem('_deletedBOMParts');
      if (deletedPartsRaw) {
        const deletedParts = JSON.parse(deletedPartsRaw);
        if (deletedParts[systemId]) {
          deletedParts[systemId] = deletedParts[systemId].filter((s: string) => s !== sapVal);
          localStorage.setItem('_deletedBOMParts', JSON.stringify(deletedParts));
        }
      }
    } catch (e) {
      console.error(e);
    }

    const customBOMDataRaw = localStorage.getItem('_customBOMParts');
    const customBOMData = customBOMDataRaw ? JSON.parse(customBOMDataRaw) : {};

    customBOMData[systemId] = customBOMData[systemId] || [];
    const existingIdx = customBOMData[systemId].findIndex((p: any) => p.sapNo === sapVal);
    const newPart: any = { sapNo: sapVal, name: nameVal, desc: descVal || 'SAP Part details from drawing' };
    if (altVal) newPart.alternativeSap = altVal;

    if (existingIdx > -1) {
      customBOMData[systemId][existingIdx] = newPart;
    } else {
      customBOMData[systemId].push(newPart);
    }

    localStorage.setItem('_customBOMParts', JSON.stringify(customBOMData));

    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    const system = systems.find(s => s.id === systemId);
    if (system) {
      system.parts = system.parts || [];
      const memIdx = system.parts.findIndex(p => p.sapNo === sapVal);
      if (memIdx > -1) {
        system.parts[memIdx] = newPart;
      } else {
        system.parts.push(newPart);
      }
    }

    // Reset direct inputs
    (document.getElementById('direct-part-sap') as HTMLInputElement).value = '';
    (document.getElementById('direct-part-name') as HTMLInputElement).value = '';
    (document.getElementById('direct-part-desc') as HTMLInputElement).value = '';
    (document.getElementById('direct-part-alt') as HTMLInputElement).value = '';

    (window as any).renderBOMDetailPanel();
    (window as any).showToast?.('BAŞARILI', 'Yeni malzeme başarıyla kaydedildi.', 'success');
  };

  (window as any).openEditBOMPartModal = (systemId: string, sapNo: string) => {
    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    const system = systems.find(s => s.id === systemId);
    const part = system?.parts?.find(p => p.sapNo === sapNo);

    if (!part) return;

    let modal = document.getElementById('bom-add-part-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'bom-add-part-modal';
      modal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(10, 14, 23, 0.95);
        z-index: 999999;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
      `;
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background: #0b0f17; border: 1px solid rgba(100, 255, 218, 0.3); border-radius: 12px; padding: 2rem; width: 450px; max-width: 90%; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; margin: 0; font-size: 1.25rem;"><i class="fa-solid fa-pen-to-square"></i> MALZEME DÜZENLE</h3>
          <button onclick="document.getElementById('bom-add-part-modal').remove()" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <form id="add-bom-part-form" onsubmit="event.preventDefault(); window.saveCustomBOMPart('${systemId}')">
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">SAP NO (Salt Okunur)</label>
            <input type="text" id="add-part-sap" readonly value="${part.sapNo}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; color: #aaa; box-sizing: border-box; cursor: not-allowed;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">MALZEME ADI / TANIM *</label>
            <input type="text" id="add-part-name" required value="${part.name}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">AÇIKLAMA / EK DETAY (OPSİYONEL)</label>
            <input type="text" id="add-part-desc" value="${part.desc || ''}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; font-size: 0.75rem; color: #64ffda; margin-bottom: 4px; font-weight: bold; text-transform: uppercase;">ALTERNATİF SAP NO (OPSİYONEL)</label>
            <input type="text" id="add-part-alt" value="${part.alternativeSap || ''}" style="width: 100%; padding: 8px 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #fff; box-sizing: border-box;">
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="button" onclick="document.getElementById('bom-add-part-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #fff; border-color: rgba(255,255,255,0.1);">İPTAL</button>
            <button type="submit" class="btn-cyber" style="background: rgba(100, 255, 218, 0.15); color: #64ffda; border-color: #64ffda;">KAYDET</button>
          </div>
        </form>
      </div>
    `;
  };

  (window as any).showBOMStockDrawer = (sapNo: string, partName: string) => {
    let drawer = document.getElementById('bom-stock-drawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.id = 'bom-stock-drawer';
      drawer.style.cssText = `
        position: fixed;
        top: 0;
        right: -360px;
        width: 350px;
        height: 100vh;
        background: rgba(10, 14, 23, 0.98);
        border-left: 1px solid rgba(100, 255, 218, 0.25);
        box-shadow: -10px 0 30px rgba(0, 0, 0, 0.8);
        z-index: 999999;
        backdrop-filter: blur(16px);
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        box-sizing: border-box;
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        color: #fff;
      `;
      document.body.appendChild(drawer);
    }
    
    const localInventory = (window as any)._allInventory || [];
    const matches = localInventory.filter((inv: any) => String(inv.sapNo || '').trim() === String(sapNo).trim());
    const totalStock = matches.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
    
    let whHtml = '';
    if (matches.length > 0) {
      whHtml = matches.map((m: any) => `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 8px;">
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.85rem; color: #fff;">${m.warehouseName}</div>
          <div style="font-family: monospace; font-weight: 800; font-size: 0.9rem; color: #64ffda;">${m.quantity} Adet</div>
        </div>
      `).join('');
    } else {
      whHtml = `
        <div style="text-align: center; color: var(--text-dim); padding: 3rem 1rem;">
          <i class="fa-solid fa-circle-exclamation fa-2x" style="color: #ef4444; margin-bottom: 0.5rem; opacity: 0.5;"></i>
          <p style="font-size: 0.8rem; margin: 0;">Hiçbir ambarda stok bulunmuyor.</p>
        </div>
      `;
    }
    
    drawer.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
        <div style="display: flex; align-items: center; gap: 8px; color: #64ffda;">
          <i class="fa-solid fa-warehouse" style="font-size: 1.25rem;"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; margin: 0; font-weight: 800; letter-spacing: 0.5px;">AMBAR STOK DETAYI</h3>
        </div>
        <button onclick="document.getElementById('bom-stock-drawer').style.right = '-360px'" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-dim)'">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      
      <div style="margin-bottom: 1.5rem;">
        <div style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">SAP Kodu: ${sapNo}</div>
        <div style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 1rem; color: #fff; line-height: 1.3;">${partName}</div>
      </div>
      
      <div style="font-size: 0.72rem; color: var(--text-dim); margin-bottom: 0.8rem; font-weight: bold; text-transform: uppercase;">Depo Dağılımı (Toplam: ${totalStock} Adet)</div>
      
      <div style="flex: 1; overflow-y: auto; padding-right: 2px;">
        ${whHtml}
      </div>
      
      <div style="margin-top: auto; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.05); font-size: 0.65rem; color: var(--text-dim); display: flex; align-items: center; gap: 4px;">
        <i class="fa-solid fa-circle-info" style="color: var(--accent-cyan);"></i>
        <span>Stok sayıları gerçek zamanlı güncellenmektedir.</span>
      </div>
    `;
    
    setTimeout(() => {
      drawer.style.right = '0px';
    }, 10);
  };

  (window as any)._showDrawingState = (window as any)._showDrawingState || {};
  (window as any).toggleBOMDrawing = (sysId: string) => {
    (window as any)._showDrawingState[sysId] = !(window as any)._showDrawingState[sysId];
    (window as any).renderBOMDetailPanel();
  };

  // Renders the details on the right panel dynamically
  (window as any).renderBOMDetailPanel = () => {
    const panel = document.getElementById('bom-detail-panel');
    if (!panel) return;

    const model = (window as any)._selectedModel;
    const category = (window as any)._selectedCategory;
    const systemId = (window as any)._selectedSystemId;
    const systems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
    
    const system = systems.find(s => s.id === systemId) || (systems.length > 0 ? systems[0] : null);
    
    if (!system) {
      panel.innerHTML = `
        <div style="text-align: center; color: var(--text-dim); margin-top: 8rem;">
          <i class="fa-solid fa-cubes fa-3x" style="margin-bottom: 1rem; opacity: 0.3;"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif;">Sistem Bulunamadı</h3>
          <p style="font-size: 0.85rem;">Seçilen kategoriye ait bir sistem kaydı bulunamadı.</p>
        </div>
      `;
      return;
    }

    // Determine correct folder folder structure
    let folderPath = '';
    if (model === 'E92') {
      const catFolder = category === 'nacelle' ? 'NACELLE' : category === 'rotor' ? 'ROTOR HUB' : 'TOWER';
      folderPath = `/public/malzeme_listesi/E92/${catFolder}/${system.imageName}`;
    } else if (model === 'E70') {
      const catFolder = category === 'nacelle' ? 'nacelle' : category === 'rotor' ? 'rotor-hub' : 'tower';
      folderPath = `/public/malzeme_listesi/e70/${catFolder}/${system.imageName}`;
    } else {
      const catFolder = category === 'nacelle' ? 'nacelle and stator' : category === 'rotor' ? 'rotor and hub' : 'tower';
      folderPath = `/public/malzeme_listesi/E44/${catFolder}/${system.imageName}`;
    }
    
    // Replace public prefix for browser display
    const browserImgPath = folderPath.replace('/public', '');

    const hasParts = system.parts && system.parts.length > 0;
    const localInventory = (window as any)._allInventory || [];

    let partsHtml = '';
    if (hasParts && system.parts) {
      partsHtml = `
        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
            <h4 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-boxes-stacked"></i> EŞLEŞEN SAP STOK DETAYLARI
            </h4>
          </div>
          <div style="overflow-x: auto;">
            <table class="cyber-table" style="width: 100%; font-size: 0.75rem; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); text-align: left; color: var(--text-dim);">
                  <th style="padding: 6px;">SAP NO</th>
                  <th style="padding: 6px;">MALZEME / TANIM</th>
                  <th style="padding: 6px; text-align: center;">ALTERNATİF SAP</th>
                  <th style="padding: 6px; text-align: center;">STOK</th>
                  <th style="padding: 6px; text-align: center;">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                ${system.parts.map(p => {
                  // Find matching inventory across warehouses
                  const matches = localInventory.filter((inv: any) => String(inv.sapNo || '').trim() === String(p.sapNo).trim());
                  const totalStock = matches.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                  
                  let stockBadge = `<span style="color: #ef4444; font-weight: 800;">Stokta Yok</span>`;
                  let stockDetails = 'Hiçbir ambarda stok bulunmuyor.';
                  
                  if (totalStock > 0) {
                    stockBadge = `<span style="color: #64ffda; font-weight: 800;">${totalStock} Adet</span>`;
                    stockDetails = matches.map((m: any) => `${m.warehouseName}: ${m.quantity} Adet`).join(' | ');
                  }

                  // Look up alternative SAP stock details
                  let altStockHtml = `<span style="color: var(--text-dim); opacity: 0.4;">-</span>`;
                  let altClickAttr = '';
                  if (p.alternativeSap) {
                    const altMatches = localInventory.filter((inv: any) => String(inv.sapNo || '').trim() === String(p.alternativeSap).trim());
                    const altTotalStock = altMatches.reduce((sum: number, item: any) => sum + Number(item.quantity || 0), 0);
                    const altStockDetails = altTotalStock > 0 
                      ? altMatches.map((m: any) => `${m.warehouseName}: ${m.quantity} Adet`).join(' | ') 
                      : 'Stokta Yok';
                    
                    altClickAttr = `onclick="window.copyBOMSap('${p.alternativeSap}')" style="padding: 8px 6px; text-align: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(100, 255, 218, 0.04)'" onmouseout="this.style.background='none'" title="Alternatif SAP Kopyala (Tıklayın)"`;
                    
                    altStockHtml = `
                      <div style="font-family: monospace; font-weight: 700; color: var(--accent-amber);">
                        ${p.alternativeSap}
                      </div>
                      <div style="font-size: 0.6rem; color: ${altTotalStock > 0 ? '#64ffda' : 'var(--text-dim)'}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;" title="${altStockDetails}">
                        Stok: ${altTotalStock > 0 ? `${altTotalStock} Adet` : 'Yok'}
                      </div>
                    `;
                  } else {
                    altClickAttr = `onclick="window.openAddAlternativeSapModal('${system.id}', '${p.sapNo}', '${p.name.replace(/'/g, "\\'")}')" style="padding: 8px 6px; text-align: center; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='rgba(249, 115, 22, 0.04)'" onmouseout="this.style.background='none'" title="Alternatif SAP Ekle/Düzenle"`;
                    altStockHtml = `<span style="color: var(--text-dim); opacity: 0.5; font-size: 0.7rem; border: 1px dashed rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px;"><i class="fa-solid fa-plus" style="font-size:0.6rem;"></i> Ekle</span>`;
                  }

                  const isHighlighted = (window as any)._highlightBOMSap === p.sapNo;
                  if (isHighlighted) {
                    setTimeout(() => { (window as any)._highlightBOMSap = ''; }, 3000);
                  }

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); ${isHighlighted ? 'background: rgba(100, 255, 218, 0.08); border-left: 3px solid #64ffda;' : ''}" title="${stockDetails}">
                      <td onclick="window.copyBOMSap('${p.sapNo}')" title="Kopyalamak için tıklayın" style="padding: 8px 6px; font-family: monospace; font-weight: 700; color: var(--accent-cyan); cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#64ffda'" onmouseout="this.style.color='var(--accent-cyan)'">${p.sapNo}</td>
                      <td style="padding: 8px 6px;">
                        <div style="font-weight: bold; color: #fff;">${p.name}</div>
                        <div style="color: var(--text-dim); font-size: 0.65rem;">${p.desc}</div>
                      </td>
                      <td ${altClickAttr}>
                        ${altStockHtml}
                      </td>
                      <td onclick="window.showBOMStockDrawer('${p.sapNo}', '${p.name.replace(/'/g, "\\'")}')"
                          style="padding: 8px 6px; text-align: center; cursor: pointer; transition: background 0.2s;"
                          onmouseover="this.style.background='rgba(100, 255, 218, 0.04)'"
                          onmouseout="this.style.background='none'">
                        <div>${stockBadge}</div>
                        <div style="font-size: 0.6rem; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${stockDetails}</div>
                      </td>
                      <td style="padding: 8px 6px; text-align: center; white-space: nowrap;">
                        <button class="action-icon-btn" onclick="window.openEditBOMPartModal('${system.id}', '${p.sapNo}')" title="Düzenle" style="padding: 4px 6px; background: none; border: none; color: #64ffda; cursor: pointer; font-size: 0.85rem; transition: transform 0.1s;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='none'">
                          <i class="fa-solid fa-pen"></i>
                        </button>
                        <button class="action-icon-btn" onclick="window.deleteBOMPart('${system.id}', '${p.sapNo}')" title="Sil" style="padding: 4px 6px; background: none; border: none; color: #ef4444; cursor: pointer; font-size: 0.85rem; transition: transform 0.1s; margin-left: 6px;" onmouseover="this.style.transform='scale(1.15)'" onmouseout="this.style.transform='none'">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } else {
      partsHtml = `
        <div style="margin-top: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem;">
            <h4 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-boxes-stacked"></i> EŞLEŞEN SAP STOK DETAYLARI
            </h4>
          </div>
          <div style="padding: 2rem; border-radius: 8px; background: rgba(255,255,255,0.01); border: 1px dashed rgba(255,255,255,0.08); text-align: center; color: var(--text-dim);">
            <i class="fa-solid fa-folder-open fa-2x" style="opacity: 0.3; margin-bottom: 0.5rem;"></i>
            <p style="font-size: 0.75rem; margin: 0 0 0.8rem 0;">Bu şema için henüz tanımlanmış malzeme listesi bulunmuyor.</p>
          </div>
        </div>
      `;
    }

    // Direct Inline Add Form
    const directAddFormHtml = `
      <div style="margin-top: 2rem; padding: 1.25rem; background: rgba(100, 255, 218, 0.02); border: 1px solid rgba(100, 255, 218, 0.15); border-radius: 8px;">
        <h4 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; font-size: 0.95rem; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-plus-circle"></i> SAYFA ÜZERİNDEN HIZLI SAP EKLE
        </h4>
        <form id="direct-add-part-form" onsubmit="event.preventDefault(); window.saveDirectBOMPart('${system.id}')" style="display: flex; flex-direction: column; gap: 10px;">
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 0.65rem; color: #64ffda; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">SAP NO *</label>
              <input type="text" id="direct-part-sap" required placeholder="Örn: 32484" style="width: 100%; padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 0.75rem; box-sizing: border-box;">
            </div>
            <div>
              <label style="display: block; font-size: 0.65rem; color: #64ffda; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">Malzeme Tanımı *</label>
              <input type="text" id="direct-part-name" required placeholder="Örn: cover sheet airlead" style="width: 100%; padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 0.75rem; box-sizing: border-box;">
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label style="display: block; font-size: 0.65rem; color: #64ffda; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">Açıklama / Ek Detay</label>
              <input type="text" id="direct-part-desc" placeholder="Örn: çizim no vb." style="width: 100%; padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 0.75rem; box-sizing: border-box;">
            </div>
            <div>
              <label style="display: block; font-size: 0.65rem; color: #64ffda; margin-bottom: 2px; font-weight: bold; text-transform: uppercase;">Alternatif SAP NO</label>
              <input type="text" id="direct-part-alt" placeholder="Örn: 77188" style="width: 100%; padding: 6px 10px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff; font-size: 0.75rem; box-sizing: border-box;">
            </div>
          </div>
          <div style="display: flex; justify-content: flex-end; margin-top: 5px;">
            <button type="submit" class="btn-cyber" style="padding: 6px 14px; font-size: 0.7rem; background: rgba(100, 255, 218, 0.15); border-color: #64ffda; color: #64ffda; cursor: pointer; font-weight: bold;">
              <i class="fa-solid fa-check"></i> MALZEMEYİ KAYDET
            </button>
          </div>
        </form>
      </div>
    `;

    const showDrawing = (window as any)._showDrawingState[system.id] !== undefined
      ? (window as any)._showDrawingState[system.id]
      : !hasParts;

    panel.innerHTML = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div>
          <h3 style="font-family: 'Rajdhani', sans-serif; color: #fff; margin: 0; font-size: 1.1rem; display: flex; align-items: center; justify-content: space-between;">
            <span>${system.name}</span>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn-cyber" onclick="window.toggleBOMDrawing('${system.id}')" style="padding: 4px 10px; font-size: 0.65rem; border-radius: 4px; font-family: 'Rajdhani'; font-weight: 800; text-transform: uppercase; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); color: var(--accent-cyan); cursor: pointer;">
                ${showDrawing ? '<i class="fa-solid fa-eye-slash"></i> Şemayı Gizle' : '<i class="fa-solid fa-eye"></i> Şemayı Göster'}
              </button>
              <span style="font-size: 0.65rem; padding: 4px 8px; background: rgba(255,255,255,0.05); border-radius: 4px; color: var(--text-dim); text-transform: uppercase;">${category}</span>
            </div>
          </h3>
        </div>

        <!-- Schematic Drawing Preview with Fullscreen trigger (Collapsible) -->
        ${showDrawing ? `
        <div style="position: relative; border-radius: 12px; overflow: hidden; border: 1px solid rgba(255,255,255,0.05); background: #0b0f17; min-height: 200px; display: flex; align-items: center; justify-content: center; cursor: pointer;"
             onclick="window.zoomBOMImage('${browserImgPath}', '${system.name} Şeması')">
          <img src="${browserImgPath}" style="width: 100%; height: auto; max-height: 250px; object-fit: contain; padding: 6px;">
          <div class="drawing-overlay" style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,242,254,0.15); color: var(--accent-cyan); padding: 4px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; border: 1px solid rgba(0,242,254,0.3); display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-magnifying-glass-plus"></i> BÜYÜT
          </div>
        </div>
        ` : ''}

        <!-- Parts list / Real-time inventory matching -->
        ${partsHtml}

        <!-- Direct inline add form -->
        ${directAddFormHtml}
      </div>
    `;
  };

  // If no default system is selected, pick the first one
  const model = (window as any)._selectedModel;
  const category = (window as any)._selectedCategory;
  const listSystems = turbineBOMData[model]?.[category as 'nacelle' | 'rotor' | 'tower'] || [];
  if (!(window as any)._selectedSystemId && listSystems.length > 0) {
    (window as any)._selectedSystemId = listSystems[0].id;
  }

  // Pre-trigger detail render after main layout is placed in DOM
  setTimeout(() => {
    (window as any).renderBOMDetailPanel();
    (window as any).renderBOMSystemsList();
  }, 100);

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-cube"></i> Türbin Dijital İkizi & Görsel BOM
          </h2>
          <p style="color: var(--text-dim); margin: 3px 0 0 0; font-size: 0.75rem;">Teknik şemalar ve ambar gerçek zamanlı stok entegrasyonu.</p>
        </div>

        <!-- Model Select Buttons -->
        <div style="display: flex; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
          ${[
            { key: 'E44', label: 'ENERCON E44-E48' },
            { key: 'E70', label: 'ENERCON E70-E82' },
            { key: 'E92', label: 'ENERCON E82/E2-E92' }
          ].map(m => `
            <button class="tab-btn ${model === m.key ? 'active' : ''}" 
                    onclick="window.selectTurbineModel('${m.key}')" 
                    style="padding: 6px 16px; font-size: 0.75rem; border-radius: 6px; font-family: 'Rajdhani'; font-weight: 800; letter-spacing: 0.5px; border: none; cursor: pointer; transition: all 0.2s;">
              ${m.label}
            </button>
          `).join('')}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 360px 300px 1fr; gap: 1.25rem; height: calc(100vh - 200px); min-height: 600px;">
        
        <!-- Column 1: SVG 3D-Like Hotspots -->
        <div class="glass-panel" style="position: relative; background: #000000; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(100,255,218,0.08);">
          <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'Rajdhani'; font-weight: 800; font-size: 0.8rem; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px;">
            <i class="fa-solid fa-compass"></i> BÖLGE SEÇİMİ (HOTSPOTS)
          </div>
          
          <div style="flex: 1; display: flex; align-items: center; justify-content: center; padding: 1rem; position: relative;">
            <svg viewBox="0 0 400 650" style="width: 100%; height: 95%; max-height: 550px; background: #000000; border-radius: 8px;">
              <defs>
                <filter id="svgGlow" x="-10%" y="-10%" width="120%" height="120%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>
 
              <!-- Background Turbine Image -->
              <image href="/turbine_model.png" x="10" y="10" width="380" height="630" preserveAspectRatio="xMidYMid meet" />
 
              <!-- SVG Interactive Elements -->
              <!-- Tower Group -->
              <g id="hotspot-tower" class="svg-hotspot ${category === 'tower' ? 'active' : ''}" onclick="window.selectBOMCategory('tower')" style="cursor: pointer;">
                <polygon points="214,240 228,240 257,616 185,616" fill="rgba(0, 230, 118, 0.0)" stroke="rgba(0, 230, 118, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <circle cx="221" cy="460" r="24" fill="rgba(10, 14, 23, 0.85)" stroke="#00e676" stroke-width="1.5" />
                <text x="221" y="464" fill="#00e676" font-size="9" font-family="Rajdhani" font-weight="900" text-anchor="middle" style="pointer-events: none;">KULE</text>
              </g>
 
              <!-- Nacelle Group -->
              <g id="hotspot-nacelle" class="svg-hotspot ${category === 'nacelle' ? 'active' : ''}" onclick="window.selectBOMCategory('nacelle')" style="cursor: pointer;">
                <ellipse cx="221" cy="230" rx="22" ry="16" fill="rgba(0, 242, 254, 0.0)" stroke="rgba(0, 242, 254, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <line x1="221" y1="230" x2="280" y2="250" stroke="#00f2fe" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />
                <circle cx="280" cy="250" r="24" fill="rgba(10, 14, 23, 0.85)" stroke="#00f2fe" stroke-width="1.5" />
                <text x="280" y="254" fill="#00f2fe" font-size="8" font-family="Rajdhani" font-weight="900" text-anchor="middle" style="pointer-events: none;">NACELLE</text>
              </g>
 
              <!-- Rotor / Hub Group -->
              <g id="hotspot-rotor" class="svg-hotspot ${category === 'rotor' ? 'active' : ''}" onclick="window.selectBOMCategory('rotor')" style="cursor: pointer;">
                <ellipse cx="215" cy="231" rx="16" ry="18" fill="rgba(249, 115, 22, 0.0)" stroke="rgba(249, 115, 22, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <!-- Three wind blade polygons for interactive hover and click -->
                <polygon points="211,231 228,21 232,21 219,231" fill="rgba(249, 115, 22, 0.0)" stroke="rgba(249, 115, 22, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <polygon points="215,228 105,238 105,244 215,238" fill="rgba(249, 115, 22, 0.0)" stroke="rgba(249, 115, 22, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <polygon points="211,230 252,317 256,322 218,236" fill="rgba(249, 115, 22, 0.0)" stroke="rgba(249, 115, 22, 0.2)" stroke-width="1.5" stroke-dasharray="3,3" />
                <line x1="215" y1="231" x2="100" y2="180" stroke="#f97316" stroke-width="1" stroke-dasharray="2,2" opacity="0.6" />
                <circle cx="100" cy="180" r="24" fill="rgba(10, 14, 23, 0.85)" stroke="#f97316" stroke-width="1.5" />
                <text x="100" y="184" fill="#f97316" font-size="8" font-family="Rajdhani" font-weight="900" text-anchor="middle" style="pointer-events: none;">ROTOR</text>
              </g>
            </svg>
          </div>
          
          <div style="padding: 0.8rem; background: rgba(0,0,0,0.2); border-top: 1px solid rgba(255,255,255,0.03); font-size: 0.7rem; color: var(--text-dim); display: flex; gap: 4px; align-items: center;">
            <i class="fa-solid fa-hand-pointer" style="color: var(--accent-cyan);"></i>
            <span>Etkileşimli bölgelere tıklayarak kısımları filtreleyebilirsiniz.</span>
          </div>
        </div>

        <!-- Column 2: System / Blueprint List -->
        <div class="glass-panel" style="background: #0a0e17; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden; border: 1px solid rgba(255,255,255,0.03);">
          <div style="padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); font-family: 'Rajdhani'; font-weight: 800; font-size: 0.8rem; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-list-ul"></i> SİSTEMLER VE ŞEMALAR</span>
          </div>
          
          <!-- SAP / Material Search Bar -->
          <div style="padding: 0.6rem 0.8rem; border-bottom: 1px solid rgba(255,255,255,0.03); background: rgba(0,0,0,0.15);">
            <div style="position: relative; display: flex; align-items: center;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; color: rgba(255,255,255,0.3); font-size: 0.75rem;"></i>
              <input type="text" id="bom-search-input" placeholder="SAP No veya Malzeme Ara..." oninput="window.handleBOMSearch(this.value)" style="width: 100%; padding: 6px 10px 6px 28px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; color: #fff; font-size: 0.75rem; outline: none; box-sizing: border-box;" value="${(window as any)._bomSearchQuery || ''}">
              <button id="bom-clear-btn" onclick="window.clearBOMSearch()" style="position: absolute; right: 8px; background: none; border: none; color: rgba(255,255,255,0.4); cursor: pointer; font-size: 0.8rem; padding: 0; display: ${(window as any)._bomSearchQuery ? 'block' : 'none'};">
                <i class="fa-solid fa-circle-xmark"></i>
              </button>
            </div>
          </div>
          
          <div id="bom-systems-container" style="flex: 1; overflow-y: auto; padding: 0.5rem; display: flex; flex-direction: column; gap: 6px;">
            <!-- Systems or search results will be rendered here dynamically -->
          </div>
        </div>

        <!-- Column 3: Active Drawing and Parts detail -->
        <div id="bom-detail-panel" class="glass-panel" style="background: #0a0e17; border-radius: 12px; padding: 1.25rem; border: 1px solid rgba(255,255,255,0.03); overflow-y: auto;">
          <!-- Detail panel dynamically populated via renderBOMDetailPanel -->
        </div>

      </div>
      
      <style>
        .svg-hotspot ellipse, .svg-hotspot path, .svg-hotspot rect, .svg-hotspot polygon {
          transition: all 0.3s ease;
        }
        
        /* Specific colors on hover and active */
        #hotspot-tower:hover polygon, #hotspot-tower.active polygon {
          fill: rgba(0, 230, 118, 0.08) !important;
          stroke: #00e676 !important;
          stroke-width: 2.5px;
        }
        #hotspot-nacelle:hover ellipse, #hotspot-nacelle.active ellipse {
          fill: rgba(0, 242, 254, 0.08) !important;
          stroke: #00f2fe !important;
          stroke-width: 2.5px;
        }
        #hotspot-rotor:hover ellipse, #hotspot-rotor:hover polygon, #hotspot-rotor.active ellipse, #hotspot-rotor.active polygon {
          fill: rgba(249, 115, 22, 0.08) !important;
          stroke: #f97316 !important;
          stroke-width: 2.5px;
        }
        
        .svg-hotspot:hover circle {
          transform: scale(1.08);
          transform-origin: center;
        }
        
        .system-list-item:hover {
          background: rgba(100, 255, 218, 0.04) !important;
          border-color: rgba(100, 255, 218, 0.15) !important;
        }
        .system-list-item.active-item {
          background: rgba(100, 255, 218, 0.06) !important;
          border-color: rgba(100, 255, 218, 0.25) !important;
        }
      </style>
    </div>
  `;
};
