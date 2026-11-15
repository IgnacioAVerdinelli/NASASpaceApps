import React, { useEffect, useId, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip } from './components/chart.jsx';
import { changeRows, intensityRows, timeRows } from './data/trends.js';

const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const shortDate = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const format = value => Number(value.toPrecision(4)).toString();
// Colours are theme tokens (theme/glass.css).
const config = { value: { label: 'Value', color: 'var(--chart-line)' } };
const tick = { fill: 'var(--chart-tick)', fontSize: 11 };
const GRID = 'var(--chart-grid)';

function useMotionAllowed() {
  const [allowed, setAllowed] = useState(() => typeof window !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setAllowed(!media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  return allowed;
}

function DataTable({ rows, unit, dateValues = false }) {
  return <details className="chart-data"><summary>View data table</summary><div className="chart-table-wrap"><table><thead><tr><th scope="col">{dateValues ? 'Date' : 'Area'}</th><th scope="col">Value{unit ? ` (${unit})` : ''}</th></tr></thead><tbody>{rows.map((row, i) => <tr key={i}><th scope="row">{dateValues ? date(row.time) : row.name}</th><td>{row.value === null ? 'No data' : format(row.value)}</td></tr>)}</tbody></table></div></details>;
}

function HistoryChart({ chart, motion }) {
  const id = useId().replace(/:/g, '');
  const rows = timeRows(chart.points);
  const valid = rows.filter(row => row.value !== null);
  const values = valid.map(row => row.value);
  if (chart.reference !== null) values.push(chart.reference);
  const low = values.length ? Math.min(...values) : 0;
  const high = values.length ? Math.max(...values) : 1;
  const pad = (high - low || Math.max(Math.abs(high) * 0.1, 1)) * 0.15;
  const latest = valid.at(-1);
  const unit = chart.unit ? ` ${chart.unit}` : '';
  return <article className="trend-history glass" id={`chart-${chart.id}`}><div className="trend-card-header"><div><h3>{chart.title}</h3><p>{chart.description}</p></div>{latest && <div className="trend-latest"><strong>{format(latest.value)}<small>{unit}</small></strong><span>{date(latest.time)}</span></div>}</div>
    {!valid.length ? <p className="chart-empty">No data available for this period.</p> : <><ChartContainer config={{ value: { ...config.value, label: chart.unit || 'Value' } }} className="history-chart"><AreaChart accessibilityLayer data={rows} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
      <defs><linearGradient id={`trend-fill-${id}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--chart-line)" stopOpacity={0.14}/><stop offset="100%" stopColor="var(--chart-line)" stopOpacity={0.02}/></linearGradient></defs>
      <CartesianGrid vertical={false} stroke={GRID}/><XAxis dataKey="time" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={shortDate} tick={tick} axisLine={false} tickLine={false} minTickGap={24}/><YAxis domain={[low - pad, high + pad]} tickFormatter={format} tick={tick} axisLine={false} tickLine={false} width={46}/>
      {chart.reference !== null && <ReferenceLine y={chart.reference} stroke="var(--muted)" strokeOpacity={0.7} strokeDasharray="5 5"/>}
      <ChartTooltip contentProps={{ labelFormatter: date, valueFormatter: value => `${format(value)}${unit}` }} cursor={{ stroke: 'var(--muted)', strokeOpacity: 0.5, strokeDasharray: '3 4' }}/>
      <Area type="monotone" dataKey="value" stroke="var(--chart-line)" strokeWidth={2.25} fill={`url(#trend-fill-${id})`} connectNulls={false} dot={{ r: 3, fill: 'var(--chart-line)', stroke: '#FFFFFF', strokeWidth: 2 }} activeDot={{ r: 5 }} isAnimationActive={motion} animationDuration={700}/>
    </AreaChart></ChartContainer><div className="trend-legend"><span><i className="legend-line"/> {chart.unit || 'Value'}</span>{chart.reference !== null && <span><i className="legend-reference"/> Reference: {format(chart.reference)}{unit}</span>}</div><DataTable rows={rows} unit={chart.unit} dateValues/></>}
    {chart.insight && <p className="trend-context">{chart.insight}</p>}
  </article>;
}

function ComparisonChart({ title, description, rows, unit, motion, signed = false }) {
  const domain = signed ? ['auto', 'auto'] : [0, 100];
  return <article className="comparison-panel glass"><div className="trend-card-header"><div><h3>{title}</h3><p>{description}</p></div></div>
    {!rows.length ? <p className="chart-empty">No data available.</p> : <><div className="comparison-scroll"><ChartContainer config={{ value: { ...config.value, label: signed ? 'Change' : 'Intensity' } }} className="comparison-chart" style={{ height: Math.max(260, rows.length * 34 + 36) }}><BarChart accessibilityLayer data={rows} layout="vertical" margin={{ top: 4, right: 18, bottom: 0, left: 0 }}>
      <CartesianGrid horizontal={false} stroke={GRID}/><XAxis type="number" domain={domain} tick={tick} tickFormatter={value => `${value}${unit}`} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" tick={tick} axisLine={false} tickLine={false} width={118} interval={0}/>
      {signed && <ReferenceLine x={0} stroke="var(--muted)"/>}<ChartTooltip contentProps={{ valueFormatter: value => `${signed && value > 0 ? '+' : ''}${format(value)}${unit}` }} cursor={{ fill: 'rgba(255,255,255,.45)' }}/>
      <Bar dataKey="value" radius={[0, 5, 5, 0]} maxBarSize={18} isAnimationActive={motion} animationDuration={650}>{rows.map((row, i) => <Cell key={i} fill={signed && row.value < 0 ? 'var(--chart-strength)' : 'var(--chart-line)'}/>)}</Bar>
    </BarChart></ChartContainer></div><DataTable rows={rows} unit={unit}/></>}
  </article>;
}

export default function Trends({ charts, summary, scores, simulated, chartRegion, onChartRegion }) {
  const motion = useMotionAllowed();
  const intensity = intensityRows(summary.items, scores);
  const changes = changeRows(summary.items);
  return <section className="trends" id="trends"><div className="trends-inner"><div className="trends-heading glass-sm"><div><h2>Trends</h2><p>Explore changes over time and compare muscle areas.</p></div><label className="trend-filter">Region <select value={chartRegion} onChange={event => onChartRegion(event.target.value)}><option value="all">All datasets</option>{summary.items.filter(item => item.muscleKeys.length > 0).map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
    <div className="history-list">{charts.length ? charts.map(chart => <HistoryChart key={chart.id} chart={chart} motion={motion}/>) : <p className="chart-empty">No trend data available for this selection.</p>}</div>
    <div className="comparisons"><ComparisonChart title="Muscle intensity" description="Current values for each available muscle area." rows={intensity} unit=" / 100" motion={motion}/><ComparisonChart title="Change from reference" description="Reported change for each area, as a percentage." rows={changes} unit="%" signed motion={motion}/></div>
    <p className="trends-footnote glass-sm">{simulated ? 'Illustrative data for visual exploration. ' : ''}Values and changes are shown as provided; they are not a health assessment.</p>
  </div></section>;
}
