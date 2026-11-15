import React, { useEffect, useRef, useState } from 'react';
import { StrengthView } from '../fuerza/App.jsx';
import { crew } from '../fuerza/data.js';
import { AerobicView } from '../aerobica/AerobicView.jsx';
import '../style.css';
import '../fuerza/style.css';
import './style.css';

// Cada análisis de "Mediciones en vuelo" es una pestaña. Para sumar uno nuevo, agregarlo acá.
const TABS = [
  { id: 'fuerza', label: 'Fuerza muscular', View: StrengthView },
  { id: 'aerobica', label: 'Capacidad aeróbica', View: AerobicView },
];
const fromHash = () => TABS.some(t => `#${t.id}` === window.location.hash) ? window.location.hash.slice(1) : TABS[0].id;

export function Shell() {
  const [tab, setTab] = useState(fromHash);
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
  // Las pestañas inactivas quedan montadas (ocultas): no se recarga el modelo 3D y se conserva su estado.
  return <main className="vuelo">
    <header className="page-head vuelo-head">
      <h1>Mediciones en vuelo</h1>
      <dl className="mission">
        <div><dt>Tripulante</dt><dd>{crew.id} <small>(simulado)</small></dd></div>
        <div><dt>Misión</dt><dd>{crew.missionDays} días</dd></div>
        <div><dt>Hoy</dt><dd>FD {crew.today}</dd></div>
      </dl>
      <div className="tabs" role="tablist" aria-label="Análisis" onKeyDown={onKeyDown}>
        {TABS.map(t => <button key={t.id} ref={el => { tabRefs.current[t.id] = el; }} type="button" role="tab" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} tabIndex={tab === t.id ? 0 : -1} onClick={() => select(t.id)}>{t.label}</button>)}
      </div>
    </header>
    {TABS.map(({ id, View }) => <section key={id} id={`panel-${id}`} role="tabpanel" aria-labelledby={`tab-${id}`} hidden={tab !== id}><View/></section>)}
  </main>;
}
