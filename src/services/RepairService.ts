import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, updateDoc, getDoc, deleteDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { warehouseService } from './WarehouseService';

export interface RepairRecord {
  id?: string;
  sapNo: string;
  serialNo?: string;
  description: string;
  quantity: number;
  sourceWarehouseId: string; // Sevk eden depo / Saha Adı
  targetWarehouseId?: string; // Tamir sonrası gideceği depo / Transfer Sahası
  workshopId: string; // Hangi atölyeye gittiği
  sentBy: string; // Sevk eden yönetici
  sentAt: any; // Tamire Geliş Tarihi
  status: 'PENDING_ARRIVAL' | 'UNDER_REPAIR' | 'REPAIRED' | 'SENT_BACK' | 'COMPLETED' | 'SCRAPPED' | 'REJECTED';
  receivedAt?: any;
  receivedBy?: string; // Teslim alan atölye yetkilisi
  repairedAt?: any;
  repairedBy?: string; // Tamir eden atölye yetkilisi
  repairNotes?: string; // Tamir Açıklaması
  dispatchedAt?: any; // Transfer Tarihi
  dispatchedBy?: string; // Sevk eden atölye yetkilisi
  completedAt?: any; // Depoya giriş anı
  scrappedAt?: any; // Hurdaya ayrılma zamanı
  scrappedBy?: string; // Hurdaya ayıran usta/yetkili
  scrapReason?: string; // Hurda gerekçesi / açıklaması
  scrapImageUrl?: string; // Hurda görseli
  rejectedAt?: any;
  rejectedBy?: string;
  rejectReason?: string;
  faultCode?: string; // Arıza No
  faultDesc?: string; // Arıza Açıklaması
  repairImageUrl?: string; // Onarım fotoğrafı URL'si
  shelfNo?: string; // Kutu / Raf No
  receiveNote?: string; // Teslim alma notu
  dispatchNo?: string; // MÇT No / Sevk numarası
  countNo?: string; // Sayım No
  rmrstNo?: string; // RMRST No
  revisionNo?: string; // Revizyon No
  preRepairNote?: string; // Tamir Öncesi Not
  boxNo?: string; // Kutu
  mctNo?: string; // MÇT No
  transferStatus?: string; // Transfer Durumu
  transferDate?: any; // Transfer Tarihi
  transferSite?: string; // Transfer Sahası
  generalNote?: string; // Genel Not
  assignedTo?: string; // Atanan teknisyen / usta adı
  assignedAt?: any; // Atanma zamanı
  lastUpdated?: any; // Son güncelleme zamanı
  createdAt?: any; // Oluşturulma zamanı
  repairStage?: 'DIAGNOSIS' | 'WAITING_PARTS' | 'REPAIRING' | 'TESTING' | 'TESTED' | 'TURBINE_TEST' | string; // Alt onarım aşaması
  testStatus?: 'TESTED' | 'UNTESTED'; // Test Masasında Doğrulandı mı / Sahada mı test edilecek
  priority?: 'CRITICAL' | 'HIGH' | 'NORMAL'; // Aciliyet derecesi
  noteLogs?: Array<{ date: any; user: string; text: string; stage?: string }>; // Kronolojik usta notları
  usedComponents?: Array<{
    componentId: string;
    code: string;
    name: string;
    value?: string;
    quantity: number;
    date: any;
    user: string;
  }>; // Onarımda kullanılan elektronik devre elemanları
  turbineNo?: string;
}

class RepairService {
  private collectionRef = collection(db, 'repairs');
  private cache: RepairRecord[] | null = null;
  private lastFetchTime: number = 0;
  private CACHE_DURATION = 600000; // 10 minutes

  public invalidateCache() {
    this.cache = null;
    this.lastFetchTime = 0;
  }

