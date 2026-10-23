'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { monthlyPayment, amortize } from '@/game/finance/loans';
import { money, pct } from '@/ui/format';

/** Compare loan offers with different APR, terms and fees; see the effect of extra payments. */
export default function LoanCompare({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, (_, k) => {
      if (entry) {
        const borrow = rng.pick([50, 100, 200]);
        const a = borrow + rng.pick([5, 10]);
        const b = borrow + rng.pick([15, 20, 30]);
        const flip = rng.chance(0.5);
        return {
          context: (
            <div className="row wrap" style={{ gap: 8 }}>
              <div className="price-sign">Lender {flip ? 'B' : 'A'}: borrow {money(borrow, { cents: false })}, pay back {money(a, { cents: false })}</div>
              <div className="price-sign">Lender {flip ? 'A' : 'B'}: borrow {money(borrow, { cents: false })}, pay back {money(b, { cents: false })}</div>
            </div>
          ),
          questions: [
            synthQ({ id: `lc-e-${k}`, prompt: 'Which loan costs less?', topic: 'debt', choices: [`Lender ${flip ? 'B' : 'A'}`, `Lender ${flip ? 'A' : 'B'}`], correct: 0, explanation: `Paying back ${money(a, { cents: false })} costs ${money(a - borrow, { cents: false })} extra; ${money(b, { cents: false })} costs ${money(b - borrow, { cents: false })} extra.` }),
            synthQ({ id: `lc-e2-${k}`, prompt: `How much extra do you pay with the cheaper loan?`, topic: 'debt', value: a - borrow, format: 'money', explanation: `${money(a, { cents: false })} − ${money(borrow, { cents: false })} = ${money(a - borrow, { cents: false })}. That extra is the interest.` }),
          ],
        };
      }
      const P = rng.int(8, 30) * 1000;
      const offers = [
        { name: 'Bank A', apr: rng.pick([0.069, 0.074, 0.079]), n: 60, fee: 0 },
        { name: 'Credit Union B', apr: rng.pick([0.059, 0.064]), n: 60, fee: rng.pick([400, 600, 900]) },
        { name: 'Lender C', apr: rng.pick([0.049, 0.054]), n: 84, fee: rng.pick([0, 250]) },
      ];
      const cost = (o: (typeof offers)[number]) => monthlyPayment(P, o.apr, o.n) * o.n + o.fee - P;
      const best = offers.reduce((a, b) => (cost(b) < cost(a) ? b : a));
      const extra = rng.pick([50, 100, 200]);
      const base = amortize(P, offers[0].apr, offers[0].n);
      const fast = amortize(P, offers[0].apr, offers[0].n, extra);
      const saved = base.reduce((s, r) => s + r.interest, 0) - fast.reduce((s, r) => s + r.interest, 0);
      return {
        context: (
          <div className="col" style={{ gap: 4 }}>
            <b>You need to borrow {money(P, { cents: false })}.</b>
            {offers.map((o) => (
              <div key={o.name} className="price-sign">
                {o.name}: {pct(o.apr, 2)} APR · {o.n} months · {o.fee ? `${money(o.fee, { cents: false })} origination fee` : 'no fee'}
              </div>
            ))}
          </div>
        ),
        questions: [
          synthQ({ id: `lc-pmt-${k}`, prompt: `Monthly payment for ${offers[0].name}?`, topic: 'debt', value: monthlyPayment(P, offers[0].apr, offers[0].n), format: 'money', tolRel: 0.003, explanation: `PMT(${money(P, { cents: false })}, ${pct(offers[0].apr, 2)}/12, ${offers[0].n}) = ${money(monthlyPayment(P, offers[0].apr, offers[0].n))}.` }),
          synthQ({
            id: `lc-best-${k}`,
            prompt: 'Which offer has the LOWEST total cost (interest + fees)?',
            topic: 'debt',
            choices: [best.name, ...offers.filter((o) => o !== best).map((o) => o.name)],
            correct: 0,
            explanation: offers.map((o) => `${o.name}: ${money(cost(o), { cents: false })}`).join(' · ') + '. A lower APR over a longer term can still cost more; fees count too.',
          }),
          synthQ({ id: `lc-extra-${k}`, prompt: `Paying ${money(extra, { cents: false })} extra every month on ${offers[0].name} saves about how much interest?`, topic: 'interest', value: saved, format: 'money', tolRel: 0.02, explanation: `Extra principal shortens the loan from ${base.length} to ${fast.length} months and saves ${money(saved, { cents: false })} in interest.` }),
        ],
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
