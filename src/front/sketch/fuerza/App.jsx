import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceArea, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { BodyTrends } from '../BodyTrends.jsx';
import { muscles, SURFACE_MUSCLE_KEYS } from '../../body-3d/anatomy.js';
import { testModeReducer } from '../data/testMode.js';
import { ChartContainer } from '../components/chart.jsx';
import { ALERT_TEXT, colorScale, dayAxis, dayLabel, fmtNum, fmtPct, levelColor, levelText, reference, referenceFor, xOf } from './data.js';
import '../style.css';
import './style.css';

// Chart colours come from the theme tokens (theme/glass.css) and the local ones in ./style.css.
const tick = { fill: 'var(--chart-tick)', fontSize: 12 };
const GRID = 'var(--chart-grid)';
const CREW = 'var(--chart-strength)';
const THRESHOLD = 'var(--crit-ink)';
const NOISE = 'var(--strength-noise-band)';
// Identity colours of the reference groups (not status): they are not confused with the green-to-red scale.
const REF_COLORS = { CONTROL: 'var(--ref-control)', EXERCISE: 'var(--ref-exercise)', FLY: 'var(--ref-fly)' };

export function AlertIcon() {
  return <svg className="alert-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

// Smooth body colour change between evaluations (respects reduced motion).
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

// Follows the latest evaluation until the person picks an older one; picking the latest follows again.
export function useEvaluationIndex(count) {
  const [picked, setPicked] = useState(null);
  const index = picked === null || picked >= count ? count - 1 : picked;
  return [index, i => setPicked(i >= count - 1 ? null : i)];
}

export function LevelBadge({ point, levels }) {
  return <span className={`level-badge level-${point.level ?? 'none'}`}><i style={{ background: levelColor(point.level) }} aria-hidden="true"/>{levelText(point, levels)}{point.withinNoise && point.level > 1 && <small>within test noise</small>}</span>;
}

export function AlertBadge({ alert }) {
  if (!alert) return null;
  return <span className={`alert-badge alert-${alert.severity}`} title={alert.message}><AlertIcon/>{ALERT_TEXT[alert.severity]}</span>;
}

export function Timeline({ label, evaluations, upcoming, index, onPick }) {
  const total = evaluations.length + upcoming.length - 1;
  return <div className="timeline glass" role="group" aria-label="Evaluation to show">
    <span className="timeline-label">{label}</span>
    <ol style={{ '--progress': `${total > 0 ? index / total * 100 : 0}%` }}>
      {evaluations.map((e, i) => <li key={e.id} className={(i === index ? 'on ' : '') + (i < index ? 'done' : '')}><button type="button" aria-pressed={i === index} onClick={() => onPick(i)}>{e.phase === 'pre' ? 'Pre' : e.label}</button></li>)}
      {upcoming.map(u => <li key={`${u.day}-${u.reason}`} className="next">{u.label}<small>{u.reason === 'retest' ? 'retest' : 'next'}</small></li>)}
    </ol>
  </div>;
}

function Tip({ active, payload, unit }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">{row.kind === 'ref'
    ? <><strong>{row.name} · {reference.bedRestDays} days</strong><div>Mean change: <b>{fmtPct(row.mean)} ± {fmtNum(row.sd)}</b></div><div>n = {row.n} · {reference.post1}</div>{row.post2 != null && <div>Recovery ({reference.post2}): <b>{fmtPct(row.post2)}</b></div>}</>
    : <><strong>{row.label}</strong><div>Change: <b>{fmtPct(row.changePct)}</b></div><div>Peak torque: <b>{fmtNum(row.value)} {unit}</b></div>{row.withinNoise && <div>Within test noise</div>}</>}</div>;
}

