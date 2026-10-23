import type { NetWorthPoint, OwnedBusiness, WorldState } from '../types';

export function businessValue(b: OwnedBusiness): number {
  const trailing = b.profits.slice(-12);
  const annualized = trailing.length ? (trailing.reduce((s, p) => s + p, 0) / trailing.length) * 12 : 0;
  return Math.max(b.invested * 0.5, 3 * annualized);
}

export function portfolioValue(w: WorldState): number {
  let v = 0;
  for (const [sym, h] of Object.entries(w.finance.holdings)) v += h.shares * (w.market.prices[sym] ?? 0);
  return v;
}

export interface NetWorthBreakdown {
  cash: number;
  checking: number;
  savings: number;
  cds: number;
  investments: number;
  retirement: number;
  startups: number;
  businesses: number;
  property: number;
  vehicles: number;
  items: number;
  assets: number;
  loans: number;
  mortgage: number;
  card: number;
  bills: number;
  taxes: number;
  liabilities: number;
  total: number;
}

export function netWorth(w: WorldState): NetWorthBreakdown {
  const f = w.finance;
  const a = w.assets;
  const cash = f.cash;
  const checking = f.checking;
  const savings = f.savings;
  const cds = f.cds.reduce((s, c) => s + c.value, 0);
  const investments = portfolioValue(w);
  const retirement = f.retirement.balance;
  const startups = f.startups.filter((s) => s.outcome === undefined).reduce((s, x) => s + x.amount, 0);
  const businesses = a.businesses.reduce((s, b) => s + businessValue(b), 0);
  const property = a.properties.reduce((s, p) => s + p.value, 0);
  const vehicles = a.vehicles.filter((v) => !v.leased).reduce((s, v) => s + v.value, 0);
  const items = a.items.reduce((s, i) => s + i.value, 0);
  const assets = cash + checking + savings + cds + investments + retirement + startups + businesses + property + vehicles + items;

  const mortgage = f.loans.filter((l) => l.kind === 'mortgage').reduce((s, l) => s + l.balance, 0);
  const loans = f.loans.filter((l) => l.kind !== 'mortgage').reduce((s, l) => s + l.balance, 0);
  const card = f.card.balance;
  const bills = f.unpaidBills;
  const taxes = f.tax.owed;
  const liabilities = loans + mortgage + card + bills + taxes;
  return {
    cash,
    checking,
    savings,
    cds,
    investments,
    retirement,
    startups,
    businesses,
    property,
    vehicles,
    items,
    assets,
    loans,
    mortgage,
    card,
    bills,
    taxes,
    liabilities,
    total: assets - liabilities,
  };
}

export function netWorthPoint(w: WorldState): NetWorthPoint {
  const b = netWorth(w);
  return {
    month: w.time.month,
    total: round(b.total),
    cash: round(b.cash),
    bank: round(b.checking + b.savings + b.cds),
    investments: round(b.investments + b.retirement + b.startups),
    property: round(b.property + b.businesses),
    other: round(b.vehicles + b.items),
    debt: round(b.liabilities),
  };
}

const round = (x: number) => Math.round(x * 100) / 100;

/** Money the player can spend right now without borrowing. */
export function spendable(w: WorldState): number {
  return w.finance.cash + w.finance.checking;
}
