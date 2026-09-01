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
  const isMaterialManager = userProfile?.role === 'ADMIN' || userProfile?.role === 'MALZEME_YONETIMI' || user?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || user?.email?.toLowerCase() === 'furkan.yildirim@demirerholding.com';

  const components = await workshopComponentService.getComponents(true);
  const allLogs = await workshopComponentService.getComponentLogs(undefined, 300);
  const allRepairs = await repairService.getRepairs(false);

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
                <span style="font-size: 0.8rem; color: #94A3B8;">Elektronik Komponent Stoğu</span>
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
          <button onclick="window.openCardUsageModal()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.6rem 1.25rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 0 20px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-bolt"></i> KARTA MALZEME ÇIKIŞI (İŞ EMRİ)
          </button>
          <button onclick="window.openComponentModal()" class="btn-cyber" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight: 800; padding: 0.6rem 1.15rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(59, 130, 246, 0.25)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.15)'">
            <i class="fa-solid fa-plus"></i> YENİ KOMPONENT EKLE
          </button>
          <button onclick="window.openAllComponentLogsModal()" class="btn-cyber" style="background: rgba(255, 255, 255, 0.05); color: #FFF; border: 1px solid rgba(255, 255, 255, 0.15); font-weight: 700; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(255, 255, 255, 0.1)'" onmouseout="this.style.background='rgba(255, 255, 255, 0.05)'">
            <i class="fa-solid fa-clock-rotate-left"></i> HAREKET GEÇMİŞİ
          </button>
        </div>
      </div>

      <!-- Workshop Sub-Nav Tabs -->
      <div style="display: flex; gap: 0.75rem; border-bottom: 1px solid #1E293B; margin-bottom: 1.5rem; padding-bottom: 0.5rem; overflow-x: auto;">
        <div onclick="if(window.navigate) window.navigate('workshop');" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #94A3B8; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
          <i class="fa-solid fa-screwdriver-wrench"></i> ATÖLYE TEZGAHI
        </div>
        <div onclick="if(window.navigate) window.navigate('workshop-stock');" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #94A3B8; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
          <i class="fa-solid fa-boxes-stacked"></i> KART AMBARI (RAF/KUTU)
        </div>
        <div style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #00f2ff; border: 1px solid #00f2ff; background: rgba(0, 242, 255, 0.08); border-radius: 6px; font-weight: 800; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-microchip"></i> ELEKTRONİK KOMPONENT STOĞU
        </div>
        <div onclick="if(window.navigate) window.navigate('workshop-dispatches');" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #94A3B8; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
          <i class="fa-solid fa-truck-ramp-box"></i> SEVKİYAT ARŞİVİ
        </div>
        <div onclick="if(window.navigate) window.navigate('workshop-returned');" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #94A3B8; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
          <i class="fa-solid fa-rotate-left"></i> SAĞLAM İADELER
        </div>
        <div onclick="if(window.navigate) window.navigate('workshop-scrap');" style="padding: 0.4rem 0.85rem; font-size: 0.8rem; color: #94A3B8; border-radius: 6px; font-weight: 700; cursor: pointer; white-space: nowrap; display: flex; align-items: center; gap: 6px; transition: all 0.2s;" onmouseover="this.style.color='#FFF'" onmouseout="this.style.color='#94A3B8'">
          <i class="fa-solid fa-dumpster"></i> ATÖLYE HURDALARI
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
        
        <!-- Search -->
        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap; flex: 1;">
          <div style="position: relative; min-width: 260px; flex: 1; max-width: 400px;">
            <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
            <input 
              type="text" 
              id="component-search-input" 
              class="cyber-input" 
              placeholder="Kod, Malzeme Adı, Değer veya Kutu Ara..." 
              oninput="window.filterComponentsTable()"
              style="width: 100%; height: 38px; padding: 0 1rem 0 2.2rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.85rem;"
            />
          </div>

          <!-- Category Filter Dropdown -->
          <select id="component-category-filter" onchange="window.filterComponentsTable()" style="height: 38px; padding: 0 1rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.85rem; font-weight: 600; outline: none; cursor: pointer;">
            <option value="ALL">Tüm Kategoriler (${totalItemCount})</option>
            ${COMPONENT_CATEGORIES.map(cat => {
              const catCount = components.filter(c => c.category === cat).length;
              return `<option value="${cat}">${cat} (${catCount})</option>`;
            }).join('')}
          </select>

          <!-- Critical Only Toggle Button -->
          <button id="btn-toggle-critical" onclick="window.toggleCriticalFilter()" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.08); color: #EF4444; font-size: 0.82rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;">
            <i class="fa-solid fa-triangle-exclamation"></i> Sadece Kritik Stoklar (${criticalCount})
          </button>
        </div>

        <div>
          <button onclick="window.downloadComponentsExcel()" style="height: 38px; padding: 0 1rem; border-radius: 8px; border: 1px solid rgba(0, 242, 255, 0.25); background: rgba(0, 242, 255, 0.06); color: #00f2ff; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 242, 255, 0.15)'" onmouseout="this.style.background='rgba(0, 242, 255, 0.06)'">
            <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
          </button>
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
                <th style="padding: 1rem 1.25rem;">Kategori</th>
                <th style="padding: 1rem 1.25rem;">Değer / Parametre</th>
                <th style="padding: 1rem 1.25rem;">Kılıf / Paket</th>
                <th style="padding: 1rem 1.25rem;">Kutu / Çekmece</th>
                <th style="padding: 1rem 1.25rem; text-align: center;">Mevcut Stok</th>
                <th style="padding: 1rem 1.25rem; text-align: center;">Kritik Limit</th>
                <th style="padding: 1rem 1.25rem; text-align: right;">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody id="components-tbody">
              ${components.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 3rem; color: #94A3B8; font-size: 0.9rem;">
                    <i class="fa-solid fa-microchip" style="font-size: 2rem; color: #334155; display: block; margin-bottom: 0.5rem;"></i>
                    Henüz elektronik komponent tanımlanmamış. "Yeni Komponent Ekle" butonuna basarak ilk parçanızı tanımlayabilirsiniz.
                  </td>
                </tr>
              ` : components.map(comp => {
                const qty = Number(comp.quantity || 0);
                const min = Number(comp.minStock || 0);
                const isCritical = qty <= min;
                return `
                  <tr class="component-row" 
                    data-id="${comp.id}" 
                    data-code="${(comp.code || '').toLowerCase()}" 
                    data-name="${(comp.name || '').toLowerCase()}" 
                    data-category="${comp.category || ''}" 
                    data-value="${(comp.value || '').toLowerCase()}" 
                    data-package="${(comp.package || '').toLowerCase()}" 
                    data-location="${(comp.shelfLocation || '').toLowerCase()}"
                    data-critical="${isCritical ? 'true' : 'false'}"
                    style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}; transition: background 0.2s;"
                    onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                    onmouseout="this.style.background='${isCritical ? 'rgba(239, 68, 68, 0.02)' : 'transparent'}'"
                  >
                    <td style="padding: 0.85rem 1.25rem; font-family: monospace; font-weight: 800; color: #00f2ff;">
                      ${comp.code}
                    </td>
                    <td style="padding: 0.85rem 1.25rem; font-weight: 700; color: #FFF;">
                      ${comp.name}
                      ${comp.notes ? `<div style="font-size: 0.72rem; color: #64748B; font-weight: normal; margin-top: 2px;">${comp.notes}</div>` : ''}
                    </td>
                    <td style="padding: 0.85rem 1.25rem;">
                      <span style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">
                        ${comp.category || 'DİĞER'}
                      </span>
                    </td>
                    <td style="padding: 0.85rem 1.25rem; color: #E2E8F0; font-family: monospace; font-weight: 600;">
                      ${comp.value || '-'}
                    </td>
                    <td style="padding: 0.85rem 1.25rem; color: #94A3B8; font-size: 0.8rem;">
                      ${comp.package || '-'}
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
                        <button onclick="window.deleteWorkshopComponent('${comp.id}', '${(comp.name || '').replace(/'/g, "\\'")}')" title="Komponenti Sil" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'">
                          <i class="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
};

