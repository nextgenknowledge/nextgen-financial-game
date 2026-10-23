/**
 * City identity at street level. Each city lays its streets its own way: the paving, the kerb
 * stones and how they are painted, the road surface and its markings, the style of street lamp,
 * and how the big enterable buildings are finished (facade material and rooftop clutter).
 */
import * as THREE from 'three';
import type { CityDef } from '@/game/content';
import type { Rng } from '@/game/rng';
import { cylinder } from '@/engine/voxel';
import { Frame, type Builders } from './buildings';
import { acUnits, chimney, neonBlade, railing, waterTower } from './cityStyles';

export type LampKind = 'victorian' | 'cobra' | 'hk' | 'sf' | 'sg';

export interface StreetKit {
  /** Asphalt tint. */
  road: string;
  /** Centre line of each road. */
  centre: 'double-yellow' | 'white-dash';
  /** Lines along the kerb edges of the carriageway. */
  edge: 'white' | 'double-yellow' | 'yellow';
  /** Atlas layer and tint for the pavements. */
  pave: string;
  paveColor: string;
  kerb: string;
  lamp: LampKind;
}

export const KITS: Record<string, StreetKit> = {
  park: { road: '#5d6473', centre: 'white-dash', edge: 'white', pave: 'sidewalk', paveColor: '#d6d0c4', kerb: '#b8b4ac', lamp: 'victorian' },
  'new-york': { road: '#45494f', centre: 'double-yellow', edge: 'white', pave: 'pave-nyc', paveColor: '#c9c6bf', kerb: '#8f9294', lamp: 'cobra' },
  london: { road: '#4c4f55', centre: 'white-dash', edge: 'double-yellow', pave: 'pave-york', paveColor: '#cdc4b2', kerb: '#a5a197', lamp: 'victorian' },
  'hong-kong': { road: '#5b6067', centre: 'white-dash', edge: 'yellow', pave: 'pave-hk', paveColor: '#ffffff', kerb: '#cbc7ba', lamp: 'hk' },
  'san-francisco': { road: '#5f6369', centre: 'double-yellow', edge: 'white', pave: 'pave-sf', paveColor: '#dcd7cb', kerb: '#cdc8bc', lamp: 'sf' },
  singapore: { road: '#383b40', centre: 'white-dash', edge: 'double-yellow', pave: 'pave-sg', paveColor: '#ffffff', kerb: '#ecece6', lamp: 'sg' },
};

export const kitFor = (id: string) => KITS[id] ?? KITS.park;

const YELLOW = '#e6bd3a';
const WHITE = '#ecebe4';

/**
 * Road markings that differ by city: centre lines, kerb-side lines, London's red bus lane,
 * Hong Kong's yellow box junctions, San Francisco's cable-car tracks, Singapore's zig-zags.
 */
