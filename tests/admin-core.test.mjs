import test from 'node:test';import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import ts from'typescript';
const admin=readFileSync('database/20261010_admin_core.sql','utf8');
const source=readFileSync('src/lib/launchApi.ts','utf8');
test('admin frontend modules type parse and never evaluate scripts',()=>{
 for(const f of ['src/admin/AdminPanel.tsx','src/admin/MfaGate.tsx','src/admin/AdminModules.tsx','src/App.tsx']){
  const s=ts.createSourceFile(f,readFileSync(f,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  assert.equal(s.parseDiagnostics.length,0,f);
 }
});
test('SQL migrations contain expected denial and concurrency boundaries (STATIC ONLY)',()=>{
 for(const part of ["p_permission = any(array[", "and (select auth.jwt()->>'aal') = 'aal2'", 'auth.mfa_factors', 'private.recent_totp', 'pg_advisory_xact_lock', 'p_expected_version', 'row_version=p_expected_version', 'finance.archive', "private.can('team.manage')", 'create policy "authorized finance read"'])
  assert.ok(admin.includes(part),`Expected SQL boundary: ${part}`);
});
test('finance client uses expected-version RPC rather than raw table writes (STATIC ONLY)',()=>{
 assert.match(source,/rpc\/write_finance_entry/);assert.doesNotMatch(source,/rest\('finance_entries', \{ method: 'POST'/);
});
