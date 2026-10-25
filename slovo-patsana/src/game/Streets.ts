import * as THREE from 'three';
import { Vehicle, type CarArena } from '../vehicles/Vehicle';
import { CarDriver, roadC } from '../vehicles/Traffic';
import type { CarKind } from '../vehicles/CarModel';
import type { Fighter } from '../actors/Fighter';
import { Brain } from '../actors/ai';
import { BARKS, POLICE_NAMES, policeSpec } from '../actors/looks';
import { makeBody } from '../actors/SkinnedBody';
import { Fighter as FighterClass } from '../actors/Fighter';
import type { Intent } from '../core/input';
import { clamp, pick } from '../core/math';
import { sfx } from '../audio/sfx';
import { HALF, N, PITCH, ROAD } from '../world/City';
import type { FreeRoamMode } from './FreeRoamMode';

const TRAFFIC = 9;
const PARK_OFFSET = 3.6;

interface Spot {
  x: number;
  z: number;
  heading: number;
  car: Vehicle | null;
  kind: CarKind | null;
}

interface Unit {
  car: Vehicle;
  officers: Fighter[];
  deployed: boolean;
}

/**
 * Everything with wheels: parked cars you can take, traffic that drives the
 * grid, and the militsiya who come after you when your wanted level rises.
 */
export class Streets implements CarArena {
  vehicles: Vehicle[] = [];
  playerCar: Vehicle | null = null;
  wanted = 0;
  private unseen = 0;
  private units: Unit[] = [];
  private spots: Spot[] = [];
  private layer = new THREE.Group();
  private headlight: THREE.SpotLight;
  private popT = 0;
  private lastCrash = 0;

  constructor(private m: FreeRoamMode) {
    m.scene.add(this.layer);
    // Kerbside parking along every road segment.
    const r = Math.random;
    for (let k = 0; k <= N; k++)
      for (let seg = 0; seg < N; seg++)
        for (const side of [-1, 1])
          for (let n = 0; n < 2; n++) {
            if (r() < 0.45) continue;
            const along = -HALF + seg * PITCH + ROAD / 2 + 10 + n * 26 + r() * 10;
            const vertical = r() < 0.5;
            const off = roadC(k) + side * PARK_OFFSET;
            this.spots.push({
              x: vertical ? off : along,
              z: vertical ? along : off,
              heading: vertical ? (side > 0 ? Math.PI : 0) : side > 0 ? Math.PI / 2 : -Math.PI / 2,
              car: null,
              kind: r() < 0.65 ? 'zhiguli' : 'volga',
            });
          }
    this.headlight = new THREE.SpotLight(0xfff0d0, 0, 45, 0.55, 0.5, 1.2);
    this.layer.add(this.headlight, this.headlight.target);
  }

  get grid() {
    return this.m.grid;
  }

  private add(v: Vehicle) {
    this.vehicles.push(v);
    this.layer.add(v.root);
  }

  private remove(v: Vehicle) {
    this.vehicles.splice(this.vehicles.indexOf(v), 1);
    this.layer.remove(v.root);
    for (const s of this.spots) if (s.car === v) s.car = null;
  }

  onCarHit(v: Vehicle, speed: number, what: 'wall' | 'car', other?: Vehicle) {
    if (speed < 3 || this.m.time - this.lastCrash < 0.15) return;
    this.lastCrash = this.m.time;
    const p = this.m.players[0];
    sfx.crash(speed / 14, Math.hypot(v.x - p.x, v.z - p.z));
    if (v === this.playerCar || other === this.playerCar) {
      this.m.shake(Math.min(1.2, speed / 12));
      if (other && other.data.police) this.addWanted(1, 'Ты протаранил милицию!');
    }
    void what;
  }

  addWanted(n: number, why?: string) {
    const before = this.wanted;
    this.wanted = clamp(this.wanted + n, 0, 3);
    this.unseen = 0;
    if (this.wanted > before && why) this.m.hud.toast(why);
  }

  clearWanted() {
    this.wanted = 0;
    for (const u of this.units) this.dismiss(u);
  }

  // ---------- Entering / leaving ----------
  /** The car whose door the player is standing at, if any. */
  private nearDoor(p: Fighter) {
    let best: Vehicle | null = null, bd = 2.4;
    for (const v of this.vehicles) {
      if (v.wrecked) continue;
      const d = v.doorPos();
      const dist = Math.hypot(d.x - p.x, d.z - p.z);
      if (dist < bd && v.speed < 3) [bd, best] = [dist, v];
    }
    return best;
  }

