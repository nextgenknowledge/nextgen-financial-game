/**
 * Mission identity: what each enterable building is for should be readable from the street.
 *
 * The office and civic templates are shared by several buildings, so on their own the only
 * difference is the sign. Each building listed here gets its own:
 *  - ground floor (shopfront, arcade or heavy stone base),
 *  - upper floors (pilasters, fins, bay windows or balconies),
 *  - emblem on the front that says what happens inside (a score gauge, an abacus, a safe door...),
 *  - lit display windows either side of the door with the work going on inside,
 *  - and, for civic halls, its own rooftop (clock tower, dome, cupola, beacon or glass lantern).
 *
 * Everything is built in the building's local frame: the door faces +Z and the front wall is at z = d/2.
 */
import * as THREE from 'three';
import { cylinder, sphere } from '@/engine/voxel';
import type { Rng } from '@/game/rng';
import { Frame, shade, type BuildingSpec } from './buildings';

export type EmblemKind = 'gauge' | 'house' | 'abacus' | 'key' | 'globe' | 'umbrella' | 'seal' | 'scales' | 'safe' | 'heart';
export type DisplayKind = 'desks' | 'listings' | 'ledgers' | 'forms' | 'news' | 'jars' | 'safes' | 'charts' | 'notices';
export type CivicTop = 'clock' | 'dome' | 'cupola' | 'beacon' | 'lantern';

export interface MissionLook {
  ground?: 'shopfront' | 'arcade' | 'rusticated';
  upper?: 'pilasters' | 'fins' | 'bays' | 'balconies';
  emblem?: EmblemKind;
  /** Emblem colours: backing disc and the figure on it. */
  emblemBg?: string;
  emblemFg?: string;
  displays?: [DisplayKind, DisplayKind];
  top?: CivicTop;
  roof?: 'mast';
  extra?: 'vault' | 'dropbox' | 'donations' | 'noticeboard';
}

const LOOKS: Record<string, MissionLook> = {
  // ── The six office buildings
  'credit-bureau': { ground: 'shopfront', upper: 'pilasters', emblem: 'gauge', emblemBg: '#1e2840', displays: ['desks', 'charts'] },
  'real-estate': { ground: 'arcade', upper: 'balconies', emblem: 'house', emblemBg: '#2f7a4a', emblemFg: '#f4efe2', displays: ['listings', 'listings'] },
  'accounting-office': { ground: 'rusticated', upper: 'fins', emblem: 'abacus', emblemBg: '#7a1f1f', displays: ['ledgers', 'desks'] },
  'rent-buy-office': { ground: 'shopfront', upper: 'bays', emblem: 'key', emblemBg: '#1e3a5a', displays: ['listings', 'charts'] },
  'ny-newsroom': { ground: 'shopfront', upper: 'pilasters', emblem: 'globe', emblemBg: '#1e2840', displays: ['news', 'desks'], roof: 'mast' },
  'insurance-office': { ground: 'arcade', upper: 'fins', emblem: 'umbrella', emblemBg: '#f4efe2', emblemFg: '#2f6bdb', displays: ['desks', 'charts'] },
  // ── The five civic halls
  'town-hall': { emblem: 'seal', emblemBg: '#2f6a3f', emblemFg: '#e0b83a', displays: ['notices', 'forms'], top: 'clock', extra: 'noticeboard' },
  'tax-office': { emblem: 'seal', emblemBg: '#1e2840', emblemFg: '#e0b83a', displays: ['forms', 'forms'], top: 'dome', extra: 'dropbox' },
  'budget-hall': { emblem: 'scales', emblemBg: '#5a1f2a', emblemFg: '#e0b83a', displays: ['ledgers', 'charts'], top: 'cupola' },
  'emergency-center': { emblem: 'safe', emblemBg: '#c8322c', displays: ['safes', 'jars'], top: 'beacon' },
  'giving-center': { emblem: 'heart', emblemBg: '#f4efe2', emblemFg: '#e0475b', displays: ['jars', 'charts'], top: 'lantern', extra: 'donations' },
  // ── Others with one signature touch
  bank: { extra: 'vault' },
};

export const missionLook = (id?: string): MissionLook | undefined => (id ? LOOKS[id] : undefined);


const tmpEuler = new THREE.Euler();
const tmpM = new THREE.Matrix4();
/**
 * Frame.geom applies its tilt about the world X axis, so a disc tilted to face the street only faces
 * it on buildings whose door looks north or south. Here the local rotation is baked into the shape
 * first (spin in the wall plane, then tilt, then turn), so emblems face the street whichever way
 * the building stands.
 */
function geo(f: Frame, g: THREE.BufferGeometry, x: number, y: number, z: number, color: string, rx = 0, ry = 0, rz = 0, s = 1, target: 'solid' | 'neon' | 'lit' = 'solid', tex?: string) {
  let shape = g;
  if (rx || ry || rz) {
    shape = g.clone();
    shape.applyMatrix4(tmpM.makeRotationFromEuler(tmpEuler.set(rx, ry, rz, 'YXZ')));
  }
  f.geom(shape, x, y, z, color, 0, 0, 0, s, target, tex);
}

const GOLD = '#e0b83a';
const NAVY = '#1e2840';
const STEEL = '#9aa1ab';
const PAPER = '#f4f1e8';
const WARM = '#f2dfb8';

/* ───────── Emblems (built facing +Z, centred on x, y, with the back on plane z) ───────── */

