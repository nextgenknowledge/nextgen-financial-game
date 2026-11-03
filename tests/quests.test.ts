import { describe, expect, it } from 'vitest';
import { createWorld, migrateWorld } from '@/game/world';
import { recordEvent } from '@/game/progress/events';
import { currentStep } from '@/game/progress/quests';
import { sameActivity } from '@/game/activities';
import { CITIES } from '@/world/cities';
import questData from '@/data/quests.json';
import type { Fx } from '@/game/effects';

const cur = (w: ReturnType<typeof createWorld>) => currentStep(w)?.step.id;

describe('quests tolerate out-of-order play', () => {
  it('skips steps the player already did before being asked', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    // Open the phone before the guide asks
    recordEvent(w, fx, { type: 'menu', target: 'phone' });
    expect(cur(w)).toBe('walk');
    recordEvent(w, fx, { type: 'move', value: 20 });
    expect(cur(w)).toBe('jump');
    recordEvent(w, fx, { type: 'jump' });
    // The phone was already opened, so it moves straight on
    expect(cur(w)).toBe('odd-job');
  });

  it('never lets a small step hold back something bigger the player already did', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'move', value: 20 });
    expect(cur(w)).toBe('jump');
    // The odd job without ever jumping
    w.progress.activities['odd-jobs'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'odd-jobs', stars: 2 });
    expect(cur(w)).toBe('enter-wc');
    fx.length = 0;
    recordEvent(w, fx, { type: 'enterBuilding', target: 'welcome-center' });
    expect(cur(w)).toBe('first-quiz');
    expect(fx.filter((e) => e.type === 'narwhal').length).toBeGreaterThan(0); // the quiz is announced
    // And finishing the quiz completes the quest
    w.progress.activities['first-quiz'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'first-quiz', stars: 2 });
    expect(w.progress.quests.completed).toContain('q1-welcome');
  });

  it('makes the first job the first thing a new player earns from', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    for (const ev of [{ type: 'move', value: 20 }, { type: 'jump' }, { type: 'menu', target: 'phone' }]) recordEvent(w, fx, ev);
    expect(cur(w)).toBe('odd-job');
    // Walking into the Welcome Center early doesn't skip the job
    recordEvent(w, fx, { type: 'enterBuilding', target: 'welcome-center' });
    expect(cur(w)).toBe('odd-job');
    const before = w.finance.cash;
    w.progress.activities['odd-jobs'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'odd-jobs', stars: 2 });
    expect(w.finance.cash).toBe(before + 25);
    // The Welcome Center visit counts now, so it moves on to the quiz
    expect(cur(w)).toBe('first-quiz');
  });

  it('opens New York after the first quiz, then sends the player to the bank', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    for (const ev of [{ type: 'move', value: 20 }, { type: 'jump' }, { type: 'menu', target: 'phone' }, { type: 'enterBuilding', target: 'welcome-center' }]) recordEvent(w, fx, ev);
    w.progress.activities['odd-jobs'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'odd-jobs', stars: 2 });
    expect(w.progress.unlocked).not.toContain('new-york');
    w.progress.activities['first-quiz'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'first-quiz', stars: 2 });
    expect(w.progress.unlocked).toContain('new-york');
    expect(cur(w)).toBe('travel-ny');
    w.player.location = 'new-york';
    recordEvent(w, fx, { type: 'travel', target: 'new-york' });
    expect(cur(w)).toBe('see-brokerage');
    recordEvent(w, fx, { type: 'enterBuilding', target: 'ny-brokerage' });
    expect(cur(w)).toBe('back-home');
    w.player.location = 'park';
    recordEvent(w, fx, { type: 'travel', target: 'park' });
    expect(cur(w)).toBe('enter-bank');
  });

  it('keeps small steps in order: pressing jump first still teaches walking', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    recordEvent(w, [], { type: 'jump' });
    expect(cur(w)).toBe('walk');
  });

  it('auto-completes the next quest’s early steps too', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 2 });
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'enterBuilding', target: 'ny-brokerage' });
    for (const ev of [{ type: 'move', value: 20 }, { type: 'jump' }, { type: 'menu', target: 'phone' }, { type: 'enterBuilding', target: 'welcome-center' }])
      recordEvent(w, fx, ev);
    w.progress.activities['odd-jobs'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'odd-jobs', stars: 2 });
    w.progress.activities['first-quiz'] = { best: 80, stars: 2, plays: 1, last: 0 };
    recordEvent(w, fx, { type: 'activityComplete', target: 'first-quiz', stars: 2 });
    expect(w.progress.quests.completed).toContain('q1-welcome');
    expect(cur(w)).toBe('travel-ny');
    w.player.location = 'new-york';
    recordEvent(w, fx, { type: 'travel', target: 'new-york' });
    expect(cur(w)).toBe('back-home');
  });
});

