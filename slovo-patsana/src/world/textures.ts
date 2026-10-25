import * as THREE from 'three';
import { mulberry32 } from '../core/math';

function make(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}

function speckle(g: CanvasRenderingContext2D, w: number, h: number, n: number, a: number, size = 2) {
  for (let i = 0; i < n; i++) {
    g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,255,255,${a})`;
    g.fillRect(Math.random() * w, Math.random() * h, size, size);
  }
}

/**
 * A facade sheet: `cols` × `floors` windows. Returns the colour map and an
 * emissive map where some windows glow (lived-in flats at night).
 */
export interface Facade {
  map: THREE.Texture;
  emissive: THREE.Texture;
  cellW: number; // metres per window column
  floorH: number; // metres per floor
  cols: number;
  floors: number;
}

export function panelFacade(seed: number, wall: string, panelLines: boolean, brick = false, wallImg?: HTMLImageElement, tilePx = 128): Facade {
  const cols = 16, floors = 16, cw = 64, ch = 64;
  const rnd = mulberry32(seed);
  const lit: boolean[] = [];
  for (let i = 0; i < cols * floors; i++) lit.push(rnd() < 0.32);
  const warm = ['#ffd27a', '#ffc35a', '#ffe3a8', '#f7b85c', '#cfe0ff'];
  const colors = lit.map(() => warm[Math.floor(rnd() * warm.length)]);
  const map = make(cols * cw, floors * ch, (g) => {
    g.fillStyle = wall;
    g.fillRect(0, 0, cols * cw, floors * ch);
    if (wallImg) {
      // Real photographed concrete/brick, tinted toward this building's colour.
      for (let y = 0; y < floors * ch; y += tilePx)
        for (let x = 0; x < cols * cw; x += tilePx) g.drawImage(wallImg, x, y, tilePx, tilePx);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = wall;
      g.globalAlpha = 0.55;
      g.fillRect(0, 0, cols * cw, floors * ch);
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';
    }
    if (brick && !wallImg) {
      for (let y = 0; y < floors * ch; y += 8) {
        for (let x = (y / 8) % 2 ? 0 : 8; x < cols * cw; x += 16) {
          g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`;
          g.fillRect(x, y, 15, 7);
        }
        g.fillStyle = 'rgba(255,255,255,0.08)';
        g.fillRect(0, y + 7, cols * cw, 1);
      }
    }
    if (!wallImg) speckle(g, cols * cw, floors * ch, 6000, 0.05, 3);
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++) {
        const x = c * cw;
        const y = f * ch;
        if (panelLines) {
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.fillRect(x, y + ch - 2, cw, 2);
          g.fillRect(x + cw - 2, y, 2, ch);
        }
        // Rust/damp streaks
        if (rnd() < 0.08) {
          g.fillStyle = 'rgba(80,60,40,0.12)';
          g.fillRect(x + 20 + rnd() * 20, y + 40, 4, ch * (1 + rnd() * 2));
        }
        // Window
        const wx = x + 14, wy = y + 14, ww = 36, wh = 34;
        g.fillStyle = '#2b2f36';
        g.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
        g.fillStyle = lit[f * cols + c] ? colors[f * cols + c] : '#1a2230';
        g.fillRect(wx, wy, ww, wh);
        if (lit[f * cols + c]) {
          // Curtains
          g.fillStyle = 'rgba(150,60,40,0.35)';
          g.fillRect(wx, wy, 8, wh);
          g.fillRect(wx + ww - 8, wy, 8, wh);
        } else {
          g.fillStyle = 'rgba(120,140,170,0.15)';
          g.fillRect(wx + 2, wy + 2, 10, wh - 4);
        }
        g.fillStyle = '#d9d6cc';
        g.fillRect(wx + ww / 2 - 1, wy, 2, wh);
        g.fillRect(wx, wy + 11, ww, 2);
        // Snow on the sill
        g.fillStyle = '#f4f7fb';
        g.fillRect(wx - 3, wy + wh + 1, ww + 6, 3);
        // Balconies on some columns
        if (!brick && c % 4 === 1 && f > 0) {
          g.fillStyle = 'rgba(70,72,78,0.9)';
          g.fillRect(x + 4, y + 40, cw - 8, 20);
          g.fillStyle = 'rgba(255,255,255,0.12)';
          for (let i = 0; i < 6; i++) g.fillRect(x + 6 + i * 9, y + 41, 2, 18);
          g.fillStyle = '#eef2f7';
          g.fillRect(x + 4, y + 38, cw - 8, 3);
        }
      }
  });
  const emissive = make(cols * cw, floors * ch, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, cols * cw, floors * ch);
    for (let f = 0; f < floors; f++)
      for (let c = 0; c < cols; c++) {
        if (!lit[f * cols + c]) continue;
        g.fillStyle = colors[f * cols + c];
        g.fillRect(c * cw + 14, f * ch + 14, 36, 34);
        g.fillStyle = 'rgba(0,0,0,0.5)';
        g.fillRect(c * cw + 14, f * ch + 14, 8, 34);
        g.fillRect(c * cw + 42, f * ch + 14, 8, 34);
      }
  });
  return { map, emissive, cellW: 3.2, floorH: 2.8, cols, floors };
}

