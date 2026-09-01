import { orderService, type PurchaseRequest, type OrderItem, type OrderDeliveryRecord } from '../services/OrderService';
import { materialDemandService, type MaterialDemand } from '../services/MaterialDemandService';
import { authService } from '../services/AuthService';
import { dataService } from '../services/DataService';
import { warehouseService, type InventoryItem } from '../services/WarehouseService';
import * as XLSX from 'xlsx';

let linkedDemandIds: string[] = [];

export const SiparisPage = async (userProfile: any) => {
  const currentUser = userProfile || (window as any).currentUser || authService.getCurrentUser();
  const warehouses = dataService.getWarehouses();
  const isMaterialManager = currentUser?.role === 'ADMIN' || 
    currentUser?.role === 'MALZEME_YONETIMI' || 
    currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' ||
    currentUser?.email?.toLowerCase() === 'emir.unver@demirerholding.com';

  if (!isMaterialManager) {
    return `
      <div class="cyber-card" style="margin: 4rem auto; padding: 2.5rem; text-align: center; border-color: rgba(239, 68, 68, 0.4); max-width: 600px;">
        <i class="fa-solid fa-shield-halved" style="font-size: 3.5rem; color: #ef4444; margin-bottom: 1rem;"></i>
        <h2 style="color: #fff; margin-bottom: 0.5rem; font-size: 1.4rem;">Yetkisiz Erişim</h2>
        <p style="color: #94a3b8; font-size: 0.9rem;">Sipariş Yönetimi ve Satınalma ekranına yalnızca Admin ve Malzeme Yönetimi yetkilileri erişebilir.</p>
      </div>
    `;
  }

  const allowedWarehouses = warehouses;

  return `
    <style>
      .orders-dashboard {
        padding: 1.25rem 1.5rem;
        max-width: 1600px;
        margin: 0 auto;
        font-family: 'Rajdhani', sans-serif;
        color: #f1f5f9;
      }

      /* Navigation Tabs */
      .orders-nav-tabs {
        display: flex;
        gap: 8px;
        margin-bottom: 1.25rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        padding-bottom: 0.5rem;
      }

      .order-tab-btn {
        padding: 0.45rem 1.1rem;
        border-radius: 8px;
        font-weight: 800;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.03);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.2s ease;
      }
      .order-tab-btn:hover {
        background: rgba(0, 243, 255, 0.08);
        color: #00f3ff;
      }
      .order-tab-btn.active {
        background: rgba(0, 243, 255, 0.15);
        color: #00f3ff;
        border-color: #00f3ff;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.2);
      }

      /* Stats Grid */
      .orders-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
        gap: 0.85rem;
        margin-bottom: 1.25rem;
      }

      .orders-stat-card {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.85), rgba(30, 41, 59, 0.75));
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
        box-shadow: 0 8px 20px -4px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(10px);
        transition: transform 0.2s ease, border-color 0.2s ease;
      }
      .orders-stat-card:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 243, 255, 0.4);
      }

      .orders-stat-title {
        font-size: 0.68rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #94a3b8;
        font-weight: 700;
        margin-bottom: 0.25rem;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .orders-stat-value {
        font-size: 1.45rem;
        font-weight: 900;
        color: #fff;
        line-height: 1;
      }
      .orders-stat-sub {
        font-size: 0.68rem;
        color: #64748b;
        margin-top: 0.25rem;
      }

      /* Toolbar & Site Filters */
      .orders-toolbar {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        padding: 0.85rem 1rem;
        margin-bottom: 1.25rem;
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
      }

      .site-filter-scroll {
        display: flex;
        gap: 5px;
        overflow-x: auto;
        padding-bottom: 3px;
      }
      .site-filter-scroll::-webkit-scrollbar {
        height: 3px;
      }
      .site-filter-scroll::-webkit-scrollbar-thumb {
        background: rgba(0, 243, 255, 0.3);
        border-radius: 3px;
      }

      .site-pill {
        padding: 4px 11px;
        border-radius: 6px;
        font-size: 0.74rem;
        font-weight: 700;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
        white-space: nowrap;
        user-select: none;
        transition: all 0.2s;
      }
      .site-pill:hover {
        background: rgba(0, 243, 255, 0.1);
        color: #00f3ff;
      }
      .site-pill.active {
        background: rgba(0, 243, 255, 0.2);
        color: #00f3ff;
        border-color: #00f3ff;
        box-shadow: 0 0 8px rgba(0, 243, 255, 0.25);
      }

      /* Cyber Input & Form Styling (Fixing plain Windows HTML look) */
      .cyber-input-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
        margin-bottom: 1rem;
      }
      .cyber-label {
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #94a3b8;
        display: flex;
        align-items: center;
        gap: 5px;
      }
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
        padding: 6px !important;
      }
      .cyber-input:focus, .cyber-select:focus, .cyber-textarea:focus {
        border-color: #00f3ff !important;
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.3) !important;
        background: rgba(15, 23, 42, 0.98) !important;
      }
      .cyber-textarea {
        resize: vertical;
        min-height: 65px;
      }

      /* Micro Mini Inputs for Modal Rows (Raf, Adet, etc.) */
      .mini-input {
        background: rgba(15, 23, 42, 0.85) !important;
        border: 1px solid rgba(0, 243, 255, 0.25) !important;
        color: #ffffff !important;
        border-radius: 4px !important;
        padding: 2px 6px !important;
        font-family: 'Rajdhani', sans-serif !important;
        font-size: 0.74rem !important;
        height: 24px !important;
        min-height: 24px !important;
        max-height: 24px !important;
        line-height: 22px !important;
        outline: none !important;
        box-sizing: border-box !important;
        transition: all 0.2s ease !important;
      }
      .mini-input:focus {
        border-color: #00f3ff !important;
        box-shadow: 0 0 6px rgba(0, 243, 255, 0.3) !important;
      }
      .delivery-shelf-input {
        width: 68px !important;
        text-align: center !important;
        font-family: monospace !important;
        font-size: 0.72rem !important;
      }
      .delivery-qty-input {
        width: 44px !important;
        text-align: center !important;
        font-weight: 800 !important;
        font-size: 0.78rem !important;
      }
      .mini-damage-btn {
        height: 24px !important;
        min-height: 24px !important;
        max-height: 24px !important;
        padding: 0 6px !important;
        font-size: 0.68rem !important;
        font-weight: 800 !important;
        border-radius: 4px !important;
        background: rgba(239, 68, 68, 0.15) !important;
        color: #f87171 !important;
        border: 1px solid rgba(239, 68, 68, 0.3) !important;
        cursor: pointer !important;
        display: inline-flex !important;
        align-items: center !important;
        gap: 3px !important;
        user-select: none !important;
      }
      .mini-damage-btn:hover {
        background: rgba(239, 68, 68, 0.25) !important;
        color: #fca5a5 !important;
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
      }
      .cyber-btn-primary {
        background: linear-gradient(135deg, #00f3ff, #0284c7);
        color: #020617;
        box-shadow: 0 0 12px rgba(0, 243, 255, 0.25);
      }
      .cyber-btn-primary:hover {
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

      /* Search Box */
      .cyber-search-wrapper {
        position: relative;
        width: 100%;
      }
      .cyber-search-wrapper i {
        position: absolute;
        left: 11px;
        top: 50%;
        transform: translateY(-50%);
        color: #00f3ff;
        font-size: 0.85rem;
        pointer-events: none;
      }
      .cyber-search-wrapper input {
        padding-left: 34px !important;
      }

      /* Filter Pills */
      .filter-pill-group {
        display: flex;
        gap: 5px;
      }
      .filter-pill {
        padding: 3px 10px;
        border-radius: 16px;
        font-size: 0.72rem;
        font-weight: 700;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.2s ease;
      }
      .filter-pill:hover {
        color: #00f3ff;
        background: rgba(0, 243, 255, 0.08);
      }
      .filter-pill.active {
        background: rgba(0, 243, 255, 0.2);
        color: #00f3ff;
        border-color: #00f3ff;
        box-shadow: 0 0 8px rgba(0, 243, 255, 0.25);
      }

      /* Orders Table */
      .orders-table-container {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 12px;
        overflow: hidden;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
      }
      .orders-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }
      .orders-table th {
        background: rgba(2, 6, 23, 0.85);
        padding: 0.7rem 0.9rem;
        font-size: 0.7rem;
        text-transform: uppercase;
        letter-spacing: 0.8px;
        color: #94a3b8;
        font-weight: 800;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }
      .orders-table td {
        padding: 0.7rem 0.9rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        font-size: 0.82rem;
        vertical-align: middle;
      }
      .orders-table tr:hover td {
        background: rgba(0, 243, 255, 0.02);
      }

      /* Progress Bar */
      .delivery-progress-bar {
        width: 100%;
        height: 5px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        overflow: hidden;
        margin-top: 4px;
      }
      .delivery-progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #3b82f6, #10b981);
        border-radius: 3px;
        transition: width 0.3s ease;
      }

      /* Status Badges */
      .status-badge {
        padding: 3px 8px;
        border-radius: 20px;
        font-size: 0.68rem;
        font-weight: 800;
        text-transform: uppercase;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }
      .status-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); }
      .status-partial { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
      .status-completed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
      .status-cancelled { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); }

      .badge-dn-chip {
        background: rgba(0, 243, 255, 0.1);
        color: #00f3ff;
        border: 1px solid rgba(0, 243, 255, 0.25);
        border-radius: 4px;
        font-family: monospace;
        font-size: 0.72rem;
        padding: 2px 6px;
        font-weight: 700;
      }

      /* Modal Styling */
      /* Modal Styling */
      .order-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.2s ease;
        padding: 10px;
        box-sizing: border-box;
      }
      .order-modal-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }
      .order-modal-overlay#order-invoice-edit-modal {
        z-index: 25000 !important;
        background: rgba(5, 12, 28, 0.45) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      }

      .order-modal {
        background: #0b1329;
        border: 1px solid rgba(0, 243, 255, 0.3);
        border-radius: 12px;
        width: 100%;
        max-width: 1420px;
        max-height: 92vh;
        height: auto;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 20px 50px -10px rgba(0, 0, 0, 0.9), 0 0 20px rgba(0, 243, 255, 0.18);
        padding: 0;
        margin: auto;
        transform: scale(0.97);
        transition: transform 0.2s ease;
      }
      .order-modal-overlay.open .order-modal {
        transform: scale(1);
      }
      .order-modal-header {
        padding: 0.5rem 0.9rem;
        background: #070d1f;
        border-bottom: 1px solid rgba(0, 243, 255, 0.2);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }
      .order-modal-subnav {
        display: flex;
        gap: 5px;
        padding: 0.3rem 0.9rem;
        background: rgba(15, 23, 42, 0.95);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        flex-shrink: 0;
        flex-wrap: wrap;
      }
      .order-modal-subnav-btn {
        padding: 3px 8px;
        border-radius: 5px;
        font-size: 0.72rem;
        font-weight: 800;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.04);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
      }
      .order-modal-subnav-btn:hover {
        background: rgba(0, 243, 255, 0.08);
        color: #00f3ff;
      }
      .order-modal-subnav-btn.active {
        background: rgba(0, 243, 255, 0.2);
        color: #00f3ff;
        border-color: #00f3ff;
        box-shadow: 0 0 6px rgba(0, 243, 255, 0.2);
      }
      .order-modal-body {
        padding: 0.65rem 0.9rem;
        overflow-y: auto;
        flex: 1;
        max-height: calc(88vh - 120px);
      }
      .order-modal-footer {
        padding: 0.4rem 0.9rem;
        background: #070d1f;
        border-top: 1px solid rgba(255, 255, 255, 0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-shrink: 0;
      }
    </style>

    <div class="orders-dashboard">
      
      <!-- Top Title Bar -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(0, 243, 255, 0.15); border: 1px solid rgba(0, 243, 255, 0.4); display: flex; align-items: center; justify-content: center; color: #00f3ff; font-size: 1.1rem; box-shadow: 0 0 10px rgba(0, 243, 255, 0.2);">
            <i class="fa-solid fa-truck-moving"></i>
          </div>
          <div>
            <h1 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #fff; letter-spacing: 0.5px;">SANTRAL SİPARİŞ & SEVKİYAT MERKEZİ</h1>
            <p style="margin: 2px 0 0; color: #94a3b8; font-size: 0.78rem; font-weight: 600;">
              Tüm Santrallerin Malzeme Talepleri, Enercon Delivery Note (DN) ve Parçalı Teslimat Takibi
            </p>
          </div>
        </div>

        <div style="display: flex; gap: 8px;">
          <button onclick="window.refreshOrdersTable(true)" class="cyber-btn cyber-btn-secondary" title="Tabloyu Yenile">
            <i class="fa-solid fa-rotate"></i> YENİLE
          </button>
        </div>
      </div>

      <!-- Navigation Tabs -->
      <div class="orders-nav-tabs">
        <button class="order-tab-btn active" id="tab-btn-dashboard" onclick="window.switchOrderView('dashboard')">
          <i class="fa-solid fa-chart-pie"></i> SANTRAL SİPARİŞ DASHBOARD'U
        </button>
        <button class="order-tab-btn" id="tab-btn-create" onclick="window.switchOrderView('create')">
          <i class="fa-solid fa-plus"></i> YENİ SİPARİŞ OLUŞTUR
        </button>
        <button class="order-tab-btn" id="tab-btn-approved-demands" onclick="window.openApprovedDemandsModal()" style="border-color: rgba(52, 211, 153, 0.5); color: #34d399; background: rgba(52, 211, 153, 0.1);">
          <i class="fa-solid fa-list-check"></i> 📋 ONAYLI SAHA TALEPLERİ (<span id="main-approved-demands-count">0</span>)
        </button>
      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- VIEW 1: SANTRAL SİPARİŞ & SEVKİYAT DASHBOARD'U          -->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div id="orders-dashboard-view">
        
        <!-- Glowing Alert Banner for Approved Demands -->
        <div id="approved-demands-alert-banner" style="display: none; background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 95, 70, 0.2)); border: 1px solid #10b981; border-radius: 10px; padding: 12px 18px; margin-bottom: 1.25rem; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.25);">
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 40px; height: 40px; border-radius: 50%; background: rgba(16, 185, 129, 0.2); display: flex; align-items: center; justify-content: center; color: #34d399; font-size: 1.2rem; border: 1px solid #10b981;">
              <i class="fa-solid fa-bell fa-shake"></i>
            </div>
            <div>
              <div style="color: #fff; font-size: 0.95rem; font-weight: 800;">Sipariş Bekleyen Saha Malzeme Talebi Var!</div>
              <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 2px;">Yönetici onayından geçmiş <span id="banner-approved-demands-count" style="color: #34d399; font-weight: 900;">0</span> adet talep doğrudan sipariş sepetine aktarılmaya hazır.</div>
            </div>
          </div>
          <button type="button" onclick="window.openApprovedDemandsModal()" class="cyber-btn cyber-btn-emerald" style="font-size: 0.85rem; font-weight: 800; padding: 8px 18px;">
            <i class="fa-solid fa-cart-arrow-down"></i> TALEPLERİ İNCELE & SİPARİŞE AKTAR
          </button>
        </div>
        
        <!-- Stats Cards Grid: Counts + Financial Metrics including Logistic Cost -->
        <div class="orders-stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 1rem;">
          <div class="orders-stat-card">
            <div class="orders-stat-title"><i class="fa-solid fa-clipboard-list" style="color: #00f3ff;"></i> TOPLAM SİPARİŞ</div>
            <div class="orders-stat-value" id="stat-orders-total"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1rem;"></i></div>
            <div class="orders-stat-sub">Kayıtlı santral talebi</div>
          </div>
          <div class="orders-stat-card">
            <div class="orders-stat-title"><i class="fa-solid fa-coins" style="color: #38bdf8;"></i> MALZEME TUTARI (TEKLİF)</div>
            <div class="orders-stat-value" id="stat-orders-material-cost" style="color: #38bdf8;">0.00 €</div>
            <div class="orders-stat-sub">Yalın malzeme bedeli</div>
          </div>
          <div class="orders-stat-card">
            <div class="orders-stat-title"><i class="fa-solid fa-plane-departure" style="color: #f59e0b;"></i> ÖDENEN LOJİSTİK (COST)</div>
            <div class="orders-stat-value" id="stat-orders-logistic-cost" style="color: #f59e0b;">+0.00 €</div>
            <div class="orders-stat-sub">Faturalanan nakliye / cost</div>
          </div>
          <div class="orders-stat-card">
            <div class="orders-stat-title"><i class="fa-solid fa-receipt" style="color: #34d399;"></i> GENEL HARCAMA (COST DAHİL)</div>
            <div class="orders-stat-value" id="stat-orders-total-spend" style="color: #34d399;">0.00 €</div>
            <div class="orders-stat-sub">Malzeme + Lojistik toplam</div>
          </div>
          <div class="orders-stat-card">
            <div class="orders-stat-title"><i class="fa-solid fa-hourglass-half" style="color: #cbd5e1;"></i> BEKLENEN / YOLDA</div>
            <div class="orders-stat-value" id="stat-orders-backorder" style="color: #cbd5e1;">-</div>
            <div class="orders-stat-sub">Henüz gelmeyen parça</div>
          </div>
        </div>

        <!-- Toolbar & Site Filters -->
        <div class="orders-toolbar">
          
          <!-- Top Row: Search & Status Filter -->
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div class="cyber-search-wrapper" style="max-width: 450px;">
              <i class="fa-solid fa-magnifying-glass"></i>
              <input type="text" id="order-search-input" class="cyber-input" placeholder="Sipariş No, Malzeme, Delivery Note (DN), Depo ara..." oninput="window.handleOrderSearch(this.value)">
            </div>

            <!-- Status Filter Pills -->
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Durum:</span>
              <div class="filter-pill-group" id="order-status-pills">
                <div class="filter-pill active" onclick="window.filterOrdersByStatus('ALL', this)">Tümü</div>
                <div class="filter-pill" onclick="window.filterOrdersByStatus('PENDING', this)">Bekleyen / Yolda</div>
                <div class="filter-pill" onclick="window.filterOrdersByStatus('PARTIAL', this)">Parçalı Gelenler</div>
                <div class="filter-pill" onclick="window.filterOrdersByStatus('COMPLETED', this)">Tamamlananlar</div>
                <div class="filter-pill" onclick="window.filterOrdersByStatus('DAMAGED', this)" style="color: #f87171;"><i class="fa-solid fa-triangle-exclamation"></i> Hasarlı / İadeler</div>
              </div>
            </div>
          </div>

          <!-- Bottom Row: Santral / Saha Filter Pills -->
          <div>
            <div style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.5px;">
              <i class="fa-solid fa-charging-station" style="color: #00f3ff;"></i> SANTRAL SEÇİMİ:
            </div>
            <div class="site-filter-scroll" id="order-site-filter-scroll">
              <div class="site-pill active" onclick="window.filterOrdersBySite('ALL', this)">TÜM SANTRALLER</div>
              ${allowedWarehouses.map((w: any) => `
                <div class="site-pill" onclick="window.filterOrdersBySite('${w.id}', this)" data-wh-id="${w.id}">
                  ${w.name}
                </div>
              `).join('')}
            </div>
          </div>

        </div>

        <!-- Orders Table -->
        <div class="orders-table-container">
          <table class="orders-table">
            <thead>
              <tr>
                <th style="width: 140px;">SİPARİŞ NO</th>
                <th style="width: 180px;">SANTRAL / HEDEF DEPO</th>
                <th>SİPARİŞ İÇERİĞİ & TESLİMAT DURUMU</th>
                <th style="width: 160px;">DELIVERY NOTE (DN)</th>
                <th style="width: 140px;">TALEP EDEN</th>
                <th style="width: 140px; text-align: center;">DURUM</th>
                <th style="width: 140px; text-align: center;">İŞLEM</th>
              </tr>
            </thead>
            <tbody id="orders-table-tbody">
              <tr>
                <td colspan="7" style="padding: 4rem; text-align: center; color: #64748b;">
                  <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00f3ff; margin-bottom: 1rem; display: block;"></i>
                  Sipariş listesi yükleniyor...
                </td>
              </tr>
            </tbody>
          </table>
        </div>

      </div>

      <!-- ═══════════════════════════════════════════════════════ -->
      <!-- VIEW 2: YENİ SİPARİŞ OLUŞTUR (MODERN GRID & EXCEL TARZI)-->
      <!-- ═══════════════════════════════════════════════════════ -->
      <div id="orders-create-view" style="display: none;">
        
        <!-- Section 1: Header / General Information Card -->
        <div class="orders-stat-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;">
          <div style="font-size: 0.85rem; font-weight: 900; color: #00f3ff; text-transform: uppercase; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-circle-plus"></i> 1. SİPARİŞ GENEL BİLGİLERİ
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.85rem;">
            <div class="cyber-input-group" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-building" style="color: #00f3ff;"></i> Tedarik Kaynağı / Firma</label>
              <select id="new-order-supplier-type" class="cyber-select" onchange="window.handleSupplierTypeChange(this.value)" style="padding: 6px 10px !important; font-size: 0.85rem !important;">
                <option value="ENERCON">⚡ Enercon</option>
                <option value="MARKET">🏢 Piyasa / Diğer Tedarikçi</option>
              </select>
            </div>

            <!-- Dynamic Box 1: For Enercon -->
            <div class="cyber-input-group" id="group-enercon-order-no" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-barcode" style="color: #00f3ff;"></i> Enercon Order / PO No</label>
              <input type="text" id="new-order-enercon-no" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important; font-family: monospace; font-weight: 800; color: #00f3ff !important;" placeholder="Örn: 4500981245 veya ENR-2026-001">
            </div>

            <!-- Dynamic Box 2: For Market Vendor Name -->
            <div class="cyber-input-group" id="group-market-vendor-name" style="margin-bottom: 0; display: none;">
              <label class="cyber-label"><i class="fa-solid fa-industry" style="color: #f59e0b;"></i> Tedarikçi / Şirket Adı <span style="color: #ef4444;">*</span></label>
              <input type="text" id="new-order-vendor-name" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important; font-weight: 700; color: #f59e0b !important;" placeholder="Örn: Schaeffler, Siemens, ABC Civata...">
            </div>

            <!-- Dynamic Box 3: For Market Order No -->
            <div class="cyber-input-group" id="group-market-order-no" style="margin-bottom: 0; display: none;">
              <label class="cyber-label"><i class="fa-solid fa-file-signature" style="color: #38bdf8;"></i> Sipariş / Teklif No</label>
              <input type="text" id="new-order-market-no" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important; font-family: monospace; font-weight: 800;" placeholder="Örn: SIP-SCH-2026-01">
            </div>

            <div class="cyber-input-group" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-warehouse" style="color: #38bdf8;"></i> Hedef Santral / Depo <span style="color: #ef4444;">*</span></label>
              <select id="new-order-warehouse-select" class="cyber-select" onchange="window.handleOrderWarehouseChange(this.value)" style="padding: 6px 10px !important; font-size: 0.85rem !important;">
                <option value="">-- Hedef Depo Seçiniz --</option>
                ${allowedWarehouses.map((w: any) => `
                  <option value="${w.id}" data-name="${w.name}">${w.name}</option>
                `).join('')}
              </select>
            </div>

            <div class="cyber-input-group" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-plane-departure" style="color: #f59e0b;"></i> Teklif Lojistik Bedeli (€)</label>
              <input type="text" inputmode="decimal" id="new-order-quoted-logistics" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important;" placeholder="Örn: 7.088,00" oninput="window.updateBasketSummaryCards()">
            </div>

            <div class="cyber-input-group" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-calendar-day" style="color: #34d399;"></i> Sipariş Tarihi</label>
              <input type="date" id="new-order-date" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important;">
            </div>

            <div class="cyber-input-group" style="margin-bottom: 0;">
              <label class="cyber-label"><i class="fa-solid fa-tags" style="color: #c084fc;"></i> Sipariş / Talep Türü</label>
              <select id="new-order-type-select" class="cyber-select" style="padding: 6px 10px !important; font-size: 0.85rem !important;">
                <option value="ENERCON_STANDART">⚡ Standart Sipariş</option>
                <option value="ACIL_ARIZA">🚨 Acil Arıza Talebi</option>
                <option value="PERIYODIK_BAKIM">🛠️ Periyodik Bakım Talebi</option>
                <option value="SARF_DIGER">📦 Genel Sarf & Diğer</option>
              </select>
            </div>

            <div class="cyber-input-group" style="margin-bottom: 0; grid-column: 1 / -1;">
              <label class="cyber-label"><i class="fa-solid fa-comment-dots" style="color: #94a3b8;"></i> Sipariş Notu / Talep Gerekçesi (Opsiyonel)</label>
              <input type="text" id="order-general-note" class="cyber-input" style="padding: 6px 10px !important; font-size: 0.85rem !important;" placeholder="Türbin no, arıza gerekçesi, proje veya teslimat notu...">
            </div>
          </div>
        </div>

        <!-- Section 2: Order Items Interactive Table (Excel style) -->
        <div class="orders-stat-card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 8px;">
            <div style="font-size: 0.85rem; font-weight: 900; color: #00f3ff; text-transform: uppercase; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-boxes-stacked"></i> 2. SİPARİŞ KALEMLERİ TABLOSU (<span id="basket-items-count-header">0 Kalem</span>)
            </div>

            <!-- Quick Action Buttons on Top of Table -->
            <div style="display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
              <button type="button" onclick="window.openApprovedDemandsModal()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(52, 211, 153, 0.4); color: #34d399; background: rgba(52, 211, 153, 0.1);" title="Ön Onaylı Saha Taleplerinden Sepete Aktar">
                <i class="fa-solid fa-list-check"></i> 📋 Saha Taleplerinden Aktar (<span id="btn-approved-demands-count">0</span>)
              </button>
              <button type="button" onclick="window.downloadOrderExcelTemplate()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(56, 189, 248, 0.4); color: #38bdf8;" title="Excel Sipariş Kalemleri Şablonunu İndir">
                <i class="fa-solid fa-file-arrow-down"></i> 📥 Şablon İndir
              </button>
              <button type="button" onclick="document.getElementById('order-excel-upload-input').click()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(16, 185, 129, 0.5); color: #34d399; background: rgba(16, 185, 129, 0.1);" title="Hazır Excel Dosyasından Yükle (.xlsx, .xls)">
                <i class="fa-solid fa-file-excel"></i> 📂 Excel'den Yükle
              </button>
              <input type="file" id="order-excel-upload-input" accept=".xlsx, .xls, .csv" style="display: none;" onchange="window.handleOrderExcelFileUpload(event)">

              <button type="button" onclick="window.addNewEmptyBasketRow()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(0, 243, 255, 0.4); color: #00f3ff;">
                <i class="fa-solid fa-plus"></i> Boş Satır Ekle
              </button>
              <button type="button" onclick="window.openCatalogPickerModal()" class="cyber-btn cyber-btn-primary" style="padding: 4px 10px; font-size: 0.76rem;">
                <i class="fa-solid fa-list-check"></i> 🔍 Katalogdan Çoklu Seç
              </button>
              <button type="button" onclick="window.openExcelPasteModal()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(16, 185, 129, 0.4); color: #34d399;">
                <i class="fa-solid fa-paste"></i> 📋 Excel'den Yapıştır
              </button>
              <button type="button" onclick="window.openManualItemModal()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 10px; font-size: 0.76rem; border-color: rgba(245, 158, 11, 0.4); color: #f59e0b;">
                <i class="fa-solid fa-pen-to-square"></i> ➕ Manuel Malzeme
              </button>
              <button type="button" onclick="window.clearEntireBasket()" class="cyber-btn cyber-btn-danger" style="padding: 4px 8px; font-size: 0.76rem;" title="Tüm Listeyi Temizle">
                <i class="fa-solid fa-trash-can"></i> Temizle
              </button>
            </div>
          </div>

          <!-- Table Container -->
          <div style="overflow-x: auto; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 8px; background: rgba(0, 0, 0, 0.35); min-height: 180px; max-height: 480px; overflow-y: auto;">
            <table class="orders-table" style="font-size: 0.76rem; margin: 0; width: 100%;">
              <thead>
                <tr style="position: sticky; top: 0; z-index: 5; background: #070d1f;">
                  <th style="width: 35px; text-align: center;">#</th>
                  <th style="width: 140px;">SAP NO</th>
                  <th style="min-width: 220px;">MALZEME TANIMI</th>
                  <th style="width: 120px;">ENERCON REF</th>
                  <th style="width: 90px; text-align: center; color: #38bdf8;">MEVCUT STOK</th>
                  <th style="width: 80px; text-align: center;">İSTENEN</th>
                  <th style="width: 95px; text-align: right;">BİRİM (€)</th>
                  <th style="width: 105px; text-align: right;">TOPLAM (€)</th>
                  <th style="width: 50px; text-align: center;">SİL</th>
                </tr>
              </thead>
              <tbody id="new-order-items-tbody">
                <!-- Rows dynamically rendered here -->
              </tbody>
            </table>
          </div>

          <!-- Empty State Prompt when 0 rows -->
          <div id="basket-empty-state" style="padding: 2.5rem 1rem; text-align: center; color: #64748b; background: rgba(0,0,0,0.2); border-radius: 0 0 8px 8px; display: block;">
            <i class="fa-solid fa-clipboard-list" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
            Henüz bir sipariş kalemi eklenmedi. Yukarıdaki <strong>"Boş Satır Ekle"</strong>, <strong>"Katalogdan Çoklu Seç"</strong> veya <strong>"Excel'den Toplu Yapıştır"</strong> butonlarını kullanabilirsiniz.
          </div>

        </div>

        <!-- Section 3: Bottom Totals & Submit Bar -->
        <div class="orders-stat-card" style="padding: 0.85rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-color: rgba(0, 243, 255, 0.35);">
          <div style="display: flex; align-items: center; gap: 24px; flex-wrap: wrap;">
            <div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Toplam Kalem:</span>
              <div style="font-size: 1.1rem; font-weight: 900; color: #fff;" id="basket-summary-items">0 Kalem</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Toplam Adet:</span>
              <div style="font-size: 1.1rem; font-weight: 900; color: #34d399;" id="basket-summary-qty">0 Adet</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Malzeme Tutarı:</span>
              <div style="font-size: 1.1rem; font-weight: 900; color: #38bdf8; font-family: monospace;" id="basket-summary-materials-price">0.00 €</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">+ Lojistik:</span>
              <div style="font-size: 1.1rem; font-weight: 900; color: #f59e0b; font-family: monospace;" id="basket-summary-logistics-price">0.00 €</div>
            </div>
            <div>
              <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Genel Toplam:</span>
              <div style="font-size: 1.25rem; font-weight: 900; color: #00f3ff; font-family: monospace;" id="basket-summary-price">0.00 €</div>
            </div>
          </div>

          <div style="display: flex; gap: 10px;">
            <button type="button" onclick="window.switchOrderView('dashboard')" class="cyber-btn cyber-btn-secondary" style="padding: 0.6rem 1.2rem; font-size: 0.85rem;">
              <i class="fa-solid fa-arrow-left"></i> Vazgeç / Dashboard
            </button>
            <button type="button" id="btn-submit-order" onclick="window.submitOrderForm()" class="cyber-btn cyber-btn-primary" style="padding: 0.6rem 1.6rem; font-size: 0.95rem; font-weight: 900;">
              <i class="fa-solid fa-paper-plane"></i> SİPARİŞİ OLUŞTUR VE YAYINLA
            </button>
          </div>
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: SAP'SİZ / MANUEL MALZEME EKLEME                  -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="manual-item-modal">
      <div class="order-modal" style="max-width: 580px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
          <h3 style="margin: 0; color: #fff; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-pen-to-square" style="color: #f59e0b;"></i> SAP'siz / Manuel Malzeme Ekle
          </h3>
          <button type="button" onclick="window.closeManualItemModal()" class="cyber-btn cyber-btn-secondary" style="padding: 4px 8px; font-size: 0.85rem;">
            <i class="fa-solid fa-times"></i>
          </button>
        </div>

        <form id="manual-item-form" onsubmit="window.handleManualItemSubmit(event)">
          <div class="cyber-input-group">
            <label class="cyber-label">Malzeme Tanımı / Açıklaması <span style="color: #ef4444;">*</span></label>
            <input type="text" id="manual-item-desc" class="cyber-input" placeholder="Örn: 24V Güç Kaynağı, Sensör, Cıvata..." required>
          </div>

          <div class="cyber-input-group">
            <label class="cyber-label">Enercon / Üretici Referans No (Varsa)</label>
            <input type="text" id="manual-item-enercon" class="cyber-input" placeholder="Örn: D0248810 veya Üretici Parça Kodu">
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="cyber-input-group">
              <label class="cyber-label">Talep Miktarı <span style="color: #ef4444;">*</span></label>
              <input type="number" step="1" min="1" id="manual-item-qty" class="cyber-input" value="1" required>
            </div>

            <div class="cyber-input-group">
              <label class="cyber-label">Birim Fiyat (€)</label>
              <input type="text" inputmode="decimal" id="manual-item-price" class="cyber-input" placeholder="Örn: 57.299,88">
            </div>
          </div>

          <div class="cyber-input-group">
            <label class="cyber-label">Ek Açıklama / Not</label>
            <input type="text" id="manual-item-note" class="cyber-input" placeholder="Malzemenin kullanılacağı yer veya ek detaylar">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
            <button type="button" onclick="window.closeManualItemModal()" class="cyber-btn cyber-btn-secondary">İPTAL</button>
            <button type="submit" class="cyber-btn cyber-btn-primary">
              <i class="fa-solid fa-plus"></i> TABLOYA EKLE
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: 54.000 SAP KATALOĞUNDAN ÇOKLU SEÇİM             -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="order-catalog-picker-modal" onclick="if(event.target === this) window.closeCatalogPickerModal()">
      <div class="order-modal" style="max-width: 860px;">
        <div class="order-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-list-check" style="color: #00f3ff; font-size: 1.1rem;"></i>
            <strong style="color: #fff; font-size: 0.95rem;">54.000 SAP KATALOĞUNDAN ÇOKLU PARÇA SEÇİMİ</strong>
          </div>
          <button type="button" onclick="window.closeCatalogPickerModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.85rem;" title="Kapat (ESC)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="padding: 0.6rem 0.9rem; background: rgba(15, 23, 42, 0.9); border-bottom: 1px solid rgba(255,255,255,0.08); display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
          <div class="cyber-search-wrapper" style="flex: 1; min-width: 250px;">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="text" id="catalog-picker-search-input" class="cyber-input" style="padding: 5px 10px 5px 32px !important; font-size: 0.85rem !important;" placeholder="SAP Numarası veya Malzeme Adı ile arayın (Örn: thyristor, 10248...)" oninput="window.handleCatalogPickerSearch(this.value)" autocomplete="off">
          </div>
          <span id="catalog-picker-selected-count" style="font-size: 0.78rem; color: #34d399; font-weight: 800; white-space: nowrap;">0 Parça Seçildi</span>
        </div>

        <div class="order-modal-body" id="catalog-picker-results-container" style="max-height: 400px; padding: 0.5rem 0.9rem;">
          <div style="padding: 3rem 1rem; text-align: center; color: #64748b;">
            <i class="fa-solid fa-search" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
            Aramak istediğiniz SAP numarasını veya malzeme adını yukarıya yazın.
          </div>
        </div>

        <div class="order-modal-footer">
          <button type="button" onclick="window.closeCatalogPickerModal()" class="cyber-btn cyber-btn-secondary">KAPAT</button>
          <button type="button" id="btn-add-catalog-selected" onclick="window.addSelectedCatalogItemsToBasket()" class="cyber-btn cyber-btn-primary">
            <i class="fa-solid fa-cart-plus"></i> SEÇİLENLERİ TABLOYA EKLE
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: EXCEL'DEN TOPLU TABLO YAPIŞTIRMA                -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="order-excel-paste-modal" onclick="if(event.target === this) window.closeExcelPasteModal()">
      <div class="order-modal" style="max-width: 820px;">
        <div class="order-modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-excel" style="color: #34d399; font-size: 1.1rem;"></i>
            <strong style="color: #fff; font-size: 0.95rem;">EXCEL'DEN TOPLU SİPARİŞ LİSTESİ YAPIŞTIR</strong>
          </div>
          <button type="button" onclick="window.closeExcelPasteModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.85rem;" title="Kapat (ESC)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="order-modal-body" style="padding: 0.85rem 1rem;">
          <div style="font-size: 0.75rem; color: #cbd5e1; margin-bottom: 0.6rem; background: rgba(0, 243, 255, 0.08); padding: 8px 12px; border-radius: 6px; border: 1px solid rgba(0, 243, 255, 0.2);">
            💡 <strong>Nasıl Kullanılır?</strong> Excel'deki hücreleri seçip kopyalayın (Ctrl+C) ve aşağıdaki alana yapıştırın (Ctrl+V).<br>
            <span style="color: #94a3b8;">Desteklenen Format: <code>SAP NO [Tab] MALZEME ADI [Tab] ADET [Tab] BİRİM FİYAT</code> veya sadece <code>SAP NO [Tab] ADET</code></span>
          </div>

          <textarea id="excel-paste-textarea" class="cyber-textarea" style="height: 120px; font-family: monospace; font-size: 0.78rem;" placeholder="Excel'den kopyaladığınız satırları buraya yapıştırın..." oninput="window.previewExcelPasteData(this.value)"></textarea>

          <div id="excel-paste-preview" style="margin-top: 8px; max-height: 180px; overflow-y: auto; display: none;">
          </div>
        </div>

        <div class="order-modal-footer">
          <button type="button" onclick="window.closeExcelPasteModal()" class="cyber-btn cyber-btn-secondary">İPTAL</button>
          <button type="button" id="btn-apply-excel-paste" onclick="window.applyExcelPasteData()" class="cyber-btn cyber-btn-emerald" disabled>
            <i class="fa-solid fa-file-import"></i> TABLOYA AKTAR (0 KALEM)
          </button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: SİPARİŞ DETAYI & PARÇALI TESLİMAT (DN) GİRİŞİ     -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="order-detail-modal">
      <div class="order-modal" style="width: 95vw; max-width: 1450px;">
        <!-- 1. Fixed Header -->
        <div class="order-modal-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="detail-order-no" style="font-size: 1.05rem; font-weight: 900; color: #00f3ff; font-family: monospace;">SIP-2026-000</span>
              <span id="detail-order-status" class="status-badge status-pending" style="font-size: 0.65rem; padding: 2px 6px;">BEKLEMEDE</span>
            </div>
            <div style="font-size: 0.74rem; color: #cbd5e1; margin-top: 2px; display: flex; gap: 10px; flex-wrap: wrap;">
              <span><i class="fa-solid fa-warehouse" style="color: #38bdf8;"></i> <strong id="detail-order-wh">-</strong></span>
              <span><i class="fa-regular fa-calendar" style="color: #38bdf8;"></i> <span id="detail-order-date">-</span></span>
              <span><i class="fa-solid fa-user" style="color: #38bdf8;"></i> <span id="detail-order-requester">-</span></span>
            </div>
            <div id="detail-order-note-container" style="font-size: 0.7rem; color: #94a3b8; margin-top: 1px; font-style: italic;"></div>
            <div id="detail-order-dn-inv-summary" style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-top: 4px;"></div>
          </div>
          <button type="button" onclick="window.closeOrderDetailModal()" class="cyber-btn cyber-btn-secondary" style="padding: 3px 8px; font-size: 0.85rem; height: 26px;" title="Kapat (ESC)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- 2. Sub-Navigation Tabs inside Modal -->
        <div class="order-modal-subnav">
          <button class="order-modal-subnav-btn active" id="modal-tab-btn-delivery" onclick="window.switchModalSubtab('delivery')">
            <i class="fa-solid fa-truck-ramp-box" style="color: #10b981;"></i> 📦 YENİ SEVKİYAT / DN
          </button>
          <button class="order-modal-subnav-btn" id="modal-tab-btn-items" onclick="window.switchModalSubtab('items')">
            <i class="fa-solid fa-list-check" style="color: #38bdf8;"></i> 📋 SİPARİŞ KALEMLERİ
          </button>
          <button class="order-modal-subnav-btn" id="modal-tab-btn-history" onclick="window.switchModalSubtab('history')">
            <i class="fa-solid fa-clock-rotate-left" style="color: #c084fc;"></i> 🕒 GEÇMİŞ (DN)
          </button>
          <button class="order-modal-subnav-btn" id="modal-tab-btn-damage" onclick="window.switchModalSubtab('damage')">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f87171;"></i> ⚠️ HASAR & İADE
          </button>
          <button class="order-modal-subnav-btn" id="modal-tab-btn-edit" onclick="window.switchModalSubtab('edit')">
            <i class="fa-solid fa-pen-to-square" style="color: #fbbf24;"></i> ✏️ DÜZENLE
          </button>
        </div>

        <!-- 3. Modal Body with Scrollable Tab Content -->
        <div class="order-modal-body">
          
          <!-- SUBTAB 1: Yeni Parçalı Sevkiyat / DN Girişi -->
          <div id="modal-subtab-delivery">
            <div id="delivery-input-card">
              <form id="partial-delivery-form" onsubmit="window.handlePartialDeliverySubmit(event)">
                <!-- 3-Field Compact Delivery Information Bar -->
                <div style="display: flex; gap: 10px; align-items: flex-end; flex-wrap: wrap; margin-bottom: 0.6rem; background: rgba(0,0,0,0.3); padding: 0.5rem 0.8rem; border-radius: 8px; border: 1px solid rgba(0, 243, 255, 0.15);">
                  <div class="cyber-input-group" style="margin-bottom: 0; width: 170px;">
                    <label class="cyber-label" style="font-size: 0.68rem; margin-bottom: 2px;"><i class="fa-solid fa-receipt" style="color: #00f3ff;"></i> Delivery No (DN) <span style="color: #ef4444;">*</span></label>
                    <input type="text" id="delivery-note-no" oninput="window.saveDeliveryModalDraft()" class="cyber-input" style="padding: 2px 6px !important; font-size: 0.76rem !important; height: 26px !important;" placeholder="Örn: DN-2026-98412" required>
                  </div>
                  <div class="cyber-input-group" style="margin-bottom: 0; width: 170px;">
                    <label class="cyber-label" style="font-size: 0.68rem; margin-bottom: 2px;"><i class="fa-solid fa-file-invoice" style="color: #00f3ff;"></i> Fatura No</label>
                    <input type="text" id="delivery-invoice-no" oninput="window.saveDeliveryModalDraft()" class="cyber-input" style="padding: 2px 6px !important; font-size: 0.76rem !important; height: 26px !important;" placeholder="Örn: FAT-2026-4418">
                  </div>
                  <div class="cyber-input-group" style="margin-bottom: 0; width: 145px;">
                    <label class="cyber-label" style="font-size: 0.68rem; margin-bottom: 2px;"><i class="fa-solid fa-dolly" style="color: #34d399;"></i> Depoya Giriş <span style="color: #ef4444;">*</span></label>
                    <input type="date" id="delivery-stock-entry-date" oninput="window.saveDeliveryModalDraft()" class="cyber-input" style="padding: 2px 6px !important; font-size: 0.75rem !important; height: 26px !important;" required>
                  </div>
                </div>

                <!-- Quick Search Filter & Batch Actions in Delivery Items -->
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem; flex-wrap: wrap; gap: 6px;">
                  <label class="cyber-label" style="margin: 0; font-size: 0.72rem;"><i class="fa-solid fa-boxes-stacked" style="color: #34d399;"></i> Gelen Miktarlar ve Raf Numaraları</label>
                  <div style="display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
                    <button type="button" onclick="window.clearAllDeliveryQuantities()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.68rem; height: 22px; color: #94a3b8;" title="Tüm miktarları boşalt">
                      <i class="fa-solid fa-eraser"></i> Temizle
                    </button>
                    <div class="cyber-search-wrapper" style="max-width: 180px;">
                      <i class="fa-solid fa-filter" style="font-size: 0.72rem;"></i>
                      <input type="text" id="delivery-items-filter" class="cyber-input" style="padding: 2px 8px 2px 24px !important; font-size: 0.72rem !important; height: 22px !important;" placeholder="Listede ara..." oninput="window.filterDeliveryModalItems(this.value)">
                    </div>
                  </div>
                </div>

                <div id="delivery-items-inputs" style="display: flex; flex-direction: column; gap: 4px; margin-bottom: 0.6rem; max-height: 240px; overflow-y: auto;">
                </div>

                <!-- Auto Warehouse Stock Integration Checkbox -->
                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; background: rgba(0,0,0,0.35); padding: 6px 10px; border-radius: 8px; margin-bottom: 0.6rem; border: 1px solid rgba(0, 243, 255, 0.15); flex-wrap: wrap;">
                  <div style="display: flex; align-items: center; gap: 6px;">
                    <input type="checkbox" id="delivery-auto-stock" checked style="width: 14px; height: 14px; cursor: pointer; accent-color: #00f3ff;">
                    <label for="delivery-auto-stock" style="font-size: 0.74rem; color: #fff; cursor: pointer; font-weight: 700;">
                      Stoğa otomatik işle (<span id="delivery-target-wh-name" style="color: #00f3ff;">-</span>)
                    </label>
                  </div>
                  <button type="submit" id="btn-save-delivery" class="cyber-btn cyber-btn-emerald" style="padding: 0.4rem 0.9rem; font-size: 0.75rem;">
                    <i class="fa-solid fa-floppy-disk"></i> TESLİMATI KAYDET
                  </button>
                </div>
              </form>
            </div>
          </div>

          <!-- SUBTAB 2: Sipariş Kalemleri ve Durum -->
          <div id="modal-subtab-items" style="display: none;">
            
            <!-- Financial Summary Cards with Logistic Cost Breakdown & Audit -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(185px, 1fr)); gap: 8px; margin-bottom: 0.75rem;">
              <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.66rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;"><i class="fa-solid fa-coins" style="color: #00f3ff;"></i> MALZEME SİPARİŞİ (TEKLİF)</div>
                <div id="detail-total-amount" style="font-size: 1.05rem; font-weight: 900; color: #00f3ff; margin-top: 2px;">0,00 €</div>
              </div>
              <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.66rem; color: #f59e0b; font-weight: 800; text-transform: uppercase; display: flex; justify-content: space-between; align-items: center;">
                  <span><i class="fa-solid fa-plane-departure" style="color: #f59e0b;"></i> LOJİSTİK COST DENETİMİ</span>
                </div>
                <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 4px; margin-top: 2px;">
                  <div id="detail-logistic-amount" style="font-size: 1.05rem; font-weight: 900; color: #f59e0b;">0,00 €</div>
                  <div id="detail-logistic-variance-badge" style="font-size: 0.68rem; font-weight: 800;"></div>
                </div>
                <div id="detail-logistic-compare-text" style="font-size: 0.65rem; color: #94a3b8; margin-top: 2px;"></div>
              </div>
              <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.66rem; color: #34d399; font-weight: 800; text-transform: uppercase;"><i class="fa-solid fa-receipt" style="color: #34d399;"></i> TOPLAM HARCAMA (COST DAHİL)</div>
                <div id="detail-delivered-amount" style="font-size: 1.05rem; font-weight: 900; color: #34d399; margin-top: 2px;">0,00 €</div>
              </div>
              <div style="background: rgba(0,0,0,0.35); border: 1px solid rgba(148, 163, 184, 0.25); border-radius: 8px; padding: 8px 12px;">
                <div style="font-size: 0.66rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;"><i class="fa-solid fa-hourglass-half" style="color: #cbd5e1;"></i> AÇIK / KALAN BAKİYE</div>
                <div id="detail-remaining-amount" style="font-size: 1.05rem; font-weight: 900; color: #cbd5e1; margin-top: 2px;">0,00 €</div>
              </div>
            </div>

            <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(255,255,255,0.06);">
              <table class="orders-table" style="font-size: 0.8rem;">
                <thead>
                  <tr>
                    <th>SAP NO</th>
                    <th>TANIM & ENERCON REF</th>
                    <th style="text-align: center; width: 55px;">İSTENEN</th>
                    <th style="text-align: right; width: 75px; color: #38bdf8;">BİRİM (€)</th>
                    <th style="text-align: right; width: 80px; color: #00f3ff;">TOPLAM (€)</th>
                    <th style="text-align: center; width: 60px; color: #34d399;">SAĞLAM</th>
                    <th style="text-align: center; width: 60px; color: #f87171;">HASARLI</th>
                    <th style="text-align: center; width: 55px; color: #f59e0b;">KALAN</th>
                    <th style="min-width: 140px; color: #38bdf8;"><i class="fa-solid fa-receipt"></i> GELEN DN & FATURA</th>
                    <th style="text-align: center; width: 85px;">DURUM</th>
                  </tr>
                </thead>
                <tbody id="detail-items-tbody">
                </tbody>
              </table>
            </div>
          </div>

          <!-- SUBTAB 3: Geçmiş Sevkiyatlar Timeline -->
          <div id="modal-subtab-history" style="display: none;">
            <div id="detail-deliveries-history">
              <div style="color: #64748b; font-size: 0.82rem; text-align: center; padding: 1.5rem;">
                Henüz teslimat girişi yapılmamıştır.
              </div>
            </div>
          </div>

          <!-- SUBTAB 4: Hasar & İade Takip Listesi -->
          <div id="modal-subtab-damage" style="display: none;">
            <div id="detail-damage-history">
              <div style="color: #64748b; font-size: 0.82rem; text-align: center; padding: 1.5rem;">
                Bu siparişte kayıtlı hasar veya iade bulunmamaktadır.
              </div>
            </div>
          </div>

          <!-- SUBTAB 5: Sipariş & SAP No Düzenle -->
          <div id="modal-subtab-edit" style="display: none;">
            <div style="background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(251, 191, 36, 0.25); padding: 1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.85rem; font-weight: 800; color: #fbbf24; margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
                <span><i class="fa-solid fa-pen-to-square"></i> Sipariş Kalemlerini, SAP No ve Miktarları Düzenle</span>
                <button type="button" onclick="window.addEditItemRow()" class="cyber-btn cyber-btn-secondary" style="font-size: 0.75rem; padding: 4px 10px;">
                  <i class="fa-solid fa-plus"></i> Yeni Kalem Ekle
                </button>
              </div>

              <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); margin-bottom: 1rem;">
                <table class="orders-table" style="font-size: 0.8rem; width: 100%;">
                  <thead>
                    <tr>
                      <th style="width: 140px; color: #00f3ff;">SAP NO</th>
                      <th style="color: #fff;">MALZEME TANIMI</th>
                      <th style="width: 130px; color: #38bdf8;">ENERCON REF</th>
                      <th style="text-align: center; width: 80px; color: #34d399;">İSTENEN</th>
                      <th style="text-align: right; width: 100px; color: #38bdf8;">BİRİM (€)</th>
                      <th style="text-align: center; width: 70px; color: #94a3b8;">GELEN</th>
                      <th style="text-align: center; width: 50px;">İŞLEM</th>
                    </tr>
                  </thead>
                  <tbody id="order-edit-items-container">
                  </tbody>
                </table>
              </div>

              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 1rem;">
                <div class="cyber-input-group" style="margin-bottom: 0;">
                  <label class="cyber-label"><i class="fa-solid fa-plane-departure" style="color: #f59e0b;"></i> Teklif Edilen Lojistik Bedeli (€):</label>
                  <input type="text" inputmode="decimal" id="order-edit-quoted-logistics" class="cyber-input" style="height: 36px; font-size: 0.85rem;" placeholder="Örn: 7.088,00">
                </div>
                <div class="cyber-input-group" style="margin-bottom: 0;">
                  <label class="cyber-label"><i class="fa-regular fa-comment-dots" style="color: #fbbf24;"></i> Sipariş Notu / Açıklama:</label>
                  <input type="text" id="order-edit-note" class="cyber-input" style="height: 36px; font-size: 0.85rem;" placeholder="Siparişle ilgili genel notlar...">
                </div>
              </div>

              <div style="display: flex; justify-content: flex-end;">
                <button type="button" id="btn-save-order-edit" onclick="window.handleSaveOrderEdit()" class="cyber-btn" style="background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; font-weight: 800; padding: 0.6rem 1.4rem;">
                  <i class="fa-solid fa-floppy-disk"></i> DEĞİŞİKLİKLERİ KAYDET
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- 4. Fixed Footer -->
        <div class="order-modal-footer">
          <button type="button" onclick="window.deleteCurrentOrderConfirm()" class="cyber-btn cyber-btn-danger" style="font-size: 0.78rem;">
            <i class="fa-solid fa-trash"></i> SİPARİŞİ SİL
          </button>
          <button type="button" onclick="window.closeOrderDetailModal()" class="cyber-btn cyber-btn-secondary">KAPAT</button>
        </div>

      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: FATURA BİLGİSİ VE LOJİSTİK FİYAT GİRİŞİ          -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="order-invoice-edit-modal" style="z-index: 25000;">
      <div class="order-modal" style="width: 95vw; max-width: 960px; z-index: 25001; border-radius: 12px; box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 25px rgba(0, 243, 255, 0.1);">
        <div class="order-modal-header" style="padding: 0.65rem 1rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-receipt" style="color: #34d399; font-size: 1.05rem;"></i>
            <strong style="color: #fff; font-size: 0.9rem; letter-spacing: 0.3px;">Fatura & Lojistik Fiyat Girişi</strong>
            <span id="edit-invoice-dn-badge" style="font-family: monospace; font-size: 0.7rem; font-weight: 800; color: #00f3ff; background: rgba(0,243,255,0.1); border: 1px solid rgba(0,243,255,0.3); padding: 1px 8px; border-radius: 12px;">DN: -</span>
          </div>
          <button type="button" onclick="window.closeUpdateInvoiceModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.8rem; height: 26px;" title="Kapat (ESC)">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="update-invoice-form" onsubmit="window.handleSaveInvoiceUpdate(event)">
          <input type="hidden" id="edit-invoice-order-id">
          <input type="hidden" id="edit-invoice-delivery-id">

          <div class="order-modal-body" style="padding: 0.75rem 1rem;">
            <!-- Compact Header Inputs -->
            <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 10px; margin-bottom: 0.65rem; background: rgba(15, 23, 42, 0.5); padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255, 255, 255, 0.08);">
              <div>
                <label style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 2px;">
                  <i class="fa-solid fa-file-invoice" style="color: #00f3ff;"></i> Fatura No <span style="color: #ef4444;">*</span>
                </label>
                <input type="text" id="edit-invoice-no" class="cyber-input" placeholder="Örn: ER36256" required style="height: 30px; font-size: 0.82rem; font-family: monospace; font-weight: 700; color: #00f3ff !important; padding: 2px 8px;">
              </div>

              <div>
                <label style="font-size: 0.68rem; font-weight: 700; color: #94a3b8; display: block; margin-bottom: 2px;">
                  <i class="fa-solid fa-calendar-day" style="color: #34d399;"></i> Fatura Tarihi
                </label>
                <input type="date" id="edit-invoice-date" class="cyber-input" style="height: 30px; font-size: 0.82rem; padding: 2px 8px;">
              </div>
            </div>

            <div style="font-size: 0.72rem; font-weight: 700; color: #94a3b8; margin-bottom: 0.35rem; display: flex; align-items: center; justify-content: space-between;">
              <span style="color: #38bdf8; font-weight: 800;"><i class="fa-solid fa-boxes-stacked"></i> Sevkiyattaki Malzemeler</span>
              <span style="font-size: 0.66rem; color: #64748b;">(Faturadaki nihai birim fiyatları giriniz)</span>
            </div>

            <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 0.65rem;">
              <table class="orders-table" style="font-size: 0.78rem; width: 100%;">
                <thead>
                  <tr>
                    <th style="width: 100px; color: #00f3ff; padding: 6px 8px;">SAP NO</th>
                    <th style="color: #fff; padding: 6px 8px;">MALZEME TANIMI</th>
                    <th style="text-align: center; width: 60px; color: #34d399; padding: 6px 8px;">GELEN</th>
                    <th style="text-align: right; width: 80px; color: #94a3b8; padding: 6px 8px;">SİPARİŞ (€)</th>
                    <th style="text-align: right; width: 105px; color: #38bdf8; padding: 6px 8px;">FATURA BİRİM (€)</th>
                    <th style="text-align: center; width: 110px; color: #f59e0b; padding: 6px 8px;">LOJİSTİK FARKI</th>
                    <th style="text-align: right; width: 95px; color: #00f3ff; padding: 6px 8px;">FATURA TUTARI</th>
                  </tr>
                </thead>
                <tbody id="edit-invoice-items-tbody">
                </tbody>
              </table>
            </div>

            <!-- Compact modern summary bar with Live Quoted Logistics Audit -->
            <div style="display: flex; flex-direction: column; gap: 8px; background: rgba(15, 23, 42, 0.85); padding: 8px 14px; border-radius: 8px; border: 1px solid rgba(0, 243, 255, 0.25);">
              <div style="display: flex; align-items: center; justify-content: space-around; gap: 8px; flex-wrap: wrap;">
                <div style="text-align: center;">
                  <div style="font-size: 0.64rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Sipariş (Malzeme)</div>
                  <div id="edit-invoice-sum-order" style="font-size: 0.85rem; font-weight: 800; color: #cbd5e1;">0.00 €</div>
                </div>
                <div style="width: 1px; height: 22px; background: rgba(255,255,255,0.1);"></div>
                <div style="text-align: center;">
                  <div style="font-size: 0.64rem; color: #38bdf8; font-weight: 700; text-transform: uppercase;">Teklif Lojistiği</div>
                  <div id="edit-invoice-sum-quoted" style="font-size: 0.85rem; font-weight: 800; color: #38bdf8;">0.00 €</div>
                </div>
                <div style="width: 1px; height: 22px; background: rgba(255,255,255,0.1);"></div>
                <div style="text-align: center;">
                  <div style="font-size: 0.64rem; color: #f59e0b; font-weight: 700; text-transform: uppercase;">Fatura Lojistiği</div>
                  <div id="edit-invoice-sum-diff" style="font-size: 0.88rem; font-weight: 800; color: #f59e0b;">+0.00 €</div>
                </div>
                <div style="width: 1px; height: 22px; background: rgba(255,255,255,0.1);"></div>
                <div style="text-align: center;">
                  <div style="font-size: 0.64rem; color: #00f3ff; font-weight: 700; text-transform: uppercase;">Fatura Toplamı</div>
                  <div id="edit-invoice-sum-invoiced" style="font-size: 0.92rem; font-weight: 900; color: #00f3ff; font-family: monospace;">0.00 €</div>
                </div>
              </div>

              <!-- Live Audit Banner -->
              <div id="edit-invoice-audit-banner" style="display: none; align-items: center; justify-content: center; padding: 5px 10px; border-radius: 6px; font-size: 0.76rem; font-weight: 800; text-align: center;">
              </div>
            </div>
          </div>

          <div class="order-modal-footer" style="padding: 0.65rem 1rem;">
            <button type="button" onclick="window.closeUpdateInvoiceModal()" class="cyber-btn cyber-btn-secondary" style="height: 30px; font-size: 0.76rem; padding: 2px 12px;">İPTAL</button>
            <button type="submit" id="btn-save-invoice" class="cyber-btn cyber-btn-emerald" style="height: 30px; font-size: 0.78rem; padding: 2px 14px; font-weight: 800;">
              <i class="fa-solid fa-floppy-disk"></i> FATURAYI KAYDET
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL: ONAYLI SAHA TALEPLERİ HAVUZU                     -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="order-modal-overlay" id="approved-demands-modal" style="z-index: 24000;">
      <div class="order-modal" style="width: 95vw; max-width: 1000px; max-height: 90vh;">
        <div class="order-modal-header" style="padding: 0.75rem 1.25rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-list-check" style="color: #34d399; font-size: 1.1rem;"></i>
            <strong style="color: #fff; font-size: 0.95rem;">Ön Onaylı Saha Talepleri Havuzu</strong>
          </div>
          <button type="button" onclick="window.closeApprovedDemandsModal()" class="cyber-btn cyber-btn-secondary" style="padding: 2px 6px; font-size: 0.8rem; height: 26px;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div class="order-modal-body" style="padding: 1rem 1.25rem; overflow-y: auto;">
          <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0; margin-bottom: 0.75rem;">
            Aşağıda saha sorumlusu / yönetici tarafından ön onayı verilmiş ve sipariş açılması beklenen saha talepleri listelenmektedir. Sipariş sepetine aktarmak istediğiniz talebin yanındaki butona tıklayabilirsiniz.
          </p>
          <div id="approved-demands-modal-list">
            <div style="text-align: center; padding: 2rem; color: #94a3b8;">
              <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: #00f3ff; margin-bottom: 8px;"></i>
              <div>Talepler yükleniyor...</div>
            </div>
          </div>
        </div>

        <div class="order-modal-footer" style="padding: 0.75rem 1.25rem;">
          <button type="button" onclick="window.closeApprovedDemandsModal()" class="cyber-btn cyber-btn-secondary">KAPAT</button>
        </div>
      </div>
    </div>
  `;
};

