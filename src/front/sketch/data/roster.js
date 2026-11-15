// Crew labels for the simulated crew IDs. The crew is fictional: each ID keeps its own label and a generic role,
// with no names, photos or likenesses of real people. The health data is synthetic, and synthetic findings must
// never sit next to a real person's name.
const ROLES = {
  'CM-1': 'Commander',
  'CM-2': 'Pilot',
  'CM-3': 'Flight engineer',
  'CM-4': 'Flight engineer',
  'CM-5': 'Mission specialist',
  'CM-6': 'Mission specialist',
  'CM-7': 'Mission specialist',
};

// The person behind a crew ID: the ID itself as the name, plus a generic role.
export function person(id) {
  return { id, name: id, role: ROLES[id] || 'Crew member', agency: '', photo: null };
}

// The mission's name as the simulator reports it ("iss_180_demo_five" -> "ISS 180 DEMO FIVE").
export function missionName(mission) {
  return mission?.name ? mission.name.replaceAll('_', ' ').toUpperCase() : '';
}
