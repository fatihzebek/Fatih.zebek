// src/pages/AdvancedPermissionStudio.ts
// Gelişmiş Yetki Stüdyosu: Çoklu Karşılaştırma Matrisi, Kategorize Yetkiler, Fiyat Katmanı ve Kısıtlı Modül Beyaz Listesi

import { formatDisplayName } from '../utils/formatters';

export interface RestrictedModuleConfig {
  id: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  whitelist: string[]; // Email addresses allowed
  isPriceSensitive?: boolean;
}

// Default Restricted Modules Config
export const DEFAULT_RESTRICTED_MODULES: RestrictedModuleConfig[] = [
  {
    id: 'material-pricing',
    name: 'Birim Fiyatlandırma',
    category: 'Mali & Finans',
    icon: 'fa-solid fa-tags',
    description: 'SAP ve sistem birim malzeme fiyatlarını görme ve güncelleme yetkisi.',
    whitelist: ['fatih.zebek@demirerholding.com', 'hursit.akter@demirerholding.com'],
    isPriceSensitive: true
  },
  {
    id: 'material-analytics',
    name: 'Malzeme Analitiği',
    category: 'Mali & Finans',
    icon: 'fa-solid fa-chart-pie',
    description: 'Euro bazlı santral tüketimleri, 9 sekmeli yönetici raporu ve maliyet analizleri.',
    whitelist: ['fatih.zebek@demirerholding.com', 'emir.unver@demirerholding.com', 'koray.demirer@demirerholding.com', 'hursit.akter@demirerholding.com'],
    isPriceSensitive: true
  },
  {
    id: 'users',
    name: 'Kullanıcı & Yetki Yönetimi',
    category: 'Sistem Güvenliği',
    icon: 'fa-solid fa-user-shield',
    description: 'Kullanıcı hesapları oluşturma, yetkileri düzenleme ve beyaz liste yapılandırması.',
    whitelist: ['fatih.zebek@demirerholding.com', 'emir.unver@demirerholding.com']
  },
  {
    id: 'parameter-audit',
    name: 'Parametre Denetimi',
    category: 'Sistem Güvenliği',
    icon: 'fa-solid fa-sliders',
    description: 'Türbin kritik işletme parametreleri, geçmiş denetim kayıtları ve ayarlar.',
    whitelist: ['fatih.zebek@demirerholding.com']
  },
  {
    id: 'scada-reset-logs',
    name: 'SCADA Reset Günlükleri',
    category: 'Operasyonel Güvenlik',
    icon: 'fa-solid fa-satellite-dish',
    description: 'SCADA uzaktan reset ve kumanda logları, türbin hata müdahale kayıtları.',
    whitelist: ['fatih.zebek@demirerholding.com', 'emir.unver@demirerholding.com']
  }
];

// All modules categorized for clear presentation
export const MODULE_CATEGORIES = [
  {
    id: 'management',
    title: 'Yönetim & Raporlama',
    icon: 'fa-solid fa-chart-line',
    color: '#00f2fe',
    modules: [
      { id: 'dashboard', label: 'Gösterge Paneli (Dashboard)', icon: 'fa-solid fa-gauge-high' },
      { id: 'reports-archive', label: 'Rapor Arşivi', icon: 'fa-solid fa-file-invoice' },
      { id: 'bakim-planlama', label: 'Bakım Planlama', icon: 'fa-solid fa-calendar-check' },
      { id: 'leave-management', label: 'İzin Yönetimi', icon: 'fa-solid fa-calendar-days' },
      { id: 'material-analytics', label: 'Malzeme Analitiği', icon: 'fa-solid fa-chart-pie', isRestricted: true }
    ]
  },
  {
    id: 'operations',
    title: 'Saha Operasyonları',
    icon: 'fa-solid fa-screwdriver-wrench',
    color: '#10b981',
    modules: [
      { id: 'tasks', label: 'İş Emirleri', icon: 'fa-solid fa-list-check' },
      { id: 'new-task', label: 'Yeni İş Emri Oluşturma', icon: 'fa-solid fa-plus-circle' },
      { id: 'turbines', label: 'Servis Bölgeleri (Santraller)', icon: 'fa-solid fa-fan' },
      { id: 'tickets-page', label: 'Saha Destek (Ticket)', icon: 'fa-solid fa-headset' },
      { id: 'scada-reset-logs', label: 'SCADA Reset Günlükleri', icon: 'fa-solid fa-satellite-dish', isRestricted: true }
    ]
  },
  {
    id: 'inventory',
    title: 'Stok & Lojistik (Fiyat Katmanı)',
    icon: 'fa-solid fa-boxes-stacked',
    color: '#f59e0b',
    modules: [
      { id: 'warehouses', label: 'Servis Depoları', icon: 'fa-solid fa-warehouse', hasPriceLayer: true },
      { id: 'team_warehouses', label: 'Ekiplerin Zimmetleri', icon: 'fa-solid fa-box' },
      { id: 'transfers', label: 'Malzeme Transfer Talebi', icon: 'fa-solid fa-truck-ramp-box', hasPriceLayer: true },
      { id: 'asset-custody', label: 'Malzeme Zimmeti', icon: 'fa-solid fa-hand-holding-box' },
      { id: 'siparis', label: 'Malzeme Sipariş Formu', icon: 'fa-solid fa-cart-flatbed' },
      { id: 'MALZEME_YONETIMI', label: 'Malzeme Yönetimi', icon: 'fa-solid fa-dolly', isRestricted: true },
      { id: 'material-pricing', label: 'Birim Fiyatlandırma', icon: 'fa-solid fa-tags', isRestricted: true }
    ]
  },
  {
    id: 'knowledge',
    title: 'Teknik Bilgi Bankaları & Atölye',
    icon: 'fa-solid fa-book-bookmark',
    color: '#a855f7',
    modules: [
      { id: 'tsi-library', label: 'TSI Bilgi Bankası', icon: 'fa-solid fa-book-open-reader' },
      { id: 'fault-library', label: 'Arıza Çözüm Kütüphanesi', icon: 'fa-solid fa-triangle-exclamation' },
      { id: 'bearing-analysis', label: 'Rulman Analiz Ajanı', icon: 'fa-solid fa-compass-drafting' },
      { id: 'visual-bom', label: 'Görsel Parça Kataloğu', icon: 'fa-solid fa-cubes' },
      { id: 'image-pool', label: 'Görsel Ürün Tarama', icon: 'fa-solid fa-camera' },
      { id: 'workshop', label: 'Merkez Tamir Atölyesi', icon: 'fa-solid fa-wrench' },
      { id: 'workshop-stock', label: 'Atölye Stokları', icon: 'fa-solid fa-box-open' },
      { id: 'isg-management', label: 'İSG & KKD Yönetimi', icon: 'fa-solid fa-shield-halved' },
      { id: 'kkd-kontrol', label: 'KKD Muayene Takip', icon: 'fa-solid fa-helmet-safety' },
      { id: 'olcu-aletleri', label: 'Ölçü Aletleri Kalibrasyon', icon: 'fa-solid fa-ruler-combined' },
      { id: 'tork-aletleri', label: 'Tork Aletleri Kalibrasyon', icon: 'fa-solid fa-wrench' },
      { id: 'parameter-audit', label: 'Parametre Denetimi', icon: 'fa-solid fa-sliders', isRestricted: true }
    ]
  }
];

