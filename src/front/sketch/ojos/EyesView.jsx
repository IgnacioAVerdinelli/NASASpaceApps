import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../data/useDashboard.js';
import { CLASSES, EYES, EYE_LABEL, GROUPS, eyeShape, eyesUrl, fmt, loadEyes, octRows, shown, worseEye } from '../data/eyes.js';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { Eye3D } from './Eye3D.jsx';
import './style.css';

const LINES = [
  { key: 'trt', name: 'Retina around the disc', color: '#2f2850' },
  { key: 'mrw', name: 'Optic nerve rim', color: '#6d5fb8' },
  { key: 'choroid', name: 'Choroid', color: '#c0566a' },
];
const tick = { fontSize: 13, fill: '#4f5874' };
const CLASS_COLORS = { none: '#9fc9ae', A: '#ef9959', B: '#d94d4b' };      // the body viewer's intensity palette

// Where: the same 3D body as the other analyses, organs layer, each eye coloured by its own SANS class.
function BodyContext({ body, classes }) {
  const colors = useMemo(() => ({ eye_r: CLASS_COLORS[classes.right], eye_l: CLASS_COLORS[classes.left] }), [classes.right, classes.left]);
  const [exploration] = useState({ key: 'eye_l', request: 1 });
  return <div className="eye-body"><BodyViewer body={body} layer="organs" structureColors={colors} selected="eye_l" framing={1.1} explorationRequest={exploration}/></div>;
}

function ClassPill({ cls }) {
  return <span className="eye-pill" data-class={cls}><i/>{CLASSES[cls]?.short ?? cls}</span>;
}

function EyePicker({ eye, classes, onPick }) {
  return <div className="eye-picker" role="radiogroup" aria-label="Eye">
    {EYES.map(e => <button key={e} type="button" role="radio" aria-checked={e === eye} data-class={classes[e]} onClick={() => onPick(e)}>
      {EYE_LABEL[e]}<i/>
    </button>)}
  </div>;
}

function ExamPicker({ exams, index, onPick, playing, onPlay, eye }) {
  return <div className="exam-picker">
    <button type="button" className="exam-play" onClick={onPlay} aria-pressed={playing}>{playing ? '❚❚ Pause' : '▶ Play the mission'}</button>
    <div className="exam-steps" role="radiogroup" aria-label="Exam">
      {exams.map((e, i) => <button key={e.day} type="button" role="radio" aria-checked={i === index} data-class={e.eyes?.[eye]?.class ?? e.class} onClick={() => onPick(i)}>
        <span>{e.label}</span><i/>
      </button>)}
    </div>
  </div>;
}

function Facts({ exam, eye }) {
  const c = exam.changes?.[eye] || {}, v = exam.values?.[eye] || {};
  const rows = [
    ['Swelling at the optic disc', `${fmt(c.oct_trt, 0, true)} µm`],
    ['Choroid', `${fmt(c.oct_choroid, 0, true)} µm`],
    ['Nerve sheath', `${fmt(c.onsd, 2, true)} mm`],
    ['Folds', v.choroidal_folds >= 1 ? 'Seen' : 'Not seen'],
    ['Back of the eye', v.globe_flattening >= 1 ? 'Flattened' : 'Round'],
  ];
  return <dl className="eye-facts">{rows.map(([k, val]) => <div key={k}><dt>{k}</dt><dd>{val}</dd></div>)}</dl>;
}

