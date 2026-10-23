'use client';
/**
 * Forex Dealing Room (Advanced). Clients ask for prices. Quote a spread: tight wins the deal but
 * earns little, wide earns more but loses to rival banks. Won trades leave you holding currency
 * risk: hedge it at a small cost or carry it and hope. Then two triangular-arbitrage puzzles.
 */
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { QuestionView } from '../QuestionView';
import { correctAnswerText } from '@/game/questions/engine';
import { rq } from './VisualQuiz';
import { Bars, C, ProHead, Table, Verdict, usd } from './pro/kit';

const PAIRS = [
  { pair: 'EUR/USD', mid: 1.085, pip: 0.0001, ccy: 'EUR' },
  { pair: 'GBP/USD', mid: 1.27, pip: 0.0001, ccy: 'GBP' },
  { pair: 'USD/JPY', mid: 151.2, pip: 0.01, ccy: 'USD' },
  { pair: 'AUD/USD', mid: 0.66, pip: 0.0001, ccy: 'AUD' },
];
const SPREADS = [1, 3, 6, 10];
const CLIENTS = ['Pension fund', 'Car exporter', 'Hedge fund', 'Retailer', 'Airline', 'Tech company'];

export default function FxDealing({ onFinish, addReview, seed }: KindProps) {
  const deals = useMemo(() => {
    const rng = makeRng(seed * 17 + 2);
    return Array.from({ length: 6 }, () => {
      const p = rng.pick(PAIRS);
      const size = rng.pick([2, 5, 10, 20]) * 1e6;
      const rival = rng.range(1.5, 7);
      const move = rng.normal() * 9; // pips the market moves while you hold
      return { ...p, size, rival, move, client: rng.pick(CLIENTS), side: rng.chance(0.5) ? 'buy' : 'sell' };
    });
  }, [seed]);
  const arbs = useMemo(() => {
    const rng = makeRng(seed * 3 + 1);
    return [0, 1].map((k) => {
      const eu = +rng.pick([1.08, 1.09, 1.1]).toFixed(4);
      const gu = +rng.pick([1.25, 1.27, 1.3]).toFixed(4);
      const fair = eu / gu;
      const quoted = +(fair * (1 + (rng.chance(0.5) ? 1 : -1) * rng.range(0.003, 0.006))).toFixed(4);
      // Start with 1M USD; route through the cheaper path
      const viaEurFirst = (1e6 / eu) * quoted * gu; // USD→EUR→GBP→USD
      const viaGbpFirst = ((1e6 / gu) / quoted) * eu; // USD→GBP→EUR→USD
      const profit = Math.max(viaEurFirst, viaGbpFirst) - 1e6;
      return rq({
        id: `fx-arb-${k}`,
        topic: 'economics',
        type: 'numeric',
        format: 'money',
        value: Math.round(profit),
        tolRel: 0.03,
        tolAbs: 50,
        prompt: `Quotes: EUR/USD ${eu}, GBP/USD ${gu}, EUR/GBP ${quoted}. Starting with $1,000,000, what riskless profit can you lock in by going round the triangle?`,
        hint: `The fair EUR/GBP is EUR/USD ÷ GBP/USD = ${fair.toFixed(4)}. Sell what is overpriced.`,
        explanation: `Fair EUR/GBP = ${fair.toFixed(4)} but it is quoted at ${quoted}, so EUR is ${quoted > fair ? 'over' : 'under'}priced in GBP. ${quoted > fair ? 'USD → EUR → GBP (sell the dear EUR) → USD' : 'USD → GBP → EUR (buy the cheap EUR) → USD'} turns $1M into ${usd(1e6 + profit)}: a profit of ${usd(profit)}. Real arbitrage gaps last milliseconds.`,
      });
    });
  }, [seed]);
  const [i, setI] = useState(0);
  const [spread, setSpread] = useState<number | null>(null);
  const [hedged, setHedged] = useState<boolean | null>(null);
  const [pnl, setPnl] = useState(0);
  const [log, setLog] = useState<number[]>([]);
  const [arbScore, setArbScore] = useState<number[]>([]);
  const d = deals[Math.min(i, deals.length - 1)];
  const won = spread !== null && spread <= d.rival;
  const valuePerPip = (size: number, p: (typeof PAIRS)[number]) => (p.pair === 'USD/JPY' ? (size * p.pip) / p.mid : size * p.pip);
  const earn = spread !== null && won ? (spread / 2) * valuePerPip(d.size, d) : 0;
  const risk = (d.side === 'buy' ? -1 : 1) * d.move * valuePerPip(d.size, d); // client buys from you → you are short
  const hedgeCost = 0.5 * valuePerPip(d.size, d);
  const result = spread === null ? 0 : !won ? 0 : earn + (hedged ? -hedgeCost : risk);

  const quote = (s: number) => {
    setSpread(s);
    playSfx(s <= d.rival ? 'coin' : 'wrong');
    if (s > d.rival) {
      setLog((l) => [...l, 0]);
    }
  };
  const decideHedge = (h: boolean) => {
    setHedged(h);
    const r = earn + (h ? -hedgeCost : risk);
    setPnl((p) => p + r);
    setLog((l) => [...l, r]);
    playSfx(r > 0 ? 'cash' : 'wrong');
  };
  const next = () => {
    if (spread !== null && !won)
      addReview?.({ q: `${d.client} ${d.side}s ${(d.size / 1e6).toFixed(0)}M ${d.ccy}`, ok: false, answer: `A rival quoted ${d.rival.toFixed(1)} pips`, explanation: 'Quote too wide and the client trades elsewhere. Big, price-sensitive clients get the tightest prices.' });
    setI(i + 1);
    setSpread(null);
    setHedged(null);
  };

  if (i >= deals.length) {
    const ai = i - deals.length;
    if (ai >= arbs.length) {
      const dealScore = Math.max(0, Math.min(1, pnl / 12_000 + 0.3));
      const arb = arbScore.reduce((a, b) => a + b, 0) / arbs.length;
      return (
        <div className="pro">
          <ProHead kicker="FX dealing room · Day done" title={`Dealing P&L ${usd(pnl)}`} sub="Market makers live on many small spreads. One big unhedged loss can wipe out a week of them." />
          <section className="pro-panel">
            <Bars items={log.map((v, k) => ({ label: `Deal ${k + 1}`, value: v, color: v >= 0 ? C.green : C.red }))} fmt={(v) => usd(v)} />
          </section>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="gold" size="big" onClick={() => onFinish({ score: (dealScore * 0.6 + arb * 0.4) * 100, summary: `Dealing P&L ${usd(pnl)}, arbitrage ${Math.round(arb * 100)}%.` })}>
              Finish ▶
            </Button>
          </div>
        </div>
      );
    }
    return (
      <div className="pro">
        <ProHead kicker={`FX dealing room · Arbitrage ${ai + 1} of ${arbs.length}`} title="Triangular arbitrage" sub="Three currency quotes that do not quite agree. Find the free money." />
        <QuestionView
          key={ai}
          q={arbs[ai]}
          entry={false}
          index={ai}
          total={arbs.length}
          onAnswered={(o) => {
            setArbScore((s) => [...s, o.credit]);
            addReview?.({ q: arbs[ai].prompt, ok: o.correct, answer: correctAnswerText(arbs[ai]), explanation: arbs[ai].explanation });
            setI(i + 1);
          }}
        />
      </div>
    );
  }

  return (
    <div className="pro">
      <ProHead kicker={`FX dealing room · Request ${i + 1} of ${deals.length}`} title={`${d.client} wants to ${d.side} ${(d.size / 1e6).toFixed(0)}M ${d.ccy}`} sub={`${d.pair} mid ${d.mid}. Your spread is the total gap between your bid and offer, in pips. Rival banks are quoting too.`} right={<div className="pro-price"><span className="pro-kicker">Day P&L</span><b style={{ color: pnl < 0 ? C.red : undefined }}>{usd(pnl)}</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>1 · Quote a spread</h4>
          <div className="pro-choices">
            {SPREADS.map((s) => (
              <button key={s} type="button" disabled={spread !== null} className={cls('pro-pill', spread === s && 'sel')} onClick={() => quote(s)}>
                {s} pip{s > 1 ? 's' : ''} · earns {usd((s / 2) * valuePerPip(d.size, d))}
              </button>
            ))}
          </div>
          {spread !== null && (
            <Verdict ok={won} title={won ? 'Client dealt with you' : `Lost: a rival quoted ${d.rival.toFixed(1)} pips`}>
              {won ? `You earn half the spread: ${usd(earn)}. You now ${d.side === 'buy' ? 'owe' : 'hold'} ${(d.size / 1e6).toFixed(0)}M ${d.ccy}.` : 'Too wide. Try tighter for big clients.'}
            </Verdict>
          )}
        </section>
        <section className="pro-panel">
          <h4>2 · Manage the risk</h4>
          {won && hedged === null && (
            <>
              <p className="small">Offset the position in the interbank market now for about half a pip ({usd(hedgeCost)}), or hold it and let the market decide.</p>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="primary" onClick={() => decideHedge(true)}>
                  Hedge now
                </Button>
                <Button onClick={() => decideHedge(false)}>Hold the risk</Button>
              </div>
            </>
          )}
          {won && hedged !== null && (
            <Table head={['', 'P&L']} rows={[['Spread earned', usd(earn)], [hedged ? 'Hedge cost' : `Market moved ${d.move.toFixed(1)} pips`, usd(hedged ? -hedgeCost : risk)], ['This deal', usd(result)]]} hl={[2]} />
          )}
          {(spread !== null && !won) || hedged !== null ? (
            <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
              <Button variant="primary" size="big" onClick={next}>
                Next ▶
              </Button>
            </div>
          ) : null}
          {spread === null && <p className="small muted">Pick a spread first.</p>}
        </section>
      </div>
    </div>
  );
}
