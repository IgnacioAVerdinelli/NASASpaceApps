import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import maleModelUrl from '../node_modules/open-anatomy-3d/models/anatomy-male.glb?url';
import femaleModelUrl from '../node_modules/open-anatomy-3d/models/anatomy-female.glb?url';

const neutral = new THREE.Color('#d6d9dc');
const selectedColor = new THREE.Color('#96aeb8');
const palette = [new THREE.Color('#f6d77d'), new THREE.Color('#ef9959'), new THREE.Color('#d94d4b')];

function muscleColor(value) {
  if (!Number.isFinite(value) || value <= 0) return neutral;
  const intensity = Math.min(100, value) / 100;
  return intensity < 0.5
    ? palette[0].clone().lerp(palette[1], intensity * 2)
    : palette[1].clone().lerp(palette[2], (intensity - 0.5) * 2);
}

// Surface regions are a deliberately approximate front/back projection, not anatomical segmentation.
// Deep muscles have no reliable surface footprint and are left unassigned.
const sidedSurfaceGroups = [
  'deltoid', 'upper_arm_muscles', 'forearm_muscles', 'hand_muscles',
  'chest_muscles', 'trapezius', 'back_muscles', 'gluteal', 'quadriceps',
  'hamstrings', 'shin_muscles', 'calf', 'foot_muscles',
];
export const SURFACE_MUSCLE_KEYS = new Set([
  'abdominal_muscles', ...sidedSurfaceGroups.flatMap((group) => [`${group}_l`, `${group}_r`]),
]);

// The masks are rendered from the actual GLB muscle meshes, not hand-drawn shapes.
const maskWidth = 1024;
const maskHeight = 2048;
const maskLeft = -0.4;
const maskBottom = -0.05;
const maskWorldWidth = 0.8;
const maskWorldHeight = 1.8;
const surfaceKeys = [...SURFACE_MUSCLE_KEYS];
const frontGroups = new Set(['deltoid', 'upper_arm_muscles', 'forearm_muscles', 'hand_muscles', 'chest_muscles', 'abdominal_muscles', 'quadriceps', 'shin_muscles', 'foot_muscles']);
const backGroups = new Set(['deltoid', 'upper_arm_muscles', 'forearm_muscles', 'hand_muscles', 'trapezius', 'back_muscles', 'gluteal', 'hamstrings', 'calf', 'foot_muscles']);

function groupOf(key) {
  return key.replace(/_[lr]$/, '');
}

// Close only short gaps between matching regions and remove tiny disconnected fragments.
function cleanMask(pixels) {
  const width = maskWidth, height = maskHeight;
  const fillGaps = (horizontal) => {
    const lines = horizontal ? height : width;
    const length = horizontal ? width : height;
    const pixelIndex = (line, position) => horizontal ? line * width + position : position * width + line;
    for (let line = 0; line < lines; line++) {
      let lastId = 0, lastPosition = -1, lastPixel = -1;
      for (let position = 0; position < length; position++) {
        const current = pixelIndex(line, position);
        const id = pixels[current * 4];
        if (!id) continue;
        const gap = position - lastPosition - 1;
        if (id === lastId && gap > 0 && gap <= 10) {
          for (let p = lastPosition + 1; p < position; p++) {
            const dest = pixelIndex(line, p) * 4;
            const source = (p - lastPosition <= position - p ? lastPixel : current) * 4;
            pixels[dest] = id;
            pixels[dest + 1] = pixels[source + 1];
            pixels[dest + 3] = 255;
          }
        }
        lastId = id; lastPosition = position; lastPixel = current;
      }
    }
  };
  fillGaps(true);
  fillGaps(false);
  const count = width * height;
  const filterAxis = (source, radius, vertical, erode) => {
    const out = new Uint8Array(count);
    const lines = vertical ? width : height;
    const length = vertical ? height : width;
    const at = (line, position) => vertical ? position * width + line : line * width + position;
    const windowSize = radius * 2 + 1;
    for (let line = 0; line < lines; line++) {
      let sum = 0;
      for (let p = 0; p < length; p++) {
        if (p === 0) {
          for (let q = 0; q <= radius && q < length; q++) sum += source[at(line, q)];
        } else {
          const incoming = p + radius, outgoing = p - radius - 1;
          if (incoming < length) sum += source[at(line, incoming)];
          if (outgoing >= 0) sum -= source[at(line, outgoing)];
        }
        out[at(line, p)] = erode ? Number(sum === windowSize) : Number(sum > 0);
      }
    }
    return out;
  };
  for (const [key, radius] of [['quadriceps_l', 7], ['quadriceps_r', 7], ['chest_muscles_l', 3], ['chest_muscles_r', 3], ['back_muscles_l', 3], ['back_muscles_r', 3], ['trapezius_l', 3], ['trapezius_r', 3]]) {
    const id = surfaceKeys.indexOf(key) + 1;
    const original = new Uint8Array(count);
    let present = false;
    for (let i = 0; i < count; i++) {
      if (pixels[i * 4] === id) { original[i] = 1; present = true; }
    }
    if (!present) continue;
    let opened = filterAxis(original, radius, false, true);
    opened = filterAxis(opened, radius, true, true);
    // A whole thin muscle should never disappear due to this cleanup.
    if (!opened.includes(1)) continue;
    opened = filterAxis(opened, radius, true, false);
    opened = filterAxis(opened, radius, false, false);
    for (let i = 0; i < count; i++) {
      if (original[i] && !opened[i]) pixels[i * 4] = 0;
    }
  }
  const visited = new Uint8Array(count);
  const queue = new Int32Array(count);
  for (let start = 0; start < count; start++) {
    const id = pixels[start * 4];
    if (!id || visited[start]) continue;
    let head = 0, tail = 0;
    queue[tail++] = start;
    visited[start] = 1;
    while (head < tail) {
      const current = queue[head++];
      const x = current % width;
      const adjacent = [x ? current - 1 : -1, x < width - 1 ? current + 1 : -1, current - width, current + width];
      for (const next of adjacent) {
        if (next < 0 || next >= count || visited[next] || pixels[next * 4] !== id) continue;
        visited[next] = 1;
        queue[tail++] = next;
      }
    }
    if (tail < 40) {
      for (let i = 0; i < tail; i++) pixels[queue[i] * 4] = 0;
    }
  }
}

