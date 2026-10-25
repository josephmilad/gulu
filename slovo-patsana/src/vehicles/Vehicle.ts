import * as THREE from 'three';
import { buildCar, brakeMat, type CarKind, type CarVisual } from './CarModel';
import { clamp } from '../core/math';
import type { BoxGrid } from '../core/collision';

/**
 * Arcade car dynamics with a real velocity vector and tyre grip, so the
 * handbrake makes it slide. Adapted from depixeled-chris/gta7 (MIT,
 * src/vehicles/VehicleModel.ts) to this game's axes: heading 0 faces +Z and
 * a positive steer turns left (toward +X).
 */
export interface DriveInput {
  throttle: number; // -1..1
  steer: number; // -1..1, + = left
  handbrake: boolean;
}

interface Tuning {
  engine: number;
  brake: number;
  maxSpeed: number;
  reverseMax: number;
  drag: number;
  rolling: number;
  turnRate: number;
  gripSpeed: number;
  grip: number;
  gripHandbrake: number;
  mass: number;
}

const TUNING: Record<CarKind, Tuning> = {
  zhiguli: { engine: 7.5, brake: 16, maxSpeed: 40, reverseMax: 8, drag: 0.08, rolling: 1.6, turnRate: 2.2, gripSpeed: 6, grip: 5.5, gripHandbrake: 0.7, mass: 1 },
  volga: { engine: 7, brake: 15, maxSpeed: 42, reverseMax: 8, drag: 0.07, rolling: 1.6, turnRate: 1.9, gripSpeed: 7, grip: 5, gripHandbrake: 0.7, mass: 1.3 },
  taxi: { engine: 7, brake: 15, maxSpeed: 42, reverseMax: 8, drag: 0.07, rolling: 1.6, turnRate: 1.9, gripSpeed: 7, grip: 5, gripHandbrake: 0.7, mass: 1.3 },
  police: { engine: 8, brake: 16, maxSpeed: 44, reverseMax: 8, drag: 0.08, rolling: 1.6, turnRate: 2.25, gripSpeed: 6, grip: 5.8, gripHandbrake: 0.7, mass: 1 },
  uaz: { engine: 7.8, brake: 15, maxSpeed: 36, reverseMax: 8, drag: 0.09, rolling: 1.8, turnRate: 2.0, gripSpeed: 6, grip: 6, gripHandbrake: 1, mass: 1.6 },
};

/** Snow is slippery: grip is scaled down everywhere. */
const SNOW_GRIP = 0.75;

export interface CarArena {
  grid: BoxGrid | null;
  vehicles: Vehicle[];
  onCarHit(v: Vehicle, speed: number, what: 'wall' | 'car', other?: Vehicle): void;
}

let ids = 0;

export class Vehicle {
  id = ++ids;
  vis: CarVisual;
  kind: CarKind;
  x = 0;
  z = 0;
  heading = 0;
  vx = 0;
  vz = 0;
  health = 100;
  input: DriveInput = { throttle: 0, steer: 0, handbrake: false };
  /** Who sits in the driver's seat (a Fighter, kept loose to avoid a cycle). */
  driver: unknown = null;
  passengers: unknown[] = [];
  wheelSpin = 0;
  siren = false;
  data: Record<string, unknown> = {};
  private tune: Tuning;
  private steerVis = 0;
  private sirenT = 0;
  readonly halfLen: number;
  readonly halfWid: number;

  constructor(kind: CarKind, color?: number, opts: { snow?: boolean } = {}) {
    this.kind = kind;
    this.vis = buildCar(kind, color, opts);
    this.tune = TUNING[kind];
    this.halfLen = this.vis.spec.length / 2;
    this.halfWid = this.vis.spec.width / 2;
    this.vis.brake.forEach((b) => (b.userData.base = (b.material as THREE.MeshStandardMaterial).clone()));
  }

  get root() {
    return this.vis.root;
  }
  get speed() {
    return Math.hypot(this.vx, this.vz);
  }
  get fwdX() {
    return Math.sin(this.heading);
  }
  get fwdZ() {
    return Math.cos(this.heading);
  }
  /** Signed speed along the nose (negative when reversing). */
  get forwardSpeed() {
    return this.vx * this.fwdX + this.vz * this.fwdZ;
  }
  get wrecked() {
    return this.health <= 0;
  }

