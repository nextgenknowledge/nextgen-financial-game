'use client';
/**
 * Bloom: bright things (neon, headlights, street lamps, lit windows, the sun) bleed soft light into
 * their surroundings the way they do through a real camera lens. Subtle by day, stronger at night.
 * Medium and High quality only; Low renders straight to the screen.
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { rt } from './runtime';

export function PostFX({ quality, interior }: { quality: 'medium' | 'high'; interior: boolean }) {
  const { gl, scene, camera, size } = useThree();
  const fx = useMemo(() => {
    const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: quality === 'high' ? 4 : 2 });
    const composer = new EffectComposer(gl, target);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.3, 0.55, 0.95);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());
    return { composer, bloom, target };
  }, [gl, scene, camera, quality]);
  useEffect(() => {
    fx.composer.setPixelRatio(gl.getPixelRatio());
    fx.composer.setSize(size.width, size.height);
  }, [fx, gl, size]);
  useEffect(() => () => {
    fx.composer.dispose();
    fx.target.dispose();
  }, [fx]);
  useFrame(() => {
    const night = interior ? 0.25 : Math.max(0, Math.min(1, (0.85 - rt.dayLight) / 0.6));
    fx.bloom.strength = 0.14 + night * 0.32;
    fx.bloom.threshold = 0.92 - night * 0.2;
    fx.bloom.radius = 0.45 + night * 0.15;
    fx.composer.render();
  }, 1);
  return null;
}
