import assert from 'node:assert/strict';
import test from 'node:test';
import { byRoutine, counts, displayStatus, loadPlan, phaseOf, planUrl, postStatus, timing, upcoming, validatePlan, windowText } from '../src/front/sketch/data/plan.js';

const item = (id, from, to, extra = {}) => ({ id, type: 'study', routine_id: id.split(':')[0], reason: 'routine', title: id, ref: `[${id}]`, status: 'booked', window: { day_from: from, day_to: to, day: from, label: 'L+30' }, ...extra });

test('plan URL and validation', () => {
  assert.equal(planUrl('CM 2', '/api/v1'), '/api/v1/plan?crew=CM%202');
  assert.throws(() => validatePlan({ version: 2, items: [] }));
  assert.throws(() => validatePlan({ version: 1, items: [], mission: {} }));
  const ok = { version: 1, items: [], mission: { today: 3 } };
  assert.equal(validatePlan(ok), ok);
});

test('status and timing read from the window', () => {
  const i = item('6012:30', 27, 33);
  assert.equal(displayStatus(i, 26), 'booked');
  assert.equal(displayStatus(i, 30), 'open');
  assert.equal(displayStatus({ ...i, status: 'missed' }, 30), 'missed');
  assert.equal(timing(i, 24), 'Opens in 3 days');
  assert.equal(timing(i, 26.5), 'Opens within a day');
  assert.equal(timing(i, 31), 'Open now · closes in 2 days');
  assert.equal(timing(i, 32.5), 'Open now · closes today');
  assert.equal(timing({ ...i, status: 'missed' }, 37.2), 'Window closed 4 days ago');
  assert.equal(timing({ ...i, status: 'done' }, 40), 'Completed');
  assert.equal(windowText(i), 'Days 27–33');
  assert.equal(windowText(item('6039:30', 29.5, 30.5)), 'Day 30');
  assert.equal(windowText(item('6013:-180', -180, -30)), 'Days −180 to −30');
  assert.equal(phaseOf(item('6013:-180', -180, -30), 180), 'Pre-flight');
  assert.equal(phaseOf(i, 180), 'In flight');
  assert.equal(phaseOf(item('6024:185', 185, 187), 180), 'Post-flight');
});

test('upcoming: open first, daily series collapsed', () => {
  const sleep = d => item(`6039:${d}`, d - 0.5, d + 0.5, { type: 'routine' });
  const items = [item('6012:30', 27, 33), item('6041:34', 31, 37), sleep(30), sleep(31), sleep(32), item('6025:44', 41, 47), item('6015:7', 4, 10, { status: 'done' })];
  const rows = upcoming(items, 30, 7);
  assert.deepEqual(rows.map(r => [r.item.id, r.more]), [['6012:30', 0], ['6039:30', 2], ['6041:34', 0]]);
  assert.deepEqual(counts(items, 30, 7), { open: 2, soon: 3, done: 1, missed: 0 });
});

test('byRoutine groups the mission by routine, findings last', () => {
  const items = [item('6025:14', 11, 17), item('retest:vo2peak:95', 96, 103, { type: 'retest', reason: 'finding', routine_id: '6028' }), item('6025:44', 41, 47), item('6012:30', 27, 33)];
  assert.deepEqual(byRoutine(items).map(g => [g.key, g.items.length]), [['6025', 2], ['6012', 1], ['findings', 1]]);
});

test('loadPlan and postStatus talk to the Planner', async () => {
  const calls = [];
  const fetchImpl = async (url, init = {}) => { calls.push([url, init.method || 'GET', init.body]); return { ok: true, json: async () => ({ version: 1, items: [], mission: { today: 1 }, status: 'done' }) }; };
  await loadPlan({ url: '/api/v1/plan?crew=CM-1', fetchImpl });
  await postStatus({ id: '6012:30', crew: 'CM-1', status: 'done', by: 'CM-1', fetchImpl, root: '/api/v1' });
  assert.deepEqual(calls[1].slice(0, 2), ['/api/v1/plan/6012%3A30/status?crew=CM-1', 'POST']);
  assert.deepEqual(JSON.parse(calls[1][2]), { status: 'done', by: 'CM-1', note: null });
  const failing = async () => ({ ok: false, status: 409, json: async () => ({ error: '6012:30 is already done' }) });
  await assert.rejects(postStatus({ id: '6012:30', crew: 'CM-1', status: 'missed', fetchImpl: failing, root: '/api/v1' }), /already done/);
});
