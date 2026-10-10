import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const auth=read('src/lib/launchApi.ts'), sql=read('database/launch_admin.sql');
const admin=read('src/admin/AdminPanel.tsx');

test('admin first factor uses password grant, never browser OAuth redirect, and never stores password',()=>{
  assert.match(auth,/grant_type=password/);
  assert.match(auth,/JSON\.stringify\(\{ email: address, password \}\)/);
  assert.doesNotMatch(auth,/grant_type=pkce|signInGoogle|code_challenge/);
  assert.match(auth,/authStateVersion !== expectedVersion/);
  assert.match(auth,/sessionStorage\.setItem\(authStorageKey, JSON\.stringify\(value\)\)/);
  assert.doesNotMatch(auth,/sessionStorage\.setItem\([^)]*password/);
});
test('restrict public abuse and admin ledger changes at database boundary',()=>{
  for(const text of ['private.telemetry_quota', 'allowed_requests > 120',"interval '1 day'",'public.finance_entries enable row level security','finance owner insert','finance owner update','finance owner delete','private.has_admin_role']) assert.ok(sql.includes(text),text);
  assert.match(sql,/p_tool_id <> all/);
  assert.match(sql,/revok[e]? all on private\.telemetry_quota from public, anon, authenticated/i);
});
test('front end keeps sample-only preview out of deployed production',()=>{
  assert.match(admin,/import\.meta\.env\.DEV && status === 'unconfigured'/);
  assert.match(admin,/\[\\x00-\\x1f\\x7f\]/);
});
test('hosting protects admin cache and enforces CSP',()=>{
  const v=JSON.parse(read('vercel.json'));
  assert.ok(v.headers.some(x=>x.source==='/admin' && x.headers.some(h=>h.key==='Cache-Control' && h.value.includes('no-store'))));
  assert.ok(v.headers.some(x=>x.source==='/(.*)' && x.headers.some(h=>h.key==='Content-Security-Policy')));
  assert.match(read('vite.config.ts'),/sourcemap: false/);
});
