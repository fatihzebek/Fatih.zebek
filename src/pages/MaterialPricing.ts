import * as XLSX from 'xlsx';
import { priceService, type MaterialPriceEntry, type GroupedMaterialPrice } from '../services/PriceService';
import { authService } from '../services/AuthService';

export const MaterialPricingPage = async (userProfile?: any) => {
  const currentUser = userProfile || (window as any).currentUser || authService.getCurrentUser();
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const isMaterialManager = currentUser?.role === 'MALZEME_YONETIMI' || 
    currentUser?.email?.toLowerCase() === 'hursit.akter@demirerholding.com' ||
    currentUser?.email?.toLowerCase() === 'emir.unver@demirerholding.com';

  return `
    <style>
      .pricing-dashboard {
        padding: 2rem;
        max-width: 1650px;
        margin: 0 auto;
        font-family: 'Rajdhani', sans-serif;
        color: #f1f5f9;
      }
      
      .pricing-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
        gap: 1.25rem;
        margin-bottom: 2rem;
      }

      .pricing-stat-card {
        background: linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.7));
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 16px;
        padding: 1.4rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
        backdrop-filter: blur(12px);
        transition: transform 0.2s ease, border-color 0.2s ease;
      }
      .pricing-stat-card:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 243, 255, 0.4);
      }

      .pricing-stat-title {
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        font-weight: 700;
        margin-bottom: 0.5rem;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .pricing-stat-value {
        font-size: 2rem;
        font-weight: 900;
        color: #fff;
        line-height: 1.1;
      }

      .pricing-stat-sub {
        font-size: 0.75rem;
        color: #64748b;
        margin-top: 0.4rem;
      }

      .pricing-toolbar {
        background: rgba(15, 23, 42, 0.75);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 1.25rem;
        margin-bottom: 1.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
      }

      .pricing-search-box {
        position: relative;
        flex: 1;
        min-width: 280px;
        max-width: 480px;
      }

      .pricing-search-box input {
        width: 100%;
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(0, 243, 255, 0.2);
        border-radius: 10px;
        padding: 0.75rem 1rem 0.75rem 2.8rem;
        color: #fff;
        font-size: 0.95rem;
        outline: none;
        transition: border-color 0.2s;
        box-sizing: border-box;
      }
      .pricing-search-box input:focus {
        border-color: #00f3ff;
        box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
      }
      .pricing-search-box i {
        position: absolute;
        left: 1rem;
        top: 50%;
        transform: translateY(-50%);
        color: #94a3b8;
      }

      .pricing-filter-pills {
        display: flex;
        gap: 6px;
        flex-wrap: wrap;
      }

      .pricing-pill {
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 0.8rem;
        font-weight: 700;
        cursor: pointer;
        background: rgba(255, 255, 255, 0.05);
        color: #94a3b8;
        border: 1px solid rgba(255, 255, 255, 0.08);
        transition: all 0.2s ease;
        user-select: none;
      }
      .pricing-pill:hover {
        background: rgba(0, 243, 255, 0.1);
        color: #00f3ff;
        border-color: rgba(0, 243, 255, 0.3);
      }
      .pricing-pill.active {
        background: rgba(0, 243, 255, 0.2);
        color: #00f3ff;
        border-color: #00f3ff;
        box-shadow: 0 0 10px rgba(0, 243, 255, 0.25);
      }

      .pricing-actions {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
      }

      .btn-pricing {
        padding: 0.65rem 1.25rem;
        border-radius: 10px;
        font-weight: 800;
        font-size: 0.85rem;
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        border: none;
        transition: all 0.2s ease;
        letter-spacing: 0.5px;
      }
      .btn-pricing-primary {
        background: linear-gradient(135deg, #00f3ff, #0284c7);
        color: #000;
      }
      .btn-pricing-primary:hover {
        box-shadow: 0 0 20px rgba(0, 243, 255, 0.4);
        transform: translateY(-1px);
      }
      .btn-pricing-excel {
        background: rgba(16, 185, 129, 0.15);
        color: #10b981;
        border: 1px solid rgba(16, 185, 129, 0.3);
      }
      .btn-pricing-excel:hover {
        background: rgba(16, 185, 129, 0.25);
        border-color: #10b981;
      }
      .btn-pricing-secondary {
        background: rgba(255, 255, 255, 0.06);
        color: #e2e8f0;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .btn-pricing-secondary:hover {
        background: rgba(255, 255, 255, 0.12);
      }

      .pricing-table-container {
        background: rgba(15, 23, 42, 0.8);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
      }

      .pricing-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
      }

      .pricing-table th {
        background: rgba(2, 6, 23, 0.85);
        padding: 1rem 1.2rem;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #94a3b8;
        font-weight: 800;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      }

      .pricing-table td {
        padding: 1rem 1.2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        font-size: 0.88rem;
        vertical-align: middle;
      }

      .pricing-table tr:hover td {
        background: rgba(0, 243, 255, 0.02);
      }

      .badge-year-price {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 4px 10px;
        border-radius: 6px;
        font-weight: 800;
        font-size: 0.82rem;
      }
      .badge-2024 { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
      .badge-2025 { background: rgba(168, 85, 247, 0.15); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
      .badge-2026 { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid rgba(16, 185, 129, 0.3); }
      .badge-none { color: #475569; font-style: italic; font-weight: 500; }

      /* Modal Styling */
      .pricing-modal-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.8);
        backdrop-filter: blur(8px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .pricing-modal-overlay.open {
        opacity: 1;
        pointer-events: auto;
      }

      .pricing-modal {
        background: #0f172a;
        border: 1px solid rgba(0, 243, 255, 0.3);
        border-radius: 20px;
        width: 90%;
        max-width: 680px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.7), 0 0 30px rgba(0, 243, 255, 0.15);
        padding: 2rem;
        transform: scale(0.95);
        transition: transform 0.25s ease;
      }
      .pricing-modal-overlay.open .pricing-modal {
        transform: scale(1);
      }

      .pricing-form-group {
        margin-bottom: 1.25rem;
      }
      .pricing-form-label {
        display: block;
        font-size: 0.8rem;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #94a3b8;
        font-weight: 700;
        margin-bottom: 0.4rem;
      }
      .pricing-form-input, .pricing-form-select {
        width: 100%;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        padding: 0.75rem 1rem;
        color: #fff;
        font-size: 0.95rem;
        outline: none;
        box-sizing: border-box;
      }
      .pricing-form-input:focus, .pricing-form-select:focus {
        border-color: #00f3ff;
      }

      .sap-autocomplete-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: #1e293b;
        border: 1px solid rgba(0, 243, 255, 0.3);
        border-radius: 10px;
        max-height: 220px;
        overflow-y: auto;
        z-index: 10001;
        margin-top: 4px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
        display: none;
      }
      .sap-autocomplete-item {
        padding: 10px 14px;
        cursor: pointer;
        border-bottom: 1px solid rgba(255,255,255,0.05);
        font-size: 0.85rem;
        transition: background 0.15s;
      }
      .sap-autocomplete-item:hover {
        background: rgba(0, 243, 255, 0.15);
        color: #00f3ff;
      }
    </style>

    <div class="pricing-dashboard">
      
      <!-- Top Title & Navigation Row -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 12px;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center; color: #f59e0b; font-size: 1.3rem;">
              <i class="fa-solid fa-tags"></i>
            </div>
            <div>
              <h1 style="margin: 0; font-size: 2rem; font-weight: 900; color: #fff; letter-spacing: 0.5px;">MALZEME FİYAT & MALİYET YÖNETİMİ</h1>
              <p style="margin: 3px 0 0; color: #94a3b8; font-size: 0.85rem; font-weight: 600;">
                SAP Malzemelerinin Yıllık Alış Fiyatları (2024, 2025, 2026), Maliyet Geçmişi ve Parti Takibi
              </p>
            </div>
          </div>
        </div>

        <div class="pricing-actions">
          <button onclick="window.openPriceModal()" class="btn-pricing btn-pricing-primary">
            <i class="fa-solid fa-plus"></i> YENİ FİYAT GİRİŞİ
          </button>
          <button onclick="window.openExcelImportModal()" class="btn-pricing btn-pricing-excel">
            <i class="fa-solid fa-file-arrow-up"></i> EXCEL İLE TOPLU YÜKLE
          </button>
          <button onclick="window.exportPricesToExcel()" class="btn-pricing btn-pricing-secondary" title="Tüm Fiyat Listesini İndir">
            <i class="fa-solid fa-file-excel"></i> EXCEL'E AKTAR
          </button>
          <button onclick="window.refreshPricingTable(true)" class="btn-pricing btn-pricing-secondary" title="Listeyi Yenile">
            <i class="fa-solid fa-rotate"></i>
          </button>
        </div>
      </div>

      <!-- Stats Cards Row -->
      <div class="pricing-stats-grid">
        <div class="pricing-stat-card">
          <div class="pricing-stat-title"><i class="fa-solid fa-cubes" style="color: #00f3ff;"></i> FİYATLANDIRILMIŞ SAP KALEMİ</div>
          <div class="pricing-stat-value" id="stat-total-items"><i class="fa-solid fa-spinner fa-spin" style="font-size: 1.2rem;"></i></div>
          <div class="pricing-stat-sub">Sistemde kayıtlı toplam tekil malzeme</div>
        </div>
        <div class="pricing-stat-card">
          <div class="pricing-stat-title"><i class="fa-solid fa-calendar-days" style="color: #34d399;"></i> 2026 YILI FİYATLARI</div>
          <div class="pricing-stat-value" id="stat-2026-count" style="color: #34d399;">-</div>
          <div class="pricing-stat-sub">Güncel 2026 dönemi girişleri</div>
        </div>
        <div class="pricing-stat-card">
          <div class="pricing-stat-title"><i class="fa-solid fa-clock-rotate-left" style="color: #c084fc;"></i> 2025 YILI FİYATLARI</div>
          <div class="pricing-stat-value" id="stat-2025-count" style="color: #c084fc;">-</div>
          <div class="pricing-stat-sub">2025 dönemi alış kayıtları</div>
        </div>
        <div class="pricing-stat-card">
          <div class="pricing-stat-title"><i class="fa-solid fa-coins" style="color: #60a5fa;"></i> 2024 YILI FİYATLARI</div>
          <div class="pricing-stat-value" id="stat-2024-count" style="color: #60a5fa;">-</div>
          <div class="pricing-stat-sub">2024 dönemi geçmiş kayıtları</div>
        </div>
      </div>

      <!-- Toolbar (Search & Filter Pills) -->
      <div class="pricing-toolbar">
        <div class="pricing-search-box">
          <i class="fa-solid fa-magnifying-glass"></i>
          <input type="text" id="pricing-search" placeholder="SAP No, Malzeme Adı, Fatura No ara..." oninput="window.filterPricingTable(this.value)">
        </div>

        <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
          <!-- Year Filter -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Yıl:</span>
            <div class="pricing-filter-pills" id="year-filter-pills">
              <div class="pricing-pill active" onclick="window.selectPricingYearFilter('ALL', this)">Tümü</div>
              <div class="pricing-pill" onclick="window.selectPricingYearFilter('2026', this)">2026</div>
              <div class="pricing-pill" onclick="window.selectPricingYearFilter('2025', this)">2025</div>
              <div class="pricing-pill" onclick="window.selectPricingYearFilter('2024', this)">2024</div>
            </div>
          </div>

          <!-- Currency Filter -->
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 700; text-transform: uppercase;">Para Birimi:</span>
            <div class="pricing-filter-pills" id="currency-filter-pills">
              <div class="pricing-pill active" onclick="window.selectPricingCurrencyFilter('ALL', this)">Tümü</div>
              <div class="pricing-pill" onclick="window.selectPricingCurrencyFilter('EUR', this)">EUR (€)</div>
              <div class="pricing-pill" onclick="window.selectPricingCurrencyFilter('USD', this)">USD ($)</div>
              <div class="pricing-pill" onclick="window.selectPricingCurrencyFilter('TRY', this)">TRY (₺)</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Pricing Table Container -->
      <div class="pricing-table-container">
        <table class="pricing-table">
          <thead>
            <tr>
              <th style="width: 140px;">SAP NO</th>
              <th>MALZEME AÇIKLAMASI</th>
              <th style="width: 130px; text-align: right;">2024 FİYATI</th>
              <th style="width: 130px; text-align: right;">2025 FİYATI</th>
              <th style="width: 130px; text-align: right;">2026 FİYATI</th>
              <th style="width: 140px; text-align: right;">SON GÜNCEL FİYAT</th>
              <th style="width: 130px; text-align: right;">ORTALAMA</th>
              <th style="width: 140px; text-align: center;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="pricing-table-tbody">
            <tr>
              <td colspan="8" style="padding: 4rem; text-align: center; color: #64748b;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00f3ff; margin-bottom: 1rem; display: block;"></i>
                Fiyat listesi yükleniyor, lütfen bekleyin...
              </td>
            </tr>
          </tbody>
        </table>

        <div id="pricing-pagination-container" style="padding: 1rem 1.25rem; background: rgba(2, 6, 23, 0.9); border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
        </div>
      </div>

    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL 1: YENİ FİYAT / PARTİ GİRİŞİ                      -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="pricing-modal-overlay" id="price-entry-modal">
      <div class="pricing-modal">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
          <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #00f3ff; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-tag"></i> <span id="price-modal-title">Yeni Fiyat / Parti Girişi</span>
          </h2>
          <button onclick="window.closePriceModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <form id="price-entry-form" onsubmit="window.handlePriceFormSubmit(event)">
          <input type="hidden" id="form-price-id" value="">

          <!-- SAP Arama & Otomatik Tamamlama -->
          <div class="pricing-form-group" style="position: relative;">
            <label class="pricing-form-label">SAP Malzeme No <span style="color: #ef4444;">*</span></label>
            <input type="text" id="form-sap-no" class="pricing-form-input" placeholder="SAP No veya malzeme adı yazın..." required autocomplete="off" oninput="window.handleSapAutocomplete(this.value)">
            <div id="sap-autocomplete-dropdown" class="sap-autocomplete-dropdown"></div>
          </div>

          <div class="pricing-form-group">
            <label class="pricing-form-label">Malzeme Açıklaması <span style="color: #ef4444;">*</span></label>
            <input type="text" id="form-sap-desc" class="pricing-form-input" placeholder="Malzeme adı ve teknik tanımı" required>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="pricing-form-group">
              <label class="pricing-form-label">Alış / Geliş Yılı <span style="color: #ef4444;">*</span></label>
              <select id="form-price-year" class="pricing-form-select" required>
                <option value="2026" selected>2026</option>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
              </select>
            </div>

            <div class="pricing-form-group">
              <label class="pricing-form-label">Giriş / Fatura Tarihi</label>
              <input type="date" id="form-price-date" class="pricing-form-input">
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 1rem;">
            <div class="pricing-form-group">
              <label class="pricing-form-label">Birim Fiyat <span style="color: #ef4444;">*</span></label>
              <input type="number" step="0.01" min="0" id="form-price-amount" class="pricing-form-input" placeholder="0.00" required>
            </div>

            <div class="pricing-form-group">
              <label class="pricing-form-label">Para Birimi <span style="color: #ef4444;">*</span></label>
              <select id="form-price-currency" class="pricing-form-select" required>
                <option value="EUR" selected>EUR (€)</option>
                <option value="USD">USD ($)</option>
                <option value="TRY">TRY (₺)</option>
              </select>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div class="pricing-form-group">
              <label class="pricing-form-label">Giriş Miktarı (Adet/Birim)</label>
              <input type="number" step="1" min="1" id="form-price-qty" class="pricing-form-input" placeholder="Örn: 10">
            </div>

            <div class="pricing-form-group">
              <label class="pricing-form-label">Fatura / İrsaliye / Satın Alma No</label>
              <input type="text" id="form-price-invoice" class="pricing-form-input" placeholder="Örn: FT-2026-004">
            </div>
          </div>

          <div class="pricing-form-group">
            <label class="pricing-form-label">Tedarikçi / Not</label>
            <input type="text" id="form-price-note" class="pricing-form-input" placeholder="Tedarikçi adı veya ek açıklama">
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 2rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
            <button type="button" onclick="window.closePriceModal()" class="btn-pricing btn-pricing-secondary">İPTAL</button>
            <button type="submit" id="btn-save-price" class="btn-pricing btn-pricing-primary">
              <i class="fa-solid fa-floppy-disk"></i> FİYATI KAYDET
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL 2: MALZEME FİYAT GEÇMİŞİ & PARTİ DETAYI           -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="pricing-modal-overlay" id="price-history-modal">
      <div class="pricing-modal" style="max-width: 850px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span id="history-modal-sap" style="font-size: 1.3rem; font-weight: 900; color: #00f3ff; font-family: monospace;">-</span>
              <span id="history-modal-currency-badge" class="badge-year-price badge-2026">EUR</span>
            </div>
            <h3 id="history-modal-desc" style="margin: 4px 0 0; color: #fff; font-size: 1.1rem; font-weight: 700;">-</h3>
          </div>
          <button onclick="window.closePriceHistoryModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="max-height: 450px; overflow-y: auto;">
          <table class="pricing-table" style="background: rgba(0,0,0,0.3); border-radius: 12px;">
            <thead>
              <tr>
                <th>YIL / TARİH</th>
                <th>BİRİM FİYAT</th>
                <th>MİKTAR</th>
                <th>FATURA NO</th>
                <th>KAYDEDEN</th>
                <th style="text-align: center;">İŞLEM</th>
              </tr>
            </thead>
            <tbody id="history-table-tbody">
            </tbody>
          </table>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
          <button onclick="window.addPriceForCurrentHistorySap()" class="btn-pricing btn-pricing-primary" style="font-size: 0.8rem;">
            <i class="fa-solid fa-plus"></i> BU MALZEMEYE YENİ YIL FİYATI EKLE
          </button>
          <button onclick="window.closePriceHistoryModal()" class="btn-pricing btn-pricing-secondary">KAPAT</button>
        </div>
      </div>
    </div>

    <!-- ═══════════════════════════════════════════════════════ -->
    <!-- MODAL 3: EXCEL İLE TOPLU FİYAT YÜKLEME                  -->
    <!-- ═══════════════════════════════════════════════════════ -->
    <div class="pricing-modal-overlay" id="excel-import-modal">
      <div class="pricing-modal" style="max-width: 800px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem;">
          <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #10b981; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-excel"></i> Excel ile Toplu Fiyat Yükleme
          </h2>
          <button onclick="window.closeExcelImportModal()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 12px; padding: 1rem; margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <div>
              <strong style="color: #10b981; font-size: 0.9rem;">📌 Nasıl Yüklenir?</strong>
              <p style="margin: 4px 0 0; font-size: 0.8rem; color: #94a3b8;">
                Excel dosyanızda şu sütun başlıkları yer almalıdır: <code>SAP_NO</code>, <code>TANIM</code>, <code>YIL</code>, <code>FIYAT</code>, <code>PARA_BIRIMI</code> (EUR/USD/TRY), <code>FATURA_NO</code>
              </p>
            </div>
            <button onclick="window.downloadPriceExcelTemplate()" class="btn-pricing btn-pricing-secondary" style="font-size: 0.75rem; padding: 6px 12px;">
              <i class="fa-solid fa-download"></i> ŞABLON EXCEL İNDİR
            </button>
          </div>
        </div>

        <div style="border: 2px dashed rgba(0, 243, 255, 0.3); border-radius: 16px; padding: 2.5rem 1.5rem; text-align: center; background: rgba(0,0,0,0.2); cursor: pointer; transition: all 0.2s;" onclick="document.getElementById('excel-file-input').click()" id="excel-dropzone">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size: 3rem; color: #00f3ff; margin-bottom: 1rem;"></i>
          <h4 style="margin: 0 0 6px; font-size: 1.1rem; color: #fff;">Excel Dosyasını Buraya Sürükleyin veya Tıklayın</h4>
          <p style="margin: 0; font-size: 0.8rem; color: #64748b;">Desteklenen formatlar: .xlsx, .xls</p>
          <input type="file" id="excel-file-input" accept=".xlsx, .xls" style="display: none;" onchange="window.handleExcelFileUpload(event)">
        </div>

        <!-- Excel Preview Table -->
        <div id="excel-preview-area" style="display: none; margin-top: 1.5rem;">
          <h4 style="margin: 0 0 10px; font-size: 0.95rem; color: #34d399; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-check-double"></i> Yüklenecek Kayıtlar (<span id="excel-preview-count">0</span> Adet)</span>
          </h4>
          <div style="max-height: 250px; overflow-y: auto; background: rgba(0,0,0,0.4); border-radius: 10px; border: 1px solid rgba(255,255,255,0.06);">
            <table class="pricing-table" style="font-size: 0.8rem;">
              <thead>
                <tr>
                  <th>SAP NO</th>
                  <th>TANIM</th>
                  <th>YIL</th>
                  <th>FİYAT</th>
                  <th>BİRİM</th>
                  <th>FATURA NO</th>
                </tr>
              </thead>
              <tbody id="excel-preview-tbody">
              </tbody>
            </table>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 1.5rem; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1.25rem;">
          <button type="button" onclick="window.closeExcelImportModal()" class="btn-pricing btn-pricing-secondary">İPTAL</button>
          <button type="button" id="btn-confirm-excel-import" onclick="window.saveExcelImportedPrices()" class="btn-pricing btn-pricing-primary" disabled style="opacity: 0.5;">
            <i class="fa-solid fa-cloud-arrow-up"></i> VERİLERİ SİSTEME KAYDET
          </button>
        </div>
      </div>
    </div>
  `;
};

