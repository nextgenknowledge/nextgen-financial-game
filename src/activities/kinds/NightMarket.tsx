'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { nights, runNight, bestNightProfit, demand, UNIT_COST, STALL_RENT, type StallState, type NightResult } from '@/game/sim/stall';
import { Button, ReadAloud } from '@/ui/common';
import { Stat, StatGrid, LineChart } from '@/ui/kit';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

const WICON = { sunny: '☀️', cloudy: '⛅', rain: '🌧️' };

/** Run a dumpling stall over several nights. */
export default function NightMarket({ params, onFinish, addReview, seed }: KindProps<{ nights: number; advanced: boolean }>) {
  const adv = params.advanced;
  const plan = useMemo(() => nights(seed, params.nights), [seed, params.nights]);
  const st = useRef<StallState>({ cash: 80, reputation: 1, sign: false, steamer: false, night: 0, totalProfit: 0 });
  const [, force] = useState(0);
  const [made, setMade] = useState(80);
  const [price, setPrice] = useState(2.5);
  const [last, setLast] = useState<NightResult | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const best = useRef(0);
  const s = st.current;
  const night = plan[s.night];
  const unit = UNIT_COST * (s.steamer ? 0.8 : 1);

  const open = () => {
    best.current += Math.max(0, bestNightProfit(s, night));
    const r = runNight(s, night, made, price);
    setLast(r);
    setHistory([...history, Math.round(r.profit)]);
    playSfx(r.profit > 0 ? 'cash' : 'wrong');
    const ok = r.profit > 0 && !r.stockout && r.spoiled < r.made * 0.3;
    act((d, fx) => recordAnswer(d, fx, { id: 'stall-night', topic: 'business' }, ok));
    addReview?.({
      q: `Night ${s.night}: ${WICON[night.weather]} ${night.festival ? '🎉 festival' : ''} made ${r.made} at ${money(price)}`,
      ok,
      answer: `Profit ${money(r.profit)}`,
      explanation: `Revenue ${money(r.revenue)} (${r.sold} sold of ${r.demand} wanted) − supplies ${money(r.goodsCost)} − rent ${money(STALL_RENT)}. ${r.stockout ? 'You ran out, customers left unhappy.' : r.spoiled > r.made * 0.3 ? `${r.spoiled} dumplings went to waste.` : 'Nicely balanced!'}`,
    });
  };

  const buyUpgrade = (k: 'sign' | 'steamer', cost: number) => {
    if (s.cash < cost || s[k]) return;
    s.cash -= cost;
    s.totalProfit -= cost;
    s[k] = true;
    playSfx('buy');
    force((x) => x + 1);
  };

  const finish = () => {
    const total = s.totalProfit;
    const score = Math.max(0, Math.min(100, (total / Math.max(1, best.current * 0.85)) * 100));
    onFinish({ score, summary: `Total profit over ${params.nights} nights: ${money(total)}.`, stats: { bestStallProfit: Math.round(total) } });
  };

  if (last) {
    const done = s.night >= params.nights;
    return (
      <div className="col" style={{ gap: 10 }}>
        <b className="pixel">
          Night {s.night} results {WICON[plan[s.night - 1].weather]}
        </b>
        <div className="income-statement">
          <div className="row between">
            <span>
              Revenue ({last.sold} × {money(price)})
            </span>
            <b>{money(last.revenue)}</b>
          </div>
          <div className="row between">
            <span>
              Supplies ({last.made} × {money(unit)})
            </span>
            <span>−{money(last.goodsCost)}</span>
          </div>
          <div className="row between">
            <span>Stall rent</span>
            <span>−{money(STALL_RENT)}</span>
          </div>
          <div className={`row between bold ${last.profit >= 0 ? 'good' : 'bad'}`}>
            <span>PROFIT</span>
            <span>{money(last.profit, { sign: true })}</span>
          </div>
        </div>
        <div className="small">
          {last.demand} customers wanted dumplings. {last.stockout ? '😟 You sold out early, some customers left unhappy (reputation down).' : last.spoiled > 0 ? `${last.spoiled} leftovers spoiled.` : 'Perfect amount!'}
        </div>
        {history.length > 1 && <LineChart money height={110} series={[{ values: history, color: '#3cc45a' }]} labels={history.map((_, i) => `N${i + 1}`)} />}
        <Button variant="primary" size="big" onClick={() => (done ? finish() : setLast(null))}>
          {done ? 'See final results' : `Next night ▶`}
        </Button>
      </div>
    );
  }

  const est = demand(s, { ...night, weather: night.forecast }, price);
  return (
    <div className="col" style={{ gap: 10 }}>
      <StatGrid>
        <Stat label="Night" value={`${s.night + 1}/${params.nights}`} />
        <Stat label="Stall cash" value={money(s.cash)} />
        <Stat label="Total profit" value={money(s.totalProfit, { sign: true })} tone={s.totalProfit >= 0 ? 'good' : 'bad'} />
        {adv && <Stat label="Reputation" value={`${Math.round(s.reputation * 100)}%`} />}
      </StatGrid>
      <div className="card tint-teal">
        Forecast: <b>{WICON[night.forecast]} {night.forecast}</b> {night.festival && <b>· 🎉 Lantern festival tonight (big crowds)!</b>} · Competitor sells at <b>{money(night.competitorPrice)}</b>.
        <ReadAloud text={`The forecast is ${night.forecast}. The competitor sells dumplings for ${money(night.competitorPrice)}.`} />
        {!adv && <div className="small">Tip: rainy nights bring fewer customers. Lower prices bring more customers, but less money each.</div>}
      </div>
      {adv ? (
        <>
          <div className="alloc-row">
            <span className="bold">🥟 Dumplings to make ({money(unit)} each)</span>
            <input type="range" min={10} max={300} step={10} value={made} onChange={(e) => setMade(Number(e.target.value))} />
            <b className="mono">{made}</b>
          </div>
          <div className="alloc-row">
            <span className="bold">🏷️ Price</span>
            <input type="range" min={1} max={5} step={0.25} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            <b className="mono">{money(price)}</b>
          </div>
          <div className="small muted">
            Market research: at this price about <b>{est}</b> customers if the forecast is right. Cost of this batch: {money(made * unit)}.
          </div>
          <div className="row wrap" style={{ gap: 6 }}>
            <Button size="small" disabled={s.sign || s.cash < 40} onClick={() => buyUpgrade('sign', 40)}>
              {s.sign ? '✅ Neon sign' : '🪧 Neon sign $40 (+15% customers)'}
            </Button>
            <Button size="small" disabled={s.steamer || s.cash < 60} onClick={() => buyUpgrade('steamer', 60)}>
              {s.steamer ? '✅ Big steamer' : '♨️ Big steamer $60 (−20% cost/dumpling)'}
            </Button>
          </div>
        </>
      ) : (
        <>
          <b>How many dumplings will you make?</b>
          <div className="row wrap" style={{ gap: 8 }}>
            {[40, 80, 140].map((m) => (
              <Button key={m} variant={made === m ? 'gold' : undefined} onClick={() => setMade(m)}>
                {m === 40 ? '🥟 A few (40)' : m === 80 ? '🥟🥟 Some (80)' : '🥟🥟🥟 Lots (140)'}
              </Button>
            ))}
          </div>
          <b>What price?</b>
          <div className="row wrap" style={{ gap: 8 }}>
            {[1.5, 2.5, 4].map((p) => (
              <Button key={p} variant={price === p ? 'gold' : undefined} onClick={() => setPrice(p)}>
                {money(p)}
              </Button>
            ))}
          </div>
        </>
      )}
      <Button variant="green" size="big" onClick={open}>
        Open the stall 🏮
      </Button>
    </div>
  );
}
