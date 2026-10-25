import { Effect } from 'postprocessing';
import * as THREE from 'three';

/**
 * Film-style grade in the spirit of modern open-world games: cool teal
 * shadows, warm sodium highlights, a soft S-curve, slightly lifted blacks.
 */
export class GradeEffect extends Effect {
  constructor() {
    super('GradeEffect', /* glsl */ `
      uniform vec3 uShadow;
      uniform vec3 uHigh;
      uniform float uAmount;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 tint = mix(uShadow, uHigh, smoothstep(0.05, 0.6, l));
        c = mix(c, c * tint * 1.6, uAmount);
        // Soft S-curve with lifted blacks.
        c = c * c * (3.0 - 2.0 * c) * 0.55 + c * 0.45;
        c = c * 0.97 + 0.012;
        outputColor = vec4(c, inputColor.a);
      }`,
      {
        uniforms: new Map<string, THREE.Uniform>([
          ['uShadow', new THREE.Uniform(new THREE.Color(0.5, 0.62, 0.72))],
          ['uHigh', new THREE.Uniform(new THREE.Color(0.72, 0.6, 0.48))],
          ['uAmount', new THREE.Uniform(0.35)],
        ]),
      },
    );
  }
}
