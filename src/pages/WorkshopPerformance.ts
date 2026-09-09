import { repairService, type RepairRecord } from '../services/RepairService';
import { workshopComponentService } from '../services/WorkshopComponentService';
import { workshopDiagnosisService, type CardDiagnosisSuggestion } from '../services/WorkshopDiagnosisService';
import { serviceReportService } from '../services/ServiceReportService';
import * as XLSX from 'xlsx';

export const WorkshopPerformancePage = async () => {
  const user = (window as any).currentUser;
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const isAuthorized = userProfile?.role === 'ADMIN' || 
                       userProfile?.role === 'MALZEME_YONETIMI' || 
                       user?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' || 
                       user?.email?.toLowerCase() === 'fatih.zebek@demirerholding.com';

  if (!isAuthorized) {
    return `
      <div style="min-height: 80vh; display: flex; align-items: center; justify-content: center; color: #EF4444; font-family: 'Rajdhani', sans-serif; text-align: center;">
        <div class="glass-panel" style="padding: 2.5rem; border-radius: 16px; border: 1px solid rgba(239, 68, 68, 0.3); background: rgba(239, 68, 68, 0.05); max-width: 480px;">
          <div style="font-size: 3rem; margin-bottom: 1rem;"><i class="fa-solid fa-lock"></i></div>
          <h2 style="font-size: 1.6rem; color: #FFF; margin: 0 0 0.5rem 0;">YETKİSİZ ERİŞİM</h2>
          <p style="color: #94A3B8; font-size: 0.9rem;">Bu performans ve arıza teşhis paneli yalnızca Yönetim ve Malzeme Yönetimi yetkililerine özeldir.</p>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="margin-top: 1rem; background: #14F195; color: #0A0E17; font-weight: 800; padding: 0.5rem 1.25rem; border-radius: 8px;">
            Atölye Tezgahına Dön
          </button>
        </div>
      </div>
    `;
  }

  const allRepairs: RepairRecord[] = await repairService.getRepairs(true);
  const liveComponents = await workshopComponentService.getComponents(true);
  const knowledgeBase = workshopDiagnosisService.getAllKnowledgeBase();

  (window as any)._perfAllRepairs = allRepairs;
  (window as any)._perfKnowledgeBase = knowledgeBase;

  // 1. Fetch all service reports to match turbine installation dates
  const turbineUsageMap = new Map<string, {
    siteName: string;
    turbineNo: string;
    installDate: Date;
    reportNo: string;
    personnel: string;
  }>();

  try {
    const allReports = await serviceReportService.getAllReports();
    allReports.forEach(report => {
      const dateVal: any = report.date;
      const repDate = dateVal?.toDate ? dateVal.toDate() : new Date(dateVal);
      if (isNaN(repDate.getTime())) return;

      report.materials.forEach((mat: any) => {
        if ((mat.used || 0) > 0) {
          const matSap = String(mat.sapNo || '').trim();
          const matSerial = String(mat.serialNo || '').trim().toLowerCase();
          if (matSerial && matSerial !== '-' && matSerial !== 'yok' && matSerial !== 'yoktur') {
            const rawSap = matSap.startsWith('R') ? matSap.slice(1) : matSap;
            const usageInfo = {
              siteName: report.siteName || '',
              turbineNo: report.turbineNo || 'Türbin',
              installDate: repDate,
              reportNo: report.reportNo || report.id || '-',
              personnel: report.createdBy || report.personnel?.[0] || 'Teknisyen'
            };
            turbineUsageMap.set(`${rawSap}___${matSerial}`, usageInfo);
            turbineUsageMap.set(`${matSap}___${matSerial}`, usageInfo);
          }
        }
      });
    });
  } catch (err) {
    console.error("Error loading service reports for performance page:", err);
  }

  // 2. Build card history map for accurate field return detection
  const cardHistoryMap = new Map<string, RepairRecord[]>();
  allRepairs.forEach(r => {
    const s = (r.serialNo || '').trim().toLowerCase();
    const sap = (r.sapNo || '').trim();
    if (s && s !== '-' && s !== 'yok' && s !== 'yoktur') {
      const key = `${sap}___${s}`;
      if (!cardHistoryMap.has(key)) cardHistoryMap.set(key, []);
      cardHistoryMap.get(key)!.push(r);
    }
  });

  const isCardReturned = (r: RepairRecord): boolean => {
    const s = (r.serialNo || '').trim().toLowerCase();
    const sap = (r.sapNo || '').trim();
    if (!s || s === '-' || s === 'yok' || s === 'yoktur') return false;
    const history = cardHistoryMap.get(`${sap}___${s}`);
    if (!history || history.length < 2) return false;
    return history.some(h => h.status === 'SENT_BACK' || h.status === 'COMPLETED');
  };

  // 3. 60-Day (2-Month) Turbine Guarantee & Success Evaluator
  type CardFieldStatus = 'SUCCESSFUL_60_DAYS' | 'EARLY_FAULT' | 'IN_TRIAL' | 'PENDING_INSTALL';

  const getCardFieldStatus = (r: RepairRecord): { status: CardFieldStatus; days: number; text: string } => {
    if (r.status !== 'REPAIRED' && r.status !== 'SENT_BACK' && r.status !== 'COMPLETED') {
      return { status: 'PENDING_INSTALL', days: 0, text: 'Atölyede İşlemde / Beklemede' };
    }

    const s = (r.serialNo || '').trim().toLowerCase();
    const sap = (r.sapNo || '').trim();
    const usage = turbineUsageMap.get(`${sap}___${s}`);

    // If card hasn't been mounted to a turbine yet
    if (!usage) {
      return { status: 'PENDING_INSTALL', days: 0, text: 'Sevkiyat / Türbin Montajı Bekliyor' };
    }

    const isReturned = isCardReturned(r);
    const nowMs = Date.now();
    const installMs = usage.installDate.getTime();
    const daysSinceInstall = Math.floor((nowMs - installMs) / (1000 * 60 * 60 * 24));

    if (isReturned) {
      if (daysSinceInstall < 60) {
        return { status: 'EARLY_FAULT', days: Math.max(1, daysSinceInstall), text: `❌ Erken Arıza (${Math.max(1, daysSinceInstall)} Gün Sonra Söküldü)` };
      } else {
        return { status: 'SUCCESSFUL_60_DAYS', days: daysSinceInstall, text: `✅ 2 Ayı Geçti (${daysSinceInstall} Gün Çalıştı)` };
      }
    } else {
      if (daysSinceInstall >= 60) {
        return { status: 'SUCCESSFUL_60_DAYS', days: daysSinceInstall, text: `✅ Başarılı (${daysSinceInstall} Gündür Sorunsuz Çalışıyor)` };
      } else {
        return { status: 'IN_TRIAL', days: daysSinceInstall, text: `⏳ Sahada Deneniyor (${daysSinceInstall}/60 Gün)` };
      }
    }
  };

  // 4. Overall Metrics
  const totalCards = allRepairs.length;
  const repairedCards = allRepairs.filter(r => r.status === 'REPAIRED' || r.status === 'SENT_BACK' || r.status === 'COMPLETED');
  const scrappedCards = allRepairs.filter(r => r.status === 'SCRAPPED');

  // Masada Aktif Onarımda Olan Kartlar (İş emri açılmış / masaya alınmış)
  const activeOnBenchCards = allRepairs.filter(r => 
    r.status === 'UNDER_REPAIR' && ((!!r.assignedTo && r.assignedTo.trim() !== '' && r.assignedTo !== '-') || !!r.repairStage)
  );

  // Tamir Bekleyen Atölye Stoğu (Henüz masaya alınmamış kart stoğu)
  const waitingStockCards = allRepairs.filter(r => 
    r.status === 'UNDER_REPAIR' && (!r.assignedTo || r.assignedTo.trim() === '' || r.assignedTo === '-') && !r.repairStage
  );

  let validatedSuccessfulCount = 0;
  let earlyFaultCount = 0;
  let inTrialCount = 0;
  let pendingInstallCount = 0;

  repairedCards.forEach(r => {
    const fs = getCardFieldStatus(r);
    if (fs.status === 'SUCCESSFUL_60_DAYS') validatedSuccessfulCount++;
    else if (fs.status === 'EARLY_FAULT') earlyFaultCount++;
    else if (fs.status === 'IN_TRIAL') inTrialCount++;
    else if (fs.status === 'PENDING_INSTALL') pendingInstallCount++;
  });

  const totalEvaluated = validatedSuccessfulCount + earlyFaultCount;
  const hasEvaluated = totalEvaluated > 0;
  const successRateNum = hasEvaluated ? ((validatedSuccessfulCount / totalEvaluated) * 100) : 0;
  const successRateDisplay = hasEvaluated ? `%${successRateNum.toFixed(1)}` : '-';

  // Recovery vs Scrap Rate
  const totalDecided = repairedCards.length + scrappedCards.length;
  const recoveryRateDisplay = totalDecided > 0 ? `%${((repairedCards.length / totalDecided) * 100).toFixed(1)}` : '-';

  // This month completed
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thisMonthRepaired = repairedCards.filter(r => {
    const d = r.repairedAt ? (r.repairedAt.toDate ? r.repairedAt.toDate() : new Date(r.repairedAt)) : null;
    return d && d >= startOfMonth;
  }).length;

  // 5. Technician Performance Breakdown
  const techMap = new Map<string, {
    name: string;
    email: string;
    activeCount: number;
    thisMonthCount: number;
    totalRepaired: number;
    scrappedCount: number;
    validatedSuccess: number;
    earlyFault: number;
    inTrial: number;
    pendingInstall: number;
  }>();

  allRepairs.forEach(rep => {
    const isAssigned = !!rep.assignedTo && rep.assignedTo.trim() !== '' && rep.assignedTo !== '-';
    const isActivelyWorked = isAssigned && (rep.status === 'UNDER_REPAIR' || !!rep.repairStage);

    const tech = rep.assignedTo || rep.scrappedBy || rep.repairedBy || '';
    const cleanTech = tech.trim();
    if (!cleanTech) return; // Skip unassigned cards

    if (!techMap.has(cleanTech)) {
      techMap.set(cleanTech, {
        name: cleanTech.includes('@') ? cleanTech.split('@')[0].toUpperCase() : cleanTech,
        email: cleanTech,
        activeCount: 0,
        thisMonthCount: 0,
        totalRepaired: 0,
        scrappedCount: 0,
        validatedSuccess: 0,
        earlyFault: 0,
        inTrial: 0,
        pendingInstall: 0
      });
    }

    const tObj = techMap.get(cleanTech)!;
    if (isActivelyWorked) tObj.activeCount++;
    if (rep.status === 'REPAIRED' || rep.status === 'SENT_BACK' || rep.status === 'COMPLETED') {
      tObj.totalRepaired++;
      const d = rep.repairedAt ? (rep.repairedAt.toDate ? rep.repairedAt.toDate() : new Date(rep.repairedAt)) : null;
      if (d && d >= startOfMonth) tObj.thisMonthCount++;

      const fs = getCardFieldStatus(rep);
      if (fs.status === 'SUCCESSFUL_60_DAYS') tObj.validatedSuccess++;
      else if (fs.status === 'EARLY_FAULT') tObj.earlyFault++;
      else if (fs.status === 'IN_TRIAL') tObj.inTrial++;
      else if (fs.status === 'PENDING_INSTALL') tObj.pendingInstall++;
    }
    if (rep.status === 'SCRAPPED') tObj.scrappedCount++;
  });

  const technicianStats = Array.from(techMap.values())
    .sort((a, b) => b.totalRepaired - a.totalRepaired || b.activeCount - a.activeCount);

  // 6. SAP Model Breakdown
  const modelMap = new Map<string, {
    sapNo: string;
    description: string;
    total: number;
    repaired: number;
    scrapped: number;
    waiting: number;
    validatedSuccess: number;
    earlyFault: number;
    inTrial: number;
    pendingInstall: number;
  }>();

  allRepairs.forEach(r => {
    const sap = r.sapNo || 'Bilinmeyen';
    if (!modelMap.has(sap)) {
      modelMap.set(sap, {
        sapNo: sap,
        description: r.description || `SAP-${sap}`,
        total: 0,
        repaired: 0,
        scrapped: 0,
        waiting: 0,
        validatedSuccess: 0,
        earlyFault: 0,
        inTrial: 0,
        pendingInstall: 0
      });
    }
    const m = modelMap.get(sap)!;
    m.total++;
    if (r.status === 'REPAIRED' || r.status === 'SENT_BACK' || r.status === 'COMPLETED') {
      m.repaired++;
      const fs = getCardFieldStatus(r);
      if (fs.status === 'SUCCESSFUL_60_DAYS') m.validatedSuccess++;
      else if (fs.status === 'EARLY_FAULT') m.earlyFault++;
      else if (fs.status === 'IN_TRIAL') m.inTrial++;
      else if (fs.status === 'PENDING_INSTALL') m.pendingInstall++;
    }
    if (r.status === 'SCRAPPED') m.scrapped++;
    if (r.status === 'UNDER_REPAIR' || r.status === 'PENDING_ARRIVAL') m.waiting++;
  });

  const modelStats = Array.from(modelMap.values()).sort((a, b) => b.repaired - a.repaired || b.total - a.total);

  // Global window functions
  setupPerformanceHandlers(technicianStats, modelStats);

  return `
    <div class="fade-in-up content-area" style="min-height: 100vh; background-color: #0A0E17; color: #E2E8F0; font-family: 'Inter', -apple-system, sans-serif; padding: 2rem; box-sizing: border-box;">
      
      <!-- Top Page Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <button onclick="if(window.navigate) window.navigate('workshop');" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #94A3B8; width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.1)'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(255,255,255,0.05)'; this.style.color='#94A3B8';" title="Atölye Tezgahına Dön">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; font-weight: 800; text-transform: uppercase; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">
                  YÖNETİM & MALZEME YÖNETİMİ ÖZEL
                </span>
                <span style="font-size: 0.8rem; color: #64748B;">•</span>
                <span style="font-size: 0.8rem; color: #94A3B8;">MTA Performans & AI Arıza Teşhis</span>
              </div>
              <h1 style="font-family: 'Rajdhani', sans-serif; font-size: 1.85rem; font-weight: 800; color: #FFFFFF; margin: 4px 0 0 0; letter-spacing: 0.5px;">
                <i class="fa-solid fa-gauge-high" style="color: #14F195; margin-right: 8px;"></i>
                ATÖLYE TAMİR BAŞARI & VERİMLİLİK ANALİZİ
              </h1>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="window.exportWorkshopPerformanceExcel()" class="btn-cyber" style="background: rgba(0, 242, 255, 0.1); color: #00f2ff; border: 1px solid rgba(0, 242, 255, 0.3); font-weight: 800; padding: 0.6rem 1.15rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;" onmouseover="this.style.background='rgba(0, 242, 255, 0.2)'" onmouseout="this.style.background='rgba(0, 242, 255, 0.1)'">
            <i class="fa-solid fa-file-excel"></i> PERFORMANS RAPORU (EXCEL)
          </button>
          <button onclick="window.navigate('workshop')" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 900; padding: 0.6rem 1.25rem; border-radius: 8px; font-size: 0.85rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif; box-shadow: 0 0 20px rgba(20,241,149,0.3);">
            <i class="fa-solid fa-screwdriver-wrench"></i> ATÖLYE TEZGAHINA GEÇ
          </button>
        </div>
      </div>

      <!-- Information Banner: 60-Day Turbine Evaluation Rule -->
      <div style="background: rgba(59, 130, 246, 0.08); border: 1px solid rgba(59, 130, 246, 0.25); border-radius: 10px; padding: 0.85rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; gap: 12px;">
        <i class="fa-solid fa-shield-halved" style="color: #60a5fa; font-size: 1.3rem;"></i>
        <div style="font-size: 0.82rem; color: #CBD5E1; line-height: 1.4;">
          <strong style="color: #60a5fa;">60 Günlük (2 Aylık) Türbin Test Standardı:</strong> 
          Bir kartın "Başarılı" sayılması için sahaya sevk edilip türbine takıldıktan sonra <strong>en az 60 gün (2 ay)</strong> hatasız çalışması gerekir. 
          Henüz takılmamış kartlar başarı oranına dahil edilmez; 60 günden önce sökülenler erken arıza sayılır.
        </div>
      </div>

      <!-- Top Metric Cards Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        
        <!-- Success Rate (Validated >=60 days) -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #14F195; background: rgba(20, 241, 149, 0.04); display: flex; justify-content: space-between; align-items: center; box-shadow: 0 0 25px rgba(20,241,149,0.1);">
          <div>
            <div style="font-size: 0.74rem; color: #14F195; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Saha Başarı Oranı (≥60 Gün)</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${successRateDisplay}</div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">
              ${hasEvaluated ? `${validatedSuccessfulCount} Başarılı (≥60 Gün) / ${earlyFaultCount} Erken Arıza` : (pendingInstallCount > 0 ? `${pendingInstallCount} Kart Sevkiyat / Montaj Bekliyor` : 'Henüz türbin test verisi yok')}
            </div>
          </div>
          <div style="width: 46px; height: 46px; border-radius: 10px; background: rgba(20, 241, 149, 0.15); color: #14F195; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
        </div>

        <!-- Recovery Rate -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #00f2ff; background: rgba(0, 242, 255, 0.04); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.74rem; color: #00f2ff; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Kurtarma / Hurda Oranı</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${recoveryRateDisplay}</div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">${repairedCards.length} Kurtarıldı / ${scrappedCards.length} Hurda</div>
          </div>
          <div style="width: 46px; height: 46px; border-radius: 10px; background: rgba(0, 242, 255, 0.15); color: #00f2ff; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            <i class="fa-solid fa-microchip"></i>
          </div>
        </div>

        <!-- This Month Repaired -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #60a5fa; background: rgba(59, 130, 246, 0.04); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.74rem; color: #60a5fa; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Bu Ay Tamamlanan Onarım</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${thisMonthRepaired} <span style="font-size: 0.9rem; color: #94A3B8; font-weight: 600;">Kart</span></div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Toplam tamamlanan: ${repairedCards.length} Adet</div>
          </div>
          <div style="width: 46px; height: 46px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            <i class="fa-solid fa-calendar-check"></i>
          </div>
        </div>

        <!-- Active in Workshop vs Waiting Stock -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #F59E0B; background: rgba(245, 158, 11, 0.04); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 0.74rem; color: #F59E0B; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">Masada Aktif Onarımda</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${activeOnBenchCards.length} <span style="font-size: 0.9rem; color: #94A3B8; font-weight: 600;">İş Emri</span></div>
            <div style="font-size: 0.72rem; color: #94A3B8; margin-top: 2px;">Rafta bekleyen stok: <strong style="color: #F59E0B;">${waitingStockCards.length} Kart</strong></div>
          </div>
          <div style="width: 46px; height: 46px; border-radius: 10px; background: rgba(245, 158, 11, 0.15); color: #F59E0B; display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            <i class="fa-solid fa-screwdriver-wrench"></i>
          </div>
        </div>

      </div>

      <!-- Main Dual Grid: Technician Performance & AI Diagnosis Knowledge Base -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem; align-items: flex-start;">
        
        <!-- Technician Performance Table -->
        <div class="glass-panel" style="border: 1px solid #1E293B; border-radius: 14px; padding: 1.5rem; background: #111827; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #FFF; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-users-gear" style="color: #60a5fa;"></i> TEKNİSYEN PERFORMANS & İŞ DAĞILIMI
            </h3>
            <span style="font-size: 0.75rem; color: #94A3B8; font-weight: 700;">${technicianStats.length} Teknisyen</span>
          </div>

          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
              <thead>
                <tr style="color: #94A3B8; border-bottom: 1px solid #1E293B; font-weight: 700;">
                  <th style="padding: 0.6rem 0.75rem;">Teknisyen</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: center;">Masada</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: center;">Bu Ay</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: center;">Tamamlanan</th>
                  <th style="padding: 0.6rem 0.75rem; text-align: right;">Saha Başarı Oranı</th>
                </tr>
              </thead>
              <tbody>
                ${technicianStats.length === 0 ? `
                  <tr><td colspan="5" style="text-align: center; padding: 2rem; color: #64748B;">Henüz atanmış veya tamamlanmış teknisyen kaydı bulunmuyor.</td></tr>
                ` : technicianStats.map(t => {
                  const techEvaluated = t.validatedSuccess + t.earlyFault;
                  let techSuccessBadge = `<span style="color: #64748B; font-weight: 700;" title="Kart henüz türbine takılmadı veya 60 günlük testte">-</span>`;
                  if (techEvaluated > 0) {
                    const techSuccess = ((t.validatedSuccess / techEvaluated) * 100).toFixed(1);
                    techSuccessBadge = `
                      <span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-family: monospace;" title="${t.validatedSuccess} Başarılı / ${t.earlyFault} Erken Arıza">
                        %${techSuccess}
                      </span>
                    `;
                  } else if (t.scrappedCount > 0 && t.totalRepaired === 0) {
                    techSuccessBadge = `
                      <span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                        %0.0
                      </span>
                    `;
                  }

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                      <td style="padding: 0.75rem; font-weight: 800; color: #FFF; display: flex; align-items: center; gap: 8px;">
                        <div style="width: 28px; height: 28px; border-radius: 50%; background: rgba(59, 130, 246, 0.2); color: #60a5fa; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 900;">
                          ${t.name.slice(0, 2)}
                        </div>
                        <div>
                          <div>${t.name}</div>
                          <div style="font-size: 0.7rem; color: #64748B; font-weight: normal;">${t.email}</div>
                        </div>
                      </td>
                      <td style="padding: 0.75rem; text-align: center;">
                        <span style="background: ${t.activeCount > 0 ? 'rgba(245, 158, 11, 0.15)' : 'rgba(255,255,255,0.03)'}; color: ${t.activeCount > 0 ? '#F59E0B' : '#64748B'}; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                          ${t.activeCount}
                        </span>
                      </td>
                      <td style="padding: 0.75rem; text-align: center; color: ${t.thisMonthCount > 0 ? '#38bdf8' : '#64748B'}; font-weight: 800; font-family: monospace;">
                        ${t.thisMonthCount}
                      </td>
                      <td style="padding: 0.75rem; text-align: center; font-weight: 900; color: ${t.totalRepaired > 0 ? '#FFF' : '#64748B'}; font-family: monospace;">
                        ${t.totalRepaired}
                      </td>
                      <td style="padding: 0.75rem; text-align: right;">
                        ${techSuccessBadge}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Smart AI Diagnosis Assistant & Knowledge Base Viewer -->
        <div class="glass-panel" style="border: 1px solid rgba(0, 242, 255, 0.25); border-radius: 14px; padding: 1.5rem; background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(10, 14, 23, 0.95) 100%); box-shadow: 0 0 30px rgba(0,242,255,0.08);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #00f2ff; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-brain" style="color: #00f2ff;"></i> 🧠 AKILLI KART ARIZA TEŞHİS & ÖNERİ ASİSTANI
            </h3>
            <span style="background: rgba(0, 242, 255, 0.15); color: #00f2ff; border: 1px solid rgba(0, 242, 255, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
              AI REÇETE
            </span>
          </div>

          <!-- Model Selector -->
          <div style="margin-bottom: 1rem;">
            <label style="display: block; font-size: 0.78rem; color: #94A3B8; font-weight: 700; margin-bottom: 0.4rem;">
              İNCELEMEK İSTEDİĞİNİZ KART MODELİNİ SEÇİN:
            </label>
            <select id="diag-model-select" onchange="window.onDiagnosisModelChange(this.value)" class="cyber-input" style="width: 100%; height: 38px; padding: 0 0.85rem; background: rgba(0,0,0,0.5); border: 1px solid rgba(0, 242, 255, 0.3); color: #00f2ff; font-weight: 700; font-size: 0.82rem; border-radius: 8px; cursor: pointer;">
              ${knowledgeBase.map(k => `
                <option value="${k.sapNo}">SAP ${k.sapNo} — ${k.cardName}</option>
              `).join('')}
            </select>
          </div>

          <!-- Selected Diagnosis Detail Box -->
          <div id="diagnosis-detail-container">
            ${renderDiagnosisDetail(knowledgeBase[0])}
          </div>

        </div>

      </div>

      <!-- Bottom Model-by-Model Success & Backlog Table -->
      <div class="glass-panel" style="border: 1px solid #1E293B; border-radius: 14px; padding: 1.5rem; background: #111827; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
          <div>
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.25rem; font-weight: 800; color: #FFF; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-layer-group" style="color: #14F195;"></i> KART MODELLERİNE GÖRE TAMİR VERİMLİLİĞİ & 60 GÜNLÜK SAHA DURUMU
            </h3>
            <div style="font-size: 0.75rem; color: #94A3B8; margin-top: 2px;">
              Türbine takılan kartlar 60 gün (2 ay) sorunsuz çalıştığında başarı onaylanır.
            </div>
          </div>
          <span style="font-size: 0.75rem; color: #94A3B8; font-weight: 700;">Toplam ${modelStats.length} Kart Tipi</span>
        </div>

        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; text-align: left;">
            <thead>
              <tr style="color: #94A3B8; border-bottom: 1px solid #1E293B; font-weight: 700;">
                <th style="padding: 0.75rem 1rem;">SAP No</th>
                <th style="padding: 0.75rem 1rem;">Kart Modeli Tanımı</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Toplam Stok</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Tamir Bekleyen</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Onarılan</th>
                <th style="padding: 0.75rem 1rem; text-align: center;">Saha Durumu</th>
                <th style="padding: 0.75rem 1rem; text-align: right;">Saha Başarı Oranı</th>
              </tr>
            </thead>
            <tbody>
              ${modelStats.map(m => {
                const modelEvaluated = m.validatedSuccess + m.earlyFault;
                let modSuccessBadge = `<span style="color: #64748B; font-weight: 700;">-</span>`;
                let fieldStatusText = `<span style="color: #64748B;">-</span>`;

                if (m.repaired > 0) {
                  if (m.validatedSuccess > 0) {
                    fieldStatusText = `<span style="color: #14F195; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> ${m.validatedSuccess} Kart (≥60 Gün)</span>`;
                  } else if (m.inTrial > 0) {
                    fieldStatusText = `<span style="color: #38bdf8; font-weight: 700;"><i class="fa-solid fa-clock"></i> ${m.inTrial} Kart Sahada Deneniyor</span>`;
                  } else if (m.earlyFault > 0) {
                    fieldStatusText = `<span style="color: #EF4444; font-weight: 700;"><i class="fa-solid fa-triangle-exclamation"></i> ${m.earlyFault} Erken Arıza</span>`;
                  } else {
                    fieldStatusText = `<span style="color: #F59E0B; font-weight: 700;"><i class="fa-solid fa-truck-ramp-box"></i> ${m.pendingInstall} Sevkiyat/Montaj Bekliyor</span>`;
                  }
                }

                if (modelEvaluated > 0) {
                  const modSuccess = ((m.validatedSuccess / modelEvaluated) * 100).toFixed(1);
                  modSuccessBadge = `
                    <span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                      %${modSuccess}
                    </span>
                  `;
                } else if (m.scrapped > 0 && m.repaired === 0) {
                  modSuccessBadge = `
                    <span style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                      %0.0
                    </span>
                  `;
                }

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                    <td style="padding: 0.75rem 1rem; font-family: monospace; font-weight: 800; color: #00f2ff;">
                      ${m.sapNo}
                    </td>
                    <td style="padding: 0.75rem 1rem; font-weight: 700; color: #FFF;">
                      ${m.description}
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center; font-weight: 800; color: #E2E8F0;">
                      ${m.total} Adet
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">
                      <span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                        ${m.waiting}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center;">
                      <span style="background: ${m.repaired > 0 ? 'rgba(20, 241, 149, 0.15)' : 'rgba(255,255,255,0.03)'}; color: ${m.repaired > 0 ? '#14F195' : '#64748B'}; padding: 2px 7px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                        ${m.repaired}
                      </span>
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: center; font-size: 0.78rem;">
                      ${fieldStatusText}
                    </td>
                    <td style="padding: 0.75rem 1rem; text-align: right;">
                      ${modSuccessBadge}
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

