/**
 * City-specific architecture. Each filler style models a real building type of its city
 * (built in a local frame where the street-facing facade is +Z), so every city reads
 * differently: New York brownstones and fire escapes, London Georgian terraces,
 * San Francisco painted ladies, Hong Kong residential towers, Singapore shophouses and HDB blocks.
 */
import * as THREE from 'three';
import { cylinder, sphere } from '@/engine/voxel';
import type { Rng } from '@/game/rng';
import { Frame, shade, type Builders } from './buildings';

type Pal = { walls: string[]; roofs: string[]; trims: string[]; accents: string[] };
type StyleFn = (f: Frame, b: Builders, w: number, d: number, h: number, rng: Rng, pal: Pal) => { roof: string } | void;

const IRON = '#1f2224';
const pick = <T,>(rng: Rng, xs: T[]) => xs[Math.floor(rng.next() * xs.length)];

/** Split a frontage into terrace units of roughly `unit` meters. */
export function units(w: number, unit: number) {
  const n = Math.max(1, Math.round(w / unit));
  const uw = w / n;
  return Array.from({ length: n }, (_, i) => ({ x: -w / 2 + uw * (i + 0.5), w: uw }));
}

export function door(f: Frame, x: number, z: number, w: number, h: number, color: string, y0 = 0) {
  f.block(x, y0, z + 0.02, w + 0.3, h + 0.25, 0.12, '#efe9dc');
  f.block(x, y0, z + 0.08, w, h, 0.1, color);
  f.block(x, y0 + h * 0.62, z + 0.14, w * 0.5, h * 0.22, 0.02, '#2b3440', 'dark');
}

export function railing(f: Frame, x: number, z: number, len: number, h = 1.0, alongX = true) {
  f.block(x, h - 0.06, z, alongX ? len : 0.06, 0.06, alongX ? 0.06 : len, IRON);
  for (let t = -len / 2; t <= len / 2; t += 0.18) f.block(alongX ? x + t : x, 0, alongX ? z : z + t, 0.03, h, 0.03, IRON);
}

export function chimney(f: Frame, x: number, y: number, z: number, n = 3, brick = '#8a5a44') {
  f.tb(x, y, z, 0.5 + n * 0.32, 1.4, 0.6, brick, 'brick', 'concrete');
  for (let k = 0; k < n; k++) f.geom(cylinder(0.11, 0.13, 0.5, 6), x - (n - 1) * 0.16 + k * 0.32, y + 1.65, z, '#b8673f');
}

export function waterTower(f: Frame, x: number, y: number, z: number) {
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) f.block(x + lx, y, z + lz, 0.18, 2.4, 0.18, '#3a3f45');
  f.block(x, y + 2.3, z, 2.6, 0.12, 2.6, '#3a3f45');
  f.geom(cylinder(1.25, 1.35, 3.0, 12), x, y + 3.9, z, '#7a5a3e', 0, 0, 0, 1, 'solid', 'wood');
  for (const yy of [y + 2.9, y + 3.9, y + 4.9]) f.geom(cylinder(1.37, 1.37, 0.08, 12), x, yy, z, '#2a2c2f');
  f.geom(new THREE.ConeGeometry(1.45, 1.1, 12), x, y + 5.95, z, '#5a4a3a', 0, 0, 0, 1, 'solid', 'roof-tiles');
}

export function acUnits(f: Frame, w: number, d: number, top: number, rng: Rng) {
  for (let k = 0; k < rng.int(1, 3); k++) {
    const x = rng.range(-w / 2 + 1.5, w / 2 - 1.5);
    const z = rng.range(-d / 2 + 1.5, d / 2 - 1.5);
    f.tb(x, top, z, 1.6, 1.0, 1.2, '#b9bec9', 'metal', 'metal');
  }
}

/* ───────── New York ───────── */

