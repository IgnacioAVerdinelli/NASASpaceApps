import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildSurfaceWeights, pickSurfaceRegion } from '../src/surfaceWeights.js';

function geometry(indexed) {
  const g = new THREE.BufferGeometry();
  const points = [0,0,0, .01,0,0, 0,.01,0, .01,.01,0, 1,0,0, 1.01,0,0, 1,.01,0];
  g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  g.setIndex([0,1,2, 1,3,2, 4,5,6]);
  return indexed ? g : g.toNonIndexed();
}
for (const indexed of [true, false]) test(`smooth connected regions and pick them (${indexed ? 'indexed' : 'non-indexed'})`, () => {
  const g = geometry(indexed);
  const result = buildSurfaceWeights(g, [0, 1, 1], 1);
  const { weights, stride, vertexCount } = result;
  assert.equal(stride, 2);
  for (let i = 0; i < vertexCount; i++) assert.ok(Math.abs(weights[i * 2] + weights[i * 2 + 1] - 1) < 1e-6);
  assert.ok(weights[0] > 0 && weights[1] > 0);
  const far = indexed ? 4 : 6;
  assert.equal(weights[far * 2], 0);
  assert.ok(Math.abs(weights[far * 2 + 1] - 1) < 1e-6);
  assert.equal(pickSurfaceRegion(g, result, 0, new THREE.Vector3(.001, .001, 0)), 0);
  assert.equal(pickSurfaceRegion(g, result, 1, new THREE.Vector3(.009, .009, 0)), 1);
  assert.equal(pickSurfaceRegion(g, result, 2, new THREE.Vector3(1.001, .001, 0)), 1);
  assert.equal(pickSurfaceRegion(g, result, -1, new THREE.Vector3()), 0);
});

test('side filter removes opposite weights and restores neutral when needed', () => {
  const g = geometry(true);
  const result = buildSurfaceWeights(g, [1, 1, 1], 1, { rightIds: [1] });
  const offset = 4 * result.stride;
  assert.equal(result.weights[offset], 1);
  assert.equal(result.weights[offset + 1], 0);
});
