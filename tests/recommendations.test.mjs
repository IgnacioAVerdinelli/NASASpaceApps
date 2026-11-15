import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayDistance, exampleRecommendations, timelineItems, updateStatus } from '../src/front/sketch/vuelo/recommendations.js';

test('examples use the selected crew and latest calf measurement', () => {
  const items = exampleRecommendations({ id: 'CM-2', today: 112 }, [{ key: 'calf', points: [{ label: 'FD 105', pct: -13.6 }] }]);
  assert.equal(items[0].crew, 'CM-2');
  assert.equal(items[0].day, 113);
  assert.match(items[0].reason, /13\.6% below/);
  assert.equal(items[0].muscle, 'calf_l');
  assert.equal(items[1].type, 'Routine');
  assert.match(exampleRecommendations({ id: 'CM-2', today: 112 }, [])[0].reason, /unavailable/);
  assert.match(exampleRecommendations({ id: 'CM-2', today: 112 }, [{ key: 'calf', points: [{}] }])[0].reason, /unavailable/);
});

test('status changes affect only the selected recommendation and reject unknown values', () => {
  const items = [{ id: 'a', status: 'Scheduled' }, { id: 'b', status: 'Scheduled' }];
  const updated = updateStatus(items, 'a', 'Completed');
  assert.equal(updated[0].status, 'Completed');
  assert.equal(updated[1].status, 'Scheduled');
  assert.equal(items[0].status, 'Scheduled');
  assert.equal(updateStatus(items, 'a', 'invalid'), items);
});

test('timeline sorts dates, keeps same-day actions and handles missing dates', () => {
  const items = [{ id: 'late', day: 135 }, { id: 'unknown' }, { id: 'same', day: 112 }, { id: 'soon', day: 113 }, { id: 'same2', day: 112 }];
  assert.deepEqual(timelineItems(items, 112).map(item => item.id), ['__today__', 'same', 'same2', 'soon', 'late', 'unknown']);
  assert.equal(dayDistance(113, 112), 'In 1 day');
  assert.equal(dayDistance(135, 112), 'In 23 days');
  assert.equal(dayDistance(112, 112), 'Today');
  assert.equal(dayDistance(110, 112), '2 days ago');
  assert.equal(dayDistance(null, 112), 'Date unavailable');
  assert.deepEqual(timelineItems([], 112).map(item => item.id), ['__today__']);
});
