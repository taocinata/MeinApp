# MeinApp — Daily Routines & Reminders

A **PWA-enabled, offline-first** personal tracking app for beauty routines, therapy reminders, calendar events, and daily habits.  
Built with **Vanilla JS, HTML, SASS** — no frameworks, no runtime dependencies.

---

## Features

| Feature | Description |
|---------|-------------|
| 🏠 **Dashboard** | Greeting, today's upcoming events, list/calendar preview toggle |
| 📋 **Routines** | View all events by category (Beauty · Therapy · General · Personal), add new ones |
| 📅 **Calendar** | Monthly grid with colored event dots, tap a day to see details, add events |
| 📖 **History** | Past events grouped by date + Insights tab (14-day chart, category breakdown) |
| ⚙️ **Settings** | Dark/light mode, notification permission, JSON export/import |
| ➕ **FAB Button** | One-tap to add a new event from anywhere in the app |
| 🔔 **Notifications** | Browser push via Service Worker, Done/Snooze actions |
| 📵 **Offline** | Works fully without network (Service Worker cache-first strategy) |

---

## How It Works — Core Concept

**Everything is an Event.**  
Whether you add something from the Routines tab, Calendar, or the FAB `+` button — it all goes into the same `events` store in IndexedDB.

- Add a beauty routine → appears in Calendar + Routines tab + Dashboard upcoming
- Add a therapy reminder → same flow, just different category
- Add a one-time appointment → appears in Calendar on that date + History after it passes

**Event types:**
- `oneTime` — a specific date (e.g. doctor appointment on March 5)
- `recurring` — repeats daily / weekly (on chosen days) / monthly

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES modules) + HTML5 |
| Styling | SASS 7-1 architecture, compiled by Dart Sass |
| Data | IndexedDB — local-only, no backend needed |
| Build | esbuild (JS bundler + minifier), Dart Sass |
| Server | Node.js built-in `http` module — no Express |
| PWA | Service Worker, Web App Manifest, Web Notifications API |

---

## Getting Started

```bash
# Install dev dependencies (esbuild + Dart Sass)
npm install

# Development — watch SASS + JS and start server at http://localhost:3000
npm run dev

# Production build — compressed CSS + minified JS
npm run build
```

Open **http://localhost:3000**

---

## Project Structure

```
MeinApp/
├── public/                      # Everything served to the browser
│   ├── index.html               # App shell — 5-tab nav, FAB, modal root
│   ├── sw.js                    # Service Worker — cache-first, push notifications
│   ├── manifest.json            # PWA manifest (icons, shortcuts, display)
│   ├── css/
│   │   └── main.css             # Compiled CSS output (do not edit directly)
│   ├── js/
│   │   └── bundle.min.js        # Bundled + minified JS output (do not edit directly)
│   └── icons/
│       ├── icon-192.svg
│       └── icon-512.svg
│
├── src/
│   ├── js/                      # JS source — NOT served directly, bundled by esbuild
│   │   ├── app.js               # Entry point: SPA router, nav, FAB, SW registration
│   │   ├── db/
│   │   │   └── db.js            # IndexedDB wrapper — promise-based CRUD for all stores
│   │   ├── store/
│   │   │   └── store.js         # Minimal pub/sub state bus
│   │   ├── scheduler/
│   │   │   └── scheduler.js     # 60s interval reminder engine
│   │   ├── notifications/
│   │   │   └── notifications.js # Web Notifications API, Done/Snooze relay
│   │   └── views/
│   │       ├── dashboard.js     # Home view — upcoming events, list/calendar toggle
│   │       ├── calendar.js      # Calendar view + shared showAddEventModal()
│   │       ├── routines.js      # Routines view — events filtered by category
│   │       ├── history.js       # History log + Insights tab
│   │       ├── settings.js      # Settings — theme, notifications, export/import
│   │       ├── logModal.js      # Shared Add/Edit event modal (used by history)
│   │       └── toast.js         # In-app toast notifications
│   │
│   └── scss/                    # SASS source — 7-1 architecture
│       ├── main.scss            # Entry point — imports all partials
│       ├── utilities/           # _tokens.scss (design tokens), _variables.scss (CSS vars)
│       ├── base/                # _reset.scss, _typography.scss
│       ├── components/          # _button, _card, _badge, _form, _modal, _toast, _toggle
│       ├── layout/              # _shell.scss (bottom nav, header, app layout)
│       ├── pages/               # _dashboard, _calendar, _history, _settings
│       └── themes/              # _dark.scss
│
├── server/
│   └── server.js                # Static file server — SPA fallback, 404 for assets
│
└── docs/
    ├── Notification_Tracking_App_Spec.pdf   # Original product spec
    └── PROJECT_LOG.md           # Architecture decisions + session changelog
```

