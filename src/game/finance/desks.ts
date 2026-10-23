/**
 * Models behind the Advanced pro desks. Pure functions, so the maths is unit-tested and the
 * components only handle the interface.
 */
import { makeRng, type Rng } from '../rng';

const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
const sd = (a: number[]) => {
  const m = mean(a);
  return Math.sqrt(mean(a.map((x) => (x - m) ** 2)));
};
export const quantile = (a: number[], q: number) => {
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.max(0, Math.floor(q * (s.length - 1))))];
};

/* ───────── Loan officer ───────── */

export interface Applicant {
  name: string;
  score: number;
  income: number; // monthly gross
  debts: number; // monthly payments already owed
  amount: number;
  years: number;
  secured: boolean;
  purpose: string;
}

export const COST_OF_FUNDS = 0.04;
export const PRIME = 0.07;
export const RISK_RATE = 0.13;

export function payment(principal: number, rate: number, months: number) {
  const r = rate / 12;
  return r === 0 ? principal / months : (principal * r) / (1 - (1 + r) ** -months);
}

export function dti(a: Applicant, rate = PRIME) {
  return (a.debts + payment(a.amount, rate, a.years * 12)) / a.income;
}

/** Probability the borrower defaults over the life of the loan. */
export function defaultProb(a: Applicant) {
  const z = -2.3 - (a.score - 680) / 42 + 7 * (dti(a) - 0.36) - (a.secured ? 0.5 : 0);
  return 1 / (1 + Math.exp(-z));
}

/** Expected profit of each decision: [approve at prime, approve at the risk rate, deny]. */
export function loanEV(a: Applicant): [number, number, number] {
  const pd = defaultProb(a);
  const lgd = a.secured ? 0.35 : 0.75;
  const life = a.years * 0.52; // average balance outstanding on an amortising loan, in years
  const ev = (rate: number) => a.amount * ((1 - pd) * (rate - COST_OF_FUNDS) * life - pd * lgd);
  // Strong borrowers shop around: most walk away from a high rate
  const accept = pd < 0.03 ? 0.2 : pd < 0.07 ? 0.3 : pd < 0.12 ? 0.75 : 0.95;
  return [ev(PRIME), ev(RISK_RATE) * accept, 0];
}

/* ───────── Futures hedge ───────── */

export interface HedgeCase {
  id: 'airline' | 'farmer' | 'fund';
  title: string;
  brief: string;
  /** +1 = needs to buy the asset later (hedge long), -1 = owns it and will sell (hedge short). */
  side: 1 | -1;
  exposure: number; // units of the underlying, or portfolio value for the fund
  spot: number;
  contractSize: number; // units per contract, or index multiplier
  beta?: number;
  unit: string;
  vol: number; // weekly volatility
  margin: number; // initial margin per contract
  maint: number; // maintenance margin per contract
}

/** Minimum-variance number of contracts. */
export function hedgeContracts(c: HedgeCase) {
  if (c.id === 'fund') return Math.round(((c.beta ?? 1) * c.exposure) / (c.spot * c.contractSize));
  return Math.round(c.exposure / c.contractSize);
}

/** Weekly futures prices for a case, seeded. */
export function hedgePath(c: HedgeCase, seed: number, weeks = 12) {
  const rng = makeRng(seed);
  const drift = rng.pick([-1, 1]) * rng.range(0.008, 0.02);
  const out = [c.spot];
  for (let i = 0; i < weeks; i++) out.push(out[i] * (1 + drift + c.vol * rng.normal()));
  return out;
}

/**
 * The hedger's result: change in the value of their exposure plus the futures P&L.
 * `contracts` is signed: + long, - short.
 */
export function hedgeOutcome(c: HedgeCase, path: number[], contracts: number) {
  const f0 = path[0];
  const f1 = path[path.length - 1];
  const units = c.id === 'fund' ? (c.beta ?? 1) * (c.exposure / f0) : c.exposure;
  // Exposure: an airline loses when fuel rises (side +1), a farmer/fund loses when prices fall
  const exposurePnl = -c.side * units * (f1 - f0);
  const futuresPnl = contracts * c.contractSize * (f1 - f0);
  return { exposurePnl, futuresPnl, net: exposurePnl + futuresPnl };
}

/* ───────── Supply chain ───────── */

export interface ShipMode {
  id: 'sea' | 'rail' | 'air';
  name: string;
  perKg: number;
  days: number;
  spread: number; // ± days of uncertainty
}

export const MODES: ShipMode[] = [
  { id: 'sea', name: 'Ocean freight', perKg: 0.18, days: 30, spread: 7 },
  { id: 'rail', name: 'Rail freight', perKg: 0.9, days: 18, spread: 3 },
  { id: 'air', name: 'Air freight', perKg: 4.2, days: 4, spread: 1 },
];

