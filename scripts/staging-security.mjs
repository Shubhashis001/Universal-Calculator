#!/usr/bin/env node
/**
 * DIRECT hosted Supabase REST/RPC acceptance probes, staging only.
 * No service role key. Never paste JWTs into a command line, committed .env, or CI log.
 * This is not a replacement for browser password/TOTP, SQL concurrency or WAF tests.
 */
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';

export function stagingConfiguration(env) {
  if (env.ALLOW_STAGING_SECURITY_TESTS !== 'YES') throw new Error('Set ALLOW_STAGING_SECURITY_TESTS=YES after reviewing the staging target.');
  const url = (env.STAGING_SUPABASE_URL ?? '').replace(/\/$/, '');
  const label = (env.STAGING_EXPECTED_PROJECT_REF ?? '').trim();
  const project = /^https:\/\/([a-z0-9-]+)\.supabase\.co$/i.exec(url)?.[1];
  if (!project || !label || project !== label) throw new Error('Target must be an HTTPS supabase.co URL matching STAGING_EXPECTED_PROJECT_REF. Custom domains require a separately reviewed harness.');
  const key = env.STAGING_SUPABASE_PUBLISHABLE_KEY ?? '';
  if (!/^sb_publishable_[A-Za-z0-9_-]{10,}$/.test(key)) throw new Error('Set a publishable (not secret) staging key.');
  const tokens = {
    memberAal1: env.STAGING_MEMBER_AAL1_JWT,
    ownerAal1: env.STAGING_OWNER_AAL1_JWT,
    ownerAal2: env.STAGING_OWNER_AAL2_JWT,
    adminAal2: env.STAGING_ADMIN_AAL2_JWT,
    editorAal2: env.STAGING_EDITOR_AAL2_JWT,
    viewerAal2: env.STAGING_VIEWER_AAL2_JWT,
    revoked: env.STAGING_REVOKED_JWT,
    removedMember: env.STAGING_REMOVED_MEMBER_AAL2_JWT,
  };
  for (const [name, value] of Object.entries(tokens)) {
    if (typeof value !== 'string' || value.split('.').length !== 3 || value.length < 60)
      throw new Error(`Missing ${name} signed JWT. Collect it from an isolated staging account (not a service-role key).`);
  }
  const seededSessionId = env.STAGING_SEEDED_SESSION_ID ?? '';
  const seededFinanceId = env.STAGING_SEEDED_FINANCE_ID ?? '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seededSessionId))
    throw new Error('Set STAGING_SEEDED_SESSION_ID to a real session UUID confirmed in staging by an Owner.');
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(seededFinanceId))
    throw new Error('Set STAGING_SEEDED_FINANCE_ID to a real finance entry UUID confirmed in staging by an Owner.');
  return { url, key, tokens, seededSessionId, seededFinanceId };
}

