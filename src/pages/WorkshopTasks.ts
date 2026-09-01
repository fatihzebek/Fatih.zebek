import { fileService } from '../services/FileService';

// Helper to resolve site/warehouse name from site ID or code (e.g. 2990 -> Doğal Sayalar)
export const getSiteOrWarehouseName = (sourceId?: string): string => {
  if (!sourceId || sourceId === '-' || sourceId === 'EXTERNAL') return 'Harici Giriş';
  const cleanId = String(sourceId).trim();
  
  // 1. Search in Warehouses
  const warehouses = dataService.getWarehouses();
  const foundWh = warehouses.find(w => w.id === cleanId || (w as any).code === cleanId);
  if (foundWh) return foundWh.name;

  // 2. Search in Sites
  const sites = dataService.getSites();
  const foundSite = sites.find(s => s.id === cleanId || s.name.toLowerCase() === cleanId.toLowerCase());
  if (foundSite) return foundSite.name;

  // 3. Fallback map for known standard IDs
  const siteMap: Record<string, string> = {
    '0752': 'Alize Germiyan',
    '752': 'Alize Germiyan',
    '2678': 'Mare Manastır',
    '2688': 'Anemon İntepe',
    '2990': 'Doğal Sayalar',
    '3213': 'Dares Datça',
    '3243': 'Alize Çamseki',
    '3245': 'Alize Keltepe',
    '3439': 'Alize Sarıkaya',
    '3793': 'Alize Kuyucak',
    '3892': 'Alize Çataltepe',
    'MTA': 'Merkez Tamir Atölyesi'
  };

  return siteMap[cleanId] || cleanId;
};

import { repairService, type RepairRecord } from '../services/RepairService';
import { workshopComponentService, type WorkshopComponent } from '../services/WorkshopComponentService';
import { dataService } from '../services/DataService';
import { doc, updateDoc, arrayUnion, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';

// Helper to generate unique MTA serial numbers (e.g. MTA-36256-001)
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

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  try {
    const date = ts.toDate ? ts.toDate() : new Date(ts);
    return isNaN(date.getTime()) ? '-' : date.toLocaleString('tr-TR');
  } catch (e) {
    return '-';
  }
};

let activeTab = 'ACTIVE'; // 'ACTIVE' | 'WAITING' | 'COMPLETED'
let selectedCompletedIds: string[] = [];

export const WorkshopTasksPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Merkez Tamir Atölyesi';

  const allRepairs = await repairService.getRepairs(true);
  const components = await workshopComponentService.getComponents(true);
  const warehouses = dataService.getWarehouses();

  // 1. ACTIVE WORK ORDERS ON BENCH (Under repair & NOT waiting for parts)
  const activeTasks = allRepairs.filter(r => 
    r.status === 'UNDER_REPAIR' && !!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-' &&
    r.repairStage !== 'WAITING_PARTS'
  );

  // 2. WAITING FOR PARTS / COMPONENTS
  const waitingTasks = allRepairs.filter(r => 
    r.status === 'UNDER_REPAIR' && !!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-' &&
    r.repairStage === 'WAITING_PARTS'
  );

  // 3. COMPLETED WORK ORDERS (Repaired and ready for dispatch)
  const completedTasks = allRepairs.filter(r => 
    r.status === 'REPAIRED' && !!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-'
  ).slice(0, 100);

  (window as any)._allRawRepairsForVerification = allRepairs;
  (window as any)._workshopComponentsForTasks = components;
  (window as any)._activeTasksList = activeTasks;
  (window as any)._waitingTasksList = waitingTasks;
  (window as any)._completedTasksList = completedTasks;
  (window as any)._allWarehousesList = warehouses;

  setupStreamlinedTaskHandlers();

  return `
    <div style="min-height: 100vh; background-color: #0A0E17; color: #E2E8F0; font-family: 'Inter', -apple-system, sans-serif; padding: 2rem; box-sizing: border-box; max-width: 1300px; margin: 0 auto;">
      
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <button onclick="if(window.navigate) window.navigate('workshop');" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#94A3B8';" title="Atölye Tezgahına Dön">
            <i class="fa-solid fa-arrow-left"></i>
          </button>
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">
                MERKEZ TAMİR ATÖLYESİ
              </span>
              <span style="font-size: 0.8rem; color: #64748B;">•</span>
              <span style="font-size: 0.8rem; color: #94A3B8;">Tekil Kart İş Emri ve Malzeme Masası</span>
            </div>
            <h1 style="font-family: 'Rajdhani', sans-serif; font-size: 1.7rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 0 0; letter-spacing: 0.5px;">
              <i class="fa-solid fa-clipboard-list" style="color: #14F195; margin-right: 8px;"></i>
              KART ONARIM İŞ EMİRLERİ
            </h1>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button onclick="if(window.navigate) window.navigate('workshop-components')" class="btn-cyber" style="background: rgba(0, 242, 255, 0.1); color: #00f2ff; border: 1px solid rgba(0, 242, 255, 0.35); font-weight: 800; padding: 0.6rem 1.1rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(0, 242, 255, 0.2)'" onmouseout="this.style.background='rgba(0, 242, 255, 0.1)'">
            <i class="fa-solid fa-microchip"></i> KOMPONENT STOĞU
          </button>
        </div>
      </div>

      <!-- ======================================================== -->
      <!-- TOP BOX: FAST CARD VERIFICATION & WORK ORDER CREATION    -->
      <!-- ======================================================== -->
      <div class="glass-panel" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 16px; padding: 1.5rem; margin-bottom: 2rem; box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
        
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.15rem; color: #14F195; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-id-card-clip"></i> KART BİLGİSİNİ DOĞRULA VE İŞ EMRİ AÇ
          </div>
          <span style="font-size: 0.78rem; color: #94A3B8;">
            Kartın SAP No ve Seri Numarasını girerek atölye stoğunda sorgulayın (Seri no yoksa otomatik atanır)
          </span>
        </div>

        <form id="verify-card-form" onsubmit="event.preventDefault(); window.checkCardAndPrepareTask();" style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 1rem; align-items: flex-end;">
          
          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 800; margin-bottom: 0.4rem;">
              KART SAP NUMARASI *
            </label>
            <input 
              type="text" 
              id="verify-sap-input" 
              class="cyber-input" 
              placeholder="Örn: 59368" 
              required
              oninput="window.onCardInputsChange()"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); document.getElementById('verify-serial-input')?.focus(); }"
              style="width: 100%; padding: 0.75rem 1rem; background: rgba(0,0,0,0.4); font-family: monospace; font-size: 1rem; font-weight: 800; color: #60a5fa;" 
            />
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 800; margin-bottom: 0.4rem;">
              KART SERİ NUMARASI *
            </label>
            <input 
              type="text" 
              id="verify-serial-input" 
              class="cyber-input" 
              placeholder="Örn: 10-76779" 
              required
              oninput="window.onCardInputsChange()"
              onkeydown="if(event.key==='Enter'){ event.preventDefault(); window.checkCardAndPrepareTask(); }"
              style="width: 100%; padding: 0.75rem 1rem; background: rgba(0,0,0,0.4); font-family: monospace; font-size: 1rem; font-weight: 800; color: #34d399;" 
            />
          </div>

          <div>
            <button 
              type="submit" 
              id="btn-verify-card"
              class="btn-cyber" 
              style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; height: 46px; padding: 0 1.5rem; border-radius: 8px; font-size: 0.88rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(20,241,149,0.25); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;"
            >
              <i class="fa-solid fa-check-double"></i> KARTI DOĞRULA
            </button>
          </div>

        </form>

        <!-- VERIFICATION RESULT (SUCCESS PANEL) -->
        <div id="verified-success-box" style="display: none; margin-top: 1.25rem; background: rgba(20, 241, 149, 0.04); border: 1px solid rgba(20, 241, 149, 0.35); border-radius: 12px; padding: 1.25rem; animation: fadeIn 0.3s;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 900;">
                  ✓ ATÖLYE STOĞUNDA BULUNDU & DOĞRULANDI
                </span>
              </div>
              <h3 id="res-card-name" style="font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #FFF; margin: 6px 0 4px 0;"></h3>
              
              <div style="display: flex; gap: 10px; font-size: 0.8rem; font-family: monospace; flex-wrap: wrap; margin-top: 6px;">
                <span id="res-card-sap" style="color: #60a5fa; font-weight: bold;"></span>
                <span id="res-card-serial" style="color: #34d399; font-weight: bold;"></span>
                <span id="res-card-site" style="color: #F59E0B; font-weight: bold;"></span>
                <span id="res-card-shelf" style="color: #CBD5E1;"></span>
              </div>

              <div id="res-card-fault" style="font-size: 0.8rem; color: #F59E0B; margin-top: 6px; font-weight: 600;"></div>
            </div>

            <!-- Single ONARIMA AL Button -->
            <div style="display: flex; align-items: center;">
              <button 
                type="button" 
                id="btn-confirm-start-task"
                onclick="window.executeStartCardTask()"
                class="btn-cyber" 
                style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.85rem 1.6rem; border-radius: 8px; font-size: 0.95rem; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 0 20px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;"
              >
                <i class="fa-solid fa-wrench"></i> ONARIMA AL
              </button>
            </div>
          </div>
        </div>

        <!-- VERIFICATION ERROR BOX -->
        <div id="verified-error-box" style="display: none; margin-top: 1.25rem; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.35); border-radius: 12px; padding: 1rem; color: #EF4444; font-size: 0.85rem; font-weight: 700; align-items: center; gap: 10px;">
          <i class="fa-solid fa-triangle-exclamation" style="font-size: 1.3rem;"></i>
          <span id="verified-error-text">Bu SAP numarasına sahip kart atölye stoğunda bulunamadı! Lütfen kartı önce atölyeye teslim alınız.</span>
        </div>

      </div>

      <!-- ======================================================== -->
      <!-- BOTTOM SECTION: TABS & WORK ORDERS LIST                  -->
      <!-- ======================================================== -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
        
        <!-- 3 TABS: AKTİF | PARÇA BEKLİYOR | TAMAMLANANLAR -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          
          <!-- Tab 1: Aktif İşler -->
          <button 
            id="tab-btn-active" 
            onclick="window.switchTasksTab('ACTIVE')" 
            style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; cursor: pointer; border: 1px solid #14F195; background: rgba(20, 241, 149, 0.12); color: #14F195; transition: all 0.2s; display: flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-screwdriver-wrench"></i> MASADAKİ AKTİF İŞ EMİRLERİ (${activeTasks.length})
          </button>

          <!-- Tab 2: Parça Bekliyor -->
          <button 
            id="tab-btn-waiting" 
            onclick="window.switchTasksTab('WAITING')" 
            style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #94A3B8; transition: all 0.2s; display: flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-clock" style="color: #F59E0B;"></i> PARÇA BEKLİYOR (${waitingTasks.length})
          </button>

          <!-- Tab 3: Tamamlananlar -->
          <button 
            id="tab-btn-completed" 
            onclick="window.switchTasksTab('COMPLETED')" 
            style="padding: 8px 16px; border-radius: 8px; font-size: 0.85rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); color: #94A3B8; transition: all 0.2s; display: flex; align-items: center; gap: 6px;"
          >
            <i class="fa-solid fa-circle-check" style="color: #14F195;"></i> TAMAMLANANLAR / SEVKE HAZIR (${completedTasks.length})
          </button>
        </div>

        <div id="tab-summary-indicator" style="font-size: 0.8rem; color: #64748B;">
          Masanızda <strong style="color: #14F195;">${activeTasks.length}</strong> adet aktif kart bulunmaktadır
        </div>
      </div>

      <!-- BULK ACTION TOOLBAR (ONLY SHOWN IN COMPLETED TAB) -->
      <div id="completed-bulk-toolbar" style="display: none; background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.25); border-radius: 12px; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <label style="display: flex; align-items: center; gap: 8px; font-size: 0.85rem; font-weight: 800; color: #FFF; cursor: pointer;">
            <input type="checkbox" id="cb-select-all-completed" onchange="window.toggleSelectAllCompleted(this.checked)" style="width: 18px; height: 18px; accent-color: #14F195; cursor: pointer;" />
            <span>Tümünü Seç</span>
          </label>
          <span id="selected-completed-count-text" style="font-size: 0.8rem; color: #14F195; font-weight: 700;">(0 kart seçildi)</span>
        </div>

        <div style="display: flex; gap: 8px;">
          <!-- Toplu Etiket Yazdır -->
          <button 
            type="button" 
            onclick="window.printSelectedCompletedLabels()" 
            class="btn-cyber" 
            style="background: rgba(255, 235, 59, 0.12); color: #fef08a; border: 1px solid rgba(255, 235, 59, 0.35); font-weight: 800; padding: 0.55rem 1rem; border-radius: 6px; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;"
          >
            <i class="fa-solid fa-print"></i> SEÇİLENLERİN ETİKETLERİNİ BAS
          </button>

          <!-- Toplu Sevk Et -->
          <button 
            type="button" 
            onclick="window.openDispatchModalForSelected()" 
            class="btn-cyber" 
            style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 900; padding: 0.55rem 1.25rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(16,185,129,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;"
          >
            <i class="fa-solid fa-truck-fast"></i> SEÇİLENLERİ DEPOYA SEVK ET
          </button>
        </div>
      </div>

      <!-- Tasks List Container -->
      <div id="tasks-content-area" style="display: flex; flex-direction: column; gap: 1rem;">
        ${renderStreamlinedTaskList(activeTasks, warehouses, 'ACTIVE')}
      </div>

    </div>
  `;
};

