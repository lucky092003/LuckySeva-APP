// Firebase Cloud Messaging service worker.
// FCM config is injected at runtime from localStorage (set by the app after a
// successful login) so no build-time config leaks into this static file and the
// worker stays safe to cache. Messages are surfaced as browser notifications.

importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

let initialized = false;

function readConfig() {
  try {
    const raw = localStorage.getItem('luckyseva.firebase');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  if (event.data) {
    let payload = {};
    try {
      payload = event.data.json();
    } catch {
      payload = { notification: { title: 'LuckySeva', body: event.data.text() } };
    }
    event.waitUntil(
      self.registration.showNotification(payload.notification?.title || 'LuckySeva', {
        body: payload.notification?.body || '',
        icon: '/logo.png',
        data: payload.data || {},
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) return existing.focus();
      return self.clients.openWindow('/');
    })
  );
});

self.addEventListener('message', (event) => {
  const config = readConfig();
  if (!config || initialized || !self.firebase?.apps?.length) {
    if (!config || initialized) return;
    self.firebase.initializeApp(config);
    initialized = true;
  }
  const payload = event.data;
  if (!payload) return;
  self.registration.showNotification(payload.title || 'LuckySeva', {
    body: payload.body || '',
    icon: '/logo.png',
    data: payload.data || {},
  });
});
