import * as THREE from 'three';
import type { FreeRoamMode } from './FreeRoamMode';
import { Fighter, type Team } from '../actors/Fighter';
import { Brain, type Role } from '../actors/ai';
import { callName, charById } from '../actors/characters';
import { gangSpec } from '../actors/looks';
import { makeBody } from '../actors/SkinnedBody';
import { sfx } from '../audio/sfx';
import { h, uiRoot } from '../ui/dom';

interface Line {
  /** Character id (portrait + name) or a plain display name. */
  who: string;
  text: string;
}

interface Step {
  /** Objective shown on screen (a function for live counters). */
  obj?: string | (() => string);
  /** Where to go: a marker, a minimap target and a distance readout. */
  at?: () => { x: number; z: number };
  radius?: number;
  talk?: () => Line[];
  start?: () => void;
  done?: () => boolean;
  /** Reason to fail the mission, checked every frame. */
  fail?: () => string | null;
  timer?: number;
}

interface Mission {
  title: string;
  sub: string;
  start: () => { x: number; z: number };
  steps: () => Step[];
  reward: { money: number; auth: number };
}

interface ActorSpec {
  /** A named character from the roster. */
  id?: string;
  team: Team;
  role: Role;
  name?: string;
  hp: number;
  power?: number;
  skill?: number;
  special?: string;
  /** Gang look for unnamed extras. */
  look?: 'universam' | 'razezd' | 'hadi';
  tint?: number;
  scale?: number;
  /** Keeps looking for a fight anywhere, not only on its own turf. */
  hunt?: boolean;
  /** Sparring partner: allies leave them alone. */
  spar?: boolean;
}

const SAVE = 'sp-story';

/**
 * Story missions on top of the free-roam district: a marker shows where the
 * next one starts, then a list of steps (talk, go somewhere, beat people)
 * runs with an objective line, a minimap target and an optional timer.
 */
export class Story {
  private missions: Mission[];
  private progress = 0;
  private cur: { m: Mission; steps: Step[]; i: number; t: number; timer: number } | null = null;
  private actors: Fighter[] = [];
  private marker: THREE.Group;
  private objEl = h('div', 'mission-obj hidden');
  private dlgEl = h('div', 'dlg hidden');
  private dlg: { lines: Line[]; i: number; t: number } | null = null;
  private cooldown = 0;
  private keyHandler = (e: KeyboardEvent) => {
    if (this.dlg && (e.code === 'Enter' || e.code === 'NumpadEnter')) this.nextLine();
  };

  constructor(private m: FreeRoamMode, private playerId: string) {
    try {
      this.progress = Math.max(0, Math.min(3, Number(localStorage.getItem(SAVE)) || 0));
    } catch {
      this.progress = 0;
    }
    this.missions = [this.joinUp(), this.videoSalon(), this.rink()];
    this.marker = this.makeMarker();
    m.scene.add(this.marker);
    uiRoot().append(this.objEl, this.dlgEl);
    this.dlgEl.onclick = () => this.nextLine();
    addEventListener('keydown', this.keyHandler);
    if (this.progress < this.missions.length) {
      const ms = this.missions[this.progress];
      setTimeout(() => m.hud.notice('СЮЖЕТ', `Миссия ${this.progress + 1}: «${ms.title}» — иди к жёлтому маркеру`, 4), 3800);
    }
  }

  get active() {
    return !!this.cur;
  }

  // ---------- helpers ----------
  private get pn() {
    return callName(charById(this.playerId));
  }

  /** A point near a landmark, nudged out of any building. */
  private place(name: string, dx = 0, dz = 0) {
    const l = this.m.city.landmarks.find((x) => x.name === name)!;
    return this.free(l.x + dx, l.z + dz);
  }

  private free(x: number, z: number) {
    for (let k = 0; k < 4; k++) [x, z] = this.m.grid.resolveCircle(x, z, 1.2);
    return { x, z };
  }

  private has(id: string) {
    return id !== this.playerId && !!this.m.app.assets.characters[charById(id).model];
  }

  /** First available story character from a preference list. */
  private cast(prefs: string[], not = '') {
    const ok = (id: string) => id !== not && this.has(id);
    return prefs.find(ok) ?? ['adidas', 'kashchey', 'palto', 'turbo', 'zima'].find(ok) ?? 'kashchey';
  }

