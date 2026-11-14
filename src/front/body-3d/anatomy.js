import * as THREE from 'three';
import { ANATOMY_STRUCTURES } from 'open-anatomy-3d';

export const muscles = ANATOMY_STRUCTURES.filter(item => item.system === 'muscles');
export const LAYERS = ['surface', 'muscles', 'skeleton'];
export const SURFACE_KEYS = ['abdominal_muscles', ...[
  'deltoid', 'upper_arm_muscles', 'forearm_muscles', 'hand_muscles',
  'chest_muscles', 'trapezius', 'back_muscles', 'gluteal', 'quadriceps',
  'hamstrings', 'shin_muscles', 'calf', 'foot_muscles',
].flatMap(group => [`${group}_l`, `${group}_r`])];
export const SURFACE_MUSCLE_KEYS = new Set(SURFACE_KEYS);
export const normalizeScore = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0;
export const intensityLabel = value => value <= 0 ? 'Sin intensidad' : value < 34 ? 'Baja' : value < 67 ? 'Media' : 'Alta';
export function intensityColor(value) {
  const score = normalizeScore(value);
  if (!score) return new THREE.Color('#d6d9dc');
  const palette = ['#f6d77d', '#ef9959', '#d94d4b'];
  return score < 50
    ? new THREE.Color(palette[0]).lerp(new THREE.Color(palette[1]), score / 50)
    : new THREE.Color(palette[1]).lerp(new THREE.Color(palette[2]), (score - 50) / 50);
}
export function visibleSystems(layer, isolated = false) {
  // 'organs': translucent skin with the requested organs, vessels and muscles inside (structureColors).
  if (layer === 'organs') return { skin: true, muscles: true, skeleton: false };
  return { skin: layer === 'surface', muscles: layer === 'muscles', skeleton: layer === 'skeleton' || (layer === 'muscles' && isolated) };
}
