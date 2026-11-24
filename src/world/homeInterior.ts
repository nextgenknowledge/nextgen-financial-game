/**
 * The built-in rooms of every home (layout in src/game/homePlan.ts), styled to suit where it is:
 * a cosy cottage, a London flat with a fireplace and dark green walls, a New York brick loft with
 * black steel stairs, a sleek Hong Kong apartment with red lanterns, a bright Singapore condo full
 * of plants, a light San Francisco studio, a white modern villa, and so on.
 */
import * as THREE from 'three';
import { VoxelBuilder, cylinder, trs } from '@/engine/voxel';
import { makeRng } from '@/game/rng';
import { STOREY, homePlan, type Fixture } from '@/game/homePlan';
import { armchair, bookcase, chair, pendant, plant, sofa, table } from './interiors/furnish';
import { furnitureGeometry } from './Furniture';

export interface HomeStyle {
  wall: string;
  wallTex: string;
  floor: string;
  floorColor: string;
  sofa: string;
  cabinet: string;
  counter: string;
  rug: string;
  stairs: string;
  rail: 'wood' | 'glass' | 'steel';
  fireplace?: boolean;
  beams?: boolean;
  lanterns?: boolean;
  plants?: number;
  books?: boolean;
  duvet: string;
}

const STYLES: Record<string, HomeStyle> = {
  'tiny-house': { wall: '#efe0c4', wallTex: 'stucco', floor: 'wood', floorColor: '#b07a4a', sofa: '#b5654a', cabinet: '#f4efe4', counter: '#8a6440', rug: '#c9a77a', stairs: '#8a5a34', rail: 'wood', plants: 2, duvet: '#d9653b' },
  cottage: { wall: '#f1e7d6', wallTex: 'stucco', floor: 'wood', floorColor: '#9a6a40', sofa: '#6a8a5a', cabinet: '#d9e4d0', counter: '#5a3e2b', rug: '#a8432f', stairs: '#6b4a30', rail: 'wood', fireplace: true, beams: true, plants: 3, duvet: '#c9a77a' },
  'family-home': { wall: '#e9eef2', wallTex: 'stucco', floor: 'wood', floorColor: '#b48a5a', sofa: '#3f5a7a', cabinet: '#ffffff', counter: '#9aa0a8', rug: '#c9b48a', stairs: '#8a6440', rail: 'wood', plants: 3, books: true, duvet: '#2f6bdb' },
  'modern-villa': { wall: '#f4f6fa', wallTex: 'concrete', floor: 'marble', floorColor: '#e6e8ea', sofa: '#e9e4da', cabinet: '#1f2226', counter: '#f4f6fa', rug: '#9aa0a8', stairs: '#1f2226', rail: 'glass', plants: 5, duvet: '#3a3f4a' },
  'sf-studio': { wall: '#f4f1ea', wallTex: 'stucco', floor: 'wood', floorColor: '#c9a87a', sofa: '#2ebaba', cabinet: '#f4f1ea', counter: '#c0362c', rug: '#e8b48a', stairs: '#c9a87a', rail: 'steel', plants: 4, duvet: '#2ebaba' },
  'london-flat': { wall: '#2f4a3a', wallTex: 'stucco', floor: 'wood', floorColor: '#7a4e2e', sofa: '#6b3a22', cabinet: '#e9e2d0', counter: '#3a3f4a', rug: '#8a2e2e', stairs: '#5a3e2b', rail: 'wood', fireplace: true, books: true, plants: 1, duvet: '#8a2e2e' },
  'ny-loft': { wall: '#b5654a', wallTex: 'brick', floor: 'wood', floorColor: '#6b4a30', sofa: '#3a2a20', cabinet: '#2a2f3d', counter: '#9aa0a8', rug: '#5a6a8a', stairs: '#1f2226', rail: 'steel', books: true, plants: 2, duvet: '#3a3f4a' },
  'hk-apartment': { wall: '#f4f6fa', wallTex: 'stucco', floor: 'marble', floorColor: '#ddd8cc', sofa: '#c9302c', cabinet: '#ffffff', counter: '#1f2226', rug: '#c9a24a', stairs: '#e9e4da', rail: 'glass', lanterns: true, plants: 2, duvet: '#c9302c' },
  'sg-condo': { wall: '#eef6f0', wallTex: 'stucco', floor: 'wood', floorColor: '#d9b98a', sofa: '#e8dcc0', cabinet: '#f4f1ea', counter: '#2a9d9e', rug: '#3f7a3a', stairs: '#d9b98a', rail: 'glass', plants: 7, duvet: '#2a9d9e' },
};

