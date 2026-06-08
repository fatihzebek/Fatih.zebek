import { warehouseService } from '../services/WarehouseService';
import { dataService } from '../services/DataService';
import * as XLSX from 'xlsx';

export const GlobalWarehouseHistoryPage = async () => {
    const warehouses = dataService.getWarehouses();
    const allLogsPromises = warehouses.map(w => warehouseService.getLogs(w.id));
    const logsArrays = await Promise.all(allLogsPromises);
    
    // Flatten and enrich with warehouse name
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

    return `
        <div class="fade-in-up content-area zoom-tablet">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2rem;">
                <div>
                    <h1 class="page-title" style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-clock-rotate-left" style="color: var(--accent-blue);"></i> 
                        Global Depo Hareketleri
                    </h1>
                    <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">Tüm sahalardan gelen gerçek zamanlı stok akışı</p>
                </div>
                <div class="glass-card" style="padding: 0.75rem 1.5rem; display: flex; align-items: center; gap: 1rem;">
                    <div style="text-align: right;">
                        <div style="font-size: 0.6rem; color: var(--text-dim); font-weight: 700; text-transform: uppercase;">TOPLAM KAYIT</div>
                        <div style="font-size: 1.25rem; font-weight: 900; color: var(--accent-blue);">${allLogs.length}</div>
                    </div>
                    <i class="fa-solid fa-list-ul" style="font-size: 1.5rem; opacity: 0.2;"></i>
                </div>
                <div style="display: flex; gap: 0.75rem; align-items: center;">
                    <button onclick="window.exportGlobalHistoryToExcel('${encodeURIComponent(JSON.stringify(allLogs))}')" 
                            class="cyber-button-small" 
                            style="padding: 0.4rem 0.8rem; display: flex; align-items: center; gap: 8px; background: rgba(46, 204, 113, 0.1); color: #2ecc71; border: 1px solid rgba(46, 204, 113, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                        <i class="fa-solid fa-file-excel"></i> EXCEL
                    </button>
                    <button onclick="window.deleteAllGlobalHistoryLogs()" 
                            class="cyber-button-small" 
                            style="padding: 0.4rem 0.8rem; display: flex; align-items: center; gap: 8px; background: rgba(231, 76, 60, 0.1); color: #e74c3c; border: 1px solid rgba(231, 76, 60, 0.3); border-radius: 6px; font-size: 0.7rem; font-weight: 700; cursor: pointer; transition: all 0.3s;">
                        <i class="fa-solid fa-trash-sweep"></i> TÜMÜNÜ SİL
                    </button>
                </div>
            </div>

            <div class="glass-panel" style="padding: 0; overflow: hidden;">
                <div style="padding: 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; gap: 1rem;">
                    <div style="position: relative; flex-grow: 1;">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: var(--text-dim); font-size: 0.8rem;"></i>
                        <input type="text" id="global-history-search" placeholder="İşlem, malzeme veya kullanıcı ara..." 
                               oninput="window.filterGlobalHistory(this.value)"
                               style="width: 100%; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.1); color: white; padding: 0.6rem 1rem 0.6rem 2.5rem; border-radius: 8px; font-size: 0.85rem;">
                    </div>
                </div>

                <div id="global-history-table-container" style="overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="text-align: left; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.05);">
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">ZAMAN / TARİH</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">SAHA / DEPO</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">MALZEME BİLGİSİ</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">İŞLEM</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; text-align: center;">MİKTAR</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px;">SORUMLU</th>
                                <th style="padding: 1.2rem 1.5rem; font-size: 0.7rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 1px; width: 50px;"></th>
                            </tr>
                        </thead>
                        <tbody id="global-history-tbody">
                            ${renderLogs(allLogs)}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

function renderLogs(logs: any[]) {
    return logs.map(log => {
        const date = log.timestamp?.toDate ? log.timestamp.toDate() : new Date(log.timestamp);
        return `
            <tr class="hover-row" style="border-bottom: 1px solid rgba(255,255,255,0.03); transition: all 0.2s;">
                <td style="padding: 1.2rem 1.5rem;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${date.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'})}</div>
                    <div style="font-size: 0.65rem; color: var(--text-dim);">${date.toLocaleDateString('tr-TR')}</div>
                </td>
                <td style="padding: 1.2rem 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 8px; height: 8px; border-radius: 50%; background: var(--accent-blue);"></div>
                        <div style="font-size: 0.85rem; font-weight: 600; color: var(--accent-blue);">${log.warehouseName}</div>
                    </div>
                </td>
                <td style="padding: 1.2rem 1.5rem;">
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-main);">${log.itemName || 'Bilinmeyen Malzeme'}</div>
                    <div style="font-size: 0.7rem; color: var(--text-dim); font-family: monospace;">SAP: ${log.sapNo || '-'}</div>
                </td>
                <td style="padding: 1.2rem 1.5rem;">
                    <span style="padding: 4px 10px; border-radius: 6px; font-size: 0.65rem; font-weight: 800; letter-spacing: 0.5px; 
                        background: ${log.type === 'ADD' ? 'rgba(0, 255, 127, 0.1)' : log.type === 'REMOVE' ? 'rgba(255, 77, 77, 0.1)' : 'rgba(52, 152, 219, 0.1)'};
                        color: ${log.type === 'ADD' ? '#00ff7f' : log.type === 'REMOVE' ? '#ff4d4d' : '#3498db'};
                        border: 1px solid ${log.type === 'ADD' ? 'rgba(0, 255, 127, 0.2)' : log.type === 'REMOVE' ? 'rgba(255, 77, 77, 0.2)' : 'rgba(52, 152, 219, 0.2)'};">
                        ${log.type === 'ADD' ? 'STOK GİRİŞ' : log.type === 'REMOVE' ? 'STOK ÇIKIŞ' : 'GÜNCELLEME'}
                    </span>
                </td>
                <td style="padding: 1.2rem 1.5rem; text-align: center;">
                    <div style="font-size: 1.1rem; font-weight: 900; color: var(--text-main);">${log.quantity}</div>
                    <div style="font-size: 0.55rem; color: var(--text-dim); font-weight: 700;">ADET</div>
                </td>
                <td style="padding: 1.2rem 1.5rem;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div style="width: 24px; height: 24px; border-radius: 50%; background: rgba(255,255,255,0.1); display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">
                            <i class="fa-solid fa-user"></i>
                        </div>
                        <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-dim);">${log.user?.split('@')[0]?.toUpperCase() || 'SİSTEM'}</div>
                    </div>
                </td>
                <td style="padding: 1.2rem 1.5rem; text-align: right;">
                    <button onclick="window.deleteGlobalHistoryLog('${log.warehouseId}', '${log.id}')" 
                            style="background: none; border: none; color: var(--accent-red); opacity: 0.3; cursor: pointer; transition: all 0.2s;"
                            onmouseover="this.style.opacity='1'" 
                            onmouseout="this.style.opacity='0.3'">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