const brownstone: StyleFn = (f, b, w, d, h, rng) => {
  const stone = ['#6e4532', '#7a4a36', '#5e3b2c', '#84553f', '#6a4a3a'];
  for (const u of units(w, 6)) {
    const c = pick(rng, stone);
    const uh = h + rng.range(-0.8, 0.8);
    f.tb(u.x, 0, 0, u.w - 0.04, uh, d, c, 'fac-brownstone', 'roof-gravel');
    // Bracketed cornice
    f.tb(u.x, uh - 0.7, 0.15, u.w, 0.7, d + 0.3, shade(c, 0.6), 'stone', 'roof-gravel');
    for (let k = -u.w / 2 + 0.4; k < u.w / 2; k += 0.8) f.block(u.x + k, uh - 1.1, d / 2 + 0.2, 0.18, 0.4, 0.3, shade(c, 0.6));
    // Stoop up to a parlor-floor door, with iron railings
    const sx = u.x + (rng.chance(0.5) ? -u.w / 4 : u.w / 4);
    for (let s = 0; s < 7; s++) f.tb(sx, 0, d / 2 + 2.6 - s * 0.32, 1.7, 0.24 * (s + 1), 0.36, shade(c, 0.95), 'stone', 'stone');
    for (const side of [-0.9, 0.9]) f.block(sx + side, 0.2, d / 2 + 1.5, 0.05, 2.1, 0.05, IRON);
    door(f, sx, d / 2, 1.2, 2.6, rng.pick(['#2a1a12', '#1f2a1f', '#3a1f1f']), 1.7);
    // Areaway railing at the sidewalk
    railing(f, u.x + (sx > u.x ? -u.w / 4 : u.w / 4), d / 2 + 2.4, u.w / 2 - 0.6, 0.9);
  }
  f.collider(0, 0.6, w, d + 3, 0, h + 2);
  return { roof: '#3a3530' };
};

const prewar: StyleFn = (f, b, w, d, h, rng) => {
  const brick = pick(rng, ['#8a4a36', '#9a5a40', '#7a4232', '#a8684a', '#b07a5a']);
  const base = 7;
  f.tb(0, 0, 0, w, base, d, '#cfc4ad', 'fac-stone', 'stone');
  f.tb(0, base, 0, w, h - base, d, brick, 'fac-brick', 'roof-gravel');
  f.tb(0, base - 0.3, 0, w + 0.3, 0.5, d + 0.3, '#d8cdb4', 'stone', 'stone');
  f.tb(0, h - 0.9, 0, w + 0.6, 0.9, d + 0.6, '#d8cdb4', 'stone', 'roof-gravel');
  // Fire escapes: platforms, rails and zig-zag ladders down the street facade
  for (const fx of w > 14 ? [-w / 4, w / 4] : [0]) {
    for (let y = base + 0.4; y < h - 2; y += 3.4) {
      f.block(fx, y, d / 2 + 0.6, 3.2, 0.08, 1.1, IRON);
      f.block(fx, y + 0.9, d / 2 + 1.13, 3.2, 0.05, 0.05, IRON);
      for (let t = -1.5; t <= 1.5; t += 0.5) f.block(fx + t, y, d / 2 + 1.13, 0.03, 0.9, 0.03, IRON);
      f.geom(new THREE.BoxGeometry(0.5, 0.06, 3.7), fx, y + 1.7, d / 2 + 0.6, IRON, 0, Math.PI / 2, Math.atan2(3.4, 3.0) * ((Math.round(y) % 2) * 2 - 1));
    }
  }
  waterTower(f, rng.range(-w / 4, w / 4), h, rng.range(-d / 4, d / 4));
  acUnits(f, w, d, h, rng);
  // Shopfronts with awnings at street level
  for (const u of units(w, 6)) {
    f.block(u.x, 0.3, d / 2 + 0.05, u.w - 1.2, 3.0, 0.1, '#2b3440', 'dark');
    f.block(u.x, 3.5, d / 2 + 0.8, u.w - 0.8, 0.3, 1.5, pick(rng, ['#2f4a2f', '#5a1f24', '#1f2f4a', '#3a3a3a']));
  }
  f.collider(0, 0, w, d, 0, h + 2);
  return { roof: '#4a4440' };
};

