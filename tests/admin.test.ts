import { describe, expect, it } from 'vitest';
import { createWorld } from '@/game/world';
import { ADMIN_CASH, finishQuests, hashCode, isAdminCode, normalizeCode, setInfiniteMoney, setLevel, topUpCash, unlockAllCities } from '@/game/admin';
import { sharesScore } from '@/game/leaderboard';
import type { Fx } from '@/game/effects';

const mk = () => createWorld({ name: 'Admin', nickname: 'Fin', difficulty: 'entry', seed: 4 });

describe('admin mode', () => {
  it('tidies typed codes and rejects wrong ones', async () => {
    expect(normalizeCode(' abcd efgh-ijkl mnop ')).toBe('ABCD-EFGH-IJKL-MNOP');
    expect(await hashCode('abcd-efgh')).toBe(await hashCode('ABCDEFGH'));
    expect(await isAdminCode('')).toBe(false);
    expect(await isAdminCode('AAAA-BBBB-CCCC-DDDD')).toBe(false);
  });

  it('keeps admin worlds off the leaderboard', () => {
    const w = mk();
    expect(sharesScore(w)).toBe(true);
    setInfiniteMoney(w, true);
    expect(w.progress.flags.admin).toBe(true);
    expect(sharesScore(w)).toBe(false);
  });

  it('tops money back up while infinite money is on', () => {
    const w = mk();
    setInfiniteMoney(w, true);
    w.finance.cash = 10;
    expect(topUpCash(w)).toBe(true);
    expect(w.finance.cash).toBe(ADMIN_CASH);
    setInfiniteMoney(w, false);
    w.finance.cash = 10;
    expect(topUpCash(w)).toBe(false);
  });

  it('unlocks cities, levels up and finishes the tutorial', () => {
    const w = mk();
    const fx: Fx = [];
    unlockAllCities(w, fx);
    expect(w.progress.unlocked).toHaveLength(6);
    setLevel(w, fx, 20);
    expect(w.progress.level).toBeGreaterThanOrEqual(20);
    finishQuests(w, fx, false);
    expect(w.progress.quests.completed).toContain('q1-welcome');
    expect(w.progress.quests.active.some((a) => a.id === 'q1-welcome')).toBe(false);
  });
});
