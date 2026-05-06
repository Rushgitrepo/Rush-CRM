// Rush Management Service Worker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try { data = event.data.json(); }
  catch { data = { title: 'Rush Management', body: event.data.text() }; }

  const workgroupId = data.workgroup_id;
  const isDirectChat = data.is_direct_chat;
  const targetParam = isDirectChat ? `chat=${workgroupId}` : `team=${workgroupId}`;

  // Title
  const title = data.title || data.author_name || 'Rush Management';

  // Parse body — handle call log JSON
  let body = data.body || '';
  try {
    const parsed = JSON.parse(body);
    if (parsed && parsed.type && parsed.status) {
      const isVideo = parsed.type === 'video';
      const isMissed = parsed.status === 'missed' || parsed.status === 'rejected';
      if (isMissed) {
        body = isVideo ? '📵 Missed video call' : '📵 Missed voice call';
      } else if (parsed.status === 'completed') {
        const dur = parsed.duration || 0;
        const m = Math.floor(dur / 60);
        const s = dur % 60;
        const durStr = dur > 0 ? ` (${m}:${String(s).padStart(2, '0')})` : '';
        body = isVideo ? `📹 Video call${durStr}` : `📞 Voice call${durStr}`;
      }
    }
  } catch (_) { /* not JSON */ }

  // Group message: prefix body with sender name
  if (!isDirectChat && data.author_name && !body.startsWith('📵') && !body.startsWith('📹') && !body.startsWith('📞')) {
    body = `${data.author_name}: ${body}`;
  }

  // Icon: avatar of sender (direct) or group/channel (group/broadcast)
  // Backend sends absolute URLs — fallback handles relative paths
  let icon = '/crm.png';
  const avatarField = isDirectChat
    ? data.author_avatar
    : (data.workgroup_avatar || data.author_avatar);

  if (avatarField) {
    if (avatarField.startsWith('http')) {
      icon = avatarField;
    } else {
      // Relative path fallback — replace frontend port with backend port
      const backendOrigin = self.location.origin
        .replace(':8080', ':4000')
        .replace(':5173', ':4000')
        .replace(':3000', ':4000');
      icon = backendOrigin + (avatarField.startsWith('/') ? avatarField : '/' + avatarField);
    }
  }

  // Unread count
  const unread = data.unread_count || 0;
  if (unread > 1) {
    body = `${body}\n${unread} unread messages`;
  }

  const options = {
    body,
    icon,
    badge: '/crm.png',
    tag: `workgroup-${workgroupId || 'general'}`,
    renotify: true,
    data: {
      url: isDirectChat
        ? `/collaboration/direct-chats?chat=${workgroupId}`
        : `/collaboration/workgroups?team=${workgroupId}`,
    },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      const isOnChat = clientList.some(
        c => c.visibilityState === 'visible' && c.url.includes(targetParam)
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
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