export class AdvancedPermissionStudio {
  private users: any[] = [];
  private currentUser: any = null;
  private selectedUserIds: Set<string> = new Set();
  private activeTab: 'matrix' | 'details' | 'restricted' = 'matrix';
  private detailUserId: string | null = null;
  private onlyDifferences: boolean = false;
  private categoryFilter: string = 'all';
  private restrictedConfigs: RestrictedModuleConfig[] = [];

  constructor(users: any[], currentUser: any) {
    this.users = [...users].sort((a, b) => {
      const numA = this.getTeamNumber(a);
      const numB = this.getTeamNumber(b);
      if (numA !== numB) return numA - numB;
      return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
    });
    this.currentUser = currentUser;
    this.loadRestrictedConfigs();

    // Default select 3 teams for comparison to give an immediate preview
    const tm02 = this.users.find(u => (u.email || '').includes('tm02') || (u.displayName || '').includes('Team 02') || (u.displayName || '').includes('Team02'));
    const tm04 = this.users.find(u => (u.email || '').includes('tm04') || (u.displayName || '').includes('Team 04') || (u.displayName || '').includes('Team04'));
    const tm13 = this.users.find(u => (u.email || '').includes('tm13') || (u.displayName || '').includes('Team 13') || (u.displayName || '').includes('Team13'));

    if (tm02) this.selectedUserIds.add(tm02.uid || tm02._id || tm02.id);
    if (tm04) this.selectedUserIds.add(tm04.uid || tm04._id || tm04.id);
    if (tm13) this.selectedUserIds.add(tm13.uid || tm13._id || tm13.id);

    // Default detail user
    this.detailUserId = tm02 ? (tm02.uid || tm02._id || tm02.id) : (this.users[0]?.uid || this.users[0]?._id);
  }

  public getTeamNumber(u: any): number {
    const email = (u.email || '').toLowerCase();
    const matchEmail = email.match(/tm(\d+)/);
    if (matchEmail && matchEmail[1]) return parseInt(matchEmail[1], 10);
    const displayName = (u.displayName || '').toLowerCase();
    const matchName = displayName.match(/(?:team\s*|tm\s*)(\d+)/);
    if (matchName && matchName[1]) return parseInt(matchName[1], 10);
    const teamField = (u.team || '').toLowerCase();
    const matchTeam = teamField.match(/(?:team\s*|tm\s*)(\d+)/);
    if (matchTeam && matchTeam[1]) return parseInt(matchTeam[1], 10);
    return 99999;
  }

  private loadRestrictedConfigs() {
    try {
      const saved = localStorage.getItem('dh_restricted_modules_config');
      if (saved) {
        this.restrictedConfigs = JSON.parse(saved);
        return;
      }
    } catch (e) {
      console.warn("Could not read restricted configs from localStorage", e);
    }
    this.restrictedConfigs = JSON.parse(JSON.stringify(DEFAULT_RESTRICTED_MODULES));
  }

  private saveRestrictedConfigs() {
    try {
      localStorage.setItem('dh_restricted_modules_config', JSON.stringify(this.restrictedConfigs));
    } catch (e) {
      console.warn("Could not save restricted configs to localStorage", e);
    }
  }

  public isUserSuperAdmin(): boolean {
    const email = (this.currentUser?.email || (window as any).currentUser?.email || '').toLowerCase().trim();
    return email === 'fatih.zebek@demirerholding.com';
  }

