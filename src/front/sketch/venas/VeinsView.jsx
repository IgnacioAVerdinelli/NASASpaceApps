import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../data/useDashboard.js';
import { LEVELS, LEVEL_COLORS, SIDES, SIDE_LABEL, areaRows, dopplerTrace, fmt, loadVeins, shown, veinShape, veinsUrl, worseSide } from '../data/veins.js';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { PRESS_SECONDS, Vein3D } from './Vein3D.jsx';
import './style.css';

const tick = { fontSize: 13, fill: '#4f5874' };

// Where: the same 3D body as the other analyses, organs layer, each jugular vein coloured by its level.
function BodyContext({ body, levels }) {
  const colors = useMemo(() => ({ ijv_r: LEVEL_COLORS[levels.right], ijv_l: LEVEL_COLORS[levels.left],
    carotid_l: '#d3c3c6', carotid_r: '#d3c3c6', vena_cava_superior: '#c4cfdf', heart: '#e4d6d8' }), [levels.right, levels.left]);
  const [exploration] = useState({ key: 'ijv_l', request: 1 });
  return <div className="vein-body"><BodyViewer body={body} layer="organs" structureColors={colors} selected="ijv_l" framing={1.1} explorationRequest={exploration}/></div>;
}

const Pill = ({ level }) => <span className="vein-pill" data-level={level}><i/>{LEVELS[level]?.short ?? level}</span>;

