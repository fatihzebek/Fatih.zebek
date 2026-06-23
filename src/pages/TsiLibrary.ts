import { authService } from '../services/AuthService';
import { tsiService } from '../services/TsiService';
import type { TsiCategory, TsiDocument } from '../services/TsiService';

export const formatBytes = (bytes: number, decimals = 2) => {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

export const TsiLibraryPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const hasAiPermission = isAdmin || (currentUser?.allowedTabs?.['tsi-library']?.aiAgent === true);

  return `
    <div class="fade-in-up content-area" style="display: flex; flex-direction: column; height: 100%;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <div>
          <h1 class="page-title" style="margin-bottom: 0.5rem;">
            <i class="fa-solid fa-book-bookmark" style="color: var(--accent-cyan);"></i> Servis Teknik Information
          </h1>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">
            Güncel talimatlar, çalışma prosedürleri ve teknik kılavuzlar kütüphanesi.
          </p>
        </div>
        <div style="display: flex; gap: 1rem; align-items: center;">
          ${hasAiPermission ? `
            <button class="btn-cyber" style="background: linear-gradient(135deg, rgba(0, 243, 255, 0.1), rgba(0, 255, 10 green, 0.1)); border-color: rgba(0, 243, 255, 0.4); color: var(--accent-cyan);" onclick="window.openTsiAiAgent()">
              <i class="fa-solid fa-robot"></i> YAPAY ZEKA DANIŞMANI
            </button>
          ` : ''}
          ${isAdmin ? `
            <button class="btn-cyber-outline" onclick="window.openTsiCategoryModal()">
              <i class="fa-solid fa-folder-plus"></i> KATEGORİ YÖNETİMİ
            </button>
            <button class="btn-cyber" onclick="window.openTsiUploadModal()">
              <i class="fa-solid fa-cloud-arrow-up"></i> YENİ DOKÜMAN
            </button>
          ` : ''}
        </div>
      </div>

      <div style="display: flex; gap: 1.5rem; flex: 1; min-height: 500px; height: calc(100vh - 200px); min-height: 600px; overflow: hidden;">
        <!-- Left Sidebar: Categories -->
        <div class="glass-panel" style="width: 280px; flex-shrink: 0; padding: 1.5rem; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.05); overflow-y: auto;">
          <h3 style="font-size: 0.85rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px; margin: 0 0 1rem 0; text-transform: uppercase;">
            KATEGORİLER
          </h3>
          <div id="tsi-categories-container" style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto;">
            <div style="text-align: center; color: var(--accent-cyan); padding: 1rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</div>
          </div>
        </div>

        <!-- Center Content: Documents -->
        <div class="glass-panel" style="flex: 1; padding: 1.5rem; display: flex; flex-direction: column; position: relative; overflow: hidden;">
          <div id="tsi-documents-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; padding-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <h2 id="tsi-active-category-title" style="margin: 0; color: var(--text-main); font-size: 1.25rem; font-weight: 700;">
              Lütfen bir kategori seçin
            </h2>
            <div class="search-box" style="position: relative; width: 250px;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted);"></i>
              <input type="text" id="tsi-search-input" class="cyber-input" style="padding-left: 32px; height: 36px; border-radius: 8px;" placeholder="Dokümanlarda ara...">
            </div>
          </div>

          <div id="tsi-documents-list" style="display: flex; flex-direction: column; gap: 0.75rem; overflow-y: auto; padding-bottom: 2rem; flex: 1;">
            <!-- Documents will be rendered here -->
          </div>
        </div>

        <!-- Right Sidebar: AI Agent Chat -->
        <div id="tsi-ai-panel" class="glass-panel hidden" style="width: 380px; flex-shrink: 0; padding: 1.5rem; display: flex; flex-direction: column; border-left: 1px solid rgba(0, 243, 255, 0.25); background: rgba(10, 14, 23, 0.98); box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5); z-index: 10; transition: all 0.3s ease;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 0.8rem;">
            <div style="display: flex; align-items: center; gap: 8px; color: var(--accent-cyan);">
              <i class="fa-solid fa-robot" style="font-size: 1.25rem;"></i>
              <h3 style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; margin: 0; font-weight: 800; letter-spacing: 0.5px; display: flex; align-items: center; gap: 6px;">
                YAPAY ZEKA DANIŞMANI <span class="tsi-pulse-dot" style="margin-left: 4px;"></span>
              </h3>
            </div>
            <button onclick="window.closeTsiAiAgent()" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.1rem; transition: color 0.2s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='var(--text-dim)'">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          
          <div style="margin-bottom: 1rem; padding: 0.75rem; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 8px;">
            <div style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px;">Aktif Doküman</div>
            <div id="tsi-ai-active-doc" style="font-family: 'Rajdhani', sans-serif; font-weight: 700; font-size: 0.9rem; color: #fff; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">Genel Kütüphane Danışmanlığı</div>
          </div>

          <!-- Chat messages area -->
          <div id="tsi-chat-messages" style="flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-right: 2px; margin-bottom: 1rem;">
            <div style="background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; line-height: 1.4;">
              <strong>Danışman:</strong> Merhaba! Ben Servis Kütüphanesi Yapay Zeka Danışmanınız. 
              <br><br>
              Listeden bir PDF dokümanının altındaki <strong>"Ajan'a Sor"</strong> butonuna basarak dokümanı buraya yükleyebilir ve bana o dokümanla ilgili teknik sorular sorabilirsiniz.
            </div>
          </div>

          <!-- Chat input area -->
          <div style="display: flex; gap: 8px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 1rem;">
            <input type="text" id="tsi-chat-input" class="cyber-input" style="flex: 1; height: 38px; border-radius: 6px; font-size: 0.8rem;" placeholder="Doküman hakkında soru sorun..." onkeydown="if(event.key === 'Enter') window.sendTsiAiMessage()">
            <button id="tsi-chat-send-btn" class="btn-cyber" style="padding: 0 14px; height: 38px; border-radius: 6px;" onclick="window.sendTsiAiMessage()">
              <i class="fa-solid fa-paper-plane"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modals (Admin Only) -->
    ${isAdmin ? `
      <!-- Upload Document Modal -->
      <div id="tsi-upload-modal" class="modal-overlay hidden">
        <div class="glass-panel modal-content" style="max-width: 500px; padding: 2rem;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; color: var(--accent-cyan);"><i class="fa-solid fa-cloud-arrow-up"></i> Yeni Doküman Yükle</h3>
            <button class="action-icon-btn" onclick="window.closeTsiUploadModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="permission-label">DOKÜMAN BAŞLIĞI (Opsiyonel)</label>
            <input type="text" id="tsi-upload-title" class="cyber-input" placeholder="Boş bırakılırsa dosya adı kullanılır">
          </div>
          
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="permission-label">KATEGORİ</label>
            <select id="tsi-upload-category" class="cyber-input">
              <option value="">Kategori Seçin...</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom: 1.5rem;">
            <label class="permission-label">PDF DOSYALARI (Çoklu seçebilirsiniz)</label>
            <input type="file" id="tsi-upload-file" accept=".pdf" multiple class="cyber-input" style="padding: 8px;">
          </div>
          
          <div id="tsi-upload-progress" class="hidden" style="margin-bottom: 1rem;">
            <div style="height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden;">
              <div id="tsi-progress-bar" style="height: 100%; width: 0%; background: var(--accent-cyan); transition: width 0.3s;"></div>
            </div>
            <div style="text-align: right; font-size: 0.75rem; color: var(--accent-cyan); margin-top: 4px;" id="tsi-progress-text">0%</div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 1rem;">
            <button class="btn-cyber-outline" id="tsi-upload-cancel-btn" onclick="window.closeTsiUploadModal()">İPTAL</button>
            <button class="btn-cyber" id="tsi-upload-btn" onclick="window.submitTsiUpload()">YÜKLE</button>
          </div>
        </div>
      </div>

      <!-- Category Management Modal -->
      <div id="tsi-category-modal" class="modal-overlay hidden">
        <div class="glass-panel modal-content" style="max-width: 450px; padding: 2rem;">
          <div class="modal-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
            <h3 style="margin: 0; color: var(--accent-cyan);"><i class="fa-solid fa-folder-tree"></i> Kategori Yönetimi</h3>
            <button class="action-icon-btn" onclick="window.closeTsiCategoryModal()"><i class="fa-solid fa-xmark"></i></button>
          </div>
          
          <div style="display: flex; gap: 8px; margin-bottom: 1.5rem;">
            <input type="text" id="tsi-new-category-name" class="cyber-input" placeholder="Yeni Kategori Adı">
            <button class="btn-cyber" onclick="window.addTsiCategory()">EKLE</button>
          </div>
          
          <div id="tsi-category-manage-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 300px; overflow-y: auto;">
            <!-- Categories will be listed here with delete buttons -->
          </div>
        </div>
      </div>
    ` : ''}

    <style>
      .tsi-cat-btn {
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-dim);
        padding: 0.75rem 1rem;
        border-radius: 8px;
        text-align: left;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tsi-cat-btn:hover {
        background: rgba(255,255,255,0.02);
        color: var(--text-main);
      }
      .tsi-cat-btn.active {
        background: rgba(0, 243, 255, 0.1);
        border: 1px solid rgba(0, 243, 255, 0.2);
        color: var(--accent-cyan);
      }
      .tsi-doc-row {
        background: rgba(255,255,255,0.015);
        border: 1px solid rgba(255,255,255,0.04);
        border-left: 3px solid transparent;
        border-radius: 10px;
        padding: 0.85rem 1.25rem;
        transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 1.5rem;
        backdrop-filter: blur(5px);
      }
      .tsi-doc-row:hover {
        border-left-color: var(--accent-cyan);
        border-top-color: rgba(0, 243, 255, 0.15);
        border-right-color: rgba(0, 243, 255, 0.15);
        border-bottom-color: rgba(0, 243, 255, 0.15);
        background: rgba(0, 243, 255, 0.02);
        box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3), inset 0 0 10px rgba(0, 243, 255, 0.05);
        transform: translateY(-2px);
      }
      .tsi-doc-row.dragging {
        opacity: 0.4;
        border: 1px dashed var(--accent-cyan) !important;
        background: rgba(0, 243, 255, 0.01) !important;
      }
      .tsi-doc-row.drag-over {
        border-top: 2px solid var(--accent-cyan) !important;
        background: rgba(0, 243, 255, 0.05) !important;
      }
      .drag-handle:hover {
        color: var(--accent-cyan) !important;
      }
      .doc-icon-container {
        width: 38px;
        height: 38px;
        background: rgba(255, 77, 77, 0.1);
        color: #ff4d4d;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.2rem;
        flex-shrink: 0;
      }
      .tsi-dropzone {
        transition: all 0.3s ease;
      }
      .tsi-dropzone:hover {
        background: rgba(0, 242, 254, 0.04) !important;
        border-color: rgba(0, 242, 254, 0.4) !important;
        box-shadow: 0 0 25px rgba(0, 242, 254, 0.1) !important;
      }
      .tsi-dropzone:hover .tsi-dropzone-icon {
        transform: scale(1.08);
        box-shadow: 0 0 25px rgba(0, 242, 254, 0.3) !important;
        background: rgba(0, 242, 254, 0.1) !important;
      }
      .tsi-pulse-dot {
        width: 8px;
        height: 8px;
        background-color: #10b981;
        border-radius: 50%;
        display: inline-block;
        box-shadow: 0 0 8px #10b981;
        animation: tsiPulse 2s infinite;
      }
      @keyframes tsiPulse {
        0% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7);
        }
        70% {
          transform: scale(1);
          box-shadow: 0 0 0 6px rgba(16, 185, 129, 0);
        }
        100% {
          transform: scale(0.95);
          box-shadow: 0 0 0 0 rgba(16, 185, 129, 0);
        }
      }
    </style>
  `;
};

