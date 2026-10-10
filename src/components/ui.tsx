import { useEffect, useState, type ReactNode } from 'react';
import { Star } from 'lucide-react';

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card p-3 sm:p-5 fade-in ${className}`}>{children}</div>;
}

export function ToolHeader({
  title, subtitle, icon: Icon, onStar, starred,
}: {
  title: string; subtitle: string; icon: React.ElementType; onStar?: () => void; starred?: boolean;
}) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-11 h-11 rounded-xl bg-primary-500/10 text-primary-600 dark:text-primary-400 flex items-center justify-center shrink-0">
        <Icon size={22} />
      </div>
      <div className="flex-1 min-w-0">
        <h1 className="text-xl font-semibold text-base-c leading-tight">{title}</h1>
        <p className="text-sm text-muted mt-0.5">{subtitle}</p>
      </div>
      {onStar && (
        <button onClick={onStar} className="btn btn-ghost !px-2" aria-label="Toggle favorite" title="Add to favorites">
          <Star size={18} className={starred ? 'fill-accent-500 text-accent-500' : 'text-subtle'} />
        </button>
      )}
    </div>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-muted uppercase tracking-wide">{label}</span>
      <div className="mt-1.5">{children}</div>
      {hint && <span className="text-xs text-subtle mt-1 block">{hint}</span>}
    </label>
  );
}

export function Select({ value, onChange, children, className = '' }: {
  value: string | number; onChange: (v: string) => void; children: ReactNode; className?: string;
}) {
  return (
    <select className={`input-base ${className}`} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  );
}

export function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 min-w-0 py-2.5 border-b border-c last:border-0">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-semibold font-mono text-right break-all min-w-0 ${accent ? 'text-primary-600 dark:text-primary-400' : 'text-base-c'}`}>
        {value}
      </span>
    </div>
  );
}

export function ResultCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl bg-primary-500/8 border border-primary-500/20 p-4 text-center">
      <div className="text-xs text-muted uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-mono mt-1 break-all">{value}</div>
      {sub && <div className="text-xs text-muted mt-1">{sub}</div>}
    </div>
  );
}

export function Tabs({ tabs, active, onChange }: {
  tabs: { id: string; label: string; icon?: React.ElementType }[];
  active: string; onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 p-1 bg-surface-2 rounded-xl overflow-x-auto" role="group" aria-label="Tool modes">
      {tabs.map((t) => (
        <button
          key={t.id} onClick={() => onChange(t.id)} aria-pressed={active === t.id}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
            active === t.id ? 'bg-surface text-base-c shadow-card' : 'text-muted hover:text-base-c'
          }`}
        >
          {t.icon && <t.icon size={15} />}
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <Icon size={28} className="text-subtle mb-2" />
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [status, setStatus] = useState('');
  useEffect(() => { setStatus(''); }, [text]);
  return (
    <button
      className="btn btn-soft text-xs"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setStatus('Copied'); } catch { setStatus('Copy unavailable'); }
      }}
    >
      <span aria-live="polite">{status || label}</span>
    </button>
  );
}
