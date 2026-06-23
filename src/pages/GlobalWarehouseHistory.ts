import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import { formatTeamName } from '../utils/formatters';
import * as XLSX from 'xlsx';

export const GlobalWarehouseHistoryPage = async () => {
    // 1. Resolve combined list of warehouses (11 Main + 15 Teams)
    const mainWarehouses = dataService.getWarehouses();
    const teamWarehouses = Array.from({ length: 15 }, (_, i) => {
        const teamName = `Team ${String(i + 1).padStart(2, '0')}`;
        return {
            id: `team_${teamName.replace(/\s+/g, '_')}`,
            name: `${teamName} Deposu`
        };
    });
    const warehouses = [...mainWarehouses, ...teamWarehouses];
    (window as any).allGlobalWarehouses = warehouses;

    // 2. Fetch all logs in parallel
    const allLogsPromises = warehouses.map(w => warehouseService.getLogs(w.id));
    const logsArrays = await Promise.all(allLogsPromises);
    
    const allLogs = logsArrays.flatMap((logs, index) => 
        logs.map(log => ({
            ...log,
            warehouseName: warehouses[index].name,
            warehouseId: warehouses[index].id
        }))
    ).sort((a,b) => {
        const timeA = a.timestamp?.toDate ? a.timestamp.toDate().getTime() : a.timestamp;
        const timeB = b.timestamp?.toDate ? b.timestamp.toDate().getTime() : b.timestamp;
        return timeB - timeA;
    });
    (window as any).allGlobalLogs = allLogs;

    // 3. Fetch all reports to match ReportNo -> Turbine & MCF No
    try {
        const { serviceReportService } = await import('../services/ServiceReportService');
        const reports = await serviceReportService.getAllReports();
        const reportsMap: Record<string, { turbineNo: string, matFormNo: string }> = {};
        reports.forEach(r => {
            if (r.reportNo) {
                reportsMap[r.reportNo.trim().toUpperCase()] = {
                    turbineNo: r.turbineNo || '-',
                    matFormNo: r.matFormNo || '-'
                };
            }
        });
        (window as any).globalReportsMap = reportsMap;
    } catch (e) {
        console.error("Failed to load reports map:", e);
        (window as any).globalReportsMap = {};
    }

    // 4. Initialize or reset pagination state
    if (!(window as any).hasOwnProperty('activeWarehouseId')) {
        (window as any).activeWarehouseId = null;
    }
    (window as any).historyCurrentPage = 1;
    (window as any).historyItemsPerPage = 25;

    // Register all necessary window functions for DOM interaction
    registerWindowFunctions();

    // Trigger initial render after returning (fallback for SPA innerHTML injection)
    setTimeout(() => {
        if (typeof (window as any).renderGlobalHistoryMain === 'function') {
            (window as any).renderGlobalHistoryMain();
        }
    }, 50);

    return `
        <div class="fade-in-up content-area zoom-tablet">
            <div id="global-history-wrapper">
                <div class="glass-panel" style="padding: 3rem; text-align: center;">
                    <i class="fa-solid fa-circle-notch fa-spin" style="font-size: 2.5rem; color: var(--accent-cyan); margin-bottom: 1rem;"></i>
                    <div style="font-family: 'Rajdhani', sans-serif; font-weight: 600; letter-spacing: 2px;">DEPO HAREKETLERİ YÜKLENİYOR...</div>
                </div>
            </div>
        </div>
        
        <script>
            setTimeout(() => {
                if (typeof window.renderGlobalHistoryMain === 'function') {
                    window.renderGlobalHistoryMain();
                }
            }, 50);
        </script>
    `;
};

