import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Backdrop } from '../vuelo/Backdrop.jsx';
import { Brand, Icon } from '../vuelo/Icons.jsx';
import { loadCrew } from '../data/dashboard.js';
import { useDashboard } from '../data/useDashboard.js';
import { loadSummaries, lookFor, summariesKey } from './data.js';
import { MISSION, person } from '../data/roster.js';
import { CrewScene } from './scene.js';
import './style.css';

const exampleMode = import.meta.env.VITE_DASHBOARD_MODE === 'example';
const apiUrl = import.meta.env.VITE_DASHBOARD_URL || '/api/v1/dashboard';
const view = 'lineup';
const overviewHref = id => `./vuelo.html?crew=${encodeURIComponent(id)}#summary`;
const RANK = { crit: 0, warn: 1, ok: 2 };
const labelSizes = new WeakMap();


function Chip({ summary }) {
  if (!summary?.hasData) return <span className="chip">No readings yet</span>;
  return <span className="chip" data-tone={summary.status.chip}>{summary.status.title}</span>;
}

// A number that counts from its previous value to the new one; text that is not a plain number just swaps.
const NUMBER = /^([−+-]?)(\d+(?:\.\d+)?)(%?)$/;
function Num({ value }) {
  const text = value ?? '—';
  const [shown, setShown] = useState(text);
  const from = useRef(null);
  useEffect(() => {
    const m = NUMBER.exec(text);
    const start = from.current ?? 0;      // a card that just appeared counts up from zero
    from.current = m ? (m[1] && m[1] !== '+' ? -1 : 1) * Number(m[2]) : null;
    if (!m || start === from.current) { setShown(text); return; }
    const end = from.current, decimals = (m[2].split('.')[1] || '').length, t0 = performance.now();
    let raf;
    const tick = now => {
      const k = Math.min(1, (now - t0) / 650), e = 1 - Math.pow(1 - k, 3);
      const v = start + (end - start) * e;
      setShown(k < 1 ? `${v < 0 ? '−' : m[1] === '+' ? '+' : ''}${Math.abs(v).toFixed(decimals)}${m[3]}` : text);
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <span className="num">{shown}</span>;
}

function Stats({ s, compact = false }) {
  return <dl className={'crew-stats' + (compact ? ' is-compact' : '')}>
    <div><dt>VO₂peak</dt><dd><Num value={s.vo2?.value}/>{!compact && <small>ml/kg/min</small>}</dd></div>
    <div><dt>Largest loss</dt><dd><Num value={s.strength?.value}/>{!compact && s.strength && <small>{s.strength.group}</small>}</dd></div>
    <div><dt>Resting HR</dt><dd><Num value={s.rhr?.value}/>{!compact && <small>bpm</small>}</dd></div>
  </dl>;
}

function Vitals({ list }) {
  if (!list?.length) return null;
  return <ul className="crew-vitals" aria-label="Vitals from the watch">
    {list.map((v, i) => <li key={v.id} data-tone={v.tone || undefined} title={v.text} style={{ '--i': i }}>
      <span>{v.label}</span>
      <strong><Num value={v.value}/><small>{v.unit}</small>{v.dir && <i aria-label={v.dir === 'up' ? 'above usual' : 'below usual'}>{v.dir === 'up' ? '↑' : '↓'}</i>}</strong>
    </li>)}
  </ul>;
}

function Avatar({ look, who }) {
  if (who?.photo) return <img className="crew-avatar crew-photo" src={who.photo} alt=""/>;
  return <span className="crew-avatar" aria-hidden="true" style={{ '--skin': look.skin, '--hair': look.hair }}><i/></span>;
}

export function CrewApp() {
  // Animations are always on: the crew select is meant to be seen moving.
  const reducedMotion = false;
  const [selected, setSelected] = useState(() => new URLSearchParams(window.location.search).get('crew'));
  const [hovered, setHovered] = useState(null);
  const [sceneState, setSceneState] = useState('loading');
  const stageRef = useRef(null);
  const sceneRef = useRef(null);
  const labelRefs = useRef({});
  const openRef = useRef(() => {});
  const currentIdRef = useRef(null);

  const crewState = useDashboard(exampleMode ? null : apiUrl, loadCrew);
  const ids = crewState.data || [];
  const summaryState = useDashboard(ids.length ? summariesKey(apiUrl, ids) : null, loadSummaries);
  const summaries = summaryState.data;
  const crew = useMemo(() => (summaries || []).map((s, i) => ({ ...s, who: person(s.id), look: lookFor(i, s.body, s.id) })), [summaries]);
  const crewKey = crew.map(c => `${c.id}:${c.look.body}`).join(',');
  const current = crew.find(c => c.id === selected)
    || [...crew].filter(c => c.hasData).sort((a, b) => RANK[a.status.chip] - RANK[b.status.chip])[0] || crew[0] || null;
  const counts = crew.reduce((acc, c) => { const k = c.hasData ? c.status.chip : 'none'; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const mission = crew.find(c => c.mission)?.mission;
  currentIdRef.current = current?.id ?? null;
  // Which way the ring turned to reach the current crew member: the card slides in from that side.
  const prevIdRef = useRef(null);
  const dirRef = useRef(0);
  if (current?.id !== prevIdRef.current) {
    const n = crew.length, a = crew.findIndex(c => c.id === prevIdRef.current), b = crew.findIndex(c => c.id === current?.id);
    let d = a < 0 || b < 0 ? 0 : (((b - a) % n) + n) % n;
    if (d > n / 2) d -= n;
    dirRef.current = Math.sign(d);
    prevIdRef.current = current?.id ?? null;
  }
  const stripRef = useRef(null);
  const [pill, setPill] = useState(null);
  useLayoutEffect(() => {
    const el = stripRef.current?.querySelector('.crew-thumb.is-selected');
    if (el) setPill({ x: el.offsetLeft, w: el.offsetWidth });
  }, [current?.id, crew.length]);
  const step = delta => {
    if (!crew.length) return;
    const i = Math.max(0, crew.findIndex(c => c.id === current?.id));
    setSelected(crew[(i + delta + crew.length) % crew.length].id);
  };
  const onStepKey = event => {
    const delta = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    if (!delta) return;
    event.preventDefault();
    step(delta);
  };

  // The scene: created once, fed the crew, the view and the selection.
  useEffect(() => {
    if (!stageRef.current) return;
    let scene;
    try {
      scene = new CrewScene(stageRef.current, {
        reducedMotion,
        onHover: setHovered,
        // A click on the crew member in front opens their overview; on a neighbour, turns the ring to them.
        onPick: id => (id === currentIdRef.current ? openRef.current(id) : setSelected(id)),
        onSpin: id => setSelected(id),
        onFrame: anchors => {
          // Nearest crew member first: their label stays on them; a label that would cover one already placed
          // moves up until it is clear.
          const placed = [];
          [...anchors].sort((a, b) => a.depth - b.depth).forEach((a, order) => {
            const el = labelRefs.current[a.id];
            if (!el) return;
            const size = labelSizes.get(el) || { w: el.offsetWidth, h: el.offsetHeight };
            labelSizes.set(el, size);
            let bottom = a.y;
            for (let guard = 0; guard < 8; guard++) {
              const hit = placed.find(p => Math.abs(p.x - a.x) < (p.w + size.w) / 2 + 6 && bottom > p.top - 4 && bottom - size.h < p.bottom + 4);
              if (!hit) break;
              bottom = hit.top - 6;
            }
            bottom = Math.max(bottom, size.h + 8);
            placed.push({ x: a.x, w: size.w, top: bottom - size.h, bottom });
            el.style.transform = `translate3d(${a.x.toFixed(1)}px, ${bottom.toFixed(1)}px, 0) translate(-50%, -100%)`;
            el.style.opacity = a.visible ? '' : '0';
            el.style.zIndex = String(anchors.length - order);
          });
        },
      });
    } catch {
      setSceneState('error');
      return;
    }
    sceneRef.current = scene;
    if (import.meta.env.DEV) window.__crewScene = scene;
    return () => { scene.dispose(); sceneRef.current = null; };
  }, []);

  useEffect(() => { sceneRef.current?.setReducedMotion(reducedMotion); }, [reducedMotion]);

  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || !crew.length) return;
    let active = true;
    setSceneState('loading');
    scene.setCrew(crew.map(c => ({ id: c.id, look: c.look })))
      .then(() => { if (active) { setSceneState('ready'); scene.setView(view); scene.setSelected(current?.id); } })
      .catch(() => { if (active) setSceneState('error'); });
    return () => { active = false; };
  }, [crewKey]);

  useEffect(() => { sceneRef.current?.setSelected(current?.id ?? null); }, [current?.id]);

  // Keep the view and the chosen crew member in the URL, as the flight pages do (?crew=, #tab).
  useEffect(() => {
    const url = new URL(window.location.href);
    if (current?.id) url.searchParams.set('crew', current.id);
    url.hash = '';
    window.history.replaceState(null, '', url);
  }, [current?.id]);

  const open = useCallback(id => {
    setSelected(id);
    const go = () => { window.location.href = overviewHref(id); };
    // The page steps back and the overview opens; the camera stays where it is.
    document.body.classList.add('crew-leaving');
    setTimeout(go, 380);
  }, []);
  openRef.current = open;

  const loadError = crewState.error || summaryState.error;
  const loading = !summaries && !loadError;

  return <div className={`vuelo crew-page is-${view}`}>
    <Backdrop/>
    <a className="flight-skip" href="#crew-roster">Skip to the crew list</a>
    <header className="flight-bar glass-bar">
      <div className="flight-bar-inner">
        <a className="flight-home" href="./crew.html" aria-label="GraviTal crew"><Brand/></a>
        {mission && <div className="flight-context"><Icon name="orbit" size={22}/><span>{MISSION.name.toUpperCase()}</span><i/><Icon name="plan" size={16}/><span>{mission.todayLabel} <small>/ {mission.landing} days</small></span></div>}
      </div>
    </header>

    <main className="flight-content crew-content">
      <div className="flight-heading">
        <div className="flight-heading-main">
          <h1>Crew aboard</h1>
          {summaries && <span className="flight-source glass-sm"><i/>Simulation</span>}
        </div>
        {crew.length > 0 && <div className="crew-counts" aria-label="Crew status">
          {counts.crit > 0 && <span className="chip" data-tone="crit">{counts.crit} action needed</span>}
          {counts.warn > 0 && <span className="chip" data-tone="warn">{counts.warn} check needed</span>}
          {counts.ok > 0 && <span className="chip" data-tone="ok">{counts.ok} no alerts</span>}
          {counts.none > 0 && <span className="chip">{counts.none} no readings</span>}
        </div>}
      </div>

      {exampleMode && <div className="flight-notice glass" role="status">The crew view needs the HealthService; it is not available with example data. <a href="./vuelo.html">Open the example overview</a></div>}
      {loadError && summaries && <div className="flight-notice glass" role="status">Connection lost. Showing the last available data.</div>}

      <div className="crew-layout is-split" onKeyDown={onStepKey}>
        <div className="crew-left">
          <section className="crew-stage" aria-label={view === 'module' ? 'The crew in the station module (illustration)' : 'The crew side by side (illustration)'}>
            <div className={'crew-canvas' + (sceneState === 'ready' ? ' is-ready' : '')} ref={stageRef}/>
            {crew.length > 1 && <>
              <button type="button" className="crew-turn is-prev glass-sm" aria-label="Previous crew member" onClick={() => step(-1)}><span aria-hidden="true">‹</span></button>
              <button type="button" className="crew-turn is-next glass-sm" aria-label="Next crew member" onClick={() => step(1)}><span aria-hidden="true">›</span></button>
            </>}
            <div className="crew-labels">
              {crew.map(c => <button key={c.id} type="button" ref={el => { labelRefs.current[c.id] = el; }}
                className={'crew-label glass-sm' + (c.id === current?.id ? ' is-selected' : '') + (c.id === hovered ? ' is-hover' : '')}
                aria-pressed={c.id === current?.id} aria-label={`${c.who.name}, ${c.hasData ? c.status.title : 'no readings yet'}. Show summary`}
                tabIndex={view === 'module' ? 0 : -1}
                onClick={() => setSelected(c.id)} onDoubleClick={() => open(c.id)}>
                <strong>{c.who.name}</strong><Chip summary={c}/>
              </button>)}
            </div>
            {view === 'module' && <div className="crew-stage-note glass-sm"><span className="eyebrow">Module view</span><span>An illustration of the crew aboard. Positions are not tracked.</span></div>}
            {(loading || sceneState === 'loading') && !loadError && <div className="crew-stage-status glass-sm" role="status"><span className="crew-spinner" aria-hidden="true"/>Loading the crew…</div>}
            {loadError && !summaries && <div className="crew-stage-status glass-sm is-error" role="alert"><strong>Unable to reach the HealthService.</strong> Retrying automatically…</div>}
            {sceneState === 'error' && <div className="crew-stage-status glass-sm" role="status">3D is not available in this browser. The crew list below has everything.</div>}
          </section>

          <div id="crew-roster" tabIndex={-1} className="crew-strip glass-sm" role="group" aria-label="Choose a crew member" ref={stripRef}>
            {pill && <span className="crew-strip-pill" aria-hidden="true" style={{ transform: `translateX(${pill.x}px)`, width: pill.w }}/>}
            {loading && Array.from({ length: 7 }, (_, i) => <span key={i} className="crew-thumb is-skeleton" aria-hidden="true"/>)}
            {crew.map(c => {
              const on = c.id === current?.id;
              return <button key={c.id} type="button" className={'crew-thumb' + (on ? ' is-selected' : '')} aria-pressed={on}
                aria-label={`${c.who.name}, ${c.hasData ? c.status.title : 'no readings yet'}`} onClick={() => setSelected(c.id)}
                onMouseEnter={() => setHovered(c.id)} onMouseLeave={() => setHovered(null)}>
                <Avatar look={c.look} who={c.who}/>
                {c.hasData && <i className="crew-thumb-dot" data-tone={c.status.chip} aria-hidden="true"/>}
                <span>{c.who.name.split(' ').slice(-1)[0]}</span>
              </button>;
            })}
          </div>
        </div>
        {current && <article key={current.id} className="crew-feature glass" data-dir={dirRef.current} aria-live="polite" aria-label={`${current.who.name}, selected`}>
          <header className="crew-feature-head">
            <Avatar look={current.look} who={current.who}/>
            <div>
              <h2>{current.who.name}</h2>
              <p>{current.who.role}{current.who.agency && <> · {current.who.agency}</>}</p>
            </div>
          </header>
          <div className="crew-feature-status">
            <Chip summary={current}/>
            {current.alert
              ? <strong data-tone={current.status.chip}>{current.alert.title}</strong>
              : <span>{current.hasData ? 'Nothing needs action now.' : 'No measurements yet.'}</span>}
          </div>
          <Stats s={current}/>
          <Vitals list={(current.vitals || []).slice(0, 3)}/>
          {current.next && <div className="crew-next"><Icon name="plan"/><div><span>Next · {current.next.when}</span><strong>{current.next.title}</strong></div></div>}
          <div className="crew-actions">
            <a className="btn-primary" href={overviewHref(current.id)} onClick={event => { event.preventDefault(); open(current.id); }}>Open health overview <span aria-hidden="true">→</span></a>
            <a className="btn-link" href={`./vuelo.html?crew=${encodeURIComponent(current.id)}#plan`}>Mission plan</a>
          </div>
        </article>}
      </div>

      <p className="crew-footnote">Synthetic data, built on NASA bed-rest studies (reference curves 0.2.0). Not a health assessment. Names, roles and portraits are the ISS Expedition 75 crew (November 2026), used only as an example: none of the health data is theirs. Portraits: NASA, public domain. 3D figures are illustrations on the open-anatomy-3d bodies (BodyParts3D © DBCLS, CC BY 4.0; MakeHuman, CC0).</p>
    </main>
  </div>;
}
