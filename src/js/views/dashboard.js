/**
 * dashboard.js — Dashboard view
 *
 * Shows today's routines, upcoming events (calendar/list toggle),
 * and upcoming reminders.
 */

import db from '../db/db.js';
import { showToast } from './toast.js';
import { isoDate } from './calendar.js';

let _eventsView = localStorage.getItem('dash_events_view') || 'list';

export async function renderDashboard(container) {
  const [routines, reminders, events] = await Promise.all([
    db.routines.getAll(),
    db.reminders.getAll(),
    db.events.getAll(),
  ]);

  const today  = new Date();
  const dayIdx = today.getDay();

  const todayRoutines = routines.filter(r => {
    const days = r.schedule?.days;
    if (!days) return true;
    return days.includes(dayIdx);
  });

  const soon = Date.now() + 2 * 3600 * 1000;
  const upcomingReminders = reminders
    .filter(r => r.status !== 'disabled' && r.nextTrigger && r.nextTrigger <= soon)
    .sort((a, b) => a.nextTrigger - b.nextTrigger);

  container.innerHTML = `
    <div class="dashboard">
      <div class="dashboard__greeting">
        <h2>${getGreeting()} 👋</h2>
        <p>${formatDate(today)}</p>
      </div>

      <section class="dashboard__section">
        <div class="dashboard__section-header">
          <h3>Today's Routines</h3>
          <button class="btn btn--sm btn--ghost" data-nav="routines">See all</button>
        </div>
        <div class="dashboard__list">
          ${todayRoutines.length
            ? todayRoutines.map(routineItemHTML).join('')
            : emptyState('No routines scheduled for today.', '🌸')}
        </div>
      </section>

      <section class="dashboard__section">
        <div class="dashboard__section-header">
          <h3>Upcoming Events</h3>
          <div class="view-toggle" id="events-toggle">
            <button class="view-toggle__btn${_eventsView === 'list' ? ' is-active' : ''}" data-toggle="list" aria-label="List view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                <circle cx="3" cy="6" r="1" fill="currentColor"/><circle cx="3" cy="12" r="1" fill="currentColor"/><circle cx="3" cy="18" r="1" fill="currentColor"/>
              </svg>
            </button>
            <button class="view-toggle__btn${_eventsView === 'calendar' ? ' is-active' : ''}" data-toggle="calendar" aria-label="Calendar view">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
            </button>
          </div>
        </div>
        <div id="events-preview">
          ${renderEventsPreview(events, today, _eventsView)}
        </div>
      </section>

      <section class="dashboard__section">
        <div class="dashboard__section-header">
          <h3>Upcoming Reminders</h3>
        </div>
        <div class="dashboard__list">
          ${upcomingReminders.length
            ? upcomingReminders.map(reminderItemHTML).join('')
            : emptyState('No reminders due soon.', '✅')}
        </div>
      </section>
    </div>
  `;

  // Done buttons on routines
  container.querySelectorAll('[data-log-done]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await logCompletion(btn.dataset.logDone);
      showToast('Marked as done! 🎉', 'success');
      renderDashboard(container);
    });
  });

  // Events view toggle
  container.querySelector('#events-toggle').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;
    _eventsView = btn.dataset.toggle;
    localStorage.setItem('dash_events_view', _eventsView);
    container.querySelectorAll('.view-toggle__btn').forEach(b =>
      b.classList.toggle('is-active', b.dataset.toggle === _eventsView)
    );
    container.querySelector('#events-preview').innerHTML =
      renderEventsPreview(events, today, _eventsView);
  });

  // Nav shortcuts
  container.querySelectorAll('[data-nav]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelector(`[data-view="${btn.dataset.nav}"]`)?.click();
    });
  });
}

// ── Events preview ────────────────────────────────────────

function renderEventsPreview(events, today, mode) {
  return mode === 'calendar'
    ? renderMiniCalendar(events, today)
    : renderUpcomingList(events, today);
}

