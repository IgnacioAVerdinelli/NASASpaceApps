import reference from '../data/cft70-aerobic-reference.json' with { type: 'json' };

export { reference };

// Crew member SIMULADO (mismo CM-2 que fuerza). Prueba en cicloergómetro CEVIS con analizador de gases
// PFS, según OCHMO-STD-100.1A Table 8 [6028]: FD14, FD75, FD165 y R-14 en una misión de 180 days.
// La forma sigue lo publicado para la ISS (Moore y col. 2014): caída fuerte al inicio (~17 %) y
// recuperación parcial en vuelo gracias al ejercicio, sin volver al valor previo.
export const evaluations = [
  { id: 'pre', day: 0, label: 'Pre', vo2: 41.5, hrPeak: 182, rer: 1.18, watts: 250, rpe: 18, stop: 'Leg fatigue', method: 'measured' },
  { id: 'fd14', day: 14, label: 'FD 14', vo2: 36.3, hrPeak: 181, rer: 1.15, watts: 215, rpe: 19, stop: 'Leg fatigue', method: 'measured' },
  { id: 'fd75', day: 75, label: 'FD 75', vo2: 38.1, hrPeak: 183, rer: 1.16, watts: 225, rpe: 18, stop: 'General fatigue', method: 'measured' },
];
export const upcoming = [{ day: 165, label: 'FD 165' }, { day: 166, label: 'R−14' }];
export const baseline = evaluations[0].vo2;
export const NASA_FLOOR = reference.nasaFloor; // 32,9 ml/kg/min, NASA-STD-3001 Vol 1 [V1 4001]
export const pctOf = vo2 => (vo2 / baseline - 1) * 100;

// Criterios de prueba máxima (los mismos que usa NASA para validar la prueba).
export const maxCriteria = [
  { id: 'rer', label: 'RER ≥ 1.1', ok: e => e.rer >= 1.1, value: e => e.rer.toFixed(2) },
  { id: 'rpe', label: 'Borg ≥ 17', ok: e => e.rpe >= 17, value: e => String(e.rpe) },
];

// Qué limita el VO₂peak, según la ecuación de Fick: VO₂ = FC × volumen sistólico × diferencia arteriovenosa de O₂.
// Colores de identidad (no de estado), validados con la skill dataviz.
export const components = [
  {
    id: 'heart', name: 'Heart', role: 'Pumps blood (cardiac output)', color: '#c2417a',
    keys: ['heart', 'coronary_arteries'],
    effect: 'Less blood reaches the heart and it pumps less per beat. Mild left ventricular atrophy has been reported.',
    evidence: 'In CFT70 peak heart rate did not change in the control group; the loss was associated with stroke volume and muscle.',
    measured: 'Heart rate is recorded in the same test. The ISS VO2max study also measured cardiac output using PFS rebreathing.',
  },
  {
    id: 'blood', name: 'Blood and vessels', role: 'Transport oxygen', color: '#7a5cc4',
    keys: ['aorta', 'vena_cava_superior', 'vena_cava_inferior', 'arteries_abdomen', 'arteries_pelvis', 'arteries_leg_l', 'arteries_leg_r', 'veins_leg_l', 'veins_leg_r'],
    effect: 'In microgravity fluids shift toward the head and the body loses 10–15% of plasma volume.',
    evidence: 'Lower volume reduces heart filling and contributes to the early decline.',
    measured: 'Plasma volume is not routinely measured in flight; it is inferred.',
  },
  {
    id: 'muscle', name: 'Leg muscles', role: 'Extract and use oxygen', color: '#0f8a6f',
    keys: ['quadriceps_l', 'quadriceps_r', 'hamstrings_l', 'hamstrings_r', 'calf_l', 'calf_r'],
    effect: 'Loss of mass, mitochondria and capillaries reduces oxygen extraction.',
    evidence: 'In CFT70 peak workload fell 24% without countermeasures and 1% with exercise.',
    measured: 'Strength can be measured by dynamometer and size by ultrasound; extraction is not measured directly.',
  },
  {
    id: 'lungs', name: 'Lungs', role: 'Exchange gases', color: '#4a90d9',
    keys: ['lung_l', 'lung_r', 'pulmonary_vessels'],
    effect: 'Lung function is largely preserved and does not usually limit the test.',
    evidence: 'Shown to complete the oxygen pathway, not as an affected organ.',
    measured: 'Ventilation and respiratory gases are measured during the test (PFS).',
  },
];

export const fmtNum = (value, digits = 1) => value.toFixed(digits);