/** A flat round plaque facing the street. */
function plaque(f: Frame, x: number, y: number, z: number, r: number, depth: number, color: string, target: 'solid' | 'neon' = 'solid') {
  geo(f, cylinder(r, r, depth, 24), x, y, z + depth / 2, color, Math.PI / 2, 0, 0, 1, target);
}
/** A flat bar in the facade plane, rotated `a` radians about the facing axis. */
function bar(f: Frame, x: number, y: number, z: number, len: number, thick: number, depth: number, color: string, a = 0, target: 'solid' | 'neon' | 'lit' = 'solid') {
  geo(f, new THREE.BoxGeometry(len, thick, depth), x, y, z + depth / 2, color, 0, 0, a, 1, target);
}
function ring(f: Frame, x: number, y: number, z: number, r: number, tube: number, color: string) {
  geo(f, new THREE.TorusGeometry(r, tube, 6, 28), x, y, z + tube, color);
}

export function emblem(f: Frame, kind: EmblemKind, x: number, y: number, z: number, r: number, bg = NAVY, fg = GOLD) {
  // Backing disc with a gold rim, like a cast plaque
  plaque(f, x, y, z, r, 0.2, bg);
  ring(f, x, y, z + 0.12, r - 0.08, 0.09, GOLD);
  const zf = z + 0.2; // front of the backing disc
  switch (kind) {
    case 'gauge': {
      // Credit score dial: red to green arc and a needle pointing high
      const cols = ['#d8442f', '#ee8a2c', '#f2cf3a', '#9cc93f', '#3fae4f'];
      const R = r * 0.66;
      const cy = y - r * 0.22;
      for (let i = 0; i < 5; i++) {
        const a = Math.PI - ((i + 0.5) * Math.PI) / 5;
        bar(f, x + Math.cos(a) * R, cy + Math.sin(a) * R, zf, R * 0.58, r * 0.2, 0.12, cols[i], a - Math.PI / 2);
      }
      const n = 0.5;
      bar(f, x + Math.cos(n) * R * 0.4, cy + Math.sin(n) * R * 0.4, zf + 0.04, R * 0.85, 0.12, 0.1, '#f4f1e8', n);
      plaque(f, x, cy, zf, 0.2, 0.18, GOLD);
      break;
    }
    case 'house': {
      // A little house: walls, door, window and a pitched roof
      const s = r * 0.66;
      f.block(x, y - s * 0.95, zf + 0.06, s * 1.5, s * 1.15, 0.12, fg);
      f.block(x - s * 0.35, y - s * 0.95, zf + 0.13, s * 0.36, s * 0.7, 0.04, '#7a4a2a');
      f.block(x + s * 0.35, y - s * 0.4, zf + 0.13, s * 0.36, s * 0.32, 0.04, '#8fb8dc');
      for (const side of [-1, 1]) bar(f, x + side * s * 0.47, y + s * 0.47, zf + 0.04, s * 1.35, s * 0.24, 0.14, '#c0512f', side * -0.72);
      f.block(x + s * 0.45, y + s * 0.25, zf + 0.06, s * 0.22, s * 0.6, 0.1, '#7a4a2a'); // chimney
      break;
    }
    case 'abacus': {
      // Wooden frame, four rods, beads pushed to one side
      const w = r * 1.25;
      const h = r * 1.0;
      for (const side of [-1, 1]) {
        f.block(x, y + side * (h / 2) - 0.08, zf + 0.06, w + 0.2, 0.16, 0.14, '#8a5a2c');
        f.block(x + side * (w / 2), y - h / 2, zf + 0.06, 0.16, h, 0.14, '#8a5a2c');
      }
      for (let i = 0; i < 4; i++) {
        const ry = y - h / 2 + ((i + 0.6) * h) / 4.4;
        f.block(x, ry - 0.02, zf + 0.08, w, 0.04, 0.04, '#d9c9a0');
        const beads = 2 + ((i * 3) % 4);
        for (let k = 0; k < beads; k++) {
          const bx = x - w / 2 + 0.22 + k * 0.26 + (i % 2 ? w * 0.25 : 0);
          geo(f, new THREE.SphereGeometry(0.12, 8, 6).scale(1.15, 0.85, 0.85), bx, ry, zf + 0.12, i % 2 ? GOLD : '#d8442f');
        }
      }
      break;
    }
    case 'key': {
      // A big house key: round bow, shaft, teeth
      const s = r * 0.55;
      ring(f, x - s * 0.7, y + s * 0.15, zf, s * 0.42, s * 0.12, GOLD);
      bar(f, x + s * 0.35, y + s * 0.15, zf, s * 1.6, s * 0.2, 0.1, GOLD);
      f.block(x + s * 0.85, y + s * 0.15 - s * 0.45, zf + 0.05, s * 0.14, s * 0.4, 0.1, GOLD);
      f.block(x + s * 1.08, y + s * 0.15 - s * 0.38, zf + 0.05, s * 0.14, s * 0.32, 0.1, GOLD);
      break;
    }
    case 'globe': {
      // World news: a blue globe with gold meridian and equator rings
      geo(f, sphere(r * 0.62, 16, 12), x, y, zf + 0.1, '#2f6bdb');
      geo(f, new THREE.TorusGeometry(r * 0.66, 0.05, 5, 28), x, y, zf + 0.1, GOLD, Math.PI / 2);
      geo(f, new THREE.TorusGeometry(r * 0.66, 0.05, 5, 28), x, y, zf + 0.1, GOLD, 0, Math.PI / 2);
      geo(f, new THREE.TorusGeometry(r * 0.66, 0.05, 5, 28), x, y, zf + 0.1, GOLD, 0, Math.PI / 4);
      for (const [dx, dy, s] of [[-0.2, 0.18, 0.28], [0.22, -0.12, 0.22], [0.05, 0.32, 0.16]] as const)
        geo(f, new THREE.SphereGeometry(r * s, 6, 5).scale(1.3, 0.8, 0.5), x + dx * r, y + dy * r, zf + 0.1 + r * 0.5, '#3fae4f');
      break;
    }
    case 'umbrella': {
      // Cover: a blue umbrella canopy with a hooked handle
      const R = r * 0.7;
      const cy = y + r * 0.05;
      for (let i = 0; i < 9; i++) {
        const yy = (i + 0.5) * (R / 9);
        const half = Math.sqrt(R * R - yy * yy);
        f.block(x, cy + yy - R / 18, zf + 0.06, half * 2, R / 9 + 0.01, 0.12, i % 3 === 2 ? shade(fg, 0.85) : fg);
      }
      for (let k = -2; k <= 2; k++) geo(f, new THREE.SphereGeometry(R * 0.2, 8, 6).scale(1, 0.55, 0.5), x + (k * R) / 2.5, cy - 0.02, zf + 0.12, fg);
      f.block(x, cy - R * 0.85, zf + 0.08, 0.1, R * 0.85, 0.08, '#4a4f57');
      ring(f, x - 0.17, cy - R * 0.85, zf + 0.04, 0.17, 0.05, '#4a4f57');
      break;
    }
    case 'seal': {
      // Official seal: inner disc, a ring of small stars and one large star
      plaque(f, x, y, zf, r * 0.68, 0.06, shade(bg, 1.35));
      ring(f, x, y, zf + 0.05, r * 0.68, 0.05, fg);
      const star = (sx: number, sy: number, s: number) => {
        for (let k = 0; k < 5; k++) bar(f, sx, sy, zf + 0.06, s, s * 0.22, 0.08, fg, (k * Math.PI) / 5 + Math.PI / 2);
      };
      star(x, y, r * 0.75);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        geo(f, sphere(0.07, 5, 4), x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82, zf + 0.04, fg);
      }
      break;
    }
    case 'scales': {
      // Balance scales: post, beam and two pans hanging level
      const s = r * 0.62;
      f.block(x, y - s * 1.05, zf + 0.06, 0.14, s * 1.6, 0.12, fg);
      f.block(x, y - s * 1.12, zf + 0.06, s * 0.8, 0.14, 0.12, fg);
      bar(f, x, y + s * 0.55, zf + 0.04, s * 1.9, 0.12, 0.12, fg);
      geo(f, sphere(0.13, 8, 6), x, y + s * 0.6, zf + 0.12, fg);
      for (const side of [-1, 1]) {
        const px = x + side * s * 0.85;
        for (const k of [-1, 1]) bar(f, px + k * s * 0.17, y + s * 0.18, zf + 0.04, s * 0.78, 0.04, 0.04, fg, Math.PI / 2 + k * 0.32);
        geo(f, new THREE.SphereGeometry(s * 0.32, 10, 5, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), px, y - s * 0.15, zf + 0.1, fg);
      }
      break;
    }
    case 'safe': {
      // Emergency fund: a steel safe door with a dial and a three-spoke handle
      const s = r * 0.62;
      f.block(x, y - s, zf + 0.04, s * 2, s * 2, 0.14, '#7d838d');
      f.block(x, y - s * 0.86, zf + 0.12, s * 1.72, s * 1.72, 0.06, STEEL);
      for (const dy of [0.55, -0.55]) f.block(x - s - 0.06, y + dy * s - 0.15, zf + 0.06, 0.14, 0.3, 0.16, '#4a4f57');
      plaque(f, x + s * 0.3, y + s * 0.1, zf + 0.16, s * 0.42, 0.1, '#4a4f57');
      plaque(f, x + s * 0.3, y + s * 0.1, zf + 0.24, s * 0.12, 0.08, GOLD);
      for (let k = 0; k < 3; k++) bar(f, x + s * 0.3, y + s * 0.1, zf + 0.26, s * 0.9, 0.07, 0.06, '#e9e4d8', (k * Math.PI) / 3);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        f.block(x + s * 0.3 + Math.cos(a) * s * 0.5, y + s * 0.1 + Math.sin(a) * s * 0.5 - 0.03, zf + 0.2, 0.06, 0.06, 0.04, '#e9e4d8');
      }
      break;
    }
    case 'heart': {
      // Giving: a heart made from two rounded lobes and a turned square
      const s = r * 0.42;
      for (const side of [-1, 1]) geo(f, new THREE.SphereGeometry(s * 0.62, 12, 8).scale(1, 1, 0.35), x + side * s * 0.5, y + s * 0.28, zf + 0.1, fg);
      geo(f, new THREE.BoxGeometry(s * 1.2, s * 1.2, 0.36 * s * 0.62 * 2), x, y - s * 0.22, zf + 0.1, fg, 0, 0, Math.PI / 4);
      geo(f, sphere(0.12, 6, 5), x - s * 0.55, y + s * 0.45, zf + 0.25, '#ffd0d6');
      break;
    }
  }
}

