import * as THREE from 'three';

// Reduce the forward protrusion on the male skin without changing its topology.
export function softenMaleGroin(geometry, matrixWorld) {
  const position = geometry.attributes.position;
  const inverse = matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  const smoothstep = (a, b, x) => {
    const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1);
    return t * t * (3 - 2 * t);
  };
  for (let i = 0; i < position.count; i++) {
    point.fromBufferAttribute(position, i).applyMatrix4(matrixWorld);
    const lateral = 1 - smoothstep(0.025, 0.065, Math.abs(point.x));
    const vertical = smoothstep(0.735, 0.775, point.y) * (1 - smoothstep(0.855, 0.905, point.y));
    const forward = smoothstep(0.025, 0.065, point.z);
    const amount = lateral * vertical * forward;
    point.z -= Math.max(0, point.z - 0.035) * amount * 0.82;
    point.applyMatrix4(inverse);
    position.setXYZ(i, point.x, point.y, point.z);
  }
  position.needsUpdate = true;
  // The source normals are normalized Int8 data; recomputing into that buffer
  // rounds most values to zero and makes the whole skin render dark.
  // Keep the original lighting for this small, local adjustment.
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
