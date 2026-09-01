import { repairService, type RepairRecord } from '../services/RepairService';
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

export const WorkshopScrapPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Merkez Tamir Atölyesi';

  // Fetch all repair records and filter for SCRAPPED
  const allRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const scrappedRepairs: RepairRecord[] = allRepairs.filter(r => r.status === 'SCRAPPED');
  const warehouses = dataService.getWarehouses();

  (window as any)._allScrappedRepairs = scrappedRepairs;
  const searchQuery = ((window as any)._workshopScrapSearch || '').toLowerCase().trim();

  // Calculate statistics
  const totalScrappedCount = scrappedRepairs.reduce((acc, r) => acc + (r.quantity || 1), 0);
  const uniqueSapCount = new Set(scrappedRepairs.map(r => r.sapNo)).size;
  
  const now = new Date();
  const thisMonthCount = scrappedRepairs.filter(r => {
    if (!r.scrappedAt) return false;
    const d = r.scrappedAt.toDate ? r.scrappedAt.toDate() : new Date(r.scrappedAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).reduce((acc, r) => acc + (r.quantity || 1), 0);

  // Group by SAP Model
  const sapSummaryMap = new Map<string, { sapNo: string; description: string; count: number; items: RepairRecord[] }>();
  scrappedRepairs.forEach(r => {
    const sap = r.sapNo || 'Bilinmeyen';
    let g = sapSummaryMap.get(sap);
    if (!g) {
      g = { sapNo: sap, description: r.description, count: 0, items: [] };
      sapSummaryMap.set(sap, g);
    }
    g.count += (r.quantity || 1);
    g.items.push(r);
  });
  const sortedSapSummaries = Array.from(sapSummaryMap.values()).sort((a, b) => b.count - a.count);

  // Filter items
  let filtered = scrappedRepairs;
  if (searchQuery) {
    filtered = filtered.filter(r => 
      (r.sapNo || '').toLowerCase().includes(searchQuery) ||
      (r.serialNo || '').toLowerCase().includes(searchQuery) ||
      (r.description || '').toLowerCase().includes(searchQuery) ||
      (r.scrapReason || '').toLowerCase().includes(searchQuery) ||
      (r.scrappedBy || '').toLowerCase().includes(searchQuery) ||
      (r.faultCode || '').toLowerCase().includes(searchQuery) ||
      (r.faultDesc || '').toLowerCase().includes(searchQuery)
    );
  }

  // Sort by scrappedAt desc
  filtered = [...filtered].sort((a, b) => {
    const tA = a.scrappedAt?.toDate ? a.scrappedAt.toDate().getTime() : new Date(a.scrappedAt || 0).getTime();
    const tB = b.scrappedAt?.toDate ? b.scrappedAt.toDate().getTime() : new Date(b.scrappedAt || 0).getTime();
    return tB - tA;
  });

  // Global functions
  (window as any).triggerWorkshopScrapSearch = () => {
    const input = document.getElementById('workshop-scrap-search-input') as HTMLInputElement;
    (window as any)._workshopScrapSearch = input?.value || '';
    if ((window as any).navigate) (window as any).navigate('workshop-scrap');
  };

  (window as any).restoreScrapToRepair = async (repairId: string) => {
    if (!confirm('Bu kartı hurda listesinden çıkarıp tekrar Kart Tamir Masasına (Teşhis aşamasına) geri almak istiyor musunuz?')) {
      return;
    }
    try {
      (window as any).showToast?.('İşlem', 'Kart tamir masasına geri alınıyor...', 'info');
      await repairService.restoreScrapToRepair(repairId);
      await repairService.assignTechnician(repairId, username);
      (window as any).showToast?.('Başarılı', 'Kart hurda kaydından çıkarıldı ve tamir masasına aktarıldı.', 'success');
      if ((window as any).navigate) (window as any).navigate('workshop-scrap');
    } catch(err) {
      console.error(err);
      alert('İşlem gerçekleştirilemedi.');
    }
  };

  (window as any).exportScrappedExcel = () => {
    try {
      const data = scrappedRepairs.map((r, i) => {
        const sourceWh = warehouses.find(w => w.id === r.sourceWarehouseId)?.name || r.sourceWarehouseId || '-';
        return {
          'No': i + 1,
          'SAP No': r.sapNo,
          'Seri No': r.serialNo || '-',
          'Malzeme Tanımı': r.description,
          'Miktar': r.quantity || 1,
          'Geldiği Santral': sourceWh,
          'Geliş Tarihi': formatDateTime(r.sentAt),
          'Arıza Kodu / Tanımı': `${r.faultCode || '-'} ${r.faultDesc ? `(${r.faultDesc})` : ''}`,
          'Hurdaya Ayıran': r.scrappedBy || '-',
          'Hurda Tarihi': formatDateTime(r.scrappedAt),
          'Hurda Gerekçesi / Nedeni': r.scrapReason || r.repairNotes || '-'
        };
      });

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Hurdaya Ayrılanlar");
      XLSX.writeFile(wb, `Hurdaya_Ayrilan_Kartlar_${new Date().toISOString().slice(0,10)}.xlsx`);
      (window as any).showToast?.('Başarılı', 'Hurda listesi Excel formatında indirildi.', 'success');
    } catch (e: any) {
      console.error("Excel export error:", e);
      alert("Excel oluşturulurken bir hata oluştu.");
    }
  };

  return `
    <div class="fade-in-up content-area">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #EF4444; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-dumpster-fire" style="margin-right: 0.5rem; color: #EF4444;"></i> HURDAYA AYRILANLAR
            </h2>
            <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px;">
              TAMİR EDİLEMEZ HURDA KART ENVANTERİ
            </span>
          </div>
          <p style="color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.88rem;">
            Onarımı teknik veya ekonomik olarak mümkün olmayan, hurdaya ayrılmış arızalı kartların arşiv ve döküm paneli.
          </p>
        </div>
        
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
          <button onclick="window.exportScrappedExcel()" class="btn-cyber" style="background: rgba(34, 197, 94, 0.15); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.35); padding: 0 1.1rem; border-radius: 8px; height: 40px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(34, 197, 94, 0.25)'" onmouseout="this.style.background='rgba(34, 197, 94, 0.15)'">
            <i class="fa-solid fa-file-excel"></i> HURDA LİSTESİNİ İNDİR (EXCEL)
          </button>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); padding: 0 1.1rem; border-radius: 8px; height: 40px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-microchip"></i> KART TAMİR MERKEZİNE DÖN
          </button>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        
        <div class="glass-panel" style="padding: 1.15rem; border-radius: 12px; border-left: 4px solid #EF4444; display: flex; align-items: center; gap: 1rem; background: rgba(239, 68, 68, 0.04);">
          <div style="background: rgba(239, 68, 68, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #EF4444; font-size: 1.3rem;">
            <i class="fa-solid fa-dumpster-fire"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${totalScrappedCount}</div>
            <div style="font-size: 0.75rem; color: #f87171; font-weight: 700; text-transform: uppercase;">Toplam Hurda Kart</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.15rem; border-radius: 12px; border-left: 4px solid #F59E0B; display: flex; align-items: center; gap: 1rem; background: rgba(245, 158, 11, 0.04);">
          <div style="background: rgba(245, 158, 11, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.3rem;">
            <i class="fa-solid fa-layer-group"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${uniqueSapCount}</div>
            <div style="font-size: 0.75rem; color: #fbbf24; font-weight: 700; text-transform: uppercase;">Farklı Hurda Modeli</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.15rem; border-radius: 12px; border-left: 4px solid #3B82F6; display: flex; align-items: center; gap: 1rem; background: rgba(59, 130, 246, 0.04);">
          <div style="background: rgba(59, 130, 246, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3B82F6; font-size: 1.3rem;">
            <i class="fa-regular fa-calendar-check"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${thisMonthCount}</div>
            <div style="font-size: 0.75rem; color: #60a5fa; font-weight: 700; text-transform: uppercase;">Bu Ay Hurdaya Ayrılan</div>
          </div>
        </div>

      </div>

      <!-- Search & Filters Toolbar -->
      <div class="glass-panel" style="padding: 1rem 1.25rem; border-radius: 12px; margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.75rem; border: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap;">
        <div style="position: relative; flex: 1; min-width: 250px;">
          <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.82rem;"></i>
          <input type="text" id="workshop-scrap-search-input" class="cyber-input" placeholder="SAP, Seri No, Malzeme, Hurda Nedeni veya Teknisyen ara..." value="${searchQuery}" style="width: 100%; padding: 0.55rem 1rem 0.55rem 34px; background: rgba(0,0,0,0.4); font-size: 0.82rem; border-radius: 6px;" onkeydown="if(event.key==='Enter') window.triggerWorkshopScrapSearch()" />
        </div>
        <button onclick="window.triggerWorkshopScrapSearch()" class="btn-cyber" style="background: linear-gradient(135deg, #EF4444 0%, #dc2626 100%); color: #FFF; font-weight: 800; border: none; padding: 0.55rem 1.2rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; display: flex; align-items: center; gap: 4px;">
          <i class="fa-solid fa-magnifying-glass"></i> ARA
        </button>
        ${searchQuery ? `
          <button onclick="window._workshopScrapSearch=''; window.navigate('workshop-scrap');" class="btn-cyber" style="background: rgba(255,255,255,0.08); color: #94A3B8; padding: 0.55rem 0.9rem; border-radius: 6px; font-size: 0.78rem; font-weight: 700; cursor: pointer;">
            Filtreyi Temizle
          </button>
        ` : ''}
      </div>

      <!-- Scrapped Cards Table -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; overflow-x: auto; border: 1px solid rgba(255,255,255,0.06);">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main);">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); font-size: 0.8rem; text-align: left;">
              <th style="padding: 0.75rem; min-width: 260px;">Hurda Kart / Malzeme</th>
              <th style="padding: 0.75rem; width: 160px; white-space: nowrap;">Geldiği Santral</th>
              <th style="padding: 0.75rem; width: 170px; white-space: nowrap;">Hurda Tarihi & Teknisyen</th>
              <th style="padding: 0.75rem; min-width: 250px;">Hurda Gerekçesi / Nedeni</th>
              <th style="padding: 0.75rem; text-align: right; width: 140px; white-space: nowrap;">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            ${filtered.length === 0 ? `
              <tr>
                <td colspan="5" style="text-align: center; padding: 3.5rem 1rem; color: #64748B;">
                  <div style="font-size: 1.8rem; margin-bottom: 0.5rem; opacity: 0.5;"><i class="fa-solid fa-dumpster"></i></div>
                  <div>Hurdaya ayrılmış herhangi bir kart kaydı bulunamadı.</div>
                </td>
              </tr>
            ` : filtered.map(rep => {
              const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || '-';
              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                  
                  <!-- Malzeme & SAP & Seri -->
                  <td style="padding: 0.85rem 0.75rem;">
                    <div style="font-weight: 800; color: #FFF; font-size: 0.92rem; font-family: 'Rajdhani', sans-serif;">
                      ${rep.description}
                    </div>
                    <div style="font-size: 0.76rem; color: #94A3B8; margin-top: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                      <span style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 800;">
                        SAP: ${rep.sapNo}
                      </span>
                      <span style="background: rgba(255, 255, 255, 0.05); color: #CBD5E1; border: 1px solid rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-weight: 800;">
                        Seri: ${rep.serialNo || '-'}
                      </span>
                      <span style="color: #EF4444; font-weight: 700;">
                        ${rep.quantity || 1} Adet Hurda
                      </span>
                    </div>
                    ${rep.faultCode && rep.faultCode !== '-' ? `
                      <div style="font-size: 0.72rem; color: #F59E0B; margin-top: 3px;">
                        <i class="fa-solid fa-triangle-exclamation"></i> Geliş Arızası: ${rep.faultCode} ${rep.faultDesc ? `(${rep.faultDesc})` : ''}
                      </div>
                    ` : ''}
                  </td>

                  <!-- Kaynak Santral -->
                  <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
                    <div style="font-weight: 700; color: #E2E8F0; font-size: 0.82rem; display: flex; align-items: center; gap: 5px;">
                      <i class="fa-solid fa-warehouse" style="color: #94A3B8; font-size: 0.75rem;"></i>
                      <span>${sourceWh}</span>
                    </div>
                    <div style="font-size: 0.72rem; color: #64748B; margin-top: 3px;">
                      Geliş: ${formatDateTime(rep.sentAt)}
                    </div>
                  </td>

                  <!-- Hurda Tarihi & Yetkili -->
                  <td style="padding: 0.85rem 0.75rem; white-space: nowrap;">
                    <div style="font-weight: 700; color: #f87171; font-size: 0.82rem;">
                      <i class="fa-solid fa-calendar-xmark" style="margin-right: 4px;"></i> ${formatDateTime(rep.scrappedAt)}
                    </div>
                    <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 3px;">
                      <i class="fa-solid fa-user-gear" style="margin-right: 3px;"></i> ${rep.scrappedBy || username}
                    </div>
                  </td>

                  <!-- Hurda Gerekçesi & Görsel -->
                  <td style="padding: 0.85rem 0.75rem;">
                    <div style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 6px; padding: 6px 10px; font-size: 0.78rem; color: #fca5a5; line-height: 1.4;">
                      <i class="fa-solid fa-circle-exclamation" style="margin-right: 4px; color: #EF4444;"></i>
                      <strong>Hurda Sebebi:</strong> ${rep.scrapReason || rep.repairNotes || 'Tamir edilemez arıza tespit edildi.'}
                    </div>
                    ${(rep.scrapImageUrl || rep.repairImageUrl) ? `
                      <div style="margin-top: 6px; display: flex; align-items: center; gap: 6px;">
                        <img src="${rep.scrapImageUrl || rep.repairImageUrl}" style="width: 44px; height: 44px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); cursor: pointer;" onclick="window.open('${rep.scrapImageUrl || rep.repairImageUrl}', '_blank')" title="Büyütmek için tıklayın" />
                        <span style="font-size: 0.72rem; color: #f87171; font-weight: 700;"><i class="fa-solid fa-camera"></i> Hasar Görseli</span>
                      </div>
                    ` : ''}
                  </td>

                  <!-- Aksiyonlar -->
                  <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
                    <button onclick="window.restoreScrapToRepair('${rep.id}')" class="btn-cyber" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Yanlışlıkla hurdaya ayrıldıysa tamir masasına geri al">
                      <i class="fa-solid fa-rotate-left"></i> Tamire Geri Al
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
};
