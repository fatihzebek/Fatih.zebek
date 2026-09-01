// ══════════════════════════════════════════════════════════════════════════════
// DH-SERVİS ARAÇ & SÜRÜCÜ YÖNETİM SAYFASI (VehicleManagement.ts)
// ══════════════════════════════════════════════════════════════════════════════

import { vehicleService, normalizeTeamName } from '../services/VehicleService';
import type { Vehicle, DriverLicenseRecord, TrafficFineRecord, VehicleDamageReport, VehicleInspectionReport } from '../services/VehicleService';
import { vehicleAgent } from '../agents/VehicleAgent';
import { notificationService } from '../services/NotificationService';
import { formatTeamName } from '../utils/formatters';
import * as XLSX from 'xlsx';

// DH-SERVİS 15 EKİP LİSTESİ (Team01 - Team15)
const ALL_TEAMS = Array.from({ length: 15 }, (_, i) => `Team${String(i + 1).padStart(2, '0')}`);

// RESMİ SANTRAL & SAHA LİSTESİ
const OFFICIAL_SITES = [
  'Anemon İntepe',
  'Mare Manastır',
  'Alize Çamseki',
  'Doğal Sayalar',
  'Dares Datça',
  'Alize Germiyan',
  'Alize Keltepe',
  'Alize Sarıkaya',
  'Alize Kuyucak',
  'Alize Çataltape',
  'Merkez Tamir Atölyesi'
];

interface FilterState {
  searchQuery: string;
  selectedTeam: string;
  selectedCompany: string;
  selectedStatus: string;
}

let activeFilterState: FilterState = {
  searchQuery: '',
  selectedTeam: 'ALL',
  selectedCompany: 'ALL',
  selectedStatus: 'ALL'
};

let activeTabId = 'tab-vehicles';

export function setActiveTab(tabId: string) {
  activeTabId = tabId;
}

function renderVehicleAgentWidget(agentReport: any): string {
  if (!agentReport || !agentReport.insights) return '';
  const insights = agentReport.insights;
  const savings = agentReport.summary.potentialSavings;

  return `
    <div style="background: linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.85) 100%); border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 12px; padding: 14px; margin-bottom: 14px; box-shadow: 0 8px 30px rgba(0, 242, 254, 0.12);">
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 10px; margin-bottom: 10px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; box-shadow: 0 0 15px rgba(0, 242, 254, 0.4);">
            🤖
          </div>
          <div>
            <div style="font-weight: 900; font-size: 0.95rem; color: #00F2FE; letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px;">
              FİLO & ARAÇ AKILLI DENETİM AJANI
              <span style="font-size: 0.65rem; background: rgba(0, 242, 254, 0.15); color: #00F2FE; padding: 2px 8px; border-radius: 20px; border: 1px solid rgba(0, 242, 254, 0.3); font-weight: 800;">YALNIZCA ADMİN</span>
            </div>
            <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 1px;">7/24 Muayene, Sigorta, Trafik Cezaları & Ehliyet Otomatik Risk Analizi</div>
          </div>
        </div>

        <div style="display: flex; gap: 12px; align-items: center;">
          ${savings > 0 ? `
            <div style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); padding: 4px 10px; border-radius: 6px; text-align: right;">
              <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">POTANSİYEL İNDİRİM TASARRUFU</div>
              <div style="font-weight: 900; color: #14F195; font-size: 0.9rem;">+${savings.toLocaleString('tr-TR')} ₺</div>
            </div>
          ` : ''}

          <div style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 10px; border-radius: 6px; text-align: right;">
            <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 700;">ACİL RİSK / UYARI SAYISI</div>
            <div style="font-weight: 900; color: #EF4444; font-size: 0.9rem;">${insights.length} Tespit</div>
          </div>
        </div>
      </div>

      ${insights.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 8px;">
          ${insights.slice(0, 6).map((insight: any) => `
            <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.08); border-left: 3px solid ${insight.badgeColor}; border-radius: 6px; padding: 8px 10px; display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
              <div style="flex: 1;">
                <div style="display: flex; align-items: center; gap: 6px; font-weight: 800; font-size: 0.8rem; color: #F8FAFC;">
                  <span>${insight.title}</span>
                </div>
                <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 3px; line-height: 1.3;">${insight.message}</div>
              </div>
              <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px; flex-shrink: 0;">
                <span style="font-size: 0.65rem; font-weight: 800; color: ${insight.badgeColor}; background: rgba(0,0,0,0.4); padding: 2px 6px; border-radius: 4px;">${insight.badgeText}</span>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div style="color: #14F195; font-weight: 700; font-size: 0.82rem; display: flex; align-items: center; gap: 6px; padding: 4px 0;">
          <span>✅</span> Filo Ajanı taramasını tamamladı. Tüm araçlarda muayene, sigorta ve sürücü beyanları sorunsuz!
        </div>
      `}
    </div>
  `;
}

