import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Procedural Soviet cars: VAZ-2106 «Жигули», GAZ-24 «Волга» (also as a taxi)
 * and the militsiya UAZ-469. Bodies are bevelled extrusions of real side
 * profiles; paint is clear-coated so the night HDRI reflects off it.
 * The car faces +Z; y = 0 is the ground.
 */
export type CarKind = 'zhiguli' | 'volga' | 'taxi' | 'uaz';

export interface CarSpec {
  kind: CarKind;
  length: number;
  width: number;
  wheelBase: number;
  track: number;
  wheelR: number;
  /** Side profile of the lower body: [z, y] from rear-bottom, clockwise. */
  body: [number, number][];
  cabin: [number, number][];
  cabinWidth: number;
  quadLamps: boolean;
}

export const SPECS: Record<CarKind, CarSpec> = {
  zhiguli: {
    kind: 'zhiguli', length: 4.17, width: 1.62, wheelBase: 2.42, track: 1.36, wheelR: 0.31, quadLamps: true,
    body: [[-2.08, 0.26], [-2.09, 0.78], [-2.0, 0.85], [-1.2, 0.87], [1.05, 0.86], [2.04, 0.8], [2.08, 0.32]],
    cabin: [[-1.22, 0.86], [-0.82, 1.4], [0.4, 1.42], [1.05, 0.86]], cabinWidth: 1.4,
  },
  volga: {
    kind: 'volga', length: 4.73, width: 1.8, wheelBase: 2.8, track: 1.48, wheelR: 0.34, quadLamps: true,
    body: [[-2.36, 0.3], [-2.37, 0.8], [-2.28, 0.88], [-1.35, 0.9], [1.2, 0.9], [2.32, 0.84], [2.36, 0.34]],
    cabin: [[-1.38, 0.89], [-0.86, 1.45], [0.5, 1.47], [1.22, 0.89]], cabinWidth: 1.56,
  },
  taxi: {
    kind: 'taxi', length: 4.73, width: 1.8, wheelBase: 2.8, track: 1.48, wheelR: 0.34, quadLamps: true,
    body: [[-2.36, 0.3], [-2.37, 0.8], [-2.28, 0.88], [-1.35, 0.9], [1.2, 0.9], [2.32, 0.84], [2.36, 0.34]],
    cabin: [[-1.38, 0.89], [-0.86, 1.45], [0.5, 1.47], [1.22, 0.89]], cabinWidth: 1.56,
  },
  uaz: {
    kind: 'uaz', length: 4.03, width: 1.78, wheelBase: 2.38, track: 1.44, wheelR: 0.4, quadLamps: false,
    body: [[-2.0, 0.5], [-2.0, 1.22], [1.15, 1.22], [1.4, 1.15], [2.0, 1.1], [2.02, 0.52]],
    cabin: [[-2.0, 1.2], [-1.98, 2.0], [0.82, 2.0], [1.0, 1.2]], cabinWidth: 1.66,
  },
};

export const PAINTS: Record<CarKind, number[]> = {
  zhiguli: [0x8a1c1c, 0xd8d2c0, 0x2b4f7a, 0x2f5a3a, 0xc8a23a, 0x5a2a4a, 0x3a3f44, 0xe8e2d4, 0x7a4a24],
  volga: [0x1a1a1c, 0xe8e4d8, 0x2c3e55, 0x4a5a4a, 0x6a1a1a],
  taxi: [0xd8b84a],
  uaz: [0xd8b42a],
};

const glassMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0f16, roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.88, clearcoat: 1 });
const chromeMat = new THREE.MeshStandardMaterial({ color: 0xdde2e8, roughness: 0.15, metalness: 1 });
const blackMat = new THREE.MeshStandardMaterial({ color: 0x0c0c0e, roughness: 0.7 });
const tyreMat = new THREE.MeshStandardMaterial({ color: 0x111113, roughness: 0.92 });
const canvasMat = new THREE.MeshStandardMaterial({ color: 0x3a3f2e, roughness: 0.95 });
const snowMat = new THREE.MeshStandardMaterial({ color: 0xeef2f8, roughness: 0.9 });
export const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1c8, emissiveIntensity: 3, roughness: 0.2 });
export const tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1a10, emissiveIntensity: 0.8, roughness: 0.3 });
export const brakeMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1a10, emissiveIntensity: 4, roughness: 0.3 });

