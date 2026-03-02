/**
 * routines.js — Routines view, reads from unified events store.
 * Categories: beauty, therapy, general, personal.
 */

import db from '../db/db.js';
import { showToast } from './toast.js';
import { showAddEventModal } from './calendar.js';
import { deleteEvent } from '../utils/deleteEvent.js';

const TABS = [
  { key: 'beauty',   label: '💄 Beauty'          },
  { key: 'therapy',  label: '💊 Health/Therapy'  },
  { key: 'general',  label: '📌 General'          },
  { key: 'personal', label: '🌟 Personal'         },
  { key: 'children', label: '👨‍👩‍👧 Children/Family' },
];

let _activeTab = 'beauty';

export async function renderRoutines(container) {
  const events = await db.events.getAll();
  const today  = new Date().toISOString().slice(0, 10);

  container.innerHTML = `
    <div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
        <h2 style="margin:0">Routines</h2>
        <button class="btn btn--primary btn--sm" id="add-routine-btn">+ Add</button>
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:1.25rem">
        ${TABS.map(t => `
          <button class="chip${_activeTab === t.key ? ' is-active' : ''}" data-tab="${t.key}">${t.label}</button>`).join('')}
      </div>

      <div id="routines-body">
        ${renderEventList(events, _activeTab, today)}
      </div>
    </div>
  `;

  // Tab switching
  container.querySelectorAll('[data-tab]').forEach(chip => {
    chip.addEventListener('click', () => {
      _activeTab = chip.dataset.tab;
      container.querySelectorAll('[data-tab]').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      container.querySelector('#routines-body').innerHTML =
        renderEventList(events, _activeTab, today);
      bindActions(container);
    });
  });

  // Add button
  container.querySelector('#add-routine-btn').addEventListener('click', () => {
    showAddEventModal({
      defaultCategory: _activeTab,
      onSaved: () => renderRoutines(container),
    });
  });

  bindActions(container);
}

function bindActions(container) {
  container.querySelectorAll('[data-edit-event]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ev = (await db.events.getAll()).find(x => x.id === btn.dataset.editEvent);
      if (ev) showAddEventModal({ existing: ev, onSaved: () => renderRoutines(container) });
    });
  });

  container.querySelectorAll('[data-delete-event]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ev = (await db.events.getAll()).find(x => x.id === btn.dataset.deleteEvent);
      if (!ev) return;
      // No specific dateKey in routines view — recurring = asks "delete all"
      await deleteEvent(ev, null, () => {
        showToast('Deleted', 'info');
        renderRoutines(container);
      });
    });
  });
}

// ── Event list renderer ───────────────────────────────────

function renderEventList(events, category, today) {
  const items = events.filter(e => e.category === category);
  if (!items.length) {
    return `<div class="dashboard__empty">
      <div style="font-size:2rem">🌱</div>
      <p>No ${category} events yet.<br>Tap <strong>+ Add</strong> to create one!</p>
    </div>`;
  }

  // Split: upcoming (future/recurring) vs past one-time
  const upcoming = items.filter(e => e.type === 'recurring' || (e.date && e.date >= today));
  const past     = items.filter(e => e.type === 'oneTime' && e.date && e.date < today);

  let html = '';

  if (upcoming.length) {
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;
                          color:var(--color-muted);letter-spacing:.06em;
                          margin-bottom:8px">Upcoming</div>`;
    html += upcoming.map(e => eventCardHTML(e, today)).join('');
  }

  if (past.length) {
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;
                          color:var(--color-muted);letter-spacing:.06em;
                          margin:16px 0 8px">Past</div>`;
    html += past.map(e => eventCardHTML(e, today)).join('');
  }

  return html;
}

function eventCardHTML(ev, today) {
  const isPast      = ev.type === 'oneTime' && ev.date && ev.date < today;
  const typeLabel   = ev.type === 'recurring' ? `🔁 ${recurrenceLabel(ev)}` : `📅 ${fmtDate(ev.date)}`;
  const timeStr     = ev.time ? ` · ⏰ ${ev.time}` : '';
  const colorDot    = ev.color
    ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                    background:${ev.color};flex-shrink:0;margin-top:3px"></span>` : '';

  return `
    <div class="card" style="margin-bottom:10px;opacity:${isPast ? 0.6 : 1}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        ${colorDot}
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:15px">${ev.title}</div>
          <div style="font-size:12px;color:var(--color-muted);margin-top:2px">
            ${typeLabel}${timeStr}
          </div>
          ${ev.notes ? `<div style="font-size:12px;color:var(--color-muted);margin-top:4px">${ev.notes.slice(0,60)}</div>` : ''}
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0">
          <button class="btn btn--icon" data-edit-event="${ev.id}" aria-label="Edit"
                  style="color:var(--color-muted)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" style="width:15px;height:15px">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn btn--icon" data-delete-event="${ev.id}" aria-label="Delete"
                  style="color:var(--color-muted)">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" style="width:15px;height:15px">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
              <path d="M10 11v6M14 11v6"/>
            </svg>
          </button>
        </div>
      </div>
    </div>`;
}

// ── Helpers ───────────────────────────────────────────────

function recurrenceLabel(ev) {
  const r = ev.recurrence;
  if (!r) return 'Recurring';
  if (r.interval === 'daily')   return 'Every day';
  if (r.interval === 'monthly') return 'Every month';
  if (r.interval === 'weekly') {
    const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return (r.days?.length ? r.days.map(d => days[d]).join(', ') : 'Weekly');
  }
  return 'Recurring';
}

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
