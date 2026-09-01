import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, runTransaction, getDoc } from 'firebase/firestore';
import { warehouseService } from './WarehouseService';

const MSF_INITIAL_SEEDS: Record<string, number> = {
  '2688': 197, // Anemon
  '3243': 25,  // Çamseki
  '3439': 19,  // Sarıkaya
  '3245': 119, // Alize Keltepe
  '2678': 270, // Mare Manastır
  '0752': 53,  // Alize Germiyan
  '2990': 155, // Doğal Sayalar
  '3793': 102, // Alize Kuyucak
  '3892': 2    // Alize Çataltape
};

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

export interface TransferItem {
  materialCode: string; // SAP No
  materialName: string;
  quantity: number;
  condition?: 'NEW' | 'REVISED' | 'DEFECT' | 'SCRAP';
}

export interface TransferV2 {
  id?: string;
  msfNo: string;            // Sevk Numarası (Örn: MSF-20260709-001)
  fromSiteId: string;       // Çıkış Deposu ID
  toSiteId: string;         // Varış Deposu ID
  items: TransferItem[];    // Sevk edilen malzemelerin listesi
  deliveryMethod: 'PERSON' | 'CARGO'; // Gönderim Türü
  shippedBy?: string;       // Teslim Eden Personel (Gönderim PERSON ise)
  cargoCarrier?: string;    // Kargo Firması (Gönderim CARGO ise)
  cargoTrackingNo?: string; // Kargo Takip No (Gönderim CARGO ise)
  status: 'YOLDA' | 'TAMAMLANDI' | 'IPTAL_EDILDI'; // Sevk Durumu
  requestedBy: string;      // Talebi Oluşturan Kullanıcı E-postası
  createdAt: any;           // Oluşturulma Zamanı
  resolvedAt?: any;         // Onaylanma / İptal Zamanı
  resolvedBy?: any;         // Onaylayan / İptal Eden Kişi
  rejectionReason?: string; // İptal / Red Gerekçesi
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

  async previewNextSequenceNumber(warehouseId: string): Promise<number> {
    try {
      const counterDocRef = doc(db, 'msf_counters', warehouseId);
      const snap = await getDoc(counterDocRef);
      if (!snap.exists()) {
        return MSF_INITIAL_SEEDS[warehouseId] || 1;
      }
      return snap.data().currentSeq || 1;
    } catch (e) {
      console.error("Error previewing sequence: ", e);
      return MSF_INITIAL_SEEDS[warehouseId] || 1;
    }
  }

  async createMultiItemTransfer(transferData: Omit<TransferV2, 'id' | 'createdAt' | 'msfNo'>): Promise<{ id: string, msfNo: string }> {
    try {
      const counterDocRef = doc(db, 'msf_counters', transferData.fromSiteId);
      const newTransferDocRef = doc(collection(db, 'transfers'));

      // 1. Transactionally increment counter and write transfer doc
      const result = await runTransaction(db, async (transaction) => {
        const counterSnapshot = await transaction.get(counterDocRef);
        let nextSeq = 1;
        const warehouseId = transferData.fromSiteId;

        if (!counterSnapshot.exists()) {
          nextSeq = MSF_INITIAL_SEEDS[warehouseId] || 1;
          transaction.set(counterDocRef, { currentSeq: nextSeq + 1 });
        } else {
          const data = counterSnapshot.data();
          nextSeq = data.currentSeq || 1;
          transaction.update(counterDocRef, { currentSeq: nextSeq + 1 });
        }

        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        const dateStr = `${day}${month}${year}`;
        const msfNo = `${nextSeq}-MSF-${dateStr}`;

        transaction.set(newTransferDocRef, {
          ...transferData,
          msfNo,
          createdAt: serverTimestamp()
        });

        return { id: newTransferDocRef.id, msfNo };
      });

      // 2. Decrease stocks in source warehouse immediately with the actual MSF No
      const successfulDecreases: Array<{ sapNo: string, quantity: number, condition: 'NEW' | 'REVISED' | 'DEFECT' | 'SCRAP' }> = [];
      try {
        for (const item of transferData.items) {
          await warehouseService.updateStockBySap(
            transferData.fromSiteId,
            item.materialCode,
            -item.quantity,
            {
              user: transferData.requestedBy,
              reason: `MSF Sevk Çıkışı (MSF No: ${result.msfNo})`,
              materialName: item.materialName
            },
            item.condition || 'NEW'
          );
          successfulDecreases.push({ sapNo: item.materialCode, quantity: item.quantity, condition: item.condition || 'NEW' });
        }
      } catch (stockError: any) {
        console.error('[TransferService] Stock decrease failed, rolling back...', stockError);
        // Rollback successful decreases
        for (const dec of successfulDecreases) {
          try {
            await warehouseService.updateStockBySap(
              transferData.fromSiteId,
              dec.sapNo,
              dec.quantity,
              {
                user: 'SİSTEM',
                reason: `MSF Hata Geri Yükleme (MSF No: ${result.msfNo})`
              },
              dec.condition
            );
          } catch (rollbackError) {
            console.error('[TransferService] Rollback failed for:', dec.sapNo, rollbackError);
          }
        }
        // Mark transfer doc as error/cancelled
        try {
          await updateDoc(newTransferDocRef, {
            status: 'REJECTED',
            rejectionReason: `Stok düşümü başarısız oldu (Hata: ${stockError.message || stockError})`,
            rejectedBy: 'SİSTEM',
            rejectedAt: serverTimestamp()
          });
        } catch (dbError) {
          console.error('[TransferService] Failed to mark transfer doc as rejected:', dbError);
        }
        throw stockError;
      }

      return result;
    } catch (error) {
      console.error("Error creating multi item transfer: ", error);
      throw error;
    }
  }

