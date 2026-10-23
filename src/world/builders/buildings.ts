/**
 * Procedural low-poly buildings. Every building is generated in a local frame where the door faces +Z,
 * then rotated to its `door` direction. Styles add signature details (columns, domes, neon, awnings…).
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs, type ColorLike } from '@/engine/voxel';
import { dressBuilding, facadeFor } from './cityKit';
import type { Facing } from '@/game/content';
import type { Rng } from '@/game/rng';
import { AD_COPY, type SignKind } from '../signage';
import { CITY_STYLES } from './cityStyles';

export interface SignSpec {
  text: string;
  icon?: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  w: number;
  h: number;
  bg: string;
  fg: string;
  /** Real-world sign type (see world/signage.ts). */
  kind?: SignKind;
  /** Second line (ad taglines etc.). */
  sub?: string;
}

export interface Builders {
  solid: VoxelBuilder;
  lit: VoxelBuilder; // windows that glow at night
  dark: VoxelBuilder; // windows that stay dark
  neon: VoxelBuilder; // always-bright accents (neon signs, bulbs)
  signs: SignSpec[];
  lamps: [number, number, number][]; // glow points (for night sprites)
  colliders: { cx: number; cz: number; w: number; d: number; minY: number; maxY: number; rotY: number }[];
  /** Building footprints for the map (center, size, rotation, height, roof color). */
  footprints: { x: number; z: number; w: number; d: number; rot: number; h: number; color: string; kind: 'building' | 'enterable' | 'landmark' }[];
  /** LED stock-ticker bands (front face of a building), scrolling live market prices. */
  tickers: { x: number; y: number; z: number; rotY: number; w: number; h: number }[];
  /** Cloth flags that wave in the wind (hoist at x,y,z; flying toward local +X). */
  flags: { x: number; y: number; z: number; rotY: number; w: number; h: number; c1: string; c2: string }[];
}

export function newBuilders(): Builders {
  return { solid: new VoxelBuilder(), lit: new VoxelBuilder(), dark: new VoxelBuilder(), neon: new VoxelBuilder(), signs: [], lamps: [], colliders: [], tickers: [], footprints: [], flags: [] };
}

export const FACING_ROT: Record<Facing, number> = { south: 0, east: Math.PI / 2, north: Math.PI, west: -Math.PI / 2 };

/** Transforms local building coordinates (door on +Z) into world space. */
export class Frame {
  constructor(public cx: number, public cz: number, public rot: number, public b: Builders) {}
  private tx(lx: number, lz: number): [number, number] {
    const c = Math.cos(this.rot);
    const s = Math.sin(this.rot);
    return [this.cx + lx * c + lz * s, this.cz - lx * s + lz * c];
  }
  world(lx: number, lz: number) {
    return this.tx(lx, lz);
  }
  block(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: ColorLike, target: 'solid' | 'lit' | 'dark' | 'neon' = 'solid', localRot = 0, topTint = 1) {
    const [x, z] = this.tx(lx, lz);
    this.b[target].box(x, y0 + h / 2, z, w, h, d, color, { rotY: this.rot + localRot, topTint });
  }
  /** Textured solid block: `tex` for the sides (a facade or surface layer), `topTex` for the top. */
  tb(lx: number, y0: number, lz: number, w: number, h: number, d: number, color: ColorLike, tex: string, topTex?: string, localRot = 0) {
    const [x, z] = this.tx(lx, lz);
    this.b.solid.box(x, y0 + h / 2, z, w, h, d, color, { rotY: this.rot + localRot, tex, topTex, worldTop: false });
  }
  geom(g: THREE.BufferGeometry, lx: number, y: number, lz: number, color: ColorLike, rx = 0, ry = 0, rz = 0, s = 1, target: 'solid' | 'neon' | 'lit' = 'solid', tex?: string) {
    const [x, z] = this.tx(lx, lz);
    this.b[target].geom(g, trs(x, y, z, rx, this.rot + ry, rz, s, s, s), color, tex);
  }
  collider(lx: number, lz: number, w: number, d: number, minY = 0, maxY = 10) {
    const [x, z] = this.tx(lx, lz);
    this.b.colliders.push({ cx: x, cz: z, w, d, minY, maxY, rotY: this.rot });
  }
  sign(text: string, icon: string | undefined, lx: number, y: number, lz: number, w: number, h: number, bg: string, fg: string) {
    const [x, z] = this.tx(lx, lz);
    this.b.signs.push({ text, icon, x, y, z, rotY: this.rot, w, h, bg, fg });
  }
  ticker(lx: number, y: number, lz: number, w: number, h = 0.9, localRot = 0) {
    const [x, z] = this.tx(lx, lz);
    this.b.tickers.push({ x, y, z, rotY: this.rot + localRot, w, h });
  }
  flag(lx: number, y: number, lz: number, w: number, h: number, c1: string, c2: string, localRot = 0) {
    const [x, z] = this.tx(lx, lz);
    this.b.flags.push({ x, y, z, rotY: this.rot + localRot, w, h, c1, c2 });
  }
  lamp(lx: number, y: number, lz: number) {
    const [x, z] = this.tx(lx, lz);
    this.b.lamps.push([x, y, z]);
  }
}

export function shade(hex: string, f: number): string {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f);
  c.g = Math.min(1, c.g * f);
  c.b = Math.min(1, c.b * f);
  return '#' + c.getHexString();
}

const GLASS = '#8fb8dc';

