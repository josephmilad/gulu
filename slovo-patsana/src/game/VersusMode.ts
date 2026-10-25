import * as THREE from 'three';
import type { App, Mode } from './App';
import { Fighter, type Arena, type HitResult } from '../actors/Fighter';
import { Brain, type AIWorld } from '../actors/ai';
import { CHARACTERS, type CharacterDef } from '../actors/characters';
import { makeBody, type Body } from '../actors/SkinnedBody';
import { civilSpec } from '../actors/looks';
import type { HitDef } from '../combat/attacks';
import { ATTACKS } from '../combat/attacks';
import { readIntent, type Scheme } from '../core/input';
import { clamp, damp } from '../core/math';
import { sfx } from '../audio/sfx';
import { h, uiRoot } from '../ui/dom';
import { blockCenter } from '../world/City';

const ROUND_TIME = 60;
const WINS_NEEDED = 2;

type Phase = 'intro' | 'fight' | 'ko' | 'over';

/**
 * «Стенка на стенку»: a one-on-one duel on the district ice rink, Mortal
 * Kombat style — best of three rounds, side-on camera, a crowd behind the
 * boards. Player 2 is either a second human or the CPU.
 */
export class VersusMode implements Mode, Arena, AIWorld {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(42, 1, 0.1, 700);
  fighters: Fighter[] = [];
  players: Fighter[] = [];
  grid = null;
  city = null;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  private layer = new THREE.Group();
  private crowd: Body[] = [];
  private center: THREE.Vector3;
  private schemes: Scheme[];
  private wins = [0, 0];
  private round = 1;
  private phase: Phase = 'intro';
  private phaseT = 0;
  private timer = ROUND_TIME;
  private ui = h('div', 'vs-hud');
  private bars: { hp: HTMLElement; lag: HTMLElement; st: HTMLElement; pips: HTMLElement }[] = [];
  private timerEl = h('div', 'vs-timer');
  private banner = h('div', 'vs-banner');
  private camSide = 1;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private paused = false;
  private pauseEl: HTMLElement | null = null;
  private defs: CharacterDef[];

  constructor(private app: App, ids: string[], private cpu: boolean, private onQuit: () => void) {
    const w = app.getWorld();
    this.scene = w.scene;
    this.scene.add(this.layer);
    const c = blockCenter(1, 4);
    this.center = new THREE.Vector3(c.x, 0, c.z);
    this.bounds = { minX: c.x - 19, maxX: c.x + 19, minZ: c.z - 10.5, maxZ: c.z + 10.5 };
    this.schemes = cpu ? ['kbm'] : ['kbm', 'arrows'];
    this.defs = ids.map((id) => CHARACTERS.find((ch) => ch.id === id)!);
    this.defs.forEach((ch, i) => {
      const f = new Fighter({
        body: makeBody(app.assets.characters[ch.model], { hero: true }),
        hp: ch.hp, power: ch.power, speed: ch.speed, special: ch.special,
        team: i === 0 ? 'razezd' : 'hadi', name: ch.nick, charId: ch.id,
      }, this);
      f.data.versus = true;
      f.data.guard = true;
      if (i === 1 && cpu) f.data.brain = new Brain('duel', { x: this.center.x, z: this.center.z }, 0.85);
      this.fighters.push(f);
      this.players.push(f);
      this.layer.add(f.rig.root);
    });
    this.spawnCrowd();
    this.buildHud();
    this.startRound();
    addEventListener('keydown', this.keyHandler);
    sfx.stopMusic();
    sfx.unlock();
    sfx.startMusic(128);
  }

