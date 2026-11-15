import React from 'react';
import { Area, AreaChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { Icon } from '../vuelo/Icons.jsx';
import { fmtNum, fmtPct, levelText } from '../fuerza/data.js';
import { SEVERITY_TEXT, pointTone } from './data.js';
import './indicators.css';

// Chart colours from theme/glass.css (--chart-line, --chart-strength): SVG attributes need the values.
const LINE = { aerobica: '#2238A8', fuerza: '#B24A18' };

function Trend({ points, color, label }) {
  const chart = (points || []).filter(point => Number.isFinite(point.day)).map(point => ({ ...point, position: point.day }));
  const values = chart.filter(point => Number.isFinite(point.value));
  if (values.length < 2) return <span className="ov-trend-empty">Not enough tests for a trend</span>;
  const numbers = values.map(point => point.value);
  const low = Math.min(...numbers);
  const high = Math.max(...numbers);
  const padding = Math.max((high - low) * 0.18, 1);
  const lastIndex = chart.lastIndexOf(values.at(-1));
  const dot = ({ index, cx, cy }) => index === lastIndex
    ? <circle key="last" cx={cx} cy={cy} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5}/>
    : <g key={index}/>;
  return <span className="ov-trend" role="img" aria-label={label}>
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 40 }}>
      <AreaChart data={chart} margin={{ top: 5, right: 5, bottom: 4, left: 2 }}>
        <XAxis dataKey="position" type="number" domain={['dataMin', 'dataMax']} hide/>
        <YAxis domain={[low - padding, high + padding]} hide/>
        <Area type="linear" dataKey="value" stroke={color} fill={color} fillOpacity={0.14} strokeWidth={2.2} strokeLinejoin="round" dot={dot} activeDot={false} connectNulls={false} isAnimationActive={false}/>
      </AreaChart>
    </ResponsiveContainer>
  </span>;
}

// One indicator card (design-system §6): the whole card is the button that opens the tab.
function Metric({ icon, title, value, unit, name, chip, comparison, points, onClick }) {
  return <button type="button" className={`glass ov-metric ov-metric-${icon}`} onClick={onClick}>
    <span className="ov-metric-top">
      <span className="ov-metric-title"><span className="ov-metric-icon"><Icon name={icon} size={16}/></span>{title}</span>
      <span className="ov-metric-arrow" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 17 17 7M9 7h8v8"/></svg></span>
    </span>
    <span className="ov-metric-reading">
      <span className="ov-metric-figure"><span className="num ov-metric-value">{value}</span>{unit && <span className={unit === '%' ? 'ov-metric-pct' : 'ov-metric-unit'}>{unit}</span>}{name && <span className="ov-metric-name">{name}</span>}</span>
      <Trend points={points} color={LINE[icon]} label={`${title}: test results over time`}/>
    </span>
    <span className="ov-metric-foot">
      {chip && <span className="chip" data-tone={chip.tone || undefined}>{chip.text}</span>}
      <span>{comparison}</span>
    </span>
  </button>;
}

const splitPct = text => text.endsWith('%') ? [text.slice(0, -1), '%'] : [text, ''];

export function Indicators({ aero, vo2, worst, levels, onOpen, strengthEvaluations }) {
  const pointStatus = point => point.withinNoise && !point.belowMinimum ? 'Within test variation' : levelText(point, levels);
  // An alert from the HealthService outranks the level of the last test.
  const chipOf = (point, alert) => alert ? { tone: alert.severity === 'critical' ? 'crit' : 'warn', text: SEVERITY_TEXT[alert.severity] ?? 'Check needed' }
    : point ? { tone: pointTone(point), text: pointStatus(point) } : null;

  const aeroAlert = aero.alert;
  const aeroChange = vo2 ? `${fmtPct(vo2.changePct)} vs pre-flight${vo2.label ? ` · test ${vo2.label}` : ''}` : 'No test yet';
  const strength = worst?.point;
  const strengthAlert = worst?.group.alert;
  const strengthTest = strength && strengthEvaluations?.find(e => e.id === strength.evaluation)?.label;
  const [strengthValue, strengthUnit] = strength ? splitPct(fmtPct(strength.changePct)) : ['—', ''];

  return <>
    <Metric icon="aerobica" title="Aerobic capacity" value={vo2 ? fmtNum(vo2.value) : '—'} unit={vo2 ? aero.unit : ''}
      chip={chipOf(vo2, aeroAlert)} comparison={aeroAlert && vo2 ? `${aeroChange} · ${pointStatus(vo2)}` : aeroChange}
      points={aero.evaluations} onClick={() => onOpen('aerobica')}/>
    <Metric icon="fuerza" title="Strength · largest loss" value={strengthValue} unit={strengthUnit} name={worst?.group.name}
      chip={chipOf(strength, strengthAlert)}
      comparison={strength ? `vs pre-flight${strengthTest ? ` · test ${strengthTest}` : ''}${strengthAlert ? ` · ${pointStatus(strength)}` : ''}` : 'No test yet'}
      points={worst?.group.points.map((point, index) => ({ ...point, day: strengthEvaluations?.[index]?.day }))}
      onClick={() => onOpen('fuerza', worst?.group.muscleKeys[0])}/>
  </>;
}
