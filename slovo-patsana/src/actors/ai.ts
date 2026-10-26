import type { Fighter } from './Fighter';
import { zoneAt, type City } from '../world/City';
import { pick } from '../core/math';
import { BARKS } from './looks';

export type Role = 'ped' | 'gang' | 'ally' | 'duel' | 'police';

export interface AIWorld {
  fighters: Fighter[];
  players: Fighter[];
  city: City | null;
  /** Player's wanted level (militsiya only chase when it's above zero). */
  wanted?: number;
  bark(f: Fighter, text: string): void;
}

const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Per-NPC decision making. Writes into fighter.ctrl each frame. */
export class Brain {
  mode: 'idle' | 'walk' | 'flee' | 'fight' | 'return' = 'idle';
  target: Fighter | null = null;
  home: { x: number; z: number };
  private node = -1;
  private cool = 0.5 + Math.random();
  private strafe = Math.random() < 0.5 ? 1 : -1;
  private strafeT = 0;
  private blockT = 0;
  private comboLeft = 0;
  private fleeFrom: { x: number; z: number } | null = null;
  private modeT = 0;
  private barkCd = 0;
  brave: boolean;
  /** 0..1 — how aggressive/skilled; versus CPU difficulty uses this. */
  skill: number;
  idleAnim: string | null = null;
  /** Story enemies: pick fights anywhere, not only on home turf. */
  hunt = false;

  constructor(public role: Role, home: { x: number; z: number }, skill = 0.5) {
    this.home = { ...home };
    this.brave = role === 'ped' ? Math.random() < 0.25 : true;
    this.skill = skill;
    if (role === 'ped') this.mode = 'walk';
    if (role === 'gang' && Math.random() < 0.5) this.idleAnim = 'smoke';
  }

  private say(w: AIWorld, f: Fighter, lines: string[]) {
    if (this.barkCd > 0) return;
    this.barkCd = 4 + Math.random() * 4;
    w.bark(f, pick(Math.random, lines));
  }

  /** Make this NPC fight `t` (and tell friends nearby). */
  engage(f: Fighter, t: Fighter, w: AIWorld, rally = true) {
    if (this.target === t && this.mode === 'fight') return;
    this.target = t;
    this.mode = 'fight';
    this.modeT = 0;
    f.data.guard = true;
    if (rally && this.role === 'gang') {
      for (const o of w.fighters) {
        if (o === f || o.team !== f.team || !o.alive) continue;
        const b = o.data.brain as Brain | undefined;
        if (b && b.mode !== 'fight' && dist(o, f) < 20) b.engage(o, t, w, false);
      }
    }
  }

  private hostileTo(o: Fighter) {
    if (this.role === 'duel') return true;
    if (this.role === 'gang') return (o.team === 'universam') && o.alive;
    if (this.role === 'ally') return (o.team === 'razezd' || o.team === 'hadi') && o.alive && !o.data.spar;
    if (this.role === 'police') return o.team === 'universam' && !!o.data.isPlayer && o.alive;
    return false;
  }

  update(f: Fighter, dt: number, w: AIWorld) {
    const c = f.ctrl;
    c.punch = c.kick = c.special = c.dodge = c.block = false;
    c.face = null;
    c.mx = c.mz = 0;
    c.speed = 0;
    this.cool -= dt;
    this.modeT += dt;
    this.barkCd -= dt;
    if (!f.alive || f.grounded) return;
    if (f.state === 'hit' || f.state === 'dodge') return;

    // React to being hit.
    const la = f.lastAttacker;
    if (la && la.alive && f.sinceCombat < 0.2 && this.target !== la) {
      if (this.role === 'ped') {
        if (this.brave && f.hp > f.maxHp * 0.4) {
          this.say(w, f, BARKS.pedAngry);
          this.engage(f, la, w);
        } else this.flee(la, w, f);
      } else if (this.role === 'police') {
        this.engage(f, la, w);
      } else if (this.role !== 'ally' || la.team !== 'universam') {
        if (this.role === 'gang') this.say(w, f, BARKS.gangHit);
        this.engage(f, la, w);
      }
    }

    switch (this.mode) {
      case 'idle':
        this.idle(f, w);
        break;
      case 'walk':
        this.walk(f, w);
        break;
      case 'flee':
        this.doFlee(f, w);
        break;
      case 'return': {
        const d = dist(f, this.home);
        if (d < 1.5) {
          this.mode = this.role === 'ped' ? 'walk' : 'idle';
          f.data.guard = false;
        } else this.moveTo(f, this.home.x, this.home.z, 3.2);
        this.scan(f, w);
        break;
      }
      case 'fight':
        this.fight(f, dt, w);
        break;
    }
    if (this.mode !== 'idle' && f.anim.current === this.idleAnim && this.idleAnim) f.anim.release();
  }