// Global state for MaterialPricingPage
let allGroupedPrices: GroupedMaterialPrice[] = [];
let allRawPrices: MaterialPriceEntry[] = [];
let filteredGroupedPrices: GroupedMaterialPrice[] = [];
let currentYearFilter = 'ALL';
let currentCurrencyFilter = 'ALL';
let currentSearchTerm = '';
let currentPricingPage = 1;
const itemsPerPage = 30;
let parsedExcelEntries: any[] = [];
let activeHistorySap = '';

// Initialize Material Pricing Page Events
(window as any).initMaterialPricing = async () => {
  await (window as any).refreshPricingTable(false);
};

(window as any).refreshPricingTable = async (forceRefresh = false) => {
  const tbody = document.getElementById('pricing-table-tbody');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 4rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-spinner fa-spin" style="font-size: 2rem; color: #00f3ff; margin-bottom: 1rem; display: block;"></i>
          Fiyat listesi yükleniyor, lütfen bekleyin...
        </td>
      </tr>
    `;
  }

  try {
    const [raw, grouped] = await Promise.all([
      priceService.getAllPrices(forceRefresh),
      priceService.getGroupedPrices(forceRefresh)
    ]);

    allRawPrices = raw;
    allGroupedPrices = grouped;

    // Update Stats
    const statTotal = document.getElementById('stat-total-items');
    const stat2026 = document.getElementById('stat-2026-count');
    const stat2025 = document.getElementById('stat-2025-count');
    const stat2024 = document.getElementById('stat-2024-count');

    if (statTotal) statTotal.innerText = allGroupedPrices.length.toLocaleString('tr-TR');
    if (stat2026) stat2026.innerText = allRawPrices.filter(p => p.year === 2026).length.toLocaleString('tr-TR');
    if (stat2025) stat2025.innerText = allRawPrices.filter(p => p.year === 2025).length.toLocaleString('tr-TR');
    if (stat2024) stat2024.innerText = allRawPrices.filter(p => p.year === 2024).length.toLocaleString('tr-TR');

    (window as any).applyPricingFilters();
  } catch (e) {
    console.error('[MaterialPricing] Error loading table:', e);
    if (tbody) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding: 2rem; text-align: center; color: #ef4444;">Fiyatlar yüklenirken bir hata oluştu.</td></tr>`;
    }
  }
};

