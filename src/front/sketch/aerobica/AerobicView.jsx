import React, { useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceArea, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { ChartContainer } from '../components/chart.jsx';
import { AlertBadge, LevelBadge, Timeline, useEvaluationIndex } from '../fuerza/App.jsx';
import { dayAxis, dayLabel, fmtNum, fmtPct, xOf } from '../fuerza/data.js';
import { components, maxCriteria, reference } from './data.js';
import './style.css';

// Chart colours mirror theme/glass.css (recharts takes SVG attributes, where CSS variables are not reliable).
const T = {
  line: '#2238A8',        // --chart-line
  grid: 'rgba(23,32,57,.08)', // --chart-grid
  tick: '#33405A',        // --chart-tick / --muted
  ink2: '#26324C',        // --ink-2
  rule: 'rgba(23,32,57,.28)',
  noise: 'rgba(23,32,57,.07)',
  warn: '#C27800', warnInk: '#5C3600', // --warn-dot / --warn-ink: the 20% loss of performance
  crit: '#A4242F', critInk: '#8C1D28', // --crit-dot / --crit-ink: NASA's in-mission minimum
};
const tick = { fill: T.tick, fontSize: 12 };
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
  return <ChartContainer config={{}} className="aero-chart"><ComposedChart data={shown} margin={{ top: 16, right: 16, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke={T.grid}/>
    <ReferenceArea y1={baseline * (1 - noiseBandPct / 100)} y2={baseline * (1 + noiseBandPct / 100)} fill={T.noise} fillOpacity={1} ifOverflow="hidden"/>
    <ReferenceLine y={baseline} stroke={T.rule} strokeDasharray="2 4" label={{ value: `Pre-flight ${fmtNum(baseline)}`, position: 'insideTopRight', fill: T.ink2, fontSize: 12 }}/>
    <ReferenceLine y={threshold} stroke={T.warn} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `−${standardLossPct}% (${fmtNum(threshold)})`, position: 'insideTopRight', fill: T.warnInk, fontSize: 12, fontWeight: 600 }}/>
    {minimum != null && <ReferenceLine y={minimum} stroke={T.crit} strokeWidth={1.5} label={{ value: `NASA minimum ${fmtNum(minimum)}`, position: 'insideBottomLeft', fill: T.critInk, fontSize: 12, fontWeight: 600 }}/>}
    <ReferenceLine x={mission.today} stroke={T.rule} strokeDasharray="2 4" label={{ value: `Today ${mission.todayLabel}`, position: 'insideTopLeft', fill: T.ink2, fontSize: 12 }}/>
    {next.map(day => <ReferenceLine key={day} x={day} stroke={T.rule} strokeDasharray="1 5"/>)}
    <XAxis dataKey="x" type="number" domain={axis.domain} ticks={axis.ticks} tickFormatter={d => dayLabel(d, mission.landing)} tick={tick} axisLine={false} tickLine={false}/>
    <YAxis domain={domain} ticks={ticks} tick={tick} axisLine={false} tickLine={false} width={40} label={{ value: unit, angle: -90, position: 'insideLeft', fill: T.tick, fontSize: 11, dx: -2, dy: 30 }}/>
    <Tooltip content={<Tip unit={unit}/>} cursor={{ stroke: T.rule, strokeDasharray: '3 4' }}/>
    <Line dataKey="value" stroke={T.line} strokeWidth={2.5} dot={{ r: 5.5, fill: T.line, stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 7.5, fill: T.line, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>
  </ComposedChart></ChartContainer>;
}

function ReferenceStrip({ latestPct }) {
  const refs = Object.entries(reference.byGroup).map(([key, g]) => ({
    kind: 'ref', key, name: reference.groups[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n, err: g.post1_pct.sd, below: g.below_floor,
  }));
  return <ChartContainer config={{}} className="aero-chart"><ComposedChart data={refs} margin={{ top: 16, right: 12, left: 4, bottom: 4 }}>
    <CartesianGrid vertical={false} stroke={T.grid}/>
    <ReferenceLine y={0} stroke={T.rule}/>
    <ReferenceLine y={-20} stroke={T.warn} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: '−20%', position: 'insideBottomRight', fill: T.warnInk, fontSize: 11, fontWeight: 600 }}/>
    {latestPct != null && <ReferenceLine y={latestPct} stroke={T.line} strokeWidth={1.5} strokeDasharray="4 4" label={{ value: `Crew member ${fmtPct(latestPct)}`, position: 'insideTopLeft', fill: T.line, fontSize: 12, fontWeight: 600 }}/>}
    <XAxis dataKey="name" type="category" tick={tick} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
    <YAxis domain={[-40, 10]} ticks={[10, 0, -10, -20, -30, -40]} tickFormatter={v => `${v}%`} tick={tick} axisLine={false} tickLine={false} width={48}/>
    <Tooltip content={<Tip/>} cursor={false}/>
    {/* The groups are named on the axis, so their marks share one neutral ink; the crew member is the blue line. */}
    <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={7} fill={T.ink2} stroke="#fff" strokeWidth={2}/>}>
      <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={1.5} stroke={T.tick}/>
    </Scatter>
  </ComposedChart></ChartContainer>;
}

