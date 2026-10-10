/** Exact 2-decimal INR parsing, without floating point rounding of currency input. */
export function parseRupeesToPaise(value: string): number | null {
  const raw = value.trim();
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(raw)) return null;
  const [rupees, decimals = ''] = raw.split('.');
  const paise = Number(rupees) * 100 + Number(decimals.padEnd(2, '0'));
  return Number.isSafeInteger(paise) && paise > 0 && paise < 1_000_000_000_000 ? paise : null;
}
export function operatingBalance(revenuePaise: number, expensePaise: number) {
  return revenuePaise - expensePaise;
}