  private moveTo(f: Fighter, x: number, z: number, speed: number) {
    const dx = x - f.x, dz = z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    f.ctrl.mx = dx / d;
    f.ctrl.mz = dz / d;
    f.ctrl.speed = speed;
  }

  private scan(f: Fighter, w: AIWorld) {
    if (this.role === 'ped') {
      // Panic if a fight breaks out nearby.
      for (const o of w.fighters) {
        if (o === f || !o.alive || o.sinceCombat > 0.5) continue;
        if (o.state === 'attack' && dist(o, f) < 11) {
          this.flee(o, w, f);
          return;
        }
      }
      return;
    }
    for (const o of w.fighters) {
      if (o === f || !this.hostileTo(o) || o.grounded || o.data.inCar) continue;
      const d = dist(o, f);
      if (this.role === 'gang') {
        const zone = zoneAt(o.x, o.z);
        if ((d < 11 && zone === f.team) || (this.hunt && d < 40)) {
          this.say(w, f, BARKS.gangAggro);
          this.engage(f, o, w);
          return;
        }
      } else if (this.role === 'ally') {
        // Join fights near a player.
        const nearPlayer = w.players.some((p) => dist(p, o) < 8 && (p.sinceCombat < 3 || o.sinceCombat < 3));
        if (d < 18 && nearPlayer) {
          this.say(w, f, BARKS.allyJoin);
          this.engage(f, o, w);
          return;
        }
      } else if (this.role === 'police') {
        if ((w.wanted ?? 0) > 0 && d < 40) {
          this.say(w, f, BARKS.police);
          this.engage(f, o, w);
          return;
        }
      } else if (this.role === 'duel') {
        this.engage(f, o, w);
        return;
      }
    }
  }

  private idle(f: Fighter, w: AIWorld) {
    if (dist(f, this.home) > 2) this.moveTo(f, this.home.x, this.home.z, 1.4);
    else if (this.idleAnim && f.anim.current !== this.idleAnim && f.state === 'free') f.anim.play(this.idleAnim);
    // Face the group centre-ish
    if (this.role !== 'duel' && f.ctrl.speed === 0) f.ctrl.face = Math.atan2(this.home.x - f.x + 0.01, this.home.z - f.z) + Math.PI;
    if (this.role === 'ally') {
      // Follow the player around in Universam turf.
      const p = w.players[0];
      if (p && p.alive && dist(p, this.home) < 25 && dist(p, f) > 4 && dist(p, f) < 25) this.moveTo(f, p.x, p.z, 3.5);
    }
    this.scan(f, w);
  }

  private walk(f: Fighter, w: AIWorld) {
    const city = w.city;
    if (!city) return;
    if (this.node < 0) {
      let best = 0, bd = 1e9;
      city.walkNodes.forEach((n, i) => {
        const d = dist(n, f);
        if (d < bd) [bd, best] = [d, i];
      });
      this.node = best;
    }
    const n = city.walkNodes[this.node];
    if (dist(n, f) < 1.2) this.node = pick(Math.random, n.next);
    const t = city.walkNodes[this.node];
    this.moveTo(f, t.x, t.z, 1.35);
    this.scan(f, w);
  }

  flee(from: { x: number; z: number }, w: AIWorld, f: Fighter) {
    if (this.mode !== 'flee') this.say(w, f, BARKS.pedFlee);
    this.mode = 'flee';
    this.modeT = 0;
    this.fleeFrom = { x: from.x, z: from.z };
    this.target = null;
  }

