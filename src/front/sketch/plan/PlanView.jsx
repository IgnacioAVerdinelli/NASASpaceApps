import React, { useEffect, useMemo, useState } from 'react';
import { useDashboard } from '../data/useDashboard.js';
import {
  STATUS_LABEL, TYPE_LABEL, byRoutine, counts, displayStatus, loadPlan, loadRoutine, phaseOf, planUrl, postStatus,
  timing, upcoming, windowText,
} from '../data/plan.js';
import './style.css';

const VIEWS = [
  { id: 'next', label: 'Next 7 days' },
  { id: 'mission', label: 'Whole mission' },
  { id: 'missed', label: 'Missed' },
];
const routineCache = new Map();

function Status({ item, today }) {
  const s = displayStatus(item, today);
  return <span className="plan-status" data-status={s}>{STATUS_LABEL[s]}</span>;
}

function FlightTrack({ items, today, landing, selectedId, onSelect }) {
  const marks = items.filter(i => ['study', 'retest', 'review'].includes(i.type) && i.window.day_to > 0 && i.window.day_from < landing);
  const pos = d => `${Math.min(100, Math.max(0, (d / landing) * 100))}%`;
  const inFlight = today >= 0 && today <= landing;
  return <figure className="flight-track" aria-label="Studies across the flight">
    <figcaption><span>Launch</span><span>Studies across the flight</span><span>Landing · day {landing}</span></figcaption>
    <div className="track">
      <div className="track-elapsed" style={{ width: pos(Math.max(0, today)) }}/>
      {marks.map(i => <button key={i.id} type="button" className="track-mark" data-status={displayStatus(i, today)} data-type={i.type}
        aria-pressed={selectedId === i.id} style={{ left: pos((i.window.day_from + i.window.day_to) / 2) }}
        title={`${i.title} · ${i.window.label} · ${STATUS_LABEL[displayStatus(i, today)]}`} aria-label={`${i.title}, ${i.window.label}, ${STATUS_LABEL[displayStatus(i, today)]}`}
        onClick={() => onSelect(i.id)}/>)}
      {inFlight && <div className="track-today" style={{ left: pos(today) }}><span>Today</span></div>}
    </div>
  </figure>;
}

function ItemRow({ item, today, more, selected, onSelect }) {
  return <button type="button" className="plan-row" aria-pressed={selected} onClick={() => onSelect(item.id)}>
    <span className="plan-row-kind">{TYPE_LABEL[item.type]} · {item.window.label}</span>
    <strong>{item.title}{more > 0 && <small> +{more} more this week</small>}</strong>
    <span className="plan-row-meta">{timing(item, today)} · {windowText(item)}</span>
    <Status item={item} today={today}/>
  </button>;
}

function RoutineRow({ group, today, selectedId, onSelect }) {
  const many = group.items.length > 14;
  const tally = group.items.reduce((t, i) => ({ ...t, [displayStatus(i, today)]: (t[displayStatus(i, today)] || 0) + 1 }), {});
  return <div className="routine-row">
    <div className="routine-row-head"><strong>{group.title}</strong><span>{group.key === 'findings' ? 'From findings' : `[${group.key}]`}</span></div>
    {many
      ? <p className="routine-tally">{group.items.length} occurrences · {Object.entries(tally).map(([s, n]) => `${n} ${STATUS_LABEL[s].toLowerCase()}`).join(' · ')}
          <button type="button" onClick={() => onSelect((group.items.find(i => i.status === 'booked') || group.items.at(-1)).id)}>Next one</button></p>
      : <div className="routine-chips">{group.items.map(i => <button key={i.id} type="button" className="routine-chip" data-status={displayStatus(i, today)} aria-pressed={selectedId === i.id} onClick={() => onSelect(i.id)} title={`${windowText(i)} · ${STATUS_LABEL[displayStatus(i, today)]}`}>{i.window.label}</button>)}</div>}
  </div>;
}

