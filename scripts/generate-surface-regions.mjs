import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { SURFACE_KEYS } from '../src/front/body-3d/anatomy.js';

// Nearest reference vertices are only a proxy for anatomy, not a segmentation.
function tree(points, depth = 0) {
  if (!points.length) return null;
  const axis = depth % 3;
  points.sort((a, b) => a[axis] - b[axis]);
  const middle = points.length >> 1;
  return { point: points[middle], axis, left: tree(points.slice(0, middle), depth + 1), right: tree(points.slice(middle + 1), depth + 1) };
}
function nearest(node, p, best = Infinity) {
  if (!node) return best;
  const q = node.point, d = (p[0]-q[0])**2 + (p[1]-q[1])**2 + (p[2]-q[2])**2;
  best = Math.min(best, d);
  const delta = p[node.axis] - q[node.axis];
  best = nearest(delta < 0 ? node.left : node.right, p, best);
  if (delta * delta < best) best = nearest(delta < 0 ? node.right : node.left, p, best);
  return best;
}
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
await mkdir('src/front/body-3d/assets', { recursive: true });
for (const body of ['male', 'female']) {
  const bytes = await readFile(`node_modules/open-anatomy-3d/models/anatomy-${body}.glb`);
  const gltf = await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
  gltf.scene.updateMatrixWorld(true);
  const skinMeshes = [];
  gltf.scene.getObjectByName('skin').traverse(o => { if (o.isMesh) skinMeshes.push(o); });
  if (skinMeshes.length !== 1 || !skinMeshes[0].geometry.index) throw Error(`Unexpected ${body} skin geometry`);
  const skin = skinMeshes[0], geometry = skin.geometry, index = geometry.index, pos = geometry.attributes.position;
  const refs = SURFACE_KEYS.map(key => {
    const mesh = gltf.scene.getObjectByName(key);
    if (!mesh?.isMesh) throw Error(`Missing ${key}`);
    const a = mesh.geometry.attributes.position, v = new THREE.Vector3(), points = [];
    for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(mesh.matrixWorld); points.push([v.x, v.y, v.z]); }
    return tree(points);
  });
  const triangles = index.count / 3, regions = new Uint8Array(triangles), centers = [];
  const v = new THREE.Vector3(), xyz = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i).applyMatrix4(skin.matrixWorld); xyz.set([v.x, v.y, v.z], i * 3); }
  const vertex = i => [xyz[i*3], xyz[i*3+1], xyz[i*3+2]];
  const height = new THREE.Box3().setFromObject(skin).max.y;
  for (let i = 0; i < triangles; i++) {
    const a = vertex(index.getX(i*3)), b = vertex(index.getX(i*3+1)), c = vertex(index.getX(i*3+2));
    const p = a.map((x, j) => (x + b[j] + c[j]) / 3); centers.push(p);
    // Above the shoulder line, only lateral shoulders and upper back are eligible.
    if (p[1] > height * 0.855 || (p[1] > height * 0.81 && Math.abs(p[0]) < height * 0.045)) continue;
    let best = (body === 'female' ? 0.12 : 0.10) ** 2, id = 0;
    for (let j = 0; j < refs.length; j++) {
      const key = SURFACE_KEYS[j];
      if (key.endsWith('_l') && p[0] < 0 || key.endsWith('_r') && p[0] > 0) continue;
      // Keep references within their anatomical territory, preventing proximity across limbs.
      const arm = /^(deltoid|upper_arm|forearm|hand)/.test(key);
      const leg = /^(gluteal|quadriceps|hamstrings|shin|calf|foot)/.test(key);
      const trunk = !arm && !leg;
      const y = p[1] / height, x = Math.abs(p[0]) / height;
      if (arm && (y < 0.42 || x < (body === 'male' ? 0.105 : 0.094))) continue;
      if (leg && (y > 0.62 || (y > 0.45 && x > (body === 'male' ? 0.105 : 0.11)))) continue;
      if (trunk && (y < 0.49 || x > (body === 'male' ? 0.12 : 0.105))) continue;
      const d = nearest(refs[j], p, best);
      if (d < best) { best = d; id = j + 1; }
    }
    regions[i] = id;
  }
  // Weld duplicate-position vertices before finding adjacent faces; clean isolated specks.
  const vertices = new Map(), faces = new Map();
  for (let t = 0; t < triangles; t++) for (let k = 0; k < 3; k++) {
    const i = index.getX(t*3+k), p = vertex(i), key = p.map(n => n.toFixed(5)).join(',');
    if (!vertices.has(key)) vertices.set(key, []); vertices.get(key).push(t);
  }
  for (const list of vertices.values()) for (const t of list) {
    if (!faces.has(t)) faces.set(t, new Set()); for (const n of list) if (n !== t) faces.get(t).add(n);
  }
  const seenAll = new Uint8Array(triangles), allComponents = [];
  for (let t = 0; t < triangles; t++) if (!seenAll[t]) {
    const q = [t]; seenAll[t] = 1;
    for (let i = 0; i < q.length; i++) for (const n of faces.get(q[i]) || []) if (!seenAll[n]) { seenAll[n] = 1; q.push(n); }
    allComponents.push(q.length);
  }
  console.log(body, 'skin components', allComponents.sort((a,b) => b-a).slice(0, 10));
  for (let pass = 0; pass < 12; pass++) {
    const next = regions.slice();
    for (let t = 0; t < triangles; t++) {
      if (!regions[t]) continue;
      const counts = new Uint16Array(28); for (const n of faces.get(t) || []) counts[regions[n]]++;
      let id = regions[t]; for (let j = 1; j < 28; j++) { const key = SURFACE_KEYS[j-1]; if ((key.endsWith('_l') && centers[t][0] < 0) || (key.endsWith('_r') && centers[t][0] > 0)) continue; if (counts[j] > counts[id] + 1) id = j; }
      next[t] = id;
    }
    regions.set(next);
  }
  const counts = Array.from({length: 28}, (_, id) => regions.reduce((n, value) => n + (value === id), 0));
  if (counts.slice(1).some(n => !n)) throw Error(`${body}: missing regions: ${SURFACE_KEYS.filter((_, i) => !counts[i+1])}`);
  for (let t = 0; t < triangles; t++) { const id = regions[t]; if (!id) continue; const key = SURFACE_KEYS[id-1]; if ((key.endsWith('_l') && centers[t][0] < -0.0001) || (key.endsWith('_r') && centers[t][0] > 0.0001)) throw Error(`${body}: wrong side ${key}`); }
  // Fill small one-triangle gaps surrounded by the same label, never the head or neck.
  for (let pass = 0; pass < 2; pass++) {
    const next = regions.slice();
    for (let t = 0; t < triangles; t++) {
      if (regions[t] || centers[t][1] > height * 0.81) continue;
      const counts = new Uint16Array(28);
      for (const n of faces.get(t) || []) counts[regions[n]]++;
      let id = 0;
      for (let j = 1; j < 28; j++) {
        const key = SURFACE_KEYS[j-1];
        if ((key.endsWith('_l') && centers[t][0] < 0) || (key.endsWith('_r') && centers[t][0] > 0)) continue;
        if (counts[j] > counts[id]) id = j;
      }
      if (id && counts[id] >= 3 && counts[id] >= counts[0] * 2) next[t] = id;
    }
    regions.set(next);
  }
  // Reassign tiny islands using their surrounding labeled faces; leave isolated pieces neutral.
  const cleaned = new Uint8Array(triangles);
  for (let t = 0; t < triangles; t++) {
    if (cleaned[t] || !regions[t]) continue;
    const id = regions[t], queue = [t], boundary = new Uint32Array(28); cleaned[t] = 1;
    for (let i = 0; i < queue.length; i++) for (const n of faces.get(queue[i]) || []) {
      if (regions[n] !== id) boundary[regions[n]]++;
      else if (!cleaned[n]) { cleaned[n] = 1; queue.push(n); }
    }
    if (queue.length >= Math.max(12, counts[id] * 0.01)) continue;
    for (const face of queue) {
      let replacement = 0;
      for (let j = 1; j < 28; j++) {
        const key = SURFACE_KEYS[j-1];
        if ((key.endsWith('_l') && centers[face][0] < 0) || (key.endsWith('_r') && centers[face][0] > 0)) continue;
        if (boundary[j] > boundary[replacement]) replacement = j;
      }
      regions[face] = replacement;
    }
  }
  for (let id = 0; id < 28; id++) counts[id] = regions.reduce((n, value) => n + (value === id), 0);
  if (counts.slice(1).some(n => !n)) throw Error(`${body}: missing region after cleaning`);
  const visited = new Uint8Array(triangles), components = Array.from({length: 28}, () => []);
  for (let t = 0; t < triangles; t++) {
    if (visited[t] || !regions[t]) continue;
    const id = regions[t], queue = [t]; visited[t] = 1;
    for (let i = 0; i < queue.length; i++) for (const n of faces.get(queue[i]) || []) {
      if (!visited[n] && regions[n] === id) { visited[n] = 1; queue.push(n); }
    }
    components[id].push(queue.length);
  }
  console.log(body, 'largest connected fraction', Object.fromEntries(SURFACE_KEYS.map((key, i) => [key, (Math.max(...components[i+1]) / counts[i+1]).toFixed(3)])));
  const result = { version: 1, body, sourceSha256: createHash('sha256').update(bytes).digest('hex'), keys: SURFACE_KEYS, triangleCount: triangles, regions: Array.from(regions) };
  await writeFile(`src/front/body-3d/assets/surface-${body}.json`, JSON.stringify(result));
  console.log(body, 'triangles', triangles, 'counts', Object.fromEntries(['neutral', ...SURFACE_KEYS].map((key, i) => [key, counts[i]])));
}
