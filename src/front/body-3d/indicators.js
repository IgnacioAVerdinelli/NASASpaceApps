import * as THREE from 'three';
import { muscles, SURFACE_KEYS, normalizeScore } from './anatomy.js';
import { pickSurfaceRegion } from './surfaceWeights.js';

const names = new Map(muscles.map(item => [item.key, item.label]));
const samplesPerRegion = 64;

// Sample the original geometry so dots stay on the actual skin or muscle, in both models.
function sampleFace(mesh, face) {
  const geometry = mesh.geometry, position = geometry.attributes.position, index = geometry.index;
  const indices = [0, 1, 2].map(i => index ? index.getX(face * 3 + i) : face * 3 + i);
  const points = indices.map(i => new THREE.Vector3().fromBufferAttribute(position, i));
  const point = points[0].clone().add(points[1]).add(points[2]).divideScalar(3);
  const normal = new THREE.Vector3();
  const normals = geometry.attributes.normal;
  if (normals) for (const i of indices) normal.add(new THREE.Vector3().fromBufferAttribute(normals, i));
  else new THREE.Triangle(...points).getNormal(normal);
  return { mesh, point, normal: normal.normalize() };
}

export function buildIndicatorSamples(view) {
  const faces = new Map(SURFACE_KEYS.map(key => [key, []]));
  view.regions.forEach((id, face) => { if (id) faces.get(SURFACE_KEYS[id - 1])?.push(face); });
  const surface = new Map();
  for (const [key, indices] of faces) {
    const count = Math.min(samplesPerRegion, indices.length);
    surface.set(key, Array.from({ length: count }, (_, i) => sampleFace(view.skin, indices[Math.floor((i + .5) * indices.length / count)])));
  }
  const muscle = new Map();
  for (const item of view.muscleMeshes) {
    const geometry = item.mesh.geometry;
    const count = Math.floor((geometry.index?.count ?? geometry.attributes.position.count) / 3);
    if (!count) continue;
    const samples = muscle.get(item.key) ?? [];
    const amount = Math.min(samplesPerRegion, count);
    for (let i = 0; i < amount; i++) samples.push(sampleFace(item.mesh, Math.floor((i + .5) * count / amount)));
    muscle.set(item.key, samples);
  }
  return { surface, muscle };
}

export function orderedIndicators(scores, selected) {
  return Object.entries(scores).filter(([key, value]) => names.has(key) && Number.isFinite(value) && value > 0)
    .map(([key, value]) => ({ key, value: normalizeScore(value), label: names.get(key), selected: key === selected }))
    .sort((a, b) => Number(b.selected) - Number(a.selected) || b.value - a.value || a.key.localeCompare(b.key));
}

// Pick a side that fits; preserve the point-to-label connection and reject overlaps.
export function placeIndicator(x, y, width, height, labelWidth, occupied) {
  const labelHeight = 30, gap = 16, margin = 4;
  if (y - labelHeight / 2 < margin || y + labelHeight / 2 > height - margin) return null;
  const choices = x < width / 2 ? [x + gap, x - gap - labelWidth] : [x - gap - labelWidth, x + gap];
  for (const left of choices) {
    const rect = { left, right: left + labelWidth, top: y - labelHeight / 2, bottom: y + labelHeight / 2 };
    if (rect.left < margin || rect.right > width - margin) continue;
    if (occupied.some(other => rect.left < other.right + 6 && rect.right + 6 > other.left && rect.top < other.bottom + 6 && rect.bottom + 6 > other.top)) continue;
    occupied.push(rect);
    return rect;
  }
  return null;
}

