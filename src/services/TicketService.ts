import { db } from '../firebase';
import { collection, doc, addDoc, updateDoc, onSnapshot, query, orderBy, serverTimestamp, getDocs, where, deleteDoc } from 'firebase/firestore';
import { dataService } from './DataService';

export interface TicketMessage {
  id?: string;
  ticketId: string;
  senderUid: string;
  senderName: string;
  text: string;
  photoUrl?: string;
  createdAt: any;
}

export interface Ticket {
  id: string;
  ticketNo: string;
  turbineId: string;
  turbineName: string;
  title: string;
  description: string;
  priority: 'low' | 'normal' | 'high';
  status: 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed';
  createdByUid: string;
  createdByName: string;
  createdAt: any;
  updatedAt: any;
  unreadAdmin: boolean;
  unreadUser: boolean;
  photoUrl?: string; // İsteğe bağlı
}

class TicketService {
  private ticketsCol = collection(db, 'tickets');
  private messagesCol = collection(db, 'ticket_messages');

  /**
   * Listen to all tickets (for Admin) or tickets created by a specific user.
   */
  subscribeToTickets(isAdmin: boolean, userUid: string, callback: (tickets: Ticket[]) => void): () => void {
    let q = query(this.ticketsCol, orderBy('updatedAt', 'desc'));
    
    if (!isAdmin) {
      // Remove orderBy to prevent requiring a composite index. We will sort locally.
      q = query(this.ticketsCol, where('createdByUid', '==', userUid));
    }

    return onSnapshot(q, (snapshot) => {
      const tickets: Ticket[] = [];
      snapshot.forEach(doc => {
        tickets.push({ id: doc.id, ...doc.data() } as Ticket);
      });
      // Sort locally safely
      tickets.sort((a,b) => {
        const timeA = typeof a.updatedAt?.toMillis === 'function' ? a.updatedAt.toMillis() : 0;
        const timeB = typeof b.updatedAt?.toMillis === 'function' ? b.updatedAt.toMillis() : 0;
        return timeB - timeA;
      });
      callback(tickets);
    }, (error) => {
      console.error("Error subscribing to tickets:", error);
      if (typeof window !== 'undefined') {
        (window as any).showToast?.('BAĞLANTI HATASI', `Biletler canlı dinlenemiyor: ${error.message || error}`, 'error');
      }
      // callback([]); // DONT wipe the UI!
    });
  }

  /**
   * Fetch tickets once (fallback if index is missing for onSnapshot)
   */
  async getTicketsOnce(isAdmin: boolean, userUid: string): Promise<Ticket[]> {
     try {
       const q = isAdmin ? this.ticketsCol : query(this.ticketsCol, where('createdByUid', '==', userUid));
       const snap = await getDocs(q);
       const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket));
       return results.sort((a,b) => (b.updatedAt?.toMillis() || 0) - (a.updatedAt?.toMillis() || 0));
     } catch(e) {
       console.error(e);
       return [];
     }
  }

  /**
   * Listen to messages for a specific ticket.
   */
  subscribeToMessages(ticketId: string, callback: (messages: TicketMessage[]) => void): () => void {
    // Remove orderBy to prevent requiring a composite index. We will sort locally.
    const q = query(this.messagesCol, where('ticketId', '==', ticketId));
    return onSnapshot(q, (snapshot) => {
      const messages: TicketMessage[] = [];
      snapshot.forEach(doc => {
        messages.push({ id: doc.id, ...doc.data() } as TicketMessage);
      });
      
      // Sort locally safely (asc)
      messages.sort((a,b) => {
        const timeA = typeof a.createdAt?.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const timeB = typeof b.createdAt?.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        return timeA - timeB;
      });
      
      callback(messages);
    }, (error) => {
      console.error("Error subscribing to messages:", error);
      if (typeof window !== 'undefined') {
        (window as any).showToast?.('HATA', 'Mesajlar yüklenemedi, indeks eksik olabilir.', 'error');
      }
      callback([]); // Call with empty array so it doesn't get stuck on loading forever
    });
  }

  /**
   * Create a new ticket
   */
  async createTicket(data: Omit<Ticket, 'id' | 'ticketNo' | 'createdAt' | 'updatedAt' | 'unreadAdmin' | 'unreadUser' | 'turbineName'>): Promise<string> {
    const allTurbines = dataService.getSites().flatMap(s => dataService.getTurbinesBySite(s.id));
    const turbine = allTurbines.find(t => t.id === data.turbineId);
    
    const countSnap = await getDocs(query(this.ticketsCol));
    const nextNum = countSnap.size + 1;
    const ticketNo = `DESTEK-${new Date().getFullYear()}${String(new Date().getMonth()+1).padStart(2,'0')}-${String(nextNum).padStart(4, '0')}`;

    const newTicket = {
      ...data,
      ticketNo,
      turbineName: turbine ? (turbine.label || turbine.id) : 'Bilinmeyen Türbin',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      unreadAdmin: true,
      unreadUser: false,
    };

    const docRef = await addDoc(this.ticketsCol, newTicket);
    return docRef.id;
  }

  /**
   * Send a message in a ticket
   */
  async sendMessage(ticketId: string, senderUid: string, senderName: string, text: string, isAdmin: boolean, photoUrl?: string) {
    // 1. Add message
    const msg: TicketMessage = {
      ticketId,
      senderUid,
      senderName,
      text,
      createdAt: serverTimestamp()
    };
    if (photoUrl) msg.photoUrl = photoUrl;
    
    await addDoc(this.messagesCol, msg);

    // 2. Update ticket status & unread flags
    const ticketRef = doc(db, 'tickets', ticketId);
    const updates: any = { updatedAt: serverTimestamp() };
    
    if (isAdmin) {
      updates.unreadUser = true;
      updates.status = 'in_progress'; // Automatically move to in progress if admin replies
    } else {
      updates.unreadAdmin = true;
    }

    await updateDoc(ticketRef, updates);
  }

  /**
   * Update ticket status (Admin only)
   */
  async updateTicketStatus(ticketId: string, status: Ticket['status']): Promise<void> {
    const ticketRef = doc(db, 'tickets', ticketId);
    await updateDoc(ticketRef, { status, updatedAt: serverTimestamp() });
  }

  /**
   * Update ticket title
   */
  async updateTicketTitle(ticketId: string, newTitle: string): Promise<void> {
    const ticketRef = doc(db, 'tickets', ticketId);
    await updateDoc(ticketRef, { title: newTitle, updatedAt: serverTimestamp() });
  }

  /**
   * Mark ticket as read
   */
  async markAsRead(ticketId: string, isAdmin: boolean) {
    const ref = doc(db, 'tickets', ticketId);
    if (isAdmin) {
      await updateDoc(ref, { unreadAdmin: false });
    } else {
      await updateDoc(ref, { unreadUser: false });
    }
  }

  async deleteTicket(ticketId: string) {
    // Mesajları sil
    const msgs = await getDocs(query(this.messagesCol, where('ticketId', '==', ticketId)));
    for(const m of msgs.docs) {
      await deleteDoc(doc(db, 'ticket_messages', m.id));
    }
    // Bileti sil
    await deleteDoc(doc(db, 'tickets', ticketId));
  }
}

export const ticketService = new TicketService();
