import type { Body, SkinnedAnimator } from './SkinnedBody';
import { ATTACKS, PUNCH_CHAIN, type AttackDef, type HitDef } from '../combat/attacks';
import { clamp, dampAngle, wrapAngle } from '../core/math';
import type { BoxGrid } from '../core/collision';

export type Team = 'universam' | 'razezd' | 'hadi' | 'civil' | 'police';
export type FState = 'free' | 'attack' | 'hit' | 'down' | 'getup' | 'dodge' | 'dead';

/** What the controller (player or AI) wants this frame. Directions are world-space. */
export interface Ctrl {
  mx: number;
  mz: number;
  speed: number; // desired m/s
  face: number | null; // heading to turn toward, overrides move-facing
  punch: boolean;
  kick: boolean;
  special: boolean;
  block: boolean;
  dodge: boolean;
}

export const emptyCtrl = (): Ctrl => ({ mx: 0, mz: 0, speed: 0, face: null, punch: false, kick: false, special: false, block: false, dodge: false });

export interface FighterOpts {
  body: Body;
  hp: number;
  power?: number;
  speed?: number;
  special?: string;
  team: Team;
  name: string;
  charId?: string;
  /** Stamina regeneration multiplier (technique). */
  regen?: number;
}

export interface HitResult {
  blocked: boolean;
  dmg: number;
  ko: boolean;
  knockdown: boolean;
}

/** The world a fighter lives in — implemented by the game modes. */
export interface Arena {
  fighters: Fighter[];
  grid: BoxGrid | null;
  /** Optional hard bounds (versus arenas). */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
  onHit(att: Fighter, vic: Fighter, res: HitResult, hit: HitDef): void;
  onWhiff(att: Fighter): void;
  onStep(f: Fighter): void;
}

export class Fighter {
  rig: Body;
  anim: SkinnedAnimator;
  x = 0;
  z = 0;
  vx = 0;
  vz = 0;
  heading = 0;
  hp: number;
  maxHp: number;
  stamina = 100;
  power: number;
  moveMul: number;
  regen: number;
  special: string | null;
  team: Team;
  name: string;
  charId: string | undefined;
  radius = 0.38;
  state: FState = 'free';
  stateT = 0;
  attack: AttackDef | null = null;
  private attackT = 0;
  private hitDone: Set<Fighter>[] = [];
  private comboStep = 0;
  private comboTimer = 0;
  private buffered: 'punch' | 'kick' | 'special' | null = null;
  blocking = false;
  invuln = 0;
  /** Seconds since this fighter last threw or took a punch. */
  sinceCombat = 99;
  /** Last fighter who hurt us — AI uses it to retaliate. */
  lastAttacker: Fighter | null = null;
  ctrl: Ctrl = emptyCtrl();
  /** Free-form slot for AI / game-mode data. */
  data: Record<string, unknown> = {};
  hitFlash = 0;

  constructor(opts: FighterOpts, private arena: Arena) {
    this.rig = opts.body;
    this.anim = opts.body.anim;
    this.anim.onStep = () => this.arena.onStep(this);
    this.hp = this.maxHp = opts.hp;
    this.power = opts.power ?? 1;
    this.moveMul = opts.speed ?? 1;
    this.regen = opts.regen ?? 1;
    this.special = opts.special ?? null;
    this.team = opts.team;
    this.name = opts.name;
    this.charId = opts.charId;
  }

  get alive() {
    return this.state !== 'dead';
  }
  get grounded() {
    return this.state === 'down' || this.state === 'dead' || this.state === 'getup';
  }
  get forwardX() {
    return Math.sin(this.heading);
  }
  get forwardZ() {
    return Math.cos(this.heading);
  }

  place(x: number, z: number, heading = 0) {
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.sync();
  }

  private setState(s: FState) {
    this.state = s;
    this.stateT = 0;
  }

  private startAttack(id: string) {
    const a = ATTACKS[id];
    if (!a) return;
    if (a.kind === 'special' && this.stamina < a.stamina) return;
    this.attack = a;
    this.attackT = 0;
    this.hitDone = a.hits.map(() => new Set());
    this.stamina = Math.max(0, this.stamina - a.stamina);
    this.setState('attack');
    this.anim.play(a.clip, a);
    this.arena.onWhiff(this);
    this.sinceCombat = 0;
  }

  private nextPunch() {
    if (this.comboTimer <= 0) this.comboStep = 0;
    const id = PUNCH_CHAIN[this.comboStep % PUNCH_CHAIN.length];
    this.comboStep = (this.comboStep + 1) % PUNCH_CHAIN.length;
    this.comboTimer = 0.9;
    this.startAttack(id);
  }

  private doAction(kind: 'punch' | 'kick' | 'special') {
    if (kind === 'punch') this.nextPunch();
    else if (kind === 'kick') {
      this.comboStep = 0;
      this.startAttack('kick');
    } else if (this.special) this.startAttack(this.special);
  }

