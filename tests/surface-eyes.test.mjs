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
