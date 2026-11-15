import React, { useEffect, useRef } from 'react';
import { compressionAt, flowAtTime, radiusOf } from '../data/veins.js';

const W = 740, H = 246, MM = 9.5, OVAL = 1.42;
const textures = new Map();
const hash = n => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

// Procedural acoustic speckle. No study image is reused or presented as a new scan.
// Only area, flow grade, echoes and compressibility come from the selected record.
function texture(kind = 'tissue') {
  if (textures.has(kind)) return textures.get(kind);
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, n = hash(y * W + x), large = hash(Math.floor(y / 3) * 251 + Math.floor(x / 3));
    const fiber = Math.max(0, Math.sin(y * 0.14 + Math.sin(x * 0.018) * 2.5)) ** 12;
    let v = (18 + n * n * 100 + large * 28 + fiber * 32) * (1 - y / H * 0.38);
    if (y < 16) v *= 0.15;
    if (y >= 18 && y <= 22) v += 70;
    if (kind === 'echo') v = 8 + n ** 5 * 130 + large * 15;
    if (kind === 'clot') v = 35 + n * n * 78 + large * 25;
    if (kind === 'blue' || kind === 'red') {
      const k = 0.3 + n * 0.7;
      image.data[i] = kind === 'blue' ? 12 + k * 25 : 110 + k * 140;
      image.data[i + 1] = kind === 'blue' ? 55 + k * 100 : 25 + k * 65;
      image.data[i + 2] = kind === 'blue' ? 115 + k * 140 : 20 + k * 20;
    } else image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0); textures.set(kind, canvas); return canvas;
}

