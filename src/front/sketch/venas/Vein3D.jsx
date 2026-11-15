import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { radiusOf } from '../data/veins.js';

// A 3 cm stretch of the neck: the internal jugular vein (see-through, so the blood inside shows) next to the carotid
// artery, as the ultrasound probe sees them. One scan's values drive it (data/veins.js veinShape): the vein's area to
// scale, the blood moving as its flow grade says (down to the heart, in pulses, standing still or back up toward the
// head), "smoke" for slow-blood echoes, a clot when the vein does not collapse. `compress` (a number that changes)
// presses the probe on the neck: a healthy vein flattens, one with a clot does not. Same renderer, lights and look as
// the eye (ojos/Eye3D.jsx). Units: 1 = 5 mm. Area and speed are to scale; the drawing is not a scan.
const MM = 1 / 5;
const LENGTH = 6;                          // 30 mm of vein
const CAROTID_R = 3.2 * MM, CAROTID_X = -1.75;
const VEIN_X = 0.9;
const OVAL = 1.35;                         // the jugular is an oval, wider than deep
const SPEED = 0.07;                        // scene units per second per cm/s: 25 cm/s moves ~1.75 units (9 mm) a second
const BLOOD = 150, SMOKE = 110;
const PRESS = { down: 0.45, hold: 0.7, up: 0.45 };      // seconds
const COLORS = { vein: '#5b7fb8', artery: '#c4545c', blood: '#a3303f', smoke: '#efe9df', clot: '#5e1a26',
  probe: '#d8dbe6', ghost: '#6f6a93', normal: '#3f9a68', check: '#c98a0b', alarm: '#a4242f' };

function useTween(target, ms = 700) {
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const from = shown.current, start = performance.now();
    let frame;
    const step = now => {
      const t = Math.min(1, (now - start) / ms), k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = from + (target - from) * k;
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target]);   // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

// One heartbeat a second; the vein's flow follows it (pulsatile) or not (continuous).
const wave = t => Math.sin(2 * Math.PI * t) + 0.45 * Math.sin(4 * Math.PI * t + 0.6);

// Blood speed along the vein for a grade, in cm/s at time t (seconds): + toward the heart (down the screen).
function bloodSpeed(grade, speed, t) {
  const s = Math.max(6, Math.abs(speed));
  if (grade === 1) return s * (0.85 + 0.12 * wave(t));
  if (grade === 2) return s * (0.45 + 0.5 * wave(t));
  if (grade === 3) return s * 0.18 * wave(t);
  return -s * (0.6 + 0.35 * wave(t));
}

// How flat the vein is under the probe at time t since a press started (1 = round, 0 = flat).
function pressOf(t, clot) {
  if (t == null) return 0;
  const { down, hold, up } = PRESS;
  const k = t < down ? t / down : t < down + hold ? 1 : t < down + hold + up ? 1 - (t - down - hold) / up : 0;
  const ease = k * k * (3 - 2 * k);
  return ease * (clot ? 0.12 : 0.92);
}

const LABELS = [
  { id: 'vein', text: 'Jugular vein' }, { id: 'artery', text: 'Carotid artery' },
  { id: 'heart', text: '↓ to the heart' }, { id: 'ghost', text: 'Before flight' }, { id: 'clot', text: 'Clot' },
];

