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

it('asks once the tutorial quest is done, and not before', () => {
  const w = world();
  expect(leaderboardAskPending(w)).toBe(false);
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