// Global State for Orders Page
let allOrdersList: PurchaseRequest[] = [];
let filteredOrdersList: PurchaseRequest[] = [];
let selectedSiteFilter = 'ALL';
let selectedStatusFilter = 'ALL';
let orderSearchTerm = '';
let currentBasket: any[] = [];
let activeDetailOrderId = '';

// Helper: Universal price input parser that supports Turkish/German & International formats:
// "57.299,88" -> 57299.88, "7.088" -> 7088, "16,74" -> 16.74, "57299.88" -> 57299.88
function parsePriceInput(val: string | number | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  let str = String(val).trim();
  if (!str) return 0;

  // Remove currency symbols, non-breaking spaces, regular spaces
  str = str.replace(/[€$₺TL\s\u00a0]/gi, '').trim();
  if (!str) return 0;

  // If contains both '.' and ',' (e.g. 57.299,88 or 57,299.88)
  if (str.includes('.') && str.includes(',')) {
    const lastDot = str.lastIndexOf('.');
    const lastComma = str.lastIndexOf(',');
    if (lastComma > lastDot) {
      // 57.299,88 -> remove all '.' then replace ',' with '.'
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // 57,299.88 -> remove all ','
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',')) {
    // Only comma (e.g. 57299,88 or 16,74) -> replace ',' with '.'
    str = str.replace(',', '.');
  } else if (str.includes('.')) {
    // Only dot: e.g. 57.299 or 7.088 or 57299.88
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3 && parseInt(parts[0], 10) > 0) {
      // Single dot followed by exactly 3 digits (e.g. 7.088 or 57.299) -> thousand separator!
      str = str.replace('.', '');
    } else if (parts.length > 2) {
      // Multiple dots: 57.299.88 -> remove thousands dots
      str = parts.slice(0, -1).join('') + '.' + parts[parts.length - 1];
    }
  }

  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Init function
