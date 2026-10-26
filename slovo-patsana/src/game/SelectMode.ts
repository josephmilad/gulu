import * as THREE from 'three';
import type { App, Mode } from './App';
import { h, uiRoot } from '../ui/dom';
import { sfx } from '../audio/sfx';
import { ROSTER, SPECIALS, fullTitle, saveBonus, type CharacterDef } from '../actors/characters';
import { makeBody, type Body } from '../actors/SkinnedBody';
import { Environment } from '../world/Environment';
import { pbrMaterial } from '../core/assets';
import { damp } from '../core/math';

interface Cursor {
  idx: number;
  locked: boolean;
  info: HTMLElement;
  /** Stage slot x and the rig standing there. */
  x: number;
  rig: Body | null;
  rigId: string;
  spot: THREE.SpotLight;
  /** Highlighted row in the bonus-fighter editor. */
  row: number;
}

const STAT_ROWS = [['power', 'Сила'], ['speed', 'Скорость'], ['health', 'Здоровье'], ['technique', 'Техника']] as const;
const SPECIAL_IDS = Object.keys(SPECIALS);

/**
 * Mortal Kombat-style select: the highlighted fighter steps onto a snowy stage
 * under a spotlight, portraits run along the bottom. Bonus fighters get an
 * editor for their name, stats and special.
 * Player 1: A/D + J/Enter, W/S + Q/E to edit. Player 2: ←/→ + Enter, ↑/↓ + [/] to edit.
 */
