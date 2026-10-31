import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { ACTIVITIES } from '@/game/activities';
import { ADV_LESSONS, BRIEFINGS, CONCEPTS, CONCEPT_BY_ID, LESSON_FOR_CONCEPT, UNITS, conceptsIn, lessonsFor, splitTerms, usedAt } from '@/game/learn';
import { LESSONS, completeLesson } from '@/game/progress/lessons';
import { finishActivity } from '@/game/progress/activities';
import { createWorld } from '@/game/world';
import type { Fx } from '@/game/effects';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');

/** Emojis drawn by the custom icon font (anything else would show as a real emoji). */
const MAPPED = new Set(
  [...read('tools/icons/build_icon_font.py').slice(read('tools/icons/build_icon_font.py').indexOf('MAP = {')).split('}')[0].matchAll(/'([^']+)'\s*:/g)].map((m) => m[1]),
);
const strip = (s: string) => s.replace(/️/g, '');

describe('Advanced course', () => {
  it('has unique lesson ids that never clash with the basic course', () => {
    const ids = ADV_LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const l of LESSONS) expect(ids).not.toContain(l.id);
  });

  it('teaches every concept in exactly one lesson', () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CONCEPTS) expect(LESSON_FOR_CONCEPT.get(c.id)).toBeTruthy();
  });

  it('gives every lesson an idea, a worked example and valid checks', () => {
    for (const l of ADV_LESSONS) {
      const kinds = l.cards.map((c) => c.kind);
      expect(kinds, l.id).toContain('idea');
      expect(kinds, l.id).toContain('example');
      expect(l.checks.length, l.id).toBeGreaterThanOrEqual(2);
      for (const c of l.checks) {
        expect(c.answer, l.id).toBeGreaterThanOrEqual(0);
        expect(c.answer, l.id).toBeLessThan(c.choices.length);
      }
    }
  });

  it('uses only icons the pixel icon font can draw', () => {
    for (const u of UNITS) {
      expect(MAPPED.has(strip(u.icon)), u.id).toBe(true);
      for (const l of u.lessons) expect(MAPPED.has(strip(l.icon)), l.id).toBe(true);
    }
  });

  it('has no em dashes in any learning text', () => {
    for (const f of readdirSync(join(ROOT, 'src/data/learn/units'))) expect(read(`src/data/learn/units/${f}`), f).not.toContain('—');
    expect(read('src/data/learn/briefings.json')).not.toContain('—');
  });
});

describe('desk briefings', () => {
  it('cover every activity', () => {
    for (const a of ACTIVITIES) {
      const b = BRIEFINGS[a.id];
      expect(b, a.id).toBeTruthy();
      expect(b.ideas.length, a.id).toBeGreaterThanOrEqual(2);
    }
  });

  it('give Entry players their own wording wherever there is an Entry mode', () => {
    for (const a of ACTIVITIES.filter((x) => !x.replaces && x.entry)) expect(BRIEFINGS[a.id].entry?.length, a.id).toBeGreaterThanOrEqual(2);
  });

  it('only use concepts the course teaches', () => {
    for (const [id, b] of Object.entries(BRIEFINGS)) for (const c of b.concepts) expect(CONCEPT_BY_ID.has(c), `${id}: ${c}`).toBe(true);
  });

  it('link every Advanced pro desk to at least three concepts', () => {
    for (const a of ACTIVITIES.filter((x) => x.replaces)) expect(BRIEFINGS[a.id].concepts.length, a.id).toBeGreaterThanOrEqual(3);
  });

  it('point every lesson at a desk that uses it, or keep it for general knowledge', () => {
    const used = ADV_LESSONS.filter((l) => usedAt(l).length > 0).length;
    expect(used / ADV_LESSONS.length).toBeGreaterThan(0.9);
  });
});

describe('concept matching', () => {
  it('finds concepts in question text, longest phrase first', () => {
    const found = conceptsIn('A bond yields 6% and its credit spread over Treasuries is 200 bp.').map((c) => c.id);
    expect(found).toContain('credit-spread');
    expect(found).toContain('basis-point');
    // "spread" inside "credit spread" is not also read as the bid-ask spread
    expect(found).not.toContain('bid-ask-spread');
  });

  it('keeps short acronyms case-sensitive', () => {
    expect(conceptsIn('We met in April for an apricot').map((c) => c.id)).not.toContain('apr');
    expect(conceptsIn('The card charges 24% APR').map((c) => c.id)).toContain('apr');
  });

  it('splits text into plain runs and tappable terms that rebuild the original', () => {
    const text = 'What is the P/E ratio if EPS is $3?';
    const parts = splitTerms(text);
    expect(parts.map((p) => (typeof p === 'string' ? p : p.text)).join('')).toBe(text);
    expect(parts.filter((p) => typeof p !== 'string').map((p) => (p as { concept: { id: string } }).concept.id)).toEqual(['pe-ratio', 'eps']);
  });

  it('finds a known concept in most Advanced questions', () => {
    let hit = 0;
    let all = 0;
    for (const f of readdirSync(join(ROOT, 'src/data/questions')).filter((x) => x.endsWith('.advanced.json'))) {
      const data = JSON.parse(read(`src/data/questions/${f}`));
      for (const q of (Array.isArray(data) ? data : data.questions) as { prompt: string; explanation?: string }[]) {
        all++;
        if (conceptsIn(`${q.prompt} ${q.explanation ?? ''}`).length) hit++;
      }
    }
    expect(hit / all).toBeGreaterThan(0.8);
  });

  it('maps concepts back to their lessons', () => {
    expect(lessonsFor(['ebitda', 'net-debt', 'sharpe-ratio']).map((l) => l.id)).toEqual(['adv-ev-ebitda', 'adv-sharpe']);
  });
});

describe('Concept help and lesson rewards', () => {
  it('caps a run that used Concept help at 2 stars', () => {
    const w = createWorld({ name: 'Test', nickname: 'Zed', difficulty: 'advanced', seed: 1 });
    const def = ACTIVITIES.find((a) => a.id === 'franchise-deal')!;
    const fx: Fx = [];
    expect(finishActivity(w, fx, def, { score: 100, maxStars: 2 }).stars).toBe(2);
    expect(w.progress.activities[def.id].stars).toBe(2);
    expect(finishActivity(w, fx, def, { score: 100 }).stars).toBe(3);
  });

  it('rewards an Advanced lesson once, like a basic one', () => {
    const w = createWorld({ name: 'Test', nickname: 'Zed', difficulty: 'advanced', seed: 1 });
    const fx: Fx = [];
    const cash = w.finance.cash;
    completeLesson(w, fx, 'adv-sharpe', true);
    expect(w.progress.lessons).toContain('adv-sharpe');
    expect(w.finance.cash).toBeGreaterThan(cash);
    const after = w.finance.cash;
    completeLesson(w, fx, 'adv-sharpe', true);
    expect(w.finance.cash).toBe(after);
  });
});