// Helper to render Diagnosis Detail Box
const renderDiagnosisDetail = (diag: CardDiagnosisSuggestion) => {
  if (!diag) return '<div style="color: #94A3B8; padding: 1rem;">Teşhis bilgisi bulunamadı.</div>';

  return `
    <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.1rem;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
        <span style="font-weight: 800; color: #FFF; font-size: 0.95rem;">
          ${diag.cardName}
        </span>
        <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 2px 8px; border-radius: 4px; font-weight: 800; font-size: 0.75rem; font-family: monospace;">
          %${diag.historicalSuccessRate} Başarı
        </span>
      </div>

      <div style="font-size: 0.78rem; color: #f59e0b; margin-bottom: 0.85rem; font-family: monospace;">
        <i class="fa-solid fa-triangle-exclamation"></i> <strong>Karakteristik Arızalar:</strong> ${diag.faultPattern}
      </div>

      <!-- Causes -->
      <div style="margin-bottom: 0.85rem;">
        <div style="font-size: 0.74rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Muhtemel Hasar Nedenleri:</div>
        <ul style="margin: 0; padding-left: 1.2rem; font-size: 0.78rem; color: #E2E8F0; line-height: 1.4;">
          ${diag.possibleCauses.map(c => `<li>${c}</li>`).join('')}
        </ul>
      </div>

      <!-- Recommended Components with Drawer Numbers -->
      <div style="margin-bottom: 0.85rem;">
        <div style="font-size: 0.74rem; color: #00f2ff; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Değiştirilmesi Önerilen Parçalar (Yedek Parça Deposu):</div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${diag.recommendedComponents.map(rc => `
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); padding: 5px 8px; border-radius: 6px; font-size: 0.76rem; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <strong style="color: #FFF;">${rc.name}</strong> 
                <span style="color: #64748B;">(${rc.reason})</span>
              </div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; padding: 1px 6px; border-radius: 4px; font-weight: 700; font-family: monospace;">
                  ${rc.drawer || 'Çekmece'}
                </span>
                ${rc.stockQty !== undefined ? `
                  <span style="background: rgba(20, 241, 149, 0.15); color: #14F195; padding: 1px 6px; border-radius: 4px; font-weight: 800; font-family: monospace;">
                    Stok: ${rc.stockQty} Ad.
                  </span>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Critical Test Steps -->
      <div>
        <div style="font-size: 0.74rem; color: #14F195; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Kritik Kalite Test Adımları:</div>
        <div style="font-size: 0.76rem; color: #94A3B8; line-height: 1.35;">
          ${diag.criticalTestSteps.map(s => `<div>${s}</div>`).join('')}
        </div>
      </div>

    </div>
  `;
};

