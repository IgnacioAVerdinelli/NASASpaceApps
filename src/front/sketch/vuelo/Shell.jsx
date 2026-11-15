import React, { memo, useEffect, useRef, useState } from 'react';
import { StrengthView } from '../fuerza/App.jsx';
import { AerobicView } from '../aerobica/AerobicView.jsx';
import { PlanView } from '../plan/PlanView.jsx';
import { SummaryView } from '../summary/SummaryView.jsx';
import { VitalsView } from '../vitals/VitalsView.jsx';
import { EyesView } from '../ojos/EyesView.jsx';
import { VeinsView } from '../venas/VeinsView.jsx';
import { loadVitals, vitalsUrl } from '../data/vitals.js';
import { analysesUrl, loadAnalyses } from '../data/analyses.js';
import { dashboardUrl, loadCrew, loadDashboard } from '../data/dashboard.js';
import { useDashboard } from '../data/useDashboard.js';
import { Brand, Icon } from './Icons.jsx';
import { Backdrop } from './Backdrop.jsx';
import '../style.css';
import '../fuerza/style.css';
import './style.css';

const exampleMode = import.meta.env.VITE_DASHBOARD_MODE === 'example' || new URLSearchParams(window.location.search).get('source') === 'example';
const apiUrl = import.meta.env.VITE_DASHBOARD_URL || '/api/v1/dashboard';

const TABS = [
  { id: 'summary', label: 'Overview', title: 'Health overview' },
  { id: 'fuerza', label: 'Muscles', title: 'Muscle strength' },
  { id: 'aerobica', label: 'Aerobic', title: 'Aerobic capacity' },
  { id: 'vitales', label: 'Wearable', title: 'Vital signs' },
  { id: 'ojos', label: 'Eyes', title: 'Eye exam' },
  { id: 'venas', label: 'Neck veins', title: 'Neck vein ultrasound' },
  { id: 'plan', label: 'Mission plan', title: 'Mission plan' },
];

function tabFromUrl() {
  const hash = window.location.hash.slice(1);
  if (TABS.some(t => t.id === hash)) return hash;
  return hash === 'body' || hash === 'trends' || hash === 'hip-bone' || window.location.pathname.endsWith('/overview.html') ? 'fuerza' : 'summary';
}

function DataNotice({ error, subject = 'health data' }) {
  const preview = new URL(window.location.href);
  preview.searchParams.set('source', 'example');
  return <div className="flight-notice glass" role={error ? 'alert' : 'status'}>
    <Icon name="pulse" size={24}/>
    <div><strong>{error ? 'Connection unavailable' : 'Loading ' + subject + '…'}</strong>
      {error && <p>Reconnecting to the {subject} service…</p>}</div>
    {error && !exampleMode && <a href={preview.href}>Open example data</a>}
  </div>;
}

// Preserve the model camera and form inputs on tab changes. Hidden charts
// receive the latest readings when opened, without rendering on every poll.
const FlightPanel = memo(function FlightPanel({ id, hidden, children }) {
  return <section className="flight-view" id={'panel-' + id} role="tabpanel" aria-labelledby={'tab-' + id} hidden={hidden}>{children}</section>;
}, (previous, next) => previous.hidden && next.hidden);