function text(ctx, value, x, y, color = '#d1ddd9', size = 13, align = 'left') {
  ctx.font = `${size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
  ctx.fillStyle = color; ctx.textAlign = align; ctx.fillText(value, x, y);
}
function ellipse(ctx, x, y, rx, ry) { ctx.beginPath(); ctx.ellipse(x, y, rx, Math.max(2, ry), -0.09, 0, Math.PI * 2); }
function stroke(ctx, color, width = 1) { ctx.strokeStyle = color; ctx.lineWidth = width; ctx.stroke(); }
function cross(ctx, x, y) { ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.moveTo(x, y - 5); ctx.lineTo(x, y + 5); stroke(ctx, '#7be0cf', 1.5); }
function depth(ctx) {
  for (let mm = 0; mm <= 20; mm += 5) {
    const y = 24 + mm * MM; ctx.beginPath(); ctx.moveTo(W - 31, y); ctx.lineTo(W - 23, y); stroke(ctx, '#a5b3b1');
    text(ctx, String(mm), W - 18, y + 4, '#abb9b6', 11);
  }
  text(ctx, 'mm', W - 16, H - 10, '#abb9b6', 10, 'center');
}
function vessel(ctx, x, y, rx, ry, echo, obstructed) {
  ellipse(ctx, x, y, rx + 2, ry + 2); ctx.fillStyle = '#a4aeaa'; ctx.fill();
  ellipse(ctx, x, y, rx, ry); ctx.fillStyle = '#050909'; ctx.fill();
  ctx.save(); ellipse(ctx, x, y, rx - 1, ry - 1); ctx.clip();
  if (echo || obstructed) {
    ctx.globalAlpha = obstructed ? 0.78 : echo === 2 ? 0.55 : 0.2;
    ctx.drawImage(texture(obstructed ? 'clot' : 'echo'), 0, 0); ctx.globalAlpha = 1;
  }
  if (obstructed) {
    // Heterogeneous intraluminal echoes are a visual explanation of the model's
    // possible obstruction, not an inferred thrombus boundary or age.
    ctx.beginPath(); ctx.ellipse(x + rx * 0.12, y + ry * 0.15, rx * 0.87, ry * 0.76, -0.2, 0, Math.PI * 2);
    ctx.save(); ctx.clip(); ctx.globalAlpha = 0.76; ctx.drawImage(texture('clot'), 17, 9); ctx.restore();
  }
  ctx.restore(); ellipse(ctx, x, y, rx, ry); stroke(ctx, '#bac4bd', 1.2);
}

function transverse(ctx, shape, flat, compare, preArea) {
  ctx.drawImage(texture(), 0, 0);
  const r = radiusOf(shape.area) * MM, rx = r * Math.sqrt(OVAL), ry = r / Math.sqrt(OVAL);
  const cx = 443, cy = 112 + ry * flat, height = Math.max(3, ry * (1 - flat));
  const arteryBeat = 1; // Arterial detail is anatomical context, not a measured arterial trace.
  vessel(ctx, 264, 164, 30 * arteryBeat, 31 * arteryBeat, 0, false);
  vessel(ctx, cx, cy, rx, height, shape.echo, shape.clot);
  if (compare && preArea) {
    const pr = radiusOf(preArea) * MM;
    ctx.setLineDash([5, 4]); ellipse(ctx, cx, 112, pr * Math.sqrt(OVAL), pr / Math.sqrt(OVAL)); stroke(ctx, '#64c8b7', 1); ctx.setLineDash([]);
    text(ctx, 'Preflight contour', 20, H - 17, '#8fd0bd', 12);
  }
  cross(ctx, cx - rx, cy); cross(ctx, cx + rx, cy);
  ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.lineTo(cx + rx, cy); stroke(ctx, '#7be0cf', 0.7); ctx.setLineDash([]);
  text(ctx, 'IJV', cx + rx + 16, cy + 5, '#e0e7dc', 15);
  text(ctx, 'CCA', 252, 170, '#d7dfdc', 13);
  text(ctx, `Recorded CSA ${Math.round(shape.area)} mm²`, 20, 43, '#8fe0ce', 16);
  if (flat > 0.3) text(ctx, shape.clot ? 'REMAINS OPEN UNDER PRESSURE' : 'VEIN WALLS APPROACH', 20, 64, shape.clot ? '#f3bf8b' : '#8fe0ce', 12);
  if (shape.clot) { text(ctx, 'Intraluminal echoes', cx + 20, 211, '#eacb9e', 12); ctx.beginPath(); ctx.moveTo(cx + 19, 199); ctx.lineTo(cx + 3, cy + height * 0.5); stroke(ctx, '#eacb9e', 0.8); }
  depth(ctx);
}

function lumenPath(ctx, radius, flat) {
  const ry = Math.max(4, radius * (1 - flat)), center = 112 + radius * flat;
  ctx.beginPath();
  for (let x = 0; x <= W; x += 8) { const y = center - ry + Math.sin(x / 130) * 6; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
  for (let x = W; x >= 0; x -= 8) ctx.lineTo(x, center + ry + Math.sin(x / 130) * 6);
  ctx.closePath();
}
function longitudinal(ctx, shape, t, flat, flowOffset) {
  ctx.drawImage(texture(), 0, 0);
  const radius = radiusOf(shape.area) * MM / Math.sqrt(OVAL);
  lumenPath(ctx, radius + 2, flat); ctx.fillStyle = '#a4aeaa'; ctx.fill();
  lumenPath(ctx, radius, flat); ctx.fillStyle = '#040809'; ctx.fill();
  ctx.save(); lumenPath(ctx, radius - 1, flat); ctx.clip();
  if (shape.clot) {
    ctx.globalAlpha = 0.82; ctx.drawImage(texture('clot'), 0, 0); ctx.globalAlpha = 1;
    ctx.save(); ctx.beginPath(); ctx.ellipse(360, 113, 130, radius * 0.95, 0.025, 0, Math.PI * 2); ctx.clip();
    ctx.globalAlpha = 0.85; ctx.drawImage(texture('clot'), 33, 17); ctx.restore();
  } else {
    const velocity = flowAtTime(shape, t), color = velocity >= 0 ? 'blue' : 'red';
    ctx.globalAlpha = shape.grade === 3 ? 0.34 : 0.36 + Math.min(1, Math.abs(velocity) / Math.max(1, Math.abs(shape.speed))) * 0.52;
    const offset = ((flowOffset % W) + W) % W;
    for (const x of [offset - W, offset, offset + W]) ctx.drawImage(texture(color), x, 0);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
  ctx.setLineDash([5, 5]); ctx.strokeStyle = '#668e97'; ctx.lineWidth = 1; ctx.strokeRect(68, 41, W - 140, 148); ctx.setLineDash([]);
  // A schematic sampling gate; not a recovered insonation angle.
  ctx.beginPath(); ctx.moveTo(330, 34); ctx.lineTo(413, 190); stroke(ctx, '#e3cf80', 1);
  for (const y of [103, 123]) { ctx.beginPath(); ctx.moveTo(365, y); ctx.lineTo(391, y - 13); stroke(ctx, '#ffe59b', 2); }
  text(ctx, 'HEAD', 20, 224, '#bdc8c4', 11); text(ctx, 'HEART →', W - 60, 224, '#bdc8c4', 11, 'right');
  text(ctx, shape.clot ? 'No colour flow in this model' : shape.grade === 3 ? 'Alternating flow · no net forward flow' : shape.grade === 4 ? '← Retrograde flow' : 'Forward flow →', 20, 38, shape.clot ? '#f2c490' : '#9cd6e6', 13);
  depth(ctx);
}

function spectral(ctx, shape, t, width = W) {
  const height = 156, zero = 68, left = 45, right = width - 25;
  ctx.fillStyle = '#070f13'; ctx.fillRect(0, 0, width, height);
  const max = Math.max(20, Math.ceil(Math.abs(shape.speed) * 1.15 / 10) * 10);
  for (const v of [-max, 0, max]) {
    const y = zero - v / max * 48; ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(right, y); stroke(ctx, v === 0 ? '#d6bf78' : '#ffffff12', v === 0 ? 1 : 0.5);
    text(ctx, String(v), left - 9, y + 4, v === 0 ? '#e5ce8a' : '#7d979b', 10, 'right');
  }
  text(ctx, 'cm/s', 5, 12, '#8da6ab', 9);
  // The publication's sign convention: heartward flow BELOW the zero line.
  for (let x = left; x < right; x += 2) {
    const seconds = (x - left) / (right - left) * 5 + t * 0.15;
    const v = flowAtTime(shape, seconds), end = zero + v / max * 48;
    ctx.strokeStyle = '#cdd9c17a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, zero); ctx.lineTo(x, end); ctx.stroke();
    if (v) for (let n = 0; n < 4; n++) {
      const f = hash(x * 7 + n * 31); ctx.fillStyle = `rgba(233,238,210,${0.2 + f * 0.6})`; ctx.fillRect(x, zero + (end - zero) * f, 1.4, 1.2);
    }
  }
  if (shape.clot) text(ctx, 'NO FLOW SIGNAL IN THIS SIMULATION', width / 2, 34, '#dfc6a1', 12, 'center');
  text(ctx, '← toward head', right, 18, '#9bb6bb', 10, 'right'); text(ctx, 'toward heart →', right, 126, '#9bb6bb', 10, 'right');
  for (let s = 0; s <= 5; s++) text(ctx, `${s}s`, left + s / 5 * (right - left), 146, '#8da6ab', 10, 'center');
}

function ScanCanvas({ mode, shape, compress, compare, preArea, paused, label }) {
  const canvasRef = useRef(null), state = useRef({ shape, compare, preArea, paused, press: null });
  Object.assign(state.current, { shape, compare, preArea, paused });
  useEffect(() => { state.current.press = compress ? performance.now() : null; }, [compress]);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return undefined;
    const height = mode === 'spectral' ? 156 : H;
    let frame, visible = true, last = performance.now(), drawn = 0, time = 0, flowOffset = 0;
    const resize = () => { const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5); canvas.width = Math.max(1, Math.round(canvas.clientWidth * pixelRatio)); canvas.height = mode === 'spectral' ? Math.round(height * pixelRatio) : Math.round(canvas.width / W * height); };
    const observer = new ResizeObserver(resize); observer.observe(canvas); resize();
    const intersection = new IntersectionObserver(e => { visible = e[0].isIntersecting; }); intersection.observe(canvas);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    const animate = now => {
      const dt = Math.min(0.06, (now - last) / 1000); last = now;
      const s = state.current;
      if (visible && !document.hidden && !s.paused && !reduce.matches) {
        time += dt;
        flowOffset += flowAtTime(s.shape, time) * dt * 2;
      }
      if (visible && !document.hidden && now - drawn > 40) {
        const elapsed = s.press == null ? null : (now - s.press) / 1000, flat = compressionAt(elapsed, s.shape.clot);
        ctx.setTransform(canvas.width / (mode === 'spectral' ? Math.max(1, canvas.clientWidth) : W), 0, 0, canvas.height / height, 0, 0);
        if (mode === 'transverse') transverse(ctx, s.shape, flat, s.compare, s.preArea);
        else if (mode === 'longitudinal') longitudinal(ctx, s.shape, time, flat, flowOffset);
        else spectral(ctx, s.shape, time, canvas.clientWidth);
        drawn = now;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); };
  }, [mode]);
  return <canvas ref={canvasRef} className={`vein-scan-canvas vein-scan-${mode}`} role="img" aria-label={label}/>;
}

export function UltrasoundStudy(props) {
  return <div className="vein-ultrasound">
    <figure className="ultrasound-frame"><figcaption><span><b>B-MODE</b> Transverse section</span><small>Illustrated ultrasound</small></figcaption>
      <ScanCanvas {...props} mode="transverse" label={`Illustrative transverse ultrasound: jugular area ${Math.round(props.shape.area)} square millimetres; ${props.shape.clot ? 'non-compressible' : 'compressible'} vein next to the carotid artery`}/>
    </figure>
    <figure className="ultrasound-frame"><figcaption><span><b>COLOUR FLOW</b> Longitudinal section</span><small>{props.shape.clot ? 'No flow in model' : 'Direction + pulsatility'}</small></figcaption>
      <ScanCanvas {...props} mode="longitudinal" label="Illustrative longitudinal ultrasound with a colour overlay of the selected flow pattern"/>
      <div className="vein-colour-key"><span><i className="away"/> Away from probe</span><span><i className="toward"/> Toward probe</span><small>Colour encodes direction, not oxygen or severity.</small></div>
    </figure>
  </div>;
}

export function SpectralDoppler(props) {
  return <figure className="vein-spectral ultrasound-frame"><figcaption><span><b>SPECTRAL DOPPLER</b> {props.shape.clot ? 'No flow signal' : ['','Continuous','Pulsatile','No net forward flow','Retrograde'][props.shape.grade]}</span><small>Illustrated waveform · 5 seconds</small></figcaption>
    <ScanCanvas {...props} mode="spectral" label="Illustrative Doppler spectrum: flow toward the heart is below the zero baseline, as in Marshall-Goebel 2019"/>
  </figure>;
}
