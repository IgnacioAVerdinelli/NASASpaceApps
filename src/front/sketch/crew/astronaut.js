// Dressed crew members for the crew-select scene, built from the same open-anatomy-3d bodies as the 3D body map
// (src/front/body-3d): the skin mesh, its surface-region map (which part of the body each triangle is) and the same
// face and eye fixes. Nothing is downloaded beyond the two models the app already ships.
//
// The blue flight suit is painted per vertex from the region map (sleeves end where the hand begins, shoes cover the
// feet) and the head keeps the skin. Hair is a thin shell grown from the scalp. These are illustrations, not likenesses.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import maleModelUrl from '../../../../node_modules/open-anatomy-3d/models/anatomy-male.glb?url';
import femaleModelUrl from '../../../../node_modules/open-anatomy-3d/models/anatomy-female.glb?url';
import maleRegions from '../../body-3d/assets/surface-male.json';
import femaleRegions from '../../body-3d/assets/surface-female.json';
import { SURFACE_KEYS } from '../../body-3d/anatomy.js';
import { buildSurfaceWeights } from '../../body-3d/surfaceWeights.js';
import { softenMaleFace, softenMaleGroin } from '../../body-3d/surfaceShape.js';
import { addSurfaceEyes } from '../../body-3d/surfaceEyes.js';
import { DecalGeometry } from 'three/addons/geometries/DecalGeometry.js';

const SUIT = new THREE.Color('#2C4F96');
const SUIT_SEAM = new THREE.Color('#1F3A72');
const SHOE = new THREE.Color('#2E3546');

const ids = keys => keys.map(k => SURFACE_KEYS.indexOf(k) + 1).filter(i => i > 0);
const HAND = ids(['hand_muscles_l', 'hand_muscles_r']);
const FOOT = ids(['foot_muscles_l', 'foot_muscles_r']);
const LEG = ids(['gluteal_l', 'gluteal_r', 'quadriceps_l', 'quadriceps_r', 'hamstrings_l', 'hamstrings_r']);
const smooth = (a, b, x) => THREE.MathUtils.smoothstep(x, a, b);

// ---------------------------------------------------------------- base bodies (loaded once per page)

const bases = new Map();

function loadGltf(url) {
  return new Promise((resolve, reject) => new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).load(url, resolve, undefined, reject));
}

function disposeTree(root, keep) {
  root.traverse(node => {
    if (!node.isMesh || keep.has(node)) return;
    node.geometry?.dispose();
    (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => m?.dispose());
  });
}

