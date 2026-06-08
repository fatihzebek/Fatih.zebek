import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, query, getDocs } from 'firebase/firestore';
import type { AgentRegistry, AgentStatus } from '../types';

/**
 * AgentHealthService: Sistemdeki tüm ajanların sağlığını izleyen merkezi servis.
 * Event-driven mimariyi destekler ve gerçek zamanlı güncellemeler sunar.
 */
class AgentHealthService {
  private registryCollection = collection(db, 'agent_registry');

  /**
   * Tüm ajanları gerçek zamanlı olarak dinler.
   */
  subscribeToAgents(callback: (agents: AgentRegistry[]) => void) {
    return onSnapshot(this.registryCollection, (snapshot) => {
      const agents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AgentRegistry));
      this.checkStaleAgents(agents); // Arka planda pasifleri kontrol et
      callback(agents);
    });
  }

  /**
   * 1 dakikadan uzun süre sinyal vermeyen ajanları OFFLINE'a çeker.
   */
  private async checkStaleAgents(agents: AgentRegistry[]) {
    const now = Date.now();
    const staleLimit = 60000; // 1 dakika

    for (const agent of agents) {
      if (agent.status !== 'offline' && (now - agent.lastSeen) > staleLimit) {
        console.warn(`[HealthService] Ajan yanıt vermiyor: ${agent.name}. Statü güncelleniyor...`);
        const agentRef = doc(db, 'agent_registry', agent.id);
        await updateDoc(agentRef, { status: 'offline' });
        
        // Admin'e bildirim gönderilmesi için bir event tetiklenebilir
        this.notifyAdminOfFailure(agent);
      }
    }
  }

  /**
   * Ajan yanıt süresini (latency) loglar.
   */
  async logResponseTime(agentId: string, startTime: number) {
    const latency = Date.now() - startTime;
    const agentRef = doc(db, 'agent_registry', agentId);
    await updateDoc(agentRef, { latency });
  }

  /**
   * Admin'e (Fatih Zebek) kritik hata bildirimi gönderir.
   */
  private notifyAdminOfFailure(agent: AgentRegistry) {
    console.error(`!!! KRİTİK UYARI !!! Ajan ${agent.name} çöktü veya sinyal kesildi. Admin: Fatih Zebek bilgilendiriliyor.`);
    // Burada NotificationAgent.sendAlert() çağrılacak.
  }
}

export const agentHealthService = new AgentHealthService();