export function roadMarkings(def: CityDef, b: Builders, rng: Rng, inWater: (x: number, z: number, m?: number) => boolean) {
  const kit = kitFor(def.id);
  const roadW = def.roads.width;
  const xs = [...def.roads.xs].sort((a, c) => a - c);
  const zs = [...def.roads.zs].sort((a, c) => a - c);
  const H = def.half;
  const s = b.solid;
  const mark = (x: number, z: number, w: number, d: number, c: string) => s.box(x, 0.066, z, w, 0.02, d, c, { ao: false });

  // Runs of each road between junctions (markings stop short of the crossings)
  const runs: { along: 'x' | 'z'; c: number; a: number; b: number }[] = [];
  for (const rx of xs) {
    const cuts = [-H - roadW, ...zs, H + roadW];
    for (let i = 0; i < cuts.length - 1; i++) runs.push({ along: 'z', c: rx, a: cuts[i] + roadW / 2 + 3, b: cuts[i + 1] - roadW / 2 - 3 });
  }
  for (const rz of zs) {
    const cuts = [-H - roadW, ...xs, H + roadW];
    for (let i = 0; i < cuts.length - 1; i++) runs.push({ along: 'x', c: rz, a: cuts[i] + roadW / 2 + 3, b: cuts[i + 1] - roadW / 2 - 3 });
  }
  const line = (r: (typeof runs)[number], off: number, c: string, dash = 0) => {
    const len = r.b - r.a;
    if (len < 1) return;
    if (!dash) {
      const m = (r.a + r.b) / 2;
      if (r.along === 'z') mark(r.c + off, m, 0.13, len, c);
      else mark(m, r.c + off, len, 0.13, c);
      return;
    }
    for (let t = r.a + 1; t < r.b - dash; t += dash * 2) {
      if (r.along === 'z') mark(r.c + off, t + dash / 2, 0.15, dash, c);
      else mark(t + dash / 2, r.c + off, dash, 0.15, c);
    }
  };
  for (const r of runs) {
    const mid = r.along === 'z' ? { x: r.c, z: (r.a + r.b) / 2 } : { x: (r.a + r.b) / 2, z: r.c };
    if (inWater(mid.x, mid.z, 2)) continue;
    if (kit.centre === 'double-yellow') {
      line(r, -0.15, YELLOW);
      line(r, 0.15, YELLOW);
    } else line(r, 0, WHITE, 2.4);
    for (const side of [-1, 1]) {
      const off = side * (roadW / 2 - 0.35);
      if (kit.edge === 'white') line(r, off, WHITE);
      else if (kit.edge === 'yellow') line(r, off, YELLOW);
      else {
        line(r, off, YELLOW);
        line(r, off - side * 0.22, YELLOW);
      }
    }
  }

  // London: red bus lane down one side of the busiest road
  if (def.id === 'london' && xs.length) {
    const rx = xs[Math.floor(xs.length / 2)];
    for (const r of runs.filter((q) => q.along === 'z' && q.c === rx)) {
      if (r.b - r.a < 4) continue;
      s.box(rx + roadW / 4 + 0.1, 0.064, (r.a + r.b) / 2, roadW / 2 - 1.1, 0.02, r.b - r.a, '#9a3a32', { ao: false, tex: 'asphalt' });
      line(r, 0.6, WHITE);
    }
  }

  // Hong Kong: yellow criss-cross box junctions
  if (def.id === 'hong-kong')
    for (const ix of xs)
      for (const iz of zs) {
        if (inWater(ix, iz, 4)) continue;
        const h = roadW / 2 - 0.6;
        mark(ix, iz - h, h * 2, 0.15, YELLOW);
        mark(ix, iz + h, h * 2, 0.15, YELLOW);
        mark(ix - h, iz, 0.15, h * 2, YELLOW);
        mark(ix + h, iz, 0.15, h * 2, YELLOW);
        for (const sgn of [1, -1])
          for (let k = -h; k <= h; k += 2.2) {
            const m = new THREE.Matrix4().compose(new THREE.Vector3(ix + k, 0.067, iz), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (sgn * Math.PI) / 4, 0)), new THREE.Vector3(1, 1, 1));
            const len = (h - Math.abs(k)) * 2 * Math.SQRT2;
            if (len < 0.5) continue;
            s.geom(new THREE.BoxGeometry(0.13, 0.02, len), m, YELLOW);
          }
      }

  // San Francisco: cable-car tracks (two rails and the cable slot) up the middle avenue
  if (def.id === 'san-francisco' && xs.length) {
    const rx = xs[Math.floor(xs.length / 2)];
    for (const lane of [-roadW / 4, roadW / 4])
      for (const r of runs.filter((q) => q.along === 'z' && q.c === rx)) {
        const len = r.b - r.a + 6;
        const m = (r.a + r.b) / 2;
        for (const o of [-0.72, 0.72]) s.box(rx + lane + o, 0.067, m, 0.09, 0.02, len, '#8a8f96', { ao: false, tex: 'metal' });
        s.box(rx + lane, 0.067, m, 0.05, 0.02, len, '#1f2124', { ao: false });
      }
  }

  // Singapore: zig-zag lines on the approach to crossings
  if (def.id === 'singapore')
    for (const r of runs) {
      if (r.b - r.a < 14) continue;
      for (const end of [r.a, r.b - 8])
        for (const side of [-1, 1])
          for (let k = 0; k < 8; k += 1) {
            const t = end + k + 0.5;
            const off = side * (roadW / 2 - 0.9) + (k % 2 ? 0.25 : -0.25) * side;
            const rot = (k % 2 ? 1 : -1) * 0.45;
            const pos = r.along === 'z' ? new THREE.Vector3(r.c + off, 0.067, t) : new THREE.Vector3(t, 0.067, r.c + off);
            s.geom(new THREE.BoxGeometry(0.12, 0.02, 1.1), new THREE.Matrix4().compose(pos, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (r.along === 'z' ? 0 : Math.PI / 2) + rot, 0)), new THREE.Vector3(1, 1, 1)), WHITE);
          }
    }
  void rng;
}

