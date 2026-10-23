'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

interface Plan {
  name: string;
  premium: number;
  deductible: number;
  coverage: number;
}
interface Cat {
  id: string;
  icon: string;
  name: string;
  plans: Plan[];
  events: { text: string; cost: number; p: number }[]; // p = monthly chance
}

const CATS: Cat[] = [
  {
    id: 'health',
    icon: '🩺',
    name: 'Health',
    plans: [
      { name: 'None', premium: 0, deductible: 0, coverage: 0 },
      { name: 'High-deductible', premium: 60, deductible: 2000, coverage: 0.9 },
      { name: 'Low-deductible', premium: 180, deductible: 250, coverage: 0.9 },
    ],
    events: [
      { text: 'Flu & doctor visit', cost: 180, p: 0.12 },
      { text: 'Broken arm', cost: 4500, p: 0.025 },
      { text: 'Emergency surgery', cost: 25000, p: 0.006 },
    ],
  },
  {
    id: 'auto',
    icon: '🚗',
    name: 'Car',
    plans: [
      { name: 'None', premium: 0, deductible: 0, coverage: 0 },
      { name: 'Basic', premium: 45, deductible: 1000, coverage: 0.8 },
      { name: 'Full', premium: 110, deductible: 250, coverage: 1 },
    ],
    events: [
      { text: 'Fender bender', cost: 1800, p: 0.04 },
      { text: 'Car totaled in a crash', cost: 15000, p: 0.006 },
    ],
  },
  {
    id: 'home',
    icon: '🏠',
    name: 'Renters',
    plans: [
      { name: 'None', premium: 0, deductible: 0, coverage: 0 },
      { name: 'Renters basic', premium: 15, deductible: 500, coverage: 1 },
    ],
    events: [
      { text: 'Laptop stolen', cost: 1200, p: 0.02 },
      { text: 'Apartment fire damages your stuff', cost: 9000, p: 0.004 },
    ],
  },
];

function outOfPocket(cost: number, p: Plan) {
  if (p.coverage === 0) return cost;
  return Math.min(cost, p.deductible + Math.max(0, cost - p.deductible) * (1 - p.coverage));
}

/** Expected yearly cost (premiums + expected out-of-pocket) and worst-case exposure. */
function analyze(c: Cat, p: Plan) {
  let expected = p.premium * 12;
  let worst = 0;
  for (const e of c.events) {
    expected += 12 * e.p * outOfPocket(e.cost, p);
    worst = Math.max(worst, outOfPocket(e.cost, p));
  }
  return { expected, worst };
}

