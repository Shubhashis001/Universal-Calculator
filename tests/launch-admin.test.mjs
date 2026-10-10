import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadSource } from './load-source.mjs';

const {parseRupeesToPaise, operatingBalance} = await loadSource('src/lib/financeMath.ts');
const schema = readFileSync(new URL('../database/launch_admin.sql',import.meta.url),'utf8');
const client = readFileSync(new URL('../src/lib/launchApi.ts',import.meta.url),'utf8');
const tracking = readFileSync(new URL('../src/lib/useLaunchTracking.ts',import.meta.url),'utf8');

test('INR parsing is exact for paise and rejects malformed money', () => {
  for(const [input,want] of [['0.01',1],['1',100],['1.20',120],['1599.99',159999],[' 50.5 ',5050]]) assert.equal(parseRupeesToPaise(input),want);
  for(const value of ['','0','-1','NaN','Infinity','1.234','1e5','001',' 1 2 ','99999999999','10000000000']) assert.equal(parseRupeesToPaise(value),null,value);
  assert.equal(operatingBalance(150000,75000),75000);
  assert.equal(operatingBalance(2000,4000),-2000);
});
test('all exposed tables enable RLS and owner-only ledger writes', () => {
  for(const table of ['admin_accounts','user_profiles','visitor_sessions','tool_usage','finance_entries']) {
    assert.match(schema,new RegExp(`alter table public\\.${table} enable row level security;`));
  }
  assert.match(schema,/finance owner insert/);
  assert.match(schema,/finance owner update/);
  assert.match(schema,/finance owner delete/);
  assert.match(schema,/private\.has_admin_role\(array\['owner'\]\)/);
  assert.match(schema,/No direct client writes to visit tables or account role tables/);
  assert.doesNotMatch(schema,/user_metadata|raw_user_meta_data/);
});
test('telemetry needs explicit consent and sends only fixed activity fields', () => {
  assert.match(tracking,/consent !== 'yes'/);
  assert.match(tracking,/if \(choice === 'no'\)/);
  assert.match(client,/p_session_id: sessionId, p_visitor_id: visitorId, p_event: event/);
  assert.doesNotMatch(client,/service_role|SUPABASE_SECRET_KEY|VITE_SUPABASE_SERVICE/);
  assert.doesNotMatch(tracking,/input\.value|innerHTML|document\.body\.innerText/);
});
