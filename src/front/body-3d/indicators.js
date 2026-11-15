import * as THREE from 'three';
import { muscles, SURFACE_KEYS, normalizeScore } from './anatomy.js';
import { pickSurfaceRegion } from './surfaceWeights.js';

const names = new Map(muscles.map(item => [item.key, item.label]));
const samplesPerRegion = 64;
const shortNames = {
  abdominal_muscles: 'Abdominals', back_muscles: 'Back', calf: 'Calf', chest_muscles: 'Chest',
  deltoid: 'Deltoid', diaphragm: 'Diaphragm', foot_muscles: 'Foot', forearm_muscles: 'Forearm',
  gluteal: 'Glutes', hamstrings: 'Hamstrings', hand_muscles: 'Hand', iliopsoas: 'Hip flexor',
  adductors: 'Inner thigh', intercostals: 'Intercostals', neck_muscles: 'Neck', pelvic_floor: 'Pelvic floor',
  quadriceps: 'Quadriceps', rotator_cuff: 'Rotator cuff', shin_muscles: 'Shin',
  shoulder_muscles: 'Shoulder', trapezius: 'Trapezius', upper_arm_muscles: 'Upper arm',
};

export function shortMuscleName(key) {
  const side = key.endsWith('_l') ? ' · L' : key.endsWith('_r') ? ' · R' : '';
  return (shortNames[key.replace(/_[lr]$/, '')] ?? names.get(key) ?? key) + side;
}

