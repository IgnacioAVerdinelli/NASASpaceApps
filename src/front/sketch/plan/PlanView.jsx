import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDashboard } from '../data/useDashboard.js';
import {
  INSTRUMENT_LABEL, STATUS_LABEL, TYPE_LABEL, byRoutine, counts, displayStatus, firstToDo, labelText, loadPlan, loadRoutine,
  measureLabel, phaseOf, plainTitle, planUrl, postStatus, shortDay, timing, upcoming, windowText,
} from '../data/plan.js';
import './style.css';

const VIEWS = [
  { id: 'next', label: 'Now and next 7 days' },
  { id: 'mission', label: 'Whole mission' },
  { id: 'missed', label: 'Missed' },
];
const routineCache = new Map();
const DATE = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const date = iso => DATE.format(new Date(iso));
const sentence = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

function Status({ item, today }) {
  const s = displayStatus(item, today);
  return <span className="plan-status" data-status={s}>{STATUS_LABEL[s]}</span>;
}

function Tag({ item }) {
  return <span className="plan-tag" data-type={item.type}>{TYPE_LABEL[item.type]}{item.completion === 'auto' && item.status === 'booked' ? ' · automatic' : ''}</span>;
}

// Now at a glance: what is open, what opens this week, anything missed, and where the flight is.
function NowBand({ c, mission, items, selectedId, onSelect }) {
  const toLanding = Math.max(0, Math.ceil(mission.landing - mission.today));
  return <div className="plan-now" data-missed={c.missed > 0 || undefined}>
    <dl className="plan-counts">
      <div data-tone="open"><dt>To do now</dt><dd>{c.open}</dd></div>
      <div><dt>Opening this week</dt><dd>{c.soon}</dd></div>
      <div data-tone={c.missed ? 'missed' : 'ok'}><dt>Missed</dt><dd>{c.missed}</dd></div>
      <div data-tone="done"><dt>Done so far</dt><dd>{c.done}</dd></div>
    </dl>
    <div className="plan-flight">
      <p className="plan-clock"><strong>{mission.todayLabel?.replace(/^FD/, 'Flight day ') ?? `Day ${Math.floor(mission.today)}`}</strong>
        <span>of {mission.landing} · {toLanding} days to landing</span></p>
      <FlightTrack items={items} today={mission.today} landing={mission.landing} selectedId={selectedId} onSelect={onSelect}/>
    </div>
  </div>;
}

function FlightTrack({ items, today, landing, selectedId, onSelect }) {
  const marks = items.filter(i => ['study', 'retest', 'review'].includes(i.type) && i.window.day_to > 0 && i.window.day_from < landing);
  const pos = d => `${Math.min(100, Math.max(0, (d / landing) * 100))}%`;
  const inFlight = today >= 0 && today <= landing;
  const tip = i => `${plainTitle(i)} · ${shortDay(i, landing)} · ${STATUS_LABEL[displayStatus(i, today)]}`;
  return <figure className="flight-track" aria-label="Tests across the flight">
    <div className="track">
      <div className="track-elapsed" style={{ width: pos(Math.max(0, today)) }}/>
      {marks.map(i => <button key={i.id} type="button" className="track-mark" data-status={displayStatus(i, today)} data-type={i.type}
        aria-pressed={selectedId === i.id} style={{ left: pos((i.window.day_from + i.window.day_to) / 2) }}
        title={tip(i)} aria-label={tip(i)} onClick={() => onSelect(i.id)}/>)}
      {inFlight && <div className="track-today" style={{ left: pos(today) }}/>}
    </div>
    <figcaption>
      <span>Launch</span>
      <span className="track-legend" aria-hidden="true"><i data-k="done"/>Done <i data-k="open"/>Open <i data-k="booked"/>Coming <i data-k="retest"/>Retest or review</span>
      <span>Landing</span>
    </figcaption>
  </figure>;
}

