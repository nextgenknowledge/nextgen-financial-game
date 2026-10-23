'use client';
/**
 * Futures Pit (Advanced). Three hedgers: an airline that must buy jet fuel, a farmer who will sell
 * wheat, and a fund protecting a Hang Seng portfolio with index futures. Pick the direction and the
 * number of contracts, then live through twelve weeks of daily settlement. Margin calls must be met
 * or the position is closed out. Scored on direction, size against the minimum-variance hedge, and
 * keeping the hedge alive.
 */
import { useEffect, useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { useActivityPaused } from '../paused';
import { type HedgeCase, hedgeContracts, hedgeOutcome, hedgePath } from '@/game/finance/desks';
import { Bars, C, LineChart, ProHead, Slider, Stats, Table, Verdict, usdK } from './pro/kit';

const CASES: HedgeCase[] = [
  { id: 'airline', title: 'Harbour Air', brief: 'You must buy 2,520,000 gallons of jet fuel in 3 months. If fuel rises, your costs explode.', side: 1, exposure: 2_520_000, spot: 2.6, contractSize: 42_000, unit: 'gallon', vol: 0.035, margin: 13_000, maint: 8_500 },
  { id: 'farmer', title: 'Wheat farm cooperative', brief: 'Your 400,000-bushel harvest comes in 3 months. If wheat falls, your income falls.', side: -1, exposure: 400_000, spot: 6.2, contractSize: 5_000, unit: 'bushel', vol: 0.03, margin: 3_800, maint: 2_400 },
  { id: 'fund', title: 'Hong Kong equity fund', brief: 'You manage a HK$90M stock portfolio with a beta of 1.25 to the Hang Seng. Clients fear a crash this quarter but you must stay invested.', side: -1, exposure: 90_000_000, spot: 18_000, contractSize: 50, beta: 1.25, unit: 'index point', vol: 0.03, margin: 170_000, maint: 115_000 },
];

type Phase = 'setup' | 'running' | 'call' | 'done';

export default function FuturesHedge({ onFinish, addReview, seed }: KindProps) {
  const paused = useActivityPaused();
  const [k, setK] = useState(0);
  const c = CASES[k];
  const path = useMemo(() => hedgePath(c, seed + k * 101), [c, seed, k]);
  const [dir, setDir] = useState<1 | -1 | 0>(0);
  const [n, setN] = useState(0);
  const [phase, setPhase] = useState<Phase>('setup');
  const [week, setWeek] = useState(0);
  const [margin, setMargin] = useState(0);
  const [toppedUp, setToppedUp] = useState(0);
  const [closedAt, setClosedAt] = useState<number | null>(null);
  const [scores, setScores] = useState<number[]>([]);
  const [last, setLast] = useState<null | { score: number; out: ReturnType<typeof hedgeOutcome>; unhedged: number }>(null);
  const ideal = hedgeContracts(c);
  const contracts = dir * n;
  const ccy = c.id === 'fund' ? 'HK$' : '$';
  const money = (v: number) => (c.id === 'fund' ? `HK${usdK(v)}` : usdK(v));

  const start = () => {
    setMargin(Math.abs(contracts) * c.margin);
    setWeek(0);
    setClosedAt(null);
    setToppedUp(0);
    setPhase(contracts === 0 ? 'done' : 'running');
    if (contracts === 0) settle(null, 0);
    playSfx('click');
  };

  // Weekly settlement
  useEffect(() => {
    if (phase !== 'running' || paused) return;
    const id = setInterval(() => {
      setWeek((w) => {
        const nw = w + 1;
        const change = contracts * c.contractSize * (path[nw] - path[w]);
        setMargin((m) => {
          const nm = m + change;
          if (nm < Math.abs(contracts) * c.maint) {
            setPhase('call');
            playSfx('wrong');
          }
          return nm;
        });
        if (nw >= path.length - 1) setPhase((p) => (p === 'call' ? p : 'done'));
        return nw;
      });
    }, 650);
    return () => clearInterval(id);
  }, [phase, paused, contracts, c, path]);

  useEffect(() => {
    if (phase === 'done' && !last) settle(closedAt, toppedUp);
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  const meetCall = () => {
    const need = Math.abs(contracts) * c.margin - margin;
    setMargin((m) => m + need);
    setToppedUp((t) => t + need);
    setPhase(week >= path.length - 1 ? 'done' : 'running');
    playSfx('coin');
  };
  const refuse = () => {
    setClosedAt(week);
    setPhase('done');
    settle(week, toppedUp);
  };

  function settle(closed: number | null, topped: number) {
    const endIdx = path.length - 1;
    const hedgePathTrunc = closed === null ? path : [...path.slice(0, closed + 1), ...new Array(endIdx - closed).fill(path[closed])];
    // Futures stop at the close-out week; the exposure runs to the end
    const fut = hedgeOutcome(c, hedgePathTrunc, contracts).futuresPnl;
    const exp = hedgeOutcome(c, path, 0).exposurePnl;
    const out = { exposurePnl: exp, futuresPnl: fut, net: exp + fut };
    const dirOk = contracts !== 0 && Math.sign(contracts) === c.side;
    const sizeScore = contracts === 0 ? 0 : Math.max(0, 1 - Math.abs(Math.abs(contracts) - ideal) / ideal);
    const score = (dirOk ? 0.4 : 0) + (dirOk ? sizeScore * 0.4 : 0) + (closed === null ? 0.2 : 0);
    setLast({ score, out, unhedged: exp });
    setScores((s) => [...s, score]);
    playSfx(score > 0.85 ? 'correct' : score > 0.5 ? 'star' : 'wrong');
    addReview?.({
      q: c.title,
      ok: score > 0.8,
      answer: `${c.side === 1 ? 'Buy (go long)' : 'Sell (go short)'} about ${ideal} contracts`,
      explanation:
        c.id === 'fund'
          ? `Contracts = beta × portfolio ÷ (index × multiplier) = 1.25 × HK$90M ÷ (18,000 × HK$50) = ${ideal}. Short futures gain when the market falls, offsetting the portfolio.`
          : `Contracts = exposure ÷ contract size = ${c.exposure.toLocaleString()} ÷ ${c.contractSize.toLocaleString()} = ${ideal}. ${c.side === 1 ? 'You will buy fuel later, so you buy futures now: if prices rise the futures profit pays the extra cost.' : 'You will sell wheat later, so you sell futures now: if prices fall the futures profit makes up the lost income.'}${closed !== null ? ' Refusing the margin call closed your hedge just when you needed it.' : topped > 0 ? ' A margin call is not a loss on the hedge as a whole: the physical position gained at the same time.' : ''}`,
    });
  }

  const next = () => {
    if (k + 1 >= CASES.length) {
      const pct = (scores.reduce((a, b) => a + b, 0) / scores.length) * 100;
      onFinish({ score: pct, stats: { bestHedgeScore: Math.round(pct) }, summary: `Average hedge score ${Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)}%.` });
      return;
    }
    setK(k + 1);
    setDir(0);
    setN(0);
    setPhase('setup');
    setLast(null);
    setWeek(0);
  };

  const shown = path.slice(0, week + 1);
  return (
    <div className="pro">
      <ProHead kicker={`Futures pit · Hedge ${k + 1} of ${CASES.length}`} title={c.title} sub={c.brief} right={<div className="pro-price"><span className="pro-kicker">Week</span><b>{week} / 12</b></div>} />
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Contract specs</h4>
          <Table
            head={['Item', 'Value']}
            rows={[
              ['Futures price now', `${ccy}${c.spot.toLocaleString()} per ${c.unit}`],
              [c.id === 'fund' ? 'Multiplier' : 'Contract size', c.id === 'fund' ? `HK$${c.contractSize} per index point` : `${c.contractSize.toLocaleString()} ${c.unit}s`],
              ['Initial margin', `${ccy}${c.margin.toLocaleString()} per contract`],
              ['Maintenance margin', `${ccy}${c.maint.toLocaleString()} per contract`],
            ]}
          />
          <h4 style={{ marginTop: 10 }}>Your hedge</h4>
          <div className="row" style={{ gap: 8 }}>
            {([1, -1] as const).map((s) => (
              <button key={s} type="button" className={cls('pro-pill', dir === s && 'sel')} disabled={phase !== 'setup'} onClick={() => setDir(s)}>
                {s === 1 ? 'Buy futures (long)' : 'Sell futures (short)'}
              </button>
            ))}
          </div>
          <Slider label="Contracts" value={n} min={0} max={c.id === 'fund' ? 200 : 120} onChange={setN} show={n} disabled={phase !== 'setup'} />
          {phase === 'setup' && (
            <Button variant="gold" size="big" disabled={dir === 0 && n > 0} onClick={start}>
              {n === 0 ? 'Stay unhedged' : `Open ${n} ${dir === 1 ? 'long' : 'short'} contracts`}
            </Button>
          )}
        </section>
        <section className="pro-panel">
          <h4>Futures price · daily settlement</h4>
          <LineChart series={[{ pts: shown.length > 1 ? shown : [path[0], path[0]], color: C.gold }]} h={170} fmt={(v) => (c.id === 'fund' ? v.toFixed(0) : v.toFixed(2))} hlines={[{ y: path[0], label: 'Entry', color: C.grey }]} />
          {phase !== 'setup' && contracts !== 0 && <Stats items={[['Margin account', money(margin), margin < Math.abs(contracts) * c.maint ? 'bad' : undefined], ['Futures P&L', money(contracts * c.contractSize * (path[closedAt ?? week] - path[0]))], ['Topped up', money(toppedUp)]]} />}
          {phase === 'call' && (
            <div className="fh-call">
              <b>MARGIN CALL</b>
              <span className="small">Your account fell below maintenance. Add {money(Math.abs(contracts) * c.margin - margin)} to restore initial margin, or the broker closes your futures.</span>
              <div className="row" style={{ gap: 8 }}>
                <Button variant="gold" onClick={meetCall}>
                  Wire the cash
                </Button>
                <Button onClick={refuse}>Let it close</Button>
              </div>
            </div>
          )}
          {last && (
            <>
              <Bars items={[{ label: 'Unhedged result', value: last.unhedged, color: last.unhedged >= 0 ? C.green : C.red }, { label: 'Futures P&L', value: last.out.futuresPnl, color: C.blue }, { label: 'Hedged result', value: last.out.net, color: C.violet }]} fmt={(v) => money(v)} />
              <Verdict ok={last.score > 0.8} title={`Hedge score ${Math.round(last.score * 100)}% · ideal ${c.side === 1 ? 'long' : 'short'} ${ideal}`}>
                A good hedge does not make money: it makes the result predictable, whichever way prices go.
              </Verdict>
              <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
                <Button variant="primary" size="big" onClick={next}>
                  {k + 1 >= CASES.length ? 'See results ▶' : 'Next hedger ▶'}
                </Button>
              </div>
            </>
          )}
          {phase === 'setup' && <p className="small muted">Size the hedge to match the exposure. For the fund, adjust for beta.</p>}
        </section>
      </div>
    </div>
  );
}
