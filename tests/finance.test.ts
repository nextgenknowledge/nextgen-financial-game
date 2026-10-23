import { describe, expect, it } from 'vitest';
import {
  apyFromApr,
  aprFromApy,
  compoundAmount,
  doublingYears,
  futureValueSeries,
  growthSchedule,
  monthlyRateFromApy,
  realReturn,
  ruleOf72,
  simpleInterest,
} from '@/game/finance/interest';
import {
  amortize,
  cardMinimumPayment,
  leasePayment,
  minimumPaymentTrap,
  monthlyPayment,
  monthsToPayoff,
  remainingBalance,
  totalInterest,
} from '@/game/finance/loans';
import { creditScore, creditTier, loanAprFor, utilizationFactor } from '@/game/finance/credit';
import { bracketTax, effectiveRate, fileReturn, marginalRate, paycheck, withSalesTax } from '@/game/finance/tax';
import { netWorth } from '@/game/finance/netWorth';
import { createWorld } from '@/game/world';

describe('interest', () => {
  it('simple interest', () => {
    expect(simpleInterest(1000, 0.05, 3)).toBeCloseTo(150);
  });
  it('compound interest with different periods', () => {
    expect(compoundAmount(1000, 0.06, 10, 1)).toBeCloseTo(1790.85, 2);
    expect(compoundAmount(1000, 0.06, 10, 12)).toBeCloseTo(1819.4, 1);
    expect(compoundAmount(1000, 0.06, 10, 365)).toBeCloseTo(1822.03, 1);
    expect(compoundAmount(1000, 0.06, 10, Infinity)).toBeCloseTo(1822.12, 1);
  });
  it('APR <-> APY round trip', () => {
    const apy = apyFromApr(0.12, 12);
    expect(apy).toBeCloseTo(0.126825, 5);
    expect(aprFromApy(apy, 12)).toBeCloseTo(0.12, 8);
  });
  it('monthly rate compounds back to the APY', () => {
    const m = monthlyRateFromApy(0.045);
    expect(Math.pow(1 + m, 12) - 1).toBeCloseTo(0.045, 10);
  });
  it('rule of 72 is close to the exact doubling time', () => {
    expect(ruleOf72(8)).toBe(9);
    expect(doublingYears(0.08)).toBeCloseTo(9.006, 2);
  });
  it('future value of a series', () => {
    expect(futureValueSeries(100, 0, 12)).toBe(1200);
    expect(futureValueSeries(100, 0.01, 12)).toBeCloseTo(1268.25, 2);
  });
  it('real return', () => {
    expect(realReturn(0.07, 0.03)).toBeCloseTo(0.038835, 5);
  });
  it('starting early beats starting late', () => {
    const early = growthSchedule({ start: 0, monthly: 100, annualRate: 0.07, years: 49 });
    const late = growthSchedule({ start: 0, monthly: 100, annualRate: 0.07, years: 49, startDelayYears: 15 });
    expect(early[49]).toBeGreaterThan(late[49] * 2);
  });
});

describe('loans', () => {
  it('monthly payment matches the standard formula', () => {
    expect(monthlyPayment(20000, 0.06, 60)).toBeCloseTo(386.66, 2);
    expect(monthlyPayment(300000, 0.065, 360)).toBeCloseTo(1896.2, 1);
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });
  it('amortization pays the loan to zero and interest declines', () => {
    const rows = amortize(10000, 0.08, 36);
    expect(rows).toHaveLength(36);
    expect(rows[35].balance).toBeCloseTo(0, 2);
    expect(rows[0].interest).toBeGreaterThan(rows[35].interest);
    const paid = rows.reduce((s, r) => s + r.principal, 0);
    expect(paid).toBeCloseTo(10000, 2);
  });
  it('extra payments shorten the loan and cut interest', () => {
    const base = totalInterest(20000, 0.07, 60);
    const extra = totalInterest(20000, 0.07, 60, 100);
    expect(extra).toBeLessThan(base);
    expect(amortize(20000, 0.07, 60, 100).length).toBeLessThan(60);
  });
  it('remaining balance agrees with the schedule', () => {
    const rows = amortize(15000, 0.05, 48);
    expect(remainingBalance(15000, 0.05, 48, 12)).toBeCloseTo(rows[11].balance, 4);
  });
  it('credit card minimum payment trap', () => {
    expect(cardMinimumPayment(0, 0.25)).toBe(0);
    expect(cardMinimumPayment(1000, 0.24)).toBeCloseTo(30, 2); // 1% + 2% interest
    expect(cardMinimumPayment(100, 0.24)).toBe(25);
    const trap = minimumPaymentTrap(3000, 0.2499);
    expect(trap.paidOff).toBe(true);
    expect(trap.months).toBeGreaterThan(100);
    expect(trap.interestPaid).toBeGreaterThan(2000);
  });
  it('months to payoff', () => {
    expect(monthsToPayoff(1000, 0.24, 15)).toBe(Infinity);
    expect(monthsToPayoff(1000, 0, 100)).toBe(10);
    expect(monthsToPayoff(1000, 0.18, 100)).toBe(11);
  });
  it('lease payment is below the loan payment for the same car', () => {
    expect(leasePayment(30000, 18000, 36, 0.06)).toBeLessThan(monthlyPayment(30000, 0.06, 60));
  });
});