const getCategoryIcon = (catName: string) => {
  const name = catName.toLowerCase();
  if (name.includes('talimat') || name.includes('t01') || name.includes('t1')) return 'fa-file-lines';
  if (name.includes('bildiri') || name.includes('t02') || name.includes('t2')) return 'fa-bullhorn';
  if (name.includes('rapor') || name.includes('t03') || name.includes('t3')) return 'fa-file-invoice';
  if (name.includes('kart') || name.includes('t04') || name.includes('t4')) return 'fa-microchip';
  if (name.includes('program') || name.includes('t05') || name.includes('t5')) return 'fa-laptop-code';
  if (name.includes('yazılım') || name.includes('yazilim') || name.includes('t06') || name.includes('t6')) return 'fa-code-branch';
  if (name.includes('onarım') || name.includes('onarim') || name.includes('t07') || name.includes('t7')) return 'fa-screwdriver-wrench';
  if (name.includes('bakım') || name.includes('bakim') || name.includes('t08') || name.includes('t8') || name.includes('kurulum')) return 'fa-tools';
  if (name.includes('haber') || name.includes('bülten') || name.includes('bulletin') || name.includes('sqa') || name.includes('t09') || name.includes('t9')) return 'fa-newspaper';
  if (name.includes('data') || name.includes('sheet') || name.includes('t10')) return 'fa-database';
  if (name.includes('şema') || name.includes('sema') || name.includes('t12')) return 'fa-diagram-project';
  if (name.includes('manual') || name.includes('operating') || name.includes('t20')) return 'fa-book';
  return 'fa-folder';
};

