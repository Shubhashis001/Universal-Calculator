import { useMemo, useState } from 'react';
import { History, RotateCcw, Delete, Calculator } from 'lucide-react';
import { Panel, ToolHeader } from '@/components/ui';
import { useLocalStorage } from '@/lib/storage';
import { appendCalculatorKey, formattedCalculation, previewCalculation } from '@/lib/calculatorLogic';

const KEYS = ['sin', 'cos', 'tan', 'log', 'ln', 'sqrt', '(', ')', '^', 'pi', 'e', '!'];
type HistoryItem = { expr: string; result: string };

export default function CalculatorModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [expr, setExpr] = useState('');
  const [error, setError] = useState('');
  const [lastCalculation, setLastCalculation] = useState<HistoryItem | null>(null);
  const [memory, setMemory] = useState(0);
  const [history, setHistory] = useLocalStorage<HistoryItem[]>('uuh:calc-history', []);
  const [angleMode, setAngleMode] = useState<'deg' | 'rad'>('deg');

  // Only display valid live results; a trailing sign or open bracket is not an error yet.
  const result = useMemo(() => previewCalculation(expr, angleMode), [expr, angleMode]);
  const inputChanged = (value: string) => {
    setExpr(value);
    setError('');
    setLastCalculation(null);
  };

  const press = (key: string) => {
    setExpr(current => appendCalculatorKey(current, key, lastCalculation !== null));
    setError('');
    setLastCalculation(null);
  };

  const enter = () => {
    if (lastCalculation && expr === lastCalculation.result) return;
    try {
      const calculated = formattedCalculation(expr, angleMode);
      const record = { expr, result: calculated };
      setHistory(items => [record, ...items].slice(0, 30));
      setExpr(calculated); // Commit result: subsequent operators now continue from it.
      setLastCalculation(record);
      setError('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid expression');
      setLastCalculation(null);
    }
  };

  const clear = () => inputChanged('');
  const backspace = () => inputChanged(expr.slice(0, -1));
  const recallMemory = () => inputChanged(lastCalculation ? String(memory) : (expr + String(memory)).slice(0, 1000));
  const adjustMemory = (direction: 1 | -1) => {
    if (!result) return;
    setMemory(current => {
      const updated = current + direction * Number(result);
      return Number.isFinite(updated) ? updated : current;
    });
  };

  return (
    <Panel>
      <ToolHeader title="Calculator" subtitle="Scientific calculator with history & memory" icon={Calculator} onStar={onStar} starred={starred} />
      <div className="space-y-4">
        <div className="rounded-xl bg-surface-2 border border-c p-4">
          <input
            maxLength={1000} aria-label="Calculator expression" value={expr}
            onChange={(event) => inputChanged(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); enter(); } else if (event.key === 'Escape') clear(); }}
            placeholder="Enter expression…" className="w-full bg-transparent text-lg font-mono text-base-c outline-none"
            autoFocus
          />
          <div className="mt-2 min-h-7 text-right font-mono text-lg" aria-live="polite" aria-atomic="true">
            {error ? <span role="alert" className="text-error-500 text-sm">{error}</span> :
              lastCalculation ? <span className="text-primary-600 dark:text-primary-400 text-sm">{lastCalculation.expr} = {lastCalculation.result}</span> :
              result ? <span className="text-primary-600 dark:text-primary-400">= {result}</span> : null}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {(['deg', 'rad'] as const).map((mode) => (
              <button type="button" key={mode} onClick={() => { setAngleMode(mode); setError(''); }}
                className={`px-3 py-1 rounded-md text-xs font-medium ${angleMode === mode ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>
                {mode.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="text-xs text-muted">M: <span className="font-mono text-base-c">{memory}</span></div>
        </div>

        <div className="grid grid-cols-5 gap-1.5">
          {KEYS.map((key) => (
            <button type="button" key={key} onClick={() => press(key)} className="btn btn-soft !py-2.5 text-sm font-mono">{key}</button>
          ))}
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {['7', '8', '9', '+', '%', '4', '5', '6', '-', '/', '1', '2', '3', '*', '^', '0', '.', '(', ')', '!'].map((key, index) =>
            <button type="button" key={`${key}-${index}`} onClick={() => press(key)} className="btn btn-soft !py-2.5 text-base font-mono">{key}</button>)}
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={backspace} className="btn btn-soft !py-2.5" aria-label="Backspace"><Delete size={16} /></button>
          <button type="button" onClick={clear} className="btn btn-soft !py-2.5" aria-label="Clear expression"><RotateCcw size={16} /></button>
          <button type="button" onClick={recallMemory} className="btn btn-soft !py-2.5 text-xs">MR</button>
          <button type="button" onClick={enter} className="btn btn-primary !py-2.5" aria-label="Equals, calculate result">=</button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          <button type="button" onClick={() => setMemory(0)} className="btn btn-soft !py-2.5 text-xs">MC</button>
          <button type="button" onClick={() => adjustMemory(1)} className="btn btn-soft !py-2.5 text-xs">M+</button>
          <button type="button" onClick={() => adjustMemory(-1)} className="btn btn-soft !py-2.5 text-xs">M−</button>
          <div />
        </div>

        {history.length > 0 && (
          <div>
            <div className="flex items-center gap-2 text-sm text-muted mb-2"><History size={15} /> History</div>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {history.map((item, index) => (
                <button type="button" key={index} onClick={() => inputChanged(item.expr)}
                  className="w-full flex justify-between items-center px-3 py-2 rounded-lg hover:bg-surface-2 text-sm font-mono">
                  <span className="text-muted truncate">{item.expr}</span>
                  <span className="text-primary-600 dark:text-primary-400 ml-2 shrink-0">= {item.result}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}
