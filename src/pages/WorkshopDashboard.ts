import { repairService, type RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { workshopComponentService } from '../services/WorkshopComponentService';

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
  const underRepairCount = repairs.filter(r => r.status === 'UNDER_REPAIR').length;
  const repairedCount = repairs.filter(r => r.status === 'REPAIRED').length;
  const completedCount = repairs.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED').length;

  const isNoSerial = (r: RepairRecord) => !r.serialNo || r.serialNo.trim() === '' || r.serialNo === '-' || r.serialNo.toLowerCase() === 'yok' || r.serialNo.toLowerCase() === 'tanımsız';
  const noSerialCount = repairs.filter(r => (r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL') && isNoSerial(r)).length;

  setupDashboardHandlers();

  return `
    <div class="fade-in-up content-area" style="max-width: 1300px; margin: 0 auto; padding: 2rem 1.5rem;">
      
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
          <button onclick="if(window.navigate) window.navigate('workshop-tasks');" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; border: none; padding: 0 1.25rem; border-radius: 8px; height: 40px; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: 0 0 18px rgba(20, 241, 149, 0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-clipboard-list" style="font-size: 1rem;"></i> 📋 KART İŞ EMİRLERİNE GİT
          </button>
          
          <button onclick="if(window.navigate) window.navigate('workshop-stock');" class="btn-cyber" style="background: rgba(59, 130, 246, 0.12); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.35); padding: 0 1rem; border-radius: 8px; height: 40px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-boxes-stacked"></i> Atölye Tamir Stoğu
          </button>

          <button onclick="if(window.navigate) window.navigate('workshop-components');" class="btn-cyber" style="background: rgba(0, 242, 255, 0.1); color: #00f2ff; border: 1px solid rgba(0, 242, 255, 0.35); padding: 0 1rem; border-radius: 8px; height: 40px; font-size: 0.82rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-microchip"></i> Komponent Stoğu
          </button>

          <div style="background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 0 1rem; border-radius: 8px; display: flex; align-items: center; gap: 0.5rem; height: 40px; box-sizing: border-box;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #14F195; box-shadow: 0 0 10px #14F195;"></span>
            <span style="font-weight: 700; color: #14F195; font-size: 0.82rem;">${username}</span>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        
        <!-- 1. Yolda / Kabul Bekleyen -->
        <div onclick="if(window.navigate) window.navigate('workshop-stock');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #F59E0B; display: flex; align-items: center; gap: 1rem; background: rgba(245, 158, 11, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(245, 158, 11, 0.09)'" onmouseout="this.style.background='rgba(245, 158, 11, 0.04)'" title="Gelen Kargoları Görüntüle">
          <div style="background: rgba(245, 158, 11, 0.15); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.4rem;">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
          <div>
            <div style="font-size: 1.9rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${pendingArrivalCount}</div>
            <div style="font-size: 0.75rem; color: #F59E0B; font-weight: 700; text-transform: uppercase;">
              Yolda (Kabul Bekleyen)
            </div>
          </div>
        </div>

        <!-- 2. Masadaki Aktif Kartlar -->
        <div onclick="if(window.navigate) window.navigate('workshop-tasks');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #3B82F6; display: flex; align-items: center; gap: 1rem; background: rgba(59, 130, 246, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(59, 130, 246, 0.09)'" onmouseout="this.style.background='rgba(59, 130, 246, 0.04)'">
          <div style="background: rgba(59, 130, 246, 0.15); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #3B82F6; font-size: 1.4rem;">
            <i class="fa-solid fa-wrench"></i>
          </div>
          <div>
            <div style="font-size: 1.9rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${underRepairCount}</div>
            <div style="font-size: 0.75rem; color: #60a5fa; font-weight: 700; text-transform: uppercase;">Masada Onarımda</div>
          </div>
        </div>

        <!-- 3. Revize Sağlam (Sevke Hazır) -->
        <div onclick="if(window.navigate) window.navigate('workshop-tasks');" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #14F195; display: flex; align-items: center; gap: 1rem; background: rgba(20, 241, 149, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(20, 241, 149, 0.09)'" onmouseout="this.style.background='rgba(20, 241, 149, 0.04)'">
          <div style="background: rgba(20, 241, 149, 0.15); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.4rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style="font-size: 1.9rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${repairedCount}</div>
            <div style="font-size: 0.75rem; color: #14F195; font-weight: 700; text-transform: uppercase;">Revize Sağlam (Hazır)</div>
          </div>
        </div>

        <!-- 4. Seri Numarasızlar Havuzu -->
        <div onclick="if(window.navigate) { (window as any)._workshopStockTab = 'NO_SERIAL'; window.navigate('workshop-stock'); }" class="glass-panel" style="padding: 1.25rem; border-radius: 14px; border-left: 4px solid #EC4899; display: flex; align-items: center; gap: 1rem; background: rgba(236, 72, 153, 0.04); cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='rgba(236, 72, 153, 0.09)'" onmouseout="this.style.background='rgba(236, 72, 153, 0.04)'" title="Seri Numarası Olmayan Kartları İncele & Ata">
          <div style="background: rgba(236, 72, 153, 0.15); width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: #EC4899; font-size: 1.4rem;">
            <i class="fa-solid fa-barcode"></i>
          </div>
          <div>
            <div style="font-size: 1.9rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${noSerialCount}</div>
            <div style="font-size: 0.75rem; color: #f472b6; font-weight: 700; text-transform: uppercase;">Seri Numarasız Kartlar</div>
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
            <button onclick="if(window.navigate) window.navigate('workshop-stock');" class="btn-cyber" style="background: #F59E0B; color: #0A0E17; font-weight: 900; padding: 0.65rem 1.25rem; border-radius: 8px; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif; cursor: pointer;">
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

const setupDashboardHandlers = () => {
  // Any dashboard-specific event listeners can be initialized here
};
