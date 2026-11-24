/**
 * Every home is two storeys: a mezzanine across the back holds the bedroom and bathroom, the
 * kitchen and dining table sit under it, and the front is a double-height living room with stairs
 * up the left wall. This is the pure layout (sizes in metres, room centred on 0,0, door at +z);
 * src/world/HomeScene.tsx draws it in each home's style. Your own furniture goes in the free
 * floor space round the built-in pieces.
 */

/** Height of one storey; the mezzanine floor is at this height. */
export const STOREY = 3.4;

export interface Fixture {
  id: 'counter' | 'fridge' | 'island' | 'dining' | 'tv' | 'sofa' | 'armchair' | 'coffee' | 'bed' | 'nightstand' | 'wardrobe' | 'desk' | 'tub' | 'toilet' | 'vanity' | 'partition' | 'shelf';
  x: number;
  z: number;
  /** Footprint along the world x and z axes (already turned), and height. */
  w: number;
  d: number;
  h: number;
  /** Which way it faces (radians, 0 = +z toward the door). */
  rot: number;
}

export interface HomePlan {
  /** z of the mezzanine's front edge (it runs from the back wall to here). */
  zM: number;
  stairs: { x0: number; x1: number; z0: number; steps: number; rise: number; run: number };
  ground: Fixture[];
  upper: Fixture[];
}

export function homePlan(room: { w: number; d: number }): HomePlan {
  const { w, d } = room;
  const mz = Math.max(3.8, Math.round(d * 0.42 * 10) / 10);
  const zM = -d / 2 + mz;
  const steps = 12;
  const run = Math.min(0.45, (d / 2 - 0.6 - zM) / steps);
  const stairs = { x0: -w / 2 + 0.15, x1: -w / 2 + 1.45, z0: zM, steps, rise: STOREY / steps, run };

  const kx0 = -w / 2 + 1.8;
  const klen = Math.min(5.2, w * 0.4);
  const lz = (zM + d / 2 - 2.4) / 2; // middle of the living room, clear of the doorway
  const ground: Fixture[] = [
    { id: 'counter', x: kx0 + klen / 2, z: -d / 2 + 0.4, w: klen, d: 0.75, h: 1.0, rot: 0 },
    { id: 'fridge', x: kx0 + klen + 0.55, z: -d / 2 + 0.45, w: 0.9, d: 0.8, h: 2.0, rot: 0 },
    { id: 'island', x: kx0 + klen / 2, z: -d / 2 + 2.4, w: 2.4, d: 0.95, h: 1.0, rot: 0 },
    { id: 'dining', x: w / 4 + 0.6, z: -d / 2 + mz / 2 + 0.2, w: 2.4, d: 1.9, h: 1.0, rot: 0 },
    { id: 'tv', x: w / 2 - 0.35, z: lz, w: 0.6, d: 2.4, h: 1.8, rot: -Math.PI / 2 },
    { id: 'sofa', x: w / 2 - 3.7, z: lz, w: 1.0, d: 2.5, h: 0.95, rot: Math.PI / 2 },
    { id: 'coffee', x: w / 2 - 2.3, z: lz, w: 0.7, d: 1.2, h: 0.45, rot: 0 },
    { id: 'armchair', x: w / 2 - 2.2, z: lz + 1.95, w: 1.1, d: 1.0, h: 1.0, rot: Math.PI },
  ];
  const upper: Fixture[] = [
    { id: 'wardrobe', x: -w / 2 + 2.6, z: -d / 2 + 0.35, w: 1.8, d: 0.6, h: 2.2, rot: 0 },
    { id: 'bed', x: -w / 2 + 5.0, z: -d / 2 + 1.25, w: 1.8, d: 2.3, h: 1.1, rot: 0 },
    { id: 'nightstand', x: -w / 2 + 6.3, z: -d / 2 + 0.35, w: 0.5, d: 0.5, h: 0.6, rot: 0 },
    { id: 'desk', x: -w / 2 + 5.0, z: zM - 0.9, w: 1.6, d: 0.8, h: 1.3, rot: 0 },
    { id: 'partition', x: w / 2 - 3.4, z: -d / 2 + (mz - 1.5) / 2, w: 0.15, d: mz - 1.5, h: 2.6, rot: 0 },
    { id: 'tub', x: w / 2 - 1.7, z: -d / 2 + 0.5, w: 2.6, d: 0.95, h: 0.6, rot: 0 },
    { id: 'toilet', x: w / 2 - 0.45, z: -d / 2 + 2.1, w: 0.6, d: 0.7, h: 0.8, rot: -Math.PI / 2 },
    { id: 'vanity', x: w / 2 - 0.35, z: -d / 2 + 3.0, w: 0.55, d: 1.0, h: 0.9, rot: -Math.PI / 2 },
  ];
  // Bigger homes get a bookshelf by the stairs' landing
  if (w >= 16) upper.push({ id: 'shelf', x: -w / 2 + 8.0, z: -d / 2 + 0.3, w: 1.4, d: 0.45, h: 2.0, rot: 0 });
  return { zM, stairs, ground, upper };
}

/** Whether a ground-floor rectangle overlaps a built-in piece or the stairs (for placing your furniture). */
export function hitsFixture(room: { w: number; d: number }, x: number, z: number, hx: number, hz: number): boolean {
  const p = homePlan(room);
  const s = p.stairs;
  if (x - hx < s.x1 + 0.2 && x + hx > s.x0 && z - hz < s.z0 + s.steps * s.run && z + hz > s.z0 - 0.2) return true;
  return p.ground.some((f) => Math.abs(x - f.x) < hx + f.w / 2 && Math.abs(z - f.z) < hz + f.d / 2);
}