export function snowTex() {
  return make(512, 512, (g) => {
    g.fillStyle = '#e9eef5';
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 260; i++) {
      const r = 10 + Math.random() * 60;
      const x = Math.random() * 512, y = Math.random() * 512;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      const tint = Math.random() < 0.5 ? '200,212,230' : '255,255,255';
      gr.addColorStop(0, `rgba(${tint},0.35)`);
      gr.addColorStop(1, `rgba(${tint},0)`);
      g.fillStyle = gr;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Footprint trails
    g.fillStyle = 'rgba(150,165,190,0.25)';
    for (let t = 0; t < 6; t++) {
      let x = Math.random() * 512, y = Math.random() * 512;
      const a = Math.random() * Math.PI * 2;
      for (let i = 0; i < 25; i++) {
        x += Math.cos(a) * 14;
        y += Math.sin(a) * 14;
        g.beginPath();
        g.ellipse(((x % 512) + 512) % 512 + (i % 2) * 6, ((y % 512) + 512) % 512, 3, 5, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    speckle(g, 512, 512, 4000, 0.04);
  });
}

export function asphaltTex() {
  return make(512, 512, (g) => {
    g.fillStyle = '#3c3f45';
    g.fillRect(0, 0, 512, 512);
    speckle(g, 512, 512, 30000, 0.08, 2);
    // Packed snow and slush streaks along the wheel tracks
    for (let i = 0; i < 70; i++) {
      const x = Math.random() * 512;
      g.fillStyle = `rgba(220,226,235,${0.08 + Math.random() * 0.2})`;
      g.fillRect(x, Math.random() * 512, 6 + Math.random() * 40, 30 + Math.random() * 140);
    }
    for (let i = 0; i < 25; i++) {
      g.fillStyle = 'rgba(20,20,22,0.3)';
      g.beginPath();
      g.ellipse(Math.random() * 512, Math.random() * 512, 10 + Math.random() * 30, 6 + Math.random() * 15, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
  });
}

export function sidewalkTex() {
  return make(256, 256, (g) => {
    g.fillStyle = '#aab0ba';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    for (let i = 0; i <= 256; i += 64) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i, 256);
      g.moveTo(0, i);
      g.lineTo(256, i);
      g.stroke();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(245,248,252,0.5)';
      g.beginPath();
      g.ellipse(Math.random() * 256, Math.random() * 256, 10 + Math.random() * 30, 5 + Math.random() * 15, Math.random() * 3, 0, Math.PI * 2);
      g.fill();
    }
    speckle(g, 256, 256, 3000, 0.06);
  });
}

export function iceTex() {
  return make(512, 512, (g) => {
    g.fillStyle = '#c9dceb';
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 160; i++) {
      g.beginPath();
      const x = Math.random() * 512, y = Math.random() * 512;
      g.arc(x, y, 20 + Math.random() * 120, Math.random() * 6, Math.random() * 6);
      g.stroke();
    }
  });
}

export function signTex(text: string, fg: string, bg: string, w = 1024, h = 192, font = 'bold 120px "Arial Narrow", Arial, sans-serif') {
  return make(w, h, (g) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.font = font;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.shadowColor = fg;
    g.shadowBlur = 24;
    g.fillStyle = fg;
    g.fillText(text, w / 2, h / 2 + 6);
  });
}

export function glowTex() {
  return make(128, 128, (g) => {
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.25, 'rgba(255,255,255,0.45)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
  });
}

export function garageTex() {
  return make(256, 128, (g) => {
    g.fillStyle = '#6b6f68';
    g.fillRect(0, 0, 256, 128);
    speckle(g, 256, 128, 2000, 0.08, 2);
    g.fillStyle = '#4a5a4f';
    g.fillRect(28, 22, 200, 106);
    g.fillStyle = 'rgba(0,0,0,0.3)';
    g.fillRect(126, 22, 4, 106);
    for (let y = 30; y < 128; y += 12) g.fillRect(28, y, 200, 1);
    g.fillStyle = 'rgba(120,70,40,0.35)';
    g.fillRect(40, 90, 70, 38);
  });
}

/** Supermarket glazing: aluminium mullions with a lit interior of shelves behind. */
export function shopfrontTex() {
  return make(512, 384, (g) => {
    g.fillStyle = '#c9c3b6';
    g.fillRect(0, 0, 512, 384);
    // Interior glow
    const gr = g.createLinearGradient(0, 60, 0, 384);
    gr.addColorStop(0, '#dfe8e6');
    gr.addColorStop(1, '#9fb3b8');
    g.fillStyle = gr;
    g.fillRect(8, 60, 496, 316);
    // Shelves with goods
    const goods = ['#b8433a', '#e0c050', '#4a7ac0', '#f0f0e0', '#6aa060', '#c07a30'];
    for (let row = 0; row < 4; row++) {
      const y = 150 + row * 52;
      g.fillStyle = '#6b6f72';
      g.fillRect(8, y + 30, 496, 6);
      for (let x = 10; x < 500; x += 9 + Math.random() * 6) {
        g.fillStyle = goods[Math.floor(Math.random() * goods.length)];
        const hh = 12 + Math.random() * 16;
        g.fillRect(x, y + 30 - hh, 6, hh);
      }
    }
    // Ceiling lamps
    g.fillStyle = '#ffffff';
    for (let x = 30; x < 512; x += 80) g.fillRect(x, 70, 44, 6);
    // Mullions
    g.fillStyle = '#5d6166';
    for (let x = 0; x <= 512; x += 128) g.fillRect(x - 4, 50, 8, 334);
    g.fillRect(0, 50, 512, 10);
    g.fillRect(0, 374, 512, 10);
    g.fillRect(0, 250, 512, 4);
    // Concrete band at the top
    g.fillStyle = '#bdb7aa';
    g.fillRect(0, 0, 512, 50);
    g.fillStyle = 'rgba(255,255,255,0.12)';
    g.fillRect(0, 60, 512, 40);
  });
}
