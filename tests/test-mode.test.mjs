import test from 'node:test';
import assert from 'node:assert/strict';
import { testModeReducer } from '../src/front/sketch/data/testMode.js';

test('test mode edits a copy and supports layers, models and painted values', () => {
  const model = { body: 'male', layer: 'surface', scores: { quadriceps_l: 15 } };
  let state = testModeReducer(null, { type: 'start', model, selected: 'quadriceps_l' });
  state = testModeReducer(state, { type: 'body', value: 'female' });
  state = testModeReducer(state, { type: 'layer', value: 'muscles' });
  state = testModeReducer(state, { type: 'intensity', value: 88 });
  assert.equal(state.body, 'female');
  assert.equal(state.layer, 'muscles');
  assert.equal(state.scores.quadriceps_l, 88);
  assert.equal(model.scores.quadriceps_l, 15);
  state = testModeReducer(state, { type: 'paint' });
  assert.ok(Object.values(state.scores).includes(100));
  state = testModeReducer(state, { type: 'clear' });
  assert.deepEqual(state.scores, {});
  assert.equal(testModeReducer(state, { type: 'exit' }), null);
});
