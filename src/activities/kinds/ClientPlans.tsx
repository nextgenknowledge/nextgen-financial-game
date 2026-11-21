'use client';
/**
 * Wealth Advisory: Client Plans (Advanced). Three clients with different goals, horizons and
 * nerves. Build each an allocation that meets their required return, their worst-year limit and
 * any cash they need on hand, as efficiently as possible.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { portfolioStats, type Asset } from '@/game/finance/pro';
import { C, ProHead, Slider, Stats, Table, Verdict, pc } from './pro/kit';
import { variantIndex } from '../variant';

const RF = 0.03;
const ASSETS: Asset[] = [
  { name: 'Cash', ret: 0.03, vol: 0.005 },
  { name: 'Bonds', ret: 0.045, vol: 0.06 },
  { name: 'Global shares', ret: 0.08, vol: 0.16 },
  { name: 'Property', ret: 0.065, vol: 0.12 },
];
const CORR = [
  [1, 0.1, 0, 0.05],
  [0.1, 1, 0.1, 0.25],
  [0, 0.1, 1, 0.55],
  [0.05, 0.25, 0.55, 1],
];
const COLORS = [C.grey, C.blue, C.green, C.gold];

interface Client {
  name: string;
  story: string;
  minRet: number;
  worst: number; // worst plausible year (return − 1.65 × volatility) must be above this
  minCash: number;
}

// Three kinds of client: money needed soon, money for decades, and money to live on. Each run
// meets one client of each kind, drawn from four.
const CLIENT_POOLS: Client[][] = [
  [
    { name: 'Maya, 26', story: 'Saving a £50,000 house deposit she will spend in 5 years. Losing a big chunk the year before she buys would be a disaster.', minRet: 0.035, worst: -0.08, minCash: 0 },
    { name: 'Theo, 31', story: 'Paying for his wedding in 3 years. He wants a little growth, but a bad year of more than 3% would mean cutting the guest list.', minRet: 0.03, worst: -0.03, minCash: 0 },
    { name: 'Priya, 34', story: 'Has $30,000 to open a bakery in 4 years. She needs 4% a year to afford the oven and can live with a 7% dip at worst.', minRet: 0.04, worst: -0.07, minCash: 0 },
    { name: 'Sam, 19', story: 'University fees of €20,000 are due in 2 years. Any real loss means borrowing more, so the worst year must stay above −2%.', minRet: 0.03, worst: -0.02, minCash: 0 },
  ],
  [
    { name: 'Daniel, 45', story: 'Retiring in 20 years. Needs strong growth to hit his target and can sit through bad years.', minRet: 0.065, worst: -0.25, minCash: 0 },
    { name: 'Aisha, 30', story: 'Retiring in 35 years and wants as much growth as possible. She has said she could live through a 25% fall without selling.', minRet: 0.072, worst: -0.25, minCash: 0 },
    { name: 'Ken, 50', story: 'Fifteen years from retirement. He needs 6% a year and would lose sleep over a year worse than −20%.', minRet: 0.06, worst: -0.2, minCash: 0 },
    { name: 'Lucía, 38', story: 'Investing for her two children, who will need the money in about 20 years. She needs 6.8% a year to reach her goal.', minRet: 0.068, worst: -0.24, minCash: 0 },
  ],
  [
    { name: 'Margaret, 70', story: 'Retired, living on 4% a year from her portfolio. Needs income that keeps up with inflation and a cash buffer so she never sells in a crash.', minRet: 0.045, worst: -0.12, minCash: 0.1 },
    { name: 'George, 67', story: 'Just retired. He wants 4.5% a year and keeps two years of spending, 20% of the portfolio, in cash so a crash never forces a sale.', minRet: 0.045, worst: -0.12, minCash: 0.2 },
    { name: 'Rosa, 78', story: 'Lives on her pension plus 4% a year from savings. At her age she cannot wait out a long slump, so the worst year must stay above −8%.', minRet: 0.04, worst: -0.08, minCash: 0.1 },
    { name: 'Walt, 64', story: 'Retiring next year with a long life expected. He needs 5% a year, keeps 5% in cash and can handle a −14% year at worst.', minRet: 0.05, worst: -0.14, minCash: 0.05 },
  ],
];
const EXPLAIN = [
  'Short horizon: the money must be there on the day. Mostly bonds and cash, with a little growth.',
  'Long horizon: time lets you ride out falls, so most of the money can be in shares and property.',
  'Retirees need growth to beat inflation for decades, plus a cash bucket so they never sell shares at the bottom.',
];

const worstYear = (s: { ret: number; vol: number }) => s.ret - 1.65 * s.vol;

function feasible(c: Client, w: number[]) {
  const s = portfolioStats(ASSETS, CORR, w, RF);
  return { s, ok: [s.ret >= c.minRet - 1e-9, worstYear(s) >= c.worst - 1e-9, w[0] >= c.minCash - 1e-9] };
}

function bestFor(c: Client) {
  let best = { w: [0.25, 0.25, 0.25, 0.25], sharpe: -9 };
  for (let a = 0; a <= 100; a += 5)
    for (let b = 0; b <= 100 - a; b += 5)
      for (let d = 0; d <= 100 - a - b; d += 5) {
        const w = [a, b, d, 100 - a - b - d].map((x) => x / 100);
        const f = feasible(c, w);
        if (f.ok.every(Boolean) && f.s.sharpe > best.sharpe) best = { w, sharpe: f.s.sharpe };
      }
  return best;
}

export default function ClientPlans({ seed, onFinish, addReview }: KindProps) {
  const CLIENTS = useMemo(() => CLIENT_POOLS.map((pool, g) => pool[variantIndex(`clients-${g}`, pool.length, seed + g * 7)]), [seed]);
  const [k, setK] = useState(0);
  const c = CLIENTS[k];
  const [w, setW] = useState([25, 25, 25, 25]);
  const [done, setDone] = useState<null | { score: number; best: ReturnType<typeof bestFor> }>(null);
  const [scores, setScores] = useState<number[]>([]);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const weights = w.map((x) => x / sum);
  const f = feasible(c, weights);
  const best = useMemo(() => bestFor(c), [c]);

  const submit = () => {
    const met = f.ok.filter(Boolean).length;
    const score = met === 3 ? 0.6 + 0.4 * Math.max(0, Math.min(1, f.s.sharpe / best.sharpe)) : (met / 3) * 0.35;
    setDone({ score, best });
    setScores((s) => [...s, score]);
    playSfx(score > 0.9 ? 'correct' : score > 0.6 ? 'star' : 'wrong');
    addReview?.({
      q: `${c.name}: ${c.story}`,
      ok: score > 0.85,
      answer: best.w.map((x, i) => `${ASSETS[i].name} ${Math.round(x * 100)}%`).join(', '),
      explanation: EXPLAIN[k],
    });
  };
  const next = () => {
    if (k + 1 >= CLIENTS.length) {
      const all = scores;
      onFinish({ score: (all.reduce((a, b) => a + b, 0) / all.length) * 100, summary: `Average client fit ${Math.round((all.reduce((a, b) => a + b, 0) / all.length) * 100)}%.` });
      return;
    }
    setK(k + 1);
    setW([25, 25, 25, 25]);
    setDone(null);
  };

  return (
    <div className="pro">
      <ProHead kicker={`Wealth advisory · Client ${k + 1} of ${CLIENTS.length}`} title={c.name} sub={c.story} right={<div className="pro-price"><span className="pro-kicker">Sharpe</span><b>{f.s.sharpe.toFixed(2)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Allocation</h4>
          {ASSETS.map((a, i) => (
            <Slider key={a.name} label={a.name} color={COLORS[i]} value={w[i]} min={0} max={100} step={5} onChange={(v) => setW(w.map((x, j) => (j === i ? v : x)))} show={`${Math.round(weights[i] * 100)}%`} disabled={!!done} />
          ))}
          <Table compact head={['Asset', 'Expected return', 'Volatility']} rows={ASSETS.map((a) => [a.name, pc(a.ret), pc(a.vol)])} />
        </section>
        <section className="pro-panel">
          <h4>Does it fit the client?</h4>
          <Stats items={[['Expected return', pc(f.s.ret), f.ok[0] ? 'good' : 'bad'], ['Bad year (1 in 20)', pc(worstYear(f.s)), f.ok[1] ? 'good' : 'bad'], ['Cash', pc(weights[0], 0), f.ok[2] ? 'good' : 'bad']]} />
          <Table
            compact
            head={['Requirement', 'Target', '']}
            rows={[
              ['Expected return at least', pc(c.minRet), f.ok[0] ? '✓' : '✕'],
              ['A 1-in-20 bad year no worse than', pc(c.worst, 0), f.ok[1] ? '✓' : '✕'],
              ['Cash at least', pc(c.minCash, 0), f.ok[2] ? '✓' : '✕'],
            ]}
          />
          {done && (
            <Verdict ok={done.score > 0.85} title={`Fit ${Math.round(done.score * 100)}%`}>
              Most efficient plan: {done.best.w.map((x, i) => `${ASSETS[i].name} ${Math.round(x * 100)}%`).join(' · ')} (Sharpe {done.best.sharpe.toFixed(2)}).
            </Verdict>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {!done ? (
              <Button variant="gold" size="big" onClick={submit}>
                Recommend this plan
              </Button>
            ) : (
              <Button variant="primary" size="big" onClick={next}>
                {k + 1 >= CLIENTS.length ? 'See results ▶' : 'Next client ▶'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
