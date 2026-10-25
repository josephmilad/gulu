import { HALF, N, PITCH } from '../world/City';
import { clamp, wrapAngle } from '../core/math';
import type { Vehicle } from './Vehicle';
import type { BoxGrid } from '../core/collision';

/** Road centre lines sit on x or z = -HALF + k * PITCH, for k = 0..N. */
export const roadC = (k: number) => -HALF + k * PITCH;
const LANE = 1.7;

export interface Obstacle {
  x: number;
  z: number;
}

/**
 * Drives a car around the road grid: right-hand lanes, a random turn at each
 * crossing, slows for anything in front. In chase mode it picks turns that
 * close the distance to a target and goes straight for it once in sight.
 */
export class CarDriver {
  dir: [number, number];
  node: [number, number]; // next intersection (ix, iz)
  private chosen = false;
  private stuck = 0;
  private reverseT = 0;
  private blockedT = 0;
  private ignoreT = 0;
  /** Set when this car honks; the owner plays the sound. */
  honk = false;
  cruise = 8 + Math.random() * 3;
  chase: Obstacle | null = null;
  /** Set by the owner when this car should stop (e.g. officers getting out). */
  hold = false;

  constructor(dir: [number, number], node: [number, number]) {
    this.dir = dir;
    this.node = node;
  }

  /** Place a car on a random road segment around a point. */
  static spawnAround(cx: number, cz: number, minD: number, maxD: number, rnd = Math.random) {
    for (let tries = 0; tries < 30; tries++) {
      const vertical = rnd() < 0.5;
      const k = Math.floor(rnd() * (N + 1));
      const along = -HALF + 10 + rnd() * (HALF * 2 - 20);
      const sign = rnd() < 0.5 ? 1 : -1;
      const dir: [number, number] = vertical ? [0, sign] : [sign, 0];
      const right = [-dir[1], dir[0]];
      const x = (vertical ? roadC(k) : along) + right[0] * LANE;
      const z = (vertical ? along : roadC(k)) + right[1] * LANE;
      const d = Math.hypot(x - cx, z - cz);
      if (d < minD || d > maxD) continue;
      // Avoid spawning in the middle of a crossing.
      const t = ((along + HALF) % PITCH + PITCH) % PITCH;
      if (t < 12 || t > PITCH - 12) continue;
      const nextIdx = Math.floor((along + HALF) / PITCH) + (sign > 0 ? 1 : 0);
      if (nextIdx < 0 || nextIdx > N) continue;
      const node: [number, number] = vertical ? [k, nextIdx] : [nextIdx, k];
      return { x, z, heading: Math.atan2(dir[0], dir[1]), driver: new CarDriver(dir, node) };
    }
    return null;
  }

  private nodePos() {
    return { x: roadC(this.node[0]), z: roadC(this.node[1]) };
  }

  private pickTurn(rnd = Math.random) {
    const [dx, dz] = this.dir;
    const opts: [number, number][] = [[dx, dz], [-dz, dx], [dz, -dx]];
    const valid = opts.filter(([ox, oz]) => {
      const nx = this.node[0] + ox, nz = this.node[1] + oz;
      return nx >= 0 && nx <= N && nz >= 0 && nz <= N;
    });
    if (!valid.length) return [-dx, -dz] as [number, number];
    if (this.chase) {
      const p = this.nodePos();
      let best = valid[0], bd = 1e9;
      for (const o of valid) {
        const d = Math.hypot(p.x + o[0] * PITCH - this.chase.x, p.z + o[1] * PITCH - this.chase.z);
        if (d < bd) [bd, best] = [d, o];
      }
      return best;
    }
    // Mostly straight on, sometimes turn.
    if (valid.length > 1 && rnd() < 0.55 && valid.some((v) => v[0] === dx && v[1] === dz)) return [dx, dz] as [number, number];
    return valid[Math.floor(rnd() * valid.length)];
  }

  update(v: Vehicle, dt: number, obstacles: Obstacle[], grid: BoxGrid | null) {
    const inp = v.input;
    if (this.hold) {
      inp.throttle = v.forwardSpeed > 0.3 ? -1 : 0;
      inp.steer = 0;
      inp.handbrake = v.speed < 0.5;
      return;
    }
    const np = this.nodePos();
    const [dx, dz] = this.dir;
    const distNode = Math.hypot(np.x - v.x, np.z - v.z);
    if (distNode < 9 && !this.chosen) {
      this.chosen = true;
      this.dir = this.pickTurn();
    }
    // Once past the crossing, aim for the next one.
    const ahead = (v.x - np.x) * this.dir[0] + (v.z - np.z) * this.dir[1];
    if (this.chosen && ahead > 4) {
      this.node = [this.node[0] + this.dir[0], this.node[1] + this.dir[1]];
      this.chosen = false;
    }
    const [ex, ez] = this.dir;
    const rx = -ez, rz = ex;
    const lx = np.x + rx * LANE, lz = np.z + rz * LANE;
    const t = (v.x - lx) * ex + (v.z - lz) * ez;
    let tx = lx + ex * (t + 7), tz = lz + ez * (t + 7);
    let target = this.cruise;
    if (distNode < 16 && (ex !== dx || ez !== dz)) target = 5;

    // Pursuit: once the target is close and visible, drive straight at it.
    if (this.chase) {
      target = 15;
      const d = Math.hypot(this.chase.x - v.x, this.chase.z - v.z);
      const clear = !grid || grid.segmentHit(v.x, 1, v.z, this.chase.x, 1, this.chase.z) >= 1;
      if (d < 35 && clear) {
        tx = this.chase.x;
        tz = this.chase.z;
        target = d < 8 ? 4 : 13;
      }
    }

    const want = Math.atan2(tx - v.x, tz - v.z);
    const err = wrapAngle(want - v.heading);
    let steer = clamp(err * 2.4, -1, 1);

    // Brake for anything in front — but give up waiting after a few seconds,
    // so two cars nose to nose at a crossing don't stand there forever.
    this.honk = false;
    this.ignoreT -= dt;
    if (!this.chase && this.ignoreT <= 0) {
      const before = target;
      for (const o of obstacles) {
        const ox = o.x - v.x, oz = o.z - v.z;
        const d = Math.hypot(ox, oz);
        if (d < 1 || d > 13) continue;
        const along = (ox * v.fwdX + oz * v.fwdZ);
        const side = Math.abs(ox * Math.cos(v.heading) - oz * Math.sin(v.heading));
        if (along > 0 && side < 1.5) target = Math.min(target, Math.max(0, (d - 5) * 0.8));
      }
      if (target < 1 && before > 1) {
        this.blockedT += dt;
        if (this.blockedT > 3) {
          this.blockedT = 0;
          this.ignoreT = 2;
          this.honk = true;
        }
      } else this.blockedT = 0;
    }

    // Unstick: back up if we're pushing against something.
    if (inp.throttle > 0.3 && v.speed < 0.6) this.stuck += dt;
    else this.stuck = Math.max(0, this.stuck - dt);
    if (this.stuck > 1.6) {
      this.reverseT = 1.3;
      this.stuck = 0;
    }
    if (this.reverseT > 0) {
      this.reverseT -= dt;
      inp.throttle = -0.8;
      inp.steer = -steer;
      inp.handbrake = false;
      return;
    }
    const fs = v.forwardSpeed;
    inp.throttle = clamp((target - fs) * 0.45, -1, 1);
    if (target < 0.5 && fs < 0.5) inp.throttle = 0;
    inp.handbrake = target < 0.5 && fs < 1;
    inp.steer = steer;
  }
}
