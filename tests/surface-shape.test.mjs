import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { softenMaleGroin } from '../src/front/body-3d/surfaceShape.js';

test('softens the front of the groin and leaves surrounding areas in place', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, .8, .1, .15, .8, .1, 0, .95, .1,
    0, .8, -.1, .15, .8, -.1, 0, .95, -.1,
  ], 3));
  const before = Array.from(geometry.attributes.position.array);
  softenMaleGroin(geometry, new Matrix4());
  const after = geometry.attributes.position.array;
  assert.ok(after[2] < .06 && after[2] > .035);
  for (let i = 3; i < before.length; i++) assert.ok(Math.abs(after[i] - before[i]) < 1e-6);
  assert.equal(geometry.attributes.position.count, 6);
});

test('keeps the original quantized normals used by the male model', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-male.glb');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  const normals = skin.geometry.attributes.normal;
  const before = Array.from({ length: normals.count }, (_, i) => [normals.getX(i), normals.getY(i), normals.getZ(i)]);
  softenMaleGroin(skin.geometry, skin.matrixWorld);
  for (let i = 0; i < normals.count; i++) {
    assert.deepEqual([normals.getX(i), normals.getY(i), normals.getZ(i)], before[i]);
  }
});
