import { db } from '../src/firebase'; // Geçici olarak src/firebase'den referans alıyoruz
import { doc, setDoc, updateDoc } from 'firebase/firestore';

export type AgentStatus = 'online' | 'offline' | 'busy' | 'error';

export interface AgentRegistry {
  id: string;
  name: string;
  type: string;
  status: AgentStatus;
  lastSeen: number;
  startTime: number;
  metadata?: any;
}

/**
 * BaseAgent: Tüm otonom ajanların kök sınıfı.
 * Enterprise standartlarında hata yönetimi ve loglama içerir.
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

  async start() {
    try {
      this.status = 'online';
      const agentData: AgentRegistry = {
        id: this.id,
        name: this.name,
        type: this.type,
        status: this.status,
        lastSeen: Date.now(),
        startTime: Date.now()
      };

      await setDoc(doc(db, 'agent_registry', this.id), agentData);
      this.log('Agent başarıyla tescil edildi ve başlatıldı.');
      this.startHeartbeat();
    } catch (error) {
      this.handleCrash(error);
    }
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(async () => {
      try {
        await updateDoc(doc(db, 'agent_registry', this.id), {
          lastSeen: Date.now(),
          status: this.status
        });
      } catch (error) {
        this.log('Heartbeat gönderimi başarısız.', 'WARN');
      }
    }, 30000);
  }

  protected log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
    const logEntry = {
      timestamp: new Date().toISOString(),
      agentId: this.id,
      agentName: this.name,
      level,
      message
    };
    console.log(`[AGENT_LOG] ${JSON.stringify(logEntry)}`);
  }

  protected abstract handleCrash(error: any): void;

  stop() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.status = 'offline';
    this.log('Agent durduruldu.');
  }
}
