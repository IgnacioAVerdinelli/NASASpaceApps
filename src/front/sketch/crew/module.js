// A station module interior, built from simple geometry: four walls of equipment racks around a square aisle with
// chamfered corners, light strips, handrails, laptops, cargo bags, cables and a hatch at the far end. It is a credible
// stand-in for a US lab module, not a model of a real one. Units are metres; the aisle runs along -z.
import * as THREE from 'three';

export const AISLE = { width: 2.1, height: 2.1, near: 2.4, far: -9.2 };

const RACK_WIDTH = 1.05;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// A canvas texture: rack faces with panel lines, labels and small switches, so close walls are not flat.
function rackTexture() {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const g = c.getContext('2d');
  g.fillStyle = '#ECEFF3'; g.fillRect(0, 0, 512, 512);
  const rand = rng(11);
  g.strokeStyle = 'rgba(70,85,110,.28)'; g.lineWidth = 3;
  g.strokeRect(6, 6, 500, 500);
  for (let y = 0; y < 4; y++) {
    const top = 20 + y * 122;
    g.fillStyle = y % 2 ? '#E4E8EE' : '#F2F4F7';
    g.fillRect(24, top, 464, 106);
    g.strokeStyle = 'rgba(70,85,110,.22)'; g.lineWidth = 2; g.strokeRect(24, top, 464, 106);
    for (let k = 0; k < 6; k++) {
      g.fillStyle = 'rgba(60,72,95,.45)';
      g.beginPath(); g.arc(44 + k * 16, top + 16, 3.5, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(40,52,78,.35)';
    g.fillRect(360, top + 10, 110, 10);
    if (rand() > 0.4) { g.fillStyle = '#F4F1E8'; g.fillRect(60, top + 40, 120, 46); g.strokeStyle = 'rgba(70,85,110,.25)'; g.strokeRect(60, top + 40, 120, 46); }
    if (rand() > 0.5) { g.fillStyle = 'rgba(47,69,192,.55)'; g.fillRect(400, top + 70, 60, 8); }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function screenTexture(seed) {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, 160);
  grad.addColorStop(0, '#1C2C52'); grad.addColorStop(1, '#13203E');
  g.fillStyle = grad; g.fillRect(0, 0, 256, 160);
  const rand = rng(seed);
  g.strokeStyle = '#7FA3E6'; g.lineWidth = 3; g.beginPath();
  for (let x = 0; x <= 256; x += 16) { const y = 100 - rand() * 50; x ? g.lineTo(x, y) : g.moveTo(x, y); }
  g.stroke();
  g.fillStyle = 'rgba(200,215,245,.55)';
  for (let r = 0; r < 4; r++) g.fillRect(14, 16 + r * 12, 60 + rand() * 80, 5);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildModule() {
  const group = new THREE.Group();
  group.name = 'module';
  const disposables = [];
  const keep = x => { disposables.push(x); return x; };
  const { width: W, height: H, near, far } = AISLE;
  const length = near - far;
  const rand = rng(7);

  const rackMap = keep(rackTexture());
  rackMap.wrapS = rackMap.wrapT = THREE.RepeatWrapping;
  const rackMat = keep(new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: rackMap, roughness: 0.75, metalness: 0.05 }));
  const frameMat = keep(new THREE.MeshStandardMaterial({ color: '#C9D1DC', roughness: 0.55, metalness: 0.25 }));
  const lightMat = keep(new THREE.MeshStandardMaterial({ color: '#FFFFFF', emissive: '#F4F8FF', emissiveIntensity: 2.2, roughness: 0.4 }));
  const railMat = keep(new THREE.MeshStandardMaterial({ color: '#8C98AE', roughness: 0.35, metalness: 0.6 }));
  const bagMat = keep(new THREE.MeshStandardMaterial({ color: '#E7DFCD', roughness: 0.95 }));
  const bagBlueMat = keep(new THREE.MeshStandardMaterial({ color: '#B9C6DE', roughness: 0.95 }));
  const cableMat = keep(new THREE.MeshStandardMaterial({ color: '#9AA5B6', roughness: 0.6 }));
  const darkMat = keep(new THREE.MeshStandardMaterial({ color: '#2B3346', roughness: 0.5, metalness: 0.3 }));

  // Walls: one box per rack bay, inset a little from the aisle so the seams catch light.
  const bays = Math.ceil(length / RACK_WIDTH);
  const sideGeo = keep(new THREE.BoxGeometry(0.12, H - 0.5, RACK_WIDTH - 0.03));
  const flatGeo = keep(new THREE.BoxGeometry(W - 0.5, 0.12, RACK_WIDTH - 0.03));
  for (let b = 0; b < bays; b++) {
    const z = near - (b + 0.5) * RACK_WIDTH;
    for (const [geo, x, y] of [[sideGeo, -W / 2 - 0.06, H / 2], [sideGeo, W / 2 + 0.06, H / 2], [flatGeo, 0, H + 0.06], [flatGeo, 0, -0.06]]) {
      const rack = new THREE.Mesh(geo, rackMat);
      rack.position.set(x, y, z);
      rack.receiveShadow = true;
      group.add(rack);
    }
  }
  // Chamfered corners: long panels at 45° where walls meet, with the light strips on the upper two.
  const cornerGeo = keep(new THREE.BoxGeometry(0.4, 0.05, length));
  const stripGeo = keep(new THREE.BoxGeometry(0.13, 0.02, 1.1));
  for (const [sx, sy] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
    const angle = -sx * sy * Math.PI / 4;
    const corner = new THREE.Mesh(cornerGeo, frameMat);
    corner.position.set(sx * (W / 2 - 0.115), sy > 0 ? H - 0.115 : 0.115, (near + far) / 2);
    corner.rotation.z = angle;
    group.add(corner);
    if (sy > 0) {
      for (let z = near - 0.8; z > far + 0.5; z -= 2.1) {
        const strip = new THREE.Mesh(stripGeo, lightMat);
        strip.position.set(sx * (W / 2 - 0.135), H - 0.135, z);
        strip.rotation.z = angle;
        group.add(strip);
      }
    }
  }
  // Handrails along both walls and the floor.
  const railGeo = keep(new THREE.CylinderGeometry(0.016, 0.016, 0.62, 12));
  for (let b = 0; b < bays; b++) {
    const z = near - (b + 0.5) * RACK_WIDTH;
    for (const [x, y] of [[-W / 2 + 0.03, 1.05], [W / 2 - 0.03, 1.05], [-0.45, 0.04], [0.45, 0.04]]) {
      if (rand() < 0.35) continue;
      const rail = new THREE.Mesh(railGeo, railMat);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(x, y + (Math.abs(x) > 0.6 ? (rand() - 0.5) * 0.3 : 0), z);
      group.add(rail);
    }
  }
  // Laptops on arms, cargo bags strapped to racks, a few cable runs.
  const laptopGeo = keep(new THREE.BoxGeometry(0.36, 0.24, 0.02));
  const baseGeo = keep(new THREE.BoxGeometry(0.36, 0.02, 0.24));
  [[-1, 1.25, -0.9], [1, 1.3, -2.8], [-1, 1.2, -5.2], [1, 1.25, -7.1]].forEach(([side, y, z], k) => {
    const screenMap = keep(screenTexture(k + 3));
    const screenMat = keep(new THREE.MeshStandardMaterial({ color: '#FFFFFF', map: screenMap, emissive: '#FFFFFF', emissiveMap: screenMap, emissiveIntensity: 0.9, roughness: 0.3 }));
    const laptop = new THREE.Group();
    const lid = new THREE.Mesh(laptopGeo, [darkMat, darkMat, darkMat, darkMat, screenMat, darkMat]);
    lid.position.set(0, 0.12, -0.11);
    lid.rotation.x = -0.25;
    const base = new THREE.Mesh(baseGeo, darkMat);
    laptop.add(lid, base);
    laptop.position.set(side * (W / 2 - 0.32), y, z);
    laptop.rotation.y = -side * Math.PI / 2 + side * 0.25;
    group.add(laptop);
  });
  const bagGeo = keep(new THREE.BoxGeometry(0.5, 0.36, 0.28, 2, 2, 2));
  [[-1, 0.55, 0.6], [1, 0.5, -1.4], [-1, 0.45, -3.4], [1, 1.55, -4.4], [-1, 1.6, -6.4], [1, 0.6, -8.0], [-1, 0.6, 1.6]].forEach(([side, y, z], k) => {
    const bag = new THREE.Mesh(bagGeo, k % 3 === 1 ? bagBlueMat : bagMat);
    bag.position.set(side * (W / 2 - 0.16), y, z);
    bag.rotation.set((rand() - 0.5) * 0.1, (rand() - 0.5) * 0.2, (rand() - 0.5) * 0.15);
    group.add(bag);
  });
  for (const [x, y] of [[-W / 2 + 0.2, H - 0.25], [W / 2 - 0.25, H - 0.2], [-W / 2 + 0.15, 0.3]]) {
    const pts = [];
    for (let i = 0; i <= 12; i++) {
      const z = near - (i / 12) * (length - 0.5);
      pts.push(new THREE.Vector3(x + Math.sin(i * 1.3) * 0.05, y + Math.sin(i * 0.8) * 0.06 - (i % 3 === 1 ? 0.07 : 0), z));
    }
    const cable = new THREE.Mesh(keep(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 120, 0.012, 8)), cableMat);
    group.add(cable);
  }
  // The hatch at the far end: a square frame with rounded corners and the next module's light beyond it.
  const hatchShape = new THREE.Shape();
  hatchShape.moveTo(-W / 2 - 0.2, -0.2); hatchShape.lineTo(W / 2 + 0.2, -0.2); hatchShape.lineTo(W / 2 + 0.2, H + 0.2); hatchShape.lineTo(-W / 2 - 0.2, H + 0.2); hatchShape.lineTo(-W / 2 - 0.2, -0.2);
  const hole = new THREE.Path();
  const r = 0.22, hw = 0.55, y0 = H / 2 - 0.6, y1 = H / 2 + 0.6;
  hole.moveTo(-hw + r, y0); hole.lineTo(hw - r, y0); hole.quadraticCurveTo(hw, y0, hw, y0 + r); hole.lineTo(hw, y1 - r); hole.quadraticCurveTo(hw, y1, hw - r, y1);
  hole.lineTo(-hw + r, y1); hole.quadraticCurveTo(-hw, y1, -hw, y1 - r); hole.lineTo(-hw, y0 + r); hole.quadraticCurveTo(-hw, y0, -hw + r, y0);
  hatchShape.holes.push(hole);
  const bulkhead = new THREE.Mesh(keep(new THREE.ExtrudeGeometry(hatchShape, { depth: 0.12, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 })), frameMat);
  bulkhead.position.z = far;
  group.add(bulkhead);
  const beyond = new THREE.Mesh(keep(new THREE.PlaneGeometry(1.4, 1.5)), keep(new THREE.MeshBasicMaterial({ color: '#F4F7FC' })));
  beyond.position.set(0, H / 2, far - 0.8);
  group.add(beyond);

  // Light: a cool sky/ground fill, the strips as soft area-like point lights, and one key light for shape.
  const hemi = new THREE.HemisphereLight('#F2F6FF', '#9AA6BA', 1.35);
  group.add(hemi);
  for (let z = near - 1.5; z > far; z -= 3.2) {
    const p = new THREE.PointLight('#F3F7FF', 7, 6.5, 1.6);
    p.position.set(0, H - 0.25, z);
    group.add(p);
  }

  group.userData.dispose = () => disposables.forEach(d => d.dispose());
  group.userData.materials = [rackMat, frameMat, lightMat, railMat, bagMat, bagBlueMat, cableMat, darkMat];
  return group;
}
