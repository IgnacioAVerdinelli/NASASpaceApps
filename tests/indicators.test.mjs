import test from 'node:test';
import assert from 'node:assert/strict';
import { orderedIndicators, placeIndicator } from '../src/front/body-3d/indicators.js';

test('only positive known intensities are shown, with selection first and values clamped', () => {
  const result = orderedIndicators({ quadriceps_l: 75, quadriceps_r: 101, calf_l: 0, calf_r: NaN, unknown: 50 }, 'quadriceps_l');
  assert.deepEqual(result.map(({ key, value }) => [key, value]), [['quadriceps_l', 75], ['quadriceps_r', 100]]);
  assert.deepEqual(orderedIndicators({ quadriceps_l: -1 }, null), []);
});

test('labels stay inside the view and do not overlap', () => {
  const occupied = [];
  const left = placeIndicator(60, 80, 400, 300, 120, occupied);
  assert.deepEqual(left, { left: 76, right: 196, top: 65, bottom: 95 });
  const right = placeIndicator(340, 80, 400, 300, 120, occupied);
  assert.deepEqual(right, { left: 204, right: 324, top: 65, bottom: 95 });
  assert.equal(placeIndicator(200, 80, 400, 300, 120, occupied), null);
  assert.equal(placeIndicator(100, 4, 400, 300, 120, occupied), null);
});

test('a front thigh indicator follows the model and disappears behind it', async () => {
  const { readFile } = await import('node:fs/promises');
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const { buildSurfaceWeights } = await import('../src/front/body-3d/surfaceWeights.js');
  const { createIndicatorLayer } = await import('../src/front/body-3d/indicators.js');
  const { SURFACE_KEYS } = await import('../src/front/body-3d/anatomy.js');
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-male.glb');
  const data = JSON.parse(await readFile('src/front/body-3d/assets/surface-male.json', 'utf8'));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  camera.position.set(0, .86, 3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
  const view = { skin, regions: data.regions, surfaceWeights: buildSurfaceWeights(skin.geometry, data.regions, SURFACE_KEYS.length), muscleMeshes: [], skeletonMeshes: [], skeletonGroup: { visible: false }, camera };
  const makeElement = () => ({ children: [], style: { setProperty() {} }, classList: { toggle() {} }, setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); }, remove() {} });
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: makeElement };
  try {
    const container = makeElement(); container.clientWidth = 600; container.clientHeight = 600;
    const labels = createIndicatorLayer(container, view);
    const values = { layer: 'surface', scores: { quadriceps_l: 75 }, selected: 'quadriceps_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(values, 1000 + i); i++) {}
    const overlay = container.children[0];
    assert.equal(overlay.children.length, 1, 'a visible thigh gets a label');
    assert.equal(overlay.children[0].children[2].children[0].textContent, 'Quadriceps (Front Thigh) (L)');
    assert.equal(overlay.children[0].children[2].children[1].textContent, '75%');
    camera.position.set(0, .86, -3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
    for (let i = 0; i < 1000 && !labels.update(values, 2200 + i); i++) {}
    assert.equal(overlay.children[0].style.display, 'none', 'the label is hidden behind the body');
    labels.dispose();
  } finally { globalThis.document = oldDocument; }
});

test('muscle-layer labels use visible muscle geometry', async () => {
  const { readFile } = await import('node:fs/promises');
  const THREE = await import('three');
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  const { MeshoptDecoder } = await import('three/addons/libs/meshopt_decoder.module.js');
  const { createIndicatorLayer } = await import('../src/front/body-3d/indicators.js');
  const bytes = await readFile('node_modules/open-anatomy-3d/models/anatomy-female.glb');
  const data = JSON.parse(await readFile('src/front/body-3d/assets/surface-female.json', 'utf8'));
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  let skin;
  gltf.scene.getObjectByName('skin').traverse(node => { if (node.isMesh) skin = node; });
  const muscleMeshes = [];
  gltf.scene.getObjectByName('muscles').traverse(mesh => { if (mesh.isMesh) muscleMeshes.push({ mesh, key: mesh.name }); });
  const camera = new THREE.PerspectiveCamera(35, 1, .01, 100);
  camera.position.set(0, .86, 3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
  const view = { skin, regions: data.regions, muscleMeshes, skeletonMeshes: [], skeletonGroup: { visible: false }, camera };
  const makeElement = () => ({ children: [], style: { setProperty() {} }, classList: { toggle() {} }, setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); }, remove() {} });
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: makeElement };
  try {
    const container = makeElement(); container.clientWidth = 600; container.clientHeight = 600;
    const labels = createIndicatorLayer(container, view);
    const single = { layer: 'muscles', scores: { quadriceps_l: 75 }, selected: 'quadriceps_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(single, 1000 + i); i++) {}
    assert.equal(container.children[0].children.length, 1);
    const allScores = Object.fromEntries(muscleMeshes.map(({ key }) => [key, 75]));
    const start = performance.now();
    const all = { layer: 'muscles', scores: allScores, selected: 'quadriceps_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(all, 2200 + i); i++) {}
    assert.ok(performance.now() - start < 5000, 'all labels eventually finish processing');
    labels.update({ layer: 'skeleton', scores: { quadriceps_l: 75 }, selected: 'quadriceps_l', isolated: false }, 4200);
    assert.equal(container.children[0].children[0].style.display, 'none');
    labels.dispose();
  } finally { globalThis.document = oldDocument; }
});
