/**
 * Homes you own and the furniture inside them. A built house or a condo can be entered; while
 * you live there (or it stands empty) you can place the furniture you bought, move it around or
 * put it back in storage. The arrangement is saved on the property (`layout`), so saves made
 * before homes existed simply load with empty rooms.
 */
import type { OwnedProperty, PlacedFurniture, WorldState } from './types';
import { condoDef, furnitureDef, houseDef } from './sim/catalog';

/** Floor size of each home's main room (metres, width x depth) and ceiling height. */
const ROOMS: Record<string, { w: number; d: number; h: number }> = {
  'tiny-house': { w: 10, d: 8, h: 3.6 },
  cottage: { w: 12, d: 10, h: 3.8 },
  'family-home': { w: 16, d: 12, h: 3.8 },
  'modern-villa': { w: 20, d: 14, h: 4.2 },
  'sf-studio': { w: 10, d: 8, h: 3.6 },
  'london-flat': { w: 12, d: 10, h: 3.8 },
  'ny-loft': { w: 16, d: 12, h: 4.6 },
  'hk-apartment': { w: 12, d: 10, h: 3.8 },
  'sg-condo': { w: 14, d: 10, h: 3.8 },
};

/** Footprint of each furniture piece facing +z before rotation (w across, d deep, h tall). */
export const FURNITURE_SIZE: Record<string, { w: number; d: number; h: number }> = {
  beanbag: { w: 1.0, d: 1.0, h: 0.7 },
  desk: { w: 1.6, d: 0.8, h: 1.3 },
  bed: { w: 1.8, d: 2.3, h: 1.1 },
  sofa: { w: 2.4, d: 1.0, h: 0.95 },
  lamp: { w: 0.5, d: 0.5, h: 1.0 },
  plant: { w: 0.6, d: 0.6, h: 1.3 },
  bookshelf: { w: 1.4, d: 0.45, h: 2.0 },
  tv: { w: 2.2, d: 0.6, h: 1.6 },
  'game-console': { w: 1.0, d: 0.5, h: 0.6 },
  aquarium: { w: 1.4, d: 0.6, h: 1.5 },
  rug: { w: 2.6, d: 1.8, h: 0.03 },
  piano: { w: 1.6, d: 1.3, h: 1.4 },
  'hot-tub': { w: 2.4, d: 2.4, h: 0.9 },
  'arcade-cab': { w: 0.9, d: 0.9, h: 1.9 },
};

/** Things you can walk over and stack on (a rug) never collide with anything. */
export const isFlat = (itemId: string) => (FURNITURE_SIZE[itemId]?.h ?? 1) < 0.1;

export interface HomeInfo {
  prop: OwnedProperty;
  name: string;
  /** 'house' sits on a park plot; 'condo' is an apartment in a city. */
  type: 'house' | 'condo';
  city: string;
  room: { w: number; d: number; h: number };
}

export function homeInfo(w: WorldState, propUid: string): HomeInfo | null {
  const prop = w.assets.properties.find((p) => p.uid === propUid);
  if (!prop) return null;
  if (prop.houseId) {
    const h = houseDef(prop.houseId);
    const room = ROOMS[prop.houseId];
    return h && room ? { prop, name: h.name, type: 'house', city: 'park', room } : null;
  }
  const c = condoDef(prop.itemId);
  const room = ROOMS[prop.itemId];
  return c && room ? { prop, name: c.name, type: 'condo', city: c.city, room } : null;
}

/** All the homes you own that can be entered (houses on plots and condos). */
export function ownedHomes(w: WorldState): HomeInfo[] {
  return w.assets.properties.map((p) => homeInfo(w, p.uid)).filter((h): h is HomeInfo => !!h);
}

/** Tenants live in a rented home, so you can't walk in or rearrange it. */
export function canEnterHome(w: WorldState, propUid: string): boolean {
  const h = homeInfo(w, propUid);
  return !!h && !h.prop.rented;
}

export const layoutOf = (p: OwnedProperty): PlacedFurniture[] => p.layout ?? [];

/** Which home (property uid) a furniture item stands in, if any. */
export function placedIn(w: WorldState, itemUid: string): string | null {
  for (const p of w.assets.properties) if (layoutOf(p).some((f) => f.item === itemUid)) return p.uid;
  return null;
}

/** Furniture you own that isn't standing in any home yet. */
export function storedFurniture(w: WorldState) {
  return w.assets.items.filter((i) => furnitureDef(i.itemId) && !placedIn(w, i.uid));
}

/** Half extents of a piece after a quarter-turn rotation. */
function extents(itemId: string, rot: number) {
  const s = FURNITURE_SIZE[itemId] ?? { w: 1, d: 1, h: 1 };
  const quarter = Math.round(rot / (Math.PI / 2)) % 2 !== 0;
  return { hx: (quarter ? s.d : s.w) / 2, hz: (quarter ? s.w : s.d) / 2 };
}

