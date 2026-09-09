import { workshopComponentService, type WorkshopComponent, type WorkshopComponentLog, COMPONENT_CATEGORIES } from '../services/WorkshopComponentService';
import { repairService, type RepairRecord } from '../services/RepairService';
import * as XLSX from 'xlsx';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('tr-TR');
  } catch (e) {
    return '-';
  }
};

export const WorkshopComponentsPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Merkez Tamir Atölyesi';
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const userEmail = (user?.email || userProfile?.email || '').toLowerCase();
  const isFatihZebek = userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
  const isMaterialManager = userProfile?.role === 'ADMIN' || userProfile?.role === 'MALZEME_YONETIMI' || userEmail === 'hursit.akter@demirerholding.com';

  const components = await workshopComponentService.getComponents(true);
  const allLogs = await workshopComponentService.getComponentLogs(undefined, 300);
  const allRepairs = await repairService.getRepairs(false);

  // Natural drawer sorting (1, 2, 3... 10, 11...)
  const getDrawerNum = (loc: string): number => {
    if (!loc) return 999999;
    const m = String(loc).match(/\d+/);
    return m ? parseInt(m[0], 10) : 999999;
  };

  components.sort((a, b) => {
    const numA = getDrawerNum(a.shelfLocation || '');
    const numB = getDrawerNum(b.shelfLocation || '');
    if (numA !== numB) return numA - numB;
    return (a.name || '').localeCompare(b.name || '', 'tr');
  });

  // Extract unique drawers and counts in natural sorted order
  const drawerMap = new Map<string, number>();
  components.forEach(c => {
    const loc = (c.shelfLocation || 'Atölye Çekmecesi').trim();
    drawerMap.set(loc, (drawerMap.get(loc) || 0) + 1);
  });

  const uniqueDrawers = Array.from(drawerMap.entries()).map(([label, count]) => ({
    label,
    key: label.toLowerCase(),
    count
  })).sort((a, b) => {
    const numA = getDrawerNum(a.label);
    const numB = getDrawerNum(b.label);
    if (numA !== numB) return numA - numB;
    return a.label.localeCompare(b.label, 'tr');
  });

  (window as any)._workshopComponents = components;
  (window as any)._allRepairsForComponents = allRepairs;
  (window as any)._componentLogs = allLogs;

  // Stats calculation
  const totalItemCount = components.length;
  const totalStockQty = components.reduce((sum, c) => sum + (Number(c.quantity) || 0), 0);
  const criticalItems = components.filter(c => Number(c.quantity) <= Number(c.minStock || 0));
  const criticalCount = criticalItems.length;

  // Monthly consumed parts
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyLogs = allLogs.filter(l => {
    if (l.type !== 'OUT') return false;
    const logDate = l.date?.toDate ? l.date.toDate() : new Date(l.date || 0);
    return logDate >= startOfMonth;
  });
  const monthlyConsumedQty = monthlyLogs.reduce((sum, l) => sum + (Number(l.quantity) || 0), 0);

  // Active repairs in workshop for quick job order selection
  const activeWorkshopRepairs = allRepairs.filter(r => 
    r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL' || r.status === 'REPAIRED'
  );

  // Set up global interactive handlers
  setupComponentPageHandlers();

  return `
    <div style="min-height: 100vh; background-color: #0A0E17; color: #E2E8F0; font-family: 'Inter', -apple-system, sans-serif; padding: 2rem; box-sizing: border-box;">
      
      <!-- Top Header & Breadcrumb -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button onclick="if(window.navigate) window.navigate('workshop');" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#94A3B8';" title="Atölye Tezgahına Dön">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">
                  MERKEZ TAMİR ATÖLYESİ
                </span>
                <span style="font-size: 0.8rem; color: #64748B;">•</span>
                <span style="font-size: 0.8rem; color: #94A3B8;">Yedek Parça & Komponent Deposu</span>
              </div>
              <h1 style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 0 0; letter-spacing: 0.5px;">
                <i class="fa-solid fa-microchip" style="color: #00f2ff; margin-right: 8px;"></i>
                KOMPONENT & DEVRE ELEMANLARI YÖNETİMİ
              </h1>
            </div>
          </div>
        </div>

        <!-- Global Action Buttons -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${isFatihZebek ? `
          <button onclick="window.downloadWorkshopComponentsTemplate()" class="btn-cyber" style="background: rgba(59, 130, 246, 0.1); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); font-weight: 800; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(59, 130, 246, 0.2)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.1)'" title="Örnek Excel şablonunu indir">
            <i class="fa-solid fa-file-excel"></i> ŞABLON İNDİR
          </button>
          <input type="file" id="workshop-components-excel-input" accept=".xlsx, .xls" style="display: none;" onchange="window.uploadWorkshopComponentsFromExcel(event)" />
          <button onclick="document.getElementById('workshop-components-excel-input').click()" class="btn-cyber" style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); font-weight: 800; padding: 0.6rem 1.15rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'" title="Excel dosyasından toplu komponent yükle">
            <i class="fa-solid fa-file-arrow-up"></i> EXCEL İLE YÜKLE
          </button>
          ` : ''}
          <button onclick="window.openComponentModal()" class="btn-cyber" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight: 800; padding: 0.6rem 1.15rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(59, 130, 246, 0.25)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.15)'">
            <i class="fa-solid fa-plus"></i> YENİ KOMPONENT EKLE
          </button>
          ${isFatihZebek ? `
          <button onclick="window.downloadComponentsExcel()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.15); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'" title="Mevcut komponent listesini Excel olarak indir">
            <i class="fa-solid fa-download"></i> LİSTEYİ İNDİR
          </button>
          <button onclick="window.openAllComponentLogsModal()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.15); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <i class="fa-solid fa-clock-rotate-left"></i> HAREKET GEÇMİŞİ
          </button>
          <button onclick="window.confirmClearAllWorkshopComponents()" class="btn-cyber" style="background: rgba(239, 68, 68, 0.12); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.4); font-weight: 800; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.12)'" title="Mevcut tüm komponent listesini ve stoğunu sıfırla (Yalnızca Fatih ZEBEK)">
            <i class="fa-solid fa-trash-can"></i> LİSTEYİ SIFIRLA
          </button>
          ` : ''}
        </div>
      </div>

      <!-- Top Summary Metrics Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #00f2ff; background: rgba(0, 242, 255, 0.03); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Toplam Komponent Kalemi</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${totalItemCount} <span style="font-size: 0.85rem; color: #94A3B8; font-weight: 600;">Kalem</span></div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 242, 255, 0.1); color: #00f2ff; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-microchip"></i>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #14F195; background: rgba(20, 241, 149, 0.03); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Toplam Stok Miktarı</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #14F195; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${totalStockQty.toLocaleString('tr-TR')} <span style="font-size: 0.85rem; color: #94A3B8; font-weight: 600;">Adet</span></div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(20, 241, 149, 0.1); color: #14F195; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
        </div>

        <div id="card-critical-stat" class="glass-panel" onclick="window.filterByCriticalOnly()" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #EF4444; background: rgba(239, 68, 68, 0.04); display: flex; justify-content: space-between; align-items: center; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'" title="Kritik seviyedeki malzemeleri filtrele">
          <div>
            <div style="font-size: 0.75rem; color: #EF4444; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; display: flex; align-items: center; gap: 5px;">
              <i class="fa-solid fa-triangle-exclamation"></i> Kritik Stok Uyarısı
            </div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #EF4444; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">
              ${criticalCount} <span style="font-size: 0.85rem; color: #FCA5A5; font-weight: 600;">Kalem Kritik</span>
            </div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(239, 68, 68, 0.15); color: #EF4444; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-bell"></i>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #F59E0B; background: rgba(245, 158, 11, 0.03); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Bu Ay Kartlarda Kullanılan</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #F59E0B; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${monthlyConsumedQty.toLocaleString('tr-TR')} <span style="font-size: 0.85rem; color: #94A3B8; font-weight: 600;">Adet</span></div>
          </div>
          <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(245, 158, 11, 0.1); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 1.2rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
        </div>

      </div>

      <!-- Filters & Search Toolbar -->
      <div style="background: #111827; border: 1px solid #1E293B; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        
        <!-- Search & Drawer Filters -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
          <div style="position: relative; min-width: 250px; flex: 1; max-width: 360px;">
            <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
            <input 
              type="text" 
              id="component-search-input" 
              class="cyber-input" 
              placeholder="Parça Kodu, Tanım veya Çekmece Ara..." 
              oninput="window.filterComponentsTable()"
              style="width: 100%; height: 38px; padding: 0 1rem 0 2.2rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.85rem;"
            />
          </div>

          <!-- Drawer Quick Selector Dropdown -->
          <div style="min-width: 200px;">
            <select id="component-drawer-filter" onchange="window.filterComponentsTable()" style="width: 100%; height: 38px; padding: 0 0.85rem; background: rgba(0,242,255,0.05); border: 1px solid rgba(0,242,255,0.3); border-radius: 8px; color: #00f2ff; font-weight: 700; font-size: 0.82rem; outline: none; cursor: pointer;">
              <option value="">🗄️ Tüm Çekmeceler (${components.length} Kalem)</option>
              ${uniqueDrawers.map(d => `<option value="${d.key}">${d.label} (${d.count} Kalem)</option>`).join('')}
            </select>
          </div>

          <!-- Critical Only Toggle Button -->
          <button id="btn-toggle-critical" onclick="window.toggleCriticalFilter()" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); color: #EF4444; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <i class="fa-solid fa-triangle-exclamation"></i> Sadece Kritik (${criticalCount})
          </button>

          <span id="components-count-badge" style="color: #64748B; font-size: 0.8rem; font-weight: 700; margin-left: 4px;">
            ${components.length} Kalem Listeleniyor
          </span>
        </div>

        <!-- Right Side Actions: Sayım & Excel -->
        <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
          <button onclick="window.openStockAuditModal()" style="height: 38px; padding: 0 1.1rem; border-radius: 8px; border: 1px solid rgba(20, 241, 149, 0.35); background: rgba(20, 241, 149, 0.1); color: #14F195; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(20, 241, 149, 0.2)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'" title="Çekmece veya Genel Stok Sayımı Yap">
            <i class="fa-solid fa-clipboard-check"></i> STOK SAYIMI YAP
          </button>

          ${isFatihZebek ? `
          <button onclick="window.downloadComponentsExcel()" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(0, 242, 255, 0.25); background: rgba(0, 242, 255, 0.06); color: #00f2ff; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 242, 255, 0.15)'" onmouseout="this.style.background='rgba(0, 242, 255, 0.06)'">
            <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
          </button>
          ` : ''}
        </div>

      </div>

      <!-- Components Table -->
      <div style="background: #111827; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.02); color: #94A3B8; border-bottom: 1px solid #1E293B; font-weight: 700;">
                <th style="padding: 1rem 1.25rem;">Parça Kodu / SAP</th>
                <th style="padding: 1rem 1.25rem;">Komponent Tanımı</th>
                <th style="padding: 1rem 1.25rem;">Kutu / Çekmece</th>
                <th style="padding: 1rem 1.25rem; text-align: center;">Mevcut Stok</th>
                <th style="padding: 1rem 1.25rem; text-align: center;">Kritik Limit</th>
                <th style="padding: 1rem 1.25rem; text-align: right;">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody id="components-tbody">
              ${components.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 3rem; color: #94A3B8; font-size: 0.9rem;">
                    <i class="fa-solid fa-microchip" style="font-size: 2rem; color: #334155; display: block; margin-bottom: 0.5rem;"></i>
                    Henüz elektronik komponent tanımlanmamış. "Yeni Komponent Ekle" veya "Excel ile Yükle" butonuna basarak listenizi yükleyebilirsiniz.
                  </td>
                </tr>
              ` : components.slice(0, 30).map(comp => {
                const qty = Number(comp.quantity || 0);
                const min = Number(comp.minStock || 0);
                const isCritical = qty <= min;
                const rawCode = (comp.code || '').trim();
                const isUnknownCode = !rawCode || 
                  rawCode === '-' || 
                  rawCode.toLowerCase().includes('bilinmiyor') || 
                  /^(CAP|RES|DIO|TRN|IC|FUS|OPT|IND|CON|KMP)-\d{4}$/i.test(rawCode);
                const codeDisplayHtml = isUnknownCode
                  ? `<span style="color: #64748B; font-size: 0.78rem; font-style: italic; font-weight: 600;">Parça Kodu Bilinmiyor</span>`
                  : `<span style="font-family: monospace; font-weight: 800; color: #00f2ff; font-size: 0.88rem;">${rawCode}</span>`;
                const searchCode = isUnknownCode ? 'parça kodu bilinmiyor' : rawCode.toLowerCase();

                return `
                  <tr class="component-row" 
                    data-id="${comp.id}" 
                    data-code="${searchCode}" 
                    data-name="${(comp.name || '').toLowerCase()}" 
                    data-location="${(comp.shelfLocation || '').toLowerCase()}"
                    data-critical="${isCritical ? 'true' : 'false'}"
                    style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}; transition: background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                    onmouseout="this.style.background='${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}'"
                  >
                    <td style="padding: 0.85rem 1.25rem;">
                      ${codeDisplayHtml}
                    </td>
                    <td style="padding: 0.85rem 1.25rem; font-weight: 700; color: #FFF;">
                      ${comp.name}
                      ${comp.notes ? `<div style="font-size: 0.72rem; color: #64748B; font-weight: normal; margin-top: 2px;">${comp.notes}</div>` : ''}
                    </td>
                    <td style="padding: 0.85rem 1.25rem; color: #F59E0B; font-weight: 700; font-family: monospace;">
                      <i class="fa-solid fa-box" style="margin-right: 4px; font-size: 0.75rem;"></i>
                      ${comp.shelfLocation || '-'}
                    </td>
                    <td style="padding: 0.85rem 1.25rem; text-align: center;">
                      <span style="padding: 3px 10px; border-radius: 6px; font-family: monospace; font-weight: 900; font-size: 0.9rem;
                        ${isCritical ? 'background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35);' : 'background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.25);'}">
                        ${qty} Ad.
                      </span>
                    </td>
                    <td style="padding: 0.85rem 1.25rem; text-align: center; color: #94A3B8; font-family: monospace; font-size: 0.8rem;">
                      ${min} Ad.
                    </td>
                    <td style="padding: 0.85rem 1.25rem; text-align: right; white-space: nowrap;">
                      <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                        <button onclick="window.openAddStockModal('${comp.id}')" title="Stok Girişi Yap (+)" style="background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                          <i class="fa-solid fa-plus"></i>
                        </button>
                        <button onclick="window.openComponentLogsModal('${comp.id}')" title="Bu Parçanın Kart Harcama & Giriş Geçmişi" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                          <i class="fa-solid fa-clock-rotate-left"></i>
                        </button>
                        <button onclick="window.openComponentModal('${comp.id}')" title="Düzenle" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #FFF; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                          <i class="fa-solid fa-pen"></i>
                        </button>
                        ${isFatihZebek ? `
                        <button onclick="window.deleteWorkshopComponent('${comp.id}', '${(comp.name || '').replace(/'/g, "\\'")}')" title="Komponenti Sil (Yalnızca Fatih ZEBEK)" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Pagination Controls Footer -->
        <div id="components-pagination-container"></div>
      </div>

    </div>
  `;
};

// ==========================================
// INTERACTIVE MODALS & HANDLERS
// ==========================================
const setupComponentPageHandlers = () => {
  const PAGE_SIZE = 30;
  (window as any)._workshopComponentCurrentPage = 1;
  (window as any)._workshopComponentsFiltered = [...((window as any)._workshopComponents || [])];

  const renderComponentRowHtml = (comp: any, isFatihZebek: boolean) => {
    const qty = Number(comp.quantity || 0);
    const min = Number(comp.minStock || 0);
    const isCritical = qty <= min;
    const rawCode = (comp.code || '').trim();
    const isUnknownCode = !rawCode || 
      rawCode === '-' || 
      rawCode.toLowerCase().includes('bilinmiyor') || 
      /^(CAP|RES|DIO|TRN|IC|FUS|OPT|IND|CON|KMP)-\d{4}$/i.test(rawCode);
    const codeDisplayHtml = isUnknownCode
      ? `<span style="color: #64748B; font-size: 0.78rem; font-style: italic; font-weight: 600;">Parça Kodu Bilinmiyor</span>`
      : `<span style="font-family: monospace; font-weight: 800; color: #00f2ff; font-size: 0.88rem;">${rawCode}</span>`;
    const searchCode = isUnknownCode ? 'parça kodu bilinmiyor' : rawCode.toLowerCase();

    return `
      <tr class="component-row" 
        data-id="${comp.id}" 
        data-code="${searchCode}" 
        data-name="${(comp.name || '').toLowerCase()}" 
        data-location="${(comp.shelfLocation || '').toLowerCase()}"
        data-critical="${isCritical ? 'true' : 'false'}"
        style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}; transition: background 0.2s;"
        onmouseover="this.style.background='rgba(255,255,255,0.03)'"
        onmouseout="this.style.background='${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}'"
      >
        <td style="padding: 0.85rem 1.25rem;">
          ${codeDisplayHtml}
        </td>
        <td style="padding: 0.85rem 1.25rem; font-weight: 700; color: #FFF;">
          ${comp.name}
          ${comp.notes ? `<div style="font-size: 0.72rem; color: #64748B; font-weight: normal; margin-top: 2px;">${comp.notes}</div>` : ''}
        </td>
        <td style="padding: 0.85rem 1.25rem; color: #F59E0B; font-weight: 700; font-family: monospace;">
          <i class="fa-solid fa-box" style="margin-right: 4px; font-size: 0.75rem;"></i>
          ${comp.shelfLocation || '-'}
        </td>
        <td style="padding: 0.85rem 1.25rem; text-align: center;">
          <span style="padding: 3px 10px; border-radius: 6px; font-family: monospace; font-weight: 900; font-size: 0.9rem;
            ${isCritical ? 'background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35);' : 'background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.25);'}">
            ${qty} Ad.
          </span>
        </td>
        <td style="padding: 0.85rem 1.25rem; text-align: center; color: #94A3B8; font-family: monospace; font-size: 0.8rem;">
          ${min} Ad.
        </td>
        <td style="padding: 0.85rem 1.25rem; text-align: right; white-space: nowrap;">
          <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
            <button onclick="window.openAddStockModal('${comp.id}')" title="Stok Girişi Yap (+)" style="background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
              <i class="fa-solid fa-plus"></i>
            </button>
            <button onclick="window.openComponentLogsModal('${comp.id}')" title="Bu Parçanın Kart Harcama & Giriş Geçmişi" style="background: rgba(59, 130, 246, 0.1); border: 1px solid rgba(59, 130, 246, 0.3); color: #60a5fa; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
              <i class="fa-solid fa-clock-rotate-left"></i>
            </button>
            <button onclick="window.openComponentModal('${comp.id}')" title="Düzenle" style="background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.15); color: #FFF; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
              <i class="fa-solid fa-pen"></i>
            </button>
            ${isFatihZebek ? `
            <button onclick="window.deleteWorkshopComponent('${comp.id}', '${(comp.name || '').replace(/'/g, "\\'")}')" title="Komponenti Sil (Yalnızca Fatih ZEBEK)" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
              <i class="fa-solid fa-trash"></i>
            </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  };

  const renderPaginationHtml = (totalItems: number, currentPage: number) => {
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    const startItem = totalItems === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const endItem = Math.min(currentPage * PAGE_SIZE, totalItems);

    let pageBtns = '';
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + maxButtons - 1);
    if (endPage - startPage < maxButtons - 1) {
      startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let p = startPage; p <= endPage; p++) {
      const isActive = p === currentPage;
      pageBtns += `
        <button onclick="window.goToWorkshopComponentPage(${p})" style="min-width: 32px; height: 32px; padding: 0 6px; border-radius: 6px; font-weight: 700; font-size: 0.8rem; cursor: pointer; transition: all 0.2s;
          ${isActive ? 'background: #00f2ff; color: #0A0E17; border: 1px solid #00f2ff; font-weight: 900;' : 'background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1);'}"
          ${isActive ? '' : 'onmouseover="this.style.background=\'rgba(255,255,255,0.15)\'; this.style.color=\'#FFF\';" onmouseout="this.style.background=\'rgba(255,255,255,0.05)\'; this.style.color=\'#94A3B8\';"'}>
          ${p}
        </button>
      `;
    }

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.9rem 1.25rem; background: rgba(0,0,0,0.25); border-top: 1px solid #1E293B; font-size: 0.8rem; color: #94A3B8; flex-wrap: wrap; gap: 10px;">
        <div>
          Toplam <strong>${totalItems}</strong> Kalem (${startItem} - ${endItem} arası gösteriliyor)
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <button onclick="window.goToWorkshopComponentPage(1)" ${currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;' : 'style="cursor: pointer;'} height: 32px; padding: 0 8px; border-radius: 6px; background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;" title="İlk Sayfa">
            <i class="fa-solid fa-angles-left"></i>
          </button>
          <button onclick="window.goToWorkshopComponentPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;' : 'style="cursor: pointer;'} height: 32px; padding: 0 10px; border-radius: 6px; background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;">
            <i class="fa-solid fa-chevron-left" style="margin-right: 4px;"></i> Önceki
          </button>
          ${pageBtns}
          <button onclick="window.goToWorkshopComponentPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;' : 'style="cursor: pointer;'} height: 32px; padding: 0 10px; border-radius: 6px; background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;">
            Sonraki <i class="fa-solid fa-chevron-right" style="margin-left: 4px;"></i>
          </button>
          <button onclick="window.goToWorkshopComponentPage(${totalPages})" ${currentPage >= totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;' : 'style="cursor: pointer;'} height: 32px; padding: 0 8px; border-radius: 6px; background: rgba(255,255,255,0.05); color: #94A3B8; border: 1px solid rgba(255,255,255,0.1); font-size: 0.75rem;" title="Son Sayfa">
            <i class="fa-solid fa-angles-right"></i>
          </button>
        </div>
      </div>
    `;
  };

  const updateTableDisplay = () => {
    const tbody = document.getElementById('components-tbody');
    const paginationContainer = document.getElementById('components-pagination-container');
    const countBadge = document.getElementById('components-count-badge');
    const filtered = (window as any)._workshopComponentsFiltered || [];
    const page = (window as any)._workshopComponentCurrentPage || 1;
    const user = (window as any).currentUser;
    const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
    const userEmail = (user?.email || userProfile?.email || '').toLowerCase();
    const isFatihZebek = userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');

    const startIndex = (page - 1) * PAGE_SIZE;
    const pageSlice = filtered.slice(startIndex, startIndex + PAGE_SIZE);

    if (tbody) {
      if (filtered.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; padding: 3rem; color: #94A3B8; font-size: 0.9rem;">
              <i class="fa-solid fa-magnifying-glass" style="font-size: 2rem; color: #334155; display: block; margin-bottom: 0.5rem;"></i>
              Arama kriterlerine uygun komponent bulunamadı.
            </td>
          </tr>
        `;
      } else {
        tbody.innerHTML = pageSlice.map((comp: any) => renderComponentRowHtml(comp, isFatihZebek)).join('');
      }
    }

    if (paginationContainer) {
      paginationContainer.innerHTML = renderPaginationHtml(filtered.length, page);
    }

    if (countBadge) {
      countBadge.innerText = `${filtered.length} / ${(window as any)._workshopComponents?.length || 0} Kalem Listeleniyor`;
    }
  };

  (window as any).goToWorkshopComponentPage = (pageNumber: number) => {
    const totalItems = ((window as any)._workshopComponentsFiltered || []).length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (pageNumber < 1 || pageNumber > totalPages) return;
    (window as any)._workshopComponentCurrentPage = pageNumber;
    updateTableDisplay();
  };

  // Initialize pagination container on first load
  setTimeout(() => {
    updateTableDisplay();
  }, 50);

  // 1. Filter Components Table
  (window as any).filterComponentsTable = () => {
    const searchInput = document.getElementById('component-search-input') as HTMLInputElement;
    const term = (searchInput?.value || '').trim().toLowerCase();
    const onlyCritical = (window as any)._filterOnlyCritical === true;
    const drawerSelect = document.getElementById('component-drawer-filter') as HTMLSelectElement;
    const selectedDrawer = (drawerSelect?.value || '').trim().toLowerCase();
    const all = (window as any)._workshopComponents || [];

    const filtered = all.filter((comp: any) => {
      const rawCode = (comp.code || '').trim().toLowerCase();
      const isUnknown = !rawCode || rawCode === '-' || rawCode.includes('bilinmiyor');
      const searchCode = isUnknown ? 'parça kodu bilinmiyor' : rawCode;
      const name = (comp.name || '').toLowerCase();
      const loc = (comp.shelfLocation || '').trim().toLowerCase();
      const qty = Number(comp.quantity || 0);
      const min = Number(comp.minStock || 0);
      const isCritical = qty <= min;

      const matchSearch = !term || searchCode.includes(term) || name.includes(term) || loc.includes(term);
      const matchCritical = !onlyCritical || isCritical;
      const matchDrawer = !selectedDrawer || loc === selectedDrawer;

      return matchSearch && matchCritical && matchDrawer;
    });

    (window as any)._workshopComponentsFiltered = filtered;
    (window as any)._workshopComponentCurrentPage = 1;
    updateTableDisplay();
  };

  (window as any).toggleCriticalFilter = () => {
    (window as any)._filterOnlyCritical = !(window as any)._filterOnlyCritical;
    const btn = document.getElementById('btn-toggle-critical');
    if (btn) {
      if ((window as any)._filterOnlyCritical) {
        btn.style.background = 'rgba(239, 68, 68, 0.25)';
        btn.style.borderColor = '#EF4444';
      } else {
        btn.style.background = 'rgba(239, 68, 68, 0.08)';
        btn.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      }
    }
    (window as any).filterComponentsTable();
  };

  (window as any).filterByCriticalOnly = () => {
    (window as any)._filterOnlyCritical = true;
    const btn = document.getElementById('btn-toggle-critical');
    if (btn) {
      btn.style.background = 'rgba(239, 68, 68, 0.25)';
      btn.style.borderColor = '#EF4444';
    }
    (window as any).filterComponentsTable();
  };

  // 1b. Confirm and Clear All Components
  (window as any).confirmClearAllWorkshopComponents = async () => {
    const user = (window as any).currentUser;
    const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
    const userEmail = (user?.email || userProfile?.email || '').toLowerCase();
    const isFatihZebek = userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
    if (!isFatihZebek) {
      alert("Yetkisiz işlem: Komponent listesini sıfırlama yetkisi yalnızca Fatih ZEBEK kullanıcısına aittir.");
      return;
    }

    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    const count = components.length;
    if (count === 0) {
      alert("Silinecek herhangi bir komponent kaydı bulunmuyor.");
      return;
    }

    if (!confirm(`⚠️ DİKKAT: Mevcut ${count} adet elektronik komponent kaydının TAMAMI veritabanından silinecektir!\n\nBu işlem geri alınamaz. Devam etmek istiyor musunuz?`)) {
      return;
    }

    const promptVal = prompt(`Listeyi tamamen temizlemek için lütfen kutucuğa "SIFIRLA" yazıp Tamam'a basınız:`);
    if (promptVal !== 'SIFIRLA') {
      if (promptVal !== null) alert("İşlem iptal edildi (Onay metni eşleşmedi).");
      return;
    }

    const userEmailStr = user?.email || user?.displayName || 'Merkez Tamir Atölyesi';

    // Show loading indicator
    const loadingOverlay = document.createElement('div');
    loadingOverlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px);
      display: flex; flex-direction: column; align-items: center; justify-content: center; z-index: 99999;
    `;
    loadingOverlay.innerHTML = `
      <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 3rem; color: #EF4444; margin-bottom: 1rem;"></i>
      <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #FFF; font-weight: 800; margin: 0 0 0.5rem 0;">KOMPONENTLER SİLİNİYOR...</h3>
      <p style="color: #94A3B8; font-size: 0.9rem; margin: 0;">Lütfen bekleyiniz, ${count} adet kayıt temizleniyor.</p>
    `;
    document.body.appendChild(loadingOverlay);

    try {
      await workshopComponentService.clearAllComponents(userEmail);
      loadingOverlay.remove();
      (window as any).showToast?.('Başarılı', `${count} adet komponent başarıyla silindi ve liste sıfırlandı.`, 'success');
      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      loadingOverlay.remove();
      alert("Sıfırlama işlemi sırasında hata oluştu: " + err.message);
    }
  };

  // 2. Open Component Create / Edit Modal (Simplified)
  (window as any).openComponentModal = (compId?: string) => {
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    const editingComp = compId ? components.find(c => c.id === compId) : null;
    const isEdit = !!editingComp;

    const modal = document.createElement('div');
    modal.id = 'component-form-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 520px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(0, 242, 255, 0.25); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; color: #00f2ff; font-weight: 800; letter-spacing: 0.5px;">
            <i class="fa-solid fa-microchip" style="margin-right: 8px;"></i>
            ${isEdit ? 'KOMPONENT DÜZENLE' : 'YENİ ELEKTRONİK KOMPONENT TANIMLA'}
          </h3>
          <button onclick="document.getElementById('component-form-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="component-form" onsubmit="event.preventDefault(); window.submitComponentForm('${compId || ''}');">
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">PARÇA KODU / SAP NO</label>
              <input type="text" id="comp-code" class="cyber-input" placeholder="Örn: SMBJ36CA (Bilinmiyorsa boş bırakın)" value="${editingComp?.code || ''}" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-transform: uppercase;" />
            </div>
            <div>
              <label style="display: block; color: #F59E0B; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KUTU / ÇEKMECE *</label>
              <input type="text" id="comp-location" class="cyber-input" placeholder="Örn: Çekmece No: 4" value="${editingComp?.shelfLocation || ''}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); font-weight: 700; color: #F59E0B;" />
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KOMPONENT TANIMI *</label>
            <input type="text" id="comp-name" class="cyber-input" placeholder="Örn: 470µF 50V 105°C Kondansatör" value="${editingComp?.name || ''}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; color: #14F195; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">${isEdit ? 'MEVCUT STOK' : 'BAŞLANGIÇ STOK'} *</label>
              <input type="number" id="comp-qty" class="cyber-input" min="0" value="${editingComp ? editingComp.quantity : 0}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-weight: 800; color: #14F195;" />
            </div>
            <div>
              <label style="display: block; color: #EF4444; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KRİTİK MİN. STOK *</label>
              <input type="number" id="comp-min-stock" class="cyber-input" min="0" value="${editingComp ? editingComp.minStock : 5}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-weight: 800; color: #EF4444;" />
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">NOTLAR / AÇIKLAMA</label>
            <textarea id="comp-notes" class="cyber-input" placeholder="Ekstra teknik detaylar, alternatif kodlar..." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); height: 60px; resize: none;">${editingComp?.notes || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.25rem;">
            <button type="button" onclick="document.getElementById('component-form-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">İPTAL</button>
            <button type="submit" id="btn-submit-comp" class="btn-cyber" style="background: linear-gradient(135deg, #00f2ff 0%, #0099ff 100%); color: #0A0E17; font-weight: 900; padding: 0.65rem 1.5rem; font-size: 0.85rem; box-shadow: 0 0 15px rgba(0,242,255,0.3);">
              ${isEdit ? 'GÜNCELLE' : 'KAYDET'}
            </button>
          </div>

        </form>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitComponentForm = async (compId?: string) => {
    const code = ((document.getElementById('comp-code') as HTMLInputElement)?.value || '').trim();
    const name = ((document.getElementById('comp-name') as HTMLInputElement)?.value || '').trim();
    const qty = parseInt((document.getElementById('comp-qty') as HTMLInputElement)?.value || '0', 10);
    const minStock = parseInt((document.getElementById('comp-min-stock') as HTMLInputElement)?.value || '0', 10);
    const shelfLocation = ((document.getElementById('comp-location') as HTMLInputElement)?.value || '').trim();
    const notes = ((document.getElementById('comp-notes') as HTMLTextAreaElement)?.value || '').trim();

    if (!name) {
      alert("Lütfen Komponent Tanımı alanını doldurun.");
      return;
    }

    const btn = document.getElementById('btn-submit-comp') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      if (compId) {
        await workshopComponentService.updateComponent(compId, {
          code,
          name,
          category: 'DİĞER',
          value: '-',
          package: '-',
          quantity: qty,
          minStock,
          shelfLocation,
          notes
        }, userEmail);
        (window as any).showToast?.('Başarılı', 'Komponent bilgileri güncellendi.', 'success');
      } else {
        await workshopComponentService.addComponent({
          code,
          name,
          category: 'DİĞER',
          value: '-',
          package: '-',
          quantity: qty,
          minStock,
          shelfLocation,
          notes
        }, userEmail);
        (window as any).showToast?.('Başarılı', 'Yeni komponent başarıyla stoğa eklendi.', 'success');
      }

      document.getElementById('component-form-modal')?.remove();
      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      alert("İşlem esnasında hata oluştu: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = compId ? 'GÜNCELLE' : 'KAYDET';
      }
    }
  };

  // 3. Add Stock Modal (+)
  (window as any).openAddStockModal = (compId: string) => {
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    const comp = components.find(c => c.id === compId);
    if (!comp) return;

    const modal = document.createElement('div');
    modal.id = 'add-stock-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 440px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.25); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.85rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; color: #14F195; font-weight: 800;">
            <i class="fa-solid fa-boxes-packing" style="margin-right: 6px;"></i> STOK GİRİŞİ YAP (+)
          </h3>
          <button onclick="document.getElementById('add-stock-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 8px; margin-bottom: 1.25rem;">
          <div style="font-size: 0.8rem; color: #00f2ff; font-family: monospace; font-weight: 800;">${comp.code}</div>
          <div style="font-weight: 700; color: #FFF; font-size: 0.95rem; margin-top: 2px;">${comp.name}</div>
          <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.8rem; color: #94A3B8;">
            <span>Mevcut Stok: <strong style="color: #14F195;">${comp.quantity} Ad.</strong></span>
            <span>Konum: <strong style="color: #F59E0B;">${comp.shelfLocation}</strong></span>
          </div>
        </div>

        <div style="margin-bottom: 1rem;">
          <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">EKLENECEK MİKTAR (ADET) *</label>
          <input type="number" id="add-stock-qty" class="cyber-input" min="1" value="10" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-size: 1.2rem; font-weight: 900; color: #14F195;" />
        </div>

        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">AÇIKLAMA / FATURA / TEDARİK NOTU</label>
          <input type="text" id="add-stock-note" class="cyber-input" placeholder="Örn: Yeni sipariş teslim alındı" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button onclick="document.getElementById('add-stock-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">İPTAL</button>
          <button id="btn-confirm-add-stock" onclick="window.submitAddStock('${compId}')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.65rem 1.5rem; font-size: 0.85rem; box-shadow: 0 0 15px rgba(20,241,149,0.3);">
            STOĞA EKLE (+)
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitAddStock = async (compId: string) => {
    const qtyInput = document.getElementById('add-stock-qty') as HTMLInputElement;
    const noteInput = document.getElementById('add-stock-note') as HTMLInputElement;
    const qty = parseInt(qtyInput?.value || '0', 10);
    const note = noteInput?.value.trim() || 'Stok girişi (+)';

    if (isNaN(qty) || qty <= 0) {
      alert("Lütfen 1 veya daha büyük geçerli bir miktar girin.");
      return;
    }

    const btn = document.getElementById('btn-confirm-add-stock') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      await workshopComponentService.addStock(compId, qty, userEmail, note);
      (window as any).showToast?.('Başarılı', `Stoğa ${qty} adet başarıyla eklendi.`, 'success');
      document.getElementById('add-stock-modal')?.remove();
      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      alert("Hata oluştu: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = 'STOĞA EKLE (+)';
      }
    }
  };

  // 3b. Open Stock Audit Modal (Drawer-based & Bulk Inventory Audit)
  (window as any).openStockAuditModal = (initialDrawer?: string) => {
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    if (components.length === 0) {
      alert("Sayım yapılacak elektronik komponent bulunamadı.");
      return;
    }

    // Helper for drawer natural sorting
    const getDrawerNum = (loc: string): number => {
      if (!loc) return 999999;
      const m = String(loc).match(/\d+/);
      return m ? parseInt(m[0], 10) : 999999;
    };

    // Extract drawers
    const drawerMap = new Map<string, number>();
    components.forEach(c => {
      const loc = (c.shelfLocation || 'Atölye Çekmecesi').trim();
      drawerMap.set(loc, (drawerMap.get(loc) || 0) + 1);
    });
    const uniqueDrawers = Array.from(drawerMap.entries()).map(([label, count]) => ({
      label,
      key: label.toLowerCase(),
      count
    })).sort((a, b) => {
      const numA = getDrawerNum(a.label);
      const numB = getDrawerNum(b.label);
      if (numA !== numB) return numA - numB;
      return a.label.localeCompare(b.label, 'tr');
    });

    const modal = document.createElement('div');
    modal.id = 'stock-audit-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.88); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 980px; height: 90vh; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.35); box-shadow: 0 20px 50px rgba(0,0,0,0.6); display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; flex-shrink: 0;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #14F195; font-weight: 900; letter-spacing: 0.5px;">
              <i class="fa-solid fa-clipboard-check" style="margin-right: 8px;"></i> ELEKTRONİK KOMPONENT STOK SAYIMI (ENVANTER DÜZELTME)
            </h3>
            <div style="font-size: 0.82rem; color: #94A3B8; margin-top: 3px;">
              Çekmecedeki fiziksel sayım miktarlarını girin. Sistem otomatik farkı hesaplar ve tek tıkla veritabanını günceller.
            </div>
          </div>
          <button onclick="document.getElementById('stock-audit-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.3rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Filter Bar inside Audit Modal -->
        <div style="display: flex; gap: 10px; margin-bottom: 1rem; flex-shrink: 0; flex-wrap: wrap;">
          <div style="min-width: 240px; flex: 1;">
            <select id="audit-drawer-select" onchange="window.filterAuditRows()" style="width: 100%; padding: 0.65rem 1rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 8px; color: #14F195; font-weight: 800; font-size: 0.85rem; outline: none; cursor: pointer;">
              <option value="">🗄️ Tüm Çekmeceler (${components.length} Kalem)</option>
              ${uniqueDrawers.map(d => `<option value="${d.key}" ${initialDrawer && initialDrawer.toLowerCase() === d.key ? 'selected' : ''}>${d.label} (${d.count} Kalem)</option>`).join('')}
            </select>
          </div>
          <div style="min-width: 220px; flex: 1; position: relative;">
            <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
            <input 
              type="text" 
              id="audit-search-input" 
              placeholder="Sayım listesinde filtrele..." 
              oninput="window.filterAuditRows()"
              style="width: 100%; height: 38px; padding: 0 1rem 0 2.2rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.85rem;"
            />
          </div>
        </div>

        <!-- Table Container -->
        <div style="flex: 1; overflow-y: auto; overflow-x: auto; border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; background: rgba(0,0,0,0.25);" class="custom-scrollbar">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.83rem; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.04); color: #94A3B8; border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0; z-index: 2; font-weight: 800;">
                <th style="padding: 0.75rem 1rem;">Parça Kodu / SAP</th>
                <th style="padding: 0.75rem 1rem;">Komponent Tanımı</th>
                <th style="padding: 0.75rem 1rem;">Çekmece</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Kayıtlı Stok</th>
                <th style="padding: 0.75rem 1rem; text-align: center; width: 140px;">Fiziksel Sayılan</th>
                <th style="padding: 0.75rem 1rem; text-align: center; width: 110px;">Fark</th>
              </tr>
            </thead>
            <tbody id="audit-tbody">
              ${components.map(c => {
                const rawCode = (c.code || '').trim();
                const isUnknownCode = !rawCode || rawCode === '-' || rawCode.toLowerCase().includes('bilinmiyor') || /^(CAP|RES|DIO|TRN|IC|FUS|OPT|IND|CON|KMP)-\d{4}$/i.test(rawCode);
                const codeHtml = isUnknownCode 
                  ? `<span style="color: #64748B; font-size: 0.75rem; font-style: italic;">Parça Kodu Bilinmiyor</span>`
                  : `<span style="font-family: monospace; font-weight: 800; color: #00f2ff; font-size: 0.85rem;">${rawCode}</span>`;
                const searchCode = isUnknownCode ? 'parça kodu bilinmiyor' : rawCode.toLowerCase();
                const currentQty = Number(c.quantity || 0);

                return `
                  <tr class="audit-row"
                    data-id="${c.id}"
                    data-code="${searchCode}"
                    data-name="${(c.name || '').toLowerCase()}"
                    data-location="${(c.shelfLocation || '').toLowerCase()}"
                    data-current-qty="${currentQty}"
                    style="border-bottom: 1px solid rgba(255,255,255,0.03);"
                  >
                    <td style="padding: 0.65rem 1rem;">${codeHtml}</td>
                    <td style="padding: 0.65rem 1rem; font-weight: 700; color: #FFF;">${c.name}</td>
                    <td style="padding: 0.65rem 1rem; color: #F59E0B; font-weight: 700; font-family: monospace; font-size: 0.8rem;">
                      ${c.shelfLocation || '-'}
                    </td>
                    <td style="padding: 0.65rem 1rem; text-align: center; font-family: monospace; font-weight: 800; color: #94A3B8;">
                      ${currentQty} Ad.
                    </td>
                    <td style="padding: 0.65rem 1rem; text-align: center;">
                      <input 
                        type="number" 
                        class="audit-counted-input" 
                        data-id="${c.id}" 
                        data-original="${currentQty}"
                        min="0" 
                        value="${currentQty}" 
                        oninput="window.calculateAuditRowDiff(this)" 
                        onfocus="this.select()"
                        style="width: 85px; padding: 0.4rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.15); border-radius: 6px; color: #FFF; font-weight: 900; font-family: monospace; font-size: 0.95rem; text-align: center;"
                      />
                    </td>
                    <td style="padding: 0.65rem 1rem; text-align: center;">
                      <span class="audit-diff-badge" data-id="${c.id}" style="padding: 2px 8px; border-radius: 4px; font-family: monospace; font-weight: 900; font-size: 0.82rem; background: rgba(255,255,255,0.05); color: #64748B;">
                        0
                      </span>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

        <!-- Audit Summary Footer -->
        <div style="margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid rgba(255,255,255,0.08); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; flex-shrink: 0;">
          <div style="display: flex; gap: 1.5rem; align-items: center;">
            <div style="font-size: 0.82rem; color: #94A3B8;">
              Listelenen: <strong id="audit-visible-count" style="color: #FFF;">${components.length}</strong> Kalem
            </div>
            <div style="font-size: 0.82rem; color: #94A3B8;">
              Fark Olan: <strong id="audit-diff-count" style="color: #64748B;">0</strong> Kalem
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem;">
            <button type="button" onclick="document.getElementById('stock-audit-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">
              İPTAL
            </button>
            <button id="btn-submit-stock-audit" onclick="window.submitStockAudit()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.75rem 1.75rem; font-size: 0.9rem; box-shadow: 0 0 20px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <i class="fa-solid fa-check" style="margin-right: 6px;"></i> SAYIMI ONAYLA VE GÜNCELLE
            </button>
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
    if (initialDrawer) {
      (window as any).filterAuditRows();
    }
  };

  (window as any).calculateAuditRowDiff = (inputEl: HTMLInputElement) => {
    const compId = inputEl.dataset.id;
    const origQty = parseInt(inputEl.dataset.original || '0', 10);
    const newQty = parseInt(inputEl.value || '0', 10);
    const diff = newQty - origQty;

    const badge = document.querySelector(`.audit-diff-badge[data-id="${compId}"]`) as HTMLElement;
    if (badge) {
      if (diff === 0) {
        badge.style.background = 'rgba(255,255,255,0.05)';
        badge.style.color = '#64748B';
        badge.style.border = 'none';
        badge.innerText = '0';
      } else if (diff > 0) {
        badge.style.background = 'rgba(20, 241, 149, 0.15)';
        badge.style.color = '#14F195';
        badge.style.border = '1px solid rgba(20, 241, 149, 0.35)';
        badge.innerText = `+${diff}`;
      } else {
        badge.style.background = 'rgba(239, 68, 68, 0.15)';
        badge.style.color = '#EF4444';
        badge.style.border = '1px solid rgba(239, 68, 68, 0.35)';
        badge.innerText = `${diff}`;
      }
    }

    // Update diff count in footer
    const allInputs = document.querySelectorAll('.audit-counted-input') as NodeListOf<HTMLInputElement>;
    let diffCount = 0;
    allInputs.forEach(inp => {
      const orig = parseInt(inp.dataset.original || '0', 10);
      const val = parseInt(inp.value || '0', 10);
      if (val !== orig) diffCount++;
    });

    const diffCountEl = document.getElementById('audit-diff-count');
    if (diffCountEl) {
      diffCountEl.innerText = `${diffCount}`;
      diffCountEl.style.color = diffCount > 0 ? '#14F195' : '#64748B';
    }
  };

  (window as any).filterAuditRows = () => {
    const drawerSelect = document.getElementById('audit-drawer-select') as HTMLSelectElement;
    const searchInput = document.getElementById('audit-search-input') as HTMLInputElement;
    const selectedDrawer = (drawerSelect?.value || '').trim().toLowerCase();
    const searchTerm = (searchInput?.value || '').trim().toLowerCase();

    const rows = document.querySelectorAll('.audit-row') as NodeListOf<HTMLElement>;
    let visible = 0;
    rows.forEach(row => {
      const code = row.getAttribute('data-code') || '';
      const name = row.getAttribute('data-name') || '';
      const loc = (row.getAttribute('data-location') || '').trim().toLowerCase();

      const matchDrawer = !selectedDrawer || loc === selectedDrawer;
      const matchSearch = !searchTerm || code.includes(searchTerm) || name.includes(searchTerm) || loc.includes(searchTerm);

      if (matchDrawer && matchSearch) {
        row.style.display = '';
        visible++;
      } else {
        row.style.display = 'none';
      }
    });

    const countEl = document.getElementById('audit-visible-count');
    if (countEl) {
      countEl.innerText = `${visible}`;
    }
  };

  (window as any).submitStockAudit = async () => {
    const allInputs = document.querySelectorAll('.audit-counted-input') as NodeListOf<HTMLInputElement>;
    const updates: Array<{ componentId: string; newQuantity: number }> = [];

    allInputs.forEach(inp => {
      const compId = inp.dataset.id;
      const orig = parseInt(inp.dataset.original || '0', 10);
      const val = parseInt(inp.value || '0', 10);
      if (compId && val !== orig) {
        updates.push({ componentId: compId, newQuantity: Math.max(0, val) });
      }
    });

    if (updates.length === 0) {
      alert("Herhangi bir stok farkı girilmedi. Tüm miktarlar mevcut stokla aynı.");
      return;
    }

    if (!confirm(`Toplam ${updates.length} kalem elektronik komponentin stok adedi sayım sonuçlarınıza göre güncellenecektir.\n\nOnaylıyor musunuz?`)) {
      return;
    }

    const btn = document.getElementById('btn-submit-stock-audit') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Güncelleniyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      const result = await workshopComponentService.auditStockQuantities(updates, userEmail);
      (window as any).showToast?.('Başarılı', `${result.updatedCount} kalem komponentin stoğu başarıyla güncellendi.`, 'success');
      document.getElementById('stock-audit-modal')?.remove();
      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      alert("Sayım güncellenirken hata oluştu: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 6px;"></i> SAYIMI ONAYLA VE GÜNCELLE';
      }
    }
  };

  // 4. CARD JOB ORDER / COMPONENT USAGE MODAL (THE MAIN CONTROL WORKFLOW)
  (window as any).openCardUsageModal = (prefilledRepairId?: string) => {
    const allRepairs: RepairRecord[] = (window as any)._allRepairsForComponents || [];
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];

    // Filter active cards in workshop
    const activeCards = allRepairs.filter(r => 
      r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL' || r.status === 'REPAIRED'
    );

    const prefilledCard = prefilledRepairId ? allRepairs.find(r => r.id === prefilledRepairId) : null;

    const modal = document.createElement('div');
    modal.id = 'card-usage-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 650px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.3); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; color: #14F195; font-weight: 900; letter-spacing: 0.5px;">
              <i class="fa-solid fa-bolt" style="margin-right: 6px;"></i> KARTA KOMPONENT DÜŞÜŞÜ (İŞ EMRİ)
            </h3>
            <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 2px;">
              Kart tamirinde kullanılan elektronik malzemeleri seçip kart kaydına bağlayın.
            </div>
          </div>
          <button onclick="document.getElementById('card-usage-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 1. CARD SELECTION & VERIFICATION -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.75rem; color: #00f2ff; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-id-card"></i> 1. ADIM: ONARILAN KARTIN DOĞRULANMASI
          </div>

          <div style="display: flex; gap: 8px; margin-bottom: 0.75rem;">
            <input 
              type="text" 
              id="search-repair-card-input" 
              class="cyber-input" 
              placeholder="Kart Seri No veya SAP No yazıp arayın..." 
              value="${prefilledCard ? (prefilledCard.serialNo || prefilledCard.sapNo) : ''}"
              oninput="window.searchRepairCardForUsage()"
              style="flex: 1; padding: 0.75rem; background: rgba(0,0,0,0.4); text-transform: uppercase; font-family: monospace;"
            />
          </div>

          <!-- Quick Card Dropdown Selector -->
          <div style="margin-bottom: 0.75rem;">
            <select id="select-repair-card-dropdown" onchange="window.selectRepairCardFromDropdown(this.value)" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.85rem; outline: none; cursor: pointer;">
              <option value="">-- Atölyedeki İşlem Gören Kartlardan Seçin (${activeCards.length} Kart) --</option>
              ${activeCards.map(r => `
                <option value="${r.id}" ${prefilledRepairId === r.id ? 'selected' : ''}>
                  ${r.description} | SAP: ${r.sapNo} | Seri: ${r.serialNo || '-'} (${r.sourceWarehouseId})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Verified Card Info Display Box -->
          <div id="verified-card-box" style="display: ${prefilledCard ? 'block' : 'none'}; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 8px; padding: 0.85rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <span id="verified-card-name" style="font-weight: 800; color: #FFF; font-size: 0.95rem;">${prefilledCard?.description || ''}</span>
                <div style="display: flex; gap: 8px; margin-top: 4px; flex-wrap: wrap;">
                  <span id="verified-card-sap" style="color: #60a5fa; font-family: monospace; font-size: 0.75rem; font-weight: 800;">SAP: ${prefilledCard?.sapNo || ''}</span>
                  <span id="verified-card-serial" style="color: #34d399; font-family: monospace; font-size: 0.75rem; font-weight: 800;">SERİ: ${prefilledCard?.serialNo || '-'}</span>
                  <span id="verified-card-site" style="color: #F59E0B; font-size: 0.75rem; font-weight: 700;">Santral: ${prefilledCard?.sourceWarehouseId || '-'}</span>
                </div>
              </div>
              <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">
                ✓ DOĞRULANDI
              </span>
            </div>
            <div id="verified-card-fault" style="font-size: 0.75rem; color: #94A3B8; margin-top: 4px;">
              Arıza: ${prefilledCard?.faultCode || '-'} ${prefilledCard?.faultDesc ? ' - ' + prefilledCard.faultDesc : ''}
            </div>
          </div>

          <!-- Error Alert if card not found -->
          <div id="card-not-found-alert" style="display: none; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 0.75rem; color: #EF4444; font-size: 0.8rem; font-weight: 700;">
            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i>
            Bu seri numaralı kart atölye stoğunda bulunamadı! Malzeme çıkışı yapabilmek için kartın önce atölyeye teslim alınmış olması gerekir.
          </div>

        </div>

        <!-- 2. COMPONENTS SELECTION -->
        <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div style="font-size: 0.75rem; color: #14F195; font-weight: 800; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-microchip"></i> 2. ADIM: KULLANILAN DEVRE ELEMANLARI
            </div>
            <button type="button" onclick="window.addUsageComponentRow()" style="background: rgba(20, 241, 149, 0.1); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
              + Başka Parça Ekle
            </button>
          </div>

          <div id="usage-items-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <!-- Dynamic Rows -->
            <div class="usage-item-row" style="display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;">
              <select class="usage-comp-select" style="flex: 1; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #FFF; font-size: 0.82rem; outline: none;">
                <option value="">-- Komponent Seçin --</option>
                ${components.map(c => `
                  <option value="${c.id}" data-max="${c.quantity}" ${c.quantity <= 0 ? 'disabled' : ''}>
                    ${c.name} [${c.code}] (Stok: ${c.quantity} Ad. - ${c.shelfLocation})
                  </option>
                `).join('')}
              </select>
              <input type="number" class="usage-comp-qty" min="1" value="1" placeholder="Adet" style="width: 70px; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #14F195; font-size: 0.85rem; font-weight: 800; text-align: center;" />
              <button type="button" onclick="this.closest('.usage-item-row').remove()" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>

        </div>

        <!-- 3. CUSTOM REPAIR NOTE -->
        <div style="margin-bottom: 1.5rem;">
          <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">ONARIM & DEĞİŞİM NOTU (İSTEĞE BAĞLI)</label>
          <input type="text" id="usage-custom-note" class="cyber-input" placeholder="Örn: Giriş köprü diyotu ve 2 adet 470uF filtre kondansatörü değiştirildi, lehimler tazelendi." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
        </div>

        <!-- Action Buttons -->
        <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1.25rem;">
          <button onclick="document.getElementById('card-usage-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">İPTAL</button>
          <button id="btn-submit-card-usage" onclick="window.submitCardUsage()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.75rem 1.75rem; font-size: 0.9rem; box-shadow: 0 0 20px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-check" style="margin-right: 6px;"></i> KARTA İŞLE VE STOKTAN DÜŞ
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    (window as any)._selectedRepairForUsage = prefilledCard || null;
  };

  (window as any).searchRepairCardForUsage = () => {
    const input = document.getElementById('search-repair-card-input') as HTMLInputElement;
    const term = (input?.value || '').trim().toLowerCase();
    const allRepairs: RepairRecord[] = (window as any)._allRepairsForComponents || [];
    const verifiedBox = document.getElementById('verified-card-box');
    const notFoundAlert = document.getElementById('card-not-found-alert');
    const dropdown = document.getElementById('select-repair-card-dropdown') as HTMLSelectElement;

    if (!term) {
      if (verifiedBox) verifiedBox.style.display = 'none';
      if (notFoundAlert) notFoundAlert.style.display = 'none';
      (window as any)._selectedRepairForUsage = null;
      return;
    }

    // Match serial number or SAP in active repairs
    const match = allRepairs.find(r => {
      const isWorkshop = r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL' || r.status === 'REPAIRED';
      if (!isWorkshop) return false;
      const serial = (r.serialNo || '').trim().toLowerCase();
      const sap = (r.sapNo || '').trim().toLowerCase();
      return (serial && serial === term) || (sap && sap === term);
    });

    if (match) {
      (window as any)._selectedRepairForUsage = match;
      if (dropdown) dropdown.value = match.id || '';
      if (verifiedBox) {
        verifiedBox.style.display = 'block';
        const nameEl = document.getElementById('verified-card-name');
        const sapEl = document.getElementById('verified-card-sap');
        const serialEl = document.getElementById('verified-card-serial');
        const siteEl = document.getElementById('verified-card-site');
        const faultEl = document.getElementById('verified-card-fault');
        if (nameEl) nameEl.innerText = match.description;
        if (sapEl) sapEl.innerText = 'SAP: ' + match.sapNo;
        if (serialEl) serialEl.innerText = 'SERİ: ' + (match.serialNo || '-');
        if (siteEl) siteEl.innerText = 'Santral: ' + (match.sourceWarehouseId || '-');
        if (faultEl) faultEl.innerText = 'Arıza: ' + (match.faultCode || '-') + (match.faultDesc ? ' - ' + match.faultDesc : '');
      }
      if (notFoundAlert) notFoundAlert.style.display = 'none';
    } else {
      (window as any)._selectedRepairForUsage = null;
      if (verifiedBox) verifiedBox.style.display = 'none';
      if (notFoundAlert) notFoundAlert.style.display = 'block';
    }
  };

  (window as any).selectRepairCardFromDropdown = (repairId: string) => {
    const allRepairs: RepairRecord[] = (window as any)._allRepairsForComponents || [];
    const verifiedBox = document.getElementById('verified-card-box');
    const notFoundAlert = document.getElementById('card-not-found-alert');
    const searchInput = document.getElementById('search-repair-card-input') as HTMLInputElement;

    if (!repairId) {
      (window as any)._selectedRepairForUsage = null;
      if (verifiedBox) verifiedBox.style.display = 'none';
      if (notFoundAlert) notFoundAlert.style.display = 'none';
      return;
    }

    const match = allRepairs.find(r => r.id === repairId);
    if (match) {
      (window as any)._selectedRepairForUsage = match;
      if (searchInput) searchInput.value = match.serialNo || match.sapNo;
      if (verifiedBox) {
        verifiedBox.style.display = 'block';
        const nameEl = document.getElementById('verified-card-name');
        const sapEl = document.getElementById('verified-card-sap');
        const serialEl = document.getElementById('verified-card-serial');
        const siteEl = document.getElementById('verified-card-site');
        const faultEl = document.getElementById('verified-card-fault');
        if (nameEl) nameEl.innerText = match.description;
        if (sapEl) sapEl.innerText = 'SAP: ' + match.sapNo;
        if (serialEl) serialEl.innerText = 'SERİ: ' + (match.serialNo || '-');
        if (siteEl) siteEl.innerText = 'Santral: ' + (match.sourceWarehouseId || '-');
        if (faultEl) faultEl.innerText = 'Arıza: ' + (match.faultCode || '-') + (match.faultDesc ? ' - ' + match.faultDesc : '');
      }
      if (notFoundAlert) notFoundAlert.style.display = 'none';
    }
  };

  (window as any).addUsageComponentRow = () => {
    const container = document.getElementById('usage-items-container');
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'usage-item-row';
    row.style.cssText = 'display: flex; gap: 8px; align-items: center; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 8px; border-radius: 8px;';
    
    row.innerHTML = `
      <select class="usage-comp-select" style="flex: 1; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #FFF; font-size: 0.82rem; outline: none;">
        <option value="">-- Komponent Seçin --</option>
        ${components.map(c => `
          <option value="${c.id}" data-max="${c.quantity}" ${c.quantity <= 0 ? 'disabled' : ''}>
            ${c.name} [${c.code}] (Stok: ${c.quantity} Ad. - ${c.shelfLocation})
          </option>
        `).join('')}
      </select>
      <input type="number" class="usage-comp-qty" min="1" value="1" placeholder="Adet" style="width: 70px; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; color: #14F195; font-size: 0.85rem; font-weight: 800; text-align: center;" />
      <button type="button" onclick="this.closest('.usage-item-row').remove()" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 32px; height: 32px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center;">
        <i class="fa-solid fa-trash"></i>
      </button>
    `;

    container.appendChild(row);
  };

  (window as any).submitCardUsage = async () => {
    const selectedRepair = (window as any)._selectedRepairForUsage;
    if (!selectedRepair || !selectedRepair.id) {
      alert("Lütfen önce atölyede işlemde olan geçerli bir kart seçin veya seri numarasını doğrulayın.");
      return;
    }

    const rows = document.querySelectorAll('.usage-item-row');
    const items: Array<{ componentId: string; quantity: number }> = [];

    rows.forEach(row => {
      const select = row.querySelector('.usage-comp-select') as HTMLSelectElement;
      const qtyInput = row.querySelector('.usage-comp-qty') as HTMLInputElement;
      const compId = select?.value;
      const qty = parseInt(qtyInput?.value || '0', 10);
      if (compId && qty > 0) {
        items.push({ componentId: compId, quantity: qty });
      }
    });

    if (items.length === 0) {
      alert("Lütfen en az bir adet komponent ve geçerli miktar seçin.");
      return;
    }

    const customNote = (document.getElementById('usage-custom-note') as HTMLInputElement)?.value.trim() || '';

    const btn = document.getElementById('btn-submit-card-usage') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      const res = await workshopComponentService.useComponentsForRepair(
        selectedRepair.id,
        items,
        userEmail,
        customNote
      );

      (window as any).showToast?.('Başarılı', res.message, 'success');
      document.getElementById('card-usage-modal')?.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      alert("Hata oluştu: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = '<i class="fa-solid fa-check" style="margin-right: 6px;"></i> KARTA İŞLE VE STOKTAN DÜŞ';
      }
    }
  };

  // 5. Component Logs Modal (History of Stock Movements & Card Consumption)
  (window as any).openComponentLogsModal = async (compId?: string) => {
    const logs = await workshopComponentService.getComponentLogs(compId, 150);
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    const targetComp = compId ? components.find(c => c.id === compId) : null;

    const modal = document.createElement('div');
    modal.id = 'component-logs-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 850px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(59, 130, 246, 0.25); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; display: flex; flex-direction: column;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 1rem; flex-shrink: 0;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; color: #60a5fa; font-weight: 800;">
              <i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px;"></i>
              ${targetComp ? `${targetComp.name} (${targetComp.code}) - Hareket Geçmişi` : 'TÜM KOMPONENT HAREKET & KART HARCAMA GEÇMİŞİ'}
            </h3>
            <div style="font-size: 0.8rem; color: #94A3B8; margin-top: 2px;">
              Komponent girişleri, kart tamirlerinde kullanılan miktarlar ve stok değişimleri.
            </div>
          </div>
          <button onclick="document.getElementById('component-logs-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="flex: 1; overflow-y: auto; overflow-x: auto;" class="custom-scrollbar">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
            <thead>
              <tr style="background: rgba(255,255,255,0.03); color: #94A3B8; border-bottom: 1px solid rgba(255,255,255,0.1); position: sticky; top: 0;">
                <th style="padding: 0.75rem 1rem;">Tarih</th>
                <th style="padding: 0.75rem 1rem;">İşlem Türü</th>
                <th style="padding: 0.75rem 1rem;">Komponent</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Miktar</th>
                <th style="padding: 0.75rem 1rem;">İlgili Kart / Detay</th>
                <th style="padding: 0.75rem 1rem;">İşlem Yapan</th>
              </tr>
            </thead>
            <tbody>
              ${logs.length === 0 ? `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 2.5rem; color: #64748B;">
                    Bu parçaya ait henüz hareket kaydı bulunmuyor.
                  </td>
                </tr>
              ` : logs.map(l => {
                const isOut = l.type === 'OUT';
                const isEntry = l.type === 'IN';
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 0.75rem 1rem; color: #94A3B8; white-space: nowrap;">
                      ${formatDateTime(l.date)}
                    </td>
                    <td style="padding: 0.75rem 1rem; white-space: nowrap;">
                      ${isOut ? `
                        <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 0.72rem;">
                          ⚡ KART TAMİRİ (-)
                        </span>
                      ` : (isEntry ? `
                        <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 0.72rem;">
                          📥 STOK GİRİŞİ (+)
                        </span>
                      ` : `
                        <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 7px; border-radius: 4px; font-weight: 800; font-size: 0.72rem;">
                          DÜZELTME
                        </span>
                      `)}
                    </td>
                    <td style="padding: 0.75rem 1rem; font-weight: 700; color: #FFF;">
                      ${l.componentName} <span style="font-family: monospace; color: #00f2ff; font-size: 0.75rem;">[${l.componentCode}]</span>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center; font-family: monospace; font-weight: 900; font-size: 0.9rem; color: ${isOut ? '#EF4444' : '#14F195'};">
                      ${isOut ? '-' : '+'}${l.quantity} Ad.
                    </td>
                    <td style="padding: 0.75rem 1rem; color: #E2E8F0;">
                      ${l.note || '-'}
                    </td>
                    <td style="padding: 0.75rem 1rem; color: #94A3B8; font-size: 0.75rem; white-space: nowrap;">
                      ${l.user ? l.user.split('@')[0] : 'Sistem'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).openAllComponentLogsModal = () => {
    (window as any).openComponentLogsModal();
  };

  // 6. Delete Component
  (window as any).deleteWorkshopComponent = async (compId: string, name: string) => {
    const user = (window as any).currentUser;
    const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
    const userEmail = (user?.email || userProfile?.email || '').toLowerCase();
    const isFatihZebek = userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek') || userEmail.includes('fatihzebek');
    if (!isFatihZebek) {
      alert("Yetkisiz işlem: Komponent silme yetkisi yalnızca Fatih ZEBEK kullanıcısına aittir.");
      return;
    }

    if (!confirm(`"${name}" komponentini ve stok kaydını silmek istediğinize emin misiniz?`)) {
      return;
    }
    try {
      await workshopComponentService.deleteComponent(compId);
      (window as any).showToast?.('Başarılı', 'Komponent başarıyla silindi.', 'success');
      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (e: any) {
      alert("Silme işlemi başarısız: " + e.message);
    }
  };

  // 7. Download Excel
  (window as any).downloadComponentsExcel = () => {
    const components: WorkshopComponent[] = (window as any)._workshopComponents || [];
    if (components.length === 0) {
      alert("İndirilecek komponent verisi bulunamadı.");
      return;
    }

    const data = components.map(c => {
      const rawCode = (c.code || '').trim();
      const isUnknown = !rawCode || 
        rawCode === '-' || 
        rawCode.toLowerCase().includes('bilinmiyor') || 
        /^(CAP|RES|DIO|TRN|IC|FUS|OPT|IND|CON|KMP)-\d{4}$/i.test(rawCode);
      return {
        'Parça Kodu / SAP': isUnknown ? 'Parça Kodu Bilinmiyor' : rawCode,
        'Komponent Tanımı': c.name,
        'Kutu / Çekmece Konumu': c.shelfLocation || '-',
        'Mevcut Stok (Adet)': c.quantity || 0,
        'Kritik Min. Stok': c.minStock || 0,
        'Notlar': c.notes || ''
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komponentler');
    XLSX.writeFile(wb, `MTA_Elektronik_Komponent_Stogu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.xlsx`);
  };

  // 8. Download 4-Column Template Excel
  (window as any).downloadWorkshopComponentsTemplate = () => {
    const sampleData = [
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Potansiyometre 50K ohm',
        'Adet': 1,
        'Çekmece No': 1
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Potansiyometre 100K ohm',
        'Adet': 1,
        'Çekmece No': 1
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '680 ohm 1/2W Direnç',
        'Adet': 100,
        'Çekmece No': 1
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '680 ohm 1/4W Direnç',
        'Adet': 98,
        'Çekmece No': 1
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '500 ohm 1/2W Direnç',
        'Adet': 106,
        'Çekmece No': 1
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Sigorta yuvası (Dik)',
        'Adet': 10,
        'Çekmece No': 2
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Voltmetre Display',
        'Adet': 1,
        'Çekmece No': 2
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Dijital Termometre Arduino',
        'Adet': 1,
        'Çekmece No': 2
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Optocoupler Test Modülü',
        'Adet': 1,
        'Çekmece No': 3
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Dijital Ampermetre Hazır Devre Modülü',
        'Adet': 1,
        'Çekmece No': 3
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '0,1 uF(100nF)/1000V Kondansatör',
        'Adet': 30,
        'Çekmece No': 4
      },
      {
        'Ürün Kodu': 'SMBJ36CA',
        'Ürün Tanımı': 'E-82 Power Board Pitch Tetikleme Diyodu',
        'Adet': 41,
        'Çekmece No': 4
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': 'Balans Cihaz Malzemeleri',
        'Adet': 1,
        'Çekmece No': 5
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '150 nF 2000V Kondansatör',
        'Adet': 30,
        'Çekmece No': 6
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '10 ohm 1/2W Direnç',
        'Adet': 51,
        'Çekmece No': 6
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '4,7 ohm 1/2W Direnç',
        'Adet': 52,
        'Çekmece No': 6
      },
      {
        'Ürün Kodu': '',
        'Ürün Tanımı': '330 ohm 1/2W Direnç',
        'Adet': 101,
        'Çekmece No': 6
      }
    ];

    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komponentler');
    XLSX.writeFile(wb, 'Elektronik_Komponent_Yukleme_Sablonu.xlsx');
  };

  // 9. Bulk Upload from Excel Handler
  (window as any).uploadWorkshopComponentsFromExcel = async (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    // Reset file input value so user can upload again
    event.target.value = '';

    // Show Cyberpunk Progress Modal
    const modalHtml = `
      <div id="components-excel-upload-progress-modal" style="position: fixed; inset: 0; background: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; align-items: center; justify-content: center; z-index: 99999;">
        <div class="glass-panel" style="background: #0B101B; border: 1px solid #00f2ff; border-radius: 14px; padding: 2rem; width: 90%; max-width: 480px; text-align: center; box-shadow: 0 0 30px rgba(0,242,255,0.3);">
          <div style="font-size: 2.2rem; color: #00f2ff; margin-bottom: 0.5rem;"><i class="fa-solid fa-cloud-arrow-up fa-bounce"></i></div>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #FFF; font-weight: 800; margin: 0 0 0.5rem 0;">KOMPONENTLER AKTARILIYOR</h3>
          <p id="comp-upload-progress-status" style="color: #94A3B8; font-size: 0.88rem; margin-bottom: 1.25rem;">Excel dosyası çözümleniyor...</p>
          <div style="width: 100%; height: 12px; background: rgba(255,255,255,0.08); border-radius: 6px; overflow: hidden; border: 1px solid rgba(0,242,255,0.3); margin-bottom: 0.75rem;">
            <div id="comp-upload-progress-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #00f2ff 0%, #14F195 100%); transition: width 0.25s ease; box-shadow: 0 0 10px #00f2ff;"></div>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 800; font-family: monospace;">
            <span id="comp-upload-progress-count" style="color: #60a5fa;">0 / 0 Kalem</span>
            <span id="comp-upload-progress-percent" style="color: #14F195;">%0</span>
          </div>
        </div>
      </div>
    `;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = modalHtml;
    document.body.appendChild(tempDiv.firstElementChild!);

    const updateUIProgress = (processed: number, total: number) => {
      const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
      const bar = document.getElementById('comp-upload-progress-bar');
      const countEl = document.getElementById('comp-upload-progress-count');
      const pctEl = document.getElementById('comp-upload-progress-percent');
      const statusEl = document.getElementById('comp-upload-progress-status');
      if (bar) bar.style.width = `${pct}%`;
      if (countEl) countEl.innerText = `${processed} / ${total} Kalem`;
      if (pctEl) pctEl.innerText = `%${pct}`;
      if (statusEl) statusEl.innerText = `Veritabanına kaydediliyor (%${pct})...`;
    };

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];

      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
      if (!rawData || rawData.length === 0) {
        document.getElementById('components-excel-upload-progress-modal')?.remove();
        alert("Seçilen Excel dosyasında veri bulunamadı.");
        return;
      }

      // Helper to normalize header keys
      const normKey = (str: string) => (str || '').toString().toLowerCase()
        .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
        .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
        .replace(/[^a-z0-9]/g, '');

      // Find header row
      let headerRowIdx = 0;
      for (let r = 0; r < Math.min(10, rawData.length); r++) {
        const rowStr = (rawData[r] || []).map(c => normKey(String(c || ''))).join(' ');
        if (rowStr.includes('uruntanim') || rowStr.includes('urun') || rowStr.includes('tanim') || rowStr.includes('adet') || rowStr.includes('cekmece')) {
          headerRowIdx = r;
          break;
        }
      }

      const headerRow = (rawData[headerRowIdx] || []).map(c => String(c || '').trim());
      const dataRows = rawData.slice(headerRowIdx + 1);

      // Smart category detector
      const detectCategory = (name: string): string => {
        const n = (name || '').toLowerCase();
        if (n.includes('direnc') || n.includes('direnç') || n.includes('ohm') || n.includes('resistor') || n.includes('potansiyometre')) return 'DİRENÇ';
        if (n.includes('kondansator') || n.includes('kondansatör') || n.includes('cap') || n.includes('uf') || n.includes('nf') || n.includes('pf') || n.includes('µf')) return 'KONDANSATÖR';
        if (n.includes('diyot') || n.includes('diode') || n.includes('kopru') || n.includes('köprü') || n.includes('smbj') || n.includes('zener') || n.includes('schottky') || n.includes('1n4')) return 'DİYOT / KÖPRÜ';
        if (n.includes('igbt') || n.includes('transistor') || n.includes('transistör') || n.includes('mosfet') || n.includes('bjt')) return 'TRANSİSTÖR / IGBT';
        if (n.includes('entegre') || n.includes('ic') || n.includes('mikro') || n.includes('driver') || n.includes('opamp') || n.includes('op-amp')) return 'ENTEGRE (IC)';
        if (n.includes('role') || n.includes('röle') || n.includes('sigorta') || n.includes('fuse') || n.includes('relay')) return 'RÖLE / SİGORTA';
        if (n.includes('optokuplor') || n.includes('optokuplör') || n.includes('optocoupler') || n.includes('opto') || n.includes('optik')) return 'OPTOKUPLÖR';
        if (n.includes('trafo') || n.includes('induktor') || n.includes('indüktör') || n.includes('bobin') || n.includes('choke')) return 'TRAFO / İNDÜKTÖR';
        if (n.includes('kablo') || n.includes('konnektor') || n.includes('konnektör') || n.includes('soket') || n.includes('klemens') || n.includes('terminal')) return 'KONNEKTÖR / KABLO';
        return 'DİĞER';
      };

      // Get existing components
      const existingComponents = await workshopComponentService.getComponents(true);
      const existingCodes = new Set(existingComponents.map(c => (c.code || '').toUpperCase()));
      const existingByName = new Map(existingComponents.map(c => [c.name.trim().toLowerCase(), c]));
      const existingByCode = new Map(existingComponents.map(c => [(c.code || '').trim().toUpperCase(), c]));

      // Auto code generator
      const generateCode = (cat: string, seq: number): string => {
        let prefix = 'KMP';
        if (cat === 'DİRENÇ') prefix = 'RES';
        else if (cat === 'KONDANSATÖR') prefix = 'CAP';
        else if (cat === 'DİYOT / KÖPRÜ') prefix = 'DIO';
        else if (cat === 'TRANSİSTÖR / IGBT') prefix = 'TRN';
        else if (cat === 'ENTEGRE (IC)') prefix = 'IC';
        else if (cat === 'RÖLE / SİGORTA') prefix = 'FUS';
        else if (cat === 'OPTOKUPLÖR') prefix = 'OPT';
        else if (cat === 'TRAFO / İNDÜKTÖR') prefix = 'IND';
        else if (cat === 'KONNEKTÖR / KABLO') prefix = 'CON';

        let num = seq;
        let candidate = `${prefix}-${String(num).padStart(4, '0')}`;
        while (existingCodes.has(candidate.toUpperCase())) {
          num++;
          candidate = `${prefix}-${String(num).padStart(4, '0')}`;
        }
        existingCodes.add(candidate.toUpperCase());
        return candidate;
      };

      // Map rows
      const validItems: Array<{ code: string; name: string; category: string; quantity: number; shelfLocation: string }> = [];
      let autoSeq = existingComponents.length + 1;

      dataRows.forEach(row => {
        let rawCode = '';
        let rawName = '';
        let rawQty = 0;
        let rawDrawer = '';

        headerRow.forEach((colName, idx) => {
          const val = String(row[idx] ?? '').trim();
          const nk = normKey(colName);

          if (nk.includes('urunkod') || nk.includes('parcakod') || (nk === 'kod') || (nk === 'code')) {
            rawCode = val;
          } else if (nk.includes('uruntanim') || nk.includes('urunadi') || nk.includes('malzemeadi') || nk.includes('tanim') || nk.includes('name') || nk.includes('description') || nk.includes('aciklama')) {
            rawName = val;
          } else if (nk.includes('adet') || nk.includes('miktar') || nk.includes('stok') || nk.includes('qty') || nk.includes('quantity')) {
            const numVal = parseInt(val.replace(/[^0-9]/g, ''), 10);
            rawQty = isNaN(numVal) ? 1 : numVal;
          } else if (nk.includes('cekmece') || nk.includes('kutu') || nk.includes('raf') || nk.includes('konum') || nk.includes('location')) {
            rawDrawer = val;
          }
        });

        // Fallback positional if header didn't catch 4 columns
        if (!rawName && row.length >= 2) {
          rawCode = String(row[0] ?? '').trim();
          rawName = String(row[1] ?? '').trim();
          rawQty = parseInt(String(row[2] ?? '').replace(/[^0-9]/g, ''), 10) || 1;
          rawDrawer = String(row[3] ?? '').trim();
        }

        if (rawName) {
          const category = detectCategory(rawName);
          const finalCode = rawCode ? rawCode.trim().toUpperCase() : '';
          const shelfLocation = rawDrawer ? (rawDrawer.toLowerCase().includes('cekmece') || rawDrawer.toLowerCase().includes('çekmece') ? rawDrawer : `Çekmece No: ${rawDrawer}`) : 'Atölye Çekmecesi';
          
          validItems.push({
            code: finalCode,
            name: rawName,
            category,
            quantity: rawQty,
            shelfLocation
          });
        }
      });

      if (validItems.length === 0) {
        document.getElementById('components-excel-upload-progress-modal')?.remove();
        alert("Excel dosyasında geçerli komponent satırı bulunamadı. Lütfen 'Ürün Tanımı' ve 'Adet' kolonlarının dolu olduğundan emin olun.");
        return;
      }

      const user = (window as any).currentUser;
      const userEmail = user?.email || user?.displayName || 'Merkez Tamir Atölyesi';

      let processedCount = 0;
      const totalItems = validItems.length;
      updateUIProgress(0, totalItems);

      // Process in batches
      for (const item of validItems) {
        const existing = (item.code ? existingByCode.get(item.code) : null) || existingByName.get(item.name.toLowerCase());
        if (existing && existing.id) {
          // If already exists, add stock to existing item
          await workshopComponentService.addStock(existing.id, item.quantity, userEmail, `Excel yüklemesi ile stok girişi (+${item.quantity})`);
        } else {
          // Create new component
          await workshopComponentService.addComponent({
            code: item.code,
            name: item.name,
            category: item.category,
            value: '-',
            package: '-',
            quantity: item.quantity,
            minStock: 5,
            shelfLocation: item.shelfLocation,
            unitPrice: 0,
            notes: ''
          }, userEmail);
        }

        processedCount++;
        updateUIProgress(processedCount, totalItems);
      }

      document.getElementById('components-excel-upload-progress-modal')?.remove();
      (window as any).showToast?.('Başarılı', `${processedCount} adet elektronik komponent başarıyla yüklendi!`, 'success');

      if ((window as any).navigate) {
        (window as any).navigate('workshop-components');
      }
    } catch (err: any) {
      document.getElementById('components-excel-upload-progress-modal')?.remove();
      alert("Excel yükleme sırasında bir hata oluştu: " + err.message);
    }
  };

};

