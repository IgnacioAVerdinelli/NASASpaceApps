import React, { useState } from 'react';
import Trends from './Chart.jsx';
import './body-map.css';

// Shared dashboard trends shown below the strength measurements.
export function BodyTrends({ dashboard, stale = false }) {
  const [chartRegion, setChartRegion] = useState('all');
  const { summary, charts, body, simulated } = dashboard;
  const region = summary.items.find(item => item.id === chartRegion);
  const relevant = charts.filter(chart => !region || chart.muscleKeys.length === 0 || chart.muscleKeys.some(key => region.muscleKeys.includes(key)));
  return <div className="body-map-view">
    {stale && <div className="connection-notice" role="status">Connection lost. Showing the last available trend data.</div>}
    <Trends charts={relevant} summary={summary} scores={body.scores} simulated={simulated} chartRegion={chartRegion} onChartRegion={setChartRegion}/>
  </div>;
}
