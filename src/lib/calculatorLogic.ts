import { evaluate, type AngleMode } from './evaluate';

// Keep preview computation pure: unfinished input is normal while someone types.
export function formattedCalculation(expression: string, mode: AngleMode): string {
  const value = evaluate(expression, mode);
  return String(Number(value.toPrecision(12)));
}

export function previewCalculation(expression: string, mode: AngleMode): string {
  if (!expression.trim()) return '';
  try { return formattedCalculation(expression, mode); }
  catch { return ''; }
}

const chainingOperators = new Set(['+', '-', '*', '/', '^', '%', '!']);
const functionKeys = new Set(['sin', 'cos', 'tan', 'log', 'ln', 'sqrt']);

export function appendCalculatorKey(expression: string, key: string, afterEquals = false): string {
  const token = functionKeys.has(key) ? `${key}(` : key;
  const base = afterEquals && !chainingOperators.has(key) ? '' : expression;
  return (base + token).slice(0, 1000);
}
