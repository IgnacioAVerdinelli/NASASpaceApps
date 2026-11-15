import React, { useState } from 'react';
import { CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertIcon } from '../fuerza/App.jsx';
import { Icon } from '../vuelo/Icons.jsx';
import { ACTIVITY, COMPARISONS, clock, dayRows, fmtValue, side, tiles } from '../data/vitals.js';
import './style.css';

// Layer 1, the watch (docs/wearable.md): one tile per vital and the day of heart rate. Every status, band and
// sentence comes from GET /api/v1/vitals; this file only draws them.
const INK = '#4057c9', MUTED = '#78869b', BAND = '#e0e8ef';
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
      {vital.band && <ReferenceArea y1={vital.band.low} y2={vital.band.high} fill="#35685f" fillOpacity={0.55} stroke="none" ifOverflow="extendDomain"/>}
      <Line dataKey="value" stroke="#8bd7c4" strokeWidth={2} dot={{ r: 2.5, fill: "#8bd7c4", strokeWidth: 0 }} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function Tile({ tile, onOpen }) {
  const { main, second, status } = tile;
  const arrow = { up: '▲', down: '▼' }[side(status)];
  const value = tile.id === 'bp' ? `${fmtValue(main.latest?.value)}/${fmtValue(second?.latest?.value)}` : fmtValue(main.latest?.value, main.decimals);
  const unit = tile.id === 'bp' ? 'mmHg' : main.unit;
  const Element = onOpen ? 'button' : 'article';
  return <Element type={onOpen ? 'button' : undefined} className="vital-tile" data-status={status.status} onClick={onOpen}>
    <span className="vital-tile-head"><span>{tile.title}</span><StatusPill status={status.status}/></span>
    <span className="vital-value">{value}<small>{unit}</small>{tile.id === 'sleep' && second?.latest && <small className="vital-second">· {fmtValue(second.latest.value)}/7</small>}</span>
    <Spark vital={main}/>
    <span className="vital-text">{arrow && <b aria-hidden="true">{arrow} </b>}{status.text}</span>
  </Element>;
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
      <div className="day-compare" role="group" aria-label="Compare today with">
        <span>Compare with</span>
        {COMPARISONS.map(c => <button key={c.id} type="button" aria-pressed={compare === c.id} onClick={() => setCompare(c.id)}>{c.label}</button>)}
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

function freshness(latest) {
  if (!latest?.at) return latest ? 'Latest reading' : 'No reading';
  const date = new Date(latest.at);
  return Number.isNaN(date.getTime()) ? 'Latest reading' : `Recorded ${date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short' })}`;
}

function CompactWatch({ vitals, onOpen, error }) {
  const all = vitals ? tiles(vitals) : [];
  const heart = all.find(t => t.id === 'hr');
  const secondary = all.filter(t => t.id !== 'hr').slice(0, 3);
  const points = (vitals?.day?.curves?.today || []).filter(p => Number.isFinite(p.minute) && Number.isFinite(p.value));
  const first = points[0]?.minute;
  const last = points[points.length - 1]?.minute;
  const sameTime = secondary.length > 1 && secondary.every(t => t.main.latest?.at && t.main.latest.at === secondary[0].main.latest?.at);
  return <section className="compact-watch" aria-label="Wearable readings">
    <div className="compact-watch-top"><h3><Icon name="vitales"/> Wearable</h3><button type="button" className="compact-watch-link" onClick={onOpen}>Vital signs <span aria-hidden="true">→</span></button></div>
    {error && <p className="compact-watch-error" role="status">Watch data unavailable. Retrying automatically{vitals ? '; showing the last received readings' : ''}.</p>}
    <div className="compact-watch-main">
      <div><span className="compact-watch-label">Resting heart rate</span><div className="compact-watch-value">{fmtValue(heart?.main.latest?.value, heart?.main.decimals)} <small>{heart?.main.unit || 'bpm'}</small></div><span className="compact-watch-time">{freshness(heart?.main.latest)}</span></div>
      <div className="compact-watch-trace"><span>Heart rate today · bpm</span>{points.length > 1 ? <div className="compact-watch-plot" role="img" aria-label={`Heart rate today from ${clock(first)} to ${clock(last)}`}><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 250, height: 65 }}><LineChart data={points} margin={{ top: 3, right: 4, left: 4, bottom: 0 }}><CartesianGrid stroke="#4c7468" strokeDasharray="3 4" horizontal={false}/><XAxis dataKey="minute" type="number" domain={['dataMin', 'dataMax']} ticks={first === last ? [first] : [first, last]} tickFormatter={clock} tick={{ fontSize: 10, fill: '#c1ddd2' }} tickLine={false} axisLine={false} height={18}/><YAxis hide domain={['dataMin - 5', 'dataMax + 5']}/><Line dataKey="value" stroke="#9de7cf" strokeWidth={2} dot={false} isAnimationActive={false}/></LineChart></ResponsiveContainer></div> : <div className="compact-watch-no-trace">No trace available</div>}</div>
    </div>
    <div className="compact-watch-secondary">{secondary.length ? secondary.map(t => <div key={t.id}><span>{t.title}</span><strong>{t.id === 'bp' ? `${fmtValue(t.main.latest?.value)}/${fmtValue(t.second?.latest?.value)}` : fmtValue(t.main.latest?.value, t.main.decimals)} <small>{t.id === 'bp' ? 'mmHg' : t.main.unit}</small></strong>{!sameTime && <span>{freshness(t.main.latest)}</span>}</div>) : <span>No other readings available</span>}</div>
    {sameTime && <p className="compact-watch-shared-time">Secondary readings · {freshness(secondary[0].main.latest).toLowerCase()}</p>}
  </section>;
}

// The "Now · watch" panel: tiles, the pattern hint and the day of heart rate.
export function WatchPanel({ vitals, onOpen, compact = false, error }) {
  if (compact) return <CompactWatch vitals={vitals} onOpen={onOpen} error={error}/>;
  if (!vitals) return <section className="panel watch-panel"><p className="empty">Loading your watch…</p></section>;
  return <section className="panel watch-panel" aria-labelledby="watch-title" data-compact={compact || undefined}>
    <header className="panel-head"><h3 id="watch-title">Now · from your watch</h3><span>Compared with your own last two weeks (shaded band)</span></header>
    <div className="vital-tiles">{tiles(vitals).map(t => <Tile key={t.id} tile={t} onOpen={onOpen}/>)}</div>
    <Patterns patterns={vitals.patterns}/>
    <DayChart day={vitals.day} height={compact ? 210 : 260}/>
  </section>;
}
