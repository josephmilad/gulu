import * as THREE from 'three';

/** Winter night: sky gradient, fog, moonlight with a shadow box that follows the action, snowfall. */
export class Environment {
  sun: THREE.DirectionalLight;
  private snow: THREE.Points;
  private snowVel: Float32Array;
  private readonly box = { x: 70, y: 36, z: 70 };
  wind = new THREE.Vector2(0.8, 0.3);

  constructor(scene: THREE.Scene, envMap?: THREE.Texture) {
    const c = document.createElement('canvas');
    c.width = 4;
    c.height = 256;
    const g = c.getContext('2d')!;
    const gr = g.createLinearGradient(0, 0, 0, 256);
    gr.addColorStop(0, '#05070f');
    gr.addColorStop(0.45, '#141b33');
    gr.addColorStop(0.62, '#2d3152');
    gr.addColorStop(0.72, '#4a3d55');
    gr.addColorStop(1, '#1a1c28');
    g.fillStyle = gr;
    g.fillRect(0, 0, 4, 256);
    const sky = new THREE.CanvasTexture(c);
    sky.colorSpace = THREE.SRGBColorSpace;
    sky.mapping = THREE.EquirectangularReflectionMapping;
    scene.background = sky;
    scene.fog = new THREE.Fog(0x232a40, 25, 230);

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

    // Moon
    const moon = new THREE.Mesh(new THREE.CircleGeometry(9, 24), new THREE.MeshBasicMaterial({ color: 0xf2f0e0, fog: false }));
    moon.position.set(-260, 210, -380);
    moon.lookAt(0, 0, 0);
    scene.add(moon);

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

  private t = 0;
  update(dt: number, focus: THREE.Vector3) {
    this.t += dt;
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
