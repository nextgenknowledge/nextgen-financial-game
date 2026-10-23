/**
 * Interior design. Every enterable building maps to an interior kind (banking hall, trading floor,
 * restaurant, market, warehouse…). Each kind lays out its own furniture and lists the people who
 * work or visit there (seated, typing, browsing, queuing or walking a route).
 *
 * Coordinates: room centred on the origin, back wall at −z, entrance at +z.
 * `b` is lit geometry, `g` is self-lit (screens, lamps, displays, daylight windows).
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs } from '@/engine/voxel';
import type { Rng } from '@/game/rng';
import { carGeometry } from '../cars';

export interface Solid {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rot?: number;
}

export type Pose = 'stand' | 'sit' | 'type' | 'browse' | 'walk' | 'eat' | 'busy';
export interface Actor {
  x: number;
  z: number;
  rot: number;
  pose: Pose;
  /** Loop of waypoints for walkers. */
  path?: [number, number][];
  /** Seat height for seated poses (default chair height). */
  seat?: number;
  /** Dress code for this place. */
  dress: 'office' | 'casual' | 'smart' | 'work' | 'tech' | 'chef';
}

export interface InteriorKind {
  /** Put service counters along the side walls (rooms with a stage or dais at the back). */
  sideStations?: boolean;
  /** Room size (w × d × h). */
  size: [number, number, number];
  floor: string; // atlas layer
  floorColor: string;
  wall: string;
  wallTex: string;
  /** Station counter style. */
  counter: 'teller' | 'desk' | 'checkout' | 'stall' | 'kiosk' | 'bar';
  windows: boolean;
  furnish: (k: Kit) => void;
}

export interface Kit {
  b: VoxelBuilder;
  g: VoxelBuilder;
  /** See-through glass (partitions, screens). */
  gl: VoxelBuilder;
  rng: Rng;
  w: number;
  d: number;
  h: number;
  /** Usable floor zone between the counters and the entrance, either side of the central aisle. */
  zone: { x0: number; x1: number; z0: number; z1: number };
  solids: Solid[];
  actors: Actor[];
}

/* ───────── Furniture kit ───────── */

const WOOD = '#8a6440';
const DARK_WOOD = '#4a3324';
const STEEL = '#8d939c';
const BLACK = '#1f2226';

type B = VoxelBuilder;
const at = (x: number, z: number, rot: number, lx: number, lz: number): [number, number] => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];

export function plant(b: B, x: number, z: number, big = false) {
  const s = big ? 1.4 : 1;
  b.geom(cylinder(0.32 * s, 0.24 * s, 0.6 * s, 10), trs(x, 0.3 * s, z), '#e9e4da');
  if (big) b.geom(cylinder(0.05, 0.07, 1.4, 6), trs(x, 1.4, z), '#6b5340');
  const n = big ? 9 : 5;
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2;
    const r = (big ? 0.45 : 0.25) * (0.5 + (k % 3) * 0.25);
    b.geom(sphere((big ? 0.42 : 0.28) + (k % 2) * 0.08, 7, 5), trs(x + Math.cos(a) * r, (big ? 2.0 : 0.95) + (k % 3) * 0.22 * s, z + Math.sin(a) * r), ['#3f6e34', '#4a7a3a', '#365f2e'][k % 3], 'leaves');
  }
}

export function chair(b: B, x: number, z: number, rot: number, color = '#2f3138', office = true) {
  b.box(x, 0.46, z, 0.48, 0.07, 0.48, color, { rotY: rot });
  const [bx, bz] = at(x, z, rot, 0, 0.22);
  b.box(bx, 0.8, bz, 0.46, 0.6, 0.06, color, { rotY: rot });
  if (office) {
    b.geom(cylinder(0.035, 0.035, 0.42, 6), trs(x, 0.22, z), STEEL);
    b.geom(cylinder(0.28, 0.28, 0.03, 5), trs(x, 0.03, z), BLACK);
  } else for (const [lx, lz] of [[-0.2, -0.2], [0.2, -0.2], [-0.2, 0.2], [0.2, 0.2]]) {
    const [px, pz] = at(x, z, rot, lx, lz);
    b.box(px, 0.22, pz, 0.04, 0.44, 0.04, DARK_WOOD, { rotY: rot });
  }
}

/** Office desk with monitors and a chair; returns where the worker sits. */
export function desk(k: Kit, x: number, z: number, rot: number, monitors = 1, chairColor = '#2f3138') {
  const { b, g, rng } = k;
  const o = { rotY: rot };
  b.box(x, 0.74, z, 1.6, 0.05, 0.8, '#d8cbb3', { ...o, tex: 'wood' });
  for (const [lx, lz] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) {
    const [px, pz] = at(x, z, rot, lx, lz);
    b.box(px, 0.36, pz, 0.05, 0.72, 0.05, STEEL, o);
  }
  for (let m = 0; m < monitors; m++) {
    const off = monitors === 1 ? 0 : (m - (monitors - 1) / 2) * 0.62;
    const [mx, mz] = at(x, z, rot, off, -0.22);
    b.box(mx, 0.86, mz, 0.08, 0.2, 0.08, BLACK, o);
    b.box(mx, 1.12, mz, 0.6, 0.38, 0.04, BLACK, o);
    const [sx, sz] = at(x, z, rot, off, -0.195);
    g.box(sx, 1.12, sz, 0.54, 0.32, 0.01, rng.pick(['#2f7a64', '#2b5f9a', '#3a4a6a', '#7a5a2a', '#2a6a3a', '#5a3a6a']), o);
  }
  const [kx, kz] = at(x, z, rot, 0, 0.12);
  b.box(kx, 0.775, kz, 0.45, 0.02, 0.15, '#2a2c2f', o);
  if (rng.chance(0.5)) {
    const [cx, cz] = at(x, z, rot, 0.55, 0.05);
    b.geom(cylinder(0.05, 0.04, 0.11, 8), trs(cx, 0.82, cz), '#efe8da');
  }
  const [cx, cz] = at(x, z, rot, 0, 0.78);
  chair(b, cx, cz, rot, chairColor);
  k.solids.push({ x, z, w: rot % Math.PI === 0 ? 1.7 : 0.9, d: rot % Math.PI === 0 ? 0.9 : 1.7, h: 1.2 });
  return { x: cx, z: cz, rot: rot + Math.PI };
}

export function table(b: B, x: number, z: number, w: number, d: number, top = '#d8cbb3', round = false) {
  if (round) {
    b.geom(cylinder(w / 2, w / 2, 0.05, 16), trs(x, 0.75, z), top, 'wood');
    b.geom(cylinder(0.06, 0.06, 0.72, 8), trs(x, 0.37, z), BLACK);
    b.geom(cylinder(0.3, 0.3, 0.03, 10), trs(x, 0.02, z), BLACK);
  } else {
    b.box(x, 0.75, z, w, 0.05, d, top, { tex: 'wood' });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(x + lx * (w / 2 - 0.08), 0.37, z + lz * (d / 2 - 0.08), 0.06, 0.74, 0.06, DARK_WOOD);
  }
}

/** Table with chairs around it; returns seat positions facing the table. */
export function diningSet(k: Kit, x: number, z: number, seats: number, round: boolean, top = '#d8cbb3', chairColor = '#5a3e2b') {
  const s: { x: number; z: number; rot: number }[] = [];
  table(k.b, x, z, round ? 1.1 : 1.6, round ? 1.1 : 0.9, top, round);
  for (let i = 0; i < seats; i++) {
    const a = (i / seats) * Math.PI * 2 + (round ? 0 : Math.PI / 2);
    const r = round ? 0.85 : 0.75;
    const cx = x + Math.sin(a) * r * (round ? 1 : 1.1);
    const cz = z + Math.cos(a) * r * (round ? 1 : 0.8);
    chair(k.b, cx, cz, a, chairColor, false);
    s.push({ x: cx, z: cz, rot: a + Math.PI });
  }
  k.solids.push({ x, z, w: round ? 1.4 : 1.9, d: round ? 1.4 : 1.4, h: 1 });
  return s;
}

export function bookcase(b: B, rng: Rng, x: number, z: number, rot: number, w: number) {
  const o = { rotY: rot };
  b.box(x, 1.4, z, w, 2.8, 0.45, DARK_WOOD, { ...o, tex: 'wood' });
  const spines = ['#6b2a2a', '#2f4a6b', '#3f5a3a', '#8a6a3c', '#4a3a5a', '#c9b48a', '#2a2a2a', '#7a5a2a', '#5a2a3a', '#d8cdb8'];
  for (let sh = 0; sh < 5; sh++) {
    const y = 0.15 + sh * 0.54;
    let lx = -w / 2 + 0.08;
    while (lx < w / 2 - 0.12) {
      const bw = rng.range(0.04, 0.09);
      const bh = rng.range(0.3, 0.44);
      const [px, pz] = at(x, z, rot, lx + bw / 2, 0.2);
      b.box(px, y + bh / 2, pz, bw, bh, 0.06, rng.pick(spines), { ...o, ao: false });
      lx += bw + 0.005;
      if (rng.chance(0.05)) lx += 0.25;
    }
  }
}

/** Double-sided gondola shelf (supermarket aisle) along x. */
export function gondola(b: B, rng: Rng, x: number, z: number, len: number, palette: string[]) {
  b.box(x, 0.8, z, len, 1.6, 0.25, '#d9dde3', { tex: 'metal' });
  for (let sh = 0; sh < 4; sh++) {
    const y = 0.15 + sh * 0.42;
    for (const side of [-1, 1]) {
      b.box(x, y, z + side * 0.32, len, 0.03, 0.4, '#e9edf2');
      for (let lx = -len / 2 + 0.15; lx < len / 2 - 0.1; lx += rng.range(0.16, 0.3)) {
        const h = rng.range(0.14, 0.3);
        b.box(x + lx, y + 0.02 + h / 2, z + side * 0.34, 0.14, h, 0.2, rng.pick(palette), { ao: false });
      }
    }
  }
  b.box(x - len / 2 - 0.15, 1.0, z, 0.3, 2.0, 0.8, '#c9455a');
}

export function rack(b: B, rng: Rng, x: number, z: number, len: number, palette: string[], alongX = true) {
  b.box(x, 1.55, z, alongX ? len : 0.04, 0.04, alongX ? 0.04 : len, STEEL);
  for (const e of [-len / 2, len / 2]) b.box(alongX ? x + e : x, 0.78, alongX ? z : z + e, 0.04, 1.56, 0.04, STEEL);
  for (let t = -len / 2 + 0.15; t < len / 2 - 0.1; t += 0.17) b.box(alongX ? x + t : x, 1.1, alongX ? z : z + t, alongX ? 0.05 : 0.48, 0.8, alongX ? 0.48 : 0.05, rng.pick(palette));
}

