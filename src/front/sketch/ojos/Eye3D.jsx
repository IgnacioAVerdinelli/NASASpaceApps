import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// A 3D eye cut in half, the way an OCT or an anatomy atlas shows it, deformed by one exam's changes
// (data/eyes.js eyeShape). Same renderer, lights and materials as the body viewer (body-3d/BodyViewer.jsx).
// Units: the eyeball radius is 1 (about 12 mm). The changes are tens of micrometres, so they are drawn about
// 40 times larger (GAIN) to be visible; the numbers are on the page.
const GAIN = { disc: 0.0034, discMax: 0.3, choroid: 0.0009, sheath: 0.08, flatten: 0.11, folds: 0.014 };
const SCLERA_T = 0.07, CHOROID_T = 0.035, RETINA_T = 0.045;
const NERVE_R = 0.13, SHEATH_R = 0.21;
const DISC_WIDTH = 0.2;                       // angular half-width of the disc swelling, in radians
const BACK = 62 * Math.PI / 180;              // retina and choroid cover the back of the eye, up to here from the front
const COLORS = { sclera: '#f4f1ea', choroid: '#b5525e', retina: '#df8f6e', disc: '#f5e3b3', vitreous: '#e8f1f8', nerve: '#f2c14e',
  sheath: '#cfc8ef', iris: '#5d6f9e', lens: '#cfe6f3', cornea: '#dff0fb', retinaCut: '#f3c7a8' };
const CLASS_COLORS = { none: '#eaa07c', A: '#C27800', B: '#A4242F' };     // the retina's own colour, --warn-dot, --crit-dot

