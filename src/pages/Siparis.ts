import { inventoryService } from '../services/InventoryService';
import { orderService } from '../services/OrderService';
import { authService } from '../services/AuthService';
import { dataService } from '../services/DataService';
import { formatTeamName } from '../utils/formatters';

let basket: any[] = [];
let selectedWhId = '';
let isSubmitting = false;

export const SiparisPage = async (userProfile: any) => {
    const warehouses = dataService.getWarehouses();
    const allowedWarehouses = userProfile?.role === 'ADMIN' 
        ? warehouses 
        : warehouses.filter((w: any) => userProfile?.allowedWarehouses?.includes(w.id));

    if (selectedWhId === '' && allowedWarehouses.length > 0) {
        selectedWhId = allowedWarehouses[0].id;
    }

    const requests = await orderService.getRequests();
    const myRequests = requests.filter(r => r.requester === (authService.getCurrentUser()?.email || ''));

    return `
        <div class="fade-in-up content-area zoom-tablet" style="max-width: 1400px; margin: 0 auto;">
            <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 2.5rem;">
                <div>
                    <h1 class="page-title" style="margin-bottom: 0.5rem;">
                        <i class="fa-solid fa-cart-plus" style="color: var(--accent-cyan);"></i> 
                        Malzeme Siparişi (Talep)
                    </h1>
                    <p style="color: var(--text-dim); font-size: 0.9rem; font-weight: 500;">İhtiyacınız olan malzemeleri katalogdan seçerek talep oluşturun.</p>
                </div>
                <div class="glass-card" style="padding: 0.75rem 1.25rem; display: flex; align-items: center; gap: 12px; border-color: rgba(0, 255, 255, 0.2);">
                    <i class="fa-solid fa-clipboard-list" style="color: var(--accent-cyan); font-size: 1.2rem; opacity: 0.7;"></i>
                    <div>
                        <div style="font-size: 0.55rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px;">TALEPLERİM</div>
                        <div style="font-size: 1.1rem; font-weight: 900; color: var(--text-main);">${myRequests.length}</div>
                    </div>
                </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 350px; gap: 2rem; align-items: start;">
                <!-- Main Search & Results -->
                <div class="glass-panel" style="padding: 1.5rem; border-radius: 24px;">
                    <div style="margin-bottom: 2rem;">
                        <label style="display: block; font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-bottom: 0.75rem; text-transform: uppercase;">1. DEPO SEÇİMİ</label>
                        <select id="siparis-wh-select" class="cyber-input" style="width: 100%;" onchange="window.handleSiparisWhChange(this.value)">
                            <option value="">Depo Seçin</option>
                            ${allowedWarehouses.map((w: any) => `<option value="${w.id}" ${selectedWhId === w.id ? 'selected' : ''}>${w.name}</option>`).join('')}
                        </select>
                    </div>

                    <label style="display: block; font-size: 0.7rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-bottom: 0.75rem; text-transform: uppercase;">2. MALZEME ARA & EKLE</label>
                    <div style="position: relative; margin-bottom: 1.5rem;">
                        <i class="fa-solid fa-magnifying-glass" style="position: absolute; left: 1.25rem; top: 50%; transform: translateY(-50%); color: var(--accent-cyan); font-size: 0.9rem; opacity: 0.7;"></i>
                        <input type="text" id="siparis-search" placeholder="SAP no veya malzeme ismi ile katalogda arayın..." 
                               class="cyber-input" style="padding-left: 3rem; width: 100%;"
                               oninput="window.handleSiparisSearch(this.value)"
                               autocomplete="off">
                    </div>

                    <div id="siparis-results" style="max-height: 400px; overflow-y: auto;">
                         <div style="padding: 3rem; text-align: center; color: var(--text-dim); opacity: 0.5;">
                            <i class="fa-solid fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                            <p>Arama yapmak için yazmaya başlayın...</p>
                         </div>
                    </div>
                </div>

                <!-- Shopping Cart / Basket -->
                <div class="glass-panel" style="padding: 1.5rem; border-radius: 24px; position: sticky; top: 2rem; border-color: ${basket.length > 0 ? 'var(--accent-cyan)' : 'var(--glass-border)'}; transition: all 0.3s;">
                    <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center;">
                        <span>SEPETİM</span>
                        <span style="font-size: 0.7rem; background: rgba(0, 255, 255, 0.1); color: var(--accent-cyan); padding: 2px 8px; border-radius: 10px;">${basket.length} ÜRÜN</span>
                    </h3>

                    <div id="siparis-basket-list" style="min-height: 100px; max-height: 300px; overflow-y: auto; margin-bottom: 1.5rem;">
                        ${basket.length === 0 ? `
                            <div style="text-align: center; padding: 2rem; color: var(--text-dim); font-size: 0.8rem; border: 1px dashed var(--glass-border); border-radius: 12px;">
                                Sepetiniz henüz boş.
                            </div>
                        ` : basket.map((item, idx) => `
                            <div class="glass-card" style="padding: 0.75rem; margin-bottom: 0.5rem; border-radius: 12px; background: rgba(255,255,255,0.02);">
                                <div style="display: flex; justify-content: space-between; align-items: start; gap: 10px;">
                                    <div style="flex: 1;">
                                        <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-main); line-height: 1.2;">${item.d}</div>
                                        <div style="font-size: 0.65rem; color: var(--accent-cyan); font-weight: 800; margin-top: 4px;">${item.n}</div>
                                    </div>
                                    <button class="action-icon-btn" style="color: var(--accent-red); opacity: 0.6;" onclick="window.removeFromSiparisBasket(${idx})">
                                        <i class="fa-solid fa-times"></i>
                                    </button>
                                </div>
                                <div style="margin-top: 0.75rem; display: flex; align-items: center; gap: 10px;">
                                    <input type="number" value="${item.quantity}" min="1" 
                                           style="width: 60px; background: rgba(0,0,0,0.3); border: 1px solid var(--glass-border); color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 0.8rem;"
                                           onchange="window.updateSiparisQty(${idx}, this.value)">
                                    <span style="font-size: 0.7rem; color: var(--text-dim);">ADET</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>

                    <div style="margin-bottom: 1.5rem;">
                        <label style="display: block; font-size: 0.65rem; color: var(--text-dim); font-weight: 800; letter-spacing: 1px; margin-bottom: 0.5rem;">TALEP NOTU (OPSİYONEL)</label>
                        <textarea id="siparis-note" class="cyber-input" style="width: 100%; height: 80px; resize: none; font-size: 0.8rem;" placeholder="Neden talep ettiğinizi buraya yazabilirsiniz..."></textarea>
                    </div>

                    <button class="btn-cyber" style="width: 100%; justify-content: center; padding: 1rem; ${basket.length === 0 || isSubmitting ? 'opacity: 0.5; pointer-events: none;' : ''}" 
                            onclick="window.submitSiparis()">
                        ${isSubmitting ? '<i class="fa-solid fa-circle-notch fa-spin"></i> GÖNDERİLİYOR...' : 'TALEBİ TAMAMLA <i class="fa-solid fa-paper-plane" style="margin-left: 0.5rem;"></i>'}
                    </button>
                </div>
            </div>

            <!-- Recent Requests -->
            <div style="margin-top: 3rem;">
                <h3 style="font-family: 'Rajdhani', sans-serif; margin-bottom: 1.5rem; color: var(--text-main);">Son Taleplerim</h3>
                <div class="glass-panel" style="padding: 1rem;">
                    <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
                        <thead>
                            <tr style="text-align: left; color: var(--text-dim); border-bottom: 1px solid var(--glass-border);">
                                <th style="padding: 1rem;">TARİH</th>
                                <th style="padding: 1rem;">DEPO</th>
                                <th style="padding: 1rem;">İÇERİK</th>
                                <th style="padding: 1rem;">DURUM</th>
                                <th style="padding: 1rem; text-align: right;">AKSİYON</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${myRequests.length === 0 ? `
                                <tr><td colspan="5" style="padding: 3rem; text-align: center; color: var(--text-dim);">Henüz bir talebiniz bulunmuyor.</td></tr>
                            ` : myRequests.map((r: any) => `
                                <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                                    <td style="padding: 1rem; color: var(--text-dim);">${r.timestamp?.toDate ? r.timestamp.toDate().toLocaleDateString('tr-TR') : '...'}</td>
                                    <td style="padding: 1rem; font-weight: 700;">${r.warehouseName}</td>
                                    <td style="padding: 1rem;">
                                        <div style="font-weight: 600;">${r.items.length} Kalem Malzeme</div>
                                        <div style="font-size: 0.7rem; color: var(--text-dim);">${r.items.slice(0, 2).map((i: any) => i.description).join(', ')}${r.items.length > 2 ? '...' : ''}</div>
                                    </td>
                                    <td style="padding: 1rem;">
                                        <span class="badge" style="background: ${getStatusColor(r.status, true)}; color: ${getStatusColor(r.status)}; border: 1px solid ${getStatusColor(r.status, true)};">
                                            ${r.status}
                                        </span>
                                    </td>
                                    <td style="padding: 1rem; text-align: right;">
                                        <button class="btn-cyber-outline" style="padding: 4px 10px; font-size: 0.65rem;" onclick="alert('Detaylar yakında...')">DETAY</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
};

const getStatusColor = (status: string, isBg = false) => {
    switch (status) {
        case 'APPROVED':
        case 'ORDERED': return isBg ? 'rgba(0, 230, 118, 0.1)' : 'var(--accent-green)';
        case 'REJECTED': return isBg ? 'rgba(255, 82, 82, 0.1)' : 'var(--accent-red)';
        case 'PARTIAL': return isBg ? 'rgba(255, 153, 0, 0.1)' : 'var(--accent-orange)';
        default: return isBg ? 'rgba(0, 114, 255, 0.1)' : 'var(--accent-blue)';
    }
};

(window as any).handleSiparisWhChange = (whId: string) => {
    selectedWhId = whId;
};

(window as any).handleSiparisSearch = (query: string) => {
    const resultsDiv = document.getElementById('siparis-results');
    if (!resultsDiv) return;

    if (query.length < 2) {
        resultsDiv.innerHTML = `
            <div style="padding: 3rem; text-align: center; color: var(--text-dim); opacity: 0.5;">
                <i class="fa-solid fa-search" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                <p>Arama yapmak için yazmaya başlayın...</p>
            </div>
        `;
        return;
    }

    const results = inventoryService.searchMaterials(query);
    if (results.length === 0) {
        resultsDiv.innerHTML = `<div style="padding: 3rem; text-align: center; color: var(--text-dim);">Eşleşen malzeme bulunamadı.</div>`;
        return;
    }

    resultsDiv.innerHTML = results.map(item => `
        <div class="hover-row-premium" style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.02); margin-bottom: 0.5rem; border-radius: 12px; transition: all 0.3s;">
            <div style="flex: 1;">
                <div style="font-weight: 700; color: var(--text-main); font-size: 0.85rem;">${item.d}</div>
                <div style="font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--accent-cyan); margin-top: 4px;">${item.n}</div>
            </div>
            <button class="btn-cyber" style="padding: 6px 12px; font-size: 0.7rem; background: rgba(0, 255, 255, 0.1); color: var(--accent-cyan); border: 1px solid rgba(0, 255, 255, 0.2);" 
                    onclick="window.addToSiparisBasket('${item.n}', '${item.d.replace(/'/g, "\\'")}')">
                <i class="fa-solid fa-plus"></i> EKLE
            </button>
        </div>
    `).join('');
};

(window as any).addToSiparisBasket = (n: string, d: string) => {
    const exists = basket.find(item => item.n === n);
    if (exists) {
        exists.quantity++;
    } else {
        basket.push({ n, d, quantity: 1 });
    }
    (window as any).render({ skipShell: true });
};

(window as any).removeFromSiparisBasket = (idx: number) => {
    basket.splice(idx, 1);
    (window as any).render({ skipShell: true });
};

(window as any).updateSiparisQty = (idx: number, val: string) => {
    const qty = parseInt(val);
    if (qty > 0) basket[idx].quantity = qty;
};

(window as any).submitSiparis = async () => {
    if (basket.length === 0) return;
    if (!selectedWhId) {
        alert('Lütfen bir depo seçin.');
        return;
    }

    isSubmitting = true;
    (window as any).render({ skipShell: true });

    try {
        const wh = dataService.getWarehouses().find(w => w.id === selectedWhId);
        const user = authService.getCurrentUser();
        const note = (document.getElementById('siparis-note') as HTMLTextAreaElement)?.value || '';

        const items = basket.map(item => ({
            itemId: item.n,
            description: item.d,
            sapNo: item.n,
            quantity: item.quantity,
            currentStock: 0,
            limit: 0
        }));

        await orderService.createPurchaseRequest(
            selectedWhId,
            wh?.name || 'Bilinmeyen Depo',
            items,
            user?.email || 'Bilinmeyen Kullanıcı',
            user?.displayName || 'Bilinmeyen İsim',
            'hursit.akter@demirerholding.com',
            note
        );

        basket = [];
        alert('Malzeme talebiniz başarıyla gönderildi.');
        (window as any).navigate('siparis');
    } catch (error) {
        console.error("Sipariş gönderme hatası:", error);
        alert('Hata oluştu!');
    } finally {
        isSubmitting = false;
        (window as any).render({ skipShell: true });
    }
};
