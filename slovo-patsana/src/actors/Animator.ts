import type { HumanRig, JointName } from './HumanModel';
import { clamp, lerp, smooth } from '../core/math';

type V3 = [number, number, number];
/** A (partial) pose: joint rotations plus whole-body offsets. */
export type Pose = Partial<Record<JointName, V3>> & { rootRx?: number; hipY?: number; rootZ?: number };
export interface Clip {
  dur: number;
  keys: [number, Pose][];
  loop?: boolean;
}

/*
 * Conventions: arms/legs hang along -Y, so a NEGATIVE x rotation swings them
 * forward; for the spine/neck/head a POSITIVE x leans forward. The left arm is
 * on +X, so +z raises it sideways (and -z raises the right arm).
 */
const GUARD: Pose = {
  armL: [-0.55, 0, -0.25], elbowL: [-2.25, 0, 0], armR: [-0.45, 0, 0.3], elbowR: [-2.35, 0, 0],
  handL: [0.2, 0, 0], handR: [0.2, 0, 0],
  chest: [0.08, 0.32, 0], head: [0.05, -0.28, 0], spine: [0.05, 0, 0],
  thighL: [-0.3, 0, 0.05], kneeL: [0.4, 0, 0], footL: [-0.1, 0, 0],
  thighR: [0.25, 0, -0.08], kneeR: [0.35, 0, 0], footR: [-0.05, 0, 0],
  hipY: -0.06,
};

const BLOCK: Pose = {
  armL: [-1.0, 0, -0.4], elbowL: [-2.55, 0, 0], armR: [-1.0, 0, 0.4], elbowR: [-2.55, 0, 0],
  chest: [0.25, 0.1, 0], head: [0.3, 0, 0], spine: [0.1, 0, 0], hipY: -0.1,
  thighL: [-0.35, 0, 0.05], kneeL: [0.55, 0, 0], thighR: [0.25, 0, -0.08], kneeR: [0.5, 0, 0],
};

const P = (o: Pose): Pose => o;

