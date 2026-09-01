import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc, getDoc } from 'firebase/firestore';
import { statusService } from './StatusService';
import { dataService } from './DataService';

export interface TaskCreateData {
  secilenSablon: string;
  sahaBilgisi: string;
  siteId: string;
  turbinSeriNo: string;
  turbinNo: string;
  statuKodu?: string;
  yoneticiNotu: string;
  assignedTeam: string;
  resolvedDeficiencyId?: string;
  maintenanceData?: {
    templateId: string;
    checklist: any[];
    materials: any[];
  }
}

export interface Task {
  id: string;
  siteId: string;
  realSiteId: string;
  turbineId: string;
  turbinSeriNo: string;
  personnel: string;
  faultCode: string;
  rawFaultCode: string;
  status: string;
  createdAt: any;
  secilenSablon: string;
  yoneticiNotu?: string;
  ohsData?: any;
  resolvedDeficiencyId?: string;
  maintenanceData?: {
    checklist: any[];
    materials: any[];
    workSessions?: any[];
    lastUpdated?: any;
  };
  createdBy?: string;
}

class TaskService {
  private collectionName = 'tasks';
  private tasksCache: Task[] | null = null;

  async createNewTask(data: TaskCreateData & { customStatus?: string, createdBy?: string }) {
    try {
      // 1. Akıllı Arıza Kodu Eşleştirme
      let statuAciklamasi = '';
      if (data.statuKodu) {
        const codeInfo = statusService.getCodeByKod(data.statuKodu);
        statuAciklamasi = codeInfo ? codeInfo.Aciklama : 'Tanımlanmamış Hata Kodu';
      }

      // 2. Data Architect'in şemasına göre objeyi oluştur
      const taskDoc = {
        taskInfo: {
          secilenSablon: data.secilenSablon,
          sahaBilgisi: data.sahaBilgisi,
          siteId: data.siteId,
          turbinSeriNo: data.turbinSeriNo,
          turbinNo: data.turbinNo
        },
        faultData: {
          statuKodu: data.statuKodu || '',
          statuAciklamasi: statuAciklamasi
        },
        assignment: {
          assignedTeam: data.assignedTeam,
          yoneticiNotu: data.yoneticiNotu,
          resolvedDeficiencyId: data.resolvedDeficiencyId || '',
          createdBy: (() => {
            if (data.createdBy) return data.createdBy;
            let email = '';
            try {
              const stored = localStorage.getItem('dh_auth_fallback');
              if (stored) email = JSON.parse(stored).user?.email || '';
            } catch (e) {}
            if (!email) email = auth?.currentUser?.email || (window as any).currentUser?.email || 'Admin';
            return email;
          })()
        },
        workflow: {
          durum: data.customStatus || 'Görev Oluşturuldu',
          olusturulmaTarihi: serverTimestamp(),
          guncellenmeTarihi: serverTimestamp(),
          tamamlanmaTarihi: null
        },
        formVerileri: {},
        metadata: {
          isDeleted: false,
          version: '1.0'
        },
        maintenanceData: data.maintenanceData || null
      };

      // 3. Firestore'a Kaydet
      const docRef = await addDoc(collection(db, this.collectionName), taskDoc);
      
      this.tasksCache = null; // Invalidate cache
      console.log("Görev başarıyla oluşturuldu, ID:", docRef.id);
      return { success: true, id: docRef.id };

    } catch (error) {
      console.error("Görev oluşturma hatası:", error);
      throw error;
    }
  }

