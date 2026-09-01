import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc, setDoc } from 'firebase/firestore';
import { excelService } from '../services/ExcelService';
import { personnelService } from '../services/PersonnelService';
import * as DateTimeUtils from '../utils/DateTimeUtils';
import { formatDisplayName } from '../utils/formatters';

// Helper to convert time string (HH:MM) to decimal hours
function timeToDecimal(timeStr: string): number {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h + (m / 60);
}

// Convert decimal hours (e.g. 1.25) to time string (e.g. 01:15)
function decimalToTimeStr(decimal: number): string {
  if (isNaN(decimal) || decimal <= 0) return '00:00';
  const totalMinutes = Math.round(decimal * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

// Convert decimal hours (e.g. 1.25) to Turkish time string (e.g. 1 Saat 15 Dk)
function decimalToTurkishTimeStr(decimal: number): string {
  if (isNaN(decimal) || decimal <= 0) return '0 Saat';
  const totalMinutes = Math.round(decimal * 60);
  const hrs = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (mins === 0) return `${hrs} Saat`;
  return `${hrs} Saat ${mins} Dk`;
}

// Convert user entered time string (HH:MM or decimal) to decimal hours
function timeStrToDecimal(timeStr: string): number {
  if (!timeStr) return 0;
  const trimmed = timeStr.trim();
  if (trimmed.includes(':')) {
    const parts = trimmed.split(':');
    const h = parseFloat(parts[0]) || 0;
    const m = parseFloat(parts[1]) || 0;
    return h + (m / 60);
  }
  if (trimmed.includes('.')) {
    return parseFloat(trimmed) || 0;
  }
  if (trimmed.includes(',')) {
    return parseFloat(trimmed.replace(',', '.')) || 0;
  }
  return parseFloat(trimmed) || 0;
}

// Calculate suggested overtime hours past 18:00
function calculateSuggestedOvertime(startTimeStr: string, endTimeStr: string): number {
  const start = timeToDecimal(startTimeStr);
  const end = timeToDecimal(endTimeStr);

  if (end < start) {
    // Crosses midnight (e.g. 20:00 to 02:00)
    const hoursBeforeMidnight = 24 - Math.max(start, 18);
    const hoursAfterMidnight = end;
    return Math.max(0, hoursBeforeMidnight + hoursAfterMidnight);
  }

  if (end > 18) {
    const overtimeStart = Math.max(start, 18);
    return Math.max(0, end - overtimeStart);
  }

  return 0;
}

function getSessionPayrollPeriod(dateStr: string): string {
  if (!dateStr) return '';
  const trimmed = dateStr.trim();
  let y = 0, m = 0, d = 0;
  if (trimmed.includes('.')) {
    const parts = trimmed.split('.');
    if (parts.length === 3) {
      y = parseInt(parts[2]) || 0;
      m = parseInt(parts[1]) || 0;
      d = parseInt(parts[0]) || 0;
    }
  } else if (trimmed.includes('-')) {
    const parts = trimmed.split('-');
    if (parts.length === 3) {
      y = parseInt(parts[0]) || 0;
      m = parseInt(parts[1]) || 0;
      d = parseInt(parts[2]) || 0;
    }
  }
  if (!y || !m || !d) return '';

  // Payroll period rule: 15th of month X to 14th of month X+1
  if (d >= 15) {
    return `${y}-${String(m).padStart(2, '0')}`;
  } else {
    let prevY = y;
    let prevM = m - 1;
    if (prevM === 0) {
      prevM = 12;
      prevY = y - 1;
    }
    return `${prevY}-${String(prevM).padStart(2, '0')}`;
  }
}

export const OvertimeApprovalsPage = async () => {
  const w = window as any;
  
  const currentUser = w.currentUser || w.appState?.userProfile;
  const isLeader = currentUser?.role !== 'ADMIN' && currentUser?.managedTeams && currentUser.managedTeams.length > 0;

  // Local state for filters (defaults to active payroll period)
  const now = new Date();
  const currentDay = now.getDate();
  let currentYear = now.getFullYear();
  let currentMonthNum = now.getMonth() + 1;
  if (currentDay < 15) {
    currentMonthNum -= 1;
    if (currentMonthNum === 0) {
      currentMonthNum = 12;
      currentYear -= 1;
    }
  }
  const defaultMonth = `${currentYear}-${String(currentMonthNum).padStart(2, '0')}`;

  // Reset filters if logged in user has changed since last visit
  if (w._lastOvertimeUserId !== currentUser?.uid) {
    w.overtimeSelectedMonth = defaultMonth;
    w.overtimeSelectedStatus = 'all';
    w.overtimeSelectedCompany = 'all';
    w.overtimeSelectedSort = 'date-desc';
    w.overtimeSelectedPersonnel = 'all';
    w.overtimeSelectedRegion = 'all';
    w._lastOvertimeUserId = currentUser?.uid;
  }

  let selectedMonth = w.overtimeSelectedMonth || defaultMonth;
  let selectedStatus = w.overtimeSelectedStatus || 'all'; // all, pending, approved, rejected, deleted
  let selectedCompany = w.overtimeSelectedCompany || 'all'; // all, Demirer Enerji, Har Film Yapım, YEK, Demirer Holding
  let selectedSort = w.overtimeSelectedSort || 'date-desc'; // date-desc, date-asc, name-asc, name-desc
  let selectedPersonnel = w.overtimeSelectedPersonnel || 'all'; // all or specific name
  const getPersonnelRegion = (baseSites: string[]): string => {
    if (!baseSites || baseSites.length === 0) return '';
    // Region 1: Anemon (2688), Sarıkaya (3439), Çamseki (3243)
    if (baseSites.some(id => id === '2688' || id === '3439' || id === '3243')) return '1';
    // Region 2: Sayalar (2990), Kuyucak (3793)
    if (baseSites.some(id => id === '2990' || id === '3793')) return '2';
    // Region 3: Keltepe (3245), Çataltepe (3892)
    if (baseSites.some(id => id === '3245' || id === '3892')) return '3';
    // Region 4: Mare (2678), Germiyan (0752)
    if (baseSites.some(id => id === '2678' || id === '0752')) return '4';
    // Region 5: Dares Datça (3213)
    if (baseSites.some(id => id === '3213')) return '5';
    return '';
  };

  let leaderRegion = 'all';
  if (isLeader) {
    const personnelDetails = personnelService.getPersonnelDetailsList();
    const userEmail = (currentUser?.email || '').toLowerCase().trim();
    const emailPrefix = userEmail.split('@')[0].replace('.', ' ');
    const detail = personnelDetails.find((p: any) => {
      const pName = p.name.toLocaleLowerCase('tr-TR').trim();
      return pName === emailPrefix || (p.email && p.email.toLowerCase().trim() === userEmail) || (currentUser?.displayName && pName === currentUser.displayName.toLocaleLowerCase('tr-TR').trim());
    });
    if (detail) {
      leaderRegion = getPersonnelRegion(detail.baseSites || []);
    }
  }

  let selectedRegion = w.overtimeSelectedRegion || 'all'; // all, 1, 2, 3, 4, 5
  if (isLeader && leaderRegion !== 'all') {
    selectedRegion = leaderRegion;
  }

  let reports: any[] = [];
  let unsubscribe: (() => void) | null = null;

  // Save selection back to window context to preserve state on redraws
  w.overtimeSelectedMonth = selectedMonth;
  w.overtimeSelectedStatus = selectedStatus;
  w.overtimeSelectedCompany = selectedCompany;
  w.overtimeSelectedSort = selectedSort;
  w.overtimeSelectedPersonnel = selectedPersonnel;
  w.overtimeSelectedRegion = selectedRegion;

  // Cleanup helper
  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (w._overtimeUnsubscribe) {
      try { w._overtimeUnsubscribe(); } catch (e) {}
      w._overtimeUnsubscribe = null;
    }
  };

  // Attach functions globally for event handlers
  w.changeOvertimeMonth = (val: string) => {
    w.overtimeSelectedMonth = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.changeOvertimeStatus = (val: string) => {
    w.overtimeSelectedStatus = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.changeOvertimeCompany = (val: string) => {
    w.overtimeSelectedCompany = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.changeOvertimeSort = (val: string) => {
    w.overtimeSelectedSort = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.changeOvertimePersonnel = (val: string) => {
    w.overtimeSelectedPersonnel = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.changeOvertimeRegion = (val: string) => {
    w.overtimeSelectedRegion = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  const SITE_ID_MAP: Record<string, string> = {
    '2688': 'Anemon İntepe',
    '3439': 'Alize Sarıkaya',
    '3793': 'Alize Kuyucak',
    '3243': 'Alize Çamseki',
    '3245': 'Alize Keltepe',
    '3892': 'Alize Çataltepe',
    '0752': 'Alize Germiyan',
    '2678': 'Mare Manastır',
    '2990': 'Doğal Sayalar',
    '3213': 'Dares Datça'
  };

  const syncPersonnelSiteAndCompany = () => {
    const personnelSelect = document.getElementById('man-personnel') as HTMLSelectElement;
    const siteSelect = document.getElementById('man-site') as HTMLSelectElement;
    const badge = document.getElementById('man-personnel-info-badge');
    if (!personnelSelect || !siteSelect) return;

    const selectedName = personnelSelect.value;
    if (!selectedName) return;

    const details = personnelService.getPersonnelDetailsList();
    const pDetail = details.find((p: any) => p.name === selectedName);

    if (pDetail) {
      const company = pDetail.company || 'Demirer Enerji Elektrik Üretim A.Ş.';
      let matchedSite = '';
      if (pDetail.baseSites && pDetail.baseSites.length > 0) {
        matchedSite = SITE_ID_MAP[pDetail.baseSites[0]] || '';
      }

      if (matchedSite && Array.from(siteSelect.options).some(opt => opt.value === matchedSite)) {
        siteSelect.value = matchedSite;
      }

      if (badge) {
        badge.innerHTML = `🏢 <b>Şirket:</b> ${company} ${matchedSite ? ` | 📍 <b>Kayıtlı Saha:</b> ${matchedSite}` : ''}`;
        badge.style.display = 'block';
      }
    } else if (badge) {
      badge.style.display = 'none';
    }
  };

  w.openManualOvertimeModal = () => {
    const modal = document.getElementById('manual-overtime-modal');
    if (!modal) return;
    
    // Set default date to today's local date
    const dateInput = document.getElementById('man-date') as HTMLInputElement;
    if (dateInput) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    // Reset inputs
    const hoursInput = document.getElementById('man-hours') as HTMLInputElement;
    if (hoursInput) hoursInput.value = "4.0";
    const sodexoInput = document.getElementById('man-sodexo') as HTMLInputElement;
    if (sodexoInput) sodexoInput.checked = false;
    const harcirahInput = document.getElementById('man-harcirah') as HTMLInputElement;
    if (harcirahInput) harcirahInput.checked = false;
    const noteInput = document.getElementById('man-note') as HTMLInputElement;
    if (noteInput) noteInput.value = "";

    const personnelSelect = document.getElementById('man-personnel') as HTMLSelectElement;
    if (personnelSelect && !personnelSelect.hasAttribute('data-bound-sync')) {
      personnelSelect.setAttribute('data-bound-sync', 'true');
      personnelSelect.addEventListener('change', syncPersonnelSiteAndCompany);
    }

    syncPersonnelSiteAndCompany();
    
    modal.style.display = 'flex';
  };

  w.closeManualOvertimeModal = () => {
    const modal = document.getElementById('manual-overtime-modal');
    if (modal) modal.style.display = 'none';
  };

  w.saveManualOvertime = async () => {
    const personnelName = (document.getElementById('man-personnel') as HTMLSelectElement).value;
    const siteName = (document.getElementById('man-site') as HTMLSelectElement).value;
    const date = (document.getElementById('man-date') as HTMLInputElement).value;
    const hours = parseFloat((document.getElementById('man-hours') as HTMLInputElement).value) || 0;
    const sodexo = (document.getElementById('man-sodexo') as HTMLInputElement).checked;
    const harcirah = (document.getElementById('man-harcirah') as HTMLInputElement).checked;
    const note = (document.getElementById('man-note') as HTMLInputElement).value.trim();

    if (!personnelName || !date || hours <= 0) {
      alert("Lütfen tüm zorunlu alanları doldurun ve geçerli bir saat girin.");
      return;
    }

    try {
      const reportId = `manual_${Date.now()}`;
      const sessionId = `session_${Date.now()}`;

      const details = personnelService.getPersonnelDetailsList();
      const pDetail = details.find((p: any) => p.name === personnelName);
      const company = pDetail?.company || '';
      const siteId = pDetail?.baseSites?.[0] || Object.keys(SITE_ID_MAP).find(k => SITE_ID_MAP[k] === siteName) || '';
      
      const docData = {
        id: reportId,
        reportNo: `MAN-${date.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'MANUEL_MESAI',
        date: date,
        siteName: siteName,
        siteId: siteId,
        company: company,
        personnel: [personnelName],
        workSessions: [
          {
            id: sessionId,
            date: date,
            startTime: '08:00',
            endTime: decimalToTimeStr(8 + hours),
            duration: decimalToTimeStr(hours),
            personnel: [personnelName],
            type: 'ÇALIŞMA',
            note: note || 'Manuel Mesai Girişi'
          }
        ],
        overtimeApprovals: {
          [sessionId]: {
            [personnelName]: {
              status: 'approved',
              approvedHours: hours,
              sodexo: sodexo,
              harcirah: harcirah,
              approvedBy: (window as any).currentUser?.email || 'admin@demirerholding.com',
              approvedAt: new Date().toISOString()
            }
          }
        },
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'serviceReports', reportId), docData);
      
      w.closeManualOvertimeModal();
    } catch (err: any) {
      console.error("Manuel mesai kaydetme hatası:", err);
      alert("Hata oluştu: " + err.message);
    }
  };

  w.deleteSessionOvertime = async (reportId: string, personnelName: string) => {
    if (!confirm(`${personnelName} için bu mesai kaydını listeden kaldırmak istediğinize emin misiniz?`)) return;

    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName);
    if (!row) return;

    const currentApprovals = report.overtimeApprovals || {};
    row.sessions.forEach((s: any) => {
      if (!currentApprovals[s.id]) currentApprovals[s.id] = {};
      currentApprovals[s.id][personnelName] = {
        status: 'deleted',
        approvedHours: 0,
        sodexo: false,
        harcirah: false,
        approvedBy: w.currentUser?.email || 'Admin',
        approvedAt: new Date().toISOString()
      };
    });

    try {
      if (w.showToast) w.showToast('Bilgi', 'Güncelleniyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', 'Kayıt listeden kaldırıldı', 'success');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'İşlem başarısız: ' + err.message, 'error');
    }
  };

  w.restoreSessionOvertime = async (reportId: string, personnelName: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName);
    if (!row) return;

    const currentApprovals = report.overtimeApprovals || {};
    row.sessions.forEach((s: any) => {
      if (currentApprovals[s.id] && currentApprovals[s.id][personnelName]) {
        currentApprovals[s.id][personnelName].status = 'pending';
      }
    });

    try {
      if (w.showToast) w.showToast('Bilgi', 'Kayıt geri alınıyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', 'Kayıt geri yüklendi', 'success');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'İşlem başarısız: ' + err.message, 'error');
    }
  };

  w.approveSessionOvertime = async (reportId: string, personnelName: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName);
    if (!row) return;

    const keyName = personnelName.replace(/\s+/g, '_');
    const hoursInput = document.getElementById(`hours-${reportId}-${keyName}`) as HTMLInputElement;
    const sodexoInput = document.getElementById(`sodexo-${reportId}-${keyName}`) as HTMLInputElement;
    const harcirahInput = document.getElementById(`harcirah-${reportId}-${keyName}`) as HTMLInputElement;
    
    const totalApprovedHours = hoursInput ? timeStrToDecimal(hoursInput.value) : 0;
    const sodexo = sodexoInput ? sodexoInput.checked : false;
    const harcirah = harcirahInput ? harcirahInput.checked : false;

    const currentApprovals = report.overtimeApprovals || {};
    
    // Distribute hours proportionally based on suggested hours
    const totalSuggested = row.sessions.reduce((sum: number, s: any) => sum + s.suggestedHours, 0);
    row.sessions.forEach((s: any, idx: number) => {
      if (!currentApprovals[s.id]) currentApprovals[s.id] = {};
      
      let appHours = 0;
      if (totalSuggested > 0) {
        appHours = (s.suggestedHours / totalSuggested) * totalApprovedHours;
      } else if (idx === 0) {
        appHours = totalApprovedHours;
      }
      appHours = parseFloat(appHours.toFixed(2));

      currentApprovals[s.id][personnelName] = {
        status: 'approved',
        approvedHours: appHours,
        sodexo: idx === 0 ? sodexo : false,
        harcirah: idx === 0 ? harcirah : false,
        approvedBy: w.currentUser?.email || 'Admin',
        approvedAt: new Date().toISOString()
      };
    });

    try {
      if (w.showToast) w.showToast('Bilgi', 'Güncelleniyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', 'Onaylandı', 'success');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'Kaydedilemedi: ' + err.message, 'error');
    }
  };

  w.rejectSessionOvertime = async (reportId: string, personnelName: string) => {
    if (!confirm(`${personnelName} için mesaiyi reddetmek istediğinize emin misiniz?`)) return;

    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName);
    if (!row) return;

    const currentApprovals = report.overtimeApprovals || {};
    row.sessions.forEach((s: any) => {
      if (!currentApprovals[s.id]) currentApprovals[s.id] = {};
      currentApprovals[s.id][personnelName] = {
        status: 'rejected',
        approvedHours: 0,
        sodexo: false,
        harcirah: false,
        approvedBy: w.currentUser?.email || 'Admin',
        approvedAt: new Date().toISOString()
      };
    });

    try {
      if (w.showToast) w.showToast('Bilgi', 'Güncelleniyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', 'Mesai reddedildi', 'info');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'Red kaydedilemedi: ' + err.message, 'error');
    }
  };

  w.editApprovedOvertime = async (reportId: string, personnelName: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName);
    if (!row) return;

    const currentApprovals = report.overtimeApprovals || {};
    row.sessions.forEach((s: any) => {
      if (currentApprovals[s.id] && currentApprovals[s.id][personnelName]) {
        currentApprovals[s.id][personnelName].status = 'pending';
      }
    });

    try {
      if (w.showToast) w.showToast('Bilgi', 'Düzenleme modu açılıyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', 'Düzenleme modu aktif edildi. Bilgileri değiştirip tekrar onaylayabilirsiniz.', 'success');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'İşlem başarısız: ' + err.message, 'error');
    }
  };

  w.exportOvertimeExcel = () => {
    try {
      const flatRows = w.getFilteredOvertimeRows(false); // get currently filtered rows for excel
      if (flatRows.length === 0) {
        alert('Seçilen ay için dışa aktarılacak kayıt bulunamadı.');
        return;
      }
      
      const [year, month] = selectedMonth.split('-');
      const yNum = parseInt(year);
      const mNum = parseInt(month);
      let nextY = yNum;
      let nextM = mNum + 1;
      if (nextM === 13) {
        nextM = 1;
        nextY = yNum + 1;
      }
      const turkishMonthFull = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      const startMonthFull = turkishMonthFull[mNum - 1];
      const endMonthFull = turkishMonthFull[nextM - 1];
      
      const companyPart = selectedCompany === 'all' ? '' : ` (${selectedCompany})`;
      const finalFileName = `Servis mesai Bildirimi 15 ${startMonthFull} - 14 ${endMonthFull} ${nextY}${companyPart}`;
      
      excelService.exportOvertimeToExcel(flatRows, finalFileName);
      if (w.showToast) w.showToast('Başarılı', 'Excel raporu indirildi.', 'success');
    } catch (err: any) {
      console.error("Excel Export Error:", err);
      alert("Excel dışa aktarılırken bir hata oluştu: " + err.message);
    }
  };

  w.exportOfficeOvertimeExcel = () => {
    try {
      const flatRows = w.getFilteredOvertimeRows(false);
      if (flatRows.length === 0) {
        alert('Seçilen ay için dışa aktarılacak kayıt bulunamadı.');
        return;
      }
      
      const [year, month] = selectedMonth.split('-');
      const yNum = parseInt(year);
      const mNum = parseInt(month);
      let nextY = yNum;
      let nextM = mNum + 1;
      if (nextM === 13) {
        nextM = 1;
        nextY = yNum + 1;
      }
      const turkishMonthFull = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
      const startMonthFull = turkishMonthFull[mNum - 1];
      const endMonthFull = turkishMonthFull[nextM - 1];
      
      const periodTitle = (yNum === nextY)
        ? `15 ${startMonthFull} - 14 ${endMonthFull} ${nextY}`
        : `15 ${startMonthFull} ${yNum} - 14 ${endMonthFull} ${nextY}`;

      const companyPart = selectedCompany === 'all' ? '' : ` (${selectedCompany})`;
      const finalFileName = `Ofis Mesai Bildirimi ${periodTitle}${companyPart}`;
      const monthYearTitle = `${endMonthFull} ${nextY}`;
      
      excelService.exportOfficeOvertimeToExcel(flatRows, finalFileName, periodTitle, monthYearTitle);
      if (w.showToast) w.showToast('Başarılı', 'Ofis Excel raporu indirildi.', 'success');
    } catch (err: any) {
      console.error("Office Excel Export Error:", err);
      alert("Ofis Excel dışa aktarılırken bir hata oluştu: " + err.message);
    }
  };

  // Set up real-time listener for the selected month
  const q = query(collection(db, 'serviceReports'));
  unsubscribe = onSnapshot(q, (snapshot) => {
    reports = [];
    snapshot.forEach(docSnap => {
      reports.push({ id: docSnap.id, ...docSnap.data() });
    });
    
    w.renderOvertimeApprovalsList();
  }, (err) => {
    console.error("Firestore onSnapshot error:", err);
    const debugStatsEl = document.getElementById('overtime-debug-panel-stats');
    if (debugStatsEl) {
      debugStatsEl.innerHTML = `<span style="color: #ff4d4d; font-weight: bold;">FIRESTORE ERROR: ${err.message} (${err.code})</span>`;
    }
  });
  w._overtimeUnsubscribe = unsubscribe;

  const TRACKING_START_MONTH = '2026-07';

  w.getPersonnelPastBalance = (personName: string, targetMonth: string): number => {
    let totalDiffHours = 0;
    reports.forEach(report => {
      const workSessions = report.workSessions || [];
      workSessions.forEach((session: any) => {
        if (!session.date) return;
        const sessionMonth = getSessionPayrollPeriod(session.date);
        
        // Skip months before the tracking start month (2026-07)
        if (sessionMonth < TRACKING_START_MONTH) return;
        // Only target months strictly before the targetMonth
        if (sessionMonth >= targetMonth) return;

        const personnelList = session.personnel || [];
        personnelList.forEach((name: string) => {
          if (name.toLocaleLowerCase('tr-TR').trim() !== personName.toLocaleLowerCase('tr-TR').trim()) return;

          const approval = report.overtimeApprovals?.[session.id]?.[name];
          if (approval && approval.status === 'approved') {
            const suggested = DateTimeUtils.calculateOvertimeHours(
              session.date,
              session.startTime,
              session.endTime,
              session.isOffDay || false,
              name
            );
            const approved = approval.approvedHours !== undefined ? approval.approvedHours : suggested;
            totalDiffHours += (suggested - approved);
          }
        });
      });
    });
    return Math.round(totalDiffHours * 60); // returns difference in minutes
  };
  // Calculate and return the flat rows from the reports list
  w.getFilteredOvertimeRows = (allProcessed = false) => {
    const rows: any[] = [];
    const personnelDetails = personnelService.getPersonnelDetailsList();

    const norm = (s: string) => {
      return (s || '')
        .toLocaleLowerCase('tr-TR')
        .replace(/ğ/g, 'g')
        .replace(/ü/g, 'u')
        .replace(/ş/g, 's')
        .replace(/ı/g, 'i')
        .replace(/ö/g, 'o')
        .replace(/ç/g, 'c')
        .replace(/\s+/g, '');
    };

    // Pre-calculate daily total work overtime per personnel across all reports to correctly suggest Sodexo
    const dailyWorkOtMap = new Map<string, Map<string, number>>();
    const dailyFirstReportMap = new Map<string, Map<string, string>>();

    reports.forEach(report => {
      const workSessions = report.workSessions || [];
      workSessions.forEach((session: any) => {
        if (!session.date || getSessionPayrollPeriod(session.date) !== selectedMonth) return;
        const sessionTypeUpper = (session.type || '').toUpperCase().trim();
        const isTravel = ['EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE', 'YOL', 'TRAVEL', 'GİDİŞ YOLU', 'DÖNÜŞ YOLU'].includes(sessionTypeUpper);
        if (isTravel) return;

        const pList = session.personnel || [];
        pList.forEach((pName: string) => {
          if (!pName || !pName.trim()) return;
          const detail = personnelDetails.find(d => norm(d.name) === norm(pName));
          const canonicalName = detail?.name || pName.trim();
          const rDate = session.date || report.date;
          if (!rDate) return;

          const workOt = DateTimeUtils.calculateOvertimeHours(
            rDate,
            session.startTime,
            session.endTime,
            session.isOffDay || false,
            pName
          );

          if (!dailyWorkOtMap.has(canonicalName)) {
            dailyWorkOtMap.set(canonicalName, new Map());
            dailyFirstReportMap.set(canonicalName, new Map());
          }
          const pDates = dailyWorkOtMap.get(canonicalName)!;
          const pFirstR = dailyFirstReportMap.get(canonicalName)!;

          pDates.set(rDate, (pDates.get(rDate) || 0) + workOt);
          if (!pFirstR.has(rDate)) {
            pFirstR.set(rDate, report.id);
          }
        });
      });
    });

    reports.forEach(report => {
      // Apply allowed sites filter for all non-admins
      if (currentUser?.role !== 'ADMIN') {
        const allowedSites = currentUser?.allowedSites || [];
        if (!allowedSites.includes('all') && report.siteId && !allowedSites.includes(report.siteId)) {
          return;
        }
      }

      const workSessions = report.workSessions || [];
      const personnelMap = new Map<string, string>();
      workSessions.forEach((session: any) => {
        if (!session.date || getSessionPayrollPeriod(session.date) !== selectedMonth) return;
        const sessionTypeUpper = (session.type || '').toUpperCase();
        if (sessionTypeUpper && !['ÇALIŞMA', 'YOL', 'EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE'].includes(sessionTypeUpper)) return;
        
        const pList = session.personnel || [];
        pList.forEach((name: string) => {
          if (!name || !name.trim()) return;
          const key = norm(name);
          if (!personnelMap.has(key)) {
            personnelMap.set(key, name.trim());
          }
        });
      });

      personnelMap.forEach((name: string) => {
        // Skip exempt office personnel
        const nameLower = name.toLocaleLowerCase('tr-TR').trim();
        if (nameLower === 'fatih zebek' || nameLower === 'furkan yıldırım') return;

        const detail = personnelDetails.find(d => norm(d.name) === norm(name));
        
        if (isLeader) {
          const userManagedTeams = [...(currentUser?.managedTeams || [])];
          const userTeam = currentUser?.team;
          if (userTeam && !userManagedTeams.includes(userTeam)) {
            userManagedTeams.push(userTeam);
          }
          if (!detail) {
            console.log("[DEBUG] Skip: detail not found for", name);
            return;
          }
          if (!detail.team) {
            console.log("[DEBUG] Skip: no team for detail", detail);
            return;
          }
          const pTeamClean = detail.team.replace(/\s+/g, '').toLowerCase();
          const matches = userManagedTeams.some(t => t.replace(/\s+/g, '').toLowerCase() === pTeamClean);
          if (!matches) {
            console.log("[DEBUG] Skip: team mismatch for", name, "team:", detail.team, "managed:", userManagedTeams);
            return;
          }
        }
        
        const company = detail?.company || '';
        
        // Apply company filter
        if (selectedCompany !== 'all' && company !== selectedCompany) return;

        // Apply region filter
        const region = getPersonnelRegion(detail?.baseSites || []);
        if (selectedRegion !== 'all' && region !== selectedRegion) return;

        const canonicalName = detail?.name || name.trim();

        // Apply personnel filter
        if (selectedPersonnel !== 'all' && canonicalName !== selectedPersonnel) return;

        // Find all sessions of this personnel in this report
        const sessions = workSessions.filter((session: any) => {
          if (!session.date || getSessionPayrollPeriod(session.date) !== selectedMonth) return false;
          const sessionTypeUpper = (session.type || '').toUpperCase();
          if (sessionTypeUpper && !['ÇALIŞMA', 'YOL', 'EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE'].includes(sessionTypeUpper)) return false;
          
          const pList = session.personnel || [];
          return pList.some((pn: string) => norm(pn) === norm(name));
        });

        if (sessions.length === 0) return;

        // Calculate aggregated suggested values
        let suggestedHoursSum = 0;
        let suggestedSodexo = false;
        let suggestedHarcirah = false;
        
        const baseSites = detail?.baseSites || [];
        const isAtBaseSite = baseSites.length > 0 && !!report.siteId && baseSites.includes(report.siteId);
        suggestedHarcirah = !isAtBaseSite;

        sessions.forEach((session: any) => {
          const suggestedHours = DateTimeUtils.calculateOvertimeHours(
            session.date,
            session.startTime,
            session.endTime,
            session.isOffDay || false,
            name
          );
          suggestedHoursSum += suggestedHours;
        });

        const firstSession = sessions[0];
        const rDate = firstSession?.date || report?.date;
        const totalDailyWorkOt = dailyWorkOtMap.get(canonicalName)?.get(rDate) || 0;
        const firstReportId = dailyFirstReportMap.get(canonicalName)?.get(rDate);
        const isOffDayOrHoliday = rDate && (DateTimeUtils.isPublicHoliday(rDate) || (sessions && sessions.some((s: any) => s.isOffDay)));
        suggestedHarcirah = !isAtBaseSite && (suggestedHoursSum > 0 || isOffDayOrHoliday);

        suggestedSodexo = (totalDailyWorkOt >= 3.0) && (report.id === firstReportId);

        // Determine status and approved values
        let approvedHoursSum = 0;
        let hasSodexoDecision = false;
        let sodexoApprovedVal = false;
        let harcirahVal = false;
        let status = 'pending';

        const statuses = sessions.map((s: any) => report.overtimeApprovals?.[s.id]?.[name]?.status || 'pending');
        if (statuses.includes('deleted')) {
          status = 'deleted';
        } else if (statuses.includes('rejected')) {
          status = 'rejected';
        } else if (statuses.every((st: string) => st === 'approved')) {
          status = 'approved';
        } else {
          status = 'pending';
        }

        // Apply status filter
        if (selectedStatus !== 'deleted' && status === 'deleted') return;
        if (selectedStatus === 'deleted' && status !== 'deleted') return;

        sessions.forEach((s: any) => {
          const approval = report.overtimeApprovals?.[s.id]?.[name] || {};
          
          const sHours = DateTimeUtils.calculateOvertimeHours(
            s.date,
            s.startTime,
            s.endTime,
            s.isOffDay || false
          );
          const computedHours = approval.approvedHours !== undefined ? approval.approvedHours : parseFloat(sHours.toFixed(2));
          approvedHoursSum += computedHours;
          s.approvedHours = computedHours; // Attach approved hours to individual session object for Excel exports
          
          if (approval.sodexo !== undefined) {
            hasSodexoDecision = true;
            if (approval.sodexo) sodexoApprovedVal = true;
          }
          if (approval.harcirah !== undefined) {
            if (approval.harcirah) harcirahVal = true;
          } else if (suggestedHarcirah) {
            harcirahVal = true;
          }
        });

        let sodexoVal = hasSodexoDecision ? sodexoApprovedVal : suggestedSodexo;

        // Double-safety shield: Normal weekday shifts with 0 overtime cannot earn Sodexo or Harcirah automatically
        if (!isOffDayOrHoliday && (status === 'approved' ? approvedHoursSum : suggestedHoursSum) === 0) {
          sodexoVal = false;
          if (!sessions.some((s: any) => report.overtimeApprovals?.[s.id]?.[name]?.harcirah !== undefined)) {
            harcirahVal = false;
          }
        }

        // Skip shifts with no overtime (both suggested and approved = 0), no sodexo, and no harcirah
        const effectiveHours = status === 'approved' ? approvedHoursSum : (approvedHoursSum > 0 ? approvedHoursSum : suggestedHoursSum);
        if (effectiveHours === 0 && !sodexoVal && !harcirahVal && status !== 'deleted') {
          return;
        }

        const row = {
          reportId: report.id,
          personnel: canonicalName,
          rawName: name,
          company,
          date: report.date || firstSession.date,
          reportNo: report.reportNo,
          siteName: report.siteName || 'Bilinmeyen Saha',
          turbineNo: report.turbineNo || '---',
          turbineSerial: report.turbineSerial || '---',
          suggestedHours: parseFloat(suggestedHoursSum.toFixed(2)),
          suggestedSodexo,
          suggestedHarcirah,
          approvedHours: parseFloat(approvedHoursSum.toFixed(2)),
          sodexo: sodexoVal,
          harcirah: harcirahVal,
          status,
          approvedBy: sessions.map((s: any) => report.overtimeApprovals?.[s.id]?.[name]?.approvedBy).filter(Boolean)[0] || '',
          approvedAt: sessions.map((s: any) => report.overtimeApprovals?.[s.id]?.[name]?.approvedAt).filter(Boolean)[0] || '',
          faultCode: report.faultCode || '',
          sessions: sessions
        };

        if (allProcessed) {
          if (status === 'approved') rows.push(row);
        } else {
          if (selectedStatus === 'all') {
            rows.push(row);
          } else if (selectedStatus === status) {
            rows.push(row);
          }
        }
      });
    });

    // Deduplicate rows by reportNo/reportId + normalized personnel name to guarantee no double entries
    const normKey = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/gi, '');
    const uniqueRowsMap = new Map<string, any>();
    rows.forEach(r => {
      const rowKey = `${r.reportNo || r.reportId}_${normKey(r.personnel)}`;
      if (!uniqueRowsMap.has(rowKey)) {
        uniqueRowsMap.set(rowKey, r);
      }
    });
    const finalRows = Array.from(uniqueRowsMap.values());

    // Sort by selectedSort
    return finalRows.sort((a, b) => {
      if (selectedSort === 'date-desc') {
        const cmpDate = b.date.localeCompare(a.date);
        if (cmpDate !== 0) return cmpDate;
        return a.personnel.localeCompare(b.personnel, 'tr-TR');
      } else if (selectedSort === 'date-asc') {
        const cmpDate = a.date.localeCompare(b.date);
        if (cmpDate !== 0) return cmpDate;
        return a.personnel.localeCompare(b.personnel, 'tr-TR');
      } else if (selectedSort === 'name-asc') {
        const cmpName = a.personnel.localeCompare(b.personnel, 'tr-TR');
        if (cmpName !== 0) return cmpName;
        return b.date.localeCompare(a.date);
      } else if (selectedSort === 'name-desc') {
        const cmpName = b.personnel.localeCompare(a.personnel, 'tr-TR');
        if (cmpName !== 0) return cmpName;
        return b.date.localeCompare(a.date);
      }
      return 0;
    });


  };

  w.renderOvertimeApprovalsList = () => {
    const container = document.getElementById('overtime-queue-container');
    const summaryContainer = document.getElementById('overtime-summary-cards');
    if (!container) return;

    const personnelDetails = personnelService.getPersonnelDetailsList();
    const filteredRows = w.getFilteredOvertimeRows(false);





    // Calculate Summary Tallies (Totals per personnel for approved items in this month)
    const summaryMap: { [name: string]: { standardHours: number, holidayHours: number, sodexo: number, harcirah: number } } = {};
    const allProcessedRows = w.getFilteredOvertimeRows(true);
    allProcessedRows.forEach((row: any) => {
      if (row.status !== 'approved') return;
      const canonicalName = row.personnel;
      if (!summaryMap[canonicalName]) {
        summaryMap[canonicalName] = { standardHours: 0, holidayHours: 0, sodexo: 0, harcirah: 0 };
      }
      
      const rDate = row.date;
      const isHoliday = rDate && (DateTimeUtils.isPublicHoliday(rDate) || (row.sessions && row.sessions.some((s: any) => s.isOffDay)));
      const hours = row.approvedHours || 0;
      
      if (isHoliday) {
        summaryMap[canonicalName].holidayHours += hours;
      } else {
        summaryMap[canonicalName].standardHours += hours;
      }

      if (row.sodexo) summaryMap[canonicalName].sodexo += 1;
      if (row.harcirah) summaryMap[canonicalName].harcirah += 1;
    });

    // Render Summary Cards
    if (summaryContainer) {
      const summaryKeys = Object.keys(summaryMap).filter(name => {
        const data = summaryMap[name];
        return data.standardHours > 0 || data.holidayHours > 0 || data.sodexo > 0 || data.harcirah > 0;
      }).sort((a, b) => a.localeCompare(b, 'tr-TR'));
      if (summaryKeys.length === 0) {
        summaryContainer.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1rem;">Bu ay için henüz onaylanmış mesai bulunmamaktadır.</div>`;
      } else {
        summaryContainer.innerHTML = summaryKeys.map(name => {
          const data = summaryMap[name];
          return `
            <div class="glass-panel" style="padding: 1rem; border: 1px solid rgba(0, 242, 254, 0.1); border-radius: 8px; display: flex; flex-direction: column; gap: 0.5rem; background: rgba(0, 242, 254, 0.01);">
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.95rem; color: #fff; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 4px;">
                <i class="fa-solid fa-user" style="color: var(--accent-cyan); font-size: 0.75rem; margin-right: 6px;"></i> ${name}
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span style="color: var(--text-muted);">Fazla Çalışma:</span>
                <strong style="color: var(--accent-green); font-family: monospace;">${decimalToTurkishTimeStr(data.standardHours)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span style="color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-calendar-star" style="font-size: 0.65rem; color: #ff4a4a;"></i> Resmi Tatil Mesaisi:
                </span>
                <strong style="color: ${data.holidayHours > 0 ? '#ff4a4a' : 'var(--text-muted)'}; font-family: monospace;">${decimalToTurkishTimeStr(data.holidayHours)}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span style="color: var(--text-muted);">Toplam Sodexo:</span>
                <strong style="color: var(--accent-orange); font-family: monospace;">${data.sodexo} Yemek</strong>
              </div>
              <div style="display: flex; justify-content: space-between; font-size: 0.75rem;">
                <span style="color: var(--text-muted);">Dış Görev Harcırahı:</span>
                <strong style="color: var(--accent-cyan); font-family: monospace;">${data.harcirah} Gün</strong>
              </div>
            </div>
          `;
        }).join('');
      }
    }

    // Render Table Queue
    if (filteredRows.length === 0) {
      container.innerHTML = `
        <tr>
          <td colspan="9" style="text-align: center; padding: 3rem; color: var(--text-muted); font-size: 0.9rem;">
            <i class="fa-solid fa-inbox fa-3x" style="opacity: 0.2; display: block; margin-bottom: 1rem;"></i>
            Seçilen filtrelere uygun mesai kaydı bulunmamaktadır.
          </td>
        </tr>
      `;
      return;
    }

    container.innerHTML = filteredRows.map((row: any) => {
      let badgeColor = 'rgba(255, 171, 0, 0.15)';
      let badgeText = 'Bekliyor';
      let textColor = 'var(--accent-orange)';
      if (row.status === 'approved') {
        badgeColor = 'rgba(0, 230, 118, 0.1)';
        badgeText = 'Onaylandı';
        textColor = 'var(--accent-green)';
      } else if (row.status === 'rejected') {
        badgeColor = 'rgba(255, 77, 77, 0.1)';
        badgeText = 'Reddedildi';
        textColor = 'var(--accent-red)';
      } else if (row.status === 'deleted') {
        badgeColor = 'rgba(239, 68, 68, 0.1)';
        badgeText = 'Silindi';
        textColor = '#EF4444';
      }

      const keyName = row.rawName.replace(/\s+/g, '_');
      const inputId = `hours-${row.reportId}-${keyName}`;
      const sodexoId = `sodexo-${row.reportId}-${keyName}`;
      const harcirahId = `harcirah-${row.reportId}-${keyName}`;

      // Date conversion to dd.mm.yyyy for readability
      let formattedDate = row.date;
      if (row.date && row.date.includes('-')) {
        const [y, m, d] = row.date.split('-');
        formattedDate = `${d}.${m}.${y}`;
      }

      // Calculate past rounding balance for personnel (suggested - approved)
      const balance = w.getPersonnelPastBalance(row.personnel, selectedMonth);
      let balanceHtml = '';
      if (balance > 0) {
        balanceHtml = `<span class="badge-balance" style="background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Geçmiş dönemlerden hak ettiği ama yuvarlama sebebiyle alamadığı süre (Alacaklı)">+${balance} dk</span>`;
      } else if (balance < 0) {
        balanceHtml = `<span class="badge-balance" style="background: rgba(251, 146, 60, 0.08); color: var(--accent-orange); border: 1px solid rgba(251, 146, 60, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Geçmiş dönemlerde hak ettiğinden fazla yuvarlanan süre (Borçlu)">${balance} dk</span>`;
      } else {
        balanceHtml = `<span class="badge-balance" style="background: rgba(255,255,255,0.03); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Geçmiş dönem kumbara bakiyesi dengede (0 dk)">0 dk</span>`;
      }

      return `
        <tr class="table-row-hover" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
          <td style="padding: 1rem 0.75rem; vertical-align: middle;">
            <div style="font-weight: 700; color: #fff; font-size: 0.9rem; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
              ${row.personnel} ${balanceHtml}
            </div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${row.company || 'Bilinmeyen Şirket'}</div>
          </td>
          <td style="padding: 1rem 0.75rem; vertical-align: middle;">
            <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
              <span style="color: #fff; font-size: 0.85rem; font-family: monospace;">${formattedDate}</span>
              ${DateTimeUtils.isPublicHoliday(row.date) 
                ? `<span style="background: rgba(239, 68, 68, 0.12); color: #ff4a4a; border: 1px solid rgba(239, 68, 68, 0.25); padding: 1px 5px; border-radius: 4px; font-size: 0.6rem; font-weight: 800; font-family: sans-serif; letter-spacing: 0.3px;"><i class="fa-solid fa-calendar-star" style="margin-right: 3px;"></i>RESMİ TATİL</span>` 
                : DateTimeUtils.isWeekend(row.date) 
                  ? `<span style="background: rgba(249, 115, 22, 0.12); color: #ff9d42; border: 1px solid rgba(249, 115, 22, 0.25); padding: 1px 5px; border-radius: 4px; font-size: 0.6rem; font-weight: 800; font-family: sans-serif; letter-spacing: 0.3px;"><i class="fa-solid fa-calendar-days" style="margin-right: 3px;"></i>HAFTA SONU</span>` 
                  : ''}
            </div>
            <div style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: 600;">${row.reportNo}</div>
            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 3px;">
              <i class="fa-solid fa-map-pin" style="font-size: 0.6rem; color: var(--accent-cyan); margin-right: 3px;"></i> ${row.siteName} - ${row.turbineNo}
            </div>
            ${row.faultCode ? `
              <div style="font-size: 0.65rem; color: #ff6b6b; margin-top: 2px; font-weight: 600;">
                <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.6rem; margin-right: 3px;"></i> Kod: ${row.faultCode}
              </div>
            ` : `
              <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">
                <i class="fa-solid fa-wrench" style="font-size: 0.6rem; margin-right: 3px;"></i> Bakım
              </div>
            `}
          </td>
          <td style="padding: 1rem 0.75rem; text-align: left; vertical-align: middle; font-family: monospace; font-size: 0.8rem; color: #fff; min-width: 270px;">
            ${(() => {
              const sortedSessions = [...row.sessions].sort((a: any, b: any) => a.startTime.localeCompare(b.startTime));
              const overtimeOnlySessions = sortedSessions.filter((s: any) => {
                const sDate = s.date || row.date;
                const ot = DateTimeUtils.calculateOvertimeHours(sDate, s.startTime, s.endTime, s.isOffDay || false, row.personnel);
                return ot > 0;
              });
              const displaySessions = overtimeOnlySessions.length > 0 ? overtimeOnlySessions : sortedSessions;
              return displaySessions.map((s: any) => {
                const sType = s.type || 'ÇALIŞMA';
                const isTravel = ['EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE', 'YOL'].includes(sType.toUpperCase());
                const badge = isTravel 
                  ? `<span style="background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2); padding: 1px 4.5px; border-radius: 3px; font-size: 0.6rem; font-weight: bold; white-space: nowrap;"><i class="fa-solid fa-car"></i> ${sType}</span>`
                  : `<span style="background: rgba(255,255,255,0.03); color: #bbb; border: 1px solid rgba(255,255,255,0.05); padding: 1px 4.5px; border-radius: 3px; font-size: 0.6rem; white-space: nowrap;">Çalışma</span>`;
                return `
                  <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 4px; border-bottom: 1px dashed rgba(255,255,255,0.02); padding-bottom: 2px; width: 100%;">
                    <span style="width: 105px; flex-shrink: 0; white-space: nowrap; display: inline-block;">${s.startTime} - ${s.endTime}</span>
                    <span style="color: var(--text-muted); font-size: 0.7rem; width: 50px; flex-shrink: 0; text-align: right; display: inline-block;">(${s.duration})</span>
                    <div style="flex-grow: 1; display: flex; justify-content: flex-end; align-items: center; min-width: 0;">
                      ${badge}
                    </div>
                  </div>
                `;
              }).join('');
            })()}
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle; font-family: monospace;">
            <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: #bbb; font-size: 0.8rem;">
              ${decimalToTimeStr(row.suggestedHours)}
            </span>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <input type="text" id="${inputId}" class="cyber-input" value="${decimalToTimeStr(row.approvedHours)}" 
                   placeholder="Örn: 08:00 veya 8"
                   style="width: 85px; text-align: center; height: 32px; font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.2);"
                   onkeydown="if(event.key==='Enter') { window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}'); }"
                   ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
            ${balance !== 0 ? `
              <div style="font-size: 0.65rem; color: ${balance > 0 ? 'var(--accent-cyan)' : 'var(--accent-orange)'}; margin-top: 3px; font-family: monospace;" title="Geçmiş dönem kumbara bakiyesi">
                Kumbara: ${balance > 0 ? '+' : ''}${balance} dk
              </div>
            ` : ''}
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="${sodexoId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-orange);" 
                     ${row.sodexo ? 'checked' : ''} 
                     ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
            </label>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="${harcirahId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);" 
                     ${row.harcirah ? 'checked' : ''} 
                     ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
            </label>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <span style="display: inline-block; background: ${badgeColor}; color: ${textColor}; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${textColor}22;">
              ${badgeText}
            </span>
            ${row.approvedBy ? `
              <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">
                ${formatDisplayName(row.approvedBy)}
              </div>
            ` : ''}
          </td>
          <td style="padding: 1rem 0.75rem; text-align: right; vertical-align: middle;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
              ${isLeader ? `
                <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; border: 1px dashed rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 6px; font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 0.5px;">SALT OKUNUR</span>
              ` : `
                ${row.status === 'deleted' ? `
                  <button onclick="window.restoreSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                          class="btn-cyber-outline" 
                          style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid var(--accent-cyan); background: transparent; color: var(--accent-cyan); cursor: pointer; transition: all 0.2s;"
                          onmouseover="this.style.background='rgba(0, 242, 254, 0.1)'"
                          onmouseout="this.style.background='transparent'">
                    GERİ YÜKLE
                  </button>
                ` : row.status === 'pending' ? `
                  <button onclick="window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                          class="action-icon-btn" 
                          style="width: 32px; height: 32px; border-radius: 6px; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.2); color: var(--accent-green); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                          onmouseover="this.style.background='var(--accent-green)'; this.style.color='#000'"
                          onmouseout="this.style.background='rgba(0, 230, 118, 0.1)'; this.style.color='var(--accent-green)'"
                          title="Onayla">
                    <i class="fa-solid fa-check" style="font-size: 0.85rem;"></i>
                  </button>
                  <button onclick="window.rejectSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                          class="action-icon-btn red" 
                          style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                          onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                          onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                          title="Reddet">
                    <i class="fa-solid fa-xmark" style="font-size: 0.85rem;"></i>
                  </button>
                ` : `
                  <button onclick="window.editApprovedOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                          class="btn-cyber-outline" 
                          style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: transparent; color: var(--text-muted); cursor: pointer;"
                          onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.color='var(--accent-cyan)'"
                          onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.color='var(--text-muted)'">
                    DÜZENLE
                  </button>
                `}
                ${row.status !== 'deleted' ? `
                  <button onclick="window.deleteSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                          class="action-icon-btn red" 
                          style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                          onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                          onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                          title="Kayıt Sil">
                    <i class="fa-solid fa-trash" style="font-size: 0.85rem;"></i>
                  </button>
                ` : ''}
              `}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Build month options dynamically:
  // Starts from baseline June 2026 (2026-06) and grows automatically up to 1 month in the future.
  const monthOptions: string[] = [];
  const startYear = 2026;
  const startMonth = 6;

  // Determine current period
  const actualNow = new Date();
  const actualDay = actualNow.getDate();
  let actualYear = actualNow.getFullYear();
  let actualMonth = actualNow.getMonth() + 1;
  if (actualDay < 15) {
    actualMonth -= 1;
    if (actualMonth === 0) {
      actualMonth = 12;
      actualYear -= 1;
    }
  }

  // Max period is current period + 1 month in the future
  let maxYear = actualYear;
  let maxMonth = actualMonth + 1;
  if (maxMonth === 13) {
    maxMonth = 1;
    maxYear += 1;
  }

  let currY = maxYear;
  let currM = maxMonth;

  while (currY > startYear || (currY === startYear && currM >= startMonth)) {
    monthOptions.push(`${currY}-${String(currM).padStart(2, '0')}`);
    currM--;
    if (currM === 0) {
      currM = 12;
      currY--;
    }
  }

  // Fallback safety
  if (monthOptions.length === 0) {
    monthOptions.push(`${actualYear}-${String(actualMonth).padStart(2, '0')}`);
  }

  const personnelDetailsList = personnelService.getPersonnelDetailsList();
  let filteredPersonnelDetails = personnelDetailsList;
  if (isLeader) {
    const userManagedTeams = [...(currentUser?.managedTeams || [])];
    const userTeam = currentUser?.team;
    if (userTeam && !userManagedTeams.includes(userTeam)) {
      userManagedTeams.push(userTeam);
    }
    filteredPersonnelDetails = personnelDetailsList.filter(p => {
      if (!p.team) return false;
      const pTeamClean = p.team.replace(/\s+/g, '').toLowerCase();
      return userManagedTeams.some(t => t.replace(/\s+/g, '').toLowerCase() === pTeamClean);
    });
  } else if (currentUser?.role !== 'ADMIN') {
    const allowedSites = currentUser?.allowedSites || [];
    const userTeam = currentUser?.team;
    if (!allowedSites.includes('all')) {
      filteredPersonnelDetails = personnelDetailsList.filter(p => {
        const matchesSite = p.baseSites && p.baseSites.some((siteId: string) => allowedSites.includes(siteId));
        const matchesTeam = userTeam && p.team && p.team.replace(/\s+/g, '').toLowerCase() === userTeam.replace(/\s+/g, '').toLowerCase();
        return matchesSite || matchesTeam;
      });
    }
  }

  const personnelNames = filteredPersonnelDetails
    .map(p => p.name)
    .sort((a, b) => a.localeCompare(b, 'tr-TR'));
  const personnelListOptions = personnelNames.map(name => `<option value="${name}">${name}</option>`).join('');

  const availableCompanyNames = Array.from(new Set(personnelDetailsList.map(p => p.company).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'tr-TR'));
  const companySelectOptions = availableCompanyNames.map(cName => `<option value="${cName}" ${selectedCompany === cName ? 'selected' : ''}>${cName}</option>`).join('');

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; gap: 2rem;">
      <style>
        .content-area button[onclick="window.exportOvertimeExcel()"].btn-cyber,
        .content-area button[onclick="window.exportOfficeOvertimeExcel()"].btn-cyber {
          background: rgba(20, 241, 149, 0.06) !important;
          border: 1px solid rgba(20, 241, 149, 0.25) !important;
          color: #14F195 !important;
          min-height: unset !important;
          height: 38px !important;
          padding: 0 16px !important;
          border-radius: 6px !important;
          font-family: 'Rajdhani', sans-serif !important;
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          transition: all 0.2s !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .content-area button[onclick="window.exportOvertimeExcel()"].btn-cyber:hover,
        .content-area button[onclick="window.exportOfficeOvertimeExcel()"].btn-cyber:hover {
          background: rgba(20, 241, 149, 0.15) !important;
          border-color: rgba(20, 241, 149, 0.5) !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(20, 241, 149, 0.1) !important;
        }
        
        .content-area button[onclick="window.openManualOvertimeModal()"].btn-cyber {
          background: rgba(0, 242, 254, 0.06) !important;
          border: 1px solid rgba(0, 242, 254, 0.25) !important;
          color: #00f2fe !important;
          min-height: unset !important;
          height: 38px !important;
          padding: 0 16px !important;
          border-radius: 6px !important;
          font-family: 'Rajdhani', sans-serif !important;
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          transition: all 0.2s !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .content-area button[onclick="window.openManualOvertimeModal()"].btn-cyber:hover {
          background: rgba(0, 242, 254, 0.15) !important;
          border-color: rgba(0, 242, 254, 0.5) !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(0, 242, 254, 0.1) !important;
        }
      </style>
      
      <!-- Top Title and Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0;">
            <i class="fa-solid fa-file-signature" style="color: var(--accent-cyan);"></i> Mesai & Sodexo Onayları
          </h1>
          <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">
            Teknisyenlerin saatlerini denetleyin, fazla mesai, yemek ve dış görev harcırahlarını onaylayın.
          </p>
        </div>
        <div style="display: flex; gap: 0.75rem;">
          ${!isLeader ? `
            <button onclick="window.openManualOvertimeModal()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-plus"></i> MANUEL MESAI EKLE
            </button>
          ` : ''}
          <button onclick="window.exportOfficeOvertimeExcel()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-paper-plane"></i> OFİSE GÖNDER
          </button>
          <button onclick="window.exportOvertimeExcel()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-excel"></i> EXCEL OLARAK DIŞA AKTAR
          </button>
        </div>
      </div>


      <!-- Filters & Summaries Panel -->
      <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Filter Controls Row -->
        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; width: 100%;">
          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 180px; min-width: 140px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">ŞİRKET</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeCompany(this.value)">
              <option value="all" ${selectedCompany === 'all' ? 'selected' : ''}>Tüm Şirketler</option>
              ${companySelectOptions}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 180px; min-width: 140px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">BÖLGE</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeRegion(this.value)" ${isLeader ? 'disabled' : ''}>
              <option value="all" ${selectedRegion === 'all' ? 'selected' : ''}>Tüm Bölgeler</option>
              <option value="1" ${selectedRegion === '1' ? 'selected' : ''}>1. Bölge (Anemon, Sarıkaya, Çamseki)</option>
              <option value="2" ${selectedRegion === '2' ? 'selected' : ''}>2. Bölge (Sayalar, Kuyucak)</option>
              <option value="3" ${selectedRegion === '3' ? 'selected' : ''}>3. Bölge (Keltepe, Çataltepe)</option>
              <option value="4" ${selectedRegion === '4' ? 'selected' : ''}>4. Bölge (Mare, Germiyan)</option>
              <option value="5" ${selectedRegion === '5' ? 'selected' : ''}>5. Bölge (Dares, Datça)</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 200px; min-width: 150px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">HAK EDİŞ AYI</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeMonth(this.value)">
              ${monthOptions.map(m => {
                const [year, month] = m.split('-');
                const turkishMonthShort = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
                const yNum = parseInt(year);
                const mNum = parseInt(month);
                let nextY = yNum;
                let nextM = mNum + 1;
                if (nextM === 13) {
                  nextM = 1;
                  nextY = yNum + 1;
                }
                const startMonthLabel = turkishMonthShort[mNum - 1];
                const endMonthLabel = turkishMonthShort[nextM - 1];
                const label = `${startMonthLabel} - ${endMonthLabel} (15.${String(mNum).padStart(2, '0')} - 14.${String(nextM).padStart(2, '0')}.${nextY})`;
                return `<option value="${m}" ${selectedMonth === m ? 'selected' : ''}>${label}</option>`;
              }).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 180px; min-width: 140px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">PERSONEL</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimePersonnel(this.value)">
              <option value="all" ${selectedPersonnel === 'all' ? 'selected' : ''}>Tüm Personeller</option>
              ${personnelNames.map(name => `<option value="${name}" ${selectedPersonnel === name ? 'selected' : ''}>${name}</option>`).join('')}
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 180px; min-width: 140px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">ONAY DURUMU</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeStatus(this.value)">
              <option value="all" ${selectedStatus === 'all' ? 'selected' : ''}>Tümü</option>
              <option value="pending" ${selectedStatus === 'pending' ? 'selected' : ''}>Onay Bekleyenler</option>
              <option value="approved" ${selectedStatus === 'approved' ? 'selected' : ''}>Onaylananlar</option>
              <option value="rejected" ${selectedStatus === 'rejected' ? 'selected' : ''}>Reddedilenler</option>
              <option value="deleted" ${selectedStatus === 'deleted' ? 'selected' : ''}>Silinenler</option>
            </select>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1 1 180px; min-width: 140px;">
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">SIRALAMA</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeSort(this.value)">
              <option value="date-desc" ${selectedSort === 'date-desc' ? 'selected' : ''}>Tarih (Yeniden Eskiye)</option>
              <option value="date-asc" ${selectedSort === 'date-asc' ? 'selected' : ''}>Tarih (Eskiden Yeniye)</option>
              <option value="name-asc" ${selectedSort === 'name-asc' ? 'selected' : ''}>Personel Adı (A'dan Z'ye)</option>
              <option value="name-desc" ${selectedSort === 'name-desc' ? 'selected' : ''}>Personel Adı (Z'den A'ye)</option>
            </select>
          </div>
        </div>

        <!-- Monthly Totals Cards Group -->
        <div>
          <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.8rem; color: var(--accent-cyan); letter-spacing: 1px; margin-bottom: 0.75rem; text-transform: uppercase;">
            Aylık Toplam Hak Edişler (Onaylananlar)
          </div>
          <div id="overtime-summary-cards" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 1rem;">
            <!-- Rendered dynamically -->
            <div style="text-align: center; color: var(--text-muted); font-size: 0.8rem; padding: 1rem;"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</div>
          </div>
        </div>

      </div>

      <!-- Main Queue Table Container -->
      <div class="glass-panel" style="border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead>
            <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.8rem; color: var(--accent-cyan); letter-spacing: 1px; text-transform: uppercase;">
              <th style="padding: 1rem 0.75rem;">PERSONEL & SAHA</th>
              <th style="padding: 1rem 0.75rem;">TARİH & RAPOR</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">SAAT ARALIĞI</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">ÖNERİLEN FAZLA MESAI</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">ONAYLANAN MESAI</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">YEMEK (SODEXO)</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">HARCIRAH (DIŞ GÖREV)</th>
              <th style="padding: 1rem 0.75rem; text-align: center;">DURUM</th>
              <th style="padding: 1rem 0.75rem; text-align: right;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="overtime-queue-container">
            <!-- Rendered dynamically -->
            <tr>
              <td colspan="9" style="text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem;">
                <i class="fa-solid fa-spinner fa-spin fa-2x" style="margin-bottom: 1rem; color: var(--accent-cyan);"></i><br>
                Kayıtlar yükleniyor...
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Layout Version Badge -->
      <div style="text-align: center; font-size: 0.7rem; color: var(--text-muted); opacity: 0.4; margin-top: 1rem; font-family: monospace;">
        BUILD V1.1.7-USERRESET - RESPONSIVE LAYOUT ACTIVE
      </div>

      <!-- Manual Overtime Modal -->
      <div id="manual-overtime-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.85); backdrop-filter: blur(12px); z-index: 999999; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="width: 100%; max-width: 480px; padding: 2rem; border: 1px solid rgba(0, 242, 254, 0.15); border-radius: 12px; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5); margin: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <h3 style="margin: 0; color: #fff; font-size: 1.25rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-plus" style="color: var(--accent-cyan);"></i> Manuel Mesai Ekle
            </h3>
            <button onclick="window.closeManualOvertimeModal()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; transition: color 0.2s;"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Personnel Selector -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">PERSONEL</label>
              <select id="man-personnel" class="cyber-input" style="height: 38px; width: 100%;">
                ${personnelListOptions}
              </select>
            </div>

            <!-- Auto-populated Personnel Info Badge -->
            <div id="man-personnel-info-badge" style="font-size: 0.75rem; color: #00F2FE; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2); padding: 6px 10px; border-radius: 6px; display: none;"></div>

            <!-- Site Selector -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">SAHA / BÖLGE *</label>
              <select id="man-site" class="cyber-input" style="height: 38px; width: 100%;">
                <option value="Anemon İntepe">Anemon İntepe</option>
                <option value="Alize Sarıkaya">Alize Sarıkaya</option>
                <option value="Alize Kuyucak">Alize Kuyucak</option>
                <option value="Alize Çamseki">Alize Çamseki</option>
                <option value="Alize Keltepe">Alize Keltepe</option>
                <option value="Alize Çataltepe">Alize Çataltepe</option>
                <option value="Alize Germiyan">Alize Germiyan</option>
                <option value="Mare Manastır">Mare Manastır</option>
                <option value="Doğal Sayalar">Doğal Sayalar</option>
                <option value="Dares Datça">Dares Datça</option>
              </select>
            </div>

            <!-- Date and Hours Row -->
            <div style="display: flex; gap: 1rem;">
              <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1;">
                <label class="input-label" style="margin: 0; font-size: 0.75rem;">TARİH</label>
                <input type="date" id="man-date" class="cyber-input" style="height: 38px; width: 100%; color: #fff;">
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.35rem; flex: 1;">
                <label class="input-label" style="margin: 0; font-size: 0.75rem;">MESAI SAATİ</label>
                <input type="number" id="man-hours" class="cyber-input" style="height: 38px; width: 100%; text-align: center;" step="0.5" min="0.5" value="4.0">
              </div>
            </div>

            <!-- Checkboxes for Sodexo & Harcirah -->
            <div style="display: flex; gap: 2rem; margin-top: 0.25rem;">
              <label style="display: flex; align-items: center; gap: 8px; color: #fff; cursor: pointer; font-size: 0.85rem;">
                <input type="checkbox" id="man-sodexo" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-orange);">
                Yemek (Sodexo)
              </label>
              <label style="display: flex; align-items: center; gap: 8px; color: #fff; cursor: pointer; font-size: 0.85rem;">
                <input type="checkbox" id="man-harcirah" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);">
                Dış Görev Harcırahı
              </label>
            </div>

            <!-- Description -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">AÇIKLAMA / NOT</label>
              <input type="text" id="man-note" class="cyber-input" placeholder="Örn: Bayram Nöbeti" style="height: 38px; width: 100%;">
            </div>
          </div>

          <!-- Buttons -->
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem;">
            <button onclick="window.closeManualOvertimeModal()" class="btn-cyber" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-muted);">İptal</button>
            <button onclick="window.saveManualOvertime()" class="btn-cyber" style="border-color: var(--accent-cyan); background: rgba(0, 242, 254, 0.1);">Kaydet</button>
          </div>

        </div>
      </div>

    </div>
  `;
};
