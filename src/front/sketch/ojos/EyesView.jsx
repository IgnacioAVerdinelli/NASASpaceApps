import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../data/useDashboard.js';
import { CLASSES, EYES, EYE_LABEL, GROUPS, eyeShape, eyesUrl, fmt, loadEyes, octRows, shown, worseEye } from '../data/eyes.js';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { Eye3D } from './Eye3D.jsx';
import '../components/imaging.css';
import './style.css';

// Colours mirror theme/glass.css (recharts and three.js take plain colours, not CSS variables).
const T = {
  line: '#2238A8',            // --chart-line
  line2: '#26324C',           // --ink-2
  line3: '#B24A18',           // --chart-strength
  grid: 'rgba(23,32,57,.08)', // --chart-grid
  tick: '#33405A',            // --chart-tick
  other: '#7A859C',
  warn: '#C27800', warnInk: '#5C3600', // --warn-dot / --warn-ink: class A
  crit: '#A4242F', critInk: '#8C1D28', // --crit-dot / --crit-ink: class B
};
const LINES = [
  { key: 'trt', name: 'Retina around the disc', color: T.line },
  { key: 'mrw', name: 'Optic nerve rim', color: T.line2 },
  { key: 'choroid', name: 'Choroid', color: T.line3 },
];
const tick = { fontSize: 12, fill: T.tick };
const TONE = { none: 'ok', A: 'warn', B: 'crit' };
const DOT = { none: '#23804F', A: T.warn, B: T.crit };   // --ok-dot / --warn-dot / --crit-dot, on the 3D body

const Chip = ({ cls }) => <span className="chip" data-tone={TONE[cls] ?? 'ok'}>{CLASSES[cls]?.short ?? cls}</span>;

// Where: the same 3D body as the other analyses, organs layer, each eye coloured by its own SANS class.
function BodyContext({ body, classes, label }) {
  const colors = useMemo(() => ({ eye_r: DOT[classes.right], eye_l: DOT[classes.left] }), [classes.right, classes.left]);
  const [exploration] = useState({ key: 'eye_l', request: 1 });
  return <section className="img-where" aria-labelledby="eye-where-title">
    <div className="img-where-title glass-sm"><h2 id="eye-where-title">Where</h2>
      <p>Each eye coloured by its class at {label}: right {CLASSES[classes.right].short}, left {CLASSES[classes.left].short}.</p></div>
    <div className="img-stage"><div className="img-halo" aria-hidden="true"/><div className="img-model">
      <BodyViewer body={body} layer="organs" structureColors={colors} selected="eye_l" framing={1.1} explorationRequest={exploration}/>
    </div></div>
  </section>;
}

function OctChart({ data, eye }) {
  const rows = octRows(data, eye);
  const other = eye === 'right' ? 'left' : 'right';
  const th = data.thresholds.oct_trt;
  const values = rows.flatMap(r => [r.trt, r.mrw, r.choroid, r.otherTrt]).filter(v => v != null);
  const lo = Math.floor(Math.min(-10, ...values) / 20) * 20, hi = Math.ceil(Math.max(th.B + 15, ...values) / 20) * 20;
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, i) => lo + i * 20);
  return <div className="img-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 300 }}>
    <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke={T.grid}/>
      <ReferenceLine y={0} stroke="rgba(23,32,57,.28)"/>
      <ReferenceLine y={th.A} stroke={T.warn} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `Class A: retina +${th.A} µm`, position: 'insideTopLeft', fill: T.warnInk, fontSize: 12, fontWeight: 600 }}/>
      <ReferenceLine y={th.B} stroke={T.crit} strokeWidth={1.5} strokeDasharray="6 4" label={{ value: `Class B: retina +${th.B} µm`, position: 'insideTopLeft', fill: T.critInk, fontSize: 12, fontWeight: 600 }}/>
      <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0}/>
      <YAxis domain={[lo, hi]} ticks={ticks} tickFormatter={v => fmt(v, 0, true)} tick={tick} tickLine={false} axisLine={false} width={44}/>
      <Tooltip formatter={(v, name) => [`${fmt(v, 0, true)} µm`, name]}/>
      {LINES.map(l => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.key === 'trt' ? 2.5 : 2}
        dot={{ r: l.key === 'trt' ? 5.5 : 4, fill: l.color, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>)}
      <Line dataKey="otherTrt" name={`Retina, ${EYE_LABEL[other].toLowerCase()}`} stroke={T.other} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: T.other }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function EyeCell({ m, eye }) {
  const e = m.eyes?.[eye];
  if (!e?.latest) return <td>—</td>;
  const change = m.flag || e.latest.change == null ? null : `${fmt(e.latest.change, m.decimals, true)} ${m.unit}`;
  const before = m.flag ? (m.measure === 'frisen_grade' ? 'Grade 0' : 'Not seen') : shown(m, e.baseline);
  return <td><b>{shown(m, e.latest.value)}</b>{change && <span className="img-change"> {change}</span>}<small>Pre-flight {before}</small></td>;
}

