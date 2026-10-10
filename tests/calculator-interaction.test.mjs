import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { loadSource } from './load-source.mjs';

const { formattedCalculation, previewCalculation, appendCalculatorKey } = await loadSource('src/lib/calculatorLogic.ts');

test('live preview shows valid answers but no premature red error for incomplete input', () => {
  assert.equal(previewCalculation('8-3', 'deg'), '5');
  assert.equal(previewCalculation('7-', 'deg'), '');
  assert.equal(previewCalculation('sin(', 'deg'), '');
  assert.equal(previewCalculation('', 'deg'), '');
  assert.equal(previewCalculation('1/0', 'deg'), '');
  assert.equal(previewCalculation('sin(30)', 'deg'), '0.5');
});

test('equals commits actual evaluated answer and rejects invalid expressions', () => {
  assert.equal(formattedCalculation('8-3', 'deg'), '5');
  assert.equal(formattedCalculation('2+3*4', 'deg'), '14');
  assert.equal(formattedCalculation('sin(30)', 'deg'), '0.5');
  assert.throws(() => formattedCalculation('7-', 'deg'), /Expected a number/);
  assert.throws(() => formattedCalculation('1/0', 'deg'), /outside the real finite number range/);
});

test('after equals operators chain from answer; digits start a fresh expression', () => {
  assert.equal(appendCalculatorKey('5', '+', true), '5+');
  assert.equal(appendCalculatorKey('5', '7', true), '7');
  assert.equal(appendCalculatorKey('5', 'sin', true), 'sin(');
  assert.equal(appendCalculatorKey('5', '!', true), '5!');
  assert.equal(appendCalculatorKey('5+', '7', false), '5+7');
  assert.equal(formattedCalculation(appendCalculatorKey('5+', '7', false), 'deg'), '12');
});

test('favicon assets and page links exist for modern browsers and iOS', () => {
  const page = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
  const png = readFileSync(new URL('../public/favicon-32x32.png', import.meta.url));
  assert.match(page, /href="\/favicon\.svg"/);
  assert.match(page, /href="\/favicon\.ico"/);
  assert.match(page, /href="\/favicon-32x32\.png"/);
  assert.match(page, /href="\/apple-touch-icon\.png"/);
  assert.match(page, /href="\/site\.webmanifest"/);
  assert.match(svg, /<rect x="15" y="8" width="34" height="48"/); 
  assert.match(svg, /<svg.*viewBox="0 0 64 64"/);
  assert.deepEqual([...png.subarray(0, 8)], [137,80,78,71,13,10,26,10]);
  assert.ok(existsSync(new URL('../public/apple-touch-icon.png', import.meta.url)));
});
