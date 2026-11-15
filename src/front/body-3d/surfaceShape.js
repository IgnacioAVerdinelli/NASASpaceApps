import * as THREE from 'three';

// Reshape the entire hanging region into the pelvis without changing face indices.
export function softenMaleGroin(geometry, matrixWorld) {
  const position = geometry.attributes.position;
  const inverse = matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const weights = new Float32Array(position.count);
  const groups = [];
  const byPosition = new Map();
  const groupForVertex = new Uint32Array(position.count);
  const smoothstep = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i);
    const key = `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`;
    let group = byPosition.get(key);
    if (group === undefined) {
      group = groups.length;
      byPosition.set(key, group);
      groups.push({ members: [], neighbors: new Set(), point: null, weight: 0 });
    }
    groups[group].members.push(i);
    groupForVertex[i] = group;
    point.applyMatrix4(matrixWorld);
    const lateral = 1 - smoothstep(0.025, 0.055, Math.abs(point.x));
    const front = smoothstep(-0.08, -0.035, point.z);
    const lower = smoothstep(0.70, 0.735, point.y);
    const weight = lateral * front * lower;
    const flatten = weight * (1 - smoothstep(0.84, 0.90, point.y));
    point.y += Math.max(0, 0.85 - point.y) * weight;
    point.z -= Math.max(0, point.z - 0.025) * flatten;
    weights[i] = Math.max(weight * (1 - smoothstep(0.85, 0.87, point.y)), flatten);
    point.applyMatrix4(inverse);
    position.setXYZ(i, point.x, point.y, point.z);
    groups[group].point = point.clone();
    groups[group].original = point.clone();
    groups[group].weight = weights[i];
  }
  if (geometry.index) {
    const index = geometry.index;
    for (let i = 0; i < index.count; i += 3) {
      const face = [0, 1, 2].map(n => groupForVertex[index.getX(i + n)]);
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        if (face[a] !== face[b]) groups[face[a]].neighbors.add(face[b]);
      }
    }
    for (let pass = 0; pass < 4; pass++) {
      const next = groups.map(group => {
        if (!group.weight || !group.neighbors.size) return group.point;
        const average = new THREE.Vector3();
        for (const neighbor of group.neighbors) average.add(groups[neighbor].point);
        return group.point.clone().lerp(average.multiplyScalar(1 / group.neighbors.size), 0.45 * group.weight);
      });
      groups.forEach((group, i) => { group.point = next[i]; });
    }
    for (const group of groups) if (group.weight) {
      const offset = group.point.clone().sub(group.original).clampLength(0, 0.002);
      group.point.copy(group.original).add(offset);
      for (const i of group.members) position.setXYZ(i, group.point.x, group.point.y, group.point.z);
    }
  }
  position.needsUpdate = true;

  // Keep the source normals elsewhere; compute changed normals in a float buffer.
  const source = geometry.attributes.normal;
  const normals = new Float32Array(source.count * 3);
  for (let i = 0; i < source.count; i++) {
    normals[i * 3] = source.getX(i);
    normals[i * 3 + 1] = source.getY(i);
    normals[i * 3 + 2] = source.getZ(i);
  }
  const original = normals.slice();
  geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  const normal = geometry.attributes.normal;
  const vector = new THREE.Vector3();
  const sourceNormal = new THREE.Vector3();
  for (const group of groups) {
    vector.set(0, 0, 0);
    for (const i of group.members) vector.add(new THREE.Vector3().fromBufferAttribute(normal, i));
    if (vector.lengthSq()) vector.normalize();
    for (const i of group.members) {
      sourceNormal.fromArray(original, i * 3);
      if (!weights[i] || !vector.lengthSq()) normal.setXYZ(i, sourceNormal.x, sourceNormal.y, sourceNormal.z);
      else {
        const blended = sourceNormal.lerp(vector, weights[i]).normalize();
        normal.setXYZ(i, blended.x, blended.y, blended.z);
      }
    }
  }
  normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

// Smooth only the front of the male face, keeping the indexed skin topology intact.
export function softenMaleFace(geometry, matrixWorld) {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  if (!index) return;
  const smoothstep = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);
  const vertices = new Map();
  const groups = [];
  const groupForVertex = new Uint32Array(positions.count);
  const point = new THREE.Vector3();
  for (let i = 0; i < positions.count; i++) {
    point.fromBufferAttribute(positions, i);
    const key = `${point.x.toFixed(6)},${point.y.toFixed(6)},${point.z.toFixed(6)}`;
    let group = vertices.get(key);
    if (group === undefined) {
      group = groups.length;
      vertices.set(key, group);
      const world = point.clone().applyMatrix4(matrixWorld);
      const weight = smoothstep(1.49, 1.53, world.y) * (1 - smoothstep(1.63, 1.67, world.y))
        * smoothstep(0.025, 0.055, world.z) * (1 - smoothstep(0.055, 0.085, Math.abs(world.x)));
      groups.push({ point: point.clone(), original: point.clone(), members: [], neighbors: new Set(), weight });
    }
    groups[group].members.push(i);
    groupForVertex[i] = group;
  }
  for (let i = 0; i < index.count; i += 3) {
    const face = [0, 1, 2].map(n => groupForVertex[index.getX(i + n)]);
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      if (face[a] !== face[b]) groups[face[a]].neighbors.add(face[b]);
    }
  }
  for (let pass = 0; pass < 3; pass++) {
    const next = groups.map(group => {
      if (!group.weight || !group.neighbors.size) return group.point;
      const average = new THREE.Vector3();
      for (const neighbor of group.neighbors) average.add(groups[neighbor].point);
      return group.point.clone().lerp(average.multiplyScalar(1 / group.neighbors.size), 0.3 * group.weight);
    });
    groups.forEach((group, i) => { group.point = next[i]; });
  }
  for (const group of groups) {
    if (!group.weight) continue;
    const offset = group.point.clone().sub(group.original).clampLength(0, 0.002);
    group.point.copy(group.original).add(offset);
    for (const i of group.members) positions.setXYZ(i, group.point.x, group.point.y, group.point.z);
  }
  positions.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}
