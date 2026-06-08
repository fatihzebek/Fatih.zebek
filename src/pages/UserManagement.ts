import { userService } from '../services/UserService';
import { dataService } from '../services/DataService';
import { authService } from '../services/AuthService';
import { tsiService } from '../services/TsiService';


export const UserManagementPage = async () => {
  const users = await userService.getAllUsers();
  const tsiCategories = await tsiService.getCategories();
  
  const allTabs = [
    { id: 'dashboard', label: 'Gösterge Paneli' },
    { id: 'new-task', label: 'Yeni İş Emri' },
    { id: 'tasks', label: 'İş Emirleri' },
    { id: 'siparis', label: 'Sipariş Oluştur' },
    { id: 'analytics', label: 'Adam Saat Analizi' },
    { id: 'bakim-planlama', label: 'Bakım Planlama' },
    { id: 'turbines', label: 'Servis Bölgeleri' },
    { id: 'warehouses', label: 'Servis Depoları' },
    { id: 'templates', label: 'Arıza & Bakım Şablonları' },
    { id: 'transfers', label: 'Malzeme Transferi' },
    { id: 'global-history', label: 'Depo Hareketleri' },
    { id: 'reports-archive', label: 'Rapor Arşivi' },
    { id: 'bearing-analysis', label: 'Rulman Analiz Ajanı' },
    { id: 'tsi-library', label: 'Servis Teknik Information' },
    { id: 'users', label: 'Kullanıcı Yetkileri' },
    { id: 'MALZEME_YONETIMI', label: 'Malzeme Yönetimi' },
    { id: 'asset-custody', label: 'Malzeme Zimmeti' },
    { id: 'tickets-page', label: 'Saha Destek (Ticket)' }
  ];

  const baseBakimPlanlama = [{ id: 'editPlan', label: 'Plan Düzenleme / Oluşturma' }];
  (granularOptions as any)['bakim-planlama'] = [
    ...baseBakimPlanlama,
    ...dataService.getSites().map(s => ({ id: 'site_' + s.id, label: 'Saha: ' + s.name }))
  ];

  (granularOptions as any)['tsi-library'] = tsiCategories.map(c => ({ id: 'tsicat_' + c.id, label: 'Kategori: ' + c.name }));

  const baseWarehouses = [
    { id: 'addMaterial', label: 'Malzeme Ekleme' },
    { id: 'editMaterial', label: 'Malzeme Düzenleme' },
    { id: 'deleteMaterial', label: 'Malzeme Silme' },
    { id: 'uploadImage', label: 'Görsel Yükleme / Silme' },
    { id: 'countStock', label: 'Sayım Yapma / Stok Güncelleme' },
    { id: 'uploadExcel', label: 'Excel Rapor Yükleme' }
  ];
  (granularOptions as any)['warehouses'] = [
    ...baseWarehouses,
    ...dataService.getWarehouses().map(w => ({ id: 'wh_' + w.id, label: 'Depo: ' + w.name }))
  ];

  return `
    <div class="fade-in-up content-area">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
        <h1 class="page-title" style="margin-bottom: 0;"><i class="fa-solid fa-user-shield" style="color: var(--accent-cyan);"></i> Kullanıcı Yetkilendirme</h1>
        <button class="btn-cyber" onclick="window.openNewUserModal()">
          <i class="fa-solid fa-user-plus"></i> YENİ KULLANICI
        </button>
      </div>

      <div class="user-list-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
        ${users.length === 0 ? `
          <div class="glass-panel" style="padding: 4rem; text-align: center; color: var(--text-muted);">
            <i class="fa-solid fa-users-slash" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.2;"></i>
            <p>Henüz tanımlanmış alt kullanıcı bulunamadı.</p>
          </div>
        ` : [...users].sort((a, b) => {
            // Adminler en üste, diğerleri takım numarasına veya email sırasına göre
            if (a.role === 'ADMIN' && b.role !== 'ADMIN') return -1;
            if (b.role === 'ADMIN' && a.role !== 'ADMIN') return 1;
            return (a.email || '').localeCompare(b.email || '');
          }).map(user => {
          const tabCount = Array.isArray(user.allowedTabs) ? user.allowedTabs.length : Object.keys(user.allowedTabs || {}).length;
          const siteCount = user.allowedSites?.length || 0;
          const warehouseCount = user.allowedWarehouses?.length || 0;
          const isTeamLeader = user.managedTeams && user.managedTeams.length > 0;
          
          return `
            <div class="glass-panel user-row" style="display: flex; align-items: center; padding: 0.75rem 1.25rem; border: 1px solid rgba(255, 255, 255, 0.05); transition: var(--transition-smooth); gap: 1.5rem;">
              <!-- Profile Info -->
              <div style="display: flex; align-items: center; gap: 1rem; min-width: 250px;">
                <div class="user-avatar" style="width: 36px; height: 36px; font-size: 1rem; flex-shrink: 0;">
                  ${user.email[0].toUpperCase()}
                </div>
                <div style="overflow: hidden;">
                  <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.displayName || 'İsimsiz Kullanıcı'}</div>
                  <div style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${user.email}</div>
                </div>
              </div>

              <!-- Role -->
              <div style="min-width: 120px; display: flex; flex-direction: column; gap: 4px;">
                <span class="badge" style="background: rgba(51, 65, 85, 0.8); color: #93c5fd; font-size: 0.65rem; padding: 2px 10px; border: 1px solid rgba(147, 197, 253, 0.2); width: fit-content;">
                   ${user.role}
                </span>
                ${isTeamLeader ? `<span class="badge" style="background: rgba(249, 115, 22, 0.1); color: #f97316; font-size: 0.55rem; padding: 2px 8px; border: 1px solid rgba(249, 115, 22, 0.2); width: fit-content; letter-spacing: 1px; font-weight: 800;">EKİP LİDERİ</span>` : ''}
              </div>

              <!-- Permission Summary -->
              <div style="flex-grow: 1; font-size: 0.75rem; color: var(--text-muted); opacity: 0.7;">
                <i class="fa-solid fa-shield-halved" style="margin-right: 6px; font-size: 0.7rem; opacity: 0.5;"></i>
                Yetkiler: <span style="color: var(--text-main);">${tabCount} Sayfa</span> | <span style="color: var(--text-main);">${siteCount} Santral</span> | <span style="color: var(--text-main);">${warehouseCount} Depo</span>
              </div>

              <!-- Actions -->
              <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button class="action-icon-btn" onclick="window.editUserPermissions('${user.uid}')" title="Yetkileri Düzenle">
                  <i class="fa-solid fa-pencil"></i>
                </button>
                <button class="action-icon-btn red" onclick="window.deleteUser('${user.uid}')" title="Kullanıcıyı Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              </div>
            </div>
          `;
        }).join('')}
      </div>

      <style>
        .user-row:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(0, 242, 254, 0.2) !important;
          transform: translateX(4px);
        }
        .action-icon-btn {
          background: transparent;
          border: none;
          color: var(--text-muted);
          cursor: pointer;
          font-size: 1rem;
          padding: 8px;
          border-radius: 8px;
          transition: var(--transition-smooth);
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .action-icon-btn:hover {
          color: var(--accent-cyan);
          background: rgba(0, 242, 254, 0.1);
        }
        .action-icon-btn.red:hover {
          color: var(--accent-red);
          background: rgba(255, 0, 85, 0.1);
        }
      </style>
    </div>

    <!-- New User Modal -->
    <div id="new-user-modal" class="modal-overlay hidden">
      <div class="glass-panel modal-content" style="max-width: 450px; border: 1px solid var(--accent-cyan); box-shadow: 0 0 20px rgba(0, 242, 254, 0.2);">
        <div class="modal-header" style="background: linear-gradient(90deg, rgba(0, 242, 254, 0.1), transparent); padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(0, 242, 254, 0.2);">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 0.75rem; color: var(--accent-cyan); font-size: 1.2rem; letter-spacing: 1px;">
            <i class="fa-solid fa-user-plus"></i> YENİ KULLANICI TANIMLA
          </h3>
          <button class="close-btn" onclick="window.closeNewUserModal()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <div style="padding: 1.5rem;">
          <div class="form-grid" style="display: grid; gap: 1.25rem;">
            <div class="form-group">
              <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">KURUMSAL E-POSTA</label>
              <div style="position: relative;">
                <i class="fa-solid fa-envelope" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                <input type="email" id="new-user-email" class="cyber-input" placeholder="ornek@demirer.com" style="padding-left: 2.5rem;" required>
              </div>
            </div>

            <div class="form-group">
              <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">TAM AD SOYAD</label>
              <div style="position: relative;">
                <i class="fa-solid fa-signature" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                <input type="text" id="new-user-name" class="cyber-input" placeholder="Ad Soyad" style="padding-left: 2.5rem;" required>
              </div>
            </div>

            <div class="modal-grid-2col">
              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">SİSTEM ROLÜ</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-shield-halved" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; pointer-events: none;"></i>
                  <select id="new-user-role" class="cyber-input" style="padding-left: 2.5rem;">
                    <option value="TECHNICIAN">TECHNICIAN</option>
                    <option value="MALZEME_YONETIMI">MALZEME YÖNETİMİ</option>
                    <option value="ADMIN">ADMIN</option>
                    <option value="GUEST">GUEST</option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">ŞİFRE</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-key" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                  <input type="text" id="new-user-pass" class="cyber-input" placeholder="Şifre" style="padding-left: 2.5rem;" required>
                </div>
              </div>
            </div>
            
            <div class="form-group" style="margin-top: 1.25rem;">
              <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">ATANAN SAHA EKİBİ</label>
              <div style="position: relative;">
                <i class="fa-solid fa-users" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem; pointer-events: none;"></i>
                <select id="new-user-team" class="cyber-input" style="padding-left: 2.5rem;">
                  <option value="">Ekip Yok (Tüm Görevleri Görür)</option>
                  ${Array.from({length: 15}, (_, i) => {
                    const t = `Team ${String(i + 1).padStart(2, '0')}`;
                    return `<option value="${t}">Team ${String(i + 1).padStart(2, '0')}</option>`;
                  }).join('')}
                </select>
              </div>
            </div>
          </div>

          <div style="margin-top: 2rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05); display: flex; gap: 1rem;">
            <button class="btn-cyber-outline" style="flex: 1;" onclick="window.closeNewUserModal()">VAZGEÇ</button>
            <button class="btn-cyber" style="flex: 2; justify-content: center;" onclick="window.saveNewUser()">
              KAYDI TAMAMLA <i class="fa-solid fa-check-double" style="margin-left: 0.5rem;"></i>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Enterprise Permission Edit Modal -->
    <div id="permission-modal" class="modal-overlay hidden">
      <div class="permission-modal-container">
        <!-- Modal Header -->
        <div class="permission-modal-header">
          <div>
            <h3 id="modal-title" class="permission-modal-title">KULLANICI YETKİLERİ</h3>
            <p class="permission-modal-subtitle">Yetkilendirme ve Güvenlik Yönetimi</p>
          </div>
          <button class="permission-modal-close" onclick="window.closePermissionModal()">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <!-- Enterprise Tabs -->
        <div class="permission-modal-tabs">
          <button class="permission-tab-btn active" onclick="window.switchPermissionTab('modules', this)">
            <i class="fa-solid fa-layer-group opacity-70"></i> Modüller
          </button>
          <button class="permission-tab-btn" onclick="window.switchPermissionTab('teams', this)">
            <i class="fa-solid fa-users opacity-70"></i> Ekipler
          </button>
          <button class="permission-tab-btn" onclick="window.switchPermissionTab('access', this)">
            <i class="fa-solid fa-map-location-dot opacity-70"></i> Tesis & Depo
          </button>
          <button class="permission-tab-btn" onclick="window.switchPermissionTab('security', this)">
            <i class="fa-solid fa-shield-halved opacity-70"></i> Güvenlik
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="permission-modal-body">
          
          <!-- Tab 1: Module Permissions (Accordion) -->
          <div id="tab-modules" class="tab-content">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${allTabs.map(tab => {
                const subPerms = (granularOptions as any)[tab.id] || [];
                return `
                  <div class="permission-accordion-card">
                    <div class="permission-accordion-header" onclick="window.togglePermissionAccordion('${tab.id}', this)">
                      <div class="permission-accordion-title-container">
                        <i class="fa-solid fa-layer-group permission-accordion-icon"></i>
                        <span class="permission-accordion-title">${tab.label}</span>
                      </div>
                      <div class="permission-accordion-actions">
                        <label class="cyber-switch" onclick="event.stopPropagation()">
                          <input type="checkbox" name="tab-perm" value="${tab.id}" onchange="window.handleMainPermChange('${tab.id}', this)">
                          <span class="cyber-switch-slider"></span>
                        </label>
                        ${subPerms.length > 0 ? `<i class="fa-solid fa-chevron-down accordion-arrow"></i>` : ''}
                      </div>
                    </div>
                    
                    ${subPerms.length > 0 ? `
                      <div class="permission-accordion-content">
                        <div class="permission-subgrid">
                          ${subPerms.map((sub: any) => `
                            <div class="permission-sub-card sub-perm-item">
                              <span class="permission-sub-label">${sub.label}</span>
                              <label class="cyber-switch">
                                <input type="checkbox" name="sub-perm-${tab.id}" value="${sub.id}">
                                <span class="cyber-switch-slider"></span>
                              </label>
                            </div>
                          `).join('')}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Tab 1.5: Managed Teams -->
          <div id="tab-teams" class="tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label class="permission-label-header">YÖNETİLEN ALT EKİPLER</label>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">Bu kullanıcıya atanan alt ekipleri seçin. Takım lideri, bu ekiplerin görevlerini de kendi ekranında görebilecektir.</p>
              <div id="managed-teams-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                <!-- Dynamically populated in editUserPermissions -->
              </div>
            </div>
          </div>

          <!-- Tab 2: Site & Warehouse Permissions -->
          <div id="tab-access" class="tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
              <!-- Site Multi-Select -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label class="permission-label-header">ERİŞİLEBİLİR SANTRALLER</label>
                <div style="position: relative;">
                   <div id="site-badges" class="permission-badge-container"
                        onclick="document.getElementById('site-search-input').focus()">
                     <input type="text" id="site-search-input" class="permission-search-input" placeholder="Santral ara ve seç...">
                   </div>
                   <div id="site-dropdown" class="permission-dropdown hidden"></div>
                </div>
              </div>

              <!-- Warehouse Multi-Select -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label class="permission-label-header">ERİŞİLEBİLİR DEPOLAR</label>
                <div style="position: relative;">
                   <div id="warehouse-badges" class="permission-badge-container"
                        onclick="document.getElementById('warehouse-search-input').focus()">
                     <input type="text" id="warehouse-search-input" class="permission-search-input" placeholder="Depo ara ve seç...">
                   </div>
                   <div id="warehouse-dropdown" class="permission-dropdown hidden"></div>
                </div>
              </div>

              <!-- Atanan Saha Ekibi -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label class="permission-label-header">ATANAN SAHA EKİBİ</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-users" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #8b949e; pointer-events: none; z-index: 5;"></i>
                  <select id="edit-user-team" class="cyber-input" style="padding-left: 2.75rem; width: 100%; box-sizing: border-box; background: #161b22; border: 1px solid #30363d; color: #fff; border-radius: 12px; height: 48px;">
                    <option value="">Ekip Yok (Tüm Görevleri Görür)</option>
                    ${Array.from({length: 15}, (_, i) => {
                      const t = `Team ${String(i + 1).padStart(2, '0')}`;
                      return `<option value="${t}">Team ${String(i + 1).padStart(2, '0')}</option>`;
                    }).join('')}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 3: Security -->
          <div id="tab-security" class="tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 1rem; max-width: 400px;">
               <div style="padding: 1rem; border-radius: 12px; background: rgba(249, 115, 22, 0.05); border: 1px solid rgba(249, 115, 22, 0.2); display: flex; gap: 12px; align-items: flex-start; margin-bottom: 1.5rem;">
                 <i class="fa-solid fa-triangle-exclamation" style="color: #f97316; margin-top: 2px;"></i>
                 <p style="font-size: 0.75rem; color: rgba(254, 215, 170, 0.7); line-height: 1.5; margin: 0;">Güvenlik gereği şifreler şifrelenmiş olarak tutulur. Yeni bir şifre belirlediğinizde eski şifre geçersiz kalacaktır.</p>
               </div>
               <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                 <label class="permission-label-header">YENİ ERİŞİM ŞİFRESİ</label>
                 <div style="position: relative;">
                   <i class="fa-solid fa-key" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #8b949e;"></i>
                   <input type="text" id="edit-user-pass" class="cyber-input" style="padding-left: 2.75rem; font-family: monospace;" placeholder="Güçlü bir şifre girin...">
                 </div>
               </div>
            </div>
          </div>

        </div>

        <!-- Modal Footer -->
        <div class="permission-modal-footer" style="padding: 1rem 1.5rem; background: #161b22; border-top: 1px solid #30363d; display: flex; justify-content: flex-end; gap: 12px;">
          <button class="btn-cancel" onclick="window.closePermissionModal()">İPTAL</button>
          <button id="save-permissions-btn" class="btn-save">
            KAYDET <i class="fa-solid fa-floppy-disk text-xs opacity-70"></i>
          </button>
        </div>
      </div>
    </div>
    
    <style>
      /* Permission Modal Custom Cyber-Luxury Styles */
      .permission-modal-container {
        background: #0d1117;
        border: 1px solid #30363d;
        border-radius: 16px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px rgba(0, 243, 255, 0.05);
        width: 100%;
        max-width: 650px;
        margin: auto;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 85vh;
      }
      
      .permission-modal-header {
        padding: 1.25rem 1.5rem;
        border-bottom: 1px solid #30363d;
        display: flex;
        justify-content: space-between;
        align-items: center;
        background: #161b22;
      }
      
      .permission-modal-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: #ffffff;
        margin: 0;
        letter-spacing: 1px;
        text-transform: uppercase;
        font-family: 'Rajdhani', sans-serif;
      }
      
      .permission-modal-subtitle {
        font-size: 0.65rem;
        color: #8b949e;
        margin: 4px 0 0 0;
        text-transform: uppercase;
        letter-spacing: 1.5px;
      }
      
      .permission-modal-close {
        background: transparent;
        border: none;
        color: #8b949e;
        cursor: pointer;
        padding: 6px;
        border-radius: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .permission-modal-close:hover {
        background: rgba(255, 255, 255, 0.05);
        color: #ffffff;
      }
      
      /* Tabs */
      .permission-modal-tabs {
        display: flex;
        background: rgba(0, 0, 0, 0.2);
        border-bottom: 1px solid #30363d;
        padding: 6px 16px 0;
        gap: 8px;
      }
      
      .permission-tab-btn {
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #8b949e;
        padding: 10px 16px;
        font-size: 0.85rem;
        font-weight: 700;
        cursor: pointer;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .permission-tab-btn:hover {
        color: #ffffff;
      }
      
      .permission-tab-btn.active {
        color: #00f3ff;
        border-bottom: 2px solid #00f3ff;
        text-shadow: 0 0 10px rgba(0, 243, 255, 0.3);
      }
      
      /* Body */
      .permission-modal-body {
        flex: 1;
        overflow-y: auto;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      
      /* Accordion cards */
      .permission-accordion-card {
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        margin-bottom: 10px;
      }
      
      .permission-accordion-card:hover {
        border-color: rgba(0, 243, 255, 0.2);
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
      }
      
      .permission-accordion-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 1rem 1.25rem;
        cursor: pointer;
        user-select: none;
      }
      
      .permission-accordion-header:hover {
        background: rgba(255, 255, 255, 0.02);
      }
      
      .permission-accordion-title-container {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .permission-accordion-icon {
        color: #00f3ff;
        opacity: 0.6;
        font-size: 1rem;
      }
      
      .permission-accordion-title {
        font-size: 0.85rem;
        font-weight: 700;
        color: #c9d1d9;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      
      .permission-accordion-actions {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      
      .accordion-arrow {
        color: #8b949e;
        font-size: 0.75rem;
        transition: transform 0.3s ease;
      }
      
      .rotate-180 {
        transform: rotate(180deg);
      }
      
      /* Beautiful Custom Switch */
      .cyber-switch {
        position: relative;
        display: inline-block;
        width: 42px;
        height: 22px;
      }
      
      .cyber-switch input {
        opacity: 0;
        width: 0;
        height: 0;
      }
      
      .cyber-switch-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #374151;
        transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 34px;
      }
      
      .cyber-switch-slider:before {
        position: absolute;
        content: "";
        height: 16px;
        width: 16px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
      }
      
      .cyber-switch input:checked + .cyber-switch-slider {
        background-color: #10b981; /* beautiful emerald green switch */
        box-shadow: 0 0 8px rgba(16, 185, 129, 0.4);
      }
      
      .cyber-switch input:checked + .cyber-switch-slider:before {
        transform: translateX(20px);
      }
      
      /* Accordion Content & Subgrid */
      .permission-accordion-content {
        max-height: 0;
        opacity: 0;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        background: rgba(0, 0, 0, 0.15);
      }
      
      .permission-subgrid {
        padding: 1rem 1.25rem;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        border-top: 1px solid #30363d;
      }
      
      .permission-sub-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1c2128;
        padding: 10px 12px;
        border-radius: 8px;
        border: 1px solid rgba(48, 54, 61, 0.5);
        transition: all 0.2s ease;
      }
      
      .permission-sub-card:hover {
        border-color: rgba(0, 243, 255, 0.15);
        background: rgba(28, 33, 40, 0.8);
      }
      
      .permission-sub-label {
        font-size: 0.75rem;
        font-weight: 600;
        color: #8b949e;
      }
      
      /* Multi-select dropdown chips */
      .permission-label-header {
        font-size: 0.65rem;
        font-weight: 800;
        color: #8b949e;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        margin-bottom: 8px;
        display: block;
      }
      
      .permission-badge-container {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        padding: 10px;
        min-height: 48px;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        transition: all 0.2s ease;
        cursor: text;
        align-items: center;
      }
      
      .permission-badge-container:focus-within {
        border-color: rgba(0, 243, 255, 0.4);
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.1);
      }
      
      .permission-search-input {
        background: transparent;
        border: none;
        outline: none;
        font-size: 0.85rem;
        color: #ffffff;
        min-width: 120px;
        flex: 1;
      }
      
      .permission-search-input::placeholder {
        color: #484f58;
      }
      
      .permission-dropdown {
        position: absolute;
        z-index: 100;
        left: 0;
        right: 0;
        margin-top: 8px;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 12px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        max-height: 200px;
        overflow-y: auto;
      }
      
      .permission-dropdown-item {
        padding: 10px 16px;
        font-size: 0.85rem;
        color: #c9d1d9;
        cursor: pointer;
        transition: all 0.2s ease;
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
      }
      
      .permission-dropdown-item:hover {
        background: rgba(0, 243, 255, 0.05);
        color: #00f3ff;
      }
      
      .mini-chip {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 4px 10px;
        border-radius: 8px;
        font-size: 11px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      
      .site-chip {
        background: rgba(0, 242, 254, 0.1);
        border: 1px solid rgba(0, 242, 254, 0.3);
        color: #00f2fe;
      }
      
      .warehouse-chip {
        background: rgba(168, 85, 247, 0.1);
        border: 1px solid rgba(168, 85, 247, 0.3);
        color: #a855f7;
      }
      
      /* Footer Buttons */
      .btn-cancel {
        background: #ffffff;
        color: #0d1117;
        border: none;
        padding: 10px 24px;
        border-radius: 9999px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      
      .btn-cancel:hover {
        background: #e6e6e6;
        transform: translateY(-1px);
      }
      
      .btn-save {
        background: linear-gradient(135deg, #06b6d4, #0891b2);
        color: #ffffff;
        border: none;
        padding: 10px 28px;
        border-radius: 9999px;
        font-size: 0.85rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        display: flex;
        align-items: center;
        gap: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: 0 4px 14px rgba(6, 182, 212, 0.3);
      }
      
      .btn-save:hover {
        background: linear-gradient(135deg, #0891b2, #0e7490);
        box-shadow: 0 6px 20px rgba(6, 182, 212, 0.4);
        transform: translateY(-1px);
      }
    </style>
  `;
}

