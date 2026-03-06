/**
 * calendar.js — Full calendar view
 *
 * Monthly grid, colored event dots, tap day → events sheet + add modal.
 * Supports one-time and recurring events (daily / weekly / monthly).
 */

import db from '../db/db.js';
import { showToast } from './toast.js';
import { deleteEvent } from '../utils/deleteEvent.js';
import { rescheduleEvents } from '../scheduler/scheduler.js';

// ── State ─────────────────────────────────────────────────
let _year  = new Date().getFullYear();
let _month = new Date().getMonth(); // 0-based
let _selectedDay = null;
let _container = null;

// ── Category / color config ───────────────────────────────
export const EVENT_COLORS = [
  { label: 'Violet',      value: '#7C3AED' },
  { label: 'Pink',        value: '#EC4899' },
  { label: 'Red',         value: '#EF4444' },
  { label: 'Orange',      value: '#F97316' },
  { label: 'Amber',       value: '#F59E0B' },
  { label: 'Green',       value: '#10B981' },
  { label: 'Teal',        value: '#14B8A6' },
  { label: 'Cyan',        value: '#06B6D4' },
  { label: 'Blue',        value: '#3B82F6' },
  { label: 'Brown',       value: '#92400E' },
];

const DAY_NAMES  = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

// ── Main render ───────────────────────────────────────────
export async function renderCalendar(container) {
  _container = container;
  const events = await db.events.getAll();
  _renderGrid(container, events);
}

function _renderGrid(container, events) {
  const today     = new Date();
  const firstDay  = new Date(_year, _month, 1).getDay();   // weekday of 1st
  const daysInMonth = new Date(_year, _month + 1, 0).getDate();

  // Build a map: 'YYYY-MM-DD' → Event[]
  const eventMap = buildEventMap(events, _year, _month);

  container.innerHTML = `
    <div class="cal">

      <!-- Month navigation -->
      <div class="cal__header">
        <button class="btn btn--icon" id="cal-prev" aria-label="Previous month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <h2 class="cal__month-title">${MONTH_NAMES[_month]} ${_year}</h2>
        <button class="btn btn--icon" id="cal-next" aria-label="Next month">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>
      </div>

      <!-- Day-of-week headers -->
      <div class="cal__grid">
        ${DAY_NAMES.map(d => `<div class="cal__dow">${d}</div>`).join('')}

        <!-- Empty cells before first day -->
        ${Array.from({ length: firstDay }, () => '<div class="cal__cell cal__cell--empty"></div>').join('')}

        <!-- Day cells -->
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const day  = i + 1;
          const key  = isoDate(_year, _month, day);
          const dots = (eventMap[key] || []).slice(0, 4); // max 4 dots
          const isToday = today.getFullYear() === _year &&
                          today.getMonth()    === _month &&
                          today.getDate()     === day;
          const isSelected = _selectedDay === day;
          return `
            <div class="cal__cell${isToday ? ' cal__cell--today' : ''}${isSelected ? ' cal__cell--selected' : ''}"
                 data-day="${day}" role="button" tabindex="0" aria-label="${key}">
              <span class="cal__day-num">${day}</span>
              <div class="cal__dots">
                ${dots.map(e => `<span class="cal__dot" style="background:${e.color || '#7C3AED'}"></span>`).join('')}
              </div>
            </div>`;
        }).join('')}
      </div>

      <!-- Add event FAB inside view -->
      <button class="cal__fab btn btn--primary" id="cal-add-btn">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        Add Event
      </button>
    </div>
  `;

  // Month navigation
  container.querySelector('#cal-prev').addEventListener('click', () => {
    _month--; if (_month < 0) { _month = 11; _year--; }
    _selectedDay = null;
    renderCalendar(container);
  });
  container.querySelector('#cal-next').addEventListener('click', () => {
    _month++; if (_month > 11) { _month = 0; _year++; }
    _selectedDay = null;
    renderCalendar(container);
  });

  // Day tap
  container.querySelectorAll('.cal__cell[data-day]').forEach(cell => {
    cell.addEventListener('click', async () => {
      _selectedDay = parseInt(cell.dataset.day, 10);
      const key = isoDate(_year, _month, _selectedDay);
      const dayEvents = eventMap[key] || [];
      // Re-render grid to show selection, then open sheet
      const allEvents = await db.events.getAll();
      _renderGrid(container, allEvents);
      showDaySheet(key, _selectedDay, dayEvents, container);
    });
  });

  // Add button
  container.querySelector('#cal-add-btn').addEventListener('click', () => {
    const defaultDate = _selectedDay
      ? isoDate(_year, _month, _selectedDay)
      : isoDate(_year, _month, new Date().getDate());
    showAddEventModal({ defaultDate, onSaved: () => renderCalendar(container) });
  });
}

