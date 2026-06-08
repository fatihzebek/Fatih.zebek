export interface OfflineReport {
  id: string;
  report: any;
  files: { name: string; type: string; data: string }[];
  timestamp: number;
}

class OfflineSyncService {
  private dbName = 'DhServisOfflineDB';
  private storeName = 'offlineReports';
  private dbVersion = 1;
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
