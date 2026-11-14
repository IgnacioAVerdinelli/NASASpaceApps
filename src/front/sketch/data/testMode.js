import { muscles } from '../../body-3d/anatomy.js';

export function testModeReducer(state, action) {
  switch (action.type) {
    case 'start': return { body: action.model.body, layer: action.model.layer, selected: action.selected, scores: { ...action.model.scores } };
    case 'exit': return null;
    case 'body': return { ...state, body: action.value };
    case 'layer': return { ...state, layer: action.value };
    case 'select': return { ...state, selected: action.value };
    case 'intensity': return { ...state, scores: { ...state.scores, [state.selected]: action.value } };
    case 'paint': return { ...state, scores: Object.fromEntries(muscles.map((muscle, index) => [muscle.key, [25, 50, 75, 100][index % 4]])) };
    case 'clear': return { ...state, scores: {} };
    default: return state;
  }
}
