import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import maleModelUrl from '../../../node_modules/open-anatomy-3d/models/anatomy-male.glb?url';
import femaleModelUrl from '../../../node_modules/open-anatomy-3d/models/anatomy-female.glb?url';
import maleRegions from './assets/surface-male.json';
import femaleRegions from './assets/surface-female.json';
import { muscles, SURFACE_KEYS, SURFACE_MUSCLE_KEYS, intensityColor, visibleSystems } from './anatomy.js';
import { buildSurfaceWeights, pickSurfaceRegion } from './surfaceWeights.js';
import { softenMaleFace, softenMaleGroin } from './surfaceShape.js';
import { addSurfaceEyes } from './surfaceEyes.js';
import { createIndicatorLayer, orderedIndicators } from './indicators.js';
import './indicators.css';

export { SURFACE_MUSCLE_KEYS };
const muscleKeys = new Set(muscles.map(item => item.key));
const neutral = new THREE.Color('#d6d9dc');

function ancestorKey(mesh, group) {
  for (let node = mesh; node && node !== group; node = node.parent) {
    if (muscleKeys.has(node.name)) return node.name;
  }
  return null;
}

// Keep anatomical shading while reducing harsh highlights inside colored regions.
function surfaceMaterial() {
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, roughness: 1 });
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float paintStrength;\nvarying float vPaintStrength;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvPaintStrength = paintStrength;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vPaintStrength;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb, diffuseColor.rgb, 0.25 * clamp(vPaintStrength, 0.0, 1.0));`);
  };
  return material;
}

function updateView(view, values) {
  const { layer, isolated, selected, scores } = values;
  // Optional caller-defined scale (score -> THREE.Color); defaults to the intensity palette.
  const colorOf = values.colorScale ?? intensityColor;
  const visible = visibleSystems(layer, isolated);
  view.skinGroup.visible = visible.skin;
  view.muscleGroup.visible = visible.muscles;
  view.skeletonGroup.visible = visible.skeleton;
  // Organs layer: the skin turns into a translucent shell and only the requested structures show inside.
  const organsMode = layer === 'organs';
  const structureColors = values.structureColors ?? {};
  const shell = view.skin.material;
  if (shell.transparent !== organsMode) {
    shell.transparent = organsMode; shell.opacity = organsMode ? 0.16 : 1; shell.depthWrite = !organsMode; shell.needsUpdate = true;
  }
  for (const child of view.skinGroup.children) if (!child.getObjectById(view.skin.id)) child.visible = !organsMode;
  for (const group of view.structureGroups) group.visible = organsMode;
  for (const item of view.structureMeshes) {
    const color = structureColors[item.key];
    item.mesh.visible = organsMode && Boolean(color);
    if (color) item.material.color.set(color);
  }
  const colors = view.skin.geometry.attributes.color;
  const paint = view.skin.geometry.attributes.paintStrength;
  const active = [false, ...SURFACE_KEYS.map(key => scores[key] > 0)];
  const palette = [neutral, ...SURFACE_KEYS.map(key => scores[key] > 0 ? colorOf(scores[key]) : neutral)];
  const { weights, stride, vertexCount } = view.surfaceWeights;
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    let r = 0, g = 0, b = 0, strength = 0;
    for (let id = 0; id < stride; id++) {
      const weight = weights[vertex * stride + id];
      if (!weight) continue;
      r += palette[id].r * weight; g += palette[id].g * weight; b += palette[id].b * weight;
      if (active[id]) strength += weight;
    }
    colors.setXYZ(vertex, r, g, b);
    paint.setX(vertex, strength);
  }
  colors.needsUpdate = true;
  paint.needsUpdate = true;
  for (const item of view.muscleMeshes) {
    if (organsMode) {
      const color = structureColors[item.key];
      item.mesh.visible = Boolean(color);
      if (color) item.material.color.set(color);
      item.outline.visible = false;
      continue;
    }
    item.mesh.visible = !isolated || item.key === selected;
    const score = scores[item.key];
    item.material.color.copy(score > 0 ? colorOf(score) : item.originalColor);
    item.outline.visible = layer === 'muscles' && item.key === selected && item.mesh.visible;
  }
}

function focusSelection(view, selected, layer, animate = false) {
  if (!selected || layer === 'skeleton') return;
  const box = new THREE.Box3();
  if (layer === 'surface') {
    const id = SURFACE_KEYS.indexOf(selected) + 1;
    const p = view.skin.geometry.attributes.position;
    const point = new THREE.Vector3();
    for (let face = 0; face < view.regions.length; face++) {
      if (view.regions[face] !== id || id === 0) continue;
      for (let i = 0; i < 3; i++) {
        point.fromBufferAttribute(p, view.skin.geometry.index ? view.skin.geometry.index.getX(face * 3 + i) : face * 3 + i).applyMatrix4(view.skin.matrixWorld);
        box.expandByPoint(point);
      }
    }
  } else {
    for (const item of view.muscleMeshes) if (item.key === selected) box.expandByObject(item.mesh);
    for (const item of view.structureMeshes ?? []) if (item.key === selected) box.expandByObject(item.mesh);
  }
  if (box.isEmpty()) return;
  const target = box.getCenter(new THREE.Vector3());
  const offset = view.camera.position.clone().sub(view.controls.target);
  const size = box.getSize(new THREE.Vector3()).length();
  offset.setLength(THREE.MathUtils.clamp(size * 3, 0.45, 2));
  if (animate) view.moveCamera(target, target.clone().add(offset));
  else {
    view.controls.target.copy(target);
    view.camera.position.copy(target).add(offset);
    view.controls.update();
  }
  return true;
}

function orientCamera(view, direction) {
  if (direction !== 'front' && direction !== 'back') return;
  const distance = view.camera.position.distanceTo(view.controls.target);
  view.camera.position.copy(view.controls.target).add(new THREE.Vector3(0, 0, direction === 'front' ? distance : -distance));
  view.controls.update();
}

export default function BodyViewer({ body = 'male', scores = {}, selected = null, onSelect, layer = 'surface', isolated = false, focusRequest = 0, viewRequest = null, framing = 1.15, showIndicators = false, checkpointItems = null, explorationRequest = null, colorScale = null, indicatorText = null, structureColors = null }) {
  const containerRef = useRef(null);
  const viewRef = useRef(null);
  const pendingFocusRef = useRef(false);
  const valuesRef = useRef({ scores, selected, onSelect, layer, isolated, viewRequest, checkpointItems, explorationRequest, colorScale, indicatorText, structureColors });
  const [status, setStatus] = useState('loading');
  valuesRef.current = { scores, selected, onSelect, layer, isolated, viewRequest, checkpointItems, explorationRequest, colorScale, indicatorText, structureColors };

  useEffect(() => {
    if (viewRef.current) updateView(viewRef.current, valuesRef.current);
  }, [scores, selected, layer, isolated, structureColors]);
  useEffect(() => {
    if (!focusRequest) return;
    pendingFocusRef.current = true;
    if (viewRef.current) {
      focusSelection(viewRef.current, selected, layer);
      pendingFocusRef.current = false;
    }
  }, [focusRequest]);

  useEffect(() => {
    if (viewRef.current && viewRequest) orientCamera(viewRef.current, viewRequest.direction);
  }, [viewRequest?.direction, viewRequest?.request]);

  useEffect(() => {
    if (viewRef.current && explorationRequest) viewRef.current.explore(explorationRequest.key, layer);
  }, [explorationRequest?.request]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    setStatus('loading');
    let renderer;
    try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); }
    catch { setStatus('webgl-error'); return undefined; }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
    container.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    camera.position.set(0, 1.05, 3.9);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.9, 0);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.minDistance = 0.2;
    controls.maxDistance = 6;
    controls.update();
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let inView = true, focused = false, interacting = false, transition = null, lastFrame = null;
    const visibility = typeof IntersectionObserver === 'undefined' ? null : new IntersectionObserver(entries => { inView = entries[0].isIntersecting; });
    visibility?.observe(container);
    const cancelTransition = () => { transition = null; interacting = true; };
    const endInteraction = () => { interacting = false; };
    if (explorationRequest) controls.addEventListener('start', cancelTransition);
    if (explorationRequest) controls.addEventListener('end', endInteraction);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b9baa, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(3, 4, 5); scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xe1edff, 1.2);
    fillLight.position.set(-3, 2, -4); scene.add(fillLight);
    const resize = () => {
      const width = Math.max(1, container.clientWidth), height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container); resize();
    let active = true, root = null, frame = 0, indicators = null, checkpoints = null;
    const originalMaterials = new Set();
    const disposeRoot = model => {
      const geometries = new Set(), materials = new Set(originalMaterials);
      model?.traverse(node => {
        if (!node.isMesh) return;
        geometries.add(node.geometry);
        (Array.isArray(node.material) ? node.material : [node.material]).forEach(material => material && materials.add(material));
      });
      geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
    };
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(body === 'female' ? femaleModelUrl : maleModelUrl, gltf => {
      root = gltf.scene;
      if (!active) { disposeRoot(root); root = null; return; }
      try {
        const muscleGroup = root.getObjectByName('muscles');
        const skinGroup = root.getObjectByName('skin');
        const skeletonGroup = root.getObjectByName('skeleton');
        let skin = null;
        skinGroup?.traverse(node => { if (node.isMesh && !skin) skin = node; });
        if (!muscleGroup || !skin || !skeletonGroup) throw new Error('model');
        const data = body === 'female' ? femaleRegions : maleRegions;
        const geometry = skin.geometry;
        const triangles = (geometry.index ? geometry.index.count : geometry.attributes.position.count) / 3;
        if (data.version !== 1 || data.body !== body || data.triangleCount !== triangles || data.regions.length !== triangles || JSON.stringify(data.keys) !== JSON.stringify(SURFACE_KEYS) || data.regions.some(id => !Number.isInteger(id) || id < 0 || id > SURFACE_KEYS.length)) throw new Error('assets');
        if (body === 'male') {
          root.updateMatrixWorld(true);
          softenMaleGroin(geometry, skin.matrixWorld);
          softenMaleFace(geometry, skin.matrixWorld);
        }
        const surfaceWeights = buildSurfaceWeights(geometry, data.regions, SURFACE_KEYS.length, {
          leftIds: SURFACE_KEYS.flatMap((key, i) => key.endsWith('_l') ? [i + 1] : []),
          rightIds: SURFACE_KEYS.flatMap((key, i) => key.endsWith('_r') ? [i + 1] : []),
        });
        geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count * 3), 3));
        geometry.setAttribute('paintStrength', new THREE.BufferAttribute(new Float32Array(geometry.attributes.position.count), 1));
        (Array.isArray(skin.material) ? skin.material : [skin.material]).forEach(material => originalMaterials.add(material));
        skin.material = surfaceMaterial();
        addSurfaceEyes(root, skinGroup, body);
        const muscleMeshes = [];
        const sourceMuscleMeshes = [];
        muscleGroup.traverse(mesh => { if (mesh.isMesh) sourceMuscleMeshes.push(mesh); });
        sourceMuscleMeshes.forEach(mesh => {
          const key = ancestorKey(mesh, muscleGroup);
          if (!key) { mesh.visible = false; return; }
          const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          originals.forEach(material => originalMaterials.add(material));
          const material = originals[0].clone();
          material.metalness = 0;
          material.roughness = 0.85;
          mesh.material = material;
          const outlineMaterial = new THREE.MeshBasicMaterial({ color: '#284c5b', side: THREE.BackSide });
          outlineMaterial.onBeforeCompile = shader => {
            shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += objectNormal * 0.0025;');
          };
          const outline = new THREE.Mesh(mesh.geometry, outlineMaterial);
          outline.raycast = () => {};
          outline.visible = false;
          mesh.add(outline);
          muscleMeshes.push({ mesh, key, material, originalColor: material.color.clone(), outline });
        });
        const skeletonMeshes = [];
        skeletonGroup.traverse(mesh => {
          if (!mesh.isMesh) return;
          skeletonMeshes.push(mesh);
          const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mesh.material = originals.map(original => {
            originalMaterials.add(original);
            const material = original.clone();
            material.metalness = 0;
            material.roughness = 0.85;
            return material;
          });
          if (mesh.material.length === 1) mesh.material = mesh.material[0];
        });
        for (const system of ['organs', 'vessels', 'nerves']) {
          const group = root.getObjectByName(system); if (group) group.visible = false;
        }
        // Organs and vessels, keyed by their node name (heart, lung_l, aorta...), for the organs layer.
        const structureGroups = [], structureMeshes = [];
        for (const system of ['organs', 'vessels']) {
          const group = root.getObjectByName(system);
          if (!group) continue;
          structureGroups.push(group);
          for (const node of group.children) node.traverse(mesh => {
            if (!mesh.isMesh) return;
            const originals = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            originals.forEach(material => originalMaterials.add(material));
            const material = originals[0].clone();
            material.metalness = 0;
            material.roughness = 0.6;
            mesh.material = material;
            mesh.visible = false;
            structureMeshes.push({ mesh, key: node.name, material });
          });
        }
        const view = { root, skin, skinGroup, muscleGroup, skeletonGroup, skeletonMeshes, muscleMeshes, structureGroups, structureMeshes, regions: data.regions, surfaceWeights, camera, controls };
        view.moveCamera = (target, position) => {
          controls.autoRotate = false;
          controls.enableDamping = false;
          controls.update();
          controls.enableDamping = true;
          transition = { fromTarget: controls.target.clone(), fromPosition: camera.position.clone(), target, position, elapsed: 0 };
        };
        viewRef.current = view;
        scene.add(root);
        root.updateMatrixWorld(true);
        if (showIndicators) indicators = createIndicatorLayer(container, view);
        if (checkpointItems) checkpoints = createIndicatorLayer(container, view, true);
        const bounds = new THREE.Box3().setFromObject(skin);
        view.explore = (key, currentLayer) => {
          if (key) {
            focused = Boolean(focusSelection(view, key, currentLayer, true));
          } else if (!bounds.isEmpty()) {
            focused = false;
            const center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
            const verticalFov = THREE.MathUtils.degToRad(camera.fov);
            const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
            const distance = Math.max(size.y / (2 * Math.tan(verticalFov / 2)), size.x / (2 * Math.tan(horizontalFov / 2))) * framing + size.z / 2;
            const direction = camera.position.clone().sub(controls.target).normalize();
            view.moveCamera(center, center.clone().addScaledVector(direction, distance));
          }
        };
        if (!bounds.isEmpty()) {
          const center = bounds.getCenter(new THREE.Vector3());
          const size = bounds.getSize(new THREE.Vector3());
          const verticalFov = THREE.MathUtils.degToRad(camera.fov);
          const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);
          const distance = Math.max(size.y / (2 * Math.tan(verticalFov / 2)), size.x / (2 * Math.tan(horizontalFov / 2))) * framing + size.z / 2;
          controls.target.copy(center);
          camera.position.copy(center).add(new THREE.Vector3(0, 0, distance));
          controls.update();
        }
        updateView(view, valuesRef.current);
        if (valuesRef.current.viewRequest) orientCamera(view, valuesRef.current.viewRequest.direction);
        if (pendingFocusRef.current) {
          focusSelection(view, valuesRef.current.selected, valuesRef.current.layer);
          pendingFocusRef.current = false;
        }
        if (valuesRef.current.explorationRequest?.request) view.explore(valuesRef.current.explorationRequest.key, valuesRef.current.layer);
        setStatus('ready');
      } catch (error) { setStatus(error.message === 'assets' ? 'asset-error' : 'model-error'); }
    }, undefined, () => { if (active) setStatus('load-error'); });
    const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2();
    let down = null;
    const onPointerDown = event => { down = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = event => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { down = null; return; }
      down = null;
      const view = viewRef.current, values = valuesRef.current;
      if (!view || values.layer === 'skeleton') return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      if (values.layer === 'organs') {
        const visibleStructures = view.structureMeshes.filter(item => item.mesh.visible);
        const candidates = [...visibleStructures.map(item => item.mesh), ...view.muscleMeshes.filter(item => item.mesh.visible).map(item => item.mesh)];
        const hit = raycaster.intersectObjects(candidates, false)[0];
        const key = hit && (visibleStructures.find(item => item.mesh === hit.object)?.key ?? ancestorKey(hit.object, view.muscleGroup));
        if (key) values.onSelect?.(key);
      } else if (values.layer === 'surface') {
        const hit = raycaster.intersectObject(view.skin, false)[0];
        const id = hit ? pickSurfaceRegion(view.skin.geometry, view.surfaceWeights, hit.faceIndex, view.skin.worldToLocal(hit.point.clone())) : 0;
        const key = SURFACE_KEYS[id - 1];
        if (key) values.onSelect?.(key);
      } else {
        const candidates = view.muscleMeshes.filter(item => item.mesh.visible).map(item => item.mesh);
        if (view.skeletonGroup.visible) candidates.push(...view.skeletonMeshes.filter(mesh => mesh.visible));
        const hit = raycaster.intersectObjects(candidates, false)[0];
        const key = hit && ancestorKey(hit.object, view.muscleGroup);
        if (key) values.onSelect?.(key);
      }
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    const animate = (now = 0) => {
      const visible = inView && !document.hidden;
      const delta = visible && lastFrame !== null ? Math.min((now - lastFrame) / 1000, 0.05) : 0;
      lastFrame = visible ? now : null;
      controls.autoRotate = Boolean(explorationRequest) && visible && !focused && !interacting && !transition && !motion.matches;
      controls.autoRotateSpeed = 0.3;
      if (transition && visible) {
        transition.elapsed += delta;
        const progress = motion.matches ? 1 : Math.min(1, transition.elapsed / 0.5);
        const eased = progress * progress * (3 - 2 * progress);
        controls.target.lerpVectors(transition.fromTarget, transition.target, eased);
        camera.position.lerpVectors(transition.fromPosition, transition.position, eased);
        if (progress === 1) transition = null;
      }
      if (visible) { controls.update(delta); indicators?.update(valuesRef.current, now, motion.matches); checkpoints?.update(valuesRef.current, now, motion.matches); renderer.render(scene, camera); }
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      active = false; cancelAnimationFrame(frame); observer.disconnect();
      visibility?.disconnect();
      controls.removeEventListener('start', cancelTransition);
      controls.removeEventListener('end', endInteraction);
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      indicators?.dispose();
      checkpoints?.dispose();
      viewRef.current = null;
      disposeRoot(root); root = null;
      renderer.dispose(); renderer.domElement.remove();
    };
  }, [body, framing, showIndicators, Boolean(checkpointItems)]);

  const message = {
    loading: 'Cargando modelo 3D…',
    'webgl-error': 'No se pudo iniciar el visor 3D. Comprobá que tu navegador tenga WebGL habilitado.',
    'load-error': 'No se pudo cargar el modelo 3D. Recargá la página.',
    'asset-error': 'El mapa de regiones no corresponde al modelo 3D.',
    'model-error': 'El modelo 3D no contiene las capas esperadas.',
  }[status];
  return <div ref={containerRef} aria-label="Modelo 3D interactivo de grupos musculares" style={{ width: '100%', height: '100%', minHeight: 360, position: 'relative' }}>
    {showIndicators && layer !== 'skeleton' && <ul className="atlas-sr-only" aria-label="Intensidades musculares">{orderedIndicators(scores, selected).map(item => { const custom = indicatorText?.(item.key, item.value); return <li key={item.key}>{custom?.name ?? item.label}: {custom?.value ?? `${Math.round(item.value)}%`}</li>; })}</ul>}
    {message && <div role={status === 'loading' ? 'status' : 'alert'} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', pointerEvents: 'none' }}>{message}</div>}
  </div>;
}
