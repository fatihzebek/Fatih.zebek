import { materialDemandService, type MaterialDemand, type MaterialDemandItem, type MaterialDemandStatus, type CrossWarehouseStockSummary } from '../services/MaterialDemandService';
import { authService } from '../services/AuthService';
import { dataService } from '../services/DataService';

let allDemandsList: MaterialDemand[] = [];
let filteredDemandsList: MaterialDemand[] = [];
let selectedDemandSiteFilter = 'ALL';
let selectedDemandStatusFilter = 'ALL';
let selectedDemandCategoryFilter = 'ALL';
let demandSearchTerm = '';
let activeRejectDemandId = '';
let activeApproveDemandId = '';
let activeApproveDemandObj: MaterialDemand | null = null;
let activeEditingDemandId = '';
let cachedSahaSapList: Array<{ sapNo: string; description: string }> = [];

const loadSahaSapCatalog = async () => {
  if (cachedSahaSapList.length > 0) return cachedSahaSapList;
  try {
    const resp = await fetch('/sap_dictionary.json');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        cachedSahaSapList = data.map((item: any) => ({
          sapNo: String(item.n || item.sapNo || '').trim(),
          description: String(item.d || item.description || '').trim()
        }));
      } else if (typeof data === 'object' && data !== null) {
        cachedSahaSapList = Object.keys(data).map(key => ({
          sapNo: key.trim(),
          description: String(data[key]).trim()
        }));
      }
    }
  } catch (e) {
    console.error("loadSahaSapCatalog error:", e);
  }
  return cachedSahaSapList;
};

