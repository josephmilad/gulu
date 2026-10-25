import * as THREE from 'three';
import { Input } from '../core/input';
import { City } from '../world/City';
import { Environment } from '../world/Environment';
import { buildHuman } from '../actors/HumanModel';
import { Animator } from '../actors/Animator';
import { CHARACTERS } from '../actors/characters';

export interface Mode {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  update(dt: number): void;
  dispose(): void;
}

export interface World {
  scene: THREE.Scene;
  city: City;
  env: Environment;
}

export class App {
  renderer: THREE.WebGLRenderer;
  input: Input;
  mode: Mode | null = null;
  portraits: Record<string, string> = {};
  private world: World | null = null;
  private last = performance.now();
  /** Global time scale for hit-stop and slow motion. */
  timeScale = 1;
  private hitStop = 0;

  constructor(public canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.input = new Input(canvas);
    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      if (this.mode) {
        this.mode.camera.aspect = innerWidth / innerHeight;
        this.mode.camera.updateProjectionMatrix();
      }
    });
  }

  /** The city is expensive to build, so menu and gameplay share one instance. */
  getWorld(): World {
    if (!this.world) {
      const scene = new THREE.Scene();
      const city = new City();
      scene.add(city.group);
      const env = new Environment(scene);
      this.world = { scene, city, env };
    }
    return this.world;
  }

  setMode(m: Mode) {
    this.mode?.dispose();
    this.mode = m;
    m.camera.aspect = innerWidth / innerHeight;
    m.camera.updateProjectionMatrix();
  }

  freeze(seconds: number) {
    this.hitStop = Math.max(this.hitStop, seconds);
  }

  start() {
    const tick = (now: number) => {
      requestAnimationFrame(tick);
      let dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.input.poll();
      if (this.hitStop > 0) {
        this.hitStop -= dt;
        dt *= 0.08;
      }
      dt *= this.timeScale;
      if (this.mode) {
        this.mode.update(dt);
        this.renderer.render(this.mode.scene, this.mode.camera);
      }
      this.input.endFrame();
    };
    requestAnimationFrame(tick);
  }

  /** Render a head-and-shoulders portrait of every playable character. */
  makePortraits() {
    const W = 240, H = 300;
    const rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0a0c);
    scene.add(new THREE.HemisphereLight(0x9aa8d8, 0x302020, 1.4));
    const key = new THREE.DirectionalLight(0xffe2c0, 2.4);
    key.position.set(1.5, 2.5, 3);
    const rim = new THREE.DirectionalLight(0xff4040, 2.2);
    rim.position.set(-2, 2, -2);
    scene.add(key, rim);
    const cam = new THREE.PerspectiveCamera(26, W / H, 0.1, 20);
    const buf = new Uint8Array(W * H * 4);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    for (const ch of CHARACTERS) {
      const rig = buildHuman(ch.look);
      const an = new Animator(rig);
      an.update(0.016);
      rig.root.rotation.y = 0.35;
      scene.add(rig.root);
      const top = 1.62 * ch.look.height;
      cam.position.set(0.45, top, 1.55);
      cam.lookAt(0, top - 0.06, 0);
      this.renderer.setRenderTarget(rt);
      this.renderer.render(scene, cam);
      this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
      const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0);
      this.portraits[ch.id] = c.toDataURL();
      scene.remove(rig.root);
    }
    this.renderer.setRenderTarget(null);
    rt.dispose();
  }
}