function buildMasks(renderer, root, muscleGroup) {
  const idMaterials = surfaceKeys.map((_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: new THREE.Color().setRGB((index + 1) / 255, 0, 0), toneMapped: false });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying float vMaskDepth;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvMaskDepth = (modelMatrix * vec4(transformed, 1.0)).z;');
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying float vMaskDepth;')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\ngl_FragColor.g = clamp((vMaskDepth + 0.4) / 0.8, 0.0, 1.0);');
    };
    return material;
  });
  const meshes = [];
  muscleGroup.traverse((mesh) => {
    if (!mesh.isMesh) return;
    let node = mesh;
    while (node && node !== muscleGroup && !SURFACE_MUSCLE_KEYS.has(node.name)) node = node.parent;
    if (!node || node === muscleGroup) { mesh.visible = false; return; }
    mesh.material = idMaterials[surfaceKeys.indexOf(node.name)];
    meshes.push({ mesh, key: node.name });
  });
  const scene = new THREE.Scene();
  scene.add(root);
  const front = new THREE.WebGLRenderTarget(maskWidth, maskHeight, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const back = new THREE.WebGLRenderTarget(maskWidth, maskHeight, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter });
  const frontPixels = new Uint8Array(maskWidth * maskHeight * 4);
  const backPixels = new Uint8Array(maskWidth * maskHeight * 4);
  const camera = new THREE.OrthographicCamera(-0.4, 0.4, 0.9, -0.9, 0.1, 10);
  renderer.setClearColor(0x000000, 0);
  for (const [target, pixels, groups, z] of [[front, frontPixels, frontGroups, 4], [back, backPixels, backGroups, -4]]) {
    for (const { mesh, key } of meshes) mesh.visible = groups.has(groupOf(key));
    camera.position.set(0, 0.85, z);
    camera.lookAt(0, 0.85, 0);
    camera.updateProjectionMatrix();
    renderer.setRenderTarget(target);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.readRenderTargetPixels(target, 0, 0, maskWidth, maskHeight, pixels);
    cleanMask(pixels);
  }
  renderer.setRenderTarget(null);
  for (const { mesh } of meshes) mesh.visible = true;
  const makeTexture = (pixels) => {
    const texture = new THREE.DataTexture(pixels, maskWidth, maskHeight, THREE.RGBAFormat);
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    texture.needsUpdate = true;
    return texture;
  };
  return { front, back, frontPixels, backPixels, frontTexture: makeTexture(frontPixels), backTexture: makeTexture(backPixels), idMaterials };
}