  async deleteRepair(repairId: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await deleteDoc(docRef);
      this.invalidateCache();
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

  async createRepair(repairData: Omit<RepairRecord, 'id' | 'sentAt' | 'status'> & { status?: RepairRecord['status']; sentAt?: any }) {
    try {
      const cleaned: any = {};
      for (const [k, v] of Object.entries(repairData)) {
        if (v !== undefined && v !== null && v !== '') {
          if (k.endsWith('At') || k.endsWith('Date')) {
            if (v instanceof Date) {
              if (!isNaN(v.getTime()) && v.getFullYear() >= 1970 && v.getFullYear() <= 2100) {
                cleaned[k] = v;
              }
            } else if (typeof v === 'number' && v > 1000000000000) {
              cleaned[k] = new Date(v);
            } else if (typeof v === 'string') {
              const d = new Date(v);
              if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
                cleaned[k] = d;
              }
            }
          } else {
            cleaned[k] = v;
          }
        }
      }

      const docRef = await addDoc(this.collectionRef, {
        ...cleaned,
        status: cleaned.status || 'UNDER_REPAIR',
        sentAt: cleaned.sentAt || serverTimestamp()
      });
      this.invalidateCache();
      return docRef.id;
    } catch (error) {
      console.error("Error creating repair record:", error);
      throw error;
    }
  }

  async createRepairsBulk(
    repairsList: Partial<RepairRecord>[], 
    onProgress?: (processed: number, total: number) => void
  ): Promise<number> {
    try {
      const total = repairsList.length;
      const chunkSize = 400;
      let processed = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = repairsList.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const repairData of chunk) {
          const cleaned: any = {};
          for (const [k, v] of Object.entries(repairData)) {
            if (v !== undefined && v !== null && v !== '') {
              if (k.endsWith('At') || k.endsWith('Date')) {
                if (v instanceof Date) {
                  if (!isNaN(v.getTime()) && v.getFullYear() >= 1970 && v.getFullYear() <= 2100) {
                    cleaned[k] = v;
                  }
                } else if (typeof v === 'number' && v > 1000000000000) {
                  cleaned[k] = new Date(v);
                } else if (typeof v === 'string') {
                  const d = new Date(v);
                  if (!isNaN(d.getTime()) && d.getFullYear() >= 1970 && d.getFullYear() <= 2100) {
                    cleaned[k] = d;
                  }
                }
              } else {
                cleaned[k] = v;
              }
            }
          }

          const newDocRef = doc(this.collectionRef);
          batch.set(newDocRef, {
            ...cleaned,
            status: cleaned.status || 'UNDER_REPAIR',
            sentAt: cleaned.sentAt || null
          });
        }

        await batch.commit();
        processed += chunk.length;
        if (onProgress) {
          onProgress(processed, total);
        }
      }

