import { useEffect, useState } from 'react';
import { pollDashboard } from './pollDashboard.js';

export function useDashboard(url, load) {
  const [state, setState] = useState({ url: null, data: null, error: null });
  useEffect(() => {
    if (url === null) return;
    setState({ url, data: null, error: null });
    return pollDashboard({
      url, load,
      onData: data => setState({ url, data, error: null }),
      onError: error => setState(previous => ({ url, data: previous.url === url ? previous.data : null, error })),
    });
  }, [url, load]);
  return state.url === url ? state : { data: null, error: null };
}
