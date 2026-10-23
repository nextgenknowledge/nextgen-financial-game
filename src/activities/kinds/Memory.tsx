'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';

const SETS: Record<string, [string, string][]> = {
  coins: [
    ['🪙 Penny', '1¢'],
    ['🪙 Nickel', '5¢'],
    ['🪙 Dime', '10¢'],
    ['🪙 Quarter', '25¢'],
    ['💵 Dollar', '100¢'],
    ['4 quarters', '$1'],
    ['2 dimes + 1 nickel', '25¢ (a quarter)'],
    ['💵 Five', '5 one-dollar bills'],
    ['10 dimes', '$1.00'],
    ['2 nickels', '1 dime'],
  ],
  terms: [
    ['Asset', 'Something you own'],
    ['Liability', 'Something you owe'],
    ['APR', 'Yearly interest rate on a loan'],
    ['APY', 'Yearly return including compounding'],
    ['Dividend', 'Profit paid to shareholders'],
    ['Deductible', 'What you pay before insurance pays'],
    ['Premium', 'Monthly price of insurance'],
    ['Budget', 'A plan for your money'],
    ['Inflation', 'Prices rising over time'],
    ['Principal', 'The amount borrowed or invested'],
    ['Collateral', 'Property backing a loan'],
    ['Net worth', 'Assets minus liabilities'],
    ['Index fund', 'Owns many companies at once'],
    ['Equity', 'Value you own after debts'],
  ],
};

interface Card {
  id: number;
  pair: number;
  text: string;
}

/** Flip-two matching game. Score depends on misses and time. */
export default function Memory({ params, onFinish, seed }: KindProps<{ set: string; pairs: number }>) {
  const cards = useMemo<Card[]>(() => {
    const r = makeRng(seed);
    const pairs = r.shuffle([...SETS[params.set]]).slice(0, params.pairs);
    const all = pairs.flatMap(([a, b], i) => [
      { id: i * 2, pair: i, text: a },
      { id: i * 2 + 1, pair: i, text: b },
    ]);
    return r.shuffle(all);
  }, [seed, params.set, params.pairs]);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const misses = useRef(0);
  const start = useRef(Date.now());
  const [lock, setLock] = useState(false);

  useEffect(() => {
    if (matched.length === cards.length && cards.length) {
      const secs = (Date.now() - start.current) / 1000;
      const score = Math.max(0, Math.min(100, 100 - misses.current * 6 - Math.max(0, secs - params.pairs * 6) * 0.6));
      setTimeout(() => onFinish({ score, summary: `${misses.current} misses in ${Math.round(secs)} seconds.` }), 500);
    }
  }, [matched, cards.length, onFinish, params.pairs]);

  const flip = (c: Card) => {
    if (lock || open.includes(c.id) || matched.includes(c.id)) return;
    playSfx('pop');
    const next = [...open, c.id];
    setOpen(next);
    if (next.length === 2) {
      const [a, b] = next.map((id) => cards.find((x) => x.id === id)!);
      if (a.pair === b.pair) {
        playSfx('coin');
        setMatched([...matched, a.id, b.id]);
        setOpen([]);
      } else {
        misses.current++;
        setLock(true);
        setTimeout(() => {
          setOpen([]);
          setLock(false);
        }, 850);
      }
    }
  };

  return (
    <div>
      <div className="row between small">
        <span>Find the matching pairs!</span>
        <span>
          Matched {matched.length / 2}/{cards.length / 2} · Misses {misses.current}
        </span>
      </div>
      <div className="memory-grid" style={{ gridTemplateColumns: `repeat(${cards.length > 12 ? 4 : 4}, 1fr)` }}>
        {cards.map((c) => {
          const up = open.includes(c.id) || matched.includes(c.id);
          return (
            <button key={c.id} className={cls('memory-card', up && 'up', matched.includes(c.id) && 'matched')} onClick={() => flip(c)}>
              {up ? c.text : '❓'}
            </button>
          );
        })}
      </div>
    </div>
  );
}
