import React, { useMemo, useState } from 'react';
import { Line, LineChart, ReferenceLine, ResponsiveContainer, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { useDashboard } from '../data/useDashboard.js';
import { dashboardUrl, loadDashboard } from '../data/dashboard.js';
import { TYPE_LABEL, displayStatus, loadPlan, timing, upcoming } from '../data/plan.js';
import { AlertIcon } from '../fuerza/App.jsx';
import { LEVEL_COLORS, colorScale, fmtNum, fmtPct, levelColor, levelText } from '../fuerza/data.js';
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

function Tile({ title, value, unit, change, level, levels, note, alert, spark, onOpen }) {
  return <button type="button" className="tile" data-alert={alert ? alert.severity : undefined} onClick={onOpen}>
    <span className="tile-title">{title}{alert && <span className={`tile-flag tile-flag-${alert.severity}`}><AlertIcon/>{alert.severity === 'critical' ? 'Standard crossed' : 'Faster than expected'}</span>}</span>
    <span className="tile-value">{value}<small>{unit}</small></span>
    <span className="tile-change"><i style={{ background: levelColor(level) }} aria-hidden="true"/>{change}<span>{level ? levels.find(l => l.level === level)?.label : 'No data'}</span></span>
    {spark}
    {note && <span className="tile-note">{note}</span>}
  </button>;
}

export function SummaryView({ data, crewId, apiUrl, exampleMode, onOpen }) {
  const { data: dashboard } = useDashboard(exampleMode ? '' : dashboardUrl(apiUrl, crewId), loadDashboard);
  const { data: today } = useDashboard(exampleMode || !crewId ? null : planTodayUrl(crewId), loadPlan);
  const alerts = useMemo(() => alertsOf(data), [data]);
  const status = overallStatus(alerts);
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
  const highlight = selectedKey ?? rows.find(r => alerted.has(r.group.key))?.group.muscleKeys[0] ?? null;
  const indicatorText = useMemo(() => key => {
    const r = rows.find(row => row.group.muscleKeys.includes(key));
    return r ? { name: r.group.name, value: fmtPct(r.point?.changePct) } : null;
  }, [rows]);
  const checkpointItems = useMemo(() => rows.map(r => ({ id: r.group.key, title: r.group.name, muscleKeys: r.group.muscleKeys })), [rows]);
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
          <span className={`sev sev-${a.severity}`}><AlertIcon/>{a.severity === 'critical' ? 'Critical' : 'Warning'}</span>
          <strong>{a.system}</strong><span className="status-msg">{a.message}</span><span className="go" aria-hidden="true">→</span>
        </button></li>)}
      </ul>}
      <div className="status-mission">
        <span>{progress.phase}</span><strong>{progress.text}</strong>
        <div className="mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label="Mission progress"><i style={{ width: `${progress.ratio * 100}%` }}/></div>
      </div>
    </section>

    <div className="summary-grid">
      <section className="panel body-card" aria-labelledby="body-title">
        <header className="panel-head"><h3 id="body-title">Body</h3><span>Muscle strength, latest test vs pre-flight</span></header>
        <div className="body-card-stage">
          <BodyViewer body={data.crew.body} layer="surface" scores={scores} selected={highlight} onSelect={key => setSelectedKey(key)} framing={1.08} showIndicators checkpointItems={checkpointItems} colorScale={colorScale} indicatorText={indicatorText}/>
        </div>
        <ul className="mini-legend" aria-label="Colour scale">
          {levels.map(l => <li key={l.level}><i style={{ background: LEVEL_COLORS[l.level] }}/>{l.label}</li>)}
        </ul>
        {alerted.size > 0 && <p className="body-note"><AlertIcon/> Highlighted: losing strength faster than expected.</p>}
      </section>

      <section className="panel indicators" aria-labelledby="ind-title">
        <header className="panel-head"><h3 id="ind-title">Key indicators</h3><span>Change since pre-flight</span></header>
        <div className="tiles">
          <Tile title="Aerobic capacity" value={vo2 ? fmtNum(vo2.value) : '—'} unit={` ${aero.unit}`} change={vo2 ? fmtPct(vo2.changePct) : '—'} level={vo2?.level} levels={levels}
            note={`NASA minimum ${aero.minimum} ${aero.unit}`} alert={aero.alert}
            spark={<Spark values={aero.evaluations.map(e => e.value)} reference={aero.baseline} minimum={aero.minimum}/>} onOpen={() => onOpen('aerobica')}/>
          <Tile title="Weakest muscle group" value={worst ? fmtPct(worst.point?.changePct) : '—'} unit={worst ? ` ${worst.group.name}` : ''} change={worst ? `${fmtNum(worst.point?.value)} ${worst.group.unit}` : '—'} level={worst?.point?.level} levels={levels}
            note={worst ? worst.group.test : null} alert={worst?.group.alert}
            spark={worst && <Spark values={worst.group.points.map(p => p.value)} reference={worst.group.baseline}/>} onOpen={() => onOpen('fuerza', worst?.group.muscleKeys[0])}/>
          {/* Bone level uses the same 5/10/20% bands as the HealthService levels (data.levels). */}
          <Tile title="Hip bone density" value={bone?.scanned ? fmtPct(bone.changePct) : '—'} unit="" change={bone?.scanned ? `${(100 + bone.changePct).toFixed(1)}% of pre-flight` : 'No scan since launch'} level={!bone?.scanned ? null : bone.changePct > -5 ? 1 : bone.changePct > -10 ? 2 : bone.changePct > -20 ? 3 : 4} levels={levels}
            note={bone?.scanned ? 'DXA scan' : 'There is no DXA on board: bone is scanned before and after flight.'} spark={bone?.scanned && <Spark values={bone.points.map(p => p.value)} reference={100}/>} onOpen={() => onOpen('plan')}/>
        </div>
        <div className="muscle-bars" role="list" aria-label="Muscle groups, largest loss first">
          {rows.map(({ group: g, point: p }) => {
            const loss = Math.min(30, Math.max(0, -(p?.changePct ?? 0)));
            return <button type="button" role="listitem" key={g.key} className="muscle-bar" data-alert={g.alert ? 'yes' : undefined} onClick={() => setSelectedKey(g.muscleKeys[0])}>
              <span className="mb-name">{g.alert && <AlertIcon/>}{g.name}</span>
              <span className="mb-track"><i style={{ width: `${(loss / 30) * 100}%`, background: levelColor(p?.level) }}/></span>
              <span className="mb-value">{fmtPct(p?.changePct)}</span>
              <span className="mb-level">{p ? levelText(p, levels) : 'No data'}</span>
            </button>;
          })}
        </div>
      </section>

      <section className="panel todo" aria-labelledby="todo-title">
        <header className="panel-head"><h3 id="todo-title">To do</h3><span>{exampleMode ? 'Needs the Planner' : 'Open now and next 7 days'}</span></header>
        {tasks.length ? <ol className="todo-list">
          {tasks.map(({ item: i, more }) => <li key={i.id}><button type="button" onClick={() => onOpen('plan')}>
            <span className="todo-kind" data-status={displayStatus(i, today.mission.today)}>{TYPE_LABEL[i.type]}</span>
            <strong>{i.title}{more > 0 && <small> · daily</small>}</strong><span>{timing(i, today.mission.today)}</span>
          </button></li>)}
        </ol> : <p className="empty">{exampleMode ? 'Start the Planner to see the routine.' : today ? 'Nothing due in the next 7 days.' : 'Loading…'}</p>}
        <button type="button" className="link-btn" onClick={() => onOpen('plan')}>Open the mission plan →</button>
        {(data.strength.upcoming[0] || aero.upcoming[0]) && <div className="next-tests">
          <h4>Next tests</h4>
          {data.strength.upcoming[0] && <p><b>Strength</b> {data.strength.upcoming[0].label}{data.strength.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
          {aero.upcoming[0] && <p><b>Aerobic</b> {aero.upcoming[0].label}{aero.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
        </div>}
      </section>
    </div>
    <p className="summary-foot">{data.notice}</p>
  </div>;
}
