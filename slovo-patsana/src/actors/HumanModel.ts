import * as THREE from 'three';

/**
 * Procedural low-poly people. Every body part is a joint (an Object3D) with a
 * mesh hanging off it, so the animator can pose a character by rotating joints.
 * Facing is +Z, the character's left is +X. Arms and legs hang along -Y.
 */
export type HatStyle = 'none' | 'ushanka' | 'knit' | 'fur' | 'cap' | 'beret';
export type HairStyle = 'short' | 'buzz' | 'long' | 'bald' | 'fringe';
export type JacketStyle = 'tracksuit' | 'coat' | 'leather' | 'puffer' | 'jacket' | 'sweater';

export interface Look {
  skin: number;
  hair: number;
  hairStyle: HairStyle;
  hat: HatStyle;
  hatColor: number;
  jacket: number;
  jacketStyle: JacketStyle;
  stripes?: number;
  pants: number;
  pantsStripes?: number;
  shoes: number;
  scarf?: number;
  longCoat?: boolean;
  mustache?: boolean;
  stubble?: boolean;
  glasses?: boolean;
  scar?: boolean;
  female?: boolean;
  build: number; // shoulder/torso width multiplier
  height: number; // overall scale
}

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'shL', 'armL', 'elbowL', 'handL', 'shR', 'armR', 'elbowR', 'handR',
  'thighL', 'kneeL', 'footL', 'thighR', 'kneeR', 'footR',
] as const;
export type JointName = (typeof JOINTS)[number];

export interface HumanRig {
  root: THREE.Group; // world position + heading
  pivot: THREE.Group; // falls rotate about the feet
  joints: Record<JointName, THREE.Object3D>;
  hipsBaseY: number;
  meshes: THREE.Mesh[];
  /** Ring under the feet, coloured by team. */
  marker: THREE.Mesh;
}

