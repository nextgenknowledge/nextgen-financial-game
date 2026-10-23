'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { paycheck } from '@/game/finance/tax';
import { Button, ReadAloud, ProgressBar } from '@/ui/common';
import { Pie } from '@/ui/kit';
import { money, pct } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

interface Cat {
  id: string;
  label: string;
  icon: string;
  group: 'needs' | 'wants' | 'save';
  min: number; // realistic minimum (needs)
}

const ADV: Cat[] = [
  { id: 'rent', label: 'Rent & utilities', icon: '🏠', group: 'needs', min: 0.3 },
  { id: 'food', label: 'Groceries', icon: '🥦', group: 'needs', min: 0.1 },
  { id: 'transport', label: 'Transport', icon: '🚌', group: 'needs', min: 0.05 },
  { id: 'phone', label: 'Phone & insurance', icon: '📱', group: 'needs', min: 0.04 },
  { id: 'fun', label: 'Eating out & fun', icon: '🎉', group: 'wants', min: 0 },
  { id: 'shopping', label: 'Shopping', icon: '🛍️', group: 'wants', min: 0 },
  { id: 'emergency', label: 'Emergency fund', icon: '☔', group: 'save', min: 0 },
  { id: 'invest', label: 'Investing / retirement', icon: '📈', group: 'save', min: 0 },
];
const ENTRY: Cat[] = [
  { id: 'needs', label: 'Needs (lunch, bus)', icon: '🍎', group: 'needs', min: 0.3 },
  { id: 'fun', label: 'Fun money', icon: '🎈', group: 'wants', min: 0 },
  { id: 'save', label: 'Savings jar', icon: '🐷', group: 'save', min: 0 },
  { id: 'share', label: 'Share jar', icon: '💝', group: 'wants', min: 0 },
];

