import React, { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertIcon } from '../fuerza/App.jsx';
import { ACTIVITY, COMPARISONS, clock, dayRows, fmtValue, side, tiles } from '../data/vitals.js';
import './style.css';

// Layer 1, the watch (docs/wearable.md): one tile per vital and the day of heart rate. Every status, band and
// sentence comes from GET /api/v1/vitals; this file only draws them. Colours are theme tokens (theme/glass.css)
// or the --ctx-* / --vitals-* variables of ./style.css.
const LINE = 'var(--chart-line)', COMPARE = 'var(--muted)', GRID = 'var(--chart-grid)', BAND = 'var(--vitals-band)';
const TICK = { fontSize: 12, fill: 'var(--chart-tick)' };
const STATUS_WORD = { deviation: 'Lasting change', low_now: 'Act now', out: 'Outside usual today', in_range: 'Usual', no_band: 'Learning', no_data: 'No data' };
// Chip tone per status (docs/design-system.md 2.2). Learning and no data stay neutral (no data-tone).
const STATUS_TONE = { deviation: 'warn', low_now: 'crit', out: 'info', in_range: 'ok' };
const ACT = ['deviation', 'low_now'];

export function StatusPill({ status }) {
  const act = ACT.includes(status);
  return <span className={`chip vital-pill${act ? ' no-dot' : ''}`} data-tone={STATUS_TONE[status]} data-status={status}>{act && <AlertIcon/>}{STATUS_WORD[status] ?? status}</span>;
}

function Spark({ vital, days = 7 }) {
  const points = (vital.series || []).slice(-days);
  if (points.length < 2) return <div className="vital-spark vital-spark-empty"/>;
  const values = points.map(p => p.value).concat(vital.band ? [vital.band.low, vital.band.high] : []);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  return <div className="vital-spark" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 40 }}>
    <LineChart data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
      <YAxis hide domain={[Math.min(...values) - pad, Math.max(...values) + pad]}/>
      {vital.band && <ReferenceArea y1={vital.band.low} y2={vital.band.high} fill={BAND} fillOpacity={1} stroke="none" ifOverflow="extendDomain"/>}
      <Line dataKey="value" stroke={LINE} strokeWidth={2} dot={{ r: 2.2, fill: LINE, strokeWidth: 0 }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

const tileValue = t => t.id === 'bp' ? `${fmtValue(t.main.latest?.value)}/${fmtValue(t.second?.latest?.value)}` : fmtValue(t.main.latest?.value, t.main.decimals);
const tileUnit = t => t.id === 'bp' ? 'mmHg' : t.main.unit;

function Tile({ tile, onOpen }) {
  const { main, second, status } = tile;
  const arrow = { up: '▲', down: '▼' }[side(status)];
  const Element = onOpen ? 'button' : 'article';
  return <Element type={onOpen ? 'button' : undefined} className="vital-tile glass-sm" data-status={status.status} onClick={onOpen}>
    <span className="vital-tile-head"><span>{tile.title}</span><StatusPill status={status.status}/></span>
    <span className="vital-value"><span className="num">{tileValue(tile)}</span><small>{tileUnit(tile)}</small>{tile.id === 'sleep' && second?.latest && <small className="vital-second">· <span className="num">{fmtValue(second.latest.value)}</span>/7</small>}</span>
    <Spark vital={main}/>
    <span className="vital-text">{arrow && <b aria-hidden="true">{arrow} </b>}{status.text}</span>
  </Element>;
}

function DayTooltip({ active, payload, label, compareLabel }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip"><strong>{clock(label)}</strong>
    {row.today != null && <div><i className="tooltip-dot" style={{ background: LINE }}/>Today<b>{row.today} bpm</b></div>}
    {row.other != null && <div><i className="tooltip-dot" style={{ background: COMPARE }}/>{compareLabel}<b>{row.other} bpm</b></div>}
  </div>;
}

export function DayChart({ day, height = 240 }) {
  const [compare, setCompare] = useState('yesterday');
  const rows = dayRows(day.curves, compare);
  const compareLabel = COMPARISONS.find(c => c.id === compare).label;
  const last = [...rows].reverse().find(r => r.today != null);
  return <figure className="day-chart">
    <figcaption>
      <div><strong>Heart rate today</strong><span>From your watch, every 15 minutes</span></div>
      <div className="day-compare">
        <span id="day-compare-label">Compare with</span>
        <div className="seg" role="group" aria-labelledby="day-compare-label">
          {COMPARISONS.map(c => <button key={c.id} type="button" aria-pressed={compare === c.id} onClick={() => setCompare(c.id)}>{c.label}</button>)}
        </div>
      </div>
    </figcaption>
    <div className="day-chart-plot" style={{ height }} role="img" aria-label={`Heart rate today${last ? `, latest ${last.today} bpm at ${clock(last.minute)}` : ''}, compared with ${compareLabel.toLowerCase()}.`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ComposedChart data={rows} margin={{ top: 24, right: 14, bottom: 4, left: -6 }}>
          <CartesianGrid vertical={false} stroke={GRID}/>
          {day.context.map(c => <ReferenceArea key={`${c.activity}${c.start}`} x1={c.start} x2={c.end} fill={`var(--ctx-${c.activity})`} fillOpacity={1} stroke="none"
            label={{ value: ACTIVITY[c.activity], position: 'insideTop', offset: -18, fontSize: 11, fontWeight: 600, fill: 'var(--muted)' }}/>)}
          <XAxis dataKey="minute" type="number" domain={[0, 1440]} ticks={[0, 180, 360, 540, 720, 900, 1080, 1260, 1440]} tickFormatter={clock} tick={TICK} tickLine={false} axisLine={false}/>
          <YAxis width={44} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} tick={TICK} tickLine={false} axisLine={false} unit=""/>
          <Tooltip content={<DayTooltip compareLabel={compareLabel}/>} cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '3 3' }}/>
          <Line dataKey="other" stroke={COMPARE} strokeOpacity={0.6} strokeWidth={1.8} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false}/>
          <Line dataKey="today" stroke={LINE} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <ul className="day-legend">
      <li><i className="line"/>Today</li>
      <li><i className="dashed"/>{compareLabel}</li>
      {Object.entries(ACTIVITY).map(([k, v]) => <li key={k}><i className="area" style={{ background: `var(--ctx-${k}-key)` }}/>{v}</li>)}
      <li className="day-unit">beats per minute</li>
    </ul>
  </figure>;
}

