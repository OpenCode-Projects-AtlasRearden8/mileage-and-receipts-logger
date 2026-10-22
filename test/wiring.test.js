'use strict';
// Wiring smoke test: every element id used by app.js must exist in index.html,
// and index.html must load the expected scripts/styles.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const appSource = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const coreSource = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

function usedIds(source) {
  const ids = new Set();
  const patterns = [
    /\$\('([^']+)'\)/g,
    /getElementById\('([^']+)'\)/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(source))) ids.add(match[1]);
  }
  return Array.from(ids).sort();
}

function htmlIds(markup) {
  const ids = new Set();
  const pattern = /id="([^"]+)"/g;
  let match;
  while ((match = pattern.exec(markup))) ids.add(match[1]);
  return ids;
}

test('app.js only references ids that exist in index.html', () => {
  const ids = usedIds(appSource);
  assert.ok(ids.length >= 20, 'expected many ids used, found ' + ids.length);
  const available = htmlIds(html);
  const missing = ids.filter((id) => !available.has(id));
  assert.deepStrictEqual(missing, [], 'ids used in app.js but missing from index.html');
});

test('index.html loads core.js and app.js in order', () => {
  const corePos = html.indexOf('<script src="core.js">');
  const appPos = html.indexOf('<script src="app.js">');
  assert.ok(corePos !== -1, 'core.js script tag missing');
  assert.ok(appPos !== -1, 'app.js script tag missing');
  assert.ok(corePos < appPos, 'core.js must load before app.js');
});

test('index.html links styles.css and declares required sections', () => {
  assert.match(html, /stylesheet"\s+href="styles\.css/);
  for (const id of ['tab-trips', 'tab-receipts', 'tab-summary', 'tab-print', 'tab-settings', 'tab-help', 'trip-form', 'receipt-form', 'settings-form', 'summary-month', 'print-report']) {
    assert.ok(htmlIds(html).has(id), 'missing section id: ' + id);
  }
});

test('receipt-category select is populated from core CATEGORIES via app.js', () => {
  assert.match(appSource, /MRL\.CATEGORIES\.forEach/);
  assert.match(appSource, /\$\('receipt-category'\)/);
});

test('print rules and app print buttons exist', () => {
  assert.match(css, /@media print/);
  assert.match(css, /\.no-print/);
  assert.match(appSource, /window\.print\(\)/);
  assert.ok(htmlIds(html).has('btn-print'));
});

test('no obvious secrets or API keys committed in source files', () => {
  const files = ['index.html', 'app.js', 'core.js', 'styles.css', 'package.json', 'README.md'];
  const pattern = /(sk-[A-Za-z0-9]{8,}|AKIA[0-9A-Z]{12,}|api[_-]?key\s*[:=]\s*['"][^'"]{8,})/i;
  for (const file of files) {
    const full = path.join(root, file);
    if (!fs.existsSync(full)) continue;
    const text = fs.readFileSync(full, 'utf8');
    assert.ok(!pattern.test(text), 'possible secret found in ' + file);
  }
});
