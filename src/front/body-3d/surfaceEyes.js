import * as THREE from 'three';

// Fill the eye openings using the model's original eye geometry.
export function addSurfaceEyes(root, skinGroup, body) {
  root.updateMatrixWorld(true);
  const leftEye = root.getObjectByName('eye_l');
  const rightEye = root.getObjectByName('eye_r');
  if (!leftEye?.isMesh || !rightEye?.isMesh) return null;

  const surfaceEyes = new THREE.Group();
  surfaceEyes.name = 'surface-eyes';
  skinGroup.add(surfaceEyes);
  surfaceEyes.updateWorldMatrix(true, false);
  const skinInverse = new THREE.Matrix4().copy(surfaceEyes.matrixWorld).invert();
  const skinTone = new THREE.MeshStandardMaterial({ color: '#d6d9dc', roughness: 0.9 });

  // The male source eyes include irregular anatomical meshes; use smooth,
  // symmetrical inserts sized from the left eyeball instead.
  if (body === 'male') {
    const bounds = new THREE.Box3().setFromObject(leftEye);
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const geometry = new THREE.SphereGeometry(1, 32, 24);
    for (const [sign, side] of [[1, 'l'], [-1, 'r']]) {
      const eye = new THREE.Mesh(geometry, skinTone);
      eye.name = `surface-eye-${side}`;
      const world = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.abs(center.x) * sign, center.y, center.z),
        new THREE.Quaternion(),
        new THREE.Vector3(size.x * 0.46, size.y * 0.40, size.z * 0.44),
      );
      world.premultiply(skinInverse).decompose(eye.position, eye.quaternion, eye.scale);
      eye.raycast = () => {};
      surfaceEyes.add(eye);
    }
    return surfaceEyes;
  }

  for (const [eye, side] of [[leftEye, 'l'], [rightEye, 'r']]) {
    const clone = eye.clone();
    clone.name = `surface-eye-${side}`;
    clone.material = skinTone;
    new THREE.Matrix4().multiplyMatrices(skinInverse, eye.matrixWorld).decompose(clone.position, clone.quaternion, clone.scale);
    clone.raycast = () => {};
    surfaceEyes.add(clone);
  }
  return surfaceEyes;
}
