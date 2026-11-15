import React, { useEffect, useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useDashboard } from '../data/useDashboard.js';
import { GRADE_TEXT, LEVELS, LEVEL_COLORS, SIDES, SIDE_LABEL, areaRows, dopplerTrace, fmt, loadVeins, shown, veinShape, veinsUrl, worseSide } from '../data/veins.js';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { PRESS_SECONDS, Vein3D } from './Vein3D.jsx';
import { SpectralDoppler, UltrasoundStudy } from './UltrasoundStudy.jsx';
import './style.css';

const tick = { fontSize: 12, fill: '#63716d' };
const Pill = ({ level }) => <span className="vein-pill" data-level={level}><i/>{LEVELS[level]?.short ?? level}</span>;

function BodyContext({ body, levels }) {
  const colors = useMemo(() => ({ ijv_r: LEVEL_COLORS[levels.right], ijv_l: LEVEL_COLORS[levels.left], carotid_l: '#d3c3c6', carotid_r: '#d3c3c6', vena_cava_superior: '#c4cfdf', heart: '#e4d6d8' }), [levels.right, levels.left]);
  const [exploration] = useState({ key: 'ijv_l', request: 1 });
  return <div className="vein-body"><BodyViewer body={body} layer="organs" structureColors={colors} selected="ijv_l" framing={1.1} explorationRequest={exploration}/></div>;
}

