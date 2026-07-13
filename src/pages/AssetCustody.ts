import { assetCustodyService } from '../services/AssetCustodyService';
import type { CustodyItem, CustodyHistoryEntry } from '../services/AssetCustodyService';
import { dataService } from '../services/DataService';
import { personnelService } from '../services/PersonnelService';
import { fileService } from '../services/FileService';

let allItems: CustodyItem[] = [];
let globalHistory: CustodyHistoryEntry[] = [];
let activeTab = 'list'; // 'list' or 'xray'
let filterTeam = 'all';
let filterPerson = 'all';
let filterCondition = 'all';
let filterLocation = 'all';
let searchQuery = '';

export const AssetCustodyPage = async () => {
  const currentUser = (window as any).currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN' || currentUser?.role?.toUpperCase() === 'MALZEME_YONETIMI';

  const hasCustodyPermission = (permId: string): boolean => {
    if (currentUser?.role?.toUpperCase() === 'ADMIN') return true;
    const custTab = currentUser?.allowedTabs?.['asset-custody'];
    if (!custTab) return false;
    if (custTab === true) return true;
    return !!custTab[permId];
  };

  const allowedTeams = dataService.getAllowedTeams();
  const allowedSiteIds = dataService.getSites().map(s => s.id);
  const allowedWarehouses = dataService.getWarehouses().filter(w => {
    if (isAdmin) return true;
    const siteId = dataService.getSiteIdByWarehouseId(w.id);
    return siteId && allowedSiteIds.includes(siteId);
  });

  let allowedPersonnelNames = personnelService.getPersonnelList();
  if (!isAdmin) {
    const details = personnelService.getPersonnelDetailsList();
    allowedPersonnelNames = allowedPersonnelNames.filter(name => {
      const d = details.find(det => det.name === name);
      if (!d) return false;
      if (d.team) {
        return allowedTeams.includes(d.team);
      }
      if (d.baseSites && d.baseSites.length > 0) {
        return d.baseSites.some(siteId => allowedSiteIds.includes(siteId));
      }
      return false;
    });
  }
  const showXray = hasCustodyPermission('viewCustodyXray');
  if (!showXray) {
    activeTab = 'list';
  }

  // Load and filter out Diğer
  const rawList = (await assetCustodyService.getAll()).filter(item => item.category !== 'Diğer');
  
  // Filter list by allowed regional teams for non-admins
  if (!isAdmin) {
    allItems = rawList.filter(item => allowedTeams.includes(item.assignedTeam));
  } else {
    allItems = rawList;
  }

  try {
    globalHistory = await assetCustodyService.getGlobalHistory();
  } catch (err) {
    globalHistory = [];
  }

  const storedFilterTeam = localStorage.getItem('custody_filter_team');
  if (storedFilterTeam) {
    filterTeam = storedFilterTeam;
  } else if (currentUser?.team && !isAdmin) {
    let cleanTeam = currentUser.team.trim();
    const match = cleanTeam.match(/^Team\s*0?(\d+)$/i);
    if (match) {
      cleanTeam = `Team ${String(match[1]).padStart(2, '0')}`;
    }
    filterTeam = cleanTeam;
  } else {
    filterTeam = 'all';
  }

  setTimeout(() => {
    (window as any).filterCustodyItems?.();
  }, 100);

  // Group items by product name/code for the Röntgen tab
  const groupedTools: Record<string, {
    productName: string;
    productCode: string;
    category: string;
    total: number;
    saglam: number;
    arizali: number;
    hurda: number;
    kayip: number;
    depo: number;
    team: number;
  }> = {};

  allItems.forEach(item => {
    const key = item.productName.trim().toLocaleLowerCase('tr-TR');
    if (!groupedTools[key]) {
      groupedTools[key] = {
        productName: item.productName,
        productCode: item.productCode || '-',
        category: item.category,
        total: 0,
        saglam: 0,
        arizali: 0,
        hurda: 0,
        kayip: 0,
        depo: 0,
        team: 0
      };
    }
    const g = groupedTools[key];
    const qty = item.quantity || 1;
    g.total += qty;
    if (item.condition === 'saglam') g.saglam += qty;
    else if (item.condition === 'arizali') g.arizali += qty;
    else if (item.condition === 'hurda') g.hurda += qty;
    else if (item.condition === 'kayip') g.kayip += qty;

    if (item.location === 'depo') g.depo += qty;
    else g.team += qty;
  });  const renderListTab = () => {
    let personnelNames = personnelService.getPersonnelList();
    if (!isAdmin) {
      const details = personnelService.getPersonnelDetailsList();
      personnelNames = personnelNames.filter(name => {
        const d = details.find(det => det.name === name);
        return !d || !d.team || allowedTeams.includes(d.team);
      });
    }

    return `
    <!-- FILTERS -->
    <div class="glass-panel fade-in-up" style="padding: 1rem; margin-bottom: 1.5rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
      <div style="position: relative; flex: 1; min-width: 200px;">
        <i class="fa-solid fa-search" style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 0.75rem;"></i>
        <input type="text" id="custody-search" placeholder="Ürün kodu, adı, seri no veya kişi ara..." 
          value="${searchQuery}"
          style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1); color: #fff; padding: 10px 12px 10px 36px; border-radius: 10px; font-size: 0.85rem; outline: none; box-sizing: border-box;"
          oninput="window.filterCustodyItems()">
      </div>
      <select id="custody-filter-team" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
        <option value="all" ${filterTeam === 'all' ? 'selected' : ''}>Tüm Ekipler</option>
        ${allowedTeams.map(teamName => `<option value="${teamName}" ${filterTeam === teamName ? 'selected' : ''}>${teamName}</option>`).join('')}
      </select>
      <select id="custody-filter-person" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none; max-width: 180px;">
        <option value="all" ${filterPerson === 'all' ? 'selected' : ''}>Tüm Personeller</option>
        ${personnelNames.map(name => `<option value="${name}" ${filterPerson === name ? 'selected' : ''}>${name}</option>`).join('')}
      </select>
      <select id="custody-filter-condition" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
        <option value="all" ${filterCondition === 'all' ? 'selected' : ''}>Tüm Durumlar</option>
        <option value="saglam" ${filterCondition === 'saglam' ? 'selected' : ''}>✅ Sağlam</option>
        <option value="arizali" ${filterCondition === 'arizali' ? 'selected' : ''}>⚠️ Arızalı</option>
        <option value="hurda" ${filterCondition === 'hurda' ? 'selected' : ''}>❌ Hurda</option>
        <option value="kayip" ${filterCondition === 'kayip' ? 'selected' : ''}>🔍 Kayıp</option>
      </select>
      <select id="custody-filter-location" onchange="window.filterCustodyItems()" style="background: rgba(0,0,0,0.3); color: #fff; border: 1px solid rgba(255,255,255,0.1); padding: 10px 12px; border-radius: 10px; font-size: 0.8rem; outline: none;">
        <option value="all" ${filterLocation === 'all' ? 'selected' : ''}>Tüm Lokasyonlar</option>
        <option value="person" ${filterLocation === 'person' ? 'selected' : ''}>👤 Kişide</option>
        <option value="team" ${filterLocation === 'team' ? 'selected' : ''}>👥 Ekipte</option>
        <option value="depo" ${filterLocation === 'depo' ? 'selected' : ''}>🏭 Depoda</option>
      </select>
    </div>

    <!-- TABLE -->
    <div class="glass-panel" style="padding: 0; overflow: hidden;">
      <div style="overflow-x: auto;">
        <table class="custody-table">
          <thead>
            <tr>
              <th>MALZEME KODU</th>
              <th>MALZEME ADI</th>
              <th>SERİ NUMARASI</th>
              <th style="text-align: center;">ADET</th>
              <th>KATEGORİ</th>
              <th>ZİMMETLİ KİŞİ / EKİP</th>
              <th>KONUM</th>
              <th>DURUM</th>
              <th>NOT</th>
              <th style="width: 80px; text-align: center;">İŞLEMLER</th>
            </tr>
          </thead>
          <tbody id="custody-table-body">
            ${allItems.length === 0 ? `
            <tr><td colspan="10" style="text-align: center; padding: 4rem; color: var(--text-muted);">
              <i class="fa-solid fa-toolbox" style="font-size: 2.5rem; opacity: 0.15; margin-bottom: 1rem; display: block;"></i>
              Henüz zimmet kaydı bulunmuyor. Yeni kayıt eklemek için üst kısımdaki butonu kullanın.
            </td></tr>
            ` : allItems.map(item => renderRow(item, hasCustodyPermission('assignCustody'), isAdmin)).join('')}
          </tbody>
        </table>
      </div>
    </div>
    `;
  };

  const renderXrayTab = () => {
    // Generate Team Scorecard statistics using global history
    const teamsScorecard: Record<string, {
      teamName: string;
      active: number;
      received: number;
      lost: number;
      scrapped: number;
      faulty: number;
    }> = {};

    // Seed teams 01-15
    for (let i = 1; i <= 15; i++) {
      const teamName = `Team ${String(i).padStart(2, '0')}`;
      teamsScorecard[teamName] = {
        teamName,
        active: 0,
        received: 0,
        lost: 0,
        scrapped: 0,
        faulty: 0
      };
    }

    // Active counts
    allItems.forEach(item => {
      if (item.assignedTeam && teamsScorecard[item.assignedTeam]) {
        teamsScorecard[item.assignedTeam].active += item.quantity || 1;
      }
    });

    // History calculations
    globalHistory.forEach(log => {
      const team = log.newTeam || log.oldTeam;
      if (team && teamsScorecard[team]) {
        const sc = teamsScorecard[team];
        const logQty = log.quantity || 1;
        // Count received (only if first assigned or transferred to this team from elsewhere)
        if (log.newTeam === team) {
          if (log.action === 'Oluşturuldu' || log.oldTeam !== team) {
            sc.received += logQty;
          }
        }

        // Count state transitions while associated with this team
        if (log.newCondition === 'kayip' && log.oldCondition !== 'kayip') {
          sc.lost += logQty;
        }
        if (log.oldCondition === 'kayip' && log.newCondition !== 'kayip') {
          sc.lost = Math.max(0, sc.lost - logQty);
        }

        if (log.newCondition === 'hurda' && log.oldCondition !== 'hurda') {
          sc.scrapped += logQty;
        }
        if (log.oldCondition === 'hurda' && log.newCondition !== 'hurda') {
          sc.scrapped = Math.max(0, sc.scrapped - logQty);
        }

        if (log.newCondition === 'arizali' && log.oldCondition !== 'arizali') {
          sc.faulty += logQty;
        }
      }
    });

    return `
      <!-- X-RAY GROUPS -->
      <div style="margin-bottom: 2rem;">
        <h2 style="font-family: 'Rajdhani'; font-size: 1.1rem; color: var(--accent-cyan); letter-spacing: 1px; margin-bottom: 1rem; text-transform: uppercase;">
          <i class="fa-solid fa-boxes-stacked"></i> El Aleti Grupları Envanter Özeti
        </h2>
        <div class="glass-panel" style="padding: 0; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table class="custody-table">
              <thead>
                <tr>
                  <th>MALZEME ADI</th>
                  <th>VARSAYILAN KOD</th>
                  <th>KATEGORİ</th>
                  <th style="text-align: center;">TOPLAM ADET</th>
                  <th style="text-align: center;">SAĞLAM</th>
                  <th style="text-align: center;">ARIZALI</th>
                  <th style="text-align: center;">HURDA</th>
                  <th style="text-align: center;">KAYIP</th>
                  <th>DAĞILIM</th>
                  <th style="width: 150px; text-align: center;">İŞLEM</th>
                </tr>
              </thead>
              <tbody>
                ${Object.keys(groupedTools).length === 0 ? `
                <tr><td colspan="10" style="text-align: center; padding: 4rem; color: var(--text-muted);">El aleti envanter verisi bulunamadı.</td></tr>
                ` : Object.values(groupedTools).map(g => `
                <tr>
                  <td><span class="custody-name">${g.productName}</span></td>
                  <td><span class="custody-code">${g.productCode}</span></td>
                  <td><span class="custody-cat-badge" style="background: rgba(255,255,255,0.05); color: #fff;">${g.category}</span></td>
                  <td style="text-align: center; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.95rem;">${g.total}</td>
                  <td style="text-align: center;"><span class="badge-saglam">${g.saglam}</span></td>
                  <td style="text-align: center;"><span class="badge-arizali">${g.arizali}</span></td>
                  <td style="text-align: center;"><span class="badge-hurda">${g.hurda}</span></td>
                  <td style="text-align: center;"><span class="badge-kayip">${g.kayip}</span></td>
                  <td style="font-size: 0.7rem; color: var(--text-muted); font-weight: 600;">
                    🏭 ${g.depo} Depoda &nbsp;|&nbsp; 👥 ${g.team} Ekipte
                  </td>
                  <td style="text-align: center;">
                    <button class="btn-cyber" onclick="window.openCustodyDetailsModal('${g.productName.replace(/'/g, "\\'")}')" style="padding: 4px 10px; font-size: 0.65rem; gap: 4px;">
                      <i class="fa-solid fa-chart-line"></i> ANALİZ & DETAY
                    </button>
                  </td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- TEAM SCORES / KARNE -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h2 style="font-family: 'Rajdhani'; font-size: 1.1rem; color: #a78bfa; letter-spacing: 1px; margin: 0; text-transform: uppercase;">
            <i class="fa-solid fa-medal"></i> Ekip Bazlı Alet Kullanım Karnesi
          </h2>
          <span style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">*GEÇMİŞ TRANSFER KAYITLARINDAN HESAPLANIR</span>
        </div>
        <div class="glass-panel" style="padding: 0; overflow: hidden;">
          <div style="overflow-x: auto;">
            <table class="custody-table">
              <thead>
                <tr>
                  <th>EKİP ADI</th>
                  <th style="text-align: center;">AKTİF ZİMMET SAYISI</th>
                  <th style="text-align: center;">TOPLAM ALINAN</th>
                  <th style="text-align: center;">KAYBEDİLEN ADET</th>
                  <th style="text-align: center;">HURDAYA DÖNEN ADET</th>
                  <th style="text-align: center;">ARIZALANAN ADET</th>
                  <th>GÜVEN ENDEKSİ</th>
                </tr>
              </thead>
              <tbody>
                ${Object.values(teamsScorecard).map(sc => {
                  const lostRatio = sc.received > 0 ? (sc.lost / sc.received) : 0;
                  const scrapRatio = sc.received > 0 ? (sc.scrapped / sc.received) : 0;
                  
                  // Score from 100
                  let trustScore = 100 - (lostRatio * 150) - (scrapRatio * 50);
                  if (trustScore < 0) trustScore = 0;
                  if (sc.received === 0) trustScore = 100;
                  
                  let scoreColor = '#10b981';
                  let scoreText = 'MÜKEMMEL';
                  if (trustScore < 50) {
                    scoreColor = '#ef4444';
                    scoreText = 'RİSKLİ ⚠️';
                  } else if (trustScore < 85) {
                    scoreColor = '#f59e0b';
                    scoreText = 'ORTA';
                  }

                  return `
                  <tr>
                    <td><span class="custody-team-tag" style="font-size: 0.75rem; padding: 4px 10px;">${sc.teamName}</span></td>
                    <td style="text-align: center; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.95rem;">${sc.active}</td>
                    <td style="text-align: center; font-weight: 700; color: #a78bfa; font-family: 'Rajdhani';">${sc.received}</td>
                    <td style="text-align: center; font-weight: 800; color: #f59e0b; font-family: 'Rajdhani';">${sc.lost > 0 ? `${sc.lost} 🔍` : '0'}</td>
                    <td style="text-align: center; font-weight: 800; color: #ef4444; font-family: 'Rajdhani';">${sc.scrapped}</td>
                    <td style="text-align: center; font-weight: 700; color: #ea580c; font-family: 'Rajdhani';">${sc.faulty}</td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.05); border-radius: 3px; overflow: hidden; max-width: 100px;">
                          <div style="width: ${trustScore}%; height: 100%; background: ${scoreColor}; border-radius: 3px;"></div>
                        </div>
                        <span style="font-weight: 800; font-size: 0.7rem; color: ${scoreColor}; font-family: 'Rajdhani';">${Math.round(trustScore)}% (${scoreText})</span>
                      </div>
                    </td>
                  </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  return `
    <div class="fade-in-up content-area" style="padding: 1rem;">
      <!-- HEADER -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
        <div>
          <h1 class="page-title" style="margin: 0; display: flex; align-items: center; gap: 12px;">
            <i class="fa-solid fa-screwdriver-wrench" style="color: #f59e0b;"></i> Zimmetli El Aletleri
          </h1>
          <p style="color: var(--text-muted); font-size: 0.8rem; margin: 4px 0 0 0;">Demirbaş el aletlerinin ve ölçüm cihazlarının seri numaralarıyla takibi ve kullanım analizleri</p>
        </div>
        ${hasCustodyPermission('assignCustody') ? `
        <button class="btn-cyber" onclick="window.openCustodyModal()" style="gap: 8px;">
          <i class="fa-solid fa-plus"></i> YENİ ZİMMET KAYDI
        </button>
        ` : ''}
      </div>

      <!-- TABS -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 0px;">
        <button class="tab-btn ${activeTab === 'list' ? 'active' : ''}" onclick="window.switchCustodyTab('list')" 
          style="background: transparent; border: none; color: ${activeTab === 'list' ? 'var(--accent-cyan)' : 'var(--text-muted)'}; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.95rem; padding: 12px 20px; cursor: pointer; border-bottom: 2px solid ${activeTab === 'list' ? 'var(--accent-cyan)' : 'transparent'}; letter-spacing: 1px;">
          <i class="fa-solid fa-list-check" style="margin-right: 6px;"></i> ZİMMET LİSTESİ
        </button>
        ${showXray ? `
        <button class="tab-btn ${activeTab === 'xray' ? 'active' : ''}" onclick="window.switchCustodyTab('xray')" 
          style="background: transparent; border: none; color: ${activeTab === 'xray' ? 'var(--accent-cyan)' : 'var(--text-muted)'}; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.95rem; padding: 12px 20px; cursor: pointer; border-bottom: 2px solid ${activeTab === 'xray' ? 'var(--accent-cyan)' : 'transparent'}; letter-spacing: 1px;">
          <i class="fa-solid fa-shield-halved" style="margin-right: 6px;"></i> ENVANTER RÖNTGENİ & KARNE
        </button>
        ` : ''}
      </div>

      <!-- STATS STRIP -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
        <div class="glass-panel animate-card" style="padding: 1rem; border-left: 3px solid #10b981; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'saglam').reduce((sum, i) => sum + (i.quantity || 1), 0)}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">SAĞLAM</div>
        </div>
        <div class="glass-panel animate-card" style="padding: 1rem; border-left: 3px solid #f59e0b; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #f59e0b; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'arizali').reduce((sum, i) => sum + (i.quantity || 1), 0)}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">ARIZALI</div>
        </div>
        <div class="glass-panel animate-card" style="padding: 1rem; border-left: 3px solid #ef4444; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #ef4444; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'hurda').reduce((sum, i) => sum + (i.quantity || 1), 0)}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">HURDA</div>
        </div>
        <div class="glass-panel animate-card" style="padding: 1rem; border-left: 3px solid #a78bfa; text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: #a78bfa; font-family: 'Rajdhani';">${allItems.filter(i => i.condition === 'kayip').reduce((sum, i) => sum + (i.quantity || 1), 0)}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">KAYIP</div>
        </div>
        <div class="glass-panel animate-card" style="padding: 1rem; border-left: 3px solid var(--accent-cyan); text-align: center;">
          <div style="font-size: 1.6rem; font-weight: 900; color: var(--accent-cyan); font-family: 'Rajdhani';">${allItems.reduce((sum, i) => sum + (i.quantity || 1), 0)}</div>
          <div style="font-size: 0.65rem; color: var(--text-muted); font-weight: 800; letter-spacing: 1px;">TOPLAM</div>
        </div>
      </div>

      <!-- TAB CONTENT -->
      ${activeTab === 'list' ? renderListTab() : renderXrayTab()}

    </div>

    <!-- DATALISTS FOR AUTOCOMPLETE -->
    <datalist id="personnel-datalist">
      ${allowedPersonnelNames.map(name => `<option value="${name}">`).join('')}
    </datalist>

    <!-- ADD/EDIT MODAL -->
    <div id="custody-modal" class="modal-overlay hidden" style="z-index: 99999;">
      <div class="glass-panel modal-content-box" style="max-width: 550px; width: 95%; margin: auto; border: 1px solid rgba(167, 139, 250, 0.3); box-shadow: 0 0 30px rgba(167,139,250,0.1);">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(167,139,250,0.05);">
          <h3 style="margin: 0; font-family: 'Rajdhani'; font-size: 1.2rem; color: #a78bfa; letter-spacing: 1px;" id="custody-modal-title">
            <i class="fa-solid fa-screwdriver-wrench"></i> YENİ ZİMMET KAYDI
          </h3>
          <button onclick="window.closeCustodyModal()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 0.85rem;">
          <input type="hidden" id="custody-edit-id">
          
          <!-- Row 1: Code (35%), Name (50%), Qty (15%) -->
          <div style="display: grid; grid-template-columns: 1.2fr 2fr 0.7fr; gap: 0.75rem;">
            <div>
              <label style="font-size: 0.6rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">MALZEME KODU</label>
              <input type="text" id="custody-code" class="cyber-input" placeholder="SAP Kodu..." style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">MALZEME ADI (ZORUNLU)</label>
              <input type="text" id="custody-name" class="cyber-input" placeholder="Ör: 1/2 Tork Anahtarı" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">ADET</label>
              <input type="number" id="custody-quantity" class="cyber-input" min="1" value="1" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem; text-align: center;">
            </div>
          </div>

          <!-- Row 2: Serial (50%), Category (50%) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">SERİ NUMARASI (OPSİYONEL)</label>
              <input type="text" id="custody-serial" class="cyber-input" placeholder="SN-29481..." style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">KATEGORİ</label>
              <select id="custody-category" class="cyber-input" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
                <option value="El Aleti">🔧 El Aleti</option>
                <option value="Ölçü Aleti">📏 Ölçü Aleti</option>
                <option value="Elektrik Aleti">⚡ Elektrik Aleti</option>
                <option value="Güvenlik Ekipmanı">🦺 Güvenlik Ekipmanı</option>
                <option value="Hidrolik Ekipman">🔴 Hidrolik Ekipman</option>
              </select>
            </div>
          </div>

          <!-- Row 3: Person (50%), Team (50%) -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">ZİMMETLİ KİŞİ</label>
              <input type="text" id="custody-person" class="cyber-input" list="personnel-datalist" placeholder="İsim arayın..." style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;" oninput="window.handleModalPersonChange()">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">ZİMMETLİ EKİP</label>
              <select id="custody-team" class="cyber-input" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;" onchange="window.filterModalPersonnelByTeam()">
                <option value="">Seçiniz</option>
                ${allowedTeams.map(teamName => `<option value="${teamName}">${teamName}</option>`).join('')}
              </select>
            </div>
          </div>

          <!-- Row 4: Flexbox for Location, Warehouse, and Condition -->
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <div style="flex: 1; min-width: 130px;">
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">KONUM LOKASYONU</label>
              <select id="custody-location" class="cyber-input" onchange="window.toggleCustodyWarehouse()" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
                <option value="person">👤 Kişide</option>
                <option value="team">👥 Ekipte</option>
                <option value="depo">🏭 Depoda</option>
              </select>
            </div>
            <div id="custody-warehouse-group" style="flex: 1; min-width: 130px; display: none;">
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">DEPO LOKASYONU</label>
              <select id="custody-warehouse" class="cyber-input" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
                ${allowedWarehouses.map(w => `<option value="${w.id}">${w.name}</option>`).join('')}
              </select>
            </div>
            <div id="custody-condition-group" style="flex: 1; min-width: 130px;">
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">CİHAZ DURUMU</label>
              <select id="custody-condition" class="cyber-input" style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
                <option value="saglam">✅ Sağlam</option>
                <option value="arizali">⚠️ Arızalı</option>
                <option value="hurda">❌ Hurda</option>
                <option value="kayip">🔍 Kayıp</option>
              </select>
            </div>
          </div>

          <!-- Row 5: Notes & Photo (50% / 50%) -->
          <div style="display: grid; grid-template-columns: 1.2fr 1fr; gap: 0.75rem; align-items: flex-end;">
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">DURUM NOTU / TESLİMAT NOTU (Opsiyonel)</label>
              <input type="text" id="custody-condition-note" class="cyber-input" placeholder="Arıza detayları veya not..." style="width: 100%; box-sizing: border-box; height: 34px; font-size: 0.75rem;">
            </div>
            <div>
              <label style="font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 4px; display: block;">ÜRÜN FOTOĞRAFI (Opsiyonel)</label>
              <div style="display: flex; gap: 0.5rem; align-items: center; height: 34px;">
                <button type="button" class="btn-cyber-outline" style="font-size: 0.7rem; padding: 0 10px; height: 34px; display: flex; align-items: center; gap: 4px; white-space: nowrap; justify-content: center;" onclick="document.getElementById('custody-photo-input').click()">
                  <i class="fa-solid fa-camera"></i> Fotoğraf Seç
                </button>
                <input type="file" id="custody-photo-input" accept="image/*" style="display: none;" onchange="window.handleCustodyPhotoUpload(event)">
                <div id="custody-photo-preview-container" style="display: none; position: relative; width: 34px; height: 34px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.15); flex-shrink: 0;">
                  <img id="custody-photo-preview" style="width: 100%; height: 100%; object-fit: cover;">
                  <button type="button" onclick="window.clearCustodyPhoto()" style="position: absolute; top: 1px; right: 1px; background: rgba(220,38,38,0.85); color: white; border: none; border-radius: 50%; width: 12px; height: 12px; font-size: 0.5rem; display: flex; align-items: center; justify-content: center; cursor: pointer; line-height: 1;">×</button>
                </div>
                <span id="custody-photo-status" style="font-size: 0.65rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 60px;">Yok</span>
              </div>
              <input type="hidden" id="custody-photo-url" value="">
            </div>
          </div>

          <!-- Buttons Footer (50% / 50%) -->
          <div style="display: flex; gap: 0.75rem; margin-top: 0.5rem;">
            <button onclick="window.closeCustodyModal()" class="btn-cyber-outline" style="flex: 1; height: 36px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center;">VAZGEÇ</button>
            <button onclick="window.saveCustodyItem()" class="btn-cyber" style="flex: 1; height: 36px; font-size: 0.8rem; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <i class="fa-solid fa-floppy-disk"></i> KAYDET
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- DETAILS & HISTORY MODAL -->
    <div id="custody-details-modal" class="modal-overlay hidden" style="z-index: 99999;">
      <div class="glass-panel" style="max-width: 750px; width: 95%; margin: auto; max-height: 85vh; overflow-y: auto;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,242,254,0.05);">
          <h3 style="margin: 0; font-family: 'Rajdhani'; font-size: 1.2rem; color: var(--accent-cyan); letter-spacing: 1px;" id="details-modal-title">
            <i class="fa-solid fa-chart-pie"></i> MALZEME DETAYI VE GEÇMİŞİ
          </h3>
          <button onclick="window.closeCustodyDetailsModal()" style="background: transparent; border: none; color: var(--text-muted); cursor: pointer; font-size: 1.2rem;">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Tool Distribution Detail -->
          <div>
            <h4 style="margin: 0 0 0.75rem 0; font-size: 0.8rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Aktif Cihaz Dağılım Listesi</h4>
            <div class="glass-panel" style="padding: 0; overflow: hidden;">
              <table class="custody-table" style="font-size: 0.75rem;">
                <thead>
                  <tr>
                    <th>SERİ NO</th>
                    <th style="text-align: center;">ADET</th>
                    <th>ZİMMETLİ KİŞİ / EKİP</th>
                    <th>KONUM LOKASYONU</th>
                    <th>DURUM</th>
                    <th>DURUM NOTU</th>
                  </tr>
                </thead>
                <tbody id="details-distribution-tbody"></tbody>
              </table>
            </div>
          </div>

          <!-- Tool History Timeline -->
          <div>
            <h4 style="margin: 0 0 0.75rem 0; font-size: 0.8rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase;">Zimmet & Durum Değişiklik Geçmişi</h4>
            <div id="details-history-timeline" style="display: flex; flex-direction: column; gap: 10px; max-height: 250px; overflow-y: auto; padding: 0.5rem; background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.03);">
              <!-- Timeline logs here -->
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button onclick="window.closeCustodyDetailsModal()" class="btn-cyber" style="width: 150px; justify-content: center;">KAPAT</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Custody Image Preview Modal -->
    <div id="custody-image-modal" class="modal-overlay hidden" style="z-index: 100000; display: flex; align-items: center; justify-content: center; padding: 2rem;">
      <div class="glass-panel" style="max-width: 600px; width: 100%; position: relative; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
        <button onclick="window.closeCustodyImageModal()" style="position: absolute; top: 1rem; right: 1rem; background: transparent; border: none; color: var(--text-muted); font-size: 1.25rem; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='var(--accent-cyan)'" onmouseout="this.style.color='var(--text-muted)'">
          <i class="fa-solid fa-xmark"></i>
        </button>
        <h3 id="custody-image-modal-title" style="margin: 0; font-family: 'Rajdhani', sans-serif; font-weight: 800; font-size: 1.2rem; color: var(--accent-cyan); text-transform: uppercase;">Alet Fotoğrafı</h3>
        <div style="width: 100%; max-height: 450px; border-radius: 8px; overflow: hidden; border: 1px solid rgba(255,255,255,0.08); background: #000; display: flex; align-items: center; justify-content: center;">
          <img id="custody-image-modal-img" style="max-width: 100%; max-height: 450px; object-fit: contain;">
        </div>
      </div>
    </div>

    <style>
      .tab-btn { transition: all 0.2s; }
      .tab-btn:hover { color: var(--accent-cyan) !important; background: rgba(0,242,254,0.02) !important; }
      .tab-btn.active { text-shadow: 0 0 10px rgba(0,242,254,0.5); }
      .custody-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
      .custody-table thead { background: rgba(0,0,0,0.3); }
      .custody-table th { padding: 1rem; text-align: left; font-size: 0.6rem; font-weight: 900; color: var(--text-muted); letter-spacing: 1.5px; text-transform: uppercase; border-bottom: 2px solid rgba(255,255,255,0.05); white-space: nowrap; }
      .custody-table td { padding: 0.85rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.03); vertical-align: middle; }
      .custody-table tbody tr { transition: all 0.2s; }
      .custody-table tbody tr:hover { background: rgba(167, 139, 250, 0.03); }
      .custody-code { font-family: 'Rajdhani', monospace; font-weight: 800; color: var(--accent-cyan); font-size: 0.85rem; }
      .custody-name { font-weight: 700; color: var(--text-main); }
      .custody-cat-badge { font-size: 0.6rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-person { font-weight: 600; color: var(--text-main); font-size: 0.8rem; }
      .custody-team-tag { font-size: 0.6rem; font-weight: 800; color: #a78bfa; background: rgba(167,139,250,0.1); border: 1px solid rgba(167,139,250,0.2); padding: 2px 8px; border-radius: 12px; display: inline-block; }
      .custody-loc-badge { font-size: 0.6rem; font-weight: 800; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-loc-badge.team { background: rgba(0,242,254,0.1); color: var(--accent-cyan); border: 1px solid rgba(0,242,254,0.2); }
      .custody-loc-badge.depo { background: rgba(167,139,250,0.1); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }
      .custody-loc-badge.person { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
      
      .custody-cond-badge { font-size: 0.6rem; font-weight: 900; padding: 3px 10px; border-radius: 20px; display: inline-block; }
      .custody-cond-badge.saglam { background: rgba(16,185,129,0.15); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }
      .custody-cond-badge.arizali { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
      .custody-cond-badge.hurda { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
      .custody-cond-badge.kayip { background: rgba(167,139,250,0.15); color: #a78bfa; border: 1px solid rgba(167,139,250,0.2); }

      .badge-saglam { background: rgba(16,185,129,0.15); color: #10b981; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.85rem; }
      .badge-arizali { background: rgba(245,158,11,0.15); color: #f59e0b; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.85rem; }
      .badge-hurda { background: rgba(239,68,68,0.15); color: #ef4444; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.85rem; }
      .badge-kayip { background: rgba(167,139,250,0.15); color: #a78bfa; padding: 2px 8px; border-radius: 10px; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.85rem; }

      .custody-action-btn { background: transparent; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 6px; transition: all 0.2s; font-size: 0.85rem; }
      .custody-action-btn:hover { color: var(--accent-cyan); background: rgba(0,242,254,0.1); }
      .custody-action-btn.red:hover { color: #ef4444; background: rgba(239,68,68,0.1); }
      .custody-note-text { font-size: 0.7rem; color: var(--text-muted); max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: inline-block; }
      
      .history-log-row { display: flex; flex-direction: column; gap: 4px; padding: 8px 12px; border-radius: 6px; background: rgba(255,255,255,0.01); border-left: 3px solid var(--accent-cyan); font-size: 0.75rem; }
      .history-log-row.created { border-left-color: #10b981; }
      .history-log-row.deleted { border-left-color: #ef4444; }
      .history-log-row.condition { border-left-color: #f59e0b; }
      
      .animate-card { transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
      .animate-card:hover { transform: translateY(-3px); box-shadow: 0 5px 15px rgba(0,242,254,0.15); }
    </style>
  `;
};

function renderRow(item: CustodyItem, canEdit: boolean, isAdminUser: boolean): string {
  const condLabel: Record<string, string> = { saglam: '✅ Sağlam', arizali: '⚠️ Arızalı', hurda: '❌ Hurda', kayip: '🔍 Kayıp' };
  const catColors: Record<string, string> = { 
    'El Aleti': 'rgba(245,158,11,0.15)', 
    'Ölçü Aleti': 'rgba(59,130,246,0.15)',
    'Elektrik Aleti': 'rgba(234,179,8,0.15)',
    'Güvenlik Ekipmanı': 'rgba(16,185,129,0.15)',
    'Hidrolik Ekipman': 'rgba(239,68,68,0.15)',
    'Diğer': 'rgba(255,255,255,0.05)' 
  };
  
  return `
    <tr data-team="${item.assignedTeam}" data-person="${item.assignedTo || ''}" data-condition="${item.condition}" data-location="${item.location}" data-search="${(item.productCode + ' ' + item.productName + ' ' + (item.serialNo || '') + ' ' + item.assignedTo + ' ' + item.description).toLowerCase()}">
      <td><span class="custody-code">${item.productCode || '-'}</span></td>
      <td>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${item.imageUrl ? `
            <div style="position: relative; width: 32px; height: 32px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" onclick="window.showCustodyImageModal('${item.productName.replace(/'/g, "\\'")}', '${item.imageUrl}')">
              <img src="${item.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
            </div>
          ` : `
            <div style="width: 32px; height: 32px; border-radius: 4px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.75rem;">
              <i class="fa-solid fa-image"></i>
            </div>
          `}
          <span class="custody-name">${item.productName}</span>
        </div>
      </td>
      <td><span style="font-weight: 700; color: #fff; font-family: monospace; font-size: 0.8rem;">${item.serialNo || '-'}</span></td>
      <td style="text-align: center; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.95rem; color: #fff;">${item.quantity || 1}</td>
      <td><span class="custody-cat-badge" style="background: ${catColors[item.category] || catColors['Diğer']}; color: var(--text-main);">${item.category}</span></td>
      <td>
        <div class="custody-person">${item.assignedTo || '-'}</div>
        ${item.assignedTeam ? `<span class="custody-team-tag">${item.assignedTeam}</span>` : ''}
      </td>
      <td><span class="custody-loc-badge ${item.location}">${item.location === 'team' ? '👥 Ekipte' : (item.location === 'depo' ? '🏭 Depoda' : '👤 Kişide')}</span></td>
      <td><span class="custody-cond-badge ${item.condition}">${condLabel[item.condition] || 'Bilinmiyor'}</span></td>
      <td><span class="custody-note-text" title="${item.conditionNote || ''}">${item.conditionNote || '-'}</span></td>
      <td style="white-space: nowrap; text-align: center;">
        ${canEdit ? `
          <button class="custody-action-btn" onclick="window.editCustodyItem('${item.id}')" title="Düzenle"><i class="fa-solid fa-pencil"></i></button>
        ` : ''}
        ${isAdminUser ? `
          <button class="custody-action-btn red" onclick="window.deleteCustodyItem('${item.id}')" title="Sil"><i class="fa-solid fa-trash"></i></button>
        ` : ''}
        ${!canEdit && !isAdminUser ? '-' : ''}
      </td>
    </tr>
  `;
}

// === WINDOW FUNCTIONS ===
(window as any).filterModalPersonnelByTeam = () => {
  const teamSelect = document.getElementById('custody-team') as HTMLSelectElement;
  const selectedTeam = teamSelect?.value || '';
  const datalist = document.getElementById('personnel-datalist');
  if (!datalist) return;

  const details = personnelService.getPersonnelDetailsList();
  let filtered = personnelService.getPersonnelList();

  const user = (window as any).currentUser || JSON.parse(localStorage.getItem('currentUser') || '{}');
  const isAdminUser = user?.role?.toUpperCase() === 'ADMIN' || user?.role?.toUpperCase() === 'MALZEME_YONETIMI';
  const regionalTeams = dataService.getAllowedTeams();
  const allowedSiteIds = dataService.getSites().map(s => s.id);

  if (selectedTeam) {
    filtered = filtered.filter(name => {
      const d = details.find(det => det.name === name);
      return d && d.team === selectedTeam;
    });
  } else {
    if (!isAdminUser) {
      filtered = filtered.filter(name => {
        const d = details.find(det => det.name === name);
        if (!d) return false;
        if (d.team) {
          return regionalTeams.includes(d.team);
        }
        if (d.baseSites && d.baseSites.length > 0) {
          return d.baseSites.some(siteId => allowedSiteIds.includes(siteId));
        }
        return false;
      });
    }
  }

  datalist.innerHTML = filtered.map(name => `<option value="${name}">`).join('');
};

(window as any).handleModalPersonChange = () => {
  const personInput = document.getElementById('custody-person') as HTMLInputElement;
  const personName = personInput?.value || '';
  const teamSelect = document.getElementById('custody-team') as HTMLSelectElement;
  if (!personName || !teamSelect) return;

  const details = personnelService.getPersonnelDetailsList();
  const d = details.find(det => det.name.toLowerCase() === personName.toLowerCase());
  if (d && d.team) {
    teamSelect.value = d.team;
    (window as any).filterModalPersonnelByTeam();
  }
};

(window as any).switchCustodyTab = (tab: string) => {
  activeTab = tab;
  (window as any).navigate('asset-custody');
};

(window as any).openCustodyModal = (editItem?: CustodyItem) => {
  const modal = document.getElementById('custody-modal');
  const title = document.getElementById('custody-modal-title');
  if (!modal) return;
  
  // Reset form
  (document.getElementById('custody-edit-id') as HTMLInputElement).value = editItem?.id || '';
  (document.getElementById('custody-code') as HTMLInputElement).value = editItem?.productCode || '';
  (document.getElementById('custody-name') as HTMLInputElement).value = editItem?.productName || '';
  (document.getElementById('custody-serial') as HTMLInputElement).value = editItem?.serialNo || '';
  (document.getElementById('custody-category') as HTMLSelectElement).value = editItem?.category || 'El Aleti';
  (document.getElementById('custody-quantity') as HTMLInputElement).value = String(editItem?.quantity || 1);

  (document.getElementById('custody-person') as HTMLInputElement).value = editItem?.assignedTo || '';
  (document.getElementById('custody-team') as HTMLSelectElement).value = editItem?.assignedTeam || '';
  (document.getElementById('custody-location') as HTMLSelectElement).value = editItem?.location || 'team';
  (document.getElementById('custody-condition') as HTMLSelectElement).value = editItem?.condition || 'saglam';
  (document.getElementById('custody-condition-note') as HTMLInputElement).value = editItem?.conditionNote || '';
  
  const imageUrl = editItem?.imageUrl || '';
  (document.getElementById('custody-photo-url') as HTMLInputElement).value = imageUrl;
  const previewContainer = document.getElementById('custody-photo-preview-container');
  const previewImg = document.getElementById('custody-photo-preview') as HTMLImageElement;
  const statusSpan = document.getElementById('custody-photo-status');
  if (imageUrl) {
    if (previewImg) previewImg.src = imageUrl;
    if (previewContainer) previewContainer.style.display = 'block';
    if (statusSpan) statusSpan.innerHTML = '<span style="color: #10b981; font-weight: 800;">✓ Fotoğraf Yüklendi</span>';
  } else {
    if (previewImg) previewImg.src = '';
    if (previewContainer) previewContainer.style.display = 'none';
    if (statusSpan) statusSpan.innerText = 'Fotoğraf eklenmedi';
  }
  
  if (editItem?.warehouseId) {
    (document.getElementById('custody-warehouse') as HTMLSelectElement).value = editItem.warehouseId;
  }
  
  if (title) title.innerHTML = editItem 
    ? '<i class="fa-solid fa-pencil"></i> ZİMMET KAYDINI DÜZENLE' 
    : '<i class="fa-solid fa-screwdriver-wrench"></i> YENİ ZİMMET KAYDI';
  
  (window as any).toggleCustodyWarehouse();
  (window as any).filterModalPersonnelByTeam();
  modal.classList.remove('hidden');
};

(window as any).closeCustodyModal = () => {
  document.getElementById('custody-modal')?.classList.add('hidden');
};

(window as any).toggleCustodyWarehouse = () => {
  const loc = (document.getElementById('custody-location') as HTMLSelectElement)?.value;
  const whGroup = document.getElementById('custody-warehouse-group');
  if (whGroup) whGroup.style.display = loc === 'depo' ? 'block' : 'none';
};

(window as any).saveCustodyItem = async () => {
  const id = (document.getElementById('custody-edit-id') as HTMLInputElement).value;
  const data = {
    productCode: (document.getElementById('custody-code') as HTMLInputElement).value.trim(),
    productName: (document.getElementById('custody-name') as HTMLInputElement).value.trim(),
    serialNo: (document.getElementById('custody-serial') as HTMLInputElement).value.trim(),
    category: (document.getElementById('custody-category') as HTMLSelectElement).value,
    description: '',
    assignedTo: (document.getElementById('custody-person') as HTMLInputElement).value.trim(),
    assignedTeam: (document.getElementById('custody-team') as HTMLSelectElement).value,
    location: (document.getElementById('custody-location') as HTMLSelectElement).value as 'team' | 'depo' | 'person',
    warehouseId: (document.getElementById('custody-warehouse') as HTMLSelectElement)?.value || '',
    condition: (document.getElementById('custody-condition') as HTMLSelectElement).value as 'saglam' | 'arizali' | 'hurda' | 'kayip',
    conditionNote: (document.getElementById('custody-condition-note') as HTMLInputElement).value.trim(),
    createdBy: (window as any).currentUser?.displayName || 'Admin',
    imageUrl: (document.getElementById('custody-photo-url') as HTMLInputElement).value,
    quantity: parseInt((document.getElementById('custody-quantity') as HTMLInputElement).value) || 1
  };

  if (!data.productName) {
    (window as any).showToast?.('HATA', 'Malzeme adı zorunludur.', 'error');
    return;
  }

  if (data.location === 'person' && !data.assignedTo) {
    (window as any).showToast?.('HATA', 'Konum "Kişide" ise Zimmetli Kişi alanı zorunludur.', 'error');
    return;
  }

  // Strictly validate that assignedTo is a real personnel in datalist if a name is provided
  if (data.assignedTo) {
    const validPersonnel = personnelService.getPersonnelList();
    const match = validPersonnel.find(p => p.toLocaleLowerCase('tr-TR') === data.assignedTo.toLocaleLowerCase('tr-TR'));
    if (!match) {
      (window as any).showToast?.('HATA', 'Zimmetlenecek kişi personel listesinde bulunamadı. Lütfen listeden seçin.', 'error');
      return;
    }
    data.assignedTo = match; // Normalize case
  }

  try {
    if (id) {
      // Fetch original item to compare and write log
      const original = allItems.find(i => i.id === id);
      await assetCustodyService.update(id, data);

      // Audit trail logging
      if (original) {
        let action = 'Zimmet Güncellendi';
        if (original.assignedTo !== data.assignedTo || original.assignedTeam !== data.assignedTeam) {
          action = 'Zimmet Değiştirildi';
        } else if (original.condition !== data.condition) {
          action = 'Durum Güncellendi';
        }
        await assetCustodyService.addHistoryLog({
          itemId: id,
          productCode: data.productCode,
          productName: data.productName,
          serialNo: data.serialNo,
          quantity: data.quantity,
          action,
          oldAssignee: original.assignedTo,
          oldTeam: original.assignedTeam,
          newAssignee: data.assignedTo,
          newTeam: data.assignedTeam,
          oldCondition: original.condition,
          newCondition: data.condition,
          note: data.conditionNote || `${action} yapıldı.`,
          by: (window as any).currentUser?.displayName || 'Admin'
        });
      }

      (window as any).showToast?.('BAŞARILI', 'Zimmet kaydı güncellendi.', 'success');
    } else {
      const newId = await assetCustodyService.add(data);
      
      // Write creation log
      await assetCustodyService.addHistoryLog({
        itemId: newId,
        productCode: data.productCode,
        productName: data.productName,
        serialNo: data.serialNo,
        quantity: data.quantity,
        action: 'Oluşturuldu',
        newAssignee: data.assignedTo,
        newTeam: data.assignedTeam,
        newCondition: data.condition,
        note: data.conditionNote || 'İlk zimmet kaydı oluşturuldu.',
        by: (window as any).currentUser?.displayName || 'Admin'
      });

      (window as any).showToast?.('BAŞARILI', 'Yeni zimmet kaydı eklendi.', 'success');
    }
    (window as any).closeCustodyModal();
    (window as any).navigate('asset-custody');
  } catch (e) {
    (window as any).showToast?.('HATA', 'Kayıt sırasında bir hata oluştu.', 'error');
  }
};

(window as any).editCustodyItem = (id: string) => {
  const item = allItems.find(i => i.id === id);
  if (item) (window as any).openCustodyModal(item);
};

(window as any).deleteCustodyItem = async (id: string) => {
  if (!confirm('Bu zimmet kaydını silmek istediğinize emin misiniz?')) return;
  try {
    const item = allItems.find(i => i.id === id);
    
    // Release warehouse reservation if this custody item had a valid SAP no and team
    if (item && item.productCode && item.assignedTeam) {
      const { warehouseService } = await import('../services/WarehouseService');
      const cleanTeamId = `team_${item.assignedTeam.replace(/\s+/g, '_')}`;
      const warehouses = dataService.getWarehouses();
      
      for (const wh of warehouses) {
        if (wh.id.startsWith('team_')) continue;
        try {
          const inventory = await warehouseService.getInventory(wh.id);
          const invItem = inventory.find(i => i.sapNo === item.productCode && i.condition !== 'DEFECT');
          if (invItem && invItem.reservations && (invItem.reservations[cleanTeamId] || 0) > 0) {
            await warehouseService.decreaseReservation(wh.id, item.productCode, 1, cleanTeamId);
            break;
          }
        } catch (resErr) {
          console.warn(`Failed to release warehouse reservation:`, resErr);
        }
      }
    }

    if (item) {
      // Write deletion history log
      await assetCustodyService.addHistoryLog({
        itemId: id,
        productCode: item.productCode || '',
        productName: item.productName,
        serialNo: item.serialNo || '',
        action: 'Silindi',
        oldAssignee: item.assignedTo,
        oldTeam: item.assignedTeam,
        oldCondition: item.condition,
        note: 'Zimmet kaydı sistemden kalıcı olarak silindi.',
        by: (window as any).currentUser?.displayName || 'Admin'
      });
    }

    await assetCustodyService.remove(id);
    (window as any).showToast?.('BİLGİ', 'Zimmet kaydı silindi.', 'info');
    (window as any).navigate('asset-custody');
  } catch (e) {
    (window as any).showToast?.('HATA', 'Silme işlemi başarısız.', 'error');
  }
};

(window as any).openCustodyDetailsModal = async (productName: string) => {
  const modal = document.getElementById('custody-details-modal');
  const title = document.getElementById('details-modal-title');
  const tbody = document.getElementById('details-distribution-tbody');
  const timeline = document.getElementById('details-history-timeline');
  if (!modal || !tbody || !timeline) return;

  if (title) title.innerHTML = `<i class="fa-solid fa-chart-pie"></i> ${productName} - Analiz & Dağılım Detayı`;

  // 1. Get all instances of this product
  const instances = allItems.filter(i => i.productName.trim().toLocaleLowerCase('tr-TR') === productName.trim().toLocaleLowerCase('tr-TR'));
  const condLabel: Record<string, string> = { saglam: '✅ Sağlam', arizali: '⚠️ Arızalı', hurda: '❌ Hurda', kayip: '🔍 Kayıp' };

  tbody.innerHTML = instances.length === 0 
    ? `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">Aktif dağılımda kayıt bulunamadı.</td></tr>`
    : instances.map(inst => `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            ${inst.imageUrl ? `
              <div style="position: relative; width: 28px; height: 28px; border-radius: 4px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); cursor: pointer;" onclick="window.showCustodyImageModal('${inst.productName.replace(/'/g, "\\'")}', '${inst.imageUrl}')">
                <img src="${inst.imageUrl}" style="width: 100%; height: 100%; object-fit: cover;">
              </div>
            ` : `
              <div style="width: 28px; height: 28px; border-radius: 4px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 0.65rem;">
                <i class="fa-solid fa-image"></i>
              </div>
            `}
            <span style="font-weight: 700; color: #fff; font-family: monospace;">${inst.serialNo || '-'}</span>
          </div>
        </td>
        <td style="text-align: center; font-weight: 800; font-family: 'Rajdhani'; font-size: 0.9rem; color: #fff;">${inst.quantity || 1}</td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${inst.assignedTo || '-'}</div>
          ${inst.assignedTeam ? `<span class="custody-team-tag">${inst.assignedTeam}</span>` : ''}
        </td>
        <td><span class="custody-loc-badge ${inst.location}">${inst.location === 'team' ? '👥 Ekipte' : (inst.location === 'depo' ? '🏭 Depoda' : '👤 Kişide')}</span></td>
        <td><span class="custody-cond-badge ${inst.condition}">${condLabel[inst.condition] || inst.condition}</span></td>
        <td><span class="custody-note-text" title="${inst.conditionNote || ''}">${inst.conditionNote || '-'}</span></td>
      </tr>
    `).join('');

  // 2. Fetch and combine history logs for all these instance IDs
  timeline.innerHTML = `<p style="color: var(--text-muted); font-size: 0.75rem; padding: 1rem; text-align: center;"><i class="fa-solid fa-spinner fa-spin"></i> Geçmiş logları yükleniyor...</p>`;

  try {
    const allLogs: CustodyHistoryEntry[] = [];
    for (const inst of instances) {
      const logs = await assetCustodyService.getHistory(inst.id);
      allLogs.push(...logs);
    }

    // Sort combined logs chronologically (descending)
    allLogs.sort((a, b) => {
      const timeA = a.timestamp?.seconds || 0;
      const timeB = b.timestamp?.seconds || 0;
      return timeB - timeA;
    });

    timeline.innerHTML = allLogs.length === 0
      ? `<p style="color: var(--text-muted); font-size: 0.75rem; padding: 1.5rem; text-align: center;">Bu malzemeye ait geçmiş hareket kaydı bulunmuyor.</p>`
      : allLogs.map(log => {
          const dateStr = log.timestamp ? new Date(log.timestamp.seconds * 1000).toLocaleString('tr-TR') : 'Şimdi';
          let logClass = 'updated';
          let actionIcon = 'fa-pen';
          if (log.action === 'Oluşturuldu') { logClass = 'created'; actionIcon = 'fa-plus'; }
          else if (log.action === 'Silindi') { logClass = 'deleted'; actionIcon = 'fa-trash-can'; }
          else if (log.action === 'Zimmet Değiştirildi') { logClass = 'transfer'; actionIcon = 'fa-right-left'; }
          else if (log.action === 'Durum Güncellendi') { logClass = 'condition'; actionIcon = 'fa-triangle-exclamation'; }

          let detailText = '';
          if (log.action === 'Oluşturuldu') {
            detailText = `İlk kez **${log.newAssignee || 'Depo'}** (${log.newTeam || '-'}) üzerine **${condLabel[log.newCondition || 'saglam']}** olarak zimmetlendi.`;
          } else if (log.action === 'Zimmet Değiştirildi' || log.action === 'Zimmet Güncellendi') {
            const oldHolder = log.oldAssignee ? `${log.oldAssignee} (${log.oldTeam || '-'})` : 'Depo';
            const newHolder = log.newAssignee ? `${log.newAssignee} (${log.newTeam || '-'})` : 'Depo';
            detailText = `Zimmet sahibi değişti: **${oldHolder}** ➔ **${newHolder}**.`;
          } else if (log.action === 'Durum Güncellendi') {
            detailText = `Cihaz durumu güncellendi: **${condLabel[log.oldCondition || 'saglam']}** ➔ **${condLabel[log.newCondition || 'saglam']}**.`;
          } else if (log.action === 'Silindi') {
            detailText = `Zimmet kaydı kalıcı olarak silindi. Son sahibi: **${log.oldAssignee || '-'}** (${log.oldTeam || '-'}).`;
          }

          const snText = log.serialNo ? ` [SN: ${log.serialNo}]` : '';
          const qtyText = log.quantity ? ` (${log.quantity} Adet)` : '';

          return `
            <div class="history-log-row ${logClass}">
              <div style="display: flex; justify-content: space-between; align-items: center; font-weight: 700; color: var(--text-main);">
                <span><i class="fa-solid ${actionIcon}"></i> ${log.action}${snText}${qtyText}</span>
                <span style="font-size: 0.65rem; color: var(--text-muted); font-family: monospace;">${dateStr}</span>
              </div>
              <div style="color: #fff; margin-top: 4px;">${detailText}</div>
              <div style="color: var(--text-muted); font-size: 0.65rem; margin-top: 2px;">
                👤 İşlem Yetkilisi: <strong>${log.by}</strong> ${log.note ? ` | Not: <em>"${log.note}"</em>` : ''}
              </div>
            </div>
          `;
        }).join('');
  } catch (err) {
    timeline.innerHTML = `<p style="color: #ef4444; font-size: 0.75rem; padding: 1.5rem; text-align: center;">Loglar yüklenirken bir hata oluştu: ${err}</p>`;
  }

  modal.classList.remove('hidden');
};

(window as any).closeCustodyDetailsModal = () => {
  document.getElementById('custody-details-modal')?.classList.add('hidden');
};

(window as any).filterCustodyItems = () => {
  searchQuery = ((document.getElementById('custody-search') as HTMLInputElement)?.value || '').toLowerCase();
  filterTeam = (document.getElementById('custody-filter-team') as HTMLSelectElement)?.value || 'all';
  localStorage.setItem('custody_filter_team', filterTeam);
  filterPerson = (document.getElementById('custody-filter-person') as HTMLSelectElement)?.value || 'all';
  filterCondition = (document.getElementById('custody-filter-condition') as HTMLSelectElement)?.value || 'all';
  filterLocation = (document.getElementById('custody-filter-location') as HTMLSelectElement)?.value || 'all';

  const rows = document.querySelectorAll('#custody-table-body tr[data-team]');
  rows.forEach((row: any) => {
    const team = row.getAttribute('data-team');
    const person = row.getAttribute('data-person');
    const condition = row.getAttribute('data-condition');
    const location = row.getAttribute('data-location');
    const searchStr = row.getAttribute('data-search');
    
    let show = true;
    if (filterTeam !== 'all' && team !== filterTeam) show = false;
    if (filterPerson !== 'all' && person !== filterPerson) show = false;
    if (filterCondition !== 'all' && condition !== filterCondition) show = false;
    if (filterLocation !== 'all' && location !== filterLocation) show = false;
    if (searchQuery && !searchStr.includes(searchQuery)) show = false;
    
    row.style.display = show ? '' : 'none';
  });
};

(window as any).handleCustodyPhotoUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  const statusSpan = document.getElementById('custody-photo-status');
  const previewContainer = document.getElementById('custody-photo-preview-container');
  const previewImg = document.getElementById('custody-photo-preview') as HTMLImageElement;
  const hiddenInput = document.getElementById('custody-photo-url') as HTMLInputElement;

  if (statusSpan) statusSpan.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Yükleniyor...';

  try {
    const dataUrl = await fileService.uploadImage(file, '');
    if (hiddenInput) hiddenInput.value = dataUrl;
    if (previewImg) previewImg.src = dataUrl;
    if (previewContainer) previewContainer.style.display = 'block';
    if (statusSpan) statusSpan.innerHTML = '<span style="color: #10b981; font-weight: 800;">✓ Fotoğraf Yüklendi</span>';
  } catch (err) {
    if (statusSpan) statusSpan.innerHTML = '<span style="color: #ef4444;">Yükleme hatası!</span>';
    (window as any).showToast?.('HATA', 'Fotoğraf yüklenemedi.', 'error');
  }
};

(window as any).clearCustodyPhoto = () => {
  const statusSpan = document.getElementById('custody-photo-status');
  const previewContainer = document.getElementById('custody-photo-preview-container');
  const previewImg = document.getElementById('custody-photo-preview') as HTMLImageElement;
  const hiddenInput = document.getElementById('custody-photo-url') as HTMLInputElement;
  const fileInput = document.getElementById('custody-photo-input') as HTMLInputElement;

  if (hiddenInput) hiddenInput.value = '';
  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.style.display = 'none';
  if (statusSpan) statusSpan.innerText = 'Fotoğraf eklenmedi';
  if (fileInput) fileInput.value = '';
};

(window as any).showCustodyImageModal = (title: string, url: string) => {
  const modal = document.getElementById('custody-image-modal');
  const modalTitle = document.getElementById('custody-image-modal-title');
  const modalImg = document.getElementById('custody-image-modal-img') as HTMLImageElement;
  if (!modal || !modalImg) return;
  if (modalTitle) modalTitle.innerText = title;
  modalImg.src = url;
  modal.classList.remove('hidden');
};

(window as any).closeCustodyImageModal = () => {
  const modal = document.getElementById('custody-image-modal');
  if (modal) modal.classList.add('hidden');
};

