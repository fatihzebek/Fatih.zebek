import { repairService } from '../services/RepairService';
import type { RepairRecord } from '../services/RepairService';
import { dataService } from '../services/DataService';
import { serviceReportService } from '../services/ServiceReportService';
import { statusService } from '../services/StatusService';
import { warehouseService } from '../services/WarehouseService';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

const getDurationString = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return '0 dk';

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins} dk`;
  }

  const diffHours = Math.floor(diffMins / 60);
  const remainingMins = diffMins % 60;
  if (diffHours < 24) {
    return `${diffHours} sa ${remainingMins} dk`;
  }

  const diffDays = Math.floor(diffHours / 24);
  const remainingHours = diffHours % 24;
  return `${diffDays} gün ${remainingHours} sa`;
};

const getStatusDuration = (rep: RepairRecord) => {
  if (rep.status === 'PENDING_ARRIVAL') {
    return getDurationString(rep.sentAt);
  } else if (rep.status === 'UNDER_REPAIR') {
    return getDurationString(rep.receivedAt);
  } else if (rep.status === 'REPAIRED') {
    return getDurationString(rep.repairedAt);
  } else if (rep.status === 'SENT_BACK') {
    return getDurationString(rep.dispatchedAt);
  } else if (rep.status === 'COMPLETED') {
    return getDurationString(rep.completedAt);
  }
  return '-';
};

export const WorkshopDashboardPage = async () => {
  const user = (window as any).currentUser;
  const username = user?.displayName || user?.email || 'Merkez Tamir Atölyesi';
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const isMaterialManager = userProfile?.role === 'ADMIN' || userProfile?.role === 'MALZEME_YONETIMI' || user?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';

  // Fetch all repair records
  const repairs = await repairService.getRepairs();
  const warehouses = dataService.getWarehouses();

  (window as any)._allRepairs = repairs;

  // Calculate counts for stats cards
  const pendingArrivalCount = repairs.filter(r => r.status === 'PENDING_ARRIVAL').length;
  const underRepairCount = repairs.filter(r => r.status === 'UNDER_REPAIR').length;
  const repairedCount = repairs.filter(r => r.status === 'REPAIRED').length;
  const completedCount = repairs.filter(r => r.status === 'COMPLETED' || r.status === 'SENT_BACK').length;

  // Global handler to receive a repair item (confirming arrival at workshop)
  // Global handler to receive a repair item (confirming arrival at workshop)
  (window as any).receiveRepairItem = async (repairId: string) => {
    (window as any).openReceiveRepairModal(repairId);
  };

  (window as any).openReceiveRepairModal = (repairId: string) => {
    const rep = ((window as any)._allRepairs || []).find((r: any) => r.id === repairId);
    if (!rep) {
      alert("Kayıt bulunamadı.");
      return;
    }
    
    const modal = document.createElement('div');
    modal.id = 'receive-repair-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-hand-holding-hand" style="margin-right:8px;"></i> MALZEMEYİ TESLİM AL
          </h3>
          <button onclick="document.getElementById('receive-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block;">${rep.description}</span>
            <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${rep.sapNo} | Seri No: ${rep.serialNo || '-'} | Miktar: ${rep.quantity} Adet</span>
            ${rep.dispatchNo ? `
              <div style="font-size:0.75rem; color:#14F195; font-family:monospace; font-weight:bold; margin-top:4px;">
                <i class="fa-solid fa-truck-ramp-box"></i> Sevk No: ${rep.dispatchNo}
              </div>
            ` : ''}
            ${rep.faultCode ? `
              <div style="font-size:0.78rem; color:#F59E0B; margin-top:6px; font-weight:700; border-top:1px dashed rgba(255,255,255,0.05); padding-top:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Arıza Kodu: ${rep.faultCode} ${rep.faultDesc ? `(${rep.faultDesc})` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 1.1rem; margin-bottom: 1.5rem;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">RAF / KONUM (MTA)</label>
            <input type="text" id="receive-shelf-input" class="cyber-input" placeholder="Örn: Raf-B2" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);" value="${rep.shelfNo || ''}">
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">TESLİM ALMA NOTU (İsteğe bağlı)</label>
            <textarea id="receive-note-input" class="cyber-input" placeholder="Varsa arıza veya teslimat hakkında not..." style="width: 100%; height: 80px; padding: 0.85rem; background: rgba(0,0,0,0.4); resize: none;"></textarea>
          </div>
        </div>
        
        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; margin-top:0.5rem;">
          <button onclick="document.getElementById('receive-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
          <button id="confirm-receive-btn" onclick="window.submitReceiveRepairItem('${rep.id}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">TESLİM AL VE STOĞA EKLE</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  };

  (window as any).submitReceiveRepairItem = async (repairId: string) => {
    const rep = ((window as any)._allRepairs || []).find((r: any) => r.id === repairId);
    if (!rep) return;
    
    const shelfInput = document.getElementById('receive-shelf-input') as HTMLInputElement;
    const noteInput = document.getElementById('receive-note-input') as HTMLTextAreaElement;
    
    const shelfNo = shelfInput?.value.trim() || 'Tanımsız';
    const note = noteInput?.value.trim() || '';
    
    const confirmBtn = document.getElementById('confirm-receive-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      (window as any).showToast('İşlem', 'Malzeme teslim alınıyor ve MTA deposuna aktarılıyor...', 'info');
      
      // 1. Mark repair record as UNDER_REPAIR in firestore, saving shelfNo and receiveNote
      await repairService.receiveRepair(repairId, username, shelfNo, note);
      
      // 2. Add DEFECT stock to the repair center warehouse (MTA)
      await warehouseService.updateStockBySap(
        'MTA',
        rep.sapNo,
        rep.quantity,
        {
          user: username,
          reason: `Atölyede teslim alındı. Raf: ${shelfNo}${note ? ' | Not: ' + note : ''}`,
          materialName: rep.description
        },
        'DEFECT',
        shelfNo,
        rep.serialNo || '',
        note || ''
      );
      
      (window as any).showToast('Başarılı', 'Malzeme atölyeye kabul edildi, MTA arızalı stoğuna eklendi.', 'success');
      
      // Close modal
      const m = document.getElementById('receive-repair-modal');
      if (m) m.remove();
      
      // Reload page content
      if ((window as any).navigate) {
         (window as any).navigate('workshop');
      }
    } catch (e) {
      console.error(e);
      alert('İşlem gerçekleştirilemedi.');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = 'TESLİM AL VE STOĞA EKLE';
      }
    }
  };

  // Global handler to open modal to complete repair (Step 1)
  (window as any).openCompleteRepairModal = (repairId: string, sapNo: string, description: string, quantity: number, serialNo: string = '-', faultCode: string = '-', faultDesc: string = '-') => {
    const modal = document.createElement('div');
    modal.id = 'complete-repair-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 95vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-check-double" style="margin-right:8px;"></i> TAMİRİ TAMAMLA
          </h3>
          <button onclick="document.getElementById('complete-repair-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
            <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Seri No: ${serialNo} | Miktar: ${quantity} Adet</span>
            ${faultCode !== '-' ? `
              <div style="font-size:0.78rem; color:#F59E0B; margin-top:6px; font-weight:700; border-top:1px dashed rgba(255,255,255,0.05); padding-top:6px; display:flex; align-items:center; gap:6px;">
                <i class="fa-solid fa-triangle-exclamation"></i> Arıza Kodu: ${faultCode} ${faultDesc !== '-' ? `(${faultDesc})` : ''}
              </div>
            ` : ''}
          </div>
        </div>

        <div style="margin-bottom:1.25rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700; text-transform:uppercase;">Onarım Görseli (İsteğe Bağlı)</label>
          <input type="file" id="repair-image-upload" accept="image/*" class="cyber-input" style="width:100%; padding:0.5rem; background:rgba(0,0,0,0.4); border-radius:8px; border:1px solid rgba(255,255,255,0.05); color:#FFF;">
          <div id="repair-image-preview" style="margin-top:0.75rem; display:none; text-align:center;">
            <img id="preview-img" style="max-height:100px; max-width:100%; border-radius:8px; border:1px solid rgba(20,241,149,0.3); object-fit: contain;" />
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700; text-transform:uppercase;">Yapılan İşlemler / Onarım Notu</label>
          <textarea id="repair-operation-notes" class="cyber-input" placeholder="Yapılan onarım işlemlerini, değişen parçaları ve test notlarını yazınız..." style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); height:100px; resize:none; border-radius:8px; border:1px solid rgba(255,255,255,0.05); color:#FFF;" required></textarea>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('complete-repair-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
          <button id="btn-submit-repair-complete" onclick="window.submitCompleteRepair('${repairId}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">TAMİRİ BİTİR (STOĞA AL)</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Setup preview logic
    setTimeout(() => {
      const fileInput = document.getElementById('repair-image-upload') as HTMLInputElement;
      const previewDiv = document.getElementById('repair-image-preview');
      const previewImg = document.getElementById('preview-img') as HTMLImageElement;
      if (fileInput && previewDiv && previewImg) {
        fileInput.onchange = () => {
          const file = fileInput.files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              previewImg.src = e.target?.result as string;
              previewDiv.style.display = 'block';
            };
            reader.readAsDataURL(file);
          } else {
            previewDiv.style.display = 'none';
          }
        };
      }
    }, 50);
  };

  // Global handler to submit completed repair to db
  (window as any).submitCompleteRepair = async (repairId: string) => {
    const notesInput = document.getElementById('repair-operation-notes') as HTMLTextAreaElement;
    const notes = notesInput?.value.trim() || '';
    if (!notes) {
      alert('Lütfen yapılan onarım işlemlerini yazınız.');
      return;
    }

    const fileInput = document.getElementById('repair-image-upload') as HTMLInputElement;
    const file = fileInput?.files?.[0];

    const submitBtn = document.getElementById('btn-submit-repair-complete');
    if (submitBtn) {
      submitBtn.setAttribute('disabled', 'true');
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> İşleniyor...';
    }

    try {
      (window as any).showToast('İşlem', 'Tamir kaydı güncelleniyor...', 'info');

      const rep = repairs.find(r => r.id === repairId);
      if (!rep) {
        alert('Tamir kaydı bulunamadı.');
        if (submitBtn) {
          submitBtn.removeAttribute('disabled');
          submitBtn.innerHTML = 'TAMİRİ BİTİR (STOĞA AL)';
        }
        return;
      }

      let imageUrl: string | undefined = undefined;
      if (file) {
        (window as any).showToast('İşlem', 'Fotoğraf yükleniyor...', 'info');
        imageUrl = await repairService.uploadRepairImage(repairId, file);
      }

      await repairService.markAsRepaired(repairId, notes, username, imageUrl);

      // Stock modifications for MTA (Repair Center Warehouse)
      const { warehouseService } = await import('../services/WarehouseService');
      
      // 1. Deduct DEFECT stock from MTA
      await warehouseService.updateStockBySap(
        'MTA',
        rep.sapNo,
        -rep.quantity,
        {
          user: username,
          reason: `Tamir tamamlandı: ${notes}`
        },
        'DEFECT'
      );

      // 2. Add REVISED stock to MTA (with R prefix if not already present)
      const sapNoWithR = rep.sapNo.toUpperCase().startsWith('R') ? rep.sapNo : 'R' + rep.sapNo;
      await warehouseService.updateStockBySap(
        'MTA',
        sapNoWithR,
        rep.quantity,
        {
          user: username,
          reason: `Tamir tamamlandı, revize stoğa alındı. ${notes}`,
          materialName: rep.description
        },
        'REVISED'
      );

      (window as any).showToast('Başarılı', 'Malzeme başarıyla tamir edildi olarak işaretlendi ve atölye stoğuna alındı.', 'success');
      
      const modal = document.getElementById('complete-repair-modal');
      if (modal) modal.remove();

      if ((window as any).navigate) {
         (window as any).navigate('workshop');
      }
    } catch (e) {
      console.error(e);
      alert('Tamir tamamlama işlemi gerçekleştirilemedi.');
      if (submitBtn) {
        submitBtn.removeAttribute('disabled');
        submitBtn.innerHTML = 'TAMİRİ BİTİR (STOĞA AL)';
      }
    }
  };

  // Global handler to delete a repair record (admin only)
  (window as any).deleteRepairRecord = async (repairId: string) => {
    const user = (window as any).currentUser;
    const isAdmin = user?.email?.toLowerCase().includes('admin') || user?.email === 'fatih.zebek@demirerholding.com';
    if (!isAdmin) {
      alert('Bu işlem için yetkiniz bulunmamaktadır.');
      return;
    }
    
    if (!confirm('Bu tamir kaydını kalıcı olarak silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) return;
    
    try {
      (window as any).showToast('İşlem', 'Tamir kaydı siliniyor...', 'info');
      await repairService.deleteRepair(repairId);
      (window as any).showToast('Başarılı', 'Tamir kaydı başarıyla silindi.', 'success');
      
      if ((window as any).navigate) {
         (window as any).navigate('workshop');
      }
    } catch (e) {
      console.error(e);
      alert('Kayıt silinirken bir hata oluştu.');
    }
  };

  (window as any).openManualRepairEntryModal = () => {
    const modal = document.createElement('div');
    modal.id = 'manual-repair-entry-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    const warehouseOptions = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');
    
    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); text-align: left;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-plus-circle" style="margin-right:8px;"></i> MANUEL ARIZALI KART GİRİŞİ
          </h3>
          <button onclick="document.getElementById('manual-repair-entry-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="display: flex; flex-direction: column; gap: 1.1rem; max-height: 80vh; overflow-y: auto; padding-right: 0.5rem;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">SAP NUMARASI</label>
            <input type="text" id="manual-sap-input" class="cyber-input" placeholder="Örn: 11978" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);" autocomplete="off">
          </div>
          
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">MALZEME TANIMI</label>
            <input type="text" id="manual-desc-input" class="cyber-input" placeholder="SAP girildiğinde otomatik aranır..." style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">SERİ NUMARASI</label>
              <input type="text" id="manual-serial-input" class="cyber-input" placeholder="Örn: S12345" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">MİKTAR</label>
              <input type="number" id="manual-qty-input" class="cyber-input" value="1" min="1" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">GELİŞ TARİHİ</label>
              <input type="date" id="manual-date-input" class="cyber-input" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">RAF / KONUM (MTA)</label>
              <input type="text" id="manual-shelf-input" class="cyber-input" placeholder="Örn: Raf-B2" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
          </div>
          
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">GELDİĞİ SANTRAL / DEPO (KAYNAK)</label>
            <select id="manual-source-warehouse" class="cyber-input" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4); border-radius: 8px; color: white;">
              <option value="EXTERNAL">Bilinmeyen / Harici Giriş</option>
              ${warehouseOptions}
            </select>
          </div>
          
          <div style="display: grid; grid-template-columns: 120px 1fr; gap: 1rem;">
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">ARIZA KODU</label>
              <input type="text" id="manual-fault-code" class="cyber-input" placeholder="Örn: E44" style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
            <div>
              <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700;">ARIZA AÇIKLAMASI</label>
              <input type="text" id="manual-fault-desc" class="cyber-input" placeholder="Karttaki arızanın detayları..." style="width: 100%; padding: 0.85rem; background: rgba(0,0,0,0.4);">
            </div>
          </div>
          
          <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem; margin-top:0.5rem;">
            <button onclick="document.getElementById('manual-repair-entry-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
            <button id="confirm-manual-entry-btn" onclick="window.submitManualRepairEntry()" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">KAYDET</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    const sapInput = document.getElementById('manual-sap-input') as HTMLInputElement;
    const descInput = document.getElementById('manual-desc-input') as HTMLInputElement;
    
    let sapTimeout: any;
    sapInput?.addEventListener('input', (e) => {
      clearTimeout(sapTimeout);
      const val = (e.target as HTMLInputElement).value;
      if(val.length > 0) {
        descInput.value = 'Aranıyor...';
        sapTimeout = setTimeout(async () => {
          try {
            const { warehouseAgent } = await import('../agents/WarehouseAgent');
            const res = await warehouseAgent.resolveSapNumber(val);
            if (res.found) {
              descInput.value = res.name || '';
            } else {
              descInput.value = 'Sözlükte bulunamadı. Manuel giriniz.';
            }
          } catch(err) {
            descInput.value = 'Hata oluştu';
          }
        }, 400);
      } else {
        descInput.value = '';
      }
    });

    const faultCodeInput = document.getElementById('manual-fault-code') as HTMLInputElement;
    const faultDescInput = document.getElementById('manual-fault-desc') as HTMLInputElement;
    
    let faultTimeout: any;
    faultCodeInput?.addEventListener('input', (e) => {
      clearTimeout(faultTimeout);
      const val = (e.target as HTMLInputElement).value.trim();
      if(val.length > 0) {
        faultTimeout = setTimeout(() => {
          try {
            const exact = statusService.getCodeByKod(val);
            if (exact) {
              faultDescInput.value = exact.Aciklama || '';
            }
          } catch(err) {
            console.error("Failed to auto-resolve fault code description:", err);
          }
        }, 150);
      } else {
        faultDescInput.value = '';
      }
    });
  };

  (window as any).submitManualRepairEntry = async () => {
    const sapInput = document.getElementById('manual-sap-input') as HTMLInputElement;
    const descInput = document.getElementById('manual-desc-input') as HTMLInputElement;
    const serialInput = document.getElementById('manual-serial-input') as HTMLInputElement;
    const qtyInput = document.getElementById('manual-qty-input') as HTMLInputElement;
    const dateInput = document.getElementById('manual-date-input') as HTMLInputElement;
    const shelfInput = document.getElementById('manual-shelf-input') as HTMLInputElement;
    const sourceSelect = document.getElementById('manual-source-warehouse') as HTMLSelectElement;
    const faultCodeInput = document.getElementById('manual-fault-code') as HTMLInputElement;
    const faultDescInput = document.getElementById('manual-fault-desc') as HTMLInputElement;
    
    const sapNo = sapInput?.value.trim();
    const description = descInput?.value.trim();
    const serialNo = serialInput?.value.trim() || '-';
    const qty = parseInt(qtyInput?.value || '1', 10);
    const shelfNo = shelfInput?.value.trim() || 'Tanımsız';
    const faultCode = faultCodeInput?.value.trim() || '-';
    const faultDesc = faultDescInput?.value.trim() || '-';
    const sourceId = sourceSelect?.value;
    const dateVal = dateInput?.value;
    
    if (!sapNo || !description || isNaN(qty) || qty <= 0) {
      alert('Lütfen geçerli SAP No, Açıklama ve Miktar girin.');
      return;
    }
    
    const confirmBtn = document.getElementById('confirm-manual-entry-btn') as HTMLButtonElement;
    if (confirmBtn) {
      confirmBtn.setAttribute('disabled', 'true');
      confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    }
    
    try {
      const { warehouseService } = await import('../services/WarehouseService');
      const arrivalDate = dateVal ? new Date(dateVal) : new Date();
      const currentUser = (window as any).currentUser;
      const userEmail = currentUser?.email || currentUser?.displayName || 'Sistem';
      
      const { addDoc, collection } = await import('firebase/firestore');
      const { db } = await import('../firebase');
      
      // 1. Create repair record in Firestore
      await addDoc(collection(db, 'repairs'), {
        sapNo,
        serialNo,
        description,
        quantity: qty,
        sourceWarehouseId: sourceId,
        workshopId: 'Merkez Tamir Atölyesi',
        status: 'UNDER_REPAIR',
        sentBy: 'Manuel Giriş',
        sentAt: arrivalDate,
        receivedBy: userEmail,
        receivedAt: arrivalDate,
        faultCode,
        faultDesc,
        createdAt: new Date()
      });
      
      // 2. Add DEFECT stock to MTA
      await warehouseService.updateStockBySap(
        'MTA',
        sapNo,
        qty,
        {
          user: userEmail,
          reason: 'Manuel arızalı kart girişi yapıldı.'
        },
        'DEFECT'
      );
      
      // 3. Update shelfNo for the defect item in MTA
      const item = await warehouseService.getStockBySapAndCondition('MTA', sapNo, 'DEFECT');
      if (item && item.id) {
        const { doc, updateDoc } = await import('firebase/firestore');
        const docRef = doc(db, 'warehouses', 'MTA', 'inventory_v2', item.id);
        await updateDoc(docRef, { shelfNo });
      }
      
      (window as any).showToast('Başarılı', 'Arızalı malzeme başarıyla atölye envanterine kaydedildi.', 'success');
      document.getElementById('manual-repair-entry-modal')?.remove();
      
      // Reload dashboard
      if ((window as any).navigate) {
        (window as any).navigate('workshop');
      }
    } catch (e) {
      console.error(e);
      alert('Manuel giriş esnasında hata oluştu.');
      if (confirmBtn) {
        confirmBtn.removeAttribute('disabled');
        confirmBtn.innerHTML = 'KAYDET';
      }
    }
  };

  // Global handler to open Process Timeline Modal
  (window as any).openRepairTimelineModal = async (repairId: string) => {
    const allRepairs: RepairRecord[] = (window as any)._allRepairs || [];
    const rep = allRepairs.find(r => r.id === repairId);
    if (!rep) return;

    const modal = document.createElement('div');
    modal.id = 'repair-timeline-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;

    // Fetch same-serial repairs (sorted newest first) to check repeating arrivals
    const sameSerialRepairs = (rep.serialNo && rep.serialNo !== '-')
      ? allRepairs.filter(r => r.serialNo === rep.serialNo).sort((a, b) => {
          const dateA = a.sentAt?.toDate ? a.sentAt.toDate().getTime() : new Date(a.sentAt || 0).getTime();
          const dateB = b.sentAt?.toDate ? b.sentAt.toDate().getTime() : new Date(b.sentAt || 0).getTime();
          return dateB - dateA;
        })
      : [];
    const totalArrivals = sameSerialRepairs.length;

    // Fetch all reports to find if/where this card was used later
    let usageReport: any = null;
    if (rep.serialNo && rep.serialNo !== '-') {
      try {
        const allReports = await serviceReportService.getAllReports();
        usageReport = allReports.find(report => {
          if (!report.materials) return false;
          return report.materials.some(mat => {
            const cleanSapMat = String(mat.sapNo || '').trim().toUpperCase();
            const cleanSapRep = String(rep.sapNo || '').trim().toUpperCase();
            const cleanSerialMat = String(mat.serialNo || '').trim();
            const cleanSerialRep = String(rep.serialNo || '').trim();
            
            const isSapMatch = cleanSapMat === cleanSapRep || cleanSapMat === ('R' + cleanSapRep) || ('R' + cleanSapRep) === cleanSapRep;
            const isSerialMatch = cleanSerialMat === cleanSerialRep;
            const isUsed = (mat.used || 0) > 0;
            
            return isSapMatch && isSerialMatch && isUsed;
          });
        });
      } catch (err) {
        console.error("Error finding card usage in reports:", err);
      }
    }

    const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId;
    const targetWh = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : '-';

    const steps = [
      {
        title: 'Söküldü ve Sevk Edildi',
        time: rep.sentAt,
        user: rep.sentBy,
        detail: `Kaynak Depo: ${sourceWh}${rep.dispatchNo ? ` | Sevk No: ${rep.dispatchNo}` : ''}`,
        image: '',
        done: !!rep.sentAt
      },
      {
        title: 'Atölyeye Ulaştı (Kabul Edildi)',
        time: rep.receivedAt,
        user: rep.receivedBy,
        detail: `Malzeme fiziksel olarak atölye envanterine kabul edildi.`,
        image: '',
        done: !!rep.receivedAt
      },
      {
        title: 'Tamir Edildi / Onarım Notu',
        time: rep.repairedAt,
        user: rep.repairedBy,
        detail: rep.repairNotes ? `İşlemler: "${rep.repairNotes}"` : '',
        image: rep.repairImageUrl,
        done: !!rep.repairedAt
      },
      {
        title: 'Depoya Geri Sevk Edildi',
        time: rep.dispatchedAt,
        user: rep.dispatchedBy,
        detail: `Hedef Depo: ${targetWh}`,
        image: '',
        done: !!rep.dispatchedAt
      },
      {
        title: 'Depo Tarafından Teslim Alındı',
        time: rep.completedAt,
        user: 'Malzeme Yönetimi',
        detail: `Parça revize (R) kodu ile hedef depo envanterine eklendi.`,
        image: '',
        done: !!rep.completedAt
      }
    ];

    if (usageReport) {
      const installedReportId = usageReport.reportNo || usageReport.id || '-';
      const installedDate = usageReport.date;
      const installedTurbine = (usageReport.siteName ? usageReport.siteName + ' ' : '') + (usageReport.turbineNo || 'Bilinmeyen');
      const installedBy = usageReport.createdBy || usageReport.personnel?.[0] || 'Bilinmeyen';

      steps.push({
        title: 'Türbinde Yeniden Kullanıldı (Montaj)',
        time: installedDate,
        user: installedBy,
        detail: `Montaj Edilen Türbin: ${installedTurbine} | Servis Raporu: ${installedReportId}`,
        image: '',
        done: true
      });
    }

    const timelineHtml = steps.map((step, idx) => {
      const color = step.done ? '#14F195' : '#475569';
      const glow = step.done ? 'box-shadow: 0 0 10px #14F195;' : '';
      const borderStyle = idx === steps.length - 1 ? '' : `border-left: 2px dashed ${color};`;
      const timeStr = step.time ? formatDateTime(step.time) : '-';
      
      return `
        <div style="display: flex; gap: 1.5rem; margin-bottom: 1.5rem; position: relative; ${borderStyle} padding-left: 20px; margin-left: 10px;">
          <div style="position: absolute; left: -6px; top: 0; width: 14px; height: 14px; border-radius: 50%; background: ${color}; ${glow}"></div>
          <div style="flex-grow: 1; margin-top: -3px; background: rgba(255,255,255,0.01); border: 1px solid ${step.done ? 'rgba(20, 241, 149, 0.1)' : 'rgba(255,255,255,0.03)'}; padding: 0.75rem 1rem; border-radius: 8px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <span style="font-weight: 700; color: ${step.done ? '#FFF' : '#64748B'}; font-size: 0.9rem;">${step.title}</span>
              <span style="font-size: 0.75rem; color: #94A3B8; font-family: monospace;">${timeStr}</span>
            </div>
            ${step.user ? `<div style="font-size: 0.75rem; color: #64748B; margin-top: 4px;">İşlem Yapan: ${step.user.split('@')[0]}</div>` : ''}
            ${step.detail ? `<div style="font-size: 0.8rem; color: #94A3B8; margin-top: 6px; font-style: italic; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px;">${step.detail}</div>` : ''}
            ${step.image ? `<div style="margin-top: 8px; text-align: left;"><img src="${step.image}" style="max-width: 100%; max-height: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;" onclick="window.open('${step.image}', '_blank')" title="Büyütmek için tıklayın" /></div>` : ''}
          </div>
        </div>
      `;
    }).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 550px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5); max-height: 90vh; overflow-y: auto;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-clock-rotate-left" style="margin-right:8px;"></i> ONARIM SÜREÇ TAKİBİ
          </h3>
          <button onclick="document.getElementById('repair-timeline-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.5rem; background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
          <span style="font-weight:700; color:#FFF; display:block; font-size:0.95rem;">${rep.description}</span>
          <span style="font-size:0.78rem; color:#94A3B8;">
            <i class="fa-solid fa-barcode"></i> SAP: ${rep.sapNo} | Seri No: <strong style="color: #10B981;">${rep.serialNo || '-'}</strong> | Miktar: ${rep.quantity} Adet
            ${totalArrivals > 1 ? `
              <span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 1px 5px; border-radius: 4px; font-size: 0.7rem; font-weight: 700; margin-left: 6px; display: inline-flex; align-items: center; gap: 3px;">
                <i class="fa-solid fa-arrows-spin"></i> TEKRARLI ARIZA (${totalArrivals}. Geliş)
              </span>
            ` : ''}
          </span>
          ${rep.faultCode && rep.faultCode !== '-' ? `
            <div style="font-size:0.78rem; color:#F59E0B; margin-top:6px; border-top:1px dashed rgba(255,255,255,0.05); padding-top:6px;">
              <i class="fa-solid fa-triangle-exclamation"></i> <strong>Sökülme Arıza Kodu:</strong> ${rep.faultCode} ${rep.faultDesc && rep.faultDesc !== '-' ? `(${rep.faultDesc})` : ''}
            </div>
          ` : ''}
        </div>
 
        <div style="margin-bottom:1.5rem;">
          ${timelineHtml}
        </div>

        ${totalArrivals > 1 ? `
          <div style="margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem; margin-bottom: 1rem;">
            <h4 style="margin: 0 0 0.75rem 0; font-family:'Rajdhani', sans-serif; font-size: 1.05rem; color: #F59E0B; font-weight: 800; display: flex; align-items: center; gap: 6px; letter-spacing: 0.5px;">
              <i class="fa-solid fa-clock-rotate-left"></i> KARTIN ATÖLYE GEÇMİŞİ (TOPLAM ${totalArrivals} GELİŞ)
            </h4>
            <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 180px; overflow-y: auto; padding-right: 4px;">
              ${sameSerialRepairs.map((r, i) => {
                const isCurrent = r.id === rep.id;
                const arrivalNum = totalArrivals - i;
                const repairDate = r.sentAt ? formatDateTime(r.sentAt).split(' ')[0] : '-';
                const compDate = r.completedAt ? formatDateTime(r.completedAt).split(' ')[0] : (r.status === 'REPAIRED' ? 'Atölyede (Onarıldı)' : 'İşlemde');
                return `
                  <div style="background: ${isCurrent ? 'rgba(20,241,149,0.04)' : 'rgba(255,255,255,0.01)'}; border: 1px solid ${isCurrent ? 'rgba(20,241,149,0.3)' : 'rgba(255,255,255,0.04)'}; padding: 0.65rem; border-radius: 8px; font-size: 0.78rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                      <span style="font-weight: 700; color: ${isCurrent ? '#14F195' : '#FFF'}; font-size: 0.8rem;">
                        ${arrivalNum}. Geliş ${isCurrent ? '<span style="font-size:0.7rem; color:#14F195; font-weight: normal; margin-left: 4px;">(Mevcut Kayıt)</span>' : ''}
                      </span>
                      <span style="font-size: 0.7rem; color: #94A3B8; font-family: monospace;">Tarih: ${repairDate} &rarr; ${compDate}</span>
                    </div>
                    <div style="color: #94A3B8; font-size: 0.75rem;">
                      <strong>Arıza:</strong> <span style="color: #F59E0B;">${r.faultCode || '-'}</span> ${r.faultDesc && r.faultDesc !== '-' ? `(${r.faultDesc})` : ''}
                    </div>
                    ${r.repairNotes ? `
                      <div style="margin-top: 4px; color: #E2E8F0; font-style: italic; background: rgba(0,0,0,0.2); padding: 4px 8px; border-radius: 4px; font-size: 0.75rem;">
                        <strong>Onarım Notu:</strong> "${r.repairNotes}"
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        <div style="display:flex; justify-content:flex-end; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('repair-timeline-modal').remove()" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">KAPAT</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  // State Management for active tab, view mode & search
  (window as any)._workshopActiveTab = (window as any)._workshopActiveTab || 'all';
  (window as any)._workshopViewMode = (window as any)._workshopViewMode || 'kanban';
  (window as any)._workshopSearchQuery = (window as any)._workshopSearchQuery || '';

  const activeTab = (window as any)._workshopActiveTab;
  const viewMode = (window as any)._workshopViewMode;
  const searchQuery = (window as any)._workshopSearchQuery;

  (window as any).setWorkshopTab = (tab: string) => {
    (window as any)._workshopActiveTab = tab;
    if ((window as any).navigate) (window as any).navigate('workshop');
  };

  (window as any).setWorkshopViewMode = (mode: string) => {
    (window as any)._workshopViewMode = mode;
    if ((window as any).navigate) (window as any).navigate('workshop');
  };

  (window as any).setWorkshopSearch = (query: string) => {
    (window as any)._workshopSearchQuery = query;
  };

  (window as any).triggerWorkshopSearch = () => {
    const input = document.getElementById('workshop-search-input') as HTMLInputElement;
    (window as any).setWorkshopSearch(input?.value || '');
    if ((window as any).navigate) (window as any).navigate('workshop');
  };

  // Drag & Drop handlers for Kanban Board
  (window as any).workshopDragStart = (event: DragEvent, id: string) => {
    event.dataTransfer?.setData('text/plain', id);
  };

  (window as any).workshopDragOver = (event: DragEvent) => {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.style.border = '2px dashed #14F195';
    target.style.background = 'rgba(20, 241, 149, 0.05)';
  };

  (window as any).workshopDragLeave = (event: DragEvent) => {
    const target = event.currentTarget as HTMLElement;
    target.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    target.style.background = 'rgba(0, 0, 0, 0.2)';
  };

  (window as any).workshopDrop = async (event: DragEvent, targetStatus: string) => {
    event.preventDefault();
    const target = event.currentTarget as HTMLElement;
    target.style.border = '1px solid rgba(255, 255, 255, 0.05)';
    target.style.background = 'rgba(0, 0, 0, 0.2)';
    
    const id = event.dataTransfer?.getData('text/plain');
    if (!id) return;
    
    const rep = ((window as any)._allRepairs || []).find((r: any) => r.id === id);
    if (!rep) return;
    
    if (rep.status === targetStatus) return; // No change
    
    if (targetStatus === 'UNDER_REPAIR') {
      (window as any).openReceiveRepairModal(id);
    } else if (targetStatus === 'REPAIRED') {
      if (rep.status === 'PENDING_ARRIVAL') {
        alert("Bu kart henüz teslim alınmadı! Lütfen önce 'Tamirde' aşamasına alın (Teslim Alın).");
        return;
      }
      (window as any).openCompleteRepairModal(
        rep.id,
        rep.sapNo,
        rep.description.replace(/'/g, "\\'"),
        rep.quantity,
        rep.serialNo || '-',
        rep.faultCode || '-',
        rep.faultDesc ? rep.faultDesc.replace(/'/g, "\\'") : '-'
      );
    } else if (targetStatus === 'SENT_BACK') {
      if (rep.status !== 'REPAIRED') {
        alert("Sadece tamiri tamamlanmış (Sevk Bekleyen) kartlar sevk edilebilir!");
        return;
      }
      (window as any).openWorkshopDispatchModal(
        rep.id,
        rep.sapNo,
        rep.description.replace(/'/g, "\\'"),
        rep.quantity,
        rep.serialNo || '-'
      );
    } else {
      alert("Bu duruma sürükleyerek geçiş yapılamaz.");
    }
  };

  // Workshop Dispatch Repaired Modal (Standalone implementation for Kanban)
  (window as any).openWorkshopDispatchModal = (repairId: string, sapNo: string, description: string, quantity: number, serialNo: string = '-') => {
    const modal = document.createElement('div');
    modal.id = 'dispatch-repaired-modal';
    modal.className = 'modal-overlay';
    modal.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
      z-index: 10002; display: flex; align-items: center; justify-content: center;
    `;
    
    const warehouseOptions = warehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('');

    modal.innerHTML = `
      <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 2rem; border-radius: 16px; border: 1px solid rgba(20, 241, 149, 0.2); box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.5rem; border-bottom:1px solid rgba(255,255,255,0.05); padding-bottom:1rem;">
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#14F195; font-weight:800; letter-spacing:1px;">
            <i class="fa-solid fa-truck-ramp-box" style="margin-right:8px;"></i> MALZEMEYİ SEVK ET (TRANSFER)
          </h3>
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div style="margin-bottom:1.25rem;">
          <p style="color:#94A3B8; font-size:0.85rem; margin-bottom:0.25rem;">Malzeme Detayı</p>
          <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); padding:0.75rem; border-radius:8px;">
            <span style="font-weight:700; color:#FFF; display:block;">${description}</span>
            <span style="font-size:0.75rem; color:#94A3B8;"><i class="fa-solid fa-barcode"></i> SAP: ${sapNo} | Seri No: ${serialNo} | Miktar: ${quantity} Adet</span>
          </div>
        </div>

        <div style="margin-bottom:1.5rem;">
          <label style="display:block; color:#94A3B8; font-size:0.8rem; margin-bottom:0.5rem; font-weight:700; text-transform:uppercase;">Sevk Edilecek Hedef Depo</label>
          <select id="repaired-target-warehouse" class="cyber-input" style="width:100%; padding:0.85rem; background:rgba(0,0,0,0.4); border:1px solid rgba(255,255,255,0.05); color:#FFF; border-radius:8px;">
            ${warehouseOptions}
          </select>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:0.75rem; border-top:1px solid rgba(255,255,255,0.05); padding-top:1.25rem;">
          <button onclick="document.getElementById('dispatch-repaired-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.75rem 1.25rem; font-size:0.85rem;">İPTAL</button>
          <button id="btn-submit-repaired-dispatch" onclick="window.submitWorkshopRepairedDispatch('${repairId}')" class="btn-cyber" style="background:linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color:#0A0E17; font-weight:900; padding:0.75rem 1.5rem; font-size:0.85rem; box-shadow:0 0 15px rgba(20,241,149,0.3);">SEVK ET (YOLA ÇIKAR)</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
  };

  (window as any).submitWorkshopRepairedDispatch = async (repairId: string) => {
    const targetSelect = document.getElementById('repaired-target-warehouse') as HTMLSelectElement;
    if (!targetSelect || !targetSelect.value) {
      alert('Lütfen hedef sevk deposunu seçin.');
      return;
    }

    const btn = document.getElementById('btn-submit-repaired-dispatch');
    if (btn) btn.setAttribute('disabled', 'true');

    try {
      (window as any).showToast('İşlem', 'Malzeme sevk ediliyor...', 'info');
      await repairService.dispatchRepair(repairId, targetSelect.value, username);

      // Deduct REVISED stock from MTA
      const rep = ((window as any)._allRepairs || []).find((r: any) => r.id === repairId);
      if (rep) {
        const { warehouseService } = await import('../services/WarehouseService');
        const sapNoWithR = rep.sapNo.toUpperCase().startsWith('R') ? rep.sapNo : 'R' + rep.sapNo;
        await warehouseService.updateStockBySap(
          'MTA',
          sapNoWithR,
          -rep.quantity,
          {
            user: username,
            reason: `Malzeme ${targetSelect.options[targetSelect.selectedIndex].text} deposuna sevk edildi.`
          },
          'REVISED'
        );
      }

      (window as any).showToast('Başarılı', 'Malzeme başarıyla hedef depoya sevk edildi.', 'success');
      
      const modal = document.getElementById('dispatch-repaired-modal');
      if (modal) modal.remove();

      if ((window as any).navigate) {
        (window as any).navigate('workshop');
      }
    } catch (e) {
      console.error(e);
      alert('Sevk işlemi gerçekleştirilemedi.');
      if (btn) btn.removeAttribute('disabled');
    }
  };

  // Filter repairs
  let filtered = repairs;

  // Status Filter
  if (activeTab === 'pending') {
    filtered = filtered.filter(r => r.status === 'PENDING_ARRIVAL');
  } else if (activeTab === 'under_repair') {
    filtered = filtered.filter(r => r.status === 'UNDER_REPAIR');
  } else if (activeTab === 'repaired') {
    filtered = filtered.filter(r => r.status === 'REPAIRED');
  } else if (activeTab === 'completed') {
    filtered = filtered.filter(r => r.status === 'COMPLETED' || r.status === 'SENT_BACK');
  }

  // Search Filter
  if (searchQuery) {
    const q = searchQuery.toLowerCase().trim();
    filtered = filtered.filter(r => 
      (r.sapNo || '').toLowerCase().includes(q) ||
      (r.serialNo || '').toLowerCase().includes(q) ||
      (r.description || '').toLowerCase().includes(q) ||
      (r.repairNotes || '').toLowerCase().includes(q) ||
      (r.sentBy || '').toLowerCase().includes(q)
    );
  }

  return `
    <div class="fade-in-up content-area">
      <!-- Page Header -->
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #14F195; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-screwdriver-wrench" style="margin-right: 0.5rem;"></i> Merkez Tamir Atölyesi
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Santrallerden sökülen arızalı malzemelerin tamir ve kabul merkezi takip paneli.</p>
        </div>
        
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          ${(isMaterialManager || userProfile?.role === 'TAMİR') ? `
            <button onclick="window.openManualRepairEntryModal()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; border: none; padding: 0 1.25rem; border-radius: 8px; height: 42px; font-size: 0.85rem; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(20, 241, 149, 0.25); font-family: 'Rajdhani', sans-serif; text-transform: uppercase; letter-spacing: 1px;" onmouseover="this.style.filter='brightness(1.1)';" onmouseout="this.style.filter='none';">
              <i class="fa-solid fa-plus-circle"></i> + Manuel Kart Girişi
            </button>
          ` : ''}
          <div style="background: rgba(20, 241, 149, 0.05); border: 1px solid rgba(20, 241, 149, 0.15); padding: 0 1.25rem; border-radius: 12px; display: flex; align-items: center; gap: 0.5rem; height: 42px; box-sizing: border-box;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: #14F195; box-shadow: 0 0 10px #14F195;"></span>
            <span style="font-weight: 700; color: #14F195; font-size: 0.85rem;">Atölye Sorumlusu: ${username}</span>
          </div>
        </div>
      </div>

      <!-- KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #F59E0B; display: flex; align-items: center; gap: 1rem; background: rgba(245, 158, 11, 0.02);">
          <div style="background: rgba(245, 158, 11, 0.1); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #F59E0B; font-size: 1.3rem;">
            <i class="fa-solid fa-truck-fast"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${pendingArrivalCount}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">Kabul Bekleyen</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #3B82F6; display: flex; align-items: center; gap: 1rem; background: rgba(59, 130, 246, 0.02);">
          <div style="background: rgba(59, 130, 246, 0.1); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #3B82F6; font-size: 1.3rem;">
            <i class="fa-solid fa-clock"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${underRepairCount}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">Tamir Aşaması</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #14F195; display: flex; align-items: center; gap: 1rem; background: rgba(20, 241, 149, 0.02);">
          <div style="background: rgba(20, 241, 149, 0.1); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #14F195; font-size: 1.3rem;">
            <i class="fa-solid fa-warehouse"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${repairedCount}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">Atölye Stoğunda</div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; border-left: 4px solid #10B981; display: flex; align-items: center; gap: 1rem; background: rgba(16, 185, 129, 0.02);">
          <div style="background: rgba(16, 185, 129, 0.1); width: 44px; height: 44px; border-radius: 10px; display: flex; align-items: center; justify-content: center; color: #10B981; font-size: 1.3rem;">
            <i class="fa-solid fa-circle-check"></i>
          </div>
          <div>
            <div style="font-size: 1.8rem; font-weight: 800; color: #FFF; font-family: 'Rajdhani', sans-serif; line-height: 1.2;">${completedCount}</div>
            <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">Tamamlananlar</div>
          </div>
        </div>
      </div>

      <!-- Controls & Filter Bar -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 12px; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
          <!-- Tab selector -->
          <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <button onclick="window.setWorkshopTab('all')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${activeTab === 'all' ? 'background: #14F195; color: #0A0E17;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${activeTab}'!=='all') this.style.color='#FFF'" onmouseout="if('${activeTab}'!=='all') this.style.color='#94A3B8'">
              TÜMÜ (${repairs.length})
            </button>
            <button onclick="window.setWorkshopTab('pending')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${activeTab === 'pending' ? 'background: #F59E0B; color: #0A0E17;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${activeTab}'!=='pending') this.style.color='#FFF'" onmouseout="if('${activeTab}'!=='pending') this.style.color='#94A3B8'">
              KABUL BEKLEYEN (${pendingArrivalCount})
            </button>
            <button onclick="window.setWorkshopTab('under_repair')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${activeTab === 'under_repair' ? 'background: #3B82F6; color: #FFF;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${activeTab}'!=='under_repair') this.style.color='#FFF'" onmouseout="if('${activeTab}'!=='under_repair') this.style.color='#94A3B8'">
              TAMİRDE (${underRepairCount})
            </button>
            <button onclick="window.setWorkshopTab('repaired')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${activeTab === 'repaired' ? 'background: #14F195; color: #0A0E17;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${activeTab}'!=='repaired') this.style.color='#FFF'" onmouseout="if('${activeTab}'!=='repaired') this.style.color='#94A3B8'">
              SEVK BEKLEYEN (${repairedCount})
            </button>
            <button onclick="window.setWorkshopTab('completed')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s;
              ${activeTab === 'completed' ? 'background: #10B981; color: #FFF;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${activeTab}'!=='completed') this.style.color='#FFF'" onmouseout="if('${activeTab}'!=='completed') this.style.color='#94A3B8'">
              SEVK EDİLEN / ARŞİV (${completedCount})
            </button>
          </div>

          <!-- View switcher -->
          <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.3); padding: 4px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
            <button onclick="window.setWorkshopViewMode('kanban')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
              ${viewMode === 'kanban' ? 'background: #14F195; color: #0A0E17;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${viewMode}'!=='kanban') this.style.color='#FFF'" onmouseout="if('${viewMode}'!=='kanban') this.style.color='#94A3B8'">
              <i class="fa-solid fa-table-columns"></i> KANBAN TAHTASI
            </button>
            <button onclick="window.setWorkshopViewMode('table')" style="padding: 0.5rem 1rem; border-radius: 6px; border: none; font-size: 0.82rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 6px;
              ${viewMode === 'table' ? 'background: #14F195; color: #0A0E17;' : 'background: transparent; color: #94A3B8;'}"
              onmouseover="if('${viewMode}'!=='table') this.style.color='#FFF'" onmouseout="if('${viewMode}'!=='table') this.style.color='#94A3B8'">
              <i class="fa-solid fa-list"></i> TABLO GÖRÜNÜMÜ
            </button>
          </div>
        </div>

        <!-- Search Bar Row -->
        <div style="display: flex; gap: 0.75rem; align-items: center;">
          <div style="position: relative; flex-grow: 1;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748B;"></i>
            <input type="text" id="workshop-search-input" class="cyber-input" placeholder="SAP No, Seri No, Malzeme Tanımı veya Saha ara..." value="${searchQuery}" style="width: 100%; padding: 0.65rem 1rem 0.65rem 36px; background: rgba(0,0,0,0.4);" onkeydown="if(event.key==='Enter') window.triggerWorkshopSearch()" />
          </div>
          <button onclick="window.triggerWorkshopSearch()" class="btn-cyber" style="background: linear-gradient(135deg, #14F195 0%, #00cc6a 100%); color: #0A0E17; font-weight: 800; border: none; padding: 0.65rem 1.25rem; border-radius: 6px; font-size: 0.85rem; cursor: pointer;">ARA</button>
        </div>
      </div>

      <!-- Repairs Grid (Kanban or Table) -->
      ${viewMode === 'kanban' ? renderKanbanView(filtered, warehouses) : `
        <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px; overflow-x: auto;">
          <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main);">
            <thead>
              <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); font-size: 0.85rem; text-align: left;">
                <th style="padding: 1rem; white-space: nowrap; width: 140px;">Sevk Tarihi</th>
                <th style="padding: 1rem; white-space: nowrap; width: 180px;">Gönderen Depo</th>
                <th style="padding: 1rem;">Malzeme (SAP)</th>
                <th style="padding: 1rem; white-space: nowrap; width: 120px;">Seri No</th>
                <th style="padding: 1rem; text-align: center; white-space: nowrap; width: 80px;">Adet</th>
                <th style="padding: 1rem; white-space: nowrap; width: 150px;">Mevcut Durum Süresi</th>
                <th style="padding: 1rem; white-space: nowrap; width: 220px;">Durum</th>
                <th style="padding: 1rem; text-align: right; white-space: nowrap; width: 160px;">Aksiyon</th>
              </tr>
            </thead>
            <tbody>
              ${renderRows(filtered, warehouses)}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
};

const renderKanbanView = (repairs: RepairRecord[], warehouses: any[]) => {
  const getColRepairs = (status: string) => {
    if (status === 'SENT_BACK_COMPLETED') {
      return repairs.filter(r => r.status === 'SENT_BACK' || r.status === 'COMPLETED');
    }
    return repairs.filter(r => r.status === status);
  };

  const columns = [
    { id: 'PENDING_ARRIVAL', title: 'KABUL BEKLEYEN', color: '#F59E0B', glow: 'rgba(245, 158, 11, 0.3)', bg: 'rgba(245, 158, 11, 0.02)' },
    { id: 'UNDER_REPAIR', title: 'TAMİRDE / ATÖLYEDE', color: '#3B82F6', glow: 'rgba(59, 130, 246, 0.3)', bg: 'rgba(59, 130, 246, 0.02)' },
    { id: 'REPAIRED', title: 'SEVK BEKLEYEN', color: '#14F195', glow: 'rgba(20, 241, 149, 0.3)', bg: 'rgba(20, 241, 149, 0.02)' },
    { id: 'SENT_BACK_COMPLETED', title: 'SEVK EDİLEN / ARŞİV', color: '#10B981', glow: 'rgba(16, 185, 129, 0.3)', bg: 'rgba(16, 185, 129, 0.02)' },
  ];

  return `
    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; align-items: start; min-height: 500px; margin-top: 1rem;">
      ${columns.map(col => {
        const colRepairs = getColRepairs(col.id);
        const colIdForDrop = col.id === 'SENT_BACK_COMPLETED' ? 'SENT_BACK' : col.id;
        return `
          <div class="glass-panel kanban-column-zone" 
               ondragover="window.workshopDragOver(event)" 
               ondragleave="window.workshopDragLeave(event)" 
               ondrop="window.workshopDrop(event, '${colIdForDrop}')"
               style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; min-height: 500px; transition: all 0.2s; box-shadow: inset 0 0 20px rgba(0,0,0,0.4);">
            
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid ${col.color}; padding-bottom: 0.5rem; margin-bottom: 0.5rem;">
              <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.95rem; color: ${col.color}; letter-spacing: 1px;">
                ${col.title}
              </span>
              <span style="background: rgba(255,255,255,0.05); color: #FFF; padding: 2px 8px; border-radius: 20px; font-size: 0.75rem; font-weight: 700;">
                ${colRepairs.length}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 650px; overflow-y: auto; padding-right: 4px;">
              ${colRepairs.length === 0 ? `
                <div style="text-align: center; color: var(--text-dim); font-size: 0.8rem; padding: 2rem 0; border: 1px dashed rgba(255,255,255,0.05); border-radius: 8px;">
                  Sürükleyin veya kayıt bulunmamaktadır.
                </div>
              ` : colRepairs.map(rep => {
                const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId;
                const duration = getStatusDuration(rep);
                return `
                  <div class="kanban-card" 
                       draggable="true" 
                       ondragstart="window.workshopDragStart(event, '${rep.id}')"
                       style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 0.75rem; cursor: grab; transition: transform 0.2s, box-shadow 0.2s;"
                       onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.3)'; this.style.border='1px solid ${col.color}80'; this.style.background='rgba(255,255,255,0.04)';"
                       onmouseout="this.style.transform='none'; this.style.boxShadow='none'; this.style.border='1px solid rgba(255,255,255,0.05)'; this.style.background='rgba(255,255,255,0.02)';"
                       title="Sürükleyip bırakarak süreci güncelleyebilirsiniz">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 4px; margin-bottom: 0.5rem;">
                      <span style="font-weight: 700; color: #FFF; font-size: 0.82rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-family:'Rajdhani', sans-serif;">
                        ${rep.description}
                      </span>
                      <i onclick="window.openRepairTimelineModal('${rep.id}')" class="fa-solid fa-circle-info" style="cursor: pointer; color: #3B82F6; font-size: 1rem; opacity: 0.8; margin-top: 2px;" title="Süreç Detayı"></i>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 3px; font-size: 0.73rem; color: var(--text-dim);">
                      <div><strong>SAP:</strong> ${rep.sapNo}</div>
                      <div><strong>Seri No:</strong> <span style="color: #10B981; font-family: monospace;">${rep.serialNo || '-'}</span></div>
                      <div><strong>Miktar:</strong> ${rep.quantity} Adet</div>
                      <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed rgba(255,255,255,0.05);">
                        <strong>Kaynak:</strong> ${sourceWh}
                      </div>
                      ${rep.faultCode && rep.faultCode !== '-' ? `
                        <div style="color: #F59E0B; font-weight: 600; margin-top: 2px;">
                          <i class="fa-solid fa-triangle-exclamation" style="margin-right: 2px;"></i> ${rep.faultCode}
                        </div>
                      ` : ''}
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 6px; font-size: 0.7rem; color: #F59E0B; font-weight: 700;">
                        <span><i class="fa-regular fa-clock"></i> ${duration}</span>
                        ${rep.status === 'PENDING_ARRIVAL' ? `
                          <button onclick="window.receiveRepairItem('${rep.id}')" style="background: rgba(245, 158, 11, 0.1); color: #F59E0B; border: 1px solid rgba(245,158,11,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; cursor: pointer;">Kabul Et</button>
                        ` : ''}
                        ${rep.status === 'UNDER_REPAIR' ? `
                          <button onclick="window.openCompleteRepairModal('${rep.id}', '${rep.sapNo}', '${rep.description.replace(/'/g, "\\'")}', ${rep.quantity}, '${rep.serialNo || '-'}', '${rep.faultCode || '-'}', '${rep.faultDesc ? rep.faultDesc.replace(/'/g, "\\'") : '-'}')" style="background: rgba(59, 130, 246, 0.1); color: #3B82F6; border: 1px solid rgba(59,130,246,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; cursor: pointer;">Tamamla</button>
                        ` : ''}
                        ${rep.status === 'REPAIRED' ? `
                          <button onclick="window.openWorkshopDispatchModal('${rep.id}', '${rep.sapNo}', '${rep.description.replace(/'/g, "\\'")}', ${rep.quantity}, '${rep.serialNo || '-'}')" style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20,241,149,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.65rem; font-weight: 700; cursor: pointer;">Sevk Et</button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
};

const renderRows = (repairs: RepairRecord[], warehouses: any[]) => {
  if (repairs.length === 0) {
    return `<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-dim);">Atölyede işlem bekleyen veya tamamlanmış herhangi bir tamir kaydı bulunamadı.</td></tr>`;
  }

  const user = (window as any).currentUser;
  const isAdmin = user?.email?.toLowerCase().includes('admin') || user?.email === 'fatih.zebek@demirerholding.com';

  return repairs.map(rep => {
    const sourceWh = warehouses.find(w => w.id === rep.sourceWarehouseId)?.name || rep.sourceWarehouseId;
    const targetWh = rep.targetWarehouseId ? (warehouses.find(w => w.id === rep.targetWarehouseId)?.name || rep.targetWarehouseId) : '-';

    let statusBadge = '';
    let actions = '';

    if (rep.status === 'PENDING_ARRIVAL') {
      statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Atölyeye Gelmesi Bekleniyor</span>`;
      actions = `
        <button onclick="window.receiveRepairItem('${rep.id}')" class="btn-cyber" style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20,241,149,0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#14F195'; this.style.color='#0A0E17';" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'; this.style.color='#14F195';">
          <i class="fa-solid fa-hand-holding-hand" style="margin-right: 4px;"></i> Teslim Aldım
        </button>
      `;
    } else if (rep.status === 'UNDER_REPAIR') {
      statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Atölyede (Tamirde)</span>`;
      actions = `
        <button onclick="window.openCompleteRepairModal('${rep.id}', '${rep.sapNo}', '${rep.description.replace(/'/g, "\\'")}', ${rep.quantity}, '${rep.serialNo || '-'}', '${rep.faultCode || '-'}', '${rep.faultDesc ? rep.faultDesc.replace(/'/g, "\\'") : '-'}')" class="btn-cyber" style="background: rgba(20, 241, 149, 0.1); color: #14F195; border: 1px solid rgba(20,241,149,0.3); padding: 0.4rem 0.8rem; border-radius: 6px; font-size: 0.8rem; font-weight: 700; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.background='#14F195'; this.style.color='#0A0E17';" onmouseout="this.style.background='rgba(20, 241, 149, 0.1)'; this.style.color='#14F195';">
          <i class="fa-solid fa-check-double" style="margin-right: 4px;"></i> Tamiri Tamamla
        </button>
      `;
    } else if (rep.status === 'REPAIRED') {
      statusBadge = `<span style="background: rgba(20, 241, 149, 0.15); color: #14F195; border: 1px solid rgba(20, 241, 149, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Tamir Edildi</span>`;
      actions = `<span style="color: #14F195; font-size: 0.8rem; font-weight: 600;"><i class="fa-solid fa-warehouse" style="margin-right: 4px;"></i> Sevk Bekliyor</span>`;
    } else if (rep.status === 'SENT_BACK') {
      statusBadge = `<span style="background: rgba(139, 92, 246, 0.15); color: #8B5CF6; border: 1px solid rgba(139, 92, 246, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Yolda (Geri Sevk)</span>`;
      actions = `<span style="color: var(--text-dim); font-size: 0.8rem;">Hedef: ${targetWh}</span>`;
    } else if (rep.status === 'COMPLETED') {
      statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.75rem; font-weight: 700; text-transform: uppercase;">Depoda (Kabul)</span>`;
      actions = `<span style="color: #10B981; font-size: 0.8rem;"><i class="fa-solid fa-square-check"></i> Giriş Yapıldı</span>`;
    }

    const duration = getStatusDuration(rep);

    const deleteBtn = isAdmin ? `
      <button onclick="window.deleteRepairRecord('${rep.id}')" class="btn-cyber" style="background: rgba(239, 68, 68, 0.15); color: #EF4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.8rem; cursor: pointer; margin-left: 8px; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center;" onmouseover="this.style.background='#EF4444'; this.style.color='#FFF';" onmouseout="this.style.background='rgba(239, 68, 68, 0.15)'; this.style.color='#EF4444';" title="Kaydı Sil">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    ` : '';

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
        <td style="padding: 1rem; font-size: 0.85rem; white-space: nowrap; width: 140px;">${formatDateTime(rep.sentAt)}</td>
        <td style="padding: 1rem; font-size: 0.85rem; color: #E2E8F0; font-weight: 500; white-space: nowrap; width: 180px;">
          <span style="display: block; white-space: nowrap;">${sourceWh}</span>
          ${rep.dispatchNo ? `<span style="display: block; font-size: 0.72rem; color: #14F195; font-family: monospace; font-weight: bold; margin-top: 4px; white-space: nowrap;"><i class="fa-solid fa-truck-ramp-box" style="margin-right: 2px;"></i> ${rep.dispatchNo}</span>` : ''}
        </td>
        <td style="padding: 1rem;">
          <div style="font-weight: 700; color: #FFF;">${rep.description}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 2px;"><i class="fa-solid fa-barcode"></i> ${rep.sapNo}</div>
          ${rep.faultCode && rep.faultCode !== '-' ? `<div style="font-size: 0.72rem; color: #F59E0B; font-weight: 600;"><i class="fa-solid fa-triangle-exclamation" style="margin-right: 2px;"></i> Arıza: ${rep.faultCode}</div>` : ''}
        </td>
        <td style="padding: 1rem; font-size: 0.85rem; color: #10B981; font-family: monospace; font-weight: bold; white-space: nowrap; width: 120px;">${rep.serialNo || '-'}</td>
        <td style="padding: 1rem; font-weight: 800; color: #14F195; text-align: center; white-space: nowrap; width: 80px;">${rep.quantity} Adet</td>
        <td style="padding: 1rem; font-size: 0.85rem; color: #F59E0B; font-weight: 600; white-space: nowrap; width: 150px;">
          <i class="fa-regular fa-clock" style="margin-right: 4px; font-size: 0.8rem; opacity: 0.8;"></i> ${duration}
        </td>
        <td style="padding: 1rem; width: 220px;">
          <div style="display: flex; align-items: center; gap: 8px; white-space: nowrap;">
            ${statusBadge}
            <i onclick="window.openRepairTimelineModal('${rep.id}')" class="fa-solid fa-circle-info" style="cursor: pointer; color: #3B82F6; font-size: 1.1rem; opacity: 0.8; transition: opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.8'" title="Süreç Detayı"></i>
          </div>
        </td>
        <td style="padding: 1rem; text-align: right; width: 160px; white-space: nowrap;">
          <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
            ${actions}
            ${deleteBtn}
          </div>
        </td>
      </tr>
    `;
  }).join('');
};