describe('credit score', () => {
  const base = {
    onTime: 24,
    late: 0,
    utilization: 0.05,
    oldestAccountMonths: 60,
    hardInquiriesLast12: 0,
    hasRevolving: true,
    hasInstallment: true,
  };
  it('stays within 300..850', () => {
    expect(creditScore(base)).toBeLessThanOrEqual(850);
    expect(creditScore({ ...base, onTime: 0, late: 20, utilization: 1, oldestAccountMonths: 0, hardInquiriesLast12: 9, hasInstallment: false, hasRevolving: false })).toBeGreaterThanOrEqual(300);
  });
  it('perfect behavior scores excellent', () => {
    expect(creditTier(creditScore(base))).toBe('excellent');
  });
  it('late payments and high utilization lower the score', () => {
    const good = creditScore(base);
    expect(creditScore({ ...base, late: 2, lateMonthsAgo: [1, 3] })).toBeLessThan(good);
    expect(creditScore({ ...base, utilization: 0.9 })).toBeLessThan(good);
    expect(creditScore({ ...base, hardInquiriesLast12: 4 })).toBeLessThan(good);
  });
  it('utilization factor is monotonic', () => {
    const us = [0, 0.1, 0.3, 0.5, 0.75, 1];
    for (let i = 1; i < us.length; i++) expect(utilizationFactor(us[i])).toBeLessThanOrEqual(utilizationFactor(us[i - 1]));
  });
  it('better score = lower loan rate', () => {
    expect(loanAprFor(800, 0.04, 'auto')).toBeLessThan(loanAprFor(600, 0.04, 'auto'));
    expect(creditTier(null)).toBe('none');
  });
});

describe('taxes', () => {
  it('progressive brackets', () => {
    expect(bracketTax(0)).toBe(0);
    expect(bracketTax(10000)).toBeCloseTo(1000);
    expect(bracketTax(50000)).toBeCloseTo(1192.5 + 4386 + 335.5, 2);
    expect(marginalRate(50000)).toBe(0.22);
  });
  it('effective rate is below the marginal rate', () => {
    const gross = 80000;
    expect(effectiveRate(gross)).toBeLessThan(marginalRate(gross - 15000));
  });
  it('paycheck deductions add up', () => {
    const p = paycheck(2000, 26, { retirementPct: 0.05, roth: false });
    const sum = p.federal + p.socialSecurity + p.medicare + p.city + p.retirement + p.net;
    expect(sum).toBeCloseTo(2000, 6);
    expect(p.socialSecurity).toBeCloseTo(124);
    const entry = paycheck(500, 26, { advanced: false });
    expect(entry.net).toBe(500);
  });
  it('traditional retirement lowers withholding vs roth', () => {
    expect(paycheck(3000, 26, { retirementPct: 0.1, roth: false }).federal).toBeLessThan(
      paycheck(3000, 26, { retirementPct: 0.1, roth: true }).federal,
    );
  });
  it('filing: deductions vs credits, refund vs owed', () => {
    const r = fileReturn({ wages: 40000, withheld: 3500 });
    expect(r.taxable).toBe(25000);
    expect(r.tax).toBeCloseTo(1192.5 + 13075 * 0.12, 2);
    expect(r.refund).toBeCloseTo(3500 - r.tax, 6);
    const withCredit = fileReturn({ wages: 40000, withheld: 3500, credits: 500 });
    expect(withCredit.tax).toBeCloseTo(r.tax - 500, 6);
    const itemized = fileReturn({ wages: 40000, withheld: 3500, itemized: 20000 });
    expect(itemized.taxable).toBe(20000);
  });
  it('sales tax only in advanced', () => {
    expect(withSalesTax(100, true).total).toBe(106);
    expect(withSalesTax(100, false).total).toBe(100);
  });
});

describe('net worth', () => {
  it('assets minus liabilities', () => {
    const w = createWorld({ name: 't', nickname: 'n', difficulty: 'advanced', seed: 1 });
    w.finance.cash = 100;
    w.finance.checking = 500;
    w.finance.savings = 1000;
    w.finance.holdings.FCX = { shares: 2, cost: 200 };
    w.assets.vehicles.push({ uid: 'v', itemId: 'bike', value: 80, price: 120, boughtMonth: 0 });
    w.finance.card.balance = 250;
    w.finance.loans.push({ id: 'l', kind: 'auto', name: 'car', principal: 300, balance: 300, apr: 0.05, termMonths: 12, payment: 26, monthsPaid: 0, startMonth: 0, missed: 0 });
    const nw = netWorth(w);
    expect(nw.assets).toBeCloseTo(100 + 500 + 1000 + 200 + 80);
    expect(nw.liabilities).toBeCloseTo(550);
    expect(nw.total).toBeCloseTo(1880 - 550);
  });
  it('leased vehicles are not assets', () => {
    const w = createWorld({ name: 't', nickname: 'n', difficulty: 'advanced', seed: 1 });
    w.finance.cash = 0;
    w.assets.vehicles.push({ uid: 'v', itemId: 'car', value: 20000, price: 20000, boughtMonth: 0, leased: true });
    expect(netWorth(w).total).toBe(0);
  });
});
