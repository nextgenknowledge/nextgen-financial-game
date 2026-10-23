'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

interface Opt {
  label: string;
  qty: number;
  unit: string;
  price: number;
  coupon: number;
}
interface Item {
  name: string;
  icon: string;
  opts: Opt[];
}

const CATALOG: { name: string; icon: string; unit: string; base: number; brands: string[] }[] = [
  { name: 'Milk', icon: '🥛', unit: 'cup', base: 0.22, brands: ['Store brand', 'Happy Cow'] },
  { name: 'Bread', icon: '🍞', unit: 'slice', base: 0.12, brands: ['Store brand', 'Golden Crust'] },
  { name: 'Eggs', icon: '🥚', unit: 'egg', base: 0.3, brands: ['Store brand', 'Sunny Farms'] },
  { name: 'Apples', icon: '🍎', unit: 'apple', base: 0.55, brands: ['Loose', 'Orchard Pack'] },
  { name: 'Rice', icon: '🍚', unit: 'cup', base: 0.18, brands: ['Store brand', 'Jade Rice'] },
  { name: 'Cereal', icon: '🥣', unit: 'bowl', base: 0.35, brands: ['Store brand', 'Crunchy Os'] },
  { name: 'Cheese', icon: '🧀', unit: 'slice', base: 0.25, brands: ['Store brand', 'Alpine Gold'] },
  { name: 'Pasta', icon: '🍝', unit: 'serving', base: 0.28, brands: ['Store brand', 'Nonna’s'] },
  { name: 'Bananas', icon: '🍌', unit: 'banana', base: 0.25, brands: ['Loose', 'Bunch'] },
];

/** Buy one option for each item on the list without exceeding the budget. */
export default function Grocery({ params, onFinish, addReview, seed }: KindProps<{ unit: boolean; coupons: boolean; items: number }>) {
  const { items, budget } = useMemo(() => {
    const rng = makeRng(seed);
    const picks = rng.shuffle([...CATALOG]).slice(0, params.items);
    const items: Item[] = picks.map((c) => {
      const opts: Opt[] = [];
      if (!params.unit) {
        const q = rng.pick([6, 8, 10, 12]);
        const p1 = Math.round(c.base * q * rng.range(0.9, 1.1) * 4) / 4 + 0.75;
        const p2 = Math.round((p1 + rng.pick([0.5, 1, 1.5, 2])) * 4) / 4;
        opts.push({ label: c.brands[0], qty: q, unit: c.unit, price: p1, coupon: 0 }, { label: c.brands[1], qty: q, unit: c.unit, price: p2, coupon: 0 });
      } else {
        const small = rng.pick([6, 8, 10]);
        const big = small * rng.pick([2, 3]);
        const unitSmall = c.base * rng.range(1.05, 1.3);
        const unitBig = c.base * rng.range(0.75, 1.05);
        const brandUnit = c.base * rng.range(1.25, 1.6);
        opts.push(
          { label: `${c.brands[0]} (small)`, qty: small, unit: c.unit, price: round(unitSmall * small), coupon: 0 },
          { label: `${c.brands[0]} (family size)`, qty: big, unit: c.unit, price: round(unitBig * big), coupon: 0 },
          { label: c.brands[1], qty: small, unit: c.unit, price: round(brandUnit * small), coupon: params.coupons && rng.chance(0.5) ? rng.pick([0.5, 1, 1.5]) : 0 },
        );
      }
      return { name: c.name, icon: c.icon, opts: rng.shuffle(opts) };
    });
    const target = items.reduce((s, it) => s + cost(bestOf(it, params.unit)), 0);
    return { items, budget: Math.ceil((target * 1.1) / 5) * 5 };
  }, [seed, params.items, params.unit, params.coupons]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);
  const total = items.reduce((s, it) => (cart[it.name] !== undefined ? s + it.opts[cart[it.name]].price - it.opts[cart[it.name]].coupon : s), 0);
  const best = items.reduce((s, it) => s + cost(bestOf(it, params.unit)), 0);
  const complete = items.every((it) => cart[it.name] !== undefined);

  const checkout = () => {
    setDone(true);
    const under = total <= budget + 0.001;
    playSfx(under ? 'cash' : 'wrong');
    for (const it of items) {
      const chosen = it.opts[cart[it.name]];
      const bestOpt = bestOf(it, params.unit);
      const ok = chosen === bestOpt;
      act((d, fx) => recordAnswer(d, fx, { id: `grocery:${it.name}`, topic: 'shopping' }, ok));
      addReview?.({
        q: `${it.icon} ${it.name}`,
        ok,
        answer: `${bestOpt.label}: ${money(bestOpt.price - bestOpt.coupon)}${params.unit ? ` (${money((bestOpt.price - bestOpt.coupon) / bestOpt.qty)}/${bestOpt.unit})` : ''}`,
        explanation: params.unit ? 'Compare the price per unit (price ÷ quantity). Bigger packs are often cheaper per unit, if you will use it all.' : 'Same amount, lower price = better deal.',
      });
    }
  };

  if (done) {
    const under = total <= budget + 0.001;
    const hits = items.filter((it) => it.opts[cart[it.name]] === bestOf(it, params.unit)).length;
    const score = under ? Math.min(100, 40 + 60 * (hits / items.length)) : 25;
    return (
      <div className="col" style={{ gap: 10 }}>
        <div className={`card ${under ? 'tint-green' : 'tint-red'}`}>
          <b>{under ? `Under budget! You spent ${money(total)} of ${money(budget)}.` : `Over budget by ${money(total - budget)}!`}</b> The best-value cart cost {money(best)}{params.unit ? ' (lowest price per unit)' : ''}.
        </div>
        <Button variant="primary" size="big" onClick={() => onFinish({ score })}>
          See my stars
        </Button>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between wrap">
        <b>
          🧾 Budget: {money(budget)} <ReadAloud text={`Your budget is ${money(budget)}. Buy one of each item on the list.`} />
        </b>
        <b className={total > budget ? 'bad' : 'good'}>Cart: {money(total)}</b>
      </div>
      <div className="col" style={{ gap: 8 }}>
        {items.map((it) => (
          <div key={it.name} className="card flat">
            <b>
              {it.icon} {it.name}
            </b>
            <div className="row wrap" style={{ gap: 6, marginTop: 4 }}>
              {it.opts.map((o, k) => (
                <button key={k} className={`shop-opt ${cart[it.name] === k ? 'on' : ''}`} onClick={() => (playSfx('pop'), setCart({ ...cart, [it.name]: k }))}>
                  <b>{o.label}</b>
                  <span className="small">
                    {o.qty} {o.unit}s
                  </span>
                  <span className="mono bold">{money(o.price)}</span>
                  {o.coupon > 0 && <span className="chip gold tiny">🎟️ coupon −{money(o.coupon)}</span>}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Button variant="gold" size="big" disabled={!complete} onClick={checkout}>
        {complete ? 'Checkout 🛒' : 'Pick something for every item'}
      </Button>
    </div>
  );
}

const cost = (o: Opt) => o.price - o.coupon;
/** Best value: lowest total price (same sizes) or lowest price per unit (Advanced). */
function bestOf(it: Item, unit: boolean): Opt {
  return [...it.opts].sort((a, b) => (unit ? cost(a) / a.qty - cost(b) / b.qty : cost(a) - cost(b)))[0];
}

function round(x: number) {
  return Math.round(x * 4) / 4 + 0.24;
}
