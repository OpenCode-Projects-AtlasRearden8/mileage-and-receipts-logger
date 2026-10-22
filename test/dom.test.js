'use strict';
// End-to-end smoke test: load index.html in jsdom and drive the app like a user.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function bootDom() {
  const dom = new JSDOM(html, {
    url: 'https://localhost/',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
    beforeParse(window) {
      window.confirm = () => true;
      window.print = window.print || (() => {});
      window.URL.createObjectURL = () => 'blob:fake';
      window.URL.revokeObjectURL = () => {};
    }
  });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(root, 'core.js'), 'utf8'));
  window.eval(fs.readFileSync(path.join(root, 'app.js'), 'utf8'));
  return dom;
}

function submitForm(win, id) {
  const form = win.document.getElementById(id);
  const ev = new win.Event('submit', { bubbles: true, cancelable: true });
  form.dispatchEvent(ev);
}

test('app boots with trips tab active and empty states visible', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  assert.strictEqual(doc.getElementById('tab-trips').hidden, false);
  assert.strictEqual(doc.getElementById('trips-empty').hidden, false);
  assert.strictEqual(doc.getElementById('trips-table-card').classList.contains('hidden'), true);
  const cat = doc.getElementById('receipt-category');
  assert.ok(cat.options.length >= 5, 'categories populated');
});

test('add trip → row, totals, and localStorage persistence', () => {
  const dom = bootDom();
  const win = dom.window;
  const doc = win.document;
  doc.getElementById('trip-purpose').value = 'Post office run';
  doc.getElementById('trip-from').value = 'Home';
  doc.getElementById('trip-to').value = 'Post office';
  doc.getElementById('trip-miles').value = '10';
  doc.getElementById('trip-rate').value = '0.76';
  submitForm(win, 'trip-form');

  assert.strictEqual(doc.getElementById('trips-list').children.length, 1);
  assert.match(doc.getElementById('trips-total-cost').textContent, /7\.60/);
  const stored = JSON.parse(win.localStorage.getItem('mileage-receipts-logger-v1'));
  assert.strictEqual(stored.trips.length, 1);
  assert.strictEqual(stored.trips[0].miles, 10);
  assert.strictEqual(stored.trips[0].rate, 0.76);
});

test('invalid trip shows friendly errors, nothing saved', () => {
  const dom = bootDom();
  const win = dom.window;
  const doc = win.document;
  doc.getElementById('trip-miles').value = '0';
  submitForm(win, 'trip-form');
  const msg = doc.getElementById('trip-msg');
  assert.strictEqual(msg.hidden, false);
  assert.match(msg.textContent, /miles/i);
  const raw = win.localStorage.getItem('mileage-receipts-logger-v1');
  const stored = raw ? JSON.parse(raw) : { trips: [], receipts: [] };
  assert.strictEqual(stored.trips.length, 0);
});

test('add receipt with category → appears and summary shows totals', () => {
  const dom = bootDom();
  const win = dom.window;
  const doc = win.document;
  doc.getElementById('receipt-vendor').value = 'Sample Store';
  doc.getElementById('receipt-amount').value = '24.99';
  submitForm(win, 'receipt-form');
  assert.strictEqual(doc.getElementById('receipts-list').children.length, 1);
  assert.match(doc.getElementById('receipts-total-amount').textContent, /24\.99/);
  assert.strictEqual(JSON.parse(win.localStorage.getItem('mileage-receipts-logger-v1')).receipts.length, 1);
});

test('sample data loads; summary renders months and print view builds report', () => {
  const dom = bootDom();
  const win = dom.window;
  const doc = win.document;
  doc.getElementById('btn-sample').click();
  assert.strictEqual(JSON.parse(win.localStorage.getItem('mileage-receipts-logger-v1')).trips.length, 3);

  dom.window.document.getElementById('tabbtn-summary').click();
  assert.strictEqual(doc.getElementById('summary-empty').hidden, true);
  const months = Array.from(doc.getElementById('summary-month').options).map((o) => o.value);
  assert.ok(months.includes('2026-10') && months.includes('2026-09'), 'months from sample data');
  assert.ok(doc.getElementById('summary-month-cards').children.length >= 1);
  assert.ok(doc.getElementById('summary-ytd').children.length === 2, 'year table rows');

  doc.getElementById('tabbtn-print').click();
  assert.match(doc.getElementById('print-report').textContent, /report/);
  assert.match(doc.getElementById('print-report').textContent, /Month total/);
});

