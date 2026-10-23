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
