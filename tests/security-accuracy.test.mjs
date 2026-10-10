import test from 'node:test';
import assert from 'node:assert/strict';
import { Worker } from 'node:worker_threads';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadSource, sourceUrl } from './load-source.mjs';
const { evaluate, factorial } = await loadSource('src/lib/evaluate.ts');
const { safeUrl } = await loadSource('src/lib/safeUrl.ts');
const { MarkdownPreview } = await loadSource('src/components/MarkdownPreview.tsx');
const { readStored } = await loadSource('src/lib/storageData.ts');
const { validRates, staleRates, convertCurrency } = await loadSource('src/lib/currency.ts');
const { diffBreakdown } = await loadSource('src/lib/dateMath.ts');
const { generatePassword } = await loadSource('src/lib/password.ts');
const { bodyFat } = await loadSource('src/lib/health.ts');
const { runRegexTask } = await loadSource('src/lib/regexTask.ts');

for (const [expression, answer] of [['2+3*4', 14], ['(2+3)*4', 20], ['2^3^2', 512], ['-2^2', -4], ['2^-2', 0.25], ['3!+2', 8], ['2*3!', 12], ['3!-2', 4], ['1e-3+2e-3', .003], ['sqrt(16)+abs(-3)', 7]]) {
  test(`calculator ${expression}`, () => assert.equal(evaluate(expression), answer));
}
test('degree mode works for nested and inverse trigonometry', () => {
  assert.ok(Math.abs(evaluate('sin(30+30)', 'deg') - Math.sqrt(3) / 2) < 1e-12);
  assert.ok(Math.abs(evaluate('asin(0.5)', 'deg') - 30) < 1e-12);
  assert.ok(Math.abs(evaluate('sin(asin(0.5))', 'deg') - 0.5) < 1e-12);
});
test('malformed expressions are rejected instead of partial evaluation', () => {
  for (const value of ['1 2', '2..3', '(2+3', '2+3)', '2+', 'sqrt()', 'sin 30', '1,2', 'constructor(1)', '1/0', 'sqrt(-1)']) assert.throws(() => evaluate(value), value);
});
test('factorial and expression budgets bound computation', () => {
  assert.equal(factorial(0), 1); assert.equal(factorial(5), 120);
  for (const n of [-1, 2.5, 171, Infinity, 1e10]) assert.throws(() => factorial(n));
  assert.throws(() => evaluate('('.repeat(65) + '1' + ')'.repeat(65)));
  assert.throws(() => evaluate('1'.repeat(1001)));
});

