import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';

export const ImagePoolPage = async () => {

  (window as any).initImagePool = async () => {
    const statsContainer = document.getElementById('pool-stats');
    const gridContainer = document.getElementById('pool-grid');
    const migrationBtn = document.getElementById('migration-btn');
    const tabsContainer = document.getElementById('pool-tabs-container');
    if (!statsContainer || !gridContainer) return;

    try {
      statsContainer.innerHTML = '<div style="color: #64ffda;"><i class="fa-solid fa-spinner fa-spin"></i> Veriler hesaplanıyor...</div>';
      gridContainer.innerHTML = '<div style="color: #94a3b8;"><i class="fa-solid fa-spinner fa-spin"></i> Havuzdaki resimler yükleniyor...</div>';

      const pool = await warehouseService.getGlobalImagePool();
      
      const warehouses = dataService.getWarehouses();
      let allInventory: any[] = [];
      
      await Promise.all(warehouses.map(async (w) => {
        try {
          const inv = await warehouseService.getInventory(w.id);
          allInventory = allInventory.concat(inv.map(i => ({ ...i, warehouseId: w.id })));
        } catch (e) {
          console.warn('Error fetching data for warehouse', w.id, e);
        }
      }));

      // Calculate unique materials that have SAP numbers
      const uniqueSaps = new Set<string>();
      const sapNames = new Map<string, string>();
      const sapWarehouses = new Map<string, Map<string, string>>(); // SAP -> (Warehouse ID -> Warehouse Name)
      let localImageCount = 0; // Images found in individual inventory items
      let missingInPoolButHasLocal = 0;

      allInventory.forEach(item => {
        if (item.sapNo) {
            const cleanSap = String(item.sapNo).trim();
            uniqueSaps.add(cleanSap);
            
            const mName = item.description || item.name;
            if (mName && mName !== 'Bilinmeyen Malzeme') {
                sapNames.set(cleanSap, mName);
            } else if (!sapNames.has(cleanSap)) {
                sapNames.set(cleanSap, 'Bilinmeyen Malzeme');
            }
            
            let wMap = sapWarehouses.get(cleanSap);
            if (!wMap) {
                wMap = new Map<string, string>();
                sapWarehouses.set(cleanSap, wMap);
            }
            const wObj = warehouses.find(w => w.id === item.warehouseId);
            if (wObj) {
                wMap.set(wObj.id, wObj.name);
            }
            
            if (item.imageUrl) {
                localImageCount++;
                const stripped = cleanSap.replace(/^0+/, '');
                if (!pool.has(cleanSap) && !pool.has(stripped)) {
                    missingInPoolButHasLocal++;
                }
            }
        }
      });

      // Match unique SAPs with pool to see total coverage
      let coveredSaps = 0;
      const uncoveredSaps: {sapNo: string, name: string, warehouses: {id: string, name: string}[]}[] = [];
      uniqueSaps.forEach(sap => {
          const stripped = sap.replace(/^0+/, '');
          if (pool.has(sap) || pool.has(stripped)) {
              coveredSaps++;
          } else {
              const wMap = sapWarehouses.get(sap);
              const wList: {id: string, name: string}[] = [];
              if (wMap) {
                  wMap.forEach((name, id) => {
                      wList.push({ id, name });
                  });
              }
              uncoveredSaps.push({
                  sapNo: sap,
                  name: sapNames.get(sap) || 'Bilinmeyen Malzeme',
                  warehouses: wList
              });
          }
      });

      const totalUnique = uniqueSaps.size;
      const coveragePercent = totalUnique > 0 ? Math.round((coveredSaps / totalUnique) * 100) : 0;
      
      // Update UI with stats
      statsContainer.innerHTML = `
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(100,255,218,0.2); border-radius: 12px; padding: 1.5rem; margin-bottom: 2rem;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem;">
                <div>
                    <h3 style="margin: 0; color: #e2e8f0; font-size: 1.1rem;">Küresel Resim Kapsaması</h3>
                    <div style="color: #94a3b8; font-size: 0.9rem; margin-top: 0.25rem;">Havuzdaki Resim Sayısı: <span style="color:#64ffda; font-weight:bold;">${pool.size}</span></div>
                    <div style="color: #94a3b8; font-size: 0.9rem;">Eşsiz Malzeme: <span style="color:#fff;">${totalUnique}</span> | Resimli: <span style="color:#64ffda;">${coveredSaps}</span></div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 2.5rem; font-weight: bold; color: #64ffda; font-family: 'Rajdhani', sans-serif;">%${coveragePercent}</div>
                </div>
            </div>
            <!-- Progress Bar -->
            <div style="width: 100%; background: rgba(0,0,0,0.3); height: 12px; border-radius: 6px; overflow: hidden;">
                <div style="width: ${coveragePercent}%; height: 100%; background: linear-gradient(90deg, #0ea5e9, #64ffda); border-radius: 6px; transition: width 1s ease-in-out;"></div>
            </div>
            
            ${missingInPoolButHasLocal > 0 ? `
                <div style="margin-top: 1rem; padding: 0.75rem; background: rgba(234, 179, 8, 0.1); border-left: 4px solid #eab308; border-radius: 4px;">
                    <i class="fa-solid fa-triangle-exclamation" style="color: #eab308; margin-right: 0.5rem;"></i> 
                    <span style="color: #fde047;">Eski sistemde yüklenmiş ama havuza alınmamış <b>${missingInPoolButHasLocal}</b> adet resim tespit edildi!</span>
                </div>
            ` : ''}
        </div>
      `;

      if (missingInPoolButHasLocal > 0 && migrationBtn) {
          migrationBtn.style.display = 'inline-flex';
      } else if (migrationBtn) {
          migrationBtn.style.display = 'none';
      }

      // Render Tabs
      let activeTab = 'has-image';
      let displayLimit = 40;

      if (tabsContainer) {
          tabsContainer.innerHTML = `
            <div style="display: flex; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0.5rem; width: 100%;">
                <button id="btn-tab-has-image" style="background: transparent; border: none; color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: bold; padding: 0.5rem 1.5rem; cursor: pointer; border-bottom: 3px solid #64ffda; transition: all 0.2s;" onclick="window.switchImagePoolTab('has-image')">
                    <i class="fa-solid fa-image" style="margin-right: 0.5rem;"></i>Resimli Olanlar (${pool.size})
                </button>
                <button id="btn-tab-no-image" style="background: transparent; border: none; color: #94a3b8; font-family: 'Rajdhani', sans-serif; font-size: 1.1rem; font-weight: bold; padding: 0.5rem 1.5rem; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s;" onclick="window.switchImagePoolTab('no-image')">
                    <i class="fa-solid fa-image-slash" style="margin-right: 0.5rem;"></i>Resimsiz Olanlar (${uncoveredSaps.length})
                </button>
            </div>
          `;
      }

      (window as any).switchImagePoolTab = (tab: string) => {
          activeTab = tab;
          displayLimit = 40; // Reset limit on tab switch
          const btnHas = document.getElementById('btn-tab-has-image');
          const btnNo = document.getElementById('btn-tab-no-image');
          const searchInput = document.getElementById('pool-search-input') as HTMLInputElement;
          const query = searchInput ? searchInput.value : '';
          
          if (tab === 'has-image') {
              if (btnHas) { btnHas.style.color = '#64ffda'; btnHas.style.borderBottomColor = '#64ffda'; }
              if (btnNo) { btnNo.style.color = '#94a3b8'; btnNo.style.borderBottomColor = 'transparent'; }
              if (searchInput) searchInput.placeholder = "SAP Kodu ile ara...";
          } else {
              if (btnHas) { btnHas.style.color = '#94a3b8'; btnHas.style.borderBottomColor = 'transparent'; }
              if (btnNo) { btnNo.style.color = '#64ffda'; btnNo.style.borderBottomColor = '#64ffda'; }
              if (searchInput) searchInput.placeholder = "SAP Kodu veya Malzeme Adı ile ara...";
          }
          
          (window as any).renderImagePoolGrid(query);
      };

      // Define admin actions
      const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
      const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

      (window as any).triggerPoolImageUpdate = (sapNo: string) => {
          const input = document.getElementById('pool-image-update-input') as HTMLInputElement;
          if (input) {
              input.onchange = null;
              input.onchange = async (e: any) => {
                  const file = e.target.files?.[0];
                  if (!file) return;

                  if ((window as any).showToast) {
                      (window as any).showToast('Sıkıştırılıyor...', 'Görsel işleniyor ve optimize ediliyor...', 'info');
                  }

                  try {
                      const { ImageCompressor } = await import('../utils/imageCompressor');
                      const compressedFile = await ImageCompressor.compressImage(file, 800, 800, 0.7);

                      const { fileService } = await import('../services/FileService');
                      const base64Url = await fileService.uploadImage(compressedFile, '');

                      if ((window as any).showToast) {
                          (window as any).showToast('Yükleniyor...', 'Görsel depolara senkronize ediliyor...', 'info');
                      }

                      await warehouseService.syncMaterialImageGlobally(sapNo, base64Url);

                      if ((window as any).showToast) {
                          (window as any).showToast('Başarılı', 'Görsel tüm depolarda başarıyla güncellendi!', 'success');
                      }

                      (window as any).initImagePool();
                  } catch (err: any) {
                      console.error(err);
                      alert('Güncelleme hatası: ' + err.message);
                  } finally {
                      input.value = '';
                  }
              };
              input.click();
          }
      };

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

      (window as any).navigateToWarehouseWithSap = (warehouseId: string, sapNo: string) => {
          (window as any)._globalWarehouseSearchQuery = sapNo;
          if ((window as any).selectWarehouseAndNavigate) {
              (window as any).selectWarehouseAndNavigate(warehouseId);
          }
      };

      (window as any).loadMorePoolImages = () => {
          displayLimit += 40;
          const searchInput = document.getElementById('pool-search-input') as HTMLInputElement;
          const query = searchInput ? searchInput.value : '';
          (window as any).renderImagePoolGrid(query);
      };

      // Render Grid/Table
      (window as any)._globalImagePool = pool;
      
      (window as any).renderImagePoolGrid = (query: string = '') => {
          const lowerQuery = query.toLowerCase().trim();
          
          if (activeTab === 'has-image') {
              if (pool.size === 0) {
                  gridContainer.style.display = 'block';
                  gridContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 2rem;">Havuzda henüz hiç resim bulunmuyor.</div>';
                  return;
              }

              let gridHtml = '';
              let matchCount = 0;
              let renderedCount = 0;

              pool.forEach((imageUrl, sapNo) => {
                  if (lowerQuery && !String(sapNo).toLowerCase().includes(lowerQuery)) return;
                  
                  matchCount++;
                  if (renderedCount >= displayLimit) return;
                  renderedCount++;

                  const mName = sapNames.get(sapNo) || 'Malzeme Açıklaması Yok';

                  gridHtml += `
                    <div class="pool-card glass-panel" style="display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 12px; transition: transform 0.2s; background: rgba(15,23,42,0.8); border: 1px solid rgba(255,255,255,0.05); cursor: pointer; position: relative;" onclick="if(window.showPoolImage) window.showPoolImage('${imageUrl}', '${sapNo}')">
                        ${isAdmin ? `
                        <div class="card-admin-actions" style="position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.35rem; z-index: 10;">
                            <button onclick="event.stopPropagation(); window.triggerPoolImageUpdate('${sapNo}')" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); color: #64ffda; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="Görseli Değiştir">
                                <i class="fa-solid fa-camera" style="font-size: 0.75rem;"></i>
                            </button>
                            <button onclick="event.stopPropagation(); window.deletePoolImage('${sapNo}')" style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(255, 255, 255, 0.1); color: #ef4444; border-radius: 6px; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: all 0.2s;" title="Görseli Sil">
                                <i class="fa-solid fa-trash" style="font-size: 0.75rem;"></i>
                            </button>
                        </div>
                        ` : ''}
                        <div style="height: 180px; width: 100%; background: #000; display:flex; align-items:center; justify-content:center; overflow:hidden;">
                            <img src="${imageUrl}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.3s;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'" />
                        </div>
                        <div style="padding: 0.75rem 1rem; display: flex; flex-direction: column; gap: 0.25rem;">
                            <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.15rem; color: #64ffda; font-weight: bold; display: flex; justify-content: space-between; align-items: center;">
                                <span><i class="fa-solid fa-barcode" style="margin-right: 0.5rem;"></i>${sapNo}</span>
                                <i class="fa-solid fa-expand" style="color: #64748b; font-size: 0.8rem;"></i>
                            </div>
                            <div style="font-size: 0.75rem; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${mName}">
                                ${mName}
                            </div>
                        </div>
                    </div>
                  `;
              });
              
              if (gridHtml === '') {
                  gridContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 2rem;">Aradığınız kriterlere uygun resim bulunamadı.</div>';
              } else {
                  gridContainer.style.display = 'grid';
                  gridContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(200px, 1fr))';
                  gridContainer.style.gap = '1.5rem';
                  
                  let finalHtml = gridHtml;
                  if (matchCount > displayLimit) {
                      finalHtml += `
                        <div id="load-more-container" style="grid-column: 1 / -1; display: flex; justify-content: center; margin-top: 1.5rem; margin-bottom: 1rem;">
                            <button onclick="window.loadMorePoolImages()" class="btn-cyber" style="padding: 0.75rem 2rem; background: rgba(100,255,218,0.1); border: 1px solid #64ffda; color: #64ffda; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#64ffda'; this.style.color='#000';" onmouseout="this.style.backgroundColor='rgba(100,255,218,0.1)'; this.style.color='#64ffda';">
                                <i class="fa-solid fa-chevron-down" style="margin-right: 0.5rem;"></i> Daha Fazla Görsel Yükle (${matchCount - displayLimit} adet kaldı)
                            </button>
                        </div>
                      `;
                  }
                  gridContainer.innerHTML = finalHtml;
              }
          } else {
              // Resimsiz malzemeler table view
              const filtered = uncoveredSaps.filter(i => {
                  return !lowerQuery || 
                         i.sapNo.toLowerCase().includes(lowerQuery) || 
                         i.name.toLowerCase().includes(lowerQuery);
              });
              
              if (filtered.length === 0) {
                  gridContainer.style.display = 'block';
                  gridContainer.innerHTML = '<div style="color: #94a3b8; text-align: center; padding: 2rem;">Tüm malzemelerin resmi var veya arama sonucu boş.</div>';
                  return;
              }
              
              const matchCount = filtered.length;
              const paginatedList = filtered.slice(0, displayLimit);
              
              let tableHtml = `
                <div class="glass-panel" style="width: 100%; overflow-x: auto; background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 1rem;">
                  <table style="width: 100%; border-collapse: collapse; text-align: left;">
                    <thead>
                      <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 1rem;">
                        <th style="padding: 0.75rem 1rem; font-weight: bold;">SAP No</th>
                        <th style="padding: 0.75rem 1rem; font-weight: bold;">Malzeme Açıklaması</th>
                        <th style="padding: 0.75rem 1rem; font-weight: bold;">Bulunduğu Depolar</th>
                        <th style="padding: 0.75rem 1rem; font-weight: bold; text-align: right;">İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
              `;
              
              paginatedList.forEach(item => {
                  const whBadges = item.warehouses.map(w => `
                      <span onclick="window.navigateToWarehouseWithSap('${w.id}', '${item.sapNo}')" 
                            style="background: rgba(14, 165, 233, 0.1); color: #0ea5e9; border: 1px solid rgba(14, 165, 233, 0.2); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; margin-right: 0.35rem; display: inline-block; cursor: pointer; transition: all 0.2s; font-weight: 500;"
                            onmouseover="this.style.background='rgba(14, 165, 233, 0.25)'; this.style.borderColor='#0ea5e9';"
                            onmouseout="this.style.background='rgba(14, 165, 233, 0.1)'; this.style.borderColor='rgba(14, 165, 233, 0.2)';"
                            title="${w.name} deposuna git ve bu ürünü filtrele">
                            <i class="fa-solid fa-arrow-right-to-bracket" style="margin-right: 0.35rem; font-size: 0.7rem;"></i>${w.name}
                      </span>
                  `).join('');
                  tableHtml += `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); color: #e2e8f0; font-size: 0.9rem; transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                      <td style="padding: 0.75rem 1rem; font-weight: bold; font-family: monospace; color: #f59e0b;">${item.sapNo}</td>
                      <td style="padding: 0.75rem 1rem; max-width: 300px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${item.name}">${item.name}</td>
                      <td style="padding: 0.75rem 1rem;">${whBadges}</td>
                      <td style="padding: 0.75rem 1rem; text-align: right;">
                        <button onclick="navigator.clipboard.writeText('${item.sapNo}'); if(window.showToast) window.showToast('Kopyalandı', 'SAP No kopyalandı: ${item.sapNo}', 'success')" class="btn-cyber" style="padding: 4px 8px; font-size: 0.75rem; background: rgba(100,255,218,0.1); border: 1px solid #64ffda; color: #64ffda; border-radius: 4px; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#64ffda'; this.style.color='#000'" onmouseout="this.style.backgroundColor='rgba(100,255,218,0.1)'; this.style.color='#64ffda'">
                            <i class="fa-solid fa-copy" style="margin-right: 0.25rem;"></i> Kopyala
                        </button>
                      </td>
                    </tr>
                  `;
              });
              
              tableHtml += `
                    </tbody>
                  </table>
                </div>
              `;

              if (matchCount > displayLimit) {
                  tableHtml += `
                    <div id="load-more-container" style="display: flex; justify-content: center; margin-top: 1.5rem; margin-bottom: 1rem;">
                        <button onclick="window.loadMorePoolImages()" class="btn-cyber" style="padding: 0.75rem 2rem; background: rgba(100,255,218,0.1); border: 1px solid #64ffda; color: #64ffda; border-radius: 8px; font-weight: bold; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.backgroundColor='#64ffda'; this.style.color='#000';" onmouseout="this.style.backgroundColor='rgba(100,255,218,0.1)'; this.style.color='#64ffda';">
                            <i class="fa-solid fa-chevron-down" style="margin-right: 0.5rem;"></i> Daha Fazla Listele (${matchCount - displayLimit} adet kaldı)
                        </button>
                    </div>
                  `;
              }
              
              gridContainer.style.display = 'block';
              gridContainer.innerHTML = tableHtml;
          }
      };

      (window as any).renderImagePoolGrid();

    } catch(e) {
      console.error(e);
      statsContainer.innerHTML = '<div style="color: #ef4444;">Veriler yüklenirken hata oluştu.</div>';
    }
  };

  (window as any).runImageMigration = async () => {
      const btn = document.getElementById('migration-btn');
      if(btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="margin-right: 0.5rem;"></i> Göç İşlemi Sürüyor...';
      
      try {
        const pool = await warehouseService.getGlobalImagePool();
        const warehouses = dataService.getWarehouses();
        let migratedCount = 0;

        for (const w of warehouses) {
            const inv = await warehouseService.getInventory(w.id, true); // force refresh
            for (const item of inv) {
                if (item.imageUrl && item.sapNo) {
                    const cleanSap = String(item.sapNo).trim();
                    const stripped = cleanSap.replace(/^0+/, '');
                    if (!pool.has(cleanSap) && !pool.has(stripped)) {
                        // Found a local image not in pool!
                        await warehouseService.syncMaterialImageGlobally(cleanSap, item.imageUrl);
                        pool.set(cleanSap, item.imageUrl);
                        migratedCount++;
                    }
                }
            }
        }

        if ((window as any).showToast) {
            (window as any).showToast('Göç Tamamlandı', `${migratedCount} adet eski resim havuza başarıyla aktarıldı!`, 'success');
        }
        
        // Refresh page
        (window as any).initImagePool();

      } catch(e) {
          console.error(e);
          if ((window as any).showToast) {
            (window as any).showToast('Hata', `Göç sırasında bir hata oluştu.`, 'error');
        }
      } finally {
          if(btn) {
              btn.innerHTML = '<i class="fa-solid fa-rotate" style="margin-right: 0.5rem;"></i> Eski Resimleri Havuza Aktar';
          }
      }
  };

  (window as any).showPoolImage = (url: string, title: string) => {
      const modal = document.getElementById('pool-image-modal');
      const img = document.getElementById('pool-image-content') as HTMLImageElement;
      const titleEl = document.getElementById('pool-image-title');
      if (modal && img && titleEl) {
          img.src = url;
          titleEl.innerText = `SAP No: ${title}`;
          modal.style.display = 'flex';
      }
  };

  (window as any).closePoolImage = () => {
      const modal = document.getElementById('pool-image-modal');
      if (modal) modal.style.display = 'none';
  };

  // Kick off init
  setTimeout(() => {
    if ((window as any).initImagePool) {
        (window as any).initImagePool();
    }
  }, 100);

  return `
    <div class="fade-in-up content-area" style="padding-bottom: 2rem;">
      <!-- Image Zoom Modal -->
      <div id="pool-image-modal" style="display: none; position: fixed; inset: 0; background-color: rgba(0, 0, 0, 0.9); backdrop-filter: blur(8px); z-index: 9999; align-items: center; justify-content: center; flex-direction: column;" onclick="window.closePoolImage()">
          <div style="position: absolute; top: 2rem; right: 2rem; color: #fff; font-size: 2rem; cursor: pointer; transition: color 0.2s;" onmouseover="this.style.color='#ef4444'" onmouseout="this.style.color='#fff'"><i class="fa-solid fa-xmark"></i></div>
          <h3 id="pool-image-title" style="color: #64ffda; font-family: 'Rajdhani', sans-serif; font-size: 1.5rem; letter-spacing: 2px; margin-bottom: 1rem; margin-top: 0;"></h3>
          <img id="pool-image-content" src="" style="max-width: 90%; max-height: 80vh; object-fit: contain; border-radius: 12px; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5); border: 1px solid rgba(255,255,255,0.1);" onclick="event.stopPropagation()" />
      </div>

      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-images" style="margin-right: 0.5rem;"></i> Küresel Resim Havuzu
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Sisteme yüklenen tüm malzeme görselleri burada toplanır ve tüm depolar tarafından ortak kullanılır.</p>
        </div>
        <div>
          <button id="migration-btn" class="btn-cyber" style="display: none;" onclick="window.runImageMigration()">
            <i class="fa-solid fa-rotate" style="margin-right: 0.5rem;"></i> Eski Resimleri Havuza Aktar
          </button>
        </div>
      </div>

      <div id="pool-stats"></div>

      <!-- Hidden Input for updating pool images -->
      <input type="file" id="pool-image-update-input" accept="image/*" style="display: none;" />

      <!-- Tabs Switcher -->
      <div id="pool-tabs-container" style="margin-bottom: 1.5rem;"></div>

      <div style="margin-bottom: 1.5rem; position: relative; max-width: 400px;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748b;"></i>
        <input type="text" id="pool-search-input" placeholder="SAP Kodu ile ara..." 
               oninput="if(window.renderImagePoolGrid) window.renderImagePoolGrid(this.value)"
               style="width: 100%; background: rgba(15,23,42,0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem 1rem 0.75rem 2.5rem; color: #fff; font-size: 1rem; outline: none; transition: all 0.2s;"
               onfocus="this.style.borderColor='rgba(100,255,218,0.5)'; this.style.boxShadow='0 0 0 2px rgba(100,255,218,0.1)'"
               onblur="this.style.borderColor='rgba(255,255,255,0.1)'; this.style.boxShadow='none'" />
      </div>

      <div id="pool-grid">
      </div>
    </div>
  `;
};
