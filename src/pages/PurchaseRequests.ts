import { purchaseService } from '../services/PurchaseService';
import type { PurchaseRequest } from '../services/PurchaseService';

const formatDateTime = (ts: any) => {
  if (!ts) return '-';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('tr-TR');
};

export const PurchaseRequestsPage = async () => {
  const user = (window as any).currentUser;
  const isManager = user?.role === 'ADMIN' || user?.role === 'MALZEME_YONETIMI';

  // Fetch PENDING by default
  const requests = await purchaseService.getRequests('PENDING');

  (window as any)._purchaseRequests = requests;

  return `
    <div class="fade-in-up content-area">
      <div class="page-header" style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem;">
        <div>
          <h2 style="font-family: 'Rajdhani', sans-serif; font-size: 2rem; color: #64ffda; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 0.5rem;">
            <i class="fa-solid fa-file-invoice-dollar" style="margin-right: 0.5rem;"></i> Satın Alma Talepleri (PR)
          </h2>
          <p style="color: var(--text-dim); margin: 0; font-size: 0.9rem;">Otomatik oluşan veya manuel girilen malzeme tedarik talepleri.</p>
        </div>
        
        <div style="display: flex; gap: 1rem;">
          <select id="pr-status-filter" class="form-input" style="width: 150px; background: rgba(0,0,0,0.3);" onchange="window.filterPRs(this.value)">
            <option value="PENDING">Bekleyenler</option>
            <option value="APPROVED">Onaylananlar</option>
            <option value="ORDERED">Sipariş Edilenler</option>
            <option value="REJECTED">Reddedilenler</option>
            <option value="ALL">Tümü</option>
          </select>
        </div>
      </div>

      <div class="glass-panel" style="padding: 1.5rem; border-radius: 12px;">
        <table class="data-table" style="width: 100%; border-collapse: collapse; color: var(--text-main);">
          <thead>
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.1); color: var(--text-dim); font-size: 0.85rem; text-align: left;">
              <th style="padding: 1rem;">Tarih</th>
              <th style="padding: 1rem;">Malzeme (SAP)</th>
              <th style="padding: 1rem;">Depo</th>
              <th style="padding: 1rem;">Talep Miktarı</th>
              <th style="padding: 1rem;">Talep Eden</th>
              <th style="padding: 1rem;">Durum</th>
              <th style="padding: 1rem; text-align: right;">Aksiyon</th>
            </tr>
          </thead>
          <tbody id="pr-table-body">
            ${renderRows(requests, isManager)}
          </tbody>
        </table>
      </div>
    </div>
  `;
};

