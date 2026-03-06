/**
 * settings.js — Settings view
 */

import { requestPermission, canNotify } from '../notifications/notifications.js';
import { showToast } from './toast.js';

export async function renderSettings(container) {
  const theme = document.documentElement.dataset.theme || 'light';

  let version = '—', buildTime = '';
  try {
    const v = await fetch('./version.json').then(r => r.json());
    version   = v.version || '—';
    buildTime = v.buildTime ? new Date(v.buildTime).toLocaleString() : '';
  } catch {}

  container.innerHTML = `
    <div class="settings">

      <div class="settings__section">
        <div class="settings__section-title">Appearance</div>
        <div class="settings__list">
          <div class="settings__row">
            <span class="settings__row-label">Dark Mode</span>
            <label class="toggle">
              <input type="checkbox" id="toggle-theme" ${theme === 'dark' ? 'checked' : ''} />
              <span class="toggle__track"></span>
            </label>
          </div>
        </div>
      </div>

      <div class="settings__section">
        <div class="settings__section-title">Notifications</div>
        <div class="settings__list">
          <div class="settings__row" id="notif-row">
            <span class="settings__row-label">Browser Notifications</span>
            <span class="settings__row-value" id="notif-status">
              ${canNotify() ? '✅ Enabled' : '🔕 Tap to enable'}
            </span>
          </div>
          ${canNotify() ? `
          <div class="settings__row" id="test-notif-row">
            <span class="settings__row-label">Test Notification</span>
            <span class="settings__row-value">▶ Send test</span>
          </div>` : ''}
        </div>
      </div>

      <div class="settings__section">
        <div class="settings__section-title">App Update</div>
        <div class="settings__list">
          <div class="settings__row" id="check-update-row">
            <span class="settings__row-label">Check for Updates</span>
            <span class="settings__row-value">🔄 Check</span>
          </div>
          <div class="settings__row" id="reload-row">
            <span class="settings__row-label">Reload App</span>
            <span class="settings__row-value">↺ Reload</span>
          </div>
        </div>
      </div>

      <div class="settings__section">
        <div class="settings__section-title">Data</div>
        <div class="settings__list">
          <div class="settings__row" id="export-row">
            <span class="settings__row-label">Export Data (JSON)</span>
            <span class="settings__row-value">↓ Export</span>
          </div>
          <div class="settings__row" id="import-row">
            <span class="settings__row-label">Import Data (JSON)</span>
            <span class="settings__row-value">↑ Import</span>
          </div>
        </div>
      </div>

      <div class="settings__section">
        <div class="settings__section-title">About</div>
        <div class="settings__list">
          <div class="settings__row">
            <span class="settings__row-label">Version</span>
            <span class="settings__row-value" style="font-family:monospace;font-size:12px">${version}</span>
          </div>
          ${buildTime ? `<div class="settings__row">
            <span class="settings__row-label">Built</span>
            <span class="settings__row-value" style="font-size:12px">${buildTime}</span>
          </div>` : ''}
        </div>
      </div>
    </div>

    <input type="file" id="import-file" accept=".json" style="display:none" />
  `;

  container.querySelector('#toggle-theme').addEventListener('change', (e) => {
    const next = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('meinapp_theme', next);
  });

  container.querySelector('#notif-row').addEventListener('click', async () => {
    const result = await requestPermission();
    container.querySelector('#notif-status').textContent =
      result === 'granted' ? '✅ Enabled' : '🔕 Denied — check browser & OS settings';
    if (result === 'granted') renderSettings(container);
  });

  container.querySelector('#test-notif-row')?.addEventListener('click', async () => {
    const { notify } = await import('../notifications/notifications.js');
    const sent = await notify({ id: 'test_notif', title: '🎉 MeinApp Notifications Work!', body: 'Event reminders are active.' });
    if (!sent) showToast('Blocked — check browser/OS notification settings', 'error', 5000);
  });

  container.querySelector('#check-update-row').addEventListener('click', async () => {
    if (!('serviceWorker' in navigator)) { showToast('Service Worker not supported', 'error'); return; }
    try {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
          showToast('Update found! Reloading…', 'success');
          setTimeout(() => location.reload(), 800);
        } else {
          showToast('Already up to date ✅', 'success');
        }
      } else {
        showToast('No Service Worker registered', 'info');
      }
    } catch (err) {
      showToast('Update check failed: ' + err.message, 'error');
    }
  });

  container.querySelector('#reload-row').addEventListener('click', async () => {
    showToast('Reloading…', 'info', 1500);
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) await reg.unregister();
    } catch {}
    setTimeout(() => location.reload(true), 400);
  });

  container.querySelector('#export-row').addEventListener('click', () => exportData());
  container.querySelector('#import-row').addEventListener('click', () => container.querySelector('#import-file').click());
  container.querySelector('#import-file').addEventListener('change', (e) => importData(e.target.files[0]));
}

async function exportData() {
  const { db } = await import('../db/db.js');
  const [routines, therapy, logs, reminders, events] = await Promise.all([
    db.routines.getAll(), db.therapy.getAll(), db.logs.getAll(),
    db.reminders.getAll(), db.events.getAll(),
  ]);
  const payload = { exportedAt: new Date().toISOString(), routines, therapy, logs, reminders, events };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `meinapp-backup-${Date.now()}.json`;
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(file) {
  if (!file) return;
  const text = await file.text();
  let data;
  try { data = JSON.parse(text); } catch { alert('Invalid JSON file.'); return; }
  const { db } = await import('../db/db.js');
  if (data.routines)  for (const r of data.routines)  await db.routines.save(r);
  if (data.therapy)   for (const r of data.therapy)   await db.therapy.save(r);
  if (data.logs)      for (const r of data.logs)       await db.logs.save(r);
  if (data.reminders) for (const r of data.reminders) await db.reminders.save(r);
  if (data.events)    for (const r of data.events)    await db.events.save(r);
  alert('Import complete! Refreshing…');
  location.reload();
}
