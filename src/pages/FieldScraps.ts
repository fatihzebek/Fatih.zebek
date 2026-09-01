import { warehouseService, type FieldScrapRecord } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import * as XLSX from 'xlsx';

const formatDateTime = (dateVal: any): string => {
  if (!dateVal) return '-';
  const date = dateVal.toDate ? dateVal.toDate() : new Date(dateVal);
  if (isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const FieldScrapsPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Yetkili';
  const isAdmin = user?.role === 'ADMIN' || (user?.email || '').toLowerCase().includes('fatih.zebek');

  // Fetch all field scrap records
  const allScraps: FieldScrapRecord[] = await warehouseService.getFieldScraps();
  const warehouses = dataService.getWarehouses();

  (window as any)._allFieldScraps = allScraps;
  const selectedWarehouse = (window as any)._fieldScrapWarehouseFilter || 'ALL';
  const searchQuery = ((window as any)._fieldScrapSearch || '').toLowerCase().trim();

  // Filter by warehouse
  let filtered = allScraps;
  if (selectedWarehouse !== 'ALL') {
    filtered = filtered.filter(s => s.warehouseId === selectedWarehouse || s.warehouseName?.toLowerCase().includes(selectedWarehouse.toLowerCase()));
  }

  // Filter by search query
  if (searchQuery) {
    filtered = filtered.filter(s =>
      (s.sapNo || '').toLowerCase().includes(searchQuery) ||
      (s.serialNo || '').toLowerCase().includes(searchQuery) ||
      (s.description || '').toLowerCase().includes(searchQuery) ||
      (s.warehouseName || '').toLowerCase().includes(searchQuery) ||
      (s.turbine || '').toLowerCase().includes(searchQuery) ||
      (s.reportNo || '').toLowerCase().includes(searchQuery) ||
      (s.mcfNo || '').toLowerCase().includes(searchQuery) ||
      (s.scrapReason || '').toLowerCase().includes(searchQuery) ||
      (s.scrappedBy || '').toLowerCase().includes(searchQuery) ||
      (s.faultCode || '').toLowerCase().includes(searchQuery) ||
      (s.faultDesc || '').toLowerCase().includes(searchQuery)
    );
  }

  // Calculate statistics
  const totalScrapQty = filtered.reduce((acc, s) => acc + (s.quantity || 1), 0);
  const uniqueSapCount = new Set(filtered.map(s => s.sapNo)).size;
  const uniqueSitesCount = new Set(filtered.map(s => s.warehouseName || s.warehouseId)).size;

  const now = new Date();
  const thisMonthQty = filtered.filter(s => {
    if (!s.scrappedAt) return false;
    const d = s.scrappedAt.toDate ? s.scrappedAt.toDate() : new Date(s.scrappedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((acc, s) => acc + (s.quantity || 1), 0);

  // Group by SAP for analytical breakdown
  const sapSummaryMap = new Map<string, { sapNo: string; description: string; count: number; warehouses: Set<string> }>();
  filtered.forEach(s => {
    const sap = s.sapNo || 'Bilinmeyen';
    let g = sapSummaryMap.get(sap);
    if (!g) {
      g = { sapNo: sap, description: s.description, count: 0, warehouses: new Set() };
      sapSummaryMap.set(sap, g);
    }
    g.count += (s.quantity || 1);
    g.warehouses.add(s.warehouseName || s.warehouseId);
  });

  // Window functions for interactivity
  (window as any).onFieldScrapWarehouseChange = (val: string) => {
    (window as any)._fieldScrapWarehouseFilter = val;
    if ((window as any).navigate) (window as any).navigate('field-scraps');
  };

  (window as any).onFieldScrapSearch = () => {
    const input = document.getElementById('field-scrap-search-input') as HTMLInputElement;
    (window as any)._fieldScrapSearch = input?.value || '';
    if ((window as any).navigate) (window as any).navigate('field-scraps');
  };

  (window as any).exportFieldScrapsExcel = () => {
    try {
      const dataToExport = filtered.map((s, idx) => ({
        'Sıra No': idx + 1,
        'Hurda Tarihi': formatDateTime(s.scrappedAt),
        'Saha / Depo': s.warehouseName || s.warehouseId,
        'Sökülen Türbin': s.turbine || '-',
        'Rapor No': s.reportNo || '-',
        'MCF No': s.mcfNo || '-',
        'SAP No': s.sapNo,
        'Seri No': s.serialNo || '-',
        'Malzeme Tanımı': s.description,
        'Miktar (Adet)': s.quantity || 1,
        'Arıza Kodu / Nedeni': s.faultCode ? `${s.faultCode} ${s.faultDesc ? '- ' + s.faultDesc : ''}` : '-',
        'Hurda Gerekçesi': s.scrapReason,
        'Hurdaya Ayıran': s.scrappedBy
      }));

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Saha Hurda Malzemeleri');
      
      const fileName = `Sahalardan_Cikan_Hurda_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      (window as any).showToast?.('Başarılı', 'Hurda listesi Excel formatında indirildi.', 'success');
    } catch (err: any) {
      console.error(err);
      alert('Excel dışa aktarılırken hata oluştu.');
    }
  };

  (window as any).deleteFieldScrapItem = async (scrapId: string) => {
    if (!confirm('Bu hurda kaydını sistemden silmek istediğinize emin misiniz?')) return;
    try {
      await warehouseService.deleteFieldScrap(scrapId);
      (window as any).showToast?.('Başarılı', 'Hurda kaydı silindi.', 'success');
      if ((window as any).navigate) (window as any).navigate('field-scraps');
    } catch (err: any) {
      console.error(err);
      alert('Kayıt silinirken hata oluştu.');
    }
  };

  return `
    <div class="field-scraps-container" style="padding: 1.5rem; font-family: 'Rajdhani', sans-serif; color: #FFF;">
      
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.35); display: flex; align-items: center; justify-content: center; color: #EF4444; font-size: 1.25rem;">
              <i class="fa-solid fa-dumpster"></i>
            </div>
            <div>
              <h1 style="margin: 0; font-size: 1.5rem; font-weight: 800; letter-spacing: 0.5px; background: linear-gradient(135deg, #FFF 0%, #E2E8F0 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
                SAHALARDAN ÇIKAN HURDA MALZEMELER
              </h1>
              <p style="margin: 2px 0 0 0; color: #94A3B8; font-size: 0.85rem; font-family: 'Inter', sans-serif;">
                Saha depolarında sökülen ve tamiri mümkün olmayıp hurdaya ayrılan malzemelerin merkezi takip ve raporlama paneli
              </p>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px;">
          <button onclick="window.exportFieldScrapsExcel()" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 800; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 12px rgba(16,185,129,0.25);">
            <i class="fa-solid fa-file-excel"></i> Excel İndir
          </button>
        </div>
      </div>

      <!-- KPI CARDS -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div style="background: #0D121F; border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 12px; padding: 1.25rem; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 4rem; color: rgba(239, 68, 68, 0.05); pointer-events: none;">
            <i class="fa-solid fa-dumpster"></i>
          </div>
          <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 700; text-transform: uppercase;">TOPLAM HURDA ADEDİ</div>
          <div style="font-size: 2rem; font-weight: 900; color: #EF4444; margin-top: 4px;">
            ${totalScrapQty} <span style="font-size: 1rem; color: #94A3B8; font-weight: 600;">Adet</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Filtrelenen sahalardaki tüm hurda kayıtları</div>
        </div>

        <div style="background: #0D121F; border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 12px; padding: 1.25rem; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 4rem; color: rgba(59, 130, 246, 0.05); pointer-events: none;">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 700; text-transform: uppercase;">HURDA ÇEŞİDİ</div>
          <div style="font-size: 2rem; font-weight: 900; color: #60A5FA; margin-top: 4px;">
            ${uniqueSapCount} <span style="font-size: 1rem; color: #94A3B8; font-weight: 600;">Farklı SAP</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Farklı hurda malzeme kalemi</div>
        </div>

        <div style="background: #0D121F; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 12px; padding: 1.25rem; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 4rem; color: rgba(245, 158, 11, 0.05); pointer-events: none;">
            <i class="fa-solid fa-warehouse"></i>
          </div>
          <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 700; text-transform: uppercase;">HURDA ÇIKARAN SAHALAR</div>
          <div style="font-size: 2rem; font-weight: 900; color: #F59E0B; margin-top: 4px;">
            ${uniqueSitesCount} <span style="font-size: 1rem; color: #94A3B8; font-weight: 600;">Saha</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Hurda bildiriminde bulunan lokasyonlar</div>
        </div>

        <div style="background: #0D121F; border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 12px; padding: 1.25rem; position: relative; overflow: hidden;">
          <div style="position: absolute; right: -10px; bottom: -10px; font-size: 4rem; color: rgba(20, 241, 149, 0.05); pointer-events: none;">
            <i class="fa-solid fa-calendar-check"></i>
          </div>
          <div style="font-size: 0.8rem; color: #94A3B8; font-weight: 700; text-transform: uppercase;">BU AY ÇIKAN HURDA</div>
          <div style="font-size: 2rem; font-weight: 900; color: #14F195; margin-top: 4px;">
            ${thisMonthQty} <span style="font-size: 1rem; color: #94A3B8; font-weight: 600;">Adet</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">Bu ay içerisinde ayrılan hurdalar</div>
        </div>

      </div>

      <!-- FILTER & SEARCH BAR -->
      <div style="background: #0D121F; border: 1px solid #1E293B; border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
        
        <!-- Warehouse Dropdown -->
        <div style="flex: 1; min-width: 200px;">
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; font-weight: 700; margin-bottom: 4px;">🏢 SAHA / DEPO SEÇİMİ:</label>
          <select onchange="window.onFieldScrapWarehouseChange(this.value)" style="width: 100%; box-sizing: border-box; background: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFF; padding: 8px 12px; font-size: 0.85rem; font-weight: 700; outline: none; cursor: pointer;">
            <option value="ALL" ${selectedWarehouse === 'ALL' ? 'selected' : ''}>🌍 Tüm Sahalar (${allScraps.length} Kayıt)</option>
            ${warehouses.map(wh => `
              <option value="${wh.id}" ${selectedWarehouse === wh.id ? 'selected' : ''}>${wh.name}</option>
            `).join('')}
          </select>
        </div>

        <!-- Search Box -->
        <div style="flex: 2; min-width: 260px;">
          <label style="display: block; font-size: 0.75rem; color: #94A3B8; font-weight: 700; margin-bottom: 4px;">🔍 MALZEME / SERİ NO / TÜRBİN ARA:</label>
          <div style="position: relative;">
            <input type="text" id="field-scrap-search-input" value="${(window as any)._fieldScrapSearch || ''}" placeholder="SAP No, Malzeme Tanımı, Seri No, Türbin No, Rapor No, Ayıran..." oninput="window.onFieldScrapSearch()" style="width: 100%; box-sizing: border-box; background: #0A0E17; border: 1px solid #334155; border-radius: 8px; color: #FFF; padding: 8px 12px 8px 36px; font-size: 0.85rem; outline: none;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B;"></i>
            ${searchQuery ? `
              <i class="fa-solid fa-xmark" onclick="document.getElementById('field-scrap-search-input').value=''; window.onFieldScrapSearch();" style="position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: #EF4444; cursor: pointer;"></i>
            ` : ''}
          </div>
        </div>

      </div>

      <!-- MAIN DATA TABLE -->
      <div style="background: #0D121F; border: 1px solid #1E293B; border-radius: 12px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        
        <div style="padding: 1rem 1.25rem; border-bottom: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.01);">
          <div style="font-weight: 800; font-size: 0.95rem; color: #FFF; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-table-list" style="color: #EF4444;"></i>
            <span>Saha Hurda Malzeme Kayıtları</span>
            <span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 12px; font-size: 0.72rem; font-weight: 800;">
              ${filtered.length} Kalem
            </span>
          </div>
        </div>

        ${filtered.length === 0 ? `
          <div style="text-align: center; padding: 4rem 2rem; color: #64748B;">
            <div style="font-size: 3.5rem; margin-bottom: 1rem; color: rgba(255,255,255,0.1);">
              <i class="fa-solid fa-dumpster"></i>
            </div>
            <div style="font-size: 1.1rem; font-weight: 700; color: #94A3B8;">Kayıtlı Hurda Malzeme Bulunamadı</div>
            <div style="font-size: 0.8rem; margin-top: 4px;">Saha depolarından 'Defect Listesi ➔ Seçilenleri Hurdaya Ayır' işlemi yapıldığında kayıtlar anında burada listelenecektir.</div>
          </div>
        ` : `
          <div style="overflow-x: auto; max-height: 650px;" class="custom-scrollbar">
            <table style="width: 100%; min-width: 1250px; border-collapse: collapse; text-align: left; font-size: 0.84rem;">
              <thead>
                <tr style="background: #0A0E17; border-bottom: 1px solid #1E293B; color: #94A3B8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.5px;">
                  <th style="padding: 12px 14px; width: 45px; text-align: center;">#</th>
                  <th style="padding: 12px 14px; width: 140px; white-space: nowrap;">Tarih</th>
                  <th style="padding: 12px 14px; width: 150px; white-space: nowrap;">Saha / Depo</th>
                  <th style="padding: 12px 14px; width: 130px; white-space: nowrap;">Türbin / Rapor</th>
                  <th style="padding: 12px 14px; width: 100px; white-space: nowrap;">SAP No</th>
                  <th style="padding: 12px 14px; width: 120px; white-space: nowrap;">Seri No</th>
                  <th style="padding: 12px 14px; min-width: 200px;">Malzeme Tanımı</th>
                  <th style="padding: 12px 14px; width: 140px;">Arıza Nedeni</th>
                  <th style="padding: 12px 14px; width: 100px; text-align: center; white-space: nowrap;">Miktar</th>
                  <th style="padding: 12px 14px; min-width: 200px;">Hurda Gerekçesi</th>
                  <th style="padding: 12px 14px; width: 160px; white-space: nowrap;">Ayıran Kişi</th>
                  ${isAdmin ? `<th style="padding: 12px 14px; width: 60px; text-align: center;">İşlem</th>` : ''}
                </tr>
              </thead>
              <tbody>
                ${filtered.map((s, idx) => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); background: ${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.04)'" onmouseout="this.style.background='${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}'">
                    
                    <td style="padding: 12px 14px; text-align: center; color: #64748B; font-weight: bold;">
                      ${idx + 1}
                    </td>

                    <td style="padding: 12px 14px; color: #E2E8F0; font-size: 0.8rem; white-space: nowrap;">
                      <i class="fa-regular fa-clock" style="color: #64748B; margin-right: 4px; font-size: 0.72rem;"></i>
                      ${formatDateTime(s.scrappedAt)}
                    </td>

                    <td style="padding: 12px 14px; white-space: nowrap;">
                      <span style="background: rgba(59, 130, 246, 0.15); color: #60A5FA; border: 1px solid rgba(59, 130, 246, 0.3); padding: 4px 10px; border-radius: 6px; font-size: 0.78rem; font-weight: 800; display: inline-block;">
                        🏢 ${s.warehouseName || s.warehouseId}
                      </span>
                    </td>

                    <td style="padding: 12px 14px; font-size: 0.78rem; white-space: nowrap;">
                      <div style="font-weight: 700; color: #F59E0B; display: flex; align-items: center; gap: 4px;">
                        ${s.turbine && s.turbine !== '-' ? `<i class="fa-solid fa-fan" style="font-size: 0.7rem;"></i> ${s.turbine}` : '<span style="color: #64748B; font-style: italic; font-size: 0.75rem;">Manuel Depo Girişi</span>'}
                      </div>
                      ${s.reportNo && s.reportNo !== '-' ? `<div style="font-family: monospace; color: #94A3B8; font-size: 0.72rem; margin-top: 2px;">Rpr: ${s.reportNo}</div>` : ''}
                      ${s.mcfNo && s.mcfNo !== '-' ? `<div style="font-family: monospace; color: #64748B; font-size: 0.72rem;">MCF: ${s.mcfNo}</div>` : ''}
                    </td>

                    <td style="padding: 12px 14px; font-family: monospace; font-weight: 800; font-size: 0.88rem; color: #38BDF8; white-space: nowrap;">
                      ${s.sapNo}
                    </td>

                    <td style="padding: 12px 14px; font-family: monospace; font-weight: 700; font-size: 0.8rem; color: ${s.serialNo && s.serialNo !== '-' ? '#10B981' : '#64748B'}; white-space: nowrap;">
                      ${s.serialNo || '-'}
                    </td>

                    <td style="padding: 12px 14px; font-weight: 600; color: #FFF; font-size: 0.85rem;">
                      <div>${s.description}</div>
                    </td>

                    <td style="padding: 12px 14px; color: #94A3B8; font-size: 0.78rem;">
                      ${s.faultCode && s.faultCode !== '-' ? `
                        <div style="font-weight: 700; color: #F87171;">${s.faultCode}</div>
                      ` : ''}
                      ${s.faultDesc && s.faultDesc !== '-' ? `
                        <div style="color: #64748B; font-size: 0.72rem;">${s.faultDesc}</div>
                      ` : (s.faultCode && s.faultCode !== '-' ? '' : '-')}
                    </td>

                    <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
                      <span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: monospace; font-size: 0.85rem; display: inline-block; white-space: nowrap; line-height: 1.2;">
                        ${s.quantity || 1} Adet
                      </span>
                    </td>

                    <td style="padding: 12px 14px; font-size: 0.78rem; color: #FCD34D;">
                      <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.2); padding: 6px 10px; border-radius: 6px; border-left: 3px solid #F59E0B; line-height: 1.4;">
                        "${s.scrapReason || 'Gerekçe belirtilmedi'}"
                      </div>
                    </td>

                    <td style="padding: 12px 14px; font-size: 0.78rem; color: #94A3B8; white-space: nowrap;">
                      <div style="font-weight: 700; color: #E2E8F0;">${s.scrappedBy}</div>
                    </td>

                    ${isAdmin ? `
                      <td style="padding: 12px 14px; text-align: center; white-space: nowrap;">
                        <button onclick="window.deleteFieldScrapItem('${s.id}')" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #EF4444; cursor: pointer; padding: 6px 10px; border-radius: 6px; transition: all 0.2s;" onmouseover="this.style.background='rgba(239, 68, 68, 0.25)'" onmouseout="this.style.background='rgba(239, 68, 68, 0.1)'" title="Hurda Kaydını Sil">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      </td>
                    ` : ''}

                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

    </div>
  `;
};
