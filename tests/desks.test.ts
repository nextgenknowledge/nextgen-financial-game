/** The models behind the Advanced pro desks, and the Advanced building identities. */
import { describe, expect, it } from 'vitest';
import * as D from '@/game/finance/desks';
import { applyDifficulty, CITIES, currentTrack } from '@/world/cities';
import { PRO_TWIN, sameActivity } from '@/game/activities';

const app = (score: number, income: number, debts: number, amount: number, secured = false): D.Applicant => ({ name: 'x', score, income, debts, amount, years: 5, secured, purpose: '' });

describe('loan officer', () => {
  it('prices a strong borrower at prime and declines a weak one', () => {
    const strong = D.loanEV(app(790, 9000, 400, 20000));
    expect(strong[0]).toBeGreaterThan(strong[1]);
    expect(strong[0]).toBeGreaterThan(0);
    const weak = D.loanEV(app(600, 3600, 1100, 15000));
    expect(Math.max(weak[0], weak[1])).toBeLessThan(0);
  });
  it('debt-to-income includes the new payment', () => {
    const a = app(700, 5000, 500, 20000);
    expect(D.dti(a)).toBeCloseTo((500 + D.payment(20000, D.PRIME, 60)) / 5000, 6);
  });
});

describe('futures hedge', () => {
  it('sizes the minimum-variance hedge', () => {
    expect(D.hedgeContracts({ id: 'airline', exposure: 2_520_000, contractSize: 42_000 } as D.HedgeCase)).toBe(60);
    expect(D.hedgeContracts({ id: 'fund', exposure: 90_000_000, contractSize: 50, spot: 18_000, beta: 1.25 } as D.HedgeCase)).toBe(125);
  });
  it('a full hedge cancels the price move', () => {
    const c: D.HedgeCase = { id: 'farmer', title: '', brief: '', side: -1, exposure: 400_000, spot: 6.2, contractSize: 5_000, unit: 'bushel', vol: 0.03, margin: 1, maint: 1 };
    const path = D.hedgePath(c, 3);
    expect(Math.abs(D.hedgeOutcome(c, path, -80).net)).toBeLessThan(1e-6);
    expect(Math.abs(D.hedgeOutcome(c, path, 0).net)).toBeGreaterThan(0);
  });
});

describe('supply chain', () => {
  const s: D.Shipment = { product: 'x', units: 2000, kgPerUnit: 1.5, unitValue: 120, margin: 45, dueIn: 25 };
  const best = (due: number) => D.MODES.map((m) => D.shipCost({ ...s, dueIn: due }, m).total).reduce((bi, v, i, a) => (v < a[bi] ? i : bi), 0);
  it('urgent goes by air, relaxed by sea, in between by rail', () => {
    expect(D.MODES[best(10)].id).toBe('air');
    expect(D.MODES[best(25)].id).toBe('rail');
    expect(D.MODES[best(45)].id).toBe('sea');
  });
});

describe('fintech', () => {
  it('finds a plan that stays solvent', () => {
    const b = D.bestFintech();
    expect(b.v).toBeGreaterThan(0);
    expect(D.fintechSim(b.p).minCash).toBeGreaterThanOrEqual(0);
  });
});

describe('backtester', () => {
  it('the right rule beats buy-and-hold in its own regime', () => {
    const trend = D.pricePath(42, 756, 'trend');
    expect(D.bestStrategy(trend, 'trend').sharpe).toBeGreaterThan(D.backtest(trend, { kind: 'trend', fast: 20, slow: 100 }).bhStats.sharpe);
    const chop = D.pricePath(42, 756, 'chop');
    expect(D.bestStrategy(chop, 'revert').sharpe).toBeGreaterThan(D.backtest(chop, { kind: 'revert', fast: 20, slow: 10 }).bhStats.sharpe);
  });
  it('max drawdown is never positive', () => {
    expect(D.metrics([1, 1.2, 0.9, 1.1]).mdd).toBeCloseTo(0.9 / 1.2 - 1, 9);
  });
});

describe('sovereign fund', () => {
  it('rewards diversification over an all-bond fund', () => {
    const bonds = D.fundSim([100, 0, 0, 0, 0], 0.03);
    const mix = D.fundSim([20, 40, 10, 15, 15], 0.03);
    expect(D.fundScore(mix, 0.03)).toBeGreaterThan(D.fundScore(bonds, 0.03));
  });
});

describe('fraud ops', () => {
  it('counts the confusion matrix and costs', () => {
    const t = (fraud: boolean, amount: number) => ({ fraud, amount }) as D.Txn;
    const r = D.fraudCost([t(true, 500), t(false, 20), t(true, 80), t(false, 40)], [true, true, false, false]);
    expect([r.tp, r.fp, r.fn, r.tn]).toEqual([1, 1, 1, 1]);
    expect(r.cost).toBe(D.FRICTION + 80);
  });
});

describe('vet practice', () => {
  it('the best plan beats a naive one', () => {
    expect(D.bestVetMonth().profit).toBeGreaterThan(D.vetMonth({ checkup: 60, surgery: 1100, vets: 1, insurance: false }).profit);
  });
});

describe('Advanced building identities', () => {
  it('swaps in the pro identity and restores it', () => {
    const arcade = CITIES.park.buildings.find((b) => b.id === 'arcade')!;
    const entryName = arcade.name;
    applyDifficulty('advanced');
    expect(currentTrack()).toBe('advanced');
    expect(arcade.name).toBe('Trading Simulator Lounge');
    expect(arcade.interiorKind).toBe('trading-floor');
    applyDifficulty('entry');
    expect(arcade.name).toBe(entryName);
    expect(arcade.interiorKind).toBeUndefined();
  });
  it('quests that ask for an Entry activity accept its Advanced twin', () => {
    expect(PRO_TWIN.get('night-market')).toBe('futures-pit');
    expect(sameActivity('futures-pit', 'night-market')).toBe(true);
    expect(sameActivity('night-market', 'futures-pit')).toBe(false);
  });
});
