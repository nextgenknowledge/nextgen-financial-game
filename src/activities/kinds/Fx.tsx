'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { money } from '@/ui/format';

const CURRENCIES = [
  { code: 'GBP', sym: '£', name: 'British pounds', rate: 0.79, flag: '🇬🇧' },
  { code: 'EUR', sym: '€', name: 'euros', rate: 0.92, flag: '🇪🇺' },
  { code: 'JPY', sym: '¥', name: 'Japanese yen', rate: 150, flag: '🇯🇵' },
  { code: 'HKD', sym: 'HK$', name: 'Hong Kong dollars', rate: 7.8, flag: '🇭🇰' },
  { code: 'SGD', sym: 'S$', name: 'Singapore dollars', rate: 1.35, flag: '🇸🇬' },
];

const fx = (sym: string, v: number, dec = 2) => `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec })}`;

/** Currency conversions, booth comparisons (rate vs flat fee vs commission) and round-trip spreads. */
export default function Fx({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, (_, k) => {
      const c = rng.pick(CURRENCIES);
      const dec = c.code === 'JPY' ? 0 : 2;
      if (entry) {
        const easy = rng.pick([2, 3, 5, 10]);
        const usd = rng.pick([2, 4, 5, 10, 20]);
        return {
          context: <div className="price-sign">{c.flag} Today: $1 = {easy} Fin-{c.name}</div>,
          questions: [synthQ({ id: `fx-e-${k}`, prompt: `How many Fin-${c.name} do you get for $${usd}?`, topic: 'shopping', value: usd * easy, format: 'int', explanation: `$${usd} × ${easy} = ${usd * easy}.` })],
        };
      }
      const rate = +(c.rate * rng.range(0.97, 1.03)).toFixed(c.code === 'JPY' ? 1 : 4);
      const usd = rng.pick([150, 200, 300, 500, 800]);
      if (k % 3 === 0) {
        return {
          context: <div className="price-sign">{c.flag} Mid-market rate: $1 = {rate} {c.code}</div>,
          questions: [synthQ({ id: `fx-conv-${k}`, prompt: `Convert $${usd} to ${c.code} at this rate.`, topic: 'economics', value: usd * rate, format: 'num', tolRel: 0.002, explanation: `$${usd} × ${rate} = ${fx(c.sym, usd * rate, dec)}.` })],
        };
      }
      if (k % 3 === 1) {
        const booths = [
          { name: 'Booth A', r: rate * 0.97, fee: 0, pct: 0 },
          { name: 'Booth B', r: rate * 0.995, fee: rng.pick([6, 9, 12]), pct: 0 },
          { name: 'Booth C', r: rate, fee: 0, pct: rng.pick([2.5, 3, 4]) },
        ];
        const get = (b: (typeof booths)[number]) => (usd - b.fee) * (1 - b.pct / 100) * b.r;
        const best = booths.reduce((a, b) => (get(b) > get(a) ? b : a));
        return {
          context: (
            <div className="col" style={{ gap: 4 }}>
              <b>You want to exchange ${usd}. Which booth gives the most {c.code}?</b>
              {booths.map((b) => (
                <div key={b.name} className="price-sign">
                  {b.name}: $1 = {b.r.toFixed(c.code === 'JPY' ? 1 : 4)} {c.code}
                  {b.fee ? ` · $${b.fee} flat fee` : ''}
                  {b.pct ? ` · ${b.pct}% commission` : ''}
                  {!b.fee && !b.pct ? ' · "NO FEES!"' : ''}
                </div>
              ))}
            </div>
          ),
          questions: [
            synthQ({
              id: `fx-booth-${k}`,
              prompt: 'Which booth is best?',
              topic: 'shopping',
              choices: [best.name, ...booths.filter((b) => b !== best).map((b) => b.name)],
              correct: 0,
              explanation: booths.map((b) => `${b.name}: ${fx(c.sym, get(b), dec)}`).join(' · ') + '. "No fees" booths often hide the fee in a worse rate.',
            }),
          ],
        };
      }
      const spread = rng.pick([3, 4, 5, 6]);
      const buyRate = rate * (1 - spread / 200);
      const sellRate = rate * (1 + spread / 200);
      const back = (usd * buyRate) / sellRate;
      return {
        context: (
          <div className="price-sign">
            {c.flag} Booth buys your dollars at $1 = {buyRate.toFixed(4)} {c.code}, and sells dollars back at $1 = {sellRate.toFixed(4)} {c.code}
          </div>
        ),
        questions: [
          synthQ({
            id: `fx-rt-${k}`,
            prompt: `You change $${usd} into ${c.code}, don't spend any, and change it all back. How many dollars do you end with?`,
            topic: 'economics',
            value: back,
            format: 'money',
            tolRel: 0.003,
            explanation: `$${usd} × ${buyRate.toFixed(4)} = ${fx(c.sym, usd * buyRate, dec)}; ÷ ${sellRate.toFixed(4)} = ${money(back)}. The ${spread}% spread cost ${money(usd - back)}, the booth's profit.`,
          }),
        ],
      };
    });
  }, [seed, params.rounds, entry]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
