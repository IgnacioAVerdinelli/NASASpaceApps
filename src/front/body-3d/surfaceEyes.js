import * as THREE from 'three';

// Fill the eye openings using the model's original eye geometry.
export function addSurfaceEyes(root, skinGroup) {
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
