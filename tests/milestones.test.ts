/** Learning milestones for analytics, and the "what this really cost" card. */
import { describe, expect, it } from 'vitest';
import { createWorld } from '@/game/world';
import { recordEvent } from '@/game/progress/events';
import type { Fx } from '@/game/effects';
import { adoptPet, buyVehicle, vehicleOffer } from '@/game/finance/purchases';
import { financedSummary } from '@/game/finance/costSummary';
import vehicles from '@/data/shop/vehicles.json';

const world = (difficulty: 'entry' | 'advanced' = 'entry') => createWorld({ name: 'Secret World', nickname: 'Secret Nick', difficulty, seed: 4 });
const tracked = (fx: Fx) => fx.flatMap((e) => (e.type === 'track' ? [e.name] : []));

describe('analytics milestones', () => {
  it('fires each first once', () => {
    const w = world();
    const fx: Fx = [];
    const twice = (ev: Parameters<typeof recordEvent>[2]) => {
      recordEvent(w, fx, ev);
      recordEvent(w, fx, ev);
    };
    twice({ type: 'activityComplete', target: 'first-quiz', stars: 3 });
    twice({ type: 'buy', target: 'x', value: 5 });
    twice({ type: 'invest', target: 'FCX', value: 5 });
    twice({ type: 'travel', target: 'new-york' });
    twice({ type: 'lesson', target: 'l1' });
    expect(tracked(fx).sort()).toEqual(['first_city', 'first_investment', 'first_purchase', 'first_quiz', 'first_three_star', 'lesson_completed'].sort());
  });

  it('does not count coming home as reaching a city, or a second city as the first', () => {
    const w = world();
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'travel', target: 'park' });
    expect(tracked(fx)).toEqual([]);
    recordEvent(w, fx, { type: 'travel', target: 'new-york' });
    recordEvent(w, fx, { type: 'travel', target: 'san-francisco' });
    expect(tracked(fx)).toEqual(['first_city']);
  });

  it('reports the end of the tutorial', () => {
    const w = world();
    const fx: Fx = [];
    w.progress.quests.active = [{ id: 'q1-welcome', step: 5, progress: 0 }];
    recordEvent(w, fx, { type: 'activityComplete', target: 'first-quiz', stars: 1 });
    expect(tracked(fx)).toContain('tutorial_finished');
  });

  it('never sends a nickname or world name', () => {
    const w = world();
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'travel', target: 'new-york' });
    recordEvent(w, fx, { type: 'lesson', target: 'l1' });
    const sent = JSON.stringify(fx.filter((e) => e.type === 'track'));
    expect(sent).not.toContain('Secret');
  });
});

describe('what this really cost', () => {
  const summaries = (fx: Fx) => fx.flatMap((e) => (e.type === 'costSummary' ? [e.summary] : []));
  const car = vehicles.items.find((v) => v.price > 10000)!;
  const row = (s: ReturnType<typeof summaries>[number], label: string) => s.rows.find((r) => r.label.startsWith(label))?.amount;

  it('adds up a loan: down payment plus every payment', () => {
    const s = financedSummary({ name: 'Car', price: 10000, down: 1000, payment: 200, months: 60, upkeep: 50 });
    expect(row(s, 'Total you pay')).toBe(13000);
    expect(row(s, 'Interest')).toBe(3000);
  });

  it('shows after a financed car, in both modes, matching the loan it took out', () => {
    for (const mode of ['entry', 'advanced'] as const) {
      const w = world(mode);
      w.progress.level = 99;
      w.finance.cash = 100000;
      const fx: Fx = [];
      const o = vehicleOffer(w, car.id);
      expect(buyVehicle(w, fx, car.id, 'loan')).toBe(true);
      const s = summaries(fx)[0];
      expect(row(s, 'Monthly payment')).toBe(w.finance.loans[0].payment);
      expect(row(s, 'Total you pay')).toBeCloseTo(o.down + o.loan.payment * o.months, 2);
      expect(row(s, 'Interest')).toBeGreaterThan(0);
    }
  });

  it('shows for a lease and a pet but not for a car paid in cash', () => {
    const w = world();
    w.progress.level = 99;
    w.finance.cash = 100000;
    const fx: Fx = [];
    buyVehicle(w, fx, car.id, 'cash');
    expect(summaries(fx)).toEqual([]);
    adoptPet(w, fx, 'dog', 'Rex');
    const pet = summaries(fx)[0];
    expect(row(pet, 'Total for the first year')).toBeGreaterThan(row(pet, 'Adoption fee')!);
    fx.length = 0;
    const leasable = vehicles.items.find((v) => v.leaseable)!;
    buyVehicle(w, fx, leasable.id, 'lease');
    expect(summaries(fx)[0].note).toContain('hand the vehicle back');
  });
});