(window as any).filterPricingTable = (term: string) => {
  currentSearchTerm = (term || '').toLowerCase().trim();
  currentPricingPage = 1;
  (window as any).applyPricingFilters();
};

(window as any).selectPricingYearFilter = (year: string, el: HTMLElement) => {
  currentYearFilter = year;
  document.querySelectorAll('#year-filter-pills .pricing-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  currentPricingPage = 1;
  (window as any).applyPricingFilters();
};

(window as any).selectPricingCurrencyFilter = (curr: string, el: HTMLElement) => {
  currentCurrencyFilter = curr;
  document.querySelectorAll('#currency-filter-pills .pricing-pill').forEach(p => p.classList.remove('active'));
  if (el) el.classList.add('active');
  currentPricingPage = 1;
  (window as any).applyPricingFilters();
};

(window as any).applyPricingFilters = () => {
  filteredGroupedPrices = allGroupedPrices.filter(item => {
    // Search match
    if (currentSearchTerm) {
      const sap = item.sapNo.toLowerCase();
      const desc = item.description.toLowerCase();
      const hasInvoiceMatch = item.allEntries.some(e => (e.invoiceNo || '').toLowerCase().includes(currentSearchTerm));
      if (!sap.includes(currentSearchTerm) && !desc.includes(currentSearchTerm) && !hasInvoiceMatch) {
        return false;
      }
    }

    // Year match
    if (currentYearFilter !== 'ALL') {
      const y = Number(currentYearFilter);
      if (!item.pricesByYear[y]) return false;
    }

    // Currency match
    if (currentCurrencyFilter !== 'ALL') {
      const hasCurrency = item.allEntries.some(e => e.currency === currentCurrencyFilter);
      if (!hasCurrency) return false;
    }

    return true;
  });

  (window as any).renderPricingTableRows();
};

(window as any).renderPricingTableRows = () => {
  const tbody = document.getElementById('pricing-table-tbody');
  const paginationContainer = document.getElementById('pricing-pagination-container');
  if (!tbody) return;

  const totalItems = filteredGroupedPrices.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;

  if (currentPricingPage > totalPages) currentPricingPage = totalPages;
  if (currentPricingPage < 1) currentPricingPage = 1;

  const startIndex = (currentPricingPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const paginated = filteredGroupedPrices.slice(startIndex, endIndex);

  if (paginated.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="padding: 3rem; text-align: center; color: #64748b;">
          <i class="fa-solid fa-box-open" style="font-size: 2.5rem; opacity: 0.3; margin-bottom: 0.75rem; display: block;"></i>
          Kriterlere uygun fiyatlandırılmış malzeme bulunamadı.
        </td>
      </tr>
    `;
    if (paginationContainer) paginationContainer.innerHTML = '';
    return;
  }

  const formatPrice = (entry?: MaterialPriceEntry) => {
    if (!entry || entry.price === undefined || entry.price === null) {
      return '<span class="badge-none">-</span>';
    }
    const symbol = entry.currency === 'EUR' ? '€' : (entry.currency === 'USD' ? '$' : '₺');
    const badgeClass = entry.year === 2026 ? 'badge-2026' : (entry.year === 2025 ? 'badge-2025' : 'badge-2024');
    return `
      <span class="badge-year-price ${badgeClass}" title="${entry.entryDate || ''} ${entry.invoiceNo ? 'Fatura: ' + entry.invoiceNo : ''}">
        ${entry.price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${symbol}
      </span>
    `;
  };

  tbody.innerHTML = paginated.map(item => {
    const p2024 = item.pricesByYear[2024];
    const p2025 = item.pricesByYear[2025];
    const p2026 = item.pricesByYear[2026];
    const latest = item.latestEntry;
    const currSymbol = item.primaryCurrency === 'EUR' ? '€' : (item.primaryCurrency === 'USD' ? '$' : '₺');

    return `
      <tr>
        <td>
          <div style="font-family: monospace; font-weight: 800; font-size: 0.95rem; color: #00f3ff;">
            ${item.sapNo}
          </div>
        </td>
        <td>
          <div style="font-weight: 700; color: #fff;">${item.description || '-'}</div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 2px;">
            ${item.allEntries.length} adet fiyat kaydı ${latest?.invoiceNo ? '• Son Fat: ' + latest.invoiceNo : ''}
          </div>
        </td>
        <td style="text-align: right;">${formatPrice(p2024)}</td>
        <td style="text-align: right;">${formatPrice(p2025)}</td>
        <td style="text-align: right;">${formatPrice(p2026)}</td>
        <td style="text-align: right;">
          <div style="font-weight: 900; font-size: 0.95rem; color: #38bdf8;">
            ${latest ? `${latest.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${latest.currency === 'EUR' ? '€' : (latest.currency === 'USD' ? '$' : '₺')}` : '-'}
          </div>
          <div style="font-size: 0.7rem; color: #94a3b8;">${latest ? `(${latest.year})` : ''}</div>
        </td>
        <td style="text-align: right;">
          <div style="font-weight: 800; color: #f59e0b;">
            ${item.averagePrice ? `${item.averagePrice.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${currSymbol}` : '-'}
          </div>
          <div style="font-size: 0.68rem; color: #64748b;">Ortalama</div>
        </td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 6px; justify-content: center;">
            <button onclick="window.viewSapPriceHistory('${item.sapNo}')" class="btn-pricing btn-pricing-secondary" style="padding: 5px 9px; font-size: 0.75rem;" title="Fiyat Geçmişi & Parti Detayları">
              <i class="fa-solid fa-list-ul"></i>
            </button>
            <button onclick="window.quickAddYearPrice('${item.sapNo}', '${item.description.replace(/'/g, "\\'")}')" class="btn-pricing btn-pricing-primary" style="padding: 5px 9px; font-size: 0.75rem;" title="Yeni Yıl Fiyatı Ekle">
              <i class="fa-solid fa-plus"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  if (paginationContainer) {
    paginationContainer.innerHTML = `
      <div style="color: #94a3b8; font-size: 0.82rem;">
        <span>${totalItems} kayıt arasından <strong>${startIndex + 1}-${endIndex}</strong> arası gösteriliyor</span>
      </div>
      <div style="display: flex; align-items: center; gap: 6px;">
        <button onclick="window.changePricingPage(1)" ${currentPricingPage === 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} class="btn-pricing btn-pricing-secondary" style="padding: 4px 8px; font-size: 0.75rem;">
          <i class="fa-solid fa-angles-left"></i>
        </button>
        <button onclick="window.changePricingPage(${currentPricingPage - 1})" ${currentPricingPage === 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} class="btn-pricing btn-pricing-secondary" style="padding: 4px 8px; font-size: 0.75rem;">
          <i class="fa-solid fa-angle-left"></i>
        </button>
        <span style="color: #fff; font-size: 0.85rem; padding: 0 0.5rem; font-weight: 700;">Sayfa ${currentPricingPage} / ${totalPages}</span>
        <button onclick="window.changePricingPage(${currentPricingPage + 1})" ${currentPricingPage === totalPages ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} class="btn-pricing btn-pricing-secondary" style="padding: 4px 8px; font-size: 0.75rem;">
          <i class="fa-solid fa-angle-right"></i>
        </button>
        <button onclick="window.changePricingPage(${totalPages})" ${currentPricingPage === totalPages ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''} class="btn-pricing btn-pricing-secondary" style="padding: 4px 8px; font-size: 0.75rem;">
          <i class="fa-solid fa-angles-right"></i>
        </button>
      </div>
    `;
  }
};

(window as any).changePricingPage = (page: number) => {
  currentPricingPage = page;
  (window as any).renderPricingTableRows();
};

// Modal Operations
(window as any).openPriceModal = (entry?: Partial<MaterialPriceEntry>) => {
  const modal = document.getElementById('price-entry-modal');
  const title = document.getElementById('price-modal-title');
  const formId = document.getElementById('form-price-id') as HTMLInputElement;
  const sapInput = document.getElementById('form-sap-no') as HTMLInputElement;
  const descInput = document.getElementById('form-sap-desc') as HTMLInputElement;
  const yearSelect = document.getElementById('form-price-year') as HTMLSelectElement;
  const dateInput = document.getElementById('form-price-date') as HTMLInputElement;
  const amountInput = document.getElementById('form-price-amount') as HTMLInputElement;
  const currSelect = document.getElementById('form-price-currency') as HTMLSelectElement;
  const qtyInput = document.getElementById('form-price-qty') as HTMLInputElement;
  const invoiceInput = document.getElementById('form-price-invoice') as HTMLInputElement;
  const noteInput = document.getElementById('form-price-note') as HTMLInputElement;

  if (formId) formId.value = entry?.id || '';
  if (sapInput) sapInput.value = entry?.sapNo || '';
  if (descInput) descInput.value = entry?.description || '';
  if (yearSelect) yearSelect.value = String(entry?.year || new Date().getFullYear());
  if (dateInput) dateInput.value = entry?.entryDate || new Date().toISOString().split('T')[0];
  if (amountInput) amountInput.value = entry?.price !== undefined ? String(entry.price) : '';
  if (currSelect) currSelect.value = entry?.currency || 'EUR';
  if (qtyInput) qtyInput.value = entry?.quantity !== undefined ? String(entry.quantity) : '1';
  if (invoiceInput) invoiceInput.value = entry?.invoiceNo || '';
  if (noteInput) noteInput.value = entry?.note || '';

  if (title) {
    title.innerText = entry?.id ? 'Fiyat Kaydını Düzenle' : 'Yeni Fiyat / Parti Girişi';
  }

  if (modal) modal.classList.add('open');
};

(window as any).closePriceModal = () => {
  const modal = document.getElementById('price-entry-modal');
  if (modal) modal.classList.remove('open');
  const dropdown = document.getElementById('sap-autocomplete-dropdown');
  if (dropdown) dropdown.style.display = 'none';
};

(window as any).quickAddYearPrice = (sapNo: string, description: string) => {
  (window as any).openPriceModal({
    sapNo,
    description,
    year: new Date().getFullYear(),
    currency: 'EUR'
  });
};

(window as any).handleSapAutocomplete = async (val: string) => {
  const dropdown = document.getElementById('sap-autocomplete-dropdown');
  if (!dropdown) return;

  const term = (val || '').toLowerCase().trim();
  if (term.length < 2) {
    dropdown.style.display = 'none';
    return;
  }

  // Use global materials if available
  let materials: any[] = (window as any).materialsList || [];
  if (materials.length === 0) {
    try {
      const resp = await fetch('/sap_dictionary.json');
      if (resp.ok) {
        materials = await resp.json();
        (window as any).materialsList = materials;
      }
    } catch (e) {}
  }

  const matches = materials.filter((m: any) => {
    const sap = String(m.sapNo || m.SAP_NO || '').toLowerCase();
    const desc = String(m.description || m.TANIM || '').toLowerCase();
    return sap.includes(term) || desc.includes(term);
  }).slice(0, 10);

  if (matches.length === 0) {
    dropdown.style.display = 'none';
    return;
  }

  dropdown.innerHTML = matches.map((m: any) => {
    const sap = m.sapNo || m.SAP_NO;
    const desc = (m.description || m.TANIM || '').replace(/'/g, "\\'");
    return `
      <div class="sap-autocomplete-item" onclick="window.selectSapAutocomplete('${sap}', '${desc}')">
        <strong style="color: #00f3ff; font-family: monospace;">${sap}</strong> - ${m.description || m.TANIM}
      </div>
    `;
  }).join('');
  dropdown.style.display = 'block';
};

(window as any).selectSapAutocomplete = (sapNo: string, description: string) => {
  const sapInput = document.getElementById('form-sap-no') as HTMLInputElement;
  const descInput = document.getElementById('form-sap-desc') as HTMLInputElement;
  const dropdown = document.getElementById('sap-autocomplete-dropdown');

  if (sapInput) sapInput.value = sapNo;
  if (descInput) descInput.value = description;
  if (dropdown) dropdown.style.display = 'none';
};

(window as any).handlePriceFormSubmit = async (e: Event) => {
  e.preventDefault();
  const btn = document.getElementById('btn-save-price') as HTMLButtonElement;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';
    btn.disabled = true;
  }

  try {
    const formId = (document.getElementById('form-price-id') as HTMLInputElement)?.value;
    const sapNo = (document.getElementById('form-sap-no') as HTMLInputElement)?.value;
    const description = (document.getElementById('form-sap-desc') as HTMLInputElement)?.value;
    const year = Number((document.getElementById('form-price-year') as HTMLSelectElement)?.value) || new Date().getFullYear();
    const entryDate = (document.getElementById('form-price-date') as HTMLInputElement)?.value;
    const price = Number((document.getElementById('form-price-amount') as HTMLInputElement)?.value) || 0;
    const currency = ((document.getElementById('form-price-currency') as HTMLSelectElement)?.value || 'EUR') as any;
    const quantity = Number((document.getElementById('form-price-qty') as HTMLInputElement)?.value) || 1;
    const invoiceNo = (document.getElementById('form-price-invoice') as HTMLInputElement)?.value;
    const note = (document.getElementById('form-price-note') as HTMLInputElement)?.value;

    const currentUser = (window as any).currentUser || authService.getCurrentUser();

    await priceService.savePriceEntry({
      sapNo,
      description,
      year,
      entryDate,
      price,
      currency,
      quantity,
      invoiceNo,
      note,
      createdByName: currentUser?.displayName || currentUser?.email || 'Yetkili',
      createdByEmail: currentUser?.email || ''
    }, formId || undefined);

    (window as any).closePriceModal();
    await (window as any).refreshPricingTable(true);
    alert("Fiyat kaydı başarıyla sisteme kaydedildi!");
  } catch (err) {
    console.error("Save price error", err);
    alert("Fiyat kaydedilirken hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

// Price History Modal
(window as any).viewSapPriceHistory = (sapNo: string) => {
  activeHistorySap = sapNo;
  const item = allGroupedPrices.find(g => g.sapNo.toUpperCase() === sapNo.toUpperCase());
  if (!item) return;

  const modal = document.getElementById('price-history-modal');
  const sapSpan = document.getElementById('history-modal-sap');
  const descH3 = document.getElementById('history-modal-desc');
  const currBadge = document.getElementById('history-modal-currency-badge');
  const tbody = document.getElementById('history-table-tbody');

  if (sapSpan) sapSpan.innerText = item.sapNo;
  if (descH3) descH3.innerText = item.description || 'Tanım Belirtilmemiş';
  if (currBadge) currBadge.innerText = item.primaryCurrency || 'EUR';

  if (tbody) {
    if (item.allEntries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: #64748b;">Kayıtlı fiyat geçmişi bulunamadı.</td></tr>`;
    } else {
      tbody.innerHTML = item.allEntries.map(entry => {
        const symbol = entry.currency === 'EUR' ? '€' : (entry.currency === 'USD' ? '$' : '₺');
        return `
          <tr>
            <td>
              <span class="badge-year-price ${entry.year === 2026 ? 'badge-2026' : (entry.year === 2025 ? 'badge-2025' : 'badge-2024')}">
                ${entry.year}
              </span>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 2px;">${entry.entryDate || '-'}</div>
            </td>
            <td>
              <strong style="color: #38bdf8; font-size: 0.95rem;">
                ${entry.price.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} ${symbol}
              </strong>
            </td>
            <td>${entry.quantity !== undefined ? entry.quantity + ' Adet' : '-'}</td>
            <td>
              <div>${entry.invoiceNo || '-'}</div>
              ${entry.supplier ? `<div style="font-size: 0.72rem; color: #64748b;">${entry.supplier}</div>` : ''}
            </td>
            <td>
              <div style="font-size: 0.8rem; color: #94a3b8;">${entry.createdByName || '-'}</div>
              ${entry.note ? `<div style="font-size: 0.72rem; color: #f59e0b;">${entry.note}</div>` : ''}
            </td>
            <td style="text-align: center;">
              <button onclick="window.deletePriceEntryConfirm('${entry.id}')" class="btn-pricing" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; padding: 4px 8px; font-size: 0.75rem;" title="Kaydı Sil">
                <i class="fa-solid fa-trash"></i>
              </button>
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (modal) modal.classList.add('open');
};

(window as any).closePriceHistoryModal = () => {
  const modal = document.getElementById('price-history-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).addPriceForCurrentHistorySap = () => {
  const item = allGroupedPrices.find(g => g.sapNo.toUpperCase() === activeHistorySap.toUpperCase());
  (window as any).closePriceHistoryModal();
  (window as any).openPriceModal({
    sapNo: activeHistorySap,
    description: item?.description || '',
    year: new Date().getFullYear(),
    currency: item?.primaryCurrency || 'EUR'
  });
};

(window as any).deletePriceEntryConfirm = async (id: string) => {
  if (!confirm("Bu fiyat kaydını kalıcı olarak silmek istediğinizden emin misiniz?")) return;

  try {
    await priceService.deletePriceEntry(id);
    await (window as any).refreshPricingTable(true);
    (window as any).closePriceHistoryModal();
    alert("Fiyat kaydı silindi.");
  } catch (e) {
    alert("Fiyat silinirken hata oluştu: " + e);
  }
};

// Excel Import Operations
(window as any).openExcelImportModal = () => {
  const modal = document.getElementById('excel-import-modal');
  parsedExcelEntries = [];
  const previewArea = document.getElementById('excel-preview-area');
  const confirmBtn = document.getElementById('btn-confirm-excel-import') as HTMLButtonElement;

  if (previewArea) previewArea.style.display = 'none';
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.style.opacity = '0.5';
  }

  if (modal) modal.classList.add('open');
};

(window as any).closeExcelImportModal = () => {
  const modal = document.getElementById('excel-import-modal');
  if (modal) modal.classList.remove('open');
};

(window as any).downloadPriceExcelTemplate = () => {
  const templateData = [
    {
      SAP_NO: "1002345",
      TANIM: "RULMAN 6312-2Z C3",
      YIL: 2026,
      FIYAT: 175.50,
      PARA_BIRIMI: "EUR",
      MIKTAR: 10,
      FATURA_NO: "FT-2026-001",
      TEDARIKCI: "SKF Rulman",
      NOT: "2026 Alımı"
    },
    {
      SAP_NO: "1005421",
      TANIM: "BASINÇ TRANSDUSERI 0-10 BAR",
      YIL: 2025,
      FIYAT: 85.00,
      PARA_BIRIMI: "EUR",
      MIKTAR: 5,
      FATURA_NO: "FT-2025-089",
      TEDARIKCI: "Wika",
      NOT: "2025 Revizyon"
    }
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Fiyat_Sablonu");
  XLSX.writeFile(wb, "SAP_Fiyat_Yukleme_Sablonu.xlsx");
};

(window as any).handleExcelFileUpload = async (event: any) => {
  const file = event.target.files?.[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e: any) => {
    try {
      const data = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const rawRows: any[] = XLSX.utils.sheet_to_json(firstSheet);

      if (rawRows.length === 0) {
        alert("Excel dosyası boş veya okunamadı!");
        return;
      }

      parsedExcelEntries = rawRows.map(row => {
        const sap = String(row.SAP_NO || row.SAP || row.sap_no || row.sap || '').trim();
        const desc = String(row.TANIM || row.MALZEME_TANIMI || row.description || row.Aciklama || '').trim();
        const year = Number(row.YIL || row.year) || new Date().getFullYear();
        const price = Number(row.FIYAT || row.Birim_Fiyat || row.price) || 0;
        let curr = String(row.PARA_BIRIMI || row.Birim || row.currency || 'EUR').toUpperCase().trim();
        if (curr === 'TL' || curr === 'TL (₺)') curr = 'TRY';

        return {
          sapNo: sap,
          description: desc,
          year,
          price,
          currency: curr as any,
          quantity: Number(row.MIKTAR || row.quantity) || 1,
          invoiceNo: String(row.FATURA_NO || row.invoiceNo || '').trim(),
          supplier: String(row.TEDARIKCI || row.supplier || '').trim(),
          note: String(row.NOT || row.note || '').trim()
        };
      }).filter(item => item.sapNo && item.price > 0);

      const previewArea = document.getElementById('excel-preview-area');
      const previewTbody = document.getElementById('excel-preview-tbody');
      const countSpan = document.getElementById('excel-preview-count');
      const confirmBtn = document.getElementById('btn-confirm-excel-import') as HTMLButtonElement;

      if (countSpan) countSpan.innerText = String(parsedExcelEntries.length);

      if (previewTbody) {
        previewTbody.innerHTML = parsedExcelEntries.slice(0, 50).map(item => `
          <tr>
            <td style="font-family: monospace; color: #00f3ff;">${item.sapNo}</td>
            <td>${item.description || '-'}</td>
            <td><span class="badge-year-price badge-2026">${item.year}</span></td>
            <td style="color: #38bdf8; font-weight: 700;">${item.price.toFixed(2)}</td>
            <td>${item.currency}</td>
            <td>${item.invoiceNo || '-'}</td>
          </tr>
        `).join('');
      }

      if (previewArea) previewArea.style.display = 'block';
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.style.opacity = '1';
      }
    } catch (err) {
      console.error("Excel parse error", err);
      alert("Excel dosyası işlenirken hata oluştu: " + err);
    }
  };
  reader.readAsArrayBuffer(file);
};

(window as any).saveExcelImportedPrices = async () => {
  if (parsedExcelEntries.length === 0) return;

  const btn = document.getElementById('btn-confirm-excel-import') as HTMLButtonElement;
  const originalHtml = btn ? btn.innerHTML : '';
  if (btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> AKTARILIYOR...';
    btn.disabled = true;
  }

  try {
    const currentUser = (window as any).currentUser || authService.getCurrentUser();
    const formatted = parsedExcelEntries.map(e => ({
      ...e,
      createdByName: currentUser?.displayName || currentUser?.email || 'Excel İçe Aktarım',
      createdByEmail: currentUser?.email || ''
    }));

    const saved = await priceService.batchSavePrices(formatted);
    (window as any).closeExcelImportModal();
    await (window as any).refreshPricingTable(true);
    alert(`Başarılı! Toplam ${saved} adet SAP fiyat kaydı sisteme aktarıldı.`);
  } catch (err) {
    console.error("Batch save error", err);
    alert("Toplu kayıt sırasında hata oluştu: " + err);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }
  }
};

(window as any).exportPricesToExcel = () => {
  if (allGroupedPrices.length === 0) {
    alert("Dışa aktarılacak fiyat kaydı bulunamadı!");
    return;
  }

  const exportData = allGroupedPrices.map(item => {
    const p2024 = item.pricesByYear[2024];
    const p2025 = item.pricesByYear[2025];
    const p2026 = item.pricesByYear[2026];
    const latest = item.latestEntry;

    return {
      SAP_NO: item.sapNo,
      MALZEME_TANIMI: item.description,
      FIYAT_2024: p2024 ? p2024.price : '',
      BIRIM_2024: p2024 ? p2024.currency : '',
      FIYAT_2025: p2025 ? p2025.price : '',
      BIRIM_2025: p2025 ? p2025.currency : '',
      FIYAT_2026: p2026 ? p2026.price : '',
      BIRIM_2026: p2026 ? p2026.currency : '',
      SON_GUNCEL_FIYAT: latest ? latest.price : '',
      SON_GUNCEL_BIRIM: latest ? latest.currency : '',
      SON_ALIS_YILI: latest ? latest.year : '',
      ORTALAMA_FIYAT: item.averagePrice || '',
      KAYIT_SAYISI: item.allEntries.length
    };
  });

  const ws = XLSX.utils.json_to_sheet(exportData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "SAP_Fiyat_Listesi");
  XLSX.writeFile(wb, `DH_Servis_SAP_Fiyat_Listesi_${new Date().toISOString().split('T')[0]}.xlsx`);
};
