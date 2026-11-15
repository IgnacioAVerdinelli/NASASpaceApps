// Example roster: the simulated crew IDs (CM-1…CM-7) shown with the names, roles and portraits of the ISS
// Expedition 75 crew as of November 2026. The health data stays synthetic; only the labels are real.
// Portraits: NASA official photos, public domain (via Wikimedia Commons).
const photo = name => new URL(`../crew/photos/${name}.jpg`, import.meta.url).href;

export const MISSION = { name: 'ISS · Expedition 75', short: 'Expedition 75' };

const ROSTER = {
  'CM-1': { name: 'Pyotr Dubrov', role: 'Expedition 75 commander', agency: 'Roscosmos', vehicle: 'Soyuz MS-29', aboardSince: '2026-07-14', photo: photo('dubrov') },
  'CM-2': { name: 'Anna Kikina', role: 'Flight engineer', agency: 'Roscosmos', vehicle: 'Soyuz MS-29', aboardSince: '2026-07-14', photo: photo('kikina') },
  'CM-3': { name: 'Anil Menon', role: 'Flight engineer', agency: 'NASA', vehicle: 'Soyuz MS-29', aboardSince: '2026-07-14', photo: photo('menon') },
  'CM-4': { name: 'Jessica Watkins', role: 'Crew-13 commander', agency: 'NASA', vehicle: 'SpaceX Crew-13', aboardSince: '2026-10-01', photo: photo('watkins') },
  'CM-5': { name: 'Luke Delaney', role: 'Crew-13 pilot', agency: 'NASA', vehicle: 'SpaceX Crew-13', aboardSince: '2026-10-01', photo: photo('delaney') },
  'CM-6': { name: 'Joshua Kutryk', role: 'Mission specialist', agency: 'CSA', vehicle: 'SpaceX Crew-13', aboardSince: '2026-10-01', photo: photo('kutryk') },
  'CM-7': { name: 'Sergey Teteryatnikov', role: 'Mission specialist', agency: 'Roscosmos', vehicle: 'SpaceX Crew-13', aboardSince: '2026-10-01', photo: photo('teteryatnikov') },
};

// The person behind a crew ID; unknown IDs fall back to the ID itself.
export function person(id) {
  return ROSTER[id] ? { id, ...ROSTER[id] } : { id, name: id, role: 'Crew member', agency: '', photo: null };
}
