/**
 * sw.js — Service Worker
 *
 * Strategy:
 *  - HTML + JS bundle: network-first (always get latest, fall back to cache)
 *  - CSS / icons / manifest: cache-first (stable assets)
 */

const CACHE_NAME = 'meinapp-ac8a2fd';

// Assets that are stable and safe to serve from cache
const CACHE_FIRST_PATTERNS = [/\.css$/, /\.svg$/, /\.png$/, /manifest\.json$/];

// ── Install: pre-cache stable assets only (NOT the JS bundle) ──
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll([
      './css/main.css',
      './manifest.json',
      './icons/icon-192.svg',
      './icons/icon-512.svg',
    ]))
  );
  self.skipWaiting(); // activate immediately without waiting
});

// ── Activate: wipe all old caches ───────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim(); // take control of all open tabs immediately
});

// ── Fetch ────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = event.request.url;
  const isCacheFirst = CACHE_FIRST_PATTERNS.some(p => p.test(url));

  if (isCacheFirst) {
    // Cache-first: serve from cache, update in background
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(response => {
          if (response.ok) {
            caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
          }
          return response;
        });
        return cached || fetchPromise;
      })
    );
  } else {
    // Network-first: always try network, fall back to cache (HTML, JS, version.json)
    event.respondWith(
      fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(event.request, response.clone()));
        }
        return response;
      }).catch(() => caches.match(event.request).then(c => c || caches.match('./index.html')))
    );
  }
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
