import test from 'node:test';
import assert from 'node:assert/strict';
import { muscles } from '../src/front/body-3d/anatomy.js';
import { scoresReducer } from '../src/front/web/scores.js';

test('test mode populates all muscles and restores previous values after edits or clearing', () => {
  const initial = { scores: { quadriceps_l: 71 }, savedScores: null };
  const testing = scoresReducer(initial, { type: 'toggle-test' });
  assert.deepEqual(Object.keys(testing.scores).sort(), muscles.map(item => item.key).sort());
  assert.deepEqual(new Set(Object.values(testing.scores)), new Set([25, 50, 75, 100]));
  assert.deepEqual(scoresReducer(initial, { type: 'toggle-test' }).scores, testing.scores);
  const edited = scoresReducer(testing, { type: 'set', key: 'quadriceps_l', value: 4 });
  assert.equal(edited.scores.quadriceps_l, 4);
  assert.deepEqual(scoresReducer(edited, { type: 'toggle-test' }), initial);
  const cleared = scoresReducer(edited, { type: 'clear' });
  assert.deepEqual(cleared.scores, {});
  assert.deepEqual(scoresReducer(cleared, { type: 'toggle-test' }), initial);
  assert.deepEqual(scoresReducer(initial, { type: 'clear' }), { scores: {}, savedScores: null });
});