  private spawn(s: ActorSpec, x: number, z: number, home = { x, z }) {
    const app = this.m.app;
    let body;
    let name = s.name ?? '';
    let special = s.special ?? null;
    if (s.id) {
      const ch = charById(s.id);
      body = makeBody(app.assets.characters[ch.model], { hero: true });
      name = name || callName(ch);
      special = special ?? ch.special;
    } else {
      const spec = gangSpec(s.look ?? (s.team === 'hadi' ? 'hadi' : s.team === 'razezd' ? 'razezd' : 'universam'));
      body = makeBody(app.assets.charactersLod[spec.model], { tint: s.tint ?? spec.tint, tintAmt: spec.tintAmt, scale: s.scale ?? spec.scale });
    }
    const f = new Fighter({ body, hp: s.hp, power: s.power ?? 0.85, speed: 1, special: special ?? undefined, team: s.team, name, charId: s.id }, this.m);
    f.place(x, z, Math.atan2(this.m.players[0].x - x, this.m.players[0].z - z));
    const b = new Brain(s.role, home, s.skill ?? 0.45);
    b.hunt = !!s.hunt;
    f.data.brain = b;
    if (s.spar) f.data.spar = true;
    f.data.story = true;
    this.m.addFighter(f);
    this.actors.push(f);
    return f;
  }

  private attack(f: Fighter, target: Fighter) {
    (f.data.brain as Brain).engage(f, target, this.m, false);
  }

  /** Spawn a ring of enemies around (x, z) that go straight for the player. */
  private wave(n: number, x: number, z: number, spec: Omit<ActorSpec, 'hp'> & { hp?: number }, names: string[]) {
    const out: Fighter[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const at = this.free(x + Math.cos(a) * 2.5, z + Math.sin(a) * 2.5);
      const f = this.spawn({ hp: 60, ...spec, name: names[i % names.length], hunt: true }, at.x, at.z);
      this.attack(f, this.m.players[0]);
      out.push(f);
    }
    return out;
  }

  private clear() {
    for (const f of this.actors) this.m.removeFighter(f);
    this.actors = [];
  }

