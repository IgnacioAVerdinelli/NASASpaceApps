import React, { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertIcon } from '../fuerza/App.jsx';
import { ACTIVITY, COMPARISONS, clock, dayRows, fmtValue, side, tiles } from '../data/vitals.js';
import './style.css';

// Layer 1, the watch (docs/wearable.md): one tile per vital and the day of heart rate. Every status, band and
// sentence comes from GET /api/v1/vitals; this file only draws them.
const INK = '#2f2850', MUTED = '#8e8aa8', BAND = '#e6e3f4';
const STATUS_WORD = { deviation: 'Lasting change', low_now: 'Act now', out: 'Outside usual today', in_range: 'Usual', no_band: 'Learning', no_data: 'No data' };

export function StatusPill({ status }) {
  return <span className="vital-pill" data-status={status}>{['deviation', 'low_now'].includes(status) ? <AlertIcon/> : <i aria-hidden="true"/>}{STATUS_WORD[status] ?? status}</span>;
}

function Spark({ vital, days = 7 }) {
  const points = (vital.series || []).slice(-days);
  if (points.length < 2) return <div className="vital-spark vital-spark-empty"/>;
  const values = points.map(p => p.value).concat(vital.band ? [vital.band.low, vital.band.high] : []);
  const pad = (Math.max(...values) - Math.min(...values)) * 0.15 || 1;
  return <div className="vital-spark" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 46 }}>
    <LineChart data={points} margin={{ top: 3, right: 3, bottom: 3, left: 3 }}>
      <YAxis hide domain={[Math.min(...values) - pad, Math.max(...values) + pad]}/>
      {vital.band && <ReferenceArea y1={vital.band.low} y2={vital.band.high} fill={BAND} fillOpacity={1} stroke="none" ifOverflow="extendDomain"/>}
      <Line dataKey="value" stroke={INK} strokeWidth={2} dot={{ r: 2.5, fill: INK, strokeWidth: 0 }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function Tile({ tile, onOpen }) {
  const { main, second, status } = tile;
  const arrow = { up: '▲', down: '▼' }[side(status)];
  const value = tile.id === 'bp' ? `${fmtValue(main.latest?.value)}/${fmtValue(second?.latest?.value)}` : fmtValue(main.latest?.value, main.decimals);
  const unit = tile.id === 'bp' ? 'mmHg' : main.unit;
  return <button type="button" className="vital-tile" data-status={status.status} onClick={onOpen}>
    <span className="vital-tile-head"><span>{tile.title}</span><StatusPill status={status.status}/></span>
    <span className="vital-value">{value}<small>{unit}</small>{tile.id === 'sleep' && second?.latest && <small className="vital-second">· {fmtValue(second.latest.value)}/7</small>}</span>
    <Spark vital={main}/>
    <span className="vital-text">{arrow && <b aria-hidden="true">{arrow} </b>}{status.text}</span>
  </button>;
}

function DayTooltip({ active, payload, label, compareLabel }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip"><strong>{clock(label)}</strong>
    {row.today != null && <div><i className="tooltip-dot" style={{ background: INK }}/>Today<b>{row.today} bpm</b></div>}
    {row.other != null && <div><i className="tooltip-dot" style={{ background: MUTED }}/>{compareLabel}<b>{row.other} bpm</b></div>}
  </div>;
}

export function DayChart({ day, height = 230 }) {
  const [compare, setCompare] = useState('yesterday');
  const rows = dayRows(day.curves, compare);
  const compareLabel = COMPARISONS.find(c => c.id === compare).label;
  const last = [...rows].reverse().find(r => r.today != null);
  return <figure className="day-chart">
    <figcaption>
      <div><strong>Heart rate today</strong><span>From your watch, every 15 minutes</span></div>
      <div className="day-compare" role="radiogroup" aria-label="Compare today with">
        <span>Compare with</span>
        {COMPARISONS.map(c => <button key={c.id} type="button" role="radio" aria-checked={compare === c.id} onClick={() => setCompare(c.id)}>{c.label}</button>)}
      </div>
    </figcaption>
    <div className="day-chart-plot" role="img" aria-label={`Heart rate today${last ? `, latest ${last.today} bpm at ${clock(last.minute)}` : ''}, compared with ${compareLabel.toLowerCase()}.`}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height }}>
        <ComposedChart data={rows} margin={{ top: 22, right: 12, bottom: 0, left: -8 }}>
          <CartesianGrid vertical={false} stroke="#e4e3ef"/>
          {day.context.map(c => <ReferenceArea key={`${c.activity}${c.start}`} x1={c.start} x2={c.end} fill={`var(--ctx-${c.activity})`} fillOpacity={1} stroke="none"
            label={{ value: ACTIVITY[c.activity], position: 'insideTop', offset: -16, fontSize: 12, fill: '#4f5874' }}/>)}
          <XAxis dataKey="minute" type="number" domain={[0, 1440]} ticks={[0, 180, 360, 540, 720, 900, 1080, 1260, 1440]} tickFormatter={clock} tick={{ fontSize: 13, fill: '#4f5874' }} tickLine={false} axisLine={false}/>
          <YAxis width={44} domain={['dataMin - 5', 'dataMax + 5']} allowDecimals={false} tick={{ fontSize: 13, fill: '#4f5874' }} tickLine={false} axisLine={false} unit=""/>
          <Tooltip content={<DayTooltip compareLabel={compareLabel}/>} cursor={{ stroke: '#9b96bd', strokeWidth: 1 }}/>
          <Line dataKey="other" stroke={MUTED} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls isAnimationActive={false}/>
          <Line dataKey="today" stroke={INK} strokeWidth={2.5} dot={false} connectNulls isAnimationActive={false}/>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <ul className="day-legend">
      <li><i style={{ background: INK }}/>Today</li>
      <li><i className="dashed" style={{ borderColor: MUTED }}/>{compareLabel}</li>
      {Object.entries(ACTIVITY).map(([k, v]) => <li key={k}><i className="area" style={{ background: `var(--ctx-${k})` }}/>{v}</li>)}
      <li className="day-unit">beats per minute</li>
    </ul>
  </figure>;
}

export function Patterns({ patterns }) {
  if (!patterns?.length) return null;
  return <div className="vital-pattern" role="status">{patterns.map(p => <p key={p.id}><AlertIcon/>{p.text}</p>)}</div>;
}

// The "Now · watch" panel: tiles, the pattern hint and the day of heart rate.
export function WatchPanel({ vitals, onOpen, compact = false }) {
  if (!vitals) return <section className="panel watch-panel"><p className="empty">Loading your watch…</p></section>;
  return <section className="panel watch-panel" aria-labelledby="watch-title" data-compact={compact || undefined}>
    <header className="panel-head"><h3 id="watch-title">Now · from your watch</h3><span>Compared with your own last two weeks (shaded band)</span></header>
    <div className="vital-tiles">{tiles(vitals).map(t => <Tile key={t.id} tile={t} onOpen={onOpen}/>)}</div>
    <Patterns patterns={vitals.patterns}/>
    <DayChart day={vitals.day} height={compact ? 210 : 260}/>
  </section>;
}
