# MeinApp — Project Log & Architecture Decisions

A living document. Most recent entries at the top.  
Every significant decision is recorded here with reasoning.

---

## Session 3 — 2026-03-01: Unified Events Model + UX Improvements

### What Changed

| File | Change |
|------|--------|
| `src/js/views/calendar.js` | `showAddEventModal` exported, accepts `{ defaultDate, defaultCategory, onSaved }` |
| `src/js/views/routines.js` | Full rewrite — now reads from `events` store, category tabs, uses `showAddEventModal` |
| `src/js/views/history.js` | Full rewrite — reads from `events` store, builds past occurrences from recurring events |
| `src/js/app.js` | FAB `+` now opens `showAddEventModal` instead of Quick Log; `navigate()` wrapped in try/catch |
| `src/scss/layout/_shell.scss` | Nav items now use `flex:1` + `10px font-size` so all 5 tabs fit on small screens |
| `src/scss/components/_modal.scss` | Added `&__header`, `&__close`, `&__actions` — close icon top-right, save button bottom |
| All modals | Replaced inline Cancel buttons with `modal__close` (✕ icon top-right) + `modal__actions` (save bottom) |

### AD-018: Unified Events Store — everything is an event
**Decision (replaces AD-015):** Routines, therapy reminders, calendar events, and quick logs all write to the single `events` IndexedDB store.  
**Reason:** The original design had 4 separate stores (`routines`, `therapy`, `logs`, `events`). This caused duplication — adding a routine didn't make it appear in the calendar; a quick log didn't appear in the upcoming list. Unifying into `events` means one add creates visibility everywhere.  
**Impact:** `routines`, `therapy`, `logs` stores remain in the DB schema (backward compat) but the UI no longer writes to them. They can be removed in a future DB migration.  
**Data flow:** `Add Event modal` → `db.events.save()` → Calendar grid + Dashboard upcoming + Routines list + History log all read from `db.events.getAll()`.

### AD-019: `showAddEventModal` extracted as shared module entry point
**Decision:** `showAddEventModal({ defaultDate, defaultCategory, onSaved })` is exported from `calendar.js` and used by `app.js` (FAB), `routines.js` (Add button), and internal calendar buttons.  
**Reason:** The Add Event modal is the single UI for creating all content. Centralising it in `calendar.js` avoids drift between multiple modals. The `onSaved` callback decouples the save action from the caller's re-render logic.

### AD-020: Modal UX pattern — ✕ close top-right, Save button bottom
**Decision:** All bottom-sheet modals follow this pattern: drag handle → header row (title + ✕ button) → form fields → `modal__actions` bar at bottom (Save button full-width). Cancel text buttons removed.  
**Reason:** Matches native mobile app conventions. ✕ is universally understood as "dismiss". Placing Save at the bottom keeps the thumb reach comfortable on phones.

### AD-021: `navigate()` wrapped in try/catch with visible error state
**Decision:** Added error handling to the SPA router so a JS runtime error in any view shows a readable error message instead of leaving the screen stuck on "Loading…".  
**Reason:** During development, a `db.logs.delete()` call (wrong method name — should be `db.logs.remove()`) left every view stuck on Loading with no feedback. The error boundary gives instant diagnostic output including the error message.

### AD-022: Bottom nav items use `flex:1` for 5-tab layout
**Decision:** Nav items changed from `padding: 8px 16px` to `flex:1; padding: 8px; font-size: 10px`.  
**Reason:** Fixed horizontal padding caused the 5th tab (Calendar) to be clipped or invisible on small screens (< 360px wide). Equal flex distribution ensures all tabs are always visible.

---

## Session 2 (continued) — 2026-03-01: Phase 2–4 Completion

### What Changed

| File | Change |
|------|--------|
| `src/js/views/routines.js` | Added Therapy tab with type picker (meds/vitamins/physical/mental), streak badges, delete buttons |
| `src/js/views/history.js` | Added Insights tab with SVG bar chart, category progress bars, streak leaderboard |
| `README.md` | Initial full documentation |

### AD-016: SVG bar chart — no chart library
**Decision:** 14-day activity bar chart rendered as inline SVG via vanilla JS string.  
**Reason:** No frontend libraries allowed per spec. SVG is natively supported at zero kb cost.  
**Approach:** Each bar is a `<rect>` scaled proportionally to the daily max count. Today's bar highlighted in `--color-primary`.

### AD-017: Insights tab inside History (not a separate nav tab)
**Decision:** Stats/charts are a tab inside History, not a 6th nav item.  
**Reason:** Keeps nav at 5 items. Insights are contextually linked to history data.

