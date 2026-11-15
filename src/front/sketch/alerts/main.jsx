import '../fonts/typography.css';
import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Brand } from '../vuelo/Icons.jsx';
import './style.css';

const alerts = [
  { id: 'check-in', priority: 'Critical', level: 'high', time: '09:41', title: 'Check-in requested', short: 'A check-in needs your attention.' },
  { id: 'recovery', priority: 'Warning', level: 'medium', time: '08:15', title: 'Recovery update', short: 'A new update is available.' },
  { id: 'sync', priority: 'Normal', level: 'low', time: 'Yesterday', title: 'Sync complete', short: 'Your data has been synced.' },
];

function Icon({ type }) {
  if (type === 'high') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>;
  if (type === 'medium') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
}

function Arrow({ back = false }) {
  return <svg className={back ? 'arrow back' : 'arrow'} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>;
}

function App() {
  const [selected, setSelected] = useState(alerts[0].id);
  const active = alerts.find(alert => alert.id === selected);
  const choose = id => setSelected(id);

  return <main className="page">
    <header className="header">
      <a className="alert-brand" href={'../' + window.location.search + '#summary'} aria-label="Trama health overview"><Brand/></a>

      <a className="back-link" href={'../' + window.location.search + '#vitales'}><Arrow back /> Vital signs</a>
    </header>

    <section className="experience" aria-label="Wearable alerts demonstration">
      <div className="overview">
        <div className="intro">
          <div className="status"><span /> SIMULATED DEMO</div>
          <h1>Wearable alert simulator</h1>
          <p>Select a fictional alert to see how it appears on the wearable.</p>
        </div>

        <div className="alert-list" role="group" aria-label="Choose an example alert">
          <div className="list-heading"><h2>Example alerts</h2><span>{alerts.length} EXAMPLES</span></div>
          {alerts.map((alert) => <button key={alert.id} type="button" className={'alert-row' + (selected === alert.id ? ' selected' : '')} aria-pressed={selected === alert.id} onClick={() => choose(alert.id)}>
            <span className={'row-icon ' + alert.level}><Icon type={alert.level}/></span>
            <span className="row-copy"><strong>{alert.title}</strong><span>{alert.priority} <span aria-hidden="true">·</span> {alert.time}</span></span>
            <Arrow />
          </button>)}
        </div>
        <p className="disclaimer">For demonstration only. These fictional alerts are not health assessments.</p>
      </div>

      <div className="preview">
        <div className="preview-heading"><span>WEARABLE PREVIEW</span><span className="preview-live"><i /> INTERACTIVE</span></div>
        <div className="watch-scene">
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

  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