function useTween(target, ms = 700) {
  const [value, setValue] = useState(target);
  const shown = useRef(target);
  useEffect(() => {
    const from = shown.current, start = performance.now();
    let frame;
    const step = now => {
      const t = Math.min(1, (now - start) / ms), k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const next = Object.fromEntries(Object.keys(target).map(key => [key, from[key] + (target[key] - from[key]) * k]));
      shown.current = next;
      setValue(next);
      if (t < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [target.disc, target.choroid, target.sheath, target.flatten, target.folds]);    // eslint-disable-line react-hooks/exhaustive-deps
  return value;
}

// Radius of a layer in direction `dir` (unit vector; the eye looks to +z, the optic nerve leaves at -z).
function surfacePoint(dir, radius, s, inner) {
  const theta = Math.acos(Math.max(-1, Math.min(1, -dir.z)));          // angle from the back of the eye
  let r = radius;
  if (inner) {                                                          // the retina: swelling at the disc, folds around it
    r -= Math.min(GAIN.discMax, GAIN.disc * s.disc) * Math.exp(-((theta / DISC_WIDTH) ** 2));
    if (theta > 0.22) r -= GAIN.folds * s.folds * Math.sin(theta * 38) * Math.exp(-(((theta - 0.45) / 0.25) ** 2));
  }
  const p = dir.clone().multiplyScalar(r);
  const back = -(radius - GAIN.flatten * s.flatten * radius);          // the back of the globe pushed flat
  if (p.z < back) p.z = back;
  return p;
}

function deformSphere(geometry, base, radius, s, inner) {
  const pos = geometry.attributes.position, dir = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    dir.fromArray(base, i * 3).normalize();
    const p = surfacePoint(dir, radius, s, inner);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  pos.needsUpdate = true;
  geometry.computeVertexNormals();
}

// A cap of a sphere around the back of the eye (or the whole sphere minus the cornea), pole at -z.
function capGeometry(thetaLength, segments = 96) {
  const g = new THREE.SphereGeometry(1, segments, segments * 0.66, 0, Math.PI * 2, 0, thetaLength);
  g.rotateX(-Math.PI / 2);                    // the +y pole goes to -z, the back of the eye
  return g;
}

// The cut face: bands between two layers in the plane y = 0, from angle a0 to a1 (measured from the front, +z).
function bandShape(outer, inner, a0, a1, steps = 120) {
  const shape = new THREE.Shape();
  const at = (fn, a) => fn(new THREE.Vector3(Math.sin(a), 0, Math.cos(a)));
  for (let i = 0; i <= steps; i++) {
    const p = at(outer, a0 + (a1 - a0) * i / steps);
    i ? shape.lineTo(p.x, p.z) : shape.moveTo(p.x, p.z);
  }
  for (let i = steps; i >= 0; i--) {
    const p = at(inner, a0 + (a1 - a0) * i / steps);
    shape.lineTo(p.x, p.z);
  }
  return shape;
}

function capMesh(material) {
  const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  mesh.rotation.x = Math.PI / 2;              // shape (x, z) drawn in XY, laid onto the cut plane y = 0
  mesh.position.y = -0.001;
  mesh.renderOrder = 2;
  return mesh;
}

const LABELS = [
  { id: 'cornea', text: 'Cornea' }, { id: 'lens', text: 'Lens' }, { id: 'sclera', text: 'Sclera' },
  { id: 'choroid', text: 'Choroid' }, { id: 'retina', text: 'Retina' }, { id: 'disc', text: 'Optic disc' },
  { id: 'nerve', text: 'Optic nerve' }, { id: 'sheath', text: 'Nerve sheath' },
];

export function Eye3D({ shape, cls = 'none', title }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const [status, setStatus] = useState('loading');
  const s = useTween(shape);

  useEffect(() => {
    const container = containerRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setStatus('webgl-error'); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.localClippingEnabled = true;
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.prepend(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 50);
    camera.position.set(1.75, 3.25, 2.3);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, -0.15, -0.35);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.enableZoom = false;              // the wheel scrolls the page; drag rotates the eye
    controls.minDistance = 2;
    controls.maxDistance = 8;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b9baa, 2.1));
    const key = new THREE.DirectionalLight(0xffffff, 2); key.position.set(3, 4, 5); scene.add(key);
    const fill = new THREE.DirectionalLight(0xe1edff, 1.2); fill.position.set(-3, 2, -4); scene.add(fill);

    const cut = [new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)];   // keep the lower half: the eye cut open
    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, clippingPlanes: cut, side: THREE.DoubleSide, ...extra });
    const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, ...extra });

    // shells
    const scleraGeo = capGeometry(Math.PI - 0.62), retinaGeo = capGeometry(Math.PI - BACK);
    const scleraBase = Float32Array.from(scleraGeo.attributes.position.array);
    const retinaBase = Float32Array.from(retinaGeo.attributes.position.array);
    const sclera = new THREE.Mesh(scleraGeo, mat(COLORS.sclera));
    const retinaMat = mat(COLORS.retina, { vertexColors: true });
    retinaGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(retinaGeo.attributes.position.count * 3), 3));
    const retina = new THREE.Mesh(retinaGeo, retinaMat);
    // front of the eye
    const cornea = new THREE.Mesh(new THREE.SphereGeometry(0.46, 48, 24, 0, Math.PI * 2, 0, 0.95).rotateX(Math.PI / 2).translate(0, 0, 0.57),
      mat(COLORS.cornea, { transparent: true, opacity: 0.35, depthWrite: false, roughness: 0.15 }));
    const iris = new THREE.Mesh(new THREE.RingGeometry(0.17, 0.42, 64).translate(0, 0, 0.8), mat(COLORS.iris));
    const pupil = new THREE.Mesh(new THREE.CircleGeometry(0.17, 48).translate(0, 0, 0.799), mat('#1d1b2c'));
    const lens = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), mat(COLORS.lens, { transparent: true, opacity: 0.75, roughness: 0.2 }));
    lens.scale.set(0.34, 0.34, 0.17); lens.position.z = 0.62;
    // optic nerve and sheath
    const nerveLen = 1.3;
    const nerve = new THREE.Mesh(new THREE.CylinderGeometry(NERVE_R, NERVE_R, nerveLen, 40).rotateX(Math.PI / 2), mat(COLORS.nerve));
    const sheathGeo = new THREE.CylinderGeometry(1, 1, nerveLen, 48, 1, true).rotateX(Math.PI / 2);
    const sheath = new THREE.Mesh(sheathGeo, mat(COLORS.sheath, { transparent: true, opacity: 0.55, depthWrite: false }));
    // cut faces
    const caps = {
      sclera: capMesh(flat(COLORS.sclera)), choroid: capMesh(flat(COLORS.choroid)), retina: capMesh(flat(COLORS.retinaCut)),
      nerve: capMesh(flat(COLORS.nerve)),
      sheath: capMesh(flat(COLORS.sheath)),
    };
    const ghost = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineDashedMaterial({ color: '#6f6a93', dashSize: 0.05, gapSize: 0.04 }));
    ghost.position.y = 0.004;
    const eye = new THREE.Group();
    eye.add(sclera, retina, cornea, iris, pupil, lens, nerve, sheath, ghost, ...Object.values(caps));
    scene.add(eye);

    const view = { scleraGeo, retinaGeo, scleraBase, retinaBase, caps, nerve, sheath, ghost, retina, anchors: {} };
    view.update = (st, discColor) => {
      deformSphere(scleraGeo, scleraBase, 1, st, false);
      deformSphere(retinaGeo, retinaBase, 1 - SCLERA_T - CHOROID_T - GAIN.choroid * st.choroid, st, true);
      // the swollen disc in the class colour, the rest of the retina in its own
      // the optic disc is pale, as on a fundus photo; its rim takes the class colour as it swells
      const colors = retinaGeo.attributes.color, base = new THREE.Color(COLORS.retina), pale = new THREE.Color(COLORS.disc), hot = new THREE.Color(discColor), c = new THREE.Color(), d = new THREE.Vector3();
      const swell = Math.min(1, st.disc / 40);
      for (let i = 0; i < colors.count; i++) {
        d.fromArray(retinaBase, i * 3).normalize();
        const t = Math.acos(Math.max(-1, Math.min(1, -d.z)));
        const core = Math.exp(-((t / (DISC_WIDTH * 0.45)) ** 2)), rim = Math.exp(-(((t - DISC_WIDTH * 0.8) / (DISC_WIDTH * 0.45)) ** 2));
        c.copy(base).lerp(hot, rim * swell).lerp(pale, core);
        colors.setXYZ(i, c.r, c.g, c.b);
      }
      colors.needsUpdate = true;
      const chT = CHOROID_T + GAIN.choroid * st.choroid;
      const R = {
        out: d2 => surfacePoint(d2, 1, st, false),
        sclIn: d2 => surfacePoint(d2, 1 - SCLERA_T, st, false),
        chIn: d2 => surfacePoint(d2, 1 - SCLERA_T - chT, st, false),
        retIn: d2 => surfacePoint(d2, 1 - SCLERA_T - chT - RETINA_T, st, true),
      };
      const set = (mesh, shape) => { mesh.geometry.dispose(); mesh.geometry = new THREE.ShapeGeometry(shape, 1); };
      set(caps.sclera, bandShape(R.out, R.sclIn, 0.62, 2 * Math.PI - 0.62));
      set(caps.choroid, bandShape(R.sclIn, R.chIn, BACK, 2 * Math.PI - BACK));
      set(caps.retina, bandShape(R.chIn, d2 => surfacePoint(d2, 1 - SCLERA_T - chT - RETINA_T, st, true), BACK, 2 * Math.PI - BACK));
      const backZ = surfacePoint(new THREE.Vector3(0, 0, -1), 1, st, false).z;
      const sheathR = SHEATH_R + GAIN.sheath * st.sheath;
      nerve.position.z = backZ - nerveLen / 2 + 0.05;
      sheath.position.z = nerve.position.z;
      sheath.scale.set(sheathR, sheathR, 1);
      const rect = (x0, x1) => { const r = new THREE.Shape(); r.moveTo(x0, backZ + 0.05); r.lineTo(x1, backZ + 0.05); r.lineTo(x1, backZ - nerveLen + 0.05); r.lineTo(x0, backZ - nerveLen + 0.05); return r; };
      set(caps.nerve, rect(-NERVE_R, NERVE_R));
      const sh = rect(-sheathR, sheathR); sh.holes.push(new THREE.Path(rect(-NERVE_R, NERVE_R).getPoints()));
      set(caps.sheath, sh);
      // pre-flight outline of the back of the eye and of the retina at the disc, dashed, when they changed
      const pts = [];
      for (let i = 0; i <= 60; i++) { const a = Math.PI * 0.62 + Math.PI * 0.76 * i / 60; pts.push(new THREE.Vector3(Math.sin(a), 0, Math.cos(a))); }
      const flat0 = { disc: 0, choroid: 0, sheath: 0, flatten: 0, folds: 0 };
      const outline = [...pts.map(p => surfacePoint(p, 1, flat0, false)), new THREE.Vector3(NaN, NaN, NaN),
        ...pts.map(p => surfacePoint(p, 1 - SCLERA_T - CHOROID_T - RETINA_T, flat0, true))].filter(p => !Number.isNaN(p.x));
      ghost.geometry.dispose();
      ghost.geometry = new THREE.BufferGeometry().setFromPoints(outline.slice(0, 61));
      const inner = new THREE.BufferGeometry().setFromPoints(outline.slice(61));
      if (!view.ghostInner) { view.ghostInner = new THREE.Line(inner, ghost.material); view.ghostInner.position.y = 0.004; eye.add(view.ghostInner); }
      else { view.ghostInner.geometry.dispose(); view.ghostInner.geometry = inner; }
      ghost.computeLineDistances(); view.ghostInner.computeLineDistances();
      ghost.visible = st.flatten > 0.02;
      view.ghostInner.visible = st.disc > 3 || st.choroid > 3;
      // label anchors
      const at = (fn, deg) => fn(new THREE.Vector3(Math.sin(deg * Math.PI / 180), 0, Math.cos(deg * Math.PI / 180)));
      Object.assign(view.anchors, {
        cornea: new THREE.Vector3(0.25, 0, 1.0), lens: new THREE.Vector3(0.3, 0, 0.62), sclera: at(R.out, 75),
        choroid: at(R.sclIn, 120).lerp(at(R.chIn, 120), 0.5), retina: at(R.chIn, 245).lerp(at(R.retIn, 245), 0.5),
        disc: surfacePoint(new THREE.Vector3(0, 0, -1), 1 - SCLERA_T - chT - RETINA_T, st, true),
        nerve: new THREE.Vector3(0, 0, backZ - 1.05), sheath: new THREE.Vector3(sheathR, 0, backZ - 0.3),
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
    const p = new THREE.Vector3();
    const animate = () => {
      if (inView && !document.hidden) {
        controls.update();
        renderer.render(scene, camera);
        const w = container.clientWidth, h = container.clientHeight;
        for (const [id, el] of Object.entries(labels)) {
          const a = view.anchors[id];
          if (!a) continue;
          p.copy(a).project(camera);
          // A label that would run past the right edge (narrow screens) is drawn to the left of its dot instead.
          const x = (p.x + 1) / 2 * w, flip = x + el.offsetWidth > w - 4;
          if (flip !== el.classList.contains('is-flipped')) el.classList.toggle('is-flipped', flip);
          el.style.transform = `translate(${x}px, ${(1 - p.y) / 2 * h}px)${flip ? ' translateX(-100%)' : ''}`;
        }
      }
      frame = requestAnimationFrame(animate);
    };
    setStatus('ready');
    animate();
    return () => {
      cancelAnimationFrame(frame); observer.disconnect(); visibility?.disconnect(); controls.dispose();
      scene.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
      renderer.dispose(); renderer.domElement.remove(); viewRef.current = null;
    };
  }, []);

  useEffect(() => { viewRef.current?.update(s, CLASS_COLORS[cls] ?? CLASS_COLORS.none); }, [s, cls, status]);

  return <div ref={containerRef} className="eye-3d" role="img" aria-label={title}>
    {LABELS.map(l => <span key={l.id} className="eye-3d-label" data-anchor={l.id} data-id={l.id}><i/>{l.text}</span>)}
    {status === 'webgl-error' && <div className="eye-3d-message" role="alert">The 3D viewer could not start. Check that WebGL is enabled in the browser.</div>}
  </div>;
}
