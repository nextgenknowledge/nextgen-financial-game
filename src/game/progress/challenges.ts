import data from '@/data/challenges.json';
import type { LocationId, WorldState } from '../types';
import { sameActivity, textFor } from '../activities';
import type { Fx } from '../effects';
import type { GameEvent } from './events';
import { hashString, makeRng } from '../rng';
import { grantXp } from './xp';

export interface ChallengeDef {
  id: string;
  text: string;
  proText?: string;
  icon: string;
  event: { type: string; target?: string; correct?: boolean; minStars?: number; city?: string };
  count: number;
  useValue?: boolean;
  alt?: string[];
  reward: { cash?: number; xp?: number };
  requires?: { unlocked?: string };
}

export const DAILY = data.daily as ChallengeDef[];
export const WEEKLY = data.weekly as ChallengeDef[];
const ALL = new Map([...DAILY, ...WEEKLY].map((c) => [c.id, c]));

export function todayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function weekKey(d = new Date()): string {
  // ISO-ish week: Monday-based
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${week}`;
}

function pick(pool: ChallengeDef[], w: WorldState, seedKey: string, n: number) {
  const eligible = pool.filter((c) => !c.requires?.unlocked || w.progress.unlocked.includes(c.requires.unlocked as LocationId));
  const rng = makeRng(hashString(seedKey + w.id));
  return rng.shuffle([...eligible]).slice(0, n).map((c) => ({ id: c.id, progress: 0, claimed: false }));
}

/** Rolls new daily/weekly challenges when the real date changes. Only after onboarding starts London. */
export function refreshChallenges(w: WorldState, now = new Date()) {
  const dk = todayKey(now);
  if (w.progress.daily.date !== dk) w.progress.daily = { date: dk, list: pick(DAILY, w, dk, 3) };
  const wk = weekKey(now);
  if (w.progress.weekly.week !== wk) w.progress.weekly = { week: wk, list: pick(WEEKLY, w, wk, 3) };
}

function matches(c: ChallengeDef, ev: GameEvent): number {
  const e = c.event;
  if (ev.type !== e.type && !(c.alt ?? []).includes(ev.type) && !(c.alt ?? []).some((a) => sameActivity(ev.target, a))) return 0;
  if (ev.type === e.type) {
    if (e.target && !sameActivity(ev.target, e.target) && !(c.alt ?? []).some((a) => sameActivity(ev.target, a))) return 0;
    if (e.correct !== undefined && ev.correct !== e.correct) return 0;
    if (e.minStars && (ev.stars ?? 0) < e.minStars) return 0;
    if (e.city && ev.city !== e.city) return 0;
  }
  return c.useValue ? ev.value ?? 0 : 1;
}

export function challengesOnEvent(w: WorldState, fx: Fx, ev: GameEvent) {
  for (const list of [w.progress.daily.list, w.progress.weekly.list]) {
    for (const s of list) {
      const c = ALL.get(s.id);
      if (!c || s.progress >= c.count) continue;
      const inc = matches(c, ev);
      if (!inc) continue;
      s.progress = Math.min(c.count, s.progress + inc);
      if (s.progress >= c.count) {
        fx.push({ type: 'toast', text: `Challenge done: ${textFor(c, w.difficulty)}, claim it in FinPhone!`, icon: c.icon, tone: 'gold' });
        fx.push({ type: 'sfx', name: 'star' });
      }
    }
  }
}

export function claimChallenge(w: WorldState, fx: Fx, id: string) {
  for (const list of [w.progress.daily.list, w.progress.weekly.list]) {
    const s = list.find((x) => x.id === id);
    const c = ALL.get(id);
    if (!s || !c || s.claimed || s.progress < c.count) continue;
    s.claimed = true;
    if (c.reward.cash) w.finance.cash += c.reward.cash;
    if (c.reward.xp) grantXp(w, fx, c.reward.xp);
    w.progress.stats.challengesClaimed = (w.progress.stats.challengesClaimed ?? 0) + 1;
    fx.push({ type: 'sfx', name: 'cash' });
    fx.push({ type: 'confetti' });
  }
}

export function challengeDef(id: string) {
  return ALL.get(id);
}