  private enter(p: Fighter, v: Vehicle) {
    if (v.driver && v.driver !== p) {
      // Pull the driver out.
      const d = v.doorPos();
      if (v.data.police) {
        const u = this.units.find((x) => x.car === v);
        if (u && !u.deployed) this.deploy(u);
        this.addWanted(2, 'Угон милицейской машины!');
      } else {
        const f = this.m.spawnNpc('civil', 'ped', d.x, d.z, { x: d.x, z: d.z });
        f.takeImpact(v.x, v.z, 5, 3);
        (f.data.brain as Brain).flee(p, this.m, f);
        this.m.bark(f, pick(Math.random, ['Ты чё творишь?!', 'Машину отдай!', 'Милиция!']));
        this.addWanted(1, 'Угон машины');
      }
      v.data.driverAI = null;
    }
    v.driver = p;
    v.data.driverAI = null;
    v.data.keep = true;
    v.siren = false;
    this.playerCar = v;
    p.rig.root.visible = false;
    p.data.inCar = v;
    this.m.cam.car = true;
    sfx.engineSet(true, 0);
  }

  private exit(p: Fighter) {
    const v = this.playerCar!;
    const d = v.doorPos();
    const [x, z] = this.grid.resolveCircle(d.x, d.z, 0.4);
    p.place(x, z, v.heading);
    p.rig.root.visible = true;
    p.data.inCar = null;
    v.driver = null;
    v.input = { throttle: 0, steer: 0, handbrake: true };
    this.playerCar = null;
    this.m.cam.car = false;
    sfx.engineSet(false);
  }

  // ---------- Militsiya ----------
  private spawnUnit() {
    const p = this.m.players[0];
    const s = CarDriver.spawnAround(p.x, p.z, 70, 130);
    if (!s) return;
    const v = new Vehicle('uaz');
    v.place(s.x, s.z, s.heading);
    v.data.police = true;
    v.siren = true;
    s.driver.chase = p;
    v.data.driverAI = s.driver;
    v.driver = 'npc';
    this.add(v);
    this.units.push({ car: v, officers: [], deployed: false });
  }

  private deploy(u: Unit) {
    u.deployed = true;
    (u.car.data.driverAI as CarDriver | null)?.hold && null;
    const ai = u.car.data.driverAI as CarDriver | null;
    if (ai) ai.hold = true;
    for (let i = 0; i < 2; i++) {
      const side = i === 0 ? 1 : -1;
      const lx = Math.cos(u.car.heading) * side, lz = -Math.sin(u.car.heading) * side;
      const x = u.car.x + lx * (u.car.halfWid + 0.8), z = u.car.z + lz * (u.car.halfWid + 0.8);
      const spec = policeSpec();
      const f = new FighterClass({
        body: makeBody(this.m.app.assets.charactersLod[spec.model], { tint: spec.tint, tintAmt: spec.tintAmt, scale: spec.scale }),
        hp: 80, power: 0.95, speed: 1.05, team: 'police', name: pick(Math.random, POLICE_NAMES),
      }, this.m);
      f.place(x, z, u.car.heading);
      f.data.brain = new Brain('police', { x: u.car.x, z: u.car.z }, 0.55);
      f.data.unit = u;
      this.m.addFighter(f);
      u.officers.push(f);
      if (i === 0) this.m.bark(f, pick(Math.random, BARKS.police));
    }
    u.car.driver = null;
  }

  private dismiss(u: Unit) {
    u.car.siren = false;
    const ai = u.car.data.driverAI as CarDriver | null;
    if (ai) {
      ai.chase = null;
      ai.hold = false;
    }
  }

