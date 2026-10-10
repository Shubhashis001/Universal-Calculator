import test from 'node:test';
import assert from 'node:assert/strict';
import { runStagingSecurity, stagingConfiguration } from '../scripts/staging-security.mjs';

const tokens = { memberAal1:'memberAal1',ownerAal1:'ownerAal1', ownerAal2:'ownerAal2',adminAal2:'adminAal2',editorAal2:'editorAal2',viewerAal2:'viewerAal2' };
const fixture='4f941686-e604-4b9e-9a9e-0dc432b63c88';
const financeFixture='77eb5924-3537-44c7-96ba-3ef0fad4ba91';
const config = { url:'https://test-project.supabase.co', key:'sb_publishable_testpublickey', tokens:{...tokens,revoked:'revoked',removedMember:'removedMember'}, seededSessionId:fixture, seededFinanceId:financeFixture };
function mockedRest({ bypassAdmin = false } = {}) {
  return async (url, options) => {
    const parsed = new URL(url);const endpoint = parsed.pathname.replace('/rest/v1/', '') + parsed.search;
    const token = options.headers.Authorization?.replace(/^Bearer /,'') ?? 'anon';
    const permitted = ['ownerAal2','adminAal2','editorAal2','viewerAal2'].includes(token);
    let status = 200, payload = {};
    if (endpoint === 'rpc/get_utility_overview') {
      if (!permitted) { status = 403; payload = {code:'42501'}; }
    } else if (endpoint.startsWith('visitor_sessions?')) {
      payload = ['ownerAal2','adminAal2'].includes(token) ? [{session_id:fixture}] : [];
    } else if (endpoint.startsWith('finance_entries?')) {
      if (options.method === 'PATCH' || token === 'anon') { status = 403; payload = {code:'42501'}; }
      else if (endpoint.includes('id=eq.') && ['ownerAal2','adminAal2','editorAal2','viewerAal2'].includes(token)) payload = [{id:financeFixture}];
      else payload = [];
    } else if (endpoint === 'rpc/list_admin_team') {
      if (!['ownerAal2','adminAal2'].includes(token)) { status = 403; payload = {code:'42501'}; }
      else payload = [];
    } else if (endpoint === 'rpc/write_finance_entry') {
      status = ['ownerAal2','adminAal2','editorAal2'].includes(token) ? 400 : 403;
      payload = {code: status === 400 ? '22023' : '42501'};
    } else if (endpoint === 'rpc/set_admin_role') {
      if (!bypassAdmin || token !== 'adminAal2') { status = 403; payload = {code:'42501'}; }
    } else if (endpoint.startsWith('utility_settings?')) {
      status = 403; payload = {code:'42501'};
    } else if (endpoint === 'rpc/get_public_utility_settings') {
      payload = {title:'Universal Utility Hub',tagline:'Tools',enabled_tools:['calculator']};
    } else throw Error(`Unexpected mock endpoint: ${endpoint}`);
    return {status,async text(){return JSON.stringify(payload)}};
  };
}

test('staging runner refuses incomplete targets and keys', () => {
  assert.throws(()=>stagingConfiguration({}),/ALLOW_STAGING_SECURITY_TESTS/);
  assert.throws(()=>stagingConfiguration({ALLOW_STAGING_SECURITY_TESTS:'YES',STAGING_SUPABASE_URL:'https://prod.supabase.co',STAGING_EXPECTED_PROJECT_REF:'not-prod'}),/Target must/);
  assert.throws(()=>stagingConfiguration({ALLOW_STAGING_SECURITY_TESTS:'YES',STAGING_SUPABASE_URL:'http://demo.supabase.co',STAGING_EXPECTED_PROJECT_REF:'demo'}),/Target must/);
});
test('staging runner calls real REST patterns and requires role denials (mock service)', async () => {
  const log=[];
  const result=await runStagingSecurity(config,mockedRest(),line=>log.push(line));
  assert.equal(result.failed,0);
  assert.ok(result.passed>=20);
  assert.ok(log.some(line=>line.includes('DIRECT staging probes')));
});
test('staging runner fails if Admin can invoke owner role-changing RPC (mock bypass)', async () => {
  const log=[];
  await assert.rejects(runStagingSecurity(config,mockedRest({bypassAdmin:true}),line=>log.push(line)),/FAILED/);
  assert.ok(log.some(line=>line.includes('FAIL Admin cannot promote to Owner')));
});
