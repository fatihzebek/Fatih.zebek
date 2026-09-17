import { db, storage } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, where, onSnapshot, updateDoc, doc, getDoc } from 'firebase/firestore';
import { ref, uploadBytes, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { offlineSyncService } from './OfflineSyncService';
import { emailService } from './EmailService';

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
  overtimeApprovals?: any;
  notes: string;
  matFormNo?: string;
  taskLocationType?: 'TURBINE' | 'WAREHOUSE';
  tamirFormNo?: string;
  revisionNo?: string;
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
    const sessionPersonnel = (report.workSessions || []).flatMap((ws: any) => ws.personnel || []);
    const validPersonnel = Array.from(new Set([...(report.personnel || []), ...sessionPersonnel]))
      .filter((p: any) => p && typeof p === 'string' && p.trim() !== '' && p !== '-- Personel Yok --');
    if (validPersonnel.length === 0) {
      throw new Error("Rapor kaydedilemedi: En az bir personel ismi belirtilmelidir.");
    }

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

      // Otomatik E-Posta ve PDF Gönderimi
      try {
        const fullReportForEmail: ServiceReport = {
          id: docRef.id,
          ...safeReport,
          imageUrls
        };
        await emailService.sendReportEmail(fullReportForEmail);
      } catch (emailErr) {
        console.warn("[Email] E-posta gönderim uyarısı (rapor kaydedildi):", emailErr);
      }

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
    onProgress?: (msg: string) => void,
    sendEmail: boolean = false
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
      let targetDocId = id;
      if (!targetDocId && report.reportNo) {
        const found = await this.getReportByNo(report.reportNo);
        if (found?.id) targetDocId = found.id;
      }

      if (!targetDocId) {
        throw new Error("Bu rapor arşivden silindiği için güncellenemez.");
      }

      const docRef = doc(db, this.collectionName, targetDocId);
      const snap = await getDoc(docRef);
      if (!snap.exists()) {
        throw new Error("Bu rapor arşivden silindiği için güncellenemez.");
      }

      // Strip all undefined properties to prevent Firestore invalid data error
      const cleanReport: any = JSON.parse(JSON.stringify(report));
      delete cleanReport.id;
      delete cleanReport._id;

      await updateDoc(docRef, {
        ...cleanReport,
        imageUrls,
        status: 'completed',
        updatedAt: serverTimestamp()
      });
      this.reportsCache = null; // Invalidate cache

      // Automatic email/pdf notification refresh (only if explicitly requested)
      if (sendEmail) {
        try {
          const fullReportForEmail: ServiceReport = {
            id: targetDocId,
            ...cleanReport,
            imageUrls
          };
          await emailService.sendReportEmail(fullReportForEmail);
        } catch (emailErr) {
          console.warn("[Email] E-posta güncelleme uyarısı:", emailErr);
        }
      }

      return targetDocId;
    } catch (err: any) {
      console.error("Firestore update error:", err);
      throw new Error(err.message || "Rapor güncellenirken hata oluştu.");
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
  private lastFetchTime: number = 0;
  private CACHE_DURATION = 600000; // 10 minutes (fast instant loading)

  async getAllReports(forceRefresh: boolean = false): Promise<ServiceReport[]> {
    const now = Date.now();
    if (!forceRefresh && this.reportsCache && (now - this.lastFetchTime < this.CACHE_DURATION)) {
      return this.reportsCache;
    }
    try {
      const q = query(collection(db, this.collectionName));
      const snapshot = await getDocs(q);
      const reports = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as any));
      const sorted = reports.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
      this.reportsCache = sorted;
      this.lastFetchTime = now;
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

  async deleteReport(id: string, operatorEmail?: string) {
    const { deleteDoc, doc, getDoc } = await import('firebase/firestore');
    const { warehouseService } = await import('./WarehouseService');
    const { dataService } = await import('./DataService');
    try {
      const docRef = doc(db, this.collectionName, id);
      const snap = await getDoc(docRef);
      let reportData: ServiceReport | null = null;

      if (snap.exists()) {
        reportData = snap.data() as ServiceReport;

        // Automated Stock Rollback for Materials
        if (reportData.materials && reportData.materials.length > 0) {
          // Resolve canonical team warehouse ID (e.g. "team_Team_09")
          let teamWhId = '';
          if (reportData.team) {
            const cleanTeam = reportData.team.trim();
            const numMatch = cleanTeam.match(/(\d+)/);
            if (numMatch) {
              teamWhId = `team_Team_${numMatch[1].padStart(2, '0')}`;
            } else {
              teamWhId = `team_${cleanTeam.replace(/\s+/g, '_')}`;
            }
          }

          const siteWarehouseId = dataService.getWarehouseIdBySiteId(reportData.siteId || '') || reportData.siteId;
          const userEmail = operatorEmail || (window as any).currentUser?.email || reportData.createdBy || 'Sistem';

          for (const mat of reportData.materials) {
            const sapNo = String(mat.sapNo || '').trim();
            if (!sapNo) continue;

            const typeUpper = mat.type?.toUpperCase();
            const isTakilan = !mat.type || typeUpper === 'T';

            // 1. Rollback installed parts (Takılan Parça) back to team warehouse
            if (mat.used > 0 && isTakilan && teamWhId) {
              try {
                await warehouseService.updateStockBySap(teamWhId, sapNo, mat.used, {
                  user: userEmail,
                  reason: `Silinen Rapor (${reportData.reportNo}) İptali / Otomatik Stok İadesi`,
                  reportNo: reportData.reportNo,
                  materialName: mat.description,
                  turbineNo: reportData.turbineNo,
                  turbineSerial: reportData.turbineSerial,
                  formNo: reportData.matFormNo
                }, 'NEW', undefined, mat.serialNo);
              } catch (e) {
                console.error(`[ServiceReportService] Error rolling back installed material ${sapNo}:`, e);
              }
            }

            // 2. Rollback removed defect parts (Sökülen Parça) from site and team warehouse
            if (mat.defectCount > 0) {
              if (siteWarehouseId) {
                try {
                  await warehouseService.updateStockBySap(siteWarehouseId, sapNo, -mat.defectCount, {
                    user: userEmail,
                    reason: `Silinen Rapor (${reportData.reportNo}) İptali / Arızalı Parça Kaydı İptali`,
                    reportNo: reportData.reportNo,
                    materialName: mat.description
                  }, 'DEFECT', undefined, mat.serialNo);
                } catch (e) {
                  console.error(`[ServiceReportService] Error rolling back defect material from site ${sapNo}:`, e);
                }
              }

              if (teamWhId) {
                try {
                  await warehouseService.updateStockBySap(teamWhId, sapNo, -mat.defectCount, {
                    user: userEmail,
                    reason: `Silinen Rapor (${reportData.reportNo}) İptali / Arızalı Parça Kaydı İptali`,
                    reportNo: reportData.reportNo,
                    materialName: mat.description
                  }, 'DEFECT', undefined, mat.serialNo);
                } catch (e) {
                  console.error(`[ServiceReportService] Error rolling back defect material from team ${sapNo}:`, e);
                }
              }
            }
          }
        }
      }

      await deleteDoc(docRef);
      this.reportsCache = null; // Invalidate cache

      // Also clean up any lingering task or notification in tasks collection if related
      try {
        if (reportData && (reportData as any).reportNo) {
          const repNo = (reportData as any).reportNo;
          const { taskService } = await import('./TaskService');
          const allTasks = await taskService.getTasks();
          const relatedTask = allTasks.find((t: any) => (t as any).originalReportNo === repNo || (t as any).reportNo === repNo || t.id === id);
          if (relatedTask?.id) {
            await taskService.deleteTask(relatedTask.id);
          }
        }
      } catch (taskCleanErr) {
        console.warn("Task cleanup warning on report delete:", taskCleanErr);
      }

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

