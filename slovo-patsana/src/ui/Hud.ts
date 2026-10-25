import * as THREE from 'three';
import { h, uiRoot } from './dom';
import type { Fighter } from '../actors/Fighter';
import { HALF, ZONE_COLORS, ZONE_NAMES, zoneOfBlock, N, PITCH, ROAD, type City, type Zone } from '../world/City';

interface Floating {
  el: HTMLElement;
  pos: THREE.Vector3;
  follow?: Fighter;
  t: number;
  life: number;
  rise: number;
}

/** Player panels, money/authority, minimap, floating name tags, speech bubbles and damage numbers. */
export class Hud {
  root = h('div', 'hud');
  private panels: { el: HTMLElement; hp: HTMLElement; hpLag: HTMLElement; st: HTMLElement; stWrap: HTMLElement }[] = [];
  private money = h('div', 'money');
  private auth = h('div', 'auth');
  private zone = h('div', 'zone');
  private stats = h('div', 'stats');
  private noticeEl = h('div', 'notice');
  private toastEl = h('div', 'toast');
  private help = h('div', 'help');
  private stars = h('div', 'stars');
  private speedo = h('div', 'speedo hidden');
  private promptEl = h('div', 'prompt hidden');
  private mm: HTMLCanvasElement | null = null;
  private mmBase: HTMLCanvasElement | null = null;
  private tags = new Map<Fighter, { el: HTMLElement; bar: HTMLElement }>();
  private floats: Floating[] = [];
  private noticeT = 0;
  private toastT = 0;
  private v = new THREE.Vector3();

  constructor(players: { f: Fighter; portrait: string; title: string }[], city: City | null) {
    players.forEach((p, i) => {
      const el = h('div', 'pl' + (i === 1 ? ' p2' : ''));
      const por = h('div', 'portrait');
      por.style.backgroundImage = `url(${p.portrait})`;
      const col = h('div');
      col.append(h('div', 'nm', p.title));
      const hpw = h('div', 'hp');
      const hpLag = h('b');
      const hp = h('i');
      hpw.append(hpLag, hp);
      const stWrap = h('div', 'st');
      const st = h('i');
      stWrap.append(st);
      col.append(hpw, stWrap);
      el.append(por, col);
      this.root.append(el);
      this.panels.push({ el, hp, hpLag, st, stWrap });
    });
    if (city) {
      this.stats.append(this.stars, this.money, this.auth, h('br'), this.zone);
      this.root.append(this.speedo, this.promptEl);
      this.root.append(this.stats);
      this.mm = h('canvas', 'minimap');
      this.mm.width = this.mm.height = 210;
      this.root.append(this.mm);
      this.mmBase = this.drawBaseMap(city);
      this.help.innerHTML = '<b>WASD</b> ходить · <b>Shift</b> бег · <b>ЛКМ/J</b> рука · <b>ПКМ/K</b> нога<br><b>Q</b> блок · <b>E</b> приём · <b>Пробел</b> уклон · <b>F</b> машина · <b>Esc</b> пауза';
      this.root.append(this.help);
    }
    this.root.append(this.noticeEl, this.toastEl);
    uiRoot().append(this.root);
  }