export async function runStagingSecurity({ url, key, tokens, seededSessionId, seededFinanceId }, fetcher = fetch, logger = console.log) {
  let passed = 0;
  let failed = 0;
  const headersFor = (token) => ({
    apikey: key,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    'Content-Type': 'application/json',
  });
  async function request(path, token, method = 'GET', body) {
    const signal = AbortSignal.timeout(12000);
    try {
      const response = await fetcher(`${url}/rest/v1/${path}`, {
        method, signal, redirect: 'error', cache: 'no-store',
        headers: headersFor(token),
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      const raw = (await response.text()).slice(0, 4096);
      let json;
      try { json = raw ? JSON.parse(raw) : null; } catch { json = null; }
      return { status: response.status, json };
    } catch (e) { throw new Error(`Staging request failed (network/timeout): ${e instanceof Error ? e.name : 'unknown error'}`); }
  }
  // 404 is deliberately NOT a valid denial: a missing RPC cannot prove authorization.
  const deny = (r) => [401,403].includes(r.status) && (r.json?.code === '42501' || r.json?.code === 'PGRST301' || r.json?.code === 'PGRST302' || r.status === 401 || r.status === 403);
  async function check(label, fn) {
    try {
      const good = await fn();
      if (!good) throw new Error('Unexpected HTTP response or permission bypass');
      passed++; logger(`PASS ${label}`);
    } catch (e) { failed++; logger(`FAIL ${label}: ${e instanceof Error ? e.message : 'unexpected error'}`); }
  }
  const overview = (token) => request('rpc/get_utility_overview', token, 'POST', { p_days: 7 });
  const team = (token) => request('rpc/list_admin_team', token, 'POST', {});
  const seededSession = (token) => request(`visitor_sessions?select=session_id&session_id=eq.${seededSessionId}`, token);
  const ledger = (token) => request('finance_entries?select=id&limit=1', token);
  const seededLedger = (token) => request(`finance_entries?select=id&id=eq.${seededFinanceId}`, token);
  const rejectedFinance = (token) => request('rpc/write_finance_entry', token, 'POST', {
    p_id: null, p_expected_version: null, p_kind: 'invalid-staging-probe',
    p_category: '', p_description: '', p_amount_paise: -1,
    p_entry_date: '2000-01-01', p_archive: false,
  });

  await check('anon cannot read privileged dashboard RPC', async () => deny(await overview(null)));
  await check('normal AAL1 account cannot read privileged dashboard RPC', async () => deny(await overview(tokens.memberAal1)));
  await check('Owner AAL1 cannot read dashboard without MFA', async () => deny(await overview(tokens.ownerAal1)));
  for (const role of ['owner','admin','editor','viewer']) {
    await check(`${role} AAL2 can read dashboard`, async () => (await overview(tokens[`${role}Aal2`])).status === 200);
    await check(`${role} AAL2 can read own permitted finance listing`, async () => (await ledger(tokens[`${role}Aal2`])).status === 200);
  }
  await check('Admin can read staging fixture visitor session', async () => {
    const r = await seededSession(tokens.adminAal2);
    return r.status === 200 && Array.isArray(r.json) && r.json.length === 1 && r.json[0].session_id === seededSessionId;
  });
  await check('Editor cannot read staging fixture visitor session', async () => {
    const r = await seededSession(tokens.editorAal2);
    return r.status === 200 && Array.isArray(r.json) && r.json.length === 0;
  });
  await check('Viewer cannot read staging fixture visitor session', async () => {
    const r = await seededSession(tokens.viewerAal2);
    return r.status === 200 && Array.isArray(r.json) && r.json.length === 0;
  });
  await check('Owner can read staging fixture finance row', async () => {
    const r = await seededLedger(tokens.ownerAal2);
    return r.status === 200 && Array.isArray(r.json) && r.json.length === 1 && r.json[0].id === seededFinanceId;
  });
  await check('normal user cannot read staging fixture finance row', async () => {
    const r = await seededLedger(tokens.memberAal1);
    return deny(r) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0);
  });
  await check('anonymous clients cannot directly select private finance ledger', async () => deny(await ledger(null)));
  await check('normal AAL1 account cannot directly select private finance ledger', async () => {
    const r = await ledger(tokens.memberAal1);
    return deny(r) || (r.status === 200 && Array.isArray(r.json) && r.json.length === 0);
  });
  await check('Viewer is forbidden team directory', async () => deny(await team(tokens.viewerAal2)));
  await check('Editor is forbidden team directory', async () => deny(await team(tokens.editorAal2)));
  await check('Admin can read team directory', async () => (await team(tokens.adminAal2)).status === 200);
  await check('Owner can read team directory', async () => (await team(tokens.ownerAal2)).status === 200);
  await check('Viewer denied finance RPC before invalid field validation', async () => deny(await rejectedFinance(tokens.viewerAal2)));
  await check('Member AAL1 denied finance RPC before invalid field validation', async () => deny(await rejectedFinance(tokens.memberAal1)));
  await check('Owner AAL1 denied finance RPC before invalid field validation', async () => deny(await rejectedFinance(tokens.ownerAal1)));

  const sentinelId = randomUUID();
  await check('Admin cannot promote to Owner through direct role RPC', async () => deny(await request('rpc/set_admin_role', tokens.adminAal2, 'POST', { p_user_id: sentinelId, p_role: 'owner' })));
  await check('Admin cannot remove an arbitrary member through direct role RPC', async () => deny(await request('rpc/set_admin_role', tokens.adminAal2, 'POST', { p_user_id: sentinelId, p_role: null })));
  await check('direct ledger PATCH is blocked despite logged-in Owner', async () => deny(await request(`finance_entries?id=eq.${sentinelId}`, tokens.ownerAal2, 'PATCH', { amount_paise: 1 })));
  await check('anonymous direct settings table read is denied', async () => deny(await request('utility_settings?select=*&limit=1', null)));
  await check('public settings RPC exposes only published safe fields', async () => {
    const r = await request('rpc/get_public_utility_settings', null, 'POST', {});
    return r.status === 200 && r.json && Object.keys(r.json).every(k => ['title','tagline','enabled_tools'].includes(k)) && Array.isArray(r.json.enabled_tools);
  });
  await check('removed team member denied despite old AAL2 JWT', async () => deny(await overview(tokens.removedMember)));
  await check('revoked session is denied despite unexpired JWT', async () => deny(await overview(tokens.revoked)));
  logger(`\nDIRECT staging probes: ${passed} passed, ${failed} failed. Browser MFA, edge IP quotas and concurrent SQL tests remain separate gates.`);
  if (failed) throw new Error(`Staging API security gate FAILED: ${failed} probes.`);
  return { passed, failed };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await runStagingSecurity(stagingConfiguration(process.env)); }
  catch (e) { console.error(e instanceof Error ? e.message : 'Security gate failed'); process.exitCode = 1; }
}
