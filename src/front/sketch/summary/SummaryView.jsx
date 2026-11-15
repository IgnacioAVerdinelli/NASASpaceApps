import React, { useMemo, useState } from 'react';
import { ATTRIBUTION } from 'open-anatomy-3d';
import { components } from '../aerobica/data.js';
import { Icon } from '../vuelo/Icons.jsx';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { useDashboard } from '../data/useDashboard.js';
import { TYPE_LABEL, displayStatus, loadPlan, plainTitle, timing } from '../data/plan.js';
import { AlertIcon } from '../fuerza/App.jsx';
import { LEVEL_COLORS, colorScale, fmtPct, levelColor, levelText } from '../fuerza/data.js';
import { watchNotices } from '../data/vitals.js';
import { WatchPanel } from '../vitals/WatchPanel.jsx';
import { demoSurfaceScores } from '../data/demoSurface.js';
import { SEVERITY_TEXT, aerobicLatest, alertsOf, muscleRows, overallStatus, scheduleDays, scheduleRows } from './data.js';
import { Indicators } from './Indicators.jsx';
import './style.css';

const planTodayUrl = crew => `${(import.meta.env.VITE_PLANNER_URL || '/api/v1').replace(/\/$/, '')}/plan/today?crew=${encodeURIComponent(crew)}`;

// Plan kinds with a colour of their own (design-system §2.4); a retest comes from a finding, like a review.
const KIND = { review: 'review', retest: 'review', routine: 'routine', study: 'study', treatment: 'treatment' };
const ACTION = { fuerza: 'See muscle detail', aerobica: 'See aerobic capacity', vitales: 'See vital signs' };
const COUNT = ['No', 'One', 'Two', 'Three', 'Four', 'Five'];

// The sentence under "Mission status": what is going on, in the crew member's terms.
function statusLead(status, alerts, crew, hasVitals) {
  const who = crew ? `${crew}, ` : '';
  const lower = text => crew ? text[0].toLowerCase() + text.slice(1) : text;
  if (status.chip === 'crit') return who + lower('A NASA standard was crossed.');
  if (alerts.length) {
    const n = COUNT[alerts.length] ?? String(alerts.length);
    const fromWatch = alerts.every(a => a.tab === 'vitales') ? ' from your watch' : '';
    return who + lower(`${n} change${alerts.length === 1 ? '' : 's'}${fromWatch} need${alerts.length === 1 ? 's' : ''} a review.`);
  }
  return who + lower(hasVitals ? 'Nothing needs action now.' : 'No alerts from the flight tests.');
}

