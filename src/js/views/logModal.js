/**
 * logModal.js — Quick Log add/edit modal
 * Shared between app.js (FAB) and history.js (edit/delete actions).
 */

import { showToast } from './toast.js';
import db from '../db/db.js';

/**
 * Open the Quick Log modal.
 * @param {object|null} existing  — pass a log object to edit, null to create new
 * @param {function}    onSaved   — called after save (e.g. to re-render history)
 */
export function showQuickLogModal(existing = null, onSaved = null) {
  const isEdit = !!existing;

  const ts      = existing ? new Date(existing.timestamp) : new Date();
  const dateVal = ts.toISOString().slice(0, 10);
  const timeVal = ts.toTimeString().slice(0, 5);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__handle"></div>
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Edit Log' : 'Quick Log'}</div>
        <button class="modal__close" id="ql-cancel" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="form-group">
        <label>Category</label>
        <select class="select" id="ql-category">
          <option value="beauty"  ${existing?.category === 'beauty'  ? 'selected' : ''}>💄 Beauty</option>
          <option value="therapy" ${existing?.category === 'therapy' ? 'selected' : ''}>💊 Therapy</option>
          <option value="general" ${!existing || existing.category === 'general' ? 'selected' : ''}>📌 General</option>
        </select>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <div class="form-group">
          <label>Date</label>
          <input class="input" id="ql-date" type="date" value="${dateVal}" />
        </div>
        <div class="form-group">
          <label>Time</label>
          <input class="input" id="ql-time" type="time" value="${timeVal}" />
        </div>
      </div>

      <div class="form-group">
        <label>Notes</label>
        <textarea class="textarea" id="ql-notes" placeholder="What did you do?">${existing?.notes || ''}</textarea>
      </div>

      <div class="modal__actions">
        <button class="btn btn--primary" id="ql-save">${isEdit ? 'Save Changes' : 'Log it!'}</button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  overlay.querySelector('#ql-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  overlay.querySelector('#ql-save').addEventListener('click', async () => {
    const category  = overlay.querySelector('#ql-category').value;
    const notes     = overlay.querySelector('#ql-notes').value.trim();
    const dateStr   = overlay.querySelector('#ql-date').value;
    const timeStr   = overlay.querySelector('#ql-time').value || '00:00';
    const timestamp = new Date(`${dateStr}T${timeStr}`).getTime();

    await db.logs.save({
      id:          existing?.id || `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      category,
      subcategory: existing?.subcategory || null,
      timestamp,
      notes:       notes || `Quick log: ${category}`,
      metadata:    { source: 'quick_log', ...(existing?.metadata || {}) },
    });

    overlay.remove();
    showToast(isEdit ? 'Updated! ✏️' : 'Logged! 📝', 'success');
    onSaved?.();
  });
}