const loft: StyleFn = (f, b, w, d, h, rng) => {
  const c = pick(rng, ['#d8cfbd', '#c9c2b4', '#b8b0a2', '#e2dccd', '#9aa0a8']);
  f.tb(0, 0, 0, w, h, d, c, 'fac-loft', 'roof-gravel');
  f.tb(0, h - 1.0, 0.2, w + 0.5, 1.0, d + 0.5, shade(c, 0.85), 'metal', 'roof-gravel');
  f.block(0, 0.3, d / 2 + 0.06, w - 1, 3.2, 0.1, '#2b3440', 'dark');
  if (rng.chance(0.5)) waterTower(f, 0, h, 0);
  f.collider(0, 0, w, d, 0, h + 2);
  return { roof: '#4a4744' };
};

/* ───────── London ───────── */

const terrace: StyleFn = (f, b, w, d, h, rng) => {
  const brick = pick(rng, ['#b9a77f', '#a8956c', '#c2b38f', '#9e8a62']);
  const doors = ['#1b1c1f', '#6b1f24', '#1f3a5a', '#2f4a32', '#1b1c1f'];
  const gf = 3.8;
  for (const u of units(w, 6.2)) {
    f.tb(u.x, 0, 0, u.w - 0.04, gf, d, '#ece6d8', 'fac-rustic', 'stone');
    f.tb(u.x, gf, 0, u.w - 0.04, h - gf, d, brick, 'fac-georgian', 'roof-gravel');
    // Stucco cornice & parapet
    f.tb(u.x, h - 0.5, 0.1, u.w, 0.5, d + 0.2, '#efe9dc', 'stone', 'stone');
    // Slate mansard with dormers
    f.tb(u.x, h, -0.6, u.w - 0.4, 2.2, d - 1.6, '#3d4a52', 'slate', 'slate');
    const dx = u.x;
    f.tb(dx, h + 0.4, d / 2 - 1.3, 1.4, 1.4, 0.8, '#efe9dc', 'stucco', 'slate');
    f.block(dx, h + 0.6, d / 2 - 0.88, 0.9, 0.9, 0.04, '#2b3440', 'dark');
    chimney(f, u.x + u.w / 2 - 0.3, h + 2.2, -0.6, 4, shade(brick, 0.9));
    // Front door with fanlight, steps and black railings to the basement area
    door(f, u.x - u.w / 4, d / 2, 1.1, 2.5, pick(rng, doors), 0.3);
    f.geom(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 10, 1, false, 0, Math.PI), u.x - u.w / 4, 3.0, d / 2 + 0.1, '#2b3440', Math.PI / 2, 0, Math.PI / 2);
    f.tb(u.x - u.w / 4, 0, d / 2 + 0.6, 1.6, 0.3, 1.2, '#d9d2c4', 'stone', 'stone');
    railing(f, u.x + u.w / 8, d / 2 + 1.4, u.w * 0.6, 1.05);
  }
  f.collider(0, 0.4, w, d + 0.8, 0, h + 3);
  return { roof: '#3d4a52' };
};

const mansion: StyleFn = (f, b, w, d, h, rng) => {
  const red = pick(rng, ['#9a4a36', '#8a3f2e', '#a85a40']);
  f.tb(0, 0, 0, w, h, d, red, 'fac-mansion', 'roof-gravel');
  f.tb(0, h - 0.6, 0, w + 0.4, 0.6, d + 0.4, '#e8e0cc', 'stone', 'stone');
  // Dutch gables over the bays
  for (const u of units(w, 7)) {
    f.tb(u.x, h, d / 2 - 0.4, u.w * 0.6, 2.2, 0.6, red, 'brick', 'stone');
    f.tb(u.x, h + 2.2, d / 2 - 0.4, u.w * 0.35, 0.9, 0.6, red, 'brick', 'stone');
    f.block(u.x, h + 3.1, d / 2 - 0.4, u.w * 0.4, 0.2, 0.7, '#e8e0cc');
  }
  // Corner turret
  f.geom(cylinder(2, 2, h, 12), w / 2 - 1.5, h / 2, d / 2 - 1.5, red, 0, 0, 0, 1, 'solid', 'brick');
  f.geom(new THREE.ConeGeometry(2.3, 3.6, 12), w / 2 - 1.5, h + 1.8, d / 2 - 1.5, '#3d4a52', 0, 0, 0, 1, 'solid', 'slate');
  chimney(f, -w / 3, h, 0, 4, red);
  f.collider(0, 0, w, d, 0, h + 3);
  return { roof: '#4a3f3a' };
};

