/**
 * history.js — History & Insights, powered by unified events store.
 */

import db from '../db/db.js';
import { showAddEventModal } from './calendar.js';
import { deleteEvent } from '../utils/deleteEvent.js';

const CATEGORIES = ['all', 'beauty', 'therapy', 'general', 'personal'];
let _activeFilter  = 'all';
let _activeTab     = 'log';
let _chartOffset   = 0;   // 0 = current 7 days, 1 = previous 7 days, etc.
let _container     = null; // track container to avoid duplicate listeners
let _clickHandler  = null;

const CAT_COLORS = {
  beauty:   '#EC4899',  // pink
  therapy:  '#3B82F6',  // blue
  general:  '#F97316',  // orange
  personal: '#EAB308',  // yellow
};

export async function renderHistory(container) {
  const events = await db.events.getAll();

  // Build a flat list of "past occurrences" from one-time events + recurring
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const today     = localISO(todayDate);
  const pastItems = buildPastItems(events, today);
  pastItems.sort((a, b) => b.dateKey.localeCompare(a.dateKey));

  container.innerHTML = `
    <div class="history">
      <div style="display:flex;gap:4px;margin-bottom:1.25rem;background:var(--color-bg);
                  border:1px solid var(--color-border);border-radius:9999px;padding:3px">
        <button class="view-toggle__btn${_activeTab === 'log' ? ' is-active' : ''}" data-htab="log"
                style="flex:1;border-radius:9999px;padding:7px;font-size:13px;font-weight:600">📋 Log</button>
        <button class="view-toggle__btn${_activeTab === 'insights' ? ' is-active' : ''}" data-htab="insights"
                style="flex:1;border-radius:9999px;padding:7px;font-size:13px;font-weight:600">📊 Insights</button>
      </div>
      <div id="history-body">
        ${_activeTab === 'log' ? renderLogTab(pastItems, _activeFilter) : renderInsightsTab(events)}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-htab]').forEach(btn => {
    btn.addEventListener('click', () => { _activeTab = btn.dataset.htab; renderHistory(container); });
  });
  container.querySelectorAll('[data-filter]').forEach(btn => {
    btn.addEventListener('click', () => { _activeFilter = btn.dataset.filter; renderHistory(container); });
  });

  // Delegated click handler — attached only ONCE per container to avoid
  // exponential duplicates on re-render (the root cause of the "August" bug).
  if (_container !== container) {
    if (_container && _clickHandler) _container.removeEventListener('click', _clickHandler);
    _clickHandler = async (e) => {
      const chartPrev = e.target.closest('[data-chart-prev]');
      if (chartPrev) { _chartOffset++; renderHistory(container); return; }
      const chartNext = e.target.closest('[data-chart-next]');
      if (chartNext && _chartOffset > 0) { _chartOffset--; renderHistory(container); return; }

      const deleteBtn = e.target.closest('[data-ev-delete]');
      if (deleteBtn) {
        const ev = (await db.events.getAll()).find(x => x.id === deleteBtn.dataset.evDelete);
        if (!ev) return;
        await deleteEvent(ev, deleteBtn.dataset.evDate || null, () => renderHistory(container));
      }
      const editBtn = e.target.closest('[data-ev-edit]');
      if (editBtn) {
        const ev = (await db.events.getAll()).find(x => x.id === editBtn.dataset.evEdit);
        if (ev) showAddEventModal({ existing: ev, onSaved: () => renderHistory(container) });
      }
    };
    container.addEventListener('click', _clickHandler);
    _container = container;
  }
}

// ── Date helpers ──────────────────────────────────────────
// Always use local calendar date (not UTC) so bucket keys match
// event dates stored from <input type="date"> (which are also local).
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// ── Build flat list of past items ─────────────────────────
function buildPastItems(events, today) {
  const items = [];
  for (const ev of events) {
    if (ev.type === 'oneTime') {
      if (ev.date && ev.date <= today) {
        items.push({ dateKey: ev.date, ev });
      }
    } else if (ev.type === 'recurring') {
      const start = new Date(); start.setHours(0,0,0,0);
      start.setDate(start.getDate() - 90); // extend window for chart navigation
      for (let d = new Date(start); localISO(d) <= today; d.setDate(d.getDate()+1)) {
        const key = localISO(d);
        if (ev.startDate && key < ev.startDate) continue;
        if (ev.endDate   && key > ev.endDate)   continue;
        if ((ev.deletedDates || []).includes(key)) continue;
        if (occursOn(ev, d)) items.push({ dateKey: key, ev });
      }
    }
  }
  return items;
}

function occursOn(ev, date) {
  const { interval, days, dayOfMonth } = ev.recurrence || {};
  if (interval === 'daily')   return true;
  if (interval === 'weekly')  return (days || []).includes(date.getDay());
  if (interval === 'monthly') return date.getDate() === dayOfMonth;
  return false;
}

// ── Log tab ───────────────────────────────────────────────
function renderLogTab(items, filter) {
  return `
    <div class="history__filters">
      ${CATEGORIES.map(c => `
        <button class="chip${_activeFilter === c ? ' is-active' : ''}" data-filter="${c}">
          ${c.charAt(0).toUpperCase() + c.slice(1)}
        </button>`).join('')}
    </div>
    <div class="history__list">
      ${renderLogList(items, filter)}
    </div>`;
}

function renderLogList(items, filter) {
  const filtered = filter === 'all' ? items : items.filter(i => i.ev.category === filter);
  if (!filtered.length) {
    return `<div class="dashboard__empty">
      <div style="font-size:2rem">📭</div>
      <p>No entries yet${filter !== 'all' ? ` for <strong>${filter}</strong>` : ''}.</p>
    </div>`;
  }

  const groups = {};
  for (const item of filtered) {
    const label = fmtDateLabel(item.dateKey);
    if (!groups[label]) groups[label] = [];
    groups[label].push(item);
  }

  return Object.entries(groups).map(([label, entries]) => `
    <div class="history__date-group">
      <div class="history__date-group-label">${label}</div>
      ${entries.map(i => logEntryHTML(i)).join('')}
    </div>`).join('');
}

function logEntryHTML({ dateKey, ev }) {
  const catColors = { beauty: '#EC4899', therapy: '#7C3AED', general: '#06B6D4', personal: '#F59E0B' };
  const color = ev.color || catColors[ev.category] || '#9CA3AF';
  const typeTag = ev.type === 'recurring'
    ? `<span style="font-size:10px;background:var(--color-border);padding:1px 5px;border-radius:9999px">🔁 recurring</span>`
    : '';
  return `
    <div class="log-entry">
      <div class="log-entry__dot" style="background:${color}"></div>
      <div class="log-entry__body">
        <div class="log-entry__name">${ev.title}</div>
        <div class="log-entry__meta">
          ${ev.category} ${ev.time ? '· ⏰ ' + ev.time : ''} ${typeTag}
        </div>
      </div>
      <div class="log-entry__actions">
        <button class="icon-btn" data-ev-edit="${ev.id}" aria-label="Edit" title="Edit">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" width="15" height="15">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button class="icon-btn icon-btn--danger" data-ev-delete="${ev.id}" data-ev-date="${dateKey}" aria-label="Delete" title="Delete">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" width="15" height="15">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
        </button>
      </div>
    </div>`;
}

// ── Insights tab ──────────────────────────────────────────
function renderInsightsTab(events) {
  const todayDate = new Date(); todayDate.setHours(0,0,0,0);
  const today = localISO(todayDate);
  const items = buildPastItems(events, today);

  const now    = Date.now();
  const day    = 86_400_000;
  const last7  = items.filter(i => new Date(i.dateKey).getTime() > now - 7  * day);
  const last30 = items.filter(i => new Date(i.dateKey).getTime() > now - 30 * day);

  const catCounts = { beauty: 0, therapy: 0, general: 0, personal: 0 };
  for (const i of last30) { if (catCounts[i.ev.category] !== undefined) catCounts[i.ev.category]++; }

  const recurringCount = events.filter(e => e.type === 'recurring').length;
  const total30 = Object.values(catCounts).reduce((a, b) => a + b, 0) || 1;

  return `
    <div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:1.5rem">
        ${statCard('Total Events', events.length, '📅')}
        ${statCard('This Week', last7.length, '📅')}
        ${statCard('This Month', last30.length, '📆')}
        ${statCard('Recurring', recurringCount, '🔁')}
      </div>

      <div class="card card--elevated" style="margin-bottom:1.25rem">
        ${buildBarChart(items)}
      </div>

      <div class="card card--elevated">
        <div class="card__title">This Month by Category</div>
        <div style="margin-top:12px">
          ${Object.entries(catCounts).map(([cat, count]) => {
            const pct = Math.round((count / total30) * 100);
            const colors = { beauty: '#EC4899', therapy: '#7C3AED', general: '#06B6D4', personal: '#F59E0B' };
            const emojis = { beauty: '💄', therapy: '💊', general: '📌', personal: '🌟' };
            return `
              <div style="margin-bottom:10px">
                <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px">
                  <span>${emojis[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>
                  <span style="color:var(--color-muted)">${count} (${pct}%)</span>
                </div>
                <div style="height:8px;background:var(--color-border);border-radius:9999px;overflow:hidden">
                  <div style="height:100%;width:${pct}%;background:${colors[cat]};border-radius:9999px"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
}

function buildBarChart(items) {
  const today = new Date(); today.setHours(0,0,0,0);

  // Build 7 local-date buckets for the selected week offset
  const buckets = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i - _chartOffset * 7);
    const key = localISO(d);  // ← local date, matches event dateKeys
    const counts = { beauty: 0, therapy: 0, general: 0, personal: 0 };
    for (const it of items) {
      if (it.dateKey === key && counts[it.ev.category] !== undefined) counts[it.ev.category]++;
    }
    buckets.push({ key, label: d.toLocaleDateString('en-US', { weekday: 'short' }), counts });
  }

  const max = Math.max(...buckets.map(b => Object.values(b.counts).reduce((a,v)=>a+v,0)), 1);
  const CHART_H = 50;   // usable SVG units
  const BASELINE = 62;  // y bottom of bars
  const barW = 100 / 7;
  const CATS = ['general', 'beauty', 'therapy', 'personal'];

  const bars = buckets.map((b, i) => {
    const total = Object.values(b.counts).reduce((a,v)=>a+v,0);
    let yPos = BASELINE;
    let rects = '';
    for (const cat of CATS) {
      if (!b.counts[cat]) continue;
      const h = Math.max(Math.round((b.counts[cat] / max) * CHART_H), 3);
      yPos -= h;
      const x = (i * barW + barW * 0.12).toFixed(2);
      const w = (barW * 0.76).toFixed(2);
      rects += `<rect x="${x}%" y="${yPos}" width="${w}%" height="${h}" rx="2" fill="${CAT_COLORS[cat]}"/>`;
    }
    const countLabel = total > 0
      ? `<text x="${(i * barW + barW * 0.5).toFixed(2)}%" y="${yPos - 2}" text-anchor="middle" font-size="5" fill="#9CA3AF">${total}</text>`
      : '';
    return rects + countLabel;
  }).join('');

  // Date range header
  const fmtShort = iso => new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const rangeLabel = _chartOffset === 0 ? 'Last 7 days' : `${fmtShort(buckets[0].key)} – ${fmtShort(buckets[6].key)}`;
  const navBtnStyle = 'background:none;border:none;cursor:pointer;font-size:16px;padding:2px 6px;color:var(--color-muted)';

  return `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
      <button data-chart-prev style="${navBtnStyle}" aria-label="Previous week">‹</button>
      <span style="font-size:12px;font-weight:600;color:var(--color-muted)">${rangeLabel}</span>
      <button data-chart-next style="${navBtnStyle}${_chartOffset === 0 ? ';opacity:.3;pointer-events:none' : ''}" aria-label="Next week">›</button>
    </div>
    <svg viewBox="0 0 100 68" preserveAspectRatio="none" style="width:100%;height:80px;display:block">
      ${bars}
    </svg>
    <div style="display:flex;justify-content:space-around;font-size:9px;color:var(--color-muted);margin-top:4px">
      ${buckets.map(b => `<span>${b.label}</span>`).join('')}
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;justify-content:center">
      ${Object.entries(CAT_COLORS).map(([cat, color]) =>
        `<span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--color-muted)">
          <span style="width:10px;height:10px;border-radius:2px;background:${color};display:inline-block"></span>
          ${cat.charAt(0).toUpperCase() + cat.slice(1)}
        </span>`
      ).join('')}
    </div>`;
}

function statCard(label, value, icon, sub = '') {
  return `<div class="card" style="text-align:center;padding:16px 8px">
    <div style="font-size:1.5rem">${icon}</div>
    <div style="font-size:1.4rem;font-weight:700;margin:4px 0">${value}</div>
    <div style="font-size:11px;color:var(--color-muted)">${label}</div>
    ${sub ? `<div style="font-size:10px;color:var(--color-muted);margin-top:2px">${sub}</div>` : ''}
  </div>`;
}

function fmtDateLabel(iso) {
  const d = new Date(iso + 'T00:00:00');
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}
