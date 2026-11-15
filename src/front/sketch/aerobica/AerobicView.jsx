import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { ChartContainer } from '../components/chart.jsx';
import { LevelBadge } from '../fuerza/App.jsx';
import { crew, fmtPct } from '../fuerza/data.js';
import { NASA_FLOOR, baseline, components, evaluations, fmtNum, maxCriteria, pctOf, reference, upcoming } from './data.js';
import './style.css';

const tick = { fill: '#4f5874', fontSize: 13 };
const CREW = '#2f2850';
const THRESHOLD = '#a4242f';
const FLOOR_COLOR = '#7d1a23';
const REF_COLORS = { CONTROL: '#6d5fb8', EXERCISE: '#0e7490', FLY: '#9096ad' };
const keyToComponent = new Map(components.flatMap(c => c.keys.map(key => [key, c.id])));
const focusKey = { heart: 'heart', blood: 'aorta', muscle: 'quadriceps_l', lungs: 'lung_l' };
const dim = new THREE.Color('#d9dbe6');

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">{row.kind === 'ref'
    ? <><strong>{row.name} · {reference.bedRestDays} días</strong><div>Cambio medio: <b>{fmtPct(row.mean)} ± {fmtNum(row.sd)}</b></div><div>n = {row.n} · {reference.post1}</div><div>Bajo el mínimo NASA: <b>{row.below.pre} → {row.below.post1} de {row.below.n}</b></div></>
    : <><strong>{row.label} · día {row.day}</strong><div>VO₂pico: <b>{fmtNum(row.vo2)} ml/kg/min</b></div><div>Cambio: <b>{fmtPct(pctOf(row.vo2))}</b></div><div>FC pico {row.hrPeak} lpm · RER {fmtNum(row.rer, 2)}</div></>}</div>;
}