export function Patterns({ patterns }) {
  if (!patterns?.length) return null;
  return <div className="vital-pattern" role="status">{patterns.map(p => <p key={p.id}><AlertIcon/>{p.text}</p>)}</div>;
}

function freshness(latest) {
  if (!latest?.at) return latest ? 'Latest reading' : 'No reading';
  const date = new Date(latest.at);
  return Number.isNaN(date.getTime()) ? 'Latest reading' : `Recorded ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`;
}

// Today's heart rate on a 24 h axis, with the sleep / exercise bands and a marker at the latest reading.
function CompactTrace({ day, stale }) {
  const points = (day?.curves?.today || []).filter(p => Number.isFinite(p.minute) && Number.isFinite(p.value));
  if (points.length < 2) return <div className="compact-watch-no-trace">No heart-rate trace for today yet</div>;
  const now = points[points.length - 1].minute;
  const nowPct = Math.min(100, Math.max(0, now / 1440 * 100));
  const context = (day.context || []).filter(c => ACTIVITY[c.activity]);
  const kinds = [...new Set(context.map(c => c.activity))];
  const nowLabel = `${stale ? 'Last' : 'Now'} ${clock(now)}`;
  return <div className="compact-watch-trace">
    <div className="compact-watch-plot" role="img" aria-label={`Heart rate today from ${clock(points[0].minute)} to ${clock(now)}, every 15 minutes, between ${Math.min(...points.map(p => p.value))} and ${Math.max(...points.map(p => p.value))} bpm.`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 96 }}>
        <LineChart data={points} margin={{ top: 6, right: 0, bottom: 6, left: 0 }}>
          <XAxis hide dataKey="minute" type="number" domain={[0, 1440]}/>
          <YAxis hide domain={['dataMin - 6', 'dataMax + 6']}/>
          {context.map(c => <ReferenceArea key={`${c.activity}${c.start}`} x1={c.start} x2={c.end} fill={`var(--ctx-${c.activity})`} fillOpacity={1} stroke="none" ifOverflow="hidden"/>)}
          <ReferenceLine x={now} stroke="var(--ink)" strokeDasharray="3 3" strokeWidth={1}/>
          <Line dataKey="value" stroke={LINE} strokeWidth={2.2} strokeLinejoin="round" dot={false} isAnimationActive={false}/>
        </LineChart>
      </ResponsiveContainer>
    </div>
    <div className="compact-watch-times" aria-hidden="true">
      <span style={{ left: 0 }}>00:00</span>
      {Math.abs(now - 720) > 240 && <span style={{ left: '50%', transform: 'translateX(-50%)' }}>12:00</span>}
      {now > 180 && <span style={{ left: `${nowPct}%`, transform: `translateX(-${nowPct > 80 ? 100 : 50}%)` }}>{nowLabel}</span>}
    </div>
    {now <= 180 && <p className="compact-watch-caption">{nowLabel}</p>}
    {kinds.length > 0 && <ul className="compact-watch-legend">{kinds.map(k => <li key={k}><i style={{ background: `var(--ctx-${k}-key)` }}/>{ACTIVITY[k]}</li>)}</ul>}
  </div>;
}

