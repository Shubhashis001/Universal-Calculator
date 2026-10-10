import { useEffect, useState } from 'react';
import { useRegexTask } from '@/lib/useRegexTask';
import { generatePassword } from '@/lib/password';
import { Code2, Binary, FileJson, Hash, Regex, Link2, Fingerprint, Palette, Type, KeyRound } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, CopyButton } from '@/components/ui';

function BaseConvertTab() {
  const [value, setValue] = useState('255');
  const [from, setFrom] = useState(10);
  const digits = { 2: /^[+-]?[01]+$/, 8: /^[+-]?[0-7]+$/, 10: /^[+-]?\d+$/, 16: /^[+-]?[\da-f]+$/i }[from];
  const parsed = digits?.test(value.trim()) ? parseInt(value, from) : NaN;
  const dec = Number.isSafeInteger(parsed) ? parsed : NaN;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Value"><input value={value} onChange={(e) => setValue(e.target.value)} className="input-base font-mono" /></Field>
        <Field label="From base">
          <select value={from} onChange={(e) => setFrom(+e.target.value)} className="input-base">
            <option value={2}>Binary (2)</option><option value={8}>Octal (8)</option><option value={10}>Decimal (10)</option><option value={16}>Hex (16)</option>
          </select>
        </Field>
      </div>
      {isFinite(dec) && (
        <div className="space-y-2">
          {[{ l: 'Binary', v: dec.toString(2) }, { l: 'Octal', v: dec.toString(8) }, { l: 'Decimal', v: dec.toString(10) }, { l: 'Hex', v: dec.toString(16).toUpperCase() }].map((r) => (
            <div key={r.l} className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2">
              <span className="text-sm text-muted">{r.l}</span>
              <div className="flex items-center gap-2"><span className="font-mono text-sm text-base-c break-all text-right">{r.v}</span><CopyButton text={r.v} /></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Base64Tab() {
  const [text, setText] = useState('Hello, World!');
  const [mode, setMode] = useState<'enc' | 'dec'>('enc');
  let result = '';
  try {
    result = mode === 'enc'
      ? btoa(Array.from(new TextEncoder().encode(text), byte => String.fromCharCode(byte)).join(''))
      : new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(text), char => char.charCodeAt(0)));
  } catch { result = 'Invalid input'; }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['enc', 'dec'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === m ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>{m === 'enc' ? 'Encode' : 'Decode'}</button>
        ))}
      </div>
      <Field label="Input"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px] font-mono" /></Field>
      <div>
        <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">Result</span><CopyButton text={result} /></div>
        <div className="rounded-lg bg-surface-2 p-3 font-mono text-sm break-all min-h-[60px] text-base-c">{result}</div>
      </div>
    </div>
  );
}

function JsonTab() {
  const [text, setText] = useState('{"name":"Universal","version":1,"tools":["calc","qr"]}');
  const [error, setError] = useState('');
  const [pretty, setPretty] = useState('');
  useEffect(() => {
    try { setError(''); setPretty(JSON.stringify(JSON.parse(text), null, 2)); }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Invalid JSON'); setPretty(''); }
  }, [text]);
  return (
    <div className="space-y-4">
      <Field label="JSON input"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[100px] font-mono text-sm" /></Field>
      {error ? <div className="text-sm text-error-500">{error}</div> :
        <div>
          <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">Formatted</span><CopyButton text={pretty} /></div>
          <pre className="rounded-lg bg-surface-2 p-3 font-mono text-sm overflow-x-auto max-h-64 text-base-c whitespace-pre-wrap">{pretty}</pre>
        </div>}
    </div>
  );
}