---

## Data Model

All user-created content lives in **one store: `events`** in IndexedDB.

```js
// Event object shape
{
  id:             'event_1234567890',
  title:          'Morning Skincare',
  category:       'beauty',           // 'beauty' | 'therapy' | 'general' | 'personal'
  color:          '#7C3AED',          // hex — shown as dot in calendar grid
  type:           'recurring',        // 'oneTime' | 'recurring'

  // oneTime only:
  date:           '2026-03-05',       // ISO date string

  // recurring only:
  startDate:      '2026-03-01',
  endDate:        null,               // optional cutoff
  recurrence: {
    interval:     'weekly',           // 'daily' | 'weekly' | 'monthly'
    days:         [1, 3, 5],          // days of week (0=Sun) — weekly only
    dayOfMonth:   null,               // monthly only
  },

  time:           '08:00',            // optional
  notes:          'Use SPF 50',       // optional
  completedDates: [],                 // ISO dates marked done
}
```

**Other IndexedDB stores** (legacy / scheduler use):

| Store | Purpose |
|-------|---------|
| `reminders` | Scheduler engine — tracks nextTrigger timestamps for notifications |
| `routines` | Legacy (no longer written to by UI — superseded by `events`) |
| `therapy` | Legacy (no longer written to by UI — superseded by `events`) |
| `logs` | Legacy (no longer written to by UI — superseded by `events`) |

---

## npm Scripts

| Script | What it does |
|--------|-------------|
| `npm run dev` | `watch:css` + `watch:js` (unminified) + `serve` — all in parallel |
| `npm run build` | Compressed CSS + minified JS bundle for production |
| `npm run build:css` | Dart Sass compile only |
| `npm run build:js` | esbuild bundle only |
| `npm run serve` | Start Node.js server only (port 3000) |
| `npm run watch:css` | Dart Sass in watch mode |
| `npm run watch:js` | esbuild in watch mode (no minify) |

---

## Security Model

| Concern | Approach |
|---------|---------|
| JS source exposure | `src/js/` never served — only `public/js/bundle.min.js` is accessible |
| Source readability | esbuild minifies — production bundle is not human-readable |
| Source maps | Disabled in production build |
| Missing assets | Server returns `404` for any `.js`/`.css` request that doesn't match a real file |
| Secrets | No secrets in code. No backend, no API keys. |

---

## Design System

- **Primary color:** `#7C3AED` (violet)
- **Secondary:** `#EC4899` (pink)
- **Spacing grid:** 4px base (`$space-1` = 4px … `$space-12` = 48px)
- **Themes:** Light (default) + Dark — toggled via `data-theme` attribute on `<html>`
- **Typography scale:** xs(11px) → sm(13px) → base(16px) → lg(20px) → xl(24px)
- **Border radius:** sm(4px), md(8px), lg(12px), full(9999px)

---

## Roadmap

| Priority | Feature |
|---------|---------|
| 🔜 Soon | Edit existing events (tap event → edit modal) |
| 🔜 Soon | Mark recurring event occurrence as "done" for today |
| 💡 Later | Streak tracking based on completed recurring events |
| 💡 Later | Calendar heatmap view (contribution graph style) |
| 💡 Later | Push notifications via external server (Railway/Render) |
| 💡 Later | CSV export in addition to JSON |
| 💡 Later | Replace SVG icons with PNG for full PWA install support |
