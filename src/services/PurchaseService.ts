import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, where } from 'firebase/firestore';

export interface PurchaseDelivery {
  invoiceNo: string;       // Fatura / İrsaliye No (örn: 54304811)
  deliveryDate: string;    // Teslimat Tarihi (örn: 2026-02-10)
  invoiceDate: string;     // Fatura Tarihi (örn: 2026-02-17)
  quantity: number;        // Bu teslimatta gelen adet
}

export interface PurchaseRequest {
  id?: string;
  sapNo: string;
  description: string;
  requestedQty: number;
  warehouseId: string;
  warehouseName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ORDERED' | 'DELIVERED' | 'INVOICED' | 'COMPLETED';
  requestedBy: string; 
  requestedAt: any;
  approvedBy?: string;
  approvedAt?: any;
  notes?: string;
  estimatedCost?: number;
  currency?: string;
  orderedAt?: any;
  deliveryNoteNo?: string;
  deliveredAt?: any;
  invoiceNo?: string;
  invoicedAt?: any;
  completedAt?: any;
  urgency?: 'Düşük' | 'Orta' | 'Yüksek' | 'Kritik';
  unit?: string;
  targetDeliveryDate?: string;
  costCenter?: string;
  suggestedSupplier?: string;
  attachments?: { name: string; size: number; type: string; base64: string; }[];
  
  // Excel Tracking Fields
  plantCode?: string;
  orderDate?: string;
  orderNo?: string;
  plantAbbreviation?: string;
  realOwner?: string;
  arrivedQty?: number;
  unitPriceQuote?: number;
  totalPriceQuote?: number;
  unitPriceInvoice?: number;
  totalPriceInvoice?: number;
  logisticCost?: number;
  arrivedProductsTotal?: number;
  openOrderTotal?: number;
  deliveries?: PurchaseDelivery[];
}

class PurchaseService {
  private colRef = collection(db, 'purchase_requests');

  async createRequest(pr: Omit<PurchaseRequest, 'id' | 'status' | 'requestedAt'>) {
    const docRef = await addDoc(this.colRef, {
      ...pr,
      status: 'PENDING',
      requestedAt: serverTimestamp()
    });
    return docRef.id;
  }

  async getRequests(status?: string): Promise<PurchaseRequest[]> {
    const q = query(this.colRef, orderBy('requestedAt', 'desc'));
    const snap = await getDocs(q);
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() } as PurchaseRequest));
    
    if (status && status !== 'ALL') {
      results = results.filter(r => r.status === status);
    }
    
    return results;
  }

  async approveRequest(id: string, approver: string, estimatedCost?: number, currency?: string) {
    const docRef = doc(db, 'purchase_requests', id);
    const updates: any = {
      status: 'APPROVED',
      approvedBy: approver,
      approvedAt: serverTimestamp()
    };
    if (estimatedCost !== undefined) updates.estimatedCost = estimatedCost;
    if (currency) updates.currency = currency;
    
    await updateDoc(docRef, updates);
  }

  async rejectRequest(id: string, approver: string, reason?: string) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      status: 'REJECTED',
      approvedBy: approver,
      approvedAt: serverTimestamp(),
      notes: reason || 'Reddedildi'
    });
  }

  async markAsOrdered(id: string) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      status: 'ORDERED',
      orderedAt: serverTimestamp()
    });
  }

  async markAsDelivered(id: string, deliveryNoteNo: string) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      status: 'DELIVERED',
      deliveryNoteNo,
      deliveredAt: serverTimestamp()
    });
  }

  async markAsInvoiced(id: string, invoiceNo: string) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      status: 'INVOICED',
      invoiceNo,
      invoicedAt: serverTimestamp()
    });
  }

  async markAsCompleted(id: string) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      status: 'COMPLETED',
      completedAt: serverTimestamp()
    });
  }

  async updatePurchaseRequestDetails(id: string, data: Partial<PurchaseRequest>) {
    const docRef = doc(db, 'purchase_requests', id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  }
}

export const purchaseService = new PurchaseService();
