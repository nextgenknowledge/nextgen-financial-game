'use client';
/**
 * Order Book Scalper (Advanced). A live limit order book. Market orders cross the spread and fill
 * now; limit orders join the queue at your price and only fill if the market comes to you. Stay
 * within the position limit, read the order flow, and finish flat. Teaches spread, liquidity,
 * market vs limit orders and inventory risk.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { useActivityPaused } from '../paused';
import { Big, C, LineChart, ProHead, Stats, usd } from './pro/kit';

const TICK = 0.05;
const LIMIT = 5; // max shares (hundreds) long or short
const LOT = 100;
const SECONDS = 75;

interface Resting {
  side: 'buy' | 'sell';
  px: number;
}

const r2 = (v: number) => Math.round(v / TICK) * TICK;

export default function OrderBook({ onFinish, addReview, seed }: KindProps) {
  const paused = useActivityPaused();
  const rng = useMemo(() => makeRng(seed * 3 + 17), [seed]);
  const name = useMemo(() => makeRng(seed).pick(['Harbour Bank', 'Peak Tech', 'Lantern Motors', 'Jade Energy', 'Kowloon Telecom', 'Victoria Foods']), [seed]);
  const [mid, setMid] = useState(50);
  const [hist, setHist] = useState<number[]>([50]);
  const [left, setLeft] = useState(SECONDS);
  const [pos, setPos] = useState(0); // lots
  const [cash, setCash] = useState(0);
  const [orders, setOrders] = useState<Resting[]>([]);
  const [flash, setFlash] = useState<string | null>(null);
  const [news, setNews] = useState<{ text: string; drift: number; t: number } | null>(null);
  const [fills, setFills] = useState(0);
  const [over, setOver] = useState(false);
  const state = useRef({ mid: 50, drift: 0, pos: 0, cash: 0, orders: [] as Resting[], spreadT: 1 });
  state.current.pos = pos;
  state.current.cash = cash;
  state.current.orders = orders;

  const spread = state.current.spreadT * TICK;
  const bid = r2(mid - spread / 2);
  const ask = r2(bid + Math.max(TICK, spread));

  // Market ticks
  useEffect(() => {
    if (paused || over) return;
    const id = setInterval(() => {
      const s = state.current;
      if (rng.chance(0.06)) {
        const up = rng.chance(0.5);
        const lines = up
          ? ['Big buyer sweeping the offer', 'Upgrade from a top broker', 'Rumour of a takeover bid']
          : ['Large fund dumping shares', 'Profit warning from a rival', 'Index rebalance selling'];
        s.drift = (up ? 1 : -1) * rng.range(0.035, 0.06);
        setNews({ text: rng.pick(lines), drift: s.drift, t: 6 });
      }
      s.drift *= 0.86;
      // Spread widens on news and in fast markets
      s.spreadT = Math.abs(s.drift) > 0.02 ? 3 : rng.chance(0.3) ? 2 : 1;
      s.mid = Math.max(5, s.mid + s.drift + 0.04 * rng.normal());
      const nb = r2(s.mid - (s.spreadT * TICK) / 2);
      const na = r2(nb + s.spreadT * TICK);
      // Resting limit orders fill when the market trades through them
      const keep: Resting[] = [];
      let p = s.pos;
      let c = s.cash;
      let filled = 0;
      for (const o of s.orders) {
        const hit = o.side === 'buy' ? na <= o.px || (nb <= o.px && rng.chance(0.35)) : nb >= o.px || (na >= o.px && rng.chance(0.35));
        if (hit && Math.abs(p + (o.side === 'buy' ? 1 : -1)) <= LIMIT) {
          p += o.side === 'buy' ? 1 : -1;
          c += (o.side === 'buy' ? -1 : 1) * o.px * LOT;
          filled++;
        } else keep.push(o);
      }
      if (filled) {
        playSfx('coin');
        setFills((f) => f + filled);
        setFlash(`Limit order filled ×${filled}`);
      }
      setPos(p);
      setCash(c);
      setOrders(keep);
      setMid(s.mid);
      setHist((h) => [...h.slice(-119), s.mid]);
      setNews((n) => (n && n.t > 1 ? { ...n, t: n.t - 1 } : null));
    }, 700);
    return () => clearInterval(id);
  }, [paused, over, rng]);

  useEffect(() => {
    if (paused || over) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [paused, over]);

  // Time up: flatten at the touch (pay the spread) and score
  useEffect(() => {
    if (left > 0 || over) return;
    setOver(true);
    const s = state.current;
    const flat = s.pos > 0 ? s.pos * bid * LOT : s.pos < 0 ? s.pos * ask * LOT : 0;
    const pnl = s.cash + flat;
    const score = Math.max(0, Math.min(100, 50 + pnl / 4));
    addReview?.({ q: 'Order book session', ok: pnl > 0, answer: `P&L ${usd(pnl, 2)} with ${fills} limit fills`, explanation: 'Market makers earn the spread by posting limit orders on both sides, and cut inventory fast when the flow turns against them. Crossing the spread on every trade pays it away.' });
    addReview?.({ q: 'Why were you flattened at the end?', ok: s.pos === 0, answer: s.pos === 0 ? 'You finished flat' : `You held ${s.pos * LOT} shares`, explanation: 'Desks close the day flat to avoid overnight risk. Closing with a market order means paying the spread one last time.' });
    setTimeout(() => onFinish({ score, summary: `Session P&L ${usd(pnl, 2)}. ${fills} limit orders filled.`, stats: { bestScalpPnl: Math.round(pnl) } }), 900);
  }, [left, over, bid, ask, fills, addReview, onFinish]);

  const mark = cash + pos * mid * LOT;
  const trade = (side: 'buy' | 'sell') => {
    const np = pos + (side === 'buy' ? 1 : -1);
    if (Math.abs(np) > LIMIT) {
      setFlash('Position limit reached');
      playSfx('wrong');
      return;
    }
    setPos(np);
    setCash((c) => c + (side === 'buy' ? -ask : bid) * LOT);
    setFlash(`${side === 'buy' ? 'Bought' : 'Sold'} ${LOT} @ ${(side === 'buy' ? ask : bid).toFixed(2)}`);
    playSfx('click');
  };
  const post = (side: 'buy' | 'sell') => {
    if (orders.length >= 4) {
      setFlash('Max 4 resting orders');
      return;
    }
    setOrders((o) => [...o, { side, px: side === 'buy' ? bid : ask }]);
    playSfx('pop');
  };

  // Depth ladder around the touch
  const depth = (k: number, side: 'b' | 'a') => 200 + Math.round(((Math.sin(mid * 7 + k * 3 + (side === 'a' ? 1 : 0)) + 1.2) * 900) / 100) * 100;
  const ladder = [4, 3, 2, 1, 0].map((k) => r2(ask + k * TICK)).concat([0, 1, 2, 3, 4].map((k) => r2(bid - k * TICK)));

  return (
    <div className="pro">
      <ProHead kicker={`Order book · ${name} · ${left}s left`} title="Make the spread, manage the risk" sub={`Trade in lots of ${LOT}. Position limit ±${LIMIT} lots. Anything open at the bell is closed at market.`} right={<Big label="P&L (marked)" value={usd(mark, 2)} tone={mark >= 0 ? 'good' : 'bad'} />} />
      {news && <div className={cls('ob-news', news.drift > 0 ? 'up' : 'down')}>NEWS: {news.text}</div>}
      <div className="pro-grid">
        <section className="pro-panel">
          <h4>Order book</h4>
          <div className="ob-ladder">
            {ladder.map((px, i) => {
              const isAsk = i < 5;
              const mine = orders.filter((o) => Math.abs(o.px - px) < 1e-6).length;
              return (
                <div key={i} className={cls('ob-row', isAsk ? 'ask' : 'bid', (i === 4 || i === 5) && 'touch')}>
                  <span>{!isAsk ? depth(i - 5, 'b').toLocaleString() : ''}</span>
                  <b>{px.toFixed(2)}</b>
                  <span>{isAsk ? depth(4 - i, 'a').toLocaleString() : ''}</span>
                  {mine > 0 && <i className="ob-mine">YOU ×{mine}</i>}
                </div>
              );
            })}
          </div>
          <div className="small muted" style={{ marginTop: 6 }}>
            Spread: {(ask - bid).toFixed(2)} · Resting orders: {orders.length}
            {orders.length > 0 && (
              <button type="button" className="link-btn" style={{ marginLeft: 8 }} onClick={() => setOrders([])}>
                cancel all
              </button>
            )}
          </div>
        </section>
        <section className="pro-panel">
          <h4>Price</h4>
          <LineChart series={[{ pts: hist.length > 1 ? hist : [mid, mid], color: C.blue }]} h={170} fmt={(v) => v.toFixed(2)} />
          <Stats items={[['Position', `${pos * LOT >= 0 ? '+' : ''}${pos * LOT}`, pos === 0 ? undefined : Math.abs(pos) >= LIMIT ? 'bad' : undefined], ['Cash', usd(cash, 0)], ['Limit fills', fills]]} />
          <div className="ob-actions">
            <Button variant="primary" disabled={over} onClick={() => trade('buy')}>
              Buy now @ {ask.toFixed(2)}
            </Button>
            <Button variant="danger" disabled={over} onClick={() => trade('sell')}>
              Sell now @ {bid.toFixed(2)}
            </Button>
            <Button disabled={over} onClick={() => post('buy')}>
              Bid {bid.toFixed(2)} (limit)
            </Button>
            <Button disabled={over} onClick={() => post('sell')}>
              Offer {ask.toFixed(2)} (limit)
            </Button>
          </div>
          <div className="small muted" style={{ minHeight: '1.3em' }}>{flash}</div>
        </section>
      </div>
    </div>
  );
}
