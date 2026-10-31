/**
 * Streetscape: everything that makes a city block feel lived-in. Sidewalk furniture, bus stops,
 * traffic signals, road markings, parked cars, rooftop billboards and stock tickers.
 * All static pieces merge into the city's single textured mesh; moving/glowing parts are returned
 * as instance lists for small dedicated components.
 */
import * as THREE from 'three';
import type { CityDef } from '@/game/content';
import type { Rng } from '@/game/rng';
import { cylinder, sphere } from '@/engine/voxel';
import { Frame, type Builders } from './buildings';
import { AD_COPY } from '../signage';
import { kerbEdge, streetName, STREET_SIGN } from './cityKit';
import type { Rect } from './sceneBuilder';

export interface SignalHead {
  x: number;
  y: number;
  z: number;
  rot: number;
  /** Which road axis this head controls ('x' = traffic travelling along x). */
  axis: 'x' | 'z';
}
export interface ParkedCar {
  x: number;
  y?: number;
  z: number;
  rot: number;
  model: CarModel;
  color: string;
  /** Delivery van double-parked with hazards on while the driver unloads. */
  hazard?: boolean;
  /** Where the driver carries boxes to (a shop door on the pavement). */
  drop?: { x: number; z: number };
}
export type CarModel = 'sedan' | 'taxi' | 'suv' | 'van' | 'hatch';

export interface Streetscape {
  signals: SignalHead[];
  parked: ParkedCar[];
  /** Steam vents in the road (New York). */
  vents: { x: number; z: number; stack: boolean }[];
}

/** A building site: where the crane stands (its jib turns in the scene) and the crew. */
export interface Site {
  lot: Rect;
  crane: { x: number; z: number; h: number; jib: number; rot: number };
  crew: { x: number; z: number; rot: number }[];
}

/** Realistic paint colors (muted, metallic-ish) used for parked and moving cars. */
const IRON = '#1f2224';

export const CAR_PAINTS = ['#e9e9e6', '#1f2226', '#8c9196', '#5a5f66', '#2f3d55', '#6b1f24', '#c9c3b4', '#3b4a3a', '#1d2b3f', '#a7a9ad', '#7a5a3a', '#b3261e'];

const CITY_EXTRAS: Record<string, string[]> = {
  'new-york': ['hotdog', 'newsbox', 'mailbox-us', 'hydrant'],
  'san-francisco': ['newsbox', 'mailbox-us', 'hydrant', 'bikerack'],
  london: ['phonebox', 'pillarbox', 'bikerack'],
  'hong-kong': ['newsbox', 'planter', 'bikerack'],
  singapore: ['planter', 'bikerack', 'bench'],
};

/* ───────── Individual props (local frame: +Z faces the road) ───────── */

function bench(f: Frame, x: number, z: number) {
  const iron = '#2b2f2c';
  for (const sx of [-0.75, 0.75]) {
    f.block(x + sx, 0.16, z, 0.08, 0.42, 0.5, iron);
    f.block(x + sx, 0.58, z - 0.22, 0.08, 0.5, 0.08, iron);
  }
  for (let k = 0; k < 3; k++) f.tb(x, 0.56, z + 0.14 - k * 0.15, 1.9, 0.06, 0.12, '#8a6440', 'wood');
  for (let k = 0; k < 2; k++) f.tb(x, 0.72 + k * 0.17, z - 0.24, 1.9, 0.11, 0.05, '#8a6440', 'wood');
}

function bin(f: Frame, x: number, z: number, color = '#2e3d33') {
  f.geom(cylinder(0.28, 0.25, 0.9, 10), x, 0.61, z, color, 0, 0, 0, 1, 'solid', 'metal');
  f.geom(cylinder(0.31, 0.31, 0.06, 10), x, 1.08, z, '#1e2420');
  f.geom(cylinder(0.12, 0.12, 0.02, 8), x, 1.12, z, '#0d0f0e');
}

function hydrant(f: Frame, x: number, z: number, color = '#b3261e') {
  f.geom(cylinder(0.13, 0.15, 0.5, 8), x, 0.41, z, color);
  f.geom(sphere(0.14, 8, 5), x, 0.68, z, color);
  f.geom(cylinder(0.06, 0.06, 0.4, 6), x, 0.5, z, shadeHex(color, 0.8), 0, 0, Math.PI / 2);
  f.geom(cylinder(0.05, 0.05, 0.2, 6), x, 0.84, z, '#d9c26a');
}

function newsbox(f: Frame, x: number, z: number, color: string) {
  f.block(x, 0.16, z, 0.48, 0.95, 0.42, color);
  f.block(x, 0.62, z + 0.215, 0.36, 0.3, 0.02, '#2b3440');
  f.block(x, 1.11, z, 0.5, 0.05, 0.44, shadeHex(color, 0.75));
}

function mailboxUS(f: Frame, x: number, z: number) {
  f.block(x, 0.16, z, 0.5, 0.95, 0.5, '#21407a', 'solid');
  f.geom(new THREE.CylinderGeometry(0.25, 0.25, 0.5, 10, 1, false, 0, Math.PI), x, 1.11, z, '#21407a', 0, 0, Math.PI / 2);
  for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) f.block(x + lx, 0.16, z + lz, 0.05, 0.2, 0.05, '#15161a');
}

function pillarbox(f: Frame, x: number, z: number) {
  f.geom(cylinder(0.27, 0.3, 1.25, 12), x, 0.79, z, '#b3261e');
  f.geom(sphere(0.29, 12, 6), x, 1.42, z, '#b3261e', 0, 0, 0, 1);
  f.block(x, 1.05, z + 0.26, 0.3, 0.05, 0.04, '#1a1a1a');
}

function phonebox(f: Frame, x: number, z: number) {
  const red = '#b3261e';
  f.block(x, 0.16, z, 1.0, 2.4, 1.0, red);
  for (const s of [-1, 1]) {
    f.block(x, 0.55, z + 0.51 * s, 0.7, 1.6, 0.02, '#2b3440');
    f.block(x + 0.51 * s, 0.55, z, 0.02, 1.6, 0.7, '#2b3440');
  }
  // Glazing bars
  for (let k = 0; k < 4; k++) f.block(x, 0.9 + k * 0.4, z + 0.52, 0.72, 0.04, 0.02, red);
  f.block(x, 2.56, z, 1.1, 0.12, 1.1, red);
  f.geom(new THREE.CylinderGeometry(0.55, 0.55, 1.0, 10, 1, false, 0, Math.PI), x, 2.68, z, red, 0, 0, Math.PI / 2, 1);
  f.block(x, 2.25, z + 0.51, 0.8, 0.16, 0.02, '#f4f1ea');
}