  /** Damage multiplier including character passives. */
  get dmgMul() {
    let m = this.power;
    if (this.charId === 'palto') m *= 1 + 0.6 * (1 - this.hp / this.maxHp);
    if (this.charId === 'turbo' && this.attack?.kind === 'kick') m *= 1.25;
    return m;
  }

  takeHit(att: Fighter, hit: HitDef): HitResult | null {
    if (this.invuln > 0 || this.grounded) return null;
    this.lastAttacker = att;
    this.sinceCombat = 0;
    // Blocking only works facing the attacker.
    const dx = att.x - this.x;
    const dz = att.z - this.z;
    const facing = (this.forwardX * dx + this.forwardZ * dz) / (Math.hypot(dx, dz) || 1);
    const unblockable = hit.unblockable || (att.charId === 'kashchey' && att.attack?.kind === 'kick');
    const len = Math.hypot(dx, dz) || 1;
    const nx = -dx / len;
    const nz = -dz / len;
    let dmg = hit.dmg * att.dmgMul;
    if (this.blocking && this.state === 'free' && facing > 0.2 && !unblockable) {
      dmg *= this.charId === 'adidas' ? 0.08 : 0.15;
      this.stamina -= 12;
      this.hp = Math.max(1, this.hp - dmg);
      this.vx += nx * hit.kb * 0.4;
      this.vz += nz * hit.kb * 0.4;
      if (this.stamina <= 0) {
        // Guard broken
        this.stamina = 0;
        this.blocking = false;
        this.setState('hit');
        this.anim.play('hit');
        this.stateT = -0.4;
      } else {
        this.anim.play('blockHit');
      }
      return { blocked: true, dmg, ko: false, knockdown: false };
    }
    this.hp -= dmg;
    this.hitFlash = 0.15;
    this.vx += nx * hit.kb;
    this.vz += nz * hit.kb;
    this.attack = null;
    this.blocking = false;
    const ko = this.hp <= 0;
    const kd = ko || !!hit.knockdown;
    if (ko) this.hp = 0;
    if (kd) {
      this.heading = Math.atan2(dx, dz); // fall away from the attacker
      this.setState('down');
      this.anim.play('fall');
      this.data.ko = ko;
    } else {
      this.setState('hit');
      this.anim.play('hit');
    }
    return { blocked: false, dmg, ko, knockdown: kd };
  }

  /** Hit by something that isn't a fighter (a car). Always knocks down. */
  takeImpact(fromX: number, fromZ: number, dmg: number, kb: number): HitResult | null {
    if (this.invuln > 0 || this.grounded) return null;
    const dx = fromX - this.x, dz = fromZ - this.z;
    const len = Math.hypot(dx, dz) || 1;
    this.hp -= dmg;
    this.hitFlash = 0.15;
    this.vx -= (dx / len) * kb;
    this.vz -= (dz / len) * kb;
    this.attack = null;
    this.blocking = false;
    const ko = this.hp <= 0;
    if (ko) this.hp = 0;
    this.heading = Math.atan2(dx, dz);
    this.setState('down');
    this.anim.play('fall');
    this.data.ko = ko;
    this.sinceCombat = 0;
    return { blocked: false, dmg, ko, knockdown: true };
  }

  /** Fully restore (respawn, new round). */
  revive(hp = this.maxHp) {
    this.hp = hp;
    this.stamina = 100;
    this.setState('free');
    this.anim.stop();
    this.attack = null;
    this.vx = this.vz = 0;
    this.data.ko = false;
  }

