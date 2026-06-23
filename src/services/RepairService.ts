import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { warehouseService } from './WarehouseService';

export interface RepairRecord {
  id?: string;
  sapNo: string;
  serialNo?: string;
  description: string;
  quantity: number;
  sourceWarehouseId: string; // Sevk eden depo
  targetWarehouseId?: string; // Tamir sonrası gideceği depo
  workshopId: string; // Hangi atölyeye gittiği
  sentBy: string; // Sevk eden yönetici
  sentAt: any;
  status: 'PENDING_ARRIVAL' | 'UNDER_REPAIR' | 'REPAIRED' | 'SENT_BACK' | 'COMPLETED';
  receivedAt?: any;
  receivedBy?: string; // Teslim alan atölye yetkilisi
  repairedAt?: any;
  repairedBy?: string; // Tamir eden atölye yetkilisi
  repairNotes?: string; // Yapılan onarım / işlemler
  dispatchedAt?: any;
  dispatchedBy?: string; // Sevk eden atölye yetkilisi
  completedAt?: any; // Depoya giriş anı
  faultCode?: string; // Hangi arıza kodundan dolayı geldiği
  faultDesc?: string; // Arıza açıklaması
  repairImageUrl?: string; // Onarım fotoğrafı URL'si
  shelfNo?: string; // Raf numarası
  receiveNote?: string; // Teslim alma notu
  dispatchNo?: string; // Sevk numarası
}

class RepairService {
  private collectionRef = collection(db, 'repairs');

  async deleteRepair(repairId: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await deleteDoc(docRef);
    } catch (error) {
      console.error("Error deleting repair record:", error);
      throw error;
    }
  }

  async uploadRepairImage(repairId: string, file: File): Promise<string> {
    const { storage } = await import('../firebase');
    const { ref, uploadBytes, getDownloadURL } = await import('firebase/storage');
    const path = `repairs/${repairId}/${Date.now()}_${file.name}`;
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  }

  async createRepair(repairData: Omit<RepairRecord, 'id' | 'sentAt' | 'status'>) {
    try {
      const docRef = await addDoc(this.collectionRef, {
        ...repairData,
        status: 'PENDING_ARRIVAL',
        sentAt: serverTimestamp()
      });
      return docRef.id;
    } catch (error) {
      console.error("Error creating repair record:", error);
      throw error;
    }
  }

  async getRepairs(): Promise<RepairRecord[]> {
    try {
      const q = query(this.collectionRef, orderBy('sentAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as RepairRecord[];
    } catch (error) {
      console.error("Error getting repairs:", error);
      return [];
    }
  }

  async receiveRepair(repairId: string, user: string, shelfNo?: string, receiveNote?: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const updatePayload: any = {
        status: 'UNDER_REPAIR',
        receivedBy: user,
        receivedAt: serverTimestamp()
      };
      if (shelfNo) updatePayload.shelfNo = shelfNo;
      if (receiveNote) updatePayload.receiveNote = receiveNote;
      
      await updateDoc(docRef, updatePayload);
    } catch (error) {
      console.error("Error receiving repair:", error);
      throw error;
    }
  }

  async markAsRepaired(repairId: string, notes: string, user: string, imageUrl?: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const updateData: any = {
        status: 'REPAIRED',
        repairedAt: serverTimestamp(),
        repairedBy: user,
        repairNotes: notes
      };
      if (imageUrl) {
        updateData.repairImageUrl = imageUrl;
      }
      await updateDoc(docRef, updateData);
    } catch (error) {
      console.error("Error marking repair as repaired:", error);
      throw error;
    }
  }

  async dispatchRepair(repairId: string, targetWarehouseId: string, user: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, {
        status: 'SENT_BACK',
        targetWarehouseId: targetWarehouseId,
        dispatchedAt: serverTimestamp(),
        dispatchedBy: user
      });
    } catch (error) {
      console.error("Error dispatching repair:", error);
      throw error;
    }
  }

  async acceptReturnedRepair(repair: RepairRecord, user: string) {
    if (!repair.id || !repair.targetWarehouseId) return;
    
    try {
      // 1. Add repaired stock to the target warehouse as REVISED, prefixed with R
      const sapNoWithR = repair.sapNo.toUpperCase().startsWith('R') ? repair.sapNo : 'R' + repair.sapNo;
      await warehouseService.updateStockBySap(
        repair.targetWarehouseId,
        sapNoWithR,
        repair.quantity,
        {
          user: user,
          reason: 'Tamir Sonrası Revize Parça Girişi',
          materialName: repair.description
        },
        'REVISED'
      );

      // 2. Update repair status to COMPLETED
      const docRef = doc(db, 'repairs', repair.id);
      await updateDoc(docRef, {
        status: 'COMPLETED',
        completedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error accepting returned repair:", error);
      throw error;
    }
  }
}

export const repairService = new RepairService();
