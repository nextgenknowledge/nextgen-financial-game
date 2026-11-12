import { expect, it, vi } from 'vitest';

// The card's art and sound aren't needed to check when the question is due.
vi.mock('@/engine/audio', () => ({ playSfx: () => {} }));

import { createWorld } from '@/game/world';
import { LEADERBOARD_URL } from '@/ui/leaderboard';
import { TUTORIAL_QUEST, leaderboardAskPending } from '@/ui/hud/LeaderboardPrompt';

const world = () => createWorld({ name: 'Test', nickname: 'CoinCaptain42', difficulty: 'entry', seed: 7 });

it('the leaderboard is configured, so the question can be asked', () => {
  expect(LEADERBOARD_URL).not.toBe('');
});

it('asks right after the first odd job in the tutorial, and not before', () => {
  const w = world();
  const q = () => w.progress.quests.active.find((a) => a.id === TUTORIAL_QUEST)!;
  expect(q().step).toBe(0);
  for (const step of [0, 1, 2, 3]) {
    q().step = step;
    expect(leaderboardAskPending(w), `step ${step}`).toBe(false);
  }
  q().step = 4; // odd job done, next stop the Welcome Center
  expect(leaderboardAskPending(w)).toBe(true);
});

it('also asks anyone who already finished the tutorial', () => {
  const w = world();
  w.progress.quests.active = w.progress.quests.active.filter((a) => a.id !== TUTORIAL_QUEST);
  w.progress.quests.completed.push(TUTORIAL_QUEST);
  expect(leaderboardAskPending(w)).toBe(true);
});

it('never asks again after a yes or a no', () => {
  for (const share of [true, false]) {
    const w = world();
    w.progress.quests.completed.push(TUTORIAL_QUEST);
    w.progress.flags.leaderboardShare = share;
    expect(leaderboardAskPending(w)).toBe(false);
  }
});
