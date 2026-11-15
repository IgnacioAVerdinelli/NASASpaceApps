import assert from 'node:assert/strict';
import test from 'node:test';
import { areaRows, compressionAt, dopplerTrace, flowAtTime, loadVeins, PRESS_SECONDS, radiusOf, shown, validateVeins, veinShape, veinsUrl, worseSide } from '../src/front/sketch/data/veins.js';

const scan = (label, day, left = {}, right = {}, level = 'normal') => ({ label, day, values: { left, right }, level, sides: { left: { level }, right: { level: 'normal' } }, signs: [] });
const data = (scans, sides = { right: 'normal', left: 'normal' }) => ({ version: 1, scans, measures: [], status: { level: 'normal', signs: [], sides } });

test('URL and validation', () => {
  assert.equal(veinsUrl('/api/v1/dashboard', 'CM-1'), '/api/v1/veins?crew=CM-1');
  assert.equal(veinsUrl('http://h:3000/api/v1/dashboard?day=9', 'CM 1'), 'http://h:3000/api/v1/veins?crew=CM+1');
  assert.throws(() => validateVeins({ version: 2, scans: [], measures: [], status: {} }));
  assert.ok(validateVeins(data([])));
});

test('the drawing reads the values and draws a normal vein when they are missing', () => {
  const s = veinShape(scan('FD60', 59, { ijv_csa: 66, ijv_flow_grade: 3, ijv_echogenicity: 2, ijv_compressible: 0, ijv_peak_velocity: 0 }));
  assert.deepEqual(s, { area: 66, grade: 3, echo: 2, clot: true, speed: 0 });
  assert.deepEqual(veinShape(undefined), { area: 80, grade: 2, echo: 0, clot: false, speed: 25 });
  assert.equal(veinShape(scan('x', 1, { ijv_flow_grade: 9 })).grade, 4);
  assert.ok(Math.abs(radiusOf(70.3) - 4.73) < 0.01);
});

test('rows, the worse vein and how values read', () => {
  const rows = areaRows(data([scan('L-90', -90, { ijv_csa: 80, ijv_flow_grade: 2 }, { ijv_csa: 101 }), scan('FD30', 29, { ijv_csa: 66, ijv_flow_grade: 3 }, {}, 'check')]));
  assert.deepEqual(rows[1], { day: 29, label: 'FD30', level: 'check', right: null, left: 66, gradeRight: null, gradeLeft: 3 });
  assert.equal(worseSide(data([], { right: 'check', left: 'normal' })), 'right');
  assert.equal(worseSide(data([], { right: 'normal', left: 'normal' })), 'left');
  assert.equal(worseSide(data([], { right: 'alarm', left: 'check' })), 'right');
  assert.equal(shown({ measure: 'ijv_flow_grade' }, 4), '4 · Backward');
  assert.equal(shown({ measure: 'ijv_compressible' }, 0), 'No');
  assert.equal(shown({ measure: 'ijv_echogenicity' }, 1), 'Mild');
  assert.equal(shown({ measure: 'ijv_csa', unit: 'mm²', decimals: 0 }, 70.3), '70 mm²');
});

test('the Doppler trace follows the grade', () => {
  const mean = xs => xs.reduce((a, p) => a + p.v, 0) / xs.length;
  assert.ok(mean(dopplerTrace(1)) > 15 && Math.min(...dopplerTrace(1).map(p => p.v)) > 0);   // always toward the heart
  assert.ok(Math.min(...dopplerTrace(2).map(p => p.v)) < 5);                                // pulses back near zero
  assert.ok(Math.abs(mean(dopplerTrace(3))) < 2);                                           // no net flow
  assert.ok(mean(dopplerTrace(4)) < -10);                                                   // backward
  assert.equal(dopplerTrace(2).length, 160);
});

test('loadVeins reports a failing API', async () => {
  await assert.rejects(loadVeins({ url: '/x', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});

test('an obstructed segment has no illustrated flow, even when the recorded velocity includes noise', () => {
  for (const grade of [1, 2, 3, 4]) for (const t of [0, 0.25, 0.5, 1.5, 10]) {
    assert.equal(flowAtTime({ grade, speed: 2.4, clot: true }, t), 0);
    assert.equal(flowAtTime({ grade, speed: 0, clot: false }, t), 0);
  }
});

test('the illustrated patterns preserve direction and zero net flow for stasis', () => {
  const values = grade => Array.from({ length: 200 }, (_, i) => flowAtTime({ grade, speed: 20, clot: false }, i / 100));
  assert.ok(values(1).every(v => v > 0));
  assert.ok(values(2).every(v => v >= 0));
  assert.ok(values(2).some(v => v === 0));
  const stagnant = values(3);
  assert.ok(stagnant.some(v => v > 0) && stagnant.some(v => v < 0));
  assert.ok(Math.abs(stagnant.reduce((a, b) => a + b, 0) / stagnant.length) < 1e-9);
  assert.ok(values(4).every(v => v < 0));
});

test('the shared compression cycle closes a compressible lumen and preserves an obstructed one', () => {
  assert.equal(compressionAt(null), 0);
  assert.equal(compressionAt(-1), 0);
  assert.equal(compressionAt(0), 0);
  assert.equal(compressionAt(PRESS_SECONDS), 0);
  assert.ok(compressionAt(1.5, false) > 0.9);
  assert.ok(compressionAt(1.5, true) < 0.1);
  assert.ok(compressionAt(0.4, false) > 0 && compressionAt(0.4, false) < compressionAt(1.5, false));
});
