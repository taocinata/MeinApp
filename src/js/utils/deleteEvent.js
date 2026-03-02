/**
 * deleteEvent.js — Smart event deletion.
 *
 * - oneTime event  → confirm → remove record
 * - recurring event + specific date → ask: "This day only" vs "All occurrences"
 * - recurring event + no date → ask: "Delete all occurrences?"
 */

import db from '../db/db.js';

/**
 * @param {object} ev       — full event object from db.events
 * @param {string} dateKey  — 'YYYY-MM-DD' of the tapped occurrence (optional)
 * @param {function} onDone — called after deletion (re-render callback)
 */
export async function deleteEvent(ev, dateKey, onDone) {
  if (ev.type === 'recurring' && dateKey) {
    showRecurringDialog(ev, dateKey, onDone);
  } else {
    if (confirm(`Delete "${ev.title}"?`)) {
      await db.events.remove(ev.id);
      onDone?.();
    }
  }
}

// ── Recurring dialog ──────────────────────────────────────

function showRecurringDialog(ev, dateKey, onDone) {
  // Remove any existing dialog
  document.getElementById('del-dialog-overlay')?.remove();

  const overlay = document.createElement('div');
  overlay.id    = 'del-dialog-overlay';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="padding-bottom:calc(1.5rem + env(safe-area-inset-bottom))">
      <div class="modal__handle"></div>
      <div class="modal__header">
        <div class="modal__title">Delete event</div>
        <button class="modal__close" id="del-dismiss" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <p style="font-size:14px;color:var(--color-muted);margin:0 0 1.25rem">
        <strong style="color:var(--color-text)">"${ev.title}"</strong> is a repeating event.<br>
        What would you like to delete?
      </p>

      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn--ghost" id="del-this" style="justify-content:flex-start;gap:12px;padding:14px 16px;text-align:left">
          <span style="font-size:1.3rem">📅</span>
          <span>
            <strong style="display:block">This day only</strong>
            <span style="font-size:12px;color:var(--color-muted)">Remove just ${fmtDate(dateKey)}</span>
          </span>
        </button>
        <button class="btn btn--ghost" id="del-all" style="justify-content:flex-start;gap:12px;padding:14px 16px;text-align:left;color:#DC2626;border-color:#FCA5A5">
          <span style="font-size:1.3rem">🗑️</span>
          <span>
            <strong style="display:block">All occurrences</strong>
            <span style="font-size:12px;color:var(--color-muted)">Permanently delete this repeating event</span>
          </span>
        </button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  const close = () => overlay.remove();

  overlay.querySelector('#del-dismiss').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#del-this').addEventListener('click', async () => {
    close();
    const updated = { ...ev, deletedDates: [...(ev.deletedDates || []), dateKey] };
    await db.events.save(updated);
    onDone?.();
  });

  overlay.querySelector('#del-all').addEventListener('click', async () => {
    close();
    await db.events.remove(ev.id);
    onDone?.();
  });
}

function fmtDate(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
  });
}
