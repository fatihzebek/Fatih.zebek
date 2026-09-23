import { db } from '../firebase';
import { 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  getDocs, 
  deleteDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot 
} from 'firebase/firestore';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  actionUrl?: string;
}

export interface Announcement {
  id: string;
  title: string;
  message: string;
  category: 'celebration' | 'urgent' | 'info' | 'task' | 'test';
  targetAudience: 'ALL' | 'REGION' | 'TEAM' | 'SELF' | 'SITE';
  targetValue?: string;
  createdBy: string;
  createdByName?: string;
  createdAt: number;
  active: boolean;
}

class NotificationService {
  private notifications: AppNotification[] = [];
  private listeners: ((notifications: AppNotification[]) => void)[] = [];

  constructor() {
    // If permission is already granted, subscribe to push
    if ('Notification' in window && Notification.permission === 'granted') {
      setTimeout(() => {
        this.subscribeUserToPush();
      }, 3000);
    }
  }

  isPermissionGranted(): boolean {
    return 'Notification' in window && Notification.permission === 'granted';
  }

  isPushSupported(): boolean {
    return 'Notification' in window && 'serviceWorker' in navigator;
  }

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('[NotificationService] Permission:', permission);
      if (permission === 'granted') {
        this.subscribeUserToPush();
        this.playNotificationSound('celebration');
        this.notify('Bildirimler Aktif!', 'Saha görev ve duyuru bildirimleri başarıyla açıldı.', 'success');
      }
      return permission;
    }
    return 'denied';
  }

  async subscribeUserToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('[NotificationService] Push messaging is not supported in this browser.');
      return;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();
      
      const VAPID_PUBLIC_KEY = 'BBRUMqEX4JSbeW-4hrlYVPkR0kyAprwYoZMPIqQZkso8mhF7IlsENJfhv9VeNwReKqPzNsJyjFT2-rH_h79_f0U';
      const convertedVapidKey = this.urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: convertedVapidKey
        });
        console.log('[NotificationService] New push subscription created.');
      } else {
        console.log('[NotificationService] Existing push subscription found.');
      }

      const subJson = subscription.toJSON();
      const endpoint = subJson.endpoint || '';
      if (endpoint) {
        const subId = btoa(endpoint).replace(/=/g, '').substring(0, 50);
        const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
        const email = currentUser?.email || 'Bilinmeyen Kullanıcı';
        const team = (window as any).currentUserTeam || currentUser?.team || '';
        const allowedSites = currentUser?.allowedSites || [];
        
        await setDoc(doc(db, 'push_subscriptions', subId), {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user: email,
          displayName: currentUser?.displayName || currentUser?.name || '',
          team: team,
          allowedSites: allowedSites,
          role: currentUser?.role || 'user',
          updatedAt: Date.now()
        }, { merge: true });
        console.log('[NotificationService] Push subscription saved to Firestore.');
      }
    } catch (error) {
      console.error('[NotificationService] Error subscribing user to push:', error);
    }
  }

  private urlBase64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  addListener(callback: (notifications: AppNotification[]) => void) {
    this.listeners.push(callback);
    callback(this.notifications);
  }

  notify(title: string, message: string, type: AppNotification['type'] = 'info', actionUrl?: string) {
    const notification: AppNotification = {
      id: Math.random().toString(36).substr(2, 9),
      title,
      message,
      type,
      timestamp: Date.now(),
      read: false,
      actionUrl
    };

    this.notifications.unshift(notification);
    this.showToast(notification);
    this.triggerListeners();

    // System Push Notification
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, { 
          body: message,
          icon: '/dh_icon_192.png'
        });
      } catch (e) {
        // In mobile Safari / some Chrome variants, new Notification() in window may throw; fallback to ServiceWorkerRegistration.showNotification
        if (navigator.serviceWorker) {
          navigator.serviceWorker.ready.then(reg => {
            reg.showNotification(title, {
              body: message,
              icon: '/dh_icon_192.png'
            });
          }).catch(() => {});
        }
      }
    }
  }

  /**
   * Browser Audio Synthesizer for notifications (zero external file dependency)
   */
  /**
   * Browser Audio Synthesizer for notifications (zero external file dependency)
   */
  playNotificationSound(category: string = 'info') {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();

      if (category === 'urgent' || category === 'scada_fault') {
        // High-visibility, 2.2-second cyber-industrial alert tone sequence (impossible to miss in the field)
        const notes: { freq: number, time: number, dur: number, vol: number, type: OscillatorType }[] = [
          { freq: 523.25, time: 0.00, dur: 0.22, vol: 0.35, type: 'triangle' }, // C5
          { freq: 659.25, time: 0.20, dur: 0.22, vol: 0.40, type: 'triangle' }, // E5
          { freq: 783.99, time: 0.40, dur: 0.25, vol: 0.45, type: 'triangle' }, // G5
          { freq: 1046.50, time: 0.65, dur: 0.35, vol: 0.50, type: 'sine' },     // C6
          { freq: 880.00, time: 1.05, dur: 0.25, vol: 0.40, type: 'triangle' }, // A5
          { freq: 1046.50, time: 1.35, dur: 0.70, vol: 0.45, type: 'sine' }      // C6 long resonant chime
        ];

        notes.forEach(n => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = n.type;
          osc.frequency.value = n.freq;
          gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
          gain.gain.exponentialRampToValueAtTime(n.vol, ctx.currentTime + n.time + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + n.time);
          osc.stop(ctx.currentTime + n.time + n.dur + 0.05);
        });
      } else if (category === 'task' || category === 'celebration') {
        // Distinct 1.8-second task dispatch chime
        const notes: { freq: number, time: number, dur: number, vol: number, type: OscillatorType }[] = [
          { freq: 440.00, time: 0.00, dur: 0.20, vol: 0.30, type: 'triangle' }, // A4
          { freq: 554.37, time: 0.18, dur: 0.20, vol: 0.35, type: 'triangle' }, // C#5
          { freq: 659.25, time: 0.36, dur: 0.25, vol: 0.40, type: 'triangle' }, // E5
          { freq: 880.00, time: 0.60, dur: 0.60, vol: 0.45, type: 'sine' },     // A5
          { freq: 1108.73, time: 1.10, dur: 0.65, vol: 0.40, type: 'sine' }     // C#6
        ];
        notes.forEach(n => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = n.type;
          osc.frequency.value = n.freq;
          gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
          gain.gain.exponentialRampToValueAtTime(n.vol, ctx.currentTime + n.time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + n.time);
          osc.stop(ctx.currentTime + n.time + n.dur + 0.05);
        });
      } else {
        // Pleasant bell chime
        const notes = [
          { freq: 587.33, time: 0.00, dur: 0.35, vol: 0.30 }, // D5
          { freq: 880.00, time: 0.25, dur: 0.55, vol: 0.35 }  // A5
        ];
        notes.forEach(n => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.value = n.freq;
          gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
          gain.gain.exponentialRampToValueAtTime(n.vol, ctx.currentTime + n.time + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(ctx.currentTime + n.time);
          osc.stop(ctx.currentTime + n.time + n.dur + 0.05);
        });
      }
    } catch (e) {
      console.warn('Notification sound error:', e);
    }
  }

  /**
   * Check if current user is eligible to receive this announcement based on role/site/team
   */
  isUserEligibleForAnnouncement(a: Announcement): boolean {
    const currentUser = (window as any).currentUser || (window as any).appState?.userProfile;
    if (!currentUser) return true;

    const email = (currentUser.email || '').toLowerCase().trim();
    const role = (currentUser.role || '').toUpperCase().trim();

    // 1. Admins, Fatih ZEBEK, and Furkan YILDIRIM receive ALL notifications across all sites
    if (
      role === 'ADMIN' ||
      email === 'fatih.zebek@demirerholding.com' ||
      email.includes('fatih.zebek') ||
      email === 'furkan.yildirim@demirerholding.com' ||
      email.includes('furkan.yildirim')
    ) {
      return true;
    }

    // 2. Global announcements (ALL audience with no specific target)
    if (a.targetAudience === 'ALL' && (!a.targetValue || a.targetValue === 'all')) {
      return true;
    }

    // 3. Site-specific filtering
    const siteId = a.targetValue;
    if (!siteId) return true;

    // Check allowedSites
    const allowedSites = currentUser.allowedSites || [];
    if (allowedSites.includes(siteId) || allowedSites.includes('all')) {
      return true;
    }

    // Check team mapping
    const rawTeam = (currentUser.team || currentUser.displayName || email || '').replace(/\s+/g, '').toLowerCase();
    const teamMapping: Record<string, string[]> = {
      'team01': ['2678', '0752'],
      'team1': ['2678', '0752'],
      'team02': ['2678', '0752'],
      'team2': ['2678', '0752'],
      'team12': ['2678', '0752'],
      'team03': ['2688', '3439', '3243'],
      'team3': ['2688', '3439', '3243'],
      'team04': ['2688', '3439', '3243'],
      'team4': ['2688', '3439', '3243'],
      'team13': ['2688', '3439', '3243'],
      'team15': ['2688', '3439', '3243'],
      'team06': ['2990', '3793'],
      'team6': ['2990', '3793'],
      'team08': ['2990', '3793'],
      'team8': ['2990', '3793'],
      'team09': ['2990', '3793'],
      'team9': ['2990', '3793'],
      'team14': ['2990', '3793'],
      'team05': ['3213'],
      'team5': ['3213'],
      'team10': ['3213'],
      'team07': ['3245', '3892'],
      'team7': ['3245', '3892'],
      'team11': ['3245', '3892']
    };

    const teamSites = teamMapping[rawTeam] || [];
    return teamSites.includes(siteId);
  }

  /**
   * Admin Announcement Creation
   */
  async createAnnouncement(data: {
    title: string;
    message: string;
    category: Announcement['category'];
    targetAudience: Announcement['targetAudience'];
    targetValue?: string;
    createdBy: string;
    createdByName?: string;
  }): Promise<string> {
    const announcementData = {
      title: data.title,
      message: data.message,
      category: data.category,
      targetAudience: data.targetAudience,
      targetValue: data.targetValue || '',
      createdBy: data.createdBy,
      createdByName: data.createdByName || '',
      createdAt: Date.now(),
      active: true
    };

    const docRef = await addDoc(collection(db, 'announcements'), announcementData);
    
    // Play local audio chime and show in-app notification
    this.playNotificationSound(data.category);
    this.notify(data.title, data.message, data.category === 'urgent' ? 'warning' : 'success');

    return docRef.id;
  }

  /**
   * Get recent active announcements
   */
  async getAnnouncements(): Promise<Announcement[]> {
    try {
      const q = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const list: Announcement[] = [];
      snapshot.forEach(docSnap => {
        const item = { id: docSnap.id, ...docSnap.data() } as Announcement;
        if (this.isUserEligibleForAnnouncement(item)) {
          list.push(item);
        }
      });
      return list;
    } catch (err) {
      console.error('Duyurular getirilemedi:', err);
      return [];
    }
  }

  /**
   * Subscribe to real-time announcements
   */
  subscribeAnnouncements(callback: (announcements: Announcement[]) => void) {
    try {
      const q = query(
        collection(db, 'announcements'),
        orderBy('createdAt', 'desc'),
        limit(15)
      );
      let isFirstSnapshot = true;
      return onSnapshot(q, (snapshot) => {
        const list: Announcement[] = [];
        snapshot.forEach(docSnap => {
          const item = { id: docSnap.id, ...docSnap.data() } as Announcement;
          if (this.isUserEligibleForAnnouncement(item)) {
            list.push(item);
          }
        });

        // If not initial load, detect new announcements and play alert
        if (!isFirstSnapshot) {
          snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
              const item = { id: change.doc.id, ...change.doc.data() } as Announcement;
              if (this.isUserEligibleForAnnouncement(item) && Date.now() - item.createdAt < 60000) {
                this.playNotificationSound(item.category);
                this.notify(item.title, item.message, item.category === 'urgent' ? 'warning' : 'success');
              }
            }
          });
        }
        isFirstSnapshot = false;
        callback(list);
      }, (err) => {
        console.warn('subscribeAnnouncements hatası:', err);
        callback([]);
      });
    } catch (err) {
      console.warn('Duyuru dinleyici hatası:', err);
      return () => {};
    }
  }

  /**
   * Delete an announcement
   */
  async deleteAnnouncement(id: string): Promise<void> {
    await deleteDoc(doc(db, 'announcements', id));
  }

  private triggerListeners() {
    this.listeners.forEach(cb => cb([...this.notifications]));
  }

  private showToast(n: AppNotification) {
    const container = document.getElementById('toast-container') || this.createToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `premium-toast toast-${n.type}`;
    toast.innerHTML = `
      <div class="toast-content">
        <div class="toast-icon">
          <i class="fa-solid ${this.getIcon(n.type)}"></i>
        </div>
        <div class="toast-body">
          <div class="toast-title">${n.title}</div>
          <div class="toast-message">${n.message}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      </div>
      <div class="toast-progress"></div>
    `;

    container.appendChild(toast);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100px)';
      setTimeout(() => toast.remove(), 500);
    }, 5000);
  }

  private getIcon(type: string) {
    switch(type) {
      case 'success': return 'fa-circle-check';
      case 'error': return 'fa-circle-exclamation';
      case 'warning': return 'fa-triangle-exclamation';
      default: return 'fa-circle-info';
    }
  }

  private createToastContainer() {
    const container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      top: 2rem;
      right: 2rem;
      z-index: 99999;
      display: flex;
      flex-direction: column;
      gap: 1rem;
      pointer-events: none;
    `;
    document.body.appendChild(container);
    return container;
  }
}

export const notificationService = new NotificationService();
