import { kkdService } from '../services/KkdService';
import type { KkdItem, KkdInspection } from '../services/KkdService';
import { qrService } from '../services/QRService';
import { fileService } from '../services/FileService';
import * as XLSX from 'xlsx';

// Preset local datasheets mapping
const DATASHEETS: Record<string, { name: string, path: string }[]> = {
  'SKYSAFE': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/L-0568/L-0568-1,8_vekat3_en.pdf' },
    { name: 'Kullanım Koşulları', path: '/KKD/L-0568/L-0568-1,8_conds_00_en.pdf' }
  ],
  'L-0568': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/L-0568/L-0568-1,8_vekat3_en.pdf' },
    { name: 'Kullanım Koşulları', path: '/KKD/L-0568/L-0568-1,8_conds_00_en.pdf' }
  ],
  'IGNITE': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/G 1132 WSST MXXL/G-1132-WS-ST-M_vekat3_en.pdf' },
    { name: 'Kullanım Kılavuzu', path: '/KKD/G 1132 WSST MXXL/MAT-BA-0135-02_manual_01_web.pdf' },
    { name: 'Koşullar', path: '/KKD/G 1132 WSST MXXL/G-1132-WS-ST-M{002F}XXL_conds_00_en.pdf' }
  ],
  'G-1132': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/G 1132 WSST MXXL/G-1132-WS-ST-M_vekat3_en.pdf' },
    { name: 'Kullanım Kılavuzu', path: '/KKD/G 1132 WSST MXXL/MAT-BA-0135-02_manual_01_web.pdf' },
    { name: 'Koşullar', path: '/KKD/G 1132 WSST MXXL/G-1132-WS-ST-M{002F}XXL_conds_00_en.pdf' }
  ],
  'L-0559': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/L-0559/L-0559-1,8_vekat3_en.pdf' },
    { name: 'Kullanım Kılavuzu', path: '/KKD/L-0559/MAT-BA-0144_manual_01_web.pdf' }
  ],
  'L-0566': [
    { name: 'Teknik Bilgi Fişi (Vekat3)', path: '/KKD/L-0566-1,8/L-0566-1,8_vekat3_en.pdf' },
    { name: 'Kullanım Koşulları', path: '/KKD/L-0566-1,8/L-0566-1,8_conds_00_en.pdf' }
  ]
};

// Lifespan calculation (Standard 10 years for safety equipment)
export function getLifespanInfo(manufactureDateStr: string, lifespanYears = 10) {
  if (!manufactureDateStr) return { expired: false, text: 'Girilmedi', class: 'text-muted', percent: 100 };
  
  try {
    const today = new Date();
    const mfg = new Date(manufactureDateStr);
    if (isNaN(mfg.getTime())) return { expired: false, text: 'Geçersiz Tarih', class: 'text-muted', percent: 100 };

    const expiry = new Date(mfg.getFullYear() + lifespanYears, mfg.getMonth(), mfg.getDate());
    const remainingMs = expiry.getTime() - today.getTime();
    
    if (remainingMs <= 0) {
      return { 
        expired: true, 
        text: `ÖMRÜ DOLDU (${lifespanYears} Yıl)`, 
        class: 'expired-badge', 
        percent: 0,
        expiryDate: expiry.toISOString().split('T')[0]
      };
    }

    const totalMs = lifespanYears * 365.25 * 24 * 60 * 60 * 1000;
    const percent = Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100)));

    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    const years = Math.floor(remainingDays / 365);
    const months = Math.floor((remainingDays % 365) / 30);
    
    let timeText = '';
    if (years > 0) timeText += `${years} Yıl `;
    if (months > 0 || years === 0) timeText += `${months} Ay`;
    if (timeText === '') timeText = `${remainingDays} Gün`;

    let colorClass = 'lifespan-ok';
    if (percent < 20) {
      colorClass = 'lifespan-critical';
    } else if (percent < 50) {
      colorClass = 'lifespan-warning';
    }

    return { 
      expired: false, 
      text: `${timeText} Kaldı`, 
      class: colorClass, 
      percent,
      expiryDate: expiry.toISOString().split('T')[0]
    };
  } catch (e) {
    return { expired: false, text: 'Hata', class: 'text-muted', percent: 100 };
  }
}