function UuidTab() {
  const [uuids, setUuids] = useState<string[]>([]);
  const gen = () => {
    const arr: string[] = [];
    const c = crypto as Crypto & { randomUUID?: () => string };
    for (let k = 0; k < 5; k++) {
      if (typeof c.randomUUID === 'function') {
        arr.push(c.randomUUID());
      } else {
        const b = new Uint8Array(16); crypto.getRandomValues(b);
        b[6] = (b[6] & 0x0f) | 0x40; b[8] = (b[8] & 0x3f) | 0x80;
        const h = [...b].map((x) => x.toString(16).padStart(2, '0'));
        arr.push(`${h.slice(0,4).join('')}-${h.slice(4,6).join('')}-${h.slice(6,8).join('')}-${h.slice(8,10).join('')}-${h.slice(10,16).join('')}`);
      }
    }
    setUuids(arr);
  };
  useEffect(() => { gen(); }, []);
  return (
    <div className="space-y-4">
      <button onClick={gen} className="btn btn-primary w-full">Generate 5 UUIDs</button>
      <div className="space-y-1.5">
        {uuids.map((u, i) => (
          <div key={i} className="flex justify-between items-center px-3 py-2 rounded-lg bg-surface-2">
            <span className="font-mono text-sm text-base-c">{u}</span>
            <CopyButton text={u} />
          </div>
        ))}
      </div>
    </div>
  );
}

