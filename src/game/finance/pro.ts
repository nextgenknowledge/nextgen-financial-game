/**
 * Maths behind the Advanced "pro desk" activities: discounted cash flow valuation, bond pricing
 * and duration, two-fund-and-beyond portfolio statistics, and venture cap tables. Pure functions,
 * unit-tested in tests/pro.test.ts.
 */

/* ───────── Discounted cash flow ───────── */

export interface DcfInput {
  /** Free cash flow expected next year ($M). */
  fcf1: number;
  /** Growth rate for years 1-5 (0.08 = 8%). */
  growth: number;
  /** Long-run growth after year 5. */
  terminal: number;
  /** Discount rate (weighted average cost of capital). */
  wacc: number;
  /** Debt minus cash ($M). */
  netDebt: number;
  /** Shares outstanding (millions). */
  shares: number;
}

export interface DcfOut {
  years: { t: number; fcf: number; df: number; pv: number }[];
  terminalValue: number;
  pvTerminal: number;
  enterpriseValue: number;
  equityValue: number;
  perShare: number;
}

export function dcf(i: DcfInput): DcfOut {
  const years = [];
  let fcf = i.fcf1;
  let sum = 0;
  for (let t = 1; t <= 5; t++) {
    if (t > 1) fcf *= 1 + i.growth;
    const df = 1 / Math.pow(1 + i.wacc, t);
    years.push({ t, fcf, df, pv: fcf * df });
    sum += fcf * df;
  }
  const terminalValue = (fcf * (1 + i.terminal)) / Math.max(0.005, i.wacc - i.terminal);
  const pvTerminal = terminalValue / Math.pow(1 + i.wacc, 5);
  const enterpriseValue = sum + pvTerminal;
  const equityValue = enterpriseValue - i.netDebt;
  return { years, terminalValue, pvTerminal, enterpriseValue, equityValue, perShare: equityValue / i.shares };
}

/** Analyst rating from upside to fair value: more than +15% Buy, below -15% Sell, else Hold. */
export function rating(fair: number, price: number): 'Buy' | 'Hold' | 'Sell' {
  const up = fair / price - 1;
  return up > 0.15 ? 'Buy' : up < -0.15 ? 'Sell' : 'Hold';
}

/* ───────── Bonds (annual coupons) ───────── */

export function bondPrice(face: number, coupon: number, years: number, ytm: number) {
  let p = 0;
  for (let t = 1; t <= years; t++) p += (face * coupon) / Math.pow(1 + ytm, t);
  return p + face / Math.pow(1 + ytm, years);
}

/** Macaulay duration in years. */
export function macaulay(face: number, coupon: number, years: number, ytm: number) {
  const price = bondPrice(face, coupon, years, ytm);
  let w = 0;
  for (let t = 1; t <= years; t++) w += (t * face * coupon) / Math.pow(1 + ytm, t);
  w += (years * face) / Math.pow(1 + ytm, years);
  return w / price;
}

export function modifiedDuration(face: number, coupon: number, years: number, ytm: number) {
  return macaulay(face, coupon, years, ytm) / (1 + ytm);
}

/* ───────── Portfolios ───────── */

export interface Asset {
  name: string;
  ret: number;
  vol: number;
}

export function portfolioStats(assets: Asset[], corr: number[][], w: number[], rf: number) {
  let ret = 0;
  let variance = 0;
  for (let i = 0; i < assets.length; i++) {
    ret += w[i] * assets[i].ret;
    for (let j = 0; j < assets.length; j++) variance += w[i] * w[j] * assets[i].vol * assets[j].vol * corr[i][j];
  }
  const vol = Math.sqrt(Math.max(0, variance));
  return { ret, vol, sharpe: vol > 0 ? (ret - rf) / vol : 0 };
}

/**
 * Searches long-only weights on a 5% grid for the best portfolio by `score` (exact enough for a
 * game and fully deterministic).
 */
export function bestPortfolio(assets: Asset[], corr: number[][], rf: number, score: (s: ReturnType<typeof portfolioStats>) => number) {
  const n = assets.length;
  let best = { w: Array(n).fill(1 / n) as number[], s: portfolioStats(assets, corr, Array(n).fill(1 / n), rf), v: -Infinity };
  const step = 5;
  const rec = (i: number, left: number, cur: number[]) => {
    if (i === n - 1) {
      const w = [...cur, left].map((x) => x / 100);
      const s = portfolioStats(assets, corr, w, rf);
      const v = score(s);
      if (v > best.v) best = { w, s, v };
      return;
    }
    for (let x = 0; x <= left; x += step) rec(i + 1, left - x, [...cur, x]);
  };
  rec(0, 100, []);
  return best;
}

/* ───────── Venture cap tables ───────── */

export interface Holder {
  name: string;
  shares: number;
  /** Preferred investors: amount invested (for a 1x non-participating preference). */
  invested?: number;
}

/** Issue new shares to an investor at a pre-money valuation. */
export function priceRound(table: Holder[], investor: string, invest: number, preMoney: number) {
  const before = table.reduce((s, h) => s + h.shares, 0);
  const price = preMoney / before;
  const newShares = invest / price;
  const out = [...table.map((h) => ({ ...h })), { name: investor, shares: newShares, invested: invest }];
  return { table: out, price, postMoney: preMoney + invest, newShares };
}

export const ownership = (table: Holder[], name: string) => {
  const total = table.reduce((s, h) => s + h.shares, 0);
  return (table.find((h) => h.name === name)?.shares ?? 0) / total;
};

/**
 * Exit waterfall with 1x non-participating preferred: each investor takes the larger of its money
 * back or converting to common; common holders share what is left.
 */
export function exitPayouts(table: Holder[], exit: number) {
  const total = table.reduce((s, h) => s + h.shares, 0);
  // Decide conversion: an investor converts if its pro-rata share beats its preference
  const prefs = table.filter((h) => h.invested);
  const converts = new Set(prefs.filter((h) => (h.shares / total) * exit >= (h.invested ?? 0)).map((h) => h.name));
  let left = exit;
  const out: Record<string, number> = {};
  for (const h of prefs) {
    if (converts.has(h.name)) continue;
    const take = Math.min(left, h.invested ?? 0);
    out[h.name] = take;
    left -= take;
  }
  const commonShares = table.filter((h) => !h.invested || converts.has(h.name)).reduce((s, h) => s + h.shares, 0);
  for (const h of table) if (!h.invested || converts.has(h.name)) out[h.name] = (left * h.shares) / commonShares;
  return out;
}