export const CLIPS: Record<string, Clip> = {
  jab: {
    dur: 0.32,
    keys: [
      [0, P({ ...GUARD })],
      [0.08, P({ armL: [-1.58, 0, -0.1], elbowL: [-0.08, 0, 0], chest: [0.1, -0.25, 0], head: [0.05, 0.1, 0] })],
      [0.16, P({ armL: [-1.55, 0, -0.1], elbowL: [-0.12, 0, 0], chest: [0.1, -0.22, 0] })],
      [0.32, P({ ...GUARD })],
    ],
  },
  cross: {
    dur: 0.4,
    keys: [
      [0, P({ ...GUARD })],
      [0.1, P({ armR: [-1.6, 0, 0.12], elbowR: [-0.05, 0, 0], chest: [0.15, 0.55, 0], head: [0.05, -0.4, 0], thighR: [0.35, 0, 0], footR: [0.4, 0, 0] })],
      [0.2, P({ armR: [-1.58, 0, 0.12], elbowR: [-0.1, 0, 0], chest: [0.15, 0.5, 0] })],
      [0.4, P({ ...GUARD })],
    ],
  },
  hook: {
    dur: 0.48,
    keys: [
      [0, P({ ...GUARD })],
      [0.1, P({ armL: [-0.6, 0, 1.0], elbowL: [-1.6, 0, 0], chest: [0.1, 0.55, 0], hipY: -0.12 })],
      [0.2, P({ armL: [-1.35, 0, 0.9], elbowL: [-1.5, 0, 0], chest: [0.15, -0.6, 0], head: [0.1, 0.3, 0], hipY: -0.1 })],
      [0.3, P({ armL: [-1.4, 0, 0.6], elbowL: [-1.5, 0, 0], chest: [0.15, -0.75, 0], hipY: -0.08 })],
      [0.48, P({ ...GUARD })],
    ],
  },
  uppercut: {
    dur: 0.52,
    keys: [
      [0, P({ ...GUARD })],
      [0.12, P({ armR: [-0.2, 0, 0.3], elbowR: [-1.9, 0, 0], chest: [0.35, 0.45, 0], hipY: -0.2, kneeL: [0.8, 0, 0], kneeR: [0.8, 0, 0] })],
      [0.24, P({ armR: [-2.3, 0, 0.2], elbowR: [-1.4, 0, 0], chest: [-0.15, -0.1, 0], head: [-0.2, 0, 0], hipY: 0.02 })],
      [0.34, P({ armR: [-2.4, 0, 0.2], elbowR: [-1.3, 0, 0], chest: [-0.15, -0.1, 0], hipY: 0.02 })],
      [0.52, P({ ...GUARD })],
    ],
  },
  kick: {
    dur: 0.6,
    keys: [
      [0, P({ ...GUARD })],
      [0.14, P({ thighR: [-1.35, 0, 0], kneeR: [1.9, 0, 0], footR: [0.4, 0, 0], spine: [-0.15, 0, 0], kneeL: [0.25, 0, 0] })],
      [0.24, P({ thighR: [-1.55, 0, 0], kneeR: [0.05, 0, 0], footR: [-0.5, 0, 0], spine: [-0.32, 0, 0], chest: [0, 0.1, 0], kneeL: [0.2, 0, 0] })],
      [0.36, P({ thighR: [-1.5, 0, 0], kneeR: [0.1, 0, 0], footR: [-0.4, 0, 0], spine: [-0.3, 0, 0], kneeL: [0.2, 0, 0] })],
      [0.48, P({ thighR: [-0.8, 0, 0], kneeR: [1.5, 0, 0], spine: [-0.05, 0, 0] })],
      [0.6, P({ ...GUARD })],
    ],
  },
  /** Vova: a burst of alternating straight punches, finished by a cross. */
  flurry: {
    dur: 1.05,
    keys: [
      [0, P({ ...GUARD })],
      ...[0, 1, 2, 3].flatMap((i): [number, Pose][] => {
        const t = 0.05 + i * 0.16;
        const left = i % 2 === 0;
        return [
          [t + 0.06, left
            ? P({ armL: [-1.6, 0, -0.15], elbowL: [-0.1, 0, 0], armR: [-0.45, 0, 0.3], elbowR: [-2.35, 0, 0], chest: [0.12, -0.3, 0] })
            : P({ armR: [-1.6, 0, 0.15], elbowR: [-0.1, 0, 0], armL: [-0.55, 0, -0.25], elbowL: [-2.25, 0, 0], chest: [0.12, 0.35, 0] })],
          [t + 0.14, P({ ...GUARD, chest: [0.1, 0, 0] })],
        ];
      }),
      [0.8, P({ armR: [-1.62, 0, 0.1], elbowR: [-0.02, 0, 0], chest: [0.2, 0.6, 0], head: [0.05, -0.4, 0], hipY: -0.1, thighR: [0.4, 0, 0] })],
      [0.88, P({ armR: [-1.6, 0, 0.1], elbowR: [-0.05, 0, 0], chest: [0.2, 0.55, 0], hipY: -0.1 })],
      [1.05, P({ ...GUARD })],
    ],
  },
  /** Andrey: a running lunge with an outstretched fist. */
  lunge: {
    dur: 0.7,
    keys: [
      [0, P({ ...GUARD })],
      [0.12, P({ armR: [0.4, 0, 0.3], elbowR: [-1.2, 0, 0], chest: [0.4, 0.4, 0], hipY: -0.22, kneeL: [0.9, 0, 0], kneeR: [0.9, 0, 0] })],
      [0.25, P({ armR: [-1.65, 0, 0.05], elbowR: [0, 0, 0], armL: [0.6, 0, 0.3], elbowL: [-0.8, 0, 0], chest: [0.45, 0.35, 0], spine: [0.3, 0, 0], thighL: [-0.9, 0, 0], kneeL: [0.6, 0, 0], thighR: [0.7, 0, 0], kneeR: [0.4, 0, 0], hipY: -0.15 })],
      [0.5, P({ armR: [-1.6, 0, 0.05], elbowR: [-0.1, 0, 0], chest: [0.3, 0.3, 0], spine: [0.2, 0, 0], thighL: [-0.6, 0, 0], kneeL: [0.5, 0, 0], thighR: [0.4, 0, 0], kneeR: [0.4, 0, 0], hipY: -0.1 })],
      [0.7, P({ ...GUARD })],
    ],
  },
  /** Kashchey: a slow, telegraphed haymaker with brass knuckles. */
  haymaker: {
    dur: 0.95,
    keys: [
      [0, P({ ...GUARD })],
      [0.38, P({ armR: [0.5, 0, 0.9], elbowR: [-1.5, 0, 0], chest: [-0.05, 0.9, 0], head: [0, -0.6, 0], hipY: -0.12, thighR: [0.4, 0, 0] })],
      [0.5, P({ armR: [-1.4, 0, 1.0], elbowR: [-0.9, 0, 0], chest: [0.2, -0.5, 0], head: [0.1, 0.2, 0], hipY: -0.15 })],
      [0.62, P({ armR: [-1.45, 0, 0.6], elbowR: [-0.6, 0, 0], chest: [0.25, -0.85, 0], hipY: -0.15 })],
      [0.95, P({ ...GUARD })],
    ],
  },
  block: { dur: 1, loop: true, keys: [[0, P({ ...BLOCK })]] },
  hit: {
    dur: 0.38,
    keys: [
      [0, P({ head: [-0.6, 0.2, 0.1], chest: [-0.35, -0.2, 0], spine: [-0.15, 0, 0], armL: [-0.2, 0, 0.5], elbowL: [-1, 0, 0], armR: [-0.2, 0, -0.5], elbowR: [-1, 0, 0] })],
      [0.38, P({ ...GUARD })],
    ],
  },
  blockHit: {
    dur: 0.22,
    keys: [
      [0, P({ ...BLOCK, chest: [0.05, 0, 0], head: [0, 0, 0], hipY: -0.04 })],
      [0.22, P({ ...BLOCK })],
    ],
  },
  fall: {
    dur: 0.55,
    keys: [
      [0, P({ head: [-0.5, 0, 0], chest: [-0.3, 0, 0], armL: [-0.3, 0, 0.6], armR: [-0.3, 0, -0.6], rootRx: 0, hipY: 0 })],
      [0.25, P({ head: [-0.3, 0, 0], armL: [-1.5, 0, 0.9], armR: [-1.5, 0, -0.9], thighL: [-0.6, 0, 0], kneeL: [0.6, 0, 0], thighR: [-0.4, 0, 0], kneeR: [0.4, 0, 0], rootRx: -0.9, hipY: -0.05 })],
      [0.55, P({ head: [0.1, 0.4, 0], armL: [-0.2, 0, 1.4], elbowL: [-0.5, 0, 0], armR: [-0.4, 0, -1.2], elbowR: [-0.8, 0, 0], thighL: [-0.3, 0, 0.15], kneeL: [0.4, 0, 0], thighR: [-0.05, 0, -0.1], kneeR: [0.1, 0, 0], rootRx: -1.47, hipY: 0, rootZ: 0 })],
    ],
  },
  down: {
    dur: 1,
    loop: true,
    keys: [[0, P({ head: [0.1, 0.4, 0], armL: [-0.2, 0, 1.4], elbowL: [-0.5, 0, 0], armR: [-0.4, 0, -1.2], elbowR: [-0.8, 0, 0], thighL: [-0.3, 0, 0.15], kneeL: [0.4, 0, 0], thighR: [-0.05, 0, -0.1], kneeR: [0.1, 0, 0], rootRx: -1.47, hipY: 0, rootZ: 0 })]],
  },
  getup: {
    dur: 0.75,
    keys: [
      [0, P({ head: [0.1, 0.4, 0], armL: [-0.2, 0, 1.4], armR: [-0.4, 0, -1.2], rootRx: -1.47, hipY: 0, rootZ: 0 })],
      [0.3, P({ head: [0.4, 0, 0], spine: [0.6, 0, 0], armL: [0.3, 0, 0.3], armR: [0.3, 0, -0.3], thighL: [-1.6, 0, 0], kneeL: [2.0, 0, 0], thighR: [-1.2, 0, 0], kneeR: [1.8, 0, 0], rootRx: -0.5, hipY: -0.6, rootZ: 0 })],
      [0.55, P({ spine: [0.5, 0, 0], thighL: [-1.0, 0, 0], kneeL: [1.6, 0, 0], thighR: [-0.6, 0, 0], kneeR: [1.2, 0, 0], rootRx: 0, hipY: -0.35 })],
      [0.75, P({ ...GUARD })],
    ],
  },
  dodge: {
    dur: 0.4,
    keys: [
      [0, P({ ...GUARD })],
      [0.1, P({ ...GUARD, spine: [0.45, 0, 0], chest: [0.3, 0.2, 0.3], hipY: -0.3, kneeL: [1.1, 0, 0], kneeR: [1.1, 0, 0], thighL: [-0.8, 0, 0], thighR: [-0.4, 0, 0] })],
      [0.28, P({ ...GUARD, spine: [0.35, 0, 0], hipY: -0.25, kneeL: [0.9, 0, 0], kneeR: [0.9, 0, 0], thighL: [-0.7, 0, 0], thighR: [-0.3, 0, 0] })],
      [0.4, P({ ...GUARD })],
    ],
  },
  taunt: {
    dur: 1.6,
    keys: [
      [0, P({})],
      [0.3, P({ armL: [-0.2, 0, 0.5], elbowL: [-2.4, 0, 0], armR: [-0.2, 0, -0.5], elbowR: [-2.4, 0, 0], chest: [-0.15, 0, 0], head: [-0.2, 0, 0] })],
      [1.3, P({ armL: [-0.2, 0, 0.5], elbowL: [-2.4, 0, 0], armR: [-0.2, 0, -0.5], elbowR: [-2.4, 0, 0], chest: [-0.15, 0, 0], head: [-0.2, 0.3, 0] })],
      [1.6, P({})],
    ],
  },
  victory: {
    dur: 1.2,
    keys: [
      [0, P({})],
      [0.3, P({ armR: [-2.9, 0, 0.2], elbowR: [-0.3, 0, 0], armL: [-0.3, 0, -0.1], elbowL: [-1.6, 0, 0], chest: [-0.1, 0.1, 0], head: [-0.25, 0, 0] })],
      [0.6, P({ armR: [-3.0, 0, 0.1], elbowR: [-0.6, 0, 0], armL: [-0.3, 0, -0.1], elbowL: [-1.6, 0, 0], chest: [-0.1, 0.1, 0], head: [-0.25, 0, 0] })],
      [0.9, P({ armR: [-2.9, 0, 0.2], elbowR: [-0.3, 0, 0], armL: [-0.3, 0, -0.1], elbowL: [-1.6, 0, 0], chest: [-0.1, 0.1, 0], head: [-0.25, 0, 0] })],
      [1.2, P({})],
    ],
  },
  scared: {
    dur: 1,
    loop: true,
    keys: [
      [0, P({ armL: [-2.6, 0, 0.6], elbowL: [-0.8, 0, 0], armR: [-2.6, 0, -0.6], elbowR: [-0.8, 0, 0], head: [-0.15, 0, 0] })],
      [0.5, P({ armL: [-2.7, 0, 0.5], elbowL: [-0.6, 0, 0], armR: [-2.7, 0, -0.5], elbowR: [-0.6, 0, 0], head: [-0.15, 0, 0] })],
      [1, P({ armL: [-2.6, 0, 0.6], elbowL: [-0.8, 0, 0], armR: [-2.6, 0, -0.6], elbowR: [-0.8, 0, 0], head: [-0.15, 0, 0] })],
    ],
  },
  smoke: {
    dur: 4,
    loop: true,
    keys: [
      [0, P({ armR: [-0.3, 0, 0.1], elbowR: [-1.4, 0, 0], armL: [0.15, 0, 0.12], elbowL: [-0.1, 0, 0] })],
      [1.2, P({ armR: [-0.3, 0, 0.1], elbowR: [-1.4, 0, 0], armL: [0.15, 0, 0.12] })],
      [1.6, P({ armR: [-0.5, 0, 0.35], elbowR: [-2.5, 0, 0], head: [-0.1, 0, 0], armL: [0.15, 0, 0.12] })],
      [2.2, P({ armR: [-0.5, 0, 0.35], elbowR: [-2.5, 0, 0], head: [-0.1, 0, 0], armL: [0.15, 0, 0.12] })],
      [2.6, P({ armR: [-0.3, 0, 0.1], elbowR: [-1.4, 0, 0], armL: [0.15, 0, 0.12] })],
      [4, P({ armR: [-0.3, 0, 0.1], elbowR: [-1.4, 0, 0], armL: [0.15, 0, 0.12] })],
    ],
  },
};

