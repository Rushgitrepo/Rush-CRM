// Rush CRM Service Worker - handles web push notifications

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'New message', body: event.data.text() };
  }

  const title = data.title || 'Rush CRM';
  const workgroupId = data.workgroup_id;
  const isDirectChat = data.is_direct_chat;
  const targetParam = isDirectChat ? `chat=${workgroupId}` : `team=${workgroupId}`;

  const options = {
    body: data.body || '',
    icon: '/crm.png',
    badge: '/crm.png',
    tag: `workgroup-${workgroupId || 'general'}`,
    renotify: true,
    data: {
      workgroup_id: workgroupId,
      is_direct_chat: isDirectChat,
      url: isDirectChat
        ? `/collaboration/direct-chats?chat=${workgroupId}`
        : `/collaboration/workgroups?team=${workgroupId}`,
    },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Suppress if user is already on that chat and the tab is visible
      const isOnChat = clientList.some(
        (client) => client.visibilityState === 'visible' && client.url.includes(targetParam)
      );
      if (isOnChat) return;
      return self.registration.showNotification(title, options);
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    })
  );
});
