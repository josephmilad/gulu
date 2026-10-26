import * as THREE from 'three';
import type { App, Mode } from './App';
import { Fighter, type Arena, type HitResult, type Team } from '../actors/Fighter';
import { Brain, type AIWorld, type Role } from '../actors/ai';
import { callName, charById, fighterOpts, fullTitle } from '../actors/characters';
import { ALLY_NICKS, BARKS, CIVIL_NAMES_F, CIVIL_NAMES_M, GANG_NICKS, civilSpec, gangSpec } from '../actors/looks';
import { makeBody } from '../actors/SkinnedBody';
import { ATTACKS, type HitDef } from '../combat/attacks';
import { FollowCamera } from '../core/FollowCamera';
import { readIntent } from '../core/input';
import { pick, wrapAngle } from '../core/math';
import { sfx } from '../audio/sfx';
import { Hud } from '../ui/Hud';
import { h, uiRoot } from '../ui/dom';
import { controlsHtml } from '../ui/controls';
import { ZONE_NAMES, zoneAt, type Hangout, type Zone } from '../world/City';
import { Streets } from './Streets';
import { Story } from './Story';

interface Group {
  hang: Hangout;
  team: Zone;
  members: Fighter[];
  respawnAt: number;
  wiped: boolean;
}

interface Pickup {
  mesh: THREE.Object3D;
  value: number;
  t: number;
}

const PED_COUNT = 16;

/** Open-world mode: walk the district, fight rival gangs, earn money and authority. */
export class FreeRoamMode implements Mode, Arena, AIWorld {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(60, 1, 0.1, 700);
  fighters: Fighter[] = [];
  players: Fighter[] = [];
  grid;
  city;
  cam: FollowCamera;
  hud: Hud;
  streets: Streets;
  private groups: Group[] = [];
  private pickups: Pickup[] = [];
  private actorLayer = new THREE.Group();
  time = 0;
  money = 20;
  authority = 0;
  private zone: Zone = 'universam';
  private paused = false;
  private pauseEl: HTMLElement | null = null;
  private tipEl: HTMLElement;
  private wastedEl: HTMLElement | null = null;
  private wastedT = 0;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private focus = new THREE.Vector3();
  private charId: string;
  private noteMesh: THREE.Mesh;
  /** Soft light that travels with the camera so characters read at night. */
  private fill = new THREE.PointLight(0xffe2c4, 8, 14, 1.5);

  story: Story | null = null;

