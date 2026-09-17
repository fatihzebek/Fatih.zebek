export interface OfflineReport {
  id: string;
  report: any;
  files: { name: string; type: string; data: string }[];
  timestamp: number;
}

export interface PendingStockMaterial {
  sapNo: string;
  description: string;
  used: number;
  defectCount: number;
  type?: string;
  serialNo?: string;
}

export interface PendingStockAction {
  id: string; // e.g. stock_DR_DT11092026862
  reportNo: string;
  reportDocId?: string;
  siteId: string;
  siteName: string;
  turbineNo: string;
  turbineSerial: string;
  matFormNo: string;
  faultCode: string;
  faultDesc: string;
  user: string;
  usedWarehouseId: string;
  siteWarehouseId: string;
  materials: PendingStockMaterial[];
  taskId?: string | null;
  isWarehouse?: boolean;
  repairedMaterial?: any;
  notes?: string;
  timestamp: number;
}

class OfflineSyncService {
  private dbName = 'DhServisOfflineDB';
  private storeName = 'offlineReports';
  private stockStoreName = 'offlineStockActions';
  private dbVersion = 2;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (!window.indexedDB) {
      console.error("Tarayıcınız IndexedDB desteklemiyor. Çevrimdışı mod çalışmayabilir.");
      return;
    }
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(this.stockStoreName)) {
          db.createObjectStore(this.stockStoreName, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };

      request.onerror = (event) => {
        console.error("IndexedDB açılırken hata:", event);
        reject(event);
      };
    });
  }

  async saveReportToQueue(report: any, files: File[]): Promise<void> {
    if (!this.db) await this.init();

    const filePromises = files.map(file => this.fileToBase64(file));
    const base64Files = await Promise.all(filePromises);

    const offlineReport: OfflineReport = {
      id: 'offline_' + Date.now().toString(),
      report,
      files: base64Files,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(offlineReport);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  async getQueuedReports(): Promise<OfflineReport[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result || []);
      };

      request.onerror = (e) => reject(e);
    });
  }

  async removeReportFromQueue(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  // Stock Action Queue Operations
  async saveStockActionToQueue(action: PendingStockAction): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stockStoreName], 'readwrite');
      const store = transaction.objectStore(this.stockStoreName);
      const request = store.put(action);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  async getQueuedStockActions(): Promise<PendingStockAction[]> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stockStoreName], 'readonly');
      const store = transaction.objectStore(this.stockStoreName);
      const request = store.getAll();

      request.onsuccess = (event) => {
        resolve((event.target as IDBRequest).result || []);
      };

      request.onerror = (e) => reject(e);
    });
  }

  async removeStockActionFromQueue(id: string): Promise<void> {
    if (!this.db) await this.init();

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.stockStoreName], 'readwrite');
      const store = transaction.objectStore(this.stockStoreName);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = (e) => reject(e);
    });
  }

  async processPendingStockAction(action: PendingStockAction, onProgress?: (msg: string) => void): Promise<{ success: boolean; remainingMaterials: PendingStockMaterial[] }> {
    const { warehouseService } = await import('./WarehouseService');
    const remaining: PendingStockMaterial[] = [];
    const usedWarehouseId = action.usedWarehouseId;
    const siteWarehouseId = action.siteWarehouseId;

    for (const mat of action.materials) {
      try {
        const typeUpper = mat.type?.toUpperCase();
        const isTakilan = !mat.type || typeUpper === 'T';

        if (mat.sapNo && mat.used > 0 && isTakilan && usedWarehouseId) {
          onProgress?.(`Stok düşülüyor: ${mat.sapNo}...`);
          const stockItemNew = await warehouseService.getStockBySapAndCondition(usedWarehouseId, mat.sapNo, 'NEW');
          const qtyNew = stockItemNew?.quantity || 0;

          const detailedNote = `(Rapor: ${action.reportNo}, Arıza Kodu: ${action.faultCode || 'Bakım'}, Konum: ${action.siteName} - ${action.turbineNo.toUpperCase().startsWith('T') ? action.turbineNo : 'T' + action.turbineNo})`;

          if (qtyNew >= mat.used) {
            await warehouseService.updateStockBySap(usedWarehouseId, mat.sapNo, -mat.used, {
              user: action.user || 'Sistem',
              reason: 'Saha Raporu ile Malzeme Kullanımı ' + detailedNote,
              reportNo: action.reportNo,
              materialName: mat.description,
              turbineNo: action.turbineNo,
              turbineSerial: action.turbineSerial,
              formNo: action.matFormNo
            }, 'NEW');
          } else {
            if (qtyNew > 0) {
              await warehouseService.updateStockBySap(usedWarehouseId, mat.sapNo, -qtyNew, {
                user: action.user || 'Sistem',
                reason: 'Saha Raporu ile Malzeme Kullanımı (Kısmi NEW) ' + detailedNote,
                reportNo: action.reportNo,
                materialName: mat.description,
                turbineNo: action.turbineNo,
                turbineSerial: action.turbineSerial,
                formNo: action.matFormNo
              }, 'NEW');
            }
            const remainder = mat.used - qtyNew;
            await warehouseService.updateStockBySap(usedWarehouseId, mat.sapNo, -remainder, {
              user: action.user || 'Sistem',
              reason: 'Saha Raporu ile Malzeme Kullanımı (Kısmi REVİZE) ' + detailedNote,
              reportNo: action.reportNo,
              materialName: mat.description,
              turbineNo: action.turbineNo,
              turbineSerial: action.turbineSerial,
              formNo: action.matFormNo
            }, 'REVISED');
          }

          if (usedWarehouseId.startsWith('team_') && siteWarehouseId) {
            try {
              await warehouseService.decreaseReservation(siteWarehouseId, mat.sapNo, mat.used, usedWarehouseId);
            } catch (e) {
              console.warn("Failed to decrease reservation:", e);
            }
          }
        }

        if (mat.sapNo && mat.defectCount > 0) {
          onProgress?.(`Arızalı stok kaydediliyor: ${mat.sapNo}...`);
          const detailedNote = `(Rapor: ${action.reportNo}, Arıza Kodu: ${action.faultCode || 'Bakım'}, Konum: ${action.siteName} - ${action.turbineNo.toUpperCase().startsWith('T') ? action.turbineNo : 'T' + action.turbineNo})`;

          if (siteWarehouseId) {
            await warehouseService.updateStockBySap(siteWarehouseId, mat.sapNo, mat.defectCount, {
              user: action.user || 'Sistem',
              reason: 'Saha Raporunda Sökülen Arızalı Parça ' + detailedNote,
              reportNo: action.reportNo,
              materialName: mat.description
            }, 'DEFECT', undefined, mat.serialNo);
          }

          if (usedWarehouseId) {
            await warehouseService.updateStockBySap(usedWarehouseId, mat.sapNo, mat.defectCount, {
              user: action.user || 'Sistem',
              reason: 'Saha Raporunda Sökülen Arızalı Parça ' + detailedNote,
              reportNo: action.reportNo,
              materialName: mat.description
            }, 'DEFECT', undefined, mat.serialNo);
          }
        }
      } catch (err) {
        console.error(`[OfflineSync] Stok düşüm hatası (${mat.sapNo}):`, err);
        remaining.push(mat);
      }
    }

    if (action.isWarehouse) {
      try {
        let mainMatSap = action.repairedMaterial?.sapNo || '';
        let mainMatDesc = action.repairedMaterial?.description || '';
        let mainMatQty = action.repairedMaterial?.quantity || 1;
        let mainMatItemId = action.repairedMaterial?.itemId || '';
        let mainMatSerial = action.repairedMaterial?.serialNo || '';

        const targetWarehouseId = siteWarehouseId;
        if (mainMatSap && targetWarehouseId) {
          if (mainMatItemId) {
            await warehouseService.returnDefectToInventory(
              targetWarehouseId,
              mainMatItemId,
              'REVISED',
              action.user || 'Sistem',
              mainMatSerial,
              `Saha İçi Revizyon (Rapor: ${action.reportNo}): ${action.notes || ''}`,
              mainMatSap,
              mainMatDesc
            );
          } else {
            await warehouseService.updateStockBySap(
              targetWarehouseId,
              mainMatSap,
              -mainMatQty,
              { user: action.user || 'Sistem', reason: `Saha İçi Revizyon (Rapor: ${action.reportNo})` },
              'DEFECT'
            ).catch(console.warn);

            await warehouseService.updateStockBySap(
              targetWarehouseId,
              mainMatSap,
              mainMatQty,
              { user: action.user || 'Sistem', reason: `Saha İçi Revizyon Tamamlandı (Rapor: ${action.reportNo}): ${action.notes || ''}` },
              'REVISED'
            );
          }
        }
      } catch (whErr) {
        console.warn("Depo içi revize parça tamamlama hatası:", whErr);
      }
    }

    if (action.taskId && remaining.length === 0) {
      try {
        const { taskService } = await import('./TaskService');
        await taskService.updateTaskStatus(action.taskId, 'Tamamlandı').catch(console.warn);
      } catch (tErr) {
        console.warn("Task closing error:", tErr);
      }
    }

    return {
      success: remaining.length === 0,
      remainingMaterials: remaining
    };
  }

  async syncAllPendingStockActions(): Promise<void> {
    if (!navigator.onLine) return;
    try {
      const actions = await this.getQueuedStockActions();
      if (actions.length === 0) return;

      console.log(`[OfflineSync] ${actions.length} bekleyen stok düşümü senkronize ediliyor...`);
      for (const act of actions) {
        const res = await this.processPendingStockAction(act);
        if (res.success) {
          await this.removeStockActionFromQueue(act.id);
          (window as any).showToast?.('BAŞARILI', `${act.reportNo} numaralı raporun bekleyen stok düşümleri otomatik tamamlandı.`, 'success');
        } else {
          await this.saveStockActionToQueue({
            ...act,
            materials: res.remainingMaterials
          });
        }
      }
    } catch (e) {
      console.warn("[OfflineSync] syncAllPendingStockActions error:", e);
    }
  }

  base64ToFile(base64Data: string, filename: string, mimeType: string): File {
    const byteString = atob(base64Data.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    const blob = new Blob([ab], { type: mimeType });
    return new File([blob], filename, { type: mimeType });
  }

  private fileToBase64(file: File): Promise<{ name: string; type: string; data: string }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve({
        name: file.name,
        type: file.type,
        data: reader.result as string
      });
      reader.onerror = error => reject(error);
    });
  }
}

export const offlineSyncService = new OfflineSyncService();
