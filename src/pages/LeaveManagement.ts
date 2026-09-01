import * as XLSX from 'xlsx';
import { db } from '../firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  getDocs, 
  addDoc, 
  updateDoc, 
  doc, 
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { personnelService } from '../services/PersonnelService';

export interface LeaveRequest {
  id: string;
  userId: string;
  userEmail: string;
  userName: string; // Physical personnel name
  team: string;
  startDate: string;
  endDate: string;
  calendarDays?: number; // Actual calendar days requested
  duration: number; // Final deduction duration
  type: 'YILLIK_IZIN' | 'RAPOR' | 'MAZERET' | 'UCRETSIZ' | 'MESAI_IZNI' | 'EVLILIK_IZNI' | 'DOGUM_IZNI';
  description: string;
  status: 'PENDING_FIRST' | 'PENDING_FINAL' | 'APPROVED' | 'REJECTED';
  rejectReason?: string;
  requestedAt: any;
  processedAt?: any;
  processedBy?: string;
  firstApprovedBy?: string;
  firstApprovedAt?: any;
  finalApprovedBy?: string;
  finalApprovedAt?: any;
  reportUrl?: string;
  reportName?: string;
  additionalDeductionDates?: string[];
}

export const LeaveManagementPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role === 'ADMIN';
  const userEmail = (currentUser?.email || '').toLowerCase().trim();
  const isFurkan = userEmail === 'furkan.yildirim@demirerholding.com';
  const canApprove = isAdmin || 
                     isFurkan || 
                     userEmail === 'fatih.zebek@demirerholding.com' ||
                     userEmail === 'emre.aydogdu@demirerholding.com';
  
  // State initialization
  (window as any).leaveCurrentTab = (window as any).leaveCurrentTab || 'my-leaves';
  const currentTab = (window as any).leaveCurrentTab;

  // 1. Fetch user profile data to check user's team / managedTeams / allowedSites
  let userProfileDoc: any = null;
  try {
    if (currentUser?.uid) {
      const uRef = doc(db, 'users', currentUser.uid);
      const snap = await getDoc(uRef);
      if (snap.exists()) {
        userProfileDoc = snap.data();
      }
    }
  } catch (err) {
    console.error("Failed to load user profile", err);
  }

  // 2. Fetch raw personnel documents from Firestore to get their custom leave balances
  let personnelBalances: Record<string, { yillikIzinHakki?: number, kullanilanIzin?: number, id?: string, company?: string, tc?: string, hireDate?: string, jobTitle?: string, seniority?: string }> = {};
  try {
    const snap = await getDocs(collection(db, 'personnel'));
    snap.forEach(d => {
      const data = d.data();
      if (data.name) {
        personnelBalances[data.name.toLowerCase().trim()] = {
          id: d.id,
          yillikIzinHakki: data.yillikIzinHakki !== undefined ? Number(data.yillikIzinHakki) : undefined,
          kullanilanIzin: data.kullanilanIzin !== undefined ? Number(data.kullanilanIzin) : undefined,
          company: data.company || '',
          tc: data.tc || '',
          hireDate: data.hireDate || '',
          jobTitle: data.jobTitle || '',
          seniority: data.seniority || ''
        };
      }
    });
  } catch (err) {
    console.error("Failed to load personnel balances", err);
  }

  // 3. Fetch physical personnel details list from PersonnelService
  const allPersonnelDetails = personnelService.getPersonnelDetailsList();

  // 4. Filter personnel list based on logged-in user's allowedSites / team / managedTeams
  let filteredPersonnel = allPersonnelDetails;
  
  if (!isAdmin) {
    const userTeam = userProfileDoc?.team;
    const managedTeams = userProfileDoc?.managedTeams || [];
    const userSites = userProfileDoc?.allowedSites || [];
    
    if (userSites.length > 0 && !userSites.includes('all')) {
      filteredPersonnel = allPersonnelDetails.filter(p => {
        const hasSiteOverlap = p.baseSites && p.baseSites.some(s => userSites.includes(s));
        const matchesTeam = (userTeam && p.team === userTeam) || (managedTeams.length > 0 && p.team && managedTeams.includes(p.team));
        const isKeltepeTeam = (userTeam === 'Team11' || userTeam === 'Team07') && (p.team === 'Team11' || p.team === 'Team07');
        return hasSiteOverlap || matchesTeam || isKeltepeTeam;
      });
    } else if (managedTeams.length > 0) {
      filteredPersonnel = allPersonnelDetails.filter(p => p.team && managedTeams.includes(p.team));
    } else if (userTeam) {
      filteredPersonnel = allPersonnelDetails.filter(p => {
        if (userTeam === 'Team11' || userTeam === 'Team07') {
          return p.team === 'Team11' || p.team === 'Team07';
        }
        return p.team === userTeam;
      });
    } else {
      const myName = (currentUser?.displayName || '').toLowerCase().trim();
      const match = allPersonnelDetails.filter(p => p.name.toLowerCase().trim() === myName);
      if (match.length > 0) {
        filteredPersonnel = match;
      } else {
        filteredPersonnel = [{
          id: '',
          name: currentUser?.displayName || currentUser?.email || 'Kullanıcı',
          company: '',
          baseSites: [],
          team: ''
        }];
      }
    }
  }

  // Filter out Fatih ZEBEK, Furkan YILDIRIM, and Sercan YETGİN
  filteredPersonnel = filteredPersonnel.filter(p => {
    const cleanName = p.name.toLowerCase()
      .replace(/ı/g, 'i')
      .replace(/i̇/g, 'i')
      .replace(/ğ/g, 'g')
      .trim();
    return cleanName !== 'fatih zebek' && 
           cleanName !== 'furkan yildirim' && 
           cleanName !== 'sercan yetgin';
  });



  // 5. Select active personnel to view/request (Default to empty 'Personel Seçiniz' if there are multiple personnel)
  if (!(window as any).selectedLeavePersonnel || !filteredPersonnel.some(p => p.name === (window as any).selectedLeavePersonnel)) {
    if (filteredPersonnel.length > 1) {
      (window as any).selectedLeavePersonnel = '';
    } else if (filteredPersonnel.length === 1) {
      (window as any).selectedLeavePersonnel = filteredPersonnel[0].name;
    } else {
      (window as any).selectedLeavePersonnel = currentUser?.displayName || currentUser?.email || 'Kullanıcı';
    }
  }
  
  const selectedName = (window as any).selectedLeavePersonnel || '';
  const selectedBalanceKey = selectedName ? selectedName.toLowerCase().trim() : '';
  const selectedBalance = selectedBalanceKey ? (personnelBalances[selectedBalanceKey] || {}) : {};
  
  const yillikIzinHakki = selectedBalance.yillikIzinHakki !== undefined ? selectedBalance.yillikIzinHakki : 0;
  const kullanilanIzin = selectedBalance.kullanilanIzin !== undefined ? selectedBalance.kullanilanIzin : 0;
  const kalanIzin = yillikIzinHakki - kullanilanIzin;
  const balancePct = (yillikIzinHakki > 0) ? Math.min(100, Math.max(0, (kalanIzin / yillikIzinHakki) * 100)) : 0;

  // 6. Fetch leave requests from Firestore initially using index-free query
  let requests: LeaveRequest[] = [];
  try {
    const snap = await getDocs(collection(db, 'leaveRequests'));
    snap.forEach(d => {
      requests.push({ id: d.id, ...d.data() } as any);
    });
    
    // Sort in memory by requestedAt desc
    requests.sort((a, b) => {
      const aTime = a.requestedAt?.seconds ? a.requestedAt.seconds * 1000 : (a.requestedAt ? new Date(a.requestedAt).getTime() : 0);
      const bTime = b.requestedAt?.seconds ? b.requestedAt.seconds * 1000 : (b.requestedAt ? new Date(b.requestedAt).getTime() : 0);
      return bTime - aTime;
    });
  } catch (err) {
    console.error("Failed to load initial leave requests", err);
  }

  // Filter requests based on allowed visibility
  const canReadGlobal = isAdmin || 
                        userEmail === 'furkan.yildirim@demirerholding.com' || 
                        userEmail === 'fatih.zebek@demirerholding.com' ||
                        userEmail === 'emre.aydogdu@demirerholding.com';
  let filteredRequests = requests;
  if (!canReadGlobal) {
    const allowedNames = filteredPersonnel.map(p => p.name.toLowerCase().trim());
    filteredRequests = requests.filter(r => allowedNames.includes(r.userName.toLowerCase().trim()));
  }

  (window as any).allLeaveRequests = filteredRequests;
  
  const getLeaveStatusBadge = (req: any) => {
    if (req.status === 'PENDING_FIRST') {
      return `
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center;">
          <span style="background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(251,191,36,0.05);"><i class="fa-solid fa-hourglass-half"></i> İLK ONAY BEKLİYOR</span>
        </div>
      `;
    } else if (req.status === 'PENDING_FINAL') {
      return `
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center;">
          <span style="background: rgba(0,243,255,0.1); color: var(--accent-cyan); border: 1px solid rgba(0,243,255,0.3); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(0, 243, 255, 0.05);"><i class="fa-solid fa-user-clock"></i> SON ONAY BEKLİYOR</span>
          <span style="font-size: 0.65rem; color: #10b981; font-weight: bold; margin-left: 2px;">Ön Onay: ${req.firstApprovedBy || '---'}</span>
        </div>
      `;
    } else if (req.status === 'APPROVED') {
      return `
        <div style="display: flex; flex-direction: column; gap: 3px; align-items: center; text-align: center;">
          <span style="background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.3); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(16,185,129,0.05);"><i class="fa-solid fa-circle-check"></i> ONAYLANDI</span>
          <div style="display: flex; flex-direction: column; gap: 1px; font-size: 0.62rem; color: var(--text-muted); margin-top: 2px; line-height: 1.25;">
            <span>Ön Onay: <strong style="color: var(--text-main); opacity: 0.8;">${req.firstApprovedBy || '---'}</strong></span>
            <span>Son Onay: <strong style="color: var(--accent-cyan); font-weight: 800;">${req.finalApprovedBy || '---'}</strong></span>
          </div>
        </div>
      `;
    } else {
      return `
        <div style="display: flex; flex-direction: column; gap: 4px; align-items: center; text-align: center;">
          <span style="background: rgba(239,68,68,0.1); color: #ff3366; border: 1px solid rgba(239,68,68,0.3); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; box-shadow: 0 0 10px rgba(239,68,68,0.05);" title="${req.rejectReason || ''}"><i class="fa-solid fa-circle-xmark"></i> REDDEDİLDİ</span>
          <span style="font-size: 0.62rem; color: #ff3366; font-weight: bold; margin-left: 2px;">Reddeden: ${req.rejectedBy || req.processedBy || '---'}</span>
        </div>
      `;
    }
  };
  
  const approvedRequests = requests.filter(r => r.status === 'APPROVED');
  (window as any).allApprovedRequests = approvedRequests;

  // Set global window helper methods
  (window as any).switchLeaveTab = (tabName: string) => {
    (window as any).leaveCurrentTab = tabName;
    (window as any).navigate('leave-management');
  };

  (window as any).selectLeavePersonnel = (name: string) => {
    (window as any).selectedLeavePersonnel = name;
    (window as any).navigate('leave-management');
  };

  // Seniority and leave entitlement helpers based on hire date
  const calculateSeniorityHelper = (dateVal: string): string => {
    if (!dateVal) return '';
    const hireDate = new Date(dateVal);
    const today = new Date();
    let years = today.getFullYear() - hireDate.getFullYear();
    let months = today.getMonth() - hireDate.getMonth();
    let days = today.getDate() - hireDate.getDate();
    if (days < 0) months--;
    if (months < 0) {
      years--;
      months += 12;
    }
    if (years <= 0) {
      if (months <= 0) return '1 Yıldan Az';
      return `${months} Ay`;
    }
    return `${years} Yıl`;
  };

  const calculateEntitlementHelper = (dateVal: string): number => {
    if (!dateVal) return 0;
    const hireDate = new Date(dateVal);
    const today = new Date();
    let years = today.getFullYear() - hireDate.getFullYear();
    let months = today.getMonth() - hireDate.getMonth();
    let days = today.getDate() - hireDate.getDate();
    if (days < 0) months--;
    if (months < 0) {
      years--;
    }
    if (years < 1) return 0; // Default to 0 days if worked less than 1 year
    if (years >= 1 && years <= 5) return 14;
    if (years > 5 && years < 15) return 20;
    return 26;
  };

  // Dynamic window listener on hire date input change
  (window as any).onHireDateChange = (dateVal: string) => {
    const seniorityInput = document.getElementById('balance-seniority') as HTMLInputElement;
    const yillikHakInput = document.getElementById('balance-yillik-hak') as HTMLInputElement;
    if (!dateVal) return;
    if (seniorityInput) seniorityInput.value = calculateSeniorityHelper(dateVal);
    if (yillikHakInput) yillikHakInput.value = calculateEntitlementHelper(dateVal).toString();
  };

  // Direct printing without pop-up modal
  (window as any).openLeavePrintModal = async (requestId: string) => {
    const activeRequests = (window as any).allLeaveRequests || [];
    const req = activeRequests.find((r: any) => r.id === requestId);
    if (!req) return;

    const pKey = req.userName.toLowerCase().trim();
    const balance = personnelBalances[pKey] || {};

    const pDetails = allPersonnelDetails.find(p => p.name.toLowerCase().trim() === pKey);
    const companyMapping: Record<string, string> = {
      'yek': 'YEK Demirer Enerji Yatırım Danışmanlık A.Ş.',
      'har film': 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.',
      'demirer enerji': 'Demirer Enerji Elektrik Üretim A.Ş.',
      'demirer holding': 'DEMİRER HOLDİNG A.Ş.'
    };

    const getFullCompanyName = (raw: string) => {
      const clean = (raw || '').toLowerCase().trim();
      for (const [key, full] of Object.entries(companyMapping)) {
        if (clean === key || clean.includes(key)) {
          return full;
        }
      }
      return raw || 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.';
    };

    const company = getFullCompanyName(balance.company || pDetails?.company || '');
    const tc = balance.tc || (pDetails as any)?.tc || '';
    const hireDate = balance.hireDate || (pDetails as any)?.hireDate || '';
    const jobTitle = balance.jobTitle || (pDetails as any)?.jobTitle || '';
    const seniority = balance.seniority || (pDetails as any)?.seniority || (hireDate ? calculateSeniorityHelper(hireDate) : '---');

    // Prepare date fields
    const requestedDateStr = req.requestedAt?.seconds 
      ? new Date(req.requestedAt.seconds * 1000).toLocaleDateString('tr-TR')
      : new Date().toLocaleDateString('tr-TR');

    let qrDataUrl = '';
    try {
      const QRCode = (await import('qrcode')).default;
      qrDataUrl = await QRCode.toDataURL(`${window.location.origin}/?page=leave-verify&id=${req.id}`, { width: 150, margin: 1 });
    } catch (e) {
      console.error('Failed to generate verification QR code:', e);
    }

    const startDateFormated = new Date(req.startDate).toLocaleDateString('tr-TR');
    const endDateFormated = new Date(req.endDate).toLocaleDateString('tr-TR');

    // İŞ BAŞI TARİHİ is endDate + 1 day
    const returnDate = new Date(req.endDate);
    returnDate.setDate(returnDate.getDate() + 1);
    const returnDateFormated = returnDate.toLocaleDateString('tr-TR');

    // Balance logic
    const yHak = balance.yillikIzinHakki !== undefined ? balance.yillikIzinHakki : 0;
    const yKul = balance.kullanilanIzin !== undefined ? balance.kullanilanIzin : 0;
    const yKal = yHak - yKul;

    // Calculate bakiyeIzin (before deduction) vs remaining (after deduction)
    const bakiyeIzinBefore = req.type === 'YILLIK_IZIN' ? (yKal + req.duration) : yKal;
    const kalanIzinAfter = yKal;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert("Lütfen popup engelleyiciyi devre dışı bırakın.");
      return;
    }

    const typeMapDetailed: Record<string, string> = {
      'YILLIK_IZIN': 'yıllık izin',
      'RAPOR': 'sağlık raporu',
      'MAZERET': 'mazeret izni',
      'UCRETSIZ': 'ücretsiz izin',
      'MESAI_IZNI': 'mesai izni',
      'EVLILIK_IZNI': 'evlilik izni',
      'DOGUM_IZNI': 'doğum izni'
    };

    const typeLabel = typeMapDetailed[req.type] || req.type;

    const documentHtml = `
      <!DOCTYPE html>
      <html>
        <title>İzin Formu - ${req.userName}</title>
        <meta charset="utf-8">
        <style>
          @page {
            size: A4;
            margin: 10mm;
          }
          @media print {
            body {
              margin: 0;
              padding: 0;
            }
            .no-print {
              display: none;
            }
           }
           body {
             font-family: Arial, sans-serif;
             color: #000;
             background: #fff;
             padding: 0;
             box-sizing: border-box;
           }
           .outer-border {
             border: 4px double #000;
             padding: 30px 40px 65px 40px; /* Stretch border down by adding bottom padding */
             max-width: 800px;
             margin: 0 auto;
             box-sizing: border-box;
             position: relative;
           }
          .header-title {
            text-align: center;
            font-size: 1.1rem;
            font-weight: bold;
            line-height: 1.35;
            margin-bottom: 12px;
            text-transform: uppercase;
          }
          .date-row {
            text-align: right;
            font-weight: bold;
            margin-bottom: 12px;
            font-size: 0.9rem;
          }
          .details-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .details-table td {
            padding: 4px 4px;
            font-size: 0.85rem;
            vertical-align: top;
          }
          .details-table td.label {
            font-weight: bold;
            width: 210px;
          }
          .details-table td.colon {
            width: 15px;
            font-weight: bold;
          }
          .body-text {
            font-size: 0.88rem;
            line-height: 1.5;
            margin-bottom: 20px;
          }
          .signature-section {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 25px;
            padding-right: 40px;
          }
          .signature-box {
            text-align: right;
            font-size: 0.85rem;
            line-height: 1.4;
          }
          .approvals-section {
            border-top: none;
            padding-top: 10px;
            margin-top: 10px;
            font-size: 0.88rem;
            line-height: 1.5;
          }
          .approval-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-top: 20px;
          }
          .approval-column {
            width: 45%;
            font-size: 0.88rem;
            line-height: 1.4;
          }
          .approval-column.right {
            text-align: right;
          }
          .footer-balance-text {
            font-size: 0.8rem;
            font-style: italic;
            margin-top: 10px;
          }
        </style>
      </head>
      <body>
        <div class="outer-border">
          <!-- Top Section (Details & Request) -->
          <div>
            ${qrDataUrl ? `
            <div style="position: absolute; top: 15px; right: 25px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 2px; z-index: 10;">
              <img src="${qrDataUrl}" style="width: 75px; height: 75px; border: 1px solid #ddd; padding: 2px; border-radius: 4px;">
              <span style="font-size: 0.55rem; color: #666; font-family: monospace; font-weight: bold; letter-spacing: 0.5px;">İZİN DOĞRULAMA</span>
            </div>
            ` : ''}
            <div class="header-title" style="padding-top: 10px; padding-right: 95px; padding-left: 95px; text-align: center; line-height: 1.4;">
              ${company}<br>
              ÜCRETLİ İZİN FORMU<br>
              İZİN HAK KAZANAN PERSONELİN
            </div>

            <div class="date-row">
              ${requestedDateStr}
            </div>

            <table class="details-table">
              <tr>
                <td class="label">ADI SOYADI</td>
                <td class="colon">:</td>
                <td>${req.userName}</td>
              </tr>
              <tr>
                <td class="label">TC KİMLİK NO</td>
                <td class="colon">:</td>
                <td>${tc || '---'}</td>
              </tr>
              <tr>
                <td class="label">İŞE GİRİŞ TARİHİ</td>
                <td class="colon">:</td>
                <td>${hireDate ? new Date(hireDate).toLocaleDateString('tr-TR') : '---'}</td>
              </tr>
              <tr>
                <td class="label">KIDEMİ (İzin)</td>
                <td class="colon">:</td>
                <td>${seniority || '---'}</td>
              </tr>
              <tr>
                <td class="label">GÖREVİ</td>
                <td class="colon">:</td>
                <td>${jobTitle || '---'}</td>
              </tr>
              <tr>
                <td class="label">BAKİYE İZİN</td>
                <td class="colon">:</td>
                <td>${bakiyeIzinBefore.toString().replace('.', ',')} Gün</td>
              </tr>
              <tr>
                <td class="label">İZİNE ÇIKIŞ TARİHİ</td>
                <td class="colon">:</td>
                <td>${startDateFormated}</td>
              </tr>
              <tr>
                <td class="label">İŞ BAŞI TARİHİ</td>
                <td class="colon">:</td>
                <td>${returnDateFormated}</td>
              </tr>
              <tr>
                <td class="label">KULLANILAN İZİN GÜNÜ</td>
                <td class="colon">:</td>
                <td>${req.duration} Gün</td>
              </tr>
              ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
              <tr>
                <td class="label">HAFTA TATİLİ / YOL İZNİ TARİHİ</td>
                <td class="colon">:</td>
                <td>${req.additionalDeductionDates.map((d: string) => {
                  const parts = d.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                  return d;
                }).join(', ')}</td>
              </tr>
              ` : ''}
            </table>

            <div class="body-text">
              ${new Date(req.startDate).getFullYear()} yılı senelik iznimi <strong>${req.duration} gün</strong> ${startDateFormated} - ${returnDateFormated} tarihleri arasında kullanmak istiyorum.<br>
              Bilgi ve ONAY ınıza arz ederim.
            </div>

            <div class="signature-section" style="display: flex; justify-content: flex-end; margin-bottom: 25px;">
              <div class="signature-box" style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 3px;">
                <span>Saygılarımla,</span>
                <strong>${req.userName}</strong>
                <div style="border: 1px solid #16a34a; border-radius: 4px; padding: 2px 8px; background: rgba(22, 163, 74, 0.04); color: #16a34a; font-size: 0.6rem; text-align: center; font-weight: 700; font-family: monospace; line-height: 1.25; margin-top: 4px; letter-spacing: 0.5px; text-transform: uppercase;">
                  ✓ DİJİTAL TALEP EDİLDİ<br>
                  ${req.userEmail && req.userEmail !== req.userName.toLowerCase().replace(/ /g, '.') + '@demirerholding.com' && req.userEmail !== 'admin@demirerholding.com' ? `Talep Eden: ${req.userEmail.split('@')[0]}<br>` : ''}
                  ${requestedDateStr}
                </div>
              </div>
            </div>
          </div>

          <!-- Bottom Section (Approvals & HR Balance) -->
          <div>
            <div class="approvals-section" style="border-top: 1px solid #000; padding-top: 15px; margin-top: 15px;">
              ${company} personeli ${req.userName}'ın <strong>${req.duration} gün</strong> ${typeLabel}ine ayrılmasında sakınca yoktur.
              
              <div class="approval-row" style="display: flex; justify-content: space-between; align-items: flex-start; margin-top: 25px;">
                <div class="approval-column" style="width: 45%;">
                  <strong style="font-size: 0.75rem; text-transform: uppercase;">ÖN ONAYLAYAN (Teknik Ekip)</strong><br>
                  ${req.firstApprovedBy ? `
                    <div style="border: 1px solid #0284c7; border-radius: 4px; padding: 2px 8px; background: rgba(2, 132, 199, 0.04); color: #0284c7; font-size: 0.6rem; text-align: center; font-weight: 700; font-family: monospace; line-height: 1.25; margin-top: 4px; display: inline-block; letter-spacing: 0.5px; text-transform: uppercase;">
                      ✓ DİJİTAL ÖN ONAY<br>
                      ${req.firstApprovedBy}<br>
                      ${req.firstApprovedAt?.seconds ? new Date(req.firstApprovedAt.seconds * 1000).toLocaleDateString('tr-TR') : requestedDateStr}
                    </div>
                  ` : `<br><br><br><br>İmza`}
                </div>
                <div class="approval-column right" style="width: 45%; margin-right: 20px;">
                  <strong style="font-size: 0.75rem; text-transform: uppercase;">BAKIM SORUMLUSU (Son Onay)</strong><br>
                  ${req.finalApprovedBy ? `
                    <div style="border: 1px solid #16a34a; border-radius: 4px; padding: 2px 8px; background: rgba(22, 163, 74, 0.04); color: #16a34a; font-size: 0.6rem; text-align: center; font-weight: 700; font-family: monospace; line-height: 1.25; margin-top: 4px; display: inline-block; letter-spacing: 0.5px; text-transform: uppercase;">
                      ✓ DİJİTAL SON ONAY<br>
                      ${req.finalApprovedBy}<br>
                      ${req.finalApprovedAt?.seconds ? new Date(req.finalApprovedAt.seconds * 1000).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR')}
                    </div>
                  ` : `
                    <span style="color: #666; font-style: italic; font-size: 0.8rem;">${req.finalApprovedBy || 'Emre AYDOĞDU'}</span><br><br><br><br>
                    İmza
                  `}
                </div>
              </div>
            </div>

            <div style="border-top: none; margin-top: 30px; padding-top: 10px; display: flex; justify-content: space-between; align-items: flex-start;">
              <div class="approval-column">
                <strong>PERSONEL DEPARTMANI</strong><br>
                TAYFUN KARADENİZ<br>
                KAŞE / İMZA<br>
                Sn. K.D<br>
                <div class="footer-balance-text">
                  Bu kullanımdan sonra ${req.userName}'ün ${new Date(req.startDate).getFullYear()} yılından <strong>${kalanIzinAfter.toString().replace('.', ',')} gün</strong> izni kalmaktadır.
                </div>
              </div>
              <div class="approval-column right" style="margin-right: 20px;">
                <strong>ONAY MAKAMI</strong><br>
                Santral Bakım-İşletme-Operasyon Direktörü<br>
                KORAY DEMİRER<br><br><br><br>
                İmza
              </div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(documentHtml);
    printWindow.document.close();
  };

  // Callback when user selects a file for health report
  (window as any).onLeaveReportFileSelect = (input: HTMLInputElement) => {
    const label = document.getElementById('leave-report-file-label');
    if (!label) return;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      label.innerHTML = `<i class="fa-solid fa-file-pdf" style="color: #10b981;"></i> ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
      label.style.color = '#10b981';
    } else {
      label.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Dosya Seçin (.pdf, .png, .jpg)`;
      label.style.color = 'var(--accent-cyan)';
    }
  };

  // Submit request handler
  (window as any).submitLeaveRequest = async (e: Event) => {
    e.preventDefault();
    const selectedName = (window as any).selectedLeavePersonnel || '';
    if (!selectedName) {
      (window as any).showToast('Uyarı', 'Lütfen önce izin talep edilecek personeli seçin.', 'warning');
      return;
    }
    const form = e.target as HTMLFormElement;
    const startDate = (form.querySelector('#leave-start-date') as HTMLInputElement).value;
    const endDate = (form.querySelector('#leave-end-date') as HTMLInputElement).value;
    const type = (form.querySelector('#leave-type') as HTMLSelectElement).value as any;
    let description = (form.querySelector('#leave-description') as HTMLTextAreaElement).value.trim();
    if (type === 'RAPOR' && !description) {
      description = 'Sağlık Raporu';
    }

    if (!startDate || !endDate || !type || !description) {
      (window as any).showToast('Uyarı', 'Lütfen tüm zorunlu alanları doldurun.', 'warning');
      return;
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      (window as any).showToast('Hata', 'Bitiş tarihi başlangıç tarihinden önce olamaz.', 'error');
      return;
    }

    const diffTime = Math.abs(end.getTime() - start.getTime());
    const calendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    const durationInput = form.querySelector('#leave-duration-input') as HTMLInputElement;
    const baseDays = durationInput ? parseFloat(durationInput.value) || 1 : calendarDays;
    let finalDeduction = baseDays;
    const additionalDeductionDates: string[] = [];

    // Apply cumulative 5-day rule
    if (type === 'YILLIK_IZIN') {
      const requestMonth = startDate.substring(0, 7);
      const currentMonthLeaves = ((window as any).allLeaveRequests || []).filter((r: any) => 
        r.userName.toLowerCase().trim() === selectedBalanceKey &&
        r.type === 'YILLIK_IZIN' &&
        (r.status === 'APPROVED' || r.status === 'PENDING_FIRST' || r.status === 'PENDING_FINAL') &&
        r.startDate.startsWith(requestMonth)
      );
      
      const totalUsedCalendarDays = currentMonthLeaves.reduce((acc: number, r: any) => acc + (r.calendarDays || r.duration), 0);
      const u = totalUsedCalendarDays;
      const r = baseDays;
      const eOld = Math.floor(u / 5);
      const eNew = Math.floor((u + r) / 5);
      const deltaE = eNew - eOld;
      
      finalDeduction = r + deltaE;
    }

    // Check if annual leave request exceeds remaining balance
    if (type === 'YILLIK_IZIN' && finalDeduction > kalanIzin) {
      if (!confirm(`Talep edilen ${finalDeduction} günlük bakiye düşüşü kalan bakiyenizden (${kalanIzin} Gün) fazladır. Yine de devam etmek istiyor musunuz?`)) {
        return;
      }
    }

    // Upload health report if type is RAPOR
    let reportUrl = '';
    let reportName = '';

    if (type === 'RAPOR') {
      const fileInput = form.querySelector('#leave-report-file') as HTMLInputElement;
      const file = fileInput?.files?.[0];
      if (!file) {
        (window as any).showToast('Uyarı', 'Lütfen sağlık raporu dosyasını ekleyin.', 'warning');
        return;
      }

      try {
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> RAPOR YÜKLENİYOR...';
        }

        const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
        const { storage } = await import('../firebase');
        
        reportName = file.name;
        const storageRef = ref(storage, `leaves/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        reportUrl = await getDownloadURL(snapshot.ref);
      } catch (err: any) {
        console.error("File upload failed", err);
        (window as any).showToast('Hata', 'Rapor dosyası yüklenirken bir hata oluştu.', 'error');
        const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> TALEBİ GÖNDER';
        }
        return;
      }
    }

    const targetPersonDetails = filteredPersonnel.find(p => p.name === selectedName);

    try {
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> TALEP GÖNDERİLİYOR...';
      }

      await addDoc(collection(db, 'leaveRequests'), {
        userId: currentUser?.uid || '',
        userEmail: currentUser?.email || '',
        userName: selectedName, // Save physical person's name
        company: targetPersonDetails?.company || selectedBalance?.company || '',
        team: targetPersonDetails?.team || userProfileDoc?.team || '',
        startDate,
        endDate,
        calendarDays,
        requestedDays: baseDays,
        duration: finalDeduction,
        type,
        description,
        status: 'PENDING_FIRST', // Initial status
        requestedAt: serverTimestamp(),
        reportUrl,
        reportName,
        additionalDeductionDates
      });

      (window as any).showToast('Başarılı', `${selectedName} için izin talebi başarıyla gönderildi, onay bekliyor.`, 'success');
      setTimeout(() => {
        (window as any).navigate('leave-management');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', err.message || 'Talep gönderilemedi.', 'error');
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> TALEBİ GÖNDER';
      }
    }
  };

  // Date change handler to auto-calculate base calendar days
  (window as any).onLeaveDateChange = () => {
    const form = document.querySelector('form');
    if (!form) return;
    const startDateVal = (form.querySelector('#leave-start-date') as HTMLInputElement)?.value;
    const endDateVal = (form.querySelector('#leave-end-date') as HTMLInputElement)?.value;
    const durationInput = form.querySelector('#leave-duration-input') as HTMLInputElement;

    if (startDateVal && endDateVal) {
      const start = new Date(startDateVal);
      const end = new Date(endDateVal);
      if (end >= start) {
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const calendarDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        if (durationInput) {
          durationInput.value = calendarDays.toString();
          durationInput.max = calendarDays.toString();
        }
      }
    }
    (window as any).updateLeaveDurationPreview();
  };

  // Live preview update helper
  (window as any).updateLeaveDurationPreview = () => {
    const form = document.querySelector('form');
    if (!form) return;
    const startDateVal = (form.querySelector('#leave-start-date') as HTMLInputElement)?.value;
    const endDateVal = (form.querySelector('#leave-end-date') as HTMLInputElement)?.value;
    const typeVal = (form.querySelector('#leave-type') as HTMLSelectElement)?.value;
    const durationInput = (form.querySelector('#leave-duration-input') as HTMLInputElement);
    const previewEl = document.getElementById('leave-calculation-preview');
    
    // Health report container toggle
    const reportContainer = document.getElementById('leave-report-upload-container');
    if (reportContainer) {
      if (typeVal === 'RAPOR') {
        reportContainer.style.display = 'flex';
        const fileInput = document.getElementById('leave-report-file') as HTMLInputElement;
        if (fileInput) fileInput.required = true;
      } else {
        reportContainer.style.display = 'none';
        const fileInput = document.getElementById('leave-report-file') as HTMLInputElement;
        if (fileInput) {
          fileInput.required = false;
          fileInput.value = '';
        }
        const label = document.getElementById('leave-report-file-label');
        if (label) {
          label.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Dosya Seçin (.pdf, .png, .jpg)`;
          label.style.color = 'var(--accent-cyan)';
        }
      }
    }

    // Health description container toggle
    const descContainer = document.getElementById('leave-description-container');
    const descInput = document.getElementById('leave-description') as HTMLTextAreaElement;
    const descLabel = document.getElementById('leave-description-label');
    if (descContainer && descInput) {
      if (typeVal === 'RAPOR') {
        descContainer.style.display = 'none';
        descInput.required = false;
        if (descLabel) descLabel.innerHTML = 'İZİN AÇIKLAMASI / ADRESİ';
      } else {
        descContainer.style.display = 'flex';
        descInput.required = true;
        if (descLabel) descLabel.innerHTML = 'İZİN AÇIKLAMASI / ADRESİ *';
      }
    }

    if (!previewEl) return;

    if (!startDateVal || !endDateVal) {
      previewEl.style.display = 'none';
      return;
    }

    const start = new Date(startDateVal);
    const end = new Date(endDateVal);
    if (end < start) {
      previewEl.style.display = 'block';
      previewEl.style.borderColor = 'rgba(239, 68, 68, 0.3)';
      previewEl.style.background = 'rgba(239, 68, 68, 0.05)';
      previewEl.innerHTML = `<span style="color: #ff3366; font-weight: bold; display: flex; align-items: center; gap: 6px;"><i class="fa-solid fa-triangle-exclamation"></i> Bitiş tarihi başlangıçtan önce olamaz!</span>`;
      return;
    }

    let baseDays = durationInput ? parseFloat(durationInput.value) || 0 : 0;
    
    // Safety check: baseDays should not exceed the actual date difference
    const dateDiff = Math.ceil(Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    if (baseDays > dateDiff) {
      baseDays = dateDiff;
      if (durationInput) durationInput.value = dateDiff.toString();
    }

    if (typeVal === 'YILLIK_IZIN') {
      const requestMonth = startDateVal.substring(0, 7);
      const currentMonthLeaves = ((window as any).allLeaveRequests || []).filter((r: any) => 
        r.userName.toLowerCase().trim() === selectedBalanceKey &&
        r.type === 'YILLIK_IZIN' &&
        (r.status === 'APPROVED' || r.status === 'PENDING_FIRST' || r.status === 'PENDING_FINAL') &&
        r.startDate.startsWith(requestMonth)
      );
      const totalUsedCalendarDays = currentMonthLeaves.reduce((acc: number, r: any) => acc + (r.calendarDays || r.duration), 0);

      const u = totalUsedCalendarDays;
      const r = baseDays;
      const eOld = Math.floor(u / 5);
      const eNew = Math.floor((u + r) / 5);
      const deltaE = eNew - eOld;
      const finalDeduction = r + deltaE;

      previewEl.style.display = 'block';
      previewEl.style.borderColor = 'rgba(0, 243, 255, 0.3)';
      previewEl.style.background = 'rgba(0, 243, 255, 0.04)';
      
      let ruleExplanation = '';
      if (deltaE > 0) {
        ruleExplanation = `<div style="color: #fbbf24; font-weight: bold; margin-top: 6px; display: flex; align-items: flex-start; gap: 8px; border: 1px dashed rgba(251, 191, 36, 0.3); padding: 8px 12px; border-radius: 6px; background: rgba(251, 191, 36, 0.04); font-size: 0.72rem; line-height: 1.4;"><i class="fa-solid fa-circle-info fa-beat" style="margin-top: 2px;"></i><div>Kümülatif 5 gün kuralı: Bu ayki toplam izniniz 5'in katına ulaştığı için <strong>+${deltaE} Gün</strong> hafta tatili/yol izni düşülecektir.</div></div>`;
      } else {
        ruleExplanation = `<div style="color: var(--text-muted); margin-top: 6px; font-size: 0.7rem;">Ay içi toplam kümülatif: <strong>${u + r} / 5 Gün</strong> (5 günde bir +1 gün düşer).</div>`;
      }

      previewEl.innerHTML = `
        <div style="display: flex; flex-direction: column; gap: 6px; font-family: 'Rajdhani', sans-serif;">
          <div style="display: flex; justify-content: space-between;"><span>Talep Edilen İzin:</span> <span style="font-weight: 700; color: #fff;">${r} Gün</span></div>
          <div style="display: flex; justify-content: space-between;"><span>Önceki Kullanım (Bu Ay):</span> <span style="font-weight: 700; color: var(--text-muted);">${u} Gün</span></div>
          <div style="border-top: 1px solid rgba(255,255,255,0.08); margin-top: 6px; padding-top: 6px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: bold; color: #fff;">Düşünülecek Toplam Bakiye:</span> 
            <strong style="color: var(--accent-cyan); font-size: 0.95rem; text-shadow: 0 0 10px rgba(0, 243, 255, 0.4);">${finalDeduction} Gün</strong>
          </div>
          ${ruleExplanation}
        </div>
      `;

      const additionalContainer = document.getElementById('leave-additional-dates-container');
      if (additionalContainer) {
        additionalContainer.style.display = 'none';
        additionalContainer.innerHTML = '';
      }
    } else {
      const additionalContainer = document.getElementById('leave-additional-dates-container');
      if (additionalContainer) {
        additionalContainer.style.display = 'none';
        additionalContainer.innerHTML = '';
      }
      previewEl.style.display = 'block';
      previewEl.style.borderColor = 'rgba(255,255,255,0.1)';
      previewEl.style.background = 'rgba(255,255,255,0.02)';
      previewEl.innerHTML = `<div style="font-family: 'Rajdhani', sans-serif; display: flex; justify-content: space-between;"><span>Talep Edilen İzin:</span> <span style="font-weight: 700; color: #fff;">${baseDays} Gün (${typeMap[typeVal] || typeVal})</span></div>`;
    }
  };

  // Approval handlers supporting hierarchy
  (window as any).processLeaveRequest = async (requestId: string, status: 'PENDING_FINAL' | 'APPROVED' | 'REJECTED') => {
    let rejectReason = '';
    if (status === 'REJECTED') {
      const reason = prompt('Lütfen reddetme nedenini yazın:');
      if (reason === null) return;
      rejectReason = reason.trim();
      if (!rejectReason) {
        (window as any).showToast('Uyarı', 'Reddetme nedeni boş bırakılamaz.', 'warning');
        return;
      }
    } else {
      if (!confirm(`Bu izin talebini ${status === 'PENDING_FINAL' ? 'ön-onaylamak' : 'onaylamak'} istediğinize emin misiniz?`)) return;
    }

    try {
      const targetReq = ((window as any).allLeaveRequests || []).find((r: any) => r.id === requestId);
      if (!targetReq) return;

      let approverName = currentUser?.displayName || currentUser?.email || 'Yönetici';
      const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
      if (cleanEmail === 'fatih.zebek@demirerholding.com') {
        approverName = 'Fatih ZEBEK';
      } else if (cleanEmail === 'furkan.yildirim@demirerholding.com') {
        approverName = 'Furkan Yıldırım';
      } else if (cleanEmail === 'emre.aydogdu@demirerholding.com') {
        approverName = 'Emre Aydoğdu';
      }

      const reqRef = doc(db, 'leaveRequests', requestId);
      const updateData: any = {
        status,
        processedAt: serverTimestamp(),
        processedBy: approverName
      };

      if (status === 'PENDING_FINAL') {
        updateData.firstApprovedBy = approverName;
        updateData.firstApprovedAt = serverTimestamp();
      } else if (status === 'APPROVED') {
        updateData.finalApprovedBy = approverName;
        updateData.finalApprovedAt = serverTimestamp();
      } else if (status === 'REJECTED') {
        updateData.rejectedBy = approverName;
        updateData.rejectedAt = serverTimestamp();
      }

      if (rejectReason) updateData.rejectReason = rejectReason;

      await updateDoc(reqRef, updateData);

      // Update balance on final approval
      if (status === 'APPROVED' && targetReq.type === 'YILLIK_IZIN') {
        const pKey = targetReq.userName.toLowerCase().trim();
        const pBal = personnelBalances[pKey];
        if (pBal && pBal.id) {
          const pRef = doc(db, 'personnel', pBal.id);
          const curKullanilan = pBal.kullanilanIzin !== undefined ? pBal.kullanilanIzin : 0;
          await updateDoc(pRef, {
            kullanilanIzin: curKullanilan + targetReq.duration
          });
        } else {
          const pDetails = allPersonnelDetails.find(p => p.name.toLowerCase().trim() === pKey);
          await addDoc(collection(db, 'personnel'), {
            name: targetReq.userName,
            kullanilanIzin: targetReq.duration,
            yillikIzinHakki: 0,
            team: pDetails?.team || '',
            company: pDetails?.company || '',
            baseSites: pDetails?.baseSites || [],
            createdAt: new Date().toISOString()
          });
        }
      }

      let successMsg = '';
      if (status === 'PENDING_FINAL') {
        successMsg = 'İlk onay başarıyla verildi. Talep son onay aşamasına iletildi.';
      } else if (status === 'APPROVED') {
        successMsg = 'İzin talebi tamamen onaylandı ve bakiye güncellendi.';
      } else {
        successMsg = 'Talep reddedildi.';
      }

      (window as any).showToast('Başarılı', successMsg, 'success');
      (window as any).navigate('leave-management');
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', err.message || 'İşlem başarısız.', 'error');
    }
  };

  // Approval process with date selection supporting cumulative 5-day rule
  (window as any).processLeaveRequestWithDates = async (requestId: string, status: 'PENDING_FINAL' | 'APPROVED' | 'REJECTED') => {
    const deltaSelect = document.getElementById(`leave-approve-delta-select-${requestId}`) as HTMLSelectElement;
    const finalDelta = deltaSelect ? parseInt(deltaSelect.value) || 0 : 0;
    const additionalDeductionDates: string[] = [];

    if (finalDelta > 0) {
      for (let i = 0; i < finalDelta; i++) {
        const selectEl = document.getElementById(`leave-approve-date-${requestId}-${i}`) as HTMLSelectElement;
        if (selectEl && selectEl.value) {
          additionalDeductionDates.push(selectEl.value);
        } else {
          (window as any).showToast('Uyarı', `Lütfen +${i + 1}. ek kesinti (hafta tatili/yol izni) günü için bir tarih seçin.`, 'warning');
          return;
        }
      }
    }

    if (!confirm(`Bu izin talebini ön-onaylamak istediğinize emin misiniz?`)) return;

    try {
      let approverName = currentUser?.displayName || currentUser?.email || 'Yönetici';
      const cleanEmail = (currentUser?.email || '').toLowerCase().trim();
      if (cleanEmail === 'fatih.zebek@demirerholding.com') {
        approverName = 'Fatih ZEBEK';
      } else if (cleanEmail === 'furkan.yildirim@demirerholding.com') {
        approverName = 'Furkan Yıldırım';
      } else if (cleanEmail === 'emre.aydogdu@demirerholding.com') {
        approverName = 'Emre Aydoğdu';
      }

      const reqRef = doc(db, 'leaveRequests', requestId);
      const targetReq = ((window as any).allLeaveRequests || []).find((r: any) => r.id === requestId);
      if (!targetReq) return;

      const baseDays = targetReq.requestedDays !== undefined ? targetReq.requestedDays : (targetReq.calendarDays || targetReq.duration);
      const finalDuration = baseDays + finalDelta;

      await updateDoc(reqRef, {
        status,
        duration: finalDuration,
        processedAt: serverTimestamp(),
        processedBy: approverName,
        firstApprovedBy: approverName,
        firstApprovedAt: serverTimestamp(),
        additionalDeductionDates
      });

      (window as any).showToast('Başarılı', 'Ek düşüş tarihleri kaydedildi ve talep ön-onaylandı.', 'success');
      setTimeout(() => {
        (window as any).navigate('leave-management');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', err.message || 'Onay işlemi başarısız.', 'error');
    }
  };

  // Helper function to update date selection fields when manager changes delta dropdown value
  (window as any).onApproveDeltaChange = (reqId: string, val: string) => {
    const delta = parseInt(val) || 0;
    const container = document.getElementById(`leave-approve-dates-container-${reqId}`);
    if (!container) return;

    if (delta === 0) {
      container.style.display = 'none';
      container.innerHTML = '';
      return;
    }

    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '6px';
    
    let selectorsHtml = '';
    for (let i = 0; i < delta; i++) {
      selectorsHtml += `
        <div style="display: flex; flex-direction: column; gap: 3px; text-align: left; margin-top: 4px;">
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; font-family: 'Rajdhani', sans-serif;">+${i + 1}. HAFTA TATİLİ / YOL İZNİ TARİHİ *</span>
          <input type="date" id="leave-approve-date-${reqId}-${i}" class="cyber-input" style="height: 28px; font-size: 0.8rem; font-family: 'Rajdhani', sans-serif; background: rgba(0,0,0,0.25); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 4px; color: #fff; padding: 0 8px; outline: none; width: 100%; box-sizing: border-box;">
        </div>
      `;
    }
    container.innerHTML = selectorsHtml;
  };

  // Cancel/Delete request
  (window as any).cancelLeaveRequest = async (requestId: string) => {
    if (!confirm('Bu izin talebini tamamen silmek istediğinize emin misiniz? (Eğer onaylanmış bir izin ise personelin bakiyesi geri yüklenecektir)')) return;
    try {
      const targetReq = ((window as any).allLeaveRequests || []).find((r: any) => r.id === requestId);
      
      const { deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'leaveRequests', requestId));

      // Revert balance if it was approved and annual leave
      if (targetReq && targetReq.status === 'APPROVED' && targetReq.type === 'YILLIK_IZIN') {
        const pKey = targetReq.userName.toLowerCase().trim();
        const pBal = personnelBalances[pKey];
        if (pBal && pBal.id) {
          const pRef = doc(db, 'personnel', pBal.id);
          const curKullanilan = pBal.kullanilanIzin !== undefined ? pBal.kullanilanIzin : 0;
          await updateDoc(pRef, {
            kullanilanIzin: Math.max(0, curKullanilan - targetReq.duration)
          });
        }
      }

      (window as any).showToast('Başarılı', 'Talep silindi ve bakiye güncellendi.', 'success');
      (window as any).navigate('leave-management');
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', err.message || 'Silme işlemi başarısız.', 'error');
    }
  };

  // Populate Admin Balance Form fields when personnel changes
  (window as any).onAdminBalanceUserChange = (name: string) => {
    if (!name) return;
    const pKey = name.toLowerCase().trim();
    const balance = personnelBalances[pKey] || {};
    
    // Fallback company mapping
    const pDetails = allPersonnelDetails.find(p => p.name.toLowerCase().trim() === pKey);
    let initialCompany = pDetails?.company || 'HAR FİLM YAPIM ENERJİ YATIRIM DANIŞMANLIK VE TİC. A.Ş.';
    if (initialCompany.toLowerCase() === 'demirer holding') {
      initialCompany = 'DEMİRER HOLDİNG A.Ş.';
    } else if (initialCompany.toLowerCase() === 'demirer enerji') {
      initialCompany = 'DEMİRER ENERJİ ÜRETİM SAN. VE TİC. A.Ş.';
    }

    const yillikHakInput = document.getElementById('balance-yillik-hak') as HTMLInputElement;
    const kullanilanInput = document.getElementById('balance-kullanilan') as HTMLInputElement;
    const companyInput = document.getElementById('balance-company') as HTMLInputElement;
    const tcInput = document.getElementById('balance-tc') as HTMLInputElement;
    const hireDateInput = document.getElementById('balance-hire-date') as HTMLInputElement;
    const jobTitleInput = document.getElementById('balance-job-title') as HTMLInputElement;
    const seniorityInput = document.getElementById('balance-seniority') as HTMLInputElement;

    // Standard fields
    if (kullanilanInput) kullanilanInput.value = (balance.kullanilanIzin !== undefined ? balance.kullanilanIzin : 0).toString();
    if (companyInput) companyInput.value = balance.company || initialCompany;
    if (tcInput) tcInput.value = balance.tc || '';
    if (hireDateInput) hireDateInput.value = balance.hireDate || '';
    if (jobTitleInput) jobTitleInput.value = balance.jobTitle || '';

    // Autocalculate if missing, otherwise use saved database values
    if (balance.hireDate) {
      const computedSeniority = calculateSeniorityHelper(balance.hireDate);
      if (seniorityInput) seniorityInput.value = balance.seniority || computedSeniority;
      if (yillikHakInput) yillikHakInput.value = (balance.yillikIzinHakki !== undefined ? balance.yillikIzinHakki : 0).toString();
    } else {
      if (seniorityInput) seniorityInput.value = balance.seniority || '';
      if (yillikHakInput) yillikHakInput.value = (balance.yillikIzinHakki !== undefined ? balance.yillikIzinHakki : 0).toString();
    }
  };

  // Admin directly updates personnel leave balance and profile cards
  (window as any).updateUserLeaveBalance = async (e: Event) => {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const targetName = (form.querySelector('#balance-user-select') as HTMLSelectElement).value;
    const newHakki = parseFloat((form.querySelector('#balance-yillik-hak') as HTMLInputElement).value);
    const newKullanilan = parseFloat((form.querySelector('#balance-kullanilan') as HTMLInputElement).value);
    const company = (form.querySelector('#balance-company') as HTMLInputElement).value.trim();
    const tc = (form.querySelector('#balance-tc') as HTMLInputElement).value.trim();
    const hireDate = (form.querySelector('#balance-hire-date') as HTMLInputElement).value;
    const jobTitle = (form.querySelector('#balance-job-title') as HTMLInputElement).value.trim();
    const seniority = (form.querySelector('#balance-seniority') as HTMLInputElement).value.trim();

    if (!targetName || isNaN(newHakki) || isNaN(newKullanilan)) {
      (window as any).showToast('Uyarı', 'Lütfen gerekli alanları doldurun.', 'warning');
      return;
    }

    try {
      const btn = form.querySelector('button[type="submit"]') as HTMLButtonElement;
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
      }

      const pKey = targetName.toLowerCase().trim();
      const pBal = personnelBalances[pKey];
      const pDetails = allPersonnelDetails.find(p => p.name.toLowerCase().trim() === pKey);

      const updateData = {
        name: targetName,
        yillikIzinHakki: newHakki,
        kullanilanIzin: newKullanilan,
        company,
        tc,
        hireDate,
        jobTitle,
        seniority,
        team: pDetails?.team || '',
        baseSites: pDetails?.baseSites || []
      };

      if (pBal && pBal.id) {
        const pRef = doc(db, 'personnel', pBal.id);
        await updateDoc(pRef, updateData);
      } else {
        await addDoc(collection(db, 'personnel'), {
          ...updateData,
          createdAt: new Date().toISOString()
        });
      }

      (window as any).showToast('Başarılı', `${targetName} kartı ve izni güncellendi.`, 'success');
      setTimeout(() => {
        (window as any).navigate('leave-management');
      }, 1000);
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', err.message || 'İşlem başarısız.', 'error');
    }
  };

  // Download Excel template containing current personnel list
  (window as any).downloadLeaveTemplate = () => {
    try {
      const excelData = allPersonnelDetails.map(p => {
        const pKey = p.name.toLowerCase().trim();
        const bal = personnelBalances[pKey] || {};
        
        const companyMapping: Record<string, string> = {
          'yek': 'YEK Demirer Enerji Yatırım Danışmanlık A.Ş.',
          'har film': 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.',
          'demirer enerji': 'Demirer Enerji Elektrik Üretim A.Ş.',
          'demirer holding': 'DEMİRER HOLDİNG A.Ş.'
        };

        const getFullCompanyName = (raw: string) => {
          const clean = (raw || '').toLowerCase().trim();
          for (const [key, full] of Object.entries(companyMapping)) {
            if (clean === key || clean.includes(key)) {
              return full;
            }
          }
          return raw || 'Har Film Yapım Enerji Yatırım Danışmanlık ve Tic. A.Ş.';
        };

        const hireDate = bal.hireDate || '';
        const computedSeniority = hireDate ? calculateSeniorityHelper(hireDate) : '';
        const computedEntitlement = 0;

        let hireDateFormatted = '';
        if (hireDate) {
          const dParts = hireDate.split('-');
          if (dParts.length === 3) {
            hireDateFormatted = `${dParts[2].padStart(2, '0')}.${dParts[1].padStart(2, '0')}.${dParts[0]}`;
          } else {
            hireDateFormatted = hireDate;
          }
        }

        return {
          'Adı Soyadı': p.name,
          'Şirket Bilgisi': getFullCompanyName(bal.company || p.company || ''),
          'TC Kimlik No': bal.tc || '',
          'İşe Giriş Tarihi (GG.AA.YYYY)': hireDateFormatted,
          'Görevi': bal.jobTitle || '',
          'Kıdemi (Otomatik Hesaplanır)': bal.seniority || computedSeniority
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Personel İzin Tanımları');
      XLSX.writeFile(workbook, 'DH_Servis_Personel_Izin_Sablonu.xlsx');
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', 'Şablon indirilirken bir hata oluştu: ' + err.message, 'error');
    }
  };

  // Export all processed leave requests to Excel
  (window as any).downloadProcessedLeavesExcel = () => {
    try {
      const rawReqs = ((window as any).allLeaveRequests || []);
      const excelData = rawReqs.map((req: any) => {
        let reqDateFormatted = '';
        if (req.requestedAt) {
          const date = req.requestedAt.seconds ? new Date(req.requestedAt.seconds * 1000) : new Date(req.requestedAt);
          reqDateFormatted = date.toLocaleDateString('tr-TR');
        }
        
        const typeMapLocal: Record<string, string> = {
          'YILLIK_IZIN': 'Yıllık İzin',
          'RAPOR': 'Sağlık Raporu',
          'MAZERET': 'Mazeret İzni',
          'UCRETSIZ': 'Ücretsiz İzin',
          'MESAI_IZNI': 'Mesai İzni',
          'EVLILIK_IZNI': 'Evlilik İzni',
          'DOGUM_IZNI': 'Doğum İzni'
        };

        const statusMapLocal: Record<string, string> = {
          'PENDING_FIRST': 'Ön Onay Bekliyor',
          'PENDING_FINAL': 'Son Onay Bekliyor',
          'APPROVED': 'Onaylandı',
          'REJECTED': 'Reddedildi'
        };

        let holidayDates = '';
        if (req.additionalDeductionDates && req.additionalDeductionDates.length > 0) {
          holidayDates = req.additionalDeductionDates.map((d: string) => {
            const parts = d.split('-');
            if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
            return d;
          }).join(', ');
        }

        return {
          'Personel Adı': req.userName || '',
          'E-Posta': req.userEmail || '',
          'Ekip': req.team || '',
          'Şirket': req.company || '',
          'İzin Türü': typeMapLocal[req.type] || req.type,
          'Başlangıç Tarihi': new Date(req.startDate).toLocaleDateString('tr-TR'),
          'Bitiş Tarihi': new Date(req.endDate).toLocaleDateString('tr-TR'),
          'Takvim Süresi (Gün)': req.calendarDays || req.duration,
          'Talep Edilen İzin (Gün)': req.requestedDays !== undefined ? req.requestedDays : (req.calendarDays || req.duration),
          'Toplam Bakiye Düşüşü (Gün)': req.duration,
          'Hafta Tatili / Yol İzni Tarihleri': holidayDates || '---',
          'Talep Durumu': statusMapLocal[req.status] || req.status,
          'Ön Onay Veren': req.firstApprovedBy || '---',
          'Son Onay Veren': req.finalApprovedBy || '---',
          'Talep Tarihi': reqDateFormatted,
          'Red Açıklaması': req.rejectReason || ''
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Tüm İzin Kayıtları');
      XLSX.writeFile(workbook, 'DH_Servis_Tüm_Izin_Kayitlari.xlsx');
      (window as any).showToast('Başarılı', 'İzin kayıtları Excel olarak indirildi.', 'success');
    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', 'İzinler indirilirken bir hata oluştu: ' + err.message, 'error');
    }
  };

  // Import personnel details and leave balances from uploaded Excel file
  (window as any).importLeaveFromExcel = async (event: any) => {
    const file = event.target.files[0];
    if (!file) return;

    const parseExcelNumber = (val: any): number => {
      if (val === undefined || val === null || val === '') return 0;
      if (typeof val === 'number') return val;
      const cleanStr = String(val).replace(/,/g, '.').trim();
      const parsed = parseFloat(cleanStr);
      return isNaN(parsed) ? 0 : parsed;
    };

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        (window as any).showToast('Uyarı', 'Seçilen dosya boş veya geçersiz formatta.', 'warning');
        return;
      }

      // Check for 'Adı Soyadı' column
      const firstRow = jsonData[0];
      if (!('Adı Soyadı' in firstRow)) {
        (window as any).showToast('Hata', 'Şablonda "Adı Soyadı" sütunu bulunamadı.', 'error');
        return;
      }

      const { writeBatch, collection, doc, getDocs } = await import('firebase/firestore');

      // Fetch all existing personnel documents in firestore
      const snap = await getDocs(collection(db, 'personnel'));
      const existingDocs: Record<string, string> = {};
      snap.forEach(d => {
        const name = d.data().name;
        if (name) {
          existingDocs[name.toLowerCase().trim()] = d.id;
        }
      });

      let batch = writeBatch(db);
      let count = 0;
      let batchCount = 0;

      for (const row of jsonData) {
        const name = row['Adı Soyadı'];
        if (!name) continue;

        const pKey = name.toLowerCase().trim();
        const existingBal = personnelBalances[pKey] || {};
        
        let yillikIzinHakki = row['Yıllık İzin Hakkı'] !== undefined 
          ? parseExcelNumber(row['Yıllık İzin Hakkı']) 
          : (existingBal.yillikIzinHakki !== undefined ? existingBal.yillikIzinHakki : 0);

        let kullanilanIzin = 0;
        if (row['Kalan Bakiye'] !== undefined || row['Güncel Bakiye'] !== undefined || row['Kalan İzin'] !== undefined || row['Kalan İzin Bakiye'] !== undefined) {
          const kalan = parseExcelNumber(row['Kalan Bakiye'] || row['Güncel Bakiye'] || row['Kalan İzin'] || row['Kalan İzin Bakiye']);
          kullanilanIzin = yillikIzinHakki - kalan;
        } else if (row['Kullanılan İzin'] !== undefined) {
          // Fatih confirmed that the "Kullanılan İzin" column in his Excel files actually holds the Remaining Balance (Kalan Bakiye)
          const kalan = parseExcelNumber(row['Kullanılan İzin']);
          kullanilanIzin = yillikIzinHakki - kalan;
        } else {
          kullanilanIzin = existingBal.kullanilanIzin !== undefined ? existingBal.kullanilanIzin : 0;
        }

        const company = row['Şirket Bilgisi'] || '';
        const tc = row['TC Kimlik No'] ? String(row['TC Kimlik No']).trim() : '';
        const rawDate = row['İşe Giriş Tarihi (GG.AA.YYYY)'];
        let hireDate = '';

        if (rawDate) {
          if (typeof rawDate === 'number') {
            const dateObj = XLSX.SSF.parse_date_code(rawDate);
            const m = String(dateObj.m).padStart(2, '0');
            const d = String(dateObj.d).padStart(2, '0');
            hireDate = `${dateObj.y}-${m}-${d}`;
          } else {
            const dateStr = String(rawDate).trim();
            if (dateStr.includes('.')) {
              const parts = dateStr.split('.');
              if (parts.length === 3) {
                hireDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              }
            } else if (dateStr.includes('-')) {
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                if (parts[0].length === 4) {
                  hireDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                } else if (parts[2].length === 4) {
                  hireDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
              }
            } else {
              hireDate = dateStr;
            }
          }
        }

        const jobTitle = row['Görevi'] || '';
        let seniority = row['Kıdemi (Otomatik Hesaplanır)'] || '';
        if (hireDate && !seniority) {
          seniority = calculateSeniorityHelper(hireDate);
        }

        const pDetails = allPersonnelDetails.find(p => p.name.toLowerCase().trim() === pKey);
        const updateData = {
          name,
          yillikIzinHakki,
          kullanilanIzin,
          company,
          tc,
          hireDate,
          jobTitle,
          seniority,
          team: pDetails?.team || '',
          baseSites: pDetails?.baseSites || []
        };

        const existingId = existingDocs[pKey];
        if (existingId) {
          const ref = doc(db, 'personnel', existingId);
          batch.set(ref, updateData, { merge: true });
        } else {
          const ref = doc(collection(db, 'personnel'));
          batch.set(ref, { ...updateData, createdAt: new Date().toISOString() });
        }

        count++;
        batchCount++;

        if (batchCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          batchCount = 0;
        }
      }

      if (batchCount > 0) {
        await batch.commit();
      }

      (window as any).showToast('Başarılı', `${count} personelin izin ve kart bilgisi başarıyla güncellendi.`, 'success');
      
      // Clear file input
      const fileInput = document.getElementById('leave-excel-upload-file') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

      setTimeout(() => {
        (window as any).navigate('leave-management');
      }, 1200);

    } catch (err: any) {
      console.error(err);
      (window as any).showToast('Hata', 'Dosya yüklenirken hata oluştu: ' + err.message, 'error');
    }
  };

  const typeMap: Record<string, string> = {
    'YILLIK_IZIN': 'Yıllık İzin',
    'RAPOR': 'Sağlık Raporu',
    'MAZERET': 'Mazeret İzni',
    'UCRETSIZ': 'Ücretsiz İzin',
    'MESAI_IZNI': 'Mesai İzni',
    'EVLILIK_IZNI': 'Evlilik İzni',
    'DOGUM_IZNI': 'Doğum İzni'
  };

  // Base layout wrapper builder
  const renderBaseLayout = () => {
    return `
      <div class="fade-in-up content-area">
        <!-- Glow background header effect -->
        <div style="position: absolute; top: 0px; left: 100px; width: 400px; height: 120px; background: radial-gradient(circle, rgba(0, 243, 255, 0.08) 0%, transparent 80%); pointer-events: none; z-index: 0; filter: blur(50px);"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.75rem; border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem; position: relative; z-index: 1;">
          <div style="display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap;">
            <h1 class="page-title" style="margin: 0; text-shadow: 0 0 15px rgba(0, 243, 255, 0.25); display: flex; align-items: center; gap: 10px; font-family: 'Rajdhani', sans-serif; font-weight: 800; letter-spacing: 0.5px;">
              <i class="fa-solid fa-calendar-check" style="color: var(--accent-cyan);"></i> İZİN YÖNETİM MERKEZİ
            </h1>

            <!-- Personnel selector removed from top header -->
          </div>
          
          <div id="leave-metrics-container" style="${currentTab === 'my-leaves' ? 'display: block;' : 'display: none;'}">
            <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
              <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(0, 242, 254, 0.18); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(0, 242, 254, 0.04); backdrop-filter: blur(10px);">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(0,242,254,0.15);"><i class="fa-solid fa-award"></i></div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Yıllık Hak</span>
                  <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">${yillikIzinHakki} Gün</span>
                </div>
              </div>
              <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(245, 158, 11, 0.18); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(245, 158, 11, 0.04); backdrop-filter: blur(10px);">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(245, 158, 11, 0.08); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(245,158,11,0.15);"><i class="fa-solid fa-umbrella-beach"></i></div>
                <div style="display: flex; flex-direction: column;">
                  <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Kullanılan</span>
                  <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">${kullanilanIzin} Gün</span>
                </div>
              </div>
              <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 12px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.04); backdrop-filter: blur(10px); min-width: 150px;">
                <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(16,185,129,0.15);"><i class="fa-solid fa-hourglass-start"></i></div>
                <div style="display: flex; flex-direction: column; flex-grow: 1; gap: 3px;">
                  <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Kalan Bakiye</span>
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                    <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #10b981; font-size: 1.05rem; letter-spacing: 0.5px;">${kalanIzin} Gün</span>
                    <span style="font-size: 0.65rem; color: var(--text-muted); font-family: 'Rajdhani', sans-serif;">%${Math.round(balancePct)}</span>
                  </div>
                  <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;">
                    <div style="width: ${balancePct}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 100%); box-shadow: 0 0 5px rgba(16,185,129,0.5);"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.75rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; flex-wrap: wrap; position: relative; z-index: 1;">
          <button onclick="window.switchLeaveTab('my-leaves')" class="cyber-tab ${currentTab === 'my-leaves' ? 'active' : ''}" style="height: 36px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.5px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-transform: uppercase;">
            <i class="fa-solid fa-calendar-minus"></i> İZNLERİM & TALEP FORMU
          </button>
          ${canApprove ? `
            <button onclick="window.switchLeaveTab('approvals')" class="cyber-tab ${currentTab === 'approvals' ? 'active' : ''}" style="height: 36px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.5px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-transform: uppercase;">
              <i class="fa-solid fa-user-check"></i> İZİN ONAYLARI
            </button>
          ` : ''}
          ${(isAdmin || isFurkan) ? `
            <button onclick="window.switchLeaveTab('balance-admin')" class="cyber-tab ${currentTab === 'balance-admin' ? 'active' : ''}" style="height: 36px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.5px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-transform: uppercase;">
              <i class="fa-solid fa-users-cog"></i> BAKİYE TANIMLAMA (İK)
            </button>
            <button onclick="window.switchLeaveTab('health-reports')" class="cyber-tab ${currentTab === 'health-reports' ? 'active' : ''}" style="height: 36px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.5px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-transform: uppercase;">
              <i class="fa-solid fa-file-medical"></i> SAĞLIK RAPORLARI (İK)
            </button>
          ` : ''}
          <button onclick="window.switchLeaveTab('calendar')" class="cyber-tab ${currentTab === 'calendar' ? 'active' : ''}" style="height: 36px; font-weight: bold; font-size: 0.75rem; letter-spacing: 0.5px; border-radius: 6px; display: flex; align-items: center; gap: 6px; cursor: pointer; font-family: 'Rajdhani', sans-serif; text-transform: uppercase;">
            <i class="fa-solid fa-calendar-days"></i> İZİN PROGRAMI (TAKVİM)
          </button>
        </div>

        <!-- Main Dynamic Content Panel -->
        <div id="leave-main-content" style="position: relative; z-index: 1;">
          ${getActiveTabContent()}
        </div>

        <style>
          .cyber-tab {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.08);
            color: var(--text-muted);
            padding: 0 16px;
            transition: all 0.25s ease;
          }
          .cyber-tab:hover {
            color: #fff;
            background: rgba(0, 243, 255, 0.06);
            border-color: rgba(0, 243, 255, 0.2);
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
          }
          .cyber-tab.active {
            color: #000;
            background: var(--accent-cyan);
            border-color: var(--accent-cyan);
            box-shadow: 0 0 15px rgba(0, 243, 255, 0.35);
          }
          .cyber-row:hover {
            background: rgba(0, 243, 255, 0.025) !important;
          }
          .cyber-input:focus {
            border-color: var(--accent-cyan) !important;
            box-shadow: 0 0 10px rgba(0, 243, 255, 0.2) !important;
          }
          .cancel-btn:hover {
            color: #ff0044 !important;
            text-shadow: 0 0 10px rgba(255,0,68,0.5) !important;
          }
        </style>
      </div>
    `;
  };

  // Render My Leaves Tab Layout
  const renderMyLeavesTab = () => {
    const personalReqs = filteredRequests.filter(r => r.userName.toLowerCase().trim() === selectedBalanceKey);

    const listHtml = personalReqs.map((req: any) => {
      const statusBadge = getLeaveStatusBadge(req);

      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
          <td style="padding: 14px 12px; color: var(--text-muted); font-weight: 600; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${new Date(req.startDate).toLocaleDateString('tr-TR')} - ${new Date(req.endDate).toLocaleDateString('tr-TR')}</td>
          <td style="padding: 14px 12px; font-weight: 700; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.calendarDays || req.duration} Gün</td>
          <td style="padding: 14px 12px; font-weight: bold; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.duration} Gün</td>
          <td style="padding: 14px 12px; font-weight: 700; color: var(--accent-cyan); font-size: 0.75rem; text-align: center;">
            ${typeMap[req.type] || req.type}
            ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
              <div style="font-size: 0.65rem; color: #fbbf24; margin-top: 4px; font-weight: bold; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-calendar-day"></i> Hafta Tatili / Yol İzni: 
                ${req.additionalDeductionDates.map((d: string) => {
                  const parts = d.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                  return d;
                }).join(', ')}
              </div>
            ` : ''}
            ${req.reportUrl ? `
              <br><a href="${req.reportUrl}" target="_blank" style="color: #fbbf24; text-decoration: underline; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; justify-content: center;"><i class="fa-solid fa-file-medical"></i> Raporu Gör</a>
            ` : ''}
          </td>
          <td style="padding: 14px 12px; color: var(--text-main); font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;" title="${req.description}">${req.description}</td>
          <td style="padding: 14px 12px; text-align: center;">${statusBadge}</td>
          <td style="padding: 14px 12px; text-align: center; vertical-align: middle;">
            <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
              ${req.status === 'APPROVED' && req.type !== 'RAPOR' ? `
                <button onclick="window.openLeavePrintModal('${req.id}')" class="btn-cyber" style="background: rgba(0, 243, 255, 0.05); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; font-family: 'Rajdhani', sans-serif;" title="İzin Formunu Yazdır">
                  <i class="fa-solid fa-print"></i> Form
                </button>
              ` : ''}
              ${(req.status === 'PENDING_FIRST' || canApprove) ? `
                <button onclick="window.cancelLeaveRequest('${req.id}')" class="cancel-btn" style="background: none; border: none; color: #ff3366; cursor: pointer; font-size: 1rem; transition: all 0.2s; text-shadow: 0 0 5px rgba(255,51,102,0.25); display: inline-flex; align-items: center;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="İptal Et / Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : (req.status !== 'APPROVED' ? '---' : '')}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="display: grid; grid-template-columns: 1.1fr 1.9fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Left Side: Request Form -->
        <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-top: 3px solid var(--accent-cyan); border-radius: 12px; height: fit-content; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.5rem;">
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-file-signature"></i> YENİ İZİN TALEBİ GİRİŞİ
            </h3>
            <div id="leave-personnel-selector-container">
              ${(currentTab === 'my-leaves' && filteredPersonnel.length > 1) ? `
                <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0, 243, 255, 0.04); border: 1px solid rgba(0, 243, 255, 0.15); padding: 4px 12px; border-radius: 8px; box-shadow: inset 0 0 8px rgba(0,243,255,0.05);">
                  <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Personel:</span>
                  <select onchange="window.selectLeavePersonnel(this.value)" class="cyber-input" style="height: 28px; font-size: 0.8rem; background: transparent; border: none; color: #fff; font-weight: 800; cursor: pointer; padding-right: 1.5rem; outline: none; font-family: 'Rajdhani', sans-serif;">
                    <option value="" disabled ${selectedName === '' ? 'selected' : ''} style="background: #0d121e; color: var(--text-muted);">Personel Seçiniz</option>
                    ${filteredPersonnel.map(p => `
                      <option value="${p.name}" ${p.name === selectedName ? 'selected' : ''} style="background: #0d121e; color: #fff;">${p.name}</option>
                    `).join('')}
                  </select>
                </div>
              ` : ''}
            </div>
          </div>
          <form onsubmit="window.submitLeaveRequest(event)" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">BAŞLANGIÇ TARİHİ *</label>
              <input type="date" id="leave-start-date" class="cyber-input" required style="width: 100%; height: 40px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none; transition: border-color 0.2s;" onchange="window.onLeaveDateChange()">
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">BİTİŞ TARİHİ *</label>
              <input type="date" id="leave-end-date" class="cyber-input" required style="width: 100%; height: 40px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none; transition: border-color 0.2s;" onchange="window.onLeaveDateChange()">
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">İZİN SÜRESİ (GÜN) *</label>
              <input type="number" id="leave-duration-input" class="cyber-input" required min="0.5" step="0.5" style="width: 100%; height: 40px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none; transition: border-color 0.2s;" oninput="window.updateLeaveDurationPreview()">
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">İZİN TÜRÜ SEÇİMİ *</label>
              <select id="leave-type" class="cyber-input" required style="width: 100%; height: 40px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none; transition: border-color 0.2s;" onchange="window.updateLeaveDurationPreview()">
                <option value="YILLIK_IZIN" style="background: #0d121e; color: #fff;">Yıllık İzin (Ücretli)</option>
                <option value="RAPOR" style="background: #0d121e; color: #fff;">Sağlık Raporu</option>
                <option value="MAZERET" style="background: #0d121e; color: #fff;">Mazeret İzni</option>
                <option value="UCRETSIZ" style="background: #0d121e; color: #fff;">Ücretsiz İzin</option>
                <option value="MESAI_IZNI" style="background: #0d121e; color: #fff;">Mesai İzni</option>
                <option value="EVLILIK_IZNI" style="background: #0d121e; color: #fff;">Evlilik İzni</option>
                <option value="DOGUM_IZNI" style="background: #0d121e; color: #fff;">Doğum İzni</option>
              </select>
            </div>
            
            <!-- Health report file upload container -->
            <div id="leave-report-upload-container" style="display: none; flex-direction: column; gap: 0.4rem;">
              <label style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">SAĞLIK RAPORU EKLE *</label>
              <div class="cyber-file-upload" style="position: relative; width: 100%; height: 42px; border: 1px dashed rgba(0, 243, 255, 0.3); border-radius: 6px; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;">
                <input type="file" id="leave-report-file" accept=".pdf,.png,.jpg,.jpeg" style="position: absolute; width: 100%; height: 100%; opacity: 0; cursor: pointer;" onchange="window.onLeaveReportFileSelect(this)">
                <span id="leave-report-file-label" style="font-size: 0.75rem; color: var(--accent-cyan); font-weight: 800; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-cloud-arrow-up"></i> Dosya Seçin (.pdf, .png, .jpg)
                </span>
              </div>
            </div>

            <div id="leave-calculation-preview" style="display: none; padding: 12px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.15); background: rgba(0, 243, 255, 0.05); margin: 0.25rem 0;"></div>

            <div id="leave-additional-dates-container" style="display: none; flex-direction: column; gap: 0.75rem; margin: 0.5rem 0; padding: 12px; border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 6px; background: rgba(251, 191, 36, 0.03);"></div>

            <div id="leave-description-container" style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label id="leave-description-label" style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">İZİN AÇIKLAMASI / ADRESİ *</label>
              <textarea id="leave-description" class="cyber-input" rows="3" required style="width: 100%; box-sizing: border-box; resize: vertical; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none; transition: border-color 0.2s; font-size: 0.75rem;"></textarea>
            </div>
            <button type="submit" class="btn-cyber" style="width: 100%; height: 42px; font-weight: bold; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px; justify-content: center; display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 0.5rem; background: rgba(0,243,255,0.06); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); box-shadow: 0 0 10px rgba(0,243,255,0.1); border-radius: 6px; text-shadow: 0 0 5px rgba(0,243,255,0.3); transition: all 0.2s;" onmouseover="this.style.background='var(--accent-cyan)'; this.style.color='#000'; this.style.boxShadow='0 0 20px rgba(0,243,255,0.35)';" onmouseout="this.style.background='rgba(0,243,255,0.06)'; this.style.color='var(--accent-cyan)'; this.style.boxShadow='0 0 10px rgba(0,243,255,0.1)';">
              <i class="fa-solid fa-paper-plane"></i> TALEBİ GÖNDER
            </button>
          </form>
        </div>

        <!-- Right Side: Past Leave Requests -->
        <div id="leave-history-table-container" class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35); overflow-x: auto; display: flex; flex-direction: column; justify-content: flex-start;">
          <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
            <i class="fa-solid fa-clock-rotate-left"></i> GEÇMİŞ İZİN HAREKETLERİ LİSTESİ
          </h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; min-width: 500px;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px;">
                <th style="padding: 12px 10px; text-align: center;">İzin Tarihleri</th>
                <th style="padding: 12px 10px; text-align: center;">Takvim Süresi</th>
                <th style="padding: 12px 10px; text-align: center;">Düşüş (Bakiye)</th>
                <th style="padding: 12px 10px; text-align: center;">İzin Türü</th>
                <th style="padding: 12px 10px; text-align: center;">Gerekçe / Detay</th>
                <th style="padding: 12px 10px; text-align: center;">Onay Durumu</th>
                <th style="padding: 12px 10px; text-align: center; width: 80px;">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              ${(() => {
                if (!selectedName) {
                  return `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-user-slash" style="font-size: 1.5rem; display: block; margin-bottom: 10px; color: rgba(255,255,255,0.15);"></i>Lütfen işlem yapmak ve geçmiş izin hareketlerini görüntülemek için personel seçiniz.</td></tr>`;
                }
                return listHtml || `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-umbrella-beach" style="font-size: 1.5rem; display: block; margin-bottom: 10px; color: rgba(255,255,255,0.15);"></i>Seçilen personel için henüz hiçbir izin talebi bulunmuyor.</td></tr>`;
              })()}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // Render Admin Approvals Layout
  const renderAdminApprovalsTab = () => {
    let visibleApprovals = filteredRequests;
    
    if (userEmail === 'emre.aydogdu@demirerholding.com') {
      visibleApprovals = filteredRequests.filter(r => r.status === 'PENDING_FINAL');
    } else if (userEmail === 'furkan.yildirim@demirerholding.com' || userEmail === 'fatih.zebek@demirerholding.com' || isAdmin) {
      visibleApprovals = filteredRequests.filter(r => r.status === 'PENDING_FIRST');
    } else {
      visibleApprovals = [];
    }
    
    const pendingHtml = visibleApprovals.map((req: any) => {
      let approvalActionBtn = '';
      // Calculate deltaE for this request on the fly
      let deltaE = 0;
      if (req.type === 'YILLIK_IZIN') {
        const requestMonth = req.startDate.substring(0, 7);
        const currentMonthLeaves = requests.filter((r: any) => 
          r.userName.toLowerCase().trim() === req.userName.toLowerCase().trim() &&
          r.type === 'YILLIK_IZIN' &&
          (r.status === 'APPROVED' || r.status === 'PENDING_FIRST' || r.status === 'PENDING_FINAL') &&
          r.startDate.startsWith(requestMonth) &&
          r.id !== req.id
        );
        const totalUsedCalendarDays = currentMonthLeaves.reduce((acc: number, r: any) => acc + (r.calendarDays || r.duration), 0);
        const u = totalUsedCalendarDays;
        const r = req.requestedDays !== undefined ? req.requestedDays : (req.calendarDays || req.duration);
        const eOld = Math.floor(u / 5);
        const eNew = Math.floor((u + r) / 5);
        deltaE = eNew - eOld;
      }

      if (req.status === 'PENDING_FIRST') {
        approvalActionBtn = `
          <button onclick="window.processLeaveRequestWithDates('${req.id}', 'PENDING_FINAL')" class="btn-cyber" style="background: rgba(16,185,129,0.06); border: 1px solid #10b981; color: #10b981; font-size: 0.65rem; width: 130px; height: 28px; border-radius: 4px; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; transition: all 0.2s;" onmouseover="this.style.background='#10b981'; this.style.color='#000'; this.style.boxShadow='0 0 10px rgba(16,185,129,0.2)';" onmouseout="this.style.background='rgba(16,185,129,0.06)'; this.style.color='#10b981'; this.style.boxShadow='none';">
            <i class="fa-solid fa-circle-check"></i> ÖN-ONAY VER
          </button>
        `;
      } else if (req.status === 'PENDING_FINAL') {
        approvalActionBtn = `
          <button onclick="window.processLeaveRequest('${req.id}', 'APPROVED')" class="btn-cyber" style="background: rgba(0, 243, 255, 0.06); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-size: 0.65rem; width: 130px; height: 28px; border-radius: 4px; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; transition: all 0.2s;" onmouseover="this.style.background='var(--accent-cyan)'; this.style.color='#000'; this.style.boxShadow='0 0 10px rgba(0, 243, 255, 0.2)';" onmouseout="this.style.background='rgba(0, 243, 255, 0.06)'; this.style.color='var(--accent-cyan)'; this.style.boxShadow='none';">
            <i class="fa-solid fa-check-double"></i> SON ONAY VER
          </button>
        `;
      }

      return `
        <div class="glass-panel" style="padding: 1.25rem; border: 1px solid rgba(251,191,36,0.25); border-radius: 12px; background: rgba(13,18,30,0.55); display: flex; flex-direction: column; gap: 1rem; position: relative; box-shadow: 0 4px 20px rgba(0,0,0,0.25);">
          <!-- Top section -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.75rem;">
            <div>
              <h4 style="margin: 0; font-size: 0.95rem; color: #fff; font-family: 'Rajdhani', sans-serif; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">
                ${req.userName}
              </h4>
              <span style="font-size: 0.7rem; color: var(--accent-cyan); font-weight: bold; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">EKİP: ${req.team || '---'}</span>
            </div>
            <div style="text-align: right; display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
              <span style="background: rgba(251,191,36,0.1); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3); padding: 3px 10px; border-radius: 6px; font-weight: 800; font-size: 0.65rem; display: inline-flex; align-items: center; font-family: 'Rajdhani', sans-serif;">
                ${typeMap[req.type] || req.type}
              </span>
              <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.3px; text-transform: uppercase;">
                ${req.status === 'PENDING_FIRST' ? 'ÖN-ONAY BEKLİYOR' : 'SON ONAY BEKLİYOR'}
              </span>
            </div>
          </div>

          <!-- Mid section -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.8rem; color: var(--text-main);">
            <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.03); padding-bottom: 0.5rem;">
              <div><strong>Başlangıç:</strong> <span style="color:#fff;">${new Date(req.startDate).toLocaleDateString('tr-TR')}</span></div>
              <div><strong>Bitiş:</strong> <span style="color:#fff;">${new Date(req.endDate).toLocaleDateString('tr-TR')}</span></div>
              <div><strong>Takvim Süresi:</strong> <span style="color:#fff;">${req.calendarDays || req.duration} Gün</span></div>
              <div><strong>Talep Edilen Gün:</strong> <span style="color:#fff;">${req.requestedDays !== undefined ? req.requestedDays : (req.calendarDays || req.duration)} Gün</span></div>
              <div style="grid-column: span 2;"><strong>Bakiye Düşüşü (Son):</strong> <span style="color: var(--accent-cyan); font-weight: bold;">${req.duration} Gün</span></div>
              ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
                <div style="grid-column: span 2; font-size: 0.72rem; color: #fbbf24; font-weight: bold; margin-top: 4px; display: flex; align-items: center; gap: 4px; font-family: 'Rajdhani', sans-serif;">
                  <i class="fa-solid fa-calendar-day"></i> Hafta Tatili / Yol İzni Tarihi: 
                  ${req.additionalDeductionDates.map((d: string) => {
                    const parts = d.split('-');
                    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                    return d;
                  }).join(', ')}
                </div>
              ` : ''}
              ${req.status === 'PENDING_FINAL' ? `
                <div style="grid-column: span 2; font-size: 0.72rem; color: #10b981; font-weight: bold; margin-top: 4px;">
                  <i class="fa-solid fa-user-check"></i> Ön Onay Veren: ${req.firstApprovedBy || '---'}
                </div>
              ` : ''}
            </div>
            ${(req.requestedDays !== undefined && req.calendarDays !== req.requestedDays) 
              ? `<div style="background: rgba(251, 191, 36, 0.08); border: 1px dashed rgba(251, 191, 36, 0.4); color: #fbbf24; padding: 6px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; display: flex; align-items: center; gap: 6px; margin-top: 4px; font-family: 'Rajdhani', sans-serif;">
                  <i class="fa-solid fa-triangle-exclamation fa-beat"></i> DİKKAT: Tarih aralığından (${req.calendarDays} Gün) farklı bir izin süresi (${req.requestedDays} Gün) girildi!
                 </div>`
              : ''
            }
            <div style="background: rgba(0,0,0,0.25); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.03); font-style: italic; font-size: 0.75rem; color: var(--text-muted); line-height: 1.4; margin-top: 4px;">
              "${req.description}"
            </div>
            ${req.reportUrl ? `
              <div style="margin-top: 8px; margin-bottom: 4px;">
                <a href="${req.reportUrl}" target="_blank" class="btn-cyber" style="background: rgba(251,191,36,0.08); border: 1px solid #fbbf24; color: #fbbf24; padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; font-weight: bold; font-family: 'Rajdhani', sans-serif;">
                  <i class="fa-solid fa-file-medical"></i> Sağlık Raporunu Görüntüle
                </a>
              </div>
            ` : ''}
            ${(() => {
              if (req.status === 'PENDING_FIRST' && req.type === 'YILLIK_IZIN') {
                let selectorsHtml = `
                  <div style="margin-top: 0.75rem; padding: 10px; border: 1px dashed rgba(251, 191, 36, 0.4); border-radius: 8px; background: rgba(251, 191, 36, 0.02); display: flex; flex-direction: column; gap: 8px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                      <span style="font-size: 0.72rem; color: #fbbf24; font-weight: bold; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 4px;">
                        <i class="fa-solid fa-circle-info fa-beat"></i> Ek Kesinti (Hafta Tatili / Yol İzni):
                      </span>
                      <select id="leave-approve-delta-select-${req.id}" class="cyber-input" style="height: 26px; font-size: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(0, 243, 255, 0.3); border-radius: 4px; color: #fff; width: 110px;" onchange="window.onApproveDeltaChange('${req.id}', this.value)">
                        <option value="0" ${deltaE === 0 ? 'selected' : ''}>Uygulama (0)</option>
                        <option value="1" ${deltaE === 1 ? 'selected' : ''}>+1 Gün Kes</option>
                        <option value="2" ${deltaE === 2 ? 'selected' : ''}>+2 Gün Kes</option>
                        <option value="3" ${deltaE === 3 ? 'selected' : ''}>+3 Gün Kes</option>
                        <option value="4" ${deltaE === 4 ? 'selected' : ''}>+4 Gün Kes</option>
                        <option value="5" ${deltaE === 5 ? 'selected' : ''}>+5 Gün Kes</option>
                      </select>
                    </div>
                    
                    <div id="leave-approve-dates-container-${req.id}" style="display: ${deltaE > 0 ? 'flex' : 'none'}; flex-direction: column; gap: 6px;">
                `;

                if (deltaE > 0) {
                  for (let i = 0; i < deltaE; i++) {
                    selectorsHtml += `
                      <div style="display: flex; flex-direction: column; gap: 3px; text-align: left;">
                        <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; font-family: 'Rajdhani', sans-serif;">+${i + 1}. HAFTA TATİLİ / YOL İZNİ TARİHİ *</span>
                        <input type="date" id="leave-approve-date-${req.id}-${i}" class="cyber-input" style="height: 28px; font-size: 0.8rem; font-family: 'Rajdhani', sans-serif; background: rgba(0,0,0,0.25); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 4px; color: #fff; padding: 0 8px; outline: none; width: 100%; box-sizing: border-box;">
                      </div>
                    `;
                  }
                }

                selectorsHtml += `
                    </div>
                  </div>
                `;
                return selectorsHtml;
              }
              return '';
            })()}
          </div>

          <!-- Bottom Actions -->
          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
            <button onclick="window.processLeaveRequest('${req.id}', 'REJECTED')" class="btn-cyber" style="background: rgba(239,68,68,0.06); border: 1px solid #ef4444; color: #ef4444; font-size: 0.65rem; width: 130px; height: 28px; border-radius: 4px; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; justify-content: center; gap: 4px; font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 0.5px; white-space: nowrap; transition: all 0.2s;" onmouseover="this.style.background='#ef4444'; this.style.color='#000'; this.style.boxShadow='0 0 10px rgba(239,68,68,0.2)';" onmouseout="this.style.background='rgba(239,68,68,0.06)'; this.style.color='#ef4444'; this.style.boxShadow='none';">
              <i class="fa-solid fa-xmark"></i> REDDET
            </button>
            ${approvalActionBtn}
          </div>
        </div>
      `;
    }).join('');

    const approvedListHtml = approvedRequests.slice(0, 15).map(req => {
      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
          <td style="padding: 12px 10px; font-weight: 700; color: #fff; text-align: center;">${req.userName}</td>
          <td style="padding: 12px 10px; color: var(--text-muted); font-family: 'Rajdhani', sans-serif; text-align: center;">${new Date(req.startDate).toLocaleDateString('tr-TR')} - ${new Date(req.endDate).toLocaleDateString('tr-TR')}</td>
          <td style="padding: 12px 10px; font-weight: bold; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.duration} Gün</td>
          <td style="padding: 12px 10px; font-size: 0.75rem; font-weight: bold; color: var(--text-muted); text-align: center;">
            ${typeMap[req.type] || req.type}
            ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
              <div style="font-size: 0.65rem; color: #fbbf24; margin-top: 4px; font-weight: bold;">
                Hafta Tatili / Yol İzni: ${req.additionalDeductionDates.map((d: string) => {
                  const parts = d.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                  return d;
                }).join(', ')}
              </div>
            ` : ''}
            ${req.reportUrl ? `
              <br><a href="${req.reportUrl}" target="_blank" style="color: #fbbf24; text-decoration: underline; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; margin-top: 2px; justify-content: center;"><i class="fa-solid fa-file-medical"></i> Raporu Gör</a>
            ` : ''}
          </td>
          <td style="padding: 12px 10px; font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--text-muted); text-align: center;" title="${req.description}">${req.description}</td>
          <td style="padding: 12px 10px; text-align: center; vertical-align: middle;">
            <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: center; width: 100%;">
              ${req.type !== 'RAPOR' ? `
                <button onclick="window.openLeavePrintModal('${req.id}')" class="btn-cyber" style="background: rgba(0, 243, 255, 0.05); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 4px 8px; border-radius: 4px; font-size: 0.65rem; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; font-family: 'Rajdhani', sans-serif;">
                  <i class="fa-solid fa-print"></i> Form
                </button>
              ` : ''}
              ${canApprove ? `
                <button onclick="window.cancelLeaveRequest('${req.id}')" class="cancel-btn" style="background: none; border: none; color: #ff3366; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; display: inline-flex; align-items: center;" title="İptal Et / Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    const pendingFinalRequests = filteredRequests.filter(r => r.status === 'PENDING_FINAL');
    const pendingFinalHtml = pendingFinalRequests.map(req => {
      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
          <td style="padding: 12px 10px; font-weight: 700; color: #fff; text-align: center;">${req.userName}</td>
          <td style="padding: 12px 10px; color: var(--text-muted); font-family: 'Rajdhani', sans-serif; text-align: center;">
            ${new Date(req.startDate).toLocaleDateString('tr-TR')} - ${new Date(req.endDate).toLocaleDateString('tr-TR')}
            ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
              <div style="font-size: 0.65rem; color: #fbbf24; margin-top: 4px; font-weight: bold;">
                (Hafta Tatili / Yol İzni: ${req.additionalDeductionDates.map((d: string) => {
                  const parts = d.split('-');
                  if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                  return d;
                }).join(', ')})
              </div>
            ` : ''}
          </td>
          <td style="padding: 12px 10px; font-weight: bold; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.duration} Gün</td>
          <td style="padding: 12px 10px; font-size: 0.72rem; color: #10b981; font-weight: 800; text-align: center;">
            ${req.firstApprovedBy || '---'}
          </td>
          <td style="padding: 12px 10px; text-align: center; vertical-align: middle;">
            <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: center; width: 100%;">
              ${canApprove ? `
                <button onclick="window.cancelLeaveRequest('${req.id}')" class="cancel-btn" style="background: none; border: none; color: #ff3366; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; display: inline-flex; align-items: center;" title="Sil / İptal Et">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');

    return `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Left Side: Pending Requests -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <h3 style="margin-top: 0; margin-bottom: 0.5rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: #fbbf24; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
            <i class="fa-solid fa-hourglass-half"></i> ONAY LİSTEMDE BEKLEYEN TALEPLER
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1rem; max-height: 550px; overflow-y: auto; padding-right: 0.5rem;">
            ${pendingHtml || `<div class="glass-panel" style="padding: 3rem; text-align: center; color: var(--text-muted); border: 1px dashed rgba(255,255,255,0.06); font-style: italic; border-radius:12px; background: rgba(13,18,30,0.3);"><i class="fa-solid fa-shield-halved" style="font-size: 1.5rem; display: block; margin-bottom: 10px; color: rgba(255,255,255,0.15);"></i>Şu an onayınızı bekleyen herhangi bir aktif talep bulunmamaktadır.</div>`}
          </div>
        </div>

        <!-- Right Side: Pending Final and Recently Approved Leaves -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Son Onay Bekleyenler (Emre Aydoğdu'da bekleyenler) -->
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35); overflow-x: auto; height: fit-content;">
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-user-clock"></i> SON ONAY BEKLEYEN TALEPLER (EMRE AYDOĞDU)
            </h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.75rem;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase;">
                  <th style="padding: 10px 10px; text-align: center;">Personel</th>
                  <th style="padding: 10px 10px; text-align: center;">İzin Tarihleri</th>
                  <th style="padding: 10px 10px; text-align: center;">Düşüş</th>
                  <th style="padding: 10px 10px; text-align: center;">Ön Onaylayan</th>
                  <th style="padding: 10px 10px; text-align: center;">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                ${pendingFinalHtml || `<tr><td colspan="5" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">Şu an Emre Aydoğdu'nun onayını bekleyen bir talep bulunmuyor.</td></tr>`}
              </tbody>
            </table>
          </div>

          <!-- Son Onaylanan İzin Kayıtları -->
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35); overflow-x: auto; height: fit-content;">
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-circle-check"></i> SON ONAYLANAN İZİN KAYITLARI (SİSTEM)
            </h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.75rem;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase;">
                  <th style="padding: 10px 10px; text-align: center;">Personel</th>
                  <th style="padding: 10px 10px; text-align: center;">İzin Tarihleri</th>
                  <th style="padding: 10px 10px; text-align: center;">Düşüş</th>
                  <th style="padding: 10px 10px; text-align: center;">Tür</th>
                  <th style="padding: 10px 10px; text-align: center;">Gerekçe</th>
                  <th style="padding: 10px 10px; text-align: center;">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                ${approvedListHtml || `<tr><td colspan="6" style="padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic;">Henüz onaylanmış herhangi bir izin bulunmuyor.</td></tr>`}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  // Render Admin Balance Definition tab
  const renderBalanceAdminTab = () => {
    const userOptions = allPersonnelDetails.map(p => {
      const teamInfo = p.team ? ` [${p.team}]` : '';
      return `<option value="${p.name}" style="background: #0d121e; color: #fff;">${p.name}${teamInfo}</option>`;
    }).join('');

    const sortedPersonnel = [...allPersonnelDetails].sort((a, b) => {
      const balanceA = personnelBalances[a.name.toLowerCase().trim()] || {};
      const yHakA = balanceA.yillikIzinHakki !== undefined ? balanceA.yillikIzinHakki : 0;
      const yKulA = balanceA.kullanilanIzin !== undefined ? balanceA.kullanilanIzin : 0;
      const yKalA = yHakA - yKulA;

      const balanceB = personnelBalances[b.name.toLowerCase().trim()] || {};
      const yHakB = balanceB.yillikIzinHakki !== undefined ? balanceB.yillikIzinHakki : 0;
      const yKulB = balanceB.kullanilanIzin !== undefined ? balanceB.kullanilanIzin : 0;
      const yKalB = yHakB - yKulB;

      return yKalA - yKalB;
    });

    const balancesTableHtml = sortedPersonnel.map(p => {
      const balance = personnelBalances[p.name.toLowerCase().trim()] || {};
      const yHak = balance.yillikIzinHakki !== undefined ? balance.yillikIzinHakki : 0;
      const yKul = balance.kullanilanIzin !== undefined ? balance.kullanilanIzin : 0;
      const yKal = yHak - yKul;

      const kalanColor = yKal < 0 ? '#ef4444' : '#10b981';

      const rawDate = balance.hireDate || '';
      let hireDateFormatted = '---';
      if (rawDate) {
        const dParts = rawDate.split('-');
        if (dParts.length === 3) {
          hireDateFormatted = `${dParts[2].padStart(2, '0')}.${dParts[1].padStart(2, '0')}.${dParts[0]}`;
        } else {
          hireDateFormatted = rawDate;
        }
      }

      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
          <td style="padding: 10px 10px; font-weight: 700; color: #fff;">${p.name}</td>
          <td style="padding: 10px 10px; color: var(--text-muted); font-size: 0.75rem; font-weight: bold;">${p.team || '---'}</td>
          <td style="padding: 10px 10px; color: var(--text-muted); font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${balance.company || '---'}</td>
          <td style="padding: 10px 10px; color: var(--text-muted); font-size: 0.75rem; font-weight: bold;">${hireDateFormatted}</td>
          <td style="padding: 10px 10px; color: ${kalanColor}; font-weight: bold; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem;">${yKal} Gün</td>
        </tr>
      `;
    }).join('');

    return `
      <div style="display: grid; grid-template-columns: 1fr 2.2fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Left Side: Manual definition form -->
        <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-top: 3px solid var(--accent-cyan); border-radius: 12px; height: fit-content; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35);">
          <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
            <i class="fa-solid fa-user-pen"></i> PERSONEL KARTI VE İZİN TANIMLAMA
          </h3>
          <form onsubmit="window.updateUserLeaveBalance(event)" style="display: flex; flex-direction: column; gap: 0.75rem;">
            
            <div style="display: flex; flex-direction: column; gap: 0.3rem;">
              <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">PERSONEL SEÇİN *</label>
              <select id="balance-user-select" class="cyber-input" required onchange="window.onAdminBalanceUserChange(this.value)" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
                <option value="">Seçin...</option>
                ${userOptions}
              </select>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">YILLIK İZİN HAKKI *</label>
                <input type="number" id="balance-yillik-hak" class="cyber-input" required min="0" step="0.5" value="14" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">KULLANILAN İZİN *</label>
                <input type="number" id="balance-kullanilan" class="cyber-input" required min="0" step="0.5" value="0" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
              </div>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.3rem;">
              <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">ŞİRKET BİLGİSİ</label>
              <input type="text" id="balance-company" class="cyber-input" placeholder="Şirket Adı" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1.1;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">TC KİMLİK NO</label>
                <input type="text" id="balance-tc" class="cyber-input" maxlength="11" placeholder="TC" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 0.9;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">İŞE GİRİŞ</label>
                <input type="date" id="balance-hire-date" class="cyber-input" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;" onchange="window.onHireDateChange(this.value)">
              </div>
            </div>

            <div style="display: flex; gap: 0.75rem;">
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 1.2;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">GÖREVİ</label>
                <input type="text" id="balance-job-title" class="cyber-input" placeholder="Görevi" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.3rem; flex: 0.8;">
                <label style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;">KIDEMİ</label>
                <input type="text" id="balance-seniority" class="cyber-input" placeholder="Kıdemi" style="width: 100%; height: 38px; box-sizing: border-box; background: rgba(0,0,0,0.25); border: 1px solid rgba(0, 243, 255, 0.15); border-radius: 6px; padding: 0.5rem; color: #fff; outline: none;">
              </div>
            </div>

            <button type="submit" class="btn-cyber" style="width: 100%; height: 40px; font-weight: bold; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px; justify-content: center; display: flex; align-items: center; gap: 8px; cursor: pointer; margin-top: 0.5rem; background: rgba(0,243,255,0.06); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); box-shadow: 0 0 10px rgba(0,243,255,0.1); border-radius: 6px; text-shadow: 0 0 5px rgba(0,243,255,0.3); transition: all 0.2s;" onmouseover="this.style.background='var(--accent-cyan)'; this.style.color='#000'; this.style.boxShadow='0 0 20px rgba(0,243,255,0.35)';" onmouseout="this.style.background='rgba(0,243,255,0.06)'; this.style.color='var(--accent-cyan)'; this.style.boxShadow='0 0 10px rgba(0,243,255,0.1)';">
              <i class="fa-solid fa-save"></i> BİLGİLERİ KAYDET
            </button>
          </form>
        </div>

        <!-- Right Side: Balances Table -->
        <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35); overflow-x: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 0.75rem;">
            <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-users-cog"></i> TÜM PERSONEL İZİN DETAYLARI
            </h3>
            ${isAdmin ? `
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <button onclick="window.downloadLeaveTemplate()" class="btn-cyber" style="background: rgba(16, 185, 129, 0.08); border: 1px solid #10b981; color: #10b981; font-size: 0.75rem; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-download"></i> Şablon İndir
              </button>
              <button onclick="window.downloadProcessedLeavesExcel()" class="btn-cyber" style="background: rgba(251, 191, 36, 0.08); border: 1px solid #fbbf24; color: #fbbf24; font-size: 0.75rem; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-file-excel"></i> İzinleri İndir
              </button>
              <button onclick="document.getElementById('leave-excel-upload-file').click()" class="btn-cyber" style="background: rgba(0, 243, 255, 0.08); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); font-size: 0.75rem; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-weight: bold; display: flex; align-items: center; gap: 6px; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-upload"></i> Excel'den Yükle
              </button>
              <input type="file" id="leave-excel-upload-file" accept=".xlsx, .xls" style="display: none;" onchange="window.importLeaveFromExcel(event)">
            </div>
            ` : ''}
          </div>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; min-width: 500px;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.7rem;">
                <th style="padding: 12px 10px;">Personel Adı</th>
                <th style="padding: 12px 10px;">Ekipler</th>
                <th style="padding: 12px 10px;">Şirket</th>
                <th style="padding: 12px 10px;">İşe Giriş Tarihi</th>
                <th style="padding: 12px 10px;">Kalan Bakiye</th>
              </tr>
            </thead>
            <tbody>
              ${balancesTableHtml || `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted);">Personel listesi boş.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // Render Health Reports Analytics and tracking tab
  const renderHealthReportsTab = () => {
    const reportRequests = requests.filter(r => r.type === 'RAPOR');
    
    // Calculate total statistics (approved only)
    const approvedReports = reportRequests.filter(r => r.status === 'APPROVED');
    const totalReportCount = approvedReports.length;
    const totalReportDays = approvedReports.reduce((acc, r) => acc + r.duration, 0);

    // Compute personnel report stats (approved only)
    const statsMap: Record<string, { name: string; team: string; count: number; days: number }> = {};
    approvedReports.forEach(r => {
      const key = r.userName.toLowerCase().trim();
      if (!statsMap[key]) {
        statsMap[key] = {
          name: r.userName,
          team: r.team || '---',
          count: 0,
          days: 0
        };
      }
      statsMap[key].count += 1;
      statsMap[key].days += r.duration;
    });

    const sortedStats = Object.values(statsMap).sort((a, b) => b.days - a.days);

    const statsRowsHtml = sortedStats.map(s => {
      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
          <td style="padding: 12px 10px; font-weight: 700; color: #fff; text-align: center;">${s.name}</td>
          <td style="padding: 12px 10px; color: var(--text-muted); text-align: center;">${s.team}</td>
          <td style="padding: 12px 10px; font-weight: bold; color: #fbbf24; text-align: center; font-family: 'Rajdhani', sans-serif;">${s.count} Adet</td>
          <td style="padding: 12px 10px; font-weight: bold; color: var(--accent-cyan); text-align: center; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem;">${s.days} Gün</td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">Henüz onaylanmış sağlık raporu kaydı bulunmamaktadır.</td></tr>`;

    // Render list of all reports (including pending/rejected for completeness)
    const allReportsRowsHtml = reportRequests.map(r => {
      const statusBadge = getLeaveStatusBadge(r);
      return `
        <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;">
          <td style="padding: 12px 10px; font-weight: 700; color: #fff; text-align: center;">${r.userName}</td>
          <td style="padding: 12px 10px; color: var(--text-muted); text-align: center;">${r.team || '---'}</td>
          <td style="padding: 12px 10px; color: var(--text-muted); font-family: 'Rajdhani', sans-serif; text-align: center;">
            ${new Date(r.startDate).toLocaleDateString('tr-TR')} - ${new Date(r.endDate).toLocaleDateString('tr-TR')}
          </td>
          <td style="padding: 12px 10px; font-weight: bold; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">
            ${r.duration} Gün
          </td>
          <td style="padding: 12px 10px; text-align: center;">
            ${r.reportUrl ? `
              <a href="${r.reportUrl}" target="_blank" class="btn-cyber" style="background: rgba(251,191,36,0.08); border: 1px solid #fbbf24; color: #fbbf24; padding: 4px 10px; border-radius: 4px; font-size: 0.7rem; text-decoration: none; display: inline-flex; align-items: center; gap: 4px; font-weight: bold; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-file-medical"></i> Raporu Gör
              </a>
            ` : '<span style="color: #666; font-style: italic; font-size: 0.75rem;">Belge Yüklenmemiş</span>'}
          </td>
          <td style="padding: 12px 10px; text-align: center; vertical-align: middle;">
            <div style="display: flex; justify-content: center; align-items: center;">${statusBadge}</div>
          </td>
        </tr>
      `;
    }).join('') || `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-muted); font-style: italic;">Kayıtlı sağlık raporu bulunmamaktadır.</td></tr>`;

    return `
      <div style="display: grid; grid-template-columns: 1fr 1.6fr; gap: 1.5rem; flex-wrap: wrap;">
        <!-- Left Side: Statistics and Summary -->
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          <!-- Stats Panel -->
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-top: 3px solid #fbbf24; border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px);">
            <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: #fbbf24; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-chart-line"></i> GENEL RAPOR İSTATİSTİKLERİ
            </h3>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.25rem;">
              <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam Rapor Adedi</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: #fbbf24; font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${totalReportCount} Adet</div>
              </div>
              <div style="background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 12px; text-align: center;">
                <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam Rapor Günü</div>
                <div style="font-size: 1.5rem; font-weight: 800; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; margin-top: 4px;">${totalReportDays} Gün</div>
              </div>
            </div>
          </div>

          <!-- Top Report Receivers Panel -->
          <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); overflow-x: auto;">
            <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-arrow-trend-up"></i> EN ÇOK RAPOR ALAN PERSONELLER
            </h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.7rem;">
                  <th style="padding: 10px; text-align: center;">Personel</th>
                  <th style="padding: 10px; text-align: center;">Ekip</th>
                  <th style="padding: 10px; text-align: center;">Rapor Adedi</th>
                  <th style="padding: 10px; text-align: center;">Toplam Gün</th>
                </tr>
              </thead>
              <tbody>
                ${statsRowsHtml}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Right Side: All Reports List -->
        <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.7) 0%, rgba(20,27,45,0.7) 100%); backdrop-filter: blur(15px); overflow-x: auto; height: fit-content;">
          <h3 style="margin-top: 0; margin-bottom: 1.25rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
            <i class="fa-solid fa-notes-medical"></i> TÜM SAĞLIK RAPORU KAYITLARI
          </h3>
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; min-width: 500px;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.7rem;">
                <th style="padding: 12px 10px; text-align: center;">Personel</th>
                <th style="padding: 12px 10px; text-align: center;">Ekip</th>
                <th style="padding: 12px 10px; text-align: center;">Rapor Tarihleri</th>
                <th style="padding: 12px 10px; text-align: center;">Süre</th>
                <th style="padding: 12px 10px; text-align: center;">Rapor Belgesi</th>
                <th style="padding: 12px 10px; text-align: center;">Durum</th>
              </tr>
            </thead>
            <tbody>
              ${allReportsRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // Render Visual Calendar Grid
  const renderCalendarTab = () => {
    const calYear = (window as any).leaveCalYear || new Date().getFullYear();
    const calMonth = (window as any).leaveCalMonth || (new Date().getMonth() + 1);

    const monthNames = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'
    ];

    (window as any).changeLeaveCalMonth = (offset: number) => {
      let m = calMonth + offset;
      let y = calYear;
      if (m < 1) {
        m = 12;
        y--;
      } else if (m > 12) {
        m = 1;
        y++;
      }
      (window as any).leaveCalYear = y;
      (window as any).leaveCalMonth = m;
      (window as any).navigate('leave-management');
    };

    const firstDayIndex = new Date(calYear, calMonth - 1, 1).getDay();
    const startOffset = firstDayIndex === 0 ? 6 : firstDayIndex - 1;
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    const activeLeaves = approvedRequests.filter((req: any) => {
      const start = new Date(req.startDate);
      const end = new Date(req.endDate);
      const calStart = new Date(calYear, calMonth - 1, 1);
      const calEnd = new Date(calYear, calMonth, 0);
      return start <= calEnd && end >= calStart;
    });

    const daysHtml: string[] = [];
    for (let i = 0; i < startOffset; i++) {
      daysHtml.push(`<div style="background: rgba(255,255,255,0.01); border: 1px solid rgba(255,255,255,0.03); border-radius: 6px; min-height: 90px; padding: 4px;"></div>`);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const currentDate = new Date(calYear, calMonth - 1, day);
      
      const dayLeaves = activeLeaves.filter((req: any) => {
        const start = new Date(req.startDate);
        const end = new Date(req.endDate);
        start.setHours(0,0,0,0);
        end.setHours(23,59,59,999);
        currentDate.setHours(12,0,0,0);
        return currentDate >= start && currentDate <= end;
      });

      const isToday = new Date().toDateString() === new Date(calYear, calMonth - 1, day).toDateString();

      const leavesListHtml = dayLeaves.map((req: any) => {
        const shortName = req.userName;
        return `
          <div style="background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.25); color: var(--accent-cyan); border-radius: 4px; padding: 2px 4px; font-size: 0.65rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px; box-shadow: 0 2px 5px rgba(0,243,255,0.05); text-shadow: 0 0 2px rgba(0,243,255,0.2);" title="${req.userName} (${typeMap[req.type] || req.type})">
            ✈️ ${shortName}
          </div>
        `;
      }).join('');

      daysHtml.push(`
        <div style="background: ${isToday ? 'rgba(0, 243, 255, 0.04)' : 'rgba(255,255,255,0.015)'}; border: 1px solid ${isToday ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)'}; border-radius: 6px; min-height: 90px; padding: 6px; display: flex; flex-direction: column; gap: 4px; transition: all 0.2s; box-shadow: ${isToday ? '0 0 10px rgba(0,243,255,0.08)' : 'none'};" onmouseover="this.style.transform='scale(1.03)'; this.style.borderColor='rgba(0,243,255,0.2)'; this.style.background='rgba(255,255,255,0.03)';" onmouseout="this.style.transform='scale(1)'; this.style.borderColor='${isToday ? 'var(--accent-cyan)' : 'rgba(255,255,255,0.05)'}'; this.style.background='${isToday ? 'rgba(0, 243, 255, 0.04)' : 'rgba(255,255,255,0.015)'}';">
          <div style="font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; color: ${isToday ? 'var(--accent-cyan)' : 'var(--text-muted)'}; text-align: right;">${day}</div>
          <div style="flex-grow: 1; display: flex; flex-direction: column; justify-content: flex-start; overflow-y: auto; max-height: 60px;">
            ${leavesListHtml}
          </div>
        </div>
      `);
    }

    const weekdays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
    const weekdayHeaders = weekdays.map(w => `<div style="text-align: center; font-weight: 800; font-size: 0.75rem; color: var(--text-muted); padding: 6px 0; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">${w}</div>`).join('');

    return `
      <div class="glass-panel" style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.06); border-radius: 12px; background: linear-gradient(135deg, rgba(13,18,30,0.6) 0%, rgba(20,27,45,0.6) 100%); backdrop-filter: blur(15px); box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.35); max-width: 950px; margin: 0 auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.75rem;">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
            <i class="fa-solid fa-calendar-days"></i> İZİN PROGRAMI VE TAKVİMİ
          </h3>
          <div style="display: flex; align-items: center; gap: 1rem;">
            <button onclick="window.changeLeaveCalMonth(-1)" class="btn-cyber" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); color: #fff; transition: all 0.2s;" onmouseover="this.style.background='rgba(0,243,255,0.1)'; this.style.borderColor='var(--accent-cyan)';" onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='rgba(255,255,255,0.1)';"><i class="fa-solid fa-chevron-left"></i></button>
            <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: #fff; text-transform: uppercase; min-width: 140px; text-align: center; letter-spacing: 1px;">
              ${monthNames[calMonth - 1]} ${calYear}
            </span>
            <button onclick="window.changeLeaveCalMonth(1)" class="btn-cyber" style="width: 32px; height: 32px; padding: 0; display: flex; align-items: center; justify-content: center; cursor: pointer; border-radius: 6px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.1); color: #fff; transition: all 0.2s;" onmouseover="this.style.background='rgba(0,243,255,0.1)'; this.style.borderColor='var(--accent-cyan)';" onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='rgba(255,255,255,0.1)';"><i class="fa-solid fa-chevron-right"></i></button>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-bottom: 0.5rem;">
          ${weekdayHeaders}
        </div>
        <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem;">
          ${daysHtml.join('')}
        </div>
      </div>
    `;
  };

  const getActiveTabContent = () => {
    switch (currentTab) {
      case 'my-leaves': return renderMyLeavesTab();
      case 'approvals': return renderAdminApprovalsTab();
      case 'balance-admin': return renderBalanceAdminTab();
      case 'calendar': return renderCalendarTab();
      case 'health-reports': return renderHealthReportsTab();
      default: return renderMyLeavesTab();
    }
  };

  // Real-time refresh helper
  (window as any).refreshLeaveUI = () => {
    const selectorContainer = document.getElementById('leave-personnel-selector-container');
    const metricsContainer = document.getElementById('leave-metrics-container');
    const mainContent = document.getElementById('leave-main-content');
    
    const activeRequests = (window as any).allLeaveRequests || [];
    const personalReqs = activeRequests.filter((r: any) => r.userName.toLowerCase().trim() === selectedBalanceKey);

    // 1. Update Personnel Selector
    if (selectorContainer) {
      selectorContainer.innerHTML = (currentTab === 'my-leaves' && filteredPersonnel.length > 1) ? `
        <div style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0, 243, 255, 0.04); border: 1px solid rgba(0, 243, 255, 0.15); padding: 4px 12px; border-radius: 8px; box-shadow: inset 0 0 8px rgba(0,243,255,0.05);">
          <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Personel:</span>
          <select onchange="window.selectLeavePersonnel(this.value)" class="cyber-input" style="height: 28px; font-size: 0.8rem; background: transparent; border: none; color: #fff; font-weight: 800; cursor: pointer; padding-right: 1.5rem; outline: none; font-family: 'Rajdhani', sans-serif;">
            <option value="" disabled ${selectedName === '' ? 'selected' : ''} style="background: #0d121e; color: var(--text-muted);">Personel Seçiniz</option>
            ${filteredPersonnel.map(p => `
              <option value="${p.name}" ${p.name === selectedName ? 'selected' : ''} style="background: #0d121e; color: #fff;">${p.name}</option>
            `).join('')}
          </select>
        </div>
      ` : '';
    }

    // 2. Update Metrics
    if (metricsContainer) {
      if (currentTab !== 'my-leaves') {
        metricsContainer.style.display = 'none';
      } else {
        metricsContainer.style.display = 'block';
        const currentPct = (yillikIzinHakki > 0) ? Math.min(100, Math.max(0, (kalanIzin / yillikIzinHakki) * 100)) : 0;
        metricsContainer.innerHTML = `
          <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
            <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(0, 242, 254, 0.18); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(0, 242, 254, 0.04); backdrop-filter: blur(10px);">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(0,242,254,0.15);"><i class="fa-solid fa-award"></i></div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Yıllık Hak</span>
                <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">${yillikIzinHakki} Gün</span>
              </div>
            </div>
            <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(245, 158, 11, 0.18); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 10px; box-shadow: 0 0 15px rgba(245, 158, 11, 0.04); backdrop-filter: blur(10px);">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(245, 158, 11, 0.08); color: #f59e0b; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(245,158,11,0.15);"><i class="fa-solid fa-umbrella-beach"></i></div>
              <div style="display: flex; flex-direction: column;">
                <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Kullanılan</span>
                <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">${kullanilanIzin} Gün</span>
              </div>
            </div>
            <div class="glass-panel" style="padding: 10px 18px; border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 10px; background: rgba(13,18,30,0.6); display: flex; align-items: center; gap: 12px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.04); backdrop-filter: blur(10px); min-width: 150px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: rgba(16, 185, 129, 0.08); color: #10b981; display: flex; align-items: center; justify-content: center; font-size: 0.95rem; border: 1px solid rgba(16,185,129,0.15);"><i class="fa-solid fa-hourglass-start"></i></div>
              <div style="display: flex; flex-direction: column; flex-grow: 1; gap: 3px;">
                <span style="font-size: 0.6rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; font-family: 'Rajdhani', sans-serif;">Kalan Bakiye</span>
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                  <span style="font-family: 'Rajdhani', sans-serif; font-weight: 900; color: #10b981; font-size: 1.05rem; letter-spacing: 0.5px;">${kalanIzin} Gün</span>
                  <span style="font-size: 0.65rem; color: var(--text-muted); font-family: 'Rajdhani', sans-serif;">%${Math.round(currentPct)}</span>
                </div>
                <div style="width: 100%; height: 3px; background: rgba(255,255,255,0.06); border-radius: 2px; overflow: hidden;">
                  <div style="width: ${currentPct}%; height: 100%; background: linear-gradient(90deg, #10b981 0%, #34d399 100%); box-shadow: 0 0 5px rgba(16,185,129,0.5);"></div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    }

    // 3. Update main tab content (avoiding resetting form if we are on my-leaves)
    if (mainContent) {
      if (currentTab === 'my-leaves') {
        const historyContainer = document.getElementById('leave-history-table-container');
        if (historyContainer) {
          const listHtml = personalReqs.map((req: any) => {
            const statusBadge = getLeaveStatusBadge(req);

            return `
              <tr class="cyber-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: background 0.2s;">
                <td style="padding: 14px 12px; color: var(--text-muted); font-weight: 600; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${new Date(req.startDate).toLocaleDateString('tr-TR')} - ${new Date(req.endDate).toLocaleDateString('tr-TR')}</td>
                <td style="padding: 14px 12px; font-weight: 700; color: #fff; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.calendarDays || req.duration} Gün</td>
                <td style="padding: 14px 12px; font-weight: bold; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; text-align: center;">${req.duration} Gün</td>
                <td style="padding: 14px 12px; font-weight: 700; color: var(--accent-cyan); font-size: 0.75rem; text-align: center;">
                  ${typeMap[req.type] || req.type}
                  ${req.additionalDeductionDates && req.additionalDeductionDates.length > 0 ? `
                    <div style="font-size: 0.65rem; color: #fbbf24; margin-top: 4px; font-weight: bold; font-family: 'Rajdhani', sans-serif;">
                      <i class="fa-solid fa-calendar-day"></i> Hafta Tatili / Yol İzni: 
                      ${req.additionalDeductionDates.map((d: string) => {
                        const parts = d.split('-');
                        if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
                        return d;
                      }).join(', ')}
                    </div>
                  ` : ''}
                  ${req.reportUrl ? `
                    <br><a href="${req.reportUrl}" target="_blank" style="color: #fbbf24; text-decoration: underline; font-size: 0.65rem; display: inline-flex; align-items: center; gap: 4px; margin-top: 4px; justify-content: center;"><i class="fa-solid fa-file-medical"></i> Raporu Gör</a>
                  ` : ''}
                </td>
                <td style="padding: 14px 12px; color: var(--text-main); font-size: 0.75rem; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: center;" title="${req.description}">${req.description}</td>
                <td style="padding: 14px 12px; text-align: center;">${statusBadge}</td>
                <td style="padding: 14px 12px; text-align: center; vertical-align: middle;">
                  <div style="display: inline-flex; align-items: center; gap: 8px; justify-content: center;">
                    ${req.status === 'APPROVED' && req.type !== 'RAPOR' ? `
                      <button onclick="window.openLeavePrintModal('${req.id}')" class="btn-cyber" style="background: rgba(0, 243, 255, 0.05); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); padding: 4px 8px; border-radius: 4px; font-size: 0.7rem; cursor: pointer; font-weight: 800; display: inline-flex; align-items: center; gap: 4px; font-family: 'Rajdhani', sans-serif;" title="İzin Formunu Yazdır">
                        <i class="fa-solid fa-print"></i> Form
                      </button>
                    ` : ''}
                    ${(req.status === 'PENDING_FIRST' || canApprove) ? `
                      <button onclick="window.cancelLeaveRequest('${req.id}')" class="cancel-btn" style="background: none; border: none; color: #ff3366; cursor: pointer; font-size: 1rem; transition: all 0.2s; text-shadow: 0 0 5px rgba(255,51,102,0.25); display: inline-flex; align-items: center;" onmouseover="this.style.transform='scale(1.2)'" onmouseout="this.style.transform='scale(1)'" title="İptal Et / Sil">
                        <i class="fa-solid fa-trash-can"></i>
                      </button>
                    ` : (req.status !== 'APPROVED' ? '---' : '')}
                  </div>
                </td>
              </tr>
            `;
          }).join('');

          historyContainer.innerHTML = `
            <h3 style="margin-top: 0; margin-bottom: 1.5rem; font-family: 'Rajdhani', sans-serif; font-size: 0.95rem; color: var(--accent-cyan); font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; text-transform: uppercase;">
              <i class="fa-solid fa-clock-rotate-left"></i> GEÇMİŞ İZİN HAREKETLERİ LİSTESİ
            </h3>
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; min-width: 500px;">
              <thead>
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.08); color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.7rem; letter-spacing: 0.5px;">
                  <th style="padding: 12px 10px; text-align: center;">İzin Tarihleri</th>
                  <th style="padding: 12px 10px; text-align: center;">Takvim Süresi</th>
                  <th style="padding: 12px 10px; text-align: center;">Düşüş (Bakiye)</th>
                  <th style="padding: 12px 10px; text-align: center;">İzin Türü</th>
                  <th style="padding: 12px 10px; text-align: center;">Gerekçe / Detay</th>
                  <th style="padding: 12px 10px; text-align: center;">Onay Durumu</th>
                  <th style="padding: 12px 10px; text-align: center; width: 80px;">Aksiyon</th>
                </tr>
              </thead>
              <tbody>
                ${(() => {
                  if (!selectedName) {
                    return `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-user-slash" style="font-size: 1.5rem; display: block; margin-bottom: 10px; color: rgba(255,255,255,0.15);"></i>Lütfen işlem yapmak ve geçmiş izin hareketlerini görüntülemek için personel seçiniz.</td></tr>`;
                  }
                  return listHtml || `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--text-muted); font-style: italic;"><i class="fa-solid fa-umbrella-beach" style="font-size: 1.5rem; display: block; margin-bottom: 10px; color: rgba(255,255,255,0.15);"></i>Seçilen personel için henüz hiçbir izin talebi bulunmuyor.</td></tr>`;
                })()}
              </tbody>
            </table>
          `;
        } else {
          mainContent.innerHTML = getActiveTabContent();
        }
      } else {
        mainContent.innerHTML = getActiveTabContent();
      }
    }
  };

  // Register real-time background listener (cleans up automatically on page switch)
  setTimeout(async () => {
    try {
      const { onSnapshot, collection } = await import('firebase/firestore');
      
      // Cancel previous if any
      if ((window as any)._draftAuditUnsubscribe) {
        try { (window as any)._draftAuditUnsubscribe(); } catch(e) {}
        (window as any)._draftAuditUnsubscribe = null;
      }
      
      (window as any)._draftAuditUnsubscribe = onSnapshot(collection(db, 'leaveRequests'), (snapshot) => {
        const liveReqs: LeaveRequest[] = [];
        snapshot.forEach(d => {
          liveReqs.push({ id: d.id, ...d.data() } as any);
        });

        // Sort in memory
        liveReqs.sort((a, b) => {
          const aTime = a.requestedAt?.seconds ? a.requestedAt.seconds * 1000 : (a.requestedAt ? new Date(a.requestedAt).getTime() : 0);
          const bTime = b.requestedAt?.seconds ? b.requestedAt.seconds * 1000 : (b.requestedAt ? new Date(b.requestedAt).getTime() : 0);
          return bTime - aTime;
        });

        // Update local memory and UI
        const canReadGlobal = isAdmin || 
                              userEmail === 'furkan.yildirim@demirerholding.com' || 
                              userEmail === 'fatih.zebek@demirerholding.com' ||
                              userEmail === 'emre.aydogdu@demirerholding.com';
        let filtered = liveReqs;
        if (!canReadGlobal) {
          const allowedNames = filteredPersonnel.map(p => p.name.toLowerCase().trim());
          filtered = liveReqs.filter(r => allowedNames.includes(r.userName.toLowerCase().trim()));
        }

        (window as any).allLeaveRequests = filtered;
        (window as any).allApprovedRequests = liveReqs.filter(r => r.status === 'APPROVED');
        
        if (typeof (window as any).refreshLeaveUI === 'function') {
          (window as any).refreshLeaveUI();
        }
      });
    } catch(err) {
      console.error("Failed to setup real-time onSnapshot listener", err);
    }
  }, 100);

  return renderBaseLayout();
};