const renderRows = (requests: PurchaseRequest[], isManager: boolean) => {
  if (requests.length === 0) {
    return `<tr><td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">Kayıt bulunamadı.</td></tr>`;
  }

  return requests.map(req => {
    let statusBadge = '';
    if (req.status === 'PENDING') statusBadge = `<span style="background: rgba(234, 179, 8, 0.2); color: #eab308; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">BEKLİYOR</span>`;
    if (req.status === 'APPROVED') statusBadge = `<span style="background: rgba(34, 197, 94, 0.2); color: #22c55e; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">ONAYLANDI</span>`;
    if (req.status === 'REJECTED') statusBadge = `<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">REDDEDİLDİ</span>`;
    if (req.status === 'ORDERED') statusBadge = `<span style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; padding: 0.2rem 0.6rem; border-radius: 12px; font-size: 0.75rem;">SİPARİŞ VERİLDİ</span>`;

    let actions = '';
    if (req.status === 'PENDING' && isManager) {
      actions = `
        <button onclick="window.approvePR('${req.id}')" style="background: rgba(34, 197, 94, 0.2); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer; margin-right: 0.5rem;"><i class="fa-solid fa-check"></i> Onayla</button>
        <button onclick="window.rejectPR('${req.id}')" style="background: rgba(239, 68, 68, 0.2); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-xmark"></i> Reddet</button>
      `;
    } else if (req.status === 'APPROVED' && isManager) {
      actions = `
        <button onclick="window.markPROrdered('${req.id}')" style="background: rgba(56, 189, 248, 0.2); color: #38bdf8; border: 1px solid rgba(56,189,248,0.3); padding: 0.3rem 0.6rem; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-cart-arrow-down"></i> Sipariş Geçildi İşaretle</button>
      `;
    }

    return `
      <tr style="border-bottom: 1px solid rgba(255,255,255,0.05); transition: background 0.2s;">
        <td style="padding: 1rem;">${formatDateTime(req.requestedAt)}</td>
        <td style="padding: 1rem;">
          <div style="font-weight: 700;">${req.description}</div>
          <div style="font-size: 0.75rem; color: var(--text-dim);"><i class="fa-solid fa-barcode"></i> ${req.sapNo}</div>
        </td>
        <td style="padding: 1rem; font-size: 0.85rem;">${req.warehouseName}</td>
        <td style="padding: 1rem; font-weight: 800; color: #64ffda;">${req.requestedQty} Adet</td>
        <td style="padding: 1rem; font-size: 0.85rem;">${req.requestedBy}</td>
        <td style="padding: 1rem;">${statusBadge}</td>
        <td style="padding: 1rem; text-align: right;">${actions}</td>
      </tr>
    `;
  }).join('');
};

(window as any).filterPRs = async (status: string) => {
  const user = (window as any).currentUser;
  const isManager = user?.role === 'ADMIN' || user?.role === 'MALZEME_YONETIMI';
  
  const tbody = document.getElementById('pr-table-body');
  if (tbody) tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; padding: 2rem;"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</td></tr>`;
  
  const requests = await purchaseService.getRequests(status);
  (window as any)._purchaseRequests = requests;
  
  if (tbody) tbody.innerHTML = renderRows(requests, isManager);
};

(window as any).approvePR = async (id: string) => {
  const user = (window as any).currentUser;
  if (!user) return;
  
  if (confirm('Bu satın alma talebini onaylamak istediğinize emin misiniz?')) {
    try {
      await purchaseService.approveRequest(id, user.email);
      (window as any).showToast?.('Başarılı', 'Talep onaylandı.', 'success');
      const filter = (document.getElementById('pr-status-filter') as HTMLSelectElement)?.value || 'PENDING';
      await (window as any).filterPRs(filter);
    } catch (e) {
      console.error(e);
      (window as any).showToast?.('Hata', 'Onaylama sırasında hata oluştu.', 'error');
    }
  }
};

(window as any).rejectPR = async (id: string) => {
  const user = (window as any).currentUser;
  if (!user) return;
  
  const reason = prompt('Reddetme nedeni (İsteğe bağlı):');
  if (reason !== null) {
    try {
      await purchaseService.rejectRequest(id, user.email, reason);
      (window as any).showToast?.('Başarılı', 'Talep reddedildi.', 'success');
      const filter = (document.getElementById('pr-status-filter') as HTMLSelectElement)?.value || 'PENDING';
      await (window as any).filterPRs(filter);
    } catch (e) {
      console.error(e);
      (window as any).showToast?.('Hata', 'İşlem başarısız.', 'error');
    }
  }
};

(window as any).markPROrdered = async (id: string) => {
  if (confirm('Bu talebin siparişinin tedarikçiye geçildiğini onaylıyor musunuz?')) {
    try {
      await purchaseService.markAsOrdered(id);
      (window as any).showToast?.('Başarılı', 'Sipariş durumu güncellendi.', 'success');
      const filter = (document.getElementById('pr-status-filter') as HTMLSelectElement)?.value || 'APPROVED';
      await (window as any).filterPRs(filter);
    } catch (e) {
      console.error(e);
      (window as any).showToast?.('Hata', 'İşlem başarısız.', 'error');
    }
  }
};
