import { describe, expect, it } from 'vitest';
import { QUESTION_BANK } from '@/game/questions/bank';
import { instantiate, grade, selectQuestions, fillTemplate, adaptLevel } from '@/game/questions/engine';
import { makeRng } from '@/game/rng';

describe('question engine', () => {
  it('fills templates with money formatting', () => {
    expect(fillTemplate('Pay ${p} now', { p: 4.5 })).toBe('Pay $4.50 now');
    expect(fillTemplate('{r:pct} and {n:int}', { r: 4.25, n: 1234.4 })).toBe('4.25% and 1,234');
    expect(fillTemplate('{missing}', {})).toBe('{missing}');
  });

  it('every question instantiates many times with valid, gradable answers', () => {
    for (const q of QUESTION_BANK) {
      for (let s = 0; s < 15; s++) {
        const rq = instantiate(q, makeRng(s * 977 + q.id.length));
        expect(rq.prompt).not.toMatch(/\{[A-Za-z_]+(:[a-z0-9]+)?\}/);
        expect(rq.explanation).not.toMatch(/\{[A-Za-z_]+(:[a-z0-9]+)?\}/);
        if (rq.type === 'numeric') {
          expect(Number.isFinite(rq.value)).toBe(true);
          expect(grade(rq, { kind: 'numeric', value: rq.value! })).toBe(true);
          expect(grade(rq, { kind: 'numeric', value: rq.value! * 1.5 + 7 })).toBe(false);
        } else if (rq.type === 'mc' || rq.type === 'tf') {
          expect(rq.choices.length).toBeGreaterThanOrEqual(2);
          expect(new Set(rq.choices).size).toBe(rq.choices.length);
          expect(grade(rq, { kind: 'choice', index: rq.correct as number })).toBe(true);
        } else if (rq.type === 'multi') {
          expect(grade(rq, { kind: 'multi', indices: rq.correct as number[] })).toBe(true);
        }
      }
    }
  });

  it('accepts small rounding differences on computed answers', () => {
    const q = QUESTION_BANK.find((x) => x.id === 'pa-003')!;
    const rq = instantiate(q, makeRng(1));
    expect(grade(rq, { kind: 'numeric', value: Math.round(rq.value! * 100) / 100 + 0.01 })).toBe(true);
  });

  it('selection respects difficulty and count', () => {
    const qs = selectQuestions(QUESTION_BANK, { difficulty: 'entry', cities: ['park'], count: 5, seed: 3 });
    expect(qs).toHaveLength(5);
    expect(new Set(qs.map((q) => q.id)).size).toBe(5);
    for (const q of qs) expect(q.id.startsWith('pe-')).toBe(true);
  });

  it('adaptive level moves up after 3 right and down after 2 wrong', () => {
    expect(adaptLevel(2, 3, 0)).toBe(3);
    expect(adaptLevel(2, 0, 2)).toBe(1);
    expect(adaptLevel(5, 3, 0)).toBe(5);
    expect(adaptLevel(1, 0, 2)).toBe(1);
  });
});
