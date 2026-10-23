import { describe, expect, it } from 'vitest';
import { createWorld } from '@/game/world';
import { processMonth } from '@/game/sim/month';
import { advanceTime } from '@/game/sim/time';
import { marketTick, TICKS_PER_MONTH, MAX_TICK_MOVE, MIN_PRICE, SECURITIES } from '@/game/market/market';
import { makeRng } from '@/game/rng';
import { openChecking, openSavings, transfer, payBill, takeLoan, openCard, fundGoal, addGoal, openCD } from '@/game/finance/accounts';
import { buyVehicle, adoptPet, startBusiness, buyPlot, buildHouse } from '@/game/finance/purchases';
import { netWorth } from '@/game/finance/netWorth';
import { buySecurity, sellSecurity } from '@/game/market/trade';
import { workShift } from '@/game/finance/jobs';
import type { Fx } from '@/game/effects';
import type { WorldState } from '@/game/types';

const mk = (difficulty: 'entry' | 'advanced' = 'advanced', seed = 7) => {
  const w = createWorld({ name: 'T', nickname: 'N', difficulty, seed });
  // Max level so level-up cash bonuses don't affect balance checks
  w.progress.xp = 1e9;
  w.progress.level = 99;
  return w;
};

describe('market simulation bounds', () => {
  it('never moves more than the cap per tick and never drops below the floor', () => {
    const w = mk();
    const rng = makeRng(123);
    const fx: Fx = [];
    for (let i = 0; i < TICKS_PER_MONTH * 12 * 20; i++) {
      const before = { ...w.market.prices };
      marketTick(w, fx, rng);
      for (const s of SECURITIES) {
        const p = w.market.prices[s.symbol];
        expect(p).toBeGreaterThanOrEqual(MIN_PRICE);
        expect(Number.isFinite(p)).toBe(true);
        const r = Math.log(p / before[s.symbol]);
        expect(Math.abs(r)).toBeLessThanOrEqual(MAX_TICK_MOVE + 0.02); // rounding to cents
      }
    }
  });
  it('the index fund has positive drift over many simulated years (on average)', () => {
    let up = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const w = mk('advanced', seed);
      const rng = makeRng(seed);
      for (let i = 0; i < TICKS_PER_MONTH * 12 * 15; i++) marketTick(w, [], rng);
      if (w.market.prices.FCX > 100) up++;
    }
    expect(up).toBeGreaterThanOrEqual(12);
  });
  it('history is capped', () => {
    const w = mk();
    const rng = makeRng(5);
    for (let i = 0; i < 1000; i++) marketTick(w, [], rng);
    expect(w.market.history.FCX.length).toBeLessThanOrEqual(160);
  });
});

describe('month processing', () => {
  it('pays savings interest (Entry = 1% per month)', () => {
    const w = mk('entry');
    const fx: Fx = [];
    openSavings(w, fx);
    w.finance.savings = 1000;
    processMonth(w, fx);
    expect(w.finance.savings).toBeCloseTo(1010, 2);
    expect(w.time.month).toBe(1);
  });
  it('advanced savings interest uses the APY monthly rate', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    openSavings(w, fx);
    w.finance.savings = 10000;
    const apy = Math.max(0.005, w.market.reserveRate - 0.0025);
    processMonth(w, fx);
    // reserve rate drifts during the month, so allow a small band
    expect(w.finance.savings).toBeGreaterThan(10000);
    expect(w.finance.savings).toBeLessThan(10000 * (1 + apy) ** (1 / 12) + 5);
  });
  it('bills never push cash negative; shortfalls become a Narwhal helper loan', () => {
    const w = mk('entry');
    const fx: Fx = [];
    w.finance.cash = 10;
    payBill(w, fx, 50, 'Test bill');
    expect(w.finance.cash).toBe(0);
    expect(w.finance.loans).toHaveLength(1);
    expect(w.finance.loans[0].kind).toBe('iou');
    expect(fx.some((e) => e.type === 'narwhal')).toBe(true);
  });
  it('loan payments reduce the balance and build credit history', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    openChecking(w, fx);
    takeLoan(w, fx, 'personal', 1000, 12);
    w.finance.checking = 5000;
    const loan = w.finance.loans[0];
    for (let i = 0; i < 12; i++) processMonth(w, fx);
    expect(w.finance.loans.find((l) => l.id === loan.id)).toBeUndefined();
    expect(w.finance.credit.onTime).toBeGreaterThanOrEqual(12);
    expect(w.finance.credit.score).not.toBeNull();
  });
  it('missed payments add a late fee and hurt credit, but the player can recover', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    takeLoan(w, fx, 'personal', 2000, 12, { deposit: false });
    w.finance.cash = 0;
    processMonth(w, fx);
    expect(w.finance.credit.late).toBe(1);
    expect(w.finance.loans[0].missed).toBe(1);
    w.finance.cash = 10000;
    for (let i = 0; i < 14; i++) processMonth(w, fx);
    expect(w.finance.loans.filter((l) => l.kind !== 'iou')).toHaveLength(0);
  });
  it('credit card carrying a balance accrues interest; autopay full does not', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    openChecking(w, fx);
    openCard(w, fx);
    w.finance.card.balance = 400;
    w.finance.card.autopay = 'none';
    processMonth(w, fx);
    expect(w.finance.card.balance).toBeGreaterThan(400);
    const w2 = mk('advanced');
    openChecking(w2, fx);
    openCard(w2, fx);
    w2.finance.checking = 1000;
    w2.finance.card.balance = 400;
    w2.finance.card.autopay = 'full';
    processMonth(w2, fx);
    expect(w2.finance.card.balance).toBe(0);
  });
  it('CDs mature into savings with interest', () => {
    const w = mk('entry');
    const fx: Fx = [];
    openSavings(w, fx);
    w.finance.savings = 500;
    openCD(w, fx, 500, 3);
    for (let i = 0; i < 3; i++) processMonth(w, fx);
    expect(w.finance.cds).toHaveLength(0);
    expect(w.finance.savings).toBeGreaterThan(520);
  });
  it('vehicles depreciate, pets add bills, businesses pay profit', () => {
    const w = mk('entry');
    const fx: Fx = [];
    w.finance.cash = 10000;
    buyVehicle(w, fx, 'bike', 'cash');
    adoptPet(w, fx, 'cat', 'Mittens');
    startBusiness(w, fx, 'lemonade', 'Sunny');
    const bikeValue = w.assets.vehicles[0].value;
    for (let i = 0; i < 6; i++) processMonth(w, fx);
    expect(w.assets.vehicles[0].value).toBeLessThan(bikeValue);
    expect(w.assets.businesses[0].profits.length).toBe(6);
    expect(netWorth(w).total).toBeGreaterThan(0);
  });
  it('advanced year end produces a W-2 from job wages', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    openChecking(w, fx);
    for (let i = 0; i < 30; i++) workShift(w, fx, 'cashier', 90, 3);
    expect(w.finance.tax.ytdGross).toBeGreaterThan(0);
    for (let i = 0; i < 12; i++) processMonth(w, fx);
    expect(w.finance.tax.w2s).toHaveLength(1);
    expect(w.finance.tax.w2s[0].gross).toBeGreaterThan(1000);
  });
  it('advanceTime runs 21 market ticks and one month per month of play', () => {
    const w = mk('entry');
    const fx: Fx = [];
    w.time.t = 0;
    for (let i = 0; i < 480; i++) advanceTime(w, fx, 1, 480);
    expect(w.time.month).toBe(1);
    expect(w.market.history.FCX.length).toBe(TICKS_PER_MONTH + 1);
  });
});