const gherkin: StyleFn = (f, b, w, d, h) => {
  const r = Math.min(w, d) / 2 - 0.5;
  const steps = 14;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps;
    const t1 = (k + 1) / steps;
    const rad = (t: number) => r * Math.sin(Math.PI * (0.18 + t * 0.82)) * (1 - t * 0.25);
    f.geom(new THREE.CylinderGeometry(rad(t1), rad(t0), h / steps, 20, 1), 0, (k + 0.5) * (h / steps), 0, k % 2 ? '#3f6e86' : '#5a8aa0', 0, 0, 0, 1, 'solid', 'fac-glass');
  }
  f.collider(0, 0, r * 2, r * 2, 0, h);
  return { roof: '#3f6e86' };
};

const shard: StyleFn = (f, b, w, d, h) => {
  const r = Math.min(w, d) / 2;
  f.geom(new THREE.ConeGeometry(r * 1.2, h * 1.3, 4, 8), 0, (h * 1.3) / 2, 0, '#9fb8c8', 0, Math.PI / 4, 0, 1, 'solid', 'fac-glass');
  f.collider(0, 0, r * 1.6, r * 1.6, 0, h);
  return { roof: '#9fb8c8' };
};

/* ───────── San Francisco ───────── */

const PAINTED = ['#d9b8d6', '#b8dcd0', '#f2d39a', '#f4c1a8', '#b9cde8', '#cfe3b4', '#e9a9a0', '#f0e2b6'];

const painted: StyleFn = (f, b, w, d, h, rng) => {
  for (const u of units(w, 5.6)) {
    const c = pick(rng, PAINTED);
    const trim = rng.chance(0.7) ? '#fbf8f0' : shade(c, 0.7);
    const garage = 2.8;
    // Raised ground floor with garage door, then two painted floors
    f.tb(u.x, 0, 0, u.w - 0.06, garage, d, shade(c, 0.92), 'stucco', 'stucco');
    f.block(u.x + u.w / 5, 0, d / 2 + 0.05, u.w * 0.42, 2.4, 0.1, '#e9e4da');
    for (let y = 0.3; y < 2.3; y += 0.4) f.block(u.x + u.w / 5, y, d / 2 + 0.11, u.w * 0.42, 0.03, 0.02, '#b9b2a2');
    f.tb(u.x, garage, 0, u.w - 0.06, h - garage, d, c, 'fac-painted', 'roof-gravel');
    // Three-sided bay window rising through the upper floors
    const bx = u.x - u.w / 6;
    f.tb(bx, garage + 0.3, d / 2 + 0.5, 1.4, h - garage - 1, 1.0, c, 'fac-painted', 'roof-gravel');
    for (const side of [-1, 1]) f.tb(bx + side * 1.05, garage + 0.3, d / 2 + 0.25, 0.9, h - garage - 1, 0.5, c, 'fac-painted', 'roof-gravel', side * 0.6);
    // Gable front with a pediment and trim
    const shape = new THREE.Shape();
    shape.moveTo(-u.w / 2, 0);
    shape.lineTo(u.w / 2, 0);
    shape.lineTo(0, 2.6);
    shape.closePath();
    const gable = new THREE.ExtrudeGeometry(shape, { depth: d * 0.6, bevelEnabled: false });
    f.geom(gable, u.x, h, d / 2 - d * 0.6, c, 0, 0, 0, 1, 'solid', 'siding');
    f.block(u.x, h - 0.3, d / 2 + 0.05, u.w, 0.35, 0.3, trim);
    // Stairs up to the entry door
    const sx = u.x + u.w / 3.2;
    for (let s = 0; s < 6; s++) f.tb(sx, 0, d / 2 + 1.9 - s * 0.32, 1.1, 0.42 * (s + 1), 0.34, '#d9d2c4', 'wood', 'wood');
    door(f, sx, d / 2, 0.95, 2.3, shade(c, 0.55), 2.5);
  }
  f.collider(0, 0.5, w, d + 1.6, 0, h + 3);
  return { roof: '#6a5a5a' };
};