/* ───────── Display windows: a lit, shallow shop window with the building's work inside ───────── */

function vitrine(f: Frame, x: number, w: number, z: number, frame: string, kind: DisplayKind, rng: Rng) {
  const y0 = 0.7;
  const H = 2.5;
  const dep = 0.75;
  // Warm lit back wall (glows at night), floor, frame and glazing bars
  f.block(x, y0, z + 0.05, w, H, 0.1, WARM, 'lit');
  f.block(x, y0 - 0.3, z + dep / 2, w + 0.44, 0.3, dep + 0.12, frame);
  f.block(x, y0 + H, z + dep / 2, w + 0.44, 0.3, dep + 0.12, frame);
  for (const side of [-1, 1]) f.block(x + side * (w / 2 + 0.11), y0, z + dep / 2, 0.22, H, dep, frame);
  f.block(x, y0 + H * 0.8, z + dep - 0.03, w, 0.06, 0.05, frame);
  if (w > 3.2) f.block(x, y0, z + dep - 0.03, 0.07, H * 0.8, 0.05, frame);
  f.block(x, y0, z + dep / 2, w, 0.04, dep, '#6b5a48');
  f.lamp(x, y0 + H - 0.3, z + dep * 0.6);

  const zb = z + 0.12; // just in front of the back wall
  const card = (cx: number, cy: number, cw: number, ch: number, head: string) => {
    f.block(cx, cy, zb, cw, ch, 0.04, PAPER);
    f.block(cx, cy + ch * 0.78, zb + 0.02, cw * 0.9, ch * 0.14, 0.03, head);
  };
  switch (kind) {
    case 'desks': {
      const n = Math.max(1, Math.floor(w / 1.5));
      for (let i = 0; i < n; i++) {
        const dx = x - w / 2 + (w / n) * (i + 0.5);
        f.block(dx, y0 + 0.72, z + 0.42, 1.1, 0.07, 0.48, '#8a6a48');
        for (const s of [-1, 1]) f.block(dx + s * 0.48, y0, z + 0.42, 0.07, 0.72, 0.42, '#5a4a3a');
        f.block(dx, y0 + 0.79, z + 0.3, 0.07, 0.18, 0.07, '#2a2d31');
        f.block(dx, y0 + 0.95, z + 0.3, 0.62, 0.4, 0.06, '#2a2d31');
        f.block(dx, y0 + 0.99, z + 0.34, 0.54, 0.32, 0.02, rng.chance(0.5) ? '#7fd0ff' : '#9cf0b0', 'lit');
        f.block(dx + 0.25, y0, z + 0.66, 0.42, 0.5, 0.12, '#3a3f4a');
      }
      card(x - w / 2 + 0.6, y0 + 1.5, 0.7, 0.8, '#d8442f');
      break;
    }
    case 'listings': {
      // Property cards on wires: each with a little house picture and a price bar
      const cols = Math.max(1, Math.floor((w - 0.2) / 0.85));
      for (let row = 0; row < 2; row++)
        for (let c = 0; c < cols; c++) {
          const cx = x - ((cols - 1) * 0.85) / 2 + c * 0.85;
          const cy = y0 + 0.45 + row * 1.0;
          f.block(cx, cy, zb, 0.7, 0.8, 0.04, PAPER);
          f.block(cx, cy + 0.32, zb + 0.02, 0.6, 0.42, 0.03, '#a9d4ef');
          const house = rng.pick(['#e8a87c', '#c9d8a8', '#f2cf9a', '#b8c6d9']);
          f.block(cx, cy + 0.33, zb + 0.04, 0.3, 0.2, 0.03, house);
          f.block(cx, cy + 0.53, zb + 0.04, 0.36, 0.08, 0.03, '#c0512f');
          f.block(cx, cy + 0.1, zb + 0.02, 0.5, 0.08, 0.03, rng.chance(0.3) ? '#d8442f' : '#2f7a4a');
          f.block(cx, cy + 0.8, zb + 0.01, 0.02, 0.2, 0.02, '#4a4f57');
        }
      break;
    }
    case 'ledgers': {
      // Shelves of ledgers and binders
      for (let s = 0; s < 3; s++) {
        const sy = y0 + 0.2 + s * 0.72;
        f.block(x, sy, z + 0.3, w - 0.2, 0.06, 0.45, '#8a6a48');
        let bx = x - w / 2 + 0.25;
        while (bx < x + w / 2 - 0.3) {
          const bw = rng.range(0.1, 0.2);
          const bh = rng.range(0.4, 0.58);
          f.block(bx + bw / 2, sy + 0.06, z + 0.3, bw, bh, 0.36, rng.pick(['#7a1f1f', '#1e3a5a', '#2f6a3f', '#8a6a2a', '#4a2f5a', '#d8cfb8']));
          bx += bw + 0.02;
        }
      }
      break;
    }
    case 'forms': {
      // Filing cabinets and a table piled with forms
      for (const s of [-1, 1]) {
        const cx = x + s * (w / 2 - 0.5);
        f.block(cx, y0, z + 0.36, 0.7, 1.4, 0.55, '#8d949e');
        for (let k = 0; k < 3; k++) f.block(cx, y0 + 0.2 + k * 0.44, z + 0.64, 0.5, 0.05, 0.03, '#5a6068');
      }
      f.block(x, y0 + 0.75, z + 0.42, Math.max(0.8, w - 2.2), 0.07, 0.5, '#8a6a48');
      f.block(x, y0, z + 0.42, Math.max(0.6, w - 2.4), 0.75, 0.4, '#6b5440');
      for (let k = -1; k <= 1; k++) {
        const hgt = rng.range(0.15, 0.45);
        f.block(x + k * 0.45, y0 + 0.82, z + 0.42, 0.34, hgt, 0.26, PAPER);
        f.block(x + k * 0.45, y0 + 0.82 + hgt * 0.5, z + 0.56, 0.36, 0.03, 0.02, '#c7c0ae');
      }
      card(x, y0 + 1.45, 0.8, 0.85, '#1e3a5a');
      break;
    }
    case 'news': {
      // Front pages pinned up, and bundled stacks of today's paper
      const n = Math.max(1, Math.floor(w / 0.9));
      for (let i = 0; i < n; i++) {
        const cx = x - ((n - 1) * 0.9) / 2 + i * 0.9;
        f.block(cx, y0 + 1.1, zb, 0.72, 0.95, 0.04, PAPER);
        f.block(cx, y0 + 1.82, zb + 0.02, 0.64, 0.14, 0.03, '#1a1a1a');
        f.block(cx - 0.12, y0 + 1.35, zb + 0.02, 0.34, 0.34, 0.03, rng.pick(['#8fb8dc', '#c9a87c', '#9cc93f']));
        for (let l = 0; l < 3; l++) f.block(cx + 0.18, y0 + 1.25 + l * 0.14, zb + 0.02, 0.22, 0.04, 0.03, '#7a7a7a');
      }
      for (let i = 0; i < 3; i++) {
        const sx = x - w / 3 + (i * w) / 3;
        const hgt = rng.range(0.4, 0.8);
        f.block(sx, y0, z + 0.45, 0.6, hgt, 0.42, '#e6e2d6');
        f.block(sx, y0 + hgt * 0.5, z + 0.45, 0.62, 0.05, 0.44, '#c0512f');
      }
      break;
    }
    case 'jars': {
      // Savings and donation jars with coins, on a long shelf
      f.block(x, y0 + 0.8, z + 0.38, w - 0.2, 0.07, 0.5, '#8a6a48');
      const n = Math.max(2, Math.floor(w / 0.6));
      for (let i = 0; i < n; i++) {
        const jx = x - w / 2 + 0.35 + (i * (w - 0.7)) / (n - 1);
        const fill = rng.range(0.2, 0.75);
        geo(f, cylinder(0.2, 0.2, 0.55, 10), jx, y0 + 1.15, z + 0.38, '#cfe6ee');
        geo(f, cylinder(0.19, 0.19, 0.55 * fill, 10), jx, y0 + 0.88 + 0.275 * fill, z + 0.38, GOLD);
        f.block(jx, y0 + 1.42, z + 0.38, 0.3, 0.06, 0.3, '#c0512f');
      }
      card(x, y0 + 1.6, 0.9, 0.7, '#3fae4f');
      break;
    }
    case 'safes': {
      for (const s of [-1, 1]) {
        const cx = x + s * (w / 4);
        f.block(cx, y0, z + 0.4, 0.9, 1.0, 0.6, '#5a6068');
        geo(f, cylinder(0.18, 0.18, 0.06, 12), cx + 0.1, y0 + 0.55, z + 0.72, STEEL, Math.PI / 2);
        f.block(cx - 0.3, y0 + 0.4, z + 0.71, 0.05, 0.3, 0.04, '#c0c4cc');
      }
      card(x, y0 + 1.3, 1.0, 0.9, '#c8322c');
      break;
    }
    case 'charts': {
      // Posters: a bar chart and a pie chart
      const cw = Math.min(1.1, w / 2 - 0.2);
      card(x - cw / 2 - 0.1, y0 + 0.6, cw, 1.3, '#1e3a5a');
      const bx = x - cw / 2 - 0.1;
      for (let i = 0; i < 4; i++) f.block(bx - cw * 0.3 + i * cw * 0.2, y0 + 0.75, zb + 0.02, cw * 0.13, 0.2 + i * 0.18, 0.03, ['#d8442f', '#f2cf3a', '#9cc93f', '#3fae4f'][i]);
      const px = x + cw / 2 + 0.1;
      card(px, y0 + 0.6, cw, 1.3, '#2f7a4a');
      geo(f, cylinder(cw * 0.32, cw * 0.32, 0.03, 16), px, y0 + 1.1, zb + 0.04, '#2f6bdb', Math.PI / 2);
      geo(f, new THREE.CylinderGeometry(cw * 0.33, cw * 0.33, 0.035, 12, 1, false, 0, Math.PI / 2), px, y0 + 1.1, zb + 0.05, '#f2cf3a', Math.PI / 2);
      break;
    }
    case 'notices': {
      // Cork board of community notices
      f.block(x, y0 + 0.4, zb, w - 0.3, 1.7, 0.05, '#b08a5a');
      for (let i = 0; i < Math.floor(w * 2); i++) {
        const nx = x - (w - 0.8) / 2 + rng.next() * (w - 0.8);
        const ny = y0 + 0.55 + rng.next() * 1.2;
        f.block(nx, ny, zb + 0.03, 0.34, 0.42, 0.02, rng.pick([PAPER, '#fff1a8', '#cfe6ee', '#f6c9cf']));
        f.block(nx, ny + 0.36, zb + 0.05, 0.05, 0.05, 0.02, '#d8442f');
      }
      break;
    }
  }
}