// The models are meshopt-compressed (quantized, interleaved attributes); applying a matrix to those would clamp the
// values. Copy positions into plain floats in world space, keep the triangle order (the region map depends on it).
function toWorldFloat(geometry, matrix) {
  const src = geometry.attributes.position;
  const out = new Float32Array(src.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < src.count; i++) { v.fromBufferAttribute(src, i).applyMatrix4(matrix); out[i * 3] = v.x; out[i * 3 + 1] = v.y; out[i * 3 + 2] = v.z; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  if (geometry.index) {
    const index = new Uint32Array(geometry.index.count);
    for (let i = 0; i < index.length; i++) index[i] = geometry.index.getX(i);
    g.setIndex(new THREE.BufferAttribute(index, 1));
  }
  return g;
}

// The skin geometry of one body, measured and labelled: everything a crew member needs, without the anatomy.
async function buildBase(body) {
  const gltf = await loadGltf(body === 'female' ? femaleModelUrl : maleModelUrl);
  const root = gltf.scene;
  root.updateMatrixWorld(true);
  const skinGroup = root.getObjectByName('skin');
  let skin = null;
  skinGroup?.traverse(node => { if (node.isMesh && !skin) skin = node; });
  const data = body === 'female' ? femaleRegions : maleRegions;
  if (!skin) throw new Error('The body model has no skin');
  const geometry = skin.geometry;
  if (body === 'male') { softenMaleGroin(geometry, skin.matrixWorld); softenMaleFace(geometry, skin.matrixWorld); }
  const weights = buildSurfaceWeights(geometry, data.regions, SURFACE_KEYS.length, {
    leftIds: SURFACE_KEYS.flatMap((key, i) => key.endsWith('_l') ? [i + 1] : []),
    rightIds: SURFACE_KEYS.flatMap((key, i) => key.endsWith('_r') ? [i + 1] : []),
  });
  // Eyes: the same inserts as the body map, kept as geometry in the skin's space.
  const eyeGroup = addSurfaceEyes(root, skinGroup, body);
  const eyes = [];
  root.updateMatrixWorld(true);
  eyeGroup?.traverse(node => { if (node.isMesh) eyes.push({ geometry: node.geometry, matrix: node.matrixWorld.clone() }); });

  // Work in world space with the feet at y = 0, centred on x and z.
  const world = toWorldFloat(geometry, skin.matrixWorld);
  world.computeBoundingBox();
  const box = world.boundingBox;
  const shift = new THREE.Vector3(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  world.translate(shift.x, shift.y, shift.z);
  world.computeBoundingBox();
  orientOutward(world);
  const base = { body, geometry: world, weights, height: world.boundingBox.max.y };
  base.L = landmarks(base);
  tailorSuit(base);
  world.computeVertexNormals();
  world.computeBoundingBox();
  base.eyes = eyes.map(({ geometry: g, matrix }) => {
    const e = toWorldFloat(g, matrix).translate(shift.x, shift.y, shift.z);
    e.computeVertexNormals();
    return e;
  });
  disposeTree(root, new Set());
  return base;
}

// Some source meshes are wound inside out; make every normal point away from the body's axis.
function orientOutward(geometry) {
  geometry.computeVertexNormals();
  const pos = geometry.attributes.position, nor = geometry.attributes.normal;
  let score = 0;
  for (let i = 0; i < pos.count; i += 7) score += nor.getX(i) * pos.getX(i) + nor.getZ(i) * pos.getZ(i);
  if (score >= 0) return;
  const index = geometry.index.array;
  for (let t = 0; t < index.length; t += 3) { const a = index[t + 1]; index[t + 1] = index[t + 2]; index[t + 2] = a; }
  geometry.index.needsUpdate = true;
  geometry.computeVertexNormals();
}

// How much of a vertex is bare skin (head, neck, hands): 0 on the suit, 1 on skin.
function skinAmountAt(base, i) {
  const { geometry, weights: { weights, stride }, L } = base;
  const pos = geometry.attributes.position;
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
  const neckline = L.collar - (z > -0.02 ? 0.05 * Math.max(0, 1 - Math.abs(x) / 0.07) : 0);
  // Hands: below the cuff and out by the side, away from the thighs (the region map barely covers the fingers).
  const hand = Math.abs(x) > L.handInner - 0.01 && regionWeight(weights, stride, i, LEG) < 0.2
    ? 1 - smooth(L.wrist - 0.012, L.wrist, y) : 0;
  return Math.max(smooth(neckline - 0.006, neckline + 0.006, y), hand, smooth(0.2, 0.36, regionWeight(weights, stride, i, HAND)));
}

// Turn the anatomical skin into a garment: smooth the suit area (Taubin, so it does not shrink) to remove anatomical
// detail, then let it stand off the body a few millimetres like fabric. Head, neck and hands are left untouched.
function tailorSuit(base) {
  const geometry = base.geometry, pos = geometry.attributes.position, index = geometry.index.array;
  const weld = new Map(), vertexToWeld = new Int32Array(pos.count), points = [];
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(5)},${pos.getY(i).toFixed(5)},${pos.getZ(i).toFixed(5)}`;
    let w = weld.get(key);
    if (w === undefined) { w = points.length; weld.set(key, w); points.push([pos.getX(i), pos.getY(i), pos.getZ(i)]); }
    vertexToWeld[i] = w;
  }
  const n = points.length;
  const mask = new Float32Array(n);
  for (let i = 0; i < pos.count; i++) mask[vertexToWeld[i]] = 1 - smooth(0.05, 0.6, skinAmountAt(base, i));
  const neighbors = Array.from({ length: n }, () => new Set());
  for (let t = 0; t < index.length; t += 3) {
    const a = vertexToWeld[index[t]], b = vertexToWeld[index[t + 1]], c = vertexToWeld[index[t + 2]];
    neighbors[a].add(b).add(c); neighbors[b].add(a).add(c); neighbors[c].add(a).add(b);
  }
  const lists = neighbors.map(s => Int32Array.from(s));
  let p = Float32Array.from(points.flat());
  // Where a loose suit hides the body's shape most: the pelvis and the chest get extra smoothing.
  const { h, collar } = base.L;
  const loose = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const [x, y, z] = points[v];
    const pelvis = smooth(0.4 * h, 0.45 * h, y) * (1 - smooth(0.54 * h, 0.58 * h, y)) * (1 - smooth(0.1, 0.15, Math.abs(x)));
    const chest = z > 0 ? smooth(collar - 0.3, collar - 0.24, y) * (1 - smooth(collar - 0.1, collar - 0.06, y)) * (1 - smooth(0.16, 0.2, Math.abs(x))) : 0;
    loose[v] = mask[v] * Math.max(pelvis, chest);
  }
  let weightsNow = mask;
  const step = factor => {
    const next = new Float32Array(p.length);
    for (let v = 0; v < n; v++) {
      const list = lists[v], k = weightsNow[v] * factor;
      let sx = 0, sy = 0, sz = 0;
      for (let j = 0; j < list.length; j++) { const u = list[j] * 3; sx += p[u]; sy += p[u + 1]; sz += p[u + 2]; }
      const m = list.length || 1;
      next[v * 3] = p[v * 3] + k * (sx / m - p[v * 3]);
      next[v * 3 + 1] = p[v * 3 + 1] + k * (sy / m - p[v * 3 + 1]);
      next[v * 3 + 2] = p[v * 3 + 2] + k * (sz / m - p[v * 3 + 2]);
    }
    p = next;
  };
  for (let pass = 0; pass < 24; pass++) { step(0.55); step(-0.58); }
  weightsNow = loose;
  for (let pass = 0; pass < 40; pass++) { step(0.6); step(-0.62); }
  for (let i = 0; i < pos.count; i++) { const w = vertexToWeld[i] * 3; pos.setXYZ(i, p[w], p[w + 1], p[w + 2]); }
  // Stand off along the welded normal so seams between split vertices stay closed.
  geometry.computeVertexNormals();
  const nor = geometry.attributes.normal, wn = new Float32Array(n * 3);
  for (let i = 0; i < pos.count; i++) { const w = vertexToWeld[i] * 3; wn[w] += nor.getX(i); wn[w + 1] += nor.getY(i); wn[w + 2] += nor.getZ(i); }
  for (let i = 0; i < pos.count; i++) {
    const w = vertexToWeld[i], o = w * 3;
    const len = Math.hypot(wn[o], wn[o + 1], wn[o + 2]) || 1;
    const lift = 0.008 * mask[w];
    pos.setXYZ(i, pos.getX(i) + wn[o] / len * lift, pos.getY(i) + wn[o + 1] / len * lift, pos.getZ(i) + wn[o + 2] / len * lift);
  }
  pos.needsUpdate = true;
}

export function loadBase(body) {
  if (!bases.has(body)) bases.set(body, buildBase(body).catch(error => { bases.delete(body); throw error; }));
  return bases.get(body);
}

// ---------------------------------------------------------------- dressing

function regionWeight(weights, stride, vertex, list) {
  let w = 0;
  for (const id of list) w += weights[vertex * stride + id];
  return w;
}

// Landmarks measured on the base body, in metres (feet at y = 0, facing +z).
function landmarks(base) {
  const { geometry, weights: { weights, stride } } = base;
  const pos = geometry.attributes.position;
  let headTop = 0, headFront = -Infinity, wrist = 0, handInner = Infinity;
  for (let i = 0; i < pos.count; i++) {
    headTop = Math.max(headTop, pos.getY(i));
    if (regionWeight(weights, stride, i, HAND) > 0.5) { wrist = Math.max(wrist, pos.getY(i)); handInner = Math.min(handInner, Math.abs(pos.getX(i))); }
  }
  const h = base.height;
  // Head and neck take about the top 17% of an adult's height; the collar sits at the base of the neck.
  const collar = headTop - 0.172 * h;
  const patchY = collar - 0.085;
  let patchFront = -Infinity;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y > h - 0.2 && Math.abs(x) < 0.05) headFront = Math.max(headFront, z);
    if (Math.abs(y - patchY) < 0.02 && Math.abs(x) < 0.14) patchFront = Math.max(patchFront, z);
  }
  return { h, collar, patchY, patchFront, waist: 0.585 * h, headTop, headFront, wrist, handInner };
}

// Per-vertex colours: suit, skin, shoes and the few suit details that make it read as a flight suit.
function paint(base, look) {
  const { geometry, weights: { weights, stride } } = base;
  const L = base.L;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const skin = new THREE.Color(look.skin), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const foot = regionWeight(weights, stride, i, FOOT);
    // Neckline: a shallow V at the front, the collar at the back (skinAmountAt).
    const front = z > -0.02;
    const neckline = L.collar - (front ? 0.05 * Math.max(0, 1 - Math.abs(x) / 0.07) : 0);
    const skinAmount = skinAmountAt(base, i);
    // Suit: a little darker in the seams (collar, waist, zip) and a faint weave so it does not look like plastic.
    c.copy(SUIT);
    const weave = 1 + 0.035 * Math.sin(x * 900) * Math.sin(y * 870 + z * 640);
    c.multiplyScalar(weave);
    const seam = Math.max(
      1 - smooth(0, 0.012, Math.abs(y - neckline + 0.004)),
      1 - smooth(0, 0.01, Math.abs(y - L.waist)),
      front && y < L.collar - 0.02 && y > L.h * 0.47 ? 1 - smooth(0.002, 0.006, Math.abs(x)) : 0,
    );
    c.lerp(SUIT_SEAM, seam * 0.8);
    // Thigh pocket on the outside of each leg.
    if (y > L.h * 0.33 && y < L.h * 0.43 && Math.abs(x) > 0.11 && Math.abs(x) < 0.2 && Math.abs(z) < 0.07) c.lerp(SUIT_SEAM, 0.55);
    c.lerp(SHOE, smooth(0.45, 0.6, foot) * (y < 0.13 ? 1 : 0));
    c.lerp(skin, skinAmount);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  return { colors, L };
}

// A short-hair shell: scalp triangles, pushed out along their normals. Styles change the hairline and the volume.
function hairGeometry(base, L, style) {
  const src = base.geometry, pos = src.attributes.position, nor = src.attributes.normal, index = src.index.array;
  const cfg = {
    short: { back: 0.13, front: 0.068, lift: 0.009, top: 0.014 },
    crop: { back: 0.115, front: 0.062, lift: 0.005, top: 0.008 },
    buzz: { back: 0.11, front: 0.06, lift: 0.0025, top: 0.003 },
    bun: { back: 0.14, front: 0.07, lift: 0.008, top: 0.01 },
    tied: { back: 0.15, front: 0.07, lift: 0.01, top: 0.012 },
  }[style] || { back: 0.13, front: 0.068, lift: 0.009, top: 0.014 };
  const headCenterZ = L.headFront - 0.1;
  const inHair = i => {
    const y = pos.getY(i), z = pos.getZ(i), x = pos.getX(i);
    const below = L.headTop - y;
    const forward = THREE.MathUtils.clamp((z - headCenterZ) / 0.09, -1, 1);
    const limit = THREE.MathUtils.lerp(cfg.back, cfg.front, (forward + 1) / 2);
    if (below > limit || below < 0) return false;
    if (Math.abs(x) > 0.062 && below > 0.075 && forward > -0.3) return false;   // keep the ears out
    return true;
  };
  const keep = [];
  for (let t = 0; t < index.length; t += 3) if (inHair(index[t]) && inHair(index[t + 1]) && inHair(index[t + 2])) keep.push(index[t], index[t + 1], index[t + 2]);
  const used = [...new Set(keep)];
  const remap = new Map(used.map((v, i) => [v, i]));
  const out = new Float32Array(used.length * 3);
  used.forEach((v, i) => {
    const below = L.headTop - pos.getY(v);
    const lift = cfg.lift + cfg.top * Math.max(0, 1 - below / 0.06);
    out[i * 3] = pos.getX(v) + nor.getX(v) * lift;
    out[i * 3 + 1] = pos.getY(v) + nor.getY(v) * lift;
    out[i * 3 + 2] = pos.getZ(v) + nor.getZ(v) * lift;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(out, 3));
  g.setIndex(keep.map(v => remap.get(v)));
  g.computeVertexNormals();
  const parts = [g];
  if (style === 'bun' || style === 'tied') {
    const r = style === 'bun' ? 0.045 : 0.035;
    const knot = new THREE.SphereGeometry(r, 24, 16);
    knot.scale(1, 0.9, 0.85);
    knot.translate(0, L.headTop - (style === 'bun' ? 0.035 : 0.08), headCenterZ - 0.1);
    parts.push(knot);
  }
  return parts;
}

// A gentle fresnel rim, raised on hover and selection (uniform shared by both materials of one crew member).
function withRim(material, rim) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uRim = rim;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec2 uRim;')
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float fres = pow(1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0), 3.0);
        gl_FragColor.rgb += vec3(0.30, 0.42, 1.0) * fres * uRim.x + vec3(0.06, 0.09, 0.2) * uRim.y;`);
  };
  material.customProgramCacheKey = () => 'crew-rim';
  return material;
}

