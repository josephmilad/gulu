import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clamp } from '../core/math';
import { ATTACKS } from '../combat/attacks';

/**
 * A realistic, skinned character (Higgsfield/Meshy model with Quaternius
 * animations baked in) behind the same small API the combat code drives:
 * play(name), current, release(), setGuard(), speed, update(dt).
 */
export interface Body {
  root: THREE.Group;
  marker: THREE.Mesh;
  anim: SkinnedAnimator;
}

/** Seconds into each clip where the punch/kick actually lands, measured once per model. */
const impactCache = new Map<GLTF, Record<string, number>>();

let sharedImpacts: Record<string, number> | null = null;

function measureImpacts(g: GLTF) {
  let res = impactCache.get(g);
  if (res) return res;
  // Every model carries the same retargeted clips, so timings measured on a
  // hero rig (Meshy bone names) are shared with rigs that name bones differently.
  if (!g.scene.getObjectByName('LeftHand') || !g.scene.getObjectByName('Hips')) {
    if (sharedImpacts) return sharedImpacts;
    return {};
  }
  res = {};
  const o = SkeletonUtils.clone(g.scene);
  const mixer = new THREE.AnimationMixer(o);
  const bone = (n: string) => o.getObjectByName(n)!;
  const hips = bone('Hips');
  const ends = { kick: ['LeftFoot', 'RightFoot'], other: ['LeftHand', 'RightHand'] };
  const v = new THREE.Vector3();
  const h = new THREE.Vector3();
  for (const name of ['jab', 'cross', 'hook', 'haymaker', 'kick', 'lunge']) {
    const clip = g.animations.find((a) => a.name === name);
    if (!clip) continue;
    const act = mixer.clipAction(clip);
    act.reset().play();
    let best = 0, bestT = clip.duration * 0.4;
    const parts = (name === 'kick' ? ends.kick : ends.other).map(bone);
    for (let i = 1; i < 40; i++) {
      const t = (i / 40) * clip.duration;
      mixer.setTime(t);
      o.updateMatrixWorld(true);
      hips.getWorldPosition(h);
      for (const p of parts) {
        p.getWorldPosition(v);
        // Forward reach, plus a little height so kicks favour the extended leg.
        const reach = v.z - h.z + (name === 'kick' ? (v.y - h.y) * 0.3 : 0);
        if (reach > best) {
          best = reach;
          bestT = t;
        }
      }
    }
    act.stop();
    res[name] = bestT;
  }
  impactCache.set(g, res);
  sharedImpacts = sharedImpacts ?? res;
  return res;
}

const LOOPS = new Set(['idle', 'walk', 'jog', 'sprint', 'folded', 'talk', 'crouch', 'sit', 'dance', 'yes']);

/** Logical animation names used by the combat code → clip names in the GLB. */
const ALIAS: Record<string, string> = {
  fall: 'knockback', down: 'knockback', blockHit: 'block', dodge: 'roll', taunt: 'folded', victory: 'dance',
  scared: 'crouch', smoke: 'talk',
};

export class SkinnedAnimator {
  speed = 0;
  onStep: (() => void) | null = null;
  private mixer: THREE.AnimationMixer;
  private actions = new Map<string, THREE.AnimationAction>();
  private loco: THREE.AnimationAction[] = [];
  private one: THREE.AnimationAction | null = null;
  private oneName = '';
  private oneT = 0;
  private hold = false;
  private impacts: Record<string, number>;
  private stepPhase = 0;
  private flurry: { t: number; i: number } | null = null;

  constructor(root: THREE.Object3D, g: GLTF) {
    this.mixer = new THREE.AnimationMixer(root);
    for (const c of g.animations) this.actions.set(c.name, this.mixer.clipAction(c));
    this.impacts = measureImpacts(g);
    for (const n of ['idle', 'walk', 'jog', 'sprint']) {
      const a = this.actions.get(n)!;
      a.play();
      a.setEffectiveWeight(n === 'idle' ? 1 : 0);
      this.loco.push(a);
    }
    this.actions.get('idle')!.time = Math.random() * 2;
  }

  get current() {
    return this.one ? this.oneName : '';
  }
  get clipTime() {
    return this.oneT;
  }

  setGuard(_on: boolean) {}

  stop() {
    if (this.one) this.one.fadeOut(0.1);
    this.one = null;
    this.oneName = '';
    this.flurry = null;
  }

  release() {
    this.stop();
  }

  /** Play a one-shot or held action by logical name. */
  play(name: string) {
    if (name === 'flurry') {
      this.flurry = { t: 0, i: 0 };
      this.oneName = 'flurry';
      this.startClip('jab', 'flurry', 0.11);
      return;
    }
    this.flurry = null;
    const clipName = name === 'hit' ? (Math.random() < 0.5 ? 'hit_head' : 'hit_chest') : ALIAS[name] ?? name;
    let hitT: number | undefined;
    const atk = ATTACKS[name];
    if (atk) hitT = atk.hits[0].t;
    this.startClip(clipName, name, hitT);
  }

