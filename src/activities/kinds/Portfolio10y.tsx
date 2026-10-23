'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { LineChart, Stat, StatGrid } from '@/ui/kit';
import { money, pct } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

const ASSETS = [
  { id: 'cash', label: 'Savings (cash)', icon: '🐷', mu: 0.025, sd: 0.005, color: '#3cc45a' },
  { id: 'bonds', label: 'Bond fund', icon: '📜', mu: 0.04, sd: 0.06, color: '#8a5cf6' },
  { id: 'index', label: 'Total-market index', icon: '📈', mu: 0.075, sd: 0.16, color: '#2f6bdb' },
  { id: 'hot', label: 'Hot tech stocks', icon: '🔥', mu: 0.085, sd: 0.38, color: '#e1553f' },
] as const;
type Mix = Record<(typeof ASSETS)[number]['id'], number>;

const BASKETS: { name: string; icon: string; mix: Mix; blurb: string }[] = [
  { name: 'Piggy Bank', icon: '🐷', mix: { cash: 1, bonds: 0, index: 0, hot: 0 }, blurb: 'All in savings. Super safe, slow growth.' },
  { name: 'Balanced Basket', icon: '🧺', mix: { cash: 0.1, bonds: 0.3, index: 0.6, hot: 0 }, blurb: 'Mostly the whole market plus some bonds.' },
  { name: 'Rocket Ride', icon: '🚀', mix: { cash: 0, bonds: 0, index: 0, hot: 1 }, blurb: 'All hot tech stocks. Wild ups and downs!' },
];

function simulate(mix: Mix, seed: number, rebalance: boolean) {
  const rng = makeRng(seed);
  const years = 10;
  const yearly = Array.from({ length: years }, () => {
    const mkt = rng.normal();
    const crash = rng.chance(0.12) ? -1 : 0;
    const r: Record<string, number> = {};
    for (const a of ASSETS) {
      const corr = a.id === 'index' || a.id === 'hot' ? 0.8 : a.id === 'bonds' ? -0.2 : 0;
      const z = corr * mkt + Math.sqrt(1 - corr * corr) * rng.normal();
      r[a.id] = a.mu + a.sd * z + (crash && (a.id === 'index' || a.id === 'hot') ? (a.id === 'hot' ? -0.35 : -0.2) : 0) + (crash && a.id === 'bonds' ? 0.04 : 0);
    }
    return { r, infl: Math.max(-0.005, 0.03 + rng.normal() * 0.012) };
  });
  let hold: Record<string, number> = Object.fromEntries(ASSETS.map((a) => [a.id, 10000 * mix[a.id]]));
  const values = [10000];
  const real = [10000];
  let priceLevel = 1;
  let peak = 10000;
  let maxDD = 0;
  for (const y of yearly) {
    for (const a of ASSETS) hold[a.id] *= 1 + y.r[a.id];
    let total = Object.values(hold).reduce((s, v) => s + v, 0);
    if (rebalance) hold = Object.fromEntries(ASSETS.map((a) => [a.id, total * mix[a.id]]));
    total = Object.values(hold).reduce((s, v) => s + v, 0);
    priceLevel *= 1 + y.infl;
    values.push(total);
    real.push(total / priceLevel);
    peak = Math.max(peak, total);
    maxDD = Math.max(maxDD, 1 - total / peak);
  }
  const final = values[values.length - 1];
  const realFinal = real[real.length - 1];
  const cagr = Math.pow(final / 10000, 1 / years) - 1;
  const realCagr = Math.pow(realFinal / 10000, 1 / years) - 1;
  const infl = Math.pow(priceLevel, 1 / years) - 1;
  return { values, real, final, realFinal, cagr, realCagr, infl, maxDD };
}

