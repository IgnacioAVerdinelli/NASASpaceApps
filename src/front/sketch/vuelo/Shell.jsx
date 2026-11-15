import React, { useEffect, useRef, useState } from 'react';
import { StrengthView } from '../fuerza/App.jsx';
import { crew, groups } from '../fuerza/data.js';
import { AerobicView } from '../aerobica/AerobicView.jsx';
import { dayDistance, exampleRecommendations, timelineItems, updateStatus } from './recommendations.js';
import '../style.css';
import '../fuerza/style.css';
import './style.css';

const TABS = [
  { id: 'recommendations', label: 'Recommendations' },
  { id: 'fuerza', label: 'Muscle strength', View: StrengthView },
  { id: 'aerobica', label: 'Aerobic capacity', View: AerobicView },
];
const fromHash = () => TABS.some(t => `#${t.id}` === window.location.hash) ? window.location.hash.slice(1) : window.location.pathname.endsWith('/fuerza.html') ? 'fuerza' : TABS[0].id;

export function Shell() {
  const [tab, setTab] = useState(fromHash);
  const [items, setItems] = useState(() => exampleRecommendations(crew, groups));
  const [selectedId, setSelectedId] = useState(() => exampleRecommendations(crew, groups)[0]?.id);
  const [focusRequest, setFocusRequest] = useState(null);
  const tabRefs = useRef({});
  useEffect(() => {
    const onHash = () => setTab(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  const select = (id, focus = false) => {
    if (id !== tab) { window.history.replaceState(null, '', `#${id}`); window.scrollTo({ top: 0 }); }
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
  const selected = items.find(item => item.id === selectedId) || items[0];
  const next = items.filter(item => Number.isFinite(item.day) && item.day >= crew.today).sort((a, b) => a.day - b.day)[0];
  return <main className="vuelo">
    <header className="page-head vuelo-head">
      <div><a className="overview-link" href="/">← Body overview</a><h1>In-flight health</h1></div>
      <dl className="mission">
        <div><dt>Crew member</dt><dd>{crew.id} <small>(simulated)</small></dd></div>
        <div><dt>Mission</dt><dd>{crew.missionDays} days</dd></div>
        <div><dt>Today</dt><dd>FD {crew.today}</dd></div>
      </dl>
      <div className="tabs" role="tablist" aria-label="Health views" onKeyDown={onKeyDown}>
        {TABS.map(t => <button key={t.id} ref={el => { tabRefs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => select(t.id)}>{t.label}</button>)}
      </div>
    </header>
    <section id="panel-recommendations" role="tabpanel" aria-labelledby="tab-recommendations" hidden={tab !== 'recommendations'} className="recommendations">
      <div className="recommendations-header"><div><h2>Recommendations</h2><p>Example actions based on simulated mission data.</p></div><span className="demo-label">SIMULATED EXAMPLE</span></div>
      <p className="recommendations-intro">Select a measurement to see why it is on the mission timeline.</p>
      {items.length === 0 ? <p>No recommendations available.</p> : <>
        <div className="mission-timeline" aria-label="Mission measurement timeline">
          <div className="timeline-heading"><h3>Mission timeline</h3><span>Sequence shown · spacing is not to scale</span></div>
          <ol className={'mission-events' + (items.length > 3 ? ' many-events' : '')}>{timelineItems(items, crew.today).map(item => item.today ? <li key={item.id} className="mission-event today-event">
            <div className="event-node" aria-hidden="true"/><div className="event-content"><span className="event-day">FD {item.day}</span><strong>Today</strong><span className="event-distance">Mission day</span></div>
          </li> : <li key={item.id} className={'mission-event' + (item.id === next?.id ? ' is-next' : '')}>
            <div className={'event-node ' + (item.type === 'Follow-up' ? 'follow-up-node' : 'routine-node')} aria-hidden="true"/>
            <button type="button" className="event-button" aria-pressed={selected?.id === item.id} onClick={() => setSelectedId(item.id)}>
              <span className="event-day">{Number.isFinite(item.day) ? `FD ${item.day}` : 'Date unavailable'}</span>
              <span className="event-type">{item.type || 'Measurement'}{item.id === next?.id ? ' · NEXT' : ''}</span>
              <strong>{item.title || 'Measurement unavailable'}</strong><span className="event-distance">{dayDistance(item.day, crew.today)} · {item.status}</span>
            </button>
          </li>)}</ol>
        </div>
        {selected && <article className="recommendation-detail" aria-labelledby="recommendation-detail-title">
          <div className="detail-date"><span>{Number.isFinite(selected.day) ? `FD ${selected.day}` : 'Date unavailable'}</span><strong>{dayDistance(selected.day, crew.today)}</strong><small>{selected.type || 'Measurement'}</small></div>
          <div className="detail-content"><h3 id="recommendation-detail-title">{selected.title || 'Measurement unavailable'}</h3>
            <p className="recommendation-crew">Crew member · {selected.crew || 'Unavailable'}</p>
            <p className="recommendation-reason"><strong>Why this measurement</strong><br/>{selected.reason || 'No reason available.'}</p>
            <div className="recommendation-actions"><label>Status <select value={selected.status} onChange={event => setItems(current => updateStatus(current, selected.id, event.target.value))}><option>Scheduled</option><option>Pending</option><option>Completed</option></select></label>
              {selected.view && <button type="button" onClick={() => { setFocusRequest(selected.muscle ? { key: selected.muscle, request: Date.now() } : null); select(selected.view, true); }}>View related measurement <span aria-hidden="true">→</span></button>}
            </div>
          </div>
        </article>}
      </>}
      <p className="recommendations-note">Illustrative recommendations, not scheduler output or clinical guidance. Status changes reset when the page is reloaded.</p>
    </section>
    {TABS.filter(t => t.View).map(({ id, View }) => <section key={id} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={tab !== id}><View focusRequest={id === 'fuerza' ? focusRequest : null}/></section>)}
  </main>;
}