// Suit insignia, drawn once: a round mission patch (orbit and station silhouette) and a name tape per crew member.
let patchTexture = null;
function missionPatch() {
  if (patchTexture) return patchTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(128, 128, 124, 0, Math.PI * 2); g.fillStyle = '#F2F4F8'; g.fill();
  g.beginPath(); g.arc(128, 128, 108, 0, Math.PI * 2);
  const sky = g.createLinearGradient(0, 20, 0, 236); sky.addColorStop(0, '#1C2E6B'); sky.addColorStop(1, '#2F45C0');
  g.fillStyle = sky; g.fill();
  g.strokeStyle = '#F2F4F8'; g.lineWidth = 7;
  g.beginPath(); g.ellipse(128, 136, 92, 30, -0.35, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#F2F4F8';
  g.fillRect(84, 118, 88, 10); g.fillRect(122, 96, 12, 54); g.fillRect(70, 106, 18, 34); g.fillRect(168, 106, 18, 34);
  for (const [x, y, r] of [[70, 70, 4], [180, 64, 3], [200, 168, 3], [60, 176, 2.5], [150, 52, 2.5]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); }
  g.font = '600 26px "Chakra Petch", Arial, sans-serif'; g.textAlign = 'center';
  g.fillText('ISS 180', 128, 214);
  patchTexture = new THREE.CanvasTexture(c);
  patchTexture.colorSpace = THREE.SRGBColorSpace;
  patchTexture.anisotropy = 4;
  return patchTexture;
}

function nameTape(text) {
  const c = document.createElement('canvas');
  c.width = 384; c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = '#E9EDF4'; g.fillRect(0, 0, 384, 96);
  g.strokeStyle = '#B9C3D3'; g.lineWidth = 6; g.strokeRect(3, 3, 378, 90);
  g.fillStyle = '#17213D'; g.font = '600 58px "Chakra Petch", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, 192, 52);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Project a texture onto the chest where a ray from the front meets the suit.
function decalOn(mesh, x, y, size, material) {
  const ray = new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1));
  const hit = ray.intersectObject(mesh, false)[0];
  if (!hit) return null;
  const helper = new THREE.Object3D();
  helper.position.copy(hit.point);
  helper.lookAt(hit.point.clone().add(hit.face.normal));
  const decal = new THREE.Mesh(new DecalGeometry(mesh, hit.point, helper.rotation, size), material);
  decal.raycast = () => {};
  return decal;
}

