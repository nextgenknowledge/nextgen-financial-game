import { describe, expect, it } from 'vitest';
import { bestPortfolio, bondPrice, dcf, exitPayouts, macaulay, modifiedDuration, ownership, portfolioStats, priceRound, rating } from '@/game/finance/pro';

describe('pro desk maths', () => {
  it('DCF matches a hand calculation', () => {
    const r = dcf({ fcf1: 100, growth: 0, terminal: 0, wacc: 0.1, netDebt: 0, shares: 100 });
    // Flat 100/yr forever at 10% = 1000
    expect(r.enterpriseValue).toBeCloseTo(1000, 6);
    expect(r.perShare).toBeCloseTo(10, 6);
    expect(rating(12, 10)).toBe('Buy');
    expect(rating(10, 10)).toBe('Hold');
    expect(rating(8, 10)).toBe('Sell');
  });

  it('bonds: par at coupon = yield, zero duration = maturity', () => {
    expect(bondPrice(1000, 0.05, 10, 0.05)).toBeCloseTo(1000, 6);
    expect(bondPrice(1000, 0.05, 10, 0.06)).toBeLessThan(1000);
    expect(macaulay(1000, 0, 7, 0.04)).toBeCloseTo(7, 6);
    expect(modifiedDuration(1000, 0, 7, 0.04)).toBeCloseTo(7 / 1.04, 6);
  });

  it('diversification lowers volatility when correlation < 1', () => {
    const assets = [
      { name: 'A', ret: 0.08, vol: 0.2 },
      { name: 'B', ret: 0.08, vol: 0.2 },
    ];
    const s = portfolioStats(assets, [[1, 0], [0, 1]], [0.5, 0.5], 0.02);
    expect(s.vol).toBeCloseTo(0.2 / Math.SQRT2, 6);
    const best = bestPortfolio(assets, [[1, 0], [0, 1]], 0.02, (x) => -x.vol);
    expect(best.w[0]).toBeCloseTo(0.5, 6);
  });

  it('cap table and liquidation preference', () => {
    const t0 = [{ name: 'Founders', shares: 8_000_000 }];
    const seed = priceRound(t0, 'Seed', 2_000_000, 8_000_000);
    expect(seed.postMoney).toBe(10_000_000);
    expect(ownership(seed.table, 'Seed')).toBeCloseTo(0.2, 6);
    // Small exit: the investor takes its money back first
    const low = exitPayouts(seed.table, 5_000_000);
    expect(low.Seed).toBeCloseTo(2_000_000, 3);
    expect(low.Founders).toBeCloseTo(3_000_000, 3);
    // Big exit: the investor converts and shares pro rata
    const high = exitPayouts(seed.table, 50_000_000);
    expect(high.Seed).toBeCloseTo(10_000_000, 3);
  });
});
