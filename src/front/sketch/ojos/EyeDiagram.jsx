import React, { useEffect, useRef, useState } from 'react';

// A side cut of the eye, drawn from one exam's changes (data/eyes.js eyeShape). The changes are tens of micrometres
// on a 24 mm eye, so the drawing exaggerates them (SCALE) to make them visible; the numbers are in the cards.
const CX = 230, CY = 165, R = 122;
const SCALE = { disc: 0.45, discMax: 46, choroid: 0.1, sheath: 9, flatten: 15 };
const COL = { sclera: '#7d7a9c', choroid: '#c0566a', retina: '#e8935f', swollen: '#a4242f', nerve: '#f1d9a3',
  sheath: '#ddd7f2', lens: '#d5ebf6', ink: '#3d4462', ghost: '#9b97b8' };

function useTween(target, ms = 650) {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const shown = useRef(target);
  useEffect(() => {
    from.current = shown.current;
    const start = performance.now();
    let frame;
    const step = now => {
      const t = Math.min(1, (now - start) / ms);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;      // ease in-out
      const next = Object.fromEntries(Object.keys(target).map(key => [key, from.current[key] + (target[key] - from.current[key]) * k]));
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target.disc, target.choroid, target.sheath, target.flatten, target.folds]);    // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

// The back of the globe flattens: its horizontal radius shrinks.
const backRx = flatten => R - SCALE.flatten * flatten;
const point = (deg, inset, flatten) => {
  const a = deg * Math.PI / 180;
  const rx = (Math.cos(a) >= 0 ? backRx(flatten) : R) - inset, ry = R - inset;
  return [CX + rx * Math.cos(a), CY + ry * Math.sin(a)];
};
const arc = (from, to, inset, flatten, steps = 48) => Array.from({ length: steps + 1 }, (_, i) => point(from + (to - from) * i / steps, inset, flatten));
const line = pts => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

function mix(a, b, t) {
  const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * Math.min(1, Math.max(0, t)))).join(',')})`;
}

export function EyeDiagram({ shape, title }) {
  const s = useTween(shape);
  const choroidW = 4 + SCALE.choroid * s.choroid;
  const bump = Math.min(SCALE.discMax, SCALE.disc * s.disc);
  const backX = CX + backRx(s.flatten);
  const retinaInset = 3 + choroidW + 2;
  const discX = backX - retinaInset;
  const sheathHalf = 21 + SCALE.sheath * s.sheath;
  const globe = `${line(arc(-180, 180, 0, s.flatten, 120))} Z`;
  const ghost = `${line(arc(-90, 90, 0, 0, 60))}`;
  const retina = line(arc(-125, 125, retinaInset, s.flatten, 90).filter(([x, y]) => !(x > discX - 8 && Math.abs(y - CY) < 22)));
  const folds = [-1, 1].map(side => {
    const pts = arc(side * 18, side * 52, retinaInset + 5, s.flatten, 30)
      .map(([x, y], i) => [x - 3 * Math.sin(i * 1.4), y]);
    return line(pts);
  });
  const discPath = `M${discX + 2} ${CY - 24} Q${discX - bump * 1.15} ${CY - 18} ${discX - bump} ${CY} Q${discX - bump * 1.15} ${CY + 18} ${discX + 2} ${CY + 24} Z`;
  return <svg className="eye-diagram" viewBox="0 0 560 330" role="img" aria-label={title}>
    <defs>
      <clipPath id="eye-inside"><path d={globe}/></clipPath>
      <radialGradient id="vitreous" cx="0.45" cy="0.45" r="0.7"><stop offset="0" stopColor="#fbfbff"/><stop offset="1" stopColor="#eeedf8"/></radialGradient>
    </defs>
    {/* optic nerve and its sheath, behind the globe */}
    <rect x={backX - 6} y={CY - sheathHalf} width={560 - backX} height={2 * sheathHalf} rx={10} fill={COL.sheath} stroke="#b9b2dc" strokeWidth={1.5}/>
    <rect x={backX - 6} y={CY - 13} width={560 - backX} height={26} fill={COL.nerve} stroke="#d7b874" strokeWidth={1}/>
    {/* the globe */}
    <path d={globe} fill="url(#vitreous)" stroke={COL.sclera} strokeWidth={4}/>
    {s.flatten > 0.02 && <path d={ghost} fill="none" stroke={COL.ghost} strokeWidth={1.5} strokeDasharray="5 5" opacity={s.flatten}/>}
    <g clipPath="url(#eye-inside)">
      <path d={line(arc(-125, 125, 3 + choroidW / 2, s.flatten, 90))} fill="none" stroke={COL.choroid} strokeWidth={choroidW} strokeLinecap="round" opacity={0.85}/>
      {/* pre-flight inner edge of the choroid, for comparison */}
      {s.choroid > 2 && <path d={line(arc(-60, 60, 3 + 4, 0, 40))} fill="none" stroke="#fff" strokeWidth={1.2} strokeDasharray="3 4" opacity={0.9}/>}
      <path d={retina} fill="none" stroke={COL.retina} strokeWidth={4} strokeLinecap="round"/>
      {s.folds > 0.02 && folds.map((d, i) => <path key={i} d={d} fill="none" stroke="#8a3f1f" strokeWidth={1.6} opacity={s.folds}/>)}
      <path d={discPath} fill={mix(COL.retina, COL.swollen, s.disc / 80)} stroke="#8a3f1f" strokeWidth={1}/>
    </g>
    {/* front of the eye */}
    <path d={`M${CX - R + 14} ${CY - 62} Q${CX - R - 34} ${CY} ${CX - R + 14} ${CY + 62}`} fill="#f4f9fd" stroke={COL.sclera} strokeWidth={2.5}/>
    <ellipse cx={CX - R + 46} cy={CY} rx={17} ry={44} fill={COL.lens} stroke="#8fb6cc" strokeWidth={1.5}/>
    <path d={`M${CX - R + 30} ${CY - 70} L${CX - R + 30} ${CY - 46} M${CX - R + 30} ${CY + 46} L${CX - R + 30} ${CY + 70}`} stroke="#6a5f9e" strokeWidth={5} strokeLinecap="round"/>
    {/* labels */}
    <g className="eye-labels" fill={COL.ink}>
      <Label x={CX - R - 6} y={CY - 92} tx={CX - R - 20} ty={36} text="Cornea"/>
      <Label x={CX - R + 46} y={CY - 44} tx={CX - R + 52} ty={36} text="Lens"/>
      <Label x={point(-55, retinaInset, s.flatten)[0]} y={point(-55, retinaInset, s.flatten)[1]} tx={300} ty={24} text="Retina"/>
      <Label x={point(-70, 3, s.flatten)[0]} y={point(-70, 3, s.flatten)[1]} tx={196} ty={14} text="Choroid"/>
      <Label x={discX - bump / 2} y={CY + 18} tx={discX - 120} ty={312} text="Optic disc"/>
      <Label x={backX + 70} y={CY - sheathHalf} tx={backX + 40} ty={60} text="Nerve sheath"/>
      <Label x={backX + 110} y={CY + 8} tx={backX + 70} ty={300} text="Optic nerve"/>
    </g>
  </svg>;
}

function Label({ x, y, tx, ty, text }) {
  return <g>
    <line x1={x} y1={y} x2={tx + 4} y2={ty + (ty < y ? 6 : -14)} stroke="#a9a6c4" strokeWidth={1}/>
    <text x={tx} y={ty} fontSize={14} fontWeight={700}>{text}</text>
  </g>;
}
