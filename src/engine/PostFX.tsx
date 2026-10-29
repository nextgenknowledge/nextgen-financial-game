'use client';
/**
 * Bloom: bright things (neon, headlights, street lamps, lit windows, the sun) bleed soft light into
 * their surroundings the way they do through a real camera lens. Subtle by day, stronger at night.
 * Then a light colour grade, like a film camera: a touch more contrast, warm highlights, cool
 * shadows and a soft vignette. Medium and High quality only; Low renders straight to the screen.
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { rt } from './runtime';

/** Runs on the final display colours (after tone mapping), so the numbers read like a photo editor's. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.06 },
    saturation: { value: 1.04 },
    warm: { value: 0.03 },
    vignette: { value: 0.22 },
  },
  vertexShader: /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */ `
uniform sampler2D tDiffuse; uniform float contrast; uniform float saturation; uniform float warm; uniform float vignette;
varying vec2 vUv;
void main() {
  vec4 t = texture2D(tDiffuse, vUv);
  vec3 c = t.rgb;
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  c = mix(vec3(l), c, saturation);
  c = (c - 0.5) * contrast + 0.5;
  // Split tone: warm the highlights, cool the shadows
  c += vec3(warm, warm * 0.35, -warm) * smoothstep(0.45, 1.0, l);
  c += vec3(-warm, 0.0, warm * 1.2) * (1.0 - smoothstep(0.0, 0.4, l)) * 0.6;
  vec2 q = vUv - 0.5;
  c *= 1.0 - vignette * smoothstep(0.25, 0.8, dot(q, q) * 2.2);
  gl_FragColor = vec4(clamp(c, 0.0, 1.0), t.a);
}`,
};

export function PostFX({ quality, interior }: { quality: 'medium' | 'high'; interior: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const dpr = useThree((s) => s.viewport.dpr);
  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 0.95);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    const grade = new ShaderPass(GradeShader);
    composer.addPass(grade);
    return { composer, bloom, grade, target };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    fx.composer.setPixelRatio(gl.getPixelRatio());
    fx.composer.setSize(size.width, size.height);
  }, [fx, gl, size, dpr]);
  useEffect(() => () => {
    fx.composer.dispose();
    fx.target.dispose();
  }, [fx]);
  useFrame(() => {
    const night = interior ? 0.25 : Math.max(0, Math.min(1, (0.85 - rt.dayLight) / 0.6));
    fx.bloom.strength = 0.14 + night * 0.32;
    fx.bloom.threshold = 0.92 - night * 0.2;
    fx.bloom.radius = 0.45 + night * 0.15;
    // Indoors and at night the warm/cool split is gentler so lamps don't turn orange
    fx.grade.uniforms.warm.value = (interior ? 0.015 : 0.03) * (1 - night * 0.6);
    fx.composer.render();
  }, 1);
  return null;
}
