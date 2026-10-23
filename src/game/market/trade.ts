import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { spend, receive } from '../finance/accounts';
import { round2 } from '../finance/interest';
import { recordEvent } from '../progress/events';
import { SECURITY_BY_SYMBOL } from './market';

/** Buy `dollars` worth of a security (fractional shares are allowed). */
export function buySecurity(w: WorldState, fx: Fx, symbol: string, dollars: number): boolean {
  const s = SECURITY_BY_SYMBOL.get(symbol);
  const price = w.market.prices[symbol];
  dollars = round2(dollars);
  if (!s || !price || dollars < 1) return false;
  if (!spend(w, fx, dollars, `Bought ${symbol}`)) return false;
  w.finance.monthSpending -= dollars; // investing isn't spending
  const shares = dollars / price;
  const h = (w.finance.holdings[symbol] ??= { shares: 0, cost: 0 });
  h.shares += shares;
  h.cost = round2(h.cost + dollars);
  fx.push({ type: 'toast', text: `Bought ${shares.toFixed(shares < 1 ? 3 : 2)} shares of ${s.name} for $${dollars.toFixed(2)}`, icon: s.icon, tone: 'good' });
  fx.push({ type: 'sfx', name: 'cash' });
  recordEvent(w, fx, { type: 'invest', target: symbol, value: dollars });
  w.progress.flags.brokerageApp = true;
  return true;
}

/** Sell `fraction` (0..1] of a holding. */
export function sellSecurity(w: WorldState, fx: Fx, symbol: string, fraction: number): boolean {
  const h = w.finance.holdings[symbol];
  const price = w.market.prices[symbol];
  if (!h || h.shares <= 0 || !price) return false;
  fraction = Math.max(0, Math.min(1, fraction));
  const shares = h.shares * fraction;
  const proceeds = round2(shares * price);
  const basis = round2(h.cost * fraction);
  h.shares -= shares;
  h.cost = round2(h.cost - basis);
  if (h.shares < 1e-6) delete w.finance.holdings[symbol];
  receive(w, proceeds, `Sold ${symbol}`);
  w.finance.monthIncome -= proceeds; // selling isn't income…
  const gain = round2(proceeds - basis);
  if (gain > 0) w.finance.monthIncome += gain; // …but the gain is
  if (w.difficulty === 'advanced' && gain > 0) w.finance.tax.ytdOther += gain;
  fx.push({ type: 'toast', text: `Sold for $${proceeds.toFixed(2)}, ${gain >= 0 ? 'gain' : 'loss'} of $${Math.abs(gain).toFixed(2)}`, icon: gain >= 0 ? '📈' : '📉', tone: gain >= 0 ? 'good' : 'info' });
  fx.push({ type: 'sfx', name: 'coin' });
  recordEvent(w, fx, { type: 'sellStock', target: symbol, value: gain });
  return true;
}
