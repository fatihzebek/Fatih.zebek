import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { workshopComponentService } from '../services/WorkshopComponentService';
import { warehouseService } from '../services/WarehouseService';

// Helper to format shelf number
const formatShelfNo = (rawShelf?: string | null): string => {
  if (!rawShelf || rawShelf === '-' || rawShelf.trim() === '') return '-';
  const trimmed = rawShelf.trim().toUpperCase();
  const match = trimmed.match(/^([A-ZÇĞİÖŞÜ]+)[\s\-_]*(\d+)$/i);
  if (match) {
    const letters = match[1].toUpperCase();
    const num = parseInt(match[2], 10);
    const paddedNum = num < 10 ? `0${num}` : `${num}`;
    return `${letters}-${paddedNum}`;
  }
  return trimmed;
};

// Helper to format date-time
const formatDateTime = (val: any): string => {
  if (!val) return '-';
  try {
    const d = val?.toDate ? val.toDate() : new Date(val);
    if (isNaN(d.getTime())) return '-';
    return d.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
};

// Helper to generate unique MTA serial numbers
export const generateMtaSerialNo = (sapNo: string, allRepairs: RepairRecord[]): string => {
  const cleanSap = (sapNo || 'CARD').trim();
  const prefix = `MTA-${cleanSap}-`;
  let maxSeq = 0;
  allRepairs.forEach(r => {
    if (r.serialNo && r.serialNo.toUpperCase().startsWith(prefix.toUpperCase())) {
      const numPart = r.serialNo.toUpperCase().replace(prefix.toUpperCase(), '').trim();
      const num = parseInt(numPart, 10);
      if (!isNaN(num) && num > maxSeq) {
        maxSeq = num;
      }
    }
  });
  const nextSeq = String(maxSeq + 1).padStart(3, '0');
  return `MTA-${cleanSap}-${nextSeq}`;
};

export const WorkshopDashboardPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Merkez Tamir Atölyesi';

  const repairs = await repairService.getRepairs(true);
  const warehouses = dataService.getWarehouses();

  (window as any)._allRepairs = repairs;
  (window as any)._warehouses = warehouses;

  // Key Counts
  const pendingArrivals = repairs.filter(r => r.status === 'PENDING_ARRIVAL');
  const pendingArrivalCount = pendingArrivals.length;

  // Masada Aktif Onarımda Olan Kartlar (İş emri açılmış)
  const activeWorkOrders = repairs.filter(r => 
    r.status === 'UNDER_REPAIR' && ((!!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-') || !!r.repairStage)
  );
  const underRepairCount = activeWorkOrders.length;

  // Tamir Bekleyen Atölye Stoğu (Henüz masaya alınmamış kart stoğu)
  const waitingStock = repairs.filter(r => 
    r.status === 'UNDER_REPAIR' && (!r.assignedTo || r.assignedTo.trim() === '' || r.assignedTo === '-') && !r.repairStage
  );
  const waitingStockCount = waitingStock.length;

  const repairedCount = repairs.filter(r => r.status === 'REPAIRED').length;
  const completedCount = repairs.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED').length;
  const dispatchedPendingCount = repairs.filter(r => r.status === 'SENT_BACK').length;

  const isNoSerial = (r: RepairRecord) => !r.serialNo || r.serialNo.trim() === '' || r.serialNo === '-' || r.serialNo.toLowerCase() === 'yok' || r.serialNo.toLowerCase() === 'tanımsız';
  const noSerialCount = repairs.filter(r => (r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL') && isNoSerial(r)).length;

  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const isManagerOrAdmin = userProfile?.role === 'ADMIN' || 
                           userProfile?.role === 'MALZEME_YONETIMI' || 
                           user?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || 
                           user?.email?.toLowerCase() === 'fatih.zebek@demirerholding.com';

  setupDashboardHandlers(repairs, warehouses, username);

  return `
  <div class="fade-in-up content-area workshop-dashboard-root" style="
    max-width: 1300px; 
    margin: 0 auto 2.5rem auto; 
    padding: 2rem 1.5rem 3.5rem 1.5rem; 
    background: radial-gradient(circle at 50% 12%, rgba(10, 25, 47, 0.72) 0%, rgba(10, 14, 23, 0.94) 80%), url('/electronic_brain_bg.jpg') center top / cover no-repeat fixed;
    border-radius: 18px;
    border: 1px solid rgba(20, 241, 149, 0.22);
    box-shadow: 0 12px 45px rgba(0, 0, 0, 0.7);
    position: relative;
  ">
      
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin: 0; font-weight: 800;">
              <i class="fa-solid fa-microchip" style="margin-right: 0.5rem; color: #14F195;"></i> KART TAMİR MERKEZİ
            </h2>
            <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 3px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 800; letter-spacing: 1px;">
              KONTROL MERKEZİ & HUB
            </span>
          </div>
          <p style="color: var(--text-dim); margin: 4px 0 0 0; font-size: 0.88rem;">Merkez Tamir Atölyesi canlı operasyon, ambar ve iş emri yönetim paneli.</p>
        </div>
        <div style="display: flex; gap: 0.75rem; align-items: center; flex-wrap: wrap;">
          ${isManagerOrAdmin ? `
            <button onclick="if(window.navigate) window.navigate('workshop-performance')" class="btn-cyber" style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.35); font-weight: 800; padding: 0 1rem; height: 40px; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(20, 241, 149, 0.25)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.12)'">
              <i class="fa-solid fa-gauge-high"></i> BAŞARI & PERFORMANS
            </button>
          ` : ''}
          <div style="background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.2); padding: 0 1.25rem; border-radius: 8px; display: flex; align-items: center; gap: 0.6rem; height: 40px; box-sizing: border-box; backdrop-filter: blur(8px);">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #14F195; box-shadow: 0 0 10px #14F195;"></span>
            <span style="font-weight: 800; color: #14F195; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">${username}</span>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        
        <!-- 1. Sahadan Gelen (Kabul Bekleyen) -->
        <div onclick="window.openQuickReceiveModalFromDashboard ? window.openQuickReceiveModalFromDashboard() : (window.navigateToWorkshopReturned && window.navigateToWorkshopReturned())" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #F59E0B; display: flex; align-items: center; gap: 1rem; background: rgba(245, 158, 11, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(245, 158, 11, 0.09)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.04)'" title="Sahalardan Atölyeye Gelen Kargoları İncele & Hızlı Teslim Al">
          <div style="background: rgba(245, 158, 11, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.3rem;">
            <i class="fa-solid fa-truck-ramp-box"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${pendingArrivalCount}</div>
            <div style="font-size: 0.72rem; color: #F59E0B; font-weight: 700; text-transform: uppercase;">
              Sahadan Gelen (Kabul Bekleyen)
            </div>
          </div>
        </div>

        <!-- 2. Masadaki Aktif Kartlar -->
        <div onclick="if(window.navigate) window.navigate('workshop-tasks');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #3B82F6; display: flex; align-items: center; gap: 1rem; background: rgba(59, 130, 246, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.09)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.04)'" title="Masadaki Aktif İş Emirlerine Git">
          <div style="background: rgba(59, 130, 246, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #3B82F6; font-size: 1.3rem;">
            <i class="fa-solid fa-wrench"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${underRepairCount}</div>
            <div style="font-size: 0.72rem; color: #60a5fa; font-weight: 700; text-transform: uppercase;">Masada Onarımda</div>
          </div>
        </div>

        <!-- 3. Tamir Bekleyen Atölye Stoğu -->
        <div onclick="if(window.navigate) window.navigate('workshop-stock');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #a855f7; display: flex; align-items: center; gap: 1rem; background: rgba(168, 85, 247, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(168, 85, 247, 0.09)'" onmouseout="this.style.background='rgba(168, 85, 247, 0.04)'" title="Atölye Tamir Stoğunu Görüntüle">
          <div style="background: rgba(168, 85, 247, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #c084fc; font-size: 1.3rem;">
            <i class="fa-solid fa-boxes-stacked"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${waitingStockCount}</div>
            <div style="font-size: 0.72rem; color: #c084fc; font-weight: 700; text-transform: uppercase;">Tamir Bekleyen Stok</div>
          </div>
        </div>

        <!-- 4. Revize Sağlam (Sevke Hazır) -->
        <div onclick="if(window.navigate) window.navigate('workshop-tasks');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #14F195; display: flex; align-items: center; gap: 1rem; background: rgba(20, 241, 149, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(20, 241, 149, 0.09)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.04)'" title="Sevke Hazır Kartları Görüntüle">
          <div style="background: rgba(20, 241, 149, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.3rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${repairedCount}</div>
            <div style="font-size: 0.72rem; color: #14F195; font-weight: 700; text-transform: uppercase;">Revize Sağlam (Hazır)</div>
          </div>
        </div>

        <!-- 5. Seri Numarasızlar Havuzu -->
        <div onclick="if(window.navigate) { (window as any)._workshopStockTab = 'NO_SERIAL'; window.navigate('workshop-stock'); }" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #EC4899; display: flex; align-items: center; gap: 1rem; background: rgba(236, 72, 153, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(236, 72, 153, 0.09)'" onmouseout="this.style.background='rgba(236, 72, 153, 0.04)'" title="Seri Numarası Olmayan Kartları İncele & Ata">
          <div style="background: rgba(236, 72, 153, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #EC4899; font-size: 1.3rem;">
            <i class="fa-solid fa-barcode"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${noSerialCount}</div>
            <div style="font-size: 0.72rem; color: #f472b6; font-weight: 700; text-transform: uppercase;">Seri Numarasız Kartlar</div>
          </div>
        </div>

        <!-- 6. Sevk Edilenler (Arşiv) -->
        <div onclick="if(window.navigate) window.navigate('workshop-dispatches');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #06b6d4; display: flex; align-items: center; gap: 1rem; background: rgba(6, 182, 212, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(6, 182, 212, 0.09)'" onmouseout="this.style.background='rgba(6, 182, 212, 0.04)'" title="Sevk Edilen Kartları & Kargo Arşivini Görüntüle">
          <div style="background: rgba(6, 182, 212, 0.15); width: 44px; height: 44px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #06b6d4; font-size: 1.3rem;">
            <i class="fa-solid fa-truck-arrow-right"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${completedCount}</div>
            <div style="font-size: 0.72rem; color: #22d3ee; font-weight: 700; text-transform: uppercase;">Sevk Edilenler</div>
            ${dispatchedPendingCount > 0 ? `
              <div style="font-size: 0.68rem; color: #F59E0B; font-weight: 700; margin-top: 2px;">
                <i class="fa-solid fa-truck"></i> ${dispatchedPendingCount} Depo Kabulü Bekliyor
              </div>
            ` : `
              <div style="font-size: 0.68rem; color: #14F195; font-weight: 700; margin-top: 2px;">
                <i class="fa-solid fa-check"></i> Tümü Depoya Alındı
              </div>
            `}
          </div>
        </div>

      </div>

      <!-- PENDING ARRIVALS NOTIFICATION (IF ANY) -->
      ${pendingArrivals.length > 0 ? `
        <div class="glass-panel fade-in-up" style="padding: 1.25rem 1.5rem; border-radius: 14px; margin-bottom: 2rem; border: 1px solid rgba(245, 158, 11, 0.35); background: rgba(245, 158, 11, 0.04);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 12px;">
              <span style="width: 40px; height: 40px; border-radius: 10px; background: rgba(245, 158, 11, 0.2); display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.25rem;">
                <i class="fa-solid fa-truck-ramp-box"></i>
              </span>
              <div>
                <h4 style="margin: 0; color: #FFF; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800;">
                  TESLİM ALINMAYI BEKLEYEN ${pendingArrivals.length} ADET KARGO BULUNUYOR
                </h4>
                <div style="color: #94A3B8; font-size: 0.82rem; margin-top: 2px;">
                  Sahalardan gönderilen arızalı kartları teslim alarak atölye stoğuna kaydedin.
                </div>
              </div>
            </div>
            <button onclick="window.openQuickReceiveModalFromDashboard ? window.openQuickReceiveModalFromDashboard() : (window.navigateToWorkshopReturned && window.navigateToWorkshopReturned())" class="btn-cyber" style="background: #F59E0B; color: #0A0E17; font-weight: 900; padding: 0.65rem 1.25rem; border-radius: 8px; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif; cursor: pointer;">
              <i class="fa-solid fa-boxes-stacked"></i> KARGOLARI TESLİM AL
            </button>
          </div>
        </div>
      ` : ''}

      <!-- OPERATIONS HUB NAVIGATION GRID -->
      <div style="margin-bottom: 2rem;">
        <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 1rem 0; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-compass" style="color: #14F195;"></i> ATÖLYE OPERASYON MODÜLLERİ
        </h3>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
          
          <!-- Card 1: Kart İş Emirleri (Primary) -->
          <div onclick="if(window.navigate) window.navigate('workshop-tasks');" class="glass-panel" style="background: rgba(20, 241, 149, 0.04); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#14F195'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(20, 241, 149, 0.3)'; this.style.transform='none';">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div style="background: rgba(20, 241, 149, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.3rem;">
                <i class="fa-solid fa-clipboard-list"></i>
              </div>
              <span style="background: rgba(20, 241, 149, 0.2); color: #14F195; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                ANA ÇALIŞMA MASASI
              </span>
            </div>
            <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 0.4rem 0;">
              KART İŞ EMİRLERİ
            </h4>
            <p style="color: #94A3B8; font-size: 0.84rem; margin: 0; line-height: 1.4;">
              SAP ve Seri numarası ile kartı doğrula, masaya al, onarım notu yaz, elektronik malzeme düş, test durumunu seç ve sevke hazırla.
            </p>
          </div>

          <!-- Card 2: Atölye Tamir Stoğu -->
          <div onclick="if(window.navigate) window.navigate('workshop-stock');" class="glass-panel" style="background: rgba(59, 130, 246, 0.04); border: 1px solid rgba(59, 130, 246, 0.3); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#60a5fa'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(59, 130, 246, 0.3)'; this.style.transform='none';">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div style="background: rgba(59, 130, 246, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #60a5fa; font-size: 1.3rem;">
                <i class="fa-solid fa-boxes-stacked"></i>
              </div>
              <span style="background: rgba(59, 130, 246, 0.2); color: #93c5fd; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                AMBAR & RAF
              </span>
            </div>
            <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 0.4rem 0;">
              ATÖLYE TAMİR STOĞU
            </h4>
            <p style="color: #94A3B8; font-size: 0.84rem; margin: 0; line-height: 1.4;">
              Atölyede bulunan kart stoğu, manuel kart girişi, raf/kutu konumları, Excel yükleme/şablonu ve toplu envanter listesi.
            </p>
          </div>

          <!-- Card 3: Seri Numarasız Kartlar Havuzu -->
          <div onclick="if(window.navigate) { (window as any)._workshopStockTab = 'NO_SERIAL'; window.navigate('workshop-stock'); }" class="glass-panel" style="background: rgba(236, 72, 153, 0.04); border: 1px solid rgba(236, 72, 153, 0.3); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#f472b6'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(236, 72, 153, 0.3)'; this.style.transform='none';">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div style="background: rgba(236, 72, 153, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #f472b6; font-size: 1.3rem;">
                <i class="fa-solid fa-wand-magic-sparkles"></i>
              </div>
              <span style="background: rgba(236, 72, 153, 0.2); color: #f472b6; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                ${noSerialCount} KART
              </span>
            </div>
            <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 0.4rem 0;">
              SERİ NUMARASIZ KARTLAR HAVUZU
            </h4>
            <p style="color: #94A3B8; font-size: 0.84rem; margin: 0; line-height: 1.4;">
              Seri numarası olmayan veya silinmiş kartları ayrı listeleyin, tek tıkla otomatik MTA seri numarası atayın ve etiketleyin.
            </p>
          </div>

          <!-- Card 4: Komponent Stoğu -->
          <div onclick="if(window.navigate) window.navigate('workshop-components');" class="glass-panel" style="background: rgba(0, 242, 255, 0.04); border: 1px solid rgba(0, 242, 255, 0.3); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#00f2ff'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(0, 242, 255, 0.3)'; this.style.transform='none';">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div style="background: rgba(0, 242, 255, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #00f2ff; font-size: 1.3rem;">
                <i class="fa-solid fa-microchip"></i>
              </div>
              <span style="background: rgba(0, 242, 255, 0.2); color: #00f2ff; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                DEVRE ELEMANLARI
              </span>
            </div>
            <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 0.4rem 0;">
              ELEKTRONİK KOMPONENT STOĞU
            </h4>
            <p style="color: #94A3B8; font-size: 0.84rem; margin: 0; line-height: 1.4;">
              Direnç, kondansatör, IGBT, entegre, diyot ve lehim malzemelerinin stok yönetimi, çekmece konumları ve kritik stok uyarıları.
            </p>
          </div>

          <!-- Card 5: Sevkiyat Arşivi -->
          <div onclick="if(window.navigate) window.navigate('workshop-dispatches');" class="glass-panel" style="background: rgba(16, 185, 129, 0.04); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 14px; padding: 1.5rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.borderColor='#10B981'; this.style.transform='translateY(-2px)';" onmouseout="this.style.borderColor='rgba(16, 185, 129, 0.3)'; this.style.transform='none';">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 0.75rem;">
              <div style="background: rgba(16, 185, 129, 0.15); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #10B981; font-size: 1.3rem;">
                <i class="fa-solid fa-truck-fast"></i>
              </div>
              <span style="background: rgba(16, 185, 129, 0.2); color: #34d399; font-size: 0.72rem; font-weight: 800; padding: 3px 8px; border-radius: 4px; text-transform: uppercase;">
                ${completedCount} SEVKİYAT
              </span>
            </div>
            <h4 style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 0 0 0.4rem 0;">
              ATÖLYE SEVKİYAT ARŞİVİ
            </h4>
            <p style="color: #94A3B8; font-size: 0.84rem; margin: 0; line-height: 1.4;">
              Onarımı bitip sahalara gönderilen tüm kartların transfer tarihleri, kargo takip numaraları ve sevk kayıtları.
            </p>
          </div>

        </div>
      </div>

    </div>
  `;
};

const setupDashboardHandlers = (repairs: RepairRecord[], warehouses: any[], username: string) => {
  (window as any).formatShelfNo = formatShelfNo;

  (window as any).navigateToWorkshopReturned = () => {
    (window as any)._workshopReturnedTab = 'INCOMING';
    (window as any)._workshopReturnedSearch = '';
    (window as any)._workshopReturnedSiteFilter = 'ALL';
    if ((window as any).navigate) {
      (window as any).navigate('workshop-returned');
    }
  };

  (window as any).openQuickReceiveModalFromDashboard = () => {
    const currentRepairs: RepairRecord[] = (window as any)._allRepairs || repairs;
    const pending = currentRepairs.filter(r => r.status === 'PENDING_ARRIVAL');

    const existing = document.getElementById('dash-quick-receive-modal');
    if (existing) existing.remove();

    if (pending.length === 0) {
      const modal = document.createElement('div');
      modal.id = 'dash-quick-receive-modal';
      modal.className = 'modal-overlay';
      modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
        background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
        z-index: 10002; display: flex; align-items: center; justify-content: center;
        padding: 1rem;
      `;
      modal.innerHTML = `
        <div class="glass-panel fade-in-up" style="width: 100%; max-width: 480px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.7); text-align: center;">
          <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(20, 241, 149, 0.15); color: #14F195; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; margin: 0 auto 1.25rem auto;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <h3 style="margin: 0 0 0.5rem 0; font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; color: #FFF; font-weight: 800;">
            BEKLEYEN KARGO BULUNMUYOR
          </h3>
          <p style="color: #94A3B8; font-size: 0.88rem; line-height: 1.5; margin-bottom: 1.5rem;">
            Sahalardan atölyeye sevk edilmiş ve teslim alınmayı bekleyen herhangi bir arızalı kart bulunmamaktadır. Tüm kargolar kabul edilmiştir.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center;">
            <button onclick="document.getElementById('dash-quick-receive-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.08); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; border-radius: 8px; font-size: 0.85rem; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;">
              Kapat
            </button>
            <button onclick="document.getElementById('dash-quick-receive-modal').remove(); window.navigateToWorkshopReturned();" class="btn-cyber" style="background: rgba(20, 241, 149, 0.15); color: #14F195; font-weight: 800; padding: 0.65rem 1.25rem; border-radius: 8px; font-size: 0.85rem; border: 1px solid rgba(20, 241, 149, 0.4); cursor: pointer;">
              <i class="fa-solid fa-clock-rotate-left"></i> Kargo Geçmişi
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(modal);
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'dash-quick-receive-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.88); backdrop-filter: blur(12px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
      padding: 1rem;
    `;

    const cardsHtml = pending.map((rep, idx) => {
      const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId || 'Saha';
      const defaultShelf = formatShelfNo(rep.shelfNo) === '-' ? 'A-01' : formatShelfNo(rep.shelfNo);
      return `
        <div class="glass-panel" style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.35); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; transition: all 0.2s;" id="dash-card-${rep.id}">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
            <div>
              <div style="font-weight: 800; color: #FFF; font-size: 1.05rem; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 8px;">
                <span style="background: #F59E0B; color: #0A0E17; width: 22px; height: 22px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900;">${idx + 1}</span>
                ${rep.description || 'Elektronik Kart'}
              </div>
              <div style="display: flex; flex-wrap: wrap; gap: 12px; margin-top: 6px; font-size: 0.8rem; color: #94A3B8;">
                <span><i class="fa-solid fa-barcode" style="color: #00f3ff;"></i> SAP: <strong style="color: #FFF; font-family: monospace;">${rep.sapNo}</strong></span>
                <span><i class="fa-solid fa-hashtag" style="color: #fbbf24;"></i> Seri No: <strong style="color: #FFF; font-family: monospace;">${rep.serialNo || 'Seri No Yok'}</strong></span>
                <span><i class="fa-solid fa-boxes-stacked" style="color: #14F195;"></i> Adet: <strong style="color: #FFF;">${rep.quantity || 1}</strong></span>
              </div>
            </div>
            <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4); padding: 3px 9px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase;">
              <i class="fa-solid fa-truck-ramp-box"></i> Kabul Bekliyor
            </span>
          </div>

          <!-- Saha & Sevk Bilgileri -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; background: rgba(0,0,0,0.3); padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.78rem; color: #94A3B8; margin-bottom: 0.85rem;">
            <div><i class="fa-solid fa-warehouse" style="color: #60A5FA;"></i> Saha: <strong style="color: #FFF;">${sourceWh}</strong></div>
            <div><i class="fa-solid fa-file-invoice" style="color: #14F195;"></i> Sevk / Form: <strong style="color: #14F195; font-family: monospace;">${rep.dispatchNo || '-'}</strong></div>
            <div><i class="fa-solid fa-user" style="color: #F59E0B;"></i> Gönderen: <strong style="color: #FFF;">${rep.sentBy || '-'}</strong></div>
            <div><i class="fa-solid fa-clock" style="color: #a78bfa;"></i> Tarih: <strong style="color: #FFF;">${formatDateTime(rep.sentAt || rep.receivedAt || (rep as any).createdAt)}</strong></div>
            ${rep.faultCode ? `<div style="grid-column: 1 / -1;"><i class="fa-solid fa-triangle-exclamation" style="color: #EF4444;"></i> Söküm Nedeni: <strong style="color: #EF4444;">${rep.faultCode}</strong> ${rep.faultDesc ? `(${rep.faultDesc})` : ''}</div>` : ''}
          </div>

          <!-- Input Fields & Button -->
          <div style="display: grid; grid-template-columns: 140px 1fr auto; gap: 0.75rem; align-items: flex-end;">
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                RAF / KONUM (MTA)
              </label>
              <input 
                type="text" 
                id="dash-shelf-${rep.id}" 
                class="cyber-input" 
                value="${defaultShelf}" 
                placeholder="Örn: A-01" 
                style="width: 100%; padding: 0.55rem; background: rgba(0,0,0,0.45); border: 1px solid rgba(20,241,149,0.3); border-radius: 6px; color: #FFF; font-weight: 700; font-family: monospace; font-size: 0.82rem;" 
                onblur="this.value = window.formatShelfNo ? window.formatShelfNo(this.value) : this.value"
              />
            </div>
            <div>
              <label style="display: block; color: #94A3B8; font-size: 0.72rem; font-weight: 700; margin-bottom: 3px;">
                KABUL & FİZİKSEL KONTROL NOTU
              </label>
              <input 
                type="text" 
                id="dash-note-${rep.id}" 
                class="cyber-input" 
                placeholder="Örn: Ambalaj sağlam, kutu hasarsız..." 
                style="width: 100%; padding: 0.55rem; background: rgba(0,0,0,0.45); border: 1px solid #1E293B; border-radius: 6px; color: #FFF; font-size: 0.82rem;"
              />
            </div>
            <div>
              <button 
                id="dash-btn-${rep.id}" 
                onclick="window.submitQuickReceiveFromDashboard('${rep.id}')" 
                class="btn-cyber" 
                style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.58rem 1.1rem; font-size: 0.82rem; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 12px rgba(20,241,149,0.3); white-space: nowrap;"
              >
                <i class="fa-solid fa-check"></i> KABUL ET & RAFA KOY
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 780px; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.4); box-shadow: 0 25px 50px rgba(0,0,0,0.8); max-height: 90vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; flex-shrink: 0;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(245, 158, 11, 0.2); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
              <i class="fa-solid fa-truck-ramp-box"></i>
            </div>
            <div>
              <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; color: #FFF; font-weight: 800; letter-spacing: 0.5px;">
                TESLİM ALINACAK SAHA KARGOLARI (${pending.length})
              </h3>
              <div style="color: #94A3B8; font-size: 0.78rem; margin-top: 2px;">
                Arızalı kartları kontrol edin, atölye raf numarasını belirleyerek tek tıkla stoğa kabul edin.
              </div>
            </div>
          </div>
          <button onclick="document.getElementById('dash-quick-receive-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.3rem; padding: 4px;" title="Kapat">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Cards Scrollable Area -->
        <div style="overflow-y: auto; flex: 1; padding-right: 4px; margin-bottom: 1rem;">
          ${cardsHtml}
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem; flex-shrink: 0; flex-wrap: wrap; gap: 0.75rem;">
          <button onclick="document.getElementById('dash-quick-receive-modal').remove(); window.navigateToWorkshopReturned();" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #94A3B8; font-size: 0.8rem; font-weight: 700; padding: 0.55rem 1rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;" onmouseover="this.style.color='#FFF'; this.style.borderColor='rgba(255,255,255,0.3)';" onmouseout="this.style.color='#94A3B8'; this.style.borderColor='rgba(255,255,255,0.15)';">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> Sahadan Gelenler Sayfasında Ayrıntılı İncele
          </button>
          <button onclick="document.getElementById('dash-quick-receive-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.08); color: #FFF; font-weight: 700; padding: 0.55rem 1.25rem; font-size: 0.82rem; border-radius: 6px; cursor: pointer; border: 1px solid rgba(255,255,255,0.15);">
            Kapat
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitQuickReceiveFromDashboard = async (repairId: string) => {
    const currentRepairs: RepairRecord[] = (window as any)._allRepairs || repairs;
    const rep = currentRepairs.find(r => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }

    const shelfInput = document.getElementById(`dash-shelf-${repairId}`) as HTMLInputElement;
    const noteInput = document.getElementById(`dash-note-${repairId}`) as HTMLInputElement;
    const btn = document.getElementById(`dash-btn-${repairId}`) as HTMLButtonElement;

    const rawShelf = shelfInput?.value.trim() || 'Tanımsız';
    const shelfNo = formatShelfNo(rawShelf);
    const note = noteInput?.value.trim() || '';

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Alınıyor...';
    }

    try {
      (window as any).showToast?.('İşlem', 'Malzeme teslim alınıyor ve Atölye Stoğuna aktarılıyor...', 'info');
      await repairService.receiveRepair(repairId, username, shelfNo, note);

      await warehouseService.updateStockBySap(
        'MTA',
        rep.sapNo,
        rep.quantity || 1,
        {
          user: username,
          reason: `Atölyede teslim alındı. Raf: ${shelfNo}${note ? ' | Not: ' + note : ''}`,
          materialName: rep.description
        },
        'DEFECT',
        shelfNo,
        rep.serialNo || undefined,
        note || undefined
      );

      (window as any).showToast?.('Başarılı', `${rep.description} başarıyla teslim alındı ve Atölye Stoğuna eklendi.`, 'success');

      const cardEl = document.getElementById(`dash-card-${repairId}`);
      if (cardEl) {
        cardEl.style.transition = 'all 0.3s ease';
        cardEl.style.opacity = '0';
        cardEl.style.transform = 'scale(0.95)';
        setTimeout(() => {
          cardEl.remove();
          document.getElementById('dash-quick-receive-modal')?.remove();
          if ((window as any).navigate) {
            (window as any).navigate('workshop');
          }
        }, 350);
      } else {
        document.getElementById('dash-quick-receive-modal')?.remove();
        if ((window as any).navigate) {
          (window as any).navigate('workshop');
        }
      }
    } catch (err: any) {
      console.error("Dashboard teslim alma hatası:", err);
      alert("Hata oluştu: " + (err?.message || err));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> KABUL ET & RAFA KOY';
      }
    }
  };
};