export function Vein3D({ shape, level = 'normal', compress = 0, preArea = null, title }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const shapeRef = useRef(shape);
  const [status, setStatus] = useState('loading');
  const area = useTween(shape.area);
  shapeRef.current = shape;

  useEffect(() => {
    const container = containerRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setStatus('webgl-error'); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 60);
    camera.position.set(4.2, 2.2, 9.5);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.2, 0, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;              // the wheel scrolls the page; drag rotates the neck
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b9baa, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe1edff, 1.2); fill.position.set(-3, 2, -4); scene.add(fill);
    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0, ...extra });

    // the carotid: an opaque tube with a thick wall, open at the ends so its lumen shows
    const artery = new THREE.Group();
    artery.add(new THREE.Mesh(new THREE.CylinderGeometry(CAROTID_R, CAROTID_R, LENGTH, 48, 1, true), mat(COLORS.artery, { side: THREE.DoubleSide })));
    const ring = new THREE.Mesh(new THREE.RingGeometry(CAROTID_R * 0.62, CAROTID_R, 48).rotateX(-Math.PI / 2), mat(COLORS.artery, { side: THREE.DoubleSide }));
    ring.position.y = LENGTH / 2;
    artery.add(ring);
    artery.position.x = CAROTID_X;
    // the jugular: see-through oval, unit radius, scaled to the area each frame
    const veinWall = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, LENGTH, 64, 1, true),
      mat(COLORS.vein, { transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthWrite: false }));
    const veinRim = new THREE.Mesh(new THREE.RingGeometry(0.93, 1, 64).rotateX(-Math.PI / 2), mat(COLORS.vein, { side: THREE.DoubleSide }));
    veinRim.position.y = LENGTH / 2;
    const vein = new THREE.Group();
    vein.add(veinWall, veinRim);
    vein.position.x = VEIN_X;
    // the pre-flight vein at the top end, dashed
    const ghostPts = Array.from({ length: 65 }, (_, i) => { const a = i / 64 * Math.PI * 2; return new THREE.Vector3(Math.cos(a), 0, Math.sin(a)); });
    const ghost = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ghostPts), new THREE.LineDashedMaterial({ color: COLORS.ghost, dashSize: 0.12, gapSize: 0.09 }));
    ghost.computeLineDistances();
    ghost.position.set(VEIN_X, LENGTH / 2 + 0.02, 0);
    // blood cells and slow-blood "smoke", in the vein's unit oval (scaled with it)
    const rnd = (() => { let s = 7; return () => (s = (s * 16807) % 2147483647) / 2147483647; })();
    const seed = n => Array.from({ length: n }, () => ({ a: rnd() * Math.PI * 2, r: Math.sqrt(rnd()) * 0.82, y: (rnd() - 0.5) * LENGTH, j: rnd() * 10 }));
    const cells = seed(BLOOD), smoke = seed(SMOKE);
    const bloodMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.075, 10, 8), mat(COLORS.blood), BLOOD);
    const smokeMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.13, 8, 6), mat(COLORS.smoke, { transparent: true, opacity: 0.55, depthWrite: false }), SMOKE);
    // the clot: a lumpy mass on the vein's wall
    const clotGeo = new THREE.IcosahedronGeometry(1, 3);
    const cp = clotGeo.attributes.position, v3 = new THREE.Vector3();
    for (let i = 0; i < cp.count; i++) { v3.fromBufferAttribute(cp, i); v3.multiplyScalar(0.85 + 0.25 * Math.sin(v3.x * 5 + v3.y * 3) * Math.cos(v3.z * 4)); cp.setXYZ(i, v3.x, v3.y, v3.z); }
    clotGeo.computeVertexNormals();
    const clot = new THREE.Mesh(clotGeo, mat(COLORS.clot, { roughness: 0.95 }));
    // the probe above the neck, pressing toward the vein (from +z)
    const probe = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.1, 0.7), mat(COLORS.probe, { roughness: 0.5 }));
    const probeTip = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 0.12), mat('#7e86a6'));
    const probeGroup = new THREE.Group();
    probeGroup.add(probe, probeTip);
    probeTip.position.z = -0.4;
    // an arrow down the vein: the way to the heart
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.5, 24).rotateX(Math.PI), mat('#4f5874'));
    arrow.position.set(VEIN_X, -LENGTH / 2 - 0.5, 0);
    scene.add(artery, vein, ghost, bloodMesh, smokeMesh, clot, probeGroup, arrow);

    const view = { anchors: {}, pressStart: null, area: 80, ghostArea: null, level: 'normal' };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), pos = new THREE.Vector3(), scl = new THREE.Vector3();
    let last = performance.now();
    view.frame = now => {
      const dt = view.still ? 0 : Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now;
      const t = now / 1000, s = shapeRef.current;
      const r = radiusOf(view.area) * MM;
      const rx = r * Math.sqrt(OVAL), rzRound = r / Math.sqrt(OVAL);
      const pt = view.pressStart == null ? null : t - view.pressStart;
      if (pt != null && pt > PRESS.down + PRESS.hold + PRESS.up) view.pressStart = null;
      const flat = pressOf(pt, s.clot);
      const rz = Math.max(0.03, rzRound * (1 - flat));
      vein.scale.set(rx, 1, rz);
      vein.position.z = rzRound - rz;            // pressed from the front: the back wall stays put
      veinRim.material.color.set(COLORS[view.level] ?? COLORS.vein);
      // the probe: resting above the neck, down onto the vein while pressing
      const rest = rzRound * 2 + 1.0, touch = rzRound * 2 - 2 * rz + 0.45;
      probeGroup.position.set(VEIN_X - 0.3, 0.6, rest + (touch - rest) * (pt == null ? 0 : Math.min(1, flat / (s.clot ? 0.12 : 0.92))));
      // the pre-flight outline
      if (view.ghostArea) {
        const g = radiusOf(view.ghostArea) * MM;
        ghost.scale.set(g * Math.sqrt(OVAL), 1, g / Math.sqrt(OVAL));
        ghost.position.z = 0;
        ghost.visible = Math.abs(view.ghostArea - view.area) > 3;
      } else ghost.visible = false;
      // the clot sits on the left of the lumen, mid-stretch, and fills most of it
      clot.visible = s.clot;
      clot.scale.set(rx * 0.75, 1.3, rz * 0.85);
      clot.position.set(VEIN_X - rx * 0.15, 0.4, vein.position.z);
      // blood: along the vein, the clot stops it
      const v = s.clot ? 0 : bloodSpeed(s.grade, s.speed, t) * SPEED;
      const scatter = s.grade === 3 || s.clot ? 0.35 : 0.05;
      cells.forEach((c, i) => {
        c.y -= v * dt + (Math.sin(t * 3 + c.j) * scatter) * dt;
        if (c.y < -LENGTH / 2) c.y += LENGTH; else if (c.y > LENGTH / 2) c.y -= LENGTH;
        pos.set(VEIN_X + Math.cos(c.a) * c.r * rx, c.y, vein.position.z + Math.sin(c.a) * c.r * rz);
        m4.compose(pos, q, scl.set(1, 1, 1)); bloodMesh.setMatrixAt(i, m4);
      });
      bloodMesh.instanceMatrix.needsUpdate = true;
      // smoke: as many puffs as the echoes say, drifting slowly
      const puffs = s.clot ? SMOKE : s.echo === 2 ? SMOKE : s.echo === 1 ? Math.round(SMOKE * 0.4) : 0;
      smokeMesh.count = puffs;
      smoke.forEach((c, i) => {
        if (i >= puffs) return;
        c.y -= v * 0.25 * dt; c.a += 0.15 * dt;
        if (c.y < -LENGTH / 2) c.y += LENGTH; else if (c.y > LENGTH / 2) c.y -= LENGTH;
        pos.set(VEIN_X + Math.cos(c.a) * c.r * rx, c.y, vein.position.z + Math.sin(c.a) * c.r * rz);
        m4.compose(pos, q, scl.setScalar(0.8 + 0.4 * Math.sin(c.j + t))); smokeMesh.setMatrixAt(i, m4);
      });
      smokeMesh.instanceMatrix.needsUpdate = true;
      // the artery beats once a second
      const beat = 1 + 0.035 * Math.max(0, Math.sin(2 * Math.PI * t));
      artery.scale.set(beat, 1, beat);
      Object.assign(view.anchors, {
        vein: new THREE.Vector3(VEIN_X + rx, -LENGTH / 2 + 0.6, vein.position.z),
        artery: new THREE.Vector3(CAROTID_X - CAROTID_R, -LENGTH / 2 + 1.2, 0),
        heart: new THREE.Vector3(VEIN_X + 0.35, -LENGTH / 2 - 0.55, 0),
        ghost: ghost.visible ? new THREE.Vector3(VEIN_X + radiusOf(view.ghostArea) * MM * Math.sqrt(OVAL), LENGTH / 2 + 0.1, 0) : null,
        clot: s.clot ? new THREE.Vector3(VEIN_X - rx * 0.15, 0.4 + 1.3, vein.position.z) : null,
      });
    };
    viewRef.current = view;

    const labels = Object.fromEntries([...container.querySelectorAll('[data-anchor]')].map(el => [el.dataset.anchor, el]));
    const resize = () => {
      const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let inView = true, frame = 0;
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(e => { inView = e[0].isIntersecting; });
    visibility?.observe(container);
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const p = new THREE.Vector3();
    const animate = now => {
      if (inView && !document.hidden) {
        view.still = motion.matches;          // reduced motion: the blood holds still, the shapes still change
        view.frame(now ?? performance.now());
        controls.update();
        renderer.render(scene, camera);
        const w = container.clientWidth, h = container.clientHeight;
        for (const [id, el] of Object.entries(labels)) {
          const a = view.anchors[id];
          el.style.display = a ? '' : 'none';
          if (!a) continue;
          p.copy(a).project(camera);
          el.style.transform = `translate(${(p.x + 1) / 2 * w}px, ${(1 - p.y) / 2 * h}px)`;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    setStatus('ready');
    animate(performance.now());
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); visibility?.disconnect(); controls.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose(); renderer.domElement.remove(); viewRef.current = null;
    };
  }, []);

  useEffect(() => { if (viewRef.current) Object.assign(viewRef.current, { area, ghostArea: preArea, level }); }, [area, preArea, level, status]);
  useEffect(() => { if (compress && viewRef.current) viewRef.current.pressStart = performance.now() / 1000; }, [compress]);

  return <div ref={containerRef} className="vein-3d" role="img" aria-label={title}>
    {LABELS.map(l => <span key={l.id} className="vein-3d-label" data-anchor={l.id} data-id={l.id}><i/>{l.text}</span>)}
    {status === 'webgl-error' && <div className="vein-3d-message" role="alert">The 3D viewer could not start. Check that WebGL is enabled in the browser.</div>}
  </div>;
}

export const PRESS_SECONDS = PRESS.down + PRESS.hold + PRESS.up;
