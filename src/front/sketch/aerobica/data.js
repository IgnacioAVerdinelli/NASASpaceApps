import reference from '../data/cft70-aerobic-reference.json' with { type: 'json' };

export { reference };

// Tripulante SIMULADO (mismo CM-2 que fuerza). Prueba en cicloergómetro CEVIS con analizador de gases
// PFS, según OCHMO-STD-100.1A Tabla 8 [6028]: FD14, FD75, FD165 y R-14 en una misión de 180 días.
// La forma sigue lo publicado para la ISS (Moore y col. 2014): caída fuerte al inicio (~17 %) y
// recuperación parcial en vuelo gracias al ejercicio, sin volver al valor previo.
export const evaluations = [
  { id: 'pre', day: 0, label: 'Pre', vo2: 41.5, hrPeak: 182, rer: 1.18, watts: 250, rpe: 18, stop: 'Fatiga de piernas', method: 'medido' },
  { id: 'fd14', day: 14, label: 'FD 14', vo2: 36.3, hrPeak: 181, rer: 1.15, watts: 215, rpe: 19, stop: 'Fatiga de piernas', method: 'medido' },
  { id: 'fd75', day: 75, label: 'FD 75', vo2: 38.1, hrPeak: 183, rer: 1.16, watts: 225, rpe: 18, stop: 'Fatiga general', method: 'medido' },
];
export const upcoming = [{ day: 165, label: 'FD 165' }, { day: 166, label: 'R−14' }];
export const baseline = evaluations[0].vo2;
export const NASA_FLOOR = reference.nasaFloor; // 32,9 ml/kg/min, NASA-STD-3001 Vol 1 [V1 4001]
export const pctOf = vo2 => (vo2 / baseline - 1) * 100;

// Criterios de prueba máxima (los mismos que usa NASA para validar la prueba).
export const maxCriteria = [
  { id: 'rer', label: 'RER ≥ 1,1', ok: e => e.rer >= 1.1, value: e => e.rer.toFixed(2).replace('.', ',') },
  { id: 'rpe', label: 'Borg ≥ 17', ok: e => e.rpe >= 17, value: e => String(e.rpe) },
];

// Qué limita el VO₂pico, según la ecuación de Fick: VO₂ = FC × volumen sistólico × diferencia arteriovenosa de O₂.
// Colores de identidad (no de estado), validados con la skill dataviz.
export const components = [
  {
    id: 'heart', name: 'Corazón', role: 'Bombea la sangre (gasto cardíaco)', color: '#c2417a',
    keys: ['heart', 'coronary_arteries'],
    effect: 'Llega menos sangre al corazón y bombea menos por latido. Se reporta una leve atrofia del ventrículo izquierdo.',
    evidence: 'En CFT70 la FC pico no cambió (0 lpm en el grupo sin contramedida): la pérdida no viene del pulso, sino del volumen por latido y del músculo.',
    measured: 'En la misma prueba se registra la FC. El estudio ISS VO2max también midió el gasto cardíaco por reinhalación con el PFS.',
  },
  {
    id: 'blood', name: 'Sangre y vasos', role: 'Transporta el oxígeno', color: '#7a5cc4',
    keys: ['aorta', 'vena_cava_superior', 'vena_cava_inferior', 'arteries_abdomen', 'arteries_pelvis', 'arteries_leg_l', 'arteries_leg_r', 'veins_leg_l', 'veins_leg_r'],
    effect: 'Sin gravedad, los fluidos suben a la cabeza y el cuerpo elimina entre el 10 y el 15 % del volumen de plasma.',
    evidence: 'Con menos volumen, el corazón se llena menos: es la causa principal de la caída en las primeras semanas.',
    measured: 'No hay medición rutinaria del volumen de plasma en vuelo; se infiere.',
  },
  {
    id: 'muscle', name: 'Músculos de las piernas', role: 'Extraen y usan el oxígeno', color: '#0f8a6f',
    keys: ['quadriceps_l', 'quadriceps_r', 'hamstrings_l', 'hamstrings_r', 'calf_l', 'calf_r'],
    effect: 'Pierden masa, mitocondrias y capilares: extraen menos oxígeno de la sangre que reciben.',
    evidence: 'En CFT70 la carga máxima cayó un 24 % sin contramedida y apenas un 1 % con ejercicio.',
    measured: 'Fuerza con dinamómetro (pestaña Fuerza) y tamaño con ecografía; la extracción no se mide de forma directa.',
  },
  {
    id: 'lungs', name: 'Pulmones', role: 'Intercambian los gases', color: '#4a90d9',
    keys: ['lung_l', 'lung_r', 'pulmonary_vessels'],
    effect: 'La función pulmonar se conserva en gran parte. No suele ser lo que limita la prueba.',
    evidence: 'Se muestran para completar el recorrido del oxígeno, no como un órgano afectado.',
    measured: 'Ventilación y gases respirados en la misma prueba (PFS).',
  },
];

export const fmtNum = (value, digits = 1) => value.toFixed(digits).replace('.', ',');