export function SummaryView({ data, crewId, exampleMode, onOpen, vitals = null, vitalsError }) {
  const { data: today, error: planError } = useDashboard(exampleMode || !crewId ? null : planTodayUrl(crewId), loadPlan);
  const testAlerts = useMemo(() => alertsOf(data), [data]);
  const notices = useMemo(() => watchNotices(vitals), [vitals]);
  const alerts = [...testAlerts, ...notices];
  const status = overallStatus(testAlerts, notices);
  const rows = useMemo(() => muscleRows(data), [data]);
  const levels = data.levels;
  const aero = data.aerobic;
  const vo2 = aerobicLatest(data);
  const worst = rows[0];
  const alerted = new Set(alerts.filter(a => a.focus).map(a => a.id.split(':')[1]));
  const [selectedKey, setSelectedKey] = useState(null);
  const [layer, setLayer] = useState('surface');
  const [viewRequest, setViewRequest] = useState({ direction: 'front', request: 0 });
  const [exploration, setExploration] = useState({ key: null, request: 0 });

  function selectMuscle(key) {
    if (!rows.some(row => row.group.muscleKeys.includes(key))) return;
    setSelectedKey(key);
    setExploration(previous => ({ key: previous.key === key ? null : key, request: previous.request + 1 }));
  }

  const levelKey = rows.map(r => `${r.group.key}:${r.point?.level}`).join();
  const scores = useMemo(() => Object.fromEntries(rows.flatMap(r => r.group.muscleKeys.map(k => [k, r.point?.level ?? 0]))), [levelKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const demoScores = demoSurfaceScores(data.mission, crewId);
  const surfaceScores = layer === 'surface' && demoScores ? { ...demoScores, ...scores } : scores;
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
  const indicatorFilter = key => labelled.has(key) && (scores[key] ?? 0) > 1;
  const indicatorText = useMemo(() => key => {
    const r = rows.find(row => row.group.muscleKeys.includes(key));
    return r ? { name: r.group.name, value: fmtPct(r.point?.changePct) } : null;
  }, [rows]);
  const strengthTest = worst?.point && data.strength.evaluations?.find(e => e.id === worst.point.evaluation)?.label;

  const missionToday = today?.mission.today;
  const days = today ? scheduleDays(missionToday, today.mission.landing) : [];
  const tasks = today ? scheduleRows(today.items, missionToday) : [];
  const noteOf = ({ item, more, sessions, span }) => more ? (sessions === span ? 'Daily' : `${sessions} sessions`) : timing(item, missionToday);

  const chipText = alerts.length || vitals ? status.title : 'No test alerts';
  const detail = !vitals && !alerts.length ? 'No alerts reported by the available flight tests. Wearable readings are unavailable.' : status.detail;

  return <div className="health-summary ov">
    <div className="ov-grid">
      <div className="ov-left">
        <Indicators aero={aero} vo2={vo2} worst={worst} levels={levels} onOpen={onOpen} strengthEvaluations={data.strength.evaluations}/>

        <section className="glass ov-muscles" aria-labelledby="muscle-list-title">
          <header className="ov-card-head"><h2 id="muscle-list-title">Muscle groups</h2><span>Change vs pre-flight</span></header>
          <ul className="ov-muscle-list" aria-label="Muscle groups, largest loss first">
            {rows.map(({ group: g, point: p }) => {
              const loss = Math.min(30, Math.max(0, -(p?.changePct ?? 0)));
              return <li key={g.key}><button type="button" className="ov-muscle" aria-pressed={g.muscleKeys.includes(highlight)} data-alert={g.alert ? g.alert.severity : undefined} onClick={() => selectMuscle(g.muscleKeys[0])}>
                <span className="ov-muscle-name">{g.alert && <AlertIcon/>}{g.name}<small>{p ? levelText(p, levels) : 'No data'}</small></span>
                <span className="ov-muscle-track"><i style={{ width: `${(loss / 30) * 100}%`, background: levelColor(p?.level) }}/></span>
                <span className="ov-muscle-value num">{fmtPct(p?.changePct)}</span>
              </button></li>;
            })}
          </ul>
        </section>
      </div>

      <section className="ov-body" aria-labelledby="body-title">
        <div className="ov-body-head">
          <div className="glass-sm ov-body-title">
            <h2 id="body-title">Body map</h2>
            <p>Strength vs pre-flight{strengthTest ? ` · test ${strengthTest}` : ''}</p>
            {layer === 'surface' && demoScores && <p>Unmeasured areas: illustrative demo colours, not readings or alerts.</p>}
            <div className="seg" role="group" aria-label="Anatomy layer">
              {['organs', 'surface'].map(value => <button key={value} type="button" aria-pressed={value === layer} onClick={() => setLayer(value)}>{value === 'surface' ? 'Surface' : 'Internal'}</button>)}
            </div>
          </div>
          <button type="button" className="glass-sm ov-pill" aria-label="Open detailed muscle analysis" onClick={() => onOpen('fuerza', highlight)}>Muscle detail<Icon name="expand" size={14}/></button>
        </div>
        <div className="ov-body-stage"><div className="ov-body-canvas">
          <BodyViewer body={data.crew.body} layer={layer} scores={surfaceScores} selected={highlight}
            onSelect={selectMuscle}
            framing={1.08} structureColors={structureColors} viewRequest={viewRequest} explorationRequest={exploration} showIndicators indicatorFilter={indicatorFilter}
            colorScale={colorScale} indicatorText={indicatorText}/>
        </div></div>
        <div className="ov-body-tools">
          <ul className="glass-sm ov-legend" aria-label="Colour scale">
            {levels.map(l => <li key={l.level}><i style={{ background: LEVEL_COLORS[l.level] }}/>{l.label}</li>)}
          </ul>
          <div className="glass-sm ov-rotate">
            <span><Icon name="rotate" size={14}/>Drag to rotate</span>
            <div className="seg" role="group" aria-label="Model orientation">{['front', 'back'].map(direction =>
              <button type="button" key={direction} aria-pressed={viewRequest.direction === direction}
                onClick={() => setViewRequest(previous => ({ direction, request: previous.request + 1 }))}>
                {direction === 'front' ? 'Front' : 'Back'}
              </button>)}</div>
          </div>
        </div>
      </section>

      <div className="ov-right">
        <section className="glass ov-status" aria-labelledby="status-title">
          <div className="ov-status-top">
            <h2 id="status-title" className="eyebrow">Mission status</h2>
            <span className="chip" data-tone={status.chip}>{chipText}</span>
          </div>
          <p className="ov-status-lead">{statusLead(status, alerts, data.crew?.id, Boolean(vitals))}</p>
          <p className="ov-status-detail">{detail}</p>
          {alerts.length > 0 && <ul className="ov-alerts">
            {alerts.map(a => <li key={a.id} className="ov-alert" data-tone={a.severity === 'critical' ? 'crit' : 'warn'}>
              <button type="button" className="ov-alert-body" onClick={() => onOpen(a.tab, a.focus)} aria-label={`${a.system}: ${a.message}. ${ACTION[a.tab] ?? 'Details'}`}>
                <span className="ov-alert-icon">{a.tab === 'vitales' ? <Icon name="pulse" size={18}/> : <AlertIcon/>}</span>
                <span className="ov-alert-copy"><strong>{a.system}</strong><span>{a.message}</span><small>{SEVERITY_TEXT[a.severity] ?? 'Check needed'}</small></span>
                <span className="ov-alert-arrow" aria-hidden="true">→</span>
              </button>
            </li>)}
          </ul>}
          {alerts.length > 0 && !exampleMode && <button type="button" className="btn-link ov-alert-plan" onClick={() => onOpen('plan')}>View mission plan <span aria-hidden="true">→</span></button>}
        </section>
        {!exampleMode && <div className="ov-wearable"><WatchPanel vitals={vitals} error={vitalsError} compact onOpen={() => onOpen('vitales')}/></div>}
      </div>
    </div>

    <section className="glass ov-schedule" aria-labelledby="schedule-title">
      <header className="ov-schedule-head">
        <div><h2 id="schedule-title">Mission schedule</h2><span>{exampleMode ? 'Needs the Planner' : 'Today and the next 6 days'}</span></div>
        <button type="button" className="btn-link" onClick={() => onOpen('plan')}>Open the mission plan <span aria-hidden="true">→</span></button>
      </header>
      {tasks.length ? <div className="ov-timeline-box">
        <div className="ov-timeline ov-timeline-head" aria-hidden="true">
          <span>Task</span>
          {days.map(d => <span key={d.day} data-today={d.today || undefined}>{d.label}{d.today ? ' · Today' : ''}</span>)}
        </div>
        <ol className="ov-timeline-rows">
          {tasks.map(row => {
            const { item: i, start, span } = row;
            const kind = KIND[i.type] ?? 'routine';
            const title = plainTitle(i);
            const note = noteOf(row);
            const when = span > 1 ? `${days[start].label} to ${days[start + span - 1].label}` : days[start].label;
            return <li key={i.id}><button type="button" className="ov-timeline" data-status={displayStatus(i, missionToday)} onClick={() => onOpen('plan')}
              aria-label={`${TYPE_LABEL[i.type] ?? i.type}: ${title}. ${note}. ${when}. Open the mission plan`}>
              <span className="ov-today-col" aria-hidden="true"/>
              <span className="ov-task"><span className="ov-kind" data-kind={kind}>{TYPE_LABEL[i.type] ?? i.type}</span><span className="ov-task-title">{title}</span></span>
              <span className="ov-span" data-kind={kind} title={note} style={{ gridColumn: `${start + 2} / span ${span}` }}>{note}</span>
            </button></li>;
          })}
        </ol>
      </div> : <p className="ov-empty">{exampleMode ? 'Start the Planner to see the routine.' : today ? 'Nothing due in the next 7 days.' : planError ? 'Planner unavailable. Reconnecting…' : 'Loading…'}</p>}
    </section>

    <footer className="ov-foot">
      <p>{data.notice}</p>
      <details className="ov-credits"><summary>Body model &amp; colour key</summary>
        <p>The colour scale applies to tested muscles. The heart, lungs and vessels are shown for anatomical reference.</p>
        <p><a href="https://github.com/MervinR07/open-anatomy-3d">Open Anatomy 3D</a> · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. {ATTRIBUTION} Surface regions and materials adapted for this viewer.</p>
      </details>
    </footer>
  </div>;
}
