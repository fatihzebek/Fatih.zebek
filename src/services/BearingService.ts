import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';

export type BearingConditionStatus = 'HEALTHY' | 'FRONT_BEARING_REPLACED' | 'METAL_PARTICLE_DETECTED' | 'WARNING';

export interface BearingRecord {
  id: string; // turbineId (örnek: "48886")
  turbineId: string;
  turbineLabel: string; // "T-01"
  siteId: string;
  siteName: string;
  status: BearingConditionStatus;
  
  // Ön Rulman Değişim Bilgileri (FRONT_BEARING_REPLACED için)
  replacementDate?: string;
  replacedBearingModel?: string; // e.g. "FAG 241/600", "SKF 240/600"
  replacementReason?: string; // e.g. "İç bilezik çatlağı / yorulma"
  replacementTechnician?: string;
  
  // Metal Çapak / Aşınma Takip Bilgileri (METAL_PARTICLE_DETECTED için)
  metalDetectedDate?: string;
  metalSeverity?: 'LOW' | 'MEDIUM' | 'CRITICAL';
  magnetTestResult?: 'POSITIVE' | 'NEGATIVE';
  fePpm?: number;
  pqIndex?: number;
  flushingDone?: boolean;
  flushingDate?: string;
  nextInspectionDate?: string; // 3 aylık periyot
  
  // Genel Notlar ve Denetim Bilgisi
  notes?: string;
  updatedAt?: any;
  updatedBy?: string;
  lastInspectionDate?: string;
  lastAcousticStatus?: 'NORMAL' | 'WARNING' | 'CRITICAL';
  lastAcousticFrequency?: number;
}

export interface BearingInspection {
  id: string;
  turbineId: string;
  turbineLabel: string;
  siteId?: string;
  siteName?: string;
  type: 'ACOUSTIC' | 'GREASE' | 'VIBRATION';
  createdAt: string; // ISO string for sorting
  dateFormatted: string; // "DD.MM.YYYY HH:mm"
  inspector: string;
  condition: 'NORMAL' | 'WARNING' | 'CRITICAL';
  
  // Acoustic fields
  peakFrequency?: number;
  knocksDetected?: boolean;
  frictionDetected?: boolean;
  yawSimulationMode?: string;
  
  // Grease fields
  greaseClass?: string;
  greaseClassName?: string;
  greaseColor?: string;
  fePpm?: number;
  pqIndex?: number;
  
  message?: string;
  actionRequired?: string;
  notes?: string;
}

class BearingService {
  private collectionName = 'bearing_fleet_records';
  private cache: Record<string, BearingRecord> = {};
  private cacheKey = 'bearing_fleet_records_cache';

  private inspectionCollectionName = 'bearing_inspections';
  private inspectionCache: BearingInspection[] = [];
  private inspectionCacheKey = 'bearing_inspections_cache';

  constructor() {
    this.loadFromLocalStorage();
  }

  private loadFromLocalStorage() {
    try {
      const saved = localStorage.getItem(this.cacheKey);
      if (saved) {
        this.cache = JSON.parse(saved);
      }
      const savedInsp = localStorage.getItem(this.inspectionCacheKey);
      if (savedInsp) {
        this.inspectionCache = JSON.parse(savedInsp);
      }
    } catch (e) {
      console.warn("BearingService local cache error:", e);
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
      localStorage.setItem(this.inspectionCacheKey, JSON.stringify(this.inspectionCache));
    } catch (e) {
      console.warn("BearingService save cache error:", e);
    }
  }

  public getCachedRecords(): Record<string, BearingRecord> {
    return this.cache;
  }

  public getRecord(turbineId: string): BearingRecord | null {
    return this.cache[turbineId] || null;
  }

  public subscribeAllRecords(callback: (records: Record<string, BearingRecord>) => void): () => void {
    // Hemen cache verisini ilet
    if (Object.keys(this.cache).length > 0) {
      callback(this.cache);
    }

    const colRef = collection(db, this.collectionName);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const records: Record<string, BearingRecord> = {};
      snapshot.forEach(docSnap => {
        records[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as BearingRecord;
      });
      this.cache = records;
      this.saveToLocalStorage();
      callback(records);
    }, (err) => {
      console.error("BearingService subscribe error:", err);
      // Fallback cache
      callback(this.cache);
    });

