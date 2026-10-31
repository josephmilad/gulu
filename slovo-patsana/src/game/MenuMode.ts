import * as THREE from 'three';
import type { App, Mode } from './App';
import { h, uiRoot } from '../ui/dom';
import { sfx } from '../audio/sfx';
import { controlsHtml } from '../ui/controls';
import { MODEL_CREDITS } from '../ui/credits';
import { goFullscreen, isTouch } from '../core/device';

function storyNote() {
  let n = 0;
  try {
    n = Number(localStorage.getItem('sp-story')) || 0;
  } catch {
    /* no storage */
  }
  return n >= 3 ? 'пройден · 3/3 миссии' : `миссии · пройдено ${n}/3`;
}

interface Item {
  label: string;
  note?: string;
  disabled?: boolean;
  action: () => void;
}

/** Title screen over a slow fly-around of the district at night. */
export class MenuMode implements Mode {
  scene: THREE.Scene;
  camera = new THREE.PerspectiveCamera(55, 1, 0.1, 900);
  private root = h('div', 'menu');
  private items: Item[];
  private idx = 0;
  private btns: HTMLButtonElement[] = [];
  private started: boolean;
  private t = 0;
  private overlay: HTMLElement | null = null;
  private focus = new THREE.Vector3();
  private keyHandler = (e: KeyboardEvent) => this.onKey(e);

  constructor(private app: App, private onPlay: (players: 1 | 2, mode: 'free' | 'versus' | 'cpu' | 'story') => void, alreadyStarted = false) {
    const w = app.getWorld();
    this.scene = w.scene;
    this.started = alreadyStarted;
    this.items = [
      { label: 'Свободная игра', note: 'район, драки, авторитет', action: () => this.onPlay(1, 'free') },
      { label: 'Стенка на стенку: против компьютера', note: '1 на 1, каток', action: () => this.onPlay(1, 'cpu') },
      ...(isTouch ? [] : [{ label: 'Стенка на стенку: два игрока', note: 'одна клавиатура или геймпады', action: () => this.onPlay(2, 'versus') }]),
      { label: 'Сюжет', note: storyNote(), action: () => this.onPlay(1, 'story') },
      { label: 'Управление', action: () => this.showControls() },
      { label: 'Авторы', note: 'модели, лицензии', action: () => this.showCredits() },
    ];
    this.root.append(h('h1', 'title', 'СЛОВО<br>ПАЦАНА'), h('div', 'subtitle', 'УЛИЦЫ КАЗАНИ · 1989'));
    const list = h('div', 'menu-list');
    this.items.forEach((it, i) => {
      const b = h('button', 'menu-item' + (it.disabled ? ' disabled' : ''), it.label + (it.note ? `<small>${it.note}</small>` : ''));
      b.onmouseenter = () => this.select(i);
      b.onclick = () => this.activate(i);
      list.append(b);
      this.btns.push(b);
    });
    this.pressStart = h('div', 'press-start', isTouch ? 'КОСНИСЬ ЭКРАНА' : 'НАЖМИ ЛЮБУЮ КЛАВИШУ');
    this.root.append(this.started ? list : this.pressStart);
    this.list = list;
    this.root.append(h('div', 'menu-foot', 'Фанатская игра по мотивам сериала «Слово пацана». Все персонажи — стилизация. · версия 4: сюжет и бонусные персонажи'));
    uiRoot().append(this.root);
    this.select(0);
    addEventListener('keydown', this.keyHandler);
    this.root.addEventListener('pointerdown', () => {
      goFullscreen();
      this.begin();
    });
    if (this.started) sfx.startMusic();
  }
  private pressStart: HTMLElement;
  private list: HTMLElement;

  /** The tap that opens the menu must not also press the item under the finger. */
  private openedAt = -1e9;

  private begin() {
    if (this.started) return;
    this.started = true;
    this.openedAt = performance.now();
    sfx.unlock();
    sfx.startWind();
    sfx.startMusic();
    this.pressStart.replaceWith(this.list);
  }

