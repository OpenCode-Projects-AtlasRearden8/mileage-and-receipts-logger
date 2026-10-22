# STATUS

**Project:** Mileage & Receipts Logger (local-first static web app)
**Owner/Maintainer:** Asdale Dynamics, LLC (Dylan Asdale)
**Date:** 2026-10-22
**License:** MIT

## What was built

A complete, offline-capable, single-page web app for small-business mileage and receipt
logging. Plain HTML/CSS/JavaScript — no backend, no build step, no accounts, no personal
data collected. All data lives in the browser's `localStorage` on the user's own machine.

Files:

| File | Role |
| --- | --- |
| `index.html` | The whole app. Open this file in a browser. |
| `app.js` | App wiring: forms, lists, tabs, settings, print view, CSV downloads |
| `core.js` | Pure logic (also usable in Node): mileage math, IRS rate table, monthly summaries, CSV escaping, validation, sample data |
| `styles.css` | Styling, including a dedicated print stylesheet |
| `test/core.test.js` | Unit tests for all core logic (node --test) |
| `test/wiring.test.js` | Static checks: every DOM id used by app.js exists in index.html; script order; secret scanning |
| `test/dom.test.js` | Full-app simulation in jsdom: add/edit/delete, summary, print view, exports, settings |
| `README.md` | Beginner-friendly instructions |
| `LICENSE` | MIT, `Copyright (c) 2026 Asdale Dynamics, LLC` |
| `package.json` | Test script + metadata (only dev dependency: jsdom for DOM tests) |

Features:

- **Trips** — date, purpose, from/to, miles, and a per-trip, user-editable mileage rate.
  Rate auto-fills from the IRS business standard rate in effect for the trip's date
  (2026: 72.5¢/mile Jan–Jun, 76¢/mile Jul–Dec; 2025: 70¢; 2024: 67¢), per the IRS
  mid-year 2026 update. Every trip keeps its own rate forever, so old months recalculate
  correctly. Edit + delete supported.
- **Receipts** — date, vendor, amount, category (9 categories), notes. Edit + delete.
- **Monthly summary** — six stat cards per month, receipts broken down by category, and a
  "year at a glance" table with an all-time total row. Month picker across all months
  that contain data.
- **Print view** — clean report layout (business name, trips table, receipts table,
  totals) with @media print rules hiding app chrome. Includes Ctrl/Cmd+P support.
- **CSV export** — trips, receipts, or a combined file; RFC-safe escaping (commas, quotes,
  newlines). Plus a full **JSON backup** download.
- **Settings** — default rate, business name (shown on print reports), sample-data
  loader (entries clearly marked `SAMPLE DATA`), and a double-confirmed erase-all.
- **Beginner-friendly Help tab** and step-by-step README written in the LLC's plain-
  English style.
- Input validation with friendly inline errors; everything saved to `localStorage`
  (`mileage-receipts-logger-v1`) on every change.

## How to run

- **Use it:** double-click `index.html` in any modern browser (works fully offline after opening).
- **Serve it (optional):** `python3 -m http.server` then visit `http://localhost:8000`.
- **Test it:** `npm install` (installs jsdom only, for DOM tests) then `npm test`.

## Verification results (2026-10-22)

- `npm test` → **36/36 tests pass** (18 core logic + 5 wiring + 13 DOM simulation), 0 fail.
  - Core: rate table, rounding, currency formatting, date/month parsing, validation
    errors, monthly summaries incl. category totals, CSV escaping (commas/quotes/newlines),
    sample-data integrity, fallback rate behavior.
  - Wiring: DOM ids referenced by app.js all exist in index.html; core.js loads before
    app.js; print rules present; regex secret scan across source files.
  - DOM (jsdom): boot/empty states; add trip → row, totals, persisted to localStorage;
    invalid input rejected with friendly errors; add receipt; sample data; summary
    months + year table; month picker re-renders cards; print report content; CSV export
    clicks; settings save; edit-and-update trip; delete trip/receipt.
- `node --check core.js`, `node --check app.js` → syntax OK.
- One real bug found and fixed during verification: `round2` originally used
  `Math.round((n + Number.EPSILON) * 100) / 100`, which misrounded 0.725 → 0.73
  (EPSILON is ~2 ulps at that magnitude) and would have corrupted per-mile rates.
  Replaced with a `toFixed(2)`-based implementation; `parseAmount` no longer rounds
  rates, preserving 0.725 exactly. Covered by tests now.
- Manual smoke: all 36 tests run against the real `index.html` markup in jsdom, which
  exercises the actual page the user opens.

## Known gaps / future work

- **No import yet** — CSV/JSON export exists; restoring a JSON backup requires manual
  editing of localStorage or a future Import button (roadmap item).
- **Rate table spans 2024–mid-2026 only.** Dates outside it fall back to the Settings
  default (still fully editable per trip). The README documents how to add new IRS rates.
- **No odometer start/end readings** — miles are entered directly; auto-computed distance
  is a roadmap item.
- **English only; USD-only formatting.**
- localStorage is per browser + per machine profile; multi-device sync is out of scope
  by design (local-first). JSON backup mitigates.
- Receipt photos would need IndexedDB or file-handle APIs; not attempted.
- No service-worker/offline caching manifest (the page works offline once saved locally;
  a PWA wrapper is easy future work).
