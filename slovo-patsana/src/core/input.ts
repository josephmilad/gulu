/** Raw keyboard / mouse / gamepad state, sampled once per frame. */
export class Input {
  private down = new Set<string>();
  private pressed = new Set<string>();
  private mouseDown = new Set<number>();
  private mousePressed = new Set<number>();
  mouseDX = 0;
  mouseDY = 0;
  locked = false;
  /** Touch stick, -1..1 (right / forward positive). */
  stick = { x: 0, y: 0 };
  private prevPad = new Map<number, boolean[]>();
  private padPressed = new Map<number, Set<number>>();

  constructor(private canvas: HTMLElement) {
    addEventListener('keydown', (e) => {
      if (!e.repeat) this.pressed.add(e.code);
      this.down.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', (e) => this.down.delete(e.code));
    addEventListener('blur', () => this.down.clear());
    canvas.addEventListener('mousedown', (e) => {
      this.mouseDown.add(e.button);
      this.mousePressed.add(e.button);
    });
    addEventListener('mouseup', (e) => this.mouseDown.delete(e.button));
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.mouseDX += e.movementX;
      this.mouseDY += e.movementY;
    });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
    });
  }

  /** Camera drag from the touch screen, in mouse-pixel units. */
  addLook(dx: number, dy: number) {
    this.mouseDX += dx;
    this.mouseDY += dy;
  }

  requestLock() {
    if (!this.locked) this.canvas.requestPointerLock?.()?.catch?.(() => {});
  }

  releaseLock() {
    if (this.locked) document.exitPointerLock();
  }

  key(code: string) {
    return this.down.has(code);
  }
  keyPressed(code: string) {
    return this.pressed.has(code);
  }
  mouse(b: number) {
    return this.mouseDown.has(b);
  }
  mousePressedBtn(b: number) {
    return this.mousePressed.has(b);
  }

  pad(i: number): Gamepad | null {
    const pads = navigator.getGamepads?.() ?? [];
    return pads[i] ?? null;
  }
  padPressedBtn(i: number, b: number) {
    return this.padPressed.get(i)?.has(b) ?? false;
  }

  /** Call at the start of each frame, before game logic reads input. */
  poll() {
    const pads = navigator.getGamepads?.() ?? [];
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i];
      if (!p) continue;
      const prev = this.prevPad.get(i) ?? [];
      const set = new Set<number>();
      const now = p.buttons.map((b) => b.pressed);
      now.forEach((v, bi) => v && !prev[bi] && set.add(bi));
      this.padPressed.set(i, set);
      this.prevPad.set(i, now);
    }
  }

  /** Call at the end of each frame. */
  endFrame() {
    this.pressed.clear();
    this.mousePressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
  }
}

/** What a player wants this frame, independent of the device. */
export interface Intent {
  moveX: number; // right +
  moveY: number; // forward +
  run: boolean;
  punch: boolean;
  kick: boolean;
  block: boolean;
  special: boolean;
  dodge: boolean;
  interact: boolean;
  lookX: number; // radians this frame
  lookY: number;
}

export type Scheme = 'kbm' | 'arrows' | 'pad0' | 'pad1';

const DEAD = 0.18;
const dz = (v: number) => (Math.abs(v) < DEAD ? 0 : v);

export function readIntent(inp: Input, scheme: Scheme, dt: number): Intent {
  const it: Intent = {
    moveX: 0, moveY: 0, run: false, punch: false, kick: false, block: false,
    special: false, dodge: false, interact: false, lookX: 0, lookY: 0,
  };
  if (scheme === 'kbm') {
    it.moveX = (inp.key('KeyD') ? 1 : 0) - (inp.key('KeyA') ? 1 : 0);
    it.moveY = (inp.key('KeyW') ? 1 : 0) - (inp.key('KeyS') ? 1 : 0);
    it.run = inp.key('ShiftLeft');
    const st = inp.stick;
    if (st.x || st.y) {
      it.moveX = st.x;
      it.moveY = st.y;
      // Stick pushed to the rim = sprint.
      if (Math.hypot(st.x, st.y) > 0.92) it.run = true;
    }
    it.punch = inp.keyPressed('KeyJ') || inp.mousePressedBtn(0);
    it.kick = inp.keyPressed('KeyK') || inp.mousePressedBtn(2);
    it.block = inp.key('KeyQ') || inp.key('KeyL');
    it.special = inp.keyPressed('KeyE') || inp.keyPressed('KeyU');
    it.dodge = inp.keyPressed('Space');
    it.interact = inp.keyPressed('KeyF');
    it.lookX = -inp.mouseDX * 0.0028;
    it.lookY = -inp.mouseDY * 0.0022;
    // Keyboard camera turn for players without a mouse.
    it.lookX += ((inp.key('KeyZ') ? 1 : 0) - (inp.key('KeyC') ? 1 : 0)) * 2.2 * dt;
  } else if (scheme === 'arrows') {
    it.moveX = (inp.key('ArrowRight') ? 1 : 0) - (inp.key('ArrowLeft') ? 1 : 0);
    it.moveY = (inp.key('ArrowUp') ? 1 : 0) - (inp.key('ArrowDown') ? 1 : 0);
    it.run = inp.key('ShiftRight');
    it.punch = inp.keyPressed('Numpad1') || inp.keyPressed('Comma');
    it.kick = inp.keyPressed('Numpad2') || inp.keyPressed('Period');
    it.block = inp.key('Numpad3') || inp.key('Slash');
    it.special = inp.keyPressed('Numpad4') || inp.keyPressed('Semicolon');
    it.dodge = inp.keyPressed('Numpad0') || inp.keyPressed('Quote');
    it.interact = inp.keyPressed('Enter');
  } else {
    const i = scheme === 'pad0' ? 0 : 1;
    const p = inp.pad(i);
    if (p) {
      it.moveX = dz(p.axes[0] ?? 0);
      it.moveY = -dz(p.axes[1] ?? 0);
      it.lookX = -dz(p.axes[2] ?? 0) * 2.6 * dt;
      it.lookY = -dz(p.axes[3] ?? 0) * 1.8 * dt;
      it.run = !!p.buttons[10]?.pressed || !!p.buttons[7]?.pressed;
      it.punch = inp.padPressedBtn(i, 2);
      it.kick = inp.padPressedBtn(i, 3);
      it.block = !!p.buttons[4]?.pressed || !!p.buttons[6]?.pressed;
      it.special = inp.padPressedBtn(i, 1);
      it.dodge = inp.padPressedBtn(i, 0);
      it.interact = inp.padPressedBtn(i, 5);
    }
  }
  return it;
}
