/**
 * Landmark portals. Every destination has one object that stands for the whole place, built big
 * enough to walk into: London's red telephone box, a New York yellow cab with its door open, a
 * Hong Kong double-decker tram, a Golden Gate Bridge tower, a pair of Singapore Supertrees, and a
 * giant Fin City coin for the way home. The portal swirl fills the doorway of each.
 *
 * Local frame: +Z faces the approach (where you walk in from), the doorway is at z = 0 and the
 * body of the object is built behind it.
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, sphere, trs } from '@/engine/voxel';

export type PortalShape = 'rect' | 'arch' | 'circle';

export interface PortalKind {
  build: (b: VoxelBuilder, g: VoxelBuilder) => void;
  /** Swirl doorway: centre height, size and outline shape. */
  swirl: { y: number; w: number; h: number; shape: PortalShape; z?: number };
  /** Name-plate position (above or below the doorway). */
  plate: { y: number; z: number; w: number };
  /** Solid parts (local x, z, width, depth, height) the player can't walk through. */
  colliders: [number, number, number, number, number][];
}

const GLASS = '#9fc4d8';
const DARK_GLASS = '#3a4a5a';

/* ───────── London: K6 telephone kiosk ───────── */

const RED = '#c4202f';
const phonebox: PortalKind = {
  build: (b, g) => {
    const W = 4.6;
    const H = 10.2;
    const D = 4.6;
    const zc = -D / 2;
    b.block(0, 0, zc, W + 0.8, 0.35, D + 0.8, '#b9b2a2', { tex: 'stone' });
    // Corner posts and the rails between the glazed panels
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.block((sx * (W - 0.5)) / 2, 0.35, zc + (sz * (D - 0.5)) / 2, 0.5, H - 1.6, 0.5, RED);
    // Side and back walls: a grid of small panes in red glazing bars
    const walls: [number, number, number, boolean][] = [
      [-W / 2 + 0.06, zc, D - 1.0, false],
      [W / 2 - 0.06, zc, D - 1.0, false],
      [0, zc - D / 2 + 0.06, W - 1.0, true],
    ];
    for (const [x, z, len, alongX] of walls) {
      b.block(x, 0.35, z, alongX ? len : 0.14, 1.2, alongX ? 0.14 : len, RED);
      g.block(x, 1.6, z, alongX ? len : 0.08, H - 3.4, alongX ? 0.08 : len, GLASS);
      for (let k = 0; k <= 3; k++) {
        const t = -len / 2 + (len * k) / 3;
        b.block(alongX ? x + t : x, 1.55, alongX ? z : z + t, alongX ? 0.16 : 0.18, H - 3.3, alongX ? 0.18 : 0.16, RED);
      }
      for (let r = 0; r <= 8; r++) b.block(x, 1.55 + (r * (H - 3.3)) / 8, z, alongX ? len : 0.18, 0.12, alongX ? 0.18 : len, RED);
    }
    // Front: open doorway frame
    b.block(0, H - 1.65, 0, W - 0.5, 0.4, 0.5, RED);
    // Crown: the "TELEPHONE" fascia (lit panels) and the domed roof
    b.block(0, H - 1.25, zc, W + 0.1, 0.9, D + 0.1, RED);
    for (const [x, z, w, d] of [[0, 0.06, W - 0.8, 0.04], [0, -D - 0.06, W - 0.8, 0.04], [-W / 2 - 0.06, zc, 0.04, D - 0.8], [W / 2 + 0.06, zc, 0.04, D - 0.8]]) g.block(x, H - 1.05, z, w, 0.5, d, '#f2f0e6');
    b.block(0, H - 0.35, zc, W + 0.3, 0.3, D + 0.3, RED);
    b.geom(cylinder(W * 0.36, W * 0.62, 1.1, 24), trs(0, H + 0.4, zc), RED);
    b.geom(sphere(W * 0.37, 20, 10), new THREE.Matrix4().compose(new THREE.Vector3(0, H + 0.95, zc), new THREE.Quaternion(), new THREE.Vector3(1, 0.35, 1)), RED);
    // Crown emblem
    for (const z of [0.05, -D - 0.05]) b.block(0, H - 0.05, z, 0.8, 0.5, 0.1, '#d9b04a');
  },
  swirl: { y: 4.6, w: 3.4, h: 7.8, shape: 'rect', z: 0.1 },
  plate: { y: 0.9, z: 1.4, w: 4.2 },
  colliders: [
    [-2.2, -2.3, 0.5, 4.6, 10],
    [2.2, -2.3, 0.5, 4.6, 10],
    [0, -4.5, 4.6, 0.5, 10],
  ],
};

