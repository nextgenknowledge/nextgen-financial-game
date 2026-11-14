'use client';
/**
 * A soft dark patch on the ground under a character, pet or ridden vehicle, so they look planted
 * instead of floating. Drawn wherever there are no real shadows: everywhere on Low graphics, and
 * indoors on every setting.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rt } from '@/engine/runtime';
import { useSettings } from '@/store/settings';
import { useScene } from '@/store/scene';

let tex: THREE.Texture | null = null;
function blobTexture(): THREE.Texture {
  if (tex) return tex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.45, 'rgba(255,255,255,0.62)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  tex = new THREE.CanvasTexture(c);
  return tex;
}

const geo = new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2);
let mat: THREE.MeshBasicMaterial | null = null;
function blobMaterial(): THREE.MeshBasicMaterial {
  mat ??= new THREE.MeshBasicMaterial({ color: '#060a18', alphaMap: blobTexture(), transparent: true, opacity: 0.42, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
  return mat;
}

/** Whether contact shadows are needed in the current scene. */
export function useContactShadows(): boolean {
  const low = useSettings((s) => s.quality) === 'low';
  const indoors = useScene((s) => s.interior) !== null;
  return low || indoors;
}

/**
 * `r` is the radius in metres; `rx`/`rz` make an oval (cars). With `player`, the patch stays on
 * the ground and shrinks while the player is in the air.
 */
export function ContactShadow({ r = 0.5, rx, rz, player = false }: { r?: number; rx?: number; rz?: number; player?: boolean }) {
  const on = useContactShadows();
  const ref = useRef<THREE.Mesh>(null);
  const floor = useRef(0);
  useFrame(() => {
    const m = ref.current;
    if (!m || !player) return;
    if (rt.grounded) floor.current = rt.player.y;
    const up = Math.max(0, rt.player.y - floor.current);
    m.position.y = 0.04 - up;
    const k = 1 / (1 + up * 0.5);
    m.scale.set((rx ?? r) * k, 1, (rz ?? r) * k);
  });
  if (!on) return null;
  return <mesh ref={ref} geometry={geo} material={blobMaterial()} position={[0, 0.04, 0]} scale={[rx ?? r, 1, rz ?? r]} renderOrder={2} />;
}