// Handlers
const setupPerformanceHandlers = (technicianStats: any[], modelStats: any[]) => {
  (window as any).onDiagnosisModelChange = (sapNo: string) => {
    const kb: CardDiagnosisSuggestion[] = (window as any)._perfKnowledgeBase || [];
    const matched = kb.find(k => k.sapNo === sapNo);
    const container = document.getElementById('diagnosis-detail-container');
    if (container && matched) {
      container.innerHTML = renderDiagnosisDetail(matched);
    }
  };

  (window as any).exportWorkshopPerformanceExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Technicians
    const techData = technicianStats.map(t => {
      const techEvaluated = t.validatedSuccess + t.earlyFault;
      return {
        'Teknisyen': t.name,
        'E-posta': t.email,
        'Masadaki Aktif Kart': t.activeCount,
        'Bu Ay Tamamlanan': t.thisMonthCount,
        'Toplam Onarılan': t.totalRepaired,
        'Hurdaya Ayrılan': t.scrappedCount,
        '60 Gün Başarılı (≥60 Gün)': t.validatedSuccess,
        'Erken Arıza (<60 Gün)': t.earlyFault,
        'Sahada Deneniyor': t.inTrial,
        'Sevkiyat/Montaj Bekliyor': t.pendingInstall,
        'Saha Başarı Oranı (%)': techEvaluated > 0 ? ((t.validatedSuccess / techEvaluated) * 100).toFixed(1) : '-'
      };
    });
    const ws1 = XLSX.utils.json_to_sheet(techData);
    XLSX.utils.book_append_sheet(wb, ws1, 'Teknisyen Performans');

    // Sheet 2: Models
    const modelData = modelStats.map(m => {
      const modelEvaluated = m.validatedSuccess + m.earlyFault;
      return {
        'SAP No': m.sapNo,
        'Kart Modeli': m.description,
        'Toplam Stok': m.total,
        'Tamir Bekleyen': m.waiting,
        'Onarılan': m.repaired,
        'Hurdaya Ayrılan': m.scrapped,
        '60 Gün Başarılı (≥60 Gün)': m.validatedSuccess,
        'Erken Arıza (<60 Gün)': m.earlyFault,
        'Sahada Deneniyor': m.inTrial,
        'Sevkiyat/Montaj Bekliyor': m.pendingInstall,
        'Model Saha Başarı Oranı (%)': modelEvaluated > 0 ? ((m.validatedSuccess / modelEvaluated) * 100).toFixed(1) : '-'
      };
    });
    const ws2 = XLSX.utils.json_to_sheet(modelData);
    XLSX.utils.book_append_sheet(wb, ws2, 'Model Başarı Oranları');

    XLSX.writeFile(wb, `MTA_60_Gunluk_Saha_Basari_Raporu_${new Date().toLocaleDateString('tr-TR').replace(/\./g, '_')}.xlsx`);
  };
};
