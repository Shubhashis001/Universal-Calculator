import { useMemo, useState } from 'react';
import { simplifyFraction } from '@/lib/fraction';
import { factorial } from '@/lib/evaluate';
import { Sigma, Percent, BarChart3, Divide, FunctionSquare, Boxes, Hash, Ruler } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, ResultCard, ResultRow } from '@/components/ui';

function PercentTab() {
  const [a, setA] = useState('25'); const [b, setB] = useState('80');
  const av = parseFloat(a), bv = parseFloat(b);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Value A"><input type="number" value={a} onChange={(e) => setA(e.target.value)} className="input-base" /></Field>
        <Field label="Value B"><input type="number" value={b} onChange={(e) => setB(e.target.value)} className="input-base" /></Field>
      </div>
      {isFinite(av) && isFinite(bv) && (
        <div className="space-y-2">
          <ResultCard label="A% of B" value={(av / 100 * bv).toLocaleString()} />
          <ResultCard label="A is what % of B" value={bv ? (av / bv * 100).toFixed(2) + '%' : '—'} />
          <ResultCard label="% increase A→B" value={av ? ((bv - av) / av * 100).toFixed(2) + '%' : '—'} />
        </div>
      )}
    </div>
  );
}

function StatsTab() {
  const [input, setInput] = useState('1, 2, 3, 4, 5, 6, 7, 8, 9, 10');
  const nums = useMemo(() => input.trim().split(/[,\s]+/).filter(Boolean).map(Number).filter((n) => isFinite(n)), [input]);
  const n = nums.length;
  const sum = nums.reduce((a, b) => a + b, 0);
  const mean = n ? sum / n : 0;
  const sorted = [...nums].sort((a, b) => a - b);
  const median = n ? n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2 : 0;
  const variance = n ? nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n : 0;
  const sd = Math.sqrt(variance);
  const freq: Record<number, number> = {}; let mode = NaN; let maxF = 0;
  nums.forEach((x) => { freq[x] = (freq[x] || 0) + 1; if (freq[x] > maxF) { maxF = freq[x]; mode = x; } });
  return (
    <div className="space-y-4">
      <Field label="Numbers (comma or space separated)"><textarea maxLength={100000} value={input} onChange={(e) => setInput(e.target.value)} className="input-base min-h-[80px] font-mono" /></Field>
      {n > 0 && (
        <div>
          <ResultRow label="Count" value={String(n)} />
          <ResultRow label="Sum" value={sum.toLocaleString()} />
          <ResultRow label="Mean" value={mean.toFixed(4)} />
          <ResultRow label="Median" value={String(median)} />
          <ResultRow label="Mode" value={maxF > 1 ? String(mode) : 'None'} />
          <ResultRow label="Range" value={`${sorted[0]} – ${sorted[n - 1]}`} />
          <ResultRow label="Variance" value={variance.toFixed(4)} />
          <ResultRow label="Std deviation" value={sd.toFixed(4)} />
          <ResultRow label="Min / Max" value={`${sorted[0]} / ${sorted[n - 1]}`} />
        </div>
      )}
    </div>
  );
}

function FractionTab() {
  const [num, setNum] = useState('3'); const [den, setDen] = useState('4');
  const n = num.trim() ? Number(num) : NaN, d = den.trim() ? Number(den) : NaN;
  const fraction = simplifyFraction(n, d);
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="Numerator"><input type="number" value={num} onChange={(e) => setNum(e.target.value)} className="input-base" /></Field>
        <Field label="Denominator"><input type="number" value={den} onChange={(e) => setDen(e.target.value)} className="input-base" /></Field>
      </div>
      {fraction && (
        <div className="space-y-2">
          <ResultCard label="Simplified" value={`${fraction.numerator}/${fraction.denominator}`} />
          <ResultCard label="Mixed number" value={fraction.mixed} />
          <ResultCard label="Decimal" value={(n / d).toFixed(6)} />
          <ResultCard label="Percentage" value={(n / d * 100).toFixed(2) + '%'} />
        </div>
      )}
    </div>
  );
}