function ItemRow({ item, today, more, selected, onSelect, showStatus = false }) {
  return <button type="button" className="plan-row" aria-pressed={selected} onClick={() => onSelect(item.id)}>
    <strong>{plainTitle(item)}</strong>
    <span className="plan-row-when">{timing(item, today).replace(/^Open now · c/, 'C')}{more > 0 && <> · <b>+{more} more this week</b></>}</span>
    <span className="plan-row-meta"><Tag item={item}/>{showStatus && <Status item={item} today={today}/>}</span>
  </button>;
}

function RoutineRow({ group, today, landing, selectedId, onSelect }) {
  const many = group.items.length > 14;
  const done = group.items.filter(i => i.status === 'done').length;
  const next = group.items.find(i => i.status === 'booked');
  return <div className="routine-row" data-selected={group.items.some(i => i.id === selectedId) || undefined}>
    <div className="routine-row-head"><strong>{group.key === 'findings' ? 'Retests and reviews' : plainTitle(group.items[0])}</strong>
      <span>{done} of {group.items.length} done</span></div>
    {group.key === 'findings' && <p className="routine-note">Booked from your results</p>}
    {many
      ? <p className="routine-tally">{group.items.length} times across the flight{next ? ` · next: ${timing(next, today).toLowerCase()}` : ''}
          <button type="button" onClick={() => onSelect((next || group.items.at(-1)).id)}>{next ? 'Show the next one' : 'Show the last one'}</button></p>
      : <div className="routine-chips">{group.items.map(i => <button key={i.id} type="button" className="routine-chip" data-status={displayStatus(i, today)}
          aria-pressed={selectedId === i.id} onClick={() => onSelect(i.id)}
          aria-label={`${plainTitle(i)}, ${shortDay(i, landing)}, ${STATUS_LABEL[displayStatus(i, today)]}`} title={`${windowText(i)} · ${STATUS_LABEL[displayStatus(i, today)]}`}>
          {group.key === 'findings' ? `${TYPE_LABEL[i.type]} · ${shortDay(i, landing)}` : shortDay(i, landing)}</button>)}</div>}
  </div>;
}

function WhyBooked({ item }) {
  const f = item.finding;
  const pct = typeof f.change_pct === 'number' ? `${Math.abs(f.change_pct).toFixed(1)}% ${f.change_pct < 0 ? 'below' : 'above'} pre-flight` : 'changed since pre-flight';
  return <div className="plan-callout" data-tone="finding">
    <span className="step-label">Why this was booked</span>
    <p>Your {measureLabel(f.measure)} was {pct} on flight day {Math.floor(f.mission_day) + 1}{f.state === 'confirmed' ? ', confirmed by the HealthService' : ''}.{' '}
      {item.type === 'review'
        ? `A review instead of another test${f.why ? `: ${f.why}` : ''}.`
        : 'This test confirms or clears that result.'}</p>
  </div>;
}

function Steps({ steps }) {
  const [ticked, setTicked] = useState(() => new Set());
  const toggle = i => setTicked(t => { const n = new Set(t); n.has(i) ? n.delete(i) : n.add(i); return n; });
  return <>
    <div className="plan-steps-head"><h3>How to do it</h3><span>{ticked.size} of {steps.length} steps ticked</span></div>
    <ol className="plan-steps">{steps.map((s, i) => <li key={s}><label data-ticked={ticked.has(i) || undefined}>
      <input type="checkbox" checked={ticked.has(i)} onChange={() => toggle(i)}/><span className="step-n">{i + 1}</span><span>{s}</span></label></li>)}</ol>
    <p className="plan-hint">Ticks are a checklist for you only; they are not saved.</p>
  </>;
}

function Source({ item, routine, open = false, title = 'What the NASA standard says' }) {
  return <details className="plan-source" open={open}>
    <summary>{title}</summary>
    <blockquote>“{routine.requirement}” <cite>{item.ref || `OCHMO-STD-100.1A [${routine.id}]`}, p. {routine.requirement_page}</cite></blockquote>
    <blockquote>“{routine.schedule_text}” <cite>p. {routine.schedule_page} · schedule point {item.window.label}</cite></blockquote>
    {routine.assumptions?.length > 0 && <p>Our assumptions: {routine.assumptions.join('; ')}.</p>}
  </details>;
}

