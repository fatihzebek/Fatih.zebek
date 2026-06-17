import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, query, orderBy, getDocs, doc, deleteDoc, updateDoc, where, setDoc, getDoc, collectionGroup, limit } from 'firebase/firestore';
import { dataService } from './DataService';

export interface InventoryItem {
  id?: string;
  sapNo: string;
  description: string;
  quantity: number;
  reservedQuantity?: number;
  shelfNo: string;
  criticalLimit?: number;
  imageUrl?: string;
  lastUpdated?: any;
  lastAuditDate?: any;
  price?: number;
  currency?: 'TRY' | 'USD' | 'EUR';
  condition?: 'NEW' | 'REVISED' | 'DEFECT' | 'SCRAP';
}

export interface InventoryLog {
  id?: string;
  itemId: string;
  materialName: string;
  sapNo?: string;
  type: 'ADD' | 'REMOVE' | 'TRANSFER' | 'UPDATE';
  quantity: number;
  oldQty?: number;
  newQty?: number;
  user: string;
  timestamp: any;
  turbineNo?: string;
  turbineSerial?: string;
  formNo?: string;
  date?: string;
  source?: string;
  team?: string;
  note?: string;
}

export interface AuditResult {
  itemId: string;
  sapNo: string;
  description: string;
  systemQty: number;
  physicalQty: number;
  diff: number;
  note?: string;
}

export interface AuditRecord {
  id?: string;
  user: string;
  totalItems: number;
  totalDiff: number;
  discrepantItems?: number;
  surplusItems?: number;
  deficitItems?: number;
  results: AuditResult[];
  timestamp: any;
  date?: string;
}

class WarehouseService {
  private inventoryCache: Map<string, { data: InventoryItem[], timestamp: number }> = new Map();
  private CACHE_DURATION = 30000; // 30 seconds
  private globalImagesCache: Map<string, string> | null = null;

  public resolveWarehouseId(id: string): string {
    const trimmedId = id.trim();
    const mapped = dataService.getWarehouseIdBySiteId(trimmedId);
    if (mapped) return mapped;

    if (trimmedId.includes(' ') || isNaN(Number(trimmedId))) {
      const sites = dataService.getSites();
      const cleanName = trimmedId.toLowerCase().replace('depo', '').trim();
      const found = sites.find(s => 
        s.id === trimmedId || 
        s.name.toLowerCase() === cleanName ||
        s.name.toLowerCase().includes(cleanName)
      );
      if (found) {
        return dataService.getWarehouseIdBySiteId(found.id) || found.id;
      }
    }

    return trimmedId;
  }

