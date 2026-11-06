// Shows Azai staff alerts (food ready, bills, walkouts) when the phone is locked or the page is closed.
self.addEventListener('push', (event) => {
  let message = { title: 'Azai', body: '' };
  try {
    message = event.data ? event.data.json() : message;
  } catch {
    message.body = event.data ? event.data.text() : '';
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.event || 'azai',
      renotify: true,
      requireInteraction: true,
      icon: '/favicon.ico',
    })
  );
});

// Tapping the alert opens (or focuses) the staff screen
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const staff = windows.find((w) => w.url.includes('/admin'));
      if (staff) return staff.focus();
      return self.clients.openWindow(self.registration.scope);
    })
  );
});