  place(x: number, z: number, heading: number) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.vx = this.vz = 0;
    this.sync();
  }

  /** Where the driver gets in/out (left side, Soviet cars are left-hand drive). */
  doorPos() {
    const lx = Math.cos(this.heading), lz = -Math.sin(this.heading);
    return { x: this.x + lx * (this.halfWid + 0.7) + this.fwdX * 0.3, z: this.z + lz * (this.halfWid + 0.7) + this.fwdZ * 0.3 };
  }

  update(dt: number, arena: CarArena) {
    const t = this.tune;
    const inp = this.wrecked ? { throttle: 0, steer: 0, handbrake: true } : this.input;
    const throttle = clamp(inp.throttle, -1, 1);
    const steer = clamp(inp.steer, -1, 1);
    let { vx, vz } = this;
    const fx = this.fwdX, fz = this.fwdZ;
    const vF = vx * fx + vz * fz;
    if (throttle !== 0) {
      const opposing = (vF > 0.1 && throttle < 0) || (vF < -0.1 && throttle > 0);
      const a = opposing ? t.brake : t.engine * (1 - clamp(Math.abs(vF) / t.maxSpeed, 0, 1) * 0.6);
      vx += fx * throttle * a * dt;
      vz += fz * throttle * a * dt;
    }
    const sp = Math.hypot(vx, vz);
    if (sp > 1e-4) {
      const decel = (t.rolling + (inp.handbrake ? 5 : 0)) * dt;
      const k = Math.max(0, 1 - decel / sp);
      vx *= k;
      vz *= k;
    }
    vx -= vx * t.drag * dt;
    vz -= vz * t.drag * dt;
    const authority = clamp(Math.hypot(vx, vz) / t.gripSpeed, 0, 1);
    const dir = vF < -0.1 && !inp.handbrake ? -1 : 1;
    this.heading += steer * t.turnRate * authority * dir * (inp.handbrake ? 1.35 : 1) * dt;
    // Re-split velocity on the new heading and bleed off the sideways part.
    const nfx = Math.sin(this.heading), nfz = Math.cos(this.heading);
    const nlx = Math.cos(this.heading), nlz = -Math.sin(this.heading);
    let fwd = vx * nfx + vz * nfz;
    let lat = vx * nlx + vz * nlz;
    const grip = (inp.handbrake ? t.gripHandbrake : t.grip) * SNOW_GRIP;
    lat *= Math.exp(-grip * dt);
    fwd = clamp(fwd, -t.reverseMax, t.maxSpeed);
    this.vx = nfx * fwd + nlx * lat;
    this.vz = nfz * fwd + nlz * lat;
    this.x += this.vx * dt;
    this.z += this.vz * dt;
    this.collide(arena);
    this.wheelSpin += (fwd / this.vis.spec.wheelR) * dt;
    this.steerVis += (steer * 0.5 - this.steerVis) * Math.min(1, dt * 10);
    this.sirenT += dt;
    this.sync();
    // Brake lights
    const braking = (vF > 0.5 && throttle < 0) || inp.handbrake || (this.driver && Math.abs(throttle) < 0.05 && sp < 1);
    for (const b of this.vis.brake) b.material = braking ? brakeMat : (b.userData.base as THREE.Material);
    if (this.vis.beacons.length) {
      const on = this.siren && Math.floor(this.sirenT * 6) % 2 === 0;
      (this.vis.beacons[0].material as THREE.MeshStandardMaterial).emissiveIntensity = this.siren ? (on ? 6 : 0) : 0;
      (this.vis.beacons[1].material as THREE.MeshStandardMaterial).emissiveIntensity = this.siren ? (on ? 0 : 6) : 0;
    }
  }

  /** The car is three circles along its length for collisions. */
  circles(): [number, number, number][] {
    const r = this.halfWid;
    const off = this.halfLen - r;
    return [-off, 0, off].map((o) => [this.x + this.fwdX * o, this.z + this.fwdZ * o, r]);
  }

  private collide(arena: CarArena) {
    const g = arena.grid;
    if (g) {
      let hit = false;
      for (let pass = 0; pass < 2; pass++)
        for (const [cx, cz, r] of this.circles()) {
          const [nx, nz] = g.resolveCircle(cx, cz, r);
          if (nx !== cx || nz !== cz) {
            this.x += nx - cx;
            this.z += nz - cz;
            hit = true;
            // Remove the velocity component going into the wall.
            const px = nx - cx, pz = nz - cz;
            const pl = Math.hypot(px, pz) || 1;
            const n = [px / pl, pz / pl];
            const into = this.vx * n[0] + this.vz * n[1];
            if (into < 0) {
              if (pass === 0) arena.onCarHit(this, -into, 'wall');
              this.vx -= n[0] * into * 1.3;
              this.vz -= n[1] * into * 1.3;
              this.health -= Math.max(0, -into - 6) * 2.5;
            }
          }
        }
      void hit;
    }
    for (const o of arena.vehicles) {
      if (o === this || o.id < this.id) continue;
      for (const [ax, az, ar] of this.circles())
        for (const [bx, bz, br] of o.circles()) {
          const dx = ax - bx, dz = az - bz;
          const d = Math.hypot(dx, dz);
          const rr = ar + br;
          if (d >= rr || d < 1e-4) continue;
          const nx = dx / d, nz = dz / d;
          const pen = rr - d;
          const ma = this.tune.mass, mb = o.tune.mass;
          this.x += nx * pen * (mb / (ma + mb));
          this.z += nz * pen * (mb / (ma + mb));
          o.x -= nx * pen * (ma / (ma + mb));
          o.z -= nz * pen * (ma / (ma + mb));
          const rel = (this.vx - o.vx) * nx + (this.vz - o.vz) * nz;
          if (rel < 0) {
            const j = (-(1 + 0.3) * rel) / (1 / ma + 1 / mb);
            this.vx += (j / ma) * nx;
            this.vz += (j / ma) * nz;
            o.vx -= (j / mb) * nx;
            o.vz -= (j / mb) * nz;
            const dmg = Math.max(0, -rel - 5) * 2;
            this.health -= dmg;
            o.health -= dmg;
            arena.onCarHit(this, -rel, 'car', o);
          }
        }
    }
  }

  sync() {
    const r = this.vis.root;
    r.position.set(this.x, 0, this.z);
    r.rotation.y = this.heading;
    // Body roll from sideways slip, for a bit of weight.
    const lat = this.vx * Math.cos(this.heading) - this.vz * Math.sin(this.heading);
    const body = r.children[0];
    body.rotation.z = clamp(-lat * 0.012, -0.06, 0.06);
    for (const w of this.vis.wheels) w.rotation.x = this.wheelSpin;
    for (const s of this.vis.steer) s.rotation.y = this.steerVis * 0.8;
  }
}