test('month picker changes summary cards', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('btn-sample').click();
  doc.getElementById('tabbtn-summary').click();
  const sel = doc.getElementById('summary-month');
  sel.value = '2026-09';
  sel.dispatchEvent(new dom.window.Event('change'));
  const cards = Array.from(doc.getElementById('summary-month-cards').children)
    .map((c) => c.textContent);
  let totalLabel = null;
  cards.forEach((text) => { if (/Month total/.test(text)) totalLabel = text; });
  assert.match(totalLabel, /\$/);
});

test('erase all clears data after confirmation', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('btn-sample').click();
  doc.getElementById('btn-erase').click();
  const stored = JSON.parse(dom.window.localStorage.getItem('mileage-receipts-logger-v1'));
  assert.strictEqual(stored.trips.length, 0);
  assert.strictEqual(stored.receipts.length, 0);
});

test('CSV export buttons produce downloads without crashing', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('btn-sample').click();
  assert.doesNotThrow(() => {
    doc.getElementById('export-trips').click();
    doc.getElementById('export-receipts').click();
    doc.getElementById('export-all').click();
  });
});

test('settings save updates default rate', () => {
  const dom = bootDom();
  const win = dom.window;
  const doc = win.document;
  doc.getElementById('settings-rate').value = '0.8';
  doc.getElementById('settings-name').value = 'Test Shop';
  submitForm(win, 'settings-form');
  const settings = JSON.parse(win.localStorage.getItem('mileage-receipts-logger-v1')).settings;
  assert.strictEqual(settings.defaultRate, 0.8);
  assert.strictEqual(settings.businessName, 'Test Shop');
});

test('delete removes a trip after confirmation', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('trip-miles').value = '10';
  doc.getElementById('trip-purpose').value = 'Disposable run';
  submitForm(dom.window, 'trip-form');
  assert.strictEqual(doc.getElementById('trips-list').children.length, 1);
  doc.querySelector('button[data-act="del-trip"]').click();
  const stored = JSON.parse(dom.window.localStorage.getItem('mileage-receipts-logger-v1'));
  assert.strictEqual(stored.trips.length, 0);
  assert.strictEqual(doc.getElementById('trips-list').children.length, 0);
  assert.strictEqual(doc.getElementById('trips-empty').hidden, false);
});

test('delete removes a receipt after confirmation', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('receipt-vendor').value = 'Sample Store';
  doc.getElementById('receipt-amount').value = '24.99';
  submitForm(dom.window, 'receipt-form');
  doc.querySelector('button[data-act="del-receipt"]').click();
  const stored = JSON.parse(dom.window.localStorage.getItem('mileage-receipts-logger-v1'));
  assert.strictEqual(stored.receipts.length, 0);
  assert.strictEqual(doc.getElementById('receipts-empty').hidden, false);
});

test('edit then update an existing trip works', () => {
  const dom = bootDom();
  const doc = dom.window.document;
  doc.getElementById('trip-miles').value = '10';
  doc.getElementById('trip-purpose').value = 'First run';
  doc.getElementById('trip-rate').value = '0.76';
  doc.getElementById('trip-date').value = doc.getElementById('trip-date').value || '2026-10-22';
  const tripForm = doc.getElementById('trip-form');
  tripForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const editBtn = doc.querySelector('button[data-act="edit-trip"]');
  assert.ok(editBtn, 'edit button rendered');
  editBtn.click();
  doc.getElementById('trip-miles').value = '20';
  tripForm.dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
  const stored = JSON.parse(dom.window.localStorage.getItem('mileage-receipts-logger-v1'));
  assert.strictEqual(stored.trips.length, 1);
  assert.strictEqual(stored.trips[0].miles, 20);
});