// LOGIC
(window as any).openNewUserModal = () => {
  document.getElementById('new-user-modal')?.classList.remove('hidden');
};

(window as any).closeNewUserModal = () => {
  document.getElementById('new-user-modal')?.classList.add('hidden');
};

(window as any).togglePasswordVisibility = (uid: string, pass: string) => {
  const display = document.getElementById(`pass-display-${uid}`);
  const icon = document.getElementById(`pass-icon-${uid}`);
  if (!display || !icon) return;

  if (display.textContent === '••••••') {
    display.textContent = pass;
    icon.classList.replace('fa-eye', 'fa-eye-slash');
  } else {
    display.textContent = '••••••';
    icon.classList.replace('fa-eye-slash', 'fa-eye');
  }
};

(window as any).saveNewUser = async () => {
  const emailInput = document.getElementById('new-user-email') as HTMLInputElement;
  const nameInput = document.getElementById('new-user-name') as HTMLInputElement;
  const roleInput = document.getElementById('new-user-role') as HTMLSelectElement;
  const passInput = document.getElementById('new-user-pass') as HTMLInputElement;
  const teamInput = document.getElementById('new-user-team') as HTMLSelectElement;

  if (!emailInput.value || !nameInput.value || !passInput.value) {
    alert('Lütfen tüm alanları doldurun.');
    return;
  }

  if (passInput.value.length < 6) {
    alert('Şifre en az 6 karakter olmalıdır.');
    return;
  }

  try {
    // 1. Firebase Authentication'da kullanıcı oluştur
    //    İkincil app kullanarak mevcut admin oturumunu bozmaz
    (window as any).showToast('İşlem', 'Firebase hesabı oluşturuluyor...', 'info');
    const firebaseUid = await authService.createAuthUser(emailInput.value, passInput.value);

    // 2. Firestore profilini Firebase Auth uid ile oluştur
    const tabsArray = roleInput.value === 'MALZEME_YONETIMI' ? ['warehouses', 'reports-archive'] : ['dashboard', 'tasks'];
    const allowedTabs: Record<string, any> = {};
    tabsArray.forEach(t => allowedTabs[t] = true);

    const newUser = {
      uid: firebaseUid,
      email: emailInput.value,
      displayName: nameInput.value,
      role: roleInput.value as any,
      password: passInput.value,
      allowedTabs,
      allowedSites: [],
      allowedWarehouses: [],
      team: teamInput?.value || ''
    };

    await userService.saveProfile(newUser);
    (window as any).showToast('Başarılı', 'Kullanıcı hem Firebase Auth hem Firestore\'da oluşturuldu. Artık e-posta/şifre ile giriş yapabilir.', 'success');
    (window as any).closeNewUserModal();
    (window as any).navigate('users');
  } catch (error: any) {
    console.error("Kullanıcı oluşturma hatası:", error);
    let errorMsg = error instanceof Error ? error.message : 'Bilinmeyen hata.';
    if (errorMsg.includes('email-already-in-use')) {
      errorMsg = 'Bu e-posta adresi zaten Firebase Authentication\'da kayıtlı.';
    } else if (errorMsg.includes('weak-password')) {
      errorMsg = 'Şifre çok zayıf. En az 6 karakter kullanın.';
    } else if (errorMsg.includes('invalid-email')) {
      errorMsg = 'Geçersiz e-posta formatı.';
    }
    (window as any).showToast('Hata', 'Kullanıcı oluşturulamadı: ' + errorMsg, 'error');
  }
};

