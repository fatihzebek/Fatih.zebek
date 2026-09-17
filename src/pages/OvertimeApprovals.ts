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

export const HOLIDAY_NAMES_2026: Record<string, string> = {
  '2026-01-01': 'Yılbaşı',
  '2026-03-19': 'Ramazan Bayramı Arifesi',
  '2026-03-20': 'Ramazan Bayramı 1. Gün',
  '2026-03-21': 'Ramazan Bayramı 2. Gün',
  '2026-03-22': 'Ramazan Bayramı 3. Gün',
  '2026-04-23': 'Ulusal Egemenlik ve Çocuk Bayramı',
  '2026-05-01': 'Emek ve Dayanışma Günü',
  '2026-05-19': 'Atatürk\'ü Anma, Gençlik ve Spor Bayramı',
  '2026-05-26': 'Kurban Bayramı Arifesi',
  '2026-05-27': 'Kurban Bayramı 1. Gün',
  '2026-05-28': 'Kurban Bayramı 2. Gün',
  '2026-05-29': 'Kurban Bayramı 3. Gün',
  '2026-05-30': 'Kurban Bayramı 4. Gün',
  '2026-07-15': 'Demokrasi ve Milli Birlik Günü',
  '2026-08-30': 'Zafer Bayramı',
  '2026-10-28': 'Cumhuriyet Bayramı Arifesi',
  '2026-10-29': 'Cumhuriyet Bayramı'
};

function normalizeTurkish(s: string): string {
  return (s || '')
    .toLocaleLowerCase('tr-TR')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/\s+/g, '');
}

export const isExemptOfficeStaff = (name: string): boolean => {
  if (!name) return false;
  const n = normalizeTurkish(name);
  return (
    n.includes('fatihzebek') ||
    n.includes('furkanyildirim') ||
    n.includes('sercanyetkin') ||
    n.includes('sercanyetgin') ||
    n.includes('necatozturk')
  );
};

