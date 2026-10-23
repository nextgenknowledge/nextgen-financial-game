/** Synthetic OHLCV candles for the Stock Exchange game. Indicators carry real (but imperfect) signal. */
import { makeRng } from '../rng';

export interface Candle {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function sma(values: number[], n: number): (number | null)[] {
  return values.map((_, i) => (i + 1 < n ? null : values.slice(i + 1 - n, i + 1).reduce((a, b) => a + b, 0) / n));
}

/**
 * Generates `count` candles plus `ahead` future candles. Trend regimes persist, so a rising
 * 20-period average with rising volume continues ~65% of the time, a learnable but noisy signal.
 */
export function generateCandles(seed: number, count = 40, ahead = 3, start = 50): { past: Candle[]; future: Candle[]; trend: number } {
  const rng = makeRng(seed);
  const all: Candle[] = [];
  let price = start;
  let trend = rng.pick([-1, 1]) * rng.range(0.004, 0.012);
  let left = rng.int(8, 20);
  for (let i = 0; i < count + ahead; i++) {
    if (--left <= 0) {
      // Trends usually continue; sometimes reverse
      trend = (rng.chance(0.7) ? Math.sign(trend) : -Math.sign(trend)) * rng.range(0.003, 0.014);
      left = rng.int(8, 20);
    }
    const ret = trend + rng.normal() * 0.018;
    const o = price;
    const c = Math.max(1, o * (1 + ret));
    const h = Math.max(o, c) * (1 + Math.abs(rng.normal()) * 0.008);
    const l = Math.min(o, c) * (1 - Math.abs(rng.normal()) * 0.008);
    // Volume is higher when the move is with the trend
    const v = Math.round(1000 * (1 + Math.abs(ret) * 25 + (Math.sign(ret) === Math.sign(trend) ? 0.4 : 0) + rng.next() * 0.5));
    all.push({ o, h, l, c, v });
    price = c;
  }
  return { past: all.slice(0, count), future: all.slice(count), trend };
}

/** Plain-language read of the chart, used for explanations. */
export function readChart(past: Candle[]): { label: string; bullish: boolean } {
  const closes = past.map((c) => c.c);
  const ma20 = sma(closes, 20);
  const ma5 = sma(closes, 5);
  const last = closes[closes.length - 1];
  const m20 = ma20[ma20.length - 1] ?? last;
  const m20prev = ma20[ma20.length - 6] ?? m20;
  const m5 = ma5[ma5.length - 1] ?? last;
  const rising = m20 > m20prev;
  const above = last > m20;
  const fast = m5 > m20;
  const recentVol = past.slice(-5).reduce((s, c) => s + c.v, 0) / 5;
  const olderVol = past.slice(-20, -5).reduce((s, c) => s + c.v, 0) / 15;
  const volUp = recentVol > olderVol;
  const votes = [rising, above, fast].filter(Boolean).length;
  const bullish = votes >= 2;
  const parts = [
    rising ? 'the 20-day average is rising' : 'the 20-day average is falling',
    above ? 'price is above it' : 'price is below it',
    fast ? 'the 5-day average is above the 20-day' : 'the 5-day average is below the 20-day',
    volUp ? 'volume is picking up' : 'volume is fading',
  ];
  return { label: parts.join(', '), bullish };
}
