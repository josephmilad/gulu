import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Realistic Soviet cars from Sketchfab (CC-BY, see public/assets/vehicles/*.credit.txt):
 * LADA 2107, VAZ-2106 militsiya, GAZ-24 Volga (also as a taxi) and UAZ-469.
 * Paint is recoloured per car in the shader so one model gives a whole
 * street of different 80s colours. The car faces +Z; y = 0 is the ground.
 */
export type CarKind = 'zhiguli' | 'volga' | 'taxi' | 'uaz' | 'police';

interface KindInfo {
  model: string;
  /** Hue (0..1) of the original paint in the texture, to recolour. */
  paintHue: number;
  paints: [number, number, number][]; // target h, s, v-multiplier
  wheelR: number;
  lampY: number;
}

const KINDS: Record<CarKind, KindInfo> = {
  zhiguli: {
    model: 'zhiguli', paintHue: 0.61, wheelR: 0.3, lampY: 0.66,
    paints: [[0.0, 0.75, 1.0], [0.61, 0.7, 1.0], [0.08, 0.25, 2.6], [0.13, 0.15, 3.2], [0.33, 0.5, 1.1], [0.11, 0.75, 2.0], [0.95, 0.6, 1.0], [0.55, 0.2, 2.2], [0.0, 0.0, 3.4]],
  },
  volga: {
    model: 'volga', paintHue: 0.38, wheelR: 0.34, lampY: 0.7,
    paints: [[0.38, 0.5, 1.0], [0.0, 0.0, 0.35], [0.6, 0.45, 0.9], [0.0, 0.0, 3.0], [0.02, 0.6, 0.8], [0.1, 0.2, 2.4]],
  },
  taxi: { model: 'volga', paintHue: 0.38, wheelR: 0.34, lampY: 0.7, paints: [[0.13, 0.75, 2.2]] },
  uaz: { model: 'uaz', paintHue: 0.22, wheelR: 0.4, lampY: 0.95, paints: [[0.22, 0.4, 1.0], [0.3, 0.3, 0.9]] },
  police: { model: 'zhiguli_police', paintHue: -1, wheelR: 0.3, lampY: 0.66, paints: [[0, 0, 1]] },
};

export const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6e0, emissive: 0xfff1c8, emissiveIntensity: 3, roughness: 0.2 });
export const tailMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1a10, emissiveIntensity: 0.8, roughness: 0.3 });
export const brakeMat = new THREE.MeshStandardMaterial({ color: 0x6a0a0a, emissive: 0xff1a10, emissiveIntensity: 4, roughness: 0.3 });

let models: Record<string, GLTF> = {};
/** Called once after assets load. */
export function setCarModels(m: Record<string, GLTF>) {
  models = m;
}

/** Shift the body paint to another colour, leaving chrome, glass and tyres alone. */
function recolor(src: THREE.MeshStandardMaterial, fromHue: number, to: [number, number, number]) {
  const m = src.clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uFrom = { value: fromHue };
    sh.uniforms.uTo = { value: new THREE.Vector3(...to) };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform float uFrom;
        uniform vec3 uTo;
        vec3 rgb2hsv(vec3 c) {
          vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
          vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
          vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
          float d = q.x - min(q.w, q.y);
          return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + 1e-10)), d / (q.x + 1e-10), q.x);
        }
        vec3 hsv2rgb(vec3 c) {
          vec3 p = abs(fract(c.xxx + vec3(1.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
          return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
        }`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        {
          vec3 hsv = rgb2hsv(diffuseColor.rgb);
          float dh = abs(fract(hsv.x - uFrom + 0.5) - 0.5);
          float paint = smoothstep(0.12, 0.25, hsv.y) * (1.0 - smoothstep(0.07, 0.12, dh));
          vec3 t = hsv2rgb(vec3(uTo.x, mix(hsv.y, uTo.y, 0.85), clamp(hsv.z * uTo.z, 0.0, 0.95)));
          diffuseColor.rgb = mix(diffuseColor.rgb, t, paint);
        }`);
  };
  m.customProgramCacheKey = () => 'carpaint';
  return m;
}

function textTex(text: string, fg: string, bg: string, w = 256, h = 64) {
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
  g.fillText(text, w / 2, h / 2 + 3);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export interface CarVisual {
  root: THREE.Group;
  wheels: THREE.Object3D[];
  steer: THREE.Object3D[];
  brake: THREE.Mesh[];
  headlights: THREE.Mesh[];
  beacons: THREE.Mesh[];
  spec: { length: number; width: number; wheelR: number };
  color: number;
}

export function buildCar(kind: CarKind, _color?: number, _opts: { snow?: boolean } = {}): CarVisual {
  const info = KINDS[kind];
  const g = models[info.model];
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const car = g.scene.clone(true);
  body.add(car);
  const paint = info.paints[Math.floor(Math.random() * info.paints.length)];
  const matCache = new Map<THREE.Material, THREE.Material>();
  car.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    m.castShadow = true;
    m.receiveShadow = true;
    const src = m.material as THREE.MeshStandardMaterial;
    let mat = matCache.get(src);
    if (!mat) {
      if (info.paintHue >= 0) mat = recolor(src, info.paintHue, paint);
      else {
        // The militsiya model uses one alpha-blended atlas; draw it opaque so it sorts properly.
        mat = src.clone();
        (mat as THREE.MeshStandardMaterial).transparent = false;
        (mat as THREE.MeshStandardMaterial).depthWrite = true;
      }
      (mat as THREE.MeshStandardMaterial).envMapIntensity = 1.3;
      matCache.set(src, mat);
    }
    m.material = mat;
  });
  const box = new THREE.Box3().setFromObject(car);
  const size = box.getSize(new THREE.Vector3());
  const W = size.x, L = size.z;
  const wheels = ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR'].map((n) => car.getObjectByName(n)).filter((o): o is THREE.Object3D => !!o);
  for (const w of wheels) w.rotation.order = 'YXZ';
  const steer = wheels.filter((w) => w.name.includes('_F'));

  // Lamps: glowing headlights and tail/brake lights at the corners of the model.
  const headlights: THREE.Mesh[] = [];
  const brake: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(new THREE.CircleGeometry(0.085, 14), headMat);
    hl.position.set(sx * (W / 2 - 0.3), info.lampY, box.max.z + 0.01);
    body.add(hl);
    headlights.push(hl);
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.1), tailMat.clone());
    tl.position.set(sx * (W / 2 - 0.25), info.lampY + 0.02, box.min.z - 0.01);
    tl.rotation.y = Math.PI;
    body.add(tl);
    brake.push(tl);
  }
  const beacons: THREE.Mesh[] = [];
  if (kind === 'police') {
    for (const sx of [-1, 1]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), new THREE.MeshStandardMaterial({ color: 0x1030a0, emissive: 0x2050ff, emissiveIntensity: 0, roughness: 0.2 }));
      b.position.set(sx * 0.22, box.max.y - 0.12, -0.15);
      body.add(b);
      beacons.push(b);
    }
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.16), new THREE.MeshStandardMaterial({ map: textTex('ТАКСИ', '#111', '#ffd84a'), emissive: 0xffc030, emissiveIntensity: 0.6 }));
    sign.position.set(0, box.max.y + 0.07, -0.2);
    body.add(sign);
  }
  return { root, wheels, steer, brake, headlights, beacons, spec: { length: L, width: W, wheelR: info.wheelR }, color: 0 };
}