const getCategoryDocCount = (categoryId: string) => {
  return allTsiDocuments.filter(d => d.categoryId === categoryId).length;
};

// Global State
let allTsiCategories: TsiCategory[] = [];
let allTsiDocuments: TsiDocument[] = [];
let activeCategoryId: string | null = null;
let unsubCategories: (() => void) | null = null;
let unsubDocuments: (() => void) | null = null;

export const initTsiLibrary = () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const allowedCategories = currentUser?.allowedTsiCategories || [];

  unsubCategories = tsiService.subscribeCategories((categories) => {
    // If not admin, only show categories user has permission to see
    allTsiCategories = isAdmin ? categories : categories.filter(c => allowedCategories.includes(c.id));
    renderCategories();
    
    if (isAdmin) {
      renderCategoryManageList();
      updateUploadCategorySelect();
    }
  });

  unsubDocuments = tsiService.subscribeDocuments((docs) => {
    allTsiDocuments = docs;
    renderCategories(); // Redraw count badges
    renderDocuments();
  });

  // Search input event
  setTimeout(() => {
    const searchInput = document.getElementById('tsi-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderDocuments());
    }
  }, 100);
};

export const destroyTsiLibrary = () => {
  if (unsubCategories) unsubCategories();
  if (unsubDocuments) unsubDocuments();
};

const renderCategories = () => {
  const container = document.getElementById('tsi-categories-container');
  if (!container) return;

  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  if (allTsiCategories.length === 0) {
    if (isAdmin) {
      container.innerHTML = `
        <div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center;">
          <p style="margin-bottom: 1rem;">Henüz kategori bulunmuyor.</p>
          <button class="btn-cyber" onclick="window.seedDefaultTsiCategories()" style="width: 100%; font-size: 0.75rem;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> KLASÖRLERİ OLUŞTUR
          </button>
        </div>
      `;
    } else {
      container.innerHTML = `<div style="color: var(--text-muted); font-size: 0.85rem; padding: 1rem; text-align: center;">Henüz kategori bulunmuyor veya yetkiniz yok.</div>`;
    }
    return;
  }

  container.innerHTML = allTsiCategories.map(cat => {
    const docCount = getCategoryDocCount(cat.id);
    const iconClass = getCategoryIcon(cat.name);
    return `
      <button class="tsi-cat-btn ${activeCategoryId === cat.id ? 'active' : ''}" onclick="window.selectTsiCategory('${cat.id}')">
        <i class="fa-solid ${activeCategoryId === cat.id ? 'fa-folder-open' : iconClass}" style="color: ${activeCategoryId === cat.id ? 'var(--accent-cyan)' : 'inherit'};"></i> 
        <span style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cat.name}</span>
        <span class="tsi-cat-count" style="font-size: 0.7rem; background: ${activeCategoryId === cat.id ? 'rgba(0, 243, 255, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${activeCategoryId === cat.id ? 'var(--accent-cyan)' : 'var(--text-dim)'}; padding: 2px 6px; border-radius: 6px; font-family: monospace; font-weight: 700; border: 1px solid ${activeCategoryId === cat.id ? 'rgba(0, 243, 255, 0.3)' : 'rgba(255,255,255,0.05)'};">${docCount}</span>
      </button>
    `;
  }).join('');

  // Auto-select first category if none active
  if (!activeCategoryId && allTsiCategories.length > 0) {
    (window as any).selectTsiCategory(allTsiCategories[0].id);
  }
};

