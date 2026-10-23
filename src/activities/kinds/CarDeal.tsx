'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { monthlyPayment, leasePayment } from '@/game/finance/loans';
import { Button, ReadAloud } from '@/ui/common';
import { money, pct } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

interface Option {
  label: string;
  detail: string;
  cost: number; // net cost over the horizon (payments + down − resale value)
}

/** Compare true costs: cash vs loan vs lease (Advanced) or cheap vs fancy rides incl. upkeep (Entry). */
export default function CarDeal({ params, difficulty, onFinish, addReview, seed }: KindProps<{ rounds: number }>) {
  const entry = difficulty === 'entry';
  const rng = useMemo(() => makeRng(seed), [seed]);
  const makeRound = () => {
    if (entry) {
      const a = { name: rng.pick(['Used Bike', 'Basic Scooter', 'Used Hatchback']), price: rng.int(4, 12) * 10, upkeep: rng.int(2, 6) };
      const b = { name: rng.pick(['Shiny New Bike', 'Electric Scooter', 'Sporty Kart']), price: a.price + rng.int(2, 8) * 10, upkeep: a.upkeep + rng.int(-1, 4) };
      const months = 12;
      const opts: Option[] = [a, b].map((x) => ({ label: `${x.name}: ${money(x.price, { cents: false })}`, detail: `+ ${money(x.upkeep, { cents: false })} every month to keep it running`, cost: x.price + x.upkeep * months }));
      return { story: `You need a ride for one year (12 months). Which one costs LESS in total?`, opts, months };
    }
    const price = rng.int(18, 36) * 1000;
    const apr = rng.pick([0.049, 0.059, 0.069, 0.079]);
    const years = rng.pick([3, 5, 7]);
    const months = years * 12;
    const resale = (y: number) => price * Math.pow(0.85, y);
    const down = price * 0.1;
    const loanPmt = monthlyPayment(price - down, apr, 60);
    // loan payments made within horizon (60-month loan); if horizon < 5y, remaining balance paid at sale
    const paidMonths = Math.min(60, months);
    const i = apr / 12;
    const remaining = months >= 60 ? 0 : (price - down) * Math.pow(1 + i, paidMonths) - loanPmt * ((Math.pow(1 + i, paidMonths) - 1) / i);
    const loanCost = down + loanPmt * paidMonths + remaining - resale(years);
    const cashCost = price - resale(years);
    const leasePm = leasePayment(price, price * 0.55, 36, apr);
    const leaseCost = (leasePm * 36 + price * 0.04) * (months / 36);
    const opts: Option[] = [
      { label: 'Pay cash', detail: `${money(price, { cents: false })} today, sell after ${years} yrs for ~${money(resale(years), { cents: false })}`, cost: cashCost },
      { label: 'Auto loan', detail: `10% down + ${money(loanPmt)}/mo for 60 mo at ${pct(apr, 1)} APR, sell after ${years} yrs`, cost: loanCost },
      { label: 'Lease (renew every 3 yrs)', detail: `${money(leasePm)}/mo + 4% at signing each lease, no car at the end`, cost: leaseCost },
    ];
    return { story: `${rng.pick(['Jordan', 'Riley', 'Sam', 'Alex'])} wants a ${money(price, { cents: false })} car for ${years} years and has the cash available. Ignoring the cash's other uses, which option has the LOWEST net cost?`, opts, months };
  };
  const [round, setRound] = useState(0);
  const [r, setR] = useState(makeRound);
  const [picked, setPicked] = useState<number | null>(null);
  const right = useRef(0);
  const best = r.opts.reduce((b, o, i) => (o.cost < r.opts[b].cost ? i : b), 0);
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    const ok = i === best;
    if (ok) right.current++;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: 'car-deal', topic: 'debt' }, ok));
    addReview?.({ q: r.story, ok, answer: r.opts[best].label, explanation: r.opts.map((o) => `${o.label}: ${money(o.cost, { cents: false })}`).join(' · ') });
  };
  return (
    <div className="col" style={{ gap: 10 }}>
      <b>
        Deal {round + 1}/{params.rounds}
      </b>
      <div className="card tint-teal">
        {r.story} <ReadAloud text={r.story} />
      </div>
      <div className="col" style={{ gap: 8 }}>
        {r.opts.map((o, i) => (
          <button key={i} className={`choice ${picked !== null && i === best ? 'right' : picked === i ? 'wrong' : ''}`} onClick={() => pick(i)} disabled={picked !== null}>
            <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
            <span className="col" style={{ gap: 0, alignItems: 'flex-start' }}>
              <b>{o.label}</b>
              <span className="small">{o.detail}</span>
              {picked !== null && <span className="small bold">Net cost: {money(o.cost, { cents: false })}</span>}
            </span>
          </button>
        ))}
      </div>
      {picked !== null && (
        <div className="card">
          {entry
            ? 'The cheaper price isn’t always the cheapest ride! Always add up the monthly costs too.'
            : 'Net cost = everything you pay − what the car is worth when you’re done. Loans add interest; leases never leave you with an asset; cash is cheapest when you can spare it, but don’t drain your emergency fund to do it.'}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                if (round + 1 >= params.rounds) onFinish({ score: (right.current / params.rounds) * 100, correct: right.current, total: params.rounds });
                else {
                  setRound(round + 1);
                  setR(makeRound());
                  setPicked(null);
                }
              }}
            >
              Next ▶
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
