'use strict';
const test = require('node:test');
const assert = require('node:assert');
const MRL = require('../core.js');

test('round2 and currency formatting', () => {
  assert.strictEqual(MRL.round2(0.1 + 0.2), 0.3);
  assert.strictEqual(MRL.currency(1234.5), '$1,234.50');
  assert.strictEqual(MRL.currency(0), '$0.00');
  assert.strictEqual(MRL.currency(-3.1), '-$3.10');
  assert.strictEqual(MRL.currency(9876543.219), '$9,876,543.22');
});

test('parseAmount handles plain numbers, $ signs, and commas', () => {
  assert.strictEqual(MRL.parseAmount('12.50'), 12.5);
  assert.strictEqual(MRL.parseAmount('$1,250.75'), 1250.75);
  assert.strictEqual(MRL.parseAmount(7), 7);
  assert.strictEqual(MRL.parseAmount(''), undefined);
  assert.strictEqual(MRL.parseAmount('abc'), undefined);
  assert.strictEqual(MRL.parseAmount('-4'), undefined);
  assert.strictEqual(MRL.parseAmount('1,000,'), undefined);
});

test('parseDate validates real calendar dates', () => {
  assert.strictEqual(MRL.parseDate('2026-10-05'), '2026-10-05');
  assert.strictEqual(MRL.parseDate('2026-02-29'), undefined);
  assert.strictEqual(MRL.parseDate('2026-13-01'), undefined);
  assert.strictEqual(MRL.parseDate('10/05/2026'), undefined);
  assert.strictEqual(MRL.parseDate(''), undefined);
  assert.strictEqual(MRL.parseDate(null), undefined);
});

test('monthKey and monthLabel', () => {
  assert.strictEqual(MRL.monthKey('2026-10-22'), '2026-10');
  assert.strictEqual(MRL.monthKey('not-a-date'), undefined);
  assert.strictEqual(MRL.monthLabel('2026-10'), 'October 2026');
  assert.strictEqual(MRL.monthLabel('banana'), '');
});

test('tripCost multiplies miles by rate and rounds to cents', () => {
  assert.strictEqual(MRL.tripCost(100, 0.725), 72.5);
  assert.strictEqual(MRL.tripCost(10, 0.76), 7.6);
  assert.strictEqual(MRL.tripCost('12.5', '0.76'), 9.5);
  assert.strictEqual(MRL.tripCost(10, 'free'), undefined);
  assert.strictEqual(MRL.tripCost(-5, 0.7), undefined);
});

test('tripTotal and receiptTotal read stored entries', () => {
  assert.strictEqual(MRL.tripTotal({ miles: 20, rate: 0.76 }), 15.2);
  assert.strictEqual(MRL.tripTotal(null), undefined);
  assert.strictEqual(MRL.receiptTotal({ amount: '32.40' }), 32.4);
  assert.strictEqual(MRL.receiptTotal({ amount: 'nope' }), undefined);
});

test('scheduledRate returns IRS rate in effect for a date', () => {
  assert.strictEqual(MRL.scheduledRate('2026-03-15'), 0.725);
  assert.strictEqual(MRL.scheduledRate('2026-07-01'), 0.76);
  assert.strictEqual(MRL.scheduledRate('2026-10-22'), 0.76);
  assert.strictEqual(MRL.scheduledRate('2025-01-10'), 0.7);
  assert.strictEqual(MRL.scheduledRate('1999-01-01'), undefined);
});

test('suggestRate falls back to the user default rate', () => {
  assert.strictEqual(MRL.suggestRate('2026-10-22', 0.5), 0.76);
  assert.strictEqual(MRL.suggestRate('2030-01-01', 0.55), 0.55);
  assert.strictEqual(MRL.suggestRate('garbage', 0.55), 0.55);
  assert.strictEqual(MRL.suggestRate('garbage', undefined), undefined);
});

test('validateTrip collects clear errors', () => {
  assert.deepStrictEqual(MRL.validateTrip({ date: '2026-10-01', miles: '10', rate: '0.76', purpose: 'Meeting' }).errors, []);
  const bad = MRL.validateTrip({ date: '2026-10-01' });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.errors.length, 3);
  assert.strictEqual(MRL.validateTrip(null).ok, false);
});

test('validateReceipt requires date, vendor, category, positive amount', () => {
  const good = MRL.validateReceipt({ date: '2026-10-01', amount: '9.99', vendor: 'Acme', category: 'Office Supplies' });
  assert.strictEqual(good.errors.length, 0);
  const bad = MRL.validateReceipt({ date: 'no', amount: '0', vendor: '', category: 'Made Up Category' });
  assert.strictEqual(bad.ok, false);
  assert.strictEqual(bad.errors.length, 4);
});

