'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { money } from '@/ui/format';

/** Department store deals: percent-off, stacked coupons, BOGO and fake "original prices". */
export default function Deals({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    const items = ['🧥 Jacket', '👟 Sneakers', '🎧 Headphones', '🎒 Backpack', '🧸 Teddy bear', '⌚ Watch', '🎮 Game'];
    return Array.from({ length: params.rounds }, (_, k) => {
      const item = rng.pick(items);
      const type = entry ? rng.pick(['pct', 'compare']) : rng.pick(['pct', 'stack', 'bogo', 'compare', 'fake']);
      if (type === 'pct') {
        const p = entry ? rng.pick([10, 20, 30, 40, 50]) : rng.int(24, 120);
        const off = entry ? rng.pick([10, 50, 25]) : rng.pick([15, 20, 25, 30, 35, 40]);
        const sale = p * (1 - off / 100);
        return {
          context: <div className="price-sign">{item} · was {money(p)} · <b>{off}% OFF!</b></div>,
          questions: [synthQ({ id: `deal-pct-${k}`, prompt: 'What is the sale price?', topic: 'shopping', value: sale, format: 'money', explanation: `${off}% of ${money(p)} is ${money((p * off) / 100)}. ${money(p)} − ${money((p * off) / 100)} = ${money(sale)}.`, hint: `Find ${off}% of the price, then subtract it.` })],
        };
      }
      if (type === 'stack') {
        const p = rng.int(40, 150);
        const a = rng.pick([20, 25, 30]);
        const b = rng.pick([10, 15, 20]);
        const final = p * (1 - a / 100) * (1 - b / 100);
        return {
          context: <div className="price-sign">{item} · {money(p)} · {a}% off sale + extra {b}% coupon at the register</div>,
          questions: [
            synthQ({ id: `deal-stack-${k}`, prompt: 'Final price after both discounts (applied one after the other)?', topic: 'shopping', value: final, format: 'money', explanation: `${money(p)} × (1 − ${a}%) × (1 − ${b}%) = ${money(final)}. Stacked discounts are NOT ${a + b}% off, that would be ${money(p * (1 - (a + b) / 100))}.` }),
            synthQ({ id: `deal-stack2-${k}`, prompt: `Is ${a}% + ${b}% stacked the same as ${a + b}% off?`, topic: 'shopping', choices: ['No, it saves a little less', 'Yes, it saves exactly the same', 'No, stacking saves you more'], correct: 0, explanation: `The second discount applies to the already-reduced price, so the total discount is ${(100 - (1 - a / 100) * (1 - b / 100) * 100).toFixed(1)}%.` }),
          ],
        };
      }
      if (type === 'bogo') {
        const p = rng.int(8, 30);
        const pct = Math.round(25);
        return {
          context: <div className="price-sign">{item} · {money(p)} each · <b>Buy one, get one 50% off</b></div>,
          questions: [
            synthQ({ id: `deal-bogo-${k}`, prompt: 'If you buy two, what is the average price per item?', topic: 'shopping', value: (p + p / 2) / 2, format: 'money', explanation: `${money(p)} + ${money(p / 2)} = ${money(p * 1.5)} for two → ${money(p * 0.75)} each. That's ${pct}% off per item, a deal only if you needed two!` }),
          ],
        };
      }
      if (type === 'fake') {
        const real = rng.int(30, 60);
        const fakeOrig = real * 2;
        return {
          context: (
            <div className="price-sign">
              {item} · <s>Original price {money(fakeOrig)}</s> · <b>NOW {money(real * 0.9)}, 55% OFF!!!</b>
              <div className="tiny">Other stores sell the same item for {money(real)}.</div>
            </div>
          ),
          questions: [synthQ({ id: `deal-fake-${k}`, prompt: 'How good is this deal really, compared with other stores?', topic: 'shopping', choices: ['About 10% off the real price', '55% off, just as the sign says', 'It costs twice the normal price', 'It is basically free'], correct: 0, explanation: `The "original" price was inflated. Compared with the real market price of ${money(real)}, ${money(real * 0.9)} is only 10% off.` })],
        };
      }
      // compare two offers
      const p1 = entry ? rng.pick([20, 30, 40]) : rng.int(40, 100);
      const offA = entry ? 10 : rng.pick([15, 20, 25]);
      const p2 = p1 + (entry ? 10 : rng.int(5, 20));
      const offB = entry ? 50 : rng.pick([30, 35, 40]);
      const a = p1 * (1 - offA / 100);
      const b = p2 * (1 - offB / 100);
      return {
        context: (
          <div className="row wrap" style={{ gap: 10 }}>
            <div className="price-sign">Store A: {item} {money(p1)}, {offA}% off</div>
            <div className="price-sign">Store B: {item} {money(p2)}, {offB}% off</div>
          </div>
        ),
        questions: [synthQ({ id: `deal-cmp-${k}`, prompt: 'Which store is cheaper?', topic: 'shopping', choices: a < b ? [`Store A (${money(a)})`, `Store B (${money(b)})`] : [`Store B (${money(b)})`, `Store A (${money(a)})`], correct: 0, explanation: `A: ${money(p1)} − ${offA}% = ${money(a)}. B: ${money(p2)} − ${offB}% = ${money(b)}. A bigger % off isn't always the lower price!` })],
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
