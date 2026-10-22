/* Mileage & Receipts Logger — app wiring
 * Talks to the DOM and localStorage; all math/CSV/summary logic lives in core.js (window.MRL).
 * Made by Asdale Dynamics, LLC. MIT License.
 */
(function () {
  'use strict';

  var MRL = window.MRL;
  var STORAGE_KEY = 'mileage-receipts-logger-v1';

  var state = loadState();

  function loadState() {
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var saved = JSON.parse(raw);
        var st = {
          trips: Array.isArray(saved.trips) ? saved.trips : [],
          receipts: Array.isArray(saved.receipts) ? saved.receipts : [],
          settings: Object.assign({}, MRL.DEFAULT_SETTINGS, saved.settings)
        };
        return st;
      }
    } catch (e) {
      toast('Could not read saved data — starting fresh.');
    }
    return { trips: [], receipts: [], settings: Object.assign({}, MRL.DEFAULT_SETTINGS) };
  }

  function saveState() {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      toast('Saving failed. Is private browsing on? Export a CSV backup.');
    }
  }

  function $(id) {
    return document.getElementById(id);
  }

  function el(tag, className) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  var toastTimer = null;
  function toast(msg) {
    var box = $('toast');
    box.textContent = msg;
    box.hidden = false;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.hidden = true; }, 2800);
  }

  function showMsg(id, msgs, ok) {
    var box = $(id);
    if (!msgs || !msgs.length) {
      box.hidden = true;
      return;
    }
    box.textContent = (ok ? 'Saved ✓ ' : 'Not saved — ') + msgs.join(' · ');
    box.classList.toggle('msg-ok', !!ok);
    box.classList.toggle('msg-bad', !ok);
    box.hidden = false;
  }

  function todayISO() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  function selectedMonth() {
    return $('summary-month').value || MRL.monthKey(todayISO()) || '';
  }

  /* ---------------- tabs ---------------- */

  function switchTab(name) {
    var tabs = document.querySelectorAll('.tab-btn');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('active', tabs[i].getAttribute('data-tab') === name);
    }
    var panels = document.querySelectorAll('.tab');
    for (var j = 0; j < panels.length; j++) {
      panels[j].hidden = panels[j].id !== 'tab-' + name;
    }
    if (name === 'summary') renderSummary();
    if (name === 'print') renderPrint();
  }

  document.querySelectorAll('.tab-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      if (dirtyForms()) {
        if (!window.confirm('You started typing an entry that is not saved yet. Leave anyway?')) return;
      }
      switchTab(btn.getAttribute('data-tab'));
    });
  });

  function dirtyForms() {
    return Boolean(
      ($('trip-purpose').value.trim() || $('trip-miles').value.trim()) ||
      ($('receipt-vendor').value.trim() || $('receipt-amount').value.trim())
    );
  }

  /* ---------------- trips ---------------- */

  function fillTripRate() {
    var suggested = MRL.suggestRate($('trip-date').value, state.settings.defaultRate);
    if (suggested !== undefined) $('trip-rate').value = suggested;
  }

  function renderTrips() {
    var list = $('trips-list');
    list.textContent = '';
    var trips = state.trips.slice().sort(sortByDateDesc);
    var empty = $('trips-empty').classList;
    var table = $('trips-table-card').classList;
    if (!trips.length) {
      empty.remove('hidden'); table.add('hidden');
      refreshFooter();
      return;
    }
    empty.add('hidden'); table.remove('hidden');

    var totalMiles = 0;
    var totalCost = 0;
    trips.forEach(function (trip) {
      var cost = MRL.tripTotal(trip);
      var row = el('tr');
      row.appendChild(td(trip.date));
      row.appendChild(td(trip.purpose));
      row.appendChild(td((trip.from || '—') + ' → ' + (trip.to || '—')));
      row.appendChild(td(MRL.parseAmount(trip.miles), 'num'));
      row.appendChild(td('$' + MRL.parseAmount(trip.rate), 'num'));
      row.appendChild(td(MRL.currency(cost), 'num'));
      var actions = td('', 'num actions no-print');
      var editBtn = el('button', 'btn-small');
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-act', 'edit-trip');
      editBtn.setAttribute('data-id', trip.id);
      var delBtn = el('button', 'btn-small btn-danger');
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('data-act', 'del-trip');
      delBtn.setAttribute('data-id', trip.id);
      actions.appendChild(editBtn);
      actions.appendChild(el('span', 'gap'));
      actions.appendChild(delBtn);
      row.appendChild(actions);
      list.appendChild(row);

      if (MRL.tripTotal(trip) !== undefined) {
        totalMiles = MRL.round2(totalMiles + MRL.parseAmount(trip.miles));
        totalCost = MRL.round2(totalCost + cost);
      }
    });
    $('trips-total-miles').textContent = totalMiles;
    $('trips-total-cost').textContent = MRL.currency(totalCost);
    refreshFooter();
  }

  function sortByDateDesc(a, b) {
    var ka = MRL.parseDate(a && a.date);
    var kb = MRL.parseDate(b && b.date);
    if (!ka && !kb) return 0;
    if (!ka) return 1;
    if (!kb) return -1;
    if (ka === kb) return String(a.id) < String(b.id) ? -1 : 1;
    return ka < kb ? 1 : -1;
  }

  function td(text, className) {
    var cell = el('td', className);
    cell.textContent = text;
    return cell;
  }

  function resetTripForm() {
    $('trip-form').reset();
    $('trip-date').value = todayISO();
    fillTripRate();
    editing.trip = null;
    $('trip-submit').textContent = 'Add trip';
    $('trip-cancel-edit').hidden = true;
    showMsg('trip-msg', null);
  }

  $('trip-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var wasEdit = !!editing.trip;
    var trip = {
      id: editing.trip || MRL.uid(),
      date: $('trip-date').value,
      purpose: $('trip-purpose').value.trim(),
      from: $('trip-from').value.trim(),
      to: $('trip-to').value.trim(),
      miles: $('trip-miles').value.trim(),
      rate: $('trip-rate').value.trim()
    };
    var check = MRL.validateTrip(trip);
    if (!check.ok) {
      showMsg('trip-msg', check.errors, false);
      return;
    }
    trip.miles = MRL.parseAmount(trip.miles);
    trip.rate = MRL.parseAmount(trip.rate);
    if (wasEdit) {
      var idx = state.trips.findIndex(function (t) { return t.id === trip.id; });
      if (idx !== -1) state.trips[idx] = trip; else state.trips.push(trip);
    } else {
      state.trips.push(trip);
    }
    saveState();
    resetTripForm();
    renderTrips();
    renderSummarySilently();
    showMsg('trip-msg', [wasEdit ? 'Trip updated.' : 'Trip added!'], true);
    toast('Trip saved ✓');
  });

  $('trip-cancel-edit').addEventListener('click', resetTripForm);
  $('trip-date').addEventListener('change', fillTripRate);

  /* ---------------- receipts ---------------- */

  function renderReceipts() {
    var list = $('receipts-list');
    list.textContent = '';
    var receipts = state.receipts.slice().sort(sortByDateDesc);
    var empty = $('receipts-empty').classList;
    var table = $('receipts-table-card').classList;
    if (!receipts.length) {
      empty.remove('hidden'); table.add('hidden');
      refreshFooter();
      return;
    }
    empty.add('hidden'); table.remove('hidden');

    var total = 0;
    receipts.forEach(function (receipt) {
      var row = el('tr');
      row.appendChild(td(receipt.date));
      row.appendChild(td(receipt.vendor));
      row.appendChild(td(receipt.category));
      row.appendChild(td(MRL.currency(MRL.receiptTotal(receipt)), 'num'));
      row.appendChild(td(receipt.notes || ''));
      var actions = td('', 'actions no-print');
      var editBtn = el('button', 'btn-small');
      editBtn.textContent = 'Edit';
      editBtn.setAttribute('data-act', 'edit-receipt');
      editBtn.setAttribute('data-id', receipt.id);
      var delBtn = el('button', 'btn-small btn-danger');
      delBtn.textContent = 'Delete';
      delBtn.setAttribute('data-act', 'del-receipt');
      delBtn.setAttribute('data-id', receipt.id);
      actions.appendChild(editBtn);
      actions.appendChild(el('span', 'gap'));
      actions.appendChild(delBtn);
      row.appendChild(actions);
      list.appendChild(row);
      if (MRL.receiptTotal(receipt) !== undefined) {
        total = MRL.round2(total + MRL.receiptTotal(receipt));
      }
    });
    $('receipts-total-amount').textContent = MRL.currency(total);
    refreshFooter();
  }

  function resetReceiptForm() {
    $('receipt-form').reset();
    $('receipt-date').value = todayISO();
    $('receipt-category').value = MRL.CATEGORIES[0];
    editing.receipt = null;
    $('receipt-submit').textContent = 'Add receipt';
    $('receipt-cancel-edit').hidden = true;
    showMsg('receipt-msg', null);
  }

  $('receipt-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var wasEdit = !!editing.receipt;
    var receipt = {
      date: $('receipt-date').value,
      vendor: $('receipt-vendor').value.trim(),
      category: $('receipt-category').value,
      amount: $('receipt-amount').value.trim(),
      notes: $('receipt-notes').value.trim()
    };
    receipt.id = editing.receipt || MRL.uid();
    var check = MRL.validateReceipt(receipt);
    if (!check.ok) {
      showMsg('receipt-msg', check.errors, false);
      return;
    }
    receipt.amount = MRL.parseAmount(receipt.amount);
    if (wasEdit) {
      var idx = state.receipts.findIndex(function (r) { return r.id === receipt.id; });
      if (idx !== -1) state.receipts[idx] = receipt; else state.receipts.push(receipt);
    } else {
      state.receipts.push(receipt);
    }
    saveState();
    resetReceiptForm();
    renderReceipts();
    renderSummarySilently();
    showMsg('receipt-msg', [wasEdit ? 'Receipt updated.' : 'Receipt saved!'], true);
    toast('Receipt saved ✓');
  });

  $('receipt-cancel-edit').addEventListener('click', resetReceiptForm);

  /* ---------------- edit / delete (event delegation) ---------------- */

  var editing = { trip: null, receipt: null };

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('button[data-act]') : null;
    if (!btn) return;
    var id = btn.getAttribute('data-id');
    var act = btn.getAttribute('data-act');
    if (act === 'del-trip') {
      var trip = state.trips.find(function (t) { return t.id === id; });
      if (trip && window.confirm('Delete this trip?\n' + trip.date + ' — ' + trip.purpose)) {
        state.trips = state.trips.filter(function (t) { return t.id !== id; });
        if (editing.trip === id) resetTripForm();
        saveState(); renderTrips(); renderSummarySilently();
        toast('Trip deleted.');
      }
    } else if (act === 'edit-trip') {
      var t = state.trips.find(function (x) { return x.id === id; });
      if (!t) return;
      editing.trip = id;
      $('trip-date').value = t.date;
      $('trip-purpose').value = t.purpose;
      $('trip-from').value = t.from || '';
      $('trip-to').value = t.to || '';
      $('trip-miles').value = t.miles;
      $('trip-rate').value = t.rate;
      $('trip-submit').textContent = 'Update trip';
      $('trip-cancel-edit').hidden = false;
      switchTab('trips');
      $('trip-purpose').focus();
    } else if (act === 'del-receipt') {
      var r = state.receipts.find(function (x) { return x.id === id; });
      if (r && window.confirm('Delete this receipt?\n' + r.date + ' — ' + r.vendor + ' ' + MRL.currency(MRL.receiptTotal(r)))) {
        state.receipts = state.receipts.filter(function (x) { return x.id !== id; });
        if (editing.receipt === id) resetReceiptForm();
        saveState(); renderReceipts(); renderSummarySilently();
        toast('Receipt deleted.');
      }
    } else if (act === 'edit-receipt') {
      var rr = state.receipts.find(function (x) { return x.id === id; });
      if (!rr) return;
      editing.receipt = id;
      $('receipt-date').value = rr.date;
      $('receipt-vendor').value = rr.vendor;
      $('receipt-category').value = rr.category;
      $('receipt-amount').value = rr.amount;
      $('receipt-notes').value = rr.notes || '';
      $('receipt-submit').textContent = 'Update receipt';
      $('receipt-cancel-edit').hidden = false;
      switchTab('receipts');
      $('receipt-vendor').focus();
    }
  });

  /* ---------------- summary ---------------- */

  function renderSummarySilently() {
    if (!$('tab-summary').hidden) renderSummary();
    if (!$('tab-print').hidden) renderPrint();
    refreshFooter();
  }

  function renderSummary() {
    var rows = MRL.summarize(state.trips, state.receipts);
    var select = $('summary-month');
    var current = select.value;
    select.textContent = '';
    if (!rows.length) {
      $('summary-empty').hidden = false;
      $('summary-report').hidden = true;
      renderPrint();
      return;
    }
    $('summary-empty').hidden = true;
    $('summary-report').hidden = false;
    rows.slice().reverse().forEach(function (row) {
      var opt = document.createElement('option');
      opt.value = row.key;
      opt.textContent = row.label;
      select.appendChild(opt);
    });
    if (current && rows.some(function (r) { return r.key === current; })) {
      select.value = current;
    }
    renderMonthDetail(rows, select.value);
  }

  function monthFor(key) {
    return MRL.summarize(state.trips, state.receipts).filter(function (r) { return r.key === key; })[0];
  }

  function renderMonthDetail(rows, key) {
    var row = rows.filter(function (r) { return r.key === key; })[0];
    var cards = $('summary-month-cards');
    cards.textContent = '';
    if (!row) return;
    [
      ['Trips', String(row.tripCount)],
      ['Miles driven', String(row.totalMiles)],
      ['Mileage deduction', MRL.currency(row.mileageAmount)],
      ['Receipts', String(row.receiptCount)],
      ['Receipt total', MRL.currency(row.receiptTotal)],
      ['Month total', MRL.currency(row.grandTotal)]
    ].forEach(function (pair) {
      var card = el('div', 'stat-card');
      var val = el('div', 'stat-value');
      val.textContent = pair[1];
      var lab = el('div', 'stat-label');
      lab.textContent = pair[0];
      card.appendChild(val);
      card.appendChild(lab);
      cards.appendChild(card);
    });

    var catBody = $('summary-categories');
    catBody.textContent = '';
    var cats = Object.keys(row.categories).sort(function (a, b) {
      return row.categories[b] - row.categories[a];
    });
    if (!cats.length) {
      catBody.appendChild(tdRow('No receipts this month.', ''));
    }
    cats.forEach(function (cat) {
      catBody.appendChild(tdRow(cat, MRL.currency(row.categories[cat])));
    });

    var ytd = $('summary-ytd');
    var ytdTotal = $('summary-ytd-total');
    ytd.textContent = '';
    ytdTotal.textContent = '';
    var t = { trips: 0, miles: 0, mileage: 0, receipts: 0, receiptTotal: 0, grand: 0 };
    rows.forEach(function (r) {
      ytd.appendChild(ymRow(r));
      t.trips += r.tripCount;
      t.miles = MRL.round2(t.miles + r.totalMiles);
      t.mileage = MRL.round2(t.mileage + r.mileageAmount);
      t.receipts += r.receiptCount;
      t.receiptTotal = MRL.round2(t.receiptTotal + r.receiptTotal);
      t.grand = MRL.round2(t.grand + r.grandTotal);
    });
    var foot = el('tr');
    foot.appendChild(td('All-time total', 'th-label'));
    foot.appendChild(td(String(t.trips), 'num'));
    foot.appendChild(td(String(t.miles), 'num'));
    foot.appendChild(td(MRL.currency(t.mileage), 'num'));
    foot.appendChild(td(String(t.receipts), 'num'));
    foot.appendChild(td(MRL.currency(t.receiptTotal), 'num'));
    foot.appendChild(td(MRL.currency(t.grand), 'num'));
    ytdTotal.appendChild(foot);
  }

  function tdRow(left, right) {
    var tr = el('tr');
    tr.appendChild(td(left));
    var rightCell = el('td', 'num');
    rightCell.textContent = right;
    tr.appendChild(rightCell);
    return tr;
  }

  function ymRow(r) {
    var tr = el('tr');
    tr.appendChild(td(r.label, 'th-label'));
    tr.appendChild(td(String(r.tripCount), 'num'));
    tr.appendChild(td(String(r.totalMiles), 'num'));
    tr.appendChild(td(MRL.currency(r.mileageAmount), 'num'));
    tr.appendChild(td(String(r.receiptCount), 'num'));
    tr.appendChild(td(MRL.currency(r.receiptTotal), 'num'));
    tr.appendChild(td(MRL.currency(r.grandTotal), 'num'));
    return tr;
  }

  $('summary-month').addEventListener('change', function () {
    renderMonthDetail(MRL.summarize(state.trips, state.receipts), selectedMonth());
    renderPrint();
  });

  /* ---------------- CSV export ---------------- */

  $('export-trips').addEventListener('click', function () {
    if (!state.trips.length) return toast('No trips to export yet.');
    download('trips-' + selectedMonth() + '.csv', MRL.tripsToCSV(state.trips));
    toast('Trips CSV downloaded ✓');
  });
  $('export-receipts').addEventListener('click', function () {
    if (!state.receipts.length) return toast('No receipts to export yet.');
    download('receipts-' + selectedMonth() + '.csv', MRL.receiptsToCSV(state.receipts));
    toast('Receipts CSV downloaded ✓');
  });
  $('export-all').addEventListener('click', function () {
    if (!state.trips.length && !state.receipts.length) return toast('Nothing to export yet.');
    download('mileage-and-receipts.csv', MRL.combinedToCSV(state.trips, state.receipts));
    toast('Full CSV downloaded ✓');
  });

  /* ---------------- print view ---------------- */

  function renderPrint() {
    var key = selectedMonth();
    var row = monthFor(key);
    var box = $('print-report');
    box.textContent = '';
    if (!row) {
      var p = el('p', 'hint');
      p.textContent = 'No data for this month yet.';
      box.appendChild(p);
      return;
    }
    var heading = el('h2', 'print-heading');
    heading.textContent = (state.settings.businessName || 'Business') + ' — ' + row.label + ' report';
    box.appendChild(heading);
    var meta = el('p', 'print-meta');
    meta.textContent = 'Prepared ' + todayISO() + ' with Mileage & Receipts Logger (Asdale Dynamics, LLC).';
    box.appendChild(meta);

    var h3t = el('h3');
    h3t.textContent = 'Trips';
    box.appendChild(h3t);
    var trows = state.trips
      .filter(function (t) { return MRL.monthKey(t.date) === key; })
      .slice().sort(sortByDateDesc);
    var tbl = el('table', 'print-table');
    var thead = el('thead');
    var trh = el('tr');
    ['Date', 'Purpose', 'From → To', 'Miles', 'Rate', 'Cost'].forEach(function (h, i) {
      var th = el('th', i >= 3 ? 'num' : '');
      th.textContent = h;
      trh.appendChild(th);
    });
    thead.appendChild(trh);
    tbl.appendChild(thead);
    var tbody = el('tbody');
    trows.forEach(function (t) {
      var tr = el('tr');
      tr.appendChild(td(t.date));
      tr.appendChild(td(t.purpose));
      tr.appendChild(td((t.from || '—') + ' → ' + (t.to || '—')));
      tr.appendChild(td(MRL.parseAmount(t.miles), 'num'));
      tr.appendChild(td('$' + MRL.parseAmount(t.rate), 'num'));
      tr.appendChild(td(MRL.currency(MRL.tripTotal(t)), 'num'));
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    box.appendChild(tbl);

    var h3r = el('h3');
    h3r.textContent = 'Receipts';
    box.appendChild(h3r);
    var rrows = state.receipts
      .filter(function (r) { return MRL.monthKey(r.date) === key; })
      .slice().sort(sortByDateDesc);
    var rtbl = el('table', 'print-table');
    var rthead = el('thead');
    var rtrh = el('tr');
    ['Date', 'Vendor', 'Category', 'Amount'].forEach(function (h, i) {
      var th = el('th', i === 3 ? 'num' : '');
      th.textContent = h;
      rtrh.appendChild(th);
    });
    rthead.appendChild(rtrh);
    rtbl.appendChild(rthead);
    var rtbody = el('tbody');
    rrows.forEach(function (r) {
      var tr = el('tr');
      tr.appendChild(td(r.date));
      tr.appendChild(td(r.vendor));
      tr.appendChild(td(r.category));
      tr.appendChild(td(MRL.currency(MRL.receiptTotal(r)), 'num'));
      rtbody.appendChild(tr);
    });
    rtbl.appendChild(rtbody);
    box.appendChild(rtbl);

    var totals = el('div', 'print-totals');
    [
      'Mileage (' + row.totalMiles + ' mi): ' + MRL.currency(row.mileageAmount),
      'Receipts: ' + MRL.currency(row.receiptTotal),
      'Month total: ' + MRL.currency(row.grandTotal)
    ].forEach(function (line) {
      var p = el('div', 'print-total-line');
      p.textContent = line;
      totals.appendChild(p);
    });
    box.appendChild(totals);
  }

  $('btn-print').addEventListener('click', function () {
    renderPrint();
    window.print();
  });

  /* ---------------- settings ---------------- */

  $('settings-form').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var rate = MRL.parseAmount($('settings-rate').value);
    if (rate === undefined || rate <= 0) {
      showMsg('settings-msg', ['Rate must be a positive number (like 0.76).'], false);
      return;
    }
    state.settings.defaultRate = rate;
    state.settings.businessName = $('settings-name').value.trim();
    saveState();
    fillTripRate();
    showMsg('settings-msg', ['Settings saved ✓ New trips will use ' + currencyDeep(rate) + '/mile.'], true);
    toast('Settings saved ✓');
  });

  function currencyDeep(n) {
    return '$' + n;
  }

  $('btn-sample').addEventListener('click', function () {
    var hasData = state.trips.length || state.receipts.length;
    if (hasData && !window.confirm('Add 6 clearly-labeled SAMPLE entries to your data? (Easy to delete later.)')) return;
    var sample = MRL.sampleData();
    state.trips = state.trips.concat(sample.trips);
    state.receipts = state.receipts.concat(sample.receipts);
    saveState();
    renderTrips();
    renderReceipts();
    renderSummary();
    toast('Sample data loaded ✓ Try the Summary tab!');
    showMsg('settings-msg', ['Sample data loaded — every entry is marked "SAMPLE DATA" and can be edited or deleted.'], true);
  });

  $('btn-erase').addEventListener('click', function () {
    if (!state.trips.length && !state.receipts.length) return toast('Already empty.');
    if (!window.confirm('Erase ALL trips and receipts from this browser?\nExport your CSVs first if you need them!')) return;
    if (!window.confirm('Really erase? This cannot be undone.')) return;
    state.trips = [];
    state.receipts = [];
    saveState();
    resetTripForm();
    resetReceiptForm();
    renderTrips();
    renderReceipts();
    renderSummary();
    toast('All data erased.');
  });

  $('btn-backup').addEventListener('click', function () {
    download('mileage-receipts-backup.json', JSON.stringify(state, null, 2), 'application/json;charset=utf-8');
    toast('JSON backup downloaded ✓');
  });

  /* ---------------- footer ---------------- */

  function refreshFooter() {
    var n = state.trips.length + state.receipts.length;
    $('footer-entries').textContent = n === 0
      ? 'No entries stored yet'
      : n + ' entr' + (n === 1 ? 'y' : 'ies') + ' stored in this browser';
  }

  /* ---------------- init ---------------- */

  function init() {
    var catSel = $('receipt-category');
    catSel.textContent = '';
    MRL.CATEGORIES.forEach(function (cat) {
      var opt = document.createElement('option');
      opt.value = cat;
      opt.textContent = cat;
      catSel.appendChild(opt);
    });
    $('settings-rate').value = state.settings.defaultRate;
    $('settings-name').value = state.settings.businessName || '';
    resetTripForm();
    resetReceiptForm();
    renderTrips();
    renderReceipts();
    renderSummary();
    renderPrint();
    switchTab('trips');
  }

  init();
})();