const getBenchDurationBadge = (assignedAt: any) => {
  if (!assignedAt) return '';
  const dateObj = assignedAt?.toDate ? assignedAt.toDate() : new Date(assignedAt);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  if (diffMs < 0) return '';

  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(totalHours / 24);

  let text = '';
  let color = '#14F195';
  let bg = 'rgba(20, 241, 149, 0.12)';
  let border = 'rgba(20, 241, 149, 0.3)';

  if (days >= 5) {
    text = `⚠️ ${days} Gündür Onarımda (Kritik Gecikme)`;
    color = '#EF4444';
    bg = 'rgba(239, 68, 68, 0.15)';
    border = 'rgba(239, 68, 68, 0.35)';
  } else if (days >= 1) {
    text = `⏱️ ${days} Gündür Onarımda`;
    color = '#F59E0B';
    bg = 'rgba(245, 158, 11, 0.15)';
    border = 'rgba(245, 158, 11, 0.35)';
  } else if (totalHours >= 6) {
    text = `⏱️ ${totalHours} Saattir Onarımda`;
    color = '#38bdf8';
    bg = 'rgba(56, 189, 248, 0.15)';
    border = 'rgba(56, 189, 248, 0.35)';
  } else {
    text = `⏱️ ${totalHours > 0 ? `${totalHours} Saattir` : `${Math.max(1, totalMinutes)} Dakikadır`} Onarımda`;
    color = '#14F195';
    bg = 'rgba(20, 241, 149, 0.12)';
    border = 'rgba(20, 241, 149, 0.3)';
  }

  return `
    <span style="background: ${bg}; color: ${color}; border: 1px solid ${border}; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;" title="Masaya Alınış: ${formatDateTime(assignedAt)}">
      ${text}
    </span>
  `;
};

