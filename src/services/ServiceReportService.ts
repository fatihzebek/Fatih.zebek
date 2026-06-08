import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { offlineSyncService } from './OfflineSyncService';

export interface WorkSession {
  id: string;
  date: string;
  personnel: string[];
  ohsData?: any;
  startTime: string;
  endTime: string;
  duration: string;
  isOffDay?: boolean;
  type?: string;
  comment?: string;
}

export interface ServiceReport {
  id?: string;
  type: string;
  reportNo: string;
  turbineSerial: string;
  date: string;
  faultCode: string;
  faultDesc: string;
  turbineNo: string;
  siteId: string;
  siteName: string;
  team: string;
  timeManagement: {
    arrival: string;
    notification: string;
    wecDowntime: string;
    maintenanceOn: string;
    maintenanceOff: string;
    interventionDuration: string;
  };
  workSessions?: WorkSession[];
  personnel: string[];
  ohsData?: any;
  voidedOvertimes?: string[];
  notes: string;
  matFormNo?: string;
  imageUrls: string[];
  materials: {
    poz: string;
    type: string;
    sapNo: string;
    serialNo: string;
    description: string;
    received: number;
    returned: number;
    used: number;
    defectCount: number;
  }[];
  checklist?: {
    id: string;
    text: string;
    status: string;
    comment: string;
  }[];
  auditMetrics?: {
    formOpenedTime: number;
    firstClickTime: number | null;
    lastClickTime: number | null;
    totalFillTimeSeconds: number;
    clickCount: number;
    averageClickIntervalMs: number;
    fastestClickIntervalMs: number;
    slowestClickIntervalMs: number;
    maxConsecutiveFastSameStatus: number;
    isSuspiciouslyFast: boolean;
    suspicionReason?: string;
  };
  createdAt: any;
  createdBy: string;
  templateName?: string;
  status?: 'completed' | 'returned';
  isDownloaded?: boolean;
}

class ServiceReportService {
  private collectionName = 'serviceReports';
  private reportsCache: ServiceReport[] | null = null;

