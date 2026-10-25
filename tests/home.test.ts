import { describe, expect, it } from 'vitest';
import { createWorld, migrateWorld } from '@/game/world';
import type { Fx } from '@/game/effects';
import { buyPlot, buildHouse, buyCondo, buyFurniture, sellItem, sellProperty, setRented } from '@/game/finance/purchases';
import { canEnterHome, homeInfo, moveFurniture, ownedHomes, placeFurniture, placedIn, storeFurniture, storedFurniture } from '@/game/home';

const fx = (): Fx => [] as unknown as Fx;

function rich() {
  const w = createWorld({ name: 'Home', nickname: 'Fin', difficulty: 'entry', seed: 7 });
  w.finance.cash = 2_000_000;
  w.progress.level = 20;
  return w;
}

function withHouse() {
  const w = rich();
  expect(buyPlot(w, fx(), 'plot-a1', null)).toBe(true);
  expect(buildHouse(w, fx(), 'plot-a1', 'cottage', null)).toBe(true);
  const prop = w.assets.properties.find((p) => p.plotId === 'plot-a1')!;
  prop.rented = false;
  buyFurniture(w, fx(), 'sofa');
  buyFurniture(w, fx(), 'bed');
  buyFurniture(w, fx(), 'rug');
  const [sofa, bed, rug] = w.assets.items.map((i) => i.uid);
  return { w, prop, sofa, bed, rug };
}

describe('homes and furniture', () => {
  it('lists built houses and condos as homes with a room size', () => {
    const { w, prop } = withHouse();
    expect(buyCondo(w, fx(), 'ny-loft', null)).toBe(true);
    const homes = ownedHomes(w);
    expect(homes.map((h) => h.type).sort()).toEqual(['condo', 'house']);
    expect(homeInfo(w, prop.uid)!.room.w).toBeGreaterThan(8);
    // Condos start rented out to tenants
    const condo = homes.find((h) => h.type === 'condo')!;
    expect(canEnterHome(w, condo.prop.uid)).toBe(false);
    expect(canEnterHome(w, prop.uid)).toBe(true);
  });

  it('places, moves and stores furniture with checks', () => {
    const { w, prop, sofa, bed, rug } = withHouse();
    expect(storedFurniture(w)).toHaveLength(3);
    expect(placeFurniture(w, prop.uid, sofa, 0, -3, 0)).toBeNull();
    expect(placedIn(w, sofa)).toBe(prop.uid);
    expect(placeFurniture(w, prop.uid, sofa, 2, -3, 0)).toMatch(/already in a home/);
    // Overlap, outside the room, blocking the doorway
    expect(placeFurniture(w, prop.uid, bed, 0.5, -3, 0)).toMatch(/already there/);
    expect(placeFurniture(w, prop.uid, bed, 20, 0, 0)).toMatch(/outside/);
    expect(placeFurniture(w, prop.uid, bed, 0, 3.6, 0)).toMatch(/doorway/);
    // A rug can go under the sofa
    expect(placeFurniture(w, prop.uid, rug, 0, -3, 0)).toBeNull();
    // Turning the bed a quarter turn lets it fit along the side wall
    expect(placeFurniture(w, prop.uid, bed, -4.5, 0, Math.PI / 2)).toBeNull();
    expect(moveFurniture(w, prop.uid, sofa, 3, -3.5, Math.PI)).toBeNull();
    expect(prop.layout!.find((f) => f.item === sofa)).toMatchObject({ x: 3, z: -3.5 });
    expect(prop.layout!.find((f) => f.item === sofa)!.rot).toBeCloseTo(Math.PI);
    storeFurniture(w, sofa);
    expect(placedIn(w, sofa)).toBeNull();
    expect(storedFurniture(w).map((i) => i.uid)).toEqual([sofa]);
  });

  it('frees furniture when an item, the home, or tenants change things', () => {
    const { w, prop, sofa, bed, rug } = withHouse();
    placeFurniture(w, prop.uid, sofa, 0, -3, 0);
    placeFurniture(w, prop.uid, bed, -4.5, 0, Math.PI / 2);
    sellItem(w, fx(), sofa);
    expect(prop.layout!.map((f) => f.item)).toEqual([bed]);
    setRented(w, fx(), prop.uid, true);
    expect(prop.layout).toEqual([]);
    expect(placeFurniture(w, prop.uid, bed, 0, -3, 0)).toMatch(/Tenants/);
    setRented(w, fx(), prop.uid, false);
    placeFurniture(w, prop.uid, bed, 0, -3, 0);
    sellProperty(w, fx(), prop.uid);
    expect(placedIn(w, bed)).toBeNull();
    expect(storedFurniture(w).map((i) => i.uid).sort()).toEqual([bed, rug].sort());
  });

  it('loads saves made before homes had furniture', () => {
    const { w, prop, sofa } = withHouse();
    const old = JSON.parse(JSON.stringify(w));
    for (const p of old.assets.properties) delete p.layout;
    for (const i of old.assets.items) delete i.placed;
    const m = migrateWorld(old);
    const home = homeInfo(m, prop.uid)!;
    expect(home.prop.layout ?? []).toEqual([]);
    expect(storedFurniture(m)).toHaveLength(3);
    expect(placeFurniture(m, prop.uid, sofa, 0, -3, 0)).toBeNull();
  });
});
