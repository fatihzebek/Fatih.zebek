import { 
  isgService, 
  type KkdDemandRequest, 
  type NearMissIncident, 
  type KkdDemandItem, 
  type PreviousReceipt,
  type MsdsRecord,
  type IsgDocument,
  type PersonnelCertRecord,
  type IsgAuditRecord,
  type ContractorIsgRecord,
  type FireSafetyRecord,
  type TemporaryDispatchRecord,
  type IsgProcurementRecord,
  type RiskAssessmentRecord,
  type IsgScorecardRecord,
  type IsgInventoryItem
} from '../services/IsgService';
import { dataService } from '../services/DataService';
import { authService } from '../services/AuthService';
import { fileService } from '../services/FileService';

// Format Tarih
const formatDate = (dateStr: any) => {
  if (!dateStr) return '-';
  try {
    const d = dateStr.toDate ? dateStr.toDate() : new Date(dateStr);
    if (isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString('tr-TR');
  } catch {
    return String(dateStr);
  }
};

export const IsgManagementPage = async () => {
  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const userEmail = (currentUser?.email || userProfile?.email || '').toLowerCase().trim();
  const userName = userProfile?.displayName || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Kullanıcı';
  const userRole = userProfile?.role || 'TEKNİSYEN';

  const isFatih = userEmail === 'fatih.zebek@demirerholding.com' || userEmail.includes('fatih.zebek');
  const isAdmin = isFatih || userRole === 'ADMIN' || userRole === 'DEMIRER_ISG' || userRole === 'ISG';

  // Verileri çek (Tüm İSG Modülleri)
  const [
    kkdRequests, 
    nearMissList, 
    msdsList, 
    docList, 
    certList, 
    auditList,
    contractorList,
    fireSafetyList,
    dispatchList,
    procurementList,
    riskList,
    scorecardList,
    inventoryList
  ] = await Promise.all([
    isgService.getKkdRequests(),
    isgService.getNearMissIncidents(),
    isgService.getMsdsList(),
    isgService.getDocuments(),
    isgService.getCerts(),
    isgService.getAudits(),
    isgService.getContractors(),
    isgService.getFireSafetyList(),
    isgService.getDispatches(),
    isgService.getProcurements(),
    isgService.getRiskAssessments(),
    isgService.getScorecards(),
    isgService.getInventory()
  ]);

  const sites = dataService.getSortedSites();

  // Tab State
  const activeTab = (window as any)._isgActiveTab || 'KKD'; // 'KKD' or 'NEAR_MISS'

  // İstatistikler
  const kkdPending = kkdRequests.filter(r => r.status === 'PENDING').length;
  const kkdApproved = kkdRequests.filter(r => r.status === 'APPROVED').length;
  const kkdDelivered = kkdRequests.filter(r => r.status === 'DELIVERED').length;

  const rmkOpen = nearMissList.filter(r => r.status === 'REPORTED' || r.status === 'INVESTIGATING').length;
  const rmkAction = nearMissList.filter(r => r.status === 'ACTION_TAKEN').length;
  const rmkClosed = nearMissList.filter(r => r.status === 'CLOSED').length;

  // Window Fonksiyonları Tanımla
  (window as any).setIsgTab = (tab: string) => {
    (window as any)._isgActiveTab = tab;
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  };

  // -------------------------------------------------------------
  // KKD TALEPLERİ RENDER
  // -------------------------------------------------------------
  const renderKkdRequestsTable = () => {
    if (kkdRequests.length === 0) {
      return `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-clipboard-check" style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem; opacity: 0.4;"></i>
            Henüz kayıtlı bir KKD talebi bulunmuyor.
          </td>
        </tr>
      `;
    }

    return kkdRequests.map(req => {
      let statusBadge = '';
      if (req.status === 'PENDING') {
        statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> İNCELENİYOR</span>`;
      } else if (req.status === 'APPROVED') {
        statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> ONAYLANDI</span>`;
      } else if (req.status === 'REJECTED') {
        statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-xmark"></i> REDDEDİLDİ</span>`;
      } else if (req.status === 'DELIVERED') {
        statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-box-open"></i> TESLİM EDİLDİ</span>`;
      }

      const itemsBadges = (req.requestedItems || []).map(item => {
        const sizeText = item.size ? ` (${item.size})` : '';
        const name = item.customName || item.type;
        return `<span style="background: rgba(255,255,255,0.06); color: #e2e8f0; border: 1px solid rgba(255,255,255,0.1); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; margin-right: 4px; margin-bottom: 2px; display: inline-block;"><strong>${name}</strong>${sizeText}: ${item.qty} Ad.</span>`;
      }).join('');

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-weight: 800; color: var(--accent-cyan); font-size: 0.85rem;">
            ${req.tlpNo}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">${req.personnelName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${req.role || 'Teknisyen'}</div>
          </td>
          <td style="padding: 0.85rem 0.75rem; color: #cbd5e1; font-size: 0.82rem; font-weight: 600;">
            <i class="fa-solid fa-charging-station" style="color: #fb923c; margin-right: 4px;"></i> ${req.siteName}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <div style="max-width: 320px; display: flex; flex-wrap: wrap;">
              ${itemsBadges}
            </div>
          </td>
          <td style="padding: 0.85rem 0.75rem; color: var(--text-muted); font-size: 0.78rem;">
            ${formatDate(req.requestDate)}
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: center;">
            ${(req.photos && req.photos.length > 0) 
              ? `<span style="color: #38bdf8; font-size: 0.75rem; font-weight: 700; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-camera"></i> ${req.photos.length} Foto</span>` 
              : `<span style="color: #64748b; font-size: 0.72rem;">Yok</span>`}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            ${statusBadge}
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <!-- Resmi Form Yazdır (DH-FR-019) -->
              <button onclick="window.printOfficialKkdForm('${req.id}')" class="btn-cyber-mini" style="background: rgba(0, 242, 254, 0.12); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Resmi DH-FR-019 Formunu Yazdır (PDF)">
                <i class="fa-solid fa-print"></i> DH-FR-019
              </button>

              <!-- Değerlendir / Onayla Butonu (Sadece Admin / İSG Uzmanı) -->
              ${isAdmin ? `
                <button onclick="window.openEvaluateKkdModal('${req.id}')" class="btn-cyber-mini" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Talebi Değerlendir / Karar Ver">
                  <i class="fa-solid fa-signature"></i> Değerlendir
                </button>
              ` : ''}

              <!-- Sil (Sadece Admin) -->
              ${isAdmin ? `
                <button onclick="window.deleteKkdRequest('${req.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Talebi Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // -------------------------------------------------------------
  // RAMAK KALA RENDER
  // -------------------------------------------------------------
  const renderNearMissTable = () => {
    if (nearMissList.length === 0) {
      return `
        <tr>
          <td colspan="8" style="text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-triangle-exclamation" style="font-size: 2.2rem; display: block; margin-bottom: 0.5rem; opacity: 0.4;"></i>
            Kayıtlı herhangi bir ramak kala veya tehlike bildirimi bulunmuyor.
          </td>
        </tr>
      `;
    }

    return nearMissList.map(inc => {
      let statusBadge = '';
      if (inc.status === 'REPORTED') {
        statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-bell"></i> YENİ BİLDİRİM</span>`;
      } else if (inc.status === 'INVESTIGATING') {
        statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-magnifying-glass"></i> İNCELENİYOR</span>`;
      } else if (inc.status === 'ACTION_TAKEN') {
        statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clipboard-check"></i> DÖF AÇILDI</span>`;
      } else if (inc.status === 'CLOSED') {
        statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-shield-check"></i> KAPATILDI</span>`;
      }

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); transition: background 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
          <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-weight: 800; color: #fbbf24; font-size: 0.85rem;">
            ${inc.incidentNo}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <div style="font-weight: 700; color: #fff; font-size: 0.88rem;">${inc.siteName}</div>
            <div style="font-size: 0.72rem; color: var(--text-muted);">${inc.turbineNo ? `Türbin: ${inc.turbineNo}` : inc.locationDetail}</div>
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            <span style="background: rgba(239, 68, 68, 0.12); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.25); padding: 2px 7px; border-radius: 4px; font-size: 0.72rem; font-weight: 800;">
              ${inc.category}
            </span>
          </td>
          <td style="padding: 0.85rem 0.75rem; max-width: 280px;">
            <div style="color: #e2e8f0; font-size: 0.82rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${inc.description}">
              ${inc.description}
            </div>
            ${inc.immediateAction ? `
              <div style="font-size: 0.71rem; color: #34d399; margin-top: 2px;">
                <i class="fa-solid fa-bolt"></i> Acil Önlem: ${inc.immediateAction}
              </div>
            ` : ''}
          </td>
          <td style="padding: 0.85rem 0.75rem; color: var(--text-muted); font-size: 0.78rem;">
            ${formatDate(inc.incidentDate)} ${inc.incidentTime || ''}
          </td>
          <td style="padding: 0.85rem 0.75rem; font-size: 0.8rem; color: #cbd5e1;">
            ${inc.isAnonymous ? '<span style="color: #94a3b8; font-style: italic;"><i class="fa-solid fa-user-secret"></i> Anonim</span>' : inc.reportedBy}
          </td>
          <td style="padding: 0.85rem 0.75rem;">
            ${statusBadge}
          </td>
          <td style="padding: 0.85rem 0.75rem; text-align: right; white-space: nowrap;">
            <div style="display: inline-flex; gap: 6px; align-items: center;">
              <!-- İncele & DÖF (Sadece Admin / İSG Uzmanı) -->
              ${isAdmin ? `
                <button onclick="window.openNearMissActionModal('${inc.id}')" class="btn-cyber-mini" style="background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="İncele / DÖF Aksiyonu Al">
                  <i class="fa-solid fa-shield-halved"></i> İncele & DÖF
                </button>
              ` : ''}
              <button onclick="window.printNearMissReport('${inc.id}')" class="btn-cyber-mini" style="background: rgba(0, 242, 254, 0.12); color: var(--accent-cyan); border: 1px solid rgba(0, 242, 254, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Resmi Tutanak Yazdır">
                <i class="fa-solid fa-print"></i> Tutanak
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  };

  // -------------------------------------------------------------
  // KİMYASAL & MSDS RENDER
  // -------------------------------------------------------------
  const renderMsdsSection = () => {
    const displayMsdsList: MsdsRecord[] = msdsList.length > 0 ? msdsList : [
      {
        id: 'msds-1',
        productName: 'Mobil SHC Gear 320 WT',
        brand: 'ExxonMobil',
        category: 'YAG',
        pictograms: ['health_hazard', 'environment'],
        usageArea: 'Rüzgar Türbini Dişli Kutusu',
        firstAidSkin: 'Kirlenen giysileri çıkarın. Cildi bol su ve sabunla en az 15 dk yıkayın.',
        firstAidEyes: 'Göz kapaklarını açık tutarak en az 15 dakika bol suyla yıkayın. Tıbbi yardım alın.',
        firstAidInhalation: 'Kişiyi derhal temiz havaya çıkarın. Solunum güçlüğü varsa oksijen verin.',
        firstAidIngestion: 'Kusturmayın! Ağzı bol su ile çalkalayın ve acil tıbbi yardım çağırın.',
        fileName: 'Mobil_SHC_Gear_320_WT_MSDS_TR.pdf'
      },
      {
        id: 'msds-2',
        productName: 'Klüberplex BEM 41-141',
        brand: 'Klüber Lubrication',
        category: 'GRES',
        pictograms: ['irritant'],
        usageArea: 'Rotor, Yaw ve Pitch Rulmanları',
        firstAidSkin: 'Cildi su ve yumuşak sabun ile yıkayın.',
        firstAidEyes: 'Bol su ile durulayın. Tahriş sürerse doktora başvurun.',
        firstAidInhalation: 'Gerekirse açık havaya çıkın.',
        firstAidIngestion: 'Bol su için. Kendiliğinden kusma olursa başı öne eğin.',
        fileName: 'Kluberplex_BEM_41_141_MSDS.pdf'
      },
      {
        id: 'msds-3',
        productName: 'Castrol Optigear Synthetic X 320',
        brand: 'Castrol Industrial',
        category: 'YAG',
        pictograms: ['health_hazard'],
        usageArea: 'Türbin Ana Dişli Üniteleri',
        firstAidSkin: 'Sabun ve su ile yıkayın.',
        firstAidEyes: 'Gözleri 15 dk boyunca bol su ile yıkayın.',
        firstAidInhalation: 'Temiz havaya çıkarın.',
        firstAidIngestion: 'Kusturmayın, hekime başvurun.',
        fileName: 'Castrol_Optigear_X320_SDS.pdf'
      },
      {
        id: 'msds-4',
        productName: 'Würth Fren & Parça Temizleyici Sprey',
        brand: 'Würth',
        category: 'SOLVENT',
        pictograms: ['flammable', 'irritant', 'environment'],
        usageArea: 'Mekanik Fren ve Disk Temizliği',
        firstAidSkin: 'Kirlenen giysileri çıkarın. Cildi su ve sabunla yıkayın.',
        firstAidEyes: 'Bol su ile en az 10 dk durulayın. Doktora gidin.',
        firstAidInhalation: 'Açık havaya çıkın, dinlenin.',
        firstAidIngestion: 'Kusturmayın! Acil zehirlenme merkezini arayın.',
        fileName: 'Wurth_Fren_Temizleyici_MSDS.pdf'
      }
    ];

    const getPictogramBadge = (p: string) => {
      switch(p) {
        case 'flammable': return `<span title="Alevlenir / Yanıcı" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(239,68,68,0.15); border:1px solid #ef4444; border-radius:6px; font-size:1rem;">🔥</span>`;
        case 'toxic': return `<span title="Zehirli / Toksik" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(168,85,247,0.15); border:1px solid #a855f7; border-radius:6px; font-size:1rem;">☠️</span>`;
        case 'corrosive': return `<span title="Aşındırıcı / Korozif" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(245,158,11,0.15); border:1px solid #f59e0b; border-radius:6px; font-size:1rem;">🧪</span>`;
        case 'environment': return `<span title="Çevreye Zararlı" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(16,185,129,0.15); border:1px solid #10b981; border-radius:6px; font-size:1rem;">🌲</span>`;
        case 'health_hazard': return `<span title="Ciddi Sağlık Hasarı" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(59,130,246,0.15); border:1px solid #3b82f6; border-radius:6px; font-size:1rem;">🫁</span>`;
        default: return `<span title="Tahriş Edici" style="display:inline-flex; align-items:center; justify-content:center; width:28px; height:28px; background:rgba(234,179,8,0.15); border:1px solid #eab308; border-radius:6px; font-size:1rem;">⚠️</span>`;
      }
    };

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-flask-vial" style="color: #06b6d4;"></i> KİMYASAL & MSDS FORM KÜTÜPHANESİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Santrallerde ve atölyede kullanılan yağ, solvent, gres ve yapıştırıcıların güvenlik bilgi formları.
          </p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          <input type="text" id="msds-search-input" placeholder="Kimyasal, marka veya yer ara..." oninput="window.filterMsdsSearch(this.value)" class="cyber-input" style="padding: 0.5rem 1rem; width: 250px; font-size: 0.82rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; color: #fff;" />
          ${isAdmin ? `
            <button onclick="window.openCreateMsdsModal()" class="btn-cyber" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-plus"></i> YENİ MSDS EKLE
            </button>
          ` : ''}
        </div>
      </div>

      <div id="msds-cards-grid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 1.25rem;">
        ${displayMsdsList.map(item => `
          <div class="glass-panel msds-card" data-search="${(item.productName + ' ' + item.brand + ' ' + item.usageArea).toLowerCase()}" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div>
                  <span style="font-size: 0.68rem; font-weight: 800; color: #06b6d4; letter-spacing: 1px; text-transform: uppercase;">${item.brand}</span>
                  <h4 style="color: #fff; font-size: 1.05rem; font-weight: 800; margin: 2px 0 6px 0;">${item.productName}</h4>
                  <div style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; color: #94a3b8;">
                    <i class="fa-solid fa-location-dot" style="color: #f59e0b;"></i> ${item.usageArea}
                  </div>
                </div>
                <span class="badge" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                  ${item.category}
                </span>
              </div>

              <div style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
                <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 700; margin-bottom: 6px; text-transform: uppercase;">GHS Tehlike Sembolleri:</div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                  ${(item.pictograms || []).map(p => getPictogramBadge(p)).join('')}
                </div>
              </div>

              <div style="margin-top: 0.85rem; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 10px; font-size: 0.74rem; color: #cbd5e1; line-height: 1.4;">
                <div style="font-weight: 800; color: #ef4444; font-size: 0.7rem; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
                  <i class="fa-solid fa-kit-medical"></i> İLK YARDIM ÖZETİ:
                </div>
                ${item.firstAidEyes ? `<div><strong>Göz:</strong> ${item.firstAidEyes}</div>` : ''}
                ${item.firstAidSkin ? `<div><strong>Cilt:</strong> ${item.firstAidSkin}</div>` : ''}
                ${item.firstAidInhalation ? `<div><strong>Soluma:</strong> ${item.firstAidInhalation}</div>` : ''}
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
              <button onclick="window.viewOrDownloadMsds('${item.id || ''}', '${item.productName}')" class="btn-cyber-mini" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-file-pdf"></i> MSDS GÖRÜNTÜLE
              </button>

              ${isAdmin ? `
                <button onclick="window.deleteMsdsRecord('${item.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Kimyasal Kaydını Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // KKD MUAYENE TAKİBİ RENDER
  // -------------------------------------------------------------
  const renderEquipmentInspectionSection = () => {
    return `
      <div style="padding: 0.5rem 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
          <div>
            <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
              <i class="fa-solid fa-helmet-safety" style="color: #fbbf24;"></i> KKD & YÜKSEKTE ÇALIŞMA EKİPMANLARI PERİYODİK MUAYENE
            </h3>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
              Emniyet kemerleri, lanyartlar, şaryolar ve karabinaların periyodik muayene, seri no ve kullanım ömrü denetimleri.
            </p>
          </div>

          <button onclick="window.navigate('kkd-kontrol')" class="btn-cyber" style="background: linear-gradient(135deg, #fbbf24 0%, #d97706 100%); color: #000; font-weight: 800; padding: 0.7rem 1.4rem; font-size: 0.88rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(251, 191, 36, 0.3);">
            <i class="fa-solid fa-arrow-up-right-from-square"></i> KKD MUAYENE SİSTEMİNE GİT
          </button>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem; margin-bottom: 2rem;">
          <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #10b981;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-vest" style="font-size: 1.8rem; color: #10b981;"></i>
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">Paraşüt Tipi Emniyet Kemeri</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Maksimum 10 Yıl Kullanım Ömrü / 12 Ay Muayene</div>
              </div>
            </div>
          </div>

          <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #fbbf24;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-link" style="font-size: 1.8rem; color: #fbbf24;"></i>
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">Lanyart & Şok Emici Halatlar</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Maksimum 5-10 Yıl Ömür / Her Kullanım Öncesi Kontrol</div>
              </div>
            </div>
          </div>

          <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #06b6d4;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <i class="fa-solid fa-elevator" style="font-size: 1.8rem; color: #06b6d4;"></i>
              <div>
                <div style="font-weight: 800; color: #fff; font-size: 0.95rem;">Düşüş Tutucu Şaryo & Kılavuz Ray</div>
                <div style="font-size: 0.72rem; color: var(--text-muted);">Her 12 Ayda Yetkili Muayene / EN 353-1 Uyumlu</div>
              </div>
            </div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.5rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(255,255,255,0.06);">
          <h4 style="color: #fbbf24; font-size: 1rem; font-weight: 800; margin: 0 0 8px 0; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-triangle-exclamation"></i> YÜKSEKTE ÇALIŞMA EKİPMANI ZORUNLU EMNİYET KURALLARI
          </h4>
          <ul style="color: #cbd5e1; font-size: 0.8rem; line-height: 1.6; margin: 0; padding-left: 1.2rem;">
            <li>Düşüş yaşamış veya şok emicisi açılmış hiçbir ekipman kesinlikle tekrar kullanılamaz; derhal imha tutanağı ile hurdaya ayrılır.</li>
            <li>Dikişlerinde sökük, liflerinde yanma/kimyasal hasar veya metal aksamında deformasyon olan ekipmanlar derhal kullanımdan çekilir.</li>
            <li>Her teknisyen kendi zimmetli kemer ve lanyartının periyodik kontrol etiketini muayene tarihi gelmeden önce İSG uzmanına yeniletmekle yükümlüdür.</li>
          </ul>
        </div>
      </div>
    `;
  };

  // -------------------------------------------------------------
  // İSG TALİMATLARI & PROSEDÜRLER RENDER
  // -------------------------------------------------------------
  const renderDocumentsSection = () => {
    const displayDocs: IsgDocument[] = docList.length > 0 ? docList : [
      {
        id: 'doc-1',
        docCode: 'DH-TL-ISG-001',
        title: 'Rüzgar Türbinlerinde Yüksekte Çalışma ve Kurtarma Talimatı',
        category: 'YUKSEKTE_CALISMA',
        revisionNo: '003',
        revisionDate: '15.01.2025',
        description: 'Türbin kulesi, nacelle ve kanat dışı çalışmalarında yaşam hattı, lanyart ve acil kurtarma prosedürleri.',
        fileName: 'DH_TL_ISG_001_Yuksekte_Calisma.pdf'
      },
      {
        id: 'doc-2',
        docCode: 'DH-TL-ISG-002',
        title: 'Kapalı Alana (Rotor / Hub / Kanat İçi) Giriş Güvenlik Talimatı',
        category: 'KAPALI_ALAN',
        revisionNo: '002',
        revisionDate: '10.11.2024',
        description: 'Gaz ölçümü, havalandırma, gözlemci personel ve acil tahliye kuralları.',
        fileName: 'DH_TL_ISG_002_Kapali_Alan_Giris.pdf'
      },
      {
        id: 'doc-3',
        docCode: 'DH-PR-ISG-003',
        title: 'Elektrik Kuvvetli Akım Tesislerinde (EKAT) Çalışma Prosedürü',
        category: 'ELEKTRIK',
        revisionNo: '001',
        revisionDate: '05.08.2024',
        description: 'Trafolar, inverterler ve şalt sahasında topraklama, izole KKD ve manevra kuralları.',
        fileName: 'DH_PR_ISG_003_EKAT_Guvenlik.pdf'
      },
      {
        id: 'doc-4',
        docCode: 'DH-PL-ISG-001',
        title: 'Rüzgar Enerji Santralleri Acil Durum & Tahliye Eylem Planı',
        category: 'ACIL_DURUM',
        revisionNo: '004',
        revisionDate: '01.02.2025',
        description: 'Yangın, yıldırım, fırtına, yaralanma ve nacelle üstünden sedyeli acil kurtarma organizasyonu.',
        fileName: 'DH_PL_ISG_001_Acil_Durum_Plani.pdf'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-file-shield" style="color: #a855f7;"></i> İSG TALİMATLARI, PROSEDÜRLER & EYLEM PLANLARI
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Demirer Holding resmi İSG prosedürleri, talimatnameleri ve acil durum tahliye protokolleri.
          </p>
        </div>

        <div style="display: flex; gap: 10px; align-items: center;">
          ${isAdmin ? `
            <button onclick="window.openCreateDocModal()" class="btn-cyber" style="background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-plus"></i> YENİ DOKÜMAN / TALİMAT YÜKLE
            </button>
          ` : ''}
        </div>
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        ${displayDocs.map(doc => `
          <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; color: #a855f7;">${doc.docCode}</span>
                <span class="badge" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); font-size: 0.65rem; font-weight: 800; padding: 2px 7px;">
                  Rev: ${doc.revisionNo} (${doc.revisionDate})
                </span>
              </div>
              <h4 style="color: #fff; font-size: 1.05rem; font-weight: 800; margin: 0 0 6px 0; line-height: 1.3;">${doc.title}</h4>
              <p style="color: var(--text-muted); font-size: 0.78rem; line-height: 1.4; margin: 0;">${doc.description || ''}</p>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
              <button onclick="window.viewOrDownloadDoc('${doc.id || ''}', '${doc.title}')" class="btn-cyber-mini" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
                <i class="fa-solid fa-file-pdf"></i> TALİMATI GÖRÜNTÜLE
              </button>

              ${isAdmin ? `
                <button onclick="window.deleteDocRecord('${doc.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Dokümanı Sil">
                  <i class="fa-solid fa-trash-can"></i>
                </button>
              ` : ''}
            </div>
          </div>
        `).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // PERSONEL SERTİFİKA, SAĞLIK, SRC & PSİKOTEKNİK TAKİBİ RENDER
  // -------------------------------------------------------------
  const renderCertificatesSection = () => {
    const displayCerts: PersonnelCertRecord[] = certList.length > 0 ? certList : [
      {
        id: 'cert-1',
        personnelName: 'Furkan Yıldırım',
        teamName: 'Team 01 (Keltepe)',
        certType: 'GWO_BST',
        certNo: 'GWO-TR-2023-8841',
        issueDate: '10.05.2023',
        expiryDate: '10.05.2025',
        notes: 'Yüksekte Çalışma, İlkyardım, Yangın Bilinci ve Elle Taşıma modülleri tam.'
      },
      {
        id: 'cert-2',
        personnelName: 'Umut Can Akman',
        teamName: 'Team 02 (Şamlı)',
        certType: 'SRC_4',
        certNo: 'SRC-4-2024-819',
        issueDate: '12.02.2024',
        expiryDate: '12.02.2029',
        notes: 'Yurtiçi Eşya-Kargo Taşımacılığı Sürücü Mesleki Yeterlilik Belgesi.'
      },
      {
        id: 'cert-3',
        personnelName: 'Umut Can Akman',
        teamName: 'Team 02 (Şamlı)',
        certType: 'PSIKOTEKNIK',
        certNo: 'PSIKO-2024-104',
        issueDate: '12.02.2024',
        expiryDate: '12.02.2029',
        notes: 'Sağlık Bakanlığı Onaylı Psikoteknik Değerlendirme Raporu (5 Yıllık).'
      },
      {
        id: 'cert-4',
        personnelName: 'Ersin Çetin',
        teamName: 'Team 04 (Mut)',
        certType: 'EKAT',
        certNo: 'EKAT-BELGE-4412',
        issueDate: '20.08.2022',
        expiryDate: '20.08.2027',
        notes: 'Yüksek Gerilim Tesislerinde Çalışma ve Manevra Yetki Belgesi.'
      },
      {
        id: 'cert-5',
        personnelName: 'Furkan Yıldırım',
        teamName: 'Team 01 (Keltepe)',
        certType: 'SAGLIK_EK2',
        certNo: 'SAĞLIK-2025-012',
        issueDate: '10.01.2025',
        expiryDate: '10.01.2026',
        notes: 'Ağır ve Tehlikeli İşlerde Çalışabilir Periyodik Sağlık Raporu.'
      }
    ];

    const getDaysLeft = (expiryStr: string) => {
      try {
        const parts = expiryStr.split('.');
        const expDate = parts.length === 3 ? new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0])) : new Date(expiryStr);
        const diffMs = expDate.getTime() - Date.now();
        return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      } catch {
        return 999;
      }
    };

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-id-card" style="color: #ec4899;"></i> PERSONEL SERTİFİKA, SAĞLIK, SRC & PSİKOTEKNİK TAKİBİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            GWO Yüksekte Çalışma, EK-2 Sağlık Raporları, EKAT ve Araç Sürücüsü (SRC 3/4 & Psikoteknik) yasal geçerlilik takipleri.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          ${isAdmin ? `
            <button onclick="window.openCreateCertModal()" class="btn-cyber" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-plus"></i> YENİ BELGE / SRC EKLE
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Sürücü Belgeleri Özet Bilgi Kutusu -->
      <div class="glass-panel" style="padding: 0.85rem 1.25rem; border-radius: 12px; background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); margin-bottom: 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <i class="fa-solid fa-car-side" style="color: #38bdf8; font-size: 1.4rem;"></i>
          <span style="font-size: 0.8rem; color: #cbd5e1;">
            <strong>Saha Sürücü Mevzuatı:</strong> Şirket ve saha araçlarını kullanan personellerin <strong>SRC 3 / 4</strong> ve 5 yılda bir yenilenen <strong>Psikoteknik</strong> raporları zorunludur. Süresi biten personele araç teslim edilemez.
          </span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button onclick="window.filterCertTable('ALL')" class="btn-cyber-mini" style="background: rgba(255,255,255,0.08); color: #fff; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer;">Tümü</button>
          <button onclick="window.filterCertTable('DRIVER')" class="btn-cyber-mini" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #38bdf8; cursor: pointer; font-weight: 800;">🚗 Sadece SRC & Psikoteknik</button>
          <button onclick="window.filterCertTable('EXPIRED')" class="btn-cyber-mini" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; font-size: 0.72rem; padding: 3px 8px; border-radius: 4px; border: 1px solid #ef4444; cursor: pointer; font-weight: 800;">⚠️ Süresi Dolan / Yaklaşan</button>
        </div>
      </div>

      <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
        <div style="overflow-x: auto;">
          <table id="cert-table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                <th style="padding: 0.75rem;">Personel Adı</th>
                <th style="padding: 0.75rem;">Ekip / Bölge</th>
                <th style="padding: 0.75rem;">Belge Türü</th>
                <th style="padding: 0.75rem;">Belge No</th>
                <th style="padding: 0.75rem;">Veriliş Tarihi</th>
                <th style="padding: 0.75rem;">Bitiş Tarihi</th>
                <th style="padding: 0.75rem;">Durum / Araç Yetkisi</th>
                <th style="padding: 0.75rem; text-align: right;">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              ${displayCerts.map(cert => {
                const daysLeft = getDaysLeft(cert.expiryDate);
                const isDriverDoc = cert.certType.includes('SRC') || cert.certType.includes('PSIKO');
                
                let badge = '';
                if (daysLeft < 0) {
                  badge = isDriverDoc 
                    ? `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid #ef4444; padding: 3px 8px; border-radius: 6px; font-weight: 900; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-ban"></i> SÜRESİ DOLDU (Araç Kullanamaz)</span>`
                    : `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> SÜRESİ BİTTİ (${Math.abs(daysLeft)} gün)</span>`;
                } else if (daysLeft <= 30) {
                  badge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> ${daysLeft} GÜN KALDI</span>`;
                } else {
                  badge = isDriverDoc
                    ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-car"></i> SÜRÜŞE UYGUN (${daysLeft} gün)</span>`
                    : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> GEÇERLİ (${daysLeft} gün)</span>`;
                }

                const typeColor = isDriverDoc ? '#38bdf8' : cert.certType === 'EKAT' ? '#f59e0b' : '#ec4899';

                return `
                  <tr class="cert-row" data-type="${cert.certType}" data-expired="${daysLeft <= 30}" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff;">${cert.personnelName}</td>
                    <td style="padding: 0.85rem 0.75rem; color: #94a3b8; font-size: 0.8rem;">${cert.teamName}</td>
                    <td style="padding: 0.85rem 0.75rem;">
                      <span class="badge" style="background: rgba(255,255,255,0.05); color: ${typeColor}; border: 1px solid ${typeColor}40; font-size: 0.7rem; font-weight: 800; padding: 2px 7px;">
                        ${cert.certType}
                      </span>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-size: 0.8rem; color: #cbd5e1;">${cert.certNo}</td>
                    <td style="padding: 0.85rem 0.75rem; color: #94a3b8; font-size: 0.8rem;">${cert.issueDate}</td>
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff; font-size: 0.8rem;">${cert.expiryDate}</td>
                    <td style="padding: 0.85rem 0.75rem;">${badge}</td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right;">
                      ${isAdmin ? `
                        <button onclick="window.deleteCertRecord('${cert.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Sertifikayı Sil">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // -------------------------------------------------------------
  // SAHA İSG DENETİMLERİ (AUDITS) RENDER
  // -------------------------------------------------------------
  const renderAuditsSection = () => {
    const displayAudits: IsgAuditRecord[] = auditList.length > 0 ? auditList : [
      {
        id: 'audit-1',
        auditNo: 'DNT-2025-001',
        siteName: 'Alize Keltepe',
        auditorName: 'Sercan Yetgin',
        auditDate: '12.02.2025',
        score: 95,
        findingsCount: 1,
        status: 'COMPLETED',
        notes: 'Kule içi tırmanma emniyet hatları ve KKD kullanımı tam. 1 adet yangın tüpünün etiket tarihi yenilenecek.'
      },
      {
        id: 'audit-2',
        auditNo: 'DNT-2025-002',
        siteName: 'Şamlı RES',
        auditorName: 'Sercan Yetgin',
        auditDate: '18.01.2025',
        score: 88,
        findingsCount: 3,
        status: 'ACTION_REQUIRED',
        notes: 'Nacelle içinde yağ döküntü kiti eksikliği tespit edildi, yeni emici pedler tedarik edilecek.'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-clipboard-check" style="color: #3b82f6;"></i> SAHA İSG DENETİMLERİ & TURU (AUDITS)
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Türbin kulesi, trafo, ambar ve şantiye sahası İSG denetim tutanakları ve puanlama sonuçları.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateAuditModal()" class="btn-cyber" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ SAHA DENETİMİ BAŞLAT
          </button>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); gap: 1.25rem;">
        ${displayAudits.map(audit => {
          const scoreColor = audit.score >= 90 ? '#10b981' : audit.score >= 75 ? '#f59e0b' : '#ef4444';
          return `
            <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <span style="font-family: monospace; font-size: 0.78rem; font-weight: 800; color: #3b82f6;">${audit.auditNo}</span>
                  <span style="font-size: 1.2rem; font-weight: 900; color: ${scoreColor}; font-family: monospace;">%${audit.score}</span>
                </div>
                <h4 style="color: #fff; font-size: 1.1rem; font-weight: 800; margin: 0 0 4px 0;">
                  <i class="fa-solid fa-charging-station" style="color: #fb923c; margin-right: 4px;"></i> ${audit.siteName}
                </h4>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 8px;">
                  Denetçi: <strong style="color: #cbd5e1;">${audit.auditorName}</strong> | Tarih: ${audit.auditDate}
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 10px; font-size: 0.75rem; color: #cbd5e1; line-height: 1.4;">
                  <strong>Tespitler:</strong> ${audit.notes || 'Uygunsuzluk bulunmadı.'}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
                <span class="badge" style="background: ${audit.status === 'COMPLETED' ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; color: ${audit.status === 'COMPLETED' ? '#10b981' : '#ef4444'}; border: 1px solid ${audit.status === 'COMPLETED' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}; font-size: 0.7rem; font-weight: 800; padding: 2px 8px;">
                  ${audit.status === 'COMPLETED' ? 'TAMAMLANDI' : 'AKSİYON GEREKLİ'}
                </span>

                ${isAdmin ? `
                  <button onclick="window.deleteAuditRecord('${audit.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Denetimi Sil">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // ORMAN YANGINI & YANGIN GÜVENLİĞİ RENDER
  // -------------------------------------------------------------
  const renderFireSafetySection = () => {
    const displayFire: FireSafetyRecord[] = fireSafetyList.length > 0 ? fireSafetyList : [
      {
        id: 'fire-1',
        equipmentType: 'YANGIN_TUPU',
        siteName: 'Alize Keltepe',
        locationDetail: 'T01 Kule İçi Giriş',
        serialOrPlateNo: 'KKT-KEL-001',
        capacity: '6 kg KKT Tozlu',
        lastInspectionDate: '15.01.2025',
        nextInspectionDate: '15.01.2026',
        status: 'OPERATIONAL',
        pressureOk: true,
        checkedBy: 'Sercan Yetgin'
      },
      {
        id: 'fire-2',
        equipmentType: 'YANGIN_TUPU',
        siteName: 'Şamlı RES',
        locationDetail: 'Şalt Trafo Hücresi',
        serialOrPlateNo: 'CO2-SAM-012',
        capacity: '5 kg CO2 Gazlı',
        lastInspectionDate: '10.02.2025',
        nextInspectionDate: '10.02.2026',
        status: 'OPERATIONAL',
        pressureOk: true,
        checkedBy: 'Sercan Yetgin'
      },
      {
        id: 'fire-3',
        equipmentType: 'ARAZOZ',
        siteName: 'Alize Keltepe',
        locationDetail: 'Santral İdari Bina Yanı',
        serialOrPlateNo: '10 DH 942',
        capacity: '12 Ton Su & Köpük Pompası',
        lastInspectionDate: '01.03.2025',
        nextInspectionDate: '01.06.2025',
        status: 'OPERATIONAL',
        pressureOk: true,
        checkedBy: 'Saha Şefi'
      },
      {
        id: 'fire-4',
        equipmentType: 'ORMAN_RISK',
        siteName: 'Alize Çamseki',
        locationDetail: 'Kule Çevreleri (Orman Sınırı)',
        serialOrPlateNo: 'ORMAN-2025-YAZ',
        capacity: '15m Emniyet Şeridi & Ot Biçimi',
        lastInspectionDate: '20.02.2025',
        nextInspectionDate: '15.05.2025',
        status: 'NEEDS_INSPECTION',
        pressureOk: true,
        notes: 'Yaz öncesi kule dipleri ve enerji hatları altındaki ot temizliği mayıs ayında başlayacak.',
        checkedBy: 'Sercan Yetgin'
      }
    ];

    const opCount = displayFire.filter(f => f.status === 'OPERATIONAL').length;
    const warningCount = displayFire.filter(f => f.status === 'NEEDS_INSPECTION' || f.status === 'OUT_OF_SERVICE').length;

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-fire-flame-curved" style="color: #ef4444;"></i> ORMAN YANGINI & YANGIN GÜVENLİĞİ MERKEZİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Santral yangın tüpleri (KKT/CO2), arazöz & hidrant kontrolleri ve yaz dönemi orman yangını önleyici risk analizleri.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateFireSafetyModal()" class="btn-cyber" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ YANGIN EKİPMANI / DENETİMİ EKLE
          </button>
        ` : ''}
      </div>

      <!-- Orman Yangını Erken Uyarı & Emniyet Bildirimi -->
      <div class="glass-panel" style="padding: 1rem 1.25rem; border-radius: 12px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.25); margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(239, 68, 68, 0.2); display: flex; align-items: center; justify-content: center; font-size: 1.3rem;">
            🌲
          </div>
          <div>
            <div style="font-weight: 800; color: #f87171; font-size: 0.88rem; text-transform: uppercase; letter-spacing: 0.5px;">
              RÜZGAR SANTRALLERİ ORMAN YANGINI RİSK MEVZUATI (HAZİRAN - EKİM)
            </div>
            <div style="font-size: 0.78rem; color: #cbd5e1; margin-top: 2px;">
              Türbin kule diplerindeki 15 metrelik yangın emniyet şeritlerinin ot biçimi eksiksiz yapılmalı; sıcak günlerde alevli kaynak ve taşlama işleri İSG yazılı iznine tabidir.
            </div>
          </div>
        </div>
      </div>

      <!-- Yangın Özet Kartları -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #ef4444;">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam Yangın Ekipmanı</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; margin-top: 4px; font-family: monospace;">${displayFire.length}</div>
        </div>
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(16, 185, 129, 0.2); border-left: 4px solid #10b981;">
          <div style="font-size: 0.72rem; color: #10b981; font-weight: 800; text-transform: uppercase;">Faal & Basıncı Uygun</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #10b981; margin-top: 4px; font-family: monospace;">${opCount}</div>
        </div>
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-left: 4px solid #f59e0b;">
          <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 800; text-transform: uppercase;">Muayene / Bakım Bekleyen</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #f59e0b; margin-top: 4px; font-family: monospace;">${warningCount}</div>
        </div>
      </div>

      <!-- Ekipman Tablosu -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                <th style="padding: 0.75rem;">Santral / Bölge</th>
                <th style="padding: 0.75rem;">Lokasyon & Türbin</th>
                <th style="padding: 0.75rem;">Ekipman Türü</th>
                <th style="padding: 0.75rem;">Seri / Plaka No</th>
                <th style="padding: 0.75rem;">Kapasite</th>
                <th style="padding: 0.75rem; text-align: center;">Basınç / Manometre</th>
                <th style="padding: 0.75rem;">Gelecek Muayene</th>
                <th style="padding: 0.75rem;">Durum</th>
                <th style="padding: 0.75rem; text-align: right;">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              ${displayFire.map(fire => {
                let statusBadge = fire.status === 'OPERATIONAL'
                  ? `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-check"></i> FAAL</span>`
                  : `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> MUAYENE GEREKİYOR</span>`;

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff;">${fire.siteName}</td>
                    <td style="padding: 0.85rem 0.75rem; color: #cbd5e1; font-size: 0.82rem;">${fire.locationDetail}</td>
                    <td style="padding: 0.85rem 0.75rem;">
                      <span class="badge" style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); font-size: 0.7rem; font-weight: 800; padding: 2px 7px;">
                        ${fire.equipmentType}
                      </span>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-size: 0.82rem; color: #cbd5e1;">${fire.serialOrPlateNo}</td>
                    <td style="padding: 0.85rem 0.75rem; color: #94a3b8; font-size: 0.8rem;">${fire.capacity}</td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center;">
                      ${fire.pressureOk 
                        ? `<span style="color: #10b981; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-gauge-high"></i> Normal (Yeşil)</span>`
                        : `<span style="color: #ef4444; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-triangle-exclamation"></i> Düşük Basınç!</span>`}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff; font-size: 0.8rem;">${fire.nextInspectionDate}</td>
                    <td style="padding: 0.85rem 0.75rem;">${statusBadge}</td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right;">
                      ${isAdmin ? `
                        <button onclick="window.deleteFireSafetyRecord('${fire.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Kaydı Sil">
                          <i class="fa-solid fa-trash-can"></i>
                        </button>
                      ` : ''}
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  };

  // -------------------------------------------------------------
  // GEÇİCİ GÖREVLENDİRME TAKİBİ RENDER
  // -------------------------------------------------------------
  const renderDispatchesSection = () => {
    const displayDispatches: TemporaryDispatchRecord[] = dispatchList.length > 0 ? dispatchList : [
      {
        id: 'disp-1',
        docNo: 'GG-2026-004',
        personnelName: 'Furkan Yıldırım',
        originSite: 'Alize Keltepe',
        targetSite: 'Mut RES',
        startDate: '2026-03-22',
        endDate: '2026-03-29',
        reason: 'Ana Rulman Değişimi & Mekanik Destek',
        isgBriefingDone: true,
        status: 'ACTIVE',
        notes: 'Mut sahası coğrafi ve kule içi risk bilgilendirme formu imzalandı.'
      },
      {
        id: 'disp-2',
        docNo: 'GG-2026-005',
        personnelName: 'Umut Can Akman',
        originSite: 'Şamlı RES',
        targetSite: 'Alize Keltepe',
        startDate: '2026-04-05',
        endDate: '2026-04-12',
        reason: 'Yıllık 500 Saat Periyodik Bakım Kampanyası',
        isgBriefingDone: true,
        status: 'PLANNED',
        notes: 'Planlanan geçici görevlendirme.'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-plane-departure" style="color: #38bdf8;"></i> TEKNİSYEN GEÇİCİ GÖREVLENDİRME & SAHA SEVK TAKİBİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Santraller arası arıza, büyük bakım ve parça değişimi için giden personellerin yasal görevlendirme ve İSG bilgilendirme evrakları.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateDispatchModal()" class="btn-cyber" style="background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ GEÇİCİ GÖREVLENDİRME AÇ
          </button>
        ` : ''}
      </div>

      <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                <th style="padding: 0.75rem;">Belge No</th>
                <th style="padding: 0.75rem;">Personel</th>
                <th style="padding: 0.75rem;">Asıl Santral (Çıkış)</th>
                <th style="padding: 0.75rem;">Görev Yeri (Varış)</th>
                <th style="padding: 0.75rem;">Görev Nedeni</th>
                <th style="padding: 0.75rem;">Tarih Aralığı</th>
                <th style="padding: 0.75rem; text-align: center;">İSG Bilgilendirmesi</th>
                <th style="padding: 0.75rem;">Durum</th>
                <th style="padding: 0.75rem; text-align: right;">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              ${displayDispatches.map(disp => {
                let statusBadge = disp.status === 'ACTIVE'
                  ? `<span style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-bolt"></i> GÖREVDE (Aktif)</span>`
                  : disp.status === 'PLANNED'
                  ? `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-clock"></i> PLANLANDI</span>`
                  : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-check"></i> TAMAMLANDI</span>`;

                return `
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 0.85rem 0.75rem; font-family: monospace; font-weight: 800; color: #38bdf8; font-size: 0.85rem;">${disp.docNo}</td>
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fff;">${disp.personnelName}</td>
                    <td style="padding: 0.85rem 0.75rem; color: #94a3b8; font-size: 0.8rem;">${disp.originSite}</td>
                    <td style="padding: 0.85rem 0.75rem; font-weight: 700; color: #fb923c; font-size: 0.85rem;">
                      <i class="fa-solid fa-location-arrow"></i> ${disp.targetSite}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; color: #cbd5e1; font-size: 0.8rem;">${disp.reason}</td>
                    <td style="padding: 0.85rem 0.75rem; font-size: 0.78rem; color: #94a3b8;">${disp.startDate} ~ ${disp.endDate}</td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center;">
                      ${disp.isgBriefingDone 
                        ? `<span style="color: #10b981; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-circle-check"></i> Tamamlandı</span>`
                        : `<span style="color: #ef4444; font-size: 0.75rem; font-weight: 800;"><i class="fa-solid fa-clock"></i> Bekliyor</span>`}
                    </td>
                    <td style="padding: 0.85rem 0.75rem;">${statusBadge}</td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right;">
                      <div style="display: inline-flex; gap: 6px;">
                        <button onclick="window.printDispatchDoc('${disp.id}')" class="btn-cyber-mini" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Resmi Belge Yazdır">
                          <i class="fa-solid fa-print"></i> Yazdır
                        </button>
                        ${isAdmin ? `
                          <button onclick="window.deleteDispatchRecord('${disp.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Sil">
                            <i class="fa-solid fa-trash-can"></i>
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
    `;
  };

  // -------------------------------------------------------------
  // TAŞERON İSG & SAHA GİRİŞ RENDER
  // -------------------------------------------------------------
  const renderContractorsSection = () => {
    const displayContractors: ContractorIsgRecord[] = contractorList.length > 0 ? contractorList : [
      {
        id: 'cont-1',
        companyName: 'Hareket Ağır Taşımacılık & Vinç Hizmetleri',
        siteName: 'Alize Keltepe',
        locationDetail: 'T02 Türbini',
        workDescription: '500 Ton Mobil Vinç ile Ana Mil ve Dişli Kutusu Değişimi',
        contactPerson: 'Murat Kara',
        contactPhone: '0532 555 1234',
        startDate: '2026-03-20',
        endDate: '2026-03-25',
        status: 'APPROVED',
        checklist: [
          { id: '1', label: 'SGK İşe Giriş & Aylık Prim Bildirgeleri', checked: true },
          { id: '2', label: 'EK-2 Ağır ve Tehlikeli İşler Sağlık Raporları', checked: true },
          { id: '3', label: 'Yüksekte Çalışma / GWO Sertifikaları', checked: true },
          { id: '4', label: '16 Saat Temel İSG Eğitim Belgeleri', checked: true },
          { id: '5', label: 'Vinç ve Sepet Periyodik Muayene Raporları', checked: true },
          { id: '6', label: 'Risk Analizi ve Metot Bildirimi (RAMS)', checked: true },
          { id: '7', label: 'Taşeron İSG Taahhütnamesi & Saha Kuralları', checked: true }
        ],
        approvedBy: 'Sercan Yetgin',
        approvalDate: '19.03.2026'
      },
      {
        id: 'cont-2',
        companyName: 'AeroBlade Kanat İnceleme ve Kompozit Onarım',
        siteName: 'Şamlı RES',
        locationDetail: 'T07 ve T11 Kanatları',
        workDescription: 'Halatla İple Erişim (Rope Access) Kanat Yıldırım Hasarı Tamiri',
        contactPerson: 'Serdar Güneş',
        contactPhone: '0544 444 5678',
        startDate: '2026-04-01',
        endDate: '2026-04-05',
        status: 'PENDING_DOCS',
        checklist: [
          { id: '1', label: 'SGK İşe Giriş & Aylık Prim Bildirgeleri', checked: true },
          { id: '2', label: 'EK-2 Ağır ve Tehlikeli İşler Sağlık Raporları', checked: true },
          { id: '3', label: 'IRATA / SPRAT İple Erişim Sertifikaları', checked: true },
          { id: '4', label: '16 Saat Temel İSG Eğitim Belgeleri', checked: true },
          { id: '5', label: 'Kullanılacak Halat ve Donanım Muayeneleri', checked: false },
          { id: '6', label: 'Risk Analizi ve Metot Bildirimi (RAMS)', checked: true },
          { id: '7', label: 'Taşeron İSG Taahhütnamesi & Saha Kuralları', checked: false }
        ],
        missingDocsNote: 'Halat muayene etiketleri ve imzalı İSG taahhütnamesi henüz gelmedi, sahaya giriş bekletiliyor.'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-person-digging" style="color: #f97316;"></i> TAŞERON & YÜKLENİCİ İSG EVRAK VE SAHA GİRİŞ İZNİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Santrallere gelen vinç, kanat, inşaat ve elektrik taşeronlarının yasal İSG evrakları ve sahaya giriş izin onayları.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateContractorModal()" class="btn-cyber" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ TAŞERON KAYDI / GİRİŞ AÇ
          </button>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(350px, 1fr)); gap: 1.25rem;">
        ${displayContractors.map(c => {
          const checkedCount = (c.checklist || []).filter(item => item.checked).length;
          const totalChecklist = (c.checklist || []).length || 7;
          
          let statusBadge = '';
          if (c.status === 'APPROVED') {
            statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> GİRİŞ ONAYLANDI</span>`;
          } else if (c.status === 'PENDING_DOCS') {
            statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-clock"></i> EKSİK EVRAK (BEKLEMEDE)</span>`;
          } else {
            statusBadge = `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid rgba(239, 68, 68, 0.3); padding: 4px 10px; border-radius: 6px; font-weight: 900; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-ban"></i> REDDEDİLDİ</span>`;
          }

          return `
            <div class="glass-panel" style="padding: 1.35rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #f97316; text-transform: uppercase;">${c.siteName} ${c.locationDetail ? `(${c.locationDetail})` : ''}</span>
                    <h4 style="color: #fff; font-size: 1.1rem; font-weight: 800; margin: 2px 0 6px 0; line-height: 1.3;">${c.companyName}</h4>
                    <div style="font-size: 0.78rem; color: #94a3b8;">Yetkili: <strong style="color: #cbd5e1;">${c.contactPerson || '-'}</strong> (${c.contactPhone || '-'})</div>
                  </div>
                  ${statusBadge}
                </div>

                <div style="margin-top: 0.85rem; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; font-size: 0.78rem; color: #cbd5e1; line-height: 1.4;">
                  <strong>Yapılacak İş:</strong> ${c.workDescription}
                  <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 4px;">
                    <i class="fa-solid fa-calendar"></i> İzin Tarihi: <strong>${c.startDate} ~ ${c.endDate}</strong>
                  </div>
                </div>

                <div style="margin-top: 0.85rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem;">
                  <span style="color: #94a3b8;">Evrak Kontrolü:</span>
                  <span style="color: ${checkedCount === totalChecklist ? '#10b981' : '#f59e0b'}; font-weight: 800;">
                    ${checkedCount} / ${totalChecklist} Onaylı Belge
                  </span>
                </div>

                ${c.missingDocsNote ? `
                  <div style="margin-top: 0.6rem; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); border-radius: 6px; padding: 6px 8px; font-size: 0.72rem; color: #f87171;">
                    <i class="fa-solid fa-triangle-exclamation"></i> <strong>Eksik Evrak:</strong> ${c.missingDocsNote}
                  </div>
                ` : ''}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 6px;">
                <div style="display: inline-flex; gap: 6px;">
                  <button onclick="window.openEvaluateContractorModal('${c.id}')" class="btn-cyber-mini" style="background: rgba(249, 115, 22, 0.15); color: #f97316; border: 1px solid rgba(249, 115, 22, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                    <i class="fa-solid fa-list-check"></i> Evrakları İncele
                  </button>
                  <button onclick="window.printContractorEntryPermit('${c.id}')" class="btn-cyber-mini" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 5px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                    <i class="fa-solid fa-print"></i> Giriş İzni Yazdır
                  </button>
                </div>

                ${isAdmin ? `
                  <button onclick="window.deleteContractorRecord('${c.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Kaydı Sil">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // SAHA & EKİP İSG PUANLAMA (SCORECARD) RENDER
  // -------------------------------------------------------------
  const renderScorecardsSection = () => {
    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-trophy" style="color: #eab308;"></i> SAHA & SERVİS EKİBİ İSG PUANLAMA VE LİDERLİK TABLOSU
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Demirer Holding santralleri ve bakım teknisyen ekiplerinin 100 puan üzerinden 5 kriterli İSG denetim karneleri.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateScorecardModal()" class="btn-cyber" style="background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: #000; font-weight: 900; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ SAHA / EKİP PUANLAMASI YAP
          </button>
        ` : ''}
      </div>

      <!-- Liderlik Tabloları Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; margin-bottom: 2rem;">
        
        <!-- 🏢 Santraller Liderlik Tablosu -->
        <div class="glass-panel" style="padding: 1.35rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
          <h4 style="color: #38bdf8; font-size: 1rem; font-weight: 800; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-charging-station"></i> RES SANTRALLERİ İSG SIRALAMASI</span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">Dönem: 2026</span>
          </h4>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(234, 179, 8, 0.1); border: 1px solid rgba(234, 179, 8, 0.3);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">🥇</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Alize Keltepe RES</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">Kule içi emniyet & yangın hatları tam</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">%96</div>
                <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">A+ MÜKEMMEL</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">🥈</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Şamlı RES</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">Ambar kimyasal düzeni onaylı</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">%92</div>
                <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">A BAŞARILI</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">🥉</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Doğal Sayalar RES</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">1 adet yangın tüpü yenilendi</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #f59e0b; font-family: monospace;">%88</div>
                <div style="font-size: 0.65rem; color: #f59e0b; font-weight: 800;">B İYİ</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 👷 Servis Ekipleri Liderlik Tablosu -->
        <div class="glass-panel" style="padding: 1.35rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
          <h4 style="color: #10b981; font-size: 1rem; font-weight: 800; margin: 0 0 1rem 0; display: flex; align-items: center; justify-content: space-between;">
            <span><i class="fa-solid fa-users-gear"></i> SERVİS EKİPLERİ İSG GÜVENLİK SKORLARI</span>
            <span style="font-size: 0.72rem; color: #94a3b8; font-weight: normal;">Son Denetimler</span>
          </h4>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">🏆</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Team 01 (Keltepe)</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">KKD & Yüksekte Çalışma Tam Uyum</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">98 Puan</div>
                <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">SIFIR İSG İHLALİ</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">⭐</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Team 02 (Şamlı)</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">5S tertip ve iş öncesi Take-5 düzenli</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">94 Puan</div>
                <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">GÜVENLİ EKİP</div>
              </div>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-radius: 10px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);">
              <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2rem;">⭐</span>
                <div>
                  <div style="font-weight: 800; color: #fff; font-size: 0.9rem;">Team 04 (Mut)</div>
                  <div style="font-size: 0.72rem; color: #94a3b8;">EKAT ve yüksek gerilim protokolleri tam</div>
                </div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">90 Puan</div>
                <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">GÜVENLİ EKİP</div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Denetim Puanlama Kriterleri Hatırlatması -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 14px; background: rgba(13, 20, 33, 0.5); border: 1px solid rgba(255,255,255,0.06);">
        <div style="font-size: 0.82rem; font-weight: 800; color: #eab308; margin-bottom: 8px;">
          <i class="fa-solid fa-scale-balanced"></i> 100 PUAN ÜZERİNDEN İSG DENETİM PUANLAMA KRİTERLERİ (5 x 20 PUAN)
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 0.75rem; font-size: 0.75rem; color: #cbd5e1;">
          <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;"><strong>1. KKD Kullanımı (20p):</strong> Kask, çene bağı, yelek, gözlük, emniyet ayakkabısı.</div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;"><strong>2. Yüksekte Çalışma (20p):</strong> Çift kollu lanyart, şaryo, yaşam hattına %100 bağlı kalma.</div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;"><strong>3. Kimyasal & Çevre (20p):</strong> Yağ döküntü kiti, atık ayrıştırma, MSDS erişilebilirliği.</div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;"><strong>4. İş İzni & Risk (20p):</strong> İş izni formu, LOTO etiketleme, Take-5 risk değerlendirmesi.</div>
          <div style="background: rgba(255,255,255,0.03); padding: 8px; border-radius: 6px;"><strong>5. Saha 5S Düzeni (20p):</strong> Takım çantası düzeni, kablo koruma, acil çıkış engelsizliği.</div>
        </div>
      </div>
    `;
  };

  // -------------------------------------------------------------
  // RİSK ANALİZLERİ (5x5 MATRİS) RENDER
  // -------------------------------------------------------------
  const renderRiskSection = () => {
    const displayRisks: RiskAssessmentRecord[] = riskList.length > 0 ? riskList : [
      {
        id: 'risk-1',
        riskNo: 'RA-RES-001',
        title: 'Rüzgar Türbinlerinde Yüksekte Çalışma ve Dikey Tırmanma',
        siteOrCategory: 'Kule İçi & Nacelle / Yüksekte Çalışma',
        hazard: 'Kule merdiveninden veya nacelle üstünden yüksekten düşme',
        consequence: 'Ölümcül düşme veya kalıcı ağır uzuv kaybı',
        probability: 4,
        severity: 5,
        riskScore: 20,
        riskLevel: 'HIGH',
        existingControls: 'EN 353-1 sertifikalı dikey ray ve düşüş tutucu şaryo, EN 361 paraşüt tipi kemer, EN 355 çift kollu lanyart ile %100 bağlı kalma, rüzgar hızı >15 m/s iken kuleye tırmanmama kuralı.',
        residualProbability: 1,
        residualSeverity: 4,
        residualRiskScore: 4,
        responsiblePerson: 'Sercan Yetgin / Saha Şefleri',
        revisionDate: '15.01.2026',
        status: 'ACTIVE'
      },
      {
        id: 'risk-2',
        riskNo: 'RA-RES-002',
        title: 'Rotor Hub ve Kanat İçi Kapalı Alana Giriş Güvenliği',
        siteOrCategory: 'Rotor & Kanat İçi / Kapalı Alan',
        hazard: 'Yetersiz oksijen, reçine/kimyasal buharı, rotorun dönmesi',
        consequence: 'Boğulma, zehirlenme veya mekanik sıkışma',
        probability: 4,
        severity: 4,
        riskScore: 16,
        riskLevel: 'HIGH',
        existingControls: 'Rotor mekanik kilit pimi takılması, 4 gaz ölçüm cihazı ile gaz testi, cebri havalandırma fanı, giriş ağzında 1 personelin nöbetçi beklemesi.',
        residualProbability: 1,
        residualSeverity: 4,
        residualRiskScore: 4,
        responsiblePerson: 'Sercan Yetgin / Baş Teknisyen',
        revisionDate: '01.02.2026',
        status: 'ACTIVE'
      },
      {
        id: 'risk-3',
        riskNo: 'RA-RES-003',
        title: 'Trafo Binası ve Şalt Sahasında Yüksek Gerilim (EKAT) Çalışması',
        siteOrCategory: 'Elektrik & Şalt Sahası / Yüksek Gerilim',
        hazard: 'İzole edilmemiş baralarda elektrik çarpması veya ark patlaması',
        consequence: '3. derece yanık, kalp durması veya ölüm',
        probability: 5,
        severity: 5,
        riskScore: 25,
        riskLevel: 'HIGH',
        existingControls: '5 Güvenlik Kuralı: Gerilimi kes, yeniden verilmesini kilitle, gerilim yokluğunu neon stankayla doğrula, topraklama ve kısa devre yap, çalışma alanını bariyerle izole et. 36 kV izole eldiven ve baret siperliği.',
        residualProbability: 1,
        residualSeverity: 5,
        residualRiskScore: 5,
        responsiblePerson: 'EKAT Sorumlusu / Sercan Yetgin',
        revisionDate: '10.01.2026',
        status: 'ACTIVE'
      },
      {
        id: 'risk-4',
        riskNo: 'RA-RES-004',
        title: 'Yaz Dönemi Rüzgar Santrallerinde Orman Yangını ve Sıcak Çalışma',
        siteOrCategory: 'Çevre & Ormanlık Alan / Yangın Güvenliği',
        hazard: 'Kıvılcım, mekanik fren sürtünmesi veya elektrik arkıyla kuru otların tutuşması',
        consequence: 'Büyük çaplı orman yangını ve santral hasarı',
        probability: 3,
        severity: 5,
        riskScore: 15,
        riskLevel: 'HIGH',
        existingControls: 'Türbin diplerinde 15m yarıçaplı ot biçimi, alevli işlerde yangın battaniyesi & hazır 50kg yangın tüpü, rüzgarlı günlerde sıcak çalışma yasağı, hazır su arazözü bekletilmesi.',
        residualProbability: 1,
        residualSeverity: 3,
        residualRiskScore: 3,
        responsiblePerson: 'Sercan Yetgin / Santral Şefleri',
        revisionDate: '01.03.2026',
        status: 'ACTIVE'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #f43f5e;"></i> İSG RİSK DEĞERLENDİRME & 5x5 MATRİS YÖNETİMİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            6331 sayılı İSG Kanunu standartlarında Olasılık x Şiddet 5x5 L-Tipi matris analizleri ve hazır RES şablonları.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateRiskModal()" class="btn-cyber" style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ RİSK ANALİZİ EKLE
          </button>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.25rem;">
        ${displayRisks.map(r => {
          return `
            <div class="glass-panel" style="padding: 1.35rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
                  <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; color: #f43f5e;">${r.riskNo}</span>
                  <span class="badge" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); font-size: 0.68rem; font-weight: 800; padding: 2px 8px;">
                    ${r.siteOrCategory}
                  </span>
                </div>
                <h4 style="color: #fff; font-size: 1.05rem; font-weight: 800; margin: 0 0 6px 0;">${r.title}</h4>
                <div style="font-size: 0.78rem; color: #cbd5e1; line-height: 1.4;">
                  <strong style="color: #f87171;">Tehlike:</strong> ${r.hazard}<br>
                  <strong style="color: #fbbf24;">Olası Risk:</strong> ${r.consequence}
                </div>

                <!-- Skor Karşılaştırması -->
                <div style="margin-top: 0.85rem; display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 8px;">
                  <div style="text-align: center; border-right: 1px solid rgba(255,255,255,0.08);">
                    <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800;">İLK RİSK PUANI</div>
                    <div style="font-size: 1.25rem; font-weight: 900; color: #ef4444; font-family: monospace;">${r.riskScore} / 25</div>
                    <div style="font-size: 0.65rem; color: #ef4444; font-weight: 800;">YÜKSEK RİSK</div>
                  </div>
                  <div style="text-align: center;">
                    <div style="font-size: 0.65rem; color: #94a3b8; font-weight: 800;">REVİZE RİSK (Önlem Sonrası)</div>
                    <div style="font-size: 1.25rem; font-weight: 900; color: #10b981; font-family: monospace;">${r.residualRiskScore} / 25</div>
                    <div style="font-size: 0.65rem; color: #10b981; font-weight: 800;">KABUL EDİLEBİLİR</div>
                  </div>
                </div>

                <div style="margin-top: 0.75rem; background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); border-radius: 6px; padding: 8px; font-size: 0.74rem; color: #cbd5e1; line-height: 1.4;">
                  <strong style="color: #10b981;">Alınan Kontroller:</strong> ${r.existingControls}
                </div>
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06);">
                <button onclick="window.printRiskDoc('${r.id}')" class="btn-cyber-mini" style="background: rgba(244, 63, 94, 0.15); color: #f43f5e; border: 1px solid rgba(244, 63, 94, 0.3); padding: 5px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
                  <i class="fa-solid fa-print"></i> Risk Raporu Yazdır
                </button>

                ${isAdmin ? `
                  <button onclick="window.deleteRiskRecord('${r.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Sil">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // İSG SATIN ALMA & SİPARİŞ RENDER
  // -------------------------------------------------------------
  const renderProcurementSection = () => {
    const displayProcurements: IsgProcurementRecord[] = procurementList.length > 0 ? procurementList : [
      {
        id: 'proc-1',
        orderNo: 'ISG-SIP-2026-001',
        siteName: 'Alize Keltepe',
        supplierName: 'Kaya Safety & 3M Türkiye',
        items: [
          { name: 'Paraşüt Tipi Emniyet Kemeri (EN 361)', qty: 4, unit: 'Adet', size: 'M-L' },
          { name: 'Çift Kollu Şok Emicili Lanyart (EN 355)', qty: 6, unit: 'Adet' },
          { name: 'Kask İçi İletişim Telsiz Kulaklığı', qty: 4, unit: 'Takım' }
        ],
        requestDate: '14.03.2026',
        status: 'ORDERED',
        notes: 'Satın alma onayı verildi, tedarikçiden kargo bekleniyor.'
      },
      {
        id: 'proc-2',
        orderNo: 'ISG-SIP-2026-002',
        siteName: 'Tüm Santraller (Merkez Depo)',
        supplierName: 'Würth Sanayi',
        items: [
          { name: 'Yağ & Kimyasal Döküntü Müdahale Kiti (Sosis & Ped)', qty: 10, unit: 'Set' },
          { name: 'Mekanik Montaj Eldiveni (EN 388 4X43D)', qty: 100, unit: 'Çift', size: 'No: 9-10' }
        ],
        requestDate: '10.03.2026',
        status: 'DELIVERED',
        notes: 'Merkez depoya teslim alındı, sahalara dağıtımı yapılıyor.'
      }
    ];

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-cart-shopping" style="color: #10b981;"></i> İSG & KKD MALZEME SATIN ALMA / SİPARİŞ YÖNETİMİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Sahalardan onaylanan KKD taleplerinin ve toplu İSG koruyucu ekipmanlarının tedarikçi sipariş takipleri.
          </p>
        </div>

        ${isAdmin ? `
          <button onclick="window.openCreateProcurementModal()" class="btn-cyber" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-plus"></i> YENİ İSG SİPARİŞİ OLUŞTUR
          </button>
        ` : ''}
      </div>

      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1.25rem;">
        ${displayProcurements.map(proc => {
          let statusBadge = '';
          if (proc.status === 'REQUESTED') {
            statusBadge = `<span style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-clock"></i> TALEP AÇILDI</span>`;
          } else if (proc.status === 'ORDERED') {
            statusBadge = `<span style="background: rgba(59, 130, 246, 0.15); color: #3b82f6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-file-invoice-dollar"></i> SİPARİŞ VERİLDİ</span>`;
          } else if (proc.status === 'SHIPPED') {
            statusBadge = `<span style="background: rgba(168, 85, 247, 0.15); color: #a855f7; border: 1px solid rgba(168, 85, 247, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-truck-fast"></i> KARGODA / SEVK</span>`;
          } else {
            statusBadge = `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem;"><i class="fa-solid fa-box-open"></i> TESLİM ALINDI</span>`;
          }

          const itemsListHtml = (proc.items || []).map(i => `
            <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dashed rgba(255,255,255,0.06); font-size: 0.76rem;">
              <span style="color: #cbd5e1;"><strong>${i.name}</strong> ${i.size ? `(${i.size})` : ''}</span>
              <span style="color: var(--accent-cyan); font-weight: 800;">${i.qty} ${i.unit}</span>
            </div>
          `).join('');

          return `
            <div class="glass-panel" style="padding: 1.35rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.08); display: flex; flex-direction: column; justify-content: space-between; gap: 1rem;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                  <div>
                    <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; color: #10b981;">${proc.orderNo}</span>
                    <h4 style="color: #fff; font-size: 1.05rem; font-weight: 800; margin: 2px 0 4px 0;">
                      <i class="fa-solid fa-charging-station" style="color: #fb923c; margin-right: 4px;"></i> ${proc.siteName}
                    </h4>
                    <div style="font-size: 0.75rem; color: #94a3b8;">Tedarikçi: <strong style="color: #cbd5e1;">${proc.supplierName || 'Piyasa Araştırmasında'}</strong></div>
                  </div>
                  ${statusBadge}
                </div>

                <div style="margin-top: 0.85rem; background: rgba(0,0,0,0.3); border-radius: 8px; padding: 8px 10px;">
                  <div style="font-size: 0.68rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; margin-bottom: 4px;">Sipariş Kalemleri:</div>
                  ${itemsListHtml}
                </div>

                ${proc.notes ? `
                  <div style="margin-top: 0.6rem; font-size: 0.73rem; color: #94a3b8; font-style: italic;">
                    Not: ${proc.notes}
                  </div>
                ` : ''}
              </div>

              <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.06); flex-wrap: wrap; gap: 6px;">
                <div style="display: inline-flex; gap: 6px;">
                  <button onclick="window.updateProcurementStatus('${proc.id}')" class="btn-cyber-mini" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                    <i class="fa-solid fa-rotate"></i> Durum İlerlet
                  </button>
                  <button onclick="window.printProcurementDoc('${proc.id}')" class="btn-cyber-mini" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;">
                    <i class="fa-solid fa-print"></i> Form Yazdır
                  </button>
                </div>

                ${isAdmin ? `
                  <button onclick="window.deleteProcurementRecord('${proc.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Sil">
                    <i class="fa-solid fa-trash-can"></i>
                  </button>
                ` : ''}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  };

  // -------------------------------------------------------------
  // İSG & KKD YEDEK DEPO VE STOK YÖNETİMİ RENDER
  // -------------------------------------------------------------
  const renderInventorySection = () => {
    const displayInventory: IsgInventoryItem[] = inventoryList.length > 0 ? inventoryList : [
      {
        id: 'inv-1',
        name: 'S3 Emniyet Ayakkabısı (Kompozit Burunlu - EN ISO 20345)',
        category: 'AYAKKABI',
        size: 'No: 42',
        currentStock: 4,
        minThreshold: 3,
        unit: 'Çift',
        storageLocation: 'Merkez İSG Deposu - Raf A1',
        notes: 'Alize Keltepe & Şamlı saha teknisyenleri için.'
      },
      {
        id: 'inv-2',
        name: 'S3 Emniyet Ayakkabısı (Kompozit Burunlu - EN ISO 20345)',
        category: 'AYAKKABI',
        size: 'No: 43',
        currentStock: 1,
        minThreshold: 3,
        unit: 'Çift',
        storageLocation: 'Merkez İSG Deposu - Raf A1',
        notes: 'Stok kritik eşiğin altına indi, sipariş verilmeli.'
      },
      {
        id: 'inv-3',
        name: 'Rüzgar Geçirmez Kışlık Mont & Parka (Demirer Logolu)',
        category: 'KIYAFET',
        size: 'L',
        currentStock: 5,
        minThreshold: 2,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Dolap B2',
        notes: 'EN 343 Su ve Rüzgar Geçirmez Standart.'
      },
      {
        id: 'inv-4',
        name: 'Rüzgar Geçirmez Kışlık Mont & Parka (Demirer Logolu)',
        category: 'KIYAFET',
        size: 'XL',
        currentStock: 2,
        minThreshold: 2,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Dolap B2'
      },
      {
        id: 'inv-5',
        name: 'Paraşüt Tipi Emniyet Kemeri (EN 361)',
        category: 'YUKSEKTE_CALISMA',
        size: 'M-L',
        currentStock: 6,
        minThreshold: 2,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Emniyet Askılığı'
      },
      {
        id: 'inv-6',
        name: 'Çift Kollu Şok Emicili Lanyart (EN 355)',
        category: 'YUKSEKTE_CALISMA',
        size: 'Standart (2m)',
        currentStock: 8,
        minThreshold: 3,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Emniyet Askılığı'
      },
      {
        id: 'inv-7',
        name: 'Endüstriyel Emniyet Bareti (Çene Bağlı - EN 397)',
        category: 'BARET',
        size: 'Ayarlanabilir (53-63cm)',
        currentStock: 12,
        minThreshold: 5,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Kutu C1'
      },
      {
        id: 'inv-8',
        name: 'Mekanik Montaj Eldiveni (EN 388 4X43D)',
        category: 'ELDIVEN',
        size: 'No: 9-10',
        currentStock: 35,
        minThreshold: 15,
        unit: 'Çift',
        storageLocation: 'Merkez İSG Deposu - Kutu D1'
      },
      {
        id: 'inv-9',
        name: 'UV Korumalı Şeffaf Emniyet Gözlüğü (EN 166)',
        category: 'GOZLUK_MASKE',
        size: 'Standart',
        currentStock: 18,
        minThreshold: 5,
        unit: 'Adet',
        storageLocation: 'Merkez İSG Deposu - Kutu D2'
      }
    ];

    const criticalItems = displayInventory.filter(i => i.currentStock <= i.minThreshold);
    const shoeItems = displayInventory.filter(i => i.category === 'AYAKKABI');
    const totalShoes = shoeItems.reduce((acc, curr) => acc + curr.currentStock, 0);
    const clothItems = displayInventory.filter(i => i.category === 'KIYAFET');
    const totalClothes = clothItems.reduce((acc, curr) => acc + curr.currentStock, 0);

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h3 style="color: #fff; font-size: 1.25rem; font-weight: 800; margin: 0; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-boxes-stacked" style="color: #06b6d4;"></i> İSG & KKD YEDEK DEPO VE STOK YÖNETİMİ
          </h3>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">
            Demirer bakım teknisyenleri için yedek baret, iş kıyafeti (S-3XL), emniyet botu (40-46) ve yüksekte çalışma donanımları ambarı.
          </p>
        </div>

        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button onclick="window.printInventoryDoc()" class="btn-cyber-mini" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); font-weight: 800; padding: 0.55rem 1rem; font-size: 0.8rem; border-radius: 8px; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-print"></i> SAYIM FORMU YAZDIR
          </button>

          ${isAdmin ? `
            <button onclick="window.openCreateInventoryModal()" class="btn-cyber" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.82rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
              <i class="fa-solid fa-plus"></i> YENİ KKD / MALZEME EKLE
            </button>
          ` : ''}
        </div>
      </div>

      <!-- Depo Özet Kartları -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #06b6d4;">
          <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam KKD Kalemi</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; margin-top: 4px; font-family: monospace;">${displayInventory.length} Kalem</div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid ${criticalItems.length > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.2)'}; border-left: 4px solid ${criticalItems.length > 0 ? '#ef4444' : '#10b981'};">
          <div style="font-size: 0.72rem; color: ${criticalItems.length > 0 ? '#ef4444' : '#10b981'}; font-weight: 800; text-transform: uppercase;">Kritik Stok Uyarısı</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: ${criticalItems.length > 0 ? '#ef4444' : '#10b981'}; margin-top: 4px; font-family: monospace;">
            ${criticalItems.length} Kalem
          </div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">
            ${criticalItems.length > 0 ? 'Minimum eşiğin altına düşen ürün var!' : 'Tüm stoklar yeterli seviyede.'}
          </div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-left: 4px solid #f59e0b;">
          <div style="font-size: 0.72rem; color: #f59e0b; font-weight: 800; text-transform: uppercase;">Emniyet Ayakkabısı / Bot</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #f59e0b; margin-top: 4px; font-family: monospace;">${totalShoes} Çift</div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">(No: 40 - 46 Beden Dağılımı)</div>
        </div>

        <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(168, 85, 247, 0.2); border-left: 4px solid #a855f7;">
          <div style="font-size: 0.72rem; color: #a855f7; font-weight: 800; text-transform: uppercase;">İş Montu / Polar / Kıyafet</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #a855f7; margin-top: 4px; font-family: monospace;">${totalClothes} Adet</div>
          <div style="font-size: 0.68rem; color: var(--text-muted); margin-top: 2px;">(S, M, L, XL, XXL)</div>
        </div>
      </div>

      <!-- Kategori Filtre Butonları -->
      <div style="display: flex; gap: 8px; margin-bottom: 1.25rem; overflow-x: auto; padding-bottom: 4px;">
        <button onclick="window.filterInventoryCategory('ALL')" class="btn-cyber-mini inv-filter-btn active" data-cat="ALL" style="background: rgba(255,255,255,0.08); color: #fff; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); cursor: pointer; font-weight: 800;">Tümü</button>
        <button onclick="window.filterInventoryCategory('CRITICAL')" class="btn-cyber-mini inv-filter-btn" data-cat="CRITICAL" style="background: rgba(239, 68, 68, 0.15); color: #ef4444; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(239, 68, 68, 0.3); cursor: pointer; font-weight: 800;">⚠️ Kritik Stoklar (${criticalItems.length})</button>
        <button onclick="window.filterInventoryCategory('AYAKKABI')" class="btn-cyber-mini inv-filter-btn" data-cat="AYAKKABI" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(245, 158, 11, 0.3); cursor: pointer; font-weight: 800;">👟 Ayakkabı / Bot</button>
        <button onclick="window.filterInventoryCategory('KIYAFET')" class="btn-cyber-mini inv-filter-btn" data-cat="KIYAFET" style="background: rgba(168, 85, 247, 0.15); color: #a855f7; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(168, 85, 247, 0.3); cursor: pointer; font-weight: 800;">🧥 Mont & Kıyafet</button>
        <button onclick="window.filterInventoryCategory('YUKSEKTE_CALISMA')" class="btn-cyber-mini inv-filter-btn" data-cat="YUKSEKTE_CALISMA" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(56, 189, 248, 0.3); cursor: pointer; font-weight: 800;">🧗 Yüksekte Çalışma</button>
        <button onclick="window.filterInventoryCategory('BARET')" class="btn-cyber-mini inv-filter-btn" data-cat="BARET" style="background: rgba(16, 185, 129, 0.15); color: #10b981; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(16, 185, 129, 0.3); cursor: pointer; font-weight: 800;">⛑️ Baret</button>
        <button onclick="window.filterInventoryCategory('ELDIVEN')" class="btn-cyber-mini inv-filter-btn" data-cat="ELDIVEN" style="background: rgba(236, 72, 153, 0.15); color: #ec4899; font-size: 0.75rem; padding: 5px 12px; border-radius: 6px; border: 1px solid rgba(236, 72, 153, 0.3); cursor: pointer; font-weight: 800;">🧤 Eldiven</button>
      </div>

      <!-- Depo Stok Tablosu -->
      <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06);">
        <div style="overflow-x: auto;">
          <table id="isg-inventory-table" style="width: 100%; border-collapse: collapse; text-align: left;">
            <thead>
              <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                <th style="padding: 0.75rem;">Malzeme Adı / Tanımı</th>
                <th style="padding: 0.75rem;">Kategori</th>
                <th style="padding: 0.75rem;">Beden / Numara</th>
                <th style="padding: 0.75rem;">Saklandığı Yer</th>
                <th style="padding: 0.75rem; text-align: center;">Mevcut Stok</th>
                <th style="padding: 0.75rem; text-align: center;">Kritik Eşik</th>
                <th style="padding: 0.75rem;">Stok Durumu</th>
                <th style="padding: 0.75rem; text-align: right;">Hızlı Stok Hareketi</th>
              </tr>
            </thead>
            <tbody>
              ${displayInventory.map(item => {
                const isCritical = item.currentStock <= item.minThreshold;
                const statusBadge = isCritical 
                  ? `<span style="background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; padding: 3px 8px; border-radius: 6px; font-weight: 900; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-triangle-exclamation"></i> KRİTİK STOK</span>`
                  : `<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 8px; border-radius: 6px; font-weight: 800; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 4px;"><i class="fa-solid fa-circle-check"></i> YETERLİ</span>`;

                return `
                  <tr class="inv-row" data-cat="${item.category}" data-critical="${isCritical}" style="border-bottom: 1px solid rgba(255,255,255,0.04);">
                    <td style="padding: 0.85rem 0.75rem;">
                      <div style="font-weight: 800; color: #fff; font-size: 0.88rem;">${item.name}</div>
                      ${item.notes ? `<div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">${item.notes}</div>` : ''}
                    </td>
                    <td style="padding: 0.85rem 0.75rem;">
                      <span class="badge" style="background: rgba(6, 182, 212, 0.15); color: #06b6d4; border: 1px solid rgba(6, 182, 212, 0.3); font-size: 0.7rem; font-weight: 800; padding: 2px 8px;">
                        ${item.category}
                      </span>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; font-weight: 800; color: #f59e0b; font-size: 0.84rem;">
                      ${item.size || 'Standart'}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; color: #cbd5e1; font-size: 0.8rem;">
                      <i class="fa-solid fa-location-dot" style="color: #94a3b8; margin-right: 4px;"></i>${item.storageLocation || 'Merkez Depo'}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center;">
                      <span style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: ${isCritical ? '#ef4444' : '#10b981'};">
                        ${item.currentStock}
                      </span>
                      <span style="font-size: 0.72rem; color: #94a3b8; margin-left: 2px;">${item.unit}</span>
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: center; color: #94a3b8; font-family: monospace; font-size: 0.85rem;">
                      ${item.minThreshold} ${item.unit}
                    </td>
                    <td style="padding: 0.85rem 0.75rem;">
                      ${statusBadge}
                      ${isCritical ? `
                        <button onclick="window.setIsgTab('PROCUREMENT')" title="Satın alma sekmesine git" style="background: none; border: none; color: #38bdf8; font-size: 0.7rem; text-decoration: underline; cursor: pointer; display: block; margin-top: 4px;">
                          🛒 Sipariş Aç
                        </button>
                      ` : ''}
                    </td>
                    <td style="padding: 0.85rem 0.75rem; text-align: right;">
                      <div style="display: inline-flex; gap: 6px; align-items: center;">
                        <button onclick="window.openStockMovementModal('${item.id}', 'IN')" class="btn-cyber-mini" style="background: rgba(16, 185, 129, 0.15); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Yeni Stok Girişi Ekle">
                          <i class="fa-solid fa-plus"></i> Giriş
                        </button>
                        <button onclick="window.openStockMovementModal('${item.id}', 'OUT')" class="btn-cyber-mini" style="background: rgba(245, 158, 11, 0.15); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3); padding: 4px 8px; border-radius: 6px; font-size: 0.72rem; font-weight: 800; cursor: pointer;" title="Personele Teslim Et (Zimmet)">
                          <i class="fa-solid fa-user-check"></i> Teslim Et
                        </button>
                        ${isAdmin ? `
                          <button onclick="window.deleteInventoryItem('${item.id}')" style="background: transparent; border: none; color: #ef4444; opacity: 0.6; cursor: pointer; padding: 4px 6px;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.6'" title="Malzemeyi Sil">
                            <i class="fa-solid fa-trash-can"></i>
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
    `;
  };

  return `
    <div class="fade-in-up" style="padding: 1.5rem; max-width: 1440px; margin: 0 auto; box-sizing: border-box;">
      
      <!-- Üst Başlık & Aksiyon Alanı -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 1.75rem; font-weight: 900; color: #FFF; letter-spacing: 1px; margin: 0; display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-shield-heart" style="color: #10B981;"></i> İŞ SAĞLIĞI & GÜVENLİĞİ (İSG) MERKEZİ
          </h2>
          <div style="font-size: 0.84rem; color: var(--text-muted); margin-top: 4px;">
            Saha KKD Talepleri (<span style="color: var(--accent-cyan); font-weight: 800;">DH-FR-019</span>), Ramak Kala Bildirimleri, Kimyasal MSDS ve Emniyet Yönetimi
          </div>
        </div>

        <div style="display: flex; gap: 10px; flex-wrap: wrap;">
          <button onclick="window.openCreateKkdModal()" class="btn-cyber" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #FFF; font-weight: 800; padding: 0.65rem 1.25rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
            <i class="fa-solid fa-plus"></i> YENİ KKD TALEBİ (DH-FR-019)
          </button>

          <button onclick="window.openCreateNearMissModal()" class="btn-cyber" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #FFF; font-weight: 800; padding: 0.65rem 1.25rem; font-size: 0.85rem; border-radius: 8px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.3);">
            <i class="fa-solid fa-triangle-exclamation"></i> RAMAK KALA BİLDİR
          </button>
        </div>
      </div>

      <!-- İSG Ana Sekmeleri -->
      <div style="display: flex; gap: 6px; border-bottom: 2px solid rgba(255,255,255,0.08); margin-bottom: 1.5rem; overflow-x: auto; padding-bottom: 4px;">
        <button onclick="window.setIsgTab('KKD')" class="tab-btn ${activeTab === 'KKD' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'KKD' ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'KKD' ? '3px solid #10B981' : '3px solid transparent'}; color: ${activeTab === 'KKD' ? '#10B981' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-vest"></i> KKD TALEPLERİ
          <span style="background: rgba(16, 185, 129, 0.2); color: #10B981; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${kkdRequests.length}</span>
        </button>

        <button onclick="window.setIsgTab('INVENTORY')" class="tab-btn ${activeTab === 'INVENTORY' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'INVENTORY' ? 'rgba(6, 182, 212, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'INVENTORY' ? '3px solid #06b6d4' : '3px solid transparent'}; color: ${activeTab === 'INVENTORY' ? '#06b6d4' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-boxes-stacked"></i> KKD DEPO & STOK
          <span style="background: rgba(6, 182, 212, 0.2); color: #06b6d4; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${inventoryList.length}</span>
        </button>

        <button onclick="window.setIsgTab('NEAR_MISS')" class="tab-btn ${activeTab === 'NEAR_MISS' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'NEAR_MISS' ? 'rgba(245, 158, 11, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'NEAR_MISS' ? '3px solid #F59E0B' : '3px solid transparent'}; color: ${activeTab === 'NEAR_MISS' ? '#F59E0B' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-triangle-exclamation"></i> RAMAK KALA
          <span style="background: rgba(245, 158, 11, 0.2); color: #F59E0B; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${nearMissList.length}</span>
        </button>

        <button onclick="window.setIsgTab('FIRE_SAFETY')" class="tab-btn ${activeTab === 'FIRE_SAFETY' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'FIRE_SAFETY' ? 'rgba(239, 68, 68, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'FIRE_SAFETY' ? '3px solid #ef4444' : '3px solid transparent'}; color: ${activeTab === 'FIRE_SAFETY' ? '#ef4444' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-fire-flame-curved"></i> ORMAN & YANGIN
          <span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${fireSafetyList.length}</span>
        </button>

        <button onclick="window.setIsgTab('DISPATCHES')" class="tab-btn ${activeTab === 'DISPATCHES' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'DISPATCHES' ? 'rgba(56, 189, 248, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'DISPATCHES' ? '3px solid #38bdf8' : '3px solid transparent'}; color: ${activeTab === 'DISPATCHES' ? '#38bdf8' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-plane-departure"></i> GEÇİCİ GÖREV
          <span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${dispatchList.length}</span>
        </button>

        <button onclick="window.setIsgTab('CONTRACTORS')" class="tab-btn ${activeTab === 'CONTRACTORS' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'CONTRACTORS' ? 'rgba(249, 115, 22, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'CONTRACTORS' ? '3px solid #f97316' : '3px solid transparent'}; color: ${activeTab === 'CONTRACTORS' ? '#f97316' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-person-digging"></i> TAŞERON İSG
          <span style="background: rgba(249, 115, 22, 0.2); color: #f97316; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${contractorList.length}</span>
        </button>

        <button onclick="window.setIsgTab('SCORECARDS')" class="tab-btn ${activeTab === 'SCORECARDS' || activeTab === 'AUDITS' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'SCORECARDS' || activeTab === 'AUDITS' ? 'rgba(234, 179, 8, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'SCORECARDS' || activeTab === 'AUDITS' ? '3px solid #eab308' : '3px solid transparent'}; color: ${activeTab === 'SCORECARDS' || activeTab === 'AUDITS' ? '#eab308' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-trophy"></i> SAHA & EKİP PUANLAMA
        </button>

        <button onclick="window.setIsgTab('RISK')" class="tab-btn ${activeTab === 'RISK' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'RISK' ? 'rgba(244, 63, 94, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'RISK' ? '3px solid #f43f5e' : '3px solid transparent'}; color: ${activeTab === 'RISK' ? '#f43f5e' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-triangle-exclamation"></i> RİSK ANALİZİ (5x5)
          <span style="background: rgba(244, 63, 94, 0.2); color: #f43f5e; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${riskList.length}</span>
        </button>

        <button onclick="window.setIsgTab('PROCUREMENT')" class="tab-btn ${activeTab === 'PROCUREMENT' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'PROCUREMENT' ? 'rgba(16, 185, 129, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'PROCUREMENT' ? '3px solid #10b981' : '3px solid transparent'}; color: ${activeTab === 'PROCUREMENT' ? '#10b981' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-cart-shopping"></i> İSG SATIN ALMA
          <span style="background: rgba(16, 185, 129, 0.2); color: #10b981; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${procurementList.length}</span>
        </button>

        <button onclick="window.setIsgTab('CERTIFICATES')" class="tab-btn ${activeTab === 'CERTIFICATES' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'CERTIFICATES' ? 'rgba(236, 72, 153, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'CERTIFICATES' ? '3px solid #ec4899' : '3px solid transparent'}; color: ${activeTab === 'CERTIFICATES' ? '#ec4899' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-id-card"></i> SERTİFİKA & SÜRÜCÜ (SRC)
          <span style="background: rgba(236, 72, 153, 0.2); color: #ec4899; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${certList.length}</span>
        </button>

        <button onclick="window.setIsgTab('MSDS')" class="tab-btn ${activeTab === 'MSDS' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'MSDS' ? 'rgba(6, 182, 212, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'MSDS' ? '3px solid #06b6d4' : '3px solid transparent'}; color: ${activeTab === 'MSDS' ? '#06b6d4' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-flask-vial"></i> KİMYASAL & MSDS
          <span style="background: rgba(6, 182, 212, 0.2); color: #06b6d4; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${msdsList.length}</span>
        </button>

        <button onclick="window.setIsgTab('DOCUMENTS')" class="tab-btn ${activeTab === 'DOCUMENTS' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'DOCUMENTS' ? 'rgba(168, 85, 247, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'DOCUMENTS' ? '3px solid #a855f7' : '3px solid transparent'}; color: ${activeTab === 'DOCUMENTS' ? '#a855f7' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-file-shield"></i> TALİMATLAR
          <span style="background: rgba(168, 85, 247, 0.2); color: #a855f7; padding: 2px 6px; border-radius: 10px; font-size: 0.68rem; font-weight: 800;">${docList.length}</span>
        </button>

        <button onclick="window.setIsgTab('EQUIPMENT_INSPECTION')" class="tab-btn ${activeTab === 'EQUIPMENT_INSPECTION' ? 'active' : ''}" style="padding: 0.65rem 1rem; white-space: nowrap; background: ${activeTab === 'EQUIPMENT_INSPECTION' ? 'rgba(251, 191, 36, 0.15)' : 'transparent'}; border: none; border-bottom: ${activeTab === 'EQUIPMENT_INSPECTION' ? '3px solid #fbbf24' : '3px solid transparent'}; color: ${activeTab === 'EQUIPMENT_INSPECTION' ? '#fbbf24' : 'var(--text-muted)'}; font-weight: 800; font-size: 0.82rem; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
          <i class="fa-solid fa-helmet-safety"></i> KKD MUAYENE
        </button>
      </div>

      ${activeTab === 'KKD' ? `
        <!-- KKD Özet İstatistik Kartları -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid var(--accent-cyan);">
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam KKD Talebi</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; margin-top: 4px; font-family: monospace;">${kkdRequests.length}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(245, 158, 11, 0.2); border-left: 4px solid #F59E0B;">
            <div style="font-size: 0.72rem; color: #F59E0B; font-weight: 800; text-transform: uppercase;">İnceleme Bekleyen</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #F59E0B; margin-top: 4px; font-family: monospace;">${kkdPending}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(16, 185, 129, 0.2); border-left: 4px solid #10B981;">
            <div style="font-size: 0.72rem; color: #10B981; font-weight: 800; text-transform: uppercase;">Onaylanan / Tedarikte</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #10B981; margin-top: 4px; font-family: monospace;">${kkdApproved}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(59, 130, 246, 0.2); border-left: 4px solid #3B82F6;">
            <div style="font-size: 0.72rem; color: #60a5fa; font-weight: 800; text-transform: uppercase;">Personele Teslim Edilen</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #60a5fa; margin-top: 4px; font-family: monospace;">${kkdDelivered}</div>
          </div>
        </div>

        <!-- KKD Talepleri Tablosu -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                  <th style="padding: 0.75rem;">Talep No</th>
                  <th style="padding: 0.75rem;">Personel</th>
                  <th style="padding: 0.75rem;">Görev Yeri</th>
                  <th style="padding: 0.75rem;">Talep Edilen KKD'ler</th>
                  <th style="padding: 0.75rem;">Tarih</th>
                  <th style="padding: 0.75rem; text-align: center;">Kusur Fotosu</th>
                  <th style="padding: 0.75rem;">Durum</th>
                  <th style="padding: 0.75rem; text-align: right;">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                ${renderKkdRequestsTable()}
              </tbody>
            </table>
          </div>
        </div>
      ` : activeTab === 'NEAR_MISS' ? `
        <!-- Ramak Kala Özet Kartları -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(255,255,255,0.06); border-left: 4px solid #F59E0B;">
            <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 800; text-transform: uppercase;">Toplam Ramak Kala</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #FFF; margin-top: 4px; font-family: monospace;">${nearMissList.length}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(239, 68, 68, 0.2); border-left: 4px solid #EF4444;">
            <div style="font-size: 0.72rem; color: #EF4444; font-weight: 800; text-transform: uppercase;">Açık / İncelenen</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #EF4444; margin-top: 4px; font-family: monospace;">${rmkOpen}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(59, 130, 246, 0.2); border-left: 4px solid #3B82F6;">
            <div style="font-size: 0.72rem; color: #60a5fa; font-weight: 800; text-transform: uppercase;">DÖF Başlatılan</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #60a5fa; margin-top: 4px; font-family: monospace;">${rmkAction}</div>
          </div>
          <div class="glass-panel" style="padding: 1.1rem; border-radius: 14px; background: rgba(13, 20, 33, 0.6); border: 1px solid rgba(16, 185, 129, 0.2); border-left: 4px solid #10B981;">
            <div style="font-size: 0.72rem; color: #10B981; font-weight: 800; text-transform: uppercase;">Önlem Alındı / Kapatıldı</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #10B981; margin-top: 4px; font-family: monospace;">${rmkClosed}</div>
          </div>
        </div>

        <!-- Ramak Kala Tablosu -->
        <div class="glass-panel" style="padding: 1.25rem; border-radius: 16px; background: rgba(13, 20, 33, 0.7); border: 1px solid rgba(255,255,255,0.06); box-shadow: 0 10px 30px rgba(0,0,0,0.4);">
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; text-align: left;">
              <thead>
                <tr style="border-bottom: 2px solid rgba(255,255,255,0.08); color: #94A3B8; font-size: 0.75rem; text-transform: uppercase; font-weight: 800; letter-spacing: 0.5px;">
                  <th style="padding: 0.75rem;">Olay No</th>
                  <th style="padding: 0.75rem;">Santral / Bölge</th>
                  <th style="padding: 0.75rem;">Tehlike Kategorisi</th>
                  <th style="padding: 0.75rem;">Olay / Tehlike Açıklaması</th>
                  <th style="padding: 0.75rem;">Tarih / Saat</th>
                  <th style="padding: 0.75rem;">Bildiren</th>
                  <th style="padding: 0.75rem;">Durum</th>
                  <th style="padding: 0.75rem; text-align: right;">İşlemler</th>
                </tr>
              </thead>
              <tbody>
                ${renderNearMissTable()}
              </tbody>
            </table>
          </div>
        </div>
      ` : activeTab === 'INVENTORY' ? `
        ${renderInventorySection()}
      ` : activeTab === 'FIRE_SAFETY' ? `
        ${renderFireSafetySection()}
      ` : activeTab === 'DISPATCHES' ? `
        ${renderDispatchesSection()}
      ` : activeTab === 'CONTRACTORS' ? `
        ${renderContractorsSection()}
      ` : activeTab === 'SCORECARDS' ? `
        ${renderScorecardsSection()}
      ` : activeTab === 'RISK' ? `
        ${renderRiskSection()}
      ` : activeTab === 'PROCUREMENT' ? `
        ${renderProcurementSection()}
      ` : activeTab === 'CERTIFICATES' ? `
        ${renderCertificatesSection()}
      ` : activeTab === 'MSDS' ? `
        ${renderMsdsSection()}
      ` : activeTab === 'DOCUMENTS' ? `
        ${renderDocumentsSection()}
      ` : activeTab === 'EQUIPMENT_INSPECTION' ? `
        ${renderEquipmentInspectionSection()}
      ` : activeTab === 'AUDITS' ? `
        ${renderAuditsSection()}
      ` : ''}

    </div>
  `;
};

// ----------------------------------------------------------------------
// MODALLAR VE YARDIMCI WINDOW METOTLARI
// ----------------------------------------------------------------------

// 1. YENİ KKD TALEBİ OLUŞTURMA MODALI (DH-FR-019 BİREBİR)
(window as any).openCreateKkdModal = () => {
  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const userName = userProfile?.displayName || currentUser?.displayName || '';
  const userRole = userProfile?.role || 'Saha Bakım Teknisyeni';
  const userSite = userProfile?.site || 'Alize Keltepe Depo';

  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}" ${s.name === userSite ? 'selected' : ''}>${s.name}</option>`).join('');

  // 14 Cins Tanımı
  const kkdTypes = [
    { id: 1, name: 'Baret' },
    { id: 2, name: 'Ayakkabı', hasSize: true, sizePlaceholder: 'No: 40-46' },
    { id: 3, name: 'Maske' },
    { id: 4, name: 'Pantolon', hasSize: true, sizePlaceholder: 'Beden: S-3XL' },
    { id: 5, name: 'Eldiven' },
    { id: 6, name: 'Diğer (Yazınız)', isCustom: true },
    { id: 7, name: 'Gözlük' },
    { id: 8, name: 'Kıyafet', hasSize: true, sizePlaceholder: 'Beden: M, L...' },
    { id: 9, name: 'Kışlık', hasSize: true, sizePlaceholder: 'Mont/Polar' },
    { id: 10, name: 'Düşme Kor' },
    { id: 11, name: 'Diğer (Yazınız)', isCustom: true },
    { id: 12, name: 'Diğer (Yazınız)', isCustom: true },
    { id: 13, name: 'Diğer (Yazınız)', isCustom: true },
    { id: 14, name: 'Diğer (Yazınız)', isCustom: true }
  ];

  const modal = document.createElement('div');
  modal.id = 'create-kkd-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;
  `;

  const kkdCheckboxesHtml = kkdTypes.map(t => {
    return `
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 8px; padding: 8px 10px; display: flex; flex-direction: column; gap: 6px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fff; font-size: 0.8rem; font-weight: 700;">
            <input type="checkbox" class="kkd-select-cb" data-id="${t.id}" data-name="${t.name}" onchange="window.onKkdCheckboxToggle(${t.id})" style="accent-color: #10B981; width: 16px; height: 16px; cursor: pointer;" />
            <span>${t.id}. ${t.name}</span>
          </label>
          <div style="display: flex; align-items: center; gap: 4px;">
            <input type="number" id="kkd-qty-${t.id}" min="1" max="10" value="1" disabled style="width: 45px; padding: 2px 4px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 4px; color: #10B981; font-weight: 800; text-align: center; font-size: 0.78rem;" />
            <span style="font-size: 0.68rem; color: var(--text-muted);">Adet</span>
          </div>
        </div>

        ${t.isCustom ? `
          <input type="text" id="kkd-custom-${t.id}" placeholder="Malzeme adını yazınız..." disabled style="width: 100%; padding: 4px 8px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.74rem; box-sizing: border-box;" />
        ` : ''}

        ${t.hasSize ? `
          <input type="text" id="kkd-size-${t.id}" placeholder="${t.sizePlaceholder}" disabled style="width: 100%; padding: 4px 8px; background: rgba(0,0,0,0.5); border: 1px solid #334155; border-radius: 4px; color: #f59e0b; font-size: 0.74rem; box-sizing: border-box;" />
        ` : ''}
      </div>
    `;
  }).join('');

  // 5 Satırlı Geçmiş Kullanım Alanı
  const previousRowsHtml = [1, 2, 3, 4, 5].map(r => `
    <tr style="border-bottom: 1px solid rgba(255,255,255,0.04);">
      <td style="padding: 6px; font-weight: 800; color: var(--text-muted); font-size: 0.75rem; text-align: center; width: 25px;">${r}</td>
      <td style="padding: 4px;">
        <input type="date" id="prev-date-${r}" style="width: 100%; padding: 4px 6px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.75rem;" />
      </td>
      <td style="padding: 4px; width: 65px;">
        <input type="number" id="prev-qty-${r}" min="1" placeholder="Adet" style="width: 100%; padding: 4px 6px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.75rem; text-align: center;" />
      </td>
      <td style="padding: 4px;">
        <input type="text" id="prev-reason-${r}" placeholder="Örn: Yıpranma, ömrü doldu..." style="width: 100%; padding: 4px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.75rem;" />
      </td>
    </tr>
  `).join('');

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 860px; max-height: 92vh; overflow-y: auto; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3); background: #0A0E17; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
      
      <!-- Modal Header -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:1rem;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="background: rgba(16, 185, 129, 0.2); color: #10B981; border: 1px solid rgba(16, 185, 129, 0.4); padding: 2px 8px; border-radius: 4px; font-weight: 900; font-family: monospace; font-size: 0.75rem;">DH-FR-019</span>
            <span style="color: var(--text-muted); font-size: 0.75rem;">Rev: 001</span>
          </div>
          <h3 style="margin:4px 0 0 0; font-family:'Rajdhani', sans-serif; font-size:1.35rem; color:#FFF; font-weight:800; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-vest" style="color: #10B981;"></i> KİŞİSEL KORUYUCU DONANIM TALEP FORMU
          </h3>
        </div>
        <button onclick="document.getElementById('create-kkd-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.3rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <!-- Talep Eden Bilgileri Grid -->
      <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
        <div style="font-size: 0.72rem; color: #10B981; font-weight: 800; text-transform: uppercase; margin-bottom: 0.75rem; letter-spacing: 0.5px;">
          Kişisel Koruyucu Donanım Talep Edenin Bilgileri
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:700;">İsim / Soyisim <span style="color:#ef4444;">*</span></label>
            <input type="text" id="kkd-form-name" value="${userName}" class="cyber-input" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;" />
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:700;">Görevi</label>
            <input type="text" id="kkd-form-role" value="${userRole}" class="cyber-input" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;" />
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:700;">Görev Yeri (Santral) <span style="color:#ef4444;">*</span></label>
            <select id="kkd-form-site" class="cyber-input" style="width:100%; padding:0.6rem; background:#0F172A; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:700;">Talep Tarihi</label>
            <input type="date" id="kkd-form-date" value="${new Date().toISOString().split('T')[0]}" class="cyber-input" style="width:100%; padding:0.6rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#10B981; font-size:0.85rem; font-weight:700;" />
          </div>
        </div>
      </div>

      <!-- KKD Çeşitleri Seçimi (Maks 5) -->
      <div style="margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
          <div style="font-size: 0.8rem; color: #fff; font-weight: 800;">
            Talep Ettiğiniz KKD Çeşidini İşaretleyiniz <span style="color: #f59e0b; font-size: 0.72rem;">(Maksimum 5 Adet Seçilebilir)</span>
          </div>
          <div id="kkd-selected-count" style="font-size: 0.75rem; font-weight: 800; color: #10B981;">0 / 5 Seçildi</div>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 8px;">
          ${kkdCheckboxesHtml}
        </div>
      </div>

      <!-- Geçmiş Teslim Alış Tablosu -->
      <div style="background: rgba(15, 23, 42, 0.4); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.85rem; margin-bottom: 1.25rem;">
        <div style="font-size: 0.75rem; color: #94A3B8; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem;">
          En Son Teslim Aldığınız Tarihi, Alış Adeti ve Nedenini Belirtiniz (Opsiyonel)
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="color: #64748b; font-size: 0.7rem; text-transform: uppercase;">
              <th style="padding: 4px; text-align: center;">#</th>
              <th style="padding: 4px;">Son Teslim Alış Tarihi</th>
              <th style="padding: 4px; text-align: center;">Adet</th>
              <th style="padding: 4px;">Talep Nedeni</th>
            </tr>
          </thead>
          <tbody>
            ${previousRowsHtml}
          </tbody>
        </table>
      </div>

      <!-- Talep Nedeni ve Açıklama -->
      <div style="margin-bottom: 1.25rem;">
        <label style="display:block; color:#fff; font-size:0.8rem; margin-bottom:0.35rem; font-weight:800;">
          Kişisel Koruyucu Donanımı Talep Etme Nedeniniz ve Açıklaması <span style="color:#ef4444;">*</span>
        </label>
        <textarea id="kkd-form-reason" class="cyber-input" rows="2" placeholder="Örn: Tırmanış botunun tabanı açıldı, emniyet kemerinde aşınma tespit edildi, yeni başlayan teknisyene zimmet..." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; resize: vertical; box-sizing: border-box;"></textarea>
      </div>

      <!-- Kusurlu Ürün Fotoğrafı Yükleme (RESİM ALANI) -->
      <div style="background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(255,255,255,0.15); border-radius: 10px; padding: 1rem; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <div style="font-size: 0.8rem; color: #38bdf8; font-weight: 800; display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-camera"></i> Mevcut Halinin Fotoğrafı (Özellikle Kusurlu / Yıpranmış Alanı İçerecek Şekilde)
          </div>
          <button type="button" onclick="document.getElementById('kkd-photo-input').click()" class="btn-cyber" style="background: rgba(56, 189, 248, 0.15); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.4); padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; cursor: pointer;">
            <i class="fa-solid fa-upload"></i> Fotoğraf Ekle
          </button>
        </div>
        <input type="file" id="kkd-photo-input" accept="image/*" multiple style="display: none;" onchange="window.handleKkdPhotoUpload(event)" />
        <div id="kkd-photos-preview" style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; min-height: 50px; align-items: center;">
          <span style="color: #64748b; font-size: 0.75rem; font-style: italic;">Henüz fotoğraf eklenmedi.</span>
        </div>
      </div>

      <!-- Modal Footer -->
      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
        <button onclick="document.getElementById('create-kkd-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #fff; padding: 0.65rem 1.25rem; font-size: 0.85rem; border-radius: 6px; cursor: pointer;">
          İptal
        </button>
        <button id="btn-submit-kkd-form" onclick="window.submitKkdDemandForm()" class="btn-cyber" style="background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: #fff; font-weight: 800; padding: 0.65rem 1.5rem; font-size: 0.85rem; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(16, 185, 129, 0.3);">
          <i class="fa-solid fa-paper-plane"></i> TALEBİ GÖNDER (DH-FR-019)
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  (window as any)._currentKkdPhotos = [];
};

// Checkbox Toggle & Maksimum 5 Kontrolü
(window as any).onKkdCheckboxToggle = (id: number) => {
  const cb = document.querySelector(`.kkd-select-cb[data-id="${id}"]`) as HTMLInputElement;
  const qtyInput = document.getElementById(`kkd-qty-${id}`) as HTMLInputElement;
  const customInput = document.getElementById(`kkd-custom-${id}`) as HTMLInputElement;
  const sizeInput = document.getElementById(`kkd-size-${id}`) as HTMLInputElement;

  const checkedBoxes = document.querySelectorAll('.kkd-select-cb:checked');
  if (checkedBoxes.length > 5) {
    alert("Form kuralı gereği en fazla 5 adet KKD cinsi seçebilirsiniz.");
    cb.checked = false;
    return;
  }

  const isChecked = cb.checked;
  if (qtyInput) qtyInput.disabled = !isChecked;
  if (customInput) customInput.disabled = !isChecked;
  if (sizeInput) sizeInput.disabled = !isChecked;

  const countDisplay = document.getElementById('kkd-selected-count');
  if (countDisplay) {
    countDisplay.textContent = `${checkedBoxes.length} / 5 Seçildi`;
  }
};

// Fotoğraf Yükleme ve Önizleme
(window as any).handleKkdPhotoUpload = async (event: any) => {
  const files: FileList = event.target.files;
  if (!files || files.length === 0) return;

  const previewContainer = document.getElementById('kkd-photos-preview');
  if (!previewContainer) return;

  if (!(window as any)._currentKkdPhotos) {
    (window as any)._currentKkdPhotos = [];
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const dataUrl = await fileService.uploadImage(file, 'kkd_demands', 800, 800, 0.7);
      (window as any)._currentKkdPhotos.push(dataUrl);
    } catch (e) {
      console.error("Fotoğraf yükleme hatası:", e);
    }
  }

  renderKkdPhotoPreviews();
};

const renderKkdPhotoPreviews = () => {
  const previewContainer = document.getElementById('kkd-photos-preview');
  if (!previewContainer) return;

  const photos = (window as any)._currentKkdPhotos || [];
  if (photos.length === 0) {
    previewContainer.innerHTML = `<span style="color: #64748b; font-size: 0.75rem; font-style: italic;">Henüz fotoğraf eklenmedi.</span>`;
    return;
  }

  previewContainer.innerHTML = photos.map((p: string, idx: number) => `
    <div style="position: relative; width: 65px; height: 65px; border-radius: 6px; overflow: hidden; border: 1px solid rgba(56, 189, 248, 0.4);">
      <img src="${p}" style="width: 100%; height: 100%; object-fit: cover;" />
      <button type="button" onclick="window.removeKkdPhoto(${idx})" style="position: absolute; top: 2px; right: 2px; background: rgba(239, 68, 68, 0.85); color: #fff; border: none; border-radius: 50%; width: 18px; height: 18px; font-size: 0.65rem; cursor: pointer; display: flex; align-items: center; justify-content: center;">
        ×
      </button>
    </div>
  `).join('');
};

(window as any).removeKkdPhoto = (idx: number) => {
  if ((window as any)._currentKkdPhotos) {
    (window as any)._currentKkdPhotos.splice(idx, 1);
    renderKkdPhotoPreviews();
  }
};

// Formu Kaydet & Gönder
(window as any).submitKkdDemandForm = async () => {
  const nameEl = document.getElementById('kkd-form-name') as HTMLInputElement;
  const roleEl = document.getElementById('kkd-form-role') as HTMLInputElement;
  const siteEl = document.getElementById('kkd-form-site') as HTMLSelectElement;
  const dateEl = document.getElementById('kkd-form-date') as HTMLInputElement;
  const reasonEl = document.getElementById('kkd-form-reason') as HTMLTextAreaElement;
  const submitBtn = document.getElementById('btn-submit-kkd-form') as HTMLButtonElement;

  const personnelName = (nameEl?.value || '').trim();
  const role = (roleEl?.value || '').trim();
  const siteName = siteEl?.value || '';
  const requestDate = dateEl?.value || new Date().toISOString().split('T')[0];
  const reasonDescription = (reasonEl?.value || '').trim();

  if (!personnelName) {
    alert("Lütfen İsim / Soyisim giriniz.");
    nameEl?.focus();
    return;
  }

  if (!reasonDescription) {
    alert("Lütfen KKD talep etme nedeninizi ve açıklamasını belirtiniz.");
    reasonEl?.focus();
    return;
  }

  // Seçilen KKD'leri topla
  const checkedBoxes = document.querySelectorAll('.kkd-select-cb:checked');
  if (checkedBoxes.length === 0) {
    alert("Lütfen talep ettiğiniz KKD çeşitlerinden en az birini işaretleyiniz.");
    return;
  }

  const requestedItems: KkdDemandItem[] = [];
  checkedBoxes.forEach((cb: any) => {
    const id = cb.getAttribute('data-id');
    const defaultName = cb.getAttribute('data-name');
    const qtyInput = document.getElementById(`kkd-qty-${id}`) as HTMLInputElement;
    const customInput = document.getElementById(`kkd-custom-${id}`) as HTMLInputElement;
    const sizeInput = document.getElementById(`kkd-size-${id}`) as HTMLInputElement;

    const qty = Math.max(1, parseInt(qtyInput?.value || '1', 10));
    const customName = customInput?.value?.trim() || undefined;
    const size = sizeInput?.value?.trim() || undefined;

    requestedItems.push({
      type: defaultName,
      customName,
      qty,
      size
    });
  });

  // Geçmiş alışları topla
  const previousReceipts: PreviousReceipt[] = [];
  for (let r = 1; r <= 5; r++) {
    const dVal = (document.getElementById(`prev-date-${r}`) as HTMLInputElement)?.value;
    const qVal = (document.getElementById(`prev-qty-${r}`) as HTMLInputElement)?.value;
    const rVal = (document.getElementById(`prev-reason-${r}`) as HTMLInputElement)?.value?.trim();

    if (dVal || qVal || rVal) {
      previousReceipts.push({
        lastReceivedDate: dVal || '',
        qty: parseInt(qVal || '1', 10) || 1,
        reason: rVal || ''
      });
    }
  }

  const photos = (window as any)._currentKkdPhotos || [];

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
  }

  try {
    const allExisting = await isgService.getKkdRequests();
    const tlpNo = isgService.generateNextTlpNo(allExisting);
    const currentUser = (window as any).currentUser || authService.getCurrentUser();

    await isgService.createKkdRequest({
      docNo: 'DH-FR-019',
      revisionDate: '04.12.2024',
      revisionNo: '001',
      tlpNo,
      personnelName,
      role,
      siteName,
      requestDate,
      requestedItems,
      previousReceipts,
      reasonDescription,
      photos,
      status: 'PENDING',
      createdBy: currentUser?.email || personnelName
    });

    (window as any).showToast?.('Başarılı', `${tlpNo} numaralı KKD talebiniz İSG birimine iletildi.`, 'success');
    document.getElementById('create-kkd-modal')?.remove();

    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    console.error("KKD talep kayıt hatası:", err);
    alert("Talep kaydedilirken hata oluştu: " + (err?.message || err));
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> TALEBİ GÖNDER (DH-FR-019)';
    }
  }
};

// ----------------------------------------------------------------------
// 2. RESMİ DH-FR-019 YAZDIRMA / PDF ÇIKTISI (BİREBİR MATBU FORM)
// ----------------------------------------------------------------------
(window as any).printOfficialKkdForm = async (reqId: string) => {
  const allReqs = await isgService.getKkdRequests();
  const req = allReqs.find(r => r.id === reqId);
  if (!req) {
    alert("Kayıt bulunamadı.");
    return;
  }

  // 14 Cins Eşlemesi
  const all14Types = [
    { id: 1, name: 'Baret' },
    { id: 2, name: 'Ayakkabı' },
    { id: 3, name: 'Maske' },
    { id: 4, name: 'Pantolon' },
    { id: 5, name: 'Eldiven' },
    { id: 6, name: 'Diğer' },
    { id: 7, name: 'Gözlük' },
    { id: 8, name: 'Kıyafet' },
    { id: 9, name: 'Kışlık' },
    { id: 10, name: 'Düşme Kor' },
    { id: 11, name: 'Diğer' },
    { id: 12, name: 'Diğer' },
    { id: 13, name: 'Diğer;' },
    { id: 14, name: 'Diğer;' }
  ];

  // Talepleri eşle
  const getItemCheck = (id: number, name: string) => {
    const match = (req.requestedItems || []).find(it => {
      if (it.type === name) return true;
      if (it.type.startsWith('Diğer') && name.startsWith('Diğer')) return true;
      return false;
    });
    return {
      checked: !!match,
      qty: match?.qty || '',
      detail: match?.customName ? match.customName : (match?.size ? `Beden: ${match.size}` : '')
    };
  };

  // 5 Satırlı Geçmiş Kullanım Tablosu HTML
  let prevTableRowsHtml = '';
  for (let i = 0; i < 5; i++) {
    const rowData = (req.previousReceipts || [])[i];
    prevTableRowsHtml += `
      <tr>
        <td style="border: 1px solid #000; padding: 4px; font-weight: bold; text-align: center; width: 25px;">${i + 1}</td>
        <td style="border: 1px solid #000; padding: 4px; width: 35%;">
          Son teslim alış tarihi : <strong style="text-decoration: underline;">${rowData?.lastReceivedDate ? formatDate(rowData.lastReceivedDate) : '...................'}</strong>
        </td>
        <td style="border: 1px solid #000; padding: 4px; width: 20%;">
          Adet: <strong style="text-decoration: underline;">${rowData?.qty || '......'}</strong>
        </td>
        <td style="border: 1px solid #000; padding: 4px;">
          Talep Nedeni : <strong>${rowData?.reason || ''}</strong>
        </td>
      </tr>
    `;
  }

  // 4 Adet Resim Kutusu
  const photos = req.photos || [];
  const photoSlot1 = photos[0] ? `<img src="${photos[0]}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '';
  const photoSlot2 = photos[1] ? `<img src="${photos[1]}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '';
  const photoSlot3 = photos[2] ? `<img src="${photos[2]}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '';
  const photoSlot4 = photos[3] ? `<img src="${photos[3]}" style="max-width: 100%; max-height: 100%; object-fit: contain;" />` : '';

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Tarayıcınız açılır pencereyi engelledi. Lütfen izin veriniz.");
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${req.tlpNo} - DH-FR-019 KKD Talep Formu</title>
      <style>
        @page { size: A4 portrait; margin: 8mm 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 760px; margin: 0 auto; box-sizing: border-box; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; }
        .header-table td { border: 1px solid #000; padding: 4px 6px; }
        .bordered-box { border: 1.5px solid #000; margin-top: 6px; }
        .field-title { font-weight: bold; font-size: 9pt; }
        .checkbox-cell { border: 1px solid #000; padding: 2px 4px; font-size: 8.5pt; vertical-align: middle; }
        .box-sq { display: inline-block; width: 12px; height: 12px; border: 1px solid #000; text-align: center; line-height: 11px; font-weight: bold; font-size: 9pt; margin-right: 4px; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="page-container">
        
        <div class="no-print">
          <span style="font-weight: bold; color: #1e293b;">Resmi Form Önizleme (DH-FR-019)</span>
          <button onclick="window.print()" style="background: #10b981; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">
            Yazdır / PDF Olarak Kaydet
          </button>
        </div>

        <!-- Başlık Tablosu -->
        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center; vertical-align: middle;">
              <div style="display: inline-flex; align-items: center; gap: 4px;">
                <div style="border: 2px solid #000; padding: 2px 5px; font-weight: 900; font-size: 15px; font-family: sans-serif;">dh</div>
                <div style="font-family: sans-serif; font-weight: 900; font-size: 11px; line-height: 1.1; text-align: left;">DEMİRER<br><span style="font-weight: 300;">HOLDİNG</span></div>
              </div>
            </td>
            <td style="width: 50%; text-align: center; font-weight: 900; font-size: 12pt; vertical-align: middle;">
              KİŞİSEL KORUYUCU DONANIM TALEP FORMU
            </td>
            <td style="width: 25%; font-size: 7.5pt; line-height: 1.35;">
              <strong>Doküman No:</strong> DH-FR-019<br>
              <strong>Düzenleme Tarihi:</strong> 21.10.2024<br>
              <strong>Revizyon Tarihi:</strong> 04.12.2024<br>
              <strong>Revizyon No:</strong> 001
            </td>
          </tr>
        </table>

        <!-- Kişisel Koruyucu Donanım Talep Edenin -->
        <div class="bordered-box" style="padding: 6px;">
          <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 4px;">Kişisel koruyucu donanım talep edenin;</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 9pt;">
            <tr>
              <td style="width: 15%; font-weight: bold;">İsim / Soyisim</td>
              <td style="width: 35%;">: <span style="border: 1px solid #000; display: inline-block; width: 85%; padding: 2px 4px; font-weight: bold;">${req.personnelName}</span></td>
              <td style="width: 15%; font-weight: bold;">Görev Yeri</td>
              <td style="width: 35%;">: <span style="border: 1px solid #000; display: inline-block; width: 85%; padding: 2px 4px; font-weight: bold;">${req.siteName}</span></td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding-top: 4px;">Görev</td>
              <td style="padding-top: 4px;">: <span style="border: 1px solid #000; display: inline-block; width: 85%; padding: 2px 4px;">${req.role}</span></td>
              <td style="font-weight: bold; padding-top: 4px;">Talep Tarihi</td>
              <td style="padding-top: 4px;">: <span style="border: 1px solid #000; display: inline-block; width: 85%; padding: 2px 4px; font-weight: bold;">${formatDate(req.requestDate)}</span></td>
            </tr>
          </table>
        </div>

        <!-- Talep Edilen KKD Çeşitleri (Maks 5) -->
        <div class="bordered-box" style="padding: 6px;">
          <div style="font-weight: bold; font-size: 8pt; margin-bottom: 2px;">
            Talep ettiğiniz kişisel koruyucu donanım çeşidini işaretleyiniz. (Maksimum 5)
          </div>
          <div style="font-size: 7.5pt; color: #333; margin-bottom: 5px;">
            Kutulardan cinsini seçip, talep ettiğiniz adeti giriniz.
          </div>

          <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
            <thead>
              <tr style="background: #f1f5f9; text-align: left;">
                <th style="border: 1px solid #000; padding: 2px 4px; width: 33%;">KKD Cinsi / Adet</th>
                <th style="border: 1px solid #000; padding: 2px 4px; width: 33%;">KKD Cinsi / Adet</th>
                <th style="border: 1px solid #000; padding: 2px 4px; width: 34%;">KKD Cinsi / Adet</th>
              </tr>
            </thead>
            <tbody>
              <!-- Satır 1: 1, 7, 13 -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(1, 'Baret').checked ? 'X' : ''}</span>
                  1. Baret 
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(1, 'Baret').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(7, 'Gözlük').checked ? 'X' : ''}</span>
                  7. Gözlük 
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(7, 'Gözlük').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(13, 'Diğer;').checked ? 'X' : ''}</span>
                  13. Diğer; ${getItemCheck(13, 'Diğer;').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(13, 'Diğer;').qty}</strong></span>
                </td>
              </tr>

              <!-- Satır 2: 2, 8, 14 -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(2, 'Ayakkabı').checked ? 'X' : ''}</span>
                  2. Ayakkabı ${getItemCheck(2, 'Ayakkabı').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(2, 'Ayakkabı').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(8, 'Kıyafet').checked ? 'X' : ''}</span>
                  8. Kıyafet ${getItemCheck(8, 'Kıyafet').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(8, 'Kıyafet').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(14, 'Diğer;').checked ? 'X' : ''}</span>
                  14. Diğer; ${getItemCheck(14, 'Diğer;').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(14, 'Diğer;').qty}</strong></span>
                </td>
              </tr>

              <!-- Satır 3: 3, 9, - -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(3, 'Maske').checked ? 'X' : ''}</span>
                  3. Maske 
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(3, 'Maske').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(9, 'Kışlık').checked ? 'X' : ''}</span>
                  9. Kışlık ${getItemCheck(9, 'Kışlık').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(9, 'Kışlık').qty}</strong></span>
                </td>
                <td class="checkbox-cell" style="background: #fafafa;"></td>
              </tr>

              <!-- Satır 4: 4, 10, - -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(4, 'Pantolon').checked ? 'X' : ''}</span>
                  4. Pantolon ${getItemCheck(4, 'Pantolon').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(4, 'Pantolon').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(10, 'Düşme Kor').checked ? 'X' : ''}</span>
                  10. Düşme Koruyucu
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(10, 'Düşme Kor').qty}</strong></span>
                </td>
                <td class="checkbox-cell" style="background: #fafafa;"></td>
              </tr>

              <!-- Satır 5: 5, 11, - -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(5, 'Eldiven').checked ? 'X' : ''}</span>
                  5. Eldiven 
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(5, 'Eldiven').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(11, 'Diğer').checked ? 'X' : ''}</span>
                  11. Diğer ${getItemCheck(11, 'Diğer').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(11, 'Diğer').qty}</strong></span>
                </td>
                <td class="checkbox-cell" style="background: #fafafa;"></td>
              </tr>

              <!-- Satır 6: 6, 12, - -->
              <tr>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(6, 'Diğer').checked ? 'X' : ''}</span>
                  6. Diğer ${getItemCheck(6, 'Diğer').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(6, 'Diğer').qty}</strong></span>
                </td>
                <td class="checkbox-cell">
                  <span class="box-sq">${getItemCheck(12, 'Diğer').checked ? 'X' : ''}</span>
                  12. Diğer ${getItemCheck(12, 'Diğer').detail || ''}
                  <span style="float: right; border-left: 1px solid #ccc; padding-left: 4px;">Adet: <strong>${getItemCheck(12, 'Diğer').qty}</strong></span>
                </td>
                <td class="checkbox-cell" style="background: #fafafa;"></td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- En son teslim aldığınız tarihi tablosu -->
        <div class="bordered-box" style="padding: 4px;">
          <div style="font-weight: bold; font-size: 8pt; margin-bottom: 2px;">En son teslim aldığınız tarihi ve alış adeti ile nedenini belirtiniz</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
            ${prevTableRowsHtml}
          </table>
        </div>

        <!-- Talep Nedeni ve Açıklama -->
        <div class="bordered-box" style="padding: 6px;">
          <div style="font-weight: bold; font-size: 8pt;">Kişisel koruyucu donanım talep nedeninizi ve açıklamasını belirtiniz.</div>
          <div style="font-size: 8pt; margin-top: 2px;">Kişisel Koruyucu Donanımı talep etme nedenim</div>
          <div style="font-size: 8.5pt; font-weight: bold; margin-top: 2px; min-height: 28px;">
            Açıklama : <span style="font-weight: normal;">${req.reasonDescription}</span>
          </div>
        </div>

        <!-- RESİM ALANI -->
        <div class="bordered-box" style="padding: 4px; display: flex;">
          <div style="writing-mode: vertical-rl; transform: rotate(180deg); font-weight: 900; font-size: 11pt; padding: 4px 6px; letter-spacing: 4px; border-right: 1.5px solid #000; text-align: center; width: 25px;">
            RESİM
          </div>
          <div style="flex: 1; padding: 4px;">
            <div style="font-size: 7.5pt; font-style: italic; margin-bottom: 4px;">
              Mevcut halinin fotoğrafını (Özellikle kusurlu alanı içerecek şekilde) aşağıya ekleyiniz.
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; height: 180px;">
              <div style="border: 1px solid #aaa; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafafa;">
                ${photoSlot1}
              </div>
              <div style="border: 1px solid #aaa; display: flex; align-items: center; justify-content: center; overflow: hidden; background: #fafafa;">
                ${photoSlot2}
              </div>
            </div>
          </div>
        </div>

        <!-- Talep Onay Durumu -->
        <div class="bordered-box" style="padding: 6px;">
          <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 4px;">Talep Onay Durumu;</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
            <tr>
              <td style="width: 45%; border-right: 1px solid #000; padding-right: 8px;">
                <div style="border: 1px solid #000; padding: 4px 6px; font-weight: bold; margin-bottom: 4px;">
                  Durum: <u>${req.approvalInfo?.decision || (req.status === 'APPROVED' ? 'ONAYLANDI' : (req.status === 'REJECTED' ? 'REDDEDİLDİ' : 'İNCELEMEDE'))}</u>
                </div>
                <div>Karar Tarihi : <strong>${req.approvalInfo?.decisionDate ? formatDate(req.approvalInfo.decisionDate) : '...................'}</strong></div>
                <div style="margin-top: 2px;">Verilme Tarihi : <strong>${req.approvalInfo?.deliveryDate ? formatDate(req.approvalInfo.deliveryDate) : '...................'}</strong></div>
              </td>
              <td style="padding-left: 8px; vertical-align: top;">
                <strong>Açıklama :</strong> ${req.approvalInfo?.note || ''}
              </td>
            </tr>
          </table>
        </div>

        <!-- Talebi Değerlendiren & İmza -->
        <div class="bordered-box" style="padding: 6px; margin-bottom: 8px;">
          <div style="font-weight: bold; font-size: 8.5pt; margin-bottom: 4px;">Talebi Değerlendiren;</div>
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5pt;">
            <tr>
              <td style="width: 15%; font-weight: bold;">İsim / Soyisim</td>
              <td style="width: 45%;">: <span style="border-bottom: 1px solid #000; display: inline-block; width: 85%;">${req.approvalInfo?.evaluatorName || ''}</span></td>
              <td style="width: 40%; text-align: center; border-left: 1px solid #000; height: 35px; vertical-align: middle;">
                <span style="font-size: 7.5pt; color: #555;">İmza</span>
              </td>
            </tr>
            <tr>
              <td style="font-weight: bold;">Görevi</td>
              <td>: <span style="border-bottom: 1px solid #000; display: inline-block; width: 85%;">${req.approvalInfo?.evaluatorRole || 'İSG Sorumlusu'}</span></td>
              <td></td>
            </tr>
          </table>
        </div>

        <!-- Alt Bilgi / Talep No -->
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 8pt; font-weight: bold; margin-top: 6px;">
          <span>TLPNO: <span style="font-family: monospace; font-size: 9pt;">${req.tlpNo}</span></span>
          <span style="font-size: 7pt; color: #666;">DH-Servis Saha İSG Yönetim Sistemi</span>
        </div>

      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
};

// ----------------------------------------------------------------------
// 3. İSG DEĞERLENDİRME & ONAY MODALI
// ----------------------------------------------------------------------
(window as any).openEvaluateKkdModal = (reqId: string) => {
  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const evaluatorName = userProfile?.displayName || currentUser?.displayName || '';

  const modal = document.createElement('div');
  modal.id = 'evaluate-kkd-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10005; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 500px; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(16, 185, 129, 0.3); background: #0A0E17; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.75rem;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.3rem; color:#10B981; font-weight:800; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-clipboard-check"></i> KKD TALEBİ DEĞERLENDİRME
        </h3>
        <button onclick="document.getElementById('evaluate-kkd-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            Karar / Onay Durumu <span style="color:#ef4444;">*</span>
          </label>
          <select id="eval-decision" class="cyber-input" style="width: 100%; padding: 0.75rem; background: #0F172A; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.9rem; font-weight: 700;">
            <option value="APPROVED">✅ ONAYLANDI (Tedarik Edilecek)</option>
            <option value="DELIVERED">📦 TESLİM EDİLDİ (Personele Verildi)</option>
            <option value="REJECTED">❌ REDDEDİLDİ (Gerekçe Belirtiniz)</option>
            <option value="PENDING">⏳ İNCELENİYOR (Beklemede)</option>
          </select>
        </div>

        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            Değerlendirme Notu / Açıklama
          </label>
          <textarea id="eval-note" class="cyber-input" rows="3" placeholder="Tedarik durumu, kargo no, gerekçe veya ek açıklamalar..." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; box-sizing: border-box;"></textarea>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
              Karar Tarihi
            </label>
            <input type="date" id="eval-decision-date" value="${new Date().toISOString().split('T')[0]}" class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #10b981; font-weight: 700; font-size: 0.85rem; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
              Verilme (Teslim) Tarihi
            </label>
            <input type="date" id="eval-delivery-date" class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #60a5fa; font-weight: 700; font-size: 0.85rem; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            Değerlendiren Yetkili
          </label>
          <input type="text" id="eval-name" value="${evaluatorName}" class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; box-sizing: border-box;" />
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
        <button onclick="document.getElementById('evaluate-kkd-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.6rem 1.1rem; font-size:0.82rem; border-radius:6px; cursor:pointer;">İptal</button>
        <button id="btn-save-eval" onclick="window.saveKkdEvaluation('${reqId}')" class="btn-cyber" style="background:linear-gradient(135deg, #10B981 0%, #059669 100%); color:#FFF; font-weight:900; padding:0.6rem 1.3rem; font-size:0.82rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 12px rgba(16, 185, 129, 0.3);">
          <i class="fa-solid fa-check"></i> Kararı Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveKkdEvaluation = async (reqId: string) => {
  const decisionEl = document.getElementById('eval-decision') as HTMLSelectElement;
  const noteEl = document.getElementById('eval-note') as HTMLTextAreaElement;
  const decisionDateEl = document.getElementById('eval-decision-date') as HTMLInputElement;
  const deliveryDateEl = document.getElementById('eval-delivery-date') as HTMLInputElement;
  const nameEl = document.getElementById('eval-name') as HTMLInputElement;
  const saveBtn = document.getElementById('btn-save-eval') as HTMLButtonElement;

  const decision = decisionEl?.value as any;
  const note = noteEl?.value?.trim() || '';
  const decisionDate = decisionDateEl?.value || '';
  const deliveryDate = deliveryDateEl?.value || '';
  const evaluatorName = nameEl?.value?.trim() || 'İSG Sorumlusu';

  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
  }

  try {
    await isgService.updateKkdRequest(reqId, {
      status: decision,
      approvalInfo: {
        decision: decision === 'APPROVED' ? 'ONAYLANDI' : (decision === 'REJECTED' ? 'REDDEDİLDİ' : (decision === 'DELIVERED' ? 'ONAYLANDI' : 'ONAYLANDI')),
        note,
        decisionDate,
        deliveryDate: deliveryDate || undefined,
        evaluatorName,
        evaluatorRole: 'İSG Sorumlusu'
      }
    });

    (window as any).showToast?.('Başarılı', 'KKD talebi değerlendirmesi kaydedildi.', 'success');
    document.getElementById('evaluate-kkd-modal')?.remove();

    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + (err?.message || err));
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.innerHTML = '<i class="fa-solid fa-check"></i> Kararı Kaydet';
    }
  }
};

(window as any).deleteKkdRequest = async (id: string) => {
  if (!confirm("Bu KKD talebini silmek istediğinize emin misiniz?")) return;
  try {
    await isgService.deleteKkdRequest(id);
    (window as any).showToast?.('Bilgi', 'Talep silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Silme hatası: " + err);
  }
};

// ----------------------------------------------------------------------
// 4. RAMAK KALA & TEHLİKE BİLDİRİMİ MODALI
// ----------------------------------------------------------------------
(window as any).openCreateNearMissModal = () => {
  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const userName = userProfile?.displayName || currentUser?.displayName || '';
  const userSite = userProfile?.site || 'Alize Keltepe Depo';

  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}" ${s.name === userSite ? 'selected' : ''}>${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-near-miss-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10002; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 680px; max-height: 90vh; overflow-y: auto; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.4); background: #0A0E17; box-shadow: 0 25px 50px rgba(0,0,0,0.8);">
      
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.75rem;">
        <div>
          <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.4rem; color:#F59E0B; font-weight:800; display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-triangle-exclamation"></i> RAMAK KALA / TEHLİKE BİLDİRİMİ
          </h3>
          <span style="font-size:0.78rem; color:#94A3B8;">Olası bir kazayı önlemek amacıyla tehlikeli durum veya ramak kala olayını bildiriniz</span>
        </div>
        <button onclick="document.getElementById('create-near-miss-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.3rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        
        <!-- Santral & Lokasyon -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:800; text-transform:uppercase;">
              Santral / Saha <span style="color:#ef4444;">*</span>
            </label>
            <select id="nm-site" class="cyber-input" style="width:100%; padding:0.65rem; background:#0F172A; border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:800; text-transform:uppercase;">
              Türbin No / Lokasyon Detayı <span style="color:#ef4444;">*</span>
            </label>
            <input type="text" id="nm-location" placeholder="Örn: T-04 Kule İçi, Şalt Sahası, Yol..." class="cyber-input" style="width:100%; padding:0.65rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem; box-sizing: border-box;" />
          </div>
        </div>

        <!-- Tarih, Saat & Kategori -->
        <div style="display: grid; grid-template-columns: 140px 110px 1fr; gap: 10px;">
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:800; text-transform:uppercase;">
              Olay Tarihi <span style="color:#ef4444;">*</span>
            </label>
            <input type="date" id="nm-date" value="${new Date().toISOString().split('T')[0]}" class="cyber-input" style="width:100%; padding:0.65rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#10B981; font-size:0.85rem; font-weight:700; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:800; text-transform:uppercase;">
              Saat
            </label>
            <input type="time" id="nm-time" value="${new Date().toTimeString().slice(0, 5)}" class="cyber-input" style="width:100%; padding:0.65rem; background:rgba(0,0,0,0.4); border:1px solid #334155; border-radius:6px; color:#fff; font-size:0.85rem; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display:block; color:#94A3B8; font-size:0.75rem; margin-bottom:0.25rem; font-weight:800; text-transform:uppercase;">
              Tehlike Kategorisi <span style="color:#ef4444;">*</span>
            </label>
            <select id="nm-category" class="cyber-input" style="width:100%; padding:0.65rem; background:#0F172A; border:1px solid #334155; border-radius:6px; color:#F59E0B; font-weight:700; font-size:0.85rem;">
              <option value="YÜKSEKTE ÇALIŞMA">🧗 Yüksekte Çalışma & Düşme Tehlikesi</option>
              <option value="ELEKTRİK">⚡ Elektrik & Yüksek Gerilim</option>
              <option value="MEKANİK">⚙️ Mekanik / Sıkışma / Hareketli Parça</option>
              <option value="AĞIR YÜK / VİNÇ">🏗️ Vinç & Ağır Yük Kaldırma</option>
              <option value="HAVA ŞARTLARI">❄️ Hava Şartları / Yıldırım / Buz</option>
              <option value="ULAŞIM / ARAÇ">🚗 Saha İçi Ulaşım / Araç & Yol</option>
              <option value="KKD EKSİKLİĞİ">🦺 KKD Kullanımı & Emniyet Donanımı</option>
              <option value="DİĞER">Diğer</option>
            </select>
          </div>
        </div>

        <!-- Olay Açıklaması -->
        <div>
          <label style="display:block; color:#fff; font-size:0.8rem; margin-bottom:0.35rem; font-weight:800;">
            Olayın / Tehlikenin Açıklaması (Ne oldu? Ne olabilirdi?) <span style="color:#ef4444;">*</span>
          </label>
          <textarea id="nm-desc" class="cyber-input" rows="3" placeholder="Örn: Platform tırmanışında kılavuz halat tutucu takıldı, son anda fark edildi / Kule tabanında yağ birikintisi vardı, kayma tehlikesi atlatıldı..." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; resize: vertical; box-sizing: border-box;"></textarea>
        </div>

        <!-- Alınan / Önerilen Acil Önlem -->
        <div>
          <label style="display:block; color:#34d399; font-size:0.8rem; margin-bottom:0.35rem; font-weight:800;">
            Alınan / Önerilen Acil Önlem
          </label>
          <input type="text" id="nm-action" placeholder="Örn: Alan emniyet şeridiyle çevrildi, çalışma geçici olarak durduruldu..." class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; box-sizing: border-box;" />
        </div>

        <!-- Fotoğraf Ekleme -->
        <div style="background: rgba(15, 23, 42, 0.5); border: 1px dashed rgba(245, 158, 11, 0.3); border-radius: 8px; padding: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.75rem; color: #fbbf24; font-weight: 700;"><i class="fa-solid fa-camera"></i> Olay Yeri Fotoğrafı (Opsiyonel)</span>
            <button type="button" onclick="document.getElementById('nm-photo-input').click()" class="btn-cyber" style="background: rgba(245, 158, 11, 0.15); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4); padding: 3px 8px; border-radius: 5px; font-size: 0.72rem; cursor: pointer;">
              Fotoğraf Yükle
            </button>
          </div>
          <input type="file" id="nm-photo-input" accept="image/*" multiple style="display: none;" onchange="window.handleNearMissPhotoUpload(event)" />
          <div id="nm-photos-preview" style="display: flex; gap: 6px; flex-wrap: wrap; margin-top: 6px; min-height: 40px; align-items: center;">
            <span style="color: #64748b; font-size: 0.72rem; font-style: italic;">Fotoğraf seçilmedi.</span>
          </div>
        </div>

        <!-- Bildiren Personel & Anonim Seçeneği -->
        <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.02); padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
          <div>
            <span style="color: #94A3B8; font-size: 0.75rem;">Bildiren:</span>
            <strong style="color: #fff; font-size: 0.85rem; margin-left: 6px;">${userName}</strong>
          </div>
          <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; color: #fbbf24; font-size: 0.75rem; font-weight: 700;">
            <input type="checkbox" id="nm-is-anonymous" style="accent-color: #F59E0B;" />
            <span>İsmimi Gizle (Anonim Bildirim)</span>
          </label>
        </div>

      </div>

      <div style="display: flex; justify-content: flex-end; gap: 10px; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
        <button onclick="document.getElementById('create-near-miss-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: #fff; padding: 0.65rem 1.25rem; font-size: 0.85rem; border-radius: 6px; cursor: pointer;">
          İptal
        </button>
        <button id="btn-submit-near-miss" onclick="window.submitNearMissForm()" class="btn-cyber" style="background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color: #fff; font-weight: 800; padding: 0.65rem 1.5rem; font-size: 0.85rem; border-radius: 6px; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 0 15px rgba(245, 158, 11, 0.3);">
          <i class="fa-solid fa-paper-plane"></i> BİLDİRİMİ KAYDET
        </button>
      </div>

    </div>
  `;

  document.body.appendChild(modal);
  (window as any)._currentNearMissPhotos = [];
};

(window as any).handleNearMissPhotoUpload = async (event: any) => {
  const files: FileList = event.target.files;
  if (!files || files.length === 0) return;

  if (!(window as any)._currentNearMissPhotos) {
    (window as any)._currentNearMissPhotos = [];
  }

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const dataUrl = await fileService.uploadImage(file, 'near_miss', 800, 800, 0.7);
      (window as any)._currentNearMissPhotos.push(dataUrl);
    } catch (e) {
      console.error(e);
    }
  }

  const preview = document.getElementById('nm-photos-preview');
  if (preview) {
    const photos = (window as any)._currentNearMissPhotos || [];
    if (photos.length === 0) {
      preview.innerHTML = '<span style="color: #64748b; font-size: 0.72rem; font-style: italic;">Fotoğraf seçilmedi.</span>';
    } else {
      preview.innerHTML = photos.map((p: string) => `
        <img src="${p}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px; border: 1px solid #fbbf24;" />
      `).join('');
    }
  }
};

(window as any).submitNearMissForm = async () => {
  const siteEl = document.getElementById('nm-site') as HTMLSelectElement;
  const locEl = document.getElementById('nm-location') as HTMLInputElement;
  const dateEl = document.getElementById('nm-date') as HTMLInputElement;
  const timeEl = document.getElementById('nm-time') as HTMLInputElement;
  const catEl = document.getElementById('nm-category') as HTMLSelectElement;
  const descEl = document.getElementById('nm-desc') as HTMLTextAreaElement;
  const actEl = document.getElementById('nm-action') as HTMLInputElement;
  const anonEl = document.getElementById('nm-is-anonymous') as HTMLInputElement;
  const submitBtn = document.getElementById('btn-submit-near-miss') as HTMLButtonElement;

  const siteName = siteEl?.value || '';
  const locationDetail = (locEl?.value || '').trim();
  const incidentDate = dateEl?.value || new Date().toISOString().split('T')[0];
  const incidentTime = timeEl?.value || '';
  const category = catEl?.value || 'DİĞER';
  const description = (descEl?.value || '').trim();
  const immediateAction = (actEl?.value || '').trim();
  const isAnonymous = anonEl?.checked || false;

  if (!locationDetail) {
    alert("Lütfen türbin no veya lokasyon detayını belirtiniz.");
    locEl?.focus();
    return;
  }

  if (!description) {
    alert("Lütfen olayın / tehlikenin açıklamasını yazınız.");
    descEl?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Kaydediliyor...';
  }

  try {
    const allExisting = await isgService.getNearMissIncidents();
    const incidentNo = isgService.generateNextIncidentNo(allExisting);
    const currentUser = (window as any).currentUser || authService.getCurrentUser();
    const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
    const userName = userProfile?.displayName || currentUser?.displayName || currentUser?.email || 'Personel';

    await isgService.createNearMissIncident({
      incidentNo,
      siteName,
      locationDetail,
      incidentDate,
      incidentTime,
      category,
      description,
      immediateAction,
      photos: (window as any)._currentNearMissPhotos || [],
      reportedBy: userName,
      isAnonymous,
      status: 'REPORTED'
    });

    (window as any).showToast?.('Başarılı', `${incidentNo} numaralı ramak kala bildirimi kaydedildi.`, 'success');
    document.getElementById('create-near-miss-modal')?.remove();

    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + (err?.message || err));
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> BİLDİRİMİ KAYDET';
    }
  }
};

// ----------------------------------------------------------------------
// 5. RAMAK KALA İNCELEME & DÖF KAPATMA MODALI
// ----------------------------------------------------------------------
(window as any).openNearMissActionModal = async (incId: string) => {
  const allInc = await isgService.getNearMissIncidents();
  const inc = allInc.find(i => i.id === incId);
  if (!inc) return;

  const modal = document.createElement('div');
  modal.id = 'near-miss-action-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px); 
    z-index: 10005; display: flex; align-items: center; justify-content: center; padding: 1rem; box-sizing: border-box;
  `;

  modal.innerHTML = `
    <div class="glass-panel fade-in-up" style="width: 100%; max-width: 520px; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(245, 158, 11, 0.4); background: #0A0E17; box-shadow: 0 20px 40px rgba(0,0,0,0.8);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:0.75rem;">
        <h3 style="margin:0; font-family:'Rajdhani', sans-serif; font-size:1.3rem; color:#F59E0B; font-weight:800; display:flex; align-items:center; gap:8px;">
          <i class="fa-solid fa-shield-halved"></i> İSG İNCELEME & DÖF AKSİYONU
        </h3>
        <button onclick="document.getElementById('near-miss-action-modal').remove()" style="background:transparent; border:none; color:#94A3B8; cursor:pointer; font-size:1.2rem;"><i class="fa-solid fa-xmark"></i></button>
      </div>

      <div style="font-size: 0.84rem; color: #CBD5E1; margin-bottom: 1rem; background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px;">
        <div style="color: #F59E0B; font-weight: 800; margin-bottom: 2px;">${inc.incidentNo} - ${inc.siteName} (${inc.locationDetail})</div>
        <div style="font-size: 0.78rem; color: #94A3B8;">${inc.description}</div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.5rem;">
        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            İSG Durumu
          </label>
          <select id="nm-action-status" class="cyber-input" style="width: 100%; padding: 0.75rem; background: #0F172A; border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.9rem; font-weight: 700;">
            <option value="INVESTIGATING" ${inc.status === 'INVESTIGATING' ? 'selected' : ''}>🔍 İncelemede</option>
            <option value="ACTION_TAKEN" ${inc.status === 'ACTION_TAKEN' ? 'selected' : ''}>📋 DÖF Başlatıldı (Aksiyon Alınıyor)</option>
            <option value="CLOSED" ${inc.status === 'CLOSED' ? 'selected' : ''}>✅ Kapatıldı (Önlem Tamamlandı)</option>
          </select>
        </div>

        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            DÖF Numarası (Varsa)
          </label>
          <input type="text" id="nm-action-dof" value="${inc.dofNo || ''}" placeholder="Örn: DÖF-2026-014" class="cyber-input" style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; box-sizing: border-box;" />
        </div>

        <div>
          <label style="display:block; color:#94A3B8; font-size:0.78rem; margin-bottom:0.35rem; font-weight:800; text-transform:uppercase;">
            İSG İnceleme Notu & Alınan Kalıcı Önlem
          </label>
          <textarea id="nm-action-notes" class="cyber-input" rows="3" placeholder="Saha incelemesi, tedbirler, personele verilen bilgilendirme..." style="width: 100%; padding: 0.75rem; background: rgba(0,0,0,0.45); border: 1px solid #334155; border-radius: 8px; color: #fff; font-size: 0.85rem; box-sizing: border-box;">${inc.investigationNotes || ''}</textarea>
        </div>
      </div>

      <div style="display:flex; justify-content:flex-end; gap:0.75rem;">
        <button onclick="document.getElementById('near-miss-action-modal').remove()" class="btn-cyber" style="background:rgba(255,255,255,0.05); color:#FFF; font-weight:700; padding:0.6rem 1.1rem; font-size:0.82rem; border-radius:6px; cursor:pointer;">İptal</button>
        <button id="btn-save-nm-action" onclick="window.saveNearMissAction('${incId}')" class="btn-cyber" style="background:linear-gradient(135deg, #F59E0B 0%, #D97706 100%); color:#FFF; font-weight:900; padding:0.6rem 1.3rem; font-size:0.82rem; border-radius:6px; cursor:pointer; border:none; box-shadow:0 0 12px rgba(245, 158, 11, 0.3);">
          <i class="fa-solid fa-check"></i> Aksiyonu Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNearMissAction = async (incId: string) => {
  const statusEl = document.getElementById('nm-action-status') as HTMLSelectElement;
  const dofEl = document.getElementById('nm-action-dof') as HTMLInputElement;
  const notesEl = document.getElementById('nm-action-notes') as HTMLTextAreaElement;

  const status = statusEl?.value as any;
  const dofNo = dofEl?.value?.trim() || undefined;
  const investigationNotes = notesEl?.value?.trim() || undefined;

  const currentUser = (window as any).currentUser || authService.getCurrentUser();

  try {
    await isgService.updateNearMissIncident(incId, {
      status,
      dofNo,
      dofOpened: !!dofNo,
      investigationNotes,
      closedAt: status === 'CLOSED' ? new Date().toISOString() : undefined,
      closedBy: status === 'CLOSED' ? (currentUser?.displayName || currentUser?.email) : undefined
    });

    (window as any).showToast?.('Başarılı', 'İSG aksiyon kaydı güncellendi.', 'success');
    document.getElementById('near-miss-action-modal')?.remove();

    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 6. RAMAK KALA RESMİ TUTANAK YAZDIRMA
// ----------------------------------------------------------------------
(window as any).printNearMissReport = async (incId: string) => {
  const allInc = await isgService.getNearMissIncidents();
  const inc = allInc.find(i => i.id === incId);
  if (!inc) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const photoHtml = (inc.photos || []).map(p => `
    <div style="border: 1px solid #ccc; padding: 4px; display: inline-block; margin: 4px;">
      <img src="${p}" style="max-height: 180px; max-width: 240px; object-fit: contain;" />
    </div>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${inc.incidentNo} - Ramak Kala Olay Tutanağı</title>
      <style>
        @page { size: A4 portrait; margin: 12mm 15mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 0; }
        .table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .table th, .table td { border: 1px solid #000; padding: 6px 8px; font-size: 9pt; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #e2e8f0; border-radius: 6px; display: flex; justify-content: space-between; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="no-print">
        <span style="font-weight: bold;">Ramak Kala Tutanağı Önizleme</span>
        <button onclick="window.print()" style="background: #f59e0b; color: #fff; border: none; padding: 6px 16px; border-radius: 4px; font-weight: bold; cursor: pointer;">
          Yazdır / PDF
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 8px;">
        <div style="display: inline-flex; align-items: center; gap: 6px;">
          <div style="border: 2px solid #000; padding: 2px 6px; font-weight: 900; font-size: 16px;">dh</div>
          <div style="font-weight: bold; font-size: 12px;">DEMİRER HOLDİNG</div>
        </div>
        <div style="font-weight: 900; font-size: 14pt; text-align: center;">
          RAMAK KALA & TEHLİKE BİLDİRİM TUTANAĞI
        </div>
        <div style="text-align: right; font-size: 9pt;">
          <strong>No:</strong> ${inc.incidentNo}<br>
          <strong>Tarih:</strong> ${formatDate(inc.incidentDate)}
        </div>
      </div>

      <table class="table">
        <tr>
          <th style="width: 25%; background: #f8fafc;">Santral / Saha Adı</th>
          <td style="width: 25%;">${inc.siteName}</td>
          <th style="width: 25%; background: #f8fafc;">Lokasyon / Türbin</th>
          <td style="width: 25%;">${inc.locationDetail}</td>
        </tr>
        <tr>
          <th style="background: #f8fafc;">Olay Tarihi ve Saati</th>
          <td>${formatDate(inc.incidentDate)} ${inc.incidentTime || ''}</td>
          <th style="background: #f8fafc;">Tehlike Kategorisi</th>
          <td><strong>${inc.category}</strong></td>
        </tr>
        <tr>
          <th style="background: #f8fafc;">Bildiren Personel</th>
          <td>${inc.isAnonymous ? 'Anonim' : inc.reportedBy}</td>
          <th style="background: #f8fafc;">Mevcut İSG Durumu</th>
          <td><strong>${inc.status}</strong></td>
        </tr>
        <tr>
          <th style="background: #f8fafc;">Olay / Tehlike Detayı</th>
          <td colspan="3" style="padding: 10px; line-height: 1.5;">${inc.description}</td>
        </tr>
        <tr>
          <th style="background: #f8fafc;">Alınan Acil Önlem</th>
          <td colspan="3" style="padding: 10px; line-height: 1.5; color: #059669;"><strong>${inc.immediateAction || 'Belirtilmedi'}</strong></td>
        </tr>
        ${inc.investigationNotes ? `
          <tr>
            <th style="background: #f8fafc;">İSG İnceleme & DÖF Notu</th>
            <td colspan="3" style="padding: 10px; line-height: 1.5;">
              ${inc.dofNo ? `<strong>DÖF No:</strong> ${inc.dofNo}<br>` : ''}
              ${inc.investigationNotes}
            </td>
          </tr>
        ` : ''}
      </table>

      ${photoHtml ? `
        <div style="margin-top: 15px; border: 1px solid #000; padding: 8px;">
          <div style="font-weight: bold; font-size: 9pt; margin-bottom: 4px;">Olay Yeri Görselleri:</div>
          ${photoHtml}
        </div>
      ` : ''}

      <div style="margin-top: 50px; display: flex; justify-content: space-between;">
        <div style="text-align: center; width: 40%; border-top: 1px solid #000; padding-top: 6px;">
          <strong>Bildiren Personel</strong><br>
          <span style="font-size: 8.5pt;">${inc.isAnonymous ? 'İmza Gerekmez (Anonim)' : inc.reportedBy}</span>
        </div>
        <div style="text-align: center; width: 40%; border-top: 1px solid #000; padding-top: 6px;">
          <strong>İSG Sorumlusu / Saha Şefi</strong><br>
          <span style="font-size: 8.5pt;">İsim - İmza</span>
        </div>
      </div>
    </body>
    </html>
  `);

  printWindow.document.close();
};

// ----------------------------------------------------------------------
// 7. KİMYASAL & MSDS METOTLARI
// ----------------------------------------------------------------------
(window as any).filterMsdsSearch = (query: string) => {
  const q = (query || '').toLowerCase().trim();
  const cards = document.querySelectorAll('.msds-card') as NodeListOf<HTMLElement>;
  cards.forEach(card => {
    const searchData = card.getAttribute('data-search') || '';
    if (!q || searchData.includes(q)) {
      card.style.display = 'flex';
    } else {
      card.style.display = 'none';
    }
  });
};

(window as any).viewOrDownloadMsds = async (id: string, name: string) => {
  const allMsds = await isgService.getMsdsList();
  const item = allMsds.find(m => m.id === id);

  const modal = document.createElement('div');
  modal.id = 'view-msds-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(6, 182, 212, 0.3); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <span style="font-size: 0.72rem; color: #06b6d4; font-weight: 800; text-transform: uppercase;">${item?.brand || 'Ürün Güvenlik Formu'}</span>
          <h3 style="margin: 2px 0 0 0; font-size: 1.25rem; font-weight: 900; color: #fff;">${item?.productName || name}</h3>
        </div>
        <button onclick="document.getElementById('view-msds-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem; font-size: 0.82rem; margin-bottom: 1.5rem;">
        <div style="background: rgba(255,255,255,0.03); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06);">
          <div style="color: #94a3b8; font-size: 0.72rem; font-weight: 700; text-transform: uppercase;">Kullanım Sahası</div>
          <div style="color: #e2e8f0; font-weight: 700; margin-top: 2px;">${item?.usageArea || 'Genel Saha Bakımı'}</div>
        </div>

        <div style="background: rgba(239, 68, 68, 0.08); padding: 0.75rem; border-radius: 8px; border: 1px solid rgba(239, 68, 68, 0.2);">
          <div style="color: #f87171; font-weight: 800; font-size: 0.75rem; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <i class="fa-solid fa-kit-medical"></i> İLK YARDIM MÜDAHALE PROTOKOLÜ
          </div>
          <div style="line-height: 1.5; color: #cbd5e1;">
            <div><strong>Göz Teması:</strong> ${item?.firstAidEyes || 'Bol su ile en az 15 dk yıkayın.'}</div>
            <div><strong>Cilt Teması:</strong> ${item?.firstAidSkin || 'Sabun ve bol su ile yıkayın.'}</div>
            <div><strong>Soluma:</strong> ${item?.firstAidInhalation || 'Açık temiz havaya çıkarın.'}</div>
            <div><strong>Yutma:</strong> ${item?.firstAidIngestion || 'Kusturmayın, hekime başvurun.'}</div>
          </div>
        </div>

        ${item?.fileUrl ? `
          <div style="text-align: center; margin-top: 0.5rem;">
            <a href="${item.fileUrl}" target="_blank" download="${item.fileName || 'msds.pdf'}" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; padding: 0.7rem 1.4rem; border-radius: 8px; font-weight: 800; text-decoration: none;">
              <i class="fa-solid fa-file-pdf"></i> Resmi PDF Belgesini İndir / Görüntüle
            </a>
          </div>
        ` : `
          <div style="text-align: center; color: var(--text-muted); font-size: 0.75rem; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 6px;">
            <i class="fa-solid fa-info-circle"></i> Bu kimyasala ait dijital PDF arşivi İSG birimi tarafından onaylıdır.
          </div>
        `}
      </div>

      <div style="display: flex; justify-content: flex-end;">
        <button onclick="document.getElementById('view-msds-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.82rem;">
          Kapat
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).openCreateMsdsModal = () => {
  const modal = document.createElement('div');
  modal.id = 'create-msds-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(6, 182, 212, 0.4); border-radius: 16px; width: 92%; max-width: 600px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-flask-vial" style="color: #06b6d4;"></i> Yeni MSDS / Kimyasal Ekle
        </h3>
        <button onclick="document.getElementById('create-msds-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Ürün Ticari Adı *</label>
            <input type="text" id="new-msds-name" placeholder="Örn: Mobil SHC Gear 320" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Marka / Üretici *</label>
            <input type="text" id="new-msds-brand" placeholder="Örn: ExxonMobil" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kategori *</label>
            <select id="new-msds-category" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="YAG">Yağ (Dişli, Hidrolik vb.)</option>
              <option value="GRES">Gres Yağı</option>
              <option value="SOLVENT">Solvent / Temizleyici</option>
              <option value="YAPISTIRICI">Yapıştırıcı / Reçine</option>
              <option value="BOYA">Boya / Astar</option>
              <option value="DIGER">Diğer Kimyasal</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kullanım Sahası / Bölge</label>
            <input type="text" id="new-msds-area" placeholder="Örn: Dişli Kutusu, Yaw Freni" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 6px;">GHS Tehlike Sembolleri (Piktogramlar)</label>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; background: rgba(0,0,0,0.3); padding: 0.65rem; border-radius: 8px;">
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="flammable" /> 🔥 Alevlenir
            </label>
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="toxic" /> ☠️ Toksik
            </label>
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="corrosive" /> 🧪 Korozif
            </label>
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="environment" /> 🌲 Çevreye Zararlı
            </label>
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="health_hazard" /> 🫁 Sağlık Hasarı
            </label>
            <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 0.78rem; cursor: pointer;">
              <input type="checkbox" name="msds-pic" value="irritant" checked /> ⚠️ Tahriş Edici
            </label>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">İlk Yardım: Göz Teması</label>
            <input type="text" id="new-msds-eyes" placeholder="Bol suyla yıkayın..." class="cyber-input" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">İlk Yardım: Cilt Teması</label>
            <input type="text" id="new-msds-skin" placeholder="Sabunlu suyla yıkayın..." class="cyber-input" style="width: 100%; padding: 0.6rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">MSDS PDF Belgesi Yükle (İsteğe Bağlı)</label>
          <input type="file" id="new-msds-file" accept=".pdf" style="font-size: 0.8rem; color: #94a3b8;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-msds-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewMsds()" class="btn-cyber" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Kimyasalı Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewMsds = async () => {
  const nameEl = document.getElementById('new-msds-name') as HTMLInputElement;
  const brandEl = document.getElementById('new-msds-brand') as HTMLInputElement;
  const catEl = document.getElementById('new-msds-category') as HTMLSelectElement;
  const areaEl = document.getElementById('new-msds-area') as HTMLInputElement;
  const eyesEl = document.getElementById('new-msds-eyes') as HTMLInputElement;
  const skinEl = document.getElementById('new-msds-skin') as HTMLInputElement;
  const fileEl = document.getElementById('new-msds-file') as HTMLInputElement;

  const productName = nameEl?.value?.trim();
  const brand = brandEl?.value?.trim();
  if (!productName || !brand) {
    alert("Lütfen ürün adı ve üretici marka bilgisini doldurun.");
    return;
  }

  const picEls = document.querySelectorAll('input[name="msds-pic"]:checked') as NodeListOf<HTMLInputElement>;
  const pictograms = Array.from(picEls).map(el => el.value);

  let fileUrl: string | undefined = undefined;
  let fileName: string | undefined = undefined;

  if (fileEl && fileEl.files && fileEl.files[0]) {
    const file = fileEl.files[0];
    fileName = file.name;
    try {
      fileUrl = await fileService.uploadFile(file, `isg/msds/${Date.now()}_${file.name}`);
    } catch {
      // Fallback
    }
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();

  try {
    await isgService.createMsds({
      productName,
      brand,
      category: catEl?.value || 'YAG',
      usageArea: areaEl?.value?.trim() || 'Genel Bakım Sahası',
      pictograms,
      firstAidEyes: eyesEl?.value?.trim() || undefined,
      firstAidSkin: skinEl?.value?.trim() || undefined,
      fileUrl,
      fileName,
      uploadedBy: currentUser?.displayName || currentUser?.email
    });

    (window as any).showToast?.('Başarılı', 'Yeni MSDS formu kütüphaneye eklendi.', 'success');
    document.getElementById('create-msds-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteMsdsRecord = async (id: string) => {
  if (!confirm("Bu kimyasal MSDS kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteMsds(id);
    (window as any).showToast?.('Silindi', 'MSDS kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 8. İSG TALİMAT & DOKÜMAN METOTLARI
// ----------------------------------------------------------------------
(window as any).viewOrDownloadDoc = async (id: string, title: string) => {
  const allDocs = await isgService.getDocuments();
  const docItem = allDocs.find(d => d.id === id);

  const modal = document.createElement('div');
  modal.id = 'view-doc-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <span style="font-size: 0.72rem; color: #a855f7; font-weight: 800; font-family: monospace;">${docItem?.docCode || 'DH-TL-ISG'}</span>
          <h3 style="margin: 2px 0 0 0; font-size: 1.2rem; font-weight: 900; color: #fff;">${docItem?.title || title}</h3>
        </div>
        <button onclick="document.getElementById('view-doc-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="background: rgba(255,255,255,0.03); padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); font-size: 0.82rem; line-height: 1.5; color: #cbd5e1; margin-bottom: 1.5rem;">
        <div style="display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.75rem;">
          <span style="color: #94a3b8;">Revizyon: <strong>${docItem?.revisionNo || '001'}</strong></span>
          <span style="color: #94a3b8;">Tarih: <strong>${docItem?.revisionDate || '-'}</strong></span>
        </div>
        <p style="margin: 6px 0 0 0; color: #e2e8f0;">${docItem?.description || 'Demirer Holding resmi İş Sağlığı ve Güvenliği talimatnamesi.'}</p>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center;">
        ${docItem?.fileUrl ? `
          <a href="${docItem.fileUrl}" target="_blank" download="${docItem.fileName || 'talimat.pdf'}" class="btn-cyber" style="display: inline-flex; align-items: center; gap: 8px; background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: #fff; padding: 0.65rem 1.3rem; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 0.82rem;">
            <i class="fa-solid fa-file-pdf"></i> Resmi PDF'yi İndir / Aç
          </a>
        ` : `
          <span style="color: #94a3b8; font-size: 0.75rem;"><i class="fa-solid fa-file-check"></i> Sistemde Onaylıdır</span>
        `}

        <button onclick="document.getElementById('view-doc-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.15); padding: 0.6rem 1.2rem; border-radius: 6px; cursor: pointer; font-weight: 700; font-size: 0.82rem;">
          Kapat
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).openCreateDocModal = () => {
  const modal = document.createElement('div');
  modal.id = 'create-doc-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(168, 85, 247, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-file-shield" style="color: #a855f7;"></i> Yeni İSG Talimatı / Prosedürü
        </h3>
        <button onclick="document.getElementById('create-doc-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Doküman Kodu *</label>
            <input type="text" id="new-doc-code" placeholder="Örn: DH-TL-ISG-005" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kategori</label>
            <select id="new-doc-cat" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="YUKSEKTE_CALISMA">Yüksekte Çalışma</option>
              <option value="KAPALI_ALAN">Kapalı Alan</option>
              <option value="ELEKTRIK">Elektrik & EKAT</option>
              <option value="ACIL_DURUM">Acil Durum & Tahliye</option>
              <option value="GENEL_ISG">Genel Saha İSG</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Doküman / Talimat Başlığı *</label>
          <input type="text" id="new-doc-title" placeholder="Örn: Rüzgar Türbinlerinde Yangın Güvenliği Talimatı" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Revizyon No</label>
            <input type="text" id="new-doc-rev" value="001" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Revizyon Tarihi</label>
            <input type="text" id="new-doc-date" value="${new Date().toLocaleDateString('tr-TR')}" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kısa Açıklama / Kapsam</label>
          <textarea id="new-doc-desc" class="cyber-input" rows="2" placeholder="Dokümanın amacı, kapsamı ve saha talimatları..." style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">PDF Belgesi Yükle (İsteğe Bağlı)</label>
          <input type="file" id="new-doc-file" accept=".pdf" style="font-size: 0.8rem; color: #94a3b8;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-doc-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewDoc()" class="btn-cyber" style="background: linear-gradient(135deg, #a855f7 0%, #7e22ce 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Dokümanı Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewDoc = async () => {
  const codeEl = document.getElementById('new-doc-code') as HTMLInputElement;
  const titleEl = document.getElementById('new-doc-title') as HTMLInputElement;
  const catEl = document.getElementById('new-doc-cat') as HTMLSelectElement;
  const revEl = document.getElementById('new-doc-rev') as HTMLInputElement;
  const dateEl = document.getElementById('new-doc-date') as HTMLInputElement;
  const descEl = document.getElementById('new-doc-desc') as HTMLTextAreaElement;
  const fileEl = document.getElementById('new-doc-file') as HTMLInputElement;

  const docCode = codeEl?.value?.trim();
  const title = titleEl?.value?.trim();
  if (!docCode || !title) {
    alert("Lütfen doküman kodu ve başlığını giriniz.");
    return;
  }

  let fileUrl: string | undefined = undefined;
  let fileName: string | undefined = undefined;

  if (fileEl && fileEl.files && fileEl.files[0]) {
    const file = fileEl.files[0];
    fileName = file.name;
    try {
      fileUrl = await fileService.uploadFile(file, `isg/documents/${Date.now()}_${file.name}`);
    } catch {}
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();

  try {
    await isgService.createDocument({
      docCode,
      title,
      category: catEl?.value || 'GENEL_ISG',
      revisionNo: revEl?.value?.trim() || '001',
      revisionDate: dateEl?.value?.trim() || new Date().toLocaleDateString('tr-TR'),
      description: descEl?.value?.trim() || undefined,
      fileUrl,
      fileName,
      uploadedBy: currentUser?.displayName || currentUser?.email
    });

    (window as any).showToast?.('Başarılı', 'İSG Talimatı kütüphaneye kaydedildi.', 'success');
    document.getElementById('create-doc-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteDocRecord = async (id: string) => {
  if (!confirm("Bu talimat / doküman kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteDocument(id);
    (window as any).showToast?.('Silindi', 'Doküman kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 9. SERTİFİKA & SAĞLIK TAKİBİ METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateCertModal = () => {
  const modal = document.createElement('div');
  modal.id = 'create-cert-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(236, 72, 153, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-id-card" style="color: #ec4899;"></i> Yeni Sertifika & Sağlık Belgesi Ekle
        </h3>
        <button onclick="document.getElementById('create-cert-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Personel Adı Soyadı *</label>
            <input type="text" id="new-cert-person" placeholder="Örn: Furkan Yıldırım" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Ekip / Bölge</label>
            <input type="text" id="new-cert-team" placeholder="Örn: Team 01 (Keltepe)" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Belge Türü</label>
            <select id="new-cert-type" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="GWO_BST">GWO - Temel Güvenlik Eğitimi (BST)</option>
              <option value="SAGLIK_EK2">Sağlık Raporu (EK-2 Ağır İş)</option>
              <option value="EKAT">EKAT (Kuvvetli Akım Yetki)</option>
              <option value="ILKYARDIM">İlkyardımcı Belgesi</option>
              <option value="YUKSEKTE_CALISMA">Yüksekte Çalışma ve Kurtarma</option>
              <option value="DIGER">Diğer Mesleki Belge</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Sertifika / Belge No</label>
            <input type="text" id="new-cert-no" placeholder="Örn: GWO-TR-2025-102" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Veriliş Tarihi</label>
            <input type="date" id="new-cert-issue" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Bitiş / Yenileme Tarihi *</label>
            <input type="date" id="new-cert-expiry" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Notlar / Kapsam Detayları</label>
          <input type="text" id="new-cert-notes" placeholder="Örn: 4 modül tamamlandı, yenileme hatırlatıldı..." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-cert-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewCert()" class="btn-cyber" style="background: linear-gradient(135deg, #ec4899 0%, #db2777 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Sertifikayı Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewCert = async () => {
  const personEl = document.getElementById('new-cert-person') as HTMLInputElement;
  const teamEl = document.getElementById('new-cert-team') as HTMLInputElement;
  const typeEl = document.getElementById('new-cert-type') as HTMLSelectElement;
  const noEl = document.getElementById('new-cert-no') as HTMLInputElement;
  const issueEl = document.getElementById('new-cert-issue') as HTMLInputElement;
  const expiryEl = document.getElementById('new-cert-expiry') as HTMLInputElement;
  const notesEl = document.getElementById('new-cert-notes') as HTMLInputElement;

  const personnelName = personEl?.value?.trim();
  const expiryDate = expiryEl?.value?.trim();
  if (!personnelName || !expiryDate) {
    alert("Lütfen personel adı ve bitiş tarihini giriniz.");
    return;
  }

  // Format date from YYYY-MM-DD to DD.MM.YYYY
  const formatIsoToTr = (iso: string) => {
    if (!iso) return '-';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return iso;
  };

  const currentUser = (window as any).currentUser || authService.getCurrentUser();

  try {
    await isgService.createCert({
      personnelName,
      teamName: teamEl?.value?.trim() || 'Saha Ekibi',
      certType: typeEl?.value || 'GWO_BST',
      certNo: noEl?.value?.trim() || '-',
      issueDate: formatIsoToTr(issueEl?.value) || '-',
      expiryDate: formatIsoToTr(expiryDate),
      notes: notesEl?.value?.trim() || undefined,
      uploadedBy: currentUser?.displayName || currentUser?.email
    });

    (window as any).showToast?.('Başarılı', 'Personel sertifika takibi kaydedildi.', 'success');
    document.getElementById('create-cert-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteCertRecord = async (id: string) => {
  if (!confirm("Bu sertifika takip kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteCert(id);
    (window as any).showToast?.('Silindi', 'Sertifika kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 10. SAHA İSG DENETİMLERİ (AUDITS) METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateAuditModal = () => {
  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const auditorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Sercan Yetgin';

  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-audit-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(59, 130, 246, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.25rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-clipboard-check" style="color: #3b82f6;"></i> Yeni Saha İSG Denetimi Kaydet
        </h3>
        <button onclick="document.getElementById('create-audit-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Santral / Saha Adı *</label>
            <select id="new-audit-site" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Denetçi Adı</label>
            <input type="text" id="new-audit-auditor" value="${auditorName}" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Denetim Puanı (% 0-100) *</label>
            <input type="number" id="new-audit-score" min="0" max="100" value="90" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Denetim Durumu</label>
            <select id="new-audit-status" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="COMPLETED">TAMAMLANDI (Uygun)</option>
              <option value="ACTION_REQUIRED">AKSİYON GEREKLİ (Bulgu Var)</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Bulgu / Uygunsuzluk Sayısı</label>
          <input type="number" id="new-audit-findings" min="0" value="0" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Saha Denetim Notları & Tespitler</label>
          <textarea id="new-audit-notes" class="cyber-input" rows="3" placeholder="Kule içi tırmanma hatları, ambar düzeni, acil çıkışlar ve KKD kullanım durumları..." style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-audit-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewAudit()" class="btn-cyber" style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Denetimi Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewAudit = async () => {
  const siteEl = document.getElementById('new-audit-site') as HTMLSelectElement;
  const auditorEl = document.getElementById('new-audit-auditor') as HTMLInputElement;
  const scoreEl = document.getElementById('new-audit-score') as HTMLInputElement;
  const statusEl = document.getElementById('new-audit-status') as HTMLSelectElement;
  const findingsEl = document.getElementById('new-audit-findings') as HTMLInputElement;
  const notesEl = document.getElementById('new-audit-notes') as HTMLTextAreaElement;

  const siteName = siteEl?.value;
  const auditorName = auditorEl?.value?.trim() || 'İSG Uzmanı';
  const score = parseInt(scoreEl?.value || '100', 10);
  const findingsCount = parseInt(findingsEl?.value || '0', 10);
  const status = (statusEl?.value as any) || 'COMPLETED';
  const notes = notesEl?.value?.trim();

  const auditNo = `DNT-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const auditDate = new Date().toLocaleDateString('tr-TR');

  try {
    await isgService.createAudit({
      auditNo,
      siteName,
      auditorName,
      auditDate,
      score,
      findingsCount,
      status,
      notes
    });

    (window as any).showToast?.('Başarılı', 'Saha İSG denetim tutanağı kaydedildi.', 'success');
    document.getElementById('create-audit-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteAuditRecord = async (id: string) => {
  if (!confirm("Bu denetim kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteAudit(id);
    (window as any).showToast?.('Silindi', 'Denetim kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 11. TABLO FİLTRELEME YARDIMCILARI
// ----------------------------------------------------------------------
(window as any).filterCertTable = (filter: 'ALL' | 'DRIVER' | 'EXPIRED') => {
  const rows = document.querySelectorAll<HTMLTableRowElement>('#cert-table .cert-row');
  rows.forEach(row => {
    const type = row.getAttribute('data-type') || '';
    const isExpired = row.getAttribute('data-expired') === 'true';
    const isDriver = type.includes('SRC') || type.includes('PSIKO');

    if (filter === 'ALL') {
      row.style.display = '';
    } else if (filter === 'DRIVER') {
      row.style.display = isDriver ? '' : 'none';
    } else if (filter === 'EXPIRED') {
      row.style.display = isExpired ? '' : 'none';
    }
  });
};

(window as any).filterInventoryCategory = (category: string) => {
  const rows = document.querySelectorAll<HTMLTableRowElement>('#isg-inventory-table .inv-row');
  rows.forEach(row => {
    const cat = row.getAttribute('data-cat') || '';
    const isCritical = row.getAttribute('data-critical') === 'true';

    if (category === 'ALL') {
      row.style.display = '';
    } else if (category === 'CRITICAL') {
      row.style.display = isCritical ? '' : 'none';
    } else {
      row.style.display = cat === category ? '' : 'none';
    }
  });

  // Buton aktiflik sınıflarını güncelle
  document.querySelectorAll('.inv-filter-btn').forEach(btn => {
    if (btn.getAttribute('data-cat') === category) {
      btn.classList.add('active');
      (btn as HTMLElement).style.borderColor = '#06b6d4';
    } else {
      btn.classList.remove('active');
      (btn as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)';
    }
  });
};

// ----------------------------------------------------------------------
// 12. İSG & KKD YEDEK DEPO VE STOK YÖNETİMİ METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateInventoryModal = () => {
  const modal = document.createElement('div');
  modal.id = 'create-inventory-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(6, 182, 212, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-boxes-stacked" style="color: #06b6d4;"></i> Yeni KKD / Ekipman Stok Kartı Tanımla
        </h3>
        <button onclick="document.getElementById('create-inventory-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Malzeme Adı / Standardı *</label>
          <input type="text" id="new-inv-name" placeholder="Örn: S3 Emniyet Botu (EN ISO 20345) veya Kışlık İş Montu" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kategori *</label>
            <select id="new-inv-cat" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="AYAKKABI">👟 Ayakkabı / Bot</option>
              <option value="KIYAFET">🧥 İş Kıyafeti / Mont / Polar</option>
              <option value="YUKSEKTE_CALISMA">🧗 Yüksekte Çalışma Donanımı</option>
              <option value="BARET">⛑️ Baret</option>
              <option value="ELDIVEN">🧤 Eldiven</option>
              <option value="GOZLUK_MASKE">🥽 Gözlük & Maske</option>
              <option value="ILKYARDIM_CEVRE">🩹 İlk Yardım & Çevre Kiti</option>
              <option value="DIGER">📦 Diğer Donanım</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Beden / Numara</label>
            <input type="text" id="new-inv-size" placeholder="Örn: 42, 43, L, XL veya Standart" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #f59e0b; font-weight: 700; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Başlangıç Stoğu *</label>
            <input type="number" id="new-inv-stock" min="0" value="5" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #10b981; font-weight: 800; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kritik Eşik (Min) *</label>
            <input type="number" id="new-inv-min" min="0" value="2" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #ef4444; font-weight: 800; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Birim</label>
            <select id="new-inv-unit" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="Adet">Adet</option>
              <option value="Çift">Çift</option>
              <option value="Takım">Takım</option>
              <option value="Kutu">Kutu</option>
              <option value="Set">Set</option>
            </select>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Saklandığı Yer / Dolap / Raf *</label>
          <input type="text" id="new-inv-location" placeholder="Örn: Merkez İSG Deposu - Raf A2 veya Keltepe Dolap 1" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Açıklama / Standart Notları</label>
          <input type="text" id="new-inv-notes" placeholder="Örn: CE EN ISO 20345 standartlarında, kışlık su geçirmez." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; box-sizing: border-box;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-inventory-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewInventoryItem()" class="btn-cyber" style="background: linear-gradient(135deg, #06b6d4 0%, #0891b2 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Stok Kartını Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewInventoryItem = async () => {
  const nameEl = document.getElementById('new-inv-name') as HTMLInputElement;
  const catEl = document.getElementById('new-inv-cat') as HTMLSelectElement;
  const sizeEl = document.getElementById('new-inv-size') as HTMLInputElement;
  const stockEl = document.getElementById('new-inv-stock') as HTMLInputElement;
  const minEl = document.getElementById('new-inv-min') as HTMLInputElement;
  const unitEl = document.getElementById('new-inv-unit') as HTMLSelectElement;
  const locEl = document.getElementById('new-inv-location') as HTMLInputElement;
  const notesEl = document.getElementById('new-inv-notes') as HTMLInputElement;

  const name = nameEl?.value?.trim();
  if (!name) {
    alert("Lütfen malzeme adını giriniz.");
    return;
  }

  const category = (catEl?.value as any) || 'DIGER';
  const size = sizeEl?.value?.trim() || 'Standart';
  const currentStock = parseInt(stockEl?.value || '0', 10);
  const minThreshold = parseInt(minEl?.value || '0', 10);
  const unit = (unitEl?.value as any) || 'Adet';
  const storageLocation = locEl?.value?.trim() || 'Merkez İSG Deposu';
  const notes = notesEl?.value?.trim();

  try {
    await isgService.createInventoryItem({
      name,
      category,
      size,
      currentStock,
      minThreshold,
      unit,
      storageLocation,
      notes
    });

    (window as any).showToast?.('Başarılı', 'Yeni KKD stok kartı oluşturuldu.', 'success');
    document.getElementById('create-inventory-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).openStockMovementModal = async (itemId: string, type: 'IN' | 'OUT') => {
  const items = await isgService.getInventory();
  const item = items.find(i => i.id === itemId);
  const itemName = item ? `${item.name} (${item.size || 'Standart'})` : 'KKD Ekipmanı';
  const currentStock = item?.currentStock || 0;
  const unit = item?.unit || 'Adet';

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const userProfile = (window as any).appState?.userProfile || (window as any).userProfile;
  const recordedBy = userProfile?.displayName || currentUser?.displayName || 'İSG Uzmanı';

  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'stock-movement-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid ${type === 'IN' ? 'rgba(16, 185, 129, 0.4)' : 'rgba(245, 158, 11, 0.4)'}; border-radius: 16px; width: 92%; max-width: 500px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          ${type === 'IN' 
            ? `<i class="fa-solid fa-plus-circle" style="color: #10b981;"></i> Depo Stok Girişi (+)`
            : `<i class="fa-solid fa-user-check" style="color: #f59e0b;"></i> Personele KKD Teslimi / Çıkış (-)`}
        </h3>
        <button onclick="document.getElementById('stock-movement-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 10px; margin-bottom: 1rem; font-size: 0.82rem;">
        <div style="color: #94a3b8;">Malzeme: <strong style="color: #fff;">${itemName}</strong></div>
        <div style="color: #94a3b8; margin-top: 2px;">Mevcut Stok: <strong style="color: #10b981; font-size: 1rem; font-family: monospace;">${currentStock} ${unit}</strong></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">İşlem Miktarı (${unit}) *</label>
          <input type="number" id="mov-qty" min="1" ${type === 'OUT' ? `max="${currentStock}"` : ''} value="1" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: ${type === 'IN' ? '#10b981' : '#f59e0b'}; font-weight: 800; font-size: 1.1rem; box-sizing: border-box;" />
        </div>

        ${type === 'OUT' ? `
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Teslim Edilen Personel Adı Soyadı *</label>
            <input type="text" id="mov-personnel" placeholder="Örn: Ersin Çetin, Furkan Yıldırım..." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Görev Yeri / Santral</label>
            <select id="mov-site" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
        ` : `
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Tedarikçi / İrsaliye / Kaynak</label>
            <input type="text" id="mov-reason" placeholder="Örn: 3M Satın Alma İrsaliyesi No: 48921" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        `}

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Açıklama / Teslim Notu</label>
          <input type="text" id="mov-notes" placeholder="${type === 'OUT' ? 'Yıpranma nedeniyle yenisi teslim edildi.' : 'Yeni parti merkez depoya alındı.'}" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #cbd5e1; box-sizing: border-box;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('stock-movement-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveStockMovement('${itemId}', '${type}')" class="btn-cyber" style="background: ${type === 'IN' ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)'}; color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> ${type === 'IN' ? 'Stok Girişini Kaydet' : 'Zimmeti & Çıkışı Tamamla'}
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveStockMovement = async (itemId: string, type: 'IN' | 'OUT') => {
  const qtyEl = document.getElementById('mov-qty') as HTMLInputElement;
  const personEl = document.getElementById('mov-personnel') as HTMLInputElement;
  const siteEl = document.getElementById('mov-site') as HTMLSelectElement;
  const reasonEl = document.getElementById('mov-reason') as HTMLInputElement;
  const notesEl = document.getElementById('mov-notes') as HTMLInputElement;

  const qty = parseInt(qtyEl?.value || '0', 10);
  if (qty <= 0) {
    alert("Lütfen geçerli bir miktar giriniz.");
    return;
  }

  const personnelName = personEl?.value?.trim();
  if (type === 'OUT' && !personnelName) {
    alert("Lütfen teslim edilen personelin adını giriniz.");
    return;
  }

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const recordedBy = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'İSG Uzmanı';
  const dateStr = new Date().toLocaleDateString('tr-TR');

  try {
    const items = await isgService.getInventory();
    const item = items.find(i => i.id === itemId);
    const itemName = item?.name || 'KKD';

    await isgService.adjustStock(
      itemId,
      type === 'IN' ? qty : -qty,
      {
        itemId,
        itemName,
        type,
        qty,
        personnelName: type === 'OUT' ? personnelName : undefined,
        siteName: type === 'OUT' ? siteEl?.value : undefined,
        reason: type === 'IN' ? reasonEl?.value?.trim() : notesEl?.value?.trim(),
        date: dateStr,
        recordedBy
      }
    );

    (window as any).showToast?.('Başarılı', type === 'IN' ? `${qty} adet stok girişi yapıldı.` : `${qty} adet malzeme personele teslim edildi.`, 'success');
    document.getElementById('stock-movement-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).printInventoryDoc = async () => {
  const items = await isgService.getInventory();
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Açılır pencere engellendi. Lütfen izin veriniz.");
    return;
  }

  const rowsHtml = items.map((it, idx) => `
    <tr>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8.5pt;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 5px; font-weight: bold; font-size: 9pt;">${it.name}</td>
      <td style="border: 1px solid #000; padding: 5px; font-size: 8.5pt;">${it.category}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 9pt;">${it.size || '-'}</td>
      <td style="border: 1px solid #000; padding: 5px; font-size: 8.5pt;">${it.storageLocation || 'Merkez Depo'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; font-size: 9.5pt;">${it.currentStock} ${it.unit}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8.5pt;">${it.minThreshold} ${it.unit}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-size: 8.5pt; font-weight: bold; color: ${it.currentStock <= it.minThreshold ? 'red' : 'green'};">
        ${it.currentStock <= it.minThreshold ? 'KRİTİK' : 'YETERLİ'}
      </td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>Demirer Holding - İSG & KKD Depo Stok ve Sayım Tutanağı</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 780px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 12px; }
        .header-table td { border: 1px solid #000; padding: 6px; }
        .data-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #f1f5f9; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="no-print">
          <span style="font-weight: bold;">Demirer Holding - İSG & KKD Depo Mevcut Stok Sayım Tutanağı</span>
          <button onclick="window.print()" style="padding: 6px 14px; background: #06b6d4; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Yazdır / PDF Kaydet</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center;">
              <strong style="font-size: 14pt; letter-spacing: 1px;">DEMİRER</strong><br>
              <span style="font-size: 8pt;">HOLDİNG</span>
            </td>
            <td style="width: 50%; text-align: center;">
              <strong style="font-size: 11pt;">İŞ SAĞLIĞI VE GÜVENLİĞİ BİRİMİ</strong><br>
              <strong style="font-size: 10pt;">KKD & YEDEK DEPO MEVCUT STOK VE SAYIM TUTANAĞI</strong>
            </td>
            <td style="width: 25%; font-size: 8pt;">
              <strong>Doküman No:</strong> DH-FR-ISG-028<br>
              <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}<br>
              <strong>Sayfa:</strong> 1 / 1
            </td>
          </tr>
        </table>

        <table class="data-table">
          <thead>
            <tr style="background: #e2e8f0; font-size: 8.5pt;">
              <th style="border: 1px solid #000; padding: 5px; width: 25px;">No</th>
              <th style="border: 1px solid #000; padding: 5px;">Malzeme Adı / Standardı</th>
              <th style="border: 1px solid #000; padding: 5px;">Kategori</th>
              <th style="border: 1px solid #000; padding: 5px; width: 65px;">Beden/No</th>
              <th style="border: 1px solid #000; padding: 5px;">Depo / Lokasyon</th>
              <th style="border: 1px solid #000; padding: 5px; width: 70px;">Mevcut Stok</th>
              <th style="border: 1px solid #000; padding: 5px; width: 65px;">Min Eşik</th>
              <th style="border: 1px solid #000; padding: 5px; width: 65px;">Durum</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div style="border: 1px solid #000; padding: 10px; margin-top: 20px; font-size: 8.5pt;">
          <strong>Sayım ve Denetim Beyanı:</strong><br>
          Yukarıda listelenen KKD ve kişisel emniyet teçhizatları merkez İSG deposunda fiziksel olarak sayılarak kayıt altına alınmıştır. Kritik seviyenin altındaki donanımlar için satın alma talebi açılmalıdır.
        </div>

        <table style="width: 100%; margin-top: 30px; border-collapse: collapse; text-align: center;">
          <tr>
            <td style="width: 50%;">
              <strong>Sayımı Yapan / Ambar Sorumlusu</strong><br><br><br>
              İmza: .....................................
            </td>
            <td style="width: 50%;">
              <strong>İSG Uzmanı (Onaylayan)</strong><br><br>
              <strong>Sercan Yetgin</strong><br>
              İmza: .....................................
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).deleteInventoryItem = async (id: string) => {
  if (!confirm("Bu KKD stok kartını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteInventoryItem(id);
    (window as any).showToast?.('Silindi', 'KKD stok kartı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 13. YANGIN GÜVENLİĞİ & ORMAN ANALİZLERİ METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateFireSafetyModal = () => {
  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-fire-safety-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(239, 68, 68, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-fire-flame-curved" style="color: #ef4444;"></i> Yeni Yangın Ekipmanı / Denetimi Kaydet
        </h3>
        <button onclick="document.getElementById('create-fire-safety-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Santral / Bölge *</label>
            <select id="new-fire-site" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Lokasyon / Türbin *</label>
            <input type="text" id="new-fire-location" placeholder="Örn: T02 Kule İçi veya Şalt Trafo" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Ekipman Türü *</label>
            <select id="new-fire-type" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="YANGIN_TUPU">🧯 Yangın Tüpü (KKT / CO2)</option>
              <option value="ARAZOZ">🚒 Su Arazözü & Pompa</option>
              <option value="YANGIN_DOLABI">🚿 Yangın Dolabı / Hortum</option>
              <option value="HIDRANT">🚰 Yangın Hidrantı</option>
              <option value="ORMAN_RISK">🌲 Orman Yangın Emniyet Şeridi</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Seri / Plaka No *</label>
            <input type="text" id="new-fire-serial" placeholder="Örn: KKT-KEL-014 veya 10 DH 942" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kapasite</label>
            <input type="text" id="new-fire-capacity" placeholder="Örn: 6 kg KKT veya 10 Ton Su" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Manometre Basıncı Uygun mu?</label>
            <select id="new-fire-pressure" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="true">✅ Basınç Normal (Yeşil Alanda)</option>
              <option value="false">❌ Düşük Basınç / Arızalı</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Son Muayene Tarihi</label>
            <input type="date" id="new-fire-last" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Gelecek Muayene Tarihi *</label>
            <input type="date" id="new-fire-next" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Durum</label>
          <select id="new-fire-status" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
            <option value="OPERATIONAL">Faal ve Kullanıma Hazır</option>
            <option value="NEEDS_INSPECTION">Muayene / Dolum Bekliyor</option>
            <option value="OUT_OF_SERVICE">Hizmet Dışı (Arızalı)</option>
          </select>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-fire-safety-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewFireSafety()" class="btn-cyber" style="background: linear-gradient(135deg, #ef4444 0%, #b91c1c 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Yangın Ekipmanını Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewFireSafety = async () => {
  const siteEl = document.getElementById('new-fire-site') as HTMLSelectElement;
  const locEl = document.getElementById('new-fire-location') as HTMLInputElement;
  const typeEl = document.getElementById('new-fire-type') as HTMLSelectElement;
  const serialEl = document.getElementById('new-fire-serial') as HTMLInputElement;
  const capEl = document.getElementById('new-fire-capacity') as HTMLInputElement;
  const pressureEl = document.getElementById('new-fire-pressure') as HTMLSelectElement;
  const lastEl = document.getElementById('new-fire-last') as HTMLInputElement;
  const nextEl = document.getElementById('new-fire-next') as HTMLInputElement;
  const statusEl = document.getElementById('new-fire-status') as HTMLSelectElement;

  const siteName = siteEl?.value;
  const locationDetail = locEl?.value?.trim();
  const serialOrPlateNo = serialEl?.value?.trim();
  const nextInspectionIso = nextEl?.value?.trim();

  if (!locationDetail || !serialOrPlateNo || !nextInspectionIso) {
    alert("Lütfen lokasyon, seri/plaka no ve gelecek muayene tarihini doldurunuz.");
    return;
  }

  const formatIsoToTr = (iso: string) => {
    if (!iso) return '-';
    const parts = iso.split('-');
    if (parts.length === 3) return `${parts[2]}.${parts[1]}.${parts[0]}`;
    return iso;
  };

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const checkedBy = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'İSG Uzmanı';

  try {
    await isgService.createFireSafety({
      siteName,
      locationDetail,
      equipmentType: (typeEl?.value as any) || 'YANGIN_TUPU',
      serialOrPlateNo,
      capacity: capEl?.value?.trim() || '6 kg KKT',
      pressureOk: pressureEl?.value === 'true',
      lastInspectionDate: formatIsoToTr(lastEl?.value),
      nextInspectionDate: formatIsoToTr(nextInspectionIso),
      status: (statusEl?.value as any) || 'OPERATIONAL',
      checkedBy
    });

    (window as any).showToast?.('Başarılı', 'Yangın ekipmanı kaydı oluşturuldu.', 'success');
    document.getElementById('create-fire-safety-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteFireSafetyRecord = async (id: string) => {
  if (!confirm("Bu yangın güvenliği kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteFireSafety(id);
    (window as any).showToast?.('Silindi', 'Yangın ekipmanı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 14. TEKNİSYEN GEÇİCİ GÖREVLENDİRME & SEVK METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateDispatchModal = () => {
  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-dispatch-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(56, 189, 248, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-plane-departure" style="color: #38bdf8;"></i> Yeni Geçici Görevlendirme Aç
        </h3>
        <button onclick="document.getElementById('create-dispatch-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Görevlendirilen Personel Adı Soyadı *</label>
          <input type="text" id="new-disp-person" placeholder="Örn: Furkan Yıldırım, Umut Can Akman..." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Asıl Santral (Çıkış) *</label>
            <select id="new-disp-origin" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Görev Yeri (Varış) *</label>
            <select id="new-disp-target" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #38bdf8; font-weight: 700; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Başlangıç Tarihi *</label>
            <input type="date" id="new-disp-start" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Bitiş Tarihi *</label>
            <input type="date" id="new-disp-end" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Görevlendirme Nedeni & Kapsamı *</label>
          <input type="text" id="new-disp-reason" placeholder="Örn: Ana mil rulman değişimi, kanat tamiri veya periyodik bakım desteği" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); border-radius: 8px; padding: 10px;">
          <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: #fff; font-size: 0.8rem; font-weight: 700;">
            <input type="checkbox" id="new-disp-briefing" checked style="accent-color: #38bdf8; width: 16px; height: 16px;" />
            <span>Saha İSG & Çevre Risk Bilgilendirmesi Yapıldı ve İmzalandı</span>
          </label>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-dispatch-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewDispatch()" class="btn-cyber" style="background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Görevlendirmeyi Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewDispatch = async () => {
  const personEl = document.getElementById('new-disp-person') as HTMLInputElement;
  const originEl = document.getElementById('new-disp-origin') as HTMLSelectElement;
  const targetEl = document.getElementById('new-disp-target') as HTMLSelectElement;
  const startEl = document.getElementById('new-disp-start') as HTMLInputElement;
  const endEl = document.getElementById('new-disp-end') as HTMLInputElement;
  const reasonEl = document.getElementById('new-disp-reason') as HTMLInputElement;
  const briefEl = document.getElementById('new-disp-briefing') as HTMLInputElement;

  const personnelName = personEl?.value?.trim();
  const reason = reasonEl?.value?.trim();
  const startDate = startEl?.value?.trim();
  const endDate = endEl?.value?.trim();

  if (!personnelName || !reason || !startDate || !endDate) {
    alert("Lütfen personel, görev nedeni ve tarih aralığını doldurunuz.");
    return;
  }

  const docNo = `GG-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;

  try {
    await isgService.createDispatch({
      docNo,
      personnelName,
      originSite: originEl?.value,
      targetSite: targetEl?.value,
      startDate,
      endDate,
      reason,
      isgBriefingDone: briefEl?.checked || false,
      status: 'ACTIVE'
    });

    (window as any).showToast?.('Başarılı', 'Geçici görevlendirme belgesi açıldı.', 'success');
    document.getElementById('create-dispatch-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).printDispatchDoc = async (id: string) => {
  const dispatches = await isgService.getDispatches();
  const disp = dispatches.find(d => d.id === id);
  if (!disp) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${disp.docNo} - Demirer Holding Geçici Görev ve İSG Formu</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 760px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .header-table td { border: 1px solid #000; padding: 6px; }
        .bordered-box { border: 1.5px solid #000; padding: 10px; margin-bottom: 12px; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="no-print">
          <span style="font-weight: bold;">Geçici Görevlendirme ve Saha İSG Bilgilendirme Formu</span>
          <button onclick="window.print()" style="padding: 6px 14px; background: #38bdf8; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Yazdır / PDF Kaydet</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center;">
              <strong style="font-size: 14pt;">DEMİRER</strong><br>
              <span style="font-size: 8pt;">HOLDİNG</span>
            </td>
            <td style="width: 50%; text-align: center;">
              <strong style="font-size: 11pt;">RÜZGAR SANTRALLERİ İŞ SAĞLIĞI VE GÜVENLİĞİ BİRİMİ</strong><br>
              <strong style="font-size: 10pt;">TEKNİSYEN GEÇİCİ GÖREVLENDİRME & SAHA İSG FORMU</strong>
            </td>
            <td style="width: 25%; font-size: 8pt;">
              <strong>Form No:</strong> DH-FR-ISG-025<br>
              <strong>Belge No:</strong> ${disp.docNo}<br>
              <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}
            </td>
          </tr>
        </table>

        <div class="bordered-box">
          <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #000; padding-bottom: 4px;">1. GÖREVLENDİRME BİLGİLERİ</h4>
          <table style="width: 100%; font-size: 9.5pt;">
            <tr>
              <td style="width: 25%; font-weight: bold; padding: 4px 0;">Personel Adı:</td>
              <td style="padding: 4px 0;">${disp.personnelName}</td>
              <td style="width: 20%; font-weight: bold; padding: 4px 0;">Görev Süresi:</td>
              <td style="padding: 4px 0;">${disp.startDate} ~ ${disp.endDate}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Çıkış Santrali:</td>
              <td style="padding: 4px 0;">${disp.originSite}</td>
              <td style="font-weight: bold; padding: 4px 0;">Varış Santrali:</td>
              <td style="padding: 4px 0; font-weight: bold; color: #0284c7;">${disp.targetSite}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Görev Nedeni:</td>
              <td colspan="3" style="padding: 4px 0;">${disp.reason}</td>
            </tr>
          </table>
        </div>

        <div class="bordered-box">
          <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #000; padding-bottom: 4px;">2. VARILAN SAHA İSG TALİMATLARI VE YÜKÜMLÜLÜKLER</h4>
          <ul style="margin: 0; padding-left: 20px; font-size: 9pt; line-height: 1.5;">
            <li>Personel kuleye tırmanmadan önce hedef santral şefine yazılı/sözlü bilgi verecektir.</li>
            <li>GWO Yüksekte Çalışma kuralları uyarınca dikey yaşam hattına şaryo ile %100 bağlı kalınacaktır.</li>
            <li>Rüzgar hızı 15 m/s üzerinde iken kule üstüne çıkış yasaktır.</li>
            <li>Saha araçlarında SRC 3/4 ve Psikoteknik belgesi olmayan personeller kesinlikle araç kullanamaz.</li>
            <li>Yangın mevsiminde türbin diplerinde sıcak alevli kaynak işleri İSG uzmanı iznine tabidir.</li>
          </ul>
        </div>

        <table style="width: 100%; margin-top: 40px; text-align: center;">
          <tr>
            <td style="width: 33%;">
              <strong>Görevlendirilen Teknisyen</strong><br><br>
              ${disp.personnelName}<br>
              İmza: .....................................
            </td>
            <td style="width: 33%;">
              <strong>Santral Şefi (Onay)</strong><br><br><br>
              İmza: .....................................
            </td>
            <td style="width: 34%;">
              <strong>İSG Uzmanı</strong><br><br>
              <strong>Sercan Yetgin</strong><br>
              İmza: .....................................
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).deleteDispatchRecord = async (id: string) => {
  if (!confirm("Bu görevlendirme kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteDispatch(id);
    (window as any).showToast?.('Silindi', 'Görevlendirme kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 15. TAŞERON İSG & SAHA GİRİŞ İZNİ METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateContractorModal = () => {
  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-contractor-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 16px; width: 92%; max-width: 580px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-person-digging" style="color: #f97316;"></i> Yeni Taşeron / Yüklenici Kaydı Aç
        </h3>
        <button onclick="document.getElementById('create-contractor-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Taşeron Firma Ticari Unvanı *</label>
          <input type="text" id="new-cont-company" placeholder="Örn: Hareket Ağır Taşımacılık & Vinç Ltd. Şti." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Çalışılacak Santral *</label>
            <select id="new-cont-site" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Türbin / Lokasyon Detayı</label>
            <input type="text" id="new-cont-location" placeholder="Örn: T04 Kule İçi veya Şalt Sahası" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Yapılacak İşin Tanımı *</label>
          <input type="text" id="new-cont-work" placeholder="Örn: 500 Ton Mobil Vinç ile Dişli Kutusu Değişimi veya Kanat Onarımı" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Firma Yetkilisi</label>
            <input type="text" id="new-cont-person" placeholder="Ad Soyad" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">İletişim Telefonu</label>
            <input type="text" id="new-cont-phone" placeholder="0532 ..." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Saha Giriş Tarihi *</label>
            <input type="date" id="new-cont-start" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Saha Çıkış Tarihi *</label>
            <input type="date" id="new-cont-end" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-contractor-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewContractor()" class="btn-cyber" style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Taşeronu Kaydet & Evraklara Geç
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveNewContractor = async () => {
  const compEl = document.getElementById('new-cont-company') as HTMLInputElement;
  const siteEl = document.getElementById('new-cont-site') as HTMLSelectElement;
  const locEl = document.getElementById('new-cont-location') as HTMLInputElement;
  const workEl = document.getElementById('new-cont-work') as HTMLInputElement;
  const personEl = document.getElementById('new-cont-person') as HTMLInputElement;
  const phoneEl = document.getElementById('new-cont-phone') as HTMLInputElement;
  const startEl = document.getElementById('new-cont-start') as HTMLInputElement;
  const endEl = document.getElementById('new-cont-end') as HTMLInputElement;

  const companyName = compEl?.value?.trim();
  const workDescription = workEl?.value?.trim();
  const startDate = startEl?.value?.trim();
  const endDate = endEl?.value?.trim();

  if (!companyName || !workDescription || !startDate || !endDate) {
    alert("Lütfen firma unvanı, iş tanımı ve tarih aralığını doldurunuz.");
    return;
  }

  const defaultChecklist = [
    { id: '1', label: 'SGK İşe Giriş & Aylık Prim Bildirgeleri', checked: false },
    { id: '2', label: 'EK-2 Ağır ve Tehlikeli İşler Sağlık Raporları', checked: false },
    { id: '3', label: 'Yüksekte Çalışma / GWO / İple Erişim Sertifikaları', checked: false },
    { id: '4', label: '16 Saat Temel İSG Eğitim Belgeleri', checked: false },
    { id: '5', label: 'Vinç ve Sepet Periyodik Muayene Raporları', checked: false },
    { id: '6', label: 'Risk Analizi ve Metot Bildirimi (RAMS)', checked: false },
    { id: '7', label: 'Taşeron İSG Taahhütnamesi & Saha Kuralları', checked: false }
  ];

  try {
    await isgService.createContractor({
      companyName,
      siteName: siteEl?.value,
      locationDetail: locEl?.value?.trim() || undefined,
      workDescription,
      contactPerson: personEl?.value?.trim() || undefined,
      contactPhone: phoneEl?.value?.trim() || undefined,
      startDate,
      endDate,
      status: 'PENDING_DOCS',
      checklist: defaultChecklist
    });

    (window as any).showToast?.('Başarılı', 'Taşeron kaydı açıldı, evrak incelemesine geçebilirsiniz.', 'success');
    document.getElementById('create-contractor-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).openEvaluateContractorModal = async (id: string) => {
  const contractors = await isgService.getContractors();
  const cont = contractors.find(c => c.id === id);
  if (!cont) return;

  const modal = document.createElement('div');
  modal.id = 'evaluate-contractor-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  const checklistItems = cont.checklist || [
    { id: '1', label: 'SGK İşe Giriş & Aylık Prim Bildirgeleri', checked: false },
    { id: '2', label: 'EK-2 Ağır ve Tehlikeli İşler Sağlık Raporları', checked: false },
    { id: '3', label: 'Yüksekte Çalışma / GWO / İple Erişim Sertifikaları', checked: false },
    { id: '4', label: '16 Saat Temel İSG Eğitim Belgeleri', checked: false },
    { id: '5', label: 'Vinç ve Sepet Periyodik Muayene Raporları', checked: false },
    { id: '6', label: 'Risk Analizi ve Metot Bildirimi (RAMS)', checked: false },
    { id: '7', label: 'Taşeron İSG Taahhütnamesi & Saha Kuralları', checked: false }
  ];

  const checklistHtml = checklistItems.map(item => `
    <label style="display: flex; align-items: center; justify-content: space-between; padding: 8px 10px; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; cursor: pointer;">
      <span style="font-size: 0.8rem; color: #fff;">${item.label}</span>
      <input type="checkbox" class="eval-chk" data-id="${item.id}" ${item.checked ? 'checked' : ''} style="accent-color: #10b981; width: 18px; height: 18px;" />
    </label>
  `).join('');

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(249, 115, 22, 0.4); border-radius: 16px; width: 92%; max-width: 600px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div>
          <span style="font-size: 0.72rem; color: #f97316; font-weight: 800;">${cont.siteName}</span>
          <h3 style="margin: 2px 0 0 0; font-size: 1.15rem; font-weight: 900; color: #fff;">
            ${cont.companyName}
          </h3>
        </div>
        <button onclick="document.getElementById('evaluate-contractor-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 1rem; background: rgba(0,0,0,0.3); padding: 8px 10px; border-radius: 8px;">
        <strong>Yapılacak İş:</strong> ${cont.workDescription} (${cont.startDate} ~ ${cont.endDate})
      </div>

      <div style="font-size: 0.78rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">
        Yasal İSG Evrak Kontrol Listesi (İmzalı / Geçerli Olanları İşaretleyiniz):
      </div>

      <div style="display: flex; flex-direction: column; gap: 6px; margin-bottom: 1rem; max-height: 250px; overflow-y: auto;">
        ${checklistHtml}
      </div>

      <div style="margin-bottom: 1rem;">
        <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">İSG Uzmanı Kararı & Durum *</label>
        <select id="eval-status" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; font-weight: 800; box-sizing: border-box;">
          <option value="APPROVED" ${cont.status === 'APPROVED' ? 'selected' : ''}>✅ SAHAYA GİRİŞ ONAYLANDI (Tüm Evraklar Tam)</option>
          <option value="PENDING_DOCS" ${cont.status === 'PENDING_DOCS' ? 'selected' : ''}>⚠️ EKSİK EVRAK (Sahaya Giriş Bekletiliyor)</option>
          <option value="REJECTED" ${cont.status === 'REJECTED' ? 'selected' : ''}>❌ REDDEDİLDİ (Saha Kurallarına Uygun Değil)</option>
        </select>
      </div>

      <div>
        <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Eksik Evrak veya İSG Uzmanı Şartlı İzin Notu</label>
        <textarea id="eval-notes" class="cyber-input" rows="2" placeholder="Örn: Halat muayene etiketleri getirildiğinde kuleye çıkılabilir..." style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">${cont.missingDocsNote || ''}</textarea>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('evaluate-contractor-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveEvaluateContractor('${id}')" class="btn-cyber" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Kararı & Evrakları Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).saveEvaluateContractor = async (id: string) => {
  const statusEl = document.getElementById('eval-status') as HTMLSelectElement;
  const notesEl = document.getElementById('eval-notes') as HTMLTextAreaElement;
  const chkElements = document.querySelectorAll<HTMLInputElement>('.eval-chk');

  const checklist = Array.from(chkElements).map(el => ({
    id: el.getAttribute('data-id') || '',
    label: el.closest('label')?.querySelector('span')?.textContent || '',
    checked: el.checked
  }));

  const status = (statusEl?.value as any) || 'PENDING_DOCS';
  const missingDocsNote = notesEl?.value?.trim();

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const approvedBy = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Sercan Yetgin';
  const approvalDate = new Date().toLocaleDateString('tr-TR');

  try {
    await isgService.updateContractor(id, {
      checklist,
      status,
      missingDocsNote,
      approvedBy,
      approvalDate
    });

    (window as any).showToast?.('Başarılı', 'Taşeron İSG değerlendirmesi kaydedildi.', 'success');
    document.getElementById('evaluate-contractor-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).printContractorEntryPermit = async (id: string) => {
  const contractors = await isgService.getContractors();
  const cont = contractors.find(c => c.id === id);
  if (!cont) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const checklistRows = (cont.checklist || []).map(item => `
    <tr>
      <td style="border: 1px solid #000; padding: 5px; font-size: 9pt;">${item.label}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold; width: 90px; color: ${item.checked ? 'green' : 'red'};">
        ${item.checked ? '✅ ONAYLI' : '❌ EKSİK'}
      </td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${cont.companyName} - Taşeron Saha Giriş ve Çalışma İzin Belgesi</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 760px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .header-table td { border: 1px solid #000; padding: 6px; }
        .bordered-box { border: 1.5px solid #000; padding: 10px; margin-bottom: 12px; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="no-print">
          <span style="font-weight: bold;">Taşeron Saha Giriş ve Çalışma İzin Belgesi</span>
          <button onclick="window.print()" style="padding: 6px 14px; background: #f97316; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Yazdır / PDF Kaydet</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center;">
              <strong style="font-size: 14pt;">DEMİRER</strong><br>
              <span style="font-size: 8pt;">HOLDİNG</span>
            </td>
            <td style="width: 50%; text-align: center;">
              <strong style="font-size: 11pt;">İŞ SAĞLIĞI VE GÜVENLİĞİ BİRİMİ</strong><br>
              <strong style="font-size: 10pt;">TAŞERON & YÜKLENİCİ SAHA GİRİŞ VE ÇALIŞMA İZİN BELGESİ</strong>
            </td>
            <td style="width: 25%; font-size: 8pt;">
              <strong>Form No:</strong> DH-FR-ISG-022<br>
              <strong>Tarih:</strong> ${new Date().toLocaleDateString('tr-TR')}
            </td>
          </tr>
        </table>

        <div class="bordered-box">
          <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #000; padding-bottom: 4px;">1. TAŞERON VE SAHA BİLGİLERİ</h4>
          <table style="width: 100%; font-size: 9.5pt;">
            <tr>
              <td style="width: 25%; font-weight: bold; padding: 4px 0;">Firma Unvanı:</td>
              <td colspan="3" style="padding: 4px 0; font-weight: bold;">${cont.companyName}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Çalışılacak Saha:</td>
              <td style="padding: 4px 0; font-weight: bold; color: #c2410c;">${cont.siteName} ${cont.locationDetail ? `(${cont.locationDetail})` : ''}</td>
              <td style="width: 20%; font-weight: bold; padding: 4px 0;">İzin Tarihleri:</td>
              <td style="padding: 4px 0;">${cont.startDate} ~ ${cont.endDate}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Yapılacak İş:</td>
              <td colspan="3" style="padding: 4px 0;">${cont.workDescription}</td>
            </tr>
            <tr>
              <td style="font-weight: bold; padding: 4px 0;">Firma Yetkilisi:</td>
              <td style="padding: 4px 0;">${cont.contactPerson || '-'}</td>
              <td style="font-weight: bold; padding: 4px 0;">İletişim Tel:</td>
              <td style="padding: 4px 0;">${cont.contactPhone || '-'}</td>
            </tr>
          </table>
        </div>

        <div class="bordered-box">
          <h4 style="margin: 0 0 8px 0; border-bottom: 1px solid #000; padding-bottom: 4px;">2. YASAL İSG EVRAKLARI DOĞRULAMA ÇİZELGESİ</h4>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f1f5f9;">
                <th style="border: 1px solid #000; padding: 5px; text-align: left;">Evrak Adı</th>
                <th style="border: 1px solid #000; padding: 5px; text-align: center;">Kontrol Durumu</th>
              </tr>
            </thead>
            <tbody>
              ${checklistRows}
            </tbody>
          </table>
        </div>

        <div style="border: 2px solid ${cont.status === 'APPROVED' ? '#16a34a' : '#dc2626'}; background: ${cont.status === 'APPROVED' ? '#f0fdf4' : '#fef2f2'}; padding: 10px; margin-bottom: 15px; text-align: center;">
          <strong style="font-size: 11pt; color: ${cont.status === 'APPROVED' ? '#16a34a' : '#dc2626'};">
            ${cont.status === 'APPROVED' ? 'BU TAŞERONUN BELİRTİLEN SAHAYA GİRİŞİNE İSG BİRİMİNCE İZİN VERİLMİŞTİR' : 'EKSİK EVRAKLAR NEDENİYLE SAHAYA GİRİŞ İZNİ HENÜZ VERİLMEMİŞTİR'}
          </strong>
          ${cont.missingDocsNote ? `<div style="font-size: 8.5pt; margin-top: 4px; color: #334155;"><strong>Şart / Not:</strong> ${cont.missingDocsNote}</div>` : ''}
        </div>

        <table style="width: 100%; margin-top: 30px; text-align: center;">
          <tr>
            <td style="width: 50%;">
              <strong>Taşeron Firma Yetkilisi</strong><br><br><br>
              İmza: .....................................
            </td>
            <td style="width: 50%;">
              <strong>Demirer Holding İSG Uzmanı</strong><br><br>
              <strong>${cont.approvedBy || 'Sercan Yetgin'}</strong><br>
              İmza: .....................................
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).deleteContractorRecord = async (id: string) => {
  if (!confirm("Bu taşeron kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteContractor(id);
    (window as any).showToast?.('Silindi', 'Taşeron kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 16. SAHA & SERVİS EKİBİ İSG PUANLAMA (SCORECARD) METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateScorecardModal = () => {
  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-scorecard-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(234, 179, 8, 0.4); border-radius: 16px; width: 92%; max-width: 550px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-trophy" style="color: #eab308;"></i> Yeni Saha / Ekip İSG Puanlaması Yap
        </h3>
        <button onclick="document.getElementById('create-scorecard-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Puanlama Türü *</label>
            <select id="sc-type" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="SITE">🏢 Santral (RES)</option>
              <option value="TEAM">👷 Servis Ekibi (Team)</option>
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Hedef Adı *</label>
            <input type="text" id="sc-target" placeholder="Örn: Alize Keltepe veya Team 01 (Keltepe)" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="background: rgba(234, 179, 8, 0.08); border: 1px solid rgba(234, 179, 8, 0.25); border-radius: 8px; padding: 10px;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #eab308; margin-bottom: 6px;">5 Temel Kriter Puanlaması (Her biri max 20 Puan):</div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
            <div>
              <label style="font-size: 0.72rem; color: #cbd5e1;">1. KKD Kullanımı (0-20)</label>
              <input type="number" id="sc-kkd" min="0" max="20" value="20" oninput="window.calcScorecardTotal()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff; font-weight: 800;" />
            </div>
            <div>
              <label style="font-size: 0.72rem; color: #cbd5e1;">2. Yüksekte Çalışma (0-20)</label>
              <input type="number" id="sc-safety" min="0" max="20" value="19" oninput="window.calcScorecardTotal()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff; font-weight: 800;" />
            </div>
            <div>
              <label style="font-size: 0.72rem; color: #cbd5e1;">3. Kimyasal & Çevre (0-20)</label>
              <input type="number" id="sc-chem" min="0" max="20" value="18" oninput="window.calcScorecardTotal()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff; font-weight: 800;" />
            </div>
            <div>
              <label style="font-size: 0.72rem; color: #cbd5e1;">4. İş İzni & Risk (0-20)</label>
              <input type="number" id="sc-risk" min="0" max="20" value="19" oninput="window.calcScorecardTotal()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff; font-weight: 800;" />
            </div>
            <div>
              <label style="font-size: 0.72rem; color: #cbd5e1;">5. Saha 5S Düzeni (0-20)</label>
              <input type="number" id="sc-5s" min="0" max="20" value="18" oninput="window.calcScorecardTotal()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff; font-weight: 800;" />
            </div>
            <div style="background: rgba(0,0,0,0.5); padding: 4px 8px; border-radius: 4px; display: flex; flex-direction: column; justify-content: center; align-items: center;">
              <span style="font-size: 0.65rem; color: #94a3b8;">TOPLAM İSG PUANI</span>
              <span id="sc-total-preview" style="font-size: 1.4rem; font-weight: 900; color: #10b981; font-family: monospace;">%94</span>
            </div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Tespitler & Değerlendirme Notu</label>
          <input type="text" id="sc-notes" placeholder="Örn: Kule içi şaryo kontrolleri tam yapıldı, 1 kaskın çene bağı yenilendi." class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-scorecard-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewScorecard()" class="btn-cyber" style="background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: #000; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Puanlamayı Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).calcScorecardTotal = () => {
  const kkd = parseInt((document.getElementById('sc-kkd') as HTMLInputElement)?.value || '0', 10);
  const safety = parseInt((document.getElementById('sc-safety') as HTMLInputElement)?.value || '0', 10);
  const chem = parseInt((document.getElementById('sc-chem') as HTMLInputElement)?.value || '0', 10);
  const risk = parseInt((document.getElementById('sc-risk') as HTMLInputElement)?.value || '0', 10);
  const fiveS = parseInt((document.getElementById('sc-5s') as HTMLInputElement)?.value || '0', 10);

  const total = kkd + safety + chem + risk + fiveS;
  const preview = document.getElementById('sc-total-preview');
  if (preview) {
    preview.textContent = `%${total}`;
    preview.style.color = total >= 90 ? '#10b981' : total >= 75 ? '#f59e0b' : '#ef4444';
  }
};

(window as any).saveNewScorecard = async () => {
  const typeEl = document.getElementById('sc-type') as HTMLSelectElement;
  const targetEl = document.getElementById('sc-target') as HTMLInputElement;
  const kkdEl = document.getElementById('sc-kkd') as HTMLInputElement;
  const safetyEl = document.getElementById('sc-safety') as HTMLInputElement;
  const chemEl = document.getElementById('sc-chem') as HTMLInputElement;
  const riskEl = document.getElementById('sc-risk') as HTMLInputElement;
  const fiveSEl = document.getElementById('sc-5s') as HTMLInputElement;
  const notesEl = document.getElementById('sc-notes') as HTMLInputElement;

  const targetName = targetEl?.value?.trim();
  if (!targetName) {
    alert("Lütfen santral veya ekip adını giriniz.");
    return;
  }

  const kkdScore = parseInt(kkdEl?.value || '0', 10);
  const safetyLineScore = parseInt(safetyEl?.value || '0', 10);
  const chemicalScore = parseInt(chemEl?.value || '0', 10);
  const riskProcedureScore = parseInt(riskEl?.value || '0', 10);
  const housekeepingScore = parseInt(fiveSEl?.value || '0', 10);
  const totalScore = kkdScore + safetyLineScore + chemicalScore + riskProcedureScore + housekeepingScore;

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const auditorName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Sercan Yetgin';
  const evaluationDate = new Date().toLocaleDateString('tr-TR');

  try {
    await isgService.createScorecard({
      evaluationType: (typeEl?.value as any) || 'SITE',
      targetName,
      auditorName,
      evaluationDate,
      totalScore,
      kkdScore,
      safetyLineScore,
      chemicalScore,
      riskProcedureScore,
      housekeepingScore,
      findingsCount: 0,
      notes: notesEl?.value?.trim() || undefined
    });

    (window as any).showToast?.('Başarılı', 'İSG karne puanlaması kaydedildi.', 'success');
    document.getElementById('create-scorecard-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).deleteScorecardRecord = async (id: string) => {
  if (!confirm("Bu puanlama kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteScorecard(id);
    (window as any).showToast?.('Silindi', 'Puanlama kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 17. RİSK ANALİZLERİ (5x5 L-TİPİ MATRİS) METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateRiskModal = () => {
  const modal = document.createElement('div');
  modal.id = 'create-risk-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 16px; width: 92%; max-width: 600px; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-triangle-exclamation" style="color: #f43f5e;"></i> Yeni 5x5 L-Tipi Risk Değerlendirmesi
        </h3>
        <button onclick="document.getElementById('create-risk-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Faaliyet / İş Başlığı *</label>
          <input type="text" id="risk-title" placeholder="Örn: Rüzgar Türbinlerinde Yüksekte Çalışma ve Kuleye Tırmanma" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Kategori / Santral Bölgesi</label>
            <input type="text" id="risk-category" placeholder="Örn: Kule İçi & Nacelle / Yüksekte Çalışma" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Sorumlu Kişi / Birim</label>
            <input type="text" id="risk-resp" value="Sercan Yetgin / Saha Şefleri" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #f87171; font-weight: 800; margin-bottom: 4px;">Tehlike Tanımı *</label>
            <textarea id="risk-hazard" rows="2" placeholder="Örn: Merdivenden ayağın kayması, lanyart bağlamama" class="cyber-input" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #fbbf24; font-weight: 800; margin-bottom: 4px;">Olası Risk / Sonuç *</label>
            <textarea id="risk-consequence" rows="2" placeholder="Örn: Yüksekten düşme sonucu ölümcül kaza veya uzuv kaybı" class="cyber-input" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
          </div>
        </div>

        <!-- 5x5 Matris Skorlama -->
        <div style="background: rgba(244, 63, 94, 0.08); border: 1px solid rgba(244, 63, 94, 0.25); border-radius: 8px; padding: 10px;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #f43f5e; margin-bottom: 6px;">5x5 L-Tipi İlk Risk Skoru (Önlem Öncesi):</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; align-items: center;">
            <div>
              <label style="font-size: 0.7rem; color: #cbd5e1;">Olasılık (1-5)</label>
              <select id="risk-prob" onchange="window.calcRiskScores()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="1">1 - Çok Küçük</option>
                <option value="2">2 - Küçük</option>
                <option value="3">3 - Orta</option>
                <option value="4" selected>4 - Yüksek</option>
                <option value="5">5 - Çok Yüksek</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.7rem; color: #cbd5e1;">Şiddet (1-5)</label>
              <select id="risk-sev" onchange="window.calcRiskScores()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="1">1 - Çok Hafif</option>
                <option value="2">2 - Hafif</option>
                <option value="3">3 - Orta</option>
                <option value="4">4 - Ciddi</option>
                <option value="5" selected>5 - Çok Ciddi (Ölüm)</option>
              </select>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.65rem; color: #94a3b8;">İLK RİSK SKORU</div>
              <div id="risk-score-preview" style="font-size: 1.3rem; font-weight: 900; color: #ef4444; font-family: monospace;">20 / 25</div>
            </div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #10b981; font-weight: 800; margin-bottom: 4px;">Alınan / Planlanan Önlemler (Mevcut Kontroller) *</label>
          <textarea id="risk-controls" rows="2" placeholder="Örn: EN 353-1 şaryo kullanımı, EN 361 paraşüt tipi kemer, EN 355 çift kollu lanyart ile %100 bağlılık." class="cyber-input" style="width: 100%; padding: 0.5rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
        </div>

        <div style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 8px; padding: 10px;">
          <div style="font-size: 0.75rem; font-weight: 800; color: #10b981; margin-bottom: 6px;">Önlem Sonrası Revize Risk Skoru:</div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; align-items: center;">
            <div>
              <label style="font-size: 0.7rem; color: #cbd5e1;">Revize Olasılık (1-5)</label>
              <select id="risk-res-prob" onchange="window.calcRiskScores()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="1" selected>1 - Çok Küçük</option>
                <option value="2">2 - Küçük</option>
                <option value="3">3 - Orta</option>
                <option value="4">4 - Yüksek</option>
                <option value="5">5 - Çok Yüksek</option>
              </select>
            </div>
            <div>
              <label style="font-size: 0.7rem; color: #cbd5e1;">Revize Şiddet (1-5)</label>
              <select id="risk-res-sev" onchange="window.calcRiskScores()" class="cyber-input" style="width: 100%; padding: 4px 6px; background: #000; border: 1px solid #334155; border-radius: 4px; color: #fff;">
                <option value="1">1 - Çok Hafif</option>
                <option value="2">2 - Hafif</option>
                <option value="3">3 - Orta</option>
                <option value="4" selected>4 - Ciddi</option>
                <option value="5">5 - Çok Ciddi</option>
              </select>
            </div>
            <div style="text-align: center;">
              <div style="font-size: 0.65rem; color: #94a3b8;">REVİZE SKOR</div>
              <div id="risk-res-preview" style="font-size: 1.3rem; font-weight: 900; color: #10b981; font-family: monospace;">4 / 25</div>
            </div>
          </div>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-risk-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewRisk()" class="btn-cyber" style="background: linear-gradient(135deg, #f43f5e 0%, #e11d48 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Risk Analizini Kaydet
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).calcRiskScores = () => {
  const p = parseInt((document.getElementById('risk-prob') as HTMLSelectElement)?.value || '4', 10);
  const s = parseInt((document.getElementById('risk-sev') as HTMLSelectElement)?.value || '5', 10);
  const score = p * s;
  const prev = document.getElementById('risk-score-preview');
  if (prev) {
    prev.textContent = `${score} / 25`;
    prev.style.color = score >= 15 ? '#ef4444' : score >= 8 ? '#f59e0b' : '#10b981';
  }

  const rp = parseInt((document.getElementById('risk-res-prob') as HTMLSelectElement)?.value || '1', 10);
  const rs = parseInt((document.getElementById('risk-res-sev') as HTMLSelectElement)?.value || '4', 10);
  const rscore = rp * rs;
  const rprev = document.getElementById('risk-res-preview');
  if (rprev) {
    rprev.textContent = `${rscore} / 25`;
    rprev.style.color = rscore >= 15 ? '#ef4444' : rscore >= 8 ? '#f59e0b' : '#10b981';
  }
};

(window as any).saveNewRisk = async () => {
  const titleEl = document.getElementById('risk-title') as HTMLInputElement;
  const catEl = document.getElementById('risk-category') as HTMLInputElement;
  const hazardEl = document.getElementById('risk-hazard') as HTMLTextAreaElement;
  const consEl = document.getElementById('risk-consequence') as HTMLTextAreaElement;
  const probEl = document.getElementById('risk-prob') as HTMLSelectElement;
  const sevEl = document.getElementById('risk-sev') as HTMLSelectElement;
  const controlsEl = document.getElementById('risk-controls') as HTMLTextAreaElement;
  const rprobEl = document.getElementById('risk-res-prob') as HTMLSelectElement;
  const rsevEl = document.getElementById('risk-res-sev') as HTMLSelectElement;
  const respEl = document.getElementById('risk-resp') as HTMLInputElement;

  const title = titleEl?.value?.trim();
  const hazard = hazardEl?.value?.trim();
  const consequence = consEl?.value?.trim();
  const existingControls = controlsEl?.value?.trim();

  if (!title || !hazard || !consequence || !existingControls) {
    alert("Lütfen başlık, tehlike, sonuç ve önlemler alanlarını doldurunuz.");
    return;
  }

  const probability = parseInt(probEl?.value || '4', 10);
  const severity = parseInt(sevEl?.value || '5', 10);
  const riskScore = probability * severity;
  const riskLevel: any = riskScore >= 15 ? 'HIGH' : riskScore >= 8 ? 'MEDIUM' : 'LOW';

  const residualProbability = parseInt(rprobEl?.value || '1', 10);
  const residualSeverity = parseInt(rsevEl?.value || '4', 10);
  const residualRiskScore = residualProbability * residualSeverity;

  const riskNo = `RA-RES-${String(Math.floor(Math.random() * 900) + 100)}`;
  const revisionDate = new Date().toLocaleDateString('tr-TR');

  try {
    await isgService.createRiskAssessment({
      riskNo,
      title,
      siteOrCategory: catEl?.value?.trim() || 'Rüzgar Türbinleri',
      hazard,
      consequence,
      probability,
      severity,
      riskScore,
      riskLevel,
      existingControls,
      residualProbability,
      residualSeverity,
      residualRiskScore,
      responsiblePerson: respEl?.value?.trim() || 'İSG Uzmanı',
      revisionDate,
      status: 'ACTIVE'
    });

    (window as any).showToast?.('Başarılı', 'Risk analizi matrise kaydedildi.', 'success');
    document.getElementById('create-risk-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).printRiskDoc = async (id: string) => {
  const risks = await isgService.getRiskAssessments();
  const r = risks.find(item => item.id === id);
  if (!r) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${r.riskNo} - 5x5 L-Tipi Risk Değerlendirme Raporu</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 9.5pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 1020px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .header-table td { border: 1px solid #000; padding: 6px; }
        .matrix-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 20px; }
        .matrix-table th, .matrix-table td { border: 1px solid #000; padding: 6px; text-align: left; vertical-align: top; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="no-print">
          <span style="font-weight: bold;">6331 Sayılı Kanun Uyarınca 5x5 L-Tipi Risk Değerlendirme Formu</span>
          <button onclick="window.print()" style="padding: 6px 14px; background: #f43f5e; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Yazdır / PDF Kaydet</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 20%; text-align: center;">
              <strong style="font-size: 14pt;">DEMİRER</strong><br>
              <span style="font-size: 8pt;">HOLDİNG</span>
            </td>
            <td style="width: 60%; text-align: center;">
              <strong style="font-size: 11pt;">İŞ SAĞLIĞI VE GÜVENLİĞİ BİRİMİ</strong><br>
              <strong style="font-size: 10pt;">RÜZGAR SANTRALLERİ 5x5 L-TİPİ RİSK ANALİZİ DEĞERLENDİRME FORMU</strong>
            </td>
            <td style="width: 20%; font-size: 8pt;">
              <strong>Risk No:</strong> ${r.riskNo}<br>
              <strong>Rev. Tarihi:</strong> ${r.revisionDate}<br>
              <strong>Mevzuat:</strong> 6331 Sayılı Kanun
            </td>
          </tr>
        </table>

        <table class="matrix-table">
          <thead>
            <tr style="background: #e2e8f0; font-size: 8.5pt;">
              <th style="width: 15%;">Faaliyet / Kategori</th>
              <th style="width: 15%;">Tehlike Tanımı</th>
              <th style="width: 15%;">Olası Risk / Sonuç</th>
              <th style="width: 8%; text-align: center;">İlk Risk (O x Ş = S)</th>
              <th style="width: 25%;">Alınan / Planlanan Önlemler</th>
              <th style="width: 8%; text-align: center;">Revize (O x Ş = S)</th>
              <th style="width: 14%;">Sorumlu / Takip</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${r.title}</strong><br><span style="color: #64748b; font-size: 8pt;">${r.siteOrCategory}</span></td>
              <td>${r.hazard}</td>
              <td>${r.consequence}</td>
              <td style="text-align: center;">
                <span style="font-size: 11pt; font-weight: bold; color: red;">${r.riskScore}</span><br>
                <span style="font-size: 7.5pt;">(${r.probability} x ${r.severity})</span><br>
                <strong style="font-size: 7.5pt; color: red;">YÜKSEK</strong>
              </td>
              <td>${r.existingControls}</td>
              <td style="text-align: center;">
                <span style="font-size: 11pt; font-weight: bold; color: green;">${r.residualRiskScore}</span><br>
                <span style="font-size: 7.5pt;">(${r.residualProbability} x ${r.residualSeverity})</span><br>
                <strong style="font-size: 7.5pt; color: green;">KABUL EDİLEBİLİR</strong>
              </td>
              <td>${r.responsiblePerson}</td>
            </tr>
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 40px; text-align: center;">
          <tr>
            <td style="width: 33%;">
              <strong>Risk Ekibi Üyesi / Saha Şefi</strong><br><br><br>
              İmza: .....................................
            </td>
            <td style="width: 33%;">
              <strong>İşveren Vekili / Santral Müdürü</strong><br><br><br>
              İmza: .....................................
            </td>
            <td style="width: 34%;">
              <strong>Demirer Holding İSG Uzmanı</strong><br><br>
              <strong>Sercan Yetgin</strong><br>
              İmza: .....................................
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).deleteRiskRecord = async (id: string) => {
  if (!confirm("Bu risk analizi kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteRiskAssessment(id);
    (window as any).showToast?.('Silindi', 'Risk analizi silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

// ----------------------------------------------------------------------
// 18. İSG SATIN ALMA & SİPARİŞ METOTLARI
// ----------------------------------------------------------------------
(window as any).openCreateProcurementModal = () => {
  const sites = dataService.getSortedSites();
  const siteOptions = sites.map(s => `<option value="${s.name}">${s.name}</option>`).join('');

  const modal = document.createElement('div');
  modal.id = 'create-procurement-modal';
  modal.className = 'modal-overlay';
  modal.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
    display: flex; align-items: center; justify-content: center; z-index: 9999;
  `;

  modal.innerHTML = `
    <div class="glass-panel" style="background: #0d1527; border: 1px solid rgba(16, 185, 129, 0.4); border-radius: 16px; width: 92%; max-width: 650px; max-height: 90vh; overflow-y: auto; padding: 1.5rem; box-shadow: 0 20px 50px rgba(0,0,0,0.8); color: #fff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="margin: 0; font-size: 1.2rem; font-weight: 900; color: #fff; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-cart-shopping" style="color: #10b981;"></i> Yeni İSG / KKD Malzeme Sipariş Talebi Aç
        </h3>
        <button onclick="document.getElementById('create-procurement-modal').remove()" style="background: none; border: none; color: #94a3b8; font-size: 1.2rem; cursor: pointer;">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.85rem;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Talep Eden Santral / Depo *</label>
            <select id="proc-site" class="cyber-input" style="width: 100%; padding: 0.65rem; background: #0f172a; border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;">
              <option value="Tüm Santraller (Merkez İSG Deposu)">Tüm Santraller (Merkez İSG Deposu)</option>
              ${siteOptions}
            </select>
          </div>
          <div>
            <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Tedarikçi / Önerilen Firma</label>
            <input type="text" id="proc-supplier" placeholder="Örn: Kaya Safety, 3M Türkiye veya Würth" class="cyber-input" style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;" />
          </div>
        </div>

        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label style="font-size: 0.75rem; color: #94a3b8; font-weight: 800; text-transform: uppercase;">Sipariş Edilecek Malzemeler:</label>
            <button type="button" onclick="window.addProcurementRow()" class="btn-cyber-mini" style="background: rgba(16, 185, 129, 0.2); color: #10b981; border: 1px solid #10b981; padding: 2px 8px; font-size: 0.72rem; cursor: pointer; border-radius: 4px;">
              <i class="fa-solid fa-plus"></i> Satır Ekle
            </button>
          </div>

          <div id="proc-items-container" style="display: flex; flex-direction: column; gap: 6px;">
            <div class="proc-item-row" style="display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 6px; align-items: center;">
              <input type="text" class="proc-name" placeholder="Malzeme Adı (Örn: S3 Emniyet Botu)" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.8rem;" />
              <input type="text" class="proc-size" placeholder="Beden/No (42, L...)" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #f59e0b; font-size: 0.8rem;" />
              <input type="number" class="proc-qty" min="1" value="1" placeholder="Adet" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #10b981; font-weight: 800; text-align: center; font-size: 0.8rem;" />
              <select class="proc-unit cyber-input" style="padding: 6px 8px; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.8rem;">
                <option value="Adet">Adet</option>
                <option value="Çift">Çift</option>
                <option value="Takım">Takım</option>
                <option value="Set">Set</option>
                <option value="Kutu">Kutu</option>
              </select>
              <button type="button" onclick="window.removeProcurementRow(this)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        </div>

        <div>
          <label style="display: block; font-size: 0.75rem; color: #94a3b8; font-weight: 800; margin-bottom: 4px;">Sipariş Gerekçesi & Notlar</label>
          <textarea id="proc-notes" class="cyber-input" rows="2" placeholder="Örn: 2026 İlkbahar bakım kampanyası için kışlık mont ve bot eksikleri." style="width: 100%; padding: 0.65rem; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 6px; color: #fff; box-sizing: border-box;"></textarea>
        </div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 1.5rem;">
        <button onclick="document.getElementById('create-procurement-modal').remove()" class="btn-cyber" style="background: rgba(255,255,255,0.06); color: #fff; padding: 0.6rem 1.1rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 700;">İptal</button>
        <button onclick="window.saveNewProcurement()" class="btn-cyber" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #fff; padding: 0.6rem 1.3rem; border-radius: 6px; cursor: pointer; font-size: 0.82rem; font-weight: 900; border: none;">
          <i class="fa-solid fa-check"></i> Sipariş Talebini Oluştur
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
};

(window as any).addProcurementRow = () => {
  const container = document.getElementById('proc-items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'proc-item-row';
  row.style.cssText = 'display: grid; grid-template-columns: 2fr 1fr 1fr 1fr auto; gap: 6px; align-items: center;';
  row.innerHTML = `
    <input type="text" class="proc-name" placeholder="Malzeme Adı" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.8rem;" />
    <input type="text" class="proc-size" placeholder="Beden/No" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #f59e0b; font-size: 0.8rem;" />
    <input type="number" class="proc-qty" min="1" value="1" placeholder="Adet" class="cyber-input" style="padding: 6px 8px; background: rgba(0,0,0,0.4); border: 1px solid #334155; border-radius: 4px; color: #10b981; font-weight: 800; text-align: center; font-size: 0.8rem;" />
    <select class="proc-unit cyber-input" style="padding: 6px 8px; background: #0f172a; border: 1px solid #334155; border-radius: 4px; color: #fff; font-size: 0.8rem;">
      <option value="Adet">Adet</option>
      <option value="Çift">Çift</option>
      <option value="Takım">Takım</option>
      <option value="Set">Set</option>
      <option value="Kutu">Kutu</option>
    </select>
    <button type="button" onclick="window.removeProcurementRow(this)" style="background: none; border: none; color: #ef4444; cursor: pointer; padding: 4px;">
      <i class="fa-solid fa-trash"></i>
    </button>
  `;
  container.appendChild(row);
};

(window as any).removeProcurementRow = (btn: HTMLElement) => {
  btn.closest('.proc-item-row')?.remove();
};

(window as any).saveNewProcurement = async () => {
  const siteEl = document.getElementById('proc-site') as HTMLSelectElement;
  const supEl = document.getElementById('proc-supplier') as HTMLInputElement;
  const notesEl = document.getElementById('proc-notes') as HTMLTextAreaElement;

  const rows = document.querySelectorAll('.proc-item-row');
  const items: Array<{ name: string; qty: number; unit: string; size?: string }> = [];

  rows.forEach(r => {
    const name = (r.querySelector('.proc-name') as HTMLInputElement)?.value?.trim();
    const size = (r.querySelector('.proc-size') as HTMLInputElement)?.value?.trim();
    const qty = parseInt((r.querySelector('.proc-qty') as HTMLInputElement)?.value || '1', 10);
    const unit = (r.querySelector('.proc-unit') as HTMLSelectElement)?.value || 'Adet';

    if (name) {
      items.push({ name, qty, unit, size: size || undefined });
    }
  });

  if (items.length === 0) {
    alert("Lütfen en az bir malzeme kalemi ekleyiniz.");
    return;
  }

  const orderNo = `ISG-SIP-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`;
  const requestDate = new Date().toLocaleDateString('tr-TR');

  const currentUser = (window as any).currentUser || authService.getCurrentUser();
  const createdBy = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'İSG Uzmanı';

  try {
    await isgService.createProcurement({
      orderNo,
      siteName: siteEl?.value || 'Merkez Depo',
      supplierName: supEl?.value?.trim() || undefined,
      items,
      requestDate,
      status: 'REQUESTED',
      notes: notesEl?.value?.trim() || undefined,
      createdBy
    });

    (window as any).showToast?.('Başarılı', `${orderNo} numaralı İSG siparişi oluşturuldu.`, 'success');
    document.getElementById('create-procurement-modal')?.remove();
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).updateProcurementStatus = async (id: string) => {
  const procs = await isgService.getProcurements();
  const proc = procs.find(p => p.id === id);
  if (!proc) return;

  const nextStatusMap: Record<string, any> = {
    'REQUESTED': 'ORDERED',
    'ORDERED': 'SHIPPED',
    'SHIPPED': 'DELIVERED',
    'DELIVERED': 'REQUESTED'
  };

  const nextStatusNames: Record<string, string> = {
    'REQUESTED': 'TALEP AÇILDI',
    'ORDERED': 'SİPARİŞ VERİLDİ',
    'SHIPPED': 'KARGODA / SEVK',
    'DELIVERED': 'TESLİM ALINDI'
  };

  const nextStatus = nextStatusMap[proc.status] || 'REQUESTED';
  if (!confirm(`Sipariş durumu "${nextStatusNames[nextStatus]}" olarak güncellensin mi?`)) return;

  try {
    await isgService.updateProcurement(id, { status: nextStatus });
    (window as any).showToast?.('Güncellendi', `Sipariş durumu: ${nextStatusNames[nextStatus]}`, 'success');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

(window as any).printProcurementDoc = async (id: string) => {
  const procs = await isgService.getProcurements();
  const proc = procs.find(p => p.id === id);
  if (!proc) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const itemsRows = (proc.items || []).map((item, idx) => `
    <tr>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #000; padding: 5px; font-weight: bold;">${item.name}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center;">${item.size || '-'}</td>
      <td style="border: 1px solid #000; padding: 5px; text-align: center; font-weight: bold;">${item.qty} ${item.unit}</td>
    </tr>
  `).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="tr">
    <head>
      <meta charset="UTF-8">
      <title>${proc.orderNo} - İSG & KKD Satın Alma Talep Formu</title>
      <style>
        @page { size: A4 portrait; margin: 10mm; }
        body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; margin: 0; padding: 0; background: #fff; }
        .page-container { width: 100%; max-width: 760px; margin: 0 auto; }
        .header-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .header-table td { border: 1px solid #000; padding: 6px; }
        .data-table { width: 100%; border-collapse: collapse; border: 2px solid #000; margin-bottom: 15px; }
        .no-print { margin-bottom: 12px; padding: 8px; background: #f1f5f9; display: flex; justify-content: space-between; align-items: center; }
        @media print { .no-print { display: none !important; } }
      </style>
    </head>
    <body>
      <div class="page-container">
        <div class="no-print">
          <span style="font-weight: bold;">İSG Malzeme Satın Alma / Sipariş Talep Formu</span>
          <button onclick="window.print()" style="padding: 6px 14px; background: #10b981; color: #fff; font-weight: bold; border: none; border-radius: 4px; cursor: pointer;">Yazdır / PDF Kaydet</button>
        </div>

        <table class="header-table">
          <tr>
            <td style="width: 25%; text-align: center;">
              <strong style="font-size: 14pt;">DEMİRER</strong><br>
              <span style="font-size: 8pt;">HOLDİNG</span>
            </td>
            <td style="width: 50%; text-align: center;">
              <strong style="font-size: 11pt;">İŞ SAĞLIĞI VE GÜVENLİĞİ BİRİMİ</strong><br>
              <strong style="font-size: 10pt;">KKD & EMNİYET DONANIMI SATIN ALMA TALEP FORMU</strong>
            </td>
            <td style="width: 25%; font-size: 8pt;">
              <strong>Sipariş No:</strong> ${proc.orderNo}<br>
              <strong>Talep Tarihi:</strong> ${proc.requestDate}<br>
              <strong>Santral:</strong> ${proc.siteName}
            </td>
          </tr>
        </table>

        <div style="border: 1px solid #000; padding: 8px; margin-bottom: 12px; font-size: 9pt;">
          <strong>Tedarikçi Firma / Tercih:</strong> ${proc.supplierName || 'Piyasa Araştırmasında'}<br>
          <strong>Teslimat Adresi:</strong> ${proc.siteName}<br>
          ${proc.notes ? `<strong>Açıklama / Not:</strong> ${proc.notes}` : ''}
        </div>

        <table class="data-table">
          <thead>
            <tr style="background: #e2e8f0; font-size: 9pt;">
              <th style="border: 1px solid #000; padding: 5px; width: 30px; text-align: center;">S.No</th>
              <th style="border: 1px solid #000; padding: 5px; text-align: left;">Malzeme Adı / Standardı</th>
              <th style="border: 1px solid #000; padding: 5px; width: 80px; text-align: center;">Beden / No</th>
              <th style="border: 1px solid #000; padding: 5px; width: 90px; text-align: center;">Miktar</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <table style="width: 100%; margin-top: 40px; text-align: center;">
          <tr>
            <td style="width: 50%;">
              <strong>Talep Eden / İSG Uzmanı</strong><br><br>
              <strong>${proc.createdBy || 'Sercan Yetgin'}</strong><br>
              İmza: .....................................
            </td>
            <td style="width: 50%;">
              <strong>Satın Alma Onayı (Yönetim)</strong><br><br><br>
              İmza: .....................................
            </td>
          </tr>
        </table>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
};

(window as any).deleteProcurementRecord = async (id: string) => {
  if (!confirm("Bu sipariş kaydını silmek istediğinizden emin misiniz?")) return;
  try {
    await isgService.deleteProcurement(id);
    (window as any).showToast?.('Silindi', 'Sipariş kaydı silindi.', 'info');
    if ((window as any).navigate) {
      (window as any).navigate('isg-management');
    }
  } catch (err: any) {
    alert("Hata: " + err);
  }
};

