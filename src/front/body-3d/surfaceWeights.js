import * as THREE from 'three';

// Smooth boundaries along the skin without mixing disconnected limbs.
export function buildSurfaceWeights(geometry, regions, regionCount, { leftIds = [], rightIds = [] } = {}) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  const vertexCount = positions.count;
  const stride = regionCount + 1;
  const faces = (index ? index.count : vertexCount) / 3;
  if (!Number.isInteger(faces) || regions.length !== faces) throw new Error('Region count does not match geometry');
  const vertexToWeld = new Int32Array(vertexCount);
  const weldMap = new Map(), points = [], neighbors = [];
  for (let i = 0; i < vertexCount; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i);
    const key = [point.x, point.y, point.z].map(value => value.toFixed(6)).join(',');
    let weld = weldMap.get(key);
    if (weld === undefined) {
      weld = points.length;
      weldMap.set(key, weld); points.push(point); neighbors.push(new Set());
    }
    vertexToWeld[i] = weld;
  }
  const accumulated = new Float32Array(points.length * stride);
  const totals = new Float32Array(points.length);
  const at = i => index ? index.getX(i) : i;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  for (let face = 0; face < faces; face++) {
    const region = regions[face];
    if (!Number.isInteger(region) || region < 0 || region > regionCount) throw new Error('Invalid region ID');
    const vertices = [at(face * 3), at(face * 3 + 1), at(face * 3 + 2)];
    a.fromBufferAttribute(positions, vertices[0]); b.fromBufferAttribute(positions, vertices[1]); c.fromBufferAttribute(positions, vertices[2]);
    const area = new THREE.Triangle(a, b, c).getArea();
    const welded = vertices.map(i => vertexToWeld[i]);
    for (let j = 0; j < 3; j++) {
      const current = welded[j], next = welded[(j + 1) % 3];
      accumulated[current * stride + region] += area;
      totals[current] += area;
      if (current !== next) { neighbors[current].add(next); neighbors[next].add(current); }
    }
  }
  for (let i = 0; i < points.length; i++) {
    if (!totals[i]) accumulated[i * stride] = 1;
    else for (let id = 0; id < stride; id++) accumulated[i * stride + id] /= totals[i];
  }
  let current = accumulated;
  for (let pass = 0; pass < 8; pass++) {
    const next = new Float32Array(current.length);
    for (let i = 0; i < points.length; i++) {
      let total = 0;
      for (const neighbor of neighbors[i]) {
        const weight = 1;
        total += weight;
        for (let id = 0; id < stride; id++) next[i * stride + id] += current[neighbor * stride + id] * weight;
      }
      for (let id = 0; id < stride; id++) next[i * stride + id] = total ? (current[i * stride + id] + next[i * stride + id] / total) / 2 : current[i * stride + id];
    }
    current = next;
  }
  for (let i = 0; i < points.length; i++) {
    const excluded = points[i].x < -0.0001 ? leftIds : points[i].x > 0.0001 ? rightIds : [];
    for (const id of excluded) if (Number.isInteger(id) && id > 0 && id < stride) current[i * stride + id] = 0;
    let total = 0;
    for (let id = 0; id < stride; id++) total += current[i * stride + id];
    if (!total) current[i * stride] = 1;
    else for (let id = 0; id < stride; id++) current[i * stride + id] /= total;
  }
  const weights = new Float32Array(vertexCount * stride);
  for (let i = 0; i < vertexCount; i++) weights.set(current.subarray(vertexToWeld[i] * stride, (vertexToWeld[i] + 1) * stride), i * stride);
  return { weights, stride, vertexCount };
}

export function pickSurfaceRegion(geometry, weightsObj, faceIndex, pointLocal) {
  const { weights, stride, vertexCount } = weightsObj;
  const index = geometry.index, positions = geometry.attributes.position;
  const faceCount = (index ? index.count : positions.count) / 3;
  if (!Number.isInteger(faceIndex) || faceIndex < 0 || faceIndex >= faceCount || vertexCount !== positions.count) return 0;
  const vertices = [0, 1, 2].map(i => index ? index.getX(faceIndex * 3 + i) : faceIndex * 3 + i);
  const [a, b, c] = vertices.map(i => new THREE.Vector3().fromBufferAttribute(positions, i));
  const bary = THREE.Triangle.getBarycoord(pointLocal, a, b, c, new THREE.Vector3());
  if (!bary) return 0;
  let best = 0, maximum = -Infinity;
  for (let id = 0; id < stride; id++) {
    const value = weights[vertices[0] * stride + id] * bary.x + weights[vertices[1] * stride + id] * bary.y + weights[vertices[2] * stride + id] * bary.z;
    if (value > maximum) { maximum = value; best = id; }
  }
  return best;
}
