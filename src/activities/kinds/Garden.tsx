'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { usePausedRef } from '../paused';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import { QuestionView } from '../QuestionView';
import { synthQ } from '../QuestionSeq';

/** SVG money tree that grows with the balance. */
export function MoneyTree({ value, start }: { value: number; start: number }) {
  const g = Math.max(0, Math.log(Math.max(value, 1) / Math.max(start, 1)) / Math.log(16)); // 0..1 at 16×
  const t = Math.min(1.2, g);
  const trunkH = 40 + t * 110;
  const r = 25 + t * 70;
  const coins = Math.min(14, Math.floor(t * 14));
  return (
    <svg viewBox="0 0 300 260" style={{ width: '100%', maxWidth: 320 }} role="img" aria-label={`Money tree worth ${money(value)}`}>
      <rect x="0" y="230" width="300" height="30" fill="#8fd06a" />
      <rect x={150 - 8 - t * 6} y={230 - trunkH} width={16 + t * 12} height={trunkH} fill="#8a5a34" rx="4" />
      <circle cx="150" cy={230 - trunkH} r={r} fill="#4fa64a" />
      <circle cx={150 - r * 0.6} cy={230 - trunkH + r * 0.3} r={r * 0.6} fill="#5cb555" />
      <circle cx={150 + r * 0.6} cy={230 - trunkH + r * 0.25} r={r * 0.62} fill="#48984a" />
      {Array.from({ length: coins }, (_, i) => {
        const a = (i / Math.max(1, coins)) * Math.PI * 2;
        return (
          <g key={i}>
            <circle cx={150 + Math.cos(a) * r * 0.75} cy={230 - trunkH + Math.sin(a) * r * 0.6} r="7" fill="#ffcf3f" stroke="#d99a12" strokeWidth="2" />
          </g>
        );
      })}
      <text x="150" y="252" textAnchor="middle" fontSize="16" fontWeight="900" fill="#1e2840">
        {money(value, { cents: false })}
      </text>
    </svg>
  );
}

interface Plan {
  label: string;
  P: number;
  r: number; // annual
  years: number;
  n: number; // compounding per year
  add: number; // monthly addition
}

export function grow(p: Plan): number[] {
  const out = [p.P];
  let bal = p.P;
  for (let y = 1; y <= p.years; y++) {
    for (let m = 0; m < 12; m++) {
      if (p.n === 12) bal *= 1 + p.r / 12;
      bal += p.add;
    }
    if (p.n === 1) bal *= 1 + p.r;
    out.push(bal);
  }
  return out;
}