  private makeMarker() {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: 0xffc83a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 7, 24, 1, true), mat);
    beam.position.y = 3.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.35, 40), mat.clone());
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.9;
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.06;
    const light = new THREE.PointLight(0xffb030, 6, 10, 1.6);
    light.position.y = 1.5;
    g.add(beam, ring, light);
    g.visible = false;
    return g;
  }

  // ---------- dialogue ----------
  private say(lines: Line[]) {
    this.dlg = { lines, i: 0, t: 0 };
    this.showLine();
  }

  private showLine() {
    const d = this.dlg!;
    const l = d.lines[d.i];
    const ch = charById(l.who === 'me' ? this.playerId : l.who) as ReturnType<typeof charById> | undefined;
    const name = ch ? callName(ch) : l.who;
    const pid = l.who === 'me' ? this.playerId : l.who;
    const por = this.m.app.portraits[pid];
    this.dlgEl.innerHTML = `<div class="dp"${por ? ` style="background-image:url(${por})"` : ''}>${por ? '' : name[0]}</div><div class="dt"><b>${name}</b>${l.text}<small>Enter — дальше</small></div>`;
    this.dlgEl.classList.remove('hidden');
    sfx.ui();
  }

  private nextLine() {
    const d = this.dlg;
    if (!d) return;
    d.i++;
    d.t = 0;
    if (d.i >= d.lines.length) {
      this.dlg = null;
      this.dlgEl.classList.add('hidden');
    } else this.showLine();
  }

  // ---------- flow ----------
  private begin(m: Mission) {
    this.cur = { m, steps: m.steps(), i: -1, t: 0, timer: 0 };
    this.marker.visible = false;
    sfx.confirm();
    this.m.hud.notice(m.title.toUpperCase(), m.sub, 3);
    this.nextStep();
  }

  private nextStep() {
    const c = this.cur!;
    c.i++;
    c.t = 0;
    if (c.i >= c.steps.length) return this.complete();
    const s = c.steps[c.i];
    c.timer = s.timer ?? 0;
    s.start?.();
    if (s.talk) this.say(s.talk());
  }

  private complete() {
    const c = this.cur!;
    this.m.money += c.m.reward.money;
    this.m.authority += c.m.reward.auth;
    this.progress++;
    try {
      localStorage.setItem(SAVE, String(this.progress));
    } catch {
      /* no storage */
    }
    sfx.ko();
    const last = this.progress >= this.missions.length;
    this.m.hud.notice('МИССИЯ ПРОЙДЕНА', `«${c.m.title}» · +${c.m.reward.money} ₽ · +${c.m.reward.auth} авторитета`, 4);
    if (last) setTimeout(() => this.m.hud.notice('СЮЖЕТ ПРОЙДЕН', 'Район держит слово. Продолжение следует…', 5), 4200);
    this.cur = null;
    this.objEl.classList.add('hidden');
    this.m.hud.target = null;
    // Let the survivors hang around a bit, then tidy up.
    const done = this.actors;
    this.actors = [];
    setTimeout(() => done.forEach((f) => this.m.removeFighter(f)), 20000);
    this.cooldown = 6;
  }

  fail(reason: string) {
    if (!this.cur) return;
    sfx.ko();
    this.m.hud.notice('МИССИЯ ПРОВАЛЕНА', reason, 4);
    this.cur = null;
    this.dlg = null;
    this.dlgEl.classList.add('hidden');
    this.objEl.classList.add('hidden');
    this.m.hud.target = null;
    this.clear();
    this.cooldown = 6;
  }

  /** The player got knocked out or arrested. */
  onWasted() {
    this.fail('Тебя отшили. Попробуй ещё раз.');
  }

  update(dt: number) {
    const p = this.m.players[0];
    this.cooldown -= dt;
    if (this.dlg) {
      const d = this.dlg;
      d.t += dt;
      if (d.t > Math.max(2.8, d.lines[d.i].text.length * 0.06)) this.nextLine();
    }
    if (!this.cur) {
      const next = this.missions[this.progress];
      this.marker.visible = !!next;
      if (!next) return;
      const at = next.start();
      this.marker.position.set(at.x, 0, at.z);
      this.marker.rotation.y += dt;
      this.m.hud.target = at;
      if (this.cooldown <= 0 && p.alive && !this.m.streets.playerCar && Math.hypot(p.x - at.x, p.z - at.z) < 1.8) this.begin(next);
      else if (Math.hypot(p.x - at.x, p.z - at.z) < 8) this.m.hud.prompt(`Миссия ${this.progress + 1}: <b>«${next.title}»</b> — встань в круг`);
      return;
    }
    const c = this.cur;
    const s = c.steps[c.i];
    c.t += dt;
    const why = s.fail?.();
    if (why) return this.fail(why);
    if (s.timer) {
      c.timer -= dt;
      if (c.timer <= 0) return this.fail('Не успел.');
    }
    // Objective line.
    const obj = typeof s.obj === 'function' ? s.obj() : s.obj;
    let text = obj ?? '';
    if (s.at) {
      const at = s.at();
      const d = Math.hypot(p.x - at.x, p.z - at.z);
      this.marker.visible = true;
      this.marker.position.set(at.x, 0, at.z);
      this.marker.rotation.y += dt;
      this.m.hud.target = at;
      text += ` <i>${Math.round(d)} м</i>`;
    } else {
      this.marker.visible = false;
      this.m.hud.target = null;
    }
    if (s.timer) text += ` <em>${Math.floor(c.timer / 60)}:${String(Math.floor(c.timer % 60)).padStart(2, '0')}</em>`;
    this.objEl.classList.toggle('hidden', !text || !!this.dlg);
    if (text && this.objEl.innerHTML !== text) this.objEl.innerHTML = text;

    // Step completion.
    if (s.talk) {
      if (!this.dlg) this.nextStep();
      return;
    }
    if (s.at) {
      const at = s.at();
      if (Math.hypot(p.x - at.x, p.z - at.z) < (s.radius ?? 2.5) && (!s.done || s.done())) this.nextStep();
      return;
    }
    if (s.done?.()) this.nextStep();
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    this.clear();
    this.m.scene.remove(this.marker);
    this.objEl.remove();
    this.dlgEl.remove();
  }

  // ---------- the missions ----------
  private alive(list: Fighter[]) {
    return list.filter((f) => f.alive).length;
  }

  /** 1. «Пришиться»: prove yourself to the Universam and get to the gathering in time. */
  private joinUp(): Mission {
    let giver = '';
    let spar: Fighter[] = [];
    let boss: Fighter | null = null;
    return {
      title: 'Пришиться',
      sub: 'Миссия 1 · Школьный двор',
      start: () => this.place('Школа', 14, 16),
      reward: { money: 50, auth: 20 },
      steps: () => {
        giver = this.cast(['adidas', 'kashchey', 'turbo']);
        const school = this.place('Школа', 14, 16);
        return [
          {
            start: () => {
              boss = this.spawn({ id: giver, team: 'universam', role: 'ally', hp: 160, skill: 0.7 }, school.x + 2.5, school.z + 1.5);
            },
            talk: () => [
              { who: giver, text: `Слышь, ${this.pn}. Говорят, к Универсаму пришиться хочешь?` },
              { who: 'me', text: 'Хочу.' },
              { who: giver, text: 'Пацаном не рождаются. Вон скорлупа — покажи, что ты не чушпан.' },
              { who: giver, text: 'По-честному, без ножей и без толпы. Давай.' },
            ],
          },
          {
            start: () => {
              spar = [0, 1].map((i) => {
                const at = this.free(school.x - 5 + i * 2, school.z - 4);
                const f = this.spawn({ team: 'razezd', role: 'gang', look: 'universam', name: i ? 'Скорлупа' : 'Мелкий', hp: 55, power: 0.7, skill: 0.35, spar: true, hunt: true }, at.x, at.z);
                this.attack(f, this.m.players[0]);
                return f;
              });
            },
            obj: () => `Победи скорлупу: ${2 - this.alive(spar)}/2`,
            done: () => this.alive(spar) === 0,
          },
          {
            talk: () => [
              { who: giver, text: 'Нормально. Теперь ты с нами.' },
              { who: giver, text: 'Запомни: пацаны не извиняются и своих не бросают. Слово пацана — закон.' },
              { who: giver, text: 'Сегодня сбор у качалки. Опоздаешь — можешь не приходить.' },
            ],
          },
          {
            start: () => {
              const gym = this.place('Качалка', 0, 3);
              if (boss) {
                boss.place(gym.x + 2, gym.z, 0);
                (boss.data.brain as Brain).home = { x: gym.x + 2, z: gym.z };
              }
              for (let i = 0; i < 3; i++) {
                const at = this.free(gym.x - 2 + i * 1.5, gym.z + 2.5);
                this.spawn({ team: 'universam', role: 'ally', look: 'universam', name: ['Сява', 'Лампа', 'Ералаш'][i], hp: 90 }, at.x, at.z);
              }
            },
            obj: 'Доберись до качалки к началу сбора',
            at: () => this.place('Качалка', 0, 3),
            radius: 4,
            timer: 110,
          },
          {
            talk: () => [
              { who: giver, text: 'Все в сборе. Пацаны, это ' + this.pn + '. Теперь он с нами.' },
              { who: 'Пацаны', text: 'Универсам!' },
              { who: giver, text: 'Завтра будет работа. Отдыхай.' },
            ],
          },
        ];
      },
    };
  }

  /** 2. «Видеосалон»: two waves of Razyezd and their leader. */
  private videoSalon(): Mission {
    let giver = '';
    let w1: Fighter[] = [];
    let w2: Fighter[] = [];
    return {
      title: 'Видеосалон',
      sub: 'Миссия 2 · Разъезд',
      start: () => this.place('Видеосалон', -2, 4),
      reward: { money: 120, auth: 30 },
      steps: () => {
        giver = this.cast(['turbo', 'zima', 'kashchey', 'adidas']);
        const second = this.cast(['zima', 'adidas', 'kashchey'], giver);
        const hall = this.place('Видеосалон', -2, 4);
        return [
          {
            start: () => {
              for (const [id, dx] of [[giver, 2], [second, -2]] as const) this.spawn({ id, team: 'universam', role: 'ally', hp: 140, skill: 0.6 }, hall.x + dx, hall.z + 1.5);
            },
            talk: () => [
              { who: giver, text: `${this.pn}, разъездовские наехали на видеосалон. Хозяин платит нам — значит, мы его и защищаем.` },
              { who: second, text: 'Идут. Человек пять, не меньше.' },
              { who: giver, text: 'Встречаем. Никто не бежит.' },
            ],
          },
          {
            start: () => {
              w1 = this.wave(3, hall.x - 16, hall.z + 10, { team: 'razezd', role: 'gang', hp: 65, skill: 0.45 }, ['Шмыга', 'Рыжий', 'Батон']);
              for (const f of this.actors) if (f.team === 'universam') this.attack(f, w1[0]);
            },
            obj: () => `Отбейся от разъездовских · волна 1/2 · осталось ${this.alive(w1)}`,
            done: () => this.alive(w1) === 0,
          },
          {
            talk: () => [
              { who: second, text: 'Это ещё не всё! Сам Жёлтый идёт.' },
            ],
          },
          {
            start: () => {
              w2 = this.wave(3, hall.x + 14, hall.z + 12, { team: 'razezd', role: 'gang', hp: 70, skill: 0.5 }, ['Косой', 'Гвоздь', 'Сухой']);
              const boss = this.spawn({ team: 'razezd', role: 'gang', name: 'Жёлтый', hp: 170, power: 1.1, skill: 0.75, special: 'haymaker', tint: 0xb8a020, scale: 1.06, hunt: true }, hall.x + 15, hall.z + 9);
              this.attack(boss, this.m.players[0]);
              w2.push(boss);
              for (const f of this.actors) if (f.team === 'universam' && f.alive) this.attack(f, w2[0]);
            },
            obj: () => `Отбейся от разъездовских · волна 2/2 · осталось ${this.alive(w2)}`,
            done: () => this.alive(w2) === 0,
          },
          {
            talk: () => [
              { who: giver, text: 'Вот так. Видеосалон наш.' },
              { who: 'Хозяин салона', text: 'Спасибо, пацаны! Вот, за защиту. И приходите на «Рэмбо» бесплатно.' },
            ],
          },
        ];
      },
    };
  }

  /** 3. «Каток»: race across the district and get a mate out of a Hadi Taktash ambush. */
  private rink(): Mission {
    let giver = '';
    let victimId = '';
    let victim: Fighter | null = null;
    let hadi: Fighter[] = [];
    return {
      title: 'Каток',
      sub: 'Миссия 3 · Хадишевские',
      start: () => this.place('Универсам', 6, 12),
      reward: { money: 200, auth: 50 },
      steps: () => {
        giver = this.cast(['zima', 'turbo', 'adidas', 'kashchey']);
        victimId = this.cast(['marat', 'palto']);
        const vName = callName(charById(victimId));
        const rink = this.place('Каток');
        return [
          {
            talk: () => [
              { who: giver, text: `${this.pn}! Хадишевские зажали ${vName} на катке!` },
              { who: giver, text: 'Бери любую тачку и гони туда. Минута — и будет поздно!' },
            ],
          },
          {
            obj: 'Гони на каток! <small>F — сесть в машину</small>',
            at: () => rink,
            radius: 16,
            timer: 80,
          },
          {
            start: () => {
              victim = this.spawn({ id: victimId, team: 'universam', role: 'ally', hp: 130, skill: 0.5 }, rink.x, rink.z);
              hadi = this.wave(4, rink.x, rink.z, { team: 'hadi', role: 'gang', hp: 70, skill: 0.5 }, ['Тахир', 'Ринат', 'Ильдар', 'Марс']);
              const boss = this.spawn({ team: 'hadi', role: 'gang', name: 'Хади-старший', hp: 190, power: 1.15, skill: 0.8, special: 'flurry', tint: 0x5a3a1a, scale: 1.08, hunt: true }, rink.x + 4, rink.z + 3);
              hadi.push(boss);
              for (const f of hadi.slice(0, 3)) this.attack(f, victim);
              this.attack(boss, this.m.players[0]);
              this.attack(victim, hadi[0]);
            },
            obj: () => `Выручай ${vName}! Хадишевских осталось: ${this.alive(hadi)}`,
            done: () => this.alive(hadi) === 0,
            fail: () => (victim && !victim.alive ? `${vName} отшили. Не успел.` : null),
          },
          {
            talk: () => [
              { who: victimId, text: 'Спасибо… Я думал — всё, конец.' },
              { who: 'me', text: 'Своих не бросаем.' },
              { who: victimId, text: 'Хадишевские этого так не оставят. Но сегодня каток — наш.' },
            ],
          },
        ];
      },
    };
  }
}
