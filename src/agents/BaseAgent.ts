import { db } from '../firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { AgentStatus, AgentRegistry } from '../types';

/**
 * BaseAgent: Tüm ajanların (Work Order, Inventory, SCADA vb.) miras alacağı temel sınıf.
 * Clean Architecture prensiplerine uygun olarak, her ajan kendi yaşam döngüsünü yönetir.
 */
export abstract class BaseAgent {
  protected id: string;
  protected name: string;
  protected type: string;
  protected status: AgentStatus = 'offline';
  private heartbeatInterval: any = null;

  constructor(id: string, name: string, type: string) {
    this.id = id;
    this.name = name;
    this.type = type;
  }

  /**
   * Ajanı başlatır, veritabanına kaydeder ve heartbeat döngüsünü başlatır.
   */
  async start() {
    try {
      this.status = 'online';
      const agentData: AgentRegistry = {
        id: this.id,
        name: this.name,
        type: this.type,
        status: this.status,
        lastSeen: Date.now(),
        startTime: Date.now(),
        metadata: {
          version: '1.0.0',
          environment: import.meta.env.MODE
        }
      };

      // agent_registry koleksiyonuna kayıt
      await setDoc(doc(db, 'agent_registry', this.id), agentData);
      
      console.log(`[Agent: ${this.name}] Başlatıldı ve kaydedildi.`);
      
      this.startHeartbeat();
    } catch (error) {
      console.error(`[Agent: ${this.name}] Başlatma hatası:`, error);
      this.handleCrash(error);
    }
  }

  /**
   * Her 30 saniyede bir lastSeen bilgisini günceller.
   */
  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        const agentRef = doc(db, 'agent_registry', this.id);
        await updateDoc(agentRef, {
          lastSeen: Date.now(),
          status: this.status
        });
      } catch (error) {
        console.warn(`[Agent: ${this.name}] Heartbeat gönderilemedi:`, error);
      }
    }, 30000); // 30 saniye
  }

  /**
   * Ajanın durumunu günceller (Online, Busy vb.)
   */
  async setStatus(newStatus: AgentStatus) {
    this.status = newStatus;
    const agentRef = doc(db, 'agent_registry', this.id);
    await updateDoc(agentRef, { status: newStatus });
  }

  /**
   * Hata durumunda tetiklenir.
   */
  protected handleCrash(error: any) {
    this.status = 'error';
    console.error(`[Agent: ${this.name}] CRASH:`, error);
    // NotificationAgent tetikleme mantığı burada AgentHealthService üzerinden yönetilecek.
  }

  /**
   * Ajanı güvenli bir şekilde durdurur.
   */
  stop() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.status = 'offline';
    console.log(`[Agent: ${this.name}] Durduruldu.`);
  }
}
