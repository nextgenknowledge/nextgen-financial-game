'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';

// [card, matching card, value]. Pairs that share a value (like $1 and 100¢) are never dealt in the
// same game, so every card has exactly one match.
const SETS: Record<string, [string, string, number?][]> = {
  coins: [
    ['🪙 Penny', '1¢', 1],
    ['🪙 Nickel', '5¢', 5],
    ['🪙 Dime', '10¢', 10],
    ['🪙 Quarter', '25¢', 25],
    ['💵 Dollar', '100¢', 100],
    ['4 quarters', '$1', 100],
    ['2 dimes + 1 nickel', '25¢ (a quarter)', 25],
    ['💵 Five', '5 one-dollar bills', 500],
    ['10 dimes', '$1.00', 100],
    ['2 nickels', '1 dime', 10],
    ['3 dimes', '30¢', 30],
    ['2 quarters', '50¢', 50],
    ['💵 Ten', '10 one-dollar bills', 1000],
    ['7 pennies', '7¢', 7],
    ['3 nickels', '15¢', 15],
    ['1 quarter + 1 dime', '35¢', 35],
    ['4 dimes', '40¢', 40],
    ['3 quarters', '75¢', 75],
    ['💵 Twenty', '2 ten-dollar bills', 2000],
    ['1 dime + 2 pennies', '12¢', 12],
    ['2 quarters + 1 dime', '60¢', 60],
    ['9 dimes', '90¢', 90],
    ['8 quarters', '$2', 200],
    ['1 quarter + 3 pennies', '28¢', 28],
    ['5 dimes + 1 nickel', '55¢', 55],
    ['4 nickels', '20¢', 20],
    ['2 dollars + 1 quarter', '$2.25', 225],
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
    ['Interest', 'The cost of borrowing money'],
    ['Credit score', 'A number showing how reliably you repay'],
    ['Gross pay', 'Pay before taxes and deductions'],
    ['Net pay', 'Pay after taxes and deductions'],
    ['Emergency fund', 'Savings for surprise expenses'],
    ['Compound interest', 'Interest earned on interest'],
    ['Diversification', 'Spreading money across many investments'],
    ['Stock', 'A small piece of a company'],
    ['Bond', 'A loan you make to a company or government'],
    ['Overdraft', 'Spending more than is in your account'],
    ['Minimum payment', 'The least you must pay on a card each month'],
    ['Tax refund', 'Money back when too much tax was withheld'],
    ['Credit limit', 'The most you can borrow on a card'],
    ['Down payment', 'Cash paid upfront on a big purchase'],
    ['Pay stub', 'A record of your pay and deductions'],
    ['Fixed expense', 'A cost that stays the same each month'],
    ['Variable expense', 'A cost that changes month to month'],
    ['Opportunity cost', 'What you give up when you choose'],
  ],
  markets: [
    ['P/E ratio', 'Price ÷ earnings per share'],
    ['Current ratio', 'Current assets ÷ current liabilities'],
    ['Sharpe ratio', 'Excess return ÷ volatility'],
    ['Beta', 'Sensitivity to the market'],
    ['EBITDA', 'Profit before interest, tax, D&A'],
    ['Dividend yield', 'Dividend ÷ share price'],
    ['Duration', 'Bond price sensitivity to rates'],
    ['Market cap', 'Share price × shares outstanding'],
    ['Free cash flow', 'Operating cash flow − capex'],
    ['Basis point', '0.01 percent'],
    ['Spread', 'Ask price − bid price'],
    ['Debt-to-equity', 'Total debt ÷ shareholders’ equity'],
    ['ROE', 'Net income ÷ shareholders’ equity'],
    ['Short interest', 'Shares sold short ÷ float'],
    ['Yield curve', 'Yields across maturities'],
    ['Liquidity', 'How easily it trades without moving price'],
    ['Price-to-book', 'Share price ÷ book value per share'],
    ['Gross margin', '(Revenue − cost of goods) ÷ revenue'],
    ['Volatility', 'How much a price swings'],
    ['Alpha', 'Return above the benchmark'],
    ['Bid', 'The highest price a buyer will pay'],
    ['Ask', 'The lowest price a seller will accept'],
    ['Yield to maturity', 'Total return if a bond is held to the end'],
    ['Coupon', 'A bond’s yearly interest payment'],
    ['Market order', 'Trade now at the best available price'],
    ['Limit order', 'Trade only at your price or better'],
    ['Bull market', 'Prices rising for a long stretch'],
    ['Bear market', 'A fall of 20% or more from the peak'],
    ['IPO', 'A company’s first sale of shares to the public'],
    ['Stock split', 'More shares, each worth less'],
    ['Expense ratio', 'A fund’s yearly fee as a % of assets'],
    ['Working capital', 'Current assets − current liabilities'],
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
    // Deal pairs with different values only, so no card can match two others
    const seen = new Set<string>();
    const pairs = r.shuffle([...SETS[params.set]]).filter(([, b, v]) => {
      const key = String(v ?? b);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, params.pairs);
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
