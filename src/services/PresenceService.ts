import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, collection } from 'firebase/firestore';

/**
 * PresenceService: Ekiplerin anlık online/offline durumlarını ve kalp atışlarını yönetir.
 * Clean Architecture prensiplerine uygun, merkezi bir varlık yönetim servisidir.
 */
class PresenceService {
  private heartbeatInterval: any = null;
  private usersCollection = collection(db, 'users');

  /**
   * Belirli bir kullanıcının durumunu günceller.
   */
  async updateStatus(uid: string, status: 'online' | 'offline') {
    if (!uid) return;

    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        status: status,
        last_active: Date.now()
      });
      console.log(`[Presence] ${uid} durumu güncellendi: ${status}`);
    } catch (error) {
      console.error(`[Presence] Durum güncelleme hatası:`, error);
    }
  }

  /**
   * Heartbeat Mekanizması: 60 saniyede bir last_active bilgisini günceller.
   */
  startHeartbeat(uid: string) {
    if (this.heartbeatInterval || !uid) return;

    this.heartbeatInterval = setInterval(async () => {
      await this.updateStatus(uid, 'online');
    }, 60000); // 1 dakika
    
    console.log(`[Presence] Heartbeat başlatıldı (${uid}).`);
  }

  /**
   * Heartbeat döngüsünü durdurur.
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("[Presence] Heartbeat durduruldu.");
    }
  }

  /**
   * Real-time Dinleyici: Tüm ekiplerin durumunu anlık izlemek için kullanılır.
   */
  subscribeToPresence(callback: (teams: any[]) => void) {
    return onSnapshot(this.usersCollection, (snapshot) => {
      const teams = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(teams);
    });
  }
}

export const presenceService = new PresenceService();
