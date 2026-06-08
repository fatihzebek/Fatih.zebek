import { maintenanceService } from '../services/MaintenanceService';

(window as any).handleDuplicate = async (e: any, id: string) => {
  e.stopPropagation();
  if (!confirm('Bu şablonu kopyalamak istediğinize emin misiniz?')) return;
  
  try {
    const btn = e.target.closest('.copy-btn');
    if (btn) {
      const originalText = btn.innerHTML;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kopyalanıyor...';
      btn.style.pointerEvents = 'none';
    }

    await maintenanceService.duplicateTemplate(id);
    
    (window as any).showToast?.('Şablon başarıyla kopyalandı', 'success');
    (window as any).navigate?.('templates');
  } catch (err) {
    console.error(err);
    (window as any).showToast?.('Kopyalama sırasında bir hata oluştu', 'error');
  }
};

(window as any).handleCreateTemplate = async (e: any) => {
  e.stopPropagation();
  try {
    const btn = e.target.closest('button');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> OLUŞTURULUYOR...';
      btn.style.pointerEvents = 'none';
    }
    
    const newId = await maintenanceService.createEmptyTemplate();
    (window as any).showToast?.('Yeni şablon başarıyla oluşturuldu', 'success');
    (window as any).navigate?.('form-template-edit', newId);
  } catch (err) {
    console.error(err);
    (window as any).showToast?.('Şablon oluşturulurken bir hata oluştu', 'error');
  }
};

(window as any).handleDeleteTemplate = async (e: any, id: string) => {
  e.stopPropagation();
  if (!confirm('Bu şablonu silmek istediğinize emin misiniz? Bu işlem geri alınamaz!')) return;
  
  try {
    const btn = e.target.closest('.delete-btn');
    if (btn) {
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>...';
      btn.style.pointerEvents = 'none';
    }

    await maintenanceService.deleteTemplate(id);
    
    (window as any).showToast?.('Şablon başarıyla silindi', 'success');
    (window as any).navigate?.('templates');
  } catch (err) {
    console.error(err);
    (window as any).showToast?.('Silme işlemi sırasında bir hata oluştu', 'error');
  }
};

