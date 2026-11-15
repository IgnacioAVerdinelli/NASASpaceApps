// The analyses contract groups retests by analysis and does not identify the specific measure.
export function recommendations(data) {
  const { strength, aerobic, crew, mission } = data;
  const items = [];
  for (const group of strength.groups) {
    if (group.alert) items.push({
      id: `alert:strength:${group.key}`, type: 'Alert', title: `${group.name} · ${group.alert.severity} alert`,
      crew: crew.id, dayLabel: mission.todayLabel, severity: group.alert.severity,
      view: 'fuerza', muscle: group.muscleKeys[0],
      measurement: { title: group.name, detail: group.test },
      finding: { title: group.alert.severity === 'critical' ? 'Critical alert' : 'Warning', detail: group.alert.message },
      action: { title: 'Review measurement', detail: 'Open the analysis for details.' },
    });
  }
  if (aerobic.alert) items.push({
    id: 'alert:aerobic', type: 'Alert', title: `${aerobic.name} · ${aerobic.alert.severity} alert`,
    crew: crew.id, dayLabel: mission.todayLabel, severity: aerobic.alert.severity, view: 'aerobica',
    measurement: { title: aerobic.name, detail: aerobic.test },
    finding: { title: aerobic.alert.severity === 'critical' ? 'Critical alert' : 'Warning', detail: aerobic.alert.message },
    action: { title: 'Review measurement', detail: 'Open the analysis for details.' },
  });
  for (const [view, analysis, name] of [['fuerza', strength, 'Muscle strength'], ['aerobica', aerobic, 'Aerobic capacity']]) {
    for (const study of analysis.upcoming) {
      const retest = study.reason === 'retest';
      items.push({
        id: `study:${view}:${study.day}:${study.reason}`, type: retest ? 'Retest' : 'Routine',
        title: `${name} ${retest ? 'retest' : 'assessment'}`, crew: crew.id,
        day: study.day, dayLabel: study.label, status: 'Scheduled', view,
        measurement: { title: name, detail: 'Scheduled analysis' },
        finding: { title: retest ? 'Follow-up requested' : 'Routine schedule', detail: retest ? 'The scheduler requested a retest after a finding.' : 'This assessment is part of the routine schedule.' },
        action: { title: retest ? 'Repeat assessment' : 'Complete assessment', detail: `Scheduled for ${study.label}.` },
      });
    }
  }
  return items.sort((a, b) => (a.type === 'Alert' ? 0 : 1) - (b.type === 'Alert' ? 0 : 1)
    || (a.severity === 'critical' ? 0 : 1) - (b.severity === 'critical' ? 0 : 1)
    || (a.day ?? Infinity) - (b.day ?? Infinity));
}

export function updateStatus(items, id, status) {
  if (!['Scheduled', 'Pending', 'Completed'].includes(status)) return items;
  return items.map(item => item.id === id && item.type !== 'Alert' ? { ...item, status } : item);
}

export function dayDistance(day, today) {
  if (!Number.isFinite(day) || !Number.isFinite(today)) return 'Date unavailable';
  const difference = Math.floor(day) - Math.floor(today);
  if (difference === 0) return 'Today';
  const days = Math.abs(difference);
  return difference > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