  constructor(public app: App, charId: string, private onQuit: () => void, opts: { story?: boolean } = {}) {
    const w = app.getWorld();
    this.scene = w.scene;
    this.city = w.city;
    this.grid = w.city.grid;
    this.charId = charId;
    this.scene.add(this.actorLayer);
    this.actorLayer.add(this.fill);
    const ch = charById(charId);
    const p = new Fighter({ body: makeBody(app.assets.characters[ch.model], { hero: true }), ...fighterOpts(ch), team: 'universam', name: callName(ch) }, this);
    const s = this.city.spawn;
    p.place(s.x, s.z, s.heading);
    p.data.isPlayer = true;
    this.add(p);
    this.players.push(p);
    this.cam = new FollowCamera(this.camera, this.grid);
    this.cam.snap(p.x, p.z, p.heading);
    this.hud = new Hud([{ f: p, portrait: app.portraits[ch.id], title: fullTitle(ch) }], this.city);

    for (const hg of this.city.hangouts) {
      this.groups.push({ hang: hg, team: hg.zone, members: [], respawnAt: 0, wiped: false });
    }
    for (let i = 0; i < PED_COUNT; i++) this.spawnPed(true);
    this.streets = new Streets(this);
    if (opts.story) this.story = new Story(this, charId);

    const note = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.25),
      new THREE.MeshBasicMaterial({ color: 0x9fd08a, side: THREE.DoubleSide, toneMapped: false }),
    );
    this.noteMesh = note;

    this.tipEl = h('div', 'crosshair-tip', 'Кликни мышью, чтобы управлять камерой · <b>H</b> — управление');
    uiRoot().append(this.tipEl);
    setTimeout(() => this.tipEl.classList.add('hidden'), 9000);
    addEventListener('keydown', this.keyHandler);
    document.addEventListener('pointerlockchange', this.onLockChange);
    this.hud.notice(fullTitle(ch).toUpperCase(), 'Район Универсама. Держи слово.', 3.5);
    sfx.stopMusic();
    sfx.unlock();
    sfx.startWind();
  }

  // ---------- Arena callbacks ----------
  onHit(att: Fighter, vic: Fighter, res: HitResult, hit: HitDef) {
    const listener = this.players[0];
    const d = Math.hypot(vic.x - listener.x, vic.z - listener.z);
    if (res.blocked) sfx.block(d);
    else sfx.hit(Math.min(1.4, hit.dmg / 12), d);
    if (res.knockdown) setTimeout(() => sfx.thud(d), 380);
    if (d < 30) this.hud.damage(vic, res.dmg, res.blocked);
    const playerInvolved = this.players.includes(att) || this.players.includes(vic);
    if (playerInvolved && !res.blocked) {
      this.app.freeze(res.knockdown ? 0.09 : 0.045);
      this.cam.shake = Math.max(this.cam.shake, res.knockdown ? 1 : 0.5);
    }
    // Anyone hit by a player calls for help / gets angry.
    const b = vic.data.brain as Brain | undefined;
    if (b && vic.alive && !res.ko) {
      if (b.role === 'ped' && !b.brave) b.flee(att, this, vic);
    }
    if (res.ko) this.onKO(att, vic);
  }

  onWhiff(att: Fighter) {
    const l = this.players[0];
    sfx.whoosh(Math.hypot(att.x - l.x, att.z - l.z));
  }

  onStep(f: Fighter) {
    const l = this.players[0];
    sfx.step(Math.hypot(f.x - l.x, f.z - l.z));
  }

  bark(f: Fighter, text: string) {
    const l = this.players[0];
    if (Math.hypot(f.x - l.x, f.z - l.z) < 30) this.hud.bubble(f, text);
  }

  get wanted() {
    return this.streets?.wanted ?? 0;
  }

  shake(n: number) {
    this.cam.shake = Math.max(this.cam.shake, n);
  }

  onKO(att: Fighter, vic: Fighter) {
    const byPlayer = this.players.includes(att);
    if (this.players.includes(vic)) return this.wasted(att.team === 'police' || this.wanted > 0);
    if (!byPlayer) return;
    if (vic.team === 'police') {
      this.streets.addWanted(1, 'Ты вырубил милиционера!');
      this.dropMoney(vic.x, vic.z, 10 + Math.floor(Math.random() * 15));
      return;
    }
    if (vic.team === 'razezd' || vic.team === 'hadi') {
      this.authority += 3;
      this.dropMoney(vic.x, vic.z, 5 + Math.floor(Math.random() * 20));
      if (Math.random() < 0.4) this.hud.bubble(att, pick(Math.random, BARKS.ko));
      // Was that the last of the group?
      const g = this.groups.find((gr) => gr.members.includes(vic));
      if (g && g.members.every((m) => !m.alive)) {
        g.wiped = true;
        g.respawnAt = this.time + 90;
        this.authority += 10;
        this.hud.notice('ОТШИЛИ!', `${ZONE_NAMES[g.team as Zone]}: компания разогнана · +10 авторитета`);
        sfx.ko();
      }
    } else if (vic.team === 'civil') {
      this.authority = Math.max(0, this.authority - 5);
      this.dropMoney(vic.x, vic.z, 1 + Math.floor(Math.random() * 6));
      this.hud.toast('Пацаны так не делают. −5 авторитета');
      this.streets.addWanted(1);
    }
  }

  private dropMoney(x: number, z: number, value: number) {
    const m = this.noteMesh.clone();
    m.position.set(x, 0.5, z);
    this.actorLayer.add(m);
    this.pickups.push({ mesh: m, value, t: 0 });
  }

  private busted = false;

  private wasted(busted = false) {
    sfx.ko();
    this.story?.onWasted();
    this.busted = busted;
    this.wastedEl = h('div', 'wasted', busted
      ? 'ЗАДЕРЖАН<small>Ночь в отделении. Милиция забрала половину денег.</small>'
      : 'ТЕБЯ ОТШИЛИ<small>Пацаны подберут. Потеряно немного денег.</small>');
    uiRoot().append(this.wastedEl);
    this.wastedT = 4;
    this.app.timeScale = 0.4;
  }

  private respawn() {
    const p = this.players[0];
    this.wastedEl?.remove();
    this.wastedEl = null;
    this.app.timeScale = 1;
    this.money = Math.floor(this.money * (this.busted ? 0.5 : 0.7));
    this.streets.clearWanted();
    for (const f of [...this.fighters]) if (f.team === 'police') this.remove(f);
    p.revive();
    p.place(this.city.spawn.x, this.city.spawn.z, this.city.spawn.heading);
    this.cam.snap(p.x, p.z, p.heading);
    // Calm every gang member down.
    for (const f of this.fighters) {
      const b = f.data.brain as Brain | undefined;
      if (b && b.mode === 'fight') {
        b.target = null;
        b.mode = 'return';
      }
    }
  }

  // ---------- Population ----------
  addFighter(f: Fighter) {
    this.add(f);
  }

  removeFighter(f: Fighter) {
    if (this.fighters.includes(f)) this.remove(f);
  }

  private add(f: Fighter) {
    this.fighters.push(f);
    this.actorLayer.add(f.rig.root);
  }

  private remove(f: Fighter) {
    this.fighters.splice(this.fighters.indexOf(f), 1);
    this.actorLayer.remove(f.rig.root);
  }

  spawnNpc(team: Team, role: Role, x: number, z: number, home: { x: number; z: number }) {
    const spec = team === 'civil' || team === 'police' ? civilSpec() : gangSpec(team);
    const gltf = spec.npc ? this.app.assets.npcs[spec.model] : this.app.assets.charactersLod[spec.model];
    const body = makeBody(gltf, { tint: spec.tint, tintAmt: spec.tintAmt, scale: spec.scale });
    const name = team === 'civil' ? pick(Math.random, spec.female ? CIVIL_NAMES_F : CIVIL_NAMES_M)
      : role === 'ally' ? pick(Math.random, ALLY_NICKS) : pick(Math.random, GANG_NICKS);
    const hp = team === 'civil' ? 40 : role === 'ally' ? 90 : 55 + Math.floor(this.authority / 5) * 3;
    const f = new Fighter({ body, hp: Math.min(hp, 110), power: team === 'civil' ? 0.6 : 0.8, speed: 1, team, name }, this);
    f.place(x, z, Math.random() * Math.PI * 2);
    const skill = team === 'civil' ? 0.1 : Math.min(0.85, 0.3 + this.authority / 200);
    f.data.brain = new Brain(role, home, skill);
    this.add(f);
    return f;
  }

  private spawnPed(anywhere = false) {
    const p = this.players[0];
    for (let tries = 0; tries < 12; tries++) {
      const n = this.city.walkNodes[this.city.randomWalkNode()];
      const d = Math.hypot(n.x - p.x, n.z - p.z);
      if (d < (anywhere ? 12 : 40) || d > 80) continue;
      this.spawnNpc('civil', 'ped', n.x + (Math.random() - 0.5) * 2, n.z + (Math.random() - 0.5) * 2, n);
      return;
    }
  }

  private manageGroups() {
    const p = this.players[0];
    for (const g of this.groups) {
      const d = Math.hypot(g.hang.x - p.x, g.hang.z - p.z);
      if (g.members.length === 0) {
        if (d < 85 && d > 25 && this.time >= g.respawnAt) {
          const ally = g.team === 'universam';
          const n = ally ? 2 : 3 + (this.authority > 40 ? 1 : 0) + (Math.random() < 0.3 ? 1 : 0);
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2;
            const x = g.hang.x + Math.cos(a) * 1.6, z = g.hang.z + Math.sin(a) * 1.6;
            g.members.push(this.spawnNpc(g.team, ally ? 'ally' : 'gang', x, z, { x, z }));
          }
          g.wiped = false;
        }
      } else if (d > 120 && g.members.every((m) => (m.data.brain as Brain).mode !== 'fight')) {
        for (const m of g.members) if (this.fighters.includes(m)) this.remove(m);
        g.members = [];
      } else {
        // Forget members whose bodies were cleaned up.
        g.members = g.members.filter((m) => this.fighters.includes(m));
        if (g.members.length === 0 && g.respawnAt < this.time) g.respawnAt = this.time + 45;
      }
    }
  }

  private managePeds() {
    const p = this.players[0];
    let peds = 0;
    for (const f of [...this.fighters]) {
      if (this.players.includes(f)) continue;
      const d = Math.hypot(f.x - p.x, f.z - p.z);
      const brain = f.data.brain as Brain;
      if (!f.alive) {
        f.data.deadT = ((f.data.deadT as number) ?? 0) + 1 / 4;
        if ((f.data.deadT as number) > 30 || d > 90) this.remove(f);
        continue;
      }
      if (brain.role === 'police' && d > 110) this.remove(f);
      if (brain.role === 'ped') {
        if (d > 95) this.remove(f);
        else peds++;
      }
    }
    if (peds < PED_COUNT) this.spawnPed();
  }

  // ---------- Input & pause ----------
  private onLockChange = () => {
    if (!this.app.input.locked && !this.paused && !this.wastedEl && this.hadLock) this.pause(true);
    if (this.app.input.locked) {
      this.hadLock = true;
      this.tipEl.classList.add('hidden');
    }
  };
  private hadLock = false;

  private onKey(e: KeyboardEvent) {
    if (e.code === 'Escape') this.pause(!this.paused);
    if (e.code === 'KeyH' && !this.paused) this.pause(true, true);
  }

  private pause(on: boolean, controls = false) {
    if (on === this.paused && !controls) return;
    this.paused = on;
    this.pauseEl?.remove();
    this.pauseEl = null;
    if (!on) {
      this.app.input.requestLock();
      return;
    }
    this.app.input.releaseLock();
    const o = h('div', 'overlay');
    o.append(h('h2', '', controls ? 'УПРАВЛЕНИЕ' : 'ПАУЗА'));
    if (controls) o.append(h('div', 'controls', controlsHtml()));
    const list = h('div', 'menu-list');
    const mk = (label: string, fn: () => void) => {
      const b = h('button', 'menu-item', label);
      b.onmouseenter = () => {
        list.querySelectorAll('.menu-item').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      };
      b.onclick = () => {
        sfx.confirm();
        fn();
      };
      list.append(b);
      return b;
    };
    mk('Продолжить', () => this.pause(false)).classList.add('active');
    if (!controls) mk('Управление', () => this.pause(true, true));
    if (!controls) {
      const names = { high: 'высокая', medium: 'средняя', low: 'низкая' } as const;
      const order = ['high', 'medium', 'low'] as const;
      const b = mk(`Графика: ${names[this.app.quality]}`, () => {
        const next = order[(order.indexOf(this.app.quality) + 1) % 3];
        this.app.setQuality(next);
        b.innerHTML = `Графика: ${names[next]}`;
      });
    }
    mk('Главное меню', () => this.onQuit());
    o.append(list);
    uiRoot().append(o);
    this.pauseEl = o;
  }

  // ---------- Frame ----------
  private popT = 0;
  update(dt: number) {
    const p = this.players[0];
    const input = this.app.input;
    if (input.mousePressedBtn(0) && !input.locked && !this.paused) input.requestLock();
    if (this.paused) {
      this.renderOnly(0);
      return;
    }
    this.time += dt;

    if (this.wastedEl) {
      this.wastedT -= dt / Math.max(0.1, this.app.timeScale);
      if (this.wastedT <= 0) this.respawn();
    }

    // Player control
    const it = readIntent(input, 'kbm', dt);
    const f = this.cam.forward;
    const rx = -f.z, rz = f.x; // camera right
    let mx = f.x * it.moveY + rx * it.moveX;
    let mz = f.z * it.moveY + rz * it.moveX;
    const ml = Math.hypot(mx, mz);
    if (ml > 1) {
      mx /= ml;
      mz /= ml;
    }
    // Soft lock-on to the nearest threat.
    const tgt = this.nearestThreat(p);
    const fighting = !!tgt && Math.hypot(tgt.x - p.x, tgt.z - p.z) < 5;
    const c = p.ctrl;
    c.mx = mx;
    c.mz = mz;
    c.speed = it.run ? 6.4 : fighting ? 2.8 : 3.6;
    c.punch = it.punch;
    c.kick = it.kick;
    c.block = it.block;
    c.special = it.special;
    c.dodge = it.dodge;
    c.face = null;
    if (tgt && (fighting || it.punch || it.kick || it.special) && !it.run) c.face = Math.atan2(tgt.x - p.x, tgt.z - p.z);
    p.data.guard = fighting;

    // Cars, traffic and the militsiya.
    this.streets.update(dt, it);
    this.story?.update(dt);
    const driving = !!this.streets.playerCar;
    if (driving) {
      c.mx = c.mz = 0;
      c.punch = c.kick = c.special = c.dodge = c.block = false;
    }

    // AI
    for (const fi of this.fighters) {
      const b = fi.data.brain as Brain | undefined;
      if (b && Math.hypot(fi.x - p.x, fi.z - p.z) < 110) b.update(fi, dt, this);
    }
    for (const fi of this.fighters) {
      if (fi.data.inCar) continue;
      if (Math.hypot(fi.x - p.x, fi.z - p.z) < 110) fi.update(dt);
    }

    this.popT += dt;
    if (this.popT > 0.25) {
      this.popT = 0;
      this.managePeds();
      this.manageGroups();
    }

    // Money pickups
    this.pickups = this.pickups.filter((pk) => {
      pk.t += dt;
      pk.mesh.rotation.y += dt * 3;
      pk.mesh.position.y = 0.45 + Math.sin(pk.t * 4) * 0.1;
      if (Math.hypot(pk.mesh.position.x - p.x, pk.mesh.position.z - p.z) < 1.3 && p.alive) {
        this.money += pk.value;
        sfx.coin();
        this.hud.toast(`+${pk.value} ₽`, 1.2);
        this.actorLayer.remove(pk.mesh);
        return false;
      }
      if (pk.t > 60) {
        this.actorLayer.remove(pk.mesh);
        return false;
      }
      return true;
    });

    const z = zoneAt(p.x, p.z);
    if (z !== this.zone) {
      this.zone = z;
      this.hud.notice(ZONE_NAMES[z].toUpperCase(), z === 'universam' ? 'Своя территория' : 'Чужой район. Смотри в оба.', 2);
    }
    this.hud.setStats(this.money, this.authority, z);
    const car = this.streets.playerCar;
    if (car) this.renderOnly(dt, it.lookX, it.lookY, car.speed > 1, false, car.heading);
    else this.renderOnly(dt, it.lookX, it.lookY, Math.hypot(mx, mz) > 0.1, fighting);
  }

  private renderOnly(dt: number, lookX = 0, lookY = 0, moving = false, fighting = false, heading?: number) {
    const p = this.players[0];
    if (dt > 0) this.cam.update(dt, p.x, p.z, heading ?? p.heading, moving, lookX, lookY, fighting);
    const cp = this.camera.position;
    this.fill.position.set(p.x + (cp.x - p.x) * 0.4, 3, p.z + (cp.z - p.z) * 0.4);
    this.focus.set(p.x, 0, p.z);
    this.app.getWorld().env.update(dt, this.focus);
    this.city.facadeKit.update(this.time);
    this.hud.update(dt, this.camera, this.players, this.fighters.filter((f) => !this.players.includes(f)), this.cam.yaw, [ATTACKS[p.special ?? 'flurry'].stamina]);
  }

  private nearestThreat(p: Fighter): Fighter | null {
    let best: Fighter | null = null;
    let bs = 1e9;
    for (const o of this.fighters) {
      if (o === p || !o.alive || o.grounded) continue;
      const b = o.data.brain as Brain | undefined;
      const hostile = (b?.mode === 'fight' && b.target === p) || o.team === 'razezd' || o.team === 'hadi' || o === p.lastAttacker;
      if (!hostile) continue;
      const dx = o.x - p.x, dz = o.z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > 6) continue;
      // Prefer targets in front of the player.
      const ang = Math.abs(wrapAngle(Math.atan2(dx, dz) - p.heading));
      const score = d + ang * 1.2;
      if (score < bs) {
        bs = score;
        best = o;
      }
    }
    return best;
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    document.removeEventListener('pointerlockchange', this.onLockChange);
    this.app.input.releaseLock();
    this.app.timeScale = 1;
    this.hud.dispose();
    this.tipEl.remove();
    this.pauseEl?.remove();
    this.wastedEl?.remove();
    this.scene.remove(this.actorLayer);
    this.streets.dispose();
    this.story?.dispose();
    void this.charId;
  }
}