/** Choose plans, then simulate a year of random events. */
export default function InsuranceSim({ params, onFinish, addReview, seed }: KindProps<{ advanced: boolean }>) {
  const adv = params.advanced;
  const cats = adv ? CATS : CATS.slice(0, 2).map((c) => ({ ...c, plans: [c.plans[0], c.plans[c.plans.length - 1]] }));
  const [choice, setChoice] = useState<Record<string, number>>(() => Object.fromEntries(cats.map((c) => [c.id, 0])));
  const [year, setYear] = useState<null | { lines: string[]; premiums: number; oop: number; noInsurance: number }>(null);
  const events = useMemo(() => {
    const rng = makeRng(seed);
    const out: { month: number; cat: Cat; text: string; cost: number }[] = [];
    for (let m = 1; m <= 12; m++)
      for (const c of cats)
        for (const e of c.events) {
          // Slightly boosted odds so the year teaches something
          if (rng.chance(e.p * (adv ? 2.2 : 3))) out.push({ month: m, cat: c, text: e.text, cost: e.cost });
        }
    return out;
  }, [seed, adv]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = () => {
    const premiums = cats.reduce((s, c) => s + c.plans[choice[c.id]].premium * 12, 0);
    let oop = 0;
    let none = 0;
    const lines: string[] = [];
    for (const e of events) {
      const p = e.cat.plans[choice[e.cat.id]];
      const pay = outOfPocket(e.cost, p);
      oop += pay;
      none += e.cost;
      lines.push(`Month ${e.month}: ${e.cat.icon} ${e.text}, bill ${money(e.cost, { cents: false })}, you paid ${money(pay, { cents: false })}`);
    }
    if (!lines.length) lines.push('A calm year, no big surprises! (Insurance is for the years that aren’t calm.)');
    setYear({ lines, premiums, oop, noInsurance: none });
    playSfx('whoosh');
  };

  const finish = () => {
    // Score on decision quality, not luck: protection from catastrophes + reasonable expected cost
    let q = 0;
    for (const c of cats) {
      const a = c.plans.map((p) => analyze(c, p));
      const mine = a[choice[c.id]];
      const bestExp = Math.min(...a.filter((x) => x.worst <= 5000).map((x) => x.expected));
      const protectedOk = mine.worst <= 5000;
      const s = protectedOk ? 0.6 + 0.4 * Math.min(1, bestExp / Math.max(1, mine.expected)) : 0.25;
      q += s;
      const ok = protectedOk;
      act((d, fx) => recordAnswer(d, fx, { id: `ins:${c.id}`, topic: 'insurance' }, ok));
      addReview?.({
        q: `${c.icon} ${c.name}: chose ${c.plans[choice[c.id]].name}`,
        ok,
        answer: `Expected yearly cost ${money(mine.expected, { cents: false })}, worst single bill ${money(mine.worst, { cents: false })}`,
        explanation: protectedOk
          ? 'You protected yourself from a catastrophe. Higher deductibles lower premiums if you have savings to cover the deductible.'
          : 'Going uninsured saves premiums, but one big event could cost more than many years of premiums. Insurance is for losses you can’t afford.',
      });
    }
    onFinish({ score: (q / cats.length) * 100 });
  };

  if (year)
    return (
      <div className="col" style={{ gap: 8 }}>
        <b>Your year:</b>
        {year.lines.map((l, i) => (
          <div key={i} className="card flat small">
            {l}
          </div>
        ))}
        <div className="card tint-gold">
          Premiums {money(year.premiums, { cents: false })} + out-of-pocket {money(year.oop, { cents: false })} = <b>{money(year.premiums + year.oop, { cents: false })}</b>. With no insurance you would have paid{' '}
          <b>{money(year.noInsurance, { cents: false })}</b>.
        </div>
        <Button variant="primary" size="big" onClick={finish}>
          See my stars
        </Button>
      </div>
    );

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal small">
        {adv
          ? 'Pick a plan for each category. Premium = monthly price. Deductible = what you pay first on each claim. Coverage = share paid after the deductible.'
          : 'Pick protection for each. Protection costs a little every month, but helps a LOT when something big happens.'}
        <ReadAloud text="Pick protection for each thing. It costs a little each month but helps when something big happens." />
      </div>
      {cats.map((c) => (
        <div key={c.id} className="card flat">
          <b>
            {c.icon} {c.name}
          </b>
          <div className="row wrap" style={{ gap: 8, marginTop: 6 }}>
            {c.plans.map((p, k) => (
              <button key={p.name} className={`shop-opt ${choice[c.id] === k ? 'on' : ''}`} onClick={() => setChoice({ ...choice, [c.id]: k })}>
                <b>{p.name}</b>
                {p.premium > 0 ? (
                  <>
                    <span className="small">{money(p.premium, { cents: false })}/month</span>
                    {adv && <span className="tiny">Deductible {money(p.deductible, { cents: false })} · pays {Math.round(p.coverage * 100)}% after</span>}
                  </>
                ) : (
                  <span className="small">$0, you pay every bill yourself</span>
                )}
              </button>
            ))}
          </div>
          {adv && <div className="tiny muted">Risks: {c.events.map((e) => `${e.text} (${money(e.cost, { cents: false })})`).join(' · ')}</div>}
        </div>
      ))}
      <Button variant="gold" size="big" onClick={run}>
        Live through the year ▶
      </Button>
    </div>
  );
}