const JN: JointName[] = [
  'hips', 'spine', 'chest', 'neck', 'head', 'shL', 'armL', 'elbowL', 'handL', 'shR', 'armR', 'elbowR', 'handR',
  'thighL', 'kneeL', 'footL', 'thighR', 'kneeR', 'footR',
];

function samplePose(clip: Clip, t: number, base: Pose, out: Pose) {
  const keys = clip.keys;
  if (clip.loop) t = t % clip.dur;
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1][0] <= t) i++;
  const [ta, a] = keys[i];
  const [tb, b] = keys[Math.min(i + 1, keys.length - 1)];
  const f = tb > ta ? smooth(clamp((t - ta) / (tb - ta), 0, 1)) : 0;
  for (const n of JN) {
    const va = a[n] ?? base[n] ?? Z3;
    const vb = b[n] ?? base[n] ?? Z3;
    out[n] = [lerp(va[0], vb[0], f), lerp(va[1], vb[1], f), lerp(va[2], vb[2], f)];
  }
  out.rootRx = lerp(a.rootRx ?? base.rootRx ?? 0, b.rootRx ?? base.rootRx ?? 0, f);
  out.hipY = lerp(a.hipY ?? base.hipY ?? 0, b.hipY ?? base.hipY ?? 0, f);
  out.rootZ = lerp(a.rootZ ?? base.rootZ ?? 0, b.rootZ ?? base.rootZ ?? 0, f);
}

