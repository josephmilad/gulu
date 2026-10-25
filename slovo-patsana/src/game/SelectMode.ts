import * as THREE from 'three';
import type { App, Mode } from './App';
import { h, uiRoot } from '../ui/dom';
import { sfx } from '../audio/sfx';
import { CHARACTERS, type CharacterDef } from '../actors/characters';
import { buildHuman, type HumanRig } from '../actors/HumanModel';
import { Animator } from '../actors/Animator';
import { Environment } from '../world/Environment';
import { snowTex } from '../world/textures';
import { damp } from '../core/math';

interface Cursor {
  idx: number;
  locked: boolean;
  info: HTMLElement;
}

/**
 * Mortal Kombat-style select: the roster stands on a snowy stage, a spotlight
 * picks out the highlighted fighter, portraits run along the bottom.
 * Player 1: A/D + J/Enter. Player 2: ←/→ + Numpad1 / Comma.
 */
export class SelectMode implements Mode {
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.1, 300);
  private root = h('div', 'select');
  private cards: HTMLElement[] = [];
  private rigs: { rig: HumanRig; anim: Animator; baseX: number }[] = [];
  private cursors: Cursor[] = [];
  private spots: THREE.SpotLight[] = [];
  private env: Environment;
  private done = false;
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);
  private t = 0;

  constructor(app: App, private players: 1 | 2, private onDone: (ids: string[]) => void, private onBack: () => void) {
    this.env = new Environment(this.scene);
    this.scene.fog = new THREE.Fog(0x1a0d12, 12, 60);
    const floorTex = snowTex();
    floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }));
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
    const n = CHARACTERS.length;
    CHARACTERS.forEach((ch, i) => {
      const rig = buildHuman(ch.look);
      const anim = new Animator(rig);
      const x = (i - (n - 1) / 2) * 1.9 + (players === 1 ? 1.5 : 0);
      rig.root.position.set(x, 0, 0);
      this.scene.add(rig.root);
      this.rigs.push({ rig, anim, baseX: x });
      const spot = new THREE.SpotLight(0xffe8d0, 0, 18, 0.32, 0.6, 1.2);
      spot.position.set(x, 9, 4);
      spot.target = rig.root;
      spot.castShadow = true;
      this.scene.add(spot);
      this.spots.push(spot);
    });
    const fill = new THREE.DirectionalLight(0xc8d4ff, 1.4);
    fill.position.set(0, 3, 8);
    this.scene.add(fill);
    this.camera.position.set(0, 1.9, 7.2);
    this.camera.lookAt(0, 1.1, 0);

    this.root.append(h('h2', '', players === 2 ? 'ВЫБЕРИТЕ ПАЦАНОВ' : 'ВЫБЕРИ ПАЦАНА'));
    const mid = h('div', 'select-mid');
    const info1 = h('div', 'info');
    const info2 = h('div', 'info p2');
    mid.append(info1, players === 2 ? info2 : h('div'));
    this.root.append(mid);
    const bottom = h('div');
    const roster = h('div', 'roster');
    CHARACTERS.forEach((ch, i) => {
      const c = h('div', 'card');
      c.style.backgroundImage = `url(${app.portraits[ch.id]})`;
      c.append(h('div', 'lbl', ch.nick === ch.name ? ch.name : `${ch.name} «${ch.nick}»`));
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
      ? 'Игрок 1: <kbd>A</kbd>/<kbd>D</kbd> + <kbd>J</kbd> &nbsp;·&nbsp; Игрок 2: <kbd>←</kbd>/<kbd>→</kbd> + <kbd>Enter</kbd> &nbsp;·&nbsp; <kbd>Esc</kbd> назад'
      : '<kbd>A</kbd>/<kbd>D</kbd> или <kbd>←</kbd>/<kbd>→</kbd> — выбор &nbsp;·&nbsp; <kbd>Enter</kbd>/<kbd>J</kbd> — подтвердить &nbsp;·&nbsp; <kbd>Esc</kbd> назад'));
    this.root.append(bottom);
    uiRoot().append(this.root);
    this.cursors.push({ idx: 0, locked: false, info: info1 });
    if (players === 2) this.cursors.push({ idx: Math.min(1, n - 1), locked: false, info: info2 });
    this.refresh();
    addEventListener('keydown', this.keyHandler);
  }

  private infoHtml(ch: CharacterDef) {
    const st = (label: string, v: number) => `<div class="stat"><span>${label}</span><div class="bar"><i style="transform:scaleX(${v / 10})"></i></div></div>`;
    return `<div class="gang">${ch.gang}</div><div class="nm">${ch.name}</div><div class="nick">«${ch.nick}»</div>
      <p>${ch.bio}</p>
      ${st('Сила', ch.stats.power)}${st('Скорость', ch.stats.speed)}${st('Здоровье', ch.stats.health)}${st('Техника', ch.stats.technique)}
      <div class="special"><b>${ch.specialName}</b> — ${ch.specialDesc}<br>${ch.passive}</div>`;
  }

  private refresh() {
    this.cards.forEach((c, i) => {
      c.classList.toggle('p1', this.cursors[0].idx === i);
      c.classList.toggle('p2', this.cursors[1]?.idx === i);
      c.querySelectorAll('.tag').forEach((t) => t.remove());
      if (this.cursors[0].idx === i) c.append(h('div', 'tag t1', '1P'));
      if (this.cursors[1]?.idx === i) c.append(h('div', 'tag t2', '2P'));
    });
    for (const cur of this.cursors) cur.info.innerHTML = this.infoHtml(CHARACTERS[cur.idx]);
  }

  private move(p: number, d: number) {
    const cur = this.cursors[p];
    if (!cur || cur.locked || this.done || d === 0) return;
    cur.idx = (cur.idx + d + CHARACTERS.length) % CHARACTERS.length;
    sfx.ui();
    this.refresh();
  }

  private confirm(p: number) {
    const cur = this.cursors[p];
    if (!cur || cur.locked || this.done) return;
    cur.locked = true;
    sfx.confirm();
    const r = this.rigs[cur.idx];
    r.anim.play('victory');
    const ch = CHARACTERS[cur.idx];
    cur.info.querySelector('.nick')!.innerHTML = `«${ch.nick}» — <i>${ch.quotes[0]}</i>`;
    if (this.cursors.every((c) => c.locked)) {
      this.done = true;
      const vs = h('div', 'vs', this.players === 2 ? 'VS' : 'ПОГНАЛИ!');
      if (this.players === 1) vs.style.fontSize = '110px';
      this.root.append(vs);
      setTimeout(() => this.onDone(this.cursors.map((c) => CHARACTERS[c.idx].id)), 1300);
    }
  }

  private onKey(e: KeyboardEvent) {
    switch (e.code) {
      case 'KeyA': return this.move(0, -1);
      case 'KeyD': return this.move(0, 1);
      case 'KeyJ': case 'Space': return this.confirm(0);
      case 'ArrowLeft': return this.players === 2 ? this.move(1, -1) : this.move(0, -1);
      case 'ArrowRight': return this.players === 2 ? this.move(1, 1) : this.move(0, 1);
      case 'Enter': case 'NumpadEnter': case 'Numpad1': case 'Comma':
        return this.players === 2 ? this.confirm(1) : this.confirm(0);
      case 'Escape':
        if (!this.done) {
          sfx.ui();
          this.onBack();
        }
    }
  }

  update(dt: number) {
    this.t += dt;
    const sel = new Set(this.cursors.map((c) => c.idx));
    this.rigs.forEach((r, i) => {
      const on = sel.has(i);
      this.spots[i].intensity = damp(this.spots[i].intensity, on ? 170 : 12, 8, dt);
      const z = damp(r.rig.root.position.z, on ? 1.2 : 0, 6, dt);
      r.rig.root.position.z = z;
      // Turn toward the camera when picked, idle three-quarter otherwise.
      r.rig.root.rotation.y = damp(r.rig.root.rotation.y, on ? 0 : i === 0 ? 0.5 : i === this.rigs.length - 1 ? -0.5 : 0, 6, dt);
      r.anim.setGuard(on);
      r.anim.speed = 0;
      r.anim.update(dt);
    });
    this.camera.position.x = Math.sin(this.t * 0.3) * 0.4;
    this.camera.lookAt(0, 1.1, 0);
    this.env.update(dt, new THREE.Vector3(0, 0, 0));
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }
}
