import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Assets, PbrSet } from '../core/assets';

/**
 * Real 3D facades for the panel blocks and khrushchevkas: walls with
 * true-scale brick/plaster, panel seams and grime; recessed windows with
 * sashes, sills and snow; interior-mapped glass (a fake 3D room behind every
 * window, lit or dark); balconies; roof machine rooms, antennas, drainpipes.
 * Everything repeated is an InstancedMesh, so the city stays a few hundred
 * draw calls.
 */
export type WallStyle = 'panel' | 'brick' | 'panelBlue' | 'panelBeige';

export interface BuildingSpec {
  cx: number;
  cz: number;
  w: number;
  d: number;
  floors: number;
  style: WallStyle;
  /** Side (±1 along the long axis) with the entrances; balconies go on the other. */
  entrance: 0 | 1 | -1;
  seed: number;
}

const FLOOR_H = 2.8;
const PLINTH = 0.9;

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** A quad list → BufferGeometry helper. Each quad: 4 corners, CCW from outside. */
function quads(list: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][], uvScale = 1) {
  const pos: number[] = [], nor: number[] = [], uv: number[] = [];
  const a = new THREE.Vector3(), b = new THREE.Vector3(), n = new THREE.Vector3();
  for (const [p0, p1, p2, p3] of list) {
    a.subVectors(p1, p0);
    b.subVectors(p3, p0);
    n.crossVectors(a, b).normalize();
    for (const p of [p0, p1, p2, p0, p2, p3]) {
      pos.push(p.x, p.y, p.z);
      nor.push(n.x, n.y, n.z);
    }
    const lu = p0.distanceTo(p1) * uvScale, lv = p0.distanceTo(p3) * uvScale;
    uv.push(0, 0, lu, 0, lu, lv, 0, 0, lu, lv, 0, lv);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  return g;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Box made only of the faces you can see from the front/top/sides (no back). */
function openBox(w: number, h: number, d: number, faces = 'front top bottom left right') {
  const x0 = -w / 2, x1 = w / 2, y0 = -h / 2, y1 = h / 2, z0 = -d / 2, z1 = d / 2;
  const q: [THREE.Vector3, THREE.Vector3, THREE.Vector3, THREE.Vector3][] = [];
  if (faces.includes('front')) q.push([V(x0, y0, z1), V(x1, y0, z1), V(x1, y1, z1), V(x0, y1, z1)]);
  if (faces.includes('top')) q.push([V(x0, y1, z1), V(x1, y1, z1), V(x1, y1, z0), V(x0, y1, z0)]);
  if (faces.includes('bottom')) q.push([V(x0, y0, z0), V(x1, y0, z0), V(x1, y0, z1), V(x0, y0, z1)]);
  if (faces.includes('left')) q.push([V(x0, y0, z0), V(x0, y0, z1), V(x0, y1, z1), V(x0, y1, z0)]);
  if (faces.includes('right')) q.push([V(x1, y0, z1), V(x1, y0, z0), V(x1, y1, z0), V(x1, y1, z1)]);
  return quads(q);
}

function placed(g: THREE.BufferGeometry, x: number, y: number, z: number) {
  return g.clone().translate(x, y, z);
}

/** Unit window (1×1 opening, local +Z out of the wall): reveal surround. */
function surroundGeo() {
  const t = 0.11, dep = 0.2;
  const parts = [
    placed(openBox(1 + t * 2, t, dep), 0, 0.5 + t / 2, dep / 2),
    placed(openBox(1 + t * 2, t, dep), 0, -0.5 - t / 2, dep / 2),
    placed(openBox(t, 1, dep, 'front left right'), -0.5 - t / 2, 0, dep / 2),
    placed(openBox(t, 1, dep, 'front left right'), 0.5 + t / 2, 0, dep / 2),
  ];
  return mergeGeometries(parts)!;
}

/** Soviet double sash: centre post, transom with a fortochka. */
function sashGeo() {
  const b = 0.05, dep = 0.06;
  const parts = [
    placed(openBox(b, 1, dep), 0, 0, 0.04),
    placed(openBox(1, b, dep), 0, 0.22, 0.04),
    placed(openBox(b, 0.28, dep), 0.25, 0.36, 0.04),
    placed(openBox(1, b, dep), 0, -0.48, 0.04),
    placed(openBox(1, b, dep), 0, 0.48, 0.04),
    placed(openBox(b, 1, dep), -0.48, 0, 0.04),
    placed(openBox(b, 1, dep), 0.48, 0, 0.04),
  ];
  return mergeGeometries(parts)!;
}

/** Interior mapping: a 3D room rendered inside every pane. */
function windowMaterial() {
  return new THREE.ShaderMaterial({
    fog: true,
    uniforms: { ...THREE.UniformsLib.fog, uTime: { value: 0 } },
    vertexShader: /* glsl */ `
      attribute float aSeed;
      varying vec3 vPosL;
      varying vec3 vCamL;
      varying float vSeed;
      #include <fog_pars_vertex>
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 wp = m * vec4(position, 1.0);
        vPosL = position;
        vCamL = (inverse(m) * vec4(cameraPosition, 1.0)).xyz;
        vSeed = aSeed;
        vec4 mvPosition = viewMatrix * wp;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      varying vec3 vPosL;
      varying vec3 vCamL;
      varying float vSeed;
      #include <fog_pars_fragment>
      float h1(float x) { return fract(sin(x * 78.233 + 0.5) * 43758.5453); }
      void main() {
        vec3 o = vec3(vPosL.xy, 0.0);
        vec3 d = normalize(vPosL - vCamL);
        const float D = 1.6;
        vec3 inv = 1.0 / d;
        float tx = ((d.x > 0.0 ? 0.5 : -0.5) - o.x) * inv.x;
        float ty = ((d.y > 0.0 ? 0.5 : -0.5) - o.y) * inv.y;
        float tz = (-D - o.z) * inv.z;
        float t = min(min(tx, ty), tz);
        vec3 p = o + d * t;
        float sd = floor(vSeed * 997.0 + 0.5) / 997.0;
        float r1 = h1(sd), r2 = h1(sd + 0.371), r3 = h1(sd + 0.713);
        vec3 wall = mix(mix(vec3(0.62, 0.55, 0.42), vec3(0.42, 0.52, 0.45), step(0.5, r1)), vec3(0.55, 0.47, 0.52), step(0.8, r1));
        // Vertical wallpaper stripes
        wall *= 0.9 + 0.1 * step(0.5, fract((p.x + p.z) * 9.0));
        vec3 col;
        if (t == tz) {
          col = wall;
          // A wardrobe or a carpet on the back wall
          if (abs(p.x - (r2 - 0.5) * 0.4) < 0.22 && p.y < 0.25) col = mix(vec3(0.45, 0.12, 0.1), vec3(0.3, 0.2, 0.12), r3);
        } else if (t == ty) {
          col = d.y < 0.0 ? vec3(0.32, 0.2, 0.12) * (0.85 + 0.15 * step(0.5, fract(p.z * 6.0))) : vec3(0.85, 0.82, 0.75);
        } else {
          col = wall * 0.78;
        }
        float depth = clamp(-p.z / D, 0.0, 1.0);
        bool lit = r2 > 0.55;
        bool tv = !lit && r3 > 0.86;
        vec3 light;
        if (lit) {
          // Ceiling lamp (a lyustra) makes a hot spot overhead.
          vec3 lampPos = vec3(0.0, 0.42, -D * 0.5);
          float lamp = 1.0 / (1.0 + 6.0 * dot(p - lampPos, p - lampPos));
          vec3 warm = mix(vec3(1.0, 0.78, 0.5), vec3(1.0, 0.9, 0.75), r3);
          light = warm * (0.9 + 2.6 * lamp) * mix(1.0, 0.65, depth);
        } else if (tv) {
          float fl = 0.6 + 0.4 * sin(uTime * 7.0 + sd * 20.0) * sin(uTime * 3.1 + sd);
          light = vec3(0.25, 0.35, 0.7) * fl * mix(0.9, 0.3, depth);
        } else {
          light = vec3(0.025, 0.03, 0.045);
        }
        col *= light;
        // Curtains hang just behind the glass.
        float cw = 0.18 + 0.12 * r1;
        if (abs(vPosL.x) > 0.5 - cw) {
          vec3 fabric = mix(vec3(0.6, 0.3, 0.2), vec3(0.75, 0.68, 0.5), r3) * (0.85 + 0.15 * sin(vPosL.x * 60.0));
          col = fabric * (lit ? vec3(1.0, 0.8, 0.55) * 0.9 : tv ? vec3(0.15, 0.2, 0.35) : vec3(0.03));
        }
        // Reflection of the night sky off the glass.
        float fres = pow(1.0 - abs(d.z), 3.0);
        col += vec3(0.04, 0.05, 0.08) * (0.4 + fres * 2.0);
        gl_FragColor = vec4(col, 1.0);
        #include <fog_fragment>
      }`,
  });
}

interface Inst {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
  m: THREE.Matrix4[];
  seeds?: number[];
  shadow: boolean;
}

export class Facades {
  private sets = new Map<string, Inst>();
  private tmp = new THREE.Object3D();
  windowMat = windowMaterial();
  private wallMats: Record<WallStyle, THREE.MeshStandardMaterial>;
  private roofMat: THREE.MeshStandardMaterial;
  private geos = {
    pane: new THREE.PlaneGeometry(1, 1),
    surround: surroundGeo(),
    sash: sashGeo(),
    sill: openBox(1, 0.05, 0.28, 'front top bottom left right'),
    snow: openBox(1, 0.06, 0.22, 'front top left right'),
    slab: openBox(1, 1, 1),
    box: new THREE.BoxGeometry(1, 1, 1),
    pipe: new THREE.CylinderGeometry(0.06, 0.06, 1, 6),
    antenna: (() => {
      const pole = new THREE.CylinderGeometry(0.02, 0.025, 2.6, 4).translate(0, 1.3, 0);
      const bars = [0.6, 0.9, 1.2].map((l, i) => new THREE.BoxGeometry(l, 0.02, 0.02).translate(0, 1.9 + i * 0.25, 0));
      const boom = new THREE.BoxGeometry(0.02, 0.02, 1.2).translate(0, 2.2, 0);
      return mergeGeometries([pole, ...bars, boom])!;
    })(),
  };
  private mats: Record<string, THREE.Material>;

  constructor(assets: Assets) {
    const t = assets.tex;
    this.wallMats = {
      panel: this.wallMaterial(t.plastered_wall, 2, 0xc9c4b8, true),
      panelBlue: this.wallMaterial(t.plastered_wall, 2, 0xb3c0cc, true),
      panelBeige: this.wallMaterial(t.plastered_wall, 2, 0xd8c8a8, true),
      brick: this.wallMaterial(t.red_brick, 1.4, 0xffffff, false),
    };
    this.roofMat = new THREE.MeshStandardMaterial({ color: 0xe8edf3, roughness: 0.85 });
    this.mats = {
      surround: new THREE.MeshStandardMaterial({ color: 0xb8b2a6, roughness: 0.9 }),
      sash: new THREE.MeshStandardMaterial({ color: 0xe8e4da, roughness: 0.6 }),
      sill: new THREE.MeshStandardMaterial({ color: 0x8c8f94, roughness: 0.5, metalness: 0.4 }),
      snow: new THREE.MeshStandardMaterial({ color: 0xf2f5fa, roughness: 0.8 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0xa8a49a, roughness: 0.9 }),
      rail: new THREE.MeshStandardMaterial({ color: 0x5e6a63, roughness: 0.55, metalness: 0.5 }),
      railAlt: new THREE.MeshStandardMaterial({ color: 0x7a4a34, roughness: 0.7 }),
      glazing: new THREE.MeshPhysicalMaterial({ color: 0x1a222c, roughness: 0.08, metalness: 0.2, clearcoat: 1 }),
      wood: new THREE.MeshStandardMaterial({ color: 0xd9d2c0, roughness: 0.6 }),
      metal: new THREE.MeshStandardMaterial({ color: 0x55595e, roughness: 0.5, metalness: 0.7 }),
      dark: new THREE.MeshStandardMaterial({ color: 0x1b1c1f, roughness: 0.6, metalness: 0.5 }),
    };
  }

  /** PBR wall with world-scale UVs (metres), grime toward the ground, optional panel seams. */
  private wallMaterial(s: PbrSet, texMeters: number, tint: number, seams: boolean) {
    const rep = (x: THREE.Texture | null) => {
      if (!x) return null;
      const k = x.clone();
      k.repeat.set(1 / texMeters, 1 / texMeters);
      k.needsUpdate = true;
      return k;
    };
    const m = new THREE.MeshStandardMaterial({ map: rep(s.map), normalMap: rep(s.normal), roughnessMap: rep(s.rough), color: tint, roughness: 1 });
    m.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vMeters;')
        .replace('#include <uv_vertex>', '#include <uv_vertex>\nvMeters = uv;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec2 vMeters;')
        .replace(
          '#include <map_fragment>',
          `#include <map_fragment>
          {
            float hgt = vMeters.y;
            diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.0, 1.8, hgt));
            float col = floor(vMeters.x / 1.6);
            float st = fract(sin(col * 91.7) * 4375.5);
            float streak = smoothstep(0.3, 0.0, abs(fract(vMeters.x / 1.6) - 0.5 - (st - 0.5) * 0.4)) * st;
            diffuseColor.rgb *= 1.0 - 0.18 * streak * smoothstep(2.0, 12.0, hgt);
            ${seams ? `vec2 g = abs(fract(vMeters / vec2(3.2, 2.8) + 0.5) - 0.5) * vec2(3.2, 2.8);
            float seam = 1.0 - smoothstep(0.012, 0.03, min(g.x, g.y));
            diffuseColor.rgb *= 1.0 - 0.5 * seam;` : ''}
          }`,
        );
    };
    m.customProgramCacheKey = () => 'wall' + seams;
    return m;
  }

  private add(key: string, geo: THREE.BufferGeometry, mat: THREE.Material, pos: THREE.Vector3, ry: number, sx = 1, sy = 1, sz = 1, shadow = false, seed?: number) {
    let s = this.sets.get(key);
    if (!s) this.sets.set(key, (s = { geo, mat, m: [], shadow, seeds: seed !== undefined ? [] : undefined }));
    this.tmp.position.copy(pos);
    this.tmp.rotation.set(0, ry, 0);
    this.tmp.scale.set(sx, sy, sz);
    this.tmp.updateMatrix();
    s.m.push(this.tmp.matrix.clone());
    if (seed !== undefined) s.seeds!.push(seed);
  }

  /** The wall shell: four sides (UVs in metres, aligned to the window grid) + roof. */
  private shell(b: BuildingSpec, h: number) {
    const faces = this.faces(b);
    const pos: number[] = [], nor: number[] = [], uv: number[] = [];
    for (const f of faces) {
      const p0 = f.start, t = f.t, n = f.n;
      const corners = [
        [0, 0], [f.len, 0], [f.len, h], [0, h],
      ];
      const P = corners.map(([u, v]) => new THREE.Vector3(p0.x + t.x * u, v, p0.z + t.z * u));
      for (const i of [0, 1, 2, 0, 2, 3]) {
        pos.push(P[i].x, P[i].y, P[i].z);
        nor.push(n.x, 0, n.z);
        uv.push(corners[i][0] - f.margin, corners[i][1] - PLINTH);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const wall = new THREE.Mesh(g, this.wallMats[b.style]);
    wall.castShadow = wall.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.d), this.roofMat);
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(b.cx, h, b.cz);
    roof.receiveShadow = true;
    return [wall, roof];
  }

  private faces(b: BuildingSpec) {
    const out: { n: THREE.Vector3; t: THREE.Vector3; start: THREE.Vector3; len: number; long: boolean; side: number; margin: number; cols: number; cell: number }[] = [];
    const cell = b.style === 'brick' ? 3.0 : 3.2;
    for (const [nx, nz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      const n = V(nx, 0, nz);
      const t = V(0, 1, 0).cross(n); // right-hand along the face, seen from outside
      const len = nx === 0 ? b.w : b.d;
      const half = nx === 0 ? b.d / 2 : b.w / 2;
      const start = V(b.cx + nx * half - t.x * len / 2, 0, b.cz + nz * half - t.z * len / 2);
      const cols = Math.max(1, Math.floor(len / cell));
      const margin = (len - cols * cell) / 2;
      const longAxisX = b.w >= b.d;
      const long = longAxisX ? nx === 0 : nz === 0;
      const side = longAxisX ? nz : nx;
      out.push({ n, t, start, len, long, side, margin, cols, cell });
    }
    return out;
  }

  addBuilding(b: BuildingSpec, parent: THREE.Object3D) {
    const r = rng(b.seed);
    const h = b.floors * FLOOR_H + PLINTH + 0.4;
    for (const m of this.shell(b, h)) parent.add(m);
    const brick = b.style === 'brick';
    const ww = brick ? 1.35 : 1.5, wh = 1.45;
    for (const f of this.faces(b)) {
      const ry = Math.atan2(f.n.x, f.n.z);
      const entranceSide = f.long && f.side === b.entrance;
      const balconySide = f.long && b.entrance !== 0 && f.side === -b.entrance && !brick;
      // Ends of panel blocks are mostly blank, with one column of small windows.
      const endWall = !f.long;
      const nEntr = Math.max(1, Math.floor(f.len / 14));
      const entrPos = Array.from({ length: nEntr }, (_, k) => -f.len / 2 + (f.len / nEntr) * (k + 0.5));
      for (let c = 0; c < f.cols; c++) {
        if (endWall && c !== Math.floor(f.cols / 2) && !brick) continue;
        const u = f.margin + f.cell * (c + 0.5);
        // Entrance columns (they line up with City's doors) get stairwell windows instead.
        const entrCol = entranceSide && entrPos.some((a) => Math.floor((a + f.len / 2 - f.margin) / f.cell) === c);
        for (let fl = 0; fl < b.floors; fl++) {
          if (entrCol && fl === 0) continue;
          const y = PLINTH + fl * FLOOR_H + (entrCol ? FLOOR_H * 0.95 : FLOOR_H * 0.55);
          const base = V(f.start.x + f.t.x * u, y, f.start.z + f.t.z * u);
          const out = (k: number) => V(base.x + f.n.x * k, base.y, base.z + f.n.z * k);
          const sw = endWall && !brick ? ww * 0.6 : entrCol ? ww * 0.7 : ww;
          const sh = entrCol ? wh * 0.6 : wh;
          this.add('pane', this.geos.pane, this.windowMat, out(0.02), ry, sw, sh, 1, false, Math.floor(r() * 997) / 997);
          this.add('surround', this.geos.surround, this.mats.surround, out(0), ry, sw, sh, 1);
          this.add('sash', this.geos.sash, this.mats.sash, out(0), ry, sw, sh, 1);
          const sill = V(base.x + f.n.x * 0.14, y - sh / 2 - 0.08, base.z + f.n.z * 0.14);
          this.add('sill', this.geos.sill, this.mats.sill, sill, ry, sw + 0.2, 1, 1);
          this.add('sillSnow', this.geos.snow, this.mats.snow, V(sill.x, sill.y + 0.055, sill.z), ry, sw + 0.1, 1, 1);
          // Balconies on the yard side, every other column, from the 2nd floor up.
          if (balconySide && fl >= 1 && c % 2 === 1) this.balcony(base, f.n, f.t, ry, PLINTH + fl * FLOOR_H, f.cell, r);
        }
      }
      // Drainpipes at the corners of the long faces.
      if (f.long)
        for (const u of [0.25, f.len - 0.25]) {
          const p = V(f.start.x + f.t.x * u + f.n.x * 0.12, h / 2, f.start.z + f.t.z * u + f.n.z * 0.12);
          this.add('pipe', this.geos.pipe, this.mats.metal, p, 0, 1, h, 1, true);
        }
      // Plinth band
      const mid = V(f.start.x + f.t.x * f.len / 2 + f.n.x * 0.06, PLINTH / 2, f.start.z + f.t.z * f.len / 2 + f.n.z * 0.06);
      this.add('plinth', this.geos.slab, this.mats.concrete, mid, ry, f.len + 0.12, PLINTH, 0.12, false);
    }
    // Roof: parapet, machine rooms over the stairwells, antennas.
    const longX = b.w >= b.d;
    const len = longX ? b.w : b.d;
    const nRooms = Math.max(1, Math.floor(len / 14));
    for (let k = 0; k < nRooms; k++) {
      const a = -len / 2 + (len / nRooms) * (k + 0.5);
      const x = b.cx + (longX ? a : 0), z = b.cz + (longX ? 0 : a);
      if (b.floors >= 9) this.add('machine', this.geos.box, this.wallMats[b.style], V(x, h + 1.2, z), longX ? 0 : Math.PI / 2, 3.4, 2.4, 2.6, true);
      for (let i = 0; i < 2; i++) {
        const ox = (r() - 0.5) * (longX ? 8 : b.w - 3), oz = (r() - 0.5) * (longX ? b.d - 3 : 8);
        this.add('antenna', this.geos.antenna, this.mats.dark, V(x + ox, h, z + oz), r() * 6, 1, 0.8 + r() * 0.5, 1);
      }
      this.add('vent', this.geos.box, this.mats.concrete, V(x + (longX ? 4 : 1.5), h + 0.4, z + (longX ? 1.5 : 4)), 0, 0.8, 0.8, 0.8, true);
    }
    for (const [sx, sz, w, d] of [[0, b.d / 2, b.w, 0.25], [0, -b.d / 2, b.w, 0.25], [b.w / 2, 0, 0.25, b.d], [-b.w / 2, 0, 0.25, b.d]]) {
      this.add('parapet', this.geos.box, this.mats.concrete, V(b.cx + sx, h + 0.25, b.cz + sz), 0, w + 0.1, 0.5, d + 0.1, true);
      this.add('parapetSnow', this.geos.box, this.mats.snow, V(b.cx + sx, h + 0.53, b.cz + sz), 0, w + 0.1, 0.06, d + 0.05, false);
    }
    return h;
  }

  private balcony(base: THREE.Vector3, n: THREE.Vector3, t: THREE.Vector3, ry: number, floorY: number, cell: number, r: () => number) {
    const W = cell - 0.3, D = 1.15;
    const at = (out: number, y: number, along = 0) => V(base.x + n.x * out + t.x * along, y, base.z + n.z * out + t.z * along);
    this.add('balSlab', this.geos.box, this.mats.concrete, at(D / 2, floorY + 0.07), ry, W, 0.14, D, true);
    this.add('balSlabSnow', this.geos.box, this.mats.snow, at(D / 2, floorY + 0.15), ry, W - 0.1, 0.03, D - 0.1, false);
    const glazed = r() < 0.4;
    const railMat = r() < 0.7 ? 'rail' : 'railAlt';
    this.add('balFront' + railMat, this.geos.box, this.mats[railMat], at(D - 0.03, floorY + 0.6), ry, W, 1.0, 0.05, true);
    for (const s of [-1, 1]) this.add('balSide' + railMat, this.geos.box, this.mats[railMat], at(D / 2, floorY + 0.6, s * (W / 2 - 0.03)), ry, 0.05, 1.0, D, true);
    this.add('balRailSnow', this.geos.box, this.mats.snow, at(D - 0.03, floorY + 1.12), ry, W, 0.05, 0.1, false);
    if (glazed) {
      // Owner-built glazing with wooden frames — very 80s.
      this.add('glazing', this.geos.box, this.mats.glazing, at(D - 0.04, floorY + 1.75), ry, W, 1.25, 0.04, false);
      for (let i = 0; i <= 4; i++) this.add('glazeFrame', this.geos.box, this.mats.wood, at(D - 0.02, floorY + 1.75, -W / 2 + (W / 4) * i), ry, 0.06, 1.25, 0.06, false);
      this.add('balRoof', this.geos.box, this.mats.rail, at(D / 2, floorY + 2.42), ry, W + 0.1, 0.05, D + 0.05, true);
      this.add('balRoofSnow', this.geos.box, this.mats.snow, at(D / 2, floorY + 2.48), ry, W, 0.06, D, false);
    } else if (r() < 0.35) {
      // Things stored on the balcony: skis, a sledge, jars, washing.
      this.add('junk', this.geos.box, this.mats.railAlt, at(D - 0.3, floorY + 0.5, (r() - 0.5) * W * 0.6), ry, 0.5, 0.7, 0.35, false);
    }
  }

  build(parent: THREE.Object3D) {
    for (const [, s] of this.sets) {
      const im = new THREE.InstancedMesh(s.geo, s.mat, s.m.length);
      s.m.forEach((m, i) => im.setMatrixAt(i, m));
      if (s.seeds) im.geometry = s.geo.clone().setAttribute('aSeed', new THREE.InstancedBufferAttribute(new Float32Array(s.seeds), 1));
      im.castShadow = s.shadow;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      parent.add(im);
    }
  }

  update(t: number) {
    (this.windowMat.uniforms.uTime as { value: number }).value = t;
  }
}