function TestCard({ group, measures, last }) {
  return <article className="glass img-card">
    <header><h3>{group.title}</h3><span>{group.device}</span></header>
    <p>{group.about}</p>
    <div className="img-table-scroll"><table className="img-table">
      <thead><tr><th scope="col">Measure{last ? ` · ${last}` : ''}</th>{EYES.map(e => <th key={e} scope="col">{EYE_LABEL[e]}</th>)}</tr></thead>
      <tbody>{measures.map(m => <tr key={m.measure}>
        <th scope="row">{m.name}<small>{m.about}</small></th>
        {EYES.map(e => <EyeCell key={e} m={m} eye={e}/>)}
      </tr>)}</tbody>
    </table></div>
  </article>;
}

export function EyesView({ apiUrl, crewId, body = 'male' }) {
  const { data, error } = useDashboard(crewId ? eyesUrl(apiUrl, crewId) : null, loadEyes);
  const exams = data?.exams || [];
  const [picked, setPicked] = useState(null);       // null follows the latest exam
  const [playing, setPlaying] = useState(false);
  const [eyeChoice, setEyeChoice] = useState(null);  // null shows the worse eye
  const eye = eyeChoice ?? worseEye(data);
  const index = picked == null ? exams.length - 1 : Math.min(picked, exams.length - 1);
  useEffect(() => { setPicked(null); setPlaying(false); setEyeChoice(null); }, [crewId]);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setInterval(() => setPicked(i => {
      const next = (i == null ? 0 : i + 1);
      if (next >= exams.length - 1) { setPlaying(false); return null; }
      return next;
    }), 1400);
    return () => clearInterval(timer);
  }, [playing, exams.length]);

  if (!data) return <div className="flight-notice glass" role={error ? 'alert' : 'status'}><div><strong>{error ? 'Connection unavailable' : 'Loading the eye exams…'}</strong>{error && <p>Reconnecting to the HealthService…</p>}</div></div>;
  const { status } = data;
  const exam = exams[index];
  const pre = exams.find(e => e.day < 0);
  const byGroup = GROUPS.map(g => ({ group: g, measures: data.measures.filter(m => m.group === g.id) }));
  const c = exam?.changes?.[eye] || {}, v = exam?.values?.[eye] || {};
  return <div className="imaging eyes">
    <div className="img-main">
      {!exam ? <section className="glass img-figure"><p>No eye exam recorded yet.</p></section> : <section className="glass img-figure" aria-labelledby="eye-figure-title">
        <div className="img-figure-head">
          <div><h2 id="eye-figure-title">{EYE_LABEL[eye]} <small>{exam.label}</small></h2>
            <p>Cut in half to show the layers; drag to rotate. {pre && exam.day >= 0 ? `Dashed: ${pre.label}, before flight. ` : ''}Changes drawn about 40 times larger so they can be seen.</p></div>
          <Chip cls={exam.eyes[eye].class}/>
        </div>
        <div className="img-controls">
          <div className="seg img-seg" role="group" aria-label="Eye">{EYES.map(e => <button key={e} type="button" aria-pressed={e === eye} onClick={() => setEyeChoice(e)}>
            <i className="img-dot" data-tone={TONE[exam.eyes[e].class]}/>{EYE_LABEL[e]}</button>)}</div>
          <button type="button" className="btn-primary" onClick={() => { if (!playing) setPicked(0); setPlaying(p => !p); }} aria-pressed={playing}>{playing ? '❚❚ Pause' : '▶ Play the mission'}</button>
        </div>
        <Eye3D shape={eyeShape(exam, eye)} cls={exam.eyes[eye].class} title={`3D cut of the ${eye} eye at ${exam.label}`}/>
        <div className="seg img-seg" role="group" aria-label="Exam">{exams.map((e, i) => <button key={e.day} type="button" aria-pressed={i === index} onClick={() => { setPlaying(false); setPicked(i); }}>
          <i className="img-dot" data-tone={TONE[e.eyes?.[eye]?.class ?? e.class]}/>{e.label}</button>)}</div>
        <dl className="img-readings">
          <div><dt>Swelling at the optic disc</dt><dd><span className="num">{fmt(c.oct_trt, 0, true)}</span><small>µm from pre-flight</small></dd></div>
          <div><dt>Choroid</dt><dd><span className="num">{fmt(c.oct_choroid, 0, true)}</span><small>µm from pre-flight</small></dd></div>
          <div><dt>Nerve sheath</dt><dd><span className="num">{fmt(c.onsd, 2, true)}</span><small>mm from pre-flight</small></dd></div>
          <div><dt>Folds</dt><dd><span className="num">{v.choroidal_folds >= 1 ? 'Seen' : 'Not seen'}</span></dd></div>
          <div><dt>Back of the eye</dt><dd><span className="num">{v.globe_flattening >= 1 ? 'Flattened' : 'Round'}</span></dd></div>
        </dl>
      </section>}

      <div className="img-side">
        <section className="glass img-status" aria-labelledby="eye-status-title" aria-live="polite">
          <div className="img-status-top"><h2 id="eye-status-title" className="eyebrow">SANS status</h2><Chip cls={status.class}/></div>
          <p className="img-status-lead">{status.text}</p>
          <p className="img-status-detail">Without gravity, fluid shifts toward the head and the pressure behind the eye never drops. The eye exam (OCHMO-STD-100.1A [6012], flight days 30 and 90 and 30 days before landing) compares each eye with its own pre-flight exam.</p>
          <p className="img-sides">{EYES.map(e => <span key={e}>{EYE_LABEL[e]} <Chip cls={status.eyes[e]}/></span>)}</p>
          {status.signs.length > 0 && <div className="img-alert" data-tone={status.class === 'B' ? 'crit' : 'warn'}>
            <strong>{status.class === 'B' ? 'Flight surgeon review now' : 'Flight surgeon review'}</strong>
            <ul>{status.signs.map(s => <li key={`${s.eye}-${s.sign}`}>{s.text}</li>)}</ul></div>}
          <p className="img-meta">{status.examLabel ? `Last exam in flight: ${status.examLabel}` : 'No exam in flight yet'}{status.worstClass !== 'none' && status.worstClass !== status.class ? ` · Highest so far: ${CLASSES[status.worstClass].short} at ${status.worstLabel}` : ''}{data.simulated ? ' · Simulated data' : ''}</p>
        </section>
        {exam && <BodyContext body={body} classes={{ right: exam.eyes.right.class, left: exam.eyes.left.class }} label={exam.label}/>}
      </div>
    </div>

    <section className="glass img-chart" aria-labelledby="oct-title">
      <div className="img-chart-head"><h2 id="oct-title">OCT · {EYE_LABEL[eye].toLowerCase()} · change from pre-flight (µm)</h2>
        <p>The retina around the optic disc is the first sign of SANS. The dashed lines are the 2026 expert consensus classes; the grey line is the other eye's retina.</p></div>
      <OctChart data={data} eye={eye}/>
      <ul className="img-legend">{LINES.map(l => <li key={l.key}><i style={{ background: l.color }}/>{l.name}</li>)}<li><i className="dashed"/>{EYE_LABEL[eye === 'right' ? 'left' : 'right']}, retina</li></ul>
    </section>

    <div className="img-cards">{byGroup.map(({ group, measures }) => <TestCard key={group.id} group={group} measures={measures} last={data.latest?.label}/>)}</div>
    <p className="glass img-note">{data.notice}</p>
  </div>;
}
