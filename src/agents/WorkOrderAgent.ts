import { BaseAgent } from './BaseAgent';
import { dataService } from '../services/DataService';
import { gorevService } from '../services/GorevService';
import { taskService } from '../services/TaskService';
import { notificationAgent } from './NotificationAgent';
import type { Gorev, AgentStatus } from '../types';

/**
 * WorkOrderAgent: Otonom iş emri yönetiminden sorumlu ajan.
 * 4 aşamalı bir state machine kullanarak iş emirlerini hatasız oluşturur.
 */
export class WorkOrderAgent extends BaseAgent {
  constructor() {
    super('agent_workorder_01', 'Work Order Agent', 'MaintenanceLogic');
  }

  /**
   * 4 Aşamalı İş Emri Sihirbazı (Autonomous Wizard)
   * Her adımda doğrulama yapar ve hata durumunda JSON çıktısı döner.
   */
  async createWorkOrderWizard(stepData: {
    serialNumber: string;
    type: 'Arıza' | 'Bakım';
    teamId: string; // 'Team 01' - 'Team 15'
    description: string;
    weatherStatus?: 'HOLD_WEATHER' | 'APPROVED';
    forceAssign?: boolean;
  }) {
    try {
      await this.setStatus('busy');
      console.log(`[WorkOrderAgent] İş emri süreci başlatıldı...`);

      // ADIM 1: Türbin Seri Numarası Doğrulama
      const turbine = dataService.findTurbineBySerial(stepData.serialNumber);
      if (!turbine) {
        throw { code: 404, message: 'Geçersiz türbin seri numarası!', detail: stepData.serialNumber };
      }
      console.log(`[Adım 1] Türbin doğrulandı: ${turbine.siteName} - ${turbine.turbineNo}`);

      // ADIM 2: Tür Seçimi ve Başlık Oluşturma
      const baslik = `${stepData.type}: ${turbine.siteName} ${turbine.turbineNo}`;
      console.log(`[Adım 2] İş türü seçildi: ${stepData.type}`);

      // ADIM 3: Ekip Atama ve Müsaitlik Kontrolü
      // İş kuralı: Team 01 - Team 15 arası kontrol.
      const teamNumber = parseInt(stepData.teamId.replace('Team ', ''));
      if (isNaN(teamNumber) || teamNumber < 1 || teamNumber > 15) {
        throw { code: 400, message: 'Geçersiz ekip formatı! (Team 01 - Team 15 olmalı)', detail: stepData.teamId };
      }

      const isAvailable = await gorevService.isTeamAvailable(stepData.teamId);
      if (!isAvailable && !stepData.forceAssign) {
        // Fallback: Admin'e haber ver ve hata dön
        await notificationAgent.sendAlert('Fatih Zebek', `${stepData.teamId} meşgulken atama yapılmaya çalışıldı.`);
        throw { code: 409, message: `Ekip (${stepData.teamId}) şu an başka bir görevde meşgul!`, team: stepData.teamId, requiresBypass: true };
      }
      console.log(`[Adım 3] Ekip ataması uygun veya bypass edildi: ${stepData.teamId}`);

      // ADIM 4: Onay ve Firestore Kaydı (Priority Alanı Yok!)
      const newGorev: Omit<Gorev, 'id' | 'createdAt' | 'updatedAt'> = {
        baslik: baslik,
        aciklama: stepData.description,
        turbinNo: turbine.turbineNo,
        atananEkip: stepData.teamId,
        durum: stepData.weatherStatus === 'HOLD_WEATHER' ? 'HOLD_WEATHER' : 'Açık',
        secilenSablon: stepData.type === 'Bakım' ? 'Bakım Formu' : 'form-ariza'
      };

      const taskId = await gorevService.saveGorev(newGorev);

      // Ayrıca ana 'tasks' koleksiyonuna da kaydedelim ki 'İş Emirleri' sayfasında görünsün!
      await taskService.createNewTask({
        secilenSablon: stepData.type === 'Bakım' ? 'Bakım Formu' : 'Türbin Arıza Formu',
        sahaBilgisi: turbine.siteName,
        siteId: turbine.siteId,
        turbinSeriNo: stepData.serialNumber,
        turbinNo: turbine.turbineNo,
        yoneticiNotu: stepData.description || `Sistemden atanan ${stepData.type} görevi.`,
        assignedTeam: stepData.teamId,
        customStatus: stepData.weatherStatus === 'HOLD_WEATHER' ? 'HOLD_WEATHER' : 'Görev Oluşturuldu'
      });

      console.log(`[Adım 4] İş emri başarıyla oluşturuldu. ID: ${taskId}`);

      await this.setStatus('online');
      
      return {
        success: true,
        taskId: taskId,
        data: newGorev,
        timestamp: Date.now()
      };

    } catch (error: any) {
      await this.setStatus('error');
      console.error(`[WorkOrderAgent] Hata:`, JSON.stringify(error));
      
      // Retry/Fallback: Hata durumunda admin bildirimi
      await notificationAgent.sendAlert('Fatih Zebek', `İş emri oluşturma hatası: ${error.message}`);
      
      return {
        success: false,
        error: error,
        timestamp: Date.now()
      };
    }
  }
}

export const workOrderAgent = new WorkOrderAgent();
workOrderAgent.start();
