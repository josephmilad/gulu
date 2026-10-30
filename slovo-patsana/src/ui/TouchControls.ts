import type { Input } from '../core/input';
import { h, uiRoot } from './dom';

/** Fire the same key events a keyboard would, so every mode and menu understands the buttons. */
const key = (code: string, down: boolean) => dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true }));

/** Keep receiving a finger's moves even when it slides off the element. */
const capture = (el: Element, id: number) => {
  try {
    el.setPointerCapture(id);
  } catch {
    /* pointer already gone */
  }
};

const BUTTONS: { id: string; label: string; code: string; hold?: boolean }[] = [
  { id: 'punch', label: 'РУКА', code: 'KeyJ' },
  { id: 'kick', label: 'НОГА', code: 'KeyK' },
  { id: 'block', label: 'БЛОК', code: 'KeyQ', hold: true },
  { id: 'special', label: 'ПРИЁМ', code: 'KeyE' },
  { id: 'dodge', label: 'УКЛОН', code: 'Space' },
  { id: 'car', label: 'МАШИНА', code: 'KeyF' },
];

/**
 * On-screen controls for phones: a floating stick on the left half (push it all
 * the way to sprint), drag anywhere else to turn the camera, fight buttons on
 * the right, pause at the top.
 */
export class TouchControls {
  root = h('div', 'touch-ui hidden');
  private base = h('div', 'stick-base');
  private knob = h('div', 'stick-knob');
  private stickId = -1;
  private stickO = { x: 0, y: 0 };
  private lookId = -1;
  private lookP = { x: 0, y: 0 };
  private held = new Map<number, string>();

  constructor(private input: Input) {
    this.base.append(this.knob);
    this.root.append(this.base);
    const pad = h('div', 'touch-btns');
    for (const b of BUTTONS) {
      const el = h('button', 'tbtn tb-' + b.id, b.label);
      el.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        capture(el, e.pointerId);
        el.classList.add('on');
        this.held.set(e.pointerId, b.code);
        key(b.code, true);
        navigator.vibrate?.(12);
      });
      const up = (e: PointerEvent) => {
        if (!this.held.has(e.pointerId)) return;
        this.held.delete(e.pointerId);
        el.classList.remove('on');
        key(b.code, false);
      };
      el.addEventListener('pointerup', up);
      el.addEventListener('pointercancel', up);
      pad.append(el);
    }
    const pause = h('button', 'tbtn tb-pause', 'II');
    pause.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      key('Escape', true);
      key('Escape', false);
    });
    this.root.append(pad, pause);

    this.root.addEventListener('pointerdown', (e) => this.down(e));
    this.root.addEventListener('pointermove', (e) => this.move(e));
    this.root.addEventListener('pointerup', (e) => this.up(e));
    this.root.addEventListener('pointercancel', (e) => this.up(e));
    this.root.addEventListener('contextmenu', (e) => e.preventDefault());
    uiRoot().append(this.root);
  }

  show(on: boolean) {
    this.root.classList.toggle('hidden', !on);
    if (!on) this.reset();
  }

  private reset() {
    this.stickId = this.lookId = -1;
    this.input.stick.x = this.input.stick.y = 0;
    this.base.classList.remove('on');
    for (const code of this.held.values()) key(code, false);
    this.held.clear();
  }

  private down(e: PointerEvent) {
    e.preventDefault();
    if (e.clientX < innerWidth * 0.42 && this.stickId < 0) {
      this.stickId = e.pointerId;
      this.stickO = { x: e.clientX, y: e.clientY };
      this.base.style.left = e.clientX + 'px';
      this.base.style.top = e.clientY + 'px';
      this.base.classList.add('on');
      this.knob.style.transform = 'translate(-50%, -50%)';
    } else if (this.lookId < 0) {
      this.lookId = e.pointerId;
      this.lookP = { x: e.clientX, y: e.clientY };
    }
    capture(this.root, e.pointerId);
  }

  private move(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      const R = 56;
      let dx = e.clientX - this.stickO.x, dy = e.clientY - this.stickO.y;
      const d = Math.hypot(dx, dy);
      if (d > R) {
        dx *= R / d;
        dy *= R / d;
      }
      this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      this.input.stick.x = dx / R;
      this.input.stick.y = -dy / R;
    } else if (e.pointerId === this.lookId) {
      this.input.addLook((e.clientX - this.lookP.x) * 2.2, (e.clientY - this.lookP.y) * 1.6);
      this.lookP = { x: e.clientX, y: e.clientY };
    }
  }

  private up(e: PointerEvent) {
    if (e.pointerId === this.stickId) {
      this.stickId = -1;
      this.input.stick.x = this.input.stick.y = 0;
      this.base.classList.remove('on');
    } else if (e.pointerId === this.lookId) this.lookId = -1;
  }
}

let ui: TouchControls | null = null;

/** Create the touch controls once (phones only). */
export function initTouch(input: Input) {
  ui = new TouchControls(input);
}

/** Show or hide the in-game touch controls (no-op on desktop). */
export function showTouch(on: boolean) {
  ui?.show(on);
}