function AreaChart({ data, selectedDay }) {
  return <div className="vein-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: 250 }}>
    <LineChart data={areaRows(data)} margin={{ top: 24, right: 18, bottom: 4, left: 0 }}>
      <CartesianGrid vertical={false} stroke="#e3eae6"/>
      <ReferenceLine y={data.reference.supine} stroke="#7eaaa1" strokeDasharray="5 5" label={{ value: `Published supine mean · ${data.reference.supine} mm²`, position: 'insideTopLeft', fill: '#5b7d74', fontSize: 11 }}/>
      <ReferenceLine x={data.scans.find(s => s.day === selectedDay)?.label} stroke="#b8c8c0"/>
      <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={false} interval={0}/>
      <YAxis domain={[0, 'auto']} tick={tick} tickLine={false} axisLine={false} width={40}/>
      <Tooltip formatter={(v, name) => [`${fmt(v)} mm²`, name]}/>
      <Line dataKey="left" name="Left vein" stroke="#257a69" strokeWidth={2.5} dot={{ r: 4 }} isAnimationActive={false}/>
      <Line dataKey="right" name="Right vein" stroke="#9e7691" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function FlowPatterns({ shape }) {
  return <div className="vein-flow-patterns" aria-label="Reference patterns from Marshall-Goebel 2019">
    {[1, 2, 3, 4].map(grade => {
      const points = dopplerTrace(grade, 25, 60, 2), path = points.map((p, i) => `${i ? 'L' : 'M'}${(p.t * 48).toFixed(1)},${(15 + p.v / 25 * 11).toFixed(1)}`).join(' ');
      return <div key={grade} data-selected={!shape.clot && shape.grade === grade}><svg viewBox="0 0 96 30" aria-hidden="true"><line x1="0" x2="96" y1="15" y2="15" stroke="currentColor" opacity=".2"/><path d={path} fill="none" stroke="currentColor" strokeWidth="1.5"/></svg><span><b>{grade}</b>{GRADE_TEXT[grade]}</span></div>;
    })}
  </div>;
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

  if (!data) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load the jugular scans. Retrying automatically…' : 'Loading the jugular scans…'}</div>;
  const { status } = data, scan = scans[index], pre = scans.find(s => s.day < 0), shape = veinShape(scan, side);
  const preArea = pre?.values?.[side]?.ijv_csa ?? null;
  const imagingProps = { shape, compress, compare, preArea, paused };
  return <div className="veins-view">
    <header className="veins-intro"><div><p className="vein-eyebrow">VASCULAR HEALTH · JUGULAR DUPLEX</p><h2>A closer look at blood flow.</h2>
      <p>Explore the anatomy, ultrasound appearance and flow pattern of each neck-vein study, together.</p></div><span className="demo-label">SIMULATED STUDY</span></header>

    <section className="vein-status" data-level={status.level} aria-live="polite">
      <div className="vein-status-main"><span className="vein-status-icon" aria-hidden="true">{status.level === 'normal' ? '✓' : '!'}</span><div><h3>{LEVELS[status.level]?.label}</h3><p>{status.text}</p></div><Pill level={status.level}/></div>
      {status.signs.length > 0 && <ul className="vein-signs">{status.signs.map(s => <li key={`${s.side}-${s.sign}`}>{s.text}</li>)}</ul>}
      <div className="vein-status-meta"><span>Latest in-flight study <b>{status.scanLabel ?? 'Not available'}</b></span>{SIDES.map(s => <span key={s}>{SIDE_LABEL[s]} <Pill level={status.sides[s]}/></span>)}</div>
    </section>

    {!scan ? <p className="connection-notice">No jugular scan recorded yet.</p> : <section className="vein-study" aria-label="Interactive jugular study">
      <header className="vein-study-head"><div><p className="vein-eyebrow">SELECTED EXAMINATION</p><h3>{SIDE_LABEL[side]} <span>/{scan.label}</span></h3></div><Pill level={scan.sides[side].level}/>
        <div className="vein-side-picker" role="radiogroup" aria-label="Vein">{SIDES.map(s => <button key={s} type="button" role="radio" aria-checked={s === side} onClick={() => setSideChoice(s)}>{SIDE_LABEL[s]}<i data-level={scan.sides[s].level}/></button>)}</div>
      </header>
      <div className="vein-study-tools"><div className="vein-study-hint"><i/> All views follow the same selected study.</div><div className="vein-tool-buttons">
        <button type="button" aria-pressed={compare} onClick={() => setCompare(v => !v)} className="vein-compare">{compare ? '✓ ' : ''}Preflight outline</button>
        <button type="button" aria-pressed={paused} onClick={() => setPaused(v => !v)}>{paused ? '▷ Resume motion' : 'Ⅱ Pause motion'}</button>
        <button type="button" className="vein-press" onClick={() => setCompress(c => c + 1)} disabled={pressing}>{pressing ? 'Applying pressure…' : '↓ Compress the vein'}</button>
      </div></div>
      <div className="vein-imaging-grid"><figure className="vein-anatomy"><Vein3D {...imagingProps} level={scan.sides[side].level} title={`${SIDE_LABEL[side]} at ${scan.label}: illustrative anatomical cutaway`}/>
        <figcaption><span><i className="vein-plane-key"/> Transverse ultrasound plane</span><span>Flow motion slowed ×25</span></figcaption>
        <div className="vein-compression-result" data-active={pressing} aria-live="polite"><span className="vein-compression-mark" aria-hidden="true">↓</span><div><b>{pressing ? shape.clot ? 'The vein remains open.' : 'The vein collapses under pressure.' : 'Test the compression response.'}</b><p>{shape.clot ? 'The model records non-compressibility. The illustrated obstruction is a possible clot; its size and shape were not measured.' : 'Press the control to see the thin vein walls approach. The adjacent artery keeps its rounded outline.'}</p></div></div>
      </figure><UltrasoundStudy {...imagingProps}/></div>
      <SpectralDoppler {...imagingProps}/>
      <FlowPatterns shape={shape}/>
      <div className="vein-study-timeline"><div><p className="vein-eyebrow">FOLLOW THE STUDIES</p><span>From your own preflight reference.</span></div><div className="vein-scans" role="radiogroup" aria-label="Scan">{scans.map((s, i) => <button key={s.day} type="button" role="radio" aria-checked={i === index} onClick={() => { setPlaying(false); setPicked(i); }}><i data-level={s.sides[side].level}/><strong>{s.label}</strong><small>{s.day < 0 ? 'Preflight' : 'In-flight / follow-up'}</small></button>)}</div>
        <button type="button" className="vein-play" aria-pressed={playing} onClick={() => { if (playing) setPlaying(false); else { setPicked(0); setPlaying(true); } }}>{playing ? 'Ⅱ Pause studies' : '▷ Play studies'}</button>
      </div>
      <dl className="vein-facts"><div><dt>Cross-sectional area</dt><dd>{fmt(shape.area)} <small>mm²</small></dd><span>Preflight {fmt(preArea)} mm²</span></div>
        <div><dt>Flow pattern</dt><dd>{shape.clot ? 'No flow' : GRADE_TEXT[shape.grade]}</dd><span>{shape.clot ? 'In this simulation' : `Grade ${shape.grade} / 4`}</span></div>
        <div><dt>Compression</dt><dd>{shape.clot ? 'Does not collapse' : 'Compressible'}</dd><span>{shape.clot ? 'Possible obstruction' : 'Thin-walled lumen'}</span></div>
        <div><dt>Intraluminal echoes</dt><dd>{data.echo[String(shape.echo)]}</dd><span>From the selected record</span></div>
        <div><dt>Recorded model velocity</dt><dd>{fmt(shape.speed, 1)} <small>cm/s</small></dd><span>{shape.clot ? 'Includes simulated measurement noise' : 'Synthetic velocity'}</span></div></dl>
      <p className="vein-imaging-note">Illustrations generated from the simulated record, not acquired ultrasound images. Speckle, tissue, Doppler spectrum and obstruction geometry are illustrative. In the spectral view, heartward flow is below zero, matching the publication.</p>
    </section>}

    <div className="vein-bottom-grid"><figure className="panel vein-location"><figcaption><p className="vein-eyebrow">ANATOMICAL LOCATION</p><h3>Two veins. One return path.</h3><p>The jugular veins return blood from the head toward the heart, next to the carotid arteries.</p></figcaption><BodyContext body={body} levels={scan ? { right: scan.sides.right.level, left: scan.sides.left.level } : status.sides}/></figure>
      <figure className="panel vein-area"><figcaption><p className="vein-eyebrow">LONGITUDINAL COMPARISON</p><h3>How the area changes.</h3><p>Each vein against its own preflight study. The dashed line is a published group mean, not a safety threshold.</p></figcaption><AreaChart data={data} selectedDay={scan?.day}/><div className="vein-chart-key"><span><i/>Left vein</span><span><i/>Right vein</span></div></figure></div>

    <details className="vein-measurements"><summary>Every measurement <span>{scan?.label ?? 'No study'}</span></summary><div className="vein-table-scroll"><table><thead><tr><th scope="col">Measurement</th>{SIDES.map(s => <th key={s} scope="col">{SIDE_LABEL[s]}</th>)}</tr></thead><tbody>{data.measures.map(m => <tr key={m.measure}><th scope="row">{m.name}<small>{m.about}</small></th>{SIDES.map(s => <td key={s}><b>{shown(m, scan?.values?.[s]?.[m.measure])}</b><small>Preflight {shown(m, m.sides[s].baseline)}</small></td>)}</tr>)}</tbody></table></div></details>
    <footer className="vein-evidence"><div><p className="vein-eyebrow">BASED ON PUBLISHED SPACEFLIGHT RESEARCH</p><p>The views follow the flow patterns and ultrasound examples in <a href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6902784/" target="_blank" rel="noreferrer">Marshall-Goebel et al., 2019 · Figures 1 &amp; 3 ↗</a>, and the bilateral duplex approach in <a href="https://doi.org/10.1177/1358863X221086619" target="_blank" rel="noreferrer">Pavela et al., 2022 ↗</a>.</p></div><p>{data.notice}</p></footer>
  </div>;
}