  async saveReport(
    report: Omit<ServiceReport, 'createdAt' | 'imageUrls'> & { imageUrls?: string[] }, 
    files: File[],
    onProgress?: (msg: string) => void
  ) {
    if (!navigator.onLine) {
      onProgress?.('İnternet bağlantısı yok. Rapor çevrimdışı kuyruğuna alınıyor...');
      await offlineSyncService.saveReportToQueue(report, files);
      (window as any).showToast?.('BİLGİ', 'Çevrimdışı mod: Raporunuz kuyruğa alındı. İnternet bağlantısı sağlandığında otomatik olarak yüklenecektir.', 'info');
      return 'OFFLINE_QUEUED';
    }

    const imageUrls: string[] = report.imageUrls || [];

    // 1. Upload Images with Progress
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `reports/${report.reportNo}/${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, path);
        onProgress?.(`Görsel ${i + 1}/${files.length} yükleniyor...`);
        try {
          const snapshot = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          imageUrls.push(url);
        } catch (error: any) {
          console.error("Upload failed", error);
          throw new Error(`Görsel yüklenemedi: ${error.message}`);
        }
      }
    }

    // 2. Save Report
    onProgress?.("Sistem kaydı tamamlanıyor...");
    try {
      const safeReport = JSON.parse(JSON.stringify(report));
      const docRef = await addDoc(collection(db, this.collectionName), {
        ...safeReport,
        imageUrls,
        status: 'completed',
        createdAt: serverTimestamp()
      });
      this.reportsCache = null; // Invalidate cache
      return docRef.id;
    } catch (err) {
      console.error("Firestore save error:", err);
      throw new Error("Rapor kaydedilirken hata oluştu. Lütfen bağlantınızı kontrol edin.");
    }
  }

  async updateReport(
    id: string,
    report: Partial<ServiceReport>,
    files: File[],
    onProgress?: (msg: string) => void
  ) {
    const { updateDoc, doc } = await import('firebase/firestore');
    let imageUrls: string[] = report.imageUrls || [];

    // 1. Yeni görseller varsa yükle
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `reports/${report.reportNo || id}/${Date.now()}_${i}_${file.name}`;
        const storageRef = ref(storage, path);
        onProgress?.(`Yeni Görsel ${i + 1}/${files.length} yükleniyor...`);
        try {
          const snapshot = await uploadBytes(storageRef, file);
          const url = await getDownloadURL(snapshot.ref);
          imageUrls.push(url);
        } catch (error: any) {
          console.error("Upload failed", error);
          throw new Error(`Görsel yüklenemedi: ${error.message}`);
        }
      }
    }

    // 2. Güncelle
    onProgress?.("Rapor güncelleniyor...");
    try {
      const docRef = doc(db, this.collectionName, id);
      await updateDoc(docRef, {
        ...report,
        imageUrls,
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      this.reportsCache = null; // Invalidate cache
      return id;
    } catch (err) {
      console.error("Firestore update error:", err);
      throw new Error("Rapor güncellenirken hata oluştu.");
    }
  }

  async getReportsBySite(siteId: string): Promise<ServiceReport[]> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('siteId', '==', siteId)
      );
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      
      // Sort in-memory to avoid composite index requirement
      return reports.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
    } catch (error) {
      console.error("Error fetching reports:", error);
      return [];
    }
  }

  async getReportByNo(reportNo: string): Promise<ServiceReport | null> {
    try {
      const q = query(
        collection(db, this.collectionName),
        where('reportNo', '==', reportNo)
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any;
    } catch (error) {
      console.error("Error fetching report detail:", error);
      return null;
    }
  }
  async getAllReports(): Promise<ServiceReport[]> {
    if (this.reportsCache) {
      return this.reportsCache;
    }
    try {
      const q = query(collection(db, this.collectionName));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const sorted = reports.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      this.reportsCache = sorted;
      return sorted;
    } catch (error) {
      console.error("Error fetching all reports:", error);
      return [];
    }
  }

  subscribeReportsBySite(siteId: string, callback: (reports: ServiceReport[]) => void) {
    const q = query(
      collection(db, this.collectionName),
      where('siteId', '==', siteId)
    );

    return onSnapshot(q, (snapshot) => {
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      // Sort in-memory
      const sorted = reports.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeB - timeA;
      });
      callback(sorted);
    }, (error) => {
      console.error("Reports subscription error:", error);
    });
  }

  async sendReportBack(id: string, targetTeam?: string, reason?: string) {
    const { updateDoc, doc, getDoc } = await import('firebase/firestore');
    try {
      const docRef = doc(db, this.collectionName, id);
      const docSnap = await getDoc(docRef);
      const updateData: any = {
        status: 'returned',
        returnedAt: serverTimestamp()
      };
      
      if (docSnap.exists() && reason) {
        const currentData = docSnap.data();
        const existingNotes = currentData.notes || '';
        const now = new Date();
        const dateStr = now.toLocaleDateString('tr-TR') + ' ' + now.toLocaleTimeString('tr-TR', {hour: '2-digit', minute:'2-digit'});
        
        const returnNote = `[${dateStr} - YÖNETİCİ GERİ BİLDİRİMİ]\nEKİBE GERİ GÖNDERİLME NEDENİ: ${reason}\n\n`;
        updateData.notes = returnNote + existingNotes;
      }
      
      if (targetTeam) {
        updateData.team = targetTeam;
      }
      await updateDoc(docRef, updateData);
      this.reportsCache = null; // Invalidate cache
      return true;
    } catch (err) {
      console.error("Error sending report back:", err);
      throw err;
    }
  }

  async deleteReport(id: string) {
    const { deleteDoc, doc } = await import('firebase/firestore');
    try {
      const docRef = doc(db, this.collectionName, id);
      await deleteDoc(docRef);
      this.reportsCache = null; // Invalidate cache
      return true;
    } catch (err) {
      console.error("Error deleting report:", err);
      throw err;
    }
  }

  subscribeReturnedReports(callback: (reports: ServiceReport[]) => void) {
    const q = query(
      collection(db, this.collectionName),
      where('status', '==', 'returned')
    );
    
    // Bypass onSnapshot completely due to aggressive cache corruption issues
    getDocs(q).then((snapshot) => {
      const reports = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        } as ServiceReport))
        .filter(r => r.status === 'returned');
        
      const sorted = reports.sort((a, b) => {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateB - dateA;
      });
      callback(sorted);
    }).catch((error) => {
      console.error("subscribeReturnedReports error:", error);
      alert("İade edilen raporlar yüklenirken hata oluştu: " + error.message);
    });
    
    // Return a dummy unsubscribe function
    return () => {};
  }

  async markAsDownloaded(reportIds: string[]) {
    try {
      const promises = reportIds.map(id => {
        const docRef = doc(db, 'serviceReports', id);
        return updateDoc(docRef, { isDownloaded: true });
      });
      await Promise.all(promises);
    } catch (error) {
      console.error("Error marking reports as downloaded: ", error);
      throw error;
    }
  }
}

export const serviceReportService = new ServiceReportService();

