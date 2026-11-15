import test from 'node:test';
import assert from 'node:assert/strict';
import example from '../src/front/sketch/data/analyses.example.json' with { type: 'json' };
import { validateAnalyses } from '../src/front/sketch/data/contract.js';
import { analysesUrl, loadAnalyses } from '../src/front/sketch/data/analyses.js';
import { colorScale, dayAxis, dayLabel, levelColor, levelText, referenceFor, xOf } from '../src/front/sketch/fuerza/data.js';

const copy = () => structuredClone(example);

test('the analyses example meets the contract and invalid data is rejected', () => {
  assert.equal(validateAnalyses(copy()).version, 1);
  for (const mutate of [
    d => { d.strength.groups[0].points[1].level = 5; },
    d => { d.strength.groups[0].points.pop(); },
    d => { d.strength.groups[0].points[1].evaluation = 'other'; },
    d => { d.strength.groups[0].muscleKeys = ['unknown']; },
    d => { d.strength.groups.push(d.strength.groups[0]); },
    d => { d.aerobic.evaluations[1].changePct = '12'; },
    d => { d.aerobic.alert = { severity: 'urgent', rule: 'x', message: 'y' }; },
    d => { d.strength.upcoming = [{ day: 200, label: 'R+20', reason: 'whenever' }]; },
    d => { d.levels.pop(); },
    d => { d.crew.body = 'robot'; },
    d => { d.updatedAt = 'yesterday'; },
  ]) { const data = copy(); mutate(data); assert.throws(() => validateAnalyses(data), /Invalid analyses/); }
  const missing = copy();
  Object.assign(missing.strength.groups[0].points[1], { value: null, changePct: null, level: null, withinNoise: null, belowMinimum: null, quality: 'out_of_range' });
  assert.equal(validateAnalyses(missing), missing);
});

test('analyses client follows the dashboard URL and never substitutes the example on errors', async () => {
  assert.equal(analysesUrl('/api/v1/dashboard', 'CM 2'), '/api/v1/analyses?crew=CM+2');
  assert.equal(analysesUrl('/api/v1/dashboard?day=95', 'CM-1'), '/api/v1/analyses?day=95&crew=CM-1');
  assert.equal(analysesUrl('https://example.com/api/v1/dashboard?crew=old', 'CM-2'), 'https://example.com/api/v1/analyses?crew=CM-2');
  assert.equal((await loadAnalyses()).simulated, true);
  let requested;
  const result = await loadAnalyses({ url: '/api/v1/analyses?crew=CM-1', fetchImpl: async (url, options) => { requested = [url, options]; return { ok: true, json: async () => copy() }; } });
  assert.equal(result.crew.id, 'CM-1');
  assert.equal(requested[1].cache, 'no-store');
  await assert.rejects(() => loadAnalyses({ url: '/api', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
  await assert.rejects(() => loadAnalyses({ url: '/api', fetchImpl: async () => ({ ok: true, json: async () => ({}) }) }), /Invalid analyses/);
});

test('the page only turns HealthService levels into colours and text', () => {
  const { levels } = copy();
  assert.equal(levelColor(4), '#a4242f');
  assert.equal(levelColor(null), levelColor(undefined));
  assert.equal(`#${colorScale(1).getHexString()}`, '#8fcca5');
  assert.equal(`#${colorScale(4).getHexString()}`, '#a4242f');
  assert.equal(levelText({ level: 3 }, levels), 'Moderate loss');
  assert.equal(levelText({ level: 4, belowMinimum: true }, levels), 'Below NASA minimum');
  assert.equal(levelText({ level: null, quality: 'not measured' }, levels), 'Not measured');
  assert.equal(levelText({ level: null, quality: 'out_of_range' }, levels), 'No valid test (out of range)');
});

test('every strength group has its CFT70 reference and the day axis follows NASA labels', () => {
  const data = copy();
  for (const group of data.strength.groups) assert.ok(referenceFor(group.measure), group.measure);
  assert.equal(referenceFor('trunk_flexion_60').muscle, 'abdominal_muscles');
  assert.equal(xOf({ phase: 'pre', day: -30 }), 0);
  assert.deepEqual([0, 14, 179, 180, 185].map(d => dayLabel(d, 180)), ['Pre', 'FD15', 'FD180', 'R+0', 'R+5']);
  assert.deepEqual(dayAxis({ landing: 180 }, [0, 14, 210]), { domain: [0, 210], ticks: [0, 30, 60, 90, 120, 150, 180, 210] });
});
