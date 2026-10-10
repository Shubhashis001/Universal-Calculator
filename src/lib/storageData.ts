type Guard = (value: unknown) => boolean;
export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const strings: Guard = value => Array.isArray(value) && value.length <= 1000 && value.every(item => typeof item === 'string');
const rows = (fields: Record<string, 'string' | 'number' | 'boolean'>): Guard => value =>
  Array.isArray(value) && value.length <= 10000 && value.every(item => isRecord(item) && Object.entries(fields).every(([key, type]) => typeof item[key] === type && (type !== 'number' || Number.isFinite(item[key]))));
const guards: Record<string, Guard> = {
  'uuh:favorites': strings, 'uuh:recents': strings, 'uuh:currency-favs': strings,
  'uuh:calc-history': rows({ expr: 'string', result: 'string' }),
  'uuh:currency-history': rows({ from: 'string', to: 'string', amt: 'string', result: 'string', date: 'string' }),
  'uuh:notes': rows({ id: 'string', title: 'string', body: 'string', updated: 'number' }),
  'uuh:todos': rows({ id: 'string', text: 'string', done: 'boolean' }),
  'uuh:checklist': rows({ id: 'string', text: 'string', done: 'boolean' }),
};

export function readStored<T>(key: string, initial: T, storage: Pick<Storage, 'getItem'>): T {
  try {
    const raw = storage.getItem(key);
    if (raw === null || raw.length > 5_000_000) return initial;
    const parsed: unknown = JSON.parse(raw);
    return guards[key]?.(parsed) ? parsed as T : initial;
  } catch { return initial; }
}
