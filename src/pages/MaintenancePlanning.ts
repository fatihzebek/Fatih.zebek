import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';

export const MaintenancePlanningPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const allSites = dataService.getSites();
  const sites = isAdmin ? allSites : allSites.filter(s => currentUser?.allowedSites?.includes(s.id));
  const reports = (await serviceReportService.getAllReports()).filter(r => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return !isNaN(d.getTime());
  });
  const now = new Date();

  // Maintenance Tracking Logic
  const maintenancePlan = (() => {
    const plan: any[] = [];

    sites.forEach(site => {
      const siteTurbines = dataService.getTurbinesBySite(site.id);
      siteTurbines.forEach(t => {
        const turbineReports = reports.filter(r => r.turbineSerial === t.id);
        const lastMaint = turbineReports
          .filter(r => {
            const typeLower = (r.type || '').toLowerCase();
            const templateLower = (r.templateName || '').toLowerCase();
            const faultLower = (r.faultCode || '').toLowerCase();
            return typeLower.includes('ana') || typeLower.includes('yağ') || typeLower.includes('yag') ||
                   templateLower.includes('ana') || templateLower.includes('yağ') || templateLower.includes('yag') ||
                   faultLower.includes('ana') || faultLower.includes('yağ') || faultLower.includes('yag');
          })
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];

        if (lastMaint) {
          const lastDate = new Date(lastMaint.date);
          const nextDate = new Date(lastDate);
          nextDate.setMonth(nextDate.getMonth() + 6);

          const searchStr = `${lastMaint.type} ${lastMaint.templateName} ${lastMaint.faultCode}`.toLowerCase();
          const isLastAna = searchStr.includes('ana');
          const lastType = isLastAna ? 'ANA BAKIM' : 'YAĞLAMA BAKIMI';
          const nextType = isLastAna ? 'YAĞLAMA BAKIMI' : 'ANA BAKIM';

          const diffDays = Math.ceil((nextDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          let status: 'safe' | 'warning' | 'overdue' = 'safe';
          if (diffDays < 0) status = 'overdue';
          else if (diffDays < 30) status = 'warning';

          plan.push({
            siteName: site.name,
            turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
            turbineSerial: t.id,
            lastDate: lastMaint.date,
            lastType,
            nextDate: nextDate.toISOString(),
            nextType,
            status,
            daysRemaining: diffDays
          });
        } else {
          plan.push({
            siteName: site.name,
            turbineNo: t.no > 0 ? t.no.toString() : (t.label || t.id),
            turbineSerial: t.id,
            lastDate: '-',
            lastType: 'VERİ YOK',
            nextDate: null,
            nextType: 'BELİRLENMEDİ',
            status: 'safe',
            daysRemaining: 0
          });
        }
      });
    });

    return plan;
  })();

  const completionRate = (() => {
    const totalTurbinesCount = maintenancePlan.length;
    const hasMaintCount = maintenancePlan.filter(p => p.lastDate !== '-').length;
    return totalTurbinesCount > 0 ? Math.round((hasMaintCount / totalTurbinesCount) * 100) : 0;
  })();

  const groupedPlan: Record<string, any[]> = {};
  maintenancePlan.forEach(p => {
    if (!groupedPlan[p.siteName]) groupedPlan[p.siteName] = [];
    groupedPlan[p.siteName].push(p);
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

  const siteList = Object.keys(groupedPlan).sort((a, b) => {
    const indexA = customOrder.findIndex(o => o.toLowerCase() === a.toLowerCase());
    const indexB = customOrder.findIndex(o => o.toLowerCase() === b.toLowerCase());
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  const savedSite = sessionStorage.getItem('activeMaintSiteName');
  const initialSite = (savedSite && siteList.includes(savedSite)) ? savedSite : (siteList[0] || '');

  // Expose to window for initialization
  (window as any).maintData = groupedPlan;
  
  let activeMaintFilter = 'ALL';
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
            faultCode: maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı',
            templateName: maintType === 'ANA BAKIM' ? 'Manuel Ana Bakım' : 'Manuel Yağlama bakımı',
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

  (window as any).initMaintenancePlanning = () => {
    const maintData = (window as any).maintData;
    const body = document.getElementById('maint-data-body');
    const title = document.getElementById('active-site-title');
    if (!body || !title) return;

    let currentSite = initialSite;

    function updateTable(siteName: string) {
      currentSite = siteName;
      sessionStorage.setItem('activeMaintSiteName', siteName);
      const allItems = maintData[siteName] || [];
      title!.textContent = siteName.toUpperCase();
      
      const siteObj = dataService.getSites().find(s => s.name === siteName);
      (window as any).activeMaintSiteId = siteObj?.id;
      (window as any).activeMaintSiteName = siteName;

      // Calculate dynamic filter counts
      const overdueCount = allItems.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-').length;
      const warningCount = allItems.filter((i: any) => i.status === 'warning').length;
      const nodataCount = allItems.filter((i: any) => i.lastDate === '-').length;
      
      const tabAll = document.getElementById('maint-tab-all');
      const tabOverdue = document.getElementById('maint-tab-overdue');
      const tabWarning = document.getElementById('maint-tab-warning');
      const tabNodata = document.getElementById('maint-tab-nodata');
      
      if (tabAll) tabAll.querySelector('.c')!.textContent = String(allItems.length);
      if (tabOverdue) tabOverdue.querySelector('.c')!.textContent = String(overdueCount);
      if (tabWarning) tabWarning.querySelector('.c')!.textContent = String(warningCount);
      if (tabNodata) tabNodata.querySelector('.c')!.textContent = String(nodataCount);
      
      // Filter items
      let items = allItems;
      if (activeMaintFilter === 'OVERDUE') {
        items = allItems.filter((i: any) => i.status === 'overdue' && i.lastDate !== '-');
      } else if (activeMaintFilter === 'WARNING') {
        items = allItems.filter((i: any) => i.status === 'warning');
      } else if (activeMaintFilter === 'NODATA') {
        items = allItems.filter((i: any) => i.lastDate === '-');
      }
      
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
        const daysTxt = isNoData ? '-' : (item.daysRemaining < 0 ? Math.abs(item.daysRemaining) + ' GÜN GEÇTİ' : item.daysRemaining + ' GÜN');
        const statusTxt = isNoData ? 'KAYIT YOK' : (item.status === 'overdue' ? 'KRİTİK GECİKME' : (item.status === 'warning' ? 'YAKLAŞIYOR' : 'PLANLI'));
        const statusClass = isNoData ? 'none' : item.status;
        const serial = item.turbineSerial || '';
        
        const lastBadgeClass = item.lastType === 'ANA BAKIM' ? 'maintenance' : (item.lastType === 'YAĞLAMA BAKIMI' ? 'returned' : 'none');
        const nextBadgeClass = item.nextType === 'ANA BAKIM' ? 'maintenance' : (item.nextType === 'YAĞLAMA BAKIMI' ? 'returned' : 'none');
        
        html += `<tr style="${isNoData ? 'opacity: 0.7;' : ''}">`;
        html += `<td class="t-no"><span class="turbine-id-badge" style="font-size: 0.8rem; font-weight: 800; font-family: 'Rajdhani', sans-serif;">${tName}</span></td>`;
        html += `<td style="font-variant-numeric: tabular-nums; font-weight: 700; color: var(--accent-cyan); cursor: pointer; text-decoration: underline dotted rgba(0,242,255,0.4);" onclick="window.openMaintHistoryModal('${serial}', '${tName}')" title="Bakım Geçmişini Görüntüle"><i class="fa-solid fa-clock-rotate-left" style="margin-right: 6px; font-size: 0.8rem; opacity: 0.8;"></i>${dateStr}</td>`;
        html += `<td><span class="type-badge ${lastBadgeClass}">${item.lastType}</span></td>`;
        html += `<td><span class="type-badge next ${nextBadgeClass}">${item.nextType}</span></td>`;
        html += `<td class="days-val ${item.status}">${daysTxt}</td>`;
        html += `<td>
                   <span class="status-pill ${statusClass}">
                     <span class="status-dot ${isNoData ? 'gray' : (item.status === 'overdue' ? 'red' : (item.status === 'warning' ? 'orange' : 'green'))}" style="background: ${isNoData ? 'rgba(255,255,255,0.45)' : (item.status === 'overdue' ? '#ff4d4d' : (item.status === 'warning' ? '#ff9f43' : '#1ed760'))}; box-shadow: 0 0 8px ${isNoData ? 'transparent' : (item.status === 'overdue' ? '#ff4d4d' : (item.status === 'warning' ? '#ff9f43' : '#1ed760'))};"></span>
                     ${statusTxt}
                   </span>
                 </td>`;
        html += `<td style="text-align: right; white-space: nowrap;">`;
        if (isNoData) {
          html += `<button class="maint-action-btn" onclick="window.createMaintenanceTask('${serial}', 'Bakım', '')"><i class="fa-solid fa-plus"></i> İŞ EMRİ AÇ</button>`;
        } else if (item.status === 'overdue' || item.status === 'warning') {
          html += `<button class="maint-action-btn overdue" onclick="window.createMaintenanceTask('${serial}', 'Bakım', '${item.nextType}')"><i class="fa-solid fa-triangle-exclamation"></i> BAKIM YAP</button>`;
        } else {
          html += `<span style="color: rgba(255,255,255,0.25); font-size: 0.65rem; font-weight: 800; padding-right: 8px; font-family: 'Rajdhani', sans-serif;"><i class="fa-solid fa-circle-check" style="margin-right: 5px; color: #1ed760;"></i> PROGRAMLI</span>`;
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
          <p>6 Aylık periyodik bakım döngüsü ve saha bazlı takip merkezi.</p>
        </div>
        <div class="header-stats">
          <div class="h-stat overdue">
            <span class="v">${maintenancePlan.filter(p => p.status === 'overdue' && p.lastDate !== '-').length}</span>
            <span class="l">GECİKMİŞ</span>
          </div>
          <div class="h-stat warning">
            <span class="v">${maintenancePlan.filter(p => p.status === 'warning').length}</span>
            <span class="l">KRİTİK</span>
          </div>
          <div class="h-stat safe-stat">
            <span class="v">${maintenancePlan.filter(p => p.status === 'safe' && p.lastDate !== '-').length}</span>
            <span class="l">PLANLI & GÜVENLİ</span>
          </div>
          <div class="h-stat rate">
            <span class="v" style="color: var(--accent-cyan); text-shadow: 0 0 8px rgba(0,242,255,0.3);">${completionRate}%</span>
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
            ${siteList.map((siteName, idx) => {
              const siteOverdueCount = groupedPlan[siteName].filter(i => i.status === 'overdue' && i.lastDate !== '-').length;
              const siteWarningCount = groupedPlan[siteName].filter(i => i.status === 'warning').length;
              const badgeHtml = siteOverdueCount > 0 
                ? `<span class="alert-badge overdue">${siteOverdueCount}</span>` 
                : (siteWarningCount > 0 
                  ? `<span class="alert-badge warning">${siteWarningCount}</span>` 
                  : '');
              const isActive = siteName === initialSite;
              return `
                <div class="site-menu-item ${isActive ? 'active' : ''}" data-site="${siteName}">
                  <i class="fa-solid fa-charging-station"></i>
                  <span class="s-name">${siteName}</span>
                  ${badgeHtml}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Main Content -->
        <div class="maintenance-main-content glass-panel">
          <div class="view-header">
            <div class="site-title-box">
              <i class="fa-solid fa-wind"></i>
              <h2 id="active-site-title">${initialSite.toUpperCase() || 'SAHA SEÇİN'}</h2>
            </div>
            <div style="display: flex; align-items: center; gap: 15px;">
              ${isAdmin ? `
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

          <div class="maint-filter-tabs">
            <button class="maint-tab active" id="maint-tab-all" onclick="window.filterMaintTable('ALL')">
              <i class="fa-solid fa-layer-group"></i> HEPSİ <span class="c">-</span>
            </button>
            <button class="maint-tab overdue" id="maint-tab-overdue" onclick="window.filterMaintTable('OVERDUE')">
              <i class="fa-solid fa-triangle-exclamation"></i> GECİKMİŞ <span class="c">-</span>
            </button>
            <button class="maint-tab warning" id="maint-tab-warning" onclick="window.filterMaintTable('WARNING')">
              <i class="fa-solid fa-circle-exclamation"></i> YAKLAŞANLAR <span class="c">-</span>
            </button>
            <button class="maint-tab nodata" id="maint-tab-nodata" onclick="window.filterMaintTable('NODATA')">
              <i class="fa-solid fa-circle-question"></i> VERİ YOK <span class="c">-</span>
            </button>
          </div>
          
          <div class="table-frame custom-scrollbar">
            <table class="maint-data-table">
              <thead>
                <tr>
                  <th>TÜRBİN</th>
                  <th>SON BAKIM</th>
                  <th>SON TİP</th>
                  <th>HEDEF BAKIM</th>
                  <th>KALAN GÜN</th>
                  <th>DURUM</th>
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
      .view-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
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

      .maint-action-btn {
        background: rgba(0, 242, 255, 0.04);
        color: var(--accent-cyan);
        border: 1px solid rgba(0, 242, 255, 0.2);
        border-radius: 6px;
        padding: 5px 12px;
        font-size: 0.68rem;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 6px;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: uppercase;
        letter-spacing: 0.5px;
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
