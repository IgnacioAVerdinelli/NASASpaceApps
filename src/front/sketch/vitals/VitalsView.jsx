import React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtValue } from '../data/vitals.js';
import { StatusPill, WatchPanel } from './WatchPanel.jsx';
import './style.css';

// Theme tokens (theme/glass.css) and the --vitals-* variables of ./style.css.
const LINE = 'var(--chart-line)', BAND = 'var(--vitals-band)', FLAG = 'var(--warn-dot)', GRID = 'var(--chart-grid)', WEEKLY = 'var(--muted)';
const TICK = { fontSize: 12, fill: 'var(--chart-tick)' };
const flight = day => `FD${Math.floor(day) + 1}`;

function SeriesTooltip({ active, payload, label, name, format, labelFormat, color }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{labelFormat(label)}</strong>
    <div><i className="tooltip-dot" style={{ background: color }}/>{name}<b>{format(payload[0].value)}</b></div>
  </div>;
}

function MonthChart({ vital }) {
  const band = vital.band;
  const worse = p => band && (vital.direction === 'up' ? p.value > band.high : p.value < band.low);
  const Dot = ({ cx, cy, payload }) => cx == null ? null : <circle cx={cx} cy={cy} r={worse(payload) ? 4.5 : 2.5} fill={worse(payload) ? FLAG : LINE} stroke="#fff" strokeWidth={worse(payload) ? 1.5 : 0}/>;
  return <div className="month-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 170 }}>
    <LineChart data={vital.series} margin={{ top: 8, right: 10, bottom: 0, left: -8 }}>
      <CartesianGrid vertical={false} stroke={GRID}/>
      {band && <ReferenceArea y1={band.low} y2={band.high} fill={BAND} fillOpacity={1} stroke="none" ifOverflow="extendDomain"/>}
      <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickFormatter={flight} tick={TICK} tickLine={false} axisLine={false} tickCount={5}/>
      <YAxis width={42} domain={['auto', 'auto']} tick={TICK} tickLine={false} axisLine={false}/>
      <Tooltip cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
        content={<SeriesTooltip name={vital.name} color={LINE} labelFormat={flight} format={v => `${fmtValue(v, vital.decimals)} ${vital.unit}`}/>}/>
      <Line dataKey="value" stroke={LINE} strokeWidth={2} dot={<Dot/>} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function MissionChart({ vital }) {
  if ((vital.weekly || []).length < 2) return null;
  const weekLabel = d => `Week from ${d < 0 ? `L${Math.floor(d - 3.5)}` : flight(d - 3.5)}`;
  return <div className="mission-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 90 }}>
    <LineChart data={vital.weekly} margin={{ top: 4, right: 10, bottom: 0, left: -8 }}>
      <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickFormatter={d => d < 0 ? `L${Math.floor(d)}` : flight(d)} tick={{ ...TICK, fontSize: 11 }} tickLine={false} axisLine={false} tickCount={4}/>
      <YAxis width={42} domain={['auto', 'auto']} tick={{ ...TICK, fontSize: 11 }} tickLine={false} axisLine={false}/>
      <Tooltip cursor={{ stroke: 'var(--muted)', strokeWidth: 1, strokeDasharray: '3 3' }}
        content={<SeriesTooltip name="Weekly mean" color={WEEKLY} labelFormat={weekLabel} format={v => `${fmtValue(v, vital.decimals + 1)} ${vital.unit}`}/>}/>
      <Line dataKey="mean" stroke={WEEKLY} strokeOpacity={0.7} strokeWidth={2} dot={false} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function VitalCard({ vital }) {
  return <article className="vital-detail glass" data-status={vital.status}>
    <header>
      <div><h3>{vital.name}</h3><p>{vital.text}</p></div>
      <div className="vital-detail-now"><strong><span className="num">{fmtValue(vital.latest?.value, vital.decimals)}</span><small> {vital.unit}</small></strong><StatusPill status={vital.status}/></div>
    </header>
    <h4 className="eyebrow">Last 30 days</h4>
    {vital.series.length > 1 ? <MonthChart vital={vital}/> : <p className="vitals-empty">No data yet.</p>}
    {vital.band && <p className="vital-band"><i aria-hidden="true"/>Your usual range: {fmtValue(vital.band.low, vital.decimals)}–{fmtValue(vital.band.high, vital.decimals)} {vital.unit} (shaded), from your {vital.band.days} days before the last three. Amber points are outside it on the worse side.</p>}
    <h4 className="eyebrow">Whole mission · weekly mean</h4>
    <MissionChart vital={vital}/>
  </article>;
}

export function VitalsView({ vitals, error }) {
  if (!vitals) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load your watch data. Retrying automatically…' : 'Loading your watch data…'}</div>;
  return <div className="vitals-view">
    {error && <div className="flight-notice" role="status">Connection lost. Showing the last available watch readings.</div>}
    <WatchPanel vitals={vitals} error={error}/>
    <div className="watch-reference glass-sm">
      <details><summary>How the watch compares readings</summary>
        <p>The watch compares each day with the crew member’s previous two weeks. A change lasting three days schedules a flight surgeon review. Periodic strength, aerobic and bone tests track longer-term changes.</p>
      </details>
      <a className="btn-link" href={'./alerts/' + window.location.search}>Open wearable alert simulator <span aria-hidden="true">↗</span></a>
    </div>
    <div className="vital-cards">{vitals.vitals.map(v => <VitalCard key={v.measure} vital={v}/>)}</div>
    <p className="vitals-foot">{vitals.notice} The usual range and every threshold are ours (docs/wearable.md), not NASA limits.</p>
  </div>;
}
