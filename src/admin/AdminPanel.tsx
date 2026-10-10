import './admin.css';
import './premium-admin.css';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import {
  Activity, ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BarChart3, CalendarDays,
  Check, ChevronDown, Clock3, CreditCard, Download, ExternalLink, Gauge, IndianRupee,
  LayoutDashboard, LockKeyhole, LogOut, Menu, MoreHorizontal, Plus, RefreshCw, Search,
  Settings2, ShieldCheck, TrendingUp, Users, WalletCards, X, Calculator, Crown,
} from 'lucide-react';
import {
  addFinance, backendConfigured, deleteFinance, editFinance,
  getFinances, getIdentity, getMyAdminRole, getOverview, getSessions, getUsers, signInWithPassword, signOut,
  getCurrentAal, reverifySensitiveMfa,
} from '@/lib/launchApi';
import MfaGate from './MfaGate';
import { SettingsManager, TeamManager, AuditViewer, InviteGate, FactorManager } from './AdminModules';
import type { FinanceEntry, Overview, UserProfile, VisitorSession } from '@/lib/launchApi';
import { parseRupeesToPaise, operatingBalance } from '@/lib/financeMath';
import { adminDataPlan, queryAdminData, type AdminView } from './dataPlan';

const fmt = new Intl.NumberFormat('en-IN');
const money = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
const readableDate = (v: string) => new Date(v).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
const humanDuration = (seconds: number) => seconds >= 3600 ? `${(seconds / 3600).toFixed(1)} h` : `${Math.round(seconds / 60)} min`;
const emptyOverview: Overview = { sessions:0, visitors:0, active_now:0, active_seconds:0, tool_uses:0, total_users:0, new_users:0, revenue_paise:0, expense_paise:0, daily_sessions:[], daily_finance:[], top_tools:[] };

type View = AdminView;
type LoginStatus = 'checking' | 'login' | 'denied' | 'authenticated' | 'mfa' | 'unconfigured';
const views: {id: View; label:string; icon: typeof LayoutDashboard}[] = [
  {id:'overview',label:'Overview',icon:LayoutDashboard}, {id:'users',label:'Users',icon:Users},
  {id:'sessions',label:'Live activity',icon:Activity}, {id:'finance',label:'Revenue & costs',icon:WalletCards},
  {id:'settings',label:'Launch settings',icon:Settings2},
  {id:'team',label:'Team & roles',icon:Users}, {id:'audit',label:'Audit trail',icon:ShieldCheck},
];

function Metric({ title, value, detail, icon: Icon, tone = 'indigo' }: {
  title: string; value: string; detail: string; icon: typeof Activity; tone?: 'indigo'|'green'|'amber'|'sky';
}) { return (
  <div className="ad-metric">
    <div className="ad-metric-top"><span>{title}</span><span className={`ad-icon ${tone}`}><Icon size={19}/></span></div>
    <strong title={value}>{value}</strong><span className="ad-metric-sub">{detail}</span>
  </div>
); }

function TrendChart({ series }: { series: { date: string; sessions: number }[] }) {
  const max = Math.max(1, ...series.map(i => i.sessions));
  const values = series.map((item, idx) => ({ x: series.length === 1 ? 30 : 30 + (idx * 640) / (series.length - 1), y: 186 - (item.sessions / max) * 155 }));
  const line = values.map((p, idx) => `${idx ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const fill = values.length ? `${line} L ${values[values.length-1].x} 196 L 30 196 Z` : '';
  return (
    <div className="ad-chart-wrap">
      <svg viewBox="0 0 700 220" role="img" aria-label="Daily visits for selected period" preserveAspectRatio="none" className="ad-chart">
        <defs><linearGradient id="areaFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d8aa39" stopOpacity=".25"/><stop offset="1" stopColor="#d8aa39" stopOpacity="0"/></linearGradient></defs>
        {[40,90,140,190].map(y => <line key={y} x1="30" x2="685" y1={y} y2={y} stroke="currentColor" strokeOpacity=".09" strokeDasharray="4 5" />)}
        {values.length > 0 && <><path d={fill} fill="url(#areaFill)"/><path d={line} fill="none" stroke="#efc75b" strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></>}
        {values.length === 0 && <text x="350" y="105" textAnchor="middle" fill="currentColor" opacity=".6" fontSize="14">No visits recorded yet</text>}
      </svg>
      <div className="ad-chart-axis"><span>{series.length ? readableDate(series[0].date) : 'Start'}</span><span>Sessions over time · UTC</span><span>{series.length ? readableDate(series[series.length-1].date) : 'Today'}</span></div>
    </div>
  );
}

function DetailHeader({ eyebrow, title, description, action }: { eyebrow?:string; title:string; description:string; action?:ReactNode }) {
  return <div className="ad-section-title"><div><span className="ad-eyebrow">{eyebrow}</span><h2>{title}</h2><p>{description}</p></div>{action}</div>;
}

function downloadCsv(filename: string, rows: (string|number|null|undefined)[][]) {
  // Spreadsheet formula injection defense for exported user-controlled text.
  const csv = rows.map(row => row.map(value => {
    const raw = String(value ?? '');
    const safe = /^[\s]*[=+\-@\t\r]/.test(raw) ? `\'${raw}` : raw;
    return `"${safe.replaceAll('\"', '\"\"')}"`;
  }).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob(['\uFEFF',csv], { type:'text/csv;charset=utf-8' }));
  const link = document.createElement('a'); link.href=url; link.download=filename; link.click(); URL.revokeObjectURL(url);
}

