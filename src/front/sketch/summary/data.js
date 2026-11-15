// Health summary: turns what the HealthService already decided (levels, alerts, changes) into the few things a
// crew member needs at a glance. Nothing clinical is computed here: the worst level, the alerts and the latest
// values come straight from GET /api/v1/analyses and /dashboard.

export const STATUS = {
  critical: { tone: 'critical', title: 'Action needed', detail: 'A NASA standard was crossed. Tell the crew medical officer and the flight surgeon.' },
  warning: { tone: 'warning', title: 'Check needed', detail: 'A loss is faster than expected. A retest or a review has been booked.' },
  ok: { tone: 'ok', title: 'All indicators as expected', detail: 'No alerts. Keep following the exercise and measurement routine.' },
};

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

export function overallStatus(alerts) {
  if (alerts.some(a => a.severity === 'critical')) return STATUS.critical;
  if (alerts.length) return STATUS.warning;
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

// Hip bone density from the dashboard chart (values are % of pre-flight, so the change is value - 100).
export function boneLatest(dashboard) {
  const chart = dashboard?.charts?.find(c => c.id === 'hip_bmd-trend');
  const points = (chart?.points || []).filter(p => p.value != null);
  if (points.length < 2) return { scanned: false, points };       // only the pre-flight reference: no scan since launch
  const last = points.at(-1);
  return { scanned: true, changePct: Math.round((last.value - (chart.reference ?? 100)) * 10) / 10, at: last.at, insight: chart.insight, points };
}

// Day N of the flight and how far along it is (0..1); after landing, days since landing.
export function missionProgress(mission) {
  const { today, landing } = mission;
  if (today < 0) return { phase: 'Pre-flight', text: `${Math.ceil(-today)} days to launch`, ratio: 0 };
  if (today < landing) return { phase: 'In flight', text: `Day ${Math.floor(today) + 1} of ${landing}`, ratio: today / landing };
  return { phase: 'Back on Earth', text: `${Math.floor(today - landing)} days since landing`, ratio: 1 };
}