/**
 * Kerb along one block edge (local frame: +Z faces the road, x runs along the edge).
 * Granite kerb stones everywhere, painted in local ways near the corners, and Hong Kong's
 * steel pedestrian railings.
 */
export function kerbEdge(cityId: string, f: Frame, len: number, rng: Rng) {
  const kit = kitFor(cityId);
  f.tb(0, 0, -0.18, len, 0.2, 0.36, kit.kerb, 'kerb', 'kerb');
  const corner = Math.min(5, len / 4);
  if (cityId === 'san-francisco')
    for (const sx of [-1, 1]) f.block((sx * (len - corner)) / 2, 0.2, -0.05, corner, 0.015, 0.12, '#c23b2e');
  if (cityId === 'singapore')
    for (const sx of [-1, 1])
      for (let t = 0; t < 6; t++) f.block(sx * (len / 2 - 0.25 - t * 0.5), 0.0, 0.005, 0.5, 0.2, 0.02, t % 2 ? '#f2f2ee' : '#1b1c1f');
  if (cityId === 'hong-kong' && len > 12) {
    // Railings along the kerb with gaps at the corners and in the middle
    const seg = (len - corner * 2 - 4) / 2;
    if (seg > 2) for (const sx of [-1, 1]) hkRailing(f, (sx * (seg + 4)) / 2, -0.5, seg);
  }
  if (cityId === 'london' && rng.chance(0.3)) {
    // Granite bollards at the corners
    for (const sx of [-1, 1]) f.geom(cylinder(0.14, 0.16, 0.9, 8), sx * (len / 2 - 1.2), 0.45, -0.6, '#2a2c2f');
  }
}

function hkRailing(f: Frame, x: number, z: number, len: number) {
  const steel = '#9aa3aa';
  f.block(x, 0.95, z, len, 0.06, 0.06, steel);
  f.block(x, 0.5, z, len, 0.05, 0.05, steel);
  for (let t = -len / 2; t <= len / 2 + 0.01; t += 2) f.block(x + t, 0, z, 0.07, 1.0, 0.07, steel);
  for (let t = -len / 2 + 0.25; t < len / 2; t += 0.5) f.block(x + t, 0.55, z, 0.02, 0.4, 0.02, steel);
}

/* ───────── Street lamps ───────── */

const lampCache = new Map<LampKind, THREE.BufferGeometry>();

/**
 * Lamp posts in each city's own style. All put their light at the same spot (0.9 m out on the
 * arm, about 4.2 m up) so the shared glow and light-pool code works for every kind.
 */
