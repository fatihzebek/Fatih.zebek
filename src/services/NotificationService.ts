import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  timestamp: number;
  read: boolean;
  actionUrl?: string;
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

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('[NotificationService] Permission:', permission);
      if (permission === 'granted') {
        this.subscribeUserToPush();
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
        
        await setDoc(doc(db, 'push_subscriptions', subId), {
          endpoint: subJson.endpoint,
          keys: subJson.keys,
          user: currentUser?.email || currentUser?.username || 'Bilinmeyen Kullanıcı',
          role: currentUser?.role || 'user',
          updatedAt: Date.now()
        });
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
      new Notification(title, { body: message });
    }
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
