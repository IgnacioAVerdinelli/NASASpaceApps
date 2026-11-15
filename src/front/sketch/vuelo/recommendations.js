// Illustrative decisions only; replace with the agreed scheduler response when available.
export function exampleRecommendations(crew, groups, upcoming = []) {
  const calf = groups.find(group => group.key === 'calves');
  const point = calf?.points?.findLast(point => Number.isFinite(point.pct) && point.label);
  const examples = [];
  if (point && Number.isFinite(crew.today) && crew.today < crew.landing - 1) {
    const change = `${Math.abs(point.pct).toFixed(1)}% ${point.pct < 0 ? 'below' : point.pct > 0 ? 'above' : 'at' } pre-flight`;
    examples.push({
      id: 'calf-retest', type: 'Follow-up', title: 'Repeat calf strength test', crew: crew.id,
      day: Math.floor(crew.today) + 1, dayLabel: `FD${Math.floor(crew.today) + 2}`,
      status: 'Scheduled', view: 'fuerza', muscle: 'calf_l',
      measurement: { title: 'Calf strength', detail: `Last measured ${point.label}` },
      finding: { title: change, detail: 'Change compared with the pre-flight baseline.' },
      action: { title: 'Repeat the test', detail: 'Illustrative follow-up to verify the change.' },
    });
  }
  const routine = upcoming.find(item => Number.isFinite(item.day) && item.day >= crew.today && item.label);
  if (routine) examples.push({
    id: 'routine-strength', type: 'Routine', title: 'Muscle strength assessment', crew: crew.id,
    day: routine.day, dayLabel: routine.label, status: 'Scheduled', view: 'fuerza',
    measurement: { title: 'Strength assessment', detail: 'Part of the measurement schedule.' },
    finding: { title: 'Routine schedule', detail: 'No individual finding is needed for this example.' },
    action: { title: 'Complete assessment', detail: `Next scheduled assessment: ${routine.label}.` },
  });
  return examples;
}

export function updateStatus(items, id, status) {
  if (!['Scheduled', 'Pending', 'Completed'].includes(status)) return items;
  return items.map(item => item.id === id ? { ...item, status } : item);
}

export function dayDistance(day, today) {
  if (!Number.isFinite(day) || !Number.isFinite(today)) return 'Date unavailable';
  const difference = Math.floor(day) - Math.floor(today);
  if (difference === 0) return 'Today';
  const days = Math.abs(difference);
  return difference > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
