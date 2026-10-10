import { useEffect, useRef, useState } from 'react';
import { CalendarClock, Clock, Timer, Globe, Play, Pause, RotateCcw, AlarmClock } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, ResultRow } from '@/components/ui';

import { diffBreakdown, todayLocal } from '@/lib/dateMath';

function fmt2(n: number) { return String(n).padStart(2, '0'); }

function AgeTab() {
  const [dob, setDob] = useState('');
  const [until, setUntil] = useState(todayLocal);
  const from = dob ? new Date(dob) : null;
  const to = until ? new Date(until) : new Date();
  const d = from && to ? diffBreakdown(from, to) : null;
  return (
    <div className="space-y-4">
      <Field label="Date of birth"><input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="input-base" /></Field>
      <Field label="Age at date" hint="Defaults to today"><input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="input-base" /></Field>
      {d && d.totalMs >= 0 && (
        <div>
          <div className="rounded-xl bg-primary-500/8 border border-primary-500/20 p-4 text-center mb-3">
            <div className="text-3xl font-bold text-primary-600 dark:text-primary-400">{d.years}y {d.months}m {d.days}d</div>
          </div>
          <ResultRow label="Total days" value={d.totalDays.toLocaleString()} />
          <ResultRow label="Total hours" value={d.totalHours.toLocaleString()} />
          <ResultRow label="Total minutes" value={d.totalMins.toLocaleString()} />
        </div>
      )}
    </div>
  );
}

function DateDiffTab() {
  const [a, setA] = useState('');
  const [b, setB] = useState(todayLocal);
  const da = a ? new Date(a) : null;
  const db = b ? new Date(b) : null;
  const d = da && db ? diffBreakdown(da, db) : null;
  return (
    <div className="space-y-4">
      <Field label="First date"><input type="date" value={a} onChange={(e) => setA(e.target.value)} className="input-base" /></Field>
      <Field label="Second date"><input type="date" value={b} onChange={(e) => setB(e.target.value)} className="input-base" /></Field>
      {d && <div><ResultRow label="Difference (days)" value={Math.abs(d.totalDays).toLocaleString()} /><ResultRow label="Difference (hours)" value={Math.abs(d.totalHours).toLocaleString()} /><ResultRow label="Difference (minutes)" value={Math.abs(d.totalMins).toLocaleString()} /></div>}
    </div>
  );
}

function StopwatchTab() {
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const ref = useRef<number | null>(null);
  const elapsedRef = useRef(elapsed);
  elapsedRef.current = elapsed;
  useEffect(() => {
    if (!running) return;
    const start = Date.now() - elapsedRef.current;
    ref.current = window.setInterval(() => setElapsed(Date.now() - start), 31);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  const ms = elapsed % 1000; const s = Math.floor(elapsed / 1000) % 60; const m = Math.floor(elapsed / 60000) % 60; const h = Math.floor(elapsed / 3600000);
  return (
    <div className="space-y-4">
      <div className="text-center text-5xl font-mono font-bold text-base-c py-6 tabular-nums">
        {h > 0 ? `${h}:${fmt2(m)}:${fmt2(s)}` : `${fmt2(m)}:${fmt2(s)}`}<span className="text-2xl text-muted">.{fmt2(Math.floor(ms / 10))}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => setRunning((r) => !r)} className="btn btn-primary">{running ? <><Pause size={16}/> Pause</> : <><Play size={16}/> Start</>}</button>
        <button onClick={() => setLaps((l) => [elapsed, ...l].slice(0, 1000))} disabled={!running} className="btn btn-soft">Lap</button>
        <button onClick={() => { setRunning(false); setElapsed(0); setLaps([]); }} className="btn btn-soft"><RotateCcw size={16}/> Reset</button>
      </div>
      {laps.length > 0 && (
        <div className="max-h-40 overflow-y-auto space-y-1">
          {laps.map((l, i) => (
            <div key={i} className="flex justify-between text-sm font-mono px-3 py-1.5 rounded-lg bg-surface-2">
              <span className="text-muted">Lap {laps.length - i}</span>
              <span>{fmt2(Math.floor(l/60000))}:{fmt2(Math.floor(l/1000)%60)}.{fmt2(Math.floor((l%1000)/10))}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TimerTab() {
  const [target, setTarget] = useState(60);
  const [remaining, setRemaining] = useState(0);
  const [running, setRunning] = useState(false);
  const ref = useRef<number | null>(null);
  const deadline = useRef(0);
  useEffect(() => {
    if (!running) return;
    ref.current = window.setInterval(() => {
      const next = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setRemaining(next);
      if (next === 0) setRunning(false);
    }, 250);
    return () => { if (ref.current) clearInterval(ref.current); };
  }, [running]);
  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <Field label="Minutes"><input type="number" min="0" max="10080" value={Math.floor(target / 60)} onChange={(e) => setTarget(Math.min(10080, Math.max(0, Math.floor(+e.target.value))) * 60 + (target % 60))} className="input-base w-24" /></Field>
        <Field label="Seconds"><input type="number" min="0" max="59" value={target % 60} onChange={(e) => setTarget(Math.floor(target / 60) * 60 + Math.min(59, Math.max(0, Math.floor(+e.target.value))))} className="input-base w-24" /></Field>
      </div>
      <div className="text-center text-5xl font-mono font-bold text-base-c py-6 tabular-nums">{fmt2(Math.floor(remaining / 60))}:{fmt2(remaining % 60)}</div>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => { if (!running && Number.isFinite(target) && target > 0) { deadline.current = Date.now() + target * 1000; setRemaining(target); setRunning(true); } }} className="btn btn-primary"><Play size={16}/> Start</button>
        <button onClick={() => { setRunning(false); setRemaining(0); }} className="btn btn-soft"><RotateCcw size={16}/> Reset</button>
      </div>
    </div>
  );
}

const ZONES = [
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Paris', tz: 'Europe/Paris' },
  { label: 'Dubai', tz: 'Asia/Dubai' },
  { label: 'Mumbai', tz: 'Asia/Kolkata' },
  { label: 'Singapore', tz: 'Asia/Singapore' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
];

function WorldClockTab() {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i); }, []);
  return (
    <div className="space-y-2">
      {ZONES.map((z) => (
        <div key={z.tz} className="flex justify-between items-center px-4 py-3 rounded-lg bg-surface-2">
          <span className="text-sm font-medium">{z.label}</span>
          <span className="font-mono text-base-c">{now.toLocaleTimeString('en-US', { timeZone: z.tz, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
        </div>
      ))}
    </div>
  );
}

export default function DateTimeModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('age');
  return (
    <Panel>
      <ToolHeader title="Date & Time" subtitle="Age, date diff, stopwatch, timer, world clock" icon={CalendarClock} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'age', label: 'Age', icon: CalendarClock },
        { id: 'diff', label: 'Diff', icon: Clock },
        { id: 'stopwatch', label: 'Stopwatch', icon: Timer },
        { id: 'timer', label: 'Timer', icon: AlarmClock },
        { id: 'world', label: 'World', icon: Globe },
      ]} />
      <div className="mt-4">
        {tab === 'age' && <AgeTab />}
        {tab === 'diff' && <DateDiffTab />}
        {tab === 'stopwatch' && <StopwatchTab />}
        {tab === 'timer' && <TimerTab />}
        {tab === 'world' && <WorldClockTab />}
      </div>
    </Panel>
  );
}
