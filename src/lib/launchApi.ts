/** Browser-only adapter for Supabase Auth + REST. No secrets or server privileges. */
const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '';
const authStorageKey = 'uc_admin_password_auth_v2';
// Detect sign-out and account changes during asynchronous refresh to prevent
// an old network response from restoring a revoked browser session.
let authStateVersion = 0;
const requestSignal = (ms: number): AbortSignal | undefined =>
  typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function'
    ? AbortSignal.timeout(ms) : undefined;

export const backendConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(base) &&
  /^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(publishableKey) && !publishableKey.includes('REPLACE_ME');

type Tokens = { access_token: string; refresh_token: string; expires_at: number };
type Identity = { id: string; email?: string; created_at?: string };

export type Overview = {
  sessions: number; visitors: number; active_now: number; active_seconds: number;
  tool_uses: number; total_users: number; new_users: number;
  revenue_paise: number; expense_paise: number;
  daily_sessions: { date: string; sessions: number }[];
  daily_finance: { date: string; revenue: number; expense: number }[];
  top_tools: { tool: string; uses: number }[];
};
export type UserProfile = { id: string; email: string | null; created_at: string; last_sign_in_at: string | null };
export type FinanceEntry = {
  id: string; kind: 'revenue' | 'expense'; category: string; description: string;
  amount_paise: number; entry_date: string; created_at: string; created_by: string | null; row_version: number; archived_at?: string|null;
};

function readTokens(): Tokens | null {
  try {
    // The previous Google-OAuth release used different token/PKCE keys.
    // Never silently reuse old provider sessions after switching to password + TOTP.
    sessionStorage.removeItem('uuh_auth_v1');
    sessionStorage.removeItem('uuh_google_pkce_v1');
    const json = sessionStorage.getItem(authStorageKey);
    if (!json) return null;
    const data: unknown = JSON.parse(json);
    if (!data || typeof data !== 'object') return null;
    const t = data as Partial<Tokens>;
    return typeof t.access_token === 'string' && typeof t.refresh_token === 'string' &&
      typeof t.expires_at === 'number' ? t as Tokens : null;
  } catch { return null; }
}
function saveTokens(value: Tokens | null) {
  authStateVersion += 1;
  try { if (value) sessionStorage.setItem(authStorageKey, JSON.stringify(value)); else sessionStorage.removeItem(authStorageKey); }
  catch { /* User disabled storage; sign-in won't persist. */ }
  window.dispatchEvent(new Event('utility-auth-changed'));
}
function tokenFromResponse(payload: unknown): Tokens {
  const data = payload as Record<string, unknown>;
  if (!data || typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string'
      || data.access_token.length > 8192 || data.refresh_token.length > 8192 ||
      data.token_type !== 'bearer' || typeof data.expires_in !== 'number' ||
      !Number.isInteger(data.expires_in) || data.expires_in < 1 || data.expires_in > 86400)
    throw new Error('Invalid authentication response');
  return { access_token: data.access_token, refresh_token: data.refresh_token,
    expires_at: Date.now() + data.expires_in * 1000 };
}

/** Password credentials are sent only to Supabase Auth; never persisted or logged. */
export async function signInWithPassword(email: string, password: string): Promise<void> {
  if (!backendConfigured) throw new Error('Connect Supabase in .env.local first.');
  const address = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address) || address.length > 254)
    throw new Error('Enter a valid email address.');
  if (!password || password.length > 1024) throw new Error('Enter your password.');
  const expectedVersion = authStateVersion;
  const response = await fetch(`${base}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    cache: 'no-store',
    headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: address, password }),
    signal: requestSignal(15000),
  });
  if (authStateVersion !== expectedVersion) throw new Error('Sign-in session changed. Please retry.');
  if (response.status === 429) throw new Error('Too many login attempts. Please wait and retry.');
  if (!response.ok) throw new Error('Email or password is incorrect, or the account is not ready.');
  saveTokens(tokenFromResponse(await response.json()));
}

async function refreshAccessToken(token: Tokens): Promise<Tokens> {
  const expectedVersion = authStateVersion;
  const response = await fetch(`${base}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: { apikey: publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: token.refresh_token }),
    signal: requestSignal(15000),
  });
  if (authStateVersion !== expectedVersion || readTokens()?.refresh_token !== token.refresh_token)
    throw new Error('Session changed during refresh. Please sign in again.');
  if (!response.ok) { saveTokens(null); throw new Error('Session expired. Please sign in again.'); }
  const next = tokenFromResponse(await response.json()); saveTokens(next); return next;
}
let refreshing: Promise<Tokens> | undefined;
async function accessToken(): Promise<string | null> {
  const tokens = readTokens();
  if (!tokens) return null;
  if (tokens.expires_at > Date.now() + 60000) return tokens.access_token;
  refreshing ??= refreshAccessToken(tokens).finally(() => { refreshing = undefined; });
  return (await refreshing).access_token;
}

