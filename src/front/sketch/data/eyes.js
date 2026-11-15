// The eye exam (SANS, docs/investigacion-ojos.md): GET /api/v1/eyes from the HealthService. Classes, signs and texts
// come from there; this module only finds them and shapes them for the page. Nothing clinical is computed here:
// the drawing only turns each exam's changes into shapes.

export function eyesUrl(dashboardUrl, crew) {
  const parsed = new URL(dashboardUrl, 'http://localhost');
  parsed.pathname = parsed.pathname.replace(/\/dashboard\/?$/, '/eyes');
  parsed.hash = '';
  parsed.search = '';
  if (crew) parsed.searchParams.set('crew', crew);
  return /^[a-z][a-z\d+.-]*:/i.test(dashboardUrl) ? parsed.href : `${parsed.pathname}${parsed.search}`;
}

export function validateEyes(data) {
  if (!data || data.version !== 2 || !Array.isArray(data.exams) || !Array.isArray(data.measures) || !data.status) {
    throw new Error('Invalid eye exam data from the HealthService');
  }
  return data;
}

export async function loadEyes({ url, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Eye exam request failed (${response.status})`);
  return validateEyes(await response.json());
}

// Each eye is compared with its own pre-flight exam (SANS can show in one eye only).
export const EYES = ['right', 'left'];
export const EYE_LABEL = { right: 'Right eye', left: 'Left eye' };
const RANK = { none: 0, A: 1, B: 2 };

// The eye to show first: the worse one at the latest exam (the right one on a tie).
export const worseEye = data => EYES.reduce((best, eye) => (RANK[data?.status?.eyes?.[eye]] ?? 0) > (RANK[data?.status?.eyes?.[best]] ?? 0) ? eye : best, 'right');

export const CLASSES = {
  none: { label: 'No sign of SANS', short: 'No sign' },
  A: { label: 'Class A · earliest sign', short: 'Class A' },
  B: { label: 'Class B · clinically concerning', short: 'Class B' },
};

// The cards: one per test of the exam, in the order the crew does them.
export const GROUPS = [
  { id: 'oct', title: 'OCT scan', device: 'Heidelberg Spectralis OCT', about: 'Cross-sections of the retina and the optic nerve head, to a few micrometres. The first test to show SANS.' },
  { id: 'fundus', title: 'Fundus imaging', device: 'OCT infrared and MultiColor images', about: 'A picture of the back of the eye: swelling a doctor can see, and folds.' },
  { id: 'vision', title: 'Vision', device: 'Near chart, Amsler grid and questionnaire', about: 'What the crew member notices: a shift to the plus side makes reading up close harder.' },
  { id: 'ultrasound', title: 'Ultrasound', device: 'GE Vivid (Vivid q, then Vivid iq from 2025)', about: 'The optic nerve sheath and the shape of the eyeball, guided from the ground.' },
  { id: 'pressure', title: 'Eye pressure', device: 'Tonometer (ESA crew in the 2018 NASA protocol)', about: 'Context only: the pressure in the eye does not show the pressure inside the head.' },
];

export const byMeasure = data => Object.fromEntries((data?.measures || []).map(m => [m.measure, m]));

export function fmt(value, decimals = 0, signed = false) {
  if (value == null) return '—';
  const s = Number(value).toFixed(decimals);
  return signed && Number(value) > 0 ? `+${s}` : s;
}

// What a flag or grade reads like.
export function shown(measure, value) {
  if (value == null) return '—';
  if (measure.measure === 'frisen_grade') return `Grade ${fmt(value)}`;
  if (measure.unit === 'flag') return value >= 1 ? 'Seen' : 'Not seen';
  return `${fmt(value, measure.decimals)} ${measure.unit}`;
}

// The drawing of one exam: its changes from pre-flight, read as shapes (no thresholds here). Missing values are 0.
export function eyeShape(exam, eye = 'right') {
  const c = exam?.changes?.[eye] || {}, v = exam?.values?.[eye] || {};
  return {
    disc: Math.max(0, c.oct_trt ?? 0),            // µm of swelling at the disc
    choroid: Math.max(0, c.oct_choroid ?? 0),     // µm of thicker choroid
    sheath: Math.max(0, c.onsd ?? 0),             // mm wider sheath
    flatten: v.globe_flattening >= 1 ? 1 : 0,
    folds: v.choroidal_folds >= 1 ? 1 : 0,
  };
}

// OCT changes by exam, for the chart: the shown eye's three layers and the other eye's retina, to compare.
export function octRows(data, eye = 'right') {
  const other = eye === 'right' ? 'left' : 'right';
  return (data?.exams || []).map(e => ({
    day: e.day, label: e.label, cls: e.eyes?.[eye]?.class ?? 'none',
    trt: e.changes?.[eye]?.oct_trt ?? null, mrw: e.changes?.[eye]?.oct_mrw ?? null, choroid: e.changes?.[eye]?.oct_choroid ?? null,
    otherTrt: e.changes?.[other]?.oct_trt ?? null,
  }));
}