/* ───────── Ground floors and upper floors for the office template ───────── */

function groundFloor(f: Frame, s: BuildingSpec, kind: NonNullable<MissionLook['ground']>) {
  const { w, d, trim, wall } = s;
  const z = d / 2;
  const band = trim === '#ffffff' ? '#e9e4d8' : trim;
  if (kind === 'shopfront') {
    // Stone plinth, a fascia band over the windows and slim pilasters at the ends
    f.tb(0, 0.3, z + 0.08, w + 0.1, 0.4, 0.16, '#b9b2a2', 'stone', 'stone');
    f.block(0, 3.7, z + 0.12, w + 0.2, 0.45, 0.24, band);
    for (const side of [-1, 1]) f.block(side * (w / 2 - 0.25), 0.3, z + 0.1, 0.5, 3.4, 0.2, band);
  } else if (kind === 'rusticated') {
    // Heavy banded stone up to the first floor
    for (let y = 0.3; y < 3.9; y += 0.6) f.tb(0, y, z + 0.1, w + 0.2, 0.48, 0.2, shade('#c9c1ae', y % 1.2 < 0.6 ? 1 : 0.94), 'stone', 'stone');
    f.block(0, 3.95, z + 0.18, w + 0.4, 0.35, 0.36, band);
  } else {
    // A covered arcade (a "five-foot way"): piers carrying a deep lintel, so the shop windows sit in shade
    const depth = 2.2;
    f.block(0, 3.6, z + depth / 2, w, 0.55, depth, shade(wall, 0.92), 'solid', 0, 1.04);
    f.block(0, 3.55, z + depth - 0.1, w + 0.1, 0.2, 0.22, band);
    const n = Math.max(3, Math.round(w / 3.2));
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + 0.35 + (i * (w - 0.7)) / n;
      if (Math.abs(x) < 2.4) continue;
      f.tb(x, 0.3, z + depth - 0.35, 0.6, 3.3, 0.6, shade(wall, 0.97), 'stucco', 'stucco');
      f.block(x, 3.35, z + depth - 0.35, 0.8, 0.25, 0.8, band);
      f.collider(x, z + depth - 0.35, 0.6, 0.6, 0, 3.6);
    }
    f.tb(0, 0.3, z + depth / 2, w, 0.06, depth, '#cfc8b8', 'stone', 'tile-floor');
  }
}

