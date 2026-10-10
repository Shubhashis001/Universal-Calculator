import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Search, Sun, Moon, Star, Clock, Menu, X, Calculator, ShieldCheck } from 'lucide-react';
import { useTheme } from '@/lib/theme';
import { useFavorites, useRecents } from '@/lib/storage';
import { tools, toolMap, searchTools } from '@/lib/registry';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import type { Tool } from '@/lib/registry';
import { useLaunchTracking } from '@/lib/useLaunchTracking';
import { backendConfigured, getPublicUtilitySettings } from '@/lib/launchApi';
import { publicToolDescription, toolIdFromPath, toolPath } from '@/lib/toolRoutes';

const allToolIds = new Set(tools.map(t => t.id));
// Keep the configured canonical origin from built HTML when navigating without a reload.
const canonicalOrigin = document.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.href
  ? new URL(document.querySelector<HTMLLinkElement>('link[rel="canonical"]')!.href).origin
  : window.location.origin;

function setHeadMeta(selector: string, attribute: string, content: string) {
  const tag = document.querySelector<HTMLMetaElement>(selector);
  if (tag) tag.setAttribute(attribute, content);
}

export default function App() {
  const { theme, toggle } = useTheme();
  const { favs, toggle: toggleFav, isFav } = useFavorites();
  const { recents, push: pushRecent } = useRecents();
  const [activeId, setActiveId] = useState(() => toolIdFromPath(window.location.pathname, allToolIds) ?? 'calculator');
  const [query, setQuery] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const menuTriggerRef = useRef<HTMLButtonElement>(null);
  const { consent, updateConsent, available } = useLaunchTracking(activeId);
  const [publicSettings,setPublicSettings]=useState<{title:string;tagline:string;enabled_tools:string[]}|null>(null);
  useEffect(() => {
    if (!backendConfigured) return;
    let mounted = true;
    let inFlight = false;
    const load = () => {
      if (document.hidden || inFlight) return;
      inFlight = true;
      void getPublicUtilitySettings()
        .then(settings => { if (mounted && settings) setPublicSettings(settings); })
        .catch(() => { /* Retain the last known settings if offline. */ })
        .finally(() => { inFlight = false; });
    };
    load();
    const timer = window.setInterval(load, 60000);
    document.addEventListener('visibilitychange', load);
    return () => { mounted = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', load); };
  }, []);
  const enabledIds = useMemo(() => publicSettings ? new Set(publicSettings.enabled_tools) : null, [publicSettings]);
  const visibleTools = useMemo(() => tools.filter(t => !enabledIds || enabledIds.has(t.id)), [enabledIds]);
  const visibleIds = useMemo(() => new Set(visibleTools.map(t => t.id)), [visibleTools]);
  const visibleRecents = useMemo(() => recents.filter(id => visibleIds.has(id)), [recents, visibleIds]);
  const visibleFavorites = useMemo(() => favs.filter(id => visibleIds.has(id)), [favs, visibleIds]);
  useEffect(() => {
    const onPopState = () => setActiveId(toolIdFromPath(window.location.pathname, allToolIds) ?? 'calculator');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);
  useEffect(() => {
    if (!sidebarOpen) return;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const sidebar = document.getElementById('tool-navigation');
    sidebar?.querySelector<HTMLInputElement>('input')?.focus();
    const onEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSidebarOpen(false);
      if (event.key !== 'Tab' || !sidebar) return;
      const focusable = Array.from(sidebar.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled])'));
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener('keydown', onEscape);
    return () => { document.body.style.overflow = priorOverflow; window.removeEventListener('keydown', onEscape); menuTriggerRef.current?.focus(); };
  }, [sidebarOpen]);
  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)');
    const closeOnDesktop = () => { if (desktop.matches) setSidebarOpen(false); };
    desktop.addEventListener('change', closeOnDesktop);
    return () => desktop.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => { pushRecent(activeId); }, [activeId, pushRecent]);

  const results = useMemo(() => searchTools(query).filter(t=>visibleIds.has(t.id)), [query,visibleIds]);
  useEffect(()=>{
    if (!visibleIds.has(activeId) && visibleTools[0]) {
      setActiveId(visibleTools[0].id);
      if (window.location.pathname.startsWith('/tools/')) window.history.replaceState(null, '', toolPath(visibleTools[0].id));
    }
  },[activeId,visibleTools,visibleIds]);
  const active = visibleIds.has(activeId) ? toolMap[activeId] : undefined;
  useEffect(() => {
    const brand = publicSettings?.title || 'Universal Calculator';
    const title = active ? `${active.name} — Free Online Tool | ${brand}` : `${brand} — Free Online Tools`;
    const description = active
      ? publicToolDescription(active.name, active.description)
      : 'Fourteen free online tools for calculations, conversion, programming, math, finance and productivity. No subscriptions or payments.';
    const url = new URL(window.location.pathname, canonicalOrigin).href;
    document.title = title;
    setHeadMeta('meta[name="description"]', 'content', description);
    setHeadMeta('meta[property="og:title"]', 'content', title);
    setHeadMeta('meta[property="og:description"]', 'content', description);
    setHeadMeta('meta[property="og:url"]', 'content', url);
    let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
    canonical.href = url;
  }, [active, publicSettings?.title]);
  const ActiveComp = active?.component;
  const grouped = useMemo(() => {
    const g: Record<string, typeof tools> = {};
    visibleTools.forEach((t) => { (g[t.group] = g[t.group] || []).push(t); });
    return g;
  }, [visibleTools]);

  const selectTool = (id: string) => {
    if (!visibleIds.has(id)) return;
    const nextPath = toolPath(id);
    if (window.location.pathname !== nextPath) window.history.pushState(null, '', nextPath);
    setActiveId(id); setQuery(''); setSidebarOpen(false);
  };

  return (
    <div className="min-h-screen bg-app text-base-c flex public-shell">
      <a className="skip-to-content" href="#main-content">Skip to calculator</a>
      {/* Mobile overlay */}
      {sidebarOpen && <button type="button" className="fixed inset-0 bg-black/50 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close tools navigation" tabIndex={-1} />}

      {/* Sidebar */}
      <aside id="tool-navigation" aria-label="Tools navigation" role={sidebarOpen ? 'dialog' : undefined} aria-modal={sidebarOpen ? true : undefined} className={`public-sidebar fixed lg:sticky top-0 left-0 h-screen w-72 bg-surface border-r border-c z-40 flex flex-col transition-transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="p-4 border-b border-c">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary-600 text-white flex items-center justify-center shrink-0">
              <Calculator size={21} strokeWidth={2.3} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-base-c leading-tight truncate">{publicSettings?.title??'Universal Calculator'}</div>
              <div className="text-xs text-muted">{publicSettings?.tagline??'All-in-one toolkit'}</div>
            </div>
            <button className="ml-auto lg:hidden text-muted" onClick={() => setSidebarOpen(false)} aria-label="Close tools menu"><X size={20} /></button>
          </div>
        </div>

        <div className="p-3 border-b border-c">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-subtle" />
            <input
              value={query} onChange={(e) => setQuery(e.target.value)}
              aria-label="Search tools" placeholder="Search tools…"
              className="input-base pl-9 text-sm"
            />
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-4">
          {query ? (
            <div className="space-y-1">
              <div className="text-xs font-semibold text-muted uppercase tracking-wide px-2 mb-1">Results ({results.length})</div>
              {results.map((t) => <ToolButton key={t.id} tool={t} active={t.id === activeId} onClick={() => selectTool(t.id)} starred={isFav(t.id)} />)}
              {results.length === 0 && <div className="text-sm text-muted px-2 py-4 text-center">No tools found</div>}
            </div>
          ) : (
            <>
              {visibleRecents.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide px-2 mb-1.5"><Clock size={12} /> Recent</div>
                  <div className="space-y-1">
                    {visibleRecents.map((id) => <ToolButton key={id} tool={toolMap[id]} active={id === activeId} onClick={() => selectTool(id)} starred={isFav(id)} />)}
                  </div>
                </div>
              )}
              {visibleFavorites.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted uppercase tracking-wide px-2 mb-1.5"><Star size={12} /> Favorites</div>
                  <div className="space-y-1">
                    {visibleFavorites.map((id) => <ToolButton key={id} tool={toolMap[id]} active={id === activeId} onClick={() => selectTool(id)} starred />)}
                  </div>
                </div>
              )}
              {Object.entries(grouped).map(([group, list]) => (
                <div key={group}>
                  <div className="text-xs font-semibold text-muted uppercase tracking-wide px-2 mb-1.5">{group}</div>
                  <div className="space-y-1">
                    {list.map((t) => <ToolButton key={t.id} tool={t} active={t.id === activeId} onClick={() => selectTool(t.id)} starred={isFav(t.id)} />)}
                  </div>
                </div>
              ))}
            </>
          )}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col" inert={sidebarOpen}>
        <header className="sticky top-0 z-20 bg-surface/80 backdrop-blur-md border-b border-c">
          <div className="flex items-center gap-3 px-4 py-3">
            <button ref={menuTriggerRef} className="lg:hidden text-muted nav-menu-button" onClick={() => setSidebarOpen(true)} aria-label="Open tools menu" aria-expanded={sidebarOpen} aria-controls="tool-navigation"><Menu size={22} /></button>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-base-c truncate">{active?.name}</div>
              <div className="text-xs text-muted truncate">{active?.description}</div>
            </div>
            <a href="/admin" className="btn btn-soft !px-2.5" title="Administrator dashboard" aria-label="Administrator dashboard"><ShieldCheck size={17}/></a>
            <button onClick={toggle} className="btn btn-soft !px-2.5" aria-label="Toggle theme" title="Toggle theme">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
          </div>
        </header>

        <main id="main-content" className="flex-1 min-w-0 overflow-y-auto p-3 sm:p-6">
          <div className="max-w-2xl mx-auto">
            {ActiveComp ? <ErrorBoundary key={activeId}><Suspense fallback={<div className="card p-10 text-center" role="status">Loading tool…</div>}><ActiveComp starred={isFav(activeId)} onStar={() => toggleFav(activeId)} /></Suspense></ErrorBoundary> : (
              <div className="card p-10 text-center text-muted">Select a tool to begin</div>
            )}
          </div>
          {available && consent === null && <div className="max-w-2xl mx-auto mt-6 card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center gap-3" role="region" aria-label="Optional analytics"><div className="flex-1"><strong className="text-sm">Help improve Universal Calculator?</strong><p className="text-xs text-muted mt-1 leading-relaxed">Allow anonymous usage statistics: tools opened and approximate foreground time. We never collect calculations, notes, passwords, QR content, or form inputs.</p></div><div className="flex gap-2 shrink-0"><button className="btn btn-soft" onClick={()=>updateConsent('no')}>No thanks</button><button className="btn btn-primary" onClick={()=>updateConsent('yes')}>Allow analytics</button></div></div>}
          {available && consent !== null && <div className="max-w-2xl mx-auto mt-5 text-center"><button className="text-xs text-muted underline hover:text-base-c" onClick={()=>updateConsent(consent==='yes'?'no':'yes')}>Analytics: {consent==='yes'?'enabled':'disabled'} · {consent==='yes'?'opt out':'opt in'}</button></div>}
          <footer className="max-w-2xl mx-auto mt-8 pt-6 border-t border-c text-center text-xs text-subtle">
            {publicSettings?.title??'Universal Calculator'} · {visibleTools.length} free tools · No ads · No subscriptions · Works offline where possible
          </footer>
        </main>
      </div>
    </div>
  );
}

function ToolButton({ tool, active, onClick, starred }: {
  tool: Tool; active: boolean; onClick: () => void; starred: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
      className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition group ${
        active ? 'bg-primary-500/10 text-primary-600 dark:text-primary-400' : 'hover:bg-surface-2 text-muted'
      }`}
    >
      <tool.icon size={17} className={active ? '' : 'text-subtle group-hover:text-muted'} />
      <span className={`text-sm font-medium truncate ${active ? '' : 'text-base-c'}`}>{tool.name}</span>
      {starred && <Star size={12} className="ml-auto fill-accent-500 text-accent-500 shrink-0" />}
    </button>
  );
}