function Actions({ item, crew, onChanged }) {
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [state, setState] = useState({ busy: false, error: null, done: null });
  const auto = item.completion === 'auto';
  const canClose = item.status === 'booked' || item.status === 'missed';

  const change = async status => {
    setState({ busy: true, error: null, done: null });
    try {
      const updated = await postStatus({ id: item.id, crew, status, by: crew, note });
      setConfirm(null);
      setState({ busy: false, error: null, done: status });
      onChanged(updated, plainTitle(item));
    } catch (error) {
      setState({ busy: false, error: error.message, done: null });
    }
  };

  const doneBy = item.done_by === 'instrument' ? 'the instrument readings' : item.done_by;
  return <div className="plan-actions">
    {item.status === 'done' && !state.done && <p className="plan-closed">✓ Done{doneBy ? ` · closed by ${doneBy}` : ''}{item.done_at ? ` on ${date(item.done_at)}` : ''}{item.completion === 'simulated' ? ' (simulated crew)' : ''}{item.note ? ` · “${item.note}”` : ''}</p>}
    {item.status === 'cancelled' && <p className="plan-closed">Cancelled: nothing to do.</p>}
    {item.status === 'missed' && <p className="plan-closed" data-tone="missed">The window closed before this was done. If you did it, mark it as done; otherwise tell the flight surgeon at the next conference.</p>}
    {auto && item.status === 'booked' && <p className="plan-closed" data-tone="auto">No need to mark this: it closes by itself when the {INSTRUMENT_LABEL[item.instrument] || 'instrument'} results arrive. Mark it by hand only if the instrument was down and you logged the test another way.</p>}
    {canClose && (confirm
      ? <div className="plan-confirm" role="group" aria-label="Confirm">
          <p><strong>{confirm === 'done' ? `Mark “${plainTitle(item)}” as done?` : `Mark “${plainTitle(item)}” as missed?`}</strong>
            {confirm === 'done' ? ' A done item cannot be reopened.' : ' A missed notice goes to you and the ship center.'}</p>
          <div className="plan-buttons">
            <button type="button" className={confirm === 'missed' ? 'warn' : ''} disabled={state.busy} onClick={() => change(confirm)}>{state.busy ? 'Saving…' : confirm === 'done' ? 'Yes, it is done' : 'Yes, mark as missed'}</button>
            <button type="button" className="secondary" disabled={state.busy} onClick={() => setConfirm(null)}>Go back</button>
          </div>
        </div>
      : <>
          <label><span>Note for the ground <small>(optional)</small></span><input type="text" value={note} maxLength={200} placeholder="e.g. done after breakfast, all normal" onChange={e => setNote(e.target.value)}/></label>
          <div className="plan-buttons">
            <button type="button" className={auto ? 'secondary' : ''} onClick={() => setConfirm('done')}>Mark as done</button>
            {item.status === 'booked' && <button type="button" className="quiet" onClick={() => setConfirm('missed')}>I could not do it</button>}
          </div>
        </>)}
    {state.error && <p className="plan-error" role="alert">Not saved: {state.error}. Try again in a moment.</p>}
  </div>;
}