export class SelectMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private root = h('div', 'select');
  private cards: HTMLElement[] = [];
  private cursors: Cursor[] = [];
  private env: Environment;
  private done = false;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private t = 0;
  private rigCache = new Map<string, Body>();

  constructor(private app: App, private players: 1 | 2, private onDone: (ids: string[]) => void, private onBack: () => void) {
    this.env = new Environment(this.scene, app.envMap);
    this.scene.fog = new THREE.Fog(0x1a0d12, 12, 60);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), pbrMaterial(app.assets.tex.snow_01, 12, 12));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);
    // A wall of panel-block silhouettes behind the stage.
    const backMat = new THREE.MeshStandardMaterial({ color: 0x1c1f2a, emissive: 0x2a1015, emissiveIntensity: 0.4 });
    for (let k = -4; k <= 4; k++) {
      const hgt = 10 + ((k * 7919) % 5 + 5) * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(9, hgt, 6), backMat);
      b.position.set(k * 10, hgt / 2, -22 - Math.abs(k) * 2);
      this.scene.add(b);
    }
    const fill = new THREE.DirectionalLight(0xc8d4ff, 1.4);
    fill.position.set(0, 3, 8);
    this.scene.add(fill);
    this.camera.position.set(0, 1.7, 6.4);
    this.camera.lookAt(0, 1.1, 0);

    this.root.append(h('h2', '', players === 2 ? 'ВЫБЕРИТЕ ПАЦАНОВ' : 'ВЫБЕРИ ПАЦАНА'));
    const mid = h('div', 'select-mid');
    const info1 = h('div', 'info');
    const info2 = h('div', 'info p2');
    mid.append(info1, players === 2 ? info2 : h('div'));
    this.root.append(mid);
    const bottom = h('div');
    const roster = h('div', 'roster' + (ROSTER.length > 6 ? ' many' : ''));
    ROSTER.forEach((ch, i) => {
      const c = h('div', 'card' + (ch.custom ? ' bonus' : ''));
      c.style.backgroundImage = `url(${this.app.portraits[ch.id]})`;
      c.append(h('div', 'lbl', fullTitle(ch)));
      c.onmouseenter = () => !this.cursors[0].locked && this.move(0, i - this.cursors[0].idx);
      c.onclick = () => {
        this.move(0, i - this.cursors[0].idx);
        this.confirm(0);
      };
      roster.append(c);
      this.cards.push(c);
    });
    bottom.append(roster);
    bottom.append(h('div', 'hint', players === 2
      ? 'Игрок 1: <kbd>A</kbd>/<kbd>D</kbd> + <kbd>J</kbd> &nbsp;·&nbsp; Игрок 2: <kbd>←</kbd>/<kbd>→</kbd> + <kbd>Enter</kbd> &nbsp;·&nbsp; бонус: <kbd>W</kbd>/<kbd>S</kbd> <kbd>Q</kbd>/<kbd>E</kbd> или мышь &nbsp;·&nbsp; <kbd>Esc</kbd> назад'
      : '<kbd>A</kbd>/<kbd>D</kbd> — выбор &nbsp;·&nbsp; <kbd>Enter</kbd>/<kbd>J</kbd> — подтвердить &nbsp;·&nbsp; бонус: <kbd>W</kbd>/<kbd>S</kbd> строка, <kbd>Q</kbd>/<kbd>E</kbd> −/+ или мышь &nbsp;·&nbsp; <kbd>Esc</kbd> назад'));
    this.root.append(bottom);
    uiRoot().append(this.root);
    const slots = players === 2 ? [-1.25, 1.25] : [1.1];
    slots.forEach((x, p) => {
      const spot = new THREE.SpotLight(p === 0 ? 0xffe8d0 : 0xd0e0ff, 45, 18, 0.34, 0.6, 1.2);
      spot.position.set(x, 9, 5);
      spot.target.position.set(x, 0, 0.6);
      spot.castShadow = true;
      this.scene.add(spot, spot.target);
      this.cursors.push({ idx: Math.min(p, ROSTER.length - 1), locked: false, info: p === 0 ? info1 : info2, x, rig: null, rigId: '', spot, row: 0 });
    });
    this.refresh();
    addEventListener('keydown', this.keyHandler);
  }

  private infoHtml(ch: CharacterDef, cur: Cursor) {
    const st = (label: string, v: number) => `<div class="stat"><span>${label}</span><div class="bar"><i style="transform:scaleX(${v / 10})"></i></div></div>`;
    const head = `<div class="gang">${ch.gang}</div>`;
    if (ch.custom && !cur.locked) {
      const rows = STAT_ROWS.map(([k, label], r) =>
        `<div class="stat edit${cur.row === r ? ' on' : ''}" data-row="${r}"><span>${label}</span><button data-d="-1">−</button><div class="bar"><i style="transform:scaleX(${ch.stats[k] / 10})"></i></div><b>${ch.stats[k]}</b><button data-d="1">+</button></div>`).join('');
      const sp = SPECIALS[ch.special];
      return `${head}<input class="nm-edit" maxlength="18" value="${ch.name.replace(/"/g, '&quot;')}" spellcheck="false">
        <div class="nick">бонусный персонаж · настрой под себя</div>
        ${rows}
        <div class="stat edit sp${cur.row === 4 ? ' on' : ''}" data-row="4"><span>Приём</span><button data-d="-1">‹</button><div class="spn">${sp.name}</div><button data-d="1">›</button></div>
        <div class="special">${sp.desc}<br><small>Здоровье ${ch.hp} · сила ×${ch.power.toFixed(2)} · скорость ×${ch.speed.toFixed(2)}</small></div>`;
    }
    return `${head}<div class="nm">${ch.name}</div><div class="nick">«${ch.nick}»</div>
      <p>${ch.bio}</p>
      ${st('Сила', ch.stats.power)}${st('Скорость', ch.stats.speed)}${st('Здоровье', ch.stats.health)}${st('Техника', ch.stats.technique)}
      <div class="special"><b>${ch.specialName}</b> — ${ch.specialDesc}<br>${ch.passive}</div>`;
  }

  private renderInfo(p: number) {
    const cur = this.cursors[p];
    const ch = ROSTER[cur.idx];
    cur.info.innerHTML = this.infoHtml(ch, cur);
    cur.info.classList.toggle('editable', !!ch.custom && !cur.locked);
    if (!ch.custom || cur.locked) return;
    cur.info.querySelectorAll<HTMLElement>('.stat.edit').forEach((row) => {
      const r = +row.dataset.row!;
      row.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.onclick = () => {
          cur.row = r;
          this.edit(p, +b.dataset.d!);
        };
      });
    });
    const inp = cur.info.querySelector<HTMLInputElement>('.nm-edit')!;
    inp.oninput = () => {
      ch.name = inp.value.trim() || 'Бонус';
      saveBonus(ch);
      this.cards[cur.idx].querySelector('.lbl')!.textContent = fullTitle(ch);
    };
    inp.onkeydown = (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') inp.blur();
    };
  }

  /** Change the highlighted editor row of a bonus fighter by d. */
  private edit(p: number, d: number) {
    const cur = this.cursors[p];
    const ch = ROSTER[cur.idx];
    if (!ch.custom || cur.locked) return;
    if (cur.row < 4) {
      const k = STAT_ROWS[cur.row][0];
      ch.stats[k] = Math.max(1, Math.min(10, ch.stats[k] + d));
    } else {
      const i = SPECIAL_IDS.indexOf(ch.special);
      ch.special = SPECIAL_IDS[(i + d + SPECIAL_IDS.length) % SPECIAL_IDS.length];
    }
    saveBonus(ch);
    sfx.ui();
    this.refresh();
  }

  private rigFor(p: number, id: string) {
    const key = p + ':' + id;
    let r = this.rigCache.get(key);
    if (!r) {
      const ch = ROSTER.find((c) => c.id === id)!;
      r = makeBody(this.app.assets.characters[ch.model], { hero: true });
      this.rigCache.set(key, r);
    }
    return r;
  }

  private refresh() {
    this.cards.forEach((c, i) => {
      c.classList.toggle('p1', this.cursors[0].idx === i);
      c.classList.toggle('p2', this.cursors[1]?.idx === i);
      c.querySelectorAll('.tag').forEach((t) => t.remove());
      if (this.cursors[0].idx === i) c.append(h('div', 'tag t1', '1P'));
      if (this.cursors[1]?.idx === i) c.append(h('div', 'tag t2', '2P'));
    });
    this.cursors.forEach((cur, p) => {
      this.renderInfo(p);
      const id = ROSTER[cur.idx].id;
      if (cur.rigId !== id) {
        if (cur.rig) this.scene.remove(cur.rig.root);
        cur.rig = this.rigFor(p, id);
        cur.rigId = id;
        cur.rig.root.position.set(cur.x + (p === 0 ? -0.6 : 0.6), 0, 0.3);
        cur.rig.root.rotation.y = p === 0 ? 0.25 : -0.25;
        cur.rig.anim.stop();
        this.scene.add(cur.rig.root);
        cur.spot.intensity = 10;
      }
    });
  }

  private move(p: number, d: number) {
    const cur = this.cursors[p];
    if (!cur || cur.locked || this.done || d === 0) return;
    cur.idx = (cur.idx + d + ROSTER.length) % ROSTER.length;
    cur.row = 0;
    sfx.ui();
    this.refresh();
  }

  private confirm(p: number) {
    const cur = this.cursors[p];
    if (!cur || cur.locked || this.done) return;
    cur.locked = true;
    sfx.confirm();
    cur.rig?.anim.play('victory');
    const ch = ROSTER[cur.idx];
    this.renderInfo(p);
    cur.info.querySelector('.nick')!.innerHTML = `«${ch.custom ? ch.name : ch.nick}» — <i>${ch.quotes[0]}</i>`;
    if (this.cursors.every((c) => c.locked)) {
      this.done = true;
      const vs = h('div', 'vs', this.players === 2 ? 'VS' : 'ПОГНАЛИ!');
      if (this.players === 1) vs.style.fontSize = '110px';
      this.root.append(vs);
      setTimeout(() => this.onDone(this.cursors.map((c) => ROSTER[c.idx].id)), 1300);
    }
  }

  private row(p: number, d: number) {
    const cur = this.cursors[p];
    if (!cur || cur.locked || !ROSTER[cur.idx].custom) return;
    cur.row = (cur.row + d + 5) % 5;
    sfx.ui();
    this.renderInfo(p);
  }

  private onKey(e: KeyboardEvent) {
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    const two = this.players === 2;
    switch (e.code) {
      case 'KeyA': return this.move(0, -1);
      case 'KeyD': return this.move(0, 1);
      case 'KeyW': return this.row(0, -1);
      case 'KeyS': return this.row(0, 1);
      case 'KeyQ': return this.edit(0, -1);
      case 'KeyE': return this.edit(0, 1);
      case 'KeyJ': case 'Space': return this.confirm(0);
      case 'ArrowLeft': return two ? this.move(1, -1) : this.move(0, -1);
      case 'ArrowRight': return two ? this.move(1, 1) : this.move(0, 1);
      case 'ArrowUp': return this.row(two ? 1 : 0, -1);
      case 'ArrowDown': return this.row(two ? 1 : 0, 1);
      case 'BracketLeft': return this.edit(two ? 1 : 0, -1);
      case 'BracketRight': return this.edit(two ? 1 : 0, 1);
      case 'Enter': case 'NumpadEnter': case 'Numpad1': case 'Comma':
        return two ? this.confirm(1) : this.confirm(0);
      case 'Escape':
        if (!this.done) {
          sfx.ui();
          this.onBack();
        }
    }
  }

  update(dt: number) {
    this.t += dt;
    this.cursors.forEach((cur, p) => {
      cur.spot.intensity = damp(cur.spot.intensity, 45, 6, dt);
      const r = cur.rig;
      if (!r) return;
      // Step into the light.
      r.root.position.x = damp(r.root.position.x, cur.x, 7, dt);
      r.root.position.z = damp(r.root.position.z, 0.9, 7, dt);
      r.root.rotation.y = damp(r.root.rotation.y, p === 0 ? (this.players === 2 ? 0.35 : -0.15) : -0.35, 5, dt);
      if (!r.anim.current && Math.random() < dt * 0.15) r.anim.play('yes');
      r.anim.speed = 0;
      r.anim.update(dt);
    });
    this.camera.position.x = Math.sin(this.t * 0.3) * 0.3;
    this.camera.lookAt(0, 1.1, 0);
    this.env.update(dt, new THREE.Vector3(0, 0, 0));
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }
}