function OctChart({ data, eye }) {
  const rows = octRows(data, eye);
  const other = eye === 'right' ? 'left' : 'right';
  const th = data.thresholds.oct_trt;
  const values = rows.flatMap(r => [r.trt, r.mrw, r.choroid, r.otherTrt]).filter(v => v != null);
  const top = Math.max(th.B + 15, ...values);
  const bottom = Math.min(-10, ...values);
  const lo = Math.floor(bottom / 20) * 20, hi = Math.ceil(top / 20) * 20;
  const ticks = Array.from({ length: (hi - lo) / 20 + 1 }, (_, i) => lo + i * 20);
  return <div className="oct-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 300 }}>
    <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#e4e3ef"/>
      <ReferenceLine y={0} stroke="#9096ad"/>
      <ReferenceLine y={th.A} stroke="#c98a0b" strokeDasharray="6 4" label={{ value: `Class A: retina +${th.A} µm`, position: 'insideTopLeft', fill: '#8a5a00', fontSize: 12.5 }}/>
      <ReferenceLine y={th.B} stroke="#a4242f" strokeDasharray="6 4" label={{ value: `Class B: retina +${th.B} µm`, position: 'insideTopLeft', fill: '#a4242f', fontSize: 12.5 }}/>
      <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0}/>
      <YAxis domain={[lo, hi]} ticks={ticks} tickFormatter={v => fmt(v, 0, true)} tick={tick} tickLine={false} axisLine={false} width={44}/>
      <Tooltip formatter={(v, name) => [`${fmt(v, 0, true)} µm`, name]}/>
      {LINES.map(l => <Line key={l.key} dataKey={l.key} name={l.name} stroke={l.color} strokeWidth={l.key === 'trt' ? 3 : 2}
        dot={{ r: l.key === 'trt' ? 6 : 4, fill: l.color, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>)}
      <Line dataKey="otherTrt" name={`Retina, ${EYE_LABEL[other].toLowerCase()}`} stroke="#9b97b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: '#9b97b8' }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function EyeCell({ m, eye }) {
  const e = m.eyes?.[eye];
  if (!e?.latest) return <td>—</td>;
  const change = m.flag || e.latest.change == null ? null : `${fmt(e.latest.change, m.decimals, true)} ${m.unit}`;
  const before = m.flag ? (m.measure === 'frisen_grade' ? 'Grade 0' : 'Not seen') : shown(m, e.baseline);
  return <td><b>{shown(m, e.latest.value)}</b>{change && <span className="eye-change"> {change}</span>}<small>Pre-flight {before}</small></td>;
}

function TestCard({ group, measures, last }) {
  return <article className="panel eye-card">
    <header><h3>{group.title}</h3><span>{group.device}</span></header>
    <p>{group.about}</p>
    <table>
      <thead><tr><th scope="col">Measure{last ? ` · ${last}` : ''}</th>{EYES.map(e => <th key={e} scope="col">{EYE_LABEL[e]}</th>)}</tr></thead>
      <tbody>{measures.map(m => <tr key={m.measure}>
        <th scope="row">{m.name}<small>{m.about}</small></th>
        {EYES.map(e => <EyeCell key={e} m={m} eye={e}/>)}
      </tr>)}</tbody>
    </table>
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

  if (!data) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load the eye exams. Retrying automatically…' : 'Loading the eye exams…'}</div>;
  const { status } = data;
  const exam = exams[index];
  const pre = exams.find(e => e.day < 0);
  const byGroup = GROUPS.map(g => ({ group: g, measures: data.measures.filter(m => m.group === g.id) }));
  return <div className="eyes-view">
    <div className="eyes-intro">
      <div><h2>Eyes</h2>
        <p>Without gravity, fluid shifts toward the head and the pressure on the back of the eye never drops, as it does on Earth each time you stand up. Over months the optic disc can swell, the choroid thickens, folds appear and the eye gets shorter, so near vision worsens. This is SANS, seen in most long-duration astronauts. The eye exam (OCHMO-STD-100.1A [6012], on flight days 30 and 90 and 30 days before landing) compares every exam with your own pre-flight one.</p></div>
      {data.simulated && <span className="demo-label">SIMULATED DATA</span>}
    </div>

    <section className="panel eye-status" data-class={status.class} aria-live="polite">
      <div className="eye-status-main">
        <ClassPill cls={status.class}/>
        <div><h3>{CLASSES[status.class]?.label}</h3><p>{status.text}</p></div>
      </div>
      {status.signs.length > 0 && <ul className="eye-signs">{status.signs.map(s => <li key={s.sign} data-class={s.class}>{s.text}</li>)}</ul>}
      <p className="eye-status-eyes">{EYES.map(e => <span key={e}>{EYE_LABEL[e]} <ClassPill cls={status.eyes[e]}/></span>)}</p>
      <p className="eye-status-meta">{status.examLabel ? `Last exam in flight: ${status.examLabel}` : 'No exam in flight yet'}{status.worstClass !== 'none' && status.worstClass !== status.class ? ` · Highest so far: ${CLASSES[status.worstClass].short} at ${status.worstLabel}` : ''}</p>
    </section>

    {exams.length === 0 ? <p className="connection-notice">No eye exam recorded yet.</p> : <div className="eye-main">
      <figure className="panel eye-figure">
        <figcaption><div><strong>{EYE_LABEL[eye]} at {exam.label}</strong><span>Cut in half to show the layers. Drag to rotate. {pre && exam.day >= 0 ? `Dashed: ${pre.label}, before flight. ` : ''}Changes drawn about 40 times larger so they can be seen.</span></div><ClassPill cls={exam.eyes[eye].class}/></figcaption>
        <EyePicker eye={eye} classes={{ right: exam.eyes.right.class, left: exam.eyes.left.class }} onPick={setEyeChoice}/>
        <Eye3D shape={eyeShape(exam, eye)} cls={exam.eyes[eye].class} title={`3D cut of the ${eye} eye at ${exam.label}`}/>
        <ExamPicker exams={exams} index={index} eye={eye} onPick={i => { setPlaying(false); setPicked(i); }} playing={playing}
          onPlay={() => { if (!playing) setPicked(0); setPlaying(p => !p); }}/>
        <Facts exam={exam} eye={eye}/>
      </figure>
      <div className="eye-side">
      <figure className="panel eye-where">
        <figcaption><div><strong>Where</strong><span>Each eye coloured by its own class at {exam.label}: right {CLASSES[exam.eyes.right.class].short}, left {CLASSES[exam.eyes.left.class].short}.</span></div></figcaption>
        <BodyContext body={body} classes={{ right: exam.eyes.right.class, left: exam.eyes.left.class }}/>
      </figure>
      <figure className="panel eye-oct">
        <figcaption><div><strong>OCT · {EYE_LABEL[eye].toLowerCase()} · change from pre-flight (µm)</strong><span>The retina around the optic disc is the first sign of SANS. The lines are the 2026 expert consensus classes; dashed grey is the other eye's retina.</span></div></figcaption>
        <OctChart data={data} eye={eye}/>
        <ul className="oct-legend">{LINES.map(l => <li key={l.key}><i style={{ background: l.color }}/>{l.name}</li>)}<li><i className="dashed"/>{EYE_LABEL[eye === 'right' ? 'left' : 'right']}, retina</li></ul>
      </figure>
      </div>
    </div>}

    <div className="eye-cards">{byGroup.map(({ group, measures }) => <TestCard key={group.id} group={group} measures={measures} last={data.latest?.label}/>)}</div>
    <p className="eye-notice">{data.notice}</p>
  </div>;
}
