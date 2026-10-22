# Mileage & Receipts Logger

A friendly, **local-first** mileage and receipt logger for small businesses, side hustles, and busy humans. Open the page, type in your trips and receipts, see your monthly totals, export a CSV for your bookkeeper (or your future self at tax time).

Built and maintained by **Asdale Dynamics, LLC** — the same folks behind [The Massive AI Manual](https://dylanasdale.github.io), explained "like a friend would."

- No accounts. No internet needed after opening. No cloud.
- Your data lives inside **this browser, on this computer** (browser `localStorage`).
- Trips store the **mileage rate applied** (IRS-style, user-editable), receipts store **category + amount**.
- Monthly summary, year-at-a-glance table, print-ready report, CSV export.

---

## Quick start (no experience needed)

### 1. Get the app onto your computer
If you have this folder downloaded already, skip to step 2. Otherwise:

- **Option A — download:** On the GitHub page, click **Code → Download ZIP**, then unzip it anywhere you like (Documents is fine).
- **Option B — clone (a little more techy):** Open a terminal and run:
  ```bash
  git clone <repo-url>
  ```

### 2. Open it
Double-click `index.html`. It opens in your web browser (Chrome, Firefox, Edge, Safari — any of them). That's the whole app. There is nothing to install.

> **First time in Windows File Explorer?** Right-click `index.html` → *Open with* → pick your browser.

### 3. Log your first trip
1. Click the **Trips** tab.
2. Enter the date, what the drive was for, and the miles driven.
3. The **rate is filled in automatically** using the IRS standard rate that was in effect that date. You can type a different rate — every field is editable.
4. Click **Add trip**. You'll see it appear in the table (with a running total).

### 4. Log your first receipt
1. Click **Receipts**.
2. Date, vendor, amount, and a category (Office Supplies, Fuel & Vehicle, and so on).
3. Click **Add receipt**.

### 5. See your month
Click **Summary**. You get:
- Six stat cards: trips, miles, mileage dollars, receipt count, receipt dollars, and the month total.
- Receipts broken down **by category**.
- A **year at a glance** table with an all-time total. Pick any month from the dropdown.

### 6. Back it up
Two easy options (life admin tip: do this monthly, maybe with Starbucks in hand):
- **CSV exports** — on the Summary tab: *CSV: trips*, *CSV: receipts*, or *CSV: everything*. Open them in Excel, Numbers, Google Sheets, or send them to your accountant.
- **JSON backup** — on the Settings tab, click *Download JSON backup* for a full snapshot.

### 7. Print a clean report
On **Summary**, pick the month, then open the **Print View** tab and click *Print this report*. Print it, save it as a PDF, or keep a paper folder. That's paperwork you don't have to think about anymore.

---

## Try it without your own data

On **Settings**, click **Load sample data**. It adds a few clearly-labeled entries marked `SAMPLE DATA` so you can click around risk-free. Delete them whenever you like (or hit **Erase all data** to start clean).

---

## About the mileage rate

The app fills in the IRS **standard business mileage rate** based on each trip's date:

| Effective period | Business rate |
| --- | --- |
| Jan 1 – Jun 30, 2026 | 72.5¢ per mile |
| Jul 1 – Dec 31, 2026 | 76¢ per mile |
| Calendar 2025 | 70¢ per mile |
| Calendar 2024 | 67¢ per mile |

For dates outside this table, the app uses the default rate from **Settings**. The IRS usually announces new rates each December at [irs.gov](https://www.irs.gov/tax-professionals/standard-mileage-rates) — when they do, update the default in Settings (and, if you're comfortable, add a row to the `IRS_RATES` table in `core.js`).

> **Honest note:** this app is a calculator and a notebook — **not tax advice**. Rules change and everyone's situation differs. Check with a tax professional when it matters.

---

## How it works (under the hood)

```
index.html    ← the whole app: open this one file
app.js        ← app wiring (forms, lists, tabs, print, settings)
core.js       ← the math: mileage totals, summaries, CSV, validation
styles.css    ← looks (including a print stylesheet)
```

- **Trips** store: date, purpose, from/to, miles, and **the rate used** — so an old trip always recalculates with its own rate.
- **Receipts** store: date, vendor, category, amount, notes.
- **Everything** is saved to `localStorage` under the key `mileage-receipts-logger-v1`, every time you add, edit, or delete.
- **CSV files** are properly escaped (commas, quotes, and newlines all handled) and open cleanly in spreadsheets.
- Works fully offline once opened. On `file://` pages, data is tied to the browser profile on the machine where you opened it.

## Privacy

- Nothing is uploaded, tracked, or teleported anywhere. There is no backend to breach.
- No cookies, no analytics, no personal data — the only storage is `localStorage` on your own computer.

## For developers: tests

The math and formatting logic is tested with the built-in Node runner (no test framework to install):

```bash
npm install        # only installs jsdom for the browser-simulation tests
npm test
```

- `test/core.test.js` — rates, rounding, summaries, CSV escaping, validation (34 test cases total with the rest below)
- `test/wiring.test.js` — every DOM id used by the app exists in the HTML; no secrets in source
- `test/dom.test.js` — simulates a real browser with jsdom: adding, editing, deleting, exporting, printing

They all run with `npm test` and should pass. If you change `core.js`, the tests will tell you immediately if something broke.

## Ideas & roadmap (what this *isn't* yet)

- Import from CSV/JSON backup (export exists; import is on the list).
- Odometer start/end readings and auto-computed miles.
- Notes/photos of receipts (photos would still be stored locally).
- Multiple vehicles.

Everything here is MIT licensed — see `LICENSE`.

---

**Copyright (c) 2026 Asdale Dynamics, LLC.** Made with care by Dylan Asdale for folks doing their own bookkeeping — plain English, step by step, never condescending.
