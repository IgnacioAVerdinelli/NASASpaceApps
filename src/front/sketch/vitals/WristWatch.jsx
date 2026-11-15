import React, { useEffect, useRef, useState } from 'react';
import { watchScreens } from '../data/vitals.js';
import './watch.css';

// The watch as the crew member sees it on the wrist: a face with complications, a notification when a reading
// needs a check, and one screen per reading (the ones that need action first). It only draws GET /api/v1/vitals
// (through watchScreens); there is no notification service behind it.

const ACCENT = { hr: '#ff5c6f', bp: '#c58cff', spo2: '#4fd3ff', hrv: '#5ee0b8', sleep: '#8f9bff' };
const TONE = { high: '#ff6961', medium: '#ffcc4d', info: '#7cb8ff', low: '#5fe39a', idle: '#9aa3a0' };

// 16 × 16 glyphs, drawn with strokes so they read at small sizes on the dark screen.
const GLYPH = {
  hr: <path d="M8 13.5S2 9.8 2 5.9A3.1 3.1 0 0 1 8 4.6a3.1 3.1 0 0 1 6 1.3c0 3.9-6 7.6-6 7.6Z" fill="currentColor"/>,
  bp: <><circle cx="8" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M8 8.5 10.8 5.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>,
  spo2: <path d="M8 2.2s4.5 4.9 4.5 7.8a4.5 4.5 0 0 1-9 0C3.5 7.1 8 2.2 8 2.2Z" fill="currentColor"/>,
  hrv: <path d="M1.5 8.5h2.6l1.6-4 2.6 8 1.9-5.2 1 1.2h3.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>,
  sleep: <path d="M10.6 2.4a5.8 5.8 0 1 0 3 9.6 5 5 0 0 1-3-9.6Z" fill="currentColor"/>,
};
const Glyph = ({ id, size = 16 }) => <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">{GLYPH[id]}</svg>;

const TONE_GLYPH = {
  high: <path d="M8 2 15 14H1L8 2Zm0 4.2v4m0 1.8v.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>,
  medium: <path d="M8 2 15 14H1L8 2Zm0 4.2v4m0 1.8v.1" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round"/>,
  info: <><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" strokeWidth="1.6"/><path d="M8 7.3v4m0-6.5v.1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></>,
  low: <path d="m3 8.5 3.2 3.2L13 4.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>,
  idle: <path d="M4 8h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>,
};
const ToneGlyph = ({ tone, size = 14 }) => <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">{TONE_GLYPH[tone] ?? TONE_GLYPH.idle}</svg>;

// Last two weeks: the usual band shaded, the readings as a line (bars for sleep), today emphasised.
function MiniChart({ screen }) {
  const W = 220, H = 68, PAD = 5;
  const lines = [{ series: screen.series, band: screen.band }, screen.second].filter(l => l && l.series.length);
  if (!lines.length || lines[0].series.length < 2) return <div className="ww-chart-empty">Not enough readings yet</div>;
  const values = lines.flatMap(l => [...l.series.map(p => p.value), ...(l.band ? [l.band.low, l.band.high] : [])]);
  const bars = screen.id === 'sleep';
  const lo = bars ? 0 : Math.min(...values), hi = Math.max(...values), span = (hi - lo) || 1;
  const days = lines[0].series.map(p => p.day), d0 = Math.min(...days), d1 = Math.max(...days);
  const x = day => PAD + (d1 === d0 ? 0 : (day - d0) / (d1 - d0)) * (W - PAD * 2);
  const y = v => H - PAD - (v - lo) / span * (H - PAD * 2);
  const accent = ACCENT[screen.id] ?? '#fff';
  const beyond = (v, band) => band && (screen.direction === 'up' ? v > band.high : screen.direction === 'down' ? v < band.low : v > band.high || v < band.low);
  return <svg className="ww-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${screen.title}, last ${lines[0].series.length} days against the usual range`}>
    {lines.map((l, i) => l.band && <rect key={'b' + i} x={0} width={W} y={y(l.band.high)} height={Math.max(1, y(l.band.low) - y(l.band.high))} rx="3" fill="#ffffff" fillOpacity=".09"/>)}
    {bars ? lines[0].series.map(p => {
      const bw = (W - PAD * 2) / lines[0].series.length * .62;
      return <rect key={p.day} x={x(p.day) - bw / 2} y={y(p.value)} width={bw} height={Math.max(2, H - PAD - y(p.value))} rx={bw / 2}
        fill={beyond(p.value, lines[0].band) ? TONE.medium : accent} fillOpacity={p.day === d1 ? 1 : .55}/>;
    }) : lines.map((l, i) => <g key={'l' + i}>
      <polyline points={l.series.map(p => `${x(p.day)},${y(p.value)}`).join(' ')} fill="none" stroke={accent} strokeOpacity={i ? .55 : 1} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"/>
      {l.series.map(p => beyond(p.value, l.band) && p.day !== d1 && <circle key={p.day} cx={x(p.day)} cy={y(p.value)} r="2.2" fill={TONE.medium}/>)}
      {(() => { const p = l.series[l.series.length - 1]; return <circle cx={x(p.day)} cy={y(p.value)} r="3.6" fill="#000" stroke={beyond(p.value, l.band) ? TONE.medium : accent} strokeWidth="2"/>; })()}
    </g>)}
  </svg>;
}