describe('starter quest teaches riding', () => {
  it('goes from buying the scooter to riding it to hopping off, then the home', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    w.progress.quests.active = [{ id: 'q3b-starter', step: 2, progress: 0 }];
    recordEvent(w, fx, { type: 'ownRide', target: 'scooter' });
    expect(cur(w)).toBe('starter-hop-on');
    recordEvent(w, fx, { type: 'rideVehicle', target: 'scooter' });
    expect(cur(w)).toBe('starter-drive');
    recordEvent(w, fx, { type: 'getOff' });
    expect(cur(w)).toBe('starter-home');
  });

  it('skips the riding steps for someone who already rode', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    const fx: Fx = [];
    recordEvent(w, fx, { type: 'rideVehicle', target: 'x' });
    recordEvent(w, fx, { type: 'getOff' });
    w.progress.quests.active = [{ id: 'q3b-starter', step: 2, progress: 0 }];
    recordEvent(w, fx, { type: 'ownRide', target: 'scooter' });
    expect(cur(w)).toBe('starter-home');
  });
});

describe('older saves', () => {
  it('keeps a player on the same welcome step after the job moved into the quest', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    w.version = 1;
    w.progress.quests.active = [{ id: 'q1-welcome', step: 3, progress: 0 }]; // was enter-wc
    expect(cur(migrateWorld(w))).toBe('enter-wc');
    const early = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    early.version = 1;
    early.progress.quests.active = [{ id: 'q1-welcome', step: 1, progress: 0 }];
    expect(cur(migrateWorld(early))).toBe('jump');
    // Already on the new numbering: left alone
    const fresh = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    fresh.progress.quests.active = [{ id: 'q1-welcome', step: 3, progress: 0 }];
    expect(cur(migrateWorld(fresh))).toBe('odd-job');
  });

  it('keeps a player on the same starter step after the riding steps were added', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    w.version = 2;
    w.progress.quests.active = [{ id: 'q3b-starter', step: 3, progress: 0 }]; // was the home
    expect(cur(migrateWorld(w))).toBe('starter-home');
    const early = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    early.version = 2;
    early.progress.quests.active = [{ id: 'q3b-starter', step: 2, progress: 0 }];
    expect(cur(migrateWorld(early))).toBe('starter-ride');
  });

  it('still unlocks San Francisco for a save past the old first-job quest', () => {
    const w = createWorld({ name: 'T', nickname: 'T', difficulty: 'entry', seed: 1 });
    w.progress.quests.active = [{ id: 'q2-bank', step: 3, progress: 0 }];
    recordEvent(w, [], { type: 'openSavings' });
    expect(w.progress.unlocked).toContain('san-francisco');
    expect(cur(w)).toBe('starter-outfit');
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

describe('Narwhal cards name things that exist', () => {
  const steps = (questData.quests as unknown as { id: string; difficulty?: string; steps: { id: string; text: string; proText?: string; entryText?: string; say?: string[]; proSay?: string[]; entrySay?: string[]; goal: { type: string; target?: string } }[] }[]).flatMap((q) =>
    q.steps.map((s) => ({ q, s })),
  );
  const buildings = Object.values(CITIES).flatMap((c) => c.buildings);
  const renamed = buildings.filter((b) => b.pro?.name && b.pro.name !== b.name);

  it('every activity goal has a station to play in both modes', () => {
    for (const { q, s } of steps) {
      // Odd Jobs is the board by the fountain, not a station
      if (s.goal.type !== 'activity' || !s.goal.target || s.goal.target === '*' || s.goal.target === 'odd-jobs') continue;
      const t = s.goal.target;
      const pro = buildings.some((b) => b.stations.some((st) => sameActivity(st.activity, t)));
      const entry = buildings.some((b) => (b.entryStations ?? b.stations).some((st) => st.activity === t));
      expect(pro, `${q.id}/${s.id} advanced`).toBe(true);
      if (q.difficulty !== 'advanced') expect(entry, `${q.id}/${s.id} entry`).toBe(true);
    }
  });

  it('cards use the building name the player actually sees in their mode', () => {
    for (const { q, s } of steps) {
      const advanced = [s.proText ?? s.text, ...(s.proSay ?? s.say ?? [])].join(' ');
      const entry = q.difficulty === 'advanced' ? '' : [s.entryText ?? s.text, ...(s.entrySay ?? s.say ?? [])].join(' ');
      for (const b of renamed) {
        expect(advanced.includes(b.name), `${q.id}/${s.id} says ${b.name} in Advanced`).toBe(false);
        expect(entry.includes(b.pro!.name!), `${q.id}/${s.id} says ${b.pro!.name} in Entry`).toBe(false);
      }
    }
  });
});