export function lampGeometry(kind: LampKind, build: (draw: (b: import('@/engine/voxel').VoxelBuilder) => void) => THREE.BufferGeometry) {
  const hit = lampCache.get(kind);
  if (hit) return hit;
  const g = build((b) => {
    const iron = '#2a2e2c';
    const box = (x: number, y: number, z: number, w: number, h: number, d: number, c: string) => b.box(x, y, z, w, h, d, c);
    const cyl = (rt: number, rb: number, h: number, y: number, c: string, x = 0, z = 0, seg = 8) => b.geom(cylinder(rt, rb, h, seg), new THREE.Matrix4().makeTranslation(x, y, z), c, 'metal');
    switch (kind) {
      case 'cobra': {
        // New York: tall grey steel pole, curved davit arm, flat "cobra head" luminaire
        cyl(0.11, 0.15, 6.2, 3.1, '#6e747a');
        cyl(0.2, 0.24, 0.5, 0.25, '#5a5f66');
        for (let k = 0; k < 6; k++) box(0, 6.1 - k * 0.32 + k * k * 0.03, 0.15 + k * 0.15, 0.09, 0.09, 0.2, '#6e747a');
        box(0, 4.4, 0.95, 0.42, 0.14, 0.75, '#6e747a');
        box(0, 4.31, 0.95, 0.3, 0.05, 0.6, '#f4ead0');
        break;
      }
      case 'hk': {
        // Hong Kong: slim grey pole with a long single arm and a box luminaire
        cyl(0.08, 0.12, 6.4, 3.2, '#8a9298');
        box(0, 6.35, 0.5, 0.08, 0.08, 1.0, '#8a9298');
        box(0, 4.42, 0.95, 0.36, 0.16, 0.5, '#7a8288');
        box(0, 4.32, 0.95, 0.28, 0.04, 0.4, '#fff1c6');
        box(0, 5.2, 0.48, 0.06, 2.0, 0.06, '#8a9298');
        break;
      }
      case 'sf': {
        // San Francisco: fluted green-black post with a ring of three globes (Market Street style)
        cyl(0.09, 0.13, 4.0, 2.0, '#22302a', 0, 0, 10);
        cyl(0.22, 0.28, 0.8, 0.4, '#22302a', 0, 0, 10);
        box(0, 4.1, 0.45, 0.07, 0.07, 1.0, '#22302a');
        b.geom(new THREE.SphereGeometry(0.22, 10, 8), new THREE.Matrix4().makeTranslation(0, 4.35, 0.95), '#f6efd8');
        b.geom(new THREE.SphereGeometry(0.18, 10, 8), new THREE.Matrix4().makeTranslation(0, 4.3, -0.45), '#f6efd8');
        box(0, 4.1, -0.25, 0.07, 0.07, 0.5, '#22302a');
        break;
      }
      case 'sg': {
        // Singapore: modern white pole curving into a slim LED blade
        cyl(0.09, 0.11, 5.4, 2.7, '#e9ece9');
        for (let k = 0; k < 5; k++) box(0, 5.3 - k * 0.22 + k * k * 0.02, 0.12 + k * 0.17, 0.08, 0.08, 0.22, '#e9ece9');
        box(0, 4.42, 0.95, 0.22, 0.06, 0.7, '#e9ece9');
        box(0, 4.38, 0.95, 0.16, 0.02, 0.6, '#eaf6ff');
        break;
      }
      case 'victorian':
      default: {
        // London and the park: cast-iron column, scroll arm, glazed lantern
        cyl(0.26, 0.32, 0.7, 0.35, iron, 0, 0, 10);
        cyl(0.2, 0.24, 0.12, 0.76, '#3a3f3c', 0, 0, 10);
        cyl(0.08, 0.12, 3.6, 2.6, iron);
        cyl(0.12, 0.12, 0.1, 4.4, iron);
        box(0, 4.42 + 0.035, 0.45, 0.07, 0.07, 0.95, iron);
        b.geom(new THREE.TorusGeometry(0.18, 0.025, 4, 10, Math.PI), new THREE.Matrix4().compose(new THREE.Vector3(0, 4.25, 0.25), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)), iron);
        box(0, 4.51, 0.9, 0.14, 0.18, 0.14, iron);
        box(0, 4.01, 0.9, 0.38, 0.06, 0.38, iron);
        box(0, 4.19, 0.9, 0.32, 0.3, 0.32, '#e8dcb0');
        b.geom(new THREE.ConeGeometry(0.3, 0.22, 4), new THREE.Matrix4().compose(new THREE.Vector3(0, 4.45, 0.9), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 4, 0)), new THREE.Vector3(1, 1, 1)), iron);
        break;
      }
    }
  });
  lampCache.set(kind, g);
  return g;
}

/* ───────── Enterable buildings in the local style ───────── */

