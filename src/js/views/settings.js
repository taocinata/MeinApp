/**
 * settings.js — Settings view
 */

import { requestPermission, canNotify } from '../notifications/notifications.js';

export async function renderSettings(container) {
  const theme = document.documentElement.dataset.theme || 'light';

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
              ${canNotify() ? '✅ Enabled' : '🔕 Disabled'}
            </span>
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
            <span class="settings__row-value">0.1.0</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Hidden import file input -->
    <input type="file" id="import-file" accept=".json" style="display:none" />
  `;

  // Theme toggle
  container.querySelector('#toggle-theme').addEventListener('change', (e) => {
    const next = e.target.checked ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('meinapp_theme', next);
  });

  // Notification permission
  container.querySelector('#notif-row').addEventListener('click', async () => {
    const result = await requestPermission();
    container.querySelector('#notif-status').textContent =
      result === 'granted' ? '✅ Enabled' : '🔕 Denied';
  });

  // Export
  container.querySelector('#export-row').addEventListener('click', () => exportData());

  // Import
  container.querySelector('#import-row').addEventListener('click', () => {
    container.querySelector('#import-file').click();
  });
  container.querySelector('#import-file').addEventListener('change', (e) => {
    importData(e.target.files[0]);
  });
}

async function exportData() {
  const [routines, therapy, logs, reminders] = await Promise.all([
    import('../db/db.js').then(m => m.db.routines.getAll()),
    import('../db/db.js').then(m => m.db.therapy.getAll()),
    import('../db/db.js').then(m => m.db.logs.getAll()),
    import('../db/db.js').then(m => m.db.reminders.getAll()),
  ]);

  const payload = { exportedAt: new Date().toISOString(), routines, therapy, logs, reminders };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `meinapp-backup-${Date.now()}.json`,
  });
  a.click();
  URL.revokeObjectURL(url);
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

  alert('Import complete! Refreshing…');
  location.reload();
}
