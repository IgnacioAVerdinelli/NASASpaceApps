import test from 'node:test';
import assert from 'node:assert/strict';
import { areaCheckpoints, orderedIndicators, placeIndicator, shortMuscleName, indicatorLinePath } from '../src/front/body-3d/indicators.js';

test('area checkpoints include both sides without requiring intensity data', () => {
  const areas = [{ title: 'Quadriceps', muscleKeys: ['quadriceps_l', 'quadriceps_r'] }, { title: 'Empty', muscleKeys: [] }];
  assert.deepEqual(areaCheckpoints(areas, 'quadriceps_l'), [
    { key: 'quadriceps_l', title: 'Quadriceps', selected: true },
    { key: 'quadriceps_r', title: 'Quadriceps', selected: true },
  ]);
  assert.deepEqual(areaCheckpoints([], null), []);
});

test('only positive known intensities are shown, with selection first and values clamped', () => {
  const result = orderedIndicators({ quadriceps_l: 75, quadriceps_r: 101, calf_l: 0, calf_r: NaN, unknown: 50 }, 'quadriceps_l');
  assert.deepEqual(result.map(({ key, value }) => [key, value]), [['quadriceps_l', 75], ['quadriceps_r', 100]]);
  assert.deepEqual(orderedIndicators({ quadriceps_l: -1 }, null), []);
});

test('labels use separate lanes outside the body and avoid overlap', () => {
  const occupied = [], body = { left: 210, right: 390 };
  const left = placeIndicator(250, 80, 600, 300, 144, occupied, body);
  assert.equal(left.side, 'left');
  assert.ok(left.right <= body.left - 24);
  const right = placeIndicator(350, 80, 600, 300, 144, occupied, body);
  assert.equal(right.side, 'right');
  assert.ok(right.left >= body.right + 24);
  const next = placeIndicator(250, 80, 600, 300, 144, occupied, body);
  assert.equal(next.side, 'left');
  assert.ok(next.bottom + 16 <= left.top || next.top >= left.bottom + 16);
  assert.equal(placeIndicator(150, 80, 300, 300, 144, [], { left: 60, right: 240 }), null);
});

test('labels keep their lane and vertical position through small movements', () => {
  const body = { left: 210, right: 390 };
  const first = placeIndicator(250, 130, 600, 300, 120, [], body);
  const next = placeIndicator(255, 136, 600, 300, 120, [], body, first);
  assert.equal(next.side, first.side);
  assert.equal(next.top, first.top);
  const blocked = placeIndicator(255, 136, 600, 300, 120, [first], body, first);
  assert.notEqual(blocked.top, first.top);
});

test('indicator offsets and bent paths vary while remaining outside the body', () => {
  const body = { left: 210, right: 390 };
  const first = placeIndicator(250, 130, 600, 300, 120, [], body, null, 0);
  const second = placeIndicator(250, 130, 600, 300, 120, [], body, null, 2);
  assert.notEqual(first.left, second.left);
  assert.notEqual(first.top, second.top);
  const path1 = indicatorLinePath(250, 130, first, 300, 0);
  const path2 = indicatorLinePath(250, 130, second, 300, 2);
  assert.notEqual(path1, path2);
  assert.equal((path1.match(/ L /g) || []).length, 4);
});

test('short labels identify muscles and their anatomical side', () => {
  assert.equal(shortMuscleName('quadriceps_l'), 'Quadriceps · L');
  assert.equal(shortMuscleName('chest_muscles_r'), 'Chest · R');
  assert.equal(shortMuscleName('diaphragm'), 'Diaphragm');
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
  const makeElement = () => ({ children: [], style: { setProperty(key, value) { this[key] = value; } }, classList: { toggle() {}, add() {} }, setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); }, remove() {} });
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: makeElement, createElementNS: makeElement };
  try {
    const container = makeElement(); container.clientWidth = 600; container.clientHeight = 600;
    const labels = createIndicatorLayer(container, view);
    const values = { layer: 'surface', scores: { quadriceps_l: 75 }, selected: 'quadriceps_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(values, 1000 + i); i++) {}
    const overlay = container.children[0];
    assert.equal(overlay.children.length, 1, 'a visible thigh gets a label');
    assert.equal(overlay.children[0].children[2].children[0].textContent, 'Quadriceps · L');
    assert.equal(overlay.children[0].children[2].children[1].textContent, '75%');
    const dot = overlay.children[0];
    const initialX = parseFloat(dot.style['--dot-x']);
    camera.position.set(.12, .86, 3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
    labels.update(values, 1050);
    const projectedX = parseFloat(dot.style['--dot-x']);
    assert.notEqual(projectedX, initialX, 'the point follows the camera before the next visibility check');
    for (let i = 0; i < 1000 && !labels.update(values, 1300 + i); i++) {}
    assert.ok(Math.abs(parseFloat(dot.style['--dot-x']) - projectedX) < .01, 'the visible anchor stays on the same part of the model');
    camera.position.set(0, .86, -3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
    for (let i = 0; i < 1000 && !labels.update(values, 2200 + i); i++) {}
    assert.equal(overlay.children[0].style.display, 'none', 'the label is hidden behind the body');
    const calf = { layer: 'surface', scores: { calf_l: 75 }, selected: 'calf_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(calf, 4000 + i); i++) {}
    const calfLabel = overlay.children.find(entry => entry.children[2].children[0].textContent === 'Calf · L');
    assert.ok(calfLabel && calfLabel.style.display !== 'none', 'a visible calf has a label');
    const calfY = parseFloat(calfLabel.style['--dot-y']);
    assert.ok(calfY > 380 && calfY < 500, `calf dot should be on the lower leg, got ${calfY}`);
    container.clientWidth = 565; container.clientHeight = 697;
    camera.aspect = 565 / 697; camera.updateProjectionMatrix();
    camera.position.set(0, .86, 3.3); camera.lookAt(0, .86, 0); camera.updateMatrixWorld();
    const many = { layer: 'surface', scores: { quadriceps_l: 75, quadriceps_r: 75, chest_muscles_l: 50, chest_muscles_r: 50 }, selected: 'quadriceps_l', isolated: false };
    for (let i = 0; i < 1000 && !labels.update(many, 6000 + i); i++) {}
    const visible = overlay.children.filter(entry => entry.style.display !== 'none');
    assert.ok(visible.length >= 2, `expected multiple labels, got ${visible.length}`);
    const { projectedBodyBounds } = await import('../src/front/body-3d/indicators.js');
    const silhouette = projectedBodyBounds(skin, camera, 565, 697);
    for (const entry of visible) {
      const left = parseFloat(entry.style['--label-x']);
      const right = left + parseFloat(entry.style['--label-width']);
      assert.ok(right <= silhouette.left || left >= silhouette.right, 'label must stay outside body bounds');
    }
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
  const makeElement = () => ({ children: [], style: { setProperty(key, value) { this[key] = value; } }, classList: { toggle() {}, add() {} }, setAttribute() {}, append(...nodes) { this.children.push(...nodes); }, appendChild(node) { this.children.push(node); }, remove() {} });
  const oldDocument = globalThis.document;
  globalThis.document = { createElement: makeElement, createElementNS: makeElement };
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