// A circular complication: the reading inside a ring, the ring closed in the reading's status colour.
function Complication({ screen, onOpen }) {
  const accent = ACCENT[screen.id];
  const attention = screen.tone === 'high' || screen.tone === 'medium';
  const C = 2 * Math.PI * 19;
  return <button type="button" className="ww-comp" onClick={onOpen} aria-label={`${screen.title}: ${screen.value} ${screen.unit}, ${screen.statusLabel}`}>
    <svg viewBox="0 0 44 44" aria-hidden="true">
      <circle cx="22" cy="22" r="19" fill="#141414" stroke="#2a2a2a" strokeWidth="3"/>
      <circle cx="22" cy="22" r="19" fill="none" stroke={attention ? TONE[screen.tone] : accent} strokeWidth="3" strokeLinecap="round"
        strokeDasharray={`${C * .78} ${C}`} transform="rotate(130 22 22)"/>
    </svg>
    <span className="ww-comp-glyph" style={{ color: accent }}><Glyph id={screen.id} size={11}/></span>
    <span className="ww-comp-value">{screen.id === 'bp' ? screen.value.split('/')[0] : screen.value}</span>
    {attention && <i className="ww-comp-flag" style={{ background: TONE[screen.tone] }}/>}
  </button>;
}

function Face({ screens, date, flightDay, onOpen }) {
  const time = screens.find(s => s.id === 'hr')?.time ?? screens[0]?.time ?? '--:--';
  const comps = ['hr', 'spo2', 'sleep'].map(id => screens.find(s => s.id === id)).filter(Boolean);
  return <div className="ww-face">
    <div className="ww-face-top"><span className="ww-face-fd">{flightDay}</span><span>{date}</span></div>
    <div className="ww-face-time">{time}</div>
    <div className="ww-face-zone">UTC · station time</div>
    <div className="ww-face-comps">{comps.map(s => <Complication key={s.id} screen={s} onOpen={() => onOpen(s.id)}/>)}</div>
  </div>;
}

function Notification({ screen, more, onView, onDismiss }) {
  return <div className="ww-note" role="alertdialog" aria-labelledby="ww-note-title" aria-describedby="ww-note-body">
    <div className="ww-note-app"><span className="ww-note-icon" style={{ background: ACCENT[screen.id] }}><Glyph id={screen.id} size={12}/></span>GRAVITAL<span className="ww-note-when">{screen.time ?? 'now'}</span></div>
    <h3 id="ww-note-title">{screen.title}</h3>
    <p id="ww-note-body">{screen.message}.{more ? ` ${more} more reading${more > 1 ? 's' : ''} to check.` : ''}</p>
    <div className="ww-note-actions">
      <button type="button" className="ww-pill primary" onClick={onView}>View</button>
      <button type="button" className="ww-pill" onClick={onDismiss}>Dismiss</button>
    </div>
  </div>;
}

function Reading({ screen }) {
  const accent = ACCENT[screen.id];
  return <div className="ww-reading">
    <div className="ww-app" style={{ color: accent }}><Glyph id={screen.id} size={13}/>{screen.label}</div>
    <div className="ww-big"><span>{screen.value}</span><small style={{ color: accent }}>{screen.unit}</small></div>
    <div className="ww-state" style={{ color: TONE[screen.tone] }}><ToneGlyph tone={screen.tone}/>{screen.statusLabel}</div>
    <p className="ww-text">{screen.message}{screen.extra ? ` · ${screen.extra}` : ''}</p>
    <MiniChart screen={screen}/>
    <div className="ww-axis"><span>14 days</span>{screen.usual && <span>Usual {screen.usual}</span>}<span>Today</span></div>
  </div>;
}

