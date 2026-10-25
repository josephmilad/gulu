/**
 * Ground-plane collision: buildings and props are axis-aligned boxes, actors
 * are circles. Circle-vs-AABB push-out and the segment slab test are adapted
 * from depixeled-chris/gta7 (MIT, src/systems/Collision.ts).
 */
export interface Box {
  minX: number;
  minZ: number;
  maxX: number;
  maxZ: number;
  /** Height of the obstacle, used by the camera to avoid clipping into it. */
  h: number;
}

export function pushOutOfBox(cx: number, cz: number, r: number, b: Box): [number, number] {
  const qx = Math.max(b.minX, Math.min(cx, b.maxX));
  const qz = Math.max(b.minZ, Math.min(cz, b.maxZ));
  const dx = cx - qx;
  const dz = cz - qz;
  const d2 = dx * dx + dz * dz;
  if (d2 > r * r) return [cx, cz];
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2);
    const p = r - d;
    return [cx + (dx / d) * p, cz + (dz / d) * p];
  }
  const l = cx - b.minX, rr = b.maxX - cx, t = cz - b.minZ, bt = b.maxZ - cz;
  const m = Math.min(l, rr, t, bt);
  if (m === l) return [b.minX - r, cz];
  if (m === rr) return [b.maxX + r, cz];
  if (m === t) return [cx, b.minZ - r];
  return [cx, b.maxZ + r];
}

/** Uniform grid over boxes so each query only touches nearby obstacles. */
export class BoxGrid {
  private cells = new Map<number, Box[]>();
  constructor(private cell = 24) {}

  private key(ix: number, iz: number) {
    return (ix + 512) * 4096 + (iz + 512);
  }

  add(b: Box) {
    const c = this.cell;
    for (let ix = Math.floor(b.minX / c); ix <= Math.floor(b.maxX / c); ix++)
      for (let iz = Math.floor(b.minZ / c); iz <= Math.floor(b.maxZ / c); iz++) {
        const k = this.key(ix, iz);
        let list = this.cells.get(k);
        if (!list) this.cells.set(k, (list = []));
        list.push(b);
      }
  }

  query(minX: number, minZ: number, maxX: number, maxZ: number, out: Set<Box>) {
    out.clear();
    const c = this.cell;
    for (let ix = Math.floor(minX / c); ix <= Math.floor(maxX / c); ix++)
      for (let iz = Math.floor(minZ / c); iz <= Math.floor(maxZ / c); iz++) {
        const list = this.cells.get(this.key(ix, iz));
        if (list) for (const b of list) out.add(b);
      }
    return out;
  }

  private tmp = new Set<Box>();

  resolveCircle(x: number, z: number, r: number): [number, number] {
    const set = this.query(x - r, z - r, x + r, z + r, this.tmp);
    for (const b of set) [x, z] = pushOutOfBox(x, z, r, b);
    return [x, z];
  }

  /**
   * Fraction t in [0,1] along the 3D segment A→B where it first enters a box
   * (boxes span y = 0..h). Returns 1 when clear. Used to pull the camera in.
   */
  segmentHit(ax: number, ay: number, az: number, bx: number, by: number, bz: number): number {
    const set = this.query(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), this.tmp);
    let best = 1;
    const d = [bx - ax, by - ay, bz - az];
    const o = [ax, ay, az];
    for (const b of set) {
      const lo = [b.minX, 0, b.minZ];
      const hi = [b.maxX, b.h, b.maxZ];
      let t0 = 0, t1 = 1, ok = true;
      for (let i = 0; i < 3 && ok; i++) {
        if (Math.abs(d[i]) < 1e-9) {
          if (o[i] < lo[i] || o[i] > hi[i]) ok = false;
        } else {
          let ta = (lo[i] - o[i]) / d[i];
          let tb = (hi[i] - o[i]) / d[i];
          if (ta > tb) [ta, tb] = [tb, ta];
          t0 = Math.max(t0, ta);
          t1 = Math.min(t1, tb);
          if (t0 > t1) ok = false;
        }
      }
      if (ok && t0 < best) best = t0;
    }
    return best;
  }
}
