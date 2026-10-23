'use client';
/**
 * Loan Officer (Advanced). Underwrite eight applicants: work out debt-to-income, weigh the credit
 * score and collateral, then approve at prime, approve at a risk-based rate, or decline. Each call
 * is scored on its expected profit for the bank, and the feedback shows the default probability
 * and the numbers behind every option.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { type Applicant, PRIME, RISK_RATE, defaultProb, dti, loanEV, payment } from '@/game/finance/desks';
import { Bars, C, ProHead, Table, Verdict, usd } from './pro/kit';

const NAMES = ['Priya', 'Marcus', 'Elena', 'Kwame', 'Sofia', 'Dmitri', 'Aisha', 'Tomás', 'Mei', 'Jonah', 'Fatima', 'Lars'];
const PURPOSES: [string, boolean][] = [
  ['Used car', true],
  ['Kitchen renovation (home as security)', true],
  ['Debt consolidation', false],
  ['Wedding', false],
  ['Small-business equipment', true],
  ['Medical bills', false],
];
const OPTIONS = [`Approve at prime (${(PRIME * 100).toFixed(0)}%)`, `Approve at ${(RISK_RATE * 100).toFixed(0)}%`, 'Decline'];

function applicants(seed: number): Applicant[] {
  const rng = makeRng(seed * 13 + 77);
  const names = rng.shuffle([...NAMES]);
  return Array.from({ length: 8 }, (_, i) => {
    const [purpose, secured] = rng.pick(PURPOSES);
    const band = i % 4; // a spread of strong, fair, thin and weak files
    const score = Math.round([rng.range(760, 820), rng.range(690, 740), rng.range(640, 690), rng.range(580, 640)][band]);
    const income = Math.round(rng.range(3200, 9500) / 50) * 50;
    const debts = Math.round((income * rng.range(0.04, band >= 2 ? 0.3 : 0.18)) / 10) * 10;
    const amount = Math.round(rng.range(8, 40)) * 1000;
    return { name: names[i], score, income, debts, amount, years: rng.pick([3, 5]), secured, purpose };
  });
}

export default function LoanOfficer({ onFinish, addReview, seed }: KindProps) {
  const apps = useMemo(() => applicants(seed), [seed]);
  const [i, setI] = useState(0);
  const [pick, setPick] = useState<number | null>(null);
  const [total, setTotal] = useState({ got: 0, best: 0, worst: 0 });
  const a = apps[i];
  const ev = loanEV(a);
  const pay = payment(a.amount, PRIME, a.years * 12);

  const decide = (k: number) => {
    if (pick !== null) return;
    setPick(k);
    const best = Math.max(...ev);
    const worst = Math.min(...ev);
    setTotal((t) => ({ got: t.got + ev[k], best: t.best + best, worst: t.worst + worst }));
    const ok = ev[k] >= best - 1;
    playSfx(ok ? 'correct' : ev[k] >= 0 ? 'star' : 'wrong');
    addReview?.({ q: `${a.name}: ${usd(a.amount)} for ${a.purpose.toLowerCase()}`, ok, answer: OPTIONS[ev.indexOf(best)], explanation: `Debt-to-income ${(dti(a) * 100).toFixed(0)}%, default risk ${(defaultProb(a) * 100).toFixed(1)}%. Expected profit: prime ${usd(ev[0])}, ${(RISK_RATE * 100).toFixed(0)}% ${usd(ev[1])}, decline $0.` });
  };
  const next = () => {
    if (i + 1 >= apps.length) {
      const span = total.best - total.worst || 1;
      onFinish({ score: Math.max(0, Math.min(100, ((total.got - total.worst) / span) * 100)), summary: `Your book's expected profit: ${usd(total.got)} (best possible ${usd(total.best)}).` });
      return;
    }
    setI(i + 1);
    setPick(null);
  };

  return (
    <div className="pro">
      <ProHead kicker={`Loan officer · Application ${i + 1} of ${apps.length}`} title={`${a.name}: ${usd(a.amount)} over ${a.years} years`} sub={`Purpose: ${a.purpose}. Funding costs the bank ${4}% a year. Price for risk, or say no.`} right={<div className="pro-price"><span className="pro-kicker">Book expected profit</span><b>{usd(total.got)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Application file</h4>
          <Table
            head={['Item', 'Value']}
            rows={[
              ['Credit score', a.score],
              ['Monthly gross income', usd(a.income)],
              ['Existing debt payments / month', usd(a.debts)],
              [`New payment at ${(PRIME * 100).toFixed(0)}%`, usd(pay)],
              ['Security', a.secured ? 'Yes (asset can be repossessed)' : 'None (unsecured)'],
              ['Debt-to-income with this loan', pick === null ? '? (work it out)' : `${(dti(a) * 100).toFixed(1)}%`],
            ]}
          />
          <p className="tiny muted" style={{ marginBottom: 0 }}>
            DTI = (existing payments + new payment) ÷ gross income. Most lenders get nervous above 36% and stop near 43%.
          </p>
        </section>
        <section className="pro-panel">
          <h4>Your decision</h4>
          <div className="col" style={{ gap: 8 }}>
            {OPTIONS.map((o, k) => (
              <button key={o} type="button" className={cls('pro-pill', pick === k && 'sel', pick !== null && ev[k] === Math.max(...ev) && 'best')} disabled={pick !== null} onClick={() => decide(k)}>
                {o}
              </button>
            ))}
          </div>
          {pick !== null && (
            <>
              <Bars items={OPTIONS.map((o, k) => ({ label: o, value: ev[k], color: ev[k] === Math.max(...ev) ? C.green : ev[k] < 0 ? C.red : C.blue }))} fmt={(v) => usd(v)} />
              <Verdict ok={ev[pick] >= Math.max(...ev) - 1} title={`Default probability ${(defaultProb(a) * 100).toFixed(1)}% · DTI ${(dti(a) * 100).toFixed(0)}%`}>
                {defaultProb(a) < 0.04
                  ? 'A prime borrower: other banks would compete, so a high rate mostly scares them away.'
                  : defaultProb(a) < 0.15
                    ? 'Some risk. A higher rate pays the bank for the borrowers who will not repay.'
                    : 'Too risky: expected losses outweigh any interest you can charge.'}
              </Verdict>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="primary" size="big" onClick={next}>
                  {i + 1 >= apps.length ? 'See results ▶' : 'Next applicant ▶'}
                </Button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