(window as any).deleteUser = async (uid: string) => {
  if (confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) {
    try {
      await userService.deleteUser(uid);
      (window as any).showToast('Bilgi', 'Kullanıcı silindi.', 'info');
      (window as any).navigate('users');
    } catch (e) {
      (window as any).showToast('Hata', 'Kullanıcı silinemedi.', 'error');
    }
  }
};

const granularOptions = {
  'warehouses': [
    { id: 'addMaterial', label: 'Malzeme Ekleme' },
    { id: 'editMaterial', label: 'Malzeme Düzenleme' },
    { id: 'deleteMaterial', label: 'Malzeme Silme' },
    { id: 'uploadImage', label: 'Görsel Yükleme / Silme' },
    { id: 'countStock', label: 'Sayım Yapma / Stok Güncelleme' },
    { id: 'uploadExcel', label: 'Excel Rapor Yükleme' }
  ],
  'tasks': [
    { id: 'createTask', label: 'Yeni İş Emri Oluşturma' },
    { id: 'deleteTask', label: 'İş Emri Silme' },
    { id: 'completeTask', label: 'İş Emri Tamamlama / Kapatma' },
    { id: 'transferTask', label: 'Görev Transfer Etme (Devir)' }
  ],
  'bakim-planlama': [
    { id: 'editPlan', label: 'Plan Düzenleme / Oluşturma' }
  ],
  'reports-archive': [
    { id: 'downloadPdf', label: 'PDF İndirme / Dışa Aktarma' },
    { id: 'editReport', label: 'Rapor Düzenleme' },
    { id: 'deleteReport', label: 'Rapor Silme' },
    { id: 'returnReport', label: 'Ekibe Geri Gönder' },
    { id: 'useAi', label: 'Yapay Zeka Analizi Kullanımı' }
  ]
};

