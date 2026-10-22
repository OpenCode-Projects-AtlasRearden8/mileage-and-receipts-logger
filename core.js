/* Mileage & Receipts Logger — core logic
 * Pure functions only: no DOM, no localStorage. Used by the web app (window.MRL)
 * and by the automated tests (node --test) via CommonJS.
 *
 * Made by Asdale Dynamics, LLC. MIT License.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MRL = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  var CATEGORIES = [
    'Fuel & Vehicle',
    'Office Supplies',
    'Software & Subscriptions',
    'Meals & Travel',
    'Equipment',
    'Advertising & Marketing',
    'Postage & Shipping',
    'Professional Services',
    'Other'
  ];

  // Known IRS business standard mileage rates (cents per mile), in effect ranges.
  // Update this table each time the IRS announces a new rate (irs.gov).
  var IRS_RATES = [
    { from: '2026-01-01', to: '2026-06-30', rate: 0.725 },
    { from: '2026-07-01', to: '2026-12-31', rate: 0.76 },
    { from: '2025-01-01', to: '2025-12-31', rate: 0.7 },
    { from: '2024-01-01', to: '2024-12-31', rate: 0.67 }
  ];

  var DEFAULT_SETTINGS = { defaultRate: 0.76, businessName: '' };

  function round2(n) {
    var x = Number(n);
    if (!isFinite(x)) return x;
    return Number(x.toFixed(2));
  }

  function currency(n) {
    var v = round2(Number(n) || 0);
    var s = Math.abs(v).toFixed(2);
    var parts = s.split('.');
    var whole = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (v < 0 ? '-$' : '$') + whole + '.' + parts[1];
  }

  function uid() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
  }

  // Normalize a date-ish value to 'YYYY-MM-DD', or return undefined.
  function parseDate(raw) {
    if (raw === null || raw === undefined) return undefined;
    var s = String(raw).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return undefined;
    var y = Number(m[1]);
    var mo = Number(m[2]);
    var d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return undefined;
    var dt = new Date(y, mo - 1, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d) return undefined;
    return s;
  }

  function monthKey(dateStr) {
    var d = parseDate(dateStr);
    if (!d) return undefined;
    return d.slice(0, 7);
  }

  function monthLabel(key) {
    var m = /^(\d{4})-(\d{2})$/.exec(String(key || ''));
    if (!m) return '';
    var idx = Number(m[2]) - 1;
    if (idx < 0 || idx > 11) return '';
    return MONTHS[idx] + ' ' + m[1];
  }

  // Parse a money or miles string like '12.50', '$12.50', '1,250.75' -> number.
  // Rates keep their full precision (0.725 stays 0.725).
  function parseAmount(raw) {
    if (raw === null || raw === undefined) return undefined;
    var s = String(raw).trim();
    if (s.charAt(0) === '$') s = s.slice(1);
    var plain = /^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s);
    var grouped = /^\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s);
    if (!plain && !grouped) return undefined;
    var n = Number(s.replace(/,/g, ''));
    return isFinite(n) ? n : undefined;
  }

  // Rates actually scheduled by the IRS for a trip date; undefined if unknown.
  function scheduledRate(dateStr) {
    var d = parseDate(dateStr);
    if (!d) return undefined;
    for (var i = 0; i < IRS_RATES.length; i++) {
      var r = IRS_RATES[i];
      if (d >= r.from && d <= r.to) return r.rate;
    }
    return undefined;
  }

  function suggestRate(dateStr, defaultRate) {
    var r = scheduledRate(dateStr);
    if (r !== undefined) return r;
    return typeof defaultRate === 'number' && isFinite(defaultRate) ? defaultRate : undefined;
  }

  function tripCost(miles, rate) {
    var m = parseAmount(miles);
    var r = parseAmount(rate);
    if (m === undefined || r === undefined) return undefined;
    if (m < 0 || r < 0) return undefined;
    return round2(m * r);
  }

  function tripTotal(trip) {
    if (!trip) return undefined;
    return tripCost(trip.miles, trip.rate);
  }

  function receiptTotal(receipt) {
    if (!receipt) return undefined;
    var a = parseAmount(receipt.amount);
    return a === undefined || a < 0 ? undefined : a;
  }

  function validateTrip(trip) {
    var errors = [];
    if (!trip || typeof trip !== 'object') return { ok: false, errors: ['Entry is missing.'] };
    var date = parseDate(trip.date);
    if (!date) errors.push('Enter a valid date (YYYY-MM-DD).');
    var miles = parseAmount(trip.miles);
    if (miles === undefined || miles <= 0) errors.push('Enter miles driven as a number greater than 0.');
    var rate = parseAmount(trip.rate);
    if (rate === undefined || rate <= 0) errors.push('Enter the mileage rate (like 0.76 for 76 cents per mile).');
    if (!String(trip.purpose || '').trim()) errors.push('Add the purpose of the trip.');
    return { ok: errors.length === 0, errors: errors };
  }

  function validateReceipt(receipt) {
    var errors = [];
    if (!receipt || typeof receipt !== 'object') return { ok: false, errors: ['Entry is missing.'] };
    var date = parseDate(receipt.date);
    if (!date) errors.push('Enter a valid date (YYYY-MM-DD).');
    var amount = parseAmount(receipt.amount);
    if (amount === undefined || amount <= 0) errors.push('Enter an amount greater than 0.');
    if (!String(receipt.vendor || '').trim()) errors.push("Add the vendor (who you paid).");
    var cat = String(receipt.category || '').trim();
    if (!cat || CATEGORIES.indexOf(cat) === -1) errors.push('Pick a category.');
    return { ok: errors.length === 0, errors: errors };
  }

  // Build monthly summaries from combined trips and receipts.
  // Returns [{ key, label, tripCount, totalMiles, mileageAmount,
  //            receiptCount, receiptTotal, grandTotal, categories: {name: total} }]
  function summarize(trips, receipts) {
    var byMonth = {};
    var addTrip = function (t) {
      if (!t || typeof t !== 'object') return;
      var k = monthKey(t.date);
      if (!k || tripTotal(t) === undefined) return;
      var row = byMonth[k] || (byMonth[k] = newMonth(k));
      row.tripCount += 1;
      row.totalMiles = round2(row.totalMiles + parseAmount(t.miles));
      row.mileageAmount = round2(row.mileageAmount + tripTotal(t));
    };
    var addReceipt = function (r) {
      if (!r || typeof r !== 'object') return;
      var k = monthKey(r.date);
      var amt = receiptTotal(r);
      if (!k || amt === undefined) return;
      var row = byMonth[k] || (byMonth[k] = newMonth(k));
      row.receiptCount += 1;
      row.receiptTotal = round2(row.receiptTotal + amt);
      var cat = String(r.category || 'Other');
      row.categories[cat] = round2((row.categories[cat] || 0) + amt);
    };
    (Array.isArray(trips) ? trips : []).forEach(addTrip);
    (Array.isArray(receipts) ? receipts : []).forEach(addReceipt);
    return Object.keys(byMonth).sort().map(function (k) {
      var row = byMonth[k];
      row.grandTotal = round2(row.mileageAmount + row.receiptTotal);
      return row;
    });

    function newMonth(key) {
      return {
        key: key,
        label: monthLabel(key),
        tripCount: 0,
        totalMiles: 0,
        mileageAmount: 0,
        receiptCount: 0,
        receiptTotal: 0,
        grandTotal: 0,
        categories: {}
      };
    }
  }

  function csvEscape(value) {
    var s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(headers, rows) {
    var lines = [headers.map(csvEscape).join(',')];
    rows.forEach(function (row) {
      lines.push(Array.from(row).map(csvEscape).join(','));
    });
    return lines.join('\r\n') + '\r\n';
  }

  function tripsToCSV(trips) {
    return toCSV(
      ['Date', 'Purpose', 'From', 'To', 'Miles', 'Rate', 'Cost'],
      (Array.isArray(trips) ? trips : []).map(function (t) {
        return [
          t.date,
          t.purpose,
          t.from || '',
          t.to || '',
          parseAmount(t.miles),
          parseAmount(t.rate),
          tripTotal(t)
        ];
      })
    );
  }

  function receiptsToCSV(receipts) {
    return toCSV(
      ['Date', 'Vendor', 'Category', 'Amount', 'Notes'],
      (Array.isArray(receipts) ? receipts : []).map(function (r) {
        return [r.date, r.vendor, r.category, receiptTotal(r), r.notes || ''];
      })
    );
  }

  // One combined file: mileage + receipts in a single CSV, sorted by date.
  function combinedToCSV(trips, receipts) {
    var rows = [];
    (Array.isArray(trips) ? trips : []).forEach(function (t) {
      rows.push([
        t.date, 'Mileage', t.purpose, t.from || '', t.to || '',
        parseAmount(t.miles), parseAmount(t.rate), '', tripTotal(t)
      ]);
    });
    (Array.isArray(receipts) ? receipts : []).forEach(function (r) {
      rows.push([
        r.date, 'Receipt', r.vendor, '', '', '', '', r.category, receiptTotal(r)
      ]);
    });
    rows.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
    return toCSV(
      ['Date', 'Type', 'Description', 'From', 'To', 'Miles', 'Rate', 'Category', 'Total'],
      rows
    );
  }

  // Clearly labeled fictional sample data, so beginners can see the app working.
  function sampleData() {
    var trips = [
      {
        id: uid(), date: '2026-10-05', purpose: 'Post office pickup', from: 'Home', to: 'US Post Office',
        miles: 8, rate: 0.76
      },
      {
        id: uid(), date: '2026-10-12', purpose: 'Client meeting', from: 'Home', to: 'Downtown Coffee Shop',
        miles: 14, rate: 0.76
      },
      {
        id: uid(), date: '2026-09-18', purpose: 'Office supply run', from: 'Home', to: 'Sample Supply Store',
        miles: 6, rate: 0.76
      }
    ];
    var receipts = [
      { id: uid(), date: '2026-10-03', vendor: 'Sample Print Shop', category: 'Office Supplies', amount: 32.4, notes: 'SAMPLE DATA' },
      { id: uid(), date: '2026-10-09', vendor: 'Sample Fuel Stop', category: 'Fuel & Vehicle', amount: 41.15, notes: 'SAMPLE DATA' },
      { id: uid(), date: '2026-09-22', vendor: 'Sample Software Co', category: 'Software & Subscriptions', amount: 12.99, notes: 'SAMPLE DATA' }
    ];
    return { trips: trips, receipts: receipts };
  }

  return {
    MONTHS: MONTHS,
    CATEGORIES: CATEGORIES,
    IRS_RATES: IRS_RATES,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS,
    round2: round2,
    currency: currency,
    uid: uid,
    parseDate: parseDate,
    parseAmount: parseAmount,
    monthKey: monthKey,
    monthLabel: monthLabel,
    scheduledRate: scheduledRate,
    suggestRate: suggestRate,
    tripCost: tripCost,
    tripTotal: tripTotal,
    receiptTotal: receiptTotal,
    validateTrip: validateTrip,
    validateReceipt: validateReceipt,
    summarize: summarize,
    csvEscape: csvEscape,
    toCSV: toCSV,
    tripsToCSV: tripsToCSV,
    receiptsToCSV: receiptsToCSV,
    combinedToCSV: combinedToCSV,
    sampleData: sampleData
  };
});
