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
