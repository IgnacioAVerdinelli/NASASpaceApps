import example from './analyses.example.json' with { type: 'json' };
import { validateAnalyses } from './contract.js';

// The flight-measurement page reads GET /api/v1/analyses, the sibling of the dashboard URL, with the same
// parameters (?day=..., as dashboardUrl keeps them) and the chosen crew member.
export function analysesUrl(dashboardUrl, crew) {
  const parsed = new URL(dashboardUrl, 'http://localhost');
  parsed.pathname = parsed.pathname.replace(/\/dashboard\/?$/, '/analyses');
  parsed.hash = '';
  if (crew) parsed.searchParams.set('crew', crew);
  return /^[a-z][a-z\d+.-]*:/i.test(dashboardUrl) ? parsed.href : `${parsed.pathname}${parsed.search}`;
}

// No implicit fallback, as for the dashboard: an empty URL means example mode, a failing API stays an error.
export async function loadAnalyses({ url, signal, fetchImpl = fetch } = {}) {
  if (!url) return validateAnalyses(structuredClone(example));
  const response = await fetchImpl(url, { signal, headers: { Accept: 'application/json' }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Analyses request failed (${response.status})`);
  return validateAnalyses(await response.json());
}
