import React, { createContext, useContext } from 'react';
import { ResponsiveContainer, Tooltip } from 'recharts';

// Adapted from shadcn/ui's chart container and tooltip for this CSS-based app.
const ChartContext = createContext({});

export function ChartContainer({ config, children, className = '', style }) {
  return <ChartContext.Provider value={config}><div className={`chart-container ${className}`} style={style} data-slot="chart">
    <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 240 }}>{children}</ResponsiveContainer>
  </div></ChartContext.Provider>;
}

export function ChartTooltipContent({ active, payload, label, labelFormatter, valueFormatter }) {
  const config = useContext(ChartContext);
  if (!active || !payload?.length) return null;
  const entries = payload.filter(item => item.value !== null && item.value !== undefined);
  if (!entries.length) return null;
  return <div className="chart-tooltip"><strong>{labelFormatter ? labelFormatter(label) : label}</strong>{entries.map((item, i) => <div key={`${item.dataKey}-${i}`}><span className="tooltip-dot" style={{ background: item.color || config[item.dataKey]?.color }} />{config[item.dataKey]?.label || item.name}: <b>{valueFormatter ? valueFormatter(item.value) : item.value}</b></div>)}</div>;
}

export function ChartTooltip({ contentProps, ...props }) {
  return <Tooltip {...props} content={<ChartTooltipContent {...contentProps} />} />;
}
