import { userService } from '../services/UserService';
import { dataService } from '../services/DataService';
import { authService } from '../services/AuthService';
import { tsiService } from '../services/TsiService';
import { personnelService } from '../services/PersonnelService';
import { formatDisplayName } from '../utils/formatters';


export const UserManagementPage = async () => {
  const users = await userService.getAllUsers();
  const tsiCategories = await tsiService.getCategories();

  setTimeout(() => {
    const searchInput = document.getElementById('search-users-input') as HTMLInputElement;
    if (searchInput) {
      searchInput.removeAttribute('readonly');
      searchInput.value = '';
      (window as any).filterUsersList('');
    }
  }, 200);
  
  const allTabs = [
    { id: 'dashboard', label: 'Gösterge Paneli (Dashboard)' },
    { id: 'tasks', label: 'İş Emirleri' },
    { id: 'turbines', label: 'Servis Bölgeleri' },
    { id: 'warehouses', label: 'Servis Depoları' },
    { id: 'team_warehouses', label: 'Ekiplerin Zimmetleri' },
    { id: 'siparis', label: 'Malzeme Sipariş Formu' },
    { id: 'reports-archive', label: 'Rapor Arşivi' },
    { id: 'transfers', label: 'Malzeme Transfer Talebi' },
    { id: 'bearing-analysis', label: 'Rulman Analiz Ajanı' },
    { id: 'tsi-library', label: 'Servis Teknik Information' },
    { id: 'bakim-planlama', label: 'Bakım Planlama' },
    { id: 'users', label: 'Kullanıcı Yetkileri' },
    { id: 'scada-reset-logs', label: 'SCADA Reset Günlükleri' },
    { id: 'parameter-audit', label: 'Parametre Denetimi' },
    { id: 'leave-management', label: 'İzin Yönetimi' },
    { id: 'MALZEME_YONETIMI', label: 'Malzeme Yönetimi' },
    { id: 'asset-custody', label: 'Malzeme Zimmeti' },
    { id: 'tickets-page', label: 'Saha Destek (Ticket)' },
    { id: 'image-pool', label: 'Görsel Ürün Tarama' },
    { id: 'kkd-kontrol', label: 'KKD Muayene Takip' },
    { id: 'olcu-aletleri', label: 'Ölçü Aletleri Kalibrasyon' },
    { id: 'tork-aletleri', label: 'Tork Aletleri Kalibrasyon' },
    { id: 'fault-library', label: 'Arıza Çözüm Kütüphanesi' }
  ];

  (granularOptions as any)['tsi-library'] = [
    { id: 'aiAgent', label: 'Yapay Zeka Asistanı (Ajan) Yetkisi' },
    ...tsiCategories.map(c => ({ id: 'tsicat_' + c.id, label: 'Kategori: ' + c.name }))
  ];
  setTimeout(() => {
    if (typeof (window as any).renderPersonnelManagementList === 'function') {
      (window as any).renderPersonnelManagementList();
    }
  }, 150);

  const currentUserProfile = (window as any).currentUser;
  const isCurrentUserAdmin = currentUserProfile?.role === 'ADMIN';
  const usersPerm = currentUserProfile?.allowedTabs?.users || {};
  const canEdit = isCurrentUserAdmin || (typeof usersPerm === 'object' && !!usersPerm.editPermissions);
  const canDelete = isCurrentUserAdmin || (typeof usersPerm === 'object' && !!usersPerm.deleteUser);
  const canCreate = isCurrentUserAdmin || (typeof usersPerm === 'object' && !!usersPerm.createUser);

  const getTeamNumber = (u: any): number => {
    const email = (u.email || '').toLowerCase();
    const matchEmail = email.match(/tm(\d+)/);
    if (matchEmail && matchEmail[1]) return parseInt(matchEmail[1], 10);
    const displayName = (u.displayName || '').toLowerCase();
    const matchName = displayName.match(/(?:team\s*|tm\s*)(\d+)/);
    if (matchName && matchName[1]) return parseInt(matchName[1], 10);
    return 99999;
  };

  // Grouping users hierarchically
  const admins = users.filter(u => u.role === 'ADMIN');
  const managers = users
    .filter(u => 
      (u.role === 'MALZEME_YONETIMI' || u.role === 'TAMİR' || (u.managedTeams && u.managedTeams.length > 0)) && u.role !== 'ADMIN'
    )
    .sort((a, b) => {
      const numA = getTeamNumber(a);
      const numB = getTeamNumber(b);
      if (numA !== numB) return numA - numB;
      if (a.role !== b.role) return (a.role || '').localeCompare(b.role || '');
      return (a.email || '').localeCompare(b.email || '');
    });

  const technicians = users
    .filter(u => u.role === 'TECHNICIAN' && !(u.managedTeams && u.managedTeams.length > 0))
    .sort((a, b) => {
      const numA = getTeamNumber(a);
      const numB = getTeamNumber(b);
      if (numA !== numB) return numA - numB;
      return (a.email || '').localeCompare(b.email || '');
    });
  const guests = users.filter(u => u.role === 'GUEST' || u.role === 'USER');

  const renderUserCard = (user: any) => {
    const tabCount = Array.isArray(user.allowedTabs) ? user.allowedTabs.length : Object.keys(user.allowedTabs || {}).length;
    const siteCount = user.allowedSites?.length || 0;
    const warehouseCount = user.allowedWarehouses?.length || 0;
    const isTeamLeader = user.managedTeams && user.managedTeams.length > 0;
    
    const isOnline = user.status === 'online' && (Date.now() - (user.last_active || 0) < 5 * 60 * 1000);
    
    const formatLastActive = (timestamp?: number) => {
      if (!timestamp) return 'Hiç aktif olmadı';
      const diff = Date.now() - timestamp;
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return 'Az önce aktif';
      if (mins < 60) return `${mins} dk önce`;
      const hours = Math.floor(mins / 60);
      if (hours < 24) return `${hours} saat önce`;
      const days = Math.floor(hours / 24);
      return `${days} gün önce`;
    };

    return `
      <div class="glass-panel user-row" style="display: flex; align-items: center; padding: 0.75rem 1.25rem; border: 1px solid rgba(255, 255, 255, 0.05); transition: var(--transition-smooth); gap: 1.5rem; position: relative;">
        <!-- Profile Info -->
        <div style="display: flex; align-items: center; gap: 1rem; width: 320px; flex-shrink: 0;">
          <div class="user-avatar" style="width: 36px; height: 36px; font-size: 1rem; flex-shrink: 0; background: ${user.role === 'ADMIN' ? 'linear-gradient(135deg, #ffd700 0%, #b8860b 100%)' : 'rgba(255,255,255,0.05)'}; color: ${user.role === 'ADMIN' ? '#000' : '#fff'}; font-weight: 800; display: flex; align-items: center; justify-content: center; border-radius: 50%; position: relative;">
            ${(user.email || 'U')[0].toUpperCase()}
            ${isOnline ? `
              <span class="online-indicator-dot" style="position: absolute; right: -2px; bottom: -2px; width: 11px; height: 11px; background: #10b981; border: 2px solid #0d1117; border-radius: 50%; display: block; box-shadow: 0 0 8px rgba(16, 185, 129, 0.6);" title="Çevrimiçi (Online)"></span>
            ` : ''}
          </div>
          <div style="overflow: hidden;">
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.9rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${formatDisplayName(user.displayName || user.email || '') || 'İsimsiz Kullanıcı'}</div>
            <div style="font-size: 0.7rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: flex; align-items: center; gap: 6px;">
              <span>${user.email}</span>
              ${user.last_active ? `<span>•</span> <span style="opacity: 0.7; font-size: 0.65rem;" title="Son Görülme"><i class="fa-regular fa-clock" style="font-size: 0.6rem; margin-right: 2px;"></i>${formatLastActive(user.last_active)}</span>` : ''}
            </div>
          </div>
        </div>

        <!-- Role -->
        <div style="width: 180px; flex-shrink: 0; display: flex; flex-direction: column; gap: 4px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            ${(() => {
              let rText = user.role || '';
              let badgeStyle = 'background: rgba(51, 65, 85, 0.8); color: #93c5fd; border: 1px solid rgba(147, 197, 253, 0.2);';
              if (user.role === 'ADMIN') {
                rText = 'ADMIN';
                badgeStyle = 'background: rgba(253, 224, 71, 0.15); color: #fde047; border: 1px solid rgba(253, 224, 71, 0.3);';
              } else if (user.role === 'MALZEME_YONETIMI') {
                rText = 'AMBAR';
              } else if (user.role === 'TAMİR') {
                rText = 'ATÖLYE';
              } else if (user.role === 'USER') {
                rText = 'KULLANICI';
                badgeStyle = 'background: rgba(0, 242, 254, 0.08); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.2);';
              } else if (user.role === 'GUEST') {
                rText = 'MİSAFİR';
              }
              return `<span class="badge" style="${badgeStyle} font-size: 0.65rem; padding: 2px 10px; width: fit-content; font-weight: 700;">${rText}</span>`;
            })()}
          </div>
          ${isTeamLeader ? `<span class="badge" style="background: rgba(249, 115, 22, 0.1); color: #f97316; font-size: 0.55rem; padding: 2px 8px; border: 1px solid rgba(249, 115, 22, 0.2); width: fit-content; letter-spacing: 1px; font-weight: 800;">EKİP LİDERİ</span>` : ''}
        </div>

        <!-- Permission Summary -->
        <div style="flex-grow: 1; font-size: 0.75rem; color: var(--text-muted); opacity: 0.7; min-width: 180px;">
          <i class="fa-solid fa-shield-halved" style="margin-right: 6px; font-size: 0.7rem; opacity: 0.5;"></i>
          Yetkiler: <span style="color: var(--text-main);">${tabCount} Sayfa</span> | <span style="color: var(--text-main);">${siteCount} Santral</span> | <span style="color: var(--text-main);">${warehouseCount} Depo</span>
        </div>

        <!-- Actions -->
        <div style="display: flex; gap: 1rem; align-items: center; justify-content: flex-end; width: 180px; flex-shrink: 0;">
          ${user.role !== 'ADMIN' && canEdit ? `
            <!-- On/Off Switch -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="user-status-label-${user.uid}" style="font-size: 0.65rem; font-weight: 800; color: ${user.isActive !== false ? '#10b981' : '#ff4d4d'}; letter-spacing: 0.5px; width: 42px; text-align: right;">
                ${user.isActive !== false ? 'AKTİF' : 'PASİF'}
              </span>
              <label class="cyber-switch">
                <input type="checkbox" ${user.isActive !== false ? 'checked' : ''} onchange="window.toggleUserActiveStatus('${user.uid}', this)">
                <span class="cyber-switch-slider"></span>
              </label>
            </div>
          ` : ''}
          ${canEdit ? `
            <button class="action-icon-btn" onclick="window.editUserPermissions('${user.uid}')" title="Yetkileri Düzenle">
              <i class="fa-solid fa-pencil"></i>
            </button>
          ` : ''}
          ${canDelete && user.role !== 'ADMIN' ? `
            <button class="action-icon-btn red" onclick="window.deleteUser('${user.uid}')" title="Kullanıcıyı Sil">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          ` : ''}
        </div>
      </div>
    `;
  };

  return `
    <div class="fade-in-up content-area">
      <style>
        .content-area button[onclick="window.openNewUserModal()"].btn-cyber {
          background: rgba(0, 242, 255, 0.06) !important;
          border: 1px solid rgba(0, 242, 255, 0.25) !important;
          color: #00f2ff !important;
          min-height: unset !important;
          height: 38px !important;
          padding: 0 16px !important;
          border-radius: 6px !important;
          font-family: 'Rajdhani', sans-serif !important;
          font-weight: 800 !important;
          font-size: 0.75rem !important;
          transition: all 0.2s !important;
          display: inline-flex !important;
          align-items: center !important;
          justify-content: center !important;
          gap: 6px !important;
          letter-spacing: 0.5px !important;
          text-transform: uppercase !important;
          box-shadow: none !important;
          cursor: pointer !important;
        }
        .content-area button[onclick="window.openNewUserModal()"].btn-cyber:hover {
          background: rgba(0, 242, 255, 0.15) !important;
          border-color: rgba(0, 242, 255, 0.5) !important;
          color: #fff !important;
          box-shadow: 0 0 12px rgba(0, 242, 255, 0.1) !important;
        }
      </style>
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h1 class="page-title" style="margin-bottom: 0;"><i class="fa-solid fa-user-shield" style="color: var(--accent-cyan);"></i> Kullanıcı Yetkilendirme</h1>
        ${canCreate ? `
          <div style="display: flex; gap: 10px;">
            <button class="btn-cyber" onclick="window.openNewUserModal()">
              <i class="fa-solid fa-user-plus"></i> YENİ KULLANICI
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Search Bar -->
      <div style="position: relative; margin-bottom: 2rem; max-width: 400px;">
        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: var(--text-muted); opacity: 0.6; font-size: 0.9rem;"></i>
        <input type="search" id="search-users-input" name="cyber-quick-filter" readonly autocomplete="new-password" class="cyber-input" placeholder="Kullanıcı adı veya e-posta ara..." style="padding-left: 2.75rem; width: 100%; height: 42px; border-radius: 8px; font-size: 0.85rem;" oninput="window.filterUsersList(this.value)">
      </div>

      <div style="display: flex; flex-direction: column; gap: 2rem;">
        
        <!-- Tier 1: Admins -->
        ${admins.length > 0 ? `
          <div class="user-tier-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: #ffd700; border-bottom: 1px solid rgba(253, 224, 71, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-crown" style="font-size: 0.9rem;"></i> SİSTEM SAHİBİ VE ÜST YÖNETİCİLER (ADMIN)
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; border-left: 2px dashed rgba(253, 224, 71, 0.2); padding-left: 1rem;">
              ${admins.map(renderUserCard).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Tier 2: Managers & Coordinators -->
        ${managers.length > 0 ? `
          <div class="user-tier-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: var(--accent-cyan); border-bottom: 1px solid rgba(0, 243, 255, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-users-gear" style="font-size: 0.9rem;"></i> DEPARTMAN YÖNETİCİLERİ & EKİP LİDERLERİ
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; border-left: 2px dashed rgba(0, 243, 255, 0.2); padding-left: 1rem;">
              ${managers.map(renderUserCard).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Tier 3: Technicians -->
        ${technicians.length > 0 ? `
          <div class="user-tier-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: #10b981; border-bottom: 1px solid rgba(16, 185, 129, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-screwdriver-wrench" style="font-size: 0.9rem;"></i> SAHA TEKNİSYENLERİ
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; border-left: 2px dashed rgba(16, 185, 129, 0.2); padding-left: 1rem;">
              ${technicians.map(renderUserCard).join('')}
            </div>
          </div>
        ` : ''}

        <!-- Tier 4: Guests -->
        ${guests.length > 0 ? `
          <div class="user-tier-container" style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.05rem; color: #9ca3af; border-bottom: 1px solid rgba(156, 163, 175, 0.15); padding-bottom: 0.5rem;">
              <i class="fa-solid fa-user-tag" style="font-size: 0.9rem;"></i> OFİS KULLANICILARI
            </div>
            <div style="display: flex; flex-direction: column; gap: 0.5rem; border-left: 2px dashed rgba(156, 163, 175, 0.2); padding-left: 1rem;">
              ${guests.map(renderUserCard).join('')}
            </div>
          </div>
        ` : ''}
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
      <div class="permission-modal-container" style="max-width: 650px; width: 95%;">
        <!-- Modal Header -->
        <div class="permission-modal-header" style="background: linear-gradient(90deg, rgba(0, 242, 254, 0.1), transparent); padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(0, 242, 254, 0.2);">
          <h3 style="margin: 0; font-family: 'Rajdhani', sans-serif; display: flex; align-items: center; gap: 0.75rem; color: var(--accent-cyan); font-size: 1.2rem; letter-spacing: 1px;">
            <i class="fa-solid fa-user-plus"></i> YENİ KULLANICI TANIMLA
          </h3>
          <button class="permission-modal-close" onclick="window.closeNewUserModal()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        
        <!-- Modal Tabs -->
        <div class="permission-modal-tabs">
          <button type="button" class="new-permission-tab-btn active" onclick="window.switchNewPermissionTab('account', this)">
            <i class="fa-solid fa-user-gear opacity-70"></i> Hesap
          </button>
          <button type="button" class="new-permission-tab-btn" onclick="window.switchNewPermissionTab('modules', this)">
            <i class="fa-solid fa-layer-group opacity-70"></i> Modüller
          </button>
          <button type="button" class="new-permission-tab-btn" onclick="window.switchNewPermissionTab('teams', this)">
            <i class="fa-solid fa-users opacity-70"></i> Ekipler
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="permission-modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; max-height: calc(85vh - 140px); min-height: 200px;">
          
          <!-- Tab 0: Basic Credentials -->
          <div id="new-tab-account" class="new-tab-content">
            <div style="display: flex; flex-direction: column; gap: 1.25rem;">
              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">E-POSTA VEYA KULLANICI ADI</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-user" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                  <input type="text" id="new-user-email" class="cyber-input" placeholder="ornek@demirer.com veya kullanıcı adı" style="padding-left: 2.5rem;" required>
                </div>
              </div>

              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">TAM AD SOYAD</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-signature" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                  <input type="text" id="new-user-name" class="cyber-input" placeholder="Ad Soyad" style="padding-left: 2.5rem;" required>
                </div>
              </div>

              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">KULLANICI ŞİFRESİ</label>
                <div style="position: relative; display: flex; align-items: center;">
                  <i class="fa-solid fa-key" style="position: absolute; left: 12px; color: var(--text-muted); font-size: 0.8rem; pointer-events: none;"></i>
                  <input type="password" id="new-user-pass" class="cyber-input" placeholder="••••••••" style="padding-left: 2.5rem; padding-right: 2.5rem; width: 100%; box-sizing: border-box;" required>
                  <button type="button" onclick="window.toggleNewUserPasswordVisibility()" style="position: absolute; right: 12px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;" title="Şifreyi Göster/Gizle">
                    <i class="fa-solid fa-eye" id="new-user-pass-eye"></i>
                  </button>
                </div>
              </div>

              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">ROL / SEVİYE</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-id-card-clip" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                  <select id="new-user-role" class="cyber-input" style="padding-left: 2.5rem; width: 100%; box-sizing: border-box;">
                    <option value="TECHNICIAN">Teknisyen / Saha Ekibi</option>
                    <option value="USER">Kullanıcı (Ofis)</option>
                    <option value="MALZEME_YONETIMI">Malzeme Yönetimi / Ambar Sorumlusu</option>
                    <option value="TAMİR">Atölye Sorumlusu</option>
                    <option value="GUEST">Misafir / İzleyici</option>
                    <option value="ADMIN">Yönetici / Admin</option>
                  </select>
                </div>
              </div>

              <div class="form-group">
                <label class="permission-label" style="margin-bottom: 0.5rem; display: block;">ATANAN SAHA EKİBİ (OPSİYONEL)</label>
                <div style="position: relative;">
                  <i class="fa-solid fa-users" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.8rem;"></i>
                  <select id="new-user-team" class="cyber-input" style="padding-left: 2.5rem; width: 100%; box-sizing: border-box;">
                    <option value="">Ekip Yok (Tüm Görevleri Görür)</option>
                    ${Array.from({length: 15}, (_, i) => {
                      const t = `Team ${String(i + 1).padStart(2, '0')}`;
                      return `<option value="${t}">${t}</option>`;
                    }).join('')}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <!-- Tab 1: Modules (Accordions) -->
          <div id="new-tab-modules" class="new-tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${allTabs.map(tab => {
                const subPerms = (granularOptions as any)[tab.id] || [];
                const hasSubs = ['turbines', 'warehouses', 'team_warehouses'].includes(tab.id) || subPerms.length > 0;
                return `
                  <div class="permission-accordion-card">
                    <div class="permission-accordion-header" onclick="window.togglePermissionAccordion('${tab.id}', this)">
                      <div class="permission-accordion-title-container">
                        <i class="fa-solid fa-layer-group permission-accordion-icon"></i>
                        <span class="permission-accordion-title">${tab.label}</span>
                      </div>
                      <div class="permission-accordion-actions">
                        <label class="cyber-switch" onclick="event.stopPropagation()">
                          <input type="checkbox" name="new-tab-perm" value="${tab.id}" onchange="window.handleMainPermChange('${tab.id}', this)">
                          <span class="cyber-switch-slider"></span>
                        </label>
                        ${hasSubs ? `<i class="fa-solid fa-chevron-down accordion-arrow"></i>` : ''}
                      </div>
                    </div>
                    
                    ${renderGranularSubPermissions(tab.id, 'new')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Tab 2: Managed Teams -->
          <div id="new-tab-teams" class="new-tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              <label class="permission-label-header">YÖNETİLEN ALT EKİPLER</label>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 1rem;">Bu kullanıcıya atanan alt ekipleri seçin. Takım lideri, bu ekiplerin görevlerini de kendi ekranında görebilecektir.</p>
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                ${Array.from({length: 15}, (_, i) => {
                  const t = `Team ${String(i + 1).padStart(2, '0')}`;
                  return `
                    <label class="cyber-checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer;">
                      <input type="checkbox" name="new-managed-team" value="${t}" class="cyber-checkbox">
                      <span>${t}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            </div>
          </div>
        </div>

        <div class="permission-modal-footer" style="padding: 1rem 1.5rem; background: #161b22; border-top: 1px solid #30363d; display: flex; justify-content: flex-end; gap: 12px; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px; align-items: center;">
          <button class="btn-cancel" onclick="window.closeNewUserModal()">VAZGEÇ</button>
          <button class="btn-save" onclick="window.saveNewUser()">
            KAYDI TAMAMLA <i class="fa-solid fa-check-double text-xs opacity-70"></i>
          </button>
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
            <p id="modal-subtitle" class="permission-modal-subtitle">Yetkilendirme ve Güvenlik Yönetimi</p>
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
          <button class="permission-tab-btn" onclick="window.switchPermissionTab('security', this)">
            <i class="fa-solid fa-shield-halved opacity-70"></i> Güvenlik
          </button>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="permission-modal-body" style="flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 12px; max-height: calc(85vh - 140px); min-height: 200px;">
          
          <!-- Tab 1: Modules -->
          <div id="tab-modules" class="tab-content">
            <!-- Search Modules Input -->
            <div style="position: relative; margin-bottom: 1.25rem;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--text-muted); opacity: 0.6; font-size: 0.8rem;"></i>
              <input type="text" id="permission-modules-search" class="cyber-input" placeholder="Modül veya yetki ara..." style="padding-left: 2.5rem; width: 100%; height: 38px; border-radius: 8px; font-size: 0.85rem; background: #161b22; border: 1px solid rgba(0, 242, 254, 0.2);" oninput="window.filterPermissionModules(this.value)">
            </div>
            <div id="permission-modules-list" style="display: flex; flex-direction: column; gap: 8px;">
              ${allTabs.map(tab => {
                const subPerms = (granularOptions as any)[tab.id] || [];
                const hasSubs = ['turbines', 'warehouses', 'team_warehouses'].includes(tab.id) || subPerms.length > 0;
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
                        ${hasSubs ? `<i class="fa-solid fa-chevron-down accordion-arrow"></i>` : ''}
                      </div>
                    </div>
                    
                    ${renderGranularSubPermissions(tab.id, 'edit')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>

          <!-- Tab 1.5: Managed Teams & Assigned Team -->
          <div id="tab-teams" class="tab-content hidden">
            <div style="display: flex; flex-direction: column; gap: 1.5rem;">
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

              <!-- Yönetilen Alt Ekipler -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                <label class="permission-label-header">YÖNETİLEN ALT EKİPLER</label>
                <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 0.5rem;">Bu kullanıcıya atanan alt ekipleri seçin. Takım lideri, bu ekiplerin görevlerini de kendi ekranında görebilecektir.</p>
                <div id="managed-teams-container" style="display: flex; flex-direction: column; gap: 0.5rem;">
                  <!-- Dynamically populated in editUserPermissions -->
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
                 <div style="display: flex; justify-content: space-between; align-items: center;">
                   <label class="permission-label-header" style="margin-bottom: 0;">YENİ ERİŞİM ŞİFRESİ</label>
                   <button type="button" class="btn-cyber-mini" style="font-size: 0.65rem; padding: 2px 8px; height: auto;" onclick="window.generateAndFillPassword('edit-user-pass')">ŞİFRE ÜRET</button>
                 </div>
                 <div style="position: relative; display: flex; align-items: center;">
                   <i class="fa-solid fa-key" style="position: absolute; left: 16px; color: #8b949e; pointer-events: none;"></i>
                   <input type="password" id="edit-user-pass" class="cyber-input" style="padding-left: 2.75rem; padding-right: 2.5rem; width: 100%; box-sizing: border-box; font-family: monospace;" placeholder="Güçlü bir şifre girin veya üretin...">
                   <button type="button" onclick="window.toggleEditUserPasswordVisibility()" style="position: absolute; right: 12px; background: transparent; border: none; color: var(--text-muted); cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px;" title="Şifreyi Göster/Gizle">
                     <i class="fa-solid fa-eye" id="edit-user-pass-eye"></i>
                   </button>
                 </div>
               </div>
               <!-- Account Status (Non-Admin only) -->
               <div id="edit-user-active-container" style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1rem;">
                 <label class="permission-label-header">HESAP DURUMU</label>
                 <label class="cyber-checkbox-label" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(0,0,0,0.2); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05); cursor: pointer; user-select: none;">
                   <input type="checkbox" id="edit-user-active-checkbox" class="cyber-checkbox" onchange="document.getElementById('edit-user-active-text').innerText = this.checked ? 'Hesap Aktif (Kullanıcı giriş yapabilir)' : 'Hesap Pasif (Giriş engellendi)'">
                   <span id="edit-user-active-text" style="font-size: 0.8rem; font-weight: 700;">Hesap Aktif</span>
                 </label>
               </div>
            </div>
          </div>

        </div>

        <div class="permission-modal-footer" style="padding: 1rem 1.5rem; background: #161b22; border-top: 1px solid #30363d; display: flex; justify-content: flex-end; gap: 12px; align-items: center;">
          <button class="btn-cancel" onclick="window.closePermissionModal()">İPTAL</button>
          <button id="save-permissions-btn" class="btn-save">
            KAYDET <i class="fa-solid fa-floppy-disk text-xs opacity-70"></i>
          </button>
        </div>
      </div>
    </div>

    <!-- Preset Templates Manager Modal -->
    <div id="preset-templates-modal" class="modal-overlay hidden">
      <div class="permission-modal-container" style="max-height: 85vh; display: flex; flex-direction: column;">
        <!-- Modal Header -->
        <div class="permission-modal-header" style="flex-shrink: 0;">
          <div>
            <h3 class="permission-modal-title">YETKİ ŞABLONLARINI YÖNET</h3>
            <p class="permission-modal-subtitle">Görev ve Rollerin Standart Yetki Paketlerini Belirleyin</p>
          </div>
          <button class="permission-modal-close" onclick="window.closePresetTemplatesModal()">
            <i class="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        <!-- Role Selector -->
        <div style="padding: 1rem 1.5rem; background: rgba(0,0,0,0.2); border-bottom: 1px solid #30363d; display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
          <span style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 0.85rem; color: var(--accent-cyan); margin: 0;">DÜZENLENECEK ŞABLON:</span>
          <select id="preset-template-role-select" class="cyber-input" style="height: 38px; font-size: 0.8rem; padding: 0 10px; width: 220px; background: #161b22; border: 1px solid var(--accent-cyan); color: #fff; border-radius: 8px; font-weight: 700; cursor: pointer;" onchange="window.loadPresetTemplateToManager(this.value)">
            <option value="" disabled selected>Şablon Seçin...</option>
            <option value="TECHNICIAN">Teknisyen Şablonu</option>
            <option value="USER">Kullanıcı Şablonu</option>
            <option value="MALZEME_YONETIMI">Malzeme Sorumlusu</option>
            <option value="TAMİR">Atölye Sorumlusu</option>
            <option value="GUEST">Misafir Şablonu</option>
          </select>
        </div>

        <!-- Modal Body (Scrollable) -->
        <div class="permission-modal-body" style="flex-grow: 1; overflow-y: auto; padding: 1.5rem;">
          <div id="preset-template-content" class="hidden">
            <!-- Full Tab/Accordion permissions list -->
            <div style="display: flex; flex-direction: column; gap: 8px;">
              ${allTabs.map(tab => {
                const subPerms = (granularOptions as any)[tab.id] || [];
                const hasSubs = ['turbines', 'warehouses', 'team_warehouses'].includes(tab.id) || subPerms.length > 0;
                return `
                  <div class="permission-accordion-card">
                    <div class="permission-accordion-header" onclick="window.togglePermissionAccordion('${tab.id}', this)">
                      <div class="permission-accordion-title-container">
                        <i class="fa-solid fa-layer-group permission-accordion-icon"></i>
                        <span class="permission-accordion-title">${tab.label}</span>
                      </div>
                      <div class="permission-accordion-actions">
                        <label class="cyber-switch" onclick="event.stopPropagation()">
                          <input type="checkbox" name="preset-tab-perm" value="${tab.id}" onchange="window.handlePresetMainPermChange('${tab.id}', this)">
                          <span class="cyber-switch-slider"></span>
                        </label>
                        ${hasSubs ? `<i class="fa-solid fa-chevron-down accordion-arrow"></i>` : ''}
                      </div>
                    </div>
                    
                    ${renderGranularSubPermissions(tab.id, 'preset')}
                  </div>
                `;
              }).join('')}
            </div>
          </div>
          <div id="preset-template-select-prompt" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 3rem; color: var(--accent-cyan); opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
            DÜZENLEMEK İSTEDİĞİNİZ ŞABLONU YUKARIDAKİ MENÜDEN SEÇİN
          </div>
        </div>

        <!-- Modal Footer -->
        <div class="permission-modal-footer" style="padding: 1rem 1.5rem; background: #161b22; border-top: 1px solid #30363d; display: flex; justify-content: flex-end; gap: 12px; flex-shrink: 0; border-bottom-left-radius: 16px; border-bottom-right-radius: 16px;">
          <button class="btn-cancel" onclick="window.closePresetTemplatesModal()">İPTAL</button>
          <button id="save-presets-btn" class="btn-save" disabled onclick="window.saveCurrentPresetTemplate()" style="opacity: 0.5; cursor: not-allowed;">
            ŞABLONU KAYDET <i class="fa-solid fa-floppy-disk text-xs opacity-70"></i>
          </button>
        </div>
      </div>
    </div>
    
    <style>
      /* Center modal overlay content */
      .modal-overlay {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
      }
      .modal-overlay.hidden {
        display: none !important;
      }

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
      
      .permission-tab-btn, .new-permission-tab-btn {
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
      
      .permission-tab-btn:hover, .new-permission-tab-btn:hover {
        color: #ffffff;
      }
      
      .permission-tab-btn.active, .new-permission-tab-btn.active {
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
        background: transparent;
        color: #94A3B8;
        border: 1px solid rgba(255, 255, 255, 0.1);
        padding: 8px 20px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s;
        text-transform: uppercase;
        letter-spacing: 1px;
        font-family: 'Rajdhani', sans-serif;
      }
      
      .btn-cancel:hover {
        background: rgba(255, 255, 255, 0.04);
        border-color: rgba(255, 255, 255, 0.2);
        color: #fff;
      }
      
      .btn-save {
        background: rgba(0, 242, 255, 0.06);
        color: #00f2ff;
        border: 1px solid rgba(0, 242, 255, 0.25);
        padding: 8px 24px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 800;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        gap: 8px;
        text-transform: uppercase;
        letter-spacing: 1px;
        box-shadow: none;
        font-family: 'Rajdhani', sans-serif;
      }
      
      .btn-save:hover {
        background: rgba(0, 242, 255, 0.15);
        border-color: rgba(0, 242, 255, 0.5);
        color: #fff;
        box-shadow: 0 0 12px rgba(0, 242, 255, 0.1);
      }
    </style>
  `;
}

// LOGIC
(window as any).openNewUserModal = () => {
  // Reset basic fields
  const emailInput = document.getElementById('new-user-email') as HTMLInputElement;
  const nameInput = document.getElementById('new-user-name') as HTMLInputElement;
  const roleInput = document.getElementById('new-user-role') as HTMLSelectElement;
  const passInput = document.getElementById('new-user-pass') as HTMLInputElement;
  const teamInput = document.getElementById('new-user-team') as HTMLSelectElement;

  if (emailInput) {
    emailInput.value = '';
    emailInput.oninput = () => {
      const email = emailInput.value.trim();
      const nInput = document.getElementById('new-user-name') as HTMLInputElement;
      if (nInput && (!nInput.value || nInput.dataset.autoFilled === 'true')) {
        const prefix = email.split('@')[0];
        if (prefix) {
          const match = prefix.match(/tm(\d+)/i);
          if (match && match[1]) {
            const num = match[1].padStart(2, '0');
            nInput.value = `Team${num}`;
          } else {
            const formatted = prefix.split(/[-_.]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            nInput.value = formatted;
          }
          nInput.dataset.autoFilled = 'true';
        } else {
          nInput.value = '';
          nInput.dataset.autoFilled = 'false';
        }
      }
    };
  }
  if (nameInput) {
    nameInput.value = '';
    nameInput.dataset.autoFilled = 'false';
    nameInput.oninput = () => {
      nameInput.dataset.autoFilled = 'false';
    };
  }
  if (roleInput) roleInput.value = 'TECHNICIAN';
  if (passInput) {
    passInput.value = '';
    passInput.type = 'password';
  }
  const newEye = document.getElementById('new-user-pass-eye');
  if (newEye) {
    newEye.className = 'fa-solid fa-eye';
  }
  if (teamInput) teamInput.value = '';

  // Reset selected sites & warehouses
  (window as any).newSelectedSites = [];
  (window as any).newSelectedWarehouses = [];
  (window as any).renderNewPermissionBadges('site');
  (window as any).renderNewPermissionBadges('warehouse');
  (window as any).renderNewPermissionOptions('site');
  (window as any).renderNewPermissionOptions('warehouse');

  // Reset checkboxes
  const modal = document.getElementById('new-user-modal');
  if (modal) {
    modal.querySelectorAll('input[type="checkbox"]').forEach((cb: any) => {
      cb.checked = false;
    });
    modal.querySelectorAll('.permission-sub-card').forEach((item: any) => {
      item.classList.add('opacity-30', 'pointer-events-none');
    });
    
    // Switch to first tab (account)
    const firstTabBtn = modal.querySelector('.new-permission-tab-btn') as HTMLElement;
    if (firstTabBtn) {
      (window as any).switchNewPermissionTab('account', firstTabBtn);
    }
  }

  // Bind site & warehouse dropdown events
  ['site', 'warehouse'].forEach(type => {
    const input = document.getElementById(`new-${type}-search-input`) as HTMLInputElement;
    const dropdown = document.getElementById(`new-${type}-dropdown`);
    if (input) {
      input.onfocus = () => {
         (window as any).renderNewPermissionOptions(type, input.value);
         dropdown?.classList.remove('hidden');
      };
      input.oninput = (e) => {
        const q = (e.target as HTMLInputElement).value;
        (window as any).renderNewPermissionOptions(type as any, q);
        dropdown?.classList.remove('hidden');
      };
    }
  });

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
    const isEmail = emailInput.value.includes('@');
    let firebaseUid = '';

    if (isEmail) {
      // 1. Firebase Authentication'da kullanıcı oluştur
      //    İkincil app kullanarak mevcut admin oturumunu bozmaz
      (window as any).showToast('İşlem', 'Firebase hesabı oluşturuluyor...', 'info');
      firebaseUid = await authService.createAuthUser(emailInput.value, passInput.value);
    } else {
      // Düz kullanıcı adı ile kayıtta Firebase Auth'u atla, doğrudan Firestore kullanıcısı oluştur
      const cleanVal = emailInput.value.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      firebaseUid = 'usr_' + cleanVal + '_' + Math.random().toString(36).substr(2, 5);
    }

    // 2. Read permissions from the new tabbed modal
    const allowedTabs: Record<string, any> = {};
    const allowedTsiCategories: string[] = [];

    const modal = document.getElementById('new-user-modal');
    if (modal) {
      modal.querySelectorAll('input[name="new-tab-perm"]:checked').forEach((cb: any) => {
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
        }
        allowedTabs[tabId] = perms;
      });
    }

    const siteSelections: string[] = modal ? Array.from(modal.querySelectorAll('input[value^="site_"]:checked')).map((cb: any) => cb.value.replace('site_', '')) : [];
    const warehouseSelections: string[] = modal ? [
      ...Array.from(modal.querySelectorAll('input[value^="wh_"]:checked')).map((cb: any) => cb.value.replace('wh_', '')),
      ...Array.from(modal.querySelectorAll('input[value^="team_Team_"]:checked')).map((cb: any) => cb.value)
    ] : [];
    const managedTeamSelections: string[] = modal ? Array.from(modal.querySelectorAll('input[name="new-managed-team"]:checked')).map((cb: any) => cb.value) : [];

    const newUser = {
      uid: firebaseUid,
      email: emailInput.value,
      displayName: nameInput.value,
      role: roleInput.value as any,
      password: passInput.value,
      allowedTabs,
      allowedSites: siteSelections,
      allowedWarehouses: warehouseSelections,
      team: teamInput?.value || '',
      isActive: true,
      managedTeams: managedTeamSelections,
      allowedTsiCategories
    };

    await userService.saveProfile(newUser);
    const successMsg = isEmail 
      ? "Kullanıcı hem Firebase Auth hem Firestore'da oluşturuldu. Artık e-posta/şifre ile giriş yapabilir."
      : "Kullanıcı başarıyla Firestore'da oluşturuldu. Artık kullanıcı adı/şifre ile giriş yapabilir.";
    (window as any).showToast('Başarılı', successMsg, 'success');
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

(window as any).applyDefaultRolePermissions = async (role: string, context: 'new' | 'edit' = 'new') => {
  const modalId = context === 'new' ? 'new-user-modal' : 'permission-modal';
  const modal = document.getElementById(modalId);
  if (!modal) return;

  let roleText = 'Teknisyen';
  if (role === 'ADMIN') roleText = 'Admin';
  else if (role === 'USER') roleText = 'Kullanıcı';
  else if (role === 'MALZEME_YONETIMI') roleText = 'Malzeme Sorumlusu';
  else if (role === 'TAMİR') roleText = 'Atölye Sorumlusu';
  else if (role === 'GUEST') roleText = 'Misafir';

  const desc = `${roleText} şablonu yüklenecektir. Bu işlem formdaki mevcut yetki işaretlerini sıfırlayıp şablon yetkilerini aktaracaktır. Devam etmek istiyor musunuz?`;
  if (!confirm(desc)) return;

  const cbName = context === 'new' ? 'new-tab-perm' : 'tab-perm';

  // Clear all first
  modal.querySelectorAll(`input[name="${cbName}"]`).forEach((cb: any) => (cb as HTMLInputElement).checked = false);
  modal.querySelectorAll('.permission-sub-card input[type="checkbox"]').forEach((cb: any) => (cb as HTMLInputElement).checked = false);
  modal.querySelectorAll('.permission-sub-card').forEach((item: any) => item.classList.add('opacity-30', 'pointer-events-none'));

  // Define defaults
  let defaultTabs: string[] = [];
  let defaultSubs: Record<string, string[]> = {};
  let presetData: any = null;

  try {
    presetData = await userService.getPreset(role);
    if (presetData) {
      const allowedTabs = presetData.allowedTabs || {};
      defaultTabs = Object.keys(allowedTabs);
      defaultTabs.forEach(tabId => {
        const tabVal = allowedTabs[tabId];
        if (typeof tabVal === 'object') {
          defaultSubs[tabId] = Object.keys(tabVal).filter(subKey => tabVal[subKey] === true && subKey !== 'access');
        }
      });
    } else {
      // Fallback
      if (role === 'ADMIN') {
        modal.querySelectorAll(`input[name="${cbName}"]`).forEach((cb: any) => (cb as HTMLInputElement).checked = true);
        modal.querySelectorAll('.permission-sub-card input[type="checkbox"]').forEach((cb: any) => (cb as HTMLInputElement).checked = true);
        modal.querySelectorAll('.permission-sub-card').forEach((item: any) => item.classList.remove('opacity-30', 'pointer-events-none'));
        return;
      } else if (role === 'TECHNICIAN') {
        defaultTabs = [
          'dashboard',
          'new-task',
          'tasks',
          'siparis',
          'turbines',
          'bearing-analysis',
          'visual-bom',
          'tickets-page',
          'tsi-library',
          'kkd-kontrol',
          'olcu-aletleri',
          'tork-aletleri'
        ];
        defaultSubs = {
          'tasks': ['completeTask'],
          'siparis': ['createOrder'],
          'tickets-page': ['createTicket', 'replyTicket'],
          'tsi-library': ['aiAgent'],
          'kkd-kontrol': ['addInspection', 'editInspection'],
          'olcu-aletleri': ['addCalibration', 'editCalibration'],
          'tork-aletleri': ['addCalibration', 'editCalibration']
        };
      } else if (role === 'MALZEME_YONETIMI') {
        defaultTabs = [
          'warehouses',
          'reports-archive',
          'transfers',
          'global-history',
          'asset-custody',
          'image-pool',
          'material-analytics'
        ];
        defaultSubs = {
          'warehouses': ['addMaterial', 'editMaterial', 'uploadImage', 'countStock', 'uploadExcel'],
          'reports-archive': ['downloadPdf', 'editReport', 'returnReport', 'useAi'],
          'transfers': ['approveTransfer'],
          'asset-custody': ['assignCustody']
        };
      } else if (role === 'TAMİR') {
        defaultTabs = [
          'workshop',
          'workshop-stock',
          'warehouses',
          'reports-archive',
          'transfers',
          'repair-history'
        ];
        defaultSubs = {
          'workshop': ['addRepair', 'editRepair'],
          'warehouses': ['addMaterial', 'editMaterial', 'countStock'],
          'reports-archive': ['downloadPdf'],
          'transfers': ['approveTransfer']
        };
      } else if (role === 'GUEST') {
        defaultTabs = ['dashboard', 'tasks', 'turbines', 'reports-archive', 'tsi-library'];
        defaultSubs = {
          'reports-archive': ['downloadPdf'],
          'tsi-library': ['aiAgent']
        };
      }
    }
  } catch (err) {
    console.error("Şablon verisi yüklenirken hata oluştu:", err);
  }

  // Apply checkboxes
  defaultTabs.forEach(tabId => {
    const cb = modal.querySelector(`input[name="${cbName}"][value="${tabId}"]`) as HTMLInputElement;
    if (cb) {
      cb.checked = true;
      // Enable sub cards
      const accordion = cb.closest('.permission-accordion-card');
      const subContainer = accordion?.querySelector('.permission-accordion-content');
      if (subContainer) {
        subContainer.querySelectorAll('.permission-sub-card').forEach((item: any) => {
          item.classList.remove('opacity-30', 'pointer-events-none');
        });
        const tabVal = presetData?.allowedTabs?.[tabId];
        if (tabVal === true) {
          subContainer.querySelectorAll('input[type="checkbox"]').forEach((subCb: any) => {
            subCb.checked = true;
          });
        }
      }
    }
  });

  Object.entries(defaultSubs).forEach(([tabId, subs]) => {
    subs.forEach(subId => {
      const cb = modal.querySelector(`input[name="${cbName}"][value="${tabId}"]`) as HTMLInputElement;
      const accordion = cb?.closest('.permission-accordion-card');
      if (accordion) {
        const subCb = (accordion.querySelector(`input[value="${subId}"]`) || accordion.querySelector(`input[id="${context === 'new' ? 'new-sub-' : 'sub-'}${tabId}-${subId}"]`)) as HTMLInputElement;
        if (subCb) subCb.checked = true;
      }
    });
  });
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

(window as any).toggleUserActiveStatus = async (uid: string, input: HTMLInputElement) => {
  const isActive = input.checked;
  const statusLabel = document.getElementById(`user-status-label-${uid}`);
  if (statusLabel) {
    statusLabel.innerText = isActive ? 'AKTİF' : 'PASİF';
    statusLabel.style.color = isActive ? '#10b981' : '#ff4d4d';
  }

  try {
    await userService.updateActiveStatus(uid, isActive);
    (window as any).showToast('Başarılı', `Kullanıcı durumu ${isActive ? 'Aktif' : 'Pasif'} olarak güncellendi.`, 'success');
  } catch (error) {
    console.error("Kullanıcı durumu güncellenemedi:", error);
    (window as any).showToast('Hata', 'Kullanıcı durumu güncellenemedi.', 'error');
    // Revert state
    input.checked = !isActive;
    if (statusLabel) {
      statusLabel.innerText = !isActive ? 'AKTİF' : 'PASİF';
      statusLabel.style.color = !isActive ? '#10b981' : '#ff4d4d';
    }
  }
};


const granularOptions = {
  'dashboard': [
    { id: 'dash_activeTeams', label: 'Aktif Ekipler' },
    { id: 'dash_faultStatus', label: 'Arıza Durumu' },
    { id: 'dash_upcomingMaintenance', label: 'Yaklaşan Bakım' },
    { id: 'dash_logisticsPoint', label: 'Lojistik Nokta' },
    { id: 'dash_agenda', label: 'Ajanda' },
    { id: 'dash_activeTaskFlow', label: 'Aktif Görev Akışı' },
    { id: 'dash_globalStockQuery', label: 'Global Stok Sorgulama' },
    { id: 'dash_createTask', label: 'Görev Oluştur Butonu' },
    { id: 'dash_inventory', label: 'Envanter Butonu' },
    { id: 'dash_turbineQrScan', label: 'Türbin QR Sicil Okut' }
  ],
  'tasks': [
    { id: 'createTask', label: 'Yeni İş Emri Oluşturma' },
    { id: 'editTask', label: 'İş Emri Düzenleme' },
    { id: 'delegateTask', label: 'İş Emri Transfer Etme (Ata)' },
    { id: 'completeTask', label: 'İş Emri Kapatma / Tamamlama' },
    { id: 'deleteTask', label: 'İş Emri Silme' }
  ],
  'siparis': [
    { id: 'createOrder', label: 'Yeni Sipariş Talebi Oluşturma' },
    { id: 'deleteOrder', label: 'Sipariş Talebi İptal Etme / Silme' }
  ],
  'transfers': [
    { id: 'createTransfer', label: 'Yeni Transfer Talebi Oluşturma' },
    { id: 'approveTransfer', label: 'Transfer Onaylama / Reddetme' },
    { id: 'deleteTransfer', label: 'Transfer Talebi Silme / İptal Etme' }
  ],
  'reports-archive': [
    { id: 'downloadPdf', label: 'PDF İndirme / Dışa Aktarma' },
    { id: 'editReport', label: 'Rapor Düzenleme' },
    { id: 'deleteReport', label: 'Rapor Silme' },
    { id: 'returnReport', label: 'Raporu Ekibe Geri Gönder' },
    { id: 'useAi', label: 'Yapay Zeka Analizi Kullanımı' }
  ],
  'bakim-planlama': [
    { id: 'editPlan', label: 'Bakım Tarihlerini Düzenleme' },
    { id: 'excelExport', label: 'Excel Raporu İndirme' },
    { id: 'excelImport', label: 'Excel ile Toplu Yükleme' },
    { id: 'createTask', label: 'Bakım İş Emri Oluşturma' }
  ],
  'tsi-library': [
    { id: 'aiAgent', label: 'Yapay Zeka Asistanı (Ajan) Yetkisi' },
    { id: 'addDoc', label: 'Kütüphaneye Yeni Belge Ekleme' },
    { id: 'deleteDoc', label: 'Kütüphaneden Belge Silme' }
  ],
  'kkd-kontrol': [
    { id: 'addInspection', label: 'Muayene Ekleme' },
    { id: 'editInspection', label: 'Muayene Düzenleme' },
    { id: 'deleteInspection', label: 'Muayene Kaydı Silme' }
  ],
  'olcu-aletleri': [
    { id: 'addCalibration', label: 'Kalibrasyon Ekleme' },
    { id: 'editCalibration', label: 'Kalibrasyon Düzenleme' },
    { id: 'deleteCalibration', label: 'Kalibrasyon Kaydı Silme' }
  ],
  'tork-aletleri': [
    { id: 'addCalibration', label: 'Kalibrasyon Ekleme' },
    { id: 'editCalibration', label: 'Kalibrasyon Düzenleme' },
    { id: 'deleteCalibration', label: 'Kalibrasyon Kaydı Silme' }
  ],
  'tickets-page': [
    { id: 'createTicket', label: 'Ticket Oluşturma' },
    { id: 'replyTicket', label: 'Ticket Yanıtlama' },
    { id: 'closeTicket', label: 'Ticket Kapatma' },
    { id: 'deleteTicket', label: 'Ticket Silme' }
  ],
  'users': [
    { id: 'editUsers', label: 'Kullanıcı Rol / Yetki Düzenleme' },
    { id: 'deleteUsers', label: 'Kullanıcı Hesabı Silme' }
  ],
  'MALZEME_YONETIMI': [
    { id: 'addMaterial', label: 'Kataloğa Yeni Malzeme Ekleme' },
    { id: 'editMaterial', label: 'Katalogdaki Malzemeleri Düzenleme' },
    { id: 'deleteMaterial', label: 'Katalogdan Malzeme Silme' }
  ],
  'asset-custody': [
    { id: 'assignCustody', label: 'Yeni Zimmet Atama' },
    { id: 'returnCustody', label: 'Zimmet Geri Alma / İade' },
    { id: 'viewCustodyXray', label: 'Envanter Röntgeni & Karne Görünümü' },
    { id: 'importExcel', label: 'Excel ile Zimmet Yükleme Yetkisi' }
  ],
  'image-pool': [
    { id: 'uploadImage', label: 'Yeni Resim Yükleme' },
    { id: 'deleteImage', label: 'Resim Silme' }
  ],
  'turbines': [],
  'warehouses': [
    { id: 'deleteItem', label: 'Depodan Malzeme Silme Yetkisi' },
    { id: 'manageStock', label: 'Depo Yönetimi (Tamir/Hurda/Geri Alım/Düzeltme)' }
  ],
  'team_warehouses': [
    { id: 'deleteItem', label: 'Depodan Malzeme Silme Yetkisi' },
    { id: 'manageStock', label: 'Depo Yönetimi (Tamir/Hurda/Geri Alım/Düzeltme)' }
  ]
};

(window as any).togglePermissionAccordion = (_tabId: string, header: HTMLElement) => {
  const content = header.nextElementSibling as HTMLElement;
  const arrow = header.querySelector('.accordion-arrow');
  if (!content) return;
  
  const isExpanded = content.style.maxHeight && content.style.maxHeight !== '0px';
  
  if (isExpanded) {
    content.style.maxHeight = '0px';
    content.style.opacity = '0';
    arrow?.classList.remove('rotate-180');
  } else {
    content.style.maxHeight = '5000px';
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

(window as any).switchNewPermissionTab = (tabId: string, btn: HTMLElement) => {
  const container = btn.closest('.permission-modal-container') || document.getElementById('new-user-modal');
  container?.querySelectorAll('.new-tab-content').forEach(c => c.classList.add('hidden'));
  container?.querySelector(`#new-tab-${tabId}`)?.classList.remove('hidden');
  container?.querySelectorAll('.new-permission-tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
};

(window as any).selectedSites = [];
(window as any).selectedWarehouses = [];
(window as any).newSelectedSites = [];
(window as any).newSelectedWarehouses = [];

(window as any).toggleNewPermissionItem = (type: 'site' | 'warehouse', id: string, name: string) => {
  const list = type === 'site' ? (window as any).newSelectedSites : (window as any).newSelectedWarehouses;
  const index = list.findIndex((i: any) => i.id === id);
  
  if (index === -1) {
    list.push({ id, name });
  } else {
    list.splice(index, 1);
  }
  
  (window as any).renderNewPermissionBadges(type);
  (window as any).renderNewPermissionOptions(type);
  document.getElementById(`new-${type}-dropdown`)?.classList.add('hidden');
};

(window as any).renderNewPermissionBadges = (type: 'site' | 'warehouse') => {
  const container = document.getElementById(`new-${type}-badges`);
  const list = type === 'site' ? (window as any).newSelectedSites : (window as any).newSelectedWarehouses;
  const input = document.getElementById(`new-${type}-search-input`);
  
  if (!container || !input) return;
  
  container.querySelectorAll('.mini-chip').forEach(b => b.remove());
  
  list.forEach((item: any) => {
    const chip = document.createElement('div');
    chip.className = `mini-chip ${type === 'site' ? 'site-chip' : 'warehouse-chip'}`;
    chip.innerHTML = `${item.name} <i class="fa-solid fa-circle-xmark cursor-pointer opacity-50 hover:opacity-100 ml-1" onclick="event.stopPropagation(); window.toggleNewPermissionItem('${type}', '${item.id}', '${item.name}')"></i>`;
    container.insertBefore(chip, input);
  });
};

(window as any).renderNewPermissionOptions = (type: 'site' | 'warehouse', query: string = '') => {
  const dropdown = document.getElementById(`new-${type}-dropdown`);
  if (!dropdown) return;

  const fullList = type === 'site' ? dataService.getSites() : dataService.getWarehouses();
  const selectedList = type === 'site' ? (window as any).newSelectedSites : (window as any).newSelectedWarehouses;
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
           onclick="window.toggleNewPermissionItem('${type}', '${item.id}', '${item.name}')">
        ${item.name}
      </div>
    `).join('');
  }
};

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

  const subtitle = document.getElementById('modal-subtitle');
  if (subtitle) {
    const displayNameFormatted = formatDisplayName(user.displayName || user.email || '');
    subtitle.innerHTML = `Yetki Ayarlanan Kullanıcı: <strong style="color: var(--accent-cyan); font-weight: 800;">${displayNameFormatted}</strong> (${user.email})`;
  }

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
        } else if (subId.startsWith('team_Team_')) {
          subCb.checked = (user.allowedWarehouses || []).includes(subId) || (typeof userPerms[tabId] === 'object' && !!userPerms[tabId][subId]);
        } else if (subId.startsWith('tsicat_')) {
          const actualCatId = subId.replace('tsicat_', '');
          subCb.checked = (user.allowedTsiCategories || []).includes(actualCatId);
        } else {
          subCb.checked = userPerms[tabId] === true || (typeof userPerms[tabId] === 'object' && !!userPerms[tabId][subId]);
        }
      });
    }

  });

  // Badges and search inputs removed from UI

  const editPass = document.getElementById('edit-user-pass') as HTMLInputElement;
  if (editPass) {
    editPass.value = user.password || '';
    editPass.type = 'password';
  }
  const editEye = document.getElementById('edit-user-pass-eye');
  if (editEye) {
    editEye.className = 'fa-solid fa-eye';
  }
  (document.getElementById('edit-user-team') as HTMLSelectElement).value = user.team || '';

  const activeContainer = document.getElementById('edit-user-active-container');
  const activeCheckbox = document.getElementById('edit-user-active-checkbox') as HTMLInputElement;
  const activeText = document.getElementById('edit-user-active-text');
  if (activeContainer && activeCheckbox) {
    if (user.role === 'ADMIN') {
      activeContainer.style.display = 'none';
    } else {
      activeContainer.style.display = 'flex';
      activeCheckbox.checked = user.isActive !== false;
      if (activeText) {
        activeText.innerText = activeCheckbox.checked ? 'Hesap Aktif (Kullanıcı giriş yapabilir)' : 'Hesap Pasif (Giriş engellendi)';
      }
    }
  }

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



  // Reset modules search filter when opening
  const modulesSearch = document.getElementById('permission-modules-search') as HTMLInputElement;
  if (modulesSearch) {
    modulesSearch.value = '';
    (window as any).filterPermissionModules('');
  }

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

      // Populate sites and warehouses dynamically from the checked tree-view items in the modal
      const siteSelections: string[] = Array.from(modal.querySelectorAll('input[value^="site_"]:checked')).map((cb: any) => cb.value.replace('site_', ''));
      const warehouseSelections: string[] = [
        ...Array.from(modal.querySelectorAll('input[value^="wh_"]:checked')).map((cb: any) => cb.value.replace('wh_', '')),
        ...Array.from(modal.querySelectorAll('input[value^="team_Team_"]:checked')).map((cb: any) => cb.value)
      ];
      const teamSelection = (document.getElementById('edit-user-team') as HTMLSelectElement)?.value || '';
      
      const managedTeamSelections: string[] = Array.from(modal.querySelectorAll('input[name="managed-team"]:checked')).map((cb: any) => cb.value);

      const updateData: any = {
        allowedTabs,
        allowedSites: siteSelections,
        allowedWarehouses: warehouseSelections,
        password: (document.getElementById('edit-user-pass') as HTMLInputElement).value,
        team: teamSelection,
        managedTeams: managedTeamSelections,
        allowedTsiCategories
      };

      const activeCheckbox = document.getElementById('edit-user-active-checkbox') as HTMLInputElement;
      if (activeCheckbox && user.role !== 'ADMIN') {
        updateData.isActive = activeCheckbox.checked;
      }

      await userService.updatePermissions(user.uid, updateData);

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



(window as any).filterUsersList = (query: string) => {
  const q = query.toLocaleLowerCase('tr-TR').trim();
  const tiers = document.querySelectorAll('.user-tier-container');
  
  tiers.forEach((tier: any) => {
    let visibleCards = 0;
    const cards = tier.querySelectorAll('.user-row');
    
    cards.forEach((card: any) => {
      const text = card.textContent.toLocaleLowerCase('tr-TR');
      if (text.includes(q)) {
        card.style.display = 'flex';
        visibleCards++;
      } else {
        card.style.display = 'none';
      }
    });
    
    if (visibleCards > 0) {
      tier.style.display = 'flex';
    } else {
      tier.style.display = 'none';
    }
  });
};

(window as any).generateAndFillPassword = (inputId: string) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let pass = '';
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  const input = document.getElementById(inputId) as HTMLInputElement;
  if (input) {
    input.value = pass;
    input.type = 'text';
    const eyeId = inputId === 'new-user-pass' ? 'new-user-pass-eye' : 'edit-user-pass-eye';
    const eye = document.getElementById(eyeId);
    if (eye) {
      eye.className = 'fa-solid fa-eye-slash';
    }
    if ((window as any).showToast) {
      (window as any).showToast('Şifre Üretildi', 'Yeni şifre alana yerleştirildi.', 'success');
    }
  }
};

(window as any).toggleNewUserPasswordVisibility = () => {
  const input = document.getElementById('new-user-pass') as HTMLInputElement;
  const eye = document.getElementById('new-user-pass-eye') as HTMLElement;
  if (!input || !eye) return;
  if (input.type === 'password') {
    input.type = 'text';
    eye.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    eye.className = 'fa-solid fa-eye';
  }
};

(window as any).toggleEditUserPasswordVisibility = () => {
  const input = document.getElementById('edit-user-pass') as HTMLInputElement;
  const eye = document.getElementById('edit-user-pass-eye') as HTMLElement;
  if (!input || !eye) return;
  if (input.type === 'password') {
    input.type = 'text';
    eye.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    eye.className = 'fa-solid fa-eye';
  }
};

(window as any).openPresetTemplatesModal = () => {
  const select = document.getElementById('preset-template-role-select') as HTMLSelectElement;
  if (select) select.value = '';
  
  const content = document.getElementById('preset-template-content');
  const prompt = document.getElementById('preset-template-select-prompt');
  const saveBtn = document.getElementById('save-presets-btn') as HTMLButtonElement;
  
  if (content) content.classList.add('hidden');
  if (prompt) {
    prompt.innerHTML = `
      <i class="fa-solid fa-wand-magic-sparkles" style="font-size: 3rem; color: var(--accent-cyan); opacity: 0.3; margin-bottom: 1rem; display: block;"></i>
      DÜZENLEMEK İSTEDİĞİNİZ ŞABLONU YUKARIDAKİ MENÜDEN SEÇİN
    `;
    prompt.classList.remove('hidden');
  }
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.style.opacity = '0.5';
    saveBtn.style.cursor = 'not-allowed';
  }

  document.getElementById('preset-templates-modal')?.classList.remove('hidden');
};

(window as any).closePresetTemplatesModal = () => {
  document.getElementById('preset-templates-modal')?.classList.add('hidden');
};

(window as any).loadPresetTemplateToManager = async (role: string) => {
  const content = document.getElementById('preset-template-content');
  const prompt = document.getElementById('preset-template-select-prompt');
  const saveBtn = document.getElementById('save-presets-btn') as HTMLButtonElement;
  
  if (!content || !prompt || !saveBtn) return;
  
  content.classList.add('hidden');
  prompt.innerHTML = `<i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: var(--accent-cyan); margin-bottom: 1rem; display: block;"></i> Şablon Verileri Yükleniyor...`;
  prompt.classList.remove('hidden');
  
  try {
    const modal = document.getElementById('preset-templates-modal');
    if (modal) {
      modal.querySelectorAll('input[name="preset-tab-perm"]').forEach((cb: any) => (cb as HTMLInputElement).checked = false);
      modal.querySelectorAll('.permission-sub-card input[type="checkbox"]').forEach((cb: any) => (cb as HTMLInputElement).checked = false);
      modal.querySelectorAll('.permission-sub-card').forEach((item: any) => item.classList.add('opacity-30', 'pointer-events-none'));
    }
    
    let presetData = await userService.getPreset(role);
    let defaultTabs: string[] = [];
    let defaultSubs: Record<string, string[]> = {};
    
    if (presetData) {
      const allowedTabs = presetData.allowedTabs || {};
      defaultTabs = Object.keys(allowedTabs);
      defaultTabs.forEach(tabId => {
        const tabVal = allowedTabs[tabId];
        if (typeof tabVal === 'object') {
          defaultSubs[tabId] = Object.keys(tabVal).filter(subKey => tabVal[subKey] === true && subKey !== 'access');
        }
      });
    } else {
      if (role === 'USER') {
        defaultTabs = ['dashboard', 'tasks', 'siparis', 'turbines', 'tickets-page', 'tsi-library'];
        defaultSubs = {
          'tasks': ['completeTask'],
          'siparis': ['createOrder'],
          'tickets-page': ['createTicket', 'replyTicket']
        };
      } else if (role === 'TECHNICIAN') {
        defaultTabs = ['dashboard', 'new-task', 'tasks', 'siparis', 'turbines', 'bearing-analysis', 'visual-bom', 'tickets-page', 'tsi-library', 'kkd-kontrol', 'olcu-aletleri', 'tork-aletleri'];
        defaultSubs = {
          'tasks': ['completeTask'],
          'siparis': ['createOrder'],
          'tickets-page': ['createTicket', 'replyTicket'],
          'tsi-library': ['aiAgent'],
          'kkd-kontrol': ['addInspection', 'editInspection'],
          'olcu-aletleri': ['addCalibration', 'editCalibration'],
          'tork-aletleri': ['addCalibration', 'editCalibration']
        };
      } else if (role === 'MALZEME_YONETIMI') {
        defaultTabs = ['warehouses', 'reports-archive', 'transfers', 'global-history', 'asset-custody', 'image-pool', 'material-analytics'];
        defaultSubs = {
          'warehouses': ['addMaterial', 'editMaterial', 'uploadImage', 'countStock', 'uploadExcel'],
          'reports-archive': ['downloadPdf', 'editReport', 'returnReport', 'useAi'],
          'transfers': ['approveTransfer'],
          'asset-custody': ['assignCustody']
        };
      } else if (role === 'TAMİR') {
        defaultTabs = ['workshop', 'workshop-stock', 'warehouses', 'reports-archive', 'transfers', 'repair-history'];
        defaultSubs = {
          'workshop': ['addRepair', 'editRepair'],
          'warehouses': ['addMaterial', 'editMaterial', 'countStock'],
          'reports-archive': ['downloadPdf'],
          'transfers': ['approveTransfer']
        };
      } else if (role === 'GUEST') {
        defaultTabs = ['dashboard', 'tasks', 'turbines', 'reports-archive', 'tsi-library'];
        defaultSubs = {
          'reports-archive': ['downloadPdf'],
          'tsi-library': ['aiAgent']
        };
      }
    }
    
    if (modal) {
      defaultTabs.forEach(tabId => {
        const cb = modal.querySelector(`input[name="preset-tab-perm"][value="${tabId}"]`) as HTMLInputElement;
        if (cb) {
          cb.checked = true;
          const accordion = cb.closest('.permission-accordion-card');
          const subContainer = accordion?.querySelector('.permission-accordion-content');
          if (subContainer) {
            subContainer.querySelectorAll('.permission-sub-card').forEach((item: any) => {
              item.classList.remove('opacity-30', 'pointer-events-none');
            });
            const tabVal = presetData?.allowedTabs?.[tabId];
            if (tabVal === true) {
              subContainer.querySelectorAll('input[type="checkbox"]').forEach((subCb: any) => {
                subCb.checked = true;
              });
            }
          }
        }
      });

      Object.entries(defaultSubs).forEach(([tabId, subs]) => {
        subs.forEach(subId => {
          const cb = modal.querySelector(`input[name="preset-tab-perm"][value="${tabId}"]`) as HTMLInputElement;
          const accordion = cb?.closest('.permission-accordion-card');
          if (accordion) {
            const subCb = (accordion.querySelector(`input[value="${subId}"]`) || accordion.querySelector(`input[id="preset-sub-${tabId}-${subId}"]`)) as HTMLInputElement;
            if (subCb) subCb.checked = true;
          }
        });
      });
    }
    
    prompt.classList.add('hidden');
    content.classList.remove('hidden');
    saveBtn.disabled = false;
    saveBtn.style.opacity = '1';
    saveBtn.style.cursor = 'pointer';
  } catch (error) {
    prompt.innerHTML = `<i class="fa-solid fa-circle-exclamation" style="font-size: 2rem; color: #ef4444; margin-bottom: 1rem; display: block;"></i> Hata: Veri yüklenemedi.`;
  }
};

(window as any).handlePresetMainPermChange = (tabId: string, input: HTMLInputElement) => {
  const accordion = input.closest('.permission-accordion-card');
  const subContainer = accordion?.querySelector('.permission-accordion-content');
  if (!subContainer) return;
  
  const subItems = subContainer.querySelectorAll('.permission-sub-card');
  const subChecks = subContainer.querySelectorAll('input[type="checkbox"]');
  
  if (input.checked) {
    subItems.forEach((item: any) => item.classList.remove('opacity-30', 'pointer-events-none'));
  } else {
    subItems.forEach((item: any) => item.classList.add('opacity-30', 'pointer-events-none'));
    subChecks.forEach((cb: any) => (cb as HTMLInputElement).checked = false);
  }
};

(window as any).saveCurrentPresetTemplate = async () => {
  const select = document.getElementById('preset-template-role-select') as HTMLSelectElement;
  const role = select?.value;
  if (!role) return;
  
  const modal = document.getElementById('preset-templates-modal');
  if (!modal) return;
  
  try {
    (window as any).showToast('İşlem', 'Şablon kaydediliyor...', 'info');
    
    const allowedTabs: Record<string, any> = {};
    const allowedTsiCategories: string[] = [];
    
    modal.querySelectorAll('input[name="preset-tab-perm"]:checked').forEach((cb: any) => {
      const tabId = (cb as HTMLInputElement).value;
      const perms: Record<string, any> = { access: true };
      
      const accordion = cb.closest('.permission-accordion-card');
      const subContainer = accordion?.querySelector('.permission-accordion-content');
      if (subContainer) {
        subContainer.querySelectorAll('input:checked').forEach((subCb: any) => {
          const subId = (subCb as HTMLInputElement).value;
          if (subId.startsWith('tsicat_')) {
            allowedTsiCategories.push(subId.replace('tsicat_', ''));
          } else {
            perms[subId] = true;
          }
        });
        
        allowedTabs[tabId] = perms;
      } else {
        allowedTabs[tabId] = true;
      }
    });
    
    await userService.savePreset(role, {
      allowedTabs,
      allowedTsiCategories
    });
    
    (window as any).showToast('Başarılı', 'Şablon başarıyla kaydedildi.', 'success');
    (window as any).closePresetTemplatesModal();
  } catch (error) {
    console.error(error);
    (window as any).showToast('Hata', 'Şablon kaydedilemedi: ' + error, 'error');
  }
};

(window as any).filterPermissionModules = (query: string) => {
  const q = query.toLocaleLowerCase('tr-TR').trim();
  const modal = document.getElementById('permission-modal');
  if (!modal) return;
  
  const cards = modal.querySelectorAll('.permission-accordion-card');
  
  cards.forEach((card: any) => {
    const titleEl = card.querySelector('.permission-accordion-title');
    const titleText = titleEl ? titleEl.textContent.toLocaleLowerCase('tr-TR') : '';
    
    // Check if title or any sub-permission labels match
    const subLabels = Array.from(card.querySelectorAll('.permission-sub-label')).map((el: any) => el.textContent.toLocaleLowerCase('tr-TR'));
    
    const matchesTitle = titleText.includes(q);
    const matchesSub = subLabels.some(label => label.includes(q));
    
    if (matchesTitle || matchesSub) {
      card.style.display = 'block';
      // Auto-expand if matching a sub-permission
      if (matchesSub && q.length > 0) {
        const content = card.querySelector('.permission-accordion-content') as HTMLElement;
        const arrow = card.querySelector('.accordion-arrow');
        if (content) {
          content.style.maxHeight = '5000px';
          content.style.opacity = '1';
          arrow?.classList.add('rotate-180');
        }
      }
    } else {
      card.style.display = 'none';
    }
  });
};

(window as any).handleWarehouseNodeChange = (whId: string, input: HTMLInputElement) => {
  const editContainer = document.getElementById(`nested-wh-opts-${whId}`);
  const newContainer = document.getElementById(`new-nested-wh-opts-${whId}`);
  const presetContainer = document.getElementById(`preset-nested-wh-opts-${whId}`);
  
  const container = editContainer || newContainer || presetContainer;
  if (!container) return;
  
  const childChecks = container.querySelectorAll('input[type="checkbox"]');
  childChecks.forEach((cb: any) => {
    (cb as HTMLInputElement).checked = input.checked;
  });
};

const renderGranularSubPermissions = (tabId: string, context: 'new' | 'edit' | 'preset' = 'edit'): string => {
  const prefix = context === 'new' ? 'new-' : context === 'preset' ? 'preset-' : '';
  const inputName = context === 'new' ? 'new-sub-perm' : context === 'preset' ? 'preset-sub-perm' : `sub-perm-${tabId}`;

  if (tabId === 'turbines') {
    const sites = dataService.getSites();
    return `
      <div class="permission-accordion-content" style="max-height: 0px; overflow: hidden; transition: all 0.3s ease; opacity: 0; padding: 0 1.25rem;">
        <div class="permission-subgrid">
          ${sites.map(site => `
            <div class="permission-sub-card sub-perm-item opacity-30 pointer-events-none" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.02);">
              <span class="permission-sub-label" style="font-size: 0.8rem; font-weight: 500; color: var(--text-main);">${site.name}</span>
              <label class="cyber-switch">
                <input type="checkbox" id="${prefix}sub-site-${site.id}" value="site_${site.id}">
                <span class="cyber-switch-slider"></span>
              </label>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  if (tabId === 'team_warehouses') {
    return `
      <div class="permission-accordion-content" style="max-height: 0px; overflow: hidden; transition: all 0.3s ease; opacity: 0; padding: 0 1.25rem;">
        <div class="permission-subgrid">
          ${Array.from({length: 15}, (_, i) => {
            const teamName = `Team ${String(i + 1).padStart(2, '0')}`;
            const teamId = `team_Team_${String(i + 1).padStart(2, '0')}`;
            return `
              <div class="permission-sub-card sub-perm-item opacity-30 pointer-events-none" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.02);">
                <span class="permission-sub-label" style="font-size: 0.8rem; font-weight: 500; color: var(--text-main);">${teamName} Deposu</span>
                <label class="cyber-switch">
                  <input type="checkbox" id="${prefix}sub-teamwh-${teamId}" value="${teamId}">
                  <span class="cyber-switch-slider"></span>
                </label>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  if (tabId === 'warehouses') {
    const warehouses = dataService.getWarehouses();
    return `
      <div class="permission-accordion-content" style="max-height: 0px; overflow: hidden; transition: all 0.3s ease; opacity: 0; padding: 0 1.25rem;">
        <div class="permission-subgrid" style="grid-template-columns: 1fr; gap: 16px; padding-bottom: 1.25rem;">
          ${warehouses.map(wh => `
            <div class="permission-sub-card sub-perm-item opacity-30 pointer-events-none" style="display: flex; flex-direction: column; align-items: stretch; gap: 8px; background: #1c2128; padding: 12px; border-radius: 8px; border: 1px solid rgba(48, 54, 61, 0.5); width: 100%;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span class="permission-sub-label" style="font-weight: 700; color: #fff; font-size: 0.8rem;">${wh.name}</span>
                <label class="cyber-switch">
                  <input type="checkbox" value="wh_${wh.id}" onchange="window.handleWarehouseNodeChange('${wh.id}', this)">
                  <span class="cyber-switch-slider"></span>
                </label>
              </div>
              <div id="${prefix}nested-wh-opts-${wh.id}" style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-top: 6px; padding: 8px; background: rgba(0,0,0,0.2); border-radius: 6px; border-left: 2px solid var(--accent-cyan);">
                ${[
                  { id: 'envanter', label: 'Envanter' },
                  { id: 'analiz', label: 'Analiz' },
                  { id: 'sayim', label: 'Sayım' },
                  { id: 'sayimGecmisi', label: 'Sayım Geçmişi' },
                  { id: 'defect', label: 'Defect Listesi' }
                ].map(opt => `
                  <div style="display: flex; justify-content: space-between; align-items: center; background: #0A0E17; padding: 6px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.03);">
                    <span class="permission-sub-label" style="font-size: 0.7rem; color: var(--text-muted);">${opt.label}</span>
                    <label class="cyber-switch" style="transform: scale(0.85);">
                      <input type="checkbox" value="whopt_${opt.id}_${wh.id}">
                      <span class="cyber-switch-slider"></span>
                    </label>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  const subPerms = (granularOptions as any)[tabId] || [];
  if (subPerms.length === 0) return '';

  return `
    <div class="permission-accordion-content" style="max-height: 0px; overflow: hidden; transition: all 0.3s ease; opacity: 0; padding: 0 1.25rem;">
      <div class="permission-subgrid" style="padding-bottom: 1.25rem; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px;">
        ${subPerms.map((sub: any) => `
          <div class="permission-sub-card sub-perm-item opacity-30 pointer-events-none" style="display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.15); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.02);">
            <span class="permission-sub-label" style="font-size: 0.8rem; font-weight: 500; color: var(--text-main);">${sub.label}</span>
            <label class="cyber-switch">
              <input type="checkbox" id="${prefix}sub-${tabId}-${sub.id}" value="${sub.id}">
              <span class="cyber-switch-slider"></span>
            </label>
          </div>
        `).join('')}
      </div>
    </div>
  `;
};
