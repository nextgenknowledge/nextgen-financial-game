import { describe, expect, it } from 'vitest';
import { createWorld } from '@/game/world';
import { recordEvent } from '@/game/progress/events';
import { currentStep } from '@/game/progress/quests';
import type { Fx } from '@/game/effects';

const cur = (w: ReturnType<typeof createWorld>) => currentStep(w)?.step.id;

describe('quests tolerate out-of-order play', () => {
  it('skips steps the player already did before being asked', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    // Open the phone and enter the Welcome Center before the guide asks
    recordEvent(w, fx, { type: 'menu', target: 'phone' });
    recordEvent(w, fx, { type: 'enterBuilding', target: 'welcome-center' });
    expect(cur(w)).toBe('walk');
    recordEvent(w, fx, { type: 'move', value: 20 });
    expect(cur(w)).toBe('jump');
    fx.length = 0;
    recordEvent(w, fx, { type: 'jump' });
    // phone + welcome center were already done → straight to the quiz
    expect(cur(w)).toBe('first-quiz');
    const lines = fx.filter((e) => e.type === 'narwhal').length;
    expect(lines).toBeGreaterThan(0); // only the quiz step is announced
  });

  it('auto-completes the next quest’s early steps too', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 2 });
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'enterBuilding', target: 'bank' });
    recordEvent(w, fx, { type: 'openChecking' });
    for (const ev of [{ type: 'move', value: 20 }, { type: 'jump' }, { type: 'menu', target: 'phone' }, { type: 'enterBuilding', target: 'welcome-center' }])
      recordEvent(w, fx, ev);
    w.progress.activities['first-quiz'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'first-quiz', stars: 2 });
    expect(w.progress.quests.completed).toContain('q1-welcome');
    expect(cur(w)).toBe('deposit');
  });
});

describe('legendary quests', () => {
  it('start silently, stay out of the main guide, and pay out their prize', async () => {
    const { startEpics, QUESTS } = await import('@/game/progress/quests');
    const outfits = (await import('@/data/shop/outfits.json')).default as { items: { id: string }[] };
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 3 });
    const fx: Fx = [];
    const guide = cur(w);
    startEpics(w, fx);
    expect(fx.filter((e) => e.type === 'narwhal').length).toBe(0);
    expect(cur(w)).toBe(guide);
    // Entry worlds don't get the Advanced-only career
    expect(w.progress.quests.active.some((a) => a.id === 'epic-wallstreet')).toBe(false);
    // Every prize exists as an outfit item
    for (const q of QUESTS.filter((x) => x.epic)) if (q.reward.item) expect(outfits.items.some((i) => i.id === q.reward.item)).toBe(true);
    // Finish the whole Learn course → Scholar completes with its hat
    w.progress.stats.lessonsRead = 24;
    recordEvent(w, fx, { type: 'move', value: 1 });
    expect(w.progress.quests.completed).toContain('epic-scholar');
    expect(w.assets.items.some((i) => i.itemId === 'scholar-cap')).toBe(true);
  });

  it('Advanced worlds get the Wall Street career', async () => {
    const { startEpics } = await import('@/game/progress/quests');
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'advanced', seed: 4 });
    startEpics(w, []);
    expect(w.progress.quests.active.some((a) => a.id === 'epic-wallstreet')).toBe(true);
  });
});
