import * as THREE from 'three';
import { BoxGrid, type Box } from '../core/collision';
import { pbrMaterial, type Assets } from '../core/assets';
import { Facades } from './Facades';
import { Trees } from './Trees';
import { mulberry32, pick, range } from '../core/math';
import {
  garageTex, shopfrontTex, glowTex, iceTex, panelFacade, signTex, type Facade,
} from './textures';

export type Zone = 'universam' | 'razezd' | 'hadi';
export const ZONE_NAMES: Record<Zone, string> = {
  universam: 'Универсам',
  razezd: 'Разъезд',
  hadi: 'Хади Такташ',
};
export const ZONE_COLORS: Record<Zone, string> = {
  universam: '#d23b3b',
  razezd: '#3b7bd2',
  hadi: '#d2a23b',
};

export const N = 6; // blocks per side
export const BLOCK = 64;
export const ROAD = 14;
export const PITCH = BLOCK + ROAD;
export const HALF = (N * PITCH) / 2;
const SIDEWALK = 2.6;

/** Centre of block (i, j). */
export const blockCenter = (i: number, j: number) => ({ x: -HALF + ROAD / 2 + BLOCK / 2 + i * PITCH, z: -HALF + ROAD / 2 + BLOCK / 2 + j * PITCH });

export function zoneOfBlock(i: number, j: number): Zone {
  if (j <= 1) return 'hadi';
  return i <= 2 ? 'universam' : 'razezd';
}

export function zoneAt(x: number, z: number): Zone {
  const i = Math.max(0, Math.min(N - 1, Math.floor((x + HALF) / PITCH)));
  const j = Math.max(0, Math.min(N - 1, Math.floor((z + HALF) / PITCH)));
  return zoneOfBlock(i, j);
}

export interface Landmark {
  name: string;
  x: number;
  z: number;
}

export interface Hangout {
  x: number;
  z: number;
  zone: Zone;
}

/** Batches identical props into InstancedMeshes. */
class Instancer {
  private sets = new Map<string, { geo: THREE.BufferGeometry; mat: THREE.Material; m: THREE.Matrix4[]; shadow: boolean }>();
  private tmp = new THREE.Object3D();
  add(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0, sx = 1, sy = 1, sz = 1, shadow = true, rx = 0, rz = 0) {
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = { geo, mat, m: [], shadow }));
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(rx, ry, rz);
    this.tmp.scale.set(sx, sy, sz);
    this.tmp.updateMatrix();
    s.m.push(this.tmp.matrix.clone());
  }
  build(parent: THREE.Object3D) {
    for (const s of this.sets.values()) {
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.m.length);
      s.m.forEach((m, i) => im.setMatrixAt(i, m));
      im.castShadow = s.shadow;
      im.receiveShadow = true;
      im.frustumCulled = false;
      parent.add(im);
    }
  }
}

export class City {
  group = new THREE.Group();
  grid = new BoxGrid(24);
  boxes: Box[] = [];
  landmarks: Landmark[] = [];
  hangouts: Hangout[] = [];
  /** Sidewalk corner nodes and their neighbours, for pedestrians. */
  walkNodes: { x: number; z: number; next: number[] }[] = [];
  spawn = { x: 0, z: 0, heading: 0 };
  /** Street-lamp heads, for the moving real lights. */
  lampSpots: THREE.Vector3[] = [];
  private inst = new Instancer();
  private rnd = mulberry32(1989);
  private facades: { f: Facade; mat: THREE.Material }[] = [];
  private roofMat = new THREE.MeshStandardMaterial({ color: 0xe6ebf2, roughness: 0.85 });
  private signs: THREE.Mesh[] = [];

  private props = new PropInstancer();
  facadeKit: Facades;
  private trees: Trees;

