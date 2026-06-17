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
        ${isAdmin ? `
          <div style="display: flex; gap: 1rem;">
            <button class="btn-cyber-outline" onclick="window.openTsiCategoryModal()">
              <i class="fa-solid fa-folder-plus"></i> KATEGORİ YÖNETİMİ
            </button>
            <button class="btn-cyber" onclick="window.openTsiUploadModal()">
              <i class="fa-solid fa-cloud-arrow-up"></i> YENİ DOKÜMAN
            </button>
          </div>
        ` : ''}
      </div>

      <div style="display: flex; gap: 1.5rem; flex: 1; min-height: 500px;">
        <!-- Left Sidebar: Categories -->
        <div class="glass-panel" style="width: 280px; flex-shrink: 0; padding: 1.5rem; display: flex; flex-direction: column; border-right: 1px solid rgba(255,255,255,0.05);">
          <h3 style="font-size: 0.85rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px; margin: 0 0 1rem 0; text-transform: uppercase;">
            KATEGORİLER
          </h3>
          <div id="tsi-categories-container" style="display: flex; flex-direction: column; gap: 0.5rem; overflow-y: auto;">
            <div style="text-align: center; color: var(--accent-cyan); padding: 1rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</div>
          </div>
        </div>

        <!-- Right Content: Documents -->
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

          <div id="tsi-documents-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; overflow-y: auto; align-content: flex-start; padding-bottom: 2rem;">
            <!-- Documents will be rendered here -->
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
      .tsi-doc-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 1.25rem;
        transition: all 0.3s;
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }
      .tsi-doc-card:hover {
        border-color: rgba(0, 243, 255, 0.3);
        transform: translateY(-2px);
        background: rgba(255,255,255,0.04);
      }
      .doc-icon-container {
        width: 40px;
        height: 40px;
        background: rgba(255, 77, 77, 0.1);
        color: #ff4d4d;
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.25rem;
      }
    </style>
  `;
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

  container.innerHTML = allTsiCategories.map(cat => `
    <button class="tsi-cat-btn ${activeCategoryId === cat.id ? 'active' : ''}" onclick="window.selectTsiCategory('${cat.id}')">
      <i class="fa-solid fa-folder${activeCategoryId === cat.id ? '-open' : ''}"></i> 
      <span style="flex: 1; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">${cat.name}</span>
    </button>
  `).join('');

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

const renderDocuments = () => {
  const grid = document.getElementById('tsi-documents-grid');
  if (!grid || !activeCategoryId) return;

  const searchInput = (document.getElementById('tsi-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
  
  const docs = allTsiDocuments.filter(d => 
    d.categoryId === activeCategoryId && 
    (d.title.toLowerCase().includes(searchInput) || d.fileName.toLowerCase().includes(searchInput))
  );

  if (docs.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 4rem; text-align: center; color: var(--text-muted); background: rgba(255,255,255,0.01); border-radius: 16px; border: 1px dashed rgba(255,255,255,0.05);">
        <i class="fa-solid fa-folder-open" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.3;"></i>
        <p>Bu kategoride doküman bulunamadı.</p>
      </div>
    `;
    return;
  }

  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  grid.innerHTML = docs.map(doc => {
    const dateStr = doc.createdAt?.toDate ? doc.createdAt.toDate().toLocaleDateString('tr-TR') : 'Yeni';
    const sizeStr = formatBytes(doc.fileSize || 0);
    const docJson = JSON.stringify(doc).replace(/'/g, "&#39;");
    
    return `
      <div class="tsi-doc-card">
        <div style="display: flex; gap: 1rem; align-items: flex-start;">
          <div class="doc-icon-container">
            <i class="fa-solid fa-file-pdf"></i>
          </div>
          <div style="flex: 1; min-width: 0;">
            <h4 style="margin: 0 0 4px 0; color: white; font-size: 0.95rem; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${doc.title}
            </h4>
            <div style="font-size: 0.7rem; color: var(--text-muted); display: flex; gap: 8px; flex-wrap: wrap;">
              <span><i class="fa-regular fa-calendar" style="margin-right: 4px;"></i>${dateStr}</span>
              <span><i class="fa-solid fa-weight-hanging" style="margin-right: 4px;"></i>${sizeStr}</span>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 8px; margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05);">
          <button class="btn-cyber" style="flex: 1; padding: 6px 12px; font-size: 0.75rem; justify-content: center;" onclick="window.openTsiDoc('${docJson}')">
            <i class="fa-solid fa-eye"></i> GÖSTER
          </button>
          <button class="btn-cyber-outline" style="padding: 6px 12px;" onclick="window.downloadTsiDoc('${docJson}')" title="İndir">
            <i class="fa-solid fa-download"></i>
          </button>
          ${isAdmin ? `
            <button class="action-icon-btn red" style="padding: 6px 12px;" onclick="window.deleteTsiDocument('${docJson}')" title="Sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
};

(window as any).openTsiDoc = async (docStr: string) => {
  const doc = JSON.parse(docStr);
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

(window as any).downloadTsiDoc = async (docStr: string) => {
  const doc = JSON.parse(docStr);
  
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

(window as any).deleteTsiDocument = async (docStr: string) => {
  const doc = JSON.parse(docStr);
  if (confirm("Bu dokümanı silmek istediğinize emin misiniz?")) {
    try {
      await tsiService.deleteDocument(doc.id, doc);
      (window as any).showToast('Başarılı', 'Doküman silindi.', 'info');
    } catch (err) {
      (window as any).showToast('Hata', 'Silme işlemi başarısız.', 'error');
    }
  }
};