test('Markdown quote witness cannot create an event attribute', () => {
  const text = `[x](https://example.com" onmouseover="document.body.dataset.probe=localStorage['uuh:calc-history'])`;
  const html = renderToStaticMarkup(React.createElement(MarkdownPreview, { text }));
  assert.doesNotMatch(html, /<[^>]*\son\w+\s*=/i);
  assert.doesNotMatch(html, /<script|<iframe|<img/i);
});
test('raw tags and quote-bearing labels stay text; images make no external request', () => {
  const html = renderToStaticMarkup(React.createElement(MarkdownPreview, { text: '<img src=x onerror=alert(1)>\n\n![private](https://example.com/tracker)\n\n[" onclick="bad](https://example.com)' }));
  assert.doesNotMatch(html, /<img|<script|<[^>]*\son\w+\s*=/i);
  assert.match(html, /&lt;img/);
});
test('URL policy rejects dangerous and normalized-control schemes', () => {
  for (const value of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', 'data:text/html,x', 'vbscript:x', 'file:///etc/passwd', 'https://x" onmouseover="x', '\\evil.test']) assert.equal(safeUrl(value), undefined, value);
  for (const value of ['https://example.com?q=a&b=2', 'http://example.com/a(b)', '/relative', '#section', 'mailto:test@example.com']) assert.equal(safeUrl(value), value);
});
test('Markdown rejects encoded unsafe protocols and preserves legitimate formatting', () => {
  for (const text of ['[x](javascript:alert%281%29)', '[x](JaVaScRiPt:alert%281%29)', '[x](java&#x73;cript:alert%281%29)', '[x](data:text/html,hello)']) {
    const html = renderToStaticMarkup(React.createElement(MarkdownPreview, { text })); assert.doesNotMatch(html, /<a\b/);
  }
  const html = renderToStaticMarkup(React.createElement(MarkdownPreview, { text: '# Heading\n\n**bold** and *italic* and `**literal**`\n\n- one\n- two\n\n[Link](https://example.com/a(b)?q=x&n=1)' }));
  for (const value of ['<h1>Heading</h1>', '<strong>bold</strong>', '<em>italic</em>', '<code>**literal**</code>', '<ul>', '<li>two</li>', 'rel="noopener noreferrer"', 'href="https://example.com/a(b)?q=x&amp;n=1"']) assert.ok(html.includes(value), value);
});

test('storage rejects corrupt JSON, wrong shapes and inaccessible storage', () => {
  for (const raw of ['{bad', 'null', '{}', '[1]', '[{"id":"x"}]']) assert.deepEqual(readStored('uuh:notes', [], { getItem: () => raw }), []);
  assert.deepEqual(readStored('uuh:favorites', [], { getItem: () => '["calculator"]' }), ['calculator']);
  assert.deepEqual(readStored('uuh:notes', [], { getItem: () => { throw Error('blocked'); } }), []);
  const notes = [{ id: 'n', title: 'Title', body: 'Content', updated: 123 }];
  assert.deepEqual(readStored('uuh:notes', [], { getItem: () => JSON.stringify(notes) }), notes);
});
const rates = { base: 'USD', rates: { USD: 1, EUR: 0.8, INR: 80 }, updated: '2026-10-08T00:00:00Z' };
test('currency validates provider/cache values and finite conversion', () => {
  assert.equal(validRates(rates), true);
  for (const value of [null, {}, { ...rates, rates: { USD: 2 } }, { ...rates, rates: { USD: 1, EUR: -1 } }, { ...rates, updated: 'invalid' }, { ...rates, rates: { USD: 1, EUR: Infinity } }]) assert.equal(validRates(value), false);
  assert.equal(convertCurrency(rates, '100', 'EUR', 'INR'), '10000.0000');
  for (const amount of ['', 'NaN', '1e309']) assert.equal(convertCurrency(rates, amount, 'EUR', 'INR'), '');
  assert.equal(convertCurrency(rates, '1', 'MISSING', 'INR'), '');
});
test('currency freshness recognizes stale and future caches', () => {
  const now = Date.parse(rates.updated);
  assert.equal(staleRates(rates, now), false);
  assert.equal(staleRates(rates, now + 86400001), true);
  assert.equal(staleRates(rates, now - 1), true);
});
test('calendar differences handle month end, leap day and timezone-independent date-only values', () => {
  const diff = (a, b) => diffBreakdown(new Date(a), new Date(b));
  assert.deepEqual([diff('2025-01-31', '2025-03-01').months, diff('2025-01-31', '2025-03-01').days], [1, 1]);
  assert.equal(diff('2000-02-29', '2001-02-28').years, 1);
  assert.equal(diff('2026-03-08', '2026-03-09').totalHours, 24);
  assert.equal(diff('2026-03-09', '2026-03-08').totalDays, -1);
});
test('password generator includes requested groups, excludes ambiguous characters and validates options', () => {
  const options = { upper: true, lower: true, number: true, symbol: true, noAmbig: true };
  for (let i = 0; i < 50; i++) {
    const password = generatePassword(16, options);
    assert.equal(password.length, 16); assert.doesNotMatch(password, /[O0Il1|]/);
    for (const group of [/[A-Z]/, /[a-z]/, /\d/, /[^\w]/]) assert.match(password, group);
  }
  assert.throws(() => generatePassword(100000, options));
  assert.throws(() => generatePassword(16, { ...options, upper: false, lower: false, number: false, symbol: false }));
});
test('body-fat female calculation consumes hips and rejects invalid measurements', () => {
  const value = bodyFat('female', 75, 33, 165, 95);
  assert.ok(value > 20 && value < 40);
  assert.notEqual(value, bodyFat('female', 75, 33, 165, 100));
  assert.ok(Number.isNaN(bodyFat('female', 75, 33, 165, 0)));
  assert.ok(Number.isNaN(bodyFat('male', 20, 38, 175, 0)));
});
test('regex worker operation returns matches, replacement and invalid-pattern errors', () => {
  assert.deepEqual(runRegexTask({ mode: 'match', pattern: '\\d+', flags: 'g', text: '12 x 34' }).matches, ['12', '34']);
  assert.equal(runRegexTask({ mode: 'replace', pattern: 'cat', flags: 'g', text: 'cat cat', replacement: 'dog' }).output, 'dog dog');
  assert.ok(runRegexTask({ mode: 'match', pattern: '[', flags: 'g', text: 'x' }).error);
  assert.ok(runRegexTask({ mode: 'match', pattern: 'x', flags: 'g', text: 'x'.repeat(100001) }).error);
});
test('pathological regex can be terminated without blocking the main thread', { timeout: 5000 }, async () => {
  const url = await sourceUrl('src/lib/regexTask.ts');
  const worker = new Worker(`const {parentPort} = require('node:worker_threads'); import(${JSON.stringify(url)}).then(({runRegexTask}) => { parentPort.postMessage('ready'); parentPort.on('message', request => parentPort.postMessage(runRegexTask(request))); });`, { eval: true });
  try {
    await new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
    worker.postMessage({ mode: 'match', pattern: '(a+)+$', flags: '', text: 'a'.repeat(80) + '!' });
    const started = Date.now();
    await new Promise(resolve => setTimeout(resolve, 100));
    await worker.terminate();
    assert.ok(Date.now() - started < 2000);
  } finally { await worker.terminate(); }
});

test('fraction reduction rejects decimals and normalizes negative mixed numbers', async () => {
  const { simplifyFraction } = await loadSource('src/lib/fraction.ts');
  assert.deepEqual(simplifyFraction(6, -8), { numerator: -3, denominator: 4, mixed: '-3/4' });
  assert.equal(simplifyFraction(-7, 3).mixed, '-2 1/3');
  assert.equal(simplifyFraction(0, 3).mixed, '0');
  assert.equal(simplifyFraction(1.2, 3), null);
  assert.equal(simplifyFraction(3, 0), null);
});
test('unit reference temperature conversions and factors remain consistent', async () => {
  const { convertTemp, categories } = await loadSource('src/modules/converter/units.ts');
  assert.equal(convertTemp(32, 'Fahrenheit', 'Celsius'), 0);
  assert.equal(convertTemp(0, 'Celsius', 'Kelvin'), 273.15);
  assert.ok(Math.abs(convertTemp(491.67, 'Rankine', 'Celsius')) < 1e-10);
  assert.equal(categories.find(c => c.id === 'length').units.find(u => u.symbol === 'km').factor, 1000);
  assert.equal(categories.find(c => c.id === 'mass').units.find(u => u.symbol === 'lb').factor, .45359237);
  assert.equal(new Set(categories.map(c => c.id)).size, categories.length);
});

test('initial Calculator tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/calculator/CalculatorModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Converter tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/converter/ConverterModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Currency tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/currency/CurrencyModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial DateTime tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/datetime/DateTimeModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Math tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/math/MathModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Finance tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/finance/FinanceModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Health tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/health/HealthModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Programming tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/programming/ProgrammingModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Text tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/text/TextModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial QR tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/qr/QRModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Science tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/science/ScienceModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Productivity tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/productivity/ProductivityModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Random tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/random/RandomModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});

test('initial Formula tool renders without errors', async () => {
  const { default: Tool } = await loadSource('src/modules/formulas/FormulaModule.tsx');
  const html = renderToStaticMarkup(React.createElement(Tool, { starred: false }));
  assert.match(html, /<h1\b/);
  assert.doesNotMatch(html, /(?:NaN|Infinity)/);
});
