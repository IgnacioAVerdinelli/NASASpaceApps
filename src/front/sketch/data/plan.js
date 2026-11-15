// The mission plan from the Planner (docs/planner.md): GET /api/v1/plan, GET /api/v1/routines/{id} and
// POST /api/v1/plan/{id}/status. Vite proxies /api/v1/plan and /api/v1/routines to the Planner (port 3001);
// VITE_PLANNER_URL points the page at another Planner.
const base = (import.meta.env?.VITE_PLANNER_URL || '/api/v1').replace(/\/$/, '');

export const TYPE_LABEL = { study: 'Study', routine: 'Routine', treatment: 'Treatment', retest: 'Retest', review: 'Review' };
export const STATUS_LABEL = { booked: 'Booked', open: 'Open now', done: 'Done', missed: 'Missed', cancelled: 'Cancelled' };

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

const days = n => `${n} day${n === 1 ? '' : 's'}`;

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
