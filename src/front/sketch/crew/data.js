// Crew select: one short summary per crew member, built from the same sources and helpers as the Health summary
// (summary/data.js), so a status here always matches the status on that crew member's overview. Nothing clinical
// is computed here.
import { analysesUrl, loadAnalyses } from '../data/analyses.js';
import { loadVitals, side, tiles, vitalsUrl, watchNotices } from '../data/vitals.js';
import { loadPlan, planUrl, plainTitle, timing, upcoming } from '../data/plan.js';
import { aerobicLatest, alertsOf, muscleRows, overallStatus, SEVERITY_TEXT } from '../summary/data.js';

const fmt = (value, digits = 1) => value == null ? '—' : Number(value).toFixed(digits).replace('-', '−');
const pct = value => value == null ? '—' : `${value > 0 ? '+' : ''}${fmt(value)}%`;

// The watch's vitals for the selected card, altered ones first. Tone follows the overview tiles: SpO2 low now is
// critical, a lasting change needs a check, a single day outside the usual range is informational.
const VITAL_LABEL = { hr: 'Resting HR', bp: 'Blood pressure', spo2: 'SpO₂', hrv: 'HRV', sleep: 'Sleep' };
const VITAL_TONE = { low_now: 'crit', deviation: 'warn', out: 'info' };
const VITAL_RANK = { low_now: 3, deviation: 2, out: 1 };
function vitalsList(vitals) {
  if (!vitals) return [];
  return tiles(vitals).filter(t => t.main?.latest).map((t, i) => {
    const v = t.main, d = v.decimals ?? 0;
    const value = t.id === 'bp' && t.second?.latest ? `${fmt(v.latest.value, 0)}/${fmt(t.second.latest.value, 0)}` : fmt(v.latest.value, d);
    const st = t.status?.status;
    return { id: t.id, label: VITAL_LABEL[t.id] || v.name, value, unit: v.unit, tone: VITAL_TONE[st] || null,
      text: t.status?.text || '', dir: side(t.status), order: i, rank: VITAL_RANK[st] || 0 };
  }).sort((a, b) => b.rank - a.rank || a.order - b.order);
}

// A crew member's summary from their analyses, watch and plan. Any of the three may be missing (null).
export function crewSummary(id, { analyses = null, vitals = null, plan = null } = {}) {
  const alerts = alertsOf(analyses);
  const notices = watchNotices(vitals);
  const status = analyses || vitals ? overallStatus(alerts, notices) : null;
  const first = [...alerts, ...notices].sort((a, b) => (b.severity === 'critical') - (a.severity === 'critical'))[0] || null;
  const vo2 = aerobicLatest(analyses);
  const worst = muscleRows(analyses)[0] || null;
  const rhr = (vitals?.vitals || []).find(v => v.measure === 'resting_hr') || null;
  const today = plan?.mission?.today ?? analyses?.mission?.today ?? null;
  const next = plan && today != null ? upcoming(plan.items, today, 30)[0]?.item || null : null;
  return {
    id,
    body: analyses?.crew?.body || null,
    hasData: Boolean(analyses || vitals),
    status,
    alert: first && { title: `${first.system} · ${SEVERITY_TEXT[first.severity] || 'Check needed'}`, message: first.message },
    vo2: vo2 && { value: fmt(vo2.value), change: `${pct(vo2.changePct)} vs pre-flight · ${vo2.label}` },
    strength: worst?.point && { value: pct(worst.point.changePct), group: worst.group.name, label: worst.point.label || '' },
    vitals: vitalsList(vitals),
    rhr: rhr?.latest && { value: fmt(rhr.latest.value, 0), status: rhr.status },
    next: next && { title: plainTitle(next), when: timing(next, today) },
    mission: analyses?.mission || null,
  };
}

async function optional(load, args) {
  try { return await load(args); } catch (error) { if (args.signal?.aborted) throw error; return null; }
}

// Loader for useDashboard: the "url" is the dashboard URL plus the crew list, so a new crew list restarts polling.
export function summariesKey(apiUrl, crew) {
  return `${apiUrl}#crew=${crew.join(',')}`;
}

export async function loadSummaries({ url, signal, fetchImpl = fetch }) {
  const [apiUrl, list = ''] = url.split('#crew=');
  const crew = list.split(',').filter(Boolean);
  const rows = await Promise.all(crew.map(async id => {
    const [analyses, vitals, plan] = await Promise.all([
      optional(loadAnalyses, { url: analysesUrl(apiUrl, id), signal, fetchImpl }),
      optional(loadVitals, { url: vitalsUrl(apiUrl, id), signal, fetchImpl }),
      optional(loadPlan, { url: planUrl(id), signal, fetchImpl }),
    ]);
    return crewSummary(id, { analyses, vitals, plan });
  }));
  if (crew.length && rows.every(r => !r.hasData)) throw new Error('No crew data from the HealthService');
  return rows;
}

// How each crew member looks in 3D. Illustrations, not likenesses: picked by position in the crew list so the same
// person keeps the same look across reloads.
const LOOKS = [
  { skin: '#E3B48E', hair: '#2E221B', style: 'bun', height: 0.97, girth: 0.98 },
  { skin: '#8A5A3C', hair: '#16110F', style: 'short', height: 1.02, girth: 1.03 },
  { skin: '#C78F66', hair: '#2A2420', style: 'crop', height: 1.0, girth: 1.0 },
  { skin: '#F0C9A6', hair: '#A97D46', style: 'short', height: 1.04, girth: 1.05 },
  { skin: '#5E3B27', hair: '#0E0B0A', style: 'tied', height: 0.95, girth: 0.97 },
  { skin: '#D9A77F', hair: '#4A3426', style: 'buzz', height: 0.99, girth: 1.01 },
];

// Looks for the example roster (data/roster.js): close to each person's portrait, still illustrations.
const LOOK_BY_ID = {
  'CM-1': { skin: '#E6BC98', hair: '#3A2A20', style: 'buzz', height: 1.0, girth: 1.03, tape: 'DUBROV' },
  'CM-2': { skin: '#EEC6A6', hair: '#9C7648', style: 'bun', height: 0.96, girth: 0.97, tape: 'KIKINA' },
  'CM-3': { skin: '#B07A55', hair: '#1A1412', style: 'short', height: 1.0, girth: 1.0, tape: 'MENON' },
  'CM-4': { skin: '#6B4430', hair: '#120D0B', style: 'tied', height: 0.98, girth: 0.97, tape: 'WATKINS' },
  'CM-5': { skin: '#E8BC98', hair: '#5A4030', style: 'short', height: 1.04, girth: 1.04, tape: 'DELANEY' },
  'CM-6': { skin: '#EDC2A0', hair: '#4A3426', style: 'crop', height: 1.03, girth: 1.02, tape: 'KUTRYK' },
  'CM-7': { skin: '#E4B896', hair: '#2E221B', style: 'buzz', height: 1.01, girth: 1.03, tape: 'TETERYATNIKOV' },
};

export function lookFor(index, body, id) {
  const look = LOOK_BY_ID[id] || LOOKS[index % LOOKS.length];
  // Keep hair styles that read well on each base body.
  const style = body === 'female' ? (['bun', 'tied'].includes(look.style) ? look.style : index % 2 ? 'tied' : 'bun')
    : (['bun', 'tied'].includes(look.style) ? 'short' : look.style);
  return { ...look, style, body: body || (index % 2 ? 'male' : 'female') };
}
