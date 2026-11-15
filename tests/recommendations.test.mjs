import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDistance, exampleRecommendations, updateStatus } from '../src/front/sketch/vuelo/recommendations.js';
import example from '../src/front/sketch/data/analyses.example.json' with { type: 'json' };

const crew = { id: 'CM-1', today: 170, landing: 180 };
const mapped = example.strength.groups.map(group => ({ key: group.key, points: group.points.map((point, i) => ({ pct: point.changePct, label: example.strength.evaluations[i]?.label })) }));

test('examples use an available measurement and preserve the actual next assessment label', () => {
  const items = exampleRecommendations(crew, mapped, example.strength.upcoming);
  assert.equal(items[0].crew, 'CM-1');
  assert.equal(items[0].dayLabel, 'FD172');
  assert.equal(items[0].measurement.title, 'Calf strength');
  assert.match(items[0].finding.title, /pre-flight/);
  assert.equal(items[1].dayLabel, 'R+5');
  assert.equal(items[1].type, 'Routine');
});

test('missing measurements and dates do not produce invented actions', () => {
  assert.deepEqual(exampleRecommendations(crew, [], []), []);
  assert.deepEqual(exampleRecommendations(crew, [{ key: 'calves', points: [{}] }], []), []);
  assert.deepEqual(exampleRecommendations({ ...crew, today: 179 }, mapped, []), []);
  assert.deepEqual(exampleRecommendations(crew, [], [{ day: 160, label: 'FD161' }]), []);
});

test('status changes affect only the selected recommendation and reject unknown values', () => {
  const items = [{ id: 'a', status: 'Scheduled' }, { id: 'b', status: 'Scheduled' }];
  const updated = updateStatus(items, 'a', 'Completed');
  assert.equal(updated[0].status, 'Completed');
  assert.equal(updated[1].status, 'Scheduled');
  assert.equal(items[0].status, 'Scheduled');
  assert.equal(updateStatus(items, 'a', 'invalid'), items);
  assert.equal(dayDistance(171, 170), 'In 1 day');
  assert.equal(dayDistance(185, 170), 'In 15 days');
});
