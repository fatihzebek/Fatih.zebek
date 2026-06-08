import { orderService } from '../services/OrderService';
import { serviceReportService } from '../services/ServiceReportService';
import { excelService } from '../services/ExcelService';
import { transferService } from '../services/TransferService';
import { dataService } from '../services/DataService';
import type { PurchaseRequest } from '../services/OrderService';
import type { Transfer } from '../services/TransferService';

export const MaterialManagementPage = async (userProfile: any) => {
  const requests = await orderService.getRequests();
  const currentUserEmail = userProfile?.email || '';
  const isTargetUser = userProfile?.role?.toUpperCase() === 'ADMIN';
  const reports = await serviceReportService.getAllReports();
  const transfers = await transferService.getTransfers();

  // --- ANALYTICS CALCULATIONS ---
  const pendingCount = requests.filter(r => r.status === 'PENDING' || r.status === 'PARTIAL').length;
  
  // Aggregate MÇF materials
  const mcfMaterials: any[] = [];
  const materialUsageMap: Record<string, { count: number, desc: string }> = {};

  reports.forEach(report => {
    (report.materials || []).forEach(mat => {
      mcfMaterials.push({
        ...mat,
        reportNo: report.reportNo,
        siteName: report.siteName,
        date: report.date,
        matFormNo: report.matFormNo || '---',
        team: report.team
      });

      if (!materialUsageMap[mat.sapNo]) {
        materialUsageMap[mat.sapNo] = { count: 0, desc: mat.description };
      }
      materialUsageMap[mat.sapNo].count += (mat.used || 0);
    });
  });

  const topUsed = Object.entries(materialUsageMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 1)[0];

  const totalRequestedItems = requests.reduce((acc, r) => acc + (r.items?.length || 0), 0);

  // --- UI RENDER ---
  return `
    <style>
      :root {
        --bg-dark: #0a0a0a;
        --card-bg: rgba(15, 20, 25, 0.8);
        --accent-blue: var(--accent-cyan);
        --accent-glow: rgba(0, 243, 255, 0.15);
        --text-main: #ffffff;
        --text-dim: rgba(255, 255, 255, 0.6);
        --danger: #ff4d4d;
      }
      .pro-dashboard {
        padding: 2.5rem;
        max-width: 1600px;
        margin: 0 auto;
        font-family: 'Rajdhani', sans-serif;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1.5rem;
        margin-bottom: 3rem;
      }
      .stat-card-pro {
        background: rgba(10, 15, 25, 0.6);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 24px;
        padding: 1.8rem;
        position: relative;
        overflow: hidden;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 243, 255, 0.05);
        transition: all 0.3s;
      }
      .stat-card-pro:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 243, 255, 0.3);
        box-shadow: 0 10px 20px rgba(0, 243, 255, 0.1);
      }
      .stat-card-pro::before {
        content: '';
        position: absolute;
        top: 0; left: 0; width: 4px; height: 100%;
        background: var(--accent-blue);
        box-shadow: 0 0 15px var(--accent-blue);
      }
      .search-bar-pro {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(0, 243, 255, 0.2);
        border-radius: 16px;
        padding: 1rem 1.5rem;
        color: var(--text-main);
        width: 100%;
        font-size: 0.9rem;
        transition: all 0.3s;
      }
      .search-bar-pro:focus {
        border-color: var(--accent-cyan);
        box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
        outline: none;
      }
      .request-card {
        background: rgba(10, 15, 25, 0.6);
        backdrop-filter: blur(12px);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-radius: 24px;
        padding: 2rem;
        margin-bottom: 2rem;
        animation: fadeIn 0.5s ease-out;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5), inset 0 0 20px rgba(0, 243, 255, 0.05);
      }
      .tab-btn-pro {
        padding: 14px 28px;
        background: transparent;
        border: 1px solid transparent;
        color: var(--text-dim);
        font-weight: 800;
        cursor: pointer;
        border-radius: 14px;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        gap: 10px;
        letter-spacing: 1px;
      }
      .tab-btn-pro.active {
        background: rgba(0, 243, 255, 0.1);
        border-color: var(--accent-cyan);
        color: var(--accent-cyan);
        box-shadow: 0 0 15px rgba(0, 243, 255, 0.2);
      }
      .item-row-pro {
        background: rgba(0,0,0,0.4);
        border-radius: 16px;
        padding: 1.2rem;
        margin-bottom: 0.8rem;
        display: grid;
        grid-template-columns: 2.5fr 1fr 1fr 2fr 1fr;
        align-items: center;
        gap: 1.5rem;
        border: 1px solid rgba(0, 243, 255, 0.1);
        transition: all 0.3s;
      }
      .item-row-pro:hover {
        background: rgba(0, 243, 255, 0.05);
        border-color: rgba(0, 243, 255, 0.3);
      }
      .decision-btn {
        width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.02); color: var(--text-dim);
      }
      .decision-btn.approve.active { background: #28a745; color: white; border-color: #28a745; box-shadow: 0 0 20px rgba(40,167,69,0.3); }
      .decision-btn.reject.active { background: #dc3545; color: white; border-color: #dc3545; box-shadow: 0 0 20px rgba(220,53,69,0.3); }
      
      @media print {
        .sidebar, .top-nav, .no-print { display: none !important; }
        .pro-dashboard { padding: 0; }
        .request-card { border: 1px solid #ccc; break-inside: avoid; }
      }
    </style>

    <div class="pro-dashboard">
      <!-- Top Analytics -->
      <div class="stats-grid no-print">
        <div class="stat-card-pro">
          <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px;">Açık Talepler</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: #ffc107; margin-top: 10px;">${pendingCount}</div>
          <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 5px;">Onay bekleyen toplam dosya</div>
          ${isTargetUser ? `
            <div style="margin-top: 1rem; padding: 8px; background: rgba(0, 255, 255, 0.1); border-radius: 10px; border: 1px solid rgba(0, 255, 255, 0.2); font-size: 0.7rem; color: var(--accent-blue); font-weight: 800;">
              <i class="fa-solid fa-user-shield"></i> SN. ${(userProfile?.name || userProfile?.displayName || userProfile?.email?.split('@')[0] || 'ADMİN').toUpperCase()}, SİZE YÖNLENDİRİLEN TALEPLER VAR.
            </div>
          ` : ''}
        </div>
        <div class="stat-card-pro" style="--accent-blue: #28a745;">
          <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px;">En Çok Tüketilen</div>
          <div style="font-size: 1.1rem; font-weight: 900; color: #28a745; margin-top: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${topUsed ? topUsed[1].desc : '---'}
          </div>
          <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 5px;">Sahada en çok kullanılan malzeme</div>
        </div>
        <div class="stat-card-pro" style="--accent-blue: #007bff;">
          <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px;">Toplam Kalem</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: #007bff; margin-top: 10px;">${totalRequestedItems}</div>
          <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 5px;">Tüm depolardan gelen toplam talep</div>
        </div>
        <div class="stat-card-pro" style="--accent-blue: #dc3545;">
          <div style="font-size: 0.75rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1.5px;">MÇF Verisi</div>
          <div style="font-size: 2.5rem; font-weight: 900; color: #dc3545; margin-top: 10px;">${reports.length}</div>
          <div style="font-size: 0.7rem; color: var(--text-dim); margin-top: 5px;">Karşılaştırma için hazır rapor sayısı</div>
        </div>
      </div>

      <!-- Main Header & Controls -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem;" class="no-print">
        <div style="flex: 1;">
          <h1 style="margin: 0; font-size: 2.2rem; font-weight: 900; color: white; letter-spacing: -1px;">MALZEME KARAR MERKEZİ</h1>
          <div style="display: flex; gap: 10px; margin-top: 1.5rem;">
            <button onclick="window.switchTab('requests')" class="tab-btn-pro active" id="tab-requests">
              <i class="fa-solid fa-clipboard-list"></i> TALEPLER
            </button>
            <button onclick="window.switchTab('mcf')" class="tab-btn-pro" id="tab-mcf">
              <i class="fa-solid fa-chart-line"></i> SAHA SARFİYAT (MÇF)
            </button>
            ${isTargetUser ? `
              <button onclick="window.switchTab('transfers')" class="tab-btn-pro" id="tab-transfers" style="border: 1px solid #ff9800; color: #ff9800;">
                <i class="fa-solid fa-truck-ramp-box"></i> TRANSFER ONAYLARI
              </button>
              <button onclick="window.filterToMe()" class="tab-btn-pro" id="btn-to-me" style="border: 1px solid var(--accent-blue);">
                <i class="fa-solid fa-thumbtack"></i> BANA GELENLER
              </button>
            ` : ''}
          </div>
        </div>
        
        <div style="display: flex; gap: 1rem; align-items: center; flex: 1; justify-content: flex-end;">
          <div style="position: relative; width: 350px;">
            <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1.2rem; top: 50%; transform: translateY(-50%); color: var(--text-dim);"></i>
            <input type="text" id="global-search" class="search-bar-pro" placeholder="Malzeme, SAP veya Depo ara..." oninput="window.filterItems(this.value)" style="padding-left: 3.5rem;">
          </div>
          <button onclick="window.exportToExcel()" class="btn-cyber" style="background: #28a745; color: white; border: none; padding: 12px 24px; border-radius: 14px; font-weight: 900;">
            <i class="fa-solid fa-file-excel" style="margin-right: 8px;"></i> EXCEL
          </button>
          <button onclick="window.print()" class="btn-cyber" style="background: rgba(255,255,255,0.05); color: white; border: none; padding: 12px 24px; border-radius: 14px;">
            <i class="fa-solid fa-print"></i>
          </button>
        </div>
      </div>

      <!-- Requests View -->
      <div id="requests-view">
        ${requests.length === 0 ? `
           <div class="request-card" style="text-align: center; padding: 5rem;">
              <i class="fa-solid fa-box-open" style="font-size: 4rem; opacity: 0.1; margin-bottom: 1.5rem;"></i>
              <h3 style="color: var(--text-dim);">Bekleyen talep bulunmamaktadır.</h3>
           </div>
        ` : requests.map(req => {
          const isDirectedToMe = req.targetApprover === currentUserEmail;
          return `
          <div class="request-card filter-item" id="card-${req.id}" 
               style="${isDirectedToMe ? 'border: 2px solid var(--accent-blue); box-shadow: 0 0 30px rgba(0, 123, 255, 0.1);' : ''}"
               data-search="${req.warehouseName} ${req.requester} ${req.requesterName || ''} ${req.items.map(i => i.description + ' ' + i.sapNo).join(' ')}">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 1.5rem;">
                  <h2 style="margin: 0; font-size: 1.6rem; color: white;">${req.warehouseName}</h2>
                  ${getStatusBadge(req.status)}
                </div>
                <div style="display: flex; gap: 2rem; margin-top: 12px; font-size: 0.9rem; color: var(--text-dim); align-items: center;">
                  <span style="display: flex; align-items: center; gap: 8px; color: var(--text-main); font-weight: 700;">
                    <div style="width: 32px; height: 32px; border-radius: 50%; background: var(--accent-blue); color: #000; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; font-weight: 900;">
                      ${(req.requesterName || req.requester).charAt(0).toUpperCase()}
                    </div>
                    ${req.requesterName || req.requester}
                  </span>
                  <span><i class="fa-solid fa-envelope" style="color: var(--accent-blue); margin-right: 8px; opacity: 0.5;"></i>${req.requester}</span>
                  <span><i class="fa-solid fa-clock" style="color: var(--accent-blue); margin-right: 8px; opacity: 0.5;"></i>${formatTimestamp(req.timestamp)}</span>
                  ${isDirectedToMe ? '<span class="badge" style="background: rgba(0, 123, 255, 0.2); color: #007bff; border: 1px solid #007bff;"><i class="fa-solid fa-thumbtack"></i> SİZE ÖZEL</span>' : ''}
                </div>
                ${req.requesterNote ? `
                  <div style="margin-top: 1rem; padding: 12px; background: rgba(100, 255, 218, 0.03); border-radius: 12px; border-left: 4px solid var(--accent-blue); font-size: 0.85rem; color: var(--text-dim);">
                    <strong>TALEP GEREKÇESİ:</strong> ${req.requesterNote}
                  </div>
                ` : ''}
              </div>
              <div class="no-print">
                 <button onclick="window.processDecision('${req.id}')" class="btn-cyber" style="background: var(--accent-blue); color: #0a192f; padding: 14px 32px; border-radius: 12px; font-weight: 900; box-shadow: 0 10px 30px rgba(100, 255, 218, 0.15);">KAYDET VE ONAYLA</button>
              </div>
            </div>

            <div class="items-list">
               <div style="display: grid; grid-template-columns: 2.5fr 1fr 1fr 2fr 1fr; padding: 0 1.2rem 1rem; font-size: 0.7rem; color: var(--text-dim); font-weight: 900; text-transform: uppercase; letter-spacing: 1px;">
                  <div>Malzeme / SAP</div>
                  <div style="text-align: center;">Mevcut / Limit</div>
                  <div style="text-align: center;">Talep</div>
                  <div>Yönetici Notu</div>
                  <div style="text-align: center;" class="no-print">Karar</div>
               </div>
               ${req.items.map((item, idx) => `
                 <div class="item-row-pro" data-request-id="${req.id}" data-item-idx="${idx}">
                   <div>
                      <div style="font-weight: 700; color: white; font-size: 0.95rem;">${item.description}</div>
                      <div style="font-size: 0.75rem; color: var(--accent-blue); font-family: monospace; margin-top: 4px;">${item.sapNo}</div>
                   </div>
                   <div style="text-align: center;">
                      <div style="font-size: 1.1rem; font-weight: 900; color: ${(item.limit && item.limit > 0 && item.currentStock <= item.limit) ? 'var(--danger)' : 'white'};">${item.currentStock}</div>
                      ${(item.limit && item.limit > 0) ? `<div style="font-size: 0.65rem; opacity: 0.5;">LİMİT: ${item.limit}</div>` : ''}
                   </div>
                   <div style="text-align: center; font-size: 1.4rem; font-weight: 900; color: var(--accent-blue);">${item.quantity}</div>
                   <div>
                      <input type="text" class="search-bar-pro item-note" value="${item.note || ''}" placeholder="Malzeme bazlı not..." style="padding: 8px 12px; font-size: 0.8rem; background: rgba(255,255,255,0.02);">
                   </div>
                   <div style="display: flex; gap: 12px; justify-content: center;" class="no-print">
                      <div class="decision-btn approve ${item.status === 'APPROVED' ? 'active' : ''}" onclick="window.setItemDecision(this, 'APPROVED')"><i class="fa-solid fa-check"></i></div>
                      <div class="decision-btn reject ${item.status === 'REJECTED' ? 'active' : ''}" onclick="window.setItemDecision(this, 'REJECTED')"><i class="fa-solid fa-xmark"></i></div>
                   </div>
                 </div>
               `).join('')}
            </div>
            <textarea id="manager-note-${req.id}" class="search-bar-pro" style="height: 80px; margin-top: 1.5rem; resize: none;" placeholder="Genel yönetici notu veya feedback...">${req.managerNote || ''}</textarea>
          </div>
        `;
      }).join('')}
      </div>

      <!-- MCF View -->
      <div id="mcf-view" style="display: none;">
         <div class="request-card">
            <h3 style="margin: 0 0 2rem 0; color: white;">SAHA SARFİYATLARI VE ANALİZ</h3>
            <div style="background: rgba(0,0,0,0.2); border-radius: 20px; overflow: hidden;">
               <table style="width: 100%; border-collapse: collapse;">
                  <thead style="background: rgba(255,255,255,0.02);">
                    <tr>
                      <th style="padding: 1.2rem; text-align: left; color: var(--text-dim); font-size: 0.75rem;">TARİH</th>
                      <th style="padding: 1.2rem; text-align: left; color: var(--text-dim); font-size: 0.75rem;">MÇF NO</th>
                      <th style="padding: 1.2rem; text-align: left; color: var(--text-dim); font-size: 0.75rem;">SAHA / TÜRBİN</th>
                      <th style="padding: 1.2rem; text-align: left; color: var(--text-dim); font-size: 0.75rem;">MALZEME</th>
                      <th style="padding: 1.2rem; text-align: center; color: var(--text-dim); font-size: 0.75rem;">ADET</th>
                      <th style="padding: 1.2rem; text-align: left; color: var(--text-dim); font-size: 0.75rem;">EKİP</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${mcfMaterials.map(m => `
                      <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                        <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-dim);">${m.date}</td>
                        <td style="padding: 1rem; font-weight: 700; color: var(--accent-blue);">${m.matFormNo}</td>
                        <td style="padding: 1rem;">
                           <div style="font-weight: 600;">${m.siteName}</div>
                           <div style="font-size: 0.7rem; opacity: 0.5;">WEC ${m.reportNo.split('-')[0]}</div>
                        </td>
                        <td style="padding: 1rem;">
                           <div style="font-weight: 600;">${m.description}</div>
                           <div style="font-size: 0.7rem; color: var(--text-dim);">${m.sapNo}</div>
                        </td>
                        <td style="padding: 1rem; text-align: center; font-weight: 900; color: var(--accent-blue);">${m.used}</td>
                        <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-dim);">${m.team}</td>
                      </tr>
                    `).join('')}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      <!-- Transfers View (Hurşit Akter Only) -->
      ${isTargetUser ? `
        <div id="transfers-view" style="display: none;">
          <div class="request-card">
            <h3 style="margin: 0 0 2rem 0; color: white;">TRANSFER ONAYLARI</h3>
            ${transfers.filter(t => t.status === 'PENDING').length === 0 ? `
              <div style="text-align: center; padding: 3rem; color: var(--text-dim);">
                <i class="fa-solid fa-truck-fast" style="font-size: 3rem; opacity: 0.1; margin-bottom: 1rem;"></i>
                <p>Bekleyen transfer talebi bulunmuyor.</p>
              </div>
            ` : transfers.filter(t => t.status === 'PENDING').map(t => `
              <div class="item-row-pro" style="grid-template-columns: 2fr 1fr 1fr 1fr 1.5fr; gap: 1rem; padding: 1.5rem;">
                <div>
                  <div style="font-weight: 800; color: white;">${t.materialName}</div>
                  <div style="font-size: 0.75rem; color: var(--accent-blue); font-family: monospace;">${t.materialCode}</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 0.65rem; color: var(--text-dim);">NEREDEN</div>
                  <div style="font-weight: 700; color: #ff4d4d; font-size: 0.85rem;">${dataService.resolveName(t.fromSiteId)}</div>
                  <div style="font-size: 0.6rem; opacity: 0.5;">${t.fromSiteId}</div>
                </div>
                <div style="text-align: center;">
                  <i class="fa-solid fa-arrow-right" style="color: var(--text-dim); opacity: 0.3;"></i>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 0.65rem; color: var(--text-dim);">NEREYE</div>
                  <div style="font-weight: 700; color: #2ecc71; font-size: 0.85rem;">${dataService.resolveName(t.toSiteId)}</div>
                  <div style="font-size: 0.6rem; opacity: 0.5;">${t.toSiteId}</div>
                </div>
                <div style="text-align: center;">
                  <div style="font-size: 0.65rem; color: var(--text-dim);">MİKTAR</div>
                  <div style="font-size: 1.2rem; font-weight: 900; color: var(--accent-blue);">${t.quantity}</div>
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end;">
                  <button onclick="window.handleTransferApproval('${t.id}', true)" class="btn-cyber" style="background: #28a745; color: white; border: none; padding: 8px 15px; border-radius: 8px; font-size: 0.7rem; font-weight: 900;">
                    <i class="fa-solid fa-check"></i> ONAYLA
                  </button>
                  <button onclick="window.handleTransferApproval('${t.id}', false)" class="btn-cyber" style="background: #dc3545; color: white; border: none; padding: 8px 15px; border-radius: 8px; font-size: 0.7rem; font-weight: 900;">
                    <i class="fa-solid fa-xmark"></i> RED
                  </button>
                </div>
              </div>
            `).join('')}

            <h4 style="margin: 3rem 0 1rem 0; color: var(--text-dim); font-size: 0.8rem; letter-spacing: 1px;">SON TAMAMLANANLAR</h4>
            <div style="background: rgba(0,0,0,0.1); border-radius: 16px; padding: 1rem;">
              ${transfers.filter(t => t.status !== 'PENDING').slice(0, 5).map(t => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid rgba(255,255,255,0.02); font-size: 0.8rem;">
                  <div style="color: var(--text-main); font-weight: 600;">${t.materialName} <span style="color: var(--text-dim); font-size: 0.7rem;">(${t.quantity} Ad.)</span></div>
                  <div style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 0.7rem; color: var(--text-dim);">${dataService.resolveName(t.fromSiteId)} → ${dataService.resolveName(t.toSiteId)}</span>
                    <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; background: ${t.status === 'COMPLETED' ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)'}; color: ${t.status === 'COMPLETED' ? '#28a745' : '#dc3545'};">
                      ${t.status === 'COMPLETED' ? 'TAMAMLANDI' : 'REDDEDİLDİ'}
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `;
};

// HELPER FOR BADGES
const getStatusBadge = (status: PurchaseRequest['status']) => {
  const styles: Record<string, string> = {
    'PENDING': 'background: rgba(255, 193, 7, 0.1); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.2);',
    'PARTIAL': 'background: rgba(255, 152, 0, 0.1); color: #ff9800; border: 1px solid rgba(255, 152, 0, 0.2);',
    'APPROVED': 'background: rgba(40, 167, 69, 0.1); color: #28a745; border: 1px solid rgba(40, 167, 69, 0.2);',
    'ORDERED': 'background: rgba(0, 123, 255, 0.1); color: #007bff; border: 1px solid rgba(0, 123, 255, 0.2);',
    'REJECTED': 'background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid rgba(220, 53, 69, 0.2);'
  };
  return `<span style="padding: 6px 16px; border-radius: 30px; font-size: 0.75rem; font-weight: 900; text-transform: uppercase; ${styles[status] || ''}">${status}</span>`;
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

// GLOBAL HANDLERS
(window as any).filterItems = (query: string) => {
  const items = document.querySelectorAll('.filter-item');
  const q = query.toLowerCase();
  items.forEach((item: any) => {
    const text = item.dataset.search.toLowerCase();
    item.style.display = text.includes(q) ? 'block' : 'none';
  });
};

(window as any).filterToMe = () => {
  const items = document.querySelectorAll('.filter-item');
  const btn = document.getElementById('btn-to-me');
  const isActive = btn?.classList.contains('active');
  
  if (isActive) {
    btn?.classList.remove('active');
    items.forEach((item: any) => item.style.display = 'block');
  } else {
    btn?.classList.add('active');
    items.forEach((item: any) => {
      const isToMe = item.innerHTML.includes('SİZE ÖZEL');
      item.style.display = isToMe ? 'block' : 'none';
    });
  }
};

(window as any).switchTab = (tab: string) => {
  document.getElementById('requests-view')!.style.display = tab === 'requests' ? 'block' : 'none';
  document.getElementById('mcf-view')!.style.display = tab === 'mcf' ? 'block' : 'none';
  const transView = document.getElementById('transfers-view');
  if (transView) transView.style.display = tab === 'transfers' ? 'block' : 'none';
  
  document.querySelectorAll('.tab-btn-pro').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tab}`)?.classList.add('active');
};