// Use the projected skin, including arms, to reserve the complete silhouette.
export function projectedBodyBounds(skin, camera, width, height) {
  const position = skin.geometry.attributes.position;
  const point = new THREE.Vector3();
  let left = Infinity, right = -Infinity;
  for (let i = 0; i < position.count; i += 4) {
    point.fromBufferAttribute(position, i).applyMatrix4(skin.matrixWorld).project(camera);
    if (point.z < -1 || point.z > 1) continue;
    const x = (point.x + 1) * width / 2;
    left = Math.min(left, x); right = Math.max(right, x);
  }
  if (!Number.isFinite(left)) return { left: 0, right: width };
  return { left: THREE.MathUtils.clamp(left, 0, width), right: THREE.MathUtils.clamp(right, 0, width) };
}

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
  const position = view.skin.geometry.attributes.position, index = view.skin.geometry.index;
  const vertex = new THREE.Vector3();
  for (const [key, indices] of faces) {
    if (!indices.length) { surface.set(key, []); continue; }
    // Equal samples along the body's height avoid overrepresenting dense foot triangles.
    const heights = indices.map(face => {
      let y = 0;
      for (let corner = 0; corner < 3; corner++) {
        const i = index ? index.getX(face * 3 + corner) : face * 3 + corner;
        y += vertex.fromBufferAttribute(position, i).applyMatrix4(view.skin.matrixWorld).y / 3;
      }
      return y;
    });
    const min = Math.min(...heights), max = Math.max(...heights);
    const bins = Array.from({ length: 16 }, () => []);
    indices.forEach((face, i) => bins[Math.min(15, Math.floor((heights[i] - min) / (max - min || 1) * 16))].push(face));
    const populated = bins.filter(bin => bin.length);
    const selectedFaces = [];
    for (const bin of populated) {
      const count = Math.min(bin.length, Math.floor(samplesPerRegion / populated.length));
      for (let i = 0; i < count; i++) selectedFaces.push(bin[Math.floor((i + .5) * bin.length / count)]);
    }
    surface.set(key, selectedFaces.map(face => sampleFace(view.skin, face)));
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

export function areaCheckpoints(areas, selected) {
  const checkpoints = new Map();
  for (const area of areas ?? []) for (const key of area.muscleKeys) {
    if (!checkpoints.has(key)) checkpoints.set(key, { key, title: area.title, selected: area.muscleKeys.includes(selected) });
  }
  return [...checkpoints.values()];
}

// Keep cards in side lanes; move vertically to fit without covering the body.
export function placeIndicator(x, y, width, height, labelWidth, occupied, body, previous = null, variation = 0) {
  const labelHeight = 30, margin = 8, bodyGap = 24, separation = 16;
  const preferred = x < (body.left + body.right) / 2 ? 'left' : 'right';
  const sides = previous?.side ? [previous.side, previous.side === 'left' ? 'right' : 'left'] : [preferred, preferred === 'left' ? 'right' : 'left'];
  for (const side of sides) {
    const preferredGap = bodyGap + variation % 3 * 8;
    for (const gap of [...new Set([preferredGap, bodyGap])]) {
      const left = side === 'left' ? body.left - gap - labelWidth : body.right + gap;
      if (left < margin || left + labelWidth > width - margin) continue;
      const bias = [0, -8, 10, -14, 6][variation % 5];
      const base = Math.max(margin, Math.min(height - labelHeight - margin, y - labelHeight / 2 + bias));
      const positions = previous?.side === side && Math.abs(previous.top - base) < 24 ? [previous.top, base] : [base];
      for (let step = 1; step <= 4; step++) positions.push(base - step * (labelHeight + separation), base + step * (labelHeight + separation));
      for (const top of positions) {
        const rect = { left, right: left + labelWidth, top, bottom: top + labelHeight, side };
        if (top < margin || rect.bottom > height - margin) continue;
        if (occupied.some(other => rect.left < other.right + separation && rect.right + separation > other.left && rect.top < other.bottom + separation && rect.bottom + separation > other.top)) continue;
        occupied.push(rect);
        return rect;
      }
    }
  }
  return null;
}

export function indicatorLinePath(x, y, rect, height, variation) {
  const direction = rect.side === 'left' ? -1 : 1;
  const lineEndX = rect.side === 'left' ? rect.right : rect.left;
  const endY = rect.top + 15;
  const stub = Math.min(8 + variation % 3 * 4, Math.abs(lineEndX - x) / 4);
  const bendY = THREE.MathUtils.clamp(y + direction * (6 + variation % 4 * 4), 4, height - 4);
  return `M ${x} ${y} L ${x + direction * stub} ${y} L ${x + direction * stub * 2} ${bendY} L ${lineEndX - direction * stub} ${endY} L ${lineEndX} ${endY}`;
}

export function createIndicatorLayer(container, view, checkpoints = false) {
  const overlay = document.createElement('div');
  overlay.className = 'atlas-indicators';
  if (!checkpoints) overlay.setAttribute('aria-hidden', 'true');
  else overlay.classList.add('atlas-checkpoints');
  container.appendChild(overlay);
  const entries = new Map(), previousPlacements = new Map(), previousAnchors = new Map(), display = new Map();
  const measure = document.createElement('canvas').getContext?.('2d');
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
  let lastUpdate = -Infinity, lastFrame = null, job = null, lastValues = null, currentValues = null;

  // Projection is cheap and follows every camera frame; visibility checks stay budgeted below.
  function projectEntries(now, width, height, reducedMotion) {
    const delta = lastFrame === null ? 0 : Math.max(0, Math.min(100, now - lastFrame));
    lastFrame = now;
    view.camera.updateMatrixWorld();
    for (const [key, state] of display) {
      const entry = entries.get(key), sample = state.sample;
      point.copy(sample.point).applyMatrix4(sample.mesh.matrixWorld);
      projected.copy(point).project(view.camera);
      normalMatrix.getNormalMatrix(sample.mesh.matrixWorld);
      normal.copy(sample.normal).applyNormalMatrix(normalMatrix).normalize();
      toCamera.copy(view.camera.position).sub(point).normalize();
      if (!sample.mesh.visible || projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1 || normal.dot(toCamera) <= 0) {
        entry.style.display = 'none';
        continue;
      }
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      entry.style.display = '';
      if (checkpoints) {
        entry.style.left = `${x}px`; entry.style.top = `${y}px`;
      } else {
        const amount = reducedMotion ? 1 : 1 - Math.exp(-delta / 100);
        state.current.left += (state.rect.left - state.current.left) * amount;
        state.current.top += (state.rect.top - state.current.top) * amount;
        // A side change snaps to the new lane so the label never travels across the body.
        if (state.current.side !== state.rect.side) state.current = { ...state.rect };
        const rect = { ...state.current, right: state.current.left + state.labelWidth };
        entry.style.setProperty('--dot-x', `${x}px`); entry.style.setProperty('--dot-y', `${y}px`);
        entry.style.setProperty('--label-x', `${rect.left}px`); entry.style.setProperty('--label-y', `${rect.top}px`);
        entry.style.setProperty('--label-width', `${state.labelWidth}px`);
        entry.children[1].children[0].setAttribute('d', indicatorLinePath(x, y, rect, height, state.variation));
      }
    }
  }

  function update(values, now, reducedMotion = false) {
    currentValues = values;
    const { layer, isolated, scores, selected, checkpointItems } = values;
    const width = container.clientWidth, height = container.clientHeight;
    const changed = !lastValues || lastValues.layer !== layer || lastValues.isolated !== isolated || lastValues.scores !== scores || lastValues.selected !== selected || lastValues.checkpointItems !== checkpointItems || lastValues.width !== width || lastValues.height !== height;
    if (layer !== 'surface' && layer !== 'muscles' || width < 60 || height < 60) {
      for (const entry of entries.values()) entry.style.display = 'none';
      display.clear(); previousAnchors.clear(); previousPlacements.clear();
      job = null; lastValues = { layer, isolated, scores, selected, width, height };
      return true;
    }
    if (lastValues && lastValues.layer !== layer) { display.clear(); previousAnchors.clear(); previousPlacements.clear(); for (const entry of entries.values()) entry.style.display = 'none'; }
    projectEntries(now, width, height, reducedMotion);
    if (changed) { job = null; lastUpdate = -Infinity; }
    if (!job) {
      if (now - lastUpdate < 150) return true;
      const camera = view.camera.clone(); camera.updateMatrixWorld();
      const targets = layer === 'surface' ? [view.skin] : view.muscleMeshes.filter(item => item.mesh.visible).map(item => item.mesh);
      if (layer === 'muscles' && view.skeletonGroup.visible) targets.push(...view.skeletonMeshes.filter(mesh => mesh.visible));
      job = { camera, targets, ordered: checkpoints ? areaCheckpoints(checkpointItems, selected) : orderedIndicators(scores, selected).filter(item => !values.indicatorFilter || values.indicatorFilter(item.key)), index: 0, occupied: [], seen: new Set(), body: projectedBodyBounds(view.skin, camera, width, height) };
      lastValues = { layer, isolated, scores, selected, checkpointItems, width, height };
    }
    const { camera, targets, ordered, occupied, seen, body } = job;
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
        ranked.push({ sample, facing, x: projected.x, y: projected.y });
      }
      if (!ranked.length) continue;
      const median = axis => ranked.map(candidate => candidate[axis]).sort((a, b) => a - b)[Math.floor(ranked.length / 2)];
      const centerX = median('x'), centerY = median('y');
      const previousAnchor = previousAnchors.get(item.key);
      for (const candidate of ranked) {
        const centerDistance = (candidate.x - centerX) ** 2 + (candidate.y - centerY) ** 2;
        candidate.rank = candidate.sample === previousAnchor ? -Infinity : centerDistance - candidate.facing * .002;
      }
      ranked.sort((a, b) => a.rank - b.rank);
      let visiblePoint = null, chosenSample = null, rect = null;
      // Optional caller-defined text (e.g. localized name and real measurement).
      const custom = currentValues?.indicatorText?.(item.key, item.value);
      const shortName = custom?.name ?? shortMuscleName(item.key);
      const valueText = custom?.value ?? `${Math.round(item.value)}%`;
      const variation = [...item.key].reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0);
      // Measure with the overlay's real font size so pages can enlarge the labels via CSS.
      const fontSize = (typeof getComputedStyle === 'function' && parseFloat(getComputedStyle(overlay).fontSize)) || (width <= 500 ? 10 : 11);
      if (measure) measure.font = `600 ${fontSize}px system-ui, sans-serif`;
      const labelWidth = Math.max(112, Math.ceil((measure?.measureText(`${shortName} ${valueText}`).width ?? (shortName.length + valueText.length) * 6.2) + 40));
      for (const { sample } of ranked.slice(0, 3)) {
        point.copy(sample.point).applyMatrix4(sample.mesh.matrixWorld);
        projected.copy(point).project(camera);
        const candidateX = (projected.x + 1) * width / 2, candidateY = (1 - projected.y) * height / 2;
        const available = checkpoints ? { left: candidateX, top: candidateY } : placeIndicator(candidateX, candidateY, width, height, labelWidth, occupied.slice(), body, previousPlacements.get(item.key), variation);
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
        visiblePoint = point.clone(); chosenSample = sample; rect = available;
        previousAnchors.set(item.key, sample);
        if (!checkpoints) occupied.push(rect);
        break;
      }
      if (!visiblePoint) continue;
      projected.copy(visiblePoint).project(camera);
      const x = (projected.x + 1) * width / 2, y = (1 - projected.y) * height / 2;
      let entry = entries.get(item.key);
      if (checkpoints) {
        if (!entry) {
          entry = document.createElement('button'); entry.type = 'button'; entry.className = 'atlas-checkpoint';
          entry.addEventListener('pointerdown', event => event.stopPropagation());
          entry.addEventListener('click', () => currentValues?.onSelect?.(item.key));
          overlay.appendChild(entry); entries.set(item.key, entry);
        }
        entry.setAttribute('aria-label', `${item.title}: ${shortName}`);
        entry.setAttribute('aria-pressed', String(item.selected));
        display.set(item.key, { sample: chosenSample });
        entry.style.left = `${x}px`; entry.style.top = `${y}px`; entry.style.display = '';
        seen.add(item.key);
        continue;
      }
      if (!entry) {
        entry = document.createElement('div'); entry.className = 'atlas-indicator';
        const dot = document.createElement('span'); dot.className = 'atlas-indicator-dot';
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        line.classList.add('atlas-indicator-line');
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        line.appendChild(path);
        const text = document.createElement('span'); text.className = 'atlas-indicator-text';
        const name = document.createElement('span'); name.className = 'atlas-indicator-name';
        const value = document.createElement('strong'); value.className = 'atlas-indicator-value';
        text.append(name, value);
        entry.append(dot, line, text); overlay.appendChild(entry); entries.set(item.key, entry);
      }
      entry.children[2].children[0].textContent = shortName;
      entry.children[2].children[1].textContent = valueText;
      const current = display.get(item.key)?.current ?? { ...rect };
      display.set(item.key, { sample: chosenSample, rect, current, labelWidth, variation });
      previousPlacements.set(item.key, rect);
      entry.style.display = '';
      seen.add(item.key);
    }
    if (job.index < ordered.length) return false;
    for (const [key, entry] of entries) if (!seen.has(key)) { entry.style.display = 'none'; display.delete(key); previousAnchors.delete(key); previousPlacements.delete(key); }
    job = null; lastUpdate = now;
    projectEntries(now, width, height, reducedMotion);
    return true;
  }

  return { update, dispose: () => overlay.remove() };
}