function MuscleDetail({ group, evaluations, evalIndex, mission, upcoming, levels }) {
  const shown = group.points.slice(0, evalIndex + 1).map((point, i) => ({ ...point, ...evaluations[i], x: xOf(evaluations[i]), kind: 'me' })).filter(p => p.changePct != null);
  const latest = shown.at(-1);
  const ref = referenceFor(group.measure);
  const refs = ref ? Object.entries(ref.groups).filter(([, g]) => g.post1_pct).map(([key, g]) => ({
    kind: 'ref', key, name: { CONTROL: 'No countermeasure', EXERCISE: 'Exercise', FLY: 'FLY' }[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n,
    post2: g.post2_pct?.mean ?? null, err: g.post1_pct.sd,
  })) : [];
  // Same scale on both charts; it widens if a reference spread or a test goes beyond it.
  const values = [...refs.flatMap(r => [r.mean - r.sd, r.mean + r.sd]), ...shown.map(p => p.changePct), group.noiseBandPct, -group.noiseBandPct];
  const domain = [Math.floor(Math.min(-35, ...values) / 10) * 10, Math.ceil(Math.max(10, ...values) / 10) * 10];
  const ticks = Array.from({ length: (domain[1] - domain[0]) / 10 + 1 }, (_, i) => domain[1] - i * 10);
  const next = [...evaluations.slice(evalIndex + 1).map(xOf), ...upcoming.map(u => u.day)];
  const axis = dayAxis(mission, [...evaluations.map(xOf), ...upcoming.map(u => u.day)]);
  return <section className="detail strength-detail glass" aria-labelledby="detail-title">
    <header className="detail-head">
      <div><p className="eyebrow">Selected group</p><h2 id="detail-title">{group.name}</h2><p className="detail-sub">{group.test} · {group.region}</p>{group.alert && <p className="alert-message"><AlertBadge alert={group.alert}/> {group.alert.message}</p>}</div>
      {latest && <div className="detail-figure"><strong className="num">{fmtPct(latest.changePct)}</strong><span>{fmtNum(latest.value)} {group.unit} · {latest.label}</span><LevelBadge point={latest} levels={levels}/></div>}
    </header>
    <div className="detail-charts">
      <figure className="detail-panel">
        <figcaption><h3>In flight</h3><p>Change in peak torque against the pre-flight reference ({fmtNum(group.baseline)} {group.unit}, mean of {group.referenceTests} tests).</p></figcaption>
        <ChartContainer config={{}} className="detail-chart"><ComposedChart data={shown} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID}/>
          <ReferenceArea y1={-group.noiseBandPct} y2={group.noiseBandPct} fill={NOISE} fillOpacity={1} ifOverflow="hidden"/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: '−20%', position: 'insideBottomLeft', fill: THRESHOLD, fontSize: 12, fontWeight: 600 }}/>
          <ReferenceLine x={mission.today} stroke="var(--muted)" strokeOpacity={0.6} strokeDasharray="2 4" label={{ value: `Today ${mission.todayLabel}`, position: 'insideTopRight', fill: 'var(--muted)', fontSize: 12 }}/>
          {next.map(day => <ReferenceLine key={day} x={day} stroke="var(--muted)" strokeOpacity={0.35} strokeDasharray="1 5"/>)}
          <XAxis dataKey="x" type="number" domain={axis.domain} ticks={axis.ticks} tickFormatter={d => dayLabel(d, mission.landing)} tick={tick} axisLine={false} tickLine={false}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v}%`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip unit={group.unit}/>} cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.5, strokeDasharray: '3 4' }}/>
          <Line dataKey="changePct" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
        </ComposedChart></ChartContainer>
        <p className="chart-note">Grey band: ±{fmtNum(group.noiseBandPct)}%, where one test lands by measurement noise alone 90% of the time (test-retest variability from the bed-rest data). Dotted vertical lines: tests still to come.</p>
      </figure>
      <figure className="detail-panel">
        <figcaption><h3>Reference: CFT70</h3><p>Change at the end of {reference.bedRestDays} days of bed rest ({reference.post1}), mean ± SD. Same test and unit.</p></figcaption>
        {refs.length ? <ChartContainer config={{}} className="detail-chart"><ComposedChart data={refs} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke={GRID}/>
          <ReferenceArea y1={-group.noiseBandPct} y2={group.noiseBandPct} fill={NOISE} fillOpacity={1}/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4"/>
          {latest && <ReferenceLine y={latest.changePct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Crew member ${fmtPct(latest.changePct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>}
          <XAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v}%`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip unit={group.unit}/>} cursor={false}/>
          <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={8} fill={REF_COLORS[props.payload.key]} stroke="#fff" strokeWidth={2}/>}>
            <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={2} stroke="var(--muted)"/>
          </Scatter>
        </ComposedChart></ChartContainer> : <p className="chart-note">No CFT70 reference for this test.</p>}
        <p className="chart-note">Volunteers on Earth, not astronauts. FLY group: compact flywheel device (to be confirmed).</p>
      </figure>
    </div>
  </section>;
}