(window as any).handleTransferApproval = async (transferId: string, approve: boolean) => {
  const adminEmail = (window as any).currentUser?.email || (window as any).userProfile?.email || 'hursit.akter@demirerholding.com';
  
  try {
    if (!approve) {
      const reason = prompt('Reddetme gerekçesini giriniz:');
      if (reason === null) return;
      await transferService.rejectTransfer(transferId, adminEmail, reason);
    } else {
      if (!confirm('Bu transferi onaylıyor musunuz? Stoklar otomatik olarak güncellenecektir.')) return;
      
      const transfers = await transferService.getTransfers();
      const transfer = transfers.find(t => t.id === transferId);
      if (!transfer) return;
      
      await transferService.approveTransfer(transfer, adminEmail);
    }
    
    alert(`✅ İşlem başarıyla tamamlandı.`);
    (window as any).render({ skipShell: true });
  } catch (error) {
    console.error(error);
    alert('❌ Bir hata oluştu: ' + (error as Error).message);
  }
};

(window as any).setItemDecision = (btn: HTMLElement, _status: 'APPROVED' | 'REJECTED') => {
  const parent = btn.parentElement!;
  const isCurrentlyActive = btn.classList.contains('active');
  
  parent.querySelectorAll('.decision-btn').forEach(b => b.classList.remove('active'));
  if (!isCurrentlyActive) {
    btn.classList.add('active');
  }
};

