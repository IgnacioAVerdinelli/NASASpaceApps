import test from 'node:test';
import assert from 'node:assert/strict';
import { demoSurfaceScores } from '../src/front/sketch/data/demoSurface.js';

test('five demo crew have complete and distinct illustrative surface profiles', () => {
  const mission = { name: 'iss_180_demo_five', today: 130 };
  const profiles = Array.from({ length: 5 }, (_, i) => demoSurfaceScores(mission, `CM-${i + 1}`));
  assert.equal(new Set(profiles.map(p => JSON.stringify(p))).size, 5);
  for (const profile of profiles) {
    assert.equal(Object.keys(profile).length, 27);
    assert.ok(Object.values(profile).every(n => n >= 1 && n <= 4));
    assert.ok(profile.chest_muscles_l && profile.upper_arm_muscles_r && profile.gluteal_l);
    assert.equal(({ ...profile, back_muscles_l: 4 }).back_muscles_l, 4);
  }
  assert.equal(demoSurfaceScores({ name: 'iss_180', today: 130 }, 'CM-1'), null);
  assert.equal(demoSurfaceScores({ ...mission, today: -1 }, 'CM-1'), null);
  assert.equal(demoSurfaceScores(mission, 'CM-6'), null);
});
