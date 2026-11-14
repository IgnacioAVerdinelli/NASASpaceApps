import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
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
      <a className="brand" href="../">HBARAI<span>.</span></a>
      <span className="header-title">Wearable experience</span>
      <a className="back-link" href="../"><Arrow back /> Body overview</a>
    </header>

    <section className="experience" aria-label="Wearable alerts demonstration">
      <div className="overview">
        <div className="intro">
          <div className="status"><span /> SIMULATED EXPERIENCE</div>
          <h1>Clarity when<br /><em>it matters.</em></h1>
          <p>Important updates, thoughtfully delivered to your wrist. Select an example to explore the alert.</p>
        </div>

        <div className="alert-list" role="group" aria-label="Choose an example alert">
          <div className="list-heading"><h2>Example alerts</h2><span>{alerts.length} SCENARIOS</span></div>
          {alerts.map((alert, index) => <button key={alert.id} type="button" className={'alert-row' + (selected === alert.id ? ' selected' : '')} aria-pressed={selected === alert.id} onClick={() => choose(alert.id)}>
            <span className={'row-icon ' + alert.level}><Icon type={alert.level}/></span>
            <span className="row-copy"><strong>{alert.title}</strong><span>{alert.priority} <span aria-hidden="true">·</span> {alert.time}</span></span>
            <span className="row-number">0{index + 1}</span><Arrow />
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
        <div className="preview-footer"><span>DESIGNED FOR A QUICK GLANCE</span><span>SELECT AN ALERT TO PREVIEW <Arrow /></span></div>
      </div>
    </section>
    <footer><span>HBARAI <span className="brand-dot">·</span> WEARABLE CONCEPT</span><span>SIMULATED DATA</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