export const KkdControlPage = async () => {
  return `
    <style>
      .kkd-container {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
        padding-bottom: 120px;
      }
      .kkd-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        flex-wrap: wrap;
        gap: 1.5rem;
        margin-bottom: 2rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 1.2rem;
      }
      .kkd-title-group h1 {
        font-size: 2rem;
        font-weight: 800;
        color: var(--text-main);
        margin: 0;
        text-transform: uppercase;
        letter-spacing: 2px;
        display: flex;
        align-items: center;
        gap: 15px;
      }
      .kkd-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
      }
      .kkd-stat-card {
        background: rgba(15, 23, 42, 0.6);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1.5rem;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .kkd-stat-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
        border-color: rgba(255, 255, 255, 0.1);
      }
      .kkd-stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        width: 4px;
        height: 100%;
      }
      .kkd-stat-card.total::before { background: var(--accent-cyan); }
      .kkd-stat-card.ok::before { background: var(--accent-green); }
      .kkd-stat-card.reject::before { background: var(--accent-red); }
      .kkd-stat-card.retired::before { background: #64748B; }
      .kkd-stat-card.overdue::before { background: var(--accent-orange); }
      .kkd-stat-card.expired::before { background: #7C3AED; }

      .kkd-stat-value {
        font-size: 2.2rem;
        font-weight: 900;
        margin-bottom: 0.2rem;
        line-height: 1;
      }
      .kkd-stat-label {
        font-size: 0.8rem;
        color: var(--text-muted);
        text-transform: uppercase;
        font-weight: 600;
        letter-spacing: 1px;
      }
      .kkd-actions-bar {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 1rem 1.5rem;
        display: flex;
        flex-wrap: wrap;
        gap: 1rem;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 1.5rem;
      }
      .kkd-filters {
        display: flex;
        flex-wrap: wrap;
        gap: 0.8rem;
        flex: 1;
      }
      .kkd-filter-input, .kkd-filter-select {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        color: white;
        padding: 0.5rem 1rem;
        font-size: 0.85rem;
        min-width: 150px;
        transition: border-color 0.2s;
      }
      .kkd-filter-input:focus, .kkd-filter-select:focus {
        border-color: var(--accent-cyan);
        outline: none;
      }
      .kkd-filter-input {
        min-width: 250px;
      }
      .kkd-btn-group {
        display: flex;
        gap: 0.5rem;
        flex-wrap: wrap;
        justify-content: flex-end;
        align-items: center;
        max-width: 100%;
      }
      .kkd-header .kkd-btn {
        height: 34px;
        padding: 0 12px;
        box-sizing: border-box;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        white-space: nowrap;
      }
      @media (max-width: 1300px) {
        .kkd-header {
          flex-direction: column;
          align-items: stretch;
        }
        .kkd-btn-group {
          justify-content: flex-start;
        }
      }
      .kkd-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 0.78rem;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid transparent;
        transition: all 0.2s;
        text-transform: none;
        letter-spacing: 0.3px;
      }
      .kkd-btn-primary {
        background: var(--accent-cyan);
        color: #050a10;
        font-weight: 700;
      }
      .kkd-btn-primary:hover {
        box-shadow: 0 0 15px rgba(0, 242, 254, 0.3);
        transform: translateY(-1px);
        background: #00e1ec;
      }
      .kkd-btn-success {
        background: var(--accent-green);
        color: #050a10;
        font-weight: 700;
      }
      .kkd-btn-success:hover {
        box-shadow: 0 0 15px rgba(0, 255, 136, 0.3);
        transform: translateY(-1px);
        background: #00e57a;
      }
      .kkd-btn-outline {
        background: rgba(255, 255, 255, 0.03);
        border-color: rgba(255, 255, 255, 0.08);
        color: rgba(255, 255, 255, 0.9);
      }
      .kkd-btn-outline:hover {
        background: rgba(255, 255, 255, 0.08);
        border-color: rgba(255, 255, 255, 0.2);
        color: white;
      }
      
      .kkd-table-wrapper {
        background: rgba(15, 23, 42, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        overflow: hidden;
      }
      .kkd-table {
        width: 100%;
        border-collapse: collapse;
        text-align: left;
        font-size: 0.9rem;
      }
      .kkd-table th {
        background: rgba(0, 0, 0, 0.4);
        padding: 1rem;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        color: var(--text-muted);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        letter-spacing: 0.5px;
      }
      .kkd-table td {
        padding: 1rem;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        color: var(--text-main);
      }
      .kkd-table tr:hover td {
        background: rgba(255, 255, 255, 0.02);
      }
      .kkd-table tr.highlighted td {
        background: rgba(0, 242, 254, 0.08) !important;
        border-top: 1px solid var(--accent-cyan);
        border-bottom: 1px solid var(--accent-cyan);
      }

      .status-badge {
        display: inline-flex;
        align-items: center;
        padding: 4px 10px;
        border-radius: 12px;
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.5px;
        text-transform: uppercase;
      }
      .status-badge.ok {
        background: rgba(0, 255, 136, 0.1);
        color: var(--accent-green);
        border: 1px solid rgba(0, 255, 136, 0.2);
      }
      .status-badge.reject {
        background: rgba(255, 0, 85, 0.1);
        color: var(--accent-red);
        border: 1px solid rgba(255, 0, 85, 0.2);
      }
      .status-badge.retired {
        background: rgba(100, 116, 139, 0.1);
        color: #94A3B8;
        border: 1px solid rgba(100, 116, 139, 0.2);
      }
      .status-badge.pending {
        background: rgba(245, 158, 11, 0.1);
        color: var(--accent-amber);
        border: 1px solid rgba(245, 158, 11, 0.2);
      }

      .warning-cell {
        font-weight: 700;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }
      .warning-badge-inline {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-size: 0.65rem;
        padding: 2px 6px;
        border-radius: 4px;
        width: fit-content;
        font-weight: 800;
      }
      .warning-badge-inline.danger {
        background: rgba(255, 0, 85, 0.2);
        color: #FF3366;
        animation: blinker 1.5s linear infinite;
      }
      .warning-badge-inline.warning {
        background: rgba(255, 170, 0, 0.2);
        color: var(--accent-amber);
      }

      @keyframes blinker {
        50% { opacity: 0.3; }
      }

      .lifespan-bar-container {
        width: 100px;
        height: 6px;
        background: rgba(255,255,255,0.08);
        border-radius: 3px;
        margin-top: 4px;
        overflow: hidden;
      }
      .lifespan-bar {
        height: 100%;
        border-radius: 3px;
      }
      .lifespan-ok {
        color: var(--accent-green);
        --bar-color: var(--accent-green);
      }
      .lifespan-warning {
        color: var(--accent-amber);
        --bar-color: var(--accent-amber);
      }
      .lifespan-critical {
        color: var(--accent-red);
        --bar-color: var(--accent-red);
      }
      .expired-badge {
        color: var(--accent-red);
        font-weight: 800;
        font-size: 0.75rem;
        display: inline-flex;
        align-items: center;
        gap: 4px;
      }

      /* Modal styling */
      .kkd-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(10px);
        z-index: 20000;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 1rem;
      }
      .kkd-modal.active {
        display: flex;
      }
      .kkd-modal-content {
        background: #0B132B;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 16px;
        width: 100%;
        max-width: 650px;
        max-height: 90vh;
        overflow-y: auto;
        box-shadow: 0 15px 50px rgba(0, 0, 0, 0.5);
        display: flex;
        flex-direction: column;
      }
      .kkd-modal-header {
        padding: 1.5rem;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .kkd-modal-title {
        font-size: 1.25rem;
        font-weight: 800;
        color: white;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .kkd-modal-close {
        background: transparent;
        border: none;
        color: var(--text-muted);
        font-size: 1.5rem;
        cursor: pointer;
        transition: color 0.2s;
      }
      .kkd-modal-close:hover {
        color: white;
      }
      .kkd-modal-body {
        padding: 1.5rem;
        overflow-y: auto;
      }
      .kkd-modal-footer {
        padding: 1.2rem 1.5rem;
        border-top: 1px solid rgba(255,255,255,0.08);
        display: flex;
        justify-content: flex-end;
        gap: 0.8rem;
        background: rgba(0, 0, 0, 0.2);
      }
      
      /* Forms inside modal */
      .form-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1.2rem;
      }
      .form-grid.single {
        grid-template-columns: 1fr;
      }
      .form-group {
        display: flex;
        flex-direction: column;
        gap: 5px;
      }
      .form-group.full-width {
        grid-column: span 2;
      }
      .form-label {
        font-size: 0.75rem;
        font-weight: 700;
        color: var(--text-muted);
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      .form-input, .form-select, .form-textarea {
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 8px;
        color: white;
        padding: 0.6rem;
        font-size: 0.9rem;
        transition: border-color 0.2s;
      }
      .form-input:focus, .form-select:focus, .form-textarea:focus {
        border-color: var(--accent-cyan);
        outline: none;
      }
      
      /* Checklist stylings */
      .checklist-section {
        background: rgba(0,0,0,0.25);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 10px;
        padding: 1rem;
        margin-top: 1rem;
      }
      .checklist-title-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.8rem;
        border-bottom: 1px dashed rgba(255,255,255,0.1);
        padding-bottom: 0.5rem;
      }
      .checklist-title {
        font-size: 0.8rem;
        font-weight: 800;
        color: var(--accent-cyan);
        text-transform: uppercase;
        letter-spacing: 0.5px;
        margin: 0;
      }
      .checklist-item {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 0.4rem 0;
        font-size: 0.85rem;
        cursor: pointer;
      }
      .checklist-item input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: var(--accent-green);
        cursor: pointer;
      }

      /* Timeline for inspection history */
      .timeline {
        position: relative;
        padding-left: 24px;
        margin-left: 10px;
        border-left: 2px solid rgba(255, 255, 255, 0.08);
      }
      .timeline-item {
        position: relative;
        margin-bottom: 1.5rem;
      }
      .timeline-item::before {
        content: '';
        position: absolute;
        left: -31px;
        top: 4px;
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #64748B;
        border: 2px solid #0B132B;
      }
      .timeline-item.status-ok::before {
        background: var(--accent-green);
        box-shadow: 0 0 8px var(--accent-green);
      }
      .timeline-item.status-reject::before {
        background: var(--accent-red);
        box-shadow: 0 0 8px var(--accent-red);
      }
      .timeline-item.status-retired::before {
        background: #64748B;
      }
      .timeline-date {
        font-size: 0.75rem;
        font-weight: 800;
        color: var(--accent-cyan);
        margin-bottom: 4px;
      }
      .timeline-card {
        background: rgba(255,255,255,0.03);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 8px;
        padding: 0.8rem 1rem;
      }
      .timeline-inspector {
        font-size: 0.8rem;
        font-weight: 700;
        color: white;
        margin-bottom: 4px;
      }
      .timeline-notes {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-bottom: 6px;
        line-height: 1.3;
      }
      
      /* Details list for datasheets */
      .datasheet-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        margin-top: 5px;
      }
      .datasheet-link {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        font-size: 0.75rem;
        color: var(--accent-cyan);
        text-decoration: none;
        background: rgba(0, 242, 254, 0.05);
        padding: 4px 8px;
        border-radius: 4px;
        border: 1px solid rgba(0, 242, 254, 0.1);
        width: fit-content;
        font-weight: 600;
      }
      .datasheet-link:hover {
        background: rgba(0, 242, 254, 0.15);
        color: white;
      }
      tr.dragging {
        opacity: 0.4;
        background: rgba(0, 242, 254, 0.1) !important;
      }
      tr.drag-over {
        background: rgba(255, 255, 255, 0.08) !important;
        border-top: 2px solid var(--accent-cyan) !important;
      }
    </style>

    <div class="kkd-container">
      <div class="kkd-header">
        <div class="kkd-title-group">
          <h1>
            <i class="fa-solid fa-helmet-safety" style="color: #f59e0b;"></i> KKD PERİYODİK KONTROL
          </h1>
          <p style="color: var(--text-muted); font-size: 0.9rem; margin-top: 5px; margin-left: 2px;">
            Saha ekiplerinin emniyet kemeri, lanyard, runner ve kurtarma kitlerinin yıllık kontrol ve kullanım ömrü takibi.
          </p>
        </div>
        <div class="kkd-btn-group">
          <a href="/KKD/Fatih_ZEBEK_Skylotec.pdf" target="_blank" class="kkd-btn kkd-btn-outline" style="text-decoration: none;">
            <i class="fa-solid fa-certificate" style="color: #fbbf24;"></i> Denetçi Sertifikası
          </a>
          <button class="kkd-btn kkd-btn-outline" onclick="window.handleKkdQrScan()">
            <i class="fa-solid fa-qrcode" style="color: var(--accent-cyan);"></i> QR Tarat
          </button>
          <button class="kkd-btn kkd-btn-outline" onclick="window.downloadKkdTemplate()" title="Excel Şablonu İndir">
            <i class="fa-solid fa-download" style="color: var(--accent-cyan);"></i> Şablon İndir
          </button>
          <button class="kkd-btn kkd-btn-outline" onclick="document.getElementById('kkd-excel-import-file').click()" title="Excel'den Kayıtları Yükle">
            <i class="fa-solid fa-upload" style="color: #a855f7;"></i> Excel'den Yükle
          </button>
          <input type="file" id="kkd-excel-import-file" style="display: none;" accept=".xlsx, .xls" onchange="window.importKkdFromExcel(event)">
          <button class="kkd-btn kkd-btn-outline" onclick="window.exportKkdToExcel()">
            <i class="fa-solid fa-file-excel" style="color: var(--accent-green);"></i> Excel Raporu
          </button>
          <button class="kkd-btn kkd-btn-outline" onclick="window.openKkdBulkQrModal()" title="Toplu QR Barkod Etiketi Yazdır">
            <i class="fa-solid fa-print" style="color: #a855f7;"></i> Toplu QR Yazdır
          </button>
          <button class="kkd-btn kkd-btn-primary" onclick="window.openAddKkdModal()">
            <i class="fa-solid fa-plus"></i> Yeni Ekipman Ekle
          </button>
        </div>
      </div>

      <!-- Stats Summary cards -->
      <div class="kkd-stats">
        <div class="kkd-stat-card total" onclick="window.filterKkdByCard('total')" title="Tümünü Göster">
          <div id="stat-total" class="kkd-stat-value" style="color: var(--accent-cyan);">0</div>
          <div class="kkd-stat-label">Toplam Ekipman</div>
        </div>
        <div class="kkd-stat-card ok" onclick="window.filterKkdByCard('ok')" title="Kullanıma Uygun Olanları Filtrele">
          <div id="stat-ok" class="kkd-stat-value" style="color: var(--accent-green);">0</div>
          <div class="kkd-stat-label">Kullanıma Uygun</div>
        </div>
        <div class="kkd-stat-card overdue" onclick="window.filterKkdByCard('overdue')" title="Kontrolü Gecikenleri Filtrele">
          <div id="stat-overdue" class="kkd-stat-value" style="color: var(--accent-orange);">0</div>
          <div class="kkd-stat-label">Kontrolü Geciken</div>
        </div>
        <div class="kkd-stat-card expired" onclick="window.filterKkdByCard('expired')" title="Kullanım Ömrü Dolanları Filtrele">
          <div id="stat-expired" class="kkd-stat-value" style="color: #7C3AED;">0</div>
          <div class="kkd-stat-label">Ömrü Dolan</div>
        </div>
        <div class="kkd-stat-card reject" onclick="window.filterKkdByCard('reject')" title="Reddedilenleri Filtrele">
          <div id="stat-reject" class="kkd-stat-value" style="color: var(--accent-red);">0</div>
          <div class="kkd-stat-label">Reddedilen</div>
        </div>
        <div class="kkd-stat-card retired" onclick="window.filterKkdByCard('retired')" title="Emekli/Hurda Olanları Filtrele">
          <div id="stat-retired" class="kkd-stat-value" style="color: #94A3B8;">0</div>
          <div class="kkd-stat-label">Emekli/Hurda</div>
        </div>
      </div>

      <!-- Filters & Searching -->
      <div class="kkd-actions-bar">
        <div class="kkd-filters">
          <input type="text" id="kkd-search-input" class="kkd-filter-input" placeholder="Seri No, Personel/Saha veya Marka/Model ara..." oninput="window.filterKkdTable()">
          
          <select id="kkd-type-filter" class="kkd-filter-select" onchange="window.filterKkdTable()">
            <option value="ALL">Tüm Ekipman Tipleri</option>
            <option value="Emniyet Kemeri">Emniyet Kemeri</option>
            <option value="Lanyard">Lanyard</option>
            <option value="Runner">Runner</option>
            <option value="Kurtarma Kiti">Kurtarma Kiti</option>
            <option value="Baret">Baret</option>
            <option value="Diğer">Diğer</option>
          </select>

          <select id="kkd-status-filter" class="kkd-filter-select" onchange="window.filterKkdTable()">
            <option value="ALL">Tüm Durumlar</option>
            <option value="PENDING">Kontrol Bekleyenler</option>
            <option value="OK">Kullanıma Uygun (OK)</option>
            <option value="REJECT">Uygun Değil (RED)</option>
            <option value="RETIRED">Hurda / Emekli</option>
          </select>

          <select id="kkd-time-filter" class="kkd-filter-select" onchange="window.filterKkdTable()">
            <option value="ALL">Tüm Süreler</option>
            <option value="OVERDUE">Kontrolü Gecikmişler</option>
            <option value="COMING">Kontrolü Yaklaşanlar (&lt; 30 Gün)</option>
            <option value="EXPIRED">Kullanım Ömrü Dolanlar (10 Yıl)</option>
            <option value="OK_TIME">Kontrolü Sorunsuzlar</option>
          </select>
        </div>
      </div>

      <!-- Data Table -->
      <div class="kkd-table-wrapper">
        <table class="kkd-table" id="kkd-main-table">
          <thead>
            <tr>
              <th>Personel / Saha</th>
              <th>Seri Numarası</th>
              <th>Tip</th>
              <th>Marka / Model</th>
              <th>Kullanım Ömrü (10 Yıl)</th>
              <th>Son Kontrol</th>
              <th>Sonraki Kontrol</th>
              <th>Durum</th>
              <th style="text-align: right;">İşlemler</th>
            </tr>
          </thead>
          <tbody id="kkd-table-body">
            <tr>
              <td colspan="9" style="text-align: center; padding: 3rem; color: var(--accent-cyan);">
                <i class="fa-solid fa-circle-notch fa-spin fa-2x"></i>
                <div style="margin-top: 10px; font-weight: bold;">Yükleniyor...</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- MODAL 1: ADD/EDIT EQUIPMENT -->
    <div id="modal-kkd-item" class="kkd-modal">
      <div class="kkd-modal-content">
        <div class="kkd-modal-header">
          <h3 class="kkd-modal-title" id="kkd-item-modal-title">Yeni Ekipman Ekle</h3>
          <button class="kkd-modal-close" onclick="window.closeKkdModal('modal-kkd-item')">&times;</button>
        </div>
        <div class="kkd-modal-body">
          <form id="form-kkd-item" onsubmit="window.submitKkdItem(event)">
            <input type="hidden" id="kkd-edit-id">
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="kkd-input-name">Ekipman Tipi</label>
                <select id="kkd-input-name" class="form-select" onchange="window.handleKkdTypeChange()" required>
                  <option value="Emniyet Kemeri">Emniyet Kemeri</option>
                  <option value="Lanyard">Lanyard</option>
                  <option value="Runner">Runner</option>
                  <option value="Kurtarma Kiti">Kurtarma Kiti</option>
                  <option value="Baret">Baret</option>
                  <option value="Diğer">Diğer</option>
                </select>
              </div>
              <div class="form-group" id="kkd-custom-name-group" style="display: none;">
                <label class="form-label" for="kkd-input-custom-name">Diğer Ekipman Tipi Belirtin</label>
                <input type="text" id="kkd-input-custom-name" class="form-input" placeholder="Örn: Lamba, Karabina, vb.">
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-brand">Marka / Model</label>
                <input type="text" id="kkd-input-brand" class="form-input" placeholder="Örn: Skylotec Ignite Proton" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-sn">Seri Numarası</label>
                <input type="text" id="kkd-input-sn" class="form-input" placeholder="Örn: 69849-043" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-person">Atanan Personel / Saha / Depo</label>
                <input type="text" id="kkd-input-person" class="form-input" placeholder="Örn: Fatih Zebek veya Saha Ekibi" required>
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-mfg">Üretim Tarihi (Ay-Yıl)</label>
                <input type="month" id="kkd-input-mfg" class="form-input" required onchange="window.handleMfgDateChange()">
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-last">Son Kontrol Tarihi (Ay-Yıl)</label>
                <input type="month" id="kkd-input-last" class="form-input" onchange="window.calculateNextInspectionDate()">
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-next">Bir Sonraki Kontrol Tarihi</label>
                <input type="month" id="kkd-input-next" class="form-input" readonly>
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-expiry">Ürün Son Kullanma Tarihi</label>
                <input type="month" id="kkd-input-expiry" class="form-input" readonly required>
              </div>
              <div class="form-group">
                <label class="form-label" for="kkd-input-lifespan">Kullanım Ömrü (Yıl)</label>
                <input type="number" id="kkd-input-lifespan" class="form-input" value="10" min="1" max="25" required onchange="window.handleMfgDateChange()">
              </div>
              <div class="form-group full-width">
                <label class="form-label" for="kkd-input-notes">Açıklama / Notlar</label>
                <textarea id="kkd-input-notes" class="form-textarea" rows="3" placeholder="Ekipmanla ilgili ek notlar..."></textarea>
              </div>
              <div class="form-group full-width" id="bypass-lock-group" style="display: none;">
                <label style="display: flex; align-items: center; gap: 8px; color: white; cursor: pointer; font-size: 0.9rem; user-select: none;">
                  <input type="checkbox" id="kkd-input-bypass-lock" style="width: 18px; height: 18px; cursor: pointer;">
                  <span><strong>Kontrol Kilidini Kaldır:</strong> Bir sonraki muayene tarihi gelmemiş olsa bile hemen yeni bir kontrol yapılmasına izin ver.</span>
                </label>
              </div>
            </div>
            <button type="submit" style="display: none;" id="btn-submit-kkd-hidden"></button>
          </form>
        </div>
        <div class="kkd-modal-footer">
          <button class="kkd-btn kkd-btn-outline" onclick="window.closeKkdModal('modal-kkd-item')">Vazgeç</button>
          <button class="kkd-btn kkd-btn-primary" onclick="document.getElementById('btn-submit-kkd-hidden').click()">Kaydet</button>
        </div>
      </div>
    </div>

    <!-- MODAL 2: PERFORM PERIODIC INSPECTION -->
    <div id="modal-kkd-inspect" class="kkd-modal">
      <div class="kkd-modal-content">
        <div class="kkd-modal-header">
          <h3 class="kkd-modal-title"><i class="fa-solid fa-helmet-safety" style="color: #f59e0b;"></i> Periyodik Kontrol Kaydı Girişi</h3>
          <button class="kkd-modal-close" onclick="window.closeKkdModal('modal-kkd-inspect')">&times;</button>
        </div>
        <div class="kkd-modal-body">
          <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); padding: 1rem; border-radius: 10px; margin-bottom: 1.2rem;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 0.85rem;">
              <div><span style="color: var(--text-muted);">Ekipman:</span> <strong id="inspect-info-name" style="color: white;">-</strong></div>
              <div><span style="color: var(--text-muted);">Seri No:</span> <strong id="inspect-info-sn" style="color: white;">-</strong></div>
              <div><span style="color: var(--text-muted);">Marka/Model:</span> <span id="inspect-info-brand">-</span></div>
              <div><span style="color: var(--text-muted);">Atanan Kişi:</span> <span id="inspect-info-person">-</span></div>
              <div style="grid-column: span 2; margin-top: 6px; padding-top: 6px; border-top: 1px dashed rgba(255,255,255,0.05);">
                <span style="color: var(--text-muted);">Kullanım Ömrü Durumu:</span> <strong id="inspect-info-lifespan" class="status-badge">-</strong>
              </div>
            </div>
          </div>

          <form id="form-kkd-inspect" onsubmit="window.submitKkdInspection(event)">
            <input type="hidden" id="inspect-item-id">
            
            <div class="form-grid">
              <div class="form-group">
                <label class="form-label" for="inspect-input-date">Kontrol Tarihi (Gün-Ay-Yıl)</label>
                <input type="date" id="inspect-input-date" class="form-input" required onchange="window.calculateInspectNextDate()">
              </div>
              <div class="form-group">
                <label class="form-label" for="inspect-input-next">Bir Sonraki Kontrol Tarihi</label>
                <input type="date" id="inspect-input-next" class="form-input" readonly required>
              </div>
              <div class="form-group">
                <label class="form-label" for="inspect-input-status">Kontrol Sonucu</label>
                <select id="inspect-input-status" class="form-select" required onchange="window.handleInspectionStatusChange(this.value)">
                  <option value="OK">Kullanıma Uygun (OK)</option>
                  <option value="REJECT">Kullanılamaz - Reddedildi (RED)</option>
                  <option value="RETIRED">Kullanım Dışı / Hurda (RETIRED)</option>
                </select>
              </div>
              <div class="form-group">
                <label class="form-label" for="inspect-input-inspector">Kontrolü Yapan Yetkili</label>
                <input type="text" id="inspect-input-inspector" class="form-input" required readonly>
              </div>

              <!-- DYNAMIC CHECKLIST FROM DATASHEETS -->
              <div class="form-group full-width">
                <div class="checklist-section">
                  <div class="checklist-title-bar">
                    <h4 class="checklist-title" id="inspect-checklist-title">Kontrol Parametreleri</h4>
                    <button type="button" class="kkd-btn kkd-btn-outline" style="padding: 2px 8px; font-size: 0.7rem;" onclick="window.checkAllInspectChecklist()">Tümünü Uygun İşaretle</button>
                  </div>
                  <div id="inspect-checklist-items-container">
                    <!-- Checkboxes dynamically rendered here depending on equipment type -->
                  </div>
                </div>
              </div>

              <!-- Previous Inspection Photos (dynamically shown) -->
              <div class="form-group full-width" id="inspect-previous-photos-group" style="display: none;">
                <label class="form-label" style="color: var(--accent-orange); font-weight: bold;">Önceki Muayenede Eklenen Hasar/Kusur Fotoğrafları</label>
                <div id="inspect-previous-photos-container" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px;"></div>
              </div>

              <!-- New Photo Attachment Section -->
              <div class="form-group full-width">
                <label class="form-label">Muayene / Kusur Fotoğrafları Ekle</label>
                <input type="file" id="inspect-image-input" accept="image/*" multiple style="display: none;" onchange="window.handleInspectImageUpload(event)">
                <div style="display: flex; gap: 8px; align-items: center;">
                  <button type="button" class="kkd-btn kkd-btn-outline" style="display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px;" onclick="document.getElementById('inspect-image-input').click()">
                    <i class="fa-solid fa-camera" style="color: var(--accent-cyan);"></i> Fotoğraf Ekle
                  </button>
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Hasar, kusur veya yıpranmaları belgelemek için fotoğraf yükleyebilirsiniz (Birden fazla seçilebilir).</span>
                </div>
                <div id="inspect-image-preview" style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px;"></div>
              </div>

              <div class="form-group full-width">
                <label class="form-label" for="inspect-input-notes">Kontrol Detay Notları</label>
                <textarea id="inspect-input-notes" class="form-textarea" rows="3" placeholder="Fiziksel muayene detayları, kilit testleri vb. durumları detaylandırın..." required></textarea>
              </div>
            </div>
            <button type="submit" style="display: none;" id="btn-submit-inspect-hidden"></button>
          </form>
        </div>
        <div class="kkd-modal-footer">
          <button class="kkd-btn kkd-btn-outline" onclick="window.closeKkdModal('modal-kkd-inspect')">Vazgeç</button>
          <button class="kkd-btn kkd-btn-success" onclick="document.getElementById('btn-submit-inspect-hidden').click()">Kontrolü Tamamla</button>
        </div>
      </div>
    </div>

    <!-- MODAL 3: VIEW INSPECTION HISTORY -->
    <div id="modal-kkd-history" class="kkd-modal">
      <div class="kkd-modal-content" style="max-width: 500px;">
        <div class="kkd-modal-header">
          <h3 class="kkd-modal-title"><i class="fa-solid fa-clock-rotate-left"></i> Periyodik Kontrol Geçmişi</h3>
          <button class="kkd-modal-close" onclick="window.closeKkdModal('modal-kkd-history')">&times;</button>
        </div>
        <div class="kkd-modal-body">
          <div style="margin-bottom: 1.2rem; font-size: 0.85rem; border-bottom: 1px dashed rgba(255,255,255,0.05); padding-bottom: 0.8rem;">
            <div>Sınıf: <strong id="history-info-name" style="color: white;">-</strong></div>
            <div>Seri No: <strong id="history-info-sn" style="color: var(--accent-cyan);">-</strong></div>
          </div>
          <div class="timeline" id="history-timeline-container">
            <!-- Inspection logs timeline -->
          </div>
        </div>
        <div class="kkd-modal-footer">
          <button class="kkd-btn kkd-btn-outline" onclick="window.closeKkdModal('modal-kkd-history')">Kapat</button>
        </div>
      </div>
    </div>

    <!-- MODAL 4: BULK QR PRINT -->
    <div id="modal-kkd-bulk-qr" class="kkd-modal">
      <div class="kkd-modal-content" style="max-width: 450px;">
        <div class="kkd-modal-header">
          <h3 class="kkd-modal-title"><i class="fa-solid fa-print"></i> Toplu QR Barkod Yazdır</h3>
          <button class="kkd-modal-close" onclick="window.closeKkdModal('modal-kkd-bulk-qr')">&times;</button>
        </div>
        <div class="kkd-modal-body">
          <div class="kkd-form-group">
            <label class="kkd-label">Yazdırılacak Ekipman Grubu</label>
            <select id="bulk-qr-scope" class="kkd-input">
              <option value="filtered">Şu an filtrelenmiş listedeki ekipmanlar</option>
              <option value="all">Envanterdeki tüm ekipmanlar</option>
            </select>
          </div>
          <div class="kkd-form-group" style="margin-top: 15px;">
            <label class="kkd-label">A4 Etiket Sayfa Düzeni</label>
            <select id="bulk-qr-layout" class="kkd-input" onchange="window.updateBulkQrLayoutWarning()">
              <option value="layout-20-vertical">20'li Dikey Etiket (A4, 48 x 53 mm - Örnekteki Dikey Tasarım)</option>
              <option value="layout-14">14'lü Tabaka Etiket (A4, 105 x 42.4 mm - Büyük Boyut)</option>
              <option value="layout-28">28'li Tabaka Etiket (A4, 52.5 x 42.4 mm - Küçük Boyut / İkiye Bölünmüş)</option>
            </select>
            <div id="bulk-qr-layout-note" style="margin-top: 8px; font-size: 0.75rem; color: #10B981; line-height: 1.4;">
              <i class="fa-solid fa-circle-info"></i> Örnekteki gibi QR kodunun ortada, bilgilerin dikey olarak dizildiği şık dikey tasarım. Bir A4 sayfasında 20 adet etiket (4 sütun x 5 satır) basılır.
            </div>
          </div>
        </div>
        <div class="kkd-modal-footer">
          <button class="kkd-btn kkd-btn-outline" onclick="window.closeKkdModal('modal-kkd-bulk-qr')">İptal</button>
          <button class="kkd-btn kkd-btn-primary" onclick="window.printKkdBulkQrLabels()">
            <i class="fa-solid fa-print"></i> Yazdırma Sayfasını Aç
          </button>
        </div>
      </div>
    </div>
  `;
};