export const OvertimeApprovalsPage = async () => {
  const w = window as any;
  
  const currentUser = w.currentUser || w.appState?.userProfile;
  const isLeader = currentUser?.role !== 'ADMIN' && currentUser?.managedTeams && currentUser.managedTeams.length > 0;
  const isAdmin = currentUser?.role === 'ADMIN';

  let activeTab = w.overtimeActiveTab || 'general'; // 'general' | 'holiday-oncall'
  w.overtimeActiveTab = activeTab;

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
    w.overtimeSelectedSodexo = 'all';
    w._lastOvertimeUserId = currentUser?.uid;
  }

  let selectedMonth = w.overtimeSelectedMonth || defaultMonth;
  let selectedStatus = w.overtimeSelectedStatus || 'all'; // all, pending, approved, rejected, deleted
  let selectedCompany = w.overtimeSelectedCompany || 'all'; // all, Demirer Enerji, Har Film Yapım, YEK, Demirer Holding
  let selectedSort = w.overtimeSelectedSort || 'date-desc'; // date-desc, date-asc, name-asc, name-desc
  let selectedPersonnel = w.overtimeSelectedPersonnel || 'all'; // all or specific name
  let selectedSodexo = w.overtimeSelectedSodexo || 'all'; // all, sodexo-only
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
  w.overtimeSelectedSodexo = selectedSodexo;

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
    if (w.closeOvertimeReportPreview) {
      w.closeOvertimeReportPreview();
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

  w.changeOvertimeSodexo = (val: string) => {
    w.overtimeSelectedSodexo = val;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.switchOvertimeTab = (tab: string) => {
    w.overtimeActiveTab = tab;
    cleanup();
    w.navigate('overtime-approvals');
  };

  w.selectHolidayAuditDate = (val: string) => {
    w._selectedHolidayAuditDate = val;
    w.renderOvertimeApprovalsList();
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

  w.openHolidayOncallModal = (prefillDate?: string, prefillName?: string, prefillSite?: string) => {
    const modal = document.getElementById('holiday-oncall-modal');
    if (!modal) return;

    // Populate holiday dates dropdown for the selectedMonth
    const dateSelect = document.getElementById('nobet-date') as HTMLSelectElement;
    const customDateContainer = document.getElementById('nobet-custom-date-container');
    const customDateInput = document.getElementById('nobet-custom-date') as HTMLInputElement;

    if (dateSelect) {
      const holidaysInPeriod = Object.keys(HOLIDAY_NAMES_2026).filter(d => getSessionPayrollPeriod(d) === selectedMonth);
      let optionsHtml = '';
      if (holidaysInPeriod.length > 0) {
        optionsHtml = holidaysInPeriod.map(d => {
          const [y, m, day] = d.split('-');
          return `<option value="${d}">${day}.${m}.${y} - ${HOLIDAY_NAMES_2026[d]}</option>`;
        }).join('');
      } else {
        optionsHtml = Object.keys(HOLIDAY_NAMES_2026).map(d => {
          const [y, m, day] = d.split('-');
          return `<option value="${d}">${day}.${m}.${y} - ${HOLIDAY_NAMES_2026[d]}</option>`;
        }).join('');
      }
      optionsHtml += `<option value="custom">📅 Farklı Bir Tarih Seç...</option>`;
      dateSelect.innerHTML = optionsHtml;
      
      dateSelect.onchange = () => {
        if (customDateContainer) {
          customDateContainer.style.display = (dateSelect.value === 'custom') ? 'block' : 'none';
        }
      };
      if (customDateContainer) customDateContainer.style.display = 'none';

      if (prefillDate) {
        if (Array.from(dateSelect.options).some(o => o.value === prefillDate)) {
          dateSelect.value = prefillDate;
        } else {
          dateSelect.value = 'custom';
          if (customDateContainer) customDateContainer.style.display = 'block';
          if (customDateInput) customDateInput.value = prefillDate;
        }
      }
    }

    if (customDateInput && !prefillDate) {
      customDateInput.value = new Date().toISOString().split('T')[0];
    }

    const hoursInput = document.getElementById('nobet-hours') as HTMLInputElement;
    if (hoursInput) hoursInput.value = "0.0";
    const hoursContainer = document.getElementById('nobet-hours-container');
    if (hoursContainer) hoursContainer.style.display = "none";

    const typeSelect = document.getElementById('nobet-type') as HTMLSelectElement;
    if (typeSelect) {
      typeSelect.value = "evde";
      typeSelect.onchange = () => {
        if (hoursContainer) {
          hoursContainer.style.display = (typeSelect.value === 'sahada') ? 'flex' : 'none';
        }
        if (hoursInput && typeSelect.value === 'evde') {
          hoursInput.value = "0.0";
        } else if (hoursInput && typeSelect.value === 'sahada' && parseFloat(hoursInput.value) === 0) {
          hoursInput.value = "4.0";
        }
      };
    }

    const sodexoInput = document.getElementById('nobet-sodexo') as HTMLInputElement;
    if (sodexoInput) sodexoInput.checked = true;

    const noteInput = document.getElementById('nobet-note') as HTMLInputElement;
    if (noteInput) noteInput.value = "Resmi Tatil Nöbeti";

    const personnelSelect = document.getElementById('nobet-personnel') as HTMLSelectElement;
    if (personnelSelect && !personnelSelect.hasAttribute('data-bound-sync')) {
      personnelSelect.setAttribute('data-bound-sync', 'true');
      personnelSelect.addEventListener('change', () => {
        const siteSelect = document.getElementById('nobet-site') as HTMLSelectElement;
        const selectedName = personnelSelect.value;
        if (!selectedName || !siteSelect) return;
        const details = personnelService.getPersonnelDetailsList();
        const pDetail = details.find((p: any) => p.name === selectedName);
        if (pDetail && pDetail.baseSites && pDetail.baseSites.length > 0) {
          const matchedSite = SITE_ID_MAP[pDetail.baseSites[0]] || '';
          if (matchedSite && Array.from(siteSelect.options).some(opt => opt.value === matchedSite)) {
            siteSelect.value = matchedSite;
          }
        }
      });
    }

    if (prefillName && personnelSelect) {
      personnelSelect.value = prefillName;
    }

    const siteSelect = document.getElementById('nobet-site') as HTMLSelectElement;
    if (prefillSite && siteSelect) {
      if (Array.from(siteSelect.options).some(opt => opt.value === prefillSite)) {
        siteSelect.value = prefillSite;
      }
    } else if (personnelSelect && personnelSelect.value) {
      const details = personnelService.getPersonnelDetailsList();
      const pDetail = details.find((p: any) => p.name === personnelSelect.value);
      if (pDetail && pDetail.baseSites && pDetail.baseSites.length > 0 && siteSelect) {
        const matchedSite = SITE_ID_MAP[pDetail.baseSites[0]] || '';
        if (matchedSite && Array.from(siteSelect.options).some(opt => opt.value === matchedSite)) {
          siteSelect.value = matchedSite;
        }
      }
    }

    modal.style.display = 'flex';
  };

  w.closeHolidayOncallModal = () => {
    const modal = document.getElementById('holiday-oncall-modal');
    if (modal) modal.style.display = 'none';
  };

  w.saveHolidayOncall = async () => {
    const personnelName = (document.getElementById('nobet-personnel') as HTMLSelectElement).value;
    const siteName = (document.getElementById('nobet-site') as HTMLSelectElement).value;
    const dateSelect = document.getElementById('nobet-date') as HTMLSelectElement;
    let chosenDate = dateSelect.value;
    if (chosenDate === 'custom') {
      chosenDate = (document.getElementById('nobet-custom-date') as HTMLInputElement).value;
    }
    const typeSelect = (document.getElementById('nobet-type') as HTMLSelectElement).value;
    const hours = typeSelect === 'sahada' ? (parseFloat((document.getElementById('nobet-hours') as HTMLInputElement).value) || 0) : 0;
    const sodexo = (document.getElementById('nobet-sodexo') as HTMLInputElement).checked;
    const note = (document.getElementById('nobet-note') as HTMLInputElement).value.trim() || 'Resmi Tatil Nöbeti';

    if (!personnelName || !chosenDate) {
      alert("Lütfen personel ve tarih alanlarını doldurun.");
      return;
    }

    try {
      const reportId = `nobet_${Date.now()}`;
      const sessionId = `session_${Date.now()}`;

      const details = personnelService.getPersonnelDetailsList();
      const pDetail = details.find((p: any) => p.name === personnelName);
      const company = pDetail?.company || '';
      const siteId = pDetail?.baseSites?.[0] || Object.keys(SITE_ID_MAP).find(k => SITE_ID_MAP[k] === siteName) || '';

      const docData = {
        id: reportId,
        reportNo: `NOB-${chosenDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`,
        type: 'RESMI_TATIL_NOBET',
        date: chosenDate,
        siteName: siteName,
        siteId: siteId,
        company: company,
        personnel: [personnelName],
        workSessions: [
          {
            id: sessionId,
            date: chosenDate,
            startTime: '09:00',
            endTime: hours > 0 ? decimalToTimeStr(9 + hours) : '09:00',
            duration: decimalToTimeStr(hours),
            personnel: [personnelName],
            type: 'NÖBET',
            isOffDay: true,
            note: note
          }
        ],
        overtimeApprovals: {
          [sessionId]: {
            [personnelName]: {
              status: 'approved',
              approvedHours: hours,
              sodexo: sodexo,
              harcirah: false,
              approvedBy: (window as any).currentUser?.email || 'admin@demirerholding.com',
              approvedAt: new Date().toISOString()
            }
          }
        },
        createdAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'serviceReports', reportId), docData);
      w.closeHolidayOncallModal();
      if (w.showToast) w.showToast('Başarılı', 'Resmi tatil nöbet kaydı oluşturuldu ve onaylandı.', 'success');
    } catch (err: any) {
      console.error("Nöbet kaydetme hatası:", err);
      alert("Hata oluştu: " + err.message);
    }
  };

  w.quickSetHolidaySodexo = async (reportId: string, personnelName: string, date: string, sodexoVal: boolean) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    const workSessions = report.workSessions || [];
    const normTarget = normalizeTurkish(personnelName);

    workSessions.forEach((s: any, idx: number) => {
      const sDate = s.date || report.date;
      if (date && sDate && sDate !== date) return;

      const pList = s.personnel || [];
      const matchedP = pList.find((p: string) => normalizeTurkish(p) === normTarget);
      if (!matchedP) return;

      if (!currentApprovals[s.id]) currentApprovals[s.id] = {};

      const sessionKeys = Object.keys(currentApprovals[s.id]);
      const existingKey = sessionKeys.find(k => normalizeTurkish(k) === normTarget) || matchedP || personnelName;
      const existingApp = currentApprovals[s.id][existingKey] || {};

      const sHours = DateTimeUtils.calculateOvertimeHours(
        s.date || date,
        s.startTime,
        s.endTime,
        s.isOffDay || false
      );
      const appHours = existingApp.approvedHours !== undefined ? existingApp.approvedHours : parseFloat(sHours.toFixed(2));

      const updatedRecord = {
        status: existingApp.status || 'approved',
        approvedHours: appHours,
        sodexo: idx === 0 ? sodexoVal : false,
        harcirah: existingApp.harcirah !== undefined ? existingApp.harcirah : false,
        approvedBy: w.currentUser?.email || 'Admin',
        approvedAt: new Date().toISOString()
      };

      currentApprovals[s.id][existingKey] = updatedRecord;
      if (personnelName !== existingKey) {
        currentApprovals[s.id][personnelName] = updatedRecord;
      }
      if (matchedP && matchedP !== existingKey && matchedP !== personnelName) {
        currentApprovals[s.id][matchedP] = updatedRecord;
      }
    });

    try {
      if (w.showToast) w.showToast('Bilgi', sodexoVal ? 'Sodexo tanımlanıyor...' : 'Sodexo geri alınıyor...', 'info');
      await updateDoc(doc(db, 'serviceReports', reportId), {
        overtimeApprovals: currentApprovals
      });
      if (w.showToast) w.showToast('Başarılı', sodexoVal ? 'Sodexo onaylandı' : 'Sodexo geri alındı', 'success');
    } catch (err: any) {
      console.error(err);
      if (w.showToast) w.showToast('Hata', 'İşlem başarısız: ' + err.message, 'error');
    }
  };

  w.deleteSessionOvertime = async (reportId: string, personnelName: string, date?: string) => {
    if (!confirm(`${personnelName} için bu mesai kaydını listeden kaldırmak istediğinize emin misiniz?`)) return;

    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName && (!date || r.date === date));
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

  w.restoreSessionOvertime = async (reportId: string, personnelName: string, date?: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName && (!date || r.date === date));
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

  w.approveSessionOvertime = async (reportId: string, personnelName: string, date?: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName && (!date || r.date === date));
    if (!row) return;

    const keyName = personnelName.replace(/\s+/g, '_');
    const dateKey = (row.date || '').replace(/[^0-9]/g, '');
    const hoursInput = (document.getElementById(`hours-${reportId}-${keyName}-${dateKey}`) || document.getElementById(`hours-${reportId}-${keyName}`)) as HTMLInputElement;
    const sodexoInput = (document.getElementById(`sodexo-${reportId}-${keyName}-${dateKey}`) || document.getElementById(`sodexo-${reportId}-${keyName}`)) as HTMLInputElement;
    const harcirahInput = (document.getElementById(`harcirah-${reportId}-${keyName}-${dateKey}`) || document.getElementById(`harcirah-${reportId}-${keyName}`)) as HTMLInputElement;
    
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

  w.rejectSessionOvertime = async (reportId: string, personnelName: string, date?: string) => {
    if (!confirm(`${personnelName} için mesaiyi reddetmek istediğinize emin misiniz?`)) return;

    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName && (!date || r.date === date));
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

  w.editApprovedOvertime = async (reportId: string, personnelName: string, date?: string) => {
    const report = reports.find((r: any) => r.id === reportId);
    if (!report) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === personnelName && (!date || r.date === date));
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

  w._overtimeExpandedReports = w._overtimeExpandedReports || new Set<string>();

  w.toggleOvertimeReport = (repKey: string) => {
    if (!w._overtimeExpandedReports) w._overtimeExpandedReports = new Set();
    const rows = document.querySelectorAll(`.rep-child-${repKey}`);
    const chevron = document.getElementById(`rep-chevron-${repKey}`);
    const label = document.getElementById(`rep-label-${repKey}`);
    
    let nowExpanded = false;
    if (w._overtimeExpandedReports.has(repKey)) {
      w._overtimeExpandedReports.delete(repKey);
      nowExpanded = false;
    } else {
      w._overtimeExpandedReports.add(repKey);
      nowExpanded = true;
    }

    rows.forEach((r: any) => {
      r.style.display = nowExpanded ? '' : 'none';
    });

    if (chevron) {
      chevron.style.transform = nowExpanded ? 'rotate(90deg)' : 'rotate(0deg)';
    }
    if (label) {
      label.innerHTML = nowExpanded ? '▲ Kapat' : '▼ Aç';
    }
  };

  w.expandAllOvertimeReports = () => {
    if (!w._overtimeExpandedReports) w._overtimeExpandedReports = new Set();
    document.querySelectorAll('[data-rep-key]').forEach((el: any) => {
      const k = el.getAttribute('data-rep-key');
      if (k) w._overtimeExpandedReports.add(k);
    });
    document.querySelectorAll('.overtime-collapsible-child').forEach((r: any) => {
      r.style.display = '';
    });
    document.querySelectorAll('.rep-chevron-icon').forEach((icon: any) => {
      icon.style.transform = 'rotate(90deg)';
    });
    document.querySelectorAll('.rep-toggle-label').forEach((label: any) => {
      label.innerHTML = '▲ Kapat';
    });
  };

  w.collapseAllOvertimeReports = () => {
    if (!w._overtimeExpandedReports) w._overtimeExpandedReports = new Set();
    w._overtimeExpandedReports.clear();
    document.querySelectorAll('.overtime-collapsible-child').forEach((r: any) => {
      r.style.display = 'none';
    });
    document.querySelectorAll('.rep-chevron-icon').forEach((icon: any) => {
      icon.style.transform = 'rotate(0deg)';
    });
    document.querySelectorAll('.rep-toggle-label').forEach((label: any) => {
      label.innerHTML = '▼ Aç';
    });
  };

  w.toggleOvertimeDay = (dayKey: string) => {
    const rows = document.querySelectorAll(`.day-child-${dayKey}`);
    const chevron = document.getElementById(`day-chevron-${dayKey}`);
    if (rows.length === 0) return;
    const isHidden = (rows[0] as HTMLElement).style.display === 'none';
    rows.forEach((r: any) => {
      r.style.display = isHidden ? '' : 'none';
    });
    if (chevron) {
      chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(-90deg)';
    }
  };

  w.closeOvertimeReportPreview = () => {
    const modal = document.getElementById('overtime-report-modal');
    if (modal) {
      modal.style.display = 'none';
      document.body.style.overflow = '';
    }
  };

  w.previewOvertimeReport = async (reportNo: string, reportId?: string, event?: Event) => {
    if (event) event.stopPropagation();
    const modal = document.getElementById('overtime-report-modal');
    const modalContent = document.getElementById('overtime-report-modal-content');
    const previewNoEl = document.getElementById('overtime-preview-report-no');
    const previewBadgeEl = document.getElementById('overtime-preview-badge');

    if (modal) {
      // Ensure modal is directly attached to document.body to avoid parent container transform/scroll offsets
      if (modal.parentElement !== document.body) {
        document.body.appendChild(modal);
      }
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden';

      // ESC key listener to close modal
      const onEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          w.closeOvertimeReportPreview();
          window.removeEventListener('keydown', onEsc);
        }
      };
      window.addEventListener('keydown', onEsc);
    }
    if (modalContent) {
      modalContent.innerHTML = `
        <div style="text-align: center; padding: 4rem; color: var(--accent-cyan); font-size: 1rem;">
          <i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>
          Rapor detayları yükleniyor...
        </div>
      `;
    }
    if (previewNoEl) previewNoEl.innerText = reportNo || reportId || 'Rapor Detayı';
    if (previewBadgeEl) previewBadgeEl.innerText = 'YÜKLENİYOR...';

    try {
      let report = reports.find(r => (reportNo && r.reportNo === reportNo) || (reportId && r.id === reportId));
      if (!report) {
        if (reportNo) {
          const { serviceReportService } = await import('../services/ServiceReportService');
          report = await serviceReportService.getReportByNo(reportNo);
        } else if (reportId) {
          const { getDoc, doc } = await import('firebase/firestore');
          const snap = await getDoc(doc(db, 'serviceReports', reportId));
          if (snap.exists()) {
            report = { id: snap.id, ...snap.data() };
          }
        }
      }

      if (!report) {
        if (modalContent) {
          modalContent.innerHTML = `
            <div style="text-align: center; padding: 3rem; color: var(--accent-red);">
              <i class="fa-solid fa-circle-exclamation fa-2x"></i><br><br>
              Rapor detayları bulunamadı.
            </div>
          `;
        }
        return;
      }

      if (previewNoEl) previewNoEl.innerText = `${report.reportNo || report.id} - ${report.siteName || ''} (${report.turbineNo || ''})`;
      if (previewBadgeEl) previewBadgeEl.innerText = report.type === 'BAKIM' ? 'BAKIM RAPORU' : (report.faultCode || 'ARIZA FORMU');

      const { renderReportPDF } = await import('../components/ReportTemplate');
      const htmlContent = renderReportPDF(report);

      if (modalContent) {
        modalContent.innerHTML = htmlContent;
      }
    } catch (err: any) {
      console.error('Report preview error:', err);
      if (modalContent) {
        modalContent.innerHTML = `
          <div style="text-align: center; padding: 3rem; color: var(--accent-red);">
            <i class="fa-solid fa-triangle-exclamation fa-2x"></i><br><br>
            Rapor görüntülenirken bir hata oluştu: ${err.message}
          </div>
        `;
      }
    }
  };

  const calculateKumbaraDiffMinutes = (suggestedHours: number, approvedHours: number, isManualOrOffDay: boolean = false): number => {
    // 1. Manuel mesai veya izin günü girişleri personele asla borç yazılamaz
    if (isManualOrOffDay && approvedHours >= suggestedHours) {
      return 0;
    }

    // 2. Sistem önerisi 0 veya negatif olan (gündüz mesaisi, amir takdiri vb.) durumlarda borç yazılamaz
    if (suggestedHours <= 0) {
      return 0;
    }

    const diffMinutes = Math.round((suggestedHours - approvedHours) * 60);

    // 3. Yalnızca amirin tam saate yuvarladığı küçük dakika küsuratları (45 dk altı) takip edilir.
    // 45 dk ve üzeri farklar (örn: 60 dk, 270 dk, 600 dk) yuvarlama küsuratı değil,
    // kasıtlı bir saat girişi/kesintisidir ve kumbaraya dahil edilmez.
    if (Math.abs(diffMinutes) >= 45) {
      return 0;
    }

    return diffMinutes;
  };

  w.previewRowKumbara = (reportId: string, rawName: string, date: string, val: string) => {
    const keyName = rawName.replace(/\s+/g, '_');
    const dateKey = (date || '').replace(/[^0-9]/g, '');
    const previewEl = document.getElementById(`kumbara-${reportId}-${keyName}-${dateKey}`);
    if (!previewEl) return;

    const groupedRows = w.getFilteredOvertimeRows(false);
    const row = groupedRows.find((r: any) => r.reportId === reportId && r.rawName === rawName && (!date || r.date === date));
    if (!row) return;

    const currentBalance = w.getPersonnelPastBalance(row.personnel, selectedMonth);
    let baseBalance = currentBalance;
    const isManualOrOffDay = (row.sessions && row.sessions.some((s: any) => s.isOffDay)) || 
                             (row.reportNo && row.reportNo.startsWith('MAN-')) || 
                             DateTimeUtils.isPublicHoliday(row.date);

    if (row.status === 'approved') {
      const alreadyApprovedDiff = calculateKumbaraDiffMinutes(row.suggestedHours, row.approvedHours, isManualOrOffDay);
      baseBalance -= alreadyApprovedDiff;
    }

    const typedHours = timeStrToDecimal(val);
    const pendingDiff = calculateKumbaraDiffMinutes(row.suggestedHours, typedHours, isManualOrOffDay);
    const projectedBalance = baseBalance + pendingDiff;

    if (projectedBalance > 0) {
      previewEl.style.color = 'var(--accent-cyan)';
      previewEl.innerHTML = `Kumbara: +${projectedBalance} dk <span style="font-size: 0.6rem; opacity: 0.85;">(Alacaklı)</span>`;
    } else if (projectedBalance < 0) {
      previewEl.style.color = 'var(--accent-orange)';
      previewEl.innerHTML = `Kumbara: ${projectedBalance} dk <span style="font-size: 0.6rem; opacity: 0.85;">(Borçlu)</span>`;
    } else {
      previewEl.style.color = 'var(--accent-green)';
      previewEl.innerHTML = `Kumbara: 0 dk <span style="font-size: 0.6rem; opacity: 0.85;">(Dengeleniyor)</span>`;
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

  w.exportSodexoExcel = () => {
    try {
      // Get all approved rows for the selected month that have sodexo = true
      const allRows = w.getFilteredOvertimeRows(true);
      const sodexoApprovedRows = allRows.filter((r: any) => r.status === 'approved' && r.sodexo);

      if (sodexoApprovedRows.length === 0) {
        alert('Seçilen ay için onaylanmış Sodexo hak ediş kaydı bulunamadı.');
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
      const finalFileName = `Sodexo Hak Ediş Bildirimi ${periodTitle}${companyPart}`;

      // Collect holiday dates in period for the audit sheet
      const holidayDateSet = new Set<string>();
      Object.keys(HOLIDAY_NAMES_2026).forEach(d => {
        if (getSessionPayrollPeriod(d) === selectedMonth) holidayDateSet.add(d);
      });
      allRows.forEach((r: any) => {
        if (r.type === 'RESMI_TATIL_NOBET' || (r.reportNo && r.reportNo.startsWith('NOB-')) || (r.date && DateTimeUtils.isPublicHoliday(r.date))) {
          if (r.date && getSessionPayrollPeriod(r.date) === selectedMonth) {
            holidayDateSet.add(r.date);
          }
        }
      });
      const sortedHolidays = Array.from(holidayDateSet).sort();
      const allPersonnelDetails = personnelService.getPersonnelDetailsList();

      excelService.exportSodexoToExcel(sodexoApprovedRows, finalFileName, periodTitle, {
        holidays: sortedHolidays,
        allPersonnel: allPersonnelDetails,
        allRows: allRows
      });
      if (w.showToast) w.showToast('Başarılı', 'Sodexo Excel raporu (Nöbet Kontrol sayfasıyla) indirildi.', 'success');
    } catch (err: any) {
      console.error("Sodexo Excel Export Error:", err);
      alert("Sodexo Excel dışa aktarılırken bir hata oluştu: " + err.message);
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

  const TRACKING_START_MONTH = '2026-06';

  w.getPersonnelPastBalance = (personName: string, targetMonth: string): number => {
    let totalDiffMinutes = 0;
    const norm = normalizeTurkish;

    reports.forEach(report => {
      const isManualReport = report.type === 'MANUEL_MESAI' || (report.reportNo && report.reportNo.startsWith('MAN-'));
      const workSessions = report.workSessions || [];

      // Group sessions for this personnel by date to evaluate daily totals like the approval table
      const dateMap = new Map<string, { sessions: any[] }>();
      workSessions.forEach((session: any) => {
        const sDate = session.date || report.date;
        if (!sDate) return;
        const sessionMonth = getSessionPayrollPeriod(sDate);
        if (sessionMonth < TRACKING_START_MONTH) return;
        if (sessionMonth > targetMonth) return;

        const personnelList = session.personnel || [];
        const hasPerson = personnelList.some((p: string) => norm(p) === norm(personName));
        if (!hasPerson) return;

        if (!dateMap.has(sDate)) {
          dateMap.set(sDate, { sessions: [] });
        }
        dateMap.get(sDate)!.sessions.push(session);
      });

      dateMap.forEach(({ sessions }, sDate) => {
        const matchedNameInSession = (s: any) => (s.personnel || []).find((p: string) => norm(p) === norm(personName)) || personName;
        
        // Check if all sessions for this person on this date are approved
        const allApproved = sessions.every((s: any) => {
          const pName = matchedNameInSession(s);
          const app = report.overtimeApprovals?.[s.id]?.[pName];
          return app && app.status === 'approved';
        });

        if (!allApproved) return;

        let dailySuggested = 0;
        let dailyApproved = 0;
        let isOffDaySession = isManualReport || DateTimeUtils.isPublicHoliday(sDate);

        sessions.forEach((s: any) => {
          const pName = matchedNameInSession(s);
          const app = report.overtimeApprovals?.[s.id]?.[pName];
          if (s.isOffDay) isOffDaySession = true;

          const sHours = DateTimeUtils.calculateOvertimeHours(
            s.date || sDate,
            s.startTime,
            s.endTime,
            s.isOffDay || false,
            pName
          );
          dailySuggested += sHours;
          dailyApproved += (app?.approvedHours !== undefined ? app.approvedHours : sHours);
        });

        totalDiffMinutes += calculateKumbaraDiffMinutes(dailySuggested, dailyApproved, isOffDaySession);
      });
    });

    return totalDiffMinutes; // returns difference in minutes
  };
  // Calculate and return the flat rows from the reports list
  w.getFilteredOvertimeRows = (allProcessed = false) => {
    const rows: any[] = [];
    const personnelDetails = personnelService.getPersonnelDetailsList();

    const norm = normalizeTurkish;

    // Pre-calculate daily total work overtime per personnel across all reports to correctly suggest Sodexo
    const dailyWorkOtMap = new Map<string, Map<string, number>>();
    const dailyMaxOtReportMap = new Map<string, Map<string, { reportId: string, maxOt: number }>>();

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
          if (isExemptOfficeStaff(pName)) return;
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
            dailyMaxOtReportMap.set(canonicalName, new Map());
          }
          const pDates = dailyWorkOtMap.get(canonicalName)!;
          const pMaxR = dailyMaxOtReportMap.get(canonicalName)!;

          pDates.set(rDate, (pDates.get(rDate) || 0) + workOt);

          const currentBest = pMaxR.get(rDate);
          if (!currentBest || workOt > currentBest.maxOt) {
            pMaxR.set(rDate, { reportId: report.id, maxOt: workOt });
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
      const personnelDateMap = new Map<string, { name: string; date: string }>();
      workSessions.forEach((session: any) => {
        const sDate = session.date || report.date;
        if (!sDate || getSessionPayrollPeriod(sDate) !== selectedMonth) return;
        const sessionTypeUpper = (session.type || '').toUpperCase();
        if (sessionTypeUpper && !['ÇALIŞMA', 'YOL', 'EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE', 'NÖBET', 'NOBET', 'RESMİ TATİL NÖBETİ'].includes(sessionTypeUpper)) return;
        
        const pList = session.personnel || [];
        pList.forEach((name: string) => {
          if (!name || !name.trim()) return;
          const key = `${norm(name)}__${sDate}`;
          if (!personnelDateMap.has(key)) {
            personnelDateMap.set(key, { name: name.trim(), date: sDate });
          }
        });
      });

      personnelDateMap.forEach(({ name, date }) => {
        // Skip exempt office personnel
        if (isExemptOfficeStaff(name)) return;

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

        // Find all sessions of this personnel in this report for THIS SPECIFIC DATE
        const sessions = workSessions.filter((session: any) => {
          const sDate = session.date || report.date;
          if (sDate !== date) return false;
          if (getSessionPayrollPeriod(sDate) !== selectedMonth) return false;
          const sessionTypeUpper = (session.type || '').toUpperCase();
          if (sessionTypeUpper && !['ÇALIŞMA', 'YOL', 'EVDEN TÜRBİNE', 'TÜRBİNDEN EVE', 'TÜRBİNDEN TÜRBİNE', 'NÖBET', 'NOBET', 'RESMİ TATİL NÖBETİ'].includes(sessionTypeUpper)) return false;
          
          const pList = session.personnel || [];
          return pList.some((pn: string) => norm(pn) === norm(name));
        });

        if (sessions.length === 0) return;

        // Calculate aggregated suggested values for THIS SPECIFIC DATE
        let suggestedHoursSum = 0;
        let suggestedSodexo = false;
        let suggestedHarcirah = false;
        
        const baseSites = detail?.baseSites || [];
        const hasBaseSites = baseSites.length > 0 && !!report.siteId;
        const isAwayFromBase = hasBaseSites && !baseSites.includes(report.siteId);
        suggestedHarcirah = isAwayFromBase;

        sessions.forEach((session: any) => {
          const suggestedHours = DateTimeUtils.calculateOvertimeHours(
            session.date || date,
            session.startTime,
            session.endTime,
            session.isOffDay || false,
            name
          );
          suggestedHoursSum += suggestedHours;
        });

        const totalDailyWorkOt = dailyWorkOtMap.get(canonicalName)?.get(date) || 0;
        const targetSodexoReportId = dailyMaxOtReportMap.get(canonicalName)?.get(date)?.reportId;
        const isOffDayOrHoliday = date && (DateTimeUtils.isPublicHoliday(date) || (sessions && sessions.some((s: any) => s.isOffDay)));

        suggestedSodexo = (totalDailyWorkOt >= 3.0) && (report.id === targetSodexoReportId);

        // Determine status and approved values
        let approvedHoursSum = 0;
        let hasSodexoDecision = false;
        let sodexoApprovedVal = false;
        let harcirahVal = false;
        let status = 'pending';

        // Helper to safely read approval record regardless of key casing or Turkish char variations
        const getApproval = (sessionId: string) => {
          const sessionApps = report.overtimeApprovals?.[sessionId];
          if (!sessionApps) return undefined;
          if (sessionApps[name]) return sessionApps[name];
          if (sessionApps[canonicalName]) return sessionApps[canonicalName];
          const normTarget = normalizeTurkish(name);
          const matchedKey = Object.keys(sessionApps).find(k => normalizeTurkish(k) === normTarget);
          return matchedKey ? sessionApps[matchedKey] : undefined;
        };

        const statuses = sessions.map((s: any) => getApproval(s.id)?.status || 'pending');
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
          const approval = getApproval(s.id) || {};
          
          const sHours = DateTimeUtils.calculateOvertimeHours(
            s.date || date,
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

        // Normal weekday shifts with 0 overtime cannot earn Sodexo automatically
        if (!isOffDayOrHoliday && (status === 'approved' ? approvedHoursSum : suggestedHoursSum) === 0) {
          sodexoVal = false;
          // If not genuinely away from base site, do not earn Harcirah automatically with 0 overtime
          if (!isAwayFromBase && !sessions.some((s: any) => report.overtimeApprovals?.[s.id]?.[name]?.harcirah !== undefined)) {
            harcirahVal = false;
          }
        }

        // Skip shifts with no overtime (both suggested and approved = 0), no sodexo, and no harcirah (unless official holiday or nöbet report)
        const isNobetRecord = report.type === 'RESMI_TATIL_NOBET' || (report.reportNo && report.reportNo.startsWith('NOB-')) || DateTimeUtils.isPublicHoliday(date);
        const effectiveHours = status === 'approved' ? approvedHoursSum : (approvedHoursSum > 0 ? approvedHoursSum : suggestedHoursSum);
        if (effectiveHours === 0 && !sodexoVal && !harcirahVal && status !== 'deleted' && !isNobetRecord) {
          return;
        }

        const row = {
          reportId: report.id,
          reportNo: report.reportNo,
          type: report.type,
          personnel: canonicalName,
          rawName: name,
          company,
          date: date,
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
          if (selectedSodexo === 'sodexo-only' && !sodexoVal) return;

          if (selectedStatus === 'all') {
            rows.push(row);
          } else if (selectedStatus === status) {
            rows.push(row);
          }
        }
      });
    });

    // Deduplicate rows by reportNo/reportId + normalized personnel name + date to guarantee no double entries
    const normKey = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/gi, '');
    const uniqueRowsMap = new Map<string, any>();
    rows.forEach(r => {
      const rowKey = `${r.reportNo || r.reportId}_${normKey(r.personnel)}_${r.date}`;
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
    const theadEl = document.getElementById('overtime-table-head');
    if (!container) return;

    const currentActiveTab = w.overtimeActiveTab || 'general';
    const filteredRows = w.getFilteredOvertimeRows(false);

    const accordionToolbarEl = document.getElementById('overtime-accordion-toolbar');
    if (accordionToolbarEl) {
      accordionToolbarEl.style.display = (currentActiveTab === 'holiday-oncall') ? 'none' : 'flex';
    }

    const isHolidayRecord = (row: any) => {
      if (row.type === 'RESMI_TATIL_NOBET') return true;
      if ((row.reportNo || '').startsWith('NOB-')) return true;
      if (row.date && DateTimeUtils.isPublicHoliday(row.date)) return true;
      if (row.sessions && row.sessions.some((s: any) => s.isOffDay || (s.type || '').toUpperCase().includes('NÖBET') || (s.note || '').toLowerCase().includes('nöbet') || (s.note || '').toLowerCase().includes('tatil'))) return true;
      return false;
    };

    const normalizeDate = (d: string) => {
      if (!d) return '';
      const t = d.trim();
      if (t.includes('.')) {
        const p = t.split('.');
        if (p.length === 3) return `${p[2]}-${p[1].padStart(2, '0')}-${p[0].padStart(2, '0')}`;
      }
      return t;
    };

    // Update holiday tab counter badge
    const allRowsForBadge = w.getFilteredOvertimeRows(false);
    const holidayRowsForBadge = allRowsForBadge.filter(isHolidayRecord);
    const badgeTechWithSodexo = new Set<string>();
    holidayRowsForBadge.forEach((r: any) => {
      if (r.sodexo && r.status !== 'deleted') {
        badgeTechWithSodexo.add(`${normalizeTurkish(r.personnel)}_${normalizeDate(r.date)}`);
      }
    });
    const badgeMissingTechDates = new Set<string>();
    holidayRowsForBadge.forEach((r: any) => {
      if (r.status !== 'deleted') {
        const k = `${normalizeTurkish(r.personnel)}_${normalizeDate(r.date)}`;
        if (!badgeTechWithSodexo.has(k)) {
          badgeMissingTechDates.add(k);
        }
      }
    });
    const missingSodexoCount = badgeMissingTechDates.size;
    const holidayBadgeEl = document.getElementById('holiday-tab-badge');
    if (holidayBadgeEl) {
      if (missingSodexoCount > 0) {
        holidayBadgeEl.style.display = 'inline-block';
        holidayBadgeEl.style.background = 'rgba(239, 68, 68, 0.2)';
        holidayBadgeEl.style.color = '#ff4a4a';
        holidayBadgeEl.style.borderColor = 'rgba(239, 68, 68, 0.4)';
        holidayBadgeEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> ${missingSodexoCount} Eksik`;
      } else {
        holidayBadgeEl.style.display = 'none';
      }
    }

    // ==========================================
    // TAB 2: RESMİ TATİL & NÖBET TAKİBİ
    // ==========================================
    if (currentActiveTab === 'holiday-oncall') {
      // 1. Set Table Header for Holiday On-Call Mode
      if (theadEl) {
        theadEl.innerHTML = `
          <tr style="background: rgba(168, 85, 247, 0.05); border-bottom: 1px solid rgba(168, 85, 247, 0.2); font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.8rem; color: #c084fc; letter-spacing: 1px; text-transform: uppercase;">
            <th style="padding: 1rem 0.75rem;">PERSONEL & SAHA</th>
            <th style="padding: 1rem 0.75rem;">TARİH & RESMİ TATİL</th>
            <th style="padding: 1rem 0.75rem;">GÖREV TÜRÜ / AÇIKLAMA</th>
            <th style="padding: 1rem 0.75rem; text-align: center;">ÖNERİLEN MESAI</th>
            <th style="padding: 1rem 0.75rem; text-align: center;">ONAYLANAN MESAI</th>
            <th style="padding: 1rem 0.75rem; text-align: center;">YEMEK (SODEXO)</th>
            <th style="padding: 1rem 0.75rem; text-align: center;">HARCIRAH</th>
            <th style="padding: 1rem 0.75rem; text-align: center;">DURUM</th>
            <th style="padding: 1rem 0.75rem; text-align: right;">İŞLEMLER</th>
          </tr>
        `;
      }

      // 2. Summary Cards for Holiday On-Call Mode
      const holidayRows = filteredRows.filter(isHolidayRecord);
      
      const approvedSodexoPairs = new Set<string>();
      holidayRows.forEach((r: any) => {
        if (r.sodexo && r.status === 'approved') {
          approvedSodexoPairs.add(`${normalizeTurkish(r.personnel)}_${normalizeDate(r.date)}`);
        }
      });
      const approvedSodexoCount = approvedSodexoPairs.size;

      const personnelWithAnySodexoOnDate = new Set<string>();
      holidayRows.forEach((r: any) => {
        if (r.sodexo && r.status !== 'deleted') {
          personnelWithAnySodexoOnDate.add(`${normalizeTurkish(r.personnel)}_${normalizeDate(r.date)}`);
        }
      });

      const missingPersonnelDates = new Set<string>();
      holidayRows.forEach((r: any) => {
        if (r.status !== 'deleted') {
          const key = `${normalizeTurkish(r.personnel)}_${normalizeDate(r.date)}`;
          if (!personnelWithAnySodexoOnDate.has(key)) {
            missingPersonnelDates.add(key);
          }
        }
      });
      const missingHolidaySodexoCount = missingPersonnelDates.size;
      const uniqueHolidayPersonnelCount = new Set(holidayRows.map((r: any) => normalizeTurkish(r.personnel))).size;

      const holidaysInPeriod = Object.keys(HOLIDAY_NAMES_2026)
        .filter(d => getSessionPayrollPeriod(d) === selectedMonth)
        .sort();

      // Also include any holiday dates that exist in holidayRows
      holidayRows.forEach((r: any) => {
        if (r.date && !holidaysInPeriod.includes(r.date) && (r.type === 'RESMI_TATIL_NOBET' || (r.reportNo && r.reportNo.startsWith('NOB-')) || DateTimeUtils.isPublicHoliday(r.date))) {
          holidaysInPeriod.push(r.date);
        }
      });
      holidaysInPeriod.sort();

      let activeAuditDate = w._selectedHolidayAuditDate;
      if (!activeAuditDate || !holidaysInPeriod.includes(activeAuditDate)) {
        activeAuditDate = holidaysInPeriod[0] || '';
        w._selectedHolidayAuditDate = activeAuditDate;
      }

      // Region Distribution & Missed Personnel Audit Matrix
      let auditMatrixHtml = '';
      if (activeAuditDate) {
        const activeHolidayName = HOLIDAY_NAMES_2026[activeAuditDate] || (DateTimeUtils.isPublicHoliday(activeAuditDate) ? 'Resmi Tatil' : 'Tatil / Nöbet Günü');
        const [aY, aM, aD] = activeAuditDate.split('-');
        const activeDateFormatted = `${aD}.${aM}.${aY}`;

        const allPersonnelDetails = personnelService.getPersonnelDetailsList();
        const activeTechnicians = allPersonnelDetails.filter((p: any) => {
          return !isExemptOfficeStaff(p.name);
        });

        const getTechRegionId = (p: any): number => {
          const baseSites = p.baseSites || [];
          if (baseSites.some((id: string) => ['2688', '3439', '3243'].includes(id))) return 1;
          if (baseSites.some((id: string) => ['2990', '3793'].includes(id))) return 2;
          if (baseSites.some((id: string) => ['3245', '3892'].includes(id))) return 3;
          if (baseSites.some((id: string) => ['2678', '0752'].includes(id))) return 4;
          if (baseSites.some((id: string) => ['3213'].includes(id))) return 5;
          return 0;
        };

        const REGION_BOXES = [
          {
            id: 1,
            name: '1. Bölge (Anemon, Sarıkaya, Çamseki)',
            sitesText: 'Anemon İntepe, Alize Sarıkaya, Alize Çamseki',
            badgeColor: '#38bdf8',
            siteIds: ['2688', '3439', '3243'],
            defaultSite: 'Anemon İntepe'
          },
          {
            id: 2,
            name: '2. Bölge (Sayalar, Kuyucak)',
            sitesText: 'Doğal Sayalar, Alize Kuyucak',
            badgeColor: '#fb923c',
            siteIds: ['2990', '3793'],
            defaultSite: 'Doğal Sayalar'
          },
          {
            id: 3,
            name: '3. Bölge (Keltepe, Çataltepe)',
            sitesText: 'Alize Keltepe, Alize Çataltepe',
            badgeColor: '#a78bfa',
            siteIds: ['3245', '3892'],
            defaultSite: 'Alize Keltepe'
          },
          {
            id: 4,
            name: '4. Bölge (Mare, Germiyan)',
            sitesText: 'Mare Manastır, Alize Germiyan',
            badgeColor: '#4ade80',
            siteIds: ['2678', '0752'],
            defaultSite: 'Mare Manastır'
          },
          {
            id: 5,
            name: '5. Bölge (Dares, Datça)',
            sitesText: 'Dares Datça',
            badgeColor: '#f43f5e',
            siteIds: ['3213'],
            defaultSite: 'Dares Datça'
          },
          {
            id: 0,
            name: 'Diğer / Saha Atanmamış',
            sitesText: 'Genel Teknisyenler',
            badgeColor: '#94a3b8',
            siteIds: [] as string[],
            defaultSite: 'Anemon İntepe'
          }
        ];

        const allMonthRows = w.getFilteredOvertimeRows(true);
        const norm = (s: string) => (s || '').toLocaleLowerCase('tr-TR').replace(/[^a-z0-9]/gi, '');

        const regionCardsHtml = REGION_BOXES.map(reg => {
          const techInRegion = activeTechnicians.filter(p => getTechRegionId(p) === reg.id);
          if (techInRegion.length === 0 && reg.id === 0) return '';

          const evaluatedTechs = techInRegion.map(p => {
            const regionSiteId = (p.baseSites || []).find((id: string) => reg.siteIds.includes(id));
            const matchedSiteName = regionSiteId 
              ? (SITE_ID_MAP[regionSiteId] || reg.defaultSite) 
              : ((p.baseSites && p.baseSites.length > 0 && SITE_ID_MAP[p.baseSites[0]]) ? SITE_ID_MAP[p.baseSites[0]] : reg.defaultSite);

            const pRow = allMonthRows.find((r: any) => norm(r.personnel) === norm(p.name) && r.date === activeAuditDate && r.status !== 'deleted');
            return {
              person: p,
              matchedSiteName: matchedSiteName,
              row: pRow,
              isAssigned: !!pRow
            };
          });

          evaluatedTechs.sort((a, b) => {
            if (a.isAssigned && !b.isAssigned) return -1;
            if (!a.isAssigned && b.isAssigned) return 1;
            return a.person.name.localeCompare(b.person.name, 'tr-TR');
          });

          const assignedCount = evaluatedTechs.filter(t => t.isAssigned).length;
          const totalCount = evaluatedTechs.length;

          return `
            <div class="glass-panel" style="padding: 1.1rem; border: 1px solid rgba(255,255,255,0.08); border-radius: 10px; background: rgba(15, 23, 42, 0.65); display: flex; flex-direction: column; gap: 0.85rem; box-shadow: 0 4px 16px rgba(0,0,0,0.25);">
              
              <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.65rem;">
                <div>
                  <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1rem; color: ${reg.badgeColor}; display: flex; align-items: center; gap: 6px;">
                    <i class="fa-solid fa-tower-broadcast"></i> ${reg.name}
                  </div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                    ${reg.sitesText}
                  </div>
                </div>
                <span style="font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 12px; background: ${assignedCount > 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${assignedCount > 0 ? '#10B981' : '#ef4444'}; border: 1px solid ${assignedCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}; white-space: nowrap;">
                  ${assignedCount} / ${totalCount} Nöbetçi
                </span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.45rem;">
                ${evaluatedTechs.length === 0 ? `
                  <div style="color: var(--text-muted); font-size: 0.75rem; font-style: italic; text-align: center; padding: 0.5rem 0;">
                    Kayıtlı teknisyen bulunmuyor.
                  </div>
                ` : evaluatedTechs.map(t => {
                  const p = t.person;
                  const r = t.row;
                  const safeName = p.name.replace(/'/g, "\\'");
                  const safeSite = (t.matchedSiteName || '').replace(/'/g, "\\'");

                  if (t.isAssigned) {
                    const hasSodexo = !!r.sodexo;
                    const hours = r.approvedHours || 0;
                    return `
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 9px; background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 6px;">
                        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                          <div style="font-weight: 700; color: #fff; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <i class="fa-solid fa-circle-check" style="color: #10B981; font-size: 0.75rem; flex-shrink: 0;"></i>
                            <span style="overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                          </div>
                          <div style="font-size: 0.68rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            📍 ${t.matchedSiteName || 'Saha Yok'}
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                          ${hasSodexo ? `
                            <button onclick="window.quickSetHolidaySodexo('${r.reportId}', '${safeName}', '${r.date}', false)" class="btn-cyber" style="border-color: rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.15); color: #10B981; font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; cursor: pointer; transition: all 0.2s;" title="Tıklayarak Sodexo'yu İptal Et / Geri Al">
                              <i class="fa-solid fa-utensils"></i> 1 Sodexo <i class="fa-solid fa-rotate-left" style="font-size: 0.65rem; opacity: 0.75; margin-left: 2px;"></i>
                            </button>
                          ` : `
                            <button onclick="window.quickSetHolidaySodexo('${r.reportId}', '${safeName}', '${r.date}', true)" class="btn-cyber" style="border-color: #f59e0b; background: rgba(245, 158, 11, 0.15); color: #fbbf24; font-size: 0.68rem; padding: 2px 7px; border-radius: 4px; cursor: pointer;" title="Sodexo Tanımla">
                              ⚠️ Sodexo Ekle
                            </button>
                          `}
                          <span style="font-size: 0.7rem; color: #94a3b8; font-weight: 600;">
                            ${hours > 0 ? `${hours}s` : 'Evde'}
                          </span>
                          ${((r.reportNo && r.reportNo.startsWith('NOB-')) || r.type === 'RESMI_TATIL_NOBET') ? `
                            <button onclick="window.deleteSessionOvertime('${r.reportId}', '${safeName}', '${r.date}')" class="action-icon-btn red" style="width: 22px; height: 22px; border-radius: 4px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.25); color: var(--accent-red); cursor: pointer; display: inline-flex; align-items: center; justify-content: center; font-size: 0.65rem; padding: 0;" title="Nöbet Kaydını Geri Al / Sil">
                              <i class="fa-solid fa-trash"></i>
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  } else {
                    return `
                      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 9px; background: rgba(239, 68, 68, 0.03); border: 1px dashed rgba(239, 68, 68, 0.2); border-radius: 6px;">
                        <div style="display: flex; flex-direction: column; gap: 2px; min-width: 0;">
                          <div style="font-weight: 600; color: #cbd5e1; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            <i class="fa-regular fa-circle" style="color: rgba(239, 68, 68, 0.5); font-size: 0.75rem; flex-shrink: 0;"></i>
                            <span style="overflow: hidden; text-overflow: ellipsis;">${p.name}</span>
                          </div>
                          <div style="font-size: 0.68rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                            📍 ${t.matchedSiteName || 'Saha Yok'}
                          </div>
                        </div>

                        <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
                          <span style="color: #ef4444; font-size: 0.68rem; font-weight: 600; background: rgba(239, 68, 68, 0.1); padding: 2px 6px; border-radius: 4px;">
                            Yazılmadı
                          </span>
                          ${!isLeader ? `
                            <button onclick="window.openHolidayOncallModal('${activeAuditDate}', '${safeName}', '${safeSite}')" class="btn-cyber" style="border-color: #c084fc; background: rgba(168, 85, 247, 0.2); color: #fff; font-size: 0.68rem; padding: 3px 8px; border-radius: 5px; display: inline-flex; align-items: center; gap: 4px;" title="Bu personele hızlı nöbet tanımla">
                              <i class="fa-solid fa-plus"></i> Nöbet Yaz
                            </button>
                          ` : ''}
                        </div>
                      </div>
                    `;
                  }
                }).join('')}
              </div>

            </div>
          `;
        }).filter(Boolean).join('');

        auditMatrixHtml = `
          <div class="glass-panel" style="grid-column: 1 / -1; padding: 1.25rem; border: 1px solid rgba(168, 85, 247, 0.25); border-radius: 12px; background: rgba(168, 85, 247, 0.02); display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
              <div>
                <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-users-viewfinder" style="color: #c084fc;"></i> Bölge Bazlı Nöbet Dağılımı ve Atlananlar Kontrol Paneli
                </h3>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 2px;">
                  <b>${activeDateFormatted} - ${activeHolidayName}</b> günü için her bölgede kimlere nöbet/Sodexo yazıldığını ve kimlerin atlandığını canlı kontrol edin.
                </div>
              </div>

              <!-- Legend -->
              <div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 0.72rem;">
                <span style="display: inline-flex; align-items: center; gap: 5px; color: #10B981;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #10B981; display: inline-block;"></span> Nöbetçi / 1 Sodexo Onaylı
                </span>
                <span style="display: inline-flex; align-items: center; gap: 5px; color: #fbbf24;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #fbbf24; display: inline-block;"></span> Kayıt Var (Sodexo Eksik)
                </span>
                <span style="display: inline-flex; align-items: center; gap: 5px; color: #ef4444;">
                  <span style="width: 8px; height: 8px; border-radius: 50%; background: #ef4444; display: inline-block;"></span> Yazılmadı / Boşta
                </span>
              </div>
            </div>

            <!-- 5-Region Grid -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
              ${regionCardsHtml}
            </div>
          </div>
        `;
      }

      if (summaryContainer) {
        summaryContainer.innerHTML = `
          <div class="glass-panel" style="grid-column: 1 / -1; padding: 1rem 1.25rem; border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 8px; background: rgba(168, 85, 247, 0.03); display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.9rem; color: #c084fc; display: flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-calendar-star"></i> BU DÖNEMDEKİ RESMİ TATİLLER (${selectedMonth}):
              </div>
              <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                ${holidaysInPeriod.length > 0 ? holidaysInPeriod.map(d => {
                  const [y, m, day] = d.split('-');
                  const isSelected = (d === activeAuditDate);
                  return `
                    <button onclick="window.selectHolidayAuditDate('${d}')" style="background: ${isSelected ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.1)'}; color: ${isSelected ? '#ffffff' : '#e9d5ff'}; border: 1px solid ${isSelected ? '#c084fc' : 'rgba(168, 85, 247, 0.3)'}; padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 6px; cursor: pointer; transition: all 0.2s; box-shadow: ${isSelected ? '0 0 10px rgba(168, 85, 247, 0.4)' : 'none'};">
                      <i class="fa-${isSelected ? 'solid' : 'regular'} fa-calendar-check" style="color: #c084fc;"></i> ${day}.${m}.${y} - ${HOLIDAY_NAMES_2026[d] || 'Tatil'}
                      ${isSelected ? '<span style="font-size: 0.65rem; background: #c084fc; color: #000; padding: 1px 5px; border-radius: 4px; font-weight: 800; margin-left: 4px;">SEÇİLİ</span>' : ''}
                    </button>
                  `;
                }).join('') : `
                  <span style="color: var(--text-muted); font-size: 0.75rem; font-style: italic;">
                    Bu hak ediş döneminde resmi tatil takvimi bulunmamaktadır.
                  </span>
                `}
              </div>
            </div>
          </div>

          <div class="glass-panel" style="padding: 1rem; border: 1px solid rgba(168, 85, 247, 0.15); border-radius: 8px; background: rgba(168, 85, 247, 0.02); display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM NÖBETÇİ PERSONEL</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.5rem; color: #fff;">
              ${uniqueHolidayPersonnelCount} <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Kişi (5 Bölge)</span>
            </div>
            <div style="font-size: 0.7rem; color: #c084fc;">Resmi tatilde görevli teknisyenler</div>
          </div>

          <div class="glass-panel" style="padding: 1rem; border: 1px solid rgba(20, 241, 149, 0.2); border-radius: 8px; background: rgba(20, 241, 149, 0.02); display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">ONAYLANAN SODEXO</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.5rem; color: #14F195;">
              ${approvedSodexoCount} <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Yemek</span>
            </div>
            <div style="font-size: 0.7rem; color: #14F195;">Hak edişe eklendi</div>
          </div>

          <div class="glass-panel" style="padding: 1rem; border: 1px solid ${missingHolidaySodexoCount > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255,255,255,0.05)'}; border-radius: 8px; background: ${missingHolidaySodexoCount > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(255,255,255,0.01)'}; display: flex; flex-direction: column; gap: 0.35rem;">
            <div style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">SODEXO EKSİK / BEKLEYEN</div>
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.5rem; color: ${missingHolidaySodexoCount > 0 ? '#ff4a4a' : 'var(--text-muted)'};">
              ${missingHolidaySodexoCount} <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">Adet</span>
            </div>
            <div style="font-size: 0.7rem; color: ${missingHolidaySodexoCount > 0 ? '#ff4a4a' : 'var(--text-muted)'};">
              ${missingHolidaySodexoCount > 0 ? '⚠️ Tanımlama yapılması gerekiyor' : 'Tüm nöbetçilere Sodexo tanımlı'}
            </div>
          </div>

          ${auditMatrixHtml}
        `;
      }

      // 3. Render Holiday Table Rows
      if (holidayRows.length === 0) {
        container.innerHTML = `
          <tr>
            <td colspan="9" style="text-align: center; padding: 4rem; color: var(--text-muted); font-size: 0.9rem;">
              <i class="fa-solid fa-calendar-star fa-3x" style="opacity: 0.25; display: block; margin-bottom: 1rem; color: #c084fc;"></i>
              Bu hak ediş döneminde (${selectedMonth}) henüz resmi tatil veya nöbet kaydı bulunmamaktadır.<br><br>
              ${!isLeader ? `
                <button onclick="window.openHolidayOncallModal()" class="btn-cyber" style="border-color: #c084fc; background: rgba(168, 85, 247, 0.15); color: #fff; font-size: 0.8rem; padding: 6px 14px; display: inline-flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-calendar-plus"></i> + RESMİ TATİL NÖBETÇİSİ EKLE
                </button>
              ` : ''}
            </td>
          </tr>
        `;
        return;
      }

      let holidayHtml = '';
      holidayRows.forEach((row: any) => {
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
        const dateKey = (row.date || '').replace(/[^0-9]/g, '');
        const inputId = `hours-${row.reportId}-${keyName}-${dateKey}`;
        const harcirahId = `harcirah-${row.reportId}-${keyName}-${dateKey}`;

        let formattedDate = row.date;
        let dayName = '';
        if (row.date && row.date.includes('-')) {
          const [y, m, d] = row.date.split('-');
          formattedDate = `${d}.${m}.${y}`;
          try {
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
          } catch (e) {}
        }

        const holidayName = HOLIDAY_NAMES_2026[row.date] || (DateTimeUtils.isPublicHoliday(row.date) ? 'Resmi Tatil' : '');
        const note = row.sessions?.[0]?.note || (row.type === 'RESMI_TATIL_NOBET' ? 'Resmi Tatil Nöbeti' : '');

        // Rounding balance
        const balance = w.getPersonnelPastBalance(row.personnel, selectedMonth);
        let balanceHtml = '';
        if (isAdmin) {
          if (balance > 0) {
            balanceHtml = `<span class="badge-balance" style="background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Personel Alacaklı: Hak edilen mesai yuvarlama sebebiyle içeride kalmış (+${balance} dk)">+${balance} dk</span>`;
          } else if (balance < 0) {
            balanceHtml = `<span class="badge-balance" style="background: rgba(251, 146, 60, 0.08); color: var(--accent-orange); border: 1px solid rgba(251, 146, 60, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Personel Borçlu: Hak ettiğinden fazla yuvarlanan veya ödenen süre (${balance} dk)">${balance} dk</span>`;
          } else {
            balanceHtml = `<span class="badge-balance" style="background: rgba(255,255,255,0.03); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Kumbara dengede (0 dk)">0 dk</span>`;
          }
        }

        const hasSodexoElsewhereOnDate = !row.sodexo && holidayRows.some((other: any) => {
          return other !== row && 
                 other.status !== 'deleted' && 
                 normalizeDate(other.date) === normalizeDate(row.date) && 
                 normalizeTurkish(other.personnel) === normalizeTurkish(row.personnel) && 
                 other.sodexo === true;
        });

        holidayHtml += `
          <tr class="table-row-hover" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
            <td style="padding: 0.85rem 1rem; vertical-align: middle;">
              <div style="font-weight: 700; color: #fff; font-size: 0.9rem; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                ${row.personnel} ${balanceHtml}
              </div>
              <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">
                ${row.company || 'Demirer Enerji'} | <span style="color: var(--accent-cyan); font-weight: 600;">${row.siteName}</span>
              </div>
            </td>

            <td style="padding: 0.85rem 1rem; vertical-align: middle;">
              <div style="font-size: 0.85rem; color: #fff; font-family: monospace; font-weight: 700;">
                <i class="fa-regular fa-calendar" style="color: #c084fc; margin-right: 5px;"></i>${formattedDate} ${dayName ? `(${dayName})` : ''}
              </div>
              <div style="margin-top: 4px;">
                ${holidayName ? `
                  <span style="background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; display: inline-flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-calendar-star"></i> ${holidayName}
                  </span>
                ` : `
                  <span style="background: rgba(239, 68, 68, 0.12); color: #ff4a4a; border: 1px solid rgba(239, 68, 68, 0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.7rem; font-weight: 800;">
                    <i class="fa-solid fa-star"></i> Resmi Tatil Nöbeti
                  </span>
                `}
              </div>
              <div onclick="window.previewOvertimeReport('${row.reportNo}', '${row.reportId}', event)" 
                   title="Raporu Önizle (Tıkla)"
                   style="font-size: 0.65rem; color: var(--accent-cyan); margin-top: 3px; font-family: monospace; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                   onmouseover="this.style.textDecoration='underline'" 
                   onmouseout="this.style.textDecoration='none'">
                <i class="fa-solid fa-file-lines" style="font-size: 0.6rem;"></i>
                <span>${row.reportNo}</span>
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.55rem; opacity: 0.75;"></i>
              </div>
            </td>

            <td style="padding: 0.85rem; text-align: left; vertical-align: middle;">
              ${row.approvedHours > 0 || (row.sessions && row.sessions.some((s: any) => s.duration && s.duration !== '00:00')) ? `
                <div style="color: var(--accent-cyan); font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-person-digging"></i> Sahada Çalıştı
                </div>
              ` : `
                <div style="color: #a78bfa; font-weight: 700; font-size: 0.8rem; display: flex; align-items: center; gap: 5px;">
                  <i class="fa-solid fa-house-user"></i> Evde Nöbetçi (${decimalToTimeStr(row.approvedHours)} Saat)
                </div>
              `}
              ${note ? `
                <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px; font-style: italic;">
                  ${note}
                </div>
              ` : ''}
            </td>

            <td style="padding: 0.85rem; text-align: center; vertical-align: middle; font-family: monospace;">
              <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: #bbb; font-size: 0.8rem;">
                ${decimalToTimeStr(row.suggestedHours)}
              </span>
            </td>

            <td style="padding: 0.85rem; text-align: center; vertical-align: middle;">
              <input type="text" id="${inputId}" class="cyber-input" value="${decimalToTimeStr(row.approvedHours)}" 
                     placeholder="00:00"
                     style="width: 80px; text-align: center; height: 32px; font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.2);"
                     oninput="window.previewRowKumbara('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}', this.value)"
                     onkeydown="if(event.key==='Enter') { window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}'); }"
                     ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
              ${isAdmin ? `
                <div id="kumbara-${row.reportId}-${keyName}-${dateKey}" style="font-size: 0.65rem; color: ${balance > 0 ? 'var(--accent-cyan)' : (balance < 0 ? 'var(--accent-orange)' : 'var(--text-muted)')}; margin-top: 3px; font-family: monospace;" title="Kumbara Bakiyesi">
                  ${balance > 0 ? `Kumbara: +${balance} dk` : (balance < 0 ? `Kumbara: ${balance} dk` : `Kumbara: 0 dk`)}
                </div>
              ` : ''}
            </td>

            <td style="padding: 0.85rem; text-align: center; vertical-align: middle;">
              ${row.sodexo ? `
                <span style="background: rgba(20, 241, 149, 0.12); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
                  <i class="fa-solid fa-circle-check"></i> 1 SODEXO (ONAYLI)
                </span>
              ` : hasSodexoElsewhereOnDate ? `
                <span style="background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid rgba(255, 255, 255, 0.12); padding: 4px 10px; border-radius: 6px; font-weight: 700; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;" title="Bu personele aynı gün için diğer rapordan 1 Sodexo tanımlanmıştır (Günlük Limit: 1 Adet)">
                  <i class="fa-solid fa-check-double" style="color: var(--accent-cyan);"></i> 1 SODEXO TANIMLI (LİMİT)
                </span>
              ` : `
                <span style="background: rgba(239, 68, 68, 0.12); color: #ff4a4a; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 5px; white-space: nowrap;">
                  <i class="fa-solid fa-triangle-exclamation"></i> SODEXO EKSİK
                </span>
              `}
            </td>

            <td style="padding: 0.85rem; text-align: center; vertical-align: middle;">
              <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
                <input type="checkbox" id="${harcirahId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);" 
                       ${row.harcirah ? 'checked' : ''} 
                       ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
              </label>
            </td>

            <td style="padding: 0.85rem; text-align: center; vertical-align: middle;">
              <span style="display: inline-block; background: ${badgeColor}; color: ${textColor}; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${textColor}22;">
                ${badgeText}
              </span>
              ${row.approvedBy ? `
                <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">
                  ${formatDisplayName(row.approvedBy)}
                </div>
              ` : ''}
            </td>

            <td style="padding: 0.85rem; text-align: right; vertical-align: middle;">
              <div style="display: flex; gap: 0.4rem; justify-content: flex-end; align-items: center; flex-wrap: nowrap;">
                ${!isLeader ? `
                  ${row.sodexo ? `
                    <button onclick="window.quickSetHolidaySodexo('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}', false)" 
                            style="background: transparent; border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444; border-radius: 6px; height: 28px; font-size: 0.7rem; padding: 0 6px; cursor: pointer; white-space: nowrap;"
                            title="Sodexo hakkını iptal et">
                      <i class="fa-solid fa-utensils-slash"></i> Kaldır
                    </button>
                  ` : !hasSodexoElsewhereOnDate ? `
                    <button onclick="window.quickSetHolidaySodexo('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}', true)" 
                            class="btn-cyber-orange" 
                            style="height: 28px; font-size: 0.7rem; padding: 0 8px; border-radius: 6px; cursor: pointer; white-space: nowrap;"
                            title="Bu personele hemen 1 Sodexo tanımla ve onayla">
                      <i class="fa-solid fa-plus"></i> SODEXO TANIMLA
                    </button>
                  ` : ''}
                  ${row.status === 'pending' ? `
                    <button onclick="window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                            class="action-icon-btn" 
                            style="width: 28px; height: 28px; border-radius: 6px; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.2); color: var(--accent-green); cursor: pointer; display: flex; align-items: center; justify-content: center;"
                            title="Onayla">
                      <i class="fa-solid fa-check" style="font-size: 0.8rem;"></i>
                    </button>
                  ` : ''}
                  ${row.status === 'deleted' ? `
                    <button onclick="window.restoreSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                            class="btn-cyber-outline" 
                            style="height: 28px; font-size: 0.65rem; padding: 0 8px; border-radius: 6px; border: 1px solid var(--accent-cyan); background: transparent; color: var(--accent-cyan); cursor: pointer;">
                      GERİ YÜKLE
                    </button>
                  ` : `
                    <button onclick="window.deleteSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                            class="action-icon-btn red" 
                            style="width: 28px; height: 28px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center;"
                            title="Kayıt Sil">
                      <i class="fa-solid fa-trash" style="font-size: 0.8rem;"></i>
                    </button>
                  `}
                ` : `
                  <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic;">SALT OKUNUR</span>
                `}
              </div>
            </td>
          </tr>
        `;
      });

      container.innerHTML = holidayHtml;
      return;
    }

    // ==========================================
    // TAB 1: SAHA MESAİ & SODEXO ONAYLARI (GENERAL)
    // ==========================================
    if (theadEl) {
      theadEl.innerHTML = `
        <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.06); font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.8rem; color: var(--accent-cyan); letter-spacing: 1px; text-transform: uppercase;">
          <th style="padding: 1rem 0.75rem;">PERSONEL & SAHA</th>
          <th style="padding: 1rem 0.75rem;">TARİH & RAPOR</th>
          <th style="padding: 1rem 0.75rem; text-align: left;">SAAT ARALIĞI</th>
          <th style="padding: 1rem 0.75rem; text-align: center;">ÖNERİLEN FAZLA MESAI</th>
          <th style="padding: 1rem 0.75rem; text-align: center;">ONAYLANAN MESAI</th>
          <th style="padding: 1rem 0.75rem; text-align: center;">YEMEK (SODEXO)</th>
          <th style="padding: 1rem 0.75rem; text-align: center;">HARCIRAH (DIŞ GÖREV)</th>
          <th style="padding: 1rem 0.75rem; text-align: center;">DURUM</th>
          <th style="padding: 1rem 0.75rem; text-align: right;">İŞLEMLER</th>
        </tr>
      `;
    }

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

    // Group rows by Report -> then by Date
    const reportGroupsMap = new Map<string, {
      reportId: string;
      reportNo: string;
      siteName: string;
      turbineNo: string;
      turbineSerial: string;
      faultCode: string;
      latestDate: string;
      earliestDate: string;
      totalPersons: Set<string>;
      days: Map<string, any[]>;
    }>();

    filteredRows.forEach((row: any) => {
      const repKey = row.reportNo || row.reportId;
      if (!reportGroupsMap.has(repKey)) {
        reportGroupsMap.set(repKey, {
          reportId: row.reportId,
          reportNo: row.reportNo,
          siteName: row.siteName,
          turbineNo: row.turbineNo,
          turbineSerial: row.turbineSerial,
          faultCode: row.faultCode,
          latestDate: row.date,
          earliestDate: row.date,
          totalPersons: new Set(),
          days: new Map()
        });
      }
      const group = reportGroupsMap.get(repKey)!;
      if (row.date > group.latestDate) group.latestDate = row.date;
      if (row.date < group.earliestDate) group.earliestDate = row.date;
      group.totalPersons.add(row.personnel);

      const dKey = row.date || 'Tarih Yok';
      if (!group.days.has(dKey)) {
        group.days.set(dKey, []);
      }
      group.days.get(dKey)!.push(row);
    });

    const reportGroups = Array.from(reportGroupsMap.values());

    // Sort report groups
    reportGroups.sort((a, b) => {
      if (selectedSort === 'date-asc') {
        return a.earliestDate.localeCompare(b.earliestDate);
      } else if (selectedSort === 'name-asc') {
        return (a.siteName || '').localeCompare(b.siteName || '', 'tr-TR');
      } else if (selectedSort === 'name-desc') {
        return (b.siteName || '').localeCompare(a.siteName || '', 'tr-TR');
      }
      return b.latestDate.localeCompare(a.latestDate);
    });

    let html = '';

    reportGroups.forEach((group) => {
      const dayKeys = Array.from(group.days.keys()).sort();
      const totalDays = dayKeys.length;
      const totalPersonnelCount = group.totalPersons.size;
      const repSafeKey = (group.reportNo || group.reportId).replace(/[^a-zA-Z0-9_-]/g, '_');
      const isExpanded = w._overtimeExpandedReports ? w._overtimeExpandedReports.has(repSafeKey) : false;

      // Report Header Row Banner (Collapsible Accordion Header)
      html += `
        <tr data-rep-key="${repSafeKey}" onclick="window.toggleOvertimeReport('${repSafeKey}')" 
            style="cursor: pointer; background: rgba(0, 242, 254, 0.05); border-top: 2px solid rgba(0, 242, 254, 0.3); border-bottom: 1px solid rgba(0, 242, 254, 0.15); user-select: none;"
            onmouseover="this.style.background='rgba(0, 242, 254, 0.1)'"
            onmouseout="this.style.background='rgba(0, 242, 254, 0.05)'">
          <td colspan="9" style="padding: 10px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 4px; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.25);">
                  <i id="rep-chevron-${repSafeKey}" class="fa-solid fa-chevron-right rep-chevron-icon" style="color: var(--accent-cyan); font-size: 0.75rem; transition: transform 0.2s ease; transform: ${isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'};"></i>
                </span>
                <span onclick="window.previewOvertimeReport('${group.reportNo}', '${group.reportId}', event)" 
                      title="Rapor Detayını Önizle (Tıkla)"
                      style="background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.9rem; letter-spacing: 0.5px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s;"
                      onmouseover="this.style.background='rgba(0, 242, 254, 0.25)'; this.style.borderColor='var(--accent-cyan)'; this.style.transform='scale(1.03)';"
                      onmouseout="this.style.background='rgba(0, 242, 254, 0.15)'; this.style.borderColor='rgba(0, 242, 254, 0.3)'; this.style.transform='scale(1)';">
                  <i class="fa-solid fa-file-lines"></i>
                  <span>${group.reportNo}</span>
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.7rem; opacity: 0.75; margin-left: 2px;"></i>
                </span>
                <span style="font-weight: 700; color: #fff; font-size: 0.9rem;">
                  <i class="fa-solid fa-location-dot" style="color: var(--accent-cyan); font-size: 0.8rem; margin-right: 4px;"></i>${group.siteName} - ${group.turbineNo}
                </span>
                <span style="color: ${group.faultCode ? '#ff6b6b' : 'var(--text-muted)'}; font-size: 0.8rem; font-weight: 600;">
                  ${group.faultCode ? `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 4px;"></i>${group.faultCode}` : '<i class="fa-solid fa-wrench" style="margin-right: 4px;"></i>Bakım'}
                </span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px; font-size: 0.75rem; color: var(--text-muted);">
                <span><i class="fa-solid fa-calendar-days" style="color: var(--accent-cyan); margin-right: 4px;"></i><strong>${totalDays}</strong> Çalışma Günü</span>
                <span><i class="fa-solid fa-users" style="color: var(--accent-green); margin-right: 4px;"></i><strong>${totalPersonnelCount}</strong> Personel</span>
                <span id="rep-label-${repSafeKey}" class="rep-toggle-label" style="color: var(--accent-cyan); font-size: 0.72rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; background: rgba(0, 242, 254, 0.08); border: 1px solid rgba(0, 242, 254, 0.2);">${isExpanded ? '▲ Kapat' : '▼ Aç'}</span>
              </div>
            </div>
          </td>
        </tr>
      `;

      // Render each day in the report
      dayKeys.forEach(dKey => {
        const dayRows = group.days.get(dKey)!;
        dayRows.sort((a, b) => a.personnel.localeCompare(b.personnel, 'tr-TR'));
        const daySafeKey = `${repSafeKey}_${(dKey || '').replace(/[^a-zA-Z0-9_-]/g, '_')}`;

        let formattedDate = dKey;
        let dayName = '';
        if (dKey && dKey.includes('-')) {
          const [y, m, d] = dKey.split('-');
          formattedDate = `${d}.${m}.${y}`;
          try {
            const dateObj = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            dayName = dateObj.toLocaleDateString('tr-TR', { weekday: 'long' });
          } catch (e) {}
        }

        const isPublicHoliday = DateTimeUtils.isPublicHoliday(dKey);
        const isWeekend = DateTimeUtils.isWeekend(dKey);

        // Day Subheader Banner
        html += `
          <tr class="rep-child-${repSafeKey} overtime-collapsible-child" onclick="window.toggleOvertimeDay('${daySafeKey}')" 
              style="cursor: pointer; ${isExpanded ? '' : 'display: none;'} background: rgba(255, 255, 255, 0.02); border-left: 3px solid var(--accent-cyan); user-select: none;"
              onmouseover="this.style.background='rgba(255, 255, 255, 0.05)'"
              onmouseout="this.style.background='rgba(255, 255, 255, 0.02)'">
            <td colspan="9" style="padding: 6px 14px; font-size: 0.8rem; color: #fff;">
              <div style="display: flex; align-items: center; gap: 8px;">
                <i id="day-chevron-${daySafeKey}" class="fa-solid fa-chevron-down day-chevron-icon" style="color: var(--accent-cyan); font-size: 0.7rem; transition: transform 0.2s;"></i>
                <span style="font-weight: 800; font-family: monospace; color: var(--accent-cyan);">
                  <i class="fa-regular fa-calendar-check" style="margin-right: 5px;"></i>${formattedDate} ${dayName ? `(${dayName})` : ''}
                </span>
                ${isPublicHoliday ? `<span style="background: rgba(239, 68, 68, 0.15); color: #ff4a4a; border: 1px solid rgba(239, 68, 68, 0.3); padding: 1px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;"><i class="fa-solid fa-calendar-star" style="margin-right: 3px;"></i>RESMİ TATİL</span>` : ''}
                ${isWeekend ? `<span style="background: rgba(249, 115, 22, 0.15); color: #ff9d42; border: 1px solid rgba(249, 115, 22, 0.3); padding: 1px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;"><i class="fa-solid fa-calendar-days" style="margin-right: 3px;"></i>HAFTA SONU</span>` : ''}
                <span style="color: var(--text-muted); font-size: 0.7rem; margin-left: auto;">${dayRows.length} Personel Kaydı <span style="opacity: 0.7; font-size: 0.65rem;">(Tıkla)</span></span>
              </div>
            </td>
          </tr>
        `;

        // Render rows for that day
        dayRows.forEach(row => {
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
          const dateKey = (row.date || '').replace(/[^0-9]/g, '');
          const inputId = `hours-${row.reportId}-${keyName}-${dateKey}`;
          const sodexoId = `sodexo-${row.reportId}-${keyName}-${dateKey}`;
          const harcirahId = `harcirah-${row.reportId}-${keyName}-${dateKey}`;

          // Calculate rounding balance for personnel (suggested - approved)
          const balance = w.getPersonnelPastBalance(row.personnel, selectedMonth);
          let balanceHtml = '';
          if (isAdmin) {
            if (balance > 0) {
              balanceHtml = `<span class="badge-balance" style="background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Personel Alacaklı: Hak edilen mesai yuvarlama sebebiyle içeride kalmış (+${balance} dk)">+${balance} dk</span>`;
            } else if (balance < 0) {
              balanceHtml = `<span class="badge-balance" style="background: rgba(251, 146, 60, 0.08); color: var(--accent-orange); border: 1px solid rgba(251, 146, 60, 0.2); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Personel Borçlu: Hak ettiğinden fazla yuvarlanan veya ödenen süre (${balance} dk)">${balance} dk</span>`;
            } else {
              balanceHtml = `<span class="badge-balance" style="background: rgba(255,255,255,0.03); color: var(--text-muted); border: 1px solid rgba(255,255,255,0.08); padding: 1px 6px; border-radius: 4px; font-size: 0.7rem; margin-left: 6px; font-family: monospace; font-weight: 700; cursor: help;" title="Kumbara dengede (0 dk)">0 dk</span>`;
            }
          }

          html += `
            <tr class="rep-child-${repSafeKey} day-child-${daySafeKey} overtime-collapsible-child table-row-hover" style="${isExpanded ? '' : 'display: none;'} border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
              <td style="padding: 0.75rem 1rem; vertical-align: middle;">
                <div style="font-weight: 700; color: #fff; font-size: 0.9rem; display: flex; align-items: center; flex-wrap: wrap; gap: 4px;">
                  ${row.personnel} ${balanceHtml}
                </div>
                <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${row.company || 'Bilinmeyen Şirket'}</div>
              </td>
              <td style="padding: 0.75rem 1rem; vertical-align: middle;">
                <div style="font-size: 0.8rem; color: #fff; font-family: monospace; font-weight: 600;">
                  ${formattedDate}
                </div>
                <div onclick="window.previewOvertimeReport('${row.reportNo}', '${row.reportId}', event)" 
                     title="Raporu Önizle (Tıkla)"
                     style="font-size: 0.65rem; color: var(--accent-cyan); margin-top: 2px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;"
                     onmouseover="this.style.textDecoration='underline'" 
                     onmouseout="this.style.textDecoration='none'">
                  <i class="fa-solid fa-file-lines" style="font-size: 0.6rem;"></i>
                  <span>${row.reportNo}</span>
                  <i class="fa-solid fa-arrow-up-right-from-square" style="font-size: 0.55rem; opacity: 0.75;"></i>
                </div>
                <div style="font-size: 0.65rem; color: var(--text-muted);">
                  ${row.siteName} - ${row.turbineNo}
                </div>
              </td>
              <td style="padding: 0.75rem; text-align: left; vertical-align: middle; font-family: monospace; font-size: 0.8rem; color: #fff; min-width: 270px;">
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
              <td style="padding: 0.75rem; text-align: center; vertical-align: middle; font-family: monospace;">
                <span style="background: rgba(255,255,255,0.05); padding: 2px 6px; border-radius: 4px; color: #bbb; font-size: 0.8rem;">
                  ${decimalToTimeStr(row.suggestedHours)}
                </span>
              </td>
              <td style="padding: 0.75rem; text-align: center; vertical-align: middle;">
                <input type="text" id="${inputId}" class="cyber-input" value="${decimalToTimeStr(row.approvedHours)}" 
                       placeholder="Örn: 08:00 veya 8"
                       style="width: 85px; text-align: center; height: 32px; font-family: monospace; font-size: 0.85rem; background: rgba(0,0,0,0.2);"
                       oninput="window.previewRowKumbara('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}', this.value)"
                       onkeydown="if(event.key==='Enter') { window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}'); }"
                       ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
                ${isAdmin ? `
                  <div id="kumbara-${row.reportId}-${keyName}-${dateKey}" style="font-size: 0.65rem; color: ${balance > 0 ? 'var(--accent-cyan)' : (balance < 0 ? 'var(--accent-orange)' : 'var(--text-muted)')}; margin-top: 3px; font-family: monospace;" title="Kumbara Bakiyesi">
                    ${balance > 0 ? `Kumbara: +${balance} dk <span style="font-size: 0.6rem; opacity: 0.85;">(Alacaklı)</span>` : (balance < 0 ? `Kumbara: ${balance} dk <span style="font-size: 0.6rem; opacity: 0.85;">(Borçlu)</span>` : `Kumbara: 0 dk <span style="font-size: 0.6rem; opacity: 0.85;">(Dengede)</span>`)}
                  </div>
                ` : ''}
              </td>
              <td style="padding: 0.75rem; text-align: center; vertical-align: middle;">
                <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
                  <input type="checkbox" id="${sodexoId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-orange);" 
                         ${row.sodexo ? 'checked' : ''} 
                         ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
                </label>
              </td>
              <td style="padding: 0.75rem; text-align: center; vertical-align: middle;">
                <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
                  <input type="checkbox" id="${harcirahId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);" 
                         ${row.harcirah ? 'checked' : ''} 
                         ${(row.status !== 'pending' || isLeader) ? 'disabled' : ''}>
                </label>
              </td>
              <td style="padding: 0.75rem; text-align: center; vertical-align: middle;">
                <span style="display: inline-block; background: ${badgeColor}; color: ${textColor}; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${textColor}22;">
                  ${badgeText}
                </span>
                ${row.approvedBy ? `
                  <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">
                    ${formatDisplayName(row.approvedBy)}
                  </div>
                ` : ''}
              </td>
              <td style="padding: 0.75rem; text-align: right; vertical-align: middle;">
                <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
                  ${isLeader ? `
                    <span style="font-size: 0.75rem; color: var(--text-muted); font-style: italic; border: 1px dashed rgba(255,255,255,0.08); padding: 3px 8px; border-radius: 6px; font-family: 'Rajdhani', sans-serif; font-weight: 700; letter-spacing: 0.5px;">SALT OKUNUR</span>
                  ` : `
                    ${row.status === 'deleted' ? `
                      <button onclick="window.restoreSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                              class="btn-cyber-outline" 
                              style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid var(--accent-cyan); background: transparent; color: var(--accent-cyan); cursor: pointer; transition: all 0.2s;"
                              onmouseover="this.style.background='rgba(0, 242, 254, 0.1)'"
                              onmouseout="this.style.background='transparent'">
                        GERİ YÜKLE
                      </button>
                    ` : row.status === 'pending' ? `
                      <button onclick="window.approveSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                              class="action-icon-btn" 
                              style="width: 32px; height: 32px; border-radius: 6px; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.2); color: var(--accent-green); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                              onmouseover="this.style.background='var(--accent-green)'; this.style.color='#000'"
                              onmouseout="this.style.background='rgba(0, 230, 118, 0.1)'; this.style.color='var(--accent-green)'"
                              title="Onayla">
                        <i class="fa-solid fa-check" style="font-size: 0.85rem;"></i>
                      </button>
                      <button onclick="window.rejectSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                              class="action-icon-btn red" 
                              style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                              onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                              onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                              title="Reddet">
                        <i class="fa-solid fa-xmark" style="font-size: 0.85rem;"></i>
                      </button>
                    ` : `
                      <button onclick="window.editApprovedOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
                              class="btn-cyber-outline" 
                              style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: transparent; color: var(--text-muted); cursor: pointer;"
                              onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.color='var(--accent-cyan)'"
                              onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.color='var(--text-muted)'">
                        DÜZENLE
                      </button>
                    `}
                    ${row.status !== 'deleted' ? `
                      <button onclick="window.deleteSessionOvertime('${row.reportId}', '${row.rawName.replace(/'/g, "\\'")}', '${row.date}')" 
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
        });
      });
    });

    container.innerHTML = html;
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

  filteredPersonnelDetails = filteredPersonnelDetails.filter(p => !isExemptOfficeStaff(p.name));

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

        .content-area button[onclick="window.exportSodexoExcel()"].btn-cyber-orange {
          background: rgba(251, 146, 60, 0.06) !important;
          border: 1px solid rgba(251, 146, 60, 0.25) !important;
          color: #fb923c !important;
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
        .content-area button[onclick="window.exportSodexoExcel()"].btn-cyber-orange:hover {
          background: rgba(251, 146, 60, 0.15) !important;
          border-color: rgba(251, 146, 60, 0.5) !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(251, 146, 60, 0.1) !important;
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

        .content-area button[onclick="window.openHolidayOncallModal()"].btn-cyber-purple {
          background: rgba(168, 85, 247, 0.08) !important;
          border: 1px solid rgba(168, 85, 247, 0.35) !important;
          color: #c084fc !important;
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
        .content-area button[onclick="window.openHolidayOncallModal()"].btn-cyber-purple:hover {
          background: rgba(168, 85, 247, 0.2) !important;
          border-color: rgba(168, 85, 247, 0.6) !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(168, 85, 247, 0.2) !important;
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
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          ${!isLeader ? `
            <button onclick="window.openHolidayOncallModal()" class="btn-cyber-purple">
              <i class="fa-solid fa-calendar-plus"></i> RESMİ TATİL NÖBETÇİSİ EKLE
            </button>
            <button onclick="window.openManualOvertimeModal()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-plus"></i> MANUEL MESAI EKLE
            </button>
          ` : ''}
          <button onclick="window.exportSodexoExcel()" class="btn-cyber-orange" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-utensils"></i> SODEXO EXCEL İNDİR
          </button>
          <button onclick="window.exportOfficeOvertimeExcel()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-paper-plane"></i> OFİSE GÖNDER
          </button>
          <button onclick="window.exportOvertimeExcel()" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-excel"></i> EXCEL OLARAK DIŞA AKTAR
          </button>
        </div>
      </div>

      <!-- Tab Navigation Bar -->
      <div style="display: flex; gap: 0.75rem; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem; margin-top: -0.5rem; flex-wrap: wrap;">
        <button onclick="window.switchOvertimeTab('general')" 
                style="padding: 0.6rem 1.25rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px; border-radius: 8px; border: 1px solid ${activeTab === 'general' ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'general' ? 'rgba(0, 242, 254, 0.12)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'general' ? '#fff' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: ${activeTab === 'general' ? '0 0 12px rgba(0, 242, 254, 0.15)' : 'none'};">
          <i class="fa-solid fa-list-check" style="color: ${activeTab === 'general' ? 'var(--accent-cyan)' : 'inherit'};"></i>
          SAHA MESAİ & SODEXO ONAYLARI
        </button>
        <button onclick="window.switchOvertimeTab('holiday-oncall')" 
                style="padding: 0.6rem 1.25rem; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.85rem; letter-spacing: 0.5px; border-radius: 8px; border: 1px solid ${activeTab === 'holiday-oncall' ? '#c084fc' : 'rgba(255,255,255,0.08)'}; background: ${activeTab === 'holiday-oncall' ? 'rgba(168, 85, 247, 0.15)' : 'rgba(255,255,255,0.02)'}; color: ${activeTab === 'holiday-oncall' ? '#fff' : 'var(--text-muted)'}; cursor: pointer; display: flex; align-items: center; gap: 8px; transition: all 0.2s; box-shadow: ${activeTab === 'holiday-oncall' ? '0 0 12px rgba(168, 85, 247, 0.2)' : 'none'};">
          <i class="fa-solid fa-calendar-star" style="color: ${activeTab === 'holiday-oncall' ? '#c084fc' : '#ff4a4a'};"></i>
          RESMİ TATİL & NÖBET TAKİBİ
          <span id="holiday-tab-badge" style="display: none; border-radius: 10px; padding: 1px 7px; font-size: 0.7rem; font-weight: 800; margin-left: 4px; border: 1px solid;"></span>
        </button>
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
            <label class="input-label" style="margin: 0; font-size: 0.7rem; letter-spacing: 1px;">YEMEK (SODEXO)</label>
            <select class="cyber-input" style="height: 38px; padding-top: 0; padding-bottom: 0; width: 100%;" onchange="window.changeOvertimeSodexo(this.value)">
              <option value="all" ${selectedSodexo === 'all' ? 'selected' : ''}>Tümü</option>
              <option value="sodexo-only" ${selectedSodexo === 'sodexo-only' ? 'selected' : ''}>Sadece Sodexo Olanlar</option>
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

      <!-- Table Actions / Accordion Controls Bar -->
      <div id="overtime-accordion-toolbar" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-top: -0.75rem; padding: 0 4px;">
        <div style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.85rem; color: var(--text-muted); display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-layer-group" style="color: var(--accent-cyan);"></i>
          <span>Rapor ve gün başlıklarına tıklayarak detayları açıp kapatabilirsiniz.</span>
        </div>
        <div style="display: flex; gap: 0.5rem;">
          <button onclick="window.expandAllOvertimeReports()" class="btn-cyber-outline" style="height: 32px; font-size: 0.75rem; padding: 0 12px; border-radius: 6px; border: 1px solid rgba(0, 242, 254, 0.3); background: rgba(0, 242, 254, 0.06); color: var(--accent-cyan); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(0, 242, 254, 0.15)'" onmouseout="this.style.background='rgba(0, 242, 254, 0.06)'">
            <i class="fa-solid fa-angles-down"></i> TÜMÜNÜ AÇ
          </button>
          <button onclick="window.collapseAllOvertimeReports()" class="btn-cyber-outline" style="height: 32px; font-size: 0.75rem; padding: 0 12px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.12); background: rgba(255, 255, 255, 0.03); color: var(--text-muted); cursor: pointer; display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px; transition: all 0.2s;" onmouseover="this.style.background='rgba(255, 255, 255, 0.08)'; this.style.color='#fff'" onmouseout="this.style.background='rgba(255, 255, 255, 0.03)'; this.style.color='var(--text-muted)'">
            <i class="fa-solid fa-angles-up"></i> TÜMÜNÜ KAPAT
          </button>
        </div>
      </div>

      <!-- Main Queue Table Container -->
      <div class="glass-panel" style="border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; text-align: left;">
          <thead id="overtime-table-head">
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

      <!-- Holiday On-Call Modal -->
      <div id="holiday-oncall-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.85); backdrop-filter: blur(12px); z-index: 999999; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;">
        <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2rem; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; display: flex; flex-direction: column; gap: 1.25rem; box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6); margin: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
            <h3 style="margin: 0; color: #fff; font-size: 1.2rem; font-weight: 700; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-calendar-star" style="color: #c084fc;"></i> Resmi Tatil Nöbetçisi Ekle
            </h3>
            <button onclick="window.closeHolidayOncallModal()" style="background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem; transition: color 0.2s;"><i class="fa-solid fa-xmark"></i></button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Holiday Date Selector -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem; color: #c084fc;">RESMİ TATİL GÜNÜ *</label>
              <select id="nobet-date" class="cyber-input" style="height: 38px; width: 100%; border-color: rgba(168, 85, 247, 0.3);">
                <!-- Populated dynamically -->
              </select>
            </div>

            <!-- Custom Date Picker if selected custom -->
            <div id="nobet-custom-date-container" style="display: none; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">TARİH SEÇİNİZ</label>
              <input type="date" id="nobet-custom-date" class="cyber-input" style="height: 38px; width: 100%; color: #fff;">
            </div>

            <!-- Personnel Selector -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">NÖBETÇİ PERSONEL *</label>
              <select id="nobet-personnel" class="cyber-input" style="height: 38px; width: 100%;">
                ${personnelListOptions}
              </select>
            </div>

            <!-- Site Selector -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">BAĞLI OLDUĞU SAHA *</label>
              <select id="nobet-site" class="cyber-input" style="height: 38px; width: 100%;">
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

            <!-- Duty Type -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">GÖREV TÜRÜ *</label>
              <select id="nobet-type" class="cyber-input" style="height: 38px; width: 100%;">
                <option value="evde">🏠 Evde Nöbetçi (0 Saat Mesai - Sadece Sodexo)</option>
                <option value="sahada">⚡ Sahada Çalıştı (Mesai Saati Ekle)</option>
              </select>
            </div>

            <!-- Hours (if sahada) -->
            <div id="nobet-hours-container" style="display: none; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">ÇALIŞMA / MESAİ SAATİ</label>
              <input type="number" id="nobet-hours" class="cyber-input" style="height: 38px; width: 100%; text-align: center;" step="0.5" min="0.5" value="0.0">
            </div>

            <!-- Sodexo Checkbox (default checked) -->
            <div style="padding: 10px 12px; background: rgba(251, 146, 60, 0.08); border: 1px solid rgba(251, 146, 60, 0.25); border-radius: 8px;">
              <label style="display: flex; align-items: center; gap: 10px; color: #fff; cursor: pointer; font-size: 0.85rem; font-weight: 600;">
                <input type="checkbox" id="nobet-sodexo" checked style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--accent-orange);">
                <span><i class="fa-solid fa-utensils" style="color: var(--accent-orange); margin-right: 4px;"></i> Yemek (Sodexo) Tanımlansın (1 Adet)</span>
              </label>
              <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 4px; padding-left: 30px;">
                Nöbetçi personele otomatik olarak 1 adet Sodexo yemek hak edişi tanımlanır ve onaylanır.
              </div>
            </div>

            <!-- Note / Açıklama -->
            <div style="display: flex; flex-direction: column; gap: 0.35rem;">
              <label class="input-label" style="margin: 0; font-size: 0.75rem;">AÇIKLAMA / NOT</label>
              <input type="text" id="nobet-note" class="cyber-input" value="Resmi Tatil Nöbeti" style="height: 38px; width: 100%;">
            </div>
          </div>

          <!-- Buttons -->
          <div style="display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem;">
            <button onclick="window.closeHolidayOncallModal()" class="btn-cyber" style="background: rgba(255,255,255,0.05); border-color: rgba(255,255,255,0.1); color: var(--text-muted);">İptal</button>
            <button onclick="window.saveHolidayOncall()" class="btn-cyber" style="border-color: #c084fc; background: rgba(168, 85, 247, 0.2); color: #fff;">
              <i class="fa-solid fa-check"></i> Nöbetçiyi Kaydet & Onayla
            </button>
          </div>

        </div>
      </div>

      <!-- Overtime Report Preview Modal (Centered Glass Card with Backdrop Blur) -->
      <div id="overtime-report-modal" style="display: none; position: fixed; inset: 0; width: 100vw; height: 100vh; background: rgba(5, 10, 16, 0.82); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); z-index: 99999999; align-items: center; justify-content: center; padding: 1.25rem; box-sizing: border-box;" onclick="if(event.target === this) window.closeOvertimeReportPreview()">
        
        <!-- Central Report Card Container -->
        <div style="background: #0B101B; border: 1px solid rgba(0, 242, 254, 0.35); border-radius: 16px; width: 100%; max-width: 960px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 60px rgba(0,0,0,0.85); position: relative;" onclick="event.stopPropagation()">
          
          <!-- Sticky Header inside Card -->
          <div style="background: rgba(15, 23, 42, 0.98); border-bottom: 1px solid rgba(255, 255, 255, 0.08); padding: 0.85rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-shrink: 0;">
            <div style="display: flex; align-items: center; gap: 12px; min-width: 0;">
              <div style="background: linear-gradient(135deg, var(--accent-cyan), #00a8ff); width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #000; font-weight: 900; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; box-shadow: 0 0 15px rgba(0, 242, 254, 0.4); flex-shrink: 0;">
                <i class="fa-solid fa-file-invoice"></i>
              </div>
              <div style="min-width: 0;">
                <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                  <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 800; color: #fff; letter-spacing: 0.5px;">SERVİS RAPORU ÖNİZLEME</h3>
                  <span id="overtime-preview-badge" style="background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); color: var(--accent-cyan); font-size: 0.7rem; font-weight: 800; padding: 2px 8px; border-radius: 4px; font-family: monospace;"></span>
                </div>
                <div id="overtime-preview-report-no" style="font-size: 0.75rem; color: var(--text-muted); letter-spacing: 0.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">Yükleniyor...</div>
              </div>
            </div>
            
            <!-- Prominent Close Button -->
            <button onclick="window.closeOvertimeReportPreview()" class="btn-cyber" 
              style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.4); color: #f87171; padding: 6px 14px; height: 34px; cursor: pointer; border-radius: 6px; display: inline-flex; align-items: center; gap: 6px; font-weight: 800; font-size: 0.78rem; font-family: 'Rajdhani', sans-serif; transition: all 0.2s; flex-shrink: 0;" 
              onmouseover="this.style.background='rgba(239, 68, 68, 0.3)'; this.style.color='#fff';" 
              onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#f87171';">
              <i class="fa-solid fa-xmark"></i> KAPAT (ESC)
            </button>
          </div>

          <!-- Scrollable Body inside Card -->
          <div id="overtime-report-modal-content" style="flex: 1; overflow-y: auto; padding: 1.5rem; background: #fff; box-sizing: border-box;">
            <div style="text-align: center; padding: 4rem; color: #0284c7; font-size: 1rem;">
              <i class="fa-solid fa-spinner fa-spin fa-2x"></i><br><br>
              Rapor detayları yükleniyor...
            </div>
          </div>

        </div>

      </div>

    </div>
  `;
};
