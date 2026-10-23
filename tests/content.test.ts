/**
 * Content validation: every data reference (activities → kinds/buildings/sets,
 * stations → activities/services, quests → targets) must resolve, and every city
 * must ship at least 50 questions per difficulty.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVITIES, ACTIVITY_BY_ID } from '@/game/activities';
import { QUESTION_BANK } from '@/game/questions/bank';
import { CITIES } from '@/world/cities';
import sorts from '@/data/sorts.json';
import allocate from '@/data/allocate.json';
import stories from '@/data/stories.json';
import quests from '@/data/quests.json';
import { buildTeacherReport, topicBand } from '@/game/progress/report';
import { createWorld } from '@/game/world';
import { generateCandles, sma } from '@/game/market/candles';
import { rentVsBuy } from '@/game/finance/housing';

const root = join(import.meta.dirname, '..');
const src = (p: string) => readFileSync(join(root, p), 'utf8');

/** Keys of the KINDS map, read from source so the test doesn't load React components. */
const KIND_IDS = new Set([...src('src/activities/registry.tsx').matchAll(/^\s+([A-Za-z0-9]+):\s/gm)].map((m) => m[1]));
const SERVICE_IDS = new Set([...src('src/ui/services/ServicePanel.tsx').matchAll(/^\s+'?([a-z-]+)'?:\s'/gm)].map((m) => m[1]).concat(['library', 'map', 'learn']));
const SHOP_IDS = new Set([...src('src/ui/services/ShopPanel.tsx').matchAll(/base === '([a-z]+)'/g)].map((m) => m[1]));

const cityIds = Object.keys(CITIES);
/** Activities launched from outdoor triggers (e.g. the park's job board) rather than a building station. */
const OUTDOOR = new Set([...src('src/world/builders/sceneBuilder.ts').matchAll(/activity: '([a-z0-9-]+)'/g)].map((m) => m[1]));
const buildingIds = new Set(Object.values(CITIES).flatMap((c) => c.buildings.map((b) => b.id)));

describe('content references', () => {
  it('activity ids are unique', () => {
    expect(new Set(ACTIVITIES.map((a) => a.id)).size).toBe(ACTIVITIES.length);
  });

  it('every activity uses a registered kind, an existing building and city', () => {
    for (const a of ACTIVITIES) {
      expect(KIND_IDS.has(a.kind), `${a.id}: kind ${a.kind}`).toBe(true);
      expect(cityIds, `${a.id}: city`).toContain(a.city);
      if (!OUTDOOR.has(a.id)) expect(CITIES[a.city].buildings.some((b) => b.id === a.building), `${a.id}: building ${a.building} in ${a.city}`).toBe(true);
      expect(a.entry || a.advanced, `${a.id}: needs at least one difficulty`).toBeTruthy();
    }
  });

  it('activity params reference existing sort sets, scenarios and stories', () => {
    for (const a of ACTIVITIES) {
      for (const p of [a.entry, a.advanced]) {
        if (!p) continue;
        if (a.kind === 'sort') expect(sorts.sets, `${a.id}: sort set ${p.set}`).toHaveProperty([p.set as string]);
        if (a.kind === 'allocate') expect(allocate.scenarios, `${a.id}: scenario ${p.scenario}`).toHaveProperty([p.scenario as string]);
        if (typeof p.story === 'string') expect(stories.stories, `${a.id}: story ${p.story}`).toHaveProperty([p.story]);
      }
    }
  });

  it('every station points at a real activity or service', () => {
    for (const c of Object.values(CITIES))
      for (const b of c.buildings)
        for (const s of [...b.stations, ...(b.entryStations ?? [])] as { activity?: string; service?: string; label: string }[]) {
          if (s.activity) expect(ACTIVITY_BY_ID.has(s.activity), `${c.id}/${b.id}: activity ${s.activity}`).toBe(true);
          else if (s.service?.startsWith('shop:')) expect(SHOP_IDS.has(s.service.slice(5)), `${c.id}/${b.id}: ${s.service}`).toBe(true);
          else expect(SERVICE_IDS.has(s.service ?? ''), `${c.id}/${b.id}: service ${s.service}`).toBe(true);
        }
  });

  it('every activity is reachable from some station', () => {
    const used = new Set([...OUTDOOR, ...Object.values(CITIES).flatMap((c) => c.buildings.flatMap((b) => [...b.stations, ...(b.entryStations ?? [])].map((s) => s.activity)))]);
    for (const a of ACTIVITIES) expect(used.has(a.id), `${a.id} has no station`).toBe(true);
  });

  it('Advanced replacements stand in for real activities and are reachable in Advanced', () => {
    const advanced = new Set(Object.values(CITIES).flatMap((c) => c.buildings.flatMap((b) => b.stations.map((s) => s.activity))));
    for (const a of ACTIVITIES.filter((x) => x.replaces)) {
      expect(ACTIVITY_BY_ID.has(a.replaces!), `${a.id} replaces ${a.replaces}`).toBe(true);
      expect(advanced.has(a.id), `${a.id} is not on an Advanced station`).toBe(true);
      expect(advanced.has(a.replaces), `${a.replaces} should only be in Entry once ${a.id} replaces it`).toBe(false);
    }
  });

  it('quest goals target real buildings, cities and activities', () => {
    for (const q of quests.quests)
      for (const s of q.steps) {
        const g = s.goal as { type: string; target?: string };
        if (g.type === 'enter') expect(buildingIds.has(g.target!), `${q.id}/${s.id}: building ${g.target}`).toBe(true);
        if (g.type === 'travel') expect(cityIds, `${q.id}/${s.id}: city ${g.target}`).toContain(g.target);
        if (g.type === 'activity' && g.target && g.target !== '*') expect(ACTIVITY_BY_ID.has(g.target), `${q.id}/${s.id}: activity ${g.target}`).toBe(true);
      }
  });

  it('every city has at least 50 questions per difficulty', () => {
    for (const city of cityIds) {
      if (city === 'park') continue; // the park is the tutorial hub with a smaller bank
      for (const d of ['entry', 'advanced'] as const) {
        const n = QUESTION_BANK.filter((q) => q.city === city && q.difficulty === d).length;
        expect(n, `${city} ${d}`).toBeGreaterThanOrEqual(50);
      }
    }
  });

  it('question ids are unique', () => {
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(QUESTION_BANK.length);
  });
});

describe('teacher report', () => {
  it('builds valid HTML without the nickname by default', () => {
    const w = createWorld({ name: 'Test', nickname: 'Zed', difficulty: 'advanced', seed: 1 });
    w.progress.topics.interest = { correct: 18, total: 20 };
    w.progress.topics.credit = { correct: 2, total: 6 };
    const { html, data } = buildTeacherReport(w);
    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).not.toContain('Zed');
    expect(html).not.toMatch(/<script|https?:\/\//);
    expect(data.strengths[0].topic).toBe('interest');
    expect(data.practice[0].topic).toBe('credit');
    expect(buildTeacherReport(w, { includeNickname: true }).html).toContain('Zed');
  });

  it('bands topics sensibly', () => {
    expect(topicBand(0, 0)).toBe('Not yet practiced');
    expect(topicBand(17, 20)).toBe('Mastered');
    expect(topicBand(8, 10)).toBe('Proficient');
    expect(topicBand(1, 10)).toBe('Getting started');
  });
});

describe('candles & housing', () => {
  it('candles are internally consistent', () => {
    const { past, future } = generateCandles(3, 60, 3);
    expect(past.length).toBe(60);
    expect(future.length).toBe(3);
    const c = [...past, ...future];
    for (const k of c) {
      expect(k.h).toBeGreaterThanOrEqual(Math.max(k.o, k.c));
      expect(k.l).toBeLessThanOrEqual(Math.min(k.o, k.c));
      expect(k.l).toBeGreaterThan(0);
    }
    const s = sma(c.map((k) => k.c), 5);
    expect(s.length).toBe(63);
    expect(s[3]).toBeNull();
  });

  it('rent vs buy produces finite comparable totals', () => {
    const r = rentVsBuy({ price: 400000, downPct: 0.2, apr: 0.065, years: 7, rent: 2200, rentGrowth: 0.03, appreciation: 0.03, propertyTaxPct: 0.011, maintenancePct: 0.01, closingPct: 0.03, sellingPct: 0.06, investReturn: 0.06 });
    for (const v of Object.values(r)) if (typeof v === 'number') expect(Number.isFinite(v)).toBe(true);
  });
});