(window as any).togglePermissionAccordion = (_tabId: string, header: HTMLElement) => {
  const content = header.nextElementSibling as HTMLElement;
  const arrow = header.querySelector('.accordion-arrow');
  if (!content) return;
  
  const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
  
  // Close others (Optional, but cleaner)
  document.querySelectorAll('.permission-accordion-content').forEach((el: any) => {
    el.style.maxHeight = '0px';
    el.style.opacity = '0';
    el.previousElementSibling.querySelector('.accordion-arrow')?.classList.remove('rotate-180');
  });

  if (!isExpanded) {
    content.style.maxHeight = '500px';
    content.style.opacity = '1';
    arrow?.classList.add('rotate-180');
  }
};

(window as any).handleMainPermChange = (tabId: string, input: HTMLInputElement) => {
  const accordion = input.closest('.permission-accordion-card');
  const subContainer = accordion?.querySelector('.permission-accordion-content');
  if (!subContainer) return;
  
  const subItems = subContainer.querySelectorAll('.permission-sub-card');
  const subChecks = subContainer.querySelectorAll('input[type="checkbox"]');
  
  if (input.checked) {
    subItems.forEach((item: any) => item.classList.remove('opacity-30', 'pointer-events-none'));
    
    // Only expand if it's currently collapsed
    const content = subContainer as HTMLElement;
    const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
    if (!isExpanded) {
      (window as any).togglePermissionAccordion(tabId, accordion?.querySelector('.permission-accordion-header') as HTMLElement);
    }
  } else {
    subItems.forEach((item: any) => item.classList.add('opacity-30', 'pointer-events-none'));
    subChecks.forEach((cb: any) => {
      (cb as HTMLInputElement).checked = false;
    });
  }
};