function bikerack(f: Frame, x: number, z: number) {
  for (let k = -1; k <= 1; k++) {
    f.block(x + k * 0.6, 0.16, z - 0.3, 0.05, 0.75, 0.05, '#8d939c');
    f.block(x + k * 0.6, 0.16, z + 0.3, 0.05, 0.75, 0.05, '#8d939c');
    f.block(x + k * 0.6, 0.88, z, 0.05, 0.05, 0.65, '#8d939c');
  }
}

function planter(f: Frame, x: number, z: number) {
  f.tb(x, 0.16, z, 1.3, 0.55, 0.7, '#a9a39a', 'concrete', 'path');
  for (const dx of [-0.35, 0.05, 0.4]) f.geom(sphere(0.32, 7, 5), x + dx, 0.85, z + (dx > 0 ? 0.08 : -0.05), '#3f6e34', 0, 0, 0, 1, 'solid', 'leaves');
}

function hotdog(f: Frame, x: number, z: number) {
  f.block(x, 0.45, z, 1.8, 0.9, 0.9, '#c9ccd1');
  f.block(x, 1.36, z, 1.85, 0.05, 0.95, '#8d939c');
  for (const [wx, wz] of [[-0.6, 0.47], [0.6, 0.47], [-0.6, -0.47], [0.6, -0.47]]) f.geom(cylinder(0.22, 0.22, 0.08, 10), x + wx, 0.3, z + wz, '#1a1a1a', Math.PI / 2);
  // Umbrella
  f.block(x, 1.4, z, 0.05, 1.4, 0.05, '#8d939c');
  f.geom(new THREE.ConeGeometry(1.25, 0.45, 8), x, 3.0, z, '#d8b23a');
  f.geom(new THREE.ConeGeometry(1.26, 0.2, 8), x, 2.8, z, '#2f5f9a');
}

function busStop(f: Frame, x: number, z: number, b: Builders, city: string, rng: Rng) {
  const steel = '#6d737c';
  for (const sx of [-1.9, 1.9]) f.block(x + sx, 0.16, z - 0.55, 0.08, 2.4, 0.08, steel);
  f.block(x, 0.16, z - 0.62, 3.8, 2.3, 0.04, '#9fb4c2', 'dark'); // glass back
  f.block(x, 1.4, z - 0.6, 3.8, 0.05, 0.05, steel); // glass rail
  f.block(x, 2.56, z - 0.1, 4.1, 0.1, 1.5, '#4d535b');
  f.block(x - 1.92, 0.16, z - 0.1, 0.04, 2.3, 1.0, '#9fb4c2', 'dark'); // glass end
  // Bench inside
  f.tb(x + 0.3, 0.56, z - 0.3, 2.2, 0.06, 0.38, '#8d939c', 'metal');
  // Ad panel at the open end + route sign pole
  f.block(x + 1.95, 0.16, z - 0.1, 0.12, 2.2, 1.25, '#2a2e33');
  const ad = AD_COPY[Math.floor(rng.next() * AD_COPY.length)];
  const [ax, az] = f.world(x + 2.02, z - 0.1);
  b.signs.push({ text: ad.name, x: ax, y: 1.25, z: az, rotY: f.rot + Math.PI / 2, w: 1.1, h: 1.8, bg: ad.bg, fg: ad.fg, kind: 'poster', sub: ad.tag });
  f.block(x - 2.6, 0.16, z + 0.6, 0.07, 2.6, 0.07, steel);
  f.block(x - 2.6, 2.4, z + 0.6, 0.5, 0.42, 0.05, city === 'london' ? '#b3261e' : '#1f4f8a');
  f.block(x - 2.6, 2.48, z + 0.63, 0.3, 0.22, 0.02, '#f4f1ea');
}

function shadeHex(hex: string, f: number) {
  const c = new THREE.Color(hex).multiplyScalar(f);
  return '#' + c.getHexString();
}

/* ───────── Placement ───────── */

interface Ctx {
  def: CityDef;
  b: Builders;
  rng: Rng;
  blocks: Rect[];
  doors: { x: number; z: number }[];
  lamps: { x: number; z: number }[];
  trees: { x: number; z: number }[];
  inWater: (x: number, z: number, m?: number) => boolean;
}

/**
 * Lays out the streetscape for a city. Must run after lamps and street trees are placed
 * so props can keep clear of them.
 */