// ── Day sheet (bottom sheet) ──────────────────────────────
function showDaySheet(dateKey, day, events, container) {
  // Remove any existing sheet
  document.getElementById('cal-day-sheet')?.remove();

  const sheet = document.createElement('div');
  sheet.id = 'cal-day-sheet';
  sheet.className = 'cal__day-sheet';
  sheet.innerHTML = `
    <div class="cal__day-sheet-handle"></div>
    <div class="cal__day-sheet-header">
      <h3>${formatDisplayDate(dateKey)}</h3>
      <button class="btn btn--primary btn--sm" id="sheet-add-btn">+ Add</button>
    </div>
    <div class="cal__day-sheet-list" id="sheet-list">
      ${events.length
        ? events.map(e => eventRowHTML(e, dateKey)).join('')
        : '<p class="text-muted text-sm" style="padding:1rem 0">No events — tap + Add to create one.</p>'}
    </div>
  `;

  container.appendChild(sheet);

  sheet.querySelector('#sheet-add-btn').addEventListener('click', () => {
    showAddEventModal({ defaultDate: dateKey, onSaved: () => renderCalendar(container) });
  });

  // Edit buttons
  sheet.querySelectorAll('[data-edit-event]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ev = (await db.events.getAll()).find(x => x.id === btn.dataset.editEvent);
      if (ev) showAddEventModal({ existing: ev, onSaved: () => renderCalendar(container) });
    });
  });

  // Delete buttons
  sheet.querySelectorAll('[data-delete-event]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const ev = (await db.events.getAll()).find(x => x.id === btn.dataset.deleteEvent);
      if (!ev) return;
      await deleteEvent(ev, btn.dataset.dateKey, () => {
        showToast('Event deleted', 'info');
        renderCalendar(container);
      });
    });
  });
}

function eventRowHTML(event, dateKey) {
  const timeLabel = event.time ? `<span class="cal__event-time">${event.time}</span>` : '';
  const recurBadge = event.type === 'recurring'
    ? `<span class="badge badge--primary" style="font-size:10px">${recurLabel(event.recurrence)}</span>` : '';

  return `
    <div class="cal__event-row">
      <span class="cal__event-dot" style="background:${event.color || '#7C3AED'}"></span>
      <div class="cal__event-body">
        <div class="cal__event-title">${event.title}</div>
        <div class="cal__event-meta">${timeLabel} ${recurBadge}</div>
      </div>
      <button class="btn btn--icon" data-edit-event="${event.id}" aria-label="Edit" style="color:var(--color-muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:15px;height:15px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </button>
      <button class="btn btn--icon" data-delete-event="${event.id}" data-date-key="${dateKey}" aria-label="Delete" style="color:var(--color-muted)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" style="width:15px;height:15px"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>
      </button>
    </div>`;
}

