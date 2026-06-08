import { BaseAgent } from './BaseAgent';
import { db } from '../src/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * WorkOrderAgent: İş emirlerini otonom olarak yöneten ve kural setlerini dayatan ajan.
 */
export class WorkOrderAgent extends BaseAgent {
  constructor() {
    super('work_order_agent', 'Enterprise Work Order Manager', 'ORCHESTRATOR');
  }

  /**
   * createWorkOrder: Yeni bir iş emri oluşturur.
   * @param data İş emri verisi (Gorev arayüzüne uygun olmalı)
   */
  async createWorkOrder(data: any) {
    try {
      this.log('İş emri oluşturma talebi alındı. Doğrulama katmanı (Validation) başlatılıyor...');

      // KURAL 1: Priority (Öncelik) Alanı Kontrolü
      if (data.priority !== undefined) {
        this.log('KRİTİK İHLAL: Sistemde "priority" alanı kullanımı yasaktır!', 'ERROR');
        throw new Error('SYSTEM_VIOLATION: Priority field is strictly forbidden in Enterprise CMMS.');
      }

      // KURAL 2: Ekip Kısıtlaması (Team 01 - Team 15)
      const teamRegex = /^Team (0[1-9]|1[0-5])$/;
      if (!data.atanenEkip || !teamRegex.test(data.atanenEkip)) {
        this.log(`GEÇERSİZ EKİP: ${data.atanenEkip} ataması reddedildi. Sadece Team 01-15 kabul edilir.`, 'WARN');
        return {
          status: 'error',
          error_code: 'INVALID_TEAM',
          message: 'Assignment failed: Team must be between Team 01 and Team 15.'
        };
      }

      // Kurallar geçildiyse kaydet
      this.log(`Doğrulama başarılı. ${data.atanenEkip} için iş emri oluşturuluyor...`);
      
      const workOrder = {
        ...data,
        status: 'open',
        created_at: serverTimestamp(),
        updated_at: serverTimestamp(),
        agent_id: this.id
      };

      const docRef = await addDoc(collection(db, 'Gorevler'), workOrder);
      this.log(`İş emri başarıyla oluşturuldu. ID: ${docRef.id}`);

      return {
        status: 'success',
        id: docRef.id,
        message: 'Work order created successfully.'
      };

    } catch (error: any) {
      this.log(`HATA: ${error.message}`, 'ERROR');
      return {
        status: 'error',
        error_code: 'PROCESS_ERROR',
        message: error.message
      };
    }
  }

  protected handleCrash(error: any) {
    this.log(`AJAN CRASHED: ${error.message}`, 'ERROR');
    this.status = 'error';
    // NotificationAgent'a uyarı gönderilecek...
  }
}

export const workOrderAgent = new WorkOrderAgent();
