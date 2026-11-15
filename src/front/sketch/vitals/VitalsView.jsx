import React from 'react';
import { CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtValue } from '../data/vitals.js';
import { StatusPill, WatchPanel } from './WatchPanel.jsx';
import './style.css';

const INK = '#2f2850', BAND = '#e6e3f4', FLAG = '#b06d00';
const flight = day => `FD${Math.floor(day) + 1}`;

function MonthChart({ vital }) {
  const band = vital.band;
  const worse = p => band && (vital.direction === 'up' ? p.value > band.high : p.value < band.low);
  const Dot = ({ cx, cy, payload }) => cx == null ? null : <circle cx={cx} cy={cy} r={worse(payload) ? 4.5 : 2.5} fill={worse(payload) ? FLAG : INK} stroke="#fff" strokeWidth={worse(payload) ? 1.5 : 0}/>;
  return <div className="month-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 170 }}>
    <LineChart data={vital.series} margin={{ top: 6, right: 8, bottom: 0, left: -10 }}>
      <CartesianGrid vertical={false} stroke="#e4e3ef"/>
      {band && <ReferenceArea y1={band.low} y2={band.high} fill={BAND} fillOpacity={1} stroke="none" ifOverflow="extendDomain"/>}
      <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickFormatter={flight} tick={{ fontSize: 12, fill: '#4f5874' }} tickLine={false} axisLine={false} tickCount={5}/>
      <YAxis width={42} domain={['auto', 'auto']} tick={{ fontSize: 12, fill: '#4f5874' }} tickLine={false} axisLine={false}/>
      <Tooltip formatter={v => [`${fmtValue(v, vital.decimals)} ${vital.unit}`, vital.name]} labelFormatter={flight}/>
      <Line dataKey="value" stroke={INK} strokeWidth={2} dot={<Dot/>} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function MissionChart({ vital }) {
  if ((vital.weekly || []).length < 2) return null;
  return <div className="mission-plot"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 90 }}>
    <LineChart data={vital.weekly} margin={{ top: 4, right: 8, bottom: 0, left: -10 }}>
      <XAxis dataKey="day" type="number" domain={['dataMin', 'dataMax']} tickFormatter={d => d < 0 ? `L${Math.floor(d)}` : flight(d)} tick={{ fontSize: 11, fill: '#59617b' }} tickLine={false} axisLine={false} tickCount={4}/>
      <YAxis width={42} domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#59617b' }} tickLine={false} axisLine={false}/>
      <Tooltip formatter={v => [`${fmtValue(v, vital.decimals + 1)} ${vital.unit}`, 'Weekly mean']} labelFormatter={d => `Week from ${d < 0 ? `L${Math.floor(d - 3.5)}` : flight(d - 3.5)}`}/>
      <Line dataKey="mean" stroke="#8e8aa8" strokeWidth={2} dot={false} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

function VitalCard({ vital }) {
  return <article className="panel vital-card" data-status={vital.status}>
    <header>
      <div><h3>{vital.name}</h3><p>{vital.text}</p></div>
      <div className="vital-card-now"><strong>{fmtValue(vital.latest?.value, vital.decimals)}<small> {vital.unit}</small></strong><StatusPill status={vital.status}/></div>
    </header>
    <h4>Last 30 days</h4>
    {vital.series.length > 1 ? <MonthChart vital={vital}/> : <p className="empty">No data yet.</p>}
    {vital.band && <p className="vital-band">Your usual range: {fmtValue(vital.band.low, vital.decimals)}–{fmtValue(vital.band.high, vital.decimals)} {vital.unit} (shaded), from your {vital.band.days} days before the last three. Orange points are outside it on the worse side.</p>}
    <h4>Whole mission · weekly mean</h4>
    <MissionChart vital={vital}/>
  </article>;
}

export function VitalsView({ vitals, error }) {
  if (!vitals) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to load your watch data. Retrying automatically…' : 'Loading your watch data…'}</div>;
  return <div className="vitals-view">
    <div className="vitals-intro">
      <div><h2>Vital signs</h2>
        <p>Your watch is the first line of monitoring: it checks every day how you compare with your own last two weeks. A change that lasts three days books a review by the flight surgeon. Slow changes over the mission are judged by the periodic tests (strength, aerobic capacity, bone).</p></div>
      {vitals.simulated && <span className="demo-label">SIMULATED DATA</span>}
    </div>
    <WatchPanel vitals={vitals}/>
    <div className="vital-cards">{vitals.vitals.map(v => <VitalCard key={v.measure} vital={v}/>)}</div>
    <p className="summary-foot">{vitals.notice} The usual range and every threshold are ours (docs/wearable.md), not NASA limits.</p>
  </div>;
}
