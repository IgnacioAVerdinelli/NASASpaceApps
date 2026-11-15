import React, { useMemo, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { useDashboard } from '../data/useDashboard.js';
import { dashboardUrl, loadDashboard } from '../data/dashboard.js';
import { TYPE_LABEL, displayStatus, loadPlan, timing, upcoming } from '../data/plan.js';
import { AlertIcon } from '../fuerza/App.jsx';
import { LEVEL_COLORS, colorScale, fmtNum, fmtPct, levelColor, levelText } from '../fuerza/data.js';
import { watchNotices } from '../data/vitals.js';
import { WatchPanel } from '../vitals/WatchPanel.jsx';
import { aerobicLatest, alertsOf, boneLatest, missionProgress, muscleRows, overallStatus } from './data.js';
import './style.css';

const planTodayUrl = crew => `${(import.meta.env.VITE_PLANNER_URL || '/api/v1').replace(/\/$/, '')}/plan/today?crew=${encodeURIComponent(crew)}`;

function Spark({ values, color = '#6258a0', reference = null, minimum = null }) {
  const data = values.filter(v => v != null).map((v, i) => ({ i, v }));
  if (data.length < 2) return null;
  return <div className="spark" aria-hidden="true"><ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 160, height: 48 }}>
    <LineChart data={data} margin={{ top: 4, right: 2, bottom: 4, left: 2 }}>
      <YAxis hide domain={['dataMin - 2', 'dataMax + 2']}/>
      {reference != null && <ReferenceLine y={reference} stroke="#b9b6cf" strokeDasharray="3 3"/>}
      {minimum != null && <ReferenceLine y={minimum} stroke="#a4242f" strokeDasharray="4 3"/>}
      <Line dataKey="v" stroke={color} strokeWidth={2.5} dot={false} isAnimationActive={false}/>
    </LineChart>
  </ResponsiveContainer></div>;
}

// One key number. `point` is a HealthService point ({ level, belowMinimum, quality }); its words come from levelText.
function Tile({ title, value, unit, change, point, levels, note, alert, spark, muted = false, onOpen }) {
  return <button type="button" className="tile" data-alert={alert ? alert.severity : undefined} data-muted={muted || undefined} onClick={onOpen}>
    <span className="tile-title">{title}</span>
    {alert && <span className={`tile-flag tile-flag-${alert.severity}`}><AlertIcon/>{alert.severity === 'critical' ? 'NASA standard crossed' : 'Faster than expected'}</span>}
    <span className="tile-value">{value}{unit && <small>{unit}</small>}</span>
    {change && <span className="tile-change"><b>{point && <i style={{ background: levelColor(point.level) }} aria-hidden="true"/>}{change}</b>{point && <span>{levelText(point, levels)}</span>}</span>}
    {spark}
    {note && <span className="tile-note">{note}</span>}
  </button>;
}

const inDays = (day, today) => {
  const d = Math.round(day - today);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
};

