'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { paycheck } from '@/game/finance/tax';
import { money } from '@/ui/format';

/** Read pay stubs: gross vs. net, FICA, effective deduction rate, and a payroll error to catch. */
export default function PaycheckDecoder({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, (_, k) => {
      const hours = rng.pick([20, 25, 30, 35, 40]);
      const rate = rng.pick([15, 16.5, 18, 20, 22.5, 25]);
      const gross = hours * rate * 2; // biweekly
      const p = paycheck(gross, 26, { retirementPct: rng.pick([0, 0.03, 0.05]) });
      const error = !entry && k % 2 === 1;
      const ssShown = error ? Math.round(gross * 0.072 * 100) / 100 : p.socialSecurity;
      const net = gross - p.federal - ssShown - p.medicare - p.city - p.retirement;
      const lines = [
        `Hours: ${hours}/week × 2 weeks @ ${money(rate)}/hr`,
        `GROSS PAY ............ ${money(gross)}`,
        ...(entry
          ? [`Taxes ................ −${money(p.federal + p.socialSecurity + p.medicare + p.city)}`]
          : [
              `Federal income tax ... −${money(p.federal)}`,
              `Social Security ...... −${money(ssShown)}`,
              `Medicare (1.45%) ..... −${money(p.medicare)}`,
              `City tax (3%) ........ −${money(p.city)}`,
            ]),
        ...(p.retirement ? [`Retirement ........... −${money(p.retirement)}`] : []),
        `NET PAY .............. ${money(entry ? p.net : net)}`,
      ];
      const qs = entry
        ? [
            synthQ({ prompt: 'How much did this worker earn BEFORE taxes (gross pay)?', topic: 'earning', value: gross, format: 'money', explanation: `Gross pay = ${hours} × 2 × ${money(rate)} = ${money(gross)}.` }),
            synthQ({ prompt: 'How much did they take home (net pay)?', topic: 'taxes', value: p.net, format: 'money', explanation: `Net pay is what's left after taxes and deductions: ${money(p.net)}.` }),
          ]
        : [
            synthQ({ prompt: 'What is the total FICA (Social Security + Medicare) that SHOULD be withheld?', topic: 'taxes', value: gross * 0.0765, format: 'money', explanation: `FICA = 7.65% × ${money(gross)} = ${money(gross * 0.0765)}.` }),
            synthQ({
              prompt: 'What percent of gross pay was deducted in total (all taxes and deductions shown)? Round to one decimal.',
              topic: 'taxes',
              value: ((gross - net) / gross) * 100,
              format: 'pct',
              tolAbs: 0.15,
              explanation: `(${money(gross)} − ${money(net)}) ÷ ${money(gross)} = ${(((gross - net) / gross) * 100).toFixed(1)}%.`,
            }),
            synthQ({
              prompt: 'Is there a payroll error on this stub?',
              topic: 'taxes',
              choices: error ? ['Yes, Social Security is more than 6.2% of gross', 'No, everything is correct', 'Yes, Medicare is wrong', 'Yes, gross pay is wrong'] : ['No, everything is correct', 'Yes, Social Security is more than 6.2% of gross', 'Yes, Medicare is wrong', 'Yes, gross pay is wrong'],
              correct: 0,
              explanation: error ? `Social Security should be 6.2% × ${money(gross)} = ${money(p.socialSecurity)}, but ${money(ssShown)} was withheld. Report payroll errors to HR!` : 'Gross matches hours × rate, Social Security is 6.2% and Medicare 1.45%. Looks right!',
            }),
          ];
      return {
        context: (
          <div className="paystub">
            {lines.map((l, i) => (
              <div key={i}>{l}</div>
            ))}
          </div>
        ),
        questions: qs,
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
