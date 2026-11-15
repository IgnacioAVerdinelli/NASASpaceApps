import React, { useEffect, useReducer, useRef, useState } from 'react';
import { ATTRIBUTION } from 'open-anatomy-3d';
import BodyViewer from '../body-3d/BodyViewer.jsx';
import { muscles, SURFACE_MUSCLE_KEYS } from '../body-3d/anatomy.js';
import Trends from './Chart.jsx';
import { testModeReducer } from './data/testMode.js';
import './style.css';

export function App({ dashboard, stale = false }) {
  const { body: model, summary, charts, simulated, updatedAt } = dashboard;
  const [localSelection, setLocalSelection] = useState(null);
  const [testMode, dispatchTest] = useReducer(testModeReducer, null);
  const [explorationRequest, setExplorationRequest] = useState({ key: null, request: 0 });
  const dashboardSelection = localSelection && summary.items.some(item => item.muscleKeys.includes(localSelection)) ? localSelection : model.selected;
  const { body, layer, scores } = testMode || model;
  const { viewRequest } = model;
  const selected = testMode ? testMode.selected : dashboardSelection;
  const viewerMode = useRef({ body, layer });
  useEffect(() => {
    if (viewerMode.current.body !== body || viewerMode.current.layer !== layer) {
      viewerMode.current = { body, layer };
      setExplorationRequest(previous => ({ key: null, request: previous.request + 1 }));
    }
  }, [body, layer]);
  useEffect(() => {
    if (localSelection && !summary.items.some(item => item.muscleKeys.includes(localSelection))) setLocalSelection(null);
  }, [localSelection, summary.items]);
  const chooseArea = key => {
    if (!testMode && !summary.items.some(item => item.muscleKeys.includes(key))) return;
    if (testMode) dispatchTest({ type: 'select', value: key }); else setLocalSelection(key);
    if (layer !== 'skeleton' && (layer !== 'surface' || !key || SURFACE_MUSCLE_KEYS.has(key))) {
      setExplorationRequest(previous => ({ key: previous.key === key ? null : key, request: previous.request + 1 }));
    }
  };
  const muscle = muscles.find(item => item.key === selected);
  const value = selected ? scores[selected] : null;
  const relevant = charts.filter(chart => !selected || chart.muscleKeys.length === 0 || chart.muscleKeys.includes(selected));
  return <><main id="top">
    {stale && <div className="connection-notice" role="status">Connection lost. Showing the last available data.</div>}
    <nav className="flight-link" aria-label="In-flight health"><a href="/vuelo.html">Explore recommendations and in-flight measurements →</a></nav>
    <section className="overview" aria-label="Body overview">
      <div className="body-panel"><div className="body-panel-heading"><span>BODY OVERVIEW</span><button type="button" className="test-mode-toggle" aria-pressed={Boolean(testMode)} aria-controls="test-controls" onClick={() => dispatchTest(testMode ? { type: 'exit' } : { type: 'start', model, selected: dashboardSelection })}>{testMode ? 'Exit test mode' : 'Test mode'}</button></div>
        {testMode && <div id="test-controls" className="test-controls" aria-label="Test mode controls"><p>Test mode · Changes are temporary and do not affect dashboard data.</p><div className="test-control-groups"><div role="group" aria-label="Body model">{[['male', 'Male'], ['female', 'Female']].map(([key, name]) => <button type="button" key={key} aria-pressed={body === key} onClick={() => dispatchTest({ type: 'body', value: key })}>{name}</button>)}</div><div role="group" aria-label="Anatomy layer">{[['surface', 'Surface'], ['muscles', 'Muscles'], ['skeleton', 'Bones']].map(([key, name]) => <button type="button" key={key} aria-pressed={layer === key} onClick={() => dispatchTest({ type: 'layer', value: key })}>{name}</button>)}</div><div><button type="button" onClick={() => dispatchTest({ type: 'paint' })}>Paint all</button><button type="button" onClick={() => dispatchTest({ type: 'clear' })}>Clear colors</button></div></div><div className="test-editor"><label>Muscle <select value={selected || ''} onChange={event => chooseArea(event.target.value || null)}><option value="">Select a muscle</option>{muscles.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Intensity <input type="range" min="0" max="100" disabled={!selected} value={selected ? scores[selected] ?? 0 : 0} onChange={event => dispatchTest({ type: 'intensity', value: Number(event.target.value) })}/><output>{selected ? scores[selected] ?? 0 : 0}</output></label></div></div>}
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas"><BodyViewer body={body} layer={layer} scores={scores} selected={selected} onSelect={chooseArea} viewRequest={viewRequest} framing={1.1} showIndicators checkpointItems={summary.items} explorationRequest={explorationRequest}/></div></div><div className="body-caption"><span><i aria-hidden="true" /> Interactive body map</span><span>Select an area to zoom · Select again to return · Drag to rotate</span></div><details className="model-credits"><summary>3D model credits</summary><p><a href="https://github.com/MervinR07/open-anatomy-3d">Open Anatomy 3D</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a><br/>{ATTRIBUTION} Surface regions and materials adapted for this viewer.</p></details></div>
      <div className="summary"><div className="summary-content"><p className="summary-intro">{summary.description}</p>
        <div className="insight-list" role="group" aria-label="Areas to explore">{summary.items.map(item => { const active = Boolean(selected && item.muscleKeys.includes(selected)); return <button type="button" key={item.id} className={'insight-row'+(active?' is-selected':'')} aria-pressed={active} disabled={!item.muscleKeys.length} onClick={() => chooseArea(active ? selected : item.muscleKeys[0])}><span className="insight-marker" aria-hidden="true"/><span className="insight-main"><span className="insight-name">{item.title}</span><span className="insight-detail">{item.description}</span></span><span className="insight-change">{item.changePercent === null ? 'No data' : `${item.changePercent > 0 ? '+' : ''}${item.changePercent}%`}</span></button>; })}</div>
        {muscle && <p className="selected-detail"><strong>{muscle.label}</strong><br/>{testMode ? 'Test intensity' : 'Intensity'}: {value == null ? 'No data' : `${value} / 100`}</p>}
        <p className="note">{simulated ? 'Simulated data. ' : ''}{summary.notice}</p>
        <a className="explore" href="#trends">View trends <span aria-hidden="true">↓</span></a>
      </div><div className="summary-footer"><span>{simulated ? 'SIMULATED DATA' : 'DATA'}</span><span>UPDATED {new Date(updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span></div></div>
    </section>
    <Trends charts={relevant} summary={summary} scores={scores} simulated={simulated}/>
  </main></>;
}