export function SummaryView({ data, crewId, apiUrl, exampleMode, onOpen, vitals = null }) {
  const { data: dashboard } = useDashboard(exampleMode ? '' : dashboardUrl(apiUrl, crewId), loadDashboard);
  const { data: today } = useDashboard(exampleMode || !crewId ? null : planTodayUrl(crewId), loadPlan);
  const testAlerts = useMemo(() => alertsOf(data), [data]);
  const notices = useMemo(() => watchNotices(vitals), [vitals]);
  const alerts = [...testAlerts, ...notices];
  const status = overallStatus(testAlerts, notices);
  const rows = useMemo(() => muscleRows(data), [data]);
  const levels = data.levels;
  const aero = data.aerobic;
  const vo2 = aerobicLatest(data);
  const bone = boneLatest(dashboard);
  const progress = missionProgress(data.mission);
  const worst = rows[0];
  const alerted = new Set(alerts.filter(a => a.focus).map(a => a.id.split(':')[1]));
  const [selectedKey, setSelectedKey] = useState(null);

  const levelKey = rows.map(r => `${r.group.key}:${r.point?.level}`).join();
  const scores = useMemo(() => Object.fromEntries(rows.flatMap(r => r.group.muscleKeys.map(k => [k, r.point?.level ?? 0]))), [levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  // Point at the group with an alert; with no alert, at the largest loss the HealthService reported (rows come sorted).
  const focusRow = rows.find(r => alerted.has(r.group.key)) ?? (rows[0]?.point?.level > 1 ? rows[0] : null);
  const highlight = selectedKey ?? focusRow?.group.muscleKeys[0] ?? null;
  // Label only the group in focus (and any with an alert): the bars beside the body list every group.
  const labelled = new Set(rows.filter(r => alerted.has(r.group.key) || r.group.muscleKeys.includes(highlight)).flatMap(r => r.group.muscleKeys));
  const indicatorFilter = key => labelled.has(key);
  const indicatorText = useMemo(() => key => {
    const r = rows.find(row => row.group.muscleKeys.includes(key));
    return r ? { name: r.group.name, value: fmtPct(r.point?.changePct) } : null;
  }, [rows]);
  const tasks = today ? upcoming(today.items, today.mission.today).slice(0, 6) : [];

  return <div className="health-summary">
    <section className={`status-band status-${status.tone}`} aria-live="polite">
      <div className="status-main">
        <span className="status-dot" aria-hidden="true"/>
        <div>
          <h2>{status.title}</h2>
          <p>{status.detail}</p>
        </div>
      </div>
      {alerts.length > 0 && <ul className="status-alerts">
        {alerts.map(a => <li key={a.id}><button type="button" onClick={() => onOpen(a.tab, a.focus)}>
          <span className={`sev sev-${a.severity}`}><AlertIcon/>{a.severity === 'critical' ? 'Critical' : a.severity === 'watch' ? 'Watch' : 'Warning'}</span>
          <strong>{a.system}</strong><span className="status-msg">{a.message}</span><span className="go">Details <span aria-hidden="true">→</span></span>
        </button></li>)}
      </ul>}
      <div className="status-mission">
        <span>{progress.phase}</span><strong>{progress.text}</strong>
        <div className="mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label="Mission progress"><i style={{ width: `${progress.ratio * 100}%` }}/></div>
      </div>
    </section>

    {!exampleMode && <WatchPanel vitals={vitals} compact onOpen={() => onOpen('vitales')}/>}

    <div className="summary-grid">
      <section className="panel body-card" aria-labelledby="body-title">
        <header className="panel-head"><h3 id="body-title">Muscle strength</h3><span>Latest test vs pre-flight</span></header>
        <div className="body-card-stage">
          <BodyViewer body={data.crew.body} layer="surface" scores={scores} selected={highlight} onSelect={key => setSelectedKey(key)} framing={1.08} showIndicators indicatorFilter={indicatorFilter} colorScale={colorScale} indicatorText={indicatorText}/>
        </div>
        <ul className="mini-legend" aria-label="Colour scale">
          {levels.map(l => <li key={l.level}><i style={{ background: LEVEL_COLORS[l.level] }}/>{l.label}</li>)}
        </ul>
        <p className="body-help">Colour shows how much strength each group has lost since before flight. {alerted.size > 0
          ? <b className="body-alert"><AlertIcon/> Marked: losing strength faster than expected.</b>
          : 'No group is losing strength faster than expected.'}</p>
      </section>

      <section className="panel indicators" aria-labelledby="ind-title">
        <header className="panel-head"><h3 id="ind-title">Key indicators</h3><span>Select one for details</span></header>
        <div className="tiles">
          <Tile title="Aerobic capacity" value={vo2 ? fmtNum(vo2.value) : '—'} unit={` ${aero.unit}`} change={vo2 ? `${fmtPct(vo2.changePct)} vs pre-flight` : 'No test yet'} point={vo2} levels={levels}
            note={vo2?.belowMinimum && !aero.alert
              ? `Latest test is below the NASA minimum (${aero.minimum}); the alert uses the average of the last two tests.`
              : `NASA minimum: ${aero.minimum} ${aero.unit} (red dashed line)`} alert={aero.alert}
            spark={<Spark values={aero.evaluations.map(e => e.value)} reference={aero.baseline} minimum={aero.minimum}/>} onOpen={() => onOpen('aerobica')}/>
          <Tile title={worst ? `Largest strength loss: ${worst.group.name}` : 'Largest strength loss'} value={worst ? fmtPct(worst.point?.changePct) : '—'} unit="" change={worst?.point ? `${fmtNum(worst.point.value)} ${worst.group.unit}` : 'No test yet'} point={worst?.point} levels={levels}
            note={worst ? worst.group.test : null} alert={worst?.group.alert}
            spark={worst && <Spark values={worst.group.points.map(p => p.value)} reference={worst.group.baseline}/>} onOpen={() => onOpen('fuerza', worst?.group.muscleKeys[0])}/>
          {/* No level: the dashboard chart carries none, and the frontend does not classify bone loss itself. */}
          <Tile title="Hip bone density" value={bone?.scanned ? fmtPct(bone.changePct) : 'Not scanned in flight'} unit="" muted={!bone?.scanned}
            change={bone?.scanned ? `${(100 + bone.changePct).toFixed(1)}% of pre-flight` : null}
            note={bone?.scanned ? (bone.insight || 'DXA scan') : 'There is no bone scanner (DXA) on board: hips are scanned before and after flight.'} spark={bone?.scanned && <Spark values={bone.points.map(p => p.value)} reference={100}/>} onOpen={() => onOpen('plan')}/>
        </div>
        <div className="muscle-bars" role="list" aria-label="Muscle groups, largest loss first">
          {rows.map(({ group: g, point: p }) => {
            const loss = Math.min(30, Math.max(0, -(p?.changePct ?? 0)));
            return <button type="button" role="listitem" key={g.key} className="muscle-bar" data-alert={g.alert ? 'yes' : undefined} data-selected={g.muscleKeys.includes(highlight) || undefined} onClick={() => setSelectedKey(g.muscleKeys[0])}>
              <span className="mb-name">{g.alert && <AlertIcon/>}{g.name}</span>
              <span className="mb-track"><i style={{ width: `${(loss / 30) * 100}%`, background: levelColor(p?.level) }}/></span>
              <span className="mb-value">{fmtPct(p?.changePct)}</span>
              <span className="mb-level">{p ? levelText(p, levels) : 'No data'}</span>
            </button>;
          })}
        </div>
      </section>

      <section className="panel todo" aria-labelledby="todo-title">
        <header className="panel-head"><h3 id="todo-title">To do</h3><span>{exampleMode ? 'Needs the Planner' : 'Now and the next 7 days'}</span></header>
        {tasks.length ? <ol className="todo-list">
          {tasks.map(({ item: i, more }) => <li key={i.id}><button type="button" onClick={() => onOpen('plan')}>
            <span className="todo-kind" data-status={displayStatus(i, today.mission.today)}>{TYPE_LABEL[i.type]}</span>
            <strong>{i.title}{more > 0 && <small> · daily</small>}</strong><span>{timing(i, today.mission.today)}</span>
          </button></li>)}
        </ol> : <p className="empty">{exampleMode ? 'Start the Planner to see the routine.' : today ? 'Nothing due in the next 7 days.' : 'Loading…'}</p>}
        <button type="button" className="link-btn" onClick={() => onOpen('plan')}>Open the mission plan →</button>
        {(data.strength.upcoming[0] || aero.upcoming[0]) && <div className="next-tests">
          <h4>Next tests</h4>
          {data.strength.upcoming[0] && <p><b>Strength</b> {data.strength.upcoming[0].label} · {inDays(data.strength.upcoming[0].day, data.mission.today)}{data.strength.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
          {aero.upcoming[0] && <p><b>Aerobic</b> {aero.upcoming[0].label} · {inDays(aero.upcoming[0].day, data.mission.today)}{aero.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
        </div>}
      </section>
    </div>
    <p className="summary-foot">{data.notice}</p>
  </div>;
}
