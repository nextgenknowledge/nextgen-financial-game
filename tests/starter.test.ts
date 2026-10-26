/** Starter deals: one cheap item per category, once per world, never resellable at a profit. */
import { describe, expect, it } from 'vitest';
import { createWorld } from '@/game/world';
import type { Fx } from '@/game/effects';
import { adoptPet, buyOutfit, buyVehicle, claimStarterHome, setRented, sellVehicle } from '@/game/finance/purchases';
import { STARTER, starterUsed } from '@/game/starter';
import quests from '@/data/quests.json';

const world = (difficulty: 'entry' | 'advanced' = 'entry') => {
  const w = createWorld({ name: 'T', nickname: 'T', difficulty, seed: 3 });
  w.finance.cash = 100;
  return w;
};

describe('starter deals', () => {
  it('sells each starter item at the deal price, once', () => {
    const w = world();
    const fx: Fx = [];
    expect(buyOutfit(w, fx, STARTER.outfit.id)).toBe(true);
    expect(adoptPet(w, fx, STARTER.pet.id, 'Rex')).toBe(true);
    expect(buyVehicle(w, fx, STARTER.ride.id, 'cash')).toBe(true);
    expect(claimStarterHome(w, fx)).toBe(true);
    // Level-up bonuses also land in cash, so check what each purchase charged
    const charged = w.finance.ledger.filter((l) => l.d.includes('(starter deal)')).map((l) => Math.abs(l.a)).sort((a, b) => a - b);
    expect(charged).toEqual([STARTER.outfit.price, STARTER.pet.price, STARTER.ride.price, STARTER.home.price].sort((a, b) => a - b));
    for (const k of ['outfit', 'pet', 'ride', 'home'] as const) expect(starterUsed(w, k)).toBe(true);
    // A second dog costs full price
    w.finance.cash = 50;
    expect(adoptPet(w, fx, STARTER.pet.id, 'Max')).toBe(false);
    expect(claimStarterHome(w, fx)).toBe(false);
  });

  it('values starter items at what was paid, so they cannot be flipped for profit', () => {
    const w = world();
    const fx: Fx = [];
    buyVehicle(w, fx, STARTER.ride.id, 'cash');
    const v = w.assets.vehicles[0];
    expect(v.value).toBe(STARTER.ride.price);
    const before = w.finance.cash;
    sellVehicle(w, fx, v.uid);
    expect(w.finance.cash - before).toBeLessThanOrEqual(STARTER.ride.price);
  });

  it('starter homes are for living in, not renting out', () => {
    const w = world();
    const fx: Fx = [];
    claimStarterHome(w, fx);
    const home = w.assets.properties[0];
    expect(home.houseId).toBe(STARTER.home.id);
    expect(w.player.residence).toBe(home.uid);
    setRented(w, fx, home.uid, true);
    expect(home.rented).toBe(false);
  });

  it('the starter-pack quest follows the first job in the tutorial', () => {
    const byId = new Map(quests.quests.map((q) => [q.id, q]));
    expect(byId.get('q3-job')!.next).toEqual(['q3b-starter']);
    expect(byId.get('q3b-starter')!.next).toEqual(['q4-sf']);
  });
});