export default function AdminPanel() {
  const [status, setStatus] = useState<LoginStatus>('checking');
  const [preview, setPreview] = useState(false);
  const [user, setUser] = useState<{id:string;email?:string}|null>(null);
  const [loginEmail,setLoginEmail]=useState('');
  const [loginPassword,setLoginPassword]=useState('');
  const [loginBusy,setLoginBusy]=useState(false);
  const [role, setRole] = useState<'owner'|'admin'|'editor'|'viewer'|null>(null);
  const [view, setView] = useState<View>('overview');
  const [days, setDays] = useState<7|30|90>(30);
  const [userPage,setUserPage]=useState(0),[sessionPage,setSessionPage]=useState(0),[financePage,setFinancePage]=useState(0);
  const [overview, setOverview] = useState<Overview>(emptyOverview);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [sessions, setSessions] = useState<VisitorSession[]>([]);
  const [finances, setFinances] = useState<FinanceEntry[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState<Date|null>(null);
  const [sideOpen, setSideOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<FinanceEntry|null>(null);
  const [showNew, setShowNew] = useState(false);
  const requestSequence = useRef(0);

  useEffect(() => {
    if (!sideOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setSideOpen(false); };
    const desktop = window.matchMedia('(min-width: 901px)');
    const onDesktop = () => { if (desktop.matches) setSideOpen(false); };
    document.addEventListener('keydown', onKeyDown);
    desktop.addEventListener('change', onDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      desktop.removeEventListener('change', onDesktop);
    };
  }, [sideOpen]);

  useEffect(() => {
    let cancelled = false;
    const authenticate = async () => {
      try {
        if (!backendConfigured) { setStatus('unconfigured'); return; }
        const identity = await getIdentity();
        if (cancelled) return;
        if (!identity) { setStatus('login'); return; }
        setUser(identity);
        const assignedRole = await getMyAdminRole(identity.id);
        if (cancelled) return;
        setRole(assignedRole);
        setStatus(assignedRole ? (getCurrentAal()==='aal2' ? 'authenticated':'mfa') : 'denied');
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Authentication error');
          setStatus('login');
        }
      }
    };
    void authenticate();
    return () => { cancelled = true; };
  }, []);

  const isManager = role==='owner'||role==='admin';
  const canEdit = role==='owner'||role==='admin'||role==='editor';
  const allowedViews = views.filter(v=>(v.id!=='users'||isManager) && (v.id!=='sessions'||isManager) && (v.id!=='team'||isManager) && (v.id!=='audit'||isManager));

  const finishMfa = async () => {
    const identity=await getIdentity();
    if(!identity) throw new Error('Session expired');
    const currentRole=await getMyAdminRole(identity.id);
    setUser(identity);setRole(currentRole);setStatus(currentRole?(getCurrentAal()==='aal2'?'authenticated':'mfa'):'denied');
  };

  const load = useCallback(async () => {
    if (status !== 'authenticated' || preview) return;
    const request = ++requestSequence.current;
    const plan = adminDataPlan(view, isManager);
    // Reload only the active tab. Do not request restricted records merely
    // because an overview or settings page is displayed.
    if (!Object.values(plan).some(Boolean)) { setPending(false); setError(''); return; }
    setPending(true);
    setError('');
    try {
      const { stats, users: personList, sessions: sessionsList, finance: records } = await queryAdminData(plan, {
        overview: () => getOverview(days),
        users: () => getUsers(userPage),
        sessions: () => getSessions(sessionPage),
        finance: () => getFinances(financePage),
      });
      // Ignore results from a previous tab, page or period, even if it
      // responds after a newer query. A denied query never reveals old data.
      if (request !== requestSequence.current) return;
      if (stats) setOverview(stats);
      if (personList) setUsers(personList);
      if (sessionsList) setSessions(sessionsList);
      if (records) setFinances(records);
      setLastRefresh(new Date());
    } catch (e) {
      if (request === requestSequence.current) setError(e instanceof Error ? e.message : 'Unable to load dashboard');
    } finally {
      if (request === requestSequence.current) setPending(false);
    }
  }, [status, preview, view, days, isManager, userPage, sessionPage, financePage]);

  useEffect(() => {
    if (status !== 'authenticated' || preview) return;
    const refreshIfVisible = () => { if (!document.hidden) void load(); };
    refreshIfVisible();
    const id = window.setInterval(refreshIfVisible, 60000);
    document.addEventListener('visibilitychange', refreshIfVisible);
    return () => {
      ++requestSequence.current;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', refreshIfVisible);
    };
  }, [status, preview, load]);
  useEffect(() => { if(status!=='authenticated'||preview||!user)return;
    let lastActive=Date.now();
    const touch=()=>{lastActive=Date.now();};
    const timer=window.setInterval(()=>{
      if(Date.now()-lastActive>15*60*1000){void signOut().finally(()=>{setRole(null);setStatus('login');setError('Admin session expired due to inactivity.');});return;}
      void getMyAdminRole(user.id).then(next=>{if(!next||getCurrentAal()!=='aal2'){setUsers([]);setSessions([]);setFinances([]);setRole(null);setStatus(next?'mfa':'denied');}else if(next!==role){setUsers([]);setSessions([]);setFinances([]);setRole(next);setView('overview');}}).catch(()=>{setRole(null);setStatus('login');});
    },60000);
    window.addEventListener('pointerdown',touch);window.addEventListener('keydown',touch);
    return()=>{window.clearInterval(timer);window.removeEventListener('pointerdown',touch);window.removeEventListener('keydown',touch);};
  },[status,preview,user,role]);
  const filteredUsers = useMemo(() => users.filter(u => (u.email ?? u.id).toLowerCase().includes(search.toLowerCase())), [search,users]);
  const filteredSessions = useMemo(() => sessions.filter(s => [s.session_id,s.last_tool??'',s.user_id??''].some(x => x.toLowerCase().includes(search.toLowerCase()))),[search,sessions]);
  const profit = operatingBalance(overview.revenue_paise, overview.expense_paise);
  const confirmAdminNavigation=() => window.dispatchEvent(new Event('utility-admin-navigate',{cancelable:true}));
  const signOutHere = async () => { if(!confirmAdminNavigation())return; if (preview) {setPreview(false);setRole(null);setUser(null);return;} await signOut(); setRole(null); setUser(null); setStatus('login'); };

  const submitLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loginBusy || !backendConfigured) return;
    setLoginBusy(true); setError('');
    try {
      await signInWithPassword(loginEmail,loginPassword);
      setLoginPassword('');
      await finishMfa(); // AAL1 leads to the authenticator screen, not the dashboard.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sign-in failed.');
    } finally { setLoginPassword(''); setLoginBusy(false); }
  };

  const openPreview = () => {
    const today = new Date();
    const daily_sessions = Array.from({length:30},(_,i)=>({ date:new Date(today.getTime()-(29-i)*86400000).toISOString().slice(0,10), sessions:[4,9,6,12,11,18,14,19,22,17][i%10] }));
    setOverview({...emptyOverview, sessions:410, visitors:282, active_now:12, active_seconds:187020, tool_uses:903, new_users:37, total_users:164, revenue_paise:12850000, expense_paise:3820000, daily_sessions, top_tools:[{tool:'calculator',uses:320},{tool:'converter',uses:238},{tool:'currency',uses:157},{tool:'finance',uses:108},{tool:'datetime',uses:80}]});
    setUsers([{id:'00000000-0000-0000-0000-000000000001',email:'sample@example.com',created_at:today.toISOString(),last_sign_in_at:today.toISOString()}]);
    setSessions([{session_id:'00000000-0000-0000-0000-000000000002',visitor_id:'00000000-0000-0000-0000-000000000003',user_id:null,started_at:today.toISOString(),last_seen_at:today.toISOString(),active_seconds:155,last_tool:'calculator',tool_events:3}]);
    setFinances([{id:'00000000-0000-0000-0000-000000000004',kind:'revenue',category:'Sample sponsorship',description:'Demo data — not a real transaction',amount_paise:12850000,entry_date:today.toISOString().slice(0,10),created_at:today.toISOString(),created_by:null,row_version:1},{id:'00000000-0000-0000-0000-000000000005',kind:'expense',category:'Sample hosting',description:'Demo data — not a real transaction',amount_paise:3820000,entry_date:today.toISOString().slice(0,10),created_at:today.toISOString(),created_by:null,row_version:1}]);
    setUser({id:'preview',email:'preview@local.demo'});setRole('viewer');setPreview(true);
  };
  if(status==='mfa' && !preview) return <MfaGate onComplete={finishMfa} onSignOut={signOutHere}/>;
  if (status !== 'authenticated' && !preview) return (
    <div className="ad-access"><div className="ad-access-card">
      <div className="ad-mark large"><Gauge size={26}/></div>
      <div className="ad-kicker">UNIVERSAL CALCULATOR · CONTROL CENTER</div>
      <h1>{status === 'checking' ? 'Checking access…' : status === 'unconfigured' ? 'Connect your workspace' : status === 'denied' ? 'Account not authorized' : 'Your operations, one view.'}</h1>
      <p>{status === 'unconfigured' ? 'Your secure dashboard is built. Add your Supabase project settings and run the included SQL setup to connect real analytics.' : status === 'denied' ? 'Your credentials are valid, but this account has no admin role. An authorized Owner must approve this Auth user ID.' : status === 'checking' ? 'Verifying your session and database permissions.' : 'Enter your admin email and password, then verify the six-digit code from Google Authenticator on your phone.'}</p>
      {error && <p role="alert" className="ad-error">{error}</p>}
      {status === 'login' && <form className="ad-login-form" onSubmit={e=>void submitLogin(e)}>
        <label htmlFor="admin-email">Email address</label>
        <input id="admin-email" type="email" name="email" autoComplete="username" inputMode="email" required maxLength={254}
          value={loginEmail} onChange={e=>setLoginEmail(e.target.value)} placeholder="admin@example.com" disabled={loginBusy}/>
        <label htmlFor="admin-password">Password</label>
        <input id="admin-password" type="password" name="password" autoComplete="current-password" required
          value={loginPassword} onChange={e=>setLoginPassword(e.target.value)} placeholder="Your account password" disabled={loginBusy}/>
        <button type="submit" className="ad-btn ad-btn-primary ad-btn-wide" disabled={loginBusy || !loginEmail.trim() || !loginPassword}>
          <LockKeyhole size={17}/> {loginBusy?'Signing in…':'Continue securely'} <ArrowRight size={16}/>
        </button>
        <p className="ad-hint">Step 1 of 2 · Your password is never stored by this website. No public admin registration.</p>
      </form>}
      {status === 'denied' && <InviteGate onAccepted={finishMfa}/>}
      {status === 'denied' && <button className="ad-btn ad-btn-outline" onClick={()=>setStatus('mfa')}>Enroll authenticator for owner setup</button>}
      {status === 'denied' && <div className="ad-access-actions"><button className="ad-btn ad-btn-primary" onClick={()=>void signOutHere()}>Use another account</button><span className="ad-hint">Account: {user?.email ?? user?.id}</span></div>}
      {import.meta.env.DEV && status === 'unconfigured' && <button className="ad-btn ad-btn-primary ad-btn-wide" onClick={openPreview}><BarChart3 size={16}/> Preview dashboard · sample data <ArrowRight size={15}/></button>}
      {status === 'unconfigured' && <div className="ad-setup-mini"><code>VITE_SUPABASE_URL</code><code>VITE_SUPABASE_PUBLISHABLE_KEY</code><span>See docs/ADMIN_SETUP.md for email/password and Google Authenticator TOTP setup.</span></div>}
      <a className="ad-back" href="/"><ArrowLeft size={16}/> Return to calculator</a>
      <div className="ad-access-note"><ShieldCheck size={16}/> Admin data is protected by database role policies—not a hidden button.</div>
    </div></div>
  );

  return (
    <div className="ad-shell">
      <aside className={`ad-sidebar ${sideOpen?'open':''}`}>
        <div className="ad-brand"><div className="ad-mark"><Calculator size={22}/></div><div><strong>Universal Calculator</strong><span>Admin workspace</span></div><button className="ad-mobile-close" aria-label="Close menu" onClick={()=>setSideOpen(false)}><X size={20}/></button></div>
        <div className="ad-workspace"><div className="ad-workspace-emblem"><Crown size={17}/></div><div><strong>Admin workspace</strong><span>Utility intelligence</span></div><ChevronDown size={15}/></div>
        <p className="ad-nav-label">WORKSPACE</p>
        <nav className="ad-nav" aria-label="Admin navigation">{allowedViews.slice(0,3).map(item=><button key={item.id} onClick={()=>{if(!confirmAdminNavigation())return;setView(item.id);setSideOpen(false);setSearch('');}} className={view===item.id?'active':''}><item.icon size={19}/>{item.label}{view===item.id&&<span className="ad-nav-dot"/>}</button>)}
        <p className="ad-nav-label ad-nav-secondary">MANAGEMENT</p>{allowedViews.slice(3).map(item=><button key={item.id} onClick={()=>{if(!confirmAdminNavigation())return;setView(item.id);setSideOpen(false);setSearch('');}} className={view===item.id?'active':''}><item.icon size={19}/>{item.label}</button>)}</nav>
        <div className="ad-sidebar-bottom"><div className="ad-help"><ShieldCheck size={21}/><strong>Secure by default</strong><span>Database roles and verified TOTP sessions protect admin access.</span></div><a href="/" className="ad-home-link"><ExternalLink size={17}/> Open public website</a><button onClick={()=>void signOutHere()} className="ad-home-link"><LogOut size={17}/> Sign out</button></div>
      </aside>
      {sideOpen && <button className="ad-overlay" aria-label="Close sidebar" onClick={()=>setSideOpen(false)}/>}
      <div className="ad-content">
        <header className="ad-topbar"><div className="ad-topbar-start"><button className="ad-menu" aria-label="Open menu" onClick={()=>setSideOpen(true)}><Menu size={22}/></button><span className="ad-crumb">Workspace</span><span className="ad-chevron">/</span><strong>{allowedViews.find(v=>v.id===view)?.label}</strong></div><div className="ad-topbar-right"><span className="ad-live"><span/> {preview ? 'Preview only · sample data' : 'Protected session · AAL2'}</span>{!preview&&<button className="ad-btn ad-btn-outline" onClick={()=>{const code=window.prompt('Enter a fresh 6-digit TOTP code for sensitive changes');if(!code)return;
           void reverifySensitiveMfa(code).then(()=>setError('Authenticator re-verified for sensitive operations.')).catch(e=>setError(String(e)));}}>Re-verify TOTP</button>}<div className="ad-avatar" title={user?.email}>{(user?.email??'A').charAt(0).toUpperCase()}</div></div></header>
        <main className="ad-main">
          {preview && <div className="ad-error ad-preview-banner" role="status"><strong>PREVIEW MODE</strong> — All figures, accounts and transactions below are fictional examples. Connect Supabase to enable live data. <button onClick={()=>setPreview(false)}>Exit preview</button></div>}
          <div className="ad-page-heading"><div><div className="ad-eyebrow">{view==='team'?'ACCESS MANAGEMENT':'OPERATIONS OVERVIEW'}</div><h1>{view==='overview'?'Good to see you.':view==='team'?'Access Control / Team & Roles':views.find(v=>v.id===view)?.label}</h1><p>{view==='overview'?'Here’s what’s happening across your utility platform.':view==='finance'?'Track manually recorded revenue, costs and operating profit.':view==='users'?'Registered Auth accounts (admin email/password).':view==='sessions'?'Consent-based visitor sessions and activity, refreshed regularly.':view==='team'?'Manage members, roles and invitations. Protected operations require an AAL2 session.':'Workspace configuration and important launch checks.'}</p></div>{(view==='overview'||view==='users'||view==='sessions'||view==='finance') && <button className="ad-btn ad-btn-outline" onClick={()=>void load()} disabled={pending || preview}><RefreshCw size={16} className={pending?'ad-spin':''}/> Refresh data</button>}</div>
          {error && <div role="alert" className="ad-error ad-banner">{error}</div>}
          {view==='overview' && <>
            <div className="ad-filterbar"><div className="ad-filter-left"><CalendarDays size={17}/><span>Performance snapshot</span><span className="ad-mini-dot">·</span><span>{lastRefresh?`Updated ${lastRefresh.toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}`:'Loading data'}</span></div><div className="ad-segments">{([7,30,90] as const).map(d=><button key={d} onClick={()=>setDays(d)} className={days===d?'selected':''}>{d} days</button>)}</div></div>
            <div className="ad-metrics"><Metric title="Unique visitors" value={fmt.format(overview.visitors)} detail="Consented visitors in period" icon={Users}/><Metric title="Active right now" value={fmt.format(overview.active_now)} detail="Active within last 2 minutes" icon={Activity} tone="green"/><Metric title="New sign-ups" value={fmt.format(overview.new_users)} detail={`${fmt.format(overview.total_users)} registered in total`} icon={ArrowUpRight} tone="sky"/><Metric title="Engaged time" value={humanDuration(overview.active_seconds)} detail="Measured foreground usage" icon={Clock3} tone="amber"/></div>
            <div className="ad-metrics ad-finance-metrics"><Metric title="Recorded revenue" value={money(overview.revenue_paise)} detail="Manual ledger · INR" icon={CreditCard} tone="green"/><Metric title="Recorded expenses" value={money(overview.expense_paise)} detail="Manual ledger · INR" icon={ArrowDownRight} tone="amber"/><Metric title="Estimated operating balance" value={money(profit)} detail="Revenue − entered expenses" icon={IndianRupee}/><Metric title="Tool selections" value={fmt.format(overview.tool_uses)} detail={`${fmt.format(overview.sessions)} measured sessions`} icon={TrendingUp} tone="sky"/></div>
            <div className="ad-main-grid"><section className="ad-panel ad-graph-panel"><div className="ad-panel-head"><div><h3>Visitors over time</h3><p>Daily recorded sessions · last {days} days</p></div><span className="ad-tag"><span/> {preview?'Sample data':'Live data'}</span></div><TrendChart series={overview.daily_sessions}/></section><section className="ad-panel ad-tools-panel"><div className="ad-panel-head"><div><h3>Popular tools</h3><p>Most selected utilities</p></div><MoreHorizontal size={19}/></div><div className="ad-tool-list">{overview.top_tools.length?overview.top_tools.map((t,i)=><div key={t.tool} className="ad-tool-row"><span className="ad-rank">{String(i+1).padStart(2,'0')}</span><div className="ad-tool-details"><div><strong>{t.tool.replaceAll('-',' ').replace(/\b\w/g,c=>c.toUpperCase())}</strong><span>{fmt.format(t.uses)}</span></div><div className="ad-progress"><div style={{width:`${Math.max(5,(t.uses/(overview.top_tools[0]?.uses||1))*100)}%`}}/></div></div></div>):<p className="ad-empty">Tool popularity appears once visitors enable analytics and select tools.</p>}</div></section></div>
            <div className="ad-summary-grid"><section className="ad-panel ad-summary-panel"><div className="ad-mini-icon"><BarChart3 size={20}/></div><h3>Engagement insights</h3><p>{fmt.format(overview.sessions)} sessions tracked across {fmt.format(overview.visitors)} distinct consenting visitors.</p><button className="ad-text-btn" onClick={()=>setView('sessions')}>Explore activity <ArrowRight size={15}/></button></section><section className="ad-panel ad-summary-panel"><div className="ad-mini-icon green"><WalletCards size={20}/></div><h3>Revenue operations</h3><p>Payments aren't connected yet. Record actual income and costs to calculate your running balance.</p><button className="ad-text-btn" onClick={()=>setView('finance')}>Manage finances <ArrowRight size={15}/></button></section></div>
          </>}
          {view==='users' && isManager && <section className="ad-panel ad-table-panel"><DetailHeader eyebrow="USER DIRECTORY" title="Registered users" description={`${fmt.format(users.length)} accounts on page ${userPage+1} · not anonymous visitors`} action={<button className="ad-btn ad-btn-outline" onClick={()=>downloadCsv('utility-users.csv',[['User ID','Email','Signed up','Last sign in'],...filteredUsers.map(u=>[u.id,u.email,u.created_at,u.last_sign_in_at])])}><Download size={16}/> Export page CSV</button>}/><div className="ad-search"><Search size={18}/><input placeholder="Search users by email or ID" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="ad-table-scroll"><table className="ad-table"><thead><tr><th>User</th><th>Joined</th><th>Last sign-in</th><th>Status</th></tr></thead><tbody>{filteredUsers.map((u,i)=><tr key={u.id}><td><div className="ad-user-cell"><span className={`ad-user-avatar tone${i%4}`}>{(u.email||'U').charAt(0).toUpperCase()}</span><div><strong>{u.email||'No email'}</strong><small>{u.id.slice(0,13)}…</small></div></div></td><td>{readableDate(u.created_at)}</td><td>{u.last_sign_in_at?readableDate(u.last_sign_in_at):'Never'}</td><td><span className="ad-status"><span/> Registered</span></td></tr>)}</tbody></table>{filteredUsers.length===0 && <p className="ad-empty">No registered accounts match this search.</p>}</div><PageControl page={userPage} count={users.length} onChange={setUserPage}/></section>}
          {view==='sessions' && isManager && <section className="ad-panel ad-table-panel"><DetailHeader eyebrow="VISITOR INTELLIGENCE" title="Recent sessions" description={`Consenting sessions · page ${sessionPage+1} · active means heartbeat in last 2 minutes`} action={<button className="ad-btn ad-btn-outline" onClick={()=>downloadCsv('utility-sessions.csv',[['Session ID','Visitor ID','User ID','Started','Last seen','Active seconds','Last tool'],...filteredSessions.map(s=>[s.session_id,s.visitor_id,s.user_id,s.started_at,s.last_seen_at,s.active_seconds,s.last_tool])])}><Download size={16}/> Export page CSV</button>}/><div className="ad-search"><Search size={18}/><input placeholder="Search session, user or tool" value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="ad-table-scroll"><table className="ad-table"><thead><tr><th>Session</th><th>Last tool</th><th>Started</th><th>Foreground time</th><th>Presence</th></tr></thead><tbody>{filteredSessions.map(s=><tr key={s.session_id}><td><strong className="ad-mono">{s.session_id.slice(0,8)}…</strong><small className="ad-block">{s.user_id?'Signed in':'Anonymous'}</small></td><td>{s.last_tool||'—'}</td><td>{readableDate(s.started_at)}</td><td>{humanDuration(s.active_seconds)}</td><td>{Date.now()-new Date(s.last_seen_at).getTime()<120000?<span className="ad-status"><span/> Active</span>:<span className="ad-away">Offline</span>}</td></tr>)}</tbody></table>{filteredSessions.length===0&&<p className="ad-empty">No consenting sessions recorded yet.</p>}</div><PageControl page={sessionPage} count={sessions.length} onChange={setSessionPage}/></section>}
          {view==='finance' && <><div className="ad-finance-hero"><div><span>RECORDED OPERATING BALANCE</span><strong>{money(profit)}</strong><p>Revenue {money(overview.revenue_paise)} <span>·</span> Costs {money(overview.expense_paise)} <span>·</span> Last {days} days</p></div><div className="ad-finance-hero-mark"><IndianRupee size={48}/></div></div><section className="ad-panel ad-table-panel"><DetailHeader eyebrow="FINANCIAL LEDGER" title="Revenue & expenses" description="Manually entered transactions · not connected to payment providers" action={<div className="ad-button-row">{isManager&&<button className="ad-btn ad-btn-outline" onClick={()=>downloadCsv('utility-finances.csv',[['ID','Type','Category','Description','INR','Date'],...finances.map(f=>[f.id,f.kind,f.category,f.description,(f.amount_paise/100).toFixed(2),f.entry_date])])}><Download size={16}/> Export page</button>}{canEdit&&<button className="ad-btn ad-btn-primary" onClick={()=>{setEditing(null);setShowNew(true);}}><Plus size={16}/> Add entry</button>}</div>}/><div className="ad-table-scroll"><table className="ad-table"><thead><tr><th>Entry</th><th>Type</th><th>Date</th><th>Amount</th>{canEdit&&<th>Actions</th>}</tr></thead><tbody>{finances.map(f=><tr key={f.id}><td><strong>{f.category}</strong><small className="ad-block">{f.description||'No description'}</small></td><td><span className={`ad-kind ${f.kind}`}>{f.kind==='revenue'?<ArrowUpRight size={14}/>:<ArrowDownRight size={14}/>} {f.kind}</span></td><td>{readableDate(`${f.entry_date}T12:00:00`)}</td><td><strong className={f.kind==='revenue'?'ad-positive':'ad-negative'}>{f.kind==='expense'?'-':'+'}{money(f.amount_paise)}</strong></td>{canEdit&&<td><div className="ad-actions"><button onClick={()=>{setEditing(f);setShowNew(true)}} aria-label={`Edit ${f.category}`}>Edit</button><button className="danger" onClick={async()=>{if(!confirm('Archive this finance entry? This is recorded in the audit trail.'))return;try{await deleteFinance(f);await load();}catch(e){setError(e instanceof Error?e.message:'Archive failed')}}} aria-label={`Archive ${f.category}`}>Archive</button></div></td>}</tr>)}</tbody></table>{finances.length===0&&<p className="ad-empty">No financial transactions yet. Add actual revenue or expenses to begin tracking.</p>}</div><PageControl page={financePage} count={finances.length} onChange={setFinancePage}/></section></>}
          {view==='settings' && !preview && <><SettingsManager canEdit={canEdit} owner={role==='owner'}/><FactorManager/></>}
          {view==='team' && isManager && !preview && <TeamManager owner={role==='owner'}/>}
          {view==='audit' && isManager && !preview && <AuditViewer/>}
          {view==='settings' && <div className="ad-settings-grid"><section className="ad-panel ad-settings-card"><div className="ad-mini-icon"><ShieldCheck size={23}/></div><h3>Administrative access</h3><p>Signed in as <strong>{user?.email||user?.id}</strong></p><div className="ad-setting-row"><span>Access level</span><span className="ad-pill">{role ?? 'No role'}</span></div><div className="ad-setting-row"><span>Identity provider</span><strong>Email / password + TOTP</strong></div><div className="ad-setting-row"><span>Database security</span><strong>Enforced at Supabase (verify deployment)</strong></div><button className="ad-btn ad-btn-outline" onClick={()=>void signOutHere()}><LogOut size={16}/> Sign out</button></section><section className="ad-panel ad-settings-card"><div className="ad-mini-icon green"><Check size={23}/></div><h3>Data collection policy</h3><p>Analytics is opt-in. The site never sends calculation expressions, passwords, personal notes, financial/health fields, or text input.</p><div className="ad-setting-row"><span>Active session cutoff</span><strong>2 minutes</strong></div><div className="ad-setting-row"><span>Browser heartbeat</span><strong>60 seconds</strong></div><div className="ad-setting-row"><span>Time aggregation</span><strong>UTC</strong></div></section><section className="ad-panel ad-settings-card"><div className="ad-mini-icon amber"><CreditCard size={22}/></div><h3>Monetization status</h3><p>No Stripe, Razorpay, ads, or billing webhook is connected. Finance ledger totals are manual, and cannot be considered verified payment revenue.</p><div className="ad-setting-row"><span>Ledger currency</span><strong>INR</strong></div><div className="ad-setting-row"><span>Payment integration</span><span className="ad-pending">Not connected</span></div></section><section className="ad-panel ad-settings-card"><div className="ad-mini-icon"><LockKeyhole size={22}/></div><h3>Production checklist</h3><p>Before launching, enable Supabase email/password authentication and TOTP, provision authorized admin identities, run SQL setup, set the Owner UUID and confirm deployment headers.</p><div className="ad-setting-row"><span>Setup guide</span><strong>docs/ADMIN_SETUP.md</strong></div><div className="ad-setting-row"><span>Database schema</span><strong>database/launch_admin.sql + 20261010_admin_core.sql</strong></div><div className="ad-setting-row"><span>Telemetry</span><strong>Requires visitor consent</strong></div></section></div>}
          <footer className="ad-footer"><span>Universal Calculator Analytics · Restricted dashboard</span><span>{preview?'PREVIEW — fictional metrics':'Live metrics · No mock data'}</span></footer>
        </main>
      </div>
      {showNew&&canEdit&&user&&<FinanceModal value={editing} onCancel={()=>setShowNew(false)} onSave={async entry=>{
        if(editing)await editFinance(editing.id,entry,editing.row_version);else await addFinance(entry,user.id);
        setShowNew(false);await load();
      }}/>}
    </div>
  );
}

