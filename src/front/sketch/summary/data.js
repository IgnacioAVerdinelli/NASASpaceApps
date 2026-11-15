// Health summary: turns what the HealthService already decided (levels, alerts, changes) into the few things a
// crew member needs at a glance. Nothing clinical is computed here: the worst level, the alerts and the latest
// values come straight from GET /api/v1/analyses; the schedule comes from the Planner (data/plan.js).
import { shortDay, upcoming } from '../data/plan.js';

export const STATUS = {
  critical: { tone: 'critical', chip: 'crit', title: 'Action needed', detail: 'Tell the crew medical officer and the flight surgeon. The follow-up is in your mission plan.' },
  warning: { tone: 'warning', chip: 'warn', title: 'Check needed', detail: 'A loss is faster than expected. A retest or a review has been booked.' },
  watch: { tone: 'warning', chip: 'warn', title: 'Check needed', detail: 'Flight surgeon review booked. Rest if you can.' },
  ok: { tone: 'ok', chip: 'ok', title: 'No alerts', detail: 'Keep up your exercise and tests. Body map colours show change since before flight, not alarms.' },
};

// What each alert severity means, in a few words (titles of the alert boxes and of the indicator chips).
export const SEVERITY_TEXT = { critical: 'NASA standard crossed', warning: 'Faster loss than expected', watch: 'Lasting change' };

const latest = points => [...(points || [])].reverse().find(p => p.value != null && p.level != null) || null;

// Every alert on the page, most serious first, each pointing at the tab that explains it.
export function alertsOf(analyses) {
  const out = [];
  for (const g of analyses?.strength?.groups || []) {
    if (g.alert) out.push({ id: `strength:${g.key}`, system: `Muscle · ${g.name}`, severity: g.alert.severity, message: g.alert.message, tab: 'fuerza', focus: g.muscleKeys[0] });
  }
  const a = analyses?.aerobic;
  if (a?.alert) out.push({ id: 'aerobic', system: 'Aerobic capacity', severity: a.alert.severity, message: a.alert.message, tab: 'aerobica' });
  return out.sort((x, y) => (y.severity === 'critical') - (x.severity === 'critical'));
}

// alerts: from the periodic tests (layer 2); notices: from the watch (layer 1, data/vitals.js watchNotices).
export function overallStatus(alerts, notices = []) {
  if (alerts.some(a => a.severity === 'critical') || notices.some(n => n.severity === 'critical')) return STATUS.critical;
  if (alerts.length) return STATUS.warning;
  if (notices.length) return STATUS.watch;
  return STATUS.ok;
}

// Muscle groups with their latest test, largest loss first.
export function muscleRows(analyses) {
  return (analyses?.strength?.groups || []).map(g => ({ group: g, point: latest(g.points) }))
    .sort((a, b) => (a.point?.changePct ?? Infinity) - (b.point?.changePct ?? Infinity));
}

export function aerobicLatest(analyses) {
  const evals = analyses?.aerobic?.evaluations || [];
  return latest(evals);
}

// The chip tone of a test result: within the test's variation is "ok"; a loss is "loss"; a large loss or a value
// below the NASA minimum is "crit". The level itself is the HealthService's.
export function pointTone(point) {
  if (!point || point.level == null) return null;
  if (point.belowMinimum || point.level >= 4) return 'crit';
  if (point.withinNoise || point.level <= 1) return 'ok';
  return 'loss';
}

// Same grouping as plan.js `upcoming`: repeated items of one routine (or treatment) form one series.
const seriesKey = item => item.type === 'routine' || item.type === 'treatment' ? `${item.routine_id}:${item.eva ? 'eva' : 'series'}` : item.id;
// The Planner's calendar days run from x−0.5 to x+0.5 around mission day x (see shortDay), so a point in time
// belongs to the day it rounds to (x.5 opens the next day).
const dayOf = x => Math.floor(x + 0.5);

// Columns of the overview schedule: today and the next `count - 1` days, labelled as the crew reads them.
export function scheduleDays(today, landing, count = 7) {
  const first = dayOf(today);
  return Array.from({ length: count }, (_, k) => ({ day: first + k, label: shortDay({ window: { day: first + k } }, landing), today: k === 0 }));
}

// One row per task (a daily series is one row), with the columns its window covers: `start` is the first column
// (0 = today) and `span` how many columns it takes. A window longer than the timeline is clipped to it.
export function scheduleRows(items, today, count = 7, limit = 6) {
  const first = dayOf(today), last = first + count - 1;
  const ahead = last + 0.5 - today - 1e-6;   // items that open before the last column ends
  return upcoming(items, today, ahead).slice(0, limit).map(({ item, more }) => {
    const series = more ? items.filter(i => i.status === 'booked' && seriesKey(i) === seriesKey(item) && i.window.day_to >= today && i.window.day_from <= today + ahead) : [item];
    const from = Math.min(...series.map(i => i.window.day_from));
    const to = Math.max(...series.map(i => i.window.day_to));
    const start = Math.min(last, Math.max(first, dayOf(from)));
    const end = Math.max(start, Math.min(last, Math.ceil(to - 0.5)));   // a window ending on a day boundary stops the day before
    return { item, more, sessions: series.length, start: start - first, span: end - start + 1 };
  });
}