export function WristWatch({ vitals }) {
  const screens = watchScreens(vitals);
  const pages = ['face', ...screens.map(s => s.id)];
  const [page, setPage] = useState('face');
  const [dir, setDir] = useState(1);
  const [dismissed, setDismissed] = useState(false);
  const wheelLock = useRef(0);
  const screenRef = useRef(null);
  const index = Math.max(0, pages.indexOf(page));
  const active = screens.find(s => s.id === page);
  const attention = screens.filter(s => s.tone === 'high' || s.tone === 'medium');
  const showNote = page === 'face' && attention.length > 0 && !dismissed;

  const go = id => { const to = pages.indexOf(id); if (to < 0 || id === page) return; setDir(to > index ? 1 : -1); setPage(id); };
  const step = delta => go(pages[Math.min(pages.length - 1, Math.max(0, index + delta))]);

  // The crown scrolls the screens, like the real one; a non-passive listener so the page does not scroll with it.
  useEffect(() => {
    const el = screenRef.current;
    if (!el) return undefined;
    const onWheel = event => {
      event.preventDefault();
      const now = Date.now();
      if (now - wheelLock.current < 380 || Math.abs(event.deltaY) < 4) return;
      wheelLock.current = now;
      step(event.deltaY > 0 ? 1 : -1);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  });
  const touch = useRef(null);
  const onKey = event => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    if (event.key === 'Home' || event.key === 'Escape') { event.preventDefault(); go('face'); }
  };

  const at = vitals?.vitals?.find(v => v.measure === 'resting_hr')?.latest?.at;
  const when = at ? new Date(at) : null;
  const date = when && !Number.isNaN(when.getTime()) ? `${when.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()} ${when.getUTCDate()}` : '';
  const flightDay = vitals?.mission?.todayLabel ?? '';

  return <section className="wrist glass" aria-labelledby="wrist-title">
    <div className="wrist-copy">
      <header className="wrist-head">
        <h2 id="wrist-title">On the wrist</h2>
        <span className="chip" data-tone={attention.length ? 'warn' : 'ok'}>{attention.length ? `${attention.length} to check` : 'All usual'}</span>
      </header>
      <p className="wrist-intro">What the crew member sees on the watch. Turn the crown, scroll or swipe on the screen to move between readings; the side button goes back to the watch face.</p>
      {screens.length ? <div className="wrist-list" role="group" aria-label="Watch screens">
        {screens.map(s => <button key={s.id} type="button" className={'wrist-row' + (s.id === page ? ' selected' : '')} aria-pressed={s.id === page} onClick={() => go(s.id)}>
          <span className="wrist-row-icon" data-tone={s.tone}><ToneGlyph tone={s.tone} size={16}/></span>
          <span className="wrist-row-copy"><strong>{s.title}</strong><span>{s.statusLabel}{s.time ? ` · ${s.time} UTC` : ''}</span></span>
          <span className="wrist-row-value"><span className="num">{s.value}</span><small>{s.unit}</small></span>
        </button>)}
      </div> : <p className="wrist-intro">No readings from the watch yet.</p>}
      <details className="wrist-how"><summary>How the watch compares readings</summary>
        <p>The watch compares each day with the crew member’s previous two weeks. A change lasting three days schedules a flight surgeon review. Periodic strength, aerobic and bone tests track longer-term changes.</p>
      </details>
    </div>

    <div className="wrist-scene">
      <div className="ww-halo" aria-hidden="true"/>
      <div className="ww-strap ww-strap-top" aria-hidden="true"/>
      <div className="ww-strap ww-strap-bottom" aria-hidden="true"/>
      <div className="ww-case">
        <button type="button" className="ww-crown" onClick={() => step(index === pages.length - 1 ? -pages.length : 1)} aria-label="Digital crown: next screen"/>
        <button type="button" className="ww-side" onClick={() => go('face')} aria-label="Side button: watch face"/>
        <div className="ww-bezel">
          <div className="ww-screen" ref={screenRef} tabIndex={0} role="region" aria-roledescription="watch screen"
            aria-label={`Watch screen ${index + 1} of ${pages.length}. Use the arrow keys to move between screens.`} onKeyDown={onKey}
            onTouchStart={e => { touch.current = e.touches[0].clientY; }}
            onTouchEnd={e => { if (touch.current == null) return; const dy = touch.current - e.changedTouches[0].clientY; touch.current = null; if (Math.abs(dy) > 30) step(dy > 0 ? 1 : -1); }}>
            <div className={'ww-page ' + (dir > 0 ? 'from-below' : 'from-above')} key={page} aria-live="polite">
              {page === 'face' ? <Face screens={screens} date={date} flightDay={flightDay} onOpen={go}/> : active && <Reading screen={active}/>}
            </div>
            {showNote && <Notification screen={attention[0]} more={attention.length - 1}
              onView={() => { setDismissed(true); go(attention[0].id); }} onDismiss={() => setDismissed(true)}/>}
            <div className="ww-dots" aria-hidden="true">{pages.map((p, i) => <i key={p} className={i === index ? 'on' : ''}/>)}</div>
            <div className="ww-glare" aria-hidden="true"/>
          </div>
        </div>
      </div>
    </div>
  </section>;
}
