/**
 * Question engine: turns data templates into concrete, randomized questions, selects them adaptively,
 * and grades answers (with tolerance for computed numbers).
 */
import type { QuestionDef, QuestionMedia } from '../content';
import type { Difficulty, LocationId, Topic } from '../types';
import { evaluate } from './expr';
import { makeRng, type Rng } from '../rng';

export interface RuntimeQuestion {
  id: string;
  type: QuestionDef['type'];
  topic: Topic;
  level: number;
  city: LocationId;
  prompt: string;
  choices: string[];
  /** mc/tf: correct index · multi: indices · order: correct order of original choice indices */
  correct: number | number[];
  value?: number; // numeric answer
  tolAbs: number;
  tolRel: number;
  unit?: string;
  format?: QuestionDef['format'];
  explanation: string;
  hint?: string;
  media?: QuestionMedia;
  icon?: string;
  computed: boolean;
}

export function formatValue(v: number, fmt?: string): string {
  switch (fmt) {
    case 'money': {
      const cents = Math.abs(v) < 1000 || Math.abs(v - Math.round(v)) > 0.004;
      return `${v < 0 ? '−' : ''}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 })}`;
    }
    case 'money0':
      return `$${Math.round(v).toLocaleString('en-US')}`;
    case 'pct':
      return `${(+v.toFixed(2)).toLocaleString('en-US')}%`;
    case 'int':
      return Math.round(v).toLocaleString('en-US');
    case 'years':
      return `${+v.toFixed(1)} years`;
    case 'months':
      return `${Math.round(v)} months`;
    default:
      return (+v.toFixed(4)).toLocaleString('en-US', { maximumFractionDigits: 4 });
  }
}

/** Replace {name} and {name:fmt} in text. */
export function fillTemplate(text: string, vars: Record<string, number | string>): string {
  // "${x}" (a dollar sign right before the placeholder) formats x as money: $4.50, $1,200
  return text.replace(/(\$?)\{([A-Za-z_][A-Za-z0-9_]*)(?::([a-z0-9]+))?\}/g, (m, dollar: string, name: string, fmt?: string) => {
    if (!Object.prototype.hasOwnProperty.call(vars, name)) return m;
    const v = vars[name];
    if (typeof v === 'string') return dollar + v;
    if (dollar && !fmt) return formatValue(v, 'money');
    return dollar + formatValue(v, fmt);
  });
}

function sampleVar(spec: { min?: number; max?: number; step?: number; choices?: (number | string)[] }, rng: Rng): number | string {
  if (spec.choices) return rng.pick(spec.choices);
  const min = spec.min ?? 0;
  const max = spec.max ?? min;
  const step = spec.step ?? 1;
  const n = Math.floor((max - min) / step);
  return +(min + rng.int(0, n) * step).toFixed(6);
}

export function instantiate(q: QuestionDef, rng: Rng): RuntimeQuestion {
  const vars: Record<string, number | string> = {};
  for (const [k, spec] of Object.entries(q.vars ?? {})) vars[k] = sampleVar(spec, rng);
  const numVars = () => Object.fromEntries(Object.entries(vars).filter(([, v]) => typeof v === 'number')) as Record<string, number>;
  for (const [k, expr] of Object.entries(q.derived ?? {})) vars[k] = evaluate(expr, numVars());

  const base: RuntimeQuestion = {
    id: q.id,
    type: q.type,
    topic: q.topic,
    level: q.level,
    city: q.city,
    prompt: fillTemplate(q.prompt, vars),
    choices: [],
    correct: 0,
    tolAbs: q.toleranceAbs ?? (q.format === 'money' ? 0.02 : 0.001),
    tolRel: q.tolerance ?? 0.005,
    unit: q.unit,
    format: q.format,
    explanation: fillTemplate(q.explanation, vars),
    hint: q.hint ? fillTemplate(q.hint, vars) : undefined,
    media: q.media ? fillMedia(q.media, vars) : undefined,
    icon: q.icon,
    computed: !!(q.answerExpr || q.choiceExprs || q.vars),
  };

  switch (q.type) {
    case 'numeric': {
      const value = q.answerExpr ? evaluate(q.answerExpr, numVars()) : Number(q.answer);
      base.value = value;
      vars.ANSWER = value;
      base.explanation = fillTemplate(q.explanation, { ...vars, ANSWER: value });
      return base;
    }
    case 'tf': {
      base.choices = ['True', 'False'];
      base.correct = q.answer === true || q.answer === 0 ? 0 : 1;
      return base;
    }
    case 'multi': {
      base.choices = (q.choices ?? []).map((c) => fillTemplate(c, vars));
      base.correct = (q.answer as number[]) ?? [];
      return shuffleChoices(base, rng);
    }
    case 'order': {
      base.choices = (q.choices ?? []).map((c) => fillTemplate(c, vars));
      base.correct = (q.answer as number[]) ?? base.choices.map((_, i) => i);
      return base;
    }
    case 'mc':
    default: {
      if (q.choiceExprs) {
        // First expression is the correct one; the rest are computed distractors.
        const fmt = q.format;
        const values = q.choiceExprs.map((e) => evaluate(e, numVars()));
        const labels: string[] = [];
        values.forEach((v, i) => {
          let label = formatValue(v, fmt);
          // Avoid duplicate distractors
          let bump = 1;
          while (labels.includes(label)) {
            label = formatValue(v * (1 + 0.07 * bump) + (i % 2 ? 1 : -1) * bump, fmt);
            bump++;
          }
          labels.push(label);
        });
        base.choices = labels;
        base.correct = 0;
        vars.ANSWER = values[0];
        base.explanation = fillTemplate(q.explanation, { ...vars, ANSWER: values[0] });
      } else {
        base.choices = (q.choices ?? []).map((c) => fillTemplate(c, vars));
        base.correct = typeof q.answer === 'number' ? q.answer : 0;
      }
      // Keep "All of the above"-style answers in place
      if (base.choices.some((c) => /of the above|both/i.test(c))) return base;
      return shuffleChoices(base, rng);
    }
  }
}