  constructor(private assets: Assets) {
    this.facadeKit = new Facades(assets);
    this.trees = new Trees(assets);
    this.makeFacades();
    this.ground();
    this.roads();
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) this.block(i, j);
    this.lights();
    this.busStops();
    this.walkGraph();
    this.inst.build(this.group);
    this.props.build(this.group, assets);
    this.facadeKit.build(this.group);
    this.trees.build(this.group);
    this.group.updateMatrixWorld(true);
  }

  private makeFacades() {
    // Only the distant skyline still uses a painted facade.
    const f = panelFacade(100, '#b9b5aa', true, false);
    const mat = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emissive, emissive: 0xffe2b0, emissiveIntensity: 1.6, roughness: 0.9 });
    this.facades.push({ f, mat });
  }

  private addBox(b: Box) {
    this.boxes.push(b);
    this.grid.add(b);
  }

  /** A Soviet apartment block with a real 3D facade (see Facades). */
  building(cx: number, cz: number, w: number, d: number, floors: number, facade: number, entrancesSide: 0 | 1 | -1 = 0) {
    const style = (['panel', 'panelBeige', 'brick', 'panelBlue', 'brick'] as const)[facade % 5];
    const h = this.facadeKit.addBuilding({ cx, cz, w, d, floors, style, entrance: entrancesSide, seed: Math.floor(this.rnd() * 1e6) }, this.group);
    this.addBox({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, h });
    // Entrances (podyezdy) along one long side, with a canopy and a lamp.
    if (entrancesSide !== 0) {
      const alongX = w >= d;
      const len = alongX ? w : d;
      const n = Math.max(1, Math.floor(len / 14));
      for (let k = 0; k < n; k++) {
        const t = -len / 2 + (len / n) * (k + 0.5);
        const ex = alongX ? cx + t : cx + entrancesSide * (w / 2 + 0.05);
        const ez = alongX ? cz + entrancesSide * (d / 2 + 0.05) : cz + t;
        const ry = alongX ? 0 : Math.PI / 2;
        this.inst.add('door', new THREE.BoxGeometry(1.6, 2.3, 0.2), new THREE.MeshStandardMaterial({ color: 0x4d3a2a, roughness: 0.8 }), ex, 1.15, ez, ry, 1, 1, 1, false);
        const cox = alongX ? ex : ex + entrancesSide * 0.7;
        const coz = alongX ? ez + entrancesSide * 0.7 : ez;
        this.inst.add('canopy', new THREE.BoxGeometry(2.4, 0.15, 1.4), new THREE.MeshStandardMaterial({ color: 0x8c8f94 }), cox, 2.7, coz, ry);
        this.inst.add('canopySnow', new THREE.BoxGeometry(2.4, 0.12, 1.4), this.roofMat, cox, 2.83, coz, ry, 1, 1, 1, false);
        this.inst.add('doorLamp', new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffd38a }), alongX ? ex : ex + entrancesSide * 0.25, 2.5, alongX ? ez + entrancesSide * 0.25 : ez, 0, 1, 1, 1, false);
        this.glow(alongX ? ex : ex + entrancesSide * 0.3, 2.5, alongX ? ez + entrancesSide * 0.3 : ez, 1.6, 0xffc070);
        this.pool(alongX ? ex : ex + entrancesSide * 1.5, alongX ? ez + entrancesSide * 1.5 : ez, 3.5, 0xffb060);
      }
    }
    return h;
  }

  private ground() {
    const size = HALF * 2 + 400;
    const g = new THREE.Mesh(new THREE.PlaneGeometry(size, size), pbrMaterial(this.assets.tex.snow_01, size / 2.2, size / 2.2, { roughness: 0.9, color: 0xf2f5fa }));
    g.rotation.x = -Math.PI / 2;
    g.receiveShadow = true;
    this.group.add(g);
    // Distant skyline so the world doesn't end in a void.
    const far = this.facades[0].mat;
    const r = mulberry32(7);
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * Math.PI * 2;
      const dist = HALF + 90 + r() * 80;
      const w = 20 + r() * 30;
      const h = 20 + r() * 40;
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 14), far);
      m.position.set(Math.cos(a) * dist, h / 2, Math.sin(a) * dist);
      m.lookAt(0, h / 2, 0);
      this.group.add(m);
    }
    // Invisible walls at the district edge.
    const e = HALF + 6;
    this.addBox({ minX: -e - 5, maxX: -e, minZ: -e - 5, maxZ: e + 5, h: 30 });
    this.addBox({ minX: e, maxX: e + 5, minZ: -e - 5, maxZ: e + 5, h: 30 });
    this.addBox({ minX: -e - 5, maxX: e + 5, minZ: -e - 5, maxZ: -e, h: 30 });
    this.addBox({ minX: -e - 5, maxX: e + 5, minZ: e, maxZ: e + 5, h: 30 });
  }

  private roads() {
    const len = N * PITCH + ROAD;
    const asphaltMat = pbrMaterial(this.assets.tex.asphalt_snow, (ROAD - SIDEWALK * 2) / 4, len / 4, { polygonOffset: true, polygonOffsetFactor: -1, roughness: 0.72, envMapIntensity: 1.6 });
    const swMat = pbrMaterial(this.assets.tex.concrete_pavement, SIDEWALK / 2, len / 2);
    for (let k = 0; k <= N; k++) {
      const c = -HALF + k * PITCH;
      for (const vertical of [true, false]) {
        const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD - SIDEWALK * 2, len), asphaltMat);
        road.rotation.x = -Math.PI / 2;
        if (!vertical) road.rotation.z = Math.PI / 2;
        road.position.set(vertical ? c : 0, vertical ? 0.02 : 0.025, vertical ? 0 : c);
        road.receiveShadow = true;
        this.group.add(road);
        for (const s of [-1, 1]) {
          const off = c + s * (ROAD / 2 - SIDEWALK / 2);
          const geo = new THREE.BoxGeometry(SIDEWALK, 0.14, len);
          const m = new THREE.Mesh(geo, swMat);
          if (vertical) m.position.set(off, 0.07, 0);
          else {
            m.rotation.y = Math.PI / 2;
            m.position.set(0, 0.071, off);
          }
          m.receiveShadow = true;
          this.group.add(m);
        }
      }
    }
    // Snowbanks pushed to the kerbs by the ploughs.
    const bankGeo = new THREE.SphereGeometry(1, 8, 5);
    const bankMat = pbrMaterial(this.assets.tex.snow_01, 1, 1, { color: 0xf0f3f8 });
    for (let k = 0; k <= N; k++) {
      const c = -HALF + k * PITCH;
      for (let s = -HALF; s < HALF; s += 5 + this.rnd() * 8) {
        if (Math.abs(((s + HALF) % PITCH) - 0) < ROAD) continue; // keep crossings clear
        const side = this.rnd() < 0.5 ? -1 : 1;
        const o = c + side * (ROAD / 2 - SIDEWALK - 0.6);
        const sx = 0.8 + this.rnd() * 0.6, sl = 1.5 + this.rnd() * 2.5;
        if (this.rnd() < 0.5) this.inst.add('bank', bankGeo, bankMat, o, 0, s, 0, sx, 0.45, sl, false);
        else this.inst.add('bank', bankGeo, bankMat, s, 0, o, 0, sl, 0.45, sx, false);
      }
    }
  }

  /** Soviet bus stops on the pavements, some with a kiosk beside them. */
  private busStops() {
    const r = this.rnd;
    for (let k = 1; k < N; k++)
      for (let seg = 0; seg < N; seg++) {
        if (r() < 0.6) continue;
        const vertical = r() < 0.5;
        const side = r() < 0.5 ? 1 : -1;
        const along = -HALF + seg * PITCH + PITCH / 2 + (r() - 0.5) * 16;
        const off = -HALF + k * PITCH + side * (ROAD / 2 - SIDEWALK / 2 + 0.3);
        const x = vertical ? off : along, z = vertical ? along : off;
        // The open side faces the road.
        const ry = vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
        this.props.add('bus_stop', x, 0.14, z, ry, 1);
        const lx = vertical ? 0.9 : 1.9, lz = vertical ? 1.9 : 0.9;
        this.addBox({ minX: x - lx, maxX: x + lx, minZ: z - lz, maxZ: z + lz, h: 2.6 });
        if (r() < 0.5) {
          const ka = along + 4.6;
          const kx = vertical ? off + side * 0.2 : ka, kz = vertical ? ka : off + side * 0.2;
          this.props.add('kiosk', kx, 0.14, kz, ry, 0.85);
          const kl = 1.3;
          this.addBox({ minX: kx - kl, maxX: kx + kl, minZ: kz - kl, maxZ: kz + kl, h: 2.6 });
        }
      }
  }

  private glow(x: number, y: number, z: number, size: number, color: number) {
    const key = 'glow' + color;
    let mat = this.glowMats.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ map: this.glowT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 });
      this.glowMats.set(key, mat);
    }
    // Camera-facing is approximated with three crossed quads.
    for (const ry of [0, Math.PI / 3, (2 * Math.PI) / 3]) this.inst.add(key, this.quad, mat, x, y, z, ry, size, size, 1, false);
  }
  private pool(x: number, z: number, size: number, color: number) {
    const key = 'pool' + color;
    let mat = this.glowMats.get(key);
    if (!mat) {
      mat = new THREE.MeshBasicMaterial({ map: this.glowT, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.38 });
      this.glowMats.set(key, mat);
    }
    this.inst.add(key, this.quad, mat, x, 0.16, z, 0, size * 2, size * 2, 1, false, -Math.PI / 2);
  }
  private glowT = glowTex();
  private glowMats = new Map<string, THREE.Material>();
  private quad = new THREE.PlaneGeometry(1, 1);

  private lights() {
    const headGeo = new THREE.BoxGeometry(0.4, 0.18, 0.7);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffd090, toneMapped: false });
    for (let k = 0; k <= N; k++) {
      const c = -HALF + k * PITCH;
      for (let s = -HALF + 12; s < HALF; s += 26) {
        for (const vertical of [true, false]) {
          const side = (Math.floor(s / 26) + k) % 2 ? 1 : -1;
          const o = c + side * (ROAD / 2 - 0.7);
          const x = vertical ? o : s, z = vertical ? s : o;
          const ry = vertical ? (side > 0 ? -Math.PI / 2 : Math.PI / 2) : side > 0 ? Math.PI : 0;
          this.props.add('street_lamp_01', x, 0, z, ry, 1.8);
          this.lampSpots.push(new THREE.Vector3(x, 6.2, z));
          this.inst.add('lamp', headGeo, headMat, x, 6.55, z, ry, 0.5, 0.5, 0.5, false);
          this.glow(x, 6.5, z, 3.2, 0xffa040);
          this.pool(x, z, 6.5, 0xff9a40);
          this.addBox({ minX: x - 0.15, maxX: x + 0.15, minZ: z - 0.15, maxZ: z + 0.15, h: 7.5 });
        }
      }
    }
  }

  private tree(x: number, z: number, birch: boolean) {
    const r = this.rnd;
    const kind = birch ? (r() < 0.55 ? 'birch' : 'poplar') : 'spruce';
    this.trees.add(kind, x, z, 0.85 + r() * 0.35, r() * 6.28, Math.floor(r() * 3));
    const rad = kind === 'spruce' ? 0.6 : 0.3;
    this.addBox({ minX: x - rad, maxX: x + rad, minZ: z - rad, maxZ: z + rad, h: 8 });
  }

  private bench(x: number, z: number, ry: number) {
    this.props.add('painted_wooden_bench', x, 0, z, ry + Math.PI, 1.5);
    this.addBox({ minX: x - 0.9, maxX: x + 0.9, minZ: z - 0.9, maxZ: z + 0.9, h: 0.9 });
  }

  /** Lived-in courtyard: parked cars under tarps, bins, junk, utility boxes. */
  private dressYard(cx: number, cz: number, layout: number) {
    const r = this.rnd;
    const free = (x: number, z: number, rad: number) => this.grid.query(x - rad, z - rad, x + rad, z + rad, new Set()).size === 0;
    // Bins with rubbish around them
    const bx = cx + 18, bz = cz + 2;
    if (free(bx, bz, 2)) {
      this.props.add('metal_trash_can', bx, 0, bz, Math.PI, 1);
      this.props.add('trashbag', bx - 1.6, 0, bz + 0.6, r() * 6, 1.1);
      this.props.add('trashbag', bx + 1.4, 0, bz + 0.8, r() * 6, 0.9);
      this.addBox({ minX: bx - 1, maxX: bx + 1, minZ: bz - 0.4, maxZ: bz + 0.4, h: 1 });
    }
    // Parked cars covered for the winter
    const carZ = layout === 0 ? cz - 9 : cz - 14;
    for (let k = 0; k < 3; k++) {
      const x = cx - 20 + k * 6 + r() * 2, z = carZ + (layout === 0 ? 0 : 0);
      if (!free(x, z, 2.5) || r() < 0.25) continue;
      const ry = Math.PI / 2 + (r() - 0.5) * 0.15;
      this.props.add('covered_car', x, 0, z, ry, 1);
      this.addBox({ minX: x - 2.2, maxX: x + 2.2, minZ: z - 0.95, maxZ: z + 0.95, h: 1.4 });
    }
    // Odds and ends
    for (let k = 0; k < 4; k++) {
      const x = cx + range(r, -26, 26), z = cz + range(r, -26, 26);
      if (!free(x, z, 1.2)) continue;
      const what = pick(r, ['old_tyre', 'old_tyre', 'wooden_crate_01', 'trashbag', 'dead_tree_trunk', 'utility_box_01'] as const);
      this.props.add(what, x, what === 'old_tyre' ? 0.08 : 0, z, r() * 6, what === 'dead_tree_trunk' ? 1.2 : 1);
      if (what === 'utility_box_01' || what === 'wooden_crate_01') this.addBox({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4, h: 1 });
    }
  }

  private playground(x: number, z: number) {
    const metal = new THREE.MeshStandardMaterial({ color: 0xc23a2a, roughness: 0.5, metalness: 0.3 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2a5ac2, roughness: 0.5, metalness: 0.3 });
    // Swing frame
    for (const s of [-1, 1]) {
      this.inst.add('swingLeg', new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), metal, x + s * 1.3, 1.25, z - 0.5, 0, 1, 1, 1, true, 0.35);
      this.inst.add('swingLeg', new THREE.CylinderGeometry(0.05, 0.05, 2.6, 5), metal, x + s * 1.3, 1.25, z + 0.5, 0, 1, 1, 1, true, -0.35);
    }
    this.inst.add('swingTop', new THREE.CylinderGeometry(0.05, 0.05, 2.8, 5), metal, x, 2.45, z, 0, 1, 1, 1, true, 0, Math.PI / 2);
    this.inst.add('swingSeat', new THREE.BoxGeometry(0.6, 0.05, 0.3), blue, x, 0.6, z);
    // Slide (gorka) and a snowman
    this.inst.add('slide', new THREE.BoxGeometry(0.9, 0.08, 4), blue, x + 4, 1.2, z, 0, 1, 1, 1, true, 0.55);
    this.inst.add('slideTower', new THREE.BoxGeometry(1, 2.2, 1), metal, x + 4, 1.1, z - 2.2);
    const snow = this.roofMat;
    const ball = new THREE.SphereGeometry(1, 10, 8);
    this.inst.add('snowman', ball, snow, x - 4, 0.45, z + 1, 0, 0.55, 0.5, 0.55);
    this.inst.add('snowman', ball, snow, x - 4, 1.15, z + 1, 0, 0.4, 0.38, 0.4);
    this.inst.add('snowman', ball, snow, x - 4, 1.65, z + 1, 0, 0.27, 0.27, 0.27);
    this.inst.add('carrot', new THREE.ConeGeometry(0.04, 0.25, 5), new THREE.MeshStandardMaterial({ color: 0xe06a1a }), x - 4, 1.65, z + 1.32, 0, 1, 1, 1, false, Math.PI / 2);
    this.addBox({ minX: x - 1.5, maxX: x + 1.5, minZ: z - 0.8, maxZ: z + 0.8, h: 2.5 });
    this.addBox({ minX: x + 3.4, maxX: x + 4.6, minZ: z - 2.8, maxZ: z + 2, h: 2.2 });
  }

  private sign(text: string, x: number, y: number, z: number, w: number, h: number, ry: number, fg: string, bg = 'rgba(10,10,14,1)') {
    const mat = new THREE.MeshBasicMaterial({ map: signTex(text, fg, bg), toneMapped: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    this.group.add(m);
    this.signs.push(m);
    const back = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, h + 0.2, 0.15), new THREE.MeshStandardMaterial({ color: 0x222 }));
    back.position.set(x - Math.sin(ry) * 0.1, y, z - Math.cos(ry) * 0.1);
    back.rotation.y = ry;
    this.group.add(back);
  }

  private garages(x0: number, z0: number, count: number, along: 'x' | 'z', faceDir: 1 | -1) {
    const tex = garageTex();
    const front = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
    const wall = new THREE.MeshStandardMaterial({ color: 0x6b6f68, roughness: 0.95 });
    const geo = new THREE.BoxGeometry(3.4, 2.6, 6);
    for (let k = 0; k < count; k++) {
      const x = along === 'x' ? x0 + k * 3.5 : x0;
      const z = along === 'z' ? z0 + k * 3.5 : z0;
      const ry = along === 'x' ? (faceDir > 0 ? 0 : Math.PI) : faceDir > 0 ? Math.PI / 2 : -Math.PI / 2;
      // Material index 4 (+Z face) gets the door; we rotate the box to face the yard.
      this.inst.add('garage', geo, [wall, wall, this.roofMat, wall, front, wall] as unknown as THREE.Material, x, 1.3, z, ry);
    }
    const len = count * 3.5;
    if (along === 'x') this.addBox({ minX: x0 - 1.75, maxX: x0 - 1.75 + len, minZ: z0 - 3, maxZ: z0 + 3, h: 2.6 });
    else this.addBox({ minX: x0 - 3, maxX: x0 + 3, minZ: z0 - 1.75, maxZ: z0 - 1.75 + len, h: 2.6 });
  }

  private block(i: number, j: number) {
    const { x: cx, z: cz } = blockCenter(i, j);
    const zone = zoneOfBlock(i, j);
    const r = this.rnd;
    const H = BLOCK / 2;
    const key = `${i},${j}`;

    switch (key) {
      case '2,3': return this.universam(cx, cz);
      case '1,4': return this.rink(cx, cz);
      case '4,3': return this.videoSalon(cx, cz);
      case '1,2': return this.school(cx, cz);
      case '3,1': return this.market(cx, cz);
      case '5,5': return this.garageBlock(cx, cz, zone);
      case '0,3': return this.gym(cx, cz);
    }

    const layout = Math.floor(r() * 3);
    const fac = Math.floor(r() * this.facades.length);
    if (layout === 0) {
      // Two long 9-storey slabs facing a shared yard.
      const floors = r() < 0.5 ? 9 : 5;
      this.building(cx, cz - H + 9, 56, 13, floors, fac, 1);
      this.building(cx, cz + H - 9, 56, 13, floors, (fac + 1) % this.facades.length, -1);
    } else if (layout === 1) {
      // U-shape of khrushchevkas.
      this.building(cx, cz - H + 8, 52, 12, 5, fac, 1);
      this.building(cx - H + 8, cz + 6, 12, 36, 5, fac, 1);
      this.building(cx + H - 8, cz + 6, 12, 36, 5, (fac + 2) % this.facades.length, -1);
    } else {
      // Towers plus a low block.
      const fl = 12 + Math.floor(r() * 5);
      this.building(cx - 16, cz - 16, 18, 18, fl, 3, 1);
      this.building(cx + 16, cz + 14, 18, 18, fl, 0, -1);
      this.building(cx + 14, cz - 18, 24, 12, 5, 2, 1);
    }
    // Yard dressing
    this.playground(cx - 6 + r() * 4, cz + (layout === 1 ? 14 : 0));
    this.bench(cx + 8, cz - 4, Math.PI);
    this.bench(cx - 12, cz + 6, 0);
    for (let t = 0; t < 9; t++) {
      const x = cx + range(r, -H + 3, H - 3);
      const z = cz + range(r, -H + 3, H - 3);
      if (this.grid.query(x - 2, z - 2, x + 2, z + 2, new Set()).size) continue;
      this.tree(x, z, r() < 0.6);
    }
    this.dressYard(cx, cz, layout);
    this.hangouts.push({ x: cx + 2, z: cz + (layout === 1 ? 0 : 8), zone });
  }

  private universam(cx: number, cz: number) {
    const shop = shopfrontTex();
    shop.repeat.set(46 / 9.2, 1);
    const glass = new THREE.MeshStandardMaterial({ map: shop, emissiveMap: shop, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.2 });
    const wall = new THREE.MeshStandardMaterial({ color: 0xc8c3b8, roughness: 0.9 });
    const w = 46, d = 22, h = 7;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [wall, wall, this.roofMat, wall, glass, wall]);
    m.position.set(cx, h / 2, cz - 8);
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    // Concrete band above the glass
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.4, 1.6, 0.6), wall);
    band.position.set(cx, h - 0.8, cz - 8 + d / 2);
    this.group.add(band);
    this.addBox({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - 8 - d / 2, maxZ: cz - 8 + d / 2, h });
    this.sign('УНИВЕРСАМ', cx, h + 1.6, cz - 8 + d / 2 - 1, 22, 3.2, 0, '#ff3b30');
    this.pool(cx, cz + 5, 9, 0xff3020);
    this.pool(cx - 14, cz + 5, 6, 0x6a90d0);
    this.pool(cx + 14, cz + 5, 6, 0x6a90d0);
    // Kiosk "Soyuzpechat" and some trees around the parking lot
    this.props.add('kiosk', cx + 24, 0, cz + 20, 0, 1);
    this.addBox({ minX: cx + 22.5, maxX: cx + 25.5, minZ: cz + 18.8, maxZ: cz + 21.2, h: 2.6 });
    this.sign('СОЮЗПЕЧАТЬ', cx + 24, 2.9, cz + 21.3, 3, 0.55, 0, '#ffffff', '#1a4f99');
    for (let k = 0; k < 6; k++) this.tree(cx - 28 + k * 11, cz + 28, true);
    this.landmarks.push({ name: 'Универсам', x: cx, z: cz + 6 });
    this.spawn = { x: cx + 4, z: cz + 10, heading: 0 };
    this.hangouts.push({ x: cx - 12, z: cz + 10, zone: 'universam' });
  }

  private rink(cx: number, cz: number) {
    const ice = iceTex();
    const rink = new THREE.Mesh(new THREE.PlaneGeometry(44, 26), new THREE.MeshStandardMaterial({ map: ice, roughness: 0.15, metalness: 0.1 }));
    rink.rotation.x = -Math.PI / 2;
    rink.position.set(cx, 0.05, cz);
    rink.receiveShadow = true;
    this.group.add(rink);
    const board = new THREE.MeshStandardMaterial({ color: 0xe8e8e8, roughness: 0.6 });
    const blue = new THREE.MeshStandardMaterial({ color: 0x2856a8, roughness: 0.6 });
    const segs: [number, number, number, number][] = [
      [cx, cz - 13, 44, 0.2], [cx - 12, cz + 13, 20, 0.2], [cx + 12, cz + 13, 20, 0.2], [cx - 22, cz, 0.2, 26], [cx + 22, cz, 0.2, 26],
    ];
    for (const [x, z, w, d] of segs) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 1.1, d), board);
      b.position.set(x, 0.55, z);
      b.castShadow = true;
      this.group.add(b);
      const s = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.2, d + 0.02), blue);
      s.position.set(x, 0.95, z);
      this.group.add(s);
      // Thin colliders, with a gap in the south wall as the gate.
      this.addBox({ minX: x - w / 2 - 0.1, maxX: x + w / 2 + 0.1, minZ: z - d / 2 - 0.1, maxZ: z + d / 2 + 0.1, h: 1.1 });
    }
    // Garlands of lamps over the ice
    for (let k = -2; k <= 2; k++) {
      for (let q = -1; q <= 1; q += 2) {
        const x = cx + k * 10, z = cz + q * 9;
        this.glow(x, 6, z, 3, k % 2 ? 0xff6ad5 : 0x6ad5ff);
      }
    }
    this.pool(cx, cz, 18, 0x8090ff);
    this.sign('КАТОК', cx, 4, cz + 16, 8, 1.6, 0, '#7fd4ff');
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 4.8, 6), board);
      post.position.set(cx + s * 4.2, 2.4, cz + 16);
      this.group.add(post);
    }
    for (let k = 0; k < 10; k++) this.tree(cx - 28 + (k % 5) * 14, cz + (k < 5 ? -26 : 26), k % 3 !== 0);
    this.landmarks.push({ name: 'Каток', x: cx, z: cz });
    this.hangouts.push({ x: cx + 26, z: cz + 6, zone: 'universam' });
  }

  private videoSalon(cx: number, cz: number) {
    this.building(cx, cz - 18, 56, 13, 9, 1, 1);
    const k = new THREE.Mesh(new THREE.BoxGeometry(12, 4, 9), new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 0.9 }));
    k.position.set(cx + 8, 2, cz + 12);
    k.castShadow = true;
    this.group.add(k);
    this.addBox({ minX: cx + 2, maxX: cx + 14, minZ: cz + 7.5, maxZ: cz + 16.5, h: 4 });
    this.sign('ВИДЕОСАЛОН', cx + 8, 4.9, cz + 16.6, 9, 1.4, 0, '#ffe24a');
    this.sign('ВИДЕО', cx + 14.1, 2.2, cz + 12, 3, 0.8, Math.PI / 2, '#ff5af0');
    this.pool(cx + 8, cz + 19, 6, 0xffd040);
    this.garages(cx - 26, cz + 24, 8, 'x', -1);
    for (let t = 0; t < 6; t++) this.tree(cx - 20 + t * 5, cz + 4, true);
    this.landmarks.push({ name: 'Видеосалон', x: cx + 8, z: cz + 20 });
    this.hangouts.push({ x: cx + 6, z: cz + 21, zone: 'razezd' });
    this.hangouts.push({ x: cx - 12, z: cz + 17, zone: 'razezd' });
  }

  private school(cx: number, cz: number) {
    this.building(cx, cz - 6, 54, 14, 3, 4, 1);
    this.building(cx - 20, cz + 12, 14, 22, 3, 4, 0);
    this.sign('ШКОЛА № 42', cx, 9.6, cz + 1.05, 10, 1.3, 0, '#ffffff', '#1d3d7a');
    const fence = new THREE.MeshStandardMaterial({ color: 0x2d3540, roughness: 0.5, metalness: 0.5 });
    this.inst.add('fence', new THREE.BoxGeometry(60, 1.4, 0.08), fence, cx, 0.7, cz + 30, 0, 1, 1, 1, false);
    this.addBox({ minX: cx - 30, maxX: cx - 3, minZ: cz + 29.8, maxZ: cz + 30.2, h: 1.4 });
    this.addBox({ minX: cx + 3, maxX: cx + 30, minZ: cz + 29.8, maxZ: cz + 30.2, h: 1.4 });
    for (let t = 0; t < 8; t++) this.tree(cx - 2 + (t % 4) * 7, cz + 14 + Math.floor(t / 4) * 8, true);
    this.landmarks.push({ name: 'Школа', x: cx, z: cz + 6 });
    this.hangouts.push({ x: cx + 22, z: cz + 22, zone: 'universam' });
  }

  private market(cx: number, cz: number) {
    const cols = [0xc23a2a, 0x2a7ac2, 0xe0b030, 0x3aa055];
    for (let row = 0; row < 3; row++)
      for (let k = 0; k < 6; k++) {
        const x = cx - 22 + k * 8.8;
        const z = cz - 14 + row * 12;
        const c = cols[(row + k) % cols.length];
        this.inst.add('stallBody', new THREE.BoxGeometry(5, 1.1, 2.2), new THREE.MeshStandardMaterial({ color: 0x6b4a30 }), x, 0.55, z);
        this.inst.add('stallRoof' + c, new THREE.BoxGeometry(5.6, 0.12, 3), new THREE.MeshStandardMaterial({ color: c, roughness: 0.8 }), x, 2.4, z, 0, 1, 1, 1, true, 0.15);
        this.inst.add('stallSnow', new THREE.BoxGeometry(5.6, 0.1, 3), this.roofMat, x, 2.52, z, 0, 1, 1, 1, false, 0.15);
        for (const s of [-1, 1]) this.inst.add('stallPost', new THREE.CylinderGeometry(0.05, 0.05, 2.3, 4), new THREE.MeshStandardMaterial({ color: 0x444 }), x + s * 2.6, 1.15, z + 1.3);
        this.addBox({ minX: x - 2.5, maxX: x + 2.5, minZ: z - 1.1, maxZ: z + 1.1, h: 1.1 });
      }
    this.sign('РЫНОК', cx, 5, cz - 26, 8, 1.6, 0, '#ffffff', '#7a1d1d');
    for (const s of [-1, 1]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 5.8, 6), new THREE.MeshStandardMaterial({ color: 0x555 }));
      p.position.set(cx + s * 4.2, 2.9, cz - 26.2);
      this.group.add(p);
    }
    for (let k = -2; k <= 2; k++) this.glow(cx + k * 10, 4, cz - 2, 2.5, 0xffd080);
    this.building(cx, cz + H_MARKET, 50, 10, 2, 2, -1);
    this.landmarks.push({ name: 'Рынок', x: cx, z: cz });
    this.hangouts.push({ x: cx + 26, z: cz - 4, zone: 'hadi' });
    this.hangouts.push({ x: cx - 26, z: cz + 6, zone: 'hadi' });
  }

  private garageBlock(cx: number, cz: number, zone: Zone) {
    for (let row = 0; row < 3; row++) this.garages(cx - 26, cz - 22 + row * 18, 15, 'x', row % 2 ? -1 : 1);
    this.landmarks.push({ name: 'Гаражи', x: cx, z: cz });
    this.hangouts.push({ x: cx, z: cz - 13, zone });
    this.hangouts.push({ x: cx + 5, z: cz + 14, zone });
    for (let t = 0; t < 6; t++) this.tree(cx + 30, cz - 25 + t * 10, false);
  }

  private gym(cx: number, cz: number) {
    this.building(cx, cz - 16, 52, 13, 5, 2, 1);
    const g = new THREE.Mesh(new THREE.BoxGeometry(14, 3.6, 10), new THREE.MeshStandardMaterial({ color: 0x8a4a3a, roughness: 0.95 }));
    g.position.set(cx + 6, 1.8, cz + 12);
    g.castShadow = true;
    this.group.add(g);
    this.addBox({ minX: cx - 1, maxX: cx + 13, minZ: cz + 7, maxZ: cz + 17, h: 3.6 });
    this.sign('КАЧАЛКА', cx + 6, 4.3, cz + 17.1, 6, 1.1, 0, '#ff8a3a');
    this.pool(cx + 6, cz + 19, 5, 0xff8a3a);
    this.playground(cx - 14, cz + 14);
    for (let t = 0; t < 5; t++) this.tree(cx - 26 + t * 6, cz + 26, false);
    this.landmarks.push({ name: 'Качалка', x: cx + 6, z: cz + 19 });
    this.hangouts.push({ x: cx + 6, z: cz + 21, zone: 'universam' });
  }

  private walkGraph() {
    // Four sidewalk corners per block, linked around the block and across roads.
    const id = (i: number, j: number, c: number) => (j * N + i) * 4 + c;
    const inset = BLOCK / 2 + SIDEWALK * 0.5 + 0.4;
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const { x, z } = blockCenter(i, j);
        const pts = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
        pts.forEach(([sx, sz]) => this.walkNodes.push({ x: x + sx * inset, z: z + sz * inset, next: [] }));
      }
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        for (let c = 0; c < 4; c++) {
          const n = this.walkNodes[id(i, j, c)];
          n.next.push(id(i, j, (c + 1) % 4), id(i, j, (c + 3) % 4));
        }
        if (i + 1 < N) {
          this.walkNodes[id(i, j, 1)].next.push(id(i + 1, j, 0));
          this.walkNodes[id(i + 1, j, 0)].next.push(id(i, j, 1));
          this.walkNodes[id(i, j, 2)].next.push(id(i + 1, j, 3));
          this.walkNodes[id(i + 1, j, 3)].next.push(id(i, j, 2));
        }
        if (j + 1 < N) {
          this.walkNodes[id(i, j, 3)].next.push(id(i, j + 1, 0));
          this.walkNodes[id(i, j + 1, 0)].next.push(id(i, j, 3));
          this.walkNodes[id(i, j, 2)].next.push(id(i, j + 1, 1));
          this.walkNodes[id(i, j + 1, 1)].next.push(id(i, j, 2));
        }
      }
  }

  /** Random point on a sidewalk node. */
  randomWalkNode(r = Math.random) {
    return Math.floor(r() * this.walkNodes.length);
  }

  pickHangout(zone: Zone, r = Math.random) {
    const list = this.hangouts.filter((h) => h.zone === zone);
    return pick(r, list);
  }
}