export function mannequin(b: B, x: number, z: number, outfit: string) {
  b.geom(cylinder(0.25, 0.25, 0.04, 10), trs(x, 0.02, z), BLACK);
  b.box(x, 0.5, z, 0.04, 0.9, 0.04, STEEL);
  b.box(x, 1.25, z, 0.5, 0.65, 0.26, outfit);
  b.box(x, 0.85, z, 0.42, 0.35, 0.24, '#2f3138');
  b.geom(sphere(0.14, 8, 6), trs(x, 1.72, z), '#e9e4da');
}

export function sofa(b: B, x: number, z: number, rot: number, color: string, w = 2.2) {
  const o = { rotY: rot };
  b.box(x, 0.25, z, w, 0.4, 0.9, color, o);
  const [bx, bz] = at(x, z, rot, 0, -0.38);
  b.box(bx, 0.7, bz, w, 0.55, 0.18, color, o);
  for (const lx of [-w / 2 + 0.08, w / 2 - 0.08]) {
    const [ax, az] = at(x, z, rot, lx, 0);
    b.box(ax, 0.5, az, 0.16, 0.5, 0.9, color, o);
  }
  const s: { x: number; z: number; rot: number }[] = [];
  for (let lx = -w / 2 + 0.55; lx < w / 2 - 0.3; lx += 0.75) {
    const [px, pz] = at(x, z, rot, lx, 0.05);
    s.push({ x: px, z: pz, rot });
  }
  return s;
}

export function armchair(b: B, x: number, z: number, rot: number, color: string) {
  return sofa(b, x, z, rot, color, 1.0);
}

export function pendant(b: B, g: B, x: number, z: number, top: number, drop = 1.6, shade = '#2b3a34') {
  b.box(x, top - drop / 2, z, 0.02, drop, 0.02, '#2a2a2a');
  b.geom(new THREE.ConeGeometry(0.42, 0.34, 10, 1, true), trs(x, top - drop - 0.1, z), shade);
  g.geom(sphere(0.12, 8, 5), trs(x, top - drop - 0.24, z), '#fff1c6');
}

export function screenWall(b: B, g: B, rng: Rng, x: number, y: number, z: number, w: number, h: number, rot = 0, cols = ['#2fd07a', '#e0453a', '#3a8fd0']) {
  b.box(x, y, z, w + 0.2, h + 0.2, 0.15, BLACK, { rotY: rot });
  const [fx, fz] = at(x, z, rot, 0, 0.09);
  g.box(fx, y, fz, w, h, 0.01, '#0d1a2a', { rotY: rot });
  // Panels split into tiles, each with a candlestick chart, plus a ticker strip along the bottom
  const tiles = Math.max(1, Math.round(w / 3));
  const tw = w / tiles;
  for (let t = 0; t < tiles; t++) {
    const cx = -w / 2 + tw * (t + 0.5);
    const [sx, sz] = at(x, z, rot, cx + tw / 2, 0.095);
    g.box(sx, y, sz, 0.04, h, 0.01, '#22344a', { rotY: rot });
    let v = (rng.next() - 0.5) * h * 0.3;
    const n = Math.max(6, Math.floor(tw / 0.22));
    for (let i = 0; i < n; i++) {
      const dv = (rng.next() - 0.48) * h * 0.12;
      const bh = Math.max(0.05, Math.abs(dv));
      const [px, pz] = at(x, z, rot, cx - tw / 2 + 0.25 + (i / n) * (tw - 0.5), 0.1);
      g.box(px, y + v + dv / 2 + 0.15, pz, 0.12, bh, 0.01, dv >= 0 ? cols[0] : cols[1], { rotY: rot });
      v = Math.max(-h * 0.25, Math.min(h * 0.3, v + dv));
    }
  }
  const [bx, bz] = at(x, z, rot, 0, 0.1);
  g.box(bx, y - h / 2 + 0.2, bz, w, 0.28, 0.01, '#101820', { rotY: rot });
  for (let lx = -w / 2 + 0.3; lx < w / 2 - 0.5; lx += rng.range(0.5, 1.1)) {
    const [px, pz] = at(x, z, rot, lx, 0.11);
    g.box(px, y - h / 2 + 0.2, pz, rng.range(0.2, 0.45), 0.1, 0.01, rng.pick(cols.concat('#f2c94c')), { rotY: rot });
  }
}

function glassWall(b: B, g: B, x: number, z: number, len: number, alongX: boolean, h = 2.6) {
  g.box(x, h / 2, z, alongX ? len : 0.04, h, alongX ? 0.04 : len, '#bcd6e2');
  b.box(x, h, z, alongX ? len : 0.08, 0.08, alongX ? 0.08 : len, STEEL);
  for (let t = -len / 2; t <= len / 2; t += 1.5) b.box(alongX ? x + t : x, h / 2, alongX ? z : z + t, 0.05, h, 0.05, STEEL);
}

function rug(b: B, x: number, z: number, w: number, d: number, color: string) {
  b.box(x, 0.012, z, w, 0.02, d, color, { ao: false, tex: 'concrete' });
  b.box(x, 0.014, z, w - 0.3, 0.02, d - 0.3, color, { ao: false });
}

function stall(k: Kit, x: number, z: number, rot: number, awning: string, produce: string[]) {
  const { b, rng } = k;
  const o = { rotY: rot };
  b.box(x, 0.5, z, 2.6, 1.0, 1.0, '#8a6440', { ...o, tex: 'wood' });
  for (let i = 0; i < 10; i++) {
    const [px, pz] = at(x, z, rot, -1.1 + (i % 5) * 0.55, -0.25 + Math.floor(i / 5) * 0.45);
    b.geom(sphere(0.16, 6, 4), trs(px, 1.08, pz), rng.pick(produce));
  }
  for (const lx of [-1.25, 1.25]) {
    const [px, pz] = at(x, z, rot, lx, -0.5);
    b.box(px, 1.2, pz, 0.06, 2.4, 0.06, DARK_WOOD, o);
  }
  const [ax, az] = at(x, z, rot, 0, -0.1);
  for (let s = 0; s < 6; s++) {
    const [sx, sz] = at(ax, az, rot, -1.3 + s * 0.52 + 0.26, 0);
    b.box(sx, 2.45, sz, 0.52, 0.06, 1.3, s % 2 ? awning : '#f2efe6', o);
  }
  k.g.box(ax, 2.2, az, 0.2, 0.2, 0.2, '#ffe2a0', o);
  k.solids.push({ x, z, w: 2.8, d: 1.2, h: 1.2, rot });
}

function crates(b: B, rng: Rng, x: number, z: number) {
  for (let i = 0; i < 4; i++) {
    const s = rng.range(0.7, 1.1);
    b.box(x + (i % 2) * 1.1 - 0.5, (Math.floor(i / 2) + 0.5) * s, z + rng.range(-0.1, 0.1), s, s, s, rng.pick(['#a8774a', '#8a6440', '#b8895a']), { tex: 'wood' });
  }
}

function palletRack(b: B, rng: Rng, x: number, z: number, len: number) {
  for (const t of [-len / 2, 0, len / 2]) for (const s of [-0.55, 0.55]) b.box(x + t, 2.2, z + s, 0.1, 4.4, 0.1, '#2f5f9a');
  for (const y of [0.15, 1.6, 3.05]) {
    b.box(x, y, z - 0.55, len, 0.12, 0.1, '#e0703a');
    b.box(x, y, z + 0.55, len, 0.12, 0.1, '#e0703a');
    for (let t = -len / 2 + 0.7; t < len / 2; t += 1.3) {
      b.box(x + t, y + 0.12, z, 1.1, 0.12, 1.0, '#a8774a', { tex: 'wood' });
      if (rng.chance(0.8)) b.box(x + t, y + 0.18 + 0.45, z, 1.0, 0.9, 0.9, rng.pick(['#c9a77a', '#b8895a', '#d9c49a', '#e9e4da']), { tex: 'wood' });
    }
  }
}

function serverRack(b: B, g: B, rng: Rng, x: number, z: number, rot: number) {
  b.box(x, 1.05, z, 0.7, 2.1, 1.0, '#1b1d22', { rotY: rot, tex: 'metal' });
  for (let i = 0; i < 18; i++) {
    const [px, pz] = at(x, z, rot, -0.25 + (i % 3) * 0.25, 0.51);
    g.box(px, 0.3 + Math.floor(i / 3) * 0.3, pz, 0.05, 0.03, 0.01, rng.pick(['#2fd07a', '#3a8fd0', '#e0b03a', '#2fd07a']), { rotY: rot });
  }
}

function plantingBed(b: B, rng: Rng, x: number, z: number, len: number) {
  b.box(x, 0.35, z, len, 0.7, 1.2, '#8a6440', { tex: 'wood' });
  b.box(x, 0.68, z, len - 0.15, 0.06, 1.05, '#4a3a2a');
  for (let t = -len / 2 + 0.3; t < len / 2 - 0.2; t += 0.45) b.geom(sphere(rng.range(0.18, 0.32), 6, 4), trs(x + t, 0.85, z + rng.range(-0.3, 0.3)), rng.pick(['#4a7a3a', '#5a8a46', '#3f6e34', '#c9455a', '#e0b03a']), 'leaves');
}

function queuePosts(b: B, x0: number, x1: number, z: number) {
  for (let x = x0; x <= x1 + 0.01; x += 1.6) {
    b.geom(cylinder(0.04, 0.04, 0.95, 8), trs(x, 0.48, z), '#b9bec9');
    b.geom(cylinder(0.17, 0.19, 0.04, 10), trs(x, 0.02, z), '#8d939c');
  }
  b.box((x0 + x1) / 2, 0.9, z, x1 - x0, 0.04, 0.03, '#2f4a7a');
}

