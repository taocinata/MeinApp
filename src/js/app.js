/**
 * app.js — Application entry point
 *
 * Bootstraps: theme, SW registration, routing, scheduler.
 */

import { startScheduler } from './scheduler/scheduler.js';
import { requestPermission, onNotificationAction } from './notifications/notifications.js';
import { renderDashboard } from './views/dashboard.js';
import { renderHistory   } from './views/history.js';
import { renderSettings  } from './views/settings.js';
import { renderRoutines  } from './views/routines.js';
import { renderCalendar  } from './views/calendar.js';
import { showToast       } from './views/toast.js';
import { showAddEventModal } from './views/calendar.js';
import db from './db/db.js';

// ── Theme init ────────────────────────────────────────────
const savedTheme = localStorage.getItem('meinapp_theme') || 'light';
document.documentElement.dataset.theme = savedTheme;

// ── View Router ───────────────────────────────────────────
const views = {
  dashboard: renderDashboard,
  routines:  renderRoutines,
  calendar:  renderCalendar,
  history:   renderHistory,
  settings:  renderSettings,
};

let _activeView = 'dashboard';
const container = document.getElementById('view-container');

async function navigate(viewName) {
  if (!views[viewName]) return;
  _activeView = viewName;

  document.querySelectorAll('.app-nav__item').forEach(item => {
    item.classList.toggle('is-active', item.dataset.view === viewName);
  });

  container.innerHTML = '<div style="padding:2rem;text-align:center;color:var(--color-muted)">Loading…</div>';
  try {
    await views[viewName](container);
  } catch (err) {
    console.error(`[navigate] ${viewName} failed:`, err);
    container.innerHTML = `<div style="padding:2rem;text-align:center;color:#DC2626">
      ⚠️ Something went wrong loading <strong>${viewName}</strong>.<br>
      <small style="color:var(--color-muted)">${err.message}</small>
    </div>`;
  }
}

// Nav clicks
document.getElementById('app-nav').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-view]');
  if (btn) navigate(btn.dataset.view);
});

// FAB — quick log
document.getElementById('fab-quick-log')?.addEventListener('click', () => {
  showAddEventModal({ onSaved: () => navigate(_activeView) });
});

// ── Service Worker ────────────────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').then(reg => {
    console.log('[SW] Registered:', reg.scope);
  }).catch(err => {
    console.warn('[SW] Registration failed:', err);
  });
}

// ── Notification actions from SW ──────────────────────────
onNotificationAction(async ({ action, reminderId }) => {
  if (action === 'done') {
    if (reminderId) {
      const rem = await db.reminders.get(reminderId);
      if (rem) { rem.status = 'done_once'; await db.reminders.save(rem); }
    }
    showToast('Marked as done! ✅', 'success');
    navigate(_activeView);
  }
  if (action === 'snooze') {
    if (reminderId) {
      const rem = await db.reminders.get(reminderId);
      if (rem) {
        rem.nextTrigger = Date.now() + 10 * 60 * 1000;
        await db.reminders.save(rem);
      }
    }
    showToast('Snoozed for 10 minutes ⏰', 'info');
  }
});

// ── Boot ──────────────────────────────────────────────────
(async function boot() {
  await navigate('dashboard');
  document.querySelector('[data-view="dashboard"]')?.classList.add('is-active');
  startScheduler();

  // Show notification bell in header — clicking it requests permission
  const headerActions = document.getElementById('header-actions');
  if (headerActions) {
    const bell = document.createElement('button');
    bell.id = 'notif-bell';
    bell.style.cssText = 'background:none;border:none;cursor:pointer;font-size:1.3rem;padding:4px 8px;position:relative';
    bell.title = 'Notification status';
    const updateBell = () => {
      const granted = Notification.permission === 'granted';
      bell.textContent = granted ? '🔔' : '🔕';
      bell.title = granted ? 'Notifications enabled' : 'Tap to enable notifications';
    };
    updateBell();
    bell.addEventListener('click', async () => {
      const result = await requestPermission();
      updateBell();
      if (result === 'granted') {
        showToast('Notifications enabled! 🎉', 'success');
        const { rescheduleEvents } = await import('./scheduler/scheduler.js');
        rescheduleEvents();
      } else if (result === 'denied') {
        showToast('Blocked — please enable in browser/OS settings 🔕', 'error', 5000);
      }
    });
    headerActions.appendChild(bell);
  }
})();