  private updatePolice(dt: number) {
    const p = this.m.players[0];
    const target = this.playerCar ?? p;
    // Units come and go with the wanted level.
    const active = this.units.filter((u) => u.car.siren);
    if (this.wanted > active.length && this.units.length < 4) this.spawnUnit();
    let seen = false;
    for (const u of this.units) {
      const d = Math.hypot(u.car.x - target.x, u.car.z - target.z);
      const ai = u.car.data.driverAI as CarDriver | null;
      if (u.car.siren && ai) ai.chase = target;
      if (this.wanted > 0 && u.car.siren) {
        if (d < 45 && this.grid.segmentHit(u.car.x, 1.5, u.car.z, target.x, 1.5, target.z) >= 1) seen = true;
        if (!u.deployed && !this.playerCar && d < 14 && u.car.speed < 6) this.deploy(u);
      }
      // Officers go back to the car when the player drives off or it's over.
      if (u.deployed) {
        const alive = u.officers.filter((o) => o.alive && this.m.fighters.includes(o));
        for (const o of alive) {
          const od = Math.hypot(o.x - target.x, o.z - target.z);
          if (od < 35 && this.wanted > 0) seen = true;
          const b = o.data.brain as Brain;
          b.home = { x: u.car.x, z: u.car.z };
          if ((this.playerCar && od > 18) || this.wanted === 0) {
            b.target = null;
            b.mode = 'return';
          }
        }
        const back = alive.every((o) => Math.hypot(o.x - u.car.x, o.z - u.car.z) < 3 && (o.data.brain as Brain).mode !== 'fight');
        if (back && (this.playerCar || this.wanted === 0)) {
          for (const o of alive) this.m.removeFighter(o);
          u.officers = [];
          u.deployed = false;
          u.car.driver = 'npc';
          if (ai) ai.hold = false;
        }
      }
    }
    if (this.wanted > 0) {
      this.unseen = seen ? 0 : this.unseen + dt;
      if (this.unseen > 12 + this.wanted * 5) {
        this.wanted--;
        this.unseen = 0;
        this.m.hud.toast(this.wanted ? 'Милиция теряет след…' : 'Ушёл от милиции');
        if (this.wanted === 0) for (const u of this.units) this.dismiss(u);
      }
    }
    // Retire units that have given up and are far away.
    for (const u of [...this.units]) {
      const d = Math.hypot(u.car.x - p.x, u.car.z - p.z);
      if (!u.car.siren && !u.deployed && d > 120) {
        this.units.splice(this.units.indexOf(u), 1);
        if (u.car !== this.playerCar) this.remove(u.car);
      }
    }
  }

  // ---------- Population ----------
  private populate() {
    const p = this.m.players[0];
    const px = this.playerCar?.x ?? p.x, pz = this.playerCar?.z ?? p.z;
    for (const s of this.spots) {
      const d = Math.hypot(s.x - px, s.z - pz);
      if (!s.car && s.kind && d < 85 && d > 25) {
        const v = new Vehicle(s.kind, undefined, { snow: true });
        v.place(s.x, s.z, s.heading);
        s.car = v;
        this.add(v);
      } else if (s.car && d > 130 && !s.car.data.keep) {
        this.remove(s.car);
      }
    }
    // Cars that left their spot (stolen) or got far away are cleaned up.
    let traffic = 0;
    for (const v of [...this.vehicles]) {
      if (v === this.playerCar || v.data.police) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (v.data.driverAI) {
        if (d > 170) this.remove(v);
        else traffic++;
      } else if (v.data.keep && d > 160) this.remove(v);
    }
    if (traffic < TRAFFIC) {
      const s = CarDriver.spawnAround(px, pz, 55, 150);
      if (s) {
        const roll = Math.random();
        const v = new Vehicle(roll < 0.55 ? 'zhiguli' : roll < 0.85 ? 'volga' : 'taxi');
        v.place(s.x, s.z, s.heading);
        v.data.driverAI = s.driver;
        v.driver = 'npc';
        // Skip spawns overlapping another car.
        if (this.vehicles.some((o) => Math.hypot(o.x - v.x, o.z - v.z) < 7)) return;
        this.add(v);
      }
    }
  }