export interface Shipment {
  product: string;
  units: number;
  kgPerUnit: number;
  unitValue: number;
  margin: number; // profit per unit sold
  dueIn: number; // days until the stock is needed
}

/** Expected landed cost of shipping by a mode: freight + inventory carrying + expected lost sales. */
export function shipCost(s: Shipment, m: ShipMode, carry = 0.25) {
  let late = 0;
  let early = 0;
  // Lead time spread uniformly over ±spread days
  for (let k = -m.spread; k <= m.spread; k++) {
    const arrive = m.days + k;
    late += Math.min(1, Math.max(0, arrive - s.dueIn) / 10);
    early += Math.max(0, s.dueIn - arrive);
  }
  const n = 2 * m.spread + 1;
  const freight = s.units * s.kgPerUnit * m.perKg;
  const holding = (s.units * s.unitValue * carry * (early / n + m.days)) / 365;
  const lost = s.units * s.margin * (late / n);
  return { freight, holding, lost, total: freight + holding + lost };
}

/* ───────── Fintech unit economics ───────── */

export interface FintechPlan {
  price: number; // $ per month
  trial: 0 | 7 | 30;
  spend: number; // marketing $ per month
}

export function fintechSim(p: FintechPlan, months = 24, seed = 1) {
  const rng = makeRng(seed);
  const trialLift = p.trial === 30 ? 1.45 : p.trial === 7 ? 1.2 : 1;
  const trialConvert = p.trial === 30 ? 0.62 : p.trial === 7 ? 0.88 : 1;
  // $ per paying customer; the cheapest channels fill up first, so heavy spending gets dearer
  const cac = ((14 + 2.4 * p.price) / (trialLift * trialConvert)) * (1 + p.spend / 90_000);
  const churn = 0.018 + 0.0028 * p.price - (p.trial === 30 ? 0.004 : p.trial === 7 ? 0.002 : 0);
  const margin = 0.78;
  const fixed = 45_000;
  let subs = 0;
  let cash = 1_500_000;
  let minCash = cash;
  const mrr: number[] = [];
  const cashPath: number[] = [];
  for (let m = 0; m < months; m++) {
    const added = (p.spend / cac) * (1 + 0.04 * rng.normal()) + subs * 0.012; // a little word of mouth
    subs = Math.max(0, subs * (1 - churn) + added);
    const rev = subs * p.price;
    cash += rev * margin - p.spend - fixed;
    minCash = Math.min(minCash, cash);
    mrr.push(rev);
    cashPath.push(cash);
  }
  const ltv = (p.price * margin) / churn;
  return { subs, mrr, cashPath, cash, minCash, cac, churn, ltv, ltvCac: ltv / cac };
}

/** Score of a plan: growth that pays for itself and never runs out of money. */
export function fintechScore(p: FintechPlan) {
  const s = fintechSim(p);
  if (s.minCash < 0) return 0;
  const ratio = Math.min(1, s.ltvCac / 3);
  return ratio * s.mrr[s.mrr.length - 1];
}

export function bestFintech() {
  let best = { p: { price: 9, trial: 7, spend: 40_000 } as FintechPlan, v: -1 };
  for (let price = 3; price <= 20; price++)
    for (const trial of [0, 7, 30] as const)
      for (let spend = 10_000; spend <= 100_000; spend += 5_000) {
        const v = fintechScore({ price, trial, spend });
        if (v > best.v) best = { p: { price, trial, spend }, v };
      }
  return best;
}

/* ───────── Backtesting ───────── */

export function pricePath(seed: number, n: number, regime: 'trend' | 'chop') {
  const rng = makeRng(seed);
  const out = [100];
  let x = 0;
  for (let i = 1; i < n; i++) {
    if (regime === 'trend') {
      // Long drifting legs with a crash in the middle
      const leg = Math.floor(i / 70) % 3;
      const mu = leg === 1 ? -0.0016 : 0.0013;
      out.push(out[i - 1] * (1 + mu + 0.011 * rng.normal()));
    } else {
      // Mean-reverting around a slow drift
      x = 0.9 * x + 0.016 * rng.normal();
      out.push(100 * (1 + 0.0002 * i) * Math.exp(x));
    }
  }
  return out;
}

export interface Strategy {
  kind: 'trend' | 'revert';
  fast: number; // trend: fast MA · revert: lookback
  slow: number; // trend: slow MA · revert: entry z-score × 10
}

const sma = (p: number[], i: number, n: number) => {
  let s = 0;
  for (let k = i - n + 1; k <= i; k++) s += p[k];
  return s / n;
};

