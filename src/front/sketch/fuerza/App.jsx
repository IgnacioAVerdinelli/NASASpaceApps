import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceArea, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { ChartContainer } from '../components/chart.jsx';
import { colorScale, crew, evaluations, fmtPct, groups, keyToGroup, levelOf, levels, reference, upcoming } from './data.js';
import '../style.css';
import './style.css';

const tick = { fill: '#4f5874', fontSize: 13 };
// Colores de identidad (no de estado): no se confunden con la escala verde → rojo.
const CREW = '#2f2850';
const THRESHOLD = '#a4242f';
const REF_COLORS = { CONTROL: '#6d5fb8', EXERCISE: '#0e7490', FLY: '#9096ad' };

export function AlertIcon() {
  return <svg className="alert-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

// Transición suave del color del cuerpo al cambiar de evaluación (respeta reduced motion).
function useTweenedScores(target, duration = 600) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { shownRef.current = target; setShown(target); return undefined; }
    let frame = 0, start = null;
    const step = now => {
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Object.fromEntries(Object.entries(target).map(([key, value]) => {
        const origin = from[key] ?? value;
        return [key, origin + (value - origin) * eased];
      }));
      shownRef.current = next; setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

export function LevelBadge({ pct }) {
  const level = levelOf(pct);
  return <span className={`level-badge level-${level.id}`}><i style={{ background: level.color }} aria-hidden="true"/>{level.alert && <AlertIcon/>}{level.label}</span>;
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">{row.kind === 'ref'
    ? <><strong>{row.name} · {reference.bedRestDays} days</strong><div>Mean change: <b>{fmtPct(row.mean)} ± {row.sd.toFixed(1)}</b></div><div>n = {row.n} · {reference.post1.replace(' a ', ' to ')}</div>{row.post2 && <div>Recovery ({reference.post2.replace(' a ', ' to ')}): <b>{fmtPct(row.post2)}</b></div>}</>
    : <><strong>{row.label} · day {row.day}</strong><div>Change: <b>{fmtPct(row.pct)}</b></div><div>Peak torque: <b>{row.nm} N·m</b></div></>}</div>;
}

function MuscleDetail({ group, evalIndex }) {
  const shown = group.points.slice(0, evalIndex + 1);
  const latest = shown.at(-1);
  const refs = Object.entries(group.test.groups).map(([key, g]) => ({
    kind: 'ref', key, name: { CONTROL: 'No countermeasure', EXERCISE: 'Exercise', FLY: 'FLY' }[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n,
    post2: g.post2_pct?.mean ?? null, err: g.post1_pct.sd,
  }));
  const trajectory = shown.map(point => ({ ...point, kind: 'me' }));
  // Misma escala en ambos gráficos; se amplía si algún desvío de la referencia la excede.
  const lo = Math.min(-35, ...refs.map(r => r.mean - r.sd)), hi = Math.max(10, ...refs.map(r => r.mean + r.sd));
  const domain = [Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10];
  const ticks = Array.from({ length: (domain[1] - domain[0]) / 10 + 1 }, (_, i) => domain[1] - i * 10);
  const next = [...evaluations.slice(evalIndex + 1).map(e => e.day), ...upcoming];
  return <section className="detail" aria-labelledby="detail-title">
    <header className="detail-head">
      <div><h2 id="detail-title">{group.name}</h2><p className="detail-sub">{group.test.test} · {group.region}</p></div>
      <div className="detail-figure"><strong>{fmtPct(latest.pct)}</strong><span>{latest.nm} N·m · {latest.label}</span><LevelBadge pct={latest.pct}/></div>
    </header>
    <div className="detail-charts">
      <figure className="panel">
        <figcaption><h3>In-flight trend</h3><p>Change in peak torque from the pre-flight baseline ({group.baseline} N·m). Simulated crew data.</p></figcaption>
        <ChartContainer config={{}} className="detail-chart"><ComposedChart data={trajectory} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
          <ReferenceArea y1={-5} y2={5} fill="#e4e6ee" fillOpacity={0.9} ifOverflow="hidden"/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: '−20% threshold', position: 'insideBottomLeft', fill: THRESHOLD, fontSize: 13 }}/>
          <ReferenceLine x={crew.today} stroke="#a7a3c4" strokeDasharray="2 4" label={{ value: `Today FD ${crew.today}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
          {next.map(day => <ReferenceLine key={day} x={day} stroke="#d4d0ea" strokeDasharray="1 5"/>)}
          <XAxis dataKey="day" type="number" domain={[0, crew.missionDays]} ticks={[0, 30, 60, 90, 120, 150, 180]} tickFormatter={d => d === 0 ? 'Pre' : `FD ${d}`} tick={tick} axisLine={false} tickLine={false}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v} %`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip/>} cursor={{ stroke: '#a49acb', strokeDasharray: '3 4' }}/>
          <Line dataKey="pct" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
        </ComposedChart></ChartContainer>
        <p className="chart-note">Gray band: change within ±5% (assumed indistinguishable from test error). Vertical dotted lines: upcoming assessments.</p>
      </figure>
      <figure className="panel">
        <figcaption><h3>Reference: CFT70</h3><p>Change after {reference.bedRestDays} days of bed rest ({reference.post1.replace(' a ', ' to ')}), mean ± SD. Same test and unit.</p></figcaption>
        <ChartContainer config={{}} className="detail-chart"><ComposedChart data={refs} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
          <ReferenceArea y1={-5} y2={5} fill="#e4e6ee" fillOpacity={0.9}/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4"/>
          <ReferenceLine y={latest.pct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Crew member ${fmtPct(latest.pct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>
          <XAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v} %`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip/>} cursor={false}/>
          <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={8} fill={REF_COLORS[props.payload.key]} stroke="#fff" strokeWidth={2}/>}>
            <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={2} stroke="#7c8299"/>
          </Scatter>
        </ComposedChart></ChartContainer>
        <p className="chart-note">Volunteers on Earth, not astronauts. FLY group: compact flywheel equipment (to be confirmed).</p>
      </figure>
    </div>
  </section>;
}

// Vista de fuerza muscular. El header y las pestañas los pone vuelo/Shell.jsx.
export function StrengthView({ focusRequest = null }) {
  const [evalIndex, setEvalIndex] = useState(evaluations.length - 1);
  const [selectedKey, setSelectedKey] = useState('quadriceps_l');
  const [exploration, setExploration] = useState({ key: null, request: 0 });
  const current = evaluations[evalIndex];
  useEffect(() => {
    if (focusRequest && keyToGroup.has(focusRequest.key)) {
      setSelectedKey(focusRequest.key);
      setEvalIndex(evaluations.length - 1);
      setExploration(previous => ({ key: focusRequest.key, request: previous.request + 1 }));
    }
  }, [focusRequest]);

  const rows = useMemo(() => groups.map(group => ({ group, point: group.points[evalIndex] })).sort((a, b) => a.point.pct - b.point.pct), [evalIndex]);
  const scores = useMemo(() => Object.fromEntries(groups.flatMap(group => {
    const pct = group.points[evalIndex].pct;
    return group.keys.map(key => [key, levelOf(pct).id]);
  })), [evalIndex]);
  const shownScores = useTweenedScores(scores);
  const selectedGroup = keyToGroup.get(selectedKey) ?? null;
  const checkpointItems = useMemo(() => groups.map(g => ({ id: g.key, title: g.name, muscleKeys: g.keys })), []);
  const indicatorText = useMemo(() => key => {
    const g = groups.find(item => item.keys.includes(key));
    if (!g) return null;
    const side = key.endsWith('_l') ? ' · left' : key.endsWith('_r') ? ' · right' : '';
    return { name: g.name + side, value: fmtPct(g.points[evalIndex].pct) };
  }, [evalIndex]);

  // Igual que main: se enfoca exactamente el área tocada; tocarla de nuevo vuelve al cuerpo entero.
  const choose = key => {
    if (!keyToGroup.has(key)) return;
    setSelectedKey(key);
    setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
  };
  // Los gráficos del detalle se actualizan cuando termina el movimiento de cámara (500 ms en el
  // visor), para que su render no trabe la animación.
  const [detailGroupKey, setDetailGroupKey] = useState(selectedGroup);
  useEffect(() => {
    if (selectedGroup === detailGroupKey) return undefined;
    const timer = setTimeout(() => setDetailGroupKey(selectedGroup), 550);
    return () => clearTimeout(timer);
  }, [selectedGroup, detailGroupKey]);
  const group = groups.find(g => g.key === detailGroupKey);

  return <div className="fuerza">

    <section className="overview fuerza-overview" aria-label="Body map">
      <div className="body-panel">
        <div className="body-panel-heading"><span>BODY MAP · {current.label.toUpperCase()}</span><span>6 groups assessed · both sides show the same value</span></div>
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body="male" layer="surface" scores={shownScores} selected={selectedKey} onSelect={choose} framing={1.1} showIndicators checkpointItems={checkpointItems} explorationRequest={exploration} colorScale={colorScale} indicatorText={indicatorText}/>
        </div></div>
        <ul className="legend-levels" aria-label="Color scale">
          {levels.map(level => <li key={level.id}><i style={{ background: level.color }}/>{level.alert && <AlertIcon/>}<span>{level.label}<small>{level.range}</small></span></li>)}
          <li><i className="not-assessed"/><span>Not assessed<small>not measured in this protocol</small></span></li>
        </ul>
        <div className="timeline" role="group" aria-label="Evaluation to display">
          <span className="timeline-label">In-flight assessment</span>
          <ol style={{ '--progress': `${evalIndex / (evaluations.length + upcoming.length - 1) * 100}%` }}>{evaluations.map((e, i) => <li key={e.id} className={(i === evalIndex ? 'on ' : '') + (i < evalIndex ? 'done' : '')}><button type="button" aria-pressed={i === evalIndex} onClick={() => setEvalIndex(i)}>{e.label}</button></li>)}{upcoming.map(d => <li key={d} className="next">FD {d}<small>upcoming</small></li>)}</ol>
        </div>
      </div>

      <div className="summary">
        <div className="summary-content">
          <p className="summary-intro">Ordered by loss at {current.label}. Select a group to explore its trend and reference.</p>
          <div className="insight-list" role="group" aria-label="Assessed muscle groups">
            {rows.map(({ group: g, point }) => {
              const active = g.key === selectedGroup;
              return <button type="button" key={g.key} className={'insight-row' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(active ? selectedKey : g.keys[0])}>
                <span className="insight-marker" aria-hidden="true" style={{ background: levelOf(point.pct).color, borderColor: levelOf(point.pct).color }}/>
                <span className="insight-main"><span className="insight-name">{g.name}</span><span className="insight-detail">{g.test.test} · {point.nm} N·m</span><LevelBadge pct={point.pct}/></span>
                <span className="insight-change">{fmtPct(point.pct)}</span>
              </button>;
            })}
          </div>
          <p className="note">Simulated crew data. References are real bed-rest data from volunteers on Earth. This view shows changes and is not a diagnosis.</p>
        </div>
      </div>
    </section>

    {group && <MuscleDetail group={group} evalIndex={evalIndex}/>}

    <section className="method" aria-labelledby="method-title">
      <h2 id="method-title">How the measurement is obtained</h2>
      <p className="lede">Percentage change in peak torque from pre-flight baseline by muscle group. Proposed method: an onboard isokinetic dynamometer (ESA MARES type), using NASA <i>Medical Volume B 5.3</i>. Reference: CFT70 bed-rest study (NLSP MR079G).</p>
      <div className="method-grid">
        <div><h3>Equipment</h3><p>An onboard isokinetic dynamometer, based on ESA’s MARES, used in Sarcolab-3 (FD 9, 49 and 131). NASA monitors ARED training but does not routinely measure in-flight strength, so this is a <b>proposed method</b>.</p></div>
        <div><h3>Protocol</h3><p>NASA pre- and post-flight tests: knee at 60°/s, ankle at 30°/s and trunk at 60°/s, with 3–5 maximal repetitions. Peak torque is recorded in N·m with consistent positioning and settings.</p></div>
        <div><h3>Schedule</h3><p>Pre-flight baseline; FD 15 and every 30 days thereafter (ESA schedule, Petersen et al. 2016). Change % = (current torque ÷ pre-flight torque − 1) × 100.</p></div>
        <div><h3>Reference and limitations</h3><p>CFT70: 42 volunteers, 70 days of bed rest, with control, exercise and FLY groups. 41 of 42 were men; no measurements were taken during bed rest. The reference measured one leg; both sides show the same value. A −20% loss is associated with reduced performance in critical tasks (Scott et al. 2023).</p></div>
      </div>
      <p className="source">Reference source: NASA Life Sciences Portal, MR079G Muscle Strength, CFT70.</p>
    </section>
  </div>;
}
