/**
 * Market simulation: a market factor with regimes (bull / normal / bear), per-security beta and
 * idiosyncratic noise, news shocks, bonds that react to interest rates, quarterly earnings and
 * dividends. Each tick ≈ one trading day (21 per Fin City month).
 */
import companies from '@/data/companies.json';
import news from '@/data/news.json';
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import type { Rng } from '../rng';

export const TICKS_PER_MONTH = 21;
export const TICKS_PER_YEAR = TICKS_PER_MONTH * 12;
export const MAX_TICK_MOVE = 0.12; // ±12% per tick cap
export const HISTORY_LEN = 160;
export const MIN_PRICE = 1;

export interface Security {
  symbol: string;
  name: string;
  kind: 'stock' | 'index' | 'bond';
  sector: string;
  icon: string;
  price: number;
  mu: number;
  sigma: number;
  beta: number;
  dividend: number;
  eps: number;
  duration?: number;
  blurb: string;
  entryBlurb: string;
}

export const SECURITIES = companies.securities as Security[];
export const SECURITY_BY_SYMBOL = new Map(SECURITIES.map((s) => [s.symbol, s]));

export interface Headline {
  id: string;
  text: string;
  entryText: string;
  target: string;
  impact: number;
  ticks: number;
  why: string;
  direction?: 'up' | 'down' | 'flat';
  rateChange?: number;
}
export const HEADLINES = news.headlines as Headline[];

const REGIMES = {
  bull: { mu: 0.2, sigma: 0.13 },
  normal: { mu: 0.075, sigma: 0.16 },
  bear: { mu: -0.18, sigma: 0.26 },
};

export function affects(h: Headline, s: Security): boolean {
  return h.target === 'all' ? s.kind !== 'bond' : h.target === s.symbol || h.target === s.sector;
}

/** One trading day. Mutates prices/history; may publish a news headline. */
export function marketTick(w: WorldState, fx: Fx, rng: Rng) {
  const m = w.market;
  const dt = 1 / TICKS_PER_YEAR;
  // Regime switching → market cycles
  if (rng.chance(0.0035)) {
    const r = rng.next();
    m.regime = r < 0.3 ? 'bull' : r < 0.82 ? 'normal' : 'bear';
  }
  const reg = REGIMES[m.regime];
  const mkt = reg.mu * dt + reg.sigma * Math.sqrt(dt) * rng.normal();

  // News
  if (rng.chance(0.07)) {
    const h = rng.pick(HEADLINES);
    m.shocks.push({ sector: h.target, drift: h.impact / h.ticks, ticks: h.ticks });
    m.news.unshift({ month: w.time.month, tick: w.time.tick, id: h.id, text: h.text, symbols: SECURITIES.filter((s) => affects(h, s)).map((s) => s.symbol), impact: h.impact });
    if (m.news.length > 30) m.news.length = 30;
    if (h.rateChange) m.reserveRate = clampRate(m.reserveRate + h.rateChange);
    const held = SECURITIES.some((s) => affects(h, s) && (w.finance.holdings[s.symbol]?.shares ?? 0) > 0);
    if (held) fx.push({ type: 'toast', text: `📰 ${w.difficulty === 'entry' ? h.entryText : h.text}`, icon: h.impact >= 0 ? '📈' : '📉', tone: 'info' });
  }

  const normalMu = REGIMES.normal.mu;
  for (const s of SECURITIES) {
    let r: number;
    if (s.kind === 'bond') {
      // Bonds: coupon accrual plus a little noise; rate moves handled monthly.
      r = 0.0 + s.sigma * Math.sqrt(dt) * rng.normal() * 0.6;
    } else {
      const idio = Math.sqrt(Math.max(0, s.sigma * s.sigma - s.beta * s.beta * REGIMES.normal.sigma * REGIMES.normal.sigma));
      r = s.beta * mkt + (s.mu - s.beta * normalMu) * dt + idio * Math.sqrt(dt) * rng.normal();
    }
    for (const sh of m.shocks) {
      if (sh.sector === s.symbol || sh.sector === s.sector || (sh.sector === 'all' && s.kind !== 'bond')) r += sh.drift * (s.kind === 'index' ? 0.4 : 1);
    }
    r = Math.max(-MAX_TICK_MOVE, Math.min(MAX_TICK_MOVE, r));
    const p = Math.max(MIN_PRICE, m.prices[s.symbol] * Math.exp(r));
    m.prices[s.symbol] = Math.round(p * 100) / 100;
    const hist = (m.history[s.symbol] ??= []);
    hist.push(m.prices[s.symbol]);
    if (hist.length > HISTORY_LEN) hist.splice(0, hist.length - HISTORY_LEN);
  }
  for (const sh of m.shocks) sh.ticks--;
  m.shocks = m.shocks.filter((sh) => sh.ticks > 0);
}