function TestData({ test }) {
  if (!test) return <td colSpan={maxCriteria.length + 2} className="not-recorded">Not recorded</td>;
  return <>
    {maxCriteria.map(c => <td key={c.id}><span className="chip" data-tone={c.ok(test) ? 'ok' : 'crit'}>{c.value(test)} · {c.ok(test) ? 'met' : 'not met'}</span></td>)}
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
  const testLabel = current.phase === 'pre' ? 'pre-flight' : current.label;

  return <div className="aerobica">
    <section className="aero-overview" aria-labelledby="aero-map-title">
      <div className="aero-map">
        <div className="aero-map-title glass-sm">
          <h2 id="aero-map-title">Path of oxygen</h2>
          <p>Organs that set VO₂peak · {current.phase === 'pre' ? 'pre-flight' : current.label}</p>
        </div>
        <div className="aero-stage"><div className="aero-halo" aria-hidden="true"/><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body={crew.body} layer="organs" structureColors={structureColors} selected={component ? focusKey[component.id] : null} onSelect={chooseFromBody} framing={1.1} explorationRequest={exploration}/>
        </div></div>
        <ul className="component-legend glass-sm" aria-label="Components">
          {components.map(c => <li key={c.id}><button type="button" aria-pressed={selected === c.id} onClick={() => choose(c.id)}><i style={{ background: c.color }} aria-hidden="true"/>{c.name}</button></li>)}
        </ul>
        <Timeline label="Cycle ergometer tests" evaluations={evaluations} upcoming={upcoming} index={evalIndex} onPick={pickEvaluation}/>
      </div>

      <div className="aero-summary glass">
        <div className="vo2-figure">
          <p className="eyebrow">VO₂peak · {current.phase === 'pre' ? 'pre-flight reference' : current.label}</p>
          <p className="vo2-value"><span className="num">{fmtNum(current.value)}</span> <small>{unit}</small></p>
          <span className="badges"><LevelBadge point={current} levels={levels}/></span>
          <dl className="vo2-readings">
            <div><dt>Change against pre-flight</dt><dd><span className="num">{fmtPct(current.changePct)}</span><small>pre-flight {fmtNum(aerobic.baseline)}, mean of {aerobic.referenceTests} tests</small></dd></div>
            {margin != null && <div><dt>Margin over the NASA minimum ({fmtNum(minimum)})</dt><dd><span className="num">{margin >= 0 ? '+' : '−'}{fmtNum(Math.abs(margin))}</span><small>{unit} at {testLabel}</small></dd></div>}
          </dl>
          {aerobic.alert && <div className="aero-alert" data-tone={aerobic.alert.severity === 'critical' ? 'crit' : 'warn'}>
            <AlertBadge alert={aerobic.alert}/>
            <p>{aerobic.alert.message}</p>
          </div>}
        </div>
        <p className="aero-intro">VO₂peak depends on how much blood the heart pumps and how much oxygen the muscles extract. Select a component to see what microgravity does to it.</p>
        <div className="aero-components" role="group" aria-label="Components of VO₂peak">
          {components.map(c => {
            const active = selected === c.id;
            return <button type="button" key={c.id} className={'aero-component' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(c.id)}>
              <span className="aero-component-marker" aria-hidden="true" style={{ background: c.color }}/>
              <span className="aero-component-main"><span className="aero-component-name">{c.name}</span><span className="aero-component-role">{c.role}</span>
                {active && <span className="component-detail"><span>{c.effect}</span><span><b>Evidence:</b> {c.evidence}</span><span><b>Measured in flight?</b> {c.measured}</span></span>}
              </span>
              <svg className="aero-component-chevron" aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m7 10 5 5 5-5"/></svg>
            </button>;
          })}
        </div>
        <p className="aero-note">{notice} Levels, noise and alerts come from the HealthService. The reference is CFT70 (bed rest, volunteers on Earth).</p>
      </div>
    </section>

    <section className="aero-detail" aria-labelledby="aero-detail-title">
      <header className="aero-section-head">
        <h2 id="aero-detail-title">Aerobic capacity (VO₂peak)</h2>
        <p className="glass-sm">Maximal cycle test on CEVIS with the PFS gas analyser</p>
      </header>
      <div className="aero-charts">
        <figure className="aero-panel glass">
          <figcaption><h3>In flight</h3><p>VO₂peak in {unit} at each test. Lines: pre-flight reference, {aerobic.standardLossPct}% loss and NASA's in-mission minimum.</p></figcaption>
          <ul className="aero-legend" aria-label="Chart key">
            <li><i className="key-crew" aria-hidden="true"/>Crew member</li>
            <li><i className="key-noise" aria-hidden="true"/>Test noise ±{fmtNum(aerobic.noiseBandPct)}%</li>
            <li><i className="key-warn" aria-hidden="true"/>−{aerobic.standardLossPct}% loss of performance</li>
            {minimum != null && <li><i className="key-crit" aria-hidden="true"/>NASA minimum</li>}
          </ul>
          <Trajectory aerobic={aerobic} shown={shown} next={next} mission={mission} axis={axis}/>
          <p className="aero-chart-note">Grey band: ±{fmtNum(aerobic.noiseBandPct)}% of pre-flight, where one test lands by measurement noise alone 90% of the time. Dotted vertical lines: tests still to come (OCHMO-STD-100.1A Table 8 [6028]).</p>
        </figure>
        <figure className="aero-panel glass">
          <figcaption><h3>Reference: CFT70</h3><p>Change in VO₂peak at the end of {reference.bedRestDays} days of bed rest ({reference.post1}), mean ± SD.</p></figcaption>
          <ReferenceStrip latestPct={evaluations[chartsAt].changePct}/>
          <p className="aero-chart-note">Without countermeasure, 9 of 10 volunteers ended below the NASA minimum; with exercise, 3 of 19.</p>
        </figure>
      </div>

      <div className="aero-panel aero-validity glass">
        <h3>Each test</h3>
        <p className="aero-validity-sub">A test counts as maximal when the respiratory exchange ratio (RER) reaches 1.1 and perceived effort (Borg) reaches 17; otherwise the true VO₂peak may be higher than recorded.{!recorded && ' The DataService records only the VO₂peak value for now, so these checks are not available yet.'}</p>
        <div className="table-scroll" tabIndex="0" role="region" aria-label="Test validity table"><table>
          <thead><tr><th scope="col">Test</th><th scope="col">VO₂peak</th><th scope="col">Change</th><th scope="col">Level</th>{maxCriteria.map(c => <th scope="col" key={c.id}>{c.label}</th>)}<th scope="col">Why it stopped</th><th scope="col">Method</th></tr></thead>
          <tbody>{evaluations.slice(0, evalIndex + 1).map(e => <tr key={e.id} className={e.id === current.id ? 'is-current' : ''} aria-current={e.id === current.id ? 'true' : undefined}>
            <th scope="row">{e.label}</th><td className="num">{fmtNum(e.value)}</td><td className="num">{fmtPct(e.changePct)}</td><td><LevelBadge point={e} levels={levels}/></td>
            {e.phase === 'pre' ? <td colSpan={maxCriteria.length + 2} className="not-recorded">Mean of {aerobic.referenceTests} pre-flight tests</td> : <TestData test={e.test}/>}
          </tr>)}</tbody>
        </table></div>
      </div>
    </section>

    <section className="aero-method glass" aria-labelledby="aero-method-title">
      <h2 id="aero-method-title">How it is measured</h2>
      <p className="aero-lede">VO₂peak is the most oxygen the body uses in an all-out effort. It sums up the heart, the blood and the muscles in one number, and it is the measure NASA uses to decide whether a crew member can do demanding tasks such as a spacewalk or an emergency egress.</p>
      <div className="aero-method-grid">
        <div><h3>Equipment</h3><p><b>CEVIS</b> cycle ergometer (the load does not depend on cadence) and <b>PFS</b> gas analyser, which measures O₂ and CO₂ breath by breath. ECG for heart rate and a cuff for blood pressure. A current NASA procedure on the ISS.</p></div>
        <div><h3>Protocol</h3><p>Load rising in stages until exhaustion. VO₂ = ventilation × (inspired O₂ − expired O₂). Maximal when RER ≥ 1.1 and Borg ≥ 17. If the PFS is unavailable, VO₂peak is estimated from the heart rate–VO₂ relation and marked as estimated.</p></div>
        <div><h3>Schedule and standard</h3><p>OCHMO-STD-100.1A Table 8 [6028]: before flight (L-90/30), in flight FD14, FD75, FD165, FD255 and R−14; after, R+5 and R+30. A fall of {aerobic.standardLossPct}% or more is a loss of performance and {fmtNum(minimum)} {unit} is the in-mission minimum: the HealthService raises a critical alert when the last two tests cross either, on average.</p></div>
        <div><h3>Reference and limits</h3><p>CFT70: 38 volunteers, 70 days of bed rest, no countermeasure, exercise and FLY groups; 37 of 38 are men. Shifted columns were fixed for 4 subjects of the original file. In Campaign 3, the heart-rate estimate was off by a median of 23% against the measured value.</p></div>
      </div>
      <p className="aero-source">Reference source: {reference.source}.</p>
    </section>
  </div>;
}
