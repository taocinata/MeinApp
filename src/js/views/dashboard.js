/**
 * dashboard.js — Dashboard view
 *
 * Shows today's routines, upcoming events (calendar/list toggle),
 * and upcoming reminders.
 */

import db from '../db/db.js';
import { isoDate } from './calendar.js';
import { requestPermission, canNotify } from '../notifications/notifications.js';

let _eventsView = localStorage.getItem('dash_events_view') || 'list';

export async function renderDashboard(container) {
  const events = await db.events.getAll();
  const today  = new Date();

  container.innerHTML = `
    <div class="dashboard">
      <div class="dashboard__greeting">
        <h2>${getGreeting()} 👋</h2>
        <p>${formatDate(today)}</p>
      </div>

      ${!canNotify() ? `
      <div id="notif-banner" style="
        background:#FEF3C7;border:1px solid #FCD34D;border-radius:12px;
        padding:12px 14px;margin-bottom:1.25rem;display:flex;
        align-items:center;gap:10px;font-size:13px">
        <span style="font-size:1.4rem">🔔</span>
        <div style="flex:1">
          <strong>Enable notifications</strong> to get reminders for your events.
        </div>
        <button id="enable-notif-btn" class="btn btn--primary btn--sm">Enable</button>
      </div>` : ''}

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
    </div>
  `;

  // Notification permission banner
  container.querySelector('#enable-notif-btn')?.addEventListener('click', async () => {
    const result = await requestPermission();
    if (result === 'granted') {
      container.querySelector('#notif-banner')?.remove();
      // Reschedule now that permission is granted
      const { rescheduleEvents } = await import('../scheduler/scheduler.js');
      rescheduleEvents();
    }
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
        (dotMap[d] = dotMap[d] || []).push(ev.color || '#C4B5FD');
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
        if (occurs) (dotMap[d] = dotMap[d] || []).push(ev.color || '#C4B5FD');
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
            <span class="upcoming-list__event-dot" style="background:${ev.color || '#C4B5FD'}"></span>
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

function emptyState(msg, emoji) {
  return `<div class="dashboard__empty"><div style="font-size:2rem">${emoji}</div><p>${msg}</p></div>`;
}

// ── Helpers ───────────────────────────────────────────────

function getGreeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
function formatDate(d) {
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
