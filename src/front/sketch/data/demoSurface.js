// Illustrative surface colours for the five-case demo; these are not instrument readings.
const groups = ['deltoid', 'upper_arm_muscles', 'forearm_muscles', 'hand_muscles',
  'chest_muscles', 'trapezius', 'back_muscles', 'gluteal', 'quadriceps',
  'hamstrings', 'shin_muscles', 'calf', 'foot_muscles'];
const profiles = {
  'CM-1': [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  'CM-2': [2, 1, 2, 1, 2, 1, 1, 1, 2, 1, 1, 1, 1, 1],
  'CM-3': [1, 2, 2, 1, 2, 2, 2, 1, 1, 2, 1, 1, 1, 2],
  'CM-4': [2, 2, 1, 1, 1, 3, 2, 3, 3, 3, 2, 3, 1, 2],
  'CM-5': [3, 2, 2, 1, 3, 2, 2, 2, 2, 1, 1, 2, 1, 3],
};

export function demoSurfaceScores(mission, crew) {
  const levels = mission?.name === 'iss_180_demo_five' && mission.today >= 0 && profiles[crew];
  if (!levels) return null;
  return Object.fromEntries([
    ...groups.flatMap((group, i) => [[`${group}_l`, levels[i]], [`${group}_r`, levels[i]]]),
    ['abdominal_muscles', levels[13]],
  ]);
}
