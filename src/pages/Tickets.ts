import { ticketService } from '../services/TicketService';
import type { Ticket, TicketMessage } from '../services/TicketService';
import { dataService } from '../services/DataService';
import { inventoryService } from '../services/InventoryService'; // For image upload compression

let allTickets: Ticket[] = [];
let currentTicketId: string | null = null;
let unsubscribeTickets: (() => void) | null = null;
let unsubscribeMessages: (() => void) | null = null;

export const TicketsPage = async () => {
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  // Setup UI structure
  const html = `
    <div class="tickets-container fade-in-up">
      <!-- LEFT PANEL: TICKET LIST -->
      <div class="tickets-sidebar glass-panel">
        <div class="tickets-header">
          <h2 style="margin:0; font-family:'Rajdhani'; color:var(--accent-cyan); display:flex; align-items:center; gap:8px;">
            <i class="fa-solid fa-headset"></i> SAHA DESTEK
          </h2>
          <button class="btn-cyber-outline" onclick="window.openNewTicketModal()" style="padding: 6px 12px; font-size: 0.75rem;">
            <i class="fa-solid fa-plus"></i> Yeni kayıt oluştur
          </button>
        </div>
        
        <div class="tickets-filters">
          <select id="ticket-status-filter" onchange="window.renderTicketList()" class="cyber-input" style="padding: 6px; font-size: 0.75rem;">
            <option value="all">Tüm Durumlar</option>
            <option value="open">Açık</option>
            <option value="in_progress">İşlemde</option>
            <option value="resolved">Çözüldü</option>
          </select>
        </div>

        <div id="tickets-list" class="tickets-list">
           <div style="text-align:center; padding: 2rem; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Yükleniyor...</div>
        </div>
      </div>

      <!-- RIGHT PANEL: CHAT / DETAILS -->
      <div class="tickets-main glass-panel" id="ticket-main-area">
        <div class="empty-ticket-state">
          <i class="fa-solid fa-comments" style="font-size: 3rem; opacity: 0.2; margin-bottom: 1rem;"></i>
          <p>Lütfen detaylarını görmek için soldan bir bilet seçin.</p>
        </div>
      </div>
    </div>

    <!-- NEW TICKET MODAL -->
    <div id="new-ticket-modal" class="modal-overlay hidden" style="z-index: 99999;">
      <div class="glass-panel" style="max-width: 500px; width: 95%; margin: auto; border: 1px solid rgba(0, 242, 254, 0.3);">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-family: 'Rajdhani'; color: var(--accent-cyan);"><i class="fa-solid fa-ticket"></i> Yeni kayıt oluşturmak için bilgileri doldurunuz</h3>
          <button onclick="window.closeNewTicketModal()" class="modal-close-btn"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
          
          <div>
            <label class="input-label">İLGİLİ TÜRBİN</label>
            <select id="nt-turbine" class="cyber-input" style="width: 100%;">
              <option value="">Seçiniz...</option>
              ${dataService.getSites().map(site => `
                <optgroup label="${site.name}">
                  ${dataService.getTurbinesBySite(site.id).map(t => `<option value="${t.id}">${t.label || t.id}</option>`).join('')}
                </optgroup>
              `).join('')}
            </select>
          </div>

          <div>
            <label class="input-label">KONU / BAŞLIK</label>
            <input type="text" id="nt-title" class="cyber-input" placeholder="Örn: Vida gevşemesi problemi" style="width: 100%;">
          </div>

          <div>
            <label class="input-label">AÇIKLAMA</label>
            <textarea id="nt-desc" class="cyber-input" rows="4" placeholder="Sorunu veya fikrinizi detaylıca anlatın..." style="width: 100%; resize: vertical;"></textarea>
          </div>

          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
            <div>
              <label class="input-label">ÖNCELİK</label>
              <select id="nt-priority" class="cyber-input" style="width: 100%;">
                <option value="low">🟢 Düşük</option>
                <option value="normal" selected>🟡 Normal</option>
                <option value="high">🔴 Acil</option>
              </select>
            </div>
            <div>
              <label class="input-label">FOTOĞRAF (Opsiyonel)</label>
              <input type="file" id="nt-photo" accept="image/*" class="cyber-input" style="width: 100%; padding: 6px;">
            </div>
          </div>

          <button onclick="window.submitNewTicket()" class="btn-cyber" style="margin-top: 1rem; width: 100%; justify-content: center;">Servis merkezine bildirim gönder</button>
        </div>
      </div>
    </div>

    <!-- IMAGE PREVIEW MODAL -->
    <div id="ticket-image-modal" class="modal-overlay hidden" style="z-index: 100000; align-items: center; justify-content: center;" onclick="this.classList.add('hidden')">
      <img id="ticket-image-preview-img" src="" style="max-width: 90vw; max-height: 90vh; border-radius: 8px; box-shadow: 0 0 50px rgba(0,0,0,0.8);">
    </div>

    <style>
      .tickets-container { display: flex; height: calc(100vh - 100px); gap: 1rem; }
      .tickets-sidebar { width: 350px; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
      .tickets-header { padding: 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,242,254,0.05); }
      .tickets-filters { padding: 0.75rem 1rem; border-bottom: 1px solid rgba(255,255,255,0.05); }
      .tickets-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
      .tickets-main { flex: 1; display: flex; flex-direction: column; padding: 0; overflow: hidden; }
      
      .ticket-item { padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem; cursor: pointer; transition: all 0.2s; border: 1px solid transparent; background: rgba(255,255,255,0.02); }
      .ticket-item:hover { background: rgba(255,255,255,0.05); }
      .ticket-item.active { background: rgba(0,242,254,0.1); border-color: rgba(0,242,254,0.3); }
      .ticket-item.unread { border-left: 3px solid var(--accent-cyan); }
      
      .ti-top { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 0.7rem; font-weight: 800; }
      .ti-no { color: var(--text-muted); }
      .ti-date { color: var(--text-muted); font-size: 0.65rem; }
      .ti-title { font-weight: 600; font-size: 0.9rem; color: var(--text-main); margin-bottom: 6px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .ti-bottom { display: flex; justify-content: space-between; align-items: center; }
      .ti-turbine { font-size: 0.7rem; color: #a78bfa; background: rgba(167,139,250,0.1); padding: 2px 6px; border-radius: 4px; }
      
      .status-badge { font-size: 0.6rem; font-weight: 800; padding: 3px 8px; border-radius: 12px; }
      .status-open { background: rgba(239,68,68,0.1); color: #ef4444; border: 1px solid rgba(239,68,68,0.2); }
      .status-in_progress { background: rgba(245,158,11,0.1); color: #f59e0b; border: 1px solid rgba(245,158,11,0.2); }
      .status-resolved { background: rgba(16,185,129,0.1); color: #10b981; border: 1px solid rgba(16,185,129,0.2); }

      .empty-ticket-state { height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; color: var(--text-muted); }
      
      .chat-header { padding: 1rem 1.5rem; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); }
      .chat-messages { flex: 1; overflow-y: auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
      .chat-input-area { padding: 1rem; border-top: 1px solid rgba(255,255,255,0.05); background: rgba(0,0,0,0.2); display: flex; gap: 0.5rem; align-items: flex-end; }
      
      .msg-bubble { max-width: 75%; padding: 0.75rem 1rem; border-radius: 12px; font-size: 0.85rem; position: relative; }
      .msg-row { display: flex; width: 100%; }
      .msg-row.me { justify-content: flex-end; }
      .msg-row.other { justify-content: flex-start; }
      
      .msg-row.me .msg-bubble { background: rgba(0,242,254,0.15); border: 1px solid rgba(0,242,254,0.3); border-bottom-right-radius: 4px; }
      .msg-row.other .msg-bubble { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-bottom-left-radius: 4px; }
      
      .msg-sender { font-size: 0.65rem; font-weight: 800; color: #a78bfa; margin-bottom: 4px; }
      .msg-time { font-size: 0.6rem; color: var(--text-muted); text-align: right; margin-top: 6px; }
      .msg-photo { max-width: 200px; border-radius: 8px; margin-top: 8px; cursor: pointer; border: 1px solid rgba(255,255,255,0.1); }
      
      .input-label { font-size: 0.65rem; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; margin-bottom: 6px; display: block; }
      
      @media (max-width: 768px) {
        .tickets-container { flex-direction: column; height: auto; }
        .tickets-sidebar { width: 100%; height: 40vh; }
        .tickets-main { height: 60vh; }
        .chat-messages { padding: 1rem; }
      }
    </style>
  `;

  // Initialize data fetching
  setTimeout(async () => {
    // Try to get data once first so UI doesn't hang if index is building
    allTickets = await ticketService.getTicketsOnce(isAdmin, currentUser.uid);
    (window as any).renderTicketList();

    if (unsubscribeTickets) unsubscribeTickets();
    unsubscribeTickets = ticketService.subscribeToTickets(isAdmin, currentUser.uid, (tickets) => {
      allTickets = tickets;
      (window as any).renderTicketList();
      
      // If we have an active ticket, update its UI (status etc)
      if (currentTicketId) {
        const activeT = allTickets.find(t => t.id === currentTicketId);
        if (activeT) (window as any).renderChatHeader(activeT, isAdmin);
      }

      // Update global unread badge
      const unreadCount = tickets.filter(t => isAdmin ? t.unreadAdmin : t.unreadUser).length;
      const bell = document.getElementById('topbar-ticket-bell');
      if (bell) {
        if (unreadCount > 0) {
          bell.innerHTML = `<i class="fa-solid fa-bell fa-shake" style="color: #f59e0b;"></i><span class="notification-dot">${unreadCount}</span>`;
        } else {
          bell.innerHTML = `<i class="fa-solid fa-bell"></i>`;
        }
      }
    });
  }, 100);

  // Cleanup on unmount
  (window as any)._currentUnsubscribe = () => {
    if (unsubscribeTickets) unsubscribeTickets();
    if (unsubscribeMessages) unsubscribeMessages();
  };

  return html;
};

