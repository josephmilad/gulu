import * as THREE from 'three';
import type { BoxGrid } from './collision';
import { clamp, damp, dampAngle } from './math';

/** GTA-style orbit camera: mouse/stick orbits, auto-recentres behind a moving target, avoids walls. */
export class FollowCamera {
  yaw = Math.PI;
  pitch = 0.32;
  dist = 5.2;
  private curDist = 5.2;
  private target = new THREE.Vector3();
  private idle = 0;
  shake = 0;

  constructor(public cam: THREE.PerspectiveCamera, private grid: BoxGrid | null) {}

  /** The direction "forward" for movement input, in world XZ. */
  get forward() {
    return { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
  }

  snap(x: number, z: number, heading: number) {
    this.target.set(x, 1.5, z);
    this.yaw = heading + Math.PI;
    this.curDist = this.dist;
  }

  update(dt: number, x: number, z: number, heading: number, moving: boolean, lookX: number, lookY: number, combat: boolean) {
    this.target.x = damp(this.target.x, x, 12, dt);
    this.target.z = damp(this.target.z, z, 12, dt);
    this.target.y = 1.55;
    if (Math.abs(lookX) + Math.abs(lookY) > 1e-4) this.idle = 0;
    else this.idle += dt;
    this.yaw += lookX;
    this.pitch = clamp(this.pitch - lookY, -0.25, 1.2);
    // Swing in behind the player after a moment without manual camera input.
    if (moving && !combat && this.idle > 1.2) this.yaw = dampAngle(this.yaw, heading + Math.PI, 1.6, dt);
    const want = combat ? this.dist + 0.8 : this.dist;
    const cx = Math.sin(this.yaw) * Math.cos(this.pitch);
    const cy = Math.sin(this.pitch);
    const cz = Math.cos(this.yaw) * Math.cos(this.pitch);
    let d = want;
    if (this.grid) {
      const t = this.grid.segmentHit(this.target.x, this.target.y, this.target.z, this.target.x + cx * want, this.target.y + cy * want, this.target.z + cz * want);
      d = Math.max(0.8, want * t - 0.3);
    }
    this.curDist = d < this.curDist ? d : damp(this.curDist, d, 4, dt);
    const p = this.cam.position;
    p.set(this.target.x + cx * this.curDist, Math.max(0.4, this.target.y + cy * this.curDist), this.target.z + cz * this.curDist);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      p.x += (Math.random() - 0.5) * this.shake * 0.25;
      p.y += (Math.random() - 0.5) * this.shake * 0.25;
    }
    this.cam.lookAt(this.target.x, this.target.y + 0.15, this.target.z);
  }
}
