import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSource } from './load-source.mjs';

const { adminDataPlan, queryAdminData } = await loadSource('src/admin/dataPlan.ts');

function fakeRequests() {
  const called = [];
  return {
    called,
    requests: Object.fromEntries(['overview','users','sessions','finance'].map(key => [key, async () => {
      called.push(key);
      return key;
    }])),
  };
}

test('overview fetches only aggregate metrics even for Owner', async () => {
  const { called, requests } = fakeRequests();
  const data = await queryAdminData(adminDataPlan('overview', true), requests);
  assert.deepEqual(called, ['overview']);
  assert.deepEqual(data, { stats: 'overview', users: null, sessions: null, finance: null });
});

test('finance fetches overview totals and ledger but never raw users/sessions', async () => {
  const { called, requests } = fakeRequests();
  await queryAdminData(adminDataPlan('finance', true), requests);
  assert.deepEqual(called, ['overview','finance']);
});

test('sensitive user and session fetches are denied to lesser roles', async () => {
  for (const view of ['users', 'sessions']) {
    const { called, requests } = fakeRequests();
    const data = await queryAdminData(adminDataPlan(view, false), requests);
    assert.deepEqual(called, []);
    assert.deepEqual(data, { stats: null, users: null, sessions: null, finance: null });
  }
});

test('approved managers only fetch the active sensitive table', async () => {
  for (const [view, name] of [['users','users'],['sessions','sessions']]) {
    const { called, requests } = fakeRequests();
    await queryAdminData(adminDataPlan(view, true), requests);
    assert.deepEqual(called, [name]);
  }
});

test('settings, team and audit do not trigger unrelated dashboard queries', async () => {
  for (const view of ['settings','team','audit']) {
    const { called, requests } = fakeRequests();
    await queryAdminData(adminDataPlan(view, true), requests);
    assert.deepEqual(called, []);
  }
});

test('network failures propagate rather than returning apparently successful empty data', async () => {
  const broken = fakeRequests();
  broken.requests.overview = async () => { throw new Error('network unavailable'); };
  await assert.rejects(queryAdminData(adminDataPlan('overview', true), broken.requests), /network unavailable/);
});
