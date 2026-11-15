import assert from 'node:assert/strict';
import test from 'node:test';
import { eyeShape, eyesUrl, loadEyes, octRows, shown, validateEyes } from '../src/front/sketch/data/eyes.js';

const exam = (label, day, changes, values = {}, cls = 'none') => ({ label, day, changes, values, class: cls, signs: [] });
const data = exams => ({ version: 1, exams, measures: [], status: { class: 'none', signs: [] }, thresholds: { oct_trt: { A: 20, B: 55 } } });

test('URL and validation', () => {
  assert.equal(eyesUrl('/api/v1/dashboard', 'CM-1'), '/api/v1/eyes?crew=CM-1');
  assert.equal(eyesUrl('http://h:3000/api/v1/dashboard?day=9', 'CM 1'), 'http://h:3000/api/v1/eyes?crew=CM+1');
  assert.throws(() => validateEyes({ version: 1, exams: [] }));
  assert.ok(validateEyes(data([])));
});

test('the drawing reads the changes, never below zero', () => {
  const s = eyeShape(exam('FD90', 89, { oct_trt: 58, oct_choroid: 40, onsd: 0.8 }, { globe_flattening: 1, choroidal_folds: 0 }));
  assert.deepEqual(s, { disc: 58, choroid: 40, sheath: 0.8, flatten: 1, folds: 0 });
  assert.equal(eyeShape(exam('L-30', -30, { oct_trt: -4 })).disc, 0);
  assert.deepEqual(eyeShape(undefined), { disc: 0, choroid: 0, sheath: 0, flatten: 0, folds: 0 });
});

test('OCT rows and how values read', () => {
  const rows = octRows(data([exam('L-30', -30, { oct_trt: 0 }), exam('FD30', 29, { oct_trt: 22, oct_mrw: 25 }, {}, 'A')]));
  assert.deepEqual(rows[1], { day: 29, label: 'FD30', cls: 'A', trt: 22, mrw: 25, choroid: null });
  assert.equal(shown({ measure: 'frisen_grade', unit: 'grade' }, 1), 'Grade 1');
  assert.equal(shown({ measure: 'choroidal_folds', unit: 'flag' }, 0), 'Not seen');
  assert.equal(shown({ measure: 'onsd', unit: 'mm', decimals: 2 }, 6.1), '6.10 mm');
});

test('loadEyes reports a failing API', async () => {
  await assert.rejects(loadEyes({ url: '/x', fetchImpl: async () => ({ ok: false, status: 503 }) }), /503/);
});