/** Daily long/flat positions decided at each close, applied to the next day's return. */
export function backtest(p: number[], st: Strategy, cost = 0.001) {
  const warm = st.kind === 'trend' ? st.slow : st.fast;
  const eq = [1];
  const bh = [1];
  let pos = 0;
  let trades = 0;
  for (let i = 1; i < p.length; i++) {
    const r = p[i] / p[i - 1] - 1;
    eq.push(eq[i - 1] * (1 + pos * r));
    bh.push(bh[i - 1] * (1 + r));
    if (i < warm) continue;
    let want = pos;
    if (st.kind === 'trend') want = sma(p, i, st.fast) > sma(p, i, st.slow) ? 1 : 0;
    else {
      const win = p.slice(i - st.fast + 1, i + 1);
      const z = (p[i] - mean(win)) / (sd(win) || 1);
      if (z < -st.slow / 10) want = 1;
      else if (z > 0) want = 0;
    }
    if (want !== pos) {
      trades++;
      eq[i] *= 1 - cost;
      pos = want;
    }
  }
  return { eq, bh, trades, ...metrics(eq), bhStats: metrics(bh) };
}

export function metrics(eq: number[]) {
  const rets = eq.slice(1).map((v, i) => v / eq[i] - 1);
  const years = rets.length / 252;
  const cagr = eq[eq.length - 1] ** (1 / years) - 1;
  const vol = sd(rets) * Math.sqrt(252);
  let peak = eq[0];
  let mdd = 0;
  for (const v of eq) {
    peak = Math.max(peak, v);
    mdd = Math.min(mdd, v / peak - 1);
  }
  const sharpe = vol > 0 ? (mean(rets) * 252) / vol : 0;
  return { cagr, vol, mdd, sharpe };
}

export function bestStrategy(p: number[], kind: Strategy['kind']) {
  let best = { st: { kind, fast: 10, slow: 50 } as Strategy, sharpe: -9 };
  const fs = kind === 'trend' ? [5, 10, 15, 20, 30, 40, 50] : [10, 15, 20, 30, 40];
  const ss = kind === 'trend' ? [30, 50, 80, 100, 150, 200] : [5, 10, 15, 20, 25];
  for (const fast of fs)
    for (const slow of ss) {
      if (kind === 'trend' && slow <= fast) continue;
      const s = backtest(p, { kind, fast, slow }).sharpe;
      if (s > best.sharpe) best = { st: { kind, fast, slow }, sharpe: s };
    }
  return best;
}

/* ───────── Sovereign fund ───────── */

export interface FundAsset {
  name: string;
  ret: number; // nominal expected return
  vol: number;
}

export const FUND_ASSETS: FundAsset[] = [
  { name: 'Government bonds', ret: 0.04, vol: 0.06 },
  { name: 'Developed equities', ret: 0.075, vol: 0.16 },
  { name: 'Emerging equities', ret: 0.09, vol: 0.23 },
  { name: 'Real estate', ret: 0.065, vol: 0.13 },
  { name: 'Infrastructure', ret: 0.07, vol: 0.1 },
];
const FUND_CORR = [
  [1, -0.1, 0, 0.1, 0.2],
  [-0.1, 1, 0.75, 0.55, 0.45],
  [0, 0.75, 1, 0.5, 0.4],
  [0.1, 0.55, 0.5, 1, 0.5],
  [0.2, 0.45, 0.4, 0.5, 1],
];

/** Cholesky factor of a small correlation matrix. */
function chol(m: number[][]) {
  const n = m.length;
  const L = m.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++)
    for (let j = 0; j <= i; j++) {
      let s = m[i][j];
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      L[i][j] = i === j ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j];
    }
  return L;
}
const FUND_L = chol(FUND_CORR);

export const INFLATION = 0.025;

/** Monte Carlo of a fund paying out `spend` of its value every year, in real terms. */
export function fundSim(weights: number[], spend: number, seed = 7, paths = 300, years = 30) {
  const rng: Rng = makeRng(seed);
  const tot = weights.reduce((a, b) => a + b, 0) || 1;
  const w = weights.map((x) => x / tot);
  const ends: number[] = [];
  const mids: number[][] = Array.from({ length: years + 1 }, () => []);
  let breaches = 0;
  let paid = 0;
  for (let p = 0; p < paths; p++) {
    let v = 1;
    let low = 1;
    mids[0].push(1);
    for (let y = 1; y <= years; y++) {
      const z = FUND_ASSETS.map(() => rng.normal());
      let r = 0;
      FUND_ASSETS.forEach((a, i) => {
        let e = 0;
        for (let k = 0; k <= i; k++) e += FUND_L[i][k] * z[k];
        r += w[i] * (a.ret + a.vol * e);
      });
      v = (v * (1 + r)) / (1 + INFLATION);
      paid += v * spend;
      v *= 1 - spend;
      low = Math.min(low, v);
      mids[y].push(v);
    }
    if (low < 0.5) breaches++;
    ends.push(v);
  }
  return {
    median: quantile(ends, 0.5),
    p10: quantile(ends, 0.1),
    p90: quantile(ends, 0.9),
    breach: breaches / paths,
    avgPaid: paid / paths / years,
    fan: mids.map((ys) => [quantile(ys, 0.1), quantile(ys, 0.5), quantile(ys, 0.9)] as [number, number, number]),
  };
}

