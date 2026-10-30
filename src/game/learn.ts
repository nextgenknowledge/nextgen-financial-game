/**
 * The Advanced course, the glossary of concepts and the desk briefings.
 *
 * - A concept is one idea a desk or question uses (EBITDA, duration, debt-to-income…), with a
 *   plain definition, an example and, where there is one, a formula.
 * - Each concept is taught by exactly one Advanced lesson (it is defined inside that lesson's
 *   `terms`, so the glossary and the course can never drift apart). Lessons are grouped into units.
 * - Each activity has a briefing: the few ideas you need at that desk and the concepts it uses.
 *
 * Coverage is enforced by tests/learn.test.ts: every activity has a briefing, every concept a
 * lesson, and no desk can use a concept that is never taught.
 */
import type { Topic } from './types';
import type { ActivityDef } from './content';
import { ACTIVITIES } from './activities';
import briefings from '@/data/learn/briefings.json';
import u01 from '@/data/learn/units/01-interest.json';
import u02 from '@/data/learn/units/02-borrowing.json';
import u03 from '@/data/learn/units/03-taxes.json';
import u04 from '@/data/learn/units/04-companies.json';
import u05 from '@/data/learn/units/05-valuation.json';
import u06 from '@/data/learn/units/06-markets.json';
import u07 from '@/data/learn/units/07-portfolios.json';
import u08 from '@/data/learn/units/08-bonds.json';
import u09 from '@/data/learn/units/09-economics.json';
import u10 from '@/data/learn/units/10-business.json';
import u11 from '@/data/learn/units/11-protection.json';
import u12 from '@/data/learn/units/12-everyday.json';

export interface Concept {
  id: string;
  term: string;
  /** Other ways the concept is written in questions ("P/E", "price-to-earnings"). */
  aka?: string[];
  def: string;
  example?: string;
  formula?: string;
}

export interface CourseCard {
  kind: 'idea' | 'example' | 'formula' | 'mistake';
  title?: string;
  body: string;
}

export interface CourseCheck {
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
}

export interface CourseLesson {
  id: string;
  title: string;
  icon: string;
  /** The concepts this lesson teaches, which also make up the glossary. */
  terms: Concept[];
  cards: CourseCard[];
  checks: CourseCheck[];
  reward: { xp: number; cash: number };
}

export interface CourseUnit {
  id: string;
  title: string;
  icon: string;
  /** Topic used for progress stats and quest events. */
  topic: Topic;
  blurb: string;
  lessons: CourseLesson[];
}

export interface Briefing {
  /** Advanced: the few things to know before you start. */
  ideas: string[];
  formula?: string;
  example?: string;
  concepts: string[];
  /** Entry: the same in a sentence or two for younger players. */
  entry?: string[];
}

export type AdvLesson = CourseLesson & { unit: CourseUnit; concepts: string[] };

export const UNITS = [u01, u02, u03, u04, u05, u06, u07, u08, u09, u10, u11, u12] as CourseUnit[];
export const ADV_LESSONS: AdvLesson[] = UNITS.flatMap((u) => u.lessons.map((l) => ({ ...l, unit: u, concepts: l.terms.map((t) => t.id) })));
export const ADV_LESSON_BY_ID = new Map(ADV_LESSONS.map((l) => [l.id, l]));

export const CONCEPTS: Concept[] = ADV_LESSONS.flatMap((l) => l.terms);
export const CONCEPT_BY_ID = new Map(CONCEPTS.map((c) => [c.id, c]));
/** The lesson that teaches each concept. */
export const LESSON_FOR_CONCEPT = new Map(ADV_LESSONS.flatMap((l) => l.concepts.map((c) => [c, l] as const)));

export const BRIEFINGS = briefings.briefings as Record<string, Briefing>;

/** Escape a phrase for use inside a RegExp. */
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * One pattern per concept. Short all-caps terms (APR, EPS, P/E) match case-sensitively so "apr"
 * inside "April" doesn't count; everything else ignores case. Matches whole words only.
 */
const PATTERNS = CONCEPTS.map((c) => {
  const phrases = [c.term, ...(c.aka ?? [])];
  const strict = phrases.filter((p) => /^[A-Z0-9/&-]{2,6}s?$/.test(p));
  const loose = phrases.filter((p) => !strict.includes(p));
  const wrap = (ps: string[]) => `(?<![A-Za-z0-9])(?:${ps.map(esc).join('|')})(?![A-Za-z0-9])`;
  return {
    c,
    strict: strict.length ? new RegExp(wrap(strict)) : null,
    loose: loose.length ? new RegExp(wrap(loose), 'i') : null,
  };
});

/**
 * The first mention of each concept, minus any that sit inside a longer mention of another one
 * ("spread" inside "credit spread" is the credit spread, not the bid-ask spread).
 */
function scan(text: string): { concept: Concept; start: number; end: number }[] {
  const hits: { concept: Concept; start: number; end: number }[] = [];
  for (const p of PATTERNS) {
    let best: RegExpMatchArray | null = null;
    for (const re of [p.strict, p.loose]) {
      const m = re ? text.match(re) : null;
      if (m && m.index !== undefined && (!best || m.index < best.index!)) best = m;
    }
    if (best) hits.push({ concept: p.c, start: best.index!, end: best.index! + best[0].length });
  }
  return hits.filter((h) => !hits.some((o) => o !== h && o.start <= h.start && o.end >= h.end && o.end - o.start > h.end - h.start));
}

/** Concepts mentioned in a piece of text, in the order they first appear. */
export function conceptsIn(text: string): Concept[] {
  return scan(text)
    .sort((a, b) => a.start - b.start)
    .map((h) => h.concept);
}

/** Text split into plain runs and the first mention of each concept, for tappable terms. */
export function splitTerms(text: string): (string | { concept: Concept; text: string })[] {
  // Longest mentions claim their spot first; anything overlapping a claimed spot is dropped
  const marks: { start: number; end: number; concept: Concept }[] = [];
  for (const h of scan(text).sort((a, b) => b.end - b.start - (a.end - a.start))) {
    if (!marks.some((k) => h.start < k.end && h.end > k.start)) marks.push(h);
  }
  marks.sort((a, b) => a.start - b.start);
  const out: (string | { concept: Concept; text: string })[] = [];
  let at = 0;
  for (const k of marks) {
    if (k.start > at) out.push(text.slice(at, k.start));
    out.push({ concept: k.concept, text: text.slice(k.start, k.end) });
    at = k.end;
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
}

/** Lessons that teach the given concepts, without repeats, in course order. */
export function lessonsFor(conceptIds: string[]): AdvLesson[] {
  const ids = new Set(conceptIds.map((c) => LESSON_FOR_CONCEPT.get(c)?.id).filter(Boolean));
  return ADV_LESSONS.filter((l) => ids.has(l.id));
}

/** Activities whose briefing uses any of this lesson's concepts ("where you'll use this"). */
export function usedAt(lesson: AdvLesson): ActivityDef[] {
  return ACTIVITIES.filter((a) => BRIEFINGS[a.id]?.concepts.some((c) => lesson.concepts.includes(c)));
}

/** Formulas from the glossary, for the formula sheet. */
export function glossaryFormulas(): [string, string][] {
  return CONCEPTS.filter((c) => c.formula).map((c) => [c.term, c.formula!]);
}