/** Space kept free inside the front door so you can always walk in and out. */
export function doorZone(room: { w: number; d: number }) {
  return { minX: -1.6, maxX: 1.6, minZ: room.d / 2 - 2.2, maxZ: room.d / 2 };
}

/**
 * Why a piece can't stand at (x,z) with rotation `rot`, or null if it can. `ignore` is the item
 * being moved. Pieces must sit fully inside the room, keep the doorway clear and not overlap
 * other pieces (rugs can go under anything).
 */
export function placementProblem(room: { w: number; d: number }, layout: PlacedFurniture[], itemsById: Map<string, string>, itemId: string, x: number, z: number, rot: number, ignore?: string): string | null {
  const { hx, hz } = extents(itemId, rot);
  const wall = 0.05;
  if (x - hx < -room.w / 2 + wall || x + hx > room.w / 2 - wall || z - hz < -room.d / 2 + wall || z + hz > room.d / 2 - wall) return 'That spot is outside the room.';
  const dz = doorZone(room);
  if (!isFlat(itemId) && x + hx > dz.minX && x - hx < dz.maxX && z + hz > dz.minZ) return 'Keep the doorway clear.';
  if (isFlat(itemId)) return null;
  for (const f of layout) {
    if (f.item === ignore) continue;
    const other = itemsById.get(f.item);
    if (!other || isFlat(other)) continue;
    const o = extents(other, f.rot);
    if (Math.abs(x - f.x) < hx + o.hx - 0.02 && Math.abs(z - f.z) < hz + o.hz - 0.02) return 'Something is already there.';
  }
  return null;
}

const snapRot = (r: number) => ((Math.round(r / (Math.PI / 2)) % 4) + 4) % 4 * (Math.PI / 2);
const round = (v: number) => Math.round(v * 100) / 100;

function check(w: WorldState, propUid: string, itemUid: string, x: number, z: number, rot: number, moving: boolean) {
  const home = homeInfo(w, propUid);
  if (!home) return { error: 'You don’t own that home.' } as const;
  if (home.prop.rented) return { error: 'Tenants live there. Stop renting it out to decorate.' } as const;
  const item = w.assets.items.find((i) => i.uid === itemUid);
  if (!item || !furnitureDef(item.itemId)) return { error: 'That isn’t furniture you own.' } as const;
  const where = placedIn(w, itemUid);
  if (moving ? where !== propUid : where !== null) return { error: moving ? 'That piece isn’t in this home.' : 'That piece is already in a home.' } as const;
  const itemsById = new Map(w.assets.items.map((i) => [i.uid, i.itemId]));
  const problem = placementProblem(home.room, layoutOf(home.prop), itemsById, item.itemId, x, z, snapRot(rot), moving ? itemUid : undefined);
  if (problem) return { error: problem } as const;
  return { home, item } as const;
}

/** Put a stored piece in a home. Returns an error message, or null when it was placed. */
export function placeFurniture(w: WorldState, propUid: string, itemUid: string, x: number, z: number, rot: number): string | null {
  const r = check(w, propUid, itemUid, x, z, rot, false);
  if ('error' in r) return r.error ?? null;
  r.home.prop.layout = [...layoutOf(r.home.prop), { item: itemUid, x: round(x), z: round(z), rot: snapRot(rot) }];
  r.item.placed = true;
  return null;
}

/** Move (or turn) a piece already standing in this home. */
export function moveFurniture(w: WorldState, propUid: string, itemUid: string, x: number, z: number, rot: number): string | null {
  const r = check(w, propUid, itemUid, x, z, rot, true);
  if ('error' in r) return r.error ?? null;
  r.home.prop.layout = layoutOf(r.home.prop).map((f) => (f.item === itemUid ? { item: itemUid, x: round(x), z: round(z), rot: snapRot(rot) } : f));
  return null;
}

/** Take a piece out of whichever home it stands in and put it back in storage. */
export function storeFurniture(w: WorldState, itemUid: string) {
  for (const p of w.assets.properties) if (p.layout?.some((f) => f.item === itemUid)) p.layout = p.layout.filter((f) => f.item !== itemUid);
  const it = w.assets.items.find((i) => i.uid === itemUid);
  if (it) it.placed = false;
}

/** Everything in a home goes back to storage (selling the home, renting it out). */
export function clearHome(w: WorldState, propUid: string) {
  const p = w.assets.properties.find((x) => x.uid === propUid);
  if (!p?.layout) return;
  for (const f of p.layout) {
    const it = w.assets.items.find((i) => i.uid === f.item);
    if (it) it.placed = false;
  }
  p.layout = [];
}