  // ---------- Arena / AIWorld ----------
  onHit(att: Fighter, _vic: Fighter, res: HitResult, hit: HitDef) {
    if (res.blocked) sfx.block();
    else sfx.hit(Math.min(1.5, hit.dmg / 11));
    if (res.knockdown) setTimeout(() => sfx.thud(), 380);
    if (!res.blocked) {
      this.app.freeze(res.knockdown ? 0.1 : 0.05);
      this.shake = Math.max(this.shake, res.knockdown ? 1 : 0.4);
    }
    if (res.ko && this.phase === 'fight') this.endRound(this.players.indexOf(att));
  }
  onWhiff() {
    sfx.whoosh();
  }
  onStep() {
    sfx.step(6);
  }
  bark() {}

  // ---------- Setup ----------
  private spawnCrowd() {
    // Spectators lean on the boards around the rink.
    const c = this.center;
    for (let i = 0; i < 16; i++) {
      const side = i % 4;
      const t = (Math.floor(i / 4) / 3 - 0.5) * (side < 2 ? 34 : 18) + (Math.random() - 0.5) * 3;
      const x = side < 2 ? c.x + t : c.x + (side === 2 ? -23.2 : 23.2);
      const z = side < 2 ? c.z + (side === 0 ? -14 : 14) : c.z + t;
      const spec = civilSpec();
      const b = makeBody(this.app.assets.charactersLod[spec.model], { tint: spec.tint, tintAmt: spec.tintAmt, scale: spec.scale });
      b.root.position.set(x, 0, z);
      b.root.rotation.y = Math.atan2(c.x - x, c.z - z);
      b.anim.play(Math.random() < 0.5 ? 'yes' : 'talk');
      this.layer.add(b.root);
      this.crowd.push(b);
    }
  }

  private buildHud() {
    const top = h('div', 'vs-top');
    this.defs.forEach((ch, i) => {
      const side = h('div', 'vs-side' + (i ? ' right' : ''));
      const por = h('div', 'portrait');
      por.style.backgroundImage = `url(${this.app.portraits[ch.id]})`;
      const col = h('div', 'vs-col');
      const name = h('div', 'vs-name', ch.name === ch.nick ? ch.name : `${ch.name} «${ch.nick}»`);
      const hpw = h('div', 'vs-hp');
      const lag = h('b');
      const hp = h('i');
      hpw.append(lag, hp);
      const stw = h('div', 'vs-st');
      const st = h('i');
      stw.append(st);
      const pips = h('div', 'vs-pips');
      col.append(name, hpw, stw, pips);
      side.append(por, col);
      top.append(side);
      if (i === 0) top.append(this.timerEl);
      this.bars.push({ hp, lag, st, pips });
    });
    this.ui.append(top, this.banner);
    const help = h('div', 'help');
    help.innerHTML = this.cpu
      ? '<b>A/D</b> вперёд-назад · <b>W/S</b> в сторону · <b>J</b> рука · <b>K</b> нога · <b>Q</b> блок · <b>E</b> приём · <b>Пробел</b> уклон'
      : 'Игрок 1: <b>WASD</b> · <b>J K Q E Пробел</b> &nbsp;|&nbsp; Игрок 2: <b>стрелки</b> · <b>, . / ; \'</b> (или NumPad 1–4, 0)';
    this.ui.append(help);
    uiRoot().append(this.ui);
  }

  private startRound() {
    const c = this.center;
    this.players.forEach((f, i) => {
      f.revive();
      f.place(c.x + (i === 0 ? -3.2 : 3.2), c.z, i === 0 ? Math.PI / 2 : -Math.PI / 2);
    });
    this.timer = ROUND_TIME;
    this.phase = 'intro';
    this.phaseT = 0;
    this.say(`РАУНД ${this.round}`, 'gold');
    sfx.confirm();
  }

  private say(text: string, cls = '') {
    this.banner.className = 'vs-banner on ' + cls;
    this.banner.innerHTML = text;
  }

  private endRound(winner: number) {
    this.phase = 'ko';
    this.phaseT = 0;
    if (winner >= 0) this.wins[winner]++;
    this.app.timeScale = 0.35;
    sfx.ko();
    const w = winner >= 0 ? this.defs[winner] : null;
    this.say(winner >= 0 ? 'НОКАУТ!' : 'ВРЕМЯ!', 'red');
    if (w) setTimeout(() => this.players[winner].anim.play('victory'), 900);
  }