---

## Session 2 — 2026-03-01: Calendar Feature

### What Changed

| File | Change |
|------|--------|
| `src/js/db/db.js` | Added `events` store, bumped `DB_VERSION` to 2 |
| `src/js/views/calendar.js` | New file — full calendar view, day sheet, add event modal |
| `src/js/views/dashboard.js` | Rewrote — added events preview with 📋/📅 toggle |
| `src/scss/pages/_calendar.scss` | New file — calendar grid, dots, day sheet, color swatches |
| `public/index.html` | 5th nav tab added (Calendar); nav order: Home·Routines·Calendar·History·Settings |

### AD-011: `events` store separate from `reminders`
**Decision:** Calendar events in `events` store; scheduled notifications in `reminders` store.  
**Reason:** Events are visual/date-based (color, grid placement). Reminders are notification-centric (nextTrigger, snooze state). Separate stores keep each concern clean.

### AD-012: Recurring events expanded at render time
**Decision:** Recurring events are stored as a single record with recurrence rules. `buildEventMap()` expands them into individual day slots when rendering a calendar month.  
**Reason:** Storing every future occurrence would bloat IndexedDB. Expansion is fast (max 31 iterations per event per month render).

### AD-013: Dashboard events view persisted in localStorage
**Decision:** The 📋/📅 toggle on the dashboard is saved to `localStorage` key `dash_events_view`.  
**Reason:** Respect the user's preference across navigations.

### AD-014: Calendar as 3rd (middle) nav tab
**Decision:** Nav order: Home | Routines | **Calendar** | History | Settings.  
**Reason:** Calendar is the most-used feature after Dashboard. Middle position = easiest thumb reach.

### Event data model
```js
{
  id, title, category, color,
  type: 'oneTime' | 'recurring',
  date,          // oneTime — 'YYYY-MM-DD'
  startDate,     // recurring — first occurrence
  endDate,       // optional cutoff
  recurrence: { interval, days, dayOfMonth },
  time,          // optional 'HH:MM'
  notes,
  completedDates: []
}
```

---

## Session 1 — 2026-03-01: Full Scaffold (Phase 1)

### What Was Built
Full project scaffold from scratch based on `docs/Notification_Tracking_App_Spec.pdf`.

| Module | File | Notes |
|--------|------|-------|
| Node.js server | `server/server.js` | Built-in `http`, SPA fallback, 404 for assets |
| SASS 7-1 | `src/scss/` | Tokens, variables, base, components, layout, pages, themes |
| App shell | `public/index.html` | 5-tab nav, FAB, toast container, modal root |
| SPA Router | `src/js/app.js` | Hash-free routing, view registry |
| IndexedDB | `src/js/db/db.js` | Promise-based CRUD wrapper |
| Pub/sub store | `src/js/store/store.js` | Lightweight reactive state |
| Scheduler | `src/js/scheduler/scheduler.js` | 60s interval, nextTrigger timestamps |
| Notifications | `src/js/notifications/notifications.js` | Permission, SW-based display |
| All views | `src/js/views/` | dashboard, routines, history, settings, toast |
| Service Worker | `public/sw.js` | Cache-first offline, notification action relay |
| PWA Manifest | `public/manifest.json` | Shortcuts, icons, display:standalone |

### Security improvement — Session 1 (mid)
JS source moved from `public/js/` → `src/js/`. esbuild added to bundle + minify into `public/js/bundle.min.js`. Source is never served via HTTP.

### AD-001: Vanilla JS only — no frontend framework
**Decision:** No React, Vue, Svelte, or any UI library.  
**Reason:** Specified in the product spec. Keeps bundle near zero, no abstraction overhead.

### AD-002: esbuild for JS bundling (replaces raw ES modules)
**Decision:** `src/js/app.js` → esbuild → `public/js/bundle.min.js`. Source maps disabled in prod.  
**Reason:** Raw ES module files in `public/js/` were fully readable via DevTools. esbuild produces a minified bundle that is hard to reverse-engineer. Also faster to serve (one HTTP request vs many).

### AD-003: Dart Sass (`sass` npm package)
**Decision:** `sass src/scss/main.scss public/css/main.css --style=compressed`  
**Reason:** Specified in spec. `@use` module system used throughout (not `@import`).  
**Note:** Every SASS partial that uses design tokens must explicitly `@use '../utilities/tokens' as *`. Tokens are NOT global in the `@use` system.

### AD-004: IndexedDB as sole data store
**Decision:** All user data in IndexedDB, local-only.  
**Reason:** Offline-first requirement. JSON export provides manual backup.