/** Allocate $10,000 and simulate 10 years of returns and inflation. */
export default function Portfolio10y({ params, onFinish, addReview, seed }: KindProps<{ mode: 'baskets' | 'sliders'; rebalance?: boolean }>) {
  const entry = params.mode === 'baskets';
  const [mix, setMix] = useState<Mix>({ cash: 0.25, bonds: 0.25, index: 0.25, hot: 0.25 });
  const [rebal, setRebal] = useState(true);
  const [result, setResult] = useState<null | { picked: string; sims: { name: string; s: ReturnType<typeof simulate> }[] }>(null);
  const total = Object.values(mix).reduce((a, b) => a + b, 0);
  const comparison = useMemo(() => BASKETS.map((b) => ({ name: `${b.icon} ${b.name}`, s: simulate(b.mix, seed, true) })), [seed]);

  const run = (name: string, m: Mix) => {
    const s = simulate(m, seed, entry ? true : rebal);
    playSfx('whoosh');
    setResult({ picked: name, sims: [{ name, s }, ...comparison.filter((c) => c.name !== name)] });
  };

  const finish = () => {
    const s = result!.sims[0].s;
    const beat = s.realCagr > 0;
    const score = entry
      ? Math.max(0, Math.min(100, (beat ? 60 : 25) + s.realCagr * 400 + (result!.picked.includes('Balanced') ? 15 : 0)))
      : Math.max(0, Math.min(100, (beat ? 50 : 20) + s.realCagr * 600 - Math.max(0, s.maxDD - 0.3) * 60));
    act((w, fx) => recordAnswer(w, fx, { id: 'portfolio', topic: 'investing' }, beat));
    addReview?.({
      q: 'Did your portfolio beat inflation?',
      ok: beat,
      answer: `${beat ? 'Yes' : 'No'}, real return ${pct(s.realCagr, 2)}/year`,
      explanation: `Nominal ${pct(s.cagr, 2)}/yr, inflation ${pct(s.infl, 2)}/yr, worst drop ${pct(s.maxDD, 0)}. Cash rarely beats inflation; stocks usually do over long periods, but with scary drops. Diversified mixes give a smoother ride.`,
    });
    onFinish({ score });
  };

  if (result) {
    const s = result.sims[0].s;
    return (
      <div className="col" style={{ gap: 10 }}>
        <StatGrid>
          <Stat label="After 10 years" value={money(s.final, { cents: false })} tone={s.final > 10000 ? 'good' : 'bad'} />
          <Stat label="In today's dollars (real)" value={money(s.realFinal, { cents: false })} tone={s.realFinal > 10000 ? 'good' : 'bad'} sub={entry ? 'What it can actually buy' : `Real return ${pct(s.realCagr, 2)}/yr`} />
          <Stat label={entry ? 'Prices went up' : 'Inflation'} value={`${pct(s.infl, 1)}/yr`} />
          <Stat label="Worst drop" value={pct(s.maxDD, 0)} sub="From a high point" />
        </StatGrid>
        <LineChart
          series={result.sims.map((x, i) => ({ values: x.s.values, color: ['#2f6bdb', '#3cc45a', '#e1553f', '#8a5cf6'][i], dashed: i > 0 }))}
          labels={s.values.map((_, i) => `Y${i}`)}
        />
        <div className="tiny">
          {result.sims.map((x, i) => (
            <span key={x.name} style={{ marginRight: 12 }}>
              <span style={{ color: ['#2f6bdb', '#3cc45a', '#e1553f', '#8a5cf6'][i] }}>■</span> {x.name}: {money(x.s.final, { cents: false })}
            </span>
          ))}
        </div>
        <div className="card tint-gold">
          {s.realCagr > 0
            ? `You beat inflation! Your money can buy ${pct(s.realFinal / 10000 - 1, 0)} more stuff than when you started.`
            : `Your money grew ${pct(s.final / 10000 - 1, 0)}, but prices grew faster, it buys less than before. That's inflation's sneaky bite.`}{' '}
          <ReadAloud text="Did your money beat inflation? Real return means growth after prices go up." />
        </div>
        <Button variant="primary" size="big" onClick={finish}>
          See my stars
        </Button>
      </div>
    );
  }

  if (entry)
    return (
      <div className="col" style={{ gap: 10 }}>
        <p className="bold">You have $10,000 to invest for 10 years. Pick a basket!</p>
        <div className="item-grid">
          {BASKETS.map((b) => (
            <div key={b.name} className="item-card">
              <span style={{ fontSize: '2.6rem' }}>{b.icon}</span>
              <b>{b.name}</b>
              <span className="small">{b.blurb}</span>
              <Button variant="gold" onClick={() => run(`${b.icon} ${b.name}`, b.mix)}>
                Choose
              </Button>
            </div>
          ))}
        </div>
      </div>
    );

  return (
    <div className="col" style={{ gap: 10 }}>
      <p className="small">Split $10,000. Expected yearly returns (not guaranteed!): savings ~2.5%, bonds ~4%, index ~7.5%, hot stocks ~8.5% but very volatile. Inflation averages ~3%.</p>
      {ASSETS.map((a) => (
        <div key={a.id} className="alloc-row">
          <span className="bold">
            {a.icon} {a.label}
          </span>
          <input type="range" min={0} max={100} step={5} value={Math.round(mix[a.id] * 100)} onChange={(e) => setMix({ ...mix, [a.id]: Number(e.target.value) / 100 })} />
          <b className="mono">{Math.round(mix[a.id] * 100)}%</b>
        </div>
      ))}
      <div className={`bold ${Math.abs(total - 1) > 0.001 ? 'bad' : 'good'}`}>Total: {Math.round(total * 100)}% {Math.abs(total - 1) > 0.001 && '(must be 100%)'}</div>
      {params.rebalance && (
        <label className="row small bold">
          <input type="checkbox" checked={rebal} onChange={(e) => setRebal(e.target.checked)} /> Rebalance back to my mix every year
        </label>
      )}
      <Button variant="gold" size="big" disabled={Math.abs(total - 1) > 0.001} onClick={() => run('🧑 Your mix', mix)}>
        Simulate 10 years ▶
      </Button>
    </div>
  );
}
