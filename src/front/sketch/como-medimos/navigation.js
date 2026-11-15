const entries = new Set(['index.html', 'vuelo.html', 'overview.html']);
const tabs = new Set(['summary', 'fuerza', 'aerobica', 'vitales', 'plan', 'body', 'trends', 'hip-bone']);
export function measurementsHref(href, crew) {
  const current = new URL(href);
  const target = new URL('./como-medimos.html', current);
  for (const key of ['crew', 'source']) if (current.searchParams.has(key)) target.searchParams.set(key, current.searchParams.get(key));
  if (crew) target.searchParams.set('crew', crew);
  const entry = current.pathname.split('/').pop() || 'index.html';
  if (entries.has(entry)) target.searchParams.set('from', entry);
  if (tabs.has(current.hash.slice(1))) target.searchParams.set('view', current.hash.slice(1));
  return target.pathname + target.search;
}
export function applicationHref(href) {
  const current = new URL(href);
  const from = current.searchParams.get('from');
  const target = new URL('./' + (entries.has(from) ? from : 'index.html'), current);
  for (const key of ['crew', 'source']) if (current.searchParams.has(key)) target.searchParams.set(key, current.searchParams.get(key));
  const view = current.searchParams.get('view');
  target.hash = tabs.has(view) ? view : 'summary';
  return target.pathname + target.search + target.hash;
}
