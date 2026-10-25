import * as THREE from 'three';

/** Night sky dome: stars, moon with halo, and low clouds lit orange by the town. */
export function makeSky() {
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(600, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      uniforms: { uTime: { value: 0 } },
      vertexShader: /* glsl */ `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vDir;
        float hash(vec3 p) { p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        float noise(vec3 x) {
          vec3 i = floor(x), f = fract(x);
          f = f * f * (3.0 - 2.0 * f);
          return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
                     mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
        }
        float fbm(vec3 p) { float a = 0.5, s = 0.0; for (int i = 0; i < 5; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main() {
          vec3 d = normalize(vDir);
          float h = clamp(d.y, -0.2, 1.0);
          vec3 zen = vec3(0.012, 0.018, 0.045);
          vec3 hor = vec3(0.16, 0.11, 0.09);
          vec3 col = mix(hor, zen, smoothstep(0.0, 0.45, h));
          vec3 sp = floor(d * 380.0);
          float st = step(0.9975, hash(sp)) * smoothstep(0.05, 0.4, h);
          col += vec3(0.9, 0.92, 1.0) * st * (0.5 + 0.5 * sin(uTime * 2.0 + hash(sp) * 50.0));
          vec3 moonDir = normalize(vec3(-0.45, 0.42, -0.78));
          float md = dot(d, moonDir);
          col += vec3(0.95, 0.93, 0.85) * smoothstep(0.9993, 0.9996, md) * 3.0;
          col += vec3(0.25, 0.27, 0.35) * pow(max(md, 0.0), 180.0) * 0.6;
          vec2 cuv = d.xz / max(d.y + 0.12, 0.05);
          float c = fbm(vec3(cuv * 0.6 + vec2(uTime * 0.004, uTime * 0.002), uTime * 0.01));
          float cloud = smoothstep(0.45, 0.8, c) * smoothstep(0.0, 0.25, h);
          vec3 ccol = mix(vec3(0.17, 0.12, 0.1), vec3(0.07, 0.07, 0.1), smoothstep(0.0, 0.6, h));
          col = mix(col, ccol, cloud * 0.85);
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  sky.frustumCulled = false;
  sky.renderOrder = -1;
  return sky;
}