function HashTab() {
  const [text, setText] = useState('Hello');
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [hashError, setHashError] = useState('');
  useEffect(() => {
    let current = true;
    (async () => {
      const bytes = new TextEncoder().encode(text);
      const algos = ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512'];
      const out: Record<string, string> = {};
      for (const a of algos) {
        try {
          const buf = await crypto.subtle.digest(a, bytes);
          out[a] = [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
        } catch { /* Report unavailable algorithms after the batch completes. */ }
      }
      if (current) { setHashes(out); setHashError(Object.keys(out).length ? '' : 'Hashing requires a browser with Web Crypto on HTTPS or localhost.'); }
    })();
    return () => { current = false; };
  }, [text]);
  return (
    <div className="space-y-4">
      {hashError && <p role="alert" className="text-sm text-error-500">{hashError}</p>}
      <Field label="Text to hash"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[60px] font-mono" /></Field>
      <div className="space-y-2">
        {Object.entries(hashes).map(([algo, hex]) => (
          <div key={algo} className="rounded-lg bg-surface-2 p-3">
            <div className="flex justify-between items-center mb-1"><span className="text-xs font-semibold text-muted">{algo}</span><CopyButton text={hex} /></div>
            <div className="font-mono text-xs break-all text-base-c">{hex}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RegexTab() {
  const [pattern, setPattern] = useState('\\b\\w+@\\w+\\.\\w+\\b');
  const [flags, setFlags] = useState('g');
  const [text, setText] = useState('Contact us at hello@universal.app or support@universal.app');
  const { result, error, pending } = useRegexTask({ mode: 'match', pattern, flags, text });
  const matches = result?.matches ?? [];
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input value={pattern} onChange={(e) => setPattern(e.target.value)} className="input-base font-mono flex-1" placeholder="Pattern" />
        <input value={flags} onChange={(e) => setFlags(e.target.value)} className="input-base w-20 font-mono" placeholder="flags" />
      </div>
      <Field label="Test string"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px] font-mono text-sm" /></Field>
      {pending && <div role="status" className="text-xs text-muted">Processing…</div>}
      {error ? <div role="alert" className="text-sm text-error-500">{error}</div> : (
        <div>
          <div className="text-xs text-muted mb-2">{matches.length} match(es)</div>
          <div className="space-y-1">
            {matches.map((m, i) => <div key={i} className="px-3 py-1.5 rounded bg-primary-500/10 text-primary-600 dark:text-primary-400 font-mono text-sm">{m}</div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function UrlTab() {
  const [text, setText] = useState('https://example.com/search?q=hello world&lang=en');
  const [mode, setMode] = useState<'enc' | 'dec'>('enc');
  let result = '';
  try { result = mode === 'enc' ? encodeURIComponent(text) : decodeURIComponent(text); } catch { result = 'Invalid'; }
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['enc', 'dec'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === m ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>{m === 'enc' ? 'Encode' : 'Decode'}</button>
        ))}
      </div>
      <Field label="Input"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px] font-mono text-sm" /></Field>
      <div>
        <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">Result</span><CopyButton text={result} /></div>
        <div className="rounded-lg bg-surface-2 p-3 font-mono text-sm break-all text-base-c">{result}</div>
      </div>
    </div>
  );
}

function hexToRgb(hex: string): [number, number, number] | null {
  const m = hex.replace('#', '').match(/^([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function ColorTab() {
  const [hex, setHex] = useState('#3366ff');
  const rgb = hexToRgb(hex);
  const hsl = rgb ? rgbToHsl(...rgb) : null;
  const rgbStr = rgb ? `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})` : 'Invalid';
  const hslStr = hsl ? `hsl(${hsl[0]}, ${hsl[1]}%, ${hsl[2]}%)` : 'Invalid';
  return (
    <div className="space-y-4">
      <Field label="Hex color"><input value={hex} onChange={(e) => setHex(e.target.value)} className="input-base font-mono" /></Field>
      <div className="rounded-xl border border-c p-4 flex items-center gap-4" style={{ background: rgb ? hex : 'transparent' }}>
        <div className="w-16 h-16 rounded-lg border border-c shrink-0" style={{ background: rgb ? hex : '#ccc' }} />
        <div className="space-y-1 text-sm">
          <div className="text-base-c font-mono">{rgb ? hex : 'Invalid hex'}</div>
          <div className="text-muted font-mono">{rgbStr}</div>
          <div className="text-muted font-mono">{hslStr}</div>
        </div>
      </div>
      <div className="space-y-2">
        {[{ l: 'HEX', v: rgb ? hex : '—' }, { l: 'RGB', v: rgbStr }, { l: 'HSL', v: hslStr }].map((r) => (
          <div key={r.l} className="flex justify-between items-center px-3 py-2.5 rounded-lg bg-surface-2">
            <span className="text-sm text-muted">{r.l}</span>
            <div className="flex items-center gap-2"><span className="font-mono text-sm text-base-c">{r.v}</span><CopyButton text={r.v} /></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AsciiTab() {
  const [query, setQuery] = useState('');
  const rows = [];
  for (let i = 32; i <= 126; i++) {
    const ch = String.fromCharCode(i);
    if (query && !ch.includes(query) && !String(i).includes(query) && !i.toString(16).includes(query.toLowerCase())) continue;
    rows.push({ code: i, ch, hex: i.toString(16).toUpperCase(), bin: i.toString(2).padStart(8, '0') });
  }
  return (
    <div className="space-y-4">
      <input value={query} onChange={(e) => setQuery(e.target.value)} className="input-base" placeholder="Search character, decimal, or hex…" />
      <div className="grid grid-cols-1 gap-1 max-h-80 overflow-y-auto">
        <div className="grid grid-cols-4 gap-2 text-xs font-semibold text-muted uppercase px-3 py-1.5 sticky top-0 bg-surface">
          <span>Char</span><span>Dec</span><span>Hex</span><span>Bin</span>
        </div>
        {rows.map((r) => (
          <div key={r.code} className="grid grid-cols-4 gap-2 px-3 py-1.5 rounded-lg hover:bg-surface-2 font-mono text-sm">
            <span className="text-base-c">{r.ch === ' ' ? '␣' : r.ch}</span>
            <span className="text-muted">{r.code}</span>
            <span className="text-muted">0x{r.hex}</span>
            <span className="text-muted">{r.bin}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PasswordTab() {
  const [length, setLength] = useState(16);
  const [opts, setOpts] = useState({ upper: true, lower: true, number: true, symbol: true, noAmbig: false });
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [history, setHistory] = useState<string[]>([]);

  const gen = () => {
    let pw: string;
    try { pw = generatePassword(length, opts); } catch (error) { setPassword(''); setError(error instanceof Error ? error.message : 'Generation failed'); return; }
    setError('');
    setPassword(pw);
    setHistory((h) => [pw, ...h].slice(0, 5));
  };

  useEffect(() => { setPassword(generatePassword(16, { upper: true, lower: true, number: true, symbol: true, noAmbig: false })); }, []);

  const strength = password.length >= 16 && [opts.upper, opts.lower, opts.number, opts.symbol].filter(Boolean).length >= 3 ? 'Strong' : password.length >= 12 ? 'Good' : 'Weak';
  const strengthColor = strength === 'Strong' ? 'text-success-500' : strength === 'Good' ? 'text-warning-500' : 'text-error-500';

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface-2 p-4">
        <div className="flex justify-between items-center mb-2">
          <span className={`text-xs font-semibold uppercase ${strengthColor}`}>{strength}</span>
          <CopyButton text={password} />
        </div>
        <div className="font-mono text-base text-base-c break-all select-all">{password}</div>
      </div>
      <Field label={`Length: ${length}`}>
        <input type="range" min={4} max={64} value={length} onChange={(e) => setLength(parseInt(e.target.value))} className="w-full accent-primary-600" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        {([['upper', 'Uppercase'], ['lower', 'Lowercase'], ['number', 'Numbers'], ['symbol', 'Symbols'], ['noAmbig', 'Exclude ambiguous (O, 0, l, 1, I, |)']] as const).map(([k, label]) => (
          <label key={k} className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer ${opts[k] ? 'bg-primary-500/10 border border-primary-500/30' : 'bg-surface-2 border border-transparent'} ${k === 'noAmbig' ? 'col-span-2' : 'col-span-1'}`}>
            <input type="checkbox" checked={opts[k]} onChange={(e) => setOpts((o) => ({ ...o, [k]: e.target.checked }))} className="accent-primary-600" />
            <span className="text-sm text-base-c">{label}</span>
          </label>
        ))}
      </div>
      {error && <div role="alert" className="text-sm text-error-500">{error}</div>}
      <button onClick={gen} className="btn btn-primary w-full"><KeyRound size={16} /> Generate password</button>
      {history.length > 1 && (
        <div className="space-y-1">
          <div className="text-xs text-muted uppercase">Recent</div>
          {history.slice(1).map((h, i) => (
            <div key={i} className="flex justify-between items-center px-3 py-1.5 rounded-lg bg-surface-2">
              <span className="font-mono text-xs text-muted break-all">{h}</span>
              <CopyButton text={h} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgrammingModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('base');
  return (
    <Panel>
      <ToolHeader title="Programming Tools" subtitle="Base, Base64, JSON, UUID, hash, regex, URL, color, ASCII, password" icon={Code2} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'base', label: 'Base', icon: Binary },
        { id: 'b64', label: 'Base64', icon: Code2 },
        { id: 'json', label: 'JSON', icon: FileJson },
        { id: 'uuid', label: 'UUID', icon: Fingerprint },
        { id: 'hash', label: 'Hash', icon: Hash },
        { id: 'regex', label: 'Regex', icon: Regex },
        { id: 'url', label: 'URL', icon: Link2 },
        { id: 'color', label: 'Color', icon: Palette },
        { id: 'ascii', label: 'ASCII', icon: Type },
        { id: 'password', label: 'Password', icon: KeyRound },
      ]} />
      <div className="mt-4">
        {tab === 'base' && <BaseConvertTab />}
        {tab === 'b64' && <Base64Tab />}
        {tab === 'json' && <JsonTab />}
        {tab === 'uuid' && <UuidTab />}
        {tab === 'hash' && <HashTab />}
        {tab === 'regex' && <RegexTab />}
        {tab === 'url' && <UrlTab />}
        {tab === 'color' && <ColorTab />}
        {tab === 'ascii' && <AsciiTab />}
        {tab === 'password' && <PasswordTab />}
      </div>
    </Panel>
  );
}