  private select(i: number) {
    this.idx = i;
    this.btns.forEach((b, k) => b.classList.toggle('active', k === i));
  }

  private activate(i: number) {
    if (performance.now() - this.openedAt < 450) return;
    const it = this.items[i];
    if (it.disabled) {
      sfx.ui();
      return;
    }
    sfx.confirm();
    it.action();
  }

  private showControls() {
    const o = h('div', 'overlay');
    o.append(h('h2', '', 'УПРАВЛЕНИЕ'), h('div', 'controls', controlsHtml()), h('div', 'hint', isTouch ? 'Коснись, чтобы вернуться' : 'Нажми <kbd>Esc</kbd> или кликни, чтобы вернуться'));
    o.onclick = () => this.closeOverlay();
    this.root.append(o);
    this.overlay = o;
  }

  private showCredits() {
    const o = h('div', 'overlay credits');
    const rows = MODEL_CREDITS.map((c) => `<li><a href="${c.url}" target="_blank" rel="noopener">${c.what}</a> — ${c.who} · ${c.lic}</li>`).join('');
    o.append(h('h2', '', 'АВТОРЫ'), h('div', 'credits-body', `
      <p>Фанатская некоммерческая игра по мотивам сериала «Слово пацана». Все персонажи — стилизация.</p>
      <h3>3D-модели (Sketchfab, CC BY 4.0)</h3><ul>${rows}</ul>
      <h3>Свободные ресурсы</h3><ul>
      <li><a href="https://polyhaven.com" target="_blank" rel="noopener">Poly Haven</a> — небо, текстуры и предметы · CC0</li>
      <li><a href="https://quaternius.com" target="_blank" rel="noopener">Quaternius Universal Animation Library</a> — анимации · CC0</li>
      <li><a href="https://github.com/depixeled-chris/gta7" target="_blank" rel="noopener">gta7</a> by depixeled-chris — коллизии и машины · MIT</li>
      <li><a href="https://threejs.org" target="_blank" rel="noopener">three.js</a>, <a href="https://github.com/pmndrs/postprocessing" target="_blank" rel="noopener">postprocessing</a>, <a href="https://github.com/N8python/n8ao" target="_blank" rel="noopener">N8AO</a> · MIT</li>
      </ul>`), h('div', 'hint', isTouch ? 'Коснись заголовка, чтобы вернуться' : 'Нажми <kbd>Esc</kbd> или кликни по заголовку, чтобы вернуться'));
    o.querySelector('h2')!.addEventListener('click', () => this.closeOverlay());
    o.querySelector('.hint')!.addEventListener('click', () => this.closeOverlay());
    this.root.append(o);
    this.overlay = o;
  }

  private closeOverlay() {
    this.overlay?.remove();
    this.overlay = null;
  }

  private onKey(e: KeyboardEvent) {
    if (!this.started) {
      this.begin();
      return;
    }
    if (this.overlay) {
      if (e.code === 'Escape' || e.code === 'Enter') this.closeOverlay();
      return;
    }
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      this.select((this.idx + 1) % this.items.length);
      sfx.ui();
    } else if (e.code === 'ArrowUp' || e.code === 'KeyW') {
      this.select((this.idx + this.items.length - 1) % this.items.length);
      sfx.ui();
    } else if (e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyJ') this.activate(this.idx);
  }

  update(dt: number) {
    this.t += dt;
    const a = this.t * 0.05;
    const w = this.app.getWorld();
    this.focus.set(Math.cos(a) * 60, 0, Math.sin(a) * 60);
    this.camera.position.set(Math.cos(a + 0.6) * 120, 38 + Math.sin(this.t * 0.1) * 6, Math.sin(a + 0.6) * 120);
    this.camera.lookAt(this.focus.x * 0.3, 8, this.focus.z * 0.3);
    w.env.update(dt, this.camera.position);
  }

  dispose() {
    removeEventListener('keydown', this.keyHandler);
    this.root.remove();
  }
}