(window as any).initSiparisPage = async () => {
  (window as any).loadSapCatalogData().catch(() => {});
  (window as any).updateApprovedDemandsButtonCount?.();
  await (window as any).refreshOrdersTable(false);
};

(window as any).switchOrderView = (view: 'dashboard' | 'create') => {
  const dashView = document.getElementById('orders-dashboard-view');
  const createView = document.getElementById('orders-create-view');
  const tabDash = document.getElementById('tab-btn-dashboard');
  const tabCreate = document.getElementById('tab-btn-create');

  if (view === 'dashboard') {
    if (dashView) dashView.style.display = 'block';
    if (createView) createView.style.display = 'none';
    if (tabDash) tabDash.classList.add('active');
    if (tabCreate) tabCreate.classList.remove('active');
    (window as any).refreshOrdersTable(false);
  } else {
    if (dashView) dashView.style.display = 'none';
    if (createView) createView.style.display = 'block';
    if (tabDash) tabDash.classList.remove('active');
    if (tabCreate) tabCreate.classList.add('active');

    const dateInput = document.getElementById('new-order-date') as HTMLInputElement;
    if (dateInput && !dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }

    (window as any).updateApprovedDemandsButtonCount?.();

    if (newOrderBasket.length === 0) {
      (window as any).addNewEmptyBasketRow();
    } else {
      (window as any).renderNewOrderItemsTable();
    }

    // Pre-fetch catalog in background
    (window as any).loadSapCatalogData();
  }
};

(window as any).refreshOrdersTable = async (forceRefresh = false) => {
  const tbody = document.getElementById('orders-table-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00f3ff; margin-bottom: 1rem; display: block;"></i>
          Sipariş listesi yükleniyor...
        </td>
      </tr>
    `;
  }

  try {
    allOrdersList = await orderService.getRequests(forceRefresh);

    // Compute Stats
    const statTotal = document.getElementById('stat-orders-total');
    const statBackorder = document.getElementById('stat-orders-backorder');
    const statPartial = document.getElementById('stat-orders-partial');
    const statCompleted = document.getElementById('stat-orders-completed');

    let totalBackorderItems = 0;
    let partialCount = 0;
    let completedCount = 0;

    allOrdersList.forEach(order => {
      if (order.status === 'COMPLETED') completedCount++;
      if (order.status === 'PARTIAL') partialCount++;

      (order.items || []).forEach(item => {
        totalBackorderItems += (item.remainingQuantity || 0);
      });
    });

    if (statTotal) statTotal.innerText = allOrdersList.length.toLocaleString('tr-TR');
    if (statBackorder) statBackorder.innerText = `${totalBackorderItems.toLocaleString('tr-TR')} Kalem/Adet`;
    if (statPartial) statPartial.innerText = partialCount.toLocaleString('tr-TR');
    if (statCompleted) statCompleted.innerText = completedCount.toLocaleString('tr-TR');

    (window as any).applyOrderFilters();
  } catch (e) {
    console.error('[Siparis] Error loading orders:', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 2rem; text-align: center; color: #ef4444;">Siparişler yüklenirken hata oluştu.</td></tr>`;
    }
  }
};