/** Facade material for a building style, as that city would build it. */
const FACADES: Record<string, Record<string, string>> = {
  'new-york': { office: 'fac-loft', tower: 'fac-office', shop: 'fac-brownstone', restaurant: 'fac-brownstone', cafe: 'fac-brownstone', theater: 'fac-brick', market: 'fac-brick', warehouse: 'brick', kiosk: 'fac-brick' },
  london: { office: 'fac-georgian', tower: 'fac-stone', glass: 'fac-glass', shop: 'fac-rustic', market: 'brick', restaurant: 'fac-georgian', cafe: 'fac-georgian', kiosk: 'fac-rustic', boutique: 'fac-georgian' },
  'hong-kong': { office: 'fac-hk', tower: 'fac-hk', shop: 'fac-hk', market: 'fac-hk', restaurant: 'fac-hk', cafe: 'fac-hk', kiosk: 'fac-hk', warehouse: 'concrete' },
  'san-francisco': { office: 'fac-painted', cafe: 'fac-painted', shop: 'fac-painted', restaurant: 'fac-painted', warehouse: 'brick', kiosk: 'fac-siding' },
  singapore: { office: 'fac-eco', shop: 'fac-shophouse', kiosk: 'fac-shophouse', restaurant: 'fac-shophouse', cafe: 'fac-shophouse', market: 'fac-shophouse', civic: 'fac-stone' },
};

export function facadeFor(style: string, city: string | undefined, fallback: string) {
  return (city && FACADES[city]?.[style]) ?? fallback;
}

/** Rooftop and facade dressing that makes a building belong to its city. */
export function dressBuilding(city: string | undefined, f: Frame, b: Builders, w: number, d: number, h: number, style: string, rng: Rng) {
  if (!city || city === 'park') return;
  const glassy = style === 'glass' || style === 'tower' || style === 'campus';
  switch (city) {
    case 'new-york':
      if (!glassy && h > 7) waterTower(f, rng.range(-w / 4, w / 4), h + 0.6, rng.range(-d / 4, d / 4));
      if (!glassy && w > 10 && style !== 'bank' && style !== 'exchange' && style !== 'library') {
        // Fire escape down the side
        for (let y = 4; y < h - 2; y += 3.2) {
          f.block(w / 2 + 0.55, y, 0, 1.0, 0.07, 3, '#1f2224');
          railing(f, w / 2 + 1.05, 0, 3, 0.9, false);
        }
      }
      acUnits(f, w, d, h + 0.6, rng);
      break;
    case 'london':
      if (!glassy) {
        for (const sx of [-1, 1]) chimney(f, (sx * w) / 3, h + 0.6, -d / 4, rng.int(2, 4));
        // Slate mansard band
        f.tb(0, h + 0.6, 0, w - 0.4, 1.2, d - 0.4, '#4a5058', 'slate', 'slate');
      }
      break;
    case 'hong-kong':
      acUnits(f, w, d, h + 0.6, rng);
      acUnits(f, w, d, h + 0.6, rng);
      // Wall-mounted air conditioners on the street face
      for (let y = 4; y < h - 1; y += 3) for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += rng.range(2.5, 4.5)) if (rng.chance(0.55)) f.tb(x, y, d / 2 + 0.3, 0.9, 0.6, 0.6, '#d8dbde', 'metal', 'metal');
      if (!glassy && h > 6) neonBlade(f, b, w / 2 - 0.5, h * 0.55, d / 2 + 0.8, rng);
      // Rooftop billboard frame
      if (h > 10) {
        f.block(0, h + 0.6, -d / 4, w * 0.7, 0.2, 0.3, '#3a3f45');
        for (const sx of [-1, 1]) f.block((sx * w) / 3, h + 0.6, -d / 4, 0.2, 3.2, 0.2, '#3a3f45');
      }
      break;
    case 'san-francisco':
      if (!glassy && h < 16) {
        // Bay windows on the upper floors
        for (const sx of w > 10 ? [-w / 4, w / 4] : [0]) {
          f.tb(sx, 3.8, d / 2 + 0.45, 2.6, h - 5, 0.9, shadeHex('#f2ead8', 0.95), 'fac-painted', 'concrete');
          f.block(sx, h - 1.15, d / 2 + 0.5, 3.0, 0.3, 1.1, '#e9e2d0');
        }
      }
      break;
    case 'singapore':
      // Roof garden: planters, small trees and a row of solar panels
      for (let x = -w / 2 + 1.5; x < w / 2 - 1; x += 3) {
        f.tb(x, h + 0.6, d / 2 - 1.2, 2.4, 0.5, 0.9, '#c9c4b4', 'concrete', 'grass');
        f.geom(new THREE.SphereGeometry(0.7, 6, 5), x, h + 1.6, d / 2 - 1.2, '#3f7a3a', 0, 0, 0, 1, 'solid', 'leaves');
      }
      for (let x = -w / 2 + 2; x < w / 2 - 2; x += 2.2) f.geom(new THREE.BoxGeometry(1.8, 0.06, 1.2), x, h + 1.0, -d / 4, '#1f3a5a', -0.35, 0, 0, 1, 'solid', 'metal');
      break;
  }
}