export const SahaSiparisleriPage = async (userProfile: any) => {
  const currentUser = userProfile || (window as any).currentUser || authService.getCurrentUser();
  const sites = dataService.getSortedSites();

  // Preload catalog
  loadSahaSapCatalog().catch(() => {});

  return `
    <style>
      .saha-siparis-container {
        padding: 1.25rem 1.5rem;
        max-width: 1600px;
        margin: 0 auto;
        font-family: 'Rajdhani', sans-serif;
        color: #f1f5f9;
      }

      /* Top Header */
      .saha-header-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 15px;
        margin-bottom: 1.25rem;
        padding: 1.25rem 1.5rem;
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8));
        border: 1px solid rgba(0, 243, 255, 0.2);
        border-radius: 14px;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4), 0 0 15px rgba(0, 243, 255, 0.08);
      }

      /* Stats Grid */
      .saha-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.85rem;
        margin-bottom: 1.25rem;
      }

      .saha-stat-card {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.75));
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0.9rem 1.15rem;
        box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        cursor: pointer;
        transition: all 0.2s ease;
      }
      .saha-stat-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 12px 24px -4px rgba(0, 0, 0, 0.5);
      }
      .saha-stat-card.pending { border-left: 4px solid #f59e0b; }
      .saha-stat-card.approved { border-left: 4px solid #38bdf8; }
      .saha-stat-card.ordered { border-left: 4px solid #34d399; }
      .saha-stat-card.rejected { border-left: 4px solid #ef4444; }

      .saha-stat-title {
        font-size: 0.72rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #94a3b8;
        font-weight: 700;
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .saha-stat-value {
        font-size: 1.55rem;
        font-weight: 900;
        line-height: 1;
      }

      /* Site Selector Horizontal Bar / Grid */
      .site-chip-container {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding-bottom: 6px;
        margin-bottom: 1.25rem;
        scrollbar-width: thin;
      }
      .site-chip-container::-webkit-scrollbar {
        height: 5px;
      }
      .site-chip-container::-webkit-scrollbar-thumb {
        background: rgba(0, 243, 255, 0.3);
        border-radius: 4px;
      }
      .site-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 7px 13px;
        background: rgba(15, 23, 42, 0.85);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 9px;
        font-size: 0.82rem;
        font-weight: 700;
        color: #94a3b8;
        cursor: pointer;
        white-space: nowrap;
        user-select: none;
        transition: all 0.2s ease;
      }
      .site-chip:hover {
        background: rgba(0, 243, 255, 0.08);
        border-color: rgba(0, 243, 255, 0.3);
        color: #fff;
        transform: translateY(-1px);
      }
      .site-chip.active {
        background: linear-gradient(135deg, rgba(0, 243, 255, 0.2), rgba(14, 165, 233, 0.1));
        border-color: #00f3ff;
        color: #00f3ff;
        box-shadow: 0 0 14px rgba(0, 243, 255, 0.25);
      }
      .site-chip .count-badge {
        padding: 1px 6px;
        border-radius: 8px;
        font-size: 0.68rem;
        font-weight: 800;
        background: rgba(255, 255, 255, 0.1);
        color: #cbd5e1;
      }
      .site-chip.active .count-badge {
        background: #00f3ff;
        color: #000;
      }

      /* Toolbar Search & Status */
      .saha-toolbar {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
        margin-bottom: 1.25rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
      }

      /* Cyber Buttons */
      .cyber-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 8px;
        font-family: 'Rajdhani', sans-serif;
        font-weight: 800;
        font-size: 0.82rem;
        letter-spacing: 0.4px;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
        user-select: none;
        outline: none;
      }
      .cyber-btn-cyan {
        background: linear-gradient(135deg, #00f3ff, #0284c7);
        color: #020617;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.25);
      }
      .cyber-btn-cyan:hover {
        background: linear-gradient(135deg, #38bdf8, #00f3ff);
        box-shadow: 0 0 16px rgba(0, 243, 255, 0.45);
        transform: translateY(-1px);
      }
      .cyber-btn-secondary {
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.12);
      }
      .cyber-btn-secondary:hover {
        background: rgba(255, 255, 255, 0.1);
        color: #fff;
        border-color: rgba(255, 255, 255, 0.25);
      }
      .cyber-btn-emerald {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #ffffff;
        box-shadow: 0 0 12px rgba(16, 185, 129, 0.25);
      }
      .cyber-btn-emerald:hover {
        background: linear-gradient(135deg, #34d399, #10b981);
        box-shadow: 0 0 16px rgba(16, 185, 129, 0.45);
        transform: translateY(-1px);
      }
      .cyber-btn-danger {
        background: rgba(239, 68, 68, 0.15);
        color: #ef4444;
        border: 1px solid rgba(239, 68, 68, 0.3);
      }
      .cyber-btn-danger:hover {
        background: rgba(239, 68, 68, 0.25);
        color: #fca5a5;
      }

      /* Demand Card */
      .demand-card {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(30, 41, 59, 0.78));
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 12px;
        padding: 1.1rem 1.25rem;
        margin-bottom: 1rem;
        box-shadow: 0 8px 24px -4px rgba(0, 0, 0, 0.4);
        backdrop-filter: blur(10px);
        transition: all 0.2s ease;
      }
      .demand-card:hover {
        border-color: rgba(0, 243, 255, 0.4);
        box-shadow: 0 10px 28px rgba(0, 0, 0, 0.5), 0 0 15px rgba(0, 243, 255, 0.1);
        transform: translateY(-1px);
      }
      .demand-card.status-pending { border-left: 4px solid #f59e0b; }
      .demand-card.status-approved { border-left: 4px solid #38bdf8; }
      .demand-card.status-ordered { border-left: 4px solid #34d399; }
      .demand-card.status-rejected { border-left: 4px solid #ef4444; }

      .demand-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 0.75rem;
        padding-bottom: 0.65rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      }

      .demand-title-box {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
      }
      .demand-title-text {
        font-size: 1.08rem;
        font-weight: 800;
        font-family: monospace;
        color: #00f3ff;
        letter-spacing: 0.5px;
      }

      .status-pill {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.74rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      .status-pill.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.4);
      }
      .status-pill.approved {
        background: rgba(56, 189, 248, 0.15);
        color: #38bdf8;
        border: 1px solid rgba(56, 189, 248, 0.4);
      }
      .status-pill.ordered {
        background: rgba(52, 211, 153, 0.15);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.4);
      }
      .status-pill.rejected {
        background: rgba(239, 68, 68, 0.15);
        color: #f87171;
        border: 1px solid rgba(239, 68, 68, 0.4);
      }

      .category-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 0.72rem;
        font-weight: 800;
        letter-spacing: 0.4px;
      }
      .category-pill.turbine {
        background: rgba(0, 243, 255, 0.12);
        color: #00f3ff;
        border: 1px solid rgba(0, 243, 255, 0.35);
      }
      .category-pill.consumable {
        background: rgba(245, 158, 11, 0.12);
        color: #fbbf24;
        border: 1px solid rgba(245, 158, 11, 0.35);
      }

      .days-waiting-pill {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: rgba(0, 243, 255, 0.1);
        border: 1px solid rgba(0, 243, 255, 0.3);
        padding: 2px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: 800;
        color: #00f3ff;
      }

      .demand-items-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.82rem;
      }
      .demand-items-table th {
        background: rgba(0, 0, 0, 0.35);
        padding: 7px 10px;
        color: #94a3b8;
        font-weight: 700;
        text-align: left;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .demand-items-table td {
        padding: 7px 10px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: #cbd5e1;
      }

      /* Cyber Inputs & Selects */
      .cyber-input, .cyber-select, .cyber-textarea {
        background: rgba(15, 23, 42, 0.9) !important;
        border: 1px solid rgba(0, 243, 255, 0.25) !important;
        color: #ffffff !important;
        border-radius: 8px !important;
        padding: 7px 11px !important;
        font-family: 'Rajdhani', sans-serif !important;
        font-size: 0.88rem !important;
        outline: none !important;
        width: 100% !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }
      .cyber-select option {
        background: #0f172a !important;
        color: #f8fafc !important;
      }
      .cyber-input:focus, .cyber-select:focus, .cyber-textarea:focus {
        border-color: #00f3ff !important;
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.3) !important;
      }
      .cyber-label {
        font-size: 0.74rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
        margin-bottom: 4px;
      }

      .mini-input {
        background: rgba(15, 23, 42, 0.9) !important;
        border: 1px solid rgba(0, 243, 255, 0.25) !important;
        color: #ffffff !important;
        border-radius: 4px !important;
        padding: 4px 8px !important;
        font-family: 'Rajdhani', sans-serif !important;
        font-size: 0.82rem !important;
        height: 28px !important;
        outline: none !important;
        box-sizing: border-box !important;
      }
      .mini-input:focus {
        border-color: #00f3ff !important;
        box-shadow: 0 0 8px rgba(0, 243, 255, 0.35) !important;
      }

      /* ═══════════════════════════════════════════════════════ */
      /* FIXED MODAL OVERLAY & DIALOG (FROSTED GLASS EFFECT)   */
      /* ═══════════════════════════════════════════════════════ */
      .order-modal-overlay {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        width: 100% !important;
        height: 100% !important;
        background: rgba(5, 12, 28, 0.8) !important;
        backdrop-filter: blur(10px) !important;
        -webkit-backdrop-filter: blur(10px) !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        z-index: 25000 !important;
        opacity: 0 !important;
        pointer-events: none !important;
        transition: opacity 0.2s ease !important;
        padding: 20px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
      }
      .order-modal-overlay.open {
        opacity: 1 !important;
        pointer-events: auto !important;
      }

      .order-modal {
        background: #0b1329 !important;
        border: 1px solid rgba(0, 243, 255, 0.3) !important;
        border-radius: 14px !important;
        width: 100% !important;
        max-width: 980px !important;
        max-height: 90vh !important;
        display: flex !important;
        flex-direction: column !important;
        overflow: hidden !important;
        box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.9), 0 0 25px rgba(0, 243, 255, 0.15) !important;
        transform: scale(0.97) !important;
        transition: transform 0.2s ease !important;
        box-sizing: border-box !important;
      }
      .order-modal.order-modal-pro {
        max-width: 1240px !important;
        width: 94vw !important;
      }
      .order-modal-overlay.open .order-modal {
        transform: scale(1) !important;
      }

      .order-modal-header {
        padding: 0.75rem 1.25rem !important;
        background: #070d1f !important;
        border-bottom: 1px solid rgba(0, 243, 255, 0.2) !important;
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        flex-shrink: 0 !important;
      }
      .order-modal-body {
        padding: 1.1rem 1.25rem !important;
        overflow-y: auto !important;
        flex: 1 !important;
      }
      .order-modal-footer {
        padding: 0.75rem 1.25rem !important;
        background: #070d1f !important;
        border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
        display: flex !important;
        justify-content: flex-end !important;
        gap: 8px !important;
        flex-shrink: 0 !important;
      }
    </style>

    <div class="saha-siparis-container">
      
      <!-- Top Title & Action Header -->
      <div class="saha-header-card">
        <div>
          <h1 style="font-size: 1.55rem; font-weight: 900; color: #fff; margin: 0; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-list-check" style="color: #00f3ff; text-shadow: 0 0 10px rgba(0,243,255,0.4);"></i> Saha Sipariş & Malzeme Talepleri
          </h1>
          <p style="color: #94a3b8; margin: 4px 0 0 0; font-size: 0.85rem;">
            Saha ekiplerinin malzeme talepleri, ön kontrol ve onay süreçleri, resmi sipariş takibi
          </p>
        </div>

        <div>
          <button type="button" onclick="window.openNewDemandModal()" class="cyber-btn cyber-btn-cyan" style="font-size: 0.85rem; font-weight: 800; padding: 9px 20px;">
            <i class="fa-solid fa-plus-circle"></i> + YENİ MALZEME TALEBİ OLUŞTUR
          </button>
        </div>
      </div>

      <!-- Top 4 Summary Cards -->
      <div class="saha-stats-grid">
        <div class="saha-stat-card pending" onclick="window.filterDemandStatus('PENDING_REVIEW')">
          <div class="saha-stat-title"><i class="fa-solid fa-clock" style="color: #fbbf24;"></i> Ön Kontrol Bekleyen</div>
          <div class="saha-stat-value" style="color: #fbbf24;" id="stat-demands-pending">0</div>
        </div>

        <div class="saha-stat-card approved" onclick="window.filterDemandStatus('APPROVED_FOR_ORDER')">
          <div class="saha-stat-title"><i class="fa-solid fa-check" style="color: #38bdf8;"></i> Sipariş Bekleyen (Ön Onaylı)</div>
          <div class="saha-stat-value" style="color: #38bdf8;" id="stat-demands-approved">0</div>
        </div>

        <div class="saha-stat-card ordered" onclick="window.filterDemandStatus('ORDERED')">
          <div class="saha-stat-title"><i class="fa-solid fa-truck-fast" style="color: #34d399;"></i> Siparişi Açılan (Yolda)</div>
          <div class="saha-stat-value" style="color: #34d399;" id="stat-demands-ordered">0</div>
        </div>

        <div class="saha-stat-card rejected" onclick="window.filterDemandStatus('REJECTED')">
          <div class="saha-stat-title"><i class="fa-solid fa-circle-xmark" style="color: #f87171;"></i> Reddedilen Talepler</div>
          <div class="saha-stat-value" style="color: #f87171;" id="stat-demands-rejected">0</div>
        </div>
      </div>

      <!-- Sahalar List Filter Bar -->
      <div style="margin-bottom: 0.5rem; font-size: 0.76rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; display: flex; align-items: center; gap: 6px;">
        <i class="fa-solid fa-map-location-dot" style="color: #00f3ff;"></i> Sahalar / Santraller
      </div>
      <div class="site-chip-container" id="demand-site-chips-container">
        <div class="site-chip active" data-site="ALL" onclick="window.selectDemandSite('ALL')">
          <span>TÜM SAHALAR</span>
          <span class="count-badge" id="badge-site-all">0</span>
        </div>
        ${sites.map(s => `
          <div class="site-chip" data-site="${s.id}" onclick="window.selectDemandSite('${s.id}')">
            <span>${s.name}</span>
            <span class="count-badge" id="badge-site-${s.id}">0</span>
          </div>
        `).join('')}
      </div>

      <!-- Search and Status Bar -->
      <div class="saha-toolbar">
        <div style="display: flex; align-items: center; gap: 8px; flex: 1; max-width: 450px;">
          <i class="fa-solid fa-magnifying-glass" style="color: #00f3ff;"></i>
          <input type="text" id="demand-search-input" class="cyber-input" placeholder="Talep no, malzeme tanımı, SAP no veya personel ara..." oninput="window.handleDemandSearch(this.value)" style="height: 36px; font-size: 0.85rem;">
        </div>

        <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <button type="button" class="cyber-btn cyber-btn-secondary demand-status-btn active" data-status="ALL" onclick="window.filterDemandStatus('ALL')" style="height: 32px; font-size: 0.76rem; padding: 2px 12px;">Tümü</button>
          <button type="button" class="cyber-btn cyber-btn-secondary demand-status-btn" data-status="PENDING_REVIEW" onclick="window.filterDemandStatus('PENDING_REVIEW')" style="height: 32px; font-size: 0.76rem; padding: 2px 12px; color: #fbbf24;"><i class="fa-solid fa-clock"></i> Ön Kontrolde</button>
          <button type="button" class="cyber-btn cyber-btn-secondary demand-status-btn" data-status="APPROVED_FOR_ORDER" onclick="window.filterDemandStatus('APPROVED_FOR_ORDER')" style="height: 32px; font-size: 0.76rem; padding: 2px 12px; color: #38bdf8;"><i class="fa-solid fa-check"></i> Ön Onaylı</button>
          <button type="button" class="cyber-btn cyber-btn-secondary demand-status-btn" data-status="ORDERED" onclick="window.filterDemandStatus('ORDERED')" style="height: 32px; font-size: 0.76rem; padding: 2px 12px; color: #34d399;"><i class="fa-solid fa-truck-fast"></i> Siparişi Açılan</button>
          <button type="button" class="cyber-btn cyber-btn-secondary demand-status-btn" data-status="REJECTED" onclick="window.filterDemandStatus('REJECTED')" style="height: 32px; font-size: 0.76rem; padding: 2px 12px; color: #f87171;"><i class="fa-solid fa-circle-xmark"></i> Reddedilen</button>
        </div>
      </div>

      <!-- Demands List Container -->
      <div id="demands-list-container">
        <div style="text-align: center; padding: 3rem; color: #94a3b8;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00f3ff; margin-bottom: 10px;"></i>
          <div>Talepler yükleniyor...</div>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: YENİ MALZEME TALEBİ OLUŞTUR                       -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="new-demand-modal">
      <div class="order-modal">
        <div class="order-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i id="demand-modal-icon" class="fa-solid fa-plus-circle" style="color: #00f3ff; font-size: 1.1rem;"></i>
            <strong id="demand-modal-title" style="color: #fff; font-size: 0.95rem;">Yeni Saha Malzeme Talebi Oluştur</strong>
          </div>
          <button type="button" onclick="window.closeNewDemandModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.8rem; height: 26px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="create-demand-form" onsubmit="window.handleCreateDemandSubmit(event)">
          <div class="order-modal-body">
            
            <!-- Category Switcher & Details Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 12px; background: rgba(15, 23, 42, 0.6); padding: 12px 14px; border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1.25rem;">
              
              <!-- Malzeme Kategorisi Seçimi -->
              <div>
                <label class="cyber-label"><i class="fa-solid fa-layer-group" style="color: #c084fc;"></i> Malzeme Kategorisi <span style="color: #ef4444;">*</span></label>
                <select id="new-demand-category" class="cyber-select" required onchange="window.handleDemandCategoryChange(this.value)">
                  <option value="TURBINE">⚡ Türbin Malzemesi (Enercon / SAP'lı)</option>
                  <option value="CONSUMABLE">🏢 Genel Sarf Malzeme & Piyasa (Bez, Boya, Sprey vb.)</option>
                </select>
              </div>

              <div>
                <label class="cyber-label"><i class="fa-solid fa-wind" style="color: #00f3ff;"></i> Saha / Santral <span style="color: #ef4444;">*</span></label>
                <select id="new-demand-site" class="cyber-select" required onchange="window.updateDemandTurbineOptions(this.value)">
                  <option value="">-- Saha Seçiniz --</option>
                  ${sites.map(s => `<option value="${s.id}" data-name="${s.name}">${s.name}</option>`).join('')}
                </select>
              </div>

              <div>
                <label class="cyber-label"><i class="fa-solid fa-tower-broadcast" style="color: #38bdf8;"></i> Türbin / Lokasyon</label>
                <select id="new-demand-turbine" class="cyber-select">
                  <option value="">Genel Saha İhtiyacı</option>
                </select>
              </div>

              <div>
                <label class="cyber-label"><i class="fa-solid fa-triangle-exclamation" style="color: #f59e0b;"></i> Talep Aciliyeti <span style="color: #ef4444;">*</span></label>
                <select id="new-demand-urgency" class="cyber-select" required>
                  <option value="NORMAL">⚪ Normal İhtiyaç / Stok</option>
                  <option value="ACIL_ARIZA">🔴 Acil Arıza / Duruş</option>
                  <option value="PERIYODIK_BAKIM">🟡 Periyodik Bakım</option>
                </select>
              </div>
            </div>

            <!-- Items Table -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <span style="font-size: 0.8rem; font-weight: 800; color: #00f3ff; text-transform: uppercase;">
                <i class="fa-solid fa-boxes-stacked"></i> Talep Edilen Malzemeler
              </span>
              <button type="button" onclick="window.addNewDemandItemRow()" class="cyber-btn cyber-btn-secondary" style="font-size: 0.75rem; padding: 3px 12px; height: 26px;">
                <i class="fa-solid fa-plus"></i> + Kalem Ekle
              </button>
            </div>

            <div style="overflow-x: auto; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1rem;">
              <table class="demand-items-table">
                <thead>
                  <tr id="new-demand-table-header">
                    <th id="th-demand-sap" style="width: 140px; color: #00f3ff;">SAP NO</th>
                    <th style="color: #fff;">MALZEME TANIMI / AÇIKLAMASI <span style="color: #ef4444;">*</span></th>
                    <th style="width: 80px; text-align: center; color: #34d399;">MİKTAR</th>
                    <th style="width: 90px;">BİRİM</th>
                    <th>İHTİYAÇ / ARIZA GEREKÇESİ</th>
                    <th style="width: 40px; text-align: center;"></th>
                  </tr>
                </thead>
                <tbody id="new-demand-items-tbody">
                </tbody>
              </table>
            </div>

            <!-- General Note -->
            <div>
              <label class="cyber-label"><i class="fa-regular fa-comment-dots" style="color: #fbbf24;"></i> Talep Hakkında Genel Açıklama / Not:</label>
              <textarea id="new-demand-general-note" class="cyber-textarea" rows="2" placeholder="Arıza durumu, kime teslim edileceği vb. detayları yazabilirsiniz..."></textarea>
            </div>

          </div>

          <div class="order-modal-footer">
            <button type="button" onclick="window.closeNewDemandModal()" class="cyber-btn cyber-btn-secondary">İPTAL</button>
            <button type="submit" id="btn-submit-demand" class="cyber-btn cyber-btn-cyan" style="font-weight: 800;">
              <i class="fa-solid fa-paper-plane"></i> TALEBİ OLUŞTUR VE ONAYA GÖNDER
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: ÖN KONTROL ONAY & KALEM BAZLI DEĞERLENDİRME MODALI -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="approve-demand-modal">
      <div class="order-modal order-modal-pro" style="max-height: 90vh;">
        <div class="order-modal-header" style="border-color: rgba(52, 211, 153, 0.3); padding: 0.85rem 1.35rem;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-clipboard-check" style="color: #34d399; font-size: 1.25rem;"></i>
            <div>
              <strong style="color: #fff; font-size: 1.05rem; letter-spacing: 0.5px;">Talebi Kalem Bazlı Ön Kontrol Et & Onayla</strong>
              <div style="font-size: 0.74rem; color: #94a3b8; margin-top: 1px;">Her kalem için satınalma onayı, transfer veya sahadaki mevcut stoğu kullanma kararı verebilirsiniz.</div>
            </div>
          </div>
          <button type="button" onclick="window.closeApproveDemandModal()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 8px; font-size: 0.85rem; height: 28px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="approve-demand-form" onsubmit="window.handleConfirmApproveDemand(event)">
          <div class="order-modal-body" style="padding: 1.15rem 1.35rem;">
            
            <div id="approve-modal-summary-box" style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.8)); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 10px; padding: 10px 14px; margin-bottom: 1rem; font-size: 0.88rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
            </div>

            <div style="font-size: 0.82rem; font-weight: 800; color: #00f3ff; text-transform: uppercase; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-boxes-stacked"></i> Kalem Bazlı Yönetici Kararları & Özel Talimatlar
            </div>

            <div style="overflow-x: auto; background: rgba(0, 0, 0, 0.35); border-radius: 10px; border: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 1rem;">
              <table class="demand-items-table" style="width: 100%; border-collapse: separate; border-spacing: 0;">
                <thead>
                  <tr style="background: rgba(15, 23, 42, 0.95);">
                    <th style="color: #fff; width: 34%; padding: 10px 14px;">MALZEME TANIMI & SAP</th>
                    <th style="width: 8%; text-align: center; color: #94a3b8; padding: 10px 6px;">İSTENEN</th>
                    <th style="width: 190px; color: #38bdf8; padding: 10px 12px;">YÖNETİCİ KARARI</th>
                    <th style="width: 110px; text-align: center; color: #34d399; padding: 10px 8px;">ONAY MİKTARI</th>
                    <th style="padding: 10px 14px; color: #cbd5e1;">KALEM TALİMATI / AÇIKLAMA (ÖZEL NOT)</th>
                  </tr>
                </thead>
                <tbody id="approve-modal-items-tbody">
                </tbody>
              </table>
            </div>

            <div>
              <label class="cyber-label"><i class="fa-solid fa-comment-check" style="color: #34d399;"></i> Genel Talep Notu / Yönetici Değerlendirmesi:</label>
              <textarea id="approve-demand-note-input" class="cyber-textarea" rows="2" placeholder="Örn: 1. ve 3. kalem için sipariş onaylandı, diğer kalemler için transfer açınız..."></textarea>
            </div>

          </div>

          <div class="order-modal-footer" style="padding: 0.9rem 1.4rem;">
            <button type="button" onclick="window.closeApproveDemandModal()" class="cyber-btn cyber-btn-secondary" style="padding: 6px 16px;">VAZGEÇ</button>
            <button type="submit" id="btn-confirm-approve" class="cyber-btn cyber-btn-emerald" style="font-weight: 800; font-size: 0.88rem; padding: 7px 22px;">
              <i class="fa-solid fa-check"></i> ONAYLA VE MALZEME YÖNETİMİNE İLET
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: TALEP REDDETME GEREKÇESİ                          -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="reject-demand-modal">
      <div class="order-modal" style="max-width: 520px;">
        <div class="order-modal-header" style="border-color: rgba(239, 68, 68, 0.3);">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-circle-xmark" style="color: #ef4444; font-size: 1.1rem;"></i>
            <strong style="color: #fff; font-size: 0.9rem;">Saha Talebini Reddet</strong>
          </div>
          <button type="button" onclick="window.closeRejectDemandModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.8rem; height: 26px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="reject-demand-form" onsubmit="window.handleConfirmRejectDemand(event)">
          <div class="order-modal-body">
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-bottom: 0.75rem;">
              Lütfen bu malzemenin neden uygun olmadığını veya reddedilme gerekçesini yazınız. Teknisyen bu gerekçeyi kendi ekranında görecektir.
            </p>
            <label class="cyber-label"><i class="fa-solid fa-comment-pen" style="color: #ef4444;"></i> Ret Gerekçesi <span style="color: #ef4444;">*</span></label>
            <textarea id="reject-demand-reason-input" class="cyber-textarea" rows="3" required placeholder="Örn: Bu parça merkez depoda mevcut, transfer açınız veya muadili kullanılmalıdır..."></textarea>
          </div>

          <div class="order-modal-footer">
            <button type="button" onclick="window.closeRejectDemandModal()" class="cyber-btn cyber-btn-secondary">VAZGEÇ</button>
            <button type="submit" id="btn-confirm-reject" class="cyber-btn cyber-btn-danger" style="font-weight: 800;">
              <i class="fa-solid fa-ban"></i> TALEBİ REDDET
            </button>
          </div>
        </form>
      </div>
    </div>
  `;
};

