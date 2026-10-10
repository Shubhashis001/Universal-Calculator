import { useMemo, useState } from 'react';
import { ArrowLeftRight, Ruler } from 'lucide-react';
import { Panel, ToolHeader, Select } from '@/components/ui';
import { categories, convertTemp, tempUnits } from './units';

function fmt(n: number): string {
  if (!isFinite(n)) return '—';
  const abs = Math.abs(n);
  if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) return n.toExponential(6);
  return Number(n.toPrecision(10)).toString();
}

export default function ConverterModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [catId, setCatId] = useState('length');
  const [isTemp, setIsTemp] = useState(false);
  const [fromIdx, setFromIdx] = useState(0);
  const [toIdx, setToIdx] = useState(1);
  const [value, setValue] = useState('1');

  const cat = useMemo(() => categories.find((c) => c.id === catId)!, [catId]);

  const result = useMemo(() => {
    const v = parseFloat(value);
    if (!isFinite(v)) return '';
    if (isTemp) return fmt(convertTemp(v, tempUnits[fromIdx].name, tempUnits[toIdx].name));
    const units = cat.units;
    if (catId === 'fuel' && (units[fromIdx].factor === -1 || units[toIdx].factor === -1)) {
      // L/100km special: convert via km/L
      const fromKml = units[fromIdx].factor === -1 ? (v > 0 ? 100 / v : Infinity) : v * units[fromIdx].factor;
      if (units[toIdx].factor === -1) return fmt(fromKml > 0 ? 100 / fromKml : Infinity);
      return fmt(fromKml / units[toIdx].factor);
    }
    const base = v * units[fromIdx].factor;
    return fmt(base / units[toIdx].factor);
  }, [value, fromIdx, toIdx, cat, isTemp, catId]);

  const switchCat = (id: string) => {
    const isT = id === 'temperature';
    setIsTemp(isT);
    if (!isT) setCatId(id);
    setFromIdx(0); setToIdx(1); setValue('1');
  };

  const swap = () => { setFromIdx(toIdx); setToIdx(fromIdx); };
  const units = isTemp ? tempUnits : cat.units;

  return (
    <Panel>
      <ToolHeader title="Unit Converter" subtitle="Convert between units across many categories" icon={Ruler} onStar={onStar} starred={starred} />
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <button key={c.id} onClick={() => switchCat(c.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${catId === c.id && !isTemp ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted hover:text-base-c'}`}>
              {c.name}
            </button>
          ))}
          <button onClick={() => switchCat('temperature')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium ${isTemp ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted hover:text-base-c'}`}>
            Temperature
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 responsive-fields">
          <div>
            <span className="text-xs font-medium text-muted uppercase tracking-wide">From</span>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)} className="input-base mt-1.5 text-lg font-mono" />
            <Select value={fromIdx} onChange={(v) => setFromIdx(+v)} className="mt-2">
              {units.map((u, i) => <option key={u.name} value={i}>{u.name} ({u.symbol})</option>)}
            </Select>
          </div>
          <div>
            <span className="text-xs font-medium text-muted uppercase tracking-wide">To</span>
            <div className="input-base mt-1.5 text-lg font-mono text-primary-600 dark:text-primary-400 min-h-[2.75rem] flex items-center">{result}</div>
            <div className="flex gap-2 mt-2">
              <Select value={toIdx} onChange={(v) => setToIdx(+v)} className="flex-1">
                {units.map((u, i) => <option key={u.name} value={i}>{u.name} ({u.symbol})</option>)}
              </Select>
              <button onClick={swap} className="btn btn-soft !px-3" aria-label="Swap"><ArrowLeftRight size={16} /></button>
            </div>
          </div>
        </div>

        <div className="rounded-lg bg-surface-2 p-3 text-sm text-muted">
          {value || 0} {units[fromIdx]?.symbol} = <span className="text-base-c font-semibold font-mono">{result}</span> {units[toIdx]?.symbol}
        </div>
      </div>
    </Panel>
  );
}
