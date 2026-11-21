'use client';
/**
 * Sovereign Wealth Fund (Advanced). Manage a nation's savings for 30 years. Set the allocation and
 * the yearly payout to the government budget, run 300 simulated futures, and meet the mandate:
 * keep the fund's real value, protect the bad scenarios, and pay a steady dividend to the country.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { FUND_ASSETS, INFLATION, fundScore, fundSim, type FundAsset } from '@/game/finance/desks';
import { variantIndex } from '../variant';

const shift = (d: number[]): FundAsset[] => FUND_ASSETS.map((a, i) => ({ ...a, ret: +(a.ret + d[i]).toFixed(3) }));
// Four different nations and decades to invest through
const MANDATES = [
  { kicker: 'Oil-exporting nation', note: '', assets: FUND_ASSETS, inflation: INFLATION, minPay: 0.035, floor: 0.55 },
  { kicker: 'High-inflation decades', note: 'Prices are rising fast, and returns are higher on paper to match. ', assets: shift([0.02, 0.015, 0.015, 0.02, 0.02]), inflation: 0.045, minPay: 0.035, floor: 0.55 },
  { kicker: 'Low-return world', note: 'Interest rates are low and markets are expensive, so expected returns are lower than usual. ', assets: shift([-0.015, -0.01, -0.01, -0.01, -0.01]), inflation: 0.02, minPay: 0.03, floor: 0.55 },
  { kicker: 'Small island nation', note: 'The country cannot afford a deep loss: the fund backs its pensions. ', assets: FUND_ASSETS, inflation: INFLATION, minPay: 0.03, floor: 0.65 },
];
import { C, LineChart, ProHead, Slider, Stats, Table, Verdict, pc } from './pro/kit';

const COLORS = [C.blue, C.green, C.red, C.gold, C.violet];

export default function SovereignFund({ onFinish, addReview, seed }: KindProps) {
  const [md] = useState(() => MANDATES[variantIndex('sovereign-fund', MANDATES.length, seed)]);
  const ASSETS = md.assets;
  const [w, setW] = useState([40, 30, 10, 10, 10]);
  const [spend, setSpend] = useState(4);
  const [ran, setRan] = useState<null | { w: number[]; spend: number }>(null);
  const [done, setDone] = useState(false);
  const sum = w.reduce((a, b) => a + b, 0) || 1;
  const weights = w.map((x) => x / sum);
  const sim = useMemo(() => (ran ? fundSim(ran.w, ran.spend / 100, seed % 1000, 300, 30, md.assets, md.inflation) : null), [ran, seed, md]);
  const exp = ASSETS.reduce((a, x, i) => a + weights[i] * x.ret, 0);
  const stale = !ran || ran.spend !== spend || ran.w.some((x, i) => x !== w[i]);
  const score = sim ? fundScore(sim, ran!.spend / 100, md.minPay, md.floor) : 0;

  const commit = () => {
    if (!sim || stale) return;
    setDone(true);
    playSfx(score > 0.85 ? 'correct' : score > 0.6 ? 'star' : 'wrong');
    addReview?.({ q: 'Your fund mandate', ok: score > 0.85, answer: `Median real value ${pc(sim.median, 0)}, bad case ${pc(sim.p10, 0)}, payout ${spend}%`, explanation: `A fund can only pay out what it earns above inflation for ever. With an expected nominal return of ${pc(exp)} and ${pc(md.inflation)} inflation, the sustainable payout is roughly ${pc(Math.max(0, exp - md.inflation - 0.01))} (volatility drag eats the rest). Norway’s fund uses a 3% rule for exactly this reason.` });
    setTimeout(() => onFinish({ score: score * 100, summary: `Median real value ${pc(sim.median, 0)} after 30 years, payout ${spend}% a year.` }), 2200);
  };

  return (
    <div className="pro">
      <ProHead kicker={`Sovereign wealth fund · 30-year mandate · ${md.kicker}`} title="Invest for a nation" sub={`${md.note}Inflation runs at ${pc(md.inflation)}. Mandate: keep the median real value at 100%+, keep the bad case (10th percentile) above ${pc(md.floor, 0)}, and pay out at least ${pc(md.minPay)} a year.`} right={<div className="pro-price"><span className="pro-kicker">Expected return</span><b>{pc(exp)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Strategic allocation</h4>
          {ASSETS.map((a, i) => (
            <Slider key={a.name} label={a.name} color={COLORS[i]} value={w[i]} min={0} max={100} step={5} onChange={(v) => setW(w.map((x, j) => (j === i ? v : x)))} show={`${Math.round(weights[i] * 100)}%`} disabled={done} />
          ))}
          <Slider label="Yearly payout" value={spend} min={2} max={6} step={0.5} onChange={setSpend} show={`${spend}%`} disabled={done} />
          <Table compact head={['Asset', 'Return', 'Volatility']} rows={ASSETS.map((a) => [a.name, pc(a.ret), pc(a.vol)])} />
          <Button variant="primary" disabled={done} onClick={() => (setRan({ w: [...w], spend }), playSfx('click'))}>
            Run 300 futures
          </Button>
        </section>
        <section className="pro-panel">
          <h4>Real value of the fund (start = 100%)</h4>
          {sim ? (
            <>
              <LineChart
                series={[
                  { pts: sim.fan.map((f) => f[2] * 100), color: C.green, label: 'Good (90th)', dash: true },
                  { pts: sim.fan.map((f) => f[1] * 100), color: C.blue, label: 'Median' },
                  { pts: sim.fan.map((f) => f[0] * 100), color: C.red, label: 'Bad (10th)', dash: true },
                ]}
                hlines={[{ y: 100, label: 'Start' }]}
                fmt={(v) => `${v.toFixed(0)}%`}
                xLabel="Years →"
              />
              <Stats items={[['Median after 30y', pc(sim.median, 0), sim.median >= 1 ? 'good' : 'bad'], ['Bad case', pc(sim.p10, 0), sim.p10 >= md.floor ? 'good' : 'bad'], ['Ever below 50%', pc(sim.breach, 0), sim.breach < 0.15 ? 'good' : 'bad']]} />
              {stale && !done && <p className="tiny muted">Settings changed: run again before committing.</p>}
              {done && (
                <Verdict ok={score > 0.85} title={`Mandate score ${Math.round(score * 100)}%`}>
                  Diversified real assets and a payout below the real return keep a fund alive for generations.
                </Verdict>
              )}
            </>
          ) : (
            <p className="small muted">Set the allocation and payout, then run the simulation.</p>
          )}
          {!done && (
            <div className="row" style={{ justifyContent: 'space-between', marginTop: 8 }}>
              <span className="small">{sim ? `Score if you commit: ${Math.round(score * 100)}%` : ''}</span>
              <Button variant="gold" size="big" disabled={!sim || stale} onClick={commit}>
                Commit the mandate
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
