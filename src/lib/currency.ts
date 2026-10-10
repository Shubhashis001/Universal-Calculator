export interface Rates { base: string; rates: Record<string, number>; updated: string; }
export function validRates(value: unknown): value is Rates {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<Rates>;
  if (data.base !== 'USD' || typeof data.updated !== 'string' || !Number.isFinite(Date.parse(data.updated)) || !data.rates || typeof data.rates !== 'object' || Array.isArray(data.rates)) return false;
  const entries = Object.entries(data.rates);
  return entries.length > 0 && entries.length <= 300 && data.rates.USD === 1 && entries.every(([code, rate]) => /^[A-Z]{3}$/.test(code) && typeof rate === 'number' && Number.isFinite(rate) && rate > 0);
}
export function staleRates(rates: Rates, now = Date.now()): boolean {
  const age = now - Date.parse(rates.updated);
  return age < 0 || age > 24 * 60 * 60 * 1000;
}
export function convertCurrency(rates: Rates | null, amount: string, from: string, to: string): string {
  const value = Number(amount);
  if (!rates || !amount.trim() || !Number.isFinite(value) || !rates.rates[from] || !rates.rates[to]) return '';
  const result = value / rates.rates[from] * rates.rates[to];
  return Number.isFinite(result) ? result.toFixed(4) : '';
}
