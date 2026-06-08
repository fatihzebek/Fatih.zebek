import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';

export interface PurchaseRequest {
  id?: string;
  warehouseId: string;
  warehouseName: string;
  items: {
    itemId: string;
    description: string;
    sapNo: string;
    quantity: number;
    currentStock: number;
    limit: number;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    note?: string;
  }[];
  requester: string;
  requesterName?: string;
  targetApprover?: string;
  requesterNote?: string;
  managerNote?: string;
  status: 'PENDING' | 'PARTIAL' | 'APPROVED' | 'ORDERED' | 'REJECTED';
  timestamp: any;
}

class OrderService {
  private collectionRef = collection(db, 'purchaseRequests');

  async createPurchaseRequest(
    warehouseId: string, 
    warehouseName: string, 
    items: any[], 
    requester: string, 
    requesterName: string = '',
    targetApprover: string = '',
    requesterNote: string = ''
  ) {
    const processedItems = items.map(item => ({
      ...item,
      status: 'PENDING',
      note: ''
    }));

    const result = await addDoc(this.collectionRef, {
      warehouseId,
      warehouseName,
      items: processedItems,
      requester,
      requesterName,
      targetApprover,
      requesterNote,
      status: 'PENDING',
      timestamp: serverTimestamp()
    });
    return result;
  }

  async getRequests() {
    const q = query(this.collectionRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as PurchaseRequest));
  }

  async updateRequest(id: string, data: Partial<PurchaseRequest>) {
    const docRef = doc(this.collectionRef, id);
    await updateDoc(docRef, data);
  }
}

export const orderService = new OrderService();