function TrigTab() {
  const [deg, setDeg] = useState('30');
  const [mode, setMode] = useState<'deg' | 'rad'>('deg');
  const v = parseFloat(deg);
  const r = mode === 'deg' ? v * Math.PI / 180 : v;
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['deg', 'rad'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-medium ${mode === m ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>{m.toUpperCase()}</button>
        ))}
      </div>
      <Field label="Angle"><input type="number" value={deg} onChange={(e) => setDeg(e.target.value)} className="input-base" /></Field>
      {isFinite(v) && (
        <div>
          <ResultRow label="sin" value={Math.sin(r).toFixed(8)} />
          <ResultRow label="cos" value={Math.cos(r).toFixed(8)} />
          <ResultRow label="tan" value={Math.tan(r).toFixed(8)} />
          <ResultRow label="csc" value={(1 / Math.sin(r)).toFixed(8)} />
          <ResultRow label="sec" value={(1 / Math.cos(r)).toFixed(8)} />
          <ResultRow label="cot" value={(1 / Math.tan(r)).toFixed(8)} />
        </div>
      )}
    </div>
  );
}

function CombinatoricsTab() {
  const [n, setN] = useState('8'); const [r, setR] = useState('3');
  const nv = Number(n), rv = Number(r);
  const fact = (x: number) => Number.isInteger(x) && x >= 0 && x <= 170 ? factorial(x) : NaN;
  const perm = nv >= rv && rv >= 0 ? fact(nv) / fact(nv - rv) : NaN;
  const comb = nv >= rv && rv >= 0 ? fact(nv) / (fact(rv) * fact(nv - rv)) : NaN;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label="n (total)"><input type="number" value={n} onChange={(e) => setN(e.target.value)} className="input-base" /></Field>
        <Field label="r (chosen)"><input type="number" value={r} onChange={(e) => setR(e.target.value)} className="input-base" /></Field>
      </div>
      {nv >= 0 && rv >= 0 && (
        <div className="space-y-2">
          <ResultCard label="Permutation P(n,r)" value={isFinite(perm) ? perm.toLocaleString() : 'Overflow'} />
          <ResultCard label="Combination C(n,r)" value={isFinite(comb) ? comb.toLocaleString() : 'Overflow'} />
          <ResultCard label="n!" value={nv <= 170 ? fact(nv).toLocaleString() : 'Overflow'} />
          <ResultCard label="r!" value={rv <= 170 ? fact(rv).toLocaleString() : 'Overflow'} />
        </div>
      )}
    </div>
  );
}

function LogExpTab() {
  const [base, setBase] = useState('10'); const [val, setVal] = useState('1000');
  const [expBase, setExpBase] = useState('2'); const [expVal, setExpVal] = useState('8');
  const [rootN, setRootN] = useState('3'); const [rootVal, setRootVal] = useState('27');
  const b = parseFloat(base), v = parseFloat(val), eb = parseFloat(expBase), ev = parseFloat(expVal), rn = parseFloat(rootN), rv = parseFloat(rootVal);
  const logVal = b > 0 && b !== 1 ? Math.log(v) / Math.log(b) : NaN;
  return (
    <div className="space-y-5">
      <div>
        <div className="text-sm font-semibold text-base-c mb-2">Logarithm</div>
        <div className="grid grid-cols-2 gap-3 responsive-fields">
          <Field label="Base"><input type="number" value={base} onChange={(e) => setBase(e.target.value)} className="input-base" /></Field>
          <Field label="Value"><input type="number" value={val} onChange={(e) => setVal(e.target.value)} className="input-base" /></Field>
        </div>
        {isFinite(logVal) && <div className="mt-2"><ResultCard label={`log${b}(${v})`} value={logVal.toFixed(6)} /></div>}
      </div>
      <div>
        <div className="text-sm font-semibold text-base-c mb-2">Exponent</div>
        <div className="grid grid-cols-2 gap-3 responsive-fields">
          <Field label="Base"><input type="number" value={expBase} onChange={(e) => setExpBase(e.target.value)} className="input-base" /></Field>
          <Field label="Power"><input type="number" value={expVal} onChange={(e) => setExpVal(e.target.value)} className="input-base" /></Field>
        </div>
        {isFinite(eb) && isFinite(ev) && <div className="mt-2"><ResultCard label={`${eb}^${ev}`} value={Math.pow(eb, ev).toLocaleString(undefined, { maximumFractionDigits: 6 })} /></div>}
      </div>
      <div>
        <div className="text-sm font-semibold text-base-c mb-2">Root</div>
        <div className="grid grid-cols-2 gap-3 responsive-fields">
          <Field label="Degree (n)"><input type="number" value={rootN} onChange={(e) => setRootN(e.target.value)} className="input-base" /></Field>
          <Field label="Value"><input type="number" value={rootVal} onChange={(e) => setRootVal(e.target.value)} className="input-base" /></Field>
        </div>
        {isFinite(rn) && rn !== 0 && <div className="mt-2"><ResultCard label={`${rn}√${rv}`} value={Math.pow(rv, 1 / rn).toLocaleString(undefined, { maximumFractionDigits: 6 })} /></div>}
      </div>
    </div>
  );
}

