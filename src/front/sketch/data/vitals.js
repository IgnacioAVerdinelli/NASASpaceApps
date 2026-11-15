// The watch, layer 1 (docs/wearable.md): GET /api/v1/vitals from the HealthService. Status, band and text come from
// there; this module only finds them and shapes them for the page. Nothing clinical is computed here.

export function vitalsUrl(dashboardUrl, crew) {
  const parsed = new URL(dashboardUrl, 'http://localhost');
  parsed.pathname = parsed.pathname.replace(/\/dashboard\/?$/, '/vitals');
  parsed.hash = '';
  parsed.search = '';
  if (crew) parsed.searchParams.set('crew', crew);
  return /^[a-z][a-z\d+.-]*:/i.test(dashboardUrl) ? parsed.href : `${parsed.pathname}${parsed.search}`;
}

export function validateVitals(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.vitals) || !data.day || !data.day.curves) {
    throw new Error('Invalid vitals from the HealthService');
  }
  return data;
}

export async function loadVitals({ url, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Vitals request failed (${response.status})`);
  return validateVitals(await response.json());
}

export const NOTICE_STATUSES = ['deviation', 'low_now'];
export const byMeasure = data => Object.fromEntries((data?.vitals || []).map(v => [v.measure, v]));

// The watch's notices for the status band: a lasting change, or SpO2 low now.
export function watchNotices(data) {
  return (data?.vitals || []).filter(v => NOTICE_STATUSES.includes(v.status)).map(v => ({
    id: `watch:${v.measure}`, system: `Watch · ${v.name}`, severity: v.status === 'low_now' ? 'critical' : 'watch',
    message: v.text, tab: 'vitales',
  }));
}

export const fmtValue = (value, decimals = 0) => value == null ? '—' : Number(value).toFixed(decimals);

// The tiles of "Now · watch": blood pressure is one tile (systolic / diastolic), sleep shows hours and the score.
export function tiles(data) {
  const v = byMeasure(data);
  const worst = (...xs) => xs.filter(Boolean).sort((a, b) => rank(b.status) - rank(a.status))[0];
  const out = [];
  if (v.resting_hr) out.push({ id: 'hr', title: 'Resting heart rate', main: v.resting_hr, status: v.resting_hr });
  if (v.resting_sbp) out.push({ id: 'bp', title: 'Blood pressure', main: v.resting_sbp, second: v.resting_dbp, status: worst(v.resting_sbp, v.resting_dbp) });
  if (v.spo2) out.push({ id: 'spo2', title: 'Blood oxygen', main: v.spo2, status: v.spo2 });
  if (v.hrv_rmssd) out.push({ id: 'hrv', title: 'Heart-rate variability', main: v.hrv_rmssd, status: v.hrv_rmssd });
  if (v.sleep_hours) out.push({ id: 'sleep', title: 'Sleep last night', main: v.sleep_hours, second: v.sleep_quality, status: worst(v.sleep_hours, v.sleep_quality) });
  return out;
}

const RANK = { low_now: 5, deviation: 4, out: 3, in_range: 2, no_band: 1, no_data: 0 };
const rank = status => RANK[status] ?? 0;

// Which way the latest value sits, for the arrow in a tile: 'up', 'down' or null (in the band, or no band).
export function side(v) {
  if (!v?.band || !v.latest) return null;
  if (v.latest.value > v.band.high) return 'up';
  if (v.latest.value < v.band.low) return 'down';
  return null;
}

// Day of heart rate: today against one comparison curve, merged by minute for a single chart.
export const COMPARISONS = [
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'week_ago', label: 'A week ago' },
  { id: 'preflight', label: 'Before flight' },
];

export function dayRows(curves, compare) {
  const rows = new Map();
  for (const p of curves.today || []) rows.set(p.minute, { minute: p.minute, today: p.value });
  for (const p of curves[compare] || []) rows.set(p.minute, { ...(rows.get(p.minute) || { minute: p.minute }), other: p.value });
  return [...rows.values()].sort((a, b) => a.minute - b.minute);
}

export const clock = minute => `${String(Math.floor(minute / 60) % 24).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
export const ACTIVITY = { sleep: 'Sleep', exercise: 'Exercise', eva: 'Spacewalk' };
