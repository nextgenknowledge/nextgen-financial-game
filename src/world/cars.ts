/**
 * Street vehicle models. Each model is two merged geometries:
 *   paint – white vertex color, tinted per instance (body panels)
 *   trim  – fixed colors (glass, tyres, lights, bumpers, plates)
 * Local frame: front = +Z, ground at y = 0. Real-world proportions (meters).
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import type { CarModel } from './builders/streetscape';

export type AnyCarModel = CarModel | 'bus';

export interface CarGeo {
  paint: THREE.BufferGeometry;
  trim: THREE.BufferGeometry;
  length: number;
}

const GLASS = '#1f2731';
const TYRE = '#141516';
const HUB = '#9aa0a6';
const BLACK = '#1b1c1f';
const HEAD = '#f1efe4';
const TAIL = '#8f1b16';
const PLATE = '#e9e6dc';
const PAINT = '#ffffff';

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);

interface Spec {
  L: number; // length
  W: number; // width
  wheelR: number;
  wheelbase: number;
  sill: number; // bottom of body
  belt: number; // top of lower body (window line)
  roof: number; // roof height
  hood: number; // hood length from the front bumper to the windshield base
  deck: number; // trunk length from the rear bumper to the rear-window base (0 = hatchback)
  rake: number; // windshield horizontal run
}

function wheels(t: VoxelBuilder, s: Spec) {
  for (const x of [-1, 1])
    for (const z of [-1, 1]) {
      const wx = x * (s.W / 2 - 0.14);
      const wz = z * (s.wheelbase / 2);
      t.geom(cylinder(s.wheelR, s.wheelR, 0.24, 14), trs(wx, s.wheelR, wz, 0, 0, Math.PI / 2), TYRE);
      t.geom(cylinder(s.wheelR * 0.58, s.wheelR * 0.58, 0.26, 10), trs(wx, s.wheelR, wz, 0, 0, Math.PI / 2), HUB);
      // Dark wheel arch recess behind the tyre
      t.box(x * (s.W / 2 - 0.18), s.wheelR + 0.06, wz, 0.3, s.wheelR * 2 + 0.06, s.wheelR * 2.3, '#0b0c0d');
    }
}

/** Generic three-box (or two-box) car body. */
function car(s: Spec, extras?: (p: VoxelBuilder, t: VoxelBuilder) => void): CarGeo {
  const p = new VoxelBuilder();
  const t = new VoxelBuilder();
  const { L, W } = s;
  const front = L / 2;
  const rear = -L / 2;
  // Lower body
  p.box(0, (s.sill + s.belt) / 2, 0, W, s.belt - s.sill, L - 0.2, PAINT);
  // Shoulders: slightly narrower top edge for a softer silhouette
  p.box(0, s.belt + 0.03, 0, W - 0.08, 0.06, L - 0.3, PAINT, { topTint: 1.06 });
  // Cabin
  const wsBase = front - s.hood;
  const wsTop = wsBase - s.rake;
  const rwBase = rear + (s.deck || 0.35);
  const rwTop = s.deck ? rwBase + s.rake * 0.9 : rwBase + 0.15;
  const cabinW = W - 0.22;
  const glassH = s.roof - s.belt - 0.06;
  p.box(0, s.roof, (wsTop + rwTop) / 2, cabinW, 0.07, wsTop - rwTop, PAINT, { topTint: 1.08 });
  // Raked windshield and rear window
  const wsLen = Math.hypot(s.rake, glassH);
  t.geom(box(cabinW - 0.04, 0.05, wsLen), trs(0, s.belt + glassH / 2 + 0.03, (wsBase + wsTop) / 2, Math.atan2(glassH, s.rake), 0, 0), GLASS);
  const rwRun = rwTop - rwBase;
  t.geom(box(cabinW - 0.04, 0.05, Math.hypot(rwRun, glassH)), trs(0, s.belt + glassH / 2 + 0.03, (rwBase + rwTop) / 2, -Math.atan2(glassH, rwRun), 0, 0), GLASS);
  // Side glass with B-pillar
  for (const x of [-1, 1]) {
    t.box(x * (cabinW / 2), s.belt + 0.06 + glassH / 2, (wsTop + rwTop) / 2, 0.04, glassH - 0.04, wsTop - rwTop - 0.05, GLASS, { ao: false });
    p.box(x * (cabinW / 2 + 0.005), s.belt + 0.06 + glassH / 2, (wsTop + rwTop) / 2 - 0.05, 0.05, glassH, 0.09, PAINT);
    // Door seams
    for (const z of [wsBase - 0.05, (wsTop + rwTop) / 2 - 0.05, rwBase + 0.25]) t.box(x * (W / 2 + 0.002), (s.sill + s.belt) / 2 + 0.03, z, 0.01, s.belt - s.sill - 0.12, 0.02, BLACK, { ao: false });
    // Mirrors
    t.box(x * (W / 2 + 0.06), s.belt + 0.1, wsBase - 0.15, 0.12, 0.1, 0.18, BLACK);
    // Door handles
    t.box(x * (W / 2 + 0.01), s.belt - 0.08, (wsTop + rwTop) / 2 + 0.3, 0.02, 0.03, 0.14, '#5d636b', { ao: false });
  }
  // Bumpers, grille, lights, plates
  for (const [z, dir] of [[front, 1], [rear, -1]] as const) {
    t.box(0, s.sill + 0.12, z - dir * 0.08, W + 0.02, 0.24, 0.2, '#2a2c2f');
    t.box(0, s.sill + 0.16, z + dir * 0.005, 0.52, 0.12, 0.02, PLATE, { ao: false });
  }
  t.box(0, s.belt - 0.18, front - 0.09, W * 0.48, 0.16, 0.04, '#141516', { ao: false });
  for (const x of [-1, 1]) {
    t.box(x * (W / 2 - 0.26), s.belt - 0.13, front - 0.09, 0.34, 0.12, 0.04, HEAD, { ao: false });
    t.box(x * (W / 2 - 0.22), s.belt - 0.12, rear + 0.09, 0.32, 0.12, 0.04, TAIL, { ao: false });
  }
  wheels(t, s);
  extras?.(p, t);
  return { paint: p.build(), trim: t.build(), length: L };
}

