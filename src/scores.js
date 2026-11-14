import { muscles } from './anatomy.js';

const testLevels = [25, 50, 75, 100];

export function scoresReducer(state, action) {
  switch (action.type) {
    case 'toggle-test':
      return state.savedScores === null
        ? { savedScores: state.scores, scores: Object.fromEntries(muscles.map((muscle, index) => [muscle.key, testLevels[index % testLevels.length]])) }
        : { scores: state.savedScores, savedScores: null };
    case 'set':
      return { ...state, scores: { ...state.scores, [action.key]: action.value } };
    case 'clear':
      return { ...state, scores: {} };
    default:
      return state;
  }
}
