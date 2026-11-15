import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDistance, recommendations, updateStatus } from '../src/front/sketch/vuelo/recommendations.js';
import example from '../src/front/sketch/data/analyses.example.json' with { type: 'json' };

const fixture = () => structuredClone(example);

test('uses both schedules and surfaces the critical aerobic alert', () => {
  const data = fixture();
  const items = recommendations(data);
  assert.equal(items[0].type, 'Alert');
  assert.equal(items[0].severity, 'critical');
  assert.equal(items[0].view, 'aerobica');
  assert.equal(items[0].finding.detail, data.aerobic.alert.message);
  assert.deepEqual(items.filter(item => item.type === 'Routine').map(item => item.view).sort(), ['aerobica', 'aerobica', 'fuerza', 'fuerza']);
  assert.ok(items.some(item => item.dayLabel === 'R+5'));
  assert.ok(!items.some(item => item.id === 'calf-retest'));
});

test('uses scheduler labels and retest reasons without guessing the affected muscle', () => {
  const data = fixture();
  data.mission.today = -10;
  data.mission.todayLabel = 'L-10';
  data.strength.upcoming = [{ day: -5, label: 'L-5', reason: 'retest' }];
  data.aerobic.upcoming = [{ day: 51, label: 'FD52', reason: 'retest' }];
  data.aerobic.alert = null;
  const items = recommendations(data);
  assert.deepEqual(items.map(item => item.dayLabel), ['L-5', 'FD52']);
  assert.ok(items.every(item => item.type === 'Retest'));
  assert.ok(items.every(item => !item.muscle));
  assert.equal(dayDistance(-5, -10), 'In 5 days');
});

test('shows strength alerts and handles empty schedules without inventing a retest', () => {
  const data = fixture();
  data.strength.upcoming = [];
  data.aerobic.upcoming = [];
  data.aerobic.alert = null;
  assert.deepEqual(recommendations(data), []);
  data.strength.groups[0].alert = { severity: 'warning', rule: 'beyond_typical', message: 'Faster loss' };
  const [alert] = recommendations(data);
  assert.equal(alert.finding.detail, 'Faster loss');
  assert.equal(alert.muscle, data.strength.groups[0].muscleKeys[0]);
  assert.equal(alert.dayLabel, data.mission.todayLabel);
});

test('local status changes affect only studies', () => {
  const items = [{ id: 'a', type: 'Routine', status: 'Scheduled' }, { id: 'b', type: 'Alert' }];
  assert.equal(updateStatus(items, 'a', 'Completed')[0].status, 'Completed');
  assert.equal(updateStatus(items, 'b', 'Completed')[1].status, undefined);
  assert.equal(updateStatus(items, 'a', 'invalid'), items);
});

test('alert measurements use real series and leave gaps for invalid readings', () => {
  const data = fixture();
  data.aerobic.evaluations[1].value = 123;
  data.aerobic.evaluations[1].quality = 'missing';
  const alert = recommendations(data).find(item => item.id === 'alert:aerobic');
  assert.equal(alert.measurement.series[0].value, data.aerobic.evaluations[0].value);
  assert.equal(alert.measurement.series[1].value, null);
  assert.equal(alert.measurement.series.at(-1).label, data.aerobic.evaluations.at(-1).label);
  assert.equal(alert.measurement.unit, data.aerobic.unit);
  assert.equal(recommendations(data).find(item => item.type === 'Routine').measurement.series, undefined);
  data.strength.groups[0].alert = { severity: 'warning', rule: 'beyond_typical', message: 'Faster loss' };
  const strength = recommendations(data).find(item => item.id === `alert:strength:${data.strength.groups[0].key}`);
  assert.equal(strength.measurement.series.at(-1).value, data.strength.groups[0].points.at(-1).value);
});
