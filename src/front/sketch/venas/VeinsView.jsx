import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../data/useDashboard.js';
import { GRADE_TEXT, LEVELS, SIDES, SIDE_LABEL, areaRows, dopplerTrace, fmt, loadVeins, shown, veinShape, veinsUrl, worseSide } from '../data/veins.js';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { PRESS_SECONDS, Vein3D } from './Vein3D.jsx';
import { SpectralDoppler, UltrasoundStudy } from './UltrasoundStudy.jsx';
import '../components/imaging.css';
import './style.css';

// Colours mirror theme/glass.css (recharts and three.js take plain colours, not CSS variables).
const T = { line: '#2238A8', other: '#7A859C', grid: 'rgba(23,32,57,.08)', tick: '#33405A', ink2: '#26324C', rule: 'rgba(23,32,57,.28)' };
const tick = { fontSize: 12, fill: T.tick };
const TONE = { normal: 'ok', check: 'warn', alarm: 'crit' };
// On the 3D body: each vein by its level (--ok-dot / --warn-dot / --crit-dot); carotids, vena cava and heart in neutral greys.
const DOT = { normal: '#23804F', check: '#C27800', alarm: '#A4242F' };
const NEUTRAL = { carotid_l: '#C9CED8', carotid_r: '#C9CED8', vena_cava_superior: '#BCC6D6', heart: '#D9DDE5' };

const Chip = ({ level }) => <span className="chip" data-tone={TONE[level] ?? 'ok'}>{LEVELS[level]?.short ?? level}</span>;

function BodyContext({ body, levels }) {
  const colors = useMemo(() => ({ ...NEUTRAL, ijv_r: DOT[levels.right], ijv_l: DOT[levels.left] }), [levels.right, levels.left]);
  const [exploration] = useState({ key: 'ijv_l', request: 1 });
  return <section className="img-where" aria-labelledby="vein-where-title">
    <div className="img-where-title glass-sm"><h2 id="vein-where-title">Where</h2>
      <p>Both jugular veins, coloured by their level, next to the carotid arteries on the way to the heart.</p></div>
    <div className="img-stage"><div className="img-halo" aria-hidden="true"/><div className="img-model">
      <BodyViewer body={body} layer="organs" structureColors={colors} selected="ijv_l" framing={1.1} explorationRequest={exploration}/>
    </div></div>
  </section>;
}

