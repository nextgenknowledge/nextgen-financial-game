'use client';
/**
 * Balance Sheet Builder (Advanced). Sort a company's accounts into current and non-current assets,
 * current and long-term liabilities, and equity; check that assets equal liabilities plus equity;
 * then read the sheet with the current ratio and debt-to-equity.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { QuestionView } from '../QuestionView';
import { correctAnswerText } from '@/game/questions/engine';
import { rq } from './VisualQuiz';
import { Bars, C, ProHead, Verdict, usdK } from './pro/kit';

type Bucket = 'ca' | 'nca' | 'cl' | 'ltl' | 'eq';
const BUCKETS: { id: Bucket; name: string; color: string }[] = [
  { id: 'ca', name: 'Current assets', color: C.green },
  { id: 'nca', name: 'Non-current assets', color: C.blue },
  { id: 'cl', name: 'Current liabilities', color: C.gold },
  { id: 'ltl', name: 'Long-term liabilities', color: C.red },
  { id: 'eq', name: 'Equity', color: C.violet },
];

const ACCOUNTS: [string, Bucket, number][] = [
  ['Cash', 'ca', 1],
  ['Accounts receivable (customers owe us)', 'ca', 1],
  ['Inventory', 'ca', 1],
  ['Factory and equipment', 'nca', 1],
  ['Patents', 'nca', 1],
  ['Accounts payable (we owe suppliers)', 'cl', 1],
  ['Wages owed this month', 'cl', 1],
  ['Bank loan due in 8 years', 'ltl', 1],
  ['Bonds issued, due in 10 years', 'ltl', 1],
  ['Shares issued to investors', 'eq', 1],
  ['Retained earnings', 'eq', 1],
];

export default function BalanceSheet({ onFinish, addReview, seed }: KindProps) {
  const sheet = useMemo(() => {
    const rng = makeRng(seed * 7 + 41);
    const v = ACCOUNTS.map(([name, b]) => ({ name, b, amt: Math.round(rng.range(b === 'nca' ? 8 : 1, b === 'nca' ? 30 : 12)) * 1e6 }));
    // Retained earnings is the plug that makes the sheet balance
    const assets = v.filter((x) => x.b === 'ca' || x.b === 'nca').reduce((a, x) => a + x.amt, 0);
    const other = v.filter((x) => x.name !== 'Retained earnings' && (x.b === 'cl' || x.b === 'ltl' || x.b === 'eq')).reduce((a, x) => a + x.amt, 0);
    const re = v.find((x) => x.name === 'Retained earnings')!;
    re.amt = Math.max(1e6, assets - other);
    // If the plug was clamped, top up cash so everything still balances
    const diff = other + re.amt - assets;
    if (diff > 0) v[0].amt += diff;
    return rng.shuffle(v);
  }, [seed]);
  const [placed, setPlaced] = useState<Record<string, Bucket | undefined>>({});
  const [phase, setPhase] = useState<'sort' | 'q1' | 'q2' | 'end'>('sort');
  const [sortScore, setSortScore] = useState(0);
  const [qScore, setQScore] = useState<number[]>([]);
  const sel = sheet.find((x) => !placed[x.name]);
  const sum = (bs: Bucket[]) => sheet.filter((x) => bs.includes(x.b)).reduce((a, x) => a + x.amt, 0);
  const ca = sum(['ca']);
  const cl = sum(['cl']);
  const debt = sheet.filter((x) => x.b === 'ltl' || x.name.startsWith('Bank')).reduce((a, x) => a + x.amt, 0);
  const eq = sum(['eq']);

  const qs = useMemo(
    () => [
      rq({ id: 'bs-cr', topic: 'business', type: 'numeric', value: Math.round((ca / cl) * 100) / 100, tolAbs: 0.03, tolRel: 0, prompt: 'What is the current ratio?', hint: 'Current assets ÷ current liabilities.', explanation: `${usdK(ca)} ÷ ${usdK(cl)} = ${(ca / cl).toFixed(2)}. Above 1 means the company can pay its bills due this year from assets that turn into cash this year.` }),
      rq({ id: 'bs-de', topic: 'debt', type: 'numeric', value: Math.round((debt / eq) * 100) / 100, tolAbs: 0.03, tolRel: 0, prompt: 'What is the debt-to-equity ratio? (Count the bank loan and the bonds as debt.)', hint: 'Total debt ÷ total equity.', explanation: `${usdK(debt)} ÷ ${usdK(eq)} = ${(debt / eq).toFixed(2)}. Higher means more borrowed money per dollar the owners put in: bigger returns in good years, more danger in bad ones.` }),
    ],
    [ca, cl, debt, eq],
  );

  const place = (b: Bucket) => {
    if (!sel) return;
    const ok = sel.b === b;
    playSfx(ok ? 'correct' : 'wrong');
    if (!ok) addReview?.({ q: sel.name, ok: false, answer: BUCKETS.find((x) => x.id === sel.b)!.name, explanation: sel.b === 'ca' ? 'It turns into cash within a year.' : sel.b === 'nca' ? 'Used for many years: a long-term asset.' : sel.b === 'cl' ? 'Must be paid within a year.' : sel.b === 'ltl' ? 'Owed, but not due for more than a year.' : 'Belongs to the owners: money they put in plus profits kept in the business.' });
    const next = { ...placed, [sel.name]: b };
    setPlaced(next);
    if (Object.keys(next).length === sheet.length) {
      setSortScore(sheet.filter((x) => next[x.name] === x.b).length / sheet.length);
      setPhase('q1');
    }
  };

  const totals = (
    <Bars
      items={BUCKETS.map((b) => ({ label: b.name, value: sheet.filter((x) => placed[x.name] === b.id).reduce((a, x) => a + x.amt, 0), color: b.color }))}
      fmt={usdK}
    />
  );

  if (phase === 'q1' || phase === 'q2') {
    const qi = phase === 'q1' ? 0 : 1;
    const assets = sum(['ca', 'nca']);
    return (
      <div className="pro">
        <ProHead kicker="Balance sheet · Read it" title={`Assets ${usdK(assets)} = Liabilities ${usdK(sum(['cl', 'ltl']))} + Equity ${usdK(eq)}`} sub={`You sorted ${Math.round(sortScore * 100)}% of accounts correctly. The sheet balances: it always must.`} />
        <section className="pro-panel">{totals}</section>
        <QuestionView
          key={qi}
          q={qs[qi]}
          entry={false}
          index={qi}
          total={2}
          onAnswered={(o) => {
            setQScore((s) => [...s, o.credit]);
            addReview?.({ q: qs[qi].prompt, ok: o.correct, answer: correctAnswerText(qs[qi]), explanation: qs[qi].explanation });
            if (qi === 0) setPhase('q2');
            else onFinish({ score: (sortScore * 0.6 + ((qScore[0] ?? 0) + o.credit) / 2 * 0.4) * 100, summary: `Sorted ${Math.round(sortScore * 100)}% correctly.` });
          }}
        />
      </div>
    );
  }

  return (
    <div className="pro">
      <ProHead kicker={`Balance sheet builder · ${Object.keys(placed).length} of ${sheet.length} sorted`} title={sel ? `${sel.name}: ${usdK(sel.amt)}` : 'Done'} sub="Where does this account belong?" />
      <section className="pro-panel">
        <div className="pro-choices">
          {BUCKETS.map((b) => (
            <button key={b.id} type="button" className={cls('pro-pill')} style={{ borderLeft: `6px solid ${b.color}` }} onClick={() => place(b.id)}>
              {b.name}
            </button>
          ))}
        </div>
      </section>
      <section className="pro-panel">
        <h4>Your balance sheet so far</h4>
        {totals}
        {Object.keys(placed).length > 0 && (
          <Verdict ok title="Sorted">
            {sheet
              .filter((x) => placed[x.name])
              .map((x) => `${x.name.split(' (')[0]} ${placed[x.name] === x.b ? '✓' : '✕'}`)
              .join(' · ')}
          </Verdict>
        )}
      </section>
      <div className="row" style={{ justifyContent: 'flex-end' }}>
        <Button size="small" onClick={() => setPlaced({})}>
          Start over
        </Button>
      </div>
    </div>
  );
}
