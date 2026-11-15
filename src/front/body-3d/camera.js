import * as THREE from 'three';
import { muscles } from './anatomy.js';

const muscleKeys = new Set(muscles.map(muscle => muscle.key));
const posterior = new Set(['back_muscles', 'trapezius', 'rotator_cuff', 'gluteal', 'hamstrings', 'calf']);

export function muscleView(key) {
  if (!muscleKeys.has(key)) return null;
  return posterior.has(key.replace(/_[lr]$/, '')) ? 'back' : 'front';
}

// Orbit around the target rather than moving through the body when the view flips.
export function cameraOffset(from, to, progress) {
  const start = new THREE.Spherical().setFromVector3(from);
  const end = new THREE.Spherical().setFromVector3(to);
  const turn = THREE.MathUtils.euclideanModulo(end.theta - start.theta + Math.PI, 2 * Math.PI) - Math.PI;
  return new THREE.Vector3().setFromSpherical(new THREE.Spherical(
    THREE.MathUtils.lerp(start.radius, end.radius, progress),
    THREE.MathUtils.lerp(start.phi, end.phi, progress),
    start.theta + turn * progress,
  ));
}