function clampRate(r: number) {
  return Math.max(0.005, Math.min(0.09, Math.round(r * 10000) / 10000));
}

/**
 * Month-end market work: reserve-rate drift (moves bond prices), inflation, earnings growth,
 * quarterly dividends, and month-close history. Returns dividends paid.
 */
export function marketMonthEnd(w: WorldState, rng: Rng): { dividends: number; bondMove: number } {
  const m = w.market;
  // Reserve rate: slow mean-reverting random walk
  const oldRate = m.reserveRate;
  m.reserveRate = clampRate(oldRate + (0.035 - oldRate) * 0.05 + rng.normal() * 0.0015);
  const dy = m.reserveRate - oldRate;
  let bondMove = 0;
  for (const s of SECURITIES) {
    if (s.kind === 'bond') {
      const D = s.duration ?? 5;
      const move = -D * dy;
      bondMove = move;
      m.prices[s.symbol] = Math.max(MIN_PRICE, Math.round(m.prices[s.symbol] * (1 + move) * 100) / 100);
    }
  }
  // Inflation drifts around 3% (2% in Entry worlds), never negative for long
  const target = w.difficulty === 'entry' ? 0.02 : 0.03;
  m.inflation = Math.max(0, Math.min(0.09, m.inflation + (target - m.inflation) * 0.1 + rng.normal() * 0.002));
  m.priceIndex *= 1 + m.inflation / 12;

  // Quarterly: earnings growth & dividends (paid at end of Mar, Jun, Sep, Dec)
  let dividends = 0;
  const month = w.time.month % 12;
  if (month % 3 === 2) {
    for (const s of SECURITIES) {
      if (s.kind !== 'bond' && s.eps > 0) m.eps[s.symbol] = Math.max(0.05, (m.eps[s.symbol] ?? s.eps) * (1 + s.mu / 4 + rng.normal() * 0.03));
      const h = w.finance.holdings[s.symbol];
      if (h && h.shares > 0) {
        // Dividend grows with the company: yield on the original price, scaled by price growth for bonds/stocks alike
        const perShare = (s.dividend / 4) * Math.min(2, (m.prices[s.symbol] / s.price) ** 0.5);
        dividends += perShare * h.shares;
      }
    }
  }
  for (const s of SECURITIES) {
    const arr = (m.monthly[s.symbol] ??= []);
    arr.push(m.prices[s.symbol]);
    if (arr.length > 240) arr.splice(0, arr.length - 240);
  }
  return { dividends: Math.round(dividends * 100) / 100, bondMove };
}

export function peRatio(w: WorldState, symbol: string): number | null {
  const eps = w.market.eps[symbol];
  if (!eps || eps <= 0) return null;
  return w.market.prices[symbol] / eps;
}

export function dividendYield(w: WorldState, symbol: string): number {
  const s = SECURITY_BY_SYMBOL.get(symbol);
  if (!s) return 0;
  return s.dividend / w.market.prices[symbol];
}

/** Month-over-month return of a symbol (used for retirement account growth). */
export function monthReturn(w: WorldState, symbol: string): number {
  const arr = w.market.monthly[symbol];
  if (!arr || arr.length < 2) return 0;
  return arr[arr.length - 1] / arr[arr.length - 2] - 1;
}