  private scale = 1.25; // minimap px per metre
  private landmarks: City['landmarks'] = [];
  private drawBaseMap(city: City) {
    const size = Math.ceil(HALF * 2 * this.scale) + 40;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d')!;
    const tx = (x: number) => (x + HALF) * this.scale + 20;
    g.fillStyle = '#1c2029';
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N; j++) {
        const z = zoneOfBlock(i, j);
        g.fillStyle = ZONE_COLORS[z] + '33';
        g.fillRect(tx(-HALF + ROAD / 2 + i * PITCH), tx(-HALF + ROAD / 2 + j * PITCH), (PITCH - ROAD) * this.scale, (PITCH - ROAD) * this.scale);
      }
    g.fillStyle = '#5b606b';
    for (let k = 0; k <= N; k++) {
      const c0 = -HALF + k * PITCH;
      g.fillRect(tx(c0 - ROAD / 2), tx(-HALF - ROAD / 2), ROAD * this.scale, (HALF * 2 + ROAD) * this.scale);
      g.fillRect(tx(-HALF - ROAD / 2), tx(c0 - ROAD / 2), (HALF * 2 + ROAD) * this.scale, ROAD * this.scale);
    }
    g.fillStyle = '#9aa0ab';
    for (const b of city.boxes) {
      if (b.h < 2 || b.maxX - b.minX > 60 && b.h > 25) continue;
      g.fillRect(tx(b.minX), tx(b.minZ), (b.maxX - b.minX) * this.scale, (b.maxZ - b.minZ) * this.scale);
    }
    this.landmarks = city.landmarks;
    return c;
  }

  notice(text: string, sub = '', time = 2.2) {
    this.noticeEl.innerHTML = text + (sub ? `<small>${sub}</small>` : '');
    this.noticeEl.classList.add('on');
    this.noticeT = time;
  }

  toast(text: string, time = 3) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = time;
  }

  bubble(f: Fighter, text: string) {
    const el = h('div', 'bubble');
    el.textContent = text;
    this.root.append(el);
    this.floats.push({ el, pos: new THREE.Vector3(), follow: f, t: 0, life: 2.6, rise: 0 });
  }

  damage(f: Fighter, amount: number, blocked: boolean) {
    const el = h('div', 'dmg' + (blocked ? ' blk' : ''));
    el.textContent = blocked ? 'блок' : String(Math.round(amount));
    this.root.append(el);
    this.floats.push({ el, pos: new THREE.Vector3(f.x + (Math.random() - 0.5) * 0.4, 1.9, f.z), t: 0, life: 0.8, rise: 1.2 });
  }

  setWanted(n: number, flash: boolean) {
    const html = '★'.repeat(n) + '<i>' + '★'.repeat(3 - n) + '</i>';
    if (this.stars.innerHTML !== html) this.stars.innerHTML = html;
    this.stars.classList.toggle('flash', flash && n > 0);
  }

  setSpeed(kmh: number | null) {
    this.speedo.classList.toggle('hidden', kmh === null);
    if (kmh !== null) this.speedo.innerHTML = `${Math.round(kmh)}<small>км/ч</small>`;
  }

  prompt(text: string | null) {
    this.promptEl.classList.toggle('hidden', !text);
    if (text && this.promptEl.innerHTML !== text) this.promptEl.innerHTML = text;
  }

  setStats(money: number, auth: number, zone: Zone) {
    this.money.textContent = `${money} ₽`;
    this.auth.textContent = `Авторитет: ${auth}`;
    this.zone.textContent = 'Район: ' + ZONE_NAMES[zone];
    this.zone.style.borderRightColor = ZONE_COLORS[zone];
  }

  update(dt: number, cam: THREE.Camera, players: Fighter[], others: Fighter[], camYaw: number, specialCost: number[]) {
    players.forEach((p, i) => {
      const pn = this.panels[i];
      if (!pn) return;
      const k = Math.max(0, p.hp / p.maxHp);
      pn.hp.style.transform = `scaleX(${k})`;
      pn.hpLag.style.transform = `scaleX(${k})`;
      pn.st.style.transform = `scaleX(${p.stamina / 100})`;
      pn.stWrap.classList.toggle('ready', p.stamina >= (specialCost[i] ?? 100));
    });
    if (this.noticeT > 0 && (this.noticeT -= dt) <= 0) this.noticeEl.classList.remove('on');
    if (this.toastT > 0 && (this.toastT -= dt) <= 0) this.toastEl.classList.remove('on');

    const W = innerWidth, H = innerHeight;
    const project = (x: number, y: number, z: number) => {
      this.v.set(x, y, z).project(cam);
      return { x: (this.v.x * 0.5 + 0.5) * W, y: (-this.v.y * 0.5 + 0.5) * H, vis: this.v.z < 1 && this.v.z > -1 };
    };

    // Name tags with health for anyone recently in a fight.
    const p0 = players[0];
    const seen = new Set<Fighter>();
    for (const f of others) {
      const aggro = (f.data.brain as { mode?: string } | undefined)?.mode === 'fight';
      if (!f.alive || (f.sinceCombat > 6 && !aggro) || Math.hypot(f.x - p0.x, f.z - p0.z) > 26) continue;
      const s = project(f.x, 2.15, f.z);
      if (!s.vis) continue;
      seen.add(f);
      let t = this.tags.get(f);
      if (!t) {
        const el = h('div', 'tag3d');
        const n = h('div', 'n', f.name);
        n.style.color = f.team === 'universam' ? '#9fe09a' : f.team === 'civil' ? '#ddd' : '#ff8a80';
        const hb = h('div', 'hb');
        const bar = h('i');
        hb.append(bar);
        el.append(n, hb);
        this.root.append(el);
        this.tags.set(f, (t = { el, bar }));
      }
      t.el.style.left = s.x + 'px';
      t.el.style.top = s.y + 'px';
      t.bar.style.transform = `scaleX(${Math.max(0, f.hp / f.maxHp)})`;
    }
    for (const [f, t] of this.tags)
      if (!seen.has(f)) {
        t.el.remove();
        this.tags.delete(f);
      }

    this.floats = this.floats.filter((fl) => {
      fl.t += dt;
      if (fl.t > fl.life || (fl.follow && !fl.follow.rig.root.parent)) {
        fl.el.remove();
        return false;
      }
      const p = fl.follow ? { x: fl.follow.x, y: 2.5, z: fl.follow.z } : { x: fl.pos.x, y: fl.pos.y + fl.t * fl.rise, z: fl.pos.z };
      const s = project(p.x, p.y, p.z);
      fl.el.style.display = s.vis ? '' : 'none';
      fl.el.style.left = s.x + 'px';
      fl.el.style.top = s.y + 'px';
      fl.el.style.opacity = String(Math.min(1, (fl.life - fl.t) * 3));
      return true;
    });

    if (this.mm && this.mmBase) this.drawMinimap(p0, others, camYaw);
  }

  /** Extra blips (police cars) drawn as squares: [x, z, colour]. */
  blips: [number, number, string][] = [];

  private drawMinimap(p: Fighter, others: Fighter[], yaw: number) {
    const g = this.mm!.getContext('2d')!;
    const S = 210;
    const sc = this.scale;
    g.save();
    g.fillStyle = '#111';
    g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    // Rotate so "up" on the map is the camera's forward direction.
    g.rotate(yaw);
    g.drawImage(this.mmBase!, -((p.x + HALF) * sc + 20), -((p.z + HALF) * sc + 20));
    for (const o of others) {
      if (!o.alive) continue;
      const dx = (o.x - p.x) * sc, dz = (o.z - p.z) * sc;
      if (dx * dx + dz * dz > 110 * 110) continue;
      const hostile = o.team === 'razezd' || o.team === 'hadi';
      if (!hostile && o.team === 'civil') continue;
      g.fillStyle = o.team === 'police' ? '#5aa0ff' : hostile ? (o.sinceCombat < 6 ? '#ff3030' : ZONE_COLORS[o.team as Zone]) : '#6fe06a';
      g.beginPath();
      g.arc(dx, dz, hostile && o.sinceCombat < 6 ? 4 : 3, 0, Math.PI * 2);
      g.fill();
    }
    for (const [bx, bz, col] of this.blips) {
      const dx = (bx - p.x) * sc, dz = (bz - p.z) * sc;
      if (dx * dx + dz * dz > 110 * 110) continue;
      g.fillStyle = col;
      g.fillRect(dx - 4, dz - 4, 8, 8);
    }
    g.restore();
    // Landmark labels stay upright while the map turns underneath them.
    g.font = 'bold 13px "PT Sans Narrow", Arial';
    g.textAlign = 'center';
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    for (const l of this.landmarks) {
      const dx = (l.x - p.x) * sc, dz = (l.z - p.z) * sc;
      const x = S / 2 + dx * cs - dz * sn, y = S / 2 + dx * sn + dz * cs;
      if (x < -40 || x > S + 40 || y < 0 || y > S + 10) continue;
      g.fillStyle = '#000';
      g.fillText(l.name, x + 1, y + 1);
      g.fillStyle = '#ffe9a8';
      g.fillText(l.name, x, y);
    }
    // Player arrow (always points up, since the map rotates).
    g.save();
    g.translate(S / 2, S / 2);
    g.rotate(-(p.heading - yaw) + Math.PI);
    g.fillStyle = '#fff';
    g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(0, -8);
    g.lineTo(6, 7);
    g.lineTo(0, 3);
    g.lineTo(-6, 7);
    g.closePath();
    g.fill();
    g.stroke();
    g.restore();
    g.fillStyle = '#fff';
    g.font = 'bold 14px Arial';
    g.textAlign = 'center';
    g.fillText('С', S / 2 + Math.sin(yaw) * 92, S / 2 - Math.cos(yaw) * 92 + 5);
  }

  dispose() {
    this.root.remove();
  }
}