function shadeHex(hex: string, k: number) {
  return '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
}

/* ───────── Street names ───────── */

/**
 * Street names for each city, west→east for the roads running north–south (`xs`) and
 * north→south for the roads running east–west (`zs`). Shown on corner signs and on the map.
 */
const STREET_NAMES: Record<string, { xs: string[]; zs: string[] }> = {
  park: { xs: ['Elm Walk', 'Fountain Way', 'Oak Walk', 'Maple Way'], zs: ['Lakeside Drive', 'Market Row', 'Garden Lane', 'Harbour Road'] },
  'new-york': { xs: ['7th Ave', '6th Ave', '5th Ave', 'Madison Ave', 'Park Ave', 'Lexington Ave', '3rd Ave'], zs: ['W 48th St', 'W 46th St', 'W 44th St', 'W 42nd St', 'W 40th St', 'W 38th St', 'W 36th St'] },
  london: { xs: ['Aldwych', 'Chancery Ln', 'Fetter Ln', 'Bow Ln', 'Bread St', 'King William St', 'Gracechurch St'], zs: ['High Holborn', 'Fleet St', 'Cheapside', 'Cornhill', 'Cannon St', 'Upper Thames St', 'Lombard St'] },
  'hong-kong': { xs: ['Pottinger St', 'Pedder St', 'Ice House St', 'Duddell St', 'Wyndham St', 'Lan Kwai Fong', 'Aberdeen St'], zs: ['Hollywood Rd', 'Wellington St', "Queen's Rd C", 'Des Voeux Rd C', 'Connaught Rd C', 'Harcourt Rd', 'Lockhart Rd'] },
  'san-francisco': { xs: ['Mason St', 'Powell St', 'Stockton St', 'Grant Ave', 'Kearny St', 'Montgomery St', 'Sansome St'], zs: ['Sutter St', 'Post St', 'Geary St', "O'Farrell St", 'Market St', 'Mission St', 'Howard St'] },
  singapore: { xs: ['Victoria St', 'North Bridge Rd', 'Beach Rd', 'Hill St', 'Stamford Rd', 'Armenian St', 'Queen St'], zs: ['Orchard Rd', 'Bras Basah Rd', 'Bencoolen St', 'Middle Rd', 'Raffles Ave', 'Coleman St', 'Esplanade Dr'] },
};

export function streetName(cityId: string, axis: 'xs' | 'zs', index: number) {
  const list = (STREET_NAMES[cityId] ?? STREET_NAMES.park)[axis];
  return list[index % list.length];
}

/** Colours of the street-name blades in each city. */
export const STREET_SIGN: Record<string, { bg: string; fg: string }> = {
  park: { bg: '#1e2840', fg: '#ffffff' },
  'new-york': { bg: '#1f6b3a', fg: '#ffffff' },
  london: { bg: '#f4f2ec', fg: '#1b1c1f' },
  'hong-kong': { bg: '#1f3f7a', fg: '#ffffff' },
  'san-francisco': { bg: '#2a6a46', fg: '#ffffff' },
  singapore: { bg: '#14524a', fg: '#ffffff' },
};
