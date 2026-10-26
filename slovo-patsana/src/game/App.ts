import * as THREE from 'three';
import {
  BloomEffect, BrightnessContrastEffect, EffectComposer, EffectPass, HueSaturationEffect, NoiseEffect,
  RenderPass, SMAAEffect, ToneMappingEffect, ToneMappingMode, VignetteEffect, BlendFunction,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';
import { Input } from '../core/input';
import { GradeEffect } from '../render/GradeEffect';
import { City } from '../world/City';
import { Environment } from '../world/Environment';
import { ROSTER, loadBonus, setRoster } from '../actors/characters';
import { makeBody } from '../actors/SkinnedBody';
import { setCarModels } from '../vehicles/CarModel';
import type { Assets } from '../core/assets';

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

/** Graphics presets; "high" turns on ambient occlusion. */
export type Quality = 'low' | 'medium' | 'high';

export class App {
  renderer: THREE.WebGLRenderer;
  input: Input;
  mode: Mode | null = null;
  portraits: Record<string, string> = {};
  envMap: THREE.Texture;
  private world: World | null = null;
  private last = performance.now();
  timeScale = 1;
  private hitStop = 0;
  private composer: EffectComposer;
  private renderPass: RenderPass;
  private aoPass: N8AOPostPass;
  private composerScene: THREE.Scene | null = null;
  private composerCam: THREE.Camera | null = null;
  quality: Quality;

  constructor(public canvas: HTMLCanvasElement, public assets: Assets) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
    this.quality = (localStorage.getItem('sp-quality') as Quality) || 'high';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, this.quality === 'low' ? 1 : 1.5));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.input = new Input(canvas);
    setCarModels(assets.vehicles);
    setRoster((m) => !!assets.characters[m]);
    loadBonus();

    const pm = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pm.fromEquirectangular(assets.hdr).texture;
    pm.dispose();

    this.composer = new EffectComposer(this.renderer, { frameBufferType: THREE.HalfFloatType });
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.aoPass = new N8AOPostPass(new THREE.Scene(), new THREE.PerspectiveCamera(), innerWidth, innerHeight);
    this.aoPass.configuration.aoRadius = 1.6;
    this.aoPass.configuration.distanceFalloff = 1.0;
    this.aoPass.configuration.intensity = 2.2;
    this.aoPass.configuration.halfRes = true;
    this.aoPass.setQualityMode('Medium');
    this.composer.addPass(this.aoPass);
    const bloom = new BloomEffect({ intensity: 1.1, luminanceThreshold: 0.75, luminanceSmoothing: 0.2, mipmapBlur: true, radius: 0.75 });
    const sat = new HueSaturationEffect({ saturation: -0.06, hue: 0 });
    const contrast = new BrightnessContrastEffect({ brightness: 0.02, contrast: 0.05 });
    const tone = new ToneMappingEffect({ mode: ToneMappingMode.AGX });
    const grade = new GradeEffect();
    const vignette = new VignetteEffect({ offset: 0.32, darkness: 0.5 });
    const grain = new NoiseEffect({ blendFunction: BlendFunction.OVERLAY, premultiply: true });
    grain.blendMode.opacity.value = 0.1;
    this.composer.addPass(new EffectPass(new THREE.PerspectiveCamera(), bloom, sat, contrast, tone, grade, vignette, grain));
    this.composer.addPass(new EffectPass(new THREE.PerspectiveCamera(), new SMAAEffect()));
    this.applyQuality();

    addEventListener('resize', () => {
      this.renderer.setSize(innerWidth, innerHeight);
      this.composer.setSize(innerWidth, innerHeight);
      if (this.mode) {
        this.mode.camera.aspect = innerWidth / innerHeight;
        this.mode.camera.updateProjectionMatrix();
      }
    });
  }

  setQuality(q: Quality) {
    this.quality = q;
    try {
      localStorage.setItem('sp-quality', q);
    } catch {
      /* private mode */
    }
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, q === 'low' ? 1 : 1.5));
    this.composer.setSize(innerWidth, innerHeight);
    this.applyQuality();
  }

  private applyQuality() {
    this.aoPass.enabled = this.quality === 'high';
    if (this.world) this.world.env.lampBudget = this.quality === 'high' ? 10 : this.quality === 'medium' ? 5 : 2;
    this.renderPass.renderToScreen = false;
    const sz = this.quality === 'low' ? 1024 : this.quality === 'medium' ? 2048 : 4096;
    if (this.world) {
      const sun = this.world.env.sun;
      if (sun.shadow.mapSize.x !== sz) {
        sun.shadow.mapSize.set(sz, sz);
        sun.shadow.map?.dispose();
        sun.shadow.map = null as unknown as THREE.WebGLRenderTarget;
      }
    }
  }

  getWorld(): World {
    if (!this.world) {
      const scene = new THREE.Scene();
      const city = new City(this.assets);
      scene.add(city.group);
      const env = new Environment(scene, this.envMap);
      env.setLampSpots(city.lampSpots, scene);
      this.world = { scene, city, env };
      this.applyQuality();
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

  private render(scene: THREE.Scene, cam: THREE.Camera) {
    if (scene !== this.composerScene || cam !== this.composerCam) {
      this.composerScene = scene;
      this.composerCam = cam;
      this.renderPass.mainScene = scene;
      this.renderPass.mainCamera = cam;
      this.aoPass.scene = scene;
      this.aoPass.camera = cam;
      this.composer.setMainScene(scene);
      this.composer.setMainCamera(cam);
    }
    this.composer.render();
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
        this.render(this.mode.scene, this.mode.camera);
      }
      this.input.endFrame();
    };
    requestAnimationFrame(tick);
  }

  /** Head-and-shoulders portrait of every playable character. */
  makePortraits() {
    const W = 240, H = 300;
    const rt = new THREE.WebGLRenderTarget(W, H, { colorSpace: THREE.SRGBColorSpace, samples: 4 });
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a0a0c);
    scene.environment = this.envMap;
    scene.environmentIntensity = 0.6;
    const key = new THREE.DirectionalLight(0xffe2c0, 2.6);
    key.position.set(1.5, 2.5, 3);
    const rim = new THREE.DirectionalLight(0xff4040, 3);
    rim.position.set(-2, 2, -2);
    scene.add(key, rim);
    const cam = new THREE.PerspectiveCamera(22, W / H, 0.1, 20);
    const buf = new Uint8Array(W * H * 4);
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d')!;
    const prevTone = this.renderer.toneMapping;
    this.renderer.toneMapping = THREE.AgXToneMapping;
    for (const ch of ROSTER) {
      const body = makeBody(this.assets.characters[ch.model], { hero: true });
      body.anim.update(0.016);
      body.root.rotation.y = 0.3;
      scene.add(body.root);
      body.root.updateMatrixWorld(true);
      const head = body.root.getObjectByName('Head')!;
      const hp = head.getWorldPosition(new THREE.Vector3());
      cam.position.set(0.35, hp.y - 0.02, 1.45);
      cam.lookAt(0, hp.y - 0.12, 0);
      this.renderer.setRenderTarget(rt);
      this.renderer.render(scene, cam);
      this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf);
      const img = g.createImageData(W, H);
      for (let y = 0; y < H; y++) img.data.set(buf.subarray((H - 1 - y) * W * 4, (H - y) * W * 4), y * W * 4);
      g.putImageData(img, 0, 0);
      this.portraits[ch.id] = c.toDataURL();
      scene.remove(body.root);
    }
    this.renderer.toneMapping = prevTone;
    this.renderer.setRenderTarget(null);
    rt.dispose();
  }
}
