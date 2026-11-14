import React from 'react';
import { ATTRIBUTION } from 'open-anatomy-3d';
import BodyViewer from '../body-3d/BodyViewer.jsx';
import { muscles } from '../body-3d/anatomy.js';
import Chart from './Chart.jsx';
import './style.css';

export function App({ dashboard, stale = false }) {
  const { body: model, summary, charts, simulated, updatedAt } = dashboard;
  const { body, layer, selected, scores, viewRequest } = model;
  const muscle = muscles.find(item => item.key === selected);
  const value = selected ? scores[selected] : null;
  const relevant = charts.filter(chart => !selected || chart.muscleKeys.length === 0 || chart.muscleKeys.includes(selected));
  return <><main id="top">
    {stale && <div className="connection-notice" role="status">Connection lost. Showing the last available data.</div>}
    <section className="overview" aria-label="Body overview">
      <div className="body-panel"><div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas"><BodyViewer body={body} layer={layer} scores={scores} selected={selected} viewRequest={viewRequest} framing={1.22} showIndicators/></div></div></div>
      <div className="summary"><div className="summary-content"><h2>{summary.title}</h2><p className="summary-intro">{summary.description}</p>
        <div className="insight-list" aria-label="Areas">{summary.items.map(item => { const active = selected && item.muscleKeys.includes(selected); return <div key={item.id} className={'insight-row'+(active?' is-selected':'')}><span className="insight-marker"/><span className="insight-main"><span className="insight-name">{item.title}</span><span className="insight-detail">{item.description}</span></span><span className="insight-change">{item.changePercent === null ? 'No data' : `${item.changePercent > 0 ? '+' : ''}${item.changePercent}%`}</span></div>; })}</div>
        {muscle && <p className="selected-detail"><strong>{muscle.label}</strong><br/>Intensity: {value == null ? 'No data' : `${value} / 100`}</p>}
        <p className="note">{simulated ? 'Simulated data. ' : ''}{summary.notice}</p>
        {relevant.length > 0 && <a className="explore" href="#trends">View trends <span>↗</span></a>}
      </div><div className="summary-footer"><span>{simulated ? 'SIMULATED DATA' : 'DATA'}</span><span>UPDATED {new Date(updatedAt).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</span></div></div>
    </section>
    <section className="trends" id="trends"><div className="section-heading"><div><h2>Trends</h2></div></div>{relevant.length ? relevant.map(chart => <Chart key={chart.id} chart={chart}/>) : <p className="no-trend">No chart data available for this selection.</p>}</section>
  </main><footer><span className="brand">hbarai<span className="brand-period">.</span></span><p>Designed for the people behind the mission.</p><div>3D MODEL<br/><a href="https://github.com/MervinR07/open-anatomy-3d">Open Anatomy 3D</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a><br/>{ATTRIBUTION} Surface regions and materials adapted for this viewer.</div></footer></>;
}
