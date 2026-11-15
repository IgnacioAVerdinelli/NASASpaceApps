import React from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { fmtNum, fmtPct, levelText } from '../fuerza/data.js';
import './indicators.css';

function Trend({ points, color, label }) {
  const chart = (points || []).filter(point => Number.isFinite(point.day)).map(point => ({ ...point, position: point.day }));
  const values = chart.filter(point => Number.isFinite(point.value));
  if (values.length < 2) return <div className="summary-trend-empty">Not enough tests for a trend</div>;
  const numbers = values.map(point => point.value);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const padding = Math.max((high - low) * 0.18, 1);
  return <div className="summary-trend" role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: 54 }}>
      <AreaChart data={chart} margin={{ top: 4, right: 3, bottom: 3, left: 3 }}>
        <XAxis dataKey="position" type="number" domain={['dataMin', 'dataMax']} hide/>
        <YAxis domain={[low - padding, high + padding]} hide/>
        <Area type="linear" dataKey="value" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1 }} connectNulls={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </div>;
}

function Metric({ icon, title, value, unit, change, points, color, alert, onClick, showTrend = true }) {
  return <button type="button" className={`summary-metric summary-metric-${icon}`} onClick={onClick}>
    <span className="summary-metric-top"><span>{title}</span><span className="summary-metric-arrow" aria-hidden="true">↗</span></span>
    {alert && <span className={`summary-metric-alert summary-metric-alert-${alert.severity}`}>{alert.severity === 'critical' ? 'NASA standard crossed' : 'Faster loss than expected'}</span>}
    <span className="summary-metric-reading"><span className="summary-metric-value">{value}<small>{unit}</small></span>{showTrend && <Trend points={points} color={color} label={`${title}: test results over time`}/>}</span>
    <span className="summary-metric-change">{change}</span>
  </button>;
}

export function Indicators({ aero, vo2, worst, bone, levels, onOpen, boneError, dashboardLoading, strengthEvaluations }) {
  const pointStatus = point => point.withinNoise && !point.belowMinimum ? 'Within test variation' : levelText(point, levels);
  const boneValue = dashboardLoading ? 'Loading…' : boneError || !bone ? 'Unavailable' : bone.scanned ? fmtPct(bone.changePct) : 'No scan';
  const boneChange = dashboardLoading ? 'Loading bone data' : boneError || !bone ? 'Bone data unavailable' : bone.scanned ? 'vs pre-flight' : 'No in-flight DXA scan';
  return <section className="summary-indicators" aria-labelledby="summary-indicators-title">
    <div className="summary-indicators-heading"><h2 id="summary-indicators-title">Key indicators</h2></div>
    <div className="summary-metric-grid">
      <Metric icon="aerobica" title="Aerobic capacity" value={vo2 ? fmtNum(vo2.value) : '—'} unit={vo2 ? aero.unit : ''}
        change={vo2 ? `${fmtPct(vo2.changePct)} vs pre-flight · ${pointStatus(vo2)}` : 'No test yet'}
        points={aero.evaluations} alert={aero.alert} color="#4057c9" onClick={() => onOpen('aerobica')}/>
      <Metric icon="fuerza" title={worst ? `Strength · ${worst.group.name}` : 'Strength'} value={worst?.point ? fmtPct(worst.point.changePct) : '—'}
        change={worst?.point ? `${pointStatus(worst.point)} · vs pre-flight` : 'No test yet'}
        points={worst?.group.points.map((point, index) => ({ ...point, day: strengthEvaluations?.[index]?.day, label: strengthEvaluations?.[index]?.label, phase: strengthEvaluations?.[index]?.phase }))} alert={worst?.group.alert} color="#c06d58" onClick={() => onOpen('fuerza', worst?.group.muscleKeys[0])}/>
      <Metric icon="bone" title="Hip bone density" value={boneValue} change={boneChange}
        points={bone?.points.map(point => ({ ...point, day: Date.parse(point.at) }))} showTrend={Boolean(bone?.scanned && !dashboardLoading && !boneError)} color="#668977" onClick={() => onOpen('body')}/>
    </div>
  </section>;
}
