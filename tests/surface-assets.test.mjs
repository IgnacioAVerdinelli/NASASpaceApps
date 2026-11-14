import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { Vector3 } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { SURFACE_KEYS, muscles } from '../src/front/body-3d/anatomy.js';

for (const body of ['male', 'female']) test(`${body}: surface map matches model topology and anatomical sides`, async () => {
  const bytes = await readFile(`node_modules/open-anatomy-3d/models/anatomy-${body}.glb`);
  const map = JSON.parse(await readFile(`src/front/body-3d/assets/surface-${body}.json`, 'utf8'));
  assert.equal(map.version, 1);
  assert.equal(map.body, body);
  assert.equal(map.sourceSha256, createHash('sha256').update(bytes).digest('hex'), 'Regenerate the surface map after changing the source GLB');
  assert.deepEqual(map.keys, SURFACE_KEYS);
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  assert.ok(skin && gltf.scene.getObjectByName('skeleton'));
  const { index, attributes: { position } } = skin.geometry;
  assert.equal(map.triangleCount, index.count / 3);
  assert.equal(map.regions.length, map.triangleCount);
  assert.equal(new Set(map.regions).size, SURFACE_KEYS.length + 1, 'Every surface region and neutral skin must be represented');
  const point = new Vector3();
  for (let face = 0; face < map.regions.length; face++) {
    const id = map.regions[face];
    assert.ok(Number.isInteger(id) && id >= 0 && id <= SURFACE_KEYS.length);
    if (!id) continue;
    let x = 0;
    for (let corner = 0; corner < 3; corner++) x += point.fromBufferAttribute(position, index.getX(face * 3 + corner)).applyMatrix4(skin.matrixWorld).x / 3;
    const key = SURFACE_KEYS[id - 1];
    if (key.endsWith('_l')) assert.ok(x >= -0.0001, `${key} crossed to right side`);
    if (key.endsWith('_r')) assert.ok(x <= 0.0001, `${key} crossed to left side`);
  }
  for (const muscle of muscles) assert.ok(gltf.scene.getObjectByName(muscle.key)?.isMesh, `${muscle.key} must be selectable internally`);
});