const mission: StyleFn = (f, b, w, d, h, rng) => {
  const c = pick(rng, ['#efe1c6', '#f2d9b8', '#e9d3c0', '#f4e6d0']);
  f.tb(0, 0, 0, w, h, d, c, 'fac-stucco', 'roof-gravel');
  // Red tile parapet roof and an arcade at the base
  f.tb(0, h - 0.2, 0, w + 0.6, 0.5, d + 0.6, '#a8432f', 'roof-tiles', 'roof-tiles');
  for (let x = -w / 2 + 1.5; x <= w / 2 - 1.5; x += 3) {
    f.geom(new THREE.CylinderGeometry(1.2, 1.2, 0.4, 12, 1, false, 0, Math.PI), x, 3.0, d / 2 + 0.08, c, Math.PI / 2, 0, Math.PI / 2);
    f.block(x, 0.3, d / 2 + 0.06, 2.2, 2.9, 0.08, '#2b3440', 'dark');
  }
  f.collider(0, 0, w, d, 0, h + 2);
  return { roof: '#a8432f' };
};

/* ───────── Hong Kong ───────── */

const HK_TILE = ['#e8dcd0', '#d9e2e0', '#efe0d2', '#d6dccf', '#e6d6dc', '#cfd8de', '#ece8dc'];
const NEON_WORDS = ['TEA HOUSE', 'GOLD', 'PHARMACY', 'NOODLES', 'HOTEL', 'BAKERY', 'JEWELLERY', 'MAHJONG', 'CAFE', 'KARAOKE', 'HERBAL', 'CONGEE', 'TAILOR', 'SNOOKER'];
const NEON_COLORS = ['#ff4a6e', '#3dd6ff', '#ffd54a', '#7dff7a', '#ff8a3d', '#c77dff'];

export function neonBlade(f: Frame, b: Builders, x: number, y: number, z: number, rng: Rng) {
  // A vertical sign board projecting from the facade, lettered on both faces
  const hgt = rng.range(3, 6);
  const text = pick(rng, NEON_WORDS);
  const fg = pick(rng, NEON_COLORS);
  f.block(x, y - hgt / 2 - 0.1, z - 0.35, 0.14, hgt + 0.2, 0.8, '#2a2c2f');
  for (const side of [1, -1]) {
    const [wx, wz] = f.world(x + side * 0.08, z - 0.35);
    b.signs.push({ text, x: wx, y, z: wz, rotY: f.rot + (side * Math.PI) / 2, w: 0.7, h: hgt, bg: '#120f16', fg, kind: 'neon' });
  }
}