function Trajectory({ shown, evalIndex }) {
  const next = [...evaluations.slice(evalIndex + 1).map(e => e.day), ...upcoming.map(u => u.day)];
  const threshold = baseline * 0.8;
  return <ChartContainer config={{}} className="detail-chart"><ComposedChart data={shown} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
    <ReferenceLine y={baseline} stroke="#9096ad" strokeDasharray="2 4" label={{ value: `Pre-vuelo ${fmtNum(baseline)}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
    <ReferenceLine y={threshold} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: `−20 % (${fmtNum(threshold)})`, position: 'insideTopRight', fill: THRESHOLD, fontSize: 12 }}/>
    <ReferenceLine y={NASA_FLOOR} stroke={FLOOR_COLOR} strokeWidth={1.5} label={{ value: `Mínimo NASA ${fmtNum(NASA_FLOOR)}`, position: 'insideBottomLeft', fill: FLOOR_COLOR, fontSize: 12 }}/>
    <ReferenceLine x={crew.today} stroke="#a7a3c4" strokeDasharray="2 4" label={{ value: `Hoy FD ${crew.today}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
    {next.map(day => <ReferenceLine key={day} x={day} stroke="#d4d0ea" strokeDasharray="1 5"/>)}
    <XAxis dataKey="day" type="number" domain={[0, crew.missionDays]} ticks={[0, 30, 60, 90, 120, 150, 180]} tickFormatter={d => d === 0 ? 'Pre' : `FD ${d}`} tick={tick} axisLine={false} tickLine={false}/>
    <YAxis domain={[25, 50]} ticks={[25, 30, 35, 40, 45, 50]} tick={tick} axisLine={false} tickLine={false} width={40} label={{ value: 'ml/kg/min', angle: -90, position: 'insideLeft', fill: '#4f5874', fontSize: 12, dx: -2, dy: 30 }}/>
    <Tooltip content={<Tip/>} cursor={{ stroke: '#a49acb', strokeDasharray: '3 4' }}/>
    <Line dataKey="vo2" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
  </ComposedChart></ChartContainer>;
}

function ReferenceStrip({ latestPct }) {
  const refs = Object.entries(reference.byGroup).map(([key, g]) => ({
    kind: 'ref', key, name: reference.groups[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n, err: g.post1_pct.sd, below: g.below_floor,
  }));
  return <ChartContainer config={{}} className="detail-chart"><ComposedChart data={refs} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
    <ReferenceLine y={0} stroke="#c9ccd9"/>
    <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4"/>
    <ReferenceLine y={latestPct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Tripulante ${fmtPct(latestPct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>
    <XAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
    <YAxis domain={[-40, 10]} ticks={[10, 0, -10, -20, -30, -40]} tickFormatter={v => `${v} %`} tick={tick} axisLine={false} tickLine={false} width={48}/>
    <Tooltip content={<Tip/>} cursor={false}/>
    <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={8} fill={REF_COLORS[props.payload.key]} stroke="#fff" strokeWidth={2}/>}>
      <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={2} stroke="#7c8299"/>
    </Scatter>
  </ComposedChart></ChartContainer>;
}

export function AerobicView() {
  const [evalIndex, setEvalIndex] = useState(evaluations.length - 1);
  const [selected, setSelected] = useState(null);
  const [exploration, setExploration] = useState({ key: null, request: 0 });
  const current = evaluations[evalIndex];
  const pct = pctOf(current.vo2);
  const shown = evaluations.slice(0, evalIndex + 1);
  const component = components.find(c => c.id === selected);

  // Color de cada estructura: el componente elegido a pleno, el resto atenuado.
  const structureColors = useMemo(() => Object.fromEntries(components.flatMap(c => {
    const color = new THREE.Color(c.color);
    if (selected && selected !== c.id) color.lerp(dim, 0.7);
    return c.keys.map(key => [key, `#${color.getHexString()}`]);
  })), [selected]);

  // Igual que en fuerza: enfoca el componente elegido; elegirlo de nuevo vuelve al cuerpo entero.
  const choose = id => {
    if (!components.some(c => c.id === id)) return;
    setSelected(prev => prev === id ? null : id);
    const key = focusKey[id];
    setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
  };
  const chooseFromBody = key => { const id = keyToComponent.get(key); if (id) choose(id); };

  // Los gráficos esperan a que termine el movimiento de cámara (500 ms).
  const [chartsIndex, setChartsIndex] = useState(evalIndex);
  useEffect(() => {
    if (chartsIndex === evalIndex) return undefined;
    const timer = setTimeout(() => setChartsIndex(evalIndex), 120);
    return () => clearTimeout(timer);
  }, [evalIndex, chartsIndex]);

  return <div className="aerobica">
    <section className="overview fuerza-overview" aria-label="Recorrido del oxígeno">
      <div className="body-panel">
        <div className="body-panel-heading"><span>RECORRIDO DEL OXÍGENO · {current.label.toUpperCase()}</span><span>Órganos que determinan el VO₂pico</span></div>
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body="male" layer="organs" structureColors={structureColors} selected={component ? focusKey[component.id] : null} onSelect={chooseFromBody} framing={1.1} explorationRequest={exploration}/>
        </div></div>
        <ul className="component-legend" aria-label="Componentes">
          {components.map(c => <li key={c.id}><button type="button" aria-pressed={selected === c.id} onClick={() => choose(c.id)}><i style={{ background: c.color }} aria-hidden="true"/>{c.name}</button></li>)}
        </ul>
        <div className="timeline" role="group" aria-label="Evaluación a mostrar">
          <span className="timeline-label">Prueba en cicloergómetro a bordo</span>
          <ol style={{ '--progress': `${evalIndex / (evaluations.length + upcoming.length - 1) * 100}%` }}>
            {evaluations.map((e, i) => <li key={e.id} className={(i === evalIndex ? 'on ' : '') + (i < evalIndex ? 'done' : '')}><button type="button" aria-pressed={i === evalIndex} onClick={() => setEvalIndex(i)}>{e.label}</button></li>)}
            {upcoming.map(u => <li key={u.day} className="next">{u.label}<small>próxima</small></li>)}
          </ol>
        </div>
      </div>

      <div className="summary">
        <div className="summary-content">
          <div className="vo2-figure">
            <span className="vo2-label">VO₂pico · {current.label}</span>
            <strong>{fmtNum(current.vo2)} <small>ml/kg/min</small></strong>
            <span className="vo2-change">{fmtPct(pct)} respecto del pre-vuelo ({fmtNum(baseline)})</span>
            <LevelBadge pct={pct}/>
            <span className="vo2-floor">Margen sobre el mínimo NASA ({fmtNum(NASA_FLOOR)}): <b>{current.vo2 >= NASA_FLOOR ? '+' : '−'}{fmtNum(Math.abs(current.vo2 - NASA_FLOOR))} ml/kg/min</b></span>
          </div>
          <p className="summary-intro">El VO₂pico depende de cuánta sangre bombea el corazón y de cuánto oxígeno extraen los músculos. Seleccioná un componente para ver qué le hace la microgravedad.</p>
          <div className="insight-list" role="group" aria-label="Componentes del VO₂pico">
            {components.map(c => {
              const active = selected === c.id;
              return <button type="button" key={c.id} className={'insight-row' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(c.id)}>
                <span className="insight-marker" aria-hidden="true" style={{ background: c.color }}/>
                <span className="insight-main"><span className="insight-name">{c.name}</span><span className="insight-detail">{c.role}</span>
                  {active && <span className="component-detail"><span>{c.effect}</span><span><b>Evidencia:</b> {c.evidence}</span><span><b>¿Se mide en vuelo?</b> {c.measured}</span></span>}
                </span>
              </button>;
            })}
          </div>
          <p className="note">Datos del tripulante simulados. La referencia es CFT70 (reposo en cama, voluntarios en Tierra). Esta vista informa cambios; no constituye un diagnóstico.</p>
        </div>
      </div>
    </section>

    <section className="detail" aria-labelledby="aero-detail-title">
      <header className="detail-head">
        <div><h2 id="aero-detail-title">Capacidad aeróbica (VO₂pico)</h2><p className="detail-sub">Prueba de esfuerzo máximo en cicloergómetro CEVIS con analizador de gases PFS</p></div>
      </header>
      <div className="detail-charts">
        <figure className="panel">
          <figcaption><h3>Evolución a bordo</h3><p>VO₂pico en ml/kg/min en cada prueba. Líneas: valor previo al vuelo, umbral de −20 % y mínimo operativo de NASA. Datos del tripulante simulados.</p></figcaption>
          <Trajectory shown={evaluations.slice(0, chartsIndex + 1)} evalIndex={chartsIndex}/>
          <p className="chart-note">Líneas punteadas verticales: próximas pruebas (FD 165 y R−14, OCHMO-STD-100.1A Tabla 8).</p>
        </figure>
        <figure className="panel">
          <figcaption><h3>Referencia: CFT70</h3><p>Cambio del VO₂pico al terminar {reference.bedRestDays} días de reposo en cama ({reference.post1}), media ± DE.</p></figcaption>
          <ReferenceStrip latestPct={pctOf(evaluations[chartsIndex].vo2)}/>
          <p className="chart-note">Sin contramedida, 9 de 10 voluntarios quedaron bajo el mínimo NASA; con ejercicio, 3 de 19.</p>
        </figure>
      </div>

      <div className="panel validity">
        <h3>Validez de cada prueba</h3>
        <p className="validity-sub">Una prueba cuenta como máxima si el cociente respiratorio (RER) llega a 1,1 y el esfuerzo percibido (Borg) a 17. Si no, el VO₂pico real puede ser mayor que el registrado.</p>
        <div className="table-scroll"><table>
          <thead><tr><th scope="col">Prueba</th><th scope="col">VO₂pico</th><th scope="col">Cambio</th><th scope="col">FC pico</th><th scope="col">Carga</th>{maxCriteria.map(c => <th scope="col" key={c.id}>{c.label}</th>)}<th scope="col">Motivo de corte</th><th scope="col">Medición</th></tr></thead>
          <tbody>{shown.map(e => <tr key={e.id} className={e.id === current.id ? 'is-current' : ''}>
            <th scope="row">{e.label}</th><td>{fmtNum(e.vo2)}</td><td>{fmtPct(pctOf(e.vo2))}</td><td>{e.hrPeak} lpm</td><td>{e.watts} W</td>
            {maxCriteria.map(c => <td key={c.id}><span className={'check ' + (c.ok(e) ? 'ok' : 'no')}>{c.value(e)} · {c.ok(e) ? 'cumple' : 'no cumple'}</span></td>)}
            <td>{e.stop}</td><td>{e.method === 'medido' ? 'Medido (gases)' : 'Estimado (FC)'}</td>
          </tr>)}</tbody>
        </table></div>
      </div>
    </section>

    <section className="method" aria-labelledby="aero-method-title">
      <h2 id="aero-method-title">Cómo se obtiene la medición</h2>
      <p className="lede">El VO₂pico es el máximo de oxígeno que el cuerpo consume en un esfuerzo. Resume el estado del corazón, la sangre y los músculos en un solo número, y es el indicador que NASA usa para decidir si un tripulante puede realizar tareas exigentes, como una caminata espacial o una evacuación de emergencia.</p>
      <div className="method-grid">
        <div><h3>Equipo</h3><p>Cicloergómetro <b>CEVIS</b> (la carga no depende de la cadencia) y analizador de gases <b>PFS</b>, que mide respiración a respiración el O₂ y el CO₂. ECG para la FC y manguito para la presión. Es un procedimiento actual de NASA en la ISS.</p></div>
        <div><h3>Protocolo</h3><p>Carga creciente por etapas hasta el agotamiento. VO₂ = ventilación × (O₂ inspirado − O₂ espirado). Se valida como máxima con RER ≥ 1,1 y Borg ≥ 17. Si el PFS no está disponible, se estima con la relación FC–VO₂ y se marca como estimado.</p></div>
        <div><h3>Calendario</h3><p>OCHMO-STD-100.1A Tabla 8 [6028]: antes del vuelo (L-90/30), en vuelo FD 14, FD 75, FD 165, FD 255 y R−14; después, R+5 y R+30. En la ISS la mayor caída aparece al inicio (~17 %) y se recupera en parte (Moore y col. 2014).</p></div>
        <div><h3>Referencia y límites</h3><p>CFT70: 38 voluntarios, 70 días de reposo en cama, grupos sin contramedida, con ejercicio y FLY; 37 de 38 son hombres. En 4 sujetos se corrigieron columnas corridas del archivo original. En Campaign 3, la estimación por FC erró en promedio un 23 % frente al valor medido.</p></div>
      </div>
      <p className="source">Fuente de referencia: {reference.source}.</p>
    </section>
  </div>;
}
