/**
 * sw.js — Service Worker
 *
 * Strategy: Cache-first for static assets, network-first for API.
 * Handles: notification actions (Done / Snooze), background sync.
 */

const CACHE_NAME = 'meinapp-c8f1262';
const STATIC_URLS = [
  './',
  './index.html',
  './css/main.css',
  './manifest.json',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
  './js/bundle.min.js',
];

// ── Install: pre-cache static assets ────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_URLS))
  );
  self.skipWaiting();
});

// ── Activate: clean old caches ───────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: cache-first for static, network for rest ─────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Cache successful responses for static assets
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('./index.html')); // offline fallback
    })
  );
});

// ── Skip waiting — activate new SW immediately on message ───
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── Notification: action buttons ────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const { action } = event;
  const { id: reminderId } = event.notification.data || {};

  if (action === 'done' || action === 'snooze') {
    // Relay action to the open app window
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
        const msg = { type: 'NOTIFICATION_ACTION', action, reminderId };
        if (clients.length) {
          clients[0].postMessage(msg);
          clients[0].focus();
        } else {
          // App not open — open it
          return self.clients.openWindow('/').then(client => client?.postMessage(msg));
        }
      })
    );
    return;
  }

  // Default tap — open app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      if (clients.length) return clients[0].focus();
      return self.clients.openWindow('/');
    })
  );
});

// ── Push (future) ────────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'MeinApp', {
      body:    data.body || '',
      icon:    '/icons/icon-192.svg',
      badge:   '/icons/icon-192.svg',
      data:    data,
      actions: [
        { action: 'done',   title: '✅ Done' },
        { action: 'snooze', title: '⏰ Snooze 10 min' },
      ],
    })
  );
});
