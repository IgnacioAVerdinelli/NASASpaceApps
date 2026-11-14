import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceArea, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { ChartContainer } from '../components/chart.jsx';
import { AlertBadge, LevelBadge, Timeline, useEvaluationIndex } from '../fuerza/App.jsx';
import { dayAxis, dayLabel, fmtNum, fmtPct, xOf } from '../fuerza/data.js';
import { components, maxCriteria, reference } from './data.js';
import './style.css';

const tick = { fill: '#4f5874', fontSize: 13 };
const CREW = '#2f2850';
const THRESHOLD = '#a4242f';
const FLOOR_COLOR = '#7d1a23';
const REF_COLORS = { CONTROL: '#6d5fb8', EXERCISE: '#0e7490', FLY: '#9096ad' };
const keyToComponent = new Map(components.flatMap(c => c.keys.map(key => [key, c.id])));
const focusKey = { heart: 'heart', blood: 'aorta', muscle: 'quadriceps_l', lungs: 'lung_l' };
const dim = new THREE.Color('#d9dbe6');

function Tip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">{row.kind === 'ref'
    ? <><strong>{row.name} · {reference.bedRestDays} days</strong><div>Mean change: <b>{fmtPct(row.mean)} ± {fmtNum(row.sd)}</b></div><div>n = {row.n} · {reference.post1}</div><div>Below the NASA minimum: <b>{row.below.pre} → {row.below.post1} of {row.below.n}</b></div></>
    : <><strong>{row.label}</strong><div>VO₂peak: <b>{fmtNum(row.value)} {unit}</b></div><div>Change: <b>{fmtPct(row.changePct)}</b></div>{row.withinNoise && <div>Within test noise</div>}</>}</div>;
}

