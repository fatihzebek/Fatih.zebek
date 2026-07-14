export const TurbineDetailModal = (): string => {
  return `
    <div id="turbine-modal" class="modal-overlay hidden" style="display: none; z-index: 99999;">
      <div class="modal-content glass-panel">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="modal-icon-container">
              <i class="fa-solid fa-wind"></i>
            </div>
            <div>
              <h2 class="modal-title">TÜRBİN DETAYI</h2>
              <div id="modal-turbine-title" class="modal-subtitle">---</div>
            </div>
          </div>
          <button onclick="window.closeTurbineDetails()" class="modal-close-btn">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div class="modal-tabs">
          <button class="turbine-tab-btn active" onclick="window.switchTurbineTab('tasks')"><i class="fa-solid fa-list-check"></i> İŞ EMİRLERİ</button>
          <button class="turbine-tab-btn" onclick="window.switchTurbineTab('materials')"><i class="fa-solid fa-boxes-stacked"></i> MALZEMELER</button>
          <button class="turbine-tab-btn" onclick="window.switchTurbineTab('reports')"><i class="fa-solid fa-file-pdf"></i> ARŞİV</button>
          <button class="turbine-tab-btn" onclick="window.switchTurbineTab('deficiencies')"><i class="fa-solid fa-triangle-exclamation"></i> EKSİKLER</button>
          <button class="turbine-tab-btn" onclick="window.switchTurbineTab('notes')"><i class="fa-solid fa-note-sticky"></i> NOTLAR</button>
          <button class="turbine-tab-btn" onclick="window.switchTurbineTab('reminders')"><i class="fa-solid fa-bell"></i> HATIRLATICILAR</button>
        </div>

        <div class="modal-body-scrollable">
          <div id="turbine-modal-loading" class="modal-loader-overlay">
            <i class="fa-solid fa-circle-notch fa-spin fa-3x"></i>
          </div>

          <div id="tab-tasks" class="turbine-tab-content">
            <h3 class="tab-section-title">Aktif ve Tamamlanan Görevler</h3>
            <div id="modal-tasks-list" class="task-list-container"></div>
          </div>
          
          <div id="tab-materials" class="turbine-tab-content hidden">
             <h3 class="tab-section-title">Değişen Parçalar</h3>
             <div class="table-responsive" style="overflow-x: auto;">
               <table class="data-table" style="width: 100%; border-collapse: collapse;">
                 <thead>
                   <tr style="border-bottom: 2px solid rgba(255,255,255,0.1);">
                     <th style="padding: 0.75rem 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Tarih</th>
                     <th style="padding: 0.75rem 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Rapor / MÇF No</th>
                     <th style="padding: 0.75rem 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Malzeme / Seri No</th>
                     <th style="padding: 0.75rem 0.5rem; text-align: left; font-size: 0.8rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Açıklama</th>
                     <th style="padding: 0.75rem 0.5rem; text-align: center; font-size: 0.8rem; font-weight: 700; color: #94A3B8; text-transform: uppercase;">Miktar</th>
                   </tr>
                 </thead>
                 <tbody id="modal-materials-list"></tbody>
               </table>
             </div>
           </div>
          
          <div id="tab-reports" class="turbine-tab-content hidden">
            <div id="reports-list-container">
              <h3 class="tab-section-title">Geçmiş Raporlar</h3>
              <div id="modal-reports-list" class="report-list-container"></div>
            </div>
            <div id="pdf-viewer-container" class="hidden">
              <div class="pdf-viewer-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 id="pdf-viewer-title" style="margin: 0; color: var(--accent-cyan);">Rapor Görüntüleyici</h3>
                <button onclick="window.closeTurbinePdf()" class="cyber-button secondary" style="padding: 4px 12px; font-size: 0.8rem;"><i class="fa-solid fa-arrow-left"></i> LİSTEYE DÖN</button>
              </div>
              <div id="pdf-iframe" style="background: white; color: black; padding: 2rem; border-radius: 8px; max-height: 65vh; overflow-y: auto; overflow-x: auto; font-size: 14px;"></div>
            </div>
          </div>

          <div id="tab-deficiencies" class="turbine-tab-content hidden">
            <h3 class="tab-section-title">Eksik Takibi</h3>
            <div id="modal-deficiencies-list"></div>
          </div>

          <div id="tab-notes" class="turbine-tab-content hidden">
             <h3 class="tab-section-title">Notlar & To-Do</h3>
             
             <!-- Note Input Group with Image Upload -->
             <div class="note-input-group" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px;">
               <div style="display: flex; gap: 0.5rem; align-items: center;">
                 <input type="text" id="new-turbine-note-input" class="cyber-input" placeholder="Yeni bir not veya to-do ekle..." style="flex: 1;">
                 
                 <!-- Hidden Image File Input -->
                 <input type="file" id="note-image-input" accept="image/*" style="display: none;" onchange="window.handleNoteImageSelect(this)">
                 
                 <!-- Trigger Button -->
                 <button onclick="document.getElementById('note-image-input').click()" class="cyber-button secondary" style="padding: 0.5rem 0.85rem; height: 42px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; font-size: 0.85rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer;" title="Resim Ekle">
                   <i class="fa-solid fa-camera" style="font-size: 1.1rem; color: var(--accent-cyan);"></i>
                 </button>
                 
                 <!-- Add Button -->
                 <button id="add-note-btn" onclick="window.addTurbineNote()" class="btn-cyber" style="min-width: 100px; height: 42px; font-weight: bold; letter-spacing: 1px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer;"><i class="fa-solid fa-plus"></i> EKLE</button>
               </div>
               
               <!-- Image Preview Container -->
               <div id="note-image-preview-container" class="hidden" style="position: relative; display: inline-block; max-width: 120px; border-radius: 8px; overflow: hidden; border: 1px solid var(--accent-cyan); box-shadow: 0 0 10px rgba(0,242,255,0.2); margin-top: 0.25rem;">
                 <img id="note-image-preview" src="" style="width: 100%; display: block; max-height: 120px; object-fit: cover;">
                 <button onclick="window.clearNoteImage()" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); border: none; color: #ff4d4d; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem;">&times;</button>
               </div>
             </div>
             
             <div id="modal-notes-list"></div>
           </div>

            <div id="tab-reminders" class="turbine-tab-content hidden">
              <h3 class="tab-section-title">Hatırlatıcılar</h3>
              
              <!-- Reminder Input Group -->
              <div class="reminder-input-group" style="display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 1.5rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 12px;">
                <div style="display: grid; grid-template-columns: 1fr auto; gap: 0.75rem; align-items: start;">
                  <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; gap: 0.5rem; align-items: center;">
                      <input type="text" id="new-turbine-reminder-input" class="cyber-input" placeholder="Hatırlatma notu yazın..." style="flex: 1;">
                      
                      <!-- Hidden Image File Input for Reminders -->
                      <input type="file" id="reminder-image-input" accept="image/*" style="display: none;" onchange="window.handleReminderImageSelect(this)">
                      
                      <!-- Trigger Button -->
                      <button onclick="document.getElementById('reminder-image-input').click()" class="cyber-button secondary" style="padding: 0.5rem 0.85rem; height: 42px; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; font-size: 0.85rem; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #fff; cursor: pointer;" title="Resim Ekle">
                        <i class="fa-solid fa-camera" style="font-size: 1.1rem; color: var(--accent-cyan);"></i>
                      </button>
                    </div>
                    <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                      <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-dim);">Hatırlatma Tarihi:</span>
                        <input type="date" id="new-turbine-reminder-date" class="cyber-input" style="width: 150px; height: 32px; font-size: 0.8rem; padding: 0.25rem 0.5rem; color: white;">
                      </div>
                      <div style="display: flex; gap: 0.5rem; align-items: center;">
                        <span style="font-size: 0.75rem; color: var(--text-dim);">Öncelik:</span>
                        <select id="new-turbine-reminder-priority" class="cyber-input" style="width: 110px; height: 32px; font-size: 0.8rem; padding: 0.25rem 0.5rem; background: rgba(15,23,42,0.95); border: 1px solid rgba(255,255,255,0.08); color: white;">
                          <option value="LOW">Düşük</option>
                          <option value="MEDIUM">Orta</option>
                          <option value="CRITICAL">Kritik</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <button id="add-reminder-btn" onclick="window.addTurbineReminder()" class="btn-cyber" style="min-width: 100px; height: 42px; font-weight: bold; letter-spacing: 1px; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; cursor: pointer; align-self: center;">
                    <i class="fa-solid fa-plus"></i> EKLE
                  </button>
                </div>
                
                <!-- Image Preview Container for Reminders -->
                <div id="reminder-image-preview-container" class="hidden" style="position: relative; display: inline-block; max-width: 120px; border-radius: 8px; overflow: hidden; border: 1px solid var(--accent-cyan); box-shadow: 0 0 10px rgba(0,242,255,0.2); margin-top: 0.25rem;">
                  <img id="reminder-image-preview" src="" style="width: 100%; display: block; max-height: 120px; object-fit: cover;">
                  <button onclick="window.clearReminderImage()" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.7); border: none; color: #ff4d4d; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; cursor: pointer; font-size: 0.75rem;">&times;</button>
                </div>
              </div>
              
              <div id="modal-reminders-list" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 40vh; overflow-y: auto; padding-right: 4px;"></div>
            </div>
        </div>
      </div>
    </div>
  `;
};
