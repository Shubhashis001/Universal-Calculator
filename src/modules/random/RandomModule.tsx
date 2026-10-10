import { useState } from 'react';
import { Dices, Coins, Ticket, Shuffle, ListChecks, RotateCcw } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field } from '@/components/ui';

function DiceTab() {
  const [countStr, setCountStr] = useState('2');
  const [sides, setSides] = useState(6);
  const [rolls, setRolls] = useState<number[]>([]);
  const [rolling, setRolling] = useState(false);

  const count = Math.max(1, Math.min(12, parseInt(countStr) || 1));

  const roll = () => {
    setRolling(true);
    setTimeout(() => {
      const r = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
      setRolls(r); setRolling(false);
    }, 300);
  };

  const total = rolls.reduce((a, b) => a + b, 0);
  const max = count * sides;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Number of dice">
          <input type="number" min={1} max={12} value={countStr}
            onChange={(e) => setCountStr(e.target.value)}
            onBlur={() => setCountStr(String(count))}
            className="input-base" />
        </Field>
        <Field label="Sides per die">
          <select value={sides} onChange={(e) => setSides(parseInt(e.target.value))} className="input-base">
            {[4, 6, 8, 10, 12, 20, 100].map((s) => <option key={s} value={s}>d{s}</option>)}
          </select>
        </Field>
      </div>
      <button onClick={roll} disabled={rolling} className="btn btn-primary w-full text-base py-3">
        <Dices size={20} /> {rolling ? 'Rolling…' : 'Roll dice'}
      </button>
      {rolls.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 justify-center">
            {rolls.map((r, i) => (
              <div key={i} className={`w-14 h-14 rounded-xl border-2 flex items-center justify-center text-xl font-bold ${rolling ? 'animate-pulse border-primary-500/40' : 'border-primary-500/30 bg-primary-500/10'} text-base-c`}>
                {rolling ? '?' : r}
              </div>
            ))}
          </div>
          <div className="flex justify-around text-sm">
            <div className="text-center">
              <div className="text-muted text-xs uppercase tracking-wide">Total</div>
              <div className="text-base-c font-semibold text-lg">{total}</div>
            </div>
            <div className="text-center">
              <div className="text-muted text-xs uppercase tracking-wide">Average</div>
              <div className="text-base-c font-semibold text-lg">{(total / count).toFixed(2)}</div>
            </div>
            <div className="text-center">
              <div className="text-muted text-xs uppercase tracking-wide">Max possible</div>
              <div className="text-base-c font-semibold text-lg">{max}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CoinTab() {
  const [result, setResult] = useState<'heads' | 'tails' | null>(null);
  const [flipping, setFlipping] = useState(false);
  const [stats, setStats] = useState({ heads: 0, tails: 0 });
  const [history, setHistory] = useState<('heads' | 'tails')[]>([]);

  const flip = () => {
    setFlipping(true);
    setTimeout(() => {
      const buf = new Uint8Array(1);
      crypto.getRandomValues(buf);
      const r: 'heads' | 'tails' = buf[0] % 2 === 0 ? 'heads' : 'tails';
      setResult(r);
      setStats((s) => ({ ...s, [r]: s[r] + 1 }));
      setHistory((h) => [r, ...h].slice(0, 20));
      setFlipping(false);
    }, 400);
  };

  return (
    <div className="space-y-5">
      <button onClick={flip} disabled={flipping} className="btn btn-primary w-full text-base py-3">
        <Coins size={20} /> {flipping ? 'Flipping…' : 'Flip coin'}
      </button>
      <div className="flex justify-center">
        <div className={`w-28 h-28 rounded-full border-4 flex items-center justify-center text-2xl font-bold transition-transform duration-300 ${flipping ? 'animate-spin border-primary-500/40' : result ? 'border-primary-500/40 bg-primary-500/10 text-base-c' : 'border-strong text-subtle'}`}>
          {flipping ? '?' : result ? result.toUpperCase() : '—'}
        </div>
      </div>
      {(stats.heads > 0 || stats.tails > 0) && (
        <div className="space-y-3">
          <div className="flex justify-around text-sm">
            <div className="text-center"><div className="text-muted text-xs uppercase">Heads</div><div className="text-base-c font-semibold text-lg">{stats.heads}</div></div>
            <div className="text-center"><div className="text-muted text-xs uppercase">Tails</div><div className="text-base-c font-semibold text-lg">{stats.tails}</div></div>
            <div className="text-center"><div className="text-muted text-xs uppercase">Total</div><div className="text-base-c font-semibold text-lg">{stats.heads + stats.tails}</div></div>
          </div>
          <div className="flex flex-wrap gap-1.5 justify-center">
            {history.map((h, i) => (
              <span key={i} className={`text-xs px-2 py-1 rounded ${h === 'heads' ? 'bg-primary-500/15 text-primary-600 dark:text-primary-400' : 'bg-accent-500/15 text-accent-600 dark:text-accent-400'}`}>{h[0].toUpperCase()}</span>
            ))}
          </div>
          <button onClick={() => { setStats({ heads: 0, tails: 0 }); setHistory([]); setResult(null); }} className="btn btn-soft w-full text-sm"><RotateCcw size={14} /> Reset</button>
        </div>
      )}
    </div>
  );
}

function LotteryTab() {
  const [pool, setPool] = useState('49');
  const [pick, setPick] = useState('6');
  const [results, setResults] = useState<number[]>([]);

  const draw = () => {
    const n = Number(pool), k = Number(pick);
    if (!Number.isInteger(n) || !Number.isInteger(k) || n < 1 || n > 10000 || k < 1 || k > n) return;
    const nums = Array.from({ length: n }, (_, i) => i + 1);
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    setResults(nums.slice(0, k).sort((a, b) => a - b));
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Pool size (1 to 10,000)"><input type="number" min={1} max={10000} value={pool} onChange={(e) => setPool(e.target.value)} className="input-base" /></Field>
        <Field label="How many to pick"><input type="number" min={1} value={pick} onChange={(e) => setPick(e.target.value)} className="input-base" /></Field>
      </div>
      <button onClick={draw} className="btn btn-primary w-full text-base py-3"><Ticket size={20} /> Draw numbers</button>
      {results.length > 0 && (
        <div className="flex flex-wrap gap-2 justify-center pt-2">
          {results.map((n, i) => (
            <div key={i} className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-accent-500 text-white flex items-center justify-center font-bold text-lg shadow-md">
              {n}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fyShuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function PickTab() {
  const [raw, setRaw] = useState('Apple\nBanana\nCherry\nDate\nElderberry');
  const [pick, setPick] = useState('1');
  const [results, setResults] = useState<string[]>([]);

  const items = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  const draw = () => {
    const k = Math.max(1, parseInt(pick) || 1);
    setResults(fyShuffle(items).slice(0, k));
  };

  return (
    <div className="space-y-4">
      <Field label="Items (one per line)">
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="input-base min-h-[120px] text-sm font-mono" />
      </Field>
      <div className="flex gap-2">
        <Field label="Pick how many"><input type="number" min={1} value={pick} onChange={(e) => setPick(e.target.value)} className="input-base w-32" /></Field>
        <button onClick={draw} disabled={items.length === 0} className="btn btn-primary flex-1 mt-auto"><ListChecks size={16} /> Pick random</button>
      </div>
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="px-4 py-2.5 rounded-lg bg-primary-500/10 border border-primary-500/20 text-base-c font-medium flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-primary-500 text-white flex items-center justify-center text-xs font-bold">{i + 1}</span>
              {r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ShuffleTab() {
  const [raw, setRaw] = useState('Apple\nBanana\nCherry\nDate\nElderberry');
  const [results, setResults] = useState<string[]>([]);

  const items = raw.split('\n').map((s) => s.trim()).filter(Boolean);
  const shuffle = () => setResults(fyShuffle(items));

  return (
    <div className="space-y-4">
      <Field label="Items to shuffle (one per line)">
        <textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="input-base min-h-[120px] text-sm font-mono" />
      </Field>
      <button onClick={shuffle} disabled={items.length === 0} className="btn btn-primary w-full"><Shuffle size={16} /> Shuffle list</button>
      {results.length > 0 && (
        <div className="space-y-1.5">
          {results.map((r, i) => (
            <div key={i} className="px-3 py-2 rounded-lg bg-surface-2 text-base-c text-sm flex items-center gap-3">
              <span className="text-muted text-xs font-mono w-6">{i + 1}.</span>{r}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function RandomModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('dice');
  return (
    <Panel>
      <ToolHeader title="Random & Chance" subtitle="Dice, coin flip, lottery, random pick, shuffle" icon={Dices} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'dice', label: 'Dice', icon: Dices },
        { id: 'coin', label: 'Coin', icon: Coins },
        { id: 'lottery', label: 'Lottery', icon: Ticket },
        { id: 'pick', label: 'Pick', icon: ListChecks },
        { id: 'shuffle', label: 'Shuffle', icon: Shuffle },
      ]} />
      <div className="mt-4">
        {tab === 'dice' && <DiceTab />}
        {tab === 'coin' && <CoinTab />}
        {tab === 'lottery' && <LotteryTab />}
        {tab === 'pick' && <PickTab />}
        {tab === 'shuffle' && <ShuffleTab />}
      </div>
    </Panel>
  );
}
