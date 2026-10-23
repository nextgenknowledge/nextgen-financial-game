import * as THREE from 'three';
import { useAtlas, worldUniforms } from '@/engine/atlas';

/** Shared materials: few materials = few shader programs = fast on Chromebooks. */
export const M = {
  vc: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true })),
  ground: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true }), 'ground'),
  lit: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#ffcf7a'), emissiveIntensity: 0 })),
  /** Trees and hedges: same look as `vc`, plus wind sway. */
  foliage: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true }), 'foliage'),
  /** Landmark portals: a little self-light so the icons read even when backlit. */
  landmark: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true }), 'landmark'),
  dark: useAtlas(new THREE.MeshLambertMaterial({ vertexColors: true }), 'glass'),
  neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  glow: new THREE.MeshBasicMaterial({ color: '#fff2b0', transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
  bulb: new THREE.MeshBasicMaterial({ color: '#fff6d0', toneMapped: false }),
};

let glowTex: THREE.Texture | null = null;
/** Soft radial gradient for light halos. */
export function glowTexture(): THREE.Texture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,240,190,1)');
  grd.addColorStop(0.35, 'rgba(255,220,150,0.45)');
  grd.addColorStop(1, 'rgba(255,200,120,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  glowTex.colorSpace = THREE.SRGBColorSpace;
  return glowTex;
}

/** Update emissive strength of night-sensitive materials. dayLight: 1 = noon, 0 = midnight. */
export function updateNightMaterials(dayLight: number) {
  const night = 1 - dayLight;
  M.lit.emissiveIntensity = night * 0.95;
  M.glow.opacity = Math.max(0, night - 0.15) * 0.9;
  worldUniforms.uNight.value = Math.max(0, Math.min(1, (night - 0.25) / 0.5));
  worldUniforms.uTime.value = performance.now() / 1000;
}
