'use client';
/**
 * Bond Desk (Advanced). Price bonds, read premium vs discount, use duration to estimate price
 * moves, read the yield curve and credit spreads. Every question comes with a live price-yield
 * curve for the bond on the screen.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { bondPrice, modifiedDuration } from '@/game/finance/pro';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';

interface Bond {
  coupon: number;
  years: number;
  ytm: number;
}

const pc = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;

function PriceYield({ bonds, mark }: { bonds: (Bond & { label: string; color: string })[]; mark?: number }) {
  const ys = Array.from({ length: 41 }, (_, i) => 0.005 + i * 0.0025);
  const prices = bonds.flatMap((b) => ys.map((y) => bondPrice(1000, b.coupon, b.years, y)));
  const lo = Math.min(...prices) * 0.95;
  const hi = Math.max(...prices) * 1.03;
  const X = (y: number) => 46 + ((y - 0.005) / 0.1) * 320;
  const Y = (p: number) => 200 - ((p - lo) / (hi - lo)) * 180;
  return (
    <svg viewBox="0 0 390 230" className="pro-chart">
      <line x1="46" y1="200" x2="380" y2="200" stroke="#2a3b5e" />
      <line x1="46" y1="16" x2="46" y2="200" stroke="#2a3b5e" />
      {[0.02, 0.04, 0.06, 0.08, 0.1].map((y) => (
        <text key={y} x={X(y)} y="216" fontSize="10" fill="#8ea0c2" textAnchor="middle">
          {pc(y, 0)}
        </text>
      ))}
      <text x="210" y="229" fontSize="10" fill="#8ea0c2" textAnchor="middle">
        Yield to maturity →
      </text>
      <line x1="46" x2="380" y1={Y(1000)} y2={Y(1000)} stroke="#ffd25a" strokeDasharray="3 4" opacity="0.6" />
      <text x="378" y={Y(1000) - 4} fontSize="10" fill="#ffd25a" textAnchor="end">
        par $1,000
      </text>
      {bonds.map((b) => (
        <g key={b.label}>
          <polyline fill="none" stroke={b.color} strokeWidth="2.5" points={ys.map((y) => `${X(y)},${Y(bondPrice(1000, b.coupon, b.years, y))}`).join(' ')} />
          <text x={X(0.006)} y={Y(bondPrice(1000, b.coupon, b.years, 0.006)) - 6} fontSize="10" fill={b.color}>
            {b.label}
          </text>
          {mark !== undefined && <circle cx={X(mark)} cy={Y(bondPrice(1000, b.coupon, b.years, mark))} r="4.5" fill="#fff" stroke={b.color} strokeWidth="2" />}
        </g>
      ))}
    </svg>
  );
}

function YieldCurve({ pts }: { pts: [string, number][] }) {
  const X = (i: number) => 50 + (i / (pts.length - 1)) * 310;
  const max = Math.max(...pts.map((p) => p[1])) * 1.2;
  const Y = (v: number) => 190 - (v / max) * 170;
  return (
    <svg viewBox="0 0 390 220" className="pro-chart">
      <line x1="40" y1="190" x2="380" y2="190" stroke="#2a3b5e" />
      <polyline fill="none" stroke="#4fb3ff" strokeWidth="3" points={pts.map((p, i) => `${X(i)},${Y(p[1])}`).join(' ')} />
      {pts.map((p, i) => (
        <g key={p[0]}>
          <circle cx={X(i)} cy={Y(p[1])} r="4" fill="#4fb3ff" />
          <text x={X(i)} y={Y(p[1]) - 9} fontSize="10" fill="#dbe5f5" textAnchor="middle">
            {pc(p[1])}
          </text>
          <text x={X(i)} y="208" fontSize="10" fill="#8ea0c2" textAnchor="middle">
            {p[0]}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function BondDesk({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 13 + 5);
    const r = () => rng.next();
    const out: VisualItem[] = [];
    // 1. Price a bond
    const b1: Bond = { coupon: rng.pick([0.03, 0.04, 0.05, 0.06]), years: rng.pick([3, 5, 7]), ytm: rng.pick([0.035, 0.045, 0.055, 0.065]) };
    const p1 = bondPrice(1000, b1.coupon, b1.years, b1.ytm);
    out.push({
      brief: `A ${b1.years}-year bond pays a ${pc(b1.coupon, 0)} annual coupon on $1,000 face value. The market yield (YTM) is ${pc(b1.ytm, 1)}.`,
      visual: <PriceYield bonds={[{ ...b1, label: `${pc(b1.coupon, 0)} ${b1.years}y`, color: '#22d38f' }]} mark={b1.ytm} />,
      q: rq({
        id: 'bond-price',
        topic: 'investing',
        type: 'numeric',
        format: 'money',
        value: Math.round(p1 * 100) / 100,
        tolRel: 0.004,
        prompt: 'What is the bond’s price today?',
        hint: 'Discount each coupon and the $1,000 at the end by (1 + YTM)^t, then add them up.',
        explanation: `Price = Σ coupon ÷ (1+y)^t + 1000 ÷ (1+y)^${b1.years} = $${p1.toFixed(2)}. ${b1.coupon > b1.ytm ? 'Coupon above yield → premium (above par).' : b1.coupon < b1.ytm ? 'Coupon below yield → discount (below par).' : 'Coupon equals yield → par.'}`,
      }),
    });
    // 2. Premium / discount
    const b2: Bond = { coupon: rng.pick([0.02, 0.07]), years: 10, ytm: 0.045 };
    const prem = b2.coupon > b2.ytm;
    const s2 = shuffled(['At a premium (above $1,000)', 'At a discount (below $1,000)', 'Exactly at par ($1,000)'], prem ? 0 : 1, r);
    out.push({
      brief: `A 10-year bond pays a ${pc(b2.coupon, 0)} coupon. Similar bonds now yield ${pc(b2.ytm, 1)}.`,
      visual: <PriceYield bonds={[{ ...b2, label: `${pc(b2.coupon, 0)} 10y`, color: '#ffd25a' }]} mark={b2.ytm} />,
      q: rq({ id: 'bond-prem', topic: 'investing', prompt: 'How does this bond trade?', ...s2, explanation: `When a bond’s coupon is ${prem ? 'higher' : 'lower'} than market yields, buyers pay ${prem ? 'more' : 'less'} than face value, so it trades at a ${prem ? 'premium' : 'discount'}.` }),
    });
    // 3. Duration: which falls more
    const longZ: Bond = { coupon: 0, years: 20, ytm: 0.045 };
    const shortC: Bond = { coupon: 0.06, years: 4, ytm: 0.045 };
    const d1 = modifiedDuration(1000, 0, 20, 0.045);
    const d2 = modifiedDuration(1000, 0.06, 4, 0.045);
    const s3 = shuffled(['The 20-year zero-coupon bond', 'The 4-year 6% bond', 'They fall by the same amount'], 0, r);
    out.push({
      brief: 'Rates are about to jump by 1 percentage point across the board.',
      visual: (
        <PriceYield
          bonds={[
            { ...longZ, label: '20y zero', color: '#ff8a7a' },
            { ...shortC, label: '6% 4y', color: '#4fb3ff' },
          ]}
          mark={0.045}
        />
      ),
      q: rq({ id: 'bond-dur', topic: 'investing', prompt: 'Which bond loses the most value (in %)?', ...s3, explanation: `Duration measures rate sensitivity. The zero has modified duration ${d1.toFixed(1)} vs ${d2.toFixed(1)}: long maturity and no coupons mean all the money arrives far in the future. Note the steeper curve.` }),
    });
    // 4. Duration estimate
    const md = modifiedDuration(1000, 0.05, 8, 0.05);
    const dy = rng.pick([0.005, 0.0075, 0.01]);
    const est = -md * dy * 100;
    out.push({
      brief: `An 8-year 5% bond trades at par. Its modified duration is ${md.toFixed(2)}.`,
      visual: <PriceYield bonds={[{ coupon: 0.05, years: 8, ytm: 0.05, label: '5% 8y', color: '#22d38f' }]} mark={0.05} />,
      q: rq({
        id: 'bond-est',
        topic: 'investing',
        type: 'numeric',
        format: 'pct',
        value: Math.round(est * 100) / 100,
        tolAbs: 0.06,
        tolRel: 0.02,
        prompt: `Using duration, estimate the % price change if yields rise by ${(dy * 100).toFixed(2)} points.`,
        hint: '%ΔP ≈ −modified duration × Δyield',
        explanation: `%ΔP ≈ −${md.toFixed(2)} × ${(dy * 100).toFixed(2)}% = ${est.toFixed(2)}%. The true change is a little smaller because of convexity (the curve bends).`,
      }),
    });
    // 5. Yield curve
    const inverted = rng.chance(0.5);
    const curve: [string, number][] = inverted
      ? [['3m', 0.052], ['2y', 0.049], ['5y', 0.044], ['10y', 0.041], ['30y', 0.042]]
      : [['3m', 0.031], ['2y', 0.035], ['5y', 0.039], ['10y', 0.043], ['30y', 0.046]];
    const s5 = shuffled(['Inverted: markets expect rate cuts, often a recession warning', 'Normal: investors want more yield to lock money up longer', 'Flat: no information at all'], inverted ? 0 : 1, r);
    out.push({
      brief: 'Here is today’s government yield curve.',
      visual: <YieldCurve pts={curve} />,
      q: rq({ id: 'bond-curve', topic: 'economics', prompt: 'How would you read this curve?', ...s5, explanation: inverted ? 'Short rates above long rates is an inverted curve. It has come before most US recessions because markets expect the central bank to cut later.' : 'Upward slope is normal: lending for longer usually earns more (a term premium) and expects steady growth.' }),
    });
    // 6. Credit spread
    const tsy = rng.pick([0.038, 0.042, 0.045]);
    const corp = tsy + rng.pick([0.009, 0.014, 0.021]);
    const junk = tsy + rng.pick([0.038, 0.045, 0.052]);
    out.push({
      brief: `10-year yields: Treasury ${pc(tsy)}, A-rated corporate ${pc(corp)}, high-yield ("junk") ${pc(junk)}.`,
      visual: <YieldCurve pts={[['Treasury', tsy], ['A corp', corp], ['High yield', junk]]} />,
      q: rq({
        id: 'bond-spread',
        topic: 'investing',
        type: 'numeric',
        format: 'pct',
        value: Math.round((junk - tsy) * 10000) / 100,
        tolAbs: 0.02,
        tolRel: 0,
        prompt: 'What is the high-yield credit spread over Treasuries (in percentage points)?',
        explanation: `Spread = ${pc(junk)} − ${pc(tsy)} = ${((junk - tsy) * 100).toFixed(2)} points. That extra yield pays investors for default risk; it widens when the economy looks shaky.`,
      }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Bond desk · Fixed income" onFinish={onFinish} addReview={addReview} />;
}