// One crew member, standing, feet at the origin, facing +z. The returned group is centred at mid-height so that it
// can float and turn around its own middle.
export async function buildAstronaut(look, id = '') {
  const base = await loadBase(look.body);
  const geometry = base.geometry.clone();
  geometry.setIndex(base.geometry.index.clone());
  const { colors, L } = paint(base, look);
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const rim = { value: new THREE.Vector2(0, 0) };
  // One material for suit and skin, so the neckline and cuffs blend instead of stepping along triangle edges.
  const material = withRim(new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.74, sheen: 0.55, sheenRoughness: 0.7, sheenColor: new THREE.Color('#B9C8E8') }), rim);
  const bodyMesh = new THREE.Mesh(geometry, material);
  const hairMaterial = withRim(new THREE.MeshPhysicalMaterial({ color: look.hair, roughness: 0.62, sheen: 0.8, sheenRoughness: 0.4, sheenColor: new THREE.Color(look.hair).lerp(new THREE.Color('#ffffff'), 0.25) }), rim);
  const hair = hairGeometry(base, L, look.style).map(g => new THREE.Mesh(g, hairMaterial));
  const eyeMaterial = new THREE.MeshPhysicalMaterial({ color: '#2A211C', roughness: 0.15, clearcoat: 1 });
  const eyes = base.eyes.map(g => new THREE.Mesh(g, eyeMaterial));

  bodyMesh.updateMatrixWorld(true);
  const decalBase = { transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.8 };
  const patchMaterial = new THREE.MeshStandardMaterial({ ...decalBase, map: missionPatch() });
  const tapeTexture = nameTape(look.tape || id);
  const tapeMaterial = new THREE.MeshStandardMaterial({ ...decalBase, map: tapeTexture });
  const decals = [
    decalOn(bodyMesh, 0.085, L.patchY, new THREE.Vector3(0.075, 0.075, 0.1), patchMaterial),
    id ? decalOn(bodyMesh, -0.085, L.patchY, new THREE.Vector3(0.1, 0.026, 0.1), tapeMaterial) : null,
  ].filter(Boolean);

  const figure = new THREE.Group();
  figure.add(bodyMesh, ...hair, ...eyes, ...decals);
  figure.position.y = -base.height / 2;
  const pivot = new THREE.Group();
  pivot.add(figure);
  pivot.scale.set(look.girth, look.height, look.girth);
  pivot.userData = { height: base.height * look.height, rim, pickables: [bodyMesh, ...hair] };
  pivot.userData.dispose = () => {
    geometry.dispose(); hair.forEach(m => m.geometry.dispose()); decals.forEach(d => d.geometry.dispose());
    [material, hairMaterial, eyeMaterial, patchMaterial, tapeMaterial, tapeTexture].forEach(m => m.dispose());
  };
  return pivot;
}