  private startClip(clipName: string, logical: string, hitAt?: number) {
    const a = this.actions.get(clipName);
    if (!a) return;
    const clip = a.getClip();
    const prev = this.one;
    a.reset();
    a.enabled = true;
    a.setEffectiveWeight(1);
    this.hold = logical === 'down' || logical === 'fall' || logical === 'block' || logical === 'dead';
    a.setLoop(LOOPS.has(clipName) && !this.hold ? THREE.LoopRepeat : THREE.LoopOnce, Infinity);
    a.clampWhenFinished = true;
    let scale = 1;
    const impact = this.impacts[clipName];
    if (hitAt && impact) scale = clamp(impact / hitAt, 0.6, 4);
    else if (logical === 'getup') scale = clip.duration / 0.75;
    else if (logical === 'dodge') scale = clip.duration / 0.4;
    else if (logical === 'hit' || logical === 'blockHit') scale = 1.1;
    else if (logical === 'fall') scale = 1.2;
    a.timeScale = scale;
    if (logical === 'down') a.time = clip.duration;
    if (logical === 'block') {
      // Freeze the guard partway through the block clip.
      a.time = clip.duration * 0.35;
      a.timeScale = 0;
    }
    a.play();
    if (prev && prev !== a) a.crossFadeFrom(prev, 0.08, false);
    else if (!prev) for (const l of this.loco) l.setEffectiveWeight(l.getEffectiveWeight());
    this.one = a;
    this.oneName = logical;
    this.oneT = 0;
  }

  update(dt: number) {
    const sp = this.speed;
    // Locomotion blend: idle → walk (1.4 m/s) → jog (3.6) → sprint (6.4).
    const w = [0, 0, 0, 0];
    if (sp < 0.15) w[0] = 1;
    else if (sp < 1.4) [w[0], w[1]] = [1 - sp / 1.4, sp / 1.4];
    else if (sp < 3.6) [w[1], w[2]] = [1 - (sp - 1.4) / 2.2, (sp - 1.4) / 2.2];
    else [w[2], w[3]] = [1 - clamp((sp - 3.6) / 2.8, 0, 1), clamp((sp - 3.6) / 2.8, 0, 1)];
    const rates = [1, clamp(sp / 1.4, 0.6, 1.3), clamp(sp / 3.6, 0.7, 1.3), clamp(sp / 6.4, 0.7, 1.3)];

    let oneW = 0;
    if (this.one) {
      this.oneT += dt;
      if (this.flurry) {
        // Vova's series: jab, cross, jab, cross, then a big hook.
        this.flurry.t += dt;
        const seq: [number, string, number][] = [[0.16, 'cross', 0.27], [0.32, 'jab', 0.43], [0.48, 'cross', 0.59], [0.66, 'hook', 0.84]];
        const s = seq[this.flurry.i];
        if (s && this.flurry.t >= s[0]) {
          this.flurry.i++;
          const keep = this.flurry;
          this.startClip(s[1], 'flurry', s[2] - s[0]);
          this.flurry = keep;
        }
      }
      const a = this.one;
      const clip = a.getClip();
      const finished = a.loop === THREE.LoopOnce && a.time >= clip.duration - 1e-3;
      if (finished && !this.hold && !this.flurry) {
        a.fadeOut(0.15);
        this.one = null;
        this.oneName = '';
      } else if (this.flurry && this.oneT > 1.1) {
        this.stop();
      } else oneW = 1;
    }
    this.loco.forEach((l, i) => {
      l.setEffectiveWeight(w[i] * (1 - oneW));
      l.timeScale = rates[i];
    });
    // Keep the loops in phase so the blend between gaits doesn't scissor.
    const lead = this.loco[w.indexOf(Math.max(...w))];
    const ph = lead.time / lead.getClip().duration;
    for (const l of this.loco) if (l !== lead && l !== this.loco[0]) l.time = ph * l.getClip().duration;
    if (sp > 0.3 && oneW === 0) {
      const s = Math.floor(ph * 2);
      if (s !== this.stepPhase) {
        this.stepPhase = s;
        this.onStep?.();
      }
    }
    this.mixer.update(dt);
  }
}

/** Tint clothing (dark, unsaturated texels) without touching skin, for crowd variety. */
function tintMaterial(src: THREE.Material, tint: THREE.Color, amount: number) {
  const m = (src as THREE.MeshStandardMaterial).clone();
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uTint = { value: tint };
    sh.uniforms.uAmt = { value: amount };
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint;\nuniform float uAmt;')
      .replace(
        '#include <map_fragment>',
        `#include <map_fragment>
        {
          vec3 c = diffuseColor.rgb;
          float l = dot(c, vec3(0.299, 0.587, 0.114));
          float skin = smoothstep(0.03, 0.09, c.r - c.b) * smoothstep(0.08, 0.2, l);
          float cloth = (1.0 - skin) * (1.0 - smoothstep(0.55, 0.8, l));
          diffuseColor.rgb = mix(c, uTint * (0.35 + l * 2.2), cloth * uAmt);
        }`,
      );
  };
  m.customProgramCacheKey = () => 'tint';
  return m;
}

export function makeBody(g: GLTF, opts: { tint?: number; tintAmt?: number; scale?: number; hero?: boolean } = {}): Body {
  const root = new THREE.Group();
  const model = SkeletonUtils.clone(g.scene) as THREE.Object3D;
  if (opts.scale) model.scale.multiplyScalar(opts.scale);
  const tint = opts.tint !== undefined ? new THREE.Color(opts.tint) : null;
  model.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (!m.isMesh) return;
    // Meshy leaves a stray helper sphere in the export.
    if (m.name.startsWith('Icosphere')) {
      m.visible = false;
      return;
    }
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
    if (tint) m.material = tintMaterial(m.material as THREE.Material, tint, opts.tintAmt ?? 0.75);
    const mat = m.material as THREE.MeshStandardMaterial;
    mat.side = THREE.FrontSide;
    mat.envMapIntensity = 0.8;
    if (mat.map) mat.map.anisotropy = 8;
  });
  root.add(model);
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(0.42, 0.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.position.y = 0.03;
  root.add(marker);
  const anim = new SkinnedAnimator(model, g);
  return { root, marker, anim };
}
