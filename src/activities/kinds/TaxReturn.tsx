'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { useGame, act } from '@/store/game';
import { makeRng } from '@/game/rng';
import { fileReturn, STANDARD_DEDUCTION, BRACKETS } from '@/game/finance/tax';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { recordAnswer } from '@/game/progress/activities';
import { recordEvent } from '@/game/progress/events';
import { receive, payBill } from '@/game/finance/accounts';
import { Explain } from '@/ui/kit';

interface Case {
  wages: number;
  other: number;
  withheld: number;
  itemized: number;
  credits: number;
  realYear?: number;
}

/** Fill in the FC-1040 line by line. Uses the player's real W-2 when one is waiting to be filed. */
export default function TaxReturn({ params, onFinish, addReview, seed }: KindProps<{ useReal?: boolean }>) {
  const w = useGame((s) => s.world!);
  const real = params.useReal ? w.finance.tax.w2s.find((x) => !w.finance.tax.filed.includes(x.year)) : undefined;
  const c: Case = useMemo(() => {
    if (real) return { wages: real.gross, other: real.other, withheld: real.withheld, itemized: 0, credits: 0, realYear: real.year };
    const r = makeRng(seed);
    const wages = r.int(18, 72) * 1000 + r.int(0, 9) * 100;
    return { wages, other: r.int(0, 30) * 50, withheld: Math.round(wages * r.range(0.05, 0.11)), itemized: r.pick([0, 0, 9000, 18000, 22000]), credits: r.pick([0, 0, 500, 1000]) };
  }, [real, seed]);
  const res = fileReturn({ wages: c.wages, otherIncome: c.other, withheld: c.withheld, itemized: c.itemized, credits: c.credits });
  const lines: { key: string; label: string; value: number; help: string }[] = [
    { key: 'income', label: 'Line 1: Total income (wages + other)', value: res.totalIncome, help: `${money(c.wages)} wages + ${money(c.other)} other income.` },
    { key: 'deduction', label: `Line 2: Deduction (larger of standard ${money(STANDARD_DEDUCTION, { cents: false })} or itemized ${money(c.itemized, { cents: false })})`, value: res.deduction, help: 'Take whichever deduction is bigger, it lowers taxable income.' },
    { key: 'taxable', label: 'Line 3: Taxable income (Line 1 − Line 2, not below 0)', value: res.taxable, help: 'Income minus deduction.' },
    { key: 'tax', label: 'Line 4: Tax from the brackets', value: res.taxBeforeCredits, help: 'Apply each bracket rate only to the dollars inside that bracket.' },
    { key: 'after', label: `Line 5: Tax after credits (Line 4 − ${money(c.credits, { cents: false })} credits)`, value: res.tax, help: 'Credits subtract directly from tax (much better than a deduction of the same size).' },
    { key: 'refund', label: `Line 6: Refund (+) or amount owed (−) = withheld ${money(c.withheld)} − Line 5`, value: res.refund, help: 'Positive means you get money back.' },
  ];
  const [i, setI] = useState(0);
  const [val, setVal] = useState('');
  const [fb, setFb] = useState<string | null>(null);
  const [usePreparer, setUsePreparer] = useState(false);
  const right = useRef(0);
  const line = lines[i];

  const finishReal = (score: number) => {
    if (c.realYear !== undefined) {
      act((d, fx) => {
        d.finance.tax.filed.push(c.realYear!);
        if (res.refund >= 0) {
          receive(d, Math.round(res.refund * 100) / 100, `Tax refund (Year ${c.realYear})`);
          fx.push({ type: 'narwhal', text: `Return filed! You'll get a ${money(res.refund)} refund, you had more withheld than you owed.`, mood: 'hyped' });
        } else {
          payBill(d, fx, Math.round(-res.refund * 100) / 100, `Taxes owed (Year ${c.realYear})`);
          fx.push({ type: 'narwhal', text: `Return filed. You owed ${money(-res.refund)} more than was withheld (often from side income like interest, dividends or business profit). Paid on time, no penalty!`, mood: 'talking' });
        }
        recordEvent(d, fx, { type: 'taxFiled', value: c.realYear });
      });
    }
    onFinish({ score, correct: right.current, total: lines.length, summary: c.realYear !== undefined ? `Filed your Year ${c.realYear} return.` : undefined });
  };

  if (usePreparer) {
    return (
      <div className="col" style={{ gap: 10 }}>
        <div className="card tint-gold">A tax preparer filed for you for $60. Easy, but you paid for it and didn&apos;t learn how. (No stars for this one, but your return is filed!)</div>
        <Button
          variant="primary"
          onClick={() => {
            act((d, fx) => void payBill(d, fx, 60, 'Tax preparer fee'));
            finishReal(0);
          }}
        >
          OK
        </Button>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="doc-media grow">
          <div className="bold">📄 FC-W2 {c.realYear !== undefined ? `· Your Year ${c.realYear}` : '· Practice case'}</div>
          <div className="row between small">
            <span>Wages</span>
            <span>{money(c.wages)}</span>
          </div>
          <div className="row between small">
            <span>Federal tax withheld</span>
            <span>{money(c.withheld)}</span>
          </div>
          <div className="row between small">
            <span>Other income (interest, dividends, side jobs)</span>
            <span>{money(c.other)}</span>
          </div>
          <div className="row between small">
            <span>Itemized deductions (receipts)</span>
            <span>{money(c.itemized)}</span>
          </div>
          <div className="row between small">
            <span>Tax credits</span>
            <span>{money(c.credits)}</span>
          </div>
        </div>
        <div className="doc-media" style={{ minWidth: 220 }}>
          <div className="bold">Brackets</div>
          {BRACKETS.slice(0, 4).map((b, k) => (
            <div key={k} className="tiny">
              {(b.rate * 100).toFixed(0)}% up to {b.upTo === Infinity ? '∞' : money(b.upTo, { cents: false })}
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <b>{line.label}</b>
        <ReadAloud text={line.label} />
        {fb ? (
          <div style={{ marginTop: 6 }}>
            {fb}
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <Button
                variant="primary"
                onClick={() => {
                  setFb(null);
                  setVal('');
                  if (i + 1 >= lines.length) finishReal((right.current / lines.length) * 100);
                  else setI(i + 1);
                }}
              >
                Next line ▶
              </Button>
            </div>
          </div>
        ) : (
          <form
            className="row"
            style={{ marginTop: 6 }}
            onSubmit={(e) => {
              e.preventDefault();
              const v = Number(val.replace(/[$,\s]/g, ''));
              const ok = Math.abs(v - line.value) <= Math.max(1, Math.abs(line.value) * 0.003);
              if (ok) right.current++;
              playSfx(ok ? 'correct' : 'wrong');
              act((d, fx) => recordAnswer(d, fx, { id: `tax:${line.key}`, topic: 'taxes' }, ok));
              addReview?.({ q: line.label, ok, answer: money(line.value), explanation: line.help });
              setFb(`${ok ? '✅' : '💡'} ${line.label.split(':')[0]} = ${money(line.value)}. ${line.help}`);
            }}
          >
            <span className="big">$</span>
            <input className="input mono numeric-input" autoFocus inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Use − for owed" />
            <Button variant="primary" type="submit" disabled={!val}>
              Enter
            </Button>
          </form>
        )}
      </div>
      <Explain title="Deduction vs. credit">
        A $1,000 <b>deduction</b> lowers taxable income, saving $1,000 × your bracket rate (e.g. $120). A $1,000 <b>credit</b> cuts your tax by the full $1,000.
      </Explain>
      {i === 0 && c.realYear !== undefined && (
        <Button size="small" variant="ghost" onClick={() => setUsePreparer(true)}>
          Pay a preparer $60 to do it for me
        </Button>
      )}
    </div>
  );
}