export function homeStyle(id: string): HomeStyle {
  return STYLES[id] ?? STYLES['tiny-house'];
}

export interface Collider {
  x: number;
  z: number;
  w: number;
  d: number;
  minY: number;
  maxY: number;
}

const shade = (hex: string, f: number) => '#' + new THREE.Color(hex).multiplyScalar(f).getHexString();
const STEEL = '#8d939c';
const WHITE = '#f4f4f0';

/** Builds the built-in rooms. `b`/`g`/`gl` are the ground builders (solid, glowing, glass). */
export function buildHomeInterior(id: string, room: { w: number; d: number; h: number }, b: VoxelBuilder, g: VoxelBuilder, gl: VoxelBuilder) {
  const st = homeStyle(id);
  const { w, d, h } = room;
  const p = homePlan(room);
  const rng = makeRng(id.length * 31 + w);
  const colliders: Collider[] = [];
  const hit = (f: { x: number; z: number; w: number; d: number }, minY: number, maxY: number) => colliders.push({ x: f.x, z: f.z, w: f.w, d: f.d, minY, maxY });
  // Upstairs is built at floor level, then lifted onto the mezzanine
  const u = new VoxelBuilder();
  const ug = new VoxelBuilder();
  const ugl = new VoxelBuilder();
  const Y = STOREY;

  // ── Mezzanine floor, its underside and lights under it ──
  // (drawn with the upstairs, which is lifted by a storey, so it hides with it in the planner view)
  const mzD = p.zM + d / 2;
  const mzZ = (-d / 2 + p.zM) / 2;
  u.box(0, -0.15, mzZ, w, 0.3, mzD, st.floorColor, { tex: st.floor, ao: false });
  u.box(0, -0.31, mzZ, w, 0.02, mzD, shade(st.wall === '#2f4a3a' ? '#e9e2d0' : st.wall, 1.02), { ao: false });
  u.box(0, -0.15, p.zM - 0.05, w, 0.34, 0.12, shade(st.floorColor, 0.8));
  colliders.push({ x: 0, z: mzZ, w, d: mzD, minY: Y - 0.32, maxY: Y });
  for (const x of [-w / 4, w / 4]) ug.box(x, -0.33, mzZ, 0.7, 0.02, 0.7, '#fff4d6');

  // ── Railing along the mezzanine's front edge (open where the stairs arrive) ──
  const s = p.stairs;
  const railX0 = s.x1 + 0.1;
  const railLen = w / 2 - railX0;
  const railCx = railX0 + railLen / 2;
  if (st.rail === 'glass') {
    ugl.box(railCx, 0.55, p.zM - 0.08, railLen, 1.0, 0.04, '#cfe2ee');
    u.box(railCx, 1.06, p.zM - 0.08, railLen, 0.06, 0.08, STEEL);
  } else {
    const c = st.rail === 'steel' ? '#1f2226' : st.stairs;
    u.box(railCx, 1.0, p.zM - 0.08, railLen, 0.08, 0.1, c);
    for (let x = railX0; x <= w / 2; x += st.rail === 'steel' ? 0.3 : 0.45) u.box(x, 0.5, p.zM - 0.08, 0.05, 1.0, 0.05, c);
  }
  colliders.push({ x: railCx, z: p.zM - 0.08, w: railLen, d: 0.2, minY: Y, maxY: Y + 1.1 });

  // ── Stairs up the left wall, rising toward the back ──
  const sx = (s.x0 + s.x1) / 2;
  const sw = s.x1 - s.x0;
  for (let k = 1; k <= s.steps; k++) {
    const z = s.z0 + (s.steps - k + 0.5) * s.run;
    const top = k * s.rise;
    if (st.rail === 'steel' && st.stairs === '#1f2226') {
      // Open steel stair: floating treads on a stringer
      b.box(sx, top - 0.04, z, sw, 0.08, s.run, '#3a3f4a', { tex: 'metal' });
    } else {
      b.box(sx, top / 2, z, sw, top, s.run, st.stairs, { tex: 'wood' });
      b.box(sx, top - 0.02, z + s.run / 2 - 0.03, sw + 0.02, 0.04, 0.06, shade(st.stairs, 0.8));
    }
    colliders.push({ x: sx, z, w: sw, d: s.run, minY: 0, maxY: top });
  }
  if (st.rail === 'steel' && st.stairs === '#1f2226') b.box(s.x1 - 0.05, Y / 2, s.z0 + (s.steps * s.run) / 2, 0.1, 0.2, s.steps * s.run, '#1f2226');
  // Handrail on the open side, sloping with the stairs
  const len = Math.hypot(s.steps * s.run, Y);
  const slope = Math.atan2(Y, s.steps * s.run);
  b.geom(new THREE.BoxGeometry(0.07, 0.07, len), new THREE.Matrix4().compose(new THREE.Vector3(s.x1 + 0.02, Y / 2 + 0.95, s.z0 + (s.steps * s.run) / 2), new THREE.Quaternion().setFromEuler(new THREE.Euler(slope, 0, 0)), new THREE.Vector3(1, 1, 1)), st.rail === 'glass' ? STEEL : st.rail === 'steel' ? '#1f2226' : shade(st.stairs, 0.85));
  for (let k = 2; k <= s.steps; k += 3) b.box(s.x1 + 0.02, k * s.rise + 0.47, s.z0 + (s.steps - k + 0.5) * s.run, 0.05, 0.95, 0.05, st.rail === 'wood' ? shade(st.stairs, 0.85) : STEEL);

  // ── Ground floor pieces ──
  const lz = p.ground.find((f) => f.id === 'sofa')!.z;
  for (const f of p.ground) {
    hit(f, 0, f.h);
    groundPiece(f);
  }
  function groundPiece(f: Fixture) {
    switch (f.id) {
      case 'counter': {
        b.box(f.x, 0.45, f.z, f.w, 0.9, f.d, st.cabinet, { tex: 'wood' });
        b.box(f.x, 0.93, f.z, f.w + 0.04, 0.06, f.d + 0.04, st.counter, { tex: 'marble' });
        for (let x = f.x - f.w / 2 + 0.3; x < f.x + f.w / 2; x += 0.6) b.box(x, 0.45, f.z + f.d / 2 + 0.01, 0.02, 0.8, 0.02, shade(st.cabinet, 0.8));
        // Sink with a tap, a hob with four burners, tiles and wall cupboards
        b.box(f.x - f.w / 4, 0.95, f.z, 0.7, 0.03, 0.45, '#c0c4cc', { tex: 'metal' });
        b.box(f.x - f.w / 4, 1.15, f.z - 0.25, 0.05, 0.35, 0.05, '#c0c4cc');
        b.box(f.x + f.w / 4, 0.965, f.z, 0.7, 0.02, 0.55, '#1e2026');
        for (const [ox, oz] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.13], [0.17, 0.13]]) g.box(f.x + f.w / 4 + ox, 0.98, f.z + oz, 0.18, 0.005, 0.18, '#ff6a3a');
        b.box(f.x, 1.5, -d / 2 + 0.03, f.w, 1.0, 0.04, shade(WHITE, 0.95), { tex: 'marble' });
        b.box(f.x, 2.3, -d / 2 + 0.2, f.w, 0.7, 0.38, st.cabinet, { tex: 'wood' });
        b.box(f.x + f.w / 4, 2.0, -d / 2 + 0.25, 0.8, 0.12, 0.45, '#c0c4cc', { tex: 'metal' }); // cooker hood
        break;
      }
      case 'fridge':
        b.box(f.x, 1.0, f.z, f.w, 2.0, f.d, '#d9dde3', { tex: 'metal' });
        b.box(f.x, 1.32, f.z + f.d / 2 + 0.01, f.w - 0.04, 0.02, 0.02, '#8d939c');
        b.box(f.x + f.w / 2 - 0.12, 1.0, f.z + f.d / 2 + 0.04, 0.04, 0.9, 0.05, '#8d939c');
        break;
      case 'island':
        b.box(f.x, 0.45, f.z, f.w, 0.9, f.d, st.cabinet, { tex: 'wood' });
        b.box(f.x, 0.93, f.z, f.w + 0.2, 0.06, f.d + 0.25, st.counter, { tex: 'marble' });
        for (const ox of [-0.75, 0, 0.75]) {
          b.geom(cylinder(0.2, 0.2, 0.08, 10), trs(f.x + ox, 0.72, f.z + f.d / 2 + 0.45), '#2a2f3d');
          b.box(f.x + ox, 0.36, f.z + f.d / 2 + 0.45, 0.05, 0.7, 0.05, STEEL);
        }
        b.box(f.x + 0.6, 1.0, f.z, 0.4, 0.12, 0.3, '#e8dcc0'); // fruit bowl
        break;
      case 'dining': {
        table(b, f.x, f.z, 1.8, 0.95, shade(st.floorColor, 0.85));
        for (const ox of [-0.55, 0.55]) {
          chair(b, f.x + ox, f.z - 0.75, 0, shade(st.sofa, 0.9), false);
          chair(b, f.x + ox, f.z + 0.75, Math.PI, shade(st.sofa, 0.9), false);
        }
        if (st.lanterns) {
          b.box(f.x, Y - 0.6, f.z, 0.02, 0.6, 0.02, '#2a2a2a');
          b.geom(cylinder(0.28, 0.28, 0.5, 10), trs(f.x, Y - 1.1, f.z), '#c9302c');
          g.box(f.x, Y - 1.1, f.z, 0.3, 0.3, 0.3, '#ffcf6a');
        } else pendant(b, g, f.x, f.z, Y - 0.32, 1.0, st.counter);
        break;
      }
      case 'tv': {
        const raise = st.fireplace ? 1.05 : 0;
        if (st.fireplace) {
          b.box(f.x, 0.6, f.z, 0.5, 1.2, 1.9, st.wall === '#2f4a3a' ? '#e9e2d0' : '#9a5a44', { tex: st.wall === '#2f4a3a' ? 'marble' : 'brick' });
          b.box(f.x - 0.2, 0.42, f.z, 0.15, 0.7, 1.1, '#1e2026');
          g.box(f.x - 0.22, 0.25, f.z, 0.1, 0.25, 0.8, '#ff7a2f');
          b.box(f.x - 0.05, 1.22, f.z, 0.7, 0.08, 2.1, shade(st.floorColor, 0.7));
        }
        const tv = furnitureGeometry('tv');
        const m = trs(f.x, raise, f.z, 0, -Math.PI / 2, 0);
        b.geom(tv.solid, m, null);
        if (tv.glow) g.geom(tv.glow, m, null);
        break;
      }
      case 'sofa': {
        b.box(f.x + 1.3, 0.012, f.z, 3.6, 0.02, 3.2, st.rug, { ao: false });
        sofa(b, f.x, f.z, f.rot, st.sofa, 2.4);
        break;
      }
      case 'armchair':
        armchair(b, f.x, f.z, f.rot, st.sofa);
        break;
      case 'coffee':
        b.box(f.x, 0.4, f.z, f.w, 0.06, f.d, shade(st.floorColor, 0.75), { tex: 'wood' });
        for (const [ox, oz] of [[-0.28, -0.5], [0.28, -0.5], [-0.28, 0.5], [0.28, 0.5]]) b.box(f.x + ox, 0.19, f.z + oz, 0.06, 0.38, 0.06, shade(st.floorColor, 0.6));
        b.box(f.x, 0.46, f.z + 0.2, 0.3, 0.06, 0.22, '#e9e4da');
        break;
    }
  }

  // ── Upstairs ──
  for (const f of p.upper) {
    hit(f, Y, Y + f.h);
    switch (f.id) {
      case 'bed': {
        const bed = furnitureGeometry('bed');
        u.geom(bed.solid, trs(f.x, 0, f.z), null);
        u.box(f.x, 0.73, f.z + 0.35, 1.74, 0.02, 1.5, st.duvet, { ao: false });
        u.box(f.x, 0.012, f.z + 1.6, 2.6, 0.02, 1.4, st.rug, { ao: false });
        u.box(f.x, 1.7, -d / 2 + 0.06, 1.3, 0.85, 0.05, '#2a2a2a');
        u.box(f.x, 1.7, -d / 2 + 0.09, 1.15, 0.7, 0.02, rng.pick(['#9cc8e8', '#e8b48a', '#b9d4e8']));
        break;
      }
      case 'nightstand':
        u.box(f.x, 0.3, f.z, f.w, 0.6, f.d, shade(st.floorColor, 0.8), { tex: 'wood' });
        u.box(f.x, 0.75, f.z, 0.08, 0.3, 0.08, '#2a2a2a');
        ug.box(f.x, 0.98, f.z, 0.3, 0.22, 0.3, '#fff1c4');
        break;
      case 'wardrobe':
        u.box(f.x, f.h / 2, f.z, f.w, f.h, f.d, st.cabinet === '#1f2226' ? '#2a2f3d' : shade(st.cabinet, 0.95), { tex: 'wood' });
        u.box(f.x, f.h / 2, f.z + f.d / 2 + 0.01, 0.02, f.h - 0.1, 0.02, '#5a606b');
        for (const ox of [-0.12, 0.12]) u.box(f.x + ox, f.h / 2, f.z + f.d / 2 + 0.03, 0.04, 0.3, 0.03, '#c0c4cc');
        break;
      case 'desk': {
        const desk = furnitureGeometry('desk');
        u.geom(desk.solid, trs(f.x, 0, f.z, 0, Math.PI, 0), null);
        if (desk.glow) ug.geom(desk.glow, trs(f.x, 0, f.z, 0, Math.PI, 0), null);
        chair(u, f.x, f.z - 0.7, 0, '#2f3138');
        break;
      }
      case 'partition':
        u.box(f.x, f.h / 2, f.z, f.w, f.h, f.d, shade(st.wall === '#b5654a' ? '#e9e4da' : st.wall, 1.0), { tex: 'stucco' });
        break;
      case 'tub':
        u.box(f.x, 0.3, f.z, f.w, 0.6, f.d, WHITE);
        ugl.box(f.x, 0.5, f.z, f.w - 0.2, 0.02, f.d - 0.2, '#7fc4e8');
        u.box(f.x - f.w / 2 + 0.2, 1.4, -d / 2 + 0.08, 0.12, 0.12, 0.12, '#c0c4cc');
        u.box(f.x, 1.2, -d / 2 + 0.03, f.w, 1.6, 0.03, shade(WHITE, 0.92), { tex: 'marble' });
        break;
      case 'toilet':
        u.box(f.x, 0.22, f.z, 0.5, 0.44, 0.6, WHITE);
        u.box(f.x + 0.2, 0.6, f.z, 0.2, 0.6, 0.5, WHITE);
        break;
      case 'vanity':
        u.box(f.x, 0.42, f.z, f.w, 0.84, f.d, st.cabinet, { tex: 'wood' });
        u.box(f.x - 0.05, 0.88, f.z, 0.42, 0.06, 0.5, WHITE);
        ugl.box(w / 2 - 0.04, 1.6, f.z, 0.02, 0.8, 0.7, '#cfe2ee');
        break;
      case 'shelf':
        bookcase(u, rng, f.x, f.z, 0, f.w);
        break;
    }
  }

  // ── Touches of style ──
  // Plants in the corners (and lots of them in Singapore)
  const spots: [number, number, boolean][] = [
    [w / 2 - 0.6, lz + 1.75, true],
    [-w / 2 + 2.2, d / 2 - 0.8, true],
    [w / 2 - 0.6, d / 2 - 0.8, false],
    [railX0 + 1.0, p.zM - 0.5, false],
    [w / 2 - 3.8, p.zM - 0.6, false],
    [-w / 2 + 2.3, d / 2 - 1.8, false],
    [w / 2 - 0.6, p.zM + 0.6, true],
  ];
  spots.slice(0, st.plants ?? 2).forEach(([x, z, big], i) => {
    const up = i === 3 || i === 4;
    plant(up ? u : b, x, z, big);
    colliders.push({ x, z, w: 0.7, d: 0.7, minY: up ? Y : 0, maxY: (up ? Y : 0) + 1.5 });
  });
  if (st.books) {
    // Bookshelves along the left wall upstairs, above the stairs' landing
    bookcase(u, rng, -w / 2 + 0.28, p.zM - 2.4, Math.PI / 2, 1.4);
    colliders.push({ x: -w / 2 + 0.28, z: p.zM - 2.4, w: 0.5, d: 1.4, minY: Y, maxY: Y + 2 });
  }
  // Ceiling beams and hanging lanterns go with the upstairs layer (lifted a storey), so they hide
  // with it when you arrange furniture from above
  const top = h - Y;
  if (st.beams) for (let z = -d / 2 + 1; z < d / 2; z += 2) u.box(0, top - 0.18, z, w, 0.3, 0.25, '#5a3e2b', { tex: 'wood' });
  if (st.lanterns) for (const x of [-w / 6, w / 6]) {
    u.box(x, top - 0.6, (p.zM + d / 2) / 2, 0.02, 1.2, 0.02, '#2a2a2a');
    u.geom(cylinder(0.32, 0.32, 0.55, 10), trs(x, top - 1.4, (p.zM + d / 2) / 2), '#c9302c');
    ug.box(x, top - 1.4, (p.zM + d / 2) / 2, 0.34, 0.34, 0.34, '#ffcf6a');
  }
  // Big picture on the left wall above the stairs
  b.box(-w / 2 + 0.06, Y + 1.3, s.z0 + 2.4, 0.05, 1.2, 1.8, '#2a2a2a');
  b.box(-w / 2 + 0.09, Y + 1.3, s.z0 + 2.4, 0.02, 1.0, 1.6, rng.pick(['#3a6a8a', '#8a5a3a', '#5a8a4a']));

  return { upper: { solid: u.build(), glow: ug.build(), glass: ugl.build() }, colliders, plan: p };
}
