import * as XLSX from 'xlsx';
import { orderService } from '../services/OrderService';
import { serviceReportService } from '../services/ServiceReportService';
import { excelService } from '../services/ExcelService';
import { transferService } from '../services/TransferService';
import { dataService } from '../services/DataService';
import { purchaseService } from '../services/PurchaseService';
import { warehouseService } from '../services/WarehouseService';
import type { PurchaseRequest as OrderPurchaseRequest } from '../services/OrderService';
import type { Transfer } from '../services/TransferService';
import { authService } from '../services/AuthService';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, addDoc, serverTimestamp, setDoc } from 'firebase/firestore';
// HELPER FOR BADGES
const getStatusBadge = (status: OrderPurchaseRequest['status']) => {
  const styles: Record<string, string> = {
    'PENDING': 'background: rgba(255, 193, 7, 0.1); color: #ffc107; border: 1px solid rgba(255, 193, 7, 0.2);',
    'PARTIAL': 'background: rgba(255, 152, 0, 0.1); color: #ff9800; border: 1px solid rgba(255, 152, 0, 0.2);',
    'APPROVED': 'background: rgba(40, 167, 69, 0.1); color: #28a745; border: 1px solid rgba(40, 167, 69, 0.2);',
    'ORDERED': 'background: rgba(0, 123, 255, 0.1); color: #007bff; border: 1px solid rgba(0, 123, 255, 0.2);',
    'REJECTED': 'background: rgba(220, 53, 69, 0.1); color: #dc3545; border: 1px solid rgba(220, 53, 69, 0.2);'
  };
  return `<span style="padding: 4px 12px; border-radius: 30px; font-size: 0.7rem; font-weight: 900; text-transform: uppercase; ${styles[status] || ''}">${status}</span>`;
};

const formatTimestamp = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};


