/** Night Market stall simulation: demand curve, weather, competition, spoilage, upgrades. Pure. */
import { makeRng } from '../rng';

export type Weather = 'sunny' | 'cloudy' | 'rain';
export const WEATHER_MULT: Record<Weather, number> = { sunny: 1, cloudy: 0.85, rain: 0.6 };

export interface NightSetup {
  weather: Weather;
  forecast: Weather;
  festival: boolean;
  competitorPrice: number;
}

export interface StallState {
  cash: number;
  reputation: number; // 0.7..1.3
  sign: boolean; // +15% demand
  steamer: boolean; // −20% unit cost
  night: number;
  totalProfit: number;
}

export const UNIT_COST = 0.6;
export const STALL_RENT = 10;
export const ELASTICITY = 1.6;

export function nights(seed: number, n: number): NightSetup[] {
  const rng = makeRng(seed);
  return Array.from({ length: n }, () => {
    const weather = rng.pick(['sunny', 'sunny', 'cloudy', 'rain'] as Weather[]);
    const forecast = rng.chance(0.8) ? weather : rng.pick(['sunny', 'cloudy', 'rain'] as Weather[]);
    return { weather, forecast, festival: rng.chance(0.2), competitorPrice: Math.round(rng.range(2.0, 3.0) * 4) / 4 };
  });
}

export function demand(s: StallState, night: NightSetup, price: number): number {
  const base = 120 * WEATHER_MULT[night.weather] * (night.festival ? 1.6 : 1) * s.reputation * (s.sign ? 1.15 : 1);
  return Math.max(0, Math.round(base * Math.pow(night.competitorPrice / Math.max(0.25, price), ELASTICITY)));
}

export interface NightResult {
  made: number;
  sold: number;
  demand: number;
  revenue: number;
  goodsCost: number;
  rent: number;
  profit: number;
  spoiled: number;
  stockout: boolean;
}

export function runNight(s: StallState, night: NightSetup, made: number, price: number): NightResult {
  const unit = UNIT_COST * (s.steamer ? 0.8 : 1);
  const d = demand(s, night, price);
  const sold = Math.min(made, d);
  const revenue = sold * price;
  const goodsCost = made * unit;
  const profit = revenue - goodsCost - STALL_RENT;
  const stockout = d > made * 1.2;
  // Reputation: running out disappoints; fair prices delight
  s.reputation = Math.max(0.7, Math.min(1.3, s.reputation + (stockout ? -0.05 : 0.02) + (price <= night.competitorPrice ? 0.02 : -0.02)));
  s.cash += profit;
  s.totalProfit += profit;
  s.night++;
  return { made, sold, demand: d, revenue, goodsCost, rent: STALL_RENT, profit, spoiled: made - sold, stockout };
}

/** Best possible single-night profit with perfect information (for scoring). */
export function bestNightProfit(s: StallState, night: NightSetup): number {
  let best = -Infinity;
  const copy = { ...s };
  for (let p = 1; p <= 5; p += 0.25) {
    const d = demand(copy, night, p);
    const unit = UNIT_COST * (copy.steamer ? 0.8 : 1);
    best = Math.max(best, d * p - d * unit - STALL_RENT);
  }
  return best;
}