const Z3: V3 = [0, 0, 0];

/**
 * Blends a procedural locomotion layer (idle / walk / run, optionally in a
 * fighting guard) with one-shot action clips. Joints an action doesn't key
 * keep following the legs, so you can punch while walking.
 */
export class Animator {
  phase = Math.random() * 10;
  speed = 0; // m/s, set by the owner
  guard = 0; // 0 = relaxed, 1 = fists up
  private guardTarget = 0;
  private clip: Clip | null = null;
  private clipName = '';
  private t = 0;
  private weight = 0;
  private time = Math.random() * 10;
  private loco: Pose = {};
  private act: Pose = {};
  /** Called when a foot hits the ground — for footstep sounds. */
  onStep: (() => void) | null = null;

  constructor(private rig: HumanRig) {}

  play(name: string) {
    this.clip = CLIPS[name];
    this.clipName = name;
    this.t = 0;
    this.fading = false;
    this.weight = name === 'hit' || name === 'fall' || name === 'blockHit' ? 1 : Math.max(this.weight, 0.35);
  }

  /** Hold a looping or final pose (e.g. lying on the ground). */
  get current() {
    return this.clip ? this.clipName : '';
  }
  get clipTime() {
    return this.t;
  }

  stop() {
    this.clip = null;
    this.fading = false;
  }

