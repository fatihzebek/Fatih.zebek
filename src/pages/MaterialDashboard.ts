import { warehouseService, type AuditRecord } from '../services/WarehouseService';
import { materialDemandService, type MaterialDemand } from '../services/MaterialDemandService';
import { transferService } from '../services/TransferService';
import { dataService } from '../services/DataService';
import { getGreetingPrefixHTML } from './Dashboard/DashboardHeader';

// In-memory cache of current loaded audits for instant detail viewing
let activePendingAudits: (AuditRecord & { warehouseId: string; warehouseName: string })[] = [];

export const MaterialDashboardPage = async () => {
  const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
  const userName = currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Malzeme Yöneticisi';

  // Fetch data concurrently
  let pendingAudits: (AuditRecord & { warehouseId: string; warehouseName: string })[] = [];
  let pendingDemands: MaterialDemand[] = [];
  let inTransitTransfers: any[] = [];
  const warehouses = dataService.getWarehouses();

  try {
    const [freshAudits, freshDemands, freshTransfers] = await Promise.all([
      warehouseService.getAllPendingAudits().catch(e => {
        console.error("Failed to load pending audits:", e);
        return [];
      }),
      materialDemandService.getDemands().catch(e => {
        console.error("Failed to load demands:", e);
        return [];
      }),
      transferService.getTransfers().catch(e => {
        console.error("Failed to load transfers:", e);
        return [];
      })
    ]);

    pendingAudits = freshAudits;
    activePendingAudits = freshAudits;

    // Filter demands waiting for manager review
    pendingDemands = (freshDemands || []).filter(d => d.status === 'PENDING_REVIEW');

    // Filter transfers in transit
    const now = new Date();
    inTransitTransfers = (freshTransfers || []).filter((t: any) => {
      const isCompleted = t.status === 'COMPLETED' || t.status === 'CANCELLED' || t.delivered;
      return !isCompleted;
    }).map((t: any) => {
      const createdDate = t.date ? new Date(t.date) : (t.createdAt?.toDate ? t.createdAt.toDate() : now);
      const daysPending = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24));
      return {
        ...t,
        daysPending: Math.max(0, daysPending),
        dateText: createdDate.toLocaleDateString('tr-TR')
      };
    });
  } catch (err) {
    console.error("Error loading MaterialDashboard data:", err);
  }

  const inTransitCount = inTransitTransfers.length;

  return `
    <div class="fade-in-up material-dashboard-container">
      <!-- Ambient Glow Elements -->
      <div style="position: absolute; top: -120px; left: -80px; width: 500px; height: 500px; background: radial-gradient(circle, rgba(0, 243, 255, 0.14) 0%, transparent 75%); pointer-events: none; z-index: 0; filter: blur(75px);"></div>
      <div style="position: absolute; bottom: -80px; right: -100px; width: 550px; height: 550px; background: radial-gradient(circle, rgba(52, 211, 153, 0.12) 0%, transparent 75%); pointer-events: none; z-index: 0; filter: blur(80px);"></div>

      <!-- HEADER -->
      <div class="mat-dash-header">
        <div class="welcome-text">
          <h1>${getGreetingPrefixHTML()}, ${userName} <span class="v-tag">MALZEME YÖNETİMİ</span></h1>
          <p>Depo sayım onayları, saha sipariş akışı ve lojistik sevkiyat operasyon merkezi.</p>
        </div>

        <div style="display: flex; align-items: center; gap: 1rem;">
          <button onclick="window.refreshMaterialDashboard()" class="btn-cyber-outline" style="padding: 6px 14px; font-size: 0.8rem; font-weight: 700; border-radius: 8px; display: inline-flex; align-items: center; gap: 6px;" title="Verileri Yenile">
            <i class="fa-solid fa-arrows-rotate"></i> YENİLE
          </button>
          <div class="user-badge-chip">
            <i class="fa-solid fa-boxes-packing" style="color: var(--accent-cyan);"></i>
            <span>Hurşit AKTER</span>
          </div>
        </div>
      </div>

      <!-- STATS GRID -->
      <div class="mat-stats-grid">
        <div class="mat-stat-card ${pendingAudits.length > 0 ? 'warning' : 'safe'}" onclick="document.getElementById('section-audits-alert')?.scrollIntoView({ behavior: 'smooth' })">
          <div class="stat-icon"><i class="fa-solid fa-clipboard-check"></i></div>
          <div class="stat-content">
            <span class="label">ONAY BEKLEYEN SAYIM</span>
            <span class="value">${pendingAudits.length}</span>
            <span class="sub-label">${pendingAudits.length > 0 ? 'İnceleme & Onay Bekliyor' : 'Tüm Sayımlar Güncel'}</span>
          </div>
          <div class="card-glow ${pendingAudits.length > 0 ? 'warning' : 'safe'}"></div>
        </div>

        <div class="mat-stat-card primary" onclick="window.navigate('saha-siparisleri')">
          <div class="stat-icon"><i class="fa-solid fa-cart-shopping"></i></div>
          <div class="stat-content">
            <span class="label">AÇIK SAHA TALEPLERİ</span>
            <span class="value">${pendingDemands.length}</span>
            <span class="sub-label">Ön Kontrol / Karar Bekleyen</span>
          </div>
          <div class="card-glow primary"></div>
        </div>

        <div class="mat-stat-card info" onclick="window.navigate('transfers')">
          <div class="stat-icon"><i class="fa-solid fa-truck-fast"></i></div>
          <div class="stat-content">
            <span class="label">YOLDAKİ SEVKİYATLAR</span>
            <span class="value">${inTransitCount}</span>
            <span class="sub-label">Transfer / Atölye Sevkiyatı</span>
          </div>
          <div class="card-glow info"></div>
        </div>

        <div class="mat-stat-card success" onclick="window.navigate('warehouses')">
          <div class="stat-icon"><i class="fa-solid fa-warehouse"></i></div>
          <div class="stat-content">
            <span class="label">BAĞLI DEPOLAR</span>
            <span class="value">${warehouses.length}</span>
            <span class="sub-label">Aktif Saha ve Merkez Depo</span>
          </div>
          <div class="card-glow success"></div>
        </div>
      </div>

      <!-- 🚨 ONAY BEKLEYEN DEPO SAYIMLARI BİLDİRİM & ONAY PANOSU -->
      <div id="section-audits-alert" class="glass-panel audit-alerts-section">
        <div class="section-title-row">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="pulse-icon-box ${pendingAudits.length > 0 ? 'alert' : 'ok'}">
              <i class="fa-solid ${pendingAudits.length > 0 ? 'fa-bell fa-shake' : 'fa-check'}"></i>
            </div>
            <div>
              <h2 style="font-size: 1.15rem; font-weight: 900; margin: 0; color: #fff; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.8px; display: flex; align-items: center; gap: 8px;">
                ONAY BEKLEYEN DEPO SAYIMLARI
                ${pendingAudits.length > 0 ? `<span class="badge-counter">${pendingAudits.length} DEPO</span>` : ''}
              </h2>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 2px 0 0 0;">
                Sahalarda tamamlanan fiziki sayımları inceleyebilir, tutarsızlıkları kontrol edip tek tıkla sistem stoğuna yansıtabilirsiniz.
              </p>
            </div>
          </div>
        </div>

        ${pendingAudits.length === 0 ? `
          <div class="empty-audit-box">
            <i class="fa-solid fa-circle-check" style="font-size: 2.5rem; color: #34d399; margin-bottom: 0.75rem;"></i>
            <h3 style="color: #fff; font-size: 1.05rem; font-weight: 800; margin-bottom: 0.25rem;">Şu Anda Onay Bekleyen Depo Sayımı Bulunmuyor</h3>
            <p style="color: var(--text-muted); font-size: 0.8rem; max-width: 500px; margin: 0 auto;">
              Sahalardaki personeller yeni bir fiziki sayım yapıp raporladığında anında burada bildirim kartı olarak belirecektir.
            </p>
          </div>
        ` : `
          <div class="audit-cards-list">
            ${pendingAudits.map((a, idx) => {
              const diffCount = a.discrepantItems ?? (a.results ? a.results.filter(r => r.diff !== 0).length : 0);
              const totalItems = a.totalItems ?? (a.results ? a.results.length : 0);
              const dateText = a.date || (a.timestamp?.toDate ? a.timestamp.toDate().toLocaleDateString('tr-TR') : 'Bugün');
              const hasDiff = diffCount > 0;

              return `
                <div class="audit-compact-row ${hasDiff ? 'has-diff' : 'perfect'}">
                  <!-- Left: Warehouse Info -->
                  <div class="audit-col-info">
                    <div class="wh-icon-compact"><i class="fa-solid fa-warehouse"></i></div>
                    <div class="wh-text-block">
                      <div class="wh-name-row">
                        <span class="wh-title">${a.warehouseName}</span>
                        <span class="status-pill pending"><i class="fa-solid fa-hourglass-half"></i> ONAY BEKLİYOR</span>
                      </div>
                      <div class="wh-sub-meta">
                        <span><i class="fa-solid fa-user-check" style="color: var(--accent-cyan);"></i> ${a.user} ${a.team ? `(${a.team})` : ''}</span>
                        <span>•</span>
                        <span><i class="fa-regular fa-clock"></i> ${dateText}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Middle: Compact Metric Badges -->
                  <div class="audit-col-metrics">
                    <div class="compact-badge neutral" title="Toplam Sayılan Kalem">
                      <span class="cb-val">${totalItems}</span>
                      <span class="cb-lbl">Kalem</span>
                    </div>
                    <div class="compact-badge success" title="Birebir Uyumlu Kalem">
                      <span class="cb-val">${Math.max(0, totalItems - diffCount)}</span>
                      <span class="cb-lbl">Uyumlu</span>
                    </div>
                    <div class="compact-badge ${diffCount > 0 ? 'warning' : 'success'}" title="Fark Çıkan Kalem Sayısı">
                      <span class="cb-val">${diffCount}</span>
                      <span class="cb-lbl">Fark</span>
                    </div>
                    ${a.totalDiff !== undefined ? `
                      <div class="compact-badge ${a.totalDiff !== 0 ? 'danger' : 'success'}" title="Net Adet Farkı">
                        <span class="cb-val">${a.totalDiff > 0 ? `+${a.totalDiff}` : a.totalDiff}</span>
                        <span class="cb-lbl">Net</span>
                      </div>
                    ` : ''}
                  </div>

                  <!-- Right: Action Buttons -->
                  <div class="audit-col-actions">
                    <button onclick="window.viewMaterialAuditDetail('${a.id || idx}')" class="btn-sm-action cyan" title="Sayım detaylarını ve kalem farklarını incele">
                      <i class="fa-solid fa-list-check"></i> İncele
                    </button>
                    <button onclick="window.requestMaterialAuditRevision('${a.warehouseId}', '${a.id}', '${a.warehouseName}')" class="btn-sm-action orange" title="Ekibe düzeltme ve yeniden sayım notu ilet">
                      <i class="fa-solid fa-pen-to-square"></i> Düzeltme İste
                    </button>
                    <button onclick="window.approveMaterialAudit('${a.warehouseId}', '${a.id}', '${a.warehouseName}', ${totalItems})" class="btn-sm-action green" title="Sayımı onayla ve fiziksel adetleri doğrudan envanter stoklarına işle">
                      <i class="fa-solid fa-check-double"></i> Sayımı Onayla & Stoğa İşle
                    </button>
                    <button onclick="window.markAuditAsAlreadyApprovedDirectly('${a.warehouseId}', '${a.id}', '${a.warehouseName}')" class="btn-sm-action ghost" title="Bu sayım zaten önceden onaylandıysa veya eskiyse listeden kaldır">
                      <i class="fa-solid fa-box-archive"></i> Zaten Onaylandı
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- MAIN 2-COLUMN SECTION: SAHA DEMANDS & LOGISTICS -->
      <div class="mat-main-grid">
        <!-- LEFT: PENDING FIELD MATERIAL DEMANDS -->
        <div class="glass-panel" style="padding: 1.25rem; display: flex; flex-direction: column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
            <h3 style="font-size: 0.95rem; font-weight: 900; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif;">
              <i class="fa-solid fa-cart-flatbed" style="color: #38bdf8;"></i> SAHA MALZEME TALEPLERİ (${pendingDemands.length})
            </h3>
            <button onclick="window.navigate('saha-siparisleri')" class="btn-cyber-outline" style="font-size: 0.72rem; padding: 4px 10px; font-weight: 800; border-radius: 6px;">
              TÜMÜNÜ GÖR <i class="fa-solid fa-angle-right"></i>
            </button>
          </div>

          ${pendingDemands.length === 0 ? `
            <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
              <i class="fa-solid fa-clipboard-check" style="font-size: 2rem; color: #34d399; margin-bottom: 0.5rem; display: block;"></i>
              Şu anda ön kontrol bekleyen yeni saha malzeme talebi bulunmuyor.
            </div>
          ` : `
            <div style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 400px; overflow-y: auto; padding-right: 4px;">
              ${pendingDemands.slice(0, 8).map(d => {
                const isUrgent = (d.urgency as any) === 'ACIL_ARIZA' || (d.urgency as any) === 'CRITICAL';
                const isPeriodic = (d.urgency as any) === 'PERIYODIK_BAKIM' || (d.urgency as any) === 'HIGH';
                const urgencyCol = isUrgent ? '#ef4444' : (isPeriodic ? '#f59e0b' : '#38bdf8');
                const urgencyText = isUrgent ? 'ACİL ARIZA' : (isPeriodic ? 'PERİYODİK BAKIM' : 'NORMAL');
                const dateText = d.createdAt ? (typeof (d.createdAt as any)?.toDate === 'function' ? (d.createdAt as any).toDate().toLocaleDateString('tr-TR') : new Date(d.createdAt).toLocaleDateString('tr-TR')) : '';
                const itemsCount = d.items?.length || 0;
                const itemsSample = (d.items || []).slice(0, 2).map(i => `${i.description} (${i.quantity} ${i.unit || 'Adet'})`).join(', ');

                return `
                  <div onclick="window.navigate('saha-siparisleri')" style="cursor: pointer; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 0.85rem 1rem; transition: all 0.2s;" onmouseover="this.style.background='rgba(56, 189, 248, 0.05)'; this.style.borderColor='rgba(56, 189, 248, 0.3)'" onmouseout="this.style.background='rgba(255,255,255,0.02)'; this.style.borderColor='rgba(255,255,255,0.06)'">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                      <div>
                        <div style="font-size: 0.88rem; font-weight: 800; color: #fff; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                          <span>${d.siteName || d.siteId}</span>
                          ${d.turbineId ? `<span style="color: var(--accent-cyan); font-size: 0.75rem;">(${d.turbineId})</span>` : ''}
                          <span style="font-size: 0.65rem; font-weight: 900; background: ${urgencyCol}22; color: ${urgencyCol}; border: 1px solid ${urgencyCol}55; padding: 2px 6px; border-radius: 4px;">${urgencyText}</span>
                        </div>
                        <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 3px;">
                          ${d.requesterName} ${d.requesterTeam ? `(${d.requesterTeam})` : ''} • <strong style="color: #cbd5e1;">${itemsCount} Kalem:</strong> ${itemsSample}${itemsCount > 2 ? '...' : ''}
                        </div>
                      </div>
                      <div style="text-align: right; flex-shrink: 0;">
                        <span style="font-size: 0.7rem; color: #94a3b8;">${dateText}</span>
                        <div style="margin-top: 4px;">
                          <span style="font-size: 0.68rem; font-weight: 800; color: #38bdf8; background: rgba(56, 189, 248, 0.1); border: 1px solid rgba(56, 189, 248, 0.3); padding: 2px 7px; border-radius: 4px;">İNCELE</span>
                        </div>
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `}
        </div>

        <!-- RIGHT: IN-TRANSIT SHIPMENTS & QUICK ACTIONS -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- In-Transit Shipments -->
          <div class="glass-panel" style="padding: 1.25rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid rgba(255,255,255,0.06); padding-bottom: 0.75rem;">
              <h3 style="font-size: 0.95rem; font-weight: 900; color: #fff; margin: 0; display: flex; align-items: center; gap: 8px; font-family: 'Rajdhani', sans-serif;">
                <i class="fa-solid fa-truck-ramp-box" style="color: #f59e0b;"></i> YOLDAKİ TRANSFERLER (${inTransitTransfers.length})
              </h3>
              <button onclick="window.navigate('transfers')" class="btn-cyber-outline" style="font-size: 0.72rem; padding: 4px 10px; font-weight: 800; border-radius: 6px;">
                TÜMÜ <i class="fa-solid fa-angle-right"></i>
              </button>
            </div>

            ${inTransitTransfers.length === 0 ? `
              <div style="text-align: center; padding: 1.5rem 1rem; color: var(--text-muted); font-size: 0.85rem;">
                <i class="fa-solid fa-check" style="color: #34d399; margin-right: 6px;"></i> Yolda bekleyen transfer bulunmuyor.
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.6rem; max-height: 220px; overflow-y: auto; padding-right: 4px;">
                ${inTransitTransfers.slice(0, 4).map(t => `
                  <div onclick="window.navigate('transfers')" style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px;">
                    <div>
                      <div style="font-size: 0.8rem; font-weight: 800; color: #fff;">
                        ${t.fromSiteId || 'Depo'} ➔ ${t.toSiteId || 'Depo'}
                      </div>
                      <div style="font-size: 0.7rem; color: var(--text-muted);">
                        MSF: <strong style="color: var(--accent-cyan);">${t.msfNo || '-'}</strong> • ${t.dateText}
                      </div>
                    </div>
                    <span style="font-size: 0.65rem; font-weight: 800; color: #f59e0b; background: rgba(245, 158, 11, 0.12); border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 6px; border-radius: 4px;">
                      ${t.daysPending} GÜNDÜR YOLDA
                    </span>
                  </div>
                `).join('')}
              </div>
            `}
          </div>

          <!-- Quick Actions Grid -->
          <div class="glass-panel" style="padding: 1.25rem;">
            <h3 style="font-size: 0.9rem; font-weight: 900; color: #fff; margin: 0 0 0.85rem 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
              HIZLI İŞLEMLER
            </h3>
            <div class="mat-quick-actions-grid">
              <button onclick="window.navigate('saha-siparisleri')" class="quick-btn primary">
                <i class="fa-solid fa-list-check"></i>
                <span>Saha Siparişleri</span>
              </button>
              <button onclick="window.navigate('siparis')" class="quick-btn info">
                <i class="fa-solid fa-cart-plus"></i>
                <span>Sipariş Oluştur</span>
              </button>
              <button onclick="window.navigate('transfers')" class="quick-btn success">
                <i class="fa-solid fa-truck-ramp-box"></i>
                <span>Malzeme Transferi</span>
              </button>
              <button onclick="window.navigate('warehouses')" class="quick-btn warning">
                <i class="fa-solid fa-warehouse"></i>
                <span>Depo & Envanter</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- AUDIT DETAILS MODAL -->
      <div id="mat-audit-detail-modal" class="cyber-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.85); backdrop-filter: blur(8px); z-index: 99999; align-items: center; justify-content: center;">
        <div class="glass-panel" style="width: 92%; max-width: 920px; max-height: 88vh; display: flex; flex-direction: column; padding: 1.75rem; border-radius: 16px; border: 1px solid rgba(0, 243, 255, 0.3); box-shadow: 0 20px 60px rgba(0,0,0,0.85); background: #0c121e;" onclick="event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 1rem; margin-bottom: 1rem;">
            <div>
              <h3 id="mat-modal-audit-title" style="font-size: 1.25rem; font-weight: 900; color: #fff; margin: 0; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.8px;">
                DEPO SAYIM DETAYI & FARKLAR
              </h3>
              <p id="mat-modal-audit-subtitle" style="font-size: 0.8rem; color: var(--text-muted); margin: 3px 0 0 0;"></p>
            </div>
            <button onclick="window.closeMaterialAuditDetailModal()" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 50%; width: 36px; height: 36px; color: #fff; font-size: 1.1rem; cursor: pointer;">&times;</button>
          </div>

          <div id="mat-modal-audit-table-wrap" style="flex: 1; overflow-y: auto; margin-bottom: 1.25rem;" class="custom-scrollbar">
            <!-- Table dynamically injected -->
          </div>

          <div id="mat-modal-audit-footer" style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 1rem;">
            <!-- Buttons injected -->
          </div>
        </div>
      </div>

      <!-- REVISION NOTE MODAL -->
      <div id="mat-audit-revision-modal" class="cyber-modal-overlay" style="display: none; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(5, 8, 15, 0.85); backdrop-filter: blur(8px); z-index: 99999; align-items: center; justify-content: center;">
        <div class="glass-panel" style="width: 90%; max-width: 500px; padding: 1.75rem; border-radius: 14px; border: 1px solid rgba(245, 158, 11, 0.4); background: #0c121e;" onclick="event.stopPropagation()">
          <h3 style="font-size: 1.15rem; font-weight: 900; color: #f59e0b; margin: 0 0 0.5rem 0; font-family: 'Rajdhani', sans-serif;">
            <i class="fa-solid fa-pen-to-square"></i> SAYIM DÜZELTME & YENİDEN KONTROL TALEBİ
          </h3>
          <p id="mat-revision-modal-wh-label" style="font-size: 0.8rem; color: #cbd5e1; margin-bottom: 1rem;"></p>
          <div style="margin-bottom: 1rem;">
            <label style="font-size: 0.75rem; font-weight: 800; color: #94a3b8; display: block; margin-bottom: 4px;">DÜZELTME / YENİDEN SAYIM NOTU:</label>
            <textarea id="mat-revision-note-input" rows="4" class="cyber-input" style="width: 100%; box-sizing: border-box; padding: 8px 12px; font-size: 0.85rem;" placeholder="Örn: 2 numaralı raftaki filtrelerin fiziksel sayımını lütfen yeniden kontrol ediniz..."></textarea>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 8px;">
            <button onclick="window.closeMaterialAuditRevisionModal()" class="btn-cyber-outline" style="padding: 7px 14px; font-weight: 700;">İPTAL</button>
            <button id="mat-confirm-revision-btn" class="btn-cyber-orange" style="padding: 7px 16px; font-weight: 800;">DÜZELTME TALEBİNİ İLET</button>
          </div>
        </div>
      </div>
    </div>

    <style>
      .material-dashboard-container {
        padding: 1rem 1.75rem 2rem 1.75rem !important;
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
        margin: 0;
        display: flex;
        flex-direction: column;
        gap: 1.25rem;
        position: relative;
        z-index: 1;
        overflow-x: hidden;
      }

      .mat-dash-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;
        position: relative;
        z-index: 2;
      }

      .mat-dash-header .welcome-text h1 {
        font-family: 'Rajdhani', sans-serif;
        font-size: 1.6rem;
        font-weight: 900;
        letter-spacing: 1.2px;
        margin: 0;
        color: #fff;
        display: flex;
        align-items: center;
        text-transform: uppercase;
      }

      .mat-dash-header .v-tag {
        font-size: 0.6rem;
        background: linear-gradient(135deg, #00f3ff, #0284c7);
        color: #000;
        padding: 2px 7px;
        border-radius: 5px;
        font-weight: 900;
        letter-spacing: 1px;
        margin-left: 8px;
        vertical-align: middle;
      }

      .mat-dash-header .welcome-text p {
        color: var(--accent-cyan);
        font-family: 'Rajdhani', sans-serif;
        font-weight: 700;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        font-size: 0.72rem;
        margin: 4px 0 0 0;
        opacity: 0.85;
      }

      .user-badge-chip {
        display: flex;
        align-items: center;
        gap: 8px;
        background: rgba(0, 243, 255, 0.05);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 0.8rem;
        font-weight: 800;
        color: #fff;
        font-family: 'Rajdhani', sans-serif;
      }

      /* Stats Grid */
      .mat-stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: 1.25rem;
        width: 100%;
        box-sizing: border-box;
      }

      .mat-stat-card {
        background: rgba(255,255,255,0.02);
        border: 1px solid rgba(255,255,255,0.06);
        border-radius: 12px;
        padding: 0.85rem 1.1rem;
        display: flex;
        align-items: center;
        gap: 1rem;
        position: relative;
        overflow: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        cursor: pointer;
      }
      .mat-stat-card:hover {
        transform: translateY(-3px);
        background: rgba(255,255,255,0.04);
      }
      .mat-stat-card.warning { border-color: rgba(245, 158, 11, 0.35); box-shadow: 0 0 20px rgba(245, 158, 11, 0.08); }
      .mat-stat-card.primary { border-color: rgba(56, 189, 248, 0.35); box-shadow: 0 0 20px rgba(56, 189, 248, 0.08); }
      .mat-stat-card.info { border-color: rgba(167, 139, 250, 0.35); box-shadow: 0 0 20px rgba(167, 139, 250, 0.08); }
      .mat-stat-card.success { border-color: rgba(52, 211, 153, 0.35); box-shadow: 0 0 20px rgba(52, 211, 153, 0.08); }
      .mat-stat-card.safe { border-color: rgba(52, 211, 153, 0.2); }

      .mat-stat-card .stat-icon {
        width: 42px;
        height: 42px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
      }
      .mat-stat-card.warning .stat-icon { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
      .mat-stat-card.primary .stat-icon { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
      .mat-stat-card.info .stat-icon { background: rgba(167, 139, 250, 0.15); color: #a78bfa; }
      .mat-stat-card.success .stat-icon { background: rgba(52, 211, 153, 0.15); color: #34d399; }
      .mat-stat-card.safe .stat-icon { background: rgba(52, 211, 153, 0.1); color: #34d399; }

      .mat-stat-card .label { font-size: 0.62rem; font-weight: 900; color: rgba(255,255,255,0.4); letter-spacing: 1px; text-transform: uppercase; }
      .mat-stat-card .value { font-size: 1.6rem; font-weight: 900; color: #fff; font-family: 'Rajdhani', sans-serif; line-height: 1.1; margin: 1px 0; }
      .mat-stat-card .sub-label { font-size: 0.68rem; color: var(--text-muted); }

      /* Audits Section */
      .audit-alerts-section {
        padding: 1rem 1.25rem;
        border-top: 3px solid #f59e0b !important;
        box-shadow: 0 16px 45px rgba(0, 0, 0, 0.5), 0 0 25px rgba(245, 158, 11, 0.1) !important;
        border-radius: 14px;
      }

      .pulse-icon-box {
        width: 38px;
        height: 38px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.15rem;
        flex-shrink: 0;
      }
      .pulse-icon-box.alert {
        background: rgba(245, 158, 11, 0.2);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.4);
      }
      .pulse-icon-box.ok {
        background: rgba(52, 211, 153, 0.2);
        color: #34d399;
        border: 1px solid rgba(52, 211, 153, 0.4);
      }

      .badge-counter {
        font-size: 0.68rem;
        background: #f59e0b;
        color: #000;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 10px;
        letter-spacing: 0.5px;
      }

      .empty-audit-box {
        text-align: center;
        padding: 2rem 1.25rem;
        background: rgba(52, 211, 153, 0.02);
        border: 1px dashed rgba(52, 211, 153, 0.25);
        border-radius: 10px;
        margin-top: 0.75rem;
      }

      .audit-cards-list {
        display: flex;
        flex-direction: column;
        gap: 0.6rem;
        margin-top: 0.85rem;
      }

      .audit-compact-row {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.06);
        border-radius: 10px;
        padding: 0.65rem 0.9rem;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.85rem;
        flex-wrap: wrap;
        transition: all 0.2s ease;
      }
      .audit-compact-row:hover {
        background: rgba(255, 255, 255, 0.035);
        border-color: rgba(255, 255, 255, 0.12);
      }
      .audit-compact-row.has-diff {
        border-left: 4px solid #f59e0b;
      }
      .audit-compact-row.perfect {
        border-left: 4px solid #34d399;
      }

      .audit-col-info {
        display: flex;
        align-items: center;
        gap: 10px;
        min-width: 230px;
        flex: 1;
      }
      .wh-icon-compact {
        width: 32px;
        height: 32px;
        background: rgba(0, 243, 255, 0.08);
        color: var(--accent-cyan);
        border: 1px solid rgba(0, 243, 255, 0.2);
        border-radius: 8px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 0.9rem;
        flex-shrink: 0;
      }
      .wh-name-row {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
      }
      .wh-title {
        font-size: 0.92rem;
        font-weight: 800;
        color: #fff;
        font-family: 'Rajdhani', sans-serif;
        letter-spacing: 0.4px;
      }
      .wh-sub-meta {
        font-size: 0.72rem;
        color: var(--text-muted);
        display: flex;
        align-items: center;
        gap: 6px;
        margin-top: 2px;
      }

      .status-pill.pending {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.4);
        padding: 2px 7px;
        border-radius: 4px;
        font-size: 0.68rem;
        font-weight: 800;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: 'Rajdhani', sans-serif;
      }

      .audit-col-metrics {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .compact-badge {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 3px 8px;
        border-radius: 6px;
        font-size: 0.72rem;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .compact-badge .cb-val {
        font-weight: 800;
        font-family: monospace;
      }
      .compact-badge .cb-lbl {
        color: var(--text-muted);
        font-size: 0.65rem;
        text-transform: uppercase;
      }
      .compact-badge.neutral .cb-val { color: #fff; }
      .compact-badge.success {
        background: rgba(52, 211, 153, 0.08);
        border-color: rgba(52, 211, 153, 0.25);
      }
      .compact-badge.success .cb-val { color: #34d399; }
      .compact-badge.warning {
        background: rgba(245, 158, 11, 0.1);
        border-color: rgba(245, 158, 11, 0.3);
      }
      .compact-badge.warning .cb-val { color: #f59e0b; }
      .compact-badge.danger {
        background: rgba(239, 68, 68, 0.1);
        border-color: rgba(239, 68, 68, 0.3);
      }
      .compact-badge.danger .cb-val { color: #ef4444; }

      .audit-col-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-wrap: wrap;
      }
      .btn-sm-action {
        font-size: 0.72rem;
        padding: 5px 9px;
        border-radius: 6px;
        font-weight: 800;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        font-family: 'Rajdhani', sans-serif;
        transition: all 0.2s ease;
      }
      .btn-sm-action.cyan {
        background: rgba(0, 243, 255, 0.08);
        color: var(--accent-cyan);
        border: 1px solid rgba(0, 243, 255, 0.3);
      }
      .btn-sm-action.cyan:hover {
        background: rgba(0, 243, 255, 0.18);
      }
      .btn-sm-action.orange {
        background: rgba(245, 158, 11, 0.1);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.35);
      }
      .btn-sm-action.orange:hover {
        background: rgba(245, 158, 11, 0.2);
      }
      .btn-sm-action.green {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: #fff;
        border: none;
        box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
      }
      .btn-sm-action.green:hover {
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.5);
      }
      .btn-sm-action.ghost {
        background: rgba(255, 255, 255, 0.03);
        color: var(--text-muted);
        border: 1px solid rgba(255, 255, 255, 0.08);
      }
      .btn-sm-action.ghost:hover {
        background: rgba(255, 255, 255, 0.07);
        color: #fff;
      }

      .btn-cyber-green {
        background: linear-gradient(135deg, #10b981, #059669);
        color: #fff;
        border: 1px solid #34d399;
        cursor: pointer;
        box-shadow: 0 0 15px rgba(16, 185, 129, 0.35);
        transition: all 0.2s;
      }
      .btn-cyber-green:hover {
        transform: translateY(-1px);
        box-shadow: 0 0 22px rgba(16, 185, 129, 0.55);
      }

      .btn-cyber-orange {
        background: rgba(245, 158, 11, 0.15);
        color: #f59e0b;
        border: 1px solid rgba(245, 158, 11, 0.45);
        cursor: pointer;
        transition: all 0.2s;
      }
      .btn-cyber-orange:hover {
        background: rgba(245, 158, 11, 0.25);
        border-color: #f59e0b;
      }

      /* Main 2-Col Grid */
      .mat-main-grid {
        display: grid;
        grid-template-columns: minmax(0, 1.4fr) minmax(320px, 1fr);
        gap: 1.25rem;
        width: 100%;
        box-sizing: border-box;
      }
      @media (max-width: 1100px) {
        .mat-main-grid {
          grid-template-columns: 1fr;
        }
      }

      .mat-quick-actions-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }

      .quick-btn {
        background: rgba(255, 255, 255, 0.02);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 10px;
        padding: 0.85rem 1rem;
        display: flex;
        align-items: center;
        gap: 10px;
        font-weight: 800;
        font-size: 0.8rem;
        color: #fff;
        cursor: pointer;
        transition: all 0.2s;
        text-align: left;
      }
      .quick-btn:hover {
        background: rgba(255, 255, 255, 0.05);
        transform: translateY(-2px);
      }
      .quick-btn.primary i { color: #38bdf8; font-size: 1.1rem; }
      .quick-btn.info i { color: #a78bfa; font-size: 1.1rem; }
      .quick-btn.success i { color: #34d399; font-size: 1.1rem; }
      .quick-btn.warning i { color: #f59e0b; font-size: 1.1rem; }
    </style>
  `;
};

// Global Handlers
(window as any).refreshMaterialDashboard = () => {
  (window as any).navigate('material-dashboard');
};

(window as any).viewMaterialAuditDetail = (auditIdOrIdx: string) => {
  const audit = activePendingAudits.find(a => a.id === auditIdOrIdx || String(activePendingAudits.indexOf(a)) === auditIdOrIdx);
  if (!audit) {
    alert("Sayım detayı bulunamadı.");
    return;
  }

  const modal = document.getElementById('mat-audit-detail-modal');
  const title = document.getElementById('mat-modal-audit-title');
  const subtitle = document.getElementById('mat-modal-audit-subtitle');
  const tableWrap = document.getElementById('mat-modal-audit-table-wrap');
  const footer = document.getElementById('mat-modal-audit-footer');

  if (title) title.innerText = `${audit.warehouseName} — FİZİKİ SAYIM DETAYI`;
  if (subtitle) subtitle.innerText = `Sayımı Yapan: ${audit.user} ${audit.team ? `(${audit.team})` : ''} • Tarih: ${audit.date || 'Bugün'}`;

  const results = audit.results || [];
  const totalDiff = results.reduce((acc, r) => acc + (r.diff || 0), 0);
  const diffItems = results.filter(r => r.diff !== 0);

  if (tableWrap) {
    if (results.length === 0) {
      tableWrap.innerHTML = '<div style="padding: 2rem; text-align: center; color: var(--text-muted);">Bu sayımda kalem detayı bulunamadı.</div>';
    } else {
      tableWrap.innerHTML = `
        <table style="width: 100%; border-collapse: collapse; font-size: 0.82rem; font-family: 'Inter', sans-serif;">
          <thead>
            <tr style="border-bottom: 2px solid rgba(255,255,255,0.1); color: var(--accent-cyan); text-align: left;">
              <th style="padding: 10px 8px;">SAP NO</th>
              <th style="padding: 10px 8px;">MALZEME TANIMI</th>
              <th style="padding: 10px 8px;">RAF NO</th>
              <th style="padding: 10px 8px; text-align: center;">SİSTEM STOK</th>
              <th style="padding: 10px 8px; text-align: center; color: #34d399;">FİZİKİ SAYIM</th>
              <th style="padding: 10px 8px; text-align: center;">FARK</th>
              <th style="padding: 10px 8px;">AÇIKLAMA</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(r => {
              const hasDiff = r.diff !== 0;
              const diffCol = r.diff > 0 ? '#34d399' : (r.diff < 0 ? '#ef4444' : '#94a3b8');
              const diffSign = r.diff > 0 ? `+${r.diff}` : `${r.diff}`;

              return `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.04); background: ${hasDiff ? 'rgba(239, 68, 68, 0.05)' : 'transparent'};">
                  <td style="padding: 8px; color: var(--accent-cyan); font-family: monospace; font-weight: 800;">${r.sapNo || '-'}</td>
                  <td style="padding: 8px; color: #fff; font-weight: 600;">${r.description || '-'}</td>
                  <td style="padding: 8px; color: #cbd5e1;">${r.shelfNo || '-'}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 700; color: #94a3b8;">${r.systemQty ?? '-'}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 900; color: #34d399; font-size: 0.95rem;">${r.physicalQty}</td>
                  <td style="padding: 8px; text-align: center; font-weight: 900; color: ${diffCol};">
                    ${diffSign}
                  </td>
                  <td style="padding: 8px; color: #cbd5e1; font-size: 0.75rem;">${r.note || '-'}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    }
  }

  if (footer) {
    footer.innerHTML = `
      <div style="font-size: 0.8rem; color: #cbd5e1;">
        <span>Toplam <strong>${results.length}</strong> kalem</span> • 
        <span style="color: ${diffItems.length > 0 ? '#ef4444' : '#34d399'}; font-weight: 800;">${diffItems.length} Kalemde Fark</span> • 
        <span>Net Fark: <strong style="color: ${totalDiff !== 0 ? '#f59e0b' : '#34d399'};">${totalDiff > 0 ? `+${totalDiff}` : totalDiff}</strong></span>
      </div>
      <div style="display: flex; gap: 8px;">
        <button onclick="window.closeMaterialAuditDetailModal()" class="btn-cyber-outline" style="padding: 7px 14px; font-weight: 700;">KAPAT</button>
        <button onclick="window.closeMaterialAuditDetailModal(); window.requestMaterialAuditRevision('${audit.warehouseId}', '${audit.id}', '${audit.warehouseName}')" class="btn-cyber-orange" style="padding: 7px 14px; font-weight: 800;">
          <i class="fa-solid fa-pen-to-square"></i> DÜZELTME İSTE
        </button>
        <button onclick="window.closeMaterialAuditDetailModal(); window.approveMaterialAudit('${audit.warehouseId}', '${audit.id}', '${audit.warehouseName}', ${results.length})" class="btn-cyber-green" style="padding: 7px 18px; font-weight: 900;">
          <i class="fa-solid fa-check-double"></i> SAYIMI ONAYLA
        </button>
      </div>
    `;
  }

  if (modal) modal.style.display = 'flex';
};

(window as any).closeMaterialAuditDetailModal = () => {
  const modal = document.getElementById('mat-audit-detail-modal');
  if (modal) modal.style.display = 'none';
};

// Approve Audit and Apply Stock to Inventory
(window as any).approveMaterialAudit = async (warehouseId: string, auditId: string, warehouseName: string, totalItems: number) => {
  const currentUser = (window as any).currentUser;
  const approverName = currentUser?.displayName || currentUser?.email || 'Hurşit AKTER';

  const confirmed = confirm(
    `"${warehouseName}" deposunun sayımını ONAYLAMAK istediğinize emin misiniz?\n\n` +
    `Toplam ${totalItems} kalemin fiziki sayım adetleri doğrudan depo stoklarına yansıtılacak ve sayım durumu 'ONAYLANDI' olarak arşivlenecektir.`
  );
  if (!confirmed) return;

  try {
    if ((window as any).showToast) {
      (window as any).showToast('İşlem Yapılıyor', 'Sayım onaylanıyor ve stoklar güncelleniyor...', 'info');
    }

    await warehouseService.approveAuditAndApplyStock(warehouseId, auditId, approverName);

    alert(`"${warehouseName}" depo sayımı başarıyla ONAYLANDI ve stoklar güncellendi!`);
    (window as any).refreshMaterialDashboard();
  } catch (err: any) {
    console.error("Failed to approve audit:", err);
    alert("Sayım onaylanırken hata oluştu: " + (err?.message || err));
  }
};

let activeRevisionWarehouseId = '';
let activeRevisionAuditId = '';

(window as any).requestMaterialAuditRevision = (warehouseId: string, auditId: string, warehouseName: string) => {
  activeRevisionWarehouseId = warehouseId;
  activeRevisionAuditId = auditId;

  const modal = document.getElementById('mat-audit-revision-modal');
  const label = document.getElementById('mat-revision-modal-wh-label');
  const input = document.getElementById('mat-revision-note-input') as HTMLTextAreaElement;
  const confirmBtn = document.getElementById('mat-confirm-revision-btn');

  if (label) label.innerText = `Depo: ${warehouseName}`;
  if (input) input.value = '';

  if (confirmBtn) {
    confirmBtn.onclick = async () => {
      const note = input?.value?.trim();
      if (!note) {
        alert("Lütfen personele iletilecek düzeltme / açıklama notunu yazınız!");
        return;
      }

      const currentUser = (window as any).currentUser;
      const managerName = currentUser?.displayName || currentUser?.email || 'Hurşit AKTER';

      try {
        confirmBtn.innerText = 'İletiliyor...';
        (confirmBtn as HTMLButtonElement).disabled = true;

        await warehouseService.requestAuditRevision(activeRevisionWarehouseId, activeRevisionAuditId, managerName, note);
        alert("Düzeltme talebi ekibe iletildi. Sayım durumu 'Düzeltme İstendi' olarak güncellendi.");
        (window as any).closeMaterialAuditRevisionModal();
        (window as any).refreshMaterialDashboard();
      } catch (err: any) {
        console.error("Failed to request revision:", err);
        alert("Düzeltme iletilirken hata: " + (err?.message || err));
      } finally {
        confirmBtn.innerText = 'DÜZELTME TALEBİNİ İLET';
        (confirmBtn as HTMLButtonElement).disabled = false;
      }
    };
  }

  if (modal) modal.style.display = 'flex';
};

(window as any).closeMaterialAuditRevisionModal = () => {
  const modal = document.getElementById('mat-audit-revision-modal');
  if (modal) modal.style.display = 'none';
};

(window as any).markAuditAsAlreadyApprovedDirectly = async (warehouseId: string, auditId: string, warehouseName: string) => {
  const confirmAction = confirm(
    `"${warehouseName}" sayımını 'ONAYLANDI / ARŞİV' olarak işaretlemek istiyor musunuz?\n\n` +
    `• Bu işlem mevcut depo stoklarını yeniden değiştirmeden sayımı 'Onaylandı' statüsüne alır ve onay bekleyen listesinden kaldırır.`
  );
  if (!confirmAction) return;

  try {
    const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
    const approverName = currentUser?.displayName || currentUser?.email || 'Hurşit AKTER';
    if ((window as any).showToast) {
      (window as any).showToast('İşlem Yapılıyor', 'Sayım durumu güncelleniyor...', 'info');
    }
    await warehouseService.markAuditAsApprovedWithoutStock(warehouseId, auditId, approverName);
    alert(`"${warehouseName}" sayımı onaylandı olarak arşivlendi.`);
    (window as any).refreshMaterialDashboard();
  } catch (err: any) {
    console.error("Failed to mark audit as already approved:", err);
    alert("İşlem sırasında hata oluştu: " + (err?.message || err));
  }
};