const renderStreamlinedTaskList = (tasks: RepairRecord[], warehouses: any[], tabType: string) => {
  if (tasks.length === 0) {
    const emptyMessages: Record<string, { icon: string; title: string; desc: string }> = {
      'ACTIVE': {
        icon: 'fa-clipboard-check',
        title: 'Masanızda Bekleyen Aktif İş Emri Yok',
        desc: 'Yukarıdaki panelden kartın SAP ve Seri numarasını girip doğrulayarak masanıza yeni kart alabilirsiniz.'
      },
      'WAITING': {
        icon: 'fa-clock',
        title: 'Parça Bekleyen Kart Bulunmuyor',
        desc: 'Atölyede yedek komponent veya tedarik bekleyen kart kaydı yoktur.'
      },
      'COMPLETED': {
        icon: 'fa-circle-check',
        title: 'Tamamlanan İş Emri Bulunmuyor',
        desc: 'Onarımı tamamlanan ve sevke hazır hale getirilen kartlar burada arşivlenir.'
      }
    };
    const emptyInfo = emptyMessages[tabType] || emptyMessages['ACTIVE'];

    return `
      <div class="glass-panel" style="padding: 3.5rem 2rem; text-align: center; color: #64748B; background: rgba(15, 23, 42, 0.4); border: 1px dashed rgba(255,255,255,0.08); border-radius: 14px;">
        <i class="fa-solid ${emptyInfo.icon}" style="font-size: 2.5rem; color: #334155; margin-bottom: 0.75rem; display: block;"></i>
        <h3 style="color: #94A3B8; margin: 0 0 0.4rem 0; font-family: 'Rajdhani', sans-serif; font-size: 1.2rem;">${emptyInfo.title}</h3>
        <p style="margin: 0; font-size: 0.85rem;">${emptyInfo.desc}</p>
      </div>
    `;
  }

  return tasks.map(rep => {
    const sourceWh = getSiteOrWarehouseName(rep.sourceWarehouseId);
    const isRepaired = rep.status === 'REPAIRED';
    const stage = isRepaired ? (rep.repairStage || 'TESTED') : (rep.repairStage || 'DIAGNOSIS');
    const priority = rep.priority || 'NORMAL';
    const usedComponents = rep.usedComponents || [];
    const isChecked = selectedCompletedIds.includes(rep.id!);

    const priorityBadge = priority === 'CRITICAL' 
      ? '<span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.35); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 900;">🔴 KRİTİK</span>'
      : (priority === 'HIGH' 
        ? '<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.35); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">🟡 YÜKSEK</span>'
        : '<span style="background: rgba(255, 255, 255, 0.05); color: #94A3B8; border: 1px solid rgba(255, 255, 255, 0.1); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">⚪ NORMAL</span>');

    // Distinguish between tested vs turbine-test
    const isTurbineTest = stage === 'TURBINE_TEST' || rep.testStatus === 'UNTESTED';

    const stageMap: Record<string, { label: string; color: string; bg: string; icon: string }> = {
      'DIAGNOSIS': { label: '1. Teşhis Masasında', color: '#94A3B8', bg: 'rgba(255,255,255,0.06)', icon: 'fa-microchip' },
      'WAITING_PARTS': { label: '2. Komponent Bekliyor', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: 'fa-clock' },
      'REPAIRING': { label: '3. Onarım & Lehimleme', color: '#60a5fa', bg: 'rgba(59,130,246,0.12)', icon: 'fa-screwdriver-wrench' },
      'TESTING': { label: '4. Test Masasında', color: '#34d399', bg: 'rgba(16,185,129,0.12)', icon: 'fa-vial-circle-check' },
      'TESTED': { label: '5. Onarıldı & Test Edildi', color: '#14F195', bg: 'rgba(20,241,149,0.15)', icon: 'fa-circle-check' },
      'TURBINE_TEST': { label: '6. Onarıldı (Türbinde Test)', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', icon: 'fa-triangle-exclamation' },
      'REPAIRED': { label: '5. Onarıldı & Test Edildi', color: '#14F195', bg: 'rgba(20,241,149,0.15)', icon: 'fa-circle-check' }
    };
    const currentStage = stageMap[stage] || (isTurbineTest ? stageMap['TURBINE_TEST'] : stageMap['TESTED']);

    return `
      <div class="glass-panel" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; gap: 1.5rem; flex-wrap: wrap; transition: all 0.2s;" onmouseover="this.style.borderColor='rgba(20, 241, 149, 0.3)'" onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.08)'">
        
        <!-- Checkbox + Left Info -->
        <div style="display: flex; align-items: flex-start; gap: 14px; flex: 1; min-width: 280px;">
          
          ${tabType === 'COMPLETED' ? `
            <div style="padding-top: 4px;">
              <input 
                type="checkbox" 
                class="completed-task-cb" 
                value="${rep.id}" 
                ${isChecked ? 'checked' : ''}
                onchange="window.updateCompletedSelection()"
                style="width: 20px; height: 20px; accent-color: #14F195; cursor: pointer;" 
              />
            </div>
          ` : ''}

          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
              ${priorityBadge}
              <span style="background: ${currentStage.bg}; color: ${currentStage.color}; border: 1px solid ${currentStage.color}35; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                <i class="fa-solid ${currentStage.icon}"></i> ${currentStage.label}
              </span>
              ${!isRepaired ? getBenchDurationBadge(rep.assignedAt || rep.receivedAt || rep.lastUpdated || rep.sentAt) : ''}
              <span style="color: #64748B; font-size: 0.72rem;">• Masaya Alındı: ${formatDateTime(rep.assignedAt || rep.receivedAt)}</span>
            </div>

            <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #FFF; margin: 4px 0 6px 0;">
              ${rep.description}
            </h3>

            <div style="display: flex; gap: 8px; font-family: monospace; font-size: 0.8rem; flex-wrap: wrap;">
              <span style="background: rgba(59, 130, 246, 0.15); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.35); padding: 2px 8px; border-radius: 4px; font-weight: 800;">
                SAP: ${rep.sapNo}
              </span>
              <span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800;">
                SERİ: ${rep.serialNo || '-'}
              </span>
              <span style="color: #F59E0B; font-weight: 700; padding: 2px 6px;">
                <i class="fa-solid fa-warehouse"></i> ${sourceWh}
              </span>
              ${rep.turbineNo ? `<span style="color: #CBD5E1;">Türbin: ${rep.turbineNo}</span>` : ''}
            </div>

            ${rep.faultCode && rep.faultCode !== '-' ? `
              <div style="color: #F59E0B; font-size: 0.75rem; font-weight: 700; margin-top: 6px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Arıza: ${rep.faultCode} ${rep.faultDesc ? '(' + rep.faultDesc + ')' : ''}
              </div>
            ` : ''}

            <!-- Used Components List -->
            ${usedComponents.length > 0 ? `
              <div style="margin-top: 8px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                <span style="font-size: 0.72rem; color: #00f2ff; font-weight: 800;"><i class="fa-solid fa-microchip"></i> Kullanılan Parçalar:</span>
                ${usedComponents.map((c: any) => `
                  <span style="background: rgba(0, 242, 255, 0.08); border: 1px solid rgba(0, 242, 255, 0.25); color: #00f2ff; padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 700;">
                    ${c.quantity}x ${c.name}
                  </span>
                `).join('')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Right: Action Buttons -->
        <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
          
          ${isRepaired ? `
            <!-- QR Etiket (Tekil) -->
            <button 
              onclick="window.quickPrintSingleCardLabel('${rep.id}')" 
              class="btn-cyber" 
              style="background: rgba(255, 235, 59, 0.1); color: #fef08a; border: 1px solid rgba(255, 235, 59, 0.35); width: 42px; height: 42px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;" 
              title="QR Etiket Baskısı"
            >
              <i class="fa-solid fa-print" style="font-size: 1rem;"></i>
            </button>

            <!-- Tekil Sevk Et Butonu -->
            <button 
              onclick="window.openDispatchModalForSingle('${rep.id}')" 
              class="btn-cyber" 
              style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 800; padding: 0.75rem 1.25rem; border-radius: 8px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(16,185,129,0.25); font-family: 'Rajdhani', sans-serif;"
            >
              <i class="fa-solid fa-truck-fast"></i> SEVK ET
            </button>
          ` : ''}

          <!-- Primary Action Button -->
          <button 
            onclick="window.openFullRepairWorkbenchModal('${rep.id}')" 
            class="btn-cyber" 
            style="background: ${isRepaired ? 'rgba(255, 255, 255, 0.05)' : (stage === 'WAITING_PARTS' ? 'rgba(245, 158, 11, 0.15)' : 'linear-gradient(135deg, #14F195 0%, #00cc6a 100%)')}; color: ${isRepaired ? '#CBD5E1' : (stage === 'WAITING_PARTS' ? '#F59E0B' : '#0A0E17')}; border: ${stage === 'WAITING_PARTS' ? '1px solid rgba(245, 158, 11, 0.4)' : (isRepaired ? '1px solid rgba(255, 255, 255, 0.1)' : 'none')}; font-weight: 900; padding: 0.75rem 1.4rem; border-radius: 8px; font-size: 0.9rem; cursor: pointer; display: flex; align-items: center; gap: 8px; box-shadow: ${isRepaired || stage === 'WAITING_PARTS' ? 'none' : '0 0 20px rgba(20,241,149,0.3)'}; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;"
          >
            <i class="fa-solid ${isRepaired ? 'fa-eye' : (stage === 'WAITING_PARTS' ? 'fa-clock' : 'fa-play')}"></i> ${isRepaired ? 'DETAY & KARNE' : (stage === 'WAITING_PARTS' ? 'PARÇA DETAYI & ONAR' : 'ONARIMA BAŞLA')}
          </button>

        </div>

      </div>
    `;
  }).join('');
};

// ==========================================
// STREAMLINED INTERACTIVE HANDLERS
// ==========================================
const setupStreamlinedTaskHandlers = () => {

  (window as any).onCardInputsChange = () => {
    const successBox = document.getElementById('verified-success-box');
    const errorBox = document.getElementById('verified-error-box');
    if (successBox) successBox.style.display = 'none';
    if (errorBox) errorBox.style.display = 'none';
    (window as any)._matchedCardForTask = null;
  };

  // Auto-generate serial for task verification
  (window as any).autoGenerateTaskSerial = () => {
    const sapInput = (document.getElementById('verify-sap-input') as HTMLInputElement)?.value.trim();
    const serialInput = document.getElementById('verify-serial-input') as HTMLInputElement;
    if (!sapInput) {
      alert("Lütfen önce SAP Numarasını giriniz.");
      return;
    }
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const generated = generateMtaSerialNo(sapInput, allRepairs);
    if (serialInput) {
      serialInput.value = generated;
      serialInput.style.borderColor = '#14F195';
    }
  };

  // 1. Verify Card against workshop stock (Requires BOTH SAP and Serial Number)
  (window as any).checkCardAndPrepareTask = () => {
    const sapInput = (document.getElementById('verify-sap-input') as HTMLInputElement)?.value.trim();
    const serialInput = (document.getElementById('verify-serial-input') as HTMLInputElement)?.value.trim();
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];

    const successBox = document.getElementById('verified-success-box');
    const errorBox = document.getElementById('verified-error-box');
    const errorText = document.getElementById('verified-error-text');

    if (!sapInput) {
      if (errorBox && errorText) {
        errorText.innerText = "Lütfen kartın SAP Numarasını giriniz.";
        errorBox.style.display = 'flex';
      } else {
        alert("Lütfen kartın SAP Numarasını giriniz.");
      }
      return;
    }

    if (!serialInput) {
      if (errorBox && errorText) {
        errorText.innerText = "Lütfen doğrulamak istediğiniz kartın Seri Numarasını giriniz.";
        errorBox.style.display = 'flex';
      } else {
        alert("Lütfen doğrulamak istediğiniz kartın Seri Numarasını giriniz.");
      }
      return;
    }

    const cleanSap = sapInput.toLowerCase();
    const cleanSerial = serialInput.toLowerCase();
    const normSerial = cleanSerial.replace(/[\s_\-.:/()]/g, '');

    // Match in workshop records (Exact match with SAP and Serial)
    const match = allRepairs.find(r => {
      const rSap = (r.sapNo || '').trim().toLowerCase();
      const rSerial = (r.serialNo || '').trim().toLowerCase();
      const rNormSerial = rSerial.replace(/[\s_\-.:/()]/g, '');

      const isSapMatch = rSap === cleanSap || ('r' + rSap) === cleanSap || rSap === ('r' + cleanSap);
      const isSerialMatch = rSerial === cleanSerial || (normSerial !== '' && rNormSerial === normSerial);
      const isWorkshop = r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL' || r.status === 'REPAIRED';
      return isSapMatch && isSerialMatch && isWorkshop;
    });

    if (match) {
      (window as any)._matchedCardForTask = match;
      if (errorBox) errorBox.style.display = 'none';
      if (successBox) {
        successBox.style.display = 'block';
        document.getElementById('res-card-name')!.innerText = match.description;
        document.getElementById('res-card-sap')!.innerText = 'SAP: ' + match.sapNo;
        document.getElementById('res-card-serial')!.innerText = 'SERİ: ' + (match.serialNo || '-');
        document.getElementById('res-card-site')!.innerText = 'Saha: ' + getSiteOrWarehouseName(match.sourceWarehouseId);
        document.getElementById('res-card-shelf')!.innerText = 'Raf/Kutu: ' + (match.shelfNo || 'Tanımsız');

        const faultParts: string[] = [];
        if (match.faultCode && match.faultCode !== '-' && match.faultCode.toLowerCase() !== 'kod yok') {
          faultParts.push(`<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 2px 7px; border-radius: 4px; font-weight: 800; font-family: monospace;"><i class="fa-solid fa-triangle-exclamation"></i> Arıza Kodu: ${match.faultCode}</span>`);
        }
        
        const faultDescText = match.faultDesc || match.preRepairNote || match.repairNotes || match.generalNote;
        if (faultDescText && faultDescText !== '-' && faultDescText.trim() !== '') {
          faultParts.push(`<span style="color: #FBBF24; font-weight: 600;">${faultDescText}</span>`);
        }

        const faultContainer = document.getElementById('res-card-fault');
        if (faultContainer) {
          if (faultParts.length > 0) {
            faultContainer.innerHTML = `
              <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 6px 10px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 6px; font-size: 0.8rem;">
                ${faultParts.join(' ')}
              </div>
            `;
          } else {
            faultContainer.innerHTML = `
              <div style="color: #64748B; font-size: 0.75rem; margin-top: 6px; font-style: italic;">
                <i class="fa-solid fa-circle-info"></i> Saha arıza açıklaması kaydı bulunmuyor.
              </div>
            `;
          }
        }

        setTimeout(() => {
          document.getElementById('btn-confirm-start-task')?.focus();
        }, 100);
      }
    } else {
      (window as any)._matchedCardForTask = null;
      if (successBox) successBox.style.display = 'none';
      if (errorBox) {
        errorBox.style.display = 'flex';
        if (errorText) {
          errorText.innerText = `SAP: "${sapInput}" ve Seri No: "${serialInput}" bilgisine sahip kart atölye stoğunda bulunamadı! Lütfen kart üzerindeki seri numarasını kontrol ediniz.`;
        }
      }
    }
  };

  // 2. Start Work Order (Onarıma Al)
  (window as any).executeStartCardTask = async () => {
    const card = (window as any)._matchedCardForTask;
    if (!card || !card.id) {
      alert("Lütfen önce geçerli bir kartı doğrulayın.");
      return;
    }

    const btn = document.getElementById('btn-confirm-start-task') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Onarıma Alınıyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
      const hasNoSerial = !card.serialNo || card.serialNo.trim() === '' || card.serialNo === '-' || card.serialNo.toLowerCase() === 'yok' || card.serialNo.toLowerCase() === 'tanımsız';
      const assignedSerial = hasNoSerial ? generateMtaSerialNo(card.sapNo, allRepairs) : card.serialNo;

      const repDocRef = doc(db, 'repairs', card.id);
      const newNoteLog = {
        date: new Date(),
        user: userEmail,
        stage: 'ONARIMA_ALINDI',
        text: hasNoSerial 
          ? `Kart onarıma alındı, otomatik seri no (${assignedSerial}) atandı ve masaya yerleştirildi.`
          : 'Kart onarıma alındı, masaya yerleştirildi.'
      };

      const updatePayload: any = {
        status: 'UNDER_REPAIR',
        assignedTo: userEmail,
        assignedAt: serverTimestamp(),
        repairStage: 'DIAGNOSIS',
        priority: 'NORMAL',
        noteLogs: arrayUnion(newNoteLog),
        lastUpdated: serverTimestamp()
      };

      if (hasNoSerial) {
        updatePayload.serialNo = assignedSerial;
      }

      await updateDoc(repDocRef, updatePayload);

      (window as any).showToast?.('Başarılı', `"${card.description}" onarıma alındı ve masanıza eklendi!`, 'success');

      if ((window as any).navigate) {
        (window as any).navigate('workshop-tasks');
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = '<i class="fa-solid fa-wrench"></i> ONARIMA AL';
      }
    }
  };

  // 3. Switch Tab between Active, Waiting, and Completed
  (window as any).switchTasksTab = (tab: string) => {
    activeTab = tab;
    const btnActive = document.getElementById('tab-btn-active');
    const btnWaiting = document.getElementById('tab-btn-waiting');
    const btnComp = document.getElementById('tab-btn-completed');
    const contentArea = document.getElementById('tasks-content-area');
    const summaryIndicator = document.getElementById('tab-summary-indicator');
    const bulkToolbar = document.getElementById('completed-bulk-toolbar');
    const warehouses = dataService.getWarehouses();

    const activeList = (window as any)._activeTasksList || [];
    const waitingList = (window as any)._waitingTasksList || [];
    const compList = (window as any)._completedTasksList || [];

    // Reset button styles
    [btnActive, btnWaiting, btnComp].forEach(btn => {
      if (btn) {
        btn.style.background = 'rgba(255,255,255,0.03)';
        btn.style.borderColor = 'rgba(255,255,255,0.1)';
        btn.style.color = '#94A3B8';
      }
    });

    if (bulkToolbar) {
      bulkToolbar.style.display = tab === 'COMPLETED' ? 'flex' : 'none';
    }

    if (tab === 'ACTIVE') {
      if (btnActive) {
        btnActive.style.background = 'rgba(20, 241, 149, 0.12)';
        btnActive.style.borderColor = '#14F195';
        btnActive.style.color = '#14F195';
      }
      if (summaryIndicator) {
        summaryIndicator.innerHTML = `Masanızda <strong style="color: #14F195;">${activeList.length}</strong> adet aktif kart bulunmaktadır`;
      }
      if (contentArea) {
        contentArea.innerHTML = renderStreamlinedTaskList(activeList, warehouses, 'ACTIVE');
      }
    } else if (tab === 'WAITING') {
      if (btnWaiting) {
        btnWaiting.style.background = 'rgba(245, 158, 11, 0.12)';
        btnWaiting.style.borderColor = '#F59E0B';
        btnWaiting.style.color = '#F59E0B';
      }
      if (summaryIndicator) {
        summaryIndicator.innerHTML = `Parça bekleyen <strong style="color: #F59E0B;">${waitingList.length}</strong> adet kart bulunmaktadır`;
      }
      if (contentArea) {
        contentArea.innerHTML = renderStreamlinedTaskList(waitingList, warehouses, 'WAITING');
      }
    } else {
      if (btnComp) {
        btnComp.style.background = 'rgba(20, 241, 149, 0.12)';
        btnComp.style.borderColor = '#14F195';
        btnComp.style.color = '#14F195';
      }
      if (summaryIndicator) {
        summaryIndicator.innerHTML = `Tamamlanan & sevke hazır <strong style="color: #14F195;">${compList.length}</strong> adet kart bulunmaktadır`;
      }
      if (contentArea) {
        contentArea.innerHTML = renderStreamlinedTaskList(compList, warehouses, 'COMPLETED');
      }
      (window as any).updateCompletedSelection?.();
    }
  };

  // 4. FULL REPAIR WORKBENCH MODAL (ONARIMA BAŞLA MODALI)
  (window as any).openFullRepairWorkbenchModal = (repairId: string) => {
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;

    const isRepaired = rep.status === 'REPAIRED';
    const usedComponents = rep.usedComponents || [];

    // Track currently selected components in memory
    (window as any)._selectedWorkbenchComponents = [];

    const modal = document.createElement('div');
    modal.id = 'full-workbench-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.88); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 950px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.35); box-shadow: 0 25px 50px rgba(0,0,0,0.6); max-height: 92vh; display: flex; flex-direction: column;">
        
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; flex-shrink: 0;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 900; text-transform: uppercase;">
                ONARIM İŞ EMRİ & ÇALIŞMA MASASI
              </span>
              ${isRepaired ? `
                <span style="background: rgba(20, 241, 149, 0.2); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.4); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                  ✓ SEVKE HAZIR
                </span>
              ` : ''}
            </div>

            <h2 style="margin: 6px 0 0 0; font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; font-weight: 800; color: #FFF;">
              ${rep.description}
            </h2>

            <div style="display: flex; gap: 10px; margin-top: 6px; font-family: monospace; font-size: 0.8rem; flex-wrap: wrap;">
              <span style="color: #60a5fa; font-weight: bold;">SAP: ${rep.sapNo}</span>
              <span style="color: #34d399; font-weight: bold;">SERİ: ${rep.serialNo || '-'}</span>
              <span style="color: #F59E0B; font-weight: bold;">Saha: ${getSiteOrWarehouseName(rep.sourceWarehouseId)}</span>
              ${rep.faultCode && rep.faultCode !== '-' ? `<span style="color: #EF4444; font-weight: bold;">Arıza: ${rep.faultCode}</span>` : ''}
            </div>
          </div>

          <button onclick="document.getElementById('full-workbench-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.3rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 2-COLUMN MAIN WORKSPACE -->
        <div style="flex: 1; overflow-y: auto; display: grid; grid-template-columns: 1.1fr 1.2fr; gap: 1.25rem; padding-right: 4px;" class="custom-scrollbar">
          
          <!-- LEFT COLUMN: YAPILAN İŞLEMLER & ONARIM NOTU -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column; flex: 1;">
              <label style="display: block; color: #14F195; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
                <i class="fa-solid fa-pen-to-square" style="margin-right: 6px;"></i> YAPILAN İŞLEMLER & ONARIM NOTLARI
              </label>
              <textarea 
                id="wb-work-note" 
                class="cyber-input" 
                placeholder="Notlarınızı buraya yazabilirsiniz..." 
                style="width: 100%; height: 140px; padding: 0.85rem; background: rgba(0,0,0,0.4); font-size: 0.88rem; line-height: 1.5; resize: none; box-sizing: border-box;"
              ></textarea>

              <div style="margin-top: 1rem;">
                <label style="display: block; color: #94A3B8; font-size: 0.75rem; font-weight: 700; margin-bottom: 0.3rem;">GÜNCEL ONARIM AŞAMASI</label>
                <select id="wb-task-stage" onchange="window.onWorkbenchStageChange(this.value, '${rep.id}')" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); color: #FFF; font-size: 0.85rem;">
                  <option value="DIAGNOSIS" ${rep.repairStage === 'DIAGNOSIS' ? 'selected' : ''}>🔍 1. Teşhis Masasında</option>
                  <option value="WAITING_PARTS" ${rep.repairStage === 'WAITING_PARTS' ? 'selected' : ''}>⏳ 2. Komponent / Parça Bekliyor</option>
                  <option value="REPAIRING" ${rep.repairStage === 'REPAIRING' || !rep.repairStage ? 'selected' : ''}>⚡ 3. Onarım & Lehimleme Yapılıyor</option>
                  <option value="TESTING" ${rep.repairStage === 'TESTING' ? 'selected' : ''}>🧪 4. Test Masasında Doğrulanıyor</option>
                  <option value="SCRAP" ${rep.repairStage === 'SCRAP' ? 'selected' : ''} style="color: #f87171; font-weight: 800;">🔥 5. Hurdaya Ayrılacak (Tamir Edilemez)</option>
                </select>
              </div>

              <!-- Mandatory Photo Container for Scrap -->
              <div id="wb-scrap-photo-container" style="display: ${rep.repairStage === 'SCRAP' ? 'block' : 'none'}; margin-top: 1rem; border: 2px dashed rgba(239, 68, 68, 0.45); border-radius: 10px; padding: 0.85rem; text-align: center; background: rgba(239, 68, 68, 0.04); position: relative;">
                <input 
                  type="file" 
                  id="wb-scrap-file-input" 
                  accept="image/*" 
                  capture="environment"
                  onchange="window.handleWorkbenchScrapPhotoSelected(event)"
                  style="position: absolute; left: 0; top: 0; width: 100%; height: 100%; opacity: 0; cursor: pointer;" 
                />
                <div id="wb-scrap-upload-prompt" style="cursor: pointer;">
                  <i class="fa-solid fa-camera" style="font-size: 1.5rem; color: #EF4444; margin-bottom: 4px;"></i>
                  <div style="font-size: 0.8rem; font-weight: 800; color: #EF4444;">Hasar / Yanık Fotoğrafı Yükle * (ZORUNLU)</div>
                  <div style="font-size: 0.7rem; color: #94A3B8; margin-top: 2px;">Kameradan çekin veya dosya seçin (~40 KB)</div>
                </div>

                <!-- Preview box -->
                <div id="wb-scrap-preview-box" style="display: none; align-items: center; justify-content: center; gap: 12px;">
                  <img id="wb-scrap-preview-img" src="" style="width: 54px; height: 54px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.5);" />
                  <div style="text-align: left;">
                    <div style="font-size: 0.78rem; color: #14F195; font-weight: 800;">✓ Fotoğraf Eklendi</div>
                    <div id="wb-scrap-preview-size" style="font-size: 0.68rem; color: #94A3B8;"></div>
                    <button type="button" onclick="document.getElementById('wb-scrap-file-input').click()" style="background: transparent; border: none; color: #EF4444; font-size: 0.72rem; text-decoration: underline; cursor: pointer; padding: 0; margin-top: 2px;">Değiştir</button>
                  </div>
                </div>
              </div>

              <div style="margin-top: 0.75rem; display: flex; justify-content: flex-end;">
                <button 
                  type="button" 
                  id="btn-add-note-inline"
                  onclick="window.addWorkbenchNoteInline('${rep.id}')" 
                  class="btn-cyber" 
                  style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; padding: 0.45rem 0.95rem; font-size: 0.78rem; border-radius: 6px; cursor: pointer; display: inline-flex; align-items: center; gap: 5px; height: 32px; box-shadow: 0 0 10px rgba(20,241,149,0.25); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;"
                >
                  <i class="fa-solid fa-plus" style="font-size: 0.75rem;"></i> Notu Kaydet
                </button>
              </div>
            </div>

            <!-- Previous Notes History with Edit & Delete -->
            <div id="wb-notes-history-container" style="${rep.noteLogs && rep.noteLogs.length > 0 ? '' : 'display:none;'} background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem;">
              <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
                <span><i class="fa-solid fa-timeline" style="color: #38bdf8; margin-right: 4px;"></i> Not Tarihçesi (<span id="wb-notes-count">${rep.noteLogs?.length || 0}</span>)</span>
              </div>
              <div id="wb-notes-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 140px; overflow-y: auto;">
                ${(rep.noteLogs || []).map((l, idx) => `
                  <div id="wb-note-item-${idx}" style="font-size: 0.76rem; border-left: 2px solid #14F195; padding-left: 8px; background: rgba(255,255,255,0.02); padding: 5px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                    <div style="flex: 1;">
                      <div style="color: #64748B; font-size: 0.68rem; margin-bottom: 2px;">${formatDateTime(l.date)} - <strong>${l.user}</strong></div>
                      <div id="wb-note-text-${idx}" style="color: #E2E8F0; word-break: break-word;">${l.text}</div>
                    </div>
                    <div style="display: flex; gap: 4px; flex-shrink: 0;">
                      <button type="button" onclick="window.openEditNoteModal('${rep.id}', ${idx})" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; cursor: pointer;" title="Notu Düzenle">
                        <i class="fa-solid fa-pen"></i>
                      </button>
                      <button type="button" onclick="window.deleteWorkbenchNote('${rep.id}', ${idx})" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; cursor: pointer;" title="Notu Sil">
                        <i class="fa-solid fa-trash"></i>
                      </button>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>

          </div>

          <!-- RIGHT COLUMN: SEARCHABLE COMPONENT PICKER & SELECTED LIST -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            
            <div style="background: rgba(0, 242, 255, 0.03); border: 1px solid rgba(0, 242, 255, 0.25); border-radius: 12px; padding: 1.25rem; display: flex; flex-direction: column;">
              
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                <label style="color: #00f2ff; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
                  <i class="fa-solid fa-microchip" style="margin-right: 6px;"></i> KULLANILAN DEVRE ELEMANLARI
                </label>
                <span style="font-size: 0.72rem; color: #94A3B8;">Stoktan Otomatik Düşer</span>
              </div>

              <!-- INSTANT SEARCH AUTOCOMPLETE INPUT -->
              <div style="position: relative; margin-bottom: 1rem;">
                <div style="position: relative;">
                  <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #00f2ff; font-size: 0.85rem;"></i>
                  <input 
                    type="text" 
                    id="wb-comp-search-input" 
                    class="cyber-input" 
                    placeholder="Komponent Ara (örn: 100 ohm, 470uF, IGBT, C-12)..." 
                    oninput="window.filterWorkbenchComponents(this.value)"
                    onfocus="window.filterWorkbenchComponents(this.value)"
                    autocomplete="off"
                    style="width: 100%; padding: 0.7rem 1rem 0.7rem 2.2rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 242, 255, 0.35); border-radius: 8px; color: #FFF; font-size: 0.85rem; box-sizing: border-box;"
                  />
                </div>

                <!-- Autocomplete Dropdown Menu -->
                <div 
                  id="wb-comp-search-dropdown" 
                  style="display: none; position: absolute; top: 105%; left: 0; right: 0; max-height: 220px; overflow-y: auto; background: #0c1524; border: 1px solid rgba(0, 242, 255, 0.4); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.7); z-index: 10010;"
                >
                  <!-- Populated via JS -->
                </div>
              </div>

              <!-- SELECTED COMPONENTS LIST -->
              <div style="font-size: 0.74rem; color: #14F195; margin-bottom: 6px; font-weight: 800; text-transform: uppercase; display: flex; justify-content: space-between;">
                <span>Bu Onarımda Kullanılan Parçalar:</span>
                <span id="selected-comp-badge" style="color: #94A3B8;">0 Parça Seçildi</span>
              </div>

              <div id="selected-comp-list-container" style="display: flex; flex-direction: column; gap: 6px; min-height: 70px; max-height: 160px; overflow-y: auto; background: rgba(0,0,0,0.25); border: 1px dashed rgba(255,255,255,0.08); border-radius: 8px; padding: 6px;">
                <div id="no-comp-placeholder" style="color: #64748B; font-size: 0.78rem; text-align: center; padding: 1.25rem 0; font-style: italic;">
                  Yukarıdaki arama çubuğundan parça arayıp tıklayarak ekleyebilirsiniz.
                </div>
              </div>

              <!-- Already Used Components for this card (History) -->
              ${usedComponents.length > 0 ? `
                <div style="margin-top: 1rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem;">
                  <div style="font-size: 0.72rem; color: #94A3B8; margin-bottom: 4px; font-weight: 700;">
                    <i class="fa-solid fa-clock-rotate-left" style="color: #38bdf8; margin-right: 4px;"></i> Önceden Düşülmüş Olan Parçalar:
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 4px;">
                    ${usedComponents.map((c: any) => `
                      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px; font-size: 0.74rem;">
                        <span style="color: #CBD5E1; font-weight: 600;">${c.name} <span style="color: #00f2ff; font-family: monospace;">[${c.code}]</span></span>
                        <span style="color: #14F195; font-weight: 900; font-family: monospace;">${c.quantity} Adet</span>
                      </div>
                    `).join('')}
                  </div>
                </div>
              ` : ''}

            </div>

          </div>

        </div>

        <!-- FOOTER ACTIONS -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem; margin-top: 1rem; flex-shrink: 0; gap: 8px; flex-wrap: wrap;">
          <button onclick="document.getElementById('full-workbench-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">
            KAPAT
          </button>
          
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button id="btn-save-workbench" onclick="window.saveWorkbenchDetails('${rep.id}', 'DRAFT')" class="btn-cyber" style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); font-weight: 800; padding: 0.7rem 1.3rem; border-radius: 8px; font-size: 0.85rem; font-family: 'Rajdhani', sans-serif;">
              <i class="fa-solid fa-floppy-disk" style="margin-right: 6px;"></i> KAYDET (DEVAM EDİYOR)
            </button>

            ${!isRepaired ? `
              <!-- ONARIMI BİTİR OR HURDAYA GÖNDER BUTTON -->
              <button 
                id="btn-complete-workbench" 
                onclick="window.handleWorkbenchPrimaryAction('${rep.id}')" 
                class="btn-cyber" 
                style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.7rem 1.6rem; border-radius: 8px; font-size: 0.9rem; box-shadow: 0 0 18px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.25s;"
              >
                <i id="btn-complete-workbench-icon" class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> 
                <span id="btn-complete-workbench-text">ONARIMI BİTİR (SEVKE HAZIR YAP)</span>
              </button>
            ` : ''}
          </div>
        </div>

      </div>
    `;

    document.body.appendChild(modal);

    // Close search dropdown on click outside
    document.addEventListener('click', (e: MouseEvent) => {
      const dropdown = document.getElementById('wb-comp-search-dropdown');
      const searchInput = document.getElementById('wb-comp-search-input');
      if (dropdown && searchInput && !dropdown.contains(e.target as Node) && e.target !== searchInput) {
        dropdown.style.display = 'none';
      }
    });
  };

  // ==========================================
  // STAGE CHANGE & DYNAMIC SCRAP FLOW HANDLERS
  // ==========================================
  (window as any)._workbenchScrapImageBase64 = null;

  (window as any).onWorkbenchStageChange = (stage: string, repairId: string) => {
    const scrapPhotoContainer = document.getElementById('wb-scrap-photo-container');
    const primaryBtn = document.getElementById('btn-complete-workbench');
    const primaryText = document.getElementById('btn-complete-workbench-text');
    const primaryIcon = document.getElementById('btn-complete-workbench-icon');

    if (stage === 'SCRAP') {
      if (scrapPhotoContainer) scrapPhotoContainer.style.display = 'block';
      if (primaryBtn) {
        primaryBtn.style.background = 'linear-gradient(135deg, #EF4444 0%, #dc2626 100%)';
        primaryBtn.style.color = '#FFF';
        primaryBtn.style.boxShadow = '0 0 20px rgba(239,68,68,0.5)';
      }
      if (primaryIcon) primaryIcon.className = 'fa-solid fa-dumpster-fire';
      if (primaryText) primaryText.innerText = 'HURDAYA GÖNDER';
    } else {
      if (scrapPhotoContainer) scrapPhotoContainer.style.display = 'none';
      if (primaryBtn) {
        primaryBtn.style.background = 'linear-gradient(135deg, #14F195 0%, #00cc6a 100%)';
        primaryBtn.style.color = '#0A0E17';
        primaryBtn.style.boxShadow = '0 0 18px rgba(20,241,149,0.3)';
      }
      if (primaryIcon) primaryIcon.className = 'fa-solid fa-circle-check';
      if (primaryText) primaryText.innerText = 'ONARIMI BİTİR (SEVKE HAZIR YAP)';
    }
  };

  (window as any).handleWorkbenchScrapPhotoSelected = async (event: any) => {
    const file = event.target?.files?.[0];
    if (!file) return;

    const promptBox = document.getElementById('wb-scrap-upload-prompt');
    const previewBox = document.getElementById('wb-scrap-preview-box');
    const previewImg = document.getElementById('wb-scrap-preview-img') as HTMLImageElement;
    const previewSize = document.getElementById('wb-scrap-preview-size');

    try {
      if (promptBox) promptBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size: 1.4rem; color: #EF4444;"></i><div style="margin-top: 4px; font-size: 0.78rem; color: #FFF;">Görsel sıkıştırılıyor...</div>';
      
      const compressedDataUrl = await fileService.uploadImage(file, 'scrap_records', 800, 800, 0.7);
      (window as any)._workbenchScrapImageBase64 = compressedDataUrl;

      if (promptBox) promptBox.style.display = 'none';
      if (previewBox) previewBox.style.display = 'flex';
      if (previewImg) previewImg.src = compressedDataUrl;
      if (previewSize) previewSize.innerText = `Boyut: ${Math.round(compressedDataUrl.length * 0.75 / 1024)} KB`;
    } catch (err: any) {
      alert("Resim işlenirken hata oluştu: " + err.message);
      if (promptBox) promptBox.style.display = 'block';
    }
  };

  (window as any).handleWorkbenchPrimaryAction = async (repairId: string) => {
    const stageSelect = document.getElementById('wb-task-stage') as HTMLSelectElement;
    const currentStage = stageSelect?.value;

    if (currentStage === 'SCRAP') {
      const scrapImage = (window as any)._workbenchScrapImageBase64;
      const noteInput = document.getElementById('wb-work-note') as HTMLTextAreaElement;
      const reason = (noteInput?.value || '').trim() || 'Tamir edilemez hasar/yanık tespit edildi.';

      if (!scrapImage) {
        alert("Kartı hurdaya göndermek için lütfen hasar / yanık fotoğrafını yükleyiniz (ZORUNLUDUR).");
        return;
      }

      if (!confirm("Bu kartı HURDAYA GÖNDERMEK istediğinize emin misiniz? Kart Hurdaya Ayrılanlar envanterine aktarılacaktır.")) {
        return;
      }

      const primaryBtn = document.getElementById('btn-complete-workbench') as HTMLButtonElement;
      if (primaryBtn) {
        primaryBtn.disabled = true;
        primaryBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Hurdaya Gönderiliyor...';
      }

      try {
        const user = (window as any).currentUser;
        const userEmail = user?.email || user?.displayName || 'Teknisyen';

        await repairService.scrapRepair(repairId, userEmail, reason, scrapImage);

        const repDocRef = doc(db, 'repairs', repairId);
        const newLog = {
          date: new Date(),
          user: userEmail,
          stage: 'HURDA',
          text: `Kart hurdaya ayrıldı. Gerekçe: ${reason}`
        };
        await updateDoc(repDocRef, {
          noteLogs: arrayUnion(newLog)
        });

        (window as any).showToast?.('Başarılı', 'Kart hurdaya ayrıldı ve Hurdaya Ayrılanlar sekmesine aktarıldı.', 'success');
        document.getElementById('full-workbench-modal')?.remove();

        if ((window as any).navigate) {
          (window as any).navigate('workshop-tasks');
        }
      } catch (err: any) {
        alert("Hata: " + err.message);
        if (primaryBtn) {
          primaryBtn.disabled = false;
          primaryBtn.innerHTML = '<i class="fa-solid fa-dumpster-fire"></i> HURDAYA GÖNDER';
        }
      }
    } else {
      // Normal completion flow
      (window as any).openCompletionOptionsModal(repairId);
    }
  };

  // Handlers for Professional Note Management (Add Inline, Edit Modal, Delete)
  (window as any).addWorkbenchNoteInline = async (repairId: string) => {
    const noteInput = document.getElementById('wb-work-note') as HTMLTextAreaElement;
    const stageSelect = document.getElementById('wb-task-stage') as HTMLSelectElement;
    const text = (noteInput?.value || '').trim();

    if (!text) {
      alert("Lütfen eklenecek notu yazınız.");
      noteInput?.focus();
      return;
    }

    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Teknisyen';
    const stage = stageSelect?.value || rep.repairStage || 'REPAIRING';

    const addBtn = document.getElementById('btn-add-note-inline') as HTMLButtonElement;
    if (addBtn) {
      addBtn.disabled = true;
      addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Ekleniyor...';
    }

    try {
      const newNoteLog = {
        date: new Date(),
        user: userEmail,
        stage: stage,
        text: text
      };

      if (!rep.noteLogs) rep.noteLogs = [];
      rep.noteLogs.push(newNoteLog);
      rep.repairStage = stage;

      const repDocRef = doc(db, 'repairs', repairId);
      await updateDoc(repDocRef, {
        noteLogs: rep.noteLogs,
        repairStage: stage,
        lastUpdated: serverTimestamp()
      });

      if (noteInput) noteInput.value = '';

      const historyContainer = document.getElementById('wb-notes-history-container');
      const notesList = document.getElementById('wb-notes-list');
      const notesCount = document.getElementById('wb-notes-count');

      if (historyContainer) historyContainer.style.display = 'block';
      if (notesCount) notesCount.innerText = String(rep.noteLogs.length);

      if (notesList) {
        const newIdx = rep.noteLogs.length - 1;
        const newNoteHtml = document.createElement('div');
        newNoteHtml.id = `wb-note-item-${newIdx}`;
        newNoteHtml.style.cssText = "font-size: 0.76rem; border-left: 2px solid #14F195; padding-left: 8px; background: rgba(255,255,255,0.02); padding: 5px 8px; border-radius: 4px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px; animation: fadeIn 0.3s;";
        newNoteHtml.innerHTML = `
          <div style="flex: 1;">
            <div style="color: #64748B; font-size: 0.68rem; margin-bottom: 2px;">${formatDateTime(newNoteLog.date)} - <strong>${newNoteLog.user}</strong></div>
            <div id="wb-note-text-${newIdx}" style="color: #E2E8F0; word-break: break-word;">${newNoteLog.text}</div>
          </div>
          <div style="display: flex; gap: 4px; flex-shrink: 0;">
            <button type="button" onclick="window.openEditNoteModal('${rep.id}', ${newIdx})" style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; cursor: pointer;" title="Notu Düzenle">
              <i class="fa-solid fa-pen"></i>
            </button>
            <button type="button" onclick="window.deleteWorkbenchNote('${rep.id}', ${newIdx})" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; cursor: pointer;" title="Notu Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        `;
        notesList.appendChild(newNoteHtml);
      }

      (window as any).showToast?.('Başarılı', 'Not tarihçeye başarıyla eklendi.', 'success');
    } catch (err: any) {
      alert("Hata: " + err.message);
    } finally {
      if (addBtn) {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fa-solid fa-plus" style="font-size: 0.75rem;"></i> Notu Kaydet';
      }
    }
  };

  (window as any).openEditNoteModal = (repairId: string, noteIndex: number) => {
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep || !rep.noteLogs || !rep.noteLogs[noteIndex]) return;

    const currentText = rep.noteLogs[noteIndex].text || '';

    document.getElementById('edit-note-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'edit-note-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10008; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 540px; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.8); background: #0B101B;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; color: #00f3ff; font-weight: 800; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-pen-to-square"></i> ONARIM NOTUNU DÜZENLE
          </h3>
          <button onclick="document.getElementById('edit-note-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.4rem;">GÜNCEL NOT METNİ</label>
          <textarea id="edit-note-textarea" class="cyber-input" style="width: 100%; height: 130px; padding: 0.85rem; background: rgba(0,0,0,0.5); font-size: 0.88rem; line-height: 1.5; resize: none; box-sizing: border-box; color: #FFF; border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 8px;"></textarea>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" onclick="document.getElementById('edit-note-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.6rem 1.2rem; font-size: 0.82rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;">
            İPTAL
          </button>
          <button type="button" id="btn-save-edited-note" onclick="window.saveEditedWorkbenchNote('${repairId}', ${noteIndex})" class="btn-cyber" style="background: linear-gradient(135deg, #00f3ff 0%, #0284c7 100%); color: #0A0E17; font-weight: 900; padding: 0.6rem 1.4rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; box-shadow: 0 0 15px rgba(0,243,255,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            <i class="fa-solid fa-floppy-disk"></i> DEĞİŞİKLİKLERİ KAYDET
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    const textarea = document.getElementById('edit-note-textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = currentText;
      textarea.focus();
    }
  };

  (window as any).saveEditedWorkbenchNote = async (repairId: string, noteIndex: number) => {
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep || !rep.noteLogs || !rep.noteLogs[noteIndex]) return;

    const textarea = document.getElementById('edit-note-textarea') as HTMLTextAreaElement;
    const newText = (textarea?.value || '').trim();

    if (!newText) {
      alert("Not metni boş bırakılamaz.");
      return;
    }

    const saveBtn = document.getElementById('btn-save-edited-note') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    }

    try {
      rep.noteLogs[noteIndex].text = newText;
      const repDocRef = doc(db, 'repairs', repairId);
      await updateDoc(repDocRef, {
        noteLogs: rep.noteLogs,
        lastUpdated: serverTimestamp()
      });

      const textElem = document.getElementById(`wb-note-text-${noteIndex}`);
      if (textElem) textElem.innerText = newText;

      document.getElementById('edit-note-modal')?.remove();
      (window as any).showToast?.('Başarılı', 'Not başarıyla güncellendi.', 'success');
    } catch (err: any) {
      alert("Hata: " + err.message);
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> DEĞİŞİKLİKLERİ KAYDET';
      }
    }
  };

  (window as any).deleteWorkbenchNote = async (repairId: string, noteIndex: number) => {
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep || !rep.noteLogs || !rep.noteLogs[noteIndex]) return;

    if (!confirm("Bu onarım notunu silmek istediğinize emin misiniz?")) return;

    try {
      rep.noteLogs.splice(noteIndex, 1);
      const repDocRef = doc(db, 'repairs', repairId);
      await updateDoc(repDocRef, {
        noteLogs: rep.noteLogs,
        lastUpdated: serverTimestamp()
      });

      const itemElem = document.getElementById(`wb-note-item-${noteIndex}`);
      if (itemElem) itemElem.remove();
      const countElem = document.getElementById('wb-notes-count');
      if (countElem) countElem.innerText = String(rep.noteLogs.length);
      (window as any).showToast?.('Başarılı', 'Not başarıyla silindi.', 'success');
    } catch (err: any) {
      alert("Not silinirken hata oluştu: " + err.message);
    }
  };
  // 5. Fast Autocomplete Filtering for 1000+ Components
  (window as any).filterWorkbenchComponents = (query: string) => {
    const dropdown = document.getElementById('wb-comp-search-dropdown');
    const components: WorkshopComponent[] = (window as any)._workshopComponentsForTasks || [];
    if (!dropdown) return;

    const term = (query || '').trim().toLowerCase();
    
    // Filter matches
    const matches = components.filter(c => {
      if (!term) return true;
      const matchName = (c.name || '').toLowerCase().includes(term);
      const matchCode = (c.code || '').toLowerCase().includes(term);
      const matchVal = (c.value || '').toLowerCase().includes(term);
      const matchPkg = (c.package || '').toLowerCase().includes(term);
      const matchLoc = (c.shelfLocation || '').toLowerCase().includes(term);
      return matchName || matchCode || matchVal || matchPkg || matchLoc;
    }).slice(0, 20); // Top 20 fast results

    if (matches.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 10px 14px; color: #64748B; font-size: 0.8rem; font-style: italic;">
          Eşleşen komponent bulunamadı.
        </div>
      `;
      dropdown.style.display = 'block';
      return;
    }

    dropdown.innerHTML = matches.map(c => `
      <div 
        onclick="window.selectWorkbenchComponent('${c.id}')"
        style="padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: all 0.15s;"
        onmouseover="this.style.background='rgba(0, 242, 255, 0.1)';"
        onmouseout="this.style.background='transparent';"
      >
        <div>
          <div style="font-weight: 700; color: #FFF; font-size: 0.82rem;">
            ${c.name} <span style="color: #00f2ff; font-family: monospace; font-size: 0.75rem;">[${c.code}]</span>
          </div>
          <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">
            ${c.value ? c.value + ' • ' : ''}${c.package || ''} ${c.shelfLocation ? ' • Çekmece: ' + c.shelfLocation : ''}
          </div>
        </div>

        <div style="text-align: right;">
          <span style="background: ${c.quantity <= (c.minStock || 5) ? 'rgba(239, 68, 68, 0.15)' : 'rgba(20, 241, 149, 0.15)'}; color: ${c.quantity <= (c.minStock || 5) ? '#EF4444' : '#14F195'}; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; font-family: monospace;">
            Stok: ${c.quantity}
          </span>
        </div>
      </div>
    `).join('');

    dropdown.style.display = 'block';
  };

  // 6. Add selected component to the active workbench items list
  (window as any).selectWorkbenchComponent = (compId: string) => {
    const components: WorkshopComponent[] = (window as any)._workshopComponentsForTasks || [];
    const comp = components.find(c => c.id === compId);
    if (!comp) return;

    let selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];

    // Check if already in list -> increment qty
    const existing = selectedList.find(item => item.component.id === compId);
    if (existing) {
      if (existing.quantity < comp.quantity) {
        existing.quantity += 1;
      }
    } else {
      selectedList.push({
        component: comp,
        quantity: 1
      });
    }

    (window as any)._selectedWorkbenchComponents = selectedList;

    // Close dropdown & clear input
    const dropdown = document.getElementById('wb-comp-search-dropdown');
    const searchInput = document.getElementById('wb-comp-search-input') as HTMLInputElement;
    if (dropdown) dropdown.style.display = 'none';
    if (searchInput) searchInput.value = '';

    renderSelectedWorkbenchComponents();
  };

  const renderSelectedWorkbenchComponents = () => {
    const container = document.getElementById('selected-comp-list-container');
    const badge = document.getElementById('selected-comp-badge');
    const selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];
    if (!container) return;

    if (badge) {
      badge.innerText = `${selectedList.length} Kalem Parça Eklendi`;
      badge.style.color = selectedList.length > 0 ? '#14F195' : '#94A3B8';
    }

    if (selectedList.length === 0) {
      container.innerHTML = `
        <div id="no-comp-placeholder" style="color: #64748B; font-size: 0.78rem; text-align: center; padding: 1.25rem 0; font-style: italic;">
          Yukarıdaki arama çubuğundan parça arayıp tıklayarak ekleyebilirsiniz.
        </div>
      `;
      return;
    }

    container.innerHTML = selectedList.map((item, index) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.4); border: 1px solid rgba(0, 242, 255, 0.2); padding: 6px 10px; border-radius: 6px; font-size: 0.8rem;">
        <div style="flex: 1; min-width: 150px;">
          <div style="font-weight: 700; color: #FFF; font-size: 0.82rem;">
            ${item.component.name}
          </div>
          <div style="font-size: 0.7rem; color: #00f2ff; font-family: monospace;">
            [${item.component.code}] ${item.component.shelfLocation ? '• ' + item.component.shelfLocation : ''}
          </div>
        </div>

        <!-- Quantity Stepper -->
        <div style="display: flex; align-items: center; gap: 6px;">
          <button 
            type="button" 
            onclick="window.changeWorkbenchCompQty(${index}, -1)" 
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #FFF; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;"
          >-</button>
          
          <input 
            type="number" 
            min="1" 
            max="${item.component.quantity}" 
            value="${item.quantity}" 
            onchange="window.setWorkbenchCompQty(${index}, this.value)"
            style="width: 45px; height: 26px; background: rgba(0,0,0,0.6); border: 1px solid rgba(20, 241, 149, 0.3); border-radius: 4px; color: #14F195; text-align: center; font-weight: 800; font-size: 0.85rem;" 
          />

          <button 
            type="button" 
            onclick="window.changeWorkbenchCompQty(${index}, 1)" 
            style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); color: #FFF; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-weight: bold;"
          >+</button>

          <button 
            type="button" 
            onclick="window.removeWorkbenchComp(${index})" 
            style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; width: 26px; height: 26px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; justify-content: center; margin-left: 4px;"
            title="Kaldır"
          >
            <i class="fa-solid fa-trash" style="font-size: 0.7rem;"></i>
          </button>
        </div>
      </div>
    `).join('');
  };

  (window as any).changeWorkbenchCompQty = (index: number, delta: number) => {
    let selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];
    if (selectedList[index]) {
      const newQty = selectedList[index].quantity + delta;
      if (newQty <= 0) {
        selectedList.splice(index, 1);
      } else if (newQty <= selectedList[index].component.quantity) {
        selectedList[index].quantity = newQty;
      }
      (window as any)._selectedWorkbenchComponents = selectedList;
      renderSelectedWorkbenchComponents();
    }
  };

  (window as any).setWorkbenchCompQty = (index: number, val: string) => {
    let selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];
    const num = parseInt(val, 10);
    if (selectedList[index] && !isNaN(num) && num > 0) {
      selectedList[index].quantity = Math.min(num, selectedList[index].component.quantity);
      (window as any)._selectedWorkbenchComponents = selectedList;
      renderSelectedWorkbenchComponents();
    }
  };

  (window as any).removeWorkbenchComp = (index: number) => {
    let selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];
    if (selectedList[index]) {
      selectedList.splice(index, 1);
      (window as any)._selectedWorkbenchComponents = selectedList;
      renderSelectedWorkbenchComponents();
    }
  };

  // 7. Open Completion Options Modal (5. Onarıldı & Test Edildi vs 6. Onarıldı Türbinde Test)
  (window as any).openCompletionOptionsModal = (repairId: string) => {
    const modal = document.createElement('div');
    modal.id = 'completion-options-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10005; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 520px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.7);">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.85rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; color: #14F195; font-weight: 800;">
            <i class="fa-solid fa-clipboard-check" style="margin-right: 8px;"></i> ONARIM TAMAMLAMA DURUMU
          </h3>
          <button onclick="document.getElementById('completion-options-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <p style="font-size: 0.85rem; color: #CBD5E1; margin: 0 0 1.25rem 0;">
          Lütfen kartın test durumunu seçiniz. Seçiminiz kartın dijital karnesine ve yazdırılacak etiketine işlenecektir:
        </p>

        <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.5rem;">
          
          <!-- Option 1: 5. Onarıldı & Test Edildi -->
          <label style="background: rgba(20, 241, 149, 0.08); border: 2px solid #14F195; border-radius: 10px; padding: 1rem; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
            <input type="radio" name="completion_test_choice" value="TESTED" checked style="width: 20px; height: 20px; accent-color: #14F195; cursor: pointer;" />
            <div>
              <div style="font-weight: 800; color: #14F195; font-size: 0.95rem;">
                <i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> 5. Onarıldı & Test Edildi
              </div>
              <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">
                Atölye test masasında testi tamamlandı, %100 sağlam ve doğrulanmış kart.
              </div>
            </div>
          </label>

          <!-- Option 2: 6. Onarıldı (Türbinde Test) -->
          <label style="background: rgba(245, 158, 11, 0.08); border: 2px solid #F59E0B; border-radius: 10px; padding: 1rem; cursor: pointer; display: flex; align-items: center; gap: 12px; transition: all 0.2s;">
            <input type="radio" name="completion_test_choice" value="TURBINE_TEST" style="width: 20px; height: 20px; accent-color: #F59E0B; cursor: pointer;" />
            <div>
              <div style="font-weight: 800; color: #F59E0B; font-size: 0.95rem;">
                <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> 6. Onarıldı (Türbinde Test)
              </div>
              <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">
                Onarım yapıldı, sahada türbine monte edilerek test edilmesi gerekiyor.
              </div>
            </div>
          </label>

        </div>

        <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button type="button" onclick="document.getElementById('completion-options-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">
            İPTAL
          </button>
          <button type="button" id="btn-confirm-completion" onclick="window.confirmCompletionAndFinish('${repairId}')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.65rem 1.5rem; font-size: 0.88rem; box-shadow: 0 0 15px rgba(20,241,149,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
            ONAYLA VE SEVKE HAZIR YAP
          </button>
        </div>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).confirmCompletionAndFinish = async (repairId: string) => {
    const choice = (document.querySelector('input[name="completion_test_choice"]:checked') as HTMLInputElement)?.value || 'TESTED';
    document.getElementById('completion-options-modal')?.remove();
    await (window as any).saveWorkbenchDetails(repairId, choice);
  };

  // 8. Save Workbench Details (Draft OR Completed with TESTED / TURBINE_TEST)
  (window as any).saveWorkbenchDetails = async (repairId: string, completionMode: 'DRAFT' | 'TESTED' | 'TURBINE_TEST' = 'DRAFT') => {
    const workNote = (document.getElementById('wb-work-note') as HTMLTextAreaElement)?.value.trim();
    const stageSelect = document.getElementById('wb-task-stage') as HTMLSelectElement;
    const isCompleted = completionMode !== 'DRAFT';

    const stage = isCompleted ? (completionMode === 'TURBINE_TEST' ? 'TURBINE_TEST' : 'TESTED') : stageSelect?.value;

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    const saveBtn = document.getElementById('btn-save-workbench') as HTMLButtonElement;
    if (saveBtn) {
      saveBtn.setAttribute('disabled', 'true');
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      // 1. Check selected components in memory
      const selectedList: Array<{ component: WorkshopComponent; quantity: number }> = (window as any)._selectedWorkbenchComponents || [];
      const compItems: Array<{ componentId: string; quantity: number }> = [];
      selectedList.forEach(item => {
        if (item.component.id && item.quantity > 0) {
          compItems.push({
            componentId: item.component.id,
            quantity: item.quantity
          });
        }
      });

      // 2. Consume components from stock if any selected
      if (compItems.length > 0) {
        await workshopComponentService.useComponentsForRepair(repairId, compItems, userEmail, workNote);
      }

      // 3. Update Repair Document notes & status
      const repDocRef = doc(db, 'repairs', repairId);
      const updatePayload: any = {
        repairStage: stage,
        lastUpdated: serverTimestamp()
      };

      if (isCompleted) {
        updatePayload.status = 'REPAIRED';
        updatePayload.testStatus = completionMode === 'TURBINE_TEST' ? 'UNTESTED' : 'TESTED';
        updatePayload.repairedAt = new Date();
        updatePayload.repairedBy = userEmail;
      }

      if (workNote || isCompleted) {
        let logText = workNote;
        if (isCompleted) {
          const modeLabel = completionMode === 'TURBINE_TEST' ? '6. Onarıldı (Türbinde Test Edilecek)' : '5. Onarıldı & Test Edildi';
          logText = workNote ? `${modeLabel}: ${workNote}` : `${modeLabel} olarak tamamlandı ve sevke hazır duruma getirildi.`;
        }

        const newNoteLog = {
          date: new Date(),
          user: userEmail,
          stage: isCompleted ? (completionMode === 'TURBINE_TEST' ? 'ONARILDI_TURBINDE_TEST' : 'ONARILDI_TEST_EDILDI') : stage,
          text: logText
        };
        updatePayload.noteLogs = arrayUnion(newNoteLog);
      }

      await updateDoc(repDocRef, updatePayload);

      (window as any).showToast?.('Başarılı', isCompleted ? 'Kart onarımı tamamlandı ve sevke hazır duruma getirildi!' : 'İşlemler ve malzemeler kaydedildi.', 'success');
      document.getElementById('full-workbench-modal')?.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop-tasks');
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
      if (saveBtn) {
        saveBtn.removeAttribute('disabled');
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> KAYDET';
      }
    }
  };

  // 9. Bulk / Single Checkbox Selection in Completed Tab
  (window as any).toggleSelectAllCompleted = (checked: boolean) => {
    const cbs = document.querySelectorAll('.completed-task-cb') as NodeListOf<HTMLInputElement>;
    cbs.forEach(cb => { cb.checked = checked; });
    (window as any).updateCompletedSelection();
  };

  (window as any).updateCompletedSelection = () => {
    const cbs = document.querySelectorAll('.completed-task-cb:checked') as NodeListOf<HTMLInputElement>;
    selectedCompletedIds = Array.from(cbs).map(cb => cb.value).filter(Boolean);

    const countText = document.getElementById('selected-completed-count-text');
    if (countText) {
      countText.innerText = `(${selectedCompletedIds.length} kart seçildi)`;
    }

    const selectAllCb = document.getElementById('cb-select-all-completed') as HTMLInputElement;
    const allCbs = document.querySelectorAll('.completed-task-cb') as NodeListOf<HTMLInputElement>;
    if (selectAllCb && allCbs.length > 0) {
      selectAllCb.checked = selectedCompletedIds.length === allCbs.length;
    }
  };

  // 10. Print Bulk Labels for Selected Completed Cards
  (window as any).printSelectedCompletedLabels = async () => {
    if (selectedCompletedIds.length === 0) {
      alert("Lütfen etiket basmak için en az bir kart seçin.");
      return;
    }

    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const selectedCards = allRepairs.filter(r => selectedCompletedIds.includes(r.id!));
    if (selectedCards.length === 0) return;

    const { qrService } = await import('../services/QRService');
    const cards = selectedCards.map(item => ({
      id: item.id,
      sapNo: item.sapNo,
      serialNo: item.serialNo,
      description: item.description,
      testStatus: (item.testStatus || (item.status === 'REPAIRED' ? 'TESTED' : 'UNTESTED')) as 'TESTED' | 'UNTESTED',
      repairNotes: item.repairNotes,
      shelfNo: item.shelfNo
    }));

    await qrService.printBulkWorkshopCardLabels(cards);
  };

  // 11. Dispatch Modals (Single / Bulk)
  (window as any).openDispatchModalForSingle = (repairId: string) => {
    (window as any).openDispatchWorkflowModal([repairId]);
  };

  (window as any).openDispatchModalForSelected = () => {
    if (selectedCompletedIds.length === 0) {
      alert("Lütfen sevk etmek için en az bir kart seçin.");
      return;
    }
    (window as any).openDispatchWorkflowModal(selectedCompletedIds);
  };

  (window as any).openDispatchWorkflowModal = (repairIds: string[]) => {
    const allRepairs: RepairRecord[] = (window as any)._allRawRepairsForVerification || [];
    const warehouses: any[] = (window as any)._allWarehousesList || [];
    const selectedCards = allRepairs.filter(r => repairIds.includes(r.id!));
    if (selectedCards.length === 0) return;

    // Default target warehouse (can be the source of first card)
    const defaultWh = selectedCards[0]?.sourceWarehouseId || '';

    const modal = document.createElement('div');
    modal.id = 'dispatch-workflow-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10005; display: flex; align-items: center; justify-content: center;
    `;

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 620px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.4); box-shadow: 0 20px 50px rgba(0,0,0,0.7); max-height: 92vh; overflow-y: auto;">
        
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.85rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; color: #10B981; font-weight: 800;">
            <i class="fa-solid fa-truck-fast" style="margin-right: 8px;"></i> ONARILAN KARTLARI DEPOYA SEVK ET
          </h3>
          <button onclick="document.getElementById('dispatch-workflow-modal').remove()" style="background: transparent; border: none; color: #94A3B8; cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Selected Cards List Summary -->
        <div style="margin-bottom: 1.25rem;">
          <label style="display: block; color: #94A3B8; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.4rem;">
            SEVK EDİLECEK KARTLAR (${selectedCards.length} Kart)
          </label>
          <div style="display: flex; flex-direction: column; gap: 6px; max-height: 140px; overflow-y: auto; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 8px;">
            ${selectedCards.map(c => `
              <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem;">
                <span style="font-weight: 700; color: #FFF;">${c.description}</span>
                <span style="color: #60a5fa; font-family: monospace;">SAP: ${c.sapNo} | Seri: ${c.serialNo || '-'}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <form id="dispatch-form" onsubmit="event.preventDefault(); window.submitDispatchWorkflow('${repairIds.join(',')}');">
          
          <!-- Target Warehouse Dropdown -->
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; color: #10B981; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.4rem;">
              HEDEF SEVK DEPOSU / SANTRAL *
            </label>
            <select id="dispatch-target-wh" required style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #FFF; font-size: 0.88rem; outline: none; cursor: pointer;">
              <option value="">-- Hedef Depoyu Seçin --</option>
              ${warehouses.map(w => `
                <option value="${w.id}" ${w.id === defaultWh ? 'selected' : ''}>
                  ${w.name} (${w.id})
                </option>
              `).join('')}
            </select>
          </div>

          <!-- Kargo / Takip / İrsaliye No -->
          <div style="margin-bottom: 1.25rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.4rem;">
              KARGO TAKİP NO / SEVK İRSALİYE NO
            </label>
            <input type="text" id="dispatch-tracking-no" class="cyber-input" placeholder="Örn: YK-98421731 (Yurtiçi Kargo)" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.4);" />
          </div>

          <!-- Sevk Notu -->
          <div style="margin-bottom: 1.5rem;">
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.4rem;">
              SEVKİYAT NOTU / AÇIKLAMA
            </label>
            <textarea id="dispatch-note" class="cyber-input" placeholder="Onarımları tamamlanan kartlar saha deposuna sevk edildi..." style="width: 100%; height: 75px; padding: 0.75rem; background: rgba(0,0,0,0.4); resize: none;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 1.25rem;">
            <button type="button" onclick="document.getElementById('dispatch-workflow-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #FFF; font-weight: 700; padding: 0.65rem 1.25rem; font-size: 0.85rem;">
              İPTAL
            </button>
            <button type="submit" id="btn-submit-dispatch" class="btn-cyber" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 900; padding: 0.65rem 1.6rem; font-size: 0.88rem; box-shadow: 0 0 15px rgba(16,185,129,0.3); font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              <i class="fa-solid fa-truck-fast"></i> SEVKİYATI BAŞLAT
            </button>
          </div>

        </form>

      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitDispatchWorkflow = async (rawIdsStr: string) => {
    const ids = rawIdsStr.split(',').filter(Boolean);
    const targetWhId = (document.getElementById('dispatch-target-wh') as HTMLSelectElement)?.value;
    const trackingNo = (document.getElementById('dispatch-tracking-no') as HTMLInputElement)?.value.trim();
    const note = (document.getElementById('dispatch-note') as HTMLTextAreaElement)?.value.trim();

    if (!targetWhId) {
      alert("Lütfen hedef sevk deposunu seçiniz.");
      return;
    }

    const btn = document.getElementById('btn-submit-dispatch') as HTMLButtonElement;
    if (btn) {
      btn.setAttribute('disabled', 'true');
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sevk Ediliyor...';
    }

    const user = (window as any).currentUser;
    const userEmail = user?.email || user?.displayName || 'Sistem';

    try {
      const batch = writeBatch(db);
      const now = new Date();

      for (const id of ids) {
        const docRef = doc(db, 'repairs', id);
        const logLine = trackingNo 
          ? `Depoya Sevk Edildi (Takip/İrsaliye: ${trackingNo}): ${note || 'Sevk başlatıldı'}`
          : `Depoya Sevk Edildi: ${note || 'Sevk başlatıldı'}`;

        const newNoteLog = {
          date: now,
          user: userEmail,
          stage: 'SEVK_EDILDI',
          text: logLine
        };

        batch.update(docRef, {
          status: 'SENT_BACK',
          targetWarehouseId: targetWhId,
          dispatchedAt: serverTimestamp(),
          dispatchedBy: userEmail,
          dispatchNo: trackingNo || null,
          noteLogs: arrayUnion(newNoteLog),
          lastUpdated: serverTimestamp()
        });
      }

      await batch.commit();

      repairService.invalidateCache();
      (window as any).showToast?.('Başarılı', `${ids.length} adet kart hedef depoya sevk edildi!`, 'success');
      document.getElementById('dispatch-workflow-modal')?.remove();

      selectedCompletedIds = [];

      if ((window as any).navigate) {
        (window as any).navigate('workshop-tasks');
      }
    } catch (err: any) {
      alert("Hata: " + err.message);
      if (btn) {
        btn.removeAttribute('disabled');
        btn.innerHTML = '<i class="fa-solid fa-truck-fast"></i> SEVKİYATI BAŞLAT';
      }
    }
  };

};
