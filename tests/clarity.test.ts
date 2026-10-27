/**
 * Numeric questions about returns, salaries, inflation or interest rates must say what period they
 * mean (a year, a month, in total...), so players are never left guessing whether to answer
 * monthly or yearly.
 */
import { describe, expect, it } from 'vitest';
import { QUESTION_BANK } from '@/game/questions/bank';

const NEEDS_PERIOD = /\b(return|salary|inflation|interest rate|yield)\b/i;
const PERIOD = /(per (year|month|week)|a (year|month|week)|each (year|month)|every (year|month)|annual|yearly|monthly|weekly|over the year|for the year|this year|last year|in total|total|over \d+|after \d+|for \d+ (years|months)|APR|APY|\/(yr|year|mo|month))/i;

describe('question clarity', () => {
  it('numeric money questions say which period they mean', () => {
    const unclear = QUESTION_BANK.filter((q) => q.type === 'numeric' && NEEDS_PERIOD.test(q.prompt) && !PERIOD.test(q.prompt)).map((q) => `${q.id}: ${q.prompt}`);
    expect(unclear).toEqual([]);
  });
});