function FinanceModal({ value, onCancel, onSave }: {
  value: FinanceEntry|null; onCancel:()=>void;
  onSave:(entry: Pick<FinanceEntry,'kind'|'category'|'description'|'amount_paise'|'entry_date'>)=>Promise<void>;
}) {
  const [kind,setKind]=useState<'revenue'|'expense'>(value?.kind??'revenue');
  const [category,setCategory]=useState(value?.category??'');
  const [description,setDescription]=useState(value?.description??'');
  const [amount,setAmount]=useState(value?(value.amount_paise/100).toFixed(2):'');
  const [date,setDate]=useState(value?.entry_date??new Date().toISOString().slice(0,10));
  const [busy,setBusy]=useState(false); const [message,setMessage]=useState('');
  const submit=async(e:FormEvent)=>{e.preventDefault();
    const paise=parseRupeesToPaise(amount);
    if(paise===null){
      setMessage('Enter a valid positive amount with up to two decimal places.');return;
    }
    if(!category.trim()||category.trim().length>64||description.length>300||/[\x00-\x1f\x7f]/.test(category+description)){setMessage('Category (max 64) and description (max 300) cannot contain control characters.');return;}
    if(!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date+'T00:00:00Z')) || new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date || date<'2000-01-01' || date>'2100-12-31'){setMessage('Enter a valid entry date.');return;}
    setBusy(true);setMessage('');try{await onSave({kind,category:category.trim(),description:description.trim(),amount_paise:paise,entry_date:date});}catch(err){setMessage(err instanceof Error?err.message:'Could not save entry');}finally{setBusy(false);}
  };
  return <div className="ad-dialog-cover" onMouseDown={e=>{if(e.target===e.currentTarget)onCancel();}}><div className="ad-dialog" role="dialog" aria-modal="true" aria-labelledby="finance-title"><div className="ad-dialog-head"><div><div className="ad-eyebrow">LEDGER MANAGEMENT</div><h2 id="finance-title">{value?'Edit finance entry':'New finance entry'}</h2><p>Enter verified amounts manually. All amounts are in INR.</p></div><button aria-label="Close dialog" onClick={onCancel}><X size={20}/></button></div><form onSubmit={e=>void submit(e)}><div className="ad-form-grid"><label>Entry type<select value={kind} onChange={e=>setKind(e.target.value as 'revenue'|'expense')}><option value="revenue">Revenue / income</option><option value="expense">Expense / cost</option></select></label><label>Amount (₹)<input required inputMode="decimal" placeholder="0.00" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>Category<input required maxLength={64} placeholder="e.g. Sponsorship, Hosting" value={category} onChange={e=>setCategory(e.target.value)}/></label><label>Entry date<input required type="date" value={date} onChange={e=>setDate(e.target.value)}/></label></div><label className="ad-full-field">Description<textarea maxLength={300} placeholder="Optional note or invoice reference" value={description} onChange={e=>setDescription(e.target.value)}/></label>{message&&<div className="ad-error" role="alert">{message}</div>}<div className="ad-dialog-actions"><button type="button" className="ad-btn ad-btn-outline" onClick={onCancel}>Cancel</button><button type="submit" className="ad-btn ad-btn-primary" disabled={busy}>{busy?'Saving…':value?'Save changes':'Add entry'} <ArrowRight size={16}/></button></div></form></div></div>;
}

function PageControl({page,count,onChange}:{page:number;count:number;onChange:(v:number)=>void}){
 return <div className="ad-dialog-actions"><button className="ad-btn ad-btn-outline" disabled={page===0} onClick={()=>onChange(page-1)}>Previous</button>
 <span className="ad-hint">Page {page+1} · 50 per page · search/export covers loaded page</span>
 <button className="ad-btn ad-btn-outline" disabled={count<50} onClick={()=>onChange(page+1)}>Next</button></div>;
}
