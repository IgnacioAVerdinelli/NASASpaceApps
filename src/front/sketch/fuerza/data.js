import * as THREE from 'three';
import reference from '../data/cft70-reference.json' with { type: 'json' };

export { reference };

// Tripulante SIMULADO. Evaluaciones con dinamómetro a bordo (tipo MARES):
// FD15 y luego cada 30 días, según el esquema de ESA (Petersen y col. 2016).
export const crew = { id: 'CM-2', missionDays: 180, today: 112, baselineLabel: 'Pre-vuelo (L-60)' };
export const evaluations = [
  { id: 'pre', day: 0, label: 'Pre' },
  { id: 'fd15', day: 15, label: 'FD 15' },
  { id: 'fd45', day: 45, label: 'FD 45' },
  { id: 'fd75', day: 75, label: 'FD 75' },
  { id: 'fd105', day: 105, label: 'FD 105' },
];
export const upcoming = [135, 165];

// % de cambio respecto de la línea base, por evaluación (simulado).
const series = {
  quadriceps: [0, -2.1, -4.0, -6.2, -8.4],
  hamstrings: [0, 0.8, -0.5, -1.6, -2.4],
  calf: [0, -3.5, -7.8, -10.9, -13.6],
  shin_muscles: [0, -0.4, -1.1, -0.8, -1.5],
  back_muscles: [0, -1.5, -3.2, -5.1, -6.3],
  abdominal_muscles: [0, 1.2, -0.6, -2.0, -3.1],
};
// Línea base personal en N·m (simulada, del orden de los valores previos de CFT70).
const baseline = { quadriceps: 212, hamstrings: 104, calf: 124, shin_muscles: 34, back_muscles: 418, abdominal_muscles: 198 };

export const groups = [
  { key: 'quadriceps', name: 'Cuádriceps', region: 'Muslo, cara anterior' },
  { key: 'hamstrings', name: 'Isquiotibiales', region: 'Muslo, cara posterior' },
  { key: 'calf', name: 'Pantorrilla', region: 'Sóleo y gemelos' },
  { key: 'shin_muscles', name: 'Tibial anterior', region: 'Pierna, cara anterior' },
  { key: 'back_muscles', name: 'Extensores de la espalda', region: 'Tronco, cara posterior' },
  { key: 'abdominal_muscles', name: 'Abdominales', region: 'Tronco, cara anterior' },
].map(group => {
  const test = reference.tests.find(item => item.muscle === group.key);
  const points = evaluations.map((evaluation, i) => ({ ...evaluation, pct: series[group.key][i], nm: Math.round(baseline[group.key] * (1 + series[group.key][i] / 100)) }));
  // Ambos lados con el mismo valor: la referencia mide una sola pierna (lado no especificado).
  const keys = group.key === 'abdominal_muscles' ? ['abdominal_muscles'] : [`${group.key}_l`, `${group.key}_r`];
  return { ...group, keys, test, baseline: baseline[group.key], points };
});

export const keyToGroup = new Map(groups.flatMap(group => group.keys.map(key => [key, group.key])));

// Escala de 4 niveles, de verde (sin cambio) a rojo (alto riesgo). La luminosidad baja con la
// gravedad para que el orden se lea también sin distinguir colores; siempre va con texto.
// Validada con el chequeo de daltonismo de la skill dataviz. Umbral −20 %: Scott y col. 2023, NASA.
export const levels = [
  { id: 1, label: 'Sin cambio detectable', range: 'entre −5 % y +5 % o más', color: '#8fcca5' },
  { id: 2, label: 'Pérdida leve', range: '−5 % a −10 %', color: '#d7a12a' },
  { id: 3, label: 'Pérdida moderada', range: '−10 % a −20 %', color: '#d1602b' },
  { id: 4, label: 'Supera el umbral de alto riesgo', range: '−20 % o más', color: '#a4242f', alert: true },
];
export const levelOf = pct => pct > -5 ? levels[0] : pct > -10 ? levels[1] : pct > -20 ? levels[2] : levels[3];
const threeColors = levels.map(level => new THREE.Color(level.color));
// score = posición en la escala (1 a 4). Los valores intermedios solo aparecen durante la
// transición entre evaluaciones y mezclan los dos niveles vecinos.
export const colorScale = score => {
  const t = Math.max(1, Math.min(4, score)) - 1, i = Math.min(2, Math.floor(t));
  return threeColors[i].clone().lerp(threeColors[i + 1], t - i);
};

export const fmtPct = value => `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value).toFixed(1).replace('.', ',')} %`;
