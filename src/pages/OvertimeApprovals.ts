import { db } from '../firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { excelService } from '../services/ExcelService';
import { personnelService } from '../services/PersonnelService';

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
  let selectedMonth = w.overtimeSelectedMonth || defaultMonth;
  let selectedStatus = w.overtimeSelectedStatus || 'all'; // all, pending, approved, rejected, deleted
  let selectedCompany = w.overtimeSelectedCompany || 'all'; // all, Demirer Enerji, Har Film Yapım, YEK, Demirer Holding
  let selectedSort = w.overtimeSelectedSort || 'date-desc'; // date-desc, date-asc, name-asc, name-desc
  let selectedPersonnel = w.overtimeSelectedPersonnel || 'all'; // all or specific name
  let reports: any[] = [];
  let unsubscribe: (() => void) | null = null;

  // Save selection back to window context to preserve state on redraws
  w.overtimeSelectedMonth = selectedMonth;
  w.overtimeSelectedStatus = selectedStatus;
  w.overtimeSelectedCompany = selectedCompany;
  w.overtimeSelectedSort = selectedSort;
  w.overtimeSelectedPersonnel = selectedPersonnel;

  // Cleanup helper
  const cleanup = () => {
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
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

  w.deleteSessionOvertime = async (reportId: string, sessionId: string, personnelName: string) => {
    if (!confirm(`${personnelName} için bu mesai kaydını listeden kaldırmak istediğinize emin misiniz?`)) return;

    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    if (!currentApprovals[sessionId]) currentApprovals[sessionId] = {};
    
    currentApprovals[sessionId][personnelName] = {
      status: 'deleted',
      approvedHours: 0,
      sodexo: false,
      harcirah: false,
      approvedBy: w.currentUser?.email || 'Admin',
      approvedAt: new Date().toISOString()
    };

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

  w.restoreSessionOvertime = async (reportId: string, sessionId: string, personnelName: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    if (currentApprovals[sessionId] && currentApprovals[sessionId][personnelName]) {
      currentApprovals[sessionId][personnelName].status = 'pending';
    }

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

  w.approveSessionOvertime = async (reportId: string, sessionId: string, personnelName: string) => {
    const hoursInput = document.getElementById(`hours-${sessionId}-${personnelName.replace(/\s+/g, '_')}`) as HTMLInputElement;
    const sodexoInput = document.getElementById(`sodexo-${sessionId}-${personnelName.replace(/\s+/g, '_')}`) as HTMLInputElement;
    const harcirahInput = document.getElementById(`harcirah-${sessionId}-${personnelName.replace(/\s+/g, '_')}`) as HTMLInputElement;
    
    const approvedHours = hoursInput ? timeStrToDecimal(hoursInput.value) : 0;
    const sodexo = sodexoInput ? sodexoInput.checked : false;
    const harcirah = harcirahInput ? harcirahInput.checked : false;

    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    if (!currentApprovals[sessionId]) currentApprovals[sessionId] = {};
    
    currentApprovals[sessionId][personnelName] = {
      status: 'approved',
      approvedHours,
      sodexo,
      harcirah,
      approvedBy: w.currentUser?.email || 'Admin',
      approvedAt: new Date().toISOString()
    };

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

  w.rejectSessionOvertime = async (reportId: string, sessionId: string, personnelName: string) => {
    if (!confirm(`${personnelName} için mesaiyi reddetmek istediğinize emin misiniz?`)) return;

    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    if (!currentApprovals[sessionId]) currentApprovals[sessionId] = {};
    
    currentApprovals[sessionId][personnelName] = {
      status: 'rejected',
      approvedHours: 0,
      sodexo: false,
      harcirah: false,
      approvedBy: w.currentUser?.email || 'Admin',
      approvedAt: new Date().toISOString()
    };

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

  w.editApprovedOvertime = async (reportId: string, sessionId: string, personnelName: string) => {
    const report = reports.find(r => r.id === reportId);
    if (!report) return;

    const currentApprovals = report.overtimeApprovals || {};
    if (!currentApprovals[sessionId] || !currentApprovals[sessionId][personnelName]) return;

    // Reset status back to pending so that fields become editable again
    currentApprovals[sessionId][personnelName].status = 'pending';

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
    const flatRows = w.getFilteredOvertimeRows(false); // get currently filtered rows for excel
    if (flatRows.length === 0) {
      alert('Seçilen ay için dışa aktarılacak kayıt bulunamadı.');
      return;
    }
    const companySuffix = selectedCompany === 'all' ? 'Tum_Sirketler' : selectedCompany.replace(/\s+/g, '_');
    excelService.exportOvertimeToExcel(flatRows, `DH_Mesai_Sodexo_Harcirah_Raporu_${companySuffix}_${selectedMonth}`);
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
  });

  // Calculate and return the flat rows from the reports list
  w.getFilteredOvertimeRows = (allProcessed = false) => {
    const rows: any[] = [];
    const personnelDetails = personnelService.getPersonnelDetailsList();

    reports.forEach(report => {
      const workSessions = report.workSessions || [];
      workSessions.forEach((session: any) => {
        // Only target work sessions in the selected month (15th of current month to 14th of next month)
        if (!session.date || getSessionPayrollPeriod(session.date) !== selectedMonth) return;

        // Skip non-labor sessions (like DİNLENME)
        if (session.type && !['ÇALIŞMA', 'YOL'].includes(session.type.toUpperCase())) return;

        const personnelList = session.personnel || [];
        personnelList.forEach((name: string) => {
          // Skip exempt office personnel
          const nameLower = name.toLocaleLowerCase('tr-TR').trim();
          if (nameLower === 'fatih zebek' || nameLower === 'furkan yıldırım') return;

          const approval = report.overtimeApprovals?.[session.id]?.[name] || {};
          const status = approval.status || 'pending';

          // Skip if deleted and we are not explicitly filtering for deleted
          if (selectedStatus !== 'deleted' && status === 'deleted') return;
          // If we are filtering for deleted, skip non-deleted
          if (selectedStatus === 'deleted' && status !== 'deleted') return;

          // Auto-calculate suggested values
          const suggestedHours = calculateSuggestedOvertime(session.startTime, session.endTime);
          
          // Sodexo rule: ends at/after 21:00 or crosses midnight
          const decimalEnd = timeToDecimal(session.endTime);
          const decimalStart = timeToDecimal(session.startTime);
          const crossesMidnight = decimalEnd < decimalStart;
          const isLate = decimalEnd >= 21 || crossesMidnight || (decimalEnd < 6 && decimalEnd > 0);
          const suggestedSodexo = isLate;

          // Harcırah (Per Diem) rule: working at a different wind farm than base site (case-insensitive name match)
          const detail = personnelDetails.find(d => d.name.toLocaleLowerCase('tr-TR').trim() === name.toLocaleLowerCase('tr-TR').trim());
          const company = detail?.company || '';
          
          // Apply company filter
          if (selectedCompany !== 'all' && company !== selectedCompany) return;

          const canonicalName = detail?.name || name.trim();

          // Apply personnel filter
          if (selectedPersonnel !== 'all' && canonicalName !== selectedPersonnel) return;

          const baseSites = detail?.baseSites || [];
          const isAtBaseSite = baseSites.length > 0 && !!report.siteId && baseSites.includes(report.siteId);
          const suggestedHarcirah = !isAtBaseSite;

          // Resolve final/suggested values to check for zero/false across all metrics
          const approvedHoursVal = approval.approvedHours !== undefined ? approval.approvedHours : parseFloat(suggestedHours.toFixed(2));
          const sodexoVal = approval.sodexo !== undefined ? approval.sodexo : suggestedSodexo;
          const harcirahVal = approval.harcirah !== undefined ? approval.harcirah : suggestedHarcirah;

          // Skip shifts with no overtime, no sodexo, and no harcirah (both pending and approved)
          if (approvedHoursVal === 0 && !sodexoVal && !harcirahVal && status !== 'deleted') {
            return;
          }


          const row = {
            reportId: report.id,
            sessionId: session.id,
            personnel: canonicalName,
            rawName: name,
            company,
            date: session.date,
            reportNo: report.reportNo,
            siteName: report.siteName || 'Bilinmeyen Saha',
            turbineNo: report.turbineNo || '---',
            turbineSerial: report.turbineSerial || '---',
            startTime: session.startTime,
            endTime: session.endTime,
            duration: session.duration || '00:00',
            suggestedHours: parseFloat(suggestedHours.toFixed(2)),
            suggestedSodexo,
            suggestedHarcirah,
            approvedHours: approvedHoursVal,
            sodexo: sodexoVal,
            harcirah: harcirahVal,
            status,
            approvedBy: approval.approvedBy,
            approvedAt: approval.approvedAt,
            faultCode: report.faultCode || ''
          };

          if (allProcessed) {
            // Excel exports only approved rows
            if (status === 'approved') rows.push(row);
          } else {
            // Screen rendering filters
            if (selectedStatus === 'all') {
              rows.push(row);
            } else if (selectedStatus === status) {
              rows.push(row);
            }
          }
        });
      });
    });

    // Sort by selectedSort
    return rows.sort((a, b) => {
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
    const summaryMap: { [name: string]: { hours: number, sodexo: number, harcirah: number } } = {};
    reports.forEach(report => {
      const workSessions = report.workSessions || [];
      workSessions.forEach((session: any) => {
        if (!session.date || getSessionPayrollPeriod(session.date) !== selectedMonth) return;
        
        const personnelList = session.personnel || [];
        personnelList.forEach((name: string) => {
          // Skip exempt office personnel
          const nameLower = name.toLocaleLowerCase('tr-TR').trim();
          if (nameLower === 'fatih zebek' || nameLower === 'furkan yıldırım') return;

          // Check company filter
          const detail = personnelDetails.find(d => d.name.toLocaleLowerCase('tr-TR').trim() === name.toLocaleLowerCase('tr-TR').trim());
          const company = detail?.company || '';
          if (selectedCompany !== 'all' && company !== selectedCompany) return;

          const canonicalName = detail?.name || name.trim();

          const approval = report.overtimeApprovals?.[session.id]?.[name];
          if (approval && approval.status === 'approved') {
            if (!summaryMap[canonicalName]) summaryMap[canonicalName] = { hours: 0, sodexo: 0, harcirah: 0 };
            summaryMap[canonicalName].hours += approval.approvedHours || 0;
            if (approval.sodexo) summaryMap[canonicalName].sodexo += 1;
            if (approval.harcirah) summaryMap[canonicalName].harcirah += 1;
          }
        });
      });
    });

    // Render Summary Cards
    if (summaryContainer) {
      const summaryKeys = Object.keys(summaryMap).filter(name => {
        const data = summaryMap[name];
        return data.hours > 0 || data.sodexo > 0 || data.harcirah > 0;
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
                <span style="color: var(--text-muted);">Toplam Mesai:</span>
                <strong style="color: var(--accent-green); font-family: monospace;">${decimalToTurkishTimeStr(data.hours)}</strong>
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

      const inputId = `hours-${row.sessionId}-${row.rawName.replace(/\s+/g, '_')}`;
      const sodexoId = `sodexo-${row.sessionId}-${row.rawName.replace(/\s+/g, '_')}`;
      const harcirahId = `harcirah-${row.sessionId}-${row.rawName.replace(/\s+/g, '_')}`;

      // Date conversion to dd.mm.yyyy for readability
      let formattedDate = row.date;
      if (row.date && row.date.includes('-')) {
        const [y, m, d] = row.date.split('-');
        formattedDate = `${d}.${m}.${y}`;
      }



      return `
        <tr class="table-row-hover" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
          <td style="padding: 1rem 0.75rem; vertical-align: middle;">
            <div style="font-weight: 700; color: #fff; font-size: 0.9rem;">${row.personnel}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); margin-top: 2px;">${row.company || 'Bilinmeyen Şirket'}</div>
          </td>
          <td style="padding: 1rem 0.75rem; vertical-align: middle;">
            <div style="color: #fff; font-size: 0.85rem; font-family: monospace;">${formattedDate}</div>
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
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle; font-family: monospace; font-size: 0.85rem; color: #fff;">
            ${row.startTime} - ${row.endTime}
            <div style="font-size: 0.65rem; color: var(--text-muted); margin-top: 2px;">(Süre: ${row.duration})</div>
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
                   ${row.status !== 'pending' ? 'disabled' : ''}>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="${sodexoId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-orange);" 
                     ${row.sodexo ? 'checked' : ''} 
                     ${row.status !== 'pending' ? 'disabled' : ''}>
            </label>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <label style="position: relative; display: inline-flex; align-items: center; cursor: pointer;">
              <input type="checkbox" id="${harcirahId}" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-cyan);" 
                     ${row.harcirah ? 'checked' : ''} 
                     ${row.status !== 'pending' ? 'disabled' : ''}>
            </label>
          </td>
          <td style="padding: 1rem 0.75rem; text-align: center; vertical-align: middle;">
            <span style="display: inline-block; background: ${badgeColor}; color: ${textColor}; padding: 3px 8px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; border: 1px solid ${textColor}22;">
              ${badgeText}
            </span>
            ${row.approvedBy ? `
              <div style="font-size: 0.6rem; color: var(--text-muted); margin-top: 3px; font-family: monospace;">
                ${row.approvedBy.split('@')[0]}
              </div>
            ` : ''}
          </td>
          <td style="padding: 1rem 0.75rem; text-align: right; vertical-align: middle;">
            <div style="display: flex; gap: 0.5rem; justify-content: flex-end; align-items: center;">
              ${row.status === 'deleted' ? `
                <button onclick="window.restoreSessionOvertime('${row.reportId}', '${row.sessionId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                        class="btn-cyber-outline" 
                        style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid var(--accent-cyan); background: transparent; color: var(--accent-cyan); cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='rgba(0, 242, 254, 0.1)'"
                        onmouseout="this.style.background='transparent'">
                  GERİ YÜKLE
                </button>
              ` : row.status === 'pending' ? `
                <button onclick="window.approveSessionOvertime('${row.reportId}', '${row.sessionId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                        class="action-icon-btn" 
                        style="width: 32px; height: 32px; border-radius: 6px; background: rgba(0, 230, 118, 0.1); border: 1px solid rgba(0, 230, 118, 0.2); color: var(--accent-green); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                        onmouseover="this.style.background='var(--accent-green)'; this.style.color='#000'"
                        onmouseout="this.style.background='rgba(0, 230, 118, 0.1)'; this.style.color='var(--accent-green)'"
                        title="Onayla">
                  <i class="fa-solid fa-check" style="font-size: 0.85rem;"></i>
                </button>
                <button onclick="window.rejectSessionOvertime('${row.reportId}', '${row.sessionId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                        class="action-icon-btn red" 
                        style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                        onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                        onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                        title="Reddet">
                  <i class="fa-solid fa-xmark" style="font-size: 0.85rem;"></i>
                </button>
              ` : `
                <button onclick="window.editApprovedOvertime('${row.reportId}', '${row.sessionId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                        class="btn-cyber-outline" 
                        style="height: 28px; font-size: 0.65rem; padding: 0 10px; border-radius: 6px; border: 1px solid rgba(255, 255, 255, 0.1); background: transparent; color: var(--text-muted); cursor: pointer;"
                        onmouseover="this.style.borderColor='var(--accent-cyan)'; this.style.color='var(--accent-cyan)'"
                        onmouseout="this.style.borderColor='rgba(255, 255, 255, 0.1)'; this.style.color='var(--text-muted)'">
                  DÜZENLE
                </button>
              `}
              ${row.status !== 'deleted' ? `
                <button onclick="window.deleteSessionOvertime('${row.reportId}', '${row.sessionId}', '${row.rawName.replace(/'/g, "\\'")}')" 
                        class="action-icon-btn red" 
                        style="width: 32px; height: 32px; border-radius: 6px; background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--accent-red); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s;"
                        onmouseover="this.style.background='var(--accent-red)'; this.style.color='#fff'"
                        onmouseout="this.style.background='rgba(255, 77, 77, 0.1)'; this.style.color='var(--accent-red)'"
                        title="Kayıt Sil">
                  <i class="fa-solid fa-trash" style="font-size: 0.85rem;"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // Build month options for filter (all months of previous and current year, newest first)
  const monthOptions: string[] = [];
  for (let y = currentYear; y >= currentYear - 1; y--) {
    for (let m = 12; m >= 1; m--) {
      monthOptions.push(`${y}-${String(m).padStart(2, '0')}`);
    }
  }

  const personnelDetailsList = personnelService.getPersonnelDetailsList();
  const personnelNames = personnelDetailsList
    .map(p => p.name)
    .sort((a, b) => a.localeCompare(b, 'tr-TR'));

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; gap: 2rem;">
      
      <!-- Top Title and Excel Button -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0;">
            <i class="fa-solid fa-file-signature" style="color: var(--accent-cyan);"></i> Mesai & Sodexo Onayları
          </h1>
          <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 0.85rem;">
            Teknisyenlerin saatlerini denetleyin, fazla mesai, yemek ve dış görev harcırahlarını onaylayın.
          </p>
        </div>
        <button onclick="window.exportOvertimeExcel()" class="btn-cyber" style="height: 38px; display: inline-flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-file-excel"></i> EXCEL OLARAK DIŞA AKTAR
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
              <option value="Demirer Enerji" ${selectedCompany === 'Demirer Enerji' ? 'selected' : ''}>Demirer Enerji</option>
              <option value="Har Film Yapım" ${selectedCompany === 'Har Film Yapım' ? 'selected' : ''}>Har Film Yapım</option>
              <option value="YEK" ${selectedCompany === 'YEK' ? 'selected' : ''}>YEK</option>
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
        BUILD V1.0.4 - RESPONSIVE LAYOUT ACTIVE
      </div>

    </div>
  `;
};
