import assert from 'node:assert/strict';
import test from 'node:test';
import { clock, dayRows, loadVitals, side, simulatedHeartRate, tiles, validateVitals, vitalsUrl, watchNotices } from '../src/front/sketch/data/vitals.js';

test('simulated heart rate stays near the latest recorded value', () => {
  const day = { curves: { today: [{ value: 70 }, { value: 80 }, { value: null }] } };
  const values = Array.from({ length: 60 }, (_, second) => simulatedHeartRate(day, second));
  assert.ok(new Set(values).size > 1);
  assert.ok(values.every(value => value >= 77 && value <= 83));
  assert.equal(simulatedHeartRate({ curves: { today: [] } }, 0), null);
});

const vital = (measure, status, extra = {}) => ({ measure, name: measure, unit: 'u', decimals: 0, direction: 'up', status, text: `${measure} ${status}`,
  latest: { value: 70, day: 10, at: 'x' }, band: { low: 55, high: 65, mean: 60 }, series: [], weekly: [], ...extra });
const data = vitals => ({ version: 1, vitals, day: { curves: { today: [] }, context: [] } });

test('URL and validation', () => {
  assert.equal(vitalsUrl('/api/v1/dashboard', 'CM-3'), '/api/v1/vitals?crew=CM-3');
  assert.equal(vitalsUrl('http://h:3000/api/v1/dashboard?day=9', 'CM 1'), 'http://h:3000/api/v1/vitals?crew=CM+1');
  assert.throws(() => validateVitals({ version: 1, vitals: [] }));
  assert.ok(validateVitals(data([])));
});

test('notices: deviations and SpO2 low now, nothing else', () => {
  const n = watchNotices(data([vital('resting_hr', 'deviation'), vital('spo2', 'low_now'), vital('hrv_rmssd', 'out')]));
  assert.deepEqual(n.map(x => [x.id, x.severity, x.tab]), [['watch:resting_hr', 'watch', 'vitales'], ['watch:spo2', 'critical', 'vitales']]);
});

test('tiles join blood pressure and sleep, worst status wins', () => {
  const t = tiles(data([vital('resting_hr', 'in_range'), vital('resting_sbp', 'in_range'), vital('resting_dbp', 'deviation'),
    vital('spo2', 'no_band'), vital('hrv_rmssd', 'out'), vital('sleep_hours', 'deviation'), vital('sleep_quality', 'in_range')]));
  assert.deepEqual(t.map(x => x.id), ['hr', 'bp', 'spo2', 'hrv', 'sleep']);
  assert.equal(t[1].status.measure, 'resting_dbp');
  assert.equal(t[4].second.measure, 'sleep_quality');
  assert.equal(side(vital('x', 'out')), 'up');
  assert.equal(side(vital('x', 'in_range', { latest: { value: 60 } })), null);
  assert.equal(side(vital('x', 'no_band', { band: null })), null);
});

test('day rows merge today and the comparison by minute', () => {
  const rows = dayRows({ today: [{ minute: 0, value: 60 }, { minute: 15, value: 62 }], yesterday: [{ minute: 0, value: 58 }, { minute: 30, value: 57 }] }, 'yesterday');
  assert.deepEqual(rows, [{ minute: 0, today: 60, other: 58 }, { minute: 15, today: 62 }, { minute: 30, other: 57 }]);
  assert.equal(clock(375), '06:15');
});

test('loadVitals reports a failing API', async () => {
  await assert.rejects(loadVitals({ url: '/x', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  const ok = await loadVitals({ url: '/x', fetchImpl: async () => ({ ok: true, json: async () => data([]) }) });
  assert.equal(ok.version, 1);
});