export function buildStreetscape(c: Ctx): Streetscape {
  const { def, b, rng, blocks } = c;
  const roadW = def.roads.width;
  const xs = def.roads.xs;
  const zs = def.roads.zs;
  const signals: SignalHead[] = [];
  const parked: ParkedCar[] = [];
  const vents: Streetscape['vents'] = [];
  const taken: { x: number; z: number; r: number }[] = [
    ...c.doors.map((d) => ({ ...d, r: 3.5 })),
    ...c.lamps.map((l) => ({ ...l, r: 1.4 })),
    ...c.trees.map((t) => ({ ...t, r: 1.6 })),
    // Keep the way through the arrival gate clear of shelters, kiosks and parked cars
    { x: def.spawn[0], z: def.spawn[1] - 9, r: 12 },
  ];
  const free = (x: number, z: number, r: number) => !c.inWater(x, z, 1) && taken.every((t) => Math.hypot(t.x - x, t.z - z) > t.r + r);
  const nearIntersection = (x: number, z: number, m: number) => xs.some((rx) => Math.abs(rx - x) < roadW / 2 + m) && zs.some((rz) => Math.abs(rz - z) < roadW / 2 + m);
  const extras = CITY_EXTRAS[def.id] ?? ['bench'];
  let deliveries = 0;
  const newsColors = ['#1f4f8a', '#b3261e', '#d8b23a', '#2f5f3a'];

  for (const blk of blocks) {
    // Each edge: start point, direction along the edge, and rotation so local +Z faces the road
    const edges = [
      { x0: blk.minX, z0: blk.minZ, dx: 1, dz: 0, len: blk.maxX - blk.minX, rot: Math.PI, nx: 0, nz: -1 },
      { x0: blk.maxX, z0: blk.maxZ, dx: -1, dz: 0, len: blk.maxX - blk.minX, rot: 0, nx: 0, nz: 1 },
      { x0: blk.minX, z0: blk.maxZ, dx: 0, dz: -1, len: blk.maxZ - blk.minZ, rot: -Math.PI / 2, nx: -1, nz: 0 },
      { x0: blk.maxX, z0: blk.minZ, dx: 0, dz: 1, len: blk.maxZ - blk.minZ, rot: Math.PI / 2, nx: 1, nz: 0 },
    ];
    for (const e of edges) {
      // Is there a road on this side? (city boundary edges have none)
      const roadSide = e.nz !== 0 ? zs.some((rz) => Math.abs(rz - (e.z0 + e.nz * roadW / 2)) < 1) : xs.some((rx) => Math.abs(rx - (e.x0 + e.nx * roadW / 2)) < 1);
      if (!roadSide) continue;
      const at = (t: number, inset: number) => ({ x: e.x0 + e.dx * t - e.nx * inset, z: e.z0 + e.dz * t - e.nz * inset });
      const frame = (t: number, inset: number) => {
        const p = at(t, inset);
        return { f: new Frame(p.x, p.z, e.rot, b), p };
      };
      // Kerb stones (and local kerb paint / railings) along the whole edge
      {
        const mid = at(e.len / 2, 0);
        kerbEdge(def.id, new Frame(mid.x, mid.z, e.rot, b), e.len, rng);
      }

      // Bus stop near the middle of long edges
      if (e.len > 30 && rng.chance(0.55)) {
        const t = e.len / 2 + rng.range(-6, 6);
        const { f, p } = frame(t, 1.6);
        if (free(p.x, p.z, 2.6)) {
          busStop(f, 0, 0, b, def.id, rng);
          b.colliders.push({ cx: p.x, cz: p.z, w: Math.abs(e.dx) ? 4.2 : 1.6, d: Math.abs(e.dx) ? 1.6 : 4.2, minY: 0, maxY: 2.6, rotY: 0 });
          taken.push({ x: p.x, z: p.z, r: 3 });
        }
      }

      // Curb-side furniture every few meters
      for (let t = 6; t < e.len - 6; t += rng.range(3.5, 6.5)) {
        const kind = rng.chance(0.45) ? rng.pick(extras) : rng.pick(['bin', 'bench', 'hydrant', 'planter', 'newsbox', 'bikerack', 'none', 'none']);
        if (kind === 'none') continue;
        const inset = kind === 'bench' ? 2.5 : kind === 'phonebox' || kind === 'hotdog' ? 1.9 : 0.75;
        const { f, p } = frame(t, inset);
        const r = kind === 'phonebox' || kind === 'hotdog' ? 1.2 : kind === 'bench' || kind === 'planter' || kind === 'bikerack' ? 1.1 : 0.5;
        if (!free(p.x, p.z, r)) continue;
        switch (kind) {
          case 'bench':
            bench(f, 0, 0);
            break;
          case 'bin':
            bin(f, 0, 0, def.id === 'london' ? '#1f1f22' : '#2e3d33');
            break;
          case 'hydrant':
            hydrant(f, 0, 0, def.id === 'san-francisco' ? '#e8e3d6' : def.id === 'new-york' ? '#b3261e' : '#c9a227');
            break;
          case 'newsbox':
            newsbox(f, 0, 0, rng.pick(newsColors));
            break;
          case 'mailbox-us':
            mailboxUS(f, 0, 0);
            break;
          case 'pillarbox':
            pillarbox(f, 0, 0);
            break;
          case 'phonebox':
            phonebox(f, 0, 0);
            break;
          case 'bikerack':
            bikerack(f, 0, 0);
            break;
          case 'planter':
            planter(f, 0, 0);
            break;
          case 'hotdog':
            hotdog(f, 0, 0);
            break;
        }
        if (kind !== 'bikerack') b.colliders.push({ cx: p.x, cz: p.z, w: r * 1.4, d: r * 1.4, minY: 0, maxY: 1.6, rotY: 0 });
        taken.push({ x: p.x, z: p.z, r });
      }

      // Parked cars along the curb (not near corners, hydrants or bus stops)
      for (let t = 12; t < e.len - 12; t += 6.2) {
        if (!rng.chance(0.42)) continue;
        const p = at(t, -1.0); // in the road, beside the curb
        if (nearIntersection(p.x, p.z, 10) || !free(p.x, p.z, 1.2)) continue;
        // Now and then a delivery van in a loading bay, hazards on, driver unloading
        if (deliveries < 3 && rng.chance(0.12)) {
          deliveries++;
          const drop = at(t + rng.range(-1.5, 1.5), 3.2);
          parked.push({ x: p.x, z: p.z, rot: e.rot + Math.PI / 2, model: 'van', color: rng.pick(['#e9e9e6', '#e9e9e6', '#b3261e', '#2f3d55', '#c9a227']), hazard: true, drop });
          // Yellow loading-bay box on the road
          for (const [ox, oz, w, d] of [[0, 1, 6, 0.12], [0, -1, 6, 0.12], [3, 0, 0.12, 2.1], [-3, 0, 0.12, 2.1]] as const) {
            const along = Math.abs(e.dx) > 0;
            b.solid.box(p.x + (along ? ox : oz * 0.95), 0.066, p.z + (along ? oz * 0.95 : ox), along ? w : d, 0.02, along ? d : w, '#d9b23a', { ao: false });
          }
          b.colliders.push({ cx: p.x, cz: p.z, w: Math.abs(e.dx) ? 4.8 : 2, d: Math.abs(e.dx) ? 2 : 4.8, minY: 0, maxY: 2.4, rotY: 0 });
          taken.push({ x: p.x, z: p.z, r: 3 });
          continue;
        }
        const model: CarModel = def.id === 'new-york' && rng.chance(0.25) ? 'taxi' : rng.pick(['sedan', 'sedan', 'hatch', 'suv', 'van']);
        parked.push({ x: p.x, z: p.z, rot: e.rot + Math.PI / 2 + (rng.chance(0.5) ? Math.PI : 0), model, color: model === 'taxi' ? '#e8b923' : rng.pick(CAR_PAINTS) });
        b.colliders.push({ cx: p.x, cz: p.z, w: Math.abs(e.dx) ? 4.4 : 1.9, d: Math.abs(e.dx) ? 1.9 : 4.4, minY: 0, maxY: 1.6, rotY: 0 });
        taken.push({ x: p.x, z: p.z, r: 2.4 });
      }

      // Storm drain at the curb
      for (let t = 9; t < e.len - 6; t += 18) {
        const p = at(t, -0.25);
        b.solid.box(p.x, 0.065, p.z, Math.abs(e.dx) ? 0.9 : 0.4, 0.02, Math.abs(e.dx) ? 0.4 : 0.9, '#1d1f22', { ao: false });
      }
    }
  }

  // ── Intersections: signals on each corner, stop lines, manholes ──
  for (const ix of xs)
    for (const iz of zs) {
      if (c.inWater(ix, iz, 4)) continue;
      const o = roadW / 2 + 0.7;
      // Corner poles: each carries a mast arm over the lane approaching it
      const corners = [
        { x: ix + o, z: iz + o, axis: 'z' as const, armRot: -Math.PI / 2 }, // controls southbound(+z side) traffic, arm reaches -x
        { x: ix - o, z: iz - o, axis: 'z' as const, armRot: Math.PI / 2 },
        { x: ix - o, z: iz + o, axis: 'x' as const, armRot: Math.PI },
        { x: ix + o, z: iz - o, axis: 'x' as const, armRot: 0 },
      ];
      for (const k of corners) {
        const f = new Frame(k.x, k.z, k.armRot, b);
        // Pole + arm reaching over the road (local +Z = along the arm)
        f.geom(cylinder(0.11, 0.13, 6, 8), 0, 3.0, 0, '#3a3f45', 0, 0, 0, 1, 'solid', 'metal');
        f.block(0, 5.6, 2.6, 0.12, 0.14, 5.2, '#3a3f45');
        // Signal head hanging from the arm, facing oncoming traffic
        // (local X faces the traffic it controls)
        f.block(0, 4.5, 3.6, 0.36, 1.15, 0.42, '#1f2326');
        f.block(0, 4.45, 3.6, 0.06, 1.3, 0.6, '#15171a');
        f.block(0, 5.6, 3.6, 0.06, 0.08, 0.08, '#3a3f45');
        // Dim lenses (the lit one is drawn by the TrafficSignals component)
        for (let i = 0; i < 3; i++) f.block(0, 5.29 - i * 0.36, 3.6, 0.4, 0.26, 0.26, ['#3a1512', '#3a2e10', '#12301b'][i]);
        // Head faces along the arm's perpendicular (toward traffic) → world rotation
        const [hx, hz] = f.world(0, 3.6);
        signals.push({ x: hx, y: 5.42, z: hz, rot: k.armRot, axis: k.axis });
        // Pedestrian push-button box
        f.block(0, 1.0, 0.16, 0.16, 0.24, 0.1, '#d8b23a');
        b.colliders.push({ cx: k.x, cz: k.z, w: 0.4, d: 0.4, minY: 0, maxY: 6, rotY: 0 });
      }
      // Street-name blades on one corner pole, crossing at right angles, lettered on both faces
      {
        const sx = [...xs].sort((a, c) => a - c).indexOf(ix);
        const sz = [...zs].sort((a, c) => a - c).indexOf(iz);
        const col = STREET_SIGN[def.id] ?? STREET_SIGN.park;
        const px = ix + o;
        const pz = iz + o;
        const nameX = streetName(def.id, 'xs', sx); // road running north-south
        const nameZ = streetName(def.id, 'zs', sz); // road running east-west
        for (const face of [1, -1]) {
          b.signs.push({ kind: 'street', text: nameX, x: px + face * 0.04, y: 3.35, z: pz - 0.55, rotY: (face * Math.PI) / 2, w: 1.5, h: 0.32, bg: col.bg, fg: col.fg });
          b.signs.push({ kind: 'street', text: nameZ, x: px - 0.55, y: 3.0, z: pz + face * 0.04, rotY: face > 0 ? 0 : Math.PI, w: 1.5, h: 0.32, bg: col.bg, fg: col.fg });
        }
      }
      // Stop lines (white bars across the approach lanes) and a manhole in the middle
      const sl = roadW / 2 + 2.5;
      const lh = def.id === 'london' ? -1 : 1; // stop lines sit across the approaching lane
      for (const [sx, sz, along] of [[ix + (lh * roadW) / 4, iz - sl, 'x'], [ix - (lh * roadW) / 4, iz + sl, 'x'], [ix - sl, iz - (lh * roadW) / 4, 'z'], [ix + sl, iz + (lh * roadW) / 4, 'z']] as const)
        b.solid.box(sx, 0.066, sz, along === 'x' ? roadW / 2 - 0.4 : 0.45, 0.02, along === 'x' ? 0.45 : roadW / 2 - 0.4, '#efefe9', { ao: false });
      // Zebra crossings on each arm, paint worn by tyres (some bars faded, a few chipped short)
      const cw = roadW / 2 + 1.25;
      for (const [cx, cz, along] of [[ix, iz - cw, 'x'], [ix, iz + cw, 'x'], [ix - cw, iz, 'z'], [ix + cw, iz, 'z']] as const) {
        if (c.inWater(cx, cz, 1)) continue;
        for (let o = -roadW / 2 + 0.6; o < roadW / 2 - 0.4; o += 1.1) {
          const worn = rng.next();
          const len = worn < 0.15 ? rng.range(1.0, 1.6) : 1.9;
          const shade = worn < 0.3 ? '#bfbdb5' : '#e6e4dc';
          if (along === 'x') b.solid.box(cx + o, 0.066, cz + rng.range(-0.1, 0.1), 0.55, 0.02, len, shade, { ao: false });
          else b.solid.box(cx + rng.range(-0.1, 0.1), 0.066, cz + o, len, 0.02, 0.55, shade, { ao: false });
        }
      }
      const mx = ix + rng.range(-2, 2);
      const mz = iz + rng.range(-2, 2);
      b.solid.geom(cylinder(0.38, 0.38, 0.02, 12), new THREE.Matrix4().makeTranslation(mx, 0.066, mz), '#2a2c2f');
      // New York: steam rising from the street, sometimes through an orange-and-white stack
      if (def.id === 'new-york' && rng.chance(0.45)) {
        const stack = rng.chance(0.5);
        const vx = ix + (rng.chance(0.5) ? 1 : -1) * roadW * 0.25;
        const vz = iz + (rng.chance(0.5) ? 1 : -1) * (roadW / 2 + 5);
        b.solid.geom(cylinder(0.4, 0.4, 0.03, 12), new THREE.Matrix4().makeTranslation(vx, 0.07, vz), '#1e2022');
        if (stack) {
          for (let k = 0; k < 5; k++) b.solid.geom(cylinder(0.3, 0.32, 0.6, 12), new THREE.Matrix4().makeTranslation(vx, 0.3 + k * 0.6, vz), k % 2 ? '#f2f0ea' : '#e2702a');
          b.colliders.push({ cx: vx, cz: vz, w: 0.8, d: 0.8, minY: 0, maxY: 3, rotY: 0 });
        }
        vents.push({ x: vx, z: vz, stack });
      }
    }

  return { signals, parked, vents };
}

