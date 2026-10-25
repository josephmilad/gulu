import * as THREE from 'three';
import { makeSky } from './Sky';

/** Winter night: sky gradient, fog, moonlight with a shadow box that follows the action, snowfall. */
export class Environment {
  sun: THREE.DirectionalLight;
  private snow: THREE.Points;
  private snowVel: Float32Array;
  private readonly box = { x: 70, y: 36, z: 70 };
  wind = new THREE.Vector2(0.8, 0.3);
  sky: THREE.Mesh;
  /** Real point lights that hop between the street lamps nearest the player. */
  private lamps: THREE.PointLight[] = [];
  private lampSpots: THREE.Vector3[] = [];
  private lampT = 0;
  /** How many real lamp lights are lit (graphics quality). */
  lampBudget = 10;

  constructor(scene: THREE.Scene, envMap?: THREE.Texture) {
    scene.background = new THREE.Color(0x0b0f1c);
    scene.fog = new THREE.Fog(0x2a2733, 30, 260);
    this.sky = makeSky();
    scene.add(this.sky);

    if (envMap) {
      // Image-based light from a real snowy night courtyard (Poly Haven, CC0).
      scene.environment = envMap;
      scene.environmentIntensity = 0.32;
      scene.environmentRotation.y = 1.2;
    }
    scene.add(new THREE.HemisphereLight(0x8090c0, 0x30303c, envMap ? 0.35 : 1.1));
    const sun = new THREE.DirectionalLight(0xb8c8ff, 1.3);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    const s = sun.shadow.camera;
    s.left = s.bottom = -40;
    s.right = s.top = 40;
    s.near = 1;
    s.far = 220;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);
    this.sun = sun;

    const n = 5000;
    const pos = new Float32Array(n * 3);
    this.snowVel = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = (Math.random() - 0.5) * this.box.x;
      pos[i * 3 + 1] = Math.random() * this.box.y;
      pos[i * 3 + 2] = (Math.random() - 0.5) * this.box.z;
      this.snowVel[i] = 1.2 + Math.random() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const flake = document.createElement('canvas');
    flake.width = flake.height = 32;
    const fg = flake.getContext('2d')!;
    const fr = fg.createRadialGradient(16, 16, 0, 16, 16, 16);
    fr.addColorStop(0, 'rgba(255,255,255,1)');
    fr.addColorStop(1, 'rgba(255,255,255,0)');
    fg.fillStyle = fr;
    fg.fillRect(0, 0, 32, 32);
    this.snow = new THREE.Points(geo, new THREE.PointsMaterial({
      size: 0.1, map: new THREE.CanvasTexture(flake), transparent: true, depthWrite: false, opacity: 0.9, color: 0xffffff,
    }));
    this.snow.frustumCulled = false;
    scene.add(this.snow);
  }

  setLampSpots(spots: THREE.Vector3[], scene: THREE.Scene) {
    this.lampSpots = spots;
    for (let i = 0; i < 10; i++) {
      const l = new THREE.PointLight(0xffb060, 0, 26, 1.6);
      this.lamps.push(l);
      scene.add(l);
    }
  }

  private t = 0;
  update(dt: number, focus: THREE.Vector3) {
    this.t += dt;
    this.sky.position.copy(focus);
    ((this.sky.material as THREE.ShaderMaterial).uniforms.uTime as { value: number }).value = this.t;
    this.lampT -= dt;
    if (this.lampT <= 0 && this.lampSpots.length) {
      this.lampT = 0.3;
      const near = this.lampSpots
        .map((p) => [p, (p.x - focus.x) ** 2 + (p.z - focus.z) ** 2] as const)
        .sort((a, b) => a[1] - b[1])
        .slice(0, this.lamps.length);
      near.forEach(([p], i) => {
        this.lamps[i].position.copy(p);
        this.lamps[i].intensity = i < this.lampBudget ? 55 : 0;
      });
    }
    this.sun.position.set(focus.x + 40, 90, focus.z + 30);
    this.sun.target.position.set(focus.x, 0, focus.z);
    const p = this.snow.geometry.attributes.position as THREE.BufferAttribute;
    const a = p.array as Float32Array;
    const { x: bx, y: by, z: bz } = this.box;
    const gust = Math.sin(this.t * 0.3) * 0.6;
    for (let i = 0; i < this.snowVel.length; i++) {
      const k = i * 3;
      a[k] += (this.wind.x + gust + Math.sin(this.t + i) * 0.3) * dt;
      a[k + 1] -= this.snowVel[i] * dt;
      a[k + 2] += (this.wind.y + Math.cos(this.t * 0.7 + i) * 0.3) * dt;
      // Wrap into a box centred on the camera focus.
      a[k] = focus.x + ((((a[k] - focus.x + bx / 2) % bx) + bx) % bx) - bx / 2;
      a[k + 2] = focus.z + ((((a[k + 2] - focus.z + bz / 2) % bz) + bz) % bz) - bz / 2;
      if (a[k + 1] < 0) a[k + 1] += by;
    }
    p.needsUpdate = true;
  }
}