  async getInventory(id: string, forceRefresh: boolean = false): Promise<InventoryItem[]> {
    const warehouseId = this.resolveWarehouseId(id);
    const now = Date.now();
    const cached = this.inventoryCache.get(warehouseId);

    if (!forceRefresh && cached && (now - cached.timestamp < this.CACHE_DURATION)) {
      return cached.data;
    }

    const colRef = collection(db, 'warehouses', warehouseId, 'inventory_v2');
    const q = query(colRef, orderBy('sapNo', 'asc'));
    const snapshot = await getDocs(q);
    let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryItem));
    
    // Auto-sync missing images from GlobalMaterialImages
    try {
        if (!this.globalImagesCache) {
            const globalSnapshot = await getDocs(collection(db, 'GlobalMaterialImages'));
            const globalImages = new Map<string, string>();
            globalSnapshot.forEach(doc => {
                if (doc.data().imageUrl) {
                    const rawId = doc.id.trim();
                    globalImages.set(rawId, doc.data().imageUrl);
                    const stripped = rawId.replace(/^0+/, '');
                    if (stripped) {
                        globalImages.set(stripped, doc.data().imageUrl);
                    }
                }
            });
            this.globalImagesCache = globalImages;
        }

        const globalImages = this.globalImagesCache;
        
        data = data.map(item => {
            if (!item.imageUrl && item.sapNo) {
                const safeSapNo = String(item.sapNo).trim().replace(/\//g, '_');
                if (globalImages.has(safeSapNo)) {
                    return { ...item, imageUrl: globalImages.get(safeSapNo) };
                }
                const stripped = safeSapNo.replace(/^0+/, '');
                if (globalImages.has(stripped)) {
                    return { ...item, imageUrl: globalImages.get(stripped) };
                }
            }
            return item;
        });
    } catch (e) {
        console.warn("Could not sync global images", e);
    }
    
    this.inventoryCache.set(warehouseId, { data, timestamp: now });
    return data;
  }

  async addMaterial(id: string, item: Omit<InventoryItem, 'id' | 'lastUpdated'>) {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'inventory_v2');
    
    // Auto-fetch from global pool if not provided
    if (!item.imageUrl && item.sapNo) {
        try {
            const safeSapNo = String(item.sapNo).trim().replace(/\//g, '_');
            let globalDoc = await getDoc(doc(db, 'GlobalMaterialImages', safeSapNo));
            if (globalDoc.exists() && globalDoc.data().imageUrl) {
                item.imageUrl = globalDoc.data().imageUrl;
            } else {
                const stripped = safeSapNo.replace(/^0+/, '');
                if (stripped !== safeSapNo && stripped !== '') {
                    globalDoc = await getDoc(doc(db, 'GlobalMaterialImages', stripped));
                    if (globalDoc.exists() && globalDoc.data().imageUrl) {
                        item.imageUrl = globalDoc.data().imageUrl;
                    }
                }
            }
        } catch(e) {
            console.warn("Could not auto-fetch global image", e);
        }
    }

    const result = await addDoc(colRef, {
      ...item,
      lastUpdated: serverTimestamp()
    });
    
    // Update local cache directly to avoid query lag
    const cached = this.inventoryCache.get(warehouseId);
    if (cached) {
      cached.data.push({ id: result.id, ...item, lastUpdated: new Date() } as InventoryItem);
      cached.timestamp = Date.now();
    }
    
    this.checkCriticalStock(warehouseId, { id: result.id, ...item });
    return result;
  }

  async updateMaterialImage(id: string, itemId: string, imageUrl: string, sapNo?: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
    await updateDoc(docRef, { imageUrl });

    const cached = this.inventoryCache.get(warehouseId);
    if (cached) {
      const idx = cached.data.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        cached.data[idx] = { ...cached.data[idx], imageUrl } as any;
        cached.timestamp = Date.now();
      }
    }

    if (sapNo && String(sapNo).trim() !== '') {
        try {
            const cleanSapNo = String(sapNo).trim();
            const safeSapNo = cleanSapNo.replace(/\//g, '_');
            await setDoc(doc(db, 'GlobalMaterialImages', safeSapNo), { imageUrl }, { merge: true });
            
            // Sync image to other cached items across all warehouses in session
            this.inventoryCache.forEach((cache, _) => {
               cache.data = cache.data.map(i => {
                  const itemSapStr = String(i.sapNo || '').trim();
                  if (!i.imageUrl && (itemSapStr === cleanSapNo || itemSapStr.replace(/^0+/, '') === cleanSapNo.replace(/^0+/, ''))) {
                     return { ...i, imageUrl } as any;
                  }
                  return i;
               });
            });
        } catch (e) {
            console.warn("Could not update global image", e);
        }
    }
  }

  async deleteMaterial(id: string, itemId: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
    await deleteDoc(docRef);
    
    // Update local cache directly to avoid query lag
    const cached = this.inventoryCache.get(warehouseId);
    if (cached) {
      cached.data = cached.data.filter(i => i.id !== itemId);
      cached.timestamp = Date.now();
    }
  }

  async updateMaterial(id: string, itemId: string, updates: Partial<InventoryItem>) {
    const warehouseId = this.resolveWarehouseId(id);
    const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
    
    if (warehouseId.startsWith('team_') && updates.quantity !== undefined && updates.quantity <= 0) {
      await deleteDoc(docRef);
      const cached = this.inventoryCache.get(warehouseId);
      if (cached) {
        cached.data = cached.data.filter(i => i.id !== itemId);
        cached.timestamp = Date.now();
      }
      return;
    }

    await updateDoc(docRef, {
      ...updates,
      lastUpdated: serverTimestamp()
    });
    
    // Update local cache directly to avoid query lag
    const cached = this.inventoryCache.get(warehouseId);
    let updatedItem: InventoryItem | undefined = undefined;
    if (cached) {
      const idx = cached.data.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        cached.data[idx] = { ...cached.data[idx], ...updates, lastUpdated: new Date() };
        cached.timestamp = Date.now();
        updatedItem = cached.data[idx];
      }
    }

    if (updatedItem) {
      this.checkCriticalStock(warehouseId, updatedItem);
    }
  }

  async transferMaterial(sourceId: string, targetId: string, sourceItemId: string, quantity: number, user: string) {
    const sourceWarehouseId = this.resolveWarehouseId(sourceId);
    const targetWarehouseId = this.resolveWarehouseId(targetId);

    const sourceInventory = await this.getInventory(sourceWarehouseId);
    const sourceItem = sourceInventory.find(i => i.id === sourceItemId);
    if (!sourceItem) throw new Error("Kaynak malzeme bulunamadı");
    if (sourceItem.quantity < quantity) throw new Error("Yetersiz stok");

    const sourcePromises: Promise<any>[] = [
      this.updateMaterial(sourceWarehouseId, sourceItemId, { quantity: sourceItem.quantity - quantity }),
      this.addLog(sourceWarehouseId, {
        itemId: sourceItemId,
        sapNo: sourceItem.sapNo || '',
        materialName: (sourceItem as any).name || sourceItem.description || 'Bilinmeyen',
        type: 'TRANSFER',
        quantity: -quantity,
        oldQty: sourceItem.quantity,
        newQty: sourceItem.quantity - quantity,
        user,
        note: `${targetWarehouseId} deposuna transfer edildi.`
      })
    ];

    const targetInventory = await this.getInventory(targetWarehouseId);
    const targetItem = targetInventory.find(i => i.sapNo === sourceItem.sapNo);

    const targetPromises: Promise<any>[] = [];
    if (targetItem && targetItem.id) {
      targetPromises.push(this.updateMaterial(targetWarehouseId, targetItem.id, { quantity: targetItem.quantity + quantity }));
      targetPromises.push(this.addLog(targetWarehouseId, {
        itemId: targetItem.id,
        sapNo: targetItem.sapNo || '',
        materialName: (targetItem as any).name || targetItem.description || 'Bilinmeyen',
        type: 'TRANSFER',
        quantity,
        oldQty: targetItem.quantity,
        newQty: targetItem.quantity + quantity,
        user,
        note: `${sourceWarehouseId} deposundan transfer edildi.`
      }));
    } else {
      const { id, lastUpdated, ...itemWithoutId } = sourceItem as any;
      const newItem = await this.addMaterial(targetWarehouseId, { ...itemWithoutId, quantity });
      targetPromises.push(this.addLog(targetWarehouseId, {
        itemId: newItem.id,
        sapNo: sourceItem.sapNo || '',
        materialName: (sourceItem as any).name || sourceItem.description || 'Bilinmeyen',
        type: 'TRANSFER',
        quantity,
        oldQty: 0,
        newQty: quantity,
        user,
        note: `${sourceWarehouseId} deposundan transfer edildi.`
      }));
    }

    await Promise.all([...sourcePromises, ...targetPromises]);
  }

  async syncMaterialImageGlobally(sapNo: string, imageUrl: string) {
    if (!sapNo) return;
    
    // Save to Global Pool
    try {
        const cleanSapNo = String(sapNo).trim();
        const safeSapNo = cleanSapNo.replace(/\//g, '_');
        await setDoc(doc(db, 'GlobalMaterialImages', safeSapNo), { 
            sapNo: cleanSapNo, 
            imageUrl, 
            lastUpdated: serverTimestamp() 
        }, { merge: true });
    } catch(err) {
        console.warn("Failed to save to global image pool", err);
    }
    
    // Get all warehouses
    const warehouses = dataService.getWarehouses();
    const { query, where, getDocs } = await import('firebase/firestore');
    
    const updatePromises = warehouses.map(async (w) => {
      try {
        const colRef = collection(db, 'warehouses', w.id, 'inventory_v2');
        const q = query(colRef, where('sapNo', '==', sapNo));
        const snap = await getDocs(q);
        
        const docUpdates = snap.docs.map(document => 
           updateDoc(doc(db, 'warehouses', w.id, 'inventory_v2', document.id), { imageUrl, lastUpdated: serverTimestamp() })
        );
        
        await Promise.all(docUpdates);
        
        if (snap.docs.length > 0) {
            this.inventoryCache.delete(w.id);
        }
      } catch (err) {
        console.error(`Failed to sync image for sap ${sapNo} in warehouse ${w.id}`, err);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`[GlobalSync] Successfully synced image for SAP: ${sapNo} across all warehouses.`);
  }

  async getGlobalImagePool(): Promise<Map<string, string>> {
    const pool = new Map<string, string>();
    try {
        const snap = await getDocs(collection(db, 'GlobalMaterialImages'));
        snap.docs.forEach(d => {
            const data = d.data();
            if (data.imageUrl) {
                const rawId = d.id.trim();
                pool.set(rawId, data.imageUrl);
                const stripped = rawId.replace(/^0+/, '');
                if (stripped) {
                    pool.set(stripped, data.imageUrl);
                }
            }
        });
    } catch(err) {
        console.warn("Failed to fetch global image pool", err);
    }
    return pool;
  }

  async deleteGlobalMaterialImage(sapNo: string) {
    if (!sapNo) return;
    
    // 1. Delete from GlobalMaterialImages
    try {
        const cleanSapNo = String(sapNo).trim();
        const safeSapNo = cleanSapNo.replace(/\//g, '_');
        await deleteDoc(doc(db, 'GlobalMaterialImages', safeSapNo));
        const stripped = cleanSapNo.replace(/^0+/, '');
        if (stripped) {
            await deleteDoc(doc(db, 'GlobalMaterialImages', stripped));
        }
    } catch(err) {
        console.warn("Failed to delete from global image pool", err);
    }
    
    // 2. Clear imageUrl in all warehouses' inventory_v2 for this sapNo
    const warehouses = dataService.getWarehouses();
    const updatePromises = warehouses.map(async (w) => {
      try {
        const colRef = collection(db, 'warehouses', w.id, 'inventory_v2');
        const q = query(colRef, where('sapNo', '==', sapNo));
        const snap = await getDocs(q);
        
        const docUpdates = snap.docs.map(document => 
           updateDoc(doc(db, 'warehouses', w.id, 'inventory_v2', document.id), { imageUrl: '' })
         );
        await Promise.all(docUpdates);
        
        // Clear local cache for this warehouse
        this.inventoryCache.delete(w.id);
      } catch (err) {
        console.error(`Failed to clear image for sap ${sapNo} in warehouse ${w.id}`, err);
      }
    });
    
    await Promise.all(updatePromises);
    console.log(`[GlobalDelete] Successfully deleted image for SAP: ${sapNo} across all warehouses.`);
  }

  async clearInventory(id: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'inventory_v2');
    const snapshot = await getDocs(colRef);
    
    const promises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'warehouses', warehouseId, 'inventory_v2', docSnap.id)));
    await Promise.all(promises);
    this.inventoryCache.delete(warehouseId);
  }

  async clearLegacyLimits(id: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const inventory = await this.getInventory(warehouseId, true);
    
    // Sadece limiti 5 olanları hedefle
    const legacyItems = inventory.filter(i => i.criticalLimit === 5);
    
    const promises = legacyItems.map(item => {
      if (!item.id) return Promise.resolve();
      const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', item.id);
      return updateDoc(docRef, { criticalLimit: null });
    });
    
    await Promise.all(promises);
    this.inventoryCache.delete(warehouseId);
  }

  // --- Notifications Logic ---
  private async checkCriticalStock(warehouseId: string, item: any) {
    // Eğer kritik limit tanımlanmamışsa veya 0 ise takibi atla
    if (!item.criticalLimit || item.criticalLimit <= 0) return;

    const limit = item.criticalLimit;
    if (item.quantity <= limit) {
      const notifRef = collection(db, 'warehouses', warehouseId, 'notifications');
      const q = query(notifRef, where('itemId', '==', item.id), where('read', '==', false));
      const snap = await getDocs(q);
      
      if (snap.empty) {
        await addDoc(notifRef, {
          itemId: item.id,
          sapNo: item.sapNo,
          description: item.description,
          currentQuantity: item.quantity,
          limit: limit,
          timestamp: serverTimestamp(),
          read: false
        });
      }
    }
  }

  async getNotifications(id: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'notifications');
    const q = query(colRef, where('read', '==', false), orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  async markNotificationAsRead(warehouseId: string, notifId: string) {
    const docRef = doc(db, 'warehouses', warehouseId, 'notifications', notifId);
    await updateDoc(docRef, { read: true });
  }

  // --- Audit (Sayım) Logic ---
  async saveAudit(id: string, auditData: Omit<AuditRecord, 'id' | 'timestamp'>) {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'audits');
    await addDoc(colRef, {
      ...auditData,
      timestamp: serverTimestamp(),
      date: new Date().toLocaleDateString('tr-TR')
    });

    // Update each item's lastAuditDate and quantity in the inventory
    const auditTimestamp = serverTimestamp();
    const promises = auditData.results.map(async res => {
      const itemDocRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', res.itemId);
      await updateDoc(itemDocRef, {
        lastAuditDate: auditTimestamp,
        quantity: res.physicalQty, // Update system quantity to match physical reality
        lastUpdated: auditTimestamp
      });
      if (res.diff !== 0) {
        await this.addLog(warehouseId, {
           itemId: res.itemId,
           sapNo: res.sapNo || '',
           materialName: res.description || 'Bilinmeyen',
           type: 'UPDATE',
           quantity: res.diff,
           oldQty: res.systemQty,
           newQty: res.physicalQty,
           user: auditData.user,
           note: res.note ? `Sayım Güncellemesi: ${res.note}` : 'Sayım Güncellemesi'
        });
      }
    });

    await Promise.all(promises);
    this.inventoryCache.delete(warehouseId);
  }

  async getAuditHistory(id: string): Promise<AuditRecord[]> {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'audits');
    const q = query(colRef, orderBy('timestamp', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditRecord));
  }

  async deleteAudit(id: string, auditId: string): Promise<void> {
    const warehouseId = this.resolveWarehouseId(id);
    const docRef = doc(db, 'warehouses', warehouseId, 'audits', auditId);
    await deleteDoc(docRef);
  }


  async getStockBySap(id: string, sapNo: string): Promise<InventoryItem | null> {
    try {
      const warehouseId = this.resolveWarehouseId(id);
      const colRef = collection(db, 'warehouses', warehouseId, 'inventory_v2');
      const cleanSap = sapNo.toString().trim();
      const numSap = Number(cleanSap);
      const strippedSap = cleanSap.replace(/^0+/, ''); // Baştaki sıfırları atılmış hali

      // 1. Strateji: Tam metin eşleşmesi (örn: "01686" == "01686")
      const q1 = query(colRef, where('sapNo', '==', cleanSap));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        const docs = snap1.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
        docs.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
        return docs[0];
      }

      // 2. Strateji: Sayısal eşleşme (örn: 1686 == 1686)
      if (!isNaN(numSap)) {
        const q2 = query(colRef, where('sapNo', '==', numSap));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          const docs = snap2.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
          docs.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
          return docs[0];
        }
      }

      // 3. Strateji: Sıfırsız metin eşleşmesi (örn: "1686" == "1686")
      if (strippedSap !== cleanSap) {
        const q3 = query(colRef, where('sapNo', '==', strippedSap));
        const snap3 = await getDocs(q3);
        if (!snap3.empty) {
          const docs = snap3.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem));
          docs.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
          return docs[0];
        }
      }

      // 4. Strateji: Local filter (Büyük depolarda yavaş olabilir ama en garanti çözüm)
      const inventory = await this.getInventory(id);
      
      const alphaCleanSap = cleanSap.replace(/[^a-zA-Z0-9-]/g, '');
      
      const matchingItems = inventory.filter(item => {
        const itemSap = String(item.sapNo).trim();
        const compactItemSap = itemSap.replace(/\s+/g, '');
        const alphaItemSap = itemSap.replace(/[^a-zA-Z0-9-]/g, '');
        
        return itemSap === cleanSap || 
               compactItemSap === cleanSap ||
               alphaItemSap === alphaCleanSap ||
               itemSap === strippedSap || 
               Number(itemSap) === numSap;
      });

      if (matchingItems.length > 0) {
        // Mükerrer kayıt varsa (örn: biri 0, diğeri 116), en yüksek stoklu olanı dön!
        matchingItems.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0));
        return matchingItems[0];
      }
      
      return null;

    } catch (error) {
      console.error('Stock lookup error:', error);
      return null;
    }
  }

  async getLogs(id: string): Promise<InventoryLog[]> {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'logs');
    const q = query(colRef, orderBy('timestamp', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as InventoryLog));
  }

  async addLog(id: string, log: Omit<InventoryLog, 'id' | 'timestamp'>) {
    const warehouseId = this.resolveWarehouseId(id);
    const colRef = collection(db, 'warehouses', warehouseId, 'logs');
    await addDoc(colRef, {
      ...log,
      timestamp: serverTimestamp()
    });
  }

  async getReservationsFromDrafts(id: string): Promise<{
    bySap: Record<string, number>;
    details: Array<{
      taskId: string;
      team: string;
      turbinNo: string;
      sablon: string;
      durum: string;
      createdBy: string;
      personnel: string[];
      materials: Array<{ sapNo: string; description: string; used: number }>;
    }>;
  }> {
    try {
      const warehouseId = this.resolveWarehouseId(id);
      const sites = dataService.getSites();
      const siteId = sites.find(s => dataService.getWarehouseIdBySiteId(s.id) === warehouseId)?.id;
      
      if (!siteId) return { bySap: {}, details: [] };

      const tasksRef = collection(db, 'tasks');
      const q = query(
        tasksRef, 
        where('taskInfo.siteId', '==', siteId)
      );
      
      const snap = await getDocs(q);
      const bySap: Record<string, number> = {};
      const details: Array<{
        taskId: string;
        team: string;
        turbinNo: string;
        sablon: string;
        durum: string;
        createdBy: string;
        personnel: string[];
        materials: Array<{ sapNo: string; description: string; used: number }>;
      }> = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.workflow?.durum === 'Tamamlandı') return;
        
        const materials = data.maintenanceData?.materials || [];
        const usedMaterials: Array<{ sapNo: string; description: string; used: number }> = [];
        
        materials.forEach((mat: any) => {
          const typeUpper = mat.type?.toUpperCase();
          const isTakilan = !mat.type || typeUpper === 'T';
          if (mat.sapNo && mat.used > 0 && isTakilan) {
            const sap = String(mat.sapNo).trim();
            bySap[sap] = (bySap[sap] || 0) + Number(mat.used);
            usedMaterials.push({
              sapNo: sap,
              description: mat.description || '',
              used: Number(mat.used)
            });
          }
        });

        if (usedMaterials.length > 0) {
          details.push({
            taskId: docSnap.id,
            team: data.assignment?.assignedTeam || '-',
            turbinNo: data.taskInfo?.turbinNo || '-',
            sablon: data.taskInfo?.secilenSablon || '-',
            durum: data.workflow?.durum || '-',
            createdBy: data.assignment?.createdBy || '-',
            personnel: data.maintenanceData?.teamPersonnel?.map((p: any) => typeof p === 'string' ? p : p.name || '-') || [],
            materials: usedMaterials
          });
        }
      });
      
      console.log(`[getReservationsFromDrafts] Found ${details.length} tasks with ${Object.keys(bySap).length} reserved items for site ${siteId}`);
      return { bySap, details };
    } catch (error) {
      console.error('Draft reservation error:', error);
      return { bySap: {}, details: [] };
    }
  }

  async updateStockBySap(id: string, sapNo: string, delta: number, logInfo: { user: string, reason: string, reportNo?: string, materialName?: string }) {
    const item = await this.getStockBySap(id, sapNo);
    const warehouseId = this.resolveWarehouseId(id);
    let itemId = '';
    let currentQty = 0;
    let description = logInfo.materialName || 'Bilinmeyen Malzeme';

    if (!item || !item.id) {
      console.warn(`Item not found for SAP: ${sapNo} in warehouse: ${id}. Creating new entry.`);
      const colRef = collection(db, 'warehouses', warehouseId, 'inventory_v2');
      const { addDoc } = await import('firebase/firestore');
      const result = await addDoc(colRef, {
        sapNo: sapNo,
        description: description,
        quantity: delta, // If delta is negative, it goes below 0 (used before registered)
        shelfNo: 'Tanımsız',
        lastUpdated: serverTimestamp()
      });
      itemId = result.id;
      currentQty = 0;
    } else {
      itemId = item.id;
      currentQty = item.quantity || 0;
      description = item.description || description;
      
      const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
      const newQty = currentQty + delta;
      if (warehouseId.startsWith('team_') && newQty <= 0) {
        await deleteDoc(docRef);
      } else {
        await updateDoc(docRef, {
          quantity: newQty,
          lastUpdated: serverTimestamp()
        });
      }
    }

    await this.addLog(warehouseId, {
      itemId: itemId,
      sapNo: sapNo,
      materialName: description,
      oldQty: currentQty,
      newQty: currentQty + delta,
      quantity: Math.abs(delta),
      type: delta > 0 ? 'ADD' : 'REMOVE',
      user: logInfo.user,
      note: logInfo.reason + (logInfo.reportNo ? ` (Rapor: ${logInfo.reportNo})` : ''),
      source: 'Sistem'
    });
    
    this.inventoryCache.delete(warehouseId);
  }

  async reserveMaterial(id: string, itemId: string, quantity: number, note?: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const cachedItem = this.inventoryCache.get(warehouseId)?.data.find(i => i.id === itemId);
    const currentReserved = cachedItem?.reservedQuantity || 0;

    const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
    await updateDoc(docRef, {
      reservedQuantity: currentReserved + quantity,
      
      lastUpdated: serverTimestamp()
    });
    
    // Update local cache directly to avoid query lag
    const cached = this.inventoryCache.get(warehouseId);
    if (cached) {
      const idx = cached.data.findIndex(i => i.id === itemId);
      if (idx !== -1) {
        cached.data[idx] = { 
          ...cached.data[idx], 
          reservedQuantity: currentReserved + quantity,
          
          lastUpdated: new Date() as any
        };
        cached.timestamp = Date.now();
      }
    }
  }

  async deleteLog(id: string, logId: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const docRef = doc(db, 'warehouses', warehouseId, 'logs', logId);
    await deleteDoc(docRef);
  }

  async updateShelfLocations(id: string, itemIds: string[], shelfNo: string) {
    const warehouseId = this.resolveWarehouseId(id);
    const promises = itemIds.map(itemId => {
      const docRef = doc(db, 'warehouses', warehouseId, 'inventory_v2', itemId);
      return updateDoc(docRef, { shelfNo, lastUpdated: serverTimestamp() });
    });
    await Promise.all(promises);
    
    // Update local cache directly to avoid query lag
    const cached = this.inventoryCache.get(warehouseId);
    if (cached) {
      itemIds.forEach(itemId => {
        const idx = cached.data.findIndex(i => i.id === itemId);
        if (idx !== -1) {
          cached.data[idx] = { ...cached.data[idx], shelfNo, lastUpdated: new Date() as any } as any;
        }
      });
      cached.timestamp = Date.now();
    }
  }

  async calculateConsumptionTrends(id: string, preFetchedInventory?: InventoryItem[], preFetchedLogs?: InventoryLog[]) {
    const warehouseId = this.resolveWarehouseId(id);
    const logs = preFetchedLogs || await this.getLogs(warehouseId);
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const consumption: Record<string, { total: number }> = {};
    
    logs.forEach(log => {
      const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : (log.timestamp instanceof Date ? log.timestamp : new Date(log.timestamp));
      if (logDate < ninetyDaysAgo) return;
      
      // Miktar değişimini hesapla
      let qty = 0;
      if (log.type === 'REMOVE') {
        qty = Math.abs(log.quantity || 0);
      } else if (log.type === 'UPDATE' && log.oldQty !== undefined && log.newQty !== undefined) {
        if (log.newQty < log.oldQty) {
          qty = log.oldQty - log.newQty;
        }
      }

      if (qty > 0 && log.sapNo) {
        const sap = String(log.sapNo).trim();
        if (!consumption[sap]) consumption[sap] = { total: 0 };
        consumption[sap].total += qty;
      }
    });

    const trends: Record<string, { avgDaily: number, forecastDays: number }> = {};
    const inventory = preFetchedInventory || await this.getInventory(warehouseId);

    inventory.forEach(item => {
      const sap = String(item.sapNo).trim();
      const usage = consumption[sap] || { total: 0 };
      const avgDaily = usage.total / 90;
      const forecastDays = avgDaily > 0 ? Math.round(item.quantity / avgDaily) : 999;
      trends[sap] = { avgDaily, forecastDays };
    });

    return trends;
  }

  async getShelfOccupancy(id: string, preFetchedInventory?: InventoryItem[]) {
    const inventory = preFetchedInventory || await this.getInventory(id);
    const occupancy: Record<string, number> = {};
    inventory.forEach(item => {
      const shelf = item.shelfNo || 'Tanımsız';
      occupancy[shelf] = (occupancy[shelf] || 0) + 1;
    });
    return occupancy;
  }

  async getMaterialInfoBySapGlobally(sapNo: string) {
    try {
      const q = query(collectionGroup(db, 'inventory_v2'), where('sapNo', '==', sapNo), limit(1));
      const snap = await getDocs(q);
      if (!snap.empty) {
        return snap.docs[0].data() as InventoryItem;
      }
      return null;
    } catch (err) {
      console.error('[WarehouseService] Error fetching global SAP info:', err);
      return null;
    }
  }
}

export const warehouseService = new WarehouseService();
