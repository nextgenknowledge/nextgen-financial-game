/** All question banks (src/data/questions/<city>.<difficulty>.json). */
import type { QuestionDef } from '../content';
import parkE from '@/data/questions/park.entry.json';
import parkA from '@/data/questions/park.advanced.json';
import nyE from '@/data/questions/new-york.entry.json';
import nyA from '@/data/questions/new-york.advanced.json';
import ldE from '@/data/questions/london.entry.json';
import ldA from '@/data/questions/london.advanced.json';
import hkE from '@/data/questions/hong-kong.entry.json';
import hkA from '@/data/questions/hong-kong.advanced.json';
import sfE from '@/data/questions/san-francisco.entry.json';
import sfA from '@/data/questions/san-francisco.advanced.json';
import sgE from '@/data/questions/singapore.entry.json';
import sgA from '@/data/questions/singapore.advanced.json';

export const QUESTION_BANK: QuestionDef[] = [parkE, parkA, nyE, nyA, ldE, ldA, hkE, hkA, sfE, sfA, sgE, sgA].flatMap(
  (f) => (f as { questions: unknown[] }).questions as QuestionDef[],
);
