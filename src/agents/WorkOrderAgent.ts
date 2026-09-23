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
    taskLocationType?: 'TURBINE' | 'WAREHOUSE';
    serialNumber?: string;
    warehouseId?: string;
    warehouseName?: string;
    siteId?: string;
    siteName?: string;
    type: string;
    teamId: string; // 'Team 01' - 'Team 15'
    description: string;
    weatherStatus?: 'HOLD_WEATHER' | 'APPROVED';
    forceAssign?: boolean;
    repairedMaterial?: {
      sapNo: string;
      description: string;
      quantity: number;
      serialNo?: string;
    };
  }) {
    try {
      await this.setStatus('busy');
      console.log(`[WorkOrderAgent] İş emri süreci başlatıldı...`);

      const isWarehouseTask = stepData.taskLocationType === 'WAREHOUSE';
      let turbine: any = null;
      let baslik = '';
      let targetTurbineNo = '';
      let targetSiteName = '';
      let targetSiteId = '';
      let targetSerial = '';

      if (isWarehouseTask) {
        targetSiteName = stepData.siteName || stepData.warehouseName || 'Santral Deposu';
        targetSiteId = stepData.siteId || stepData.warehouseId || '';
        targetTurbineNo = stepData.warehouseName || 'Depo / Tesis';
        targetSerial = 'DEPO';
        baslik = `📦 Depo & Tesis İşi: ${targetTurbineNo} - ${stepData.type}`;
        console.log(`[Adım 1] Depo görevi doğrulandı: ${targetTurbineNo}`);
      } else {
        // ADIM 1: Türbin Seri Numarası Doğrulama
        turbine = dataService.findTurbineBySerial(stepData.serialNumber || '');
        if (!turbine) {
          throw { code: 404, message: 'Geçersiz türbin seri numarası!', detail: stepData.serialNumber };
        }
        targetSiteName = turbine.siteName;
        targetSiteId = turbine.siteId;
        targetTurbineNo = turbine.turbineNo;
        targetSerial = stepData.serialNumber || '';
        baslik = `${stepData.type}: ${turbine.siteName} ${turbine.turbineNo}`;
        console.log(`[Adım 1] Türbin doğrulandı: ${turbine.siteName} - ${turbine.turbineNo}`);
      }

      console.log(`[Adım 2] İş türü seçildi: ${stepData.type}`);

      // ADIM 3: Ekip Atama ve Müsaitlik Kontrolü
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

      // ADIM 4: Onay ve Firestore Kaydı
      const isBakim = stepData.type === 'Bakım' || (stepData.type || '').toLowerCase().includes('bakim') || (stepData.type || '').toLowerCase().includes('bakım');
      
      const isPoolTask = stepData.teamId === 'HAVUZ' || stepData.teamId === 'Atanmadı';
      const assignedTeam = isPoolTask ? 'Atanmadı' : stepData.teamId;
      const initialStatus = isPoolTask ? 'Açık Görev' : (stepData.weatherStatus === 'HOLD_WEATHER' ? 'HOLD_WEATHER' : 'Görev Oluşturuldu');

      const newGorev: Omit<Gorev, 'id' | 'createdAt' | 'updatedAt'> = {
        baslik: baslik,
        aciklama: stepData.description,
        turbinNo: targetTurbineNo,
        atananEkip: isPoolTask ? 'HAVUZ' : stepData.teamId,
        durum: stepData.weatherStatus === 'HOLD_WEATHER' ? 'HOLD_WEATHER' : 'Açık',
        secilenSablon: isWarehouseTask ? `Depo İşi: ${stepData.type}` : (isBakim ? 'Bakım Formu' : 'form-ariza')
      };

      const taskId = await gorevService.saveGorev(newGorev);

      // Ayrıca ana 'tasks' koleksiyonuna da kaydedelim ki 'İş Emirleri' sayfasında görünsün!
      const currentYear = new Date().getFullYear();
      const generatedRevisionNo = isWarehouseTask ? `REV-${currentYear}-${Math.floor(1000 + Math.random() * 9000)}` : undefined;

      await taskService.createNewTask({
        secilenSablon: isWarehouseTask ? `Depo İşi: ${stepData.type}` : (isBakim ? 'Bakım Formu' : 'Türbin Arıza Formu'),
        sahaBilgisi: targetSiteName,
        siteId: targetSiteId,
        turbinSeriNo: targetSerial,
        turbinNo: targetTurbineNo,
        taskLocationType: isWarehouseTask ? 'WAREHOUSE' : 'TURBINE',
        warehouseId: stepData.warehouseId,
        warehouseName: stepData.warehouseName,
        tamirFormNo: generatedRevisionNo,
        revisionNo: generatedRevisionNo,
        repairedMaterial: stepData.repairedMaterial,
        yoneticiNotu: stepData.description || `Sistemden atanan ${stepData.type} görevi.`,
        assignedTeam: isPoolTask ? 'HAVUZ' : stepData.teamId,
        isPoolTask: isPoolTask,
        customStatus: initialStatus
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