function bus(): CarGeo {
  const p = new VoxelBuilder();
  const t = new VoxelBuilder();
  const L = 11;
  const W = 2.5;
  p.box(0, 1.65, 0, W, 2.6, L, PAINT, { topTint: 1.05 });
  // Window band both sides and a big front screen
  for (const x of [-1, 1]) {
    t.box(x * (W / 2 + 0.005), 2.05, -0.4, 0.02, 1.05, L - 2.2, GLASS, { ao: false });
    for (let z = -L / 2 + 1.4; z < L / 2 - 1; z += 1.3) t.box(x * (W / 2 + 0.012), 2.05, z, 0.02, 1.05, 0.08, '#2a2c2f', { ao: false });
    t.box(x * (W / 2 + 0.005), 0.75, 0, 0.02, 0.4, L - 0.6, '#2a2c2f', { ao: false });
  }
  t.box(0, 2.0, L / 2 + 0.005, W - 0.2, 1.5, 0.02, GLASS, { ao: false });
  t.box(0, 2.95, L / 2 + 0.01, W - 0.5, 0.28, 0.02, '#d9a33a', { ao: false }); // destination display
  t.box(0, 0.55, L / 2 + 0.05, W + 0.02, 0.3, 0.12, '#2a2c2f');
  for (const x of [-1, 1]) t.box(x * 0.9, 0.85, L / 2 + 0.03, 0.3, 0.14, 0.04, HEAD, { ao: false });
  t.box(0, 3.05, 0, W - 0.6, 0.18, 3, '#8d939c'); // roof AC pod
  for (const z of [3.4, -3.4])
    for (const x of [-1, 1]) {
      t.geom(cylinder(0.5, 0.5, 0.3, 14), trs(x * (W / 2 - 0.2), 0.5, z, 0, 0, Math.PI / 2), TYRE);
      t.geom(cylinder(0.28, 0.28, 0.32, 10), trs(x * (W / 2 - 0.2), 0.5, z, 0, 0, Math.PI / 2), HUB);
    }
  return { paint: p.build(), trim: t.build(), length: L };
}

const cache = new Map<string, CarGeo>();

export function carGeometry(model: AnyCarModel): CarGeo {
  const hit = cache.get(model);
  if (hit) return hit;
  let g: CarGeo;
  switch (model) {
    case 'hatch':
      g = car({ L: 4.0, W: 1.74, wheelR: 0.31, wheelbase: 2.5, sill: 0.28, belt: 0.86, roof: 1.42, hood: 0.95, deck: 0, rake: 0.62 });
      break;
    case 'suv':
      g = car({ L: 4.7, W: 1.9, wheelR: 0.38, wheelbase: 2.85, sill: 0.42, belt: 1.08, roof: 1.75, hood: 1.15, deck: 0, rake: 0.55 });
      break;
    case 'van':
      g = car({ L: 5.2, W: 1.95, wheelR: 0.36, wheelbase: 3.2, sill: 0.36, belt: 1.05, roof: 2.25, hood: 0.7, deck: 0, rake: 0.45 }, (p, t) => {
        // Cargo box sides have no windows: cover the rear side glass with paint
        for (const x of [-1, 1]) p.box(x * 0.86, 1.65, -0.9, 0.06, 1.15, 3.0, PAINT);
        t.box(0, 1.6, -2.6, 1.6, 1.0, 0.02, '#2a2c2f', { ao: false });
      });
      break;
    case 'taxi':
      g = car({ L: 4.6, W: 1.8, wheelR: 0.33, wheelbase: 2.75, sill: 0.3, belt: 0.88, roof: 1.45, hood: 1.25, deck: 0.95, rake: 0.65 }, (_p, t) => {
        t.box(0, 1.6, -0.25, 0.75, 0.22, 0.28, '#f4f1ea');
        t.box(0, 1.6, -0.1, 0.7, 0.12, 0.01, '#1b1c1f', { ao: false });
      });
      break;
    case 'bus':
      g = bus();
      break;
    case 'sedan':
    default:
      g = car({ L: 4.6, W: 1.8, wheelR: 0.33, wheelbase: 2.75, sill: 0.3, belt: 0.88, roof: 1.45, hood: 1.25, deck: 0.95, rake: 0.65 });
      break;
  }
  cache.set(model, g);
  return g;
}

/** Paint is tinted per instance; trim keeps its colors. */
export const carPaintMat = new THREE.MeshLambertMaterial({ vertexColors: true });
export const carTrimMat = new THREE.MeshLambertMaterial({ vertexColors: true });
