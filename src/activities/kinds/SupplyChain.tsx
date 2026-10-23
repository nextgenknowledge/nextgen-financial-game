'use client';
/**
 * Supply Chain Desk (Advanced). Six shipments from Hong Kong to customers abroad. For each, choose
 * ocean, rail or air freight. Cheap freight is slow and unpredictable: stock that arrives early
 * ties up money (carrying cost) and stock that arrives late loses sales. Scored on total expected
 * landed cost against the best choice for every shipment.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { MODES, shipCost, type Shipment } from '@/game/finance/desks';
import { Bars, C, ProHead, Table, Verdict, usd } from './pro/kit';

const PRODUCTS = [
  { product: 'Smartphones', kgPerUnit: 0.6, unitValue: 420, margin: 90 },
  { product: 'Winter coats', kgPerUnit: 1.6, unitValue: 95, margin: 40 },
  { product: 'Office chairs', kgPerUnit: 14, unitValue: 140, margin: 45 },
  { product: 'Tea (premium)', kgPerUnit: 0.5, unitValue: 28, margin: 12 },
  { product: 'Laptops', kgPerUnit: 2.2, unitValue: 900, margin: 140 },
  { product: 'Bicycles', kgPerUnit: 16, unitValue: 260, margin: 70 },
  { product: 'Toys for the holidays', kgPerUnit: 0.8, unitValue: 22, margin: 10 },
  { product: 'Solar panels', kgPerUnit: 21, unitValue: 180, margin: 35 },
];

export default function SupplyChain({ onFinish, addReview, seed }: KindProps) {
  const ships = useMemo<Shipment[]>(() => {
    const rng = makeRng(seed * 11 + 5);
    return rng
      .shuffle([...PRODUCTS])
      .slice(0, 6)
      .map((p) => ({ ...p, units: Math.round(rng.range(5, 40)) * 100, dueIn: rng.pick([8, 14, 21, 28, 40, 55]) }));
  }, [seed]);
  const [choice, setChoice] = useState<(number | null)[]>(ships.map(() => null));
  const [done, setDone] = useState(false);
  const costs = ships.map((s) => MODES.map((m) => shipCost(s, m)));
  const best = costs.map((cs) => cs.reduce((bi, c, i) => (c.total < cs[bi].total ? i : bi), 0));
  const mine = choice.reduce<number>((a, c, i) => a + (c === null ? 0 : costs[i][c].total), 0);
  const opt = best.reduce((a, b, i) => a + costs[i][b].total, 0);
  const worst = costs.reduce((a, cs) => a + Math.max(...cs.map((c) => c.total)), 0);

  const submit = () => {
    setDone(true);
    const score = Math.max(0, Math.min(1, (worst - mine) / (worst - opt || 1)));
    playSfx(score > 0.9 ? 'correct' : 'star');
    ships.forEach((s, i) => {
      const c = choice[i]!;
      if (c !== best[i]) addReview?.({ q: `${s.product}: ${s.units.toLocaleString()} units due in ${s.dueIn} days`, ok: false, answer: MODES[best[i]].name, explanation: `Expected cost: ${MODES.map((m, k) => `${m.name} ${usd(costs[i][k].total)}`).join(', ')}. ${s.dueIn < 12 ? 'Only air arrives in time; lost sales dwarf the freight bill.' : s.kgPerUnit > 8 ? 'Heavy, low-value goods: air freight would cost more than the margin.' : 'Weigh freight against carrying cost and the risk of arriving late.'}` });
    });
  };

  return (
    <div className="pro">
      <ProHead kicker="Logistics hub · Supply chain desk" title="Ship it smart" sub="Choose a mode for each order. Carrying cost is 25% a year of the stock’s value. Every day late loses 10% of sales, up to all of them." right={<div className="pro-price"><span className="pro-kicker">Expected total cost</span><b>{usd(mine)}</b></div>} />
      <section className="pro-panel">
        <Table head={['Mode', 'Price', 'Transit time']} rows={MODES.map((m) => [m.name, `$${m.perKg.toFixed(2)}/kg`, `${m.days} days ± ${m.spread}`])} compact />
      </section>
      <section className="pro-panel">
        <div className="sc-list">
          {ships.map((s, i) => (
            <div key={s.product} className="sc-row">
              <div className="col" style={{ gap: 2 }}>
                <b>{s.product}</b>
                <span className="tiny muted">
                  {s.units.toLocaleString()} units · {(s.units * s.kgPerUnit).toLocaleString()} kg · {usd(s.unitValue)} each · due in <b>{s.dueIn} days</b>
                </span>
              </div>
              <div className="row" style={{ gap: 6 }}>
                {MODES.map((m, k) => (
                  <button key={m.id} type="button" disabled={done} className={cls('pro-pill', choice[i] === k && 'sel', done && best[i] === k && 'best')} onClick={() => setChoice(choice.map((c, j) => (j === i ? k : c)))}>
                    {m.id === 'sea' ? 'Ocean' : m.id === 'rail' ? 'Rail' : 'Air'}
                    {done && <span className="tiny"> {usd(costs[i][k].total)}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      {done ? (
        <section className="pro-panel">
          <Bars items={[{ label: 'Your plan', value: mine, color: C.blue }, { label: 'Best plan', value: opt, color: C.green }, { label: 'Worst plan', value: worst, color: C.red }]} fmt={(v) => usd(v)} />
          <Verdict ok={mine <= opt * 1.05} title={`You spent ${usd(mine - opt)} more than the best plan`}>
            Total landed cost is freight + carrying cost + lost sales. Cheapest freight is not cheapest overall.
          </Verdict>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            <Button variant="primary" size="big" onClick={() => onFinish({ score: Math.max(0, Math.min(100, ((worst - mine) / (worst - opt || 1)) * 100)), summary: `Landed cost ${usd(mine)} vs best ${usd(opt)}.` })}>
              See results ▶
            </Button>
          </div>
        </section>
      ) : (
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="gold" size="big" disabled={choice.some((c) => c === null)} onClick={submit}>
            Book all shipments
          </Button>
        </div>
      )}
    </div>
  );
}
