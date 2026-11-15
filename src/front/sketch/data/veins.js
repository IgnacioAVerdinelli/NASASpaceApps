// The jugular vein ultrasound (OCHMO-STD-100.1A [6041], docs/investigacion-yugular.md): GET /api/v1/veins from the
// HealthService. Levels, signs and texts come from there; this module only finds them and shapes them for the page.
// Nothing clinical is computed here: the drawing only turns each scan's values into shapes and motion.

export function veinsUrl(dashboardUrl, crew) {
  const parsed = new URL(dashboardUrl, 'http://localhost');
  parsed.pathname = parsed.pathname.replace(/\/dashboard\/?$/, '/veins');
  parsed.hash = '';
  parsed.search = '';
  if (crew) parsed.searchParams.set('crew', crew);
  return /^[a-z][a-z\d+.-]*:/i.test(dashboardUrl) ? parsed.href : `${parsed.pathname}${parsed.search}`;
}

export function validateVeins(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.scans) || !Array.isArray(data.measures) || !data.status) {
    throw new Error('Invalid jugular scan data from the HealthService');
  }
  return data;
}

export async function loadVeins({ url, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Jugular scan request failed (${response.status})`);
  return validateVeins(await response.json());
}

// Each vein is judged on its own; the left one is where stagnant flow and clots have been seen in flight.
export const SIDES = ['right', 'left'];
export const SIDE_LABEL = { right: 'Right vein', left: 'Left vein' };
const RANK = { normal: 0, check: 1, alarm: 2 };
export const LEVELS = {
  normal: { label: 'Normal flow', short: 'Normal' },
  check: { label: 'Check needed · slow or reversed blood', short: 'Check needed' },
  alarm: { label: 'Alarm · possible clot', short: 'Alarm' },
};
export const LEVEL_COLORS = { normal: '#9fc9ae', check: '#ef9959', alarm: '#d94d4b' };   // the body viewer's palette
export const GRADE_TEXT = { 1: 'Continuous', 2: 'Pulsatile', 3: 'Standing still', 4: 'Backward' };
export const ECHO_TEXT = { 0: 'None', 1: 'Mild', 2: 'Moderate' };

// The vein to show first: the worse one at the latest scan (the left one on a tie, where trouble shows in flight).
export const worseSide = data => ['left', 'right'].reduce((best, side) => (RANK[data?.status?.sides?.[side]] ?? 0) > (RANK[data?.status?.sides?.[best]] ?? 0) ? side : best, 'left');

export function fmt(value, decimals = 0, signed = false) {
  if (value == null) return '—';
  const s = Number(value).toFixed(decimals);
  return signed && Number(value) > 0 ? `+${s}` : s;
}

// What a value reads like.
export function shown(measure, value) {
  if (value == null) return '—';
  if (measure.measure === 'ijv_flow_grade') return `${fmt(value)} · ${GRADE_TEXT[Math.round(value)] ?? ''}`;
  if (measure.measure === 'ijv_echogenicity') return ECHO_TEXT[Math.round(value)] ?? fmt(value);
  if (measure.measure === 'ijv_compressible') return value >= 1 ? 'Yes' : 'No';
  return `${fmt(value, measure.decimals)} ${measure.unit}`;
}

// The drawing of one vein at one scan: the values read as shapes and motion (no thresholds here). Missing values
// draw a normal vein.
export function veinShape(scan, side = 'left') {
  const v = scan?.values?.[side] || {};
  return {
    area: Math.max(1, v.ijv_csa ?? 80),             // mm²
    grade: Math.min(4, Math.max(1, Math.round(v.ijv_flow_grade ?? 2))),
    echo: Math.min(2, Math.max(0, Math.round(v.ijv_echogenicity ?? 0))),
    clot: (v.ijv_compressible ?? 1) < 1,
    speed: v.ijv_peak_velocity ?? 25,                // cm/s, toward the heart; negative toward the head
  };
}

// Radius of a circle with this area, in mm.
export const radiusOf = area => Math.sqrt(Math.max(0, area) / Math.PI);

// Area and grade by scan, for the charts: both veins.
export function areaRows(data) {
  return (data?.scans || []).map(s => ({
    day: s.day, label: s.label, level: s.level,
    right: s.values?.right?.ijv_csa ?? null, left: s.values?.left?.ijv_csa ?? null,
    gradeRight: s.values?.right?.ijv_flow_grade ?? null, gradeLeft: s.values?.left?.ijv_flow_grade ?? null,
  }));
}

// An illustrative Doppler trace for a flow grade: velocity over two seconds, toward the heart positive (the
// convention of the page, not of every ultrasound machine). It is drawn from the grade, not recorded.
export function dopplerTrace(grade, speed = 25, points = 160, seconds = 2) {
  const out = [], beat = 1.0;                                    // one heartbeat per second
  const s = Math.max(4, Math.abs(speed));
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1) * seconds, phase = (t % beat) / beat;
    const wave = Math.sin(2 * Math.PI * phase) + 0.45 * Math.sin(4 * Math.PI * phase + 0.6);
    let v;
    if (grade === 1) v = s * (0.85 + 0.12 * wave);
    else if (grade === 2) v = s * (0.45 + 0.5 * wave);
    else if (grade === 3) v = s * 0.18 * wave;
    else v = -s * (0.6 + 0.35 * wave);
    out.push({ t: Math.round(t * 1000) / 1000, v: Math.round(v * 10) / 10 });
  }
  return out;
}
