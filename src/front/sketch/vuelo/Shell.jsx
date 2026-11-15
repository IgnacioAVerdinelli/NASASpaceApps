import React, { useEffect, useRef, useState } from 'react';
import { StrengthView } from '../fuerza/App.jsx';
import { AerobicView } from '../aerobica/AerobicView.jsx';
import { PlanView } from '../plan/PlanView.jsx';
import { SummaryView } from '../summary/SummaryView.jsx';
import { VitalsView } from '../vitals/VitalsView.jsx';
import { EyesView } from '../ojos/EyesView.jsx';
import { VeinsView } from '../venas/VeinsView.jsx';
import { loadVitals, vitalsUrl } from '../data/vitals.js';
import { analysesUrl, loadAnalyses } from '../data/analyses.js';
import { loadCrew } from '../data/dashboard.js';
import { useDashboard } from '../data/useDashboard.js';
import '../style.css';
import '../fuerza/style.css';
import './style.css';

// Same data source as the body overview (src.jsx): the HealthService through Vite's /api proxy, another server
// with VITE_DASHBOARD_URL, or the example file with VITE_DASHBOARD_MODE=example.
const exampleMode = import.meta.env.VITE_DASHBOARD_MODE === 'example';
const apiUrl = import.meta.env.VITE_DASHBOARD_URL || '/api/v1/dashboard';

// Each analysis of "Flight measurements" is a tab. To add one, add it here.
const TABS = [
  { id: 'summary', label: 'Health summary' },
  { id: 'vitales', label: 'Vital signs' },
  { id: 'plan', label: 'Mission plan' },
  { id: 'fuerza', label: 'Muscle strength', View: StrengthView },
  { id: 'aerobica', label: 'Aerobic capacity', View: AerobicView },
  { id: 'ojos', label: 'Eyes' },
  { id: 'venas', label: 'Neck veins' },
];
const fromHash = () => TABS.some(t => `#${t.id}` === window.location.hash) ? window.location.hash.slice(1) : TABS[0].id;
const crewFromUrl = () => new URLSearchParams(window.location.search).get('crew') || '';

export function Shell() {
  const [tab, setTab] = useState(fromHash);
  const [focusRequest, setFocusRequest] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState(crewFromUrl);
  const tabRefs = useRef({});
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const crewState = useDashboard(exampleMode ? null : apiUrl, loadCrew);
  const crewList = crewState.data || [];
  const selected = crewList.includes(selectedCrew) ? selectedCrew : crewList[0];
  const { data, error } = useDashboard(exampleMode ? '' : selected ? analysesUrl(apiUrl, selected) : null, loadAnalyses);
  const crewId = data?.crew.id ?? selected;
  // The watch (layer 1): read once here, shown on the summary and on its own tab.
  const vitalsState = useDashboard(exampleMode || !crewId ? null : vitalsUrl(apiUrl, crewId), loadVitals);
  const vitals = vitalsState.data?.crew.id === crewId ? vitalsState.data : null;
  const today = data?.mission.today ?? null;
  useEffect(() => {
    if (!crewId || exampleMode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('crew', crewId);
    window.history.replaceState(null, '', url);
  }, [crewId]);

  const select = (id, focus = false) => {
    if (id !== tab) { window.history.replaceState(null, '', `${window.location.search}#${id}`); window.scrollTo({ top: 0 }); }
    setTab(id);
    if (focus) tabRefs.current[id]?.focus();
  };
  const onKeyDown = event => {
    const i = TABS.findIndex(t => t.id === tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(TABS[(next + TABS.length) % TABS.length].id, true);
  };
  const overviewHref = `./overview.html${crewId && !exampleMode ? `?crew=${encodeURIComponent(crewId)}` : ''}`;

  // Inactive tabs stay mounted (hidden): the 3D model is not reloaded and each tab keeps its state.
  return <main className="vuelo">
    <header className="page-head vuelo-head">
      <h1>Flight measurements</h1>
      <dl className="mission">
        <div><dt>Crew member</dt><dd>{!exampleMode && crewList.length > 0
          ? <select aria-label="Crew member" value={selected} onChange={event => setSelectedCrew(event.target.value)}>{crewList.map(id => <option key={id} value={id}>{id}</option>)}</select>
          : crewId ?? '—'}{data?.simulated && <small> (simulated)</small>}</dd></div>
        {data && <div><dt>Today</dt><dd>{data.mission.todayLabel}</dd></div>}
        {data && <div><dt>Flight length</dt><dd>{data.mission.landing} days</dd></div>}
      </dl>
      <a className="page-link" href={overviewHref}>← Body overview</a>
      <div className="tabs" role="tablist" aria-label="Analyses" onKeyDown={onKeyDown}>
        {TABS.map(t => <button key={t.id} ref={el => { tabRefs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => select(t.id)}>{t.label}</button>)}
      </div>
    </header>
    {(error || crewState.error) && data && <div className="connection-notice" role="status">Connection lost. Showing the last available data.</div>}
    {!data ? <div className="connection-notice" role={error || crewState.error ? 'alert' : 'status'}>{error || crewState.error ? 'Unable to load data. Retrying automatically…' : 'Loading data…'}</div> : <>
    <section id="panel-summary" role="tabpanel" aria-labelledby="tab-summary" hidden={tab !== 'summary'}>
      <SummaryView data={data} crewId={crewId} apiUrl={apiUrl} exampleMode={exampleMode} vitals={vitals}
        onOpen={(id, focusKey) => { if (focusKey) setFocusRequest({ key: focusKey, request: Date.now() }); select(id, true); }}/>
    </section>
    <section id="panel-vitales" role="tabpanel" aria-labelledby="tab-vitales" hidden={tab !== 'vitales'}>{exampleMode
      ? <div className="connection-notice" role="status">Vital signs need the HealthService; they are not available in example mode.</div>
      : <VitalsView vitals={vitals} error={vitalsState.error}/>}</section>
    <section id="panel-plan" role="tabpanel" aria-labelledby="tab-plan" hidden={tab !== 'plan'}>{exampleMode
      ? <div className="connection-notice" role="status">The mission plan needs the Planner service (port 3001); it is not available in example mode.</div>
      : <PlanView crew={crewId}/>}</section>
    <section id="panel-ojos" role="tabpanel" aria-labelledby="tab-ojos" hidden={tab !== 'ojos'}>{exampleMode
      ? <div className="connection-notice" role="status">The eye exams need the HealthService; they are not available in example mode.</div>
      : <EyesView apiUrl={apiUrl} crewId={crewId} body={data.crew.body}/>}</section>
    <section id="panel-venas" role="tabpanel" aria-labelledby="tab-venas" hidden={tab !== 'venas'}>{exampleMode
      ? <div className="connection-notice" role="status">The jugular scans need the HealthService; they are not available in example mode.</div>
      : <VeinsView apiUrl={apiUrl} crewId={crewId} body={data.crew.body}/>}</section>
    {TABS.filter(t => t.View).map(({ id, View }) => <section key={`${id}-${data.crew.id}`} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={tab !== id}><View data={data} focusRequest={id === 'fuerza' ? focusRequest : null}/></section>)}
    </>}
  </main>;
}