function colorFor(key, scores, selected) {
  const color = key ? muscleColor(scores[key]).clone() : neutral.clone();
  if (key && key === selected && !(scores[key] > 0)) color.lerp(selectedColor, 0.5);
  return color;
}

function paintSkin(paletteTexture, scores, selected) {
  const bytes = paletteTexture.image.data;
  [null, ...surfaceKeys].forEach((key, index) => {
    const color = colorFor(key, scores, selected);
    bytes[index * 4] = Math.round(color.r * 255);
    bytes[index * 4 + 1] = Math.round(color.g * 255);
    bytes[index * 4 + 2] = Math.round(color.b * 255);
    bytes[index * 4 + 3] = 255;
  });
  paletteTexture.needsUpdate = true;
}

function makeSkinMaterial(masks, valuesRef, body) {
  const colors = new Uint8Array(256 * 4);
  const paletteTexture = new THREE.DataTexture(colors, 256, 1, THREE.RGBAFormat);
  paletteTexture.magFilter = THREE.NearestFilter;
  paletteTexture.minFilter = THREE.NearestFilter;
  paintSkin(paletteTexture, valuesRef.current.scores, valuesRef.current.selected);
  const material = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 });
  material.userData.paletteTexture = paletteTexture;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFrontMask = { value: masks.frontTexture };
    shader.uniforms.uBackMask = { value: masks.backTexture };
    shader.uniforms.uMusclePalette = { value: paletteTexture };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vSkinPosition;\nvarying vec3 vSkinNormal;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvSkinPosition = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvSkinNormal = normalize(mat3(modelMatrix) * normal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vSkinPosition;
        varying vec3 vSkinNormal;
        uniform sampler2D uFrontMask;
        uniform sampler2D uBackMask;
        uniform sampler2D uMusclePalette;
        vec3 maskColor(vec2 uv, bool back) {
          if (vSkinPosition.y >= ${body === 'female' ? '1.39' : '1.49'} || uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return texture2D(uMusclePalette, vec2(0.5 / 256.0, 0.5)).rgb;
          vec4 sampleValue = back ? texture2D(uBackMask, uv) : texture2D(uFrontMask, uv);
          float index = floor(sampleValue.r * 255.0 + 0.5);
          float muscleDepth = sampleValue.g * 0.8 - 0.4;
          if (abs(vSkinPosition.z - muscleDepth) > 0.09) index = 0.0;
          return texture2D(uMusclePalette, vec2((index + 0.5) / 256.0, 0.5)).rgb;
        }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float nz = normalize(vSkinNormal).z;
        bool back = nz < -0.1 || (abs(nz) <= 0.1 && vSkinPosition.z < -0.02);
        vec2 maskUV = vec2((vSkinPosition.x + 0.4) / 0.8, (vSkinPosition.y + 0.05) / 1.8);
        if (back) maskUV.x = 1.0 - maskUV.x;
        vec2 offset = vec2(0.35 / 1024.0, 0.35 / 2048.0);
        diffuseColor.rgb = 0.25 * (maskColor(maskUV + offset, back) + maskColor(maskUV - offset, back) + maskColor(maskUV + vec2(offset.x, -offset.y), back) + maskColor(maskUV + vec2(-offset.x, offset.y), back));`);
  };
  return material;
}

function regionAt(point, normal, masks, body) {
  if (point.y >= (body === 'female' ? 1.39 : 1.49)) return null;
  const back = normal.z < -0.1 || (Math.abs(normal.z) <= 0.1 && point.z < -0.02);
  let u = (point.x - maskLeft) / maskWorldWidth;
  const v = (point.y - maskBottom) / maskWorldHeight;
  if (back) u = 1 - u;
  if (u < 0 || u >= 1 || v < 0 || v >= 1) return null;
  const x = Math.floor(u * maskWidth);
  const y = Math.floor(v * maskHeight);
  const pixels = back ? masks.backPixels : masks.frontPixels;
  const offset = (y * maskWidth + x) * 4;
  const index = pixels[offset];
  if (Math.abs(point.z - (pixels[offset + 1] / 255 * 0.8 - 0.4)) > 0.09) return null;
  return surfaceKeys[index - 1] ?? null;
}

export default function BodyViewer({ body = 'male', scores = {}, selected = null, onSelect }) {
  const containerRef = useRef(null);
  const skinRef = useRef(null);
  const valuesRef = useRef({ scores, selected, onSelect });
  const [status, setStatus] = useState('loading');
  valuesRef.current = { scores, selected, onSelect };

  useEffect(() => {
    if (skinRef.current) paintSkin(skinRef.current.mesh.material.userData.paletteTexture, scores, selected);
  }, [scores, selected]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    setStatus('loading');
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setStatus('webgl-error');
      return undefined;
    }
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
    controls.minDistance = 1.7;
    controls.maxDistance = 6;
    controls.update();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8b9baa, 2.1));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2);
    keyLight.position.set(3, 4, 5);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xe1edff, 1.2);
    fillLight.position.set(-3, 2, -4);
    scene.add(fillLight);

    const resize = () => {
      const width = Math.max(1, container.clientWidth);
      const height = Math.max(1, container.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();
    let active = true;
    let root = null;
    let frame = 0;
    const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    loader.load(body === 'female' ? femaleModelUrl : maleModelUrl, (gltf) => {
      root = gltf.scene;
      if (!active) {
        root.traverse((node) => {
          if (node.isMesh) { node.geometry.dispose(); node.material?.dispose(); }
        });
        return;
      }
      const muscleGroup = root.getObjectByName('muscles');
      const skinGroup = root.getObjectByName('skin');
      let skin = null;
      skinGroup?.traverse((node) => { if (node.isMesh && !skin) skin = node; });
      if (!muscleGroup || !skin) {
        setStatus('model-error');
        return;
      }
      for (const system of ['skeleton', 'organs', 'vessels', 'nerves', 'skin']) {
        const group = root.getObjectByName(system);
        if (group) group.visible = false;
      }
      const masks = buildMasks(renderer, root, muscleGroup);
      skin.material = makeSkinMaterial(masks, valuesRef, body);
      skinRef.current = { mesh: skin, masks };
      muscleGroup.visible = false;
      skinGroup.visible = true;
      scene.add(root);
      setStatus('ready');
    }, undefined, () => { if (active) setStatus('load-error'); });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let down = null;
    const onPointerDown = (event) => { down = { x: event.clientX, y: event.clientY }; };
    const onPointerUp = (event) => {
      if (!down || Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) { down = null; return; }
      down = null;
      if (!skinRef.current) return;
      const bounds = renderer.domElement.getBoundingClientRect();
      pointer.set(((event.clientX - bounds.left) / bounds.width) * 2 - 1, -((event.clientY - bounds.top) / bounds.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hit = raycaster.intersectObject(skinRef.current.mesh, false)[0];
      if (!hit) return;
      const normal = (hit.normal || hit.face?.normal)?.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(skinRef.current.mesh.matrixWorld));
      const key = normal ? regionAt(hit.point, normal, skinRef.current.masks, body) : null;
      if (key) valuesRef.current.onSelect?.(key);
    };
    renderer.domElement.addEventListener('pointerdown', onPointerDown);
    renderer.domElement.addEventListener('pointerup', onPointerUp);
    const animate = () => {
      controls.update();
      renderer.render(scene, camera);
      frame = requestAnimationFrame(animate);
    };
    animate();
    return () => {
      active = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onPointerDown);
      renderer.domElement.removeEventListener('pointerup', onPointerUp);
      controls.dispose();
      root?.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry.dispose();
        if (Array.isArray(node.material)) node.material.forEach((material) => material.dispose());
        else node.material?.dispose();
      });
      if (skinRef.current) {
        skinRef.current.mesh.material.userData.paletteTexture.dispose();
        skinRef.current.masks.front.dispose();
        skinRef.current.masks.back.dispose();
        skinRef.current.masks.frontTexture.dispose();
        skinRef.current.masks.backTexture.dispose();
        skinRef.current.masks.idMaterials.forEach((material) => material.dispose());
      }
      skinRef.current = null;
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [body]);

  const message = {
    loading: 'Cargando modelo 3D…',
    'webgl-error': 'No se pudo iniciar el visor 3D. Comprobá que tu navegador tenga WebGL habilitado.',
    'load-error': 'No se pudo cargar el modelo 3D. Recargá la página y comprobá que el archivo del modelo esté disponible.',
    'model-error': 'El modelo 3D no contiene las capas de piel y músculos esperadas.',
  }[status];
  return (
    <div ref={containerRef} aria-label="Modelo 3D interactivo de grupos musculares" style={{ width: '100%', height: '100%', minHeight: 360, position: 'relative' }}>
      {message && <div role={status === 'loading' ? 'status' : 'alert'} style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, textAlign: 'center', pointerEvents: 'none' }}>{message}</div>}
    </div>
  );
}