  /** Fade the current clip out (used to drop a held pose such as block). */
  release() {
    if (this.clip) this.fading = true;
  }
  private fading = false;

  setGuard(on: boolean) {
    this.guardTarget = on ? 1 : 0;
  }

  update(dt: number) {
    this.time += dt;
    this.guard += (this.guardTarget - this.guard) * Math.min(1, dt * 8);
    const sp = this.speed;
    const run = clamp((sp - 2.2) / 3, 0, 1);
    const stride = lerp(1.25, 2.1, run);
    const prevPhase = this.phase;
    this.phase += (sp / stride) * Math.PI * dt;
    if (this.onStep && Math.floor(prevPhase / Math.PI) !== Math.floor(this.phase / Math.PI) && sp > 0.3) this.onStep();
    const move = clamp(sp / 1.4, 0, 1);
    const s = Math.sin(this.phase);
    const c = Math.cos(this.phase);
    const amp = lerp(0.5, 0.95, run) * move;
    const breathe = Math.sin(this.time * 2) * 0.02;
    const g = this.guard * (1 - run * 0.7);
    const L = this.loco;
    // Relaxed locomotion
    const lk = Math.max(0, -Math.sin(this.phase - 0.9)) * lerp(0.9, 1.6, run) * move;
    const rk = Math.max(0, Math.sin(this.phase - 0.9)) * lerp(0.9, 1.6, run) * move;
    L.thighL = [-s * amp, 0, 0.02];
    L.thighR = [s * amp, 0, -0.02];
    L.kneeL = [lk + 0.05, 0, 0];
    L.kneeR = [rk + 0.05, 0, 0];
    L.footL = [s * 0.2 * move, 0, 0];
    L.footR = [-s * 0.2 * move, 0, 0];
    const armAmp = lerp(0.45, 1.0, run) * move;
    L.armL = [s * armAmp, 0, 0.08];
    L.armR = [-s * armAmp, 0, -0.08];
    L.elbowL = [-0.15 - run * 1.2 - Math.max(0, s) * 0.3 * move, 0, 0];
    L.elbowR = [-0.15 - run * 1.2 - Math.max(0, -s) * 0.3 * move, 0, 0];
    L.handL = [0, 0, 0];
    L.handR = [0, 0, 0];
    L.spine = [0.03 + run * 0.18 + breathe, 0, 0];
    L.chest = [breathe, s * 0.12 * move, 0];
    L.neck = [0, 0, 0];
    L.head = [-run * 0.1, -s * 0.06 * move, 0];
    L.hips = [0, -s * 0.12 * move, c * 0.03 * move];
    L.hipY = -Math.abs(c) * 0.04 * move - run * 0.04;
    L.rootRx = 0;
    L.rootZ = 0;
    if (g > 0.001) {
      for (const n of JN) {
        const gv = GUARD[n];
        if (!gv) continue;
        const lv = L[n]!;
        // Legs keep stepping when moving, so blend guard legs only when idle.
        const isLeg = n.startsWith('thigh') || n.startsWith('knee') || n.startsWith('foot');
        const k = isLeg ? g * (1 - move) : g;
        L[n] = [lerp(lv[0], gv[0] + (isLeg ? 0 : lv[0] * 0.15), k), lerp(lv[1], gv[1], k), lerp(lv[2], gv[2], k)];
      }
      L.hipY = lerp(L.hipY!, (GUARD.hipY ?? 0) + L.hipY!, g);
      // Small bounce in stance
      L.hipY! += Math.sin(this.time * 6) * 0.012 * g * (1 - move);
    }

    let pose = L;
    if (this.clip) {
      this.t += dt;
      const end = (this.t >= this.clip.dur && !this.clip.loop) || this.fading;
      if (end && this.clipName !== 'fall') {
        this.weight -= dt * 10;
        if (this.weight <= 0) {
          this.clip = null;
          this.fading = false;
          this.weight = 0;
        }
      } else {
        this.weight = Math.min(1, this.weight + dt * 14);
      }
      if (this.clip) {
        samplePose(this.clip, Math.min(this.t, this.clip.dur), L, this.act);
        const w = this.weight;
        for (const n of JN) {
          const a = this.act[n]!;
          const b = L[n] ?? Z3;
          this.act[n] = [lerp(b[0], a[0], w), lerp(b[1], a[1], w), lerp(b[2], a[2], w)];
        }
        this.act.hipY = lerp(L.hipY ?? 0, this.act.hipY ?? 0, w);
        this.act.rootRx = lerp(0, this.act.rootRx ?? 0, w);
        this.act.rootZ = lerp(0, this.act.rootZ ?? 0, w);
        pose = this.act;
      }
    }
    this.apply(pose);
  }

  private apply(p: Pose) {
    const J = this.rig.joints;
    for (const n of JN) {
      const v = p[n];
      if (v) J[n].rotation.set(v[0], v[1], v[2]);
      else J[n].rotation.set(0, 0, 0);
    }
    J.hips.position.y = this.rig.hipsBaseY + (p.hipY ?? 0);
    this.rig.pivot.rotation.x = p.rootRx ?? 0;
    this.rig.pivot.position.z = p.rootZ ?? 0;
  }
}
