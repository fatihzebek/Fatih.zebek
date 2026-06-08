                    <input type="text" id="modal-description" required placeholder="Malzeme adını girin..." 
                           style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                           onfocus="this.style.borderColor='#64ffda'; this.style.background='#1c2128'" onblur="this.style.borderColor='#30363d'; this.style.background='#161b22'">
                  </div>



                  <!-- Quantity & Limit -->
                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                    <div>
                      <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.8px;">MİKTAR</label>
                      <input type="number" id="modal-quantity" required placeholder="0" 
                             style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; box-sizing: border-box;"
                             onfocus="this.style.borderColor='#64ffda'" onblur="this.style.borderColor='#30363d'">
                    </div>
                    <div>
                      <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.8px;">KRİTİK LİMİT</label>
                      <input type="number" id="modal-critical-limit" placeholder="Limit yok" 
                             style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; box-sizing: border-box;"
                             onfocus="this.style.borderColor='#64ffda'" onblur="this.style.borderColor='#30363d'">
                    </div>
                  </div>

                  <!-- Shelf -->
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.8px;">RAF KONUMU</label>
                    <input type="text" id="modal-shelf" placeholder="Örn: A-12-3" 
                           style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; box-sizing: border-box;"
                           onfocus="this.style.borderColor='#64ffda'" onblur="this.style.borderColor='#30363d'">
                  </div>
                </div>

                <!-- Right Side -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">MALZEME GÖRSELİ</label>
                  <div id="modal-image-area" style="height: 220px; width: 100%; position: relative;">
                    <div id="modal-image-preview-container" style="display: none; width: 100%; height: 100%; position: relative; border-radius: 20px; overflow: hidden; background: #000; border: 1px solid #30363d;">
                      <img id="modal-image-preview" src="" style="width: 100%; height: 100%; object-fit: contain;">
                      <button type="button" onclick="window.removeMaterialImage()" style="position: absolute; top: 12px; right: 12px; width: 36px; height: 36px; border-radius: 10px; background: rgba(255,77,77,0.9); border: none; color: white; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">
                        <i class="fa-solid fa-trash" style="font-size: 0.9rem;"></i>
                      </button>
                    </div>
                    <div id="modal-no-image" onclick="window.triggerMaterialImageSelect()" 
                         style="width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; border: 2px dashed #30363d; border-radius: 20px; cursor: pointer; background: rgba(255,255,255,0.02); transition: all 0.2s;"
                         onmouseover="this.style.borderColor='#64ffda'; this.style.background='rgba(100,255,218,0.05)';"
                         onmouseout="this.style.borderColor='#30363d'; this.style.background='rgba(255,255,255,0.02)';">
                      <i class="fa-solid fa-camera" style="font-size: 2.4rem; color: var(--text-dim); opacity: 0.3;"></i>
                      <span style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500; opacity: 0.8;">Görsel Yükle</span>
                    </div>
                    <input type="file" id="material-image-input" accept="image/*" style="display: none;" onchange="window.handleMaterialImageSelect(event)">
                  </div>
                </div>
              </div>

              <!-- Footer Buttons -->
              <div style="display: grid; grid-template-columns: 1fr 2fr; gap: 2.5rem; margin-top: 5rem;">
                <button type="button" onclick="window.closeAddMaterialModal()" 
                        style="height: 60px; border-radius: 16px; font-weight: 700; font-size: 1.1rem; background: #21262d; color: white; border: 1px solid #30363d; cursor: pointer; transition: all 0.2s;"
                        onmouseover="this.style.background='#30363d'" onmouseout="this.style.background='#21262d'">İPTAL</button>
                <button type="submit" id="modal-submit-btn" 
                        style="height: 60px; border-radius: 16px; font-weight: 800; font-size: 1.1rem; background: #64ffda; color: #0d1117; border: none; cursor: pointer; transition: all 0.2s; text-transform: uppercase;"
                        onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter='none'">DEĞİŞİKLİKLERİ KAYDET</button>
              </div>
            </form>
          </div>

        </div>
      </div>

      <!-- QR Scanner Modal -->
      <div id="qr-scanner-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.95); z-index: 10002; align-items: center; justify-content: center;">
        <div class="premium-card" style="max-width: 600px; width: 90%; padding: 2rem; text-align: center;">
          <h3 style="color: var(--accent-blue); margin-bottom: 1.5rem;">QR KOD TARA</h3>
          <div id="reader"></div>
          <button onclick="window.stopQRScanner()" class="btn-cyber" style="margin-top: 1.5rem; background: #ff4d4d; color: white;">KAPAT</button>
        </div>
      </div>

      <!-- Loading Overlays -->
      <div id="upload-loading-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,8,20,0.8); backdrop-filter: blur(10px); z-index: 20000; align-items: center; justify-content: center; flex-direction: column; gap: 1.5rem;">
          <div style="width: 60px; height: 60px; border: 4px solid var(--accent-glow); border-top-color: var(--accent-blue); border-radius: 50%; animation: spin 1s linear infinite;"></div>
          <div style="color: var(--text-main); font-weight: 800; letter-spacing: 1px;">İŞLENİYOR...</div>
      </div>

      <!-- Batch Action Bar -->
      <div id="batch-action-bar" style="display: none;" class="batch-bar">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 32px; height: 32px; background: var(--accent-blue); color: #000; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: 900;" id="batch-count">0</div>
          <div style="color: var(--text-main); font-weight: 700; font-size: 0.9rem;">Öğe Seçildi</div>
        </div>
        <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.1);"></div>
        <div style="display: flex; gap: 10px;">
          <button onclick="window.printBatchLabels()" class="btn-cyber" style="background: rgba(255, 193, 7, 0.1); color: var(--accent-yellow, #ffc107); padding: 8px 16px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(255, 193, 7, 0.2);">
            <i class="fa-solid fa-print" style="margin-right: 6px;"></i> TOPLU ETİKET YAZDIR
          </button>
          <button onclick="window.openBatchShelfModal()" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); padding: 8px 16px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(100, 255, 218, 0.2);">
            <i class="fa-solid fa-location-dot" style="margin-right: 6px;"></i> TOPLU KONUM GÜNCELLE
          </button>
          <button onclick="window.clearBatchSelection()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-dim); padding: 8px 16px; font-size: 0.75rem; font-weight: 800;">
            İPTAL
          </button>
        </div>
      </div>

      <!-- Reserve Detail Modal -->
      <div id="reserve-detail-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,8,20,0.9); backdrop-filter: blur(20px); z-index: 10005; align-items: center; justify-content: center;">
        <div class="premium-card modal-content" style="max-width: 600px; width: 90%; padding: 2rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <h3 id="reserve-modal-title" style="margin: 0; color: #ff9800; font-weight: 900;">Rezervasyon Detayları</h3>
            <button onclick="document.getElementById('reserve-detail-modal').style.display='none'" class="action-icon-btn"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div id="reserve-modal-content" style="display: flex; flex-direction: column; gap: 1rem;">
            <!-- Content will be injected by JS -->
          </div>
        </div>
      </div>

      <!-- Main Container with Zoom -->
      <div class="zoom-tablet" style="max-width: 1600px; margin: 0 auto; padding: 1.5rem; animation: fadeIn 0.4s ease-out;">
        
        <!-- Dashboard Header -->
        <header style="display: flex; flex-wrap: wrap; gap: 1rem; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
          <div style="display: flex; align-items: center; gap: 1.5rem;">
            <button onclick="(window as any).navigate('warehouses')" class="action-icon-btn" style="width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 style="margin: 0; font-size: clamp(1.5rem, 2.5vw, 2.2rem); font-weight: 900; letter-spacing: -1px; color: var(--text-main);">${warehouse?.name || `Depo`}</h1>
              <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">${warehouse?.location || `Stok ve Envanter Yönetim Sistemi`}</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; flex: 1; justify-content: flex-end;">
            <div style="position: relative; flex: 1 1 250px; max-width: 350px; min-width: 200px; display: flex; align-items: center;">
              <input type="text" id="inventory-search" placeholder="Parça veya SAP no ara..." 
                     value="${searchQuery || ``}"
                     class="cyber-input-premium search-box-mini"
                     style="width: 100%; padding-right: 50px;"
                     onkeypress="if(event.key==='Enter') window.updateWarehouseUI(undefined, undefined, undefined, this.value)"
                     autofocus
                     onfocus="this.setSelectionRange(this.value.length, this.value.length)">
              <button onclick="(window as any).updateWarehouseUI(undefined, undefined, undefined, document.getElementById('inventory-search').value)" 
                      style="position: absolute; right: 6px; width: 36px; height: 36px; background: var(--accent-blue); border: none; color: #0a1118; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.2s;"
                      onmouseover="this.style.filter='brightness(1.1)';" 
                      onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </div>
            
            <button onclick="(window as any).startQuickAudit('${selectedWarehouseId}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(100, 255, 218, 0.2); flex-shrink: 0;">
              <i class="fa-solid fa-bolt" style="margin-right: 8px;"></i> HIZLI SAYIM
            </button>

            <button onclick="(window as any).startQRScanner('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(100, 255, 218, 0.2); cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> QR TARA
            </button>

            <button onclick="(window as any).downloadExcel('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-file-export" style="color: #2ecc71; margin-right: 8px;"></i> İNDİR
            </button>

            ${hasAddMaterialPerm ?`
            <button onclick="(window as any).triggerExcelUpload('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-file-import" style="color: var(--accent-blue); margin-right: 8px;"></i> YÜKLE
            </button>
            `:``}

            ${hasDeletePerm ?`
            <div style="position: relative; display: inline-block; flex-shrink: 0;" id="admin-menu-container">
              <button onclick="const m = document.getElementById('admin-actions-menu'); if(m) m.style.display = m.style.display === 'none' ? 'block' : 'none';" 
                      class="btn-cyber" 
                      style="background: rgba(255,255,255,0.05); color: var(--text-dim); padding: 10px; border-radius: 10px; font-size: 0.9rem; border: none; cursor: pointer;">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
              <div id="admin-actions-menu" style="display: none; position: absolute; top: calc(100% + 8px); right: 0; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; min-width: 220px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;">
                <div style="padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.65rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px;">YÖNETİCİ ARAÇLARI</div>
                
                <button onclick="window.clearLegacyLimits('${selectedWarehouseId}')" 
                        style="width: 100%; text-align: left; background: none; border: none; padding: 12px 15px; color: var(--text-main); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                        onmouseout="this.style.background='none'">
                  <i class="fa-solid fa-broom" style="color: var(--accent-blue); width: 16px;"></i>
                  <span>Eski Limitleri Temizle (5 Adet)</span>
                </button>

                <button onclick="window.resetWarehouse('${selectedWarehouseId}')" 
                        style="width: 100%; text-align: left; background: none; border: none; padding: 12px 15px; color: #ff4d4d; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255, 77, 77, 0.05)'"
                        onmouseout="this.style.background='none'">
                  <i class="fa-solid fa-trash-can" style="width: 16px;"></i>
                  <span>Depo Envanterini Sıfırla</span>
                </button>
              </div>
            </div>
            `:``}

            ${u?`
            <button onclick="window.openAddMaterialModal('${selectedWarehouseId}')" class="btn-cyber" style="background: #fff; color: #000; padding: 10px 24px; border-radius: 10px; font-weight: 900; font-size: 0.75rem; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-plus"></i> YENİ EKLE
            </button>
            `:``}
          </div>
        </header>

        <!-- Stats Grid -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.2rem; margin-bottom: 2rem;">
          <div class="stats-card">
            <div class="stats-label">Toplam Kalem</div>
            <div class="stats-value">${inventoryData.length}</div>
          </div>
          <div class="stats-card" style="border-left: 3px solid var(--danger);">
            <div class="stats-label" style="color: var(--danger);">Kritik Stok</div>
            <div class="stats-value" style="color: var(--danger);">${criticalItems.length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">Son İşlemler</div>
            <div class="stats-value">${logs.length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">Son Hareket</div>
            <div class="stats-value" style="font-size: 1.2rem;">${logs.length > 0 ? formatTimestamp(logs[0].timestamp).split(` `)[1] : `-`}</div>
          </div>
          <div class="stats-card" style="background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.1);">
            <div class="stats-label" style="color: var(--accent-blue);">Depo Durumu</div>
            <div class="stats-value" style="color: var(--accent-blue); font-size: 1.2rem;">AKTİF</div>
          </div>
        </div>

        <!-- Tab Switcher (Always Visible) -->
        <div style="display: flex; overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 12px; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
          <button onclick="(window as any).changeTab('${selectedWarehouseId}', 'inventory')" class="premium-tab ${activeTab === `inventory`?`active`:``}">
            <i class="fa-solid fa-layer-group"></i> ENVANTER
          </button>
          <button onclick="(window as any).changeTab('${selectedWarehouseId}', 'history')" class="premium-tab ${activeTab === `history`?`active`:``}">
            <i class="fa-solid fa-history"></i> GEÇMİŞ
          </button>
          <button onclick="(window as any).changeTab('${selectedWarehouseId}', 'analytics')" class="premium-tab ${activeTab === `analytics`?`active`:``}">
            <i class="fa-solid fa-chart-line"></i> ANALİZ
          </button>
          <button onclick="(window as any).changeTab('${selectedWarehouseId}', 'audit')" class="premium-tab ${activeTab === `audit`?`active`:``}">
            <i class="fa-solid fa-clipboard-check"></i> SAYIM
          </button>
          <button onclick="(window as any).changeTab('${selectedWarehouseId}', 'audit_history')" class="premium-tab ${activeTab === `audit_history`?`active`:``}">
            <i class="fa-solid fa-file-invoice"></i> SAYIM GEÇMİŞİ
          </button>
        </div>

        <div id="tab-content-root">
          ${activeTab === `inventory`?`
            <!-- AI Banner -->
            <div class="ai-banner" style="margin-top: 1rem;">
              <div style="display: flex; align-items: center; gap: 1.5rem;">
                <div style="width: 48px; height: 48px; background: rgba(255, 77, 77, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--danger);">
                  <i class="fa-solid fa-robot"></i>
                </div>
                <div>
                  <h4 style="margin: 0; color: var(--danger); letter-spacing: 1px; font-weight: 900; font-size: 0.9rem;">ENVANTER ANALİTİĞİ (AI)</h4>
                  <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem;">Şu an ${criticalItems.length} kalem malzeme kritik seviyenin altında. Sarf malzemeleri için sipariş planlanması önerilir.</p>
                </div>
              </div>
              <button onclick="window.initiateOrderFlow('${selectedWarehouseId}')" class="btn-cyber" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--danger); padding: 10px 20px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer;">
                SİPARİŞ OLUŞTUR
              </button>
            </div>

            ${_.details.length>0?`
            <!-- Aktif Rezervasyonlar Kartı -->
            <div class="premium-card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 20px; border-left: 4px solid #ff9800;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 40px; height: 40px; background: rgba(255, 152, 0, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #ff9800;">
                    <i class="fa-solid fa-bookmark"></i>
                  </div>
                  <div>
                    <h4 style="margin: 0; color: #ff9800; font-weight: 900; font-size: 0.85rem; letter-spacing: 1px;">AKTİF REZERVASYONLAR</h4>
                    <p style="margin: 2px 0 0 0; color: var(--text-dim); font-size: 0.75rem;">${_.details.length} görevde toplam ${Object.values(_.bySap).reduce((e,t)=>e+t,0)} adet malzeme rezerve edildi</p>
                  </div>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${_.details.map(e=>`
                  <div style="background: rgba(255, 152, 0, 0.04); border: 1px solid rgba(255, 152, 0, 0.1); border-radius: 14px; padding: 1rem 1.2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 3px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 900;">${e.team}</span>
                        <span style="color: var(--text-main); font-weight: 800; font-size: 0.8rem;"><i class="fa-solid fa-wind" style="color: var(--accent-blue); margin-right: 5px; font-size: 0.7rem;"></i>${e.turbinNo}</span>
                        <span style="color: var(--text-dim); font-size: 0.7rem; font-weight: 600;">${e.sablon}</span>
                      </div>
                      <span style="background: ${e.durum===`Görev Teslim Edildi`?`rgba(100, 255, 218, 0.1)`:`rgba(255, 152, 0, 0.1)`}; color: ${e.durum===`Görev Teslim Edildi`?`var(--accent-blue)`:`#ff9800`}; padding: 3px 10px; border-radius: 8px; font-size: 0.6rem; font-weight: 800;">${e.durum}</span>
                    </div>
                    ${e.personnel.length>0?`
                      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 8px;">
                        <i class="fa-solid fa-user" style="font-size: 0.6rem; color: var(--text-dim);"></i>
                        <span style="font-size: 0.7rem; color: var(--text-dim); font-weight: 600;">${e.personnel.join(`, `)}</span>
                      </div>
                    `:``}
                    <div style="display: flex; flex-wrap: wrap; gap: 8px;">
                      ${e.materials.map(e=>`
                        <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.2); padding: 6px 12px; border-radius: 10px;">
                          <span style="color: var(--accent-blue); font-weight: 800; font-size: 0.7rem;">${e.sapNo}</span>
                          <span style="color: var(--text-dim); font-size: 0.65rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${e.description}</span>
                          <span style="background: rgba(255, 152, 0, 0.2); color: #ff9800; padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 900;">${e.used} Ad.</span>
                        </div>
                      `).join(``)}
                    </div>
                  </div>
                `).join(``)}
              </div>
            </div>
            `:``}

            <div class="premium-card" style="padding: 0; overflow: hidden; border-radius: 20px;">
              <div style="overflow-x: auto; -webkit-overflow-scrolling: touch; width: 100%;">
                <table style="min-width: 980px; width: 100%; border-collapse: collapse;">
                  <thead>
                    <tr style="background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                      <th style="padding: 1.2rem 1rem; width: 50px; text-align: center;">
                        <input type="checkbox" id="master-checkbox" onchange="(window as any).toggleAllBatch(this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue);">
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: ${sortKey === `description`?`var(--accent-blue)`:`var(--text-dim)`}; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;" onclick="(window as any).updateWarehouseUI('${selectedWarehouseId}', 'description')">
                          MALZEME TANIMI <i class="fa-solid fa-sort${sortKey === `description`?window.lastSortDir===`asc`?`-up`:`-down`:``}" style="margin-left: 5px; opacity: ${sortKey === `description`?`1`:`0.5`};"></i>
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: ${sortKey === `sapNo`?`var(--accent-blue)`:`var(--text-dim)`}; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;" onclick="(window as any).updateWarehouseUI('${selectedWarehouseId}', 'sapNo')">
                          SAP NO <i class="fa-solid fa-sort${sortKey === `sapNo`?window.lastSortDir===`asc`?`-up`:`-down`:``}" style="margin-left: 5px; opacity: ${sortKey === `sapNo`?`1`:`0.5`};"></i>
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: ${sortKey === `quantity`?`var(--accent-blue)`:`var(--text-dim)`}; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;" onclick="(window as any).updateWarehouseUI('${selectedWarehouseId}', 'quantity')">
                          STOK <i class="fa-solid fa-sort${sortKey === `quantity`?window.lastSortDir===`asc`?`-up`:`-down`:``}" style="margin-left: 5px; opacity: ${sortKey === `quantity`?`1`:`0.5`};"></i>
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: center; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">
                          REZERVE
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: left; font-size: 0.65rem; color: ${sortKey === `shelfNo`?`var(--accent-blue)`:`var(--text-dim)`}; text-transform: uppercase; letter-spacing: 1px; cursor: pointer;" onclick="(window as any).updateWarehouseUI('${selectedWarehouseId}', 'shelfNo')">
                          KONUM <i class="fa-solid fa-sort${sortKey === `shelfNo`?window.lastSortDir===`asc`?`-up`:`-down`:``}" style="margin-left: 5px; opacity: ${sortKey === `shelfNo`?`1`:`0.5`};"></i>
                      </th>
                      <th style="padding: 1.2rem 1.5rem; text-align: right; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${inventoryData.length === 0 ?`
                      <tr>
                        <td colspan="7" style="padding: 4rem 1.5rem; text-align: center;">
                          <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1.2rem; animation: fadeIn 0.3s ease-out;">
                            <div style="width: 56px; height: 56px; background: rgba(255, 77, 77, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: var(--danger); font-size: 1.5rem; border: 1px solid rgba(255, 77, 77, 0.2);">
                              <i class="fa-solid fa-triangle-exclamation"></i>
                            </div>
                            <div>
                              <h4 style="margin: 0; color: #ff4d4d; font-weight: 800; font-size: 1.1rem; letter-spacing: 0.5px;">BU ÜRÜN STOKTA YOK</h4>
                              <p style="margin: 6px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">Aradığınız kriterlere uyan hiçbir malzeme bu depoda bulunamadı.</p>
                            </div>
                          </div>
                        </td>
                      </tr>
                    `:inventoryData.map(item =>`
                      <tr class="material-row" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                        <td style="padding: 1rem; text-align: center;">
                          <input type="checkbox" class="item-checkbox" data-id="${item.id}" data-sap="${item.sapNo}" data-desc="${(t.description||``).replace(/"/g,`&quot;`)}" onchange="(window as any).updateBatchCount()" style="width: 18px; height: 18px; cursor: pointer; accent-color: var(--accent-blue);">
                        </td>
                        <td style="padding: 1rem 1.5rem;">
                          <div style="display: flex; align-items: center; gap: 1.2rem;">
                            <div onclick="${item.imageUrl?`window.viewMaterialImage('${item.imageUrl}', '${item.description.replace(/'/g,`\\'`)}')`:`window.openImageUploadModal('${selectedWarehouseId}', '${item.id}')`}" 
                                 style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; cursor: pointer; border: 1px solid rgba(255,255,255,0.05); overflow: hidden; position: relative;">
                              ${item.imageUrl?`<i class="fa-solid fa-image" style="color: #64ffda; font-size: 1.5rem; filter: drop-shadow(0 0 5px rgba(100,255,218,0.4));"></i>`:`<i class="fa-solid fa-camera" style="color: var(--text-dim); opacity: 0.4; font-size: 1.2rem;"></i>`}
                            </div>
                            <div>
                              <div style="display: flex; align-items: center; gap: 8px;">
                                <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem;">${item.description}</div>
                                ${(()=>{if(!t.lastAuditDate)return`
`;
};

(window as any).handleWarehouseFormSubmit = async (e: Event) => {
  e.preventDefault();
  const warehouseId = (document.getElementById('modal-warehouse-id') as HTMLInputElement).value;
  const itemId = (document.getElementById('modal-item-id') as HTMLInputElement).value;
  const sapNo = (document.getElementById('modal-sap-no') as HTMLInputElement).value;
  const description = (document.getElementById('modal-description') as HTMLInputElement).value;
  const quantity = parseInt((document.getElementById('modal-quantity') as HTMLInputElement).value || '0', 10);
  const criticalLimitVal = (document.getElementById('modal-critical-limit') as HTMLInputElement).value;
  const criticalLimit = criticalLimitVal ? parseInt(criticalLimitVal, 10) : null;
  const shelfNo = (document.getElementById('modal-shelf') as HTMLInputElement).value;
  
  let imageUrl = null;
  const submitBtn = document.getElementById('modal-submit-btn') as HTMLButtonElement;
  const originalBtnText = submitBtn.innerHTML;

  try {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';

    if ((window as any).pendingMaterialImage) {
      const { inventoryService } = await import('../services/InventoryService');
      const { warehouseService } = await import('../services/WarehouseService');
      const resolvedWarehouseId = warehouseService.resolveWarehouseId(warehouseId);
      imageUrl = await inventoryService.uploadMaterialImage(resolvedWarehouseId, itemId || 'temp_' + Date.now(), (window as any).pendingMaterialImage);
      (window as any).pendingMaterialImage = null;
    }