const hkTower: StyleFn = (f, b, w, d, h, rng) => {
  const c = pick(rng, HK_TILE);
  const podium = 7;
  f.tb(0, 0, 0, w, podium, d, '#c9c2b4', 'fac-hk', 'roof-gravel');
  f.tb(0, podium, 0, w - 1.2, h - podium, d - 1.2, c, 'fac-resi', 'roof-gravel');
  // Recessed light wells give the tower its notched silhouette
  f.block(0, podium, d / 2 - 0.55, 1.6, h - podium, 0.3, shade(c, 0.55));
  // Laundry poles with washing on random floors
  for (let y = podium + 2; y < h - 3; y += 2.8)
    if (rng.chance(0.25)) {
      const lx = rng.range(-w / 3, w / 3);
      f.block(lx, y, d / 2 + 0.2, 1.8, 0.04, 0.04, '#8d939c');
      for (let k = 0; k < 3; k++) f.block(lx - 0.6 + k * 0.6, y - 0.45, d / 2 + 0.2, 0.4, 0.45, 0.03, pick(rng, ['#f4f1ea', '#5b6f8f', '#c95a4a', '#e9c46a', '#7aa07a']));
    }
  // Rooftop tanks and antennas
  f.tb(rng.range(-w / 4, w / 4), h, 0, 2.6, 2.0, 2.0, '#d9dde3', 'metal', 'metal');
  f.block(w / 3, h, -d / 4, 0.12, 4, 0.12, '#8d939c');
  // Covered arcade + neon blades at street level
  for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 3) f.block(x, 0, d / 2 + 2.2, 0.35, 3.6, 0.35, '#b9b2a2');
  f.tb(0, 3.6, d / 2 + 1.2, w, 0.4, 2.4, '#b9b2a2', 'concrete', 'roof-gravel');
  for (let k = 0; k < rng.int(1, 3); k++) neonBlade(f, b, rng.range(-w / 2 + 1, w / 2 - 1), rng.range(6, 12), d / 2 + 1.4, rng);
  f.collider(0, 0.8, w, d + 2.4, 0, h + 2);
  return { roof: '#8a8f96' };
};

const tongLau: StyleFn = (f, b, w, d, h, rng) => {
  for (const u of units(w, 5)) {
    const c = pick(rng, HK_TILE.concat(['#d9c9a0', '#c9d9c0']));
    f.tb(u.x, 0, 0, u.w - 0.05, h, d, c, 'fac-hk', 'roof-gravel');
    f.block(u.x, 0.3, d / 2 + 0.05, u.w - 0.8, 3, 0.1, '#5d636b'); // roller shutter
    for (let y = 0.5; y < 3.2; y += 0.25) f.block(u.x, y, d / 2 + 0.11, u.w - 0.8, 0.02, 0.02, '#4a4f57');
    // Balcony slabs with railings
    for (let y = 4; y < h - 1; y += 3) {
      f.block(u.x, y, d / 2 + 0.5, u.w - 0.4, 0.15, 1.0, shade(c, 0.85));
      f.block(u.x, y + 0.15, d / 2 + 0.98, u.w - 0.4, 0.9, 0.05, '#8d939c');
    }
    if (rng.chance(0.4)) neonBlade(f, b, u.x, rng.range(5, 9), d / 2 + 1.3, rng);
  }
  // Bamboo scaffolding on some buildings
  if (rng.chance(0.25)) {
    for (let x = -w / 2; x <= w / 2; x += 1.2) f.block(x, 0, d / 2 + 1.6, 0.07, h + 1, 0.07, '#c9b07a');
    for (let y = 1; y < h; y += 1.4) f.block(0, y, d / 2 + 1.6, w, 0.06, 0.06, '#c9b07a');
    f.block(0, h * 0.4, d / 2 + 1.7, w, h * 0.5, 0.03, '#3f7a5a', 'solid');
  }
  f.collider(0, 0.4, w, d + 1.2, 0, h + 2);
  return { roof: '#6a6f76' };
};

/* ───────── Singapore ───────── */

const PERANAKAN = ['#f2a7b8', '#9fd8cf', '#f4d27a', '#b8d98c', '#a9c8ef', '#f0b48a', '#e7c3e8', '#8fd0c0'];

