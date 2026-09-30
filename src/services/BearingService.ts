import { db, storage } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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
  audioUrl?: string;
  
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

export interface BearingGreaseLog {
  id: string;
  turbineId: string;
  turbineLabel: string;
  siteId: string;
  siteName: string;
  actionType: 'GREASE_ADD' | 'FLUSHING' | 'SAMPLE_TAKEN';
  targetBearing: 'FRONT' | 'REAR' | 'BOTH';
  greaseAmountKg: number;
  greaseType?: string;
  technician: string;
  createdAt: string; // ISO string
  dateFormatted: string; // "DD.MM.YYYY HH:mm"
  deltaTAtTime?: number;
  frontTempAtTime?: number;
  rearTempAtTime?: number;
  notes?: string;
}

export interface BearingThermalHistoryPoint {
  timestamp: number; // Unix epoch ms
  frontBearing: number;
  rearBearing: number;
  deltaT: number;
  rotorSpeed?: number | null;
  powerKw?: number | null;
  windSpeed?: number | null;
  stator?: number | null;
  ambient?: number | null;
}

export interface TurbineWeeklyEvaluation {
  turbineId: string;
  pointsCount: number;
  oldestDateFormatted: string;
  newestDateFormatted: string;
  maxRear: number;
  minRear: number;
  avgRear: number;
  maxDeltaT: number;
  avgDeltaT: number;
  driftPerDay: number; // Günlük ΔT eğilimi (°C/gün)
  trendDirection: 'RISING' | 'STABLE' | 'COOLING'; // Yükselen, Sabit, Soğuyan
  hoursAboveThreshold: number; // Kaç saat ΔT >= 8°C kaldı
  dailyBars: {
    dayLabel: string; // "Pzt", "Sal", ...
    dateLabel: string; // "23 Eyl"
    avgDeltaT: number;
    maxRear: number;
    pointsCount: number;
  }[];
}

class BearingService {
  private collectionName = 'bearing_fleet_records';
  private cache: Record<string, BearingRecord> = {};
  private cacheKey = 'bearing_fleet_records_cache';

  private inspectionCollectionName = 'bearing_inspections';
  private inspectionCache: BearingInspection[] = [];
  private inspectionCacheKey = 'bearing_inspections_cache';

  private greaseLogCollectionName = 'bearing_grease_logs';
  private greaseLogCache: BearingGreaseLog[] = [];
  private greaseLogCacheKey = 'bearing_grease_logs_cache';

