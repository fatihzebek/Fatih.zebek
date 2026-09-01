self.addEventListener('push', (event) => {
  if (event.data) {
    try {
      const payload = event.data.json();
      self.registration.showNotification(payload.title || 'DH Servis', {
        body: payload.body || 'Yeni arıza bildirimi.',
        icon: '/icons/icon-192.png',
        badge: '/dh-favicon.svg',
        vibrate: [200, 100, 200],
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
        vibrate: [200, 100, 200]
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
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
