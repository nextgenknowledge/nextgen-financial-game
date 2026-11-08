import { describe, expect, it } from 'vitest';
import { createWorld, migrateWorld } from '@/game/world';
import { checkIn, dayKey, liveStreak, prevDay, streakReward } from '@/game/progress/streak';
import { grantXp } from '@/game/progress/xp';
import type { Fx } from '@/game/effects';

const mk = () => createWorld({ name: 'Streak', nickname: 'Fin', difficulty: 'entry', seed: 3 });

describe('daily streak', () => {
  it('works out calendar days, including across months and years', () => {
    expect(dayKey(new Date(2026, 10, 8, 23, 59))).toBe('2026-11-08');
    expect(prevDay('2026-03-01')).toBe('2026-02-28');
    expect(prevDay('2027-01-01')).toBe('2026-12-31');
    expect(prevDay('2026-11-02')).toBe('2026-11-01');
  });

  it('pays once a day and grows while days run in a row', () => {
    const w = mk();
    const fx: Fx = [];
    const cash0 = w.finance.cash;
    const xp0 = w.progress.xp;
    const a = checkIn(w, fx, '2026-11-06')!;
    expect(a).toMatchObject({ count: 1, xp: 25, cash: 5, restarted: false });
    expect(checkIn(w, fx, '2026-11-06')).toBeNull();
    const b = checkIn(w, fx, '2026-11-07')!;
    expect(b.count).toBe(2);
    expect(b.xp).toBeGreaterThan(a.xp);
    expect(w.finance.cash).toBeGreaterThanOrEqual(cash0 + a.cash + b.cash);
    expect(w.progress.xp).toBe(xp0 + a.xp + b.xp);
    expect(w.progress.streak.days['2026-11-07']).toMatchObject({ streak: 2, bonus: b.xp, xp: b.xp, cash: b.cash });
  });

  it('starts again at 1 after a missed day but keeps the best', () => {
    const w = mk();
    const fx: Fx = [];
    checkIn(w, fx, '2026-11-01');
    checkIn(w, fx, '2026-11-02');
    checkIn(w, fx, '2026-11-03');
    expect(liveStreak(w.progress.streak, '2026-11-04')).toBe(3);
    expect(liveStreak(w.progress.streak, '2026-11-05')).toBe(0);
    const c = checkIn(w, fx, '2026-11-05')!;
    expect(c).toMatchObject({ count: 1, best: 3, restarted: true });
  });

  it('doubles every seventh day and keeps rewards small', () => {
    expect(streakReward(7).milestone).toBe(true);
    expect(streakReward(7).xp).toBe(2 * (25 + 5 * 6));
    expect(streakReward(14).milestone).toBe(true);
    expect(streakReward(100).cash).toBeLessThanOrEqual(17);
    expect(streakReward(100).xp).toBeLessThanOrEqual(70);
  });

  it('logs XP earned while playing into the calendar', () => {
    const w = mk();
    grantXp(w, [], 40, { raw: true });
    expect(w.progress.streak.days[dayKey()].xp).toBe(40);
  });

  it('gives older saves an empty streak', () => {
    const w = mk() as unknown as { progress: Record<string, unknown> };
    delete w.progress.streak;
    const m = migrateWorld(JSON.parse(JSON.stringify(w)));
    expect(m.progress.streak).toEqual({ last: '', count: 0, best: 0, days: {} });
  });
});
