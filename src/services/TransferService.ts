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
  type?: 'SEVK' | 'GERI_ODE' | 'SATIS' | 'HIBE';
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

      // 3. Handle Reservations
      // If transferring from stationary to team: create reservation on source warehouse
      if (transfer.toSiteId.startsWith('team_') && !transfer.fromSiteId.startsWith('team_')) {
        const sourceInventory = await warehouseService.getInventory(transfer.fromSiteId);
        const sourceItem = sourceInventory.find(i => i.sapNo === transfer.materialCode && i.condition !== 'DEFECT');
        if (sourceItem && sourceItem.id) {
          const currentReserved = sourceItem.reservedQuantity || 0;
          const reservations = (sourceItem as any).reservations || {};
          const currentTeamQty = reservations[transfer.toSiteId] || 0;
          
          const newReservations = {
            ...reservations,
            [transfer.toSiteId]: currentTeamQty + transfer.quantity
          };
          
          await updateDoc(doc(db, 'warehouses', transfer.fromSiteId, 'inventory_v2', sourceItem.id), {
            reservedQuantity: currentReserved + transfer.quantity,
            reservations: newReservations,
            lastUpdated: serverTimestamp()
          });
          // Invalidate cache
          (warehouseService as any).inventoryCache.delete(transfer.fromSiteId);
        }
      }

      // If transferring from team to stationary: decrease reservation
      if (transfer.fromSiteId.startsWith('team_') && !transfer.toSiteId.startsWith('team_')) {
        try {
          await warehouseService.decreaseReservation(transfer.toSiteId, transfer.materialCode, transfer.quantity, transfer.fromSiteId);
        } catch (e) {
          console.warn("Failed to decrease reservation during transfer approval:", e);
        }
      }

      // 4. Update transfer status
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