  // ---------- Frame ----------
  update(dt: number, it: Intent) {
    const p = this.m.players[0];
    // Enter / exit
    if (this.playerCar) {
      if (it.interact && this.playerCar.speed < 5) this.exit(p);
    } else if (p.alive && !p.grounded && p.state === 'free') {
      const v = this.nearDoor(p);
      this.m.hud.prompt(v ? (v.driver ? '<b>F</b> — выкинуть водителя и угнать' : '<b>F</b> — сесть в машину') : null);
      if (v && it.interact) this.enter(p, v);
    }
    if (this.playerCar) {
      const v = this.playerCar;
      v.input.throttle = it.moveY;
      v.input.steer = -it.moveX;
      v.input.handbrake = it.dodge || it.block;
      p.place(v.x, v.z, v.heading);
      this.m.hud.prompt(v.speed < 5 ? '<b>F</b> — выйти' : null);
      this.m.hud.setSpeed(Math.abs(v.forwardSpeed) * 3.6);
      sfx.engineSet(true, clamp(Math.abs(v.forwardSpeed) / 30 + Math.abs(v.input.throttle) * 0.15, 0, 1));
      this.headlight.intensity = 60;
      this.headlight.position.set(v.x + v.fwdX * 2.2, 0.9, v.z + v.fwdZ * 2.2);
      this.headlight.target.position.set(v.x + v.fwdX * 14, 0, v.z + v.fwdZ * 14);
    } else {
      this.m.hud.setSpeed(null);
      this.headlight.intensity = 0;
    }

    // AI drivers see cars, people and the player as obstacles.
    const obstacles: { x: number; z: number }[] = [];
    for (const f of this.m.fighters) if (f.alive && !f.data.inCar) obstacles.push(f);
    for (const v of this.vehicles) obstacles.push(v);
    for (const v of this.vehicles) {
      const ai = v.data.driverAI as CarDriver | null;
      if (ai && v.driver === 'npc') {
        ai.update(v, dt, obstacles.filter((o) => o !== v), this.grid);
        if (ai.honk) sfx.horn(Math.hypot(v.x - p.x, v.z - p.z));
      }
      else if (!v.driver) v.input = { throttle: 0, steer: 0, handbrake: true };
    }
    for (const v of this.vehicles) {
      const far = Math.hypot(v.x - p.x, v.z - p.z) > 160;
      if (!far || v === this.playerCar) v.update(dt, this);
    }
    this.hitPeople();
    this.popT += dt;
    if (this.popT > 0.5) {
      this.popT = 0;
      this.populate();
    }
    this.updatePolice(dt);

    let siren = 0;
    for (const u of this.units) if (u.car.siren) siren = Math.max(siren, 1 - Math.hypot(u.car.x - p.x, u.car.z - p.z) / 120);
    sfx.siren(Math.max(0, siren));
    this.m.hud.setWanted(this.wanted, this.unseen < 1);
    this.m.hud.blips = this.units.filter((u) => u.car.siren).map((u) => [u.car.x, u.car.z, '#5aa0ff']);
  }

  /** Cars knock people down; slow cars just shove them aside. */
  private hitPeople() {
    for (const v of this.vehicles) {
      const cos = Math.cos(v.heading), sin = Math.sin(v.heading);
      for (const f of this.m.fighters) {
        if (f.data.inCar || !f.alive) continue;
        const dx = f.x - v.x, dz = f.z - v.z;
        if (dx * dx + dz * dz > 16) continue;
        const lx = dx * cos - dz * sin; // across the car
        const lz = dx * sin + dz * cos; // along the car
        const mx = v.halfWid + f.radius * 0.8, mz = v.halfLen + f.radius * 0.8;
        if (Math.abs(lx) > mx || Math.abs(lz) > mz) continue;
        const sp = v.speed;
        if (sp > 3.5 && !f.grounded) {
          const res = f.takeImpact(v.x - v.vx, v.z - v.vz, sp * 3.2, sp * 0.8);
          v.vx *= 0.85;
          v.vz *= 0.85;
          sfx.hit(1.3, Math.hypot(f.x - this.m.players[0].x, f.z - this.m.players[0].z));
          if (res && v === this.playerCar) {
            if (f.team === 'civil' || f.team === 'police') this.addWanted(res.ko ? 1 : 0, res.ko ? 'Сбил человека!' : undefined);
            if (f.team === 'police') this.addWanted(1, 'Сбил милиционера!');
            if (res.ko) this.m.onKO(this.m.players[0], f);
            this.m.shake(0.6);
          }
          continue;
        }
        // Push out sideways along the shorter axis.
        const px = mx - Math.abs(lx), pz = mz - Math.abs(lz);
        if (px < pz) {
          const s = Math.sign(lx) * px;
          f.x += s * cos;
          f.z += -s * sin;
        } else {
          const s = Math.sign(lz) * pz;
          f.x += s * sin;
          f.z += s * cos;
        }
      }
    }
  }

  dispose() {
    sfx.engineSet(false);
    sfx.siren(0);
    this.m.scene.remove(this.layer);
  }
}
