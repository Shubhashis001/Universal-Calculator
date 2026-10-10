import { useEffect, useState } from 'react';
import { CheckSquare, ListTodo, StickyNote, Plus, Trash2, Check } from 'lucide-react';
import { Panel, ToolHeader, Tabs, EmptyState } from '@/components/ui';
import { useLocalStorage } from '@/lib/storage';

type Note = { id: string; title: string; body: string; updated: number };
type Todo = { id: string; text: string; done: boolean };
type CheckItem = { id: string; text: string; done: boolean };

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function NotesTab() {
  const [notes, setNotes, storageError] = useLocalStorage<Note[]>('uuh:notes', []);
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null);
  const active = notes.find((n) => n.id === activeId) || null;

  useEffect(() => { if (!notes.some(note => note.id === activeId)) setActiveId(notes[0]?.id ?? null); }, [notes, activeId]);

  const create = () => {
    const n: Note = { id: uid(), title: 'Untitled', body: '', updated: Date.now() };
    setNotes((p) => [n, ...p]); setActiveId(n.id);
  };
  const update = (id: string, patch: Partial<Note>) => {
    setNotes((p) => p.map((n) => (n.id === id ? { ...n, ...patch, updated: Date.now() } : n)));
  };
  const remove = (id: string) => {
    setNotes((p) => p.filter((n) => n.id !== id));
    if (activeId === id) setActiveId(null);
  };

  return (
    <div className="grid grid-cols-12 gap-3 min-h-[320px]">
      {storageError && <p role="alert" className="col-span-12 text-sm text-error-500">{storageError}</p>}
      <div className="col-span-5 sm:col-span-4 space-y-1.5">
        <button onClick={create} className="btn btn-primary w-full mb-2"><Plus size={16} /> New note</button>
        {notes.length === 0 && <EmptyState icon={StickyNote} message="No notes yet" />}
        {notes.map((n) => (
          <button key={n.id} onClick={() => setActiveId(n.id)}
            className={`w-full text-left px-3 py-2 rounded-lg ${activeId === n.id ? 'bg-primary-500/10 border border-primary-500/30' : 'bg-surface-2 hover:bg-elevated'}`}>
            <div className="text-sm font-medium text-base-c truncate">{n.title || 'Untitled'}</div>
            <div className="text-xs text-muted truncate">{n.body.slice(0, 40) || 'Empty note'}</div>
          </button>
        ))}
      </div>
      <div className="col-span-7 sm:col-span-8">
        {active ? (
          <div className="space-y-3">
            <div className="flex gap-2">
              <input maxLength={200} value={active.title} onChange={(e) => update(active.id, { title: e.target.value })}
                className="input-base font-semibold" placeholder="Title" />
              <button onClick={() => remove(active.id)} className="btn btn-soft !px-2.5 text-error-500"><Trash2 size={16} /></button>
            </div>
            <textarea maxLength={100000} value={active.body} onChange={(e) => update(active.id, { body: e.target.value })}
              className="input-base min-h-[260px] resize-y text-sm" placeholder="Write your note…" />
          </div>
        ) : (
          <EmptyState icon={StickyNote} message="Select or create a note" />
        )}
      </div>
    </div>
  );
}

function TodoTab() {
  const [todos, setTodos, storageError] = useLocalStorage<Todo[]>('uuh:todos', []);
  const [text, setText] = useState('');
  const add = () => { if (!text.trim()) return; setTodos((p) => [...p, { id: uid(), text: text.trim(), done: false }]); setText(''); };
  const toggle = (id: string) => setTodos((p) => p.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  const remove = (id: string) => setTodos((p) => p.filter((t) => t.id !== id));
  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div className="space-y-3">
      {storageError && <p role="alert" className="text-sm text-error-500">{storageError}</p>}
      <div className="flex gap-2">
        <input maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          className="input-base flex-1" placeholder="Add a to-do…" />
        <button onClick={add} className="btn btn-primary"><Plus size={16} /> Add</button>
      </div>
      <div className="text-xs text-muted">{remaining} of {todos.length} remaining</div>
      {todos.length === 0 ? <EmptyState icon={ListTodo} message="No to-dos yet" /> : (
        <div className="space-y-1.5">
          {todos.map((t) => (
            <div key={t.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 group">
              <button onClick={() => toggle(t.id)} className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${t.done ? 'bg-primary-600 border-primary-600 text-white' : 'border-strong'}`}>
                {t.done && <Check size={13} />}
              </button>
              <span className={`text-sm flex-1 ${t.done ? 'line-through text-subtle' : 'text-base-c'}`}>{t.text}</span>
              <button onClick={() => remove(t.id)} className="text-subtle hover:text-error-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChecklistTab() {
  const [items, setItems, storageError] = useLocalStorage<CheckItem[]>('uuh:checklist', []);
  const [text, setText] = useState('');
  const add = () => { if (!text.trim()) return; setItems((p) => [...p, { id: uid(), text: text.trim(), done: false }]); setText(''); };
  const toggle = (id: string) => setItems((p) => p.map((c) => (c.id === id ? { ...c, done: !c.done } : c)));
  const remove = (id: string) => setItems((p) => p.filter((c) => c.id !== id));
  const clear = () => setItems([]);
  const done = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;

  return (
    <div className="space-y-3">
      {storageError && <p role="alert" className="text-sm text-error-500">{storageError}</p>}
      <div className="flex gap-2">
        <input maxLength={1000} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
          className="input-base flex-1" placeholder="Checklist item…" />
        <button onClick={add} className="btn btn-primary"><Plus size={16} /> Add</button>
      </div>
      {items.length > 0 && (
        <>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div className="h-full bg-primary-600 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <span className="text-xs text-muted font-mono">{done}/{items.length}</span>
            <button onClick={clear} className="text-xs text-muted hover:text-error-500">Clear</button>
          </div>
          <div className="space-y-1.5">
            {items.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-surface-2 group">
                <button onClick={() => toggle(c.id)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 ${c.done ? 'bg-success-500 border-success-500 text-white' : 'border-strong'}`}>
                  {c.done && <Check size={13} />}
                </button>
                <span className={`text-sm flex-1 ${c.done ? 'line-through text-subtle' : 'text-base-c'}`}>{c.text}</span>
                <button onClick={() => remove(c.id)} className="text-subtle hover:text-error-500 opacity-0 group-hover:opacity-100 transition"><Trash2 size={15} /></button>
              </div>
            ))}
          </div>
        </>
      )}
      {items.length === 0 && <EmptyState icon={CheckSquare} message="No checklist items" />}
    </div>
  );
}

export default function ProductivityModule({ starred, onStar }: { starred?: boolean; onStar?: () => void }) {
  const [tab, setTab] = useState('notes');
  return (
    <Panel>
      <ToolHeader title="Productivity" subtitle="Notes, to-do list, and checklist — saved on your device" icon={StickyNote} onStar={onStar} starred={starred} />
      <Tabs active={tab} onChange={setTab} tabs={[
        { id: 'notes', label: 'Notes', icon: StickyNote },
        { id: 'todo', label: 'To-do', icon: ListTodo },
        { id: 'checklist', label: 'Checklist', icon: CheckSquare },
      ]} />
      <div className="mt-4">
        {tab === 'notes' && <NotesTab />}
        {tab === 'todo' && <TodoTab />}
        {tab === 'checklist' && <ChecklistTab />}
      </div>
    </Panel>
  );
}
