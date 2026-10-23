'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { money } from '@/ui/format';
import { formatValue } from '@/game/questions/engine';

/** Stock options vs. salary: vesting, cliffs, intrinsic value and expected value. */
export default function Options({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, (_, k) => {
      const salaryA = rng.int(95, 130) * 1000;
      const salaryB = salaryA - rng.int(10, 25) * 1000;
      const options = rng.pick([2000, 4000, 6000, 8000, 10000]);
      const strike = rng.pick([2, 5, 8, 10, 12]);
      const years = rng.pick([1, 2, 3]);
      const price = strike + rng.pick([-1, 3, 5, 10, 20]);
      const vested = years < 1 ? 0 : Math.floor(options * Math.min(1, years / 4));
      const intrinsic = Math.max(0, price - strike) * vested;
      const pBust = rng.pick([0.5, 0.6, 0.7]);
      const boomPrice = strike + rng.pick([15, 25, 40]);
      const ev = (1 - pBust) * (boomPrice - strike) * options;
      const salaryGap4 = (salaryA - salaryB) * 4;
      const qs = [
        synthQ({
          prompt: `Offer B grants ${options.toLocaleString()} options vesting evenly over 4 years with a 1-year cliff. How many have vested after ${years} year${years > 1 ? 's' : ''}?`,
          topic: 'investing',
          value: vested,
          format: 'int',
          tolAbs: 0.5,
          explanation: `After the 1-year cliff, ${years}/4 of the grant has vested: ${options.toLocaleString()} × ${years}/4 = ${vested.toLocaleString()}.`,
          hint: 'Vested = total × years / 4 (once past the cliff).',
        }),
        synthQ({
          prompt: `The strike price is ${money(strike)} and shares now trade at ${money(price)}. What are those ${vested.toLocaleString()} vested options worth if exercised and sold today (ignoring taxes)?`,
          topic: 'investing',
          value: intrinsic,
          format: 'money',
          explanation: price > strike ? `(${money(price)} − ${money(strike)}) × ${vested.toLocaleString()} = ${money(intrinsic)}.` : `The share price is below the strike, so the options are "underwater", worth $0 to exercise.`,
          hint: 'Value per option = share price − strike (but never below 0).',
        }),
        synthQ({
          prompt: `Over 4 years, Offer A pays ${formatValue(salaryGap4, 'money')} more in salary. Analysts think there's a ${Math.round(pBust * 100)}% chance the startup fails (options = $0) and otherwise shares reach ${money(boomPrice)}. What is the expected value of all ${options.toLocaleString()} options?`,
          topic: 'investing',
          value: ev,
          format: 'money',
          tolRel: 0.01,
          explanation: `EV = (1 − ${pBust}) × (${money(boomPrice)} − ${money(strike)}) × ${options.toLocaleString()} = ${money(ev)}. Compare with the guaranteed ${money(salaryGap4)} from higher salary.`,
        }),
        synthQ({
          prompt: 'Which statement is TRUE?',
          topic: 'investing',
          choices: [
            ev > salaryGap4 ? 'Offer B has the higher expected value, but more risk' : 'Offer A is worth more on average and has less risk',
            'Options always beat salary',
            'Unvested options keep their value if you quit',
            'A higher strike price makes options more valuable',
          ],
          correct: 0,
          explanation: `Expected options value ${money(ev)} vs. ${money(salaryGap4)} more salary. Options are risky and usually lost if you leave before vesting; a higher strike lowers their value.`,
        }),
      ];
      return {
        context: (
          <div className="card tint-teal small">
            <b>Offer A:</b> {money(salaryA, { cents: false })}/yr salary. <b>Offer B:</b> {money(salaryB, { cents: false })}/yr + {options.toLocaleString()} stock options at a {money(strike)} strike, 4-year vesting, 1-year cliff.
          </div>
        ),
        questions: k % 2 === 0 ? qs : qs.slice(1),
      };
    });
  }, [seed, params.rounds]);
  return <QuestionRounds rounds={rounds} entry={difficulty === 'entry'} onFinish={onFinish} addReview={addReview} />;
}