export const MaterialManagementPage = async (userProfile: any, activeTab: string = 'requests') => {
  const requests = await orderService.getRequests();
  const currentUserEmail = userProfile?.email || '';
  const isAdmin = userProfile?.role?.toUpperCase() === 'ADMIN';
  const isMaterialManager = userProfile?.role === 'MALZEME_YONETIMI' || userProfile?.email?.toLowerCase() === 'hursit.akter@demirerholding.com';
  const reports = await serviceReportService.getAllReports();
  const transfers = await transferService.getTransfers();
  const purchaseRequests = await purchaseService.getRequests('ALL');
  const warehouses = dataService.getWarehouses();

  let materialCards: any[] = [];
  let salesLogs: any[] = [];
  let repairLogs: any[] = [];
  let nonstockLogs: any[] = [];
  let globalInventory: any[] = [];

  try {
    const [poolSnap, salesSnap, repairSnap, nonstockSnap, globalInv] = await Promise.all([
      getDocs(collection(db, 'GlobalMaterialImages')).catch(e => { console.warn("GlobalMaterialImages load error", e); return { docs: [] } as any; }),
      getDocs(collection(db, 'sales_logs')).catch(e => { console.warn("sales_logs load error", e); return { docs: [] } as any; }),
      getDocs(collection(db, 'repair_logs')).catch(e => { console.warn("repair_logs load error", e); return { docs: [] } as any; }),
      getDocs(collection(db, 'non_stock_logs')).catch(e => { console.warn("non_stock_logs load error", e); return { docs: [] } as any; }),
      warehouseService.getGlobalInventory().catch(e => { console.warn("global inventory load error", e); return []; })
    ]);
    materialCards = poolSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    salesLogs = salesSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    repairLogs = repairSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    nonstockLogs = nonstockSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    globalInventory = globalInv;
  } catch (e) {
    console.warn("Could not load global material data logs", e);
  }

  // --- ANALYTICS CALCULATIONS ---
  const pendingCount = requests.filter(r => r.status === 'PENDING' || r.status === 'PARTIAL').length;
  
  // Aggregate MÇF materials
  const mcfMaterials: any[] = [];
  const materialUsageMap: Record<string, { count: number, desc: string }> = {};

  reports.forEach(report => {
    (report.materials || []).forEach(mat => {
      if (mat.used && mat.used > 0) {
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
        materialUsageMap[mat.sapNo].count += mat.used;
      }
    });
  });

  const topUsed = Object.entries(materialUsageMap)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 1)[0];

  (window as any).mcfMaterials = mcfMaterials;
  let currentMcfPage = 1;
  const mcfItemsPerPage = 50;
  let selectedMcfSite = 'ALL';

  (window as any).changeMcfPage = (page: number) => {
     currentMcfPage = page;
     (window as any).renderMcfTable();
  };

  (window as any).filterMcf = (val: string) => {
     currentMcfPage = 1;
     (window as any).renderMcfTable();
  };

  (window as any).selectMcfSite = (siteName: string) => {
     selectedMcfSite = siteName;
     currentMcfPage = 1;
     document.querySelectorAll('.mcf-site-pill').forEach((pill: any) => {
        if (pill.dataset.site === siteName) {
           pill.classList.add('active');
        } else {
           pill.classList.remove('active');
        }
     });
     (window as any).renderMcfTable();
  };

  (window as any).renderMcfTable = () => {
     const tbody = document.getElementById('mcf-tbody');
     if (!tbody) return;

     const searchInput = document.getElementById('mcf-search') as HTMLInputElement;
     const term = searchInput ? searchInput.value.toLowerCase().trim() : '';

     // Sort materials by date descending
     const sorted = [...(window as any).mcfMaterials].sort((a, b) => {
       const dateA = new Date(a.date).getTime() || 0;
       const dateB = new Date(b.date).getTime() || 0;
       return dateB - dateA;
     });

     const filtered = sorted.filter(m => {
        const matchesSite = selectedMcfSite === 'ALL' || m.siteName === selectedMcfSite;
        if (!matchesSite) return false;

        const sap = String(m.sapNo || '').toLowerCase();
        const desc = String(m.description || '').toLowerCase();
        const site = String(m.siteName || '').toLowerCase();
        const team = String(m.team || '').toLowerCase();
        return term === '' || sap.includes(term) || desc.includes(term) || site.includes(term) || team.includes(term);
      });

     const totalItems = filtered.length;
     const totalPages = Math.ceil(totalItems / mcfItemsPerPage) || 1;

     if (currentMcfPage > totalPages) currentMcfPage = totalPages;
     if (currentMcfPage < 1) currentMcfPage = 1;

     const startIndex = (currentMcfPage - 1) * mcfItemsPerPage;
     const endIndex = Math.min(startIndex + mcfItemsPerPage, totalItems);
     const paginated = filtered.slice(startIndex, endIndex);

     if (paginated.length === 0) {
       tbody.innerHTML = `<tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-dim);">Aramaya uygun sarfiyat bulunamadı.</td></tr>`;
     } else {
       tbody.innerHTML = paginated.map(m => `
         <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
           <td style="padding: 1rem; font-size: 0.8rem; color: var(--text-dim);">${m.date ? new Date(m.date).toLocaleDateString('tr-TR') : '-'}</td>
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
       `).join('');
     }

     const paginationDiv = document.getElementById('mcf-pagination');
     if (paginationDiv) {
       if (totalItems === 0) {
         paginationDiv.innerHTML = '';
         return;
       }
       const showingStart = startIndex + 1;
       const showingEnd = endIndex;
       paginationDiv.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1.2rem; background-color: rgba(0,0,0,0.3); border-top: 1px solid rgba(0, 243, 255, 0.1); flex-wrap: wrap; gap: 1rem; border-radius: 0 0 20px 20px;">
            <div style="color: var(--text-dim); font-size: 0.8rem;">
              <span>${totalItems} kayıt arasından <strong>${showingStart}-${showingEnd}</strong> arası gösteriliyor</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px;">
              <button onclick="window.changeMcfPage(1)" ${currentMcfPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #111827; border: 1px solid rgba(0, 243, 255, 0.2); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-left"></i>
              </button>
              <button onclick="window.changeMcfPage(${currentMcfPage - 1})" ${currentMcfPage === 1 ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #111827; border: 1px solid rgba(0, 243, 255, 0.2); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-left"></i>
              </button>
              
              <span style="color: #E2E8F0; font-size: 0.8rem; padding: 0 0.5rem; font-weight: 600;">Sayfa ${currentMcfPage} / ${totalPages}</span>
              
              <button onclick="window.changeMcfPage(${currentMcfPage + 1})" ${currentMcfPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #111827; border: 1px solid rgba(0, 243, 255, 0.2); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angle-right"></i>
              </button>
              <button onclick="window.changeMcfPage(${totalPages})" ${currentMcfPage === totalPages ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #111827; border: 1px solid rgba(0, 243, 255, 0.2); color: #E2E8F0; width: 32px; height: 32px; border-radius: 6px; font-weight: bold; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 0.8rem;">
                <i class="fa-solid fa-angles-right"></i>
              </button>
            </div>
          </div>
       `;
     }
  };

  setTimeout(() => {
     if ((window as any).renderMcfTable) {
       (window as any).renderMcfTable();
     }
  }, 100);

  const totalRequestedItems = requests.reduce((acc, r) => acc + (r.items?.length || 0), 0);

  if (!isMaterialManager && isAdmin) {
    // ==========================================
    // ADMIN VIEW (Original untouched)
    // ==========================================
    const isTargetUser = true; // For admin rendering
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
           <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; flex-wrap: wrap; gap: 1rem;">
             <h3 style="margin: 0; color: white;">SAHA SARFİYATLARI VE ANALİZ</h3>
             <div style="position: relative;">
                <i class="fa-solid fa-search" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.85rem;"></i>
                <input type="text" id="mcf-search" oninput="window.filterMcf(this.value)" placeholder="Malzeme adı veya SAP numarası ara..." style="width: 320px; height: 42px; background-color: #0A0E17; border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 12px; color: #FFFFFF; padding: 0 1rem 0 2.5rem; outline: none; font-size: 0.85rem;" />
             </div>
          </div>
          <div style="background: rgba(0,0,0,0.2); border-radius: 20px 20px 0 0; overflow: hidden;">
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
                <tbody id="mcf-tbody">
                   <tr><td colspan="6" style="padding: 2rem; text-align: center; color: var(--text-dim);">Yükleniyor...</td></tr>
                </tbody>
             </table>
             <div id="mcf-pagination"></div>
          </div>
        </div>

        <!-- Transfers View -->
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
  }

  // ==========================================
  // MALZEME YÖNETİMİ SPACE STATION DASHBOARD (isMaterialManager)
  // ==========================================
  const pendingPRCount = purchaseRequests.filter(pr => pr.status === 'PENDING').length;
  const pendingTransfersCount = transfers.filter(t => t.status === 'PENDING').length;

  // --- NEW MULTI-TAB CALCULATIONS ---
  const orderSubViews = [
    'requests', 'purchase-open', 'purchase-ordered', 'purchase-delivery', 
    'purchase-invoice', 'purchase-stock', 'transfers-out', 'transfers-in', 
    'entry-invoice', 'entry-transfer', 'entry-sale', 'entry-repair', 
    'entry-nonstock', 'research-search', 'research-name', 'research-photo', 
    'research-drawing', 'research-suppliers', 'research-price', 'mcf'
  ];
  const currentActiveTab = orderSubViews.includes(activeTab) ? 'orders' : activeTab;

  // 1. Group global inventory by warehouse
  const whStats = new Map<string, { totalItems: number, totalQty: number, totalDefect: number }>();
  globalInventory.forEach(item => {
    const whId = item.warehouseId;
    if (!whStats.has(whId)) {
      whStats.set(whId, { totalItems: 0, totalQty: 0, totalDefect: 0 });
    }
    const stats = whStats.get(whId)!;
    if (item.condition === 'DEFECT') {
      stats.totalDefect += (item.quantity || 0);
    } else {
      stats.totalItems++;
      stats.totalQty += (item.quantity || 0);
    }
  });

  const warehousesGridHtml = warehouses.map(w => {
    const stats = whStats.get(w.id) || { totalItems: 0, totalQty: 0, totalDefect: 0 };
    const isMobile = w.id.startsWith('team_');
    return `
      <div class="sci-card" style="padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; min-height: 150px; background: rgba(10, 15, 30, 0.45); border: 1px solid rgba(255, 255, 255, 0.05); border-left: 4px solid ${isMobile ? '#eab308' : 'var(--accent-cyan)'}; transition: all 0.25s; border-radius: 10px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.borderColor='rgba(0, 243, 255, 0.25)'" onmouseout="this.style.transform='none'; this.style.borderColor='rgba(255, 255, 255, 0.05)'">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
            <span style="font-size: 0.6rem; padding: 2px 6px; border-radius: 4px; background: ${isMobile ? 'rgba(234, 179, 8, 0.08)' : 'rgba(0, 243, 255, 0.08)'}; color: ${isMobile ? '#eab308' : 'var(--accent-cyan)'}; border: 1px solid ${isMobile ? 'rgba(234, 179, 8, 0.15)' : 'rgba(0, 243, 255, 0.15)'}; font-weight: bold;">
              ${isMobile ? 'MOBİL DEPO' : 'SABİT DEPO'}
            </span>
            <i class="${isMobile ? 'fa-solid fa-truck-moving' : 'fa-solid fa-warehouse'}" style="color: rgba(255,255,255,0.2); font-size: 0.95rem;"></i>
          </div>
          <h4 style="margin: 0; color: white; font-size: 0.95rem; font-weight: 800; letter-spacing: 0.3px;">${w.name}</h4>
          <p style="margin: 3px 0 0 0; font-size: 0.7rem; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${(w as any).description || 'Açıklama girilmemiş.'}</p>
        </div>
        
        <div style="margin-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.04); padding-top: 0.6rem;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 4px; text-align: center; font-family: monospace; font-size: 0.7rem;">
            <div>
              <div style="color: rgba(255,255,255,0.35); font-size: 0.55rem; margin-bottom: 1px;">KALEM</div>
              <strong style="color: white; font-size: 0.85rem;">${stats.totalItems}</strong>
            </div>
            <div style="border-left: 1px solid rgba(255,255,255,0.04); border-right: 1px solid rgba(255,255,255,0.04);">
              <div style="color: rgba(255,255,255,0.35); font-size: 0.55rem; margin-bottom: 1px;">TOPLAM</div>
              <strong style="color: var(--accent-cyan); font-size: 0.85rem;">${stats.totalQty}</strong>
            </div>
            <div>
              <div style="color: rgba(255,255,255,0.35); font-size: 0.55rem; margin-bottom: 1px;">ARIZALI</div>
              <strong style="color: ${stats.totalDefect > 0 ? '#ff4d4d' : 'rgba(255,255,255,0.25)'}; font-size: 0.85rem;">${stats.totalDefect}</strong>
            </div>
          </div>
        </div>

        <button onclick="window.navigate('warehouses', '${w.id}')" class="glow-btn" style="width: 100%; margin-top: 0.75rem; padding: 4px; font-size: 0.7rem; background: rgba(0,243,255,0.03); border-color: rgba(0,243,255,0.12);">
          DEPOYA GİT <i class="fa-solid fa-arrow-right-to-bracket" style="margin-left: 4px; font-size: 0.65rem;"></i>
        </button>
      </div>
    `;
  }).join('');

  // 2. Map defect materials to their söküldüğü MÇF reports
  const defectReportsMap = new Map<string, Array<{ reportNo: string, date: string, siteName: string, qty: number, team: string }>>();
  reports.forEach(report => {
    (report.materials || []).forEach(mat => {
      if (mat.type === 'S' && mat.sapNo) {
        const sapNo = String(mat.sapNo).trim();
        if (!defectReportsMap.has(sapNo)) {
          defectReportsMap.set(sapNo, []);
        }
        defectReportsMap.get(sapNo)!.push({
          reportNo: report.reportNo || report.matFormNo || '---',
          date: report.date || '-',
          siteName: report.siteName || '-',
          qty: mat.defectCount || mat.used || 0,
          team: report.team || '-'
        });
      }
    });
  });

  const defectItems = globalInventory.filter(item => item.condition === 'DEFECT' && (item.quantity || 0) > 0);

  // 3. Consolidated Audits Fetch
  const auditPromises = warehouses.map(async (w) => {
    try {
      return await warehouseService.getAuditHistory(w.id).then(audits => 
        audits.map(a => ({ ...a, warehouseId: w.id, warehouseName: w.name }))
      );
    } catch (e) {
      console.warn("Failed to get audits for warehouse", w.id, e);
      return [];
    }
  });
  const allAuditsNested = await Promise.all(auditPromises);
  const allAudits = allAuditsNested.flat();
  allAudits.sort((a, b) => {
    const timeA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : new Date(a.date || '').getTime() || 0;
    const timeB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : new Date(b.date || '').getTime() || 0;
    return timeB - timeA;
  });

  const pageHtml = `
    <style>
      .cyber-deck {
        padding: 0.5rem 1.25rem;
        max-width: 1650px;
        margin: 0 auto;
        font-family: 'Rajdhani', sans-serif;
        color: #FFFFFF;
        position: relative;
      }
      .telemetry-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 0.65rem;
        margin-bottom: 0.75rem;
      }
      .telemetry-card {
        background: rgba(8, 12, 21, 0.65);
        backdrop-filter: blur(15px);
        border: 1px solid rgba(0, 243, 255, 0.15);
        border-bottom: 3px solid var(--card-glow, #00f3ff);
        border-radius: 12px;
        padding: 0.5rem 0.85rem;
        position: relative;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.5);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        overflow: hidden;
      }
      .telemetry-card:hover {
        transform: translateY(-2px);
        border-color: rgba(0, 243, 255, 0.4);
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
      }
      .telemetry-value {
        font-size: 1.65rem;
        font-weight: 900;
        margin-top: 2px;
      }
      .sci-tab-bar {
        display: flex;
        background: rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 12px;
        padding: 3px;
        gap: 3px;
        margin-bottom: 1.5rem;
      }
      .sci-tab-btn {
        padding: 8px 18px;
        background: transparent;
        border: none;
        color: rgba(255,255,255,0.5);
        font-weight: 800;
        cursor: pointer;
        border-radius: 8px;
        transition: all 0.2s ease;
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.8rem;
        letter-spacing: 1px;
      }
      .sci-tab-btn:hover {
        color: white;
        background: rgba(255,255,255,0.03);
      }
      .sci-tab-btn.active {
        background: rgba(0, 243, 255, 0.1);
        border: 1px solid rgba(0, 243, 255, 0.3);
        color: var(--accent-cyan);
      }
      .glass-deck-panel {
        background: rgba(8, 12, 21, 0.6);
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.05);
        border-radius: 14px;
        padding: 0.85rem 1.15rem;
        box-shadow: 0 15px 40px rgba(0,0,0,0.7);
        position: relative;
      }
      .glass-deck-panel::before {
        content: 'OPERATIONAL DECK';
        position: absolute;
        top: -10px; left: 30px;
        background: #0f172a;
        padding: 2px 10px;
        font-size: 0.55rem;
        letter-spacing: 2px;
        color: var(--accent-cyan);
        border: 1px solid rgba(0,243,255,0.3);
        border-radius: 4px;
        font-weight: bold;
      }
      .sci-input {
        background: rgba(0, 0, 0, 0.6) !important;
        border: 1px solid rgba(0, 243, 255, 0.2) !important;
        border-radius: 8px !important;
        color: #fff !important;
        padding: 6px 10px !important;
        transition: all 0.3s !important;
      }
      .sci-input:focus {
        border-color: var(--accent-cyan) !important;
        outline: none !important;
      }
      .cyber-table {
        width: 100%;
        border-collapse: collapse;
      }
      .cyber-table th {
        background: rgba(255,255,255,0.01);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 0.4rem 0.6rem;
        font-size: 0.7rem;
        letter-spacing: 1.2px;
        color: rgba(255,255,255,0.4);
        text-transform: uppercase;
        font-weight: 800;
      }
      .cyber-table td {
        padding: 0.4rem 0.6rem;
        border-bottom: 1px solid rgba(255,255,255,0.02);
      }
      .glow-btn {
        background: linear-gradient(135deg, rgba(0,243,255,0.1), rgba(0,243,255,0.2));
        border: 1px solid var(--accent-cyan);
        color: white;
        padding: 8px 18px;
        border-radius: 8px;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.3s;
      }
      .glow-btn:hover {
        background: linear-gradient(135deg, rgba(0,243,255,0.2), rgba(0,243,255,0.35));
        transform: translateY(-1px);
      }
      .sci-card {
        background: rgba(0, 0, 0, 0.4);
        border: 1px solid rgba(255,255,255,0.03);
        border-left: 4px solid var(--accent-cyan);
        border-radius: 8px;
        padding: 0.6rem 1rem;
        margin-bottom: 0.5rem;
        transition: all 0.3s;
      }
      .sci-card:hover {
        border-left-color: #00ff87;
        background: rgba(255,255,255,0.01);
      }
      .sci-action-btn {
        width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
        cursor: pointer; transition: all 0.2s; border: 1px solid rgba(255,255,255,0.1);
        background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.6);
        font-size: 0.75rem;
      }
      .sci-action-btn.approve:hover { background: #28a745; color: white; border-color: #28a745; }
      .sci-action-btn.reject:hover { background: #dc3545; color: white; border-color: #dc3545; }
    </style>

    <div class="cyber-deck">
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 0.75rem;">
        <div>
          <div style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">
             <i class="fa-solid fa-satellite-dish"></i> DEMİRER HOLDİNG Lojistik Kontrol Merkezi
          </div>
          <h1 style="margin: 3px 0 0 0; font-size: 1.4rem; font-weight: 900; color: white; text-shadow: 0 0 8px rgba(255,255,255,0.1);">
             MALZEME KONTROL & YÖNETİM ÜSSÜ
          </h1>
        </div>

        <div style="display: flex; gap: 8px;" class="no-print">
          <button onclick="window.exportToExcel()" class="glow-btn" style="background: rgba(40,167,69,0.15); border-color: #28a745; padding: 6px 14px; font-size: 0.75rem;">
            <i class="fa-solid fa-file-excel" style="margin-right: 5px;"></i> EXCEL RAPORU
          </button>
          <button onclick="window.print()" class="glow-btn" style="background: rgba(255,255,255,0.02); border-color: rgba(255,255,255,0.1); padding: 6px 14px; font-size: 0.75rem;">
            <i class="fa-solid fa-print"></i>
          </button>
        </div>
      </div>

      <!-- 🚀 Futuristic Cyber-glassmorphic Tab Bar -->
      <div class="sci-tab-bar no-print" style="margin-bottom: 1rem;">
         <button onclick="window.switchMaterialTab('warehouses')" class="sci-tab-btn ${currentActiveTab === 'warehouses' ? 'active' : ''}">
            <i class="fa-solid fa-warehouse"></i> SERVİS DEPOLARI
         </button>
         <button onclick="window.switchMaterialTab('defects')" class="sci-tab-btn ${currentActiveTab === 'defects' ? 'active' : ''}">
            <i class="fa-solid fa-triangle-exclamation"></i> ARIZALILAR (DEFECT)
         </button>
         <button onclick="window.switchMaterialTab('audits')" class="sci-tab-btn ${currentActiveTab === 'audits' ? 'active' : ''}">
            <i class="fa-solid fa-clipboard-check"></i> DEPO SAYIMLARI
         </button>
         <button onclick="window.switchMaterialTab('orders')" class="sci-tab-btn ${currentActiveTab === 'orders' ? 'active' : ''}">
            <i class="fa-solid fa-cart-shopping"></i> SİPARİŞ TAKİBİ
         </button>
      </div>

      <!-- Content Panels -->
      <div class="glass-deck-panel">
         <!-- 🏢 Tab 1: Servis Depoları -->
         <div id="warehouses-tab-view" style="${currentActiveTab === 'warehouses' ? '' : 'display: none;'}">
            <h3 style="margin: 0 0 1rem 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-warehouse" style="color: var(--accent-cyan); margin-right: 6px;"></i> FAALİYETTEKİ SERVİS DEPOLARI</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
               ${warehousesGridHtml}
            </div>
         </div>
         
         <!-- ⚠️ Tab 2: Arızalılar (Defect) -->
         <div id="defects-tab-view" style="${currentActiveTab === 'defects' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-triangle-exclamation" style="color: #ff4d4d; margin-right: 6px;"></i> ARIZALI (DEFECT) MALZEMELER</h3>
               <div style="position: relative; width: 320px;" class="no-print">
                  <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.8rem;"></i>
                  <input type="text" id="defect-search" class="sci-input" placeholder="Malzeme, SAP veya MÇF No ile ara..." oninput="window.filterDefectTable()" style="width: 100%; padding: 6px 10px 6px 2.2rem !important; font-size: 0.8rem;">
               </div>
            </div>

            <div style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; background: rgba(0,0,0,0.15); padding: 8px;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th style="width: 130px;">SAP No</th>
                        <th>Malzeme Tanımı</th>
                        <th>Bulunduğu Depo</th>
                        <th style="text-align: center; width: 100px;">Stok Adet</th>
                        <th>Söküldüğü Servis Raporları (MÇF)</th>
                        <th style="text-align: right; width: 150px;">Son Güncelleme</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${defectItems.length === 0 ? `
                        <tr><td colspan="6" style="padding: 3rem; text-align: center; color: rgba(255,255,255,0.3); font-style: italic;">Sistemde kayıtlı arızalı (defect) stok bulunmuyor.</td></tr>
                     ` : defectItems.map((item, idx) => {
                        const whName = dataService.resolveName(item.warehouseId);
                        const lastUpdateDate = item.lastUpdated?.toDate ? item.lastUpdated.toDate().toLocaleDateString('tr-TR') : '-';
                        const relatedReports = defectReportsMap.get(item.sapNo) || [];
                        
                        const reportBadges = relatedReports.length === 0 ? `
                           <span style="color: rgba(255,255,255,0.3); font-size: 0.75rem;">MÇF Eşleşmesi Bulunamadı</span>
                        ` : relatedReports.map(rep => `
                           <div style="display: inline-flex; flex-direction: column; background: rgba(255, 193, 7, 0.05); border: 1px solid rgba(255, 193, 7, 0.2); padding: 3px 6px; border-radius: 6px; margin: 2px; font-size: 0.7rem; color: #ffc107;" title="Tarih: ${rep.date} | Saha: ${rep.siteName} | Ekip: ${rep.team}">
                              <strong>${rep.reportNo}</strong>
                              <span style="font-size: 0.6rem; opacity: 0.75;">${rep.siteName} (${rep.qty} Ad.)</span>
                           </div>
                        `).join(' ');

                        const searchStr = `${item.sapNo} ${item.description} ${whName} ${relatedReports.map(r => r.reportNo + ' ' + r.siteName).join(' ')}`.toLowerCase();

                        return `
                           <tr class="defect-row" data-search="${searchStr}" style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-family: monospace; font-weight: bold; color: var(--accent-cyan); font-size: 0.85rem;">${item.sapNo}</td>
                              <td style="font-weight: bold; color: white;">${item.description}</td>
                              <td style="font-size: 0.8rem; color: rgba(255,255,255,0.7);">${whName}</td>
                              <td style="text-align: center;">
                                 <span style="font-size: 1rem; font-weight: 900; color: #ff4d4d; display: inline-flex; align-items: center; gap: 4px;">
                                    <i class="fa-solid fa-triangle-exclamation" style="font-size: 0.75rem;"></i> ${item.quantity}
                                 </span>
                              </td>
                              <td>
                                 <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                                    ${reportBadges}
                                 </div>
                              </td>
                              <td style="text-align: right; font-size: 0.75rem; color: rgba(255,255,255,0.4); font-family: monospace;">${lastUpdateDate}</td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>
         
         <!-- 📋 Tab 3: Depo Sayımları -->
         <div id="audits-tab-view" style="${currentActiveTab === 'audits' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-clipboard-check" style="color: var(--accent-cyan); margin-right: 6px;"></i> KONSOLİDE DEPO SAYIMLARI</h3>
               <div style="position: relative; width: 320px;" class="no-print">
                  <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.8rem;"></i>
                  <input type="text" id="audit-search" class="sci-input" placeholder="Depo veya sayımı yapan kişi ara..." oninput="window.filterAuditTable()" style="width: 100%; padding: 6px 10px 6px 2.2rem !important; font-size: 0.8rem;">
               </div>
            </div>

            <div>
               ${allAudits.length === 0 ? `
                  <div style="text-align: center; padding: 4rem; color: rgba(255,255,255,0.3); font-style: italic;">
                     <i class="fa-solid fa-clipboard-check" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;"></i>
                     <p>Sistemde henüz yapılmış depo sayımı bulunmuyor.</p>
                  </div>
               ` : allAudits.map((audit, idx) => {
                  const date = audit.timestamp?.seconds ? new Date(audit.timestamp.seconds * 1000).toLocaleString('tr-TR') : (audit.date || '-');
                  const diffColor = audit.totalDiff < 0 ? '#ff4d4d' : (audit.totalDiff > 0 ? '#ff9e00' : '#00ff87');
                  const totalDiffText = audit.totalDiff > 0 ? '+' + audit.totalDiff : audit.totalDiff;
                  const searchStr = `${audit.warehouseName} ${audit.user || ''}`.toLowerCase();
                  
                  const resultsHtml = (audit.results || []).map(r => {
                     const rColor = r.diff < 0 ? '#ff4d4d' : (r.diff > 0 ? '#ff9e00' : '#00ff87');
                     return `
                       <div style="display: flex; justify-content: space-between; padding: 0.5rem; border-bottom: 1px solid rgba(255, 255, 255, 0.02); font-size: 0.8rem; align-items: center;">
                         <span style="color: rgba(255,255,255,0.85); width: 45%; display: flex; align-items: center; gap: 8px;">
                            <span style="background-color: rgba(0, 243, 255, 0.08); color: var(--accent-cyan); padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; font-family: monospace; border: 1px solid rgba(0, 243, 255, 0.15); white-space: nowrap;">SAP: ${r.sapNo || '-'}</span>
                            <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: bold;" title="${r.description}">${r.description}</span>
                         </span>
                         <span style="color: rgba(255,255,255,0.4); width: 15%; text-align: center;">Sistem: ${r.systemQty}</span>
                         <span style="color: rgba(255,255,255,0.4); width: 15%; text-align: center;">Fiziksel: ${r.physicalQty}</span>
                         <span style="color: ${rColor}; font-weight: 800; width: 12%; text-align: center;">Fark: ${r.diff > 0 ? '+'+r.diff : r.diff}</span>
                         <span style="color: rgba(255,255,255,0.3); width: 13%; font-style: italic; text-align: right; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${r.note || 'Uyumlu'}</span>
                       </div>
                     `;
                  }).join('');

                  return `
                    <div class="audit-group-card" data-search="${searchStr}" style="background-color: rgba(10, 15, 30, 0.3); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 10px; margin-bottom: 0.75rem; overflow: hidden;">
                      <div onclick="const content = this.nextElementSibling; const icon = this.querySelector('.fa-chevron-down, .fa-chevron-up'); if(content.style.display === 'none') { content.style.display = 'block'; icon.classList.replace('fa-chevron-down', 'fa-chevron-up'); } else { content.style.display = 'none'; icon.classList.replace('fa-chevron-up', 'fa-chevron-down'); }" style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.1rem; cursor: pointer; background-color: rgba(15, 23, 42, 0.4); border-bottom: 1px solid rgba(255,255,255,0.03); transition: background-color 0.2s;" onmouseover="this.style.backgroundColor='rgba(255,255,255,0.02)'" onmouseout="this.style.backgroundColor='rgba(15, 23, 42, 0.4)'">
                        <div style="display: flex; flex-direction: column; gap: 4px;">
                          <span style="font-weight: 800; color: #FFFFFF; font-size: 0.95rem; letter-spacing: 0.5px;">
                             <i class="fa-solid fa-warehouse" style="color: var(--accent-cyan); margin-right: 6px;"></i> ${audit.warehouseName}
                          </span>
                          <span style="color: rgba(255,255,255,0.4); font-size: 0.75rem; display: flex; align-items: center; gap: 8px;">
                             <span><i class="fa-solid fa-calendar-day" style="margin-right: 4px;"></i> ${date}</span>
                             <span>•</span>
                             <span><i class="fa-solid fa-user" style="margin-right: 4px;"></i> ${audit.user}</span>
                          </span>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1.5rem;">
                          <div style="display: flex; flex-direction: column; text-align: right; gap: 2px; font-family: monospace; font-size: 0.75rem;">
                            <span style="color: rgba(255,255,255,0.5);">Kalem: <strong style="color:white;">${audit.totalItems}</strong></span>
                            <span style="color: rgba(255,255,255,0.5);">Net Fark: <strong style="color:${diffColor};">${totalDiffText}</strong></span>
                          </div>
                          <i class="fa-solid fa-chevron-down" style="color: rgba(255,255,255,0.4); font-size: 0.8rem;"></i>
                        </div>
                      </div>
                      <div style="display: none; padding: 0.5rem 1rem; background-color: rgba(0,0,0,0.15);">
                         <div style="display: flex; justify-content: space-between; padding: 0.4rem 0.5rem; font-size: 0.7rem; color: rgba(255,255,255,0.3); font-weight: 800; border-bottom: 1px solid rgba(255,255,255,0.06); text-transform: uppercase;">
                            <span style="width: 45%;">Malzeme / SAP</span>
                            <span style="width: 15%; text-align: center;">Sistem</span>
                            <span style="width: 15%; text-align: center;">Fiziksel</span>
                            <span style="width: 12%; text-align: center;">Fark</span>
                            <span style="width: 13%; text-align: right;">Açıklama</span>
                         </div>
                         ${resultsHtml}
                      </div>
                    </div>
                  `;
               }).join('')}
            </div>
         </div>

         <!-- 📦 Tab 4: Sipariş Takibi -->
         <div id="orders-tab-view" style="${currentActiveTab === 'orders' ? '' : 'display: none;'}">
            <!-- 📋 Tab 1: Requests View (Talep Değerlendirme) -->
            <div id="requests-view" style="${activeTab === 'requests' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-clipboard-check" style="color: var(--accent-cyan); margin-right: 6px;"></i> GELEN MALZEME TALEPLERİ (TALEP DEĞERLENDİRME)</h3>
               <div style="position: relative; width: 280px;" class="no-print">
                 <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.8rem;"></i>
                 <input type="text" class="sci-input" placeholder="Taleplerde ara..." oninput="window.filterItems(this.value)" style="width: 100%; padding: 6px 10px 6px 2.2rem !important; font-size: 0.8rem;">
               </div>
            </div>

           ${requests.length === 0 ? `
              <div style="text-align: center; padding: 4rem; color: rgba(255,255,255,0.3);">
                 <i class="fa-solid fa-folder-open" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;"></i>
                 <p>Bekleyen onay talebi bulunmuyor.</p>
              </div>
           ` : requests.map(req => {
              const isDirectedToMe = req.targetApprover === currentUserEmail;
              return `
                 <div class="sci-card filter-item" id="card-${req.id}" 
                      style="${isDirectedToMe ? 'border-left-color: var(--accent-cyan);' : 'border-left-color: #ff9e00;'}"
                      data-search="${req.warehouseName} ${req.requester} ${req.requesterName || ''} ${req.items.map(i => i.description + ' ' + i.sapNo).join(' ')}">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
                       <div>
                          <div style="display: flex; align-items: center; gap: 0.75rem;">
                             <h4 style="margin: 0; font-size: 1.1rem; color: white;">${req.warehouseName}</h4>
                             ${getStatusBadge(req.status)}
                          </div>
                          <div style="display: flex; gap: 1rem; margin-top: 4px; font-size: 0.75rem; color: rgba(255,255,255,0.5); align-items: center;">
                             <span style="font-weight: 700; color: #fff;">${req.requesterName || req.requester}</span>
                             <span><i class="fa-solid fa-clock" style="color: var(--accent-cyan); margin-right: 4px;"></i> ${formatTimestamp(req.timestamp)}</span>
                             ${isDirectedToMe ? '<span class="badge" style="background: rgba(0, 243, 255, 0.1); color: var(--accent-cyan); border: 1px solid var(--accent-cyan); font-size: 0.6rem; padding: 1px 4px;">BANA YÖNELİK</span>' : ''}
                          </div>
                          ${req.requesterNote ? `
                             <div style="margin-top: 6px; padding: 6px 10px; background: rgba(255,255,255,0.02); border-radius: 6px; font-size: 0.75rem; border-left: 2px solid var(--accent-cyan);">
                                <strong>GEREKÇE:</strong> ${req.requesterNote}
                             </div>
                          ` : ''}
                       </div>
 
                       <button onclick="window.processDecision('${req.id}')" class="glow-btn no-print" style="padding: 6px 14px; font-size: 0.75rem;">
                          KARARI KAYDET VE ONAYLA
                       </button>
                    </div>
 
                     <div style="background: rgba(0,0,0,0.2); border-radius: 8px; padding: 6px 8px; overflow-x: auto;">
                        <table class="cyber-table">
                           <thead>
                              <tr>
                                 <th style="text-align: left;">Malzeme Tanımı & SAP</th>
                                 <th style="text-align: center;">Mevcut / Kritik Limit</th>
                                 <th style="text-align: center;">Talep Adet</th>
                                 <th>Karar Notu</th>
                                 <th style="text-align: center;" class="no-print">Karar</th>
                              </tr>
                           </thead>
                           <tbody>
                              ${req.items.map((item, idx) => `
                                 <tr data-request-id="${req.id}" data-item-idx="${idx}">
                                    <td>
                                       <div style="font-weight: bold; color: white; font-size: 0.85rem;">${item.description}</div>
                                       <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top: 1px;">${item.sapNo}</div>
                                    </td>
                                    <td style="text-align: center;">
                                       <span style="font-weight: 800; font-size: 0.9rem; color: ${(item.limit && item.limit > 0 && item.currentStock <= item.limit) ? 'var(--danger)' : 'white'}">${item.currentStock}</span>
                                       ${(item.limit && item.limit > 0) ? `<div style="font-size: 0.6rem; opacity: 0.4;">Limit: ${item.limit}</div>` : ''}
                                    </td>
                                    <td style="text-align: center; font-size: 1.05rem; font-weight: 900; color: var(--accent-cyan);">${item.quantity}</td>
                                    <td>
                                       <input type="text" class="sci-input item-note" value="${item.note || ''}" placeholder="Not ekleyin..." style="width: 100%; font-size: 0.75rem; padding: 4px 8px !important;">
                                    </td>
                                    <td class="no-print">
                                       <div style="display: flex; gap: 6px; justify-content: center;">
                                          <button class="sci-action-btn approve ${item.status === 'APPROVED' ? 'active' : ''}" onclick="window.setItemDecision(this, 'APPROVED')"><i class="fa-solid fa-check"></i></button>
                                          <button class="sci-action-btn reject ${item.status === 'REJECTED' ? 'active' : ''}" onclick="window.setItemDecision(this, 'REJECTED')"><i class="fa-solid fa-xmark"></i></button>
                                       </div>
                                    </td>
                                 </tr>
                              `).join('')}
                           </tbody>
                        </table>
                     </div>
                     <textarea id="manager-note-${req.id}" class="sci-input" style="width:100%; height:48px; margin-top: 0.5rem; resize: none; font-size:0.75rem;" placeholder="Talebe ait genel yönetici notu veya bildirim...">${req.managerNote || ''}</textarea>
                 </div>
              `;
           }).join('')}
         </div>

         <!-- 🟨 Sipariş Açılışı (purchase-open) -->
         <div id="purchase-open-view" style="${activeTab === 'purchase-open' ? '' : 'display: none;'}">
            <!-- Styles -->
            <style>
               .pr-split-layout {
                  display: flex;
                  gap: 1.5rem;
                  margin-bottom: 2rem;
               }
               .pr-form-column {
                  flex: 3;
                  min-width: 0;
               }
               .pr-info-column {
                  flex: 2;
                  min-width: 0;
               }
               @media (max-width: 1024px) {
                  .pr-split-layout {
                     flex-direction: column;
                  }
               }
               .form-section-title {
                  font-size: 0.85rem;
                  font-weight: 700;
                  text-transform: uppercase;
                  color: var(--accent-cyan);
                  border-bottom: 1px solid rgba(0, 243, 255, 0.15);
                  padding-bottom: 6px;
                  margin-bottom: 12px;
                  margin-top: 16px;
                  display: flex;
                  align-items: center;
                  gap: 8px;
               }
               .pr-grid-2 {
                  display: grid;
                  grid-template-columns: repeat(2, 1fr);
                  gap: 1rem;
               }
               .pr-grid-3 {
                  display: grid;
                  grid-template-columns: repeat(3, 1fr);
                  gap: 1rem;
               }
               .autocomplete-results {
                  box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 8px 10px -6px rgba(0, 0, 0, 0.7);
               }
               .autocomplete-item:hover {
                  background: rgba(0, 243, 255, 0.1) !important;
               }
            </style>

            <div class="sci-card" style="padding: 5rem 2rem; text-align: center; background: rgba(8, 12, 21, 0.4); border: 1px dashed rgba(0, 243, 255, 0.15); border-radius: 12px; margin-top: 1rem;">
               <i class="fa-solid fa-satellite-dish" style="font-size: 3rem; color: var(--accent-cyan); margin-bottom: 1.5rem; opacity: 0.8; text-shadow: 0 0 15px var(--accent-cyan);"></i>
               <h3 style="color: white; margin: 0; font-size: 1.25rem; font-weight: 700; letter-spacing: 1px;">MALZEME YÖNETİMİ BAŞLATILIYOR</h3>
               <p style="font-size: 0.85rem; color: var(--text-dim); margin: 8px 0 0 0; max-width: 480px; margin-left: auto; margin-right: auto; line-height: 1.6;">
                  Bütün karmaşık ekranları ve tabloları kaldırdık. Şimdi sizinle birlikte adım adım, sıfırdan ve son derece düzenli bir şekilde inşa edeceğiz.
               </p>
            </div>

          </div>

         <!-- 🟨 Sipariş Verilmesi (purchase-ordered) -->
         <div id="purchase-ordered-view" style="${activeTab === 'purchase-ordered' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-paper-plane" style="color: #eab308; margin-right: 6px;"></i> SİPARİŞ VERİLMESİ (ONAYLANAN VE TEKLİFLENDİRİLEN PR TALEPLERİ)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Aşağıda fiyatı ve teklifi girilerek onaylanan sipariş talepleri listelenmektedir. Sipariş formu kesilip tedarikçiye gönderildiğinde 'Sipariş Geçildi' olarak işaretleyiniz.</p>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Onay Tarihi</th>
                        <th>Malzeme / SAP</th>
                        <th>Depo</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>Fiyat / Teklif</th>
                        <th>Onaylayan</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${purchaseRequests.filter(r => r.status === 'APPROVED').length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Siparişi verilecek onaylanmış talep bulunmuyor.</td></tr>
                     ` : purchaseRequests.filter(r => r.status === 'APPROVED').map(req => {
                        const reqDate = req.approvedAt?.toDate ? req.approvedAt.toDate() : (req.approvedAt ? new Date(req.approvedAt) : null);
                        const dateStr = reqDate ? reqDate.toLocaleDateString('tr-TR') : '-';
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${req.description}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top:1px;">${req.sapNo}</div>
                              </td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${req.warehouseName}</td>
                              <td style="text-align: center; font-size: 0.9rem; font-weight: bold; color: var(--accent-cyan);">${req.requestedQty} Adet</td>
                              <td style="font-weight: 700; color: #22c55e;">${req.estimatedCost} ${req.currency || 'TRY'}</td>
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.5);">${req.approvedBy?.split('@')[0] || ''}</td>
                              <td style="text-align: right;">
                                 <button onclick="window.markPRAsOrdered('${req.id}')" class="glow-btn" style="background: rgba(56,189,248,0.15); border-color: #38bdf8; padding: 6px 14px; font-size: 0.75rem;">SİPARİŞİ GEÇİLDİ (YOLA ÇIKAR)</button>
                              </td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 İrsaliye / Delivery ile Giriş (purchase-delivery) -->
         <div id="purchase-delivery-view" style="${activeTab === 'purchase-delivery' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-truck" style="color: #eab308; margin-right: 6px;"></i> İRSALİYE / DELIVERY İLE GİRİŞ (YOLDAKİ SİPARİŞLER)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Siparişi tedarikçiye geçilmiş ve kargoya verilmiş malzemeler. Malzeme sevk irsaliyesi ile kapıya ulaştığında, teslim alma tutanağı / İrsaliye No girerek girişi başlatın.</p>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Sipariş Tarihi</th>
                        <th>Malzeme / SAP</th>
                        <th>Hedef Depo</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>Fiyat / Değer</th>
                        <th>İrsaliye / Delivery No</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${purchaseRequests.filter(r => r.status === 'ORDERED').length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Yolda / teslimat aşamasında olan sipariş bulunmuyor.</td></tr>
                     ` : purchaseRequests.filter(r => r.status === 'ORDERED').map(req => {
                        const reqDate = req.orderedAt?.toDate ? req.orderedAt.toDate() : (req.requestedAt ? new Date(req.requestedAt) : null);
                        const dateStr = reqDate ? reqDate.toLocaleDateString('tr-TR') : '-';
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${req.description}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top:1px;">${req.sapNo}</div>
                              </td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${req.warehouseName}</td>
                              <td style="text-align: center; font-size: 0.9rem; font-weight: bold; color: var(--accent-cyan);">${req.requestedQty} Adet</td>
                              <td style="font-weight: 600; color: rgba(255,255,255,0.6);">${req.estimatedCost} ${req.currency || 'TRY'}</td>
                              <td>
                                 <input type="text" id="pr-delivery-note-${req.id}" class="sci-input" placeholder="İrsaliye No girin..." style="width: 140px; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                              </td>
                              <td style="text-align: right;">
                                 <button onclick="window.markPRAsDeliveredAction('${req.id}')" class="glow-btn" style="background: rgba(0,243,255,0.15); border-color: var(--accent-cyan); padding: 6px 14px; font-size: 0.75rem;">İRSALİYE GİRİŞİ YAP</button>
                              </td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Fatura Girişi (purchase-invoice) -->
         <div id="purchase-invoice-view" style="${activeTab === 'purchase-invoice' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-file-invoice-dollar" style="color: #eab308; margin-right: 6px;"></i> MALZEME FATURA GİRİŞİ (TESLİMATI YAPILMIŞ FATURA BEKLEYENLER)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Depoya fiilen teslim edilmiş (İrsaliyesi girilmiş) ancak faturası henüz işlenmemiş siparişler. Fatura geldiğinde fatura numarasını bağlayarak süreci ilerletin.</p>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Teslim Tarihi</th>
                        <th>Malzeme / SAP</th>
                        <th>Depo</th>
                        <th>Miktar</th>
                        <th>İrsaliye No</th>
                        <th>Fatura Numarası</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${purchaseRequests.filter(r => r.status === 'DELIVERED').length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Fatura girişi bekleyen teslim edilmiş sipariş bulunmuyor.</td></tr>
                     ` : purchaseRequests.filter(r => r.status === 'DELIVERED').map(req => {
                        const reqDate = req.deliveredAt?.toDate ? req.deliveredAt.toDate() : (req.requestedAt ? new Date(req.requestedAt) : null);
                        const dateStr = reqDate ? reqDate.toLocaleDateString('tr-TR') : '-';
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${req.description}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top:1px;">${req.sapNo}</div>
                              </td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${req.warehouseName}</td>
                              <td style="font-size: 0.9rem; font-weight: bold; color: var(--accent-cyan);">${req.requestedQty} Adet</td>
                              <td style="font-family: monospace; font-size: 0.75rem; color: #ff9e00;">${req.deliveryNoteNo || '-'}</td>
                              <td>
                                 <input type="text" id="pr-invoice-num-${req.id}" class="sci-input" placeholder="Fatura No girin..." style="width: 140px; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                              </td>
                              <td style="text-align: right;">
                                 <button onclick="window.markPRAsInvoicedAction('${req.id}')" class="glow-btn" style="background: rgba(168,85,247,0.15); border-color: #a855f7; padding: 6px 14px; font-size: 0.75rem;">FATURAYI KAYDET</button>
                              </td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Stok Girişi (purchase-stock) -->
         <div id="purchase-stock-view" style="${activeTab === 'purchase-stock' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-boxes-stacked" style="color: #eab308; margin-right: 6px;"></i> STOK GİRİŞİ (STOKA İŞLENMEYİ BEKLEYEN TAMAMLANMIŞ SİPARİŞLER)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Faturası ve irsaliyesi işlenmiş malzemeler. 'Stoka Giriş Yap' butonuna tıkladığınızda malzemeler ilgili deponun envanter miktarına otomatik olarak eklenecek ve işlem tamamlanacaktır.</p>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Fatura Tarihi</th>
                        <th>Malzeme / SAP</th>
                        <th>Hedef Depo</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>İrsaliye / Fatura No</th>
                        <th>Fiyat / Değer</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${purchaseRequests.filter(r => r.status === 'INVOICED').length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Stoka eklenmeyi bekleyen faturalandırılmış sipariş bulunmuyor.</td></tr>
                     ` : purchaseRequests.filter(r => r.status === 'INVOICED').map(req => {
                        const reqDate = req.invoicedAt?.toDate ? req.invoicedAt.toDate() : (req.requestedAt ? new Date(req.requestedAt) : null);
                        const dateStr = reqDate ? reqDate.toLocaleDateString('tr-TR') : '-';
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${req.description}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top:1px;">${req.sapNo}</div>
                              </td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${req.warehouseName}</td>
                              <td style="text-align: center; font-size: 0.9rem; font-weight: bold; color: var(--accent-cyan);">${req.requestedQty} Adet</td>
                              <td>
                                 <div style="font-size:0.75rem; color:rgba(255,255,255,0.6);">İrs: <span style="color:#ff9e00;">${req.deliveryNoteNo || '-'}</span></div>
                                 <div style="font-size:0.75rem; color:rgba(255,255,255,0.6);">Fat: <span style="color:#00ff87;">${req.invoiceNo || '-'}</span></div>
                              </td>
                              <td style="font-weight: 600; color: #22c55e;">${req.estimatedCost} ${req.currency || 'TRY'}</td>
                              <td style="text-align: right;">
                                 <button onclick="window.completePRStockEntryAction('${req.id}')" class="glow-btn" style="background: rgba(40,167,69,0.2); border-color: #28a745; padding: 6px 14px; font-size: 0.75rem;">STOKA KABUL ET</button>
                              </td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🚚 Tab 2a: Depodan Malzeme Çıkışı (transfers-out) -->
         <div id="transfers-out-view" style="${activeTab === 'transfers-out' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-arrow-right-from-bracket" style="color: #ff9e00; margin-right: 6px;"></i> GÖNDEREN DEPODAN MALZEME ÇIKIŞI (MSF İLE)</h3>
               <button onclick="window.navigate('transfers')" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-truck-moving"></i> YENİ TRANSFER BAŞLAT (MSF)
               </button>
            </div>

            ${transfers.filter(t => t.fromSiteId && t.status === 'PENDING').length === 0 ? `
              <div style="text-align: center; padding: 3rem; color: rgba(255,255,255,0.3);">
                <i class="fa-solid fa-truck-moving" style="font-size: 2.5rem; opacity: 0.2; margin-bottom: 0.75rem;"></i>
                <p>Onay bekleyen çıkış / sevk talebi bulunmuyor.</p>
              </div>
            ` : transfers.filter(t => t.status === 'PENDING').map(t => {
                const tType = t.type || 'SEVK';
                const typeMapping: Record<string, { label: string, color: string }> = {
                  'SEVK': { label: 'SEVK', color: '#38bdf8' },
                  'GERI_ODE': { label: 'GERİ ÖDE', color: '#fbbf24' },
                  'SATIS': { label: 'SATIŞ YAP', color: '#34d399' },
                  'HIBE': { label: 'HİBE ET', color: '#c084fc' }
                };
                const typeInfo = typeMapping[tType] || { label: 'SEVK', color: '#38bdf8' };
                return `
                <div class="sci-card" style="border-left-color: #ff7e00; display: grid; grid-template-columns: 2fr 1fr 1.2fr 0.4fr 1.2fr 0.8fr 1.4fr; align-items: center; gap: 0.5rem; padding: 0.4rem 0.85rem;">
                   <div>
                     <div style="font-weight: 800; color: white; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.materialName}">${t.materialName}</div>
                     <div style="font-size: 0.65rem; color: var(--accent-cyan); font-family: monospace;">${t.materialCode}</div>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 2px;">SEVK TÜRÜ</div>
                     <span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: ${typeInfo.color}15; color: ${typeInfo.color}; border: 1px solid ${typeInfo.color}30; font-weight: bold;">
                       ${typeInfo.label}
                     </span>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">ÇIKIŞ DEPOSU</div>
                     <div style="font-weight: 700; color: var(--danger); font-size: 0.75rem; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${dataService.resolveName(t.fromSiteId)}">${dataService.resolveName(t.fromSiteId)}</div>
                   </div>
                   <div style="text-align: center; font-size: 0.8rem; opacity: 0.3;">
                     <i class="fa-solid fa-angles-right"></i>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">VARAL DEPOSU</div>
                     <div style="font-weight: 700; color: #00ff87; font-size: 0.75rem; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${dataService.resolveName(t.toSiteId)}">${dataService.resolveName(t.toSiteId)}</div>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">MİKTAR</div>
                     <div style="font-size: 0.95rem; font-weight: 900; color: var(--accent-cyan); margin-top: 1px;">${t.quantity}</div>
                   </div>
                   <div style="display: flex; gap: 6px; justify-content: flex-end;">
                      <button onclick="window.handleTransferApproval('${t.id}', true)" class="glow-btn" style="background: rgba(40,167,69,0.15); border-color: #28a745; padding: 4px 10px; font-size: 0.65rem;">ONAYLA</button>
                      <button onclick="window.handleTransferApproval('${t.id}', false)" class="glow-btn" style="background: rgba(220,53,69,0.15); border-color: #dc3545; padding: 4px 10px; font-size: 0.65rem;">REDDET</button>
                   </div>
                </div>
                `;
              }).join('')}
         </div>

         <!-- 🚚 Tab 2b: Depoya Malzeme Girişi (transfers-in) -->
         <div id="transfers-in-view" style="${activeTab === 'transfers-in' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-arrow-right-to-bracket" style="color: #00ff87; margin-right: 6px;"></i> GÖNDERİLEN DEPOYA MALZEME GİRİŞİ (MSF İLE)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Diğer santral veya depolardan sevk edilip onaylanmış ve depoya kabulü yapılmış geçmiş malzeme sevk fişleri (MSF) listesi.</p>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 0.5rem 0.75rem;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Malzeme</th>
                        <th style="text-align: center;">Sevk Türü</th>
                        <th style="text-align: center;">Miktar</th>
                        <th style="text-align: center;">Güzergah (MSF Akışı)</th>
                        <th>Onaylayan</th>
                        <th style="text-align: right;">Durum</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${transfers.filter(t => t.status !== 'PENDING').slice(0, 20).map(t => {
                        const tType = t.type || 'SEVK';
                        const typeMapping: Record<string, { label: string, color: string }> = {
                          'SEVK': { label: 'SEVK', color: '#38bdf8' },
                          'GERI_ODE': { label: 'GERİ ÖDE', color: '#fbbf24' },
                          'SATIS': { label: 'SATIŞ YAP', color: '#34d399' },
                          'HIBE': { label: 'HİBE ET', color: '#c084fc' }
                        };
                        const typeInfo = typeMapping[tType] || { label: 'SEVK', color: '#38bdf8' };
                        return `
                        <tr>
                           <td>
                              <div style="font-weight: 600; color: white; font-size: 0.85rem;">${t.materialName}</div>
                              <div style="font-size: 0.65rem; color: rgba(255,255,255,0.3); font-family: monospace;">${t.materialCode}</div>
                           </td>
                           <td style="text-align: center;">
                              <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; background: ${typeInfo.color}15; color: ${typeInfo.color}; border: 1px solid ${typeInfo.color}30; font-weight: bold;">
                                ${typeInfo.label}
                              </span>
                           </td>
                           <td style="text-align: center; font-weight: bold; color: var(--accent-cyan); font-size: 0.85rem;">${t.quantity}</td>
                           <td style="text-align: center; font-size: 0.75rem; color: rgba(255,255,255,0.6);">
                              ${dataService.resolveName(t.fromSiteId)} <i class="fa-solid fa-arrow-right" style="font-size:0.6rem; opacity:0.5; margin: 0 4px;"></i> ${dataService.resolveName(t.toSiteId)}
                           </td>
                           <td style="font-size:0.75rem; color:rgba(255,255,255,0.5);">${t.approvedBy?.split('@')[0] || ''}</td>
                           <td style="text-align: right;">
                              <span style="font-size: 0.65rem; padding: 2px 8px; border-radius: 4px; background: ${t.status === 'COMPLETED' ? 'rgba(40,167,69,0.1)' : 'rgba(220,53,69,0.1)'}; color: ${t.status === 'COMPLETED' ? '#28a745' : '#dc3545'}; border: 1px solid ${t.status === 'COMPLETED' ? 'rgba(40,167,69,0.2)' : 'rgba(220,53,69,0.2)'};">
                                ${t.status === 'COMPLETED' ? 'TAMAMLANDI' : 'REDDEDİLDİ'}
                              </span>
                           </td>
                        </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 📦 Malzeme Girişi Aşamaları: irsaliye/fatura ile giriş (entry-invoice) -->
         <div id="entry-invoice-view" style="${activeTab === 'entry-invoice' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-file-invoice" style="color: #eab308; margin-right: 6px;"></i> İRSALİYE / FATURA İLE GİRİŞ (HIZLI STOK GİRİŞ PANELİ)</h3>
               <button onclick="document.getElementById('manual-invoice-entry-form').style.display = document.getElementById('manual-invoice-entry-form').style.display === 'none' ? 'block' : 'none';" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i> FATURALI/İRSALİYELİ DOĞRUDAN GİRİŞ YAP
               </button>
            </div>

            <!-- Manual Invoice Entry Form -->
            <div id="manual-invoice-entry-form" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,243,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
               <h4 style="margin: 0 0 0.75rem 0; color: var(--accent-cyan); font-size: 0.95rem;">DOĞRUDAN FATURALI/İRSALİYELİ MALZEME GİRİŞİ</h4>
               <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SAP NO</label>
                     <input type="text" id="manual-ent-sap" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="SAP Kodu...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">MALZEME TANIMI</label>
                     <input type="text" id="manual-ent-desc" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Açıklama...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">GİRİŞ ADEDİ</label>
                     <input type="number" id="manual-ent-qty" class="sci-input" style="width:100%; font-size: 0.8rem;" value="1">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">RAF NUMARASI</label>
                     <input type="text" id="manual-ent-shelf" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Raf No (örn: A-12)...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">İRSALİYE NO</label>
                     <input type="text" id="manual-ent-deliv" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="İrsaliye No...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">FATURA NO</label>
                     <input type="text" id="manual-ent-inv" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Fatura No...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">BİRİM FİYAT</label>
                     <input type="number" id="manual-ent-price" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Birim Fiyat...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">PARA BİRİMİ</label>
                     <select id="manual-ent-curr" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        <option value="TRY">TRY ₺</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                     </select>
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">HEDEF DEPO</label>
                     <select id="manual-ent-wh" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        ${warehouses.map((w: any) => `<option value="${w.id}">${w.name}</option>`).join('')}
                     </select>
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">MALZEME KONDİSYONU</label>
                     <select id="manual-ent-cond" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        <option value="NEW">YENİ (SIFIR)</option>
                        <option value="REVISED">REVİZYONLU</option>
                        <option value="DEFECT">ARIZALI</option>
                     </select>
                  </div>
               </div>
               <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button onclick="window.saveManualEntryInvoice()" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">STOKA VE ENVANTERE İŞLE</button>
                  <button onclick="document.getElementById('manual-invoice-entry-form').style.display = 'none';" class="glow-btn" style="background:transparent; border-color:transparent; padding: 6px 14px; font-size: 0.75rem;">İPTAL</button>
               </div>
            </div>

            <!-- List of Completed Purchase Deliveries -->
            <h4 style="margin: 1.5rem 0 0.5rem 0; color: rgba(255,255,255,0.4); font-size: 0.8rem; letter-spacing: 2px;">SON FATURALANDIRILMIŞ VE STOKA GİREN SİPARİŞLER</h4>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Tarih</th>
                        <th>Malzeme / SAP</th>
                        <th>Hedef Depo</th>
                        <th>Miktar</th>
                        <th>İrsaliye / Fatura No</th>
                        <th>Birim Fiyat</th>
                        <th style="text-align: right;">Durum</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${purchaseRequests.filter(r => r.status === 'COMPLETED').length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">İrsaliyeli/faturalı kaydedilmiş geçmiş işlem bulunmuyor.</td></tr>
                     ` : purchaseRequests.filter(r => r.status === 'COMPLETED').map(req => {
                        const reqDate = req.completedAt?.toDate ? req.completedAt.toDate() : (req.requestedAt ? new Date(req.requestedAt) : null);
                        const dateStr = reqDate ? reqDate.toLocaleDateString('tr-TR') : '-';
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${req.description}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace; margin-top:1px;">${req.sapNo}</div>
                              </td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${req.warehouseName}</td>
                              <td style="font-size: 0.9rem; font-weight: bold; color: var(--accent-cyan);">${req.requestedQty} Adet</td>
                              <td>
                                 <div style="font-size: 0.75rem;">İrs No: <span style="color:#ff9e00;">${req.deliveryNoteNo || '-'}</span></div>
                                 <div style="font-size: 0.75rem;">Fat No: <span style="color:#00ff87;">${req.invoiceNo || '-'}</span></div>
                              </td>
                              <td style="font-weight: bold; color: #22c55e;">${req.estimatedCost} ${req.currency || 'TRY'}</td>
                              <td style="text-align: right; color:#00ff87; font-weight:bold; font-size:0.75rem;"><i class="fa-solid fa-circle-check"></i> DEPO GİRİŞİ YAPILDI</td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 📦 Malzeme Girişi Aşamaları: diğer santrallerden sevk (entry-transfer) -->
         <div id="entry-transfer-view" style="${activeTab === 'entry-transfer' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-truck-ramp-box" style="color: #eab308; margin-right: 6px;"></i> DİĞER SANTRALLERDEN SEVK (GELEN TRANSFER KABULLERİ)</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Diğer rüzgar enerji santrallerinden / depolarından bizim depolarımıza sevk edilmiş yoldaki veya onay bekleyen transfer talepleri.</p>
            </div>

            ${transfers.filter(t => t.status === 'PENDING').length === 0 ? `
              <div style="text-align: center; padding: 3rem; color: rgba(255,255,255,0.3);">
                <i class="fa-solid fa-truck-moving" style="font-size: 2.5rem; opacity: 0.2; margin-bottom: 0.75rem;"></i>
                <p>Deponuza doğru gelen veya onay bekleyen herhangi bir transfer gönderimi bulunmuyor.</p>
              </div>
            ` : transfers.filter(t => t.status === 'PENDING').map(t => {
                const tType = t.type || 'SEVK';
                const typeMapping: Record<string, { label: string, color: string }> = {
                  'SEVK': { label: 'SEVK', color: '#38bdf8' },
                  'GERI_ODE': { label: 'GERİ ÖDE', color: '#fbbf24' },
                  'SATIS': { label: 'SATIŞ YAP', color: '#34d399' },
                  'HIBE': { label: 'HİBE ET', color: '#c084fc' }
                };
                const typeInfo = typeMapping[tType] || { label: 'SEVK', color: '#38bdf8' };
                return `
                <div class="sci-card" style="border-left-color: #00ff87; display: grid; grid-template-columns: 2fr 1fr 1.2fr 0.4fr 1.2fr 0.8fr 1.4fr; align-items: center; gap: 0.5rem; padding: 0.4rem 0.85rem;">
                   <div>
                     <div style="font-weight: 800; color: white; font-size: 0.85rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${t.materialName}">${t.materialName}</div>
                     <div style="font-size: 0.65rem; color: var(--accent-cyan); font-family: monospace;">${t.materialCode}</div>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase; margin-bottom: 2px;">SEVK TÜRÜ</div>
                     <span style="font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; background: ${typeInfo.color}15; color: ${typeInfo.color}; border: 1px solid ${typeInfo.color}30; font-weight: bold;">
                       ${typeInfo.label}
                     </span>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">GÖNDEREN DEPO</div>
                     <div style="font-weight: 700; color: var(--danger); font-size: 0.75rem; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${dataService.resolveName(t.fromSiteId)}">${dataService.resolveName(t.fromSiteId)}</div>
                   </div>
                   <div style="text-align: center; font-size: 0.8rem; opacity: 0.3;">
                     <i class="fa-solid fa-arrow-right"></i>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">ALICI DEPO (BİZ)</div>
                     <div style="font-weight: 700; color: #00ff87; font-size: 0.75rem; margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${dataService.resolveName(t.toSiteId)}">${dataService.resolveName(t.toSiteId)}</div>
                   </div>
                   <div style="text-align: center;">
                     <div style="font-size: 0.55rem; color: rgba(255,255,255,0.4); text-transform: uppercase;">MİKTAR</div>
                     <div style="font-size: 0.95rem; font-weight: 900; color: var(--accent-cyan); margin-top: 1px;">${t.quantity}</div>
                   </div>
                   <div style="display: flex; gap: 6px; justify-content: flex-end;">
                      <button onclick="window.handleTransferApproval('${t.id}', true)" class="glow-btn" style="background: rgba(40,167,69,0.15); border-color: #28a745; padding: 4px 10px; font-size: 0.65rem;">KABUL ET (STOKA AL)</button>
                      <button onclick="window.handleTransferApproval('${t.id}', false)" class="glow-btn" style="background: rgba(220,53,69,0.15); border-color: #dc3545; padding: 4px 10px; font-size: 0.65rem;">REDDET</button>
                   </div>
                </div>
                `;
              }).join('')}
         </div>

         <!-- 📦 Malzeme Girişi Aşamaları: diğer santrallerden satış (entry-sale) -->
         <div id="entry-sale-view" style="${activeTab === 'entry-sale' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-handshake" style="color: #eab308; margin-right: 6px;"></i> DİĞER SANTRALLERE SATIŞ GİRİŞİ</h3>
               <button onclick="document.getElementById('manual-sale-entry-form').style.display = document.getElementById('manual-sale-entry-form').style.display === 'none' ? 'block' : 'none';" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i> SATIŞ GİRİŞİ YAP
               </button>
            </div>

            <!-- Manual Sale Form -->
            <div id="manual-sale-entry-form" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,243,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
               <h4 style="margin: 0 0 0.75rem 0; color: var(--accent-cyan); font-size: 0.95rem;">YENİ SATIŞ KAYDI OLUŞTUR (STOKTAN DÜŞÜLÜR)</h4>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SAP NO</label>
                     <input type="text" id="sale-ent-sap" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="SAP Kodu...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">MİKTAR (ADET)</label>
                     <input type="number" id="sale-ent-qty" class="sci-input" style="width:100%; font-size: 0.8rem;" value="1">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SATIŞ YAPILAN DEPO / ALICI</label>
                     <input type="text" id="sale-ent-buyer" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Alıcı Firma veya Santral Adı...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">ÇIKIŞ YAPILACAK DEPOMUZ</label>
                     <select id="sale-ent-wh" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        ${warehouses.map((w: any) => `<option value="${w.id}">${w.name}</option>`).join('')}
                     </select>
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SATIŞ BEDELİ</label>
                     <input type="number" id="sale-ent-price" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Fiyat...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">PARA BİRİMİ</label>
                     <select id="sale-ent-curr" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        <option value="TRY">TRY ₺</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                     </select>
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">FATURA NO / NOTLAR</label>
                     <input type="text" id="sale-ent-note" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Fatura numarası ve satış açıklamaları...">
                  </div>
               </div>
               <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button onclick="window.saveManualEntrySale()" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">SATIŞI ONAYLA VE STOKTAN DÜŞ</button>
                  <button onclick="document.getElementById('manual-sale-entry-form').style.display = 'none';" class="glow-btn" style="background:transparent; border-color:transparent; padding: 6px 14px; font-size: 0.75rem;">İPTAL</button>
               </div>
            </div>

            <!-- List of Sales -->
            <h4 style="margin: 1.5rem 0 0.5rem 0; color: rgba(255,255,255,0.4); font-size: 0.8rem; letter-spacing: 2px;">YAKIN ZAMANDAKİ DIŞ SATIŞ KAYITLARI</h4>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Tarih</th>
                        <th>Çıkış Deposu</th>
                        <th>Malzeme (SAP)</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>Alıcı / Firma</th>
                        <th>Birim Fiyatı</th>
                        <th style="text-align: right;">Fatura / Referans</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${salesLogs.length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Kayıtlı dış satış bulunmuyor.</td></tr>
                     ` : salesLogs.map(log => {
                        const dateStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('tr-TR') : (log.timestamp ? new Date(log.timestamp).toLocaleDateString('tr-TR') : '-');
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td style="font-size:0.8rem;">${dataService.resolveName(log.warehouseId) || log.warehouseId}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${log.description || ''}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace;">${log.sapNo}</div>
                              </td>
                              <td style="text-align: center; font-weight: bold; color: var(--accent-cyan);">${log.quantity} Adet</td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${log.buyer}</td>
                              <td style="font-weight: bold; color: #ff9e00;">${log.price} ${log.currency || 'TRY'}</td>
                              <td style="text-align: right; font-size:0.75rem; color:rgba(255,255,255,0.5);">${log.notes || '-'}</td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 📦 Malzeme Girişi Aşamaları: tamirli malzeme formları (entry-repair) -->
         <div id="entry-repair-view" style="${activeTab === 'entry-repair' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-screwdriver-wrench" style="color: #eab308; margin-right: 6px;"></i> TAMİRLİ MALZEME FORMLARI (ATÖLYE DÖNÜŞÜ GİRİŞ)</h3>
               <button onclick="document.getElementById('manual-repair-entry-form').style.display = document.getElementById('manual-repair-entry-form').style.display === 'none' ? 'block' : 'none';" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i> TAMİRLİ MALZEME KABUL ET
               </button>
            </div>

            <!-- Manual Repair Form -->
            <div id="manual-repair-entry-form" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,243,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
               <h4 style="margin: 0 0 0.75rem 0; color: var(--accent-cyan); font-size: 0.95rem;">TAMİRDEN DÖNEN YEDEK PARÇAYI KABUL ET</h4>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SAP NO</label>
                     <input type="text" id="repair-ent-sap" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="SAP Kodu...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">KABUL MİKTARI</label>
                     <input type="number" id="repair-ent-qty" class="sci-input" style="width:100%; font-size: 0.8rem;" value="1">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">HEDEF RAF NO</label>
                     <input type="text" id="repair-ent-shelf" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Raf Numarası...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">STOKA ALINACAK DEPOMUZ</label>
                     <select id="repair-ent-wh" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        ${warehouses.map((w: any) => `<option value="${w.id}">${w.name}</option>`).join('')}
                     </select>
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">TAMİRATÇI FİRMA / ATÖLYE</label>
                     <input type="text" id="repair-ent-company" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Atölye veya firma adı...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">REVİZYON KODU / RAPOR NO</label>
                     <input type="text" id="repair-ent-report" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Tamir Rapor No...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">YAPILAN İŞLEM / TAMİR DETAYI</label>
                     <input type="text" id="repair-ent-notes" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Yapılan revizyon detayları...">
                  </div>
               </div>
               <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button onclick="window.saveManualEntryRepair()" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">REVİZYONLU OLARAK STOKA EKLE</button>
                  <button onclick="document.getElementById('manual-repair-entry-form').style.display = 'none';" class="glow-btn" style="background:transparent; border-color:transparent; padding: 6px 14px; font-size: 0.75rem;">İPTAL</button>
               </div>
            </div>

            <!-- List of Repairs -->
            <h4 style="margin: 1.5rem 0 0.5rem 0; color: rgba(255,255,255,0.4); font-size: 0.8rem; letter-spacing: 2px;">TAMİRDEN DÖNEN REVİZYONLU PARÇA ENVANTER GEÇMİŞİ</h4>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Tarih</th>
                        <th>Depo</th>
                        <th>Malzeme / SAP</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>Tamir Atölyesi</th>
                        <th>Revizyon Rapor No</th>
                        <th style="text-align: right;">Açıklama</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${repairLogs.length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Kayıtlı tamirli malzeme dönüşü bulunmuyor.</td></tr>
                     ` : repairLogs.map(log => {
                        const dateStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('tr-TR') : (log.timestamp ? new Date(log.timestamp).toLocaleDateString('tr-TR') : '-');
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td style="font-size:0.8rem;">${dataService.resolveName(log.warehouseId) || log.warehouseId}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${log.description || ''}</div>
                                 <div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace;">${log.sapNo}</div>
                              </td>
                              <td style="text-align: center; font-weight: bold; color: var(--accent-cyan);">${log.quantity} Adet</td>
                              <td style="font-size:0.8rem;">${log.repairCompany}</td>
                              <td style="font-family: monospace; font-size:0.75rem; color: var(--accent-cyan);">${log.repairReportNo || '-'}</td>
                              <td style="text-align: right; font-size:0.75rem; color:rgba(255,255,255,0.5);">${log.notes || '-'}</td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 📦 Malzeme Girişi Aşamaları: stoksuz (entry-nonstock) -->
         <div id="entry-nonstock-view" style="${activeTab === 'entry-nonstock' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-circle-minus" style="color: #eab308; margin-right: 6px;"></i> STOKSUZ MALZEME VE HİZMET GİRİŞİ</h3>
               <button onclick="document.getElementById('manual-nonstock-entry-form').style.display = document.getElementById('manual-nonstock-entry-form').style.display === 'none' ? 'block' : 'none';" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-plus"></i> STOKSUZ GİRİŞ KAYDET
               </button>
            </div>

            <!-- Manual Nonstock Form -->
            <div id="manual-nonstock-entry-form" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,243,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
               <h4 style="margin: 0 0 0.75rem 0; color: var(--accent-cyan); font-size: 0.95rem;">DOĞRUDAN TÜKETİM/STOKSUZ KALEM GİRİŞİ</h4>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">KALEM/HİZMET TANIMI</label>
                     <input type="text" id="nonstock-ent-desc" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Hizmet veya ürün adı...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">MİKTAR / BİRİM</label>
                     <input type="text" id="nonstock-ent-qty" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Örn: 1 Adet, 2 Adam-Gün...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SAP NO (OPSİYONEL)</label>
                     <input type="text" id="nonstock-ent-sap" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Varsa SAP...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">KULLANILAN DEPO / SAHA</label>
                     <select id="nonstock-ent-wh" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        ${warehouses.map((w: any) => `<option value="${w.id}">${w.name}</option>`).join('')}
                     </select>
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">HARCAMA BEDELİ</label>
                     <input type="number" id="nonstock-ent-price" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Fiyat...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">PARA BİRİMİ</label>
                     <select id="nonstock-ent-curr" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        <option value="TRY">TRY ₺</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                     </select>
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">TEDARİKÇİ FİRMA</label>
                     <input type="text" id="nonstock-ent-supplier" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Tedarikçi firma adı...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">FATURA REFERANSI / NOTLAR</label>
                     <input type="text" id="nonstock-ent-note" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Açıklamalar ve fatura no...">
                  </div>
               </div>
               <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button onclick="window.saveManualEntryNonStock()" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">DOĞRUDAN GİDER/TÜKETİM OLARAK KAYDET</button>
                  <button onclick="document.getElementById('manual-nonstock-entry-form').style.display = 'none';" class="glow-btn" style="background:transparent; border-color:transparent; padding: 6px 14px; font-size: 0.75rem;">İPTAL</button>
               </div>
            </div>

            <!-- List of Nonstocks -->
            <h4 style="margin: 1.5rem 0 0.5rem 0; color: rgba(255,255,255,0.4); font-size: 0.8rem; letter-spacing: 2px;">GEÇMİŞ STOKSUZ KALEM / DOĞRUDAN TÜKETİM KAYITLARI</h4>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Tarih</th>
                        <th>Saha / Tüketim Yeri</th>
                        <th>Kalem Açıklaması</th>
                        <th style="text-align: center;">Miktar</th>
                        <th>Tedarikçi</th>
                        <th>Harcanan Bedel</th>
                        <th style="text-align: right;">Referans / Fatura</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${nonstockLogs.length === 0 ? `
                        <tr><td colspan="7" style="padding:2.5rem; text-align:center; color:rgba(255,255,255,0.3);">Kayıtlı doğrudan gider/tüketim bulunmuyor.</td></tr>
                     ` : nonstockLogs.map(log => {
                        const dateStr = log.timestamp?.toDate ? log.timestamp.toDate().toLocaleDateString('tr-TR') : (log.timestamp ? new Date(log.timestamp).toLocaleDateString('tr-TR') : '-');
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.4);">${dateStr}</td>
                              <td style="font-size:0.8rem;">${dataService.resolveName(log.warehouseId) || log.warehouseId}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.85rem;">${log.description}</div>
                                 ${log.sapNo ? `<div style="font-size: 0.7rem; color: var(--accent-cyan); font-family: monospace;">${log.sapNo}</div>` : ''}
                              </td>
                              <td style="text-align: center; font-weight: bold; color: var(--accent-cyan);">${log.quantity}</td>
                              <td style="font-size:0.8rem; color:rgba(255,255,255,0.6);">${log.supplier || '-'}</td>
                              <td style="font-weight: bold; color: #ff4d4d;">${log.price} ${log.currency || 'TRY'}</td>
                              <td style="text-align: right; font-size:0.75rem; color:rgba(255,255,255,0.5);">${log.notes || '-'}</td>
                           </tr>
                        `;
                     }).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı Oluşturulması: SAP No Ara / Tanımla (research-search) -->
         <div id="research-search-view" style="${activeTab === 'research-search' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-barcode" style="color: #eab308; margin-right: 6px;"></i> SAP NO ARA / TANIMLA (MALZEME KARTI YÖNETİMİ)</h3>
               <button onclick="document.getElementById('manual-card-creator-form').style.display = document.getElementById('manual-card-creator-form').style.display === 'none' ? 'block' : 'none';" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">
                  <i class="fa-solid fa-square-plus"></i> YENİ MALZEME KARTI OLUŞTUR
               </button>
            </div>

            <!-- Manual Card Creator Form -->
            <div id="manual-card-creator-form" style="display: none; background: rgba(0,0,0,0.3); border: 1px solid rgba(0,243,255,0.15); border-radius: 12px; padding: 1rem; margin-bottom: 1rem;">
               <h4 style="margin: 0 0 0.75rem 0; color: var(--accent-cyan); font-size: 0.95rem;">YENİ ENVENTER KARTI / SAP KODU TANIMLA</h4>
               <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">SAP NO</label>
                     <input type="text" id="card-ent-sap" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="SAP Kodu (örn: 1002034)...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">MALZEME TANIMI / ADI</label>
                     <input type="text" id="card-ent-desc" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Malzeme adı ve ölçüsü...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">VARSAYILAN FİYAT</label>
                     <input type="number" id="card-ent-price" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Fiyat...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">PARA BİRİMİ</label>
                     <select id="card-ent-curr" class="sci-input" style="width:100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;">
                        <option value="TRY">TRY ₺</option>
                        <option value="USD">USD $</option>
                        <option value="EUR">EUR €</option>
                     </select>
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">FOTOĞRAF URL</label>
                     <input type="text" id="card-ent-img" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="https://image-link...">
                  </div>
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">TEKNİK ÇİZİM URL / LINK</label>
                     <input type="text" id="card-ent-drawing" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Teknik çizim PDF linki...">
                  </div>
               </div>
               <div style="display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 0.75rem;">
                  <div>
                     <label style="font-size:0.7rem; color:rgba(255,255,255,0.4); display:block; margin-bottom: 3px;">TEDARİKÇİLER (VİRGÜL İLE AYIRIN)</label>
                     <input type="text" id="card-ent-suppliers" class="sci-input" style="width:100%; font-size: 0.8rem;" placeholder="Tedarikçi A, Tedarikçi B...">
                  </div>
               </div>
               <div style="display: flex; justify-content: flex-end; gap: 8px;">
                  <button onclick="window.createManualMaterialCard()" class="glow-btn" style="padding: 6px 14px; font-size: 0.75rem;">MALZEME KARTINI OLUŞTUR VE YAYINLA</button>
                  <button onclick="document.getElementById('manual-card-creator-form').style.display = 'none';" class="glow-btn" style="background:transparent; border-color:transparent; padding: 6px 14px; font-size: 0.75rem;">İPTAL</button>
               </div>
            </div>

            <div style="margin-bottom: 1.5rem;">
               <div style="display: flex; gap: 0.75rem;">
                  <div style="position: relative; flex: 1;">
                     <i class="fa-solid fa-satellite-dish" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.95rem;"></i>
                     <input type="text" id="research-search-input" class="sci-input" placeholder="Aramak istediğiniz SAP Kodu veya Malzeme Açıklamasını yazınız..." oninput="window.searchGlobalInventory()" style="width: 100%; padding: 6px 10px 6px 2.5rem !important; font-size:0.85rem;">
                  </div>
               </div>
            </div>

            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>SAP NO</th>
                        <th>MALZEME TANIMI / ADI</th>
                        <th>BULUNDUĞU DEPO</th>
                        <th style="text-align: center;">RAF NO</th>
                        <th style="text-align: center;">MEVCUT STOK</th>
                        <th>KONDİSYON</th>
                        <th style="text-align: right;">BİRİM FİYATI</th>
                     </tr>
                  </thead>
                  <tbody id="research-tbody">
                     <tr><td colspan="7" style="padding: 2rem; text-align: center; color: rgba(255,255,255,0.3); font-style:italic;">Arama yapmak için yukarıya yazınız.</td></tr>
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı: Malzeme Adı (research-name) -->
         <div id="research-name-view" style="${activeTab === 'research-name' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-signature" style="color: #eab308; margin-right: 6px;"></i> MALZEME ADI VE TANIMI GÜNCELLEME</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Sistemdeki SAP kodlarına ait malzeme isimlerini ve açıklamalarını doğrudan bu panelden güncelleyebilirsiniz. Güncelleme tüm depo stoklarındaki kartlara anında yansır.</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>SAP NO</th>
                        <th>MALZEME AÇIKLAMASI (DÜZENLENEBİLİR)</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${materialCards.map(card => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${card.sapNo}</td>
                           <td>
                              <input type="text" id="card-desc-${card.sapNo}" class="sci-input" value="${card.description || ''}" style="width: 100%; font-size: 0.85rem; padding: 4px 8px !important; height: 28px;">
                           </td>
                           <td style="text-align: right;">
                              <button onclick="window.updateMaterialCardFieldAction('${card.sapNo}', 'description', document.getElementById('card-desc-${card.sapNo}').value)" class="glow-btn" style="padding: 4px 10px; font-size: 0.7rem;">KAYDET</button>
                           </td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı: Fotoğraf (research-photo) -->
         <div id="research-photo-view" style="${activeTab === 'research-photo' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-image" style="color: #eab308; margin-right: 6px;"></i> MALZEME FOTOĞRAFLARI YÖNETİMİ</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Malzemelerin görsellerini güncelleyebilir veya eksik olan fotoğrafları ekleyebilirsiniz. Görsel URL'sini girerek 'Güncelle' butonuna basmanız yeterlidir.</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Önizleme</th>
                        <th>SAP NO</th>
                        <th>Malzeme Açıklaması</th>
                        <th>Fotoğraf Görsel URL (Düzenlenebilir)</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${materialCards.map(card => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td>
                              ${card.imageUrl ? `<img src="${card.imageUrl}" style="width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1);" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'40\' height=\'40\' viewBox=\'0 0 100 100\'><rect width=\'100\' height=\'100\' fill=\'%23111\'/><text x=\'50\' y=\'55\' font-size=\'12\' fill=\'%23555\' text-anchor=\'middle\'>Resim Yok</text></svg>'">` : `<div style="width:40px; height:40px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.02); border-radius:6px; font-size:0.6rem; color:rgba(255,255,255,0.3); border:1px solid rgba(255,255,255,0.05);">RESİM YOK</div>`}
                           </td>
                           <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${card.sapNo}</td>
                           <td style="font-weight: 500; font-size: 0.85rem;">${card.description || ''}</td>
                           <td>
                              <input type="text" id="card-img-${card.sapNo}" class="sci-input" value="${card.imageUrl || ''}" placeholder="Görsel URL linki..." style="width: 100%; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                           </td>
                           <td style="text-align: right;">
                              <button onclick="window.updateMaterialCardFieldAction('${card.sapNo}', 'imageUrl', document.getElementById('card-img-${card.sapNo}').value)" class="glow-btn" style="padding: 4px 10px; font-size: 0.7rem;">KAYDET</button>
                           </td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı: Teknik Çizim (research-drawing) -->
         <div id="research-drawing-view" style="${activeTab === 'research-drawing' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-file-pdf" style="color: #eab308; margin-right: 6px;"></i> TEKNİK ÇİZİMLER YÖNETİMİ</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Türbinde kullanılan yedek parçaların teknik çizim ve PDF katalog linklerini bu sayfadan yükleyebilir veya güncelleyebilirsiniz.</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>SAP NO</th>
                        <th>Malzeme Açıklaması</th>
                        <th>Teknik Çizim / PDF Linki (Düzenlenebilir)</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${materialCards.map(card => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${card.sapNo}</td>
                           <td style="font-weight: 500; font-size: 0.85rem;">${card.description || ''}</td>
                           <td>
                              <input type="text" id="card-drawing-${card.sapNo}" class="sci-input" value="${card.technicalDrawingUrl || ''}" placeholder="Teknik çizim linki..." style="width: 100%; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                           </td>
                           <td style="text-align: right;">
                              <button onclick="window.updateMaterialCardFieldAction('${card.sapNo}', 'technicalDrawingUrl', document.getElementById('card-drawing-${card.sapNo}').value)" class="glow-btn" style="padding: 4px 10px; font-size: 0.7rem;">KAYDET</button>
                           </td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı: Tedarikçiler (research-suppliers) -->
         <div id="research-suppliers-view" style="${activeTab === 'research-suppliers' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-handshake" style="color: #eab308; margin-right: 6px;"></i> TEDARİKÇİ YÖNETİMİ</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Yedek parçaları satın aldığımız veya tamir ettirdiğimiz tedarikçi firmaları bu alanda envanter kartlarına bağlayabilirsiniz.</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>SAP NO</th>
                        <th>Malzeme Açıklaması</th>
                        <th>Kayıtlı Tedarikçi Firmalar (Düzenlenebilir)</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${materialCards.map(card => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${card.sapNo}</td>
                           <td style="font-weight: 500; font-size: 0.85rem;">${card.description || ''}</td>
                           <td>
                              <input type="text" id="card-suppliers-${card.sapNo}" class="sci-input" value="${card.suppliers || ''}" placeholder="Tedarikçi A, Tedarikçi B..." style="width: 100%; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                           </td>
                           <td style="text-align: right;">
                              <button onclick="window.updateMaterialCardFieldAction('${card.sapNo}', 'suppliers', document.getElementById('card-suppliers-${card.sapNo}').value)" class="glow-btn" style="padding: 4px 10px; font-size: 0.7rem;">KAYDET</button>
                           </td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 🟨 Malzeme Kartı: Fiyat (research-price) -->
         <div id="research-price-view" style="${activeTab === 'research-price' ? '' : 'display: none;'}">
            <div style="margin-bottom: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;"><i class="fa-solid fa-tag" style="color: #eab308; margin-right: 6px;"></i> MALZEME BİRİM FİYAT LİSTESİ</h3>
               <p style="font-size:0.8rem; color:rgba(255,255,255,0.4); margin:4px 0 0 0;">Malzemelerin satın alma veya envanter birim fiyatlarını girerek, stok maliyet analizlerinin sağlıklı çalışmasını sağlayabilirsiniz.</p>
            </div>
            <div style="background: rgba(0,0,0,0.15); border-radius: 12px; padding: 6px 8px; overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>SAP NO</th>
                        <th>Malzeme Açıklaması</th>
                        <th>Birim Fiyatı</th>
                        <th>Para Birimi</th>
                        <th style="text-align: right;">Aksiyon</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${materialCards.map(card => `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                           <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${card.sapNo}</td>
                           <td style="font-weight: 500; font-size: 0.85rem;">${card.description || ''}</td>
                           <td>
                              <input type="number" id="card-price-${card.sapNo}" class="sci-input" value="${card.price || ''}" placeholder="Birim Fiyat..." style="width: 100px; font-size: 0.75rem; padding: 4px 8px !important; height: 28px; text-align:right;">
                           </td>
                           <td>
                              <select id="card-curr-${card.sapNo}" class="sci-input" style="width: 80px; font-size: 0.75rem; padding: 4px 8px !important; height: 28px;">
                                 <option value="TRY" ${card.currency === 'TRY' ? 'selected' : ''}>TRY ₺</option>
                                 <option value="USD" ${card.currency === 'USD' ? 'selected' : ''}>USD $</option>
                                 <option value="EUR" ${card.currency === 'EUR' ? 'selected' : ''}>EUR €</option>
                              </select>
                           </td>
                           <td style="text-align: right;">
                              <button onclick="window.updateMaterialCardPriceAction('${card.sapNo}')" class="glow-btn" style="padding: 4px 10px; font-size: 0.7rem;">KAYDET</button>
                           </td>
                        </tr>
                     `).join('')}
                  </tbody>
               </table>
            </div>
         </div>

         <!-- 📊 Tab 5: MCF Logs -->
         <div id="mcf-view" style="${activeTab === 'mcf' ? '' : 'display: none;'}">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 1rem;">
               <h3 style="margin: 0; color: white; font-size: 1.1rem;">SAHA SARFİYATLARI VE ANALİZ</h3>
               <div style="position: relative;">
                  <i class="fa-solid fa-search" style="position: absolute; left: 0.85rem; top: 50%; transform: translateY(-50%); color: rgba(255,255,255,0.4); font-size: 0.8rem;"></i>
                  <input type="text" id="mcf-search" oninput="window.filterMcf(this.value)" placeholder="Malzeme adı veya SAP numarası ara..." style="width: 300px; height: 32px; background-color: #000; border: 1px solid rgba(0, 243, 255, 0.2); border-radius: 8px; color: #FFFFFF; padding: 0 1rem 0 2.2rem; outline: none; font-size: 0.8rem;" />
               </div>
            </div>
            <style>
               .mcf-site-pills-container {
                 display: flex;
                 flex-wrap: wrap;
                 gap: 6px;
                 margin-bottom: 0.75rem;
                 padding: 6px;
                 background: rgba(0,0,0,0.25);
                 border-radius: 10px;
                 border: 1px solid rgba(0, 243, 255, 0.1);
               }
               .mcf-site-pill {
                 padding: 4px 10px;
                 background: rgba(255,255,255,0.02);
                 border: 1px solid rgba(255,255,255,0.05);
                 color: rgba(255,255,255,0.6);
                 border-radius: 16px;
                 font-size: 0.75rem;
                 font-weight: 700;
                 cursor: pointer;
                 transition: all 0.2s ease;
               }
               .mcf-site-pill:hover {
                 background: rgba(0, 243, 255, 0.05);
                 border-color: rgba(0, 243, 255, 0.2);
                 color: white;
               }
               .mcf-site-pill.active {
                 background: rgba(0, 243, 255, 0.1);
                 border-color: var(--accent-cyan);
                 color: var(--accent-cyan);
                 box-shadow: 0 0 8px rgba(0, 243, 255, 0.15);
               }
            </style>

            <div class="mcf-site-pills-container no-print">
               <button class="mcf-site-pill active" data-site="ALL" onclick="window.selectMcfSite('ALL')">HEPSİ</button>
               ${dataService.getSites().map((s: any) => `
                 <button class="mcf-site-pill" data-site="${s.name}" onclick="window.selectMcfSite('${s.name}')">${s.name}</button>
               `).join('')}
            </div>
            <div style="background: rgba(0,0,0,0.2); border-radius: 10px 10px 0 0; overflow: hidden;">
               <table class="cyber-table">
                  <thead>
                    <tr>
                      <th style="padding: 0.5rem 0.75rem; text-align: left; color: rgba(255,255,255,0.4); font-size: 0.7rem;">TARİH</th>
                      <th style="padding: 0.5rem 0.75rem; text-align: left; color: rgba(255,255,255,0.4); font-size: 0.7rem;">MÇF NO</th>
                      <th style="padding: 0.5rem 0.75rem; text-align: left; color: rgba(255,255,255,0.4); font-size: 0.7rem;">SAHA / TÜRBİN</th>
                      <th style="padding: 0.5rem 0.75rem; text-align: left; color: rgba(255,255,255,0.4); font-size: 0.7rem;">MALZEME</th>
                      <th style="padding: 0.5rem 0.75rem; text-align: center; color: rgba(255,255,255,0.4); font-size: 0.7rem;">ADET</th>
                      <th style="padding: 0.5rem 0.75rem; text-align: left; color: rgba(255,255,255,0.4); font-size: 0.7rem;">EKİP</th>
                    </tr>
                  </thead>
                  <tbody id="mcf-tbody">
                     <tr><td colspan="6" style="padding: 1.5rem; text-align: center; color: rgba(255,255,255,0.3); font-size: 0.8rem;">Yükleniyor...</td></tr>
                  </tbody>
               </table>
               <div id="mcf-pagination"></div>
             </div>
          </div>
          </div> <!-- End of orders-tab-view -->
       </div>
     </div>
   `;


// GLOBAL HANDLERS
(window as any).filterItems = (query: string) => {
  const items = document.querySelectorAll('.filter-item, .sci-card');
  const q = query.toLowerCase();
  items.forEach((item: any) => {
    const text = item.dataset.search?.toLowerCase() || item.innerText.toLowerCase();
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
      const isToMe = item.innerHTML.includes('BANA YÖNELİK') || item.innerHTML.includes('SİZE ÖZEL');
      item.style.display = isToMe ? 'block' : 'none';
    });
  }
};

let globalInventoryCache: any[] | null = null;

(window as any).clearGlobalInventoryCache = () => {
  globalInventoryCache = null;
};

(window as any).switchTab = (tab: string) => {
  if (tab === 'research') {
    globalInventoryCache = null;
  }
  const views = ['requests', 'mcf', 'transfers', 'purchase', 'research'];
  views.forEach(v => {
     const el = document.getElementById(`${v}-view`);
     if (el) el.style.display = v === tab ? 'block' : 'none';
  });
  
  document.querySelectorAll('.sci-tab-btn, .tab-btn-pro').forEach(b => b.classList.remove('active'));
  
  // Try both style IDs
  const tabBtnSci = document.getElementById(`tab-${tab}`);
  if (tabBtnSci) tabBtnSci.classList.add('active');
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
  
  parent.querySelectorAll('.decision-btn, .sci-action-btn').forEach(b => b.classList.remove('active'));
  if (!isCurrentlyActive) {
    btn.classList.add('active');
  }
};

(window as any).processDecision = async (requestId: string) => {
  const card = document.getElementById(`card-${requestId}`);
  if (!card) return;

  const btn = event?.target as HTMLButtonElement;
  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> İŞLENİYOR...';
    }

    const itemRows = card.querySelectorAll('.item-row-pro, tr[data-request-id]');
    const updatedItems: any[] = [];
    
    itemRows.forEach((row: any) => {
      const approveBtn = row.querySelector('.decision-btn.approve, .sci-action-btn.approve');
      const rejectBtn = row.querySelector('.decision-btn.reject, .sci-action-btn.reject');
      const noteInput = row.querySelector('.item-note') as HTMLInputElement;
      
      let status = 'PENDING';
      if (approveBtn?.classList.contains('active')) status = 'APPROVED';
      else if (rejectBtn?.classList.contains('active')) status = 'REJECTED';

      updatedItems.push({ status, note: noteInput ? noteInput.value : '' });
    });

    const managerNoteEl = document.getElementById(`manager-note-${requestId}`) as HTMLTextAreaElement;
    const managerNote = managerNoteEl ? managerNoteEl.value : '';
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
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = 'HATA OLUŞTU';
    }
  }
};

(window as any).exportToExcel = async () => {
  const requests = await orderService.getRequests();
  await excelService.exportRequestsToExcel(requests, `DH_Malzeme_Talepleri_${new Date().toISOString().split('T')[0]}`);
};

(window as any).createPurchaseRequest = async () => {
  const sapInput = document.getElementById('pr-sap') as HTMLInputElement;
  const descInput = document.getElementById('pr-desc') as HTMLInputElement;
  const qtyInput = document.getElementById('pr-qty') as HTMLInputElement;
  const whSelect = document.getElementById('pr-wh') as HTMLSelectElement;
  const noteInput = document.getElementById('pr-note') as HTMLInputElement;

  if (!sapInput || !descInput || !qtyInput || !whSelect || !noteInput) return;

  const sapNo = sapInput.value.trim();
  const description = descInput.value.trim();
  const requestedQty = parseInt(qtyInput.value) || 0;
  const warehouseId = whSelect.value;
  const notes = noteInput.value.trim();

  if (!sapNo || !description || requestedQty <= 0 || !warehouseId) {
    alert('Lütfen tüm zorunlu alanları (SAP No, Açıklama, Miktar ve Depo) doğru şekilde doldurunuz.');
    return;
  }

  const warehouseName = whSelect.options[whSelect.selectedIndex].text;
  const requestedBy = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await purchaseService.createRequest({
      sapNo,
      description,
      requestedQty,
      warehouseId,
      warehouseName,
      requestedBy,
      notes
    });
    alert('✅ Satın alma talebi başarıyla oluşturuldu.');
    // Reset form
    sapInput.value = '';
    descInput.value = '';
    qtyInput.value = '1';
    noteInput.value = '';
    const form = document.getElementById('pr-creator-form');
    if (form) form.style.display = 'none';

    // Re-render
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Talep oluşturulurken bir hata oluştu: ' + (err as Error).message);
  }
};

(window as any).approvePurchaseRequest = async (id: string) => {
  const priceInput = document.getElementById(`pr-price-${id}`) as HTMLInputElement;
  const currencySelect = document.getElementById(`pr-currency-${id}`) as HTMLSelectElement;

  if (!priceInput || !currencySelect) return;

  const priceStr = priceInput.value.trim();
  if (!priceStr) {
    alert('Lütfen onaylamadan önce tahmini bir birim fiyatı giriniz.');
    return;
  }

  const estimatedCost = parseFloat(priceStr);
  if (isNaN(estimatedCost) || estimatedCost < 0) {
    alert('Lütfen geçerli bir fiyat giriniz.');
    return;
  }

  const currency = currencySelect.value;
  const approver = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await purchaseService.approveRequest(id, approver, estimatedCost, currency);
    alert('✅ Satın alma talebi onaylandı ve fiyatlandırıldı.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Talep onaylanırken hata oluştu: ' + (err as Error).message);
  }
};

(window as any).rejectPurchaseRequest = async (id: string) => {
  const reason = prompt('Talebin reddedilme gerekçesini giriniz:');
  if (reason === null) return; // cancelled
  
  const approver = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await purchaseService.rejectRequest(id, approver, reason.trim() || 'Reddedildi');
    alert('❌ Satın alma talebi reddedildi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Talep reddedilirken hata oluştu: ' + (err as Error).message);
  }
};

(window as any).markPRAsOrdered = async (id: string) => {
  if (!confirm('Bu satın alma talebi için siparişin geçildiğini (sipariş formu/SAP kaydının oluşturulduğunu) onaylıyor musunuz?')) return;

  try {
    await purchaseService.markAsOrdered(id);
    alert('✅ Sipariş geçildi olarak işaretlendi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ İşlem sırasında hata oluştu: ' + (err as Error).message);
  }
};

(window as any).searchGlobalInventory = async () => {
  const input = document.getElementById('research-search-input') as HTMLInputElement;
  const tbody = document.getElementById('research-tbody');
  if (!input || !tbody) return;

  const term = input.value.trim().toLowerCase();
  if (term.length < 2) {
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: rgba(255,255,255,0.3); font-style:italic;">Aramak için en az 2 karakter giriniz.</td></tr>`;
    return;
  }

  // Show loading spinner
  tbody.innerHTML = `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--accent-cyan);"><i class="fa-solid fa-satellite-dish fa-spin" style="margin-right: 8px;"></i> SAHALARDAN VERİ TOPLANIYOR...</td></tr>`;

  try {
    if (!globalInventoryCache) {
      globalInventoryCache = await warehouseService.getGlobalInventory();
    }

    const filtered = globalInventoryCache.filter(item => {
      const sap = String(item.sapNo || '').toLowerCase();
      const desc = String(item.description || '').toLowerCase();
      return sap.includes(term) || desc.includes(term);
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: rgba(255,255,255,0.3);">Eşleşen malzeme bulunamadı.</td></tr>`;
      return;
    }

    const conditionTranslations: Record<string, string> = {
      'NEW': 'YENİ',
      'REVISED': 'REVİZYONLU',
      'DEFECT': 'ARIZALI',
      'SCRAP': 'HURDA'
    };
    const conditionColors: Record<string, string> = {
      'NEW': '#00ff87',
      'REVISED': '#38bdf8',
      'DEFECT': '#ff9e00',
      'SCRAP': '#ff4d4d'
    };

    tbody.innerHTML = filtered.map(item => {
      const translatedCond = conditionTranslations[item.condition || ''] || item.condition || 'YENİ';
      const condColor = conditionColors[item.condition || ''] || '#00ff87';
      const warehouseName = dataService.resolveName(item.warehouseId) || item.warehouseId;
      const priceStr = item.price ? `${item.price} ${item.currency || 'TRY'}` : '---';

      return `
        <tr style="border-bottom: 1px solid rgba(255,255,255,0.02); transition: background 0.2s;">
          <td style="font-family: monospace; color: var(--accent-cyan); font-weight: bold;">${item.sapNo || '---'}</td>
          <td style="font-weight: bold; color: white;">${item.description || '---'}</td>
          <td style="font-size: 0.85rem; color: rgba(255,255,255,0.6);">${warehouseName}</td>
          <td style="text-align: center; font-family: monospace; color: rgba(255,255,255,0.5);">${item.shelfNo || '---'}</td>
          <td style="text-align: center; font-size: 1.1rem; font-weight: 900; color: white;">${item.quantity || 0}</td>
          <td style="text-align: center;">
            <span style="font-size: 0.7rem; font-weight: bold; padding: 2px 8px; border-radius: 4px; background: ${condColor}15; color: ${condColor}; border: 1px solid ${condColor}30;">
              ${translatedCond}
            </span>
          </td>
          <td style="text-align: right; font-weight: bold; color: var(--accent-cyan);">${priceStr}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error(err);
    tbody.innerHTML = `<tr><td colspan="7" style="padding: 3rem; text-align: center; color: var(--danger);">Arama sırasında bir hata oluştu: ${(err as Error).message}</td></tr>`;
  }
};

(window as any).createPurchaseRequestFromOpen = async () => {
  const sapInput = document.getElementById('pr-sap-open') as HTMLInputElement;
  const descInput = document.getElementById('pr-desc-open') as HTMLInputElement;
  const qtyInput = document.getElementById('pr-qty-open') as HTMLInputElement;
  const whSelect = document.getElementById('pr-wh-open') as HTMLSelectElement;
  const noteInput = document.getElementById('pr-note-open') as HTMLInputElement;

  if (!sapInput || !descInput || !qtyInput || !whSelect || !noteInput) return;

  const sapNo = sapInput.value.trim();
  const description = descInput.value.trim();
  const requestedQty = parseInt(qtyInput.value) || 0;
  const warehouseId = whSelect.value;
  const notes = noteInput.value.trim();

  if (!sapNo || !description || requestedQty <= 0 || !warehouseId) {
    alert('Lütfen tüm zorunlu alanları (SAP No, Açıklama, Miktar ve Depo) doğru şekilde doldurunuz.');
    return;
  }

  const warehouseName = whSelect.options[whSelect.selectedIndex].text;
  const requestedBy = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await purchaseService.createRequest({
      sapNo,
      description,
      requestedQty,
      warehouseId,
      warehouseName,
      requestedBy,
      notes
    });
    alert('✅ Satın alma talebi başarıyla oluşturuldu.');
    sapInput.value = '';
    descInput.value = '';
    qtyInput.value = '1';
    noteInput.value = '';
    const form = document.getElementById('pr-creator-form-open');
    if (form) form.style.display = 'none';

    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Talep oluşturulurken bir hata oluştu: ' + (err as Error).message);
  }
};

(window as any).markPRAsDeliveredAction = async (id: string) => {
  const deliveryInput = document.getElementById(`pr-delivery-note-${id}`) as HTMLInputElement;
  if (!deliveryInput) return;
  const note = deliveryInput.value.trim();
  if (!note) {
    alert('Lütfen İrsaliye No giriniz.');
    return;
  }
  try {
    await purchaseService.markAsDelivered(id, note);
    alert('✅ İrsaliye kaydı başarıyla girildi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Hata oluştu: ' + (err as Error).message);
  }
};

(window as any).markPRAsInvoicedAction = async (id: string) => {
  const invoiceInput = document.getElementById(`pr-invoice-num-${id}`) as HTMLInputElement;
  if (!invoiceInput) return;
  const num = invoiceInput.value.trim();
  if (!num) {
    alert('Lütfen Fatura No giriniz.');
    return;
  }
  try {
    await purchaseService.markAsInvoiced(id, num);
    alert('✅ Fatura kaydı başarıyla girildi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Hata oluştu: ' + (err as Error).message);
  }
};

(window as any).completePRStockEntryAction = async (id: string) => {
  if (!confirm('Malzemeleri depoya fiilen teslim alıp stok miktarlarını artırmayı onaylıyor musunuz?')) return;

  try {
    const prs = await purchaseService.getRequests('ALL');
    const req = prs.find(r => r.id === id);
    if (!req) return;

    const userEmail = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';
    await warehouseService.updateStockBySap(
      req.warehouseId,
      req.sapNo,
      req.requestedQty,
      {
        user: userEmail,
        reason: `Satın Alma Girişi (PR: ${req.sapNo}, İrs/Fat: ${req.deliveryNoteNo || ''}/${req.invoiceNo || ''})`,
        materialName: req.description
      }
    );

    await purchaseService.markAsCompleted(id);

    alert('✅ Malzemeler başarıyla stoka dahil edildi ve talep tamamlandı.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Hata oluştu: ' + (err as Error).message);
  }
};

(window as any).updateMaterialCardFieldAction = async (sapNo: string, field: string, value: string) => {
  try {
    const docId = sapNo.replace(/\//g, '_');
    const docRef = doc(db, 'GlobalMaterialImages', docId);
    
    const updates: any = {
      [field]: value,
      lastUpdated: serverTimestamp()
    };
    
    await setDoc(docRef, updates, { merge: true });
    await warehouseService.syncMaterialCardGlobally(sapNo, updates);
    
    alert('✅ Malzeme kartı alanı başarıyla güncellendi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Güncelleme sırasında hata oluştu: ' + (err as Error).message);
  }
};

(window as any).updateMaterialCardPriceAction = async (sapNo: string) => {
  const priceInput = document.getElementById(`card-price-${sapNo}`) as HTMLInputElement;
  const currSelect = document.getElementById(`card-curr-${sapNo}`) as HTMLSelectElement;

  if (!priceInput || !currSelect) return;

  const price = parseFloat(priceInput.value) || 0;
  const currency = currSelect.value;

  try {
    const docId = sapNo.replace(/\//g, '_');
    const docRef = doc(db, 'GlobalMaterialImages', docId);
    
    const updates = {
      price,
      currency,
      lastUpdated: serverTimestamp()
    };
    
    await setDoc(docRef, updates, { merge: true });
    await warehouseService.syncMaterialCardGlobally(sapNo, updates);
    
    alert('✅ Birim fiyat başarıyla güncellendi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Fiyat güncellenirken hata oluştu: ' + (err as Error).message);
  }
};

(window as any).createManualMaterialCard = async () => {
  const sapInput = document.getElementById('card-ent-sap') as HTMLInputElement;
  const descInput = document.getElementById('card-ent-desc') as HTMLInputElement;
  const priceInput = document.getElementById('card-ent-price') as HTMLInputElement;
  const currSelect = document.getElementById('card-ent-curr') as HTMLSelectElement;
  const imgInput = document.getElementById('card-ent-img') as HTMLInputElement;
  const drawingInput = document.getElementById('card-ent-drawing') as HTMLInputElement;
  const suppliersInput = document.getElementById('card-ent-suppliers') as HTMLInputElement;

  if (!sapInput || !descInput) return;

  const sapNo = sapInput.value.trim();
  const description = descInput.value.trim();
  const price = parseFloat(priceInput.value) || 0;
  const currency = currSelect ? currSelect.value : 'TRY';
  const imageUrl = imgInput ? imgInput.value.trim() : '';
  const technicalDrawingUrl = drawingInput ? drawingInput.value.trim() : '';
  const suppliers = suppliersInput ? suppliersInput.value.trim() : '';

  if (!sapNo || !description) {
    alert('Lütfen SAP No ve Malzeme Tanımı alanlarını doldurunuz.');
    return;
  }

  try {
    const docId = sapNo.replace(/\//g, '_');
    const docRef = doc(db, 'GlobalMaterialImages', docId);
    await setDoc(docRef, {
      sapNo,
      description,
      price,
      currency,
      imageUrl,
      technicalDrawingUrl,
      suppliers,
      lastUpdated: serverTimestamp()
    });

    await warehouseService.syncMaterialCardGlobally(sapNo, {
      description,
      price,
      currency,
      imageUrl,
      technicalDrawingUrl,
      suppliers
    });

    alert('✅ Global malzeme kartı başarıyla oluşturuldu ve sahalara senkronize edildi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Kart oluşturulurken hata oluştu: ' + (err as Error).message);
  }
};

(window as any).saveManualEntryInvoice = async () => {
  const sapInput = document.getElementById('manual-ent-sap') as HTMLInputElement;
  const descInput = document.getElementById('manual-ent-desc') as HTMLInputElement;
  const qtyInput = document.getElementById('manual-ent-qty') as HTMLInputElement;
  const shelfInput = document.getElementById('manual-ent-shelf') as HTMLInputElement;
  const delivInput = document.getElementById('manual-ent-deliv') as HTMLInputElement;
  const invInput = document.getElementById('manual-ent-inv') as HTMLInputElement;
  const priceInput = document.getElementById('manual-ent-price') as HTMLInputElement;
  const currSelect = document.getElementById('manual-ent-curr') as HTMLSelectElement;
  const whSelect = document.getElementById('manual-ent-wh') as HTMLSelectElement;
  const condSelect = document.getElementById('manual-ent-cond') as HTMLSelectElement;

  if (!sapInput || !descInput || !qtyInput || !whSelect) return;

  const sapNo = sapInput.value.trim();
  const description = descInput.value.trim();
  const qty = parseInt(qtyInput.value) || 0;
  const shelfNo = shelfInput ? shelfInput.value.trim() : 'Tanımsız';
  const deliveryNoteNo = delivInput ? delivInput.value.trim() : '';
  const invoiceNo = invInput ? invInput.value.trim() : '';
  const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
  const currency = currSelect ? currSelect.value : 'TRY';
  const warehouseId = whSelect.value;
  const condition = condSelect ? condSelect.value as any : 'NEW';

  if (!sapNo || !description || qty <= 0 || !warehouseId) {
    alert('Lütfen SAP No, Malzeme Tanımı, Miktar ve Hedef Depo alanlarını doldurunuz.');
    return;
  }

  const warehouseName = whSelect.options[whSelect.selectedIndex].text;
  const userEmail = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await purchaseService.createRequest({
      sapNo,
      description,
      requestedQty: qty,
      warehouseId,
      warehouseName,
      requestedBy: userEmail,
      notes: `Doğrudan faturalı giriş (İrs: ${deliveryNoteNo}, Fat: ${invoiceNo})`,
      estimatedCost: price,
      currency,
      orderedAt: serverTimestamp(),
      deliveryNoteNo,
      deliveredAt: serverTimestamp(),
      invoiceNo,
      invoicedAt: serverTimestamp(),
    });

    const prs = await purchaseService.getRequests('PENDING');
    const createdPr = prs.find(p => p.sapNo === sapNo && p.requestedBy === userEmail);
    if (createdPr && createdPr.id) {
      const docRef = doc(db, 'purchase_requests', createdPr.id);
      await updateDoc(docRef, {
        status: 'COMPLETED',
        completedAt: serverTimestamp()
      });
    }

    await warehouseService.updateStockBySap(
      warehouseId,
      sapNo,
      qty,
      {
        user: userEmail,
        reason: `Doğrudan İrsaliye/Fatura Girişi (Raf: ${shelfNo})`,
        materialName: description
      },
      condition,
      shelfNo
    );

    alert('✅ İrsaliyeli/faturalı doğrudan giriş başarıyla yapıldı ve stok güncellendi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ İşlem sırasında hata oluştu: ' + (err as Error).message);
  }
};

(window as any).saveManualEntrySale = async () => {
  const sapInput = document.getElementById('sale-ent-sap') as HTMLInputElement;
  const qtyInput = document.getElementById('sale-ent-qty') as HTMLInputElement;
  const buyerInput = document.getElementById('sale-ent-buyer') as HTMLInputElement;
  const whSelect = document.getElementById('sale-ent-wh') as HTMLSelectElement;
  const priceInput = document.getElementById('sale-ent-price') as HTMLInputElement;
  const currSelect = document.getElementById('sale-ent-curr') as HTMLSelectElement;
  const noteInput = document.getElementById('sale-ent-note') as HTMLInputElement;

  if (!sapInput || !qtyInput || !buyerInput || !whSelect) return;

  const sapNo = sapInput.value.trim();
  const qty = parseInt(qtyInput.value) || 0;
  const buyer = buyerInput.value.trim();
  const warehouseId = whSelect.value;
  const price = parseFloat(priceInput.value) || 0;
  const currency = currSelect.value;
  const notes = noteInput ? noteInput.value.trim() : '';

  if (!sapNo || qty <= 0 || !buyer || !warehouseId) {
    alert('Lütfen SAP No, Miktar, Alıcı ve Çıkış Deposu alanlarını doldurunuz.');
    return;
  }

  const userEmail = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    const inventory = await warehouseService.getInventory(warehouseId);
    const item = inventory.find(i => i.sapNo === sapNo);
    if (!item || item.quantity < qty) {
      alert(`❌ Stok yetersiz! Bu depoda bu SAP kodlu malzemeden yalnızca ${item ? item.quantity : 0} adet var.`);
      return;
    }

    await warehouseService.updateStockBySap(
      warehouseId,
      sapNo,
      -qty,
      {
        user: userEmail,
        reason: `Dış Satış Çıkışı (Alıcı: ${buyer})`,
        materialName: item.description
      }
    );

    await addDoc(collection(db, 'sales_logs'), {
      warehouseId,
      sapNo,
      description: item.description,
      quantity: qty,
      buyer,
      price,
      currency,
      notes,
      user: userEmail,
      timestamp: serverTimestamp()
    });

    alert('✅ Satış kaydı başarıyla oluşturuldu ve stoktan düşüldü.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Satış kaydı sırasında hata oluştu: ' + (err as Error).message);
  }
};

(window as any).saveManualEntryRepair = async () => {
  const sapInput = document.getElementById('repair-ent-sap') as HTMLInputElement;
  const qtyInput = document.getElementById('repair-ent-qty') as HTMLInputElement;
  const shelfInput = document.getElementById('repair-ent-shelf') as HTMLInputElement;
  const whSelect = document.getElementById('repair-ent-wh') as HTMLSelectElement;
  const companyInput = document.getElementById('repair-ent-company') as HTMLInputElement;
  const reportInput = document.getElementById('repair-ent-report') as HTMLInputElement;
  const notesInput = document.getElementById('repair-ent-notes') as HTMLInputElement;

  if (!sapInput || !qtyInput || !whSelect || !companyInput) return;

  const sapNo = sapInput.value.trim();
  const qty = parseInt(qtyInput.value) || 0;
  const shelfNo = shelfInput ? shelfInput.value.trim() : 'Tanımsız';
  const warehouseId = whSelect.value;
  const repairCompany = companyInput.value.trim();
  const repairReportNo = reportInput ? reportInput.value.trim() : '';
  const notes = notesInput ? notesInput.value.trim() : '';

  if (!sapNo || qty <= 0 || !warehouseId || !repairCompany) {
    alert('Lütfen SAP No, Miktar, Hedef Depo ve Atölye/Firma alanlarını doldurunuz.');
    return;
  }

  const userEmail = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    let description = 'Tamirli Malzeme';
    const inventory = await warehouseService.getInventory(warehouseId);
    const item = inventory.find(i => i.sapNo === sapNo);
    if (item) {
      description = item.description;
    } else {
      const globalInv = await warehouseService.getGlobalInventory();
      const globalItem = globalInv.find(i => i.sapNo === sapNo);
      if (globalItem) {
        description = globalItem.description;
      }
    }

    await warehouseService.updateStockBySap(
      warehouseId,
      sapNo,
      qty,
      {
        user: userEmail,
        reason: `Tamirli Malzeme Girişi (${repairCompany} firmasından)`,
        materialName: description
      },
      'REVISED',
      shelfNo
    );

    await addDoc(collection(db, 'repair_logs'), {
      warehouseId,
      sapNo,
      description,
      quantity: qty,
      repairCompany,
      repairReportNo,
      notes,
      user: userEmail,
      timestamp: serverTimestamp()
    });

    alert('✅ Tamirli parça revizyonlu olarak başarıyla stoka kaydedildi.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Hata oluştu: ' + (err as Error).message);
  }
};

(window as any).saveManualEntryNonStock = async () => {
  const descInput = document.getElementById('nonstock-ent-desc') as HTMLInputElement;
  const qtyInput = document.getElementById('nonstock-ent-qty') as HTMLInputElement;
  const sapInput = document.getElementById('nonstock-ent-sap') as HTMLInputElement;
  const whSelect = document.getElementById('nonstock-ent-wh') as HTMLSelectElement;
  const priceInput = document.getElementById('nonstock-ent-price') as HTMLInputElement;
  const currSelect = document.getElementById('nonstock-ent-curr') as HTMLSelectElement;
  const supplierInput = document.getElementById('nonstock-ent-supplier') as HTMLInputElement;
  const noteInput = document.getElementById('nonstock-ent-note') as HTMLInputElement;

  if (!descInput || !qtyInput || !whSelect) return;

  const description = descInput.value.trim();
  const quantity = qtyInput.value.trim();
  const sapNo = sapInput ? sapInput.value.trim() : '';
  const warehouseId = whSelect.value;
  const price = parseFloat(priceInput.value) || 0;
  const currency = currSelect.value;
  const supplier = supplierInput ? supplierInput.value.trim() : '';
  const notes = noteInput ? noteInput.value.trim() : '';

  if (!description || !quantity || !warehouseId) {
    alert('Lütfen Kalem/Hizmet Tanımı, Miktar/Birim ve Kullanılan Depo/Saha alanlarını doldurunuz.');
    return;
  }

  const userEmail = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';

  try {
    await addDoc(collection(db, 'non_stock_logs'), {
      warehouseId,
      sapNo,
      description,
      quantity,
      price,
      currency,
      supplier,
      notes,
      user: userEmail,
      timestamp: serverTimestamp()
    });

    alert('✅ Stoksuz doğrudan gider kaydı başarıyla oluşturuldu.');
    (window as any).render({ skipShell: true });
  } catch (err) {
    console.error(err);
    alert('❌ Gider kaydı sırasında hata oluştu: ' + (err as Error).message);
  }
};

// --- AUTOCOMPLETE MATERIAL SEARCH ---
(window as any).globalMaterialCards = materialCards;
(window as any).globalInventory = globalInventory;
(window as any).globalWarehouses = warehouses;

(window as any).searchMaterialCards = (val: string) => {
   const resultsContainer = document.getElementById('pr-material-search-results');
   if (!resultsContainer) return;
   if (!val || val.trim().length === 0) {
      resultsContainer.classList.add('hidden');
      return;
   }
   const term = val.toLowerCase().trim();
   
   // Build a map of unique materials from both globalMaterialCards and globalInventory
   const uniqueMaterialsMap = new Map();

   // Add from globalMaterialCards
   ((window as any).globalMaterialCards || []).forEach((c: any) => {
      if (!c) return;
      const sap = String(c.sapNo || c.id || '').trim();
      if (sap) {
         uniqueMaterialsMap.set(sap.toLowerCase(), {
            sapNo: sap,
            description: c.description || c.materialName || c.name || `SAP: ${sap}`
         });
      }
   });

   // Add/overwrite from globalInventory (which has all items in warehouses)
   ((window as any).globalInventory || []).forEach((item: any) => {
      if (!item) return;
      const sap = String(item.sapNo || '').trim();
      if (sap) {
         const key = sap.toLowerCase();
         const existing = uniqueMaterialsMap.get(key);
         const desc = item.description || item.materialName || (existing && existing.description) || `SAP: ${sap}`;
         uniqueMaterialsMap.set(key, {
            sapNo: sap,
            description: desc
         });
      }
   });

   const allMaterials = Array.from(uniqueMaterialsMap.values());

   const matches = allMaterials.filter((c: any) => 
      c && (String(c.sapNo || '').toLowerCase().includes(term) || 
      String(c.description || '').toLowerCase().includes(term))
   ).slice(0, 10);

   if (matches.length === 0) {
      resultsContainer.innerHTML = `<div style="padding: 8px; color: rgba(255,255,255,0.4); font-size: 0.8rem; text-align: center;">Kayıtlı malzeme bulunamadı.</div>`;
   } else {
      resultsContainer.innerHTML = matches.map((c: any) => {
         const stocks = ((window as any).globalInventory || []).filter((item: any) => item && String(item.sapNo || '').trim().toLowerCase() === String(c.sapNo).trim().toLowerCase() && item.quantity > 0);
         const stockInfo = stocks.map((item: any) => {
            const whName = dataService.resolveName(item.warehouseId);
            return `${whName.replace(' Santrali', '').replace(' Deposu', '')}: ${item.quantity}`;
         }).join(' | ');
         
         const stockBadge = stockInfo ? `
            <div style="font-size: 0.65rem; color: #14f195; margin-top: 3px; display: flex; align-items: center; gap: 4px;">
               <i class="fa-solid fa-warehouse"></i> <strong>Stok:</strong> ${stockInfo}
            </div>` : `
            <div style="font-size: 0.65rem; color: rgba(255,255,255,0.35); margin-top: 3px; display: flex; align-items: center; gap: 4px;">
               <i class="fa-solid fa-warehouse"></i> Stok Yok
            </div>`;

         return `
            <div class="autocomplete-item" onclick="window.selectMaterialCard('${c.sapNo}', '${(c.description || '').replace(/'/g, "\\'")}')" style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
               <div style="font-weight: bold; font-size: 0.8rem; color: white;">${c.description || ''}</div>
               <div style="font-size: 0.65rem; color: var(--accent-cyan); font-family: monospace; margin-top: 2px;">SAP: ${c.sapNo}</div>
               ${stockBadge}
            </div>
         `;
      }).join('');
   }
   resultsContainer.classList.remove('hidden');
};

(window as any).selectMaterialCard = (sapNo: string, desc: string) => {
   const sapInput = document.getElementById('pr-sap-open') as HTMLInputElement;
   const descInput = document.getElementById('pr-desc-open') as HTMLInputElement;
   const searchInput = document.getElementById('pr-material-search') as HTMLInputElement;
   const resultsContainer = document.getElementById('pr-material-search-results');
   
   if (sapInput) sapInput.value = sapNo;
   if (descInput) descInput.value = desc;
   if (searchInput) searchInput.value = desc;
   if (resultsContainer) resultsContainer.classList.add('hidden');

   if (typeof (window as any).lookupSapInformation === 'function') {
      (window as any).lookupSapInformation(sapNo);
   }
};

(window as any).lookupSapInformation = (sapNo: string) => {
   if (!sapNo) {
      const container = document.getElementById('pr-stock-info-container');
      if (container) container.style.display = 'none';
      return;
   }
   const sNo = sapNo.trim().toLowerCase();
   const card = ((window as any).globalMaterialCards || []).find((c: any) => String(c.sapNo || c.id || '').trim().toLowerCase() === sNo);
   const stocks = ((window as any).globalInventory || []).filter((item: any) => String(item.sapNo || '').trim().toLowerCase() === sNo);

   const descInput = document.getElementById('pr-desc-open') as HTMLInputElement;
   if (descInput) {
      if (card && (card.description || card.materialName)) {
         descInput.value = card.description || card.materialName;
      } else if (stocks.length > 0 && stocks[0].description) {
         descInput.value = stocks[0].description;
      }
   }

   (window as any).displayStockLevels(sNo, stocks);
};

(window as any).displayStockLevels = (sapNo: string, stocks: any[]) => {
   const container = document.getElementById('pr-stock-info-container');
   const listDiv = document.getElementById('pr-stock-info-list');
   if (!container || !listDiv) return;

   const sNo = sapNo.trim().toLowerCase();
   let matchStocks = stocks;
   if (!matchStocks || matchStocks.length === 0) {
      matchStocks = ((window as any).globalInventory || []).filter((item: any) => String(item.sapNo || '').trim().toLowerCase() === sNo);
   }

   if (matchStocks.length === 0) {
      listDiv.innerHTML = `<span style="font-size: 0.7rem; color: rgba(255,255,255,0.4);"><i class="fa-solid fa-triangle-exclamation"></i> Bu malzemeden hiçbir santral deposunda stok bulunmuyor. Yeni sipariş açılması uygundur.</span>`;
   } else {
      listDiv.innerHTML = matchStocks.map((item: any) => {
         const whName = dataService.resolveName(item.warehouseId);
         return `
            <span style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); padding: 4px 10px; border-radius: 6px; font-size: 0.7rem; color: white; display: flex; align-items: center; gap: 6px;">
               <strong>${whName}:</strong> <span style="color: var(--accent-cyan); font-weight: bold;">${item.quantity} ${item.unit || 'Adet'}</span>
            </span>
         `;
      }).join('');
   }
   container.style.display = 'block';
};

// --- DRAG AND DROP FILE ATTACHMENTS ---
(window as any).selectedAttachments = [];

(window as any).handlePRDrop = (e: DragEvent) => {
   e.preventDefault();
   const dropzone = document.getElementById('pr-attachments-dropzone');
   if (dropzone) dropzone.style.borderColor = 'rgba(0,243,255,0.25)';
   if (e.dataTransfer?.files) {
      (window as any).processPRFiles(e.dataTransfer.files);
   }
};

(window as any).handlePRFilesSelect = (e: Event) => {
   const input = e.target as HTMLInputElement;
   if (input.files) {
      (window as any).processPRFiles(input.files);
   }
};

(window as any).processPRFiles = (files: FileList) => {
   const fileListDiv = document.getElementById('pr-file-list');
   if (!fileListDiv) return;

   Array.from(files).forEach((file: File) => {
      if (file.size > 5 * 1024 * 1024) {
         alert(`Dosya çok büyük: ${file.name} (Maks 5MB)`);
         return;
      }
      const reader = new FileReader();
      reader.onload = () => {
         const base64 = reader.result as string;
         const fileObj = {
            name: file.name,
            size: file.size,
            type: file.type,
            base64
         };
         if (!(window as any).selectedAttachments) {
            (window as any).selectedAttachments = [];
         }
         (window as any).selectedAttachments.push(fileObj);
         (window as any).renderSelectedPRFiles();
      };
      reader.readAsDataURL(file);
   });
};

(window as any).renderSelectedPRFiles = () => {
   const fileListDiv = document.getElementById('pr-file-list');
   if (!fileListDiv) return;
   fileListDiv.innerHTML = ((window as any).selectedAttachments || []).map((file: any, idx: number) => `
      <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 6px 10px; font-size: 0.75rem;">
         <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 80%;">
            <i class="${file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-image'}" style="color: var(--accent-cyan);"></i>
            <span>${file.name}</span>
            <span style="opacity: 0.4; font-size: 0.65rem;">(${(file.size / 1024).toFixed(1)} KB)</span>
         </div>
         <button onclick="window.removePRFile(${idx})" style="background: transparent; border: none; color: var(--danger); cursor: pointer;"><i class="fa-solid fa-trash-can"></i></button>
      </div>
   `).join('');
};

(window as any).removePRFile = (idx: number) => {
   (window as any).selectedAttachments.splice(idx, 1);
   (window as any).renderSelectedPRFiles();
};

// --- FORM RESET ---
(window as any).clearPRForm = () => {
   const searchInput = document.getElementById('pr-material-search') as HTMLInputElement;
   const sapInput = document.getElementById('pr-sap-open') as HTMLInputElement;
   const descInput = document.getElementById('pr-desc-open') as HTMLInputElement;
   const qtyInput = document.getElementById('pr-qty-open') as HTMLInputElement;
   const unitSelect = document.getElementById('pr-unit-open') as HTMLSelectElement;
   const whSelect = document.getElementById('pr-wh-open') as HTMLSelectElement;
   const urgencySelect = document.getElementById('pr-urgency-open') as HTMLSelectElement;
   const dateInput = document.getElementById('pr-delivery-date-open') as HTMLInputElement;
   const contactInput = document.getElementById('pr-contact-open') as HTMLInputElement;
   const supplierInput = document.getElementById('pr-supplier-open') as HTMLInputElement;
   const costCenterInput = document.getElementById('pr-cost-center-open') as HTMLInputElement;
   const priceInput = document.getElementById('pr-est-price-open') as HTMLInputElement;
   const currencySelect = document.getElementById('pr-est-currency-open') as HTMLSelectElement;
   const noteInput = document.getElementById('pr-note-open') as HTMLInputElement;

   if (searchInput) searchInput.value = '';
   if (sapInput) sapInput.value = '';
   if (descInput) descInput.value = '';
   if (qtyInput) qtyInput.value = '1';
   if (unitSelect) unitSelect.selectedIndex = 0;
   if (whSelect) whSelect.selectedIndex = 0;
   if (urgencySelect) urgencySelect.value = 'Orta';
   if (dateInput) dateInput.value = '';
   if (contactInput) contactInput.value = '';
   if (supplierInput) supplierInput.value = '';
   if (costCenterInput) costCenterInput.value = '';
   if (priceInput) priceInput.value = '';
   if (currencySelect) currencySelect.value = 'TRY';
   if (noteInput) noteInput.value = '';

   (window as any).selectedAttachments = [];
   (window as any).renderSelectedPRFiles();
};

// --- FORM SUBMISSION ---
(window as any).createPurchaseRequestFromOpenNew = async () => {
   const sapInput = document.getElementById('pr-sap-open') as HTMLInputElement;
   const descInput = document.getElementById('pr-desc-open') as HTMLInputElement;
   const qtyInput = document.getElementById('pr-qty-open') as HTMLInputElement;
   const unitSelect = document.getElementById('pr-unit-open') as HTMLSelectElement;
   const whSelect = document.getElementById('pr-wh-open') as HTMLSelectElement;
   const urgencySelect = document.getElementById('pr-urgency-open') as HTMLSelectElement;
   const dateInput = document.getElementById('pr-delivery-date-open') as HTMLInputElement;
   const contactInput = document.getElementById('pr-contact-open') as HTMLInputElement;
   const supplierInput = document.getElementById('pr-supplier-open') as HTMLInputElement;
   const costCenterInput = document.getElementById('pr-cost-center-open') as HTMLInputElement;
   const priceInput = document.getElementById('pr-est-price-open') as HTMLInputElement;
   const currencySelect = document.getElementById('pr-est-currency-open') as HTMLSelectElement;
   const noteInput = document.getElementById('pr-note-open') as HTMLInputElement;

   if (!sapInput || !descInput || !qtyInput || !whSelect || !noteInput) return;

   const sapNo = sapInput.value.trim();
   const description = descInput.value.trim();
   const requestedQty = parseInt(qtyInput.value) || 0;
   const unit = unitSelect ? unitSelect.value : 'Adet';
   const warehouseId = whSelect.value;
   const notes = noteInput.value.trim();

   if (!sapNo || !description || requestedQty <= 0 || !warehouseId || !notes) {
      alert('Lütfen tüm zorunlu alanları (SAP No, Açıklama, Miktar, Depo ve Gerekçe Notu) doldurunuz.');
      return;
   }

   const warehouseName = whSelect.options[whSelect.selectedIndex].text;
   const requestedBy = authService.getCurrentUser()?.email || 'hursit.akter@demirerholding.com';
   const urgency = urgencySelect ? (urgencySelect.value as any) : 'Orta';
   const targetDeliveryDate = dateInput ? dateInput.value : '';
   const costCenter = costCenterInput ? costCenterInput.value.trim() : '';
   const suggestedSupplier = supplierInput ? supplierInput.value.trim() : '';
   const estimatedCost = priceInput ? (parseFloat(priceInput.value) || 0) : 0;
   const currency = currencySelect ? currencySelect.value : 'TRY';
   const attachments = (window as any).selectedAttachments || [];

   try {
      await purchaseService.createRequest({
         sapNo,
         description,
         requestedQty,
         warehouseId,
         warehouseName,
         requestedBy,
         notes,
         urgency,
         unit,
         targetDeliveryDate,
         costCenter,
         suggestedSupplier,
         estimatedCost,
         currency,
         attachments
      });

      alert('✅ Satın alma talebi başarıyla oluşturuldu.');
      (window as any).clearPRForm();
      (window as any).render({ skipShell: true });
   } catch (err) {
      console.error(err);
      alert('❌ Hata oluştu: ' + (err as Error).message);
   }
};

// --- VIEW SWITCHER STATE ---
(window as any).currentViewingOrderNo = (window as any).currentViewingOrderNo || null;
(window as any).editingOrderRequests = (window as any).editingOrderRequests || null;
(window as any).tempNewDeliveries = (window as any).tempNewDeliveries || [];

// --- DAYS DIFFERENCE CALCULATOR ---
function getDaysDifference(dateStr1: string, dateStr2: string): string {
   if (!dateStr1 || !dateStr2) return '-';
   const parse = (s: string) => {
      const parts = s.split(/[.-]/);
      if (parts.length === 3) {
         if (parts[0].length === 4) { // YYYY-MM-DD
            return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
         } else { // DD.MM.YYYY
            return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
         }
      }
      return new Date(s);
   };
   const d1 = parse(dateStr1);
   const d2 = parse(dateStr2);
   if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return '-';
   const diffTime = Math.abs(d2.getTime() - d1.getTime());
   const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
   return String(diffDays);
}

// --- UPDATE INDIVIDUAL ITEM FROM DETAILED PAGE ---
(window as any).updateItemRequestQty = (idx: number, val: string) => {
   const qty = parseInt(val, 10) || 0;
   const items = (window as any).editingOrderRequests || [];
   const item = items[idx];
   if (!item) return;

   item.requestedQty = qty;
   item.totalPriceQuote = qty * (item.unitPriceQuote || 0);
   item.totalPriceInvoice = qty * (item.unitPriceInvoice || 0);
   item.openOrderTotal = Math.max(0, qty - (item.arrivedQty || 0)) * (item.unitPriceInvoice || 0);

   (window as any).renderPRTableNew();
};

(window as any).updateItemPrice = (idx: number, field: 'unitPriceQuote' | 'unitPriceInvoice', val: string) => {
   const price = parseFloat(val) || 0;
   const items = (window as any).editingOrderRequests || [];
   const item = items[idx];
   if (!item) return;

   item[field] = price;
   
   item.totalPriceQuote = (item.requestedQty || 0) * (item.unitPriceQuote || 0);
   item.totalPriceInvoice = (item.requestedQty || 0) * (item.unitPriceInvoice || 0);
   item.arrivedProductsTotal = (item.arrivedQty || 0) * (item.unitPriceInvoice || 0);
   item.openOrderTotal = Math.max(0, (item.requestedQty || 0) - (item.arrivedQty || 0)) * (item.unitPriceInvoice || 0);

   (window as any).renderPRTableNew();
};

// --- UPDATE CELL QUANTITY ---
(window as any).updateCellQty = (itemIndex: number, invoiceNo: string, val: string) => {
   const qty = parseInt(val, 10) || 0;
   const items = (window as any).editingOrderRequests || [];
   const item = items[itemIndex];
   if (!item) return;

   item.deliveries = item.deliveries || [];
   let del = item.deliveries.find((d: any) => d.invoiceNo === invoiceNo);
   if (!del) {
      const other = items.find((r: any) => r.deliveries?.some((d: any) => d.invoiceNo === invoiceNo));
      const otherDel = other ? other.deliveries.find((d: any) => d.invoiceNo === invoiceNo) : null;
      const temp = (window as any).tempNewDeliveries.find((d: any) => d.invoiceNo === invoiceNo);
      
      del = {
         invoiceNo,
         deliveryDate: otherDel?.deliveryDate || temp?.deliveryDate || new Date().toISOString().split('T')[0],
         invoiceDate: otherDel?.invoiceDate || temp?.invoiceDate || new Date().toISOString().split('T')[0],
         quantity: 0
      };
      item.deliveries.push(del);
   }

   del.quantity = qty;

   // Recalculate arrivedQty
   item.arrivedQty = item.deliveries.reduce((sum: number, d: any) => sum + d.quantity, 0);
   
   // Recalculate computed pricing fields
   item.totalPriceQuote = item.requestedQty * (item.unitPriceQuote || 0);
   item.totalPriceInvoice = item.requestedQty * (item.unitPriceInvoice || 0);
   item.arrivedProductsTotal = item.arrivedQty * (item.unitPriceInvoice || 0);
   item.openOrderTotal = Math.max(0, item.requestedQty - item.arrivedQty) * (item.unitPriceInvoice || 0);

   // Update status
   if (item.arrivedQty >= item.requestedQty && item.requestedQty > 0) {
      item.status = 'COMPLETED';
   } else if (item.arrivedQty > 0) {
      item.status = 'DELIVERED';
   } else {
      item.status = 'ORDERED';
   }

   (window as any).renderPRTableNew();
};

// --- UPDATE DELIVERY COLUMN DATES ---
(window as any).updateDeliveryHeader = (invoiceNo: string, field: 'deliveryDate' | 'invoiceDate', val: string) => {
   const items = (window as any).editingOrderRequests || [];
   
   for (const item of items) {
      if (item.deliveries) {
         const del = item.deliveries.find((d: any) => d.invoiceNo === invoiceNo);
         if (del) {
            del[field] = val;
         }
      }
   }

   const temp = (window as any).tempNewDeliveries.find((d: any) => d.invoiceNo === invoiceNo);
   if (temp) {
      temp[field] = val;
   }

   (window as any).renderPRTableNew();
};

// --- UPDATE ORDER DATE ---
(window as any).updateOrderDate = (val: string) => {
   const items = (window as any).editingOrderRequests || [];
   for (const item of items) {
      item.orderDate = val;
   }
   (window as any).renderPRTableNew();
};

// --- OPEN NEW DELIVERY COLUMN MODAL ---
(window as any).openAddDeliveryModal = () => {
   const modalOverlay = document.createElement('div');
   modalOverlay.id = 'add-delivery-col-modal';
   modalOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      z-index: 100000; display: flex; align-items: center; justify-content: center;
   `;
   
   const today = new Date().toISOString().split('T')[0];

   modalOverlay.innerHTML = `
      <div class="sci-card" style="width: 380px; background: #0b1120; border: 1px solid var(--accent-cyan); padding: 1.5rem; border-radius: 12px; box-shadow: 0 0 25px rgba(0, 243, 255, 0.25);">
         <h4 style="margin: 0 0 1rem 0; color: white; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-truck" style="color: var(--accent-cyan);"></i> YENİ FATURA/TESLİMAT SÜTUNU EKLE
         </h4>
         
         <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.8rem; color: white; margin-bottom: 1.5rem;">
            <div>
               <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">FATURA / İRSALİYE NO</label>
               <input type="text" id="new-del-invoiceNo" class="sci-input" style="width:100%;" placeholder="örn: 54304811" required>
            </div>
            <div>
               <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">FATURA TARİHİ</label>
               <input type="date" id="new-del-invoiceDate" class="sci-input" style="width:100%;" value="${today}" required>
            </div>
            <div>
               <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TESLİMAT / DELIVERY TARİHİ</label>
               <input type="date" id="new-del-deliveryDate" class="sci-input" style="width:100%;" value="${today}" required>
            </div>
         </div>
         
         <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button onclick="window.submitNewDeliveryColumn()" class="glow-btn" style="background: rgba(20,241,149,0.15); border-color:#14f195; color:#14f195; font-weight:bold;">EKLE</button>
            <button onclick="document.getElementById('add-delivery-col-modal').remove()" class="glow-btn">İPTAL</button>
         </div>
      </div>
   `;
   document.body.appendChild(modalOverlay);
};

(window as any).submitNewDeliveryColumn = () => {
   const invoiceNo = (document.getElementById('new-del-invoiceNo') as HTMLInputElement)?.value.trim() || '';
   const invoiceDate = (document.getElementById('new-del-invoiceDate') as HTMLInputElement)?.value || '';
   const deliveryDate = (document.getElementById('new-del-deliveryDate') as HTMLInputElement)?.value || '';
   
   if (!invoiceNo) {
      alert('Lütfen Fatura/İrsaliye numarası giriniz.');
      return;
   }

   const items = (window as any).editingOrderRequests || [];
   const exists = items.some((r: any) => r.deliveries?.some((d: any) => d.invoiceNo === invoiceNo)) ||
                  (window as any).tempNewDeliveries.some((d: any) => d.invoiceNo === invoiceNo);
   
   if (exists) {
      alert('Bu Fatura/İrsaliye numarası ile zaten bir teslimat sütunu bulunuyor.');
      return;
   }

   (window as any).tempNewDeliveries.push({
      invoiceNo,
      invoiceDate,
      deliveryDate
   });

   document.getElementById('add-delivery-col-modal')?.remove();
   (window as any).renderPRTableNew();
};

// --- DELETE DELIVERY COLUMN ---
(window as any).deleteDeliveryColumn = (invoiceNo: string) => {
   if (!confirm(`"${invoiceNo}" numaralı fatura/teslimat sütununu ve bu sütuna ait tüm gelen miktarları silmek istediğinizden emin misiniz?`)) return;

   const items = (window as any).editingOrderRequests || [];
   for (const item of items) {
      if (item.deliveries) {
         item.deliveries = item.deliveries.filter((d: any) => d.invoiceNo !== invoiceNo);
         item.arrivedQty = item.deliveries.reduce((sum: number, d: any) => sum + d.quantity, 0);
         item.arrivedProductsTotal = item.arrivedQty * (item.unitPriceInvoice || 0);
         item.openOrderTotal = Math.max(0, item.requestedQty - item.arrivedQty) * (item.unitPriceInvoice || 0);
         
         if (item.arrivedQty >= item.requestedQty && item.requestedQty > 0) {
            item.status = 'COMPLETED';
         } else if (item.arrivedQty > 0) {
            item.status = 'DELIVERED';
         } else {
            item.status = 'ORDERED';
         }
      }
   }

   (window as any).tempNewDeliveries = (window as any).tempNewDeliveries.filter((d: any) => d.invoiceNo !== invoiceNo);
   (window as any).renderPRTableNew();
};

// --- OPEN NEW MATERIAL ROW MODAL ---
(window as any).openAddMaterialRowModal = () => {
   const modalOverlay = document.createElement('div');
   modalOverlay.id = 'add-material-row-modal';
   modalOverlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,0,0,0.6); backdrop-filter: blur(8px);
      z-index: 100000; display: flex; align-items: center; justify-content: center;
   `;

   modalOverlay.innerHTML = `
      <div class="sci-card" style="width: 420px; background: #0b1120; border: 1px solid var(--accent-cyan); padding: 1.5rem; border-radius: 12px; box-shadow: 0 0 25px rgba(0, 243, 255, 0.25);">
         <h4 style="margin: 0 0 1rem 0; color: white; display: flex; align-items: center; gap: 8px;">
            <i class="fa-solid fa-plus" style="color: var(--accent-cyan);"></i> SİPARİŞE YENİ MALZEME KALEMİ EKLE
         </h4>
         
         <div style="display: flex; flex-direction: column; gap: 12px; font-size: 0.8rem; color: white; margin-bottom: 1.5rem;">
            <div>
               <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">SAP KODU / MATERIAL NO</label>
               <input type="text" id="new-row-sapNo" class="sci-input" style="width:100%;" placeholder="örn: 77716" required>
            </div>
            <div>
               <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">MALZEME TANIMI (DESCRIPTION)</label>
               <input type="text" id="new-row-description" class="sci-input" style="width:100%;" placeholder="örn: PCB Controlboard Rectifier V2.1" required>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
               <div>
                  <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">SİPARİŞ ADET</label>
                  <input type="number" id="new-row-requestedQty" class="sci-input" style="width:100%;" value="1" min="1" required>
               </div>
               <div>
                  <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">SANTRAL KISALTMA</label>
                  <input type="text" id="new-row-plantAbbreviation" class="sci-input" style="width:100%;" value="MR-MN" required>
               </div>
            </div>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
               <div>
                  <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">TEKLİF BİRİM FİYAT (€)</label>
                  <input type="number" id="new-row-unitPriceQuote" class="sci-input" style="width:100%;" value="0" min="0" step="any">
               </div>
               <div>
                  <label style="color: rgba(255,255,255,0.4); display:block; margin-bottom:4px;">FATURA BİRİM FİYAT (€)</label>
                  <input type="number" id="new-row-unitPriceInvoice" class="sci-input" style="width:100%;" value="0" min="0" step="any">
               </div>
            </div>
         </div>
         
         <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button onclick="window.submitNewMaterialRow()" class="glow-btn" style="background: rgba(20,241,149,0.15); border-color:#14f195; color:#14f195; font-weight:bold;">EKLE</button>
            <button onclick="document.getElementById('add-material-row-modal').remove()" class="glow-btn">İPTAL</button>
         </div>
      </div>
   `;
   document.body.appendChild(modalOverlay);
};

(window as any).submitNewMaterialRow = () => {
   const sapNo = (document.getElementById('new-row-sapNo') as HTMLInputElement)?.value.trim() || '';
   const description = (document.getElementById('new-row-description') as HTMLInputElement)?.value.trim() || '';
   const requestedQty = parseInt((document.getElementById('new-row-requestedQty') as HTMLInputElement)?.value || '1', 10);
   const plantAbbreviation = (document.getElementById('new-row-plantAbbreviation') as HTMLInputElement)?.value.trim().toUpperCase() || 'MR-MN';
   const unitPriceQuote = parseFloat((document.getElementById('new-row-unitPriceQuote') as HTMLInputElement)?.value || '0');
   const unitPriceInvoice = parseFloat((document.getElementById('new-row-unitPriceInvoice') as HTMLInputElement)?.value || '0');
   
   if (!sapNo || !description) {
      alert('Lütfen SAP Kodu ve Açıklama alanlarını doldurunuz.');
      return;
   }

   const wh = resolveWarehouse(plantAbbreviation);
   const orderNo = (window as any).currentViewingOrderNo;
   
   const newItem: any = {
      sapNo,
      description,
      requestedQty,
      warehouseId: wh.id,
      warehouseName: wh.name,
      status: 'ORDERED',
      plantAbbreviation,
      plantCode: 'W-' + wh.id.replace('W', '0'),
      orderNo,
      unitPriceQuote,
      unitPriceInvoice,
      totalPriceQuote: requestedQty * unitPriceQuote,
      totalPriceInvoice: requestedQty * unitPriceInvoice,
      arrivedQty: 0,
      arrivedProductsTotal: 0,
      openOrderTotal: requestedQty * unitPriceInvoice,
      deliveries: [],
      isNewRow: true
   };

   const currentRequests = (window as any).editingOrderRequests || [];
   if (currentRequests.length > 0) {
      newItem.orderDate = currentRequests[0].orderDate || '';
      newItem.realOwner = currentRequests[0].realOwner || plantAbbreviation;
   } else {
      newItem.orderDate = new Date().toISOString().split('T')[0];
      newItem.realOwner = plantAbbreviation;
   }

   (window as any).editingOrderRequests.push(newItem);
   document.getElementById('add-material-row-modal')?.remove();
   (window as any).renderPRTableNew();
};

// --- SAVE DETAILED ORDER CHANGES ---
(window as any).saveDetailedOrderChanges = async () => {
   const items = (window as any).editingOrderRequests || [];
   if (items.length === 0) return;

   const reflectToStock = (document.getElementById('order-reflectToStock') as HTMLInputElement)?.checked || false;

   const saveBtn = document.getElementById('save-order-btn') as HTMLButtonElement;
   let originalHtml = '';
   if (saveBtn) {
      originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';
   }

   try {
      const { doc, addDoc, collection, serverTimestamp } = await import('firebase/firestore');
      const originalRequests = (window as any).globalPRRequests || [];

      for (const item of items) {
         const requestedQty = item.requestedQty || 0;
         const arrivedQty = item.arrivedQty || 0;
         let status = item.status;
         if (arrivedQty >= requestedQty && requestedQty > 0) {
            status = 'COMPLETED';
         } else if (arrivedQty > 0) {
            status = 'DELIVERED';
         } else {
            status = 'ORDERED';
         }

         const payload: any = {
            sapNo: item.sapNo,
            description: item.description,
            requestedQty,
            warehouseId: item.warehouseId,
            warehouseName: item.warehouseName,
            status,
            plantCode: item.plantCode || '',
            orderDate: item.orderDate || '',
            orderNo: item.orderNo || '',
            plantAbbreviation: item.plantAbbreviation || '',
            realOwner: item.realOwner || '',
            arrivedQty,
            unitPriceQuote: item.unitPriceQuote || 0,
            totalPriceQuote: item.totalPriceQuote || 0,
            unitPriceInvoice: item.unitPriceInvoice || 0,
            totalPriceInvoice: item.totalPriceInvoice || 0,
            logisticCost: item.logisticCost || 0,
            arrivedProductsTotal: item.arrivedProductsTotal || 0,
            openOrderTotal: item.openOrderTotal || 0,
            deliveries: item.deliveries || []
         };

         if (status === 'COMPLETED') {
            payload.completedAt = new Date();
         }

         if (item.id) {
            await purchaseService.updatePurchaseRequestDetails(item.id, payload);
            
            const originalItem = originalRequests.find((r: any) => r.id === item.id);
            const oldArrived = originalItem ? (originalItem.arrivedQty || 0) : 0;
            const diff = arrivedQty - oldArrived;
            if (reflectToStock && diff > 0) {
               await reflectArrivedQtyToInventory(item.warehouseId, item.sapNo, item.description, diff);
            }
         } else {
            payload.requestedBy = (window as any).userProfile?.fullName || 'Sistem';
            payload.requestedAt = serverTimestamp();
            await addDoc(collection(db, 'purchase_requests'), payload);
            
            if (reflectToStock && arrivedQty > 0) {
               await reflectArrivedQtyToInventory(item.warehouseId, item.sapNo, item.description, arrivedQty);
            }
         }
      }

      alert('✅ Sipariş detayları, fiyatlar ve teslimat verileri başarıyla kaydedildi.');
      
      (window as any).currentViewingOrderNo = null;
      (window as any).editingOrderRequests = null;
      (window as any).tempNewDeliveries = [];
      
      (window as any).render({ skipShell: true });
   } catch (err) {
      console.error(err);
      alert('❌ Kaydedilirken hata oluştu: ' + (err as Error).message);
   } finally {
      if (saveBtn) {
         saveBtn.disabled = false;
         saveBtn.innerHTML = originalHtml;
      }
   }
};

// --- VIEW DETAILED ORDER BY NO ---
(window as any).viewOrderNo = (orderNo: string) => {
   if (!orderNo || orderNo === '-') {
      alert('Bu kalemin geçerli bir Sipariş Numarası bulunmuyor.');
      return;
   }
   (window as any).currentViewingOrderNo = orderNo;
   const items = (window as any).globalPRRequests || [];
   const orderItems = items.filter((r: any) => r.orderNo === orderNo);
   (window as any).editingOrderRequests = JSON.parse(JSON.stringify(orderItems));
   (window as any).tempNewDeliveries = [];
   (window as any).renderPRTableNew();
};

// --- TABLE FILTER & RENDER ---
(window as any).filterPRTable = () => {
   (window as any).renderPRTableNew();
};

(window as any).renderPRTableNew = () => {
   const container = document.getElementById('pr-management-container');
   if (!container) return;

   const currentViewingOrderNo = (window as any).currentViewingOrderNo;

   if (currentViewingOrderNo) {
      // --- DETAYLI SİPARİŞ SAYFASI (GÖRSEL 1) ---
      const items = (window as any).editingOrderRequests || [];
      
      const totalSiparisAdet = items.reduce((sum: number, r: any) => sum + (r.requestedQty || 0), 0);
      const totalGelenAdet = items.reduce((sum: number, r: any) => sum + (r.arrivedQty || 0), 0);
      const totalKalanParca = Math.max(0, totalSiparisAdet - totalGelenAdet);
      
      const totalTeklifTutar = items.reduce((sum: number, r: any) => sum + (r.totalPriceQuote || 0), 0);
      const totalFaturaTutar = items.reduce((sum: number, r: any) => sum + (r.totalPriceInvoice || 0), 0);
      const totalLogisticCost = items.reduce((sum: number, r: any) => sum + (r.logisticCost || 0), 0);
      const totalGelenFiyat = items.reduce((sum: number, r: any) => sum + (r.arrivedProductsTotal || 0), 0);
      
      const orderDate = items.length > 0 ? items[0].orderDate || '' : '';

      const uniqueInvoices = new Map<string, { invoiceNo: string, deliveryDate: string, invoiceDate: string }>();
      for (const item of items) {
         if (item.deliveries) {
            for (const del of item.deliveries) {
               uniqueInvoices.set(del.invoiceNo, {
                  invoiceNo: del.invoiceNo,
                  deliveryDate: del.deliveryDate,
                  invoiceDate: del.invoiceDate
               });
            }
         }
      }
      for (const del of ((window as any).tempNewDeliveries || [])) {
         uniqueInvoices.set(del.invoiceNo, del);
      }
      
      const invoiceColumns = Array.from(uniqueInvoices.values());

      let html = `
         <div style="margin-bottom: 1.5rem; display:flex; justify-content: space-between; align-items:center;">
            <button onclick="(window as any).currentViewingOrderNo = null; (window as any).editingOrderRequests = null; (window as any).tempNewDeliveries = []; (window as any).renderPRTableNew();" class="glow-btn" style="padding: 6px 14px; font-size: 0.8rem; background: rgba(255,255,255,0.05); display:inline-flex; align-items:center; gap:6px;">
               <i class="fa-solid fa-arrow-left"></i> GERİ DÖN (TÜMÜ)
            </button>
            <h3 style="margin: 0; color: white; font-size: 1.2rem; font-weight:bold; letter-spacing:1px; display:flex; align-items:center; gap:8px;">
               <i class="fa-solid fa-file-invoice-dollar" style="color: var(--accent-cyan);"></i> SİPARİŞ KART DETAYLARI: <span style="color: var(--accent-cyan); font-family:monospace;">${currentViewingOrderNo}</span>
            </h3>
         </div>

         <!-- METRIC KPI CARDS -->
         <div style="display: grid; grid-template-columns: 3fr 2fr; gap: 1.5rem; margin-bottom: 1.5rem;">
            <div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:12px;">
               <div style="background: rgba(10,15,30,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 14px;">
                  <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:bold; margin-bottom:6px; letter-spacing:1px;">SİPARİŞ TUTARI</div>
                  <div style="display:flex; flex-direction:column; gap:4px; font-family:monospace; font-size:0.8rem;">
                     <div style="display:flex; justify-content:space-between;">
                        <span style="color:rgba(255,255,255,0.6);">Teklif Toplam:</span>
                        <strong style="color:white;">€${totalTeklifTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
                     </div>
                     <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.03); padding-top:4px;">
                        <span style="color:rgba(255,255,255,0.6);">Fatura Toplam:</span>
                        <strong style="color:var(--accent-cyan);">€${totalFaturaTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
                     </div>
                  </div>
               </div>

               <div style="background: rgba(10,15,30,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 14px;">
                  <div style="font-size:0.7rem; color:rgba(255,255,255,0.4); font-weight:bold; margin-bottom:6px; letter-spacing:1px;">LOJİSTİK COST</div>
                  <div style="display:flex; flex-direction:column; gap:4px; font-family:monospace; font-size:0.8rem;">
                     <div style="display:flex; justify-content:space-between;">
                        <span style="color:rgba(255,255,255,0.6);">Teklif Lojistik:</span>
                        <strong style="color:white;">€${totalLogisticCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
                     </div>
                     <div style="display:flex; justify-content:space-between; border-top:1px solid rgba(255,255,255,0.03); padding-top:4px;">
                        <span style="color:rgba(255,255,255,0.6);">Gelen Malz. Toplamı:</span>
                        <strong style="color:var(--accent-green);">€${totalGelenFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
                     </div>
                  </div>
               </div>

               <div style="background: rgba(10,15,30,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 10px 14px; grid-column: span 2; display:grid; grid-template-columns: repeat(3, 1fr); text-align:center;">
                  <div>
                     <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-bottom:4px;">TOPLAM SİPARİŞ</div>
                     <strong style="font-size:1.1rem; color:white; font-family:monospace;">${totalSiparisAdet}</strong>
                  </div>
                  <div style="border-left:1px solid rgba(255,255,255,0.05); border-right:1px solid rgba(255,255,255,0.05);">
                     <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-bottom:4px;">GELEN PARÇA</div>
                     <strong style="font-size:1.1rem; color:var(--accent-green); font-family:monospace;">${totalGelenAdet}</strong>
                  </div>
                  <div>
                     <div style="font-size:0.65rem; color:rgba(255,255,255,0.4); margin-bottom:4px;">KALAN PARÇA</div>
                     <strong style="font-size:1.1rem; color:${totalKalanParca > 0 ? 'var(--accent-amber)' : 'rgba(255,255,255,0.4)'}; font-family:monospace;">${totalKalanParca}</strong>
                  </div>
               </div>
            </div>

            <div style="background: rgba(10,15,30,0.6); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 14px; display:flex; flex-direction:column; gap:12px; justify-content:center;">
               <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                  <span style="font-size:0.8rem; color:rgba(255,255,255,0.6); font-weight:bold;">SİPARİŞ TARİHİ:</span>
                  <input type="date" value="${orderDate}" onchange="window.updateOrderDate(this.value)" class="sci-input" style="width:160px; font-size:0.8rem; height:32px; padding:4px 8px !important;">
               </div>
               <div style="display: flex; align-items: center; gap: 8px; background: rgba(20,241,149,0.05); padding: 8px; border-radius: 6px; border: 1px solid rgba(20,241,149,0.15); margin-top:4px;">
                  <input type="checkbox" id="order-reflectToStock" style="cursor: pointer; width: 16px; height: 16px;" checked>
                  <label for="order-reflectToStock" style="color: #14f195; font-size: 0.75rem; font-weight: bold; cursor: pointer; user-select: none; margin: 0;">
                     YENİ TESLİMATLARI DEPO STOK ENVANTERİNE OTOMATİK AKTAR
                  </label>
               </div>
            </div>
         </div>

         <!-- ACTIONS BAR -->
         <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1rem; flex-wrap:wrap; gap:10px;" class="no-print">
            <div style="display:flex; gap:8px;">
               <button onclick="window.openAddDeliveryModal()" class="glow-btn" style="background: rgba(168,85,247,0.15); border-color: #a855f7; color: #d8b4fe; font-weight:bold; font-size:0.75rem; height:30px; display:inline-flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-truck"></i> Yeni Fatura/Teslimat Ekle
               </button>
               <button onclick="window.openAddMaterialRowModal()" class="glow-btn" style="background: rgba(0,243,255,0.1); border-color: var(--accent-cyan); color: #67e8f9; font-weight:bold; font-size:0.75rem; height:30px; display:inline-flex; align-items:center; gap:6px;">
                  <i class="fa-solid fa-plus"></i> Yeni Malzeme Kalemi Ekle
               </button>
            </div>
            <button id="save-order-btn" onclick="window.saveDetailedOrderChanges()" class="glow-btn" style="background: rgba(20,241,149,0.15); border-color: #14f195; color: #14f195; font-weight:bold; font-size:0.8rem; height:32px; padding: 0 20px; display:inline-flex; align-items:center; gap:8px;">
               <i class="fa-solid fa-floppy-disk"></i> DEĞİŞİKLİKLERİ KAYDET
            </button>
         </div>

         <!-- DETAILED TABLE -->
         <div style="overflow-x: auto; border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; background: rgba(0,0,0,0.15); padding: 8px;">
            <table class="cyber-table" style="min-width: 1300px; border-collapse: collapse;">
               <thead>
                  <tr style="border-bottom: 1px solid rgba(255,255,255,0.1);">
                     <th rowspan="2" style="text-align:center; vertical-align:middle; width:45px;">Kalan</th>
                     <th rowspan="2" style="width:70px; vertical-align:middle;">Santral</th>
                     <th rowspan="2" style="width:90px; vertical-align:middle;">Gerçek Sahibi</th>
                     <th rowspan="2" style="text-align:center; vertical-align:middle; width:60px;">Toplam Gelen</th>
                     <th rowspan="2" style="font-family:monospace; width:70px; vertical-align:middle;">Material no.</th>
                     <th rowspan="2" style="text-align:center; vertical-align:middle; width:65px;">Sipariş Adet</th>
                     <th rowspan="2" style="vertical-align:middle; min-width:200px;">Description</th>
                     <th rowspan="2" style="text-align:right; vertical-align:middle; width:80px;">Teklif B.F (€)</th>
                     <th rowspan="2" style="text-align:right; vertical-align:middle; width:90px;">Sipariş Toplam (€)</th>
                     <th rowspan="2" style="text-align:right; vertical-align:middle; width:80px;">Fatura B.F (€)</th>
                     <th rowspan="2" style="text-align:right; vertical-align:middle; width:90px;">Fatura Fiyat (€)</th>
                     
                     ${invoiceColumns.map(del => {
                        const days = getDaysDifference(orderDate, del.deliveryDate);
                        
                        const colQty = items.reduce((sum: number, r: any) => {
                           const d = r.deliveries?.find((x: any) => x.invoiceNo === del.invoiceNo);
                           return sum + (d ? d.quantity : 0);
                        }, 0);

                        const colCost = items.reduce((sum: number, r: any) => {
                           const d = r.deliveries?.find((x: any) => x.invoiceNo === del.invoiceNo);
                           return sum + ((d ? d.quantity : 0) * (r.unitPriceInvoice || 0));
                        }, 0);

                        return `
                           <th style="border-left: 2px solid rgba(0, 243, 255, 0.2); width:130px; font-size:0.7rem; padding: 4px !important; background: rgba(0,243,255,0.02);">
                              <div style="display:flex; flex-direction:column; gap:2px; font-weight:normal; text-align:left;">
                                 <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <span style="color:rgba(255,255,255,0.4);">fatura tarihi:</span>
                                    <button onclick="window.deleteDeliveryColumn('${del.invoiceNo}')" style="background:transparent; border:none; color:#dc3545; font-size:0.7rem; cursor:pointer;" title="Sütunu Sil"><i class="fa-solid fa-trash-can"></i></button>
                                 </div>
                                 <input type="date" value="${del.invoiceDate}" onchange="window.updateDeliveryHeader('${del.invoiceNo}', 'invoiceDate', this.value)" class="sci-input" style="padding:1px 3px !important; font-size:0.7rem; height:20px; width:100%;">
                                 
                                 <div style="display:flex; justify-content:space-between; margin-top:2px;">
                                    <span style="color:rgba(255,255,255,0.4);">kaç günde geldi:</span>
                                    <strong style="color:white;">${days} gün</strong>
                                 </div>
                                 
                                 <div style="display:flex; justify-content:space-between;">
                                    <span style="color:rgba(255,255,255,0.4);">kalem toplam:</span>
                                    <strong style="color:var(--accent-green);">${colQty}</strong>
                                 </div>

                                 <div style="display:flex; justify-content:space-between;">
                                    <span style="color:rgba(255,255,255,0.4);">fatura tutarı:</span>
                                    <strong style="color:var(--accent-cyan); font-family:monospace;">€${colCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</strong>
                                 </div>

                                 <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                                    <span style="color:rgba(255,255,255,0.4);">delivery tarihi:</span>
                                 </div>
                                 <input type="date" value="${del.deliveryDate}" onchange="window.updateDeliveryHeader('${del.invoiceNo}', 'deliveryDate', this.value)" class="sci-input" style="padding:1px 3px !important; font-size:0.7rem; height:20px; width:100%;">

                                 <div style="font-weight:bold; color:white; font-family:monospace; margin-top:4px; text-align:center; background:rgba(255,255,255,0.05); padding:2px; border-radius:3px;">
                                    ${del.invoiceNo}
                                 </div>
                              </div>
                           </th>
                        `;
                     }).join('')}
                  </tr>
               </thead>
               <tbody>
                  ${items.map((item: any, idx: number) => {
                     const kalan = Math.max(0, (item.requestedQty || 0) - (item.arrivedQty || 0));
                     
                     return `
                        <tr style="border-bottom: 1px solid rgba(255,255,255,0.03); ${item.isNewRow ? 'background: rgba(0,243,255,0.02);' : ''}">
                           <td style="text-align:center; font-weight:bold; color:${kalan > 0 ? 'var(--accent-amber)' : 'rgba(255,255,255,0.3)'};">${kalan}</td>
                           <td style="color:rgba(255,255,255,0.85); font-weight:bold;">${item.plantAbbreviation || '-'}</td>
                           <td>
                              <input type="text" class="sci-input" style="width:100%; font-size:0.75rem; height:24px; padding:2px 4px !important;" value="${item.realOwner || ''}" oninput="(window as any).editingOrderRequests[${idx}].realOwner = this.value">
                           </td>
                           <td style="text-align:center; font-weight:bold; color:var(--accent-green);">${item.arrivedQty || 0}</td>
                           <td style="font-family:monospace; font-size:0.75rem; color:var(--accent-cyan); font-weight:bold;">${item.sapNo}</td>
                           <td style="text-align:center;">
                              <input type="number" class="sci-input" style="width:100%; text-align:center; font-size:0.75rem; height:24px; padding:2px 4px !important;" value="${item.requestedQty}" oninput="(window as any).updateItemRequestQty(${idx}, this.value)">
                           </td>
                           <td style="font-size:0.75rem; font-weight:bold; color:white;" title="${item.description}">${item.description}</td>
                           <td>
                              <input type="number" class="sci-input" style="width:100%; text-align:right; font-size:0.75rem; height:24px; padding:2px 4px !important; font-family:monospace;" value="${item.unitPriceQuote || 0}" step="any" oninput="(window as any).updateItemPrice(${idx}, 'unitPriceQuote', this.value)">
                           </td>
                           <td style="text-align:right; font-family:monospace; font-size:0.75rem; color:rgba(255,255,255,0.85);">€${Number(item.totalPriceQuote || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                           <td>
                              <input type="number" class="sci-input" style="width:100%; text-align:right; font-size:0.75rem; height:24px; padding:2px 4px !important; font-family:monospace;" value="${item.unitPriceInvoice || 0}" step="any" oninput="(window as any).updateItemPrice(${idx}, 'unitPriceInvoice', this.value)">
                           </td>
                           <td style="text-align:right; font-family:monospace; font-size:0.75rem; color:rgba(255,255,255,0.85);">€${Number(item.totalPriceInvoice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                           
                           ${invoiceColumns.map(del => {
                              const d = item.deliveries?.find((x: any) => x.invoiceNo === del.invoiceNo);
                              const qty = d ? d.quantity : 0;
                              return `
                                 <td style="border-left: 2px solid rgba(0, 243, 255, 0.1); text-align:center; padding: 2px !important; background: rgba(0,243,255,0.01);">
                                    <input type="number" class="sci-input" style="width:70px; text-align:center; padding:2px !important; font-size:0.8rem; height:24px; font-weight:bold; color:var(--accent-green);" value="${qty || ''}" min="0" placeholder="0" oninput="window.updateCellQty(${idx}, '${del.invoiceNo}', this.value)">
                                 </td>
                              `;
                           }).join('')}
                        </tr>
                     `;
                  }).join('')}
               </tbody>
            </table>
         </div>
      `;
      container.innerHTML = html;

   } else {
      // --- KONSOLİDE ÖZET SAYFASI (GÖRSEL 2) ---
      const filterStatus = (document.getElementById('pr-filter-status') as HTMLSelectElement)?.value || 'ALL';
      const searchInput = (document.getElementById('pr-table-search') as HTMLInputElement)?.value || '';
      const searchTerm = searchInput.toLowerCase().trim();

      let items = (window as any).globalPRRequests || [];

      if (filterStatus !== 'ALL') {
         items = items.filter((item: any) => item.status === filterStatus);
      }

      if (searchTerm) {
         items = items.filter((item: any) => 
            String(item.sapNo || '').toLowerCase().includes(searchTerm) ||
            String(item.description || '').toLowerCase().includes(searchTerm) ||
            String(item.warehouseName || '').toLowerCase().includes(searchTerm) ||
            String(item.orderNo || '').toLowerCase().includes(searchTerm) ||
            String(item.id || '').toLowerCase().includes(searchTerm)
         );
      }

      const totalSiparisAdet = items.reduce((sum: number, r: any) => sum + (r.requestedQty || 0), 0);
      const totalGelenAdet = items.reduce((sum: number, r: any) => sum + (r.arrivedQty || 0), 0);
      const totalKalanParca = Math.max(0, totalSiparisAdet - totalGelenAdet);
      
      const totalTeklifTutar = items.reduce((sum: number, r: any) => sum + (r.totalPriceQuote || 0), 0);
      const totalFaturaTutar = items.reduce((sum: number, r: any) => sum + (r.totalPriceInvoice || 0), 0);
      const totalLogisticCost = items.reduce((sum: number, r: any) => sum + (r.logisticCost || 0), 0);
      const totalGelenFiyat = items.reduce((sum: number, r: any) => sum + (r.arrivedProductsTotal || 0), 0);
      const totalAcikSiparisFiyat = items.reduce((sum: number, r: any) => sum + (r.openOrderTotal || 0), 0);

      let html = `
         <div class="sci-card" style="margin: 0; padding: 1.25rem; background: rgba(10, 15, 30, 0.4); border: 1px solid rgba(255, 255, 255, 0.05);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.75rem;">
               <h4 style="margin: 0; color: white; font-size: 0.95rem; display: flex; align-items: center; gap: 8px;">
                  <i class="fa-solid fa-list-check" style="color: var(--accent-cyan);"></i> KONSOLİDE SİPARİŞ & KALEM YÖNETİMİ ÖZETİ
               </h4>
               
               <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;" class="no-print">
                   <button onclick="document.getElementById('pr-excel-import-file').click()" class="glow-btn" style="background: rgba(168,85,247,0.15); border-color: #a855f7; padding: 4px 10px; font-size: 0.75rem; height: 28px; display: inline-flex; align-items: center; gap: 6px;" title="Excel'den Sipariş Yükle">
                      <i class="fa-solid fa-file-import"></i> Excel'den Sipariş Yükle
                   </button>
                   <input type="file" id="pr-excel-import-file" style="display: none;" accept=".xlsx, .xls" onchange="window.importPRFromExcel(event)">

                   <button onclick="window.exportPRToExcel()" class="glow-btn" style="background: rgba(40,167,69,0.15); border-color: #28a745; padding: 4px 10px; font-size: 0.75rem; height: 28px; display: inline-flex; align-items: center; gap: 6px;" title="Excel Sipariş Raporu İndir">
                      <i class="fa-solid fa-file-excel"></i> Excel Raporu İndir
                   </button>

                   <select id="pr-filter-status" class="sci-input" style="padding: 4px 8px !important; font-size: 0.75rem; height: 28px; width: 140px;" onchange="window.filterPRTable()">
                      <option value="ALL" ${filterStatus === 'ALL' ? 'selected' : ''}>Tüm Durumlar</option>
                      <option value="PENDING" ${filterStatus === 'PENDING' ? 'selected' : ''}>Onay Bekleyenler (Pending)</option>
                      <option value="APPROVED" ${filterStatus === 'APPROVED' ? 'selected' : ''}>Onaylanan / Fiyatlanan</option>
                      <option value="ORDERED" ${filterStatus === 'ORDERED' ? 'selected' : ''}>Siparişi Geçilenler</option>
                      <option value="DELIVERED" ${filterStatus === 'DELIVERED' ? 'selected' : ''}>İrsaliyeli Girişler</option>
                      <option value="INVOICED" ${filterStatus === 'INVOICED' ? 'selected' : ''}>Faturası Girilenler</option>
                      <option value="COMPLETED" ${filterStatus === 'COMPLETED' ? 'selected' : ''}>Tamamlananlar (Stokta)</option>
                      <option value="REJECTED" ${filterStatus === 'REJECTED' ? 'selected' : ''}>Reddedilenler</option>
                   </select>
                   
                   <input type="text" id="pr-table-search" class="sci-input" placeholder="Taleplerde ara (Sipariş, SAP, Malzeme)..." style="padding: 4px 8px !important; font-size: 0.75rem; height: 28px; width: 220px;" value="${searchInput}" oninput="window.filterPRTable()">
                </div>
            </div>

            <div style="background: rgba(0, 243, 255, 0.03); border: 1px solid rgba(0, 243, 255, 0.1); border-radius: 8px; padding: 12px; margin-bottom: 1rem; display:grid; grid-template-columns: repeat(4, 1fr); gap: 10px; font-family: monospace; font-size: 0.75rem; color: white;">
               <div>
                  <span style="color: rgba(255,255,255,0.4);">Sipariş Adet / Gelen:</span>
                  <strong>${totalSiparisAdet} adet / <span style="color:var(--accent-green);">${totalGelenAdet}</span></strong>
               </div>
               <div>
                  <span style="color: rgba(255,255,255,0.4);">Kalan Parça Toplamı:</span>
                  <strong style="color: var(--accent-amber);">${totalKalanParca} adet</strong>
               </div>
               <div>
                  <span style="color: rgba(255,255,255,0.4);">Teklif / Fatura Toplam:</span>
                  <strong>€${totalTeklifTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} / <span style="color: var(--accent-cyan);">€${totalFaturaTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></strong>
               </div>
               <div>
                  <span style="color: rgba(255,255,255,0.4);">Gelen Ürün / Açık Sipariş:</span>
                  <strong><span style="color: var(--accent-green);">€${totalGelenFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span> / <span style="color: var(--accent-amber);">€${totalAcikSiparisFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</span></strong>
               </div>
            </div>

            <div style="overflow-x: auto;">
               <table class="cyber-table">
                  <thead>
                     <tr>
                        <th>Sipr No</th>
                        <th>Santral Kodu</th>
                        <th>Sipariş Tarihi</th>
                        <th>Order No</th>
                        <th style="text-align: center;">Kalan Parça</th>
                        <th>Santral Kısaltma</th>
                        <th>Sahibi</th>
                        <th style="text-align: center;">Gelen</th>
                        <th style="font-family:monospace;">Material no.</th>
                        <th style="text-align: center;">Sipariş Adet</th>
                        <th>Description</th>
                        <th style="text-align: right;">Teklif B.F (€)</th>
                        <th style="text-align: right;">Teklif Toplam (€)</th>
                        <th style="text-align: right;">Fatura B.F (€)</th>
                        <th style="text-align: right;">Fatura Toplam (€)</th>
                        <th style="text-align: right;">Lojistik Cost (€)</th>
                        <th style="text-align: right;">Gelen Ürün Fiyat (€)</th>
                        <th style="text-align: right;">Açık Sipariş Fiyat (€)</th>
                        <th class="no-print">İşlem</th>
                     </tr>
                  </thead>
                  <tbody>
                     <tr style="background: rgba(255, 255, 255, 0.05); font-weight: bold; border-bottom: 2px solid rgba(255,255,255,0.1); font-size:0.75rem;">
                        <td colspan="4" style="color:var(--accent-cyan); text-align:left;">GENEL TOPLAM</td>
                        <td style="text-align: center; color: var(--accent-amber);">${totalKalanParca}</td>
                        <td colspan="2"></td>
                        <td style="text-align: center; color: var(--accent-green);">${totalGelenAdet}</td>
                        <td></td>
                        <td style="text-align: center;">${totalSiparisAdet}</td>
                        <td></td>
                        <td></td>
                        <td style="text-align: right; font-family:monospace;">€${totalTeklifTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td></td>
                        <td style="text-align: right; font-family:monospace;">€${totalFaturaTutar.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: right; font-family:monospace;">€${totalLogisticCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: right; font-family:monospace; color:var(--accent-green);">€${totalGelenFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td style="text-align: right; font-family:monospace; color:var(--accent-amber);">€${totalAcikSiparisFiyat.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                        <td class="no-print"></td>
                     </tr>
                     
                     ${items.map((item: any, idx: number) => {
                        const dateVal = item.requestedAt?.toDate ? item.requestedAt.toDate() : (item.requestedAt ? new Date(item.requestedAt) : null);
                        const dateStr = dateVal ? dateVal.toLocaleDateString('tr-TR') : '-';
                        const kalan = Math.max(0, (item.requestedQty || 0) - (item.arrivedQty || 0));
                        
                        return `
                           <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.6);">${idx + 1}</td>
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.65);">${item.plantCode || '-'}</td>
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.65);">${item.orderDate || dateStr}</td>
                              <td>
                                 <button onclick="window.viewOrderNo('${item.orderNo || ''}')" class="glow-btn" style="padding:2px 6px; font-size:0.75rem; font-family:monospace; font-weight:bold; color:var(--accent-cyan); background:rgba(0,243,255,0.05); border-color:rgba(0,243,255,0.25);" title="Sipariş Kartına Git">
                                    ${item.orderNo || 'KART AÇ'}
                                 </button>
                              </td>
                              <td style="text-align: center; font-size: 0.8rem; font-weight: bold; color: ${kalan > 0 ? 'var(--accent-amber)' : 'rgba(255,255,255,0.4)'};">${kalan}</td>
                              <td style="font-size:0.75rem; font-weight:bold; color:white;">${item.plantAbbreviation || '-'}</td>
                              <td style="font-size:0.75rem; color:rgba(255,255,255,0.6);">${item.realOwner || '---'}</td>
                              <td style="text-align: center; font-size: 0.8rem; font-weight: bold; color: var(--accent-green);">${item.arrivedQty || 0}</td>
                              <td style="font-family: monospace; font-size:0.75rem; color:var(--accent-cyan); font-weight:bold;">${item.sapNo}</td>
                              <td style="text-align: center; font-size: 0.8rem; font-weight: bold; color: white;">${item.requestedQty}</td>
                              <td>
                                 <div style="font-weight: bold; color: white; font-size: 0.8rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 220px;" title="${item.description}">${item.description}</div>
                              </td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace;">€${Number(item.unitPriceQuote || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace;">€${Number(item.totalPriceQuote || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace;">€${Number(item.unitPriceInvoice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace;">€${Number(item.totalPriceInvoice || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace;">€${Number(item.logisticCost || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace; color:var(--accent-green);">€${Number(item.arrivedProductsTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td style="text-align: right; font-size:0.75rem; font-family:monospace; color:var(--accent-amber);">€${Number(item.openOrderTotal || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2 })}</td>
                              <td class="no-print">
                                 <div style="display:flex; gap:4px;">
                                    <button onclick="window.showPRDetailsModal('${item.id}')" class="glow-btn" style="background: rgba(0,243,255,0.1); border-color: var(--accent-cyan); padding: 2px 6px; font-size: 0.65rem;" title="Sipariş Kalemini İncele"><i class="fa-solid fa-eye"></i> İNCELE</button>
                                    ${item.status === 'PENDING' ? `
                                       <button onclick="window.deletePRRequest('${item.id}')" class="glow-btn" style="background: rgba(220,53,69,0.15); border-color: #dc3545; padding: 2px 6px; font-size: 0.65rem; color: #dc3545;" title="Siparişi Sil/İptal Et"><i class="fa-solid fa-trash-can"></i> İPTAL</button>
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
      container.innerHTML = html;
   }
};

// --- CANCEL/DELETE PR REQUEST ---
(window as any).deletePRRequest = async (id: string) => {
   if (!confirm('Bu satın alma talebini iptal etmek/silmek istediğinizden emin misiniz?')) return;
   try {
      const { deleteDoc, doc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'purchase_requests', id));
      alert('✅ Satın alma talebi başarıyla iptal edildi.');
      (window as any).render({ skipShell: true });
   } catch (err) {
      console.error(err);
      alert('❌ Hata oluştu: ' + (err as Error).message);
   }
};

// --- DETAILS MODAL DIALOG ---
(window as any).showPRDetailsModal = (id: string) => {
   const item = ((window as any).globalPRRequests || []).find((r: any) => r.id === id);
   if (!item) return;

   // Create modal overlay element
   const modalOverlay = document.createElement('div');
   modalOverlay.id = 'pr-details-modal';
   modalOverlay.style.position = 'fixed';
   modalOverlay.style.top = '0';
   modalOverlay.style.left = '0';
   modalOverlay.style.width = '100vw';
   modalOverlay.style.height = '100vh';
   modalOverlay.style.background = 'rgba(0,0,0,0.7)';
   modalOverlay.style.backdropFilter = 'blur(10px)';
   modalOverlay.style.display = 'flex';
   modalOverlay.style.alignItems = 'center';
   modalOverlay.style.justifyContent = 'center';
   modalOverlay.style.zIndex = '99999';

   const dateVal = item.requestedAt?.toDate ? item.requestedAt.toDate() : (item.requestedAt ? new Date(item.requestedAt) : null);
   const dateStr = dateVal ? dateVal.toLocaleString('tr-TR') : '-';

   const targetDateVal = item.targetDeliveryDate ? new Date(item.targetDeliveryDate) : null;
   const targetDateStr = targetDateVal ? targetDateVal.toLocaleDateString('tr-TR') : 'Belirtilmedi';

   const estPriceStr = item.estimatedCost ? `${item.estimatedCost.toLocaleString('tr-TR')} ${item.currency || 'TRY'}` : 'Girilmedi';

   // Attachments HTML
   let attachmentsHtml = '<div style="color: rgba(255,255,255,0.4); font-size:0.75rem;">Ekli belge bulunmuyor.</div>';
   if (item.attachments && item.attachments.length > 0) {
      attachmentsHtml = item.attachments.map((file: any) => {
         const isImg = file.type.includes('image');
         const downloadLink = file.base64 ? `
            <a href="${file.base64}" download="${file.name}" style="color: var(--accent-cyan); text-decoration: none; display: flex; align-items: center; gap: 6px; font-weight: bold; background: rgba(0,243,255,0.1); border: 1px solid var(--accent-cyan); padding: 4px 8px; border-radius: 4px;">
               <i class="fa-solid fa-download"></i> İndir
            </a>` : '';
         
         const previewHtml = isImg && file.base64 ? `
            <div style="margin-top: 6px; max-width: 100%; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden;">
               <img src="${file.base64}" style="max-height: 120px; object-fit: contain; max-width: 100%; display: block;" />
            </div>` : '';

         return `
            <div style="display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-radius: 6px; padding: 8px 12px; font-size: 0.75rem;">
               <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 70%;">
                     <i class="${file.type.includes('pdf') ? 'fa-solid fa-file-pdf' : 'fa-solid fa-image'}" style="color: var(--accent-cyan); font-size: 1.1rem;"></i>
                     <strong>${file.name}</strong>
                  </div>
                  ${downloadLink}
               </div>
               ${previewHtml}
            </div>
         `;
      }).join('<div style="height: 6px;"></div>');
   }

   modalOverlay.innerHTML = `
      <div class="sci-card" style="width: 700px; max-width: 95%; background: #0b1120; border: 1px solid var(--accent-cyan); padding: 1.5rem; border-radius: 12px; box-shadow: 0 0 25px rgba(0, 243, 255, 0.25); display: flex; flex-direction: column; max-height: 90vh;">
         <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 8px; margin-bottom: 12px; flex-shrink: 0;">
            <h4 style="margin: 0; color: white; font-size: 1.1rem; display: flex; align-items: center; gap: 8px;">
               <i class="fa-solid fa-circle-info" style="color: var(--accent-cyan);"></i> SİPARİŞ TALEBİ DETAYLARI & TAKİBİ
            </h4>
            <button onclick="document.getElementById('pr-details-modal').remove()" style="background:transparent; border:none; color:white; font-size: 1.25rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
         </div>

         <div style="overflow-y: auto; padding-right: 8px; flex-grow: 1;">
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; font-size: 0.8rem; margin-bottom: 16px;">
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">TALEP NO</div>
                  <div style="font-family: monospace; font-weight: bold; color: var(--accent-cyan);">${item.id ? item.id.toUpperCase() : '-'}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">MEVCUT DURUM</div>
                  <div><span style="font-weight: bold; color: ${item.status === 'PENDING' ? '#ffc107' : item.status === 'REJECTED' ? '#dc3545' : '#14f195'};">${item.status}</span></div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">SAP KODU</div>
                  <div style="font-family: monospace; font-weight: bold; color: white;">${item.sapNo}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">MALZEME TANIMI</div>
                  <div style="font-weight: bold; color: white;">${item.description}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">İSTENEN MİKTAR</div>
                  <div style="font-weight: bold; color: var(--accent-cyan);">${item.requestedQty} ${item.unit || 'Adet'}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">HEDEF DEPO</div>
                  <div style="font-weight: bold; color: white;">${item.warehouseName}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">ACİLİYET SEVİYESİ</div>
                  <div style="font-weight: bold; color: white;">${item.urgency || 'Orta'}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">HEDEF TESLİM TARİHİ</div>
                  <div style="font-weight: bold; color: white;">${targetDateStr}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">TALEP EDEN</div>
                  <div style="font-weight: bold; color: white;">${item.requestedBy}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">TALEP TARİHİ</div>
                  <div style="font-weight: bold; color: white;">${dateStr}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">MASRAF YERİ / PROJE</div>
                  <div style="font-weight: bold; color: white;">${item.costCenter || 'Girilmedi'}</div>
               </div>
               <div>
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">ÖNERİLEN TEDARİKÇİ</div>
                  <div style="font-weight: bold; color: white;">${item.suggestedSupplier || 'Girilmedi'}</div>
               </div>
               <div style="grid-column: span 2;">
                  <div style="color:rgba(255,255,255,0.4); margin-bottom: 2px;">TALEP GEREKÇESİ / NOT</div>
                  <div style="font-weight: bold; color: white; background: rgba(255,255,255,0.02); padding: 6px; border-radius: 4px; min-height: 38px;">${item.notes || '-'}</div>
               </div>

               <!-- EDITABLE ORDER DETAILS SECTION -->
               <div style="grid-column: span 2; margin-top: 8px; padding-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); color: var(--accent-cyan); font-weight: bold; font-size: 0.85rem; display: flex; align-items: center; gap: 6px;">
                  <i class="fa-solid fa-pen-to-square"></i> SİPARİŞ & GİRİŞ BİLGİLERİ (GÜNCELLEME)
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">SİPARİŞ NO (ORDER NO)</label>
                  <input type="text" id="modal-pr-orderNo" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.orderNo || ''}">
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">SİPARİŞİN GERÇEK SAHİBİ</label>
                  <input type="text" id="modal-pr-realOwner" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.realOwner || ''}">
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">GELEN ADET (Mevcut: ${item.arrivedQty || 0} / Sipariş: ${item.requestedQty})</label>
                  <input type="number" id="modal-pr-arrivedQty" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.arrivedQty || 0}" min="0">
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">LOJİSTİK MALİYET (€)</label>
                  <input type="number" id="modal-pr-logisticCost" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.logisticCost || 0}" min="0" step="any">
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">TEKLİF BİRİM FİYAT (€)</label>
                  <input type="number" id="modal-pr-unitPriceQuote" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.unitPriceQuote || 0}" min="0" step="any">
               </div>

               <div>
                  <label style="color:rgba(255,255,255,0.4); margin-bottom: 4px; display:block;">FATURA BİRİM FİYAT (€)</label>
                  <input type="number" id="modal-pr-unitPriceInvoice" class="sci-input" style="width: 100%; font-size: 0.8rem; height: 32px; padding: 4px 8px !important;" value="${item.unitPriceInvoice || 0}" min="0" step="any">
               </div>

               <!-- Option to reflect arrived qty directly into stock inventory -->
               <div style="grid-column: span 2; display: flex; align-items: center; gap: 8px; margin-top: 8px; background: rgba(20,241,149,0.05); padding: 8px; border-radius: 6px; border: 1px solid rgba(20,241,149,0.15);">
                  <input type="checkbox" id="modal-pr-reflectToStock" style="cursor: pointer; width: 16px; height: 16px;">
                  <label for="modal-pr-reflectToStock" style="color: #14f195; font-size: 0.75rem; font-weight: bold; cursor: pointer; user-select: none;">
                     YENİ GELEN MİKTARI DEPO STOK ENVANTERİNE OTOMATİK YANSIT
                  </label>
               </div>
            </div>

            <div style="border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; margin-bottom: 12px;">
               <div style="color:rgba(255,255,255,0.4); font-size: 0.75rem; margin-bottom: 6px; font-weight: bold; text-transform: uppercase;">EK BELGELER</div>
               <div style="max-height: 120px; overflow-y: auto;">
                  ${attachmentsHtml}
               </div>
            </div>
         </div>

         <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 12px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 12px; flex-shrink: 0;">
            <button onclick="window.savePRDetailChanges('${item.id}')" class="glow-btn" style="background: rgba(20,241,149,0.15); border-color: #14f195; padding: 6px 20px; font-size: 0.75rem; color: #14f195; font-weight: bold;"><i class="fa-solid fa-floppy-disk"></i> KAYDET</button>
            <button onclick="document.getElementById('pr-details-modal').remove()" class="glow-btn" style="padding: 6px 20px; font-size: 0.75rem;">KAPAT</button>
         </div>
      </div>
   `;
   document.body.appendChild(modalOverlay);
};

// --- WAREHOUSE ABBREVIATION MAPPING DICTIONARY ---
const abbrMap: Record<string, { id: string, name: string }> = {
  'MR-MN': { id: '2678', name: 'Mare Manastır Depo' },
  'AN-IP': { id: '2688', name: 'Anemon İntepe Depo' },
  'AL-SK': { id: '3439', name: 'Alize Sarıkaya Depo' },
  'AL-CS': { id: '3243', name: 'Alize Çamseki Depo' },
  'AL-GM': { id: '0752', name: 'Alize Germiyan Depo' },
  'DG-SY': { id: '2990', name: 'Doğal Sayalar Depo' },
  'DR-DC': { id: '3213', name: 'Dares Datça Depo' },
  'AL-KT': { id: '3245', name: 'Alize Keltepe Depo' },
  'AL-KY': { id: '3793', name: 'Alize Kuyucak Depo' },
  'AL-CT': { id: '3892', name: 'Alize Çataltape Depo' },
  'MTA':   { id: 'MTA', name: 'Merkez Tamir Atölyesi Deposu' }
};

// --- DATE PARSING UTILITY ---
function parseExcelDate(val: any): string {
  if (!val) return '';
  if (typeof val === 'number') {
    const date = new Date((val - (val > 60 ? 25569 : 25568)) * 86400 * 1000);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${d}.${m}.${y}`;
  }
  
  const str = String(val).trim();
  let match = str.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (match) {
    const d = match[1].padStart(2, '0');
    const m = match[2].padStart(2, '0');
    const y = match[3];
    return `${d}.${m}.${y}`;
  }
  
  match = str.match(/^(\d{4})[./-](\d{1,2})[./-](\d{1,2})$/);
  if (match) {
    const y = match[1];
    const m = match[2].padStart(2, '0');
    const d = match[3].padStart(2, '0');
    return `${d}.${m}.${y}`;
  }
  
  return str;
}

// --- NUMBER PARSING UTILITY ---
function cleanNumber(val: any): number {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  let str = String(val).trim();
  str = str.replace(/[^\d.,-]/g, '');
  if (!str) return 0;
  
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    const commaIndex = str.indexOf(',');
    const dotIndex = str.indexOf('.');
    if (commaIndex > dotIndex) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    str = str.replace(',', '.');
  } else if (hasDot) {
    const parts = str.split('.');
    if (parts.length === 2 && parts[1].length === 3) {
      str = str.replace(/\./g, '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// --- RESOLVE WAREHOUSE FROM ABBREVIATION ---
function resolveWarehouse(abbr: string): { id: string, name: string } {
  if (!abbr) return { id: 'MTA', name: 'Merkez Tamir Atölyesi Deposu' };
  const cleanAbbr = String(abbr).trim().toUpperCase();
  
  if (abbrMap[cleanAbbr]) {
    return abbrMap[cleanAbbr];
  }
  
  for (const [key, wh] of Object.entries(abbrMap)) {
    if (cleanAbbr.includes(key) || key.includes(cleanAbbr)) {
      return wh;
    }
  }
  
  for (const wh of Object.values(abbrMap)) {
    const cleanName = wh.name.toUpperCase();
    if (cleanName.includes(cleanAbbr) || cleanAbbr.includes(cleanName)) {
      return wh;
    }
  }
  
  return { id: 'MTA', name: 'Merkez Tamir Atölyesi Deposu' };
}

// --- REFLECT TO STOK METHOD ---
async function reflectArrivedQtyToInventory(warehouseId: string, sapNo: string, description: string, qtyToAdd: number) {
  if (qtyToAdd <= 0) return;
  const resolvedWarehouseId = warehouseService.resolveWarehouseId(warehouseId);
  
  try {
     const inventory = await warehouseService.getInventory(resolvedWarehouseId, true);
     const existingItem = inventory.find(item => 
       String(item.sapNo || '').trim().toLowerCase() === String(sapNo || '').trim().toLowerCase()
     );
     
     if (existingItem) {
       const newQty = (existingItem.quantity || 0) + qtyToAdd;
       await warehouseService.updateMaterial(resolvedWarehouseId, existingItem.id!, { quantity: newQty });
       await warehouseService.addLog(resolvedWarehouseId, {
         itemId: existingItem.id!,
         materialName: description,
         sapNo,
         type: 'ADD',
         quantity: qtyToAdd,
         user: authService.getCurrentUser()?.email || 'Sistem',
         source: 'PR_IMPORT'
       });
     } else {
       const newItem = await warehouseService.addMaterial(resolvedWarehouseId, {
         sapNo,
         description,
         quantity: qtyToAdd,
         shelfNo: ''
       });
       await warehouseService.addLog(resolvedWarehouseId, {
         itemId: newItem.id,
         materialName: description,
         sapNo,
         type: 'ADD',
         quantity: qtyToAdd,
         user: authService.getCurrentUser()?.email || 'Sistem',
         source: 'PR_IMPORT'
       });
     }
  } catch (err) {
     console.error('[reflectArrivedQtyToInventory] Error reflecting to inventory:', err);
  }
}

// --- SAVE PR DETAIL CHANGES ---
(window as any).savePRDetailChanges = async (id: string) => {
   const orderNo = (document.getElementById('modal-pr-orderNo') as HTMLInputElement)?.value || '';
   const realOwner = (document.getElementById('modal-pr-realOwner') as HTMLInputElement)?.value || '';
   const arrivedQty = parseInt((document.getElementById('modal-pr-arrivedQty') as HTMLInputElement)?.value || '0', 10);
   const logisticCost = parseFloat((document.getElementById('modal-pr-logisticCost') as HTMLInputElement)?.value || '0');
   const unitPriceQuote = parseFloat((document.getElementById('modal-pr-unitPriceQuote') as HTMLInputElement)?.value || '0');
   const unitPriceInvoice = parseFloat((document.getElementById('modal-pr-unitPriceInvoice') as HTMLInputElement)?.value || '0');
   const reflectToStock = (document.getElementById('modal-pr-reflectToStock') as HTMLInputElement)?.checked || false;

   const item = ((window as any).globalPRRequests || []).find((r: any) => r.id === id);
   if (!item) {
      alert('Sipariş talebi bulunamadı!');
      return;
   }

   const requestedQty = item.requestedQty || 0;
   
   // Auto-Status Heuristics
   let status = item.status;
   if (arrivedQty >= requestedQty && requestedQty > 0) {
      status = 'COMPLETED';
   } else if (arrivedQty > 0) {
      status = 'DELIVERED';
   } else {
      if (orderNo) {
         status = 'ORDERED';
      }
   }

   const saveBtn = document.querySelector('#pr-details-modal button[onclick*="savePRDetailChanges"]') as HTMLButtonElement;
   let originalHtml = '';
   if (saveBtn) {
      originalHtml = saveBtn.innerHTML;
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> KAYDEDİLİYOR...';
   }

   try {
      const totalPriceQuote = requestedQty * unitPriceQuote;
      const totalPriceInvoice = requestedQty * unitPriceInvoice;
      const arrivedProductsTotal = arrivedQty * unitPriceInvoice;
      const openOrderTotal = Math.max(0, requestedQty - arrivedQty) * unitPriceInvoice;

      const updates: any = {
         orderNo,
         realOwner,
         arrivedQty,
         logisticCost,
         unitPriceQuote,
         totalPriceQuote,
         unitPriceInvoice,
         totalPriceInvoice,
         arrivedProductsTotal,
         openOrderTotal,
         status
      };

      if (status === 'COMPLETED' && item.status !== 'COMPLETED') {
         updates.completedAt = new Date();
      }

      await purchaseService.updatePurchaseRequestDetails(id, updates);

      const oldArrivedQty = item.arrivedQty || 0;
      const qtyDiff = arrivedQty - oldArrivedQty;

      if (reflectToStock && qtyDiff > 0) {
         let whId = item.warehouseId;
         if (!whId && item.plantAbbreviation) {
            const wh = resolveWarehouse(item.plantAbbreviation);
            whId = wh.id;
         }
         if (!whId) {
            whId = 'MTA';
         }
         await reflectArrivedQtyToInventory(whId, item.sapNo, item.description, qtyDiff);
      }

      alert('✅ Sipariş detayları başarıyla kaydedildi.');
      document.getElementById('pr-details-modal')?.remove();
      (window as any).render({ skipShell: true });
   } catch (err) {
      console.error(err);
      alert('❌ Hata oluştu: ' + (err as Error).message);
   } finally {
      if (saveBtn) {
         saveBtn.disabled = false;
         saveBtn.innerHTML = originalHtml;
      }
   }
};

// --- HEADER DETECTION FOR CUSTOM EXCEL SHEETS ---
function findHeaderRow(sheet: any): number {
  const range = { s: { c: 0, r: 0 }, e: { c: 20, r: 15 } };
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, range });
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];
    if (row) {
      const hasSap = row.some(cell => String(cell || '').toLowerCase().includes('material no') || String(cell || '').toLowerCase().includes('sap kodu') || String(cell || '').toLowerCase().includes('sap no'));
      const hasDesc = row.some(cell => String(cell || '').toLowerCase().includes('description') || String(cell || '').toLowerCase().includes('malzeme tanımı') || String(cell || '').toLowerCase().includes('açıklama'));
      if (hasSap && hasDesc) {
        return r;
      }
    }
  }
  return 0;
}

// --- IMPORT PR FROM EXCEL ---
(window as any).importPRFromExcel = async (event: Event) => {
   const input = event.target as HTMLInputElement;
   if (!input.files || input.files.length === 0) return;

   const file = input.files[0];
   const overlay = document.createElement('div');
   overlay.style.cssText = `
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(0,8,20,0.85); backdrop-filter: blur(10px);
      z-index: 100000; display: flex; flex-direction: column;
      align-items: center; justify-content: center; color: white; font-family: sans-serif;
   `;
   overlay.innerHTML = `
      <div class="sci-card" style="width: 400px; text-align: center; padding: 2rem; border: 1px solid var(--accent-cyan); background: #0b1120; border-radius: 12px;">
         <i class="fa-solid fa-file-excel fa-bounce" style="font-size: 3rem; color: #28a745; margin-bottom: 1.5rem;"></i>
         <h4 style="margin: 0 0 10px 0; color: white; letter-spacing: 1px;">EXCEL İTHAL EDİLİYOR</h4>
         <div id="pr-import-status" style="font-size: 0.85rem; color: rgba(255,255,255,0.6); margin-bottom: 10px;">Dosya okunuyor...</div>
         <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.1); border-radius: 3px; overflow: hidden; margin-top: 15px;">
            <div id="pr-import-progress" style="width: 0%; height: 100%; background: var(--accent-cyan); transition: width 0.1s;"></div>
         </div>
      </div>
   `;
   document.body.appendChild(overlay);

   try {
      const XLSX = await import('xlsx');
      const reader = new FileReader();

      reader.onload = async (e) => {
         try {
            const data = new Uint8Array(e.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            
            if (workbook.SheetNames.length === 0) {
               throw new Error('Excel dosyasında çalışma sayfası bulunamadı.');
            }

            const sheetName = workbook.SheetNames[0];
            const sheet = workbook.Sheets[sheetName];
            
            const allRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
            const headerRow = findHeaderRow(sheet);
            const headerCells = allRows[headerRow] || [];
            
            const getColIdx = (candidates: string[]) => {
               for (const cand of candidates) {
                  const idx = headerCells.findIndex(cell => 
                     String(cell || '').toLowerCase().trim().replace(/\s+/g, ' ').includes(cand.toLowerCase())
                  );
                  if (idx !== -1) return idx;
               }
               return -1;
            };

            const plantCodeCol = getColIdx(['santral kodu', 'plant code']);
            const orderDateCol = getColIdx(['sipariş tarihi', 'siparis tarihi', 'order date', 'tarih']);
            const orderNoCol = getColIdx(['order no', 'sipariş no', 'siparis no', 'sipariş numarası']);
            const sapNoCol = getColIdx(['material no', 'sap no', 'sap kodu', 'malzeme no']);
            const requestedQtyCol = getColIdx(['sipariş adet', 'sipariş miktarı', 'siparis adet', 'sipariş', 'requested qty']);
            const arrivedQtyCol = getColIdx(['gelen adet', 'gelen miktar', 'gelen']);
            const descriptionCol = getColIdx(['description', 'malzeme tanımı', 'malzeme tanimi', 'açıklama', 'aciklama']);
            const unitPriceQuoteCol = getColIdx(['teklif birim fiyat', 'teklif birim', 'teklif fiyat', 'teklif b.f.']);
            const unitPriceInvoiceCol = getColIdx(['fatura birim fiyat', 'fatura birim', 'fatura fiyat', 'fatura b.f.']);
            const logisticCostCol = getColIdx(['logistic cost', 'lojistik maliyet', 'lojistik']);
            const plantAbbreviationCol = getColIdx(['santral kısaltma', 'santral kisaltma', 'kısaltma', 'kisaltma']);
            const realOwnerCol = getColIdx(['siparişin gerçek sahibi', 'siparisin gercek sahibi', 'gerçek sahibi', 'real owner']);

            // Parse delivery columns metadata if headerRow > 0
            let invoiceCols: { colIndex: number, invoiceNo: string, invoiceDate: string, deliveryDate: string }[] = [];
            if (headerRow > 0) {
               for (let c = 10; c < headerCells.length; c++) {
                  const invoiceDateRaw = allRows[0]?.[c];
                  const deliveryDateRaw = allRows[4]?.[c];
                  const invoiceNoRaw = allRows[5]?.[c] || allRows[6]?.[c];
                  
                  if (invoiceNoRaw && String(invoiceNoRaw).trim() !== '') {
                     invoiceCols.push({
                        colIndex: c,
                        invoiceNo: String(invoiceNoRaw).trim(),
                        invoiceDate: parseExcelDate(invoiceDateRaw) || new Date().toISOString().split('T')[0],
                        deliveryDate: parseExcelDate(deliveryDateRaw) || new Date().toISOString().split('T')[0]
                     });
                  }
               }
            }

            document.getElementById('pr-import-status')!.textContent = `Toplam ${allRows.length - headerRow - 1} satır işleniyor...`;
            
            const existingRequests = (window as any).globalPRRequests || [];
            let addedCount = 0;
            let updatedCount = 0;

            const { addDoc, collection, serverTimestamp } = await import('firebase/firestore');

            for (let r = headerRow + 1; r < allRows.length; r++) {
               const row = allRows[r];
               if (!row || row.length === 0) continue;

               const getVal = (colIdx: number) => colIdx !== -1 ? row[colIdx] : undefined;

               const sapNo = String(getVal(sapNoCol) || '').trim();
               const description = String(getVal(descriptionCol) || '').trim();
               
               if (!sapNo && !description) continue;

               const plantCode = String(getVal(plantCodeCol) || '').trim();
               const orderDateRaw = getVal(orderDateCol);
               const orderDate = parseExcelDate(orderDateRaw);
               const orderNo = String(getVal(orderNoCol) || '').trim();
               const requestedQty = cleanNumber(getVal(requestedQtyCol));
               const arrivedQtyVal = cleanNumber(getVal(arrivedQtyCol));
               const unitPriceQuote = cleanNumber(getVal(unitPriceQuoteCol));
               const unitPriceInvoice = cleanNumber(getVal(unitPriceInvoiceCol));
               const logisticCost = cleanNumber(getVal(logisticCostCol));
               const plantAbbreviation = String(getVal(plantAbbreviationCol) || '').trim();
               const realOwner = String(getVal(realOwnerCol) || '').trim();

               // Parse deliveries for this row from the delivery columns
               const deliveries: any[] = [];
               let computedArrivedQty = 0;
               for (const col of invoiceCols) {
                  const qty = cleanNumber(row[col.colIndex]);
                  if (qty > 0) {
                     deliveries.push({
                        invoiceNo: col.invoiceNo,
                        invoiceDate: col.invoiceDate,
                        deliveryDate: col.deliveryDate,
                        quantity: qty
                     });
                     computedArrivedQty += qty;
                  }
               }

               const arrivedQty = invoiceCols.length > 0 ? computedArrivedQty : arrivedQtyVal;

               const wh = resolveWarehouse(plantAbbreviation);

               let status: 'ORDERED' | 'DELIVERED' | 'COMPLETED' = 'ORDERED';
               if (arrivedQty >= requestedQty && requestedQty > 0) {
                  status = 'COMPLETED';
               } else if (arrivedQty > 0) {
                  status = 'DELIVERED';
               }

               const existing = existingRequests.find((x: any) => 
                  x.orderNo && x.sapNo && 
                  String(x.orderNo).trim().toLowerCase() === orderNo.toLowerCase() && 
                  String(x.sapNo).trim().toLowerCase() === sapNo.toLowerCase()
               );

               const totalPriceQuote = requestedQty * unitPriceQuote;
               const totalPriceInvoice = requestedQty * unitPriceInvoice;
               const arrivedProductsTotal = arrivedQty * unitPriceInvoice;
               const openOrderTotal = Math.max(0, requestedQty - arrivedQty) * unitPriceInvoice;

               const payload: any = {
                  sapNo,
                  description,
                  requestedQty,
                  warehouseId: wh.id,
                  warehouseName: wh.name,
                  status,
                  plantCode,
                  orderDate,
                  orderNo,
                  plantAbbreviation,
                  realOwner,
                  arrivedQty,
                  unitPriceQuote,
                  totalPriceQuote,
                  unitPriceInvoice,
                  totalPriceInvoice,
                  logisticCost,
                  arrivedProductsTotal,
                  openOrderTotal,
                  deliveries
               };

               if (existing) {
                  await purchaseService.updatePurchaseRequestDetails(existing.id, payload);
                  updatedCount++;
               } else {
                  payload.requestedBy = (window as any).userProfile?.fullName || 'Excel İthalat';
                  payload.requestedAt = serverTimestamp();
                  await addDoc(collection(db, 'purchase_requests'), payload);
                  addedCount++;
               }

               const percent = Math.round(((r - headerRow) / (allRows.length - headerRow - 1)) * 100);
               document.getElementById('pr-import-progress')!.style.width = `${percent}%`;
               document.getElementById('pr-import-status')!.textContent = `${allRows.length - headerRow - 1} satırdan ${r - headerRow}'si işlendi...`;
            }

            overlay.remove();
            alert(`✅ Excel başarıyla ithal edildi!\n\nYeni Eklenen: ${addedCount}\nGüncellenen: ${updatedCount}`);
            (window as any).render({ skipShell: true });
         } catch (innerErr) {
            overlay.remove();
            console.error(innerErr);
            alert('Excel ayrıştırma hatası: ' + (innerErr as Error).message);
         }
      };

      reader.onerror = () => {
         overlay.remove();
         alert('Dosya okunamadı!');
      };

      reader.readAsArrayBuffer(file);
   } catch (err) {
      overlay.remove();
      console.error(err);
      alert('Excel yükleme hatası: ' + (err as Error).message);
   } finally {
      input.value = '';
   }
};

// --- EXPORT PR TO EXCEL ---
(window as any).exportPRToExcel = async () => {
   try {
      const XLSX = await import('xlsx');
      const items = (window as any).globalPRRequests || [];
      
      const filterStatus = (document.getElementById('pr-filter-status') as HTMLSelectElement)?.value || 'ALL';
      const searchInput = (document.getElementById('pr-table-search') as HTMLInputElement)?.value || '';
      const searchTerm = searchInput.toLowerCase().trim();

      let filteredItems = items;
      if (filterStatus !== 'ALL') {
         filteredItems = filteredItems.filter((item: any) => item.status === filterStatus);
      }
      if (searchTerm) {
         filteredItems = filteredItems.filter((item: any) => 
            String(item.sapNo || '').toLowerCase().includes(searchTerm) ||
            String(item.description || '').toLowerCase().includes(searchTerm) ||
            String(item.warehouseName || '').toLowerCase().includes(searchTerm) ||
            String(item.id || '').toLowerCase().includes(searchTerm)
         );
      }

      if (filteredItems.length === 0) {
         alert('Dışa aktarılacak veri bulunamadı.');
         return;
      }

      const excelData = filteredItems.map((item: any) => ({
         'Santral Kodu': item.plantCode || '',
         'Sipariş Tarihi': item.orderDate || '',
         'order no': item.orderNo || '',
         'Gelen Adet': item.arrivedQty || 0,
         'Material no.': item.sapNo || '',
         'Sipariş Adet': item.requestedQty || 0,
         'Description': item.description || '',
         'Teklif Birim Fiyat (€)': item.unitPriceQuote || 0,
         'Fatura Birim Fiyat (€)': item.unitPriceInvoice || 0,
         'Logistic Cost (€)': item.logisticCost || 0,
         'Santral Kısaltma': item.plantAbbreviation || '',
         'Siparişin Gerçek Sahibi': item.realOwner || ''
      }));

      const worksheet = XLSX.utils.json_to_sheet(excelData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Sipariş Raporu');
      
      const maxLens = Object.keys(excelData[0]).map(key => {
         let max = key.length;
         for (const row of excelData) {
            const val = String((row as any)[key] || '');
            if (val.length > max) max = val.length;
         }
         return { wch: max + 2 };
      });
      worksheet['!cols'] = maxLens;

      XLSX.writeFile(workbook, `Sipariş_Raporu_${new Date().toISOString().split('T')[0]}.xlsx`);
   } catch (err) {
      console.error(err);
      alert('Excel export hatası: ' + (err as Error).message);
   }
};

(window as any).globalPRRequests = purchaseRequests;

setTimeout(() => {
   if ((window as any).renderPRTableNew) {
      (window as any).renderPRTableNew();
   }
}, 100);

(window as any).switchMaterialTab = (tab: string) => {
   if ((window as any).appState) {
      (window as any).appState.materialManagementTab = tab;
   }
   (window as any).render({ skipShell: true });
};

(window as any).filterDefectTable = () => {
   const searchInput = document.getElementById('defect-search') as HTMLInputElement;
   const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
   const rows = document.querySelectorAll('.defect-row');
   rows.forEach((row: any) => {
      const text = row.dataset.search?.toLowerCase() || '';
      row.style.display = text.includes(term) ? '' : 'none';
   });
};

(window as any).filterAuditTable = () => {
   const searchInput = document.getElementById('audit-search') as HTMLInputElement;
   const term = searchInput ? searchInput.value.toLowerCase().trim() : '';
   const cards = document.querySelectorAll('.audit-group-card');
   cards.forEach((card: any) => {
      const text = card.dataset.search?.toLowerCase() || '';
      card.style.display = text.includes(term) ? '' : 'none';
   });
};

  return pageHtml;
};

