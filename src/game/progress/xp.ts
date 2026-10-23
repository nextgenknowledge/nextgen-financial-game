import type { WorldState } from '../types';
import type { Fx } from '../effects';
import community from '@/data/community.json';
import { currentSeason } from './seasonal';

/** Total XP needed to reach a level. Level 2 = 80 XP, level 10 ≈ 2,700, level 20 ≈ 8,800. */
export function xpForLevel(level: number): number {
  return Math.round(80 * Math.pow(Math.max(0, level - 1), 1.6));
}

export function levelForXp(xp: number): number {
  let l = 1;
  while (xpForLevel(l + 1) <= xp && l < 99) l++;
  return l;
}

/** Happiness above 70 boosts XP up to +15%; community projects can add more. */
export function xpMultiplier(w: WorldState): number {
  const h = w.player.happiness;
  let m = 1 + Math.max(0, h - 70) * 0.005;
  for (const p of community.projects) {
    if ((w.progress.community[p.id] ?? 0) >= p.cost && 'xpBoost' in p && p.xpBoost) m += p.xpBoost as number;
  }
  m += currentSeason()?.xpBoost ?? 0;
  return m;
}

export function grantXp(w: WorldState, fx: Fx, amount: number, opts: { raw?: boolean } = {}) {
  const gained = Math.round(opts.raw ? amount : amount * xpMultiplier(w));
  if (gained <= 0) return 0;
  w.progress.xp += gained;
  const newLevel = levelForXp(w.progress.xp);
  while (w.progress.level < newLevel) {
    w.progress.level++;
    fx.push({ type: 'levelUp', level: w.progress.level });
    // A small level-up bonus keeps leveling exciting
    const bonus = 10 * w.progress.level;
    w.finance.cash += bonus;
    fx.push({ type: 'toast', text: `Level ${w.progress.level} bonus: +$${bonus}`, icon: '🎁', tone: 'gold' });
  }
  return gained;
}

export function addStat(w: WorldState, key: string, by = 1) {
  w.progress.stats[key] = (w.progress.stats[key] ?? 0) + by;
}

export function setStatMax(w: WorldState, key: string, value: number) {
  w.progress.stats[key] = Math.max(w.progress.stats[key] ?? 0, value);
}
