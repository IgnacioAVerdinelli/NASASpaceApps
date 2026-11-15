import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CartesianGrid, ComposedChart, ErrorBar, Line, ReferenceArea, ReferenceLine, Scatter, Tooltip, XAxis, YAxis } from 'recharts';
import BodyViewer from '../../body-3d/BodyViewer.jsx';
import { ChartContainer } from '../components/chart.jsx';
import { colorScale, crew, evaluations, fmtPct, groups, keyToGroup, levelOf, levels, reference, upcoming } from './data.js';
import '../style.css';
import './style.css';

const tick = { fill: '#4f5874', fontSize: 13 };
// Colores de identidad (no de estado): no se confunden con la escala verde → rojo.
const CREW = '#2f2850';
const THRESHOLD = '#a4242f';
const REF_COLORS = { CONTROL: '#6d5fb8', EXERCISE: '#0e7490', FLY: '#9096ad' };

export function AlertIcon() {
  return <svg className="alert-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M8 1.8 15 14H1z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/><path d="M8 6.2v3.6M8 11.6v.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>;
}

// Transición suave del color del cuerpo al cambiar de evaluación (respeta reduced motion).
function useTweenedScores(target, duration = 600) {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);
  useEffect(() => {
    const from = shownRef.current;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { shownRef.current = target; setShown(target); return undefined; }
    let frame = 0, start = null;
    const step = now => {
      start ??= now;
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - progress) ** 3;
      const next = Object.fromEntries(Object.entries(target).map(([key, value]) => {
        const origin = from[key] ?? value;
        return [key, origin + (value - origin) * eased];
      }));
      shownRef.current = next; setShown(next);
      if (progress < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target, duration]);
  return shown;
}

export function LevelBadge({ pct }) {
  const level = levelOf(pct);
  return <span className={`level-badge level-${level.id}`}><i style={{ background: level.color }} aria-hidden="true"/>{level.alert && <AlertIcon/>}{level.label}</span>;
}

function Tip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return <div className="chart-tooltip">{row.kind === 'ref'
    ? <><strong>{row.name} · {reference.bedRestDays} días</strong><div>Cambio medio: <b>{fmtPct(row.mean)} ± {row.sd.toFixed(1).replace('.', ',')}</b></div><div>n = {row.n} · {reference.post1}</div>{row.post2 && <div>Recuperación ({reference.post2}): <b>{fmtPct(row.post2)}</b></div>}</>
    : <><strong>{row.label} · día {row.day}</strong><div>Cambio: <b>{fmtPct(row.pct)}</b></div><div>Torque máximo: <b>{row.nm} N·m</b></div></>}</div>;
}

