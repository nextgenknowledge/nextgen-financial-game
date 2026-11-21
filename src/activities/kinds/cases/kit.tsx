'use client';
/**
 * Case files: the engine behind the Advanced "real life" activities. A case is a run of steps,
 * each built around something a teenager or young adult actually meets (a lease, a bank
 * statement, a group chat, a loot box) rather than a formula to recall:
 *
 *  - pick:   read the evidence, make the call. Options carry partial credit, so "it depends"
 *            answers can be graded honestly, and each one explains itself afterwards.
 *  - flag:   mark the lines of a document that are a problem. Missing one costs credit, and so
 *            does flagging a line that is fine.
 *  - dial:   estimate a number with a slider, from figures that are all on screen.
 *  - custom: a bespoke mini-game that reports its own credit.
 *
 * Steps are functions of the case's state, so choices can carry forward (money spent early is
 * gone later). The run ends on a debrief: the outcome, what the pros know, then the score.
 */
import { useMemo, useRef, useState, type ReactNode } from 'react';
import type { KindProps, ReviewItem } from '../../types';
import { makeRng, type Rng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { ProHead, Stats } from '../pro/kit';
import { variantIndex } from '../../variant';

/* ───────── Step definitions ───────── */

export interface Option<S> {
  label: ReactNode;
  /** 0 … 1: how good this choice is. */
  credit: number;
  /** Shown after answering: why this choice works or does not. */
  why: string;
  /** Carry the choice forward into the case's state. */
  apply?: (s: S) => void;
}

interface StepBase {
  /** Scene-setting text above the evidence. */
  brief: ReactNode;
  /** The evidence: a document, feed, chart or cards. */
  visual?: ReactNode;
  prompt: string;
  /** How much this step counts toward the score (default 1). */
  weight?: number;
}

export interface PickStep<S> extends StepBase {
  kind: 'pick';
  options: Option<S>[];
  /** Keep the options in the order written (default: shuffled). */
  ordered?: boolean;
}

export interface DocLine {
  id: string;
  /** Left text. */
  l: ReactNode;
  /** Right text, usually an amount. */
  r?: ReactNode;
  /** A heading or note line that cannot be flagged. */
  head?: boolean;
}

export interface DocDef {
  title: string;
  sub?: string;
  /** Paper style. */
  skin?: 'paper' | 'statement' | 'contract' | 'receipt' | 'screen';
  lines: DocLine[];
  foot?: ReactNode;
}

export interface FlagStep extends StepBase {
  kind: 'flag';
  doc: DocDef;
  /** Line id → why it is a problem. */
  issues: Record<string, string>;
  /** Line id → why a tempting line is actually fine (shown if wrongly flagged). */
  fine?: Record<string, string>;
}

export interface DialStep<S> extends StepBase {
  kind: 'dial';
  min: number;
  max: number;
  step: number;
  answer: number;
  /** Within this distance scores full credit; credit falls to zero at four times it. */
  tol: number;
  fmt: (v: number) => string;
  why: string;
  start?: number;
  apply?: (s: S, guess: number) => void;
}

export interface CustomStep<S> {
  kind: 'custom';
  weight?: number;
  render: (done: (credit: number, review?: ReviewItem) => void, ctx: CaseCtx<S>) => ReactNode;
}

export interface ChooseStep extends StepBase {
  kind: 'choose';
  /** How many options the player must pick. */
  k: number;
  /** `good` options are the ones worth picking; every option explains itself afterwards. */
  options: { label: string; good: boolean; why: string }[];
}

export type Step<S> = PickStep<S> | FlagStep | DialStep<S> | ChooseStep | CustomStep<S>;

export interface CaseCtx<S> {
  s: S;
  rng: Rng;
}

export type StepBuilder<S> = (ctx: CaseCtx<S>) => Step<S>;

export interface CaseDef<S> {
  kicker: string;
  init: (rng: Rng) => S;
  /**
   * The case, step by step. A slot can hold a list of alternative steps: each run plays one of
   * them, never the one played last time, so replays bring different questions.
   */
  steps: (StepBuilder<S> | StepBuilder<S>[])[];
  /** More versions of a slot, by slot number (0 = first step). Same effect as a list in `steps`. */
  alts?: Record<number, StepBuilder<S>[]>;
  /** Running numbers shown above each step. */
  meters?: (s: S) => [string, ReactNode, ('good' | 'bad')?][];
  /** How the story ended, from the state. `bonus` shifts the final score (in points). */
  outcome?: (s: S) => { headline: string; detail?: ReactNode; bonus?: number };
  /** Three or four lines worth remembering. */
  takeaways: string[];
}

/* ───────── Presentation pieces ───────── */

/** A document on paper: lease, statement, offer, receipt. Lines can be tapped when `onToggle` is set. */
export function Doc({ doc, picked, onToggle, verdict }: { doc: DocDef; picked?: Set<string>; onToggle?: (id: string) => void; verdict?: (id: string) => 'hit' | 'miss' | 'false' | null }) {
  return (
    <div className={cls('cs-doc', `cs-${doc.skin ?? 'paper'}`)}>
      <div className="cs-doc-head">
        <b>{doc.title}</b>
        {doc.sub && <span>{doc.sub}</span>}
      </div>
      {doc.lines.map((ln) => {
        if (ln.head)
          return (
            <div key={ln.id} className="cs-line head">
              <span>{ln.l}</span>
              {ln.r && <span>{ln.r}</span>}
            </div>
          );
        const v = verdict?.(ln.id) ?? null;
        const on = picked?.has(ln.id);
        return (
          <button key={ln.id} type="button" className={cls('cs-line', onToggle && 'tap', on && 'on', v)} disabled={!onToggle} onClick={() => onToggle?.(ln.id)}>
            <span>{ln.l}</span>
            {ln.r && <span className="cs-amt">{ln.r}</span>}
            {onToggle && <i className="cs-flag">{on ? '🚩' : ''}</i>}
            {v && <i className="cs-flag">{v === 'hit' ? '✅' : v === 'miss' ? '⚠️' : '❌'}</i>}
          </button>
        );
      })}
      {doc.foot && <div className="cs-doc-foot">{doc.foot}</div>}
    </div>
  );
}

export interface Post {
  who: string;
  handle?: string;
  text: ReactNode;
  /** Small line under the post: likes, time, a label. */
  meta?: string;
  tone?: 'ad' | 'warn' | 'me';
}

/** A social feed or group chat. */
export function Feed({ posts, title }: { posts: Post[]; title?: string }) {
  return (
    <div className="cs-feed">
      {title && <div className="cs-feed-title">{title}</div>}
      {posts.map((p, i) => (
        <div key={i} className={cls('cs-post', p.tone)}>
          <span className="cs-avatar" style={{ background: `hsl(${(p.who.charCodeAt(0) * 47 + p.who.length * 91) % 360} 55% 42%)` }}>
            {p.who[0]}
          </span>
          <div>
            <div className="cs-post-who">
              <b>{p.who}</b> {p.handle && <span>{p.handle}</span>} {p.tone === 'ad' && <em>Sponsored</em>}
            </div>
            <div className="cs-post-text">{p.text}</div>
            {p.meta && <div className="cs-post-meta">{p.meta}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

export interface CardDef {
  icon?: string;
  title: string;
  sub?: string;
  facts: [string, ReactNode][];
  tag?: string;
}

/** Side-by-side profile cards: people, accounts, offers, apartments. */
export function Cards({ cards }: { cards: CardDef[] }) {
  return (
    <div className="cs-cards">
      {cards.map((c) => (
        <div key={c.title} className="cs-card">
          <div className="cs-card-head">
            {c.icon && <span className="cs-card-icon">{c.icon}</span>}
            <div>
              <b>{c.title}</b>
              {c.sub && <span>{c.sub}</span>}
            </div>
            {c.tag && <em>{c.tag}</em>}
          </div>
          <dl>
            {c.facts.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

/** A short quoted line from someone in the scene. */
export function Say({ who, children }: { who: string; children: ReactNode }) {
  return (
    <div className="cs-say">
      <b>{who}</b>
      <span>{children}</span>
    </div>
  );
}

/* ───────── The runner ───────── */

function PickView<S>({ step, rng, onDone }: { step: PickStep<S>; rng: Rng; onDone: (credit: number, review: ReviewItem, apply?: (s: S) => void) => void }) {
  const order = useMemo(() => (step.ordered ? step.options.map((_, i) => i) : rng.shuffle(step.options.map((_, i) => i))), [step, rng]);
  const [chosen, setChosen] = useState<number | null>(null);
  const best = step.options.reduce((b, o, i) => (o.credit > step.options[b].credit ? i : b), 0);
  const text = (n: ReactNode) => (typeof n === 'string' ? n : 'the best option');
  return (
    <div className="cs-answer">
      <div className="cs-prompt">{step.prompt}</div>
      <div className="cs-options">
        {order.map((k) => {
          const o = step.options[k];
          const shown = chosen !== null;
          return (
            <button
              key={k}
              type="button"
              disabled={shown}
              className={cls('cs-option', shown && k === best && 'right', shown && k === chosen && k !== best && (o.credit >= 0.5 ? 'partial' : 'wrong'))}
              onClick={() => {
                setChosen(k);
                playSfx(o.credit >= 0.99 ? 'correct' : o.credit >= 0.5 ? 'pop' : 'wrong');
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {chosen !== null && (
        <div className={cls('cs-reveal', step.options[chosen].credit >= 0.99 ? 'ok' : step.options[chosen].credit >= 0.5 ? 'mid' : 'no')}>
          <b>{step.options[chosen].credit >= 0.99 ? 'Good call.' : step.options[chosen].credit >= 0.5 ? 'Partly right.' : 'Not this time.'}</b>
          <span>{step.options[chosen].why}</span>
          {chosen !== best && (
            <span>
              <u>Stronger:</u> {step.options[best].why}
            </span>
          )}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="gold"
              onClick={() => {
                const o = step.options[chosen];
                onDone(o.credit, { q: step.prompt, ok: o.credit >= 0.99, answer: text(step.options[best].label), explanation: step.options[best].why }, o.apply);
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function FlagView({ step, onDone }: { step: FlagStep; onDone: (credit: number, review: ReviewItem) => void }) {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [checked, setChecked] = useState(false);
  const bad = Object.keys(step.issues);
  const hits = bad.filter((id) => picked.has(id)).length;
  const falses = [...picked].filter((id) => !step.issues[id]).length;
  // A wrong flag costs as much as a find earns, so flagging everything scores nothing
  const credit = Math.max(0, (hits - falses) / bad.length);
  const lineText = (id: string) => {
    const l = step.doc.lines.find((x) => x.id === id)?.l;
    return typeof l === 'string' ? l : id;
  };
  return (
    <div className="cs-answer">
      <div className="cs-prompt">
        {step.prompt} <em>({bad.length} to find. A wrong flag cancels a right one.)</em>
      </div>
      <Doc
        doc={step.doc}
        picked={picked}
        onToggle={
          checked
            ? undefined
            : (id) => {
                setPicked((old) => {
                  const n = new Set(old);
                  if (n.has(id)) n.delete(id);
                  else n.add(id);
                  return n;
                });
                playSfx('click');
              }
        }
        verdict={checked ? (id) => (step.issues[id] ? (picked.has(id) ? 'hit' : 'miss') : picked.has(id) ? 'false' : null) : undefined}
      />
      {!checked ? (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">
            {picked.size} flagged of {bad.length}
          </span>
          <Button
            variant="gold"
            disabled={picked.size === 0}
            onClick={() => {
              setChecked(true);
              playSfx(credit >= 0.99 ? 'correct' : credit > 0.4 ? 'pop' : 'wrong');
            }}
          >
            Check my flags
          </Button>
        </div>
      ) : (
        <div className={cls('cs-reveal', credit >= 0.99 ? 'ok' : credit >= 0.5 ? 'mid' : 'no')}>
          <b>
            Found {hits} of {bad.length}
            {falses > 0 ? `, with ${falses} wrong flag${falses > 1 ? 's' : ''}` : ''}.
          </b>
          <ul className="cs-why">
            {bad.map((id) => (
              <li key={id}>
                <i>{picked.has(id) ? '✅' : '⚠️'}</i> <b>{lineText(id)}:</b> {step.issues[id]}
              </li>
            ))}
            {[...picked]
              .filter((id) => !step.issues[id])
              .map((id) => (
                <li key={id}>
                  <i>❌</i> <b>{lineText(id)}:</b> {step.fine?.[id] ?? 'This line is normal and fair.'}
                </li>
              ))}
          </ul>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="gold" onClick={() => onDone(credit, { q: `${step.doc.title}: ${step.prompt}`, ok: credit >= 0.99, answer: bad.map(lineText).join('; '), explanation: bad.map((id) => step.issues[id]).join(' ') })}>
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChooseView({ step, rng, onDone }: { step: ChooseStep; rng: Rng; onDone: (credit: number, review: ReviewItem) => void }) {
  const order = useMemo(() => rng.shuffle(step.options.map((_, i) => i)), [step, rng]);
  const [picked, setPicked] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const goodN = Math.min(step.k, step.options.filter((o) => o.good).length);
  const credit = goodN ? picked.filter((i) => step.options[i].good).length / goodN : 0;
  const goods = step.options.filter((o) => o.good);
  return (
    <div className="cs-answer">
      <div className="cs-prompt">
        {step.prompt} <em>(Choose {step.k}.)</em>
      </div>
      <div className="cs-options">
        {order.map((k) => {
          const o = step.options[k];
          const on = picked.includes(k);
          return (
            <button
              key={k}
              type="button"
              disabled={checked}
              className={cls('cs-option', !checked && on && 'on', checked && on && (o.good ? 'right' : 'wrong'), checked && !on && o.good && 'partial')}
              onClick={() => {
                setPicked((old) => (old.includes(k) ? old.filter((x) => x !== k) : old.length >= step.k ? [...old.slice(1), k] : [...old, k]));
                playSfx('click');
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {!checked ? (
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="small muted">
            {picked.length} of {step.k} chosen
          </span>
          <Button
            variant="gold"
            disabled={picked.length !== step.k}
            onClick={() => {
              setChecked(true);
              playSfx(credit >= 0.99 ? 'correct' : credit >= 0.5 ? 'pop' : 'wrong');
            }}
          >
            Lock in
          </Button>
        </div>
      ) : (
        <div className={cls('cs-reveal', credit >= 0.99 ? 'ok' : credit >= 0.5 ? 'mid' : 'no')}>
          <b>{credit >= 0.99 ? 'Every pick was a strong one.' : credit >= 0.5 ? 'Some strong picks, some misses.' : 'Not the strongest picks.'}</b>
          <ul className="cs-why">
            {step.options.map((o, i) =>
              picked.includes(i) || o.good ? (
                <li key={i}>
                  <i>{picked.includes(i) ? (o.good ? '✅' : '❌') : '⚠️'}</i> <b>{o.label}</b> {o.why}
                </li>
              ) : null,
            )}
          </ul>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="gold" onClick={() => onDone(credit, { q: step.prompt, ok: credit >= 0.99, answer: goods.map((o) => o.label).join('; '), explanation: goods.map((o) => o.why).join(' ') })}>
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DialView<S>({ step, onDone }: { step: DialStep<S>; onDone: (credit: number, review: ReviewItem, apply?: (s: S) => void) => void }) {
  const [v, setV] = useState(step.start ?? step.min);
  const [locked, setLocked] = useState(false);
  const off = Math.abs(v - step.answer);
  const credit = off <= step.tol ? 1 : Math.max(0, 1 - (off - step.tol) / (step.tol * 3));
  return (
    <div className="cs-answer">
      <div className="cs-prompt">{step.prompt}</div>
      <div className="cs-dial">
        <input type="range" min={step.min} max={step.max} step={step.step} value={v} disabled={locked} onChange={(e) => setV(Number(e.target.value))} />
        <b>{step.fmt(v)}</b>
      </div>
      {!locked ? (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button
            variant="gold"
            onClick={() => {
              setLocked(true);
              playSfx(credit >= 0.99 ? 'correct' : credit > 0.4 ? 'pop' : 'wrong');
            }}
          >
            Lock it in
          </Button>
        </div>
      ) : (
        <div className={cls('cs-reveal', credit >= 0.99 ? 'ok' : credit >= 0.5 ? 'mid' : 'no')}>
          <b>
            {credit >= 0.99 ? 'Right on it.' : credit >= 0.5 ? 'Close.' : 'Off the mark.'} The answer is {step.fmt(step.answer)}.
          </b>
          <span>{step.why}</span>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="gold" onClick={() => onDone(credit, { q: step.prompt, ok: credit >= 0.99, answer: step.fmt(step.answer), explanation: step.why }, step.apply ? (s: S) => step.apply!(s, v) : undefined)}>
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function CaseRunner<S>({ def, seed, onFinish, addReview }: { def: CaseDef<S>; seed: number } & Pick<KindProps, 'onFinish' | 'addReview'>) {
  const rng = useMemo(() => makeRng(seed * 131 + 17), [seed]);
  const state = useRef<S | null>(null);
  if (state.current === null) state.current = def.init(rng);
  const s = state.current;
  const [i, setI] = useState(0);
  const tally = useRef({ got: 0, of: 0 });
  // Each step is built once, when reached, from the state as it stands then
  const built = useRef<Step<S>[]>([]);
  // Which version of each slot this run plays
  const [pickers] = useState(() =>
    def.steps.map((slot, j) => {
      const all = [slot, def.alts?.[j] ?? []].flat();
      return all[variantIndex(`case:${def.kicker}:${j}`, all.length, seed + j * 13)];
    }),
  );
  if (i < pickers.length && !built.current[i]) built.current[i] = pickers[i]({ s, rng });

  const advance = (credit: number, review?: ReviewItem, apply?: (st: S) => void) => {
    const w = built.current[i].weight ?? 1;
    tally.current.got += Math.max(0, Math.min(1, credit)) * w;
    tally.current.of += w;
    apply?.(s);
    if (review) addReview?.(review);
    playSfx('whoosh');
    setI(i + 1);
  };

  if (i >= def.steps.length) {
    const out = def.outcome?.(s);
    const base = tally.current.of ? (tally.current.got / tally.current.of) * 100 : 0;
    const score = Math.max(0, Math.min(100, base + (out?.bonus ?? 0)));
    return (
      <div className="pro">
        <ProHead kicker={`${def.kicker} · Debrief`} title={out?.headline ?? (score >= 90 ? 'Sharp work' : score >= 72 ? 'Solid judgment' : score >= 50 ? 'Case closed, with a few misses' : 'A tough case')} sub={`Decisions: ${Math.round(base)}%${out?.bonus ? `, outcome ${out.bonus > 0 ? '+' : ''}${Math.round(out.bonus)}` : ''}.`} />
        {def.meters && <Stats items={def.meters(s)} />}
        <div className="pro-grid">
          {out?.detail && <section className="pro-panel">{out.detail}</section>}
          <section className="pro-panel">
            <h4>What the pros know</h4>
            <ul className="cs-takeaways">
              {def.takeaways.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="gold" size="big" onClick={() => onFinish({ score, summary: out?.headline })}>
                Finish ▶
              </Button>
            </div>
          </section>
        </div>
      </div>
    );
  }

  const step = built.current[i];
  return (
    <div className="pro cs">
      <div className="pro-head">
        <div>
          <div className="pro-kicker">
            {def.kicker} · {i + 1} of {def.steps.length}
          </div>
          <div className="cs-dots">
            {def.steps.map((_, k) => (
              <i key={k} className={cls(k < i && 'done', k === i && 'now')} />
            ))}
          </div>
        </div>
      </div>
      {def.meters && <Stats items={def.meters(s)} />}
      {step.kind === 'custom' ? (
        <div key={i}>{step.render((c, r) => advance(c, r), { s, rng })}</div>
      ) : (
        <div key={i} className="cs-step">
          <div className="cs-brief">{step.brief}</div>
          {step.visual && <section className="pro-panel cs-evidence">{step.visual}</section>}
          {step.kind === 'pick' && <PickView step={step} rng={rng} onDone={advance} />}
          {step.kind === 'flag' && <FlagView step={step} onDone={advance} />}
          {step.kind === 'dial' && <DialView step={step} onDone={advance} />}
          {step.kind === 'choose' && <ChooseView step={step} rng={rng} onDone={advance} />}
        </div>
      )}
    </div>
  );
}

/** Helper to write a step without repeating the state type. */
export const pick = <S,>(p: Omit<PickStep<S>, 'kind'>): PickStep<S> => ({ kind: 'pick', ...p });
export const flag = (p: Omit<FlagStep, 'kind'>): FlagStep => ({ kind: 'flag', ...p });
export const dial = <S,>(p: Omit<DialStep<S>, 'kind'>): DialStep<S> => ({ kind: 'dial', ...p });
export const choose = (p: Omit<ChooseStep, 'kind'>): ChooseStep => ({ kind: 'choose', ...p });