function upperFloors(f: Frame, s: BuildingSpec, kind: NonNullable<MissionLook['upper']>, clear: number) {
  const { w, d, h, trim, wall } = s;
  const z = d / 2;
  const accent = trim === '#ffffff' ? shade(wall, 0.82) : trim;
  const y0 = 4.3;
  if (kind === 'pilasters') {
    const n = Math.max(2, Math.round(w / 3.4));
    for (let i = 0; i <= n; i++) {
      const x = -w / 2 + 0.3 + (i * (w - 0.6)) / n;
      if (Math.abs(x) < clear) continue;
      f.block(x, y0, z + 0.1, 0.55, h - y0 - 0.6, 0.2, accent);
    }
    // Cornice with a row of dentils under it
    f.block(0, h - 0.6, z + 0.35, w + 0.6, 0.5, 0.7, accent, 'solid', 0, 1.05);
    for (let x = -w / 2 + 0.3; x < w / 2; x += 0.55) f.block(x, h - 0.82, z + 0.18, 0.25, 0.22, 0.25, accent);
  } else if (kind === 'fins') {
    for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 1.3) {
      if (Math.abs(x) < clear) continue;
      f.block(x, y0, z + 0.28, 0.14, h - y0, 0.56, accent);
    }
    f.block(0, h - 0.25, z + 0.3, w + 0.2, 0.35, 0.6, accent);
  } else if (kind === 'bays') {
    for (const bx of [-w / 3, w / 3]) {
      f.tb(bx, y0, z + 0.45, 3.0, h - y0 - 1.0, 0.9, shade(wall, 0.96), 'fac-painted', 'concrete');
      f.block(bx, h - 1.05, z + 0.5, 3.4, 0.3, 1.1, accent);
      f.block(bx, y0 - 0.15, z + 0.5, 3.3, 0.18, 1.0, accent);
    }
  } else {
    // Balconies with railings on each upper floor, starting clear of the sign
    for (let y = Math.max(y0, Math.min(5.2, h - 1) + 1.0); y < h - 1.9; y += 3.2)
      for (const bx of [-w / 3, w / 3]) {
        f.block(bx, y, z + 0.5, 3.0, 0.15, 1.0, '#d9d4c8');
        f.block(bx, y + 0.95, z + 0.97, 3.0, 0.07, 0.07, '#3a3f45');
        for (let k = -6; k <= 6; k++) f.block(bx + k * 0.24, y + 0.15, z + 0.97, 0.04, 0.8, 0.04, '#3a3f45');
        for (const side of [-1, 1]) f.block(bx + side * 1.47, y + 0.15, z + 0.5, 0.04, 0.85, 0.95, '#3a3f45');
      }
  }
}