test('summarize combines trips and receipts by month with category totals', () => {
  const trips = [
    { date: '2026-10-01', miles: 10, rate: 0.76 },
    { date: '2026-10-02', miles: 40, rate: 0.76 },
    { date: '2026-09-03', miles: 10, rate: 0.725 }
  ];
  const receipts = [
    { date: '2026-10-05', vendor: 'A', category: 'Office Supplies', amount: 12.5 },
    { date: '2026-10-06', vendor: 'B', category: 'Office Supplies', amount: 7.5 },
    { date: '2026-10-07', vendor: 'C', category: 'Fuel & Vehicle', amount: 41.15 },
    { date: 'banana', vendor: 'X', category: 'Other', amount: 5 }
  ];
  const rows = MRL.summarize(trips, receipts);
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[1].key, '2026-10');
  const oct = rows[1];
  assert.strictEqual(oct.label, 'October 2026');
  assert.strictEqual(oct.tripCount, 2);
  assert.strictEqual(oct.totalMiles, 50);
  assert.strictEqual(oct.mileageAmount, MRL.round2(50 * 0.76));
  assert.strictEqual(oct.receiptCount, 3);
  assert.strictEqual(oct.receiptTotal, 61.15);
  assert.strictEqual(oct.categories['Office Supplies'], 20);
  assert.strictEqual(oct.categories['Fuel & Vehicle'], 41.15);
  assert.strictEqual(oct.grandTotal, MRL.round2(oct.mileageAmount + 61.15));
  const sep = rows[0];
  assert.strictEqual(sep.receiptTotal, 0);
  assert.strictEqual(sep.mileageAmount, 7.25);
});

test('summarize tolerates empty or broken data', () => {
  assert.deepStrictEqual(MRL.summarize([], []), []);
  assert.deepStrictEqual(MRL.summarize(undefined), []);
  const rows = MRL.summarize([{ date: 'bad', miles: 1, rate: 1 }], [null]);
  assert.deepStrictEqual(rows, []);
});

test('csvEscape quotes fields with commas, quotes, and newlines', () => {
  assert.strictEqual(MRL.csvEscape('plain'), 'plain');
  assert.strictEqual(MRL.csvEscape('a,b'), '"a,b"');
  assert.strictEqual(MRL.csvEscape('say "hi"'), '"say ""hi"""');
  assert.strictEqual(MRL.csvEscape('line1\nline2'), '"line1\nline2"');
  assert.strictEqual(MRL.csvEscape(null), '');
  assert.strictEqual(MRL.csvEscape(12.5), '12.5');
});

test('toCSV builds stable CSV text', () => {
  const csv = MRL.toCSV(['Name', 'Amount'], [['Coffee', '4.50'], ['Tea, whole', '7.25']]);
  assert.strictEqual(csv, 'Name,Amount\r\nCoffee,4.50\r\n"Tea, whole",7.25\r\n');
});

test('tripsToCSV escapes purposes and computes cost column', () => {
  const csv = MRL.tripsToCSV([{ date: '2026-10-01', purpose: 'Meeting, downtown', from: 'Home', to: 'City', miles: 10, rate: 0.76 }]);
  assert.match(csv, /"Meeting, downtown"/);
  assert.ok(csv.endsWith(',7.6\r\n'));
});

test('receiptsToCSV and combinedToCSV produce expected columns', () => {
  const rcsv = MRL.receiptsToCSV([{ date: '2026-10-05', vendor: 'Sample', category: 'Other', amount: 3, notes: 'a "note"' }]);
  assert.match(rcsv, /Date,Vendor,Category,Amount,Notes/);
  assert.match(rcsv, /"a ""note"""/);
  const ccsv = MRL.combinedToCSV(
    [{ date: '2026-10-02', purpose: 'Trip', miles: 10, rate: 0.76 }],
    [{ date: '2026-10-01', vendor: 'Vend', category: 'Other', amount: 3 }]
  );
  const lines = ccsv.trim().split('\r\n');
  assert.strictEqual(lines.length, 3);
  assert.strictEqual(lines[0], 'Date,Type,Description,From,To,Miles,Rate,Category,Total');
  assert.match(lines[1], /Receipt/);
  assert.match(lines[2], /Mileage/);
});

test('sampleData has complete, valid entries marked as sample', () => {
  const { trips, receipts } = MRL.sampleData();
  assert.ok(trips.length >= 1 && receipts.length >= 1);
  for (const t of trips) {
    assert.strictEqual(MRL.validateTrip(t).errors.length, 0, JSON.stringify(t));
    assert.ok(MRL.tripTotal(t) > 0);
  }
  for (const r of receipts) {
    assert.strictEqual(MRL.validateReceipt(r).errors.length, 0, JSON.stringify(r));
    assert.strictEqual(r.notes, 'SAMPLE DATA');
  }
});

test('default settings expose an editable mileage rate', () => {
  assert.strictEqual(typeof MRL.DEFAULT_SETTINGS.defaultRate, 'number');
  assert.ok(MRL.DEFAULT_SETTINGS.defaultRate > 0);
  assert.ok(Array.isArray(MRL.CATEGORIES) && MRL.CATEGORIES.length >= 5);
});