(window as any).filterGlobalHistory = (query: string) => {
    const tbody = document.getElementById('global-history-tbody');
    const rows = tbody?.querySelectorAll('tr');
    if (!rows) return;

    const lowerQuery = query.toLowerCase();
    rows.forEach(row => {
        const text = row.textContent?.toLowerCase() || '';
        (row as HTMLElement).style.display = text.includes(lowerQuery) ? '' : 'none';
    });
};

(window as any).deleteGlobalHistoryLog = async (warehouseId: string, logId: string) => {
    if (!confirm('Bu hareketi silmek istediğinizden emin misiniz?')) return;
    
    try {
        await warehouseService.deleteLog(warehouseId, logId);
        // Sayfayı yenilemek için aynı route'a tekrar navigate et
        (window as any).navigate('global-history'); 
    } catch (error) {
        console.error('Log silme hatası:', error);
        alert('Hata oluştu!');
    }
};

(window as any).exportGlobalHistoryToExcel = (logsJson: string) => {
    try {
        const logs = JSON.parse(decodeURIComponent(logsJson));
        
        const exportData = logs.map((log: any) => ({
            'Tarih': log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('tr-TR') : new Date(log.timestamp).toLocaleString('tr-TR'),
            'Saha / Depo': log.warehouseName,
            'Malzeme Adı': log.itemName || 'Bilinmeyen',
            'SAP No': log.sapNo || '-',
            'İşlem Tipi': log.type === 'ADD' ? 'Stok Giriş' : log.type === 'REMOVE' ? 'Stok Çıkış' : 'Güncelleme',
            'Miktar': log.quantity,
            'Birim': 'ADET',
            'Sorumlu': log.user?.split('@')[0]?.toUpperCase() || 'SİSTEM',
            'Not/Açıklama': log.note || '-'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Hareketler");
        
        // Sütun genişliklerini ayarla
        const wscols = [
            {wch: 20}, // Tarih
            {wch: 25}, // Saha
            {wch: 35}, // Malzeme
            {wch: 15}, // SAP
            {wch: 15}, // İşlem
            {wch: 10}, // Miktar
            {wch: 10}, // Birim
            {wch: 20}, // Sorumlu
            {wch: 40}  // Not
        ];
        ws['!cols'] = wscols;

        XLSX.writeFile(wb, `DH_Depo_Hareketleri_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
        console.error('Excel export error:', error);
        alert('Excel dışa aktarma sırasında bir hata oluştu.');
    }
};

(window as any).deleteAllGlobalHistoryLogs = async () => {
    const confirm1 = confirm('TÜM depo hareketlerini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz!');
    if (!confirm1) return;
    
    const confirm2 = confirm('SON UYARI: Tüm kayıtlar kalıcı olarak silinecektir. Onaylıyor musunuz?');
    if (!confirm2) return;

    try {
        const warehouses = dataService.getWarehouses();
        const deletePromises = warehouses.map(async (wh) => {
            const logs = await warehouseService.getLogs(wh.id);
            const batchPromises = logs.map(log => warehouseService.deleteLog(wh.id, log.id!));
            return Promise.all(batchPromises);
        });

        await Promise.all(deletePromises);
        alert('Tüm hareketler başarıyla temizlendi.');
        (window as any).navigate('global-history');
    } catch (error) {
        console.error('Delete all logs error:', error);
        alert('Bazı kayıtlar silinirken hata oluştu.');
    }
};

