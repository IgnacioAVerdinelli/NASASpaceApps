import React, { useEffect, useRef, useState } from 'react';
import { StrengthView } from '../fuerza/App.jsx';
import { dayDistance, exampleRecommendations, updateStatus } from './recommendations.js';
import { AerobicView } from '../aerobica/AerobicView.jsx';
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
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'fuerza', label: 'Muscle strength', View: StrengthView },
  { id: 'aerobica', label: 'Aerobic capacity', View: AerobicView },
];
const fromHash = () => TABS.some(t => `#${t.id}` === window.location.hash) ? window.location.hash.slice(1) : TABS[0].id;
const crewFromUrl = () => new URLSearchParams(window.location.search).get('crew') || '';

export function Shell() {
  const [tab, setTab] = useState(fromHash);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [focusRequest, setFocusRequest] = useState(null);
  const [selectedCrew, setSelectedCrew] = useState(crewFromUrl);
  const tabRefs = useRef({});
  const examplesCrew = useRef(null);
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
  const today = data?.mission.today ?? null;
  useEffect(() => {
    if (!data) return;
    const mapped = data.strength.groups.map(group => ({ key: group.key, points: group.points.map((point, index) => ({ pct: point.changePct, label: data.strength.evaluations[index]?.label })) }));
    const examples = exampleRecommendations({ id: data.crew.id, today: data.mission.today, landing: data.mission.landing }, mapped, data.strength.upcoming);
    const sameCrew = examplesCrew.current === data.crew.id;
    setItems(previous => examples.map(item => ({ ...item, status: sameCrew ? previous.find(old => old.id === item.id)?.status ?? item.status : item.status })));
    if (!sameCrew) setSelectedId(examples[0]?.id);
    examplesCrew.current = data.crew.id;
  }, [data]);
  const selectedItem = items.find(item => item.id === selectedId) || items[0];
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
    <section id="panel-recommendations" role="tabpanel" aria-labelledby="tab-recommendations" hidden={tab !== 'recommendations'} className="recommendations">
      <div className="recommendations-header"><div><h2>Recommendations</h2><p>Example actions based on simulated mission data.</p></div><span className="demo-label">SIMULATED EXAMPLE</span></div>
      <p className="recommendations-intro">Explore the measurement, observation and suggested next step.</p>
      {selectedItem ? <div className="decision-layout">
        <article className="decision-main" aria-labelledby="recommendation-detail-title">
          <div className="decision-heading"><div><span className="decision-kind">{selectedItem.type} · {selectedItem.dayLabel}</span><h3 id="recommendation-detail-title">{selectedItem.title}</h3><p>{dayDistance(selectedItem.day, today)} · Crew member {selectedItem.crew}</p></div><span className="decision-status" data-status={selectedItem.status}>{selectedItem.status}</span></div>
          <div className="decision-steps" aria-label="How this example was formed">
            {[['Measurement', selectedItem.measurement], ['Observation', selectedItem.finding], ['Suggested action', selectedItem.action]].map(([label, step]) => <div className="decision-step" key={label}>
              <span className="step-label">{label}</span><strong>{step.title}</strong><p>{step.detail}</p>
            </div>)}
          </div>
          <div className="recommendation-actions"><button type="button" onClick={() => { setFocusRequest(selectedItem.muscle ? { key: selectedItem.muscle, request: Date.now() } : null); select(selectedItem.view, true); }}>View related measurement <span aria-hidden="true">→</span></button><label>Status <select value={selectedItem.status} onChange={event => setItems(current => updateStatus(current, selectedItem.id, event.target.value))}><option>Scheduled</option><option>Pending</option><option>Completed</option></select></label></div>
        </article>
        <aside className="decision-sidebar" aria-label="Recommendation selection"><h3>Explore actions</h3><p>Select an action to see its context.</p><div className="decision-options">{items.map(item => <button key={item.id} type="button" aria-pressed={selectedItem.id === item.id} onClick={() => setSelectedId(item.id)}><span>{item.type} · {item.dayLabel}</span><strong>{item.title}</strong><small>{dayDistance(item.day, today)}</small><span className="decision-status" data-status={item.status}>{item.status}</span></button>)}</div></aside>
      </div> : <div className="decision-empty"><h3>No example actions available</h3><p>A valid measurement or upcoming assessment is needed to show this demo.</p></div>}
      <p className="recommendations-note">Illustrative recommendations based on the displayed data, not scheduler output or clinical guidance. Status changes reset when the page is reloaded.</p>
    </section>
    {TABS.filter(t => t.View).map(({ id, View }) => <section key={`${id}-${data.crew.id}`} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={tab !== id}><View data={data} focusRequest={id === 'fuerza' ? focusRequest : null}/></section>)}
    </>}
  </main>;
}
