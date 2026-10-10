import { useState } from 'react';
import { MarkdownPreview } from '@/components/MarkdownPreview';
import { useRegexTask } from '@/lib/useRegexTask';
import { Type, ArrowDownUp, Copy, Eye } from 'lucide-react';
import { Panel, ToolHeader, Tabs, Field, CopyButton } from '@/components/ui';

function CounterTab() {
  const [text, setText] = useState('The quick brown fox jumps over the lazy dog.');
  const words = (text.trim().match(/\S+/g) || []).length;
  const chars = text.length;
  const charsNoSpace = text.replace(/\s/g, '').length;
  const sentences = (text.match(/[.!?]+/g) || []).length;
  const lines = text.split('\n').length;
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean).length;
  const readTime = Math.max(1, Math.ceil(words / 200));
  return (
    <div className="space-y-4">
      <Field label="Text"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[120px]" /></Field>
      <div className="grid grid-cols-3 gap-2">
        {[{ l: 'Words', v: words }, { l: 'Characters', v: chars }, { l: 'No spaces', v: charsNoSpace }, { l: 'Sentences', v: sentences }, { l: 'Lines', v: lines }, { l: 'Paragraphs', v: paragraphs }].map((s) => (
          <div key={s.l} className="rounded-lg bg-surface-2 p-3 text-center">
            <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 font-mono">{s.v}</div>
            <div className="text-xs text-muted">{s.l}</div>
          </div>
        ))}
      </div>
      <div className="text-sm text-muted">Estimated read time: <span className="text-base-c font-semibold">{readTime} min</span></div>
    </div>
  );
}