const H_MARKET = 27;

/**
 * Places Poly Haven props (CC0) as InstancedMeshes: one per sub-mesh of each
 * prop, so hundreds of lamps or bins cost a handful of draw calls.
 */
class PropInstancer {
  private placed = new Map<string, THREE.Matrix4[]>();
  private tmp = new THREE.Object3D();

  add(name: string, x: number, y: number, z: number, ry = 0, scale = 1) {
    let list = this.placed.get(name);
    if (!list) this.placed.set(name, (list = []));
    this.tmp.position.set(x, y, z);
    this.tmp.rotation.set(0, ry, 0);
    this.tmp.scale.setScalar(scale);
    this.tmp.updateMatrix();
    list.push(this.tmp.matrix.clone());
  }

  build(parent: THREE.Object3D, assets: Assets) {
    for (const [name, mats] of this.placed) {
      const src = assets.props[name];
      if (!src) continue;
      src.updateMatrixWorld(true);
      src.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const im = new THREE.InstancedMesh(m.geometry, m.material, mats.length);
        const local = m.matrixWorld;
        const out = new THREE.Matrix4();
        mats.forEach((pm, i) => im.setMatrixAt(i, out.multiplyMatrices(pm, local)));
        im.castShadow = name !== 'water_manhole_cover';
        im.receiveShadow = true;
        im.computeBoundingSphere();
        parent.add(im);
      });
    }
  }
}
