// Illustrative decisions only; replace with the agreed scheduler response when available.
export function exampleRecommendations(crew, groups) {
  const calf = groups.find(group => group.key === 'calf');
  const point = calf?.points?.at(-1);
  return [
    {
      id: 'calf-retest', type: 'Follow-up', title: 'Repeat calf strength test', crew: crew.id,
      day: crew.today + 1, status: 'Scheduled', view: 'fuerza', muscle: 'calf_l',
      reason: Number.isFinite(point?.pct) ? `The latest calf measurement at ${point.label} is ${Math.abs(point.pct).toFixed(1)}% ${point.pct < 0 ? 'below' : 'above'} the pre-flight baseline. A repeat test could help verify the change.` : 'The related measurement is unavailable.',
    },
    { id: 'routine-strength', type: 'Routine', title: 'Muscle strength assessment', crew: crew.id,
      day: crew.today + 23, status: 'Scheduled', view: 'fuerza', reason: 'Routine assessment in the simulated mission schedule.' },
  ];
}

export function updateStatus(items, id, status) {
  if (!['Scheduled', 'Pending', 'Completed'].includes(status)) return items;
  return items.map(item => item.id === id ? { ...item, status } : item);
}

export function timelineItems(items, today) {
  return [...items, { id: '__today__', day: today, today: true }].sort((a, b) => {
    const aDay = Number.isFinite(a.day) ? a.day : Infinity;
    const bDay = Number.isFinite(b.day) ? b.day : Infinity;
    return aDay - bDay || Number(Boolean(b.today)) - Number(Boolean(a.today));
  });
}

export function dayDistance(day, today) {
  if (!Number.isFinite(day) || !Number.isFinite(today)) return 'Date unavailable';
  const difference = day - today;
  if (difference === 0) return 'Today';
  const days = Math.abs(difference);
  return difference > 0 ? `In ${days} ${days === 1 ? 'day' : 'days'}` : `${days} ${days === 1 ? 'day' : 'days'} ago`;
}
