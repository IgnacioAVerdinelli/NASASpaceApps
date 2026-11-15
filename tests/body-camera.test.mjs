import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { cameraOffset, muscleView } from '../src/front/body-3d/camera.js';

test('muscles select their front or back view independently of side', () => {
  for (const key of ['back_muscles_l', 'back_muscles_r', 'hamstrings_l', 'calf_r', 'gluteal_l', 'trapezius_r']) {
    assert.equal(muscleView(key), 'back');
  }
  for (const key of ['quadriceps_l', 'quadriceps_r', 'shin_muscles_l', 'chest_muscles_r', 'abdominal_muscles']) {
    assert.equal(muscleView(key), 'front');
  }
  assert.equal(muscleView('heart'), null);
});

test('turning from front to back orbits the body without crossing its center', () => {
  const front = new THREE.Vector3(0, 0, 3);
  const back = new THREE.Vector3(0, 0, -1);
  assert.ok(cameraOffset(front, back, 0).distanceTo(front) < 1e-10);
  assert.ok(cameraOffset(front, back, 1).distanceTo(back) < 1e-10);
  const middle = cameraOffset(front, back, 0.5);
  assert.ok(Math.abs(middle.length() - 2) < 1e-10);
  assert.ok(Math.abs(middle.x) > 1.9);
});