function seatRows(k: Kit, x0: number, x1: number, z0: number, rows: number, color: string, rise = 0.25) {
  const seats: { x: number; z: number; rot: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * 1.1;
    const y = r * rise;
    // Risers on each side of a flat centre aisle
    if (y > 0)
      for (const [a, c] of [[x0 - 0.3, -0.95], [0.95, x1 + 0.3]]) k.b.box((a + c) / 2, y / 2, z, c - a, y, 1.1, '#5a4a3a', { tex: 'wood' });
    for (let x = x0; x <= x1; x += 0.65) {
      if (Math.abs(x) < 0.9) continue;
      k.b.box(x, y + 0.45, z, 0.55, 0.1, 0.5, color);
      k.b.box(x, y + 0.75, z + 0.24, 0.55, 0.55, 0.08, color);
      seats.push({ x, z, rot: Math.PI, y });
    }
  }
  k.solids.push({ x: (x0 + x1) / 2 - (x1 - x0) / 4 - 0.5, z: z0 + (rows - 1) * 0.55, w: (x1 - x0) / 2 - 0.4, d: rows * 1.1, h: 1.2 });
  k.solids.push({ x: (x0 + x1) / 2 + (x1 - x0) / 4 + 0.5, z: z0 + (rows - 1) * 0.55, w: (x1 - x0) / 2 - 0.4, d: rows * 1.1, h: 1.2 });
  return seats;
}

/* ───────── People helpers ───────── */

function sitAt(k: Kit, s: { x: number; z: number; rot: number }, dress: Actor['dress'], pose: Pose = 'sit', seat?: number) {
  k.actors.push({ x: s.x, z: s.z, rot: s.rot, pose, dress, seat });
}
function standAt(k: Kit, x: number, z: number, rot: number, dress: Actor['dress'], pose: Pose = 'stand') {
  k.actors.push({ x, z, rot, pose, dress });
}
function walker(k: Kit, path: [number, number][], dress: Actor['dress']) {
  k.actors.push({ x: path[0][0], z: path[0][1], rot: 0, pose: 'walk', path, dress });
}

/** Walking loop around the free floor, either side of the aisle. */
function loop(k: Kit, side: number): [number, number][] {
  const { zone } = k;
  const xa = side * 2.6;
  const xb = side * Math.max(3.2, zone.x1 - 0.6);
  return [
    [xa, zone.z1 - 0.5],
    [xb, zone.z1 - 0.5],
    [xb, zone.z0 + 0.5],
    [xa, zone.z0 + 0.5],
  ];
}

/* ───────── Interior kinds ───────── */

const PRODUCE = ['#c9455a', '#e0b03a', '#4a8a3a', '#e07a3a', '#8a3a6a', '#d9c49a'];
const GOODS = ['#b3261e', '#2f5f9a', '#e9b23a', '#3f6e34', '#e9e4da', '#6a4a8a', '#d9733a', '#2fa0a0'];

function officeFloor(k: Kit, dress: Actor['dress'], monitors = 2, chairColor = '#2f3138') {
  const { zone } = k;
  for (let z = zone.z0 + 0.8; z < zone.z1 - 1; z += 2.4)
    for (const side of [-1, 1])
      for (let x = side * 3.2; Math.abs(x) < zone.x1 - 0.9; x += side * 2.0) {
        const seat = desk(k, x, z, 0, monitors, chairColor);
        if (k.rng.chance(0.7)) sitAt(k, seat, dress, 'type');
      }
}