function Detail({ item, today, crew, onChanged }) {
  const [routine, setRoutine] = useState(() => routineCache.get(item.routine_id) || null);
  const [routineError, setRoutineError] = useState(false);
  useEffect(() => {
    setRoutineError(false);
    if (!item.routine_id) { setRoutine(null); return; }
    if (routineCache.has(item.routine_id)) { setRoutine(routineCache.get(item.routine_id)); return; }
    let live = true;
    loadRoutine(item.routine_id).then(r => { routineCache.set(item.routine_id, r); if (live) setRoutine(r); })
      .catch(() => { if (live) { setRoutine(null); setRoutineError(true); } });
    return () => { live = false; };
  }, [item.id, item.routine_id]);

  const s = displayStatus(item, today);
  const review = item.type === 'review';
  const plain = labelText(item.window.label);
  return <article className="plan-detail" aria-labelledby="plan-detail-title" data-status={s}>
    <header className="plan-detail-head">
      <div>
        <Tag item={item}/>
        <h2 id="plan-detail-title">{plainTitle(item)}</h2>
        <p className="plan-when" data-status={s}>{timing(item, today)}</p>
        <p className="plan-window">Window {date(item.window.from)} to {date(item.window.to)} · NASA schedule: {plain}</p>
      </div>
      <Status item={item} today={today}/>
    </header>

    {item.reason === 'finding' && item.finding && <WhyBooked item={item}/>}

    {routine && <div className="plan-facts">
      <div><span>Who</span><strong>{review ? 'Flight surgeon or crew medical officer, with you' : routine.performed_by}</strong></div>
      {routine.duration_min > 0 && !review && <div><span>Takes about</span><strong>{routine.duration_min} min</strong></div>}
      {!review && <div><span>You need</span><strong>{sentence(routine.equipment.join(', '))}</strong></div>}
      {!review && routine.iss_hardware?.length > 0 && <div><span>On the ISS</span><strong>{routine.iss_hardware.join(', ')}</strong></div>}
    </div>}

    {routine && review && <>
      <div className="plan-callout"><span className="step-label">What happens</span>
        <p>The flight surgeon or the crew medical officer goes over your recent {measureLabel(item.measure)} results with you and decides what comes next. There is no test to do for this item.</p></div>
      <details className="plan-source"><summary>About the {measureLabel(item.measure)} test</summary>
        <p>{routine.guide.how}</p><ol>{routine.steps.map(st => <li key={st}>{st}</li>)}</ol></details>
      <Source item={item} routine={routine}/>
    </>}

    {routine && !review && <>
      {routine.guide.how && <p className="plan-guide"><strong>About it. </strong>{routine.guide.how}</p>}
      <Steps key={item.id} steps={routine.steps}/>
      <div className="plan-callout" data-tone="abnormal"><span className="step-label">If something looks abnormal</span><p>{routine.guide.if_abnormal}</p></div>
      <Source item={item} routine={routine}/>
    </>}
    {!routine && item.routine_id && <p className="plan-hint">{routineError ? 'The instructions could not be loaded. The Planner may be restarting; try this item again in a moment.' : 'Loading the instructions…'}</p>}

    <Actions key={item.id} item={item} crew={crew} onChanged={onChanged}/>
  </article>;
}

