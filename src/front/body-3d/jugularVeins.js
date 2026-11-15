import * as THREE from 'three';

// The open-anatomy-3d model has carotid arteries but no jugular veins. The internal jugular vein runs in the same
// sheath as the carotid, just outside it and a little in front, from the base of the skull down to where it meets the
// subclavian vein above the collarbone. This builds both veins as tubes along each carotid, offset that way, and adds
// them to the model's `vessels` group as `ijv_l` and `ijv_r`, so the organs layer colours, picks and focuses them like
// any other structure (structureColors, onSelect, explorationRequest). Drawn for orientation, not anatomy to scale:
// the radius is the in-flight vein's, about 4.7 mm (an area of ~70 mm², Marshall-Goebel 2019).
const OUTWARD = 0.012;     // m, outside the carotid
const FORWARD = 0.004;     // m, in front of it
const RADIUS = 0.0047;     // m
const BINS = 10;

function centerline(node) {
  const points = [], p = new THREE.Vector3();
  node.traverse(mesh => {
    if (!mesh.isMesh) return;
    const position = mesh.geometry.attributes.position;
    for (let i = 0; i < position.count; i += 2) points.push(p.fromBufferAttribute(position, i).applyMatrix4(mesh.matrixWorld).clone());
  });
  if (points.length < BINS * 4) return null;
  const ys = points.map(q => q.y), lo = Math.min(...ys), hi = Math.max(...ys);
  const bins = Array.from({ length: BINS }, () => ({ sum: new THREE.Vector3(), n: 0 }));
  for (const q of points) {
    const b = bins[Math.min(BINS - 1, Math.floor((q.y - lo) / (hi - lo || 1) * BINS))];
    b.sum.add(q); b.n++;
  }
  return bins.filter(b => b.n).map(b => b.sum.divideScalar(b.n));
}

export function addJugularVeins(root) {
  root.updateMatrixWorld(true);
  const vessels = root.getObjectByName('vessels');
  if (!vessels || root.getObjectByName('ijv_l')) return [];
  const toVessels = new THREE.Matrix4().copy(vessels.matrixWorld).invert();
  const added = [];
  for (const side of ['l', 'r']) {
    const carotid = root.getObjectByName(`carotid_${side}`);
    const line = carotid && centerline(carotid);
    if (!line) continue;
    const sign = Math.sign(line[0].x) || (side === 'l' ? 1 : -1);    // +x is the body's left in this model
    const path = line.map(q => new THREE.Vector3(q.x + sign * OUTWARD, q.y, q.z + FORWARD));
    const bottom = path[0];
    path.unshift(new THREE.Vector3(bottom.x + sign * 0.006, bottom.y - 0.022, bottom.z + 0.002));   // down to the subclavian
    const local = path.map(q => q.clone().applyMatrix4(toVessels));
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(local), 48, RADIUS * (1 / vessels.matrixWorld.getMaxScaleOnAxis()), 16, false);
    const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color: '#5b7fb8', roughness: 0.6, metalness: 0 }));
    const node = new THREE.Group();
    node.name = `ijv_${side}`;
    node.add(mesh);
    vessels.add(node);
    added.push(node);
  }
  return added;
}