function Trajectory({ aerobic, shown, next, mission, axis }) {
  const { baseline, minimum, standardLossPct, noiseBandPct, unit } = aerobic;
  const threshold = baseline * (1 - standardLossPct / 100);
  const values = [...shown.map(p => p.value), baseline, threshold, minimum ?? baseline].filter(v => v != null);
  const domain = [Math.floor((Math.min(...values) - 3) / 5) * 5, Math.ceil((Math.max(...values) + 3) / 5) * 5];
  const ticks = Array.from({ length: (domain[1] - domain[0]) / 5 + 1 }, (_, i) => domain[0] + i * 5);
  return <ChartContainer config={{}} className="detail-chart"><ComposedChart data={shown} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
    <ReferenceArea y1={baseline * (1 - noiseBandPct / 100)} y2={baseline * (1 + noiseBandPct / 100)} fill="#e4e6ee" fillOpacity={0.9} ifOverflow="hidden"/>
    <ReferenceLine y={baseline} stroke="#9096ad" strokeDasharray="2 4" label={{ value: `Pre-flight ${fmtNum(baseline)}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
    <ReferenceLine y={threshold} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: `−${standardLossPct}% (${fmtNum(threshold)})`, position: 'insideTopRight', fill: THRESHOLD, fontSize: 12 }}/>
    {minimum != null && <ReferenceLine y={minimum} stroke={FLOOR_COLOR} strokeWidth={1.5} label={{ value: `NASA minimum ${fmtNum(minimum)}`, position: 'insideBottomLeft', fill: FLOOR_COLOR, fontSize: 12 }}/>}
    <ReferenceLine x={mission.today} stroke="#a7a3c4" strokeDasharray="2 4" label={{ value: `Today ${mission.todayLabel}`, position: 'insideTopLeft', fill: '#4f5874', fontSize: 12 }}/>
    {next.map(day => <ReferenceLine key={day} x={day} stroke="#d4d0ea" strokeDasharray="1 5"/>)}
    <XAxis dataKey="x" type="number" domain={axis.domain} ticks={axis.ticks} tickFormatter={d => dayLabel(d, mission.landing)} tick={tick} axisLine={false} tickLine={false}/>
    <YAxis domain={domain} ticks={ticks} tick={tick} axisLine={false} tickLine={false} width={40} label={{ value: unit, angle: -90, position: 'insideLeft', fill: '#4f5874', fontSize: 12, dx: -2, dy: 30 }}/>
    <Tooltip content={<Tip unit={unit}/>} cursor={{ stroke: '#a49acb', strokeDasharray: '3 4' }}/>
    <Line dataKey="value" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
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
    {latestPct != null && <ReferenceLine y={latestPct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Crew member ${fmtPct(latestPct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>}
    <XAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
    <YAxis domain={[-40, 10]} ticks={[10, 0, -10, -20, -30, -40]} tickFormatter={v => `${v}%`} tick={tick} axisLine={false} tickLine={false} width={48}/>
    <Tooltip content={<Tip/>} cursor={false}/>
    <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={8} fill={REF_COLORS[props.payload.key]} stroke="#fff" strokeWidth={2}/>}>
      <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={2} stroke="#7c8299"/>
    </Scatter>
  </ComposedChart></ChartContainer>;
}

function TestData({ test }) {
  if (!test) return <td colSpan={maxCriteria.length + 2} className="not-recorded">Not recorded</td>;
  return <>
    {maxCriteria.map(c => <td key={c.id}><span className={'check ' + (c.ok(test) ? 'ok' : 'no')}>{c.value(test)} · {c.ok(test) ? 'met' : 'not met'}</span></td>)}
    <td>{test.termination ?? '—'}</td><td>{test.method === 'estimated' ? 'Estimated (heart rate)' : 'Measured (gases)'}</td>
  </>;
}

export function AerobicView({ data }) {
  const { aerobic, mission, crew, levels, notice } = data;
  const { evaluations, upcoming, unit, minimum } = aerobic;
  const [evalIndex, pickEvaluation] = useEvaluationIndex(evaluations.length);
  const [selected, setSelected] = useState(null);
  const [exploration, setExploration] = useState({ key: null, request: 0 });
  const current = evaluations[evalIndex];
  const component = components.find(c => c.id === selected);
  const recorded = evaluations.some(e => e.test);

  // Colour of each structure: the chosen component in full, the rest dimmed.
  const structureColors = useMemo(() => Object.fromEntries(components.flatMap(c => {
    const color = new THREE.Color(c.color);
    if (selected && selected !== c.id) color.lerp(dim, 0.7);
    return c.keys.map(key => [key, `#${color.getHexString()}`]);
  })), [selected]);

  // As on the strength tab: zoom to the chosen component; choosing it again goes back to the whole body.
  const choose = id => {
    if (!components.some(c => c.id === id)) return;
    setSelected(prev => prev === id ? null : id);
    const key = focusKey[id];
    setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
  };
  const chooseFromBody = key => { const id = keyToComponent.get(key); if (id) choose(id); };

  // The charts wait for the camera move to end.
  const [chartsIndex, setChartsIndex] = useState(evalIndex);
  useEffect(() => {
    if (chartsIndex === evalIndex) return undefined;
    const timer = setTimeout(() => setChartsIndex(evalIndex), 120);
    return () => clearTimeout(timer);
  }, [evalIndex, chartsIndex]);
  const chartsAt = Math.min(chartsIndex, evaluations.length - 1);
  const shown = evaluations.slice(0, chartsAt + 1).map(e => ({ ...e, x: xOf(e) })).filter(e => e.value != null);
  const next = [...evaluations.slice(chartsAt + 1).map(xOf), ...upcoming.map(u => u.day)];
  const axis = dayAxis(mission, [...evaluations.map(xOf), ...upcoming.map(u => u.day)]);
  const margin = current.value != null && minimum != null ? current.value - minimum : null;

  return <div className="aerobica">
    <section className="overview fuerza-overview" aria-label="Path of oxygen">
      <div className="body-panel">
        <div className="body-panel-heading"><span>PATH OF OXYGEN · {current.phase === 'pre' ? 'PRE-FLIGHT' : current.label}</span><span>Organs that set VO₂peak</span></div>
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body={crew.body} layer="organs" structureColors={structureColors} selected={component ? focusKey[component.id] : null} onSelect={chooseFromBody} framing={1.1} explorationRequest={exploration}/>
        </div></div>
        <ul className="component-legend" aria-label="Components">
          {components.map(c => <li key={c.id}><button type="button" aria-pressed={selected === c.id} onClick={() => choose(c.id)}><i style={{ background: c.color }} aria-hidden="true"/>{c.name}</button></li>)}
        </ul>
        <Timeline label="Cycle ergometer tests" evaluations={evaluations} upcoming={upcoming} index={evalIndex} onPick={pickEvaluation}/>
      </div>

      <div className="summary">
        <div className="summary-content">
          <div className="vo2-figure">
            <span className="vo2-label">VO₂peak · {current.phase === 'pre' ? 'pre-flight reference' : current.label}</span>
            <strong>{fmtNum(current.value)} <small>{unit}</small></strong>
            <span className="vo2-change">{fmtPct(current.changePct)} against pre-flight ({fmtNum(aerobic.baseline)}, mean of {aerobic.referenceTests} tests)</span>
            <span className="badges"><LevelBadge point={current} levels={levels}/><AlertBadge alert={aerobic.alert}/></span>
            {margin != null && <span className="vo2-floor">Margin over the NASA minimum ({fmtNum(minimum)}): <b>{margin >= 0 ? '+' : '−'}{fmtNum(Math.abs(margin))} {unit}</b></span>}
            {aerobic.alert && <span className="alert-message">{aerobic.alert.message}</span>}
          </div>
          <p className="summary-intro">VO₂peak depends on how much blood the heart pumps and how much oxygen the muscles extract. Select a component to see what microgravity does to it.</p>
          <div className="insight-list" role="group" aria-label="Components of VO₂peak">
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
          <p className="note">{notice} Levels, noise and alerts come from the HealthService. The reference is CFT70 (bed rest, volunteers on Earth).</p>
        </div>
      </div>
    </section>

    <section className="detail" aria-labelledby="aero-detail-title">
      <header className="detail-head">
        <div><h2 id="aero-detail-title">Aerobic capacity (VO₂peak)</h2><p className="detail-sub">Maximal cycle test on CEVIS with the PFS gas analyser</p></div>
      </header>
      <div className="detail-charts">
        <figure className="panel">
          <figcaption><h3>In flight</h3><p>VO₂peak in {unit} at each test. Lines: pre-flight reference, {aerobic.standardLossPct}% loss and NASA's in-mission minimum.</p></figcaption>
          <Trajectory aerobic={aerobic} shown={shown} next={next} mission={mission} axis={axis}/>
          <p className="chart-note">Grey band: ±{fmtNum(aerobic.noiseBandPct)}% of pre-flight, where one test lands by measurement noise alone 90% of the time. Dotted vertical lines: tests still to come (OCHMO-STD-100.1A Table 8 [6028]).</p>
        </figure>
        <figure className="panel">
          <figcaption><h3>Reference: CFT70</h3><p>Change in VO₂peak at the end of {reference.bedRestDays} days of bed rest ({reference.post1}), mean ± SD.</p></figcaption>
          <ReferenceStrip latestPct={evaluations[chartsAt].changePct}/>
          <p className="chart-note">Without countermeasure, 9 of 10 volunteers ended below the NASA minimum; with exercise, 3 of 19.</p>
        </figure>
      </div>

      <div className="panel validity">
        <h3>Each test</h3>
        <p className="validity-sub">A test counts as maximal when the respiratory exchange ratio (RER) reaches 1.1 and perceived effort (Borg) reaches 17; otherwise the true VO₂peak may be higher than recorded.{!recorded && ' The DataService records only the VO₂peak value for now, so these checks are not available yet.'}</p>
        <div className="table-scroll"><table>
          <thead><tr><th scope="col">Test</th><th scope="col">VO₂peak</th><th scope="col">Change</th><th scope="col">Level</th>{maxCriteria.map(c => <th scope="col" key={c.id}>{c.label}</th>)}<th scope="col">Why it stopped</th><th scope="col">Method</th></tr></thead>
          <tbody>{evaluations.slice(0, evalIndex + 1).map(e => <tr key={e.id} className={e.id === current.id ? 'is-current' : ''}>
            <th scope="row">{e.label}</th><td>{fmtNum(e.value)}</td><td>{fmtPct(e.changePct)}</td><td><LevelBadge point={e} levels={levels}/></td>
            {e.phase === 'pre' ? <td colSpan={maxCriteria.length + 2} className="not-recorded">Mean of {aerobic.referenceTests} pre-flight tests</td> : <TestData test={e.test}/>}
          </tr>)}</tbody>
        </table></div>
      </div>
    </section>

    <section className="method" aria-labelledby="aero-method-title">
      <h2 id="aero-method-title">How it is measured</h2>
      <p className="lede">VO₂peak is the most oxygen the body uses in an all-out effort. It sums up the heart, the blood and the muscles in one number, and it is the measure NASA uses to decide whether a crew member can do demanding tasks such as a spacewalk or an emergency egress.</p>
      <div className="method-grid">
        <div><h3>Equipment</h3><p><b>CEVIS</b> cycle ergometer (the load does not depend on cadence) and <b>PFS</b> gas analyser, which measures O₂ and CO₂ breath by breath. ECG for heart rate and a cuff for blood pressure. A current NASA procedure on the ISS.</p></div>
        <div><h3>Protocol</h3><p>Load rising in stages until exhaustion. VO₂ = ventilation × (inspired O₂ − expired O₂). Maximal when RER ≥ 1.1 and Borg ≥ 17. If the PFS is unavailable, VO₂peak is estimated from the heart rate–VO₂ relation and marked as estimated.</p></div>
        <div><h3>Schedule and standard</h3><p>OCHMO-STD-100.1A Table 8 [6028]: before flight (L-90/30), in flight FD14, FD75, FD165, FD255 and R−14; after, R+5 and R+30. A fall of {aerobic.standardLossPct}% or more is a loss of performance and {fmtNum(minimum)} {unit} is the in-mission minimum: the HealthService raises a critical alert when the last two tests cross either, on average.</p></div>
        <div><h3>Reference and limits</h3><p>CFT70: 38 volunteers, 70 days of bed rest, no countermeasure, exercise and FLY groups; 37 of 38 are men. Shifted columns were fixed for 4 subjects of the original file. In Campaign 3, the heart-rate estimate was off by a median of 23% against the measured value.</p></div>
      </div>
      <p className="source">Reference source: {reference.source}.</p>
    </section>
  </div>;
}
