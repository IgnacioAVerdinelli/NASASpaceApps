import React from 'react';
import { chartGeometry } from './data/chart.js';

const date = value => new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const number = value => Number(value.toPrecision(4)).toString();

export default function Chart({ chart }) {
  const geometry = chartGeometry(chart.points, chart.reference);
  const { segments, referenceY, min, max, first, last } = geometry;
  return <div className="trend-grid"><div className="chart-area"><div className="chart-head"><div><h3>{chart.title}</h3><p>{chart.description}</p></div></div>
    {!segments.length ? <p className="no-trend">No data available.</p> : <><div className="chart"><div className="axis"><span>{number(max)} {chart.unit}</span><span>{number((min + max) / 2)} {chart.unit}</span><span>{number(min)} {chart.unit}</span></div>
      <svg viewBox="0 0 550 145" preserveAspectRatio="none" role="img" aria-label={`${chart.title}, ${chart.unit}`}><path d="M0 0H550 M0 72.5H550 M0 145H550" stroke="#dce1f1" strokeWidth="1"/>{referenceY !== null && <path d={`M0 ${referenceY}H550`} stroke="#9ca9c7" strokeWidth="1.5" strokeDasharray="5 6"/>}{segments.map((segment, i) => segment.length === 1 ? <circle key={i} cx={segment[0].x} cy={segment[0].y} r="3" fill="#7667c9"/> : <polyline key={i} points={segment.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke="#7667c9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>)}</svg>
      <div className="dates"><span>{date(first)}</span>{last !== first && <span>{date(last)}</span>}</div></div><div className="legend"><span><i/> {chart.unit || 'Value'}</span>{referenceY !== null && <span><i className="reference"/> Reference: {chart.reference} {chart.unit}</span>}</div></>}
    </div>{chart.insight && <aside className="interpretation"><h3>Context</h3><p>{chart.insight}</p><a href="#top">Back to body map ↑</a></aside>}</div>;
}
