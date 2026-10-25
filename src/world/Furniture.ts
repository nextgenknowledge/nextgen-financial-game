/**
 * 3D models for the Furniture Store's pieces, as they stand in your home. Each is built around
 * its own centre on the floor, front facing +z, and fits the footprint in FURNITURE_SIZE so what
 * you see matches what the room planner checks.
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs } from '@/engine/voxel';
import { plant } from './interiors/furnish';

export interface FurnitureGeo {
  solid: THREE.BufferGeometry;
  /** Lit parts (screens, lamp shades, aquarium water). */
  glow: THREE.BufferGeometry | null;
}

const cache = new Map<string, FurnitureGeo>();
const WOOD = '#8a5a34';
const DARK_WOOD = '#4a3324';
const STEEL = '#8d939c';
const BLACK = '#1e2026';

export function furnitureGeometry(itemId: string): FurnitureGeo {
  const hit = cache.get(itemId);
  if (hit) return hit;
  const b = new VoxelBuilder();
  const g = new VoxelBuilder();
  let glow = false;
  const lit = (cx: number, cy: number, cz: number, w: number, h: number, d: number, c: string) => {
    g.box(cx, cy, cz, w, h, d, c);
    glow = true;
  };
  switch (itemId) {
    case 'beanbag':
      b.geom(sphere(0.5, 10, 7), trs(0, 0.3, 0, 0, 0, 0, 1, 0.62, 1), '#d9653b');
      b.geom(sphere(0.34, 9, 6), trs(0, 0.5, -0.22, 0, 0, 0, 1.2, 0.8, 0.6), '#c4552f');
      break;
    case 'desk':
      b.box(0, 0.74, 0, 1.6, 0.06, 0.8, WOOD, { tex: 'wood' });
      for (const x of [-0.74, 0.74]) b.box(x, 0.36, 0, 0.06, 0.72, 0.74, WOOD, { tex: 'wood' });
      b.box(0.45, 0.45, 0, 0.6, 0.5, 0.7, WOOD, { tex: 'wood' });
      b.box(0.45, 0.45, 0.36, 0.5, 0.04, 0.02, DARK_WOOD);
      // Laptop and desk lamp
      b.box(-0.2, 0.78, 0.05, 0.5, 0.02, 0.34, '#c0c4cc');
      b.box(-0.2, 0.94, -0.12, 0.5, 0.32, 0.02, '#c0c4cc');
      lit(-0.2, 0.94, -0.105, 0.44, 0.26, 0.01, '#9fd3f0');
      b.box(0.6, 0.95, -0.25, 0.04, 0.4, 0.04, BLACK);
      lit(0.6, 1.17, -0.18, 0.2, 0.1, 0.2, '#fff1c4');
      break;
    case 'bed':
      b.box(0, 0.2, 0, 1.8, 0.4, 2.3, DARK_WOOD, { tex: 'wood' });
      b.box(0, 0.48, 0.05, 1.7, 0.2, 2.15, '#f4f2ee');
      b.box(0, 0.62, 0.35, 1.72, 0.1, 1.5, '#2f6bdb');
      b.box(0, 0.6, -0.78, 1.3, 0.16, 0.45, '#ffffff');
      b.box(0, 0.65, -1.12, 1.8, 0.9, 0.08, DARK_WOOD, { tex: 'wood' });
      break;
    case 'sofa':
      b.box(0, 0.22, 0, 2.4, 0.3, 1.0, '#3a4a6a');
      b.box(0, 0.44, 0.1, 2.1, 0.16, 0.76, '#48608a');
      b.box(0, 0.68, -0.4, 2.4, 0.56, 0.22, '#3a4a6a');
      for (const x of [-1.1, 1.1]) b.box(x, 0.5, 0, 0.2, 0.36, 1.0, '#3a4a6a');
      for (const x of [-0.55, 0.55]) b.box(x, 0.62, -0.22, 0.5, 0.36, 0.12, '#e8c46a');
      break;
    case 'lamp':
      b.geom(cylinder(0.18, 0.2, 0.3, 10), trs(0, 0.15, 0), '#2a2f3d');
      g.geom(cylinder(0.12, 0.15, 0.55, 10), trs(0, 0.58, 0), '#ff4f8a');
      for (let k = 0; k < 4; k++) g.geom(sphere(0.05 + (k % 2) * 0.03, 6, 4), trs((k % 2) * 0.04 - 0.02, 0.42 + k * 0.12, 0), '#ffd23f');
      b.geom(cylinder(0.08, 0.12, 0.14, 10), trs(0, 0.92, 0), '#2a2f3d');
      glow = true;
      break;
    case 'plant':
      plant(b, 0, 0, false);
      break;
    case 'bookshelf': {
      b.box(0, 1.0, 0, 1.4, 2.0, 0.45, WOOD, { tex: 'wood' });
      const spines = ['#b3261e', '#2f5f9a', '#e0b03a', '#3f6e34', '#6b3f8a', '#e9e4da'];
      for (let r = 0; r < 4; r++)
        for (let k = 0; k < 9; k++) {
          const h = 0.26 + ((k * 7 + r * 3) % 5) * 0.03;
          b.box(-0.56 + k * 0.14, 0.18 + r * 0.46 + h / 2, 0.06, 0.11, h, 0.3, spines[(k + r * 2) % spines.length]);
        }
      break;
    }
    case 'tv':
      b.box(0, 0.25, 0, 2.0, 0.5, 0.5, DARK_WOOD, { tex: 'wood' });
      b.box(0, 1.15, -0.05, 2.2, 1.0, 0.08, BLACK);
      lit(0, 1.15, -0.005, 2.06, 0.88, 0.01, '#5aa8e0');
      b.box(0, 0.58, -0.05, 0.3, 0.16, 0.2, BLACK);
      break;
    case 'game-console':
      b.box(0, 0.2, 0, 1.0, 0.4, 0.5, '#e9e4da');
      b.box(0, 0.48, 0, 0.5, 0.12, 0.34, BLACK);
      lit(0.18, 0.49, 0.172, 0.06, 0.03, 0.01, '#3dd6ff');
      b.box(-0.28, 0.44, 0.12, 0.24, 0.05, 0.14, '#2a2f3d');
      b.box(0.28, 0.44, 0.12, 0.24, 0.05, 0.14, '#2a2f3d');
      break;
    case 'aquarium':
      b.box(0, 0.4, 0, 1.4, 0.8, 0.6, DARK_WOOD, { tex: 'wood' });
      lit(0, 1.12, 0, 1.36, 0.62, 0.56, '#3f8fb0');
      b.box(0, 1.46, 0, 1.42, 0.06, 0.62, BLACK);
      for (let k = 0; k < 6; k++) lit(-0.5 + k * 0.2, 0.95 + ((k * 3) % 4) * 0.08, 0.29, 0.1, 0.05, 0.01, ['#ffb040', '#ff6a8a', '#ffe060'][k % 3]);
      break;
    case 'rug':
      b.box(0, 0.012, 0, 2.6, 0.02, 1.8, '#b04a5a');
      b.box(0, 0.024, 0, 2.2, 0.01, 1.4, '#e8c46a');
      b.box(0, 0.03, 0, 1.6, 0.01, 0.9, '#b04a5a');
      break;
    case 'piano':
      b.box(0, 0.75, -0.25, 1.6, 1.3, 0.7, BLACK);
      b.box(0, 0.75, 0.25, 1.5, 0.08, 0.36, '#f4f2ee');
      for (let k = 0; k < 10; k++) b.box(-0.6 + k * 0.14, 0.8, 0.2, 0.06, 0.03, 0.2, BLACK);
      for (const x of [-0.7, 0.7]) b.box(x, 0.36, 0.3, 0.08, 0.72, 0.08, BLACK);
      b.box(0, 0.25, 0.55, 0.9, 0.5, 0.36, BLACK);
      break;
    case 'hot-tub':
      b.box(0, 0.45, 0, 2.4, 0.9, 2.4, '#8a6a4a', { tex: 'wood' });
      lit(0, 0.86, 0, 2.0, 0.04, 2.0, '#5fd0e0');
      for (const [x, z] of [[-0.9, -0.9], [0.9, 0.9]]) b.box(x, 0.94, z, 0.3, 0.06, 0.3, '#f4f2ee');
      break;
    case 'arcade-cab':
      b.box(0, 0.95, -0.05, 0.9, 1.9, 0.8, '#2a2f6a');
      b.box(0, 1.0, 0.3, 0.86, 0.12, 0.3, '#1e2026');
      lit(0, 1.38, 0.32, 0.66, 0.5, 0.02, '#7fd0ff');
      lit(0, 1.82, 0.36, 0.8, 0.16, 0.02, '#ff4f8a');
      for (const x of [-0.18, 0.12, 0.24]) b.box(x, 1.08, 0.4, 0.06, 0.04, 0.06, x < 0 ? '#e83a2e' : '#f2c234');
      break;
    default:
      b.box(0, 0.4, 0, 0.8, 0.8, 0.8, WOOD);
  }
  const out = { solid: b.build(), glow: glow ? g.build() : null };
  cache.set(itemId, out);
  return out;
}

/** A goldfish bowl on a little stand, shown in your home if you own a goldfish. */
export function fishbowlGeometry(): FurnitureGeo {
  const hit = cache.get('__fishbowl');
  if (hit) return hit;
  const b = new VoxelBuilder();
  const g = new VoxelBuilder();
  b.box(0, 0.4, 0, 0.5, 0.8, 0.5, WOOD, { tex: 'wood' });
  g.geom(sphere(0.24, 10, 7), trs(0, 1.04, 0), '#7fc8e8');
  g.box(0.04, 1.02, 0.1, 0.08, 0.05, 0.03, '#ff9a3c');
  b.geom(cylinder(0.16, 0.16, 0.04, 10), trs(0, 0.82, 0), STEEL);
  const out = { solid: b.build(), glow: g.build() };
  cache.set('__fishbowl', out);
  return out;
}