/* ───────── Civic rooftops ───────── */

/** The tower or lantern rising behind a civic hall's pitched roof, at local (0, zc). */
export function civicTop(f: Frame, kind: CivicTop, s: BuildingSpec, zc: number, pitched: (f: Frame, w: number, d: number, y0: number, c: string, steps?: number, overhang?: number) => void) {
  const { h, wall, roof } = s;
  switch (kind) {
    case 'clock': {
      f.block(0, h + 3, zc, 4, 6, 4, wall);
      f.block(0, h + 9, zc, 4.6, 0.6, 4.6, roof);
      pitched(new Frame(...f.world(0, zc), f.rot, f.b), 3.6, 3.6, h + 9.6, roof, 4, 0.2);
      geo(f, cylinder(1.3, 1.3, 0.2, 16), 0, h + 6.5, zc + 2.05, '#fffaf0', Math.PI / 2);
      f.block(0, h + 6.2, zc + 2.2, 0.12, 1.1, 0.06, NAVY);
      f.block(0.3, h + 6.45, zc + 2.2, 0.7, 0.12, 0.06, NAVY);
      break;
    }
    case 'dome': {
      // Drum ringed with columns, a copper-green dome and a lantern
      geo(f, cylinder(3.4, 3.4, 4, 20), 0, h + 4, zc, wall, 0, 0, 0, 1, 'solid', 'fac-stone');
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2;
        geo(f, cylinder(0.2, 0.2, 3.6, 6), Math.cos(a) * 3.55, h + 4, zc + Math.sin(a) * 3.55, '#f7f3ea');
      }
      geo(f, cylinder(3.8, 3.8, 0.4, 20), 0, h + 6.2, zc, '#f7f3ea');
      geo(f, new THREE.SphereGeometry(3.5, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0, h + 6.4, zc, '#5f9a86', 0, 0, 0, 1, 'solid', 'metal');
      geo(f, cylinder(0.7, 0.7, 1.6, 8), 0, h + 10.6, zc, '#f7f3ea');
      geo(f, new THREE.ConeGeometry(0.85, 1.2, 8), 0, h + 12, zc, '#5f9a86');
      geo(f, sphere(0.22, 6, 5), 0, h + 12.75, zc, GOLD);
      f.lamp(0, h + 10.6, zc);
      break;
    }
    case 'cupola': {
      f.block(0, h + 3, zc, 3.4, 1.6, 3.4, wall);
      for (const [px, pz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) f.block(px, h + 4.6, zc + pz, 0.35, 2.2, 0.35, '#f7f3ea');
      f.block(0, h + 4.6, zc, 2.2, 1.8, 2.2, '#ffd98a', 'lit');
      f.block(0, h + 6.8, zc, 3.8, 0.4, 3.8, '#f7f3ea');
      geo(f, new THREE.ConeGeometry(2.6, 2.4, 4), 0, h + 8.4, zc, roof, 0, Math.PI / 4, 0, 1, 'solid', 'slate');
      f.block(0, h + 9.6, zc, 0.12, 1.6, 0.12, GOLD);
      geo(f, sphere(0.25, 6, 5), 0, h + 11.2, zc, GOLD);
      break;
    }
    case 'beacon': {
      // A short signal tower with a red beacon: the "in case of emergency" hall
      f.tb(0, h + 2, zc, 3.2, 4.4, 3.2, wall, 'fac-stone', 'concrete');
      for (let y = h + 2.6; y < h + 6.2; y += 1.2) f.block(0, y, zc, 3.3, 0.5, 3.3, '#c8322c');
      f.block(0, h + 6.4, zc, 3.6, 0.3, 3.6, '#e9e4d8');
      geo(f, cylinder(0.7, 0.7, 1.1, 12), 0, h + 7.25, zc, '#ff4a3a', 0, 0, 0, 1, 'neon');
      geo(f, cylinder(0.9, 0.9, 0.2, 12), 0, h + 7.9, zc, '#4a4f57');
      f.lamp(0, h + 7.3, zc);
      break;
    }
    case 'lantern': {
      // A glass roof lantern over the giving hall's atrium
      f.block(0, h + 2.6, zc, 6, 0.4, 5, '#e9e4d8');
      geo(f, new THREE.ConeGeometry(3.6, 3.2, 4), 0, h + 4.6, zc, '#bfe0f0', 0, Math.PI / 4, 0, 1, 'lit');
      for (const a of [0, Math.PI / 2]) geo(f, new THREE.BoxGeometry(0.12, 0.12, 7.2), 0, h + 3.05, zc, '#e9e4d8', 0, a);
      geo(f, sphere(0.25, 6, 5), 0, h + 6.3, zc, GOLD);
      break;
    }
  }
}

/* ───────── Small street-front extras ───────── */

function extras(f: Frame, s: BuildingSpec, kind: NonNullable<MissionLook['extra']>) {
  const { w, d } = s;
  const z = d / 2;
  switch (kind) {
    case 'vault': {
      // The bank's door sits in a round vault frame, with the great steel door swung open beside it
      const y = 2.05;
      geo(f, new THREE.TorusGeometry(2.15, 0.32, 8, 32), 0, y, z + 0.45, '#8d949e', 0, 0, 0, 1, 'solid', 'metal');
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2;
        if (Math.sin(a) < -0.8) continue;
        geo(f, sphere(0.11, 5, 4), Math.cos(a) * 2.15, y + Math.sin(a) * 2.15, z + 0.78, '#c0c4cc');
      }
      // The great door swung about 150 degrees open, resting beside the opening with its bolt wheel to the street.
      // Its face makes an angle `t` with the wall; the hinge is on the frame's right edge.
      const R = 1.75;
      const t = 0.45;
      const hx = 2.45;
      const hz = z + 0.6;
      const dx = hx + R * Math.cos(t);
      const dz = hz + R * Math.sin(t);
      const nx = -Math.sin(t);
      const nz = Math.cos(t);
      geo(f, cylinder(R, R, 0.5, 28), dx, y, dz, '#a3a9b2', Math.PI / 2, -t, 0, 1, 'solid', 'metal');
      geo(f, cylinder(R * 0.82, R * 0.82, 0.1, 28), dx + nx * 0.28, y, dz + nz * 0.28, '#8d949e', Math.PI / 2, -t);
      geo(f, cylinder(0.32, 0.32, 0.3, 12), dx + nx * 0.4, y, dz + nz * 0.4, '#6b7079', Math.PI / 2, -t);
      for (let k = 0; k < 3; k++) geo(f, new THREE.BoxGeometry(1.5, 0.1, 0.1), dx + nx * 0.5, y, dz + nz * 0.5, '#d9dde3', 0, -t, (k * Math.PI) / 3);
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2;
        const lx = Math.cos(a) * R * 0.9;
        geo(f, sphere(0.08, 5, 4), dx + lx * Math.cos(t), y + Math.sin(a) * R * 0.9, dz + lx * Math.sin(t) + nz * 0.27, '#d9dde3');
      }
      f.collider(dx, dz, 2.4, 1.0, 0, 4);
      break;
    }
    case 'dropbox': {
      // A blue drop box for tax forms by the steps
      const x = w * 0.35 + 0.8;
      f.block(x, 0, z + 3.4, 0.9, 1.1, 0.8, '#2a4f9a');
      geo(f, new THREE.CylinderGeometry(0.45, 0.45, 0.9, 12, 1, false, 0, Math.PI), x, 1.1, z + 3.4, '#2a4f9a', 0, Math.PI / 2, Math.PI / 2);
      f.block(x, 0.95, z + 3.82, 0.5, 0.06, 0.04, '#1a1a1a');
      f.block(x, 0.4, z + 3.81, 0.6, 0.35, 0.03, PAPER);
      f.collider(x, z + 3.4, 1, 0.9, 0, 1.6);
      break;
    }
    case 'donations': {
      // A glass donation box on a stand, half full of coins
      const x = -(w * 0.35 + 0.8);
      f.block(x, 0, z + 3.4, 0.5, 0.9, 0.5, '#8a6a48');
      f.block(x, 0.9, z + 3.4, 0.8, 0.8, 0.8, '#cfe6ee', 'lit');
      f.block(x, 0.92, z + 3.4, 0.72, 0.35, 0.72, GOLD);
      f.block(x, 1.7, z + 3.4, 0.86, 0.08, 0.86, '#c0512f');
      f.collider(x, z + 3.4, 0.9, 0.9, 0, 1.8);
      break;
    }
    case 'noticeboard': {
      const x = -(w * 0.35 + 1);
      for (const s2 of [-0.9, 0.9]) f.block(x + s2, 0, z + 3.4, 0.14, 2.2, 0.14, '#5a4a3a');
      f.block(x, 1.0, z + 3.4, 2.2, 1.2, 0.12, '#b08a5a');
      f.block(x, 2.2, z + 3.4, 2.5, 0.12, 0.5, '#3a4a5a');
      for (let i = 0; i < 5; i++) f.block(x - 0.8 + i * 0.4, 1.2 + (i % 2) * 0.45, z + 3.47, 0.3, 0.38, 0.02, i % 2 ? '#fff1a8' : PAPER);
      f.collider(x, z + 3.4, 2.2, 0.4, 0, 2.3);
      break;
    }
  }
}

