'use client';
/**
 * Portfolio Lab (Advanced). Four assets with expected returns, volatilities and correlations. Set
 * the weights and watch your portfolio move on the risk / return chart among hundreds of possible
 * portfolios. Three challenges: best Sharpe ratio, lowest risk, and a target return for the least
 * risk. Scored against the true optimum, so diversification maths pays off.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { makeRng } from '@/game/rng';
import { bestPortfolio, portfolioStats, type Asset } from '@/game/finance/pro';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';

const RF = 0.03;
const COLORS = ['#4fb3ff', '#22d38f', '#ffd25a', '#ff8a7a'];

type Challenge = { id: 'sharpe' | 'minvol' | 'target'; title: string; brief: string; target?: number };

function universe(seed: number, round: number) {
  const rng = makeRng(seed * 7 + round * 101);
  const sets: Asset[][] = [
    [
      { name: 'US stocks', ret: 0.085, vol: 0.17 },
      { name: 'World stocks', ret: 0.08, vol: 0.19 },
      { name: 'Govt bonds', ret: 0.04, vol: 0.06 },
      { name: 'Gold', ret: 0.05, vol: 0.15 },
    ],
    [
      { name: 'Tech stocks', ret: 0.11, vol: 0.26 },
      { name: 'Value stocks', ret: 0.075, vol: 0.16 },
      { name: 'Corporate bonds', ret: 0.05, vol: 0.08 },
      { name: 'Real estate', ret: 0.065, vol: 0.18 },
    ],
    [
      { name: 'Emerging mkts', ret: 0.1, vol: 0.24 },
      { name: 'Small caps', ret: 0.09, vol: 0.22 },
      { name: 'TIPS', ret: 0.035, vol: 0.05 },
      { name: 'Commodities', ret: 0.055, vol: 0.2 },
    ],
  ];
  const assets = sets[(seed + round) % sets.length].map((a) => ({ ...a, ret: a.ret + rng.range(-0.008, 0.008) }));
  const c = (lo: number, hi: number) => Math.round(rng.range(lo, hi) * 100) / 100;
  // Stocks move together, bonds less so, the last asset is a diversifier
  const r01 = c(0.6, 0.85);
  const r02 = c(-0.2, 0.2);
  const r03 = c(-0.1, 0.25);
  const r12 = c(-0.15, 0.25);
  const r13 = c(-0.1, 0.25);
  const r23 = c(-0.1, 0.3);
  const corr = [
    [1, r01, r02, r03],
    [r01, 1, r12, r13],
    [r02, r12, 1, r23],
    [r03, r13, r23, 1],
  ];
  return { assets, corr };
}

const CHALLENGES: Challenge[] = [
  { id: 'sharpe', title: 'Best risk-adjusted return', brief: 'Build the portfolio with the highest Sharpe ratio: (return − 3% risk-free) ÷ volatility.' },
  { id: 'minvol', title: 'Lowest risk', brief: 'Build the least volatile portfolio you can. Hint: look for low or negative correlations.' },
  { id: 'target', title: 'Hit the target', brief: 'Earn at least 7% a year for the lowest possible volatility.', target: 0.07 },
];

const pc = (v: number) => `${(v * 100).toFixed(1)}%`;

export default function PortfolioLab({ onFinish, addReview, seed }: KindProps) {
  const [round, setRound] = useState(0);
  const { assets, corr } = useMemo(() => universe(seed, round), [seed, round]);
  const ch = CHALLENGES[round];
  const [w, setW] = useState([25, 25, 25, 25]);
  const [done, setDone] = useState<null | { pts: number; best: ReturnType<typeof bestPortfolio> }>(null);
  const [total, setTotal] = useState(0);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const weights = w.map((x) => x / sum);
  const me = portfolioStats(assets, corr, weights, RF);

  // A cloud of random portfolios for the chart (fixed per round)
  const cloud = useMemo(() => {
    const rng = makeRng(seed + round * 13);
    return Array.from({ length: 420 }, () => {
      const r = assets.map(() => -Math.log(1 - rng.next()));
      const s = r.reduce((a, b) => a + b, 0);
      return portfolioStats(assets, corr, r.map((x) => x / s), RF);
    });
  }, [assets, corr, seed, round]);
  const maxVol = Math.max(...assets.map((a) => a.vol)) * 1.08;
  const maxRet = Math.max(...assets.map((a) => a.ret)) * 1.1;
  const X = (v: number) => 40 + (v / maxVol) * 330;
  const Y = (r: number) => 210 - (r / maxRet) * 190;

  const submit = () => {
    const score =
      ch.id === 'sharpe' ? (s: typeof me) => s.sharpe : ch.id === 'minvol' ? (s: typeof me) => -s.vol : (s: typeof me) => (s.ret >= (ch.target ?? 0) - 1e-9 ? -s.vol : -10 - (ch.target! - s.ret));
    const best = bestPortfolio(assets, corr, RF, score);
    let pts: number;
    if (ch.id === 'sharpe') pts = Math.max(0, Math.min(1, me.sharpe / best.s.sharpe));
    else if (ch.id === 'minvol') pts = Math.max(0, Math.min(1, best.s.vol / me.vol));
    else pts = me.ret >= (ch.target ?? 0) - 0.001 ? Math.max(0, Math.min(1, best.s.vol / me.vol)) : Math.max(0, 0.5 * (me.ret / (ch.target ?? 1)) - 0.2);
    pts = Math.round(pts * 100) / 100;
    setDone({ pts, best });
    setTotal((t) => t + pts);
    playSfx(pts > 0.95 ? 'correct' : pts > 0.75 ? 'star' : 'wrong');
    addReview?.({
      q: ch.title,
      ok: pts > 0.9,
      answer: best.w.map((x, i) => `${assets[i].name} ${Math.round(x * 100)}%`).join(', '),
      explanation:
        ch.id === 'sharpe'
          ? `The best mix reached a Sharpe of ${best.s.sharpe.toFixed(2)} (yours ${me.sharpe.toFixed(2)}). Assets that don't move together cut risk more than they cut return.`
          : ch.id === 'minvol'
            ? `Minimum volatility was ${pc(best.s.vol)} (yours ${pc(me.vol)}). Combining low-correlation assets can beat even the safest single asset.`
            : `The cheapest way to ${pc(ch.target ?? 0)} carried ${pc(best.s.vol)} volatility (yours ${pc(me.vol)} at ${pc(me.ret)} return).`,
    });
  };
  const next = () => {
    if (round + 1 >= CHALLENGES.length) {
      const pct = (total / CHALLENGES.length) * 100;
      onFinish({ score: pct, summary: `Efficiency ${Math.round(pct)}% across ${CHALLENGES.length} portfolio challenges.` });
      return;
    }
    setRound(round + 1);
    setW([25, 25, 25, 25]);
    setDone(null);
  };

  return (
    <div className="pro">
      <div className="pro-head">
        <div>
          <div className="pro-kicker">Portfolio lab · Challenge {round + 1} of {CHALLENGES.length}</div>
          <div className="pro-title">{ch.title}</div>
          <div className="pro-sub">{ch.brief}</div>
        </div>
        <div className="pro-price">
          <span className="pro-kicker">Sharpe</span>
          <b>{me.sharpe.toFixed(2)}</b>
        </div>
      </div>
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Weights</h4>
          {assets.map((a, i) => (
            <label key={a.name} className="pro-slider">
              <span>
                <i className="dot" style={{ background: COLORS[i] }} /> {a.name}
              </span>
              <input type="range" min={0} max={100} step={5} value={w[i]} disabled={!!done} onChange={(e) => setW(w.map((x, j) => (j === i ? Number(e.target.value) : x)))} />
              <b>{Math.round(weights[i] * 100)}%</b>
            </label>
          ))}
          <div className="pro-stats">
            <div>
              <span className="pro-kicker">Expected return</span>
              <b>{pc(me.ret)}</b>
            </div>
            <div>
              <span className="pro-kicker">Volatility</span>
              <b>{pc(me.vol)}</b>
            </div>
            <div>
              <span className="pro-kicker">Sharpe</span>
              <b>{me.sharpe.toFixed(2)}</b>
            </div>
          </div>
          <h4 style={{ marginTop: 10 }}>Assets & correlations</h4>
          <div style={{ overflowX: 'auto' }}>
          <table className="pro-table compact">
            <thead>
              <tr>
                <th />
                <th>Return</th>
                <th>Vol</th>
                {assets.map((_, i) => (
                  <th key={i}>
                    <i className="dot" style={{ background: COLORS[i] }} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {assets.map((a, i) => (
                <tr key={a.name}>
                  <td>
                    <i className="dot" style={{ background: COLORS[i] }} /> {a.name}
                  </td>
                  <td>{pc(a.ret)}</td>
                  <td>{pc(a.vol)}</td>
                  {corr[i].map((c, j) => (
                    <td key={j} style={{ background: i === j ? 'transparent' : c > 0 ? `rgba(255,107,92,${c * 0.35})` : `rgba(34,211,143,${-c * 0.6})` }}>
                      {i === j ? '·' : c.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </section>
        <section className="pro-panel">
          <h4>Risk vs return</h4>
          <svg viewBox="0 0 390 240" className="pro-chart">
            <line x1="40" y1="210" x2="380" y2="210" stroke="#2a3b5e" />
            <line x1="40" y1="10" x2="40" y2="210" stroke="#2a3b5e" />
            <text x="210" y="234" fill="#8ea0c2" fontSize="11" textAnchor="middle">
              Volatility (risk) →
            </text>
            <text x="12" y="110" fill="#8ea0c2" fontSize="11" textAnchor="middle" transform="rotate(-90 12 110)">
              Return →
            </text>
            {cloud.map((p, i) => (
              <circle key={i} cx={X(p.vol)} cy={Y(p.ret)} r="1.6" fill="#4a6aa0" opacity="0.55" />
            ))}
            {ch.target && <line x1="40" x2="380" y1={Y(ch.target)} y2={Y(ch.target)} stroke="#ffd25a" strokeDasharray="4 4" opacity="0.7" />}
            {assets.map((a, i) => (
              <g key={a.name}>
                <circle cx={X(a.vol)} cy={Y(a.ret)} r="5" fill={COLORS[i]} />
              </g>
            ))}
            {done && <circle cx={X(done.best.s.vol)} cy={Y(done.best.s.ret)} r="8" fill="none" stroke="#ffd25a" strokeWidth="2.5" />}
            <circle cx={X(me.vol)} cy={Y(me.ret)} r="7" fill="#ffffff" stroke="#0c1322" strokeWidth="2" />
          </svg>
          <p className="tiny muted" style={{ margin: 0 }}>
            White dot: your portfolio. Coloured dots: single assets. Blue cloud: random mixes.{done ? ' Gold ring: the optimum.' : ''}
          </p>
          {done && (
            <div className={cls('pro-result', done.pts > 0.9 ? 'ok' : 'no')}>
              <b>Efficiency {Math.round(done.pts * 100)}%</b>
              <span className="small">
                Optimum: {done.best.w.map((x, i) => `${assets[i].name} ${Math.round(x * 100)}%`).join(' · ')}
              </span>
            </div>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {!done ? (
              <Button variant="gold" size="big" onClick={submit}>
                Lock in portfolio
              </Button>
            ) : (
              <Button variant="primary" size="big" onClick={next}>
                {round + 1 >= CHALLENGES.length ? 'See results ▶' : 'Next challenge ▶'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