function Doppler({ shape }) {
  const pts = dopplerTrace(shape.clot ? 3 : shape.grade, shape.clot ? 0 : shape.speed);
  const w = 420, h = 120, max = 45;
  const y = v => h / 2 - Math.max(-max, Math.min(max, v)) / max * (h / 2 - 8);
  const d = pts.map((p, i) => `${i ? 'L' : 'M'}${(p.t / 2 * w).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ');
  return <svg className="vein-doppler" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Illustrative Doppler trace for this flow grade">
    <rect width={w} height={h} rx="8" fill="#14161f"/>
    <line x1="0" x2={w} y1={h / 2} y2={h / 2} stroke="#5d6380" strokeDasharray="4 4"/>
    <path d={`${d} L${w},${h / 2} L0,${h / 2} Z`} fill="#4f8fd8" opacity=".35"/>
    <path d={d} fill="none" stroke="#9cc6ff" strokeWidth="2"/>
    <text x="8" y="16" fill="#c9cde0" fontSize="12">toward the heart</text>
    <text x="8" y={h - 8} fill="#c9cde0" fontSize="12">toward the head</text>
  </svg>;
}

function AreaChart({ data }) {
  const rows = areaRows(data), ref = data.reference;
  return <div className="vein-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 480, height: 280 }}>
    <LineChart data={rows} margin={{ top: 12, right: 16, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#e4e3ef"/>
      <ReferenceLine y={ref.supine} stroke="#625992" strokeDasharray="6 4" label={{ value: `Lying down on Earth ${ref.supine}`, position: 'insideTopLeft', fill: '#625992', fontSize: 12 }}/>
      <ReferenceLine y={ref.seated} stroke="#9096ad" strokeDasharray="6 4" label={{ value: `Sitting on Earth ${ref.seated}`, position: 'insideBottomLeft', fill: '#59617b', fontSize: 12 }}/>
      <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0}/>
      <YAxis domain={[0, 'auto']} tick={tick} tickLine={false} axisLine={false} width={40}/>
      <Tooltip formatter={(v, name) => [`${fmt(v)} mm²`, name]}/>
      <Line dataKey="left" name="Left vein" stroke="#2f2850" strokeWidth={3} dot={{ r: 5 }} isAnimationActive={false}/>
      <Line dataKey="right" name="Right vein" stroke="#9b97b8" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

export function VeinsView({ apiUrl, crewId, body = 'male' }) {
  const { data, error } = useDashboard(crewId ? veinsUrl(apiUrl, crewId) : null, loadVeins);
  const scans = data?.scans || [];
  const [picked, setPicked] = useState(null);
  const [sideChoice, setSideChoice] = useState(null);
  const [compress, setCompress] = useState(0);
  const [pressing, setPressing] = useState(false);
  const side = sideChoice ?? worseSide(data);
  const index = picked == null ? scans.length - 1 : Math.min(picked, scans.length - 1);
  useEffect(() => { setPicked(null); setSideChoice(null); }, [crewId]);
  useEffect(() => {
    if (!compress) return undefined;
    setPressing(true);
    const t = setTimeout(() => setPressing(false), PRESS_SECONDS * 1000);
    return () => clearTimeout(t);
  }, [compress]);

  if (!data) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load the jugular scans. Retrying automatically…' : 'Loading the jugular scans…'}</div>;
  const { status } = data;
  const scan = scans[index];
  const pre = scans.find(s => s.day < 0);
  const shape = veinShape(scan, side);
  return <div className="veins-view">
    <div className="veins-intro">
      <div><h2>Neck veins</h2>
        <p>In space the blood shifts toward the head and the jugular veins stay full all day, as when lying down on Earth. In some astronauts the blood in the left vein slows down, stands still or flows back, and clots have formed without symptoms. The jugular ultrasound (OCHMO-STD-100.1A [6041], on flight days 30 and 60 and 42 days before landing) checks both veins against your own pre-flight scan.</p></div>
      {data.simulated && <span className="demo-label">SIMULATED DATA</span>}
    </div>

    <section className="panel vein-status" data-level={status.level} aria-live="polite">
      <div className="vein-status-main"><Pill level={status.level}/><div><h3>{LEVELS[status.level]?.label}</h3><p>{status.text}</p></div></div>
      {status.signs.length > 0 && <ul className="vein-signs">{status.signs.map(s => <li key={`${s.side}-${s.sign}`} data-level={s.level}>{s.text}</li>)}</ul>}
      <p className="vein-status-meta">{SIDES.map(s => <span key={s}>{SIDE_LABEL[s]} <Pill level={status.sides[s]}/></span>)}
        <span>{status.scanLabel ? `Last scan in flight: ${status.scanLabel}` : 'No scan in flight yet'}</span></p>
    </section>

    {!scan ? <p className="connection-notice">No jugular scan recorded yet.</p> : <div className="vein-main">
      <figure className="panel vein-figure">
        <figcaption><div><strong>{SIDE_LABEL[side]} at {scan.label}</strong>
          <span>Area and speed to scale; drag to rotate. {pre && scan.day >= 0 ? `Dashed: ${pre.label}, before flight. ` : ''}Press the probe to see if the vein collapses.</span></div>
          <Pill level={scan.sides[side].level}/></figcaption>
        <div className="vein-controls">
          <div className="vein-tabs" role="radiogroup" aria-label="Vein">{SIDES.map(s => <button key={s} type="button" role="radio" aria-checked={s === side} data-level={scan.sides[s].level} onClick={() => setSideChoice(s)}>{SIDE_LABEL[s]}<i/></button>)}</div>
          <button type="button" className="vein-press" onClick={() => setCompress(c => c + 1)} disabled={pressing}>{pressing ? 'Pressing…' : 'Press the probe'}</button>
        </div>
        <Vein3D shape={shape} level={scan.sides[side].level} compress={compress} preArea={pre?.values?.[side]?.ijv_csa ?? null} title={`The ${side} jugular vein at ${scan.label}`}/>
        <div className="vein-tabs vein-scans" role="radiogroup" aria-label="Scan">{scans.map((s, i) => <button key={s.day} type="button" role="radio" aria-checked={i === index} data-level={s.sides[side].level} onClick={() => setPicked(i)}>{s.label}<i/></button>)}</div>
        <dl className="vein-facts">
          <div><dt>Area</dt><dd>{fmt(shape.area)} mm²</dd></div>
          <div><dt>Flow</dt><dd>{data.grades[String(shape.grade)]}</dd></div>
          <div><dt>Echoes</dt><dd>{data.echo[String(shape.echo)]}</dd></div>
          <div><dt>Collapses</dt><dd>{shape.clot ? 'No' : 'Yes'}</dd></div>
          <div><dt>Peak speed</dt><dd>{fmt(shape.speed, 1)} cm/s</dd></div>
        </dl>
      </figure>
      <div className="vein-side">
        <figure className="panel vein-where"><figcaption><div><strong>Where</strong><span>Both jugular veins, coloured by their level at {scan.label}. Drawn along the carotid arteries for orientation.</span></div></figcaption>
          <BodyContext body={body} levels={{ right: scan.sides.right.level, left: scan.sides.left.level }}/></figure>
        <figure className="panel"><figcaption><div><strong>Doppler · {SIDE_LABEL[side].toLowerCase()}</strong><span>Drawn from the flow grade, not recorded: what the screen shows for “{data.grades[String(shape.grade)].toLowerCase()}”.</span></div></figcaption>
          <Doppler shape={shape}/></figure>
        <figure className="panel"><figcaption><div><strong>Area of the veins (mm²)</strong><span>In flight the vein is as full as lying down on Earth (Marshall-Goebel 2019); the area alone raises no alert.</span></div></figcaption>
          <AreaChart data={data}/></figure>
      </div>
    </div>}

    <article className="panel vein-card">
      <h3>Every measure of the last scan{data.latest ? ` · ${data.latest.label}` : ''}</h3>
      <table><thead><tr><th scope="col">Measure</th>{SIDES.map(s => <th key={s} scope="col">{SIDE_LABEL[s]}</th>)}</tr></thead>
        <tbody>{data.measures.map(m => <tr key={m.measure}><th scope="row">{m.name}<small>{m.about}</small></th>
          {SIDES.map(s => { const e = m.sides[s]; return <td key={s}><b>{shown(m, e.latest?.value)}</b><small>Pre-flight {shown(m, e.baseline)}</small></td>; })}</tr>)}</tbody></table>
    </article>
    <p className="vein-notice">{data.notice}</p>
  </div>;
}