/** Which atlas facade each building style wears on its main body. */
const FACADE: Record<string, string> = {
  bank: 'fac-stone',
  exchange: 'fac-stone',
  library: 'fac-stone',
  civic: 'fac-stone',
  dome: 'fac-stone',
  welcome: 'fac-office',
  arcade: 'stucco',
  boutique: 'fac-brick',
  shop: 'fac-brick',
  restaurant: 'fac-brick',
  cafe: 'fac-brick',
  theater: 'fac-brick',
  showroom: 'metal',
  kiosk: 'stucco',
  warehouse: 'brick',
  market: 'brick',
  pagoda: 'stucco',
  campus: 'concrete',
  greenhouse: 'stone',
};
const GLASS_DARK = '#5d7fa6';

interface WindowOpts {
  floorH?: number;
  winW?: number;
  winH?: number;
  spacing?: number;
  startFloor?: number;
  skipFrontGround?: boolean;
  litChance?: number;
  frame?: string;
  rng: Rng;
  sides?: ('front' | 'back' | 'left' | 'right')[];
}

/** Grid of windows on the four facades of a w×d×h box at local (ox, oz). */
export function windows(f: Frame, ox: number, oz: number, w: number, d: number, y0: number, h: number, o: WindowOpts) {
  const { floorH = 3.2, winW = 1.3, winH = 1.6, spacing = 2.6, startFloor = 0, skipFrontGround = true, litChance = 0.7, frame, rng, sides = ['front', 'back', 'left', 'right'] } = o;
  const floors = Math.max(1, Math.floor((h - 0.6) / floorH));
  const put = (lx: number, lz: number, ww: number, dd: number, y: number) => {
    const target = rng.next() < litChance ? 'lit' : 'dark';
    f.block(lx, y, lz, ww, winH, dd, target === 'lit' ? GLASS : GLASS_DARK, target);
    if (frame) f.block(lx, y - 0.12, lz, ww + 0.25, 0.12, dd + 0.25, frame);
  };
  for (let fl = startFloor; fl < floors; fl++) {
    const y = y0 + fl * floorH + 1.0;
    if (y + winH > y0 + h - 0.3) break;
    for (const side of sides) {
      const len = side === 'front' || side === 'back' ? w : d;
      const n = Math.max(1, Math.floor((len - 1.2) / spacing));
      const start = -((n - 1) * spacing) / 2;
      for (let i = 0; i < n; i++) {
        const t = start + i * spacing;
        if (side === 'front') {
          if (fl === 0 && skipFrontGround && Math.abs(t) < 2.6) continue;
          put(ox + t, oz + d / 2 + 0.04, winW, 0.12, y);
        } else if (side === 'back') put(ox + t, oz - d / 2 - 0.04, winW, 0.12, y);
        else if (side === 'left') put(ox - w / 2 - 0.04, oz + t, 0.12, winW, y);
        else put(ox + w / 2 + 0.04, oz + t, 0.12, winW, y);
      }
    }
  }
}

function pitchedRoof(f: Frame, w: number, d: number, y0: number, color: string, steps = 4, overhang = 0.6) {
  const stepH = 0.7;
  for (let i = 0; i < steps; i++) {
    const dd = d + overhang * 2 - (i * (d + overhang * 2)) / steps;
    f.tb(0, y0 + i * stepH, 0, w + overhang * 2, stepH, Math.max(0.8, dd), i % 2 ? shade(color, 0.94) : color, 'roof-tiles', 'roof-tiles');
  }
}

function columns(f: Frame, w: number, z: number, h: number, n: number, color: string, r = 0.45) {
  const span = w - 2;
  for (let i = 0; i < n; i++) {
    const x = -span / 2 + (span * i) / (n - 1);
    f.geom(cylinder(r, r * 1.1, h, 12), x, h / 2 + 0.3, z, color, 0, 0, 0, 1, 'solid', 'marble');
    f.collider(x, z, r * 2.2, r * 2.2, 0, h + 0.5);
    f.tb(x, 0.3, z, r * 2.6, 0.35, r * 2.6, shade(color, 0.92), 'marble');
    f.tb(x, h + 0.1, z, r * 2.6, 0.35, r * 2.6, shade(color, 0.92), 'marble');
  }
}

function door(f: Frame, d: number, accent: string, trim: string, wide = false) {
  const dw = wide ? 4 : 2.4;
  f.block(0, 0.3, d / 2 + 0.02, dw + 0.6, 3.5, 0.25, trim);
  f.block(0, 0.3, d / 2 + 0.12, dw, 3.1, 0.2, '#3a2f2a');
  f.block(-dw / 4, 0.4, d / 2 + 0.2, dw / 2 - 0.15, 2.8, 0.05, GLASS_DARK);
  f.block(dw / 4, 0.4, d / 2 + 0.2, dw / 2 - 0.15, 2.8, 0.05, GLASS_DARK);
  // Steps
  f.tb(0, 0, d / 2 + 0.9, dw + 1.6, 0.3, 1.6, '#d8d2c4', 'stone', 'stone');
  // Awning
  f.block(0, 3.8, d / 2 + 0.9, dw + 1.4, 0.3, 1.8, accent, 'solid', 0, 1.08);
  f.lamp(-dw / 2 - 0.6, 3.2, d / 2 + 0.4);
  f.lamp(dw / 2 + 0.6, 3.2, d / 2 + 0.4);
}

function awningStripes(f: Frame, w: number, z: number, y: number, a: string, b: string) {
  const n = Math.floor(w / 1.2);
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + 0.6 + i * (w / n);
    f.block(x, y, z, w / n, 0.35, 1.6, i % 2 ? a : b, 'solid', 0, 1.06);
  }
}