### AD-005: Node.js built-in `http` (no Express)
**Decision:** Minimal static server with SPA fallback.  
**Port:** 3000 (override with `PORT` env var)  
**Rule:** Extension-less paths → serve `index.html`. Paths with `.js`/`.css`/etc. → real 404.

### AD-006: SVG icons for PWA manifest
**Decision:** SVG placeholder icons until proper PNGs are designed.  
**Note:** Some PWA audits flag SVG icons. Replace with PNG for production install support.

### AD-007: Scheduler in main thread (not Background Sync)
**Decision:** `setInterval(60s)` in the app tab, not via Background Sync API.  
**Reason:** Background Sync has limited support. SW handles the notification display.  
**Limitation:** Reminders only fire if the browser has been opened at least once since last boot.

### AD-008: Single-file views
**Decision:** Each view is one self-contained JS file.  
**Reason:** Simplicity at MVP stage. Can be split into components later.

### AD-009: SPA server returns 404 for missing assets
**Decision:** `server.js` checks `path.extname(urlPath)`. If the extension is present but the file doesn't exist → 404. Only extension-less paths get the SPA fallback.  
**Reason:** Without this, `GET /js/app.js` returned 200 + index.html, hiding missing files.

---

## Design Tokens (reference)

| Token | Value |
|-------|-------|
| `$color-primary` | `#7C3AED` (violet) |
| `$color-secondary` | `#EC4899` (pink) |
| `$space-1` | 4px |
| `$space-4` | 16px |
| `$space-6` | 24px |
| `$font-size-xs` | 11px |
| `$font-size-sm` | 13px |
| `$font-size-base` | 16px |
| `$radius-lg` | 12px |
| `$radius-full` | 9999px |

---

## Current Bundle Size

| Asset | Size |
|-------|------|
| `public/js/bundle.min.js` | ~40kb |
| `public/css/main.css` | ~8kb |
| Runtime dependencies | **0** |

---
## Session — 2026-03-06: Colors change and unused code delete, remainders/notification on event  


 ✅ Changes

  1. History — Children category added (history.js)

   - Added 'children' to CATEGORIES filter list (Log tab chips)
   - Added to CAT_COLORS, bar chart CATS, bucket counts, and insights catCounts
   - Children shows with 👨‍👩‍👧 emoji in the insights breakdown

  2. Pastel colors everywhere (history.js, dashboard.js, _dashboard.scss)

   - beauty → #F9A8D4 pastel pink
   - therapy → #C4B5FD pastel purple (was blue)
   - general → #FDBA74 pastel orange
   - personal → #FCD34D pastel yellow
   - children → #6EE7B7 pastel green
   - SCSS icon backgrounds updated with --personal and --children variants added

  3. Event push notifications (scheduler.js)

   - Scheduler now also checks all events each minute
   - If an event has a time set and occurs today (one-time or recurring), it fires a browser push notification at that exact time
   - Notified events are tracked in localStorage (keyed by eventId:date) to avoid duplicates — auto-pruned daily

  4. Dashboard simplified (dashboard.js)

   - Removed Today's Routines section (always empty, redundant with Events tab)
   - Removed Upcoming Reminders section (not used)
   - Dashboard now shows only the Upcoming Events section (list/calendar toggle, next 7 days)

## Session — 2026-03-06: Notification doesn't fire 


     🐛 Root causes & fixes

  1. Polling had a 60-second blind spot → replaced with exact setTimeout

   - Old code polled every minute and only fired if the event time was within the last 60 seconds — easy to miss
   - New code calls rescheduleEvents() on boot and schedules a precise setTimeout for every upcoming event in the next 48 hours
   - When you add/edit an event, rescheduleEvents() is called immediately so the new event is scheduled right away

  2. Events without a time were silently skipped → default 09:00 notification

   - Events with no time set now get a morning reminder at 09:00 on their date

  3. Missed events were lost forever → catch-up on app open

   - On startup, any event that was due in the last 2 hours (and not yet notified) fires immediately — so opening the app shortly after an event time still gives you the 
  notification

  4. No visible permission prompt → yellow banner on dashboard

   - If notifications aren't granted, a "🔔 Enable notifications" banner now appears prominently on the dashboard
   - The Settings → Notifications section now shows a "▶ Send test" button so you can confirm it works

  ⚠️ Important for the installed desktop app: When the PWA is fully closed, JS can't run so no notifications fire. Keep the app open or minimized (not quit) for on-time
  delivery — this is a limitation of client-only PWAs without a push server. The catch-up feature handles the case where you re-open it shortly after.

*Maintained by GitHub Copilot CLI. Update after each session.*
