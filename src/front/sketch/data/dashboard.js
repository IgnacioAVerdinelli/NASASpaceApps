import example from './dashboard.example.json' with { type: 'json' };
import { validateDashboard } from './contract.js';

export const pollIntervalMs = 3000;

export function dashboardUrl(url, crew) {
  const parsed = new URL(url, 'http://localhost');
  if (crew) parsed.searchParams.set('crew', crew);
  return /^[a-z][a-z\d+.-]*:/i.test(url) ? parsed.href : `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function healthUrl(url) {
  const parsed = new URL(url, 'http://localhost');
  parsed.pathname = parsed.pathname.replace(/\/dashboard\/?$/, '/health');
  parsed.search = '';
  parsed.hash = '';
  return /^[a-z][a-z\d+.-]*:/i.test(url) ? parsed.href : parsed.pathname;
}

export async function loadCrew({ url, signal, fetchImpl = fetch }) {
  const response = await fetchImpl(healthUrl(url), { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Health request failed (${response.status})`);
  const data = await response.json();
  if (!Array.isArray(data.crew) || !data.crew.length || data.crew.some(id => typeof id !== 'string' || !id)) {
    throw new Error('Invalid crew list');
  }
  return data.crew;
}

// No implicit fallback: a configured API error must remain visible.
export async function loadDashboard({ url, signal, fetchImpl = fetch } = {}) {
  if (!url) return validateDashboard(structuredClone(example));
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
  return validateDashboard(await response.json());
}