// ==========================================
// INTERACTIVE MODALS & HANDLERS
// ==========================================
const setupComponentPageHandlers = () => {

  // 1. Filter Components Table
  (window as any).filterComponentsTable = () => {
    const searchInput = document.getElementById('component-search-input') as HTMLInputElement;
    const catSelect = document.getElementById('component-category-filter') as HTMLSelectElement;
    const term = (searchInput?.value || '').trim().toLowerCase();
    const category = catSelect?.value || 'ALL';
    const onlyCritical = (window as any)._filterOnlyCritical === true;

    const rows = document.querySelectorAll('.component-row') as NodeListOf<HTMLElement>;
    rows.forEach(row => {
      const code = row.getAttribute('data-code') || '';
      const name = row.getAttribute('data-name') || '';
      const cat = row.getAttribute('data-category') || '';
      const val = row.getAttribute('data-value') || '';
      const pkg = row.getAttribute('data-package') || '';
      const loc = row.getAttribute('data-location') || '';
      const isCritical = row.getAttribute('data-critical') === 'true';

      const matchSearch = !term || code.includes(term) || name.includes(term) || val.includes(term) || pkg.includes(term) || loc.includes(term);
      const matchCat = category === 'ALL' || cat === category;
      const matchCritical = !onlyCritical || isCritical;

      if (matchSearch && matchCat && matchCritical) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });
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

  // 2. Open Component Create / Edit Modal
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
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 580px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(0, 242, 255, 0.25); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        
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
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">PARÇA KODU / SAP NO *</label>
              <input type="text" id="comp-code" class="cyber-input" placeholder="Örn: CAP-470U-50V / 59368" value="${editingComp?.code || ''}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-transform: uppercase;" />
            </div>
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KATEGORİ *</label>
              <select id="comp-category" class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); color: #FFF;" required>
                ${COMPONENT_CATEGORIES.map(cat => `
                  <option value="${cat}" ${editingComp?.category === cat ? 'selected' : ''}>${cat}</option>
                `).join('')}
              </select>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KOMPONENT TANIMI *</label>
            <input type="text" id="comp-name" class="cyber-input" placeholder="Örn: 470µF 50V 105°C Alüminyum Elektrolitik Kondansatör" value="${editingComp?.name || ''}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">DEĞER / PARAMETRE</label>
              <input type="text" id="comp-value" class="cyber-input" placeholder="Örn: 470 µF / 50V veya 100 Ω 2W" value="${editingComp?.value || ''}" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
            </div>
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KILIF / PAKET TİPİ</label>
              <input type="text" id="comp-package" class="cyber-input" placeholder="Örn: Radial DIP 10x16mm / SMD 0805" value="${editingComp?.package || ''}" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">${isEdit ? 'MEVCUT STOK' : 'BAŞLANGIÇ STOK'} *</label>
              <input type="number" id="comp-qty" class="cyber-input" min="0" value="${editingComp ? editingComp.quantity : 0}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-weight: 800;" />
            </div>
            <div>
              <label style="display: block; color: #EF4444; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KRİTİK MİN. STOK *</label>
              <input type="number" id="comp-min-stock" class="cyber-input" min="0" value="${editingComp ? editingComp.minStock : 5}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-weight: 800; color: #EF4444;" />
            </div>
            <div>
              <label style="display: block; color: #F59E0B; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">KUTU / ÇEKMECE *</label>
              <input type="text" id="comp-location" class="cyber-input" placeholder="Örn: Kutu A-04" value="${editingComp?.shelfLocation || ''}" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); text-align: center; font-weight: 700; color: #F59E0B;" />
            </div>
          </div>

          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.8rem; margin-bottom: 0.4rem; font-weight: 700;">NOTLAR / TEDARİKÇİ / DATASHEET BİLGİSİ</label>
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
    const code = (document.getElementById('comp-code') as HTMLInputElement)?.value.trim();
    const name = (document.getElementById('comp-name') as HTMLInputElement)?.value.trim();
    const category = (document.getElementById('comp-category') as HTMLSelectElement)?.value;
    const value = (document.getElementById('comp-value') as HTMLInputElement)?.value.trim();
    const pkg = (document.getElementById('comp-package') as HTMLInputElement)?.value.trim();
    const qty = parseInt((document.getElementById('comp-qty') as HTMLInputElement)?.value || '0', 10);
    const minStock = parseInt((document.getElementById('comp-min-stock') as HTMLInputElement)?.value || '0', 10);
    const shelfLocation = (document.getElementById('comp-location') as HTMLInputElement)?.value.trim();
    const notes = (document.getElementById('comp-notes') as HTMLTextAreaElement)?.value.trim();

    if (!code || !name) {
      alert("Lütfen Parça Kodu ve Tanımı alanlarını doldurun.");
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
          category,
          value,
          package: pkg,
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
          category,
          value,
          package: pkg,
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

    const data = components.map(c => ({
      'Parça Kodu / SAP': c.code,
      'Komponent Tanımı': c.name,
      'Kategori': c.category || 'DİĞER',
      'Değer / Parametre': c.value || '-',
      'Kılıf / Paket': c.package || '-',
      'Mevcut Stok (Adet)': c.quantity || 0,
      'Kritik Min. Stok': c.minStock || 0,
      'Kutu / Çekmece Konumu': c.shelfLocation || '-',
      'Birim Fiyat': c.unitPrice || 0,
      'Notlar': c.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Komponentler');
    XLSX.writeFile(wb, `MTA_Elektronik_Komponent_Stogu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.xlsx`);
  };

};
