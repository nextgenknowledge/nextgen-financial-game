'use client';
/**
 * Commodities Exchange (Advanced). Build an inflation number from a price basket, read a supply
 * shock through price elasticity, tell contango from backwardation, and turn nominal returns real.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';
import { Bars, C, LineChart, Table, pc } from './pro/kit';

export default function Commodities({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 19 + 4);
    const r = () => rng.next();
    const out: VisualItem[] = [];

    const basket = [
      { k: 'Food', w: 0.15, ch: rng.pick([0.04, 0.06, 0.08]) },
      { k: 'Energy', w: 0.08, ch: rng.pick([-0.05, 0.1, 0.18]) },
      { k: 'Housing', w: 0.35, ch: rng.pick([0.03, 0.05]) },
      { k: 'Transport', w: 0.12, ch: rng.pick([0.02, 0.04]) },
      { k: 'Everything else', w: 0.3, ch: rng.pick([0.01, 0.02, 0.03]) },
    ];
    const cpi = basket.reduce((s, b) => s + b.w * b.ch, 0);
    out.push({
      brief: 'The statistics office weights each category by how much households spend on it. This year’s price changes:',
      visual: <Table head={['Category', 'Weight', 'Price change']} rows={basket.map((b) => [b.k, pc(b.w, 0), pc(b.ch)])} />,
      q: rq({ id: 'cm-cpi', topic: 'economics', type: 'numeric', format: 'pct', value: Math.round(cpi * 10000) / 100, tolAbs: 0.05, tolRel: 0, prompt: 'What is the inflation rate for this basket?', hint: 'Multiply each weight by its price change and add them up.', explanation: `Σ weight × change = ${pc(cpi, 2)}. ${basket[1].ch > 0.09 ? 'Energy moved a lot but only has an 8% weight, so its effect is muted.' : 'Housing has the biggest weight, so it drives the result.'}` }),
    });

    const cut = rng.pick([0.04, 0.05, 0.06]);
    const elast = rng.pick([0.1, 0.15, 0.2]);
    const rise = cut / elast;
    out.push({
      brief: `A drought cuts the world wheat harvest by ${pc(cut, 0)}. People need bread whatever it costs, so demand is very inelastic: price elasticity of ${elast.toFixed(2)}.`,
      visual: <Bars items={[{ label: 'Supply change', value: -cut * 100, color: C.red }, { label: 'Price change', value: rise * 100, color: C.gold }]} fmt={(v) => `${v.toFixed(0)}%`} />,
      q: rq({ id: 'cm-elastic', topic: 'economics', type: 'numeric', format: 'pct', value: Math.round(rise * 1000) / 10, tolAbs: 1, tolRel: 0, prompt: 'Roughly how far must the price rise to bring demand down to the smaller supply?', hint: '% change in price ≈ % change in quantity ÷ elasticity.', explanation: `${pc(cut, 0)} ÷ ${elast} ≈ ${pc(rise, 0)}. A small supply shock in an inelastic market causes a huge price swing, which is why food and energy prices are so volatile.` }),
    });

    const contango = rng.chance(0.5);
    const spot = rng.pick([72, 78, 84]);
    const curve: number[] = [0, 1, 2, 3, 4, 5, 6].map((m) => spot * (1 + (contango ? 0.008 : -0.012) * m));
    const s3 = shuffled(['Contango: later months cost more, covering storage and financing', 'Backwardation: oil for delivery now costs more, so supply is tight', 'A flat curve: no information'], contango ? 0 : 1, r);
    out.push({
      brief: 'Oil futures prices for delivery over the next six months:',
      visual: <LineChart series={[{ pts: curve, color: C.gold, label: 'Futures price ($/barrel)' }]} fmt={(v) => `$${v.toFixed(0)}`} xLabel="Months to delivery →" />,
      q: rq({ id: 'cm-curve', topic: 'investing', prompt: 'What shape is this curve, and what does it say?', ...s3, explanation: contango ? 'Upward sloping is contango. Investors who keep rolling futures in contango lose a little every month ("negative roll yield"), so an oil fund can lag the oil price.' : 'Downward sloping is backwardation: oil today is scarce enough that buyers pay a premium over future delivery.' }),
    });

    const nominal = rng.pick([0.05, 0.06, 0.07]);
    const infl = Math.max(0.02, Math.round(cpi * 1000) / 1000);
    const real = (1 + nominal) / (1 + infl) - 1;
    out.push({
      brief: `A savings bond pays ${pc(nominal, 0)} a year while inflation runs at ${pc(infl)}.`,
      visual: <Bars items={[{ label: 'Nominal return', value: nominal * 100, color: C.blue }, { label: 'Inflation', value: infl * 100, color: C.red }]} fmt={(v) => `${v.toFixed(1)}%`} />,
      q: rq({ id: 'cm-real', topic: 'economics', type: 'numeric', format: 'pct', value: Math.round(real * 10000) / 100, tolAbs: 0.1, tolRel: 0, prompt: 'What is the real return?', hint: '(1 + nominal) ÷ (1 + inflation) − 1', explanation: `(1 + ${nominal}) ÷ (1 + ${infl.toFixed(3)}) − 1 = ${pc(real, 2)}. The shortcut "nominal − inflation" gives ${pc(nominal - infl, 2)}, close when rates are low.` }),
    });

    const s5 = shuffled(['Commodities and inflation-linked bonds', 'Long-term fixed-rate bonds', 'Cash under the mattress', 'A 30-year fixed-rate loan you lent to a friend'], 0, r);
    out.push({
      brief: 'A pension fund worries inflation will stay high for years.',
      visual: <Bars items={[{ label: 'Commodities in 1970s inflation', value: 13, color: C.green }, { label: 'Long bonds in 1970s inflation', value: -2, color: C.red }]} fmt={(v) => `${v}% real/yr`} />,
      q: rq({ id: 'cm-hedge', topic: 'investing', prompt: 'Which assets tend to protect against unexpected inflation?', ...s5, explanation: 'Commodity prices are part of inflation, and inflation-linked bonds (TIPS, index-linked gilts) raise their payments with prices. Fixed payments, like a long bond or a fixed loan you made, lose real value.' }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Commodities exchange · Prices & inflation" onFinish={onFinish} addReview={addReview} />;
}