const paintCache = new Map<number, THREE.MeshPhysicalMaterial>();
function paint(c: number) {
  let m = paintCache.get(c);
  if (!m) {
    m = new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.38, metalness: 0.15, clearcoat: 1, clearcoatRoughness: 0.06 });
    paintCache.set(c, m);
  }
  return m;
}

function plateTex(text: string) {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 56;
  const g = c.getContext('2d')!;
  g.fillStyle = '#f0ede4';
  g.fillRect(0, 0, 256, 56);
  g.strokeStyle = '#111';
  g.lineWidth = 4;
  g.strokeRect(3, 3, 250, 50);
  g.fillStyle = '#111';
  g.font = 'bold 38px "Arial Narrow", Arial';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 128, 30);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function textTex(text: string, fg: string, bg: string, w = 512, h = 96) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.font = `bold ${Math.floor(h * 0.7)}px "Arial Narrow", Arial`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, w / 2, h / 2 + 4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Soviet late-80s plate: «а 12-34 ТА» (ТА = Tatar ASSR). */
function randomPlate() {
  const L = 'абвгдежиклмнопрстуфхцчшщэюя';
  const d = () => Math.floor(Math.random() * 10);
  return `${L[Math.floor(Math.random() * L.length)]} ${d()}${d()}-${d()}${d()} ТА`;
}