export function Shell() {
  const [tab, setTab] = useState(tabFromUrl);
  const [visited, setVisited] = useState(() => new Set([tab]));
  const [focusRequest, setFocusRequest] = useState(null);
  const [trendTarget, setTrendTarget] = useState(() => window.location.hash);
  const [selectedCrew, setSelectedCrew] = useState(() => new URLSearchParams(window.location.search).get('crew') || '');
  const tabRefs = useRef({});
  const crewState = useDashboard(exampleMode ? null : apiUrl, loadCrew);
  const crewList = crewState.data || [];
  const selected = crewList.includes(selectedCrew) ? selectedCrew : crewList[0];
  const analyses = useDashboard(exampleMode ? '' : selected ? analysesUrl(apiUrl, selected) : null, loadAnalyses);
  const data = analyses.data;
  const crewId = selected ?? data?.crew.id;
  const vitalsState = useDashboard(exampleMode || !crewId ? null : vitalsUrl(apiUrl, crewId), loadVitals);
  const vitals = vitalsState.data?.crew.id === crewId ? vitalsState.data : null;
  const needsBodyData = visited.has('fuerza') || visited.has('summary');
  const bodyUrl = exampleMode ? '' : crewId ? dashboardUrl(apiUrl, crewId) : null;
  const bodyState = useDashboard(needsBodyData ? bodyUrl : null, loadDashboard);
  const active = TABS.find(item => item.id === tab);
  // Source and mission name: in the heading of every tab but the Overview, which shows them in Mission status.
  const sourceLabel = data ? (exampleMode ? 'Example data' : data.simulated ? 'Simulation' : 'Mission data') : null;
  const missionLabel = data ? data.mission.name.replaceAll('_', ' ').toUpperCase() : null;
  const error = analyses.error || crewState.error;

  function activate(id) {
    setVisited(previous => previous.has(id) ? previous : new Set([...previous, id]));
    setTab(id);
  }

  useEffect(() => {
    const restore = () => {
      activate(tabFromUrl());
      setSelectedCrew(new URLSearchParams(window.location.search).get('crew') || '');
      setTrendTarget(window.location.hash);
    };
    window.addEventListener('hashchange', restore);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('hashchange', restore);
      window.removeEventListener('popstate', restore);
    };
  }, []);

  useEffect(() => { document.title = active.title + ' · GraviTal'; }, [active]);
  useEffect(() => {
    if (!crewId || exampleMode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('crew', crewId);
    window.history.replaceState(null, '', url);
  }, [crewId]);
  useEffect(() => {
    if (tab === 'fuerza' && bodyState.data && (trendTarget === '#trends' || trendTarget === '#hip-bone')) {
      const target = (trendTarget === '#hip-bone' && document.getElementById('chart-hip_bmd-trend')) || document.getElementById('trends');
      target?.scrollIntoView();
    }
  }, [tab, Boolean(bodyState.data), Boolean(data), trendTarget]);

  function select(id, focus = false) {
    if (id !== tab) {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.pushState(null, '', url);
      activate(id);
      setTrendTarget('');
      window.scrollTo({ top: 0, behavior: 'instant' });
    }
    if (focus) tabRefs.current[id]?.focus({ preventScroll: true });
  }

  function navigateTabs(event) {
    const index = TABS.findIndex(item => item.id === tab);
    const next = { ArrowRight: index + 1, ArrowLeft: index - 1, Home: 0, End: TABS.length - 1 }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    select(TABS[(next + TABS.length) % TABS.length].id, true);
  }

  function renderView(id) {
    if (!visited.has(id)) return null;
    if (id === 'ojos' || id === 'venas') {   // the imaging studies read their own JSON from the HealthService
      if (exampleMode) return <div className="flight-notice glass"><Icon name={id} size={26}/><div><strong>{id === 'ojos' ? 'Eye exams' : 'Jugular scans'} unavailable in this example</strong><p>{id === 'ojos' ? 'The eye exam view' : 'The neck vein view'} uses studies from the HealthService. Start the full mission demo to explore this view.</p></div></div>;
      if (!crewId) return <DataNotice error={crewState.error}/>;
      const View = id === 'ojos' ? EyesView : VeinsView;
      return <View key={crewId} apiUrl={apiUrl} crewId={crewId} body={data?.crew.body}/>;
    }
    if (id === 'vitales' || id === 'plan') {
      if (exampleMode) return <div className="flight-notice glass"><Icon name={id} size={26}/><div><strong>{id === 'plan' ? 'Mission plan' : 'Watch readings'} unavailable in this example</strong><p>{id === 'plan' ? 'The mission plan uses scheduled tasks from the Planner.' : 'The wearable view uses readings from the HealthService.'} Start the full mission demo to explore this view.</p></div></div>;
      if (!crewId) return <DataNotice error={crewState.error}/>;
      return id === 'plan' ? <PlanView crew={crewId}/> : <VitalsView vitals={vitals} error={vitalsState.error}/>;
    }
    if (!data) return <DataNotice error={error}/>;
    if (id === 'summary') return <SummaryView sourceLabel={sourceLabel} missionLabel={missionLabel} key={crewId} data={data} crewId={crewId} bodyState={bodyState} exampleMode={exampleMode} vitals={vitals} vitalsError={vitalsState.error}
      onOpen={(destination, key) => {
        if (key) setFocusRequest({ key, request: Date.now() });
        if (destination === 'body') {
          setTrendTarget('#hip-bone');
          window.location.hash = 'hip-bone';
          activate('fuerza');
          tabRefs.current.fuerza?.focus({ preventScroll: true });
        } else select(destination, true);
      }}/>;
    return id === 'fuerza'
      ? <StrengthView key={crewId} data={data} focusRequest={focusRequest} bodyState={bodyState} trendTarget={trendTarget}/>
      : <AerobicView key={crewId} data={data}/>;
  }

  return <div className="vuelo">
    <Backdrop/>
    <a className="flight-skip" href="#flight-content" onClick={event => { event.preventDefault(); document.getElementById('flight-content').focus(); }}>Skip to content</a>
    <header className="flight-bar glass-bar">
      <div className="flight-bar-inner">
        <a className="flight-home" href="#summary" aria-label="GraviTal health overview"><Brand/></a>
        <nav className="flight-navigation" aria-label="Crew health">
          <div className="flight-tabs glass-tabs" role="tablist" aria-label="Health views" onKeyDown={navigateTabs}>
            {TABS.map(t => <button key={t.id} ref={el => { tabRefs.current[t.id] = el; }}
              type="button" role="tab" id={'tab-' + t.id} aria-selected={tab === t.id} aria-controls={'panel-' + t.id}
              tabIndex={tab === t.id ? 0 : -1} onClick={() => select(t.id)}><Icon name={t.id}/>{t.label}</button>)}
          </div>
        </nav>
        {data && <div className="flight-mission">
          <span className="flight-context"><Icon name="plan" size={15}/><span>{data.mission.todayLabel} <small>/ {data.mission.landing} days</small></span></span>
        </div>}
        <div className="flight-crew glass-sm">
          <span className="flight-avatar"><Icon name="crew" size={19}/></span>
          <div><span className="flight-crew-label">Crew member</span>
            {!exampleMode && crewList.length > 0
              ? <select name="crew" aria-label="Crew member" value={selected} onChange={event => { setFocusRequest(null); setSelectedCrew(event.target.value); }}>{crewList.map(id => <option key={id}>{id}</option>)}</select>
              : <strong>{crewId ?? '—'}</strong>}
          </div>
        </div>
      </div>
    </header>
    <main className="flight-content" id="flight-content" tabIndex={-1}>
      {/* The Overview has no visible heading so its cards fit in the first view; the mission line lives in the header. */}
      {tab === 'summary'
        ? <h1 className="flight-sr-only">{active.title}</h1>
        : <div className="flight-heading">
          <div className="flight-heading-main"><h1>{active.title}</h1>
            {data && <span className="flight-source glass-sm"><i/>{sourceLabel}</span>}
          </div>
          {data && <div className="flight-context"><Icon name="orbit" size={22}/><span>{missionLabel}</span></div>}
        </div>}
      {error && data && <div className="flight-notice glass" role="status">Connection lost. Showing the last available measurements.</div>}
      {TABS.map(item => <FlightPanel key={item.id} id={item.id} hidden={tab !== item.id}>{renderView(item.id)}</FlightPanel>)}
    </main>
  </div>;
}