/** Choose (Entry) or predict (Advanced) how money grows, then watch the tree. */
export default function Garden({ params, onFinish, addReview, seed }: KindProps<{ rounds: number; advanced: boolean }>) {
  const adv = params.advanced;
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, () => {
      if (!adv) {
        const P = rng.pick([50, 100, 200]);
        // Three different rate/time trade-offs whose final sizes are clearly different
        const pool: [number, number][] = [
          [0.05, 10], [0.1, 10], [0.1, 20], [0.05, 25], [0.08, 15], [0.12, 8], [0.06, 20], [0.04, 30], [0.15, 5],
        ];
        let combo: [number, number][] = [];
        for (let tries = 0; tries < 50; tries++) {
          combo = rng.shuffle(pool).slice(0, 3);
          const v = combo.map(([r, y]) => Math.pow(1 + r, y)).sort((a, b) => b - a);
          if (v[0] / v[1] > 1.12) break;
        }
        const opts: Plan[] = combo.map(([r, years]) => ({ label: `${money(P, { cents: false })} at ${Math.round(r * 100)}% for ${years} years`, P, r, years, n: 1, add: 0 }));
        return { opts, question: null as null | Plan };
      }
      const plan: Plan = { label: '', P: rng.pick([1000, 2000, 5000]), r: rng.pick([0.04, 0.05, 0.06, 0.07]), years: rng.pick([10, 15, 20]), n: rng.pick([1, 12]), add: rng.pick([0, 50, 100]) };
      return { opts: [] as Plan[], question: plan };
    });
  }, [seed, params.rounds, adv]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<Plan | null>(null);
  const [year, setYear] = useState(0);
  const [answered, setAnswered] = useState(false);
  const pts = useRef(0);
  const pausedRef = usePausedRef();
  const round = rounds[i];
  const plan = pick ?? round.question;
  const path = plan ? grow(plan) : [];

  useEffect(() => {
    if (!plan || (adv && !answered)) return;
    setYear(0);
    const id = setInterval(() => {
      if (pausedRef.current) return;
      setYear((y) => {
        if (y >= plan.years) {
          clearInterval(id);
          return y;
        }
        playSfx('tick');
        return y + 1;
      });
    }, adv ? 90 : 160);
    return () => clearInterval(id);
  }, [plan, answered, adv]);

  const next = () => {
    setPick(null);
    setYear(0);
    setAnswered(false);
    if (i + 1 >= rounds.length) onFinish({ score: (pts.current / rounds.length) * 100 });
    else setI(i + 1);
  };

  if (!adv) {
    const best = round.opts.reduce((a, b) => (grow(b)[b.years] > grow(a)[a.years] ? b : a));
    return (
      <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
        <MoneyTree value={pick ? path[Math.min(year, path.length - 1)] : round.opts[0].P} start={round.opts[0].P} />
        <div className="col grow" style={{ gap: 8, minWidth: 260 }}>
          <b>
            Tree {i + 1}/{rounds.length}: Which plan grows the BIGGEST tree? <ReadAloud text="Which plan grows the biggest money tree?" />
          </b>
          {round.opts.map((o) => (
            <Button
              key={o.label}
              size="big"
              block
              disabled={!!pick}
              variant={pick && o === best ? 'green' : pick === o ? 'danger' : undefined}
              onClick={() => {
                setPick(o);
                const ok = o === best;
                if (ok) pts.current++;
                playSfx(ok ? 'correct' : 'pop');
                act((d, fx) => recordAnswer(d, fx, { id: 'garden-e', topic: 'interest' }, ok));
                addReview?.({ q: 'Biggest money tree?', ok, answer: best.label, explanation: 'A higher rate AND more years both help, and time helps the most because interest earns interest.' });
              }}
            >
              🌱 {o.label}
            </Button>
          ))}
          {pick && (
            <div className="card tint-gold">
              Year {Math.min(year, pick.years)}: {money(path[Math.min(year, path.length - 1)])}
              {year >= pick.years && (
                <>
                  <div className="small">
                    {pick === best ? 'Biggest tree! Time + a good rate = huge growth.' : `The biggest was "${best.label}" → ${money(grow(best)[best.years])}.`}
                  </div>
                  <Button variant="primary" onClick={next}>
                    Next ▶
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const q = round.question!;
  const final = path[path.length - 1];
  const rq = synthQ({
    id: `garden-a-${i}`,
    prompt: `Plant ${money(q.P, { cents: false })} at ${(q.r * 100).toFixed(0)}% compounded ${q.n === 12 ? 'monthly' : 'yearly'}${q.add ? `, adding ${money(q.add, { cents: false })} at the end of every month` : ''}. What will it be worth after ${q.years} years?`,
    topic: 'interest',
    value: final,
    format: 'money',
    tolRel: 0.01,
    explanation: q.add
      ? `Grow the deposit and each monthly addition: ${money(final)}. Additions often matter more than the starting amount!`
      : `${money(q.P, { cents: false })} × (1 + ${(q.r * 100).toFixed(0)}%${q.n === 12 ? '/12' : ''})^${q.n === 12 ? `(12×${q.years})` : q.years} = ${money(final)}.`,
    hint: q.add ? 'Use the calculator: fv(P, r/12, 12t) + fvs(add, r/12, 12t) for monthly compounding.' : 'A = P(1 + r/n)^(n·t)',
  });
  return (
    <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
      <MoneyTree value={answered ? path[Math.min(year, path.length - 1)] : q.P} start={q.P} />
      <div className="col grow" style={{ minWidth: 300 }}>
        <b>
          Tree {i + 1}/{rounds.length}
        </b>
        {!answered ? (
          <QuestionView
            key={i}
            q={rq}
            entry={false}
            onAnswered={(o) => {
              pts.current += o.credit;
              act((d, fx) => recordAnswer(d, fx, rq, o.correct));
              addReview?.({ q: rq.prompt, ok: o.correct, answer: money(final), explanation: rq.explanation });
              setAnswered(true);
            }}
          />
        ) : (
          <div className="card tint-gold col" style={{ gap: 6 }}>
            <div>
              Year {Math.min(year, q.years)} of {q.years}: <b>{money(path[Math.min(year, path.length - 1)])}</b>
            </div>
            <div className="small muted">
              You put in {money(q.P + q.add * 12 * q.years, { cents: false })}; interest grew the rest.
            </div>
            {year >= q.years && (
              <Button variant="primary" onClick={next}>
                {i + 1 >= rounds.length ? 'Finish ▶' : 'Next tree ▶'}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