function CompactWatch({ vitals, onOpen, error }) {
  const all = vitals ? tiles(vitals) : [];
  const heart = all.find(t => t.id === 'hr');
  const secondary = all.filter(t => t.id !== 'hr').slice(0, 4);
  // One shared "recorded" line; a reading from another time gets its own caption. Sleep is logged in the morning,
  // so last night's sleep counts as current when it is within a day of the other readings.
  const ref = (heart || secondary[0])?.main.latest;
  const refTime = ref?.at ? Date.parse(ref.at) : NaN;
  const current = t => {
    const at = t.main.latest?.at;
    if (!at || !ref?.at) return false;
    return at === ref.at || (t.id === 'sleep' && Math.abs(Date.parse(at) - refTime) < 864e5);
  };
  return <section className="compact-watch glass" aria-labelledby="compact-watch-title">
    <header className="compact-watch-top">
      <h2 id="compact-watch-title">Wearable · today</h2>
      {onOpen && <button type="button" className="btn-link compact-watch-link" onClick={onOpen}>Vital signs <span aria-hidden="true">→</span></button>}
    </header>
    {error && <p className="compact-watch-error" role="status">Watch data unavailable. Retrying automatically{vitals ? '; showing the last received readings' : ''}.</p>}
    {!vitals ? !error && <p className="compact-watch-caption">Loading your watch…</p> : <>
      <div className="compact-watch-main">
        <p className="compact-watch-value"><span className="num">{fmtValue(heart?.main.latest?.value, heart?.main.decimals)}</span> <small>{heart?.main.unit || 'bpm'} resting</small></p>
        {heart && <StatusPill status={heart.status.status}/>}
      </div>
            <CompactTrace day={vitals.day} stale={Boolean(error)}/>
      {secondary.length ? <dl className="compact-watch-secondary">{secondary.map(t => <div key={t.id}>
        <dt>{t.title}</dt>
        <dd><span className="num">{tileValue(t)}</span><small> {tileUnit(t)}</small></dd>
        {!current(t) && <dd className="compact-watch-caption">{freshness(t.main.latest)}</dd>}
      </div>)}</dl> : <p className="compact-watch-caption">No other readings available</p>}
      {ref && <p className="compact-watch-caption compact-watch-shared-time">{freshness(ref)}</p>}
    </>}
  </section>;
}

// The "Now · watch" panel: tiles, the pattern hint and the day of heart rate.
export function WatchPanel({ vitals, onOpen, compact = false, error }) {
  if (compact) return <CompactWatch vitals={vitals} onOpen={onOpen} error={error}/>;
  if (!vitals) return <section className="watch-now glass"><p className="vitals-empty">Loading your watch…</p></section>;
  return <section className="watch-now glass" aria-labelledby="watch-title">
    <header className="watch-now-head"><h2 id="watch-title">Now · from your watch</h2><span>Compared with your own last two weeks (shaded band)</span></header>
    <div className="vital-tiles">{tiles(vitals).map(t => <Tile key={t.id} tile={t} onOpen={onOpen}/>)}</div>
    <Patterns patterns={vitals.patterns}/>
    <DayChart day={vitals.day}/>
  </section>;
}