export function createIndicatorLayer(container, view) {
  const overlay = document.createElement('div');
  overlay.className = 'atlas-indicators';
  overlay.setAttribute('aria-hidden', 'true');
  container.appendChild(overlay);
  const entries = new Map();
  const raycaster = new THREE.Raycaster();
  const samples = buildIndicatorSamples(view);
  // The model is static; bounding boxes rule out almost all meshes before triangle raycasts.
  const bounds = new Map();
  for (const mesh of [view.skin, ...view.muscleMeshes.map(item => item.mesh), ...view.skeletonMeshes]) {
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    bounds.set(mesh, mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld));
  }
  const point = new THREE.Vector3(), normal = new THREE.Vector3(), toCamera = new THREE.Vector3();
  const projected = new THREE.Vector3(), normalMatrix = new THREE.Matrix3(), boxHit = new THREE.Vector3();
  let lastUpdate = -Infinity, job = null, lastValues = null;

  function update(values, now) {
    const { layer, isolated, scores, selected } = values;
    const width = container.clientWidth, height = container.clientHeight;
    const changed = !lastValues || lastValues.layer !== layer || lastValues.isolated !== isolated || lastValues.scores !== scores || lastValues.selected !== selected || lastValues.width !== width || lastValues.height !== height;
    if (layer !== 'surface' && layer !== 'muscles' || width < 60 || height < 60) {
      for (const entry of entries.values()) entry.style.display = 'none';
      job = null; lastValues = { layer, isolated, scores, selected, width, height };
      return true;
    }
    if (changed) { job = null; lastUpdate = -Infinity; }
    if (!job) {
      if (now - lastUpdate < 150) return true;
      const camera = view.camera.clone(); camera.updateMatrixWorld();
      const targets = layer === 'surface' ? [view.skin] : view.muscleMeshes.filter(item => item.mesh.visible).map(item => item.mesh);
      if (layer === 'muscles' && view.skeletonGroup.visible) targets.push(...view.skeletonMeshes.filter(mesh => mesh.visible));
      job = { camera, targets, ordered: orderedIndicators(scores, selected), index: 0, occupied: [], seen: new Set() };
      lastValues = { layer, isolated, scores, selected, width, height };
    }
    const { camera, targets, ordered, occupied, seen } = job;
    const started = performance.now();
    while (job.index < ordered.length && performance.now() - started < 6) {
      const item = ordered[job.index++];
      if (isolated && layer === 'muscles' && item.key !== selected) continue;
      const candidates = (layer === 'surface' ? samples.surface : samples.muscle).get(item.key);
      if (!candidates?.length) continue;
      const ranked = [];
      for (const sample of candidates) {
        if (!sample.mesh.visible) continue;
        point.copy(sample.point).applyMatrix4(sample.mesh.matrixWorld);
        projected.copy(point).project(camera);
        if (projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1) continue;
        normalMatrix.getNormalMatrix(sample.mesh.matrixWorld);
        normal.copy(sample.normal).applyNormalMatrix(normalMatrix).normalize();
        toCamera.copy(camera.position).sub(point).normalize();
        const facing = normal.dot(toCamera);
        if (facing <= .15) continue;
        ranked.push({ sample, facing });
      }
      ranked.sort((a, b) => b.facing - a.facing);
      let visiblePoint = null, rect = null;
      const labelWidth = Math.min(160, Math.max(96, width * .34));
      for (const { sample } of ranked.slice(0, 3)) {
        point.copy(sample.point).applyMatrix4(sample.mesh.matrixWorld);
        projected.copy(point).project(camera);
        const candidateX = (projected.x + 1) * width / 2, candidateY = (1 - projected.y) * height / 2;
        const available = placeIndicator(candidateX, candidateY, width, height, labelWidth, occupied.slice());
        if (!available) continue;
        toCamera.copy(point).sub(camera.position);
        const distance = toCamera.length();
        raycaster.set(camera.position, toCamera.normalize());
        raycaster.far = distance + .012;
        const nearby = targets.filter(mesh => raycaster.ray.intersectBox(bounds.get(mesh), boxHit) && boxHit.distanceTo(camera.position) <= raycaster.far);
        const hit = raycaster.intersectObjects(nearby, false)[0];
        if (!hit || hit.distance < distance - .012) continue;
        if (layer === 'surface') {
          const id = pickSurfaceRegion(view.skin.geometry, view.surfaceWeights, hit.faceIndex, view.skin.worldToLocal(hit.point.clone()));
          if (SURFACE_KEYS[id - 1] !== item.key) continue;
        } else if (hit.object !== sample.mesh) continue;
        visiblePoint = point.clone(); rect = available;
        occupied.push(rect);
        break;
      }
      if (!visiblePoint) continue;
      projected.copy(visiblePoint).project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      let entry = entries.get(item.key);
      if (!entry) {
        entry = document.createElement('div'); entry.className = 'atlas-indicator';
        const dot = document.createElement('span'); dot.className = 'atlas-indicator-dot';
        const line = document.createElement('span'); line.className = 'atlas-indicator-line';
        const text = document.createElement('span'); text.className = 'atlas-indicator-text';
        const name = document.createElement('span'); name.className = 'atlas-indicator-name';
        const value = document.createElement('strong'); value.className = 'atlas-indicator-value';
        text.append(name, value);
        entry.append(dot, line, text); overlay.appendChild(entry); entries.set(item.key, entry);
      }
      entry.children[2].children[0].textContent = item.label;
      entry.children[2].children[1].textContent = `${Math.round(item.value)}%`;
      entry.style.setProperty('--dot-x', `${x}px`); entry.style.setProperty('--dot-y', `${y}px`);
      entry.style.setProperty('--label-x', `${rect.left}px`); entry.style.setProperty('--label-y', `${rect.top}px`);
      entry.style.setProperty('--label-width', `${labelWidth}px`);
      entry.classList.toggle('atlas-indicator-left', rect.left < x);
      entry.style.display = '';
      seen.add(item.key);
    }
    if (job.index < ordered.length) return false;
    for (const [key, entry] of entries) if (!seen.has(key)) entry.style.display = 'none';
    job = null; lastUpdate = now;
    return true;
  }

  return { update, dispose: () => overlay.remove() };
}