(window as any).processDecision = async (requestId: string) => {
  const card = document.getElementById(`card-${requestId}`);
  if (!card) return;

  const btn = event?.target as HTMLButtonElement;
  try {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> İŞLENİYOR...';

    const itemRows = card.querySelectorAll('.item-row-pro');
    const updatedItems: any[] = [];
    
    itemRows.forEach((row: any) => {
      const approveBtn = row.querySelector('.decision-btn.approve');
      const rejectBtn = row.querySelector('.decision-btn.reject');
      const noteInput = row.querySelector('.item-note') as HTMLInputElement;
      
      let status = 'PENDING';
      if (approveBtn.classList.contains('active')) status = 'APPROVED';
      else if (rejectBtn.classList.contains('active')) status = 'REJECTED';

      updatedItems.push({ status, note: noteInput.value });
    });

    const managerNote = (document.getElementById(`manager-note-${requestId}`) as HTMLTextAreaElement).value;
    const requests = await orderService.getRequests();
    const request = requests.find(r => r.id === requestId);
    if (!request) return;

    const mergedItems = request.items.map((item, idx) => ({
      ...item,
      status: updatedItems[idx].status,
      note: updatedItems[idx].note
    }));

    const allApproved = updatedItems.every(i => i.status === 'APPROVED');
    const allRejected = updatedItems.every(i => i.status === 'REJECTED');
    let overallStatus: any = 'PARTIAL';
    if (allApproved) overallStatus = 'APPROVED';
    if (allRejected) overallStatus = 'REJECTED';

    await orderService.updateRequest(requestId, {
      items: mergedItems,
      managerNote,
      status: overallStatus
    });

    alert('✅ Talepler başarıyla güncellendi.');
    (window as any).render({ skipShell: true });
  } catch (e) {
    console.error(e);
    btn.disabled = false;
    btn.innerHTML = 'HATA OLUŞTU';
  }
};

(window as any).exportToExcel = async () => {
  const requests = await orderService.getRequests();
  await excelService.exportRequestsToExcel(requests, `DH_Malzeme_Talepleri_${new Date().toISOString().split('T')[0]}`);
};