export const KINDS: Record<string, InteriorKind> = {
  'bank-hall': {
    size: [34, 28, 9],
    floor: 'marble',
    floorColor: '#e8e2d6',
    wall: '#efe7d6',
    wallTex: 'stucco',
    counter: 'teller',
    windows: true,
    furnish: (k) => {
      const { b, g, w, d, h, zone } = k;
      // Vault on the back wall
      b.geom(cylinder(2.2, 2.2, 0.35, 28), trs(0, 3.6, -d / 2 + 0.3, Math.PI / 2), '#a9aeb7', 'metal');
      b.geom(cylinder(1.6, 1.6, 0.45, 28), trs(0, 3.6, -d / 2 + 0.4, Math.PI / 2), '#8a8f9c', 'metal');
      for (let i = 0; i < 6; i++) b.box(Math.cos((i * Math.PI) / 3) * 0.9, 3.6 + Math.sin((i * Math.PI) / 3) * 0.9, -d / 2 + 0.68, 0.1, 0.5, 0.1, '#c9a24a');
      // Queue line in front of the tellers
      queuePosts(b, -6, 6, zone.z0 + 1.8);
      queuePosts(b, -6, 6, zone.z0 + 3.2);
      for (let i = 0; i < 5; i++) standAt(k, -4.5 + i * 2.1, zone.z0 + 2.5, Math.PI, i % 2 ? 'smart' : 'casual');
      // Waiting area and manager desks behind low glass
      const sofaSeats = sofa(b, -(zone.x1 - 1.4), zone.z1 - 2.5, Math.PI / 2, '#5a2e24', 2.6);
      k.solids.push({ x: -(zone.x1 - 1.4), z: zone.z1 - 2.5, w: 1, d: 2.7, h: 1 });
      sitAt(k, sofaSeats[0], 'casual');
      table(b, -(zone.x1 - 2.8), zone.z1 - 2.5, 0.9, 0.9, '#4a3324');
      for (const z of [zone.z0 + 6, zone.z0 + 9]) {
        const seat = desk(k, zone.x1 - 1.6, z, -Math.PI / 2, 1, '#5a2e24');
        sitAt(k, seat, 'office', 'type');
        chair(b, zone.x1 - 3.0, z, Math.PI / 2, '#5a2e24', false);
        sitAt(k, { x: zone.x1 - 3.0, z, rot: -Math.PI / 2 }, 'smart');
      }
      glassWall(b, k.gl, zone.x1 - 3.8, zone.z0 + 7.5, 7, false, 1.2);
      for (const x of [-w / 4, 0, w / 4]) for (const z of [-d / 6, d / 6]) pendant(b, g, x, z, h, 2.4, '#c9a24a');
      // Grand hall: marble columns and a central writing desk for deposit slips
      for (const sx of [-1, 1])
        for (let z = zone.z0 + 4.5; z < zone.z1 - 0.5; z += 4.5) {
          const x = sx * Math.min(zone.x1 - 0.5, 6.5);
          b.geom(cylinder(0.45, 0.5, h - 0.6, 16), trs(x, (h - 0.6) / 2, z), '#efe9dc', 'marble');
          b.box(x, 0.2, z, 1.3, 0.4, 1.3, '#d8cdb4', { tex: 'marble' });
          b.box(x, h - 0.5, z, 1.3, 0.4, 1.3, '#d8cdb4', { tex: 'marble' });
          k.solids.push({ x, z, w: 1.1, d: 1.1, h });
        }
      b.box(0, 0.55, zone.z1 - 3.5, 3.4, 1.1, 1.1, '#4a3324', { tex: 'wood' });
      b.box(0, 1.13, zone.z1 - 3.5, 3.6, 0.06, 1.3, '#2f4a32', { tex: 'marble' });
      for (const lx of [-1.1, 1.1]) g.box(lx, 1.35, zone.z1 - 3.5, 0.18, 0.12, 0.18, '#3f9a5a');
      k.solids.push({ x: 0, z: zone.z1 - 3.5, w: 3.7, d: 1.4, h: 1.2 });
      standAt(k, 1.2, zone.z1 - 2.6, Math.PI, 'smart', 'busy');
      walker(k, loop(k, 1), 'casual');
      plant(b, -w / 2 + 1.4, -d / 2 + 4.5, true);
      plant(b, w / 2 - 1.4, -d / 2 + 4.5, true);
      walker(k, loop(k, -1), 'smart');
    },
  },
  'trading-floor': {
    size: [38, 30, 9],
    floor: 'concrete',
    floorColor: '#5a5f66',
    wall: '#d9dde3',
    wallTex: 'concrete',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, g, w, d, h, zone, rng } = k;
      screenWall(b, g, rng, 0, h - 2.6, -d / 2 + 0.3, w - 6, 3.2);
      for (const sx of [-1, 1]) screenWall(b, g, rng, sx * (w / 2 - 0.3), h - 2.6, 0, d - 10, 2.4, sx > 0 ? -Math.PI / 2 : Math.PI / 2);
      // Trading pods: rows of desks with a wide central aisle and gaps every few desks
      for (let z = zone.z0 + 2.2; z < zone.z1 - 1; z += 3)
        for (const side of [-1, 1])
          for (let x = side * 3.6, i = 0; Math.abs(x) < zone.x1 - 0.9; x += side * 1.9, i++) {
            if (i % 4 === 3) continue;
            const seat = desk(k, x, z, 0, 3);
            if (rng.chance(0.8)) sitAt(k, seat, 'office', 'type');
            else standAt(k, seat.x, seat.z + 0.4, Math.PI, 'office');
          }
      walker(k, loop(k, 1), 'office');
      walker(k, loop(k, -1), 'smart');
    },
  },
  'open-office': {
    size: [32, 26, 7.5],
    floor: 'concrete',
    floorColor: '#7a8088',
    wall: '#eef0f2',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, h, w, d } = k;
      officeFloor(k, 'office', 2);
      // Glass meeting room in one corner with a table
      glassWall(b, k.gl, -(zone.x1 - 3), zone.z1 - 3, 6, true);
      const seats = diningSet(k, -(zone.x1 - 3), zone.z1 - 1.3, 4, false, '#e9e4da', '#2f3138');
      seats.slice(0, 3).forEach((s) => sitAt(k, s, 'smart'));
      b.box(-(zone.x1 - 3), 1.6, zone.z1 - 0.05, 2, 1.1, 0.06, '#f4f6fa');
      for (let x = -w / 3; x <= w / 3; x += w / 3) pendant(b, g, x, 0, h, 1.4, '#e9e4da');
      plant(b, w / 2 - 1.2, d / 2 - 4, true);
      walker(k, loop(k, 1), 'office');
    },
  },
  'tech-office': {
    size: [34, 28, 8],
    floor: 'wood',
    floorColor: '#b8946a',
    wall: '#e9ecef',
    wallTex: 'brick',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      // Team pods: four desks pushed together, two facing two, with standing-room between pods
      for (let z = zone.z0 + 1.6; z < zone.z1 - 4; z += 4.6)
        for (const side of [-1, 1])
          for (let x = side * 4.2; Math.abs(x) + 1 < zone.x1 - 0.6; x += side * 4.4) {
            for (const dx of [-0.82, 0.82])
              for (const [dz, rot] of [[0.43, 0], [-0.43, Math.PI]] as const) {
                const seat = desk(k, x + dx, z + dz, rot, 1, '#3a8fb0');
                if (rng.chance(0.7)) sitAt(k, seat, 'tech', 'type');
              }
            // A whiteboard on wheels next to some pods, with someone sketching on it
            if (rng.chance(0.35)) {
              const wx = x + side * 2.3;
              b.box(wx, 1.4, z, 0.06, 1.1, 1.6, '#f4f6fa');
              b.box(wx, 0.5, z, 0.06, 1.0, 0.06, STEEL);
              for (let i = 0; i < 4; i++) b.box(wx + 0.04 * -side, 1.3 + (i % 2) * 0.3, z - 0.5 + i * 0.3, 0.01, 0.06, 0.25, rng.pick(['#2b5f9a', '#c9455a', '#2f7a4a']));
              k.solids.push({ x: wx, z, w: 0.4, d: 1.7, h: 2 });
              standAt(k, wx - side * 0.7, z + 0.3, side > 0 ? Math.PI / 2 : -Math.PI / 2, 'tech', 'busy');
            }
          }
      // Lounge: bean bags, ping-pong table, kitchenette
      for (let i = 0; i < 4; i++) {
        const x = -(zone.x1 - 1.5) + i * 1.4;
        b.geom(sphere(0.55, 8, 6), new THREE.Matrix4().compose(new THREE.Vector3(x, 0.35, zone.z1 - 1.2), new THREE.Quaternion(), new THREE.Vector3(1, 0.6, 1)), rng.pick(['#e0703a', '#3a8fb0', '#4aa06a', '#c9455a']));
      }
      sitAt(k, { x: -(zone.x1 - 1.5), z: zone.z1 - 1.2, rot: 0 }, 'tech', 'sit', 0.3);
      b.box(zone.x1 - 2.5, 0.76, zone.z1 - 1.5, 2.7, 0.06, 1.5, '#2f7a4a');
      b.box(zone.x1 - 2.5, 0.92, zone.z1 - 1.5, 0.04, 0.2, 1.5, '#f4f6fa');
      b.box(zone.x1 - 2.5, 0.37, zone.z1 - 1.5, 2.4, 0.74, 0.1, BLACK);
      k.solids.push({ x: zone.x1 - 2.5, z: zone.z1 - 1.5, w: 2.8, d: 1.6, h: 1 });
      standAt(k, zone.x1 - 4.1, zone.z1 - 1.5, Math.PI / 2, 'tech', 'browse');
      standAt(k, zone.x1 - 0.9, zone.z1 - 1.5, -Math.PI / 2, 'tech', 'browse');
      b.box(-w / 2 + 0.4, 1.8, 0, 0.06, 1.4, 4, '#f4f6fa');
      for (let i = 0; i < 8; i++) b.box(-w / 2 + 0.44, 1.5 + (i % 3) * 0.3, -1.6 + i * 0.45, 0.02, 0.2, 0.3, rng.pick(['#f2d36a', '#f28ab0', '#8ad0f2']));
      for (let x = -w / 3; x <= w / 3; x += w / 3) pendant(b, g, x, 0, h, 1.6, '#2f3138');
      plant(b, w / 2 - 1.2, -d / 2 + 4, true);
      walker(k, loop(k, -1), 'tech');
    },
  },
  'service-office': {
    size: [32, 26, 7.5],
    floor: 'concrete',
    floorColor: '#9aa0a8',
    wall: '#eceae4',
    wallTex: 'stucco',
    counter: 'teller',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      // Ticket machine and "now serving" display
      b.box(2.8, 0.75, zone.z1 - 1, 0.5, 1.5, 0.4, '#2f5f9a');
      g.box(2.8, 1.2, zone.z1 - 1.21, 0.36, 0.26, 0.01, '#bfe8ff');
      b.box(0, h - 1.8, -d / 2 + 0.25, 4, 1, 0.12, BLACK);
      for (let i = 0; i < 3; i++) g.box(-1.2 + i * 1.2, h - 1.8, -d / 2 + 0.32, 0.8, 0.6, 0.01, '#e05a3a');
      // Rows of waiting chairs
      for (const side of [-1, 1])
        for (let r = 0; r < 3; r++)
          for (let c = 0; c < 5; c++) {
            const x = side * (3.5 + c * 0.7);
            if (Math.abs(x) > zone.x1) continue;
            const z = zone.z0 + 3 + r * 1.6;
            chair(b, x, z, Math.PI, '#3a6b8a', false);
            if (rng.chance(0.4)) sitAt(k, { x, z, rot: 0 }, rng.chance(0.5) ? 'casual' : 'smart');
          }
      k.solids.push({ x: -5, z: zone.z0 + 4.6, w: 4, d: 4, h: 1 }, { x: 5, z: zone.z0 + 4.6, w: 4, d: 4, h: 1 });
      plant(b, -w / 2 + 1.2, d / 2 - 3.5, true);
      plant(b, w / 2 - 1.2, d / 2 - 3.5, true);
      for (const x of [-w / 4, w / 4]) pendant(b, g, x, 0, h, 1.2, '#e9e4da');
      walker(k, loop(k, 1), 'casual');
    },
  },
  library: {
    size: [32, 28, 9],
    floor: 'wood',
    floorColor: '#8a6440',
    wall: '#e8dcc4',
    wallTex: 'stucco',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      for (const sx of [-1, 1]) for (let z = -d / 2 + 6; z < d / 2 - 3; z += 2.4) bookcase(b, rng, sx * (w / 2 - 0.35), z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2);
      // Free-standing stacks
      for (const side of [-1, 1])
        for (let z = zone.z0 + 1; z < zone.z0 + 6; z += 2.2) {
          const x = side * (zone.x1 - 2.6);
          bookcase(b, rng, x, z, 0, 3.2);
          bookcase(b, rng, x, z - 0.46, Math.PI, 3.2);
          k.solids.push({ x, z: z - 0.23, w: 3.3, d: 1, h: 2.8 });
          if (rng.chance(0.5)) standAt(k, x + rng.range(-1, 1), z + 0.8, Math.PI, 'casual', 'browse');
        }
      // Reading tables with green lamps
      for (const side of [-1, 1]) {
        const x = side * 4.6;
        const tz = zone.z1 - 3;
        b.box(x, 0.75, tz, 1.2, 0.06, 3.4, '#6b4a30', { tex: 'wood' });
        for (const lz of [-1.5, 1.5]) for (const lx of [-0.5, 0.5]) b.box(x + lx, 0.37, tz + lz, 0.07, 0.74, 0.07, DARK_WOOD);
        for (const lz of [-0.9, 0.9]) g.box(x, 1.0, tz + lz, 0.32, 0.1, 0.16, '#3f9a5a');
        for (const lz of [-1.1, 0, 1.1])
          for (const sx of [-1, 1]) {
            chair(b, x + sx * 0.9, tz + lz, sx > 0 ? -Math.PI / 2 : Math.PI / 2, DARK_WOOD, false);
            if (rng.chance(0.45)) sitAt(k, { x: x + sx * 0.9, z: tz + lz, rot: sx > 0 ? -Math.PI / 2 : Math.PI / 2 }, 'casual', 'type');
          }
        k.solids.push({ x, z: tz, w: 2.9, d: 3.6, h: 1 });
      }
      for (const x of [-w / 4, w / 4]) for (const z of [-2, 4]) pendant(b, g, x, z, h, 2.6, '#2f4a32');
      walker(k, loop(k, 1), 'casual');
    },
  },
  club: {
    size: [28, 24, 8],
    floor: 'wood',
    floorColor: '#5a3e2b',
    wall: '#2f4a32',
    wallTex: 'stucco',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, d, rng } = k;
      // Fireplace with a mantel and a market chart above it
      b.box(0, 1.2, -d / 2 + 0.6, 3.6, 2.4, 0.8, '#d8cdb4', { tex: 'marble' });
      g.box(0, 0.8, -d / 2 + 0.98, 1.6, 1.0, 0.04, '#e07a2a');
      screenWall(b, g, rng, 0, 4.4, -d / 2 + 0.3, 3.6, 1.6);
      for (const sx of [-1, 1]) for (let z = -d / 2 + 5; z < d / 2 - 3; z += 2.4) bookcase(b, rng, sx * (w / 2 - 0.35), z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, 2.2);
      for (const [x, z] of [[-4, zone.z1 - 4], [4, zone.z1 - 4], [-4, zone.z1 - 1.5], [4, zone.z1 - 1.5]]) {
        rug(b, x, z, 3.4, 2.4, '#6b1f24');
        table(b, x, z, 0.8, 0.8, '#4a3324', true);
        for (const sx of [-1, 1]) {
          const s = armchair(b, x + sx * 1.1, z, sx > 0 ? -Math.PI / 2 : Math.PI / 2, '#5a2e24');
          if (rng.chance(0.8)) sitAt(k, s[0], rng.chance(0.5) ? 'smart' : 'office');
        }
        k.solids.push({ x, z, w: 3, d: 1.4, h: 1 });
      }
      // Long reading table with green banker's lamps, members going over the annual reports
      const rz = zone.z0 + 1.5;
      table(b, 0, rz, 5, 1.2, '#4a3324');
      for (const lx of [-1.6, 0, 1.6]) {
        b.box(lx, 0.82, rz, 0.06, 0.14, 0.06, '#c9a24a');
        g.box(lx, 0.94, rz, 0.4, 0.1, 0.16, '#2f7a4a');
      }
      for (let i = 0; i < 6; i++) b.box(-2 + i * 0.8, 0.79, rz + (i % 2 ? 0.3 : -0.3), 0.3, 0.02, 0.4, '#f4efe2');
      k.solids.push({ x: 0, z: rz, w: 5.2, d: 1.4, h: 1 });
      for (const lx of [-1.8, -0.6, 0.6, 1.8])
        for (const side of [-1, 1]) {
          const cz = rz + side * 0.95;
          chair(b, lx, cz, side > 0 ? 0 : Math.PI, '#5a2e24');
          if (rng.chance(0.65)) sitAt(k, { x: lx, z: cz, rot: side > 0 ? Math.PI : 0 }, 'office', 'busy');
        }
      // Members chatting by the fire
      standAt(k, -2.6, -d / 2 + 2.4, 0.6, 'smart');
      standAt(k, -1.8, -d / 2 + 3.2, Math.PI + 0.9, 'office');
      standAt(k, 2.4, -d / 2 + 2.6, -0.5, 'smart', 'busy');
      walker(k, loop(k, 1), 'office');
      pendant(b, g, 0, 0, 8, 2.4, '#c9a24a');
    },
  },
  newsroom: {
    size: [34, 28, 8],
    floor: 'concrete',
    floorColor: '#6a7078',
    wall: '#e6e8ea',
    wallTex: 'concrete',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      // TV studio set: anchor desk, backdrop wall of screens, cameras on tripods
      screenWall(b, g, rng, 0, 3.3, -d / 2 + 0.3, 9, 3.6, 0, ['#3a8fd0', '#e0453a', '#f4f6fa']);
      b.box(0, 0.55, -d / 2 + 3.4, 4, 1.1, 1.2, '#1f3a6a', { tex: 'metal' });
      b.box(0, 1.12, -d / 2 + 3.4, 4.2, 0.06, 1.3, '#e9e4da');
      for (const x of [-1, 1]) {
        chair(b, x, -d / 2 + 2.6, 0, '#2f3138');
        sitAt(k, { x, z: -d / 2 + 2.6, rot: Math.PI }, 'smart');
      }
      for (const x of [-3, 3]) {
        b.box(x, 0.8, -d / 2 + 7.5, 0.05, 1.6, 0.05, BLACK);
        b.box(x, 1.65, -d / 2 + 7.5, 0.45, 0.35, 0.7, BLACK);
        standAt(k, x, -d / 2 + 8.3, 0, 'tech');
      }
      for (const x of [-4, 4]) g.box(x, h - 0.5, -d / 2 + 4.5, 0.6, 0.3, 0.6, '#fff4d6');
      // News desks
      for (let z = zone.z0 + 4; z < zone.z1 - 1; z += 2.4)
        for (const side of [-1, 1])
          for (let x = side * 3.4; Math.abs(x) < zone.x1 - 0.9; x += side * 2.0) {
            const seat = desk(k, x, z, 0, 2);
            if (rng.chance(0.7)) sitAt(k, seat, 'office', 'type');
          }
      walker(k, loop(k, 1), 'office');
    },
  },
  studio: {
    sideStations: true,
    size: [34, 28, 10],
    floor: 'concrete',
    floorColor: '#2a2c34',
    wall: '#24262e',
    wallTex: 'metal',
    counter: 'kiosk',
    windows: false,
    furnish: (k) => {
      const { b, g, d, h, rng } = k;
      // Quiz-show set: contestant podiums, host lectern, light rig, audience bleachers
      b.box(0, 0.2, -d / 2 + 5, 16, 0.4, 7, '#3a2f6a', { tex: 'metal' });
      for (let i = 0; i < 3; i++) {
        const x = -4 + i * 4;
        b.box(x, 0.95, -d / 2 + 6.5, 1.4, 1.1, 0.9, '#c9a24a');
        g.box(x, 1.2, -d / 2 + 6.96, 1.1, 0.4, 0.01, rng.pick(['#3dd6ff', '#ff4a6e', '#ffd54a']));
        standAt(k, x, -d / 2 + 5.8, 0, 'smart');
      }
      for (let x = -8; x <= 8; x += 1.6) g.box(x, h - 0.6, -d / 2 + 3, 0.4, 0.4, 0.4, rng.pick(['#ffffff', '#ffd54a', '#c77dff']));
      screenWall(b, g, rng, 0, 5, -d / 2 + 0.3, 12, 4.5, 0, ['#c77dff', '#3dd6ff', '#ffd54a']);
      seatRows(k, -9, 9, 2, 5, '#6b1f24').forEach((s, i) => {
        if (i % 2 === 0) k.actors.push({ x: s.x, z: s.z, rot: s.rot, pose: 'sit', dress: 'casual', seat: s.y + 0.48 });
      });
    },
  },
  theater: {
    sideStations: true,
    size: [34, 30, 11],
    floor: 'wood',
    floorColor: '#5a2a2a',
    wall: '#3a2626',
    wallTex: 'stucco',
    counter: 'kiosk',
    windows: false,
    furnish: (k) => {
      const { b, g, d, h, w } = k;
      // Stage with curtains, lectern and a projection screen
      b.box(0, 0.5, -d / 2 + 3.5, 18, 1.0, 6, '#5a3e2b', { tex: 'wood' });
      for (const sx of [-1, 1]) b.box(sx * 8.5, 4, -d / 2 + 1.2, 3, 7, 0.4, '#7a1f24');
      // Projection screen showing a money talk slide: title bar, bar chart and bullet lines
      g.box(0, 5, -d / 2 + 0.4, 10, 5, 0.05, '#e9eef2');
      g.box(0, 7, -d / 2 + 0.44, 8, 0.5, 0.02, '#1f3a5a');
      [1.2, 1.8, 2.5, 3.1].forEach((bh, i) => g.box(-3.6 + i * 1.0, 3.0 + bh / 2, -d / 2 + 0.44, 0.6, bh, 0.02, '#2f7a4a'));
      for (let i = 0; i < 4; i++) g.box(2.4, 6.0 - i * 0.7, -d / 2 + 0.44, 3, 0.16, 0.02, '#8a93a0');
      b.box(3, 1.5, -d / 2 + 4.5, 0.8, 1.1, 0.6, '#3a2618');
      standAt(k, 3, -d / 2 + 4, 0, 'smart');
      for (let x = -7; x <= 7; x += 3.5) g.box(x, h - 0.4, -d / 2 + 7, 0.5, 0.4, 0.5, '#fff1c6');
      seatRows(k, -11, 11, 2, 7, '#7a1f24', 0.3).forEach((s, i) => {
        if (i % 3 !== 1) k.actors.push({ x: s.x, z: s.z, rot: s.rot, pose: 'sit', dress: i % 2 ? 'smart' : 'casual', seat: s.y + 0.48 });
      });
      for (const sx of [-1, 1]) for (let z = -6; z < d / 2 - 2; z += 4) k.g.box(sx * (w / 2 - 0.2), 3, z, 0.1, 0.4, 0.3, '#ffd9a0');
    },
  },
  classroom: {
    size: [30, 26, 8],
    floor: 'wood',
    floorColor: '#a8845a',
    wall: '#efe9dc',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, d, rng } = k;
      b.box(0, 2.2, -d / 2 + 0.25, 9, 2.4, 0.08, '#f4f6fa');
      for (let i = 0; i < 10; i++) b.box(-4 + i * 0.8, 2.2 + rng.range(-0.8, 0.8), -d / 2 + 0.3, rng.range(0.3, 0.7), 0.06, 0.01, rng.pick(['#2f5f9a', '#c9455a', '#2f7a4a']));
      b.box(-6, 0.55, -d / 2 + 5, 1.6, 1.1, 0.7, DARK_WOOD, { tex: 'wood' });
      standAt(k, -6, -d / 2 + 4.2, 0, 'smart');
      for (let r = 0; r < 4; r++)
        for (const side of [-1, 1])
          for (let c = 0; c < 3; c++) {
            const x = side * (3 + c * 2.2);
            const z = -d / 2 + 9 + r * 2.4;
            table(b, x, z, 1.6, 0.6);
            chair(b, x, z + 0.7, 0, '#3a6b8a', false);
            if (rng.chance(0.75)) sitAt(k, { x, z: z + 0.7, rot: Math.PI }, 'casual', 'type');
            k.solids.push({ x, z: z + 0.3, w: 1.7, d: 1.4, h: 1 });
          }
      g.box(0, 7.9, 0, 6, 0.05, 1, '#fff4d6');
    },
  },
  restaurant: {
    size: [30, 26, 7],
    floor: 'wood',
    floorColor: '#7a4a2a',
    wall: '#e9d9c0',
    wallTex: 'stucco',
    counter: 'bar',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, d, h, w, rng } = k;
      // Kitchen pass behind the counters: steel, steam and hanging lanterns
      b.box(0, 1.4, -d / 2 + 0.6, w - 4, 2.8, 0.9, '#b9bec9', { tex: 'metal' });
      for (let i = 0; i < 6; i++) g.box(-w / 2 + 4 + i * ((w - 8) / 5), 1.6, -d / 2 + 1.06, 0.4, 0.2, 0.01, '#ffb040');
      for (let z = zone.z0 + 1.6; z < zone.z1 - 0.8; z += 2.8)
        for (const side of [-1, 1])
          for (let x = side * 3.6; Math.abs(x) < zone.x1 - 0.6; x += side * 3.0) {
            const seats = diningSet(k, x, z, 4, true, '#f4f1ea', '#5a2e24');
            g.geom(sphere(0.3, 8, 6), trs(x, h - 1.4, z), '#ff6a4a');
            b.box(x, h - 0.6, z, 0.02, 1.2, 0.02, '#2a2a2a');
            seats.forEach((s) => rng.chance(0.55) && sitAt(k, s, rng.chance(0.5) ? 'casual' : 'smart', 'eat'));
            // Dim sum steamers on the table
            for (let i = 0; i < 3; i++) b.geom(cylinder(0.14, 0.14, 0.1, 10), trs(x + (i - 1) * 0.3, 0.83, z), '#c9a87a', 'wood');
          }
      walker(k, loop(k, 1), 'chef');
    },
  },
  cafe: {
    size: [28, 24, 6.5],
    floor: 'wood',
    floorColor: '#8a6440',
    wall: '#e2d6c4',
    wallTex: 'brick',
    counter: 'bar',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, d, w, h, rng } = k;
      // Espresso bar backdrop, menu boards and pendant lamps
      b.box(0, 1.6, -d / 2 + 0.4, w - 6, 0.06, 0.5, DARK_WOOD);
      for (let i = 0; i < 3; i++) g.box(-4 + i * 4, 3.4, -d / 2 + 0.3, 2.6, 1.4, 0.02, '#1f2a24');
      for (let z = zone.z0 + 1.5; z < zone.z1 - 0.8; z += 2.4)
        for (const side of [-1, 1])
          for (let x = side * 3.4; Math.abs(x) < zone.x1 - 0.6; x += side * 2.6) {
            const seats = diningSet(k, x, z, 2, true, '#e9e4da', '#2f3138');
            seats.forEach((s) => {
              if (rng.chance(0.6)) {
                sitAt(k, s, 'tech', 'type');
              }
            });
            b.box(x, 0.79, z, 0.35, 0.02, 0.25, '#c8ccd4');
            pendant(b, g, x, z, h, 1.6, '#1f2226');
          }
      // Window bar with stools
      for (let x = -w / 2 + 3; x < w / 2 - 3; x += 1) {
        b.geom(cylinder(0.18, 0.18, 0.05, 8), trs(x, 0.75, d / 2 - 1.4), '#2f3138');
        b.geom(cylinder(0.03, 0.03, 0.75, 6), trs(x, 0.37, d / 2 - 1.4), STEEL);
      }
      walker(k, loop(k, -1), 'tech');
    },
  },
  market: {
    size: [36, 30, 9],
    floor: 'cobble',
    floorColor: '#8a8478',
    wall: '#c9bfae',
    wallTex: 'brick',
    counter: 'stall',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      const awnings = ['#b3261e', '#2f5f9a', '#2f7a4a', '#c98a2e'];
      for (let z = zone.z0 + 1.6; z < zone.z1 - 1; z += 3.6)
        for (const side of [-1, 1])
          for (let x = side * 4.2; Math.abs(x) < zone.x1 - 1.2; x += side * 3.4) {
            stall(k, x, z, 0, rng.pick(awnings), PRODUCE);
            standAt(k, x, z - 0.9, 0, 'work', 'busy');
            if (rng.chance(0.6)) standAt(k, x + rng.range(-0.8, 0.8), z + 1.1, Math.PI, 'casual', 'browse');
          }
      // String lights across the hall
      for (let z = -8; z < 10; z += 3) for (let x = -w / 2 + 2; x < w / 2 - 2; x += 1.6) g.geom(sphere(0.08, 5, 4), trs(x, h - 1.2 - Math.sin(((x + w / 2) / w) * Math.PI) * 0.6, z), '#ffe2a0');
      walker(k, loop(k, 1), 'casual');
      walker(k, loop(k, -1), 'casual');
    },
  },
  grocery: {
    size: [30, 26, 6.5],
    floor: 'concrete',
    floorColor: '#d9d6cf',
    wall: '#f2efe8',
    wallTex: 'stucco',
    counter: 'checkout',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      for (let z = zone.z0 + 1.2; z < zone.z1 - 1.2; z += 2.6)
        for (const side of [-1, 1]) {
          const len = zone.x1 - 3.4;
          gondola(b, rng, side * (3 + len / 2), z, len, GOODS);
          k.solids.push({ x: side * (3 + len / 2), z, w: len + 0.4, d: 1.0, h: 1.7 });
          if (rng.chance(0.7)) standAt(k, side * (3 + rng.next() * len), z + 0.9, Math.PI, 'casual', 'browse');
        }
      // Fridges along a side wall
      b.box(w / 2 - 0.6, 1.1, 0, 1.0, 2.2, 8, '#d9dde3', { tex: 'metal' });
      g.box(w / 2 - 1.12, 1.15, 0, 0.02, 1.7, 7.6, '#cfe9f2');
      for (let x = -w / 3; x <= w / 3; x += w / 3) g.box(x, h - 0.05, 0, 4, 0.05, 0.4, '#f4fbff');
      walker(k, loop(k, -1), 'casual');
    },
  },
  department: {
    size: [38, 30, 9],
    floor: 'marble',
    floorColor: '#efe9df',
    wall: '#f2ede4',
    wallTex: 'stucco',
    counter: 'checkout',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      const cloth = ['#2f3d55', '#d8cdb8', '#6b1f24', '#1f2226', '#8c9196', '#5b6f8f', '#c98a7a'];
      for (let z = zone.z0 + 1.5; z < zone.z1 - 1; z += 3)
        for (const side of [-1, 1])
          for (let x = side * 4; Math.abs(x) < zone.x1 - 1; x += side * 3.4) {
            if (rng.chance(0.5)) rack(b, rng, x, z, 2.2, cloth);
            else {
              b.box(x, 0.45, z, 2.0, 0.9, 1.0, '#e9e4da', { tex: 'marble' });
              g.box(x, 0.92, z, 1.8, 0.04, 0.8, '#fff6e0');
              for (let i = 0; i < 4; i++) b.box(x - 0.7 + i * 0.45, 1.02, z, 0.25, 0.16, 0.25, rng.pick(['#c9a24a', '#e9e4da', '#b3261e', '#2f3138']));
            }
            k.solids.push({ x, z, w: 2.4, d: 1.1, h: 1.6 });
            if (rng.chance(0.55)) standAt(k, x + rng.range(-0.8, 0.8), z + 1.0, Math.PI, 'smart', 'browse');
          }
      // Escalator up to a mezzanine
      const ex = -(w / 2 - 3);
      b.geom(new THREE.BoxGeometry(1.4, 0.3, 9), trs(ex, 2.4, d / 2 - 9, -Math.atan2(4.6, 8)), '#8d939c', 'metal');
      for (const s of [-0.75, 0.75]) b.geom(new THREE.BoxGeometry(0.1, 1.0, 9), trs(ex + s, 3.0, d / 2 - 9, -Math.atan2(4.6, 8)), '#bcd6e2');
      b.box(0, 4.8, -d / 2 + 3, w, 0.3, 6, '#e9e4da', { tex: 'marble' });
      g.box(0, 5.4, -d / 2 + 6.02, w - 1, 0.8, 0.04, '#bcd6e2');
      k.solids.push({ x: ex, z: d / 2 - 9, w: 1.8, d: 9, h: 5 });
      for (const x of [-6, 6]) mannequin(b, x, d / 2 - 3.5, rng.pick(cloth));
      for (let x = -w / 3; x <= w / 3; x += w / 3) pendant(b, g, x, 4, h, 2.2, '#c9a24a');
      walker(k, loop(k, 1), 'smart');
    },
  },
  boutique: {
    size: [28, 24, 7],
    floor: 'wood',
    floorColor: '#c9b08a',
    wall: '#f4efe6',
    wallTex: 'stucco',
    counter: 'checkout',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      const cloth = ['#2f3d55', '#d8cdb8', '#6b1f24', '#1f2226', '#8c9196', '#5b6f8f', '#c98a7a'];
      for (const sx of [-1, 1]) for (let z = -6; z < 6; z += 2.6) rack(b, rng, sx * (w / 2 - 0.8), z, 2.2, cloth, false);
      for (let z = zone.z0 + 2; z < zone.z1 - 1; z += 3)
        for (const side of [-1, 1]) {
          mannequin(b, side * 4, z, rng.pick(cloth));
          rack(b, rng, side * 7, z, 2.2, cloth);
          k.solids.push({ x: side * 7, z, w: 2.4, d: 0.6, h: 1.6 });
          if (rng.chance(0.6)) standAt(k, side * 7, z + 0.8, Math.PI, 'smart', 'browse');
        }
      // Fitting rooms with curtains
      for (let i = 0; i < 3; i++) b.box(-zone.x1 + 1 + i * 1.6, 1.3, zone.z1 - 0.8, 1.5, 2.2, 0.05, '#7a5a6a');
      for (const x of [-w / 4, w / 4]) pendant(b, g, x, 0, h, 1.4, '#e9e4da');
    },
  },
  furniture: {
    size: [36, 30, 8],
    floor: 'concrete',
    floorColor: '#b9b3a8',
    wall: '#efebe4',
    wallTex: 'stucco',
    counter: 'checkout',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, rng } = k;
      // Room vignettes: living rooms and bedrooms on rugs, each with a lamp
      const vignettes: [number, number][] = [];
      for (let z = zone.z0 + 2; z < zone.z1 - 2; z += 5) for (const side of [-1, 1]) vignettes.push([side * (zone.x1 - 3.5), z]);
      vignettes.forEach(([x, z], i) => {
        rug(b, x, z, 4.6, 3.6, rng.pick(['#8a6a5a', '#5b6f8f', '#c9b48a', '#6b7a5a']));
        if (i % 2 === 0) {
          const seats = sofa(b, x, z - 0.8, 0, rng.pick(['#5b6f8f', '#c9a87a', '#4a5a4a', '#8a3a3a']));
          table(b, x, z + 0.5, 1.2, 0.6, '#4a3324');
          if (rng.chance(0.5)) sitAt(k, seats[0], 'casual');
        } else {
          b.box(x, 0.3, z, 2.0, 0.6, 2.2, '#4a3324', { tex: 'wood' });
          b.box(x, 0.65, z + 0.1, 1.9, 0.2, 2.0, '#f2efe6');
          b.box(x, 0.75, z - 0.8, 0.7, 0.15, 0.4, '#e9e4da');
          b.box(x, 1.0, z - 1.1, 2.0, 1.0, 0.12, '#4a3324', { tex: 'wood' });
        }
        b.box(x + 1.9, 0.75, z - 1.2, 0.04, 1.5, 0.04, BLACK);
        g.geom(new THREE.CylinderGeometry(0.18, 0.28, 0.35, 10), trs(x + 1.9, 1.6, z - 1.2), '#ffe9c0');
        k.solids.push({ x, z, w: 3.8, d: 2.8, h: 1 });
        if (rng.chance(0.6)) standAt(k, x + rng.range(-1.5, 1.5), z + 2.2, Math.PI, 'casual', 'browse');
      });
      walker(k, loop(k, 1), 'casual');
    },
  },
  pets: {
    size: [28, 24, 6.5],
    floor: 'concrete',
    floorColor: '#c9c2b0',
    wall: '#eef3ec',
    wallTex: 'stucco',
    counter: 'checkout',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, rng } = k;
      // Aquarium wall, animal enclosures, pet-food aisles
      b.box(-w / 2 + 0.7, 1.2, 0, 1.2, 2.4, 9, DARK_WOOD);
      g.box(-w / 2 + 1.32, 1.4, 0, 0.02, 1.6, 8.6, '#3f8fb0');
      for (let i = 0; i < 14; i++) g.box(-w / 2 + 1.34, 0.8 + rng.next() * 1.2, -4 + rng.next() * 8, 0.01, 0.08, 0.16, rng.pick(['#ffb040', '#ff6a8a', '#ffe060']));
      for (let z = zone.z0 + 1.5; z < zone.z1 - 1; z += 3) {
        gondola(b, rng, 5.5, z, 4, ['#c9a24a', '#5a7a4a', '#b3261e', '#2f5f9a', '#e9e4da']);
        k.solids.push({ x: 5.5, z, w: 4.4, d: 1, h: 1.7 });
        if (rng.chance(0.6)) standAt(k, 5 + rng.range(-1, 1), z + 0.9, Math.PI, 'casual', 'browse');
      }
      for (let i = 0; i < 3; i++) {
        const z = zone.z0 + 2 + i * 2.6;
        b.box(-5, 0.6, z, 2.2, 1.2, 1.4, '#e9e4da');
        for (let t = -1; t <= 1; t += 0.2) b.box(-5 + t, 0.65, z + 0.7, 0.02, 1.1, 0.02, STEEL);
        b.geom(sphere(0.25, 8, 6), trs(-5 + rng.range(-0.6, 0.6), 0.3, z), rng.pick(['#c9a87a', '#2a2a2a', '#e9e4da']));
        k.solids.push({ x: -5, z, w: 2.4, d: 1.6, h: 1.3 });
      }
      walker(k, loop(k, -1), 'casual');
    },
  },
  showroom: {
    size: [38, 30, 9],
    floor: 'marble',
    floorColor: '#e6e8ea',
    wall: '#f4f6f8',
    wallTex: 'metal',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      const paints = ['#b3261e', '#1d2b3f', '#e9e9e6', '#5a5f66', '#2f5f3a'];
      const spots: [number, number, string][] = [
        [-(zone.x1 - 3), zone.z0 + 3, 'sedan'],
        [zone.x1 - 3, zone.z0 + 3, 'suv'],
        [-(zone.x1 - 3), zone.z1 - 3.5, 'hatch'],
        [zone.x1 - 3, zone.z1 - 3.5, 'sedan'],
      ];
      for (const [x, z, model] of spots) {
        b.geom(cylinder(2.8, 2.8, 0.12, 28), trs(x, 0.06, z), '#d9dde3', 'metal');
        const car = carGeometry(model as 'sedan');
        const rot = rng.range(0.3, 1.2);
        b.geom(car.paint, trs(x, 0.12, z, 0, rot, 0), rng.pick(paints));
        b.geom(car.trim, trs(x, 0.12, z, 0, rot, 0), null);
        k.solids.push({ x, z, w: 4.8, d: 4.8, h: 1.6 });
        standAt(k, x + 2.6, z + 1.6, -2.4, 'casual', 'browse');
      }
      for (let x = -w / 3; x <= w / 3; x += w / 3) g.box(x, h - 0.05, 0, 5, 0.05, 0.4, '#f4fbff');
      walker(k, loop(k, 1), 'smart');
    },
  },
  warehouse: {
    size: [38, 30, 10],
    floor: 'concrete',
    floorColor: '#8a8a84',
    wall: '#b9bec4',
    wallTex: 'metal',
    counter: 'kiosk',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      // Safety lines, pallet racking, crates, a conveyor and a forklift
      for (const side of [-1, 1]) b.box(side * 2.4, 0.012, 0, 0.12, 0.02, 24, '#e9c43a', { ao: false });
      for (let z = zone.z0 + 1.5; z < zone.z1 - 2; z += 3.4)
        for (const side of [-1, 1]) {
          const len = zone.x1 - 3.6;
          palletRack(b, rng, side * (3.4 + len / 2), z, len);
          k.solids.push({ x: side * (3.4 + len / 2), z, w: len + 0.4, d: 1.4, h: 4.4 });
          if (rng.chance(0.5)) standAt(k, side * (3.4 + rng.next() * len), z + 1.1, Math.PI, 'work', 'browse');
        }
      // Packing conveyor along the right of the entrance, clear of the main aisle
      const c0 = 3.4, c1 = zone.x1 - 3.2, cx = (c0 + c1) / 2, cl = c1 - c0;
      b.box(cx, 0.8, zone.z1 - 1.2, cl, 0.2, 1.0, '#3a3f45', { tex: 'metal' });
      for (let x = c0 + 0.4; x < c1 - 0.3; x += 1.6) b.box(x, 1.05, zone.z1 - 1.2, 0.6, 0.4, 0.6, rng.pick(['#c9a77a', '#b8895a', '#d9c49a']), { tex: 'wood' });
      for (let x = c0; x <= c1; x += 2) b.box(x, 0.35, zone.z1 - 1.2, 0.08, 0.7, 0.9, STEEL);
      k.solids.push({ x: cx, z: zone.z1 - 1.2, w: cl + 0.2, d: 1.2, h: 1.2 });
      for (let x = c0 + 1; x < c1; x += 3.5) standAt(k, x, zone.z1 - 0.3, Math.PI, 'work', 'busy');
      crates(b, rng, zone.x1 - 1.5, zone.z1 - 1.5);
      b.box(-(zone.x1 - 2), 0.6, zone.z1 - 2, 1.2, 1.0, 2.0, '#e9b23a');
      b.box(-(zone.x1 - 2), 1.6, zone.z1 - 2.2, 1.1, 1.0, 1.0, '#2f3138');
      b.box(-(zone.x1 - 2), 1.5, zone.z1 - 0.9, 0.9, 3.0, 0.1, '#3a3f45');
      for (let x = -w / 3; x <= w / 3; x += w / 3) g.box(x, h - 0.3, 0, 0.6, 0.1, 6, '#f4fbff');
      walker(k, [[2.2, zone.z1 - 3], [2.2, zone.z0 + 1], [-2.2, zone.z0 + 1], [-2.2, zone.z1 - 3]], 'work');
    },
  },
  lab: {
    size: [32, 26, 7.5],
    floor: 'concrete',
    floorColor: '#2a2e36',
    wall: '#3a3f4a',
    wallTex: 'metal',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, g, zone, w, d, rng } = k;
      // Server aisles with blinking lights behind glass, analyst desks with dark screens
      for (let x = -(zone.x1 - 1); x < -2.4; x += 1.6) for (const z of [zone.z0 + 1.5, zone.z0 + 3.8]) {
        serverRack(b, g, rng, x, z, 0);
        k.solids.push({ x, z, w: 0.8, d: 1.1, h: 2.1 });
      }
      glassWall(b, k.gl, -(zone.x1 / 2 + 1.2), zone.z0 + 5.6, zone.x1 - 2, true);
      for (let z = zone.z0 + 1.2; z < zone.z1 - 1; z += 2.4)
        for (let x = 3.4; x < zone.x1 - 0.9; x += 2.0) {
          const seat = desk(k, x, z, 0, 2, '#1f2226');
          if (rng.chance(0.7)) sitAt(k, seat, 'tech', 'type');
        }
      screenWall(b, g, rng, 0, 4.4, -d / 2 + 0.3, w - 8, 2.6, 0, ['#2fd07a', '#3dd6ff', '#e0453a']);
      walker(k, loop(k, -1), 'tech');
    },
  },
  greenhouse: {
    size: [34, 28, 9],
    floor: 'path',
    floorColor: '#b9a888',
    wall: '#e6efe6',
    wallTex: 'metal',
    counter: 'stall',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, h, rng } = k;
      for (let z = zone.z0 + 1.2; z < zone.z1 - 1; z += 2.4)
        for (const side of [-1, 1]) {
          const len = zone.x1 - 3.4;
          plantingBed(b, rng, side * (3 + len / 2), z, len);
          k.solids.push({ x: side * (3 + len / 2), z, w: len + 0.2, d: 1.3, h: 1 });
          if (rng.chance(0.55)) standAt(k, side * (3 + rng.next() * len), z + 1.0, Math.PI, 'work', 'busy');
        }
      for (const side of [-1, 1]) for (let z = -8; z < 10; z += 4) plant(b, side * (w / 2 - 1.2), z, true);
      // Glass roof ribs
      for (let x = -w / 2; x <= w / 2; x += 2.5) b.box(x, h - 0.2, 0, 0.1, 0.1, 28, '#e9ecef');
      g.box(0, h - 0.1, 0, w, 0.02, 26, '#e8f4e8');
      walker(k, loop(k, 1), 'work');
    },
  },
  council: {
    sideStations: true,
    size: [32, 28, 10],
    floor: 'wood',
    floorColor: '#6b4a30',
    wall: '#efe7d6',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, d, h, w, rng } = k;
      // Horseshoe of councillors' desks facing a raised dais, public gallery behind
      b.box(0, 0.4, -d / 2 + 2.5, 10, 0.8, 3, '#5a3e2b', { tex: 'wood' });
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + (i / 8) * 0.7);
        const x = Math.cos(a) * 8;
        const z = zone.z0 + 4 - Math.sin(a) * 3.5 + 3;
        const rot = Math.atan2(-x, -(z - (-d / 2 + 2.5)));
        b.box(x, 0.75, z, 1.6, 0.06, 0.7, '#4a3324', { rotY: rot, tex: 'wood' });
        const [cx, cz] = at(x, z, rot, 0, 0.7);
        chair(b, cx, cz, rot, '#2f4a32', false);
        if (rng.chance(0.75)) sitAt(k, { x: cx, z: cz, rot: rot + Math.PI }, 'office');
        k.solids.push({ x, z, w: 1.6, d: 1.4, h: 1 });
      }
      for (const x of [-2.2, 2.2]) {
        b.geom(cylinder(0.04, 0.04, 2.6, 6), trs(x, 1.3, -d / 2 + 0.8), '#c9a24a');
        b.box(x + 0.45, 2.2, -d / 2 + 0.8, 0.9, 0.6, 0.02, x < 0 ? '#2f4a7a' : '#7a2e3a');
      }
      seatRows(k, -8, 8, zone.z1 - 4.5, 3, '#2f4a32', 0.2).forEach((s, i) => i % 3 === 0 && k.actors.push({ x: s.x, z: s.z, rot: s.rot, pose: 'sit', dress: 'casual', seat: s.y + 0.48 }));
      pendant(b, g, 0, 0, h, 3, '#c9a24a');
    },
  },
  depot: {
    size: [32, 26, 8],
    floor: 'concrete',
    floorColor: '#9a9a94',
    wall: '#e6e8ea',
    wallTex: 'concrete',
    counter: 'desk',
    windows: false,
    furnish: (k) => {
      const { b, zone, rng } = k;
      for (let z = zone.z0 + 1; z < zone.z0 + 6; z += 2.6)
        for (const side of [-1, 1]) {
          const len = zone.x1 - 3.4;
          palletRack(b, rng, side * (3.4 + len / 2), z, len);
          k.solids.push({ x: side * (3.4 + len / 2), z, w: len + 0.4, d: 1.4, h: 4.4 });
        }
      // Cots and first-aid stations
      for (let i = 0; i < 6; i++) {
        const x = -(zone.x1 - 1.5) + (i % 3) * 2.2;
        const z = zone.z1 - 3 + Math.floor(i / 3) * 2.2;
        b.box(x, 0.4, z, 0.9, 0.12, 2.0, '#4a6a4a');
        for (const lx of [-0.4, 0.4]) for (const lz of [-0.9, 0.9]) b.box(x + lx, 0.17, z + lz, 0.04, 0.34, 0.04, STEEL);
        k.solids.push({ x, z, w: 1, d: 2.1, h: 0.6 });
      }
      for (let i = 0; i < 3; i++) {
        const x = 4 + i * 2.4;
        b.box(x, 0.75, zone.z1 - 2, 1.6, 0.06, 0.8, '#e9e4da');
        b.box(x, 0.85, zone.z1 - 2, 0.4, 0.2, 0.3, '#c9455a');
        standAt(k, x, zone.z1 - 1.3, Math.PI, 'work', 'busy');
      }
      walker(k, loop(k, -1), 'work');
    },
  },
  community: {
    size: [30, 26, 7],
    floor: 'wood',
    floorColor: '#a8845a',
    wall: '#f2ece0',
    wallTex: 'brick',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, zone, w, rng } = k;
      // Donation bins, sorting tables with volunteers, notice boards
      for (let i = 0; i < 4; i++) {
        const x = -(zone.x1 - 1) + i * 1.5;
        b.box(x, 0.55, zone.z1 - 1, 1.1, 1.1, 0.9, rng.pick(['#2f5f9a', '#2f7a4a', '#c9455a', '#e0b03a']));
        b.box(x, 1.12, zone.z1 - 1, 0.6, 0.04, 0.12, BLACK);
      }
      k.solids.push({ x: -(zone.x1 - 3.2), z: zone.z1 - 1, w: 6, d: 1, h: 1.2 });
      for (const [x, z] of [[4, zone.z0 + 2], [8, zone.z0 + 2], [4, zone.z0 + 5], [8, zone.z0 + 5]]) {
        table(b, x, z, 2.2, 1.0, '#c9b48a');
        for (let i = 0; i < 5; i++) b.box(x - 0.8 + i * 0.4, 0.88, z, 0.3, 0.22, 0.3, rng.pick(['#c9a77a', '#e9e4da', '#b3261e', '#2f5f9a']));
        standAt(k, x, z + 0.9, Math.PI, 'casual', 'busy');
        k.solids.push({ x, z, w: 2.3, d: 1.1, h: 1 });
      }
      for (const sx of [-1, 1]) {
        b.box(sx * (w / 2 - 0.15), 1.9, 2, 0.1, 1.4, 3.4, '#a8774a', { tex: 'wood' });
        for (let i = 0; i < 9; i++) b.box(sx * (w / 2 - 0.22), 1.5 + (i % 3) * 0.35, 0.8 + Math.floor(i / 3) * 1.0, 0.02, 0.28, 0.6, rng.pick(['#fff4cf', '#e3f7f7', '#fde4ef', '#f4f6fa']));
      }
      walker(k, loop(k, -1), 'casual');
    },
  },
  atrium: {
    size: [36, 30, 11],
    floor: 'marble',
    floorColor: '#ece6da',
    wall: '#f2ede2',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, d, h, rng } = k;
      // Grand atrium: central info screens, a tree, benches, mezzanine balcony
      b.geom(cylinder(2.2, 2.4, 0.6, 20), trs(0, 0.3, zone.z0 + 4), '#cfc6b2', 'stone');
      b.geom(cylinder(0.25, 0.35, 3, 8), trs(0, 2, zone.z0 + 4), '#6b5340', 'bark');
      for (let i = 0; i < 9; i++) b.geom(sphere(1.0, 8, 6), trs(Math.cos(i) * 1.1, 4 + (i % 3) * 0.6, zone.z0 + 4 + Math.sin(i) * 1.1), '#4a7a3a', 'leaves');
      k.solids.push({ x: 0, z: zone.z0 + 4, w: 4.6, d: 4.6, h: 1 });
      for (const side of [-1, 1]) {
        screenWall(b, g, rng, side * (w / 2 - 0.3), 3.2, 0, 6, 2.6, side > 0 ? -Math.PI / 2 : Math.PI / 2, ['#3a8fd0', '#2fd07a', '#f4f6fa']);
        for (let z = zone.z0 + 1.5; z < zone.z1 - 1; z += 3.2) {
          const s = sofa(b, side * (zone.x1 - 1.5), z, side > 0 ? -Math.PI / 2 : Math.PI / 2, '#3f5468', 2.4);
          k.solids.push({ x: side * (zone.x1 - 1.5), z, w: 1, d: 2.5, h: 1 });
          if (rng.chance(0.6)) sitAt(k, s[0], 'casual');
        }
      }
      // Mezzanine balcony with glass railing around three sides
      b.box(0, 5.4, -d / 2 + 2.5, w, 0.3, 5, '#e9e4da', { tex: 'marble' });
      g.box(0, 6.1, -d / 2 + 5.02, w - 1, 1.0, 0.04, '#bcd6e2');
      for (let x = -w / 3; x <= w / 3; x += w / 3) pendant(b, g, x, 4, h, 3, '#c9a24a');
      walker(k, loop(k, 1), 'casual');
      walker(k, loop(k, -1), 'smart');
    },
  },
  travel: {
    size: [28, 24, 7],
    floor: 'wood',
    floorColor: '#a8845a',
    wall: '#eef2f4',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, d, rng } = k;
      // Big wall map with pins, luggage, a departures board, comfy seats
      b.box(0, 3.2, -d / 2 + 0.25, 10, 3.6, 0.08, '#8fb8cc');
      for (let i = 0; i < 9; i++) b.box(-4.5 + rng.next() * 9, 1.6 + rng.next() * 3.2, -d / 2 + 0.3, rng.range(0.6, 1.8), rng.range(0.4, 1.2), 0.02, '#c9b48a');
      for (let i = 0; i < 6; i++) b.geom(sphere(0.07, 5, 4), trs(-4 + rng.next() * 8, 2 + rng.next() * 2.5, -d / 2 + 0.33), '#c9455a');
      screenWall(b, g, rng, w / 2 - 0.3, 3, 0, 4, 2, -Math.PI / 2, ['#ffd54a', '#f4f6fa']);
      for (const side of [-1, 1])
        for (let z = zone.z0 + 2; z < zone.z1 - 1; z += 2.8) {
          const s = sofa(b, side * 4.5, z, Math.PI, '#3f5468', 2.4);
          k.solids.push({ x: side * 4.5, z, w: 2.5, d: 1, h: 1 });
          if (rng.chance(0.55)) sitAt(k, { ...s[0], rot: s[0].rot }, 'casual');
          b.box(side * 6.6, 0.35, z, 0.5, 0.7, 0.35, rng.pick(['#b3261e', '#2f5f9a', '#2f3138']));
        }
    },
  },
  lounge: {
    size: [30, 26, 8],
    floor: 'wood',
    floorColor: '#9a7a5a',
    wall: '#f2ede4',
    wallTex: 'stucco',
    counter: 'desk',
    windows: true,
    furnish: (k) => {
      const { b, g, zone, w, rng } = k;
      // Advisers' desks with clients, a sunny lounge, a long-term growth chart
      for (const z of [zone.z0 + 1.5, zone.z0 + 4.5])
        for (const side of [-1, 1]) {
          const x = side * 5;
          const seat = desk(k, x, z, 0, 1, '#5a3e2b');
          sitAt(k, seat, 'office', 'type');
          chair(b, x, z - 0.9, Math.PI, '#5a3e2b', false);
          sitAt(k, { x, z: z - 0.9, rot: 0 }, 'smart');
        }
      for (const side of [-1, 1]) {
        const s = sofa(b, side * (zone.x1 - 2), zone.z1 - 2, Math.PI, '#c9a87a', 2.4);
        k.solids.push({ x: side * (zone.x1 - 2), z: zone.z1 - 2, w: 2.5, d: 1, h: 1 });
        sitAt(k, s[1] ?? s[0], 'smart');
        plant(b, side * (w / 2 - 1.2), zone.z1 - 2, true);
      }
      screenWall(b, g, rng, -(w / 2 - 0.3), 3, 0, 5, 2.4, Math.PI / 2, ['#2fd07a', '#f4f6fa']);
      walker(k, loop(k, 1), 'smart');
    },
  },
};