/* ───────── New York: yellow cab, rear door open ───────── */

const CAB = '#ffc61a';
const taxi: PortalKind = {
  build: (b, g) => {
    // Car built side-on: length along x, the open door on the +z side
    const L = 13;
    const Wd = 5.2;
    const zc = -Wd / 2;
    b.block(0, 1.0, zc, L, 2.4, Wd, CAB);
    b.block(L / 2 - 1.6, 3.4, zc, 3.2, 0.25, Wd - 0.2, CAB);
    b.block(-L / 2 + 1.4, 3.4, zc, 2.8, 0.25, Wd - 0.2, CAB);
    // Cabin with windows and pillars
    b.block(-0.3, 3.4, zc, 7.2, 2.6, Wd - 0.4, CAB);
    g.block(-0.3, 3.7, zc, 7.3, 1.9, Wd - 0.6, DARK_GLASS);
    for (const x of [-3.9, -0.3, 3.3]) b.block(x, 3.6, zc, 0.35, 2.4, Wd - 0.3, CAB);
    b.block(-0.3, 6.0, zc, 7.0, 0.3, Wd - 0.4, CAB);
    // Roof light "TAXI"
    b.block(-0.3, 6.3, zc, 2.4, 0.7, 0.9, '#f4f0e0');
    // Bumpers, lights, grille
    for (const sx of [-1, 1]) {
      b.block((sx * (L + 0.3)) / 2, 0.8, zc, 0.3, 0.6, Wd + 0.1, '#c9ccd1', { tex: 'metal' });
      for (const sz of [-1, 1]) g.block((sx * (L + 0.05)) / 2, 2.4, zc + (sz * (Wd - 1.2)) / 2, 0.06, 0.5, 0.9, sx > 0 ? '#fff6d8' : '#e0453a');
    }
    // Wheels
    for (const x of [-L / 2 + 2.4, L / 2 - 2.4])
      for (const z of [0, -Wd]) {
        b.geom(cylinder(1.25, 1.25, 0.9, 18), trs(x, 1.25, z, Math.PI / 2), '#1d1f22');
        b.geom(cylinder(0.6, 0.6, 0.95, 12), trs(x, 1.25, z, Math.PI / 2), '#b9bec4', 'metal');
      }
    // Checker band, door handle and the door number
    for (let x = -L / 2 + 0.3; x < L / 2 - 0.3; x += 0.6) b.block(x, 2.95, 0.02, 0.3, 0.3, 0.04, Math.round(x / 0.6) % 2 ? '#1b1b1b' : '#f4f0e0');
    // The rear door: opening in the side, with the door itself swung out
    b.block(0, 0.9, 0.04, 3.9, 0.25, 0.1, '#1b1b1b');
    for (const sx of [-1, 1]) b.block(sx * 1.9, 0.9, 0.0, 0.2, 5.0, 0.15, '#1b1b1b');
    b.block(2.2, 0.95, 1.5, 0.35, 4.8, 2.9, CAB);
    g.block(2.18, 3.6, 1.5, 0.37, 1.8, 2.3, DARK_GLASS);
  },
  swirl: { y: 3.3, w: 3.5, h: 4.6, shape: 'rect', z: 0.08 },
  plate: { y: 7.6, z: -2.6, w: 4.4 },
  colliders: [
    [0, -2.6, 13, 5.2, 6.5],
    [2.2, 1.5, 0.4, 2.9, 5],
  ],
};

/* ───────── Hong Kong: double-decker tram ───────── */

