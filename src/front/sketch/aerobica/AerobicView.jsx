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
    ? <><strong>{row.name} · {reference.bedRestDays} days</strong><div>Mean change: <b>{fmtPct(row.mean)} ± {fmtNum(row.sd)}</b></div><div>n = {row.n} · {reference.post1.replace(' a ', ' to ')}</div><div>Below NASA minimum: <b>{row.below.pre} → {row.below.post1} of {row.below.n}</b></div></>
    : <><strong>{row.label} · day {row.day}</strong><div>VO₂peak: <b>{fmtNum(row.vo2)} ml/kg/min</b></div><div>Change: <b>{fmtPct(pctOf(row.vo2))}</b></div><div>Peak HR {row.hrPeak} bpm · RER {fmtNum(row.rer, 2)}</div></>}</div>;
}

function Trajectory({ shown, evalIndex }) {
  const next = [...evaluations.slice(evalIndex + 1).map(e => e.day), ...upcoming.map(u => u.day)];
  const threshold = baseline * 0.8;
  return <ChartContainer config={{}} className="detail-chart"><ComposedChart data={shown} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
    <ReferenceLine y={baseline} stroke="#9096ad" strokeDasharray="2 4" label={{ value: `Pre-flight ${fmtNum(baseline)}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
    <ReferenceLine y={threshold} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: `−20 % (${fmtNum(threshold)})`, position: 'insideTopRight', fill: THRESHOLD, fontSize: 12 }}/>
    <ReferenceLine y={NASA_FLOOR} stroke={FLOOR_COLOR} strokeWidth={1.5} label={{ value: `NASA minimum ${fmtNum(NASA_FLOOR)}`, position: 'insideBottomLeft', fill: FLOOR_COLOR, fontSize: 12 }}/>
    <ReferenceLine x={crew.today} stroke="#a7a3c4" strokeDasharray="2 4" label={{ value: `Today FD ${crew.today}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
    {next.map(day => <ReferenceLine key={day} x={day} stroke="#d4d0ea" strokeDasharray="1 5"/>)}
    <XAxis dataKey="day" type="number" domain={[0, crew.missionDays]} ticks={[0, 30, 60, 90, 120, 150, 180]} tickFormatter={d => d === 0 ? 'Pre' : `FD ${d}`} tick={tick} axisLine={false} tickLine={false}/>
    <YAxis domain={[25, 50]} ticks={[25, 30, 35, 40, 45, 50]} tick={tick} axisLine={false} tickLine={false} width={40} label={{ value: 'ml/kg/min', angle: -90, position: 'insideLeft', fill: '#4f5874', fontSize: 12, dx: -2, dy: 30 }}/>
    <Tooltip content={<Tip/>} cursor={{ stroke: '#a49acb', strokeDasharray: '3 4' }}/>
    <Line dataKey="vo2" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
  </ComposedChart></ChartContainer>;
}

function ReferenceStrip({ latestPct }) {
  const refs = Object.entries(reference.byGroup).map(([key, g]) => ({
    kind: 'ref', key, name: { CONTROL: 'No countermeasure', EXERCISE: 'Exercise', FLY: 'FLY' }[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n, err: g.post1_pct.sd, below: g.below_floor,
  }));
  return <ChartContainer config={{}} className="detail-chart"><ComposedChart data={refs} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
    <ReferenceLine y={0} stroke="#c9ccd9"/>
    <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4"/>
    <ReferenceLine y={latestPct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Crew member ${fmtPct(latestPct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>
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
    <section className="overview fuerza-overview" aria-label="Oxygen pathway">
      <div className="body-panel">
        <div className="body-panel-heading"><span>OXYGEN PATHWAY · {current.label.toUpperCase()}</span><span>Organs involved in VO₂peak</span></div>
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body="male" layer="organs" structureColors={structureColors} selected={component ? focusKey[component.id] : null} onSelect={chooseFromBody} framing={1.1} explorationRequest={exploration}/>
        </div></div>
        <ul className="component-legend" aria-label="Components">
          {components.map(c => <li key={c.id}><button type="button" aria-pressed={selected === c.id} onClick={() => choose(c.id)}><i style={{ background: c.color }} aria-hidden="true"/>{c.name}</button></li>)}
        </ul>
        <div className="timeline" role="group" aria-label="Evaluation to display">
          <span className="timeline-label">In-flight cycle ergometer test</span>
          <ol style={{ '--progress': `${evalIndex / (evaluations.length + upcoming.length - 1) * 100}%` }}>
            {evaluations.map((e, i) => <li key={e.id} className={(i === evalIndex ? 'on ' : '') + (i < evalIndex ? 'done' : '')}><button type="button" aria-pressed={i === evalIndex} onClick={() => setEvalIndex(i)}>{e.label}</button></li>)}
            {upcoming.map(u => <li key={u.day} className="next">{u.label}<small>upcoming</small></li>)}
          </ol>
        </div>
      </div>

      <div className="summary">
        <div className="summary-content">
          <div className="vo2-figure">
            <span className="vo2-label">VO₂peak · {current.label}</span>
            <strong>{fmtNum(current.vo2)} <small>ml/kg/min</small></strong>
            <span className="vo2-change">{fmtPct(pct)} from pre-flight ({fmtNum(baseline)})</span>
            <LevelBadge pct={pct}/>
            <span className="vo2-floor">Margin above NASA minimum ({fmtNum(NASA_FLOOR)}): <b>{current.vo2 >= NASA_FLOOR ? '+' : '−'}{fmtNum(Math.abs(current.vo2 - NASA_FLOOR))} ml/kg/min</b></span>
          </div>
          <p className="summary-intro">VO₂peak depends on how much blood the heart pumps and how much oxygen the muscles extract. Select a component to explore the effects of microgravity.</p>
          <div className="insight-list" role="group" aria-label="VO₂peak components">
            {components.map(c => {
              const active = selected === c.id;
              return <button type="button" key={c.id} className={'insight-row' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(c.id)}>
                <span className="insight-marker" aria-hidden="true" style={{ background: c.color }}/>
                <span className="insight-main"><span className="insight-name">{c.name}</span><span className="insight-detail">{c.role}</span>
                  {active && <span className="component-detail"><span>{c.effect}</span><span><b>Evidence:</b> {c.evidence}</span><span><b>Measured in flight?</b> {c.measured}</span></span>}
                </span>
              </button>;
            })}
          </div>
          <p className="note">Simulated crew data. CFT70 is a bed-rest reference from volunteers on Earth. This view shows changes and is not a diagnosis.</p>
        </div>
      </div>
    </section>

    <section className="detail" aria-labelledby="aero-detail-title">
      <header className="detail-head">
        <div><h2 id="aero-detail-title">Aerobic capacity (VO₂peak)</h2><p className="detail-sub">Maximal CEVIS cycle ergometer test with PFS gas analysis</p></div>
      </header>
      <div className="detail-charts">
        <figure className="panel">
          <figcaption><h3>In-flight trend</h3><p>VO₂peak in ml/kg/min at each test. Lines show the pre-flight value, −20% threshold and NASA operational minimum. Simulated crew data.</p></figcaption>
          <Trajectory shown={evaluations.slice(0, chartsIndex + 1)} evalIndex={chartsIndex}/>
          <p className="chart-note">Vertical dotted lines: upcoming tests (FD 165 and R−14, OCHMO-STD-100.1A Table 8).</p>
        </figure>
        <figure className="panel">
          <figcaption><h3>Reference: CFT70</h3><p>Change in VO₂peak after {reference.bedRestDays} days of bed rest ({reference.post1.replace(' a ', ' to ')}), mean ± SD.</p></figcaption>
          <ReferenceStrip latestPct={pctOf(evaluations[chartsIndex].vo2)}/>
          <p className="chart-note">Without countermeasures, 9 of 10 volunteers fell below the NASA minimum; with exercise, 3 of 19.</p>
        </figure>
      </div>

      <div className="panel validity">
        <h3>Test validity</h3>
        <p className="validity-sub">A test is considered maximal when respiratory exchange ratio (RER) reaches 1.1 and perceived exertion (Borg) reaches 17. Otherwise actual VO₂peak may be higher than recorded.</p>
        <div className="table-scroll"><table>
          <thead><tr><th scope="col">Test</th><th scope="col">VO₂peak</th><th scope="col">Change</th><th scope="col">Peak HR</th><th scope="col">Workload</th>{maxCriteria.map(c => <th scope="col" key={c.id}>{c.label}</th>)}<th scope="col">Reason for stopping</th><th scope="col">Method</th></tr></thead>
          <tbody>{shown.map(e => <tr key={e.id} className={e.id === current.id ? 'is-current' : ''}>
            <th scope="row">{e.label}</th><td>{fmtNum(e.vo2)}</td><td>{fmtPct(pctOf(e.vo2))}</td><td>{e.hrPeak} bpm</td><td>{e.watts} W</td>
            {maxCriteria.map(c => <td key={c.id}><span className={'check ' + (c.ok(e) ? 'ok' : 'no')}>{c.value(e)} · {c.ok(e) ? 'met' : 'not met'}</span></td>)}
            <td>{e.stop}</td><td>{e.method === 'measured' ? 'Measured (gas exchange)' : 'Estimated (HR)'}</td>
          </tr>)}</tbody>
        </table></div>
      </div>
    </section>

    <section className="method" aria-labelledby="aero-method-title">
      <h2 id="aero-method-title">How the measurement is obtained</h2>
      <p className="lede">VO₂peak is the maximum oxygen consumed during exertion. It reflects the heart, blood and muscles and is used by NASA when assessing capacity for demanding tasks.</p>
      <div className="method-grid">
        <div><h3>Equipment</h3><p>The <b>CEVIS</b> cycle ergometer and <b>PFS</b> gas analyzer measure respiratory gases; ECG and a cuff measure heart rate and blood pressure.</p></div>
        <div><h3>Protocol</h3><p>Workload increases in stages until exhaustion. A maximal test meets RER ≥ 1.1 and Borg ≥ 17. If PFS is unavailable, VO₂ can be estimated from heart rate and labeled as estimated.</p></div>
        <div><h3>Schedule</h3><p>OCHMO-STD-100.1A Table 8 [6028]: before flight (L-90/30), in flight on FD 14, 75, 165, 255 and R−14; after flight on R+5 and R+30. ISS studies report an early decline and partial recovery (Moore et al. 2014).</p></div>
        <div><h3>Reference and limitations</h3><p>CFT70: 38 volunteers, 70 days of bed rest, with control, exercise and FLY groups; 37 of 38 were men. Shifted columns were corrected for four subjects. In Campaign 3, HR-based estimates differed by 23% on average from measured values.</p></div>
      </div>
      <p className="source">Reference source: NASA Life Sciences Portal, MR080G Aerobic Capacity, CFT70. DOI 10.83263/w056-8t76.</p>
    </section>
  </div>;
}
