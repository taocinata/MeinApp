/**
 * scheduler.js — Reminder scheduling engine
 *
 * - Checks IndexedDB for due reminders on an interval.
 * - Fires notifications via the notifications module.
 * - Updates nextTrigger after firing.
 */

import db from '../db/db.js';
import { notify } from '../notifications/notifications.js';

const CHECK_INTERVAL_MS = 60_000; // check every minute

let _timer = null;

export function startScheduler() {
  if (_timer) return;
  checkDue(); // run immediately
  _timer = setInterval(checkDue, CHECK_INTERVAL_MS);
}

export function stopScheduler() {
  clearInterval(_timer);
  _timer = null;
}

async function checkDue() {
  const now = Date.now();
  const reminders = await db.reminders.getAll();

  for (const reminder of reminders) {
    if (reminder.status === 'disabled') continue;
    if (!reminder.nextTrigger || reminder.nextTrigger > now) continue;

    // Fire notification
    await notify({
      id:       reminder.id,
      title:    reminder.name,
      body:     reminder.notes || categoryLabel(reminder.category),
      category: reminder.category,
    });

    // Advance nextTrigger
    reminder.nextTrigger = calcNextTrigger(reminder);
    await db.reminders.save(reminder);
  }
}

/**
 * Calculate the next trigger timestamp for a reminder.
 * @param {object} reminder
 * @returns {number|null} Unix ms timestamp or null if one-time and expired
 */
export function calcNextTrigger(reminder) {
  const now = Date.now();

  if (reminder.type === 'oneTime') {
    // One-time: disable after firing
    return null;
  }

  if (reminder.type === 'recurring') {
    const { interval, times } = reminder.schedule || {};

    if (interval === 'daily') {
      // times: ['08:00', '20:00'] — find next occurrence today or tomorrow
      const next = nextTimeOfDay(times || ['09:00'], now);
      return next;
    }

    if (interval === 'weekly') {
      const { days = [1], time = '09:00' } = reminder.schedule;
      return nextWeeklyOccurrence(days, time, now);
    }

    // Custom ms interval
    if (typeof interval === 'number') {
      return now + interval;
    }
  }

  return now + 86_400_000; // fallback: 24h
}

function nextTimeOfDay(times, fromMs) {
  const now = new Date(fromMs);
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
  const now = new Date(fromMs);
  for (let i = 1; i <= 7; i++) {
    const d = new Date(fromMs);
    d.setDate(d.getDate() + i);
    if (days.includes(d.getDay())) {
      d.setHours(h, m, 0, 0);
      return d.getTime();
    }
  }
  return fromMs + 7 * 86_400_000;
}

function categoryLabel(cat) {
  const labels = { beauty: '💄 Beauty', therapy: '💊 Therapy', general: '📌 General' };
  return labels[cat] || 'Reminder';
}
