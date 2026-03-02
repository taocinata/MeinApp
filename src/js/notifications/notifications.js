/**
 * notifications.js — Web Notifications API wrapper
 *
 * Handles permission request, firing notifications,
 * and registering action handlers (Done / Snooze).
 */

let _permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (_permission === 'granted') return 'granted';
  _permission = await Notification.requestPermission();
  return _permission;
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted';
}

/**
 * Show a browser notification.
 * Falls back to Service Worker notification if SW is registered (for actions support).
 *
 * @param {{ id, title, body, category, icon? }} opts
 */
export async function notify({ id, title, body, category, icon }) {
  if (!canNotify()) return;

  const options = {
    body,
    icon: icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: id,
    renotify: true,
    data: { id, category },
    actions: [
      { action: 'done',  title: '✅ Done'  },
      { action: 'snooze',title: '⏰ Snooze 10 min' },
    ],
  };

  // Prefer SW notification (supports action buttons)
  if ('serviceWorker' in navigator) {
    const reg = await navigator.serviceWorker.ready;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, options);
      return;
    }
  }

  // Fallback: direct Notification (no action buttons on some browsers)
  new Notification(title, options);
}

/**
 * Listen for messages from the Service Worker
 * (e.g., "done" or "snooze" action was tapped).
 */
export function onNotificationAction(handler) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_ACTION') {
      handler(event.data);
    }
  });
}