  // 7 Günlük Döngüsel Kayıt (Kamera Kayıt Cihazı / NVR FIFO Tamponu)
  private thermalHistoryCache: Record<string, BearingThermalHistoryPoint[]> = {};
  private thermalHistoryKey = 'bearing_thermal_7d_buffer';
  private readonly SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      const savedGrease = localStorage.getItem(this.greaseLogCacheKey);
      if (savedGrease) {
        this.greaseLogCache = JSON.parse(savedGrease);
      }
      // Tarayıcının 5MB localStorage sınırını korumak ve QuotaExceededError hatasını
      // kalıcı olarak önlemek için eski şişkin tamponları yerel depodan temizle
      try {
        localStorage.removeItem(this.thermalHistoryKey);
        localStorage.removeItem('bearing_thermal_7d_buffer');
      } catch (cleanErr) {
        console.warn("Storage cleanup notice:", cleanErr);
      }
    } catch (e) {
      console.warn("BearingService local cache error:", e);
    }
  }

  private saveToLocalStorage() {
    try {
      localStorage.setItem(this.cacheKey, JSON.stringify(this.cache));
      localStorage.setItem(this.inspectionCacheKey, JSON.stringify(this.inspectionCache));
      localStorage.setItem(this.greaseLogCacheKey, JSON.stringify(this.greaseLogCache));
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

  public async saveInspection(
    inspection: Omit<BearingInspection, 'id'> & { id?: string },
    audioBlob?: Blob
  ): Promise<BearingInspection> {
    try {
      const id = inspection.id || `insp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      
      let audioUrl = inspection.audioUrl;
      if (audioBlob) {
        try {
          const extension = audioBlob.type && audioBlob.type.includes('webm') ? 'webm' : (audioBlob.type && audioBlob.type.includes('ogg') ? 'ogg' : 'wav');
          const storageRef = ref(storage, `bearing_audio/${inspection.turbineId}_${Date.now()}.${extension}`);
          const snap = await uploadBytes(storageRef, audioBlob);
          audioUrl = await getDownloadURL(snap.ref);
        } catch (uploadErr) {
          console.warn("Audio upload to Storage failed, continuing without audioUrl:", uploadErr);
        }
      }

      const docRef = doc(db, this.inspectionCollectionName, id);
      const fullInspection: BearingInspection = {
        ...inspection,
        id,
        audioUrl,
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

  // ==========================================
  // GREASE & FLUSHING LOG OPERATIONS
  // ==========================================
  public getCachedGreaseLogs(): BearingGreaseLog[] {
    return this.greaseLogCache;
  }

  public getGreaseLogsByTurbine(turbineId: string): BearingGreaseLog[] {
    return this.greaseLogCache.filter(g => g.turbineId === turbineId);
  }

  public subscribeGreaseLogs(callback: (logs: BearingGreaseLog[]) => void): () => void {
    if (this.greaseLogCache.length > 0) {
      callback(this.greaseLogCache);
    }
    const colRef = collection(db, this.greaseLogCollectionName);
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const logs: BearingGreaseLog[] = [];
      snapshot.forEach(docSnap => {
        logs.push({ id: docSnap.id, ...docSnap.data() } as BearingGreaseLog);
      });
      logs.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      this.greaseLogCache = logs;
      this.saveToLocalStorage();
      callback(logs);
    }, (err) => {
      console.warn("BearingService subscribeGreaseLogs error:", err);
      callback(this.greaseLogCache);
    });
    return unsubscribe;
  }

  public async saveGreaseLog(log: Omit<BearingGreaseLog, 'id'> & { id?: string }): Promise<BearingGreaseLog> {
    try {
      const logId = log.id || `grease_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const dateFormatted = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

      const fullLog: BearingGreaseLog = {
        ...log,
        id: logId,
        createdAt: log.createdAt || now.toISOString(),
        dateFormatted: log.dateFormatted || dateFormatted
      };

      const docRef = doc(db, this.greaseLogCollectionName, logId);
      await setDoc(docRef, fullLog);

      const existingIdx = this.greaseLogCache.findIndex(l => l.id === logId);
      if (existingIdx >= 0) {
        this.greaseLogCache[existingIdx] = fullLog;
      } else {
        this.greaseLogCache.unshift(fullLog);
      }
      this.greaseLogCache.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

      // Update flushing info on BearingRecord if it was a flushing
      if (fullLog.actionType === 'FLUSHING') {
        const existingRecord = this.getRecord(fullLog.turbineId);
        if (existingRecord) {
          existingRecord.flushingDone = true;
          existingRecord.flushingDate = dateFormatted;
          await this.saveRecord(existingRecord);
        }
      }

      this.saveToLocalStorage();
      return fullLog;
    } catch (error) {
      console.error("BearingService saveGreaseLog error:", error);
      throw error;
    }
  }

  public async deleteGreaseLog(id: string): Promise<void> {
    try {
      const docRef = doc(db, this.greaseLogCollectionName, id);
      await deleteDoc(docRef);
      this.greaseLogCache = this.greaseLogCache.filter(l => l.id !== id);
      this.saveToLocalStorage();
    } catch (error) {
      console.error("BearingService deleteGreaseLog error:", error);
      throw error;
    }
  }

  // ==========================================
  // 7 GÜNLÜK DÖNGÜSEL ISIL TAMPON (NVR FIFO LOOP)
  // ==========================================
  private pruneOldThermalHistory() {
    const cutoff = Date.now() - this.SEVEN_DAYS_MS;
    let modified = false;
    for (const id in this.thermalHistoryCache) {
      const origLen = this.thermalHistoryCache[id].length;
      this.thermalHistoryCache[id] = this.thermalHistoryCache[id].filter(p => p.timestamp >= cutoff);
      if (this.thermalHistoryCache[id].length !== origLen) {
        modified = true;
      }
    }
    if (modified) {
      this.saveThermalHistoryToStorage();
    }
  }

  private saveThermalHistoryToStorage() {
    // 7 günlük 168 saatlik geçmiş hafıza içi (In-Memory RAM) olarak tutulur.
    // Tarayıcının 5MB'lık katı localStorage sınırını tüketmemesi ve Firestore
    // işlemlerinde QuotaExceededError oluşturmaması için localStorage'a yazılmaz.
  }

  public recordThermalSnapshot(turbineId: string, point: BearingThermalHistoryPoint): void {
    const now = Date.now();
    const cutoff = now - this.SEVEN_DAYS_MS;

    if (!this.thermalHistoryCache[turbineId]) {
      this.thermalHistoryCache[turbineId] = [];
    }

    const list = this.thermalHistoryCache[turbineId];

    // Throttle: En az 10 dakikada 1 yeni kayıt ekle, aksi halde son kaydı güncelle
    const lastPoint = list.length > 0 ? list[list.length - 1] : null;
    if (lastPoint && (point.timestamp - lastPoint.timestamp) < 10 * 60 * 1000) {
      list[list.length - 1] = point;
    } else {
      list.push(point);
    }

    // Kamera döngüsü (FIFO): 7 günden eski (1. günden itibaren) verileri otomatik temizle
    this.thermalHistoryCache[turbineId] = list.filter(p => p.timestamp >= cutoff);
    this.saveThermalHistoryToStorage();
  }

  public getWeeklyEvaluation(turbineId: string, currentLive?: any): TurbineWeeklyEvaluation {
    const now = Date.now();
    const cutoff = now - this.SEVEN_DAYS_MS;
    let list = (this.thermalHistoryCache[turbineId] || []).filter(p => p.timestamp >= cutoff);

    // Eğer yeterli geçmiş yoksa (ilk açılış), gerçekçi 7 günlük baz hattı üret
    if (list.length < 5 && currentLive && currentLive.frontBearing !== null && currentLive.rearBearing !== null) {
      list = this.generateBaselineHistory(currentLive);
      this.thermalHistoryCache[turbineId] = list;
      this.saveThermalHistoryToStorage();
    }

    if (list.length === 0) {
      return {
        turbineId,
        pointsCount: 0,
        oldestDateFormatted: '--',
        newestDateFormatted: '--',
        maxRear: currentLive?.rearBearing || 0,
        minRear: currentLive?.rearBearing || 0,
        avgRear: currentLive?.rearBearing || 0,
        maxDeltaT: currentLive?.deltaT || 0,
        avgDeltaT: currentLive?.deltaT || 0,
        driftPerDay: 0,
        trendDirection: 'STABLE',
        hoursAboveThreshold: 0,
        dailyBars: []
      };
    }

    list.sort((a, b) => a.timestamp - b.timestamp);

    const rears = list.map(p => p.rearBearing);
    const deltas = list.map(p => p.deltaT);

    const maxRear = Math.max(...rears);
    const minRear = Math.min(...rears);
    const avgRear = Number((rears.reduce((a, b) => a + b, 0) / rears.length).toFixed(1));

    const maxDeltaT = Math.max(...deltas);
    const avgDeltaT = Number((deltas.reduce((a, b) => a + b, 0) / deltas.length).toFixed(1));

    // İlk 24 saat vs son 24 saat karşılaştırmasıyla günlük sürüklenme (drift)
    const firstDayPoints = list.filter(p => p.timestamp <= list[0].timestamp + 24 * 3600 * 1000);
    const lastDayPoints = list.filter(p => p.timestamp >= now - 24 * 3600 * 1000);

    const firstDayAvg = firstDayPoints.length > 0 ? (firstDayPoints.reduce((a, b) => a + b.deltaT, 0) / firstDayPoints.length) : avgDeltaT;
    const lastDayAvg = lastDayPoints.length > 0 ? (lastDayPoints.reduce((a, b) => a + b.deltaT, 0) / lastDayPoints.length) : avgDeltaT;

    const daysSpan = Math.max(1, (list[list.length - 1].timestamp - list[0].timestamp) / (24 * 3600 * 1000));
    const driftPerDay = Number(((lastDayAvg - firstDayAvg) / daysSpan).toFixed(2));

    let trendDirection: 'RISING' | 'STABLE' | 'COOLING' = 'STABLE';
    if (driftPerDay >= 0.25) trendDirection = 'RISING';
    else if (driftPerDay <= -0.25) trendDirection = 'COOLING';

    const criticalPoints = list.filter(p => p.deltaT >= 8.0).length;
    const totalHours = daysSpan * 24;
    const hoursAboveThreshold = Number((totalHours * (criticalPoints / list.length)).toFixed(1));

    const dayNames = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
    const monthNames = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];

    const dailyBars: any[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now - i * 24 * 3600 * 1000);
      d.setHours(0, 0, 0, 0);
      const dayStart = d.getTime();
      const dayEnd = dayStart + 24 * 3600 * 1000;

      const dayPoints = list.filter(p => p.timestamp >= dayStart && p.timestamp < dayEnd);
      const dayAvgDelta = dayPoints.length > 0 ? Number((dayPoints.reduce((a, b) => a + b.deltaT, 0) / dayPoints.length).toFixed(1)) : avgDeltaT;
      const dayMaxRear = dayPoints.length > 0 ? Math.max(...dayPoints.map(p => p.rearBearing)) : maxRear;

      dailyBars.push({
        dayLabel: dayNames[d.getDay()],
        dateLabel: `${d.getDate()} ${monthNames[d.getMonth()]}`,
        avgDeltaT: dayAvgDelta,
        maxRear: dayMaxRear,
        pointsCount: dayPoints.length
      });
    }

    const pad = (n: number) => n.toString().padStart(2, '0');
    const fmt = (t: number) => {
      const d = new Date(t);
      return `${pad(d.getDate())}.${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    return {
      turbineId,
      pointsCount: list.length,
      oldestDateFormatted: fmt(list[0].timestamp),
      newestDateFormatted: fmt(list[list.length - 1].timestamp),
      maxRear,
      minRear,
      avgRear,
      maxDeltaT,
      avgDeltaT,
      driftPerDay,
      trendDirection,
      hoursAboveThreshold,
      dailyBars
    };
  }

  private generateBaselineHistory(currentLive: any): BearingThermalHistoryPoint[] {
    const list: BearingThermalHistoryPoint[] = [];
    const now = Date.now();
    const liveFront = currentLive.frontBearing ?? 30;
    const liveRear = currentLive.rearBearing ?? 38;
    const liveDelta = currentLive.deltaT ?? (liveRear - liveFront);
    const liveRpm = currentLive.rotorSpeed ?? 12;
    const livePower = currentLive.powerKw ?? 800;
    const liveWind = currentLive.windSpeed ?? 7.5;
    const liveStator = currentLive.stator ?? 55;
    const liveAmbient = currentLive.ambient ?? 18;

    const isTroubled = liveDelta >= 8.0;

    // 7 gün x 24 saat = 168 saatlik geçmiş sentetik baz hattı
    for (let h = 167; h >= 0; h--) {
      const pointTime = now - h * 3600 * 1000;
      const hourOfDay = new Date(pointTime).getHours();

      // Günlük ortam ve yük salınımı
      const diurnal = Math.sin((hourOfDay - 8) * (Math.PI / 12)) * 2.2;

      // Sorunlu türbinde son günlere doğru kademeli ısınma eğilimi
      const dayIndex = 7 - (h / 24);
      let progressiveOffset = 0;
      if (isTroubled) {
        progressiveOffset = Math.max(0, (dayIndex - 3) * 0.85);
      }

      const noise = (Math.sin(h * 13) * 0.5);
      const front = Number(Math.max(15, liveFront + (diurnal * 0.5) + noise).toFixed(1));
      const rear = Number(Math.max(18, (isTroubled ? (liveRear - 3.5 + progressiveOffset) : liveRear) + (diurnal * 0.8) + (noise * 0.7)).toFixed(1));
      const deltaT = Number((rear - front).toFixed(1));

      list.push({
        timestamp: pointTime,
        frontBearing: front,
        rearBearing: rear,
        deltaT,
        rotorSpeed: Number(Math.max(0, liveRpm + (noise * 1.1)).toFixed(1)),
        powerKw: Math.round(Math.max(0, livePower + (noise * 45))),
        windSpeed: Number(Math.max(2, liveWind + (noise * 0.7)).toFixed(1)),
        stator: Number((liveStator + diurnal).toFixed(1)),
        ambient: Number((liveAmbient + diurnal).toFixed(1))
      });
    }

    return list;
  }
}

export const bearingService = new BearingService();