function Detail({ item, today, crew, onChanged }) {
  const [routine, setRoutine] = useState(() => routineCache.get(item.routine_id) || null);
  const [note, setNote] = useState('');
  const [state, setState] = useState({ busy: false, error: null, done: null });
  useEffect(() => {
    setNote(''); setState({ busy: false, error: null, done: null });
    if (!item.routine_id) { setRoutine(null); return; }
    if (routineCache.has(item.routine_id)) { setRoutine(routineCache.get(item.routine_id)); return; }
    let live = true;
    loadRoutine(item.routine_id).then(r => { routineCache.set(item.routine_id, r); if (live) setRoutine(r); }).catch(() => live && setRoutine(null));
    return () => { live = false; };
  }, [item.id, item.routine_id]);

  const change = async status => {
    setState({ busy: true, error: null, done: null });
    try {
      const updated = await postStatus({ id: item.id, crew, status, by: crew, note });
      setState({ busy: false, error: null, done: status });
      onChanged(updated);
    } catch (error) {
      setState({ busy: false, error: error.message, done: null });
    }
  };
  const canClose = item.status === 'booked' || item.status === 'missed';
  const auto = item.completion === 'auto';

  return <article className="plan-detail" aria-labelledby="plan-detail-title">
    <div className="plan-detail-head">
      <div>
        <span className="plan-detail-kind">{TYPE_LABEL[item.type]} · {item.window.label}{item.ref && ` · ${item.ref}`}</span>
        <h3 id="plan-detail-title">{item.title}</h3>
        <p>{timing(item, today)} · {windowText(item)} · {item.window.from.slice(0, 10)} to {item.window.to.slice(0, 10)}</p>
      </div>
      <Status item={item} today={today}/>
    </div>

    {item.reason === 'finding' && item.finding && <div className="plan-why plan-why-finding">
      <span className="step-label">Why it was booked</span>
      <p>HealthService {item.finding.state || 'suspected'} finding on <b>{item.finding.measure}</b>
        {typeof item.finding.change_pct === 'number' && <> ({item.finding.change_pct > 0 ? '+' : ''}{item.finding.change_pct.toFixed(1)}% since pre-flight)</>} on day {Math.round(item.finding.mission_day)}.
        {item.finding.why ? ` A review instead of a retest: ${item.finding.why}.` : ' A retest confirms or clears it.'}</p>
    </div>}

    {routine && <>
      <div className="plan-facts">
        <div><span>Performed by</span><strong>{routine.performed_by}</strong></div>
        {routine.duration_min > 0 && <div><span>Takes about</span><strong>{routine.duration_min} min</strong></div>}
        <div><span>Equipment</span><strong>{routine.equipment.join(', ')}</strong></div>
        {routine.iss_hardware?.length > 0 && <div><span>On the ISS</span><strong>{routine.iss_hardware.join(', ')}</strong></div>}
      </div>
      <h4 className="pathway-title">How to do it</h4>
      <ol className="plan-steps">{routine.steps.map(s => <li key={s}>{s}</li>)}</ol>
      <p className="plan-guide">{routine.guide.how}</p>
      <div className="plan-why"><span className="step-label">If something looks abnormal</span><p>{routine.guide.if_abnormal}</p></div>
      <details className="plan-source">
        <summary>What the NASA standard says</summary>
        <blockquote>“{routine.requirement}” <cite>OCHMO-STD-100.1A [{routine.id}], p. {routine.requirement_page}</cite></blockquote>
        <blockquote>“{routine.schedule_text}” <cite>p. {routine.schedule_page}</cite></blockquote>
        {routine.assumptions?.length > 0 && <p>Our assumptions: {routine.assumptions.join('; ')}.</p>}
      </details>
    </>}

    <div className="plan-actions">
      {auto && item.status === 'booked'
        ? <p>Closes by itself when the {item.instrument} readings arrive{item.measure ? ` (${item.measure})` : ''}.</p>
        : item.status === 'done'
          ? <p>Done{item.done_by ? ` by ${item.done_by === 'instrument' ? 'the instrument' : item.done_by}` : ''}{item.done_at ? ` on ${item.done_at.slice(0, 10)}` : ''}{item.completion === 'simulated' ? ' (simulated crew)' : ''}{item.note ? ` · “${item.note}”` : ''}.</p>
          : null}
      {canClose && !auto && <>
        <label>Note <input type="text" value={note} maxLength={200} placeholder="Optional" onChange={e => setNote(e.target.value)}/></label>
        <div className="plan-buttons">
          <button type="button" disabled={state.busy} onClick={() => change('done')}>Mark as done</button>
          {item.status === 'booked' && <button type="button" className="secondary" disabled={state.busy} onClick={() => change('missed')}>Mark as missed</button>}
        </div>
      </>}
      {state.error && <p className="plan-error" role="alert">{state.error}</p>}
      {state.done && <p className="plan-ok" role="status">Saved as {state.done}.</p>}
    </div>
  </article>;
}