export async function getIdentity(): Promise<Identity | null> {
  const token = await accessToken();
  if (!token || !backendConfigured) return null;
  const r = await fetch(`${base}/auth/v1/user`, { headers: { apikey: publishableKey, Authorization: `Bearer ${token}` }, signal: requestSignal(12000) });
  if (r.status === 401 || r.status === 403) { saveTokens(null); return null; }
  if (!r.ok) throw new Error('Unable to check signed-in account.');
  const data: unknown = await r.json();
  if (!data || typeof data !== 'object' || typeof (data as Identity).id !== 'string') throw new Error('Invalid identity response');
  return data as Identity;
}

export async function signOut() {
  // Clear local credentials synchronously. Do not wait for a stalled refresh
  // request to finish before honoring a user's sign-out action.
  const token = readTokens()?.access_token ?? null;
  saveTokens(null);
  if (token && backendConfigured) {
    await fetch(`${base}/auth/v1/logout`, {
      method: 'POST', headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      signal: requestSignal(12000),
    }).catch(() => undefined);
  }
}

type JsonValue = unknown;
async function rest<T = JsonValue>(path: string, options: { method?: string; body?: JsonValue; signed?: boolean; prefer?: string; keepalive?: boolean } = {}): Promise<T> {
  if (!backendConfigured) throw new Error('Supabase is not configured yet.');
  const token = options.signed ? await accessToken() : null;
  if (options.signed && !token) throw new Error('Please sign in to access this page.');
  const res = await fetch(`${base}/rest/v1/${path}`, {
    method: options.method || 'GET',
    ...(options.keepalive ? { keepalive: true } : {}),
    headers: {
      apikey: publishableKey,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    signal: requestSignal(15000),
  });
  if (!res.ok) {
    // Do not expose SQL diagnostics or internal policy names to users.
    if (res.status === 401 || res.status === 403) throw new Error('Access denied. Sign in with an authorized account.');
    if (res.status === 429) throw new Error('Too many requests. Please try again later.');
    if (res.status===409 || res.status===400) { const payload=await res.json().catch(()=>null) as {code?:string}|null;
      if(payload?.code==='40001') throw new Error('Another editor changed this record. Refresh to review the latest version before saving.');
      if(payload?.code==='42501') throw new Error('Access denied. Verify a fresh TOTP code and retry.');
    }
    throw new Error(`Request failed (${res.status}). Please try again.`);
  }
  if (res.status === 204) return undefined as T;
  const content = await res.text();
  return content ? JSON.parse(content) as T : undefined as T;
}

export async function getMyAdminRole(userId: string): Promise<AdminRole | null> {
  const rows = await rest<{ role: AdminRole }[]>(
    `admin_accounts?select=role&user_id=eq.${encodeURIComponent(userId)}&limit=1`, { signed: true });
  return ['owner','admin','editor','viewer'].includes(rows[0]?.role??'') ? rows[0].role : null;
}
export const getOverview = (days: 7 | 30 | 90) =>
  rest<Overview>('rpc/get_utility_overview', { method: 'POST', body: { p_days: days }, signed: true });
export const getUsers = (page=0) => rest<UserProfile[]>(`user_profiles?select=id,email,created_at,last_sign_in_at&order=created_at.desc&limit=50&offset=${Math.max(0,Math.floor(page))*50}`, { signed: true });
export const getFinances = (page=0) => rest<FinanceEntry[]>(`finance_entries?select=*&archived_at=is.null&order=entry_date.desc,created_at.desc&limit=50&offset=${Math.max(0,Math.floor(page))*50}`, { signed: true });
export const addFinance = (entry: Pick<FinanceEntry, 'kind'|'category'|'description'|'amount_paise'|'entry_date'>, _userId: string) =>
  rest('rpc/write_finance_entry',{method:'POST',signed:true,body:{p_id:null,p_expected_version:null,p_kind:entry.kind,
    p_category:entry.category,p_description:entry.description,p_amount_paise:entry.amount_paise,p_entry_date:entry.entry_date,p_archive:false}});
export const editFinance = (id: string, entry: Pick<FinanceEntry, 'kind'|'category'|'description'|'amount_paise'|'entry_date'>, version: number) =>
  rest('rpc/write_finance_entry',{method:'POST',signed:true,body:{p_id:id,p_expected_version:version,p_kind:entry.kind,
    p_category:entry.category,p_description:entry.description,p_amount_paise:entry.amount_paise,p_entry_date:entry.entry_date,p_archive:false}});
export const deleteFinance = (entry: FinanceEntry) =>
  rest('rpc/write_finance_entry',{method:'POST',signed:true,body:{p_id:entry.id,p_expected_version:entry.row_version,
    p_kind:entry.kind,p_category:entry.category,p_description:entry.description,
    p_amount_paise:entry.amount_paise,p_entry_date:entry.entry_date,p_archive:true}});

/** Anonymous, opt-in, metadata-only telemetry. Errors never break a calculator. */
export async function submitUsage(sessionId: string, visitorId: string, event: 'start'|'heartbeat'|'tool', tool: string, seconds: number) {
  if (!backendConfigured) return;
  try {
    await rest('rpc/record_utility_activity', { method: 'POST', body: {
      p_session_id: sessionId, p_visitor_id: visitorId, p_event: event,
      p_tool_id: tool, p_active_seconds: Math.max(0, Math.min(60, Math.floor(seconds))),
    }, keepalive: true });
  } catch { /* Analytics must be best-effort and never block tools. */ }
}
export type VisitorSession = {
  session_id: string; visitor_id: string; user_id: string | null;
  started_at: string; last_seen_at: string; active_seconds: number; last_tool: string | null; tool_events: number;
};
export const getSessions = (page=0) => rest<VisitorSession[]>(
  `visitor_sessions?select=session_id,visitor_id,user_id,started_at,last_seen_at,active_seconds,last_tool,tool_events&order=last_seen_at.desc&limit=50&offset=${Math.max(0,Math.floor(page))*50}`,
  { signed: true });

// Supabase Auth TOTP second factor. The database, not this UI, enforces AAL2.
export type AdminRole = 'owner'|'admin'|'editor'|'viewer';
export type MfaFactor = { id: string; factor_type: string; status: string; friendly_name?: string };
export type Enrollment = { id: string; totp: { qr_code: string; secret: string; uri: string } };
export type UtilitySettings = { title: string; tagline: string; enabled_tools: string[]; row_version: number };
export type AdminTeamMember = { user_id: string; role: AdminRole; added_at: string };

async function authRequest<T>(path: string, method='GET', body?: unknown): Promise<T> {
  const token=await accessToken();
  if (!token || !backendConfigured) throw new Error('Sign in first.');
  const res=await fetch(`${base}/auth/v1/${path}`, {
    method,cache:'no-store', headers: { apikey:publishableKey,Authorization:`Bearer ${token}`,
      ...(body!==undefined?{'Content-Type':'application/json'}:{}) },
    ...(body!==undefined?{body:JSON.stringify(body)}:{}),
    signal: requestSignal(12000),
  });
  if (!res.ok) throw new Error(`Security verification failed (${res.status}).`);
  return res.status===204?undefined as T:await res.json() as T;
}

function localAal(): 'aal1'|'aal2' {
  const token=readTokens()?.access_token;
  if(!token) return 'aal1';
  try { const payload=JSON.parse(atob(token.split('.')[1].replaceAll('-','+').replaceAll('_','/'))) as {aal?:string};
    return payload.aal==='aal2'?'aal2':'aal1';
  } catch { return 'aal1'; }
}
export const getCurrentAal=()=>localAal();
export async function getTotpFactors(): Promise<MfaFactor[]> {
  const user=await authRequest<{factors?:MfaFactor[]}>('user');
  return (user.factors??[]).filter(f=>f.factor_type==='totp');
}
export const enrollTotp=()=>authRequest<Enrollment>('factors','POST',{factor_type:'totp',friendly_name:'Universal Calculator Admin'});
export const cancelTotp=(factorId:string)=>authRequest<unknown>(`factors/${encodeURIComponent(factorId)}`,'DELETE');
export async function verifyTotp(factorId:string,code:string): Promise<void> {
  if(!/^[0-9]{6}$/.test(code)) throw new Error('Enter a six-digit code.');
  const challenge=await authRequest<{id:string}>(`factors/${encodeURIComponent(factorId)}/challenge`,'POST',{});
  const tokens=await authRequest<unknown>(`factors/${encodeURIComponent(factorId)}/verify`,'POST',
    {challenge_id:challenge.id,code});
  saveTokens(tokenFromResponse(tokens));
}
export async function getPublicUtilitySettings():Promise<Pick<UtilitySettings,'title'|'tagline'|'enabled_tools'>|null> {
  if(!backendConfigured)return null;
  try {return await rest('rpc/get_public_utility_settings',{method:'POST',body:{}});}
  catch {return null;}
}
export const getAdminUtilitySettings=()=>rest<UtilitySettings>('rpc/get_admin_utility_settings',{method:'POST',body:{},signed:true});
export const updateAdminUtilitySettings=(v:UtilitySettings)=>rest<number>('rpc/update_utility_settings',{
  method:'POST',body:{p_version:v.row_version,p_title:v.title,p_tagline:v.tagline,p_tools:v.enabled_tools},signed:true});
export const getTeam=()=>rest<AdminTeamMember[]>('rpc/list_admin_team',{method:'POST',body:{},signed:true});
export const inviteTeamMember=(userId:string,role:AdminRole)=>rest<string>('rpc/invite_admin',{
  method:'POST',body:{p_user_id:userId,p_role:role},signed:true});
export const changeTeamRole=(userId:string,role:AdminRole|null)=>rest('rpc/set_admin_role',{
  method:'POST',body:{p_user_id:userId,p_role:role},signed:true});
export const getMyInvites=async()=>rest<{id:string;role:AdminRole;created_at:string}[]>(
  `admin_invites?select=id,role,created_at&invited_user_id=eq.${encodeURIComponent((await getIdentity())?.id??'')}&accepted_at=is.null&revoked_at=is.null&limit=20`,{signed:true});
export const acceptTeamInvite=(inviteId:string)=>rest<boolean>('rpc/accept_admin_invite',{
  method:'POST',body:{p_invite_id:inviteId},signed:true});
export const getAuditLog=(offset=0)=>rest<{id:number;action:string;entity:string;entity_id:string;occurred_at:string;actor_snapshot:string|null}[]>(
  `admin_audit?select=id,actor_snapshot,action,entity,entity_id,occurred_at&order=occurred_at.desc&limit=30&offset=${Math.max(0,Math.floor(offset))}`,{signed:true});

export async function reverifySensitiveMfa(code:string):Promise<void>{
 const factors=(await getTotpFactors()).filter(f=>f.status==='verified');
 if(!factors.length)throw new Error('No verified TOTP factor.');
 await verifyTotp(factors[0].id,code);
}
export type SettingsRevision={id:number;prior_version:number;snapshot:Pick<UtilitySettings,'title'|'tagline'|'enabled_tools'>;created_at:string};
export const getSettingsHistory=()=>rest<SettingsRevision[]>('rpc/list_utility_settings_history',{
 method:'POST',body:{},signed:true});
export const restoreSettingsRevision=(id:number,currentVersion:number)=>rest<number>('rpc/restore_utility_settings',{
 method:'POST',body:{p_history_id:id,p_expected_version:currentVersion},signed:true});
