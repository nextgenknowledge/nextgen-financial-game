/**
 * Daily login streak. Each calendar day (the player's own time zone) a world is played counts once:
 * the first visit of the day pays a little XP and money, more the longer the streak runs, with a
 * bigger bonus every seventh day. Missing a whole day starts the streak again at 1. Every day's
 * XP (the streak reward plus everything earned while playing) is kept for the XP calendar.
 */
import type { WorldState } from '../types';
import type { Fx } from '../effects';
import { grantXp } from './xp';

export type StreakDay = { xp: number; bonus: number; cash: number; streak: number };
export type StreakState = { last: string; count: number; best: number; days: Record<string, StreakDay> };

/** Days kept in the calendar (a bit over a year). */
const KEEP_DAYS = 400;

export const emptyStreak = (): StreakState => ({ last: '', count: 0, best: 0, days: {} });

/** The local calendar day as YYYY-MM-DD. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The day before a YYYY-MM-DD key (local, so daylight saving changes don't skip a day). */
export function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d - 1, 12));
}

/** What day N of a streak pays: XP climbs for the first ten days, money for the first week, and every 7th day doubles. */
export function streakReward(count: number): { xp: number; cash: number; milestone: boolean } {
  const n = Math.max(1, count);
  const milestone = n % 7 === 0;
  const xp = 25 + 5 * (Math.min(n, 10) - 1);
  const cash = 5 + 2 * (Math.min(n, 7) - 1);
  return milestone ? { xp: xp * 2, cash: cash * 2, milestone } : { xp, cash, milestone };
}

/** The streak as it stands today: a streak whose last day was before yesterday has run out. */
export function liveStreak(s: StreakState, today = dayKey()): number {
  return s.last === today || s.last === prevDay(today) ? s.count : 0;
}

export type CheckIn = { count: number; best: number; xp: number; cash: number; milestone: boolean; restarted: boolean };

/** Count today's visit. Returns the reward, or null when today was already counted. */
export function checkIn(w: WorldState, fx: Fx, today = dayKey()): CheckIn | null {
  const s = (w.progress.streak ??= emptyStreak());
  if (s.last === today) return null;
  const restarted = s.count > 0 && s.last !== prevDay(today);
  s.count = s.last === prevDay(today) ? s.count + 1 : 1;
  s.best = Math.max(s.best, s.count);
  s.last = today;
  const r = streakReward(s.count);
  const day = (s.days[today] ??= { xp: 0, bonus: 0, cash: 0, streak: 0 });
  day.streak = s.count;
  day.cash += r.cash;
  w.finance.cash += r.cash;
  // grantXp logs the gain into today's calendar entry itself
  const got = grantXp(w, fx, r.xp, { raw: true, day: today });
  day.bonus += got;
  trimDays(s);
  return { count: s.count, best: s.best, xp: got, cash: r.cash, milestone: r.milestone, restarted };
}

/** Add XP earned while playing to today's calendar entry. */
export function logXp(w: WorldState, amount: number, today = dayKey()) {
  if (amount <= 0) return;
  const s = (w.progress.streak ??= emptyStreak());
  const day = (s.days[today] ??= { xp: 0, bonus: 0, cash: 0, streak: 0 });
  day.xp += amount;
}

function trimDays(s: StreakState) {
  const keys = Object.keys(s.days);
  if (keys.length <= KEEP_DAYS) return;
  for (const k of keys.sort().slice(0, keys.length - KEEP_DAYS)) delete s.days[k];
}
