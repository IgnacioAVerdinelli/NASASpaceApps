import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { addSurfaceEyes } from '../src/front/body-3d/surfaceEyes.js';
import { visibleSystems } from '../src/front/body-3d/anatomy.js';

for (const body of ['male', 'female']) test(`${body} eyes align with eyeballs and only follow the skin layer`, async () => {
  const bytes = await readFile(`node_modules/open-anatomy-3d/models/anatomy-${body}.glb`);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const skin = root.getObjectByName('skin');
  let skinMesh;
  skin.traverse(node => { if (node.isMesh) skinMesh = node; });
  const originalLeft = root.getObjectByName('eye_l');
  const eyeCenter = new THREE.Box3().setFromObject(originalLeft).getCenter(new THREE.Vector3());
  const eyes = addSurfaceEyes(root, skin);
  assert.equal(eyes.parent, skin);
  assert.equal(eyes.children.length, 2);
  root.updateMatrixWorld(true);
  for (const side of ['l', 'r']) {
    const original = root.getObjectByName(`eye_${side}`);
    const surfaceEye = eyes.getObjectByName(`surface-eye-${side}`);
    assert.ok(surfaceEye);
    assert.equal(surfaceEye.geometry, original.geometry);
    assert.equal(surfaceEye.material.color.getHexString(), 'd6d9dc');
    assert.ok(surfaceEye.matrixWorld.equals(original.matrixWorld));
    const y = eyeCenter.y + (body === 'female' ? .003 : .005);
    const x = Math.abs(eyeCenter.x) * (side === 'l' ? 1 : -1);
    const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
    const eyeHit = ray.intersectObject(original, false)[0];
    const skinHit = ray.intersectObject(skinMesh, false)[0];
    assert.ok(eyeHit && (!skinHit || eyeHit.point.z > skinHit.point.z), 'eye must fill the visible opening');
    assert.equal(ray.intersectObject(surfaceEye, false).length, 0, 'decoration must not intercept selection');
  }
  assert.equal(visibleSystems('surface').skin, true);
  assert.equal(visibleSystems('muscles').skin, false);
  assert.equal(visibleSystems('skeleton').skin, false);
});

test('male surface eyes are smooth, symmetric and do not intercept selection', async () => {
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-male.glb');
  const { scene: root } = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  const skin = root.getObjectByName('skin');
  const eyes = addSurfaceEyes(root, skin, 'male');
  root.updateMatrixWorld(true);
  const left = eyes.getObjectByName('surface-eye-l');
  const right = eyes.getObjectByName('surface-eye-r');
  const l = new THREE.Vector3(), r = new THREE.Vector3();
  left.getWorldPosition(l); right.getWorldPosition(r);
  assert.ok(Math.abs(l.x + r.x) < 1e-6);
  assert.ok(Math.abs(l.y - r.y) < 1e-6 && Math.abs(l.z - r.z) < 1e-6);
  assert.equal(left.geometry.type, 'SphereGeometry');
  assert.equal(left.geometry, right.geometry);
  assert.equal(new THREE.Raycaster(new THREE.Vector3(l.x, l.y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(left).length, 0);
  let skinMesh;
  skin.traverse(node => { if (node.isMesh && node !== left && node !== right) skinMesh = node; });
  for (const [eye, center] of [[left, l], [right, r]]) {
    eye.raycast = THREE.Mesh.prototype.raycast;
    const ray = new THREE.Raycaster(new THREE.Vector3(center.x, center.y + 0.005, 2), new THREE.Vector3(0, 0, -1));
    const eyeHit = ray.intersectObject(eye)[0];
    const skinHit = ray.intersectObject(skinMesh)[0];
    assert.ok(eyeHit && (!skinHit || eyeHit.point.z > skinHit.point.z), 'eye fills the opening');
  }
  assert.equal(eyes.parent, skin);
});