(window as any).switchPermissionTab = (tabId: string, btn: HTMLElement) => {
  document.querySelectorAll('.tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
  document.querySelectorAll('.permission-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

(window as any).selectedSites = [];
(window as any).selectedWarehouses = [];

(window as any).togglePermissionItem = (type: 'site' | 'warehouse', id: string, name: string) => {
  const list = type === 'site' ? (window as any).selectedSites : (window as any).selectedWarehouses;
  const index = list.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    list.push({ id, name });
  } else {
    list.splice(index, 1);
  }
  
  (window as any).renderPermissionBadges(type);
  (window as any).renderPermissionOptions(type);
  document.getElementById(`${type}-dropdown`)?.classList.add('hidden');
};

(window as any).renderPermissionBadges = (type: 'site' | 'warehouse') => {
  const container = document.getElementById(`${type}-badges`);
  const list = type === 'site' ? (window as any).selectedSites : (window as any).selectedWarehouses;
  const input = document.getElementById(`${type}-search-input`);
  
  if (!container || !input) return;
  
  container.querySelectorAll('.mini-chip').forEach(b => b.remove());
  
  list.forEach((item: any) => {
    const chip = document.createElement('div');
    chip.className = `mini-chip ${type === 'site' ? 'site-chip' : 'warehouse-chip'}`;
    chip.innerHTML = `${item.name} <i class="fa-solid fa-circle-xmark cursor-pointer opacity-50 hover:opacity-100 ml-1" onclick="event.stopPropagation(); window.togglePermissionItem('${type}', '${item.id}', '${item.name}')"></i>`;
    container.insertBefore(chip, input);
  });
};

(window as any).renderPermissionOptions = (type: 'site' | 'warehouse', query: string = '') => {
  const dropdown = document.getElementById(`${type}-dropdown`);
  if (!dropdown) return;

  const fullList = type === 'site' ? dataService.getSites() : dataService.getWarehouses();
  const selectedList = type === 'site' ? (window as any).selectedSites : (window as any).selectedWarehouses;
  const selectedIds = selectedList.map((i: any) => i.id);

  const availableItems = fullList.filter(item => 
    !selectedIds.includes(item.id) && 
    item.name.toLowerCase().includes(query.toLowerCase())
  );

  if (availableItems.length === 0) {
    dropdown.innerHTML = `<div style="padding: 12px 16px; font-size: 0.75rem; color: #8b949e; font-style: italic;">Sonuç bulunamadı veya tümü seçildi.</div>`;
  } else {
    dropdown.innerHTML = availableItems.map(item => `
      <div class="permission-dropdown-item" 
           onclick="window.togglePermissionItem('${type}', '${item.id}', '${item.name}')">
        ${item.name}
      </div>
    `).join('');
  }
};

(window as any).editUserPermissions = async (uid: string) => {
  const users = await userService.getAllUsers();
  const user = users.find(u => u.uid === uid);
  if (!user) return;

  const modal = document.getElementById('permission-modal');
  const saveBtn = document.getElementById('save-permissions-btn');
  const sites = dataService.getSites();
  const warehouses = dataService.getWarehouses();
  
  if (!modal || !saveBtn) return;

  const userPerms = user.allowedTabs || {};

  // Populate Modules & Sub-perms
  modal.querySelectorAll('input[name="tab-perm"]').forEach((cb: any) => {
    const tabId = (cb as HTMLInputElement).value;
    const hasAccess = !!userPerms[tabId];
    (cb as HTMLInputElement).checked = hasAccess;
    
    // Sub-perms
    const accordion = cb.closest('.permission-accordion-card');
    const subContainer = accordion?.querySelector('.permission-accordion-content');
    if (subContainer) {
      const subItems = subContainer.querySelectorAll('.permission-sub-card');
      if (!hasAccess) {
        subItems.forEach((item: any) => item.classList.add('opacity-30', 'pointer-events-none'));
      } else {
        subItems.forEach((item: any) => item.classList.remove('opacity-30', 'pointer-events-none'));
      }

      subContainer.querySelectorAll('input[type="checkbox"]').forEach((subCb: any) => {
        const subId = (subCb as HTMLInputElement).value;
        if (subId.startsWith('site_')) {
          const actualSiteId = subId.replace('site_', '');
          subCb.checked = (user.allowedSites || []).includes(actualSiteId);
        } else if (subId.startsWith('wh_')) {
          const actualWhId = subId.replace('wh_', '');
          subCb.checked = (user.allowedWarehouses || []).includes(actualWhId);
        } else if (subId.startsWith('tsicat_')) {
          const actualCatId = subId.replace('tsicat_', '');
          subCb.checked = (user.allowedTsiCategories || []).includes(actualCatId);
        } else {
          subCb.checked = typeof userPerms[tabId] === 'object' && !!userPerms[tabId][subId];
        }
      });
    }

  });

  (window as any).selectedSites = (user.allowedSites || []).map(id => ({ id, name: sites.find(s => s.id === id)?.name || id }));
  (window as any).selectedWarehouses = (user.allowedWarehouses || []).map(id => ({ id, name: warehouses.find(w => w.id === id)?.name || id }));

  (window as any).renderPermissionBadges('site');
  (window as any).renderPermissionBadges('warehouse');
  (window as any).renderPermissionOptions('site');
  (window as any).renderPermissionOptions('warehouse');

  (document.getElementById('edit-user-pass') as HTMLInputElement).value = user.password || '';
  (document.getElementById('edit-user-team') as HTMLSelectElement).value = user.team || '';

  // Populate Managed Teams
  const managedContainer = document.getElementById('managed-teams-container');
  if (managedContainer) {
    const userManaged = user.managedTeams || [];
    managedContainer.innerHTML = Array.from({length: 15}, (_, i) => {
      const t = `Team ${String(i + 1).padStart(2, '0')}`;
      const checked = userManaged.includes(t) ? 'checked' : '';
      return `
        <label class="cyber-checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
          <input type="checkbox" name="managed-team" value="${t}" ${checked} class="cyber-checkbox">
          <span>${t}</span>
        </label>
      `;
    }).join('');
  }

  ['site', 'warehouse'].forEach(type => {
    const input = document.getElementById(`${type}-search-input`) as HTMLInputElement;
    const dropdown = document.getElementById(`${type}-dropdown`);
    input.onfocus = () => {
       (window as any).renderPermissionOptions(type, input.value);
       dropdown?.classList.remove('hidden');
    };
    input.oninput = (e) => {
      const q = (e.target as HTMLInputElement).value;
      (window as any).renderPermissionOptions(type as any, q);
      dropdown?.classList.remove('hidden');
    };
  });

  modal.classList.remove('hidden');

  saveBtn.onclick = async () => {
    try {
      const allowedTabs: Record<string, any> = {};
      
      const allowedTsiCategories: string[] = [];

      modal.querySelectorAll('input[name="tab-perm"]:checked').forEach((cb: any) => {
        const tabId = (cb as HTMLInputElement).value;
        const perms: Record<string, any> = { access: true };
        
        const accordion = cb.closest('.permission-accordion-card');
        const subContainer = accordion?.querySelector('.permission-accordion-content');
        if (subContainer) {
          subContainer.querySelectorAll('input:checked').forEach((subCb: any) => {
            const subId = (subCb as HTMLInputElement).value;
            if (subId.startsWith('tsicat_')) {
              allowedTsiCategories.push(subId.replace('tsicat_', ''));
            } else if (!subId.startsWith('site_') && !subId.startsWith('wh_')) {
               perms[subId] = true;
            }
          });
          
          allowedTabs[tabId] = perms;
        } else {
          allowedTabs[tabId] = true; // Simple access
        }
      });

      // Populate sites and warehouses dynamically from selected access tab state (bug fix)
      const siteSelections: string[] = ((window as any).selectedSites || []).map((s: any) => s.id);
      const warehouseSelections: string[] = ((window as any).selectedWarehouses || []).map((w: any) => w.id);
      const teamSelection = (document.getElementById('edit-user-team') as HTMLSelectElement)?.value || '';
      
      const managedTeamSelections: string[] = Array.from(modal.querySelectorAll('input[name="managed-team"]:checked')).map((cb: any) => cb.value);

      await userService.updatePermissions(user.uid, {
        allowedTabs,
        allowedSites: siteSelections,
        allowedWarehouses: warehouseSelections,
        password: (document.getElementById('edit-user-pass') as HTMLInputElement).value,
        team: teamSelection,
        managedTeams: managedTeamSelections,
        allowedTsiCategories
      });

      (window as any).showToast('Başarılı', 'Kullanıcı yetkileri güncellendi.', 'success');
      (window as any).closePermissionModal();
      
      // Update local state instead of reloading
      (window as any).navigate('users'); // This will trigger a re-render of the users list
    } catch (error) {
      console.error(error);
      (window as any).showToast('Hata', 'Yetkiler kaydedilemedi: ' + error, 'error');
    }
  };
};

(window as any).closePermissionModal = () => {
  document.getElementById('permission-modal')?.classList.add('hidden');
};