(window as any).selectTsiCategory = (id: string) => {
  activeCategoryId = id;
  const cat = allTsiCategories.find(c => c.id === id);
  
  const titleEl = document.getElementById('tsi-active-category-title');
  if (titleEl && cat) {
    titleEl.innerText = cat.name;
  }
  
  renderCategories(); // Update active states
  renderDocuments();
};

const uploadDroppedFiles = async (files: FileList | File[], categoryId: string) => {
  const currentUser = (window as any).currentUser;
  const uploadedBy = currentUser?.displayName || currentUser?.email || 'Admin';

  (window as any).showToast('İşlem', `${files.length} dosya yükleniyor, lütfen bekleyin...`, 'info');
  
  let successCount = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const docTitle = file.name.replace('.pdf', '');
    try {
      await tsiService.uploadDocument(file, docTitle, categoryId, uploadedBy);
      successCount++;
    } catch (err) {
      console.error(`Upload error for dropped file ${file.name}:`, err);
    }
  }

  if (successCount > 0) {
    (window as any).showToast('Başarılı', `${successCount} dosya başarıyla kütüphaneye eklendi.`, 'success');
  } else {
    (window as any).showToast('Hata', 'Dosyalar yüklenirken bir hata oluştu.', 'error');
  }
};

(window as any).handleTsiDragOver = (e: DragEvent) => {
  e.preventDefault();
  const zone = document.getElementById('tsi-drag-drop-zone');
  if (zone) {
    zone.style.background = 'rgba(0, 242, 254, 0.04)';
    zone.style.borderColor = 'var(--accent-cyan)';
    zone.style.boxShadow = '0 0 25px rgba(0, 242, 254, 0.15)';
  }
};

(window as any).handleTsiDragLeave = (e: DragEvent) => {
  e.preventDefault();
  const zone = document.getElementById('tsi-drag-drop-zone');
  if (zone) {
    zone.style.background = 'rgba(0, 242, 254, 0.01)';
    zone.style.borderColor = 'rgba(0, 242, 254, 0.15)';
    zone.style.boxShadow = 'none';
  }
};

(window as any).triggerTsiFileInput = () => {
  document.getElementById('tsi-drag-file-input')?.click();
};

(window as any).handleTsiDragFileInputChange = async (categoryId: string) => {
  const input = document.getElementById('tsi-drag-file-input') as HTMLInputElement;
  if (input && input.files && input.files.length > 0) {
    await uploadDroppedFiles(input.files, categoryId);
  }
};

(window as any).handleTsiDrop = async (e: DragEvent, categoryId: string) => {
  e.preventDefault();
  (window as any).handleTsiDragLeave(e);
  if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const files = Array.from(e.dataTransfer.files).filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (files.length === 0) {
      (window as any).showToast('Hata', 'Yalnızca PDF dosyaları sürüklenebilir.', 'error');
      return;
    }
    await uploadDroppedFiles(files, categoryId);
  }
};

