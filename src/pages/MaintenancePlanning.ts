import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';

export const MaintenancePlanningPage = async () => {
  const currentUser = (window as any).currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const userRole = currentUser?.role?.toUpperCase() || 'ADMIN';
  const userEmail = (currentUser?.email || '').toLowerCase();
  const isFen = userEmail === 'fatih.zebek@demirerholding.com' || userEmail === 'fen' || userEmail.includes('fatih.zebek');
  const isAdmin = !currentUser?.role || userRole === 'ADMIN' || userRole === 'YÖNETİCİ' || userRole === 'SAHA YÖNETİCİSİ' || isFen;
  const allSites = dataService.getSites();
  const sites = isAdmin ? allSites : allSites.filter(s => currentUser?.allowedSites?.includes(s.id));
  const reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
  const now = new Date();

  // Maintenance Tracking Logic
  const planGeneral: any[] = [];
  const planRulman: any[] = [];
  const plan4Year: any[] = [];

  sites.forEach(site => {
    const siteTurbines = dataService.getTurbinesBySite(site.id);
    siteTurbines.forEach(t => {
      const turbineReports = reports.filter(r => r.turbineSerial === t.id);

      // 1. GENERAL PLAN (Ana/Yağlama alternating cycle)
      const lastMaintGen = turbineReports
        .filter(r => {
          const typeLower = (r.type || '').toLowerCase();
          const templateLower = (r.templateName || '').toLowerCase();
          const faultLower = (r.faultCode || '').toLowerCase();
          return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
                 templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
                 faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastMaintGen) {
        const lastDate = new Date(lastMaintGen.date);
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 6);

        const searchStr = `${lastMaintGen.type} ${lastMaintGen.templateName} ${lastMaintGen.faultCode}`.toLowerCase();
        const isLastAna = searchStr.includes('ana');
        const lastType = isLastAna ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
        const nextType = isLastAna ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';

        const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'safe' | 'warning' | 'overdue' = 'safe';
        if (diffDays < 0) status = 'overdue';
        else if (diffDays < 30) status = 'warning';

        planGeneral.push({
          siteName: site.name,
          turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
          turbineSerial: t.id,
          turbineType: t.type || '',
          lastDate: lastMaintGen.date,
          lastType,
          nextDate: nextDate.toISOString(),
          nextType,
          status,
          daysRemaining: diffDays
        });
      } else {
        planGeneral.push({
          siteName: site.name,
          turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
          turbineSerial: t.id,
          turbineType: t.type || '',
          lastDate: '-',
          lastType: 'VERİ YOK',
          nextDate: null,
          nextType: 'BELİRLENMEDİ',
          status: 'safe',
          daysRemaining: 0
        });
      }

      // 2. RULMAN PLAN (5 months interval - only problematic turbines)
      const lastMaintRulman = turbineReports
        .filter(r => {
          const typeLower = (r.type || '').toLowerCase();
          const templateLower = (r.templateName || '').toLowerCase();
          const faultLower = (r.faultCode || '').toLowerCase();
          return typeLower.includes('rulman') || templateLower.includes('rulman') || faultLower.includes('rulman');
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastMaintRulman) {
        const lastDate = new Date(lastMaintRulman.date);
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 5);

        const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'safe' | 'warning' | 'overdue' = 'safe';
        if (diffDays < 0) status = 'overdue';
        else if (diffDays < 30) status = 'warning';

        planRulman.push({
          siteName: site.name,
          turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
          turbineSerial: t.id,
          lastDate: lastMaintRulman.date,
          lastType: 'RULMAN BAKIMI KONTROLÜ',
          nextDate: nextDate.toISOString(),
          nextType: 'RULMAN BAKIMI KONTROLÜ',
          status,
          daysRemaining: diffDays
        });
      }

      // 3. 4 YILLIK BAKIM PLAN (48 months interval - all turbines)
      const lastMaint4Year = turbineReports
        .filter(r => {
          const typeLower = (r.type || '').toLowerCase();
          const templateLower = (r.templateName || '').toLowerCase();
          const faultLower = (r.faultCode || '').toLowerCase();
          return typeLower.includes('4 yıl') || templateLower.includes('4 yıl') || faultLower.includes('4 yıl') ||
                 typeLower.includes('4 yillik') || templateLower.includes('4 yillik') || faultLower.includes('4 yillik') ||
                 typeLower.includes('4 yıllık') || templateLower.includes('4 yıllık') || faultLower.includes('4 yıllık');
        })
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      if (lastMaint4Year) {
        const lastDate = new Date(lastMaint4Year.date);
        const nextDate = new Date(lastDate);
        nextDate.setMonth(nextDate.getMonth() + 48);

        const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        let status: 'safe' | 'warning' | 'overdue' = 'safe';
        if (diffDays < 0) status = 'overdue';
        else if (diffDays < 30) status = 'warning';

        plan4Year.push({
          siteName: site.name,
          turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
          turbineSerial: t.id,
          lastDate: lastMaint4Year.date,
          lastType: '4 YILLIK BAKIM',
          nextDate: nextDate.toISOString(),
          nextType: '4 YILLIK BAKIM',
          status,
          daysRemaining: diffDays
        });
      } else {
        plan4Year.push({
          siteName: site.name,
          turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
          turbineSerial: t.id,
          lastDate: '-',
          lastType: 'VERİ YOK',
          nextDate: null,
          nextType: '4 YILLIK BAKIM',
          status: 'safe',
          daysRemaining: 0
        });
      }
    });
  });

  const maintDataGeneral: Record<string, any[]> = {};
  planGeneral.forEach(p => {
    if (!maintDataGeneral[p.siteName]) maintDataGeneral[p.siteName] = [];
    maintDataGeneral[p.siteName].push(p);
  });

  const maintDataRulman: Record<string, any[]> = {};
  planRulman.forEach(p => {
    if (!maintDataRulman[p.siteName]) maintDataRulman[p.siteName] = [];
    maintDataRulman[p.siteName].push(p);
  });

  const maintData4Year: Record<string, any[]> = {};
  plan4Year.forEach(p => {
    if (!maintData4Year[p.siteName]) maintData4Year[p.siteName] = [];
    maintData4Year[p.siteName].push(p);
  });

  const customOrder = [
    'Alize Germiyan',
    'Mare Manastır',
    'Anemon İntepe',
    'Doğal Sayalar',
    'Dares Datça',
    'Alize Çamseki',
    'Alize Keltepe',
    'Alize Sarıkaya',
    'Alize Kuyucak',
    'Alize Çataltape'
  ];

  const siteList = Object.keys(maintDataGeneral).sort((a, b) => {
    const indexA = customOrder.findIndex(o => o.toLowerCase() === a.toLowerCase());
    const indexB = customOrder.findIndex(o => o.toLowerCase() === b.toLowerCase());
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const savedSite = sessionStorage.getItem('activeMaintSiteName');
  const initialSite = (savedSite && (siteList.includes(savedSite) || savedSite === 'TÜM SAHALAR')) ? savedSite : 'TÜM SAHALAR';

  // Expose to window for initialization
  (window as any).maintData = maintDataGeneral;
  
  let activeMaintFilter = 'ALL';
  let activeMaintCategory = 'GENERAL'; // GENERAL, RULMAN, 4YEAR

  (window as any).setMaintCategory = (category: string) => {
    activeMaintCategory = category;
    
    // Toggle active classes on category buttons
    document.querySelectorAll('.maint-cat-tab').forEach(btn => {
      const b = btn as HTMLElement;
      b.classList.remove('active');
      b.style.background = 'rgba(255,255,255,0.02)';
      b.style.borderColor = 'rgba(255,255,255,0.08)';
      b.style.color = 'var(--text-muted)';
    });

    const activeBtn = document.getElementById(`maint-cat-${category.toLowerCase()}`);
    if (activeBtn) {
      activeBtn.classList.add('active');
      activeBtn.style.background = 'rgba(0, 242, 255, 0.08)';
      activeBtn.style.borderColor = 'var(--accent-cyan)';
      activeBtn.style.color = 'var(--accent-cyan)';
    }

    // Refresh table
    const activeItem = document.querySelector('.site-menu-item.active') as HTMLElement;
    const site = activeItem?.getAttribute('data-site') || 'TÜM SAHALAR';
    if ((window as any).updateMaintTable) {
      (window as any).updateMaintTable(site);
    }
  };

  (window as any).filterMaintTable = (filter: string) => {
    activeMaintFilter = filter;
    document.querySelectorAll('.maint-tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`maint-tab-${filter.toLowerCase()}`)?.classList.add('active');
    
    const activeItem = document.querySelector('.site-menu-item.active') as HTMLElement;
    const site = activeItem?.getAttribute('data-site');
    if (site && (window as any).updateMaintTable) {
      (window as any).updateMaintTable(site);
    }
  };

  (window as any).createMaintenanceTask = (serial: string, taskType: string, prefilledMaintType: string) => {
    (window as any).navigate('new-task', { 
      prefilledSerial: serial, 
      prefilledTaskType: taskType, 
      prefilledMaintType: prefilledMaintType 
    });
  };

  (window as any).openManualMaintModal = async () => {
    if (!isAdmin) {
      alert("Bu işlem için yetkiniz bulunmamaktadır.");
      return;
    }
    const siteId = (window as any).activeMaintSiteId;
    const siteName = (window as any).activeMaintSiteName;
    if (!siteId) {
      alert("Lütfen önce bir saha seçiniz.");
      return;
    }

    const turbines = dataService.getTurbinesBySite(siteId);
    if (turbines.length === 0) {
      alert("Bu sahada türbin bulunamadı.");
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';

    modal.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 500px; padding: 2.2rem; position: relative; border-top: 4px solid var(--accent-cyan); display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: var(--accent-cyan);">
          <i class="fa-solid fa-wrench" style="font-size: 1.8rem; text-shadow: 0 0 10px rgba(0,242,255,0.35);"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0; font-weight: 800; letter-spacing: 1px;">MANUEL BAKIM KAYDI EKLE</h3>
        </div>
        
        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem; line-height: 1.4;">
          Program dışı (plan dışı) veya geçmişte yapılan bakımları sisteme kaydetmek için aşağıdaki formu doldurunuz. Bu kayıt, türbinin bakım periyodunu güncelleyecektir.
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">TÜRBİN SEÇİNİZ</label>
            <select id="manual-maint-turbine" class="cyber-input" style="width: 100%; font-weight: 700; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
              ${turbines.map(t => `<option value="${t.id}" data-no="${t.no}">${t.label || 'T-' + t.no} (Seri No: ${t.id})</option>`).join('')}
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">BAKIM TİPİ</label>
            <select id="manual-maint-type" class="cyber-input" style="width: 100%; font-weight: 700; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
              <option value="ANA BAKIM">ANA BAKIM</option>
              <option value="YAĞLAMA BAKIMI">YAĞLAMA BAKIMI</option>
              <option value="RULMAN BAKIMI KONTROLÜ">RULMAN BAKIMI KONTROLÜ</option>
              <option value="4 YILLIK BAKIM">4 YILLIK BAKIM</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">BAKIM TARİHİ</label>
            <input type="date" id="manual-maint-date" class="cyber-input" style="width: 100%; font-weight: 700; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);" value="${new Date().toISOString().split('T')[0]}">
          </div>

          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">AÇIKLAMA / NOT</label>
            <textarea id="manual-maint-notes" class="cyber-input" rows="2" style="width: 100%; resize: vertical; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);" placeholder="Yapılan işlemler hakkında not yazınız..."></textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 6px 14px; border-radius: 4px; cursor: pointer;">İPTAL</button>
          <button id="manual-maint-save-btn" class="cyber-button primary" style="background: var(--accent-cyan); color: #000; border: none; font-weight: 800; padding: 6px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-floppy-disk"></i> KAYDET
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    const saveBtn = document.getElementById('manual-maint-save-btn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const turbineSelect = document.getElementById('manual-maint-turbine') as HTMLSelectElement;
        const maintTypeSelect = document.getElementById('manual-maint-type') as HTMLSelectElement;
        const dateInput = document.getElementById('manual-maint-date') as HTMLInputElement;
        const notesInput = document.getElementById('manual-maint-notes') as HTMLTextAreaElement;

        const turbineSerial = turbineSelect.value;
        const selectedOption = turbineSelect.options[turbineSelect.selectedIndex];
        const turbineNo = selectedOption.getAttribute('data-no') || '';
        const maintType = maintTypeSelect.value;
        const maintDate = dateInput.value;
        const team = 'MANUEL';
        const notes = notesInput.value.trim();

        if (!turbineSerial || !maintDate) {
          alert("Lütfen tüm alanları eksiksiz doldurunuz.");
          return;
        }

        try {
          saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
          (saveBtn as HTMLButtonElement).disabled = true;

          const { db } = await import('../firebase');
          const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

          const manualReport = {
            type: 'BAKIM',
            reportNo: 'MAN-' + Date.now().toString().slice(-6),
            turbineSerial: turbineSerial,
            turbineNo: turbineNo.startsWith('T-') ? turbineNo : 'T-' + turbineNo,
            siteId: siteId,
            siteName: siteName,
            date: maintDate,
            faultCode: maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 
                       (maintType === 'YAĞLAMA BAKIMI' ? 'Manuel Yağlama bakımı' : 
                       (maintType === 'RULMAN BAKIMI KONTROLÜ' ? 'Manuel Rulman Bakımı kontrolü' : 'Manuel 4 Yıllık Bakım')),
            templateName: maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 
                          (maintType === 'YAĞLAMA BAKIMI' ? 'Manuel Yağlama bakımı' : 
                          (maintType === 'RULMAN BAKIMI KONTROLÜ' ? 'Manuel Rulman Bakımı kontrolü' : 'Manuel 4 Yıllık Bakım')),
            team: team,
            personnel: [team],
            notes: notes || 'Ekip lideri tarafından manuel bakım kaydı girildi.',
            status: 'completed',
            createdBy: currentUser?.email || 'Ekip Lideri',
            createdAt: serverTimestamp()
          };

          await addDoc(collection(db, 'serviceReports'), manualReport);
          
          // Invalidate cache
          try {
            const { serviceReportService } = await import('../services/ServiceReportService');
            (serviceReportService as any).reportsCache = null;
          } catch (e) {}

          alert("Manuel bakım kaydı başarıyla kaydedildi! Sayfa güncelleniyor.");
          modal.remove();
          
          // Reload page
          (window as any).navigate('bakim-planlama');
        } catch (error: any) {
          console.error("Manual maintenance save error:", error);
          alert("Bakım kaydı eklenirken bir hata oluştu: " + error.message);
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> KAYDET';
          (saveBtn as HTMLButtonElement).disabled = false;
        }
      };
    }
  };

  (window as any).downloadMaintTemplateExcel = async () => {
    const sampleData = [
      {
        'TÜRBİN NO': '1',
        'SERİ NO': 'T-01',
        'BAKIM TİPİ': 'Ana Bakım',
        'BAKIM TARİHİ': '01.06.2026',
        'NOTLAR': 'Yıllık ana bakım yapıldı.'
      },
      {
        'TÜRBİN NO': '2',
        'SERİ NO': 'T-02',
        'BAKIM TİPİ': 'Yağlama Bakımı',
        'BAKIM TARİHİ': '15.06.2026',
        'NOTLAR': 'Dişli kutusu yağlaması yapıldı.'
      }
    ];

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(sampleData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Şablon');
      
      const maxLens = { 'TÜRBİN NO': 12, 'SERİ NO': 12, 'BAKIM TİPİ': 15, 'BAKIM TARİHİ': 15, 'NOTLAR': 30 };
      const colWidths = Object.keys(maxLens).map(key => ({ wch: (maxLens as any)[key] }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, 'Bakim_Yukleme_Sablonu.xlsx');
    } catch (err: any) {
      console.error(err);
      alert('Şablon indirilirken bir hata oluştu: ' + err.message);
    }
  };

  (window as any).downloadMaintPlanningExcel = async () => {
    const siteId = (window as any).activeMaintSiteId;
    const siteName = (window as any).activeMaintSiteName || 'Saha';
    if (!siteId) {
      alert("Lütfen önce bir saha seçiniz.");
      return;
    }

    const turbines = dataService.getTurbinesBySite(siteId).sort((a, b) => a.no - b.no);
    if (turbines.length === 0) {
      alert("Bu sahada indirilecek türbin bulunamadı.");
      return;
    }

    let filterFn = (r: any) => {
      const typeLower = (r.type || '').toLowerCase();
      const templateLower = (r.templateName || '').toLowerCase();
      const faultLower = (r.faultCode || '').toLowerCase();
      return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
             templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
             faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
    };

    if (activeMaintCategory === 'RULMAN') {
      filterFn = (r: any) => {
        const typeLower = (r.type || '').toLowerCase();
        const templateLower = (r.templateName || '').toLowerCase();
        const faultLower = (r.faultCode || '').toLowerCase();
        return typeLower.includes('rulman') || templateLower.includes('rulman') || faultLower.includes('rulman');
      };
    } else if (activeMaintCategory === '4YEAR') {
      filterFn = (r: any) => {
        const typeLower = (r.type || '').toLowerCase();
        const templateLower = (r.templateName || '').toLowerCase();
        const faultLower = (r.faultCode || '').toLowerCase();
        return typeLower.includes('4 yıl') || templateLower.includes('4 yıl') || faultLower.includes('4 yıl') ||
               typeLower.includes('4 yillik') || templateLower.includes('4 yillik') || faultLower.includes('4 yillik') ||
               typeLower.includes('4 yıllık') || templateLower.includes('4 yıllık') || faultLower.includes('4 yıllık');
      };
    }

    // Prepare rows
    const data = turbines.map(t => {
      // Find current last maintenance of this turbine
      const turbineReports = reports.filter(r => r.turbineSerial === t.id);
      const lastMaint = turbineReports
        .filter(filterFn)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

      let lastType = '';
      let lastDate = '';
      if (lastMaint) {
        if (activeMaintCategory === 'GENERAL') {
          const searchStr = `${lastMaint.type} ${lastMaint.templateName} ${lastMaint.faultCode}`.toLowerCase();
          lastType = searchStr.includes('ana') ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
        } else if (activeMaintCategory === 'RULMAN') {
          lastType = 'RULMAN BAKIMI KONTROLÜ';
        } else if (activeMaintCategory === '4YEAR') {
          lastType = '4 YILLIK BAKIM';
        }
        lastDate = lastMaint.date;
      }

      return {
        'TÜRBİN NO': t.no > 0 ? t.no.toString() : (t.label || t.id),
        'SERİ NO': t.id,
        'BAKIM TİPİ': lastType || (activeMaintCategory === 'RULMAN' ? 'RULMAN BAKIMI KONTROLÜ' : (activeMaintCategory === '4YEAR' ? '4 YILLIK BAKIM' : 'ANA BAKIM')),
        'BAKIM TARİHİ': lastDate || '',
        'NOTLAR': lastMaint?.notes || ''
      };
    });

    try {
      const XLSX = await import('xlsx');
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Bakım Planı');
      
      // Auto-fit column widths
      const maxLens = { 'TÜRBİN NO': 12, 'SERİ NO': 12, 'BAKIM TİPİ': 15, 'BAKIM TARİHİ': 15, 'NOTLAR': 25 };
      const colWidths = Object.keys(maxLens).map(key => ({ wch: (maxLens as any)[key] }));
      ws['!cols'] = colWidths;

      XLSX.writeFile(wb, `${siteName.replace(/\s+/g, '_')}_Bakim_Plani.xlsx`);
    } catch (err: any) {
      console.error(err);
      alert('Excel indirilirken bir hata oluştu: ' + err.message);
    }
  };

  (window as any).handleMaintExcelUpload = async (event: any) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const siteId = (window as any).activeMaintSiteId;
    const siteName = (window as any).activeMaintSiteName;
    if (!siteId) {
      alert("Lütfen önce bir saha seçiniz.");
      event.target.value = '';
      return;
    }

    const btn = document.getElementById('btn-upload-maint-excel');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Dosya Okunuyor...';

    try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (e: any) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

          if (btn) btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Doğrulanıyor...';

          const siteTurbines = dataService.getTurbinesBySite(siteId);

          const matchedRows: any[] = [];
          const unmatchedRows: any[] = [];

          for (let i = 0; i < jsonData.length; i++) {
            const row = jsonData[i];
            const getVal = (possibleKeys: string[]) => {
              for (const key of Object.keys(row)) {
                if (possibleKeys.includes(key.trim().toUpperCase())) {
                  return row[key];
                }
              }
              return '';
            };

            const rowTurbine = String(getVal(['TÜRBİN', 'TURBINE', 'TÜRBİN NO', 'TÜRBİN NUMARASI']) || '').trim();
            const rowSerial = String(getVal(['SERİ NO', 'SERINO', 'SERIAL', 'SERİ NUMARASI']) || '').trim();
            let rowType = String(getVal(['BAKIM TİPİ', 'BAKIM TIPI', 'BAKIM TÜRÜ', 'BAKIM TURU', 'TİP', 'TIP']) || '').trim().toUpperCase();
            const rowDateRaw = getVal(['BAKIM TARİHİ', 'BAKIM TARIHI', 'TARİH', 'TARIH']);
            const rowNotes = String(getVal(['NOTLAR', 'NOT', 'AÇIKLAMA', 'ACIKLAMA']) || '').trim();

            if (!rowTurbine && !rowSerial) continue; // Skip completely empty rows

            // 1. Eşleştirme (Türbin No veya Seri No)
            let matchedTurbine = siteTurbines.find(t => {
              const matchesSerial = rowSerial && t.id.trim() === rowSerial;
              const matchesNo = rowTurbine && (
                String(t.no).trim() === rowTurbine ||
                `T-${t.no}` === rowTurbine ||
                `T-${String(t.no).padStart(2, '0')}` === rowTurbine
              );
              return matchesSerial || matchesNo;
            });

            // 2. Bakım Tipi Belirleme
            if (rowType.includes('RULMAN') || rowType.includes('BEARING')) {
              rowType = 'RULMAN BAKIMI KONTROLÜ';
            } else if (rowType.includes('4 YIL') || rowType.includes('4-YIL') || rowType.includes('4YIL')) {
              rowType = '4 YILLIK BAKIM';
            } else if (rowType.includes('ANA') || rowType.includes('RÜZGAR') || rowType.includes('RUZGAR')) {
              rowType = 'ANA BAKIM';
            } else if (rowType.includes('YAĞ') || rowType.includes('YAG')) {
              rowType = 'YAĞLAMA BAKIMI';
            } else {
              rowType = 'ANA BAKIM'; // Default
            }

            // 3. Tarih Parse Etme
            let maintDateStr = '';
            if (typeof rowDateRaw === 'number') {
              const dateObj = new Date((rowDateRaw - 25569) * 86400 * 1000);
              maintDateStr = dateObj.toISOString().split('T')[0];
            } else if (rowDateRaw) {
              const cleanRaw = String(rowDateRaw).trim();
              const parts = cleanRaw.split('.');
              if (parts.length === 3) {
                maintDateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
              } else {
                const d = new Date(cleanRaw);
                if (!isNaN(d.getTime())) {
                  maintDateStr = d.toISOString().split('T')[0];
                }
              }
            }

            // Validations
            if (!matchedTurbine) {
              unmatchedRows.push({
                rowNum: i + 2,
                reason: `Saha (${siteName}) altında eşleşen türbin bulunamadı (Türbin: ${rowTurbine || '-'}, Seri No: ${rowSerial || '-'})`
              });
            } else if (!maintDateStr) {
              unmatchedRows.push({
                rowNum: i + 2,
                reason: `${matchedTurbine.label || 'T-' + matchedTurbine.no} için geçerli bir tarih bulunamadı (${rowDateRaw || '-'})`
              });
            } else {
              matchedRows.push({
                turbineSerial: matchedTurbine.id,
                turbineNo: matchedTurbine.no > 0 ? 'T-' + matchedTurbine.no : (matchedTurbine.label || matchedTurbine.id),
                maintType: rowType,
                maintDate: maintDateStr,
                notes: rowNotes
              });
            }
          }

          if (btn) btn.innerHTML = originalText;
          event.target.value = '';

          // Önizleme modalını açalım
          (window as any).openMaintExcelPreviewModal(matchedRows, unmatchedRows);
        } catch (err: any) {
          console.error(err);
          if (btn) btn.innerHTML = originalText;
          event.target.value = '';
          alert('Excel verileri çözümlenirken hata oluştu: ' + err.message);
        }
      };

      reader.onerror = () => {
        if (btn) btn.innerHTML = originalText;
        event.target.value = '';
        alert('Dosya okunurken hata oluştu.');
      };

      reader.readAsArrayBuffer(file);
    } catch (err: any) {
      console.error(err);
      if (btn) btn.innerHTML = originalText;
      event.target.value = '';
      alert('Excel yükleme modülü yüklenirken hata oluştu: ' + err.message);
    }
  };

  (window as any).handleMaintTurbineSearch = (val: string) => {
    (window as any).maintTurbineSearchQuery = val;
    const currentSite = sessionStorage.getItem('activeMaintSiteName') || initialSite;
    if (currentSite && (window as any).updateMaintTable) {
      (window as any).updateMaintTable(currentSite);
    }
  };

  (window as any).handleMaintSortChange = (val: string) => {
    (window as any).maintSortOption = val;
    const currentSite = sessionStorage.getItem('activeMaintSiteName') || initialSite;
    if (currentSite && (window as any).updateMaintTable) {
      (window as any).updateMaintTable(currentSite);
    }
  };

  (window as any).openMaintExcelPreviewModal = (matched: any[], unmatched: any[]) => {
    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.id = 'maint-excel-preview-modal';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';

    const matchedHtml = matched.map(m => `
      <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; background:rgba(20,241,149,0.04); border:1px solid rgba(20,241,149,0.15); border-radius:6px; font-size:0.8rem; color:#fff;">
        <div>
          <span style="font-weight:800; color:#14F195; font-family:'Rajdhani',sans-serif; font-size:0.95rem; margin-right:8px;">${m.turbineNo}</span>
          <span style="color:#94A3B8; font-family:monospace; font-size:0.78rem;">(${m.turbineSerial})</span>
        </div>
        <div style="text-align:right;">
          <span style="background:rgba(20,241,149,0.15); color:#14F195; font-size:0.7rem; font-weight:800; padding:2px 6px; border-radius:4px; margin-right:8px;">${m.maintType}</span>
          <span style="font-family:monospace; font-weight:700;">${new Date(m.maintDate).toLocaleDateString('tr-TR')}</span>
        </div>
      </div>
    `).join('');

    const unmatchedHtml = unmatched.map(u => `
      <div style="display:flex; flex-direction:column; gap:2px; padding:8px 12px; background:rgba(239,68,68,0.04); border:1px solid rgba(239,68,68,0.15); border-radius:6px; font-size:0.8rem; color:#fff;">
        <div style="font-weight:800; color:#EF4444; font-family:'Rajdhani',sans-serif;">Satır ${u.rowNum}</div>
        <div style="color:#94A3B8; font-size:0.75rem;">${u.reason}</div>
      </div>
    `).join('');

    let modalContent = `
      <div class="glass-panel" style="width: 100%; max-width: 550px; padding: 2.2rem; position: relative; border-top: 4px solid #14F195; display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.8); max-height: 85vh;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: #14F195;">
          <i class="fa-solid fa-file-invoice" style="font-size: 1.8rem; text-shadow: 0 0 10px rgba(20,241,149,0.35);"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0; font-weight: 800; letter-spacing: 1px;">EXCEL BAKIM YÜKLEME ÖNİZLEME</h3>
        </div>

        <div style="overflow-y:auto; flex:1; display:flex; flex-direction:column; gap:1.25rem; padding-right:6px;" class="custom-scrollbar">
    `;

    if (matched.length > 0) {
      modalContent += `
            <div>
              <h4 style="color:#14F195; font-size:0.82rem; font-weight:800; margin:0 0 0.5rem 0; letter-spacing:0.5px;">EŞLEŞEN VE YÜKLENECEK KAYITLAR (${matched.length})</h4>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${matchedHtml}
              </div>
            </div>
      `;
    }

    if (unmatched.length > 0) {
      modalContent += `
            <div>
              <h4 style="color:#EF4444; font-size:0.82rem; font-weight:800; margin:0 0 0.5rem 0; letter-spacing:0.5px;">HATALI / EŞLEŞEMEYEN SATIRLAR (${unmatched.length})</h4>
              <div style="display:flex; flex-direction:column; gap:6px;">
                ${unmatchedHtml}
              </div>
            </div>
      `;
    }

    modalContent += `
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1.5rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1rem;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 8px 16px; border-radius: 4px; cursor: pointer; font-weight:700; font-size:0.8rem;">İPTAL</button>
    `;

    if (matched.length > 0) {
      modalContent += `
            <button id="maint-excel-confirm-btn" class="cyber-button primary" style="background: #14F195; color: #0A0E17; border: none; font-weight: 800; padding: 8px 20px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size:0.8rem;">
              <i class="fa-solid fa-circle-check"></i> YÜKLEMEYİ TAMAMLA
            </button>
      `;
    }

    modalContent += `
        </div>
      </div>
    `;

    modal.innerHTML = modalContent;
    document.body.appendChild(modal);

    const confirmBtn = document.getElementById('maint-excel-confirm-btn');
    if (confirmBtn) {
      confirmBtn.onclick = () => {
        (window as any).saveMaintExcelItems(matched, confirmBtn);
      };
    }
  };

  (window as any).saveMaintExcelItems = async (matchedItems: any[], btn: HTMLButtonElement) => {
    const siteId = (window as any).activeMaintSiteId;
    const siteName = (window as any).activeMaintSiteName;

    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> KAYDEDİLİYOR...';
    btn.disabled = true;

    try {
      const { db } = await import('../firebase');
      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');

      const savePromises = matchedItems.map(async (item) => {
        const manualReport = {
          type: 'BAKIM',
          reportNo: 'MAN-' + Date.now().toString().slice(-6) + Math.floor(Math.random() * 100),
          turbineSerial: item.turbineSerial,
          turbineNo: item.turbineNo,
          siteId: siteId,
          siteName: siteName,
          date: item.maintDate,
          faultCode: item.maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı',
          templateName: item.maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı',
          team: 'MANUEL',
          personnel: ['MANUEL'],
          notes: item.notes || 'Excel ile toplu manuel bakım kaydı girildi.',
          status: 'completed',
          createdBy: currentUser?.email || 'Ekip Lideri',
          createdAt: serverTimestamp()
        };

        return addDoc(collection(db, 'serviceReports'), manualReport);
      });

      await Promise.all(savePromises);

      try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        (serviceReportService as any).reportsCache = null;
      } catch (e) {}

      alert(`${matchedItems.length} adet manuel bakım kaydı başarıyla kaydedildi! Sayfa güncelleniyor.`);
      
      const previewModal = document.getElementById('maint-excel-preview-modal');
      if (previewModal) previewModal.remove();

      (window as any).navigate('bakim-planlama');
    } catch (err: any) {
      console.error(err);
      alert('Bakım kayıtları veritabanına yazılırken bir hata oluştu: ' + err.message);
      btn.innerHTML = '<i class="fa-solid fa-circle-check"></i> YÜKLEMEYİ TAMAMLA';
      btn.disabled = false;
    }
  };

  (window as any).openMaintHistoryModal = async (turbineSerial: string, turbineNo: string) => {
    const { serviceReportService } = await import('../services/ServiceReportService');
    const allReports = await serviceReportService.getAllReports();
    const turbineReports = allReports.filter(r => {
      if (r.turbineSerial !== turbineSerial) return false;
      const typeLower = (r.type || '').toLowerCase();
      const templateLower = (r.templateName || '').toLowerCase();
      const faultLower = (r.faultCode || '').toLowerCase();
      return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
             templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
             faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const modal = document.createElement('div');
    modal.className = 'cyber-modal-overlay fade-in';
    modal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.85); z-index:99999; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';

    modal.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 650px; padding: 2.2rem; position: relative; border-top: 4px solid var(--accent-cyan); display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.8); max-height: 85vh; overflow-y: auto;">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: var(--accent-cyan);">
          <i class="fa-solid fa-clock-rotate-left" style="font-size: 1.8rem; text-shadow: 0 0 10px rgba(0,242,255,0.35);"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0; font-weight: 800; letter-spacing: 1px;">${turbineNo} BAKIM GEÇMİŞİ</h3>
        </div>
        
        <div style="margin-bottom: 1.5rem; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-muted); font-weight: bold;">
                <th style="padding: 8px;">Tarih</th>
                <th style="padding: 8px;">Bakım Tipi</th>
                <th style="padding: 8px;">Açıklama / Rapor No</th>
                <th style="padding: 8px; text-align: right;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${turbineReports.length === 0 ? `
                <tr>
                  <td colspan="4" style="padding: 2rem; text-align: center; color: var(--text-muted);">Kayıtlı bakım bulunamadı.</td>
                </tr>
              ` : turbineReports.map(r => {
                const dateVal = r.date ? new Date(r.date).toLocaleDateString('tr-TR') : '-';
                const searchStr = `${r.type} ${r.templateName} ${r.faultCode}`.toLowerCase();
                const maintType = searchStr.includes('ana') ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
                const isManual = r.reportNo?.startsWith('MAN-') || r.team === 'MANUEL';
                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px 8px; font-weight: 700;">${dateVal}</td>
                    <td style="padding: 10px 8px;"><span class="type-badge ${maintType === 'ANA BAKIM' ? 'maintenance' : 'returned'}">${maintType}</span></td>
                    <td style="padding: 10px 8px; max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${r.notes || ''}">
                      <span style="display: block; font-weight: bold; font-size: 0.75rem; color: var(--text-muted);">${r.reportNo || '-'}</span>
                      <span style="font-size: 0.8rem;">${r.notes || '-'}</span>
                    </td>
                    <td style="padding: 10px 8px; text-align: right;">
                      ${(isAdmin && isManual) ? `
                        <button onclick="window.editMaintRecord('${r.id}', '${r.reportNo}')" class="btn-cyber-mini" style="background: rgba(0, 242, 255, 0.1); border: 1px solid rgba(0, 242, 255, 0.3); color: var(--accent-cyan); padding: 4px 8px; cursor: pointer; border-radius: 4px; font-size: 0.75rem; margin-right: 5px;" title="Düzenle">
                          <i class="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button onclick="window.deleteMaintRecord('${r.id}', '${r.reportNo}')" class="btn-cyber-mini" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.3); color: #ff4d4d; padding: 4px 8px; cursor: pointer; border-radius: 4px; font-size: 0.75rem;" title="Sil">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      ` : '-'}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        
        <div style="display: flex; justify-content: flex-end;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 6px 14px; border-radius: 4px; cursor: pointer;">KAPAT</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).deleteMaintRecord = async (id: string, reportNo: string) => {
    if (!isAdmin) {
      alert("Bu işlem için yetkiniz bulunmamaktadır.");
      return;
    }
    if (!reportNo?.startsWith('MAN-')) {
      alert("Sadece manuel olarak eklenmiş bakım kayıtlarını silebilirsiniz.");
      return;
    }
    if (!confirm(`"${reportNo}" numaralı bakım kaydını silmek istediğinize emin misiniz?\nBu işlem geri alınamaz!`)) {
      return;
    }
    try {
      const { db } = await import('../firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'serviceReports', id));

      // Invalidate cache
      try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        (serviceReportService as any).reportsCache = null;
      } catch (e) {}

      alert("Bakım kaydı başarıyla silindi!");
      
      const activeOverlay = document.querySelector('.cyber-modal-overlay');
      if (activeOverlay) activeOverlay.remove();
      (window as any).navigate('bakim-planlama');
    } catch (error: any) {
      console.error("Delete maint error:", error);
      alert("Kayıt silinirken hata oluştu: " + error.message);
    }
  };

  (window as any).editMaintRecord = async (id: string, reportNo: string) => {
    if (!isAdmin) {
      alert("Bu işlem için yetkiniz bulunmamaktadır.");
      return;
    }
    if (!reportNo?.startsWith('MAN-')) {
      alert("Sadece manuel olarak eklenmiş bakım kayıtlarını düzenleyebilirsiniz.");
      return;
    }
    const { serviceReportService } = await import('../services/ServiceReportService');
    const allReports = await serviceReportService.getAllReports();
    const report = allReports.find(r => r.id === id);
    if (!report) {
      alert("Rapor verisi bulunamadı.");
      return;
    }

    const editModal = document.createElement('div');
    editModal.className = 'cyber-modal-overlay edit-sub-modal fade-in';
    editModal.style.cssText = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.9); z-index:100000; display:flex; align-items:center; justify-content:center; backdrop-filter:blur(8px); padding: 1rem; box-sizing: border-box;';

    const searchStr = `${report.type} ${report.templateName} ${report.faultCode}`.toLowerCase();
    const currentMaintType = searchStr.includes('ana') ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';

    editModal.innerHTML = `
      <div class="glass-panel" style="width: 100%; max-width: 450px; padding: 2.2rem; position: relative; border-top: 4px solid var(--accent-cyan); display: flex; flex-direction: column; box-shadow: 0 20px 50px rgba(0,0,0,0.8);">
        <button onclick="this.closest('.cyber-modal-overlay').remove()" style="position: absolute; top: 1rem; right: 1.5rem; background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.5rem;">&times;</button>
        
        <div style="display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; color: var(--accent-cyan);">
          <i class="fa-solid fa-pen-to-square" style="font-size: 1.8rem; text-shadow: 0 0 10px rgba(0,242,255,0.35);"></i>
          <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.4rem; margin: 0; font-weight: 800; letter-spacing: 1px;">BAKIM KAYDINI DÜZENLE</h3>
        </div>

        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          Rapor No: <strong>${reportNo}</strong>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">BAKIM TİPİ</label>
            <select id="edit-maint-type" class="cyber-input" style="width: 100%; font-weight: 700; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
              <option value="ANA BAKIM" ${currentMaintType === 'ANA BAKIM' ? 'selected' : ''}>ANA BAKIM</option>
              <option value="YAĞLAMA BAKIMI" ${currentMaintType === 'YAĞLAMA BAKIMI' ? 'selected' : ''}>YAĞLAMA BAKIMI</option>
            </select>
          </div>

          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">BAKIM TARİHİ</label>
            <input type="date" id="edit-maint-date" class="cyber-input" style="width: 100%; font-weight: 700; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);" value="${report.date || ''}">
          </div>

          <div>
            <label style="display: block; font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 700;">AÇIKLAMA / NOT</label>
            <textarea id="edit-maint-notes" class="cyber-input" rows="3" style="width: 100%; resize: vertical; background: #000; color: #fff; border: 1px solid rgba(255,255,255,0.1);">${report.notes || ''}</textarea>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 1rem;">
          <button onclick="this.closest('.cyber-modal-overlay').remove()" class="btn-cyber-mini" style="background: transparent; border: 1px solid rgba(255,255,255,0.2); color: var(--text-muted); padding: 6px 14px; border-radius: 4px; cursor: pointer;">İPTAL</button>
          <button id="edit-maint-save-btn" class="cyber-button primary" style="background: var(--accent-cyan); color: #000; border: none; font-weight: 800; padding: 6px 16px; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-floppy-disk"></i> GÜNCELLE
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(editModal);

    const saveBtn = document.getElementById('edit-maint-save-btn');
    if (saveBtn) {
      saveBtn.onclick = async () => {
        const typeSelect = document.getElementById('edit-maint-type') as HTMLSelectElement;
        const dateInput = document.getElementById('edit-maint-date') as HTMLInputElement;
        const notesInput = document.getElementById('edit-maint-notes') as HTMLTextAreaElement;

        const newType = typeSelect.value;
        const newDate = dateInput.value;
        const newNotes = notesInput.value.trim();

        if (!newDate) {
          alert("Lütfen tarihi giriniz.");
          return;
        }

        try {
          saveBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> GÜNCELLENİYOR...';
          (saveBtn as HTMLButtonElement).disabled = true;

          const { db } = await import('../firebase');
          const { doc, updateDoc } = await import('firebase/firestore');

          const updateData: any = {
            date: newDate,
            notes: newNotes,
            faultCode: newType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı',
            templateName: newType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı'
          };

          await updateDoc(doc(db, 'serviceReports', id), updateData);

          // Invalidate cache
          try {
            const { serviceReportService } = await import('../services/ServiceReportService');
            (serviceReportService as any).reportsCache = null;
          } catch (e) {}

          alert("Bakım kaydı başarıyla güncellendi!");
          editModal.remove();
          
          const historyOverlay = document.querySelector('.cyber-modal-overlay');
          if (historyOverlay) historyOverlay.remove();
          
          (window as any).navigate('bakim-planlama');
        } catch (error: any) {
          console.error("Update maint error:", error);
          alert("Bakım kaydı güncellenirken hata oluştu: " + error.message);
          saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GÜNCELLE';
          (saveBtn as HTMLButtonElement).disabled = false;
        }
      };
    }
  };

  let maintChartInstance: any = null;

  async function renderMaintChart(filteredItems: any[]) {
    const container = document.getElementById('maint-chart-container');
    const canvas = document.getElementById('maint-monthly-chart') as HTMLCanvasElement;
    const detailsDiv = document.getElementById('maint-chart-details');
    if (!container || !canvas) return;

    if (filteredItems.length === 0 || (window as any).maintViewMode !== 'chart') {
      container.style.display = 'none';
      if (detailsDiv) detailsDiv.style.display = 'none';
      return;
    }

    container.style.display = 'block';
    if (detailsDiv) detailsDiv.style.display = 'block';

    // Calculate monthly distribution for full calendar year (Ocak - Aralık)
    const monthCounts: Record<number, { ana: number, yag: number }> = {};
    const monthlyGroups: Record<number, Record<string, { ana: any[], yag: any[] }>> = {};
    for (let m = 0; m < 12; m++) {
      monthCounts[m] = { ana: 0, yag: 0 };
      monthlyGroups[m] = {};
    }

    const monthNames = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    
    filteredItems.forEach((item: any) => {
      if (item.nextDate) {
        const d = new Date(item.nextDate);
        const m1 = d.getMonth();
        const m2 = (m1 + 6) % 12;

        const site = item.siteName || 'Diğer';
        const tNo = item.turbineNo || item.turbineSerial;
        const tLabel = tNo.startsWith('T-') ? tNo : 'T-' + tNo;

        // Session 1
        monthCounts[m1][item.nextType === 'ANA BAKIM' ? 'ana' : 'yag']++;
        if (!monthlyGroups[m1][site]) {
          monthlyGroups[m1][site] = { ana: [], yag: [] };
        }
        monthlyGroups[m1][site][item.nextType === 'ANA BAKIM' ? 'ana' : 'yag'].push({
          label: tLabel,
          status: item.status,
          serial: item.turbineSerial,
          isNoData: item.lastType === 'VERİ YOK'
        });

        // Session 2 (6 months later)
        const otherType = item.nextType === 'ANA BAKIM' ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';
        monthCounts[m2][otherType === 'ANA BAKIM' ? 'ana' : 'yag']++;
        if (!monthlyGroups[m2][site]) {
          monthlyGroups[m2][site] = { ana: [], yag: [] };
        }
        monthlyGroups[m2][site][otherType === 'ANA BAKIM' ? 'ana' : 'yag'].push({
          label: tLabel,
          status: item.status,
          serial: item.turbineSerial,
          isNoData: item.lastType === 'VERİ YOK'
        });
      }
    });

    const anaData = monthNames.map((_, idx) => monthCounts[idx].ana);
    const yagData = monthNames.map((_, idx) => monthCounts[idx].yag);

    // Build Monthly breakdown cards HTML
    if (detailsDiv) {
      let detailsHtml = `
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:0.75rem;">
          <i class="fa-solid fa-list-check" style="color:var(--accent-cyan); font-size:1.2rem; text-shadow:0 0 8px rgba(0,242,255,0.3);"></i>
          <h4 style="font-family:'Rajdhani',sans-serif; font-size:1.15rem; margin:0; font-weight:800; color:#fff; letter-spacing:1px;">AYLIK PLANLI BAKIM DAĞILIM DETAYLARI</h4>
        </div>
        <div style="display:grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap:15px;">
      `;

      let hasAnyData = false;
      for (let m = 0; m < 12; m++) {
        const monthSites = monthlyGroups[m];
        const siteNames = Object.keys(monthSites);
        if (siteNames.length === 0) continue;

        hasAnyData = true;

        let totalAna = 0;
        let totalYag = 0;
        const siteBreakdowns: string[] = [];

        siteNames.sort().forEach(site => {
          const { ana, yag } = monthSites[site];
          totalAna += ana.length;
          totalYag += yag.length;
          const totalSiteMaint = ana.length + yag.length;
          if (totalSiteMaint > 0) {
            const cleanSiteName = site.replace(/Alize |Anemon |Dares |Mare |Doğal /g, '');
            siteBreakdowns.push(`${cleanSiteName}: ${totalSiteMaint}`);
          }
        });
        
        const siteSummariesJoin = siteBreakdowns.join(', ');

        let monthHtml = `
          <div id="maint-card-${monthNames[m].toLowerCase()}" class="glass-panel" style="padding:1.25rem; border-radius:10px; border-left:4px solid var(--accent-cyan); background:rgba(255,255,255,0.01); display:flex; flex-direction:column; gap:10px; transition: all 0.3s ease;">
            <div style="font-family:'Rajdhani',sans-serif; font-weight:800; color:var(--accent-cyan); font-size:1.1rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:5px; margin-bottom:5px; display:flex; justify-content:space-between; align-items:center;">
              <span>${monthNames[m].toUpperCase()}</span>
              <span style="font-size:0.7rem; color:var(--text-muted); opacity:0.7;">(${siteNames.length} Saha)</span>
            </div>
            
            <!-- Summary Info Block -->
            <div style="background-color: rgba(30, 41, 59, 0.4); border: 1px solid rgba(255, 255, 255, 0.03); border-radius: 6px; padding: 0.5rem; font-size: 0.72rem; color: #94A3B8; line-height: 1.4; display: flex; flex-direction: column; gap: 3px; margin-bottom: 5px;">
              <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 4px; margin-bottom: 2px;">
                <span style="font-weight: 600; color: #E2E8F0;"><i class="fa-solid fa-calendar-check" style="color: #60A5FA; margin-right: 0.35rem;"></i>Aylık Toplam:</span>
                <span style="font-weight: 700; color: #FFF;">${totalAna + totalYag} Bakım</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:6px; height:6px; background-color:#00f2ff; border-radius:50%;"></span>${totalAna} Ana</span>
                <span style="display: inline-flex; align-items: center; gap: 3px;"><span style="display:inline-block; width:6px; height:6px; background-color:#d946ef; border-radius:50%;"></span>${totalYag} Yağlama</span>
              </div>
              <div style="font-size: 0.68rem; color: #64748B; margin-top: 2px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;" title="${siteSummariesJoin}">
                <i class="fa-solid fa-map-pin" style="margin-right: 0.25rem;"></i>${siteSummariesJoin}
              </div>
            </div>
        `;

        const renderBadges = (list: any[], typeName: string) => {
          if (list.length === 0) return '';
          list.sort((a, b) => parseInt(a.label.replace(/\D/g, '') || '0') - parseInt(b.label.replace(/\D/g, '') || '0'));
          
          return list.map(t => {
            const isOverdue = t.status === 'overdue' && !t.isNoData;
            const isWarning = t.status === 'warning';
            
            const icon = isOverdue ? ' <i class="fa-solid fa-triangle-exclamation" style="color:#ff4d4d; font-size:0.6rem; margin-left:2px; animation: pulse 1.5s infinite;"></i>' : 
                         (isWarning ? ' <i class="fa-solid fa-bolt" style="color:#ff9f43; font-size:0.6rem; margin-left:2px;"></i>' : '');
            
            let borderStyle = 'border: 1px solid rgba(255,255,255,0.08);';
            if (isOverdue) {
              borderStyle = 'border: 1px solid rgba(255,77,77,0.5); box-shadow: 0 0 6px rgba(255,77,77,0.25);';
            } else if (isWarning) {
              borderStyle = 'border: 1px solid rgba(255,159,67,0.5); box-shadow: 0 0 6px rgba(255,159,67,0.25);';
            }

            const badgeClass = typeName === 'ana' ? 'maintenance' : 'returned';
            const typeLabel = typeName === 'ana' ? 'Ana Bakım' : 'Yağlama Bakımı';
            const statusText = isOverdue ? 'Gecikmiş' : (isWarning ? 'Kritik Yaklaşan' : 'Planlı');
            const titleText = `${statusText} ${typeLabel}`;

            return `
              <span class="type-badge ${badgeClass}" 
                    onclick="window.createMaintenanceTask('${t.serial}', 'Bakım', '${typeName === 'ana' ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI'}')" 
                    style="font-size:0.65rem; padding:3px 7px; font-weight:700; border-radius:4px; font-family:'Rajdhani',sans-serif; cursor:pointer; display:inline-flex; align-items:center; gap:3px; transition:all 0.2s; ${borderStyle}" 
                    title="${titleText} - İş Emri Açmak İçin Tıkla">
                ${t.label} (${typeName === 'ana' ? 'Ana' : 'Yağ'})${icon}
              </span>
            `;
          }).join('');
        };

        siteNames.sort().forEach(site => {
          const { ana, yag } = monthSites[site];
          monthHtml += `
            <div style="margin-bottom:8px;">
              <div style="font-size:0.75rem; font-weight:800; color:#94A3B8; margin-bottom:5px; display:flex; align-items:center; gap:5px;">
                <i class="fa-solid fa-charging-station" style="font-size:0.7rem; color:var(--accent-cyan);"></i> ${site}
              </div>
              <div style="display:flex; flex-wrap:wrap; gap:4px;">
                ${renderBadges(ana, 'ana')}
                ${renderBadges(yag, 'yag')}
              </div>
            </div>
          `;
        });

        monthHtml += `</div>`;
        detailsHtml += monthHtml;
      }

      if (!hasAnyData) {
        detailsHtml += `
          <div style="grid-column: 1/-1; padding: 2rem; text-align: center; color: var(--text-muted);">
            Planlı bakım verisi bulunmuyor.
          </div>
        `;
      }

      detailsHtml += `</div>`;
      detailsDiv.innerHTML = detailsHtml;
    }

    try {
      const { Chart, registerables } = await import('chart.js');
      Chart.register(...registerables);

      if (maintChartInstance) {
        maintChartInstance.destroy();
      }

      maintChartInstance = new Chart(canvas, {
        type: 'line',
        data: {
          labels: monthNames,
          datasets: [
            {
              label: 'Ana Bakım',
              data: anaData,
              borderColor: '#00f2ff',
              backgroundColor: 'rgba(0, 242, 255, 0.08)',
              fill: true,
              tension: 0.45,
              borderWidth: 3,
              pointBackgroundColor: '#00f2ff',
              pointBorderColor: '#0A0E17',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7
            },
            {
              label: 'Yağlama Bakımı',
              data: yagData,
              borderColor: '#9b59b6',
              backgroundColor: 'rgba(155, 89, 182, 0.08)',
              fill: true,
              tension: 0.45,
              borderWidth: 3,
              pointBackgroundColor: '#9b59b6',
              pointBorderColor: '#0A0E17',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          onClick: (event, elements) => {
            if (elements && elements.length > 0) {
              const elementIndex = elements[0].index;
              const monthName = monthNames[elementIndex].toLowerCase();
              const targetCard = document.getElementById(`maint-card-${monthName}`);
              if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Glow animation
                targetCard.style.boxShadow = '0 0 25px var(--accent-cyan)';
                targetCard.style.borderLeftColor = '#ffffff';
                targetCard.style.background = 'rgba(0, 242, 255, 0.04)';
                setTimeout(() => {
                  targetCard.style.boxShadow = 'none';
                  targetCard.style.borderLeftColor = 'var(--accent-cyan)';
                  targetCard.style.background = 'rgba(255, 255, 255, 0.01)';
                }, 1200);
              }
            }
          },
          plugins: {
            legend: {
              labels: {
                color: '#94A3B8',
                font: {
                  family: 'Rajdhani',
                  weight: 'bold'
                }
              }
            },
            title: {
              display: true,
              text: 'Yıllık Periyodik Bakım Dağılım Grafiği (Ocak - Aralık)',
              color: '#E2E8F0',
              font: {
                family: 'Rajdhani',
                size: 14,
                weight: 'bold'
              }
            }
          },
          scales: {
            x: {
              grid: {
                color: 'rgba(255, 255, 255, 0.04)'
              },
              ticks: {
                color: '#94A3B8',
                font: {
                  family: 'Rajdhani',
                  weight: 'bold'
                }
              }
            },
            y: {
              grid: {
                color: 'rgba(255, 255, 255, 0.04)'
              },
              ticks: {
                color: '#94A3B8',
                stepSize: 1,
                font: {
                  family: 'Rajdhani',
                  weight: 'bold'
                }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Failed to render Chart.js:', err);
    }
  }

  (window as any).maintViewMode = 'table';
  (window as any).setMaintViewMode = (mode: string) => {
    (window as any).maintViewMode = mode;
    const tableBtn = document.getElementById('maint-view-table-btn');
    const chartBtn = document.getElementById('maint-view-chart-btn');
    const chartContainer = document.getElementById('maint-chart-container');
    const chartDetails = document.getElementById('maint-chart-details');
    const tableFrame = document.querySelector('.table-frame');
    const filterTabs = document.querySelector('.maint-filter-tabs');

    if (mode === 'chart') {
      if (tableBtn) {
        tableBtn.style.background = 'transparent';
        tableBtn.style.borderColor = 'transparent';
        tableBtn.style.color = 'var(--text-muted)';
      }
      if (chartBtn) {
        chartBtn.style.background = 'rgba(0, 242, 255, 0.1)';
        chartBtn.style.borderColor = 'var(--accent-cyan)';
        chartBtn.style.color = 'var(--accent-cyan)';
      }
      if (chartContainer) chartContainer.style.display = 'block';
      if (chartDetails) chartDetails.style.display = 'block';
      if (tableFrame) (tableFrame as HTMLElement).style.display = 'none';
      if (filterTabs) (filterTabs as HTMLElement).style.display = 'none';
      
      // Update chart with current items
      const activeItem = document.querySelector('.site-menu-item.active') as HTMLElement;
      const site = activeItem?.getAttribute('data-site');
      if (site && (window as any).updateMaintTable) {
        (window as any).updateMaintTable(site);
      }
    } else {
      if (tableBtn) {
        tableBtn.style.background = 'rgba(0, 242, 255, 0.1)';
        tableBtn.style.borderColor = 'var(--accent-cyan)';
        tableBtn.style.color = 'var(--accent-cyan)';
      }
      if (chartBtn) {
        chartBtn.style.background = 'transparent';
        chartBtn.style.borderColor = 'transparent';
        chartBtn.style.color = 'var(--text-muted)';
      }
      if (chartContainer) chartContainer.style.display = 'none';
      if (chartDetails) chartDetails.style.display = 'none';
      if (tableFrame) (tableFrame as HTMLElement).style.display = 'block';
      if (filterTabs) (filterTabs as HTMLElement).style.display = 'flex';
      
      // Update table with current items
      const activeItem = document.querySelector('.site-menu-item.active') as HTMLElement;
      const site = activeItem?.getAttribute('data-site');
      if (site && (window as any).updateMaintTable) {
        (window as any).updateMaintTable(site);
      }
    }
  };

  (window as any).initMaintenancePlanning = () => {
    // Ensure we start in table mode on initialization
    if ((window as any).setMaintViewMode) {
      (window as any).setMaintViewMode('table');
    }

    (window as any).maintSortOption = 'days';
    const body = document.getElementById('maint-data-body');
    const title = document.getElementById('active-site-title');
    if (!body || !title) return;

    let currentSite = initialSite;

    function updateSidebarBadges() {
      let activePlan = planGeneral;
      let activeGrouped = maintDataGeneral;
      if (activeMaintCategory === 'RULMAN') {
        activePlan = planRulman;
        activeGrouped = maintDataRulman;
      } else if (activeMaintCategory === '4YEAR') {
        activePlan = plan4Year;
        activeGrouped = maintData4Year;
      }

      // Update TUM SAHALAR badge
      const tumOverdue = activePlan.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-').length;
      const badgeAll = document.getElementById('badge-site-all');
      if (badgeAll) {
        if (tumOverdue > 0) {
          badgeAll.textContent = String(tumOverdue);
          badgeAll.style.display = 'inline-flex';
          badgeAll.className = 'alert-badge overdue';
        } else {
          badgeAll.style.display = 'none';
        }
      }

      // Update site badges
      siteList.forEach(siteName => {
        const siteClean = siteName.replace(/\s+/g, '-');
        const badge = document.getElementById(`badge-site-${siteClean}`);
        if (badge) {
          const siteOverdueCount = (activeGrouped[siteName] || []).filter((i: any) => i.status === 'overdue' && i.lastDate !== '-').length;
          const siteWarningCount = (activeGrouped[siteName] || []).filter((i: any) => i.status === 'warning').length;
          
          if (siteOverdueCount > 0) {
            badge.textContent = String(siteOverdueCount);
            badge.style.display = 'inline-flex';
            badge.className = 'alert-badge overdue';
          } else if (siteWarningCount > 0) {
            badge.textContent = String(siteWarningCount);
            badge.style.display = 'inline-flex';
            badge.className = 'alert-badge warning';
          } else {
            badge.style.display = 'none';
          }
        }
      });
    }

    function renderTurbineModelCounts(sName: string) {
      const container = document.getElementById('turbine-model-counts-container');
      if (!container) return;
      if (!isFen) {
        container.style.display = 'none';
        return;
      }

      let turbines: any[] = [];
      const sites = dataService.getSites();
      if (sName === 'TÜM SAHALAR') {
        sites.forEach(s => {
          turbines.push(...dataService.getTurbinesBySite(s.id));
        });
      } else {
        const sObj = sites.find(s => s.name === sName);
        if (sObj) {
          turbines = dataService.getTurbinesBySite(sObj.id);
        }
      }

      const counts: Record<string, number> = {};

      turbines.forEach(t => {
        // Exclude control equipment (RTU, FCU, SAİ)
        const cType = (t.controlType || '').toUpperCase();
        if (cType.includes('RTU') || cType.includes('FCU') || cType.includes('SAI')) {
          return;
        }

        let modelKey = (t.type || '').toUpperCase().trim();
        const serial = String(t.id || '').trim();

        if (modelKey.includes('E82/E2') || modelKey.includes('E82-E2') || modelKey.includes('E82E2') || serial.startsWith('8264') || serial.startsWith('8257') || serial.startsWith('8241')) {
          modelKey = 'E82/E2';
        } else if (modelKey.includes('E82') || serial.startsWith('82')) {
          modelKey = 'E82';
        } else if (modelKey.includes('E70') || serial.startsWith('78')) {
          modelKey = 'E70';
        } else if (modelKey.includes('E92') || serial.startsWith('92')) {
          modelKey = 'E92';
        } else if (modelKey === 'E40' || serial.startsWith('41')) {
          modelKey = 'E40';
        } else if (modelKey === 'E44' || serial.startsWith('45')) {
          modelKey = 'E44';
        } else if (modelKey === 'E48' || serial.startsWith('48')) {
          modelKey = 'E48';
        } else if (modelKey === 'E44-E48') {
          if (serial.startsWith('45')) modelKey = 'E44';
          else modelKey = 'E48';
        }

        if (modelKey) {
          counts[modelKey] = (counts[modelKey] || 0) + 1;
        }
      });

      const preferredOrder = ['E40', 'E44', 'E48', 'E70', 'E82', 'E82/E2', 'E92'];
      const presentModels = Object.keys(counts).sort((a, b) => {
        const ia = preferredOrder.indexOf(a);
        const ib = preferredOrder.indexOf(b);
        if (ia !== -1 && ib !== -1) return ia - ib;
        if (ia !== -1) return -1;
        if (ib !== -1) return 1;
        return a.localeCompare(b);
      });

      const colorMap: Record<string, string> = {
        'E40': '#38bdf8',
        'E44': '#ffb900',
        'E48': '#f59e0b',
        'E70': '#a855f7',
        'E82': '#14f195',
        'E82/E2': '#00f2ff',
        'E92': '#ec4899'
      };

      let badgesHtml = '';
      presentModels.forEach(modelKey => {
        const count = counts[modelKey];
        if (count > 0) {
          const badgeColor = colorMap[modelKey] || '#00f2ff';
          badgesHtml += `
            <div style="display: inline-flex; align-items: center; gap: 4px; background: rgba(255, 255, 255, 0.03); height: 30px; padding: 0 8px; border-radius: 6px; border: 1.2px solid ${badgeColor}50; font-family: 'Rajdhani', sans-serif; font-size: 0.68rem; font-weight: 800; color: #E2E8F0; transition: all 0.2s; box-shadow: 0 2px 6px rgba(0,0,0,0.2); box-sizing: border-box;" title="${sName} - ${modelKey} Türbin Sayısı">
              <span style="color: ${badgeColor}; font-weight: 800; letter-spacing: 0.4px;">${modelKey}:</span>
              <span style="color: #FFF; background: ${badgeColor}35; padding: 1px 5px; border-radius: 4px; font-size: 0.68rem; font-family: tabular-nums; font-weight: 800;">${count}</span>
            </div>
          `;
        }
      });

      container.innerHTML = badgesHtml;
    }

    function updateTable(siteName: string) {
      currentSite = siteName;
      sessionStorage.setItem('activeMaintSiteName', siteName);
      
      let activePlan = planGeneral;
      let activeGrouped = maintDataGeneral;
      if (activeMaintCategory === 'RULMAN') {
        activePlan = planRulman;
        activeGrouped = maintDataRulman;
      } else if (activeMaintCategory === '4YEAR') {
        activePlan = plan4Year;
        activeGrouped = maintData4Year;
      }

      const allItems = siteName === 'TÜM SAHALAR' ? activePlan : (activeGrouped[siteName] || []);
      title!.textContent = siteName.toUpperCase();
      
      if (siteName === 'TÜM SAHALAR') {
        (window as any).activeMaintSiteId = 'ALL';
        (window as any).activeMaintSiteName = 'TÜM SAHALAR';
      } else {
        const siteObj = dataService.getSites().find(s => s.name === siteName);
        (window as any).activeMaintSiteId = siteObj?.id;
        (window as any).activeMaintSiteName = siteName;
      }

      // Ensure Excel action buttons remain visible across all sites including TÜM SAHALAR
      const btnExcelDownload = document.querySelector('button[onclick="window.downloadMaintPlanningExcel()"]');
      const btnExcelUpload = document.getElementById('btn-upload-maint-excel');
      const btnManualMaint = document.querySelector('button[onclick="window.openManualMaintModal()"]');
      const btnTemplateExcel = document.querySelector('button[onclick="window.downloadMaintTemplateExcel()"]');
      if (btnExcelDownload) (btnExcelDownload as HTMLElement).style.display = 'inline-flex';
      if (btnExcelUpload) (btnExcelUpload as HTMLElement).style.display = 'inline-flex';
      if (btnManualMaint) (btnManualMaint as HTMLElement).style.display = 'inline-flex';
      if (btnTemplateExcel) (btnTemplateExcel as HTMLElement).style.display = 'inline-flex';

      // Update top header stats
      const overdueVal = document.getElementById('h-stat-overdue-val');
      const warningVal = document.getElementById('h-stat-warning-val');
      const safeVal = document.getElementById('h-stat-safe-val');
      const rateVal = document.getElementById('h-stat-rate-val');

      const totalOverdue = activePlan.filter((p: any) => p.status === 'overdue' && p.lastDate !== '-').length;
      const totalWarning = activePlan.filter((p: any) => p.status === 'warning').length;
      const totalSafe = activePlan.filter((p: any) => p.status === 'safe' && p.lastDate !== '-').length;
      const totalHasMaint = activePlan.filter((p: any) => p.lastDate !== '-').length;
      const totalRate = activePlan.length > 0 ? Math.round((totalHasMaint / activePlan.length) * 100) : 0;

      if (overdueVal) overdueVal.textContent = String(totalOverdue);
      if (warningVal) warningVal.textContent = String(totalWarning);
      if (safeVal) safeVal.textContent = String(totalSafe);
      if (rateVal) rateVal.textContent = `${totalRate}%`;

      // Update sidebar badges
      updateSidebarBadges();
      renderTurbineModelCounts(siteName);

      // Calculate dynamic filter counts
      const overdueCount = allItems.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-').length;
      const warningCount = allItems.filter((i: any) => i.status === 'warning').length;
      const safeCount = allItems.filter((i: any) => i.status === 'safe' && i.lastDate !== '-').length;
      const nodataCount = allItems.filter((i: any) => i.lastDate === '-').length;
      
      const tabAll = document.getElementById('maint-tab-all');
      const tabOverdue = document.getElementById('maint-tab-overdue');
      const tabWarning = document.getElementById('maint-tab-warning');
      const tabSafe = document.getElementById('maint-tab-safe');
      const tabNodata = document.getElementById('maint-tab-nodata');
      
      if (tabAll) tabAll.querySelector('.c')!.textContent = String(allItems.length);
      if (tabOverdue) tabOverdue.querySelector('.c')!.textContent = String(overdueCount);
      if (tabWarning) tabWarning.querySelector('.c')!.textContent = String(warningCount);
      if (tabSafe) tabSafe.querySelector('.c')!.textContent = String(safeCount);
      if (tabNodata) tabNodata.querySelector('.c')!.textContent = String(nodataCount);
      
      // Render quick stats cards dynamically
      const statsContainer = document.getElementById('maint-quick-stats');
      if (statsContainer) {
        // Filter out control systems (RTU, FCU, SAİ) for stats cards calculations
        const turbineOnlyItems = allItems.filter((i: any) => {
          const tNo = String(i.turbineNo || '').toUpperCase().trim();
          const tSerial = String(i.turbineSerial || '').toUpperCase().trim();
          return !(
            tNo.includes('RTU') || tNo.includes('FCU') || tNo.includes('SAİ') || tNo.includes('SAI') ||
            tSerial.includes('RTU') || tSerial.includes('FCU') || tSerial.includes('SAİ') || tSerial.includes('SAI')
          );
        });

        const totalTurbinesCount = turbineOnlyItems.length;
        const overdueTurbinesCount = turbineOnlyItems.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-').length;
        const warningTurbinesCount = turbineOnlyItems.filter((i: any) => i.status === 'warning').length;
        const safeTurbinesCount = turbineOnlyItems.filter((i: any) => i.status === 'safe' && i.lastDate !== '-').length;

        statsContainer.innerHTML = `
          <div class="m-stat-card" style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; transition: all 0.3s;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(0, 242, 255, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: var(--accent-cyan);">
              <i class="fa-solid fa-charging-station"></i>
            </div>
            <div>
              <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Toplam Türbin</div>
              <div style="font-size: 1.4rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #fff; margin-top: 2px;">${totalTurbinesCount} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Adet</span></div>
            </div>
          </div>
          <div class="m-stat-card" style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,77,77,0.08); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; transition: all 0.3s;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255, 77, 77, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #ff4d4d;">
              <i class="fa-solid fa-triangle-exclamation"></i>
            </div>
            <div>
              <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Kritik Geciken</div>
              <div style="font-size: 1.4rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #ff4d4d; margin-top: 2px;">${overdueTurbinesCount} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Türbin</span></div>
            </div>
          </div>
          <div class="m-stat-card" style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,159,67,0.08); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; transition: all 0.3s;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(255, 159, 67, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #ff9f43;">
              <i class="fa-solid fa-circle-exclamation"></i>
            </div>
            <div>
              <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Yaklaşan Bakım</div>
              <div style="font-size: 1.4rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #ff9f43; margin-top: 2px;">${warningTurbinesCount} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Türbin</span></div>
            </div>
          </div>
          <div class="m-stat-card" style="flex: 1; min-width: 200px; background: rgba(255,255,255,0.02); border: 1px solid rgba(30,215,96,0.08); border-radius: 12px; padding: 15px; display: flex; align-items: center; gap: 15px; transition: all 0.3s;">
            <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(30, 215, 96, 0.08); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #1ed760;">
              <i class="fa-solid fa-circle-check"></i>
            </div>
            <div>
              <div style="font-size: 0.7rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Planlı & Güvenli</div>
              <div style="font-size: 1.4rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; color: #1ed760; margin-top: 2px;">${safeTurbinesCount} <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 500;">Türbin</span></div>
            </div>
          </div>
        `;
      }
      
      // Filter items
      let items = allItems;
      if (activeMaintFilter === 'OVERDUE') {
        items = allItems.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-');
      } else if (activeMaintFilter === 'WARNING') {
        items = allItems.filter((i: any) => i.status === 'warning');
      } else if (activeMaintFilter === 'SAFE') {
        items = allItems.filter((i: any) => i.status === 'safe' && i.lastDate !== '-');
      } else if (activeMaintFilter === 'NODATA') {
        items = allItems.filter((i: any) => i.lastDate === '-');
      }

      // Filter items by search query
      const query = ((window as any).maintTurbineSearchQuery || '').trim().toLowerCase();
      if (query) {
        items = items.filter((i: any) => {
          const tNo = String(i.turbineNo || '').toLowerCase();
          const tName = tNo.startsWith('t-') ? tNo : 't-' + tNo;
          return tName.includes(query) || tNo.includes(query) || (i.turbineSerial || '').toLowerCase().includes(query);
        });
      }

      // Sort items based on sortOption
      const sortOption = (window as any).maintSortOption || 'days';
      items = [...items]; // Copy to avoid mutating original source data
      if (sortOption === 'days') {
        items.sort((a: any, b: any) => {
          const aNoData = a.lastDate === '-';
          const bNoData = b.lastDate === '-';
          if (aNoData && !bNoData) return 1;
          if (!aNoData && bNoData) return -1;
          if (aNoData && bNoData) return 0;
          return a.daysRemaining - b.daysRemaining;
        });
      } else if (sortOption === 'turbine') {
        items.sort((a: any, b: any) => {
          const getNum = (label: string) => {
            const num = parseInt(label.replace(/[^0-9]/g, ''), 10);
            return isNaN(num) ? 999999 : num;
          };
          const aNum = getNum(String(a.turbineNo));
          const bNum = getNum(String(b.turbineNo));
          if (aNum !== bNum) return aNum - bNum;
          return String(a.turbineNo).localeCompare(String(b.turbineNo), undefined, { numeric: true, sensitivity: 'base' });
        });
      }

      // Render maintenance intensity chart
      renderMaintChart(items);
      
      if (items.length === 0) {
        body!.innerHTML = `
          <tr>
            <td colspan="7" style="padding: 4rem; text-align: center; color: var(--text-muted);">
              <i class="fa-solid fa-clipboard-check" style="font-size: 2.5rem; opacity: 0.15; margin-bottom: 1rem; display: block; color: var(--accent-cyan);"></i>
              <p style="font-size: 0.85rem; font-weight: 600; margin: 0;">Bu filtreye uygun türbin kaydı bulunamadı.</p>
            </td>
          </tr>
        `;
        return;
      }
      
      let html = '';
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const dateStr = item.lastDate === '-' ? '-' : new Date(item.lastDate).toLocaleDateString('tr-TR');
        const isNoData = item.lastType === 'VERİ YOK';
        const tNo = String(item.turbineNo || '');
        const tName = tNo.startsWith('T-') ? tNo : 'T-' + tNo;
        const lastMaintType = item.lastType === 'ANA BAKIM' ? 'Ana Bakım' : (item.lastType === 'YAĞLAMA BAKIMI' ? 'Yağlama Bakımı' : item.lastType);
        const nextMaintType = item.nextType === 'ANA BAKIM' ? 'Ana Bakım' : (item.nextType === 'YAĞLAMA BAKIMI' ? 'Yağlama Bakımı' : item.nextType);
        const daysTxt = isNoData ? '-' : (item.daysRemaining < 0 ? Math.abs(item.daysRemaining) + ' Gün Geçti' : item.daysRemaining + ' Gün');
        const statusTxt = isNoData ? 'Kayıt Yok' : (item.status === 'overdue' ? 'Kritik Gecikme' : (item.status === 'warning' ? 'Yaklaşıyor' : 'Planlı'));
        const statusClass = isNoData ? 'none' : item.status;
        const serial = item.turbineSerial || '';
        
        const lastBadgeClass = item.lastType === 'ANA BAKIM' ? 'maintenance' : (item.lastType === 'YAĞLAMA BAKIMI' ? 'returned' : 'none');
        const nextBadgeClass = item.nextType === 'ANA BAKIM' ? 'maintenance' : (item.nextType === 'YAĞLAMA BAKIMI' ? 'returned' : 'none');
        
        // Show site name next to turbine in "TÜM SAHALAR" mode
        const siteSuffix = siteName === 'TÜM SAHALAR' ? ` <span style="font-size:0.72rem; color:#64748B; margin-left:5px; font-weight:600;">(${item.siteName})</span>` : '';
        const turbineTypeStr = item.turbineType ? ` ${item.turbineType}` : '';
        const serialSuffix = `<span style="font-size:0.72rem; color:#8A99AD; margin-left:6px; font-weight:600; font-family:'Rajdhani',sans-serif; letter-spacing:0.5px;">(${serial}${turbineTypeStr})</span>`;

        html += `<tr style="${isNoData ? 'opacity: 0.7;' : ''}">`;
        html += `<td class="t-no"><span class="turbine-id-badge" style="font-size: 0.8rem; font-weight: 800; font-family: 'Rajdhani', sans-serif;">${tName}</span>${serialSuffix}${siteSuffix}</td>`;
        html += `<td style="font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent-cyan); cursor: pointer; text-decoration: underline dotted rgba(0,242,255,0.4);" onclick="window.openMaintHistoryModal('${serial}', '${tName}')" title="Bakım Geçmişini Görüntüle"><i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px; font-size: 0.8rem; opacity: 0.8;"></i>${dateStr}</td>`;
        html += `<td style="text-align: center;"><span class="type-badge ${lastBadgeClass}">${lastMaintType}</span></td>`;
        html += `<td style="text-align: center;"><span class="type-badge next ${nextBadgeClass}">${nextMaintType}</span></td>`;
        html += `<td class="days-val ${item.status}" style="text-align: center;">${daysTxt}</td>`;
        html += `<td style="text-align: center;">
                   <span class="status-pill ${statusClass}">
                     <span class="status-dot ${isNoData ? 'gray' : (item.status === 'overdue' ? 'red' : (item.status === 'warning' ? 'orange' : 'green'))}" style="background: ${isNoData ? 'rgba(255,255,255,0.45)' : (item.status === 'overdue' ? '#ff4d4d' : (item.status === 'warning' ? '#ff9f43' : '#1ed760'))}; box-shadow: 0 0 8px ${isNoData ? 'transparent' : (item.status === 'overdue' ? '#ff4d4d' : (item.status === 'warning' ? '#ff9f43' : '#1ed760'))};"></span>
                     ${statusTxt}
                   </span>
                 </td>`;
        html += `<td style="text-align: right; white-space: nowrap;">`;
        if (isNoData) {
          html += `<button class="maint-action-btn" onclick="window.createMaintenanceTask('${serial}', 'Bakım', '')"><i class="fa-solid fa-plus"></i> İş Emri Aç</button>`;
        } else if (item.status === 'overdue' || item.status === 'warning') {
          html += `<button class="maint-action-btn overdue" onclick="window.createMaintenanceTask('${serial}', 'Bakım', '${item.nextType}')"><i class="fa-solid fa-triangle-exclamation"></i> Bakım Yap</button>`;
        } else {
          html += `<span style="color: rgba(255,255,255,0.25); font-size: 0.65rem; font-weight: 800; padding-right: 8px; font-family: 'Rajdhani', sans-serif;"><i class="fa-solid fa-circle-check" style="margin-right: 5px; color: #1ed760;"></i> Programlı</span>`;
        }
        html += `</td>`;
        html += '</tr>';
      }
      body!.innerHTML = html;
    }

    (window as any).updateMaintTable = updateTable;

    // Initialize first site
    if (initialSite) updateTable(initialSite);

    // Event listeners
    document.querySelectorAll('.site-menu-item').forEach(item => {
      item.addEventListener('click', function(this: HTMLElement) {
        document.querySelectorAll('.site-menu-item').forEach(i => i.classList.remove('active'));
        this.classList.add('active');
        const s = this.getAttribute('data-site');
        if (s) updateTable(s);
      });
    });

    const searchInput = document.getElementById('maint-site-search');
    if (searchInput) {
      searchInput.addEventListener('input', function(this: HTMLInputElement) {
        const q = this.value.toLowerCase();
        document.querySelectorAll('.site-menu-item').forEach(it => {
          const n = (it as HTMLElement).getAttribute('data-site')?.toLowerCase() || '';
          (it as HTMLElement).style.display = n.indexOf(q) > -1 ? 'flex' : 'none';
        });
      });
    }
  };

  return `
    <div class="fade-in-up maintenance-planning-container">
      <div class="page-header">
        <div class="header-content">
          <h1><i class="fa-solid fa-calendar-check" style="color: var(--accent-cyan); text-shadow: 0 0 10px rgba(0, 242, 255, 0.35);"></i> BAKIM PLANLAMA MERKEZİ</h1>
          <p>Periyodik bakım planlama ve saha bazlı takip merkezi.</p>
        </div>
        <div class="header-stats">
          <div class="h-stat overdue" style="cursor: pointer; transition: transform 0.2s;" onclick="window.filterMaintTable('OVERDUE')" title="Gecikmiş bakımları listele">
            <span id="h-stat-overdue-val" class="v">-</span>
            <span class="l">GECİKMİŞ</span>
          </div>
          <div class="h-stat warning" style="cursor: pointer; transition: transform 0.2s;" onclick="window.filterMaintTable('WARNING')" title="Kritik/Yaklaşan bakımları listele">
            <span id="h-stat-warning-val" class="v">-</span>
            <span class="l">KRİTİK</span>
          </div>
          <div class="h-stat safe-stat" style="cursor: pointer; transition: transform 0.2s;" onclick="window.filterMaintTable('SAFE')" title="Planlı ve güvenli olanları listele">
            <span id="h-stat-safe-val" class="v">-</span>
            <span class="l">PLANLI & GÜVENLİ</span>
          </div>
          <div class="h-stat rate">
            <span id="h-stat-rate-val" class="v" style="color: var(--accent-cyan); text-shadow: 0 0 8px rgba(0,242,255,0.3);">-</span>
            <span class="l">BAKIM ORANI</span>
          </div>
        </div>
      </div>

      <div class="maintenance-planning-layout">
        <!-- Sidebar -->
        <div class="sites-sidebar glass-panel">
          <div class="sidebar-header">
            <div class="search-wrapper">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="maint-site-search" placeholder="Saha ara...">
            </div>
          </div>
          <div class="sites-list custom-scrollbar">
            <div class="site-menu-item ${initialSite === 'TÜM SAHALAR' ? 'active' : ''}" data-site="TÜM SAHALAR">
              <i class="fa-solid fa-globe" style="color: var(--accent-cyan); text-shadow: 0 0 5px rgba(0,242,255,0.35);"></i>
              <span class="s-name" style="font-weight: 700;">TÜM SAHALAR</span>
              <span id="badge-site-all" class="alert-badge overdue" style="display: none;"></span>
            </div>
            ${siteList.map((siteName, idx) => {
              const siteClean = siteName.replace(/\s+/g, '-');
              const isActive = siteName === initialSite;
              return `
                <div class="site-menu-item ${isActive ? 'active' : ''}" data-site="${siteName}">
                  <i class="fa-solid fa-charging-station"></i>
                  <span class="s-name">${siteName}</span>
                  <span id="badge-site-${siteClean}" class="alert-badge" style="display: none;"></span>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Main Content -->
        <div class="maintenance-main-content glass-panel">
          <div class="view-header" style="flex-direction: column; align-items: stretch; gap: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div class="site-title-box" style="display: flex; align-items: center; gap: 12px;">
                <i class="fa-solid fa-wind"></i>
                <h2 id="active-site-title">${initialSite.toUpperCase() || 'SAHA SEÇİN'}</h2>
                <div style="display: flex; gap: 4px; margin-left: 6px; background: rgba(255,255,255,0.03); padding: 2px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08); align-items: center; height: 30px; box-sizing: border-box;">
                  <button id="maint-view-table-btn" onclick="window.setMaintViewMode('table')" style="background: rgba(0, 242, 255, 0.1); border: 1px solid var(--accent-cyan); color: var(--accent-cyan); cursor: pointer; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.68rem; padding: 0 9px; height: 100%; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-table"></i> TABLO GÖRÜNÜMÜ
                  </button>
                  <button id="maint-view-chart-btn" onclick="window.setMaintViewMode('chart')" style="background: transparent; border: 1px solid transparent; color: var(--text-muted); cursor: pointer; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.68rem; padding: 0 9px; height: 100%; border-radius: 4px; transition: all 0.2s; display: flex; align-items: center; gap: 4px;">
                    <i class="fa-solid fa-chart-bar"></i> HEDEF GRAFİK
                  </button>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                ${isFen ? `
                <button class="maint-action-btn" onclick="window.downloadMaintTemplateExcel()" style="background: rgba(255, 235, 59, 0.06); border-color: rgba(255, 235, 59, 0.25); color: #fded7e;" title="Excel Yükleme Şablonunu İndir">
                  <i class="fa-solid fa-download"></i> ŞABLON İNDİR
                </button>
                <button class="maint-action-btn" onclick="window.downloadMaintPlanningExcel()" style="background: rgba(0, 242, 255, 0.06); border-color: rgba(0, 242, 255, 0.25); color: var(--accent-cyan);">
                  <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
                </button>
                <input type="file" id="maint-excel-upload-input" accept=".xlsx, .xls" style="display: none;" onchange="window.handleMaintExcelUpload(event)" />
                <button class="maint-action-btn" id="btn-upload-maint-excel" onclick="document.getElementById('maint-excel-upload-input').click()" style="background: rgba(20, 241, 149, 0.06); border-color: rgba(20, 241, 149, 0.25); color: #14F195;">
                  <i class="fa-solid fa-upload"></i> EXCEL YÜKLE
                </button>
                <button class="maint-action-btn" onclick="window.openManualMaintModal()" style="background: rgba(100, 255, 218, 0.06); border-color: rgba(100, 255, 218, 0.25); color: #64ffda;">
                  <i class="fa-solid fa-wrench"></i> MANUEL BAKIM EKLE
                </button>
                ` : ''}
                <div class="maint-legend">
                  <span class="leg-box overdue">Gecikmiş</span>
                  <span class="leg-box warning">Kritik</span>
                  <span class="leg-box safe">Planlı</span>
                </div>
              </div>
            </div>
            <!-- Dedicated Turbine Model Badges Bar -->
            ${isFen ? `
            <div id="turbine-model-counts-container" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; background: rgba(0, 0, 0, 0.15); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.04);"></div>
            ` : ''}
          </div>

          <!-- Quick Stats Cards Container -->
          <div id="maint-quick-stats" style="display: flex; gap: 15px; margin-bottom: 20px; flex-wrap: wrap;"></div>

          <!-- Maintenance Category Selector Tabs -->
          <div class="maint-category-selector" style="display: flex; gap: 10px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
            <button class="maint-cat-tab active" id="maint-cat-general" onclick="window.setMaintCategory('GENERAL')" style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.82rem; letter-spacing: 1px; padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(0, 242, 255, 0.25); background: rgba(0, 242, 255, 0.05); color: var(--accent-cyan); cursor: pointer; transition: all 0.25s;">
              <i class="fa-solid fa-calendar-check" style="margin-right: 6px;"></i> GENEL BAKIMLAR (ANA / YAĞLAMA)
            </button>
            <button class="maint-cat-tab" id="maint-cat-rulman" onclick="window.setMaintCategory('RULMAN')" style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.82rem; letter-spacing: 1px; padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: var(--text-muted); cursor: pointer; transition: all 0.25s;">
              <i class="fa-solid fa-circle-nodes" style="margin-right: 6px;"></i> RULMAN KONTROLÜ (5 AY)
            </button>
            <button class="maint-cat-tab" id="maint-cat-4year" onclick="window.setMaintCategory('4YEAR')" style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.82rem; letter-spacing: 1px; padding: 8px 18px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.02); color: var(--text-muted); cursor: pointer; transition: all 0.25s;">
              <i class="fa-solid fa-hourglass-half" style="margin-right: 6px;"></i> 4 YILLIK BAKIM (48 AY)
            </button>
          </div>

          <div class="maint-filter-tabs" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
              <button class="maint-tab active" id="maint-tab-all" onclick="window.filterMaintTable('ALL')">
                <i class="fa-solid fa-layer-group"></i> HEPSİ <span class="c">-</span>
              </button>
              <button class="maint-tab overdue" id="maint-tab-overdue" onclick="window.filterMaintTable('OVERDUE')">
                <i class="fa-solid fa-triangle-exclamation"></i> GECİKMİŞ <span class="c">-</span>
              </button>
              <button class="maint-tab warning" id="maint-tab-warning" onclick="window.filterMaintTable('WARNING')">
                <i class="fa-solid fa-circle-exclamation"></i> YAKLAŞANLAR <span class="c">-</span>
              </button>
              <button class="maint-tab safe" id="maint-tab-safe" onclick="window.filterMaintTable('SAFE')">
                <i class="fa-solid fa-circle-check"></i> PLANLI & GÜVENLİ <span class="c">-</span>
              </button>
              <button class="maint-tab nodata" id="maint-tab-nodata" onclick="window.filterMaintTable('NODATA')">
                <i class="fa-solid fa-circle-question"></i> VERİ YOK <span class="c">-</span>
              </button>
            </div>
            <!-- Sort and Search Controls -->
            <div style="display: flex; gap: 10px; align-items: center;">
              <!-- Sort Select -->
              <div style="position: relative; width: 190px;">
                <select id="maint-sort-select" onchange="window.handleMaintSortChange(this.value)" style="width: 100%; padding: 6px 24px 6px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; font-size: 0.75rem; font-family: 'Rajdhani', sans-serif; font-weight: 600; outline: none; cursor: pointer; transition: all 0.2s; appearance: none; -webkit-appearance: none;">
                  <option value="days" style="background: #0d1117; color: #fff;" selected>Kalan Güne Göre (Azdan Çoğa)</option>
                  <option value="turbine" style="background: #0d1117; color: #fff;">Türbin Numarasına Göre</option>
                </select>
                <i class="fa-solid fa-chevron-down" style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.7rem; pointer-events: none;"></i>
              </div>

              <!-- Turbine Search Bar -->
              <div class="maint-search-box" style="position: relative; width: 220px;">
                <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.75rem;"></i>
                <input type="text" id="maint-turbine-search" placeholder="Türbin Ara... (örn: T-01)" style="width: 100%; padding: 6px 10px 6px 30px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; color: #fff; font-size: 0.75rem; font-family: 'Rajdhani', sans-serif; font-weight: 600; outline: none; transition: all 0.2s;" oninput="window.handleMaintTurbineSearch(this.value)" />
              </div>
            </div>
          </div>

          <!-- Monthly Maintenance Distribution Chart Container -->
          <div id="maint-chart-container" style="background: rgba(10, 15, 25, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; display: none; height: 450px; position: relative; width: 100%;">
            <canvas id="maint-monthly-chart" style="width: 100%; height: 100%;"></canvas>
          </div>

          <!-- Monthly Maintenance Breakdown Details -->
          <div id="maint-chart-details" style="background: rgba(10, 15, 25, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1.5rem; margin-bottom: 1.5rem; display: none; width: 100%;">
          </div>
          
          <div class="table-frame custom-scrollbar">
            <table class="maint-data-table">
              <thead>
                <tr>
                  <th>TÜRBİN</th>
                  <th>SON BAKIM</th>
                  <th style="text-align: center;">SON TİP</th>
                  <th style="text-align: center;">HEDEF BAKIM</th>
                  <th style="text-align: center;">KALAN GÜN</th>
                  <th style="text-align: center;">DURUM</th>
                  <th style="text-align: right; padding-right: 18px;">AKSİYON</th>
                </tr>
              </thead>
              <tbody id="maint-data-body">
                <!-- Data will be injected by init function -->
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>

    <style>
      .maintenance-planning-container { padding: 25px; display: flex; flex-direction: column; gap: 20px; height: 100%; }
      .page-header { display: flex; justify-content: space-between; align-items: center; }
      .header-content h1 { font-family: 'Rajdhani'; font-size: 1.8rem; color: #fff; margin: 0; letter-spacing: 2px; display: flex; align-items: center; gap: 15px; }
      .header-content p { color: var(--text-muted); margin: 5px 0 0 0; font-size: 0.9rem; }
      
      .header-stats { display: flex; gap: 12px; }
      .h-stat { background: rgba(255,255,255,0.02); padding: 8px 16px; border-radius: 12px; display: flex; flex-direction: column; align-items: center; min-width: 100px; border: 1px solid rgba(255,255,255,0.05); transition: all 0.3s ease; }
      .h-stat:hover { transform: translateY(-2px); background: rgba(255,255,255,0.04); }
      .h-stat.overdue { border-bottom: 3px solid #ff4d4d; }
      .h-stat.warning { border-bottom: 3px solid #ff9f43; }
      .h-stat.safe-stat { border-bottom: 3px solid #1ed760; }
      .h-stat.rate { border-bottom: 3px solid var(--accent-cyan); }
      .h-stat .v { font-family: 'Rajdhani'; font-size: 1.4rem; font-weight: 800; color: #fff; }
      .h-stat .l { font-size: 0.6rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-top: 2px; text-transform: uppercase; }

      .maintenance-planning-layout { display: flex; gap: 20px; flex: 1; min-height: 0; }
      .sites-sidebar { width: 280px; display: flex; flex-direction: column; border: 1px solid rgba(255,255,255,0.05); background: rgba(10, 15, 25, 0.4); flex-shrink: 0; border-radius: 16px; overflow: hidden; }
      .sidebar-header { padding: 15px; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .sites-list { flex: 1; overflow-y: auto; padding: 10px; }
      
      .site-menu-item { 
        display: flex; align-items: center; gap: 12px; padding: 10px 15px; border-radius: 8px; cursor: pointer; 
        transition: all 0.25s; color: var(--text-muted); position: relative; margin-bottom: 4px;
      }
      .site-menu-item i { font-size: 1rem; opacity: 0.6; color: #a0aec0; }
      .site-menu-item .s-name { font-weight: 600; font-size: 0.88rem; }
      .site-menu-item:hover { background: rgba(255,255,255,0.05); color: #fff; }
      .site-menu-item.active { 
        background: linear-gradient(135deg, rgba(0, 242, 255, 0.12), rgba(0, 242, 255, 0.02)) !important;
        border-left: 3px solid var(--accent-cyan) !important;
        color: var(--accent-cyan) !important; 
        font-weight: 700;
        box-shadow: inset 0 0 10px rgba(0,242,255,0.02);
      }
      .site-menu-item.active i { opacity: 1; color: var(--accent-cyan); }
      
      .alert-badge {
        font-size: 0.65rem;
        font-weight: 800;
        padding: 2px 6px;
        border-radius: 10px;
        position: absolute;
        right: 12px;
        color: #fff;
        font-family: 'Rajdhani', sans-serif;
      }
      .alert-badge.overdue {
        background: #ff4d4d;
        box-shadow: 0 0 8px rgba(255,77,77,0.4);
      }
      .alert-badge.warning {
        background: #ff9f43;
        box-shadow: 0 0 8px rgba(255,159,67,0.4);
      }

      .maintenance-main-content { flex: 1; display: flex; flex-direction: column; padding: 25px; border: 1px solid rgba(255,255,255,0.05); background: rgba(10, 15, 25, 0.4); border-radius: 16px; }
      .view-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px; margin-bottom: 20px; }
      .site-title-box { display: flex; align-items: center; gap: 12px; }
      .site-title-box i { color: var(--accent-cyan); font-size: 1.25rem; text-shadow: 0 0 8px rgba(0,242,255,0.4); }
      .site-title-box h2 { margin: 0; font-family: 'Rajdhani'; letter-spacing: 2px; color: #fff; font-size: 1.4rem; font-weight: 800; }
      
      .maint-legend { display: flex; gap: 15px; }
      .leg-box { font-size: 0.7rem; font-weight: 700; color: var(--text-muted); display: flex; align-items: center; gap: 6px; }
      .leg-box::before { content: ''; width: 8px; height: 8px; border-radius: 50%; }
      .leg-box.overdue::before { background: #ff4d4d; box-shadow: 0 0 8px #ff4d4d; }
      .leg-box.warning::before { background: #ff9f43; box-shadow: 0 0 8px #ff9f43; }
      .leg-box.safe::before { background: #1ed760; box-shadow: 0 0 8px #1ed760; }

      .maint-filter-tabs { display: flex; gap: 8px; margin-bottom: 18px; }
      .maint-tab {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        color: rgba(255, 255, 255, 0.55);
        padding: 8px 16px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Rajdhani', sans-serif;
        letter-spacing: 0.5px;
      }
      .maint-tab .c {
        background: rgba(0, 0, 0, 0.25);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.68rem;
        border: 1px solid rgba(255,255,255,0.05);
      }
      .maint-tab:hover {
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
        transform: translateY(-1px);
      }
      .maint-tab.active {
        background: linear-gradient(135deg, rgba(0, 242, 255, 0.12), rgba(0, 242, 255, 0.02)) !important;
        border-color: rgba(0, 242, 255, 0.35) !important;
        color: var(--accent-cyan) !important;
        box-shadow: 0 0 10px rgba(0, 242, 255, 0.05);
      }
      .maint-tab.active .c {
        background: rgba(0, 242, 255, 0.2) !important;
        color: var(--accent-cyan) !important;
        border-color: rgba(0, 242, 255, 0.25);
      }
      .maint-tab.overdue.active {
        background: linear-gradient(135deg, rgba(255, 77, 77, 0.12), rgba(255, 77, 77, 0.02)) !important;
        border-color: rgba(255, 77, 77, 0.35) !important;
        color: #ff4d4d !important;
      }
      .maint-tab.overdue.active .c {
        background: rgba(255, 77, 77, 0.2) !important;
        color: #ff4d4d !important;
        border-color: rgba(255, 77, 77, 0.25);
      }
      .maint-tab.warning.active {
        background: linear-gradient(135deg, rgba(255, 159, 67, 0.12), rgba(255, 159, 67, 0.02)) !important;
        border-color: rgba(255, 159, 67, 0.35) !important;
        color: #ff9f43 !important;
      }
      .maint-tab.warning.active .c {
        background: rgba(255, 159, 67, 0.2) !important;
        color: #ff9f43 !important;
        border-color: rgba(255, 159, 67, 0.25);
      }
      .maint-tab.safe.active {
        background: linear-gradient(135deg, rgba(30, 215, 96, 0.12), rgba(30, 215, 96, 0.02)) !important;
        border-color: rgba(30, 215, 96, 0.35) !important;
        color: #1ed760 !important;
      }
      .maint-tab.safe.active .c {
        background: rgba(30, 215, 96, 0.2) !important;
        color: #1ed760 !important;
        border-color: rgba(30, 215, 96, 0.25);
      }

      .maint-action-btn {
        background: rgba(0, 242, 255, 0.04);
        color: var(--accent-cyan);
        border: 1px solid rgba(0, 242, 255, 0.2);
        border-radius: 6px;
        height: 30px;
        padding: 0 9px;
        box-sizing: border-box;
        font-size: 0.68rem;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 5px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: none;
        letter-spacing: 0.4px;
        font-family: 'Rajdhani', sans-serif;
      }
      .maint-action-btn:hover {
        background: rgba(0, 242, 255, 0.12);
        border-color: rgba(0, 242, 255, 0.45);
        box-shadow: 0 0 12px rgba(0, 242, 255, 0.12);
        transform: translateY(-1.5px);
        color: #fff;
      }
      .maint-action-btn.overdue {
        background: rgba(255, 77, 77, 0.05);
        color: #ff6b6b;
        border-color: rgba(255, 77, 77, 0.22);
      }
      .maint-action-btn.overdue:hover {
        background: rgba(255, 77, 77, 0.14);
        border-color: rgba(255, 77, 77, 0.45);
        box-shadow: 0 0 12px rgba(255, 77, 77, 0.12);
        transform: translateY(-1.5px);
        color: #fff;
      }

      .table-frame { flex: 1; overflow-y: auto; }
      .maint-data-table { width: 100%; border-collapse: collapse; }
      .maint-data-table th { 
        text-align: left; padding: 14px 12px; color: rgba(255,255,255,0.4); font-family: 'Rajdhani'; 
        border-bottom: 2px solid rgba(255,255,255,0.05); position: sticky; top: 0; background: #0b0f19; z-index: 10; 
        font-size: 0.68rem; letter-spacing: 1.5px; font-weight: 800;
      }
      .maint-data-table td { padding: 14px 12px; border-bottom: 1px solid rgba(255,255,255,0.02); color: var(--text-main); font-size: 0.85rem; vertical-align: middle; }
      .maint-data-table tbody tr { transition: all 0.3s ease; }
      .maint-data-table tbody tr:hover { background: rgba(0, 242, 255, 0.02) !important; }
      
      .t-no { font-family: 'Rajdhani'; font-weight: 800; color: #fff; font-size: 1.1rem; }
      .turbine-id-badge {
        font-family: 'Rajdhani', sans-serif;
        font-weight: 800;
        color: #64ffda;
        background: rgba(100, 255, 218, 0.05);
        border: 1px solid rgba(100, 255, 218, 0.15);
        padding: 2px 8px;
        border-radius: 6px;
        display: inline-block;
        box-shadow: 0 0 8px rgba(100, 255, 218, 0.04);
        transition: all 0.25s ease;
      }
      .turbine-id-badge:hover {
        background: rgba(100, 255, 218, 0.1) !important;
        border-color: rgba(100, 255, 218, 0.35) !important;
        box-shadow: 0 0 10px rgba(100, 255, 218, 0.1) !important;
        transform: scale(1.02);
      }

      .type-badge { background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; color: rgba(255,255,255,0.5); border: 1px solid rgba(255,255,255,0.05); }
      .type-badge.maintenance { border-color: rgba(0, 242, 255, 0.15); color: var(--accent-cyan); background: rgba(0, 242, 255, 0.03); }
      .type-badge.returned { border-color: rgba(155, 89, 182, 0.15); color: #d4a0ff; background: rgba(155, 89, 182, 0.03); }
      .type-badge.next { border: 1px solid rgba(0, 242, 255, 0.25); color: var(--accent-cyan); background: rgba(0, 242, 255, 0.05); }
      .type-badge.next.maintenance { border-color: rgba(0, 242, 255, 0.3); color: var(--accent-cyan); }
      .type-badge.next.returned { border-color: rgba(155, 89, 182, 0.3); color: #d4a0ff; }
      
      .maint-data-table .type-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 140px;
        box-sizing: border-box;
      }
      .maint-data-table .status-pill {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 120px;
        box-sizing: border-box;
      }
      
      .days-val { font-family: 'Rajdhani'; font-weight: 700; font-size: 0.9rem; }
      .days-val.overdue { color: #ff4d4d; }
      .days-val.warning { color: #ff9f43; }
      .days-val.safe { color: #1ed760; }
      
      .status-pill { 
        display: inline-flex; align-items: center; justify-content: center; padding: 4px 10px; border-radius: 8px; 
        font-size: 0.65rem; font-weight: 900; letter-spacing: 0.5px; height: 24px; box-sizing: border-box; 
      }
      .status-pill.overdue { background: rgba(255, 77, 77, 0.08) !important; color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.25) !important; }
      .status-pill.warning { background: rgba(255, 159, 67, 0.08) !important; color: #ff9f43; border: 1px solid rgba(255, 159, 67, 0.2) !important; }
      .status-pill.safe { background: rgba(30, 215, 96, 0.08) !important; color: #1ed760; border: 1px solid rgba(30, 215, 96, 0.25) !important; }
      .status-pill.none { background: rgba(255, 255, 255, 0.02) !important; color: rgba(255, 255, 255, 0.35); border: 1px solid rgba(255, 255, 255, 0.06) !important; }

      .status-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        margin-right: 8px;
        display: inline-block;
      }

      .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.06); border-radius: 10px; }
      .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.12); }
      
      .search-wrapper { position: relative; width: 100%; }
      .search-wrapper i { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: rgba(255, 255, 255, 0.4); font-size: 0.85rem; }
      .search-wrapper input {
        width: 100%; padding: 8px 12px 8px 36px; background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 8px; color: #fff; font-size: 0.82rem; outline: none; transition: all 0.25s ease; box-sizing: border-box;
      }
      .search-wrapper input:focus { border-color: var(--accent-cyan); box-shadow: 0 0 10px rgba(0, 242, 255, 0.15); }

      @media (max-width: 768px) {
        .maintenance-planning-container { padding: 10px; gap: 15px; }
        .page-header { flex-direction: column; align-items: flex-start; gap: 15px; }
        .maintenance-planning-layout { flex-direction: column; }
        .sites-sidebar { width: 100%; height: 300px; }
        .maintenance-main-content { padding: 15px; overflow-x: auto; }
        .maint-data-table { min-width: 600px; }
      }
    </style>
  `;
};
