/**
 * Question quality guards. The right answer must not give itself away by being the longest
 * choice, choices must be real words or values (never a lone letter), and a bank must not ask the
 * same prompt twice. Covers every JSON question bank, the Learn hub lesson checks, the branching
 * stories and the multiple-choice questions activities build in code.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import lessons from '@/data/lessons.json';
import stories from '@/data/stories.json';
import { codeQuestions } from './helpers/codeChoices';

/** Share of questions whose right answer may be strictly the longest choice. */
const MAX_LONGEST_SHARE = 0.4;

interface Mc {
  id: string;
  lengths: number[];
  correct: number;
}

const strictLongest = (q: Mc) => {
  const max = Math.max(...q.lengths);
  return q.lengths[q.correct] === max && q.lengths.filter((l) => l === max).length === 1;
};

function longestShare(qs: Mc[]) {
  const hits = qs.filter(strictLongest);
  return { share: qs.length ? hits.length / qs.length : 0, ids: hits.map((q) => q.id) };
}

const isSingleLetter = (c: string) => /^[A-Za-z]$/.test(c.trim());

type BankQ = { id: string; type: string; prompt: string; choices?: string[]; answer?: number | number[] | boolean };
const BANK_DIR = path.join(__dirname, '../src/data/questions');
const banks = fs
  .readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json'))
  .map((f) => ({ name: f.replace('.json', ''), questions: JSON.parse(fs.readFileSync(path.join(BANK_DIR, f), 'utf8')).questions as BankQ[] }));

describe('question banks', () => {
  it('finds all twelve banks', () => {
    expect(banks).toHaveLength(12);
  });

  for (const bank of banks) {
    describe(bank.name, () => {
      const mc: Mc[] = bank.questions
        .filter((q) => q.type === 'mc' && Array.isArray(q.choices) && typeof q.answer === 'number')
        .map((q) => ({ id: q.id, lengths: q.choices!.map((c) => c.length), correct: q.answer as number }));

      it(`right answer is the longest choice in at most ${MAX_LONGEST_SHARE * 100}% of multiple-choice questions`, () => {
        const { share, ids } = longestShare(mc);
        expect(share, `longest-choice answers: ${ids.join(', ')}`).toBeLessThanOrEqual(MAX_LONGEST_SHARE);
      });

      it('has no single-letter choices', () => {
        const bad = bank.questions.flatMap((q) => (q.choices ?? []).filter(isSingleLetter).map((c) => `${q.id}: "${c}"`));
        expect(bad).toEqual([]);
      });

      it('never repeats a prompt', () => {
        const seen = new Map<string, string>();
        const dups: string[] = [];
        for (const q of bank.questions) {
          const key = q.prompt.toLowerCase().replace(/\s+/g, ' ').trim();
          if (seen.has(key)) dups.push(`${seen.get(key)} and ${q.id}`);
          else seen.set(key, q.id);
        }
        expect(dups).toEqual([]);
      });
    });
  }
});

describe('Learn hub lesson checks', () => {
  const checks = (lessons.lessons as { id: string; check: { prompt: string; choices: string[]; answer: number } }[]).map((l) => ({ id: l.id, ...l.check }));
  it('right answer is rarely the longest', () => {
    const { share, ids } = longestShare(checks.map((c) => ({ id: c.id, lengths: c.choices.map((x) => x.length), correct: c.answer })));
    expect(share, ids.join(', ')).toBeLessThanOrEqual(MAX_LONGEST_SHARE);
  });
  it('has no single-letter choices or repeated prompts', () => {
    expect(checks.flatMap((c) => c.choices.filter(isSingleLetter))).toEqual([]);
    expect(new Set(checks.map((c) => c.prompt)).size).toBe(checks.length);
  });
});

describe('branching stories', () => {
  type Node = { choices?: { text: string; points: number }[] };
  const decisions: Mc[] = Object.entries(stories.stories as Record<string, { nodes: Record<string, Node> }>).flatMap(([sid, st]) =>
    Object.entries(st.nodes)
      .filter(([, n]) => (n.choices?.length ?? 0) > 1)
      .map(([nid, n]) => {
        const pts = n.choices!.map((c) => c.points);
        return { id: `${sid}/${nid}`, lengths: n.choices!.map((c) => c.text.length), correct: pts.indexOf(Math.max(...pts)) };
      }),
  );
  it('the best choice is rarely the longest', () => {
    const { share, ids } = longestShare(decisions);
    expect(share, ids.join(', ')).toBeLessThanOrEqual(MAX_LONGEST_SHARE);
  });
});

describe('questions built in activity code', () => {
  const qs = codeQuestions(path.join(__dirname, '../src/activities/kinds')).filter((q) => q.choices.length > 1);
  it('finds the code-built questions', () => {
    expect(qs.length).toBeGreaterThan(15);
  });
  it('right answer is rarely the longest', () => {
    const { share, ids } = longestShare(qs.map((q) => ({ id: `${q.file}:${q.line}`, lengths: q.lengths, correct: q.correct })));
    expect(share, ids.join(', ')).toBeLessThanOrEqual(MAX_LONGEST_SHARE);
  });
  it('has no single-letter choices', () => {
    expect(qs.flatMap((q) => q.choices.filter(isSingleLetter).map((c) => `${q.file}:${q.line} "${c}"`))).toEqual([]);
  });
});
