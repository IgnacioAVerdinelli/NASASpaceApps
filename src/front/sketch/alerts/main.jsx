import '../fonts/typography.css';
import '../theme/glass.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brand } from '../vuelo/Icons.jsx';
import { Backdrop } from '../vuelo/Backdrop.jsx';
import './style.css';

const alerts = [
  { id: 'check-in', priority: 'Critical', level: 'high', time: '09:41', title: 'Check-in requested', short: 'A check-in needs your attention.' },
  { id: 'recovery', priority: 'Warning', level: 'medium', time: '08:15', title: 'Recovery update', short: 'A new update is available.' },
  { id: 'sync', priority: 'Normal', level: 'low', time: 'Yesterday', title: 'Sync complete', short: 'Your data has been synced.' },
];

const ALERT_DOTS = {
  warning: [
    [7, 1], [6, 3], [8, 3], [5, 5], [9, 5], [4, 7], [10, 7],
    [3, 9], [11, 9], [2, 11], [12, 11],
    [1, 13], [3, 13], [5, 13], [7, 13], [9, 13], [11, 13], [13, 13],
    [7, 5], [7, 7], [7, 10],
  ],
  complete: [
    [1, 7], [3, 9], [5, 11], [7, 9], [9, 7], [11, 5], [13, 3],
  ],
};

function Icon({ type }) {
  const dots = ALERT_DOTS[type === 'low' ? 'complete' : 'warning'];
  return <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
    {dots.map(([x, y]) => <rect key={x + '-' + y} x={x} y={y} width="1.5" height="1.5" rx=".2"/>)}
  </svg>;
}

function Arrow({ back = false }) {
  return <svg className={back ? 'arrow back' : 'arrow'} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>;
}

function App() {
  const [selected, setSelected] = useState(alerts[0].id);
  const active = alerts.find(alert => alert.id === selected);
  const choose = id => setSelected(id);

  return <div className="alerts-app">
    <Backdrop/>
    <header className="alerts-bar glass-bar"><div className="alerts-bar-inner">
      <a className="alert-brand" href={'../' + window.location.search + '#summary'} aria-label="GraviTal health overview"><Brand/></a>
      <a className="back-link btn-link" href={'../' + window.location.search + '#vitales'}><Arrow back /> Vital signs</a>
    </div></header>

    <main className="page">
      <div className="page-heading">
        <h1>Wearable alert simulator</h1>
        <span className="chip" data-tone="info">Simulated demo</span>
      </div>

      <section className="experience" aria-label="Wearable alerts demonstration">
        <div className="overview glass">
          <p className="intro">Select a fictional alert to see how it appears on the wearable.</p>

          <div className="alert-list" role="group" aria-label="Choose an example alert">
            <div className="list-heading"><h2>Example alerts</h2><span>{alerts.length} examples</span></div>
            {alerts.map((alert) => <button key={alert.id} type="button" className={'alert-row' + (selected === alert.id ? ' selected' : '')} aria-pressed={selected === alert.id} onClick={() => choose(alert.id)}>
              <span className={'row-icon ' + alert.level}><Icon type={alert.level}/></span>
              <span className="row-copy"><strong>{alert.title}</strong><span>{alert.priority} <span aria-hidden="true">·</span> {alert.time}</span></span>
              <Arrow />
            </button>)}
          </div>
          <p className="disclaimer">For demonstration only. These fictional alerts are not health assessments.</p>
        </div>

        <div className="preview glass">
          <div className="preview-heading"><span className="eyebrow">Wearable preview</span><span className="chip">Interactive</span></div>
          <div className="watch-scene">
            <div className="watch-halo" aria-hidden="true"/>
            <div className="strap strap-top" aria-hidden="true"/><div className="strap strap-bottom" aria-hidden="true"/>
            <div className="watch"><div className={'watch-screen ' + active.level}>
              <div className="watch-top"><span>{active.time}</span><span>{active.priority}</span></div>
              <div className="watch-body" aria-live="polite" key={active.id}>
                <div className="watch-symbol"><Icon type={active.level}/></div>
                <h2>{active.title}</h2>
                <p>{active.short}</p>
              </div>
            </div></div>
          </div>
        </div>
      </section>
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
