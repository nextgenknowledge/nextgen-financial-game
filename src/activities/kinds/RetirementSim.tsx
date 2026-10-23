'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { growthSchedule } from '@/game/finance/interest';
import { LineChart } from '@/ui/kit';
import { money } from '@/ui/format';

/** Early vs late savers, employer match and Roth vs traditional. */
export default function RetirementSim({ params, difficulty, onFinish, addReview, seed }: KindProps<{ advanced: boolean }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    const r = rng.pick([0.06, 0.07, 0.08]);
    const a = rng.pick([100, 150]);
    const ages = [16, 30, 45];
    const amounts = [a, a * 2, a * 4];
    const series = ages.map((age, i) => growthSchedule({ start: 0, monthly: amounts[i], annualRate: r, years: 49, startDelayYears: age - 16 }));
    const finals = series.map((s) => s[49]);
    const contrib = ages.map((age, i) => amounts[i] * 12 * (65 - age));
    const people = ['Ava', 'Ben', 'Cy'];
    const chart = (
      <div className="col" style={{ gap: 4 }}>
        <LineChart series={series.map((s, i) => ({ values: s, color: ['#3cc45a', '#2f6bdb', '#e1553f'][i] }))} labels={series[0].map((_, i) => `${16 + i}`)} />
        <div className="tiny">
          {people.map((p, i) => (
            <span key={p} style={{ marginRight: 12 }}>
              <span style={{ color: ['#3cc45a', '#2f6bdb', '#e1553f'][i] }}>■</span> {p}: starts at {ages[i]}, saves {money(amounts[i], { cents: false })}/month
            </span>
          ))}
        </div>
      </div>
    );
    const out = [
      {
        context: (
          <div className="col" style={{ gap: 6 }}>
            <div className="card tint-teal small">Three friends invest for retirement at {(r * 100).toFixed(0)}% a year until age 65.</div>
            {chart}
          </div>
        ),
        questions: [
          synthQ({ id: 'ret-who', prompt: 'Who has the MOST money at 65?', topic: 'retirement', choices: [`${people[finals.indexOf(Math.max(...finals))]}`, ...people.filter((_, i) => i !== finals.indexOf(Math.max(...finals)))], correct: 0, explanation: `Final balances: ${people.map((p, i) => `${p} ${money(finals[i], { cents: false })}`).join(', ')}. Starting early gives compounding the most time.` }),
          synthQ({ id: 'ret-contrib', prompt: `Who put in the MOST of their own money?`, topic: 'retirement', choices: [people[contrib.indexOf(Math.max(...contrib))], ...people.filter((_, i) => i !== contrib.indexOf(Math.max(...contrib)))], correct: 0, explanation: `Contributions: ${people.map((p, i) => `${p} ${money(contrib[i], { cents: false })}`).join(', ')}. The biggest saver isn't the richest, time is.` }),
          ...(entry
            ? []
            : [synthQ({ id: 'ret-ava', prompt: `How much does ${people[0]} have at 65? (monthly compounding)`, topic: 'retirement', value: finals[0], format: 'money' as const, tolRel: 0.01, explanation: `fvs(${amounts[0]}, ${r}/12, 49×12) = ${money(finals[0], { cents: false })}.` })]),
        ],
      },
    ];
    if (!entry) {
      const salary = rng.pick([50000, 60000, 75000]);
      const pct = rng.pick([0.04, 0.06, 0.1]);
      const matchRate = 0.5;
      const matchCap = 0.06;
      const employer = salary * Math.min(pct, matchCap) * matchRate;
      const now = rng.pick([0.12, 0.22]);
      const later = now === 0.12 ? 0.22 : 0.12;
      out.push({
        context: <div className="card tint-teal small">Your job pays {money(salary, { cents: false })}/year. The employer matches 50% of what you contribute, up to 6% of salary.</div>,
        questions: [
          synthQ({ id: 'ret-match', prompt: `You contribute ${(pct * 100).toFixed(0)}% of salary. How much does the employer add per year?`, topic: 'retirement', value: employer, format: 'money', explanation: `50% × min(${(pct * 100).toFixed(0)}%, 6%) × ${money(salary, { cents: false })} = ${money(employer, { cents: false })}.` }),
          synthQ({
            id: 'ret-roth',
            prompt: `Your tax rate is ${(now * 100).toFixed(0)}% now and you expect ${(later * 100).toFixed(0)}% in retirement. Which account likely saves more tax?`,
            topic: 'taxes',
            choices: later > now ? ['Roth (pay tax now at the lower rate)', 'Traditional (deduct now)'] : ['Traditional (deduct now at the higher rate)', 'Roth (pay tax now)'],
            correct: 0,
            explanation: 'Pay tax when your rate is LOWER: Roth if you expect a higher rate later, traditional if you expect a lower one.',
          }),
          synthQ({ id: 'ret-4pct', prompt: `Using the 4% rule, a ${money(1000000, { cents: false })} nest egg supports about how much spending per year?`, topic: 'retirement', value: 40000, format: 'money', explanation: '4% × $1,000,000 = $40,000 per year, a common guideline for a sustainable withdrawal.' }),
        ],
      });
    }
    return out;
  }, [seed, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
