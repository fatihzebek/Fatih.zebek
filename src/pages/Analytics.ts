import { analyticsService, getFaultMainCategory } from '../services/AnalyticsService';
import { serviceReportService } from '../services/ServiceReportService';
import { taskService } from '../services/TaskService';
import { dataService } from '../services/DataService';
import * as XLSX from 'xlsx';

export const AnalyticsPage = async () => {
  const currentPeriod = localStorage.getItem('analytics_period') || 'this-month';
  const activeTab = localStorage.getItem('analytics_active_tab') || 'personnel';
  const personnelSortBy = localStorage.getItem('analytics_personnel_sort_by') || 'mastery';
  const personnelSortOrder = localStorage.getItem('analytics_personnel_sort_order') || 'desc';

  const allReports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
  let reports = [...allReports];
  const tasks = await taskService.getTasks();

  // Helper for filtering reports by period
  const filterReportsByPeriod = (rawReports: any[], period: string, startStr?: string, endStr?: string) => {
    const now = new Date();
    return rawReports.filter(r => {
      if (!r.date) return false;
      const rDate = new Date(r.date);
      if (period === 'this-week') {
        const monday = new Date(now);
        monday.setDate(now.getDate() - (now.getDay() === 0 ? 6 : now.getDay() - 1));
        monday.setHours(0, 0, 0, 0);
        return rDate >= monday;
      } else if (period === 'this-month') {
        return rDate.getMonth() === now.getMonth() && rDate.getFullYear() === now.getFullYear();
      } else if (period === 'last-month') {
        const lastMonth = new Date(now);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        return rDate.getMonth() === lastMonth.getMonth() && rDate.getFullYear() === lastMonth.getFullYear();
      } else if (period === 'this-year') {
        return rDate.getFullYear() === now.getFullYear();
      } else if (period === 'custom') {
        if (startStr && endStr) {
          const start = new Date(startStr);
          start.setHours(0, 0, 0, 0);
          const end = new Date(endStr);
          end.setHours(23, 59, 59, 999);
          return rDate >= start && rDate <= end;
        }
      }
      return true;
    });
  };

  reports = filterReportsByPeriod(reports, currentPeriod, localStorage.getItem('analytics_start') || undefined, localStorage.getItem('analytics_end') || undefined);

  const data = analyticsService.generateUnifiedAnalysis(reports, tasks);

  // 1. Site Metrics Computation
  const siteMap: Record<string, { siteName: string; totalHours: number; bakimCount: number; arizaCount: number; totalReports: number; bakimHours: number; arizaHours: number }> = {};
  reports.forEach(r => {
    const site = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : undefined) || 'Diğer Santral';
    if (!siteMap[site]) {
      siteMap[site] = { siteName: site, totalHours: 0, bakimCount: 0, arizaCount: 0, totalReports: 0, bakimHours: 0, arizaHours: 0 };
    }
    siteMap[site].totalReports++;
    if (r.type === 'BAKIM') siteMap[site].bakimCount++;
    else siteMap[site].arizaCount++;

    let reportHrs = 0;
    if (r.workSessions && r.workSessions.length > 0) {
      r.workSessions.forEach((ws: any) => {
        const [h, m] = (ws.duration || '00:00').split(':').map(Number);
        const pCount = (ws.personnel && Array.isArray(ws.personnel)) ? Math.max(1, ws.personnel.length) : 1;
        reportHrs += ((isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60)) * pCount;
      });
    } else {
      const [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
      const pCount = (r.personnel && Array.isArray(r.personnel)) ? Math.max(1, r.personnel.length) : 1;
      reportHrs = ((isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60)) * pCount;
    }
    const safeHrs = isNaN(reportHrs) ? 0 : reportHrs;
    siteMap[site].totalHours += safeHrs;
    if (r.type === 'BAKIM') siteMap[site].bakimHours += safeHrs;
    else siteMap[site].arizaHours += safeHrs;
  });

  const sortedSites = Object.values(siteMap).sort((a, b) => b.totalHours - a.totalHours);

  // 2. Top Faults & Repeat Logic
  const faultMap: Record<string, { code: string; desc: string; count: number; totalHours: number }> = {};
  reports.filter(r => r.type === 'ARIZA').forEach(r => {
    const code = (r.faultCode && r.faultCode !== '---') ? r.faultCode : (r.faultDesc || 'Genel Arıza');
    const desc = (r.faultDesc && r.faultDesc !== 'Genel Görev' && r.faultDesc !== code) ? r.faultDesc : '';
    if (!faultMap[code]) {
      faultMap[code] = { code, desc, count: 0, totalHours: 0 };
    }
    faultMap[code].count++;
    let [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
    let hrs = (isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60);
    if ((isNaN(hrs) || hrs <= 0) && r.workSessions) {
      hrs = 0;
      r.workSessions.forEach((ws: any) => {
        const [wh, wm] = (ws.duration || '00:00').split(':').map(Number);
        hrs += (isNaN(wh) ? 0 : wh) + ((isNaN(wm) ? 0 : wm) / 60);
      });
    }
    faultMap[code].totalHours += (isNaN(hrs) ? 0 : hrs);
  });

  const sortedFaults = Object.values(faultMap).sort((a, b) => b.totalHours - a.totalHours);
  const top10Faults = sortedFaults.slice(0, 10);
  const maxFaultHours = top10Faults.length > 0 ? Math.max(...top10Faults.map(f => f.totalHours), 1) : 1;

  // 3. Repeat Fault Helper
  const getRepeatCount = (r: any): number => {
    if (r.type !== 'ARIZA' || !r.turbineSerial) return 0;
    const faultKey = (r.faultCode && r.faultCode !== '---') ? r.faultCode : (r.faultDesc || '');
    if (!faultKey) return 0;
    const faultCat = getFaultMainCategory(faultKey);
    const rTime = new Date(r.date).getTime();
    
    const matches = reports.filter(otherR => {
      if (otherR.type !== 'ARIZA' || otherR.turbineSerial !== r.turbineSerial) return false;
      const otherTime = new Date(otherR.date).getTime();
      const diffDays = Math.abs(rTime - otherTime) / (1000 * 60 * 60 * 24);
      if (diffDays > 7) return false;

      const otherKey = (otherR.faultCode && otherR.faultCode !== '---') ? otherR.faultCode : (otherR.faultDesc || '');
      if (!otherKey) return false;

      if (otherKey.trim().toLowerCase() === faultKey.trim().toLowerCase()) return true;
      const otherCat = getFaultMainCategory(otherKey);
      return !!(faultCat && otherCat && faultCat === otherCat);
    });
    
    return matches.length;
  };

  // 4. Critical Turbines (En Çok Müdahale Edilen Türbinler)
  const turbineMap: Record<string, { turbineSerial: string; turbineNo: string; siteName: string; count: number; totalHours: number; repeatCount: number }> = {};
  reports.filter(r => r.type === 'ARIZA').forEach(r => {
    const tKey = r.turbineSerial || r.turbineNo || 'Bilinmeyen Türbin';
    const site = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : '') || 'Diğer Santral';
    const tNo = r.turbineNo || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.turbineNo : '') || tKey;
    
    if (!turbineMap[tKey]) {
      turbineMap[tKey] = { turbineSerial: r.turbineSerial || '', turbineNo: tNo, siteName: site, count: 0, totalHours: 0, repeatCount: 0 };
    }
    turbineMap[tKey].count++;
    
    let [h, m] = (r.timeManagement?.interventionDuration || '00:00').split(':').map(Number);
    let hrs = (isNaN(h) ? 0 : h) + ((isNaN(m) ? 0 : m) / 60);
    if ((isNaN(hrs) || hrs <= 0) && r.workSessions) {
      hrs = 0;
      r.workSessions.forEach((ws: any) => {
        const [wh, wm] = (ws.duration || '00:00').split(':').map(Number);
        hrs += (isNaN(wh) ? 0 : wh) + ((isNaN(wm) ? 0 : wm) / 60);
      });
    }
    turbineMap[tKey].totalHours += (isNaN(hrs) ? 0 : hrs);
    if (getRepeatCount(r) > 1) {
      turbineMap[tKey].repeatCount++;
    }
  });
  const criticalTurbines = Object.values(turbineMap).sort((a, b) => b.totalHours - a.totalHours).slice(0, 6);

  // 5. Team (Ekip) Load Distribution
  const teamMap: Record<string, { teamName: string; personnelCount: number; totalHours: number; bakimCount: number; arizaCount: number; overtimeHours: number; members: string[] }> = {};
  data.personnelMetrics.forEach(p => {
    const tName = p.team ? p.team.trim() : 'Ekip Atanmamış';
    if (!teamMap[tName]) {
      teamMap[tName] = { teamName: tName, personnelCount: 0, totalHours: 0, bakimCount: 0, arizaCount: 0, overtimeHours: 0, members: [] };
    }
    teamMap[tName].personnelCount++;
    teamMap[tName].totalHours += p.totalHours;
    teamMap[tName].bakimCount += p.bakimCount;
    teamMap[tName].arizaCount += p.arizaCount;
    teamMap[tName].overtimeHours += p.overtimeHours;
    teamMap[tName].members.push(p.name);
  });
  const sortedTeams = Object.values(teamMap).sort((a, b) => {
    if (a.teamName === 'Ekip Atanmamış') return 1;
    if (b.teamName === 'Ekip Atanmamış') return -1;
    return a.teamName.localeCompare(b.teamName, 'tr-TR', { numeric: true });
  });

  // 6. SAP Material & Spare Parts Consumption
  const matMap: Record<string, { sapNo: string; description: string; type: string; totalUsed: number; sites: Record<string, number> }> = {};
  reports.forEach(r => {
    const site = r.siteName || (r.turbineSerial ? dataService.findTurbineBySerial(r.turbineSerial)?.siteName : '') || 'Genel';
    if (r.materials && Array.isArray(r.materials)) {
      r.materials.forEach((m: any) => {
        const sapNo = (m.sapNo || '').trim();
        const desc = (m.description || '').trim();
        const qty = Number(m.used) || Math.max(0, (Number(m.received) || 0) - (Number(m.returned) || 0));
        if (qty > 0 && (sapNo || desc)) {
          const key = sapNo || desc;
          if (!matMap[key]) {
            matMap[key] = { sapNo, description: desc || sapNo, type: m.type || 'Sarf', totalUsed: 0, sites: {} };
          }
          matMap[key].totalUsed += qty;
          matMap[key].sites[site] = (matMap[key].sites[site] || 0) + qty;
        }
      });
    }
  });
  const topMaterials = Object.values(matMap).sort((a, b) => b.totalUsed - a.totalUsed);

  // 7. Maintenance Title & Duration Helpers
  const getMaintenanceTitle = (r: any): string => {
    if (r.templateName && r.templateName !== '---' && !r.templateName.startsWith('GEN-')) return r.templateName;
    if (r.faultCode && r.faultCode !== '---' && !r.faultCode.startsWith('GEN-')) return r.faultCode;
    if (r.faultDesc && r.faultDesc !== 'Genel Görev' && r.faultDesc !== '---') return r.faultDesc;
    if (r.notes && r.notes.trim().length > 0 && r.notes.trim().length < 60) return r.notes.trim();
    return 'Periyodik Bakım';
  };

  const getReportDurationStr = (r: any): string => {
    let totalMins = 0;
    if (r.workSessions && r.workSessions.length > 0) {
      r.workSessions.forEach((ws: any) => {
        if (ws.duration) {
          const [h, m] = ws.duration.split(':').map(Number);
          totalMins += ((isNaN(h) ? 0 : h) * 60) + (isNaN(m) ? 0 : m);
        } else if (ws.startTime && ws.endTime) {
          const [sh, sm] = ws.startTime.split(':').map(Number);
          const [eh, em] = ws.endTime.split(':').map(Number);
          if (!isNaN(sh) && !isNaN(eh)) {
            let mins = (eh * 60 + em) - (sh * 60 + sm);
            if (mins < 0) mins += 24 * 60;
            totalMins += mins;
          }
        }
      });
    }
    if (totalMins === 0 && r.timeManagement?.interventionDuration) {
      const [h, m] = r.timeManagement.interventionDuration.split(':').map(Number);
      totalMins = ((isNaN(h) ? 0 : h) * 60) + (isNaN(m) ? 0 : m);
    }
    if (totalMins === 0 && r.timeManagement?.maintenanceOn && r.timeManagement?.maintenanceOff) {
      const [sh, sm] = r.timeManagement.maintenanceOn.split(':').map(Number);
      const [eh, em] = r.timeManagement.maintenanceOff.split(':').map(Number);
      if (!isNaN(sh) && !isNaN(eh)) {
        let mins = (eh * 60 + em) - (sh * 60 + sm);
        if (mins < 0) mins += 24 * 60;
        totalMins += mins;
      }
    }

    if (totalMins > 0) {
      const h = Math.floor(totalMins / 60);
      const m = totalMins % 60;
      return `${h}:${m.toString().padStart(2, '0')} h`;
    }

    if (r.team === 'MANUEL' || r.reportNo?.startsWith('MAN-') || (r.personnel && r.personnel.includes('MANUEL'))) {
      return 'Planlı Kayıt';
    }

    return '-';
  };

  // 8. Personnel Sorting Logic
  let sortedPersonnel = [...data.personnelMetrics].sort((a, b) => {
    let res = 0;
    if (personnelSortBy === 'name') {
      res = a.name.localeCompare(b.name, 'tr');
    } else if (personnelSortBy === 'jobs') {
      res = (a.bakimCount + a.arizaCount) - (b.bakimCount + b.arizaCount);
    } else if (personnelSortBy === 'hours') {
      res = a.totalHours - b.totalHours;
    } else if (personnelSortBy === 'overtime') {
      res = a.overtimeHours - b.overtimeHours;
    } else {
      res = a.masteryScore - b.masteryScore;
    }
    return personnelSortOrder === 'desc' ? -res : res;
  });

  // Leaders calculation
  const masteryLeader = [...data.personnelMetrics].sort((a, b) => b.masteryScore - a.masteryScore)[0];

  // 9. Arıza & Bakım Lists
  const arizaReports = reports.filter(r => r.type === 'ARIZA').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const bakimReports = reports.filter(r => r.type === 'BAKIM').sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const repeatReports = arizaReports.filter(r => getRepeatCount(r) > 1);

  // Global window functions for UI
  (window as any).setAnalyticsTab = (tab: string) => {
    localStorage.setItem('analytics_active_tab', tab);
    (window as any).navigate('analytics');
  };

  (window as any).setAnalyticsPeriod = (period: string) => {
    localStorage.setItem('analytics_period', period);
    (window as any).navigate('analytics');
  };

  (window as any).setCustomAnalyticsPeriod = () => {
    const start = (document.getElementById('analytics-start') as HTMLInputElement)?.value;
    const end = (document.getElementById('analytics-end') as HTMLInputElement)?.value;
    if (start && end) {
      localStorage.setItem('analytics_start', start);
      localStorage.setItem('analytics_end', end);
      (window as any).setAnalyticsPeriod('custom');
    } else {
      (window as any).showToast?.('EKSİK TARİH', 'Lütfen başlangıç ve bitiş tarihlerini seçiniz.', 'error') || alert('Lütfen başlangıç ve bitiş tarihlerini seçiniz.');
    }
  };

  (window as any).setPersonnelSort = (newSortBy: string) => {
    const curSort = localStorage.getItem('analytics_personnel_sort_by') || 'mastery';
    const curOrder = localStorage.getItem('analytics_personnel_sort_order') || 'desc';
    
    if (curSort === newSortBy) {
      localStorage.setItem('analytics_personnel_sort_order', curOrder === 'desc' ? 'asc' : 'desc');
    } else {
      localStorage.setItem('analytics_personnel_sort_by', newSortBy);
      localStorage.setItem('analytics_personnel_sort_order', newSortBy === 'name' ? 'asc' : 'desc');
    }
    (window as any).navigate('analytics');
  };

  (window as any).filterPersonnelTable = (query: string) => {
    const term = (query || '').trim().toLowerCase();
    const clearBtn = document.getElementById('personnel-search-clear');
    if (clearBtn) clearBtn.style.display = term ? 'block' : 'none';

    const rows = document.querySelectorAll('.personnel-row');
    rows.forEach((row: any) => {
      const pName = (row.getAttribute('data-pname') || '').toLowerCase();
      const pSpec = (row.getAttribute('data-pspec') || '').toLowerCase();
      const match = !term || pName.includes(term) || pSpec.includes(term);
      row.style.display = match ? '' : 'none';
    });
  };

  (window as any).clearPersonnelSearch = () => {
    const input = document.getElementById('personnel-search-input') as HTMLInputElement;
    if (input) input.value = '';
    (window as any).filterPersonnelTable('');
  };

  // 10. PDF Scorecard Generation (Tek Tıkla Resmi Performans Karnesi)
  (window as any).downloadPersonnelReportCard = async (personnelName: string) => {
    const pMetric = data.personnelMetrics.find(p => p.name.toUpperCase() === personnelName.toUpperCase());
    if (!pMetric) return;

    if (!(window as any).html2pdf) {
      await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });
    }

    const periodLabels: Record<string, string> = {
      'this-week': 'Bu Hafta',
      'this-month': 'Bu Ay (Cari Dönem)',
      'last-month': 'Önceki Ay',
      'this-year': 'Yıllık Değerlendirme',
      'all': 'Tüm Zamanlar',
      'custom': `${localStorage.getItem('analytics_start') || ''} - ${localStorage.getItem('analytics_end') || ''}`
    };
    const periodStr = periodLabels[currentPeriod] || currentPeriod;
    const assignedSitesStr = pMetric.sites && pMetric.sites.length > 0 ? pMetric.sites.join(', ') : 'Tüm Sahalar / Genel';

    const pReports = allReports.filter(r => {
      const pList = r.personnel || [];
      const wsList = (r.workSessions || []).flatMap((ws: any) => ws.personnel || []);
      return pList.concat(wsList).some(name => name && name.toUpperCase() === personnelName.toUpperCase());
    }).slice(0, 15);

    const scorecardHtml = `
      <div style="font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; background: #ffffff; padding: 24px; width: 750px; box-sizing: border-box;">
        
        <!-- Üst Başlık & Logo -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #0284c7; padding-bottom: 12px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #0f172a; letter-spacing: 0.5px;">DEMİRER ENERJİ • DH SERVİS</div>
            <div style="font-size: 0.85rem; color: #0284c7; font-weight: 700; text-transform: uppercase;">TEKNİSYEN PERFORMANS VE MESAİ KARNESİ</div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 0.75rem; color: #64748b;">Rapor Tarihi: ${new Date().toLocaleDateString('tr-TR')}</div>
            <div style="font-size: 0.8rem; font-weight: 800; color: #0f172a;">Dönem: ${periodStr}</div>
          </div>
        </div>

        <!-- Personel Bilgi Kartı -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; display: grid; grid-template-columns: 2fr 1fr; gap: 12px;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: #0f172a;">${pMetric.name}</div>
            <div style="font-size: 0.85rem; color: #475569; margin-top: 2px;">
              <strong>Şirket:</strong> ${pMetric.company || 'Demirer Enerji'} | <strong>Ekip:</strong> ${pMetric.team || 'Servis Ekibi'}
            </div>
            <div style="font-size: 0.85rem; color: #475569; margin-top: 2px;">
              <strong>Sorumlu Santral(ler):</strong> ${assignedSitesStr}
            </div>
          </div>
          <div style="text-align: right; display: flex; flex-direction: column; justify-content: center; align-items: flex-end;">
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 700;">UZMANLIK DERECESİ</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: ${pMetric.masteryGrade === 'A+' ? '#9333ea' : (pMetric.masteryGrade === 'A' ? '#16a34a' : '#0284c7')};">
              ${pMetric.masteryScore} <span style="font-size: 1rem;">/ 100 (${pMetric.masteryGrade})</span>
            </div>
            <div style="font-size: 0.7rem; font-weight: 700; color: #475569;">${pMetric.masteryLabel}</div>
          </div>
        </div>

        <!-- 4 KPI Özeti -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px;">
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 0.7rem; color: #1e40af; font-weight: 700;">TOPLAM EFOR</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #1e3a8a; margin: 2px 0;">${pMetric.totalHours} h</div>
            <div style="font-size: 0.65rem; color: #3b82f6;">${pMetric.bakimHours}h Bakım / ${pMetric.arizaHours}h Arıza</div>
          </div>
          <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 0.7rem; color: #9a3412; font-weight: 700;">ONAYLI MESAİ</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #c2410c; margin: 2px 0;">${pMetric.overtimeHours} h</div>
            <div style="font-size: 0.65rem; color: #ea580c;">Yönetici Onaylı</div>
          </div>
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 0.7rem; color: #166534; font-weight: 700;">GÖREV ADETİ</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #14532d; margin: 2px 0;">${pMetric.bakimCount + pMetric.arizaCount}</div>
            <div style="font-size: 0.65rem; color: #16a34a;">${pMetric.bakimCount} Bakım • ${pMetric.arizaCount} Arıza</div>
          </div>
          <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 6px; padding: 10px; text-align: center;">
            <div style="font-size: 0.7rem; color: #6b21a8; font-weight: 700;">KALİTE & BAŞARI</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #581c87; margin: 2px 0;">%${Math.round((1 - pMetric.repeatErrorRate) * 100)}</div>
            <div style="font-size: 0.65rem; color: #9333ea;">Tekrarsız Çözüm</div>
          </div>
        </div>

        <!-- 4 Temel Değerlendirme Puan Kriteri -->
        <div style="margin-bottom: 16px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
          <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
            <thead style="background: #f1f5f9; color: #334155; font-weight: 800;">
              <tr>
                <th style="padding: 8px 12px; text-align: left;">DEĞERLENDİRME KRİTERİ</th>
                <th style="padding: 8px 12px; text-align: left;">AÇIKLAMA</th>
                <th style="padding: 8px 12px; text-align: center;">ALINAN PUAN</th>
              </tr>
            </thead>
            <tbody>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 700; color: #0284c7;">🌐 Saha & Sorumluluk</td>
                <td style="padding: 8px 12px; color: #475569;">Atandığı bölge ve sorumlu olduğu santraller (${assignedSitesStr})</td>
                <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0f172a;">${pMetric.mobilityScore} / 25</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 700; color: #ea580c;">⚡ Mesai & Fedakarlık</td>
                <td style="padding: 8px 12px; color: #475569;">18:00 sonrası onaylanan toplam mesai (${pMetric.overtimeHours} Saat)</td>
                <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0f172a;">${pMetric.sacrificeScore} / 25</td>
              </tr>
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 12px; font-weight: 700; color: #0284c7;">🚀 Çözüm Hızı & Verimlilik</td>
                <td style="padding: 8px 12px; color: #475569;">Müdahale sürelerine ve standart bakım sürelerine uyum</td>
                <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0f172a;">${pMetric.speedScore} / 25</td>
              </tr>
              <tr>
                <td style="padding: 8px 12px; font-weight: 700; color: #16a34a;">🛡️ İşçilik Kalitesi</td>
                <td style="padding: 8px 12px; color: #475569;">Müdahale sonrası 7 gün içinde tekrarsız çözüm başarısı (${pMetric.repeatFaultCount} Tekrar)</td>
                <td style="padding: 8px 12px; text-align: center; font-weight: 800; color: #0f172a;">${pMetric.qualityScore} / 25</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Son Görev Özeti -->
        <div style="margin-bottom: 24px;">
          <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; margin-bottom: 6px;">SON GÖREV VE ÇALIŞMA KAYITLARI</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 0.75rem; border: 1px solid #e2e8f0;">
            <thead style="background: #f8fafc; color: #475569;">
              <tr>
                <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">TARİH</th>
                <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">SANTRAL / TÜRBİN</th>
                <th style="padding: 6px 10px; text-align: left; border-bottom: 1px solid #e2e8f0;">GÖREV TANIMI / KODU</th>
                <th style="padding: 6px 10px; text-align: center; border-bottom: 1px solid #e2e8f0;">TÜR</th>
              </tr>
            </thead>
            <tbody>
              ${pReports.map(r => `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                  <td style="padding: 5px 10px; font-weight: 600;">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
                  <td style="padding: 5px 10px; color: #0369a1; font-weight: 700;">${(r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial || '')}</td>
                  <td style="padding: 5px 10px;">${r.type === 'ARIZA' ? (r.faultCode || r.faultDesc || 'Arıza') : getMaintenanceTitle(r)}</td>
                  <td style="padding: 5px 10px; text-align: center;">
                    <span style="font-weight: 700; color: ${r.type === 'BAKIM' ? '#16a34a' : '#2563eb'};">${r.type}</span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Onay & İmza Alanı -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; border-top: 2px solid #cbd5e1; padding-top: 16px; margin-top: 20px;">
          <div style="font-size: 0.75rem; color: #64748b;">
            Bu karne Demirer Enerji Servis Yönetim Sistemi (DH Servis) tarafından otomatik üretilmiştir.
          </div>
          <div style="text-align: center; width: 200px;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a;">Fatih ZEBEK</div>
            <div style="font-size: 0.75rem; color: #64748b;">Operasyon & Servis Müdürü</div>
            <div style="height: 35px; border-bottom: 1px dashed #94a3b8; margin-top: 4px;"></div>
            <div style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;">İmza / Onay</div>
          </div>
        </div>

      </div>
    `;

    const wrapper = document.createElement('div');
    wrapper.style.position = 'absolute';
    wrapper.style.left = '-9999px';
    wrapper.style.top = '-9999px';
    wrapper.style.width = '750px';
    wrapper.innerHTML = scorecardHtml;
    document.body.appendChild(wrapper);

    const opt = {
      margin: [8, 8, 8, 8],
      filename: `Performans_Karnesi_${pMetric.name.replace(/\s+/g, '_')}_${currentPeriod}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    try {
      await (window as any).html2pdf().set(opt).from(wrapper).save();
      (window as any).showToast?.('BAŞARILI', 'Performans karnesi PDF olarak indirildi.', 'success');
    } catch (e: any) {
      console.error(e);
      alert('PDF oluşturulurken hata: ' + e.message);
    } finally {
      document.body.removeChild(wrapper);
    }
  };

  // Personnel Detail Modal with Date Filtering and Official Assigned Sites
  (window as any).showPersonnelDetails = (personnelName: string, period: string = currentPeriod, startStr?: string, endStr?: string) => {
    const existing = document.getElementById('personnel-details-modal');
    if (existing) existing.remove();

    const getReportPersonnelNames = (r: any): string[] => {
      const names = new Set<string>();
      if (r.workSessions && Array.isArray(r.workSessions)) {
        r.workSessions.forEach((ws: any) => {
          if (ws.personnel && Array.isArray(ws.personnel)) {
            ws.personnel.forEach((p: any) => {
              if (p && typeof p === 'string' && !/^\d+$/.test(p.trim())) {
                names.add(p.trim());
              }
            });
          }
        });
      }
      if (r.personnel && Array.isArray(r.personnel)) {
        r.personnel.forEach((p: any) => {
          if (p && typeof p === 'string' && !/^\d+$/.test(p.trim())) {
            names.add(p.trim());
          }
        });
      }
      return Array.from(names);
    };

    const upperName = personnelName.toUpperCase();
    let pAllReports = allReports.filter(r => {
      const pNames = getReportPersonnelNames(r);
      return pNames.some((name: string) => name.toUpperCase() === upperName);
    });

    const filteredPReports = filterReportsByPeriod(pAllReports, period, startStr, endStr)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const pMetric = data.personnelMetrics.find(p => p.name.toUpperCase() === upperName);

    const modal = document.createElement('div');
    modal.id = 'personnel-details-modal';
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';

    const rowsHtml = filteredPReports.map(r => {
      const repCount = getRepeatCount(r);
      const dur = getReportDurationStr(r);
      return `
        <tr>
          <td style="font-weight: 600;">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
          <td>
            <span class="badge" style="background: ${r.type === 'BAKIM' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(59, 130, 246, 0.1)'}; color: ${r.type === 'BAKIM' ? 'var(--accent-green)' : 'var(--accent-blue)'}; border: 1px solid ${r.type === 'BAKIM' ? 'var(--accent-green)' : 'var(--accent-blue)'}; padding: 2px 8px; border-radius: 4px; font-size: 0.7rem;">
              ${r.type === 'ARIZA' ? (r.faultCode || r.faultDesc || r.type) : getMaintenanceTitle(r)}
            </span>
          </td>
          <td style="color: var(--accent-cyan); font-weight: 700;">${(r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial || '')}</td>
          <td style="text-align: center;">${repCount > 1 ? `<span style="color:#ef4444; font-weight:bold;">🚩 ${repCount}x</span>` : '<span style="color:var(--text-muted); opacity:0.4;">-</span>'}</td>
          <td style="text-align: center; font-family: monospace; font-weight: 700; color: ${dur.includes('h') ? 'var(--accent-cyan)' : 'var(--text-muted)'};">${dur}</td>
          <td style="text-align: right;">
            <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${r.id}'), 300); document.getElementById('personnel-details-modal').remove()" class="btn-cyber-mini" style="padding: 3px 8px;">
              <i class="fa-solid fa-file-pdf"></i> PDF
            </button>
          </td>
        </tr>
      `;
    }).join('');

    const assignedSitesStr = pMetric?.sites && pMetric.sites.length > 0 ? pMetric.sites.join(', ') : 'Belirtilmedi';

    modal.innerHTML = `
      <div class="glass-panel" style="width: 90%; max-width: 900px; max-height: 88vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-cyan); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <!-- Üst Başlık, Karne Butonu & Tarih Filtresi -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-cyan); margin: 0; font-size: 1.4rem;">
                <i class="fa-solid fa-user-gear"></i> ${personnelName.toUpperCase()}
              </h3>
              <!-- Performans Karnesi Butonu -->
              <button onclick="window.downloadPersonnelReportCard('${personnelName}')" class="btn-cyber-mini" style="background: linear-gradient(135deg, rgba(192, 132, 252, 0.2), rgba(0, 242, 254, 0.2)); border: 1px solid #c084fc; color: #fff; font-weight: 700; padding: 3px 10px; border-radius: 6px; font-size: 0.75rem;">
                <i class="fa-solid fa-file-pdf" style="color: #c084fc; margin-right: 4px;"></i> Performans Karnesi İndir (PDF)
              </button>
            </div>
            <span style="font-size: 0.8rem; color: var(--text-muted);">
              ${pMetric?.company ? `${pMetric.company} • ` : ''}${pMetric?.team ? `${pMetric.team} • ` : ''}${pMetric?.specialization || 'Servis Teknisyeni'} • ${filteredPReports.length} Görev Kaydı
            </span>
          </div>

          <!-- Kompakt Modal Tarih Filtresi -->
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap;">
            <button class="btn-filter ${period === 'this-week' ? 'active' : ''}" onclick="window.showPersonnelDetails('${personnelName}', 'this-week')">Haftalık</button>
            <button class="btn-filter ${period === 'this-month' ? 'active' : ''}" onclick="window.showPersonnelDetails('${personnelName}', 'this-month')">Aylık</button>
            <button class="btn-filter ${period === 'this-year' ? 'active' : ''}" onclick="window.showPersonnelDetails('${personnelName}', 'this-year')">Yıllık</button>
            <button class="btn-filter ${period === 'all' ? 'active' : ''}" onclick="window.showPersonnelDetails('${personnelName}', 'all')">Tümü</button>
            
            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
              <input type="date" id="p-modal-start" style="padding: 2px 4px; font-size: 0.7rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff;" value="${startStr || ''}">
              <span style="color: var(--text-muted); font-size: 0.7rem;">-</span>
              <input type="date" id="p-modal-end" style="padding: 2px 4px; font-size: 0.7rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff;" value="${endStr || ''}">
              <button class="btn-filter" onclick="const s = (document.getElementById('p-modal-start') as any).value; const e = (document.getElementById('p-modal-end') as any).value; if(s && e) window.showPersonnelDetails('${personnelName}', 'custom', s, e);" style="padding: 2px 6px;">
                <i class="fa-solid fa-filter"></i>
              </button>
            </div>
          </div>
        </div>

        <!-- 4 Temel Skor Kartı -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 700;">🌐 SAHA & SORUMLULUK</div>
            <div style="font-size: 0.95rem; font-weight: 800; color: #fff; margin: 4px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${assignedSitesStr}">
              ${assignedSitesStr}
            </div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">${pMetric?.team ? `${pMetric.team} • ` : ''}${pMetric?.sites?.length || 0} Sorumlu Santral</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: var(--accent-orange); font-weight: 700;">⚡ EFOR & MESAİ</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 4px 0;">${pMetric?.sacrificeScore || 0}/25</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">${pMetric?.totalHours || 0}h (<span style="color:var(--accent-orange); font-weight:bold;">${pMetric?.overtimeHours || 0}h Onaylı</span>)</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: #38bdf8; font-weight: 700;">🚀 HIZ SKORU</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 4px 0;">${pMetric?.speedScore || 0}/25</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">Ortalama süreye uyum</div>
          </div>
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 0.75rem; border-radius: 8px; text-align: center;">
            <div style="font-size: 0.65rem; color: #4ade80; font-weight: 700;">🛡️ İŞÇİLİK KALİTESİ</div>
            <div style="font-size: 1.1rem; font-weight: 800; color: #fff; margin: 4px 0;">${pMetric?.qualityScore || 0}/25</div>
            <div style="font-size: 0.65rem; color: var(--text-muted);">${pMetric?.repeatFaultCount || 0} Tekrar (7 Gün)</div>
          </div>
        </div>

        <!-- Görev Tablosu -->
        <div style="overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>TARİH</th>
                <th>KAYIT TÜRÜ / TANIMI</th>
                <th>SANTRAL / TÜRBİN</th>
                <th style="text-align: center;">TEKRAR</th>
                <th style="text-align: center;">SÜRE</th>
                <th style="text-align: right;">RAPOR</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml || '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Seçili tarih aralığında kayıt bulunamadı.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
          <button class="btn-cyber-mini" onclick="this.closest('.cyber-modal-overlay').remove()">KAPAT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  // Site Detail Modal with Dynamic Date Filter
  (window as any).showSiteDetails = (siteName: string, period: string = currentPeriod, startStr?: string, endStr?: string) => {
    const existing = document.getElementById('site-details-modal');
    if (existing) existing.remove();

    const siteAllReports = allReports.filter(r => 
      r.siteName === siteName || 
      (r.turbineSerial && dataService.findTurbineBySerial(r.turbineSerial)?.siteName === siteName)
    );

    const siteFilteredReports = filterReportsByPeriod(siteAllReports, period, startStr, endStr);
    const siteData = analyticsService.generateUnifiedAnalysis(siteFilteredReports, []);
    const activePersonnel = siteData.personnelMetrics.filter(p => (p.bakimCount + p.arizaCount) > 0);

    const modal = document.createElement('div');
    modal.id = 'site-details-modal';
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';

    modal.innerHTML = `
      <div class="glass-panel" style="width: 92%; max-width: 950px; max-height: 88vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-cyan); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <!-- Modal Başlık & Canlı Tarih Filtreleme -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-cyan); margin: 0; font-size: 1.4rem;">
              <i class="fa-solid fa-solar-panel"></i> ${siteName.toUpperCase()} - SAHA ANALİZİ
            </h3>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${siteFilteredReports.length} Rapor • ${activePersonnel.length} Görevli Personel</span>
          </div>

          <!-- Kompakt Modal Tarih Filtresi -->
          <div style="display: flex; align-items: center; gap: 4px; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); flex-wrap: wrap;">
            <button class="btn-filter ${period === 'this-week' ? 'active' : ''}" onclick="window.showSiteDetails('${siteName}', 'this-week')">Haftalık</button>
            <button class="btn-filter ${period === 'this-month' ? 'active' : ''}" onclick="window.showSiteDetails('${siteName}', 'this-month')">Aylık</button>
            <button class="btn-filter ${period === 'this-year' ? 'active' : ''}" onclick="window.showSiteDetails('${siteName}', 'this-year')">Yıllık</button>
            <button class="btn-filter ${period === 'all' ? 'active' : ''}" onclick="window.showSiteDetails('${siteName}', 'all')">Tümü</button>
            
            <div style="display: flex; align-items: center; gap: 4px; margin-left: 4px;">
              <input type="date" id="site-modal-start" style="padding: 2px 4px; font-size: 0.7rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff;" value="${startStr || ''}">
              <span style="color: var(--text-muted); font-size: 0.7rem;">-</span>
              <input type="date" id="site-modal-end" style="padding: 2px 4px; font-size: 0.7rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: #fff;" value="${endStr || ''}">
              <button class="btn-filter" onclick="const s = (document.getElementById('site-modal-start') as any).value; const e = (document.getElementById('site-modal-end') as any).value; if(s && e) window.showSiteDetails('${siteName}', 'custom', s, e);" style="padding: 2px 6px;">
                <i class="fa-solid fa-filter"></i>
              </button>
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 0.75rem; margin-bottom: 1rem;">
          <div style="background: rgba(0, 242, 254, 0.08); padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(0, 242, 254, 0.2); font-size: 0.85rem; font-weight: 800; color: #fff;">
            Toplam Efor: ${siteData.operationSummary.totalManHours}h
          </div>
          <div style="background: rgba(34, 197, 94, 0.08); padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(34, 197, 94, 0.2); font-size: 0.85rem; font-weight: 800; color: #4ade80;">
            Bakım: ${siteFilteredReports.filter(r => r.type === 'BAKIM').length}
          </div>
          <div style="background: rgba(59, 130, 246, 0.08); padding: 0.4rem 0.8rem; border-radius: 6px; border: 1px solid rgba(59, 130, 246, 0.2); font-size: 0.85rem; font-weight: 800; color: #60a5fa;">
            Arıza: ${siteFilteredReports.filter(r => r.type === 'ARIZA').length}
          </div>
        </div>

        <div style="overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>PERSONEL</th>
                <th style="text-align: center;">BAKIM</th>
                <th style="text-align: center;">ARIZA</th>
                <th style="text-align: center;">TOPLAM SAAT</th>
                <th style="text-align: center;">ONAYLI MESAİ</th>
                <th style="text-align: right;">SKOR</th>
              </tr>
            </thead>
            <tbody>
              ${activePersonnel.length > 0 ? activePersonnel.map(p => `
                <tr class="clickable-row" onclick="window.showPersonnelDetails('${p.name}')" style="cursor: pointer;">
                  <td style="font-weight: 600;">${p.name}</td>
                  <td style="text-align: center; color: var(--accent-green); font-weight: 700;">${p.bakimCount}</td>
                  <td style="text-align: center; color: var(--accent-blue); font-weight: 700;">${p.arizaCount}</td>
                  <td style="text-align: center; font-family: monospace; font-weight: 700; color: var(--accent-cyan);">${p.totalHours}h</td>
                  <td style="text-align: center; font-family: monospace; color: var(--accent-orange); font-weight: 700;">${p.overtimeHours > 0 ? p.overtimeHours + 'h' : '-'}</td>
                  <td style="text-align: right; font-weight: 800; color: #38bdf8;">${p.masteryScore} Puan</td>
                </tr>
              `).join('') : '<tr><td colspan="6" style="text-align:center; padding:2rem; color:var(--text-muted);">Seçili tarih aralığında bu sahada görev kaydı bulunamadı.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
          <button class="btn-cyber-mini" onclick="this.closest('.cyber-modal-overlay').remove()">KAPAT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  // Overtime Details Modal
  (window as any).showOvertimeDetails = () => {
    const details = data.overtimeDetails;
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:10000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(10px);';
    
    modal.innerHTML = `
      <div class="glass-panel" style="width: 90%; max-width: 850px; max-height: 85vh; padding: 2rem; position: relative; border-top: 4px solid var(--accent-orange); overflow: hidden; display: flex; flex-direction: column;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <h3 style="font-family: 'Rajdhani', sans-serif; color: var(--accent-orange); margin: 0 0 1.5rem 0; display: flex; align-items: center; gap: 0.75rem;">
          <i class="fa-solid fa-clock-rotate-left"></i> 18:00 SONRASI ONAYLI MESAİ DETAYLARI
        </h3>

        <div style="overflow-y: auto; flex: 1;" class="custom-scrollbar">
          <table class="cyber-table">
            <thead>
              <tr>
                <th>TARİH</th>
                <th>PERSONEL</th>
                <th>SANTRAL / TÜRBİN</th>
                <th style="text-align: center;">MESAİ SÜRESİ</th>
                <th style="text-align: right;">RAPOR</th>
              </tr>
            </thead>
            <tbody>
              ${details.length > 0 ? details.map(d => `
                <tr>
                  <td>${new Date(d.date).toLocaleDateString('tr-TR')}</td>
                  <td style="font-weight: 600;">${d.personnelName}</td>
                  <td style="color: var(--accent-cyan); font-weight: 700;">${(d.siteName ? d.siteName + ' ' : '') + (d.turbineNo || d.turbineSerial || '')}</td>
                  <td style="text-align: center; font-weight: 800; color: var(--accent-orange); font-family: monospace;">${d.overtimeHours} h</td>
                  <td style="text-align: right;">
                    <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${d.reportId}'), 300); document.querySelector('.cyber-modal-overlay')?.remove()" class="btn-cyber-mini" style="padding: 2px 8px;">
                      <i class="fa-solid fa-file-lines"></i> Aç
                    </button>
                  </td>
                </tr>
              `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 2rem;">Mesai kaydı bulunamadı.</td></tr>'}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 1rem; display: flex; justify-content: flex-end;">
          <button class="btn-cyber-mini" onclick="this.closest('.cyber-modal-overlay').remove()">KAPAT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  // Excel Export
  (window as any).exportAnalyticsToExcel = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Personel', 'Şirket', 'Ekip', 'Sorumlu Santral', 'Bakım (Adet)', 'Arıza (Adet)', 'Toplam Saat', 'Onaylı Mesai (Saat)', 'Uzmanlık Skoru'],
      ...data.personnelMetrics.map(p => [p.name, p.company || '', p.team || '', (p.sites || []).join(' | '), p.bakimCount, p.arizaCount, p.totalHours, p.overtimeHours, p.masteryScore])
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Personel Analizi");
    XLSX.writeFile(wb, `DH_Servis_Analiz_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  // Sort Arrow Helper
  const getSortArrow = (col: string) => {
    if (personnelSortBy !== col) return '<i class="fa-solid fa-sort" style="opacity: 0.3; margin-left: 4px; font-size: 0.7rem;"></i>';
    return personnelSortOrder === 'desc' 
      ? '<i class="fa-solid fa-sort-down" style="color: var(--accent-cyan); margin-left: 4px; font-size: 0.8rem;"></i>' 
      : '<i class="fa-solid fa-sort-up" style="color: var(--accent-cyan); margin-left: 4px; font-size: 0.8rem;"></i>';
  };

  return `
    <div class="fade-in-up content-area" style="max-width: 1300px; margin: 0 auto;">
      
      <!-- 🌟 1. TEMİZ VE SADE ÜST BAŞLIK -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; color: var(--text-main); margin: 0; display: flex; align-items: center; gap: 0.6rem; letter-spacing: 1px;">
            <i class="fa-solid fa-chart-simple" style="color: var(--accent-cyan);"></i> ADAM-SAAT & PERFORMANS
          </h2>
          <span style="font-size: 0.75rem; color: var(--text-muted);">Saha operasyonlarının efor, bakım ve onaylı mesai analiz portalı</span>
        </div>

        <!-- Sade Filtre Grubu -->
        <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div style="background: rgba(255,255,255,0.03); padding: 3px 6px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
            <button class="btn-filter ${currentPeriod === 'this-week' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-week')">Bu Hafta</button>
            <button class="btn-filter ${currentPeriod === 'this-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-month')">Bu Ay</button>
            <button class="btn-filter ${currentPeriod === 'last-month' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('last-month')">Önceki Ay</button>
            <button class="btn-filter ${currentPeriod === 'this-year' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('this-year')">Bu Yıl</button>
            <button class="btn-filter ${currentPeriod === 'all' ? 'active' : ''}" onclick="window.setAnalyticsPeriod('all')">Tümü</button>
            
            <div style="width: 1px; height: 16px; background: rgba(255,255,255,0.1); margin: 0 4px;"></div>
            
            <input type="date" id="analytics-start" style="padding: 2px 4px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-main);" value="${localStorage.getItem('analytics_start') || ''}">
            <span style="color: var(--text-muted); font-size: 0.75rem;">-</span>
            <input type="date" id="analytics-end" style="padding: 2px 4px; font-size: 0.75rem; background: transparent; border: 1px solid rgba(255,255,255,0.1); border-radius: 4px; color: var(--text-main);" value="${localStorage.getItem('analytics_end') || ''}">
            <button class="btn-filter ${currentPeriod === 'custom' ? 'active' : ''}" onclick="window.setCustomAnalyticsPeriod()" style="padding: 2px 8px; border-radius: 4px;" title="Tarih aralığına göre filtrele">
              <i class="fa-solid fa-filter"></i>
            </button>
          </div>

          <button class="btn-cyber-mini" onclick="window.exportAnalyticsToExcel()" style="padding: 0.45rem 1rem; border-radius: 8px;">
            <i class="fa-solid fa-file-excel" style="margin-right: 0.4rem;"></i> Excel İndir
          </button>
        </div>
      </div>

      <!-- 📊 2. SADE 3 KPI KARTI (FERAH DÜZEN) -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem; margin-bottom: 1.75rem;">
        
        <!-- Kart 1: Toplam Efor -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid var(--accent-cyan); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM ÇALIŞMA (EFOR)</div>
          <div style="font-size: 2rem; font-weight: 900; color: #FFFFFF; font-family: monospace; margin: 0.4rem 0;">
            ${data.operationSummary.totalManHours} <span style="font-size: 1rem; color: var(--text-muted); font-weight: normal;">Saat</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; justify-content: space-between;">
            <span>Duruş: <strong style="color: #fff;">${data.operationSummary.totalTurbineHours}h</strong></span>
            <span onclick="window.showOvertimeDetails()" style="cursor: pointer; color: var(--accent-orange);" title="Onaylı mesai detayları için tıklayın">
              Onaylı Mesai: <strong>${data.operationSummary.totalOvertimeHours}h</strong> <i class="fa-solid fa-chevron-right" style="font-size: 0.6rem;"></i>
            </span>
          </div>
        </div>

        <!-- Kart 2: Operasyon Dağılımı -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid var(--accent-green); display: flex; flex-direction: column; justify-content: space-between;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">İŞ DAĞILIMI & VERİMLİLİK</div>
          <div style="font-size: 1.3rem; font-weight: 800; color: #FFFFFF; margin: 0.4rem 0; display: flex; gap: 1rem;">
            <span style="color: #4ade80;">%${data.operationSummary.bakimRatio} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">Bakım</span></span>
            <span style="color: #60a5fa;">%${data.operationSummary.arizaRatio} <span style="font-size: 0.8rem; color: var(--text-muted); font-weight: normal;">Arıza</span></span>
          </div>
          <!-- Zarif Çubuk Grafik -->
          <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; display: flex;">
            <div style="width: ${data.operationSummary.bakimRatio}%; height: 100%; background: #4ade80;"></div>
            <div style="width: ${data.operationSummary.arizaRatio}%; height: 100%; background: #60a5fa;"></div>
          </div>
        </div>

        <!-- Kart 3: Ayın / Dönemin Öne Çıkanı -->
        <div class="glass-panel clickable-row" onclick="window.showPersonnelDetails('${masteryLeader?.name || ''}')" style="cursor: pointer; padding: 1.25rem; border-radius: 12px; border-left: 4px solid #c084fc; display: flex; flex-direction: column; justify-content: space-between; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: #c084fc; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">👑 DÖNEMİN YILDIZI</span>
            <span style="font-size: 0.7rem; color: var(--text-muted);">İncele <i class="fa-solid fa-arrow-right"></i></span>
          </div>
          <div style="font-size: 1.4rem; font-weight: 900; color: #FFFFFF; margin: 0.4rem 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${masteryLeader ? masteryLeader.name : '-'}
          </div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">
            <strong style="color: #c084fc; font-family: monospace;">${masteryLeader ? `${masteryLeader.masteryScore} Puan` : '-'}</strong> • ${masteryLeader ? `${masteryLeader.bakimCount + masteryLeader.arizaCount} Görev (${masteryLeader.overtimeHours}h Onaylı Mesai)` : '-'}
          </div>
        </div>

      </div>

      <!-- 🗂️ 3. ZARİF MODERN SEKME ÇUBUĞU (APPLE / NOTION STİLİ) -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.5rem; overflow-x: auto;">
        <button class="tab-pill ${activeTab === 'personnel' ? 'active' : ''}" onclick="window.setAnalyticsTab('personnel')">
          <i class="fa-solid fa-users"></i> Personel Performansı (${data.personnelMetrics.length})
        </button>
        <button class="tab-pill ${activeTab === 'teams' ? 'active' : ''}" onclick="window.setAnalyticsTab('teams')">
          <i class="fa-solid fa-people-group"></i> Ekip Dağılımı (${sortedTeams.length})
        </button>
        <button class="tab-pill ${activeTab === 'ariza' ? 'active' : ''}" onclick="window.setAnalyticsTab('ariza')">
          <i class="fa-solid fa-bolt"></i> Arıza & Kritik Türbinler (${arizaReports.length})
        </button>
        <button class="tab-pill ${activeTab === 'bakim' ? 'active' : ''}" onclick="window.setAnalyticsTab('bakim')">
          <i class="fa-solid fa-wrench"></i> Bakım Takibi (${bakimReports.length})
        </button>
        <button class="tab-pill ${activeTab === 'materials' ? 'active' : ''}" onclick="window.setAnalyticsTab('materials')">
          <i class="fa-solid fa-box-open"></i> Malzeme Tüketimi (${topMaterials.length})
        </button>
        <button class="tab-pill ${activeTab === 'sites' ? 'active' : ''}" onclick="window.setAnalyticsTab('sites')">
          <i class="fa-solid fa-solar-panel"></i> Santraller (${sortedSites.length})
        </button>
      </div>

      <!-- ============================================================= -->
      <!-- 👥 SEKME 1: PERSONEL TABLOSU & SIRALAMA KONTROLLERİ           -->
      <!-- ============================================================= -->
      ${activeTab === 'personnel' ? `
        <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px;">
          
          <!-- Arama & Hızlı Sıralama Çubuğu -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
            <!-- Arama Kutusu -->
            <div style="position: relative; width: 260px;">
              <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
              <input 
                type="text" 
                id="personnel-search-input" 
                class="cyber-input" 
                placeholder="Personel veya uzmanlık ara..." 
                oninput="window.filterPersonnelTable(this.value)"
                style="height: 36px; padding-left: 2.2rem; padding-right: 2rem; font-size: 0.85rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; width: 100%; color: #fff;"
              >
              <i id="personnel-search-clear" onclick="window.clearPersonnelSearch()" class="fa-solid fa-xmark" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94A3B8; cursor: pointer;"></i>
            </div>

            <!-- Hızlı Sıralama Butonları -->
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; margin-right: 2px;">SIRALAMA:</span>
              <button class="btn-filter ${personnelSortBy === 'mastery' ? 'active' : ''}" onclick="window.setPersonnelSort('mastery')" style="font-size: 0.75rem; padding: 4px 8px;">
                ⭐ Uzmanlık ${personnelSortBy === 'mastery' ? (personnelSortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button class="btn-filter ${personnelSortBy === 'jobs' ? 'active' : ''}" onclick="window.setPersonnelSort('jobs')" style="font-size: 0.75rem; padding: 4px 8px;">
                📋 Görev Adeti ${personnelSortBy === 'jobs' ? (personnelSortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button class="btn-filter ${personnelSortBy === 'hours' ? 'active' : ''}" onclick="window.setPersonnelSort('hours')" style="font-size: 0.75rem; padding: 4px 8px;">
                ⏱️ Toplam Efor ${personnelSortBy === 'hours' ? (personnelSortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button class="btn-filter ${personnelSortBy === 'overtime' ? 'active' : ''}" onclick="window.setPersonnelSort('overtime')" style="font-size: 0.75rem; padding: 4px 8px;">
                🔥 Onaylı Mesai ${personnelSortBy === 'overtime' ? (personnelSortOrder === 'desc' ? '↓' : '↑') : ''}
              </button>
              <button class="btn-filter ${personnelSortBy === 'name' ? 'active' : ''}" onclick="window.setPersonnelSort('name')" style="font-size: 0.75rem; padding: 4px 8px;">
                🔤 İsim (A-Z) ${personnelSortBy === 'name' ? (personnelSortOrder === 'asc' ? 'A-Z' : 'Z-A') : ''}
              </button>
            </div>
          </div>

          <!-- Sadeleştirilmiş 5 Sütunlu Tablo (Sıralanabilir Başlıklar) -->
          <div style="overflow-x: auto;">
            <table class="cyber-table">
              <thead>
                <tr>
                  <th onclick="window.setPersonnelSort('name')" style="cursor: pointer;" title="İsme göre sırala">
                    PERSONEL ${getSortArrow('name')}
                  </th>
                  <th onclick="window.setPersonnelSort('jobs')" style="text-align: center; cursor: pointer;" title="Görev sayısına göre sırala">
                    GÖREVLER (BAKIM / ARIZA) ${getSortArrow('jobs')}
                  </th>
                  <th onclick="window.setPersonnelSort('hours')" style="text-align: center; cursor: pointer;" title="Toplam çalışma saatine göre sırala">
                    TOPLAM EFOR ${getSortArrow('hours')}
                  </th>
                  <th onclick="window.setPersonnelSort('overtime')" style="text-align: center; cursor: pointer;" title="Onaylanan mesai saatine göre sırala">
                    ONAYLANAN MESAİ ${getSortArrow('overtime')}
                  </th>
                  <th onclick="window.setPersonnelSort('mastery')" style="text-align: center; cursor: pointer;" title="Uzmanlık skoruna göre sırala">
                    UZMANLIK SKORU ${getSortArrow('mastery')}
                  </th>
                  <th style="text-align: right;">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                ${sortedPersonnel.map(p => `
                  <tr class="clickable-row personnel-row" data-pname="${p.name.toLowerCase()}" data-pspec="${p.specialization.toLowerCase()}" onclick="window.showPersonnelDetails('${p.name}')" style="cursor: pointer;">
                    <td>
                      <div style="font-weight: 700; color: #FFFFFF; font-size: 0.95rem;">${p.name}</div>
                      <div style="font-size: 0.72rem; color: var(--text-muted);">${p.team ? `${p.team} • ` : ''}${p.specialization}</div>
                    </td>
                    <td style="text-align: center;">
                      <span style="font-weight: 700; color: #fff;">${p.bakimCount + p.arizaCount} Görev</span>
                      <div style="font-size: 0.7rem; color: var(--text-muted);">
                        <span style="color: #4ade80;">${p.bakimCount} Bakım</span> • <span style="color: #60a5fa;">${p.arizaCount} Arıza</span>
                      </div>
                    </td>
                    <td style="text-align: center; font-family: monospace; font-weight: 800; color: var(--accent-cyan); font-size: 1rem;">
                      ${p.totalHours} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">Saat</span>
                    </td>
                    <td style="text-align: center; font-family: monospace; font-weight: 700;">
                      ${p.overtimeHours > 0 ? `<span style="color: var(--accent-orange); background: rgba(255,157,0,0.1); padding: 3px 8px; border-radius: 4px; font-size: 0.8rem;" title="Yönetici tarafından onaylanan net mesai saati">${p.overtimeHours}h</span>` : '<span style="color: var(--text-muted); opacity: 0.4;">-</span>'}
                    </td>
                    <td style="text-align: center;">
                      <span style="font-family: monospace; font-weight: 800; font-size: 0.95rem; color: ${p.masteryGrade === 'A+' ? '#c084fc' : (p.masteryGrade === 'A' ? '#4ade80' : '#38bdf8')};">
                        ${p.masteryScore}
                      </span>
                      <span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 4px; background: rgba(255,255,255,0.05); color: #fff;">
                        ${p.masteryGrade}
                      </span>
                    </td>
                    <td style="text-align: right;">
                      <button class="btn-cyber-mini" style="padding: 4px 12px; border-radius: 6px; font-size: 0.75rem;">
                        İncele <i class="fa-solid fa-chevron-right" style="font-size: 0.65rem; margin-left: 4px;"></i>
                      </button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 👥 SEKME 2: EKİP (TEAM) BAZLI İŞ & EFOR DAĞILIMI              -->
      <!-- ============================================================= -->
      ${activeTab === 'teams' ? `
        <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.2rem; color: var(--accent-cyan);">
                <i class="fa-solid fa-people-group"></i> EKİP (TEAM 01 - 15) İŞ VE EFOR DAĞILIMI
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Ekiplerin çalışma saatleri, görev dağılımları ve mesai dengesi</span>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
            ${sortedTeams.map(t => `
              <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.25rem; border-left: 3px solid ${t.teamName.startsWith('Team') ? 'var(--accent-cyan)' : '#a855f7'};">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
                  <span style="font-weight: 800; font-size: 1.1rem; color: #fff; font-family: 'Rajdhani', sans-serif;">${t.teamName}</span>
                  <span style="background: rgba(255,255,255,0.05); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; color: var(--accent-cyan); font-weight: 700;">
                    ${t.personnelCount} Teknisyen
                  </span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                  <span style="color: var(--text-muted);">Toplam Çalışma:</span>
                  <span style="font-weight: 800; color: #fff; font-family: monospace;">${Math.round(t.totalHours)} Saat</span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.85rem;">
                  <span style="color: var(--text-muted);">Bakım / Arıza:</span>
                  <span><strong style="color: #4ade80;">${t.bakimCount}</strong> Bakım • <strong style="color: #60a5fa;">${t.arizaCount}</strong> Arıza</span>
                </div>

                <div style="display: flex; justify-content: space-between; margin-bottom: 0.75rem; font-size: 0.85rem;">
                  <span style="color: var(--text-muted);">Onaylanan Mesai:</span>
                  <span style="color: var(--accent-orange); font-weight: 700; font-family: monospace;">${Math.round(t.overtimeHours)} Saat</span>
                </div>

                <!-- Ekip Üyeleri Listesi -->
                <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 0.5rem; font-size: 0.75rem; color: var(--text-muted);">
                  <strong>Ekip Üyeleri:</strong> ${t.members.join(', ')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- ⚡ SEKME 3: ARIZA & KRİTİK TÜRBİNLER ANALİZİ                  -->
      <!-- ============================================================= -->
      ${activeTab === 'ariza' ? `
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Üst: Kritik Türbinler (En Çok Duruş Yaşayanlar) -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border-top: 3px solid #f43f5e;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.15rem; color: #f43f5e;">
                <i class="fa-solid fa-triangle-exclamation"></i> EN ÇOK MÜDAHALE EDİLEN KRİTİK TÜRBİNLER (TOP 6)
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Arıza sıklığı ve müdahale süresi en yüksek türbinler</span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem;">
              ${criticalTurbines.map(t => `
                <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; padding: 1rem; border-left: 3px solid #f43f5e;">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                    <span style="font-weight: 800; color: #fff; font-size: 0.95rem;">${t.siteName} - T${t.turbineNo}</span>
                    <span style="color: #f43f5e; font-weight: 800; font-family: monospace;">${Math.round(t.totalHours)}h</span>
                  </div>
                  <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted);">
                    <span>${t.count} Arıza Müdahalesi</span>
                    <span>${t.repeatCount > 0 ? `<strong style="color: #f87171;">🚩 ${t.repeatCount} Tekrar</strong>` : '<span style="color: #4ade80;">Tekrarsız</span>'}</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Alt Grid: En Çok Zaman Alan Arızalar & 7 Gün İçinde Tekrar Edenler -->
          <div style="display: grid; grid-template-columns: 1fr 1.5fr; gap: 1.5rem;">
            <!-- Sol: En Çok Zaman Alan Arıza Kodları -->
            <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border-top: 3px solid var(--accent-orange);">
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--accent-orange);">
                <i class="fa-solid fa-fire"></i> EN ÇOK ZAMAN ALAN ARIZALAR (TOP 10)
              </h3>
              <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 500px; overflow-y: auto;" class="custom-scrollbar">
                ${top10Faults.map((f, idx) => {
                  const pct = Math.min(100, Math.round((f.totalHours / maxFaultHours) * 100));
                  return `
                    <div style="background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                        <div style="font-weight: 700; font-family: monospace; font-size: 0.85rem; color: #fff;">
                          <span style="color: #fbbf24; margin-right: 4px;">#${idx + 1}</span> ${f.code}
                        </div>
                        <div style="font-weight: 800; color: var(--accent-orange); font-family: monospace; font-size: 0.85rem;">
                          ${Math.round(f.totalHours)}h <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: normal;">(${f.count}x)</span>
                        </div>
                      </div>
                      ${f.desc ? `<div style="font-size: 0.7rem; color: var(--text-muted); margin-bottom: 0.4rem;">${f.desc}</div>` : ''}
                      <div style="width: 100%; height: 4px; background: rgba(255,255,255,0.05); border-radius: 2px; overflow: hidden;">
                        <div style="width: ${pct}%; height: 100%; background: linear-gradient(90deg, #f59e0b, #ef4444);"></div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- Sağ: 7 Gün İçinde Tekrar Eden Arızalar -->
            <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border-top: 3px solid #ef4444;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.1rem; color: #ef4444;">
                  <i class="fa-solid fa-triangle-exclamation"></i> 7 GÜN İÇİNDE TEKRAR EDENLER
                </h3>
                <span style="font-size: 0.75rem; color: #f87171; font-weight: 700;">${repeatReports.length} Vaka</span>
              </div>
              <div style="overflow-y: auto; max-height: 500px;" class="custom-scrollbar">
                <table class="cyber-table">
                  <thead>
                    <tr>
                      <th>TARİH</th>
                      <th>SANTRAL / TÜRBİN</th>
                      <th>ARIZA KODU</th>
                      <th style="text-align: center;">TEKRAR</th>
                      <th style="text-align: right;">PDF</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${repeatReports.length > 0 ? repeatReports.map(r => `
                      <tr>
                        <td style="font-weight: 600;">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
                        <td style="color: var(--accent-cyan); font-weight: 700;">${(r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial || '')}</td>
                        <td>
                          <span style="color: #fff; font-family: monospace; font-weight: 700;">${r.faultCode || r.faultDesc}</span>
                        </td>
                        <td style="text-align: center;">
                          <span style="color: #ef4444; background: rgba(239, 68, 68, 0.15); padding: 2px 6px; border-radius: 4px; font-weight: 800; font-size: 0.75rem;">
                            🚩 ${getRepeatCount(r)}x
                          </span>
                        </td>
                        <td style="text-align: right;">
                          <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${r.id}'), 300);" class="btn-cyber-mini" style="padding: 2px 8px;">
                            <i class="fa-solid fa-file-pdf"></i>
                          </button>
                        </td>
                      </tr>
                    `).join('') : '<tr><td colspan="5" style="text-align: center; color: var(--accent-green); padding: 2rem;">🎉 Tekrar eden arıza tespit edilmedi.</td></tr>'}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🛠️ SEKME 4: SADE BAKIM TAKİBİ                                -->
      <!-- ============================================================= -->
      ${activeTab === 'bakim' ? `
        <div style="display: grid; grid-template-columns: 1fr 1.8fr; gap: 1.5rem;">
          <!-- Sol: Santral Bazlı Bakım Eforu -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border-top: 3px solid var(--accent-green);">
            <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--accent-green);">
              <i class="fa-solid fa-solar-panel"></i> SANTRAL BAZLI BAKIM EFORU
            </h3>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${sortedSites.map(s => `
                <div class="clickable-row" onclick="window.showSiteDetails('${s.siteName}')" style="cursor: pointer; background: rgba(255,255,255,0.02); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem;">
                    <span style="font-weight: 700; color: #fff;">${s.siteName}</span>
                    <span style="font-weight: 800; color: var(--accent-green); font-family: monospace;">${Math.round(s.bakimHours)}h (${s.bakimCount} Bakım)</span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Sağ: Tamamlanan Bakımlar Listesi (Detaylı Bakım Türü & Süre) -->
          <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border-top: 3px solid var(--accent-cyan);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.1rem; color: var(--accent-cyan);">
                <i class="fa-solid fa-list-check"></i> GERÇEKLEŞEN BAKIMLAR
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">${bakimReports.length} Bakım Kaydı</span>
            </div>
            <div style="overflow-y: auto; max-height: 600px;" class="custom-scrollbar">
              <table class="cyber-table">
                <thead>
                  <tr>
                    <th>TARİH</th>
                    <th>SANTRAL / TÜRBİN</th>
                    <th>BAKIM TÜRÜ / TANIMI</th>
                    <th>EKİP / PERSONEL</th>
                    <th style="text-align: center;">SÜRE</th>
                    <th style="text-align: right;">PDF</th>
                  </tr>
                </thead>
                <tbody>
                  ${bakimReports.length > 0 ? bakimReports.map(r => {
                    const isManual = r.team === 'MANUEL' || r.reportNo?.startsWith('MAN-') || (r.personnel && r.personnel.includes('MANUEL'));
                    const pList = (r.personnel && Array.isArray(r.personnel) && !isManual) ? r.personnel.join(', ') : '';
                    const dur = getReportDurationStr(r);
                    return `
                      <tr>
                        <td style="font-weight: 600;">${new Date(r.date).toLocaleDateString('tr-TR')}</td>
                        <td style="color: var(--accent-cyan); font-weight: 700;">${(r.siteName ? r.siteName + ' ' : '') + (r.turbineNo || r.turbineSerial || '')}</td>
                        <td>
                          <span style="font-weight: 700; color: #FFFFFF;">${getMaintenanceTitle(r)}</span>
                        </td>
                        <td>
                          ${isManual ? `
                            <span class="badge" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 700;">
                              📋 Manuel Planlama
                            </span>
                          ` : `<span style="font-size: 0.8rem; color: var(--text-main);">${pList || '-'}</span>`}
                        </td>
                        <td style="text-align: center; font-family: monospace; font-weight: 700; color: ${dur.includes('h') ? 'var(--accent-green)' : 'var(--text-muted)'};">
                          ${dur}
                        </td>
                        <td style="text-align: right;">
                          <button onclick="(window as any).navigate('archive'); setTimeout(() => (window as any).openReportModal('${r.id}'), 300);" class="btn-cyber-mini" style="padding: 2px 8px;">
                            <i class="fa-solid fa-file-pdf"></i>
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('') : '<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">Bakım kaydı bulunamadı.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 📦 SEKME 5: MALZEME VE SARFİYAT ANALİZİ                      -->
      <!-- ============================================================= -->
      ${activeTab === 'materials' ? `
        <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0; font-size: 1.2rem; color: var(--accent-cyan);">
                <i class="fa-solid fa-box-open"></i> BAKIM VE ARIZALARDA KULLANILAN SAP MALZEMELER
              </h3>
              <span style="font-size: 0.75rem; color: var(--text-muted);">Raporlarda kaydedilen yedek parça ve sarf malzemesi tüketimleri</span>
            </div>
          </div>

          <div style="overflow-x: auto;">
            <table class="cyber-table">
              <thead>
                <tr>
                  <th>SAP KODU</th>
                  <th>MALZEME TANIMI</th>
                  <th>TÜR</th>
                  <th style="text-align: center;">TOPLAM SARFİYAT</th>
                  <th>KULLANILAN SANTRALLER</th>
                </tr>
              </thead>
              <tbody>
                ${topMaterials.length > 0 ? topMaterials.map(m => {
                  const siteList = Object.entries(m.sites).map(([site, count]) => `${site} (${count})`).join(', ');
                  return `
                    <tr>
                      <td style="font-family: monospace; font-weight: 700; color: var(--accent-cyan);">${m.sapNo || '-'}</td>
                      <td style="font-weight: 600; color: #fff;">${m.description}</td>
                      <td><span class="badge" style="background: rgba(255,255,255,0.05); color: #fff; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem;">${m.type}</span></td>
                      <td style="text-align: center; font-family: monospace; font-weight: 800; color: #4ade80; font-size: 1rem;">
                        ${m.totalUsed} Adet
                      </td>
                      <td style="font-size: 0.8rem; color: var(--text-muted);">${siteList}</td>
                    </tr>
                  `;
                }).join('') : '<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">Seçili dönemde kullanılan malzeme kaydı bulunamadı.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- ============================================================= -->
      <!-- 🏢 SEKME 6: SADE SANTRAL KARTLARI                             -->
      <!-- ============================================================= -->
      ${activeTab === 'sites' ? `
        <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px;">
          <h3 style="font-family: 'Rajdhani', sans-serif; margin: 0 0 1.25rem 0; font-size: 1.1rem; color: var(--accent-cyan);">
            <i class="fa-solid fa-solar-panel"></i> AKTİF SANTRALLER & EFOR DAĞILIMI
          </h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 1rem;">
            ${sortedSites.map(s => `
              <div class="clickable-card" onclick="window.showSiteDetails('${s.siteName}')" style="cursor: pointer; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; transition: transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <strong style="font-size: 0.95rem; color: #fff;">${s.siteName}</strong>
                  <span style="color: var(--accent-cyan); font-weight: 900; font-family: monospace;">${Math.round(s.totalHours)}h</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;">
                  <span>${s.totalReports} Toplam Rapor</span>
                  <span><strong style="color: #4ade80;">${s.bakimCount}</strong> Bakım • <strong style="color: #60a5fa;">${s.arizaCount}</strong> Arıza</span>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

    </div>

    <style>
      .tab-pill {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 0.5rem;
        white-space: nowrap;
      }
      .tab-pill:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #fff;
      }
      .tab-pill.active {
        background: rgba(0, 242, 254, 0.1);
        color: var(--accent-cyan);
        border: 1px solid rgba(0, 242, 254, 0.25);
      }
      .btn-filter {
        background: transparent;
        border: none;
        color: var(--text-muted);
        padding: 0.35rem 0.75rem;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .btn-filter:hover {
        color: #fff;
      }
      .btn-filter.active {
        background: rgba(255,255,255,0.08);
        color: #fff;
        font-weight: 800;
      }
      .cyber-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.85rem;
      }
      .cyber-table th {
        text-align: left;
        padding: 0.85rem 1rem;
        color: var(--text-muted);
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .cyber-table td {
        padding: 0.85rem 1rem;
        border-bottom: 1px solid rgba(255,255,255,0.02);
      }
      .btn-cyber-mini {
        background: rgba(0, 242, 254, 0.08);
        border: 1px solid rgba(0, 242, 254, 0.3);
        color: var(--accent-cyan);
        cursor: pointer;
        border-radius: 6px;
        transition: all 0.2s;
      }
      .btn-cyber-mini:hover {
        background: var(--accent-cyan);
        color: #000;
      }
      .custom-scrollbar::-webkit-scrollbar {
        width: 4px;
      }
      .custom-scrollbar::-webkit-scrollbar-track {
        background: rgba(255,255,255,0.02);
      }
      .custom-scrollbar::-webkit-scrollbar-thumb {
        background: var(--accent-cyan);
        border-radius: 10px;
        opacity: 0.5;
      }
    </style>
  `;
};
