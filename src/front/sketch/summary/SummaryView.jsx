import React, { useMemo, useState } from 'react';
import { ATTRIBUTION } from 'open-anatomy-3d';
import { components } from '../aerobica/data.js';
import { Icon } from '../vuelo/Icons.jsx';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { useDashboard } from '../data/useDashboard.js';
import { TYPE_LABEL, displayStatus, loadPlan, timing, upcoming } from '../data/plan.js';
import { AlertIcon } from '../fuerza/App.jsx';
import { LEVEL_COLORS, colorScale, fmtPct, levelColor, levelText } from '../fuerza/data.js';
import { watchNotices } from '../data/vitals.js';
import { WatchPanel } from '../vitals/WatchPanel.jsx';
import { aerobicLatest, alertsOf, boneLatest, missionProgress, muscleRows, overallStatus } from './data.js';
import { Indicators } from './Indicators.jsx';
import './style.css';

const planTodayUrl = crew => `${(import.meta.env.VITE_PLANNER_URL || '/api/v1').replace(/\/$/, '')}/plan/today?crew=${encodeURIComponent(crew)}`;

const inDays = (day, today) => {
  const d = Math.round(day - today);
  return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`;
};

export function SummaryView({ data, crewId, bodyState, exampleMode, onOpen, vitals = null, vitalsError }) {
  const { data: dashboard, error: boneError } = bodyState;
  const { data: today, error: planError } = useDashboard(exampleMode || !crewId ? null : planTodayUrl(crewId), loadPlan);
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
  const [layer, setLayer] = useState('organs');
  const [viewRequest, setViewRequest] = useState({ direction: 'front', request: 0 });

  const levelKey = rows.map(r => `${r.group.key}:${r.point?.level}`).join();
  const scores = useMemo(() => Object.fromEntries(rows.flatMap(r => r.group.muscleKeys.map(k => [k, r.point?.level ?? 0]))), [levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const structureColors = useMemo(() => {
    const anatomical = components.filter(c => c.id !== 'muscle')
      .flatMap(c => c.keys.map(key => [key, c.color]));
    const measuredMuscles = Object.entries(scores).map(([key, level]) => [key, levelColor(level)]);
    return Object.fromEntries([...anatomical, ...measuredMuscles]);
  }, [scores]);
  // Point at the group with an alert; with no alert, at the largest loss the HealthService reported (rows come sorted).
  const focusRow = rows.find(r => alerted.has(r.group.key)) ?? (rows[0]?.point?.level > 1 ? rows[0] : null);
  const highlight = selectedKey ?? focusRow?.group.muscleKeys[0] ?? null;
  // Keep one callout per group, with a second measurement for context.
  const labelled = new Set(rows.filter(r => r.point && (alerted.has(r.group.key) || r.group.muscleKeys.includes(highlight) || r === rows[1]))
    .map((r, i) => r.group.muscleKeys.includes(highlight) ? highlight : r.group.muscleKeys[i % r.group.muscleKeys.length]));
  const indicatorFilter = key => labelled.has(key);
  const indicatorText = useMemo(() => key => {
    const r = rows.find(row => row.group.muscleKeys.includes(key));
    return r ? { name: r.group.name, value: fmtPct(r.point?.changePct) } : null;
  }, [rows]);
  const tasks = today ? upcoming(today.items, today.mission.today).slice(0, 6) : [];

  return <div className="health-summary">
    <div className="summary-grid">
      <div className="summary-anatomy">
        <section className="panel body-card" aria-labelledby="body-title">
          <header className="anatomy-head">
            <div><h2 id="body-title">Anatomical view</h2><p>Muscle strength vs pre-flight</p></div>
            <button className="anatomy-open" type="button" aria-label="Open detailed muscle analysis" title="Open detailed muscle analysis" onClick={() => onOpen('fuerza', highlight)}><Icon name="expand"/></button>
          </header>
          <div className="anatomy-field">
            <div className="anatomy-layer" role="group" aria-label="Anatomy layer">
              {['organs', 'surface'].map(value => <button key={value} type="button" aria-pressed={value === layer} onClick={() => setLayer(value)}>{value === 'surface' ? 'Surface' : 'Internal'}</button>)}
            </div>
            <div className="body-card-stage">
              <BodyViewer body={data.crew.body} layer={layer} scores={scores} selected={highlight}
                onSelect={key => { if (rows.some(r => r.group.muscleKeys.includes(key))) setSelectedKey(key); }}
                framing={1.08} structureColors={structureColors} viewRequest={viewRequest} showIndicators indicatorFilter={indicatorFilter}
                colorScale={colorScale} indicatorText={indicatorText}/>
            </div>
            <div className="anatomy-tools">
              <span><Icon name="rotate" size={16}/>Drag to rotate</span>
              <div role="group" aria-label="Model orientation">{['front', 'back'].map(direction =>
                <button type="button" key={direction} aria-pressed={viewRequest.direction === direction}
                  onClick={() => setViewRequest(previous => ({ direction, request: previous.request + 1 }))}>
                  {direction === 'front' ? 'Front' : 'Back'}
                </button>)}</div>
            </div>
          </div>
          <ul className="mini-legend" aria-label="Colour scale">
            {levels.map(l => <li key={l.level}><i style={{ background: LEVEL_COLORS[l.level] }}/>{l.label}</li>)}
          </ul>
          <details className="model-credits"><summary>Model &amp; colour key</summary>
            <p>The scale applies to tested muscles. The heart, lungs and vessels are shown for anatomical reference.</p>
            <p><a href="https://github.com/MervinR07/open-anatomy-3d">Open Anatomy 3D</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a><br/>{ATTRIBUTION} Surface regions and materials adapted for this viewer.</p>
          </details>
        </section>

        <section className="panel muscle-section" aria-labelledby="muscle-list-title">
          <header className="panel-head"><h2 id="muscle-list-title">Muscle groups</h2><span>Change vs pre-flight</span></header>
          <ul className="muscle-bars" aria-label="Muscle groups, largest loss first">
            {rows.map(({ group: g, point: p }) => {
              const loss = Math.min(30, Math.max(0, -(p?.changePct ?? 0)));
              return <li key={g.key}><button type="button" className="muscle-bar" aria-pressed={g.muscleKeys.includes(highlight)} data-alert={g.alert ? 'yes' : undefined} data-selected={g.muscleKeys.includes(highlight) || undefined} onClick={() => setSelectedKey(g.muscleKeys[0])}>
                <span className="mb-name">{g.alert && <AlertIcon/>}{g.name}</span>
                <span className="mb-track"><i style={{ width: `${(loss / 30) * 100}%`, background: levelColor(p?.level) }}/></span>
                <span className="mb-value">{fmtPct(p?.changePct)}</span>
                <span className="mb-level">{p ? levelText(p, levels) : 'No data'}</span>
              </button></li>;
            })}
          </ul>
        </section>
      </div>

      <div className="hero-right">
        <details className={`status-compact status-${status.tone}`}>
          <summary>
            <span className="status-symbol"><Icon name={status.tone === 'ok' ? 'check' : 'pulse'} size={20}/></span>
            <span><small>Mission status</small><strong>{alerts.length || vitals ? status.title : 'No test alerts'}</strong></span>
            <span className="status-action">{alerts.length ? `${alerts.length} to review` : progress.text}<Icon name="down" size={16}/></span>
          </summary>
          <div className="status-expanded">
            <p>{!vitals && !alerts.length ? 'No alerts reported by the available flight tests. Wearable readings are unavailable.' : status.detail}</p>
      {alerts.length > 0 && <ul className="status-alerts">
        {alerts.map(a => <li key={a.id}><button type="button" onClick={() => onOpen(a.tab, a.focus)}>
          <span className={`sev sev-${a.severity}`}><AlertIcon/>{a.severity === 'critical' ? 'Critical' : a.severity === 'watch' ? 'Watch' : 'Warning'}</span>
          <strong>{a.system}</strong><span className="status-msg">{a.message}</span><span className="go">Details <span aria-hidden="true">→</span></span>
        </button></li>)}
      </ul>}
            <div className="status-mission"><span>{progress.phase}</span><strong>{progress.text}</strong><div className="mission-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress.ratio * 100)} aria-label="Mission progress"><i style={{ width: `${progress.ratio * 100}%` }}/></div></div>
          </div>
        </details>
        <Indicators aero={aero} vo2={vo2} worst={worst} bone={bone} levels={levels} onOpen={onOpen}
          strengthEvaluations={data.strength.evaluations} boneError={boneError} dashboardLoading={!dashboard && !boneError}/>
        <div className="summary-followup">
          {!exampleMode && <WatchPanel vitals={vitals} error={vitalsError} compact onOpen={() => onOpen('vitales')}/>}
          <section className="panel todo" aria-labelledby="todo-title">
            <header className="panel-head"><h2 id="todo-title">Mission schedule</h2><span>{exampleMode ? 'Needs the Planner' : 'Now and the next 7 days'}</span></header>
            {tasks.length ? <ol className="todo-list">
              {tasks.map(({ item: i, more }) => <li key={i.id}><button type="button" onClick={() => onOpen('plan')}>
                <span className="todo-kind" data-status={displayStatus(i, today.mission.today)}>{TYPE_LABEL[i.type]}</span>
                <strong>{i.title}{more > 0 && <small> · daily</small>}</strong><span>{timing(i, today.mission.today)}</span>
              </button></li>)}
            </ol> : <p className="empty">{exampleMode ? 'Start the Planner to see the routine.' : today ? 'Nothing due in the next 7 days.' : planError ? 'Planner unavailable. Reconnecting…' : 'Loading…'}</p>}
            <button type="button" className="link-btn" onClick={() => onOpen('plan')}>Open the mission plan →</button>
            {(data.strength.upcoming[0] || aero.upcoming[0]) && <div className="next-tests">
              <h3>Next tests</h3>
              {data.strength.upcoming[0] && <p><b>Strength</b> {data.strength.upcoming[0].label} · {inDays(data.strength.upcoming[0].day, data.mission.today)}{data.strength.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
              {aero.upcoming[0] && <p><b>Aerobic</b> {aero.upcoming[0].label} · {inDays(aero.upcoming[0].day, data.mission.today)}{aero.upcoming[0].reason === 'retest' ? ' · retest' : ''}</p>}
            </div>}
          </section>
        </div>
      </div>
    </div>
    <p className="summary-foot">{data.notice}</p>
  </div>;
}
