import { BaseAgent } from './BaseAgent';

/**
 * NotificationAgent: Sistem uyarılarını ve admin bildirimlerini yöneten ajan.
 */
export class NotificationAgent extends BaseAgent {
  constructor() {
    super('agent_notification_01', 'Notification Agent', 'AlertSystem');
  }

  /**
   * Admin'e acil durum uyarısı gönderir.
   */
  async sendAlert(adminName: string, message: string) {
    console.log(`[NotificationAgent] ${adminName} için uyarı gönderiliyor: ${message}`);
    
    // Gerçek bir sistemde burada SMS, E-posta veya Push Notification API'si çağrılır.
    // Şimdilik sistem konsoluna ve Firestore'a log atıyoruz.
    await this.setStatus('busy');
    
    // Simüle edilmiş gönderim gecikmesi
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await this.setStatus('online');
  }
}

export const notificationAgent = new NotificationAgent();
notificationAgent.start(); // Uygulama genelinde tekil olarak başlasın
