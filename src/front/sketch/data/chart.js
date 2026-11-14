// Convert measurements into chart coordinates, preserving missing values as breaks.
export function chartGeometry(points, reference) {
  const valid = points.filter(point => point.value !== null).slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (!valid.length) return { segments: [], referenceY: null, min: null, max: null, first: null, last: null };
  const times = valid.map(point => Date.parse(point.at));
  const numbers = valid.map(point => point.value);
  if (reference !== null) numbers.push(reference);
  let min = Math.min(...numbers), max = Math.max(...numbers);
  const pad = (max - min || Math.max(Math.abs(max) * .1, 1)) * .1;
  min -= pad; max += pad;
  const first = Math.min(...times), last = Math.max(...times);
  const x = at => first === last ? 275 : (Date.parse(at) - first) / (last - first) * 550;
  const y = value => 145 - (value - min) / (max - min) * 145;
  const segments = [];
  let segment = [];
  for (const point of points.slice().sort((a, b) => Date.parse(a.at) - Date.parse(b.at))) {
    if (point.value === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push({ x: x(point.at), y: y(point.value) });
  }
  if (segment.length) segments.push(segment);
  return { segments, referenceY: reference === null ? null : y(reference), min, max, first, last };
}