  update(dt: number) {
    const c = this.ctrl;
    this.stateT += dt;
    this.sinceCombat += dt;
    this.comboTimer -= dt;
    this.invuln = Math.max(0, this.invuln - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.state !== 'attack' && this.state !== 'dodge') this.stamina = Math.min(100, this.stamina + dt * (this.blocking ? 8 : 20) * this.regen);
    // Zima's passive: he gets his breath (and health) back between fights.
    if (this.charId === 'zima' && this.alive && this.sinceCombat > 4) this.hp = Math.min(this.maxHp, this.hp + dt * 3);

    let wantVX = 0;
    let wantVZ = 0;
    let accel = 14;

    switch (this.state) {
      case 'free': {
        this.blocking = c.block;
        const dodgeCost = this.charId === 'marat' ? 6 : 15;
        if (c.dodge && this.stamina >= dodgeCost) {
          this.stamina -= dodgeCost;
          this.setState('dodge');
          this.invuln = 0.3;
          let dx = c.mx, dz = c.mz;
          if (Math.hypot(dx, dz) < 0.1) {
            dx = -this.forwardX;
            dz = -this.forwardZ;
          }
          const l = Math.hypot(dx, dz);
          this.vx = (dx / l) * 8;
          this.vz = (dz / l) * 8;
          this.anim.play('dodge');
          break;
        }
        if (!c.block) {
          if (c.special && this.special) this.doAction('special');
          else if (c.punch) this.doAction('punch');
          else if (c.kick) this.doAction('kick');
          if ((this.state as FState) === 'attack') break;
        }
        const mul = c.block ? 0.35 : 1;
        wantVX = c.mx * c.speed * mul * this.moveMul;
        wantVZ = c.mz * c.speed * mul * this.moveMul;
        if (c.face !== null) this.heading = dampAngle(this.heading, c.face, 14, dt);
        else if (Math.hypot(c.mx, c.mz) > 0.1) this.heading = dampAngle(this.heading, Math.atan2(c.mx, c.mz), 12, dt);
        break;
      }
      case 'attack': {
        const a = this.attack!;
        this.blocking = false;
        this.attackT += dt;
        if (c.face !== null && this.attackT < 0.12) this.heading = dampAngle(this.heading, c.face, 18, dt);
        if (a.move && this.attackT >= a.move[0] && this.attackT <= a.move[1]) {
          wantVX = this.forwardX * a.move[2];
          wantVZ = this.forwardZ * a.move[2];
          accel = 40;
        } else accel = 18;
        a.hits.forEach((h, i) => {
          // Lunges stay active over a window; everything else checks once.
          const done = this.hitDone[i];
          const active = h.until ? this.attackT >= h.t && this.attackT <= h.until : this.attackT >= h.t && !done.has(this);
          if (!active) return;
          if (!h.until) done.add(this);
          this.resolveHit(h, done);
        });
        if (c.punch) this.buffered = 'punch';
        else if (c.kick) this.buffered = 'kick';
        else if (c.special) this.buffered = 'special';
        if (this.attackT >= a.chainAt && this.buffered && a.kind !== 'special') {
          const b = this.buffered;
          this.buffered = null;
          this.doAction(b);
        } else if (this.attackT >= a.dur) {
          this.attack = null;
          this.buffered = null;
          this.setState('free');
        }
        break;
      }
      case 'hit':
        this.blocking = false;
        accel = 6;
        if (this.stateT > 0.36) this.setState('free');
        break;
      case 'dodge':
        accel = 3;
        if (this.stateT > 0.32) this.setState('free');
        break;
      case 'down':
        accel = 5;
        if (this.stateT > 0.55 && this.anim.current === 'fall') this.anim.play('down');
        if (this.data.ko) {
          if (this.stateT > 0.6) this.setState('dead');
        } else if (this.stateT > 1.4) {
          this.setState('getup');
          this.anim.play('getup');
          this.invuln = 0.9;
        }
        break;
      case 'getup':
        accel = 10;
        if (this.stateT > 0.75) this.setState('free');
        break;
      case 'dead':
        accel = 5;
        if (this.anim.current !== 'down' && this.stateT > 0.1) this.anim.play('down');
        break;
    }

    const k = 1 - Math.exp(-accel * dt);
    this.vx += (wantVX - this.vx) * k;
    this.vz += (wantVZ - this.vz) * k;
    this.x += this.vx * dt;
    this.z += this.vz * dt;

    // Push apart from other standing fighters, then out of buildings.
    if (!this.grounded) {
      for (const o of this.arena.fighters) {
        if (o === this || o.grounded) continue;
        const dx = this.x - o.x;
        const dz = this.z - o.z;
        const r = this.radius + o.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < r * r && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const p = (r - d) * 0.5;
          this.x += (dx / d) * p;
          this.z += (dz / d) * p;
        }
      }
    }
    if (this.arena.grid) [this.x, this.z] = this.arena.grid.resolveCircle(this.x, this.z, this.radius);
    const b = this.arena.bounds;
    if (b) {
      this.x = clamp(this.x, b.minX, b.maxX);
      this.z = clamp(this.z, b.minZ, b.maxZ);
    }

    this.anim.speed = this.grounded || this.state === 'dodge' ? 0 : Math.hypot(this.vx, this.vz);
    this.anim.setGuard(this.state !== 'free' || this.sinceCombat < 5 || c.block || this.data.guard === true);
    const cur = this.anim.current;
    if (this.state === 'free' && this.blocking) {
      if (cur !== 'block' && cur !== 'blockHit') this.anim.play('block');
    } else if (cur === 'block') this.anim.release();
    this.anim.update(dt);
    this.sync();
  }

  private resolveHit(h: HitDef, done: Set<Fighter>) {
    for (const o of this.arena.fighters) {
      if (o === this || done.has(o) || o.grounded || o.data.inCar) continue;
      if (o.team === this.team && o.team !== 'civil' && !this.data.versus) continue;
      const dx = o.x - this.x;
      const dz = o.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d > h.range + o.radius * 0.5) continue;
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - this.heading));
      if (ang > h.arc && d > 0.5) continue;
      done.add(o);
      const res = o.takeHit(this, h);
      if (res) this.arena.onHit(this, o, res, h);
    }
  }

  sync() {
    const r = this.rig.root;
    r.position.set(this.x, 0, this.z);
    r.rotation.y = this.heading;
  }
}