// --- WINDOW FUNCTIONS ---

(window as any).renderTicketList = () => {
  const container = document.getElementById('tickets-list');
  const filter = (document.getElementById('ticket-status-filter') as HTMLSelectElement)?.value || 'all';
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  if (!container) return;

  let filtered = allTickets;
  if (filter !== 'all') {
    filtered = allTickets.filter(t => t.status === filter);
  }

  if (filtered.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding: 2rem; color:var(--text-muted); font-size:0.8rem;">Gösterilecek bilet bulunamadı.</div>`;
    return;
  }

  const statusLabels: Record<string, string> = { open: 'AÇIK', in_progress: 'İŞLEMDE', resolved: 'ÇÖZÜLDÜ', closed: 'KAPALI' };
  const prioIcons: Record<string, string> = { low: '🟢', normal: '🟡', high: '🔴' };

  container.innerHTML = filtered.map(t => {
    const isUnread = isAdmin ? t.unreadAdmin : t.unreadUser;
    const dateStr = t.updatedAt ? new Date(t.updatedAt.toMillis()).toLocaleString('tr-TR', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'}) : '';
    
    return `
      <div class="ticket-item ${t.id === currentTicketId ? 'active' : ''} ${isUnread ? 'unread' : ''}" onclick="window.openTicket('${t.id}')">
        <div class="ti-top">
          <span class="ti-no">${t.ticketNo}</span>
          <span class="ti-date">${dateStr}</span>
        </div>
        <div class="ti-title">${prioIcons[t.priority] || '🟡'} ${t.title}</div>
        <div class="ti-bottom">
          <span class="ti-turbine"><i class="fa-solid fa-wind"></i> ${t.turbineName}</span>
          <span class="status-badge status-${t.status}">${statusLabels[t.status]}</span>
        </div>
      </div>
    `;
  }).join('');
};

(window as any).openTicket = async (id: string) => {
  currentTicketId = id;
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';
  const ticket = allTickets.find(t => t.id === id);
  if (!ticket) return;

  (window as any).renderTicketList(); // update active state

  // Mark as read
  if ((isAdmin && ticket.unreadAdmin) || (!isAdmin && ticket.unreadUser)) {
    await ticketService.markAsRead(id, isAdmin);
  }

  const mainArea = document.getElementById('ticket-main-area');
  if (!mainArea) return;

  mainArea.innerHTML = `
    <div id="chat-header-container"></div>
    <div class="chat-messages" id="chat-messages">
      <div style="text-align:center; color:var(--text-muted);"><i class="fa-solid fa-circle-notch fa-spin"></i> Mesajlar yükleniyor...</div>
    </div>
    ${ticket.status !== 'resolved' ? `
    <div class="chat-input-area">
      <label for="chat-photo-upload" class="btn-cyber-outline" style="padding: 10px; cursor: pointer;" title="Fotoğraf Ekle">
        <i class="fa-solid fa-camera"></i>
      </label>
      <input type="file" id="chat-photo-upload" accept="image/*" style="display:none;" onchange="window.handleChatPhotoSelect(event)">
      
      <div style="flex:1; position: relative;">
        <div id="chat-photo-preview" style="display:none; position:absolute; bottom: 100%; left: 0; background: #222; padding: 4px; border-radius: 4px; border: 1px solid #444; margin-bottom: 8px;">
          <img id="cp-img" src="" style="height: 50px; border-radius: 4px;">
          <i class="fa-solid fa-xmark" style="position:absolute; top:-5px; right:-5px; background:red; border-radius:50%; width:16px; height:16px; text-align:center; font-size:10px; line-height:16px; cursor:pointer;" onclick="window.clearChatPhoto()"></i>
        </div>
        <textarea id="chat-input-text" class="cyber-input" rows="1" placeholder="Mesajınızı yazın..." style="width: 100%; resize: none; overflow: hidden; padding-top: 12px; padding-bottom: 12px;" oninput="this.style.height = ''; this.style.height = Math.min(this.scrollHeight, 100) + 'px';"></textarea>
      </div>
      
      <button class="btn-cyber" onclick="window.sendChatMessage()" style="padding: 10px 16px;">
        <i class="fa-solid fa-paper-plane"></i>
      </button>
    </div>
    ` : `
    <div style="padding: 1rem; text-align: center; background: rgba(16,185,129,0.1); color: #10b981; font-weight: 600; border-top: 1px solid rgba(16,185,129,0.2);">
      <i class="fa-solid fa-circle-check"></i> Bu bilet çözüldü olarak işaretlenmiş ve kapatılmıştır.
    </div>
    `}
  `;

  (window as any).renderChatHeader(ticket, isAdmin);

  if (unsubscribeMessages) unsubscribeMessages();
  unsubscribeMessages = ticketService.subscribeToMessages(id, (messages) => {
    const msgsContainer = document.getElementById('chat-messages');
    if (!msgsContainer) return;

    if (messages.length === 0) {
      msgsContainer.innerHTML = `<div style="text-align:center; color:var(--text-muted); font-size:0.8rem; margin-top:2rem;">Henüz mesaj yok. İlk mesajı siz yazın.</div>`;
      return;
    }

    msgsContainer.innerHTML = messages.map(m => {
      const isMe = m.senderUid === currentUser.uid;
      const timeStr = m.createdAt ? new Date(m.createdAt.toMillis()).toLocaleString('tr-TR', { hour:'2-digit', minute:'2-digit' }) : '';
      return `
        <div class="msg-row ${isMe ? 'me' : 'other'}">
          <div class="msg-bubble">
            ${!isMe ? `<div class="msg-sender">${m.senderName}</div>` : ''}
            <div>${m.text.replace(/\n/g, '<br>')}</div>
            ${m.photoUrl ? `<img src="${m.photoUrl}" class="msg-photo" onclick="window.showTicketImage('${m.photoUrl}')">` : ''}
            <div class="msg-time">${timeStr}</div>
          </div>
        </div>
      `;
    }).join('');

    // Scroll to bottom
    setTimeout(() => {
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    }, 100);
  });
};

(window as any).renderChatHeader = (ticket: Ticket, isAdmin: boolean) => {
  const container = document.getElementById('chat-header-container');
  if (!container) return;

  const prioColors = { low: '#10b981', normal: '#f59e0b', high: '#ef4444' };
  const prioLabels = { low: 'Düşük', normal: 'Normal', high: 'Acil' };

  container.innerHTML = `
    <div class="chat-header">
      <div>
        <div style="font-family:'Rajdhani'; font-size:1.1rem; font-weight:700; color:var(--text-main);">${ticket.title}</div>
        <div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">
          <span style="color:var(--accent-cyan);">${ticket.ticketNo}</span> • 
          <i class="fa-solid fa-wind"></i> ${ticket.turbineName} • 
          Oluşturan: ${ticket.createdByName}
        </div>
      </div>
      <div style="display: flex; gap: 0.5rem; align-items: center;">
        <span style="font-size:0.65rem; border:1px solid ${prioColors[ticket.priority]}; color:${prioColors[ticket.priority]}; padding:2px 6px; border-radius:12px;">Öncelik: ${prioLabels[ticket.priority]}</span>
        
        ${isAdmin ? `
          <select class="cyber-input" style="padding: 4px 8px; font-size: 0.75rem; height: auto;" onchange="window.changeTicketStatus('${ticket.id}', this.value)">
            <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Açık</option>
            <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>İşlemde</option>
            <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Çözüldü</option>
          </select>
          <button class="btn-cyber-outline" style="padding: 4px 8px; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="window.deleteTicket('${ticket.id}')" title="Bileti Sil"><i class="fa-solid fa-trash"></i></button>
        ` : ''}
      </div>
    </div>
  `;
};

(window as any).changeTicketStatus = async (id: string, status: any) => {
  try {
    await ticketService.updateTicketStatus(id, status);
    (window as any).openTicket(id); // Her zaman re-render yap (Mesaj kutusunu açıp kapatmak için)
  } catch(e) {
    (window as any).showToast?.('HATA', 'Durum güncellenemedi.', 'error');
  }
};

(window as any).deleteTicket = async (id: string) => {
  if(!confirm("Bu bileti ve tüm mesajlarını silmek istediğinize emin misiniz?")) return;
  try {
    await ticketService.deleteTicket(id);
    currentTicketId = null;
    (window as any).navigate('tickets');
  } catch(e) {
     (window as any).showToast?.('HATA', 'Silme işlemi başarısız.', 'error');
  }
}

// --- MESSAGE SENDING LOGIC ---
let pendingChatPhotoBase64 = '';

(window as any).handleChatPhotoSelect = async (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  
  (window as any).showToast?.('BİLGİ', 'Fotoğraf işleniyor...', 'info');
  try {
    // Reuse the inventory image compression logic
    const base64 = await inventoryService.uploadMaterialImage('temp', 'temp', file);
    pendingChatPhotoBase64 = base64;
    
    document.getElementById('chat-photo-preview')!.style.display = 'block';
    (document.getElementById('cp-img') as HTMLImageElement).src = base64;
  } catch (err) {
    (window as any).showToast?.('HATA', 'Fotoğraf işlenemedi.', 'error');
  }
};

(window as any).clearChatPhoto = () => {
  pendingChatPhotoBase64 = '';
  document.getElementById('chat-photo-preview')!.style.display = 'none';
  (document.getElementById('chat-photo-upload') as HTMLInputElement).value = '';
};

(window as any).sendChatMessage = async () => {
  if (!currentTicketId) return;
  const textInput = document.getElementById('chat-input-text') as HTMLTextAreaElement;
  const text = textInput.value.trim();
  
  if (!text && !pendingChatPhotoBase64) return;
  
  const currentUser = (window as any).currentUser;
  const isAdmin = currentUser?.role?.toUpperCase() === 'ADMIN';

  try {
    await ticketService.sendMessage(
      currentTicketId, 
      currentUser.uid, 
      currentUser.displayName || 'Kullanıcı', 
      text, 
      isAdmin, 
      pendingChatPhotoBase64 || undefined
    );
    
    textInput.value = '';
    textInput.style.height = '';
    (window as any).clearChatPhoto();
  } catch (e) {
    (window as any).showToast?.('HATA', 'Mesaj gönderilemedi.', 'error');
  }
};


// --- NEW TICKET LOGIC ---

(window as any).openNewTicketModal = () => {
  document.getElementById('new-ticket-modal')?.classList.remove('hidden');
  (document.getElementById('nt-turbine') as HTMLSelectElement).value = '';
  (document.getElementById('nt-title') as HTMLInputElement).value = '';
  (document.getElementById('nt-desc') as HTMLTextAreaElement).value = '';
  (document.getElementById('nt-priority') as HTMLSelectElement).value = 'normal';
  (document.getElementById('nt-photo') as HTMLInputElement).value = '';
};

(window as any).closeNewTicketModal = () => {
  document.getElementById('new-ticket-modal')?.classList.add('hidden');
};

(window as any).submitNewTicket = async () => {
  const turbineId = (document.getElementById('nt-turbine') as HTMLSelectElement).value;
  const title = (document.getElementById('nt-title') as HTMLInputElement).value.trim();
  const desc = (document.getElementById('nt-desc') as HTMLTextAreaElement).value.trim();
  const priority = (document.getElementById('nt-priority') as HTMLSelectElement).value;
  const photoFile = (document.getElementById('nt-photo') as HTMLInputElement).files?.[0];

  if (!turbineId || !title || !desc) {
    (window as any).showToast?.('HATA', 'Lütfen türbin, başlık ve açıklama alanlarını doldurun.', 'error');
    return;
  }

  const currentUser = (window as any).currentUser;
  const btn = document.querySelector('#new-ticket-modal .btn-cyber') as HTMLButtonElement;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> GÖNDERİLİYOR...';
  btn.disabled = true;

  try {
    let initialPhotoUrl = undefined;
    if (photoFile) {
       initialPhotoUrl = await inventoryService.uploadMaterialImage('temp', 'temp', photoFile);
    }

    const ticketPayload: any = {
      turbineId,
      title,
      description: desc,
      priority: priority as any,
      status: 'open',
      createdByUid: currentUser.uid,
      createdByName: currentUser.displayName || 'Kullanıcı'
    };
    if (initialPhotoUrl) {
      ticketPayload.photoUrl = initialPhotoUrl;
    }

    const ticketId = await ticketService.createTicket(ticketPayload);

    // Add initial description as first message for context
    await ticketService.sendMessage(ticketId, currentUser.uid, currentUser.displayName || 'Kullanıcı', desc, false, initialPhotoUrl);

    (window as any).showToast?.('BAŞARILI', 'Bilet başarıyla oluşturuldu.', 'success');
    (window as any).closeNewTicketModal();
    (window as any).openTicket(ticketId); // Auto open
  } catch (e: any) {
    console.error("Ticket Creation Error:", e);
    (window as any).showToast?.('HATA', `Bilet oluşturulamadı: ${e?.message || e}`, 'error');
  } finally {
    btn.innerHTML = 'Servis merkezine bildirim gönder';
    btn.disabled = false;
  }
};

(window as any).showTicketImage = (src: string) => {
  const modal = document.getElementById('ticket-image-modal');
  const img = document.getElementById('ticket-image-preview-img') as HTMLImageElement;
  if (modal && img) {
    img.src = src;
    modal.classList.remove('hidden');
    modal.style.display = 'flex';
  }
};
