'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { LineChart, Stat, StatGrid } from '@/ui/kit';
import { money, pct } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

/** Choose how much goes to the emergency fund vs. fun each month, then survive surprises. */
export default function EmergencySim({ params, difficulty, onFinish, addReview, seed }: KindProps<{ months: number }>) {
  const entry = difficulty === 'entry';
  const income = entry ? 20 : 2400;
  const fixed = entry ? 8 : 1700;
  const spare = income - fixed;
  const [share, setShare] = useState(0.4);
  const [result, setResult] = useState<null | { fund: number[]; debt: number[]; fun: number; lines: string[]; interest: number }>(null);
  const surprises = useMemo(() => {
    const rng = makeRng(seed);
    const list = entry
      ? [
          { t: 'Broken bike chain', c: 8 },
          { t: 'Lost library book fine', c: 6 },
          { t: 'Friend’s birthday gift', c: 5 },
          { t: 'Cracked tablet screen', c: 15 },
        ]
      : [
          { t: 'Car repair', c: 650 },
          { t: 'Dentist', c: 280 },
          { t: 'Vet bill', c: 420 },
          { t: 'Hours cut at work (lost income)', c: 600 },
          { t: 'Phone died', c: 350 },
          { t: 'Urgent family trip', c: 900 },
        ];
    return Array.from({ length: params.months }, () => (rng.chance(entry ? 0.45 : 0.4) ? rng.pick(list) : null));
  }, [seed, entry, params.months]);

  const run = () => {
    let fund = 0;
    let debt = 0;
    let fun = 0;
    let interest = 0;
    const fundS: number[] = [];
    const debtS: number[] = [];
    const lines: string[] = [];
    for (let m = 0; m < params.months; m++) {
      if (debt > 0) {
        const i = debt * (0.2499 / 12);
        debt += i;
        interest += i;
      }
      const save = spare * share;
      fun += spare - save;
      // Pay down debt first with the savings share, then build the fund
      const toDebt = Math.min(debt, save);
      debt -= toDebt;
      fund += save - toDebt;
      const s = surprises[m];
      if (s) {
        const fromFund = Math.min(fund, s.c);
        fund -= fromFund;
        const rest = s.c - fromFund;
        debt += rest;
        lines.push(`Month ${m + 1}: ${s.t} (${money(s.c, { cents: false })}), ${rest > 0 ? `fund short, ${money(rest, { cents: false })} on a 25% credit card 😬` : 'covered by your fund ✅'}`);
      }
      fundS.push(Math.round(fund));
      debtS.push(Math.round(debt));
    }
    setResult({ fund: fundS, debt: debtS, fun, lines, interest });
    playSfx(debt > 0 ? 'wrong' : 'correct');
  };

  const finish = () => {
    const r = result!;
    const endDebt = r.debt[r.debt.length - 1];
    const funShare = r.fun / (spare * params.months);
    // Best: no debt, still some fun (balance matters!)
    const score = Math.max(0, Math.min(100, (endDebt <= 1 ? 70 : 70 - (endDebt / income) * 60) + Math.min(30, funShare * 60)));
    act((d, fx) => recordAnswer(d, fx, { id: 'emergency', topic: 'saving' }, endDebt <= 1));
    addReview?.({
      q: `You saved ${pct(share, 0)} of spare money each month`,
      ok: endDebt <= 1,
      answer: endDebt <= 1 ? 'No debt, your fund absorbed the surprises' : `${money(endDebt, { cents: false })} of card debt (+${money(r.interest)} interest)`,
      explanation: 'An emergency fund turns surprises into small bumps. Without one, they go on high-interest credit, and the interest keeps growing. Aim for 3–6 months of expenses, but keep some fun in your budget too!',
    });
    onFinish({ score });
  };

  if (result)
    return (
      <div className="col" style={{ gap: 8 }}>
        <LineChart
          series={[
            { values: result.fund, color: '#3cc45a' },
            { values: result.debt.map((d) => -d), color: '#e1553f', dashed: true },
          ]}
          labels={result.fund.map((_, i) => `M${i + 1}`)}
          height={150}
        />
        <div className="tiny">Green = emergency fund, red dashed = debt.</div>
        {result.lines.map((l, i) => (
          <div key={i} className="card flat small">
            {l}
          </div>
        ))}
        <StatGrid>
          <Stat label="Fund at the end" value={money(result.fund[result.fund.length - 1], { cents: false })} tone="good" />
          <Stat label="Debt at the end" value={money(result.debt[result.debt.length - 1], { cents: false })} tone={result.debt[result.debt.length - 1] > 0 ? 'bad' : 'good'} />
          <Stat label="Fun money spent" value={money(result.fun, { cents: false })} />
        </StatGrid>
        <Button variant="primary" size="big" onClick={finish}>
          See my stars
        </Button>
      </div>
    );

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal">
        {entry ? (
          <>
            You get {money(income, { cents: false })} a month. {money(fixed, { cents: false })} goes to needs. How much of the other {money(spare, { cents: false })} goes into your rainy-day jar?
          </>
        ) : (
          <>
            Take-home pay {money(income, { cents: false })}/month; fixed costs {money(fixed, { cents: false })}. Split the remaining {money(spare, { cents: false })} between your emergency fund (and paying off debt) and fun. Surprises will hit over {params.months} months; any shortfall goes on a 25% APR card.
          </>
        )}
        <ReadAloud text="How much of your spare money goes into your rainy day fund?" />
      </div>
      <div className="alloc-row">
        <span className="bold">☔ Rainy-day share</span>
        <input type="range" min={0} max={1} step={0.05} value={share} onChange={(e) => setShare(Number(e.target.value))} />
        <b className="mono">{pct(share, 0)}</b>
      </div>
      <div className="small">
        Each month: {money(spare * share, { cents: false })} to the fund, {money(spare * (1 - share), { cents: false })} for fun.
      </div>
      <Button variant="gold" size="big" onClick={run}>
        Live through {params.months} months ▶
      </Button>
    </div>
  );
}