/** A mandate score: keep real value, protect the downside, pay the country a steady dividend. */
export function fundScore(r: ReturnType<typeof fundSim>, spend: number) {
  const keep = Math.min(1, r.median / 1);
  const safe = Math.min(1, r.p10 / 0.55);
  const pay = Math.min(1, spend / 0.035);
  return Math.max(0, Math.min(1, keep * 0.4 + safe * 0.35 + pay * 0.25 - r.breach * 0.6));
}

/* ───────── Fraud operations ───────── */

export interface Txn {
  id: number;
  merchant: string;
  category: string;
  amount: number;
  usual: number; // customer's typical spend
  km: number; // distance from home
  hour: number;
  newDevice: boolean;
  velocity: number; // transactions in the last hour
  p: number; // true fraud probability
  fraud: boolean;
}

export const FRICTION = 25; // cost of wrongly blocking a good customer (support call, lost trust)

export function fraudProb(t: Omit<Txn, 'p' | 'fraud' | 'id'>) {
  const z = -4.2 + 1.1 * Math.log(Math.max(1, t.amount / t.usual)) + (t.km > 500 ? 1.4 : t.km > 50 ? 0.5 : 0) + (t.hour < 5 ? 0.9 : 0) + (t.newDevice ? 1.3 : 0) + 0.45 * Math.max(0, t.velocity - 1) + (['Gift cards', 'Crypto exchange', 'Electronics'].includes(t.category) ? 1 : 0);
  return 1 / (1 + Math.exp(-z));
}

/** The cost of a set of decisions: missed fraud is lost in full, blocked good customers cost FRICTION. */
export function fraudCost(txns: Txn[], flagged: boolean[]) {
  let cost = 0;
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let tn = 0;
  txns.forEach((t, i) => {
    if (flagged[i] && t.fraud) tp++;
    else if (flagged[i]) (fp++, (cost += FRICTION));
    else if (t.fraud) (fn++, (cost += t.amount));
    else tn++;
  });
  return { cost, tp, fp, fn, tn, precision: tp / Math.max(1, tp + fp), recall: tp / Math.max(1, tp + fn) };
}

/* ───────── Small business: vet practice ───────── */

export interface VetMonth {
  checkup: number;
  surgery: number;
  vets: number;
  insurance: boolean;
}

export const VET_FIXED = 9_000;
export const VET_SALARY = 11_000;

export function vetMonth(d: VetMonth, season = 1) {
  const lift = d.insurance ? 1.2 : 1;
  const wantCheck = 520 * Math.exp(-(d.checkup - 60) / 45) * season * lift;
  const wantSurg = 18 * Math.exp(-(d.surgery - 1100) / 700) * season * lift;
  const visits = Math.min(wantCheck, 260 * d.vets);
  const surgeries = Math.min(wantSurg, 12 * d.vets);
  const revenue = visits * d.checkup + surgeries * d.surgery;
  const costs = visits * 14 + surgeries * 280 + VET_FIXED + VET_SALARY * d.vets;
  // Insurers pay 92% of the bill, a month late
  const billed = d.insurance ? revenue * 0.5 : 0;
  const cashIn = revenue - billed;
  const receivable = billed * 0.92;
  const profit = revenue - (d.insurance ? billed * 0.08 : 0) - costs;
  return { visits, surgeries, revenue, costs, profit, cashIn, receivable, turnedAway: wantCheck - visits + (wantSurg - surgeries) * 10 };
}

export function bestVetMonth(season = 1) {
  let best = { d: { checkup: 60, surgery: 1100, vets: 1, insurance: false } as VetMonth, profit: -Infinity };
  for (let checkup = 40; checkup <= 120; checkup += 5)
    for (let surgery = 600; surgery <= 2000; surgery += 100)
      for (let vets = 1; vets <= 3; vets++)
        for (const insurance of [false, true]) {
          const p = vetMonth({ checkup, surgery, vets, insurance }, season).profit;
          if (p > best.profit) best = { d: { checkup, surgery, vets, insurance }, profit: p };
        }
  return best;
}
