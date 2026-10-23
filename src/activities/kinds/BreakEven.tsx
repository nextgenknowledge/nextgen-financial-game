'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { money } from '@/ui/format';
import { LineChart } from '@/ui/kit';

/** Fixed costs, variable costs, price → break-even units, profit, and what-ifs. */
export default function BreakEven({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    const biz = [
      ['🍋', 'lemonade', 'cup'],
      ['🧋', 'bubble tea', 'cup'],
      ['🥟', 'dumplings', 'plate'],
      ['🧁', 'cupcakes', 'cupcake'],
      ['🖨️', 'custom T-shirts', 'shirt'],
    ];
    return Array.from({ length: params.rounds }, (_, k) => {
      const [icon, name, unit] = rng.pick(biz);
      if (entry) {
        const supplies = rng.pick([10, 12, 15, 20]);
        const price = rng.pick([1, 2]);
        const be = Math.ceil(supplies / price);
        return {
          context: (
            <div className="card tint-teal">
              {icon} You spent {money(supplies, { cents: false })} on supplies for your {name} stand. Each {unit} sells for {money(price, { cents: false })}.
            </div>
          ),
          questions: [synthQ({ id: `be-e-${k}`, prompt: `How many ${unit}s must you sell to get your ${money(supplies, { cents: false })} back?`, topic: 'business', value: be, format: 'int', explanation: `${money(supplies, { cents: false })} ÷ ${money(price, { cents: false })} = ${be}. After that, every sale is profit!` })],
        };
      }
      const fixed = rng.int(8, 30) * 100;
      const price = rng.pick([4, 5, 6, 8, 12, 15]);
      const vc = Math.round(price * rng.range(0.3, 0.6) * 100) / 100;
      const be = Math.ceil(fixed / (price - vc));
      const q = Math.round(be * rng.range(1.2, 1.8));
      const profitQ = q * (price - vc) - fixed;
      const newPrice = price + 1;
      const be2 = Math.ceil(fixed / (newPrice - vc));
      const xs = Array.from({ length: 11 }, (_, i) => Math.round((i * q * 1.2) / 10));
      return {
        context: (
          <div className="col" style={{ gap: 6 }}>
            <div className="card tint-teal">
              {icon} {name}: fixed costs {money(fixed, { cents: false })}/month (rent, equipment). Each {unit} costs {money(vc)} to make and sells for {money(price)}.
            </div>
            <LineChart
              height={130}
              series={[
                { values: xs.map((x) => x * price), color: '#3cc45a', label: 'Revenue' },
                { values: xs.map((x) => fixed + x * vc), color: '#e1553f', label: 'Total cost' },
              ]}
              labels={xs.map((x) => String(x))}
            />
            <div className="tiny muted">Green = revenue, red = total cost. They cross at the break-even point.</div>
          </div>
        ),
        questions: [
          synthQ({ id: `be-cm-${k}`, prompt: `Contribution margin per ${unit} (price − variable cost)?`, topic: 'business', value: price - vc, format: 'money', explanation: `${money(price)} − ${money(vc)} = ${money(price - vc)} toward fixed costs per ${unit}.` }),
          synthQ({ id: `be-${k}`, prompt: `Break-even point in ${unit}s per month (round up)?`, topic: 'business', value: be, format: 'int', tolAbs: 1, explanation: `${money(fixed, { cents: false })} ÷ ${money(price - vc)} = ${(fixed / (price - vc)).toFixed(1)} → ${be}.` }),
          synthQ({ id: `be-p-${k}`, prompt: `Profit if you sell ${q} ${unit}s?`, topic: 'business', value: profitQ, format: 'money', explanation: `${q} × ${money(price - vc)} − ${money(fixed, { cents: false })} = ${money(profitQ)}.` }),
          synthQ({ id: `be-w-${k}`, prompt: `If you raise the price to ${money(newPrice)} (and demand holds), what's the new break-even?`, topic: 'business', value: be2, format: 'int', tolAbs: 1, explanation: `${money(fixed, { cents: false })} ÷ ${money(newPrice - vc)} → ${be2}. But a higher price may also mean fewer customers!` }),
        ],
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