  // ---------- Input ----------
  private onKey(e: KeyboardEvent) {
    if (e.code === 'Escape') this.togglePause();
    if (this.phase === 'over' && (e.code === 'Enter' || e.code === 'KeyJ' || e.code === 'Space')) {
      this.wins = [0, 0];
      this.round = 1;
      this.startRound();
    }
  }

  private togglePause() {
    this.paused = !this.paused;
    this.pauseEl?.remove();
    this.pauseEl = null;
    if (!this.paused) return;
    const o = h('div', 'overlay');
    o.append(h('h2', '', 'ПАУЗА'));
    const list = h('div', 'menu-list');
    const mk = (label: string, fn: () => void) => {
      const b = h('button', 'menu-item', label);
      b.onclick = () => {
        sfx.confirm();
        fn();
      };
      b.onmouseenter = () => {
        list.querySelectorAll('.menu-item').forEach((x) => x.classList.remove('active'));
        b.classList.add('active');
      };
      list.append(b);
      return b;
    };
    mk('Продолжить', () => this.togglePause()).classList.add('active');
    mk('Главное меню', () => this.onQuit());
    o.append(list);
    uiRoot().append(o);
    this.pauseEl = o;
  }

  // ---------- Frame ----------
  private shake = 0;
  private camPos = new THREE.Vector3();
  private camLook = new THREE.Vector3();

  update(dt: number) {
    if (this.paused) return;
    const [a, b] = this.players;
    this.phaseT += dt / Math.max(0.2, this.app.timeScale);
    const canFight = this.phase === 'fight';

    if (this.phase === 'intro' && this.phaseT > 1.6) {
      this.phase = 'fight';
      this.say('БЕЙСЯ!', 'red');
      setTimeout(() => this.phase === 'fight' && this.banner.classList.remove('on'), 900);
    }
    if (this.phase === 'fight') {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        const w = a.hp / a.maxHp > b.hp / b.maxHp ? 0 : b.hp / b.maxHp > a.hp / a.maxHp ? 1 : -1;
        this.endRound(w);
      }
    }
    if (this.phase === 'ko' && this.phaseT > 3.2) {
      this.app.timeScale = 1;
      const champ = this.wins.findIndex((w) => w >= WINS_NEEDED);
      if (champ >= 0) {
        this.phase = 'over';
        this.phaseT = 0;
        const d = this.defs[champ];
        const who = this.cpu && champ === 1 ? 'КОМПЬЮТЕР' : this.cpu ? 'ТЫ' : `ИГРОК ${champ + 1}`;
        this.say(`ПОБЕДА: ${d.name.toUpperCase()}<small>${who} · ${d.quotes[1] ?? d.quotes[0]}</small><small>Enter — реванш · Esc — меню</small>`, 'gold');
        this.players[champ].anim.play('victory');
      } else {
        this.round++;
        this.startRound();
      }
    }