export function PlanView({ crew }) {
  const [view, setView] = useState('next');
  const [selectedId, setSelectedId] = useState(null);
  const [overrides, setOverrides] = useState({});
  const [saved, setSaved] = useState(null);
  const listRef = useRef(null);
  const detailRef = useRef(null);
  const { data, error } = useDashboard(crew ? planUrl(crew) : null, loadPlan);
  useEffect(() => { setSelectedId(null); setOverrides({}); setSaved(null); }, [crew]);

  const items = useMemo(() => (data?.items || []).map(i => overrides[i.id] && overrides[i.id].status !== i.status && i.status === 'booked' ? { ...i, ...overrides[i.id] } : i), [data, overrides]);
  const today = data?.mission.today;
  const next = useMemo(() => data ? upcoming(items, today) : [], [items, today, data]);
  const missed = items.filter(i => i.status === 'missed').sort((a, b) => b.window.day_to - a.window.day_to);
  const fallback = view === 'next' ? next[0]?.item : view === 'missed' ? missed[0] : data && firstToDo(items, today);
  const selected = items.find(i => i.id === selectedId) || fallback || (data && view !== 'missed' ? firstToDo(items, today) : null);

  // In the whole-mission view, scroll the list to the selected chip (the current part of the flight), not to pre-flight.
  useEffect(() => {
    if (view !== 'mission' || !listRef.current) return;
    const row = listRef.current.querySelector('.routine-row[data-selected]');
    if (row) listRef.current.scrollTop += row.getBoundingClientRect().top - listRef.current.getBoundingClientRect().top - 36;
  }, [view, crew, !!data]);

  if (!crew) return null;
  if (!data) return <div className="plan plan-state" role={error ? 'alert' : 'status'}>
    {error
      ? <><strong>The mission plan is not available right now.</strong><p>The Planner service is not answering. This page retries by itself; your health data in the other tabs is not affected.</p><small>Planner on port 3001</small></>
      : <><strong>Loading the mission plan…</strong><p>Asking the Planner for {crew}'s schedule.</p></>}
  </div>;

  const c = counts(items, today);
  const open = next.filter(r => displayStatus(r.item, today) === 'open');
  const later = next.filter(r => displayStatus(r.item, today) !== 'open');
  const phases = ['Pre-flight', 'In flight', 'Post-flight'];
  const select = id => {
    setSelectedId(id);
    setSaved(null);
    if (window.matchMedia?.('(max-width: 850px)').matches) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const rows = (list, opts) => list.map(({ item, more }) => <ItemRow key={item.id} item={item} today={today} more={more} selected={selected?.id === item.id} onSelect={select} {...opts}/>);

  return <section className="plan" aria-label="Mission plan">
    {error && <div className="connection-notice" role="status">Planner connection lost. Showing the last plan; changes can't be saved until it is back.</div>}
    <div className="recommendations-header">
      <p>Schedule based on NASA's mission medical standard ({data.source.document}).</p>
      <span className="demo-label">EXAMPLE SCHEDULE · {data.source.profile?.toUpperCase().replace('_', ' ')} · NOT CLINICAL GUIDANCE</span>
    </div>

    <NowBand c={c} mission={data.mission} items={items} selectedId={selected?.id} onSelect={id => { if (view === 'missed') setView('mission'); select(id); }}/>

    <div className="plan-switch" role="group" aria-label="Plan view">
      {VIEWS.map(v => <button key={v.id} type="button" aria-pressed={view === v.id} onClick={() => { setView(v.id); setSelectedId(null); }}>
        {v.label}{v.id === 'missed' && c.missed > 0 && <span className="plan-switch-count">{c.missed}</span>}</button>)}
    </div>

    <div className="decision-layout plan-layout">
      <div className="plan-list" ref={listRef} aria-label={VIEWS.find(v => v.id === view).label}>
        {view === 'next' && <>
          <h2 className="plan-group" data-tone="open">Open now <span>{open.length ? 'do these first' : ''}</span></h2>
          {open.length ? rows(open) : <p className="plan-empty">Nothing is open right now.</p>}
          <h2 className="plan-group">Coming up this week</h2>
          {later.length ? rows(later) : <p className="plan-empty">Nothing else opens in the next 7 days.</p>}
        </>}
        {view === 'missed' && (missed.length ? rows(missed.map(item => ({ item, more: 0 })), { showStatus: true })
          : <div className="plan-empty"><strong>Nothing missed.</strong><p>When a window closes before an item is done, it shows here so you can log it or tell the ground.</p></div>)}
        {view === 'mission' && phases.map(phase => {
          const groups = byRoutine(items.filter(i => phaseOf(i, data.mission.landing) === phase));
          return groups.length > 0 && <div key={phase} className="plan-phase"><h2 className="plan-group">{phase}</h2>{groups.map(g => <RoutineRow key={g.key} group={g} today={today} landing={data.mission.landing} selectedId={selected?.id} onSelect={select}/>)}</div>;
        })}
      </div>
      <div ref={detailRef} className="plan-detail-wrap">
        {saved && <p className="plan-ok" role="status">✓ Saved: “{saved.title}” is {saved.status}.{saved.id !== selected?.id && selected ? ' Here is the next one.' : ''}</p>}
        {selected && <Detail key={selected.id} item={selected} today={today} crew={crew} onChanged={(updated, title) => {
          setOverrides(o => ({ ...o, [updated.id]: updated }));
          setSaved({ id: updated.id, title, status: STATUS_LABEL[updated.status].toLowerCase() });
          requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        }}/>}
      </div>
    </div>
    <p className="recommendations-note">{data.source.note} Status changes are saved by the Planner.</p>
  </section>;
}
