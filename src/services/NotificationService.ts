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
    // Only request permission on first interaction or lazily
  }

  async requestPermission() {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      console.log('[NotificationService] Permission:', permission);
      return permission;
    }
    return 'denied';
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
