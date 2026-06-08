import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';

export const VisualBOMPage = async () => {
  // We'll fetch all inventory across all warehouses for the search
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

  // Attach data to window for modal interactions
  (window as any)._allInventory = allInventory;

  const componentGroups = {
    'rotor': ['rotor', 'kanat', 'blade', 'hub', 'pitch', 'slip ring', 'burun'],
    'nacelle': ['nacelle', 'makine', 'yaw', 'rüzgar gülü', 'anemometre', 'sensör'],
    'gearbox': ['dişli', 'gearbox', 'şanzıman', 'yağ', 'pompa'],
    'generator': ['jeneratör', 'generator', 'stator', 'fırça', 'soğutma'],
    'tower': ['kule', 'tower', 'kablo', 'asansör', 'platform', 'merdiven', 'trafo']
  };
  (window as any)._componentGroups = componentGroups;

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-wind" style="margin-right: 0.5rem;"></i> Etkileşimli Türbin Haritası (Visual BOM)
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Görsel üzerinden bileşen seçerek envanter durumu sorgulayın.</p>
        </div>
      </div>

      <div style="display: flex; gap: 2rem; height: calc(100vh - 250px);">
        <!-- SVG Container -->
        <div class="glass-panel" style="flex: 1; position: relative; background: #0f172a; border-radius: 16px; overflow: hidden; display: flex; align-items: center; justify-content: center; border: 1px solid rgba(100,255,218,0.1);">
          
          <svg viewBox="0 0 800 1000" style="width: 100%; height: 100%; max-height: 800px;">
            <!-- Definitions for gradients and glows -->
            <defs>
              <linearGradient id="gradTower" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" style="stop-color:#334155;stop-opacity:1" />
                <stop offset="50%" style="stop-color:#64748b;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
              </linearGradient>
              <linearGradient id="gradNacelle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#475569;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#0f172a;stop-opacity:1" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            <!-- Tower (Kule) -->
            <g class="interactive-part" onclick="window.openBOMModal('tower')" style="cursor: pointer;">
              <path d="M 370 1000 L 430 1000 L 415 350 L 385 350 Z" fill="url(#gradTower)" stroke="#0ea5e9" stroke-width="2"/>
              <text x="400" y="700" fill="#64ffda" font-size="20" font-family="Rajdhani" font-weight="bold" text-anchor="middle" transform="rotate(-90 400 700)" style="pointer-events: none;">KULE (TOWER)</text>
              <circle cx="400" cy="700" r="40" fill="transparent" class="hover-glow" />
            </g>

            <!-- Nacelle -->
            <g class="interactive-part" onclick="window.openBOMModal('nacelle')" style="cursor: pointer;">
              <path d="M 350 350 Q 350 300 400 300 L 520 300 Q 550 300 550 330 L 550 370 Q 550 400 520 400 L 380 400 Z" fill="url(#gradNacelle)" stroke="#64ffda" stroke-width="2"/>
              <text x="450" y="355" fill="#fff" font-size="16" font-family="Rajdhani" font-weight="bold" text-anchor="middle" style="pointer-events: none;">NACELLE</text>
            </g>

            <!-- Gearbox -->
            <g class="interactive-part" onclick="window.openBOMModal('gearbox')" style="cursor: pointer;">
              <rect x="410" y="330" width="50" height="40" rx="5" fill="#ca8a04" stroke="#fef08a" stroke-width="1.5"/>
              <text x="435" y="355" fill="#000" font-size="10" font-family="Rajdhani" font-weight="bold" text-anchor="middle" style="pointer-events: none;">DİŞLİ</text>
            </g>

            <!-- Generator -->
            <g class="interactive-part" onclick="window.openBOMModal('generator')" style="cursor: pointer;">
              <rect x="470" y="325" width="60" height="50" rx="8" fill="#e11d48" stroke="#fecdd3" stroke-width="1.5"/>
              <text x="500" y="355" fill="#fff" font-size="10" font-family="Rajdhani" font-weight="bold" text-anchor="middle" style="pointer-events: none;">JENERATÖR</text>
            </g>

            <!-- Rotor & Hub -->
            <g class="interactive-part" onclick="window.openBOMModal('rotor')" style="cursor: pointer;">
              <ellipse cx="340" cy="350" rx="20" ry="40" fill="#94a3b8" stroke="#38bdf8" stroke-width="2"/>
              <path d="M 320 350 L 340 310 L 340 390 Z" fill="#cbd5e1" stroke="#38bdf8" stroke-width="2"/>
              
              <!-- Blades -->
              <path d="M 330 310 Q 350 150 320 50 Q 300 150 330 310" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
              <path d="M 330 390 Q 350 550 320 650 Q 300 550 330 390" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
              <path d="M 320 350 Q 150 330 50 360 Q 150 370 320 350" fill="#f8fafc" stroke="#e2e8f0" stroke-width="2"/>
              
              <text x="250" y="355" fill="#64ffda" font-size="18" font-family="Rajdhani" font-weight="bold" text-anchor="middle" style="pointer-events: none; text-shadow: 0 0 10px #000;">ROTOR / KANAT</text>
            </g>
          </svg>

          <!-- Hover Overlay Info -->
          <div style="position: absolute; bottom: 20px; left: 20px; background: rgba(0,0,0,0.7); padding: 1rem; border-radius: 8px; border-left: 4px solid #64ffda;">
            <p style="color: #fff; font-size: 0.85rem; margin: 0;"><strong>Kullanım:</strong> Envanterde arama yapmak için türbin üzerindeki parçalara tıklayın.</p>
          </div>
        </div>

        <!-- Result Panel (Initally empty) -->
        <div id="bom-result-panel" class="glass-panel" style="flex: 1; max-width: 450px; border-radius: 16px; padding: 1.5rem; display: flex; flex-direction: column; background: #161b22; overflow-y: auto; border: 1px solid rgba(255,255,255,0.05);">
          <div style="text-align: center; color: var(--text-dim); margin-top: 5rem;">
            <i class="fa-solid fa-magnifying-glass fa-3x" style="margin-bottom: 1rem; opacity: 0.3;"></i>
            <h3 style="font-family: 'Rajdhani', sans-serif;">Bileşen Seçin</h3>
            <p style="font-size: 0.85rem;">Stok durumunu görmek için sol taraftaki türbin haritasından bir parça seçin.</p>
          </div>
        </div>
      </div>
    </div>
  `;
};

// Global handlers for Visual BOM
(window as any).openBOMModal = (partId: string) => {
  const allInv = (window as any)._allInventory || [];
  const groups = (window as any)._componentGroups || {};
  const keywords = groups[partId] || [];

  const panel = document.getElementById('bom-result-panel');
  if (!panel) return;

  const titleMap: Record<string, string> = {
    'rotor': 'Rotor & Kanat Grubu',
    'nacelle': 'Nacelle (Makine Dairesi)',
    'gearbox': 'Dişli Kutusu ve Yağlama',
    'generator': 'Jeneratör ve Elektrik',
    'tower': 'Kule ve Trafo'
  };

  const title = titleMap[partId] || partId.toUpperCase();

  // Filter inventory based on keywords matching description
  const results = allInv.filter((item: any) => {
    const desc = (item.description || '').toLowerCase();
    return keywords.some((kw: string) => desc.includes(kw));
  });

  // Sort by quantity desc
  results.sort((a: any, b: any) => b.quantity - a.quantity);

  let html = `
    <h3 style="font-family: 'Rajdhani', sans-serif; color: #64ffda; border-bottom: 1px solid rgba(100,255,218,0.2); padding-bottom: 0.5rem; margin-bottom: 1.5rem; text-transform: uppercase;">
      ${title} <span style="font-size: 0.8rem; color: var(--text-dim);">(${results.length} Parça)</span>
    </h3>
  `;

  if (results.length === 0) {
    html += `<div style="text-align: center; color: var(--text-dim); padding: 2rem;">Bu gruba ait eşleşen stok bulunamadı.</div>`;
  } else {
    html += `<div style="display: flex; flex-direction: column; gap: 0.75rem;">`;
    results.forEach((item: any) => {
      const isCritical = item.criticalLimit && item.quantity <= item.criticalLimit;
      html += `
        <div style="background: rgba(255,255,255,0.02); border: 1px solid ${isCritical ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.05)'}; padding: 1rem; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.5rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${item.description}</div>
            <div style="background: ${isCritical ? 'rgba(239, 68, 68, 0.2)' : 'rgba(100, 255, 218, 0.1)'}; color: ${isCritical ? '#ef4444' : '#64ffda'}; padding: 0.2rem 0.6rem; border-radius: 4px; font-weight: 800; font-size: 0.8rem;">
              ${item.quantity} Adet
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: var(--text-dim);">
            <span><i class="fa-solid fa-barcode"></i> SAP: ${item.sapNo}</span>
            <span><i class="fa-solid fa-warehouse"></i> ${item.warehouseName}</span>
          </div>
        </div>
      `;
    });
    html += `</div>`;
  }

  panel.innerHTML = html;
};
