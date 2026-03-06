/**
 * notifications.js — Web Notifications API wrapper
 */

let _permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';

export async function requestPermission() {
  if (!('Notification' in window)) return 'unsupported';
  if (_permission === 'granted') return 'granted';
  try { _permission = await Notification.requestPermission(); } catch { _permission = 'denied'; }
  return _permission;
}

export function canNotify() {
  return ('Notification' in window) && Notification.permission === 'granted';
}

/**
 * Show a browser notification via Service Worker (preferred) or direct Notification API.
 * Logs to console on failure so DevTools shows what went wrong.
 */
export async function notify({ id, title, body, icon }) {
  if (!canNotify()) {
    console.warn('[notify] Permission not granted. status:', ('Notification' in window) ? Notification.permission : 'unsupported');
    return false;
  }

  const options = {
    body: body || '',
    icon: icon || '/icons/icon-192.svg',
    badge: '/icons/icon-192.svg',
    tag: id,
    renotify: true,
    data: { id },
  };

  // Try Service Worker notification first
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (reg?.showNotification) {
        await reg.showNotification(title, options);
        console.log('[notify] SW notification sent:', title);
        return true;
      }
    } catch (err) {
      console.warn('[notify] SW notification failed, falling back:', err);
    }
  }

  // Fallback: direct Notification API
  try {
    new Notification(title, options);
    console.log('[notify] Direct notification sent:', title);
    return true;
  } catch (err) {
    console.error('[notify] Direct notification failed:', err);
    return false;
  }
}

export function onNotificationAction(handler) {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NOTIFICATION_ACTION') handler(event.data);
  });
}