const TRAM_GREEN = '#2f6b3a';
const TRAM_CREAM = '#efe6cc';
const tram: PortalKind = {
  build: (b, g) => {
    const L = 12;
    const Wd = 4.6;
    const zc = -Wd / 2;
    b.block(0, 0.5, zc, L, 1.2, Wd, '#2a2c2f');
    b.block(0, 1.7, zc, L, 3.4, Wd, TRAM_GREEN);
    b.block(0, 5.1, zc, L, 0.5, Wd, TRAM_CREAM);
    b.block(0, 5.6, zc, L - 0.2, 3.0, Wd - 0.1, TRAM_GREEN);
    b.block(0, 8.6, zc, L - 0.6, 0.45, Wd - 0.4, TRAM_CREAM);
    b.block(0, 9.05, zc, L - 1.4, 0.25, Wd - 1.0, '#8a8f96');
    // Window bands, both decks, both sides
    for (const z of [0.02, -Wd - 0.02])
      for (let x = -L / 2 + 0.9; x < L / 2 - 0.6; x += 1.5) {
        g.block(x + 0.55, 6.0, z, 1.15, 1.9, 0.06, GLASS);
        if (z < 0 || x + 0.55 < -2.3 || x + 0.55 > 2.3) g.block(x + 0.55, 2.7, z, 1.15, 1.7, 0.06, GLASS);
      }
    // Destination boards at the ends and the trolley pole
    for (const sx of [-1, 1]) {
      g.block((sx * (L + 0.05)) / 2, 7.9, zc, 0.06, 0.55, 2.4, '#1b1b1b');
      g.block((sx * (L + 0.08)) / 2, 7.9, zc, 0.06, 0.35, 2.0, '#f2c94c');
      g.block((sx * (L + 0.05)) / 2, 6.0, zc, 0.06, 1.9, 3.6, GLASS);
    }
    b.geom(new THREE.BoxGeometry(0.15, 0.15, 7), new THREE.Matrix4().compose(new THREE.Vector3(1, 11.0, zc), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0.45)), new THREE.Vector3(1, 1, 1)), '#3a3f45');
    // Ad panel along the upper deck
    b.block(-3.8, 4.2, 0.03, 3.6, 0.8, 0.06, '#c4202f');
    // Bogies
    for (const x of [-L / 2 + 2, L / 2 - 2]) b.block(x, 0, zc, 3, 0.6, Wd - 0.6, '#1d1f22');
    // Door frame for the doorway
    for (const sx of [-1, 1]) b.block(sx * 1.6, 1.7, 0.02, 0.25, 3.6, 0.15, '#1b1b1b');
  },
  swirl: { y: 3.3, w: 2.9, h: 3.3, shape: 'rect', z: 0.08 },
  plate: { y: 10.4, z: -2.3, w: 4.4 },
  colliders: [[0, -2.3, 12, 4.6, 9.5]],
};

/* ───────── San Francisco: Golden Gate tower ───────── */

const GG = '#e2512f'; // International Orange
const ggTower: PortalKind = {
  build: (b) => {
    const H = 16;
    for (const sx of [-1, 1]) {
      // Stepped legs with recessed panels, wider at the base
      b.block(sx * 3.8, 0, -1.2, 2.2, H, 2.4, GG);
      b.block(sx * 3.8, 0, -1.2, 2.6, 3, 2.8, GG);
      for (let y = 3.5; y < H - 1; y += 2.2) b.block(sx * 3.8, y, -0.0, 1.4, 1.4, 0.1, '#b8402a');
      b.block(sx * 3.8, 0, -1.2, 3.0, 0.4, 3.2, '#9a958a', { tex: 'concrete' });
    }
    // Portal braces between the legs, the top one shaped like the real tower's arch
    for (const y of [8.6, 12.6]) b.block(0, y, -1.2, 5.6, 1.0, 1.8, GG);
    b.block(0, H - 1.3, -1.2, 9.8, 1.3, 2.6, GG);
    b.block(0, H, -1.2, 8.6, 0.5, 2.2, GG);
    // Main cables sweeping down to either side, with vertical suspenders
    for (const sx of [-1, 1]) {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 14; k++) {
        const t = k / 14;
        pts.push([sx * (4.4 + t * 11), H + 0.2 - Math.pow(t, 0.75) * (H - 1.4)]);
      }
      for (let k = 0; k < pts.length - 1; k++) {
        const [x0, y0] = pts[k];
        const [x1, y1] = pts[k + 1];
        const len = Math.hypot(x1 - x0, y1 - y0);
        b.geom(new THREE.BoxGeometry(len + 0.05, 0.24, 0.24), new THREE.Matrix4().compose(new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, -1.2), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.atan2(y1 - y0, x1 - x0))), new THREE.Vector3(1, 1, 1)), GG);
        if (k > 0) b.block(x0, 0, -1.2, 0.07, y0, 0.07, '#b8402a');
      }
    }
    // Red aviation lights on top
    for (const sx of [-1, 1]) b.block(sx * 3.8, H + 0.5, -1.2, 0.3, 0.3, 0.3, '#ff3b2f');
  },
  swirl: { y: 4.1, w: 5.2, h: 8.0, shape: 'arch', z: -0.2 },
  plate: { y: 10.2, z: 0.2, w: 4.6 },
  colliders: [
    [-3.8, -1.2, 2.8, 2.8, 16],
    [3.8, -1.2, 2.8, 2.8, 16],
  ],
};

/* ───────── Singapore: Supertrees and skyway ───────── */