(window as any).filterOrdersBySite = (siteId: string, el: HTMLElement) => {
  selectedSiteFilter = siteId;
  document.querySelectorAll('#order-site-filter-scroll .site-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  (window as any).applyOrderFilters();
};

(window as any).filterOrdersByStatus = (status: string, el: HTMLElement) => {
  selectedStatusFilter = status;
  document.querySelectorAll('#order-status-pills .filter-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  (window as any).applyOrderFilters();
};

(window as any).handleOrderSearch = (term: string) => {
  orderSearchTerm = (term || '').toLowerCase().trim();
  (window as any).applyOrderFilters();
};

const normalizeTurkishStr = (s: string) => (s || '')
  .toLowerCase()
  .replace(/ı/g, 'i')
  .replace(/i̇/g, 'i')
  .replace(/ğ/g, 'g')
  .replace(/ü/g, 'u')
  .replace(/ş/g, 's')
  .replace(/ö/g, 'o')
  .replace(/ç/g, 'c')
  .replace(/deposu/g, '')
  .replace(/depo/g, '')
  .trim();

(window as any).applyOrderFilters = () => {
  filteredOrdersList = allOrdersList.filter(order => {
    // Site filter (supports matching warehouse code 2688, warehouse name, site name, etc.)
    if (selectedSiteFilter !== 'ALL') {
      const allWhs = dataService.getWarehouses();
      const targetWh = allWhs.find((w: any) => w.id === selectedSiteFilter);
      const targetNormalized = targetWh ? normalizeTurkishStr(targetWh.name) : '';
      const filterKey = selectedSiteFilter.toLowerCase();

      const orderWhId = String(order.warehouseId || '').toLowerCase();
      const orderSiteId = String(order.siteId || '').toLowerCase();
      const orderWhNorm = normalizeTurkishStr(order.warehouseName || '');
      const orderSiteNorm = normalizeTurkishStr(order.siteName || '');

      const isMatch = 
        orderWhId === filterKey ||
        orderSiteId === filterKey ||
        (targetNormalized && (
          orderWhNorm.includes(targetNormalized) || 
          targetNormalized.includes(orderWhNorm) ||
          orderSiteNorm.includes(targetNormalized) ||
          orderWhId.includes(targetNormalized)
        ));

      if (!isMatch) {
        return false;
      }
    }

    // Status filter
    if (selectedStatusFilter !== 'ALL') {
      if (selectedStatusFilter === 'PENDING' && order.status !== 'PENDING' && order.status !== 'ORDERED') {
        return false;
      }
      if (selectedStatusFilter === 'PARTIAL' && order.status !== 'PARTIAL') {
        return false;
      }
      if (selectedStatusFilter === 'COMPLETED' && order.status !== 'COMPLETED') {
        return false;
      }
      if (selectedStatusFilter === 'DAMAGED') {
        const hasDamagedItem = (order.items || []).some(i => (i.damagedQuantity || 0) > 0);
        const hasDamagedDelivery = (order.deliveries || []).some(d => (d.items || []).some(di => (di.damagedQty || 0) > 0));
        if (!hasDamagedItem && !hasDamagedDelivery) {
          return false;
        }
      }
    }

    // Search term
    if (orderSearchTerm) {
      const orderNo = (order.orderNo || '').toLowerCase();
      const wh = (order.warehouseName || '').toLowerCase();
      const req = (order.requesterName || order.requester || '').toLowerCase();
      const hasItem = (order.items || []).some(i => 
        (i.description || '').toLowerCase().includes(orderSearchTerm) ||
        (i.sapNo || '').toLowerCase().includes(orderSearchTerm) ||
        (i.enerconRef || '').toLowerCase().includes(orderSearchTerm)
      );
      const hasDn = (order.deliveries || []).some(d => 
        (d.deliveryNoteNo || '').toLowerCase().includes(orderSearchTerm) ||
        ((d.invoiceNo || '').toLowerCase().includes(orderSearchTerm))
      );

      if (!orderNo.includes(orderSearchTerm) && !wh.includes(orderSearchTerm) && !req.includes(orderSearchTerm) && !hasItem && !hasDn) {
        return false;
      }
    }

    return true;
  });

  // Update KPI Stats dynamically according to the active filter (Site/Status/Search)
  const statTotal = document.getElementById('stat-orders-total');
  const statMaterialCost = document.getElementById('stat-orders-material-cost');
  const statLogisticCost = document.getElementById('stat-orders-logistic-cost');
  const statTotalSpend = document.getElementById('stat-orders-total-spend');
  const statBackorder = document.getElementById('stat-orders-backorder');

  let totalOrdersCount = filteredOrdersList.length;
  let totalMaterialEur = 0;
  let totalLogisticCostEur = 0;
  let totalGrandSpendEur = 0;
  let totalBackorderItems = 0;

  filteredOrdersList.forEach(order => {
    (order.items || []).forEach(item => {
      const p = Number(item.price) || 0;
      const invP = Number(item.invoicePrice) || p;
      const requested = Number(item.quantity) || 0;
      const delivered = Number(item.deliveredQuantity) || 0;
      const remaining = Math.max(0, requested - delivered);

      const costDiff = Math.max(0, invP - p);

      totalMaterialEur += (requested * p);
      totalLogisticCostEur += (delivered * costDiff);
      totalGrandSpendEur += (delivered * invP) + (remaining * p);
      totalBackorderItems += remaining;
    });
  });

  if (statTotal) statTotal.innerText = totalOrdersCount.toLocaleString('tr-TR');
  if (statMaterialCost) statMaterialCost.innerText = `${totalMaterialEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (statLogisticCost) {
    const pct = totalMaterialEur > 0 ? ((totalLogisticCostEur / totalMaterialEur) * 100).toFixed(1) : '0.0';
    statLogisticCost.innerText = totalLogisticCostEur > 0 ? `+${totalLogisticCostEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € (%${pct})` : '0,00 €';
  }
  if (statTotalSpend) statTotalSpend.innerText = `${totalGrandSpendEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (statBackorder) statBackorder.innerText = `${totalBackorderItems.toLocaleString('tr-TR')} Kalem/Adet`;

  (window as any).renderOrdersTableRows();
};

(window as any).renderOrdersTableRows = () => {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  if (filteredOrdersList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-box-open" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.75rem; display: block;"></i>
          Kriterlere uygun sipariş bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filteredOrdersList.map(order => {
    const totalQty = (order.items || []).reduce((acc, i) => acc + (i.quantity || 0), 0);
    const deliveredQty = (order.items || []).reduce((acc, i) => acc + (i.deliveredQuantity || 0), 0);
    const pct = totalQty > 0 ? Math.round((deliveredQty / totalQty) * 100) : 0;

    const dateStr = order.timestamp?.toDate 
      ? order.timestamp.toDate().toLocaleDateString('tr-TR') 
      : new Date().toLocaleDateString('tr-TR');

    let badgeClass = 'status-pending';
    let badgeText = 'BEKLEMEDE';
    if (order.status === 'COMPLETED' || pct === 100) {
      badgeClass = 'status-completed';
      badgeText = 'TAMAMLANDI';
    } else if (order.status === 'PARTIAL' || deliveredQty > 0) {
      badgeClass = 'status-partial';
      badgeText = `PARÇALI (%${pct})`;
    }

    const deliveryNotes = (order.deliveries || []).map(d => d.deliveryNoteNo).filter(Boolean);

    return `
      <tr>
        <td>
          <div style="font-family: monospace; font-weight: 900; color: #00f3ff; font-size: 0.88rem; display: flex; align-items: center; gap: 5px;">
            <i class="fa-solid fa-barcode" style="color: #38bdf8; font-size: 0.8rem;"></i> ${order.orderNo}
          </div>
          <div style="font-size: 0.7rem; color: #64748b; margin-top: 1px;">
            <i class="fa-regular fa-clock"></i> ${dateStr}
          </div>
        </td>
        <td>
          <div style="font-weight: 800; color: #fff; font-size: 0.82rem;">${order.warehouseName}</div>
          <div style="font-size: 0.7rem; color: #38bdf8;">${(order.items || []).length} Kalem Malzeme</div>
        </td>
        <td>
          <div style="display: flex; justify-content: space-between; font-size: 0.76rem; font-weight: 700;">
            <span style="color: #e2e8f0;">${deliveredQty} / ${totalQty} Adet Teslim Alındı</span>
            <span style="color: ${pct === 100 ? '#34d399' : (pct > 0 ? '#60a5fa' : '#f59e0b')}; font-weight: 900;">%${pct}</span>
          </div>
          <div class="delivery-progress-bar">
            <div class="delivery-progress-fill" style="width: ${pct}%;"></div>
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8; margin-top: 3px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">
            ${(order.items || []).map(i => i.description).join(', ')}
          </div>
        </td>
        <td>
          ${deliveryNotes.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 3px;">
              ${deliveryNotes.map(dn => `<span class="badge-dn-chip">${dn}</span>`).join('')}
            </div>
          ` : '<span style="color: #64748b; font-size: 0.72rem; font-style: italic;">Henüz DN yok</span>'}
        </td>
        <td>
          <div style="font-size: 0.8rem; color: #e2e8f0; font-weight: 700;">${order.requesterName || order.requester}</div>
          <div style="font-size: 0.68rem; color: #64748b;">${order.requester}</div>
        </td>
        <td style="text-align: center;">
          <span class="status-badge ${badgeClass}">${badgeText}</span>
        </td>
        <td style="text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 5px;">
            <button onclick="window.viewOrderDetail('${order.id}')" class="cyber-btn cyber-btn-primary" style="padding: 4px 9px; font-size: 0.75rem;" title="Detay & Delivery Note Girişi">
              <i class="fa-solid fa-truck-ramp-box"></i> DETAY
            </button>
            <button onclick="window.deleteOrderDirect('${order.id}')" class="cyber-btn cyber-btn-danger" style="padding: 4px 8px; font-size: 0.75rem;" title="Siparişi Sil">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

(window as any).deleteOrderDirect = async (orderId: string) => {
  if (!orderId) return;
  const order = allOrdersList.find(o => o.id === orderId);
  const orderNo = order?.orderNo || 'Sipariş';
  if (!confirm(`"${orderNo}" numaralı siparişi ve tüm sevkiyat kayıtlarını kalıcı olarak silmek istediğinizden emin misiniz?`)) return;

  try {
    await orderService.deleteRequest(orderId);
    await (window as any).refreshOrdersTable(true);
    alert(`${orderNo} başarıyla silindi.`);
  } catch (e) {
    alert("Sipariş silinirken hata oluştu: " + e);
  }
};

// ═══════════════════════════════════════════════════════
// NEW ORDER CREATION LOGIC (EXCEL-STYLE INTERACTIVE GRID)
// ═══════════════════════════════════════════════════════

interface NewBasketItem {
  id: string;
  sapNo: string;
  description: string;
  enerconRef: string;
  quantity: number;
  price?: number;
  currentStock: number;
  unit: string;
  note: string;
}

let newOrderBasket: NewBasketItem[] = [];
let warehouseInventoryCache: Record<string, InventoryItem[]> = {};
let cachedSapCatalogList: Array<{ sapNo: string; description: string }> = [];
let selectedCatalogPickerMap: Map<string, { sapNo: string; description: string; quantity: number }> = new Map();
let parsedExcelRows: Array<{ sapNo: string; description: string; quantity: number; price?: number }> = [];

(window as any).loadSapCatalogData = async () => {
  if (cachedSapCatalogList.length > 0) return cachedSapCatalogList;
  try {
    const resp = await fetch('/sap_dictionary.json');
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data)) {
        cachedSapCatalogList = data.map((item: any) => ({
          sapNo: String(item.n || item.sapNo || '').trim(),
          description: String(item.d || item.description || '').trim()
        }));
      } else if (typeof data === 'object' && data !== null) {
        cachedSapCatalogList = Object.keys(data).map(key => ({
          sapNo: key.trim(),
          description: String(data[key]).trim()
        }));
      }
    }
  } catch (e) {
    console.error('Error loading sap catalog in Siparis:', e);
  }
  return cachedSapCatalogList;
};

// Helper: Get stock for SAP in selected warehouse
(window as any).getWarehouseStockForItem = async (whId: string, sapNo: string): Promise<number> => {
  if (!whId || !sapNo) return 0;
  try {
    if (!warehouseInventoryCache[whId]) {
      warehouseInventoryCache[whId] = await warehouseService.getInventory(whId);
    }
    const inv = warehouseInventoryCache[whId] || [];
    const found = inv.find(i => (i.sapNo || '').trim() === sapNo.trim());
    return found ? (found.quantity || 0) : 0;
  } catch (e) {
    return 0;
  }
};

// Handle warehouse select change in order creation
(window as any).handleOrderWarehouseChange = async (whId: string) => {
  if (!whId) return;
  try {
    warehouseInventoryCache[whId] = await warehouseService.getInventory(whId, true);
    for (const item of newOrderBasket) {
      if (item.sapNo) {
        const found = (warehouseInventoryCache[whId] || []).find(i => (i.sapNo || '').trim() === item.sapNo.trim());
        item.currentStock = found ? (found.quantity || 0) : 0;
      }
    }
    (window as any).renderNewOrderItemsTable();
  } catch (e) {
    console.error("Warehouse stock refresh error:", e);
  }
};

// Update summary cards
(window as any).updateBasketSummaryCards = () => {
  const countHeader = document.getElementById('basket-items-count-header');
  const sumItems = document.getElementById('basket-summary-items');
  const sumQty = document.getElementById('basket-summary-qty');
  const sumMatPrice = document.getElementById('basket-summary-materials-price');
  const sumLogPrice = document.getElementById('basket-summary-logistics-price');
  const sumPrice = document.getElementById('basket-summary-price');

  const quotedLogistics = parsePriceInput((document.getElementById('new-order-quoted-logistics') as HTMLInputElement)?.value);

  const totalItems = newOrderBasket.length;
  const totalQty = newOrderBasket.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0);
  const totalMatPrice = newOrderBasket.reduce((sum, i) => sum + ((Number(i.price) || 0) * (Number(i.quantity) || 0)), 0);
  const grandTotal = totalMatPrice + quotedLogistics;

  if (countHeader) countHeader.innerText = `${totalItems} Kalem`;
  if (sumItems) sumItems.innerText = `${totalItems} Kalem`;
  if (sumQty) sumQty.innerText = `${totalQty} Adet`;
  if (sumMatPrice) sumMatPrice.innerText = `${totalMatPrice.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (sumLogPrice) sumLogPrice.innerText = `${quotedLogistics.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (sumPrice) sumPrice.innerText = `${grandTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
};

// Render Order Items Table
(window as any).renderNewOrderItemsTable = () => {
  const tbody = document.getElementById('new-order-items-tbody');
  const emptyState = document.getElementById('basket-empty-state');

  (window as any).updateBasketSummaryCards();

  if (!tbody) return;

  if (newOrderBasket.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = newOrderBasket.map((item, idx) => {
    const safeDesc = (item.description || '').replace(/"/g, '&quot;');
    const lineTotal = ((Number(item.price) || 0) * (Number(item.quantity) || 0));

    return `
      <tr data-row-id="${item.id}">
        <td style="text-align: center; color: #64748b; font-weight: 800; font-size: 0.75rem;">
          ${idx + 1}
        </td>
        <td>
          <input type="text" value="${item.sapNo || ''}" data-sap-input="${item.id}" oninput="window.handleBasketSapInput('${item.id}', this.value)" onchange="window.handleBasketSapInput('${item.id}', this.value)" placeholder="SAP No (örn: 111898...)" class="mini-input" style="width: 100% !important; color: #00f3ff !important; font-family: monospace; font-weight: 800;">
        </td>
        <td>
          <input type="text" value="${safeDesc}" data-desc-input="${item.id}" oninput="window.handleBasketDescInput('${item.id}', this.value)" placeholder="Malzeme Açıklaması" class="mini-input" style="width: 100% !important; color: #fff !important; font-weight: 600;">
        </td>
        <td>
          <input type="text" value="${item.enerconRef || ''}" data-ref-input="${item.id}" oninput="window.handleBasketRefInput('${item.id}', this.value)" placeholder="Enercon Ref" class="mini-input" style="width: 100% !important; color: #38bdf8 !important;">
        </td>
        <td style="text-align: center;">
          <span data-stock-span="${item.id}" style="font-size: 0.78rem; font-weight: 800; color: ${item.currentStock > 0 ? '#34d399' : '#64748b'};">
            ${item.currentStock > 0 ? `${item.currentStock} Adet` : '0'}
          </span>
        </td>
        <td style="text-align: center;">
          <input type="number" min="1" value="${item.quantity}" data-qty-input="${item.id}" oninput="window.handleBasketQtyInput('${item.id}', this.value)" class="mini-input" style="width: 60px !important; text-align: center; font-weight: 900; color: #34d399 !important;">
        </td>
        <td style="text-align: right;">
          <input type="text" inputmode="decimal" placeholder="0.00" value="${item.price !== undefined && item.price > 0 ? item.price : ''}" data-price-input="${item.id}" oninput="window.handleBasketPriceInput('${item.id}', this.value)" class="mini-input" style="width: 80px !important; text-align: right; font-weight: 800; color: #38bdf8 !important;">
        </td>
        <td style="text-align: right; font-weight: 900; color: #00f3ff; font-family: monospace; font-size: 0.82rem;">
          <span data-linetotal-span="${item.id}">${lineTotal > 0 ? lineTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-'}</span>
        </td>
        <td style="text-align: center;">
          <button type="button" onclick="window.removeBasketRow('${item.id}')" class="cyber-btn cyber-btn-danger" style="padding: 2px 6px; font-size: 0.72rem; height: 24px;" title="Satırı Sil">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
};

// Live SAP Input Handler (Instant auto-fill & immediate clear on delete/change)
(window as any).handleBasketSapInput = async (rowId: string, rawVal: string) => {
  const item = newOrderBasket.find(i => i.id === rowId);
  if (!item) return;

  const sap = rawVal.trim();
  item.sapNo = sap;

  const descInput = document.querySelector(`[data-desc-input="${rowId}"]`) as HTMLInputElement;
  const stockSpan = document.querySelector(`[data-stock-span="${rowId}"]`) as HTMLElement;

  if (!sap) {
    // Sildiğinde anlık olarak eski açıklama ve stok anında temizlenir!
    item.description = '';
    item.currentStock = 0;
    if (descInput) descInput.value = '';
    if (stockSpan) {
      stockSpan.innerText = '0';
      stockSpan.style.color = '#64748b';
    }
    return;
  }

  // Anlık katalog kontrolü
  const catalog = await (window as any).loadSapCatalogData();
  const match = catalog.find((c: any) => c.sapNo.toLowerCase() === sap.toLowerCase());

  if (match) {
    item.description = match.description;
    if (descInput) descInput.value = match.description;

    const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
    const whId = whSelect?.value;
    if (whId) {
      const stock = await (window as any).getWarehouseStockForItem(whId, sap);
      item.currentStock = stock;
      if (stockSpan) {
        stockSpan.innerText = stock > 0 ? `${stock} Adet` : '0';
        stockSpan.style.color = stock > 0 ? '#34d399' : '#64748b';
      }
    }
  } else {
    // Eşleşme yoksa (farklı/geçersiz SAP yazılıyorsa) eski otomatik açıklama ve stok sıfırlanır
    item.description = '';
    item.currentStock = 0;
    if (descInput) descInput.value = '';
    if (stockSpan) {
      stockSpan.innerText = '0';
      stockSpan.style.color = '#64748b';
    }
  }
};

(window as any).handleBasketDescInput = (rowId: string, val: string) => {
  const item = newOrderBasket.find(i => i.id === rowId);
  if (!item) return;
  item.description = String(val || '').trim();
};

(window as any).handleBasketRefInput = (rowId: string, val: string) => {
  const item = newOrderBasket.find(i => i.id === rowId);
  if (!item) return;
  item.enerconRef = String(val || '').trim();
};

(window as any).handleBasketQtyInput = (rowId: string, val: string) => {
  const item = newOrderBasket.find(i => i.id === rowId);
  if (!item) return;
  item.quantity = Math.max(1, parseInt(val) || 1);

  const lineTotalSpan = document.querySelector(`[data-linetotal-span="${rowId}"]`) as HTMLElement;
  const lineTotal = (Number(item.price) || 0) * item.quantity;
  if (lineTotalSpan) {
    lineTotalSpan.innerText = lineTotal > 0 ? lineTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-';
  }
  (window as any).updateBasketSummaryCards();
};

(window as any).handleBasketPriceInput = (rowId: string, val: string) => {
  const item = newOrderBasket.find(i => i.id === rowId);
  if (!item) return;
  const p = parsePriceInput(val);
  item.price = p >= 0 ? p : 0;

  const lineTotalSpan = document.querySelector(`[data-linetotal-span="${rowId}"]`) as HTMLElement;
  const lineTotal = (item.price || 0) * (item.quantity || 1);
  if (lineTotalSpan) {
    lineTotalSpan.innerText = lineTotal > 0 ? lineTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €' : '-';
  }
  (window as any).updateBasketSummaryCards();
};

// Add New Empty Row
(window as any).addNewEmptyBasketRow = () => {
  const newRow: NewBasketItem = {
    id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sapNo: '',
    description: '',
    enerconRef: '',
    quantity: 1,
    currentStock: 0,
    unit: 'Adet',
    note: ''
  };
  newOrderBasket.push(newRow);
  (window as any).renderNewOrderItemsTable();
};

// Remove Row
(window as any).removeBasketRow = (rowId: string) => {
  newOrderBasket = newOrderBasket.filter(i => i.id !== rowId);
  (window as any).renderNewOrderItemsTable();
};

// Clear entire basket
(window as any).clearEntireBasket = () => {
  if (newOrderBasket.length === 0) return;
  if (!confirm("Tüm sipariş tablosunu temizlemek istediğinizden emin misiniz?")) return;
  newOrderBasket = [];
  (window as any).renderNewOrderItemsTable();
};

// ═══════════════════════════════════════════════════════
// CATALOG PICKER MODAL (54.000 SAP ITEMS MULTI-SELECT)
// ═══════════════════════════════════════════════════════

(window as any).openCatalogPickerModal = () => {
  selectedCatalogPickerMap.clear();
  const searchInput = document.getElementById('catalog-picker-search-input') as HTMLInputElement;
  if (searchInput) searchInput.value = '';
  (window as any).updateCatalogPickerSelectedCounter();

  const container = document.getElementById('catalog-picker-results-container');
  if (container) {
    container.innerHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: #64748b;">
        <i class="fa-solid fa-search" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
        Aramak istediğiniz SAP numarasını veya malzeme adını yazın.
      </div>
    `;
  }

  const modal = document.getElementById('order-catalog-picker-modal');
  if (modal) modal.classList.add('open');
};

(window as any).closeCatalogPickerModal = () => {
  const modal = document.getElementById('order-catalog-picker-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).updateCatalogPickerSelectedCounter = () => {
  const badge = document.getElementById('catalog-picker-selected-count');
  const btn = document.getElementById('btn-add-catalog-selected');
  const count = selectedCatalogPickerMap.size;
  if (badge) badge.innerText = `${count} Parça Seçildi`;
  if (btn) btn.innerHTML = `<i class="fa-solid fa-cart-plus"></i> SEÇİLENLERİ TABLOYA EKLE (${count})`;
};

(window as any).handleCatalogPickerSearch = async (val: string) => {
  const container = document.getElementById('catalog-picker-results-container');
  if (!container) return;

  const term = (val || '').toLowerCase().trim();
  if (term.length < 2) {
    container.innerHTML = `
      <div style="padding: 3rem 1rem; text-align: center; color: #64748b;">
        <i class="fa-solid fa-search" style="font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; display: block;"></i>
        Aramak istediğiniz SAP numarasını veya malzeme adını yazın.
      </div>
    `;
    return;
  }

  const catalog = await (window as any).loadSapCatalogData();
  const matches = catalog.filter((m: any) => {
    return m.sapNo.toLowerCase().includes(term) || m.description.toLowerCase().includes(term);
  }).slice(0, 40);

  if (matches.length === 0) {
    container.innerHTML = `
      <div style="padding: 2rem 1rem; text-align: center; color: #64748b;">
        Aradığınız kriterlere uygun malzeme bulunamadı.
      </div>
    `;
    return;
  }

  container.innerHTML = matches.map((m: any) => {
    const isChecked = selectedCatalogPickerMap.has(m.sapNo);
    const existingQty = selectedCatalogPickerMap.get(m.sapNo)?.quantity || 1;
    const safeDesc = m.description.replace(/"/g, '&quot;');

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid rgba(255,255,255,0.05); gap: 8px; transition: background 0.15s;" onmouseover="this.style.background='rgba(0, 243, 255, 0.05)'" onmouseout="this.style.background='transparent'">
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
          <input type="checkbox" ${isChecked ? 'checked' : ''} onchange="window.toggleCatalogPickerItem('${m.sapNo}', '${safeDesc}', this.checked, document.getElementById('picker-qty-${m.sapNo}').value)" style="width: 16px; height: 16px; accent-color: #00f3ff; cursor: pointer;">
          <div>
            <div style="font-weight: 700; color: #fff; font-size: 0.82rem;">${m.description}</div>
            <div style="font-family: monospace; color: #00f3ff; font-weight: 800; font-size: 0.75rem;">
              SAP: ${m.sapNo}
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 6px;">
          <label style="font-size: 0.7rem; color: #94a3b8;">Adet:</label>
          <input type="number" min="1" value="${existingQty}" id="picker-qty-${m.sapNo}" onchange="window.toggleCatalogPickerItem('${m.sapNo}', '${safeDesc}', true, this.value)" class="mini-input" style="width: 50px !important; text-align: center; font-weight: 800;">
        </div>
      </div>
    `;
  }).join('');
};

(window as any).toggleCatalogPickerItem = (sapNo: string, description: string, checked: boolean, qtyVal: any) => {
  const qty = Math.max(1, parseInt(qtyVal) || 1);
  if (checked) {
    selectedCatalogPickerMap.set(sapNo, { sapNo, description, quantity: qty });
  } else {
    selectedCatalogPickerMap.delete(sapNo);
  }
  (window as any).updateCatalogPickerSelectedCounter();
};

(window as any).addSelectedCatalogItemsToBasket = async () => {
  if (selectedCatalogPickerMap.size === 0) {
    alert("Lütfen listeden en az bir malzeme seçiniz.");
    return;
  }

  const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
  const whId = whSelect?.value;

  for (const [sapNo, item] of selectedCatalogPickerMap.entries()) {
    const existing = newOrderBasket.find(b => b.sapNo === sapNo);
    if (existing) {
      existing.quantity += item.quantity;
    } else {
      let currentStock = 0;
      if (whId) {
        currentStock = await (window as any).getWarehouseStockForItem(whId, sapNo);
      }
      newOrderBasket.push({
        id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sapNo: item.sapNo,
        description: item.description,
        enerconRef: '',
        quantity: item.quantity,
        currentStock,
        unit: 'Adet',
        note: ''
      });
    }
  }

  (window as any).closeCatalogPickerModal();
  (window as any).renderNewOrderItemsTable();
};

// ═══════════════════════════════════════════════════════
// EXCEL TEMPLATE DOWNLOAD & DIRECT FILE UPLOAD
// ═══════════════════════════════════════════════════════

(window as any).downloadOrderExcelTemplate = () => {
  const wsData = [
    ["SAP No", "Malzeme Tanımı", "Enercon Ref", "Miktar", "Birim Fiyat (€)"],
    ["23650", "sensor ERST58/66/7018 KTY81-110 EXX", "D0248810", 2, 16.74],
    ["45122", "radial shaft seal 65x90x10 BA/FPM", "", 12, 12.60],
    ["49813", "patch cable dx st-st I-VHH G50/125µm 10m", "", 2, 62.26],
    ["55734", "pulsor 10-30VDC M12 flush 10m cable", "", 5, 26.86],
    ["64344", "contactor power- 3RT1476-6AP36-0AE0", "", 2, 649.32]
  ];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  ws['!cols'] = [
    { wch: 14 }, // SAP No
    { wch: 45 }, // Malzeme Tanımı
    { wch: 18 }, // Enercon Ref
    { wch: 10 }, // Miktar
    { wch: 16 }  // Birim Fiyat (€)
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siparis_Sablonu");
  XLSX.writeFile(wb, "Siparis_Kalemleri_Sablonu.xlsx");
};

(window as any).handleOrderExcelFileUpload = async (event: Event) => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  const catalog = await (window as any).loadSapCatalogData();
  const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
  const whId = whSelect?.value;

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      if (!jsonRows || jsonRows.length === 0) {
        alert("Seçilen Excel dosyasında veri satırı bulunamadı!");
        return;
      }

      let addedCount = 0;
      for (const row of jsonRows) {
        const keys = Object.keys(row);
        const findVal = (patterns: string[]) => {
          const matchedKey = keys.find(k => patterns.some(p => k.toLowerCase().trim().includes(p.toLowerCase())));
          return matchedKey !== undefined ? String(row[matchedKey]).trim() : '';
        };

        const sap = findVal(['sap', 'material no', 'material']);
        let desc = findVal(['tanım', 'tanim', 'açıklama', 'aciklama', 'description', 'malzeme']);
        const ref = findVal(['ref', 'enercon', 'parça kodu']);
        const qtyRaw = findVal(['miktar', 'adet', 'qty', 'quantity']);
        const priceRaw = findVal(['fiyat', 'price', 'birim', 'tutar', 'cost']);

        const qty = parseInt(qtyRaw) || 1;
        let price = parseFloat(priceRaw.replace(',', '.'));
        if (isNaN(price)) price = 0;

        // Auto lookup from 54.000 SAP catalog if description or price is missing
        if (sap) {
          const match = catalog.find((c: any) => c.sapNo.toLowerCase() === sap.toLowerCase());
          if (match) {
            if (!desc) desc = match.description;
            if (price === 0 && match.price) price = match.price;
          }
        }

        if (!desc && !sap) continue;

        let currentStock = 0;
        if (whId && sap) {
          currentStock = await (window as any).getWarehouseStockForItem(whId, sap);
        }

        newOrderBasket.push({
          id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sapNo: sap || '',
          description: desc || (sap ? `SAP: ${sap}` : 'Malzeme'),
          enerconRef: ref || '',
          quantity: qty > 0 ? qty : 1,
          price: price > 0 ? price : 0,
          currentStock,
          unit: 'Adet',
          note: ''
        });
        addedCount++;
      }

      if (addedCount > 0) {
        (window as any).renderNewOrderItemsTable();
        alert(`✅ ${addedCount} adet sipariş kalemi Excel'den başarıyla yüklendi!`);
      } else {
        alert("Excel dosyasında geçerli malzeme satırı bulunamadı. Lütfen 'Şablon İndir' butonundaki formatı kullanınız.");
      }
    } catch (err) {
      console.error("Excel file upload error:", err);
      alert("Excel dosyası okunurken bir hata oluştu: " + err);
    } finally {
      input.value = '';
    }
  };

  reader.readAsArrayBuffer(file);
};

// ═══════════════════════════════════════════════════════
// EXCEL PASTE MODAL (FAST TABULAR IMPORT)
// ═══════════════════════════════════════════════════════

(window as any).openExcelPasteModal = () => {
  parsedExcelRows = [];
  const textarea = document.getElementById('excel-paste-textarea') as HTMLTextAreaElement;
  if (textarea) textarea.value = '';
  const preview = document.getElementById('excel-paste-preview');
  if (preview) {
    preview.innerHTML = '';
    preview.style.display = 'none';
  }
  const btn = document.getElementById('btn-apply-excel-paste') as HTMLButtonElement;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-file-import"></i> TABLOYA AKTAR (0 KALEM)';
  }

  const modal = document.getElementById('order-excel-paste-modal');
  if (modal) modal.classList.add('open');
};

(window as any).closeExcelPasteModal = () => {
  const modal = document.getElementById('order-excel-paste-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).previewExcelPasteData = async (rawText: string) => {
  const preview = document.getElementById('excel-paste-preview');
  const btn = document.getElementById('btn-apply-excel-paste') as HTMLButtonElement;
  if (!preview || !btn) return;

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) {
    preview.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-file-import"></i> TABLOYA AKTAR (0 KALEM)';
    parsedExcelRows = [];
    return;
  }

  const catalog = await (window as any).loadSapCatalogData();
  parsedExcelRows = [];

  for (const line of lines) {
    // split by Tab or semicolon or comma
    const cols = line.includes('\t') 
      ? line.split('\t').map(c => c.trim()) 
      : (line.includes(';') ? line.split(';').map(c => c.trim()) : line.split(',').map(c => c.trim()));

    if (cols.length === 0) continue;

    let sapNo = '';
    let desc = '';
    let qty = 1;
    let price: number | undefined = undefined;

    if (cols.length === 1) {
      sapNo = cols[0];
    } else if (cols.length === 2) {
      // either [SAP, QTY] or [SAP, DESC]
      if (!isNaN(Number(cols[1]))) {
        sapNo = cols[0];
        qty = Math.max(1, Number(cols[1]));
      } else {
        sapNo = cols[0];
        desc = cols[1];
      }
    } else if (cols.length >= 3) {
      sapNo = cols[0];
      desc = cols[1];
      qty = Math.max(1, Number(cols[2]) || 1);
      if (cols[3] && !isNaN(parseFloat(cols[3].replace(',', '.')))) {
        price = parseFloat(cols[3].replace(',', '.'));
      }
    }

    if (sapNo && !desc) {
      const match = catalog.find((c: any) => c.sapNo.toLowerCase() === sapNo.toLowerCase());
      if (match) desc = match.description;
      else desc = `SAP: ${sapNo}`;
    }

    if (sapNo || desc) {
      parsedExcelRows.push({ sapNo, description: desc, quantity: qty, price });
    }
  }

  if (parsedExcelRows.length === 0) {
    preview.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-file-import"></i> TABLOYA AKTAR (0 KALEM)';
    return;
  }

  preview.style.display = 'block';
  btn.disabled = false;
  btn.innerHTML = `<i class="fa-solid fa-file-import"></i> TABLOYA AKTAR (${parsedExcelRows.length} KALEM)`;

  preview.innerHTML = `
    <div style="font-size: 0.74rem; font-weight: 800; color: #34d399; margin-bottom: 4px;">
      <i class="fa-solid fa-check"></i> ${parsedExcelRows.length} Satır Algılandı (Önizleme):
    </div>
    <table class="orders-table" style="font-size: 0.72rem; margin: 0;">
      <thead>
        <tr>
          <th>SAP NO</th>
          <th>MALZEME TANIMI</th>
          <th style="text-align: center;">ADET</th>
          <th style="text-align: right;">BİRİM FİYAT</th>
        </tr>
      </thead>
      <tbody>
        ${parsedExcelRows.slice(0, 10).map(r => `
          <tr>
            <td style="font-family: monospace; color: #00f3ff; font-weight: 700;">${r.sapNo || '-'}</td>
            <td style="color: #fff;">${r.description}</td>
            <td style="text-align: center; font-weight: 800; color: #34d399;">${r.quantity}</td>
            <td style="text-align: right; color: #38bdf8;">${r.price ? r.price.toFixed(2) + ' €' : '-'}</td>
          </tr>
        `).join('')}
        ${parsedExcelRows.length > 10 ? `<tr><td colspan="4" style="text-align: center; color: #94a3b8; font-style: italic;">...ve ${parsedExcelRows.length - 10} satır daha</td></tr>` : ''}
      </tbody>
    </table>
  `;
};

(window as any).applyExcelPasteData = async () => {
  if (parsedExcelRows.length === 0) return;

  const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
  const whId = whSelect?.value;

  for (const item of parsedExcelRows) {
    let currentStock = 0;
    if (whId && item.sapNo) {
      currentStock = await (window as any).getWarehouseStockForItem(whId, item.sapNo);
    }

    newOrderBasket.push({
      id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      sapNo: item.sapNo,
      description: item.description,
      enerconRef: '',
      quantity: item.quantity,
      price: item.price,
      currentStock,
      unit: 'Adet',
      note: ''
    });
  }

  (window as any).closeExcelPasteModal();
  (window as any).renderNewOrderItemsTable();
};

// ═══════════════════════════════════════════════════════
// MANUAL NON-SAP MODAL
// ═══════════════════════════════════════════════════════

(window as any).openManualItemModal = () => {
  const modal = document.getElementById('manual-item-modal');
  if (modal) modal.classList.add('open');
};

(window as any).closeManualItemModal = () => {
  const modal = document.getElementById('manual-item-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).handleManualItemSubmit = (e: Event) => {
  e.preventDefault();
  const desc = (document.getElementById('manual-item-desc') as HTMLInputElement)?.value?.trim();
  const enercon = (document.getElementById('manual-item-enercon') as HTMLInputElement)?.value?.trim();
  const qty = Number((document.getElementById('manual-item-qty') as HTMLInputElement)?.value) || 1;
  const price = parsePriceInput((document.getElementById('manual-item-price') as HTMLInputElement)?.value);
  const note = (document.getElementById('manual-item-note') as HTMLInputElement)?.value?.trim();

  if (!desc) {
    alert("Lütfen malzeme tanımını giriniz.");
    return;
  }

  newOrderBasket.push({
    id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    sapNo: '',
    description: desc,
    enerconRef: enercon || '',
    quantity: Math.max(1, qty),
    price: price > 0 ? price : undefined,
    currentStock: 0,
    unit: 'Adet',
    note: note || ''
  });

  (window as any).closeManualItemModal();
  (document.getElementById('manual-item-form') as HTMLFormElement)?.reset();
  (window as any).renderNewOrderItemsTable();
};

// ═══════════════════════════════════════════════════════
// APPROVED FIELD DEMANDS POOL (SAHA TALEPLERİ HAVUZU)
// ═══════════════════════════════════════════════════════

(window as any).updateApprovedDemandsButtonCount = async () => {
  try {
    const demands = await materialDemandService.getDemands();
    const approved = demands.filter(d => d.status === 'APPROVED_FOR_ORDER');
    const countStr = String(approved.length);

    const badge = document.getElementById('btn-approved-demands-count');
    if (badge) badge.innerText = countStr;

    const mainBadge = document.getElementById('main-approved-demands-count');
    if (mainBadge) mainBadge.innerText = countStr;

    const bannerCount = document.getElementById('banner-approved-demands-count');
    if (bannerCount) bannerCount.innerText = countStr;

    const banner = document.getElementById('approved-demands-alert-banner');
    if (banner) {
      banner.style.display = approved.length > 0 ? 'flex' : 'none';
    }
  } catch (e) {
    console.warn("Error updating approved demands count:", e);
  }
};

(window as any).openApprovedDemandsModal = async () => {
  const modal = document.getElementById('approved-demands-modal');
  const listContainer = document.getElementById('approved-demands-modal-list');
  if (modal) modal.classList.add('open');

  if (listContainer) {
    listContainer.innerHTML = `
      <div style="text-align: center; padding: 2rem; color: #94a3b8;">
        <i class="fa-solid fa-spinner fa-spin" style="font-size: 1.5rem; color: #00f3ff; margin-bottom: 8px;"></i>
        <div>Ön onaylı talepler yükleniyor...</div>
      </div>
    `;
    try {
      const demands = await materialDemandService.getDemands();
      const approved = demands.filter(d => d.status === 'APPROVED_FOR_ORDER');

      const badge = document.getElementById('btn-approved-demands-count');
      if (badge) badge.innerText = String(approved.length);

      if (approved.length === 0) {
        listContainer.innerHTML = `
          <div class="cyber-card" style="text-align: center; padding: 2rem; color: #94a3b8;">
            <i class="fa-solid fa-circle-check" style="font-size: 2rem; color: #34d399; margin-bottom: 8px;"></i>
            <h4 style="color: #fff; margin: 0 0 4px 0;">Bekleyen Onaylı Talep Yok</h4>
            <p style="font-size: 0.8rem; margin: 0;">Şu anda siparişe aktarılmayı bekleyen ön onaylı saha talebi bulunmamaktadır.</p>
          </div>
        `;
        return;
      }

      listContainer.innerHTML = `
        <!-- Multi-Select Bulk Action Toolbar -->
        <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(0, 243, 255, 0.25); border-radius: 8px; padding: 10px 14px; margin-bottom: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #cbd5e1; font-size: 0.84rem; font-weight: 700; user-select: none;">
            <input type="checkbox" id="select-all-approved-demands" onchange="window.handleSelectAllApprovedDemands(this.checked)" style="width: 18px; height: 18px; cursor: pointer; accent-color: #00f3ff;">
            <span>Tümünü Seç (<span id="selected-demands-count" style="color: #00f3ff;">0</span> / <span id="total-approved-demands-count">${approved.length}</span>)</span>
          </label>
          <button type="button" id="btn-bulk-import-demands" onclick="window.bulkImportSelectedApprovedDemands()" class="cyber-btn cyber-btn-emerald" style="display: none; font-size: 0.82rem; font-weight: 800; padding: 6px 18px; box-shadow: 0 0 15px rgba(52, 211, 153, 0.4);">
            <i class="fa-solid fa-cart-arrow-down"></i> <span id="bulk-import-btn-text">SEÇİLENLERİ BİRLEŞTİR VE SEPETE AKTAR</span>
          </button>
        </div>

        ${approved.map(d => {
          const isConsumable = d.demandCategory === 'CONSUMABLE';
          return `
          <div class="cyber-card" style="margin-bottom: 0.75rem; padding: 0.85rem 1rem; border-color: ${isConsumable ? 'rgba(245, 158, 11, 0.35)' : 'rgba(52, 211, 153, 0.3)'};">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; margin-bottom: 0.5rem;">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <input type="checkbox" class="approved-demand-checkbox" value="${d.id}" onchange="window.updateBulkImportButtonState()" style="width: 18px; height: 18px; cursor: pointer; accent-color: #00f3ff; margin-right: 4px;">
                <strong style="color: #00f3ff; font-family: monospace; font-size: 0.95rem;">[ ${d.title} ]</strong>
                <span style="background: ${isConsumable ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0, 243, 255, 0.15)'}; color: ${isConsumable ? '#fbbf24' : '#00f3ff'}; border: 1px solid ${isConsumable ? 'rgba(245, 158, 11, 0.3)' : 'rgba(0, 243, 255, 0.3)'}; padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
                  <i class="fa-solid ${isConsumable ? 'fa-boxes-packing' : 'fa-bolt'}"></i> ${isConsumable ? 'SARF / PİYASA' : 'TÜRBİN PARÇASI'}
                </span>
                <span style="color: #94a3b8; font-size: 0.76rem;">
                  <i class="fa-solid fa-location-dot" style="color: #34d399;"></i> ${d.siteName} ${d.turbineId ? `(${d.turbineId})` : ''}
                </span>
              </div>
              <button type="button" onclick="window.importApprovedDemandToBasket('${d.id}')" class="cyber-btn ${isConsumable ? 'cyber-btn-secondary' : 'cyber-btn-emerald'}" style="font-size: 0.75rem; font-weight: 800; padding: 3px 12px; height: 26px; ${isConsumable ? 'border-color: #f59e0b; color: #fbbf24;' : ''}">
                <i class="fa-solid fa-cart-plus"></i> ${isConsumable ? 'PİYASA SEPETİNE AKTAR' : 'ENERCON SEPETİNE AKTAR'}
              </button>
            </div>

            <div style="font-size: 0.76rem; color: #94a3b8; margin-bottom: 0.5rem;">
              <span><i class="fa-solid fa-user"></i> ${d.requesterName}</span>
              <span style="margin-left: 10px;"><i class="fa-solid fa-calendar"></i> ${d.createdAt.split('T')[0]}</span>
              ${d.generalNote ? `<span style="margin-left: 10px; color: #fbbf24;"><i class="fa-regular fa-comment"></i> ${d.generalNote}</span>` : ''}
            </div>

            <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 6px; padding: 4px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 0.78rem;">
                <thead>
                  <tr style="color: #64748b; text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06);">
                    ${!isConsumable ? '<th style="padding: 4px 6px;">SAP NO</th>' : ''}
                    <th style="padding: 4px 6px;">MALZEME TANIMI</th>
                    <th style="padding: 4px 6px; text-align: center;">MİKTAR</th>
                    <th style="padding: 4px 6px;">YÖNETİCİ TALİMATI / NOTU</th>
                  </tr>
                </thead>
                <tbody>
                  ${(d.items || []).filter(i => (i.itemDecision === 'APPROVE_PURCHASE' || !i.itemDecision) && (i.approvedQuantity === undefined || i.approvedQuantity > 0)).map(i => `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                      ${!isConsumable ? `<td style="padding: 4px 6px; font-family: monospace; color: #00f3ff; font-weight: 700;">${i.sapNo || '-'}</td>` : ''}
                      <td style="padding: 4px 6px; color: #fff;">${i.description}</td>
                      <td style="padding: 4px 6px; text-align: center; color: #34d399; font-weight: 800;">${i.approvedQuantity !== undefined ? i.approvedQuantity : i.quantity} ${i.unit || 'Adet'}</td>
                      <td style="padding: 4px 6px; color: #38bdf8;">${i.managerItemNote ? `[Yönetici: ${i.managerItemNote}]` : (i.reason || '-')}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
          `;
        }).join('')}
      `;

    } catch (err) {
      listContainer.innerHTML = `<div style="color: #ef4444; padding: 1rem; text-align: center;">Talepler yüklenirken hata oluştu: ${err}</div>`;
    }
  }
};

(window as any).updateBulkImportButtonState = () => {
  const checkboxes = Array.from(document.querySelectorAll('.approved-demand-checkbox')) as HTMLInputElement[];
  const checked = checkboxes.filter(cb => cb.checked);
  const countEl = document.getElementById('selected-demands-count');
  if (countEl) countEl.innerText = String(checked.length);

  const selectAllCb = document.getElementById('select-all-approved-demands') as HTMLInputElement;
  if (selectAllCb) {
    selectAllCb.checked = checked.length > 0 && checked.length === checkboxes.length;
    selectAllCb.indeterminate = checked.length > 0 && checked.length < checkboxes.length;
  }

  const bulkBtn = document.getElementById('btn-bulk-import-demands');
  const bulkBtnText = document.getElementById('bulk-import-btn-text');
  if (bulkBtn) {
    if (checked.length > 0) {
      bulkBtn.style.display = 'inline-flex';
      if (bulkBtnText) bulkBtnText.innerText = `SEÇİLEN ${checked.length} TALEBİ BİRLEŞTİR VE SEPETE AKTAR`;
    } else {
      bulkBtn.style.display = 'none';
    }
  }
};

(window as any).handleSelectAllApprovedDemands = (checked: boolean) => {
  document.querySelectorAll('.approved-demand-checkbox').forEach((cb: any) => {
    cb.checked = checked;
  });
  (window as any).updateBulkImportButtonState();
};

(window as any).bulkImportSelectedApprovedDemands = async () => {
  const selectedCheckboxes = Array.from(document.querySelectorAll('.approved-demand-checkbox:checked')) as HTMLInputElement[];
  if (selectedCheckboxes.length === 0) {
    alert("Lütfen birleştirmek istediğiniz en az bir talebi seçiniz!");
    return;
  }
  const selectedIds = selectedCheckboxes.map(cb => cb.value);

  try {
    const demands = await materialDemandService.getDemands();
    const targetDemands = demands.filter(d => selectedIds.includes(d.id));
    if (targetDemands.length === 0) {
      alert("Seçilen talepler bulunamadı!");
      return;
    }

    linkedDemandIds = targetDemands.map(d => d.id);

    // Set supplier type (if all consumable -> MARKET, else ENERCON)
    const hasTurbine = targetDemands.some(d => d.demandCategory !== 'CONSUMABLE');
    const supplierTypeSelect = document.getElementById('new-order-supplier-type') as HTMLSelectElement;
    if (supplierTypeSelect) {
      supplierTypeSelect.value = hasTurbine ? 'ENERCON' : 'MARKET';
      (window as any).handleSupplierTypeChange?.(supplierTypeSelect.value);
    }

    // Set warehouse dropdown if all match same site
    const firstSiteId = targetDemands[0].siteId;
    const allSameSite = targetDemands.every(d => d.siteId === firstSiteId);
    const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
    if (whSelect && allSameSite && firstSiteId) {
      whSelect.value = firstSiteId;
    }

    // Set order general note summarizing merged demands
    const generalNoteInput = document.getElementById('order-general-note') as HTMLInputElement;
    if (generalNoteInput) {
      const demandTitles = targetDemands.map(d => `[${d.title}] ${d.siteName}`).join(' + ');
      generalNoteInput.value = `Birleştirilmiş Talep: ${demandTitles}`;
    }

    let totalItemsAdded = 0;
    for (const demand of targetDemands) {
      for (const item of (demand.items || [])) {
        if (item.itemDecision && item.itemDecision !== 'APPROVE_PURCHASE') continue;
        const finalQty = (item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity);
        if (finalQty <= 0) continue;

        const combinedNote = [
          `[${demand.siteName} - ${demand.title}]`,
          item.managerItemNote ? `[YÖNETİCİ: ${item.managerItemNote}]` : '',
          item.reason ? `[Gerekçe: ${item.reason}]` : ''
        ].filter(Boolean).join(' ');

        newOrderBasket.push({
          id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          sapNo: item.sapNo || '',
          description: item.description,
          enerconRef: item.enerconRef || '',
          quantity: finalQty,
          currentStock: 0,
          unit: item.unit || 'Adet',
          note: combinedNote
        });
        totalItemsAdded++;
      }
    }

    (window as any).closeApprovedDemandsModal();
    (window as any).switchOrderView('create');
    (window as any).renderNewOrderItemsTable();
    alert(`Seçilen ${targetDemands.length} adet saha talebindeki toplam ${totalItemsAdded} kalem malzeme başarıyla birleştirildi ve sipariş sepetine aktarıldı!`);
  } catch (err) {
    console.error("Bulk import error:", err);
    alert("Talepler birleştirilirken hata oluştu: " + err);
  }
};

(window as any).closeApprovedDemandsModal = () => {
  const modal = document.getElementById('approved-demands-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).importApprovedDemandToBasket = async (demandId: string) => {
  try {
    const demands = await materialDemandService.getDemands();
    const demand = demands.find(d => d.id === demandId);
    if (!demand) {
      alert("Talep bulunamadı!");
      return;
    }

    linkedDemandIds = [demand.id];

    // Set supplier type based on category
    const supplierTypeSelect = document.getElementById('new-order-supplier-type') as HTMLSelectElement;
    if (supplierTypeSelect) {
      supplierTypeSelect.value = demand.demandCategory === 'CONSUMABLE' ? 'MARKET' : 'ENERCON';
      (window as any).handleSupplierTypeChange?.(supplierTypeSelect.value);
    }

    // Set warehouse dropdown if matches
    const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
    if (whSelect && demand.siteId) {
      whSelect.value = demand.siteId;
    }

    // Set order general note
    const generalNoteInput = document.getElementById('order-general-note') as HTMLInputElement;
    if (generalNoteInput) {
      generalNoteInput.value = `[${demand.title}] ${demand.siteName} ${demand.turbineId ? `(${demand.turbineId})` : ''} - ${demand.generalNote || ''}`.trim();
    }

    // Append items to basket (only items approved for purchase)
    for (const item of (demand.items || [])) {
      if (item.itemDecision && item.itemDecision !== 'APPROVE_PURCHASE') continue;
      const finalQty = (item.approvedQuantity !== undefined ? item.approvedQuantity : item.quantity);
      if (finalQty <= 0) continue; // If 0 (e.g. transferred), skip purchase line!

      const combinedNote = [
        item.managerItemNote ? `[YÖNETİCİ: ${item.managerItemNote}]` : '',
        item.reason ? `[Gerekçe: ${item.reason}]` : ''
      ].filter(Boolean).join(' ');

      newOrderBasket.push({
        id: `ROW_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        sapNo: item.sapNo || '',
        description: item.description,
        enerconRef: item.enerconRef || '',
        quantity: finalQty,
        currentStock: 0,
        unit: item.unit || 'Adet',
        note: combinedNote
      });
    }

    (window as any).closeApprovedDemandsModal();
    (window as any).switchOrderView('create');
    (window as any).renderNewOrderItemsTable();
    alert(`"${demand.title}" talebindeki ${(demand.items || []).filter(i => (i.itemDecision === 'APPROVE_PURCHASE' || !i.itemDecision) && (i.approvedQuantity === undefined || i.approvedQuantity > 0)).length} kalem malzeme ${demand.demandCategory === 'CONSUMABLE' ? 'Piyasa' : 'Enercon'} sipariş sepetine aktarıldı!`);
  } catch (err) {
    alert("Siparişe aktarılırken hata oluştu: " + err);
  }
};