  async getTasks(): Promise<Task[]> {
    if (this.tasksCache) {
      return this.tasksCache;
    }
    try {
      const q = query(collection(db, this.collectionName), orderBy('workflow.olusturulmaTarihi', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const tasks = querySnapshot.docs.map(doc => {
        const data = doc.data();
        const rawCode = data.faultData?.statuKodu || '';
        let desc = data.faultData?.statuAciklamasi || '';
        if (rawCode && rawCode !== '---' && (!desc || desc === 'Genel Görev' || desc === 'Tanımlanmamış Hata Kodu')) {
          const codeInfo = statusService.getCodeByKod(rawCode);
          if (codeInfo) desc = codeInfo.Aciklama;
        }
        if (!desc) desc = 'Genel Görev';

        return {
          id: doc.id,
          siteId: data.taskInfo?.sahaBilgisi || 'Bilinmiyor',
          realSiteId: data.taskInfo?.siteId || '',
          turbineId: data.taskInfo?.turbinNo || 'Bilinmiyor',
          turbinSeriNo: data.taskInfo?.turbinSeriNo || '',
          personnel: data.assignment?.assignedTeam || 'Atanmadı',
          faultCode: `${rawCode || '---'} - ${desc}`,
          rawFaultCode: rawCode,
          status: data.workflow?.durum || 'Aktif',
          createdAt: data.workflow?.olusturulmaTarihi,
          secilenSablon: data.taskInfo?.secilenSablon || '',
          yoneticiNotu: data.assignment?.yoneticiNotu || '',
          resolvedDeficiencyId: data.assignment?.resolvedDeficiencyId || '',
          ohsData: data.ohsData || null,
          maintenanceData: data.maintenanceData || null,
          createdBy: data.assignment?.createdBy || 'Admin'
        };
      }).sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      this.tasksCache = tasks;
      return tasks;
    } catch (error) {
      console.error("Görevleri getirme hatası:", error);
      return [];
    }
  }
  async updateTaskStatus(taskId: string, newStatus: string) {
    try {
      const taskRef = doc(db, this.collectionName, taskId);
      await updateDoc(taskRef, {
        'workflow.durum': newStatus,
        'workflow.guncellenmeTarihi': serverTimestamp()
      });
      this.tasksCache = null; // Invalidate cache
      return { success: true };
    } catch (error) {
      console.error("Görev durumu güncelleme hatası:", error);
      throw error;
    }
  }

  async updateTask(taskId: string, updates: any) {
    try {
      const taskRef = doc(db, this.collectionName, taskId);
      await updateDoc(taskRef, {
        ...updates,
        'workflow.guncellenmeTarihi': serverTimestamp()
      });
      this.tasksCache = null; // Invalidate cache
      return { success: true };
    } catch (error) {
      console.error("Görev güncelleme hatası:", error);
      throw error;
    }
  }

  subscribeTasks(callback: (tasks: Task[]) => void) {
    const q = query(collection(db, this.collectionName), orderBy('workflow.olusturulmaTarihi', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const tasks = snapshot.docs.map(doc => {
        const data = doc.data();
        const rawCode = data.faultData?.statuKodu || '';
        let desc = data.faultData?.statuAciklamasi || '';
        if (rawCode && rawCode !== '---' && (!desc || desc === 'Genel Görev' || desc === 'Tanımlanmamış Hata Kodu')) {
          const codeInfo = statusService.getCodeByKod(rawCode);
          if (codeInfo) desc = codeInfo.Aciklama;
        }
        if (!desc) desc = 'Genel Görev';

        return {
          id: doc.id,
          siteId: data.taskInfo?.sahaBilgisi || 'Bilinmiyor',
          realSiteId: data.taskInfo?.siteId || '',
          turbineId: data.taskInfo?.turbinNo || 'Bilinmiyor',
          turbinSeriNo: data.taskInfo?.turbinSeriNo || '',
          personnel: data.assignment?.assignedTeam || 'Atanmadı',
          faultCode: `${rawCode || '---'} - ${desc}`,
          rawFaultCode: rawCode,
          status: data.workflow?.durum || 'Aktif',
          createdAt: data.workflow?.olusturulmaTarihi,
          secilenSablon: data.taskInfo?.secilenSablon || '',
          yoneticiNotu: data.assignment?.yoneticiNotu || '',
          resolvedDeficiencyId: data.assignment?.resolvedDeficiencyId || '',
          ohsData: data.ohsData || null,
          maintenanceData: data.maintenanceData || null
        };
      }).sort((a, b) => {
        const dateA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const dateB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return dateB - dateA;
      });
      this.tasksCache = tasks; // Warm up cache
      callback(tasks);
    });
  }
  async updateMaintenanceData(taskId: string, checklist: any[]) {
    try {
      const cleanChecklist = JSON.parse(JSON.stringify(checklist));
      const taskRef = doc(db, this.collectionName, taskId);
      await updateDoc(taskRef, {
        'maintenanceData.checklist': cleanChecklist,
        'maintenanceData.lastUpdated': serverTimestamp(),
        'workflow.guncellenmeTarihi': serverTimestamp()
      });
      this.tasksCache = null; // Invalidate cache
      return { success: true };
    } catch (error) {
      console.error("Bakım verisi güncelleme hatası:", error);
      throw error;
    }
  }

  async deleteTask(taskId: string) {
    try {
      const taskRef = doc(db, this.collectionName, taskId);
      
      // Release reservations if any
      const taskSnap = await getDoc(taskRef);
      if (taskSnap.exists()) {
        const data = taskSnap.data();
        const siteId = data.taskInfo?.siteId;
        const team = data.assignment?.assignedTeam;
        const status = data.workflow?.durum;
        const materials = data.maintenanceData?.materials || [];
        
        if (status !== 'Tamamlandı' && siteId && team && materials.length > 0) {
          const { warehouseService } = await import('./WarehouseService');
          const cleanTeamId = `team_${team.replace(/\s+/g, '_')}`;
          
          for (const mat of materials) {
            if (mat.sapNo && mat.used > 0) {
              try {
                const whId = dataService.getWarehouseIdBySiteId(siteId) || siteId;
                await warehouseService.decreaseReservation(whId, String(mat.sapNo).trim(), Number(mat.used), cleanTeamId);
              } catch (resErr) {
                console.warn(`Failed to release reservation for deleted task item ${mat.sapNo}:`, resErr);
              }
            }
          }
        }
      }

      await deleteDoc(taskRef);
      this.tasksCache = null; // Invalidate cache
      return { success: true };
    } catch (error) {
      console.error("Görev silme hatası:", error);
      throw error;
    }
  }
}

export const taskService = new TaskService();