  public render(): string {
    const isSuperAdmin = this.isUserSuperAdmin();
    const anomaliesCount = this.calculateTotalAnomalies();

    return `
      <div id="advanced-permission-studio" class="fade-in-up" style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Toolbar & Stat Highlights -->
        <div class="glass-panel" style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 1.5rem; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.2); background: linear-gradient(135deg, rgba(10, 15, 29, 0.85) 0%, rgba(13, 22, 45, 0.85) 100%);">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 44px; height: 44px; border-radius: 10px; background: rgba(0, 242, 254, 0.1); border: 1px solid rgba(0, 242, 254, 0.3); display: flex; align-items: center; justify-content: center; color: var(--accent-cyan); font-size: 1.3rem;">
              <i class="fa-solid fa-shield-halved"></i>
            </div>
            <div>
              <div style="font-family: 'Rajdhani', sans-serif; font-size: 1.35rem; font-weight: 800; color: #fff; letter-spacing: 0.5px; display: flex; align-items: center; gap: 10px;">
                YETKİ & KISITLAMA STÜDYOSU
                <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 20px; background: rgba(0, 242, 254, 0.15); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); font-weight: 700; font-family: sans-serif;">PROTOTİP</span>
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">
                Çoklu kullanıcı karşılaştırma matrisi, rol anomali tespiti ve admin üstü beyaz liste kısıtlamaları
              </div>
            </div>
          </div>

          <!-- Quick Stats Pills -->
          <div style="display: flex; gap: 12px; align-items: center;">
            <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 6px 14px; text-align: center;">
              <div style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase;">Toplam Kullanıcı</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif;">${this.users.length}</div>
            </div>
            <div style="background: rgba(0, 242, 254, 0.05); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 8px; padding: 6px 14px; text-align: center;">
              <div style="font-size: 0.65rem; color: var(--accent-cyan); text-transform: uppercase;">Seçili Karşılaştırma</div>
              <div id="studio-stat-selected" style="font-size: 1.1rem; font-weight: 800; color: var(--accent-cyan); font-family: 'Rajdhani', sans-serif;">${this.selectedUserIds.size}</div>
            </div>
            <div style="background: rgba(239, 68, 68, 0.06); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 8px; padding: 6px 14px; text-align: center;">
              <div style="font-size: 0.65rem; color: #f87171; text-transform: uppercase;">Kısıtlı Modül</div>
              <div style="font-size: 1.1rem; font-weight: 800; color: #f87171; font-family: 'Rajdhani', sans-serif;">${this.restrictedConfigs.length}</div>
            </div>
            ${anomaliesCount > 0 ? `
              <div style="background: rgba(245, 158, 11, 0.1); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 6px 14px; text-align: center;">
                <div style="font-size: 0.65rem; color: #fbbf24; text-transform: uppercase;">Tespit Edilen Anomali</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #fbbf24; font-family: 'Rajdhani', sans-serif;">${anomaliesCount} ⚠️</div>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Studio Navigation Tabs -->
        <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 6px;">
          <button id="studio-tab-matrix-btn" class="studio-tab-btn ${this.activeTab === 'matrix' ? 'active' : ''}" onclick="window.switchStudioTab('matrix')">
            <i class="fa-solid fa-table-columns"></i> ÇOKLU KARŞILAŞTIRMA MATRİSİ (${this.selectedUserIds.size})
          </button>
          <button id="studio-tab-details-btn" class="studio-tab-btn ${this.activeTab === 'details' ? 'active' : ''}" onclick="window.switchStudioTab('details')">
            <i class="fa-solid fa-sliders"></i> DETAYLI YETKİ & FİYAT KATMANI
          </button>
          <button id="studio-tab-restricted-btn" class="studio-tab-btn ${this.activeTab === 'restricted' ? 'active' : ''}" onclick="window.switchStudioTab('restricted')">
            <i class="fa-solid fa-lock"></i> KISITLI MODÜLLER & BEYAZ LİSTE ${isSuperAdmin ? '<span class="super-badge">SİSTEM SAHİBİ</span>' : ''}
          </button>
        </div>

        <!-- Main Layout: Left Sidebar (User Selector) + Right Workspace -->
        <div style="display: grid; grid-template-columns: 310px 1fr; gap: 1.25rem; align-items: start;">
          
          <!-- LEFT: User Picker & Hierarchy Tree -->
          <div class="glass-panel" style="padding: 1.2rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(13, 17, 26, 0.7); display: flex; flex-direction: column; gap: 12px; max-height: calc(100vh - 250px); overflow-y: auto;">
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px;">Kullanıcı Listesi</span>
              <div style="display: flex; gap: 6px;">
                <button onclick="window.studioSelectAllUsers(true)" style="background: transparent; border: none; color: var(--accent-cyan); font-size: 0.7rem; cursor: pointer; text-decoration: underline;">Tümü</button>
                <span style="color: rgba(255,255,255,0.2);">|</span>
                <button onclick="window.studioSelectAllUsers(false)" style="background: transparent; border: none; color: var(--text-muted); font-size: 0.7rem; cursor: pointer;">Temizle</button>
              </div>
            </div>

            <!-- Filter & Search -->
            <div style="position: relative;">
              <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 0.75rem; color: var(--text-muted); opacity: 0.6;"></i>
              <input type="text" id="studio-user-filter-input" placeholder="Kullanıcı veya takım ara..." oninput="window.filterStudioUsers(this.value)" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 6px 10px 6px 28px; color: #fff; font-size: 0.75rem;">
            </div>

            <!-- Role filter pill row -->
            <div style="display: flex; gap: 4px; overflow-x: auto; padding-bottom: 4px;">
              <button class="studio-role-pill active" onclick="window.filterStudioRole('ALL', this)">Tümü</button>
              <button class="studio-role-pill" onclick="window.filterStudioRole('ADMIN', this)">Admin</button>
              <button class="studio-role-pill" onclick="window.filterStudioRole('LIDER', this)">Liderler</button>
              <button class="studio-role-pill" onclick="window.filterStudioRole('TECHNICIAN', this)">Ekipler</button>
            </div>

            <!-- Users List Grouped -->
            <div id="studio-users-list-container" style="display: flex; flex-direction: column; gap: 6px;">
              ${this.renderUserSidebarList()}
            </div>
          </div>

          <!-- RIGHT: Main Interactive Content Area -->
          <div id="studio-main-workspace" class="glass-panel" style="padding: 1.5rem; border-radius: 12px; border: 1px solid rgba(255,255,255,0.08); background: rgba(13, 17, 26, 0.7); min-height: 580px;">
            ${this.renderActiveTabContent()}
          </div>

        </div>
      </div>

      <!-- Scoped Styles -->
      <style>
        .studio-tab-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--text-muted);
          padding: 8px 18px;
          border-radius: 8px;
          font-family: 'Rajdhani', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s ease;
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }
        .studio-tab-btn:hover {
          background: rgba(0, 242, 254, 0.08);
          color: #fff;
          border-color: rgba(0, 242, 254, 0.3);
        }
        .studio-tab-btn.active {
          background: linear-gradient(135deg, rgba(0, 242, 254, 0.15) 0%, rgba(0, 114, 255, 0.15) 100%);
          border-color: var(--accent-cyan);
          color: var(--accent-cyan);
          box-shadow: 0 0 15px rgba(0, 242, 254, 0.15);
        }
        .super-badge {
          background: #ef4444;
          color: #fff;
          font-size: 0.6rem;
          padding: 2px 6px;
          border-radius: 10px;
          margin-left: 6px;
          font-family: sans-serif;
          font-weight: 800;
          letter-spacing: 0.5px;
        }
        .studio-role-pill {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-muted);
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 0.68rem;
          cursor: pointer;
          white-space: nowrap;
        }
        .studio-role-pill.active {
          background: rgba(0, 242, 254, 0.15);
          color: var(--accent-cyan);
          border-color: var(--accent-cyan);
        }
        .studio-user-card {
          padding: 8px 10px;
          border-radius: 8px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          display: flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .studio-user-card:hover {
          background: rgba(0, 242, 254, 0.05);
          border-color: rgba(0, 242, 254, 0.25);
        }
        .studio-user-card.active-detail {
          background: rgba(0, 242, 254, 0.1);
          border-color: var(--accent-cyan);
        }
        .matrix-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.8rem;
        }
        .matrix-table th {
          position: sticky;
          top: 0;
          background: #0f1523;
          padding: 10px 12px;
          text-align: center;
          font-family: 'Rajdhani', sans-serif;
          font-weight: 800;
          font-size: 0.85rem;
          border: 1px solid rgba(255,255,255,0.1);
          z-index: 10;
        }
        .matrix-table td {
          padding: 8px 12px;
          border: 1px solid rgba(255,255,255,0.05);
          text-align: center;
          vertical-align: middle;
        }
        .matrix-table tr:hover td {
          background: rgba(255, 255, 255, 0.02);
        }
        .matrix-cell-diff {
          background: rgba(245, 158, 11, 0.12) !important;
          border: 1px solid rgba(245, 158, 11, 0.3) !important;
        }
        .matrix-cell-toggle-btn {
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 6px;
          padding: 5px 8px;
          font-size: 0.75rem;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          transition: all 0.18s ease;
          width: 100%;
          justify-content: center;
          font-family: inherit;
        }
        .matrix-cell-toggle-btn:hover {
          background: rgba(0, 242, 254, 0.12);
          border-color: rgba(0, 242, 254, 0.4);
          transform: translateY(-1px);
        }
        .matrix-cell-toggle-btn.active {
          background: rgba(16, 185, 129, 0.08);
          border-color: rgba(16, 185, 129, 0.25);
        }
        .matrix-cell-toggle-btn.active:hover {
          background: rgba(239, 68, 68, 0.15);
          border-color: rgba(239, 68, 68, 0.4);
        }
        .matrix-cell-toggle-btn.active:hover span, .matrix-cell-toggle-btn.active:hover i {
          color: #f87171 !important;
        }
        .matrix-cell-toggle-btn.locked-btn {
          background: rgba(239, 68, 68, 0.08) !important;
          border-color: rgba(239, 68, 68, 0.3) !important;
          cursor: not-allowed !important;
        }
        .matrix-cell-toggle-btn.locked-btn:hover {
          background: rgba(239, 68, 68, 0.2) !important;
          border-color: rgba(239, 68, 68, 0.6) !important;
          transform: none !important;
        }
        .tag-chip {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: rgba(0, 242, 254, 0.1);
          border: 1px solid rgba(0, 242, 254, 0.3);
          color: var(--accent-cyan);
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          margin: 3px;
        }
        .tag-chip .remove-btn {
          cursor: pointer;
          opacity: 0.7;
          transition: opacity 0.15s;
        }
        .tag-chip .remove-btn:hover {
          opacity: 1;
          color: #f87171;
        }
      </style>
    `;
  }

  // Render left user picker
  private renderUserSidebarList(): string {
    return this.users.map(u => {
      const uid = u.uid || u._id || u.id;
      const isChecked = this.selectedUserIds.has(uid);
      const isDetailActive = this.detailUserId === uid;
      const isLeader = u.managedTeams && u.managedTeams.length > 0;
      const anomaly = this.detectUserAnomaly(u);

      let roleBadge = '<span style="font-size: 0.6rem; color: #94a3b8;">EKİP</span>';
      if (u.role === 'ADMIN') roleBadge = '<span style="font-size: 0.6rem; color: #fde047; font-weight: 800;">ADMIN</span>';
      else if (u.role === 'MALZEME_YONETIMI') roleBadge = '<span style="font-size: 0.6rem; color: #38bdf8;">AMBAR</span>';
      else if (isLeader) roleBadge = '<span style="font-size: 0.6rem; color: #fb923c; font-weight: 700;">LİDER</span>';

      return `
        <div class="studio-user-card ${isDetailActive ? 'active-detail' : ''}" data-uid="${uid}" data-role="${u.role || ''}" data-leader="${isLeader ? 'true' : 'false'}" onclick="window.selectStudioDetailUser('${uid}')">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onclick="event.stopPropagation(); window.toggleStudioUserCompare('${uid}', this.checked)" style="cursor: pointer; width: 15px; height: 15px; accent-color: var(--accent-cyan);">
          
          <div style="flex-grow: 1; overflow: hidden;">
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
              <span style="font-weight: 700; font-size: 0.8rem; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${formatDisplayName(u.displayName || u.email || 'İsimsiz')}
              </span>
              ${anomaly ? `<span title="${anomaly}" style="color: #fbbf24; font-size: 0.75rem; cursor: help;">⚠️</span>` : ''}
            </div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 0.65rem; color: var(--text-muted);">
              <span>${u.team || (u.email || '').split('@')[0]}</span>
              <span>${roleBadge}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Detect unusual permissions given to a user role
  private detectUserAnomaly(user: any): string | null {
    if (user.role === 'ADMIN') return null;
    const tabs = user.allowedTabs || {};

    const isTechnician = user.role === 'TECHNICIAN' || user.role === 'USER';
    if (!isTechnician) return null;

    const unusual: string[] = [];
    if (tabs['material-pricing']) unusual.push('Birim Fiyatlandırma');
    if (tabs['users']) unusual.push('Kullanıcı Yetkileri');
    if (tabs['material-analytics']) unusual.push('Malzeme Analitiği');
    if (tabs['parameter-audit']) unusual.push('Parametre Denetimi');
    if (tabs['MALZEME_YONETIMI']) unusual.push('Malzeme Yönetimi');

    if (unusual.length > 0) {
      return `Teknisyen rolünde beklenmeyen yetki: ${unusual.join(', ')}`;
    }
    return null;
  }

  private calculateTotalAnomalies(): number {
    return this.users.filter(u => this.detectUserAnomaly(u) !== null).length;
  }

  // Render workspace content based on active tab
  private renderActiveTabContent(): string {
    if (this.activeTab === 'matrix') {
      return this.renderComparisonMatrix();
    } else if (this.activeTab === 'details') {
      return this.renderDetailWorkspace();
    } else if (this.activeTab === 'restricted') {
      return this.renderRestrictedModulesWorkspace();
    }
    return '';
  }

  // ==========================================
  // TAB 1: COMPARISON MATRIX
  // ==========================================
  private renderComparisonMatrix(): string {
    const selectedUsers = this.users
      .filter(u => this.selectedUserIds.has(u.uid || u._id || u.id))
      .sort((a, b) => {
        const numA = this.getTeamNumber(a);
        const numB = this.getTeamNumber(b);
        if (numA !== numB) return numA - numB;
        return (a.displayName || a.email || '').localeCompare(b.displayName || b.email || '');
      });

    if (selectedUsers.length === 0) {
      return `
        <div style="text-align: center; padding: 4rem 1rem; color: var(--text-muted);">
          <i class="fa-solid fa-table-columns" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem; display: block;"></i>
          <h3 style="color: #fff; font-family: 'Rajdhani', sans-serif;">Karşılaştırmak İçin Kullanıcı Seçiniz</h3>
          <p style="max-width: 420px; margin: 0.5rem auto; font-size: 0.85rem;">
            Sol paneldeki listeden en az 2 kullanıcı veya ekip seçerek yetkilerini yan yana karşılaştırabilir, farklılıkları tek tıkla görebilirsiniz.
          </p>
          <button class="btn-cyber" onclick="window.studioSelectSampleTeams()" style="margin-top: 1rem;">
            <i class="fa-solid fa-users"></i> Örnek Ekipleri Seç (Team 02, 04, 13)
          </button>
        </div>
      `;
    }

    // Flatten all modules to compare
    let allChecklist: { id: string; label: string; category: string; isRestricted?: boolean; isPrice?: boolean }[] = [];
    MODULE_CATEGORIES.forEach(cat => {
      if (this.categoryFilter !== 'all' && this.categoryFilter !== cat.id) return;
      cat.modules.forEach(m => {
        allChecklist.push({
          id: m.id,
          label: m.label,
          category: cat.title,
          isRestricted: m.isRestricted,
          isPrice: m.hasPriceLayer
        });
      });
    });

    // Determine differences
    const rows = allChecklist.map(item => {
      const userValues = selectedUsers.map(u => this.hasUserTab(u, item.id));
      const hasDifference = selectedUsers.length > 1 && userValues.some(v => v !== userValues[0]);
      return {
        ...item,
        userValues,
        hasDifference
      };
    });

    const displayRows = this.onlyDifferences ? rows.filter(r => r.hasDifference) : rows;
    const diffCount = rows.filter(r => r.hasDifference).length;

    return `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Matrix Controls Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; background: rgba(0,0,0,0.25); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          
          <div style="display: flex; align-items: center; gap: 14px;">
            <!-- Difference Toggle -->
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; color: #fff; cursor: pointer;">
              <input type="checkbox" ${this.onlyDifferences ? 'checked' : ''} onchange="window.toggleStudioOnlyDiff(this.checked)" style="accent-color: var(--accent-cyan); width: 16px; height: 16px;">
              <span>Sadece Farklılıkları Göster</span>
              ${diffCount > 0 ? `<span style="background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 1px 6px; border-radius: 12px; font-size: 0.7rem; font-weight: 700;">${diffCount} Fark</span>` : '<span style="color: #10b981; font-size: 0.7rem;">(Fark Yok)</span>'}
            </label>

            <!-- Category Filter -->
            <select onchange="window.filterStudioMatrixCategory(this.value)" style="background: #0f1523; border: 1px solid rgba(255,255,255,0.1); color: #fff; border-radius: 6px; padding: 4px 8px; font-size: 0.75rem;">
              <option value="all" ${this.categoryFilter === 'all' ? 'selected' : ''}>Tüm Kategoriler</option>
              <option value="management" ${this.categoryFilter === 'management' ? 'selected' : ''}>📊 Yönetim & Raporlama</option>
              <option value="operations" ${this.categoryFilter === 'operations' ? 'selected' : ''}>🔧 Saha Operasyonları</option>
              <option value="inventory" ${this.categoryFilter === 'inventory' ? 'selected' : ''}>📦 Stok & Lojistik</option>
              <option value="knowledge" ${this.categoryFilter === 'knowledge' ? 'selected' : ''}>📚 Bilgi Bankaları</option>
            </select>
          </div>

          <div style="display: flex; gap: 8px;">
            ${selectedUsers.length >= 2 ? `
              <button class="btn-cyber" onclick="window.openSyncPermissionsPrompt()" style="font-size: 0.75rem; padding: 5px 12px; height: 32px; background: rgba(0, 242, 254, 0.1);">
                <i class="fa-solid fa-copy"></i> YETKİLERİ EŞİTLE
              </button>
            ` : ''}
            <button class="btn-cyber" onclick="window.exportComparisonExcel()" style="font-size: 0.75rem; padding: 5px 12px; height: 32px; background: rgba(16, 185, 129, 0.1); border-color: rgba(16, 185, 129, 0.3); color: #10b981;">
              <i class="fa-solid fa-file-excel"></i> EXCEL FARKLAR
            </button>
          </div>
        </div>

        <!-- Matrix Table Container -->
        <div style="overflow-x: auto; max-height: calc(100vh - 350px); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
          <table class="matrix-table">
            <thead>
              <tr>
                <th style="min-width: 240px; text-align: left; padding-left: 1rem;">MODÜL / SİSTEM YETKİSİ</th>
                ${selectedUsers.map(u => `
                  <th style="min-width: 130px; color: ${u.role === 'ADMIN' ? '#ffd700' : 'var(--accent-cyan)'};">
                    <div>${formatDisplayName(u.displayName || u.email || '')}</div>
                    <div style="font-size: 0.65rem; font-weight: normal; color: var(--text-muted); font-family: sans-serif;">${u.team || u.role}</div>
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${displayRows.length === 0 ? `
                <tr>
                  <td colspan="${selectedUsers.length + 1}" style="padding: 2rem; color: var(--text-muted);">
                    Seçilen filtrede gösterilecek yetki farklılığı bulunamadı.
                  </td>
                </tr>
              ` : displayRows.map(r => `
                <tr class="${r.hasDifference ? 'matrix-row-diff' : ''}">
                  <td style="text-align: left; padding-left: 1rem;">
                    <div style="font-weight: 600; color: #fff; display: flex; align-items: center; gap: 8px;">
                      ${r.label}
                      ${r.isRestricted ? '<span title="Admin Hariç Kısıtlı Modül" style="font-size: 0.65rem; color: #f87171;"><i class="fa-solid fa-lock"></i></span>' : ''}
                      ${r.isPrice ? '<span title="Fiyat Katmanı İçerir" style="font-size: 0.65rem; color: #fbbf24;"><i class="fa-solid fa-euro-sign"></i></span>' : ''}
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-muted);">${r.category}</div>
                  </td>
                  ${selectedUsers.map((u, idx) => {
                    const uid = u.uid || u._id || u.id;
                    const val = r.userValues[idx];
                    const isRestricted = r.isRestricted || this.isRestrictedModule(r.id);
                    const isWhitelisted = this.isWhitelisted(r.id, u.email);
                    const isTechnician = u.role === 'TECHNICIAN' || u.role === 'USER' || (u.email && u.email.toLowerCase().includes('tm'));

                    // STRICT LOCK: Service technicians can NEVER have restricted/pricing modules enabled!
                    if (isRestricted && (isTechnician || (u.role !== 'ADMIN' && !isWhitelisted))) {
                      return `
                        <td class="${r.hasDifference ? 'matrix-cell-diff' : ''}" style="padding: 4px 6px;">
                          <button class="matrix-cell-toggle-btn locked-btn" 
                                  onclick="window.restrictedCellLockedNotice('${r.label}')"
                                  title="🔒 KESİN GÜVENLİK KORUMASI: Bu modül (${r.label}) kısıtlıdır. Servis ekiplerine yetki açılamaz!">
                            <i class="fa-solid fa-lock" style="color: #ef4444; font-size: 0.8rem;"></i>
                            <span style="color: #ef4444; font-weight: 700;">Kilitli</span>
                          </button>
                        </td>
                      `;
                    }

                    return `
                      <td class="${r.hasDifference ? 'matrix-cell-diff' : ''}" style="padding: 4px 6px;">
                        <button class="matrix-cell-toggle-btn ${val ? 'active' : ''}" 
                                onclick="window.quickToggleMatrixCell('${uid}', '${r.id}')"
                                title="${formatDisplayName(u.displayName || u.email)} - ${r.label}: Tıklayarak yetkiyi Aç / Kapat">
                          ${val ? `
                            <i class="fa-solid fa-circle-check" style="color: #10b981; font-size: 0.8rem;"></i>
                            <span style="color: #10b981; font-weight: 700;">Açık</span>
                          ` : `
                            <i class="fa-solid fa-circle-xmark" style="color: #64748b; font-size: 0.8rem;"></i>
                            <span style="color: #64748b;">Kapalı</span>
                          `}
                        </button>
                      </td>
                    `;
                  }).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

      </div>
    `;
  }

  // ==========================================
  // TAB 2: DETAILED PERMISSION & PRICE LAYER
  // ==========================================
  private renderDetailWorkspace(): string {
    const user = this.users.find(u => (u.uid || u._id || u.id) === this.detailUserId) || this.users[0];
    if (!user) return '<div>Kullanıcı bulunamadı</div>';

    const isLeader = user.managedTeams && user.managedTeams.length > 0;
    const tabs = user.allowedTabs || {};

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- User Profile Header Card -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0, 242, 254, 0.04); border: 1px solid rgba(0, 242, 254, 0.2); border-radius: 10px; padding: 1rem 1.25rem;">
          <div style="display: flex; align-items: center; gap: 14px;">
            <div style="width: 48px; height: 48px; border-radius: 50%; background: ${user.role === 'ADMIN' ? 'linear-gradient(135deg, #ffd700, #b8860b)' : 'rgba(255,255,255,0.08)'}; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; font-weight: 800; color: ${user.role === 'ADMIN' ? '#000' : '#fff'};">
              ${(user.displayName || user.email || 'U')[0].toUpperCase()}
            </div>
            <div>
              <div style="font-size: 1.15rem; font-weight: 800; color: #fff; font-family: 'Rajdhani', sans-serif;">
                ${formatDisplayName(user.displayName || user.email || '')}
              </div>
              <div style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px;">
                <span><i class="fa-regular fa-envelope"></i> ${user.email}</span>
                <span>•</span>
                <span>Rol: <strong style="color: var(--accent-cyan);">${user.role}</strong></span>
                ${isLeader ? `<span style="color: #f97316;">• Ekip Lideri: ${user.managedTeams.join(', ')}</span>` : ''}
                
                <!-- Password Display Pill -->
                <div style="display: inline-flex; align-items: center; gap: 6px; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.12); border-radius: 6px; padding: 2px 8px;">
                  <i class="fa-solid fa-key" style="color: #f59e0b; font-size: 0.7rem;"></i>
                  <span style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">Şifre:</span>
                  <span id="studio-pass-val-${user.uid || user._id || user.id}" style="font-family: monospace; font-size: 0.8rem; font-weight: 700; color: #fff; letter-spacing: 1px;">••••••••</span>
                  <button type="button" onclick="window.toggleStudioPassword('${user.uid || user._id || user.id}', '${user.password ? encodeURIComponent(user.password) : ''}')" style="background: transparent; border: none; color: var(--accent-cyan); cursor: pointer; padding: 2px 4px; font-size: 0.75rem; display: inline-flex; align-items: center;" title="Şifreyi Göster/Gizle">
                    <i class="fa-solid fa-eye" id="studio-pass-icon-${user.uid || user._id || user.id}"></i>
                  </button>
                  <button type="button" onclick="window.copyStudioPassword('${user.password ? encodeURIComponent(user.password) : ''}')" style="background: transparent; border: none; color: #94a3b8; cursor: pointer; padding: 2px 4px; font-size: 0.75rem; display: inline-flex; align-items: center;" title="Şifreyi Kopyala">
                    <i class="fa-regular fa-copy"></i>
                  </button>
                  <button type="button" onclick="window.promptChangeStudioUserPassword('${user.uid || user._id || user.id}')" style="background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); color: #fbbf24; border-radius: 4px; cursor: pointer; padding: 1px 6px; font-size: 0.65rem; font-weight: 700; display: inline-flex; align-items: center; gap: 3px; margin-left: 2px;" title="Şifreyi Değiştir">
                    <i class="fa-solid fa-pen"></i> Şifre Değiştir
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button class="btn-cyber" onclick="window.applyPresetTemplateToStudioUser('${user.uid || user._id || user.id}')" style="font-size: 0.75rem; padding: 6px 14px; height: 34px;">
              <i class="fa-solid fa-wand-magic-sparkles"></i> ŞABLON UYGULA
            </button>
            <button class="btn-cyber" onclick="window.saveStudioUserPermissions('${user.uid || user._id || user.id}')" style="font-size: 0.75rem; padding: 6px 16px; height: 34px; background: rgba(0, 242, 254, 0.15); border-color: var(--accent-cyan); color: #fff;">
              <i class="fa-solid fa-floppy-disk"></i> KAYDET
            </button>
          </div>
        </div>

        <!-- 4 Categorized Modules Grid -->
        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1.2rem;">
          ${MODULE_CATEGORIES.map(cat => `
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; display: flex; flex-direction: column; gap: 10px;">
              
              <!-- Category Header -->
              <div style="display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                <div style="display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1rem; color: ${cat.color};">
                  <i class="${cat.icon}"></i> ${cat.title}
                </div>
                <span style="font-size: 0.68rem; color: var(--text-muted);">${cat.modules.length} Modül</span>
              </div>

              <!-- Module List -->
              <div style="display: flex; flex-direction: column; gap: 8px;">
                ${cat.modules.map(m => {
                  const isEnabled = this.hasUserTab(user, m.id);
                  const isRestricted = m.isRestricted;
                  const isPriceLayer = m.hasPriceLayer;

                  return `
                    <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 6px; padding: 8px 12px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: #fff;">
                          <i class="${m.icon}" style="color: ${cat.color}; font-size: 0.75rem;"></i>
                          ${m.label}
                          ${isRestricted ? `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; font-size: 0.6rem; padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239, 68, 68, 0.3);">KISITLI</span>` : ''}
                        </div>
                        ${isPriceLayer ? `
                          <div style="display: flex; align-items: center; gap: 6px; font-size: 0.68rem; color: #fbbf24; margin-top: 4px;">
                            <i class="fa-solid fa-lock" style="font-size: 0.6rem;"></i> Fiyat & Maliyet Katmanı Dahil
                          </div>
                        ` : ''}
                      </div>

                      <label class="cyber-switch">
                        <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="window.toggleStudioModulePerm('${user.uid || user._id || user.id}', '${m.id}', this.checked)">
                        <span class="cyber-switch-slider"></span>
                      </label>
                    </div>
                  `;
                }).join('')}
              </div>

            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  // ==========================================
  // TAB 3: RESTRICTED MODULES & WHITELIST
  // ==========================================
  private renderRestrictedModulesWorkspace(): string {
    const isSuperAdmin = this.isUserSuperAdmin();

    return `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;">
        <!-- Top Security Banner -->
        <div style="background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(185, 28, 28, 0.05) 100%); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 1.2rem; display: flex; align-items: flex-start; gap: 14px;">
          <div style="width: 40px; height: 40px; border-radius: 8px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; color: #f87171; font-size: 1.2rem; flex-shrink: 0;">
            <i class="fa-solid fa-shield-halved"></i>
          </div>
          <div style="flex-grow: 1;">
            <div style="font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.15rem; color: #fff; letter-spacing: 0.5px;">
              Admin Üstü Kısıtlı Modül & Beyaz Liste Politikası
            </div>
            <p style="font-size: 0.8rem; color: #cbd5e1; margin: 4px 0 0 0; line-height: 1.5;">
              Bu ekrandaki modüller sistem seviyesinde korunur. **Bir kullanıcı ADMIN rolüne dahi sahip olsa**, aşağıda belirtilen Beyaz Liste'de e-posta adresi yer almıyorsa o menüyü göremez ve sayfayı açamaz.
            </p>
          </div>
          ${!isSuperAdmin ? `
            <div style="background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 6px 12px; font-size: 0.72rem; font-weight: 700;">
              <i class="fa-solid fa-eye"></i> SADECE GÖRÜNTÜLEME
            </div>
          ` : `
            <button class="btn-cyber" onclick="window.saveStudioRestrictedConfigs()" style="background: rgba(16, 185, 129, 0.15); border-color: rgba(16, 185, 129, 0.4); color: #10b981; font-size: 0.75rem; padding: 6px 14px; height: 34px;">
              <i class="fa-solid fa-floppy-disk"></i> POLİTİKALARI KAYDET
            </button>
          `}
        </div>

        <!-- Restricted Modules Cards Grid -->
        <div style="display: flex; flex-direction: column; gap: 1rem;">
          ${this.restrictedConfigs.map(item => `
            <div style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1.1rem; display: flex; flex-direction: column; gap: 10px;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div style="width: 32px; height: 32px; border-radius: 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); display: flex; align-items: center; justify-content: center; color: #f87171;">
                    <i class="${item.icon}"></i>
                  </div>
                  <div>
                    <div style="font-weight: 800; font-size: 0.95rem; color: #fff; font-family: 'Rajdhani', sans-serif;">
                      ${item.name} (${item.id})
                    </div>
                    <div style="font-size: 0.7rem; color: var(--text-muted);">${item.description}</div>
                  </div>
                </div>

                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-size: 0.7rem; color: var(--text-muted);">Erişim: <strong>${item.whitelist.length} Kullanıcı</strong></span>
                </div>
              </div>

              <!-- Whitelist Tags -->
              <div style="background: rgba(0,0,0,0.3); border: 1px dashed rgba(255,255,255,0.1); border-radius: 8px; padding: 8px 12px; display: flex; flex-wrap: wrap; align-items: center; gap: 6px; min-height: 44px;">
                <span style="font-size: 0.7rem; color: var(--text-muted); margin-right: 6px;">İzinli Kullanıcılar:</span>
                ${item.whitelist.map(email => `
                  <span class="tag-chip">
                    <span>${email}</span>
                    ${isSuperAdmin && email !== 'fatih.zebek@demirerholding.com' ? `
                      <i class="fa-solid fa-xmark remove-btn" onclick="window.removeWhitelistEmail('${item.id}', '${email}')"></i>
                    ` : ''}
                  </span>
                `).join('')}

                ${isSuperAdmin ? `
                  <div style="display: inline-flex; align-items: center; gap: 6px; margin-left: auto;">
                    <select id="whitelist-add-select-${item.id}" style="background: #0d1117; border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 0.7rem; border-radius: 4px; padding: 3px 6px;">
                      <option value="">+ Kullanıcı Seç...</option>
                      ${this.users
                        .filter(u => !item.whitelist.includes(u.email))
                        .map(u => `<option value="${u.email}">${formatDisplayName(u.displayName || u.email)} (${u.email})</option>`).join('')}
                    </select>
                    <button class="btn-cyber" onclick="window.addWhitelistEmail('${item.id}')" style="font-size: 0.68rem; padding: 2px 8px; height: 26px;">Ekle</button>
                  </div>
                ` : ''}
              </div>

            </div>
          `).join('')}
        </div>

      </div>
    `;
  }

  // Helper: check if a user has a specific tab/module enabled
  public hasUserTab(user: any, tabId: string): boolean {
    if (user.role === 'ADMIN') return true;
    const tabs = user.allowedTabs;
    if (Array.isArray(tabs)) return tabs.includes(tabId);
    if (typeof tabs === 'object' && tabs !== null) {
      const val = tabs[tabId];
      if (typeof val === 'boolean') return val;
      if (typeof val === 'object' && val !== null) return Boolean(val.access ?? true);
    }
    return false;
  }

  // Actions
  public toggleUserCompare(uid: string, checked: boolean) {
    if (checked) this.selectedUserIds.add(uid);
    else this.selectedUserIds.delete(uid);
  }

  public selectAllUsers(select: boolean) {
    if (select) {
      this.users.forEach(u => this.selectedUserIds.add(u.uid || u._id || u.id));
    } else {
      this.selectedUserIds.clear();
    }
  }

  public setTab(tab: 'matrix' | 'details' | 'restricted') {
    this.activeTab = tab;
  }

  public setDetailUser(uid: string) {
    this.detailUserId = uid;
    this.activeTab = 'details';
  }

  public setOnlyDiff(diff: boolean) {
    this.onlyDifferences = diff;
  }

  public setCategoryFilter(cat: string) {
    this.categoryFilter = cat;
  }

  public addWhitelist(moduleId: string, email: string) {
    const target = this.restrictedConfigs.find(c => c.id === moduleId);
    if (target && !target.whitelist.includes(email)) {
      target.whitelist.push(email);
      this.saveRestrictedConfigs();
    }
  }

  public removeWhitelist(moduleId: string, email: string) {
    const target = this.restrictedConfigs.find(c => c.id === moduleId);
    if (target) {
      target.whitelist = target.whitelist.filter(e => e !== email);
      this.saveRestrictedConfigs();
    }
  }

  public isRestrictedModule(moduleId: string): boolean {
    return this.restrictedConfigs.some(c => c.id === moduleId);
  }

  public isWhitelisted(moduleId: string, email: string): boolean {
    const config = this.restrictedConfigs.find(c => c.id === moduleId);
    if (!config) return false;
    const cleanEmail = (email || '').toLowerCase().trim();
    return config.whitelist.some(w => (w || '').toLowerCase().trim() === cleanEmail);
  }
}
