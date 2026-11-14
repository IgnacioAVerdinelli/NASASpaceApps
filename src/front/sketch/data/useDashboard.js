import { useEffect, useState } from 'react';
import { pollDashboard } from './pollDashboard.js';

export function useDashboard(url = import.meta.env.VITE_DASHBOARD_URL) {
  const [state, setState] = useState({ data: null, error: null });
  useEffect(() => pollDashboard({
    url,
    onData: data => setState({ data, error: null }),
    onError: error => setState(previous => ({ ...previous, error })),
  }), [url]);
  return state;
}
