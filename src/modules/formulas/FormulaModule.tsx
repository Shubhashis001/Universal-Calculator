import { useMemo, useState } from 'react';
import { BookOpen, Search, ChevronDown, Atom, FlaskConical, Sigma, Hash } from 'lucide-react';
import { Panel, ToolHeader, CopyButton } from '@/components/ui';
import { FORMULAS, SUBJECTS, type Formula } from './formulaData';

const SUBJECT_ICONS: Record<string, React.ElementType> = {
  Physics: Atom,
  Chemistry: FlaskConical,
  Math: Sigma,
};

const SUBJECT_COLORS: Record<string, string> = {
  Physics: 'text-sky-600 dark:text-sky-400 bg-sky-500/10 border-sky-500/20',
  Chemistry: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  Math: 'text-violet-600 dark:text-violet-400 bg-violet-500/10 border-violet-500/20',
};

function FormulaCard({ f }: { f: Formula }) {
  const [open, setOpen] = useState(false);
  const color = SUBJECT_COLORS[f.subject] || '';
  return (
    <div className={`rounded-xl border ${open ? 'border-primary-500/30' : 'border-c'} bg-surface-2 overflow-hidden transition-all`}>
      <button onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-3 flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-base-c truncate">{f.name}</div>
          <div className="text-xs text-muted mt-0.5">{f.category}</div>
        </div>
        <div className={`px-2 py-1 rounded-md text-xs font-mono font-semibold ${color} border`}>
          {f.subject}
        </div>
        <ChevronDown size={16} className={`text-subtle shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 fade-in">
          <div className="rounded-lg bg-surface border border-c px-4 py-3">
            <div className="text-lg font-mono font-semibold text-primary-600 dark:text-primary-400 text-center break-words">
              {f.formula}
            </div>
          </div>
          {f.variables && f.variables.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted uppercase tracking-wide">Variables</div>
              {f.variables.map((v) => (
                <div key={v.sym} className="flex items-baseline gap-3 text-sm">
                  <span className="font-mono font-semibold text-base-c min-w-[60px]">{v.sym}</span>
                  <span className="text-muted">{v.desc}</span>
                </div>
              ))}
            </div>
          )}
          {f.note && (
            <div className="flex items-start gap-2 text-xs text-muted bg-surface rounded-lg px-3 py-2 border border-c">
              <Hash size={14} className="shrink-0 mt-0.5 text-subtle" />
              <span>{f.note}</span>
            </div>
          )}
          <div className="flex justify-end">
            <CopyButton text={`${f.name}: ${f.formula}`} label="Copy formula" />
          </div>
        </div>
      )}
    </div>
  );
}

export default function FormulaModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string>('All');

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return FORMULAS.filter((f) => {
      if (subject !== 'All' && f.subject !== subject) return false;
      if (!q) return true;
      return (
        f.name.toLowerCase().includes(q) ||
        f.formula.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q) ||
        f.subject.toLowerCase().includes(q) ||
        (f.note?.toLowerCase().includes(q) ?? false) ||
        (f.variables?.some((v) => v.desc.toLowerCase().includes(q) || v.sym.toLowerCase().includes(q)) ?? false)
      );
    });
  }, [query, subject]);

  const grouped = useMemo(() => {
    const map = new Map<string, Formula[]>();
    for (const f of filtered) {
      const key = `${f.subject} — ${f.category}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { All: FORMULAS.length };
    for (const s of SUBJECTS) c[s] = FORMULAS.filter((f) => f.subject === s).length;
    return c;
  }, []);

  return (
    <Panel>
      <ToolHeader
        title="Formula Reference"
        subtitle={`${FORMULAS.length} formulas across physics, chemistry & math`}
        icon={BookOpen}
        onStar={onStar}
        starred={starred}
      />

      {/* Search */}
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="input-base pl-10"
          placeholder="Search formulas, variables, categories…"
        />
      </div>

      {/* Subject filter pills */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {['All', ...SUBJECTS].map((s) => {
          const Icon = s === 'All' ? BookOpen : SUBJECT_ICONS[s];
          return (
            <button
              key={s}
              onClick={() => setSubject(s)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                subject === s
                  ? 'bg-primary-500 text-white'
                  : 'bg-surface-2 text-muted hover:text-base-c'
              }`}
            >
              {Icon && <Icon size={15} />}
              {s}
              <span className={`text-xs ${subject === s ? 'text-white/70' : 'text-subtle'}`}>({counts[s]})</span>
            </button>
          );
        })}
      </div>

      {/* Results count */}
      <div className="text-xs text-muted mb-3">
        {filtered.length} {filtered.length === 1 ? 'formula' : 'formulas'} found
      </div>

      {/* Grouped formula cards */}
      {grouped.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Search size={28} className="text-subtle mb-2" />
          <p className="text-sm text-muted">No formulas match "{query}"</p>
        </div>
      ) : (
        <div className="space-y-5 max-h-[600px] overflow-y-auto pr-1">
          {grouped.map(([group, items]) => (
            <div key={group}>
              <div className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 sticky top-0 bg-surface py-1">
                {group}
              </div>
              <div className="space-y-1.5">
                {items.map((f) => (
                  <FormulaCard key={f.id} f={f} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
