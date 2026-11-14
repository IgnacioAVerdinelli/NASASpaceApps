import test from 'node:test';
import assert from 'node:assert/strict';
import example from '../src/front/sketch/data/dashboard.example.json' with { type: 'json' };
import { validateDashboard } from '../src/front/sketch/data/contract.js';
import { loadDashboard } from '../src/front/sketch/data/dashboard.js';
import { chartGeometry } from '../src/front/sketch/data/chart.js';

const copy = () => structuredClone(example);
test('the example meets the contract and invalid data is rejected', () => {
  assert.equal(validateDashboard(copy()).version, 1);
  for (const mutate of [
    d => { d.body.scores.quadriceps_l = 101; },
    d => { d.body.scores.unknown = 5; },
    d => { d.body.layer = 'unknown'; },
    d => { d.updatedAt = 'yesterday'; },
    d => { d.charts[0].points[0].value = '12'; },
    d => { d.summary.items.push(d.summary.items[0]); },
  ]) { const data = copy(); mutate(data); assert.throws(() => validateDashboard(data), /Invalid dashboard/); }
  const noData = copy(); noData.body.scores.quadriceps_l = null; noData.charts[0].points[0].value = null;
  assert.equal(validateDashboard(noData), noData);
});

test('dashboard client uses a configured API and never silently substitutes demo data on errors', async () => {
  assert.equal((await loadDashboard()).simulated, true);
  let requested;
  const result = await loadDashboard({ url: '/api/v1/dashboard', fetchImpl: async (url, options) => { requested = [url, options]; return { ok: true, json: async () => copy() }; } });
  assert.equal(result.version, 1);
  assert.equal(requested[0], '/api/v1/dashboard');
  assert.equal(requested[1].cache, 'no-store');
  await assert.rejects(() => loadDashboard({ url: '/api', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(() => loadDashboard({ url: '/api', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /Invalid dashboard/);
});

test('chart handles no points, a single point and missing values without connecting gaps', () => {
  assert.deepEqual(chartGeometry([], null).segments, []);
  const t = '2026-01-01T00:00:00Z';
  const single = chartGeometry([{ at: t, value: 3 }], null);
  assert.equal(single.segments[0][0].x, 275);
  assert.ok(Number.isFinite(single.segments[0][0].y));
  const split = chartGeometry([{ at: t, value: 2 }, { at: '2026-01-02T00:00:00Z', value: null }, { at: '2026-01-03T00:00:00Z', value: 4 }], 3);
  assert.equal(split.segments.length, 2);
  assert.ok(Number.isFinite(split.referenceY));
});

test('polling waits for completion, reports errors, recovers and stops cleanly', async () => {
  const { pollDashboard } = await import('../src/front/sketch/data/pollDashboard.js');
  const timers = new Map(); let nextId = 0;
  const schedule = (fn, delay) => { const id = ++nextId; timers.set(id, { fn, delay }); return id; };
  const cancel = id => timers.delete(id);
  const pending = [], received = [], errors = [];
  const load = ({ signal }) => new Promise((resolve, reject) => pending.push({ resolve, reject, signal }));
  const stop = pollDashboard({ url: '/api', onData: data => received.push(data), onError: error => errors.push(error), load, schedule, cancel });
  assert.equal(pending.length, 1);
  assert.deepEqual([...timers.values()].map(timer => timer.delay), [8000]);
  pending[0].resolve(copy()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.length, 1);
  const retry = [...timers.values()][0]; assert.equal(retry.delay, 3000); timers.clear(); retry.fn();
  assert.equal(pending.length, 2);
  pending[1].reject(new Error('offline')); await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors.length, 1);
  const retryAgain = [...timers.values()][0]; assert.equal(retryAgain.delay, 3000); timers.clear(); retryAgain.fn();
  pending[2].resolve(copy()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.length, 2);
  const next = [...timers.values()][0]; timers.clear(); next.fn();
  stop(); assert.equal(pending[3].signal.aborted, true);
  pending[3].resolve(copy()); await new Promise(resolve => setImmediate(resolve));
  assert.equal(received.length, 2);
  assert.equal(timers.size, 0);
});

test('timed-out request reports an error and schedules another attempt', async () => {
  const { pollDashboard } = await import('../src/front/sketch/data/pollDashboard.js');
  const timers = new Map(); let id = 0, errors = 0;
  const schedule = (fn, delay) => { const key = ++id; timers.set(key, { fn, delay }); return key; };
  const cancel = key => timers.delete(key);
  const load = ({ signal }) => new Promise((resolve, reject) => signal.addEventListener('abort', () => reject(new Error('timeout'))));
  const stop = pollDashboard({ onData: () => assert.fail('unexpected data'), onError: () => errors++, load, schedule, cancel });
  const timeout = [...timers.values()][0]; assert.equal(timeout.delay, 8000); timeout.fn();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(errors, 1);
  assert.equal([...timers.values()][0].delay, 3000);
  stop();
});