// Global Init & Subscription
let demandsUnsubscribe: (() => void) | null = null;

(window as any).initSahaSiparisleriPage = () => {
  if (demandsUnsubscribe) {
    demandsUnsubscribe();
  }

  loadSahaSapCatalog().catch(() => {});

  demandsUnsubscribe = materialDemandService.subscribeDemands((demands) => {
    allDemandsList = demands;
    (window as any).applyDemandFilters();
  });
};

(window as any).selectDemandSite = (siteId: string) => {
  selectedDemandSiteFilter = siteId;
  document.querySelectorAll('#demand-site-chips-container .site-chip').forEach((chip: any) => {
    if (chip.dataset.site === siteId) {
      chip.classList.add('active');
    } else {
      chip.classList.remove('active');
    }
  });
  (window as any).applyDemandFilters();
};

(window as any).filterDemandStatus = (status: string) => {
  selectedDemandStatusFilter = status;
  document.querySelectorAll('.demand-status-btn').forEach((btn: any) => {
    if (btn.dataset.status === status) {
      btn.classList.add('active');
      btn.style.background = 'rgba(0, 243, 255, 0.2)';
      btn.style.borderColor = '#00f3ff';
    } else {
      btn.classList.remove('active');
      btn.style.background = 'rgba(255, 255, 255, 0.05)';
      btn.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }
  });
  (window as any).applyDemandFilters();
};