// Global state variables for KKD page
let kkdItemsList: KkdItem[] = [];
let unsubscribeKkd: any = null;

(window as any).initKkdControlPage = () => {
  const container = document.getElementById('kkd-table-body');
  if (!container) return;

  // Set default values for modal dates to today
  const todayStr = new Date().toISOString().split('T')[0];
  const nextYear = new Date();
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  const nextYearStr = nextYear.toISOString().split('T')[0];

  // Subscribe to live Firestore inventory updates
  unsubscribeKkd = kkdService.subscribeInventory((items) => {
    kkdItemsList = items;
    (window as any).filterKkdTable();
    (window as any).updateKkdStats();
  });
};

(window as any).updateKkdStats = () => {
  if (!kkdItemsList) return;

  const total = kkdItemsList.length;
  const ok = kkdItemsList.filter(i => (i.lastInspectionDate ? i.status : 'PENDING') === 'OK').length;
  const reject = kkdItemsList.filter(i => (i.lastInspectionDate ? i.status : 'PENDING') === 'REJECT').length;
  const retired = kkdItemsList.filter(i => (i.lastInspectionDate ? i.status : 'PENDING') === 'RETIRED').length;
  
  // Overdue calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const overdue = kkdItemsList.filter(i => (i.lastInspectionDate ? i.status : 'PENDING') === 'OK' && i.nextInspectionDate && i.nextInspectionDate <= todayStr).length;
  
  // Expired calculations (over 10 years / lifespanYears)
  const expired = kkdItemsList.filter(i => {
    if (i.status === 'RETIRED') return false; // Don't count retired as expired
    const lifeInfo = getLifespanInfo(i.manufactureDate, i.lifespanYears);
    return lifeInfo.expired;
  }).length;

  const setStatVal = (id: string, val: number) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(val);
  };

  setStatVal('stat-total', total);
  setStatVal('stat-ok', ok);
  setStatVal('stat-reject', reject);
  setStatVal('stat-retired', retired);
  setStatVal('stat-overdue', overdue);
  setStatVal('stat-expired', expired);
};

// Auto calculate next inspection date when editing/adding
(window as any).calculateNextInspectionDate = () => {
  const lastVal = (document.getElementById('kkd-input-last') as HTMLInputElement).value;
  const nextEl = document.getElementById('kkd-input-next') as HTMLInputElement;
  if (lastVal && nextEl) {
    const [year, month] = lastVal.split('-').map(Number);
    nextEl.value = `${year + 1}-${String(month).padStart(2, '0')}`;
  } else if (nextEl) {
    nextEl.value = '';
  }
};

// Auto calculate next inspection date in periodic inspect modal
(window as any).calculateInspectNextDate = () => {
  const inspectVal = (document.getElementById('inspect-input-date') as HTMLInputElement).value;
  const nextEl = document.getElementById('inspect-input-next') as HTMLInputElement;
  if (inspectVal && nextEl) {
    const inspectDate = new Date(inspectVal);
    inspectDate.setFullYear(inspectDate.getFullYear() + 1);
    nextEl.value = inspectDate.toISOString().split('T')[0];
  }
};

// Auto calculate manufacturing expiry date
(window as any).handleMfgDateChange = () => {
  const mfgVal = (document.getElementById('kkd-input-mfg') as HTMLInputElement).value;
  const lifespan = Number((document.getElementById('kkd-input-lifespan') as HTMLInputElement).value) || 10;
  const expiryEl = document.getElementById('kkd-input-expiry') as HTMLInputElement;
  if (mfgVal && expiryEl) {
    const [year, month] = mfgVal.split('-').map(Number);
    expiryEl.value = `${year + lifespan}-${String(month).padStart(2, '0')}`;
  }
};

// Toggle custom equipment type input
(window as any).handleKkdTypeChange = () => {
  const typeSelect = document.getElementById('kkd-input-name') as HTMLSelectElement;
  const customGroup = document.getElementById('kkd-custom-name-group') as HTMLElement;
  const customInput = document.getElementById('kkd-input-custom-name') as HTMLInputElement;
  
  if (typeSelect && customGroup && customInput) {
    if (typeSelect.value === 'Diğer') {
      customGroup.style.display = 'block';
      customInput.required = true;
    } else {
      customGroup.style.display = 'none';
      customInput.required = false;
      customInput.value = '';
    }
  }
};

// Check if next inspection is more than 60 days away
const isInspectionLocked = (nextInspectionDateStr: string | undefined): boolean => {
  if (!nextInspectionDateStr) return false;
  
  let nextDate: Date;
  if (nextInspectionDateStr.length === 7) {
    const [y, m] = nextInspectionDateStr.split('-').map(Number);
    nextDate = new Date(y, m - 1, 1);
  } else {
    nextDate = new Date(nextInspectionDateStr);
  }
  
  if (isNaN(nextDate.getTime())) return false;
  
  const today = new Date();
  const diffTime = nextDate.getTime() - today.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  return diffDays > 60; // lock if next inspection is > 60 days away
};

// Format dates without timezone shifting
const formatDisplayDate = (val: string | undefined): string => {
  if (!val) return '---';
  if (val.length === 7) {
    const [y, m] = val.split('-');
    return `${m}.${y}`;
  }
  const [y, m, d] = val.split('-');
  if (y && m && d) {
    return `${d}.${m}.${y}`;
  }
  return val;
};

let currentInspectImages: string[] = [];

(window as any).handleInspectImageUpload = async (event: any) => {
  const files = event.target.files;
  if (!files || files.length === 0) return;
  
  const previewContainer = document.getElementById('inspect-image-preview');
  if (!previewContainer) return;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const base64Url = await fileService.uploadImage(file, '');
      currentInspectImages.push(base64Url);
      
      const imgIdx = currentInspectImages.length - 1;
      const thumb = document.createElement('div');
      thumb.className = 'inspect-img-thumb';
      thumb.id = `inspect-img-thumb-${imgIdx}`;
      thumb.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15);';
      thumb.innerHTML = `
        <img src="${base64Url}" style="width: 100%; height: 100%; object-fit: cover;">
        <button type="button" onclick="window.removeInspectImage(${imgIdx})" style="position: absolute; top: 2px; right: 2px; background: rgba(220,38,38,0.85); color: white; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      `;
      previewContainer.appendChild(thumb);
    } catch (err) {
      console.error('Fotoğraf yükleme hatası:', err);
    }
  }
  event.target.value = '';
};

(window as any).removeInspectImage = (idx: number) => {
  currentInspectImages[idx] = '';
  const el = document.getElementById(`inspect-img-thumb-${idx}`);
  if (el) el.remove();
};

(window as any).handleInspectionStatusChange = (status: string) => {
  const nextEl = document.getElementById('inspect-input-next') as HTMLInputElement;
  if (status !== 'OK' && nextEl) {
    nextEl.value = ''; // No next inspection date if rejected or retired
    nextEl.disabled = true;
    nextEl.required = false;
  } else if (nextEl) {
    nextEl.disabled = false;
    nextEl.required = true;
    (window as any).calculateInspectNextDate();
  }
};

// Check all in periodic checklist
(window as any).checkAllInspectChecklist = () => {
  const checkboxes = document.querySelectorAll('#inspect-checklist-items-container input[type="checkbox"]');
  checkboxes.forEach((cb: any) => cb.checked = true);
};

// Click handler for stats summary cards
(window as any).filterKkdByCard = (cardType: string) => {
  const statusSelect = document.getElementById('kkd-status-filter') as HTMLSelectElement;
  const timeSelect = document.getElementById('kkd-time-filter') as HTMLSelectElement;
  
  if (!statusSelect || !timeSelect) return;

  switch (cardType) {
    case 'total':
      statusSelect.value = 'ALL';
      timeSelect.value = 'ALL';
      break;
    case 'ok':
      statusSelect.value = 'OK';
      timeSelect.value = 'ALL';
      break;
    case 'overdue':
      statusSelect.value = 'OK';
      timeSelect.value = 'OVERDUE';
      break;
    case 'expired':
      statusSelect.value = 'ALL';
      timeSelect.value = 'EXPIRED';
      break;
    case 'reject':
      statusSelect.value = 'REJECT';
      timeSelect.value = 'ALL';
      break;
    case 'retired':
      statusSelect.value = 'RETIRED';
      timeSelect.value = 'ALL';
      break;
  }

  // Trigger table filtering
  (window as any).filterKkdTable();
};

