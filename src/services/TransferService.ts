import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc } from 'firebase/firestore';
import { warehouseService } from './WarehouseService';

export interface Transfer {
  id?: string;
  fromSiteId: string;
  toSiteId: string;
  materialCode: string;
  materialName: string;
  quantity: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REJECTED';
  requestedBy: string;
  createdAt: any;
  approvedBy?: string;
  approvedAt?: any;
  rejectionReason?: string;
}

class TransferService {
  private collectionRef = collection(db, 'transfers');

  async createTransfer(transferData: Omit<Transfer, 'id' | 'createdAt'>) {
    try {
      const docRef = await addDoc(this.collectionRef, {
        ...transferData,
        createdAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating transfer: ", error);
      throw error;
    }
  }

  async getTransfers() {
    const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transfer[];
  }

  async approveTransfer(transfer: Transfer, adminEmail: string) {
    if (!transfer.id) return;
    
    try {
      // 1. Update stock in source warehouse (Decrease)
      await warehouseService.updateStockBySap(
        transfer.fromSiteId, 
        transfer.materialCode, 
        -transfer.quantity, 
        { 
          user: adminEmail, 
          reason: `Transfer Çıkışı (${transfer.toSiteId} deposuna)` 
        }
      );

      // 2. Update stock in destination warehouse (Increase)
      await warehouseService.updateStockBySap(
        transfer.toSiteId, 
        transfer.materialCode, 
        transfer.quantity, 
        { 
          user: adminEmail, 
          reason: `Transfer Girişi (${transfer.fromSiteId} deposundan)` 
        }
      );

      // 3. Update transfer status
      const docRef = doc(db, 'transfers', transfer.id);
      await updateDoc(docRef, {
        status: 'COMPLETED',
        approvedBy: adminEmail,
        approvedAt: serverTimestamp()
      });

    } catch (error) {
      console.error("Error approving transfer: ", error);
      throw error;
    }
  }

  async rejectTransfer(transferId: string, adminEmail: string, reason: string) {
    try {
      const docRef = doc(db, 'transfers', transferId);
      await updateDoc(docRef, {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedBy: adminEmail,
        approvedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error rejecting transfer: ", error);
      throw error;
    }
  }
}

export const transferService = new TransferService();