// Strength view. The header and the tabs come from vuelo/Shell.jsx.
export function StrengthView({ data, focusRequest = null, bodyState, trendTarget }) {
  const { strength, mission, crew, levels, notice } = data;
  const { evaluations, upcoming } = strength;
  const [testMode, dispatchTest] = useReducer(testModeReducer, null);
  const groups = useMemo(() => strength.groups.map(group => ({ ...group, keys: group.muscleKeys })), [strength.groups]);
  const [evalIndex, pickEvaluation] = useEvaluationIndex(evaluations.length);
  // Opens on the group with the largest loss at the latest test.
  const [selectedKey, setSelectedKey] = useState(() => {
    const last = evaluations.length - 1;
    const worst = [...strength.groups].sort((a, b) => (a.points[last]?.changePct ?? Infinity) - (b.points[last]?.changePct ?? Infinity))[0];
    return worst?.muscleKeys[0] ?? null;
  });
  const [exploration, setExploration] = useState({ key: null, request: 0 });
  const current = evaluations[evalIndex];
  const keyToGroup = useMemo(() => new Map(groups.flatMap(group => group.keys.map(key => [key, group.key]))), [groups]);
  const handledFocus = useRef(null);
  useEffect(() => {
    if (focusRequest && focusRequest !== handledFocus.current && keyToGroup.has(focusRequest.key)) {
      handledFocus.current = focusRequest;
      setSelectedKey(focusRequest.key);
      pickEvaluation(evaluations.length - 1);
      setExploration(previous => ({ key: focusRequest.key, request: previous.request + 1 }));
    }
  }, [focusRequest, keyToGroup, evaluations.length, pickEvaluation]);

  const rows = useMemo(() => groups.map(group => ({ group, point: group.points[evalIndex] }))
    .sort((a, b) => (a.point.changePct ?? Infinity) - (b.point.changePct ?? Infinity)), [groups, evalIndex]);
  // Recomputed only when a colour changes, so a poll with the same levels does not restart the colour tween.
  const levelKey = groups.map(group => `${group.keys.join('+')}:${group.points[evalIndex].level}`).join();
  const scores = useMemo(() => Object.fromEntries(groups.flatMap(group => group.keys.map(key => [key, group.points[evalIndex].level ?? 0]))), [levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const shownScores = useTweenedScores(scores);
  const selectedGroup = keyToGroup.get(selectedKey) ?? groups[0]?.key ?? null;
  const checkpointItems = useMemo(() => groups.map(g => ({ id: g.key, title: g.name, muscleKeys: g.keys })), [groups]);
  const indicatorText = useMemo(() => key => {
    const g = groups.find(item => item.keys.includes(key));
    if (!g) return null;
    const side = key.endsWith('_l') ? ' · left' : key.endsWith('_r') ? ' · right' : '';
    return { name: g.name + side, value: fmtPct(g.points[evalIndex].changePct) };
  }, [groups, evalIndex]);

  // As on the main page: zoom to exactly the area touched; touching it again goes back to the whole body.
  const choose = key => {
    if (testMode) {
      dispatchTest({ type: 'select', value: key });
      if (testMode.layer !== 'skeleton' && (testMode.layer !== 'surface' || !key || SURFACE_MUSCLE_KEYS.has(key))) setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
      return;
    }
    if (!keyToGroup.has(key)) return;
    setSelectedKey(key);
    setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
  };
  // The detail charts update once the camera move ends (500 ms in the viewer), so their render does not stall it.
  const [detailGroupKey, setDetailGroupKey] = useState(selectedGroup);
  useEffect(() => {
    if (selectedGroup === detailGroupKey) return undefined;
    const timer = setTimeout(() => setDetailGroupKey(selectedGroup), 550);
    return () => clearTimeout(timer);
  }, [selectedGroup, detailGroupKey]);
  const group = groups.find(g => g.key === detailGroupKey) ?? groups[0];

  return <div className="fuerza">
    <section className="overview fuerza-overview" aria-label="Body map">
      <div className="strength-map">
        <div className="map-top">
          <div className="map-title glass-sm"><h2>{testMode ? 'Test mode' : 'Body map'}</h2><p>{testMode ? 'Temporary colours, not crew data' : `Strength vs pre-flight · ${current.phase === 'pre' ? 'pre-flight reference' : `test ${current.label}`}`}</p></div>
          <button type="button" className="test-mode-toggle btn-glass" aria-pressed={Boolean(testMode)} aria-controls="strength-test-controls" onClick={() => { dispatchTest(testMode ? { type: 'exit' } : { type: 'start', model: { body: crew.body, layer: 'surface', scores: bodyState?.data?.body.scores || {} }, selected: selectedKey }); setExploration(prev => ({ key: null, request: prev.request + 1 })); }}>{testMode ? 'Exit test mode' : 'Test mode'}</button>
        </div>
        {testMode && <div id="strength-test-controls" className="test-controls glass-sm" aria-label="Test mode controls"><p>Test mode · Changes are temporary and do not affect dashboard data.</p><div className="test-control-groups"><div className="seg" role="group" aria-label="Body model">{[['male', 'Male'], ['female', 'Female']].map(([key, name]) => <button type="button" key={key} aria-pressed={testMode.body === key} onClick={() => { dispatchTest({ type: 'body', value: key }); setExploration(prev => ({ key: null, request: prev.request + 1 })); }}>{name}</button>)}</div><div className="seg" role="group" aria-label="Anatomy layer">{[['surface', 'Surface'], ['muscles', 'Muscles'], ['skeleton', 'Bones']].map(([key, name]) => <button type="button" key={key} aria-pressed={testMode.layer === key} onClick={() => { dispatchTest({ type: 'layer', value: key }); setExploration(prev => ({ key: null, request: prev.request + 1 })); }}>{name}</button>)}</div><div className="test-actions"><button type="button" className="btn-glass" onClick={() => dispatchTest({ type: 'paint' })}>Paint all</button><button type="button" className="btn-glass" onClick={() => dispatchTest({ type: 'clear' })}>Clear colors</button></div></div><div className="test-editor"><label>Muscle <select value={testMode.selected || ''} onChange={event => choose(event.target.value || null)}><option value="">Select a muscle</option>{muscles.map(item => <option key={item.key} value={item.key}>{item.label}</option>)}</select></label><label>Intensity <input type="range" min="0" max="100" disabled={!testMode.selected} value={testMode.selected ? testMode.scores[testMode.selected] ?? 0 : 0} onChange={event => dispatchTest({ type: 'intensity', value: Number(event.target.value) })}/><output className="num">{testMode.selected ? testMode.scores[testMode.selected] ?? 0 : 0}</output></label></div></div>}
        <div className="body-stage"><div className="body-halo" aria-hidden="true"/><div className="model-canvas">
          <BodyViewer body={testMode?.body ?? crew.body} layer={testMode?.layer ?? "surface"} scores={testMode?.scores ?? shownScores} selected={testMode ? testMode.selected : selectedKey} onSelect={choose} framing={1.1} showIndicators={!testMode} checkpointItems={checkpointItems} explorationRequest={exploration} colorScale={testMode ? undefined : colorScale} indicatorText={testMode ? undefined : indicatorText}/>
        </div></div>
        {!testMode && <ul className="legend-levels glass-sm" aria-label="Colour scale">
          {levels.map(level => <li key={level.level}><i style={{ background: levelColor(level.level) }}/><span>{level.label}<small>{level.range}</small></span></li>)}
          <li><i className="not-assessed"/><span>Not measured<small>no valid test</small></span></li>
        </ul>}
      </div>

      <div className="strength-groups glass">
        <header className="groups-head"><h2 id="strength-groups-title">Muscle groups</h2><span>Change vs pre-flight · {current.phase === 'pre' ? 'Pre' : current.label}</span></header>
        <p className="summary-intro">Largest loss first, at {current.phase === 'pre' ? 'the pre-flight reference' : `the ${current.label} test`}. Select a group to see its course and the reference.</p>
        <div className="insight-list" role="group" aria-labelledby="strength-groups-title">
          {rows.map(({ group: g, point }) => {
            const active = g.key === selectedGroup;
            const loss = point.changePct == null ? 0 : Math.min(100, Math.max(0, -point.changePct) / 30 * 100);
            return <button type="button" key={g.key} className={'insight-row' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(active && selectedKey ? selectedKey : g.keys[0])}>
              <span className="insight-marker" aria-hidden="true" style={{ background: levelColor(point.level) }}/>
              <span className="insight-main"><span className="insight-name">{g.name}</span><span className="insight-detail">{g.test} · {fmtNum(point.value)} {g.unit}</span><span className="insight-bar" aria-hidden="true"><i style={{ width: `${loss}%`, background: levelColor(point.level) }}/></span><span className="badges"><LevelBadge point={point} levels={levels}/><AlertBadge alert={g.alert}/></span></span>
              <span className="insight-change num">{fmtPct(point.changePct)}</span>
            </button>;
          })}
        </div>
        <p className="note">{notice} Levels, noise and alerts come from the HealthService. Trunk flexion is not shown: its bed-rest data runs the wrong way.</p>
      </div>

      <div className="strength-timeline"><Timeline label="Dynamometer tests" evaluations={evaluations} upcoming={upcoming} index={evalIndex} onPick={pickEvaluation}/></div>
    </section>

    {group && <MuscleDetail group={group} evaluations={evaluations} evalIndex={evalIndex} mission={mission} upcoming={upcoming} levels={levels}/>}

    {bodyState?.data ? <BodyTrends key={trendTarget} dashboard={bodyState.data} stale={Boolean(bodyState.error)}/> : <section id="trends" className="strength-trends-state glass" role={bodyState?.error ? 'alert' : 'status'}><h2>Trends</h2><p>{bodyState?.error ? 'Trend data is unavailable. Reconnecting…' : 'Loading trend data…'}</p></section>}

    <section className="method strength-method glass" aria-labelledby="method-title">
      <p className="eyebrow">Method</p>
      <h2 id="method-title">How it is measured</h2>
      <p className="lede">Percent change in peak torque against the pre-flight reference, per muscle group. Proposed method: an on-board isokinetic dynamometer (MARES-type, ESA), with NASA's <i>Medical Volume B 5.3</i> protocol. Reference: the CFT70 bed-rest study (NLSP MR079G).</p>
      <div className="method-grid">
        <div><h3>Equipment</h3><p>On-board isokinetic dynamometer. The precedent is MARES (ESA, Columbus module), used in flight in Sarcolab-3 (FD9, 49 and 131). NASA does not routinely measure strength in flight today: it monitors training on ARED. That is why this measurement is shown as a <b>proposed method</b>.</p></div>
        <div><h3>Protocol</h3><p>The same tests NASA runs before and after flight: knee at 60°/s, ankle at 30°/s and trunk at 60°/s, 3 to 5 maximal repetitions each. Peak torque in N·m, always in the same position and with the same device settings.</p></div>
        <div><h3>Schedule and levels</h3><p>Two pre-flight tests, averaged into the reference; in flight FD15 and then every 30 days (OCHMO-STD-100.1A Table 8 [6025]); R+5 and R+30. Change = (torque ÷ pre-flight torque − 1) × 100. Levels at 5, 10 and 20% worse; one test is often within its noise, so alerts look at the last two tests.</p></div>
        <div><h3>Reference and limits</h3><p>CFT70: 42 volunteers, 70 days of bed rest, no countermeasure, exercise and FLY groups. 41 of 42 are men; there are no measurements during bed rest. The reference measures one leg; the map shows both sides with the same value.</p></div>
      </div>
      <p className="source">Reference source: {reference.source}.</p>
    </section>
  </div>;
}