/** Which interior each enterable building gets. */
export const BUILDING_INTERIOR: Record<string, string> = {
  'welcome-center': 'atrium',
  bank: 'bank-hall',
  'credit-bureau': 'service-office',
  'style-studio': 'boutique',
  library: 'library',
  'town-hall': 'council',
  arcade: 'arcade',
  'furniture-store': 'furniture',
  'pet-shop': 'pets',
  'auto-dealer': 'showroom',
  'real-estate': 'open-office',
  'map-travel': 'travel',
  'ny-exchange': 'trading-floor',
  'ny-brokerage': 'open-office',
  'ny-investment-club': 'club',
  'ny-quiz-tower': 'studio',
  'ny-newsroom': 'newsroom',
  'ny-theater': 'theater',
  'london-market': 'market',
  'dept-store': 'department',
  'corner-shop': 'grocery',
  'currency-exchange': 'service-office',
  'rent-buy-office': 'open-office',
  'budget-hall': 'classroom',
  'night-market': 'market',
  'harbor-trading': 'warehouse',
  'business-registry': 'service-office',
  'accounting-office': 'open-office',
  'dim-sum': 'restaurant',
  'trade-hall': 'warehouse',
  'sf-job-center': 'service-office',
  'tech-campus': 'tech-office',
  'coding-cafe': 'cafe',
  'sorting-center': 'warehouse',
  'cyber-lab': 'lab',
  'tax-office': 'service-office',
  'savings-garden': 'greenhouse',
  'retirement-tower': 'lounge',
  'insurance-office': 'open-office',
  'emergency-center': 'depot',
  'borrowing-booth': 'service-office',
  'giving-center': 'community',
};

