/**
 * scheduler.js — Notification scheduling engine
 *
 * Strategy:
 *  1. On start, schedule exact setTimeout for every upcoming event in the next 48h.
 *  2. On start, check for "missed" events (due in last 2h, not yet notified) and fire immediately.
 *  3. Re-schedule every 6 hours to pick up newly added events.
 *  4. Export rescheduleEvents() so the calendar can call it after saving an event.
 *  5. Events with no time get a 09:00 default notification.
 */

import db from '../db/db.js';
import { notify, canNotify } from '../notifications/notifications.js';
import { showToast } from '../views/toast.js';

const NOTIFIED_KEY    = 'meinapp_notified_events';
const DEFAULT_TIME    = '09:00'; // notification time for events without a specific time
const LOOK_AHEAD_MS   = 48 * 3600_000; // schedule up to 48 hours ahead
const MISSED_WINDOW_MS = 2 * 3600_000; // notify missed events within last 2 hours

const _timeouts = new Map(); // `${evId}:${dateISO}` → timeoutId
let _rescheduleTimer = null;

export function startScheduler() {
  rescheduleEvents();
  // Re-scan every 6 hours to pick up new events added while app is open
  _rescheduleTimer = setInterval(rescheduleEvents, 6 * 3600_000);
}

export function stopScheduler() {
  clearInterval(_rescheduleTimer);
  for (const id of _timeouts.values()) clearTimeout(id);
  _timeouts.clear();
}

/** Call this after saving / editing / deleting an event to refresh scheduled notifications. */
export async function rescheduleEvents() {
  const events  = await db.events.getAll();
  const now     = Date.now();
  const notified = getNotifiedSet();

  // Clear existing event timeouts (not reminder ones)
  for (const [key, id] of _timeouts) { clearTimeout(id); _timeouts.delete(key); }

  for (const ev of events) {
    const occurrences = getUpcomingOccurrences(ev, now, now + LOOK_AHEAD_MS);

    for (const { dateISO, timeMs } of occurrences) {
      const key   = `${ev.id}:${dateISO}`;
      const delay = timeMs - now;

      if (notified.has(key)) continue;

      if (delay <= 0) {
        // Missed — fire immediately if within window
        if (delay >= -MISSED_WINDOW_MS) {
          fireEventNotification(ev, dateISO, notified);
        }
        continue;
      }

      // Schedule for exact future time
      const tid = setTimeout(() => {
        fireEventNotification(ev, dateISO, getNotifiedSet());
      }, delay);
      _timeouts.set(key, tid);
    }
  }
}

async function fireEventNotification(ev, dateISO, notified) {
  const key = `${ev.id}:${dateISO}`;
  if (notified.has(key)) return;

  console.log('[scheduler] Firing notification for event:', ev.title, dateISO);

  // Always show in-app toast (works even when OS notifications are blocked)
  showToast(`🔔 ${ev.title}`, 'info', 6000);

  // Also attempt OS/browser notification
  if (canNotify()) {
    await notify({
      id:    `ev_${ev.id}_${dateISO}`,
      title: ev.title,
      body:  [categoryLabel(ev.category), ev.notes].filter(Boolean).join(' · ') || 'Event reminder',
    });
  } else {
    console.warn('[scheduler] Notification permission not granted — showing toast only');
  }

  notified.add(key);
  saveNotifiedSet(notified);
}

// ── Occurrence helpers ────────────────────────────────────

function getUpcomingOccurrences(ev, fromMs, toMs) {
  const results = [];

  if (ev.type === 'oneTime') {
    if (!ev.date) return results;
    const ms = eventTimeMs(ev.date, ev.time);
    if (ms >= fromMs - MISSED_WINDOW_MS && ms <= toMs) {
      results.push({ dateISO: ev.date, timeMs: ms });
    }
  } else if (ev.type === 'recurring') {
    const start = new Date(fromMs - MISSED_WINDOW_MS); start.setHours(0, 0, 0, 0);
    const end   = new Date(toMs);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const iso = localDate(d);
      if (ev.startDate && iso < ev.startDate) continue;
      if (ev.endDate   && iso > ev.endDate)   continue;
      if ((ev.deletedDates || []).includes(iso)) continue;
      if (!recurringOccursOn(ev, d, iso)) continue;
      const ms = eventTimeMs(iso, ev.time);
      if (ms >= fromMs - MISSED_WINDOW_MS && ms <= toMs) {
        results.push({ dateISO: iso, timeMs: ms });
      }
    }
  }

  return results;
}

function eventTimeMs(dateISO, time) {
  const [h, m] = (time || DEFAULT_TIME).split(':').map(Number);
  const d = new Date(dateISO + 'T00:00:00');
  d.setHours(h, m, 0, 0);
  return d.getTime();
}

function recurringOccursOn(ev, date, key) {
  if (ev.startDate && key < ev.startDate) return false;
  if (ev.endDate   && key > ev.endDate)   return false;
  if ((ev.deletedDates || []).includes(key)) return false;
  const { interval, days, dayOfMonth } = ev.recurrence || {};
  return interval === 'daily' ||
    (interval === 'weekly'  && (days || []).includes(date.getDay())) ||
    (interval === 'monthly' && date.getDate() === dayOfMonth);
}

// ── Notified set helpers ──────────────────────────────────

function localDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getNotifiedSet() {
  try {
    const raw = localStorage.getItem(NOTIFIED_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}

function saveNotifiedSet(set) {
  try {
    // Keep only entries from the last 7 days to avoid unbounded growth
    const cutoff = localDate(new Date(Date.now() - 7 * 86_400_000));
    const pruned = [...set].filter(k => k.split(':')[1] >= cutoff);
    localStorage.setItem(NOTIFIED_KEY, JSON.stringify(pruned));
  } catch {}
}

// ── Reminder scheduling (legacy — kept for compatibility) ──

export function calcNextTrigger(reminder) {
  const now = Date.now();

  if (reminder.type === 'oneTime') return null;

  if (reminder.type === 'recurring') {
    const { interval, times } = reminder.schedule || {};
    if (interval === 'daily')  return nextTimeOfDay(times || ['09:00'], now);
    if (interval === 'weekly') {
      const { days = [1], time = '09:00' } = reminder.schedule;
      return nextWeeklyOccurrence(days, time, now);
    }
    if (typeof interval === 'number') return now + interval;
  }

  return now + 86_400_000;
}

function nextTimeOfDay(times, fromMs) {
  const candidates = times.map(t => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date(fromMs);
    d.setHours(h, m, 0, 0);
    if (d.getTime() <= fromMs) d.setDate(d.getDate() + 1);
    return d.getTime();
  });
  return Math.min(...candidates);
}

function nextWeeklyOccurrence(days, time, fromMs) {
  const [h, m] = time.split(':').map(Number);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(fromMs);
    d.setDate(d.getDate() + i);
    if (days.includes(d.getDay())) { d.setHours(h, m, 0, 0); return d.getTime(); }
  }
  return fromMs + 7 * 86_400_000;
}

function categoryLabel(cat) {
  const labels = { beauty: '💄 Beauty', therapy: '💊 Therapy', general: '📌 General', personal: '🌟 Personal', children: '👨‍👩‍👧 Children' };
  return labels[cat] || 'Reminder';
}
