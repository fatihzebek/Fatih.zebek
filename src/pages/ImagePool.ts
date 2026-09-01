import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { inventoryService } from '../services/InventoryService';
import { db } from '../firebase';
import { collection, query, limit, getDocs, startAfter, getCountFromServer, getDoc, doc } from 'firebase/firestore';

export const ImagePoolPage = async () => {
  let currentPoolPage = 1;
  const itemsPerPage = 15;
  let pageSnapshots: any[] = [];
  let totalPoolCount = 0;

  // Zoom carousel state
  let currentZoomImages: string[] = [];
  let currentZoomIndex = 0;
  let currentZoomTitle = '';

  const ensureBodyModal = (id: string) => {
    const modal = document.getElementById(id);
    if (modal && modal.parentElement !== document.body) {
      document.body.appendChild(modal);
    }
    return modal;
  };

  (window as any).initImagePool = async () => {
    const statsContainer = document.getElementById('pool-stats');
    const gridContainer = document.getElementById('pool-grid');
    const migrationBtn = document.getElementById('migration-btn');
    if (!statsContainer || !gridContainer) return;

    ensureBodyModal('pool-image-modal');
    ensureBodyModal('add-pool-image-modal');
    ensureBodyModal('edit-pool-image-modal');

    try {
      statsContainer.innerHTML = '<div style="color: #64ffda;"><i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...</div>';
      gridContainer.innerHTML = '<div style="color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Havuzdaki resimler yükleniyor...</div>';

      try {
        const countSnap = await getCountFromServer(collection(db, 'GlobalMaterialImages'));
        totalPoolCount = countSnap.data().count;
      } catch (err) {
        totalPoolCount = 0;
      }

      warehouseService.getGlobalImagePool().then(pool => {
        const globalKeys = new Set<string>();
        pool.forEach((_, key) => globalKeys.add(String(key).trim()));
        (window as any)._globalPoolKeys = globalKeys;
      }).catch(console.error);

      statsContainer.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(100,255,218,0.2); border-radius: 12px; padding: 1rem 1.25rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(100, 255, 218, 0.1); border: 1px solid rgba(100, 255, 218, 0.3); display: flex; align-items: center; justify-content: center; color: #64ffda; font-size: 1.2rem;">
                    <i class="fa-solid fa-images"></i>
                </div>
                <div>
                    <h3 style="margin: 0; color: #e2e8f0; font-size: 1.05rem; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">HAVUZDAKİ TOPLAM RESİM SAYISI</h3>
                    <div style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.1rem;">Sistemdeki ortak resim kütüphanesinde tanımlı aktif malzeme görselleri</div>
                </div>
            </div>
            <div style="font-size: 2rem; font-weight: bold; color: #64ffda; font-family: 'Rajdhani', sans-serif;">
                ${totalPoolCount} <span style="font-size: 0.9rem; color: #94a3b8; font-weight: normal;">Adet Görsel</span>
            </div>
        </div>
      `;

      if (migrationBtn) {
          migrationBtn.style.display = 'none';
      }

      currentPoolPage = 1;
      pageSnapshots = [];
      await (window as any).renderImagePoolGrid();

    } catch(e) {
      console.error(e);
      statsContainer.innerHTML = '<div style="color: #ef4444;">Veriler yüklenirken hata oluştu.</div>';
    }
  };

  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  (window as any).deletePoolImage = async (sapNo: string) => {
      if (!confirm(`Bu görseli hem havuzdan hem de bu SAP numarasına (${sapNo}) sahip tüm depolardaki malzemelerden tamamen silmek istediğinize emin misiniz?`)) {
          return;
      }

      if ((window as any).showToast) {
          (window as any).showToast('Siliniyor...', 'Görsel tüm depolardan kaldırılıyor...', 'info');
      }

      try {
          await warehouseService.deleteGlobalMaterialImage(sapNo);
          if ((window as any).showToast) {
              (window as any).showToast('Silindi', 'Görsel başarıyla kaldırıldı!', 'success');
          }
          (window as any).initImagePool();
      } catch (err: any) {
          console.error(err);
          alert('Silme hatası: ' + err.message);
      }
  };

  (window as any).changePoolPage = async (newPage: number) => {
      currentPoolPage = newPage;
      const searchInput = document.getElementById('pool-search-input') as HTMLInputElement;
      const queryStr = searchInput ? searchInput.value : '';
      await (window as any).renderImagePoolGrid(queryStr);
  };

  (window as any).renderImagePoolGrid = async (searchQuery: string = '') => {
      const gridContainer = document.getElementById('pool-grid');
      if (!gridContainer) return;

      const lowerQuery = searchQuery.toLowerCase().trim();
      let poolItems: { sapNo: string; imageUrl: string; imageUrls?: string[]; name: string; note?: string }[] = [];
      let totalPages = 1;

      if (lowerQuery) {
          const poolDetails = await warehouseService.getGlobalImagePoolDetails();
          const visited = new Set<string>();

          poolDetails.forEach((detail, sapNo) => {
              const cleanSap = String(sapNo).trim();
              const stripped = cleanSap.replace(/^0+/, '');
              if (!visited.has(cleanSap) && !visited.has(stripped)) {
                  visited.add(cleanSap);
                  if (stripped) visited.add(stripped);
                  
                  const dictMat = inventoryService.getMaterialBySap(cleanSap);
                  const name = dictMat?.d || detail.description || 'Malzeme Açıklaması Yok';
                  const note = detail.note || '';
                  if (cleanSap.toLowerCase().includes(lowerQuery) || name.toLowerCase().includes(lowerQuery) || note.toLowerCase().includes(lowerQuery)) {
                      poolItems.push({
                          sapNo: cleanSap,
                          imageUrl: detail.imageUrl,
                          imageUrls: detail.imageUrls || [detail.imageUrl],
                          name,
                          note
                      });
                  }
              }
          });

          totalPages = Math.ceil(poolItems.length / itemsPerPage) || 1;
          if (currentPoolPage > totalPages) currentPoolPage = totalPages;
          if (currentPoolPage < 1) currentPoolPage = 1;
          const startIndex = (currentPoolPage - 1) * itemsPerPage;
          poolItems = poolItems.slice(startIndex, startIndex + itemsPerPage);
      } else {
          try {
              let q;
              const colRef = collection(db, 'GlobalMaterialImages');
              if (currentPoolPage === 1 || !pageSnapshots[currentPoolPage - 2]) {
                  q = query(colRef, limit(itemsPerPage));
              } else {
                  const lastDoc = pageSnapshots[currentPoolPage - 2];
                  q = query(colRef, startAfter(lastDoc), limit(itemsPerPage));
              }

              const snap = await getDocs(q);
              if (snap.docs.length > 0) {
                  pageSnapshots[currentPoolPage - 1] = snap.docs[snap.docs.length - 1];
              }

              snap.docs.forEach(docSnap => {
                  const data = docSnap.data();
                  const rawSap = docSnap.id;
                  const dictMat = inventoryService.getMaterialBySap(rawSap);
                  const imgs: string[] = Array.isArray(data.imageUrls) && data.imageUrls.length > 0 
                      ? data.imageUrls 
                      : (data.imageUrl ? [data.imageUrl] : []);
                  
                  poolItems.push({
                      sapNo: rawSap,
                      imageUrl: data.imageUrl || imgs[0] || '',
                      imageUrls: imgs,
                      name: data.description || dictMat?.d || 'Malzeme Açıklaması Yok',
                      note: data.note || ''
                  });
              });

              totalPages = Math.ceil(totalPoolCount / itemsPerPage) || 1;
          } catch(err) {
              console.error("Paginated fetch error:", err);
          }
      }

      if (poolItems.length === 0) {
          gridContainer.style.display = 'block';
          gridContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 2rem;">Aramanıza uygun resimli malzeme bulunamadı.</div>';
          return;
      }

      const matchCount = lowerQuery ? poolItems.length : totalPoolCount;
      totalPages = Math.ceil(matchCount / itemsPerPage) || 1;
      if (currentPoolPage > totalPages) currentPoolPage = totalPages;
      if (currentPoolPage < 1) currentPoolPage = 1;

      let tableHtml = `
        <div class="glass-panel" style="width: 100%; overflow-x: auto; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 0.5rem;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.8rem; line-height: 1.15;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 0.88rem;">
                <th style="padding: 0.25rem 0.5rem; font-weight: bold; text-align: center; width: 65px;">GÖRSEL</th>
                <th style="padding: 0.25rem 0.5rem; font-weight: bold; width: 130px;">SAP / ÜRÜN KODU</th>
                <th style="padding: 0.25rem 0.5rem; font-weight: bold;">MALZEME AÇIKLAMASI & NOT</th>
                <th style="padding: 0.25rem 0.5rem; font-weight: bold; text-align: right; width: 140px;">İŞLEMLER</th>
              </tr>
            </thead>
            <tbody>
      `;

      poolItems.forEach(item => {
          let displaySap = item.sapNo;
          let displayName = item.name;

          if (item.sapNo.includes(' - ')) {
              const parts = item.sapNo.split(' - ');
              displaySap = parts[0].trim();
              const extractedDesc = parts.slice(1).join(' - ').trim();
              if (extractedDesc && (displayName === 'Malzeme Açıklaması Yok' || !displayName)) {
                  displayName = extractedDesc;
              }
          }

          const imgArrJson = JSON.stringify(item.imageUrls || [item.imageUrl]).replace(/"/g, '&quot;');
          const noteAttr = (item.note || '').replace(/"/g, '&quot;');
          const countBadge = item.imageUrls && item.imageUrls.length > 1 
              ? `<span style="font-size:0.65rem; background:#3B82F6; color:#fff; border-radius:10px; padding:0px 4px; margin-left:2px; font-weight:bold;">${item.imageUrls.length}</span>` 
              : '';

          tableHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); color: #e2e8f0; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
              <td style="padding: 0.25rem 0.5rem; text-align: center; vertical-align: middle;">
                <div onclick="window.showPoolImage('${item.imageUrl}', '${item.sapNo}', '${imgArrJson}', '${noteAttr}')" 
                     style="width:28px; height:24px; border-radius:4px; background: rgba(59, 130, 246, 0.12); border: 1px solid #3B82F6; display:inline-flex; align-items:center; justify-content:center; color:#3B82F6; cursor: pointer; transition: all 0.2s; font-size: 0.75rem;" 
                     title="Görseli Büyüt (Tıkla)"
                     onmouseover="this.style.backgroundColor='#3B82F6'; this.style.color='#FFF';" 
                     onmouseout="this.style.backgroundColor='rgba(59, 130, 246, 0.12)'; this.style.color='#3B82F6';">
                  <i class="fa-solid fa-image"></i>${countBadge}
                </div>
              </td>
              <td style="padding: 0.25rem 0.5rem; font-weight: bold; font-family: monospace; color: #00f3ff; vertical-align: middle;">${displaySap}</td>
              <td style="padding: 0.25rem 0.5rem; max-width: 350px; vertical-align: middle;">
                <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${displayName}">${displayName}</div>
                ${item.note ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px; font-style: italic; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="Not: ${item.note}"><i class="fa-solid fa-note-sticky" style="color: #64ffda; margin-right: 4px;"></i>${item.note}</div>` : ''}
              </td>
              <td style="padding: 0.25rem 0.5rem; text-align: right; white-space: nowrap; vertical-align: middle;">
                <button onclick="window.openEditPoolImageModal('${item.sapNo}')" style="padding: 1px 6px; height: 22px; line-height: 1; font-size: 0.68rem; background: rgba(100,255,218,0.1); border: 1px solid #64ffda; color: #64ffda; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 3px; margin-right: 0.35rem;" title="Görselleri Düzenle / Değiştir / Not Ekle">
                  <i class="fa-solid fa-pen-to-square"></i> Düzenle
                </button>
                ${isAdmin ? `
                  <i onclick="window.deletePoolImage('${item.sapNo}')" class="fa-solid fa-trash" style="color: #ef4444; cursor: pointer; opacity: 0.85; font-size: 0.75rem; transition: all 0.2s;" onmouseover="this.style.opacity='1'; this.style.transform='scale(1.1)';" onmouseout="this.style.opacity='0.85'; this.style.transform='none';" title="Görseli Sil"></i>
                ` : ''}
              </td>
            </tr>
          `;
      });

      tableHtml += `
            </tbody>
          </table>

          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.05); color: #94A3B8; font-size: 0.78rem;">
            <div>Toplam <strong>${matchCount}</strong> görsel (Sayfa ${currentPoolPage} / ${totalPages})</div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button onclick="window.changePoolPage(1)" ${currentPoolPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 26px; height: 26px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">
                <i class="fa-solid fa-angles-left"></i>
              </button>
              <button onclick="window.changePoolPage(${currentPoolPage - 1})" ${currentPoolPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 26px; height: 26px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">
                <i class="fa-solid fa-angle-left"></i>
              </button>
              <span style="color: #E2E8F0; font-size: 0.78rem; padding: 0 0.4rem; font-weight: 600;">Sayfa ${currentPoolPage} / ${totalPages}</span>
              <button onclick="window.changePoolPage(${currentPoolPage + 1})" ${currentPoolPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 26px; height: 26px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.7rem;">
                <i class="fa-solid fa-angle-right"></i>
              </button>
              <button onclick="window.changePoolPage(${totalPages})" ${currentPoolPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #1E293B; border: 1px solid #334155; color: #E2E8F0; width: 30px; height: 30px; border-radius: 4px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">
                <i class="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
        </div>
      `;

      gridContainer.style.display = 'block';
      gridContainer.innerHTML = tableHtml;
  };

  // Add New Pool Image Modal Functions (3 Slots + Note Input)
  (window as any).openAddNewPoolImageModal = () => {
    const modal = ensureBodyModal('add-pool-image-modal');
    if (modal) {
      modal.style.display = 'flex';
      const sapInput = document.getElementById('add-pool-sap-input') as HTMLInputElement;
      const descInput = document.getElementById('add-pool-desc-input') as HTMLInputElement;
      const noteInput = document.getElementById('add-pool-note-input') as HTMLInputElement;
      const alertBox = document.getElementById('add-pool-duplicate-alert');
      const badgeBox = document.getElementById('add-pool-sap-badge');
      const saveBtn = document.getElementById('add-pool-save-btn') as HTMLButtonElement;

      if (sapInput) sapInput.value = '';
      if (descInput) descInput.value = '';
      if (noteInput) noteInput.value = '';
      if (alertBox) alertBox.style.display = 'none';
      if (badgeBox) badgeBox.innerHTML = '';
      if (saveBtn) saveBtn.disabled = false;

      for (let i = 1; i <= 3; i++) {
        const fileInput = document.getElementById(`add-pool-file-${i}`) as HTMLInputElement;
        const prevImg = document.getElementById(`add-pool-prev-${i}`) as HTMLImageElement;
        const removeBtn = document.getElementById(`add-pool-remove-${i}`);
        if (fileInput) fileInput.value = '';
        if (prevImg) { prevImg.src = ''; prevImg.style.display = 'none'; }
        if (removeBtn) removeBtn.style.display = 'none';
      }
    }
  };

  (window as any).closeAddNewPoolImageModal = () => {
    const modal = document.getElementById('add-pool-image-modal');
    if (modal) modal.style.display = 'none';
  };

  (window as any).handlePoolSapInput = async (val: string) => {
    const cleanVal = val.trim();
    const alertBox = document.getElementById('add-pool-duplicate-alert');
    const badgeBox = document.getElementById('add-pool-sap-badge');
    const descInput = document.getElementById('add-pool-desc-input') as HTMLInputElement;
    const saveBtn = document.getElementById('add-pool-save-btn') as HTMLButtonElement;

    if (!cleanVal) {
      if (alertBox) alertBox.style.display = 'none';
      if (badgeBox) badgeBox.innerHTML = '';
      if (saveBtn) saveBtn.disabled = false;
      return;
    }

    const pool = await warehouseService.getGlobalImagePool();
    const stripped = cleanVal.replace(/^0+/, '');
    const cleanCode = cleanVal.split(' - ')[0].trim();
    const strippedCode = cleanCode.replace(/^0+/, '');

    const isDuplicate = pool.has(cleanVal) || pool.has(stripped) || pool.has(cleanCode) || pool.has(strippedCode);

    if (isDuplicate) {
      if (alertBox) {
        alertBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px; font-size: 0.9rem;"></i> <strong>Bu SAP / Ürün kodu (${cleanVal}) Görsel Havuzunda ZATEN MEVCUT! Tekrar eklemek yerine listeden "Düzenle" butonunu kullanabilirsiniz.</strong>`;
        alertBox.style.display = 'block';
      }
      if (saveBtn) saveBtn.disabled = true;
    } else {
      if (alertBox) alertBox.style.display = 'none';
      if (saveBtn) saveBtn.disabled = false;
    }

    const dictMat = inventoryService.getMaterialBySap(cleanVal);
    if (dictMat) {
      if (descInput) descInput.value = dictMat.d || '';
      if (badgeBox) badgeBox.innerHTML = '<span style="color:#10B981; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-check"></i> SAP Listesinde Bulundu (Otomatik Dolduruldu)</span>';
    } else {
      if (badgeBox) badgeBox.innerHTML = '<span style="color:#3B82F6; font-size:0.75rem;"><i class="fa-solid fa-info-circle"></i> Özel Kod / SAP Listesinde Yok (Açıklamayı Giriniz)</span>';
    }
  };

  (window as any).handlePoolSlotChange = (slotIndex: number, e: any) => {
    const file = e.target.files?.[0];
    const prevImg = document.getElementById(`add-pool-prev-${slotIndex}`) as HTMLImageElement;
    const removeBtn = document.getElementById(`add-pool-remove-${slotIndex}`);
    if (file && prevImg) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        prevImg.src = evt.target?.result as string;
        prevImg.style.display = 'block';
        if (removeBtn) removeBtn.style.display = 'inline-flex';
      };
      reader.readAsDataURL(file);
    }
  };

  (window as any).handlePoolSlotDrop = (slotIndex: number, e: DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const fileInput = document.getElementById(`add-pool-file-${slotIndex}`) as HTMLInputElement;
      if (fileInput) {
        try {
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
        } catch(err) {}
        (window as any).handlePoolSlotChange(slotIndex, { target: { files: [file] } });
      }
    }
  };

  (window as any).removePoolSlot = (slotIndex: number) => {
    const fileInput = document.getElementById(`add-pool-file-${slotIndex}`) as HTMLInputElement;
    const prevImg = document.getElementById(`add-pool-prev-${slotIndex}`) as HTMLImageElement;
    const removeBtn = document.getElementById(`add-pool-remove-${slotIndex}`);
    if (fileInput) fileInput.value = '';
    if (prevImg) { prevImg.src = ''; prevImg.style.display = 'none'; }
    if (removeBtn) removeBtn.style.display = 'none';
  };

  (window as any).saveNewPoolImage = async () => {
    const sapInput = document.getElementById('add-pool-sap-input') as HTMLInputElement;
    const descInput = document.getElementById('add-pool-desc-input') as HTMLInputElement;
    const noteInput = document.getElementById('add-pool-note-input') as HTMLInputElement;
    const saveBtn = document.getElementById('add-pool-save-btn') as HTMLButtonElement;

    const rawSap = sapInput ? sapInput.value.trim() : '';
    const desc = descInput ? descInput.value.trim() : '';
    const note = noteInput ? noteInput.value.trim() : '';

    if (!rawSap) {
      alert("Lütfen SAP No veya Ürün Kodu girin!");
      return;
    }

    const { ImageCompressor } = await import('../utils/imageCompressor');
    const { fileService } = await import('../services/FileService');

    const imageUrls: string[] = [];

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
    }

    try {
      for (let i = 1; i <= 3; i++) {
        const fileInput = document.getElementById(`add-pool-file-${i}`) as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          const compressed = await ImageCompressor.compressImage(file, 800, 800, 0.7);
          const url = await fileService.uploadImage(compressed, '');
          if (url) imageUrls.push(url);
        }
      }

      if (imageUrls.length === 0) {
        alert("Lütfen en az 1 adet ana fotoğraf seçin!");
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Görselleri Kaydet';
        }
        return;
      }

      const mainUrl = imageUrls[0];

      await warehouseService.syncMaterialCardGlobally(rawSap, {
        description: desc,
        imageUrl: mainUrl,
        imageUrls,
        note
      });
      await warehouseService.syncMaterialImageGlobally(rawSap, mainUrl, imageUrls, note);

      if ((window as any).showToast) {
        (window as any).showToast('Başarılı', `SAP: ${rawSap} için ${imageUrls.length} adet görsel kaydedildi!`, 'success');
      }

      (window as any).closeAddNewPoolImageModal();
      (window as any).initImagePool();
    } catch (err: any) {
      console.error("Save new pool image error:", err);
      alert('Fotoğraf yüklenirken hata oluştu: ' + (err.message || err));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Görselleri Kaydet';
      }
    }
  };

  // Edit Pool Image Modal (3 Slots + Note Input)
  let editingSapNo = '';
  let editingCurrentImages: string[] = [];

  (window as any).openEditPoolImageModal = async (sapNo: string) => {
    editingSapNo = sapNo;
    editingCurrentImages = [];
    const modal = ensureBodyModal('edit-pool-image-modal');
    const title = document.getElementById('edit-pool-title');
    const slotsContainer = document.getElementById('edit-pool-slots');
    const noteInput = document.getElementById('edit-pool-note-input') as HTMLInputElement;

    if (!modal) return;
    if (title) title.innerText = `SAP / Ürün Kodu: ${sapNo}`;
    if (noteInput) noteInput.value = '';
    if (slotsContainer) slotsContainer.innerHTML = '<div style="color:#64ffda;"><i class="fa-solid fa-spinner fa-spin"></i> Bilgiler yükleniyor...</div>';
    modal.style.display = 'flex';

    try {
      const safeSap = sapNo.trim().replace(/\//g, '_');
      const docSnap = await getDoc(doc(db, 'GlobalMaterialImages', safeSap));
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.imageUrls) && data.imageUrls.length > 0) {
          editingCurrentImages = [...data.imageUrls];
        } else if (data.imageUrl) {
          editingCurrentImages = [data.imageUrl];
        }
        if (noteInput) noteInput.value = data.note || '';
      }

      (window as any).renderEditSlots();
    } catch(err) {
      console.error(err);
      if (slotsContainer) slotsContainer.innerHTML = '<div style="color:#ef4444;">Görseller okunamadı.</div>';
    }
  };

  (window as any).renderEditSlots = () => {
    const slotsContainer = document.getElementById('edit-pool-slots');
    if (!slotsContainer) return;

    let html = '<div style="display: flex; flex-direction: column; gap: 0.85rem;">';
    for (let i = 0; i < 3; i++) {
      const existingUrl = editingCurrentImages[i] || '';
      html += `
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="color: #64ffda; font-size: 0.8rem; font-weight: bold;">
              ${i === 0 ? '1. Ana Görsel' : (i + 1) + '. Görsel (Opsiyonel)'}
            </span>
            ${existingUrl ? `
              <button onclick="window.removeEditSlotImage(${i})" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #EF4444; padding: 2px 8px; border-radius: 4px; font-size: 0.72rem; cursor: pointer;">
                <i class="fa-solid fa-trash"></i> Resmi Sil
              </button>
            ` : ''}
          </div>
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            ${existingUrl ? `
              <img src="${existingUrl}" style="width: 48px; height: 48px; object-fit: contain; border-radius: 6px; border: 1px solid rgba(100,255,218,0.3); background: #000;" />
            ` : `
              <div style="width: 48px; height: 48px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1rem;">
                <i class="fa-solid fa-plus"></i>
              </div>
            `}
            <div style="flex: 1;">
              <input type="file" id="edit-slot-file-${i}" accept="image/*" onchange="window.handleEditSlotFileChange(${i}, event)" style="width: 100%; color: #94A3B8; font-size: 0.8rem;" />
              <img id="edit-slot-prev-${i}" src="" style="display: none; max-height: 50px; margin-top: 4px; border-radius: 4px; border: 1px solid #10B981;" />
            </div>
          </div>
        </div>
      `;
    }
    html += '</div>';
    slotsContainer.innerHTML = html;
  };

  (window as any).removeEditSlotImage = (index: number) => {
    editingCurrentImages[index] = '';
    (window as any).renderEditSlots();
  };

  (window as any).handleEditSlotFileChange = (index: number, e: any) => {
    const file = e.target.files?.[0];
    const prevImg = document.getElementById(`edit-slot-prev-${index}`) as HTMLImageElement;
    if (file && prevImg) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        prevImg.src = evt.target?.result as string;
        prevImg.style.display = 'block';
      };
      reader.readAsDataURL(file);
    }
  };

  (window as any).closeEditPoolImageModal = () => {
    const modal = document.getElementById('edit-pool-image-modal');
    if (modal) modal.style.display = 'none';
  };

  (window as any).saveEditPoolImage = async () => {
    if (!editingSapNo) return;
    const saveBtn = document.getElementById('edit-pool-save-btn') as HTMLButtonElement;
    const noteInput = document.getElementById('edit-pool-note-input') as HTMLInputElement;

    const note = noteInput ? noteInput.value.trim() : '';

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Güncelleniyor...';
    }

    try {
      const { ImageCompressor } = await import('../utils/imageCompressor');
      const { fileService } = await import('../services/FileService');

      const finalUrls: string[] = [];

      for (let i = 0; i < 3; i++) {
        const fileInput = document.getElementById(`edit-slot-file-${i}`) as HTMLInputElement;
        const file = fileInput?.files?.[0];
        if (file) {
          const compressed = await ImageCompressor.compressImage(file, 800, 800, 0.7);
          const newUrl = await fileService.uploadImage(compressed, '');
          if (newUrl) finalUrls.push(newUrl);
        } else if (editingCurrentImages[i]) {
          finalUrls.push(editingCurrentImages[i]);
        }
      }

      const mainUrl = finalUrls[0] || '';

      await warehouseService.syncMaterialImageGlobally(editingSapNo, mainUrl, finalUrls, note);

      if ((window as any).showToast) {
        (window as any).showToast('Başarılı', `${editingSapNo} için görseller ve not güncellendi!`, 'success');
      }

      (window as any).closeEditPoolImageModal();
      (window as any).initImagePool();
    } catch (err: any) {
      console.error("Edit pool image error:", err);
      alert('Fotoğraf güncellenirken hata oluştu: ' + (err.message || err));
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Görselleri Güncelle';
      }
    }
  };

  // Zoom Modal Carousel Functions (< and > Arrows + Note display)
  (window as any).showPoolImage = (url: string, title: string, imageUrlsJson?: string, noteText?: string) => {
      const modal = ensureBodyModal('pool-image-modal');
      const titleEl = document.getElementById('pool-image-title');
      const noteEl = document.getElementById('pool-image-note');

      if (!modal) return;

      currentZoomTitle = title;
      currentZoomIndex = 0;
      currentZoomImages = [];

      if (imageUrlsJson) {
        try {
          const parsed = JSON.parse(imageUrlsJson.replace(/&quot;/g, '"'));
          if (Array.isArray(parsed) && parsed.length > 0) {
            currentZoomImages = parsed.filter(Boolean);
          }
        } catch(e) {}
      }

      if (currentZoomImages.length === 0 && url) {
        currentZoomImages = [url];
      }

      if (titleEl) titleEl.innerText = `SAP No: ${title}`;

      if (noteEl) {
        if (noteText) {
          noteEl.innerHTML = `<i class="fa-solid fa-note-sticky" style="color:#64ffda; margin-right:4px;"></i> ${noteText}`;
          noteEl.style.display = 'block';
        } else {
          noteEl.innerHTML = '';
          noteEl.style.display = 'none';
        }
      }

      (window as any).updateZoomCarouselUI();
      modal.style.display = 'flex';
  };

  (window as any).updateZoomCarouselUI = () => {
      const img = document.getElementById('pool-image-content') as HTMLImageElement;
      const counterEl = document.getElementById('pool-image-counter');
      const prevBtn = document.getElementById('pool-zoom-prev');
      const nextBtn = document.getElementById('pool-zoom-next');
      const dotsContainer = document.getElementById('pool-zoom-dots');

      if (!img) return;

      const total = currentZoomImages.length;
      if (total === 0) return;

      if (currentZoomIndex < 0) currentZoomIndex = 0;
      if (currentZoomIndex >= total) currentZoomIndex = total - 1;

      img.src = currentZoomImages[currentZoomIndex];

      if (counterEl) {
        counterEl.innerText = total > 1 ? `Görsel ${currentZoomIndex + 1} / ${total}` : '';
      }

      if (prevBtn) prevBtn.style.display = total > 1 ? 'flex' : 'none';
      if (nextBtn) nextBtn.style.display = total > 1 ? 'flex' : 'none';

      if (dotsContainer) {
        if (total > 1) {
          let dotsHtml = '';
          for (let i = 0; i < total; i++) {
            const activeStyle = i === currentZoomIndex 
              ? 'background: #64ffda; width: 10px; height: 10px;' 
              : 'background: rgba(255,255,255,0.3); width: 8px; height: 8px;';
            dotsHtml += `<div onclick="window.setZoomIndex(${i})" style="${activeStyle} border-radius: 50%; cursor: pointer; transition: all 0.2s;" title="${i+1}. Görsel"></div>`;
          }
          dotsContainer.innerHTML = dotsHtml;
          dotsContainer.style.display = 'flex';
        } else {
          dotsContainer.style.display = 'none';
        }
      }
  };

  (window as any).prevZoomImage = (e?: any) => {
      if (e) e.stopPropagation();
      if (currentZoomImages.length <= 1) return;
      currentZoomIndex = (currentZoomIndex - 1 + currentZoomImages.length) % currentZoomImages.length;
      (window as any).updateZoomCarouselUI();
  };

  (window as any).nextZoomImage = (e?: any) => {
      if (e) e.stopPropagation();
      if (currentZoomImages.length <= 1) return;
      currentZoomIndex = (currentZoomIndex + 1) % currentZoomImages.length;
      (window as any).updateZoomCarouselUI();
  };

  (window as any).setZoomIndex = (index: number) => {
      currentZoomIndex = index;
      (window as any).updateZoomCarouselUI();
  };

  (window as any).closePoolImage = () => {
      const modal = document.getElementById('pool-image-modal');
      if (modal) modal.style.display = 'none';
  };

  window.addEventListener('keydown', (e) => {
    const modal = document.getElementById('pool-image-modal');
    if (modal && modal.style.display !== 'none') {
      if (e.key === 'ArrowLeft') (window as any).prevZoomImage();
      if (e.key === 'ArrowRight') (window as any).nextZoomImage();
      if (e.key === 'Escape') (window as any).closePoolImage();
    }
  });

  setTimeout(() => {
    if ((window as any).initImagePool) {
        (window as any).initImagePool();
    }
  }, 100);

  return `
    <div class="fade-in-up content-area" style="padding-bottom: 2rem;">
      
      <!-- Image Zoom Modal -->
      <div id="pool-image-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5); z-index: 999999; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;" onclick="window.closePoolImage()">
        <div id="pool-image-card" class="glass-panel" style="position: relative; margin: auto; max-width: 550px; width: 100%; max-height: 82vh; background: #0F172A; border: 1px solid rgba(100, 255, 218, 0.4); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; align-items: center; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.95); overflow: hidden;" onclick="event.stopPropagation()">
          
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.6rem; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.4rem; flex-shrink: 0;">
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 id="pool-image-title" style="color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 1.05rem; letter-spacing: 1px; margin: 0;"></h3>
                <span id="pool-image-counter" style="color: #94A3B8; font-size: 0.78rem; font-weight: 600;"></span>
              </div>
              <div id="pool-image-note" style="display: none; color: #94a3b8; font-size: 0.78rem; font-style: italic; margin-top: 2px;"></div>
            </div>
            <button onclick="window.closePoolImage()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #EF4444; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div style="width: 100%; flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #000; border-radius: 8px; padding: 0.4rem; position: relative;">
            
            <button id="pool-zoom-prev" onclick="window.prevZoomImage(event)" style="display: none; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(100, 255, 218, 0.6); color: #64ffda; font-size: 1.1rem; cursor: pointer; align-items: center; justify-content: center; z-index: 10; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#64ffda'; this.style.color='#0F172A';" onmouseout="this.style.backgroundColor='rgba(15, 23, 42, 0.85)'; this.style.color='#64ffda';">
              <i class="fa-solid fa-chevron-left"></i>
            </button>

            <img id="pool-image-content" src="" style="max-width: 100%; max-height: 52vh; object-fit: contain; border-radius: 6px;" />

            <button id="pool-zoom-next" onclick="window.nextZoomImage(event)" style="display: none; position: absolute; right: 10px; top: 50%; transform: translateY(-50%); width: 36px; height: 36px; border-radius: 50%; background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(100, 255, 218, 0.6); color: #64ffda; font-size: 1.1rem; cursor: pointer; align-items: center; justify-content: center; z-index: 10; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#64ffda'; this.style.color='#0F172A';" onmouseout="this.style.backgroundColor='rgba(15, 23, 42, 0.85)'; this.style.color='#64ffda';">
              <i class="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div id="pool-zoom-dots" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 0.6rem; flex-shrink: 0;"></div>

        </div>
      </div>

      <!-- Add New Pool Image Modal (Compact Action Buttons & Note Field) -->
      <div id="add-pool-image-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5); z-index: 999999; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;" onclick="window.closeAddNewPoolImageModal()">
        <div class="glass-panel" style="position: relative; margin: auto; max-width: 520px; width: 100%; max-height: 85vh; overflow-y: auto; background: #0F172A; border: 1px solid rgba(20, 241, 149, 0.4); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; box-shadow: 0 20px 50px rgba(0,0,0,0.95);" onclick="event.stopPropagation()">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.6rem;">
            <h3 style="color: #14F195; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 700; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-camera"></i> Resim Havuzuna Malzeme Görseli Ekle
            </h3>
            <button onclick="window.closeAddNewPoolImageModal()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #EF4444; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div id="add-pool-duplicate-alert" style="display: none; background: rgba(239, 68, 68, 0.15); border: 1px solid #EF4444; color: #EF4444; padding: 0.6rem; border-radius: 8px; font-size: 0.8rem;">
            <i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px; font-size: 0.9rem;"></i>
            <strong>Bu SAP veya ürün kodu zaten listede var. Kontrol edebilirsiniz.</strong>
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.3rem; text-transform: uppercase;">SAP NO VEYA ÜRÜN KODU</label>
            <input type="text" id="add-pool-sap-input" placeholder="Örn: 1002485 veya UR-998" oninput="window.handlePoolSapInput(this.value)" style="width: 100%; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.55rem 0.75rem; color: #64ffda; font-weight: bold; font-family: monospace; font-size: 0.9rem; outline: none;" />
            <div id="add-pool-sap-badge" style="margin-top: 3px;"></div>
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.3rem; text-transform: uppercase;">MALZEME AÇIKLAMASI</label>
            <input type="text" id="add-pool-desc-input" placeholder="Malzeme tanımı / açıklaması..." style="width: 100%; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.55rem 0.75rem; color: #fff; font-size: 0.88rem; outline: none;" />
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.3rem; text-transform: uppercase;">MALZEME NOTU / EK BİLGİ (OPSİYONEL)</label>
            <input type="text" id="add-pool-note-input" placeholder="Örn: Muadil parça kiti, montaj detayları, özel uyarılar..." style="width: 100%; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.55rem 0.75rem; color: #64ffda; font-size: 0.85rem; outline: none;" />
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.4rem; text-transform: uppercase;">MALZEME FOTOĞRAFLARI (3 ADET SEÇEBİLİRSİNİZ)</label>
            
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="flex: 1;">
                  <span style="display: block; color: #14F195; font-size: 0.73rem; font-weight: bold; margin-bottom: 2px;">1. Ana Görsel (Zorunlu)</span>
                  <input type="file" id="add-pool-file-1" accept="image/*" onchange="window.handlePoolSlotChange(1, event)" style="width: 100%; color: #94A3B8; font-size: 0.78rem;" />
                </div>
                <img id="add-pool-prev-1" src="" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; display: none; border: 1px solid #14F195; background: #000;" />
                <button id="add-pool-remove-1" onclick="window.removePoolSlot(1)" style="display: none; background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #EF4444; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Sil</button>
              </div>

              <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="flex: 1;">
                  <span style="display: block; color: #64ffda; font-size: 0.73rem; font-weight: bold; margin-bottom: 2px;">2. Görsel (Opsiyonel)</span>
                  <input type="file" id="add-pool-file-2" accept="image/*" onchange="window.handlePoolSlotChange(2, event)" style="width: 100%; color: #94A3B8; font-size: 0.78rem;" />
                </div>
                <img id="add-pool-prev-2" src="" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; display: none; border: 1px solid #64ffda; background: #000;" />
                <button id="add-pool-remove-2" onclick="window.removePoolSlot(2)" style="display: none; background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #EF4444; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Sil</button>
              </div>

              <div style="background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.5rem; display: flex; align-items: center; justify-content: space-between; gap: 0.5rem;">
                <div style="flex: 1;">
                  <span style="display: block; color: #64ffda; font-size: 0.73rem; font-weight: bold; margin-bottom: 2px;">3. Görsel (Opsiyonel)</span>
                  <input type="file" id="add-pool-file-3" accept="image/*" onchange="window.handlePoolSlotChange(3, event)" style="width: 100%; color: #94A3B8; font-size: 0.78rem;" />
                </div>
                <img id="add-pool-prev-3" src="" style="width: 36px; height: 36px; object-fit: contain; border-radius: 4px; display: none; border: 1px solid #64ffda; background: #000;" />
                <button id="add-pool-remove-3" onclick="window.removePoolSlot(3)" style="display: none; background: rgba(239, 68, 68, 0.2); border: 1px solid #EF4444; color: #EF4444; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; cursor: pointer;">Sil</button>
              </div>
            </div>
          </div>

          <!-- Compact Action Buttons (Height 32px) -->
          <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.6rem;">
            <button onclick="window.closeAddNewPoolImageModal()" style="padding: 0.35rem 0.85rem; height: 32px; font-size: 0.78rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; cursor: pointer;">İptal</button>
            <button id="add-pool-save-btn" onclick="window.saveNewPoolImage()" style="padding: 0.35rem 1rem; height: 32px; font-size: 0.78rem; border-radius: 6px; background: rgba(20, 241, 149, 0.2); border: 1px solid #14F195; color: #14F195; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-cloud-arrow-up"></i> Görselleri Kaydet
            </button>
          </div>
        </div>
      </div>

      <!-- Edit Pool Image Modal (Compact Action Buttons & Note Field) -->
      <div id="edit-pool-image-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.5); z-index: 999999; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;" onclick="window.closeEditPoolImageModal()">
        <div class="glass-panel" style="position: relative; margin: auto; max-width: 500px; width: 100%; max-height: 85vh; overflow-y: auto; background: #0F172A; border: 1px solid rgba(100, 255, 218, 0.4); border-radius: 14px; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; box-shadow: 0 20px 50px rgba(0,0,0,0.95);" onclick="event.stopPropagation()">
          
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 0.6rem;">
            <h3 id="edit-pool-title" style="color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; font-weight: 700; margin: 0;">Görselleri Düzenle</h3>
            <button onclick="window.closeEditPoolImageModal()" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); color: #EF4444; width: 28px; height: 28px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.9rem;">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div>
            <label style="display: block; color: #94A3B8; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.3rem; text-transform: uppercase;">MALZEME NOTU / EK BİLGİ (OPSİYONEL)</label>
            <input type="text" id="edit-pool-note-input" placeholder="Örn: Muadil parça kiti, montaj detayları, özel uyarılar..." style="width: 100%; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.15); border-radius: 8px; padding: 0.55rem 0.75rem; color: #64ffda; font-size: 0.85rem; outline: none;" />
          </div>

          <div id="edit-pool-slots">
            <!-- Dynamically populated edit slots -->
          </div>

          <!-- Compact Action Buttons (Height 32px) -->
          <div style="display: flex; justify-content: flex-end; gap: 0.6rem; margin-top: 0.4rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.6rem;">
            <button onclick="window.closeEditPoolImageModal()" style="padding: 0.35rem 0.85rem; height: 32px; font-size: 0.78rem; border-radius: 6px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #e2e8f0; cursor: pointer;">İptal</button>
            <button id="edit-pool-save-btn" onclick="window.saveEditPoolImage()" style="padding: 0.35rem 1rem; height: 32px; font-size: 0.78rem; border-radius: 6px; background: rgba(100, 255, 218, 0.2); border: 1px solid #64ffda; color: #64ffda; font-weight: bold; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-floppy-disk"></i> Görselleri Güncelle
            </button>
          </div>
        </div>
      </div>

      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.8rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.3rem;">
            <i class="fa-solid fa-images" style="margin-right: 0.5rem;"></i> Görsel Ürün Tarama
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.85rem;">Sisteme yüklenen tüm malzeme görselleri burada toplanır ve tüm depolar tarafından ortak kullanılır.</p>
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <button onclick="window.openAddNewPoolImageModal()" style="display: inline-flex; align-items: center; gap: 6px; background: rgba(20, 241, 149, 0.15); border: 1px solid #14F195; color: #14F195; padding: 0.4rem 0.85rem; border-radius: 6px; font-weight: 800; font-family: 'Rajdhani', sans-serif; font-size: 0.85rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='rgba(20, 241, 149, 0.25)';" onmouseout="this.style.backgroundColor='rgba(20, 241, 149, 0.15)';">
            <i class="fa-solid fa-plus"></i> YENİ GÖRSEL EKLE
          </button>
          <button id="migration-btn" class="btn-cyber" style="display: none;" onclick="window.runImageMigration()">
            <i class="fa-solid fa-rotate" style="margin-right: 0.5rem;"></i> Eski Resimleri Havuza Aktar
          </button>
        </div>
      </div>

      <div id="pool-stats"></div>

      <input type="file" id="pool-image-update-input" accept="image/*" style="display: none;" />

      <div style="margin-bottom: 1.5rem; position: relative; max-width: 400px;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b;"></i>
        <input type="text" id="pool-search-input" placeholder="SAP / Ürün Kodu veya Not ile ara..." 
               oninput="if(window.renderImagePoolGrid) window.renderImagePoolGrid(this.value)"
               style="width: 100%; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.6rem 1rem 0.6rem 2.5rem; color: #fff; font-size: 0.9rem; outline: none; transition: all 0.2s;"
               onfocus="this.style.borderColor='rgba(100,255,218,0.5)'; this.style.boxShadow='0 0 0 2px rgba(100,255,218,0.1)'"
               onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'" />
      </div>

      <div id="pool-grid">
      </div>
    </div>
  `;
};