/** Dress an enterable building with its mission identity. Runs after the template and city dressing. */
export function dressMission(f: Frame, s: BuildingSpec, look: MissionLook, rng: Rng) {
  const { w, d, h, trim } = s;
  const z = d / 2;
  const frameCol = trim === '#ffffff' ? '#3a3f45' : trim;
  const civic = s.style === 'civic';
  const signTop = Math.min(5.2, h - 1) + 0.6;
  // Office emblems fill the wall between the sign and the cornice
  const r = civic ? Math.min(1.5, w * 0.08) : Math.max(0.8, Math.min(1.5, (h - 0.95 - signTop - 0.25) / 2));
  if (look.ground) groundFloor(f, s, look.ground);
  if (look.upper) upperFloors(f, s, look.upper, look.emblem ? r + 0.5 : 0);

  // Display windows either side of the door
  if (look.displays) {
    const inner = 2.7;
    const outer = civic ? Math.min(w / 2 - 0.9, w * 0.35 - 0.3) : w / 2 - 0.9;
    const vw = outer - inner;
    if (vw > 1.2) {
      vitrine(f, -(inner + vw / 2), vw, z, frameCol, look.displays[0], rng);
      vitrine(f, inner + vw / 2, vw, z, frameCol, look.displays[1], rng);
    }
  }

  // Emblem: above the sign on an office front; standing on the portico of a civic hall
  if (look.emblem) {
    if (civic) emblem(f, look.emblem, 0, h - 0.4 + r + 0.15, z + 1.45, r, look.emblemBg, look.emblemFg);
    else {
      const y = Math.max(signTop + 0.25 + r, Math.min(h - 0.95 - r, signTop + 0.6 + r));
      emblem(f, look.emblem, 0, y, z + (look.upper === 'fins' ? 0.04 : 0.1), r, look.emblemBg, look.emblemFg);
      f.lamp(0, y + r + 0.3, z + 0.6);
    }
  }

  if (look.roof === 'mast') {
    // Broadcast mast and satellite dishes on the newsroom roof
    f.block(w / 4, h + 0.6, -d / 4, 0.3, 9, 0.3, '#c0c4cc');
    for (let y = h + 2; y < h + 9; y += 1.6) f.block(w / 4, y, -d / 4, 1.2 - (y - h) * 0.08, 0.08, 0.08, '#c0c4cc');
    f.block(w / 4, h + 9.6, -d / 4, 0.35, 0.35, 0.35, '#ff5a4a', 'neon');
    for (const [dx, dz, a] of [[-w / 4, -d / 4, 0.5], [-w / 4 + 2.6, -d / 4 + 1.2, -0.4]] as const) {
      f.block(dx, h + 0.6, dz, 0.2, 1.0, 0.2, '#8d949e');
      geo(f, new THREE.SphereGeometry(1, 12, 6, 0, Math.PI * 2, 0, Math.PI / 3), dx, h + 1.7, dz, '#e9e4d8', -1.1, a);
    }
  }
  if (look.extra) extras(f, s, look.extra);
}