/**
 * Fills vacant lots so blocks never look like bare paving: a pocket park (lawn, hedges,
 * trees, benches) or a surface car park with striped bays and parked cars.
 */
export function buildLots(lots: Rect[], b: Builders, rng: Rng, trees: { kind: string; x: number; z: number; s: number; r: number }[], parked: ParkedCar[], treeKinds: string[]) {
  const out = { parks: [] as Rect[], carParks: [] as Rect[], sites: [] as Site[] };
  // Every city is building something: the biggest one or two vacant lots become building sites
  const bySize = [...lots].filter((l) => l.maxX - l.minX >= 7.5 && l.maxZ - l.minZ >= 7.5).sort((a, c) => (c.maxX - c.minX) * (c.maxZ - c.minZ) - (a.maxX - a.minX) * (a.maxZ - a.minZ));
  const siteLots = new Set(bySize.slice(0, lots.length > 10 ? 2 : lots.length >= 2 ? 1 : 0));
  for (const lot of lots) {
    const w = lot.maxX - lot.minX;
    const d = lot.maxZ - lot.minZ;
    const cx = (lot.minX + lot.maxX) / 2;
    const cz = (lot.minZ + lot.maxZ) / 2;
    if (w < 7 || d < 7) continue;
    if (siteLots.has(lot)) {
      out.sites.push(buildSite(lot, b, rng));
      continue;
    }
    if (rng.chance(0.55)) {
      out.parks.push(lot);
      // Pocket park
      b.solid.box(cx, 0.2, cz, w, 0.08, d, '#5f8a45', { tex: 'grass', ao: false });
      const hedge = { tex: 'leaves' };
      b.solid.box(cx, 0.55, lot.minZ + 0.35, w, 0.7, 0.7, '#3f6e34', hedge);
      b.solid.box(cx, 0.55, lot.maxZ - 0.35, w, 0.7, 0.7, '#3f6e34', hedge);
      b.solid.box(lot.minX + 0.35, 0.55, cz, 0.7, 0.7, d - 1.4, '#3f6e34', hedge);
      b.solid.box(lot.maxX - 0.35, 0.55, cz, 0.7, 0.7, d - 1.4, '#3f6e34', hedge);
      b.solid.box(cx, 0.25, cz, 1.6, 0.05, d - 1.4, '#cfc6b2', { tex: 'path', ao: false });
      const n = Math.max(1, Math.round((w * d) / 60));
      for (let i = 0; i < n; i++) {
        const tx = lot.minX + 2 + rng.next() * (w - 4);
        const tz = lot.minZ + 2 + rng.next() * (d - 4);
        if (Math.abs(tx - cx) < 1.6) continue;
        trees.push({ kind: rng.pick(treeKinds), x: tx, z: tz, s: rng.range(0.8, 1.05), r: rng.range(0, 6.28) });
        b.colliders.push({ cx: tx, cz: tz, w: 0.7, d: 0.7, minY: 0, maxY: 4, rotY: 0 });
      }
      const f = new Frame(cx + 1.6, cz, -Math.PI / 2, b);
      bench(f, 0, 0);
      const f2 = new Frame(cx - 1.6, cz, Math.PI / 2, b);
      bench(f2, 0, 0);
    } else {
      out.carParks.push(lot);
      // Surface car park
      b.solid.box(cx, 0.2, cz, w, 0.06, d, '#4a4e55', { tex: 'asphalt', ao: false });
      const along = w >= d; // bays run along the longer side
      const len = along ? w : d;
      const bays = Math.floor((len - 2) / 2.7);
      for (let k = 0; k <= bays; k++) {
        const t = -len / 2 + 1 + k * 2.7;
        for (const side of [-1, 1]) {
          const off = side * ((along ? d : w) / 2 - 2.6);
          const lx = along ? cx + t : cx + off;
          const lz = along ? cz + off : cz + t;
          b.solid.box(lx, 0.235, lz, along ? 0.1 : 5, 0.01, along ? 5 : 0.1, '#e9e7df', { ao: false });
          if (k < bays && rng.chance(0.6)) {
            const px = along ? lx + 1.35 : lx;
            const pz = along ? lz : lz + 1.35;
            parked.push({ x: px, y: 0.23, z: pz, rot: (along ? 0 : Math.PI / 2) + (side > 0 ? 0 : Math.PI), model: rng.pick(['sedan', 'hatch', 'suv', 'sedan', 'van'] as CarModel[]), color: rng.pick(CAR_PAINTS) });
            b.colliders.push({ cx: px, cz: pz, w: along ? 1.9 : 4.6, d: along ? 4.6 : 1.9, minY: 0, maxY: 1.6, rotY: 0 });
          }
        }
      }
      // Pay machine
      const f = new Frame(cx, cz, 0, b);
      f.block(0, 0.2, 0, 0.5, 1.4, 0.35, '#2f5f9a');
      f.block(0, 1.0, 0.18, 0.3, 0.25, 0.02, '#1a2a3a');
    }
  }
  return out;
}