export const TemplatesPage = async () => {
  const templates = await maintenanceService.fetchTemplates();
  
  return `
    <style>
      .templates-container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
        animation: fadeIn 0.5s ease-out;
      }
      .template-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1.5rem;
        margin-top: 2rem;
      }
      @media (max-width: 1024px) {
        .template-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      @media (max-width: 768px) {
        .template-grid {
          grid-template-columns: 1fr;
        }
      }
      .template-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 16px;
        padding: 1.5rem;
        cursor: pointer;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        position: relative;
        overflow: hidden;
      }
      .template-card:hover {
        background: rgba(255,255,255,0.06);
        border-color: rgba(100, 255, 218, 0.3);
        transform: translateY(-5px);
        box-shadow: 0 10px 30px rgba(0,0,0,0.3);
      }
      .template-card::after {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 4px; height: 100%;
        background: var(--accent-cyan, #64ffda);
        opacity: 0.3;
      }
      .model-badge {
        font-size: 0.6rem;
        font-weight: 900;
        letter-spacing: 1px;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255,255,255,0.05);
        color: #8892b0;
        text-transform: uppercase;
      }
      .action-btns {
        position: absolute;
        top: 1rem;
        right: 1rem;
        display: flex;
        gap: 0.5rem;
        opacity: 0;
        transform: translateY(-5px);
        transition: all 0.3s ease;
        z-index: 10;
      }
      .template-card:hover .action-btns {
        opacity: 1;
        transform: translateY(0);
      }
      .copy-btn, .delete-btn {
        background: rgba(0,0,0,0.4);
        border: 1px solid rgba(255,255,255,0.1);
        padding: 6px 10px;
        border-radius: 8px;
        font-size: 0.65rem;
        font-weight: 800;
        cursor: pointer;
        backdrop-filter: blur(5px);
        transition: all 0.3s ease;
      }
      .copy-btn { color: var(--accent-cyan); }
      .delete-btn { color: var(--accent-red); }
      
      .copy-btn:hover { background: var(--accent-cyan); color: #000; }
      .delete-btn:hover { background: var(--accent-red); color: #fff; }
    </style>

    <div class="templates-container">
      <header style="margin-bottom: 3rem; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h1 style="font-size: 2.5rem; font-weight: 900; letter-spacing: -1px; margin-bottom: 0.5rem;">Şablon Yönetim Merkezi</h1>
          <p style="color: #8892b0; font-size: 0.9rem; margin: 0;">Türbin modellerine ve bakım tiplerine göre özelleştirilmiş operasyonel şablonlar.</p>
        </div>
        <button class="btn-cyber" style="background: var(--accent-green); color: #000; position: relative; z-index: 100;" onclick="window.handleCreateTemplate(event)">
          <i class="fa-solid fa-plus"></i> YENİ ŞABLON OLUŞTUR
        </button>
      </header>

      <div class="template-grid">
        ${templates
          .sort((a, b) => {
            const modelOrder = ['E44-E48', 'E70', 'E82', 'E82/E2', 'E92', 'GLOBAL'];
            const pA = modelOrder.indexOf(a.turbineModel);
            const pB = modelOrder.indexOf(b.turbineModel);
            
            if (pA !== pB) return pA - pB;
            
            // Inside same model group, sort by maintenance type priority
            const getTypePriority = (name: string) => {
              const n = name.toLowerCase();
              if (n.includes('yağlama')) return 1;
              if (n.includes('ana bakım') && !n.includes('4 yıllık') && !n.includes('yıllık')) return 2;
              if (n.includes('yıllık') || n.includes('4 yıllık')) return 3;
              if (n.includes('arıza')) return 4;
              return 5;
            };
            
            const tA = getTypePriority(a.name);
            const tB = getTypePriority(b.name);
            
            if (tA !== tB) return tA - tB;
            
            // Specific order for GLOBAL group
            if (a.turbineModel === 'GLOBAL') {
              if (a.name.toLowerCase().includes('rüzgar')) return -1;
              if (b.name.toLowerCase().includes('rüzgar')) return 1;
              if (a.id === 'form-ariza') return 1;
              if (b.id === 'form-ariza') return -1;
            }
            
            return a.name.localeCompare(b.name);
          })
          .map(t => {
            const isAriza = t.id === 'form-ariza' || t.name === 'Arıza Formu';
            const isDefault = t.id && !t.id.includes('custom') && !t.id.includes('copy');
            const navCmd = isAriza ? "(function(){ localStorage.removeItem('currentEditingTemplateId'); localStorage.removeItem('activeTask'); localStorage.setItem('fromTemplates', 'true'); window.navigate('form-ariza'); })()" : "window.navigate('form-template-edit', '" + t.id + "')";
            
            return `
            <div class="template-card" onclick="${navCmd}">
            <div class="action-btns">
              <button class="copy-btn" onclick="window.handleDuplicate(event, '${t.id}')" title="Şablonu Kopyala">
                <i class="fa-solid fa-copy"></i>
              </button>
              ${!isDefault && !isAriza ? `<button class="delete-btn" onclick="window.handleDeleteTemplate(event, '${t.id}')" title="Şablonu Sil">
                <i class="fa-solid fa-trash"></i>
              </button>` : ''}
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <span style="font-size: 1.5rem;">${t.icon}</span>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-lock" style="color: #64748b; font-size: 0.7rem;" title="Bu kurumsal bir şablondur ve kilitlidir."></i>
                <span class="model-badge" style="${t.id.includes('ariza') ? 'background: rgba(0, 242, 254, 0.1); color: var(--accent-cyan);' : ''}">${t.turbineModel}</span>
              </div>
            </div>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: ${t.id.includes('ariza') ? 'var(--accent-cyan)' : 'inherit'}">${t.name}</h3>
            <div style="margin-top: 1.5rem; display: flex; flex-direction: column; gap: 0.5rem; opacity: 0.7; font-size: 0.65rem; font-weight: 700; color: var(--text-muted);">
               <div style="display: flex; align-items: flex-start; gap: 0.5rem;">
                 <i class="fa-solid fa-file-shield" style="margin-top: 2px; color: var(--accent-cyan);"></i>
                 <span>${t.instructionCode || 'Talimatname Kodu Tanımlanmamış'}</span>
               </div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
    </div>
  `;
};