  private doFlee(f: Fighter, w: AIWorld) {
    const from = this.fleeFrom!;
    let dx = f.x - from.x, dz = f.z - from.z;
    const d = Math.hypot(dx, dz) || 1;
    dx /= d;
    dz /= d;
    // Wobble so they don't all run in straight lines into walls.
    const a = Math.sin(this.modeT * 1.3 + f.x) * 0.5;
    f.ctrl.mx = dx * Math.cos(a) - dz * Math.sin(a);
    f.ctrl.mz = dx * Math.sin(a) + dz * Math.cos(a);
    f.ctrl.speed = 5.2;
    if (this.modeT > 7 || d > 40) {
      this.mode = this.role === 'ped' ? 'walk' : 'return';
      this.node = -1;
    }
    void w;
  }

  private fight(f: Fighter, dt: number, w: AIWorld) {
    const t = this.target;
    const c = f.ctrl;
    const policeDone = this.role === 'police' && (w.wanted ?? 0) === 0;
    if (policeDone || !t || !t.alive || (this.role === 'gang' && dist(f, this.home) > 45) || (this.role === 'ped' && this.modeT > 12)) {
      this.target = null;
      this.mode = this.role === 'ped' ? 'walk' : 'return';
      this.node = -1;
      return;
    }
    if (this.role === 'gang' && f.hp < f.maxHp * 0.2 && Math.random() < 0.004) {
      this.flee(t, w, f);
      return;
    }
    const dx = t.x - f.x, dz = t.z - f.z;
    const d = Math.hypot(dx, dz) || 1;
    c.face = Math.atan2(dx, dz);

    // Only a couple of enemies press in at once; the rest circle and wait their turn.
    let closer = 0;
    for (const o of w.fighters) {
      if (o === f || !o.alive || o.grounded) continue;
      const b = o.data.brain as Brain | undefined;
      if (b?.target === t && b.mode === 'fight' && dist(o, t) < d - 0.05) closer++;
    }
    const engaged = closer < (this.role === 'duel' ? 1 : 2);
    const want = t.grounded ? 2.2 : engaged ? 1.15 : 3.4;

    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = 0.8 + Math.random() * 1.8;
      if (Math.random() < 0.4) this.strafe *= -1;
    }
    const nx = dx / d, nz = dz / d;
    if (d > want + 0.35) {
      c.mx = nx;
      c.mz = nz;
      c.speed = d > 6 ? 5.2 : 3.2;
    } else if (d < want - 0.4) {
      c.mx = -nx;
      c.mz = -nz;
      c.speed = 2;
    } else {
      c.mx = -nz * this.strafe;
      c.mz = nx * this.strafe;
      c.speed = engaged ? 0.9 : 1.6;
    }

    // Defence: react to an incoming attack.
    this.blockT -= dt;
    const threatened = t.state === 'attack' && d < 2.2;
    if (threatened && this.blockT < -0.3 && Math.random() < 0.08 + this.skill * 0.25) {
      if (Math.random() < 0.25 * this.skill && f.stamina > 30) c.dodge = true;
      else this.blockT = 0.35 + Math.random() * 0.3;
    }
    if (this.blockT > 0) {
      c.block = true;
      return;
    }

    // Offence
    if (f.state === 'attack' && this.comboLeft > 0) {
      c.punch = true;
      this.comboLeft--;
      return;
    }
    if (engaged && !t.grounded && d < 1.7 && this.cool <= 0 && f.state === 'free') {
      const r = Math.random();
      if (f.special && f.stamina > 60 && r < 0.12 + this.skill * 0.1) c.special = true;
      else if (r < 0.32) c.kick = true;
      else {
        c.punch = true;
        this.comboLeft = Math.random() < 0.3 + this.skill * 0.4 ? 1 + Math.floor(Math.random() * 2) : 0;
      }
      this.cool = (1.4 - this.skill * 0.9) * (0.6 + Math.random() * 0.8);
    }
  }
}