function MuscleDetail({ group, evalIndex }) {
  const shown = group.points.slice(0, evalIndex + 1);
  const latest = shown.at(-1);
  const refs = Object.entries(group.test.groups).map(([key, g]) => ({
    kind: 'ref', key, name: { CONTROL: 'Sin contramedida', EXERCISE: 'Con ejercicio', FLY: 'FLY' }[key], mean: g.post1_pct.mean, sd: g.post1_pct.sd, n: g.post1_pct.n,
    post2: g.post2_pct?.mean ?? null, err: g.post1_pct.sd,
  }));
  const trajectory = shown.map(point => ({ ...point, kind: 'me' }));
  // Misma escala en ambos gráficos; se amplía si algún desvío de la referencia la excede.
  const lo = Math.min(-35, ...refs.map(r => r.mean - r.sd)), hi = Math.max(10, ...refs.map(r => r.mean + r.sd));
  const domain = [Math.floor(lo / 10) * 10, Math.ceil(hi / 10) * 10];
  const ticks = Array.from({ length: (domain[1] - domain[0]) / 10 + 1 }, (_, i) => domain[1] - i * 10);
  const next = [...evaluations.slice(evalIndex + 1).map(e => e.day), ...upcoming];
  return <section className="detail" aria-labelledby="detail-title">
    <header className="detail-head">
      <div><h2 id="detail-title">{group.name}</h2><p className="detail-sub">{group.test.test} · {group.region}</p></div>
      <div className="detail-figure"><strong>{fmtPct(latest.pct)}</strong><span>{latest.nm} N·m · {latest.label}</span><LevelBadge pct={latest.pct}/></div>
    </header>
    <div className="detail-charts">
      <figure className="panel">
        <figcaption><h3>Evolución a bordo</h3><p>Cambio del torque máximo respecto de la línea base previa al vuelo ({group.baseline} N·m). Datos del tripulante simulados.</p></figcaption>
        <ChartContainer config={{}} className="detail-chart"><ComposedChart data={trajectory} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
          <ReferenceArea y1={-5} y2={5} fill="#e4e6ee" fillOpacity={0.9} ifOverflow="hidden"/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4" label={{ value: 'Umbral −20 %', position: 'insideBottomLeft', fill: THRESHOLD, fontSize: 13 }}/>
          <ReferenceLine x={crew.today} stroke="#a7a3c4" strokeDasharray="2 4" label={{ value: `Hoy FD ${crew.today}`, position: 'insideTopRight', fill: '#4f5874', fontSize: 12 }}/>
          {next.map(day => <ReferenceLine key={day} x={day} stroke="#d4d0ea" strokeDasharray="1 5"/>)}
          <XAxis dataKey="day" type="number" domain={[0, crew.missionDays]} ticks={[0, 30, 60, 90, 120, 150, 180]} tickFormatter={d => d === 0 ? 'Pre' : `FD ${d}`} tick={tick} axisLine={false} tickLine={false}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v} %`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip/>} cursor={{ stroke: '#a49acb', strokeDasharray: '3 4' }}/>
          <Line dataKey="pct" stroke={CREW} strokeWidth={2.5} dot={{ r: 7, fill: CREW, stroke: '#fff', strokeWidth: 2.5 }} activeDot={{ r: 9, stroke: '#fff', strokeWidth: 2.5 }} isAnimationActive={false}/>
        </ComposedChart></ChartContainer>
        <p className="chart-note">Franja gris: cambio dentro de ±5 % (no distinguible del error de la prueba, supuesto). Líneas punteadas verticales: próximas evaluaciones.</p>
      </figure>
      <figure className="panel">
        <figcaption><h3>Referencia: CFT70</h3><p>Cambio al terminar {reference.bedRestDays} días de reposo en cama ({reference.post1}), media ± DE. Misma prueba y unidad.</p></figcaption>
        <ChartContainer config={{}} className="detail-chart"><ComposedChart data={refs} margin={{ top: 12, right: 12, left: 0, bottom: 4 }}>
          <CartesianGrid vertical={false} stroke="#e2e2ef" strokeDasharray="3 5"/>
          <ReferenceArea y1={-5} y2={5} fill="#e4e6ee" fillOpacity={0.9}/>
          <ReferenceLine y={-20} stroke={THRESHOLD} strokeDasharray="6 4"/>
          <ReferenceLine y={latest.pct} stroke={CREW} strokeDasharray="4 4" label={{ value: `Tripulante ${fmtPct(latest.pct)}`, position: 'insideTopLeft', fill: CREW, fontSize: 12 }}/>
          <XAxis dataKey="name" type="category" tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} interval={0} padding={{ left: 36, right: 36 }}/>
          <YAxis domain={domain} ticks={ticks} tickFormatter={v => `${v} %`} tick={tick} axisLine={false} tickLine={false} width={48}/>
          <Tooltip content={<Tip/>} cursor={false}/>
          <Scatter dataKey="mean" isAnimationActive={false} shape={props => <circle cx={props.cx} cy={props.cy} r={8} fill={REF_COLORS[props.payload.key]} stroke="#fff" strokeWidth={2}/>}>
            <ErrorBar dataKey="err" direction="y" width={8} strokeWidth={2} stroke="#7c8299"/>
          </Scatter>
        </ComposedChart></ChartContainer>
        <p className="chart-note">Voluntarios en Tierra, no astronautas. Grupo FLY: equipo compacto de volante de inercia (por confirmar).</p>
      </figure>
    </div>
  </section>;
}

// Vista de fuerza muscular. El header y las pestañas los pone vuelo/Shell.jsx.
export function StrengthView() {
  const [evalIndex, setEvalIndex] = useState(evaluations.length - 1);
  const [selectedKey, setSelectedKey] = useState('quadriceps_l');
  const [exploration, setExploration] = useState({ key: null, request: 0 });
  const current = evaluations[evalIndex];

  const rows = useMemo(() => groups.map(group => ({ group, point: group.points[evalIndex] })).sort((a, b) => a.point.pct - b.point.pct), [evalIndex]);
  const scores = useMemo(() => Object.fromEntries(groups.flatMap(group => {
    const pct = group.points[evalIndex].pct;
    return group.keys.map(key => [key, levelOf(pct).id]);
  })), [evalIndex]);
  const shownScores = useTweenedScores(scores);
  const selectedGroup = keyToGroup.get(selectedKey) ?? null;
  const checkpointItems = useMemo(() => groups.map(g => ({ id: g.key, title: g.name, muscleKeys: g.keys })), []);
  const indicatorText = useMemo(() => key => {
    const g = groups.find(item => item.keys.includes(key));
    if (!g) return null;
    const side = key.endsWith('_l') ? ' · izq.' : key.endsWith('_r') ? ' · der.' : '';
    return { name: g.name + side, value: fmtPct(g.points[evalIndex].pct) };
  }, [evalIndex]);

  // Igual que main: se enfoca exactamente el área tocada; tocarla de nuevo vuelve al cuerpo entero.
  const choose = key => {
    if (!keyToGroup.has(key)) return;
    setSelectedKey(key);
    setExploration(prev => ({ key: prev.key === key ? null : key, request: prev.request + 1 }));
  };
  // Los gráficos del detalle se actualizan cuando termina el movimiento de cámara (500 ms en el
  // visor), para que su render no trabe la animación.
  const [detailGroupKey, setDetailGroupKey] = useState(selectedGroup);
  useEffect(() => {
    if (selectedGroup === detailGroupKey) return undefined;
    const timer = setTimeout(() => setDetailGroupKey(selectedGroup), 550);
    return () => clearTimeout(timer);
  }, [selectedGroup, detailGroupKey]);
  const group = groups.find(g => g.key === detailGroupKey);

  return <div className="fuerza">

    <section className="overview fuerza-overview" aria-label="Mapa corporal">
      <div className="body-panel">
        <div className="body-panel-heading"><span>MAPA CORPORAL · {current.label.toUpperCase()}</span><span>6 grupos evaluados · ambos lados con el mismo valor</span></div>
        <div className="body-stage"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="model-canvas">
          <BodyViewer body="male" layer="surface" scores={shownScores} selected={selectedKey} onSelect={choose} framing={1.1} showIndicators checkpointItems={checkpointItems} explorationRequest={exploration} colorScale={colorScale} indicatorText={indicatorText}/>
        </div></div>
        <ul className="legend-levels" aria-label="Escala de color">
          {levels.map(level => <li key={level.id}><i style={{ background: level.color }}/>{level.alert && <AlertIcon/>}<span>{level.label}<small>{level.range}</small></span></li>)}
          <li><i className="not-assessed"/><span>No evaluado<small>sin medición en el protocolo</small></span></li>
        </ul>
        <div className="timeline" role="group" aria-label="Evaluación a mostrar">
          <span className="timeline-label">Evaluación a bordo</span>
          <ol style={{ '--progress': `${evalIndex / (evaluations.length + upcoming.length - 1) * 100}%` }}>{evaluations.map((e, i) => <li key={e.id} className={(i === evalIndex ? 'on ' : '') + (i < evalIndex ? 'done' : '')}><button type="button" aria-pressed={i === evalIndex} onClick={() => setEvalIndex(i)}>{e.label}</button></li>)}{upcoming.map(d => <li key={d} className="next">FD {d}<small>próxima</small></li>)}</ol>
        </div>
      </div>

      <div className="summary">
        <div className="summary-content">
          <p className="summary-intro">Ordenado de mayor a menor pérdida en la evaluación {current.label}. Seleccioná un grupo para ver su evolución y la referencia.</p>
          <div className="insight-list" role="group" aria-label="Grupos musculares evaluados">
            {rows.map(({ group: g, point }) => {
              const active = g.key === selectedGroup;
              return <button type="button" key={g.key} className={'insight-row' + (active ? ' is-selected' : '')} aria-pressed={active} onClick={() => choose(active ? selectedKey : g.keys[0])}>
                <span className="insight-marker" aria-hidden="true" style={{ background: levelOf(point.pct).color, borderColor: levelOf(point.pct).color }}/>
                <span className="insight-main"><span className="insight-name">{g.name}</span><span className="insight-detail">{g.test.test} · {point.nm} N·m</span><LevelBadge pct={point.pct}/></span>
                <span className="insight-change">{fmtPct(point.pct)}</span>
              </button>;
            })}
          </div>
          <p className="note">Datos del tripulante simulados. Las referencias son datos reales de reposo en cama (voluntarios en Tierra). Esta vista informa cambios; no constituye un diagnóstico.</p>
        </div>
      </div>
    </section>

    {group && <MuscleDetail group={group} evalIndex={evalIndex}/>}

    <section className="method" aria-labelledby="method-title">
      <h2 id="method-title">Cómo se obtiene la medición</h2>
      <p className="lede">Cambio porcentual del torque máximo respecto de la línea base previa al vuelo, por grupo muscular. Método propuesto: dinamómetro isocinético a bordo (tipo MARES, ESA), con el protocolo de NASA <i>Medical Volume B 5.3</i>. Referencia: estudio de reposo en cama CFT70 (NLSP MR079G).</p>
      <div className="method-grid">
        <div><h3>Equipo</h3><p>Dinamómetro isocinético a bordo. El antecedente es MARES (ESA, módulo Columbus), usado en vuelo en Sarcolab-3 (FD 9, 49 y 131). Hoy NASA no mide la fuerza en vuelo de forma rutinaria: monitorea el entrenamiento en ARED. Por eso esta medición se presenta como <b>método propuesto</b>.</p></div>
        <div><h3>Protocolo</h3><p>Mismo set de pruebas que NASA aplica antes y después del vuelo: rodilla a 60°/s, tobillo a 30°/s y tronco a 60°/s, con 3 a 5 repeticiones máximas por prueba. Se registra el torque máximo en N·m, siempre en la misma posición y con el mismo ajuste del equipo.</p></div>
        <div><h3>Calendario</h3><p>Línea base antes del vuelo; en vuelo FD 15 y luego cada 30 días (esquema de ESA, Petersen y col. 2016). Cambio % = (torque actual ÷ torque pre-vuelo − 1) × 100.</p></div>
        <div><h3>Referencia y límites</h3><p>CFT70: 42 voluntarios, 70 días de reposo en cama, grupos sin contramedida, con ejercicio y FLY. 41 de 42 son hombres; no hay mediciones durante el reposo. La referencia mide una sola pierna; el mapa muestra ambos lados con el mismo valor. Umbral de −20 %: pérdida asociada a menor desempeño en tareas críticas (Scott y col. 2023).</p></div>
      </div>
      <p className="source">Fuente de referencia: {reference.source}.</p>
    </section>
  </div>;
}
