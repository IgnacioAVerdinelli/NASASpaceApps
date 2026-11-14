import test from 'node:test';
import assert from 'node:assert/strict';
import { intensityRows, changeRows, timeRows } from '../src/front/sketch/data/trends.js';

test('comparisons preserve measurement types and omit only missing values', () => {
  const items = [
    { title: 'Quadriceps', muscleKeys: ['quadriceps_l', 'quadriceps_r'], changePercent: -8 },
    { title: 'Other', muscleKeys: ['quadriceps_l', 'calf_l'], changePercent: null },
  ];
  assert.deepEqual(intensityRows(items, { quadriceps_l: 75, quadriceps_r: 0, calf_l: null }), [
    { name: 'Quadriceps · L', value: 75 }, { name: 'Quadriceps · R', value: 0 },
  ]);
  assert.deepEqual(changeRows(items), [{ name: 'Quadriceps', value: -8 }]);
  assert.deepEqual(intensityRows(items, {}), []);
});

test('history sorts timestamps without filling missing measurements', () => {
  const rows = timeRows([
    { at: '2026-01-03T00:00:00Z', value: 7 },
    { at: '2026-01-02T00:00:00Z', value: null },
    { at: '2026-01-01T00:00:00Z', value: 10 },
  ]);
  assert.deepEqual(rows.map(row => row.value), [10, null, 7]);
  assert.ok(rows[0].time < rows[1].time && rows[1].time < rows[2].time);
  assert.deepEqual(timeRows([]), []);
});