  async getTransfers() {
    const q = query(this.collectionRef, orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as any[];
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
          reason: `Transfer Çıkışı (${transfer.toSiteId} deposuna)`,
          materialName: transfer.materialName 
        }
      );

      // 2. Update stock in destination warehouse (Increase)
      await warehouseService.updateStockBySap(
        transfer.toSiteId, 
        transfer.materialCode, 
        transfer.quantity, 
        { 
          user: adminEmail, 
          reason: `Transfer Girişi (${transfer.fromSiteId} deposundan)`,
          materialName: transfer.materialName
        }
      );

      // 3. Handle Reservations
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
          (warehouseService as any).inventoryCache.delete(transfer.fromSiteId);
        }
      }

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

  async approveMultiItemTransfer(
    transferId: string, 
    adminEmail: string, 
    itemDetails?: Array<{ 
      materialCode: string; 
      shelfNo: string; 
      condition: 'NEW' | 'DEFECT' | 'REVISED' | 'SCRAP' 
    }>
  ) {
    try {
      const { getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'transfers', transferId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Transfer bulunamadı");
      
      const transfer = docSnap.data() as any;
      const itemsList = Array.isArray(transfer.items) 
        ? transfer.items 
        : [{ materialCode: transfer.materialCode, materialName: transfer.materialName, quantity: transfer.quantity }];

      // 1. Add stocks to target warehouse
      for (const item of itemsList) {
        const detail = itemDetails?.find(d => d.materialCode === item.materialCode);
        const targetShelf = detail ? detail.shelfNo : undefined;
        const targetCondition = detail ? detail.condition : 'NEW';

        await warehouseService.updateStockBySap(
          transfer.toSiteId,
          item.materialCode,
          item.quantity,
          {
            user: adminEmail,
            reason: `MSF Sevk Girişi (MSF No: ${transfer.msfNo})`,
            materialName: item.materialName
          },
          targetCondition,
          targetShelf
        );
      }

      // 2. Update transfer status
      await updateDoc(docRef, {
        status: 'TAMAMLANDI',
        resolvedBy: adminEmail,
        resolvedAt: serverTimestamp(),
        receivedItemsDetails: itemDetails || null
      });
    } catch (error) {
      console.error("Error approving multi item transfer: ", error);
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

  async rejectMultiItemTransfer(transferId: string, adminEmail: string, reason: string) {
    try {
      const { getDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'transfers', transferId);
      const docSnap = await getDoc(docRef);
      if (!docSnap.exists()) throw new Error("Transfer bulunamadı");
      
      const transfer = docSnap.data() as TransferV2;

      // 1. Revert stocks to source warehouse
      for (const item of transfer.items) {
        await warehouseService.updateStockBySap(
          transfer.fromSiteId,
          item.materialCode,
          item.quantity,
          {
            user: adminEmail,
            reason: `MSF İptal İadesi (MSF No: ${transfer.msfNo})`,
            materialName: item.materialName
          },
          item.condition || 'NEW'
        );
      }

      // 2. Update transfer status
      await updateDoc(docRef, {
        status: 'IPTAL_EDILDI',
        rejectionReason: reason,
        resolvedBy: adminEmail,
        resolvedAt: serverTimestamp()
      });
    } catch (error) {
      console.error("Error rejecting multi item transfer: ", error);
      throw error;
    }
  }
}

export const transferService = new TransferService();
