import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { useDashboard } from './data/useDashboard.js';

function Dashboard() {
  const { data, error } = useDashboard();
  if (!data) return <main className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load data. Retrying automatically…' : 'Loading data…'}</main>;
  return <App dashboard={data} stale={Boolean(error)} />;
}

createRoot(document.getElementById('root')).render(<Dashboard />);