function rooftopClutter(f: Frame, w: number, d: number, top: number, rng: Rng) {
  const n = rng.int(1, 3);
  for (let i = 0; i < n; i++) {
    const x = rng.range(-w / 2 + 1.5, w / 2 - 1.5);
    const z = rng.range(-d / 2 + 1.5, d / 2 - 1.5);
    const kind = rng.int(0, 2);
    if (kind === 0) f.block(x, top, z, 1.6, 1.0, 1.2, '#b9bec9');
    else if (kind === 1) {
      f.geom(cylinder(0.8, 0.8, 1.6, 8), x, top + 1.5, z, '#a46b45');
      f.block(x - 0.5, top, z - 0.5, 0.15, 0.8, 0.15, '#5a4a3a');
      f.block(x + 0.5, top, z + 0.5, 0.15, 0.8, 0.15, '#5a4a3a');
    } else f.block(x, top, z, 0.3, 1.8, 0.3, '#8a8f9c');
  }
}

/** Steel-framed rooftop billboard with a catwalk and spotlights, facing the street. */
function rooftopBillboard(f: Frame, w: number, d: number, top: number, rng: Rng) {
  const bw = Math.min(w - 2, 9);
  const bh = bw * 0.36;
  const z = d / 2 - 1.2;
  const steel = '#4a4f57';
  for (const x of [-bw / 2 + 0.6, 0, bw / 2 - 0.6]) {
    f.block(x, top, z - 0.6, 0.18, 1.6 + bh, 0.18, steel);
    f.block(x, top, z - 1.6, 0.14, 1.4, 0.14, steel);
    f.block(x, top + 1.3, z - 1.1, 0.1, 0.1, 1.1, steel);
  }
  f.block(0, top + 1.5, z - 0.3, bw, 0.08, 0.7, steel); // catwalk
  f.block(0, top + 1.6, z - 0.4, bw + 0.2, bh + 0.2, 0.12, '#2a2d31');
  for (const x of [-bw / 3, 0, bw / 3]) f.block(x, top + 1.5, z + 0.1, 0.12, 0.12, 0.5, steel);
  const ad = AD_COPY[Math.floor(rng.next() * AD_COPY.length)];
  const [sx, sz] = f.world(0, z - 0.33);
  f.b.signs.push({ text: ad.name, sub: ad.tag, x: sx, y: top + 1.7 + bh / 2, z: sz, rotY: f.rot, w: bw, h: bh, bg: ad.bg, fg: ad.fg, kind: 'billboard' });
}

export interface BuildingSpec {
  name?: string;
  icon?: string;
  cx: number;
  cz: number;
  w: number;
  d: number;
  h: number;
  facing: Facing;
  style: string;
  wall: string;
  roof: string;
  trim: string;
  accent: string;
  enterable?: boolean;
  signBg?: string;
  /** City the building stands in (sets its local facade and rooftop details). */
  city?: string;
}

/** Which kind of real-world sign each building style carries. */
const SIGN_KIND: Record<string, SignKind> = {
  bank: 'carved',
  exchange: 'carved',
  library: 'carved',
  civic: 'carved',
  dome: 'carved',
  arcade: 'marquee',
  theater: 'marquee',
  welcome: 'letters',
  showroom: 'letters',
  campus: 'letters',
  tower: 'letters',
  glass: 'letters',
  office: 'letters',
};

/**
 * Builds one building. Returns the world-space door point (for triggers).
 */
export function buildBuilding(b: Builders, s: BuildingSpec, rng: Rng): { doorX: number; doorZ: number; rot: number } {
  const before = b.signs.length;
  const res = buildBuildingInner(b, s, rng);
  dressBuilding(s.city, new Frame(s.cx, s.cz, res.rot, b), b, s.w, s.d, s.h, s.style, rng);
  // Public buildings fly a flag from a pole on the front of the roof
  if (s.style === 'bank' || s.style === 'civic' || s.style === 'library' || s.style === 'exchange') {
    const f = new Frame(s.cx, s.cz, res.rot, b);
    f.block(0, s.h + 0.5, s.d / 2 - 1.2, 0.12, 5.5, 0.12, '#c0c4cc');
    f.geom(sphere(0.12, 6, 4), 0, s.h + 6.05, s.d / 2 - 1.2, '#d9b95c');
    f.flag(0.06, s.h + 5.7, s.d / 2 - 1.2, 2.4, 1.5, s.accent, s.trim);
  }
  b.footprints.push({ x: s.cx, z: s.cz, w: s.w, d: s.d, rot: res.rot, h: s.h, color: s.roof, kind: s.enterable ? 'enterable' : 'building' });
  for (let i = before; i < b.signs.length; i++) b.signs[i].kind ??= SIGN_KIND[s.style] ?? 'fascia';
  return res;
}