(window as any).handleDemandSearch = (term: string) => {
  demandSearchTerm = term.trim().toLowerCase();
  (window as any).applyDemandFilters();
};

(window as any).applyDemandFilters = () => {
  // Update Top Stats
  const statPending = document.getElementById('stat-demands-pending');
  const statApproved = document.getElementById('stat-demands-approved');
  const statOrdered = document.getElementById('stat-demands-ordered');
  const statRejected = document.getElementById('stat-demands-rejected');

  const countPending = allDemandsList.filter(d => d.status === 'PENDING_REVIEW').length;
  const countApproved = allDemandsList.filter(d => d.status === 'APPROVED_FOR_ORDER').length;
  const countOrdered = allDemandsList.filter(d => d.status === 'ORDERED').length;
  const countRejected = allDemandsList.filter(d => d.status === 'REJECTED').length;

  if (statPending) statPending.innerText = String(countPending);
  if (statApproved) statApproved.innerText = String(countApproved);
  if (statOrdered) statOrdered.innerText = String(countOrdered);
  if (statRejected) statRejected.innerText = String(countRejected);

  // Update site chip counts
  const badgeAll = document.getElementById('badge-site-all');
  if (badgeAll) badgeAll.innerText = String(allDemandsList.length);

  const sites = dataService.getSites();
  sites.forEach(s => {
    const badge = document.getElementById(`badge-site-${s.id}`);
    if (badge) {
      const siteCount = allDemandsList.filter(d => d.siteId === s.id).length;
      badge.innerText = String(siteCount);
    }
  });

  // Filter demands list
  filteredDemandsList = allDemandsList.filter(d => {
    if (selectedDemandSiteFilter !== 'ALL' && d.siteId !== selectedDemandSiteFilter) return false;
    if (selectedDemandStatusFilter !== 'ALL' && d.status !== selectedDemandStatusFilter) return false;
    if (selectedDemandCategoryFilter !== 'ALL' && d.demandCategory !== selectedDemandCategoryFilter) return false;
    if (demandSearchTerm) {
      const matchNo = d.demandNo.toLowerCase().includes(demandSearchTerm) || d.title.toLowerCase().includes(demandSearchTerm);
      const matchSite = d.siteName.toLowerCase().includes(demandSearchTerm);
      const matchRequester = d.requesterName.toLowerCase().includes(demandSearchTerm);
      const matchItems = (d.items || []).some(i => (i.description || '').toLowerCase().includes(demandSearchTerm) || (i.sapNo || '').toLowerCase().includes(demandSearchTerm));
      if (!matchNo && !matchSite && !matchRequester && !matchItems) return false;
    }
    return true;
  });

  (window as any).renderDemandsList();
};