function GeometryTab() {
  const [shape, setShape] = useState('circle');
  const [a, setA] = useState('5'); const [b, setB] = useState('3');
  const av = parseFloat(a), bv = parseFloat(b);
  let results: { l: string; v: string }[] = [];
  if (shape === 'circle' && isFinite(av)) {
    results = [{ l: 'Area', v: (Math.PI * av * av).toFixed(4) }, { l: 'Circumference', v: (2 * Math.PI * av).toFixed(4) }, { l: 'Diameter', v: (2 * av).toFixed(4) }];
  } else if (shape === 'rectangle' && isFinite(av) && isFinite(bv)) {
    results = [{ l: 'Area', v: (av * bv).toFixed(4) }, { l: 'Perimeter', v: (2 * (av + bv)).toFixed(4) }, { l: 'Diagonal', v: (Math.sqrt(av * av + bv * bv)).toFixed(4) }];
  } else if (shape === 'triangle' && isFinite(av) && isFinite(bv)) {
    results = [{ l: 'Area (½bh)', v: (0.5 * av * bv).toFixed(4) }, { l: 'Hypotenuse (a²+b²)', v: Math.sqrt(av * av + bv * bv).toFixed(4) }];
  } else if (shape === 'sphere' && isFinite(av)) {
    results = [{ l: 'Volume', v: ((4 / 3) * Math.PI * av ** 3).toFixed(4) }, { l: 'Surface area', v: (4 * Math.PI * av * av).toFixed(4) }];
  } else if (shape === 'cylinder' && isFinite(av) && isFinite(bv)) {
    results = [{ l: 'Volume', v: (Math.PI * av * av * bv).toFixed(4) }, { l: 'Surface area', v: (2 * Math.PI * av * (av + bv)).toFixed(4) }];
  } else if (shape === 'cube' && isFinite(av)) {
    results = [{ l: 'Volume', v: (av ** 3).toFixed(4) }, { l: 'Surface area', v: (6 * av * av).toFixed(4) }];
  }
  const labels: Record<string, [string, string?]> = {
    circle: ['Radius'], rectangle: ['Width', 'Height'], triangle: ['Base', 'Height'],
    sphere: ['Radius'], cylinder: ['Radius', 'Height'], cube: ['Side'],
  };
  return (
    <div className="space-y-4">
      <Field label="Shape">
        <select value={shape} onChange={(e) => setShape(e.target.value)} className="input-base">
          <option value="circle">Circle</option><option value="rectangle">Rectangle</option><option value="triangle">Right triangle</option><option value="sphere">Sphere</option><option value="cylinder">Cylinder</option><option value="cube">Cube</option>
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-3 responsive-fields">
        <Field label={labels[shape][0]}><input type="number" value={a} onChange={(e) => setA(e.target.value)} className="input-base" /></Field>
        {labels[shape][1] && <Field label={labels[shape][1]!}><input type="number" value={b} onChange={(e) => setB(e.target.value)} className="input-base" /></Field>}
      </div>
      {results.length > 0 && <div className="space-y-2">{results.map((r) => <ResultCard key={r.l} label={r.l} value={r.v} />)}</div>}
    </div>
  );
}

export default function MathModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('percent');
  return (
    <Panel>
      <ToolHeader title="Mathematics" subtitle="Percent, statistics, fractions, trig, combinatorics, logs, geometry" icon={Sigma} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'percent', label: 'Percent', icon: Percent },
        { id: 'stats', label: 'Statistics', icon: BarChart3 },
        { id: 'fraction', label: 'Fractions', icon: Divide },
        { id: 'trig', label: 'Trig', icon: FunctionSquare },
        { id: 'combo', label: 'Combinatorics', icon: Boxes },
        { id: 'logexp', label: 'Logs & Roots', icon: Hash },
        { id: 'geometry', label: 'Geometry', icon: Ruler },
      ]} />
      <div className="mt-4">
        {tab === 'percent' && <PercentTab />}
        {tab === 'stats' && <StatsTab />}
        {tab === 'fraction' && <FractionTab />}
        {tab === 'trig' && <TrigTab />}
        {tab === 'combo' && <CombinatoricsTab />}
        {tab === 'logexp' && <LogExpTab />}
        {tab === 'geometry' && <GeometryTab />}
      </div>
    </Panel>
  );
}