function buildBuildingInner(b: Builders, s: BuildingSpec, rng: Rng): { doorX: number; doorZ: number; rot: number } {
  const rot = FACING_ROT[s.facing];
  const f = new Frame(s.cx, s.cz, rot, b);
  const { w, d, h, wall, roof, trim, accent } = s;

  // Foundation + body
  f.tb(0, 0, 0, w + 0.6, 0.3, d + 0.6, '#cfc8b8', 'stone', 'stone');
  f.collider(0, 0, w, d, 0, h + 2);

  const body = () => f.tb(0, 0.3, 0, w, h - 0.3, d, wall, facadeFor(s.style, s.city, FACADE[s.style] ?? 'fac-office'), 'roof-gravel');
  const parapet = (c = roof) => {
    f.tb(0, h, 0, w + 0.3, 0.6, d + 0.3, c, 'concrete', 'concrete');
    f.tb(0, h + 0.6, 0, w - 0.6, 0.12, d - 0.6, shade(c, 0.85), 'roof-gravel', 'roof-gravel');
  };
  const winOpts = { rng, frame: trim === '#ffffff' ? undefined : undefined };

  switch (s.style) {
    case 'bank':
    case 'exchange': {
      body();
      // Portico
      const porch = 3.2;
      f.block(0, 0.3, d / 2 + porch / 2, w, 0.4, porch + 0.4, '#e8e1d0');
      columns(f, w, d / 2 + porch - 0.6, h - 1.6, s.style === 'exchange' ? 6 : 5, '#f7f3ea');
      f.block(0, h - 1.3, d / 2 + porch / 2, w + 0.6, 0.9, porch + 0.8, trim === '#1e2840' ? '#f7f3ea' : trim);
      for (let i = 0; i < 4; i++) f.block(0, h - 0.4 + i * 0.55, d / 2 + porch / 2, w + 0.4 - i * (w / 4.2), 0.55, porch + 0.4 - i * 0.3, i === 3 ? accent : '#f7f3ea', 'solid', 0, 1.05);
      f.block(0, h, -porch / 2 + 0.2, w + 0.3, 0.6, d - porch + 0.3, roof);
      // Gold coin emblem
      f.geom(cylinder(1.1, 1.1, 0.3, 16), 0, h + 0.4, d / 2 + porch + 0.1, accent, Math.PI / 2);
      f.block(0, 0.3, d / 2 + 0.1, 3, 3.4, 0.3, '#3a2f2a');
      f.lamp(-2, 3, d / 2 + porch - 0.2);
      f.lamp(2, 3, d / 2 + porch - 0.2);
      if (s.style === 'exchange') {
        // LED ticker bands wrapping the sides, like a real exchange
        f.block(w / 2 + 0.06, h * 0.55 - 0.1, 0, 0.12, 1.1, d - 1, '#0b0c0e');
        f.block(-w / 2 - 0.06, h * 0.55 - 0.1, 0, 0.12, 1.1, d - 1, '#0b0c0e');
        f.ticker(w / 2 + 0.13, h * 0.55 + 0.45, 0, d - 1.2, 0.9, Math.PI / 2);
        f.ticker(-w / 2 - 0.13, h * 0.55 + 0.45, 0, d - 1.2, 0.9, -Math.PI / 2);
        f.block(w / 2 - 1, h + 0.6, 0, 0.15, 6, 0.15, '#c0c4cc');
        f.block(w / 2 - 1 - 0.9, h + 5.4, 0, 1.6, 1.0, 0.08, '#2f6bdb');
      }
      f.sign(s.name ?? '', s.icon, 0, h - 0.85, d / 2 + porch + 0.42, Math.min(w - 2, 12), 1.2, '#1e2840', '#ffcf3f');
      return doorPoint(f, d / 2 + porch + 1.6, rot);
    }
    case 'welcome': {
      body();
      // Big glass front
      f.block(0, 0.6, d / 2 + 0.05, w - 4, h - 2.4, 0.15, GLASS, 'lit');
      for (let x = -w / 2 + 2; x <= w / 2 - 2; x += 2.25) f.block(x, 0.6, d / 2 + 0.15, 0.2, h - 2.4, 0.12, trim);
      f.block(0, h, 0, w + 1.2, 0.8, d + 1.2, roof, 'solid', 0, 1.08);
      f.block(0, h + 0.8, 0, w - 4, 0.5, d - 4, accent);
      // Canopy
      f.block(0, 4.2, d / 2 + 2.4, 10, 0.35, 4.4, roof, 'solid', 0, 1.08);
      f.block(-4.6, 0.3, d / 2 + 4.3, 0.3, 3.9, 0.3, trim);
      f.block(4.6, 0.3, d / 2 + 4.3, 0.3, 3.9, 0.3, trim);
      // Flags
      for (const x of [-w / 2 - 1.5, w / 2 + 1.5]) {
        f.block(x, 0, d / 2 + 2, 0.18, 9, 0.18, '#c0c4cc');
        f.flag(x + 0.1, 8.6, d / 2 + 2, 1.8, 1.1, x < 0 ? '#1f8a8a' : '#d9a92a', '#f4f1ea');
      }
      f.lamp(-3.5, 3.6, d / 2 + 3.5);
      f.lamp(3.5, 3.6, d / 2 + 3.5);
      f.sign(s.name ?? '', s.icon, 0, h - 1.2, d / 2 + 0.3, Math.min(w - 4, 14), 1.6, '#1e2840', '#ffffff');
      return doorPoint(f, d / 2 + 3, rot);
    }
    case 'library':
    case 'civic': {
      body();
      pitchedRoof(f, w, d, h, roof, 5);
      columns(f, w * 0.7, d / 2 + 1.4, h - 1.2, 4, '#f7f3ea', 0.38);
      f.block(0, h - 1.2, d / 2 + 1.3, w * 0.7 + 1, 0.8, 2.4, '#f7f3ea');
      f.block(0, 0.3, d / 2 + 1.3, w * 0.7 + 1, 0.3, 2.6, '#e8e1d0');
      door(f, d, accent, trim);
      if (s.style === 'civic') {
        // Clock tower
        f.block(0, h + 3, -d / 4, 4, 6, 4, wall);
        f.block(0, h + 9, -d / 4, 4.6, 0.6, 4.6, roof);
        pitchedRoof(new Frame(...f.world(0, -d / 4), rot, b), 3.6, 3.6, h + 9.6, roof, 4, 0.2);
        f.geom(cylinder(1.3, 1.3, 0.2, 16), 0, h + 6.5, -d / 4 + 2.05, '#fffaf0', Math.PI / 2);
        f.block(0, h + 6.2, -d / 4 + 2.2, 0.12, 1.1, 0.06, '#1e2840');
        f.block(0.3, h + 6.45, -d / 4 + 2.2, 0.7, 0.12, 0.06, '#1e2840');
      }
      f.sign(s.name ?? '', s.icon, 0, h - 0.6, d / 2 + 2.55, Math.min(w * 0.7, 11), 1.2, '#1e2840', '#ffffff');
      return doorPoint(f, d / 2 + 3.2, rot);
    }
    case 'arcade': {
      body();
      parapet(shade(wall, 0.8));
      // Neon stripes
      f.block(0, h - 1.2, d / 2 + 0.06, w - 1, 0.3, 0.12, '#f06aa8', 'neon');
      f.block(0, h - 2.0, d / 2 + 0.06, w - 1, 0.3, 0.12, '#2ebaba', 'neon');
      f.block(-w / 2 - 0.06, 1, 0, 0.12, 0.3, d - 1, '#ffcf3f', 'neon');
      f.block(w / 2 + 0.06, 1, 0, 0.12, 0.3, d - 1, '#ffcf3f', 'neon');
      // Marquee bulbs
      for (let x = -w / 2 + 1; x <= w / 2 - 1; x += 1.2) f.block(x, h + 0.7, d / 2 + 0.1, 0.35, 0.35, 0.35, '#fff2a8', 'neon');
      // Star
      f.block(0, h + 1.2, 0, 3, 3, 0.4, '#ffcf3f', 'neon', Math.PI / 4);
      f.block(0, 0.6, d / 2 + 0.05, w - 6, 2.8, 0.1, '#2b1f4f', 'lit');
      door(f, d, accent, '#f06aa8');
      f.sign(s.name ?? '', s.icon, 0, h - 3.6, d / 2 + 0.25, Math.min(w - 2, 10), 1.4, '#f06aa8', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'boutique':
    case 'shop':
    case 'restaurant':
    case 'cafe': {
      body();
      parapet();
      // Display windows
      f.block(-w / 4 - 0.6, 0.6, d / 2 + 0.05, w / 2 - 3.2, 2.6, 0.12, GLASS, 'lit');
      f.block(w / 4 + 0.6, 0.6, d / 2 + 0.05, w / 2 - 3.2, 2.6, 0.12, GLASS, 'lit');
      awningStripes(f, w - 0.4, d / 2 + 0.8, 3.5, accent, '#ffffff');
      door(f, d, accent, trim);
      if (s.style === 'restaurant') {
        // Lanterns
        for (const x of [-w / 2 + 1, w / 2 - 1]) {
          f.geom(sphere(0.45, 8, 6), x, 3.0, d / 2 + 0.8, '#e1553f', 0, 0, 0, 1, 'neon');
        }
      }
      if (s.style === 'cafe') {
        for (const x of [-w / 2 - 1.2, w / 2 + 1.2]) {
          f.geom(cylinder(0.6, 0.6, 0.08, 10), x, 1.0, d / 2 + 1.6, '#ffffff');
          f.block(x, 0, d / 2 + 1.6, 0.12, 1.0, 0.12, '#5a4a3a');
          f.geom(cylinder(0.05, 0.05, 2.5, 6), x, 1.6, d / 2 + 1.6, '#c0c4cc');
          f.geom(new THREE.ConeGeometry(1.4, 0.7, 8), x, 3.0, d / 2 + 1.6, accent);
        }
      }
      f.sign(s.name ?? '', s.icon, 0, Math.min(h - 0.9, 5.4), d / 2 + 0.25, Math.min(w - 1, 10), 1.3, s.signBg ?? '#1e2840', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'showroom': {
      body();
      parapet(accent === '#ffcf3f' ? roof : roof);
      f.block(0, 0.4, d / 2 + 0.05, w - 1.5, h - 2, 0.12, GLASS, 'lit');
      for (let x = -w / 2 + 0.75; x <= w / 2 - 0.75; x += 3.5) f.block(x, 0.4, d / 2 + 0.12, 0.25, h - 2, 0.15, trim);
      f.block(0, h - 1.6, d / 2 + 0.1, w, 1.0, 0.3, roof);
      // Flag bunting
      for (let x = -w / 2; x <= w / 2; x += 1.4) f.block(x, h + 0.9, d / 2 + 0.2, 0.6, 0.6, 0.05, ['#e1553f', '#ffcf3f', '#2f6bdb', '#3cc45a'][Math.abs(Math.round(x)) % 4], 'solid', 0);
      f.sign(s.name ?? '', s.icon, 0, h - 1.1, d / 2 + 0.3, Math.min(w - 2, 12), 1.1, '#e1553f', '#ffffff');
      return doorPoint(f, d / 2 + 1.6, rot);
    }
    case 'kiosk': {
      body();
      f.block(0, h, 0, w + 1, 0.6, d + 1, roof, 'solid', 0, 1.08);
      f.geom(sphere(2.2, 14, 10), 0, h + 2.8, 0, '#2f6bdb');
      f.geom(sphere(2.25, 8, 6), 0, h + 2.8, 0, '#3cc45a', 0.3, 0.5, 0, 0.9);
      f.block(0, h + 0.6, 0, 0.3, 0.6, 0.3, '#c0c4cc');
      f.block(0, 0.6, d / 2 + 0.05, w - 3, 2.8, 0.1, GLASS, 'lit');
      door(f, d, accent, trim);
      f.sign(s.name ?? '', s.icon, 0, h - 1.4, d / 2 + 0.25, Math.min(w - 1, 9), 1.2, '#2ebaba', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'theater': {
      body();
      parapet();
      f.block(0, 3.6, d / 2 + 1.5, w - 2, 1.6, 3, '#1e2840');
      for (let x = -w / 2 + 1.5; x <= w / 2 - 1.5; x += 0.9) {
        f.block(x, 3.45, d / 2 + 3.0, 0.3, 0.3, 0.3, '#fff2a8', 'neon');
        f.block(x, 5.25, d / 2 + 3.0, 0.3, 0.3, 0.3, '#fff2a8', 'neon');
      }
      f.block(0, 5.6, d / 2 + 0.3, 3.4, h - 6.2, 0.5, accent, 'neon');
      door(f, d, '#e1553f', trim, true);
      f.sign(s.name ?? '', s.icon, 0, 3.85, d / 2 + 3.05, Math.min(w - 3, 11), 1.1, '#1e2840', '#ffcf3f');
      return doorPoint(f, d / 2 + 3.6, rot);
    }
    case 'warehouse':
    case 'market': {
      body();
      // Barrel / sawtooth roof
      const n = Math.max(2, Math.round(w / 6));
      for (let i = 0; i < n; i++) {
        const x = -w / 2 + (w / n) * (i + 0.5);
        f.geom(new THREE.CylinderGeometry(w / n / 2, w / n / 2, d + 0.6, 10, 1, false, 0, Math.PI), x, h, 0, i % 2 ? roof : shade(roof, 0.9), Math.PI / 2, 0, Math.PI / 2, 1, 'solid', 'metal');
      }
      windows(f, 0, 0, w, d, 0.3, h, { ...winOpts, winH: 1, spacing: 3.2, startFloor: 1 });
      if (s.style === 'market') {
        awningStripes(f, w - 0.4, d / 2 + 0.8, 3.4, accent, '#ffffff');
        // Fruit crates out front
        for (let x = -w / 2 + 2; x < w / 2 - 2; x += 2.4) {
          if (Math.abs(x) < 2.5) continue;
          f.block(x, 0, d / 2 + 2.3, 1.6, 0.8, 1.1, '#a8774a');
          f.block(x, 0.8, d / 2 + 2.3, 1.4, 0.3, 0.9, ['#e1553f', '#ffcf3f', '#3cc45a', '#ff8a3d'][Math.abs(Math.round(x)) % 4]);
        }
      } else {
        // Big loading doors
        f.block(-w / 4, 0.3, d / 2 + 0.06, 4, 4.4, 0.12, '#8a8f9c');
        for (let y = 0.6; y < 4.6; y += 0.5) f.block(-w / 4, y, d / 2 + 0.13, 4, 0.06, 0.06, '#6a6f7c');
        f.block(w / 4, 0, d / 2 + 1.2, 1.2, 1.2, 1.2, '#a8774a');
        f.block(w / 4 + 1.3, 0, d / 2 + 1.3, 1.2, 1.2, 1.2, '#a8774a');
        f.block(w / 4 + 0.6, 1.2, d / 2 + 1.25, 1.2, 1.2, 1.2, '#c09060');
      }
      door(f, d, accent, trim, s.style === 'market');
      f.sign(s.name ?? '', s.icon, 0, Math.min(h - 0.8, 5.6), d / 2 + 0.25, Math.min(w - 2, 12), 1.3, s.signBg ?? '#1e2840', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'dome': {
      body();
      f.block(0, h, 0, w + 0.4, 0.5, d + 0.4, trim);
      const r = Math.min(w, d) / 2 - 0.5;
      f.geom(new THREE.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, h + 0.5, 0, roof);
      f.block(0, h + 0.5 + r, 0, 0.3, 1.6, 0.3, accent);
      door(f, d, accent, trim);
      f.sign(s.name ?? '', s.icon, 0, h - 1.0, d / 2 + 0.25, Math.min(w - 2, 10), 1.2, '#1e2840', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'greenhouse': {
      f.block(0, 0.3, 0, w, 1.2, d, wall);
      f.block(0, 1.5, 0, w - 0.2, h - 1.5, d - 0.2, '#a9dcc8', 'lit');
      for (let x = -w / 2; x <= w / 2; x += 2.5) f.block(x, 1.5, d / 2, 0.15, h - 1.5, 0.15, trim);
      for (let x = -w / 2; x <= w / 2; x += 2.5) f.block(x, 1.5, -d / 2, 0.15, h - 1.5, 0.15, trim);
      const r = w / 2;
      f.geom(new THREE.CylinderGeometry(r, r, d, 14, 1, false, 0, Math.PI), 0, h, 0, '#bfe8d6', Math.PI / 2, 0, Math.PI / 2, 1, 'lit');
      // Trees inside
      for (const x of [-w / 4, w / 4]) {
        f.block(x, 0.3, -d / 6, 0.6, 3, 0.6, '#7a5a3a');
        f.geom(sphere(2, 8, 6), x, 4, -d / 6, '#3cc45a');
      }
      door(f, d, accent, trim);
      f.sign(s.name ?? '', s.icon, 0, 4.4, d / 2 + 0.25, Math.min(w - 2, 10), 1.2, '#3a6b4a', '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'pagoda': {
      body();
      windows(f, 0, 0, w, d, 0.3, h, { ...winOpts, winH: 1.4 });
      const tiers = 3;
      for (let i = 0; i < tiers; i++) {
        const tw = w + 2 - i * 2.4;
        const td = d + 2 - i * 2.4;
        const y = h + i * 2.2;
        f.block(0, y, 0, tw, 0.5, td, roof, 'solid', 0, 1.08);
        f.block(0, y + 0.5, 0, tw - 2.4, 1.7, td - 2.4, i % 2 ? '#e1553f' : wall);
        f.block(tw / 2 - 0.2, y + 0.3, td / 2 - 0.2, 0.6, 0.6, 0.6, roof);
        f.block(-tw / 2 + 0.2, y + 0.3, td / 2 - 0.2, 0.6, 0.6, 0.6, roof);
      }
      f.geom(sphere(0.5, 8, 6), 0, h + tiers * 2.2 + 0.5, 0, accent);
      door(f, d, '#e1553f', trim);
      for (const x of [-w / 2 + 0.8, w / 2 - 0.8]) f.geom(sphere(0.45, 8, 6), x, 3.0, d / 2 + 0.6, '#e1553f', 0, 0, 0, 1, 'neon');
      f.sign(s.name ?? '', s.icon, 0, 4.6, d / 2 + 0.3, Math.min(w - 1, 9), 1.2, '#e1553f', '#ffcf3f');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'campus': {
      // Low modern glass building with rooftop garden
      f.block(0, 0.3, 0, w, h - 0.3, d, '#f4f6fa');
      for (let y = 1; y < h - 1; y += 3.2) {
        f.block(0, y, d / 2 + 0.05, w - 0.6, 2.2, 0.1, GLASS, 'lit');
        f.block(0, y, -d / 2 - 0.05, w - 0.6, 2.2, 0.1, GLASS, 'lit');
        f.block(w / 2 + 0.05, y, 0, 0.1, 2.2, d - 0.6, GLASS, 'dark');
        f.block(-w / 2 - 0.05, y, 0, 0.1, 2.2, d - 0.6, GLASS, 'dark');
      }
      f.block(0, h, 0, w + 0.3, 0.4, d + 0.3, '#d9dde6');
      f.block(0, h + 0.4, 0, w - 2, 0.4, d - 2, '#5bb04a');
      for (let i = 0; i < 4; i++) f.geom(sphere(1, 8, 6), -w / 3 + (i * w) / 4.5, h + 1.4, 0, '#3f9a45');
      f.block(0, 0.3, d / 2 + 1.5, 6, 3.6, 0.25, accent);
      door(f, d, accent, trim, true);
      f.sign(s.name ?? '', s.icon, 0, h - 1.2, d / 2 + 0.3, Math.min(w - 2, 12), 1.2, accent, '#ffffff');
      return doorPoint(f, d / 2 + 1.8, rot);
    }
    case 'tower':
    case 'glass':
    case 'office':
    default: {
      const tall = h > 20;
      if (s.style === 'glass' || (tall && s.style === 'tower')) {
        // Glass curtain wall with setbacks
        const tiers = tall ? 3 : 1;
        let tw = w;
        let td = d;
        let y = 0.3;
        const tierH = (h - 0.3) / tiers;
        for (let i = 0; i < tiers; i++) {
          f.tb(0, y, 0, tw, tierH, td, wall, 'fac-glass', 'roof-gravel');
          y += tierH;
          f.tb(0, y, 0, tw + 0.3, 0.4, td + 0.3, trim === '#ffffff' ? '#d9dde6' : shade(wall, 0.8), 'concrete', 'roof-gravel');
          y += 0.4;
          tw *= 0.78;
          td *= 0.78;
        }
        if (tall && rng.chance(0.35)) {
          f.block(0, 5.4, d / 2 + 0.07, w - 0.6, 1.1, 0.14, '#0b0c0e');
          f.ticker(0, 5.95, d / 2 + 0.15, w - 0.9, 0.9);
        }
        if (tall) {
          f.block(0, y, 0, 0.4, 4, 0.4, '#c0c4cc');
          f.block(0, y + 4, 0, 0.5, 0.5, 0.5, '#ff5a4a', 'neon');
        }
      } else {
        body();
        parapet();
        rooftopClutter(f, w, d, h + 0.6, rng);
      }
      if (s.enterable) {
        door(f, d, accent, trim, s.style === 'glass');
        f.sign(s.name ?? '', s.icon, 0, Math.min(5.2, h - 1), d / 2 + 0.3, Math.min(w - 1, 11), 1.2, s.signBg ?? '#1e2840', '#ffffff');
      }
      return doorPoint(f, d / 2 + 1.8, rot);
    }
  }
}

function doorPoint(f: Frame, lz: number, rot: number) {
  const [x, z] = f.world(0, lz);
  return { doorX: x, doorZ: z, rot };
}

/* ───────── City filler styles (non-enterable) ───────── */

export function buildFiller(b: Builders, x: number, z: number, w: number, d: number, h: number, facing: Facing, style: string, rng: Rng, pal: { walls: string[]; roofs: string[]; trims: string[]; accents: string[] }) {
  const wall = rng.pick(pal.walls);
  const roof = rng.pick(pal.roofs);
  const trim = rng.pick(pal.trims);
  const accent = rng.pick(pal.accents);
  const f = new Frame(x, z, FACING_ROT[facing], b);
  const cityStyle = CITY_STYLES[style];
  if (cityStyle) {
    const out = cityStyle(f, b, w, d, h, rng, pal);
    b.footprints.push({ x, z, w, d, rot: f.rot, h, color: out?.roof ?? roof, kind: 'building' });
    return;
  }
  switch (style) {
    case 'rowhouse': {
      // Narrow houses side by side (London terraces, NY brownstones, SF painted ladies)
      const n = Math.max(1, Math.round(w / 6));
      const uw = w / n;
      for (let i = 0; i < n; i++) {
        const ux = -w / 2 + uw * (i + 0.5);
        const c = rng.pick(pal.walls);
        const uh = h + rng.range(-1, 1.5);
        f.tb(ux, 0, 0, uw - 0.1, uh, d, c, rng.chance(0.75) ? 'fac-brick' : 'fac-stucco', 'roof-gravel');
        // Cornice
        f.tb(ux, uh - 0.5, 0, uw - 0.1, 0.5, d + 0.3, shade(c, 1.15), 'stone');
        if (style === 'rowhouse' && rng.chance(0.5)) {
          // Pointed roof
          for (let k = 0; k < 3; k++) f.tb(ux, uh + k * 0.6, 0, uw - 0.1 - k * 1.6, 0.6, d, roof, 'slate', 'slate');
        } else f.block(ux, uh, 0, uw, 0.5, d + 0.2, trim);
        f.block(ux, 0, d / 2 + 0.6, 1.4, 0.5, 1.2, '#d8d2c4');
        f.block(ux, 0.3, d / 2 + 0.05, 1.0, 2.2, 0.1, accent);
      }
      f.collider(0, 0, w, d, 0, h + 2);
      b.footprints.push({ x, z, w, d, rot: f.rot, h, color: roof, kind: 'building' });
      return;
    }
    case 'shophouse': {
      const n = Math.max(1, Math.round(w / 5));
      const uw = w / n;
      for (let i = 0; i < n; i++) {
        const ux = -w / 2 + uw * (i + 0.5);
        const c = rng.pick(pal.walls);
        f.tb(ux, 0, 0, uw - 0.08, h, d, c, 'fac-stucco', 'roof-tiles');
        f.block(ux, 0, d / 2 - 0.8, uw - 0.4, 3, 0.1, '#3a2f2a');
        f.block(ux, 3, d / 2 + 0.5, uw, 0.3, 1.4, rng.pick(pal.accents), 'solid', 0, 1.06);
        f.tb(ux, h, 0, uw, 0.6, d + 0.6, roof, 'roof-tiles', 'roof-tiles');
        if (rng.chance(0.4)) f.block(ux, 4.2, d / 2 + 0.3, uw * 0.7, 1.0, 0.2, rng.pick(['#e1553f', '#ffcf3f', '#2ebaba', '#f06aa8']), 'neon');
      }
      f.collider(0, 0, w, d, 0, h + 2);
      b.footprints.push({ x, z, w, d, rot: f.rot, h, color: roof, kind: 'building' });
      return;
    }
    case 'neon-tower': {
      // Slim Hong Kong tower with neon signs and AC units
      f.tb(0, 0, 0, w, h, d, wall, 'fac-hk', 'roof-gravel');
      f.tb(0, h, 0, w + 0.2, 0.4, d + 0.2, roof, 'concrete', 'roof-gravel');
      const signs = rng.int(1, 3);
      for (let i = 0; i < signs; i++) {
        const sy = rng.range(4, Math.max(5, h * 0.7));
        f.block(w / 2 + 0.6, sy, rng.range(-d / 4, d / 4), 0.25, rng.range(2, 5), 1.2, rng.pick(['#e1553f', '#ffcf3f', '#2ebaba', '#f06aa8', '#8a5cf6']), 'neon');
      }
      f.collider(0, 0, w, d, 0, h + 2);
      b.footprints.push({ x, z, w, d, rot: f.rot, h, color: roof, kind: 'building' });
      return;
    }
    case 'victorian': {
      const c = wall;
      f.tb(0, 0, 0, w, h, d, c, 'fac-siding', 'slate');
      // Bay window
      f.block(-w / 4, 1, d / 2 + 0.6, w / 3, h - 2, 1.2, shade(c, 0.95));
      for (let y = 1.4; y < h - 1.4; y += 3) {
        const lit = rng.chance(0.6);
        f.block(-w / 4, y, d / 2 + 1.25, w / 4, 1.6, 0.1, lit ? GLASS : GLASS_DARK, lit ? 'lit' : 'dark');
      }
      for (let k = 0; k < 4; k++) f.tb(0, h + k * 0.6, 0, w + 0.4 - k * (w / 4), 0.6, d + 0.4, k === 0 ? trim : roof, k === 0 ? 'wood' : 'slate', k === 0 ? 'wood' : 'slate');
      f.block(w / 4, 0, d / 2 + 0.7, 1.4, 0.8, 1.2, '#ffffff');
      f.block(w / 4, 0.8, d / 2 + 0.05, 1.1, 2.2, 0.1, accent);
      f.collider(0, 0, w, d + 1.2, 0, h + 2);
      b.footprints.push({ x, z, w, d, rot: f.rot, h, color: roof, kind: 'building' });
      return;
    }
    default: {
      buildBuilding(b, { cx: x, cz: z, w, d, h, facing, style: style === 'mixed' ? (h > 22 ? 'glass' : 'office') : style, wall, roof, trim, accent }, rng);
      if (h < 24 && w > 9 && rng.chance(0.3)) rooftopBillboard(f, w, d, h + 0.6, rng);
    }
  }
}
