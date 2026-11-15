import test from 'node:test';
import assert from 'node:assert/strict';
import { BufferGeometry, Float32BufferAttribute, Matrix4 } from 'three';
import { softenMaleGroin } from '../src/front/body-3d/surfaceShape.js';

test('flattens the front of the groin and leaves surrounding areas in place', () => {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute([
    0, .8, .1, .15, .8, .1, 0, .95, .1,
    0, .8, -.1, .15, .8, -.1, 0, .95, -.1,
  ], 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(Array(18).fill(0), 3));
  const before = Array.from(geometry.attributes.position.array);
  softenMaleGroin(geometry, new Matrix4());
  const after = geometry.attributes.position.array;
  assert.ok(Math.abs(after[1] - .85) < 1e-6);
  assert.ok(Math.abs(after[2] - .025) < 1e-6);
  for (let i = 3; i < before.length; i++) assert.ok(Math.abs(after[i] - before[i]) < 1e-6);
  assert.equal(geometry.attributes.position.count, 6);
});

test('reshapes the real male mesh without changing its topology or distant normals', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const { Vector3 } = await import('three');
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-male.glb');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  const geometry = skin.geometry;
  const position = geometry.attributes.position;
  const before = Array.from({ length: position.count }, (_, i) => new Vector3().fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld));
  const normals = geometry.attributes.normal;
  const oldNormals = Array.from({ length: normals.count }, (_, i) => new Vector3().fromBufferAttribute(normals, i));
  const indices = geometry.index.array.slice();
  softenMaleGroin(geometry, skin.matrixWorld);
  assert.deepEqual(geometry.index.array, indices);
  let changed = 0;
  for (let i = 0; i < position.count; i++) {
    const after = new Vector3().fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld);
    const normal = new Vector3().fromBufferAttribute(geometry.attributes.normal, i);
    assert.ok(Number.isFinite(normal.x) && Number.isFinite(normal.y) && Number.isFinite(normal.z));
    if (after.distanceTo(before[i]) > 1e-6) {
      changed++;
      assert.ok(Math.abs(before[i].x) < .055 && before[i].y > .70 && before[i].y < .90 && before[i].z > -.08);
    } else if (Math.abs(before[i].x) > .055 || before[i].y > .90 || before[i].y < .70) {
      assert.ok(normal.distanceTo(oldNormals[i]) < 1e-6);
    }
    if (Math.abs(before[i].x) < .025 && before[i].y > .735 && before[i].y < .84 && before[i].z > -.035) {
      assert.ok(after.y >= .845 && (before[i].z <= .025 || after.z <= .045));
    }
  }
  assert.ok(changed > 100);
});

test('smooths the male face without changing the skin topology or the rest of the body', async () => {
  const { readFile } = await import('node:fs/promises');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const { Vector3 } = await import('three');
  const { softenMaleFace } = await import('../src/front/body-3d/surfaceShape.js');
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-male.glb');
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  const { position } = skin.geometry.attributes;
  const before = Float32Array.from({ length: position.count * 3 }, (_, i) => [position.getX(i / 3 | 0), position.getY(i / 3 | 0), position.getZ(i / 3 | 0)][i % 3]);
  const indices = skin.geometry.index.array.slice();
  softenMaleFace(skin.geometry, skin.matrixWorld);
  assert.deepEqual(skin.geometry.index.array, indices);
  let changed = 0;
  const point = new Vector3();
  for (let i = 0; i < position.count; i++) {
    const distance = Math.hypot(position.getX(i) - before[i * 3], position.getY(i) - before[i * 3 + 1], position.getZ(i) - before[i * 3 + 2]);
    assert.ok(Number.isFinite(distance) && distance < 0.0021);
    if (distance > 1e-7) {
      changed++;
      point.fromArray(before, i * 3).applyMatrix4(skin.matrixWorld);
      assert.ok(point.y > 1.49 && point.y < 1.67 && point.z > 0.025 && Math.abs(point.x) < 0.085);
    }
  }
  assert.ok(changed > 100);
});
