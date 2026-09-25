self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const payload = event.data.json();
      self.registration.showNotification(payload.title || 'DH Servis', {
        body: payload.body || 'Yeni arıza bildirimi.',
        icon: '/icons/icon-192.png',
        badge: '/dh-favicon.svg',
        vibrate: [400, 200, 400, 200, 600],
        requireInteraction: true,
        tag: payload.tag || 'dh-scada-notification',
        data: {
          url: payload.url || '/'
        }
      });
    } catch (e) {
      console.error('Push parse error:', e);
      const text = event.data.text();
      self.registration.showNotification('DH Servis Arıza', {
        body: text,
        icon: '/icons/icon-192.png',
        badge: '/dh-favicon.svg',
        vibrate: [400, 200, 400, 200, 600],
        requireInteraction: true
      });
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url 
    ? new URL(event.notification.data.url, self.location.origin).href 
    : self.location.origin;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // 1. If an existing window/PWA is already open, focus it and navigate to the target turbine URL
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client && client.url !== urlToOpen) {
            return client.navigate(urlToOpen);
          }
          return;
        }
      }
      // 2. Otherwise open a new window with the direct deep link
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
