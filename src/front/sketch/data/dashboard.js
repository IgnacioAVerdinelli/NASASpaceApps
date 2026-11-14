import example from './dashboard.example.json' with { type: 'json' };
import { validateDashboard } from './contract.js';

export const pollIntervalMs = 3000;

// No implicit fallback: a configured API error must remain visible.
export async function loadDashboard({ url, signal, fetchImpl = fetch } = {}) {
  if (!url) return validateDashboard(structuredClone(example));
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
  return validateDashboard(await response.json());
}