    return unsubscribe;
  }

  public async fetchAllRecords(): Promise<Record<string, BearingRecord>> {
    try {
      const colRef = collection(db, this.collectionName);
      const snapshot = await getDocs(colRef);
      const records: Record<string, BearingRecord> = {};
      snapshot.forEach(docSnap => {
        records[docSnap.id] = { id: docSnap.id, ...docSnap.data() } as BearingRecord;
      });
      this.cache = records;
      this.saveToLocalStorage();
      return records;
    } catch (error) {
      console.error("BearingService fetchAllRecords error:", error);
      return this.cache;
    }
  }

  public async saveRecord(record: BearingRecord): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, record.turbineId);
      const cleanRecord = {
        ...record,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, cleanRecord, { merge: true });
      this.cache[record.turbineId] = cleanRecord;
      this.saveToLocalStorage();
    } catch (error) {
      console.error("BearingService saveRecord error:", error);
      throw error;
    }
  }

  public async deleteRecord(turbineId: string): Promise<void> {
    try {
      const docRef = doc(db, this.collectionName, turbineId);
      await deleteDoc(docRef);
      delete this.cache[turbineId];
      this.saveToLocalStorage();
    } catch (error) {
      console.error("BearingService deleteRecord error:", error);
      throw error;
    }
  }

  public getCachedInspections(): BearingInspection[] {
    return this.inspectionCache;
  }

  public subscribeInspections(callback: (inspections: BearingInspection[]) => void): () => void {
    if (this.inspectionCache.length > 0) {
      callback(this.inspectionCache);
    }

    const colRef = collection(db, this.inspectionCollectionName);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const list: BearingInspection[] = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() } as BearingInspection);
      });
      list.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      this.inspectionCache = list;
      this.saveToLocalStorage();
      callback(list);
    }, (err) => {
      console.error("BearingService subscribeInspections error:", err);
      callback(this.inspectionCache);
    });

    return unsubscribe;
  }

  public async saveInspection(inspection: Omit<BearingInspection, 'id'> & { id?: string }): Promise<BearingInspection> {
    try {
      const id = inspection.id || `insp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const docRef = doc(db, this.inspectionCollectionName, id);
      const fullInspection: BearingInspection = {
        ...inspection,
        id,
        createdAt: inspection.createdAt || new Date().toISOString()
      };

      await setDoc(docRef, fullInspection, { merge: true });

      // Update local inspection cache
      const existingIdx = this.inspectionCache.findIndex(i => i.id === id);
      if (existingIdx >= 0) {
        this.inspectionCache[existingIdx] = fullInspection;
      } else {
        this.inspectionCache.unshift(fullInspection);
      }
      this.inspectionCache.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      // Update fleet record summary
      const existingRecord = this.getRecord(inspection.turbineId) || ({
        id: inspection.turbineId,
        turbineId: inspection.turbineId,
        turbineLabel: inspection.turbineLabel,
        siteId: inspection.siteId || '',
        siteName: inspection.siteName || '',
        status: inspection.condition === 'CRITICAL' ? 'WARNING' : 'HEALTHY'
      } as BearingRecord);

      existingRecord.lastInspectionDate = inspection.dateFormatted;
      if (inspection.type === 'ACOUSTIC') {
        existingRecord.lastAcousticStatus = inspection.condition;
        if (inspection.peakFrequency) existingRecord.lastAcousticFrequency = inspection.peakFrequency;
      }
      await this.saveRecord(existingRecord);

      this.saveToLocalStorage();
      return fullInspection;
    } catch (error) {
      console.error("BearingService saveInspection error:", error);
      throw error;
    }
  }

  public async deleteInspection(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.inspectionCollectionName, id);
      await deleteDoc(docRef);
      this.inspectionCache = this.inspectionCache.filter(i => i.id !== id);
      this.saveToLocalStorage();
    } catch (error) {
      console.error("BearingService deleteInspection error:", error);
      throw error;
    }
  }
}

export const bearingService = new BearingService();
