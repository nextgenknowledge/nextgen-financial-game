/**
 * Ground occlusion: the pavement, roads and grass get darker right next to buildings, walls and big
 * props, the way real ground is shaded where less sky can reach it. Without it, buildings look like
 * they were pasted onto the street.
 *
 * Built once per city: every footprint is drawn from above into a small canvas as a soft blurred
 * shadow (about one pixel per metre), then the world shader samples it by world position. No
 * runtime cost beyond one texture lookup, so it runs on every quality setting.
 */
import * as THREE from 'three';
import { worldUniforms } from './atlas';

export interface AOShape {
  cx: number;
  cz: number;
  w: number;
  d: number;
  /** Rotation about Y, the same convention as the building frames and colliders. */
  rot: number;
}

const PX_PER_M = 1;
/** How far the soft shade spreads out from a wall, in metres. */
const SPREAD = 4;

let current: THREE.CanvasTexture | null = null;

export function setGroundAO(shapes: AOShape[], bounds: { minX: number; maxX: number; minZ: number; maxZ: number }) {
  if (typeof document === 'undefined') return;
  const pad = SPREAD * 2;
  const minX = bounds.minX - pad;
  const minZ = bounds.minZ - pad;
  const wM = bounds.maxX - bounds.minX + pad * 2;
  const dM = bounds.maxZ - bounds.minZ + pad * 2;
  const W = Math.min(2048, Math.ceil(wM * PX_PER_M));
  const H = Math.min(2048, Math.ceil(dM * PX_PER_M));
  const sx = W / wM;
  const sz = H / dM;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#fff';
  g.fillRect(0, 0, W, H);
  // Draw each shape far off to the side and let only its blurred shadow land on the canvas:
  // shadowBlur works in every browser, unlike canvas filters
  const OFF = W + H + 100;
  g.shadowColor = 'rgba(0,0,0,1)';
  g.shadowBlur = SPREAD * Math.min(sx, sz) * 1.6;
  g.shadowOffsetX = OFF;
  g.fillStyle = '#000';
  for (const s of shapes) {
    g.save();
    g.translate((s.cx - minX) * sx - OFF, (s.cz - minZ) * sz);
    g.rotate(-s.rot);
    g.fillRect((-s.w / 2) * sx, (-s.d / 2) * sz, s.w * sx, s.d * sz);
    g.restore();
  }
  current?.dispose();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.NoColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  current = tex;
  worldUniforms.uGroundAO.value = tex;
  worldUniforms.uAOBox.value.set(minX, minZ, wM, dM);
  worldUniforms.uAOOn.value = 1;
}

/** Indoors there is no city footprint to shade by. */
export function clearGroundAO() {
  worldUniforms.uAOOn.value = 0;
}
