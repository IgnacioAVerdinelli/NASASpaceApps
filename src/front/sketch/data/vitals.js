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

// The screens of the watch mock-up, one per tile, the ones that need action first. Every word and status comes
// from GET /api/v1/vitals; this only picks the short label, the face colour and the reading time (UTC).
const WATCH_LABEL = { hr: 'Resting HR', bp: 'Blood pressure', spo2: 'Blood oxygen', hrv: 'HRV', sleep: 'Sleep' };
const WATCH_STATUS = { low_now: 'Act now', deviation: 'Lasting change', out: 'Outside usual', in_range: 'Usual', no_band: 'Learning', no_data: 'No data' };
const WATCH_TONE = { low_now: 'high', deviation: 'medium', out: 'info', in_range: 'low' };
const utcClock = at => {
  const date = at ? new Date(at) : null;
  return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(11, 16) : null;
};

export function watchScreens(data) {
  return tiles(data).map((t, order) => {
    const status = t.status.status;
    const value = t.id === 'bp' ? `${fmtValue(t.main.latest?.value)}/${fmtValue(t.second?.latest?.value)}` : fmtValue(t.main.latest?.value, t.main.decimals);
    const usual = t.main.band ? `${fmtValue(t.main.band.low, t.main.decimals)}–${fmtValue(t.main.band.high, t.main.decimals)}` : null;
    return {
      id: t.id, label: WATCH_LABEL[t.id] ?? t.title, title: t.title, value, unit: t.id === 'bp' ? 'mmHg' : t.main.unit,
      status, statusLabel: WATCH_STATUS[status] ?? status, tone: WATCH_TONE[status] ?? 'idle',
      message: t.status.text, time: utcClock(t.main.latest?.at), arrow: side(t.status), order,
      // Last two weeks for the mini chart, with the usual band; blood pressure also draws the diastolic line.
      series: (t.main.series || []).slice(-14), band: t.main.band ?? null, direction: t.main.direction,
      second: t.id === 'bp' && t.second ? { series: (t.second.series || []).slice(-14), band: t.second.band ?? null } : null,
      usual: t.id === 'bp' && usual && t.second?.band ? `${usual} / ${fmtValue(t.second.band.low)}–${fmtValue(t.second.band.high)}` : usual,
      extra: t.id === 'sleep' && t.second?.latest ? `Quality ${fmtValue(t.second.latest.value)}/7` : null,
    };
  }).sort((a, b) => rank(b.status) - rank(a.status) || a.order - b.order);
}

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