/**
 * Distant skyline beyond the playable area: rings of towers (or wooded hills for the park)
 * fading into the haze, so every city reads as part of a much larger metropolis.
 */
export function buildBackdrop(def: CityDef, b: Builders, rng: Rng, inWater: (x: number, z: number, m?: number) => boolean) {
  const H = def.half;
  const isPark = def.id === 'park';
  const facades = def.filler.style === 'hk' ? ['fac-hk', 'fac-hk', 'fac-glass'] : def.filler.style === 'london' ? ['fac-stone', 'fac-brick', 'fac-glass'] : ['fac-glass', 'fac-office', 'fac-glass', 'fac-brick'];
  const walls = def.palette.walls;
  for (let ring = 0; ring < 3; ring++) {
    const dist = H + 58 + ring * 42;
    const step = isPark ? 26 : 16 - ring * 2;
    for (let side = 0; side < 4; side++)
      for (let t = -dist; t < dist; t += step + rng.range(0, step * 0.6)) {
        const x = side === 0 ? t : side === 1 ? t : side === 2 ? -dist : dist;
        const z = side === 0 ? -dist : side === 1 ? dist : t;
        const jx = x + rng.range(-6, 6);
        const jz = z + rng.range(-6, 6);
        if (inWater(jx, jz, 8)) continue;
        if (isPark) {
          // Wooded hills
          const r = rng.range(14, 30);
          b.solid.geom(sphere(r, 10, 6), new THREE.Matrix4().compose(new THREE.Vector3(jx, -r * 0.55, jz), new THREE.Quaternion(), new THREE.Vector3(1, 0.55, 1)), rng.pick(['#4f7a3e', '#5a8446', '#466f37']), 'grass');
          for (let k = 0; k < 4; k++)
            b.solid.geom(sphere(rng.range(2.2, 3.6), 7, 5), new THREE.Matrix4().makeTranslation(jx + rng.range(-r * 0.5, r * 0.5), rng.range(2, r * 0.35), jz + rng.range(-r * 0.5, r * 0.5)), rng.pick(['#3a6630', '#456f37']), 'leaves');
          continue;
        }
        const w = rng.range(12, 26);
        const d = rng.range(12, 26);
        // Taller toward the outer rings and the city's "downtown" side
        const scale = ({ 'new-york': 1.2, 'hong-kong': 1.15, singapore: 1.0, 'san-francisco': 0.72, london: 0.68 } as Record<string, number>)[def.id] ?? 1;
        const h = (rng.range(18, 40) + ring * rng.range(8, 26) + (rng.chance(0.15) ? rng.range(30, 70) : 0)) * scale;
        // Aerial perspective: farther rings are lighter and bluer
        const col = new THREE.Color(rng.pick(walls)).lerp(new THREE.Color('#b9c6d3'), 0.18 + ring * 0.16);
        const tex = rng.pick(facades);
        // Taller towers step back once or twice and finish with a crown, so the skyline has a real silhouette
        if (h > 36 && rng.chance(0.7)) {
          const base = h * rng.range(0.45, 0.65);
          b.solid.box(jx, base / 2, jz, w, base, d, col, { tex, topTex: 'roof-gravel', worldTop: false });
          const w2 = w * rng.range(0.6, 0.78);
          const d2 = d * rng.range(0.6, 0.78);
          let top = h;
          if (h > 70 && rng.chance(0.5)) {
            const mid = base + (h - base) * 0.6;
            b.solid.box(jx, (base + mid) / 2, jz, w2, mid - base, d2, col, { tex, topTex: 'roof-gravel', worldTop: false });
            b.solid.box(jx, (mid + h) / 2, jz, w2 * 0.7, h - mid, d2 * 0.7, col, { tex, topTex: 'roof-gravel', worldTop: false });
          } else b.solid.box(jx, (base + h) / 2, jz, w2, h - base, d2, col, { tex, topTex: 'roof-gravel', worldTop: false });
          if (rng.chance(0.5)) {
            b.solid.box(jx, top + 1.2, jz, w2 * 0.45, 2.4, d2 * 0.45, new THREE.Color(col).multiplyScalar(0.8));
            top += 2.4;
          }
          if (h > 60 && rng.chance(0.6)) b.solid.box(jx, top + 3, jz, 0.5, 6, 0.5, '#8d939c');
        } else {
          b.solid.box(jx, h / 2, jz, w, h, d, col, { tex, topTex: 'roof-gravel', worldTop: false });
          if (h > 60 && rng.chance(0.6)) b.solid.box(jx, h + 3, jz, 0.5, 6, 0.5, '#8d939c');
        }
      }
  }
}