const supertrees: PortalKind = {
  build: (b, g) => {
    for (const sx of [-1, 1]) {
      const x = sx * 4.4;
      // Trunk wrapped in planting, flaring out into the canopy funnel
      b.geom(cylinder(0.75, 1.3, 11, 12), trs(x, 5.5, -1), '#9a7ab0');
      for (let y = 1; y < 10.5; y += 1.5) b.geom(cylinder(0.95 - y * 0.02, 1.0 - y * 0.02, 0.4, 12), trs(x, y, -1), y % 3 < 1.5 ? '#6fbf4a' : '#e070c0');
      b.geom(cylinder(4.2, 0.9, 3.4, 16), trs(x, 12.6, -1), '#b07ac8');
      for (let a = 0; a < 16; a++) {
        const an = (a / 16) * Math.PI * 2;
        b.geom(new THREE.BoxGeometry(0.12, 3.6, 0.12), new THREE.Matrix4().compose(new THREE.Vector3(x + Math.cos(an) * 2.6, 12.6, -1 + Math.sin(an) * 2.6), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(an) * 0.75, 0, -Math.cos(an) * 0.75)), new THREE.Vector3(1, 1, 1)), '#7a5a90');
        g.block(x + Math.cos(an) * 4.1, 14.25, -1 + Math.sin(an) * 4.1, 0.18, 0.18, 0.18, a % 2 ? '#c77dff' : '#7dd3ff');
      }
    }
    // OCBC skyway between them
    b.block(0, 9.2, -1, 7.6, 0.35, 1.6, '#e9ece9');
    for (const sz of [-1, 1]) b.block(0, 9.55, -1 + sz * 0.75, 7.6, 0.9, 0.06, '#b9c2c4');
    g.block(0, 9.15, -1, 7.4, 0.05, 1.4, '#eaf6ff');
  },
  swirl: { y: 4.2, w: 5.2, h: 7.6, shape: 'arch', z: -0.4 },
  plate: { y: 0.9, z: 1.6, w: 4.6 },
  colliders: [
    [-4.4, -1, 2.6, 2.6, 12],
    [4.4, -1, 2.6, 2.6, 12],
  ],
};

/* ───────── Fin City Park: the giant coin ───────── */

const coin: PortalKind = {
  build: (b, g) => {
    const R = 5.8;
    const cy = R + 0.2;
    // Coin ring standing on edge: thick rim, inner bevel, raised border dots
    b.geom(new THREE.TorusGeometry(R - 1.3, 1.3, 10, 40), trs(0, cy, -0.6), '#d9a92a', 'metal');
    b.geom(new THREE.TorusGeometry(R - 0.25, 0.35, 6, 48), trs(0, cy, -0.6), '#f2c94c', 'metal');
    b.geom(new THREE.TorusGeometry(R - 2.45, 0.22, 6, 40), trs(0, cy, -0.6), '#b8861f', 'metal');
    for (let a = 0; a < 28; a++) {
      const an = (a / 28) * Math.PI * 2;
      for (const z of [0.75, -1.95]) g.block(Math.cos(an) * (R - 1.25), cy + Math.sin(an) * (R - 1.25) - 0.1, -0.6 + z, 0.25, 0.25, 0.08, '#fff1b0');
    }
    // Plinth and steps
    b.block(0, 0, -0.6, 9, 0.25, 4, '#cfc8b8', { tex: 'stone' });
    b.block(0, 0, 1.8, 6, 0.12, 1.2, '#cfc8b8', { tex: 'stone' });
  },
  swirl: { y: 6.0, w: 7.6, h: 7.6, shape: 'circle', z: -0.6 },
  plate: { y: 12.9, z: -0.6, w: 4.6 },
  colliders: [
    [-4.9, -0.6, 1.9, 2.6, 8],
    [4.9, -0.6, 1.9, 2.6, 8],
  ],
};

export const PORTAL_KINDS: Record<string, PortalKind> = {
  london: phonebox,
  'new-york': taxi,
  'hong-kong': tram,
  'san-francisco': ggTower,
  singapore: supertrees,
  park: coin,
};

export const portalKind = (to: string) => PORTAL_KINDS[to] ?? coin;

const cache = new Map<string, { solid: THREE.BufferGeometry; glow: THREE.BufferGeometry }>();
export function portalGeometry(to: string) {
  const hit = cache.get(to);
  if (hit) return hit;
  const b = new VoxelBuilder();
  const g = new VoxelBuilder();
  portalKind(to).build(b, g);
  const out = { solid: b.build(), glow: g.build() };
  cache.set(to, out);
  return out;
}