function AreaChart({ data, selectedDay }) {
  return <div className="img-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 280 }}>
    <LineChart data={areaRows(data)} margin={{ top: 24, right: 18, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke={T.grid}/>
      <ReferenceLine y={data.reference.supine} stroke={T.rule} strokeDasharray="2 4" label={{ value: `Published supine mean · ${data.reference.supine} mm²`, position: 'insideTopLeft', fill: T.ink2, fontSize: 12 }}/>
      <ReferenceLine x={data.scans.find(s => s.day === selectedDay)?.label} stroke={T.rule} strokeDasharray="1 5"/>
      <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0}/>
      <YAxis domain={[0, 'auto']} tick={tick} tickLine={false} axisLine={false} width={40}/>
      <Tooltip formatter={(v, name) => [`${fmt(v)} mm²`, name]}/>
      <Line dataKey="left" name="Left vein" stroke={T.line} strokeWidth={2.5} dot={{ r: 5, fill: T.line, stroke: '#fff', strokeWidth: 2 }} isAnimationActive={false}/>
      <Line dataKey="right" name="Right vein" stroke={T.other} strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3, fill: T.other }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

// The four published flow grades (Marshall-Goebel 2019, figure 3), the selected one highlighted.
function FlowPatterns({ shape }) {
  return <ul className="vein-flow-patterns" aria-label="Flow grades from Marshall-Goebel 2019">
    {[1, 2, 3, 4].map(grade => {
      const points = dopplerTrace(grade, 25, 60, 2), path = points.map((p, i) => `${i ? 'L' : 'M'}${(p.t * 48).toFixed(1)},${(15 + p.v / 25 * 11).toFixed(1)}`).join(' ');
      return <li key={grade} data-selected={!shape.clot && shape.grade === grade}><svg viewBox="0 0 96 30" aria-hidden="true"><line x1="0" x2="96" y1="15" y2="15" stroke="currentColor" opacity=".25"/><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span><b className="num">{grade}</b> {GRADE_TEXT[grade]}</span></li>;
    })}
  </ul>;
}

export function VeinsView({ apiUrl, crewId, body = 'male' }) {
  const { data, error } = useDashboard(crewId ? veinsUrl(apiUrl, crewId) : null, loadVeins);
  const scans = data?.scans || [];
  const [picked, setPicked] = useState(null), [sideChoice, setSideChoice] = useState(null);
  const [compress, setCompress] = useState(0), [pressing, setPressing] = useState(false);
  const [compare, setCompare] = useState(true), [paused, setPaused] = useState(false), [playing, setPlaying] = useState(false);
  const side = sideChoice ?? worseSide(data), index = picked == null ? scans.length - 1 : Math.min(picked, scans.length - 1);
  useEffect(() => { setPicked(null); setSideChoice(null); setPlaying(false); }, [crewId]);
  useEffect(() => { setCompress(0); setPressing(false); }, [crewId, side, index]);
  useEffect(() => {
    if (!compress) return undefined;
    setPressing(true); const timer = setTimeout(() => setPressing(false), PRESS_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [compress]);
  useEffect(() => {
    if (!playing) return undefined;
    const timer = setTimeout(() => { if (index >= scans.length - 1) setPlaying(false); else setPicked(index + 1); }, 2800);
    return () => clearTimeout(timer);
  }, [playing, index, scans.length]);

  if (!data) return <div className="flight-notice glass" role={error ? 'alert' : 'status'}><div><strong>{error ? 'Connection unavailable' : 'Loading the jugular scans…'}</strong>{error && <p>Reconnecting to the HealthService…</p>}</div></div>;
  const { status } = data, scan = scans[index], pre = scans.find(s => s.day < 0), shape = veinShape(scan, side);
  const preArea = pre?.values?.[side]?.ijv_csa ?? null;
  const imagingProps = { shape, compress, compare, preArea, paused };
  return <div className="imaging veins">
    <div className="img-main">
      <section className="glass img-status" aria-labelledby="vein-status-title" aria-live="polite">
        <div className="img-status-top"><h2 id="vein-status-title" className="eyebrow">Neck veins status</h2><Chip level={status.level}/></div>
        <p className="img-status-lead">{status.text}</p>
        <p className="img-status-detail">In space the jugular veins stay full all day, as when lying down on Earth, and in some astronauts the blood in the left vein slows, stops or flows back. The jugular ultrasound (OCHMO-STD-100.1A [6041], flight days 30 and 60 and 42 days before landing) checks both veins against your own pre-flight scan.</p>
        <p className="img-sides">{SIDES.map(s => <span key={s}>{SIDE_LABEL[s]} <Chip level={status.sides[s]}/></span>)}</p>
        {status.signs.length > 0 && <div className="img-alert" data-tone={status.level === 'alarm' ? 'crit' : 'warn'}>
          <strong>{status.level === 'alarm' ? 'Talk to the flight surgeon today' : 'Flight surgeon review'}</strong>
          <ul>{status.signs.map(s => <li key={`${s.side}-${s.sign}`}>{s.text}</li>)}</ul></div>}
        <p className="img-meta">{status.scanLabel ? `Latest in-flight scan: ${status.scanLabel}` : 'No scan in flight yet'}{data.simulated ? ' · Simulated data' : ''}</p>
      </section>
      <div className="img-side"><BodyContext body={body} levels={scan ? { right: scan.sides.right.level, left: scan.sides.left.level } : status.sides}/></div>
    </div>

    {!scan ? <p className="glass img-note">No jugular scan recorded yet.</p> : <section className="glass img-figure vein-study" aria-labelledby="vein-study-title">
      <div className="img-figure-head">
        <div><h2 id="vein-study-title">{SIDE_LABEL[side]} <small>{scan.label}</small></h2>
          <p>All views follow the same selected scan. Illustrations drawn from the simulated record, not acquired ultrasound images.</p></div>
        <Chip level={scan.sides[side].level}/>
      </div>
      <div className="img-controls">
        <div className="seg img-seg" role="group" aria-label="Vein">{SIDES.map(s => <button key={s} type="button" aria-pressed={s === side} onClick={() => setSideChoice(s)}>
          <i className="img-dot" data-tone={TONE[scan.sides[s].level]}/>{SIDE_LABEL[s]}</button>)}</div>
        <div className="img-steps">
          <div className="seg" role="group" aria-label="View options">
            <button type="button" aria-pressed={compare} onClick={() => setCompare(v => !v)}>Pre-flight outline</button>
            <button type="button" aria-pressed={paused} onClick={() => setPaused(v => !v)}>Pause motion</button>
          </div>
          <button type="button" className="btn-primary" onClick={() => setCompress(c => c + 1)} disabled={pressing}>{pressing ? 'Applying pressure…' : '↓ Compress the vein'}</button>
        </div>
      </div>

      <div className="vein-screens">
        <div className="vein-imaging-grid"><figure className="vein-anatomy"><Vein3D {...imagingProps} level={scan.sides[side].level} title={`${SIDE_LABEL[side]} at ${scan.label}: illustrative anatomical cutaway`}/>
          <figcaption><span><i className="vein-plane-key"/> Transverse ultrasound plane</span><span>Flow motion slowed ×25</span></figcaption>
        </figure><UltrasoundStudy {...imagingProps}/></div>
        <SpectralDoppler {...imagingProps}/>
      </div>

      <div className="img-alert vein-compression" data-tone={pressing && shape.clot ? 'crit' : 'info'} aria-live="polite">
        <strong>{pressing ? shape.clot ? 'The vein remains open under pressure.' : 'The vein collapses under pressure.' : 'Test the compression response.'}</strong>
        <p>{shape.clot ? 'The model records a vein that does not collapse. The drawn obstruction is a possible clot; its size and shape were not measured.' : 'Press "Compress the vein" to see the thin vein walls meet. The artery next to it keeps its round outline.'}</p>
      </div>
      <FlowPatterns shape={shape}/>

      <div className="img-steps">
        <div className="seg img-seg" role="group" aria-label="Scan">{scans.map((s, i) => <button key={s.day} type="button" aria-pressed={i === index} onClick={() => { setPlaying(false); setPicked(i); }}>
          <i className="img-dot" data-tone={TONE[s.sides[side].level]}/>{s.label}</button>)}</div>
        <button type="button" className="btn-link" aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { setPicked(0); setPlaying(true); } }}>{playing ? '❚❚ Pause the scans' : '▶ Play the scans'}</button>
      </div>
      <dl className="img-readings">
        <div><dt>Cross-sectional area</dt><dd><span className="num">{fmt(shape.area)} mm²</span><small>Pre-flight {fmt(preArea)} mm²</small></dd></div>
        <div><dt>Flow pattern</dt><dd><span className="num">{shape.clot ? 'No flow' : GRADE_TEXT[shape.grade]}</span><small>{shape.clot ? 'In this simulation' : `Grade ${shape.grade} of 4`}</small></dd></div>
        <div><dt>Compression</dt><dd><span className="num">{shape.clot ? 'Does not collapse' : 'Collapses'}</span><small>{shape.clot ? 'Possible obstruction' : 'Thin-walled vein'}</small></dd></div>
        <div><dt>Slow-blood echoes</dt><dd><span className="num">{data.echo[String(shape.echo)]}</span><small>From the selected scan</small></dd></div>
        <div><dt>Peak speed</dt><dd><span className="num">{fmt(shape.speed, 1)} cm/s</span><small>{shape.clot ? 'Includes simulated noise' : 'Toward the heart'}</small></dd></div>
      </dl>
    </section>}

    <section className="glass img-chart" aria-labelledby="vein-area-title">
      <div className="img-chart-head"><h2 id="vein-area-title">Area of the veins (mm²)</h2>
        <p>Each vein against its own pre-flight scan. In flight the vein is as full as lying down on Earth; the dashed line is a published group mean, not a safety threshold.</p></div>
      <AreaChart data={data} selectedDay={scan?.day}/>
      <ul className="img-legend"><li><i style={{ background: T.line }}/>Left vein</li><li><i className="dashed"/>Right vein</li></ul>
    </section>

    <section className="glass img-card" aria-labelledby="vein-table-title">
      <header><h3 id="vein-table-title">Every measurement</h3><span>{scan?.label ?? 'No scan'}</span></header>
      <div className="img-table-scroll"><table className="img-table"><thead><tr><th scope="col">Measurement</th>{SIDES.map(s => <th key={s} scope="col">{SIDE_LABEL[s]}</th>)}</tr></thead>
        <tbody>{data.measures.map(m => <tr key={m.measure}><th scope="row">{m.name}<small>{m.about}</small></th>{SIDES.map(s => <td key={s}><b>{shown(m, scan?.values?.[s]?.[m.measure])}</b><small>Pre-flight {shown(m, m.sides[s].baseline)}</small></td>)}</tr>)}</tbody></table></div>
    </section>

    <p className="glass img-note">The views follow the flow patterns and ultrasound examples in <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6902784/" target="_blank" rel="noreferrer">Marshall-Goebel et al., 2019 ↗</a> and the bilateral duplex approach in <a href="https://doi.org/10.1177/1358863X221086619" target="_blank" rel="noreferrer">Pavela et al., 2022 ↗</a>. In the spectral view, flow toward the heart is below zero, as in the publication. {data.notice}</p>
  </div>;
}
