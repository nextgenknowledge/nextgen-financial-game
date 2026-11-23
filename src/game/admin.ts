/**
 * Admin powers for the team. The Admin app in the FinPhone asks for a code; only a hash of it is
 * kept here, so reading the source doesn't give it away. Once a world uses any admin power it is
 * marked (`flags.admin`) and never goes on the leaderboard, so the real board stays fair.
 */
import type { LocationId, WorldState } from './types';
import type { Fx } from './effects';
import { grantXp, xpForLevel } from './progress/xp';
import { finishQuestsForAdmin, unlockLocation } from './progress/quests';
import outfits from '@/data/shop/outfits.json';

/** SHA-256 of `fincity-admin:` + the code (uppercase, dashes kept). */
export const ADMIN_HASH = 'e025b5a0ce085cfffdb882f3baed6fdff0ac5d6c6da261dc6ca8b6734852ba9f';

/** Tidy what was typed: case, spaces and missing dashes don't matter. */
export function normalizeCode(raw: string): string {
  const s = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return s.match(/.{1,4}/g)?.join('-') ?? '';
}

export async function hashCode(raw: string): Promise<string> {
  const data = new TextEncoder().encode(`fincity-admin:${normalizeCode(raw)}`);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function isAdminCode(raw: string): Promise<boolean> {
  if (!raw.trim()) return false;
  return (await hashCode(raw)) === ADMIN_HASH;
}

/** Spending money in admin mode: topped back up to this. */
export const ADMIN_CASH = 1_000_000_000;
export const ALL_LOCATIONS: LocationId[] = ['park', 'new-york', 'london', 'hong-kong', 'san-francisco', 'singapore'];

/** Marks the world as an admin world (kept off the leaderboard for good). */
export function markAdmin(w: WorldState) {
  w.progress.flags.admin = true;
}

export function isAdminWorld(w: WorldState): boolean {
  return w.progress.flags.admin === true;
}

/** Top cash back up when infinite money is on. True if anything changed. */
export function topUpCash(w: WorldState): boolean {
  if (w.progress.flags.adminInfinite !== true || w.finance.cash >= ADMIN_CASH / 2) return false;
  w.finance.cash = ADMIN_CASH;
  return true;
}

export function setInfiniteMoney(w: WorldState, on: boolean) {
  markAdmin(w);
  w.progress.flags.adminInfinite = on;
  if (on) w.finance.cash = Math.max(w.finance.cash, ADMIN_CASH);
}

export function setLevel(w: WorldState, fx: Fx, level: number) {
  markAdmin(w);
  const need = xpForLevel(level) - w.progress.xp;
  if (need > 0) grantXp(w, fx, need, { raw: true });
}

export function unlockAllCities(w: WorldState, fx: Fx) {
  markAdmin(w);
  for (const loc of ALL_LOCATIONS) unlockLocation(w, fx, loc);
}

/** Finish the tutorial (or every quest) so nothing is locked behind story steps. */
export function finishQuests(w: WorldState, fx: Fx, all: boolean) {
  markAdmin(w);
  finishQuestsForAdmin(w, fx, all);
}

/** Every outfit, hat and accessory in the shops, free. */
export function giveAllOutfits(w: WorldState) {
  markAdmin(w);
  for (const it of outfits.items) {
    if (w.assets.items.some((x) => x.itemId === it.id)) continue;
    w.assets.items.push({ uid: `admin_${it.id}`, itemId: it.id, value: 0, price: 0, boughtMonth: w.time.month });
  }
}

export function maxHappiness(w: WorldState) {
  markAdmin(w);
  w.player.happiness = 100;
}
