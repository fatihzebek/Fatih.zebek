import { db } from '../firebase';
import { doc, updateDoc, onSnapshot, collection, setDoc, deleteDoc } from 'firebase/firestore';

/**
 * PresenceService: Ekiplerin anlık online/offline durumlarını ve kalp atışlarını yönetir.
 * Çoklu cihaz girişini takip etmek için sessions alt koleksiyonu kullanılır.
 */
class PresenceService {
  private heartbeatInterval: any = null;
  private usersCollection = collection(db, 'users');
  private sessionId: string = Math.random().toString(36).substring(2, 15) + Date.now().toString(36);

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

      // Session bilgisini güncelle
      const sessionRef = doc(db, 'users', uid, 'sessions', this.sessionId);
      if (status === 'online') {
         await setDoc(sessionRef, {
           last_active: Date.now(),
           status: 'online',
           userAgent: navigator.userAgent
         }, { merge: true });
      } else {
         // Çıkış yapıldığında session'ı sil veya offline yap
         await deleteDoc(sessionRef).catch(() => {});
      }

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

    // Sayfa kapanırken session'ı temizlemeye çalış
    window.addEventListener('beforeunload', () => {
       const sessionRef = doc(db, 'users', uid, 'sessions', this.sessionId);
       // Kullanıcı sayfayı kapatırken offline işareti bırak (navigator.sendBeacon kullanılabilir ama deleteDoc daha basit)
       deleteDoc(sessionRef).catch(() => {});
    });

    this.heartbeatInterval = setInterval(async () => {
      await this.updateStatus(uid, 'online');
    }, 60000); // 1 dakika
    
    // İlk çalıştır
    this.updateStatus(uid, 'online');
    
    // Tab aktifleştiğinde hemen güncelleyerek background throttling'i telafi et
    if (!(window as any)._presenceVisibilityBound) {
       (window as any)._presenceVisibilityBound = true;
       document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
             this.updateStatus(uid, 'online');
          }
       });
    }

    console.log(`[Presence] Heartbeat başlatıldı (${uid}). Session: ${this.sessionId}`);
  }

  /**
   * Heartbeat döngüsünü durdurur.
   */
  stopHeartbeat(uid?: string) {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      console.log("[Presence] Heartbeat durduruldu.");
    }
    if (uid) {
       this.updateStatus(uid, 'offline');
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

  /**
   * Kullanıcının aktif session'larını dinlemek için.
   */
  subscribeToUserSessions(uid: string, callback: (sessions: any[]) => void) {
    const sessionsRef = collection(db, 'users', uid, 'sessions');
    return onSnapshot(sessionsRef, (snapshot) => {
       const now = Date.now();
       const sessions = snapshot.docs
         .map(doc => ({ id: doc.id, ...doc.data() as any }))
         .filter(s => (now - s.last_active) < 120000); // 2 dakikadan eski olanlar ölü kabul edilir
       callback(sessions);
    });
  }
}

export const presenceService = new PresenceService();
