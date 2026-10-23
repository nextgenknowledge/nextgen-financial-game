'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { rentVsBuy } from '@/game/finance/housing';
import { money, pct } from '@/ui/format';

/** Families with different plans: simulate renting vs buying, then decide. */
export default function RentBuy({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    const families = ['The Okafors', 'The Lins', 'The Garcias', 'Priya & Sam', 'The Novaks', 'Jordan'];
    return Array.from({ length: params.rounds }, (_, k) => {
      const fam = rng.pick(families);
      const years = [2, 5, 10, 15][k % 2 === 0 ? rng.int(0, 1) : rng.int(2, 3)];
      const price = rng.int(28, 60) * 10000;
      const input = {
        years,
        price,
        downPct: rng.pick([0.1, 0.2]),
        apr: rng.pick([0.055, 0.0625, 0.07]),
        rent: Math.round((price * rng.range(0.0042, 0.0055)) / 50) * 50,
        rentGrowth: 0.03,
        appreciation: rng.pick([0.02, 0.035, 0.05]),
        maintenancePct: 0.01,
        propertyTaxPct: 0.011,
        closingPct: 0.03,
        sellingPct: 0.06,
        investReturn: 0.05,
      };
      const r = rentVsBuy(input);
      const context = (
        <div className="card tint-teal small">
          <b>{fam}</b> plan to stay <b>{years} years</b>. Home price {money(price, { cents: false })} ({pct(input.downPct, 0)} down
          {entry ? '' : `, ${pct(input.apr, 2)} 30-yr mortgage, home values +${pct(input.appreciation, 1)}/yr`}). Similar rental: {money(input.rent, { cents: false })}/month
          {entry ? '.' : ' rising 3%/yr. Buying costs 3% to close, 6% to sell, ~2.1%/yr upkeep + tax; the renter invests the down payment at 5%.'}
        </div>
      );
      if (entry) {
        return {
          context,
          questions: [
            synthQ({
              id: `rb-e-${k}`,
              prompt: `${fam} are staying ${years} years. Should they rent or buy?`,
              topic: 'housing',
              choices: r.better === 'rent' ? ['Rent', 'Buy'] : ['Buy', 'Rent'],
              correct: 0,
              explanation: years <= 3 ? 'Buying has big costs to get in and out. For a short stay, renting is usually cheaper.' : `Over ${years} years the home's value can grow and the loan gets paid down, so ${r.better === 'buy' ? 'buying wins here' : 'renting still wins here because the numbers favor it'}.`,
            }),
          ],
        };
      }
      return {
        context,
        questions: [
          synthQ({ id: `rb-pmt-${k}`, prompt: 'Monthly mortgage payment (principal + interest)?', topic: 'housing', value: r.pmt, format: 'money', tolRel: 0.004, explanation: `PMT on ${money(price * (1 - input.downPct), { cents: false })} at ${pct(input.apr, 2)} for 360 months = ${money(r.pmt)}.` }),
          synthQ({
            id: `rb-${k}`,
            prompt: `Over ${years} years, which costs less overall?`,
            topic: 'housing',
            choices: r.better === 'rent' ? ['Renting', 'Buying'] : ['Buying', 'Renting'],
            correct: 0,
            explanation: `Net cost of buying ≈ ${money(r.buyNet, { cents: false })} (after selling, you keep ${money(r.equity, { cents: false })} equity). Net cost of renting ≈ ${money(r.rentNet, { cents: false })} (rent minus investment gains). ${years <= 3 ? 'Short stays rarely recover buying and selling costs.' : 'Longer stays let appreciation and loan paydown build equity.'}`,
          }),
        ],
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