function fillMedia(m: QuestionMedia, vars: Record<string, number | string>): QuestionMedia {
  return {
    ...m,
    title: m.title ? fillTemplate(m.title, vars) : undefined,
    rows: m.rows?.map((r) => r.map((c) => (typeof c === 'string' ? fillTemplate(c, vars) : c))),
    lines: m.lines?.map((l) => fillTemplate(l, vars)),
  };
}

function shuffleChoices(q: RuntimeQuestion, rng: Rng): RuntimeQuestion {
  const idx = q.choices.map((_, i) => i);
  rng.shuffle(idx);
  const choices = idx.map((i) => q.choices[i]);
  const map = (old: number) => idx.indexOf(old);
  const correct = Array.isArray(q.correct) ? q.correct.map(map).sort((a, b) => a - b) : map(q.correct);
  return { ...q, choices, correct };
}

export type Response = { kind: 'choice'; index: number } | { kind: 'multi'; indices: number[] } | { kind: 'numeric'; value: number } | { kind: 'order'; order: number[] };

export function grade(q: RuntimeQuestion, r: Response): boolean {
  switch (q.type) {
    case 'numeric': {
      if (r.kind !== 'numeric' || q.value === undefined || !Number.isFinite(r.value)) return false;
      const diff = Math.abs(r.value - q.value);
      return diff <= Math.max(q.tolAbs, Math.abs(q.value) * q.tolRel);
    }
    case 'multi': {
      if (r.kind !== 'multi') return false;
      const a = [...r.indices].sort((x, y) => x - y);
      const b = q.correct as number[];
      return a.length === b.length && a.every((v, i) => v === b[i]);
    }
    case 'order': {
      if (r.kind !== 'order') return false;
      const c = q.correct as number[];
      return r.order.length === c.length && r.order.every((v, i) => v === c[i]);
    }
    default:
      return r.kind === 'choice' && r.index === q.correct;
  }
}

export function correctAnswerText(q: RuntimeQuestion): string {
  switch (q.type) {
    case 'numeric':
      return `${formatValue(q.value ?? 0, q.format)}${q.unit && q.format !== 'money' ? ` ${q.unit}` : ''}`;
    case 'multi':
      return (q.correct as number[]).map((i) => q.choices[i]).join(' + ');
    case 'order':
      return (q.correct as number[]).map((i) => q.choices[i]).join(' → ');
    default:
      return q.choices[q.correct as number];
  }
}

/* ───────── Selection ───────── */

export interface SelectOptions {
  difficulty: Difficulty;
  cities?: LocationId[];
  buildings?: string[];
  topics?: Topic[];
  level?: number; // target level (Entry adaptive), picks near it
  minLevel?: number;
  maxLevel?: number;
  count: number;
  seed: number;
  avoid?: string[]; // recently seen ids
}

export function selectQuestions(bank: QuestionDef[], o: SelectOptions): RuntimeQuestion[] {
  const rng = makeRng(o.seed);
  let pool = bank.filter((q) => q.difficulty === o.difficulty);
  if (o.cities?.length) pool = pool.filter((q) => o.cities!.includes(q.city));
  if (o.buildings?.length) {
    const b = pool.filter((q) => q.building && o.buildings!.includes(q.building));
    if (b.length >= o.count) pool = b;
  }
  if (o.topics?.length) {
    const t = pool.filter((q) => o.topics!.includes(q.topic));
    if (t.length >= Math.min(o.count, 3)) pool = t;
  }
  if (o.minLevel) pool = pool.filter((q) => q.level >= o.minLevel!);
  if (o.maxLevel) pool = pool.filter((q) => q.level <= o.maxLevel!);
  if (!pool.length) pool = bank.filter((q) => q.difficulty === o.difficulty);
  // Weight: near target level, and not recently seen
  const weighted = pool.map((q) => {
    let wgt = 1;
    if (o.level) wgt *= Math.pow(0.35, Math.abs(q.level - o.level));
    if (o.avoid?.includes(q.id)) wgt *= 0.15;
    if (q.vars) wgt *= 1.2; // templated questions stay fresh
    return { q, wgt, key: rng.next() ** (1 / wgt) };
  });
  weighted.sort((a, b) => b.key - a.key);
  const picked = weighted.slice(0, o.count).map((x) => x.q);
  // Easier first
  picked.sort((a, b) => a.level - b.level);
  return picked.map((q) => instantiate(q, rng));
}

/** Entry adaptive sub-level: 3 right in a row → up, 2 wrong in a row → down. */
export function adaptLevel(level: number, streakRight: number, streakWrong: number): number {
  if (streakRight >= 3) return Math.min(5, level + 1);
  if (streakWrong >= 2) return Math.max(1, level - 1);
  return level;
}
