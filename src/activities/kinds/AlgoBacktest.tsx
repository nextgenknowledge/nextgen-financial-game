'use client';
/**
 * Algo Strategy Backtester (Advanced). Three years of daily prices. Choose a trend-following rule
 * (moving-average crossover) or a mean-reversion rule (buy when the price is stretched below its
 * average), tune it, and compare risk-adjusted return and drawdown with buy-and-hold. Round three
 * is the trap: tune on one period, then see how it holds up on data it has never seen.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { backtest, bestStrategy, pricePath, type Strategy } from '@/game/finance/desks';
import { C, LineChart, ProHead, Slider, Table, Verdict, pc } from './pro/kit';

const ROUNDS = [
  { title: 'Market A', brief: 'Long rallies and one ugly crash. Find a rule with a better Sharpe ratio than buy-and-hold.', regime: 'trend' as const, oos: false },
  { title: 'Market B', brief: 'This one goes nowhere fast: it swings around its average. Find a rule with a better Sharpe ratio than buy-and-hold.', regime: 'chop' as const, oos: false },
  { title: 'Out of sample', brief: 'Tune your rule on these three years. Then we test it on the next three years, which you have not seen.', regime: 'trend' as const, oos: true },
];

const DAYS = 756;

export default function AlgoBacktest({ onFinish, addReview, seed }: KindProps) {
  const [r, setR] = useState(0);
  const round = ROUNDS[r];
  const prices = useMemo(() => pricePath(seed + r * 17, DAYS, round.regime), [seed, r, round.regime]);
  const future = useMemo(() => pricePath(seed + r * 17 + 999, DAYS, round.regime), [seed, r, round.regime]);
  const [st, setSt] = useState<Strategy>({ kind: 'trend', fast: 20, slow: 100 });
  const [done, setDone] = useState<null | { score: number; oos?: ReturnType<typeof backtest> }>(null);
  const [scores, setScores] = useState<number[]>([]);
  const bt = useMemo(() => backtest(prices, st), [prices, st]);
  const best = useMemo(() => {
    const a = bestStrategy(prices, 'trend');
    const b = bestStrategy(prices, 'revert');
    return a.sharpe > b.sharpe ? a : b;
  }, [prices]);
  // Scale the chart: buy-and-hold vs strategy equity
  const step = 6;
  const thin = (a: number[]) => a.filter((_, i) => i % step === 0);

  const submit = () => {
    let score: number;
    let oos: ReturnType<typeof backtest> | undefined;
    if (round.oos) {
      oos = backtest(future, st);
      score = Math.max(0, Math.min(1, 0.5 + (oos.sharpe - oos.bhStats.sharpe) / 1.2));
    } else score = Math.max(0, Math.min(1, (bt.sharpe - Math.min(0, bt.bhStats.sharpe)) / (best.sharpe - Math.min(0, bt.bhStats.sharpe) || 1)));
    setDone({ score, oos });
    setScores((s) => [...s, score]);
    playSfx(score > 0.8 ? 'correct' : score > 0.5 ? 'star' : 'wrong');
    addReview?.({
      q: round.title,
      ok: score > 0.8,
      answer: `Best rule here: ${best.st.kind === 'trend' ? `MA ${best.st.fast}/${best.st.slow} crossover` : `mean reversion, ${best.st.fast}-day lookback, entry at −${(best.st.slow / 10).toFixed(1)}σ`} (Sharpe ${best.sharpe.toFixed(2)})`,
      explanation: round.oos
        ? 'Parameters fitted perfectly to the past often fail on new data (overfitting). Robust rules work across a range of settings, and real quants always keep test data the model never saw.'
        : round.regime === 'trend'
          ? 'Trend following sits out long declines, cutting drawdowns. It gives up some gains in whipsaws and pays costs on every switch.'
          : 'In a range-bound market, buying dips below the average and selling into strength works, while trend rules get whipsawed.',
    });
  };
  const next = () => {
    if (r + 1 >= ROUNDS.length) {
      onFinish({ score: (scores.reduce((a, b) => a + b, 0) / scores.length) * 100, summary: `Average strategy score ${Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)}%.` });
      return;
    }
    setR(r + 1);
    setDone(null);
  };

  const show = done?.oos ?? bt;
  return (
    <div className="pro">
      <ProHead kicker={`Quant café · Backtest ${r + 1} of ${ROUNDS.length}`} title={round.title} sub={round.brief} right={<div className="pro-price"><span className="pro-kicker">Strategy Sharpe</span><b>{bt.sharpe.toFixed(2)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Rule</h4>
          <div className="row" style={{ gap: 6, marginBottom: 6 }}>
            {(['trend', 'revert'] as const).map((k) => (
              <button key={k} type="button" disabled={!!done} className={cls('pro-pill', st.kind === k && 'sel')} onClick={() => setSt(k === 'trend' ? { kind: k, fast: 20, slow: 100 } : { kind: k, fast: 20, slow: 10 })}>
                {k === 'trend' ? 'Trend: MA crossover' : 'Mean reversion'}
              </button>
            ))}
          </div>
          {st.kind === 'trend' ? (
            <>
              <Slider label="Fast average (days)" value={st.fast} min={5} max={60} step={5} onChange={(v) => setSt({ ...st, fast: Math.min(v, st.slow - 5) })} show={st.fast} disabled={!!done} />
              <Slider label="Slow average (days)" value={st.slow} min={20} max={200} step={10} onChange={(v) => setSt({ ...st, slow: Math.max(v, st.fast + 5) })} show={st.slow} disabled={!!done} />
              <p className="tiny muted">Hold the stock while the fast average is above the slow one, otherwise sit in cash.</p>
            </>
          ) : (
            <>
              <Slider label="Lookback (days)" value={st.fast} min={10} max={60} step={5} onChange={(v) => setSt({ ...st, fast: v })} show={st.fast} disabled={!!done} />
              <Slider label="Buy below (σ)" value={st.slow} min={5} max={25} step={5} onChange={(v) => setSt({ ...st, slow: v })} show={`−${(st.slow / 10).toFixed(1)}`} disabled={!!done} />
              <p className="tiny muted">Buy when the price is this many standard deviations below its average; sell when it gets back above.</p>
            </>
          )}
          <Table
            compact
            head={['', 'Strategy', 'Buy & hold']}
            rows={[
              ['Return / year', pc(show.cagr), pc(show.bhStats.cagr)],
              ['Volatility', pc(show.vol), pc(show.bhStats.vol)],
              ['Max drawdown', pc(show.mdd), pc(show.bhStats.mdd)],
              ['Sharpe', show.sharpe.toFixed(2), show.bhStats.sharpe.toFixed(2)],
              ['Trades (0.1% cost each)', show.trades, 1],
            ]}
          />
        </section>
        <section className="pro-panel">
          <h4>{done?.oos ? 'The next three years (unseen)' : 'Growth of $1'}</h4>
          <LineChart series={[{ pts: thin(show.bh), color: C.grey, label: 'Buy & hold' }, { pts: thin(show.eq), color: C.green, label: 'Strategy' }]} h={210} fmt={(v) => `$${v.toFixed(2)}`} xLabel="Trading days →" />
          {done && (
            <Verdict ok={done.score > 0.8} title={`Score ${Math.round(done.score * 100)}%`}>
              {done.oos ? (done.oos.sharpe > done.oos.bhStats.sharpe ? 'Your rule held up on new data. Robust!' : 'It looked good in-sample but faded on new data: classic overfitting.') : `Best rule here reached a Sharpe of ${best.sharpe.toFixed(2)}.`}
            </Verdict>
          )}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
            {!done ? (
              <Button variant="gold" size="big" onClick={submit}>
                {round.oos ? 'Lock it and test on new data' : 'Submit strategy'}
              </Button>
            ) : (
              <Button variant="primary" size="big" onClick={next}>
                {r + 1 >= ROUNDS.length ? 'See results ▶' : 'Next market ▶'}
              </Button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