function registerWindowFunctions() {
    (window as any).renderGlobalHistoryMain = () => {
        const wrapper = document.getElementById('global-history-wrapper');
        if (!wrapper) return;

        const activeId = (window as any).activeWarehouseId;
        if (!activeId) {
            wrapper.innerHTML = renderCardGridView();
        } else {
            wrapper.innerHTML = renderWarehouseDetailView(activeId);
            // Run filter once to populate items and pagination
            (window as any).filterWarehouseLogs();
        }
    };

    (window as any).selectWarehouse = (whId: string) => {
        (window as any).activeWarehouseId = whId;
        (window as any).historyCurrentPage = 1; // Reset page on switch
        (window as any).renderGlobalHistoryMain();
    };

    (window as any).goBackToWarehouses = () => {
        (window as any).activeWarehouseId = null;
        (window as any).historyCurrentPage = 1; // Reset page on go back
        (window as any).renderGlobalHistoryMain();
    };

    (window as any).historyPrevPage = () => {
        if ((window as any).historyCurrentPage > 1) {
            (window as any).historyCurrentPage--;
            (window as any).filterWarehouseLogs();
        }
    };

    (window as any).historyNextPage = () => {
        const total = (window as any).historyTotalPages || 1;
        if ((window as any).historyCurrentPage < total) {
            (window as any).historyCurrentPage++;
            (window as any).filterWarehouseLogs();
        }
    };

    (window as any).filterWarehouseCards = (query: string) => {
        const cards = document.querySelectorAll('.warehouse-card');
        const lowerQuery = query.toLowerCase().trim();
        cards.forEach(card => {
            const name = card.getAttribute('data-name') || '';
            const id = card.getAttribute('data-id') || '';
            const mappedId = (dataService.getSiteIdByWarehouseId(id) || '').toLowerCase();
            if (name.includes(lowerQuery) || id.toLowerCase().includes(lowerQuery) || mappedId.includes(lowerQuery)) {
                (card as HTMLElement).style.display = '';
            } else {
                (card as HTMLElement).style.display = 'none';
            }
        });
    };

    (window as any).renderLogRows = (logs: any[]) => {
        if (logs.length === 0) {
            return `<tr><td colspan="9" style="padding: 2rem; text-align: center; color: var(--text-dim);">Uygun hareket kaydı bulunamadı.</td></tr>`;
        }
        
        const badgeStyle = `padding: 3px 8px; border-radius: 4px; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.5px; white-space: nowrap; display: inline-flex; align-items: center; gap: 4px;`;

        return logs.map(log => {
            const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
            
            // Parse report details
            const match = log.note?.match(/Rapor:\s*([^\s\)]+)/i);
            const reportNo = match ? match[1].trim().toUpperCase() : '';
            const report = reportNo ? (window as any).globalReportsMap[reportNo] : null;
            
            let turbineNo = report?.turbineNo || '';
            if (!turbineNo) {
                const turbMatch = log.note?.match(/T\d+/i) || log.note?.match(/Türbin\s*([^\s,]+)/i);
                if (turbMatch) turbineNo = turbMatch[0];
            }

            const mcfNo = report?.matFormNo || '-';
            const displayTurbine = turbineNo || '-';

            let typeBadge = '';
            if (log.type === 'ADD') {
                typeBadge = `<span style="${badgeStyle} background: rgba(0, 255, 127, 0.08); color: #00ff7f; border: 1px solid rgba(0, 255, 127, 0.15);"><i class="fa-solid fa-circle-plus"></i> STOK GİRİŞ</span>`;
            } else if (log.type === 'REMOVE') {
                typeBadge = `<span style="${badgeStyle} background: rgba(255, 77, 77, 0.08); color: #ff4d4d; border: 1px solid rgba(255, 77, 77, 0.15);"><i class="fa-solid fa-circle-minus"></i> STOK ÇIKIŞ</span>`;
            } else if (log.type === 'TRANSFER') {
                typeBadge = `<span style="${badgeStyle} background: rgba(245, 158, 11, 0.08); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.15);"><i class="fa-solid fa-circle-arrow-right"></i> TRANSFER</span>`;
            } else {
                typeBadge = `<span style="${badgeStyle} background: rgba(52, 152, 219, 0.08); color: #3498db; border: 1px solid rgba(52, 152, 219, 0.15);"><i class="fa-solid fa-pen-to-square"></i> GÜNCELLEME</span>`;
            }

            return `
                <tr class="hover-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;">
                    <td style="padding: 1rem 1.2rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">${date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim);">${date.toLocaleDateString('tr-TR')}</div>
                    </td>
                    <td style="padding: 1rem 1.2rem;">
                        <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-main);">${log.itemName || log.materialName || 'Bilinmeyen Malzeme'}</div>
                        <div style="font-size: 0.65rem; color: var(--text-dim); font-family: monospace;">SAP: ${log.sapNo || '-'}</div>
                    </td>
                    <td style="padding: 1rem 1.2rem;">
                        ${typeBadge}
                    </td>
                    <td style="padding: 1rem 1.2rem; text-align: center;">
                        <div style="font-size: 0.95rem; font-weight: 900; color: var(--text-main);">${Math.abs(log.quantity)}</div>
                        <div style="font-size: 0.5rem; color: var(--text-dim); font-weight: 700;">ADET</div>
                    </td>
                    <td style="padding: 1rem 1.2rem; text-align: center; font-size: 0.8rem; font-weight: 700; color: var(--accent-cyan);">${displayTurbine}</td>
                    <td style="padding: 1rem 1.2rem; font-size: 0.8rem; font-weight: 700; color: var(--accent-orange);">${mcfNo}</td>
                    <td style="padding: 1rem 1.2rem;">
                        <div style="display: flex; align-items: center; gap: 6px;">
                            <div style="width: 20px; height: 20px; border-radius: 50%; background: rgba(255,255,255,0.06); display: flex; align-items: center; justify-content: center; font-size: 0.55rem;">
                                <i class="fa-solid fa-user"></i>
                            </div>
                             <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-dim);">${formatTeamName(log.user)}</div>
                        </div>
                    </td>
                    <td style="padding: 1rem 1.2rem; font-size: 0.75rem; color: var(--text-main); max-width: 200px; word-break: break-word;">${log.note || '-'}</td>
                    <td style="padding: 1rem 1.2rem; text-align: right;">
                        <button onclick="window.deleteSingleLog('${log.warehouseId}', '${log.id}')" 
                                style="background: none; border: none; color: var(--accent-red); opacity: 0.3; cursor: pointer; transition: all 0.2s;"
                                onmouseover="this.style.opacity='1'" 
                                onmouseout="this.style.opacity='0.3'">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    };

    (window as any).filterWarehouseLogs = () => {
        const sapQuery = (document.getElementById('detail-sap-search') as HTMLInputElement)?.value.toLowerCase().trim() || '';
        const typeFilter = (document.getElementById('detail-type-filter') as HTMLSelectElement)?.value || 'ALL';
        const turbineQuery = (document.getElementById('detail-turbine-search') as HTMLInputElement)?.value.toLowerCase().trim() || '';
        const mcfQuery = (document.getElementById('detail-mcf-search') as HTMLInputElement)?.value.toLowerCase().trim() || '';
        const userQuery = (document.getElementById('detail-user-search') as HTMLInputElement)?.value.toLowerCase().trim() || '';
        const dateFilter = (document.getElementById('detail-date-filter') as HTMLInputElement)?.value || '';

        const activeId = (window as any).activeWarehouseId;
        const whLogs = (window as any).allGlobalLogs.filter((log: any) => log.warehouseId === activeId);

        const filtered = whLogs.filter((log: any) => {
            const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);

            // Date filter
            if (dateFilter) {
                const logDateStr = date.toISOString().split('T')[0];
                if (logDateStr !== dateFilter) return false;
            }

            // SAP / Name filter
            const sap = String(log.sapNo || '').toLowerCase();
            const name = String(log.itemName || log.materialName || '').toLowerCase();
            if (sapQuery && !sap.includes(sapQuery) && !name.includes(sapQuery)) return false;

            // Operation type filter
            if (typeFilter !== 'ALL') {
                if (typeFilter === 'ADD' && log.type !== 'ADD') return false;
                if (typeFilter === 'REMOVE' && log.type !== 'REMOVE') return false;
                if (typeFilter === 'TRANSFER' && log.type !== 'TRANSFER') return false;
            }

            // Parse report details
            const match = log.note?.match(/Rapor:\s*([^\s\)]+)/i);
            const reportNo = match ? match[1].trim().toUpperCase() : '';
            const report = reportNo ? (window as any).globalReportsMap[reportNo] : null;
            
            // Turbine filter
            let turbineNo = report?.turbineNo || '';
            if (!turbineNo) {
                const turbMatch = log.note?.match(/T\d+/i) || log.note?.match(/Türbin\s*([^\s,]+)/i);
                if (turbMatch) turbineNo = turbMatch[0];
            }
            turbineNo = turbineNo.toLowerCase();
            if (turbineQuery && !turbineNo.includes(turbineQuery)) return false;

            // MCF filter
            const mcfNo = (report?.matFormNo || '').toLowerCase();
            if (mcfQuery && !mcfNo.includes(mcfQuery)) return false;

            // Responsible User filter
            const user = String(log.user || '').toLowerCase();
            if (userQuery && !user.includes(userQuery)) return false;

            return true;
        });

        // Store filtered logs in window context for Excel export
        (window as any).currentFilteredLogs = filtered;

        // Calculate sum of absolute quantities
        const totalQtySum = filtered.reduce((acc: number, log: any) => acc + Math.abs(log.quantity), 0);

        // Paginate logs
        const totalPages = Math.ceil(filtered.length / (window as any).historyItemsPerPage) || 1;
        (window as any).historyTotalPages = totalPages;

        if ((window as any).historyCurrentPage > totalPages) {
            (window as any).historyCurrentPage = totalPages;
        }
        if ((window as any).historyCurrentPage < 1) {
            (window as any).historyCurrentPage = 1;
        }

        const startIndex = ((window as any).historyCurrentPage - 1) * (window as any).historyItemsPerPage;
        const endIndex = startIndex + (window as any).historyItemsPerPage;
        const paginated = filtered.slice(startIndex, endIndex);

        const tbody = document.getElementById('detail-history-tbody');
        if (tbody) {
            tbody.innerHTML = (window as any).renderLogRows(paginated);
        }
        
        const countDisplay = document.getElementById('detail-filtered-count');
        if (countDisplay) {
            countDisplay.textContent = filtered.length;
        }

        const sumDisplay = document.getElementById('detail-filtered-sum');
        if (sumDisplay) {
            sumDisplay.textContent = totalQtySum;
        }

        // Render pagination controls
        const paginationContainer = document.getElementById('detail-history-pagination');
        if (paginationContainer) {
            paginationContainer.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.8rem 1.5rem; background: rgba(0,0,0,0.15); border-top: 1px solid rgba(255,255,255,0.05); width: 100%; box-sizing: border-box;">
                    <button onclick="window.historyPrevPage()" class="btn-cyber-outline" 
                            style="padding: 0.35rem 0.8rem; font-size: 0.7rem; border-radius: 4px; font-weight: 700; cursor: pointer; transition: all 0.2s;"
                            ${(window as any).historyCurrentPage === 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        GERİ
                    </button>
                    <span style="font-size: 0.75rem; color: var(--text-dim); font-weight: 600; font-family: monospace;">Sayfa ${(window as any).historyCurrentPage} / ${totalPages}</span>
                    <button onclick="window.historyNextPage()" class="btn-cyber-outline" 
                            style="padding: 0.35rem 0.8rem; font-size: 0.7rem; border-radius: 4px; font-weight: 700; cursor: pointer; transition: all 0.2s;"
                            ${(window as any).historyCurrentPage === totalPages ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>
                        İLERİ
                    </button>
                </div>
            `;
        }
    };

    (window as any).deleteSingleLog = async (warehouseId: string, logId: string) => {
        if (!confirm('Bu hareketi silmek istediğinizden emin misiniz?')) return;
        
        try {
            await warehouseService.deleteLog(warehouseId, logId);
            // Remove from memory
            (window as any).allGlobalLogs = (window as any).allGlobalLogs.filter((log: any) => log.id !== logId);
            // Re-filter/render
            (window as any).filterWarehouseLogs();
        } catch (error) {
            console.error('Log silme hatası:', error);
            alert('Log silinirken hata oluştu!');
        }
    };

    (window as any).clearWarehouseLogs = async (warehouseId: string, name: string) => {
        const confirm1 = confirm(`${name} deposunun TÜM hareket geçmişini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!`);
        if (!confirm1) return;
        
        const confirm2 = confirm('SON UYARI: Bu depodaki tüm loglar silinecektir. Onaylıyor musunuz?');
        if (!confirm2) return;

        try {
            await warehouseService.clearAllLogs(warehouseId);
            alert('Depo logları başarıyla temizlendi.');
            
            // Remove all logs of this warehouse from memory
            (window as any).allGlobalLogs = (window as any).allGlobalLogs.filter((log: any) => log.warehouseId !== warehouseId);
            
            // Go back
            (window as any).activeWarehouseId = null;
            (window as any).renderGlobalHistoryMain();
        } catch (error) {
            console.error('Logs clear error:', error);
            alert('Temizleme sırasında hata oluştu.');
        }
    };

    (window as any).deleteAllGlobalHistoryLogs = async () => {
        const confirm1 = confirm('TÜM depo hareketlerini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!');
        if (!confirm1) return;
        
        const confirm2 = confirm('SON UYARI: Tüm depoların kayıtları kalıcı olarak silinecektir. Onaylıyor musunuz?');
        if (!confirm2) return;

        try {
            const warehouses = (window as any).allGlobalWarehouses;
            const deletePromises = warehouses.map(async (wh: any) => {
                const logs = await warehouseService.getLogs(wh.id);
                const batchPromises = logs.map(log => warehouseService.deleteLog(wh.id, log.id!));
                return Promise.all(batchPromises);
            });

            await Promise.all(deletePromises);
            alert('Tüm hareketler başarıyla temizlendi.');
            
            (window as any).allGlobalLogs = [];
            (window as any).activeWarehouseId = null;
            (window as any).renderGlobalHistoryMain();
        } catch (error) {
            console.error('Delete all logs error:', error);
            alert('Bazı kayıtlar silinirken hata oluştu.');
        }
    };

    (window as any).exportLogsToExcel = (warehouseId?: string) => {
        try {
            const activeId = warehouseId || (window as any).activeWarehouseId;
            let logsToExport = (window as any).allGlobalLogs;
            
            // If in detail view, export only currently filtered logs
            if (activeId) {
                logsToExport = (window as any).currentFilteredLogs || [];
            }

            const exportData = logsToExport.map((log: any) => {
                const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
                
                const match = log.note?.match(/Rapor:\s*([^\s\)]+)/i);
                const reportNo = match ? match[1].trim().toUpperCase() : '';
                const report = reportNo ? (window as any).globalReportsMap[reportNo] : null;
                
                let turbineNo = report?.turbineNo || '';
                if (!turbineNo) {
                    const turbMatch = log.note?.match(/T\d+/i) || log.note?.match(/Türbin\s*([^\s,]+)/i);
                    if (turbMatch) turbineNo = turbMatch[0];
                }

                const mcfNo = report?.matFormNo || '-';

                return {
                    'Tarih': date.toLocaleString('tr-TR'),
                    'Saha / Depo': log.warehouseName || '-',
                    'Malzeme Adı': log.itemName || log.materialName || 'Bilinmeyen',
                    'SAP No': log.sapNo || '-',
                    'İşlem Tipi': log.type === 'ADD' ? 'Stok Giriş' : log.type === 'REMOVE' ? 'Stok Çıkış' : log.type === 'TRANSFER' ? 'Transfer' : 'Güncelleme',
                    'Miktar': log.quantity,
                    'Türbin No': turbineNo || '-',
                    'MÇF No': mcfNo,
                    'Sorumlu': formatTeamName(log.user),
                    'Not/Açıklama': log.note || '-'
                };
            });

            const ws = XLSX.utils.json_to_sheet(exportData);
            const wb = XLSX.utils.book_new();
            const sheetName = activeId ? "Depo Hareketleri" : "Tüm Hareketler";
            XLSX.utils.book_append_sheet(wb, ws, sheetName);
            
            const wscols = [
                {wch: 20}, // Tarih
                {wch: 25}, // Saha/Depo
                {wch: 35}, // Malzeme Adı
                {wch: 15}, // SAP No
                {wch: 15}, // İşlem Tipi
                {wch: 10}, // Miktar
                {wch: 12}, // Türbin No
                {wch: 15}, // MÇF No
                {wch: 20}, // Sorumlu
                {wch: 45}  // Not/Açıklama
            ];
            ws['!cols'] = wscols;

            const filename = activeId 
                ? `DH_${activeId}_Depo_Hareketleri_${new Date().toISOString().split('T')[0]}.xlsx`
                : `DH_Global_Depo_Hareketleri_${new Date().toISOString().split('T')[0]}.xlsx`;

            XLSX.writeFile(wb, filename);
        } catch (error) {
            console.error('Excel export error:', error);
            alert('Excel dışa aktarma sırasında bir hata oluştu.');
        }
    };
}