describe('money actions', () => {
  it('transfers and goals keep balances consistent', () => {
    const w = mk('entry');
    const fx: Fx = [];
    w.finance.cash = 100;
    openChecking(w, fx);
    openSavings(w, fx);
    expect(transfer(w, fx, 'cash', 'checking', 60)).toBe(true);
    expect(transfer(w, fx, 'checking', 'savings', 100)).toBe(false);
    addGoal(w, fx, 'Bike', '🚲', 50);
    expect(fundGoal(w, fx, w.finance.goals[0].id, 50)).toBe(true);
    expect(w.finance.goals[0].done).toBe(true);
    expect(w.finance.cash + w.finance.checking + w.finance.savings).toBeCloseTo(100, 6);
  });
  it('trading conserves value at the moment of the trade', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    w.finance.cash = 1000;
    const before = netWorth(w).total;
    buySecurity(w, fx, 'FCX', 500);
    expect(netWorth(w).total).toBeCloseTo(before, 6);
    sellSecurity(w, fx, 'FCX', 1);
    expect(netWorth(w).total).toBeCloseTo(before, 4);
    expect(w.finance.holdings.FCX).toBeUndefined();
  });
  it('mortgage purchase creates a liability matching the loan', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    w.finance.cash = 100000;
    buyPlot(w, fx, 'plot-a1', 0.2);
    buildHouse(w, fx, 'plot-a1', 'cottage', 0.2);
    const nw = netWorth(w);
    expect(nw.mortgage).toBeGreaterThan(0);
    expect(nw.property).toBeGreaterThan(nw.mortgage);
  });
  it('leased cars are not assets and leave when the lease ends', () => {
    const w = mk('advanced');
    const fx: Fx = [];
    w.finance.cash = 50000;
    buyVehicle(w, fx, 'compact', 'lease');
    expect(netWorth(w).vehicles).toBe(0);
    for (let i = 0; i < 36; i++) processMonth(w, fx);
    expect(w.assets.vehicles).toHaveLength(0);
  });
});

describe('balance: saving & investing beats impulse spending', () => {
  function simulate(style: 'saver' | 'spender', seed: number): number {
    const w: WorldState = mk('advanced', seed);
    const fx: Fx = [];
    openChecking(w, fx);
    openSavings(w, fx);
    for (let m = 0; m < 36; m++) {
      for (let s = 0; s < 8; s++) workShift(w, fx, 'cashier', 80, 2);
      if (style === 'saver') {
        const spare = w.finance.checking - 150;
        if (spare > 0) {
          buySecurity(w, fx, 'FCX', spare * 0.6);
          transfer(w, fx, 'checking', 'savings', spare * 0.4);
        }
      } else {
        // Impulse: spends almost everything on fun stuff
        const spare = w.finance.checking - 50;
        if (spare > 0) {
          w.finance.checking -= spare;
          w.player.happiness = Math.min(100, w.player.happiness + 5);
        }
      }
      processMonth(w, fx);
    }
    return netWorth(w).total;
  }
  it('saver ends with far higher net worth than the spender', () => {
    for (const seed of [1, 2, 3]) {
      expect(simulate('saver', seed)).toBeGreaterThan(simulate('spender', seed) * 3);
    }
  });
});
