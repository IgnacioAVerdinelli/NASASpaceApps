import test from 'node:test';
import assert from 'node:assert/strict';
import { muscles, SURFACE_KEYS, SURFACE_MUSCLE_KEYS, normalizeScore, intensityColor, visibleSystems } from '../src/anatomy.js';

test('muscle keys are unique and surface keys are a bilateral subset', () => {
  const keys = new Set(muscles.map(muscle => muscle.key));
  assert.equal(muscles.length, 41);
  assert.equal(keys.size, 41);
  assert.equal(SURFACE_KEYS.length, 27);
  assert.equal(SURFACE_MUSCLE_KEYS.size, 27);
  for (const key of SURFACE_MUSCLE_KEYS) {
    assert.ok(keys.has(key), `${key} must exist in muscles`);
    if (key.endsWith('_l')) assert.ok(SURFACE_MUSCLE_KEYS.has(`${key.slice(0, -2)}_r`));
    if (key.endsWith('_r')) assert.ok(SURFACE_MUSCLE_KEYS.has(`${key.slice(0, -2)}_l`));
  }
});

test('scores are finite and clamped to the supported range', () => {
  for (const [input, expected] of [[0, 0], [50, 50], [100, 100], [-1, 0], [101, 100], [NaN, 0], [Infinity, 0], [-Infinity, 0]]) {
    assert.equal(normalizeScore(input), expected);
    assert.ok(Number.isFinite(normalizeScore(input)));
  }
});

test('heat colors follow the shared scale and clamp invalid inputs', () => {
  for (const [score, hex] of [[0, 'd6d9dc'], [25, 'f3bb6d'], [50, 'ef9959'], [100, 'd94d4b'], [-1, 'd6d9dc'], [101, 'd94d4b'], [NaN, 'd6d9dc']]) {
    assert.equal(intensityColor(score).getHexString(), hex);
  }
});

test('visible systems follow the selected layer and isolation', () => {
  assert.deepEqual(visibleSystems('surface'), { skin: true, muscles: false, skeleton: false });
  assert.deepEqual(visibleSystems('muscles'), { skin: false, muscles: true, skeleton: false });
  assert.deepEqual(visibleSystems('muscles', true), { skin: false, muscles: true, skeleton: true });
  assert.deepEqual(visibleSystems('skeleton'), { skin: false, muscles: false, skeleton: true });
  assert.deepEqual(visibleSystems('surface', true), { skin: true, muscles: false, skeleton: false });
});
