// Keep each measurement separate: scores are not percentage changes or history.
export function intensityRows(items, scores) {
  const seen = new Set();
  return items.flatMap(item => item.muscleKeys.map(key => {
    const value = scores[key];
    if (seen.has(key) || value === null || value === undefined) return null;
    seen.add(key);
    const side = key.endsWith('_l') ? 'L' : key.endsWith('_r') ? 'R' : '';
    return { name: `${item.title}${side ? ` · ${side}` : ''}`, value };
  }).filter(Boolean));
}

export function changeRows(items) {
  return items.filter(item => item.changePercent !== null).map(item => ({ name: item.title, value: item.changePercent }));
}

export function timeRows(points) {
  return points.map(point => ({ ...point, time: Date.parse(point.at) })).sort((a, b) => a.time - b.time);
}