export function renderVehicleManagement(userProfile?: any): string {
  const actualProfile = userProfile || (window as any).appState?.userProfile || (window as any).currentUser;
  const isAdmin = Boolean(actualProfile && (actualProfile.role === 'ADMIN' || actualProfile.role === 'SERVICE_MANAGER'));
  
  const rawTeam = actualProfile?.team || (window as any).currentUserTeam || (window as any).appState?.userTeam || '';
  const userTeam = rawTeam ? formatTeamName(rawTeam) : '';
  const userName = (actualProfile?.displayName || actualProfile?.name || '').trim();
  const userEmail = (actualProfile?.email || '').trim().toLowerCase();

  const isTeamLeader = Boolean(
    (actualProfile?.managedTeams && actualProfile.managedTeams.length > 0) ||
    actualProfile?.role === 'TEAM_LEADER' ||
    actualProfile?.role === 'EKİP LİDERİ' ||
    actualProfile?.isTeamLeader === true ||
    (actualProfile?.title && actualProfile.title.toLowerCase().includes('lider')) ||
    userTeam === 'Team03' // Default Team03 is Ekip Lideri
  );

  // Managed Sub-Teams resolution (e.g. Team03 leader manages Team03, Team04, Team13, Team15)
  let managedTeamsList: string[] = [];
  if (actualProfile?.managedTeams && actualProfile.managedTeams.length > 0) {
    managedTeamsList = actualProfile.managedTeams.map(formatTeamName);
  } else if (userTeam === 'Team03' || isTeamLeader) {
    managedTeamsList = ['Team03', 'Team04', 'Team13', 'Team15'];
  } else if (userTeam) {
    managedTeamsList = [userTeam];
  }

  if (userTeam && !managedTeamsList.includes(userTeam)) {
    managedTeamsList.unshift(userTeam);
  }

  const cleanTeam = (t?: string) => (t || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

  const isTeamMatch = (itemTeam?: string, targetTeam?: string) => {
    if (!itemTeam || !targetTeam) return false;
    const c1 = cleanTeam(itemTeam);
    const c2 = cleanTeam(targetTeam);
    return c1 === c2 || c1.includes(c2) || c2.includes(c1);
  };

  let vehicles = vehicleService.getVehicles();
  let drivers = vehicleService.getDriverLicenses();
  let fines = vehicleService.getTrafficFines();
  let damages = vehicleService.getDamageReports();
  let inspections = vehicleService.getInspectionReports();
  let maintenance = vehicleService.getMaintenanceRecords();
  const alerts = vehicleService.getVehicleAlerts();

  // Role Isolation:
  // - Admin & Service Manager: Sees ALL vehicles across all teams.
  // - Ekip Lideri (e.g. Team03): Sees ALL vehicles in their managed team(s) (Team03, Team04, Team13, Team15).
  // - Normal Ekip Elemanı (e.g. Team04): Sees ONLY vehicles of their own team or created by them.
  const isCreatorMatch = (creator?: string) => {
    if (!creator) return false;
    const c = creator.toLowerCase().trim();
    const email = userEmail.toLowerCase().trim();
    const name = userName.toLowerCase().trim();
    const profEmail = (userProfile?.email || '').toLowerCase().trim();
    const profName = (userProfile?.displayName || userProfile?.name || '').toLowerCase().trim();
    return (email && c.includes(email)) ||
           (name && c.includes(name)) ||
           (profEmail && c.includes(profEmail)) ||
           (profName && c.includes(profName));
  };

  if (!isAdmin) {
    const visiblePlates = new Set(vehicles.map(v => v.plate.toUpperCase()));

    if (isTeamLeader && managedTeamsList.length > 0) {
      vehicles = vehicles.filter(v =>
        managedTeamsList.some(t => isTeamMatch(v.assignedTeamName, t) || isTeamMatch(v.assignedTeamId, t)) ||
        isCreatorMatch(v.createdBy)
      );
      drivers = drivers.filter(d => managedTeamsList.some(t => isTeamMatch(d.team, t)) || (d.personnelName && d.personnelName.toLowerCase().includes(userName.toLowerCase())));
      fines = fines.filter(f => visiblePlates.has(f.plate.toUpperCase()) || managedTeamsList.some(t => isTeamMatch(f.team, t)) || (f.driverName && f.driverName.toLowerCase().includes(userName.toLowerCase())));
      inspections = inspections.filter(i => visiblePlates.has(i.plate.toUpperCase()) || managedTeamsList.some(t => isTeamMatch(i.team, t)) || (i.inspectedBy && i.inspectedBy.toLowerCase().includes(userName.toLowerCase())));
    } else {
      vehicles = vehicles.filter(v =>
        (userTeam && (isTeamMatch(v.assignedTeamName, userTeam) || isTeamMatch(v.assignedTeamId, userTeam))) ||
        isCreatorMatch(v.createdBy) ||
        (userName && v.assignedDriverName && v.assignedDriverName.toLowerCase().includes(userName.toLowerCase()))
      );
      drivers = drivers.filter(d => (userTeam && isTeamMatch(d.team, userTeam)) || (userName && d.personnelName && d.personnelName.toLowerCase().includes(userName.toLowerCase())));
      fines = fines.filter(f => visiblePlates.has(f.plate.toUpperCase()) || (userTeam && isTeamMatch(f.team, userTeam)) || (userName && f.driverName && f.driverName.toLowerCase().includes(userName.toLowerCase())));
      inspections = inspections.filter(i => visiblePlates.has(i.plate.toUpperCase()) || (userTeam && isTeamMatch(i.team, userTeam)) || (userName && i.inspectedBy && i.inspectedBy.toLowerCase().includes(userName.toLowerCase())));
    }
    maintenance = maintenance.filter(m => visiblePlates.has(m.plate.toUpperCase()) || (m.performedBy && m.performedBy.toLowerCase().includes(userName.toLowerCase())));
    // Hasar bildirimleri tüm ekipler tarafından ortak izlenebilir (filo genelinde şeffaflık)
  }

  // Run Fleet AI Agent audit for Admins / Service Managers only
  const agentReport = isAdmin ? vehicleAgent.runFleetAudit() : null;

  // Apply Live Filters across all tabs
  let filteredVehicles = [...vehicles];
  let filteredDrivers = [...drivers];
  let filteredInspections = [...inspections];
  let filteredFines = [...fines];
  let filteredDamages = [...damages];
  let filteredMaintenance = [...maintenance];

  if (activeFilterState.searchQuery) {
    const q = activeFilterState.searchQuery.toLowerCase().trim();
    filteredVehicles = filteredVehicles.filter(v =>
      v.plate.toLowerCase().includes(q) ||
      v.brandModel.toLowerCase().includes(q) ||
      (v.company && v.company.toLowerCase().includes(q)) ||
      (v.vin && v.vin.toLowerCase().includes(q)) ||
      (v.assignedTeamName && v.assignedTeamName.toLowerCase().includes(q))
    );
    filteredDrivers = filteredDrivers.filter(d =>
      d.personnelName.toLowerCase().includes(q) ||
      d.team.toLowerCase().includes(q) ||
      d.licenseNumber.toLowerCase().includes(q) ||
      d.licenseClass.toLowerCase().includes(q)
    );
    filteredInspections = filteredInspections.filter(i =>
      i.plate.toLowerCase().includes(q) ||
      i.inspectedBy.toLowerCase().includes(q) ||
      i.team.toLowerCase().includes(q)
    );
    filteredFines = filteredFines.filter(f =>
      f.plate.toLowerCase().includes(q) ||
      (f.driverName && f.driverName.toLowerCase().includes(q)) ||
      f.fineCode.toLowerCase().includes(q)
    );
    filteredDamages = filteredDamages.filter(d =>
      d.plate.toLowerCase().includes(q) ||
      d.reportedBy.toLowerCase().includes(q) ||
      d.description.toLowerCase().includes(q)
    );
    filteredMaintenance = filteredMaintenance.filter(m =>
      m.plate.toLowerCase().includes(q) ||
      m.descriptionNotes.toLowerCase().includes(q) ||
      (m.serviceNameCompany && m.serviceNameCompany.toLowerCase().includes(q)) ||
      (m.invoiceNumber && m.invoiceNumber.toLowerCase().includes(q))
    );
  }

  if (activeFilterState.selectedTeam !== 'ALL') {
    const filterTeamNorm = normalizeTeamName(activeFilterState.selectedTeam);
    filteredVehicles = filteredVehicles.filter(v => normalizeTeamName(v.assignedTeamName) === filterTeamNorm);
    filteredDrivers = filteredDrivers.filter(d => normalizeTeamName(d.team) === filterTeamNorm);
    filteredInspections = filteredInspections.filter(i => normalizeTeamName(i.team) === filterTeamNorm);
    filteredFines = filteredFines.filter(f => normalizeTeamName(f.team) === filterTeamNorm);
    filteredDamages = filteredDamages.filter(d => normalizeTeamName(d.team) === filterTeamNorm);
  }

  if (activeFilterState.selectedStatus === 'EXPIRED') {
    filteredVehicles = filteredVehicles.filter(v => v.status === 'INSPECTION_EXPIRED');
  } else if (activeFilterState.selectedStatus === 'ACTIVE') {
    filteredVehicles = filteredVehicles.filter(v => v.status === 'ACTIVE');
  }

  const fineAnalytics = vehicleService.getFineAnalytics();
  const criticalAlerts = alerts.filter(a => a.severity === 'CRITICAL');

  // TR Plaka Rozeti HTML Oluşturucu
  const renderTRPlateBadge = (plate: string) => `
    <div style="display: inline-flex; align-items: center; background: #ffffff; border: 1.5px solid #000; border-radius: 4px; overflow: hidden; box-shadow: 0 2px 6px rgba(0,0,0,0.5); font-family: 'Rajdhani', sans-serif;">
      <div style="background: #003399; color: #fff; padding: 2px 4px; font-size: 0.6rem; font-weight: 900; display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1;">
        <span style="font-size: 0.45rem; opacity: 0.8;">★</span>
        <span>TR</span>
      </div>
      <div style="color: #000; font-weight: 900; font-size: 0.88rem; padding: 2px 8px; letter-spacing: 0.8px; text-transform: uppercase;">
        ${plate}
      </div>
    </div>
  `;

  return `
    <div class="vehicle-management-container" style="padding: 16px; color: #f8fafc; font-family: 'Inter', sans-serif;">
      
      <!-- HEADER BAR (SADE & PREMİUM) -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; flex-wrap: wrap; gap: 12px; background: rgba(15, 23, 42, 0.7); padding: 12px 18px; border-radius: 12px; border: 1px solid rgba(0, 242, 254, 0.2); box-shadow: 0 4px 20px rgba(0,0,0,0.3);">
        <div>
          <h1 style="font-size: 1.35rem; font-weight: 900; margin: 0; background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; display: flex; align-items: center; gap: 10px;">
            <span>🚗</span> ARAÇ FİLOSU & SÜRÜCÜ YÖNETİMİ ${!isAdmin ? `<span style="font-size: 0.75rem; padding: 3px 10px; border-radius: 12px; background: rgba(59, 130, 246, 0.2); color: #60A5FA; font-weight: 700; border: 1px solid #3B82F6;">${userTeam || 'Kendi Ekibiniz'}</span>` : ''}
          </h1>
          <div style="font-size: 0.78rem; color: #94a3b8; margin-top: 2px;">Şirket Araçları, Sürücü Zimmetleri, Bakım, Muayene & Trafik Cezaları Takipleri</div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
          <!-- KOMBİNE + YENİ İŞLEM DROPDOWN BUTTON -->
          <div class="dropdown-action-wrapper" style="position: relative; display: inline-block;">
            <button id="btn-quick-action-dropdown" onclick="const m=document.getElementById('quick-action-menu'); if(m) m.style.display=m.style.display==='none'?'block':'none';" style="background: linear-gradient(135deg, #00F2FE 0%, #00C6FF 100%); border: none; color: #0f172a; font-weight: 900; padding: 10px 18px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 8px; font-size: 0.85rem; box-shadow: 0 4px 15px rgba(0, 242, 254, 0.3); transition: all 0.2s;">
              <span>➕</span> YENİ İŞLEM YAP <span style="font-size: 0.7rem; margin-left: 2px;">▼</span>
            </button>
            <div id="quick-action-menu" style="display: none; position: absolute; right: 0; top: 110%; background: #0f172a; border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 8px; width: 220px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); z-index: 100; overflow: hidden; padding: 6px 0;">
              <div class="dropdown-item btn-add-vehicle-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #00F2FE; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>🚗</span> Yeni Araç Kaydet
              </div>
              <div class="dropdown-item btn-add-maint-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #38BDF8; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>🛠️</span> Bakım & Servis Kaydı
              </div>
              <div class="dropdown-item btn-add-fine-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #F59E0B; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>📑</span> Trafik Cezası İşle
              </div>
              <div class="dropdown-item btn-change-tire-modal" data-plate="" data-id="" data-km="" data-season="" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #E9D5FF; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>🛞</span> Lastik Değişimi Kaydı
              </div>
              <div class="dropdown-item btn-add-damage-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #EF4444; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>💥</span> Hasar Bildirimi
              </div>
              <div class="dropdown-item btn-add-driver-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #C084FC; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <span>🪪</span> Sürücü & 3M Beyanı
              </div>
              <div class="dropdown-item btn-do-inspection-trigger" onclick="document.getElementById('quick-action-menu').style.display='none';" style="padding: 10px 14px; color: #14F195; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>📷</span> Araç Denetimi Yap
              </div>
            </div>
          </div>

          <button id="btn-export-excel" class="cyber-btn" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10B981; color: #10B981; font-weight: 800; padding: 10px 16px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.83rem; transition: all 0.2s;">
            <span>📥</span> Filo Excel Raporu
          </button>
        </div>
      </div>

      <!-- FİLO & ARAÇ AKILLI DENETİM AJANI (YALNIZCA ADMİN) -->
      ${isAdmin && agentReport ? renderVehicleAgentWidget(agentReport) : ''}

      <!-- ALERTS BANNER (KOMPAKT) -->
      ${alerts.length > 0 ? `
        <div style="background: rgba(15, 23, 42, 0.8); border: 1px solid ${criticalAlerts.length > 0 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(245, 158, 11, 0.4)'}; border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; box-shadow: 0 4px 16px rgba(0,0,0,0.3);">
          <div style="display: flex; align-items: center; gap: 8px; font-weight: 800; color: ${criticalAlerts.length > 0 ? '#EF4444' : '#F59E0B'}; font-size: 0.88rem; margin-bottom: 8px;">
            <span>🚨</span> SİSTEM UYARI & HATIRLATMA MERKEZİ (${alerts.length} UYARI)
          </div>
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 8px;">
            ${alerts.map(a => `
              <div class="alert-card-clickable" data-type="${a.type}" data-veh-id="${a.vehicleId || ''}" style="cursor: pointer; background: ${a.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.12)' : (a.severity === 'WARNING' ? 'rgba(245, 158, 11, 0.12)' : 'rgba(59, 130, 246, 0.12)')}; border-left: 3px solid ${a.severity === 'CRITICAL' ? '#EF4444' : (a.severity === 'WARNING' ? '#F59E0B' : '#3B82F6')}; padding: 6px 10px; border-radius: 4px; transition: transform 0.2s;">
                <div style="font-weight: 800; font-size: 0.8rem; color: ${a.severity === 'CRITICAL' ? '#FCA5A5' : (a.severity === 'WARNING' ? '#FDE047' : '#93C5FD')}; display: flex; justify-content: space-between; align-items: center;">
                  <span>${a.title}</span>
                  ${a.daysLeft !== undefined ? `<span style="font-size: 0.7rem; padding: 1px 5px; border-radius: 3px; background: rgba(0,0,0,0.4);">${a.daysLeft <= 0 ? 'GEÇTİ!' : `${a.daysLeft} Gün`}</span>` : ''}
                </div>
                <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">${a.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      ` : ''}

      <!-- EXECUTIVE KPI KARTLARI (TEK SIRADA SADE 4 KART) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 14px;">
        <div class="kpi-card-clickable" data-tab-target="tab-vehicles" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 242, 254, 0.25); border-radius: 10px; padding: 12px 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">TOPLAM FİLO ARAÇ</span>
            <span style="font-size: 1.1rem; background: rgba(0, 242, 254, 0.15); padding: 4px 8px; border-radius: 6px; color: #00F2FE;">🚗</span>
          </div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #00F2FE; margin-top: 6px;">${vehicles.length} <span style="font-size: 0.75rem; color: #64748b;">Araç</span></div>
          <div style="font-size: 0.72rem; color: #14F195; font-weight: 700; margin-top: 4px;">
            ✅ ${filteredVehicles.filter(v => v.status !== 'INSPECTION_EXPIRED').length} Araç Faal Durumda
          </div>
        </div>

        <div class="kpi-card-clickable" data-tab-target="tab-vehicles" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid ${criticalAlerts.length > 0 ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.1)'}; border-radius: 10px; padding: 12px 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">MUAYENE & SİGORTA</span>
            <span style="font-size: 1.1rem; background: rgba(239, 68, 68, 0.15); padding: 4px 8px; border-radius: 6px; color: #EF4444;">⚠️</span>
          </div>
          <div style="font-size: 1.35rem; font-weight: 900; color: ${criticalAlerts.length > 0 ? '#EF4444' : '#14F195'}; margin-top: 6px;">
            ${alerts.filter(a => a.type === 'INSPECTION' || a.type === 'TRAFFIC_INSURANCE').length} <span style="font-size: 0.75rem; color: #64748b;">Uyarı</span>
          </div>
          <div style="font-size: 0.72rem; color: ${criticalAlerts.length > 0 ? '#FCA5A5' : '#94a3b8'}; margin-top: 4px;">
            ${criticalAlerts.length > 0 ? `⚠️ ${criticalAlerts.length} Araç Muayenesi Geçti` : '✅ Muayeneler Güncel'}
          </div>
        </div>

        <div class="kpi-card-clickable" data-tab-target="tab-maintenance" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 10px; padding: 12px 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">BAKIM & SERVİS GİDERİ</span>
            <span style="font-size: 1.1rem; background: rgba(56, 189, 248, 0.15); padding: 4px 8px; border-radius: 6px; color: #38BDF8;">🛠️</span>
          </div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #38BDF8; margin-top: 6px;">
            ${filteredMaintenance.reduce((sum, m) => sum + (m.costAmount || 0), 0).toLocaleString('tr-TR')} <span style="font-size: 0.75rem; color: #64748b;">₺</span>
          </div>
          <div style="font-size: 0.72rem; color: #64748b; margin-top: 4px;">
            🛠️ Toplam ${filteredMaintenance.length} Bakım/Servis Kaydı
          </div>
        </div>

        <div class="kpi-card-clickable" data-tab-target="tab-fines" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 10px; padding: 12px 14px; transition: all 0.2s; box-shadow: 0 4px 12px rgba(0,0,0,0.2);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 800; letter-spacing: 0.5px;">TRAFİK CEZA YÜKÜ</span>
            <span style="font-size: 1.1rem; background: rgba(245, 158, 11, 0.15); padding: 4px 8px; border-radius: 6px; color: #F59E0B;">💰</span>
          </div>
          <div style="font-size: 1.35rem; font-weight: 900; color: #F59E0B; margin-top: 6px;">
            ${fineAnalytics.totalFineAmount.toLocaleString('tr-TR')} <span style="font-size: 0.75rem; color: #64748b;">₺</span>
          </div>
          <div style="font-size: 0.72rem; color: #10B981; font-weight: 700; margin-top: 4px;">
            ⏳ ${filteredFines.filter(f => f.status === 'PENDING').length} Cezada %25 İndirim Devam Ediyor
          </div>
        </div>
      </div>

      <!-- KURUMSAL CANLI FİLTRELEME & ARAMA BARI -->
      <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 14px; margin-bottom: 14px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center;">
        <div style="flex: 1; min-width: 200px; position: relative;">
          <input type="text" id="filter-search-veh" placeholder="🔍 Plaka, Sürücü, Firma veya Şasi No ara..." value="${activeFilterState.searchQuery}" style="width: 100%; padding: 8px 12px 8px 34px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(0, 242, 254, 0.3); color: #fff; font-size: 0.85rem; box-sizing: border-box;" />
          <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; font-size: 0.8rem;">🔍</span>
        </div>

        <div style="min-width: 160px;">
          <select id="filter-team-veh" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.15); color: #38BDF8; font-weight: 700; font-size: 0.8rem; box-sizing: border-box;">
            ${isAdmin ? `
              <option value="ALL" ${activeFilterState.selectedTeam === 'ALL' ? 'selected' : ''}>👥 Tüm Ekipler (${ALL_TEAMS.length})</option>
              ${ALL_TEAMS.map(t => `<option value="${t}" ${activeFilterState.selectedTeam === t ? 'selected' : ''}>${t}</option>`).join('')}
            ` : (isTeamLeader && managedTeamsList.length > 1 ? `
              <option value="ALL" ${activeFilterState.selectedTeam === 'ALL' ? 'selected' : ''}>👥 Sorumlu Olunan Ekipler (${managedTeamsList.length})</option>
              ${managedTeamsList.map(t => `<option value="${t}" ${activeFilterState.selectedTeam === t ? 'selected' : ''}>${t}</option>`).join('')}
            ` : `
              <option value="${userTeam || 'Team03'}" selected>${userTeam || 'Team03'}</option>
            `)}
          </select>
        </div>

        <div style="min-width: 140px;">
          <select id="filter-status-veh" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.15); color: #14F195; font-weight: 700; font-size: 0.8rem; box-sizing: border-box;">
            <option value="ALL" ${activeFilterState.selectedStatus === 'ALL' ? 'selected' : ''}>⚙️ Tüm Durumlar</option>
            <option value="EXPIRED" ${activeFilterState.selectedStatus === 'EXPIRED' ? 'selected' : ''}>⚠️ Muayenesi Geçenler</option>
            <option value="ACTIVE" ${activeFilterState.selectedStatus === 'ACTIVE' ? 'selected' : ''}>✅ Faal Olanlar</option>
          </select>
        </div>
      </div>

      <!-- ANA SEKMELER (KAZA, BAKIM, CEZA, SÜRÜCÜ DAHİL) -->
      <div style="display: flex; gap: 6px; border-bottom: 2px solid rgba(255,255,255,0.1); padding-bottom: 6px; margin-bottom: 16px; overflow-x: auto;">
        <button class="veh-tab-btn ${activeTabId === 'tab-vehicles' ? 'active' : ''}" data-tab="tab-vehicles" style="background: ${activeTabId === 'tab-vehicles' ? 'rgba(0, 242, 254, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-vehicles' ? '#00F2FE' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-vehicles' ? '#00F2FE' : '#94a3b8'}; font-weight: 900; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem; box-shadow: ${activeTabId === 'tab-vehicles' ? '0 0 12px rgba(0,242,254,0.3)' : 'none'};">
          🚗 Araç Filosu (${filteredVehicles.length})
        </button>
        <button class="veh-tab-btn ${activeTabId === 'tab-maintenance' ? 'active' : ''}" data-tab="tab-maintenance" style="background: ${activeTabId === 'tab-maintenance' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-maintenance' ? '#38BDF8' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-maintenance' ? '#38BDF8' : '#94a3b8'}; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem;">
          🛠️ Bakım, Servis & Lastik (${filteredMaintenance.length})
        </button>
        <button class="veh-tab-btn ${activeTabId === 'tab-damages' ? 'active' : ''}" data-tab="tab-damages" style="background: ${activeTabId === 'tab-damages' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-damages' ? '#EF4444' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-damages' ? '#EF4444' : '#94a3b8'}; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem;">
          💥 Kaza & Hasar Bildirimleri (${filteredDamages.length})
        </button>
        <button class="veh-tab-btn ${activeTabId === 'tab-fines' ? 'active' : ''}" data-tab="tab-fines" style="background: ${activeTabId === 'tab-fines' ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-fines' ? '#F59E0B' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-fines' ? '#F59E0B' : '#94a3b8'}; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem;">
          📄 Trafik Cezaları & Muayene (${filteredFines.length})
        </button>
        <button class="veh-tab-btn ${activeTabId === 'tab-drivers' ? 'active' : ''}" data-tab="tab-drivers" style="background: ${activeTabId === 'tab-drivers' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-drivers' ? '#A855F7' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-drivers' ? '#A855F7' : '#94a3b8'}; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem;">
          👤 Sürücüler & Zimmet (${filteredDrivers.length})
        </button>
        <button class="veh-tab-btn ${activeTabId === 'tab-inspections' ? 'active' : ''}" data-tab="tab-inspections" style="background: ${activeTabId === 'tab-inspections' ? 'rgba(20, 241, 149, 0.2)' : 'rgba(255, 255, 255, 0.05)'}; border: 1px solid ${activeTabId === 'tab-inspections' ? '#14F195' : 'rgba(255, 255, 255, 0.1)'}; color: ${activeTabId === 'tab-inspections' ? '#14F195' : '#94a3b8'}; font-weight: 800; padding: 8px 16px; border-radius: 6px; cursor: pointer; white-space: nowrap; font-size: 0.85rem;">
          📸 Denetim Raporları (${filteredInspections.length})
        </button>
      </div>

      <!-- TAB CONTENT: 0. FİLO GENEL DASHBOARD (YÖNETİCİ ÖZETİ & HIZLI İŞLEMLER) -->
      <div id="tab-dashboard" class="veh-tab-content" style="display: ${activeTabId === 'tab-dashboard' ? 'block' : 'none'};">

        <!-- TOP EXECUTIVE KPI CARDS (KOMPAKT) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 8px; margin-bottom: 12px;">
          <div class="veh-kpi-card" onclick="window.navigateToVehicleTab('tab-vehicles')" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(0, 242, 254, 0.3); border-radius: 8px; padding: 8px 12px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">FİLO TOPLAM ARAÇ</div>
            <div style="display: flex; align-items: baseline; justify-content: space-between; margin-top: 4px;">
              <div style="font-size: 1.3rem; font-weight: 900; color: #00F2FE;">${filteredVehicles.length} Araç</div>
              <span style="font-size: 0.7rem; font-weight: 800; padding: 2px 6px; border-radius: 10px; background: rgba(20, 241, 149, 0.2); color: #14F195;">
                ${filteredVehicles.filter(v => v.status !== 'INSPECTION_EXPIRED').length} Faal
              </span>
            </div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 3px;">
              ${filteredVehicles.filter(v => v.status === 'INSPECTION_EXPIRED').length > 0 ? `⚠️ ${filteredVehicles.filter(v => v.status === 'INSPECTION_EXPIRED').length} Araç Muayene Bekliyor` : '✅ Tüm Araçların Muayenesi Geçerli'}
            </div>
          </div>

          <div class="veh-kpi-card" onclick="window.navigateToVehicleTab('tab-maintenance')" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 8px 12px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">TOPLAM SERVİS & BAKIM</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #38BDF8; margin-top: 4px;">
              ${filteredMaintenance.reduce((sum, m) => sum + (m.costAmount || 0), 0).toLocaleString('tr-TR')} ₺
            </div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 3px;">
              🛠️ Toplam ${filteredMaintenance.length} Bakım/Servis Kaydı İşlendi
            </div>
          </div>

          <div class="veh-kpi-card" onclick="window.navigateToVehicleTab('tab-fines')" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 8px 12px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">TRAFİK CEZASI YÜKÜ</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #F59E0B; margin-top: 4px;">
              ${filteredFines.reduce((sum, f) => sum + f.amount, 0).toLocaleString('tr-TR')} ₺
            </div>
            <div style="font-size: 0.68rem; color: #10B981; font-weight: 700; margin-top: 3px;">
              ⏳ ${filteredFines.filter(f => f.status === 'PENDING').length} Cezada %25 İndirim Devam Ediyor
            </div>
          </div>

          <div class="veh-kpi-card" onclick="window.navigateToVehicleTab('tab-drivers')" style="cursor: pointer; background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 8px; padding: 8px 12px; transition: transform 0.2s, box-shadow 0.2s;">
            <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px;">ZİMMETLİ SÜRÜCÜLER</div>
            <div style="font-size: 1.3rem; font-weight: 900; color: #C084FC; margin-top: 4px;">
              ${filteredDrivers.length} Personel
            </div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 3px;">
              📋 3 Aylık Ceza Beyanı Aktif
            </div>
          </div>
        </div>

        <!-- FLEET HEALTH & CRITICAL ISSUES WIDGET GRID (KOMPAKT) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 10px;">
          <!-- LEFT WIDGET: MUAYENE & SIGORTA UYARILARI -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 10px; padding: 10px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-weight: 900; color: #EF4444; font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
                <span>⚠️</span> MUAYENESİ YAKLAŞAN / GEÇEN ARAÇLAR
              </div>
              <button onclick="window.navigateToVehicleTab('tab-vehicles')" style="background: none; border: none; color: #38BDF8; font-weight: 800; font-size: 0.72rem; cursor: pointer;">Tümünü Gör &rarr;</button>
            </div>

            ${filteredVehicles.filter(v => {
              const inspDate = new Date(v.inspectionDueDate);
              const daysToInsp = Math.ceil((inspDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              return daysToInsp <= 30;
            }).length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${filteredVehicles.filter(v => {
                  const inspDate = new Date(v.inspectionDueDate);
                  const daysToInsp = Math.ceil((inspDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return daysToInsp <= 30;
                }).slice(0, 4).map(v => {
                  const inspDate = new Date(v.inspectionDueDate);
                  const daysToInsp = Math.ceil((inspDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  const isExpired = daysToInsp <= 0;
                  return `
                    <div style="background: rgba(30, 41, 59, 0.7); border-left: 3px solid ${isExpired ? '#EF4444' : '#F59E0B'}; border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="font-weight: 900; color: #00F2FE; font-size: 0.8rem;">${v.plate} — ${v.brandModel}</div>
                        <div style="font-size: 0.68rem; color: #94a3b8;">${v.siteName} (${v.assignedTeamName || 'Ekip Yok'})</div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-weight: 800; color: ${isExpired ? '#EF4444' : '#FBBF24'}; font-size: 0.75rem;">
                          ${isExpired ? `⚠️ SÜRESİ GEÇTİ` : `${daysToInsp} Gün Kaldı`}
                        </div>
                        <div style="font-size: 0.65rem; color: #64748b;">${v.inspectionDueDate}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 10px 12px; color: #14F195; font-size: 0.78rem; font-weight: 700;">
                ✅ Tüm araçların TÜVTÜRK muayene tarihleri güncel!
              </div>
            `}
          </div>

          <!-- RIGHT WIDGET: TRAFİK CEZASI İNDİRİM SAYACI -->
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(245, 158, 11, 0.3); border-radius: 10px; padding: 10px 14px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div style="font-weight: 900; color: #F59E0B; font-size: 0.82rem; display: flex; align-items: center; gap: 6px;">
                <span>⏳</span> %25 ERKEN ÖDEME İNDİRİMLİ CEZALAR
              </div>
              <button onclick="window.navigateToVehicleTab('tab-fines')" style="background: none; border: none; color: #38BDF8; font-weight: 800; font-size: 0.72rem; cursor: pointer;">Tümünü Gör &rarr;</button>
            </div>

            ${filteredFines.filter(f => f.status === 'PENDING').length > 0 ? `
              <div style="display: flex; flex-direction: column; gap: 6px;">
                ${filteredFines.filter(f => f.status === 'PENDING').slice(0, 4).map(f => {
                  const deadline = new Date(f.discountDeadline);
                  const daysLeft = Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                  return `
                    <div style="background: rgba(30, 41, 59, 0.7); border-left: 3px solid #10B981; border-radius: 6px; padding: 6px 10px; display: flex; justify-content: space-between; align-items: center;">
                      <div>
                        <div style="font-weight: 900; color: #00F2FE; font-size: 0.8rem;">${f.plate} — ${f.driverName || 'Sürücü'}</div>
                        <div style="font-size: 0.68rem; color: #cbd5e1;">${f.fineCode}</div>
                      </div>
                      <div style="text-align: right;">
                        <div style="font-weight: 900; color: #10B981; font-size: 0.8rem;">${(f.amount * 0.75).toLocaleString('tr-TR')} ₺</div>
                        <div style="font-size: 0.65rem; color: #FBBF24; font-weight: 700;">⏳ Kalan: ${daysLeft > 0 ? `${daysLeft} Gün` : 'Son Gün!'}</div>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            ` : `
              <div style="text-align: center; padding: 10px 12px; color: #cbd5e1; font-size: 0.78rem;">
                🔥 Bekleyen erken ödeme indirimli trafik cezası bulunmuyor.
              </div>
            `}
          </div>
        </div>
      </div>

      <!-- TAB CONTENT: 1. ARAÇLAR -->
      <div id="tab-vehicles" class="veh-tab-content" style="display: ${activeTabId === 'tab-vehicles' ? 'block' : 'none'};">
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plaka Rozeti & Araç</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Ruhsat Sahibi Firma</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Şasi No (VIN) & Yıl</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Zimmetli Ekip & Saha</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">TÜVTÜRK Muayene</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Lastik Durumu</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Durum</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Aksiyonlar</th>
              </tr>
            </thead>
            <tbody>
              ${filteredVehicles.map(v => {
                const today = new Date();
                const inspDate = new Date(v.inspectionDueDate);
                const daysToInsp = Math.ceil((inspDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isInspExpired = daysToInsp <= 0;
                const isInspWarning = daysToInsp > 0 && daysToInsp <= 30;

                return `
                  <tr class="veh-row-clickable" data-veh-id="${v.id}" style="cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); background: ${isInspExpired ? 'rgba(239, 68, 68, 0.08)' : 'transparent'}; transition: background 0.2s;">
                    <td style="padding: 10px 12px;">
                      ${renderTRPlateBadge(v.plate)}
                      <div style="font-size: 0.8rem; color: #cbd5e1; font-weight: 700; margin-top: 4px;">${v.brandModel}</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 800; color: #F59E0B; font-size: 0.82rem;">${v.company || 'Demirer Kablo / Enerji'}</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-family: monospace; font-weight: 700; color: #A855F7; font-size: 0.8rem;">${v.vin || 'VIN Belirtilmedi'}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">Model Yılı: ${v.year || '-'}</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 700; color: #38BDF8;">${v.assignedTeamName || 'Ekip Atanmadı'}</div>
                      <div style="font-size: 0.78rem; color: #cbd5e1;">${v.siteName} (${v.assignedDriverName || '-'})</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      ${!v.inspectionDueDate ? `
                        <div style="font-weight: 800; color: #EF4444; font-size: 0.75rem; background: rgba(239, 68, 68, 0.15); padding: 3px 8px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.4); display: inline-flex; align-items: center; gap: 4px;">
                          ⚠️ Muayene Tarihi Giriniz
                        </div>
                      ` : `
                        <div style="font-weight: 700; color: ${isInspExpired ? '#EF4444' : (isInspWarning ? '#F59E0B' : '#14F195')}; font-size: 0.82rem;">
                          ${v.inspectionDueDate}
                        </div>
                        <div style="font-size: 0.72rem; color: ${isInspExpired ? '#FCA5A5' : (isInspWarning ? '#FDE047' : '#64748b')};">
                          ${isInspExpired ? `⚠️ GÜNÜ GEÇTİ! (${Math.abs(daysToInsp)} Gün)` : `${daysToInsp} Gün Kaldı`}
                        </div>
                      `}
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="display: flex; flex-direction: column; gap: 3px;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                          <span style="display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-weight: 800; background: ${v.tireSeason === 'WINTER' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(245, 158, 11, 0.2)'}; color: ${v.tireSeason === 'WINTER' ? '#60A5FA' : '#FBBF24'}; border: 1px solid ${v.tireSeason === 'WINTER' ? '#3B82F6' : '#F59E0B'};">
                            ${v.tireSeason === 'WINTER' ? '❄️ KIŞ' : '☀️ YAZ'}
                          </span>
                          <button class="btn-change-tire-modal" data-plate="${v.plate}" data-id="${v.id}" data-km="${v.currentKm || 0}" data-season="${v.tireSeason || 'SUMMER'}" style="background: rgba(168, 85, 247, 0.2); border: 1px solid #A855F7; color: #C084FC; font-weight: 800; padding: 2px 6px; border-radius: 4px; cursor: pointer; font-size: 0.68rem;" title="Lastik Değişimi & Sezon Güncelle">
                            🛞 Değiştir
                          </button>
                        </div>
                        <div style="font-size: 0.72rem; color: #38BDF8; font-weight: 700;">
                          ${v.lastTireChangeKm ? `📍 ${v.lastTireChangeKm.toLocaleString('tr-TR')} KM'de Takıldı` : `📍 ${v.currentKm ? `${v.currentKm.toLocaleString('tr-TR')} KM` : 'KM Girilmedi'}`}
                        </div>
                        ${v.lastTireChangeDate ? `<div style="font-size: 0.68rem; color: #94a3b8;">🗓️ ${v.lastTireChangeDate}</div>` : ''}
                        ${v.tireStorageLocation ? `<div style="font-size: 0.68rem; color: #64748b;">📦 ${v.tireStorageLocation}</div>` : ''}
                      </div>
                    </td>

                    <td style="padding: 10px 12px; text-align: center;">
                      <span style="padding: 3px 8px; border-radius: 14px; font-size: 0.7rem; font-weight: 800; background: ${v.status === 'INSPECTION_EXPIRED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(20, 241, 149, 0.2)'}; color: ${v.status === 'INSPECTION_EXPIRED' ? '#EF4444' : '#14F195'};">
                        ${v.status === 'INSPECTION_EXPIRED' ? 'GEÇTİ' : 'FAAL'}
                      </span>
                    </td>

                    <td style="padding: 10px 12px; text-align: center;" onclick="event.stopPropagation();">
                      <div style="display: flex; gap: 4px; justify-content: center;">
                        <button class="btn-inspect-row" data-veh-id="${v.id}" style="background: rgba(0, 242, 254, 0.15); border: 1px solid rgba(0, 242, 254, 0.3); color: #00F2FE; font-weight: 700; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;" title="Detay İncele">
                          🔍
                        </button>
                        ${isAdmin ? `
                          <button class="btn-edit-veh" data-id="${v.id}" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #FBBF24; font-weight: 700; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; display: flex; align-items: center; gap: 4px;" title="Araç Bilgilerini Düzenle">
                            ✏️ Düzenle
                          </button>
                          <button class="btn-delete-veh" data-id="${v.id}" data-name="${v.plate}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="Aracı Sil">
                            🗑️
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB CONTENT: 2. FOTOĞRAFLI PERİYODİK DENETİMLER -->
      <div id="tab-inspections" class="veh-tab-content" style="display: none;">
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plaka / Tarih</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Denetleyen Personel & Ekip</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Denetim KM</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">5 Açılı Fotoğraflı Kontrol</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Açıklama / Not</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Durum</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${filteredInspections.map(insp => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px 12px;">
                    <div style="font-weight: 800; color: #00F2FE;">${insp.plate}</div>
                    <div style="font-size: 0.72rem; color: #64748b;">${insp.inspectionDate}</div>
                  </td>

                  <td style="padding: 10px 12px;">
                    <div style="font-weight: 700; color: #F8FAFC;">${insp.inspectedBy}</div>
                    <div style="font-size: 0.72rem; color: #38BDF8;">${insp.team}</div>
                  </td>

                  <td style="padding: 10px 12px; font-weight: 700; color: #A855F7;">
                    ${insp.km.toLocaleString('tr-TR')} KM
                  </td>

                  <td style="padding: 10px 12px;">
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      <span style="font-size: 0.68rem; padding: 2px 5px; border-radius: 3px; background: rgba(20, 241, 149, 0.2); color: #14F195;">📸 Kaporta</span>
                      <span style="font-size: 0.68rem; padding: 2px 5px; border-radius: 3px; background: rgba(20, 241, 149, 0.2); color: #14F195;">📸 Kabin</span>
                      <span style="font-size: 0.68rem; padding: 2px 5px; border-radius: 3px; background: rgba(20, 241, 149, 0.2); color: #14F195;">📸 Kaput Motor</span>
                      <span style="font-size: 0.68rem; padding: 2px 5px; border-radius: 3px; background: rgba(20, 241, 149, 0.2); color: #14F195;">📸 Bagaj Tüp</span>
                      <span style="font-size: 0.68rem; padding: 2px 5px; border-radius: 3px; background: rgba(20, 241, 149, 0.2); color: #14F195;">📸 KM Saati</span>
                    </div>
                  </td>

                  <td style="padding: 10px 12px; color: #cbd5e1;">${insp.notes || '-'}</td>

                  <td style="padding: 10px 12px; text-align: center;">
                    <span style="padding: 3px 8px; border-radius: 14px; font-size: 0.7rem; font-weight: 800; background: rgba(20, 241, 149, 0.2); color: #14F195;">
                      ONAYLANDI
                    </span>
                  </td>

                  <td style="padding: 10px 12px; text-align: center;">
                    ${isAdmin ? `
                      <button class="btn-delete-insp" data-id="${insp.id}" data-name="${insp.plate} Denetim Raporu" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">
                        🗑️
                      </button>
                    ` : '<span style="font-size: 0.7rem; color: #64748b;">-</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB CONTENT: 3. SÜRÜCÜ BELGELERİ & 3 AYLIK BEYAN -->
      <div id="tab-drivers" class="veh-tab-content" style="display: ${activeTabId === 'tab-drivers' ? 'block' : 'none'};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(168, 85, 247, 0.3);">
          <div style="font-weight: 800; color: #C084FC; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
            <span>🪪</span> SAHA SÜRÜCÜ BELGELERİ & 3 AYLIK CEZA PUANI BEYAN TAKİBİ
          </div>
          <button class="btn-add-driver-trigger" style="background: linear-gradient(135deg, #A855F7 0%, #6366F1 100%); color: #fff; font-weight: 800; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; box-shadow: 0 4px 14px rgba(168, 85, 247, 0.3);">
            <span>➕</span> Yeni Sürücü / Ehliyet Kaydı Ekle
          </button>
        </div>

        ${filteredDrivers.length > 0 ? `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
              <thead>
                <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Sürücü / Ekip</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Ehliyet Sınıfı / Belge No</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Mevcut SRC Belgeleri</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Psikoteknik Bitiş</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Son 3 Aylık Beyan</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Gelecek Beyan Tarihi</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${filteredDrivers.map(d => {
                  const today = new Date();
                  const nextCheck = new Date(d.next3MonthCheckDate);
                  const daysToCheck = Math.ceil((nextCheck.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                  const isOverdue = daysToCheck <= 0;

                  return `
                    <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); background: ${isOverdue ? 'rgba(245, 158, 11, 0.08)' : 'transparent'};">
                      <td style="padding: 10px 12px;">
                        <div style="font-weight: 800; color: #F8FAFC;">${d.personnelName}</div>
                        <div style="font-size: 0.72rem; color: #38BDF8;">${d.team}</div>
                      </td>

                      <td style="padding: 10px 12px;">
                        <div style="font-weight: 800; color: #C084FC; font-size: 0.88rem; letter-spacing: 0.5px;">${d.licenseClass}</div>
                        <div style="font-size: 0.72rem; color: #64748b;">${d.licenseNumber}</div>
                      </td>

                      <td style="padding: 10px 12px; color: #cbd5e1;">${d.srcExpiryDate || '-'}</td>
                      <td style="padding: 10px 12px; color: #cbd5e1;">${d.psychotechnicExpiryDate || '-'}</td>

                      <td style="padding: 10px 12px; color: #cbd5e1;">${d.last3MonthCheckDate}</td>

                      <td style="padding: 10px 12px;">
                        <div style="font-weight: 700; color: ${isOverdue ? '#EF4444' : '#F59E0B'}; font-size: 0.82rem;">
                          ${d.next3MonthCheckDate}
                        </div>
                        <div style="font-size: 0.72rem; color: ${isOverdue ? '#FCA5A5' : '#64748b'};">
                          ${isOverdue ? `⚠️ BEYAN ZAMANI (${Math.abs(daysToCheck)} Gün Gecikti)` : `${daysToCheck} Gün Kaldı`}
                        </div>
                      </td>

                      <td style="padding: 10px 12px; text-align: center; display: flex; gap: 4px; justify-content: center;">
                        <button class="btn-verify-driver" data-driver-id="${d.id}" data-driver-name="${d.personnelName}" style="background: ${isOverdue ? '#F59E0B' : 'rgba(255,255,255,0.1)'}; color: ${isOverdue ? '#000' : '#fff'}; font-weight: 800; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">
                          ✍️ Beyan
                        </button>
                        ${isAdmin ? `
                          <button class="btn-delete-driver" data-id="${d.id}" data-name="${d.personnelName}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">
                            🗑️
                          </button>
                        ` : ''}
                      </td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(168, 85, 247, 0.4); border-radius: 12px; padding: 36px 20px; text-align: center; color: #94a3b8;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🪪</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #F8FAFC;">Henüz Sürücü / Ehliyet Kaydı Bulunmuyor</div>
            <div style="font-size: 0.8rem; margin-top: 4px; margin-bottom: 18px; color: #94a3b8;">Sürücü ehliyet sınıflarını, belgelendirmeleri ve 3 aylık ceza puanı beyanlarını takip etmek için sürücü ekleyin.</div>
            <button class="btn-add-driver-trigger" style="background: linear-gradient(135deg, #A855F7 0%, #6366F1 100%); color: #fff; font-weight: 800; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(168, 85, 247, 0.4);">
              <span>➕</span> İlk Sürücü / Ehliyet Kaydını Ekle
            </button>
          </div>
        `}
      </div>

      <!-- TAB CONTENT: 4. TRAFİK CEZALARI -->
      <div id="tab-fines" class="veh-tab-content" style="display: none;">
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plaka / Sürücü & Ceza Sayacı</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Ceza Kodu & Açıklama</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Tutar (TL)</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">%25 Erken İndirimli Tutar</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">İndirim Son Günü</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Durum & Ödeyen</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${filteredFines.map(f => {
                const today = new Date();
                const discDate = new Date(f.discountDeadline);
                const daysToDiscount = Math.ceil((discDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                const isDiscountActive = daysToDiscount > 0;
                const discountedAmount = (f.amount * 0.75).toLocaleString('tr-TR', { minimumFractionDigits: 2 });

                const vehFines = fines.filter(x => x.plate === f.plate);
                const totalVehFines = vehFines.length;
                const reverseIdx = vehFines.findIndex(x => x.id === f.id);
                const seqIndex = totalVehFines - reverseIdx;
                const seqLabel = seqIndex === totalVehFines ? (totalVehFines === 1 ? '1. Cezası' : `${seqIndex}. (Son) Cezası`) : (seqIndex === 1 ? '1. (İlk) Cezası' : `${seqIndex}. Cezası`);

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 800; color: #00F2FE; cursor: pointer; display: flex; align-items: center; gap: 6px;" class="btn-view-fine-history" data-plate="${f.plate}">
                        <span>${f.plate}</span>
                        <span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 10px; background: rgba(168, 85, 247, 0.25); color: #C084FC; font-weight: 800;" title="Tüm ceza geçmişini gör">
                          🏷️ Bu Aracın ${seqLabel} (${totalVehFines} Ceza)
                        </span>
                      </div>
                      <div style="font-size: 0.75rem; color: #cbd5e1; margin-top: 2px;">${f.driverName || 'Sürücü Belirtilmedi'} (${f.team || '-'})</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 700; color: #F8FAFC;">${f.fineCode}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">Tarih: ${f.fineDate}</div>
                    </td>

                    <td style="padding: 10px 12px; font-weight: 800; color: #EF4444;">
                      ${f.amount.toLocaleString('tr-TR')} ₺
                    </td>

                    <td style="padding: 10px 12px; font-weight: 800; color: #14F195;">
                      ${discountedAmount} ₺ (%25 İndirimli)
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 700; color: ${isDiscountActive ? '#F59E0B' : '#64748b'}; font-size: 0.8rem;">
                        ${f.discountDeadline}
                      </div>
                      <div style="font-size: 0.72rem; color: ${isDiscountActive ? '#FDE047' : '#64748b'};">
                        ${isDiscountActive ? `🔥 %25 İndirim için Son ${daysToDiscount} Gün` : 'Süre Doldu'}
                      </div>
                    </td>

                    <td style="padding: 10px 12px; text-align: center;">
                      ${f.status === 'PAID' ? `
                        <span style="padding: 4px 10px; border-radius: 14px; font-size: 0.72rem; font-weight: 800; background: ${f.paidBy === 'PERSONNEL' ? 'rgba(59, 130, 246, 0.2)' : 'rgba(20, 241, 149, 0.2)'}; color: ${f.paidBy === 'PERSONNEL' ? '#60A5FA' : '#14F195'}; border: 1px solid ${f.paidBy === 'PERSONNEL' ? 'rgba(59, 130, 246, 0.4)' : 'rgba(20, 241, 149, 0.4)'};">
                          ${f.paidBy === 'PERSONNEL' ? `✅ ÖDENDİ (👤 Personel: ${f.paidByName || f.driverName || 'Sürücü'})` : '✅ ÖDENDİ (🏢 Şirket)'}
                        </span>
                      ` : `
                        <span style="padding: 4px 10px; border-radius: 14px; font-size: 0.72rem; font-weight: 800; background: rgba(245, 158, 11, 0.2); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.4);">
                          ⏳ ÖDEME BEKLİYOR
                        </span>
                      `}
                    </td>

                    <td style="padding: 10px 12px; text-align: center;">
                      <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                        ${f.status === 'PENDING' ? `
                          <button class="btn-pay-fine" data-id="${f.id}" data-plate="${f.plate}" data-code="${f.fineCode}" data-amount="${f.amount}" data-disc-amount="${f.amount * 0.75}" data-driver="${f.driverName || ''}" style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.4); color: #14F195; font-weight: 800; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="Ödeme Yap (Şirket mi / Personel mi?)">
                            💳 Ödendi Yap
                          </button>
                        ` : ''}
                        ${isAdmin ? `
                          <button class="btn-edit-fine" data-id="${f.id}" style="background: rgba(245, 158, 11, 0.15); border: 1px solid rgba(245, 158, 11, 0.4); color: #F59E0B; font-weight: 800; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="Cezayı / Tutarı Düzenle">
                            ✏️ Düzenle
                          </button>
                          <button class="btn-delete-fine" data-id="${f.id}" data-name="${f.plate} ${f.fineCode}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="Cezayı Sil">
                            🗑️
                          </button>
                        ` : ''}
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB CONTENT: 5. SAHADAN HASAR BİLDİRİMLERİ -->
      <div id="tab-damages" class="veh-tab-content" style="display: none;">
        <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
            <thead>
              <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plaka / Tarih</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Bildiren Personel</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Hasar Kategori</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Açıklama / Kaza Tutanağı</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Durum</th>
                <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">İşlem</th>
              </tr>
            </thead>
            <tbody>
              ${filteredDamages.map(d => `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px 12px;">
                    <div style="font-weight: 800; color: #00F2FE;">${d.plate}</div>
                    <div style="font-size: 0.72rem; color: #64748b;">${d.reportDate}</div>
                  </td>

                  <td style="padding: 10px 12px;">
                    <div style="font-weight: 700; color: #F8FAFC;">${d.reportedBy}</div>
                    <div style="font-size: 0.72rem; color: #38BDF8; font-weight: 700;">${formatTeamName(d.team || 'Team15')}</div>
                  </td>

                  <td style="padding: 10px 12px; color: #F59E0B; font-weight: 700;">
                    ${d.damageType === 'ACCIDENT' ? '💥 KAZA' : (d.damageType === 'SCRATCH' ? '🎨 ÇİZİK' : (d.damageType === 'MECHANICAL_FAULT' ? '⚙️ MOTOR' : '⚠️ DİĞER'))}
                  </td>

                  <td style="padding: 10px 12px; color: #cbd5e1;">
                    <div>${d.description}</div>
                    ${d.damageType === 'ACCIDENT' ? `
                      <div style="margin-top: 4px; display: flex; gap: 6px; flex-wrap: wrap;">
                        <button type="button" class="btn-open-dmg-tutanaq" data-plate="${d.plate}" data-img="${d.accidentReportPhotoUrl || (d.photoUrls && d.photoUrls.length > 0 ? d.photoUrls[0] : '')}" style="background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.5); color: #FCA5A5; font-weight: 800; font-size: 0.68rem; padding: 2px 8px; border-radius: 4px; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;" title="Kaza Tutanağını İncele & İndir">
                          📄 Kaza Tutanağı Yüklendi (Tıkla İncele)
                        </button>
                        ${d.otherPartyPlate ? `<span style="font-size: 0.68rem; padding: 2px 6px; border-radius: 3px; background: rgba(59, 130, 246, 0.2); color: #93C5FD;">🚗 Karşı Plaka: ${d.otherPartyPlate}</span>` : ''}
                      </div>
                    ` : ''}
                    ${d.photoUrls && d.photoUrls.length > 0 ? `
                      <div style="margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; align-items: center;">
                        <div style="font-size: 0.7rem; color: #38BDF8; font-weight: 700; width: 100%;">📸 Hasar Fotoğrafları (${d.photoUrls.length}):</div>
                        ${d.photoUrls.map((url, imgIdx) => `
                          <button type="button" class="btn-preview-dmg-photo" data-url="${url}" data-title="${d.plate} - Hasar Fotoğrafı ${imgIdx + 1}" style="display: block; width: 48px; height: 48px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.5); background: #000; box-shadow: 0 2px 6px rgba(0,0,0,0.4); padding: 0; cursor: pointer; transition: transform 0.2s;" title="Fotoğraf ${imgIdx + 1}'i Büyüt">
                            <img src="${url}" style="width: 100%; height: 100%; object-fit: cover; pointer-events: none;" />
                          </button>
                        `).join('')}
                      </div>
                    ` : ''}
                  </td>

                  <td style="padding: 10px 12px; text-align: center;">
                    <span style="padding: 3px 8px; border-radius: 14px; font-size: 0.7rem; font-weight: 800; background: ${d.status === 'RESOLVED' ? 'rgba(20, 241, 149, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${d.status === 'RESOLVED' ? '#14F195' : '#EF4444'};">
                      ${d.status === 'RESOLVED' ? 'ONARILDI' : 'AÇIK'}
                    </span>
                  </td>

                  <td style="padding: 10px 12px; text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center; align-items: center;">
                      ${d.status === 'OPEN' ? `
                        <button class="btn-resolve-damage" data-id="${d.id}" data-name="${d.plate} Hasar Kaydı" style="background: rgba(20, 241, 149, 0.15); border: 1px solid rgba(20, 241, 149, 0.3); color: #14F195; font-weight: 700; padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;" title="Hasarı Onarıldı Olarak İşaretle">
                          🔧 Onarıldı
                        </button>
                      ` : ''}
                      ${isAdmin ? `
                        <button class="btn-delete-damage" data-id="${d.id}" data-name="${d.plate} Hasar Kaydı" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 3px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB CONTENT: 6. BAKIM, ARIZA & SERVİS MALİYETLERİ -->
      <div id="tab-maintenance" class="veh-tab-content" style="display: ${activeTabId === 'tab-maintenance' ? 'block' : 'none'};">
        <!-- ÖZET MALİYET & SAYAÇ KARTLARI -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 16px;">
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 12px 16px;">
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">TOPLAM SERVİS HARCAMASI</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #38BDF8; margin-top: 4px;">
              ${filteredMaintenance.reduce((sum, m) => sum + (m.costAmount || 0), 0).toLocaleString('tr-TR')} ₺
            </div>
          </div>
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 10px; padding: 12px 16px;">
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">TOPLAM BAKIM & ONARIM</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #C084FC; margin-top: 4px;">
              ${filteredMaintenance.length} Kayıt
            </div>
          </div>
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 10px; padding: 12px 16px;">
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">ORTALAMA BAKIM MALİYETİ</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #34D399; margin-top: 4px;">
              ${filteredMaintenance.length > 0 ? Math.round(filteredMaintenance.reduce((sum, m) => sum + (m.costAmount || 0), 0) / filteredMaintenance.length).toLocaleString('tr-TR') : 0} ₺
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 10px; background: rgba(15, 23, 42, 0.6); padding: 10px 14px; border-radius: 8px; border: 1px solid rgba(56, 189, 248, 0.3);">
          <div style="font-weight: 800; color: #38BDF8; font-size: 0.88rem; display: flex; align-items: center; gap: 6px;">
            <span>🛠️</span> ARAÇ BAKIM, ARIZA ONARIM & SERVİS FİŞİ GEÇMİŞİ
          </div>
          <button class="btn-add-maint-trigger" style="background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); color: #000; font-weight: 900; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; display: flex; align-items: center; gap: 6px; font-size: 0.8rem; box-shadow: 0 4px 14px rgba(0, 242, 254, 0.3);">
            <span>➕</span> Yeni Bakım / Servis Kaydı Ekle
          </button>
        </div>

        ${filteredMaintenance.length > 0 ? `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 10px; overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
              <thead>
                <tr style="background: rgba(30, 41, 59, 0.9); color: #94a3b8; text-transform: uppercase; font-size: 0.72rem; letter-spacing: 1px;">
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Plaka & İşlem Türü</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Servis Tarihi & Bakım KM</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Servis / Tamirci & Fatura No</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1);">Yapılan İşlemler & Değişenler</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: right;">Servis Tutarı (TL)</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">Bakım Fişi / Fatura</th>
                  <th style="padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,0.1); text-align: center;">İşlem</th>
                </tr>
              </thead>
              <tbody>
                ${filteredMaintenance.map(m => `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 900; color: #00F2FE;">${m.plate}</div>
                      <div style="font-size: 0.75rem; color: #F59E0B; font-weight: 700;">${m.serviceTypeLabel || 'Periyodik Bakım'}</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 800; color: #F8FAFC;">${m.serviceDate}</div>
                      <div style="font-size: 0.72rem; color: #38BDF8;">📍 ${m.serviceKm.toLocaleString('tr-TR')} KM</div>
                    </td>

                    <td style="padding: 10px 12px;">
                      <div style="font-weight: 700; color: #cbd5e1;">${m.serviceNameCompany || 'Özel Servis'}</div>
                      <div style="font-size: 0.72rem; color: #64748b;">${m.invoiceNumber ? `Fatura: ${m.invoiceNumber}` : 'Fatura No Yok'}</div>
                    </td>

                    <td style="padding: 10px 12px; color: #cbd5e1; max-width: 250px; font-size: 0.78rem;">
                      ${m.descriptionNotes || '-'}
                    </td>

                    <td style="padding: 10px 12px; text-align: right; font-weight: 900; color: #14F195; font-size: 0.95rem;">
                      ${m.costAmount.toLocaleString('tr-TR')} ₺
                    </td>

                    <td style="padding: 10px 12px; text-align: center;">
                      ${m.receiptPhotoUrl ? `
                        <button class="btn-view-receipt" data-url="${m.receiptPhotoUrl}" style="background: rgba(56, 189, 248, 0.15); border: 1px solid #38BDF8; color: #38BDF8; font-weight: 800; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;">
                          🧾 Fişi Göster
                        </button>
                      ` : `
                        <span style="font-size: 0.72rem; color: #64748b;">Belge Yok</span>
                      `}
                    </td>

                    <td style="padding: 10px 12px; text-align: center;">
                      ${isAdmin ? `
                        <button class="btn-delete-maint" data-id="${m.id}" data-plate="${m.plate}" style="background: rgba(239, 68, 68, 0.15); border: 1px solid rgba(239, 68, 68, 0.3); color: #EF4444; font-weight: 700; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 0.72rem;">
                          🗑️
                        </button>
                      ` : '<span style="font-size: 0.7rem; color: #64748b;">-</span>'}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div style="background: rgba(15, 23, 42, 0.6); border: 1px dashed rgba(56, 189, 248, 0.4); border-radius: 12px; padding: 36px 20px; text-align: center; color: #94a3b8;">
            <div style="font-size: 2.5rem; margin-bottom: 8px;">🛠️</div>
            <div style="font-size: 1.05rem; font-weight: 800; color: #F8FAFC;">Henüz Bakım & Servis Kaydı Bulunmuyor</div>
            <div style="font-size: 0.8rem; margin-top: 4px; margin-bottom: 18px; color: #94a3b8;">Araçların periyodik bakımlarını, arıza onarım masraflarını ve servis fişlerini takip etmek için kayıt ekleyin.</div>
            <button class="btn-add-maint-trigger" style="background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); color: #000; font-weight: 900; border: none; padding: 10px 22px; border-radius: 8px; cursor: pointer; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 16px rgba(0, 242, 254, 0.4);">
              <span>➕</span> İlk Bakım / Servis Kaydını Ekle
            </button>
          </div>
        `}
      </div>
    </div>

    <!-- MODAL 1: YENİ FİLO ARAÇ KAYDI MODALI -->
    <div id="modal-vehicle-form" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid rgba(0, 242, 254, 0.4); border-radius: 16px; width: 100%; max-width: 680px; max-height: 85vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 60px rgba(0,0,0,0.7); box-sizing: border-box; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #00F2FE; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🚗</span> YENİ FİLO ARAÇ KAYDI
          </h2>
          <button id="modal-close-veh" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-vehicle" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 4px; max-height: calc(85vh - 90px);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Araç Plakası *</label>
              <input type="text" id="veh-plate" placeholder="Örn: 34 AB 1234" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Marka & Model *</label>
              <input type="text" id="veh-brand" placeholder="Örn: Ford Ranger 2.0 Wildtrak" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ruhsat Sahibi Firma / Şirket *</label>
              <input type="text" id="veh-company" placeholder="Örn: Demirer Kablo veya Anemon Enerji A.Ş." required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(245, 158, 11, 0.5); color: #FBBF24; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ait Olduğu Saha / Santral *</label>
              <input type="text" id="veh-site" list="site-options-list" placeholder="Örn: Anemon İntepe, Merkez Ofis veya Şahsi" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(0, 242, 254, 0.5); color: #00F2FE; font-weight: 700; box-sizing: border-box;" />
              <datalist id="site-options-list">
                ${OFFICIAL_SITES.map(s => `<option value="${s}"></option>`).join('')}
                <option value="Merkez Ofis"></option>
                <option value="Şahsi / Özel"></option>
              </datalist>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Zimmetli Ekip / Sürücü / Kullanıcı *</label>
              <input type="text" id="veh-team" list="team-options-list" placeholder="Örn: Team03 veya Şahsi Araç" value="${userTeam || 'Team03'}" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
              <datalist id="team-options-list">
                ${(isAdmin ? ALL_TEAMS : managedTeamsList).map(t => `<option value="${t}"></option>`).join('')}
                <option value="Şahsi Araç"></option>
                <option value="Yönetici / Müşavir"></option>
              </datalist>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Model Yılı</label>
              <input type="number" id="veh-year" placeholder="Örn: 2023" value="2023" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Şasi Numarası (VIN)</label>
              <input type="text" id="veh-vin" placeholder="Örn: NM0XXTTFXN8849102" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-family: monospace; box-sizing: border-box;" />
            </div>

            <div style="grid-column: span 2;">
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 2px;">TÜVTÜRK Muayene Gelecek Bitiş Tarihi (Son Geçerlilik) (İsteğe Bağlı)</label>
              <div style="font-size: 0.72rem; color: #F59E0B; margin-bottom: 6px;">💡 Not: Muayene tarihi girmeseniz de araç kaydedilir. Girilmeyen araçlarda tablo ve uyarılarda "⚠️ Muayene Tarihi Giriniz" uyarısı gösterilir.</div>
              <input type="date" id="veh-insp-date" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <button type="button" id="btn-cancel-veh" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); color: #000; font-weight: 800; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 2: FOTOĞRAFLI PERİYODİK ARAÇ DENETİMI MODALI -->
    <div id="modal-inspection-form" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid rgba(20, 241, 149, 0.4); border-radius: 16px; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #14F195; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>📷</span> 5 AÇILI FOTOĞRAFLI PERİYODİK ARAÇ DENETİMİ
          </h2>
          <button id="modal-close-insp" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-inspection" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 6px; flex: 1;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Denetlenen Araç *</label>
              <select id="insp-vehicle-id" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;">
                ${vehicles.map(v => `<option value="${v.id}" data-plate="${v.plate}" data-team="${v.assignedTeamName || 'Team01'}">${v.plate} - ${v.brandModel}</option>`).join('')}
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Denetleyen Personel *</label>
              <input type="text" id="insp-personnel" placeholder="Personel Adı Soyadı Giriniz..." value="" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Güncel KM Göstergesi *</label>
              <input type="number" id="insp-km" placeholder="Örn: 142500" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Denetim Tarihi</label>
              <input type="date" id="insp-date" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>
          </div>

          <!-- 5 ZORUNLU FOTOĞRAFLI KONTROL ALANI -->
          <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 14px;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #14F195; margin-bottom: 10px;">
              📸 5 AÇILI ZORUNLU ARAÇ DENETİM FOTOĞRAFLARI
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
              <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">1. Dış Görünüm Fotoğrafı</div>
                <input type="file" accept="image/*" style="font-size: 0.7rem; color: #94a3b8; width: 100%;" />
              </div>

              <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">2. İç Kabin & Torpido</div>
                <input type="file" accept="image/*" style="font-size: 0.7rem; color: #94a3b8; width: 100%;" />
              </div>

              <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">3. Kaput Açık Motor İçi</div>
                <input type="file" accept="image/*" style="font-size: 0.7rem; color: #94a3b8; width: 100%;" />
              </div>

              <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">4. Bagaj & Ekipmanlar</div>
                <input type="file" accept="image/*" style="font-size: 0.7rem; color: #94a3b8; width: 100%;" />
              </div>

              <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(255,255,255,0.2); text-align: center;">
                <div style="font-size: 0.75rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">5. KM Saati Göstergesi</div>
                <input type="file" accept="image/*" style="font-size: 0.7rem; color: #94a3b8; width: 100%;" />
              </div>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Denetim Notları & Bulgular</label>
            <textarea id="insp-notes" rows="2" placeholder="Araç genel durumu, yangın tüpü kontrolü, kaporta çizik durumu..." style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); position: sticky; bottom: 0; background: #0f172a; z-index: 10;">
            <button type="button" id="btn-cancel-insp" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #14F195 0%, #00F2FE 100%); color: #000; font-weight: 800; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Denetim Raporunu Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 3: ARAÇ DETAY MODALI -->
    <div id="modal-vehicle-detail" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #00F2FE; border-radius: 16px; width: 100%; max-width: 750px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 10px 40px rgba(0,242,254,0.3); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <div>
            <h2 id="detail-veh-title" style="font-size: 1.5rem; font-weight: 900; color: #00F2FE; margin: 0; display: flex; align-items: center; gap: 10px;">
              <span>🚘</span> <span id="detail-plate">34 DH 1923</span>
            </h2>
            <div id="detail-sub" style="font-size: 0.85rem; color: #94a3b8; margin-top: 4px;">Ford Ranger 2.0 Wildtrak (2023)</div>
          </div>
          <button id="modal-close-detail" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <div id="detail-body-content" style="display: flex; flex-direction: column; gap: 18px; overflow-y: auto; padding-right: 6px; flex: 1;">
          <!-- Detay içeriği JavaScript ile dolacak -->
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); position: sticky; bottom: 0; background: #0f172a; z-index: 10; gap: 10px;">
          <button id="btn-close-detail-footer" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: 700;">Kapat</button>
        </div>
      </div>
    </div>

    <!-- MODAL 4: SAHADAN HASAR / ARIZA BİLDİRİMİ MODALI (DİNAMİK KAZA TUTANAĞI ALANLI) -->
    <div id="modal-damage-form" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid rgba(239, 68, 68, 0.5); border-radius: 16px; width: 100%; max-width: 650px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 10px 40px rgba(239, 68, 68, 0.3); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #EF4444; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>💥</span> SAHADAN HASAR / ARIZA BİLDİRİMİ
          </h2>
          <button id="modal-close-damage" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-damage" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 6px; flex: 1;">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Hasarlı Araç Plakası *</label>
              <input type="text" id="dmg-plate" list="dmg-vehicle-list" placeholder="Örn: 34 DH 1923" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(239, 68, 68, 0.5); color: #00F2FE; font-weight: 800; box-sizing: border-box;" />
              <datalist id="dmg-vehicle-list">
                ${vehicles.map(v => `<option value="${v.plate}">${v.brandModel}</option>`).join('')}
              </datalist>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Bildiren Personel *</label>
              <input type="text" id="dmg-reporter" value="" placeholder="Ad Soyad giriniz..." required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Hasar Kategori / Tipi *</label>
              <select id="dmg-type" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #F59E0B; font-weight: 700; box-sizing: border-box;">
                <option value="ACCIDENT">💥 Trafik Kazası / Çarpışma</option>
                <option value="SCRATCH">🎨 Yüzeysel Çizik / Kaporta Sürtmesi</option>
                <option value="MECHANICAL_FAULT">⚙️ Motor / Mekanik Arıza</option>
                <option value="OTHER">⚠️ Diğer (Cam Kırığı, Lastik vb.)</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Hasar Tarihi</label>
              <input type="date" id="dmg-date" value="${new Date().toISOString().split('T')[0]}" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>
          </div>

          <!-- DİNAMİK TRAFİK KAZASI TUTANAĞI BÖLÜMÜ -->
          <div id="accident-report-section" style="background: rgba(239, 68, 68, 0.12); border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 10px; padding: 14px;">
            <div style="font-size: 0.85rem; font-weight: 900; color: #EF4444; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
              <span>🚨</span> TRAFİK KAZASI TUTANAĞI & POLİS RAPORU BİLGİLERİ
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px;">
              <div>
                <label style="display: block; font-size: 0.75rem; color: #cbd5e1; font-weight: 700; margin-bottom: 4px;">Karşı Taraf Plaka / Sürücü Bilgisi</label>
                <input type="text" id="dmg-other-plate" placeholder="Örn: 34 ABC 789 (Diğer Sürücü)" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 0.8rem; box-sizing: border-box;" />
              </div>

              <div>
                <label style="display: block; font-size: 0.75rem; color: #cbd5e1; font-weight: 700; margin-bottom: 4px;">Kasko / Sigorta Hasar Dosya No</label>
                <input type="text" id="dmg-claim-no" placeholder="Örn: KSK-2026-99120" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(15, 23, 42, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-size: 0.8rem; box-sizing: border-box;" />
              </div>
            </div>

            <div style="background: rgba(15, 23, 42, 0.8); padding: 10px; border-radius: 6px; border: 1px dashed rgba(239, 68, 68, 0.5);">
              <label style="display: block; font-size: 0.78rem; color: #FCA5A5; font-weight: 800; margin-bottom: 4px;">📄 Anlaşmalı Kaza Tutanağı / Polis Zaptı (PDF veya Fotoğraf)</label>
              <input type="file" id="dmg-report-file" accept="image/*,application/pdf" style="font-size: 0.75rem; color: #94a3b8; width: 100%;" />
              <div id="dmg-report-file-name" style="font-size: 0.72rem; color: #14F195; font-weight: 700; margin-top: 4px; display: none;"></div>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Hasar Detayı & Olay Özeti *</label>
            <textarea id="dmg-desc" rows="3" placeholder="Hasarın oluş biçimini ve hasarlı bölgeyi açıklayınız..." required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;"></textarea>
          </div>

          <!-- ÇOKLU HASAR FOTOĞRAFLARI YÜKLEME ALANI -->
          <div style="background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 10px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <label style="font-size: 0.82rem; font-weight: 800; color: #38BDF8; display: flex; align-items: center; gap: 6px; margin: 0;">
                <span>📸</span> HASAR FOTOĞRAFLARI (Birden Fazla Seçilebilir)
              </label>
              <button type="button" id="btn-trigger-dmg-photos" style="background: linear-gradient(135deg, #38BDF8 0%, #3B82F6 100%); color: #000; font-weight: 800; border: none; padding: 6px 14px; border-radius: 6px; cursor: pointer; font-size: 0.78rem; display: flex; align-items: center; gap: 6px;">
                <span>➕</span> Fotoğraf Ekle
              </button>
              <input type="file" id="dmg-photos-input" multiple accept="image/*" style="display: none;" />
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-bottom: 8px;">
              💡 Kaza yerinden, araç hasar bölgelerinden ve plakadan istediğiniz kadar fotoğraf ekleyebilirsiniz.
            </div>
            <div id="dmg-photo-preview-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(75px, 1fr)); gap: 8px;"></div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); position: sticky; bottom: 0; background: #0f172a; z-index: 10;">
            <button type="button" id="btn-cancel-damage" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #EF4444 0%, #F59E0B 100%); color: #fff; font-weight: 800; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Hasar Bildirimini Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL: HASAR & BELGE FOTOĞRAF İNCELEME LIGHTBOX MODALI -->
    <div id="modal-photo-lightbox" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.95); backdrop-filter: blur(14px); z-index: 9999999; justify-content: center; align-items: center; box-sizing: border-box;">
      <button id="lightbox-close" style="position: fixed; top: 16px; right: 16px; background: rgba(255,255,255,0.15); border: 2px solid rgba(255,255,255,0.4); color: #fff; font-size: 1.8rem; width: 42px; height: 42px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; z-index: 10000000; backdrop-filter: blur(6px);">&times;</button>
      <div id="lightbox-title" style="position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%); color: #38BDF8; font-weight: 800; font-size: 0.85rem; padding: 5px 16px; background: rgba(0,0,0,0.75); border-radius: 8px; z-index: 10000000; white-space: nowrap; backdrop-filter: blur(6px);">Fotoğraf İnceleme</div>
      <img id="lightbox-img" src="" style="display: block; max-width: 92vw; max-height: 92vh; object-fit: contain; margin: auto; border-radius: 6px; box-shadow: 0 8px 32px rgba(0,0,0,0.9);" />
    </div>
    <div id="modal-fine-pay-form" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid rgba(20, 241, 149, 0.5); border-radius: 16px; width: 100%; max-width: 520px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 10px 40px rgba(20, 241, 149, 0.3); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.25rem; font-weight: 900; color: #14F195; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>💳</span> TRAFİK CEZASI ÖDEME KAYDI
          </h2>
          <button id="modal-close-pay" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-pay-fine" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 6px; flex: 1;">
          <input type="hidden" id="pay-fine-id" />
          
          <div style="background: rgba(30, 41, 59, 0.6); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
            <div id="pay-fine-info" style="font-size: 0.88rem; font-weight: 800; color: #00F2FE;">34 DH 1923 - 51/2-a Hız İhlali</div>
            <div id="pay-fine-sub" style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">Sürücü: ---</div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">Ödemeyi Yapan Taraf *</label>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
              <label style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(20, 241, 149, 0.4); padding: 10px; border-radius: 6px; cursor: pointer; color: #14F195; font-weight: 800; font-size: 0.82rem;">
                <input type="radio" name="pay-by-radio" value="COMPANY" checked />
                🏢 Şirket (Firma)
              </label>

              <label style="display: flex; align-items: center; gap: 8px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(59, 130, 246, 0.4); padding: 10px; border-radius: 6px; cursor: pointer; color: #60A5FA; font-weight: 800; font-size: 0.82rem;">
                <input type="radio" name="pay-by-radio" value="PERSONNEL" />
                👤 Personel (Sürücü)
              </label>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 6px;">Ödenen Tutar Seçeneği *</label>
            <div style="display: flex; flex-direction: column; gap: 8px;">
              <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(20, 241, 149, 0.4); padding: 10px; border-radius: 6px; cursor: pointer; color: #fff; font-weight: 700; font-size: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="pay-amount-radio" value="DISCOUNT" checked />
                  <span>🔥 %25 Erken Ödeme İndirimli Tutar</span>
                </div>
                <span id="pay-disc-amount-label" style="font-weight: 900; color: #14F195;">4.500 ₺</span>
              </label>

              <label style="display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255, 255, 255, 0.15); padding: 10px; border-radius: 6px; cursor: pointer; color: #fff; font-weight: 700; font-size: 0.85rem;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <input type="radio" name="pay-amount-radio" value="FULL" />
                  <span>🔴 Tam İndirimsiz Tutar</span>
                </div>
                <span id="pay-full-amount-label" style="font-weight: 900; color: #EF4444;">6.000 ₺</span>
              </label>
            </div>
          </div>

          <div id="pay-personnel-name-group" style="display: none;">
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ödeyen Personel Adı Soyadı</label>
            <input type="text" id="pay-personnel-name" placeholder="Personel Adı Soyadı Giriniz" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); position: sticky; bottom: 0; background: #0f172a; z-index: 10;">
            <button type="button" id="btn-cancel-pay" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #14F195 0%, #00F2FE 100%); color: #000; font-weight: 900; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">✅ Ödemeyi Onayla</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 6: ARAÇ / SÜRÜCÜ CEZA GEÇMİŞİ VE KARNESİ MODALI -->
    <div id="modal-fine-history" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #A855F7; border-radius: 16px; width: 100%; max-width: 680px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 10px 40px rgba(168, 85, 247, 0.3); box-sizing: border-box;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <div>
            <h2 id="fine-hist-title" style="font-size: 1.35rem; font-weight: 900; color: #A855F7; margin: 0; display: flex; align-items: center; gap: 8px;">
              <span>📑</span> <span id="fine-hist-plate">34 DH 1923</span> ARAÇ CEZA KARNESİ
            </h2>
            <div id="fine-hist-sub" style="font-size: 0.8rem; color: #94a3b8; margin-top: 2px;">Toplam 3 Trafik Cezası Kayıtlı</div>
          </div>
          <button id="modal-close-fine-hist" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <div id="fine-hist-body" style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 4px; flex: 1;">
          <!-- JavaScript ile kronolojik ceza listesi basılacak -->
        </div>

        <div style="display: flex; justify-content: flex-end; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); position: sticky; bottom: 0; background: #0f172a; z-index: 10;">
          <button id="btn-close-fine-hist-footer" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 8px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">Kapat</button>
        </div>
      </div>
    </div>

    <!-- MODAL 7: YENİ SÜRÜCÜ & EHLİYET BEYAN KAYDI MODALI -->
    <div id="modal-driver-form" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #A855F7; border-radius: 16px; width: 100%; max-width: 650px; max-height: 85vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 60px rgba(168, 85, 247, 0.3); box-sizing: border-box; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #A855F7; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🪪</span> YENİ SÜRÜCÜ & EHLİYET BEYAN KAYDI
          </h2>
          <button id="modal-close-driver" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-driver" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 4px; max-height: calc(85vh - 90px);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Sürücü Adı Soyadı *</label>
              <input type="text" id="drv-name" placeholder="Personel Adı Soyadı Giriniz" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>



            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">T.C. / Ehliyet Belge No *</label>
              <input type="text" id="drv-license-no" placeholder="Örn: 12345678901" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-family: monospace; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ehliyet Sınıfı (Elle Yazılabilir) *</label>
              <input type="text" id="drv-class" list="license-class-suggestions" placeholder="Örn: A1 A2 B B1 D1 F M veya B, C, CE" value="B" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(168, 85, 247, 0.5); color: #E9D5FF; font-weight: 800; box-sizing: border-box;" />
              <datalist id="license-class-suggestions">
                <option value="A1 A2 B B1 D1 F M"></option>
                <option value="B"></option>
                <option value="B C CE"></option>
                <option value="B D1"></option>
                <option value="B C D CE"></option>
              </datalist>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Sahip Olunan SRC Belgeleri</label>
              <input type="text" id="drv-src-date" list="src-type-suggestions" placeholder="Örn: SRC 2, SRC 4 (Veya Yok)" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
              <datalist id="src-type-suggestions">
                <option value="SRC 2, SRC 4 (Yolcu & Eşya)"></option>
                <option value="SRC 2 (Yurtiçi Yolcu)"></option>
                <option value="SRC 4 (Yurtiçi Eşya / Kargo)"></option>
                <option value="SRC 1, SRC 3 (Uluslararası)"></option>
                <option value="SRC 5 (Tehlikeli Madde)"></option>
                <option value="Yok / Muaf"></option>
              </datalist>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Psikoteknik Bitiş Tarihi</label>
              <input type="date" id="drv-psy-date" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
            </div>
          </div>

          <div style="background: rgba(30, 41, 59, 0.5); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 8px; padding: 10px; margin-top: 4px;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #38BDF8; margin-bottom: 4px;">📋 3 Aylık Ehliyet Ceza Puanı Beyan Onayı</div>
            <div style="font-size: 0.75rem; color: #94a3b8;">
              Kaydedilen sürücünün ilk 3 aylık beyanı bugünün tarihi (${new Date().toISOString().split('T')[0]}) olarak sisteme işlenir. 90 gün sonra otomatik beyan yenileme uyarısı verilir.
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <button type="button" id="btn-cancel-driver" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #A855F7 0%, #6366F1 100%); color: #fff; font-weight: 800; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Sürücüyü Kaydet</button>
          </div>
    <!-- MODAL 8: YENİ ARAÇ BAKIM, ARIZA & SERVİS KAYDI MODALI -->
    <div id="modal-maintenance-form" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #38BDF8; border-radius: 16px; width: 100%; max-width: 650px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 60px rgba(56, 189, 248, 0.3); box-sizing: border-box; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #38BDF8; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🛠️</span> YENİ BAKIM & SERVİS MALİYETİ KAYDI
          </h2>
          <button id="modal-close-maint" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-maint" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 4px; max-height: calc(90vh - 90px);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Araç Plakası *</label>
              <input type="text" id="maint-plate" list="vehicle-plates-list" placeholder="Örn: 34 BUG 772" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 900; text-transform: uppercase; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">İşlem / Servis Türü *</label>
              <select id="maint-type" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;">
                <option value="PERIODIC_MAINTENANCE">Periyodik Yağ & Filtre Bakımı</option>
                <option value="REPAIR">Arıza Onarımı & Mekanik Tamir</option>
                <option value="BRAKE_SERVICE">Fren & Balata Değişimi</option>
                <option value="TIRE_CHANGE">Lastik Değişimi & Balans</option>
                <option value="OTHER">Diğer Servis İşlemi</option>
              </select>
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Bakım / Servis Tarihi *</label>
              <input type="date" id="maint-date" value="${new Date().toISOString().split('T')[0]}" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Bakıma Gittiği KM *</label>
              <input type="number" id="maint-km" placeholder="Örn: 105387" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 800; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Servis / Tamirci Adı</label>
              <input type="text" id="maint-company" placeholder="Örn: Ford Yetkili Servisi" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Fatura / Fiş Numarası</label>
              <input type="text" id="maint-invoice" placeholder="Örn: FAT-2026-9812" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-family: monospace; box-sizing: border-box;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Bakım / Onarım Tutarı (TL) *</label>
            <input type="number" id="maint-cost" placeholder="Örn: 4850" required style="width: 100%; padding: 12px; border-radius: 6px; background: rgba(30, 41, 59, 0.9); border: 1px solid #14F195; color: #14F195; font-size: 1.1rem; font-weight: 900; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Bakım Fişi / Fatura Fotoğrafı veya Belge</label>
            <input type="file" id="maint-receipt-file" accept="image/*,.pdf" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #94a3b8; font-size: 0.8rem; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Yapılan İşlemler & Değişen Parçalar *</label>
            <textarea id="maint-desc" rows="3" placeholder="Örn: Motor yağı (5W30), Yağ filtresi, Hava filtresi, Polen filtresi değişti. Ön fren balataları yenilendi." required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 600; box-sizing: border-box; resize: vertical;"></textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <button type="button" id="btn-cancel-maint" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #00F2FE 0%, #4FACFE 100%); color: #000; font-weight: 900; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Servis Kaydını İşle</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 9: YAZ / KIŞ LASTİĞİ DEĞİŞİMİ MODALI -->
    <div id="modal-tire-form" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #A855F7; border-radius: 16px; width: 100%; max-width: 580px; max-height: 85vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 60px rgba(168, 85, 247, 0.3); box-sizing: border-box; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #C084FC; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>🛞</span> YAZ / KIŞ LASTİK DEĞİŞİM KAYDI
          </h2>
          <button id="modal-close-tire" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-tire" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 4px;">
          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Araç Plakası *</label>
            <input type="text" id="tire-plate" list="vehicle-plates-list" placeholder="Örn: 34 BUG 772" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 900; text-transform: uppercase; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Araca Yeni Takılan Lastik Sezonu *</label>
            <select id="tire-season-select" style="width: 100%; padding: 12px; border-radius: 6px; background: rgba(30, 41, 59, 0.9); border: 1px solid #A855F7; color: #E9D5FF; font-weight: 900; font-size: 1rem; box-sizing: border-box;">
              <option value="SUMMER">☀️ YAZ LASTİĞİ TAKILDI (1 Nisan - 1 Aralık Dönemi)</option>
              <option value="WINTER">❄️ KIŞ LASTİĞİ TAKILDI (1 Aralık - 1 Nisan Zorunlu Dönemi)</option>
            </select>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Lastik Değiştirilen KM *</label>
              <input type="number" id="tire-km" placeholder="Örn: 105387" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 800; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Değişim Tarihi *</label>
              <input type="date" id="tire-date" value="${new Date().toISOString().split('T')[0]}" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Sökülen Lastiğin Saklandığı Depo/Raf</label>
              <input type="text" id="tire-storage" placeholder="Örn: Anemon Depo A-04" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Değişim & Balans Maliyeti (TL)</label>
              <input type="number" id="tire-cost" placeholder="Örn: 800" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #14F195; font-weight: 800; box-sizing: border-box;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Lastik Marka / Ebat & Değişim Notu</label>
            <input type="text" id="tire-notes" placeholder="Örn: 4 Adet Lassa Greenways 205/55 R16 Takıldı. Kış lastikleri depoya kaldırıldı." style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 600; box-sizing: border-box;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <button type="button" id="btn-cancel-tire" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #A855F7 0%, #6366F1 100%); color: #fff; font-weight: 900; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Lastik Değişimini Kaydet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- MODAL 10: YENİ TRAFİK CEZASI EKLEME MODALI -->
    <div id="modal-fine-add-form" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); z-index: 99999; justify-content: center; align-items: center; padding: 20px; box-sizing: border-box;">
      <div style="background: #0f172a; border: 1px solid #F59E0B; border-radius: 16px; width: 100%; max-width: 620px; max-height: 90vh; display: flex; flex-direction: column; padding: 24px; box-shadow: 0 20px 60px rgba(245, 158, 11, 0.3); box-sizing: border-box; margin: auto;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 12px; flex-shrink: 0;">
          <h2 style="font-size: 1.3rem; font-weight: 900; color: #F59E0B; margin: 0; display: flex; align-items: center; gap: 8px;">
            <span>📑</span> YENİ TRAFİK CEZASI KAYDI
          </h2>
          <button id="modal-close-fine-add" style="background: none; border: none; color: #94a3b8; font-size: 1.5rem; cursor: pointer;">&times;</button>
        </div>

        <form id="form-save-fine-add" style="display: flex; flex-direction: column; gap: 14px; overflow-y: auto; padding-right: 4px; max-height: calc(90vh - 90px);">
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Trafik Cezası Yazılan Araç Plakası *</label>
              <input type="text" id="fine-add-plate" list="vehicle-plates-list" placeholder="Örn: 34 BUG 772" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 900; text-transform: uppercase; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ceza Tarihi *</label>
              <input type="date" id="fine-add-date" value="${new Date().toISOString().split('T')[0]}" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ceza Kodu / İhlal Açıklaması *</label>
            <input type="text" id="fine-add-code" list="fine-code-suggestions" placeholder="Örn: 51/2-a (Yerleşim Yeri Hız İhlali %10-%30)" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(245, 158, 11, 0.4); color: #fff; font-weight: 700; box-sizing: border-box;" />
            <datalist id="fine-code-suggestions">
              <option value="51/2-a (Hız İhlali - Hız Sınırını %10-%30 Aşmak)"></option>
              <option value="51/2-b (Hız İhlali - Hız Sınırını %30-%50 Aşmak)"></option>
              <option value="47/1-c (Kırmızı Işık Kurallarına Uymamak)"></option>
              <option value="73/c (Seyir Halinde Cep Telefonu Kullanmak)"></option>
              <option value="61/1-n (Yasak Yerlere Park Etmek)"></option>
              <option value="46/2-c (Şerit İhlali / Hatalı Sollama)"></option>
              <option value="34/a (Muayenesi Yapılmamış Araçla Trafiğe Çıkmak)"></option>
              <option value="91 (Zorunlu Trafik Sigortası Yaptırmamak)"></option>
            </datalist>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Cezayı Yiyen Sürücü / Personel *</label>
              <input type="text" id="fine-add-driver" placeholder="Personel Adı Soyadı Giriniz" required style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>

            <div>
              <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ekip / Bölge</label>
              <input type="text" id="fine-add-team" placeholder="Örn: Team03" value="${userTeam || 'Team03'}" style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; font-weight: 700; box-sizing: border-box;" />
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ceza Tutarı (TL) *</label>
            <input type="number" id="fine-add-amount" placeholder="Örn: 1506" required style="width: 100%; padding: 12px; border-radius: 6px; background: rgba(30, 41, 59, 0.9); border: 1px solid #F59E0B; color: #FBBF24; font-size: 1.1rem; font-weight: 900; box-sizing: border-box;" />
          </div>

          <div id="fine-discount-info-box" style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); border-radius: 8px; padding: 10px; display: none;">
            <div style="font-size: 0.8rem; font-weight: 800; color: #10B981; margin-bottom: 2px;">💡 %25 ERKEN ÖDEME İNDİRİMİ HESAPLANDI</div>
            <div style="font-size: 0.85rem; font-weight: 900; color: #F8FAFC;">
              İndirimli Tutar: <span id="fine-discounted-val" style="color: #34D399;">0 ₺</span>
            </div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">
              ⏳ 15 Günlük Erken Ödeme İndirimi Son Günü: <span id="fine-discount-deadline-val" style="color: #FBBF24; font-weight: 800;">-</span>
            </div>
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Ceza Tutanağı / Belge Görseli (İsteğe Bağlı)</label>
            <input type="file" id="fine-add-file" accept="image/*,.pdf" style="width: 100%; padding: 8px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #94a3b8; font-size: 0.8rem; box-sizing: border-box;" />
          </div>

          <div>
            <label style="display: block; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Açıklama / Radar Yeri Notu</label>
            <input type="text" id="fine-add-notes" placeholder="Örn: Çanakkale-İntepe yolu 42. km radar kontrolü." style="width: 100%; padding: 10px; border-radius: 6px; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.2); color: #fff; box-sizing: border-box;" />
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
            <button type="button" id="btn-cancel-fine-add" style="background: rgba(255,255,255,0.1); color: #fff; border: none; padding: 10px 18px; border-radius: 6px; cursor: pointer; font-weight: 700;">İptal</button>
            <button type="submit" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #000; font-weight: 900; border: none; padding: 10px 22px; border-radius: 6px; cursor: pointer;">💾 Cezayı Kaydet & İndirim Sayacını Başlat</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

export function initVehicleManagementEvents(): void {
  // Move all modals directly to document.body so position:fixed covers 100% of viewport (100vw x 100vh) without clipping or scoping to sub-containers
  ['modal-vehicle-form', 'modal-inspection-form', 'modal-vehicle-detail', 'modal-damage-form', 'modal-fine-pay-form', 'modal-fine-history', 'modal-driver-form', 'modal-maintenance-form', 'modal-tire-form', 'modal-fine-add-form'].forEach(id => {
    const existingInBody = document.body.querySelector(`:scope > #${id}`);
    if (existingInBody) {
      existingInBody.remove();
    }
    const modalEl = document.getElementById(id);
    if (modalEl && modalEl.parentElement !== document.body) {
      document.body.appendChild(modalEl);
    }
  });

  // Register global window event listeners ONLY ONCE to prevent listener accumulation and freezing on save
  if (!(window as any)._dh_vehicle_global_listeners_attached) {
    (window as any)._dh_vehicle_global_listeners_attached = true;

    window.addEventListener('dh_vehicle_data_changed', () => {
      if (typeof (window as any)._dh_refresh_vehicle_page === 'function') {
        (window as any)._dh_refresh_vehicle_page();
      }
    });

    window.addEventListener('storage', (e) => {
      if (e.key && e.key.startsWith('dh_servis_')) {
        if (typeof (window as any)._dh_refresh_vehicle_page === 'function') {
          (window as any)._dh_refresh_vehicle_page();
        }
      }
    });
  }

  // Smart Clipboard Paste Listener for all modal inputs (Cleans Excel/PDF newlines & tab breaks)
  document.querySelectorAll('input, textarea').forEach(input => {
    input.addEventListener('paste', (e: Event) => {
      const clipboardEvent = e as ClipboardEvent;
      const clipboardData = clipboardEvent.clipboardData || (window as any).clipboardData;
      if (clipboardData) {
        const pastedText = clipboardData.getData('text');
        if (pastedText) {
          const cleaned = pastedText.replace(/[\r\n\t]+/g, ' ').trim();
          const target = e.target as HTMLInputElement | HTMLTextAreaElement;
          if (target && ('selectionStart' in target) && typeof target.selectionStart === 'number') {
            e.preventDefault();
            const start = target.selectionStart || 0;
            const end = target.selectionEnd || 0;
            const val = target.value;
            target.value = val.slice(0, start) + cleaned + val.slice(end);
            target.selectionStart = target.selectionEnd = start + cleaned.length;
            target.dispatchEvent(new Event('input', { bubbles: true }));
          }
        }
      }
    });
  });

  // Tab switching logic
  const tabBtns = document.querySelectorAll('.veh-tab-btn');
  const switchTab = (targetTab: string) => {
    activeTabId = targetTab;
    tabBtns.forEach(b => {
      const isTarget = (b as HTMLElement).getAttribute('data-tab') === targetTab;
      (b as HTMLElement).style.background = isTarget ? 'rgba(0, 242, 254, 0.15)' : 'rgba(255, 255, 255, 0.05)';
      (b as HTMLElement).style.borderColor = isTarget ? '#00F2FE' : 'rgba(255, 255, 255, 0.1)';
      (b as HTMLElement).style.color = isTarget ? '#00F2FE' : '#94a3b8';
    });

    document.querySelectorAll('.veh-tab-content').forEach(c => {
      (c as HTMLElement).style.display = 'none';
    });

    const el = document.getElementById(targetTab);
    if (el) el.style.display = 'block';
  };

  // Restore current active tab
  switchTab(activeTabId);

  tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetTab = (e.currentTarget as HTMLElement).getAttribute('data-tab');
      if (targetTab) switchTab(targetTab);
    });
  });

  // KPI Stat Cards Clickability
  document.querySelectorAll('.kpi-card-clickable').forEach(card => {
    card.addEventListener('click', (e) => {
      const target = (e.currentTarget as HTMLElement).getAttribute('data-tab-target');
      if (target) switchTab(target);
    });
  });

  // Alert Cards Clickability
  document.querySelectorAll('.alert-card-clickable').forEach(card => {
    card.addEventListener('click', (e) => {
      const type = (e.currentTarget as HTMLElement).getAttribute('data-type');
      const vehId = (e.currentTarget as HTMLElement).getAttribute('data-veh-id');

      if (type === 'DRIVER_CHECK_3M') {
        switchTab('tab-drivers');
      } else if (type === 'TRAFFIC_INSURANCE' || type === 'INSPECTION') {
        switchTab('tab-vehicles');
        if (vehId) openVehicleDetailModal(vehId);
      }
    });
  });

  const getAppContainer = () => {
    return document.getElementById('page-inner-content') ||
           document.getElementById('page-content') ||
           document.getElementById('main-content') ||
           document.querySelector('.vehicle-management-container')?.parentElement;
  };

  let isRefreshPending = false;
  const refreshPage = () => {
    if (isRefreshPending) return;
    isRefreshPending = true;
    requestAnimationFrame(() => {
      isRefreshPending = false;
      const container = getAppContainer();
      const userProfile = (window as any).appState?.userProfile;
      if (container) {
        container.innerHTML = renderVehicleManagement(userProfile);
        initVehicleManagementEvents();
      } else if (typeof (window as any).render === 'function') {
        (window as any).render();
      }
    });
  };

  (window as any)._dh_refresh_vehicle_page = refreshPage;

  // Live Search & Filter Events
  const searchInput = document.getElementById('filter-search-veh') as HTMLInputElement;
  const teamSelect = document.getElementById('filter-team-veh') as HTMLSelectElement;
  const statusSelect = document.getElementById('filter-status-veh') as HTMLSelectElement;

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      activeFilterState.searchQuery = (e.target as HTMLInputElement).value;
      refreshPage();
    });
  }

  if (teamSelect) {
    teamSelect.addEventListener('change', (e) => {
      activeFilterState.selectedTeam = (e.target as HTMLSelectElement).value;
      refreshPage();
    });
  }

  if (statusSelect) {
    statusSelect.addEventListener('change', (e) => {
      activeFilterState.selectedStatus = (e.target as HTMLSelectElement).value;
      refreshPage();
    });
  }

  // Export Fleet to Excel
  const btnExportExcel = document.getElementById('btn-export-excel');
  if (btnExportExcel) {
    btnExportExcel.addEventListener('click', () => {
      const vehicles = vehicleService.getVehicles();
      const exportData = vehicles.map(v => ({
        'Araç Plakası': v.plate,
        'Marka & Model': v.brandModel,
        'Ruhsat Sahibi Firma': v.company || 'Demirer Kablo / Enerji',
        'Model Yılı': v.year || '-',
        'Şasi Numarası (VIN)': v.vin || '-',
        'Zimmetli Ekip': v.assignedTeamName || 'Atanmadı',
        'Sürücü': v.assignedDriverName || '-',
        'Saha / Santral': v.siteName,
        'Mevcut KM': v.currentKm,
        'TÜVTÜRK Muayene Bitiş': v.inspectionDueDate,
        'Trafik Sigortası Bitiş': v.trafficInsuranceDueDate,
        'Kasko Bitiş': v.kaskoDueDate,
        'Lastik Sezonu': v.tireSeason === 'WINTER' ? 'Kış Lastiği' : 'Yaz Lastiği',
        'Durum': v.status === 'INSPECTION_EXPIRED' ? 'Muayene Geçti' : 'Faal'
      }));

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Filo_Listesi');
      XLSX.writeFile(workbook, `DH_Servis_Filo_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
    });
  }

  // Open Vehicle Detail Modal Function
  const openVehicleDetailModal = (vehicleId: string) => {
    const vehicles = vehicleService.getVehicles();
    const v = vehicles.find(item => item.id === vehicleId || item.plate === vehicleId);
    if (!v) return;

    const modalDetail = document.getElementById('modal-vehicle-detail');
    const titleEl = document.getElementById('detail-plate');
    const subEl = document.getElementById('detail-sub');
    const bodyEl = document.getElementById('detail-body-content');

    if (titleEl) titleEl.innerText = v.plate;
    if (subEl) subEl.innerText = `${v.brandModel} (${v.year || 2023}) - ${v.siteName}`;

    const normPlate = v.plate.replace(/\s+/g, '').toUpperCase();
    const vehicleInspections = vehicleService.getInspectionReports().filter(i => i.vehicleId === v.id || i.plate.replace(/\s+/g, '').toUpperCase() === normPlate);
    const vehicleFines = vehicleService.getTrafficFines().filter(f => f.vehicleId === v.id || f.plate.replace(/\s+/g, '').toUpperCase() === normPlate);
    const vehicleMaintenance = vehicleService.getMaintenanceRecords().filter(m => m.vehicleId === v.id || m.plate.replace(/\s+/g, '').toUpperCase() === normPlate);
    const vehicleDamages = vehicleService.getDamageReports().filter(d => d.vehicleId === v.id || d.plate.replace(/\s+/g, '').toUpperCase() === normPlate);

    if (bodyEl) {
      bodyEl.innerHTML = `
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: rgba(30, 41, 59, 0.6); padding: 16px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.1);">
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">RUHSAT SAHİBİ FİRMA</div>
            <div style="font-weight: 800; color: #F59E0B; font-size: 0.95rem;">${v.company || 'Demirer Kablo / Enerji'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">AİT OLDUĞU SANTRAL / SAHA</div>
            <div style="font-weight: 800; color: #00F2FE; font-size: 0.95rem;">${v.siteName}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">ŞASİ NUMARASI (VIN)</div>
            <div style="font-family: monospace; font-weight: 800; color: #A855F7; font-size: 0.95rem;">${v.vin || 'Belirtilmedi'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">ZİMMETLİ EKİP & SÜRÜCÜ</div>
            <div style="font-weight: 800; color: #38BDF8;">${v.assignedTeamName || 'Ekip Atanmadı'} - ${v.assignedDriverName || '-'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">TÜVTÜRK MUAYENE BİTİŞ</div>
            <div style="font-weight: 800; color: ${v.inspectionDueDate ? '#14F195' : '#EF4444'};">${v.inspectionDueDate || '⚠️ Muayene Tarihi Giriniz'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">TRAFİK SİGORTASI BİTİŞ</div>
            <div style="font-weight: 800; color: #FBBF24;">${v.trafficInsuranceDueDate || '-'}</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">MEVCUT KM</div>
            <div style="font-weight: 800; color: #00F2FE;">${v.currentKm ? v.currentKm.toLocaleString('tr-TR') : '0'} KM</div>
          </div>
          <div>
            <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700;">LASTİK SEZONU & DEPO LOKASYONU</div>
            <div style="font-weight: 800; color: ${v.tireSeason === 'WINTER' ? '#60A5FA' : '#F59E0B'};">${v.tireSeason === 'WINTER' ? '❄️ Kış Lastiği' : '☀️ Yaz Lastiği'} (${v.tireStorageLocation || 'Depo A'})</div>
          </div>
        </div>

        <!-- PERİYODİK BAKIM, SERVİS & ONARIM GEÇMİŞİ -->
        <div style="background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.3);">
          <div style="font-size: 0.9rem; font-weight: 800; color: #38BDF8; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span>🛠️ Periyodik Bakım & Servis Geçmişi (${vehicleMaintenance.length} Kayıt)</span>
            <span style="font-size: 0.78rem; color: #cbd5e1; font-weight: 700;">
              Toplam Tutar: ${vehicleMaintenance.reduce((sum, m) => sum + (m.costAmount || 0), 0).toLocaleString('tr-TR')} ₺
            </span>
          </div>
          ${vehicleMaintenance.length > 0 ? vehicleMaintenance.map(m => `
            <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-weight: 800; color: #38BDF8;">${m.serviceDate}</span>
                  <span style="font-weight: 700; color: #F8FAFC; margin-left: 8px;">${m.serviceTypeLabel || m.serviceType}</span>
                  <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 6px;">(${m.serviceNameCompany || 'Servis'})</span>
                </div>
                <div style="font-weight: 900; color: #14F195;">
                  ${(m.costAmount || 0).toLocaleString('tr-TR')} ₺ <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">(${m.serviceKm.toLocaleString('tr-TR')} KM)</span>
                </div>
              </div>
              <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 4px;">
                ⚙️ Değişen Parça / İşlem: ${m.descriptionNotes || 'İşlem notu yok.'}
              </div>
            </div>
          `).join('') : '<div style="font-size: 0.8rem; color: #64748b;">Bu araç için kayıtlı servis/bakım geçmişi yok.</div>'}
        </div>

        <!-- KAZA & HASAR BİLDİRİM GEÇMİŞİ -->
        <div style="background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 10px; border: 1px solid rgba(239, 68, 68, 0.3);">
          <div style="font-size: 0.9rem; font-weight: 800; color: #EF4444; margin-bottom: 8px;">
            💥 Kaza, Hasar & Onarım Bildirim Geçmişi (${vehicleDamages.length} Hasar Kaydı)
          </div>
          ${vehicleDamages.length > 0 ? vehicleDamages.map(d => `
            <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                  <span style="font-weight: 800; color: #EF4444;">${d.reportDate}</span>
                  <span style="font-weight: 800; color: #F8FAFC; margin-left: 8px;">
                    ${d.damageType === 'ACCIDENT' ? '💥 Trafik Kazası' : (d.damageType === 'SCRATCH' ? '🎨 Çizik / Sürtme' : (d.damageType === 'MECHANICAL_FAULT' ? '⚙️ Mekanik Arıza' : '⚠️ Diğer Hasar'))}
                  </span>
                  <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 6px;">(Bildiren: ${d.reportedBy || 'Belirtilmedi'})</span>
                </div>
                <span style="font-size: 0.72rem; padding: 2px 8px; border-radius: 10px; font-weight: 800; background: ${d.status === 'RESOLVED' ? 'rgba(20, 241, 149, 0.2)' : 'rgba(239, 68, 68, 0.2)'}; color: ${d.status === 'RESOLVED' ? '#14F195' : '#FCA5A5'};">
                  ${d.status === 'RESOLVED' ? '✅ Onarıldı / Kapatıldı' : (d.status === 'IN_REPAIR' ? '🛠️ Tamirde' : '🚨 Açık Hasar')}
                </span>
              </div>
              <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 4px;">
                📝 ${d.description || 'Hasar açıklaması yok.'}
              </div>
              ${d.insuranceClaimNo || d.otherPartyPlate ? `
                <div style="font-size: 0.75rem; color: #38BDF8; margin-top: 3px;">
                  ${d.insuranceClaimNo ? `📄 Kasko/Sigorta Dosya No: <strong>${d.insuranceClaimNo}</strong>` : ''}
                  ${d.otherPartyPlate ? ` | 🚗 Karşı Taraf Plaka: <strong>${d.otherPartyPlate}</strong>` : ''}
                </div>
              ` : ''}
            </div>
          `).join('') : '<div style="font-size: 0.8rem; color: #64748b;">Bu araç için kayıtlı kaza veya hasar bildirimi yok.</div>'}
        </div>

        <!-- PERİYODİK DENETİM GEÇMİŞİ -->
        <div style="background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 10px; border: 1px solid rgba(20, 241, 149, 0.3);">
          <div style="font-size: 0.9rem; font-weight: 800; color: #14F195; margin-bottom: 8px;">
            📸 5 Açılı Fotoğraflı Periyodik Denetim Geçmişi (${vehicleInspections.length} Rapor)
          </div>
          ${vehicleInspections.length > 0 ? vehicleInspections.map(i => `
            <div style="padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
              <div style="display: flex; justify-content: space-between;">
                <span style="font-weight: 700; color: #F8FAFC;">Tarih: ${i.inspectionDate} (${i.inspectedBy})</span>
                <span style="color: #14F195; font-weight: 800;">${i.km.toLocaleString('tr-TR')} KM</span>
              </div>
              <div style="color: #cbd5e1; font-size: 0.8rem; margin-top: 4px;">${i.notes || 'Açıklama girilmedi.'}</div>
            </div>
          `).join('') : '<div style="font-size: 0.8rem; color: #64748b;">Bu araç için henüz periyodik denetim yapılmadı.</div>'}
        </div>

        <!-- TRAFİK CEZASI GEÇMİŞİ -->
        <div style="background: rgba(30, 41, 59, 0.4); padding: 14px; border-radius: 10px; border: 1px solid rgba(245, 158, 11, 0.3);">
          <div style="font-size: 0.9rem; font-weight: 800; color: #F59E0B; margin-bottom: 8px;">
            📑 Yazılan Trafik Cezaları (${vehicleFines.length} Ceza)
          </div>
          ${vehicleFines.length > 0 ? vehicleFines.map(f => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.05); font-size: 0.85rem;">
              <div>
                <span style="font-weight: 700; color: #F8FAFC;">${f.fineCode}</span>
                <span style="font-size: 0.75rem; color: #94a3b8; margin-left: 6px;">(${f.driverName})</span>
              </div>
              <div style="font-weight: 800; color: #EF4444;">${f.amount.toLocaleString('tr-TR')} ₺</div>
            </div>
          `).join('') : '<div style="font-size: 0.8rem; color: #64748b;">Bu araç için ceza kaydı yok.</div>'}
        </div>
      `;
    }

    if (modalDetail) modalDetail.style.display = 'flex';
  };

  // Clickable Vehicle Rows
  document.querySelectorAll('.veh-row-clickable').forEach(row => {
    row.addEventListener('click', (e) => {
      const vehId = (e.currentTarget as HTMLElement).getAttribute('data-veh-id');
      if (vehId) openVehicleDetailModal(vehId);
    });
  });

  // Action inspect buttons
  document.querySelectorAll('.btn-inspect-row').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const vehId = (e.currentTarget as HTMLElement).getAttribute('data-veh-id');
      if (vehId) openVehicleDetailModal(vehId);
    });
  });

  const modalDetail = document.getElementById('modal-vehicle-detail');
  const btnCloseDetail = document.getElementById('modal-close-detail');
  const btnCloseDetailFooter = document.getElementById('btn-close-detail-footer');

  const hideDetailModal = () => {
    if (modalDetail) modalDetail.style.display = 'none';
  };

  if (btnCloseDetail) btnCloseDetail.addEventListener('click', hideDetailModal);
  if (btnCloseDetailFooter) btnCloseDetailFooter.addEventListener('click', hideDetailModal);

  // Open Vehicle Fine History Modal Function
  const openFineHistoryModal = (plate: string) => {
    const fines = vehicleService.getTrafficFines().filter(f => f.plate.trim().toUpperCase() === plate.trim().toUpperCase());
    const modalHist = document.getElementById('modal-fine-history');
    const plateEl = document.getElementById('fine-hist-plate');
    const subEl = document.getElementById('fine-hist-sub');
    const bodyEl = document.getElementById('fine-hist-body');

    if (plateEl) plateEl.innerText = plate.toUpperCase();
    if (subEl) subEl.innerText = `Bu araca ait toplam ${fines.length} ceza kaydı bulunmaktadır.`;

    if (bodyEl) {
      if (fines.length > 0) {
        const totalCount = fines.length;
        bodyEl.innerHTML = fines.map((f, i) => {
          const seqIndex = totalCount - i;
          const seqTag = seqIndex === totalCount ? (totalCount === 1 ? '1. Ceza' : `${seqIndex}. Ceza (En Son)`) : (seqIndex === 1 ? '1. Ceza (İlk)' : `${seqIndex}. Ceza`);
          return `
          <div style="background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
              <div style="font-weight: 800; color: #A855F7; font-size: 0.9rem;">
                #${seqTag} - ${f.fineCode}
              </div>
              <div style="font-weight: 900; color: #EF4444; font-size: 0.9rem;">
                ${f.amount.toLocaleString('tr-TR')} ₺
              </div>
            </div>
            <div style="font-size: 0.8rem; color: #cbd5e1; display: flex; justify-content: space-between;">
              <span>Sürücü / Ekip: <strong style="color: #38BDF8;">${f.driverName || 'Belirtilmedi'} (${f.team || '-'})</strong></span>
              <span>Tarih: ${f.fineDate}</span>
            </div>
            <div style="margin-top: 6px; font-size: 0.78rem;">
              ${f.status === 'PAID' ? `
                <span style="color: #14F195; font-weight: 800; background: rgba(20, 241, 149, 0.15); padding: 2px 8px; border-radius: 4px;">
                  ✅ ${f.paidBy === 'PERSONNEL' ? `ÖDENDİ (👤 Personel: ${f.paidByName || f.driverName})` : 'ÖDENDİ (🏢 Şirket)'} — ${f.paidAmount?.toLocaleString('tr-TR')} ₺
                </span>
              ` : `
                <span style="color: #F59E0B; font-weight: 800; background: rgba(245, 158, 11, 0.15); padding: 2px 8px; border-radius: 4px;">
                  ⏳ ÖDEME BEKLİYOR (%25 İndirimli: ${(f.amount * 0.75).toLocaleString('tr-TR')} ₺)
                </span>
              `}
            </div>
          </div>
        `;
        }).join('');
      } else {
        bodyEl.innerHTML = `<div style="color: #64748b; font-size: 0.85rem; padding: 10px;">Bu araç için henüz kayıtlı ceza bulunmuyor.</div>`;
      }
    }

    if (modalHist) modalHist.style.display = 'flex';
  };

  document.querySelectorAll('.btn-view-fine-history').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const plate = (e.currentTarget as HTMLElement).getAttribute('data-plate');
      if (plate) openFineHistoryModal(plate);
    });
  });

  const modalHist = document.getElementById('modal-fine-history');
  const btnCloseHist = document.getElementById('modal-close-fine-hist');
  const btnCloseHistFooter = document.getElementById('btn-close-fine-hist-footer');
  const hideHistModal = () => { if (modalHist) modalHist.style.display = 'none'; };
  if (btnCloseHist) btnCloseHist.addEventListener('click', hideHistModal);
  if (btnCloseHistFooter) btnCloseHistFooter.addEventListener('click', hideHistModal);

  // Pay Fine Action Modal Controls
  const modalPay = document.getElementById('modal-fine-pay-form');
  const btnClosePay = document.getElementById('modal-close-pay');
  const btnCancelPay = document.getElementById('btn-cancel-pay');
  const formPay = document.getElementById('form-pay-fine') as HTMLFormElement;

  const hidePayModal = () => { if (modalPay) modalPay.style.display = 'none'; };
  if (btnClosePay) btnClosePay.addEventListener('click', hidePayModal);
  if (btnCancelPay) btnCancelPay.addEventListener('click', hidePayModal);

  document.querySelectorAll('.btn-pay-fine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const plate = (e.currentTarget as HTMLElement).getAttribute('data-plate');
      const code = (e.currentTarget as HTMLElement).getAttribute('data-code');
      const amount = Number((e.currentTarget as HTMLElement).getAttribute('data-amount'));
      const discAmount = Number((e.currentTarget as HTMLElement).getAttribute('data-disc-amount'));
      const driver = (e.currentTarget as HTMLElement).getAttribute('data-driver');

      if (id && modalPay) {
        (document.getElementById('pay-fine-id') as HTMLInputElement).value = id;
        const infoEl = document.getElementById('pay-fine-info');
        const subEl = document.getElementById('pay-fine-sub');
        const discLabel = document.getElementById('pay-disc-amount-label');
        const fullLabel = document.getElementById('pay-full-amount-label');

        if (infoEl) infoEl.innerText = `${plate} - ${code}`;
        if (subEl) subEl.innerText = `Sürücü: ${driver || 'Saha Sürücüsü'}`;
        if (discLabel) discLabel.innerText = `${discAmount.toLocaleString('tr-TR')} ₺`;
        if (fullLabel) fullLabel.innerText = `${amount.toLocaleString('tr-TR')} ₺`;

        modalPay.style.display = 'flex';
      }
    });
  });

  // Toggle Payer Radio Buttons (Şirket vs Personel)
  const payByRadios = document.querySelectorAll('input[name="pay-by-radio"]');
  const personnelNameGroup = document.getElementById('pay-personnel-name-group');
  payByRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      const val = (e.target as HTMLInputElement).value;
      if (personnelNameGroup) {
        personnelNameGroup.style.display = val === 'PERSONNEL' ? 'block' : 'none';
      }
    });
  });

  if (formPay) {
    formPay.addEventListener('submit', (e) => {
      e.preventDefault();
      const fineId = (document.getElementById('pay-fine-id') as HTMLInputElement).value;
      const paidBy = (document.querySelector('input[name="pay-by-radio"]:checked') as HTMLInputElement).value as 'COMPANY' | 'PERSONNEL';
      const amountType = (document.querySelector('input[name="pay-amount-radio"]:checked') as HTMLInputElement).value;
      const personnelName = (document.getElementById('pay-personnel-name') as HTMLInputElement).value;

      const fine = vehicleService.getTrafficFines().find(f => f.id === fineId);
      if (fineId && fine) {
        const actualAmount = amountType === 'DISCOUNT' ? fine.amount * 0.75 : fine.amount;
        vehicleService.payTrafficFine(fineId, paidBy, actualAmount, paidBy === 'PERSONNEL' ? personnelName : undefined);
        hidePayModal();
        activeTabId = 'tab-fines';
        refreshPage();
      }
    });
  }

  // Delete Actions
  document.querySelectorAll('.btn-delete-veh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' aracını silmek istediğinize emin misiniz?`)) {
        activeTabId = 'tab-vehicles';
        vehicleService.deleteVehicle(id);
        refreshPage();
      }
    });
  });

  document.querySelectorAll('.btn-delete-insp').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' silinsin mi?`)) {
        activeTabId = 'tab-inspections';
        vehicleService.deleteInspectionReport(id);
        refreshPage();
      }
    });
  });

  document.querySelectorAll('.btn-delete-driver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' sürücü kaydını silmek istediğinize emin misiniz?`)) {
        activeTabId = 'tab-drivers';
        vehicleService.deleteDriverLicense(id);
        refreshPage();
      }
    });
  });

  document.querySelectorAll('.btn-delete-fine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' ceza kaydını silmek istediğinize emin misiniz?`)) {
        activeTabId = 'tab-fines';
        vehicleService.deleteTrafficFine(id);
        refreshPage();
      }
    });
  });

  document.querySelectorAll('.btn-delete-damage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' silinsin mi?`)) {
        activeTabId = 'tab-damages';
        vehicleService.deleteDamageReport(id);
        refreshPage();
      }
    });
  });

  // Resolve Damage Action
  document.querySelectorAll('.btn-resolve-damage').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const name = (e.currentTarget as HTMLElement).getAttribute('data-name');
      if (id && confirm(`'${name}' hasar kaydı onarıldı / tamir edildi olarak kapatılsın mı?`)) {
        activeTabId = 'tab-damages';
        vehicleService.resolveDamageReport(id, 'Atölye/Servis tarafından onarıldı.');
        refreshPage();
      }
    });
  });

  // 3-Month Driver Verification Action
  document.querySelectorAll('.btn-verify-driver').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const driverId = (e.currentTarget as HTMLElement).getAttribute('data-driver-id');
      const driverName = (e.currentTarget as HTMLElement).getAttribute('data-driver-name');
      
      if (driverId && confirm(`${driverName} için 3 aylık ehliyet ceza/aktiflik beyanını onaylıyor musunuz? (Gelecek kontrol tarihi +90 gün ileri atılacaktır)`)) {
        activeTabId = 'tab-drivers';
        vehicleService.verifyDriver3MonthCheck(driverId, 'Sürücü tarafından 3 aylık ehliyet beyanı doğrulandı.');
        refreshPage();
      }
    });
  });

  // Modal 1: Vehicle Form Modal Controls (Add & Edit)
  const modalVeh = document.getElementById('modal-vehicle-form');
  const btnAddVeh = document.getElementById('btn-add-vehicle');
  const btnCloseVeh = document.getElementById('modal-close-veh');
  const btnCancelVeh = document.getElementById('btn-cancel-veh');
  const formVeh = document.getElementById('form-save-vehicle') as HTMLFormElement;

  document.querySelectorAll('#btn-add-vehicle, .btn-add-vehicle-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (formVeh) {
        formVeh.removeAttribute('data-edit-id');
        formVeh.reset();
        const submitBtn = formVeh.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '💾 Kaydet';
      }
      const titleEl = document.querySelector('#modal-vehicle-form h2');
      if (titleEl) titleEl.innerHTML = '<span>🚗</span> YENİ FİLO ARAÇ KAYDI';
      if (modalVeh) modalVeh.style.display = 'flex';
    });
  });

  // Edit Vehicle Row Event Listener
  document.querySelectorAll('.btn-edit-veh').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id');
      if (!id) return;
      const v = vehicleService.getVehicles().find(x => x.id === id);
      if (!v) return;

      if (formVeh) {
        formVeh.setAttribute('data-edit-id', v.id);
        const submitBtn = formVeh.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '💾 Değişiklikleri Kaydet';
      }

      const titleEl = document.querySelector('#modal-vehicle-form h2');
      if (titleEl) titleEl.innerHTML = `<span>✏️</span> ARAÇ BİLGİLERİNİ DÜZENLE (${v.plate})`;

      (document.getElementById('veh-plate') as HTMLInputElement).value = v.plate || '';
      (document.getElementById('veh-brand') as HTMLInputElement).value = v.brandModel || '';
      (document.getElementById('veh-company') as HTMLInputElement).value = v.company || '';
      (document.getElementById('veh-site') as HTMLInputElement).value = v.siteName || '';
      (document.getElementById('veh-team') as HTMLInputElement).value = v.assignedTeamName || '';
      (document.getElementById('veh-year') as HTMLInputElement).value = String(v.year || 2023);
      (document.getElementById('veh-vin') as HTMLInputElement).value = v.vin || '';
      (document.getElementById('veh-insp-date') as HTMLInputElement).value = v.inspectionDueDate || '';

      if (modalVeh) modalVeh.style.display = 'flex';
    });
  });

  const hideVehModal = () => {
    if (modalVeh) modalVeh.style.display = 'none';
  };

  if (btnCloseVeh) btnCloseVeh.addEventListener('click', hideVehModal);
  if (btnCancelVeh) btnCancelVeh.addEventListener('click', hideVehModal);

  if (formVeh) {
    formVeh.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = formVeh.getAttribute('data-edit-id');
      const plate = (document.getElementById('veh-plate') as HTMLInputElement).value;
      const brand = (document.getElementById('veh-brand') as HTMLInputElement).value;
      const company = (document.getElementById('veh-company') as HTMLInputElement).value;
      const site = (document.getElementById('veh-site') as HTMLInputElement).value;
      const team = (document.getElementById('veh-team') as HTMLInputElement).value;
      const year = Number((document.getElementById('veh-year') as HTMLInputElement).value);
      const vin = (document.getElementById('veh-vin') as HTMLInputElement).value;
      const inspDate = (document.getElementById('veh-insp-date') as HTMLInputElement).value;

      if (plate && brand) {
        const currentUserProfile = (window as any).appState?.userProfile;
        const currentCreator = currentUserProfile?.email || currentUserProfile?.displayName || currentUserProfile?.name || '';

        formVeh.removeAttribute('data-edit-id');
        hideVehModal();

        vehicleService.saveVehicle({
          id: editId || undefined,
          plate: plate.toUpperCase(),
          brandModel: brand,
          company: company || 'Demirer Kablo / Enerji',
          siteName: site || 'Anemon İntepe',
          assignedTeamName: team,
          year: year || 2023,
          vin: vin || '',
          inspectionDueDate: inspDate !== undefined ? inspDate.trim() : '',
          createdBy: currentCreator
        });

        notificationService.notify(
          editId ? 'Araç Bilgileri Güncellendi' : 'Yeni Araç Kaydedildi',
          `${plate.toUpperCase()} araç bilgileri başarıyla ${editId ? 'güncellendi' : 'kaydedildi'}!`,
          'success'
        );
      }
    });
  }

  // Modal 2: Inspection Form Modal Controls
  const modalInsp = document.getElementById('modal-inspection-form');
  const btnDoInsp = document.getElementById('btn-do-inspection');
  const btnCloseInsp = document.getElementById('modal-close-insp');
  const btnCancelInsp = document.getElementById('btn-cancel-insp');
  const formInsp = document.getElementById('form-save-inspection') as HTMLFormElement;

  document.querySelectorAll('#btn-do-inspection, .btn-do-inspection-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (modalInsp) modalInsp.style.display = 'flex';
    });
  });

  const hideInspModal = () => {
    if (modalInsp) modalInsp.style.display = 'none';
  };

  if (btnCloseInsp) btnCloseInsp.addEventListener('click', hideInspModal);
  if (btnCancelInsp) btnCancelInsp.addEventListener('click', hideInspModal);

  if (formInsp) {
    formInsp.addEventListener('submit', (e) => {
      e.preventDefault();
      const vehSelect = document.getElementById('insp-vehicle-id') as HTMLSelectElement;
      const vehicleId = vehSelect.value;
      const selectedOpt = vehSelect.options[vehSelect.selectedIndex];
      const plate = selectedOpt.getAttribute('data-plate') || '34 DH 1923';
      const team = selectedOpt.getAttribute('data-team') || 'Team01';

      const personnel = (document.getElementById('insp-personnel') as HTMLInputElement).value;
      const km = Number((document.getElementById('insp-km') as HTMLInputElement).value);
      const inspDate = (document.getElementById('insp-date') as HTMLInputElement).value;
      const notes = (document.getElementById('insp-notes') as HTMLTextAreaElement).value;

      if (vehicleId && personnel) {
        hideInspModal();
        vehicleService.saveInspectionReport({
          vehicleId,
          plate,
          team,
          inspectedBy: personnel,
          km: km || 0,
          inspectionDate: inspDate,
          notes,
          status: 'PASSED'
        });
        notificationService.notify(
          'Denetim Kaydedildi',
          `${plate} aracı için fotoğraflı periyodik denetim raporu kaydedildi!`,
          'success'
        );
      }
    });
  }

  // Modal 10: Fine Add Form Modal Controls
  const modalFineAdd = document.getElementById('modal-fine-add-form');
  const addFineBtn = document.getElementById('btn-add-fine');
  const btnCloseFineAdd = document.getElementById('modal-close-fine-add');
  const btnCancelFineAdd = document.getElementById('btn-cancel-fine-add');
  const formFineAdd = document.getElementById('form-save-fine-add') as HTMLFormElement;
  const fineAddAmountInput = document.getElementById('fine-add-amount') as HTMLInputElement;
  const fineDiscountBox = document.getElementById('fine-discount-info-box');
  const fineDiscountedVal = document.getElementById('fine-discounted-val');
  const fineDiscountDeadlineVal = document.getElementById('fine-discount-deadline-val');

  const hideFineAddModal = () => {
    if (modalFineAdd) modalFineAdd.style.display = 'none';
  };

  document.querySelectorAll('#btn-add-fine, .btn-add-fine-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (formFineAdd) {
        formFineAdd.reset();
        formFineAdd.removeAttribute('data-edit-id');
      }
      const modalTitle = document.querySelector('#modal-fine-add-form h2');
      if (modalTitle) modalTitle.innerHTML = `<span>📑</span> YENİ TRAFİK CEZASI KAYDI`;
      if (fineDiscountBox) fineDiscountBox.style.display = 'none';
      if (modalFineAdd) modalFineAdd.style.display = 'flex';
    });
  });

  document.querySelectorAll('.btn-edit-fine').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const fineId = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!fineId) return;
      const fines = vehicleService.getTrafficFines();
      const f = fines.find(item => item.id === fineId);
      if (!f) return;

      if (formFineAdd) {
        formFineAdd.setAttribute('data-edit-id', f.id);
        (document.getElementById('fine-add-plate') as HTMLInputElement).value = f.plate;
        (document.getElementById('fine-add-date') as HTMLInputElement).value = f.fineDate;
        (document.getElementById('fine-add-code') as HTMLInputElement).value = f.fineCode;
        (document.getElementById('fine-add-driver') as HTMLInputElement).value = f.driverName || '';
        (document.getElementById('fine-add-team') as HTMLInputElement).value = f.team || 'Team03';
        (document.getElementById('fine-add-amount') as HTMLInputElement).value = f.amount.toString();
        const notesEl = document.getElementById('fine-add-notes') as HTMLInputElement;
        if (notesEl) notesEl.value = f.notes || '';

        if (fineAddAmountInput) {
          fineAddAmountInput.dispatchEvent(new Event('input'));
        }
      }

      const modalTitle = document.querySelector('#modal-fine-add-form h2');
      if (modalTitle) modalTitle.innerHTML = `<span>✏️</span> TRAFİK CEZASI BİLGİLERİNİ DÜZENLE`;

      if (modalFineAdd) modalFineAdd.style.display = 'flex';
    });
  });

  if (btnCloseFineAdd) btnCloseFineAdd.addEventListener('click', hideFineAddModal);
  if (btnCancelFineAdd) btnCancelFineAdd.addEventListener('click', hideFineAddModal);

  if (fineAddAmountInput) {
    fineAddAmountInput.addEventListener('input', () => {
      const amt = Number(fineAddAmountInput.value);
      if (amt > 0) {
        const discounted = amt * 0.75;
        const d = new Date();
        d.setDate(d.getDate() + 15);
        const deadlineStr = d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
        if (fineDiscountedVal) fineDiscountedVal.textContent = `${discounted.toLocaleString('tr-TR')} ₺`;
        if (fineDiscountDeadlineVal) fineDiscountDeadlineVal.textContent = deadlineStr;
        if (fineDiscountBox) fineDiscountBox.style.display = 'block';
      } else {
        if (fineDiscountBox) fineDiscountBox.style.display = 'none';
      }
    });
  }

  if (formFineAdd) {
    formFineAdd.addEventListener('submit', (e) => {
      e.preventDefault();
      const editId = formFineAdd.getAttribute('data-edit-id');
      const plate = (document.getElementById('fine-add-plate') as HTMLInputElement).value.trim();
      const date = (document.getElementById('fine-add-date') as HTMLInputElement).value;
      const code = (document.getElementById('fine-add-code') as HTMLInputElement).value.trim();
      const driver = (document.getElementById('fine-add-driver') as HTMLInputElement).value.trim();
      const team = (document.getElementById('fine-add-team') as HTMLInputElement).value.trim();
      const amount = Number((document.getElementById('fine-add-amount') as HTMLInputElement).value);
      const notes = (document.getElementById('fine-add-notes') as HTMLInputElement).value.trim();

      if (plate && amount > 0) {
        const currentUserProfile = (window as any).appState?.userProfile;
        const currentCreator = currentUserProfile?.email || currentUserProfile?.displayName || currentUserProfile?.name || '';
        formFineAdd.removeAttribute('data-edit-id');
        hideFineAddModal();
        activeTabId = 'tab-fines';

        vehicleService.saveTrafficFine({
          id: editId || undefined,
          plate: plate.toUpperCase(),
          fineDate: date || new Date().toISOString().split('T')[0],
          fineCode: code || 'Trafik Cezası İhlali',
          amount: amount,
          driverName: driver || 'Saha Sürücüsü',
          team: team || 'Team03',
          notes: notes,
          createdBy: currentCreator
        });

        notificationService.notify(
          editId ? 'Trafik Cezası Güncellendi' : 'Trafik Cezası Kaydedildi',
          `${plate.toUpperCase()} aracı için ${amount.toLocaleString('tr-TR')} ₺ tutarındaki trafik cezası ${editId ? 'güncellendi' : 'kaydedildi'}!`,
          'success'
        );
      }
    });
  }

  // Modal 4: Damage Form Modal Controls
  const modalDamage = document.getElementById('modal-damage-form');
  const btnAddDamage = document.getElementById('btn-add-damage');
  const btnCloseDamage = document.getElementById('modal-close-damage');
  const btnCancelDamage = document.getElementById('btn-cancel-damage');
  const formDamage = document.getElementById('form-save-damage') as HTMLFormElement;
  const dmgTypeSelect = document.getElementById('dmg-type') as HTMLSelectElement;
  const accidentSection = document.getElementById('accident-report-section');

  let currentDamagePhotoUrls: string[] = [];
  let currentAccidentReportUrl: string = '';

  const dmgReportFileInput = document.getElementById('dmg-report-file') as HTMLInputElement;
  const dmgReportFileName = document.getElementById('dmg-report-file-name');

  if (dmgReportFileInput) {
    dmgReportFileInput.addEventListener('change', () => {
      if (dmgReportFileInput.files && dmgReportFileInput.files.length > 0) {
        const file = dmgReportFileInput.files[0];
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            currentAccidentReportUrl = e.target.result as string;
            if (dmgReportFileName) {
              dmgReportFileName.textContent = `✅ Yüklendi: ${file.name}`;
              dmgReportFileName.style.display = 'block';
            }
          }
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const renderDmgPhotoPreviews = () => {
    const grid = document.getElementById('dmg-photo-preview-grid');
    if (!grid) return;
    grid.innerHTML = currentDamagePhotoUrls.map((url, idx) => `
      <div style="position: relative; width: 100%; height: 75px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.5); background: #000;">
        <img src="${url}" style="width: 100%; height: 100%; object-fit: cover;" />
        <button type="button" data-del-idx="${idx}" class="btn-del-dmg-photo" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.9); color: #fff; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 0.75rem; font-weight: 900; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 4px rgba(0,0,0,0.5);" title="Sil">&times;</button>
      </div>
    `).join('');

    grid.querySelectorAll('.btn-del-dmg-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const delIdx = Number((btn as HTMLElement).getAttribute('data-del-idx'));
        currentDamagePhotoUrls.splice(delIdx, 1);
        renderDmgPhotoPreviews();
      });
    });
  };

  const btnTriggerDmgPhotos = document.getElementById('btn-trigger-dmg-photos');
  const dmgPhotosInput = document.getElementById('dmg-photos-input') as HTMLInputElement;

  if (btnTriggerDmgPhotos && dmgPhotosInput) {
    btnTriggerDmgPhotos.addEventListener('click', () => {
      dmgPhotosInput.click();
    });

    dmgPhotosInput.addEventListener('change', () => {
      if (!dmgPhotosInput.files || dmgPhotosInput.files.length === 0) return;
      Array.from(dmgPhotosInput.files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            currentDamagePhotoUrls.push(e.target.result as string);
            renderDmgPhotoPreviews();
          }
        };
        reader.readAsDataURL(file);
      });
      dmgPhotosInput.value = '';
    });
  }

  if (dmgTypeSelect && accidentSection) {
    dmgTypeSelect.addEventListener('change', () => {
      accidentSection.style.display = dmgTypeSelect.value === 'ACCIDENT' ? 'block' : 'none';
    });
  }

  document.querySelectorAll('#btn-add-damage, .btn-add-damage-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (formDamage) formDamage.reset();
      currentDamagePhotoUrls = [];
      currentAccidentReportUrl = '';
      if (dmgReportFileName) dmgReportFileName.style.display = 'none';
      renderDmgPhotoPreviews();
      if (modalDamage) modalDamage.style.display = 'flex';
    });
  });

  const hideDamageModal = () => {
    if (modalDamage) modalDamage.style.display = 'none';
  };

  if (btnCloseDamage) btnCloseDamage.addEventListener('click', hideDamageModal);
  if (btnCancelDamage) btnCancelDamage.addEventListener('click', hideDamageModal);

  if (formDamage) {
    formDamage.addEventListener('submit', (e) => {
      e.preventDefault();
      const plate = (document.getElementById('dmg-plate') as HTMLInputElement).value;
      const reporter = (document.getElementById('dmg-reporter') as HTMLInputElement).value;
      const type = (document.getElementById('dmg-type') as HTMLSelectElement).value as any;
      const date = (document.getElementById('dmg-date') as HTMLInputElement).value;
      const desc = (document.getElementById('dmg-desc') as HTMLTextAreaElement).value;
      const otherPlate = (document.getElementById('dmg-other-plate') as HTMLInputElement)?.value;
      const claimNo = (document.getElementById('dmg-claim-no') as HTMLInputElement)?.value;

      if (plate && desc) {
        hideDamageModal();
        activeTabId = 'tab-damages';

        const currentUserProfile = (window as any).appState?.userProfile;
        const currentTeam = currentUserProfile?.team || currentUserProfile?.teamName || 'Team03';
        const currentUserName = currentUserProfile?.displayName || currentUserProfile?.name || currentUserProfile?.email || 'Saha Personeli';

        const targetVeh = vehicleService.getVehicles().find(v => v.plate.trim().toUpperCase() === plate.trim().toUpperCase());
        const vehTeam = targetVeh?.assignedTeamName || targetVeh?.assignedTeamId || currentTeam;

        vehicleService.saveDamageReport({
          plate: plate.toUpperCase(),
          team: vehTeam,
          reportedBy: reporter || currentUserName,
          damageType: type || 'SCRATCH',
          reportDate: date || new Date().toISOString().split('T')[0],
          description: desc,
          otherPartyPlate: otherPlate || '',
          insuranceClaimNo: claimNo || '',
          photoUrls: [...currentDamagePhotoUrls],
          accidentReportPhotoUrl: currentAccidentReportUrl || (type === 'ACCIDENT' ? 'pdf_kaza_tutanagi_exist' : '')
        });
        currentDamagePhotoUrls = [];
        currentAccidentReportUrl = '';
        if (dmgReportFileName) dmgReportFileName.style.display = 'none';
        renderDmgPhotoPreviews();

        notificationService.notify(
          'Hasar Bildirimi Kaydedildi',
          `${plate.toUpperCase()} aracı için sahadan hasar bildirimi başarıyla işlendi!`,
          'success'
        );
      }
    });
  }

  // Modal 7: Driver Form Modal Controls
  const modalDriver = document.getElementById('modal-driver-form');
  const btnCloseDriver = document.getElementById('modal-close-driver');
  const btnCancelDriver = document.getElementById('btn-cancel-driver');
  const formDriver = document.getElementById('form-save-driver') as HTMLFormElement;

  document.querySelectorAll('.btn-add-driver-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (formDriver) {
        formDriver.reset();
        const drvNameInput = document.getElementById('drv-name') as HTMLInputElement;
        if (drvNameInput) drvNameInput.value = '';
      }
      if (modalDriver) modalDriver.style.display = 'flex';
    });
  });

  const hideDriverModal = () => {
    if (modalDriver) modalDriver.style.display = 'none';
  };

  if (btnCloseDriver) btnCloseDriver.addEventListener('click', hideDriverModal);
  if (btnCancelDriver) btnCancelDriver.addEventListener('click', hideDriverModal);

  if (formDriver) {
    formDriver.addEventListener('submit', (e) => {
      e.preventDefault();
      const rawName = (document.getElementById('drv-name') as HTMLInputElement).value.trim();
      const currentUserProfile = (window as any).appState?.userProfile;
      const team = currentUserProfile?.team || currentUserProfile?.teamName || 'Team03';
      const licNo = (document.getElementById('drv-license-no') as HTMLInputElement).value.trim();
      const licClass = (document.getElementById('drv-class') as HTMLInputElement).value.trim();
      const srcDate = (document.getElementById('drv-src-date') as HTMLInputElement).value;
      const psyDate = (document.getElementById('drv-psy-date') as HTMLInputElement).value;

      if (rawName && licNo) {
        hideDriverModal();
        activeTabId = 'tab-drivers';
        vehicleService.saveDriverLicense({
          personnelName: rawName,
          team: team || 'Team03',
          licenseNumber: licNo,
          licenseClass: licClass || 'B',
          srcExpiryDate: srcDate || undefined,
          psychotechnicExpiryDate: psyDate || undefined,
          isLicenseActive: true
        });

        notificationService.notify(
          'Sürücü Belgesi Kaydedildi',
          `${rawName} (${team || 'Team03'}) için sürücü belgesi ve 3 aylık beyan kaydı başarıyla oluşturuldu!`,
          'success'
        );
      }
    });
  }

  // Modal 8: Maintenance Form Modal Controls
  const modalMaint = document.getElementById('modal-maintenance-form');
  const btnCloseMaint = document.getElementById('modal-close-maint');
  const btnCancelMaint = document.getElementById('btn-cancel-maint');
  const formMaint = document.getElementById('form-save-maint') as HTMLFormElement;

  document.querySelectorAll('.btn-add-maint-trigger').forEach(btn => {
    btn.addEventListener('click', () => {
      if (formMaint) formMaint.reset();
      if (modalMaint) modalMaint.style.display = 'flex';
    });
  });

  const hideMaintModal = () => {
    if (modalMaint) modalMaint.style.display = 'none';
  };

  if (btnCloseMaint) btnCloseMaint.addEventListener('click', hideMaintModal);
  if (btnCancelMaint) btnCancelMaint.addEventListener('click', hideMaintModal);

  // View Receipt Button
  document.querySelectorAll('.btn-view-receipt').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = (btn as HTMLElement).getAttribute('data-url');
      if (url) window.open(url, '_blank');
    });
  });

  // Delete Maintenance Record Button
  document.querySelectorAll('.btn-delete-maint').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const id = (btn as HTMLElement).getAttribute('data-id');
      const plate = (btn as HTMLElement).getAttribute('data-plate');
      if (id && confirm(`${plate} aracına ait bakım / servis kaydını silmek istediğinize emin misiniz?`)) {
        vehicleService.deleteMaintenanceRecord(id);
      }
    });
  });

  if (formMaint) {
    formMaint.addEventListener('submit', (e) => {
      e.preventDefault();
      const plate = (document.getElementById('maint-plate') as HTMLInputElement).value.trim();
      const typeSelect = document.getElementById('maint-type') as HTMLSelectElement;
      const type = typeSelect.value as any;
      const typeLabel = typeSelect.options[typeSelect.selectedIndex].text;
      const date = (document.getElementById('maint-date') as HTMLInputElement).value;
      const km = Number((document.getElementById('maint-km') as HTMLInputElement).value);
      const company = (document.getElementById('maint-company') as HTMLInputElement).value.trim();
      const invoice = (document.getElementById('maint-invoice') as HTMLInputElement).value.trim();
      const cost = Number((document.getElementById('maint-cost') as HTMLInputElement).value);
      const desc = (document.getElementById('maint-desc') as HTMLTextAreaElement).value.trim();
      const fileInput = document.getElementById('maint-receipt-file') as HTMLInputElement;

      let photoUrl = '';
      if (fileInput && fileInput.files && fileInput.files.length > 0) {
        photoUrl = URL.createObjectURL(fileInput.files[0]);
      }

      if (plate && km && cost && desc) {
        const currentUserProfile = (window as any).appState?.userProfile;
        const currentCreator = currentUserProfile?.email || currentUserProfile?.displayName || currentUserProfile?.name || '';
        hideMaintModal();
        activeTabId = 'tab-maintenance';

        vehicleService.saveMaintenanceRecord({
          plate: plate.toUpperCase(),
          serviceType: type,
          serviceTypeLabel: typeLabel,
          serviceDate: date || new Date().toISOString().split('T')[0],
          serviceKm: km,
          serviceNameCompany: company || 'Özel/Yetkili Servis',
          invoiceNumber: invoice || '',
          costAmount: cost,
          receiptPhotoUrl: photoUrl,
          descriptionNotes: desc,
          performedBy: currentCreator
        });

        notificationService.notify(
          'Servis & Bakım Kaydedildi',
          `${plate.toUpperCase()} aracı için ${cost.toLocaleString('tr-TR')} ₺ tutarındaki servis & bakım kaydı işlendi!`,
          'success'
        );
      }
    });
  }

  // Modal 9: Tire Change Modal Controls
  const modalTire = document.getElementById('modal-tire-form');
  const btnCloseTire = document.getElementById('modal-close-tire');
  const btnCancelTire = document.getElementById('btn-cancel-tire');
  const formTire = document.getElementById('form-save-tire') as HTMLFormElement;

  const hideTireModal = () => {
    if (modalTire) modalTire.style.display = 'none';
  };

  if (btnCloseTire) btnCloseTire.addEventListener('click', hideTireModal);
  if (btnCancelTire) btnCancelTire.addEventListener('click', hideTireModal);

  document.querySelectorAll('.btn-change-tire-modal').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const plate = (btn as HTMLElement).getAttribute('data-plate') || '';
      const km = (btn as HTMLElement).getAttribute('data-km') || '';
      const currentSeason = (btn as HTMLElement).getAttribute('data-season') || 'SUMMER';

      if (formTire) formTire.reset();
      const plateInput = document.getElementById('tire-plate') as HTMLInputElement;
      const kmInput = document.getElementById('tire-km') as HTMLInputElement;
      const seasonSelect = document.getElementById('tire-season-select') as HTMLSelectElement;

      if (plateInput) plateInput.value = plate;
      if (kmInput) kmInput.value = km;
      if (seasonSelect) {
        seasonSelect.value = currentSeason === 'WINTER' ? 'SUMMER' : 'WINTER';
      }

      if (modalTire) modalTire.style.display = 'flex';
    });
  });

  if (formTire) {
    formTire.addEventListener('submit', (e) => {
      e.preventDefault();
      const plate = (document.getElementById('tire-plate') as HTMLInputElement).value.trim();
      const seasonSelect = document.getElementById('tire-season-select') as HTMLSelectElement;
      const season = seasonSelect.value as 'WINTER' | 'SUMMER';
      const km = Number((document.getElementById('tire-km') as HTMLInputElement).value);
      const date = (document.getElementById('tire-date') as HTMLInputElement).value;
      const storage = (document.getElementById('tire-storage') as HTMLInputElement).value.trim();
      const cost = Number((document.getElementById('tire-cost') as HTMLInputElement).value);
      const notes = (document.getElementById('tire-notes') as HTMLInputElement).value.trim();

      if (plate && km) {
        const currentUserProfile = (window as any).appState?.userProfile;
        const currentCreator = currentUserProfile?.email || currentUserProfile?.displayName || currentUserProfile?.name || '';
        const seasonLabel = season === 'WINTER' ? 'Kış Lastiği' : 'Yaz Lastiği';
        hideTireModal();

        vehicleService.changeTireSeason({
          plate: plate.toUpperCase(),
          newSeason: season,
          changeKm: km,
          changeDate: date || new Date().toISOString().split('T')[0],
          storageLocation: storage || 'Depo',
          costAmount: cost || 0,
          notes: notes,
          performedBy: currentCreator
        });

        notificationService.notify(
          'Lastik Değişimi Kaydedildi',
          `${plate.toUpperCase()} aracı için ${km.toLocaleString('tr-TR')} KM'de ${seasonLabel} takıldı ve sisteme kaydedildi!`,
          'success'
        );
      }
    });
  }

  // Photo Lightbox Event Handlers (Instant Fullscreen Image Preview)
  const lightboxModal = document.getElementById('modal-photo-lightbox');
  const lightboxImg = document.getElementById('lightbox-img') as HTMLImageElement;
  const lightboxTitle = document.getElementById('lightbox-title');
  const lightboxClose = document.getElementById('lightbox-close');

  const openLightbox = (url: string, titleText: string = 'Fotoğraf İnceleme') => {
    if (lightboxModal && lightboxImg) {
      lightboxImg.src = url;
      if (lightboxTitle) lightboxTitle.textContent = titleText;
      lightboxModal.style.display = 'flex';
    }
  };

  const closeLightbox = () => {
    if (lightboxModal) lightboxModal.style.display = 'none';
  };

  if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);
  if (lightboxModal) {
    lightboxModal.addEventListener('click', (e) => {
      if (e.target === lightboxModal) closeLightbox();
    });
  }

  document.querySelectorAll('.btn-preview-dmg-photo').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const url = (btn as HTMLElement).getAttribute('data-url');
      const title = (btn as HTMLElement).getAttribute('data-title') || 'Hasar Fotoğrafı';
      if (url) openLightbox(url, title);
    });
  });

  document.querySelectorAll('.btn-open-dmg-tutanaq').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const plate = (btn as HTMLElement).getAttribute('data-plate') || '';
      const img = (btn as HTMLElement).getAttribute('data-img');

      if (img && img.trim()) {
        if (img.startsWith('data:')) {
          const link = document.createElement('a');
          link.href = img;
          const ext = img.startsWith('data:image/png') ? '.png' : (img.startsWith('data:image/jpeg') || img.startsWith('data:image/jpg') ? '.jpg' : (img.startsWith('data:application/pdf') ? '.pdf' : '.jpg'));
          link.download = `Kaza_Tutanagi_${plate.replace(/\s+/g, '_')}${ext}`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          notificationService.notify('Tutanak İndiriliyor', `${plate} aracının kaza tutanağı indiriliyor...`, 'success');
        } else if (img.startsWith('http://') || img.startsWith('https://')) {
          openLightbox(img, `${plate} - Kaza Tutanağı EVRAKI`);
          notificationService.notify('Tutanak Görüntüleniyor', `${plate} aracının kaza tutanağı/görseli açıldı.`, 'info');
        } else {
          notificationService.notify('Kaza Tutanağı Bulunamadı', `${plate} aracı için tutanak evrak görseli henüz yüklenmemiş. Lütfen Hasar Bildirimi alanından tutanak evrakını seçip kaydediniz.`, 'warning');
        }
      } else {
        notificationService.notify('Kaza Tutanağı Bulunamadı', `${plate} aracı için tutanak evrak görseli henüz yüklenmemiş. Lütfen Hasar Bildirimi alanından tutanak evrakını seçip kaydediniz.`, 'warning');
      }
    });
  });
}