/**
 * Fin City Park landscaping: formal parterres around the plaza, avenue trees along the ring road,
 * lamp-lit promenades with benches, a cast-iron perimeter fence, and a planted lake edge with a boathouse.
 */
/** Centres of the park's formal flower gardens (parterres); trees and props keep off them. */
export const PARTERRES: readonly (readonly [number, number])[] = [[-23, -25], [23, -25], [-23, 27]];
const PARTERRE_W = 13;
const PARTERRE_D = 11;
/** True when (x, z) is within `m` metres of a parterre. */
export function onParterre(x: number, z: number, m = 0) {
  return PARTERRES.some(([cx, cz]) => Math.abs(x - cx) < PARTERRE_W / 2 + 0.8 + m && Math.abs(z - cz) < PARTERRE_D / 2 + 0.8 + m);
}

export function buildParkscape(
  def: CityDef,
  b: Builders,
  rng: Rng,
  trees: { kind: string; x: number; z: number; s: number; r: number }[],
  lamps: { x: number; z: number; rot: number }[],
  keepClear: (x: number, z: number, m: number) => boolean,
) {
  const ring = Math.max(...def.roads.xs);
  const rw = def.roads.width;
  // ── Formal parterres in three quadrants, clear of the Bank, Credit Bureau and Library porches ──
  for (const [cx, cz] of PARTERRES) {
    const w = PARTERRE_W;
    const d = PARTERRE_D;
    const hedge = { tex: 'leaves' };
    b.solid.box(cx, 0.06, cz, w + 1.6, 0.06, d + 1.6, '#d9c9a4', { tex: 'path', ao: false });
    b.solid.box(cx, 0.35, cz - d / 2, w, 0.6, 0.5, '#2f5a2f', hedge);
    b.solid.box(cx, 0.35, cz + d / 2, w, 0.6, 0.5, '#2f5a2f', hedge);
    b.solid.box(cx - w / 2, 0.35, cz, 0.5, 0.6, d, '#2f5a2f', hedge);
    b.solid.box(cx + w / 2, 0.35, cz, 0.5, 0.6, d, '#2f5a2f', hedge);
    const flowers = ['#c9455a', '#e0b03a', '#8a5ab0', '#e07a9a', '#f2efe6'];
    for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const bx = cx + qx * (w / 4 + 0.3);
      const bz = cz + qz * (d / 4 + 0.2);
      b.solid.box(bx, 0.18, bz, w / 2 - 1.6, 0.3, d / 2 - 1.4, '#4a3a2a', { ao: false });
      for (let row = 0; row < 3; row++) b.solid.box(bx, 0.42, bz - d / 8 + row * (d / 8), w / 2 - 2, 0.22, 0.5, flowers[(row + Math.abs(qx + qz)) % flowers.length], { tex: 'leaves', ao: false });
    }
    b.solid.geom(sphere(0.9, 8, 6), new THREE.Matrix4().makeTranslation(cx, 1.0, cz), '#3a6630', 'leaves');
    b.solid.geom(cylinder(0.5, 0.6, 0.5, 10), new THREE.Matrix4().makeTranslation(cx, 0.25, cz), '#cfc6b2', 'stone');
    // Hedges, beds and the clipped bush in the middle are solid; the paths between them are
    // walkable (a single lid over the whole bed let players walk on air and into the bush)
    b.colliders.push({ cx, cz: cz - d / 2, w: w + 0.5, d: 0.6, minY: 0, maxY: 0.65, rotY: 0 });
    b.colliders.push({ cx, cz: cz + d / 2, w: w + 0.5, d: 0.6, minY: 0, maxY: 0.65, rotY: 0 });
    b.colliders.push({ cx: cx - w / 2, cz, w: 0.6, d, minY: 0, maxY: 0.65, rotY: 0 });
    b.colliders.push({ cx: cx + w / 2, cz, w: 0.6, d, minY: 0, maxY: 0.65, rotY: 0 });
    for (const [qx, qz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.colliders.push({ cx: cx + qx * (w / 4 + 0.3), cz: cz + qz * (d / 4 + 0.2), w: w / 2 - 1.6, d: d / 2 - 1.4, minY: 0, maxY: 0.55, rotY: 0 });
    b.colliders.push({ cx, cz, w: 1.8, d: 1.8, minY: 0, maxY: 1.9, rotY: 0 });
  }

  // ── Avenue trees both sides of the ring road ──
  for (const side of [-1, 1])
    for (const off of [-(rw / 2 + 2.5), rw / 2 + 2.5]) {
      for (let t = -ring + 6; t <= ring - 6; t += 10) {
        for (const [x, z] of [[side * ring + off, t], [t, side * ring + off]] as const) {
          if (!keepClear(x, z, 4)) continue;
          trees.push({ kind: 'round', x, z, s: 0.95 + rng.next() * 0.15, r: rng.next() * 6.28 });
        }
      }
    }

  // ── Lamps, benches and bins along the promenades ──
  for (const p of def.paths ?? []) {
    const dx = p.to[0] - p.from[0];
    const dz = p.to[1] - p.from[1];
    const len = Math.hypot(dx, dz);
    const nx = -dz / len;
    const nz = dx / len;
    for (let t = 6; t < len - 4; t += 12) {
      for (const s of [-1, 1]) {
        const x = p.from[0] + (dx * t) / len + nx * s * (p.width / 2 + 0.8);
        const z = p.from[1] + (dz * t) / len + nz * s * (p.width / 2 + 0.8);
        if (!keepClear(x, z, 2)) continue;
        lamps.push({ x, z, rot: Math.atan2(-nx * s, -nz * s) });
        b.colliders.push({ cx: x, cz: z, w: 0.4, d: 0.4, minY: 0, maxY: 5, rotY: 0 });
        // Bench facing the path, with a bin beside it, between lamps
        const bt = t + 6;
        if (bt < len - 4) {
          const bx = p.from[0] + (dx * bt) / len + nx * s * (p.width / 2 + 1.3);
          const bz = p.from[1] + (dz * bt) / len + nz * s * (p.width / 2 + 1.3);
          if (keepClear(bx, bz, 2)) {
            const f = new Frame(bx, bz, Math.atan2(-nx * s, -nz * s), b);
            bench(f, 0, 0);
            bin(f, 1.4, 0.1, '#2e3d33');
            b.colliders.push({ cx: bx, cz: bz, w: 1.2, d: 1.2, minY: 0, maxY: 1, rotY: 0 });
          }
        }
      }
    }
  }

  // ── Cast-iron perimeter fence with stone piers (gaps at the four gateways) ──
  const fr = ring + rw / 2 + 1.2;
  for (const side of [-1, 1])
    for (const alongX of [true, false]) {
      for (let t = -fr; t < fr; t += 3) {
        if (Math.abs(t + 1.5) < 6) continue; // gateway on each axis
        const x = alongX ? t + 1.5 : side * fr;
        const z = alongX ? side * fr : t + 1.5;
        if (!keepClear(x, z, 1.5)) continue;
        b.solid.box(x, 0.7, z, 0.45, 1.4, 0.45, '#cfc6b2', { tex: 'stone' });
        b.solid.box(x, 1.45, z, 0.55, 0.12, 0.55, '#bdb3a0');
        b.solid.box(alongX ? x + 1.5 : x, 1.05, alongX ? z : z + 1.5, alongX ? 2.6 : 0.05, 0.05, alongX ? 0.05 : 2.6, IRON);
        b.solid.box(alongX ? x + 1.5 : x, 0.35, alongX ? z : z + 1.5, alongX ? 2.6 : 0.05, 0.05, alongX ? 0.05 : 2.6, IRON);
        for (let k = 0.3; k < 2.8; k += 0.22) b.solid.box(alongX ? x + k : x, 0.6, alongX ? z : z + k, 0.03, 1.2, 0.03, IRON);
      }
    }

  // ── Lake edge: reeds, lily pads, boathouse and rowboats ──
  for (const w of def.water) {
    const x0 = w.x - w.w / 2;
    const x1 = w.x + w.w / 2;
    const z0 = w.z - w.d / 2;
    for (let x = x0 + 2; x < x1 - 2; x += rng.range(1.5, 4)) {
      if (rng.chance(0.4)) continue;
      for (let k = 0; k < 6; k++) b.solid.box(x + rng.range(-0.6, 0.6), -0.1, z0 + 1.2 + rng.range(0, 0.8), 0.06, rng.range(0.9, 1.6), 0.06, rng.pick(['#5a7a3a', '#6a8a4a', '#4a6a30']));
    }
    for (let i = 0; i < 26; i++) {
      const lx = rng.range(x0 + 4, x1 - 4);
      const lz = rng.range(z0 + 4, w.z + w.d / 2 - 4);
      b.solid.geom(cylinder(rng.range(0.5, 0.9), rng.range(0.5, 0.9), 0.04, 9), new THREE.Matrix4().makeTranslation(lx, -0.3, lz), '#4f7a3a', 'leaves');
      if (rng.chance(0.25)) b.solid.geom(sphere(0.16, 6, 4), new THREE.Matrix4().makeTranslation(lx + 0.2, -0.22, lz), '#f2d6e2');
    }
    // Boathouse on stilts at the north shore, with rowboats moored alongside
    const bx = x0 + w.w * 0.2;
    const bz = z0 + 3.5;
    const f = new Frame(bx, bz, Math.PI, b);
    for (const sx of [-3, 3]) for (const sz of [-2.5, 2.5]) f.block(sx, -1, sz, 0.3, 1.2, 0.3, '#4a3324');
    f.tb(0, 0.2, 0, 7, 0.25, 6, '#8a6440', 'wood', 'wood');
    f.tb(0, 0.45, 0.8, 6, 2.6, 3.6, '#f2ece0', 'siding', 'wood');
    for (let k = 0; k < 4; k++) f.tb(0, 3.05 + k * 0.45, 0.8, 6.6 - k * 1.5, 0.45, 4.4, '#3f5a3f', 'roof-tiles', 'roof-tiles');
    f.block(-1.4, 1.1, 2.62, 1.0, 1.0, 0.04, '#2b3440', 'dark');
    f.block(1.6, 0.45, 2.62, 1.1, 2.0, 0.06, '#5a3e2b');
    for (const [rx, ry] of [[-4.8, 0.2], [4.8, -0.2]] as const) {
      f.geom(new THREE.CylinderGeometry(0.75, 0.55, 3.6, 8, 1, false, 0, Math.PI), rx, -0.25, 3.5, '#a8432f', 0, ry, Math.PI / 2);
      f.block(rx, -0.1, 3.5, 1.2, 0.08, 0.3, '#8a6440');
    }
  }
}

/**
 * Building site: plywood hoarding with a printed banner, a half-built concrete frame with rebar
 * sticking out of the top floor, scaffolding and debris netting, a site cabin and a skip.
 * The tower crane's mast is static here; its turning jib is drawn by the scene.
 */
function buildSite(lot: Rect, b: Builders, rng: Rng): Site {
  const w = lot.maxX - lot.minX;
  const d = lot.maxZ - lot.minZ;
  const cx = (lot.minX + lot.maxX) / 2;
  const cz = (lot.minZ + lot.maxZ) / 2;
  const s = b.solid;
  s.box(cx, 0.12, cz, w, 0.04, d, '#7a6a55', { tex: 'path', ao: false });
  // Hoarding on all four sides, with a gate gap on the south side
  const H = 2.4;
  const ply = '#b08a5a';
  const hoard = (x: number, z: number, len: number, alongX: boolean) => {
    s.box(x, H / 2, z, alongX ? len : 0.08, H, alongX ? 0.08 : len, ply, { tex: 'wood' });
    for (let t = -len / 2; t <= len / 2; t += 2.4) s.box(alongX ? x + t : x, H / 2, alongX ? z : z + t, 0.12, H + 0.1, 0.12, '#6a5238');
    b.colliders.push({ cx: x, cz: z, w: alongX ? len : 0.3, d: alongX ? 0.3 : len, minY: 0, maxY: H, rotY: 0 });
  };
  hoard(cx, lot.minZ + 0.2, w - 0.4, true);
  hoard(lot.minX + 0.2, cz, d - 0.4, false);
  hoard(lot.maxX - 0.2, cz, d - 0.4, false);
  hoard(lot.minX + (w / 2 - 1.8) / 2 + 0.2, lot.maxZ - 0.2, w / 2 - 1.8, true);
  hoard(lot.maxX - (w / 2 - 1.8) / 2 - 0.2, lot.maxZ - 0.2, w / 2 - 1.8, true);
  // Banner printed on the hoarding facing the street
  const names = ['Harbour View Residences', 'One Market Square', 'The Exchange, Phase 2', 'Parkside Lofts', 'Union Tower', 'Riverside Quarter'];
  b.signs.push({ kind: 'hoarding', text: rng.pick(names), sub: 'Opening next year. Apartments and offices.', x: cx - w / 4, y: 1.35, z: lot.maxZ - 0.15, rotY: 0, w: w / 2 - 2.2, h: 1.5, bg: '#b08a5a', fg: '#1b1b1b' });
  b.signs.push({ kind: 'barrier', text: 'Hard hats on site', x: cx + w / 4, y: 1.5, z: lot.maxZ - 0.15, rotY: 0, w: Math.min(3, w / 2 - 2.2), h: 0.6, bg: '#f2c230', fg: '#1b1b1b' });
  // Concrete frame: slabs on columns, top floor still being poured
  const fx = cx - w * 0.1;
  const fz = cz - d * 0.08;
  const fw = w * 0.55;
  const fd = d * 0.55;
  const floors = rng.int(3, 6);
  for (let f = 0; f < floors; f++) {
    const y = f * 3.2;
    s.box(fx, y + 3.05, fz, fw, 0.25, fd, '#a9a59c', { tex: 'concrete' });
    for (const ox of [-fw / 2 + 0.3, 0, fw / 2 - 0.3]) for (const oz of [-fd / 2 + 0.3, fd / 2 - 0.3]) s.box(fx + ox, y + 1.5, fz + oz, 0.35, 3.0, 0.35, '#b5b1a7', { tex: 'concrete' });
  }
  const top = floors * 3.2;
  for (const ox of [-fw / 2 + 0.3, 0, fw / 2 - 0.3]) for (const oz of [-fd / 2 + 0.3, fd / 2 - 0.3]) for (let r = 0; r < 4; r++) s.box(fx + ox + (r % 2 ? 0.1 : -0.1), top + 0.7, fz + oz + (r > 1 ? 0.1 : -0.1), 0.03, 1.2, 0.03, '#7a4a2a');
  // Scaffolding and green debris netting on the street face
  for (let f = 0; f <= floors; f++) s.box(fx, f * 3.2 + 0.1, fz + fd / 2 + 0.7, fw + 0.8, 0.06, 0.9, '#8a6440', { tex: 'wood' });
  for (let t = -fw / 2 - 0.3; t <= fw / 2 + 0.3; t += 1.8) for (const oz of [0.3, 1.1]) s.box(fx + t, top / 2, fz + fd / 2 + oz, 0.05, top + 0.4, 0.05, '#9aa0a6', { tex: 'metal' });
  b.solid.box(fx, top / 2, fz + fd / 2 + 1.15, fw + 0.7, top * 0.85, 0.02, '#3f6a4a', { ao: false });
  b.colliders.push({ cx: fx, cz: fz + 0.6, w: fw + 1, d: fd + 1.4, minY: 0, maxY: top + 1, rotY: 0 });
  // Site cabin, skip and stacked materials
  s.box(lot.minX + 1.6, 1.3, lot.minZ + 1.4, 2.6, 2.6, 2.2, '#e3e1da', { tex: 'metal' });
  b.dark.box(lot.minX + 1.6, 1.6, lot.minZ + 2.52, 1.2, 0.8, 0.02, '#4a5a6a');
  s.box(lot.maxX - 1.6, 0.6, lot.minZ + 1.6, 2.6, 1.2, 1.6, '#e0a02a', { tex: 'metal' });
  for (let i = 0; i < 4; i++) s.box(lot.maxX - 1.6 + rng.range(-0.8, 0.8), 1.25, lot.minZ + 1.6 + rng.range(-0.4, 0.4), rng.range(0.4, 0.9), 0.3, 0.4, rng.pick(['#8a8580', '#6a5238', '#9a9690']));
  for (let i = 0; i < 6; i++) s.box(cx + w * 0.28, 0.15 + i * 0.12, cz + d * 0.25, 2.4, 0.1, 0.12, '#5a3e2b', { rotY: (i % 2) * 0.05, tex: 'wood' });
  // Tower crane mast: lattice tower with a concrete base
  const kx = lot.maxX - 1.5;
  const kz = lot.minZ + 4.2;
  const mast = Math.max(top + 12, 28 + rng.next() * 10);
  s.box(kx, 0.5, kz, 2.4, 1.0, 2.4, '#9a968e', { tex: 'concrete' });
  for (const [ox, oz] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.75], [0.75, 0.75]]) s.box(kx + ox, mast / 2, kz + oz, 0.16, mast, 0.16, '#e0b02a');
  for (let y = 1.5; y < mast; y += 1.5) {
    s.box(kx, y, kz - 0.75, 1.5, 0.08, 0.08, '#e0b02a');
    s.box(kx, y, kz + 0.75, 1.5, 0.08, 0.08, '#e0b02a');
    s.box(kx - 0.75, y, kz, 0.08, 0.08, 1.5, '#e0b02a');
    s.box(kx + 0.75, y, kz, 0.08, 0.08, 1.5, '#e0b02a');
    s.geom(new THREE.BoxGeometry(0.06, 2.1, 0.06), new THREE.Matrix4().compose(new THREE.Vector3(kx, y + 0.75, kz - 0.75), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, (y / 1.5) % 2 ? 0.78 : -0.78)), new THREE.Vector3(1, 1, 1)), '#d8a524');
  }
  b.colliders.push({ cx: kx, cz: kz, w: 2.4, d: 2.4, minY: 0, maxY: mast, rotY: 0 });
  b.lamps.push([kx, mast + 2.2, kz]);
  const crew = [
    { x: fx - fw / 2 + 0.8, z: fz + fd / 2 - 0.8, rot: 0.4 },
    { x: fx + 0.6, z: fz - 0.4, rot: -2 },
    { x: cx + w * 0.22, z: cz + d * 0.15, rot: Math.PI },
  ];
  return { lot, crane: { x: kx, z: kz, h: mast, jib: Math.min(26, Math.max(16, w * 1.6)), rot: rng.next() * Math.PI * 2 }, crew };
}
