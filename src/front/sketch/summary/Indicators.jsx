import React from 'react';
import { Area, AreaChart, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Icon } from '../vuelo/Icons.jsx';
import { fmtNum, fmtPct, levelText } from '../fuerza/data.js';
import './indicators.css';

function Trend({ points, color, minimum, label }) {
  const chart = (points || []).filter(point => Number.isFinite(point.day)).map(point => ({ ...point, position: point.day }));
  const values = chart.filter(point => Number.isFinite(point.value));
  if (values.length < 2) return <div className="summary-trend-empty">Not enough tests for a trend</div>;
  const numbers = values.map(point => point.value);
  if (Number.isFinite(minimum)) numbers.push(minimum);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const padding = Math.max((high - low) * 0.18, 1);
  const first = values[0];
  const last = values.at(-1);
  const pointLabel = point => point.phase === 'pre' ? 'PRE' : point.label;
  return <div className="summary-trend" role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 240, height: 54 }}>
      <AreaChart data={chart} margin={{ top: 4, right: 3, bottom: 3, left: 3 }}>
        <XAxis dataKey="position" type="number" domain={['dataMin', 'dataMax']} hide/>
        <YAxis domain={[low - padding, high + padding]} hide/>
        {Number.isFinite(minimum) && <ReferenceLine y={minimum} stroke="#a83c48" strokeDasharray="4 3"/>}
        <Area type="linear" dataKey="value" stroke={color} fill={color} fillOpacity={0.12} strokeWidth={2} dot={{ r: 2.5, fill: color, stroke: "#fff", strokeWidth: 1 }} connectNulls={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
    <span className="summary-trend-labels" aria-hidden="true"><span>{pointLabel(first)}</span><span>{pointLabel(last)}</span></span>
  </div>;
}

function Metric({ icon, title, value, unit, change, detail, points, color, minimum, alert, onClick }) {
  return <button type="button" className={`summary-metric summary-metric-${icon}`} onClick={onClick}>
    <span className="summary-metric-top"><span className="summary-metric-icon"><Icon name={icon} size={19}/></span><span>{title}</span><span className="summary-metric-arrow" aria-hidden="true">↗</span></span>
    {alert && <span className={`summary-metric-alert summary-metric-alert-${alert.severity}`}>{alert.severity === 'critical' ? 'NASA standard crossed' : 'Faster loss than expected'}</span>}
    <span className="summary-metric-value">{value}<small>{unit}</small></span>
    <span className="summary-metric-change">{change}</span>
    <Trend points={points} color={color} minimum={minimum} label={`${title}: test results from pre-flight to latest test${Number.isFinite(minimum) ? ', dashed line marks the NASA minimum' : ''}`}/>
    <span className="summary-metric-detail">{detail}</span>
  </button>;
}

export function Indicators({ aero, vo2, worst, bone, levels, onOpen, boneError, dashboardLoading, strengthEvaluations }) {
  const pointStatus = point => point.withinNoise && !point.belowMinimum ? 'Within test variation' : levelText(point, levels);
  const boneValue = dashboardLoading ? 'Loading bone data…' : boneError ? 'Bone data unavailable' : !bone ? 'Bone data unavailable' : bone.scanned ? `${fmtPct(bone.changePct)} vs pre-flight` : 'No in-flight DXA scan';
  return <section className="summary-indicators" aria-labelledby="summary-indicators-title">
    <div className="summary-indicators-heading"><h2 id="summary-indicators-title">Key indicators</h2><span>Latest test vs pre-flight</span></div>
    <div className="summary-metric-grid">
      <Metric icon="aerobica" title="Aerobic capacity" value={vo2 ? fmtNum(vo2.value) : '—'} unit={vo2 ? aero.unit : ''}
        change={vo2 ? `${fmtPct(vo2.changePct)} vs pre-flight · ${pointStatus(vo2)}` : 'No test yet'}
        detail={Number.isFinite(aero.minimum) && aero.evaluations.filter(point => Number.isFinite(point.value)).length >= 2 ? `NASA minimum ${fmtNum(aero.minimum)} ${aero.unit} · dashed line` : 'Pre-flight to latest test'}
        points={aero.evaluations} alert={aero.alert} minimum={aero.minimum} color="#4057c9" onClick={() => onOpen('aerobica')}/>
      <Metric icon="fuerza" title={worst ? `Strength · ${worst.group.name}` : 'Strength'} value={worst?.point ? fmtPct(worst.point.changePct) : '—'}
        change={worst?.point ? `${fmtNum(worst.point.value)} ${worst.group.unit} · ${pointStatus(worst.point)}` : 'No test yet'}
        detail={!worst?.point || worst.point.changePct == null ? 'No strength tests available' : worst.point.changePct < 0 ? 'Largest loss vs pre-flight' : 'Lowest change vs pre-flight'}
        points={worst?.group.points.map((point, index) => ({ ...point, day: strengthEvaluations?.[index]?.day, label: strengthEvaluations?.[index]?.label, phase: strengthEvaluations?.[index]?.phase }))} alert={worst?.group.alert} color="#c06d58" onClick={() => onOpen('fuerza', worst?.group.muscleKeys[0])}/>
    </div>
    <button type="button" className="summary-bone" onClick={() => onOpen('body')}>
      <span className="summary-bone-icon"><Icon name="body" size={18}/></span>
      <span><strong>Hip bone density</strong><small>{boneValue}</small></span>
      <span className="summary-bone-link">Body trends <span aria-hidden="true">↗</span></span>
    </button>
  </section>;
}
