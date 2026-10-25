import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Assets, PbrSet } from '../core/assets';

/**
 * Winter trees: bare birches and poplars grown as branching tubes (real bark
 * textures, snow settling on the upper sides), and spruces built from
 * jagged, drooping tiers. A few variants of each are generated once and
 * then instanced across the district.
 */
type Kind = 'birch' | 'poplar' | 'spruce';

function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

/** One tapered branch segment from a to b. */
function limb(a: THREE.Vector3, b: THREE.Vector3, r0: number, r1: number, sides: number) {
  const len = a.distanceTo(b);
  const g = new THREE.CylinderGeometry(r1, r0, len, sides, 1, true);
  g.translate(0, len / 2, 0);
  const dir = b.clone().sub(a).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.applyQuaternion(q);
  g.translate(a.x, a.y, a.z);
  // Bark UVs: wrap once around, run along length in metres.
  const uv = g.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * len);
  return g;
}

function growDeciduous(seed: number, poplar: boolean) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const height = poplar ? 13 + r() * 5 : 8 + r() * 4;
  const branch = (from: THREE.Vector3, dir: THREE.Vector3, len: number, rad: number, depth: number) => {
    // Slightly crooked: split the limb into a few kinked segments.
    const segs = depth === 0 ? 5 : 3;
    let p = from.clone();
    let d = dir.clone();
    let rr = rad;
    for (let s = 0; s < segs; s++) {
      const step = len / segs;
      d.add(new THREE.Vector3((r() - 0.5) * 0.25, (poplar ? 0.06 : 0.02) + (r() - 0.5) * 0.1, (r() - 0.5) * 0.25)).normalize();
      const q = p.clone().addScaledVector(d, step);
      const rn = rad * (1 - (s + 1) / (segs + 0.6));
      parts.push(limb(p, q, rr, Math.max(0.008, rn), depth === 0 ? 7 : depth === 1 ? 5 : 3));
      // Children sprout along the way.
      if (depth < 3) {
        const kids = depth === 0 ? (s >= 1 ? 3 : 0) : depth === 1 ? 2 : 2;
        for (let k = 0; k < kids; k++) {
          const t = r();
          const at = p.clone().lerp(q, t);
          const az = r() * Math.PI * 2;
          const up = poplar ? 0.75 + r() * 0.2 : depth === 0 ? 0.35 + r() * 0.35 : 0.2 + r() * 0.5;
          const nd = new THREE.Vector3(Math.cos(az) * (1 - up), up, Math.sin(az) * (1 - up)).normalize();
          if (depth > 0) nd.lerp(d, 0.35).normalize();
          const nl = len * (depth === 0 ? (poplar ? 0.38 : 0.45) : 0.5) * (0.7 + r() * 0.5) * (1 - (s / segs) * 0.4);
          branch(at, nd, nl, rn * (depth === 0 ? 0.45 : 0.55), depth + 1);
        }
      }
      p = q;
      rr = rn;
    }
  };
  branch(new THREE.Vector3(0, -0.2, 0), new THREE.Vector3(0, 1, 0), height, poplar ? 0.32 : 0.2, 0);
  return mergeGeometries(parts.map((g) => g.toNonIndexed()))!;
}

function growSpruce(seed: number) {
  const r = rng(seed);
  const parts: THREE.BufferGeometry[] = [];
  const height = 6 + r() * 4;
  parts.push(limb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, height, 0), 0.22, 0.04, 6));
  const tiers = Math.floor(height / 0.75);
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const y = 0.9 + t * (height - 1.2);
    const rad = (1 - t) * (2.2 + r() * 0.4) + 0.25;
    // A drooping skirt with a ragged hem.
    const cone = new THREE.ConeGeometry(rad, 1.25, 11, 2, true);
    const pos = cone.attributes.position as THREE.BufferAttribute;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v), yy = pos.getY(v);
      if (yy < 0) {
        const a = Math.atan2(z, x);
        const jag = 1 + 0.18 * Math.sin(a * 11 + i) + (r() - 0.5) * 0.12;
        pos.setXYZ(v, x * jag, yy - 0.15 * Math.abs(Math.sin(a * 5.5 + i)), z * jag);
      }
    }
    cone.rotateY(r() * 6);
    cone.translate(0, y + 0.3, 0);
    cone.computeVertexNormals();
    parts.push(cone.toNonIndexed());
  }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)))!;
}

/** Bark/needles that collect snow on upward-facing surfaces. */
function snowyMaterial(base: THREE.MeshStandardMaterialParameters, snowAmount: number) {
  const m = new THREE.MeshStandardMaterial(base);
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nvUp = normalize((modelMatrix * instanceMatrix * vec4(objectNormal, 0.0)).xyz).y;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float snow = smoothstep(0.25, 0.65, vUp) * ${snowAmount.toFixed(2)};
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), snow);`);
  };
  m.customProgramCacheKey = () => 'snowy' + snowAmount;
  return m;
}

function bark(s: PbrSet, tint: number, rep: [number, number]) {
  const c = (t: THREE.Texture | null) => {
    if (!t) return null;
    const k = t.clone();
    k.repeat.set(rep[0], rep[1]);
    k.needsUpdate = true;
    return k;
  };
  return { map: c(s.map), normalMap: c(s.normal), color: tint, roughness: 0.9 } as THREE.MeshStandardMaterialParameters;
}

export class Trees {
  private variants: Record<Kind, THREE.BufferGeometry[]>;
  private mats: Record<Kind, THREE.Material>;
  private placed: Record<Kind, THREE.Matrix4[][]> = { birch: [[], [], []], poplar: [[], [], []], spruce: [[], [], []] };
  private tmp = new THREE.Object3D();

  constructor(assets: Assets) {
    this.variants = {
      birch: [1, 2, 3].map((s) => growDeciduous(s * 101, false)),
      poplar: [4, 5, 6].map((s) => growDeciduous(s * 101, true)),
      spruce: [7, 8, 9].map((s) => growSpruce(s * 101)),
    };
    const t = assets.tex;
    this.mats = {
      // Birch: pale bark with dark marks (willow bark, lightened).
      birch: snowyMaterial(bark(t.bark_willow, 0xf0ece4, [1, 0.5]), 0.75),
      poplar: snowyMaterial(bark(t.pine_bark, 0x9a958c, [1, 0.4]), 0.75),
      spruce: snowyMaterial({ color: 0x1d3524, roughness: 0.95, side: THREE.DoubleSide }, 0.85),
    };
  }

  add(kind: Kind, x: number, z: number, scale: number, rot: number, variant: number) {
    this.tmp.position.set(x, 0, z);
    this.tmp.rotation.set(0, rot, 0);
    this.tmp.scale.setScalar(scale);
    this.tmp.updateMatrix();
    this.placed[kind][variant % 3].push(this.tmp.matrix.clone());
  }

  build(parent: THREE.Object3D) {
    for (const kind of ['birch', 'poplar', 'spruce'] as Kind[])
      this.placed[kind].forEach((list, v) => {
        if (!list.length) return;
        const im = new THREE.InstancedMesh(this.variants[kind][v], this.mats[kind], list.length);
        list.forEach((m, i) => im.setMatrixAt(i, m));
        im.castShadow = true;
        im.receiveShadow = true;
        im.computeBoundingSphere();
        parent.add(im);
      });
  }
}