const renderDocuments = () => {
  const list = document.getElementById('tsi-documents-list');
  if (!list || !activeCategoryId) return;

  const searchInput = (document.getElementById('tsi-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
  
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const hasAiPermission = isAdmin || (currentUser?.allowedTabs?.['tsi-library']?.aiAgent === true);

  const categoryDocs = allTsiDocuments.filter(d => d.categoryId === activeCategoryId);
  const docs = categoryDocs.filter(d => 
    d.title.toLowerCase().includes(searchInput) || d.fileName.toLowerCase().includes(searchInput)
  );

  // Sort docs: order ascending, then createdAt descending
  docs.sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  if (categoryDocs.length === 0) {
    if (isAdmin) {
      list.innerHTML = `
        <div id="tsi-drag-drop-zone" class="tsi-dropzone" style="width: 100%; padding: 4.5rem 2rem; text-align: center; color: var(--text-muted); background: rgba(0, 242, 254, 0.01); border-radius: 16px; border: 2px dashed rgba(0, 242, 254, 0.15); transition: all 0.3s; position: relative; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1rem;" ondragover="window.handleTsiDragOver(event)" ondragleave="window.handleTsiDragLeave(event)" ondrop="window.handleTsiDrop(event, '${activeCategoryId}')" onclick="window.triggerTsiFileInput()">
          <div class="tsi-dropzone-icon" style="width: 70px; height: 70px; border-radius: 50%; background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 2rem; transition: all 0.3s; box-shadow: 0 0 15px rgba(0, 242, 254, 0.15);">
            <i class="fa-solid fa-cloud-arrow-up"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; font-family: 'Rajdhani', sans-serif; font-size: 1.3rem; font-weight: 800; color: #fff; letter-spacing: 0.5px; text-transform: uppercase;">DOSYALARI BURAYA SÜRÜKLE VEYA SEÇ</h4>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Bu kategoriye ait PDF dokümanlarını buraya bırakarak hızlıca yükleyebilirsiniz.</p>
          </div>
          <input type="file" id="tsi-drag-file-input" accept=".pdf" multiple style="display: none;" onchange="window.handleTsiDragFileInputChange('${activeCategoryId}')">
        </div>
      `;
    } else {
      list.innerHTML = `
        <div style="width: 100%; padding: 5rem 2rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.01); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.05); display: flex; flex-direction: column; align-items: center; gap: 1rem;">
          <div style="width: 70px; height: 70px; border-radius: 50%; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.05); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 2rem; opacity: 0.6;">
            <i class="fa-solid fa-folder-open"></i>
          </div>
          <div>
            <h4 style="margin: 0 0 8px 0; font-family: 'Rajdhani', sans-serif; font-size: 1.2rem; font-weight: 700; color: var(--text-dim);">Döküman Bulunmamaktadır</h4>
            <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">Bu kategoride henüz yayınlanmış bir servis talimatı bulunmamaktadır.</p>
          </div>
        </div>
      `;
    }
    return;
  }

  if (docs.length === 0) {
    list.innerHTML = `
      <div style="width: 100%; padding: 4rem; text-align: center; color: var(--text-muted);">
        <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; margin-bottom: 1rem; opacity: 0.3; color: var(--accent-cyan);"></i>
        <p>"<strong>${searchInput}</strong>" aramasına uygun döküman bulunamadı.</p>
      </div>
    `;
    return;
  }

  list.innerHTML = docs.map(doc => {
    const dateStr = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString('tr-TR') : 'Yeni';
    const sizeStr = formatBytes(doc.fileSize || 0);
    const uploadedByStr = doc.uploadedBy ? `<span><i class="fa-regular fa-user" style="margin-right: 4px;"></i>${doc.uploadedBy}</span>` : '';
    
    return `
      <div class="tsi-doc-row" ${isAdmin ? `draggable="true" ondragstart="window.handleDocDragStart(event)" ondragover="window.handleDocDragOver(event)" ondragleave="window.handleDocDragLeave(event)" ondrop="window.handleDocDrop(event)" ondragend="window.handleDocDragEnd(event)" data-id="${doc.id}" style="cursor: grab;"` : ''}>
        <div style="display: flex; gap: 1rem; align-items: center; flex: 1; min-width: 0;">
          ${isAdmin ? `
            <div class="drag-handle" style="color: var(--text-dim); cursor: grab; padding-right: 4px; font-size: 0.95rem; display: flex; align-items: center;" title="Sürükle ve Sırala">
              <i class="fa-solid fa-grip-vertical"></i>
            </div>
          ` : ''}
          <div class="doc-icon-container">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0 0 4px 0; color: white; font-size: 0.95rem; font-weight: 600; line-height: 1.4; word-break: break-word; overflow-wrap: anywhere;">
              ${doc.title}
            </h4>
            <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 12px; flex-wrap: wrap;">
              <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>${dateStr}</span>
              <span><i class="fa-solid fa-weight-hanging" style="margin-right: 4px;"></i>${sizeStr}</span>
              ${uploadedByStr}
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; align-items: center; flex-shrink: 0;">
          <button class="btn-cyber" style="padding: 6px 12px; font-size: 0.75rem; display: flex; align-items: center; gap: 6px;" onclick="window.openTsiDoc('${doc.id}')">
            <i class="fa-solid fa-eye"></i> GÖSTER
          </button>
          ${hasAiPermission ? `
            <button class="btn-cyber-outline" style="padding: 6px 12px; font-size: 0.75rem; display: flex; align-items: center; gap: 6px; background: rgba(0, 243, 255, 0.03); border-color: rgba(0, 243, 255, 0.2); color: var(--accent-cyan);" onclick="window.openTsiAiAgent('${doc.id}')">
              <i class="fa-solid fa-robot"></i> AJAN'A SOR
            </button>
          ` : ''}
          <button class="btn-cyber-outline" style="padding: 6px 10px;" onclick="window.downloadTsiDoc('${doc.id}')" title="İndir">
            <i class="fa-solid fa-download"></i>
          </button>
          ${isAdmin ? `
            <button class="action-icon-btn red" style="padding: 6px 10px;" onclick="window.deleteTsiDocument('${doc.id}')" title="Sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

(window as any).openTsiDoc = async (docId: string) => {
  const doc = allTsiDocuments.find(d => d.id === docId);
  if (!doc) return;
  
  if (!doc.isChunked) {
    window.open(doc.fileUrl, '_blank');
    return;
  }

  // Senkron olarak yeni sekme aç (Popup Engelleyiciyi aşmak için)
  const newTab = window.open('', '_blank');
  if (newTab) {
    newTab.document.write('<html><body style="background:#111; color:white; display:flex; justify-content:center; align-items:center; height:100vh; font-family:sans-serif;"><h3>Dosya hazırlanıyor, lütfen bekleyin...</h3></body></html>');
  }

  (window as any).showToast('Bilgi', 'Büyük dosya hazırlanıyor, lütfen bekleyin...', 'info');
  try {
    const url = await tsiService.getChunkedFileUrl(doc);
    if (newTab) {
      newTab.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  } catch (err) {
    console.error(err);
    if (newTab) newTab.close();
    (window as any).showToast('Hata', 'Dosya hazırlanırken bir hata oluştu.', 'error');
  }
};

(window as any).downloadTsiDoc = async (docId: string) => {
  const doc = allTsiDocuments.find(d => d.id === docId);
  if (!doc) return;
  
  if (!doc.isChunked) {
    const a = document.createElement('a');
    a.href = doc.fileUrl;
    a.download = doc.fileName;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return;
  }

  (window as any).showToast('Bilgi', 'İndirme hazırlanıyor, bu işlem dosya boyutuna göre 5-10 saniye sürebilir...', 'info');
  try {
    const url = await tsiService.getChunkedFileUrl(doc);
    const a = document.createElement('a');
    a.href = url;
    a.download = doc.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    (window as any).showToast('Başarılı', 'İndirme başladı!', 'success');
  } catch (err) {
    console.error(err);
    (window as any).showToast('Hata', 'İndirme başarısız oldu.', 'error');
  }
};

// --- ADMIN MODALS LOGIC ---
(window as any).openTsiCategoryModal = () => {
  document.getElementById('tsi-category-modal')?.classList.remove('hidden');
};

(window as any).closeTsiCategoryModal = () => {
  document.getElementById('tsi-category-modal')?.classList.add('hidden');
};

const renderCategoryManageList = () => {
  const container = document.getElementById('tsi-category-manage-list');
  if (!container) return;
  
  container.innerHTML = allTsiCategories.map(cat => `
    <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
      <span style="color: white; font-size: 0.9rem;">${cat.name}</span>
      <button class="action-icon-btn red" style="padding: 4px;" onclick="window.deleteTsiCategory('${cat.id}')">
        <i class="fa-solid fa-trash-can"></i>
      </button>
    </div>
  `).join('');
};

(window as any).addTsiCategory = async () => {
  const input = document.getElementById('tsi-new-category-name') as HTMLInputElement;
  const name = input.value.trim();
  if (!name) return;
  
  try {
    await tsiService.addCategory(name);
    input.value = '';
    (window as any).showToast('Başarılı', 'Kategori eklendi.', 'success');
  } catch (err) {
    (window as any).showToast('Hata', 'Kategori eklenemedi.', 'error');
  }
};

(window as any).deleteTsiCategory = async (id: string) => {
  if (confirm("Bu kategoriyi silmek istediğinize emin misiniz? (İçindeki dokümanlar manuel silinmelidir)")) {
    try {
      await tsiService.deleteCategory(id);
      if (activeCategoryId === id) activeCategoryId = null;
    } catch (err) {
      (window as any).showToast('Hata', 'Kategori silinemedi.', 'error');
    }
  }
};

(window as any).seedDefaultTsiCategories = async () => {
  const defaults = [
    "TSI -01 Teknik Talimatnameler",
    "TSI -02 Teknik Bildiriler",
    "TSI -03 Raporlar",
    "TSI -04 Devre Kartları Listesi",
    "TSI -05 Program Listesi",
    "TSI -06 Yazılım Tarifnameleri",
    "TSI -07 Onarım Talimatnameleri",
    "TSI -08 Bakım, Şebeke Bağlantısı ve Kurulum",
    "TSI -09 SQA Haber Bültenleri",
    "TSI -10 Servis data sheet",
    "TSI -12 Devre Şemaları",
    "TSI -20 Operating manual"
  ];

  (window as any).showToast('İşlem', 'Kategoriler oluşturuluyor, lütfen bekleyin...', 'info');
  const btn = document.querySelector('button[onclick="window.seedDefaultTsiCategories()"]') as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    for (const catName of defaults) {
      await tsiService.addCategory(catName);
    }
    (window as any).showToast('Başarılı', 'Tüm kategoriler başarıyla oluşturuldu!', 'success');
  } catch (err) {
    console.error(err);
    (window as any).showToast('Hata', 'Kategoriler oluşturulurken bir hata oluştu.', 'error');
  }
};

(window as any).openTsiUploadModal = () => {
  document.getElementById('tsi-upload-modal')?.classList.remove('hidden');
};

(window as any).closeTsiUploadModal = () => {
  document.getElementById('tsi-upload-modal')?.classList.add('hidden');
};

const updateUploadCategorySelect = () => {
  const select = document.getElementById('tsi-upload-category') as HTMLSelectElement;
  if (!select) return;
  select.innerHTML = '<option value="">Kategori Seçin...</option>' + 
    allTsiCategories.map(c => `<option value="${c.id}">${c.name}</option>`).join('');
};

(window as any).submitTsiUpload = async () => {
  const titleInput = document.getElementById('tsi-upload-title') as HTMLInputElement;
  const catInput = document.getElementById('tsi-upload-category') as HTMLSelectElement;
  const fileInput = document.getElementById('tsi-upload-file') as HTMLInputElement;
  const btn = document.getElementById('tsi-upload-btn') as HTMLButtonElement;
  const cancelBtn = document.getElementById('tsi-upload-cancel-btn') as HTMLButtonElement;
  const progressContainer = document.getElementById('tsi-upload-progress');
  const progressBar = document.getElementById('tsi-progress-bar');
  const progressText = document.getElementById('tsi-progress-text');

  const manualTitle = titleInput.value.trim();
  const categoryId = catInput.value;
  const files = fileInput.files;

  if (!categoryId || !files || files.length === 0) {
    alert("Lütfen bir kategori ve en az bir PDF dosyası seçin.");
    return;
  }

  const currentUser = (window as any).currentUser;
  const uploadedBy = currentUser?.displayName || currentUser?.email || 'Admin';

  btn.disabled = true;
  cancelBtn.disabled = true;
  if (progressContainer) progressContainer.classList.remove('hidden');

  let successCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    
    let docTitle = manualTitle;
    if (!docTitle) {
      docTitle = file.name.replace('.pdf', '');
    } else if (files.length > 1) {
      docTitle = `${manualTitle} - ${i + 1}`;
    }

    if (progressText) progressText.innerText = `Dosya ${i + 1}/${files.length} yükleniyor... %0`;
    if (progressBar) progressBar.style.width = '0%';

    try {
      await tsiService.uploadDocument(file, docTitle, categoryId, uploadedBy, (progress) => {
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.innerText = `Dosya ${i + 1}/${files.length} yükleniyor... %${Math.round(progress)}`;
      });
      successCount++;
    } catch (err) {
      console.error(`Upload error for ${file.name}:`, err);
      (window as any).showToast('Hata', `${file.name} yüklenemedi.`, 'error');
    }
  }

  btn.disabled = false;
  cancelBtn.disabled = false;
  if (progressContainer) progressContainer.classList.add('hidden');
  if (progressBar) progressBar.style.width = '0%';

  if (successCount > 0) {
    (window as any).showToast('Başarılı', `${successCount} doküman başarıyla yüklendi.`, 'success');
    (window as any).closeTsiUploadModal();
    titleInput.value = '';
    fileInput.value = '';
    catInput.value = '';
  }
};

(window as any).deleteTsiDocument = async (docId: string) => {
  const doc = allTsiDocuments.find(d => d.id === docId);
  if (!doc) return;

  if (confirm("Bu dokümanı silmek istediğinize emin misiniz?")) {
    try {
      await tsiService.deleteDocument(doc.id, doc);
      (window as any).showToast('Başarılı', 'Doküman silindi.', 'info');
    } catch (err) {
      (window as any).showToast('Hata', 'Silme işlemi başarısız.', 'error');
    }
  }
};

let dragSrcEl: HTMLElement | null = null;

(window as any).handleDocDragStart = (e: DragEvent) => {
  const row = (e.target as HTMLElement).closest('.tsi-doc-row') as HTMLElement;
  if (!row) return;
  dragSrcEl = row;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', row.getAttribute('data-id') || '');
  row.classList.add('dragging');
};

(window as any).handleDocDragOver = (e: DragEvent) => {
  e.preventDefault();
  const row = (e.target as HTMLElement).closest('.tsi-doc-row') as HTMLElement;
  if (!row || row === dragSrcEl) return;
  row.classList.add('drag-over');
};

(window as any).handleDocDragLeave = (e: DragEvent) => {
  const row = (e.target as HTMLElement).closest('.tsi-doc-row') as HTMLElement;
  if (row) row.classList.remove('drag-over');
};

(window as any).handleDocDragEnd = (e: DragEvent) => {
  if (dragSrcEl) {
    dragSrcEl.classList.remove('dragging');
  }
  document.querySelectorAll('.tsi-doc-row').forEach(row => {
    row.classList.remove('drag-over');
    row.classList.remove('dragging');
  });
};

(window as any).handleDocDrop = async (e: DragEvent) => {
  e.preventDefault();
  const targetRow = (e.target as HTMLElement).closest('.tsi-doc-row') as HTMLElement;
  if (!targetRow) return;
  
  targetRow.classList.remove('drag-over');
  if (dragSrcEl) dragSrcEl.classList.remove('dragging');

  const draggedId = e.dataTransfer!.getData('text/plain');
  const targetId = targetRow.getAttribute('data-id');
  if (!draggedId || !targetId || draggedId === targetId) return;

  // Filter documents in active category
  const categoryDocs = allTsiDocuments.filter(d => d.categoryId === activeCategoryId);
  // Sort them as they are currently displayed
  categoryDocs.sort((a, b) => {
    const orderA = a.order !== undefined ? a.order : Number.MAX_SAFE_INTEGER;
    const orderB = b.order !== undefined ? b.order : Number.MAX_SAFE_INTEGER;
    if (orderA !== orderB) return orderA - orderB;
    const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
    const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
    return timeB - timeA;
  });

  const activeDraggedIdx = categoryDocs.findIndex(d => d.id === draggedId);
  const activeTargetIdx = categoryDocs.findIndex(d => d.id === targetId);
  if (activeDraggedIdx === -1 || activeTargetIdx === -1) return;

  // Move dragged item in active list
  const [removed] = categoryDocs.splice(activeDraggedIdx, 1);
  categoryDocs.splice(activeTargetIdx, 0, removed);

  // Assign new order values (0, 1, 2, ...) to all items in category
  const batchUpdates: Promise<void>[] = [];
  categoryDocs.forEach((docItem, index) => {
    docItem.order = index; // Update local state immediately
    batchUpdates.push(tsiService.updateDocumentOrder(docItem.id, index));
  });

  try {
    (window as any).showToast('Bilgi', 'Sıralama güncelleniyor...', 'info');
    await Promise.all(batchUpdates);
    (window as any).showToast('Başarılı', 'Sıralama kaydedildi.', 'success');
  } catch (err) {
    console.error("Sorting save error:", err);
    (window as any).showToast('Hata', 'Sıralama kaydedilemedi.', 'error');
  }
};

// --- YAPAY ZEKA DANIŞMANI LOGIC ---
let selectedTsiAiDoc: any = null;

(window as any).openTsiAiAgent = (docId?: string) => {
  const panel = document.getElementById('tsi-ai-panel');
  if (!panel) return;

  panel.classList.remove('hidden');

  const messagesContainer = document.getElementById('tsi-chat-messages');

  if (docId) {
    const doc = allTsiDocuments.find(d => d.id === docId);
    if (!doc) return;

    selectedTsiAiDoc = doc;
    const docTitleEl = document.getElementById('tsi-ai-active-doc');
    if (docTitleEl) {
      docTitleEl.innerText = doc.title;
    }
    
    // Clear chat and add welcoming message for this document
    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div style="background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; line-height: 1.4;">
          <strong>Danışman:</strong> <strong>"${doc.title}"</strong> isimli dokümanı okumak üzere hazırladım. 
          <br><br>
          Bu teknik dokümanın içeriğine dair istediğiniz tüm soruları bana sorabilirsiniz.
        </div>
      `;
    }
  } else {
    // General Chat Mode
    selectedTsiAiDoc = null;
    const docTitleEl = document.getElementById('tsi-ai-active-doc');
    if (docTitleEl) {
      docTitleEl.innerText = "Genel Kütüphane Danışmanlığı";
    }

    if (messagesContainer) {
      messagesContainer.innerHTML = `
        <div style="background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); font-size: 0.8rem; line-height: 1.4;">
          <strong>Danışman:</strong> Merhaba! Ben Servis Kütüphanesi Yapay Zeka Danışmanınız. 
          <br><br>
          Herhangi bir PDF dokümanının altındaki <strong>"Ajan'a Sor"</strong> butonuna basarak doküman bazlı soru sorabilir veya buraya doğrudan genel türbin arızası/mühendislik sorularınızı yazabilirsiniz.
        </div>
      `;
    }
  }
};

(window as any).closeTsiAiAgent = () => {
  const panel = document.getElementById('tsi-ai-panel');
  if (panel) panel.classList.add('hidden');
};

(window as any).sendTsiAiMessage = async () => {
  const inputEl = document.getElementById('tsi-chat-input') as HTMLInputElement;
  const sendBtn = document.getElementById('tsi-chat-send-btn') as HTMLButtonElement;
  const messagesContainer = document.getElementById('tsi-chat-messages');
  
  if (!inputEl || !messagesContainer) return;
  const question = inputEl.value.trim();
  if (!question) return;

  // 1. Append user message to chat UI
  appendTsiChatMessage("Siz", question);
  inputEl.value = '';

  // 2. Append thinking/loading message from AI
  const thinkingId = 'ai-thinking-' + Date.now();
  const loadingText = selectedTsiAiDoc 
    ? "Yapay zeka dokümanı okuyor ve yanıtı hazırlıyor, lütfen bekleyin..."
    : "Yapay zeka sorunuzu analiz ediyor ve yanıtı hazırlıyor, lütfen bekleyin...";

  const thinkingHtml = `
    <div id="${thinkingId}" style="background: rgba(0, 243, 255, 0.02); border: 1px solid rgba(0, 243, 255, 0.1); padding: 0.8rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.4; color: var(--accent-cyan);">
      <i class="fa-solid fa-robot fa-spin" style="margin-right: 6px;"></i> ${loadingText}
    </div>
  `;
  messagesContainer.insertAdjacentHTML('beforeend', thinkingHtml);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Disable input & button while processing
  inputEl.disabled = true;
  if (sendBtn) sendBtn.disabled = true;

  try {
    const { aiService } = await import('../services/AiService');
    const answer = await aiService.askLibraryAgent(selectedTsiAiDoc, question);

    // 3. Remove thinking message
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();

    // 4. Append AI response to chat UI
    appendTsiChatMessage("Danışman", answer);

  } catch (err: any) {
    console.error(err);
    const thinkingEl = document.getElementById(thinkingId);
    if (thinkingEl) thinkingEl.remove();
    appendTsiChatMessage("Sistem", "Hata: " + (err.message || "Yapay zekadan yanıt alınamadı."));
  } finally {
    inputEl.disabled = false;
    if (sendBtn) sendBtn.disabled = false;
    inputEl.focus();
  }
};

const appendTsiChatMessage = (sender: string, text: string) => {
  const messagesContainer = document.getElementById('tsi-chat-messages');
  if (!messagesContainer) return;

  const isUser = sender === "Siz";
  const isSystem = sender === "Sistem";
  
  let bg = "rgba(255,255,255,0.015)";
  let border = "rgba(255,255,255,0.04)";
  let color = "#fff";
  
  if (isUser) {
    bg = "rgba(0, 243, 255, 0.04)";
    border = "rgba(0, 243, 255, 0.18)";
  } else if (isSystem) {
    bg = "rgba(255, 77, 77, 0.05)";
    border = "rgba(255, 77, 77, 0.15)";
    color = "#ff4d4d";
  } else {
    // AI message bubble with violet/blue glassmorphism
    bg = "rgba(139, 92, 246, 0.03)";
    border = "rgba(139, 92, 246, 0.18)";
  }

  // Simple markdown-to-html conversion for newlines and bold texts
  let formattedText = text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>');

  const msgHtml = `
    <div style="background: ${bg}; border: 1px solid ${border}; padding: 0.8rem; border-radius: 8px; font-size: 0.8rem; line-height: 1.4; color: ${color}; backdrop-filter: blur(4px);">
      <strong style="color: ${isUser ? 'var(--accent-cyan)' : (isSystem ? '#ff4d4d' : '#a78bfa')}">${sender}:</strong><br>
      <div style="margin-top: 4px;">${formattedText}</div>
    </div>
  `;
  
  messagesContainer.insertAdjacentHTML('beforeend', msgHtml);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
};