function extrude(profile: [number, number][], width: number, mat: THREE.Material, bevel = 0.05) {
  const s = new THREE.Shape(profile.map(([z, y]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: width - bevel * 2, bevelEnabled: true, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 4 });
  geo.translate(0, 0, -(width - bevel * 2) / 2);
  // Shape is in (x=length, y=up) — turn it so length runs along +Z.
  geo.rotateY(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export interface CarVisual {
  root: THREE.Group;
  wheels: THREE.Object3D[]; // FL, FR, RL, RR
  steer: THREE.Object3D[]; // front wheel pivots
  brake: THREE.Mesh[];
  headlights: THREE.Mesh[];
  beacons: THREE.Mesh[];
  spec: CarSpec;
  color: number;
}

export function buildCar(kind: CarKind, color?: number, opts: { snow?: boolean } = {}): CarVisual {
  const spec = SPECS[kind];
  const col = color ?? PAINTS[kind][Math.floor(Math.random() * PAINTS[kind].length)];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const pm = paint(col);
  const W = spec.width, Lh = spec.length / 2;
  body.add(extrude(spec.body, W, pm, 0.06));

  // Cabin: glass greenhouse with a painted roof and pillars.
  const cab = extrude(spec.cabin, spec.cabinWidth, glassMat, 0.04);
  body.add(cab);
  const roofY = Math.max(...spec.cabin.map((p) => p[1]));
  const roofZs = spec.cabin.filter((p) => p[1] > roofY - 0.05).map((p) => p[0]);
  const roofLen = Math.max(...roofZs) - Math.min(...roofZs);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinWidth + 0.04, 0.06, roofLen + 0.08), kind === 'uaz' ? canvasMat : pm);
  roof.position.set(0, roofY + 0.0, (Math.max(...roofZs) + Math.min(...roofZs)) / 2);
  roof.castShadow = true;
  body.add(roof);
  if (kind === 'uaz') {
    // Canvas top over the whole rear.
    const top = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinWidth + 0.02, 0.78, 2.6), canvasMat);
    top.position.set(0, 1.6, -0.7);
    top.castShadow = true;
    body.add(top);
  }
  // Pillars: A, B and C on both sides.
  const [base0, rearTop, frontTop, base1] = [spec.cabin[0], spec.cabin[1], spec.cabin[2], spec.cabin[3]];
  for (const sx of [-1, 1]) {
    const x = sx * (spec.cabinWidth / 2 + 0.01);
    const pillar = (a: [number, number], b: [number, number]) => {
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, len, 0.08), pm);
      p.position.set(x, (a[1] + b[1]) / 2, (a[0] + b[0]) / 2);
      p.rotation.x = Math.atan2(b[0] - a[0], b[1] - a[1]);
      body.add(p);
    };
    pillar(base1, frontTop);
    pillar(base0, rearTop);
    pillar([(base0[0] + base1[0]) / 2 - 0.1, base0[1]], [(rearTop[0] + frontTop[0]) / 2 - 0.1, roofY]);
  }

  const beltY = spec.body[spec.body.length - 2][1];
  // Chrome bumpers
  for (const [z, s] of [[Lh + 0.04, 1], [-Lh - 0.04, -1]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(W + 0.06, 0.1, 0.1), kind === 'uaz' ? blackMat : chromeMat);
    b.position.set(0, spec.body[0][1] + 0.12, z);
    body.add(b);
    void s;
  }
  // Grille + headlights
  const front = Lh + 0.02;
  const grilleH = Math.min(0.26, beltY - spec.body[0][1] - 0.2);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(kind === 'uaz' ? 0.9 : W * 0.45, grilleH, 0.04), kind === 'volga' || kind === 'taxi' ? chromeMat : blackMat);
  grille.position.set(0, beltY - grilleH / 2 - 0.08, front + 0.02);
  body.add(grille);
  const headlights: THREE.Mesh[] = [];
  const lampY = beltY - 0.2;
  const lamp = (x: number, r: number) => {
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.02, r + 0.02, 0.05, 16), chromeMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(x, lampY, front + 0.03);
    const l = new THREE.Mesh(new THREE.CircleGeometry(r, 16), headMat);
    l.position.set(x, lampY, front + 0.06);
    body.add(ring, l);
    headlights.push(l);
  };
  if (spec.quadLamps) for (const sx of [-1, 1]) {
    lamp(sx * (W / 2 - 0.16), 0.085);
    lamp(sx * (W / 2 - 0.36), 0.085);
  }
  else for (const sx of [-1, 1]) lamp(sx * (W / 2 - 0.3), 0.11);
  // Tail lights
  const brake: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.04), tailMat.clone());
    t.position.set(sx * (W / 2 - 0.24), beltY - 0.14, -Lh - 0.02);
    body.add(t);
    brake.push(t);
  }
  // Plates
  const plateMat = new THREE.MeshStandardMaterial({ map: plateTex(randomPlate()), roughness: 0.5 });
  for (const [z, ry] of [[Lh + 0.1, 0], [-Lh - 0.1, Math.PI]] as const) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.11), plateMat);
    p.position.set(0, spec.body[0][1] + 0.26, z);
    p.rotation.y = ry;
    body.add(p);
  }
  // Side chrome strip and mirrors
  if (kind !== 'uaz')
    for (const sx of [-1, 1]) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.025, spec.length * 0.9), chromeMat);
      strip.position.set(sx * (W / 2 + 0.01), beltY - 0.28, 0);
      body.add(strip);
      const mir = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.06), chromeMat);
      mir.position.set(sx * (W / 2 + 0.06), beltY + 0.08, base1[0] - 0.15);
      body.add(mir);
    }

  const beacons: THREE.Mesh[] = [];
  if (kind === 'uaz') {
    // Militsiya livery: blue stripe, lettering and a roof beacon.
    for (const sx of [-1, 1]) {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(spec.length * 0.95, 0.22), new THREE.MeshStandardMaterial({ color: 0x1f3d9a, roughness: 0.4 }));
      stripe.position.set(sx * (W / 2 + 0.065), 0.86, 0);
      stripe.rotation.y = sx * Math.PI / 2;
      body.add(stripe);
      const word = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.3), new THREE.MeshStandardMaterial({ map: textTex('МИЛИЦИЯ', '#ffffff', '#1f3d9a'), roughness: 0.4 }));
      word.position.set(sx * (W / 2 + 0.07), 0.86, -0.4);
      word.rotation.y = sx * Math.PI / 2;
      body.add(word);
    }
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.22), blackMat);
    bar.position.set(0, 2.05, 0.4);
    body.add(bar);
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0x1030a0, emissive: 0x2050ff, emissiveIntensity: 0, roughness: 0.2 }));
      b.position.set(sx * 0.3, 2.16, 0.4);
      body.add(b);
      beacons.push(b);
    }
    // Spare wheel on the back
    const spare = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 20), tyreMat);
    spare.rotation.x = Math.PI / 2;
    spare.position.set(0.3, 1.0, -Lh - 0.15);
    body.add(spare);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.16), new THREE.MeshStandardMaterial({ map: textTex('ТАКСИ', '#111', '#ffd84a', 256, 64), emissive: 0xffc030, emissiveIntensity: 0.6 }));
    sign.position.set(0, roofY + 0.12, roof.position.z);
    body.add(sign);
    // Checker band on the doors
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 32;
    const g = c.getContext('2d')!;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111' : '#ffd84a';
      g.fillRect(i * 16, j * 16, 16, 16);
    }
    const ct = new THREE.CanvasTexture(c);
    ct.colorSpace = THREE.SRGBColorSpace;
    for (const sx of [-1, 1]) {
      const band = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.1), new THREE.MeshStandardMaterial({ map: ct }));
      band.position.set(sx * (W / 2 + 0.065), beltY - 0.1, 0);
      band.rotation.y = sx * Math.PI / 2;
      body.add(band);
    }
  }
  if (opts.snow) {
    // Parked cars wear a cap of snow.
    const s = new THREE.Mesh(new THREE.BoxGeometry(spec.cabinWidth - 0.05, 0.08, roofLen - 0.05), snowMat);
    s.position.set(0, roofY + 0.07, roof.position.z);
    body.add(s);
    const hood = new THREE.Mesh(new THREE.BoxGeometry(W - 0.15, 0.05, Lh - (base1[0] ?? 0) - 0.1), snowMat);
    hood.position.set(0, beltY + 0.04, (Lh + base1[0]) / 2);
    body.add(hood);
  }

  // Wheels: tyre + steel rim + chrome hubcap; front ones sit in steer pivots.
  const wheels: THREE.Object3D[] = [];
  const steer: THREE.Object3D[] = [];
  const tyreGeo = new THREE.CylinderGeometry(spec.wheelR, spec.wheelR, 0.2, 24);
  tyreGeo.rotateZ(Math.PI / 2);
  const rimGeo = new THREE.CylinderGeometry(spec.wheelR * 0.62, spec.wheelR * 0.62, 0.21, 16);
  rimGeo.rotateZ(Math.PI / 2);
  const capGeo = new THREE.CylinderGeometry(spec.wheelR * 0.3, spec.wheelR * 0.34, 0.23, 12);
  capGeo.rotateZ(Math.PI / 2);
  const rimMat = new THREE.MeshStandardMaterial({ color: kind === 'uaz' ? 0x2e3a24 : 0x9a9ea4, roughness: 0.4, metalness: 0.7 });
  for (const [fz, sx] of [[1, -1], [1, 1], [-1, -1], [-1, 1]] as const) {
    const pivot = new THREE.Group();
    pivot.position.set(sx * spec.track / 2, spec.wheelR, fz * spec.wheelBase / 2);
    const w = new THREE.Group();
    const t = new THREE.Mesh(tyreGeo, tyreMat);
    t.castShadow = true;
    w.add(t, new THREE.Mesh(rimGeo, rimMat), new THREE.Mesh(capGeo, chromeMat));
    pivot.add(w);
    root.add(pivot);
    wheels.push(w);
    if (fz > 0) steer.push(pivot);
  }
  // Dark wheel-arch liners so you can't see through the body above the tyres.
  for (const fz of [1, -1])
    for (const sx of [-1, 1]) {
      const liner = new THREE.Mesh(new THREE.CylinderGeometry(spec.wheelR + 0.05, spec.wheelR + 0.05, 0.22, 16, 1, true, -Math.PI / 2, Math.PI), blackMat);
      liner.rotation.z = Math.PI / 2;
      liner.position.set(sx * (W / 2 - 0.14), spec.wheelR, fz * spec.wheelBase / 2);
      body.add(liner);
    }
  mergeStatic(body, new Set<THREE.Object3D>([...brake, ...beacons]));
  return { root, wheels, steer, brake, headlights, beacons, spec, color: col };
}

/** Collapse a car body's static meshes into one mesh per material (≈10 draw calls per car). */
function mergeStatic(body: THREE.Group, keep: Set<THREE.Object3D>) {
  body.updateMatrixWorld(true);
  const inv = body.matrixWorld.clone().invert();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  const remove: THREE.Mesh[] = [];
  body.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || keep.has(m)) return;
    const g = m.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, m.matrixWorld));
    // Normalise attributes so different primitive types merge.
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    const ng = g.index ? g.toNonIndexed() : g;
    const mat = m.material as THREE.Material;
    if (!byMat.has(mat)) byMat.set(mat, []);
    byMat.get(mat)!.push(ng);
    remove.push(m);
  });
  for (const m of remove) m.parent!.remove(m);
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = mat !== glassMat;
    mesh.receiveShadow = true;
    body.add(mesh);
  }
}