// ── Add / Edit Event Modal ────────────────────────────────
export function showAddEventModal({ defaultDate, defaultCategory = 'general', existing = null, onSaved } = {}) {
  const isEdit  = !!existing;
  const today   = new Date().toISOString().slice(0, 10);
  const date0   = existing ? (existing.date || existing.startDate || today) : (defaultDate || today);
  const cat0    = existing?.category || defaultCategory;
  const isRecur = existing?.type === 'recurring';
  const interval0 = existing?.recurrence?.interval || 'daily';
  const existingDays = new Set(existing?.recurrence?.days || []);

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'add-event-overlay';

  overlay.innerHTML = `
    <div class="modal">
      <div class="modal__handle"></div>
      <div class="modal__header">
        <div class="modal__title">${isEdit ? 'Edit Event' : 'New Event'}</div>
        <button class="modal__close" id="ev-cancel" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div class="form-group">
        <label>Title</label>
        <input class="input" id="ev-title" placeholder="e.g. Morning skincare, Doctor appointment"
               value="${existing?.title || ''}" />
      </div>

      <div class="form-group">
        <label>Date</label>
        <input class="input" id="ev-date" type="date" value="${date0}" />
      </div>

      <div class="form-group">
        <label>Time <span class="text-muted text-xs">(optional)</span></label>
        <input class="input" id="ev-time" type="time" value="${existing?.time || ''}" />
      </div>

      <div class="form-group">
        <label>Color</label>
        <div class="cal__color-picker" id="ev-color-picker">
          ${EVENT_COLORS.map(c => `
            <button class="cal__color-swatch${(existing?.color || EVENT_COLORS[0].value) === c.value ? ' is-active' : ''}"
                    data-color="${c.value}"
                    style="background:${c.value}"
                    aria-label="${c.label}"></button>
          `).join('')}
        </div>
      </div>

      <div class="form-group">
        <label>Category</label>
        <select class="select" id="ev-category">
          <option value="general"  ${cat0 === 'general'  ? 'selected' : ''}>📌 General</option>
          <option value="beauty"   ${cat0 === 'beauty'   ? 'selected' : ''}>💄 Beauty</option>
          <option value="therapy"  ${cat0 === 'therapy'  ? 'selected' : ''}>💊 Health/Therapy</option>
          <option value="personal" ${cat0 === 'personal' ? 'selected' : ''}>🌟 Personal</option>
          <option value="children" ${cat0 === 'children' ? 'selected' : ''}>👨‍👩‍👧 Children/Family</option>
        </select>
      </div>

      <div class="form-group">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
          <label class="toggle">
            <input type="checkbox" id="ev-recurring" ${isRecur ? 'checked' : ''} />
            <span class="toggle__track"></span>
          </label>
          Repeating event
        </label>
      </div>

      <div id="ev-recur-options" style="${isRecur ? '' : 'display:none'}">
        <div class="form-group">
          <label>Repeat</label>
          <select class="select" id="ev-interval">
            <option value="daily"   ${interval0 === 'daily'   ? 'selected' : ''}>Daily</option>
            <option value="weekly"  ${interval0 === 'weekly'  ? 'selected' : ''}>Weekly</option>
            <option value="monthly" ${interval0 === 'monthly' ? 'selected' : ''}>Monthly</option>
          </select>
        </div>
        <div class="form-group" id="ev-days-group" style="${interval0 === 'weekly' && isRecur ? '' : 'display:none'}">
          <label>On days</label>
          <div class="cal__day-picker" id="ev-day-picker">
            ${['S','M','T','W','T','F','S'].map((d, i) => `
              <button class="cal__day-btn${existingDays.has(i) ? ' is-active' : ''}" data-dow="${i}">${d}</button>
            `).join('')}
          </div>
        </div>
        <div class="form-group">
          <label>End date <span class="text-muted text-xs">(optional)</span></label>
          <input class="input" id="ev-end-date" type="date" value="${existing?.endDate || ''}" />
        </div>
      </div>

      <div class="form-group">
        <label>Notes <span class="text-muted text-xs">(optional)</span></label>
        <textarea class="textarea" id="ev-notes">${existing?.notes || ''}</textarea>
      </div>

      <div class="modal__actions">
        <button class="btn btn--primary" id="ev-save">${isEdit ? 'Save Changes' : 'Save Event'}</button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  // Color picker — init from existing
  let selectedColor = existing?.color || EVENT_COLORS[0].value;
  overlay.querySelectorAll('.cal__color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      overlay.querySelectorAll('.cal__color-swatch').forEach(b => b.classList.remove('is-active'));
      btn.classList.add('is-active');
      selectedColor = btn.dataset.color;
    });
  });

  // Recurring toggle
  const recurCheck  = overlay.querySelector('#ev-recurring');
  const recurOpts   = overlay.querySelector('#ev-recur-options');
  const intervalSel = overlay.querySelector('#ev-interval');
  const daysGroup   = overlay.querySelector('#ev-days-group');

  recurCheck.addEventListener('change', () => {
    recurOpts.style.display = recurCheck.checked ? '' : 'none';
  });
  intervalSel.addEventListener('change', () => {
    daysGroup.style.display = intervalSel.value === 'weekly' ? '' : 'none';
  });

  // Day-of-week buttons — init from existing
  const selectedDOW = new Set(existingDays);
  overlay.querySelectorAll('.cal__day-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const d = parseInt(btn.dataset.dow, 10);
      if (selectedDOW.has(d)) { selectedDOW.delete(d); btn.classList.remove('is-active'); }
      else                    { selectedDOW.add(d);    btn.classList.add('is-active');    }
    });
  });

  // Close
  overlay.querySelector('#ev-cancel').addEventListener('click', () => overlay.remove());
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  // Save
  overlay.querySelector('#ev-save').addEventListener('click', async () => {
    const title = overlay.querySelector('#ev-title').value.trim();
    if (!title) { overlay.querySelector('#ev-title').focus(); return; }

    const date      = overlay.querySelector('#ev-date').value;
    const time      = overlay.querySelector('#ev-time').value || null;
    const category  = overlay.querySelector('#ev-category').value;
    const notes     = overlay.querySelector('#ev-notes').value.trim();
    const recurNow  = recurCheck.checked;
    const interval  = intervalSel.value;
    const endDate   = overlay.querySelector('#ev-end-date').value || null;

    const event = {
      id:             existing?.id || `event_${Date.now()}`,
      title,
      category,
      color:          selectedColor,
      type:           recurNow ? 'recurring' : 'oneTime',
      date:           recurNow ? null : date,
      startDate:      recurNow ? date : null,
      endDate,
      recurrence:     recurNow ? {
        interval,
        days:        interval === 'weekly' ? [...selectedDOW] : [],
        dayOfMonth:  interval === 'monthly' ? new Date(date).getDate() : null,
      } : null,
      time,
      notes:          notes || null,
      completedDates: existing?.completedDates || [],
      deletedDates:   existing?.deletedDates   || [],
    };

    await db.events.save(event);
    rescheduleEvents(); // reschedule push notifications for updated event list
    overlay.remove();
    showToast(isEdit ? `"${title}" updated! ✏️` : `"${title}" saved! 🎉`, 'success');
    onSaved?.();
  });
}

// ── Recurrence helpers ────────────────────────────────────

/**
 * Build a map of ISO date → events[] for the given year/month.
 * Expands recurring events into individual day entries.
 */
function buildEventMap(events, year, month) {
  const map = {};
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let d = 1; d <= daysInMonth; d++) {
    const key = isoDate(year, month, d);
    map[key] = [];
  }

  for (const event of events) {
    if (event.type === 'oneTime') {
      if (event.date && map[event.date] !== undefined) {
        if (!(event.deletedDates || []).includes(event.date)) {
          map[event.date].push(event);
        }
      }
    } else if (event.type === 'recurring') {
      for (let d = 1; d <= daysInMonth; d++) {
        const key  = isoDate(year, month, d);
        const date = new Date(year, month, d);

        if (event.startDate && key < event.startDate) continue;
        if (event.endDate   && key > event.endDate)   continue;
        if ((event.deletedDates || []).includes(key))  continue;

        if (occursOn(event, date)) {
          map[key].push(event);
        }
      }
    }
  }

  return map;
}

/** Does a recurring event occur on a given Date? */
function occursOn(event, date) {
  const { interval, days, dayOfMonth } = event.recurrence || {};
  if (interval === 'daily')   return true;
  if (interval === 'weekly')  return (days || []).includes(date.getDay());
  if (interval === 'monthly') return date.getDate() === dayOfMonth;
  return false;
}

// ── Utility ───────────────────────────────────────────────

export function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function formatDisplayDate(isoStr) {
  const [y, m, d] = isoStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric',
  });
}

function recurLabel(recurrence) {
  if (!recurrence) return '';
  const { interval, days } = recurrence;
  if (interval === 'daily')   return 'Daily';
  if (interval === 'monthly') return 'Monthly';
  if (interval === 'weekly') {
    const names = ['Su','Mo','Tu','We','Th','Fr','Sa'];
    return (days || []).map(d => names[d]).join(', ') || 'Weekly';
  }
  return interval;
}
