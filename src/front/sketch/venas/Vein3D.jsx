import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { compressionAt, flowAtTime, PRESS_SECONDS, radiusOf } from '../data/veins.js';
export { PRESS_SECONDS };

const MM = 0.2, LENGTH = 6, VEIN_X = 0.82, ARTERY_X = -1.48, OVAL = 1.42, STREAMS = 88;

// An opened, slightly curved vessel wall. The opening exposes the lumen; the
// geometry is illustrative, not reconstructed from a patient's ultrasound.
function vesselWall(inner = false) {
  const positions = [], uvs = [], indices = [], rows = 56, columns = 56;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= columns; i++) {
    const t = j / rows, a = Math.PI * (0.84 + i / columns * 1.32);
    const r = (inner ? 0.925 : 1) * (1 + 0.035 * Math.sin(t * 9 + a * 2));
    positions.push(Math.cos(a) * r + 0.09 * Math.sin(t * Math.PI * 1.5), (t - 0.5) * LENGTH, Math.sin(a) * r + 0.04 * Math.cos(t * 7));
    uvs.push(i / columns, t);
    if (j < rows && i < columns) { const n = j * (columns + 1) + i; indices.push(n, n + 1, n + columns + 1, n + 1, n + columns + 2, n + columns + 1); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices); g.computeVertexNormals(); return g;
}