      this.invalidateCache();
      return processed;
    } catch (error) {
      console.error("Error creating bulk repair records:", error);
      throw error;
    }
  }

  async deleteRepairsBulk(
    ids: string[],
    onProgress?: (processed: number, total: number) => void
  ): Promise<number> {
    try {
      const validIds = ids.filter(Boolean);
      const total = validIds.length;
      const chunkSize = 400;
      let processed = 0;

      for (let i = 0; i < total; i += chunkSize) {
        const chunk = validIds.slice(i, i + chunkSize);
        const batch = writeBatch(db);

        for (const id of chunk) {
          const docRef = doc(this.collectionRef, id);
          batch.delete(docRef);
        }

        await batch.commit();
        processed += chunk.length;
        if (onProgress) {
          onProgress(processed, total);
        }
      }

      this.invalidateCache();
      return processed;
    } catch (error) {
      console.error("Error deleting bulk repair records:", error);
      throw error;
    }
  }

  async getRepairs(forceRefresh: boolean = false): Promise<RepairRecord[]> {
    const now = Date.now();
    if (!forceRefresh && this.cache && (now - this.lastFetchTime < this.CACHE_DURATION)) {
      return this.cache;
    }
    try {
      const q = query(this.collectionRef, orderBy('sentAt', 'desc'));
      const querySnapshot = await getDocs(q);
      const data = querySnapshot.docs.map(d => {
        const raw = d.data();
        let status = raw.status || 'UNDER_REPAIR';
        // Only live system dispatches starting with SV- or explicit PENDING_ARRIVAL that haven't been received or rejected yet
        if (status !== 'REJECTED' && status !== 'SCRAPPED' && !raw.rejectedAt && ((status === 'PENDING_ARRIVAL' || (raw.dispatchNo && String(raw.dispatchNo).toUpperCase().startsWith('SV-'))) && !raw.receivedAt && !raw.receivedBy)) {
          status = 'PENDING_ARRIVAL';
        }
        return {
          id: d.id,
          ...raw,
          status
        } as RepairRecord;
      });
      this.cache = data;
      this.lastFetchTime = now;
      return data;
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
      this.invalidateCache();
    } catch (error) {
      console.error("Error receiving repair:", error);
      throw error;
    }
  }

  async rejectRepair(repairId: string, user: string, rejectReason: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Kayıt bulunamadı.');
      const rep = snap.data();

      // 1. Mark repair record as REJECTED in Firestore
      await updateDoc(docRef, {
        status: 'REJECTED',
        rejectedBy: user,
        rejectedAt: serverTimestamp(),
        rejectReason: rejectReason || 'Belirtilmedi'
      });

      // 2. Restore defect stock in the source warehouse
      if (rep.sourceWarehouseId) {
        try {
          const invCollection = collection(db, 'warehouses', rep.sourceWarehouseId, 'inventory_v2');
          const invSnap = await getDocs(invCollection);
          
          for (const d of invSnap.docs) {
            const item = d.data();
            const matchesDispatch = rep.dispatchNo && item.dispatchNo === rep.dispatchNo;
            const matchesSapSerial = item.sapNo === rep.sapNo && (rep.serialNo ? item.serialNo === rep.serialNo : true) && item.status === 'TAMIRE_SEVK_EDILDI';
            
            if (matchesDispatch || matchesSapSerial) {
              const restoredQty = item.dispatchedQty || rep.quantity || 1;
              await updateDoc(d.ref, {
                quantity: (item.quantity || 0) + restoredQty,
                status: null,
                dispatchedQty: 0,
                dispatchNo: null,
                lastUpdated: serverTimestamp()
              });
              break;
            }
          }

          // Add movement log to source warehouse
          await warehouseService.addLog(
            rep.sourceWarehouseId,
            {
              itemId: rep.sapNo,
              type: 'ADD',
              sapNo: rep.sapNo,
              materialName: rep.description || 'Arızalı Kart',
              quantity: rep.quantity || 1,
              user: user,
              note: `Atölye tarafından teslim alınmadı ve depoya iade edildi. Red Gerekçesi: ${rejectReason || 'Belirtilmedi'} (Sevk: ${rep.dispatchNo || '-'})`,
              serialNo: rep.serialNo
            }
          );
        } catch (subErr) {
          console.error("Error restoring warehouse inventory on repair reject:", subErr);
        }
      }

      this.invalidateCache();
    } catch (error) {
      console.error("Error rejecting repair:", error);
      throw error;
    }
  }

  async markAsRepaired(repairId: string, notes: string, user: string, imageUrl?: string, testStatus: 'TESTED' | 'UNTESTED' = 'TESTED') {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const updateData: any = {
        status: 'REPAIRED',
        repairedAt: serverTimestamp(),
        repairedBy: user,
        repairNotes: notes,
        testStatus: testStatus
      };
      if (imageUrl) {
        updateData.repairImageUrl = imageUrl;
      }
      await updateDoc(docRef, updateData);
      this.invalidateCache();
    } catch (error) {
      console.error("Error marking repair as repaired:", error);
      throw error;
    }
  }

  async updateTestStatus(repairId: string, testStatus: 'TESTED' | 'UNTESTED') {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, { testStatus: testStatus });
      this.invalidateCache();
    } catch (error) {
      console.error("Error updating test status:", error);
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
      this.invalidateCache();
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
      this.invalidateCache();
    } catch (error) {
      console.error("Error accepting returned repair:", error);
      throw error;
    }
  }

  async assignTechnician(repairId: string, technicianName: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, {
        assignedTo: technicianName,
        assignedAt: serverTimestamp()
      });
      this.invalidateCache();
    } catch (error) {
      console.error("Error assigning technician:", error);
      throw error;
    }
  }

  async updateRepairStage(repairId: string, stage: 'DIAGNOSIS' | 'WAITING_PARTS' | 'REPAIRING' | 'TESTING') {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, {
        repairStage: stage
      });
      this.invalidateCache();
    } catch (error) {
      console.error("Error updating repair stage:", error);
      throw error;
    }
  }

  async updatePriority(repairId: string, priority: 'CRITICAL' | 'HIGH' | 'NORMAL') {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, {
        priority: priority
      });
      this.invalidateCache();
    } catch (error) {
      console.error("Error updating priority:", error);
      throw error;
    }
  }

  async addRepairNote(repairId: string, text: string, user: string, stage?: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const noteEntry = {
        date: new Date().toISOString(),
        user,
        text,
        stage: stage || 'GENEL'
      };
      await updateDoc(docRef, {
        repairNotes: text,
        noteLogs: arrayUnion(noteEntry)
      });
      this.invalidateCache();
    } catch (error) {
      console.error("Error adding repair note:", error);
      throw error;
    }
  }

  async updateRepairNote(repairId: string, noteIndex: number, newText: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Kayıt bulunamadı.');
      const data = snap.data();
      const noteLogs = Array.isArray(data.noteLogs) ? [...data.noteLogs] : [];
      if (noteIndex >= 0 && noteIndex < noteLogs.length) {
        noteLogs[noteIndex] = {
          ...noteLogs[noteIndex],
          text: newText,
          updatedAt: new Date().toISOString()
        };
        const latestNote = noteLogs.length > 0 ? noteLogs[noteLogs.length - 1].text : '';
        await updateDoc(docRef, {
          repairNotes: latestNote,
          noteLogs: noteLogs
        });
        this.invalidateCache();
      }
    } catch (error) {
      console.error("Error updating repair note:", error);
      throw error;
    }
  }

  async deleteRepairNote(repairId: string, noteIndex: number) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) throw new Error('Kayıt bulunamadı.');
      const data = snap.data();
      const noteLogs = Array.isArray(data.noteLogs) ? [...data.noteLogs] : [];
      if (noteIndex >= 0 && noteIndex < noteLogs.length) {
        noteLogs.splice(noteIndex, 1);
        const latestNote = noteLogs.length > 0 ? noteLogs[noteLogs.length - 1].text : '';
        await updateDoc(docRef, {
          repairNotes: latestNote,
          noteLogs: noteLogs
        });
        this.invalidateCache();
      }
    } catch (error) {
      console.error("Error deleting repair note:", error);
      throw error;
    }
  }

  async scrapRepair(repairId: string, scrappedBy: string, reason: string, imageUrl?: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      const updateData: any = {
        status: 'SCRAPPED',
        scrappedAt: new Date(),
        scrappedBy: scrappedBy,
        scrapReason: reason
      };
      if (imageUrl) {
        updateData.scrapImageUrl = imageUrl;
        updateData.repairImageUrl = imageUrl;
      }
      await updateDoc(docRef, updateData);
      this.invalidateCache();
    } catch (error) {
      console.error("Error scrapping repair record:", error);
      throw error;
    }
  }

  async restoreScrapToRepair(repairId: string) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, {
        status: 'UNDER_REPAIR',
        repairStage: 'DIAGNOSIS',
        scrappedAt: null,
        scrappedBy: null,
        scrapReason: null
      });
      this.invalidateCache();
    } catch (error) {
      console.error("Error restoring scrapped record:", error);
      throw error;
    }
  }

  async updateRepair(repairId: string, data: Partial<RepairRecord>) {
    try {
      const docRef = doc(db, 'repairs', repairId);
      await updateDoc(docRef, data);
      this.invalidateCache();
    } catch (error) {
      console.error("Error updating repair record:", error);
      throw error;
    }
  }
}

export const repairService = new RepairService();
