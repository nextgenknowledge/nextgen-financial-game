'use client';
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { QuestionRounds, synthQ } from '../QuestionSeq';
import { money } from '@/ui/format';

/** Find ledger errors, build an income statement, check that the balance sheet balances. */
export default function Accounting({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number; advanced: boolean }>) {
  const entry = difficulty === 'entry';
  const rounds = useMemo(() => {
    const rng = makeRng(seed);
    return Array.from({ length: params.rounds }, (_, k) => {
      if (!params.advanced) {
        const items = Array.from({ length: 4 }, () => rng.int(2, 15));
        const total = items.reduce((a, b) => a + b, 0);
        const wrong = total + rng.pick([-3, -2, 2, 3, 5]);
        return {
          context: (
            <div className="doc-media">
              <div className="bold">🧾 Lemonade stand receipts</div>
              {items.map((v, i) => (
                <div key={i} className="row between">
                  <span>Sale #{i + 1}</span>
                  <span>{money(v, { cents: false })}</span>
                </div>
              ))}
              <div className="row between bold" style={{ borderTop: '2px dashed #999' }}>
                <span>Total written down</span>
                <span>{money(wrong, { cents: false })}</span>
              </div>
            </div>
          ),
          questions: [
            synthQ({ id: `acct-e-${k}`, prompt: 'What should the correct total be?', topic: 'business', value: total, format: 'money', explanation: `${items.join(' + ')} = ${money(total, { cents: false })}. The written total was off by ${money(Math.abs(wrong - total), { cents: false })}.` }),
          ],
        };
      }
      const kind = k % 2;
      if (kind === 0) {
        // Income statement with one error
        const rev = rng.int(8, 20) * 1000;
        const cogs = Math.round(rev * rng.range(0.3, 0.45));
        const wages = rng.int(15, 40) * 100;
        const rent = rng.int(10, 25) * 100;
        const util = rng.int(2, 6) * 100;
        const errType = rng.pick(['dup', 'math', 'capex']);
        const lines = [
          ['Sales revenue', rev],
          ['Cost of goods sold', -cogs],
          ['Wages', -wages],
          ['Rent', -rent],
          ['Utilities', -util],
        ] as [string, number][];
        let shownNet = rev - cogs - wages - rent - util;
        let wrongIdx = 0;
        let fix = '';
        if (errType === 'dup') {
          lines.push(['Rent (again)', -rent]);
          wrongIdx = lines.length - 1;
          shownNet -= rent;
          fix = 'Rent was recorded twice, a duplicate entry.';
        } else if (errType === 'capex') {
          const eq = rng.int(20, 50) * 100;
          lines.push(['New oven (lasts 10 years)', -eq]);
          wrongIdx = lines.length - 1;
          shownNet -= eq;
          fix = 'A long-lasting oven is an asset (equipment), not a one-month expense. Only its yearly depreciation belongs on the income statement.';
        } else {
          wrongIdx = 0;
          shownNet += 1000;
          fix = 'The net income total is $1,000 too high, an addition error.';
        }
        const trueNet = rev - cogs - wages - rent - util;
        const choices = errType === 'math' ? ['The net income total is miscalculated', ...lines.slice(1, 4).map((l) => `"${l[0]}" line`)] : [`"${lines[wrongIdx][0]}" line`, ...lines.slice(0, 3).map((l) => `"${l[0]}" line`), 'The net income total is miscalculated'];
        return {
          context: (
            <div className="doc-media">
              <div className="bold">📒 Golden Dragon Dim Sum, Income Statement (one month)</div>
              {lines.map(([n, v], i) => (
                <div key={i} className="row between">
                  <span>{n}</span>
                  <span>{money(v)}</span>
                </div>
              ))}
              <div className="row between bold" style={{ borderTop: '2px dashed #999' }}>
                <span>Net income</span>
                <span>{money(shownNet)}</span>
              </div>
            </div>
          ),
          questions: [
            synthQ({ id: `acct-err-${k}`, prompt: 'Which line has the error?', topic: 'business', choices: [...new Set(choices)].slice(0, 4), correct: 0, explanation: fix }),
            synthQ({ id: `acct-net-${k}`, prompt: 'What is the CORRECT net income?', topic: 'business', value: trueNet, format: 'money', explanation: `${money(rev)} − ${money(cogs)} − ${money(wages)} − ${money(rent)} − ${money(util)} = ${money(trueNet)}.` }),
            synthQ({ id: `acct-margin-${k}`, prompt: 'Net profit margin (%)? Round to 0.1.', topic: 'business', value: (trueNet / rev) * 100, format: 'pct', tolAbs: 0.1, explanation: `${money(trueNet)} ÷ ${money(rev)} = ${((trueNet / rev) * 100).toFixed(1)}%.` }),
          ],
        };
      }
      // Balance sheet
      const cash = rng.int(5, 30) * 100;
      const inventory = rng.int(5, 25) * 100;
      const equipment = rng.int(20, 80) * 100;
      const loan = rng.int(10, 50) * 100;
      const payable = rng.int(2, 10) * 100;
      const assets = cash + inventory + equipment;
      const equity = assets - loan - payable;
      return {
        context: (
          <div className="doc-media">
            <div className="bold">📊 Balance Sheet</div>
            <div className="row between">
              <span>Cash</span>
              <span>{money(cash, { cents: false })}</span>
            </div>
            <div className="row between">
              <span>Inventory</span>
              <span>{money(inventory, { cents: false })}</span>
            </div>
            <div className="row between">
              <span>Equipment</span>
              <span>{money(equipment, { cents: false })}</span>
            </div>
            <div className="row between">
              <span>Bank loan</span>
              <span>{money(loan, { cents: false })}</span>
            </div>
            <div className="row between">
              <span>Bills owed to suppliers</span>
              <span>{money(payable, { cents: false })}</span>
            </div>
            <div className="row between bold">
              <span>Owner&apos;s equity</span>
              <span>?</span>
            </div>
          </div>
        ),
        questions: [
          synthQ({ id: `bs-assets-${k}`, prompt: 'Total assets?', topic: 'business', value: assets, format: 'money', explanation: `${money(cash, { cents: false })} + ${money(inventory, { cents: false })} + ${money(equipment, { cents: false })} = ${money(assets, { cents: false })}.` }),
          synthQ({ id: `bs-eq-${k}`, prompt: "Owner's equity? (Assets = Liabilities + Equity)", topic: 'business', value: equity, format: 'money', explanation: `Equity = ${money(assets, { cents: false })} − (${money(loan, { cents: false })} + ${money(payable, { cents: false })}) = ${money(equity, { cents: false })}.` }),
        ],
      };
    });
  }, [seed, params.rounds, params.advanced]);
  return <QuestionRounds rounds={rounds} entry={entry} onFinish={onFinish} addReview={addReview} />;
}
