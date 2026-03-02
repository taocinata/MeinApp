# Personal Notification & Activity Tracking App — Implementation Plan

## Problem Statement
Build a PWA-enabled, offline-first daily routines + reminders app using Vanilla JS, HTML, SASS, and a minimal Node.js server. No frontend frameworks. Based on `docs/Notification_Tracking_App_Spec.pdf`.

## Approach
Scaffold the project from scratch in `/Users/uzo7500/work/MeinApp/`, organized in 4 phases as defined in the spec.

---

## Project Structure (Scaffold)

```
MeinApp/
├── public/
│   ├── index.html
│   ├── manifest.json
│   ├── sw.js                    # Service Worker
│   ├── icons/                   # PWA icons (192, 512px)
│   └── css/
│       └── main.css             # Compiled from SASS
├── src/
│   ├── scss/                    # 7-1 SASS structure
│   │   ├── base/
│   │   ├── components/
│   │   ├── layout/
│   │   ├── pages/
│   │   ├── themes/
│   │   ├── utilities/
│   │   └── main.scss
│   └── js/
│       ├── db/
│       │   └── db.js            # IndexedDB wrapper
│       ├── store/
│       │   └── store.js         # App state
│       ├── scheduler/
│       │   └── scheduler.js     # Reminder engine
│       ├── notifications/
│       │   └── notifications.js
│       ├── views/
│       │   ├── dashboard.js
│       │   ├── history.js
│       │   └── settings.js
│       ├── analytics/
│       │   └── analytics.js
│       └── app.js               # Entry point
├── server/
│   └── server.js                # Minimal Node.js static server
├── docs/
│   └── Notification_Tracking_App_Spec.pdf
├── package.json
└── README.md
```

---

## Data Models (per spec)

- **Routine**: id, name, category, subcategory?, schedule{times, days}, history[], streak, tags[], notes
- **Therapy**: id, name, category, type, reminderTimes[], history[], observations[]
- **Log**: id, category, subcategory?, timestamp, notes, metadata
- **Reminder**: id, type, schedule, category, subcategory?, status, nextTrigger

---

## Phases & Todos

### Phase 1 — Core (MVP)
1. Project scaffold: `package.json`, folder structure, Node.js static server
2. SASS 7-1 structure + design tokens (colors, spacing, typography, themes)
3. `index.html` shell + basic navigation (dashboard, history, settings)
4. IndexedDB wrapper (`db.js`) — CRUD for all 4 models
5. App state / store module (`store.js`)
6. Reminder scheduler (`scheduler.js`) — cron-like, stores nextTrigger
7. `manifest.json` + PWA icons
8. Service Worker (`sw.js`) — offline cache + notification handling
9. Web Notifications API module — Done / Snooze actions

### Phase 2 — Routines & Therapy
10. Beauty routines UI — create/edit/view with schedule picker
11. Therapy reminders UI — custom times, treatment type
12. Streak engine — compute & display streaks
13. One-tap logging UI

### Phase 3 — Analytics
14. History view — filterable log list
15. Charts — SVG/Canvas streak & activity charts
16. Insights panel — summary stats

### Phase 4 — Polish & PWA
17. Full PWA installability testing
18. Sound notifications (optional)
19. JSON export / import
20. Light/dark theme toggle
21. README + developer docs

---

## Tech Stack Decision Points (to confirm)
- **SASS compiler**: Dart Sass via `npm` (`sass` package)
- **Build**: `npm run build` compiles SASS → `public/css/main.css`
- **Dev**: `npm run dev` watches SASS + starts Node.js server
- **Server**: Node.js built-in `http` module (no Express)
- **Testing**: None required at MVP (per spec)

---

## Open Questions (resolved after discussion)
- Start folder: `/Users/uzo7500/work/MeinApp/` (existing project root)
- Framework: Vanilla JS only (confirmed in spec)
- Phase start: Phase 1 first, then iterate
