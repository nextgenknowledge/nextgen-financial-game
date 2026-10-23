'use client';
/**
 * Venture Round (Advanced). Follow a startup from founding to exit: price a seed and a Series A,
 * watch the cap table dilute, then work out who gets what when it sells, including the 1x
 * liquidation preference that protects investors in a small exit.
 */
import { useMemo } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { exitPayouts, ownership, priceRound, type Holder } from '@/game/finance/pro';
import { VisualQuiz, rq, shuffled, type VisualItem } from './VisualQuiz';

const COLORS: Record<string, string> = { Founders: '#22d38f', 'Option pool': '#8ea0c2', Seed: '#4fb3ff', 'Series A': '#ffd25a' };
const m = (v: number) => `$${(v / 1e6).toLocaleString('en-US', { maximumFractionDigits: 2 })}M`;

function CapTable({ table, title }: { table: Holder[]; title: string }) {
  const total = table.reduce((s, h) => s + h.shares, 0);
  return (
    <div className="col" style={{ gap: 8 }}>
      <h4 style={{ margin: 0 }}>{title}</h4>
      <div className="cap-bar">
        {table.map((h) => (
          <span key={h.name} style={{ width: `${(h.shares / total) * 100}%`, background: COLORS[h.name] ?? '#c77dff' }} title={h.name} />
        ))}
      </div>
      <table className="pro-table">
        <thead>
          <tr>
            <th>Holder</th>
            <th>Shares</th>
            <th>Ownership</th>
            <th>Invested</th>
          </tr>
        </thead>
        <tbody>
          {table.map((h) => (
            <tr key={h.name}>
              <td>
                <i className="dot" style={{ background: COLORS[h.name] ?? '#c77dff' }} /> {h.name}
              </td>
              <td>{Math.round(h.shares).toLocaleString()}</td>
              <td>{((h.shares / total) * 100).toFixed(1)}%</td>
              <td>{h.invested ? m(h.invested) : '·'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VentureRound({ onFinish, addReview, seed }: KindProps) {
  const items = useMemo<VisualItem[]>(() => {
    const rng = makeRng(seed * 17 + 3);
    const r = () => rng.next();
    const name = rng.pick(['PocketLedger', 'GreenRoute', 'Tutorly', 'ByteBistro', 'Skyline Labs']);
    const founders: Holder[] = [
      { name: 'Founders', shares: 9_000_000 },
      { name: 'Option pool', shares: 1_000_000 },
    ];
    const seedInv = rng.pick([1, 1.5, 2]) * 1e6;
    const seedPre = rng.pick([6, 8, 9]) * 1e6;
    const s1 = priceRound(founders, 'Seed', seedInv, seedPre);
    const aInv = rng.pick([6, 8, 10]) * 1e6;
    const aPre = rng.pick([24, 30, 36]) * 1e6;
    const s2 = priceRound(s1.table, 'Series A', aInv, aPre);
    const smallExit = Math.round((aInv + seedInv) * rng.range(1.1, 1.4) / 1e5) * 1e5;
    const bigExit = rng.pick([120, 150, 200]) * 1e6;
    const pSmall = exitPayouts(s2.table, smallExit);
    const pBig = exitPayouts(s2.table, bigExit);
    const out: VisualItem[] = [];
    out.push({
      brief: `${name} has 10,000,000 shares: founders hold 9M and 1M are set aside for future employees. A seed fund invests ${m(seedInv)} at a ${m(seedPre)} pre-money valuation.`,
      visual: <CapTable table={founders} title="Cap table before the seed round" />,
      q: rq({ id: 'vc-post', topic: 'business', type: 'numeric', format: 'money', value: s1.postMoney, tolRel: 0.001, prompt: 'What is the post-money valuation?', explanation: `Post-money = pre-money + new money = ${m(seedPre)} + ${m(seedInv)} = ${m(s1.postMoney)}.` }),
    });
    out.push({
      brief: `The seed round prices shares at $${s1.price.toFixed(2)} each (pre-money ÷ shares before).`,
      visual: <CapTable table={s1.table} title="After the seed round" />,
      q: rq({ id: 'vc-seedpct', topic: 'business', type: 'numeric', format: 'pct', value: Math.round(ownership(s1.table, 'Seed') * 10000) / 100, tolAbs: 0.15, tolRel: 0, prompt: 'What percentage of the company does the seed fund now own?', hint: 'Investment ÷ post-money valuation.', explanation: `${m(seedInv)} ÷ ${m(s1.postMoney)} = ${(ownership(s1.table, 'Seed') * 100).toFixed(1)}%. Everyone else was diluted by the same factor.` }),
    });
    out.push({
      brief: `A year later, a Series A investor puts in ${m(aInv)} at a ${m(aPre)} pre-money valuation.`,
      visual: <CapTable table={s2.table} title="After the Series A" />,
      q: rq({ id: 'vc-founders', topic: 'business', type: 'numeric', format: 'pct', value: Math.round(ownership(s2.table, 'Founders') * 10000) / 100, tolAbs: 0.2, tolRel: 0, prompt: 'What do the founders own now?', explanation: `Founders went 90% → ${(ownership(s1.table, 'Founders') * 100).toFixed(1)}% → ${(ownership(s2.table, 'Founders') * 100).toFixed(1)}%. A smaller slice of a much bigger pie: their stake is now worth ${m(ownership(s2.table, 'Founders') * (aPre + aInv))} on paper.` }),
    });
    const sBig = shuffled([`About ${m(pBig.Founders)}`, `About ${m(bigExit * 0.9)}`, `About ${m(pBig.Founders * 0.6)}`, `About ${m(bigExit - aInv - seedInv)}`], 0, r);
    out.push({
      brief: `Great news: ${name} is bought for ${m(bigExit)}. Investors hold 1x non-participating preferred stock.`,
      visual: <CapTable table={s2.table} title="Cap table at exit" />,
      q: rq({ id: 'vc-big', topic: 'business', prompt: 'How much do the founders receive?', ...sBig, explanation: `At this price every investor does better converting to common, so everyone is paid by ownership: founders get ${(ownership(s2.table, 'Founders') * 100).toFixed(1)}% × ${m(bigExit)} ≈ ${m(pBig.Founders)}.` }),
    });
    out.push({
      brief: `Alternative ending: the company sells for only ${m(smallExit)}.`,
      visual: <CapTable table={s2.table} title="Cap table at exit" />,
      q: rq({ id: 'vc-small', topic: 'business', type: 'numeric', format: 'money', value: Math.round(pSmall.Founders / 1000) * 1000, tolRel: 0.03, prompt: 'With the 1x liquidation preference, how much do the founders receive?', hint: 'Investors who would get less by converting take their money back first. The rest is shared by common holders.', explanation: `Series A takes its ${m(aInv)} first${pSmall.Seed && Math.abs(pSmall.Seed - seedInv) < 1 ? ` and the seed fund its ${m(seedInv)}` : ''}, leaving the rest for common shareholders. Founders get about ${m(pSmall.Founders)}, far less than their ownership share suggests. That is what a preference is for.` }),
    });
    return out;
  }, [seed]);
  return <VisualQuiz items={items} kicker="Venture round · Startup finance" onFinish={onFinish} addReview={addReview} />;
}