function CaseTab() {
  const [text, setText] = useState('Hello World Example');
  const ops = [
    { l: 'UPPERCASE', fn: (s: string) => s.toUpperCase() },
    { l: 'lowercase', fn: (s: string) => s.toLowerCase() },
    { l: 'Title Case', fn: (s: string) => s.replace(/\w\S*/g, (w) => w[0].toUpperCase() + w.slice(1).toLowerCase()) },
    { l: 'Sentence case', fn: (s: string) => s.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, (c) => c.toUpperCase()) },
    { l: 'camelCase', fn: (s: string) => s.toLowerCase().replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase()) },
    { l: 'snake_case', fn: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '_') },
    { l: 'kebab-case', fn: (s: string) => s.trim().toLowerCase().replace(/\s+/g, '-') },
    { l: 'CONSTANT_CASE', fn: (s: string) => s.trim().toUpperCase().replace(/\s+/g, '_') },
  ];
  return (
    <div className="space-y-4">
      <Field label="Text"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px]" /></Field>
      <div className="space-y-1.5">
        {ops.map((o) => {
          const out = o.fn(text);
          return (
            <div key={o.l} className="flex justify-between items-center px-3 py-2 rounded-lg bg-surface-2">
              <div className="min-w-0"><span className="text-xs text-muted block">{o.l}</span><span className="font-mono text-sm text-base-c break-all">{out}</span></div>
              <CopyButton text={out} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SortTab() {
  const [text, setText] = useState('banana\napple\ncherry\napple\ndate');
  const [mode, setMode] = useState<'lines' | 'words'>('lines');
  const [unique, setUnique] = useState(false);
  const [reverse, setReverse] = useState(false);
  const items = mode === 'lines' ? text.split('\n') : text.trim().split(/\s+/);
  let result = [...items].sort((a, b) => a.localeCompare(b));
  if (unique) result = [...new Set(result)];
  if (reverse) result.reverse();
  const out = mode === 'lines' ? result.join('\n') : result.join(' ');
  return (
    <div className="space-y-4">
      <Field label="Text"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[100px]" /></Field>
      <div className="flex flex-wrap gap-2">
        {(['lines', 'words'] as const).map((m) => (
          <button key={m} onClick={() => setMode(m)} className={`px-3 py-1 rounded-md text-xs font-medium capitalize ${mode === m ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>{m}</button>
        ))}
        <button onClick={() => setUnique((u) => !u)} className={`px-3 py-1 rounded-md text-xs font-medium ${unique ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>Unique</button>
        <button onClick={() => setReverse((r) => !r)} className={`px-3 py-1 rounded-md text-xs font-medium ${reverse ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>Reverse</button>
      </div>
      <div>
        <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">Result</span><CopyButton text={out} /></div>
        <div className="rounded-lg bg-surface-2 p-3 font-mono text-sm whitespace-pre-wrap break-all text-base-c max-h-40 overflow-y-auto">{out}</div>
      </div>
    </div>
  );
}

function ReplaceTab() {
  const [text, setText] = useState('The cat sat on the mat. The cat is happy.');
  const [find, setFind] = useState('cat'); const [repl, setRepl] = useState('dog');
  const [useRegex, setUseRegex] = useState(false);
  const task = useRegexTask(useRegex ? { mode: 'replace', pattern: find, flags: 'g', text, replacement: repl } : null);
  const result = useRegex ? task.result?.output ?? '' : find ? text.split(find).join(repl) : text;
  return (
    <div className="space-y-4">
      <Field label="Text"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px]" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Find"><input value={find} onChange={(e) => setFind(e.target.value)} className="input-base" /></Field>
        <Field label="Replace with"><input value={repl} onChange={(e) => setRepl(e.target.value)} className="input-base" /></Field>
      </div>
      <button onClick={() => setUseRegex((r) => !r)} className={`px-3 py-1 rounded-md text-xs font-medium ${useRegex ? 'bg-primary-600 text-white' : 'bg-surface-2 text-muted'}`}>Regex mode</button>
      {useRegex && task.error && <div role="alert" className="text-sm text-error-500">{task.error}</div>}
      {useRegex && task.pending && <div role="status" className="text-xs text-muted">Processing…</div>}
      <div>
        <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">Result</span><CopyButton text={result} /></div>
        <div className="rounded-lg bg-surface-2 p-3 text-sm whitespace-pre-wrap break-all text-base-c">{result}</div>
      </div>
    </div>
  );
}

function EscapeTab() {
  const [text, setText] = useState('<div class="hero">Hello & welcome</div>');
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const unescaped = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return (
    <div className="space-y-4">
      <Field label="Text"><textarea maxLength={100000} value={text} onChange={(e) => setText(e.target.value)} className="input-base min-h-[80px] font-mono text-sm" /></Field>
      {[
        { l: 'Escaped', v: escaped },
        { l: 'Unescaped', v: unescaped },
      ].map((r) => (
        <div key={r.l}>
          <div className="flex justify-between items-center mb-1.5"><span className="text-xs text-muted">{r.l}</span><CopyButton text={r.v} /></div>
          <div className="rounded-lg bg-surface-2 p-3 font-mono text-sm break-all text-base-c">{r.v}</div>
        </div>
      ))}
    </div>
  );
}

function MarkdownTab() {
  const [md, setMd] = useState('# Hello\n\nThis is **bold** and *italic*.\n\n- Item 1\n- Item 2\n\n[Link](https://example.com)');
  return (
    <div className="space-y-4">
      <Field label="Markdown"><textarea maxLength={100000} value={md} onChange={(e) => setMd(e.target.value)} className="input-base min-h-[120px] font-mono text-sm" /></Field>
      <div>
        <div className="text-xs text-muted mb-2 flex items-center gap-1"><Eye size={14} /> Preview</div>
        <div className="rounded-lg bg-surface-2 p-4 prose-sm text-sm text-base-c" ><MarkdownPreview text={md} /></div>
      </div>
    </div>
  );
}

export default function TextModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('counter');
  return (
    <Panel>
      <ToolHeader title="Text Tools" subtitle="Counter, case, sort, replace, escape, markdown" icon={Type} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'counter', label: 'Counter', icon: Type },
        { id: 'case', label: 'Case', icon: ArrowDownUp },
        { id: 'sort', label: 'Sort', icon: ArrowDownUp },
        { id: 'replace', label: 'Replace', icon: Copy },
        { id: 'escape', label: 'Escape', icon: Type },
        { id: 'md', label: 'Markdown', icon: Eye },
      ]} />
      <div className="mt-4">
        {tab === 'counter' && <CounterTab />}
        {tab === 'case' && <CaseTab />}
        {tab === 'sort' && <SortTab />}
        {tab === 'replace' && <ReplaceTab />}
        {tab === 'escape' && <EscapeTab />}
        {tab === 'md' && <MarkdownTab />}
      </div>
    </Panel>
  );
}
