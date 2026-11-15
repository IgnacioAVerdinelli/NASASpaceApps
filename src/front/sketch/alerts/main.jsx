import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { request, presentation } from './api.js';
import './style.css';

function Icon({ type }) {
  if (type === 'high') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>;
  if (type === 'medium') return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3 2.7 19h18.6L12 3Z"/><path d="M12 9v4.5M12 16.5h.01"/></svg>;
  return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>;
}

function Arrow({ back = false }) {
  return <svg className={back ? 'arrow back' : 'arrow'} viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10h12m-5-5 5 5-5 5"/></svg>;
}

function App() {
  const [crew, setCrew] = useState('CM-1');
  const [alerts, setAlerts] = useState([]);
  const [selected, setSelected] = useState(null);
  const [demo, setDemo] = useState(null);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setAlerts([]); setSelected(null); setLoading(true); setConnected(false); setActionError('');
  }, [crew]);
  useEffect(() => {
    const controller = new AbortController();
    let timer;
    async function poll() {
      try {
        const [inbox, state] = await Promise.all([
          request(`/notifications?crew=${encodeURIComponent(crew)}`, undefined, controller.signal),
          request('/demo/state', undefined, controller.signal),
        ]);
        if (controller.signal.aborted) return;
        const items = inbox.notifications.map(presentation).sort((a, b) =>
          ({ critical: 0, warning: 1, info: 2 }[a.priority] - { critical: 0, warning: 1, info: 2 }[b.priority]) || b.id - a.id);
        setAlerts(items); setDemo(state); setError(''); setConnected(true);
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(err.message); setConnected(false);
      } finally {
        if (!controller.signal.aborted) { setLoading(false); timer = setTimeout(poll, 800); }
      }
    }
    poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [crew, refresh]);
  const newestCritical = alerts.find(alert => alert.priority === 'critical')?.id;
  useEffect(() => { if (newestCritical) setSelected(newestCritical); }, [newestCritical]);
  const active = alerts.find(alert => alert.id === selected) || alerts[0];
  const choose = id => setSelected(id);
  async function action(path, body) {
    setBusy(true); setActionError('');
    try { await request(path, body); setRefresh(value => value + 1); }
    catch (err) { setActionError(err.message); }
    finally { setBusy(false); }
  }

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
          <p>Mensajes de la cola local, enviados a Tierra y a bordo en el mismo ciclo. Todos los datos y canales son simulados.</p>
        </div>

        <div className="demo-controls">
          <label>Reloj de <select value={crew} onChange={event => setCrew(event.target.value)}>
            {(demo?.crew || ['CM-1', 'CM-2', 'CM-3']).map(who => <option key={who}>{who}</option>)}
          </select></label>
          <p role="status">{loading ? 'Conectando…' : connected ? 'Servicio local conectado · horas UTC' : 'Servicio desconectado · últimos mensajes recibidos'}</p>
          <div className="scenario-buttons">
            {Object.entries(demo?.scenarios || {}).map(([key, label]) => <button key={key} disabled={busy || !connected} onClick={() => action('/demo/scenarios', { scenario: key, crew_id: crew })}>{label}</button>)}
          </div>
          {demo && <label><input type="checkbox" checked={demo.channels.earth} disabled={busy || !connected}
            onChange={event => {
              const available = event.target.checked;
              setDemo(previous => ({ ...previous, channels: { ...previous.channels, earth: available } }));
              action('/demo/channels', { channel: 'earth', available });
            }}/> Enlace Tierra disponible (simulado)</label>}
          {(error || actionError) && <p className="api-error" role="alert">{actionError || error}</p>}
        </div>

        <div className="alert-list" role="group" aria-label="Choose an example alert">
          <div className="list-heading"><h2>Bandeja de {crew}</h2><span>{alerts.length} AVISOS</span></div>
          {!alerts.length && <p className="empty-inbox">{loading ? 'Cargando mensajes…' : 'Sin avisos. Publicá un escenario para probar la cola.'}</p>}
          {alerts.map((alert, index) => <button key={alert.id} type="button" className={'alert-row' + (active?.id === alert.id ? ' selected' : '')} aria-pressed={active?.id === alert.id} onClick={() => choose(alert.id)}>
            <span className={'row-icon ' + alert.level}><Icon type={alert.level}/></span>
            <span className="row-copy"><strong>{alert.title}</strong><span>{alert.priorityLabel} · {alert.time} UTC{alert.acknowledged_at ? ' · Recibido' : ''}</span></span>
            <span className="row-number">0{index + 1}</span><Arrow />
          </button>)}
        </div>
        <p className="disclaimer">For demonstration only. These fictional alerts are not health assessments.</p>
      </div>

      <div className="preview">
        <div className="preview-heading"><span>WEARABLE PREVIEW</span><span className="preview-live"><i /> INTERACTIVE</span></div>
        <div className="watch-scene">
          <div className="strap strap-top" aria-hidden="true"/><div className="strap strap-bottom" aria-hidden="true"/>
          <div className="watch"><div className={'watch-screen ' + (active?.level || 'low')}>
            <div className="watch-top"><span>{active?.time || '—'} UTC</span><span>{active?.priorityLabel || crew}</span></div>
            <div className="watch-body" aria-live="polite" key={active?.id || 'empty'}>
              <div className="watch-symbol"><Icon type={active?.level || 'low'}/></div>
              <h2>{active?.title || 'Sin avisos'}</h2>
              <p>{active?.message || 'Esperando mensajes de la cola local.'}</p>
            </div>
            {active?.requires_ack && <button className="watch-action" disabled={busy || !connected || !!active.acknowledged_at}
              onClick={() => action(`/deliveries/${active.id}/ack`, { crew_id: crew })}>{active.acknowledged_at ? 'Recepción confirmada' : 'Confirmar recepción'}</button>}
          </div></div>
        </div>
        <div className="preview-footer"><span>DESIGNED FOR A QUICK GLANCE</span><span>SELECT AN ALERT TO PREVIEW <Arrow /></span></div>
      </div>
    </section>
    <footer><span>HBARAI <span className="brand-dot">·</span> WEARABLE CONCEPT</span><span>SIMULATED DATA</span></footer>
  </main>;
}

createRoot(document.getElementById('root')).render(<App/>);