// Filters & Renders table body
(window as any).filterKkdTable = (highlightedId?: string) => {
  const searchInput = (document.getElementById('kkd-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
  const typeFilter = (document.getElementById('kkd-type-filter') as HTMLSelectElement)?.value || 'ALL';
  const statusFilter = (document.getElementById('kkd-status-filter') as HTMLSelectElement)?.value || 'ALL';
  const timeFilter = (document.getElementById('kkd-time-filter') as HTMLSelectElement)?.value || 'ALL';
  const tbody = document.getElementById('kkd-table-body');
  
  if (!tbody) return;

  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = kkdItemsList.filter(item => {
    // 1. Search Query
    const queryMatch = 
      item.serialNumber.toLowerCase().includes(searchInput) ||
      (item.assignedPerson || '').toLowerCase().includes(searchInput) ||
      (item.brandModel || '').toLowerCase().includes(searchInput);

    if (!queryMatch) return false;

    // 2. Type Filter
    if (typeFilter !== 'ALL' && item.name !== typeFilter) return false;

    // 3. Status Filter
    const itemStatus = !item.lastInspectionDate ? 'PENDING' : item.status;
    if (statusFilter !== 'ALL' && itemStatus !== statusFilter) return false;

    // 4. Time/Lifespan Warning Filter
    const isOverdue = itemStatus === 'OK' && item.nextInspectionDate && item.nextInspectionDate <= todayStr;
    
    let isComing = false;
    if (itemStatus === 'OK' && item.nextInspectionDate && !isOverdue) {
      const nextDate = new Date(item.nextInspectionDate);
      const diffTime = nextDate.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isComing = diffDays >= 0 && diffDays <= 30;
    }

    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);

    if (timeFilter === 'OVERDUE' && !isOverdue) return false;
    if (timeFilter === 'COMING' && !isComing) return false;
    if (timeFilter === 'EXPIRED' && (!lifeInfo.expired || itemStatus === 'RETIRED')) return false;
    if (timeFilter === 'OK_TIME' && (isOverdue || isComing || lifeInfo.expired)) return false;

    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align: center; padding: 2rem; color: var(--text-muted);">
          <i class="fa-solid fa-triangle-exclamation fa-lg" style="margin-right: 8px;"></i> Eşleşen Kişisel Koruyucu Ekipman kaydı bulunamadı.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = filtered.map(item => {
    const itemStatus = !item.lastInspectionDate ? 'PENDING' : item.status;
    const isOverdue = itemStatus === 'OK' && item.nextInspectionDate && item.nextInspectionDate <= todayStr;
    let isComing = false;
    if (itemStatus === 'OK' && item.nextInspectionDate && !isOverdue) {
      const nextDate = new Date(item.nextInspectionDate);
      const diffTime = nextDate.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isComing = diffDays >= 0 && diffDays <= 30;
    }

    // Lifespan calculation
    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);

    let warningBadge = '';
    if (isOverdue) {
      warningBadge = `<span class="warning-badge-inline danger"><i class="fa-solid fa-triangle-exclamation"></i> KONTROL GECİKTİ</span>`;
    } else if (isComing) {
      warningBadge = `<span class="warning-badge-inline warning"><i class="fa-solid fa-clock"></i> KONTROL YAKLAŞTI</span>`;
    }

    let statusText = 'UYGUN';
    let statusClass = 'ok';
    if (itemStatus === 'PENDING') {
      statusText = 'KONTROL BEKLİYOR';
      statusClass = 'pending';
    } else if (itemStatus === 'REJECT') {
      statusText = 'UYGUN DEĞİL';
      statusClass = 'reject';
    } else if (itemStatus === 'RETIRED') {
      statusText = 'EMEKLİ/HURDA';
      statusClass = 'retired';
    }

    // Check if the inspection button should be locked
    const nextInspLocked = isInspectionLocked(item.nextInspectionDate) && itemStatus === 'OK' && !item.bypassLock;

    let typeIcon = 'fa-shield-halved';
    if (item.name === 'Emniyet Kemeri') typeIcon = 'fa-vest';
    else if (item.name === 'Lanyard') typeIcon = 'fa-bezier-curve';
    else if (item.name === 'Runner') typeIcon = 'fa-ring';
    else if (item.name === 'Kurtarma Kiti') typeIcon = 'fa-kit-medical';
    else if (item.name === 'Baret') typeIcon = 'fa-helmet-safety';

    const isHighlighted = highlightedId === item.id ? 'class="highlighted"' : '';

    return `
      <tr id="kkd-row-${item.id}" ${isHighlighted} draggable="true" ondragstart="window.handleKkdDragStart(event)" ondragover="window.handleKkdDragOver(event)" ondragleave="window.handleKkdDragLeave(event)" ondrop="window.handleKkdDrop(event)" ondragend="window.handleKkdDragEnd(event)" data-id="${item.id}" style="cursor: grab;">
        <td style="font-weight: 700; color: white;">${item.assignedPerson || '-'}</td>
        <td style="font-family: monospace; font-weight: bold; color: var(--accent-cyan); font-size: 0.95rem;">
          ${item.serialNumber}
        </td>
        <td style="font-weight: 700; color: white;">
          <i class="fa-solid ${typeIcon}" style="margin-right: 6px; color: var(--accent-cyan);"></i> ${item.name}
        </td>
        <td>
          <div style="font-weight: 600; color: white;">${item.brandModel}</div>
        </td>
        <td>
          ${lifeInfo.expired 
            ? `<span class="${lifeInfo.class}"><i class="fa-solid fa-ban"></i> ${lifeInfo.text}</span>`
            : `
              <div class="${lifeInfo.class}" style="font-size: 0.8rem; font-weight: 600;">${lifeInfo.text}</div>
              <div class="lifespan-bar-container">
                <div class="lifespan-bar" style="width: ${lifeInfo.percent}%; background: var(--bar-color);"></div>
              </div>
            `
          }
        </td>
        <td style="font-size: 0.85rem;">${item.lastInspectionDate ? formatDisplayDate(item.lastInspectionDate) : 'Hiç Yapılmadı'}</td>
        <td style="font-size: 0.85rem;">
          <div class="warning-cell">
            <span>${formatDisplayDate(item.nextInspectionDate)}</span>
            ${warningBadge}
          </div>
        </td>
        <td>
          <span class="status-badge ${statusClass}">${statusText}</span>
        </td>
        <td style="text-align: right;">
          <div style="display: flex; gap: 6px; justify-content: flex-end;">
            ${nextInspLocked 
              ? `
                <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px; opacity: 0.5; cursor: not-allowed;" title="Bir sonraki kontrole 2 aydan fazla süre var (Kilitli)" disabled>
                  <i class="fa-solid fa-lock" style="color: #94A3B8;"></i>
                </button>
              `
              : `
                <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px;" onclick="window.openInspectKkdModal('${item.id}')" title="Periyodik Kontrol Yap">
                  <i class="fa-solid fa-helmet-safety" style="color: var(--accent-orange);"></i>
                </button>
              `
            }
            ${item.lastInspectionDate 
              ? `
                <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px; border-color: #10B981;" onclick="window.printLastKkdReport('${item.id}')" title="Son Muayene Raporunu Yazdır (PDF)">
                  <i class="fa-solid fa-file-pdf" style="color: #10B981;"></i>
                </button>
              `
              : ''
            }
            <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px; border-color: #a855f7;" onclick="window.printKkdQrLabel('${item.id}')" title="QR Kod Etiketi Yazdır">
              <i class="fa-solid fa-qrcode" style="color: #a855f7;"></i>
            </button>
            <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px;" onclick="window.openEditKkdModal('${item.id}')" title="Düzenle">
              <i class="fa-solid fa-pen" style="color: var(--accent-cyan);"></i>
            </button>
            <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px;" onclick="window.openKkdHistoryModal('${item.id}')" title="Kontrol Geçmişi">
              <i class="fa-solid fa-clock-rotate-left" style="color: #94A3B8;"></i>
            </button>
            <button class="kkd-btn kkd-btn-outline" style="padding: 6px 10px; border-radius: 6px; border-color: var(--accent-red);" onclick="window.deleteKkdItem('${item.id}')" title="Sil">
              <i class="fa-solid fa-trash-can" style="color: var(--accent-red);"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
};

// Modal helpers
(window as any).openKkdModal = (modalId: string) => {
  const m = document.getElementById(modalId);
  if (m) m.classList.add('active');
};

(window as any).closeKkdModal = (modalId: string) => {
  const m = document.getElementById(modalId);
  if (m) m.classList.remove('active');
};

// ADD/EDIT Modal trigger
(window as any).openAddKkdModal = () => {
  const form = document.getElementById('form-kkd-item') as HTMLFormElement;
  form.reset();
  (document.getElementById('kkd-edit-id') as HTMLInputElement).value = '';
  (document.getElementById('kkd-item-modal-title') as HTMLElement).textContent = 'Yeni Ekipman Ekle';
  
  // Set default manufacture date to today's month, but last/next inspection dates empty by default
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  (document.getElementById('kkd-input-mfg') as HTMLInputElement).value = currentMonthStr;
  (document.getElementById('kkd-input-last') as HTMLInputElement).value = '';
  (document.getElementById('kkd-input-next') as HTMLInputElement).value = '';
  (window as any).handleMfgDateChange();
  (window as any).calculateNextInspectionDate();
  
  const bypassGroup = document.getElementById('bypass-lock-group');
  if (bypassGroup) bypassGroup.style.display = 'none';
  const bypassCheck = document.getElementById('kkd-input-bypass-lock') as HTMLInputElement;
  if (bypassCheck) bypassCheck.checked = false;
  
  // Reset custom name group
  (window as any).handleKkdTypeChange();
  
  (window as any).openKkdModal('modal-kkd-item');
};

(window as any).openEditKkdModal = (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  (document.getElementById('kkd-edit-id') as HTMLInputElement).value = item.id;
  (document.getElementById('kkd-item-modal-title') as HTMLElement).textContent = 'Ekipman Kartını Düzenle';

  const standardTypes = ['Emniyet Kemeri', 'Lanyard', 'Runner', 'Kurtarma Kiti', 'Baret'];
  const nameSelect = document.getElementById('kkd-input-name') as HTMLSelectElement;
  const customInput = document.getElementById('kkd-input-custom-name') as HTMLInputElement;

  if (standardTypes.includes(item.name)) {
    nameSelect.value = item.name;
    (window as any).handleKkdTypeChange();
  } else {
    nameSelect.value = 'Diğer';
    (window as any).handleKkdTypeChange();
    if (customInput) customInput.value = item.name;
  }

  (document.getElementById('kkd-input-brand') as HTMLInputElement).value = item.brandModel;
  (document.getElementById('kkd-input-sn') as HTMLInputElement).value = item.serialNumber;
  (document.getElementById('kkd-input-person') as HTMLInputElement).value = item.assignedPerson;
  (document.getElementById('kkd-input-mfg') as HTMLInputElement).value = item.manufactureDate ? item.manufactureDate.substring(0, 7) : '';
  (document.getElementById('kkd-input-last') as HTMLInputElement).value = item.lastInspectionDate ? item.lastInspectionDate.substring(0, 7) : '';
  (document.getElementById('kkd-input-next') as HTMLInputElement).value = item.nextInspectionDate ? item.nextInspectionDate.substring(0, 7) : '';
  (document.getElementById('kkd-input-lifespan') as HTMLInputElement).value = String(item.lifespanYears || 10);
  (document.getElementById('kkd-input-notes') as HTMLTextAreaElement).value = item.notes || '';
  (window as any).handleMfgDateChange();

  const bypassGroup = document.getElementById('bypass-lock-group');
  if (bypassGroup) bypassGroup.style.display = 'block';
  const bypassCheck = document.getElementById('kkd-input-bypass-lock') as HTMLInputElement;
  if (bypassCheck) bypassCheck.checked = !!item.bypassLock;

  (window as any).openKkdModal('modal-kkd-item');
};

// Submit ADD/EDIT Equipment form
(window as any).submitKkdItem = async (e: Event) => {
  e.preventDefault();
  
  const typeSelect = (document.getElementById('kkd-input-name') as HTMLSelectElement).value;
  const customName = (document.getElementById('kkd-input-custom-name') as HTMLInputElement).value.trim();
  const nameValue = typeSelect === 'Diğer' ? customName : typeSelect;

  const id = (document.getElementById('kkd-edit-id') as HTMLInputElement).value;
  
  // Calculate order index
  let orderVal: number;
  if (id) {
    const existing = kkdItemsList.find(i => i.id === id);
    orderVal = existing && existing.order !== undefined ? existing.order : kkdItemsList.length;
  } else {
    const maxOrder = kkdItemsList.reduce((max, item) => (item.order !== undefined && item.order > max ? item.order : max), -1);
    orderVal = maxOrder + 1;
  }

  const lastInsp = (document.getElementById('kkd-input-last') as HTMLInputElement).value;
  let statusVal: 'OK' | 'REJECT' | 'RETIRED' | 'PENDING' = 'PENDING';
  if (lastInsp) {
    if (id) {
      const existing = kkdItemsList.find(i => i.id === id);
      statusVal = existing && existing.status && existing.status !== 'PENDING' ? existing.status : 'OK';
    } else {
      statusVal = 'OK';
    }
  } else {
    statusVal = 'PENDING';
  }

  const data: Omit<KkdItem, 'id'> = {
    name: nameValue,
    brandModel: (document.getElementById('kkd-input-brand') as HTMLInputElement).value.trim(),
    serialNumber: (document.getElementById('kkd-input-sn') as HTMLInputElement).value.trim(),
    assignedPerson: (document.getElementById('kkd-input-person') as HTMLInputElement).value.trim(),
    manufactureDate: (document.getElementById('kkd-input-mfg') as HTMLInputElement).value,
    firstUseDate: '', 
    lastInspectionDate: lastInsp,
    nextInspectionDate: (document.getElementById('kkd-input-next') as HTMLInputElement).value,
    status: statusVal,
    lifespanYears: Number((document.getElementById('kkd-input-lifespan') as HTMLInputElement).value) || 10,
    notes: (document.getElementById('kkd-input-notes') as HTMLTextAreaElement).value.trim(),
    bypassLock: (document.getElementById('kkd-input-bypass-lock') as HTMLInputElement)?.checked || false,
    order: orderVal
  };

  try {
    if (id) {
      await kkdService.updateKkdItem(id, data);
      (window as any).showToast?.('Ekipman bilgileri güncellendi.', 'success');
    } else {
      await kkdService.addKkdItem(data);
      (window as any).showToast?.('Yeni ekipman envantere eklendi.', 'success');
    }
    (window as any).closeKkdModal('modal-kkd-item');
  } catch (err: any) {
    console.error(err);
    alert('Hata oluştu: ' + err.message);
  }
};

(window as any).deleteKkdItem = async (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  if (confirm(`"${item.brandModel}" markalı (${item.serialNumber}) seri numaralı ekipmanı silmek istediğinizden emin misiniz?`)) {
    try {
      await kkdService.deleteKkdItem(itemId);
      (window as any).showToast?.('Ekipman başarıyla silindi.', 'success');
    } catch (err: any) {
      console.error(err);
      alert('Silme işlemi sırasında hata oluştu: ' + err.message);
    }
  }
};

let kkdDragSrcEl: HTMLElement | null = null;

(window as any).handleKkdDragStart = (e: DragEvent) => {
  const row = (e.target as HTMLElement).closest('tr') as HTMLElement;
  if (!row) return;
  kkdDragSrcEl = row;
  e.dataTransfer!.effectAllowed = 'move';
  e.dataTransfer!.setData('text/plain', row.getAttribute('data-id') || '');
  row.classList.add('dragging');
};

(window as any).handleKkdDragOver = (e: DragEvent) => {
  e.preventDefault();
  const row = (e.target as HTMLElement).closest('tr') as HTMLElement;
  if (!row || row === kkdDragSrcEl) return;
  row.classList.add('drag-over');
};

(window as any).handleKkdDragLeave = (e: DragEvent) => {
  const row = (e.target as HTMLElement).closest('tr') as HTMLElement;
  if (row) row.classList.remove('drag-over');
};

(window as any).handleKkdDragEnd = (e: DragEvent) => {
  if (kkdDragSrcEl) {
    kkdDragSrcEl.classList.remove('dragging');
  }
  document.querySelectorAll('#kkd-table-body tr').forEach(row => {
    row.classList.remove('drag-over');
    row.classList.remove('dragging');
  });
};

(window as any).handleKkdDrop = async (e: DragEvent) => {
  e.preventDefault();
  const targetRow = (e.target as HTMLElement).closest('tr') as HTMLElement;
  if (!targetRow) return;
  
  targetRow.classList.remove('drag-over');
  if (kkdDragSrcEl) kkdDragSrcEl.classList.remove('dragging');

  const draggedId = e.dataTransfer!.getData('text/plain');
  const targetId = targetRow.getAttribute('data-id');
  if (!draggedId || !targetId || draggedId === targetId) return;

  // Reorder items in kkdItemsList
  const draggedIdx = kkdItemsList.findIndex(item => item.id === draggedId);
  const targetIdx = kkdItemsList.findIndex(item => item.id === targetId);
  if (draggedIdx === -1 || targetIdx === -1) return;

  const [removed] = kkdItemsList.splice(draggedIdx, 1);
  kkdItemsList.splice(targetIdx, 0, removed);

  // Update order in firestore in a batch
  const batchUpdates: Promise<void>[] = [];
  kkdItemsList.forEach((item, index) => {
    item.order = index; // Update local state immediately
    batchUpdates.push(kkdService.updateKkdItemOrder(item.id, index));
  });

  try {
    (window as any).showToast?.('Sıralama güncelleniyor...', 'info');
    await Promise.all(batchUpdates);
    (window as any).showToast?.('Yeni sıralama kaydedildi.', 'success');
  } catch (err: any) {
    console.error("Sorting save error:", err);
    (window as any).showToast?.('Sıralama kaydedilemedi.', 'error');
  }
};

// Render checklist depending on equipment type
function renderInspectionChecklist(type: string) {
  const container = document.getElementById('inspect-checklist-items-container');
  if (!container) return;

  let checklistHtml = '';
  
  if (type === 'Emniyet Kemeri') {
    checklistHtml = `
      <label class="checklist-item">
        <input type="checkbox" id="check-straps" required>
        <span><strong>Dokuma Kolonları (Straps):</strong> Kesik, aşınma, erime, yıpranma yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-stitches" required>
        <span><strong>Dikişler:</strong> Kopuk, sökük veya gevşek dikiş yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-metals" required>
        <span><strong>Metal Aksamlar (D-Halkalar):</strong> Korozyon, deformasyon, çatlak yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-buckles" required>
        <span><strong>Tokalar ve Ayarlar:</strong> Kilit sistemi ve ayar mekanizmaları sorunsuz çalışıyor.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-labels" required>
        <span><strong>Etiket Durumu:</strong> Üretici etiketi ve seri numarası okunabiliyor.</span>
      </label>
    `;
  } else if (type === 'Lanyard' || type === 'Runner') {
    checklistHtml = `
      <label class="checklist-item">
        <input type="checkbox" id="check-rope" required>
        <span><strong>Halat / Dokuma Kolon:</strong> Yıpranma, kılcal tüylenme, kesik, aşınma yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-stitches" required>
        <span><strong>Dikişler ve Dikiş Kılıfı:</strong> Dikişler sağlam, koruyucu kılıf yırtılmamış.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-absorber" required>
        <span><strong>Şok Emici (Absorber):</strong> Açılmamış, yırtılmamış ve kılıfı zarar görmemiş.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-carabiners" required>
        <span><strong>Karabinalar:</strong> Yaylı kapılar ve kilit mekanizmaları sorunsuz çalışıyor.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-labels" required>
        <span><strong>Etiket Durumu:</strong> Seri numarası ve norm bilgileri okunabiliyor.</span>
      </label>
    `;
  } else if (type === 'Kurtarma Kiti') {
    checklistHtml = `
      <label class="checklist-item">
        <input type="checkbox" id="check-seal" required>
        <span><strong>Çanta ve Mühür:</strong> Kurtarma kiti çantası hasarsız, güvenlik mührü sağlam (açılmamış).</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-rope" required>
        <span><strong>Kurtarma İpi:</strong> Neme, küfe, aşınmaya veya kesiğe maruz kalmamış.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-devices" required>
        <span><strong>İniş / Kurtarma Cihazları:</strong> Korozyon, deformasyon, çatlak yok, mekanizma sağlam.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-carabiners" required>
        <span><strong>Bağlantı Karabinaları:</strong> Kilitlenmeler sorunsuz, korozyon yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-labels" required>
        <span><strong>Etiket Durumu:</strong> Yıllık kontrol etiketi ve seri numarası okunabiliyor.</span>
      </label>
    `;
  } else if (type === 'Baret') {
    checklistHtml = `
      <label class="checklist-item">
        <input type="checkbox" id="check-baret-shell" required>
        <span><strong>Dış Kabuk Kontrolü:</strong> Çatlak, ezilme, derin çizik, renk solması (UV yıpranması) veya erime yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-baret-suspension" required>
        <span><strong>İç Süspansiyon (Kolon/Bağlantılar):</strong> Kumaş kolonlarda veya plastik pimlerde yırtılma, kopma, aşınma yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-baret-chinstrap" required>
        <span><strong>Çene Bağı ve Toka:</strong> Toka kilitlenmesi sorunsuz çalışıyor, bağlarda yıpranma yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-baret-ratchet" required>
        <span><strong>Ayar Mekanizması (Çark/Vida):</strong> Boyut ayar çarkı sıkıştırma ve kilitleme işlevini tam yapıyor.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-baret-labels" required>
        <span><strong>Üretim Tarihi ve Etiket:</strong> Barete ait üretim yılı/ayı etiketi okunabiliyor (Ömür takibi için).</span>
      </label>
    `;
  } else {
    // General fallback checklist
    checklistHtml = `
      <label class="checklist-item">
        <input type="checkbox" id="check-general-webbing" required>
        <span><strong>Taşıyıcı Kolon / Gövde Kontrolü:</strong> Kesik, aşınma, deformasyon yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-general-stitching" required>
        <span><strong>Dikiş Kontrolü:</strong> Yük taşıyıcı dikişlerde sökülme yok.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-general-metals" required>
        <span><strong>Metal/Plastik Aksamlar:</strong> Paslanma, aşınma veya çatlak bulunmuyor.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-general-buckles" required>
        <span><strong>Kilit ve Bağlantılar:</strong> Yaylar ve kilitler sorunsuz kapatıyor.</span>
      </label>
      <label class="checklist-item">
        <input type="checkbox" id="check-general-labels" required>
        <span><strong>Etiket ve Seri No:</strong> Kimlik bilgileri tam ve okunabiliyor.</span>
      </label>
    `;
  }

  container.innerHTML = checklistHtml;
}

// INSPECTION Modal trigger
(window as any).openInspectKkdModal = (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  (document.getElementById('inspect-item-id') as HTMLInputElement).value = item.id;
  (document.getElementById('inspect-info-name') as HTMLElement).textContent = item.name;
  (document.getElementById('inspect-info-sn') as HTMLElement).textContent = item.serialNumber;
  (document.getElementById('inspect-info-brand') as HTMLElement).textContent = item.brandModel;
  (document.getElementById('inspect-info-person') as HTMLElement).textContent = item.assignedPerson;

  // Lifespan display in inspect modal
  const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);
  const lifespanEl = document.getElementById('inspect-info-lifespan') as HTMLElement;
  lifespanEl.className = `status-badge ${lifeInfo.expired ? 'reject' : 'ok'}`;
  lifespanEl.textContent = lifeInfo.text;

  // Set default inspect date to today (YYYY-MM-DD)
  const todayStr = new Date().toISOString().split('T')[0];
  (document.getElementById('inspect-input-date') as HTMLInputElement).value = todayStr;
  
  // Set default inspector to Fatih ZEBEK
  const userProfile = (window as any).state?.userProfile;
  let inspectorName = 'Fatih ZEBEK';
  if (userProfile && userProfile.displayName) {
    inspectorName = userProfile.displayName;
  } else if (userProfile && userProfile.email && !userProfile.email.includes('fatih') && !userProfile.email.includes('zebek')) {
    inspectorName = userProfile.email;
  }
  (document.getElementById('inspect-input-inspector') as HTMLInputElement).value = inspectorName;

  // Calculate proposed next date
  (window as any).calculateInspectNextDate();

  // Reset checklist result dropdown and next input
  const statusSelect = document.getElementById('inspect-input-status') as HTMLSelectElement;
  statusSelect.value = 'OK';
  (window as any).handleInspectionStatusChange('OK');

  (document.getElementById('inspect-input-notes') as HTMLTextAreaElement).value = '';

  // Reset image array and preview container
  currentInspectImages = [];
  const previewContainer = document.getElementById('inspect-image-preview');
  if (previewContainer) previewContainer.innerHTML = '';

  // Handle previous inspection photos display
  const prevPhotosGroup = document.getElementById('inspect-previous-photos-group');
  const prevPhotosContainer = document.getElementById('inspect-previous-photos-container');
  if (prevPhotosGroup && prevPhotosContainer) {
    prevPhotosGroup.style.display = 'none';
    prevPhotosContainer.innerHTML = '';
    
    kkdService.getInspectionHistory(item.id).then(logs => {
      if (logs && logs.length > 0) {
        // Find latest log that has images
        const lastLogWithImages = logs.find(log => log.images && log.images.length > 0);
        if (lastLogWithImages && lastLogWithImages.images) {
          prevPhotosGroup.style.display = 'block';
          prevPhotosContainer.innerHTML = lastLogWithImages.images.map(img => `
            <a href="${img}" target="_blank" style="display: block; width: 80px; height: 80px; border-radius: 6px; overflow: hidden; border: 1px solid var(--accent-orange); position: relative;">
              <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; bottom: 0; left: 0; right: 0; background: rgba(0,0,0,0.6); color: white; font-size: 0.55rem; text-align: center; padding: 2px 0;">
                ${formatDisplayDate(lastLogWithImages.inspectionDate)}
              </div>
            </a>
          `).join('');
        }
      }
    }).catch(err => console.error('Önceki muayene fotoğrafları yüklenirken hata:', err));
  }



  // Render checklist dynamically
  renderInspectionChecklist(item.name);

  (window as any).openKkdModal('modal-kkd-inspect');
};

// Submit Inspection
(window as any).submitKkdInspection = async (e: Event) => {
  e.preventDefault();

  const itemId = (document.getElementById('inspect-item-id') as HTMLInputElement).value;
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  const inspectionDate = (document.getElementById('inspect-input-date') as HTMLInputElement).value;
  const nextInspectionDate = (document.getElementById('inspect-input-next') as HTMLInputElement).value;
  const status = (document.getElementById('inspect-input-status') as HTMLSelectElement).value as any;
  const inspector = (document.getElementById('inspect-input-inspector') as HTMLInputElement).value;
  const notes = (document.getElementById('inspect-input-notes') as HTMLTextAreaElement).value.trim();

  // Build checklist JSON to save (based on what elements were rendered)
  const checklist: Record<string, boolean> = {};
  const inputs = document.querySelectorAll('#inspect-checklist-items-container input[type="checkbox"]');
  inputs.forEach((input: any) => {
    checklist[input.id] = input.checked;
  });

  const uploadedImages = currentInspectImages.filter(img => img !== '');

  const inspectionData = {
    itemName: item.name,
    itemSerialNumber: item.serialNumber,
    inspector,
    inspectionDate,
    status,
    notes,
    checklist,
    images: uploadedImages
  };

  try {
    await kkdService.performInspection(itemId, inspectionData, nextInspectionDate);
    (window as any).showToast?.('Periyodik kontrol kaydı girildi ve durum güncellendi.', 'success');
    (window as any).closeKkdModal('modal-kkd-inspect');

    // Auto-prompt to print the report
    setTimeout(async () => {
      if (confirm('Periyodik kontrol başarıyla kaydedildi. Muayene raporunu şimdi yazdırmak (PDF kaydetmek) ister misiniz?')) {
        const logs = await kkdService.getInspectionHistory(itemId);
        if (logs.length > 0) {
          (window as any).printKkdReport(itemId, logs[0].id);
        }
      }
    }, 600);
  } catch (err: any) {
    console.error(err);
    alert('Kontrol kaydı girilirken hata oluştu: ' + err.message);
  }
};

// VIEW HISTORY Modal trigger
(window as any).openKkdHistoryModal = async (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  (document.getElementById('history-info-name') as HTMLElement).textContent = item.name;
  (document.getElementById('history-info-sn') as HTMLElement).textContent = item.serialNumber;
  
  const container = document.getElementById('history-timeline-container');
  if (!container) return;

  container.innerHTML = `
    <div style="text-align:center; padding:1.5rem; color:var(--accent-cyan);">
      <i class="fa-solid fa-circle-notch fa-spin"></i> Geçmiş Yükleniyor...
    </div>
  `;

  (window as any).openKkdModal('modal-kkd-history');

  try {
    const logs = await kkdService.getInspectionHistory(itemId);
    if (logs.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; color: var(--text-muted); font-size: 0.85rem; padding: 1.5rem 0;">
          Bu ekipmana ait geçmiş kontrol kaydı bulunmuyor.
        </div>
      `;
      return;
    }

    container.innerHTML = logs.map(log => {
      let statusText = 'UYGUN (OK)';
      let statusClass = 'status-ok';
      if (log.status === 'REJECT') {
        statusText = 'RED / KULLANILAMAZ';
        statusClass = 'status-reject';
      } else if (log.status === 'RETIRED') {
        statusText = 'EMEKLİ / HURDA';
        statusClass = 'status-retired';
      }

      return `
        <div class="timeline-item ${statusClass}">
          <div class="timeline-date">${new Date(log.inspectionDate).toLocaleDateString('tr-TR')}</div>
          <div class="timeline-card">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 4px;">
              <div class="timeline-inspector">Denetleyen: ${log.inspector}</div>
              <button class="kkd-btn kkd-btn-outline" style="padding: 2px 6px; font-size: 0.7rem; border-radius: 4px;" onclick="window.printKkdReport('${itemId}', '${log.id}')" title="Muayene Raporunu Yazdır / PDF">
                <i class="fa-solid fa-print"></i> Rapor
              </button>
            </div>
            <div style="font-size:0.75rem; font-weight:800; margin-bottom: 5px; color:${log.status === 'OK' ? 'var(--accent-green)' : log.status === 'REJECT' ? 'var(--accent-red)' : '#94A3B8'};">
              Sonuç: ${statusText}
            </div>
            <div class="timeline-notes">${log.notes}</div>
            ${log.images && log.images.length > 0
              ? `
                <div style="display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px;">
                  ${log.images.map(img => `
                    <a href="${img}" target="_blank" style="display: block; width: 60px; height: 60px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
                      <img src="${img}" style="width: 100%; height: 100%; object-fit: cover;">
                    </a>
                  `).join('')}
                </div>
              `
              : ''
            }
          </div>
        </div>
      `;
    }).join('');

  } catch (err: any) {
    console.error(err);
    container.innerHTML = `<div style="color:var(--accent-red); font-size:0.85rem; text-align:center; padding:1.5rem 0;">Geçmiş yüklenirken hata oluştu!</div>`;
  }
};

// QR Scanning & matching
(window as any).handleKkdQrScan = async () => {
  try {
    const decodedText = await qrService.scanQRCode();
    if (!decodedText) return;

    // Parse the scanned text
    const cleanText = decodedText.trim();
    let serialNumber = cleanText;

    if (cleanText.includes('page=kkd-sorgu') && cleanText.includes('sn=')) {
      try {
        const urlObj = new URL(cleanText);
        serialNumber = urlObj.searchParams.get('sn') || cleanText;
      } catch (e) {
        const snMatch = cleanText.match(/\b\d{5,7}-\d{3,4}\b/);
        serialNumber = snMatch ? snMatch[0] : cleanText;
      }
    } else {
      const snMatch = cleanText.match(/\b\d{5,7}-\d{3,4}\b/);
      serialNumber = snMatch ? snMatch[0] : cleanText;
    }

    // Search inside database list
    const foundItem = kkdItemsList.find(i => 
      i.serialNumber.toLowerCase() === serialNumber.toLowerCase() ||
      i.serialNumber.toLowerCase().includes(serialNumber.toLowerCase()) ||
      serialNumber.toLowerCase().includes(i.serialNumber.toLowerCase())
    );

    if (foundItem) {
      (window as any).showToast?.(`Eşleşen donanım bulundu: ${foundItem.brandModel} (${foundItem.serialNumber})`, 'success');
      
      // Filter search input automatically to show only this item
      const searchBox = document.getElementById('kkd-search-input') as HTMLInputElement;
      if (searchBox) {
        searchBox.value = foundItem.serialNumber;
      }
      (window as any).filterKkdTable(foundItem.id);

      // Open inspection modal directly after a small delay
      setTimeout(() => {
        (window as any).openInspectKkdModal(foundItem.id);
      }, 500);
    } else {
      // Not found in inventory, open Add Equipment modal and prefill serial number
      if (confirm(`Seri numarası "${serialNumber}" olan ekipman envanterde bulunamadı. Yeni ekipman kartı oluşturmak ister misiniz?`)) {
        (window as any).openAddKkdModal();
        
        // Prefill fields
        const snInput = document.getElementById('kkd-input-sn') as HTMLInputElement;
        if (snInput) snInput.value = serialNumber;

        // Detect brand if Skylotec is in the scanned text
        if (cleanText.toUpperCase().includes('SKYLOTEC') || cleanText.toUpperCase().includes('SKYSAFE') || cleanText.toUpperCase().includes('IGNITE')) {
          const brandInput = document.getElementById('kkd-input-brand') as HTMLInputElement;
          if (brandInput) brandInput.value = 'SKYLOTEC';
        }
      }
    }
  } catch (err: any) {
    if (err.message !== 'Canceled') {
      console.error('QR Scan Error:', err);
      alert('Kamera veya tarayıcı hatası: ' + err.message);
    }
  }
};

// Excel Exporting using SheetJS (XLSX)
(window as any).exportKkdToExcel = () => {
  if (kkdItemsList.length === 0) {
    alert('Dışa aktarılacak ekipman kaydı bulunmuyor.');
    return;
  }

  // Get current active filters
  const searchInput = (document.getElementById('kkd-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
  const typeFilter = (document.getElementById('kkd-type-filter') as HTMLSelectElement)?.value || 'ALL';
  const statusFilter = (document.getElementById('kkd-status-filter') as HTMLSelectElement)?.value || 'ALL';
  const timeFilter = (document.getElementById('kkd-time-filter') as HTMLSelectElement)?.value || 'ALL';
  
  const todayStr = new Date().toISOString().split('T')[0];

  const filtered = kkdItemsList.filter(item => {
    // 1. Search Query
    const queryMatch = 
      item.serialNumber.toLowerCase().includes(searchInput) ||
      (item.assignedPerson || '').toLowerCase().includes(searchInput) ||
      (item.brandModel || '').toLowerCase().includes(searchInput);

    if (!queryMatch) return false;

    // 2. Type Filter
    if (typeFilter !== 'ALL' && item.name !== typeFilter) return false;

    // 3. Status Filter
    const itemStatus = !item.lastInspectionDate ? 'PENDING' : item.status;
    if (statusFilter !== 'ALL' && itemStatus !== statusFilter) return false;

    // 4. Time Filter
    const isOverdue = itemStatus === 'OK' && item.nextInspectionDate && item.nextInspectionDate <= todayStr;
    
    let isComing = false;
    if (itemStatus === 'OK' && item.nextInspectionDate && !isOverdue) {
      const nextDate = new Date(item.nextInspectionDate);
      const diffTime = nextDate.getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      isComing = diffDays >= 0 && diffDays <= 30;
    }

    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);

    if (timeFilter === 'OVERDUE' && !isOverdue) return false;
    if (timeFilter === 'COMING' && !isComing) return false;
    if (timeFilter === 'EXPIRED' && !lifeInfo.expired) return false;
    if (timeFilter === 'OK_TIME' && (isOverdue || isComing || lifeInfo.expired)) return false;

    return true;
  });

  // Map to flat JSON data for SheetJS
  const excelData = filtered.map(item => {
    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);
    const itemStatus = !item.lastInspectionDate ? 'PENDING' : item.status;
    let statusText = 'UYGUN';
    if (itemStatus === 'REJECT') statusText = 'RED';
    else if (itemStatus === 'RETIRED') statusText = 'EMEKLİ/HURDA';
    else if (itemStatus === 'PENDING') statusText = 'KONTROL BEKLİYOR';

    return {
      'Atanan Personel / Saha': item.assignedPerson || '',
      'Seri Numarası': item.serialNumber,
      'Ekipman Tipi': item.name,
      'Marka / Model': item.brandModel,
      'Üretim Tarihi': item.manufactureDate || '',
      'Kullanım Ömrü Bitiş': lifeInfo.expiryDate || '',
      'Kalan Kullanım Ömrü': lifeInfo.text,
      'Son Periyodik Kontrol': item.lastInspectionDate || 'Hiç Yapılmadı',
      'Sonraki Periyodik Kontrol': item.nextInspectionDate || '',
      'Durum': statusText,
      'Notlar': item.notes || ''
    };
  });

  // Create sheet & workbook
  const worksheet = XLSX.utils.json_to_sheet(excelData);
  const workbook = XLSX.utils.book_new();
  
  // Set sheet columns width for better presentation
  worksheet['!cols'] = [
    { wch: 25 }, // Assigned
    { wch: 16 }, // SN
    { wch: 18 }, // Type
    { wch: 30 }, // Brand
    { wch: 14 }, // Mfg
    { wch: 16 }, // Expiry Date
    { wch: 20 }, // Expiry status
    { wch: 18 }, // Last inspection
    { wch: 18 }, // Next inspection
    { wch: 14 }, // Status
    { wch: 40 }  // Notes
  ];

  XLSX.utils.book_append_sheet(workbook, worksheet, 'KKD Periyodik Muayene Listesi');
  
  // Download file
  const dateStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `DH_Servis_KKD_Kontrol_Raporu_${dateStr}.xlsx`);
  
  (window as any).showToast?.('Excel raporu başarıyla indirildi.', 'success');
};

const CHECKLIST_LABELS: Record<string, string> = {
  'check-straps': 'Dokuma Kolonları (Straps) Durumu',
  'check-stitches': 'Yük Taşıyan Dikişlerin Durumu',
  'check-metals': 'D-Halkalar ve Metal Aksam Durumu',
  'check-buckles': 'Ayar Tokaları ve Kilit Sistemleri',
  'check-labels': 'Etiket ve Seri No Okunabilirliği',
  'check-rope': 'Halat veya Kolon Yıpranma Durumu',
  'check-absorber': 'Şok Emici (Absorber) Açılma Kontrolü',
  'check-carabiners': 'Karabina Kapısı ve Kilit Mekanizması',
  'check-seal': 'Kurtarma Çantası ve Güvenlik Mührü',
  'check-devices': 'Kurtarma/İniş Cihazları Mekanizması',
  'check-baret-shell': 'Baret Dış Kabuk Hasar ve UV Kontrolü',
  'check-baret-suspension': 'Kask İç Süspansiyonu ve Bağlantıları',
  'check-baret-chinstrap': 'Çene Bağı Mukavemeti ve Tokası',
  'check-baret-ratchet': 'Boyut Ayar Mekanizması (Çark Ayarı)',
  'check-baret-labels': 'Baret Üretim Tarihi ve Etiketi',
  'check-general-webbing': 'Genel Taşıyıcı Kolon Kontrolü',
  'check-general-stitching': 'Genel Dikiş Mukavemeti',
  'check-general-metals': 'Genel Metal/Plastik Parçalar',
  'check-general-buckles': 'Genel Kilit ve Bağlantılar',
  'check-general-labels': 'Genel Seri No ve Etiket Durumu'
};

// Print the latest inspection PDF directly
(window as any).printLastKkdReport = async (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  try {
    const logs = await kkdService.getInspectionHistory(itemId);
    if (logs.length === 0) {
      alert("Bu ekipmana ait henüz periyodik kontrol kaydı bulunmuyor.");
      return;
    }
    // The logs are returned sorted by date descending, so logs[0] is the latest
    await (window as any).printKkdReport(itemId, logs[0].id);
  } catch (error) {
    console.error("Rapor yazdırılırken hata oldu:", error);
    alert("Rapor hazırlanırken hata oluştu.");
  }
};

(window as any).printKkdReport = async (itemId: string, inspectionId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  try {
    const log = await kkdService.getInspection(inspectionId);
    if (!log) {
      alert("Muayene kaydı bulunamadı.");
      return;
    }

    const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);
    const isFatih = log.inspector.toLowerCase().includes('fatih') || 
                    log.inspector.toLowerCase().includes('zebek') || 
                    log.inspector.toLowerCase().includes('yetkili');
    const inspectorSubtitle = isFatih 
      ? `Skylotec Yetkili KKD Denetçisi<br>Sertifika (Skylotec ID): 233582 (EN 365)`
      : `Denetçi / Admin`;
    const inspectorNameToShow = isFatih ? 'Fatih ZEBEK' : log.inspector;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Açılır pencere engellendi. Lütfen izin verin.');
      return;
    }

    // Build checklist rows
    let checklistRows = '';
    if (log.checklist && Object.keys(log.checklist).length > 0) {
      checklistRows = Object.entries(log.checklist).map(([key, value]) => {
        const label = CHECKLIST_LABELS[key] || key;
        const statusText = value ? 'UYGUN' : 'UYGUN DEĞİL';
        const statusColor = value ? '#008000' : '#FF0000';
        return `
          <tr>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 8.5pt; text-align: left;">${label}</td>
            <td style="padding: 5px 8px; border: 1px solid #cbd5e1; font-size: 8.5pt; text-align: center; font-weight: bold; color: ${statusColor};">
              ${statusText}
            </td>
          </tr>
        `;
      }).join('');
    } else {
      checklistRows = `
        <tr>
          <td colspan="2" style="padding: 8px; border: 1px solid #cbd5e1; font-size: 8.5pt; text-align: center; color: #64748b;">
            Genel fiziksel muayene yapılmıştır.
          </td>
        </tr>
      `;
    }

    const formatPrintDate = (val: string | undefined) => {
      if (!val) return '---';
      if (val.length === 7) {
        const [y, m] = val.split('-');
        return `${m}.${y}`;
      }
      const dateObj = new Date(val);
      if (isNaN(dateObj.getTime())) return val;
      return dateObj.toLocaleDateString('tr-TR');
    };

    const mfgDateText = formatPrintDate(item.manufactureDate);
    const expiryText = formatPrintDate(lifeInfo.expiryDate);
    const lastInspText = formatPrintDate(log.inspectionDate);
    const nextInspText = log.status === 'OK' && item.nextInspectionDate ? formatPrintDate(item.nextInspectionDate) : '---';

    let resultText = '';
    let resultColor = '';
    let resultBg = '';
    if (log.status === 'OK') {
      resultText = 'KULLANIMA UYGUNDUR (OK)';
      resultColor = '#15803d';
      resultBg = '#f0fdf4';
    } else if (log.status === 'REJECT') {
      resultText = 'KULLANIMA UYGUN DEĞİLDİR (RED)';
      resultColor = '#b91c1c';
      resultBg = '#fef2f2';
    } else if (log.status === 'RETIRED') {
      resultText = 'HURDA / EMEKLİ EDİLMİŞTİR (RETIRED)';
      resultColor = '#475569';
      resultBg = '#f8fafc';
    }

    printWindow.document.write(`
      <html>
        <head>
          <title>KKD Muayene Raporu - ${item.serialNumber}</title>
          <style>
            @media print {
              body { background: white; color: black; padding: 0px; font-size: 9pt; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
              .no-print { display: none; }
              @page { size: A4; margin: 10mm; }
              .report-container { border: none !important; box-shadow: none !important; padding: 0 !important; max-width: 100% !important; }
            }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; margin: 0; padding: 20px; color: #1e293b; background: #fff; line-height: 1.4; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
            .report-container { max-width: 850px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.05); }
            .header-table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
            .header-logo { width: 100px; text-align: left; }
            .header-title { text-align: center; }
            .report-title { font-size: 13pt; font-weight: 800; letter-spacing: 0.5px; margin-top: 3px; text-transform: uppercase; color: #0f172a; }
            .section-title { font-size: 9pt; font-weight: bold; background: #f1f5f9; padding: 4px 8px; margin-top: 10px; margin-bottom: 6px; border-left: 4px solid #1e3a8a; text-transform: uppercase; color: #1e3a8a; letter-spacing: 0.5px; }
            .info-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .info-table td { padding: 5px 8px; border: 1px solid #e2e8f0; font-size: 8.5pt; }
            .info-table td.label { font-weight: bold; background: #f8fafc; width: 25%; color: #475569; }
            .checklist-table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
            .checklist-table th { background: #f8fafc; padding: 6px 8px; font-weight: bold; border: 1px solid #cbd5e1; text-align: left; font-size: 8.5pt; color: #475569; }
            .verdict-box { border: 2px solid ${resultColor}; background: ${resultBg}; padding: 10px 15px; border-radius: 6px; text-align: center; margin-top: 10px; page-break-inside: avoid; }
            .verdict-title { font-size: 11pt; font-weight: 800; color: ${resultColor}; }
            .signature-section { width: 100%; margin-top: 15px; border-collapse: collapse; page-break-inside: avoid; }
            .signature-section td { text-align: center; vertical-align: top; width: 33%; font-size: 8pt; padding-top: 10px; color: #334155; }
            .signature-line { width: 150px; border-top: 1px solid #333; margin: 0 auto 5px auto; }
          </style>
        </head>
        <body>
          <div class="report-container">
            <table class="header-table" style="width: 100%; border-collapse: collapse; margin-bottom: 12px; border-bottom: 3px solid #002d6b; padding-bottom: 10px;">
              <tr>
                <td style="vertical-align: middle; text-align: left; padding: 0;">
                  <table style="border-collapse: collapse; border: none; margin: 0; padding: 0;">
                    <tr>
                      <td style="width: 48px; border: none; padding: 0; vertical-align: middle; background: transparent;">
                        <!-- Inline SVG to guarantee dark blue color and white text print correctly -->
                        <svg width="48" height="48" viewBox="0 0 50 50" fill="none" xmlns="http://www.w3.org/2000/svg" style="display: block;">
                          <rect width="50" height="50" rx="8" fill="#002D6B"/>
                          <text x="25" y="36" fill="#FFFFFF" font-family="Arial, sans-serif" font-weight="900" font-size="34" text-anchor="middle" letter-spacing="-2">dh</text>
                        </svg>
                      </td>
                      <td style="border: none; padding: 0 0 0 12px; vertical-align: middle; text-align: left; background: transparent;">
                        <h1 style="font-size: 1.3rem; margin: 0 0 2px 0; font-weight: 900; letter-spacing: 0.5px; color: #002d6b; font-family: sans-serif; line-height: 1.1;">DEMİRER HOLDİNG</h1>
                        <div style="font-size: 0.85rem; color: #475569; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">KİŞİSEL KORUYUCU DONANIM (KKD) PERİYODİK KONTROL RAPORU</div>
                      </td>
                    </tr>
                  </table>
                </td>
                <td style="text-align: right; font-size: 8pt; color: #64748b; line-height: 1.4; width: 200px; vertical-align: middle; padding: 0;">
                  <strong style="color: #c00000; font-size: 8.5pt;">Rapor No: DH-KKD-${new Date(log.inspectionDate).getFullYear()}-${log.id.substring(0, 5).toUpperCase()}</strong><br>
                  <strong>Muayene Tarihi:</strong> ${lastInspText}<br>
                  <strong>Baskı Tarihi:</strong> ${new Date().toLocaleDateString('tr-TR')}
                </td>
              </tr>
            </table>

            <div class="section-title">1. Ekipman Künye Bilgileri</div>
            <table class="info-table">
              <tr>
                <td class="label">Ekipman Tipi</td>
                <td><strong>${item.name}</strong></td>
                <td class="label">Seri Numarası (S/N)</td>
                <td><strong style="font-family: monospace; font-size: 9.5pt; color: #1e3a8a;">${item.serialNumber}</strong></td>
              </tr>
              <tr>
                <td class="label">Marka / Model</td>
                <td>${item.brandModel}</td>
                <td class="label">Atanan Personel / Saha</td>
                <td>${item.assignedPerson || '---'}</td>
              </tr>
              <tr>
                <td class="label">Üretim Tarihi</td>
                <td>${mfgDateText}</td>
                <td class="label">Kullanım Ömrü Bitiş</td>
                <td>${expiryText} (${item.lifespanYears || 10} Yıl Ömür Sınırı)</td>
              </tr>
              <tr>
                <td class="label">Son Kontrol Tarihi</td>
                <td>${lastInspText}</td>
                <td class="label">Bir Sonraki Kontrol Tarihi</td>
                <td><strong style="color: #1e3a8a;">${nextInspText}</strong></td>
              </tr>
              <tr>
                <td class="label">Kalan Kullanım Ömrü</td>
                <td colspan="3">${lifeInfo.expired ? '<span style="color: red; font-weight: bold;">KULLANIM ÖMRÜ DOLMUŞTUR</span>' : lifeInfo.text}</td>
              </tr>
            </table>

            <div class="section-title">2. Muayene Bulguları ve Değerlendirme Listesi</div>
            <table class="checklist-table">
              <thead>
                <tr>
                  <th style="width: 70%;">Kontrol Edilen Yapısal/Fiziksel Parametreler</th>
                  <th style="width: 30%; text-align: center;">Muayene Durumu</th>
                </tr>
              </thead>
              <tbody>
                ${checklistRows}
              </tbody>
            </table>

            <div class="section-title">3. Denetçi Notları ve İnceleme Bulguları</div>
            <div style="border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 4px; font-size: 8.5pt; min-height: 25px; line-height: 1.35; background: #f8fafc;">
              ${log.notes || 'Herhangi bir hasar veya yıpranma izine rastlanmamıştır.'}
            </div>

            <div class="verdict-box">
              <div style="font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: bold; margin-bottom: 2px;">Muayene ve Test Kararı</div>
              <div class="verdict-title">${resultText}</div>
              <div style="font-size: 8pt; color: #475569; margin-top: 4px;">
                ${log.status === 'OK' 
                  ? `İşbu donanım, yapılan periyodik fiziksel muayene kriterlerini tam olarak karşılamış olup, bir sonraki kontrol tarihi olan <strong>${nextInspText}</strong> tarihine kadar iş güvenliği kurallarına uygun olarak sahada kullanılması uygundur.` 
                  : `İşbu donanım, yapılan kontroller sonucunda tespit edilen yapısal kusurlar veya kullanım ömrü aşımı nedeniyle <strong>İŞ GÜVENLİĞİ AÇISINDAN TEHLİKELİDİR</strong>. Kesinlikle kullanılamaz ve imha edilmelidir.`}
              </div>
            </div>

            ${log.images && log.images.length > 0
              ? `
                <div class="section-title" style="page-break-inside: avoid;">4. Muayene Görselleri / Hasar & Kusur Fotoğrafları</div>
                <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; margin-bottom: 10px; page-break-inside: avoid;">
                  ${log.images.map(img => `
                    <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 3px; background: #fff; width: 95px; height: 95px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                      <img src="${img}" style="max-width: 100%; max-height: 100%; object-fit: contain;">
                    </div>
                  `).join('')}
                </div>
              `
              : ''
            }

            <table class="signature-section">
              <tr>
                <td>
                  <strong>KONTROLÜ YAPAN YETKİLİ</strong><br>
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px; line-height: 1.3;">(${inspectorSubtitle})</div>
                  <div style="height: 30px;"></div>
                  <div class="signature-line"></div>
                  <strong>${inspectorNameToShow}</strong>
                </td>
                <td>
                  <strong>TESLİM ALAN PERSONEL</strong><br>
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">(Ekipman Kullanıcısı)</div>
                  <div style="height: 30px;"></div>
                  <div class="signature-line"></div>
                  <strong>${item.assignedPerson || '................................'}</strong>
                </td>
                <td>
                  <strong>İŞ SAĞLIĞI VE GÜVENLİĞİ</strong><br>
                  <div style="font-size: 7.5pt; color: #64748b; margin-top: 2px;">(İSG Temsilcisi)</div>
                  <div style="height: 30px;"></div>
                  <div class="signature-line"></div>
                  <strong>Sercan YETKİN</strong><br>
                  <span style="font-size: 8pt; color: #475569;">Çevre ve İş Güvenliği Uzmanı</span>
                </td>
              </tr>
            </table>
          </div>
          <script>
            window.onload = () => {
              const images = Array.from(document.querySelectorAll('img'));
              if (images.length === 0) {
                setTimeout(() => window.print(), 300);
                return;
              }
              let loadedCount = 0;
              const onImageLoad = () => {
                loadedCount++;
                if (loadedCount === images.length) {
                  setTimeout(() => window.print(), 500);
                }
              };
              images.forEach(img => {
                if (img.complete) {
                  onImageLoad();
                } else {
                  img.addEventListener('load', onImageLoad);
                  img.addEventListener('error', onImageLoad);
                }
              });
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

  } catch (err: any) {
    console.error(err);
    alert('Rapor hazırlanırken hata oluştu: ' + err.message);
  }
};

// Ensure memory cleanup when navigating away
const originalNavigate = (window as any).navigate;
(window as any).navigate = function(page: string, param?: any) {
  if (unsubscribeKkd) {
    unsubscribeKkd();
    unsubscribeKkd = null;
  }
  if (originalNavigate) {
    originalNavigate(page, param);
  }
};

// Excel Template Download
(window as any).downloadKkdTemplate = () => {
  const sampleData = [
    {
      'Personel / Saha': 'Fatih ZEBEK',
      'Seri Numarası': 'SK-987456',
      'Tip': 'Emniyet Kemeri',
      'Marka / Model': 'Skylotec / G-1132-WS',
      'Üretim Tarihi': '2024-01',
      'Kullanım Ömrü (Yıl)': 10,
      'Son Kontrol Tarihi': '2025-01',
      'Notlar': 'Örnek kayıt - Bu satırı silebilirsiniz'
    },
    {
      'Personel / Saha': 'Ahmet YILMAZ',
      'Seri Numarası': 'LY-123456',
      'Tip': 'Lanyard',
      'Marka / Model': 'Skylotec / L0568-1,8',
      'Üretim Tarihi': '2024-03',
      'Kullanım Ömrü (Yıl)': 10,
      'Son Kontrol Tarihi': '', // Boş bırakılırsa Kontrol Bekliyor olur
      'Notlar': 'Son kontrolü yapılmadı, kontrol bekliyor olacak'
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'KKD Sablon');
  
  // Column widths
  worksheet['!cols'] = [
    { wch: 25 }, // Assigned
    { wch: 20 }, // SN
    { wch: 18 }, // Type
    { wch: 30 }, // Brand
    { wch: 14 }, // Mfg
    { wch: 20 }, // Lifespan Years
    { wch: 18 }, // Last inspection
    { wch: 40 }  // Notes
  ];

  XLSX.writeFile(workbook, 'DH_Servis_KKD_Yukleme_Sablonu.xlsx');
  (window as any).showToast?.('Şablon Excel dosyası indirildi.', 'success');
};

// Helper to normalize dates from Excel (supporting Date, strings, serials)
const normalizeExcelDate = (val: any): string => {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = val.getMonth() + 1;
    return `${y}-${m < 10 ? '0' + m : m}`;
  }
  const str = String(val).trim();
  if (!str) return '';
  
  // Check if numeric serial (Excel date serial)
  if (/^\d+(\.\d+)?$/.test(str)) {
    const dateObj = new Date((Number(str) - 25569) * 86400 * 1000);
    if (!isNaN(dateObj.getTime())) {
      const y = dateObj.getFullYear();
      const m = dateObj.getMonth() + 1;
      return `${y}-${m < 10 ? '0' + m : m}`;
    }
  }
  
  // Format parsing
  const yyyymmddMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (yyyymmddMatch) {
    return `${yyyymmddMatch[1]}-${yyyymmddMatch[2].padStart(2, '0')}`;
  }
  const yyyymmMatch = str.match(/^(\d{4})[-/](\d{1,2})/);
  if (yyyymmMatch) {
    return `${yyyymmMatch[1]}-${yyyymmMatch[2].padStart(2, '0')}`;
  }
  const ddMMyyyyMatch = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/);
  if (ddMMyyyyMatch) {
    return `${ddMMyyyyMatch[3]}-${ddMMyyyyMatch[2].padStart(2, '0')}`;
  }
  if (/^\d{4}$/.test(str)) {
    return `${str}-01`;
  }
  return str;
};

// Excel Upload Parser
(window as any).importKkdFromExcel = (event: Event) => {
  const input = event.target as HTMLInputElement;
  if (!input.files || input.files.length === 0) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = async (e) => {
    try {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];

      if (jsonData.length === 0) {
        alert('Seçilen Excel dosyasında hiç veri bulunamadı.');
        return;
      }

      (window as any).showToast?.(`${jsonData.length} adet ekipman okunuyor...`, 'info');

      let successCount = 0;
      let duplicateCount = 0;
      let failCount = 0;

      // Get current max order to append items at the end
      let maxOrder = 0;
      if (kkdItemsList && kkdItemsList.length > 0) {
        maxOrder = Math.max(...kkdItemsList.map(item => item.order || 0));
      }

      // Existing serials set to prevent duplicate adds
      const existingSerials = new Set((kkdItemsList || []).map(item => item.serialNumber.toLowerCase().trim()));

      // Add items sequentially
      for (const row of jsonData) {
        const serialNumber = String(row['Seri Numarası'] || '').trim();
        const typeName = String(row['Tip'] || '').trim();
        const brandModel = String(row['Marka / Model'] || '').trim();

        if (!serialNumber || !typeName) {
          failCount++;
          continue;
        }

        // Prevent duplicate serial numbers
        if (existingSerials.has(serialNumber.toLowerCase())) {
          duplicateCount++;
          continue;
        }

        // Map type names to valid equipment types
        let nameValue = 'Emniyet Kemeri';
        const typeNormalized = typeName.toLowerCase();
        if (typeNormalized.includes('kemer')) nameValue = 'Emniyet Kemeri';
        else if (typeNormalized.includes('lanyard')) nameValue = 'Lanyard';
        else if (typeNormalized.includes('runner')) nameValue = 'Runner';
        else if (typeNormalized.includes('kurtarma') || typeNormalized.includes('kit')) nameValue = 'Kurtarma Kiti';
        else if (typeNormalized.includes('baret')) nameValue = 'Baret';
        else {
          nameValue = typeName;
        }

        const manufactureDate = normalizeExcelDate(row['Üretim Tarihi']);
        const lastInspectionDate = normalizeExcelDate(row['Son Kontrol Tarihi']);
        const lifespanYears = Number(row['Kullanım Ömrü (Yıl)']) || 10;
        const assignedPerson = String(row['Personel / Saha'] || '').trim();
        const notes = String(row['Notlar'] || '').trim();

        // Calculate next inspection date if last inspection date is provided
        let nextInspectionDate = '';
        let statusVal: 'OK' | 'REJECT' | 'RETIRED' | 'PENDING' = 'PENDING';

        if (lastInspectionDate) {
          statusVal = 'OK';
          // Calculate next inspection date (typically +12 months from last inspection)
          try {
            const parts = lastInspectionDate.split('-');
            if (parts.length >= 2) {
              let year = parseInt(parts[0], 10);
              let month = parseInt(parts[1], 10);
              month += 12;
              if (month > 12) {
                year += Math.floor((month - 1) / 12);
                month = ((month - 1) % 12) + 1;
              }
              const nextMonthStr = month < 10 ? `0${month}` : `${month}`;
              nextInspectionDate = `${year}-${nextMonthStr}`;
            }
          } catch (err) {
            console.error('Tarih hesaplama hatası:', err);
          }
        }

        maxOrder++;

        const itemData = {
          name: nameValue,
          brandModel: brandModel,
          serialNumber: serialNumber,
          assignedPerson: assignedPerson,
          manufactureDate: manufactureDate,
          firstUseDate: '',
          lastInspectionDate: lastInspectionDate,
          nextInspectionDate: nextInspectionDate,
          status: statusVal,
          lifespanYears: lifespanYears,
          notes: notes,
          bypassLock: false,
          order: maxOrder
        };

        try {
          await kkdService.addKkdItem(itemData);
          successCount++;
        } catch (err) {
          console.error('Firestore kaydetme hatası:', err);
          failCount++;
        }
      }

      let toastMsg = `${successCount} adet ekipman başarıyla eklendi.`;
      if (duplicateCount > 0) {
        toastMsg += ` ${duplicateCount} kayıt seri numarası çakıştığı için atlandı.`;
      }
      if (failCount > 0) {
        toastMsg += ` ${failCount} kayıt hatalı olduğu için yüklenemedi.`;
      }

      (window as any).showToast?.(toastMsg, successCount > 0 ? 'success' : 'warning');
      input.value = '';
    } catch (err) {
      console.error(err);
      alert('Excel dosyası okunurken hata oluştu. Lütfen dosya formatını kontrol edin.');
    }
  };

  reader.readAsArrayBuffer(file);
};

// QR Label Printing (Single Card)
(window as any).printKkdQrLabel = (itemId: string) => {
  const item = kkdItemsList.find(i => i.id === itemId);
  if (!item) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Açılır pencere engellendi. Lütfen izin verin.');
    return;
  }

  const targetUrl = `${window.location.origin}/?page=kkd-sorgu&sn=${encodeURIComponent(item.serialNumber)}`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(targetUrl)}`;

  printWindow.document.write(`
    <html>
      <head>
        <title>QR Etiket - ${item.serialNumber}</title>
        <style>
          @media print {
            body { margin: 0; padding: 0; }
            .no-print { display: none; }
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: #fff;
          }
          .label-card {
            width: 280px;
            border: 2px dashed #334155;
            padding: 15px;
            text-align: center;
            border-radius: 8px;
            background: #fff;
            box-sizing: border-box;
          }
          .logo-text {
            font-size: 11px;
            font-weight: bold;
            color: #002D6B;
            letter-spacing: 1px;
            margin-bottom: 8px;
            text-transform: uppercase;
          }
          .qr-img {
            width: 140px;
            height: 140px;
            margin: 8px 0;
          }
          .item-name {
            font-size: 12px;
            font-weight: bold;
            color: #1e293b;
            margin: 4px 0;
          }
          .item-model {
            font-size: 10px;
            color: #64748b;
            margin: 2px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .item-sn {
            font-size: 14px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.5px;
            background: #f1f5f9;
            padding: 4px 0;
            border-radius: 4px;
            margin-top: 8px;
            border: 1px solid #e2e8f0;
          }
          .print-btn {
            margin-top: 15px;
            padding: 6px 12px;
            font-size: 11px;
            background: #002D6B;
            color: #fff;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
          }
        </style>
      </head>
      <body>
        <div class="label-card">
          <div class="logo-text">DH DEMİRER HOLDİNG</div>
          <div style="font-size: 9px; color: #64748b; margin-top: -5px;">KKD Takip Sistemi</div>
          <img src="${qrUrl}" class="qr-img" onload="window.print()" />
          <div class="item-name">${item.name}</div>
          <div class="item-model">${item.brandModel}</div>
          <div class="item-sn">${item.serialNumber}</div>
          <button class="print-btn no-print" onclick="window.print()">Yazdır</button>
        </div>
      </body>
    </html>
  `);
  printWindow.document.close();
};

// Bulk QR Printing Modals & Actions
(window as any).openKkdBulkQrModal = () => {
  (window as any).openKkdModal('modal-kkd-bulk-qr');
};

(window as any).updateBulkQrLayoutWarning = () => {
  const layout = (document.getElementById('bulk-qr-layout') as HTMLSelectElement).value;
  const noteEl = document.getElementById('bulk-qr-layout-note');
  if (noteEl) {
    if (layout === 'layout-28') {
      noteEl.innerHTML = `<i class="fa-solid fa-scissors"></i> A4 14'lü etiket tabakası kullanıyorsanız, bu mod her etiketi dikey olarak ikiye böler (toplam 28 küçük etiket). Çıktı aldıktan sonra ortadan kesip kullanabilirsiniz.`;
      noteEl.style.color = 'var(--accent-cyan)';
    } else if (layout === 'layout-20-vertical') {
      noteEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Örnekteki gibi QR kodunun ortada, bilgilerin dikey olarak dizildiği şık dikey tasarım. Bir A4 sayfasında 20 adet etiket (4 sütun x 5 satır) basılır.`;
      noteEl.style.color = '#10B981';
    } else {
      noteEl.innerHTML = `<i class="fa-solid fa-circle-info"></i> Kurtarma kitleri ve baretler için en uygun boyuttur. Bir A4 sayfasında 14 adet büyük etiket (2 sütun x 7 satır) basılır.`;
      noteEl.style.color = '#fbbf24';
    }
  }
};

(window as any).printKkdBulkQrLabels = () => {
  const scope = (document.getElementById('bulk-qr-scope') as HTMLSelectElement).value;
  const layout = (document.getElementById('bulk-qr-layout') as HTMLSelectElement).value;

  let itemsToPrint = [...kkdItemsList];
  if (scope === 'filtered') {
    const searchInput = (document.getElementById('kkd-search-input') as HTMLInputElement)?.value.toLowerCase() || '';
    const typeFilter = (document.getElementById('kkd-type-filter') as HTMLSelectElement)?.value || 'ALL';
    const statusFilter = (document.getElementById('kkd-status-filter') as HTMLSelectElement)?.value || 'ALL';

    itemsToPrint = kkdItemsList.filter(item => {
      const matchSearch = !searchInput || 
        item.serialNumber.toLowerCase().includes(searchInput) ||
        (item.assignedPerson && item.assignedPerson.toLowerCase().includes(searchInput)) ||
        item.brandModel.toLowerCase().includes(searchInput);

      const matchType = typeFilter === 'ALL' || item.name === typeFilter;
      const todayStr = new Date().toISOString().split('T')[0];
      const lifeInfo = getLifespanInfo(item.manufactureDate, item.lifespanYears);
      const isOverdue = !item.lastInspectionDate || !!(item.nextInspectionDate && item.nextInspectionDate <= todayStr);
      const isExpired = !!lifeInfo.expired;

      let matchStatus = true;
      if (statusFilter !== 'ALL') {
        if (statusFilter === 'OVERDUE') matchStatus = isOverdue;
        else if (statusFilter === 'EXPIRED') matchStatus = isExpired;
        else matchStatus = item.status === statusFilter;
      }

      return matchSearch && matchType && matchStatus;
    });
  }

  if (itemsToPrint.length === 0) {
    alert("Yazdırılacak ekipman bulunamadı.");
    return;
  }

  (window as any).closeKkdModal('modal-kkd-bulk-qr');

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Açılır pencere engellendi. Lütfen izin verin.');
    return;
  }

  let labelGridHtml = '';
  const isLayout28 = layout === 'layout-28';
  const isLayout20V = layout === 'layout-20-vertical';
  const columnsCount = isLayout28 ? 4 : (isLayout20V ? 4 : 2);

  const pageSize = isLayout28 ? 28 : (isLayout20V ? 20 : 14);
  const totalPages = Math.ceil(itemsToPrint.length / pageSize);

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItems = itemsToPrint.slice(pageIdx * pageSize, (pageIdx + 1) * pageSize);
    
    labelGridHtml += `
      <div class="a4-page">
        <div class="labels-container ${isLayout20V ? 'layout-20-container' : ''}" style="grid-template-columns: repeat(${columnsCount}, 1fr);">
          ${pageItems.map(item => {
            const targetUrl = `${window.location.origin}/?page=kkd-sorgu&sn=${encodeURIComponent(item.serialNumber)}`;
            const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(targetUrl)}`;
            
            if (isLayout28) {
              return `
                <div class="label-cell layout-28-cell">
                  <div class="label-info-left" style="width: 55%; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                      <div class="logo-small">DH KKD</div>
                      <div class="name-text" style="font-size: 8px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px;">${item.name}</div>
                      <div class="model-text" style="font-size: 7px; color: #666; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.brandModel}</div>
                    </div>
                    <div class="sn-text" style="font-size: 9px; font-weight: 900; margin-bottom: 2px; background: #eee; padding: 1px 2px; text-align: center; border-radius: 2px;">${item.serialNumber}</div>
                  </div>
                  <div class="qr-container-right" style="width: 42%; display: flex; align-items: center; justify-content: center;">
                    <img src="${qrUrl}" style="width: 100%; height: auto; aspect-ratio: 1/1; max-width: 55px;" />
                  </div>
                </div>
              `;
            } else if (isLayout20V) {
              return `
                <div class="label-cell layout-20-cell">
                  <div class="logo-text-small">DH DEMİRER HOLDİNG</div>
                  <div class="sub-logo-text">KKD Takip Sistemi</div>
                  <div class="qr-wrapper">
                    <img src="${qrUrl}" class="qr-img-vertical" />
                  </div>
                  <div class="name-text-vertical">${item.name}</div>
                  <div class="model-text-vertical">${item.brandModel}</div>
                  <div class="sn-box-vertical">${item.serialNumber}</div>
                </div>
              `;
            } else {
              return `
                <div class="label-cell layout-14-cell">
                  <div class="label-info-left" style="width: 60%; display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                    <div>
                      <div class="logo-text">DH DEMİRER HOLDİNG</div>
                      <div style="font-size: 7px; color: #666; margin-top: -3px;">Kişisel Koruyucu Donanım Takip</div>
                    </div>
                    <div style="margin: 4px 0;">
                      <div class="name-text" style="font-size: 9.5px; font-weight: 800; color: #111;">${item.name}</div>
                      <div class="model-text" style="font-size: 8px; color: #555; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${item.brandModel}</div>
                    </div>
                    <div class="sn-text" style="font-size: 11px; font-weight: 900; background: #eee; padding: 2px 4px; border-radius: 3px; letter-spacing: 0.5px; text-align: center; border: 1px solid #ddd;">${item.serialNumber}</div>
                  </div>
                  <div class="qr-container-right" style="width: 35%; display: flex; align-items: center; justify-content: center;">
                    <img src="${qrUrl}" style="width: 100%; height: auto; aspect-ratio: 1/1; max-width: 80px;" />
                  </div>
                </div>
              `;
            }
          }).join('')}
          
          ${Array(pageSize - pageItems.length).fill(0).map(() => {
            if (isLayout28) return `<div class="label-cell layout-28-cell empty-cell"></div>`;
            if (isLayout20V) return `<div class="label-cell layout-20-cell empty-cell"></div>`;
            return `<div class="label-cell layout-14-cell empty-cell"></div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  printWindow.document.write(`
    <html>
      <head>
        <title>Toplu QR Etiket Basımı</title>
        <style>
          @page {
            size: A4;
            margin: 0;
          }
          @media print {
            body { background: white; margin: 0; }
            .a4-page { page-break-after: always; border: none !important; margin: 0 !important; box-shadow: none !important; }
            .no-print { display: none; }
            .label-cell.empty-cell { border: 1px dashed transparent !important; background: transparent !important; }
            .label-cell.empty-cell * { display: none !important; }
          }
          body {
            font-family: Arial, sans-serif;
            background: #f1f5f9;
            margin: 20px;
            padding: 0;
            display: flex;
            flex-direction: column;
            align-items: center;
          }
          .a4-page {
            width: 210mm;
            height: 297mm;
            background: white;
            box-sizing: border-box;
            padding: 10mm 4.9mm;
            margin-bottom: 20px;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            border: 1px solid #cbd5e1;
            position: relative;
          }
          .labels-container {
            display: grid;
            grid-column-gap: 5.2mm;
            grid-row-gap: 0;
            height: 277mm;
            align-content: start;
          }
          .layout-20-container {
            grid-template-rows: repeat(5, 53mm);
            grid-column-gap: 2.6mm !important;
            grid-row-gap: 3mm !important;
          }
          .label-cell {
            box-sizing: border-box;
            overflow: hidden;
            position: relative;
            background: #fff;
          }
          .layout-14-cell {
            height: 38.1mm;
            border: 1px dashed #cbd5e1;
            padding: 6px 10px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .layout-28-cell {
            height: 38.1mm;
            border: 1px dashed #a855f7;
            padding: 4px 6px;
            display: flex;
            align-items: center;
            justify-content: space-between;
          }
          .layout-20-cell {
            height: 53mm;
            border: 1.5px dashed #334155;
            border-radius: 8px;
            padding: 8px 6px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            text-align: center;
          }
          .logo-text-small {
            font-size: 8px;
            font-weight: bold;
            color: #002D6B;
            letter-spacing: 0.5px;
            text-transform: uppercase;
            margin: 0;
            line-height: 1.1;
          }
          .sub-logo-text {
            font-size: 6.5px;
            color: #64748b;
            margin-top: 1px;
            line-height: 1;
          }
          .qr-wrapper {
            width: 25mm;
            height: 25mm;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 2px 0;
          }
          .qr-img-vertical {
            width: 100%;
            height: auto;
            aspect-ratio: 1/1;
          }
          .name-text-vertical {
            font-size: 8.5px;
            font-weight: bold;
            color: #1e293b;
            margin: 1px 0;
            line-height: 1.2;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .model-text-vertical {
            font-size: 7.5px;
            color: #64748b;
            margin: 0;
            line-height: 1.1;
            width: 100%;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }
          .sn-box-vertical {
            font-size: 9.5px;
            font-weight: 900;
            color: #0f172a;
            letter-spacing: 0.2px;
            background: #f1f5f9;
            padding: 2px 0;
            width: 90%;
            border-radius: 4px;
            margin-top: 3px;
            border: 1px solid #e2e8f0;
            text-align: center;
            line-height: 1.1;
          }
          .logo-text {
            font-size: 8.5px;
            font-weight: bold;
            color: #002d6b;
            letter-spacing: 0.5px;
          }
          .logo-small {
            font-size: 8px;
            font-weight: bold;
            color: #002d6b;
          }
          .control-panel {
            background: white;
            padding: 15px 25px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.08);
            display: flex;
            gap: 15px;
            align-items: center;
            width: 210mm;
            box-sizing: border-box;
          }
          .btn {
            padding: 8px 16px;
            font-size: 13px;
            font-weight: bold;
            color: white;
            background: #002d6b;
            border: 1px solid #00f3ff;
            border-radius: 4px;
            cursor: pointer;
          }
          .btn-secondary {
            background: transparent;
            color: #475569;
            border: 1px solid #cbd5e1;
          }
        </style>
      </head>
      <body>
        <div class="control-panel no-print">
          <div style="flex-grow: 1;">
            <strong style="font-size: 15px; color: #002d6b;">Toplu QR Etiket Yazdırma Paneli</strong>
            <div style="font-size: 12px; color: #64748b; margin-top: 4px;">
              ${itemsToPrint.length} adet ekipman için etiket hazırlandı. Sayfa çıktısını almadan önce ölçeklendirmeyi <strong>%100 (Varsayılan)</strong> olarak seçtiğinizden emin olun.
            </div>
          </div>
          <button class="btn btn-secondary" onclick="window.close()">Kapat</button>
          <button class="btn" onclick="window.print()">Yazdır / PDF Kaydet</button>
        </div>
        
        ${labelGridHtml}
      </body>
    </html>
  `);
  printWindow.document.close();
};