/** Build a 50/30/20 budget, then live through months of surprises with an emergency buffer. */
export default function BudgetPlanner({ params, difficulty, onFinish, addReview, seed }: KindProps<{ months: number }>) {
  const entry = difficulty === 'entry';
  const cats = entry ? ENTRY : ADV;
  const income = useMemo(() => {
    if (entry) return 40;
    const gross = makeRng(seed).pick([3200, 3600, 4000, 4500, 5000]);
    return Math.round(paycheck(gross, 12).net);
  }, [seed, entry]);
  const step = entry ? 2 : 25;
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(cats.map((c) => [c.id, Math.round((income * c.min) / step) * step])));
  const [phase, setPhase] = useState<'plan' | 'sim'>('plan');
  const [log, setLog] = useState<string[]>([]);
  const [buffer, setBuffer] = useState(0);
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  const group = (g: Cat['group']) => cats.filter((c) => c.group === g).reduce((s, c) => s + alloc[c.id], 0);

  const simulate = () => {
    const rng = makeRng(seed + 7);
    const surprises = entry
      ? [
          { t: 'Your bike chain broke', c: 6 },
          { t: "A friend's birthday gift", c: 5 },
          { t: 'Lost your lunch money', c: 4 },
          { t: 'Grandma gave you money!', c: -10 },
        ]
      : [
          { t: 'Car repair', c: 420 },
          { t: 'Dentist visit', c: 180 },
          { t: 'Friend’s wedding gift + travel', c: 300 },
          { t: 'Laptop died', c: 650 },
          { t: 'Bonus at work!', c: -250 },
          { t: 'Phone screen cracked', c: 160 },
        ];
    let buf = entry ? alloc.save : alloc.emergency;
    let borrowed = 0;
    const lines: string[] = [];
    for (let m = 1; m <= params.months; m++) {
      const s = rng.chance(0.75) ? rng.pick(surprises) : null;
      const overspend = rng.chance(0.3) ? Math.round(income * rng.range(0.01, 0.05)) : 0;
      if (m > 1) buf += entry ? alloc.save : alloc.emergency;
      const cost = (s?.c ?? 0) + overspend;
      buf -= cost;
      if (buf < 0) {
        borrowed += -buf;
        lines.push(`Month ${m}: ${s ? `${s.t} (${s.c < 0 ? '+' : '−'}${money(Math.abs(s.c), { cents: false })})` : 'Small overspending'}, buffer ran out, had to borrow ${money(-buf, { cents: false })} 😬`);
        buf = 0;
      } else lines.push(`Month ${m}: ${s ? `${s.t} (${s.c < 0 ? '+' : '−'}${money(Math.abs(s.c), { cents: false })})` : 'Quiet month'}${overspend ? `, overspent ${money(overspend, { cents: false })}` : ''} → buffer ${money(buf, { cents: false })}`);
    }
    setLog(lines);
    setBuffer(buf);
    setPhase('sim');
    playSfx(borrowed > 0 ? 'wrong' : 'correct');
    // Score: plan quality + surviving surprises
    const needs = group('needs') / income;
    const wants = group('wants') / income;
    const save = group('save') / income;
    const balanced = Math.abs(total - income) <= step;
    let plan = 100;
    if (!balanced) plan -= 30;
    for (const c of cats) if (c.group === 'needs' && alloc[c.id] < income * c.min - 0.5) plan -= 15;
    if (!entry) plan -= Math.abs(needs - 0.5) * 60 + Math.abs(wants - 0.3) * 60 + Math.abs(save - 0.2) * 80;
    else plan -= save < 0.2 ? 20 : 0;
    const surv = borrowed === 0 ? 100 : Math.max(0, 100 - (borrowed / income) * 150);
    const score = Math.max(0, Math.min(100, plan * 0.55 + surv * 0.45));
    act((d, fx) => recordAnswer(d, fx, { id: 'budget-plan', topic: 'budgeting' }, score >= 70));
    addReview?.({
      q: 'Your budget',
      ok: score >= 70,
      answer: `Needs ${pct(needs, 0)} · Wants ${pct(wants, 0)} · Savings ${pct(save, 0)}`,
      explanation: entry
        ? 'Needs first, then save some and share some. Savings helped cover surprises!'
        : 'A 50/30/20 split with a real emergency-fund line lets surprises hit your buffer instead of a credit card.',
    });
    setFinalScore(score);
  };
  const [finalScore, setFinalScore] = useState(0);

  if (phase === 'sim')
    return (
      <div className="col" style={{ gap: 8 }}>
        <b>Living with your budget…</b>
        {log.map((l, i) => (
          <div key={i} className="card flat small">
            {l}
          </div>
        ))}
        <div className="card tint-gold">Buffer left at the end: {money(buffer, { cents: false })}</div>
        <Button variant="primary" size="big" onClick={() => onFinish({ score: finalScore })}>
          See my stars
        </Button>
      </div>
    );

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal">
        {entry ? (
          <>
            You earned <b>{money(income, { cents: false })}</b> this month from chores! Plan where every dollar goes. <ReadAloud text="You earned 40 dollars. Plan where every dollar goes." />
          </>
        ) : (
          <>
            Your take-home (net) pay is <b>{money(income, { cents: false })}/month</b> after taxes. Aim for ~50% needs, 30% wants, 20% savings. Your plan will face {params.months} months of real-life surprises.
          </>
        )}
      </div>
      <div className="row wrap" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="col grow" style={{ gap: 6, minWidth: 280 }}>
          {cats.map((c) => (
            <div key={c.id} className="alloc-row">
              <span className="bold">
                {c.icon} {c.label}
              </span>
              <input type="range" min={0} max={income} step={step} value={alloc[c.id]} onChange={(e) => setAlloc({ ...alloc, [c.id]: Number(e.target.value) })} aria-label={c.label} />
              <b className="mono" style={{ minWidth: 70, textAlign: 'right' }}>
                {money(alloc[c.id], { cents: false })}
              </b>
            </div>
          ))}
        </div>
        <div className="col center" style={{ minWidth: 170 }}>
          <Pie
            slices={[
              { label: 'Needs', value: group('needs'), color: '#2f6bdb' },
              { label: 'Wants', value: group('wants'), color: '#ffcf3f' },
              { label: 'Savings', value: group('save'), color: '#3cc45a' },
            ]}
          />
          <div className="small">
            <div>🔵 Needs {pct(group('needs') / income, 0)}</div>
            <div>🟡 Wants {pct(group('wants') / income, 0)}</div>
            <div>🟢 Savings {pct(group('save') / income, 0)}</div>
          </div>
        </div>
      </div>
      <ProgressBar value={total} max={income} color={total > income ? 'var(--bad)' : 'var(--teal)'} height={16} />
      <b className={Math.abs(total - income) <= step ? 'good' : 'bad'}>
        Planned {money(total, { cents: false })} of {money(income, { cents: false })} {total > income ? '(over budget!)' : total < income - step ? `(${money(income - total, { cents: false })} unplanned)` : '✓'}
      </b>
      <Button variant="gold" size="big" onClick={simulate}>
        Live with this budget ▶
      </Button>
    </div>
  );
}
