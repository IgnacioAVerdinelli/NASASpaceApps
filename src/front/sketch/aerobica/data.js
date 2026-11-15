import reference from '../data/cft70-aerobic-reference.json' with { type: 'json' };

export { reference };

// The crew member's VO2peak tests, levels and alerts come from the HealthService (GET /api/v1/analyses, `aerobic`).
// This module holds what is not a measurement: the CFT70 reference and the explanation of each component.

// What makes a test maximal (the criteria NASA uses). They apply to the cycle test's own data (`test`), which
// the DataService does not record yet: until it does, the page says so instead of showing the checks.
export const maxCriteria = [
  { id: 'rer', label: 'RER ≥ 1.1', ok: test => test.rerPeak >= 1.1, value: test => test.rerPeak?.toFixed(2) },
  { id: 'rpe', label: 'Borg ≥ 17', ok: test => test.rpePeak >= 17, value: test => String(test.rpePeak) },
];

// What limits VO2peak, by the Fick equation: VO2 = heart rate × stroke volume × arteriovenous O2 difference.
// Identity colours (not status), checked with the dataviz skill.
export const components = [
  {
    id: 'heart', name: 'Heart', role: 'Pumps the blood (cardiac output)', color: '#c2417a',
    keys: ['heart', 'coronary_arteries'],
    effect: 'Less blood returns to the heart and it pumps less per beat. A mild atrophy of the left ventricle has been reported.',
    evidence: 'In CFT70 peak heart rate did not change (0 bpm in the no-countermeasure group): the loss comes from the volume per beat and the muscles, not the pulse.',
    measured: 'The same test records heart rate. The ISS VO2max study also measured cardiac output by rebreathing with the PFS.',
  },
  {
    id: 'blood', name: 'Blood and vessels', role: 'Carry the oxygen', color: '#7a5cc4',
    keys: ['aorta', 'vena_cava_superior', 'vena_cava_inferior', 'arteries_abdomen', 'arteries_pelvis', 'arteries_leg_l', 'arteries_leg_r', 'veins_leg_l', 'veins_leg_r'],
    effect: 'Without gravity, fluids shift towards the head and the body sheds 10 to 15% of its plasma volume.',
    evidence: 'With less volume the heart fills less: the main cause of the drop in the first weeks.',
    measured: 'Plasma volume is not routinely measured in flight; it is inferred.',
  },
  {
    id: 'muscle', name: 'Leg muscles', role: 'Extract and use the oxygen', color: '#0f8a6f',
    keys: ['quadriceps_l', 'quadriceps_r', 'hamstrings_l', 'hamstrings_r', 'calf_l', 'calf_r'],
    effect: 'They lose mass, mitochondria and capillaries: they extract less oxygen from the blood they get.',
    evidence: 'In CFT70 peak workload fell 24% without countermeasure and only 1% with exercise.',
    measured: 'Strength with the dynamometer (Strength tab) and size with ultrasound; extraction is not measured directly.',
  },
  {
    id: 'lungs', name: 'Lungs', role: 'Exchange the gases', color: '#4a90d9',
    keys: ['lung_l', 'lung_r', 'pulmonary_vessels'],
    effect: 'Lung function is largely preserved. It is not usually what limits the test.',
    evidence: 'Shown to complete the path of oxygen, not as an affected organ.',
    measured: 'Ventilation and breathed gases in the same test (PFS).',
  },
];