(window as any).renderDemandsList = () => {
  const container = document.getElementById('demands-list-container');
  if (!container) return;

  if (filteredDemandsList.length === 0) {
    container.innerHTML = `
      <div class="cyber-card" style="text-align: center; padding: 3.5rem 1.5rem; color: #94a3b8; background: rgba(15, 23, 42, 0.7); border: 1px dashed rgba(255, 255, 255, 0.12); border-radius: 14px;">
        <i class="fa-solid fa-box-open" style="font-size: 2.8rem; color: #64748b; margin-bottom: 12px;"></i>
        <h3 style="color: #fff; margin: 0 0 6px 0; font-size: 1.15rem;">Kayıtlı Talep Bulunamadı</h3>
        <p style="font-size: 0.85rem; margin: 0;">Seçilen filtre ve sahada herhangi bir malzeme talebi yer almıyor.</p>
      </div>
    `;
    return;
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const isManagerOrAdmin = currentUser?.role === 'ADMIN' || 
    currentUser?.role === 'MALZEME_YONETIMI' || 
    currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' ||
    currentUser?.email?.toLowerCase() === 'emir.unver@demirerholding.com' ||
    currentUser?.email?.toLowerCase().includes('fatih.zebek');

  const statusMap: Record<MaterialDemandStatus, { label: string; class: string; icon: string }> = {
    'PENDING_REVIEW': { label: 'Ön Kontrol Bekliyor', class: 'pending', icon: 'fa-clock' },
    'APPROVED_FOR_ORDER': { label: 'Ön Onaylı (Sipariş Bekliyor)', class: 'approved', icon: 'fa-check' },
    'ORDERED': { label: 'Siparişi Açıldı (Yolda)', class: 'ordered', icon: 'fa-truck-fast' },
    'REJECTED': { label: 'Reddedildi', class: 'rejected', icon: 'fa-circle-xmark' },
    'DELIVERED': { label: 'Teslim Alındı', class: 'ordered', icon: 'fa-boxes-packing' }
  };

  container.innerHTML = filteredDemandsList.map(demand => {
    const st = statusMap[demand.status] || { label: demand.status, class: 'pending', icon: 'fa-clock' };
    const createdAtDate = demand.createdAt ? demand.createdAt.split('T')[0] : '';
    const isConsumable = demand.demandCategory === 'CONSUMABLE';
    
    // Calculate elapsed waiting days if ORDERED
    let elapsedDaysText = '';
    if (demand.status === 'ORDERED') {
      const orderDateObj = demand.orderDate ? new Date(demand.orderDate) : new Date(demand.createdAt);
      const diffMs = Date.now() - orderDateObj.getTime();
      const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      elapsedDaysText = `⏳ ${days === 0 ? 'Bugün açıldı' : `${days} gündür sevkiyat bekleniyor`}`;
    }

    const urgencyLabels: Record<string, string> = {
      'ACIL_ARIZA': '<span style="color: #f87171; font-weight: 800; background: rgba(239,68,68,0.12); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.3); font-size: 0.74rem;"><i class="fa-solid fa-triangle-exclamation"></i> ACİL ARIZA</span>',
      'PERIYODIK_BAKIM': '<span style="color: #fbbf24; font-weight: 800; background: rgba(245,158,11,0.12); padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(245,158,11,0.3); font-size: 0.74rem;"><i class="fa-solid fa-wrench"></i> PERİYODİK BAKIM</span>',
      'NORMAL': '<span style="color: #94a3b8; font-weight: 700; font-size: 0.74rem;">NORMAL İHTİYAÇ</span>'
    };

    return `
      <div class="demand-card status-${st.class}" style="padding: 10px 14px; margin-bottom: 0.65rem; border-radius: 10px;">
        
        <!-- COMPACT HEADER ROW (ZARİF & TEK SATIRDA ÖZET) -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          
          <!-- Sol Bilgi Grubu: Başlık, Durum, Tür, Saha, Kalem Sayısı -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span class="demand-title-text" style="font-size: 0.92rem; font-weight: 800; font-family: monospace;">[ ${demand.title} ]</span>
            <span class="status-pill ${st.class}" style="font-size: 0.72rem; padding: 2px 8px;">
              <i class="fa-solid ${st.icon}"></i> ${st.label}
            </span>
            <span class="category-pill ${isConsumable ? 'consumable' : 'turbine'}" style="font-size: 0.72rem; padding: 2px 8px;">
              <i class="fa-solid ${isConsumable ? 'fa-boxes-packing' : 'fa-bolt'}"></i> ${isConsumable ? 'SARF / PİYASA' : 'TÜRBİN PARÇASI'}
            </span>
            ${elapsedDaysText ? `<span class="days-waiting-pill" style="font-size: 0.72rem; padding: 2px 8px;">${elapsedDaysText}</span>` : ''}
            ${demand.urgency ? urgencyLabels[demand.urgency] : ''}
            <span style="color: #64748b; font-size: 0.76rem;">•</span>
            <span style="color: #cbd5e1; font-size: 0.8rem; font-weight: 700;">
              <i class="fa-solid fa-location-dot" style="color: #00f3ff;"></i> ${demand.siteName} ${demand.turbineId ? `(${demand.turbineId})` : ''}
            </span>
            <span style="color: #64748b; font-size: 0.76rem;">•</span>
            <span style="background: rgba(0, 243, 255, 0.1); color: #00f3ff; border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 4px; padding: 1px 8px; font-size: 0.74rem; font-weight: 800;">
              <i class="fa-solid fa-boxes-stacked"></i> ${(demand.items || []).length} Kalem
            </span>
          </div>

          <!-- Sağ İşlem Grubu: Talep Eden, Sipariş No, Ön Kontrol & Detay Butonları -->
          <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
            <span style="color: #94a3b8; font-size: 0.76rem; margin-right: 4px;">
              <i class="fa-solid fa-user-circle" style="color: #38bdf8;"></i> <strong style="color: #fff;">${demand.requesterName}</strong> 
              <span style="color: #64748b;">(${createdAtDate})</span>
            </span>

            ${demand.orderNo ? `
              <span style="background: rgba(52, 211, 153, 0.15); padding: 4px 9px; border-radius: 4px; border: 1px solid rgba(52, 211, 153, 0.35); color: #34d399; font-size: 0.74rem; font-weight: 800;">
                <i class="fa-solid fa-file-invoice"></i> Sipariş No: <strong style="color: #fff; font-family: monospace; letter-spacing: 0.5px;">${demand.orderNo}</strong>
              </span>
            ` : ''}

            ${((isManagerOrAdmin || demand.requesterId === currentUser?.uid) && (demand.status === 'PENDING_REVIEW' || demand.status === 'APPROVED_FOR_ORDER')) ? `
              <button type="button" onclick="window.openEditDemandModal('${demand.id}')" class="cyber-btn cyber-btn-secondary" style="font-size: 0.74rem; padding: 4px 10px; height: 28px; font-weight: 700; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; background: rgba(56, 189, 248, 0.08);" title="Talebe Yeni Kalem Ekle veya Düzenle">
                <i class="fa-solid fa-pen-to-square"></i> Kalem Ekle / Düzenle
              </button>
            ` : ''}

            ${(isManagerOrAdmin && demand.status === 'PENDING_REVIEW') ? `
              <button type="button" onclick="window.openApproveDemandModal('${demand.id}')" class="cyber-btn cyber-btn-emerald" style="font-size: 0.74rem; padding: 4px 12px; height: 28px; font-weight: 800;">
                <i class="fa-solid fa-clipboard-check"></i> ÖN KONTROL & ONAYLA
              </button>
            ` : ''}

            <button type="button" id="btn-toggle-detail-${demand.id}" onclick="window.toggleDemandDetails('${demand.id}')" class="cyber-btn cyber-btn-secondary" style="font-size: 0.74rem; padding: 4px 10px; height: 28px; font-weight: 700; border-color: rgba(0, 243, 255, 0.3); color: #00f3ff;">
              <i class="fa-solid fa-chevron-down"></i> Detay Göster
            </button>

            ${(isManagerOrAdmin || demand.requesterId === currentUser?.uid) ? `
              <button type="button" onclick="window.handleDeleteDemand('${demand.id}')" class="cyber-btn cyber-btn-secondary" style="font-size: 0.72rem; padding: 3px 8px; height: 28px; border-color: rgba(239, 68, 68, 0.3); color: #f87171;" title="Talebi Sil">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : ''}
          </div>

        </div>

        <!-- ACCORDION COLLAPSIBLE DETAIL BODY (VARSAYILAN OLARAK KAPALI) -->
        <div id="demand-detail-${demand.id}" style="display: none; padding-top: 10px; margin-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.08);">
          
          <!-- Personel Notu (Varsa) -->
          ${demand.generalNote ? `
            <div style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 6px; padding: 6px 12px; margin-bottom: 0.65rem; font-size: 0.78rem; color: #fbbf24;">
              <i class="fa-regular fa-comment-dots"></i> <strong>Personel Genel Açıklaması:</strong> ${demand.generalNote}
            </div>
          ` : ''}

          <!-- Review / Action Note Callout Banner if exists -->
          ${(demand.reviewNote && demand.status !== 'REJECTED') ? `
            <div style="background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 8px; padding: 8px 12px; margin-bottom: 0.65rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
              <div>
                <strong style="color: #00f3ff;"><i class="fa-solid fa-clipboard-check"></i> Genel Yönetici Notu:</strong>
                <span style="color: #e2e8f0; margin-left: 6px;">${demand.reviewNote}</span>
                <span style="color: #94a3b8; font-size: 0.72rem; margin-left: 6px;">(${demand.reviewedByName || 'Yönetici'} • ${demand.reviewedAt ? demand.reviewedAt.split('T')[0] : ''})</span>
              </div>
            </div>
          ` : ''}

          <!-- Rejection Notice Banner if REJECTED -->
          ${demand.status === 'REJECTED' ? `
            <div style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.3); padding: 8px 12px; border-radius: 8px; margin-bottom: 0.65rem; font-size: 0.8rem;">
              <strong style="color: #f87171;"><i class="fa-solid fa-circle-exclamation"></i> Ret Gerekçesi:</strong>
              <span style="color: #cbd5e1; margin-left: 4px;">${demand.reviewNote || 'Gerekçe belirtilmedi.'}</span>
              <span style="color: #64748b; font-size: 0.72rem; margin-left: 6px;">(${demand.reviewedByName || 'Yönetici'} • ${demand.reviewedAt ? demand.reviewedAt.split('T')[0] : ''})</span>
            </div>
          ` : ''}

          <!-- Items Table -->
          <div style="overflow-x: auto; background: rgba(0, 0, 0, 0.3); border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.06); margin-bottom: 0.5rem;">
            <table class="demand-items-table" style="width: 100%; border-collapse: collapse;">
              <thead>
                <tr style="background: rgba(15, 23, 42, 0.8);">
                  ${!isConsumable ? '<th style="width: 120px; color: #00f3ff; padding: 8px 10px;">SAP NO</th>' : ''}
                  <th style="color: #fff; padding: 8px 10px;">MALZEME TANIMI</th>
                  <th style="width: 110px; text-align: center; color: #34d399; padding: 8px 10px;">ONAY MİKTARI</th>
                  ${(demand.status === 'ORDERED' || demand.status === 'DELIVERED' || demand.orderNo) ? `
                    <th style="width: 230px; text-align: center; color: #38bdf8; padding: 8px 10px;">TESLİMAT / GELEN DURUMU</th>
                  ` : ''}
                  <th style="width: 160px; color: #38bdf8; padding: 8px 10px;">YÖNETİCİ KARARI</th>
                  <th style="padding: 8px 10px;">YÖNETİCİ TALİMATI / GEREKÇE</th>
                </tr>
              </thead>
              <tbody>
                ${(demand.items || []).map(i => {
                  const decision = i.itemDecision || (demand.status === 'APPROVED_FOR_ORDER' || demand.status === 'ORDERED' || demand.status === 'DELIVERED' ? 'APPROVE_PURCHASE' : (demand.status === 'REJECTED' ? 'REJECT' : 'PENDING'));
                  
                  let decisionBadge = '<span style="color: #94a3b8; font-size: 0.74rem;">Beklemede</span>';
                  if (decision === 'APPROVE_PURCHASE') {
                    decisionBadge = `
                      <span style="background: rgba(52, 211, 153, 0.15); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                        <i class="fa-solid fa-cart-shopping"></i> Satınalma (${i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity} ${i.unit || 'Adet'})
                      </span>
                    `;
                  } else if (decision === 'TRANSFER') {
                    decisionBadge = `
                      <span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                        <i class="fa-solid fa-truck-ramp-box"></i> Transfer Edilsin
                      </span>
                    `;
                  } else if (decision === 'USE_LOCAL_STOCK') {
                    decisionBadge = `
                      <span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                        <i class="fa-solid fa-box-archive"></i> Sahadaki Stoktan Kullan
                      </span>
                    `;
                  } else if (decision === 'REJECT') {
                    decisionBadge = `
                      <span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                        <i class="fa-solid fa-ban"></i> Reddedildi
                      </span>
                    `;
                  }

                  const hasApprovedDiff = (i.approvedQuantity !== undefined && i.approvedQuantity !== i.quantity && decision === 'APPROVE_PURCHASE');
                  const isOrderActive = (demand.status === 'ORDERED' || demand.status === 'DELIVERED' || demand.orderNo);
                  const targetQty = i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity;
                  const deliveredQty = Number(i.deliveredQuantity || 0);
                  const remainingQty = Math.max(0, targetQty - deliveredQty);

                  let deliveryStatusCell = '';
                  if (isOrderActive) {
                    if (decision === 'APPROVE_PURCHASE') {
                      if (deliveredQty >= targetQty && targetQty > 0) {
                        deliveryStatusCell = `
                          <td style="padding: 8px 10px; text-align: center;">
                            <div style="background: rgba(52, 211, 153, 0.15); border: 1px solid rgba(52, 211, 153, 0.35); border-radius: 6px; padding: 4px 8px; display: inline-block; text-align: center; min-width: 190px;">
                              <span style="color: #34d399; font-weight: 900; font-size: 0.78rem;">
                                <i class="fa-solid fa-circle-check"></i> ${deliveredQty} / ${targetQty} ${i.unit || 'Adet'}
                              </span>
                              <div style="font-size: 0.7rem; color: #a7f3d0; font-weight: 800; margin-top: 1px;">Kalan: 0 • Tamamı Teslim Alındı</div>
                            </div>
                          </td>
                        `;
                      } else if (deliveredQty > 0) {
                        deliveryStatusCell = `
                          <td style="padding: 8px 10px; text-align: center;">
                            <div style="background: rgba(56, 189, 248, 0.15); border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 6px; padding: 4px 8px; display: inline-block; text-align: center; min-width: 190px;">
                              <span style="color: #38bdf8; font-weight: 900; font-size: 0.78rem;">
                                <i class="fa-solid fa-boxes-stacked"></i> ${deliveredQty} / ${targetQty} ${i.unit || 'Adet'} Geldi
                              </span>
                              <div style="font-size: 0.7rem; color: #fbbf24; font-weight: 800; margin-top: 1px;">Kalan: ${remainingQty} ${i.unit || 'Adet'} Bekleniyor</div>
                            </div>
                          </td>
                        `;
                      } else {
                        deliveryStatusCell = `
                          <td style="padding: 8px 10px; text-align: center;">
                            <div style="background: rgba(251, 191, 36, 0.08); border: 1px solid rgba(251, 191, 36, 0.25); border-radius: 6px; padding: 4px 8px; display: inline-block; text-align: center; min-width: 190px;">
                              <span style="color: #fbbf24; font-weight: 700; font-size: 0.76rem;">
                                <i class="fa-solid fa-truck-fast"></i> 0 / ${targetQty} ${i.unit || 'Adet'}
                              </span>
                              <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 1px;">Yolda (Henüz Gelmedi)</div>
                            </div>
                          </td>
                        `;
                      }
                    } else {
                      deliveryStatusCell = `<td style="padding: 8px 10px; text-align: center; color: #64748b; font-size: 0.74rem;">-</td>`;
                    }
                  }

                  return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    ${!isConsumable ? `<td style="padding: 8px 10px;"><span style="font-family: monospace; color: #00f3ff; font-weight: 800;">${i.sapNo || '-'}</span></td>` : ''}
                    <td style="padding: 8px 10px;">
                      <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">${i.description}</div>
                    </td>
                    <td style="text-align: center; padding: 8px 10px;">
                      ${hasApprovedDiff ? `
                        <div style="color: #34d399; font-weight: 900; font-size: 0.85rem;">${i.approvedQuantity} ${i.unit || 'Adet'}</div>
                        <div style="color: #94a3b8; font-size: 0.7rem; text-decoration: line-through;">Talep: ${i.quantity} ${i.unit || 'Adet'}</div>
                      ` : `
                        <strong style="color: #34d399;">${i.quantity} ${i.unit || 'Adet'}</strong>
                      `}
                    </td>
                    ${deliveryStatusCell}
                    <td style="padding: 8px 10px;">${decisionBadge}</td>
                    <td style="padding: 8px 10px;">
                      ${i.managerItemNote ? `
                        <div style="color: #38bdf8; font-size: 0.76rem; font-weight: 700; background: rgba(56, 189, 248, 0.08); padding: 2px 8px; border-radius: 4px; border-left: 3px solid #38bdf8; margin-bottom: 2px;">
                          <i class="fa-solid fa-comment-pen"></i> ${i.managerItemNote}
                        </div>
                      ` : ''}
                      ${i.reason ? `<div style="color: #94a3b8; font-size: 0.72rem; font-style: italic;">Talep: ${i.reason}</div>` : ''}
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>

          <!-- Pending Review Extra Actions (Tümünü Reddet vb.) -->
          ${(isManagerOrAdmin && demand.status === 'PENDING_REVIEW') ? `
            <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 6px;">
              <button type="button" onclick="window.openRejectDemandModal('${demand.id}')" class="cyber-btn cyber-btn-danger" style="font-size: 0.74rem; padding: 3px 12px; height: 26px; font-weight: 800;">
                <i class="fa-solid fa-xmark"></i> TÜMÜNÜ REDDET
              </button>
            </div>
          ` : ''}

        </div>

      </div>
    `;
  }).join('');
};

(window as any).toggleDemandDetails = (demandId: string) => {
  const detailEl = document.getElementById(`demand-detail-${demandId}`);
  const btnEl = document.getElementById(`btn-toggle-detail-${demandId}`);
  if (detailEl && btnEl) {
    const isCurrentlyOpen = detailEl.style.display !== 'none';
    detailEl.style.display = isCurrentlyOpen ? 'none' : 'block';
    btnEl.innerHTML = isCurrentlyOpen
      ? '<i class="fa-solid fa-chevron-down"></i> Detay Göster'
      : '<i class="fa-solid fa-chevron-up"></i> Detayı Gizle';
    if (isCurrentlyOpen) {
      btnEl.style.color = '#00f3ff';
      btnEl.style.borderColor = 'rgba(0, 243, 255, 0.3)';
    } else {
      btnEl.style.color = '#38bdf8';
      btnEl.style.borderColor = 'rgba(56, 189, 248, 0.6)';
    }
  }
};

// Modal Actions
(window as any).openNewDemandModal = () => {
  activeEditingDemandId = '';
  const icon = document.getElementById('demand-modal-icon');
  const title = document.getElementById('demand-modal-title');
  const submitBtn = document.getElementById('btn-submit-demand');
  if (icon) icon.className = 'fa-solid fa-plus-circle';
  if (title) title.innerText = 'Yeni Saha Malzeme Talebi Oluştur';
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> TALEBİ OLUŞTUR VE ONAYA GÖNDER';

  const form = document.getElementById('create-demand-form') as HTMLFormElement;
  if (form) form.reset();

  const tbody = document.getElementById('new-demand-items-tbody');
  if (tbody) tbody.innerHTML = '';
  const catSelect = document.getElementById('new-demand-category') as HTMLSelectElement;
  if (catSelect) catSelect.value = 'TURBINE';
  (window as any).handleDemandCategoryChange('TURBINE');
  (window as any).addNewDemandItemRow();
  const modal = document.getElementById('new-demand-modal');
  if (modal) modal.classList.add('open');
};

(window as any).openEditDemandModal = (demandId: string) => {
  const demand = allDemandsList.find(d => d.id === demandId);
  if (!demand) {
    alert("Talep bulunamadı!");
    return;
  }

  activeEditingDemandId = demandId;
  const icon = document.getElementById('demand-modal-icon');
  const title = document.getElementById('demand-modal-title');
  const submitBtn = document.getElementById('btn-submit-demand');
  if (icon) icon.className = 'fa-solid fa-pen-to-square';
  if (title) title.innerText = `Talebe Kalem Ekle & Düzenle (${demand.title})`;
  if (submitBtn) submitBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> GÜNCELLE & DEĞİŞİKLİKLERİ KAYDET';

  const catSelect = document.getElementById('new-demand-category') as HTMLSelectElement;
  if (catSelect) {
    catSelect.value = demand.demandCategory || 'TURBINE';
    (window as any).handleDemandCategoryChange(catSelect.value);
  }

  const siteSelect = document.getElementById('new-demand-site') as HTMLSelectElement;
  if (siteSelect) {
    siteSelect.value = demand.siteId;
    (window as any).updateDemandTurbineOptions(demand.siteId);
  }

  const turbineSelect = document.getElementById('new-demand-turbine') as HTMLSelectElement;
  if (turbineSelect && demand.turbineId) {
    turbineSelect.value = demand.turbineId;
  }

  const urgencySelect = document.getElementById('new-demand-urgency') as HTMLSelectElement;
  if (urgencySelect) urgencySelect.value = demand.urgency || 'NORMAL';

  const generalNoteInput = document.getElementById('new-demand-general-note') as HTMLTextAreaElement;
  if (generalNoteInput) generalNoteInput.value = demand.generalNote || '';

  const tbody = document.getElementById('new-demand-items-tbody');
  if (tbody) {
    tbody.innerHTML = '';
    const isConsumable = demand.demandCategory === 'CONSUMABLE';
    (demand.items || []).forEach(item => {
      const rowId = `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const tr = document.createElement('tr');
      tr.dataset.rowId = rowId;
      tr.innerHTML = `
        <td class="td-demand-sap" style="${isConsumable ? 'display: none;' : ''}">
          <input type="text" value="${item.sapNo || ''}" class="demand-row-sap mini-input" oninput="window.handleDemandSapInput(this)" onchange="window.handleDemandSapInput(this)" placeholder="SAP No (örn: 55107)..." style="width: 100% !important; color: #00f3ff !important; font-family: monospace; font-weight: 800;">
          <div class="demand-row-stock-hint" style="font-size: 0.7rem; color: #38bdf8; margin-top: 2px; display: none;"></div>
        </td>
        <td>
          <input type="text" value="${item.description}" class="demand-row-desc mini-input" placeholder="${isConsumable ? 'Örn: Sentetik Boya, Mikrofiber Bez, Pas Sökücü Sprey vb...' : 'SAP No girildiğinde otomatik dolar veya tanım yazınız...'}" required style="width: 100% !important; color: #fff !important; font-weight: 600;">
        </td>
        <td style="text-align: center;">
          <input type="number" min="1" value="${item.quantity}" class="demand-row-qty mini-input" required style="width: 65px !important; text-align: center; font-weight: 900; color: #34d399 !important;">
        </td>
        <td>
          <select class="demand-row-unit mini-input" style="width: 85px !important;">
            <option value="Adet" ${item.unit === 'Adet' ? 'selected' : ''}>Adet</option>
            <option value="Kutu" ${item.unit === 'Kutu' ? 'selected' : ''}>Kutu</option>
            <option value="Paket" ${item.unit === 'Paket' ? 'selected' : ''}>Paket</option>
            <option value="Metre" ${item.unit === 'Metre' ? 'selected' : ''}>Metre</option>
            <option value="Kg" ${item.unit === 'Kg' ? 'selected' : ''}>Kg</option>
            <option value="Litre" ${item.unit === 'Litre' ? 'selected' : ''}>Litre</option>
            <option value="Takım" ${item.unit === 'Takım' ? 'selected' : ''}>Takım</option>
            <option value="Rulo" ${item.unit === 'Rulo' ? 'selected' : ''}>Rulo</option>
          </select>
        </td>
        <td>
          <input type="text" value="${item.reason || ''}" class="demand-row-reason mini-input" placeholder="Arıza / Kullanım gerekçesi..." style="width: 100% !important;">
        </td>
        <td style="text-align: center;">
          <button type="button" onclick="this.closest('tr').remove()" class="cyber-btn cyber-btn-danger" style="padding: 2px 6px; font-size: 0.72rem; height: 24px;" title="Satırı Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  const modal = document.getElementById('new-demand-modal');
  if (modal) modal.classList.add('open');
};

(window as any).closeNewDemandModal = () => {
  activeEditingDemandId = '';
  const modal = document.getElementById('new-demand-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).handleDemandCategoryChange = (category: string) => {
  const isConsumable = category === 'CONSUMABLE';
  const thSap = document.getElementById('th-demand-sap');
  if (thSap) {
    thSap.style.display = isConsumable ? 'none' : 'table-cell';
  }

  // Update existing rows
  document.querySelectorAll('#new-demand-items-tbody tr').forEach((tr: any) => {
    const sapCell = tr.querySelector('.td-demand-sap');
    if (sapCell) {
      sapCell.style.display = isConsumable ? 'none' : 'table-cell';
    }
    const descInput = tr.querySelector('.demand-row-desc') as HTMLInputElement;
    if (descInput) {
      descInput.placeholder = isConsumable 
        ? "Örn: Sentetik Boya, Mikrofiber Bez, Pas Sökücü Sprey, Tiner vb..."
        : "SAP No girildiğinde otomatik dolar veya malzeme tanımı yazınız...";
    }
  });
};

(window as any).updateDemandTurbineOptions = (siteId: string) => {
  const turbineSelect = document.getElementById('new-demand-turbine') as HTMLSelectElement;
  if (!turbineSelect) return;

  turbineSelect.innerHTML = '<option value="">Genel Saha İhtiyacı</option>';
  if (!siteId) return;

  const site = dataService.getSites().find(s => s.id === siteId);
  if (site && site.turbineCount) {
    for (let i = 1; i <= site.turbineCount; i++) {
      const tName = `T-${String(i).padStart(2, '0')}`;
      turbineSelect.innerHTML += `<option value="${tName}">${tName}</option>`;
    }
  }
};

(window as any).addNewDemandItemRow = () => {
  const tbody = document.getElementById('new-demand-items-tbody');
  if (!tbody) return;

  const catSelect = document.getElementById('new-demand-category') as HTMLSelectElement;
  const isConsumable = catSelect?.value === 'CONSUMABLE';

  const rowId = `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tr = document.createElement('tr');
  tr.dataset.rowId = rowId;
  tr.innerHTML = `
    <td class="td-demand-sap" style="${isConsumable ? 'display: none;' : ''}">
      <input type="text" class="demand-row-sap mini-input" oninput="window.handleDemandSapInput(this)" onchange="window.handleDemandSapInput(this)" placeholder="SAP No (örn: 55107)..." style="width: 100% !important; color: #00f3ff !important; font-family: monospace; font-weight: 800;">
      <div class="demand-row-stock-hint" style="font-size: 0.7rem; color: #38bdf8; margin-top: 2px; display: none;"></div>
    </td>
    <td>
      <input type="text" class="demand-row-desc mini-input" placeholder="${isConsumable ? 'Örn: Sentetik Boya, Mikrofiber Bez, Pas Sökücü Sprey vb...' : 'SAP No girildiğinde otomatik dolar veya tanım yazınız...'}" required style="width: 100% !important; color: #fff !important; font-weight: 600;">
    </td>
    <td style="text-align: center;">
      <input type="number" min="1" value="1" class="demand-row-qty mini-input" required style="width: 65px !important; text-align: center; font-weight: 900; color: #34d399 !important;">
    </td>
    <td>
      <select class="demand-row-unit mini-input" style="width: 85px !important;">
        <option value="Adet">Adet</option>
        <option value="Kutu">Kutu</option>
        <option value="Paket">Paket</option>
        <option value="Metre">Metre</option>
        <option value="Kg">Kg</option>
        <option value="Litre">Litre</option>
        <option value="Takım">Takım</option>
        <option value="Rulo">Rulo</option>
      </select>
    </td>
    <td>
      <input type="text" class="demand-row-reason mini-input" placeholder="Arıza / Kullanım gerekçesi..." style="width: 100% !important;">
    </td>
    <td style="text-align: center;">
      <button type="button" onclick="this.closest('tr').remove()" class="cyber-btn cyber-btn-danger" style="padding: 2px 6px; font-size: 0.72rem; height: 24px;" title="Satırı Sil">
        <i class="fa-solid fa-trash"></i>
      </button>
    </td>
  `;
  tbody.appendChild(tr);
};

// SAP Lookup for Demand Rows with instant auto-fill & live stock check
(window as any).handleDemandSapInput = async (inputEl: HTMLInputElement) => {
  const row = inputEl.closest('tr');
  if (!row) return;
  const sap = inputEl.value.trim();
  const descInput = row.querySelector('.demand-row-desc') as HTMLInputElement;
  const stockHint = row.querySelector('.demand-row-stock-hint') as HTMLElement;

  if (!sap) {
    if (stockHint) stockHint.style.display = 'none';
    return;
  }

  const catalog = await loadSahaSapCatalog();
  const match = catalog.find((c: any) => c.sapNo.toLowerCase() === sap.toLowerCase());
  if (match && descInput) {
    descInput.value = match.description;
    descInput.style.color = '#00f3ff';
    descInput.style.fontWeight = '700';
  }

  // Live stock check
  const siteSelect = document.getElementById('new-demand-site') as HTMLSelectElement;
  const siteId = siteSelect?.value || '';

  try {
    const stock = await materialDemandService.getStockSummaryForSap(sap, siteId);
    if (stockHint) {
      stockHint.style.display = 'block';
      const siteText = stock.siteQty > 0 
        ? `<span style="color: #34d399; font-weight: 800;">🟢 Bu Sahada: ${stock.siteQty} Adet</span>` 
        : `<span style="color: #f87171;">🔴 Bu Sahada: 0</span>`;
      const centralText = stock.centralQty > 0 
        ? `<span style="color: #38bdf8; font-weight: 700; margin-left: 6px;">🏢 Merkez: ${stock.centralQty} Adet</span>` 
        : '';
      stockHint.innerHTML = `${siteText}${centralText}`;
    }
  } catch (e) {
    // ignore
  }
};

// Submit New Demand
(window as any).handleCreateDemandSubmit = async (e: Event) => {
  e.preventDefault();
  const category = (document.getElementById('new-demand-category') as HTMLSelectElement)?.value as any || 'TURBINE';
  const siteSelect = document.getElementById('new-demand-site') as HTMLSelectElement;
  const siteId = siteSelect?.value;
  const siteName = siteSelect?.options[siteSelect.selectedIndex]?.dataset.name || siteId;
  const turbineId = (document.getElementById('new-demand-turbine') as HTMLSelectElement)?.value || '';
  const urgency = (document.getElementById('new-demand-urgency') as HTMLSelectElement)?.value as any || 'NORMAL';
  const generalNote = (document.getElementById('new-demand-general-note') as HTMLTextAreaElement)?.value?.trim() || '';

  if (!siteId) {
    alert("Lütfen saha / santral seçiniz!");
    return;
  }

  const rows = document.querySelectorAll('#new-demand-items-tbody tr');
  if (rows.length === 0) {
    alert("Lütfen en az bir malzeme kalemi ekleyiniz!");
    return;
  }

  const items: MaterialDemandItem[] = [];
  for (const row of Array.from(rows) as HTMLElement[]) {
    const sapNo = (row.querySelector('.demand-row-sap') as HTMLInputElement)?.value?.trim() || '';
    const description = (row.querySelector('.demand-row-desc') as HTMLInputElement)?.value?.trim() || '';
    const qty = Number((row.querySelector('.demand-row-qty') as HTMLInputElement)?.value) || 1;
    const unit = (row.querySelector('.demand-row-unit') as HTMLSelectElement)?.value || 'Adet';
    const reason = (row.querySelector('.demand-row-reason') as HTMLInputElement)?.value?.trim() || '';

    if (!description) {
      alert("Lütfen tüm satırlar için malzeme tanımını doldurunuz!");
      return;
    }

    items.push({
      sapNo: category === 'TURBINE' ? sapNo : '',
      description,
      quantity: Math.max(1, qty),
      unit,
      reason
    });
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const btn = document.getElementById('btn-submit-demand') as HTMLButtonElement;
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${activeEditingDemandId ? 'GÜNCELLENİYOR...' : 'OLUŞTURULUYOR...'}`;
    btn.disabled = true;
  }

  try {
    if (activeEditingDemandId) {
      await materialDemandService.updateDemand(activeEditingDemandId, {
        demandCategory: category,
        siteId,
        siteName,
        turbineId,
        urgency,
        generalNote,
        items
      });
      alert("Talep ve malzeme kalemleri başarıyla güncellendi!");
      activeEditingDemandId = '';
      (window as any).closeNewDemandModal();
    } else {
      await materialDemandService.createDemand({
        demandCategory: category,
        siteId,
        siteName,
        turbineId,
        urgency,
        generalNote,
        items,
        requesterId: currentUser?.uid || '',
        requesterName: currentUser?.displayName || currentUser?.email || 'Saha Personeli',
        requesterEmail: currentUser?.email || '',
        requesterTeam: currentUser?.team || ''
      });

      alert("Saha malzeme talebi başarıyla oluşturuldu ve ön kontrole iletildi!");
      (window as any).closeNewDemandModal();
    }
  } catch (err) {
    console.error("Save demand error:", err);
    alert("Talep kaydedilirken hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  }
};

// ═══════════════════════════════════════════════════════
// MANAGER APPROVAL & ITEM-BY-ITEM EVALUATION MODAL
// ═══════════════════════════════════════════════════════

(window as any).handleItemDecisionChange = (selectEl: HTMLSelectElement, idx: number) => {
  const decision = selectEl.value;
  const qtyInput = document.querySelector(`.approved-qty-input[data-index="${idx}"]`) as HTMLInputElement;
  const noteInput = document.querySelector(`.manager-item-note-input[data-index="${idx}"]`) as HTMLInputElement;
  
  if (!qtyInput || !activeApproveDemandObj) return;
  const origItem = activeApproveDemandObj.items[idx];

  if (decision === 'TRANSFER') {
    qtyInput.value = '0';
    qtyInput.disabled = true;
    qtyInput.style.opacity = '0.5';
    if (noteInput && !noteInput.value) {
      noteInput.value = 'Depolar arası transfer talebi açınız.';
    }
  } else if (decision === 'USE_LOCAL_STOCK') {
    qtyInput.value = '0';
    qtyInput.disabled = true;
    qtyInput.style.opacity = '0.5';
    if (noteInput && !noteInput.value) {
      noteInput.value = 'Sahadaki mevcut depo stoğundan temin ediniz.';
    }
  } else if (decision === 'REJECT') {
    qtyInput.value = '0';
    qtyInput.disabled = true;
    qtyInput.style.opacity = '0.5';
    if (noteInput && !noteInput.value) {
      noteInput.value = 'Bu malzeme talebi uygun görülmemiştir.';
    }
  } else {
    // APPROVE_PURCHASE
    qtyInput.disabled = false;
    qtyInput.style.opacity = '1';
    if (qtyInput.value === '0') {
      qtyInput.value = String(origItem?.quantity || 1);
    }
    if (noteInput && (noteInput.value.includes('transfer') || noteInput.value.includes('mevcut'))) {
      noteInput.value = 'Siparişe uygundur.';
    }
  }
};

(window as any).openApproveDemandModal = (demandId: string) => {
  activeApproveDemandId = demandId;
  const demand = allDemandsList.find(d => d.id === demandId);
  if (!demand) return;

  activeApproveDemandObj = demand;

  const summaryBox = document.getElementById('approve-modal-summary-box');
  const tbody = document.getElementById('approve-modal-items-tbody');
  const noteInput = document.getElementById('approve-demand-note-input') as HTMLTextAreaElement;
  if (noteInput) noteInput.value = '';

  if (summaryBox) {
    summaryBox.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
        <div>
          <strong style="color: #00f3ff; font-family: monospace; font-size: 1rem;">[ ${demand.title} ]</strong>
          <span style="color: #cbd5e1; margin-left: 10px; font-weight: 700;"><i class="fa-solid fa-location-dot" style="color: #34d399;"></i> ${demand.siteName} ${demand.turbineId ? `(${demand.turbineId})` : ''}</span>
        </div>
        <div style="color: #94a3b8; font-size: 0.82rem;">
          <i class="fa-solid fa-user-circle" style="color: #38bdf8;"></i> Talep Eden: <strong style="color: #fff;">${demand.requesterName}</strong>
        </div>
      </div>
      ${demand.generalNote ? `<div style="color: #fbbf24; font-size: 0.82rem; margin-top: 5px;"><i class="fa-regular fa-comment-dots"></i> <strong>Personel Notu:</strong> ${demand.generalNote}</div>` : ''}
    `;
  }

  if (tbody) {
    tbody.innerHTML = (demand.items || []).map((item, idx) => {
      return `
        <tr data-item-index="${idx}" style="border-bottom: 1px solid rgba(255, 255, 255, 0.06); background: rgba(15, 23, 42, 0.45);">
          <!-- 1. Malzeme Tanımı & SAP -->
          <td style="padding: 12px 14px; vertical-align: middle;">
            <div style="font-weight: 800; color: #fff; font-size: 0.94rem; line-height: 1.3;">${item.description}</div>
            ${item.sapNo ? `<div style="font-family: monospace; color: #00f3ff; font-size: 0.8rem; font-weight: 800; margin-top: 2px;"><i class="fa-solid fa-barcode"></i> SAP: ${item.sapNo}</div>` : ''}
            ${item.reason ? `<div style="font-size: 0.74rem; color: #94a3b8; font-style: italic; margin-top: 2px;"><i class="fa-regular fa-comment-dots"></i> ${item.reason}</div>` : ''}
          </td>

          <!-- 2. İstenen Miktar -->
          <td style="text-align: center; padding: 12px 6px; vertical-align: middle;">
            <strong style="color: #cbd5e1; font-size: 1.15rem; display: block; line-height: 1;">${item.quantity}</strong>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 700;">${item.unit || 'Adet'}</span>
          </td>

          <!-- 3. Yönetici Kararı (BAĞIMSIZ SÜTUN - ASLA KESİLMEZ) -->
          <td style="padding: 12px 12px; vertical-align: middle;">
            <select class="item-decision-select cyber-select" data-index="${idx}" onchange="window.handleItemDecisionChange(this, ${idx})" style="font-weight: 800; font-size: 0.84rem; height: 38px !important; width: 100% !important; padding: 0 10px !important;">
              <option value="APPROVE_PURCHASE" selected>✅ Satınalma Onayı</option>
              <option value="TRANSFER">🚚 Transfer Edilsin</option>
              <option value="USE_LOCAL_STOCK">📍 Sahada Mevcut</option>
              <option value="REJECT">❌ Reddedildi</option>
            </select>
          </td>

          <!-- 4. Onay Miktarı (BAĞIMSIZ SÜTUN - ORTALANMIŞ VE NET) -->
          <td style="text-align: center; padding: 12px 8px; vertical-align: middle;">
            <div style="display: flex; align-items: center; justify-content: center; gap: 4px;">
              <input type="number" min="0" value="${item.quantity}" class="approved-qty-input cyber-input" data-index="${idx}" style="width: 52px !important; height: 36px !important; text-align: center; font-weight: 900; font-size: 1rem; color: #34d399 !important; border-color: rgba(52, 211, 153, 0.5) !important; padding: 0 !important;">
              <span style="font-size: 0.76rem; color: #34d399; font-weight: 800;">${item.unit || 'Adet'}</span>
            </div>
          </td>

          <!-- 5. Yönetici Talimatı / Özel Not (GENİŞ NOT ALANI) -->
          <td style="padding: 12px 14px; vertical-align: middle;">
            <input type="text" class="manager-item-note-input cyber-input" data-index="${idx}" placeholder="Örn: 1 adet sipariş, kalan transfer edilsin..." style="height: 38px !important; color: #38bdf8 !important; font-size: 0.84rem; padding: 0 12px !important; width: 100% !important;">
          </td>
        </tr>
      `;
    }).join('');
  }

  const modal = document.getElementById('approve-demand-modal');
  if (modal) {
    document.body.style.overflow = 'hidden';
    modal.classList.add('open');
  }
};

(window as any).closeApproveDemandModal = () => {
  activeApproveDemandId = '';
  activeApproveDemandObj = null;
  document.body.style.overflow = '';
  const modal = document.getElementById('approve-demand-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).handleConfirmApproveDemand = async (e: Event) => {
  e.preventDefault();
  if (!activeApproveDemandId || !activeApproveDemandObj) return;

  const note = (document.getElementById('approve-demand-note-input') as HTMLTextAreaElement)?.value?.trim() || 'Kalem bazlı ön kontrol tamamlandı.';
  
  // Collect adjusted approved quantities, decisions, and item notes
  const updatedItems: MaterialDemandItem[] = (activeApproveDemandObj.items || []).map((item, idx) => {
    const decisionSelect = document.querySelector(`.item-decision-select[data-index="${idx}"]`) as HTMLSelectElement;
    const qtyInput = document.querySelector(`.approved-qty-input[data-index="${idx}"]`) as HTMLInputElement;
    const noteInput = document.querySelector(`.manager-item-note-input[data-index="${idx}"]`) as HTMLInputElement;

    const decision = (decisionSelect?.value as any) || 'APPROVE_PURCHASE';
    const approvedQty = qtyInput ? Number(qtyInput.value) : item.quantity;
    const managerNote = noteInput?.value?.trim() || '';

    return {
      ...item,
      itemDecision: decision,
      approvedQuantity: decision === 'APPROVE_PURCHASE' ? (isNaN(approvedQty) ? item.quantity : Math.max(0, approvedQty)) : 0,
      managerItemNote: managerNote
    };
  });

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const btn = document.getElementById('btn-confirm-approve') as HTMLButtonElement;
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ONAYLANIYOR...';
    btn.disabled = true;
  }

  try {
    await materialDemandService.reviewDemand(
      activeApproveDemandId,
      'APPROVE',
      note,
      currentUser?.uid || '',
      currentUser?.displayName || currentUser?.email || 'Yönetici',
      updatedItems
    );
    alert("Talep başarıyla incelendi, kalem bazlı kararlar ve talimatlarınız kaydedildi!");
    (window as any).closeApproveDemandModal();
  } catch (err) {
    console.error("Approve demand error:", err);
    alert("Onaylama işlemi sırasında hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  }
};

// Reject Demand Modal
(window as any).openRejectDemandModal = (demandId: string) => {
  activeRejectDemandId = demandId;
  const reasonInput = document.getElementById('reject-demand-reason-input') as HTMLTextAreaElement;
  if (reasonInput) reasonInput.value = '';
  const modal = document.getElementById('reject-demand-modal');
  if (modal) modal.classList.add('open');
};

(window as any).closeRejectDemandModal = () => {
  activeRejectDemandId = '';
  const modal = document.getElementById('reject-demand-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).handleConfirmRejectDemand = async (e: Event) => {
  e.preventDefault();
  if (!activeRejectDemandId) return;

  const reason = (document.getElementById('reject-demand-reason-input') as HTMLTextAreaElement)?.value?.trim();
  if (!reason) {
    alert("Lütfen ret gerekçesini yazınız!");
    return;
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const btn = document.getElementById('btn-confirm-reject') as HTMLButtonElement;
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> REDDEDİLİYOR...';
    btn.disabled = true;
  }

  try {
    await materialDemandService.reviewDemand(
      activeRejectDemandId,
      'REJECT',
      reason,
      currentUser?.uid || '',
      currentUser?.displayName || currentUser?.email || 'Yönetici'
    );
    alert("Talep gerekçeli olarak reddedildi. Teknisyen ekranında bildirim görünecektir.");
    (window as any).closeRejectDemandModal();
  } catch (err) {
    console.error("Reject demand error:", err);
    alert("Reddetme işlemi sırasında hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = origHtml;
      btn.disabled = false;
    }
  }
};

// Delete Demand (Universal Delete for Admin/Manager across all statuses)
(window as any).handleDeleteDemand = async (demandId: string) => {
  const demand = allDemandsList.find(d => d.id === demandId);
  const title = demand?.title || 'bu talebi';
  if (!confirm(`"${title}" talebini ve tüm kalemlerini kalıcı olarak silmek istediğinizden emin misiniz?`)) return;

  try {
    await materialDemandService.deleteDemand(demandId);
    alert("Talep başarıyla silindi.");
  } catch (err) {
    console.error("Delete demand error:", err);
    alert("Silme hatası: " + err);
  }
};