const matCache = new Map<string, THREE.Material>();
function mat(color: number, rough = 0.85, map?: THREE.Texture, key?: string): THREE.Material {
  const k = key ?? `${color}|${rough}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: map ? 0xffffff : color, roughness: rough, metalness: 0, map: map ?? null });
    matCache.set(k, m);
  }
  return m;
}

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

function shade(c: number, f: number): string {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return `rgb(${r},${g},${b})`;
}

const texCache = new Map<string, THREE.Texture>();
function canvasTex(key: string, w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  let t = texCache.get(key);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Cloth wrapped around a capsule: u runs around the limb, v along it. */
function clothTex(base: number, stripes?: number, zipper = false, knit = false) {
  return canvasTex(`cloth${base}|${stripes}|${zipper}|${knit}`, 128, 128, (g) => {
    g.fillStyle = hex(base);
    g.fillRect(0, 0, 128, 128);
    // Subtle fabric noise so flat colours don't look plastic.
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
      g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
    }
    if (knit) {
      g.strokeStyle = 'rgba(0,0,0,0.15)';
      for (let y = 0; y < 128; y += 6) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(128, y);
        g.stroke();
      }
    }
    if (stripes !== undefined) {
      // Three stripes down both outer sides (u = 0.25 and 0.75).
      g.fillStyle = hex(stripes);
      for (const cu of [32, 96]) for (const o of [-9, 0, 9]) g.fillRect(cu + o - 2, 0, 4, 128);
    }
    if (zipper) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(0, 0, 2, 128);
      g.fillRect(126, 0, 2, 128);
      g.fillStyle = 'rgba(200,200,200,0.6)';
      g.fillRect(0, 0, 1, 128);
    }
  });
}

function faceTex(l: Look) {
  const key = `face${l.skin}|${l.hair}|${l.hairStyle}|${l.mustache}|${l.stubble}|${l.glasses}|${l.scar}|${l.female}`;
  return canvasTex(key, 256, 128, (g) => {
    g.fillStyle = hex(l.skin);
    g.fillRect(0, 0, 256, 128);
    const cx = 64; // u = 0.25 faces +Z
    // Soft shading on the sides of the face.
    const grd = g.createLinearGradient(cx - 60, 0, cx + 60, 0);
    grd.addColorStop(0, shade(l.skin, 0.8));
    grd.addColorStop(0.5, 'rgba(0,0,0,0)');
    grd.addColorStop(1, shade(l.skin, 0.8));
    g.fillStyle = grd;
    g.globalAlpha = 0.5;
    g.fillRect(cx - 60, 0, 120, 128);
    g.globalAlpha = 1;
    if (l.stubble) {
      g.fillStyle = 'rgba(40,30,25,0.28)';
      g.beginPath();
      g.ellipse(cx, 92, 22, 16, 0, 0, Math.PI * 2);
      g.fill();
    }
    if (!l.female) {
      // Brows
      g.fillStyle = shade(l.hair, 0.8);
      g.fillRect(cx - 17, 51, 11, 3);
      g.fillRect(cx + 6, 51, 11, 3);
    } else {
      g.fillStyle = shade(l.hair, 0.8);
      g.fillRect(cx - 16, 52, 10, 2);
      g.fillRect(cx + 6, 52, 10, 2);
    }
    // Eyes
    g.fillStyle = '#f2efe8';
    g.fillRect(cx - 16, 57, 9, 5);
    g.fillRect(cx + 7, 57, 9, 5);
    g.fillStyle = '#2a2a33';
    g.fillRect(cx - 13, 57, 4, 5);
    g.fillRect(cx + 10, 57, 4, 5);
    if (l.female) {
      g.fillStyle = '#111';
      g.fillRect(cx - 17, 56, 11, 1);
      g.fillRect(cx + 6, 56, 11, 1);
    }
    // Nose
    g.fillStyle = shade(l.skin, 0.72);
    g.fillRect(cx - 2, 62, 4, 12);
    g.fillRect(cx - 4, 72, 8, 3);
    // Mouth
    g.fillStyle = l.female ? '#a3393f' : shade(l.skin, 0.55);
    g.fillRect(cx - 8, 82, 16, 3);
    if (l.mustache) {
      g.fillStyle = shade(l.hair, 0.9);
      g.fillRect(cx - 11, 77, 22, 5);
    }
    if (l.scar) {
      g.strokeStyle = 'rgba(140,60,60,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(cx + 18, 48);
      g.lineTo(cx + 12, 70);
      g.stroke();
    }
    if (l.glasses) {
      g.strokeStyle = '#222';
      g.lineWidth = 2;
      g.strokeRect(cx - 19, 54, 15, 11);
      g.strokeRect(cx + 4, 54, 15, 11);
      g.beginPath();
      g.moveTo(cx - 4, 58);
      g.lineTo(cx + 4, 58);
      g.stroke();
    }
    // Hair on the scalp + back of the head.
    if (l.hairStyle !== 'bald') {
      g.fillStyle = hex(l.hair);
      const top = l.hairStyle === 'buzz' ? 34 : l.hairStyle === 'fringe' ? 48 : 40;
      g.fillRect(0, 0, 256, top);
      // Back of head (u = 0.75 → x = 192)
      const back = l.hairStyle === 'long' || l.female ? 124 : l.hairStyle === 'buzz' ? 70 : 84;
      g.beginPath();
      g.moveTo(cx + 40, top);
      g.quadraticCurveTo(192, back + 10, 256 + cx - 40, top);
      g.fill();
      // Sideburns
      g.fillRect(cx - 34, top, 6, 18);
      g.fillRect(cx + 28, top, 6, 18);
      if (l.hairStyle === 'buzz') {
        g.fillStyle = 'rgba(0,0,0,0.15)';
        g.fillRect(0, 0, 256, top);
      }
    }
  });
}

function capsule(r: number, len: number, m: THREE.Material, segs = 10) {
  const geo = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 2), 4, segs);
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.y = -len / 2;
  return mesh;
}

export function buildHuman(l: Look): HumanRig {
  const root = new THREE.Group();
  const pivot = new THREE.Group();
  root.add(pivot);
  const body = new THREE.Group();
  body.scale.setScalar(l.height);
  pivot.add(body);
  const meshes: THREE.Mesh[] = [];
  const add = (parent: THREE.Object3D, m: THREE.Mesh) => {
    m.castShadow = true;
    parent.add(m);
    meshes.push(m);
    return m;
  };
  const j = (parent: THREE.Object3D, x: number, y: number, z: number) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    parent.add(o);
    return o;
  };

  const w = l.build;
  const isTrack = l.jacketStyle === 'tracksuit';
  const rough = l.jacketStyle === 'leather' ? 0.42 : l.jacketStyle === 'puffer' ? 0.6 : 0.88;
  const torsoMat = mat(0, rough, clothTex(l.jacket, undefined, isTrack || l.jacketStyle === 'leather' || l.jacketStyle === 'puffer', l.jacketStyle === 'sweater'), `torso${l.jacket}${l.jacketStyle}`);
  const sleeveMat = mat(0, rough, clothTex(l.jacket, isTrack ? l.stripes ?? 0xffffff : undefined, false, l.jacketStyle === 'sweater'), `sleeve${l.jacket}${l.stripes}${l.jacketStyle}`);
  const pantsMat = mat(0, 0.9, clothTex(l.pants, l.pantsStripes), `pants${l.pants}${l.pantsStripes}`);
  const skinMat = mat(l.skin, 0.75);
  const shoeMat = mat(l.shoes, 0.55);
  const hatMat = mat(l.hatColor, l.hat === 'fur' || l.hat === 'ushanka' ? 1 : 0.9);
  const bulk = l.jacketStyle === 'puffer' || l.jacketStyle === 'coat' ? 1.12 : 1;

  const hipsBaseY = 0.98;
  const hips = j(body, 0, hipsBaseY, 0);
  add(hips, new THREE.Mesh(new THREE.CapsuleGeometry(0.135, 0.12, 4, 10), pantsMat)).scale.set(1.25 * w, 1, 0.8);
  const spine = j(hips, 0, 0.08, 0);
  const abdomen = add(spine, new THREE.Mesh(new THREE.CapsuleGeometry(0.15, 0.1, 4, 10), torsoMat));
  abdomen.position.y = 0.1;
  abdomen.scale.set(1.15 * w * bulk, 1, 0.78 * bulk);
  const chest = j(spine, 0, 0.18, 0);
  const torso = add(chest, new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.16, 4, 12), torsoMat));
  torso.position.y = 0.15;
  torso.scale.set(1.22 * w * bulk, 1, 0.74 * bulk);
  if (l.scarf !== undefined) {
    const s = add(chest, new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.04, 6, 12), mat(l.scarf, 0.95)));
    s.rotation.x = Math.PI / 2;
    s.position.set(0, 0.33, 0.01);
  }
  if (isTrack || l.jacketStyle === 'leather') {
    // Collar
    const c = add(chest, new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.1, 0.07, 10, 1, true), torsoMat));
    c.position.y = 0.34;
  }
  const neck = j(chest, 0, 0.33, 0);
  add(neck, new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.058, 0.1, 8), skinMat)).position.y = 0.04;
  const head = j(neck, 0, 0.09, 0);
  const headMesh = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.115, 18, 14), mat(0, 0.7, faceTex(l), 'face' + JSON.stringify(l))));
  headMesh.position.y = 0.1;
  headMesh.scale.set(0.9, 1.1, 1);
  for (const sx of [-1, 1]) {
    const ear = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.028, 6, 6), skinMat));
    ear.position.set(sx * 0.103, 0.1, 0);
    ear.scale.set(0.5, 1, 0.8);
  }
  const hairMat = mat(l.hair, 0.95);
  if (l.hairStyle !== 'bald' && l.hairStyle !== 'buzz' && l.hat === 'none') {
    const cap = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.122, 14, 8, 0, Math.PI * 2, 0, 1.15), hairMat));
    cap.position.set(0, 0.11, -0.006);
    cap.scale.set(0.93, 1.12, 1.03);
    if (l.hairStyle === 'fringe') {
      const f = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.04, 0.05), hairMat));
      f.position.set(0, 0.19, 0.085);
      f.rotation.x = 0.4;
    }
  }
  if (l.hairStyle === 'long' || (l.female && l.hat === 'none')) {
    const back = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 0.06), hairMat));
    back.position.set(0, 0.03, -0.085);
  }
  switch (l.hat) {
    case 'ushanka': {
      const top = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.135, 0.11, 14), hatMat));
      top.position.y = 0.2;
      const brim = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.05), hatMat));
      brim.position.set(0, 0.24, 0.11);
      for (const sx of [-1, 1]) {
        const flap = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.12, 0.11), hatMat));
        flap.position.set(sx * 0.12, 0.12, -0.005);
      }
      break;
    }
    case 'fur': {
      const top = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.13, 0.15, 16), hatMat));
      top.position.y = 0.22;
      break;
    }
    case 'knit': {
      const top = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.125, 12, 8, 0, Math.PI * 2, 0, 1.6), hatMat));
      top.position.y = 0.13;
      top.scale.set(0.95, 1.15, 1.02);
      const tip = add(head, new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), hatMat));
      tip.position.set(0, 0.29, -0.03);
      tip.rotation.x = -0.5;
      break;
    }
    case 'cap': {
      const top = add(head, new THREE.Mesh(new THREE.SphereGeometry(0.124, 12, 8, 0, Math.PI * 2, 0, 1.3), hatMat));
      top.position.y = 0.13;
      top.scale.set(0.95, 0.95, 1.05);
      const visor = add(head, new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.015, 0.09), hatMat));
      visor.position.set(0, 0.18, 0.13);
      break;
    }
    case 'beret': {
      const top = add(head, new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.12, 0.05, 14), hatMat));
      top.position.set(0, 0.22, -0.01);
      top.rotation.z = 0.15;
      break;
    }
  }

  // Arms
  const arm = (side: 1 | -1) => {
    const sh = j(chest, side * 0.2 * w * bulk, 0.26, 0);
    const a = j(sh, 0, 0, 0);
    add(a, capsule(0.06 * bulk, 0.3, sleeveMat));
    const el = j(a, 0, -0.29, 0);
    add(el, capsule(0.052 * bulk, 0.27, sleeveMat));
    const hand = j(el, 0, -0.27, 0);
    const fist = add(hand, new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.09, 0.09), skinMat));
    fist.position.y = -0.04;
    return [sh, a, el, hand] as const;
  };
  const [shL, armL, elbowL, handL] = arm(1);
  const [shR, armR, elbowR, handR] = arm(-1);

  // Legs
  const leg = (side: 1 | -1) => {
    const th = j(hips, side * 0.095, -0.05, 0);
    add(th, capsule(0.08, 0.45, pantsMat));
    const kn = j(th, 0, -0.44, 0);
    add(kn, capsule(0.062, 0.43, pantsMat));
    const ft = j(kn, 0, -0.43, 0);
    const shoe = add(ft, new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.25), shoeMat));
    shoe.position.set(0, -0.015, 0.05);
    if (l.longCoat) {
      // Coat tails ride on the thighs so they swing with the legs.
      const tail = add(th, new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.17, 0.62, 10, 1, true, side > 0 ? 0 : Math.PI, Math.PI), torsoMat));
      tail.material = mat(l.jacket, rough, undefined, `coatside${l.jacket}`);
      (tail.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      tail.position.set(side * -0.02, -0.25, 0);
      tail.rotation.y = side > 0 ? 0 : 0;
    }
    return [th, kn, ft] as const;
  };
  const [thighL, kneeL, footL] = leg(1);
  const [thighR, kneeR, footR] = leg(-1);

  if (l.female && !l.longCoat) {
    const skirt = add(hips, new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 0.5, 12, 1, true), mat(l.jacket, 0.9)));
    (skirt.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    skirt.position.y = -0.22;
  }

  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.0, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  root.add(marker);

  return {
    root, pivot, hipsBaseY, meshes, marker,
    joints: {
      hips, spine, chest, neck, head,
      shL, armL, elbowL, handL, shR, armR, elbowR, handR,
      thighL, kneeL, footL, thighR, kneeR, footR,
    },
  };
}
