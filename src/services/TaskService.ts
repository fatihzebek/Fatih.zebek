import { db } from '../firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { statusService } from './StatusService';

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
  }
}

class TaskService {
  private collectionName = 'tasks';
  private tasksCache: Task[] | null = null;

  async createNewTask(data: TaskCreateData & { customStatus?: string }) {
    try {
      // 1. Akıllı Arıza Kodu Eşleştirme
      let statuAciklamasi = '';
      if (data.secilenSablon === 'Türbin Arıza Formu' && data.statuKodu) {
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
          createdBy: 'Admin' // İleride aktif kullanıcıdan alınacak
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
        return {
          id: doc.id,
          siteId: data.taskInfo?.sahaBilgisi || 'Bilinmiyor',
          realSiteId: data.taskInfo?.siteId || '',
          turbineId: data.taskInfo?.turbinNo || 'Bilinmiyor',
          turbinSeriNo: data.taskInfo?.turbinSeriNo || '',
          personnel: data.assignment?.assignedTeam || 'Atanmadı',
          faultCode: `${data.faultData?.statuKodu || '---'} - ${data.faultData?.statuAciklamasi || 'Genel Görev'}`,
          rawFaultCode: data.faultData?.statuKodu || '',
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
        return {
          id: doc.id,
          siteId: data.taskInfo?.sahaBilgisi || 'Bilinmiyor',
          realSiteId: data.taskInfo?.siteId || '',
          turbineId: data.taskInfo?.turbinNo || 'Bilinmiyor',
          turbinSeriNo: data.taskInfo?.turbinSeriNo || '',
          personnel: data.assignment?.assignedTeam || 'Atanmadı',
          faultCode: `${data.faultData?.statuKodu || '---'} - ${data.faultData?.statuAciklamasi || 'Genel Görev'}`,
          rawFaultCode: data.faultData?.statuKodu || '',
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