// ═══════════════════════════════════════════════════════
// SUPPLIER TYPE & SUBMIT ORDER FORM
// ═══════════════════════════════════════════════════════

(window as any).handleSupplierTypeChange = (val: string) => {
  const enerconBox = document.getElementById('group-enercon-order-no');
  const vendorNameBox = document.getElementById('group-market-vendor-name');
  const marketNoBox = document.getElementById('group-market-order-no');
  if (val === 'ENERCON') {
    if (enerconBox) enerconBox.style.display = 'block';
    if (vendorNameBox) vendorNameBox.style.display = 'none';
    if (marketNoBox) marketNoBox.style.display = 'none';
  } else {
    if (enerconBox) enerconBox.style.display = 'none';
    if (vendorNameBox) vendorNameBox.style.display = 'block';
    if (marketNoBox) marketNoBox.style.display = 'block';
  }
};

(window as any).submitOrderForm = async () => {
  const supplierType = (document.getElementById('new-order-supplier-type') as HTMLSelectElement)?.value || 'ENERCON';
  let finalOrderNo = '';
  let vendorName = '';

  if (supplierType === 'ENERCON') {
    const rawEnercon = (document.getElementById('new-order-enercon-no') as HTMLInputElement)?.value?.trim() || '';
    finalOrderNo = rawEnercon || `ENR-${Math.floor(10000000 + Math.random() * 90000000)}`;
  } else {
    vendorName = (document.getElementById('new-order-vendor-name') as HTMLInputElement)?.value?.trim() || '';
    const marketNo = (document.getElementById('new-order-market-no') as HTMLInputElement)?.value?.trim() || '';
    if (!vendorName) {
      alert("Lütfen tedarikçi / şirket adını giriniz!");
      return;
    }
    finalOrderNo = marketNo || (vendorName ? `${vendorName.substring(0, 4).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}` : `PIYASA-${Math.floor(1000 + Math.random() * 9000)}`);
  }

  const whSelect = document.getElementById('new-order-warehouse-select') as HTMLSelectElement;
  const whId = whSelect?.value;
  const whName = whSelect?.selectedOptions[0]?.dataset.name || whSelect?.selectedOptions[0]?.text || '';
  const orderType = (document.getElementById('new-order-type-select') as HTMLSelectElement)?.value || 'ENERCON_STANDART';
  const orderDate = (document.getElementById('new-order-date') as HTMLInputElement)?.value || '';
  const generalNote = (document.getElementById('order-general-note') as HTMLInputElement)?.value?.trim() || '';

  if (!whId) {
    alert("Lütfen siparişin verileceği Santral / Hedef Depoyu seçiniz!");
    return;
  }

  if (newOrderBasket.length === 0) {
    alert("Sipariş tablosu boş! Lütfen en az bir malzeme kalemi ekleyin.");
    return;
  }

  // Validate items
  const validItems = newOrderBasket.filter(i => (i.description || i.sapNo) && i.quantity > 0);
  if (validItems.length === 0) {
    alert("Lütfen eklediğiniz satırların malzeme tanımını veya SAP numarasını doldurunuz.");
    return;
  }

  const btn = document.getElementById('btn-submit-order') as HTMLButtonElement;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> SİPARİŞ OLUŞTURULUYOR...';
    btn.disabled = true;
  }

  try {
    const currentUser = (window as any).currentUser || authService.getCurrentUser();
    const requester = currentUser?.email || 'Yetkili';
    const requesterName = currentUser?.displayName || currentUser?.email || 'Malzeme Yetkilisi';

    const fullNote = [
      supplierType === 'MARKET' ? `[TEDARİKÇİ: ${vendorName}]` : '[ENERCON]',
      orderType === 'ACIL_ARIZA' ? '[ACİL ARIZA TALEBİ]' : (orderType === 'PERIYODIK_BAKIM' ? '[PERİYODİK BAKIM]' : ''),
      orderDate ? `Talep Tarihi: ${orderDate}` : '',
      generalNote
    ].filter(Boolean).join(' - ');

    const quotedLogistics = parsePriceInput((document.getElementById('new-order-quoted-logistics') as HTMLInputElement)?.value);

    const createRes = await orderService.createPurchaseRequest(
      whId,
      whName,
      validItems.map(i => ({
        sapNo: i.sapNo || '',
        description: i.description || (i.sapNo ? `SAP: ${i.sapNo}` : 'Malzeme'),
        enerconRef: i.enerconRef || '',
        quantity: Number(i.quantity) || 1,
        price: (i.price !== undefined && !isNaN(Number(i.price))) ? Number(i.price) : 0,
        note: i.note || '',
        unit: i.unit || 'Adet'
      })),
      requester,
      requesterName,
      '',
      fullNote,
      whName,
      finalOrderNo,
      quotedLogistics
    );

    if (linkedDemandIds && linkedDemandIds.length > 0) {
      try {
        for (const dId of linkedDemandIds) {
          await materialDemandService.linkDemandToOrder(
            dId,
            createRes.id,
            finalOrderNo || createRes.id,
            orderDate || new Date().toISOString().split('T')[0]
          );
        }
      } catch (linkErr) {
        console.warn("Link demands error:", linkErr);
      }
      linkedDemandIds = [];
    }

    newOrderBasket = [];
    (window as any).renderNewOrderItemsTable();
    const enerconNoInput = document.getElementById('new-order-enercon-no') as HTMLInputElement;
    if (enerconNoInput) enerconNoInput.value = '';
    const vendorNameInput = document.getElementById('new-order-vendor-name') as HTMLInputElement;
    if (vendorNameInput) vendorNameInput.value = '';
    const marketNoInput = document.getElementById('new-order-market-no') as HTMLInputElement;
    if (marketNoInput) marketNoInput.value = '';
    const quotedLogisticsInput = document.getElementById('new-order-quoted-logistics') as HTMLInputElement;
    if (quotedLogisticsInput) quotedLogisticsInput.value = '';
    const generalNoteInput = document.getElementById('order-general-note') as HTMLInputElement;
    if (generalNoteInput) generalNoteInput.value = '';
    alert("Sipariş başarıyla oluşturuldu ve yayınlandı!");
    (window as any).switchOrderView('dashboard');
  } catch (err) {
    console.error("Order submit error", err);
    alert("Sipariş oluşturulurken hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

// Toggle Damage/Return Subpanel for item in Delivery Modal
(window as any).toggleDamagePanel = (itemId: string) => {
  const panel = document.getElementById(`damage-panel-${itemId}`);
  const btn = document.getElementById(`btn-toggle-damage-${itemId}`);
  if (panel) {
    const isHidden = panel.style.display === 'none' || !panel.style.display;
    panel.style.display = isHidden ? 'flex' : 'none';
    if (btn) {
      btn.style.background = isHidden ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.15)';
    }
  }
};

// Switch Subtabs inside Order Detail Modal
(window as any).switchModalSubtab = (tabName: string) => {
  const tabs = ['delivery', 'items', 'history', 'damage', 'edit'];
  tabs.forEach(t => {
    const btn = document.getElementById(`modal-tab-btn-${t}`);
    const view = document.getElementById(`modal-subtab-${t}`);
    if (btn) btn.classList.toggle('active', t === tabName);
    if (view) view.style.display = t === tabName ? 'block' : 'none';
  });
};

// Live filter for items in partial delivery modal
(window as any).filterDeliveryModalItems = (term: string) => {
  const q = (term || '').toLowerCase().trim();
  const rows = document.querySelectorAll('.delivery-item-row');
  rows.forEach((row: any) => {
    const sap = (row.dataset.sap || '').toLowerCase();
    const desc = (row.dataset.desc || '').toLowerCase();
    if (!q || sap.includes(q) || desc.includes(q)) {
      row.style.display = 'flex';
    } else {
      row.style.display = 'none';
    }
  });
};

const deliveryDrafts: Record<string, {
  dnNo?: string;
  invoiceNo?: string;
  stockDate?: string;
  items?: Record<string, { qty?: string; shelf?: string; damageQty?: string; reason?: string; action?: string }>;
}> = {};

(window as any).saveDeliveryModalDraft = () => {
  if (!activeDetailOrderId) return;
  const dnNo = (document.getElementById('delivery-note-no') as HTMLInputElement)?.value || '';
  const invoiceNo = (document.getElementById('delivery-invoice-no') as HTMLInputElement)?.value || '';
  const stockDate = (document.getElementById('delivery-stock-entry-date') as HTMLInputElement)?.value || '';

  const items: Record<string, any> = {};
  document.querySelectorAll<HTMLInputElement>('.delivery-qty-input').forEach(input => {
    const itemId = input.dataset.itemId;
    if (!itemId) return;
    const shelfInput = document.querySelector(`.delivery-shelf-input[data-shelf-item-id="${itemId}"]`) as HTMLInputElement;
    const damageQtyInput = document.getElementById(`damage-qty-${itemId}`) as HTMLInputElement;
    const damageReasonInput = document.getElementById(`damage-reason-${itemId}`) as HTMLInputElement;
    const damageActionSelect = document.getElementById(`damage-action-${itemId}`) as HTMLSelectElement;

    items[itemId] = {
      qty: input.value,
      shelf: shelfInput?.value || '',
      damageQty: damageQtyInput?.value || '',
      reason: damageReasonInput?.value || '',
      action: damageActionSelect?.value || 'RETURNED'
    };
  });

  deliveryDrafts[activeDetailOrderId] = { dnNo, invoiceNo, stockDate, items };
};

(window as any).fillAllDeliveryQuantities = () => {
  document.querySelectorAll<HTMLInputElement>('.delivery-qty-input').forEach(input => {
    const max = input.getAttribute('max');
    if (max) {
      input.value = max;
    }
  });
  (window as any).saveDeliveryModalDraft();
};

(window as any).clearAllDeliveryQuantities = () => {
  document.querySelectorAll<HTMLInputElement>('.delivery-qty-input').forEach(input => {
    input.value = '';
  });
  (window as any).saveDeliveryModalDraft();
};

// Order Detail & Partial Delivery Modal Operations
(window as any).viewOrderDetail = (orderId: string) => {
  activeDetailOrderId = orderId;
  const order = allOrdersList.find(o => o.id === orderId);
  if (!order) return;

  (window as any).switchModalSubtab('delivery');

  const modal = document.getElementById('order-detail-modal');
  const noEl = document.getElementById('detail-order-no');
  const statusEl = document.getElementById('detail-order-status');
  const whEl = document.getElementById('detail-order-wh');
  const dateEl = document.getElementById('detail-order-date');
  const reqEl = document.getElementById('detail-order-requester');
  const noteCont = document.getElementById('detail-order-note-container');
  const itemsTbody = document.getElementById('detail-items-tbody');
  const deliveryInputs = document.getElementById('delivery-items-inputs');
  const targetWhName = document.getElementById('delivery-target-wh-name');
  const historyCont = document.getElementById('detail-deliveries-history');
  const damageCont = document.getElementById('detail-damage-history');
  const editContainer = document.getElementById('order-edit-items-container');
  const editNote = document.getElementById('order-edit-note') as HTMLTextAreaElement;

  const dnInput = document.getElementById('delivery-note-no') as HTMLInputElement;
  const invInput = document.getElementById('delivery-invoice-no') as HTMLInputElement;
  const stockInput = document.getElementById('delivery-stock-entry-date') as HTMLInputElement;
  const filterInput = document.getElementById('delivery-items-filter') as HTMLInputElement;
  const today = new Date().toISOString().split('T')[0];

  if (dnInput) dnInput.value = '';
  if (invInput) invInput.value = '';
  if (stockInput) stockInput.value = today;
  if (filterInput) filterInput.value = '';

  if (noEl) noEl.innerText = order.orderNo || 'SIP-2026';
  if (whEl) whEl.innerText = order.warehouseName;
  if (targetWhName) targetWhName.innerText = order.warehouseName;
  if (reqEl) reqEl.innerText = order.requesterName || order.requester;
  if (dateEl) {
    dateEl.innerText = order.timestamp?.toDate 
      ? order.timestamp.toDate().toLocaleDateString('tr-TR') 
      : '-';
  }

  if (noteCont) {
    noteCont.innerText = order.requesterNote ? `Not: "${order.requesterNote}"` : '';
  }

  const dnInvSummaryEl = document.getElementById('detail-order-dn-inv-summary');
  if (dnInvSummaryEl) {
    const deliveries = order.deliveries || [];
    if (deliveries.length === 0) {
      dnInvSummaryEl.innerHTML = `
        <span style="font-size: 0.72rem; color: #64748b; font-style: italic;">
          <i class="fa-solid fa-clock"></i> Henüz sevkiyat girişi yapılmadı
        </span>
      `;
    } else {
      dnInvSummaryEl.innerHTML = deliveries.map(d => `
        <span class="badge-dn-chip" onclick="window.openUpdateInvoiceModal('${order.id}', '${d.id}', '${(d.invoiceNo || '').replace(/'/g, "\\'")}', '${d.invoiceDate || ''}')" style="font-size: 0.7rem; padding: 2px 7px; cursor: pointer; border-color: rgba(0, 243, 255, 0.4);" title="Tıklayarak Fatura Numarası Ekle veya Düzenle">
          <i class="fa-solid fa-receipt" style="color: #00f3ff;"></i> DN: ${d.deliveryNoteNo}
          ${d.invoiceNo ? `<span style="color: #34d399; margin-left: 4px; font-weight: 800;"><i class="fa-solid fa-file-invoice-dollar"></i> Fat: ${d.invoiceNo}</span>` : '<span style="color: #f59e0b; margin-left: 4px; font-weight: 800; text-decoration: underline;"><i class="fa-solid fa-plus-circle"></i> Fatura Ekle</span>'}
        </span>
      `).join('');
    }
  }

  if (statusEl) {
    statusEl.innerText = order.status;
    statusEl.className = `status-badge ${order.status === 'COMPLETED' ? 'status-completed' : (order.status === 'PARTIAL' ? 'status-partial' : 'status-pending')}`;
  }

  // Calculate Financial Summaries for the order (including logistic cost / invoice prices)
  let orderTotalEur = 0;
  let orderCostEur = 0;
  let orderGrandSpendEur = 0;
  let orderRemainingEur = 0;
  const quotedLogisticsCost = Number(order.quotedLogisticsCost) || 0;

  (order.items || []).forEach(item => {
    const p = Number(item.price) || 0;
    const invP = Number(item.invoicePrice) || p;
    const requested = Number(item.quantity) || 0;
    const delivered = Number(item.deliveredQuantity) || 0;
    const remaining = Math.max(0, requested - delivered);

    const costDiff = Math.max(0, invP - p);

    orderTotalEur += (requested * p);
    orderCostEur += (delivered * costDiff);
    orderGrandSpendEur += (delivered * invP);
    orderRemainingEur += (remaining * p);
  });

  const totalEl = document.getElementById('detail-total-amount');
  const logisticEl = document.getElementById('detail-logistic-amount');
  const logBadgeEl = document.getElementById('detail-logistic-variance-badge');
  const logCompareEl = document.getElementById('detail-logistic-compare-text');
  const delivEl = document.getElementById('detail-delivered-amount');
  const remEl = document.getElementById('detail-remaining-amount');

  if (totalEl) {
    if (quotedLogisticsCost > 0) {
      totalEl.innerHTML = `
        ${(orderTotalEur + quotedLogisticsCost).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
        <div style="font-size: 0.62rem; color: #94a3b8; font-weight: 500; margin-top: 1px;">
          (Malzeme: ${orderTotalEur.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} € + Teklif Lojistik: ${quotedLogisticsCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} €)
        </div>
      `;
    } else {
      totalEl.innerText = `${orderTotalEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
    }
  }

  if (logisticEl) {
    const diff = orderCostEur - quotedLogisticsCost;
    logisticEl.innerText = `${orderCostEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

    if (logBadgeEl) {
      if (quotedLogisticsCost > 0) {
        if (Math.abs(diff) < 0.01) {
          logBadgeEl.innerHTML = `<span style="color: #34d399; background: rgba(52,211,153,0.15); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(52,211,153,0.3);">✅ Teklifle Eşleşti</span>`;
        } else if (diff > 0) {
          const diffPct = quotedLogisticsCost > 0 ? ((diff / quotedLogisticsCost) * 100).toFixed(1) : '0';
          logBadgeEl.innerHTML = `<span style="color: #f87171; background: rgba(239,68,68,0.15); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.4);">⚠️ +${diff.toFixed(2)} € (%${diffPct}) Fazla Kesilmiş!</span>`;
        } else {
          logBadgeEl.innerHTML = `<span style="color: #38bdf8; background: rgba(56,189,248,0.15); padding: 1px 6px; border-radius: 4px; border: 1px solid rgba(56,189,248,0.3);">🟢 ${diff.toFixed(2)} € Avantajlı</span>`;
        }
      } else {
        const pct = orderTotalEur > 0 ? ((orderCostEur / orderTotalEur) * 100).toFixed(1) : '0.0';
        logBadgeEl.innerHTML = orderCostEur > 0 ? `<span style="color: #f59e0b; font-size: 0.7rem;">(+%${pct})</span>` : '';
      }
    }

    if (logCompareEl) {
      if (quotedLogisticsCost > 0) {
        logCompareEl.innerHTML = `Teklif: <strong style="color: #cbd5e1;">${quotedLogisticsCost.toFixed(2)} €</strong> • Fatura: <strong style="color: ${diff > 0 ? '#f87171' : (diff < 0 ? '#38bdf8' : '#34d399')};">${orderCostEur.toFixed(2)} €</strong>`;
      } else {
        logCompareEl.innerText = `Faturada oluşan lojistik navlun farkı`;
      }
    }
  }

  if (delivEl) delivEl.innerText = `${orderGrandSpendEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  if (remEl) remEl.innerText = `${orderRemainingEur.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  // Items table (Overview with prices and DN/Invoice match)
  if (itemsTbody) {
    itemsTbody.innerHTML = (order.items || []).map(item => {
      const delivered = item.deliveredQuantity || 0;
      const damaged = item.damagedQuantity || 0;
      const remaining = Math.max(0, item.quantity - delivered);
      const isDone = delivered >= item.quantity;
      const price = Number(item.price) || 0;
      const invPrice = Number(item.invoicePrice) || 0;
      const hasInvPrice = invPrice > 0 && invPrice !== price;
      const lineTotal = (invPrice > 0 ? invPrice : price) * item.quantity;

      // Find matching deliveries for this item
      const matchingDeliveries: Array<{ deliveryId: string; dn: string; invoiceNo?: string; invoiceDate?: string; qty: number; invoicePrice?: number; orderPrice?: number }> = [];
      (order.deliveries || []).forEach(d => {
        const found = (d.items || []).find(di => di.itemId === item.itemId || (di.sapNo && di.sapNo === item.sapNo));
        if (found) {
          const q = found.acceptedQty !== undefined ? found.acceptedQty : found.receivedQty;
          if (q > 0) {
            matchingDeliveries.push({
              deliveryId: d.id,
              dn: d.deliveryNoteNo,
              invoiceNo: d.invoiceNo,
              invoiceDate: d.invoiceDate,
              qty: q,
              invoicePrice: found.invoicePrice,
              orderPrice: found.orderPrice
            });
          }
        }
      });

      const dnInvoiceHtml = matchingDeliveries.length > 0
        ? matchingDeliveries.map(md => `
          <div style="display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-bottom: 2px;">
            <span class="badge-dn-chip" style="font-size: 0.68rem; padding: 1px 5px;">
              <i class="fa-solid fa-receipt"></i> DN: ${md.dn} (${md.qty} Adet)
            </span>
            ${md.invoiceNo ? `
              <span class="badge-dn-chip" onclick="window.openUpdateInvoiceModal('${order.id}', '${md.deliveryId}', '${(md.invoiceNo || '').replace(/'/g, "\\'")}', '${md.invoiceDate || ''}')" style="font-size: 0.68rem; padding: 2px 6px; color: #34d399; border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.1); cursor: pointer;" title="Tıklayarak Faturayı ve Lojistik Birim Fiyatları Düzenle">
                <i class="fa-solid fa-file-invoice-dollar"></i> Fat: ${md.invoiceNo} ${md.invoicePrice && md.invoicePrice > 0 ? `(${md.invoicePrice.toFixed(2)} €)` : ''} <i class="fa-solid fa-pen" style="font-size: 0.55rem; opacity: 0.7; margin-left: 2px;"></i>
              </span>
            ` : `
              <button type="button" onclick="window.openUpdateInvoiceModal('${order.id}', '${md.deliveryId}', '', '')" class="cyber-btn cyber-btn-secondary" style="padding: 1px 6px; font-size: 0.68rem; height: 20px; border-color: rgba(245,158,11,0.5); color: #f59e0b; background: rgba(245,158,11,0.1);" title="Bu sevkiyat için Fatura ve Lojistik Fiyatı Ekle">
                <i class="fa-solid fa-plus-circle"></i> + Fatura Ekle
              </button>
            `}
          </div>
        `).join('')
        : '<span style="color: #64748b; font-size: 0.72rem; font-style: italic;">Henüz gelmedi</span>';

      return `
        <tr>
          <td>
            <div style="font-family: monospace; color: #00f3ff; font-weight: 800;">
              ${item.sapNo ? item.sapNo : '<span style="color: #f59e0b;">MANUEL</span>'}
            </div>
          </td>
          <td>
            <div style="font-weight: 700; color: #fff;">${item.description}</div>
            ${item.enerconRef ? `<div style="font-size: 0.72rem; color: #38bdf8;">Enercon Ref: ${item.enerconRef}</div>` : ''}
          </td>
          <td style="text-align: center; font-weight: 800; color: #fff;">${item.quantity} ${item.unit || 'Adet'}</td>
          <td style="text-align: right;">
            <div style="font-weight: 700; color: #38bdf8;">${price > 0 ? price.toFixed(2) + ' €' : '-'}</div>
            ${hasInvPrice ? `
              <div style="font-size: 0.68rem; font-weight: 800; color: #34d399;" title="Faturadaki Lojistik Maliyet Dahil Birim Fiyat">
                Fat: ${invPrice.toFixed(2)} € <span style="font-size: 0.65rem; color: ${invPrice > price ? '#f59e0b' : '#34d399'};">(${invPrice > price ? '+' : ''}${(invPrice - price).toFixed(2)} €)</span>
              </div>
            ` : ''}
          </td>
          <td style="text-align: right;">
            <div style="font-weight: 800; color: #00f3ff;">${lineTotal > 0 ? lineTotal.toFixed(2) + ' €' : '-'}</div>
            ${hasInvPrice ? `
              <div style="font-size: 0.65rem; color: #f59e0b; font-weight: 700;">(+${((invPrice - price) * item.quantity).toFixed(2)} € Cost)</div>
            ` : ''}
          </td>
          <td style="text-align: center; font-weight: 800; color: #34d399;">${delivered}</td>
          <td style="text-align: center; font-weight: 800; color: ${damaged > 0 ? '#f87171' : '#64748b'};">
            ${damaged > 0 ? `<span style="color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.4); padding: 2px 6px; border-radius: 4px; font-size: 0.74rem;"><i class="fa-solid fa-triangle-exclamation"></i> ${damaged}</span>` : '0'}
          </td>
          <td style="text-align: center; font-weight: 800; color: ${remaining > 0 ? '#f59e0b' : '#64748b'};">${remaining}</td>
          <td>
            ${dnInvoiceHtml}
          </td>
          <td style="text-align: center;">
            <span class="status-badge ${isDone ? 'status-completed' : (delivered > 0 ? 'status-partial' : 'status-pending')}" style="font-size: 0.7rem; padding: 2px 8px;">
              ${isDone ? 'TAMAMLANDI' : (delivered > 0 ? `${delivered}/${item.quantity} GELDİ` : 'BEKLİYOR')}
            </span>
          </td>
        </tr>
      `;
    }).join('');
  }

  // Partial Delivery Inputs with Shelf No, Quantity, and Damaged/Return per item
  if (deliveryInputs) {
    const uncompletedItems = (order.items || []).filter(i => (i.deliveredQuantity || 0) < i.quantity);

    if (uncompletedItems.length === 0) {
      deliveryInputs.innerHTML = `
        <div style="color: #34d399; font-weight: 800; padding: 1.5rem; text-align: center; background: rgba(16, 185, 129, 0.1); border-radius: 12px;">
          <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block;"></i>
          Bu siparişteki tüm malzemeler eksiksiz ve sağlam teslim alınmıştır.
        </div>
      `;
      const deliveryCard = document.getElementById('delivery-input-card');
      if (deliveryCard) deliveryCard.style.display = 'none';
    } else {
      const deliveryCard = document.getElementById('delivery-input-card');
      if (deliveryCard) deliveryCard.style.display = 'block';

      deliveryInputs.innerHTML = uncompletedItems.map(item => {
        const remaining = item.quantity - (item.deliveredQuantity || 0);
        const safeDesc = item.description.replace(/"/g, '&quot;');
        const damagedTotal = item.damagedQuantity || 0;

        return `
          <div class="delivery-item-row" data-sap="${item.sapNo || ''}" data-desc="${safeDesc}" style="display: flex; flex-direction: column; background: rgba(0,0,0,0.35); padding: 5px 8px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.06); gap: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;">
              
              <!-- 1. SOL BAŞ: GELEN ADET GİRİŞ KUTUSU (VARSAYILAN BOŞ) -->
              <div style="display: flex; align-items: center; gap: 4px;">
                <input type="number" min="0" max="${remaining}" value="" placeholder="0" data-item-id="${item.itemId}" oninput="window.saveDeliveryModalDraft()" class="mini-input delivery-qty-input" style="width: 55px !important; text-align: center; font-weight: 900; font-size: 0.85rem; color: #34d399 !important; border-color: rgba(52, 211, 153, 0.4); background: rgba(52, 211, 153, 0.08);" title="Gelen Adet (Kalan: ${remaining})">
              </div>

              <!-- 2. ORTA: MALZEME BİLGİLERİ -->
              <div style="flex: 1; min-width: 160px;">
                <strong style="color: #fff; font-size: 0.78rem;">${item.description}</strong>
                <div style="font-size: 0.68rem; color: #94a3b8;">
                  ${item.sapNo ? '<span style="color: #00f3ff; font-weight: 700;">SAP: ' + item.sapNo + '</span>' : '<span style="color: #f59e0b; font-weight: 700;">MANUEL</span>'} 
                  • Kalan: <strong style="color: #f59e0b;">${remaining}</strong> ${item.unit || 'Adet'}
                  ${item.price ? ` • Birim: <strong style="color: #38bdf8;">${Number(item.price).toFixed(2)} €</strong>` : ''}
                  ${damagedTotal > 0 ? ` • <span style="color: #f87171; font-weight: 700;">(Hasarlı: ${damagedTotal})</span>` : ''}
                </div>
              </div>
              
              <!-- 3. SAĞ: RAF NO & HASAR BUTONU -->
              <div style="display: flex; align-items: center; gap: 4px;">
                <!-- Shelf Input -->
                <div>
                  <input type="text" placeholder="Raf (A-01)" data-shelf-item-id="${item.itemId}" oninput="window.saveDeliveryModalDraft()" class="mini-input delivery-shelf-input" style="width: 75px !important;">
                </div>

                <!-- Damage / Return Toggle Button -->
                <button type="button" class="mini-damage-btn" onclick="window.toggleDamagePanel('${item.itemId}')" id="btn-toggle-damage-${item.itemId}" title="Hasar veya İade Bildir">
                  <i class="fa-solid fa-triangle-exclamation"></i> Hasar
                </button>
              </div>
            </div>

            <!-- Damage / Return Expandable Panel -->
            <div id="damage-panel-${item.itemId}" style="display: none; background: rgba(239, 68, 68, 0.08); border: 1px dashed rgba(239, 68, 68, 0.4); border-radius: 6px; padding: 4px 6px; margin-top: 2px; gap: 6px; align-items: center; flex-wrap: wrap;">
              <span style="font-size: 0.68rem; color: #f87171; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> HASAR:</span>
              <div style="display: flex; align-items: center; gap: 3px;">
                <label style="font-size: 0.68rem; color: #cbd5e1;">Adet:</label>
                <input type="number" min="0" max="${remaining}" value="0" id="damage-qty-${item.itemId}" oninput="window.saveDeliveryModalDraft()" class="mini-input" style="width: 40px !important; text-align: center; color: #f87171 !important; font-weight: 800 !important; border-color: rgba(239, 68, 68, 0.5) !important;">
              </div>
              <div style="flex: 1; min-width: 120px;">
                <input type="text" id="damage-reason-${item.itemId}" oninput="window.saveDeliveryModalDraft()" class="mini-input" style="width: 100% !important; border-color: rgba(239, 68, 68, 0.4) !important;" placeholder="Hasar/Kusur/İade nedeni...">
              </div>
              <div>
                <select id="damage-action-${item.itemId}" onchange="window.saveDeliveryModalDraft()" class="mini-input" style="border-color: rgba(239, 68, 68, 0.4) !important; color: #f87171 !important;">
                  <option value="RETURNED">🔄 Tedarikçiye İade</option>
                  <option value="EXCHANGE">🔁 Değişim</option>
                  <option value="SCRAP">🗑️ Hurda</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Restore draft if user previously typed in this order's delivery form
      const draft = deliveryDrafts[orderId];
      if (draft) {
        if (dnInput && draft.dnNo !== undefined) dnInput.value = draft.dnNo;
        if (invInput && draft.invoiceNo !== undefined) invInput.value = draft.invoiceNo;
        if (stockInput && draft.stockDate) stockInput.value = draft.stockDate;

        if (draft.items) {
          Object.keys(draft.items).forEach(itemId => {
            const itemDraft = draft.items![itemId];
            const qtyInput = document.querySelector(`.delivery-qty-input[data-item-id="${itemId}"]`) as HTMLInputElement;
            const shelfInput = document.querySelector(`.delivery-shelf-input[data-shelf-item-id="${itemId}"]`) as HTMLInputElement;
            const damageQtyInput = document.getElementById(`damage-qty-${itemId}`) as HTMLInputElement;
            const damageReasonInput = document.getElementById(`damage-reason-${itemId}`) as HTMLInputElement;
            const damageActionSelect = document.getElementById(`damage-action-${itemId}`) as HTMLSelectElement;

            if (qtyInput && itemDraft.qty !== undefined) qtyInput.value = itemDraft.qty;
            if (shelfInput && itemDraft.shelf !== undefined) shelfInput.value = itemDraft.shelf;
            if (damageQtyInput && itemDraft.damageQty !== undefined) damageQtyInput.value = itemDraft.damageQty;
            if (damageReasonInput && itemDraft.reason !== undefined) damageReasonInput.value = itemDraft.reason;
            if (damageActionSelect && itemDraft.action !== undefined) damageActionSelect.value = itemDraft.action;

            if (itemDraft.damageQty && Number(itemDraft.damageQty) > 0) {
              const panel = document.getElementById(`damage-panel-${itemId}`);
              if (panel) panel.style.display = 'flex';
            }
          });
        }
      }
    }
  }

  // Past Deliveries (Excel style timeline)
  if (historyCont) {
    const deliveries = order.deliveries || [];
    if (deliveries.length === 0) {
      historyCont.innerHTML = `<div style="color: #64748b; font-size: 0.85rem; text-align: center; padding: 1.5rem;">Henüz teslimat girişi yapılmamıştır.</div>`;
    } else {
      historyCont.innerHTML = deliveries.map(d => `
        <div style="background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 10px 14px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 6px;">
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="badge-dn-chip"><i class="fa-solid fa-receipt"></i> DN / İrsaliye: ${d.deliveryNoteNo}</span>
              ${d.invoiceNo ? `
                <span class="badge-dn-chip" style="color: #34d399; border-color: rgba(52,211,153,0.4); background: rgba(52,211,153,0.1);">
                  <i class="fa-solid fa-file-invoice-dollar"></i> Fat: ${d.invoiceNo} ${d.invoiceDate ? `(${d.invoiceDate})` : ''}
                </span>
              ` : `
                <span class="badge-dn-chip" style="color: #f59e0b; border-color: rgba(245,158,11,0.3); background: rgba(245,158,11,0.1);">
                  <i class="fa-solid fa-clock"></i> Fatura Bekleniyor
                </span>
              `}
              <button type="button" onclick="window.openUpdateInvoiceModal('${order.id}', '${d.id}', '${(d.invoiceNo || '').replace(/'/g, "\\'")}', '${d.invoiceDate || ''}')" class="cyber-btn cyber-btn-secondary" style="padding: 2px 8px; font-size: 0.7rem; height: 22px; border-color: rgba(56,189,248,0.4); color: #38bdf8;" title="Fatura No / Tarihi Ekle veya Güncelle">
                <i class="fa-solid fa-file-pen"></i> ${d.invoiceNo ? 'Faturayı Düzenle' : '➕ Fatura No Ekle'}
              </button>
              <span style="font-size: 0.78rem; color: #94a3b8;"><i class="fa-solid fa-plane-arrival"></i> Geliş: ${d.arrivalDate || d.deliveryDate}</span>
              ${d.stockEntryDate ? `<span style="font-size: 0.78rem; color: #34d399;"><i class="fa-solid fa-dolly"></i> Depo Giriş: ${d.stockEntryDate}</span>` : ''}
              ${d.transitDays !== undefined ? `<span class="badge-dn-chip" style="color: #38bdf8; border-color: rgba(56,189,248,0.3);"><i class="fa-solid fa-stopwatch"></i> ${d.transitDays} Günde Geldi</span>` : ''}
            </div>
            <div style="font-size: 0.75rem; color: #34d399; font-weight: 700;">
              ${d.autoAddedToStock ? '<i class="fa-solid fa-check-circle"></i> Stoğa Eklendi' : ''}
            </div>
          </div>
          <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 5px;">
            Teslim Alan: <strong style="color: #fff;">${d.receivedBy}</strong>
          </div>
          <div style="margin-top: 6px; display: flex; flex-direction: column; gap: 4px;">
            ${(d.items || []).map(i => {
              const hasDamage = (i.damagedQty || 0) > 0;
              const accepted = i.acceptedQty !== undefined ? i.acceptedQty : i.receivedQty;
              return `
                <div style="font-size: 0.75rem; background: rgba(255,255,255,0.03); padding: 4px 8px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 4px;">
                  <span>
                    <strong style="color: #00f3ff;">${i.sapNo ? i.sapNo + ' - ' : ''}</strong>${i.description}: 
                    <strong style="color: #34d399;">${accepted} Adet Sağlam</strong>
                    ${i.shelfNo ? `<span style="color: #94a3b8;"> (Raf: ${i.shelfNo})</span>` : ''}
                  </span>
                  ${hasDamage ? `
                    <span style="color: #f87171; background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); padding: 1px 6px; border-radius: 4px; font-weight: 700;">
                      ⚠️ ${i.damagedQty} Adet Hasarlı / İade ${i.returnReason ? `("${i.returnReason}")` : ''}
                    </span>
                  ` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `).join('');
    }
  }

  // Damage & Return Dedicated List Tab
  if (damageCont) {
    const allDamagedDeliveries: Array<{
      dnNo: string;
      invoiceNo?: string;
      date: string;
      sapNo?: string;
      description: string;
      damagedQty: number;
      reason?: string;
      action?: string;
    }> = [];

    (order.deliveries || []).forEach(d => {
      (d.items || []).forEach(di => {
        if ((di.damagedQty || 0) > 0) {
          allDamagedDeliveries.push({
            dnNo: d.deliveryNoteNo,
            invoiceNo: d.invoiceNo,
            date: d.arrivalDate || d.deliveryDate || '-',
            sapNo: di.sapNo,
            description: di.description,
            damagedQty: di.damagedQty || 0,
            reason: di.returnReason,
            action: di.returnAction
          });
        }
      });
    });

    if (allDamagedDeliveries.length === 0) {
      damageCont.innerHTML = `
        <div style="color: #64748b; font-size: 0.82rem; text-align: center; padding: 2rem;">
          <i class="fa-solid fa-circle-check" style="font-size: 1.5rem; color: #34d399; margin-bottom: 0.5rem; display: block;"></i>
          Bu siparişte herhangi bir hasar veya iade kaydı bulunmamaktadır.
        </div>
      `;
    } else {
      const actionMap: Record<string, string> = {
        'RETURNED': '🔄 Tedarikçiye İade Edildi',
        'EXCHANGE': '🔁 Değişim Talep Edildi',
        'SCRAP': '🗑️ Hurda Kabul Edildi',
        'NONE': '⚠️ Hasar Kaydedildi'
      };

      damageCont.innerHTML = `
        <div style="overflow-x: auto; background: rgba(0,0,0,0.3); border-radius: 12px; border: 1px solid rgba(239, 68, 68, 0.2);">
          <table class="orders-table" style="font-size: 0.8rem;">
            <thead>
              <tr>
                <th>DN & FATURA</th>
                <th>SAP NO</th>
                <th>MALZEME TANIMI</th>
                <th style="text-align: center; width: 80px; color: #f87171;">HASARLI ADET</th>
                <th>HASAR / İADE NEDENİ</th>
                <th style="text-align: center; width: 140px;">AKSİYON / DURUM</th>
              </tr>
            </thead>
            <tbody>
              ${allDamagedDeliveries.map(rec => `
                <tr>
                  <td>
                    <div style="font-weight: 800; color: #00f3ff; font-family: monospace;">DN: ${rec.dnNo}</div>
                    ${rec.invoiceNo ? `<div style="font-size: 0.72rem; color: #f59e0b;">Fat: ${rec.invoiceNo}</div>` : ''}
                    <div style="font-size: 0.68rem; color: #94a3b8;">${rec.date}</div>
                  </td>
                  <td>
                    <span style="font-family: monospace; color: #00f3ff; font-weight: 700;">${rec.sapNo || 'MANUEL'}</span>
                  </td>
                  <td>
                    <div style="font-weight: 700; color: #fff;">${rec.description}</div>
                  </td>
                  <td style="text-align: center;">
                    <span style="font-size: 0.85rem; font-weight: 900; color: #f87171;">${rec.damagedQty} Adet</span>
                  </td>
                  <td style="color: #cbd5e1; font-style: italic;">
                    ${rec.reason || 'Açıklama belirtilmedi.'}
                  </td>
                  <td style="text-align: center;">
                    <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3); font-weight: 700;">
                      ${actionMap[rec.action || 'NONE'] || rec.action}
                    </span>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }
  }

  // Populate Edit Tab (with Birim Fiyat inputs & live SAP auto-fill)
  const editQuotedLogisticsInput = document.getElementById('order-edit-quoted-logistics') as HTMLInputElement;
  if (editQuotedLogisticsInput) editQuotedLogisticsInput.value = (order.quotedLogisticsCost !== undefined && order.quotedLogisticsCost > 0) ? String(order.quotedLogisticsCost) : '';
  if (editNote) editNote.value = order.requesterNote || '';
  if (editContainer) {
    editContainer.innerHTML = (order.items || []).map(item => `
      <tr class="edit-item-row" data-item-id="${item.itemId}" data-delivered="${item.deliveredQuantity || 0}">
        <td>
          <input type="text" class="edit-item-sap mini-input" value="${item.sapNo || ''}" oninput="window.handleEditSapInput(this)" placeholder="SAP No" style="width: 100% !important; color: #00f3ff !important; font-weight: 700; font-family: monospace;">
        </td>
        <td>
          <input type="text" class="edit-item-desc mini-input" value="${item.description.replace(/"/g, '&quot;')}" placeholder="Malzeme Açıklaması" style="width: 100% !important; color: #fff !important; font-weight: 600;">
        </td>
        <td>
          <input type="text" class="edit-item-enercon mini-input" value="${item.enerconRef || ''}" placeholder="Ref No" style="width: 100% !important; color: #38bdf8 !important;">
        </td>
        <td style="text-align: center;">
          <input type="number" min="${item.deliveredQuantity || 1}" class="edit-item-qty mini-input" value="${item.quantity}" style="width: 70px !important; text-align: center; font-weight: 800; color: #34d399 !important; margin: auto;">
        </td>
        <td style="text-align: right;">
          <input type="text" inputmode="decimal" class="edit-item-price mini-input" value="${item.price !== undefined && item.price > 0 ? item.price : ''}" placeholder="0.00" style="width: 90px !important; text-align: right; font-weight: 800; color: #38bdf8 !important; margin-left: auto;">
        </td>
        <td style="text-align: center; font-size: 0.8rem; font-weight: 800; color: ${item.deliveredQuantity > 0 ? '#34d399' : '#64748b'};">
          ${item.deliveredQuantity || 0}
        </td>
        <td style="text-align: center;">
          <button type="button" onclick="this.closest('.edit-item-row').remove()" class="cyber-btn cyber-btn-danger" style="padding: 2px 6px; font-size: 0.72rem; height: 24px;" title="Kalemi Siparişten Çıkar">
            <i class="fa-solid fa-trash"></i>
          </button>
        </td>
      </tr>
    `).join('');
  }

  if (modal) modal.classList.add('open');
};

// Live SAP lookup for Edit Tab
(window as any).handleEditSapInput = async (inputEl: HTMLInputElement) => {
  const row = inputEl.closest('.edit-item-row');
  if (!row) return;
  const sap = inputEl.value.trim();
  const descInput = row.querySelector('.edit-item-desc') as HTMLInputElement;

  if (!sap) {
    if (descInput) descInput.value = '';
    return;
  }

  const catalog = await (window as any).loadSapCatalogData();
  const match = catalog.find((c: any) => c.sapNo.toLowerCase() === sap.toLowerCase());
  if (match && descInput) {
    descInput.value = match.description;
  }
};

// Add new empty row to Edit order tab
(window as any).addEditItemRow = () => {
  const editContainer = document.getElementById('order-edit-items-container');
  if (!editContainer) return;
  const newItemId = `ITEM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const tr = document.createElement('tr');
  tr.className = 'edit-item-row';
  tr.dataset.itemId = newItemId;
  tr.dataset.delivered = '0';
  tr.innerHTML = `
    <td>
      <input type="text" class="edit-item-sap mini-input" oninput="window.handleEditSapInput(this)" placeholder="SAP No" style="width: 100% !important; color: #00f3ff !important; font-weight: 700; font-family: monospace;">
    </td>
    <td>
      <input type="text" class="edit-item-desc mini-input" placeholder="Malzeme Açıklaması" style="width: 100% !important; color: #fff !important; font-weight: 600;">
    </td>
    <td>
      <input type="text" class="edit-item-enercon mini-input" placeholder="Ref No" style="width: 100% !important; color: #38bdf8 !important;">
    </td>
    <td style="text-align: center;">
      <input type="number" min="1" value="1" class="edit-item-qty mini-input" style="width: 70px !important; text-align: center; font-weight: 800; color: #34d399 !important; margin: auto;">
    </td>
    <td style="text-align: right;">
      <input type="text" inputmode="decimal" class="edit-item-price mini-input" placeholder="0.00" style="width: 90px !important; text-align: right; font-weight: 800; color: #38bdf8 !important; margin-left: auto;">
    </td>
    <td style="text-align: center; font-size: 0.8rem; font-weight: 800; color: #64748b;">
      0
    </td>
    <td style="text-align: center;">
      <button type="button" onclick="this.closest('.edit-item-row').remove()" class="cyber-btn cyber-btn-danger" style="padding: 2px 6px; font-size: 0.72rem; height: 24px;" title="Kalemi Siparişten Çıkar">
        <i class="fa-solid fa-trash"></i>
      </button>
    </td>
  `;
  editContainer.appendChild(tr);
};

// Save edited order items, SAP numbers and note
(window as any).handleSaveOrderEdit = async () => {
  const order = allOrdersList.find(o => o.id === activeDetailOrderId);
  if (!order || !order.id) return;

  const rows = document.querySelectorAll('#order-edit-items-container .edit-item-row');
  if (rows.length === 0) {
    alert("Siparişte en az bir kalem bulunmalıdır!");
    return;
  }

  const newItems: OrderItem[] = [];
  for (const row of Array.from(rows) as HTMLElement[]) {
    const itemId = row.dataset.itemId || `ITEM_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const delivered = Number(row.dataset.delivered || 0);
    const sapNo = (row.querySelector('.edit-item-sap') as HTMLInputElement)?.value?.trim() || '';
    const description = (row.querySelector('.edit-item-desc') as HTMLInputElement)?.value?.trim() || '';
    const enerconRef = (row.querySelector('.edit-item-enercon') as HTMLInputElement)?.value?.trim() || '';
    const qty = Number((row.querySelector('.edit-item-qty') as HTMLInputElement)?.value) || 1;
    const priceVal = parsePriceInput((row.querySelector('.edit-item-price') as HTMLInputElement)?.value);

    if (!description) {
      alert("Lütfen tüm kalemler için malzeme tanımını doldurunuz!");
      return;
    }
    if (qty < delivered) {
      alert(`İstenen adet (${qty}), teslim alınmış adetten (${delivered}) küçük olamaz!`);
      return;
    }

    const oldItem = (order.items || []).find(i => i.itemId === itemId);
    const price = priceVal > 0 ? priceVal : (oldItem?.price || 0);

    newItems.push({
      itemId,
      sapNo: sapNo || '',
      description,
      enerconRef: enerconRef || '',
      quantity: qty,
      deliveredQuantity: delivered,
      damagedQuantity: oldItem?.damagedQuantity || 0,
      remainingQuantity: Math.max(0, qty - delivered),
      currentStock: oldItem?.currentStock || 0,
      limit: oldItem?.limit || 0,
      status: delivered >= qty ? 'COMPLETED' : (delivered > 0 ? 'PARTIAL' : 'PENDING'),
      unit: oldItem?.unit || 'Adet',
      price: price !== undefined && !isNaN(Number(price)) ? Number(price) : 0,
      currency: oldItem?.currency || 'EUR'
    });
  }

  const editQuotedLogistics = parsePriceInput((document.getElementById('order-edit-quoted-logistics') as HTMLInputElement)?.value);
  const editNote = (document.getElementById('order-edit-note') as HTMLInputElement)?.value?.trim();
  const btn = document.getElementById('btn-save-order-edit') as HTMLButtonElement;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';
    btn.disabled = true;
  }

  try {
    await orderService.updateOrderItems(order.id, newItems, editNote, editQuotedLogistics);
    alert("Sipariş kalemleri, SAP numaraları, fiyatlar ve teklif lojistik tutarı başarıyla güncellendi!");
    await (window as any).refreshOrdersTable(true);
    (window as any).viewOrderDetail(activeDetailOrderId);
    (window as any).switchModalSubtab('items');
  } catch (err) {
    console.error("Save edit order error:", err);
    alert("Sipariş düzenlenirken hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

(window as any).handlePartialDeliverySubmit = async (e: Event) => {
  e.preventDefault();
  const order = allOrdersList.find(o => o.id === activeDetailOrderId);
  if (!order || !order.id) return;

  const dnNo = (document.getElementById('delivery-note-no') as HTMLInputElement)?.value?.trim();
  const invoiceNo = (document.getElementById('delivery-invoice-no') as HTMLInputElement)?.value?.trim() || '';
  const stockEntryDate = (document.getElementById('delivery-stock-entry-date') as HTMLInputElement)?.value || new Date().toISOString().split('T')[0];
  const arrivalDate = stockEntryDate;
  const autoStock = (document.getElementById('delivery-auto-stock') as HTMLInputElement)?.checked || false;

  if (!dnNo) {
    alert("Lütfen Enercon Delivery Note (DN) veya İrsaliye numarasını giriniz!");
    return;
  }

  const qtyInputs = document.querySelectorAll('.delivery-qty-input');
  const itemsReceived: Array<{
    itemId: string;
    receivedQty: number;
    damagedQty?: number;
    returnReason?: string;
    returnAction?: 'RETURNED' | 'EXCHANGE' | 'SCRAP' | 'NONE';
    shelfNo?: string;
  }> = [];

  for (const input of Array.from(qtyInputs) as HTMLInputElement[]) {
    const itemId = input.dataset.itemId;
    const qty = Number(input.value) || 0;
    if (qty > 0 && itemId) {
      const shelfInput = document.querySelector(`.delivery-shelf-input[data-shelf-item-id="${itemId}"]`) as HTMLInputElement;
      const shelfNo = shelfInput?.value?.trim() || 'Tanımsız';

      const damageQtyInput = document.getElementById(`damage-qty-${itemId}`) as HTMLInputElement;
      const damageReasonInput = document.getElementById(`damage-reason-${itemId}`) as HTMLInputElement;
      const damageActionSelect = document.getElementById(`damage-action-${itemId}`) as HTMLSelectElement;

      const damagedQty = Math.max(0, Number(damageQtyInput?.value) || 0);
      const returnReason = damageReasonInput?.value?.trim() || '';
      const returnAction = (damageActionSelect?.value as any) || 'NONE';

      if (damagedQty > qty) {
        alert(`Hasarlı adet (${damagedQty}), gelen toplam adetten (${qty}) fazla olamaz!`);
        return;
      }

      itemsReceived.push({
        itemId,
        receivedQty: qty,
        damagedQty,
        returnReason,
        returnAction,
        shelfNo
      });
    }
  }

  if (itemsReceived.length === 0) {
    alert("Lütfen bu sevkiyatta teslim alınan en az bir malzeme adedi giriniz!");
    return;
  }

  const btn = document.getElementById('btn-save-delivery') as HTMLButtonElement;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';
    btn.disabled = true;
  }

  try {
    const currentUser = (window as any).currentUser || authService.getCurrentUser();
    const receivedBy = currentUser?.displayName || currentUser?.email || 'Malzeme Kabul';

    await orderService.recordPartialDelivery(order.id, {
      deliveryNoteNo: dnNo,
      invoiceNo,
      arrivalDate,
      stockEntryDate,
      receivedBy,
      itemsReceived,
      autoAddToStock: autoStock,
      warehouseId: order.warehouseId,
      warehouseName: order.warehouseName
    });

    // Auto-sync deliveries to linked field demands
    try {
      const allReqs = await orderService.getRequests(true);
      const updatedOrder = allReqs.find((o: any) => o.id === order.id);
      if (updatedOrder) {
        await materialDemandService.syncDemandDeliveriesFromOrder(
          order.id,
          updatedOrder.orderNo || '',
          updatedOrder.items || []
        );
      }
    } catch (syncErr) {
      console.warn("Demand delivery auto-sync error:", syncErr);
    }

    delete deliveryDrafts[order.id];

    alert("Parçalı sevkiyat ve hasar/iade bilgileri başarıyla işlendi!");
    await (window as any).refreshOrdersTable(true);
    (window as any).viewOrderDetail(activeDetailOrderId);
  } catch (err) {
    console.error("Partial delivery save error", err);
    alert("Teslimat kaydedilirken hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

// ═══════════════════════════════════════════════════════
// INVOICE UPDATE MODAL LOGIC (LATE INVOICE ENTRY)
// ═══════════════════════════════════════════════════════

let activeInvoiceModalQuotedLogistics = 0;

(window as any).openUpdateInvoiceModal = (orderId: string, deliveryId: string, currentInvoiceNo: string, currentInvoiceDate: string) => {
  const order = allOrdersList.find(o => o.id === orderId);
  const delivery = (order?.deliveries || []).find(d => d.id === deliveryId);

  activeInvoiceModalQuotedLogistics = Number(order?.quotedLogisticsCost) || 0;

  (document.getElementById('edit-invoice-order-id') as HTMLInputElement).value = orderId;
  (document.getElementById('edit-invoice-delivery-id') as HTMLInputElement).value = deliveryId;
  (document.getElementById('edit-invoice-no') as HTMLInputElement).value = currentInvoiceNo || (delivery?.invoiceNo || '');
  (document.getElementById('edit-invoice-date') as HTMLInputElement).value = currentInvoiceDate || delivery?.invoiceDate || new Date().toISOString().split('T')[0];

  const dnBadge = document.getElementById('edit-invoice-dn-badge');
  if (dnBadge && delivery) {
    dnBadge.innerText = `DN: ${delivery.deliveryNoteNo}`;
  }

  const sumQuotedEl = document.getElementById('edit-invoice-sum-quoted');
  if (sumQuotedEl) {
    sumQuotedEl.innerText = `${activeInvoiceModalQuotedLogistics.toFixed(2)} €`;
  }

  const tbody = document.getElementById('edit-invoice-items-tbody');
  if (tbody && delivery) {
    tbody.innerHTML = (delivery.items || []).map(item => {
      const orderItem = (order?.items || []).find(oi => oi.itemId === item.itemId || (oi.sapNo && oi.sapNo === item.sapNo));
      const orderPrice = item.orderPrice !== undefined ? item.orderPrice : (orderItem?.price !== undefined ? Number(orderItem.price) : 0);
      const hasExplicitInvoicePrice = item.invoicePrice !== undefined && Number(item.invoicePrice) > 0 && Math.abs(Number(item.invoicePrice) - orderPrice) > 0.001;
      const invoicePriceVal = hasExplicitInvoicePrice ? item.invoicePrice : '';
      const displayPrice = hasExplicitInvoicePrice ? Number(item.invoicePrice) : orderPrice;
      const qty = item.acceptedQty !== undefined ? item.acceptedQty : item.receivedQty;
      const diff = hasExplicitInvoicePrice ? (displayPrice - orderPrice) : 0;
      const diffPct = (orderPrice > 0 && hasExplicitInvoicePrice) ? ((diff / orderPrice) * 100).toFixed(1) : '0.0';
      const rowTotal = displayPrice * qty;

      return `
        <tr class="edit-invoice-item-row" data-item-id="${item.itemId}" data-qty="${qty}" data-order-price="${orderPrice}">
          <td style="padding: 6px 8px;">
            <span style="font-family: monospace; color: #00f3ff; font-weight: 800; font-size: 0.78rem;">${item.sapNo || 'MANUEL'}</span>
          </td>
          <td style="padding: 6px 8px;">
            <div style="color: #fff; font-weight: 600; font-size: 0.78rem;">${item.description}</div>
          </td>
          <td style="text-align: center; font-weight: 800; color: #34d399; padding: 6px 8px; font-size: 0.78rem;">
            ${qty} Adet
          </td>
          <td style="text-align: right; color: #94a3b8; font-weight: 700; padding: 6px 8px; font-size: 0.78rem;">
            ${orderPrice > 0 ? orderPrice.toFixed(2) + ' €' : '-'}
          </td>
          <td style="text-align: right; padding: 6px 8px;">
            <input type="text" inputmode="decimal" value="${invoicePriceVal}" placeholder="${orderPrice > 0 ? orderPrice.toFixed(2) : '0.00'}" class="edit-invoice-price-input" oninput="window.calcInvoiceModalRow(this)" style="width: 82px !important; height: 26px; background: rgba(0, 243, 255, 0.08); border: 1px solid rgba(0, 243, 255, 0.4); border-radius: 5px; text-align: right; font-weight: 800; font-size: 0.8rem; color: #38bdf8 !important; padding: 1px 6px; margin-left: auto;">
          </td>
          <td style="text-align: center; padding: 6px 8px;">
            <span class="edit-invoice-diff-badge" style="display: inline-block; font-size: 0.68rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: ${diff > 0 ? 'rgba(245, 158, 11, 0.12)' : (diff < 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.05)')}; color: ${diff > 0 ? '#fbbf24' : (diff < 0 ? '#34d399' : '#64748b')}; border: 1px solid ${diff > 0 ? 'rgba(245, 158, 11, 0.25)' : (diff < 0 ? 'rgba(52, 211, 153, 0.25)' : 'transparent')};">
              ${hasExplicitInvoicePrice ? (diff > 0 ? `+${diff.toFixed(2)} € (%${diffPct})` : (diff < 0 ? `${diff.toFixed(2)} € (%${diffPct})` : '0.00 €')) : '-'}
            </span>
          </td>
          <td style="text-align: right; font-family: monospace; font-weight: 900; color: #00f3ff; padding: 6px 8px; font-size: 0.8rem;">
            <span class="edit-invoice-row-total">${rowTotal > 0 ? rowTotal.toFixed(2) + ' €' : '-'}</span>
          </td>
        </tr>
      `;
    }).join('');

    (window as any).recalcInvoiceModalTotals();
  }

  const modal = document.getElementById('order-invoice-edit-modal');
  if (modal) modal.classList.add('open');
};

(window as any).calcInvoiceModalRow = (inputEl: HTMLInputElement) => {
  const row = inputEl.closest('.edit-invoice-item-row') as HTMLElement;
  if (!row) return;

  const qty = Number(row.dataset.qty || 0);
  const orderPrice = Number(row.dataset.orderPrice || 0);
  const rawVal = inputEl.value.trim();
  const hasVal = rawVal !== '';
  const invoicePrice = hasVal ? parsePriceInput(rawVal) : orderPrice;

  const diff = invoicePrice - orderPrice;
  const diffPct = orderPrice > 0 ? ((diff / orderPrice) * 100).toFixed(1) : '0.0';
  const rowTotal = invoicePrice * qty;

  const diffBadge = row.querySelector('.edit-invoice-diff-badge') as HTMLElement;
  const rowTotalEl = row.querySelector('.edit-invoice-row-total') as HTMLElement;

  if (diffBadge) {
    if (hasVal) {
      diffBadge.innerText = diff > 0 ? `+${diff.toFixed(2)} € (%${diffPct})` : (diff < 0 ? `${diff.toFixed(2)} € (%${diffPct})` : '0.00 €');
      diffBadge.style.color = diff > 0 ? '#fbbf24' : (diff < 0 ? '#34d399' : '#64748b');
      diffBadge.style.background = diff > 0 ? 'rgba(245, 158, 11, 0.12)' : (diff < 0 ? 'rgba(52, 211, 153, 0.12)' : 'rgba(255,255,255,0.05)');
      diffBadge.style.borderColor = diff > 0 ? 'rgba(245, 158, 11, 0.25)' : (diff < 0 ? 'rgba(52, 211, 153, 0.25)' : 'transparent');
    } else {
      diffBadge.innerText = '-';
      diffBadge.style.color = '#64748b';
      diffBadge.style.background = 'rgba(255,255,255,0.05)';
      diffBadge.style.borderColor = 'transparent';
    }
  }

  if (rowTotalEl) {
    rowTotalEl.innerText = rowTotal > 0 ? rowTotal.toFixed(2) + ' €' : '-';
  }

  (window as any).recalcInvoiceModalTotals();
};

(window as any).recalcInvoiceModalTotals = () => {
  const rows = document.querySelectorAll('#edit-invoice-items-tbody .edit-invoice-item-row');
  let sumOrder = 0;
  let sumInvoiced = 0;

  rows.forEach((row: any) => {
    const qty = Number(row.dataset.qty || 0);
    const orderPrice = Number(row.dataset.orderPrice || 0);
    const priceInput = row.querySelector('.edit-invoice-price-input') as HTMLInputElement;
    const invoicePrice = priceInput && priceInput.value.trim() !== '' ? parsePriceInput(priceInput.value) : orderPrice;

    sumOrder += (orderPrice * qty);
    sumInvoiced += (invoicePrice * qty);
  });

  const diff = sumInvoiced - sumOrder;
  const sumOrderEl = document.getElementById('edit-invoice-sum-order');
  const sumQuotedEl = document.getElementById('edit-invoice-sum-quoted');
  const sumInvoicedEl = document.getElementById('edit-invoice-sum-invoiced');
  const sumDiffEl = document.getElementById('edit-invoice-sum-diff');
  const auditBannerEl = document.getElementById('edit-invoice-audit-banner');

  if (sumOrderEl) sumOrderEl.innerText = `${sumOrder.toFixed(2)} €`;
  if (sumQuotedEl) sumQuotedEl.innerText = `${activeInvoiceModalQuotedLogistics.toFixed(2)} €`;
  if (sumInvoicedEl) sumInvoicedEl.innerText = `${sumInvoiced.toFixed(2)} €`;
  if (sumDiffEl) {
    sumDiffEl.innerText = diff > 0 ? `+${diff.toFixed(2)} €` : (diff < 0 ? `${diff.toFixed(2)} €` : '0.00 €');
    sumDiffEl.style.color = diff > 0 ? '#f59e0b' : (diff < 0 ? '#34d399' : '#64748b');
  }

  if (auditBannerEl) {
    if (activeInvoiceModalQuotedLogistics > 0) {
      const variance = diff - activeInvoiceModalQuotedLogistics;
      if (Math.abs(variance) < 0.01) {
        auditBannerEl.style.display = 'flex';
        auditBannerEl.style.background = 'rgba(52, 211, 153, 0.15)';
        auditBannerEl.style.color = '#34d399';
        auditBannerEl.style.border = '1px solid rgba(52, 211, 153, 0.4)';
        auditBannerEl.innerHTML = `<i class="fa-solid fa-circle-check" style="margin-right: 6px;"></i> ✅ 0.00 € TEKLİFLE BİREBİR EŞLEŞTİ (HATASIZ: Teklif: ${activeInvoiceModalQuotedLogistics.toFixed(2)} € = Fatura: ${diff.toFixed(2)} €)`;
      } else if (variance > 0) {
        const varPct = ((variance / activeInvoiceModalQuotedLogistics) * 100).toFixed(1);
        auditBannerEl.style.display = 'flex';
        auditBannerEl.style.background = 'rgba(239, 68, 68, 0.18)';
        auditBannerEl.style.color = '#f87171';
        auditBannerEl.style.border = '1px solid rgba(239, 68, 68, 0.5)';
        auditBannerEl.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="margin-right: 6px;"></i> ⚠️ +${variance.toFixed(2)} € (%${varPct}) FAZLA / HATALI FATURA KESİLMİŞ! (Teklif: ${activeInvoiceModalQuotedLogistics.toFixed(2)} € ➔ Fatura Lojistiği: ${diff.toFixed(2)} €)`;
      } else {
        auditBannerEl.style.display = 'flex';
        auditBannerEl.style.background = 'rgba(56, 189, 248, 0.15)';
        auditBannerEl.style.color = '#38bdf8';
        auditBannerEl.style.border = '1px solid rgba(56, 189, 248, 0.4)';
        auditBannerEl.innerHTML = `<i class="fa-solid fa-arrow-trend-down" style="margin-right: 6px;"></i> 🟢 ${variance.toFixed(2)} € İNDİRİMLİ / AVANTAJLI (Teklif: ${activeInvoiceModalQuotedLogistics.toFixed(2)} € ➔ Fatura Lojistiği: ${diff.toFixed(2)} €)`;
      }
    } else {
      if (diff > 0) {
        auditBannerEl.style.display = 'flex';
        auditBannerEl.style.background = 'rgba(245, 158, 11, 0.12)';
        auditBannerEl.style.color = '#fbbf24';
        auditBannerEl.style.border = '1px solid rgba(245, 158, 11, 0.3)';
        auditBannerEl.innerHTML = `<i class="fa-solid fa-info-circle" style="margin-right: 6px;"></i> Faturada +${diff.toFixed(2)} € lojistik maliyeti hesaplandı.`;
      } else {
        auditBannerEl.style.display = 'none';
      }
    }
  }
};

(window as any).closeUpdateInvoiceModal = () => {
  const modal = document.getElementById('order-invoice-edit-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).handleSaveInvoiceUpdate = async (e: Event) => {
  e.preventDefault();
  const orderId = (document.getElementById('edit-invoice-order-id') as HTMLInputElement)?.value;
  const deliveryId = (document.getElementById('edit-invoice-delivery-id') as HTMLInputElement)?.value;
  const invoiceNo = (document.getElementById('edit-invoice-no') as HTMLInputElement)?.value?.trim();
  const invoiceDate = (document.getElementById('edit-invoice-date') as HTMLInputElement)?.value;

  if (!orderId || !deliveryId || !invoiceNo) {
    alert("Lütfen fatura numarasını giriniz!");
    return;
  }

  const rows = document.querySelectorAll('#edit-invoice-items-tbody .edit-invoice-item-row');
  const itemPrices: Array<{ itemId: string; invoicePrice: number }> = [];

  rows.forEach((row: any) => {
    const itemId = row.dataset.itemId;
    const priceInput = row.querySelector('.edit-invoice-price-input') as HTMLInputElement;
    const priceVal = priceInput && priceInput.value.trim() !== '' ? parsePriceInput(priceInput.value) : undefined;
    const orderPrice = Number(row.dataset.orderPrice || 0);

    if (itemId) {
      itemPrices.push({
        itemId,
        invoicePrice: priceVal !== undefined ? priceVal : orderPrice
      });
    }
  });

  const btn = document.getElementById('btn-save-invoice') as HTMLButtonElement;
  if (btn) btn.disabled = true;

  try {
    await orderService.updateDeliveryInvoice(orderId, deliveryId, invoiceNo, invoiceDate, itemPrices);
    alert("Fatura bilgileri ve lojistik birim fiyatları başarıyla kaydedildi!");
    (window as any).closeUpdateInvoiceModal();
    await (window as any).refreshOrdersTable(true);
    (window as any).viewOrderDetail(orderId);
    (window as any).switchModalSubtab('items');
  } catch (err) {
    alert("Fatura kaydedilirken hata oluştu: " + err);
  } finally {
    if (btn) btn.disabled = false;
  }
};

(window as any).closeOrderDetailModal = () => {
  const modal = document.getElementById('order-detail-modal');
  if (modal) {
    modal.classList.remove('open');
  }
};

(window as any).deleteCurrentOrderConfirm = async () => {
  if (!activeDetailOrderId) return;
  if (!confirm("Bu siparişi ve tüm sevkiyat geçmişini kalıcı olarak silmek istediğinizden emin misiniz?")) return;

  try {
    await orderService.deleteRequest(activeDetailOrderId);
    (window as any).closeOrderDetailModal();
    await (window as any).refreshOrdersTable(true);
    alert("Sipariş başarıyla silindi.");
  } catch (e) {
    alert("Sipariş silinirken hata oluştu: " + e);
  }
};

// Global ESC key listener to close active modals
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    (window as any).closeOrderDetailModal();
    (window as any).closeManualItemModal();
    (window as any).closeCatalogPickerModal();
    (window as any).closeExcelPasteModal();
    (window as any).closeUpdateInvoiceModal();
  }
});
