import { useCallback, useEffect, useRef, useState } from 'react';
import { Coins, RefreshCw, Star, TrendingUp } from 'lucide-react';
import { Panel, ToolHeader, Select } from '@/components/ui';
import { useLocalStorage } from '@/lib/storage';

import { isRecord } from '@/lib/storageData';
import { validRates, staleRates, convertCurrency, type Rates } from '@/lib/currency';

const COMMON = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'AUD', 'CAD', 'CNY', 'CHF', 'SGD', 'AED', 'BRL', 'ZAR', 'KRW', 'MXN', 'NZD', 'SEK', 'NOK', 'DKK', 'HKD', 'TRY', 'RUB', 'PLN', 'THB', 'IDR', 'MYR', 'PHP', 'VND', 'EGP', 'NGN', 'PKR', 'BDT', 'SAR', 'ILS'];

const CACHE_KEY = 'uuh:currency-cache';
const FAV_KEY = 'uuh:currency-favs';

function loadCache(): Rates | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw || raw.length > 100000) return null;
    const value: unknown = JSON.parse(raw);
    return validRates(value) ? value : null;
  } catch { return null; }
}

export default function CurrencyModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [rates, setRates] = useState<Rates | null>(loadCache);
  const [loading, setLoading] = useState(false);
  const request = useRef<AbortController | null>(null);
  const [error, setError] = useState('');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('EUR');
  const [amount, setAmount] = useState('100');
  const [favs, setFavs] = useLocalStorage<string[]>(FAV_KEY, ['EUR', 'GBP', 'INR', 'JPY']);
  const [history, setHistory] = useLocalStorage<{ from: string; to: string; amt: string; result: string; date: string }[]>('uuh:currency-history', []);

  const fetchRates = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setLoading(true); setError('');
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error('Failed to fetch rates');
      const data: unknown = await res.json();
      if (!isRecord(data) || data.result !== 'success') throw new Error('Invalid API response');
      const r = { base: 'USD', rates: data.rates, updated: typeof data.time_last_update_utc === 'string' ? data.time_last_update_utc : '' };
      if (!validRates(r)) throw new Error('Invalid rate data received');
      if (request.current !== controller) return;
      setRates(r);
      try { localStorage.setItem(CACHE_KEY, JSON.stringify(r)); } catch { /* Rates remain usable without cache. */ }
    } catch (e: unknown) {
      if (request.current === controller) setError(controller.signal.aborted ? 'Rate request timed out. Try refreshing.' : (e instanceof Error ? e.message : 'Unable to load rates'));
    } finally { clearTimeout(timeout); if (request.current === controller) setLoading(false); }
  }, []);

  useEffect(() => {
    const cached = loadCache();
    if (!cached || staleRates(cached)) void fetchRates();
    return () => { request.current?.abort(); request.current = null; };
  }, [fetchRates]);

  const currencyList = rates ? Object.keys(rates.rates).sort() : COMMON;

  const converted = convertCurrency(rates, amount, from, to);

  const save = () => {
    const r = converted;
    if (!r) return;
    setHistory((h) => [{ from, to, amt: amount, result: r, date: new Date().toISOString() }, ...h].slice(0, 20));
  };

  const toggleFav = (c: string) => setFavs((p) => p.includes(c) ? p.filter((x) => x !== c) : [...p, c]);

  return (
    <Panel>
      <ToolHeader title="Currency Converter" subtitle="Live exchange rates · offline cached" icon={Coins} onStar={onStar} starred={starred} />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted">
            {rates ? `Updated ${new Date(rates.updated).toLocaleDateString()}` : loading ? 'Loading…' : error}
          </span>
          <button onClick={fetchRates} className="btn btn-soft text-xs" disabled={loading}>
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>

        {error && <div role="alert" className="text-sm text-error-500">{error}{rates ? ' Using cached rates.' : ''}</div>}
        {rates && staleRates(rates) && <p className="text-xs text-warning-500">Cached rates may be outdated. Refresh when online.</p>}

        <div className="grid grid-cols-2 gap-3 responsive-fields">
          <div>
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Amount</span>
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-base mt-1.5 text-lg font-mono" />
            <Select value={from} onChange={setFrom} className="mt-2">
              {currencyList.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <span className="text-xs font-medium text-muted uppercase tracking-wide">Converted</span>
            <div className="input-base mt-1.5 text-lg font-mono text-primary-600 dark:text-primary-400 min-h-[2.75rem] flex items-center">{converted || '—'}</div>
            <Select value={to} onChange={setTo} className="mt-2">
              {currencyList.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </div>
        </div>

        <button onClick={save} disabled={!converted} className="btn btn-primary w-full">Save to history</button>

        <div>
          <div className="text-xs font-medium text-muted uppercase tracking-wide mb-2">Favorites · quick convert from USD</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {favs.map((c) => {
              const r = rates?.rates[c];
              return (
                <div key={c} className="rounded-lg bg-surface-2 p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{c}</div>
                    <div className="text-xs text-muted font-mono">{r ? (r).toFixed(4) : '—'}</div>
                  </div>
                  <button onClick={() => toggleFav(c)} className="text-subtle hover:text-accent-500"><Star size={14} className="fill-current" /></button>
                </div>
              );
            })}
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-2"><TrendingUp size={15} /> History</div>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {history.map((h, i) => (
                <div key={i} className="flex justify-between text-sm font-mono px-3 py-2 rounded-lg hover:bg-surface-2">
                  <span className="text-muted">{h.amt} {h.from} → {h.to}</span>
                  <span className="text-primary-600 dark:text-primary-400">{h.result}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