/** Arcade: rows of game cabinets, neon, prize corner (used by the Coin Arcade). */
KINDS.arcade = {
  size: [32, 26, 7],
  floor: 'concrete',
  floorColor: '#2a1f3d',
  wall: '#2b2440',
  wallTex: 'stucco',
  counter: 'kiosk',
  windows: false,
  furnish: (k) => {
    const { b, g, zone, w, d, h, rng } = k;
    const scr = ['#2ebaba', '#f06aa8', '#ffcf3f', '#8a5cf6', '#3cc45a'];
    for (let z = zone.z0 + 1.2; z < zone.z1 - 1; z += 2.4)
      for (const side of [-1, 1])
        for (let x = side * 3.4; Math.abs(x) < zone.x1 - 0.6; x += side * 1.3) {
          b.box(x, 1.0, z, 1.0, 2.0, 0.9, '#1d1f2e');
          g.box(x, 1.35, z + 0.46, 0.62, 0.55, 0.02, rng.pick(scr));
          g.box(x, 1.95, z + 0.46, 0.7, 0.18, 0.02, rng.pick(scr));
          k.solids.push({ x, z, w: 1.1, d: 1, h: 2 });
          if (rng.chance(0.4)) standAt(k, x, z + 0.95, Math.PI, 'casual', 'busy');
        }
    for (const sx of [-1, 1]) g.box(sx * (w / 2 - 0.2), h - 0.5, 0, 0.06, 0.06, d - 1, sx > 0 ? '#f06aa8' : '#2ebaba');
    walker(k, loop(k, 1), 'casual');
  },
};