const sgShophouse: StyleFn = (f, b, w, d, h, rng) => {
  for (const u of units(w, 4.8)) {
    const c = pick(rng, PERANAKAN);
    // Five-foot way: ground floor recessed behind columns, upper floors overhang
    f.tb(u.x, 0, -1, u.w - 0.05, 3.6, d - 2, shade(c, 0.95), 'stucco', 'stucco');
    f.block(u.x, 0.3, d / 2 - 1.95, u.w - 1.2, 2.8, 0.1, '#5a3e2b');
    f.block(u.x - u.w / 2 + 0.25, 0, d / 2 - 0.3, 0.45, 3.6, 0.45, '#f4f1ea');
    f.tb(u.x, 3.6, 0, u.w - 0.05, h - 3.6, d, c, 'fac-shophouse', 'roof-gravel');
    // Clay-tile pitched roof (ridge parallel to the street)
    for (let k = 0; k < 3; k++) f.tb(u.x, h + k * 0.55, -k * (d / 7), u.w - 0.05, 0.55, d - k * (d / 3.5), '#b5583c', 'roof-tiles', 'roof-tiles');
    f.block(u.x, h - 0.5, d / 2 + 0.1, u.w, 0.5, 0.2, '#fbf8f0');
  }
  f.block(w / 2 - 0.25, 0, d / 2 - 0.3, 0.45, 3.6, 0.45, '#f4f1ea');
  f.collider(0, 0, w, d, 0, h + 2);
  return { roof: '#b5583c' };
};

const hdb: StyleFn = (f, b, w, d, h, rng) => {
  const accent = pick(rng, ['#e0703a', '#3a8fb0', '#4aa06a', '#c9455a', '#e0b03a', '#7a5ab0']);
  const deck = 3.2;
  // Void deck: open ground floor on pillars
  for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 4) for (const z of [-d / 2 + 1, d / 2 - 1]) f.block(x, 0, z, 0.7, deck, 0.7, '#e9e4da');
  f.tb(0, 0, 0, w * 0.4, deck, d * 0.4, '#e9e4da', 'stucco', 'concrete');
  f.tb(0, deck, 0, w, h - deck, d, '#f2efe6', 'fac-hdb', 'roof-gravel');
  // Painted accent columns and the block number
  for (const x of [-w / 2 + 0.2, w / 2 - 0.2]) f.tb(x, deck, d / 2 - 1, 0.6, h - deck, 2, accent, 'stucco', 'stucco');
  const [sx, sz] = f.world(w / 2 + 0.02, 0);
  b.signs.push({ text: `Blk ${rng.int(101, 899)}`, x: sx, y: h - 3, z: sz, rotY: f.rot + Math.PI / 2, w: Math.min(d - 2, 6), h: 1.8, bg: '#ffffff', fg: accent, kind: 'letters' });
  f.tb(0, h, 0, w * 0.5, 2.2, d * 0.5, '#d9dde3', 'concrete', 'roof-gravel');
  f.collider(0, 0, w, d, 0, h + 2);
  return { roof: '#8a8f96' };
};

const eco: StyleFn = (f, b, w, d, h, rng) => {
  f.tb(0, 0, 0, w, h, d, '#c9dbe2', 'fac-eco', 'roof-gravel');
  // Sky gardens every few floors, with trees on the roof
  for (let y = 10; y < h - 4; y += 12) {
    f.tb(0, y, d / 2 + 0.6, w + 0.4, 0.6, 1.4, '#9aa0a6', 'concrete', 'grass');
    for (let x = -w / 2 + 1; x < w / 2; x += 2.2) f.geom(sphere(0.9, 6, 5), x, y + 1.2, d / 2 + 0.6, '#3f6e34', 0, 0, 0, 1, 'solid', 'leaves');
  }
  for (let k = 0; k < 5; k++) f.geom(sphere(1.4, 7, 5), rng.range(-w / 3, w / 3), h + 1.5, rng.range(-d / 3, d / 3), '#466f37', 0, 0, 0, 1, 'solid', 'leaves');
  f.collider(0, 0, w, d + 2, 0, h + 2);
  return { roof: '#5f8a45' };
};

export const CITY_STYLES: Record<string, StyleFn> = {
  'ny-brownstone': brownstone,
  'ny-prewar': prewar,
  'ny-loft': loft,
  'ldn-terrace': terrace,
  'ldn-mansion': mansion,
  'ldn-gherkin': gherkin,
  'ldn-shard': shard,
  'sf-painted': painted,
  'sf-mission': mission,
  'hk-tower': hkTower,
  'hk-tonglau': tongLau,
  'sg-shophouse': sgShophouse,
  'sg-hdb': hdb,
  'sg-eco': eco,
};
