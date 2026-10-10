export function simplifyFraction(numerator: number, denominator: number) {
  if (!Number.isSafeInteger(numerator) || !Number.isSafeInteger(denominator) || denominator === 0) return null;
  let a = Math.abs(numerator), b = Math.abs(denominator);
  while (b !== 0) [a, b] = [b, a % b];
  const sign = denominator < 0 ? -1 : 1;
  const n = numerator / a * sign, d = Math.abs(denominator) / a;
  const whole = Math.trunc(n / d), remainder = Math.abs(n % d);
  const mixed = remainder === 0 ? String(whole) : `${n < 0 && whole === 0 ? '-' : ''}${whole || ''}${whole ? ' ' : ''}${remainder}/${d}`;
  return { numerator: n, denominator: d, mixed };
}
