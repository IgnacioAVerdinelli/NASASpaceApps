// The mission plan from the Planner (docs/planner.md): GET /api/v1/plan, GET /api/v1/routines/{id} and
// POST /api/v1/plan/{id}/status. Vite proxies /api/v1/plan and /api/v1/routines to the Planner (port 3001);
// VITE_PLANNER_URL points the page at another Planner.
const base = (import.meta.env?.VITE_PLANNER_URL || '/api/v1').replace(/\/$/, '');

export const TYPE_LABEL = { study: 'Study', routine: 'Routine', treatment: 'Treatment', retest: 'Retest', review: 'Review' };
export const STATUS_LABEL = { booked: 'Booked', open: 'Open now', done: 'Done', missed: 'Missed', cancelled: 'Cancelled' };

// Display names only. The Planner sends measure and instrument ids; until it sends names, these keep ids such as
// `vo2peak` out of the screen. Unknown ids fall back to the id with spaces.
export const MEASURE_LABEL = {
  vo2peak: 'aerobic capacity (VO2peak)', heart_rate: 'heart rate',
  hip_bmd: 'hip bone density', spine_bmd: 'spine bone density', heel_bmd: 'heel bone density',
  lean_legs: 'leg muscle mass', lean_arms: 'arm muscle mass', lean_trunk: 'trunk muscle mass',
  knee_extension_60: 'knee extension strength', knee_flexion_60: 'knee flexion strength',
  ankle_plantarflexion_30: 'ankle plantar flexion strength', ankle_dorsiflexion_30: 'ankle dorsiflexion strength',
  trunk_extension_60: 'trunk extension strength', trunk_flexion_60: 'trunk flexion strength',
};
export const INSTRUMENT_LABEL = { cycle: 'cycle ergometer', dxa: 'bone scan (DXA)', dynamometer: 'dynamometer', suit: 'spacesuit sensors' };

export function measureLabel(id) {
  return MEASURE_LABEL[id] || String(id || '').replace(/_/g, ' ');
}

// The title a person reads: "Review by the flight surgeon: vo2peak" names the measure in plain words.
export function plainTitle(item) {
  if (!item.measure) return item.title;
  return item.title.replace(item.measure, measureLabel(item.measure));
}

// The standard's own schedule label in words: "L+30" → "30 days after launch", "FD45" → "flight day 45",
// "L-180/30" → "between 180 and 30 days before launch". Unknown labels are returned as they are.
export function labelText(label) {
  const eva = { 'EVA before': 'before a spacewalk', EVA: 'on a spacewalk day', 'EVA after': 'after a spacewalk' }[label];
  if (eva) return eva;
  let m = /^FD(\d+)$/.exec(label);
  if (m) return `flight day ${m[1]}`;
  m = /^([LR])([+-])(\d+)(?:\/(\d+))?$/.exec(label || '');
  if (!m) return label;
  const [, ref, sign, a, b] = m;
  const event = ref === 'L' ? 'launch' : 'landing', side = sign === '-' ? 'before' : 'after';
  if (b !== undefined) return a === '0' ? `between ${event} and ${b} days ${side}` : `between ${a} and ${b} days ${side} ${event}`;
  if (a === '0') return `on ${event} day`;
  return `${days(Number(a))} ${side} ${event}`;
}

// A short day for chips, in the crew's own terms: "L−90" before launch, "FD31" in flight (FD1 is launch day, as in the
// mission clock's todayLabel), "R+3" after landing.
export function shortDay(item, landing = Infinity) {
  const d = Math.round(item.window.day ?? item.window.day_from);
  if (d < 0) return `L${num(d)}`;
  if (d >= landing) return `R+${d - landing}`;
  return `FD${d + 1}`;
}

export function planUrl(crew, root = base) {
  return `${root}/plan?crew=${encodeURIComponent(crew)}`;
}

export function validatePlan(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.items) || !data.mission || typeof data.mission.today !== 'number') {
    throw new Error('Invalid plan from the Planner');
  }
  return data;
}

export async function loadPlan({ url, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Plan request failed (${response.status})`);
  return validatePlan(await response.json());
}

export async function loadRoutine(id, { fetchImpl = fetch, root = base } = {}) {
  const response = await fetchImpl(`${root}/routines/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`Routine request failed (${response.status})`);
  return response.json();
}