export function PlanView({ crew }) {
  const [view, setView] = useState('next');
  const [selectedId, setSelectedId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const { data, error } = useDashboard(crew ? planUrl(crew) : null, loadPlan);
  useEffect(() => { setSelectedId(null); setOverrides({}); }, [crew]);

  const items = useMemo(() => (data?.items || []).map(i => overrides[i.id] && overrides[i.id].status !== i.status && i.status === 'booked' ? { ...i, ...overrides[i.id] } : i), [data, overrides]);
  if (!crew) return null;
  if (!data) return <div className="connection-notice" role={error ? 'alert' : 'status'}>{error ? 'Unable to reach the Planner (port 3001). Retrying automatically…' : 'Loading the plan…'}</div>;

  const today = data.mission.today, landing = data.mission.landing;
  const c = counts(items, today);
  const next = upcoming(items, today);
  const missed = items.filter(i => i.status === 'missed').sort((a, b) => b.window.day_to - a.window.day_to);
  const shown = view === 'next' ? next.map(r => r.item) : view === 'missed' ? missed : items;
  const selected = items.find(i => i.id === selectedId) || shown[0] || items.find(i => i.status === 'booked') || items[0];
  const phases = ['Pre-flight', 'In flight', 'Post-flight'];

  return <section className="plan" aria-labelledby="plan-title">
    {error && <div className="connection-notice" role="status">Planner connection lost. Showing the last plan.</div>}
    <div className="recommendations-header">
      <div><h2 id="plan-title">Mission plan</h2>
        <p>What {crew} has to do and when, following NASA's mission medical standard ({data.source.document}, {data.source.revision}).</p></div>
      <span className="demo-label">EXAMPLE SCHEDULE · {data.source.profile.toUpperCase().replace('_', ' ')}</span>
    </div>

    <dl className="plan-counts">
      <div data-tone="open"><dt>Open now</dt><dd>{c.open}</dd></div>
      <div><dt>Opening this week</dt><dd>{c.soon}</dd></div>
      <div data-tone="done"><dt>Done</dt><dd>{c.done}</dd></div>
      <div data-tone="missed"><dt>Missed</dt><dd>{c.missed}</dd></div>
    </dl>

    <FlightTrack items={items} today={today} landing={landing} selectedId={selected?.id} onSelect={setSelectedId}/>

    <div className="plan-switch" role="radiogroup" aria-label="Plan view">
      {VIEWS.map(v => <button key={v.id} type="button" role="radio" aria-checked={view === v.id} onClick={() => { setView(v.id); setSelectedId(null); }}>
        {v.label}{v.id === 'missed' && c.missed > 0 && <span className="plan-switch-count">{c.missed}</span>}</button>)}
    </div>

    <div className="decision-layout plan-layout">
      <div className="plan-list" aria-label={VIEWS.find(v => v.id === view).label}>
        {view === 'next' && (next.length ? next.map(({ item, more }) => <ItemRow key={item.id} item={item} today={today} more={more} selected={selected?.id === item.id} onSelect={setSelectedId}/>)
          : <p className="decision-empty">Nothing due in the next 7 days.</p>)}
        {view === 'missed' && (missed.length ? missed.map(item => <ItemRow key={item.id} item={item} today={today} more={0} selected={selected?.id === item.id} onSelect={setSelectedId}/>)
          : <p className="decision-empty">Nothing missed so far.</p>)}
        {view === 'mission' && phases.map(phase => {
          const groups = byRoutine(items.filter(i => phaseOf(i, landing) === phase));
          return groups.length > 0 && <div key={phase} className="plan-phase"><h3>{phase}</h3>{groups.map(g => <RoutineRow key={g.key} group={g} today={today} selectedId={selected?.id} onSelect={setSelectedId}/>)}</div>;
        })}
      </div>
      {selected && <Detail key={selected.id} item={selected} today={today} crew={crew} onChanged={updated => setOverrides(o => ({ ...o, [updated.id]: updated }))}/>}
    </div>
    <p className="recommendations-note">{data.source.note} Status changes are saved by the Planner.</p>
  </section>;
}