function renderMiniCalendar(events, today) {
  const year  = today.getFullYear();
  const month = today.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const DN = ['S','M','T','W','T','F','S'];
  const MN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const dotMap = {};
  for (const ev of events) {
    if (ev.type === 'oneTime' && ev.date) {
      const [y, m, d] = ev.date.split('-').map(Number);
      if (y === year && m - 1 === month) {
        (dotMap[d] = dotMap[d] || []).push(ev.color || '#7C3AED');
      }
    } else if (ev.type === 'recurring') {
      for (let d = 1; d <= daysInMonth; d++) {
        const date = new Date(year, month, d);
        const key  = isoDate(year, month, d);
        if (ev.startDate && key < ev.startDate) continue;
        if (ev.endDate   && key > ev.endDate)   continue;
        const { interval, days, dayOfMonth } = ev.recurrence || {};
        const occurs = interval === 'daily' ||
          (interval === 'weekly'  && (days || []).includes(date.getDay())) ||
          (interval === 'monthly' && date.getDate() === dayOfMonth);
        if (occurs) (dotMap[d] = dotMap[d] || []).push(ev.color || '#7C3AED');
      }
    }
  }

  return `
    <div>
      <div style="text-align:center;font-size:11px;font-weight:700;color:var(--color-muted);margin-bottom:6px;text-transform:uppercase">
        ${MN[month]} ${year}
      </div>
      <div class="mini-cal__grid">
        ${DN.map(d => `<div class="mini-cal__dow">${d}</div>`).join('')}
        ${Array.from({ length: firstDay }, () => '<div></div>').join('')}
        ${Array.from({ length: daysInMonth }, (_, i) => {
          const day     = i + 1;
          const isToday = day === today.getDate();
          const dots    = (dotMap[day] || []).slice(0, 3);
          return `<div class="mini-cal__cell${isToday ? ' mini-cal__cell--today' : ''}">
            <span>${day}</span>
            ${dots.length ? `<div class="mini-cal__dots">${dots.map(c => `<span class="mini-cal__dot" style="background:${c}"></span>`).join('')}</div>` : ''}
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

function renderUpcomingList(events, today) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const groups = days.map((d, i) => {
    const key = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
    const dayEvents = events.filter(ev => eventOccursOn(ev, d, key));
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    return { label, events: dayEvents };
  }).filter(g => g.events.length);

  if (!groups.length) return emptyState('No upcoming events in the next 7 days.', '📅');

  return `<div class="upcoming-list">
    ${groups.map(g => `
      <div class="upcoming-list__day">
        <div class="upcoming-list__day-label">${g.label}</div>
        ${g.events.map(ev => `
          <div class="upcoming-list__event">
            <span class="upcoming-list__event-dot" style="background:${ev.color || '#7C3AED'}"></span>
            <span class="upcoming-list__event-title">${ev.title}</span>
            ${ev.time ? `<span class="upcoming-list__event-time">${ev.time}</span>` : ''}
          </div>`).join('')}
      </div>`).join('')}
  </div>`;
}

function eventOccursOn(ev, date, key) {
  if (ev.type === 'oneTime') return ev.date === key;
  if (ev.type === 'recurring') {
    if (ev.startDate && key < ev.startDate) return false;
    if (ev.endDate   && key > ev.endDate)   return false;
    const { interval, days, dayOfMonth } = ev.recurrence || {};
    return interval === 'daily' ||
      (interval === 'weekly'  && (days || []).includes(date.getDay())) ||
      (interval === 'monthly' && date.getDate() === dayOfMonth);
  }
  return false;
}

// ── Item templates ────────────────────────────────────────

function routineItemHTML(r) {
  const catClass = { beauty: 'beauty', therapy: 'therapy', general: 'general' }[r.category] || 'general';
  const catEmoji = { beauty: '💄', therapy: '💊', general: '📌' }[r.category] || '📌';
  const isToday  = r.history?.some(h => isSameDay(new Date(h.timestamp), new Date()));
  return `
    <div class="routine-item${isToday ? ' is-done' : ''}">
      <div class="routine-item__icon routine-item__icon--${catClass}">${catEmoji}</div>
      <div class="routine-item__body">
        <div class="routine-item__name">${r.name}</div>
        <div class="routine-item__time">${scheduleLabel(r.schedule)}</div>
      </div>
      <div class="routine-item__actions">
        ${isToday
          ? '<span class="badge badge--success">Done ✓</span>'
          : `<button class="btn btn--sm btn--primary" data-log-done="${r.id}">Done</button>`}
      </div>
    </div>`;
}

function reminderItemHTML(r) {
  const catEmoji = { beauty: '💄', therapy: '💊', general: '📌' }[r.category] || '🔔';
  return `
    <div class="routine-item">
      <div class="routine-item__icon routine-item__icon--general">${catEmoji}</div>
      <div class="routine-item__body">
        <div class="routine-item__name">${r.name}</div>
        <div class="routine-item__time">${r.nextTrigger ? formatTime(new Date(r.nextTrigger)) : ''}</div>
      </div>
    </div>`;
}

function emptyState(msg, emoji) {
  return `<div class="dashboard__empty"><div style="font-size:2rem">${emoji}</div><p>${msg}</p></div>`;
}

// ── Data helpers ──────────────────────────────────────────

async function logCompletion(routineId) {
  const routine = await db.routines.get(routineId);
  if (!routine) return;
  if (!routine.history) routine.history = [];
  routine.history.push({ timestamp: Date.now(), type: 'completed' });
  routine.streak = calcStreak(routine.history);
  await db.routines.save(routine);
  await db.logs.save({
    id:          `log_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    category:    routine.category,
    subcategory: routine.subcategory || null,
    timestamp:   Date.now(),
    notes:       `Completed: ${routine.name}`,
    metadata:    { sourceId: routineId, sourceType: 'routine' },
  });
}

function calcStreak(history) {
  if (!history?.length) return 0;
  const days   = [...new Set(history.map(h => new Date(h.timestamp).toDateString()))].sort().reverse();
  let streak   = 0;
  let cursor   = new Date(); cursor.setHours(0, 0, 0, 0);
  for (const s of days) {
    const d = new Date(s);
    if (d.getTime() === cursor.getTime()) { streak++; cursor.setDate(cursor.getDate() - 1); }
    else if (d < cursor) break;
  }
  return streak;
}

function isSameDay(a, b)  { return a.toDateString() === b.toDateString(); }
function scheduleLabel(s) {
  if (!s) return 'Any time';
  if (s.interval === 'daily')  return `Daily · ${(s.times || []).join(', ')}`;
  if (s.interval === 'weekly') return `Weekly · ${s.time || ''}`;
  return 'Custom';
}
function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
function formatTime(d) {
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}