export async function postStatus({ id, crew, status, by, note, fetchImpl = fetch, root = base }) {
  const response = await fetchImpl(`${root}/plan/${encodeURIComponent(id)}/status?crew=${encodeURIComponent(crew)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ status, by, note: note || null }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Status change failed (${response.status})`);
  return body;
}

// The status a person reads: a booked item whose window contains today is "open".
export function displayStatus(item, today) {
  if (item.status !== 'booked') return item.status;
  return item.window.day_from <= today && today <= item.window.day_to ? 'open' : 'booked';
}

function days(n) { return `${n} day${n === 1 ? '' : 's'}`; }

// "Open now · closes in 2 days", "Opens in 3 days", "Closed 4 days ago", for the list and the detail.
export function timing(item, today) {
  const { day_from: from, day_to: to } = item.window;
  if (item.status === 'done') return 'Completed';
  if (item.status === 'cancelled') return 'Cancelled';
  if (today < from) {
    const n = Math.ceil(from - today);
    return n <= 1 ? 'Opens within a day' : `Opens in ${days(n)}`;
  }
  if (today <= to) {
    const n = Math.floor(to - today);
    return n < 1 ? 'Open now · closes today' : `Open now · closes in ${days(n)}`;
  }
  return `Window closed ${days(Math.max(1, Math.floor(today - to)))} ago`;
}

const round = d => Math.round(d * 10) / 10;
const num = d => String(d).replace('-', '−');

// "Days 27–33" in mission days (0 = launch); "Days −180 to −30" before launch. The standard's own label stays next to it.
export function windowText(item) {
  const { day_from: from, day_to: to } = item.window;
  if (round(to - from) < 1.01) return `Day ${num(Math.round((from + to) / 2))}`;
  const a = Math.ceil(from), b = Math.floor(to);
  return a < 0 || b < 0 ? `Days ${num(a)} to ${num(b)}` : `Days ${a}–${b}`;
}

export function phaseOf(item, landing) {
  if (item.window.day_to <= 0) return 'Pre-flight';
  if (item.window.day_from >= landing) return 'Post-flight';
  return 'In flight';
}

// Items of the next `ahead` days: open now first, then by when they open. Repeated items of one routine (the daily
// sleep log, the last daily conferences) collapse into the first, with how many more follow.
export function upcoming(items, today, ahead = 7) {
  const due = items.filter(i => i.status === 'booked' && i.window.day_to >= today && i.window.day_from <= today + ahead);
  due.sort((a, b) => (displayStatus(b, today) === 'open') - (displayStatus(a, today) === 'open') || a.window.day_from - b.window.day_from || a.id.localeCompare(b.id));
  const out = [], seen = new Map();
  for (const item of due) {
    const key = item.type === 'routine' || item.type === 'treatment' ? `${item.routine_id}:${item.eva ? 'eva' : 'series'}` : item.id;
    if (seen.has(key)) { seen.get(key).more += 1; continue; }
    const row = { item, more: 0 };
    seen.set(key, row);
    out.push(row);
  }
  return out;
}

export function counts(items, today, ahead = 7) {
  const c = { open: 0, soon: 0, done: 0, missed: 0 };
  for (const i of items) {
    if (i.status === 'done') c.done += 1;
    else if (i.status === 'missed') c.missed += 1;
    else if (i.status === 'booked') {
      if (displayStatus(i, today) === 'open') c.open += 1;
      else if (i.window.day_from <= today + ahead && i.window.day_from > today) c.soon += 1;
    }
  }
  return c;
}

// The whole mission, one row per routine (and one for retests and reviews), in order of first occurrence.
export function byRoutine(items) {
  const groups = new Map();
  for (const item of items) {
    const key = item.reason === 'routine' ? item.routine_id : 'findings';
    if (!groups.has(key)) groups.set(key, { key, title: item.reason === 'routine' ? item.title : 'Retests and reviews', ref: item.reason === 'routine' ? item.ref : 'From HealthService findings', items: [] });
    groups.get(key).items.push(item);
  }
  return [...groups.values()].sort((a, b) => (a.key === 'findings') - (b.key === 'findings') || a.items[0].window.day_from - b.items[0].window.day_from);
}

// What to show first: the first item open now, else the next one to open, else the last item.
export function firstToDo(items, today) {
  const booked = items.filter(i => i.status === 'booked').sort((a, b) => a.window.day_from - b.window.day_from);
  return booked.find(i => displayStatus(i, today) === 'open') || booked.find(i => i.window.day_from > today) || items.at(-1) || null;
}
