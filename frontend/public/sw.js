// Rush Management Service Worker

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let rawData;
  try {
    rawData = event.data.json();
  } catch (err) {
    rawData = { title: 'Rush Management', body: event.data.text() };
  }

  // Normalize FCM data-only or mixed payload
  // If rawData contains a nested data object, merge it to the top level.
  let data = rawData;
  if (rawData && rawData.data && typeof rawData.data === 'object') {
    data = {
      ...rawData.data,
      title: rawData.notification?.title || rawData.data.title || rawData.title,
      body: rawData.notification?.body || rawData.data.body || rawData.body,
    };
  } else if (rawData && rawData.notification) {
    data = {
      ...rawData,
      title: rawData.notification.title || rawData.title,
      body: rawData.notification.body || rawData.body,
    };
  }

  // Incoming calls are handled by the frontend via browser Notification API
  // (VideoCallContext.tsx) — skip here to avoid duplicate notifications
  if (data.type === 'incoming_call') return;

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

  // Sanitize workgroupId
  const cleanWgId = (workgroupId && workgroupId !== 'undefined') ? workgroupId : '';

  const options = {
    body,
    icon,
    badge: '/crm.png',
    tag: `workgroup-${cleanWgId || 'general'}`,
    renotify: true,
    data: {
      url: data.action_url && !data.action_url.includes('undefined')
        ? data.action_url
        : (isDirectChat && cleanWgId
          ? `/#/collaboration/direct-chats?chat=${cleanWgId}`
          : (data.is_broadcast || data.is_broadcast === 'true') && cleanWgId
            ? `/#/collaboration/broadcast?team=${cleanWgId}`
            : cleanWgId
              ? `/#/collaboration/workgroups?team=${cleanWgId}`
              : '/#/'),
    },
  };

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If ANY project tab is visible, suppress the push notification.
      // The in-app toast (via socket) will handle it in the visible tab.
      const isAnyTabVisible = clientList.some(
        c => c.visibilityState === 'visible'
      );
      if (isAnyTabVisible) return;
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
