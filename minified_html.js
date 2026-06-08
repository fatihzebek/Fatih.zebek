export default `
      <style>
        :root {
          --bg-dark: #0a0a0a;
          --card-bg: rgba(15, 20, 25, 0.8);
          --accent-blue: var(--accent-cyan);
          --accent-glow: rgba(0, 243, 255, 0.15);
          --text-main: #ffffff;
          --text-dim: rgba(255, 255, 255, 0.6);
          --danger: #ff4d4d;
        }

        .premium-card {
          background: rgba(10, 15, 25, 0.6);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(0, 243, 255, 0.15);
          border-radius: 16px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 243, 255, 0.05);
        }

        .stats-card {
          flex: 1;
          padding: 1.5rem;
          background: linear-gradient(145deg, rgba(255,255,255,0.03) 0%, rgba(0,0,0,0.2) 100%);
          border: 1px solid rgba(0, 243, 255, 0.1);
          border-radius: 16px;
          min-width: 150px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s;
        }
        
        .stats-card:hover {
          transform: translateY(-2px);
          border-color: rgba(0, 243, 255, 0.3);
          box-shadow: 0 10px 20px rgba(0, 243, 255, 0.1);
        }

        .stats-label {
          font-size: 0.7rem;
          font-weight: 800;
          color: var(--text-dim);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-bottom: 8px;
          font-family: 'Rajdhani', sans-serif;
        }

        .stats-value {
          font-size: 2rem;
          font-weight: 900;
          color: var(--text-main);
          font-family: 'Rajdhani', sans-serif;
          text-shadow: 0 0 15px rgba(255, 255, 255, 0.2);
        }

        .cyber-input-premium {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(0, 243, 255, 0.2);
          border-radius: 12px;
          color: var(--text-main);
          padding: 10px 15px;
          transition: all 0.3s;
        }
        
        .cyber-input-premium:focus {
          border-color: var(--accent-cyan);
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
          outline: none;
        }

        .premium-tab {
          padding: 8px 24px;
          border-radius: 10px;
          border: 1px solid transparent;
          background: transparent;
          color: var(--text-dim);
          font-size: 0.8rem;
          font-weight: 800;
          cursor: pointer;
          transition: all 0.3s;
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
          font-family: 'Rajdhani', sans-serif;
          letter-spacing: 1px;
        }

        .premium-tab.active {
          background: rgba(0, 243, 255, 0.1);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
        }

        .ai-banner {
          background: linear-gradient(90deg, rgba(255, 77, 77, 0.05), rgba(0, 243, 255, 0.05));
          border: 1px solid rgba(255, 77, 77, 0.2);
          border-left: 4px solid var(--accent-red);
          border-radius: 16px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .action-icon-btn {
          width: 34px;
          height: 34px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(255,255,255,0.02);
          color: var(--text-dim);
          cursor: pointer;
          transition: all 0.2s;
        }

        .action-icon-btn:hover {
          transform: translateY(-2px);
          filter: brightness(1.2);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
        }

        .material-row:hover {
          background: rgba(255,255,255,0.01);
        }

        .shelf-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: var(--accent-blue);
        }

        .zoom-tablet {
          /* Page zoom reverted to normal */
          zoom: 1;
        }

        .modal-content {
          zoom: 0.8;
          transform-origin: center center;
        }

        .audit-badge {
          font-size: 0.55rem;
          padding: 3px 8px;
          border-radius: 6px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 4px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .audit-fresh { background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); border: 1px solid rgba(100, 255, 218, 0.2); }
        .audit-stale { background: rgba(255, 152, 0, 0.1); color: #ff9800; border: 1px solid rgba(255, 152, 0, 0.2); }
        .audit-expired { background: rgba(255, 77, 77, 0.1); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.2); }

        .batch-bar {
          position: fixed;
          bottom: 30px;
          left: 50%;
          transform: translateX(-50%);
          background: #111a24;
          border: 1px solid var(--accent-blue);
          padding: 1rem 2rem;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 2rem;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6);
          z-index: 1000;
          animation: slideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes slideUp { from { transform: translate(-50%, 100px); opacity: 0; } to { transform: translate(-50%, 0); opacity: 1; } }
        @keyframes spin { 100% { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .premium-card {
            padding: 1rem !important;
          }
          .ai-banner {
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 1.2rem !important;
            padding: 1.2rem !important;
          }
          .ai-banner button {
            width: 100% !important;
          }
          .premium-tab {
            padding: 8px 16px !important;
            font-size: 0.75rem !important;
          }
        }
      </style>

      <!-- Image Preview Modal -->
      <div id="image-preview-modal" class="modal-overlay" style="display: none; align-items: center; justify-content: center; z-index: 10000; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,8,20,0.9); backdrop-filter: blur(20px);">
        <div class="premium-card modal-content" style="width: 90%; max-width: 900px; padding: 0; overflow: hidden; position: relative; background: #0a192f; border: 1px solid rgba(100,255,218,0.2); box-shadow: 0 30px 60px rgba(0,0,0,0.8); transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
          <div style="padding: 1.5rem; display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
            <h3 id="preview-title" style="margin: 0; color: var(--accent-blue); font-size: 1.1rem;">Malzeme Resmi</h3>
            <button onclick="document.getElementById('image-preview-modal').style.display='none'" class="action-icon-btn" style="background: rgba(255,255,255,0.05);">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div style="width: 100%; height: 600px; background: #000; display: flex; align-items: center; justify-content: center; overflow: hidden;">
            <img id="preview-img" style="max-width: 100%; max-height: 100%; object-fit: contain;">
          </div>
          <div style="padding: 1.5rem; display: flex; justify-content: center; gap: 1rem; background: rgba(255,255,255,0.02);">
            <button onclick="document.getElementById('image-preview-modal').style.display='none'" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 12px 30px; border-radius: 12px;">KAPAT</button>
          </div>
        </div>
      </div>

      <!-- Add/Edit Material Modal -->
      <div id="add-material-modal" class="modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,8,20,0.9); backdrop-filter: blur(20px); z-index: 10001; align-items: center; justify-content: center;">
        <div class="premium-card modal-content" style="max-width: 720px; width: 95%; max-height: 90vh; overflow-y: auto; overflow-x: hidden; padding: 0; border: 1px solid rgba(100, 255, 218, 0.1); background: #0d1117; box-shadow: 0 30px 60px rgba(0,0,0,0.5); border-radius: 28px; transform: scale(0.9); transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); position: relative; box-sizing: border-box;">
          
          <div class="modal-inner-content" style="zoom: 0.92; padding: 3.5rem; display: flex; flex-direction: column; box-sizing: border-box;">
            
            <!-- Close Button -->
            <button onclick="window.closeAddMaterialModal()" 
                    style="position: absolute; top: 30px; right: 30px; background: none; border: none; color: var(--text-dim); cursor: pointer; font-size: 1.4rem; opacity: 0.6; transition: opacity 0.2s; z-index: 10;"
                    onmouseover="this.style.opacity='1'"
                    onmouseout="this.style.opacity='0.6'">
              <i class="fa-solid fa-xmark"></i>
            </button>

            <!-- Header -->
            <div style="margin-bottom: 3rem;">
              <h3 id="modal-title" style="margin: 0; color: #64ffda; font-size: 2rem; font-weight: 700; letter-spacing: -0.5px;">Yeni Malzeme Kaydı</h3>
              <p style="color: var(--text-dim); margin: 10px 0 0 0; font-size: 1rem; opacity: 0.6;">Sistem kayıtlarını yüksek hassasiyetle güncelleyin.</p>
            </div>

            <form id="add-material-form" onsubmit="window.handleWarehouseFormSubmit(event)">
              <input type="hidden" id="modal-warehouse-id">
              <input type="hidden" id="modal-item-id">
              
              <div style="display: grid; grid-template-columns: 1fr 220px; gap: 4rem; align-items: start;">
                <!-- Left Side -->
                <div style="display: flex; flex-direction: column; gap: 1.8rem;">
                  
                  <!-- SAP No -->
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.8px;">SAP NUMARASI</label>
                    <input type="text" id="modal-sap-no" required placeholder="�rn: 1002345" 
                           style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; transition: all 0.2s; box-sizing: border-box;"
                           onfocus="this.style.borderColor='#64ffda'; this.style.background='#1c2128'" onblur="this.style.borderColor='#30363d'; this.style.background='#161b22'"
                           oninput="window.handleSapInput(this.value)">
                  </div>

                  <!-- Description -->
                  <div>
                    <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.8px;">A�!IKLAMA / �SR�SN ADI</label>
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
                    <input type="text" id="modal-shelf" placeholder="�rn: A-12-3" 
                           style="width: 100%; height: 50px; background: #161b22; border: 1px solid #30363d; border-radius: 12px; color: white; padding: 0 18px; font-size: 1rem; outline: none; box-sizing: border-box;"
                           onfocus="this.style.borderColor='#64ffda'" onblur="this.style.borderColor='#30363d'">
                  </div>
                </div>

                <!-- Right Side -->
                <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                  <label style="display: block; color: #64ffda; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px;">MALZEME G�RSELİ</label>
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
          <div style="color: var(--text-main); font-weight: 700; font-size: 0.9rem;">��xe Seçildi</div>
        </div>
        <div style="width: 1px; height: 30px; background: rgba(255,255,255,0.1);"></div>
        <div style="display: flex; gap: 10px;">
          <button onclick="window.printBatchLabels()" class="btn-cyber" style="background: rgba(255, 193, 7, 0.1); color: var(--accent-yellow, #ffc107); padding: 8px 16px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(255, 193, 7, 0.2);">
            <i class="fa-solid fa-print" style="margin-right: 6px;"></i> TOPLU ETİKET YAZDIR
          </button>
          <button onclick="window.openBatchShelfModal()" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); padding: 8px 16px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(100, 255, 218, 0.2);">
            <i class="fa-solid fa-location-dot" style="margin-right: 6px;"></i> TOPLU KONUM G�SNCELLE
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
            <button onclick="window.navigate('warehouses')" class="action-icon-btn" style="width: 40px; height: 40px; border-radius: 12px; flex-shrink: 0;">
              <i class="fa-solid fa-arrow-left"></i>
            </button>
            <div>
              <h1 style="margin: 0; font-size: clamp(1.5rem, 2.5vw, 2.2rem); font-weight: 900; letter-spacing: -1px; color: var(--text-main);">${t?.name||`Depo`}</h1>
              <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem; font-weight: 500;">${t?.location||`Stok ve Envanter Yönetim Sistemi`}</p>
            </div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 0.8rem; flex-wrap: wrap; flex: 1; justify-content: flex-end;">
            <div style="position: relative; flex: 1 1 250px; max-width: 350px; min-width: 200px; display: flex; align-items: center;">
              <input type="text" id="inventory-search" placeholder="Parça veya SAP no ara..." 
                     value="${s||``}"
                     class="cyber-input-premium search-box-mini"
                     style="width: 100%; padding-right: 50px;"
                     onkeypress="if(event.key==='Enter') window.updateWarehouseUI(undefined, undefined, undefined, this.value)"
                     autofocus
                     onfocus="this.setSelectionRange(this.value.length, this.value.length)">
              <button onclick="window.updateWarehouseUI(undefined, undefined, undefined, document.getElementById('inventory-search').value)" 
                      style="position: absolute; right: 6px; width: 36px; height: 36px; background: var(--accent-blue); border: none; color: #0a1118; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; transition: all 0.2s;"
                      onmouseover="this.style.filter='brightness(1.1)';" 
                      onmouseout="this.style.filter='none';">
                <i class="fa-solid fa-magnifying-glass"></i>
              </button>
            </div>
            
            <button onclick="window.startQuickAudit('${e}')" class="btn-cyber" style="background: linear-gradient(135deg, #64ffda 0%, #48bb78 100%); color: #000; padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer; box-shadow: 0 4px 15px rgba(100, 255, 218, 0.2); flex-shrink: 0;">
              <i class="fa-solid fa-bolt" style="margin-right: 8px;"></i> HIZLI SAYIM
            </button>

            <button onclick="window.startQRScanner('${e}')" class="btn-cyber" style="background: rgba(100, 255, 218, 0.1); color: var(--accent-blue); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: 1px solid rgba(100, 255, 218, 0.2); cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-qrcode" style="margin-right: 8px;"></i> QR TARA
            </button>

            <button onclick="window.downloadExcel('${e}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-file-export" style="color: #2ecc71; margin-right: 8px;"></i> İNDİR
            </button>

            ${d?`
            <button onclick="window.triggerExcelUpload('${e}')" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: var(--text-main); padding: 10px 18px; border-radius: 10px; font-size: 0.75rem; font-weight: 800; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-file-import" style="color: var(--accent-blue); margin-right: 8px;"></i> Y�SKLE
            </button>
            `:``}

            ${f?`
            <div style="position: relative; display: inline-block; flex-shrink: 0;" id="admin-menu-container">
              <button onclick="const m = document.getElementById('admin-actions-menu'); if(m) m.style.display = m.style.display === 'none' ? 'block' : 'none';" 
                      class="btn-cyber" 
                      style="background: rgba(255,255,255,0.05); color: var(--text-dim); padding: 10px; border-radius: 10px; font-size: 0.9rem; border: none; cursor: pointer;">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
              <div id="admin-actions-menu" style="display: none; position: absolute; top: calc(100% + 8px); right: 0; background: #1a1a1a; border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; min-width: 220px; z-index: 1000; box-shadow: 0 10px 30px rgba(0,0,0,0.5); overflow: hidden;">
                <div style="padding: 10px 15px; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.65rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px;">Y�NETİCİ ARA�!LARI</div>
                
                <button onclick="window.clearLegacyLimits('${e}')" 
                        style="width: 100%; text-align: left; background: none; border: none; padding: 12px 15px; color: var(--text-main); cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255,255,255,0.03)'"
                        onmouseout="this.style.background='none'">
                  <i class="fa-solid fa-broom" style="color: var(--accent-blue); width: 16px;"></i>
                  <span>Eski Limitleri Temizle (5 Adet)</span>
                </button>

                <button onclick="window.resetWarehouse('${e}')" 
                        style="width: 100%; text-align: left; background: none; border: none; padding: 12px 15px; color: #ff4d4d; cursor: pointer; font-size: 0.75rem; display: flex; align-items: center; gap: 10px; transition: background 0.2s;"
                        onmouseover="this.style.background='rgba(255, 77, 77, 0.05)'"
                        onmouseout="this.style.background='none'">
                  <i class="fa-solid fa-trash-can" style="width: 16px;"></i>
                  <span>Depo Envanterini Sıfırla</span>
                </button>
              </div>
            </div>
            `:``}

            ${x?`
            <button onclick="window.openAddMaterialModal('${e}')" class="btn-cyber" style="background: #fff; color: #000; padding: 10px 24px; border-radius: 10px; font-weight: 900; font-size: 0.75rem; border: none; cursor: pointer; flex-shrink: 0;">
              <i class="fa-solid fa-plus"></i> YENİ EKLE
            </button>
            `:``}
          </div>
        </header>

        <!-- Stats Grid -->
        <div class="stats-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1.2rem; margin-bottom: 2rem;">
          <div class="stats-card">
            <div class="stats-label">Toplam Kalem</div>
            <div class="stats-value">${i.length}</div>
          </div>
          <div class="stats-card" style="border-left: 3px solid var(--danger);">
            <div class="stats-label" style="color: var(--danger);">Kritik Stok</div>
            <div class="stats-value" style="color: var(--danger);">${m.length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">Son İ�xlemler</div>
            <div class="stats-value">${g.length}</div>
          </div>
          <div class="stats-card">
            <div class="stats-label">Son Hareket</div>
            <div class="stats-value" style="font-size: 1.2rem;">${g.length>0?C(g[0].timestamp).split(` `)[1]:`-`}</div>
          </div>
          <div class="stats-card" style="background: rgba(100, 255, 218, 0.05); border-color: rgba(100, 255, 218, 0.1);">
            <div class="stats-label" style="color: var(--accent-blue);">Depo Durumu</div>
            <div class="stats-value" style="color: var(--accent-blue); font-size: 1.2rem;">AKTİF</div>
          </div>
        </div>

        <!-- Tab Switcher (Always Visible) -->
        <div style="display: flex; overflow-x: auto; max-width: 100%; -webkit-overflow-scrolling: touch; background: rgba(255,255,255,0.03); padding: 4px; border-radius: 12px; margin-bottom: 2rem; border: 1px solid rgba(255,255,255,0.05); gap: 4px;">
          <button onclick="window.changeTab('${e}', 'inventory')" class="premium-tab ${c===`inventory`?`active`:``}">
            <i class="fa-solid fa-layer-group"></i> ENVANTER
          </button>
          <button onclick="window.changeTab('${e}', 'history')" class="premium-tab ${c===`history`?`active`:``}">
            <i class="fa-solid fa-history"></i> GE�!MİŞ
          </button>
          <button onclick="window.changeTab('${e}', 'analytics')" class="premium-tab ${c===`analytics`?`active`:``}">
            <i class="fa-solid fa-chart-line"></i> ANALİZ
          </button>
          <button onclick="window.changeTab('${e}', 'audit')" class="premium-tab ${c===`audit`?`active`:``}">
            <i class="fa-solid fa-clipboard-check"></i> SAYIM
          </button>
          <button onclick="window.changeTab('${e}', 'audit_history')" class="premium-tab ${c===`audit_history`?`active`:``}">
            <i class="fa-solid fa-file-invoice"></i> SAYIM GE�!MİŞİ
          </button>
        </div>

        <div id="tab-content-root">
          ${c===`inventory`?`
            <!-- AI Banner -->
            <div class="ai-banner" style="margin-top: 1rem;">
              <div style="display: flex; align-items: center; gap: 1.5rem;">
                <div style="width: 48px; height: 48px; background: rgba(255, 77, 77, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: var(--danger);">
                  <i class="fa-solid fa-robot"></i>
                </div>
                <div>
                  <h4 style="margin: 0; color: var(--danger); letter-spacing: 1px; font-weight: 900; font-size: 0.9rem;">ENVANTER ANALİTİĞİ (AI)</h4>
                  <p style="margin: 4px 0 0 0; color: var(--text-dim); font-size: 0.85rem;">Şu an ${m.length} kalem malzeme kritik seviyenin altında. Sarf malzemeleri için sipari�x planlanması önerilir.</p>
                </div>
              </div>
              <button onclick="window.initiateOrderFlow('${e}')" class="btn-cyber" style="background: rgba(255, 77, 77, 0.1); border: 1px solid rgba(255, 77, 77, 0.2); color: var(--danger); padding: 10px 20px; border-radius: 10px; font-size: 0.75rem; font-weight: 900; border: none; cursor: pointer;">
                SİPARİŞ OLUŞTUR
              </button>
            </div>

            ${w.details.length>0?`
            <!-- Aktif Rezervasyonlar Kartı -->
            <div class="premium-card" style="padding: 1.5rem; margin-bottom: 1.5rem; border-radius: 20px; border-left: 4px solid #ff9800;">
              <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1rem;">
                <div style="display: flex; align-items: center; gap: 12px;">
                  <div style="width: 40px; height: 40px; background: rgba(255, 152, 0, 0.1); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #ff9800;">
                    <i class="fa-solid fa-bookmark"></i>
                  </div>
                  <div>
                    <h4 style="margin: 0; color: #ff9800; font-weight: 900; font-size: 0.85rem; letter-spacing: 1px;">AKTİF REZERVASYONLAR</h4>
                    <p style="margin: 2px 0 0 0; color: var(--text-dim); font-size: 0.75rem;">${w.details.length} görevde toplam ${Object.values(w.bySap).reduce((e,t)=>e+t,0)} adet malzeme rezerve edildi</p>
                  </div>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 10px;">
                ${w.details.map(e=>`
                  <div style="background: rgba(255, 152, 0, 0.04); border: 1px solid rgba(255, 152, 0, 0.1); border-radius: 14px; padding: 1rem 1.2rem;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px;">
                      <div style="display: flex; align-items: center; gap: 10px;">
                        <span style="background: rgba(255, 152, 0, 0.15); color: #ff9800; padding: 3px 10px; border-radius: 8px; font-size: 0.65rem; font-weight: 900;">${e.team}</span>
                        <span style="color: var(--text-main); font-weight: 800; font-size: 0.8rem;"><i class="fa-solid fa-wind" style="color: var(--accent-blue); margin-right: 5px; font-size: 0.7rem;"></i>${e.turbinNo}</span>
                        <span style="color: var(--text-dim); font-size: 0.7rem; font-weight: 600;">${e.sablon}</span>
                      </div>
                      <span style="background: ${e.durum===`Görev Teslim Edildi`?`rgba(100, 255, 218, 0.1)`:`rgba(255, 152, 0, 0.1)`;