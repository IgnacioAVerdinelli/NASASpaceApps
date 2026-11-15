// The crew-select 3D scene. Two arrangements of the same crew members:
//   - "module": floating inside a station module, drifting slowly in microgravity;
//   - "lineup": standing side by side on light pedestals, like a character select screen.
// Switching moves every crew member and the camera in one continuous motion. The scene reports where each crew
// member is on screen (onFrame) so the page can place real HTML buttons over them; it never draws text itself.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { buildAstronaut } from './astronaut.js';
import { buildModule } from './module.js';

const MODULE_POSES = [
  { p: [-0.56, 1.0, 0.35], r: [0.04, 0.55, 0.05] },
  { p: [0.56, 1.08, -0.9], r: [0.0, -0.5, -0.1] },
  { p: [-0.12, 1.64, -2.3], r: [0.1, 0.3, 1.45] },
  { p: [-0.56, 0.92, -3.5], r: [0.0, 0.9, 0.15] },
  { p: [0.5, 0.98, -4.6], r: [0.1, -0.3, -2.95] },
  { p: [0.0, 1.0, -5.8], r: [0.0, 0.2, 0.3] },
];
const MODULE_CAMERA = { position: new THREE.Vector3(0, 1.18, 3.4), target: new THREE.Vector3(0, 1.0, -3), fov: 52 };
const LINEUP_FOV = 26;
const LINEUP_SPAN = 1.95;             // metres of height visible in the lineup
const RING = { radius: 2.2, step: 0.74, shown: 2 };   // lineup carousel: a ring seen from outside; ±2 neighbours
const DURATION = 1.2;                 // seconds for a view change
const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

function pedestalTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(28,48,90,.38)');
  grad.addColorStop(0.55, 'rgba(28,48,90,.12)');
  grad.addColorStop(1, 'rgba(28,48,90,0)');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class CrewScene {
  constructor(container, { onHover = () => {}, onPick = () => {}, onSpin = () => {}, onFrame = () => {}, reducedMotion = false } = {}) {
    this.container = container;
    this.callbacks = { onHover, onPick, onSpin, onFrame };
    this.reducedMotion = reducedMotion;
    this.members = [];          // { id, pivot, pedestal, from, to, phase }
    this.view = 'lineup';
    this.selected = null;
    this.hovered = null;
    this.transition = null;
    this.carouselIndex = 0;
    this.ringPos = 0;            // which crew member (fractional index) faces the camera
    this.ringTarget = 0;
    this.ringVel = 0;
    this.drag = null;
    this.lastTime = 0;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    const scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(renderer);
    this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.55;
    const key = new THREE.DirectionalLight('#FFFFFF', 1.6);
    key.position.set(1.5, 3.5, 4);
    const rimLight = new THREE.DirectionalLight('#C9D6FF', 1.1);
    rimLight.position.set(-3, 2, -4);
    scene.add(key, rimLight);
    this.scene = scene;

    this.module = buildModule();
    scene.add(this.module);
    this.moduleFade = 0;
    this.module.visible = false;

    this.pedestalMap = pedestalTexture();
    this.pedestalGeo = new THREE.PlaneGeometry(1, 1);
    this.ringGeo = new THREE.RingGeometry(0.36, 0.385, 64);

    this.camera = new THREE.PerspectiveCamera(MODULE_CAMERA.fov, 1, 0.05, 60);
    this.camera.position.copy(MODULE_CAMERA.position);
    this.cameraTarget = MODULE_CAMERA.target.clone();
    this.camera.lookAt(this.cameraTarget);
    this.cameraFrom = null;

    this.raycaster = new THREE.Raycaster();
    this.pointer = null;
    this.clock = new THREE.Clock();
    this.size = { width: 1, height: 1 };

    this.onPointerMove = event => {
      const rect = renderer.domElement.getBoundingClientRect();
      this.pointer = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      // Dragging sideways turns the ring; one crew member per ~sixth of the stage width.
      if (this.drag) {
        const dx = event.clientX - this.drag.x;
        if (Math.abs(dx) > 6) this.drag.moved = true;
        if (this.drag.moved) { this.ringPos = this.drag.pos - dx / Math.max(120, rect.width / 6); this.ringTarget = this.ringPos; }
      }
    };
    this.onPointerDown = event => {
      if (this.view !== 'lineup' || !this.members.length) return;
      this.drag = { x: event.clientX, pos: this.ringPos, moved: false };
    };
    this.onPointerUp = () => {
      const drag = this.drag;
      this.drag = null;
      if (!drag?.moved) return;
      this.suppressClick = true;
      this.ringTarget = Math.round(this.ringPos);
      const n = this.members.length;
      this.callbacks.onSpin(this.members[((this.ringTarget % n) + n) % n].id);
    };
    this.onPointerLeave = () => { this.pointer = null; this.setHover(null); };
    this.onClick = event => {
      if (this.suppressClick) { this.suppressClick = false; return; }
      this.onPointerMove(event);
      const id = this.pick();
      if (id) this.callbacks.onPick(id);
    };
    renderer.domElement.addEventListener('pointermove', this.onPointerMove);
    renderer.domElement.addEventListener('pointerleave', this.onPointerLeave);
    renderer.domElement.addEventListener('click', this.onClick);
    renderer.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointerup', this.onPointerUp);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    renderer.setAnimationLoop(() => this.frame());
  }

  // ------------------------------------------------------------ crew

  async setCrew(list) {
    const token = (this.crewToken = Symbol('crew'));
    const built = await Promise.all(list.map(({ id, look }) => buildAstronaut(look, id)));
    if (token !== this.crewToken || this.disposed) { built.forEach(p => p.userData.dispose()); return; }
    this.members.forEach(m => { this.scene.remove(m.pivot, m.pedestal); m.pivot.userData.dispose(); m.pedestal.children.forEach(c => c.material.dispose()); });
    this.members = list.map(({ id }, i) => {
      const pivot = built[i];
      pivot.userData.id = id;
      const pedestal = new THREE.Group();
      const shadow = new THREE.Mesh(this.pedestalGeo, new THREE.MeshBasicMaterial({ map: this.pedestalMap, transparent: true, depthWrite: false }));
      shadow.rotation.x = -Math.PI / 2; shadow.scale.setScalar(1.3);
      const ring = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0.9, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.002;
      pedestal.add(shadow, ring);
      pedestal.visible = false;
      this.scene.add(pivot, pedestal);
      return { id, pivot, pedestal, ring, phase: i * 1.7, index: i };
    });
    this.layout(true);
  }

  // The resting transform of each crew member in a view.
  poses(view) {
    const n = this.members.length;
    if (view === 'module') {
      return this.members.map((m, i) => {
        const pose = MODULE_POSES[i % MODULE_POSES.length];
        return { position: new THREE.Vector3(...pose.p), quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(...pose.r)) };
      });
    }
    return this.members.map((m, i) => this.ringPose(m, i));
  }

  // Signed distance (in crew members) from the front of the ring, the short way round.
  ringOffset(i) {
    const n = this.members.length;
    let d = (((i - this.ringPos) % n) + n) % n;
    if (d > n / 2) d -= n;
    return d;
  }

  ringPose(m, i) {
    const d = this.ringOffset(i);
    const a = d * RING.step;
    const scale = THREE.MathUtils.clamp((RING.shown + 0.6 - Math.abs(d)) / 0.6, 0, 1);
    return {
      position: new THREE.Vector3(Math.sin(a) * RING.radius, m.pivot.userData.height / 2 + 0.02, (Math.cos(a) - 1) * RING.radius),
      quaternion: new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -a * 0.45, 0)),
      scale,
    };
  }

  lineupGeometry() {
    const aspect = this.size.width / this.size.height;
    const distance = LINEUP_SPAN / (2 * Math.tan(THREE.MathUtils.degToRad(LINEUP_FOV / 2)));
    const visibleWidth = LINEUP_SPAN * aspect;
    const n = Math.max(1, this.members.length);
    const fitted = (visibleWidth * 0.94) / n;
    const carousel = fitted < 0.72;
    return { distance, spacing: carousel ? 1.25 : Math.min(fitted, 1.5), carousel };
  }

  cameraFor(view) {
    if (view === 'module') return { position: MODULE_CAMERA.position.clone(), target: MODULE_CAMERA.target.clone(), fov: MODULE_CAMERA.fov };
    const { distance, spacing, carousel } = this.lineupGeometry();
    const n = this.members.length;
    return { position: new THREE.Vector3(0, 0.95, distance), target: new THREE.Vector3(0, 0.9, -0.2), fov: LINEUP_FOV };
  }

  // Move everything to the current view: at once (instant) or as one eased motion.
  layout(instant = false) {
    const poses = this.poses(this.view);
    const cam = this.cameraFor(this.view);
    if (instant || this.reducedMotion) {
      this.members.forEach((m, i) => { m.pivot.position.copy(poses[i].position); m.pivot.quaternion.copy(poses[i].quaternion); m.rest = poses[i]; });
      this.camera.position.copy(cam.position); this.cameraTarget.copy(cam.target); this.camera.fov = cam.fov; this.camera.updateProjectionMatrix();
      this.moduleFade = this.view === 'module' ? 1 : 0;
      this.transition = null;
    } else {
      this.transition = {
        start: this.clock.getElapsedTime(),
        from: this.members.map(m => ({ position: m.pivot.position.clone(), quaternion: m.pivot.quaternion.clone() })),
        to: poses,
        camFrom: { position: this.camera.position.clone(), target: this.cameraTarget.clone(), fov: this.camera.fov },
        camTo: cam,
        fadeFrom: this.moduleFade,
        fadeTo: this.view === 'module' ? 1 : 0,
      };
      this.members.forEach((m, i) => { m.rest = poses[i]; });
    }
    this.applyModuleFade();
    this.members.forEach(m => { m.pedestal.position.set(m.rest.position.x, 0, m.rest.position.z); });
  }

  setView(view) {
    if (view === this.view) return;
    this.view = view;
    if (view === 'lineup' && this.selected) this.carouselIndex = Math.max(0, this.members.findIndex(m => m.id === this.selected));
    this.layout(false);
  }

  setSelected(id) {
    this.selected = id;
    const index = this.members.findIndex(m => m.id === id);
    if (index < 0) return;
    // Turn the short way round to the chosen crew member.
    const n = this.members.length;
    let delta = (((index - this.ringTarget) % n) + n) % n;
    if (delta > n / 2) delta -= n;
    this.ringTarget += delta;
    if (this.reducedMotion) this.ringPos = this.ringTarget;
  }

  setHover(id) {
    if (id === this.hovered) return;
    this.hovered = id;
    this.renderer.domElement.style.cursor = id ? 'pointer' : 'default';
    this.callbacks.onHover(id);
  }

  // Dolly toward one crew member before the page navigates to their overview.
  focus(id) {
    const m = this.members.find(x => x.id === id);
    if (!m || this.reducedMotion) return Promise.resolve();
    const target = m.pivot.position.clone();
    const direction = this.camera.position.clone().sub(target).normalize();
    this.transition = {
      start: this.clock.getElapsedTime(), duration: 0.7,
      from: this.members.map(x => ({ position: x.pivot.position.clone(), quaternion: x.pivot.quaternion.clone() })),
      to: this.members.map(x => x.rest),
      camFrom: { position: this.camera.position.clone(), target: this.cameraTarget.clone(), fov: this.camera.fov },
      camTo: { position: target.clone().add(direction.multiplyScalar(1.6)), target, fov: this.camera.fov * 0.9 },
      fadeFrom: this.moduleFade, fadeTo: this.moduleFade,
    };
    return new Promise(resolve => setTimeout(resolve, 650));
  }

  // ------------------------------------------------------------ frame

  applyModuleFade() {
    const f = this.moduleFade;
    this.module.visible = f > 0.01;
    for (const material of this.module.userData.materials) {
      material.transparent = f < 0.999;
      material.opacity = f;
      material.depthWrite = f > 0.5;
    }
    this.module.traverse(node => { if (node.isLight) node.intensity = (node.userData.base ??= node.intensity) * f; });
    this.members.forEach(m => { m.pedestal.visible = f < 0.95; m.pedestal.children.forEach(c => { c.material.opacity = (1 - f) * (c === m.ring ? 0.9 : 1); }); });
  }

  pick() {
    if (!this.pointer || !this.members.length) return null;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const meshes = this.members.filter(m => m.pivot.visible).flatMap(m => m.pivot.userData.pickables);
    const hit = this.raycaster.intersectObjects(meshes, false)[0];
    if (!hit) return null;
    let node = hit.object;
    while (node && !node.userData.id) node = node.parent;
    return node?.userData.id || null;
  }

  frame() {
    const time = this.clock.getElapsedTime();
    const tr = this.transition;
    if (tr) {
      const k = Math.min(1, (time - tr.start) / (tr.duration || DURATION));
      const e = ease(k);
      this.members.forEach((m, i) => {
        if (!tr.from[i] || !tr.to[i]) return;
        m.pivot.position.lerpVectors(tr.from[i].position, tr.to[i].position, e);
        m.pivot.quaternion.slerpQuaternions(tr.from[i].quaternion, tr.to[i].quaternion, e);
      });
      this.camera.position.lerpVectors(tr.camFrom.position, tr.camTo.position, e);
      this.cameraTarget.lerpVectors(tr.camFrom.target, tr.camTo.target, e);
      this.camera.fov = THREE.MathUtils.lerp(tr.camFrom.fov, tr.camTo.fov, e);
      this.camera.updateProjectionMatrix();
      // The module fades in the second half when leaving it, in the first half when coming back.
      const fadeK = tr.fadeTo < tr.fadeFrom ? THREE.MathUtils.clamp(k * 1.6, 0, 1) : THREE.MathUtils.clamp((k - 0.1) * 1.4, 0, 1);
      this.moduleFade = THREE.MathUtils.lerp(tr.fadeFrom, tr.fadeTo, fadeK);
      this.applyModuleFade();
      if (k >= 1) this.transition = null;
    } else if (!this.reducedMotion) {
      // Microgravity drift in the module; a slow turn for the selected crew member in the lineup.
      this.members.forEach(m => {
        if (!m.rest) return;
        const t = time * 0.75 + m.phase;
        if (this.view === 'module') {
          m.pivot.position.set(m.rest.position.x + Math.sin(t * 0.7) * 0.03, m.rest.position.y + Math.sin(t) * 0.04, m.rest.position.z + Math.cos(t * 0.5) * 0.02);
          m.pivot.quaternion.copy(m.rest.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 0.6) * 0.03, Math.sin(t * 0.4) * 0.05, Math.cos(t * 0.5) * 0.03)));
        } else {
          const spin = m.id === this.selected ? Math.sin(time * 0.6) * 0.5 : Math.sin(t * 0.5) * 0.04;
          m.pivot.position.copy(m.rest.position);
          m.pivot.quaternion.copy(m.rest.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), spin));
        }
      });
    }
    if (this.view === 'lineup' && this.members.length && !(tr && tr.duration)) {
      // The ring eases toward the chosen crew member; poses follow it every frame.
      const dt = Math.min(0.1, time - this.lastTime);
      // A critically damped spring: starts gently, glides, settles without a bounce.
      if (this.drag) this.ringVel = 0;
      else if (this.reducedMotion) { this.ringPos = this.ringTarget; this.ringVel = 0; }
      else {
        const k = 26, c = 2 * Math.sqrt(k);
        for (let left = dt; left > 0; left -= 1 / 120) {
          const h = Math.min(left, 1 / 120);
          this.ringVel += (k * (this.ringTarget - this.ringPos) - c * this.ringVel) * h;
          this.ringPos += this.ringVel * h;
        }
        if (Math.abs(this.ringTarget - this.ringPos) < 1e-4 && Math.abs(this.ringVel) < 1e-3) { this.ringPos = this.ringTarget; this.ringVel = 0; }
      }
      this.members.forEach((m, i) => {
        const pose = this.ringPose(m, i);
        // Lean into the turn: each figure yaws a little with the ring's speed, then straightens.
        if (this.ringVel) pose.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.clamp(-this.ringVel * 0.18, -0.35, 0.35)));
        m.rest = pose;
        if (tr || this.reducedMotion) { m.pivot.position.copy(pose.position); m.pivot.quaternion.copy(pose.quaternion); }
        m.pivot.scale.setScalar(Math.max(0.001, pose.scale));
        m.pivot.visible = pose.scale > 0.01;
        m.pedestal.position.set(pose.position.x, 0, pose.position.z);
        m.pedestal.scale.setScalar(Math.max(0.001, pose.scale));
        m.pedestal.visible = pose.scale > 0.01;
      });
    }
    this.lastTime = time;
    this.camera.lookAt(this.cameraTarget);

    if (this.pointer) this.setHover(this.pick());
    const lineup = this.view === 'lineup';
    this.members.forEach(m => {
      const on = m.id === this.selected, hover = m.id === this.hovered;
      const rim = m.pivot.userData.rim.value;
      rim.x += ((on ? 0.45 : hover ? 0.32 : 0) - rim.x) * 0.15;
      rim.y += ((hover ? 0.35 : 0) - rim.y) * 0.15;
      m.ring.material.color.set(on ? '#2F45C0' : '#FFFFFF');
      m.ring.scale.setScalar(on && lineup ? 1.08 : 1);
    });

    this.renderer.render(this.scene, this.camera);
    this.report();
  }

  // Screen position of the point just above each crew member, for the page's labels.
  report() {
    const { width, height } = this.size;
    const anchors = this.members.map(m => {
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(m.pivot.quaternion);
      const half = m.pivot.userData.height / 2;
      const extent = Math.abs(up.y) * half + Math.sqrt(Math.max(0, 1 - up.y * up.y)) * 0.25 + 0.12;
      const world = m.pivot.position.clone().add(new THREE.Vector3(0, extent, 0));
      const ndc = world.clone().project(this.camera);
      const depth = this.camera.position.distanceTo(m.pivot.position);
      return { id: m.id, x: (ndc.x + 1) / 2 * width, y: (1 - ndc.y) / 2 * height, depth, visible: ndc.z < 1 && ndc.x > -1.1 && ndc.x < 1.1 && ndc.y < 1.2 };
    });
    this.callbacks.onFrame(anchors);
  }

  resize() {
    const { clientWidth: width, clientHeight: height } = this.container;
    if (!width || !height) return;
    this.size = { width, height };
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    if (this.members.length && !this.transition) this.layout(true);
  }

  setReducedMotion(value) { this.reducedMotion = value; }

  dispose() {
    this.disposed = true;
    this.renderer.setAnimationLoop(null);
    this.resizeObserver.disconnect();
    const el = this.renderer.domElement;
    el.removeEventListener('pointermove', this.onPointerMove);
    el.removeEventListener('pointerleave', this.onPointerLeave);
    el.removeEventListener('click', this.onClick);
    el.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.members.forEach(m => { m.pivot.userData.dispose(); m.pedestal.children.forEach(c => c.material.dispose()); });
    this.module.userData.dispose();
    this.pedestalMap.dispose(); this.pedestalGeo.dispose(); this.ringGeo.dispose(); this.envMap.dispose();
    this.renderer.dispose();
    el.remove();
  }
}