function renderCardGridView() {
    const warehouses = (window as any).allGlobalWarehouses;
    const allLogs = (window as any).allGlobalLogs;

    const cardsHtml = warehouses.map((wh: any) => {
        const isTeam = wh.id.startsWith('team_');
        const whLogs = allLogs.filter((l: any) => l.warehouseId === wh.id);
        const totalLogs = whLogs.length;
        const lastLog = whLogs[0];
        let lastLogText = 'İşlem Yok';
        if (lastLog) {
            const date = lastLog.timestamp?.toDate ? lastLog.timestamp.toDate() : new Date(lastLog.timestamp);
            lastLogText = date.toLocaleString('tr-TR');
        }

        const iconHtml = isTeam 
            ? `<i class="fa-solid fa-truck-ramp-box" style="color: var(--accent-orange); font-size: 1.6rem;"></i>`
            : `<i class="fa-solid fa-warehouse" style="color: var(--accent-blue); font-size: 1.6rem;"></i>`;

        const badgeHtml = isTeam
            ? `<span style="background: rgba(245, 158, 11, 0.15); color: #F59E0B; border: 1px solid rgba(245, 158, 11, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">Zimmet Deposu</span>`
            : `<span style="background: rgba(59, 130, 246, 0.15); color: #3B82F6; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 8px; border-radius: 6px; font-size: 0.65rem; font-weight: 700; text-transform: uppercase;">Ana Depo</span>`;

        return `
            <div class="glass-panel warehouse-card" 
                 data-id="${wh.id}" 
                 data-name="${wh.name.toLowerCase()}"
                 onclick="window.selectWarehouse('${wh.id}')"
                 style="padding: 1.5rem; border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; cursor: pointer; transition: all 0.3s ease; display: flex; flex-direction: column; justify-content: space-between; min-height: 160px; background: rgba(15, 23, 42, 0.45);"
                 onmouseover="this.style.transform='translateY(-4px)'; this.style.borderColor='rgba(0, 242, 254, 0.3)'; this.style.background='rgba(100, 255, 218, 0.03)'"
                 onmouseout="this.style.transform='none'; this.style.borderColor='rgba(255,255,255,0.08)'; this.style.background='rgba(15, 23, 42, 0.45)'">
                <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                        <div style="width: 42px; height: 42px; border-radius: 10px; background: rgba(255,255,255,0.03); display: flex; align-items: center; justify-content: center;">
                            ${iconHtml}
                        </div>
                        ${badgeHtml}
                    </div>
                    <h3 style="font-size: 0.95rem; font-weight: 800; color: #FFF; margin: 0 0 0.25rem 0; letter-spacing: 0.5px;">${wh.name}</h3>
                    <div style="font-size: 0.7rem; color: var(--text-dim); font-family: monospace;">KOD: ${dataService.getSiteIdByWarehouseId(wh.id) || wh.id.replace('team_Team_', 'TEAM ')}</div>
                </div>
                <div style="margin-top: 1.5rem; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-size: 0.75rem; color: var(--text-dim);">
                        <i class="fa-solid fa-list-check" style="margin-right: 4px; font-size: 0.7rem;"></i> <strong>${totalLogs}</strong> Hareket
                    </div>
                    <div style="font-size: 0.65rem; color: var(--text-dim); text-align: right;" title="Son Hareket">
                        ${lastLogText}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    return `
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
            <div>
                <h1 class="page-title" style="margin-bottom: 0.5rem; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 1px;">
                    <i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-blue);"></i> 
                    Global Depo Hareketleri
                </h1>
                <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">Depo bazında anlık malzeme giriş, çıkış ve transfer analizleri</p>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button onclick="window.exportLogsToExcel()" 
                        class="cyber-button-small" 
                        style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 8px; background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                    <i class="fa-solid fa-file-excel"></i> TÜMÜNÜ EXCEL İNDİR
                </button>
                <button onclick="window.deleteAllGlobalHistoryLogs()" 
                        class="cyber-button-small" 
                        style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 8px; background: rgba(231, 76, 60, 0.1); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                    <i class="fa-solid fa-trash-can"></i> TÜM LOGLARI TEMİZLE
                </button>
            </div>
        </div>

        <div class="glass-panel" style="padding: 1.2rem 1.5rem; margin-bottom: 2rem; display: flex; align-items: center; gap: 1rem;">
            <i class="fa-solid fa-magnifying-glass" style="color: var(--text-dim); font-size: 0.9rem;"></i>
            <input type="text" placeholder="Depo adı veya koduna göre kartları ara..." 
                   oninput="window.filterWarehouseCards(this.value)"
                   style="flex-grow: 1; background: transparent; border: none; outline: none; color: white; font-size: 0.9rem;">
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(285px, 1fr)); gap: 1.5rem;">
            ${cardsHtml}
        </div>
    `;
}

function renderWarehouseDetailView(whId: string) {
    const warehouses = (window as any).allGlobalWarehouses;
    const allLogs = (window as any).allGlobalLogs;
    const wh = warehouses.find((w: any) => w.id === whId);
    if (!wh) return '<div>Depo bulunamadı.</div>';

    const whLogs = allLogs.filter((l: any) => l.warehouseId === whId);
    const totalLogs = whLogs.length;

    let lastLogText = 'İşlem Yok';
    if (whLogs.length > 0) {
        const date = whLogs[0].timestamp?.toDate ? whLogs[0].timestamp.toDate() : new Date(whLogs[0].timestamp);
        lastLogText = date.toLocaleString('tr-TR');
    }

    return `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem;">
            <div style="display: flex; align-items: center; gap: 1rem;">
                <button onclick="window.goBackToWarehouses()" 
                        style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: var(--accent-cyan); width: 36px; height: 36px; border-radius: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.3s ease;"
                        onmouseover="this.style.background='rgba(100, 255, 218, 0.1)'"
                        onmouseout="this.style.background='rgba(255,255,255,0.05)'">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
                <div>
                    <h1 class="page-title" style="margin: 0 0 0.25rem 0; font-weight: 800; font-family: 'Rajdhani', sans-serif; letter-spacing: 0.5px;">
                        ${wh.name} Hareket Analizi
                    </h1>
                    <div style="font-size: 0.75rem; color: var(--text-dim); font-family: monospace;">DEPO KODU: ${dataService.getSiteIdByWarehouseId(whId) || whId.replace('team_Team_', 'TEAM ')}</div>
                </div>
            </div>
            <div style="display: flex; gap: 0.75rem; align-items: center;">
                <button onclick="window.exportLogsToExcel('${whId}')" 
                        class="cyber-button-small" 
                        style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 8px; background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                    <i class="fa-solid fa-file-excel"></i> EXCEL İNDİR
                </button>
                <button onclick="window.clearWarehouseLogs('${whId}', '${wh.name}')" 
                        class="cyber-button-small" 
                        style="padding: 0.5rem 1rem; display: flex; align-items: center; gap: 8px; background: rgba(231, 76, 60, 0.1); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                    <i class="fa-solid fa-trash-sweep"></i> DEPOYU TEMİZLE
                </button>
            </div>
        </div>

        <!-- Metrics cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
            <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.35);">
                <div>
                    <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">TOPLAM HAREKET</div>
                    <div style="font-size: 1.5rem; font-weight: 900; color: var(--accent-blue); margin-top: 0.25rem;">${totalLogs}</div>
                </div>
                <i class="fa-solid fa-list-check" style="font-size: 2rem; opacity: 0.15; color: var(--accent-blue);"></i>
            </div>
            <div class="glass-panel" style="padding: 1rem; display: flex; align-items: center; justify-content: space-between; background: rgba(15, 23, 42, 0.35);">
                <div>
                    <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">SON HAREKET</div>
                    <div style="font-size: 0.95rem; font-weight: 700; color: #FFF; margin-top: 0.4rem;">${lastLogText}</div>
                </div>
                <i class="fa-solid fa-clock" style="font-size: 2rem; opacity: 0.15; color: var(--accent-cyan);"></i>
            </div>
        </div>

        <!-- Advanced Filters -->
        <div class="glass-panel" style="padding: 1.5rem; margin-bottom: 1.5rem; border-top: 2px solid var(--accent-cyan); background: rgba(15, 23, 42, 0.35);">
            <h3 style="font-size: 0.8rem; color: var(--accent-cyan); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.5rem;">
                <i class="fa-solid fa-filter"></i> GELİŞMİŞ FİLTRELEME
            </h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; width: 100%;">
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">MALZEME / SAP</label>
                    <input type="text" id="detail-sap-search" placeholder="SAP No veya Tanım..." oninput="window.filterWarehouseLogs()"
                           style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">İŞLEM TİPİ</label>
                    <select id="detail-type-filter" onchange="window.filterWarehouseLogs()"
                            style="background: rgba(15,23,42,0.95); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                        <option value="ALL">Tümü</option>
                        <option value="ADD">Stok Giriş</option>
                        <option value="REMOVE">Stok Çıkış</option>
                        <option value="TRANSFER">Transfer</option>
                    </select>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">TARİH (GÜN)</label>
                    <input type="date" id="detail-date-filter" onchange="window.filterWarehouseLogs()"
                           style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">TÜRBİN NO</label>
                    <input type="text" id="detail-turbine-search" placeholder="Örn: T05..." oninput="window.filterWarehouseLogs()"
                           style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">MÇF KODU</label>
                    <input type="text" id="detail-mcf-search" placeholder="Örn: MÇF..." oninput="window.filterWarehouseLogs()"
                           style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.35rem;">
                    <label style="font-size: 0.65rem; color: var(--text-dim); font-weight: 700;">SORUMLU</label>
                    <input type="text" id="detail-user-search" placeholder="Kullanıcı adı..." oninput="window.filterWarehouseLogs()"
                           style="background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.08); color: white; padding: 0.45rem 0.75rem; border-radius: 6px; font-size: 0.8rem; outline: none; height: 32px; box-sizing: border-box;">
                </div>
            </div>
        </div>

        <!-- Table View -->
        <div class="glass-panel" style="padding: 0; overflow: hidden; background: rgba(15, 23, 42, 0.45);">
            <div style="padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.15); flex-wrap: wrap; gap: 0.5rem;">
                <div style="font-size: 0.75rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">HAREKET LİSTESİ</div>
                <div style="font-size: 0.75rem; color: var(--text-dim); display: flex; gap: 1rem; flex-wrap: wrap;">
                    <span>Filtrelenen: <strong id="detail-filtered-count" style="color: var(--accent-cyan);">${totalLogs}</strong> / ${totalLogs}</span>
                    <span>|</span>
                    <span>Toplam Miktar: <strong id="detail-filtered-sum" style="color: var(--accent-orange);">0</strong> Adet</span>
                </div>
            </div>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; min-width: 900px;">
                    <thead>
                        <tr style="text-align: left; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 120px;">ZAMAN / TARİH</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">MALZEME BİLGİSİ</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 110px;">İŞLEM</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; text-align: center; width: 80px;">MİKTAR</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 90px; text-align: center;">TÜRBİN NO</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 110px;">MÇF NO</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 140px;">SORUMLU</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">NOT / AÇIKLAMA</th>
                            <th style="padding: 1rem 1.2rem; font-size: 0.65rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 50px;"></th>
                        </tr>
                    </thead>
                    <tbody id="detail-history-tbody">
                        ${(window as any).renderLogRows(whLogs)}
                    </tbody>
                </table>
            </div>
            <div id="detail-history-pagination"></div>
        </div>
    `;
}