    // Camera axes for input: side-on view of the fight.
    const fwd = new THREE.Vector3().subVectors(this.camLook, this.camPos).setY(0).normalize();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    this.players.forEach((f, i) => {
      const o = this.players[1 - i];
      const c = f.ctrl;
      const brain = f.data.brain as Brain | undefined;
      if (brain) {
        if (canFight) brain.update(f, dt, this);
        else Object.assign(c, { mx: 0, mz: 0, speed: 0, punch: false, kick: false, special: false, block: false, dodge: false });
        c.face = Math.atan2(o.x - f.x, o.z - f.z);
      } else {
        const it = readIntent(this.app.input, this.schemes[i], dt);
        const pad = this.app.input.pad(i);
        const use = pad && (Math.abs(pad.axes[0] ?? 0) > 0.2 || pad.buttons.some((x) => x.pressed)) ? readIntent(this.app.input, i === 0 ? 'pad0' : 'pad1', dt) : it;
        c.mx = right.x * use.moveX + fwd.x * use.moveY;
        c.mz = right.z * use.moveX + fwd.z * use.moveY;
        const l = Math.hypot(c.mx, c.mz);
        if (l > 1) {
          c.mx /= l;
          c.mz /= l;
        }
        c.speed = use.run ? 4.5 : 2.8;
        c.punch = canFight && use.punch;
        c.kick = canFight && use.kick;
        c.special = canFight && use.special;
        c.block = canFight && use.block;
        c.dodge = canFight && use.dodge;
        if (!canFight) c.mx = c.mz = 0;
        c.face = Math.atan2(o.x - f.x, o.z - f.z);
      }
    });
    for (const f of this.players) f.update(dt);
    for (const c of this.crowd) {
      c.anim.speed = 0;
      c.anim.update(dt);
      if (!c.anim.current && Math.random() < dt * 0.3) c.anim.play(Math.random() < 0.5 ? 'yes' : 'talk');
    }

    this.updateCamera(dt);
    this.updateHud();
    const w = this.app.getWorld();
    w.env.update(dt, this.center);
    w.city.facadeKit.update(this.phaseT);
  }

  private updateCamera(dt: number) {
    const [a, b] = this.players;
    const mid = new THREE.Vector3((a.x + b.x) / 2, 0, (a.z + b.z) / 2);
    const axis = new THREE.Vector3(b.x - a.x, 0, b.z - a.z);
    const sep = Math.max(1, axis.length());
    axis.normalize();
    const n = new THREE.Vector3(-axis.z, 0, axis.x).multiplyScalar(this.camSide);
    // Stay on the side the camera is already on, so it never whips across.
    const cur = new THREE.Vector3().subVectors(this.camPos, mid).setY(0);
    if (cur.lengthSq() > 1 && cur.dot(n) < 0) {
      this.camSide *= -1;
      n.multiplyScalar(-1);
    }
    const dist = clamp(sep * 0.75 + 4.2, 5.5, 13);
    const want = mid.clone().addScaledVector(n, dist).setY(1.9 + dist * 0.08);
    if (this.camPos.lengthSq() === 0) this.camPos.copy(want);
    this.camPos.x = damp(this.camPos.x, want.x, 5, dt);
    this.camPos.y = damp(this.camPos.y, want.y, 5, dt);
    this.camPos.z = damp(this.camPos.z, want.z, 5, dt);
    this.camLook.set(mid.x, 1.15, mid.z);
    this.camera.position.copy(this.camPos);
    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 3);
      this.camera.position.x += (Math.random() - 0.5) * this.shake * 0.2;
      this.camera.position.y += (Math.random() - 0.5) * this.shake * 0.2;
    }
    this.camera.lookAt(this.camLook);
  }

  private updateHud() {
    this.players.forEach((f, i) => {
      const bar = this.bars[i];
      const k = Math.max(0, f.hp / f.maxHp);
      bar.hp.style.transform = `scaleX(${k})`;
      bar.lag.style.transform = `scaleX(${k})`;
      bar.st.style.transform = `scaleX(${f.stamina / 100})`;
      bar.st.parentElement!.classList.toggle('ready', f.stamina >= ATTACKS[f.special ?? 'flurry'].stamina);
      const pips = '●'.repeat(this.wins[i]) + '<i>' + '●'.repeat(WINS_NEEDED - this.wins[i]) + '</i>';
      if (bar.pips.innerHTML !== pips) bar.pips.innerHTML = pips;
    });
    this.timerEl.textContent = String(Math.ceil(this.timer));
    this.timerEl.classList.toggle('low', this.timer < 10);
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    this.app.timeScale = 1;
    this.scene.remove(this.layer);
    this.ui.remove();
    this.pauseEl?.remove();
    sfx.stopMusic();
  }
}