function tissueTexture() {
  const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
  const ctx = canvas.getContext('2d'), image = ctx.createImageData(256, 256);
  let seed = 19;
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    seed = seed * 16807 % 2147483647;
    const fiber = Math.sin(y * 0.23 + Math.sin(x * 0.08) * 3), v = 207 + seed / 2147483647 * 34 + fiber * 12;
    const n = (y * 256 + x) * 4;
    image.data[n] = image.data[n + 1] = image.data[n + 2] = v; image.data[n + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

export function Vein3D({ shape, level = 'normal', compress = 0, preArea = null, compare = true, paused = false, title }) {
  const containerRef = useRef(null), shapeRef = useRef(shape), viewRef = useRef(null);
  const [status, setStatus] = useState('loading'); shapeRef.current = shape;
  useEffect(() => {
    const container = containerRef.current;
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setStatus('webgl-error'); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    renderer.setClearColor('#0c1b23', 1);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y'; container.prepend(renderer.domElement);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
    camera.position.set(5.6, 3.9, 11.6);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(-0.18, 0, 0); controls.enableDamping = true; controls.enablePan = controls.enableZoom = false;
    controls.minPolarAngle = 0.4; controls.maxPolarAngle = Math.PI * 0.85; controls.update();
    scene.add(new THREE.HemisphereLight('#dfeef7', '#3c2531', 1.7));
    const key = new THREE.DirectionalLight('#fff3e1', 2.7); key.position.set(-4, 5, 7); scene.add(key);
    const rim = new THREE.DirectionalLight('#a7e4ed', 1.5); rim.position.set(4, 1, -3); scene.add(rim);
    const surface = tissueTexture();
    const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, map: surface, bumpMap: surface, bumpScale: 0.025, roughness: 0.64, metalness: 0, side: THREE.DoubleSide, ...extra });
    const sheath = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.45, LENGTH - 0.2, 80, 1, true, Math.PI * 0.67, Math.PI * 1.15), mat('#ac8580', { transparent: true, opacity: 0.1, depthWrite: false }));
    sheath.position.set(-0.35, 0, -0.35); sheath.scale.z = 0.66; scene.add(sheath);
    const artery = new THREE.Group(); artery.position.set(ARTERY_X, 0, -0.14);
    artery.add(new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.64, LENGTH, 64, 20, true), mat('#b56160')));
    for (const y of [-LENGTH / 2, LENGTH / 2]) {
      const cap = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.62, 64).rotateX(-Math.PI / 2), mat('#df9e8f')); cap.position.y = y; artery.add(cap);
      const lumen = new THREE.Mesh(new THREE.CircleGeometry(0.4, 48).rotateX(-Math.PI / 2), mat('#51232c')); lumen.position.y = y + (y > 0 ? 0.002 : -0.002); artery.add(lumen);
    }
    scene.add(artery);
    const vein = new THREE.Group(); vein.position.x = VEIN_X;
    vein.add(new THREE.Mesh(vesselWall(), mat('#a993a7')));
    vein.add(new THREE.Mesh(vesselWall(true), mat('#804d60', { roughness: 0.4 })));
    const capGeometry = new THREE.RingGeometry(0.925, 1.015, 64).rotateX(-Math.PI / 2);
    for (const y of [-LENGTH / 2, LENGTH / 2]) { const cap = new THREE.Mesh(capGeometry, mat('#c1a2ad')); cap.position.y = y; vein.add(cap); }
    for (const theta of [Math.PI * 0.84, Math.PI * 2.16]) {
      const edge = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, LENGTH, 10), mat('#dfbdc4'));
      edge.position.set(Math.cos(theta) * 0.96, 0, Math.sin(theta) * 0.96); vein.add(edge);
    }
    scene.add(vein);
    const clotProfile = Array.from({ length: 40 }, (_, i) => { const t = i / 39; return new THREE.Vector2(0.96 * Math.sin(Math.PI * t) ** 0.48, (t - 0.5) * 3.5); });
    const clotGeometry = new THREE.LatheGeometry(clotProfile, 56), vertices = clotGeometry.attributes.position;
    for (let i = 0; i < vertices.count; i++) {
      const x = vertices.getX(i), y = vertices.getY(i), z = vertices.getZ(i), k = 1 + 0.07 * Math.sin(x * 4.3 + y * 3.7) * Math.sin(z * 5.1 + y * 2.1);
      vertices.setXYZ(i, x * k, y, z * k);
    }
    clotGeometry.computeVertexNormals();
    const clot = new THREE.Mesh(clotGeometry, mat('#663f40', { roughness: 0.92, bumpScale: 0.065 })); scene.add(clot);
    const outline = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 100 }, (_, i) => { const a = i / 100 * Math.PI * 2; return new THREE.Vector3(Math.cos(a), LENGTH / 2 + 0.025, Math.sin(a)); })), new THREE.LineDashedMaterial({ color: '#95d9d1', dashSize: 0.09, gapSize: 0.07 }));
    outline.computeLineDistances(); outline.position.x = VEIN_X; scene.add(outline);
    const scanPlane = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 3.4).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#71dacd', side: THREE.DoubleSide, transparent: true, opacity: 0.07, depthWrite: false })); scanPlane.position.set(-0.1, 0.55, 0);
    const scanEdge = new THREE.LineSegments(new THREE.EdgesGeometry(scanPlane.geometry), new THREE.LineBasicMaterial({ color: '#7ee0d3', transparent: true, opacity: 0.45 })); scanEdge.position.copy(scanPlane.position); scene.add(scanPlane, scanEdge);
    // Thin tracers, not red-cell-sized balls. 5 mm/unit and 0.08 units/(cm/s)
    // slow the model's blood motion by 25 times so its direction can be seen.
    let seed = 11; const random = () => (seed = seed * 16807 % 2147483647) / 2147483647;
    const tracers = Array.from({ length: STREAMS }, () => ({ a: random() * Math.PI * 2, r: Math.sqrt(random()) * 0.7, y: (random() - 0.5) * LENGTH, size: 0.6 + random() * 0.6 }));
    const streams = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.014, 0.2, 3, 5), mat('#f0a5a1', { emissive: '#7e303e', emissiveIntensity: 0.3, roughness: 0.4 }), STREAMS); scene.add(streams);
    const echoPositions = new Float32Array(90 * 3);
    for (let i = 0; i < 90; i++) { const a = random() * Math.PI * 2, r = Math.sqrt(random()) * 0.75; echoPositions.set([Math.cos(a) * r, (random() - 0.5) * LENGTH, Math.sin(a) * r], i * 3); }
    const echoGeometry = new THREE.BufferGeometry(); echoGeometry.setAttribute('position', new THREE.BufferAttribute(echoPositions, 3));
    const echoes = new THREE.Points(echoGeometry, new THREE.PointsMaterial({ color: '#dcc6af', size: 0.035, transparent: true, opacity: 0.4, depthWrite: false })); scene.add(echoes);
    const probe = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.22), mat('#d7e2e6')); scene.add(probe);
    const view = { area: shapeRef.current.area, preArea: null, compare: true, paused: false, pressStart: null, time: 0 }; viewRef.current = view;
    const matrix = new THREE.Matrix4(), point = new THREE.Vector3(), scale = new THREE.Vector3(), rotation = new THREE.Quaternion();
    const labels = Object.fromEntries([...container.querySelectorAll('[data-anchor]')].map(el => [el.dataset.anchor, el]));
    const project = new THREE.Vector3();
    const resize = () => { const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    const observer = new ResizeObserver(resize); observer.observe(container); resize();
    let visible = true, frame, last = performance.now();
    const intersection = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; }); intersection.observe(container);
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    function animate(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (visible && !document.hidden) {
        const s = shapeRef.current;
        if (!view.paused && !reduce.matches) view.time += dt;
        view.area += (s.area - view.area) * Math.min(1, dt * 7);
        const elapsed = view.pressStart == null ? null : (now - view.pressStart) / 1000, flat = compressionAt(elapsed, s.clot);
        const r = radiusOf(view.area) * MM, rx = r * Math.sqrt(OVAL), rz = r / Math.sqrt(OVAL), thickness = Math.max(0.035, rz * (1 - flat)), z = rz - thickness;
        vein.scale.set(rx, 1, thickness); vein.position.z = z;
        clot.visible = s.clot; clot.scale.set(rx * 0.96, 1, thickness * 0.97); clot.position.set(VEIN_X, 0.1, z);
        echoes.visible = !s.clot && s.echo > 0; echoes.material.opacity = s.echo === 2 ? 0.65 : 0.24; echoes.scale.set(rx, 1, thickness); echoes.position.set(VEIN_X, 0, z);
        const g = radiusOf(view.preArea || view.area) * MM; outline.visible = view.compare && !!view.preArea; outline.scale.set(g * Math.sqrt(OVAL), 1, g / Math.sqrt(OVAL));
        const velocity = flowAtTime(s, view.time) * 0.08; streams.visible = !s.clot;
        tracers.forEach((p, i) => {
          if (!view.paused && !reduce.matches) p.y -= velocity * dt;
          if (p.y < -LENGTH / 2) p.y += LENGTH; if (p.y > LENGTH / 2) p.y -= LENGTH;
          point.set(VEIN_X + Math.cos(p.a) * p.r * rx + 0.07 * Math.sin((p.y / LENGTH + 0.5) * Math.PI * 1.5), p.y, z + Math.sin(p.a) * p.r * thickness);
          matrix.compose(point, rotation, scale.set(1, p.size * (flat > 0.8 ? 0.3 : 1), 1)); streams.setMatrixAt(i, matrix);
        }); streams.instanceMatrix.needsUpdate = true;
        const beat = view.paused || reduce.matches ? 1 : 1 + 0.018 * Math.sin(view.time * Math.PI * 2); artery.scale.set(beat, 1, beat);
        probe.visible = elapsed != null && elapsed < PRESS_SECONDS; probe.position.set(VEIN_X, 0.55, rz + 0.8 - flat * 0.5);
        const anchors = { vein: new THREE.Vector3(VEIN_X + rx * 0.8, -2.25, z), artery: new THREE.Vector3(ARTERY_X - 0.5, 1.7, 0), clot: s.clot ? new THREE.Vector3(VEIN_X, 0.1, z + thickness) : null };
        controls.update(); renderer.render(scene, camera);
        for (const [name, label] of Object.entries(labels)) { label.hidden = !anchors[name]; if (!anchors[name]) continue; project.copy(anchors[name]).project(camera);
          // Near the right edge (narrow screens) the label wraps inside the picture instead of being cut off.
          const x = (project.x + 1) / 2 * container.clientWidth;
          label.style.maxWidth = `${Math.max(64, Math.min(155, container.clientWidth - x - 8))}px`;
          label.style.transform = `translate(${x}px,${(1 - project.y) / 2 * container.clientHeight}px)`; }
      }
      frame = requestAnimationFrame(animate);
    }
    setStatus('ready'); frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); intersection.disconnect(); controls.dispose(); scene.traverse(o => { o.geometry?.dispose(); o.material?.dispose(); }); surface.dispose(); renderer.dispose(); renderer.domElement.remove(); viewRef.current = null; };
  }, []);
  useEffect(() => { if (viewRef.current) Object.assign(viewRef.current, { preArea, compare, paused }); }, [preArea, compare, paused, status]);
  useEffect(() => { if (viewRef.current) viewRef.current.pressStart = compress ? performance.now() : null; }, [compress]);
  return <div ref={containerRef} className="vein-3d" role="img" aria-label={title} data-level={level}>
    <span className="vein-3d-caption">ANATOMICAL CUTAWAY <small>Illustrative geometry</small></span>
    <span className="vein-3d-label" data-anchor="vein">Internal jugular vein</span>
    <span className="vein-3d-label" data-anchor="artery">Carotid artery</span>
    <span className="vein-3d-label vein-clot-label" data-anchor="clot" hidden>Possible clot <small>shape illustrative</small></span>
    <div className="vein-3d-footer"><span>30 mm segment · drag to rotate</span><span>{shape.clot ? 'No flow in this model' : shape.grade === 4 ? '↑ Flow toward the head' : shape.grade === 3 ? '↕ No net forward flow' : '↓ Flow toward the heart'}</span></div>
    {status === 'webgl-error' && <div className="vein-3d-message" role="alert">The 3D viewer could not start. The ultrasound illustration and values remain available.</div>}
  </div>;
}
