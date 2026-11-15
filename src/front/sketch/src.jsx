import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.jsx';
import { useDashboard } from './data/useDashboard.js';
import { dashboardUrl, loadCrew } from './data/dashboard.js';

const exampleMode = import.meta.env.VITE_DASHBOARD_MODE === 'example';
const apiUrl = import.meta.env.VITE_DASHBOARD_URL || '/api/v1/dashboard';

function Dashboard() {
  const [selectedCrew, setSelectedCrew] = useState(() => new URLSearchParams(window.location.search).get('crew') || '');
  const crewState = useDashboard(exampleMode ? null : apiUrl, loadCrew);
  const crew = crewState.data || [];
  const selected = crew.includes(selectedCrew) ? selectedCrew : crew[0];
  const url = exampleMode ? '' : selected ? dashboardUrl(apiUrl, selected) : null;
  const { data, error } = useDashboard(url);
  return <>
    <div className="crew-selector">{!exampleMode && crew.length > 0 && <><label htmlFor="crew">Crew member</label><select id="crew" value={selected} onChange={event => setSelectedCrew(event.target.value)}>{crew.map(id => <option key={id} value={id}>{id}</option>)}</select></>}<a className="page-link" href={`vuelo.html${!exampleMode && selected ? `?crew=${encodeURIComponent(selected)}` : ''}`}>Flight measurements: strength and aerobic capacity →</a></div>
    {crewState.error && crew.length > 0 && <div className="connection-notice" role="status">Unable to refresh crew list. Retrying automatically…</div>}
    {!data ? <main className="connection-notice" role={error || crewState.error ? 'alert' : 'status'}>{error || crewState.error ? 'Unable to load data. Retrying automatically…' : 'Loading data…'}</main> : <App key={selected || 'example'} dashboard={data} stale={Boolean(error)} />}
  </>;
}

createRoot(document.getElementById('root')).render(<Dashboard />);
