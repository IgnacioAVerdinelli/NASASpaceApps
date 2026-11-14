import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ANATOMY_STRUCTURES, ATTRIBUTION } from 'open-anatomy-3d';
import BodyViewer, { SURFACE_MUSCLE_KEYS } from './BodyViewer.jsx';
import './style.css';

const muscles = ANATOMY_STRUCTURES.filter(item => item.system === 'muscles');
const initialScores = { quadriceps_l: 78, quadriceps_r: 45, upper_arm_muscles_l: 25, back_muscles_r: 58 };
const label = item => item.label;
const status = value => value === 0 ? 'Sin intensidad' : value < 34 ? 'Baja' : value < 67 ? 'Media' : 'Alta';

function App() {
  const [body, setBody] = useState('male');
  const [scores, setScores] = useState(initialScores);
  const [selected, setSelected] = useState('quadriceps_l');
  const [search, setSearch] = useState('');
  const current = muscles.find(item => item.key === selected) || muscles[0];
  const value = scores[current?.key] || 0;
  const isVisible = SURFACE_MUSCLE_KEYS.has(current?.key);
  const filtered = useMemo(() => muscles.filter(item => label(item).toLowerCase().includes(search.toLowerCase())), [search]);
  const activeCount = Object.values(scores).filter(Boolean).length;

  function setValue(next) { setScores(previous => ({ ...previous, [current.key]: Number(next) })); }

  return <div className="app">
    <header className="topbar"><a className="brand" href="#inicio" aria-label="Atlas muscular, inicio"><span className="brand-mark">✳</span><span>atlas<span className="brand-light"> / muscular</span></span></a><div className="top-right"><span className="demo-pill"><span /> MODO DEMOSTRACIÓN</span><span className="top-caption">Explorador anatómico 3D</span></div></header>
    <main id="inicio" className="workspace">
      <section className="intro"><div><h1>El cuerpo, en detalle.</h1><p>Explorá el modelo y visualizá la intensidad en cada región muscular.</p></div><span className="intro-note">MODELO INTERACTIVO <b> / </b> 3D</span></section>
      <div className="layout">
        <section className="viewer-panel" aria-label="Modelo anatómico 3D">
          <div className="viewer-top"><div><span className="section-label">EXPLORADOR</span><h2>Mapa muscular</h2></div><div className="body-switch" role="group" aria-label="Elegir modelo corporal"><button type="button" aria-pressed={body === 'male'} onClick={() => setBody('male')}>Masculino</button><button type="button" aria-pressed={body === 'female'} onClick={() => setBody('female')}>Femenino</button></div></div>
          <BodyViewer key={body} body={body} scores={scores} selected={current?.key} onSelect={setSelected} />
          <div className="viewer-bottom"><span>Arrastrá para girar <b>·</b> Desplazá para acercar</span><span>Seleccioná una región</span></div>
        </section>
        <aside className="sidebar">
          <div className="sidebar-heading"><span className="section-label">PANEL DE CONTROL</span><h2>Regiones musculares</h2><p>Seleccioná una región para ajustar su intensidad.</p></div>
          <label className="search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar una región" aria-label="Buscar una región muscular" /></label>
          <div className="list-heading"><span>REGIONES DISPONIBLES</span><span>{filtered.length}</span></div>
          <div className="muscle-list" aria-label="Lista de regiones musculares">{filtered.map(item => <button key={item.key} className={'muscle-row' + (current?.key === item.key ? ' selected' : '')} onClick={() => setSelected(item.key)}><span className="row-dot" style={{background: (scores[item.key] || 0) > 66 ? '#c65542' : (scores[item.key] || 0) > 33 ? '#df9b4a' : (scores[item.key] || 0) > 0 ? '#d4bd75' : '#d5d8d3'}} /><span>{label(item)}</span><span className="row-value">{SURFACE_MUSCLE_KEYS.has(item.key) ? (scores[item.key] || 0) : "Sin vista"}</span></button>)}{!filtered.length && <p className="empty">No encontramos regiones con ese nombre.</p>}</div>
          {current && <div className="editor"><div className="editor-title"><div><span className="section-label">REGIÓN SELECCIONADA</span><h3>{label(current)}</h3></div><span className="score">{value}<small>/ 100</small></span></div>{!isVisible && <p className="surface-hint">Esta región no tiene una zona definida en la superficie del modelo.</p>}<label className="range-label" htmlFor="intensity"><span>Intensidad simulada</span><strong>{status(value)}</strong></label><input id="intensity" type="range" min="0" max="100" disabled={!isVisible} value={value} onChange={event => setValue(event.target.value)} /><div className="range-ends"><span>Sin intensidad</span><span>Máxima</span></div></div>}
        </aside>
      </div>
      <section className="foot-row"><div className="legend"><span className="legend-title">ESCALA VISUAL</span><span><i className="dot neutral" /> Sin intensidad</span><span><i className="dot low" /> Baja</span><span><i className="dot medium" /> Media</span><span><i className="dot high" /> Alta</span></div><button className="reset" onClick={() => setScores({})}>Limpiar valores <span>↗</span></button></section>
      <div className="notice"><strong>Datos de demostración.</strong> Los valores y colores son ilustrativos; no representan mediciones ni criterios clínicos. Las regiones son aproximadas; los músculos profundos pueden no verse en la superficie. <span>{activeCount} regiones con intensidad.</span></div>
    </main>
    <div className="credits">{ATTRIBUTION}</div><footer><span>ATLAS MUSCULAR <b> / </b> PROTOTIPO</span><span>Modelo: <a href="https://github.com/MervinR07/open-anatomy-3d" target="_blank" rel="noreferrer">Open Anatomy 3D</a> · <a href="https://github.com/Jsplice/MuscleMap" target="_blank" rel="noreferrer">MuscleMap</a></span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
