import React, { useMemo, useReducer, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ATTRIBUTION } from 'open-anatomy-3d';
import BodyViewer from '../body-3d/BodyViewer.jsx';
import { muscles, SURFACE_MUSCLE_KEYS, intensityColor, intensityLabel } from '../body-3d/anatomy.js';
import { scoresReducer } from './scores.js';
import './style.css';

const initialScores = { quadriceps_l: 78, quadriceps_r: 45, upper_arm_muscles_l: 25, back_muscles_r: 58 };
const label = item => item.label;

function App() {
  const [body, setBody] = useState('male');
  const [{ scores, savedScores }, dispatchScores] = useReducer(scoresReducer, { scores: initialScores, savedScores: null });
  const testing = savedScores !== null;
  const [selected, setSelected] = useState('quadriceps_l');
  const [search, setSearch] = useState('');
  const [layer, setLayer] = useState('surface');
  const [isolated, setIsolated] = useState(false);
  const [focusRequest, setFocusRequest] = useState(0);
  const current = muscles.find(item => item.key === selected) || muscles[0];
  const value = scores[current?.key] || 0;
  const isVisible = SURFACE_MUSCLE_KEYS.has(current?.key);
  const filtered = useMemo(() => muscles.filter(item => label(item).toLowerCase().includes(search.toLowerCase())), [search]);
  const activeCount = Object.values(scores).filter(Boolean).length;

  function changeLayer(next) { setLayer(next); if (next !== 'muscles') setIsolated(false); }
  function setValue(next) { dispatchScores({ type: 'set', key: current.key, value: Number(next) }); }

  return <div className="app">
    <header className="topbar"><a className="brand" href="#inicio" aria-label="Atlas muscular, inicio"><span className="brand-mark">✳</span><span>atlas<span className="brand-light"> / muscular</span></span></a><div className="top-right"><span className="demo-pill"><span /> MODO DEMOSTRACIÓN</span><span className="top-caption">Explorador anatómico 3D</span></div></header>
    <main id="inicio" className="workspace">
      <section className="intro"><div><h1>El cuerpo, en detalle.</h1><p>Explorá el modelo y visualizá la intensidad en cada región muscular.</p></div><span className="intro-note">MODELO INTERACTIVO <b> / </b> 3D</span></section>
      <div className="layout">
        <section className="viewer-panel" aria-label="Modelo anatómico 3D">
          <div className="viewer-top"><div><h2>Mapa muscular</h2></div><div className="body-switch" role="group" aria-label="Elegir modelo corporal"><button type="button" aria-pressed={body === 'male'} onClick={() => setBody('male')}>Masculino</button><button type="button" aria-pressed={body === 'female'} onClick={() => setBody('female')}>Femenino</button></div></div>
          <div className="viewer-controls">
            <div className="layer-switch" role="group" aria-label="Capa anatómica">{[['surface', 'Superficie'], ['muscles', 'Músculos'], ['skeleton', 'Huesos']].map(([key, name]) => <button type="button" key={key} aria-pressed={layer === key} onClick={() => changeLayer(key)}>{name}</button>)}</div>
            <div className="viewer-actions"><button type="button" className="test-toggle" aria-pressed={testing} onClick={() => dispatchScores({ type: 'toggle-test' })}>{testing ? 'Salir del testeo' : 'Modo de testeo'}</button>{layer === 'muscles' && <button type="button" aria-pressed={isolated} onClick={() => setIsolated(!isolated)}>Aislar selección</button>}<button type="button" disabled={layer === 'skeleton' || (layer === 'surface' && !isVisible)} onClick={() => setFocusRequest(previous => previous + 1)}>Centrar selección</button></div>
          </div>
          <div className="body-viewer"><BodyViewer body={body} scores={scores} selected={current?.key} onSelect={setSelected} layer={layer} isolated={isolated} focusRequest={focusRequest} /></div>
          <div className="viewer-bottom"><span>Arrastrá para girar <b>·</b> Desplazá para acercar</span><span>Seleccioná una región</span></div>
        </section>
        <aside className="sidebar">
          <div className="sidebar-heading"><h2>Regiones musculares</h2><p>Seleccioná una región para ajustar su intensidad.</p></div>
          <label className="search"><span aria-hidden="true">⌕</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar una región" aria-label="Buscar una región muscular" /></label>
          <div className="list-heading"><span>REGIONES DISPONIBLES</span><span>{filtered.length}</span></div>
          <div className="muscle-list" aria-label="Lista de regiones musculares">{filtered.map(item => <button key={item.key} className={'muscle-row' + (current?.key === item.key ? ' selected' : '')} aria-pressed={current?.key === item.key} onClick={() => setSelected(item.key)}><span className="row-dot" style={{background: `#${intensityColor(scores[item.key] || 0).getHexString()}`}} /><span>{label(item)}</span><span className="row-value">{scores[item.key] || 0}{!SURFACE_MUSCLE_KEYS.has(item.key) && <small> · Solo músculos</small>}</span></button>)}{!filtered.length && <p className="empty">No encontramos regiones con ese nombre.</p>}</div>
          {current && <div className="editor"><div className="editor-title"><div><h3>{label(current)}</h3></div><span className="score">{value}<small>/ 100</small></span></div>{!isVisible && <p className="surface-hint">Esta región no tiene una zona definida en la superficie del modelo. {layer === 'surface' && <button type="button" className="text-button" onClick={() => changeLayer('muscles')}>Ver en músculos</button>}</p>}<label className="range-label" htmlFor="intensity"><span>Intensidad simulada</span><strong>{intensityLabel(value)}</strong></label><input id="intensity" type="range" min="0" max="100" value={value} onChange={event => setValue(event.target.value)} /><div className="range-ends"><span>Sin intensidad</span><span>Máxima</span></div></div>}
        </aside>
      </div>
      <section className="foot-row"><div className="legend"><span className="legend-title">ESCALA VISUAL</span>{[0, 25, 50, 100].map(score => <span key={score}><i className="dot" style={{ background: `#${intensityColor(score).getHexString()}` }} /> {score} · {intensityLabel(score)}</span>)}</div><button className="reset" onClick={() => dispatchScores({ type: 'clear' })}>Limpiar valores <span>↗</span></button></section>
      <div className="notice"><strong>{testing ? 'Modo de testeo activo.' : 'Datos de demostración.'}</strong> Los valores y colores son ilustrativos; no representan mediciones ni criterios clínicos. Las regiones son aproximadas; los músculos profundos pueden no verse en la superficie. <span>{activeCount} regiones con intensidad.</span></div>
    </main>
    <div className="credits">{ATTRIBUTION} Mapas de superficie y materiales adaptados para este visor. <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Licencia CC BY 4.0</a>.</div><footer><span>ATLAS MUSCULAR <b> / </b> PROTOTIPO</span><span>Modelo: <a href="https://github.com/MervinR07/open-anatomy-3d" target="_blank" rel="noreferrer">Open Anatomy 3D</a> · <a href="https://github.com/Jsplice/MuscleMap" target="_blank" rel="noreferrer">MuscleMap</a></span></footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
