'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { Stat, StatGrid } from '@/ui/kit';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

const PORTS = [
  { id: 'hk', name: 'Hong Kong', icon: '🏮' },
  { id: 'sg', name: 'Singapore', icon: '🦁' },
  { id: 'ld', name: 'London', icon: '🎡' },
  { id: 'sf', name: 'San Francisco', icon: '🌉' },
];
const GOODS = [
  { id: 'tea', name: 'Tea', icon: '🍵', base: { hk: 6, sg: 9, ld: 16, sf: 13 } },
  { id: 'tech', name: 'Electronics', icon: '📱', base: { hk: 30, sg: 34, ld: 52, sf: 40 } },
  { id: 'spice', name: 'Spices', icon: '🌶️', base: { hk: 14, sg: 8, ld: 22, sf: 20 } },
  { id: 'silk', name: 'Silk', icon: '🧣', base: { hk: 18, sg: 24, ld: 40, sf: 34 } },
  { id: 'wine', name: 'Grape juice', icon: '🍇', base: { hk: 24, sg: 22, ld: 18, sf: 10 } },
];
type PortId = 'hk' | 'sg' | 'ld' | 'sf';

/** Buy low, ship, sell high, with supply/demand price impact, shipping costs and storms. */
export default function Trading({ params, onFinish, addReview, seed }: KindProps<{ turns: number; advanced: boolean }>) {
  const adv = params.advanced;
  const rng = useMemo(() => makeRng(seed), [seed]);
  const goods = adv ? GOODS : GOODS.slice(0, 3);
  const ports = adv ? PORTS : PORTS.slice(0, 3);
  const START = 1000;
  const CAP = adv ? 60 : 40;
  const SHIP = adv ? 60 : 30;
  const [port, setPort] = useState<PortId>('hk');
  const [turn, setTurn] = useState(1);
  const [cash, setCash] = useState(START);
  const [hold, setHold] = useState<Record<string, number>>({});
  // Price multipliers per port/good drift each turn; your trades push prices
  const [mult, setMult] = useState<Record<string, number>>(() => Object.fromEntries(ports.flatMap((p) => goods.map((g) => [`${p.id}:${g.id}`, 1]))));
  const [news, setNews] = useState<string>('Welcome, trader! Buy where goods are cheap, sell where they are expensive.');
  const trades = useRef(0);
  const cargo = Object.values(hold).reduce((a, b) => a + b, 0);
  const price = (g: (typeof GOODS)[number], p: PortId) => Math.round(g.base[p] * mult[`${p}:${g.id}`] * 100) / 100;

  const trade = (g: (typeof GOODS)[number], qty: number) => {
    const key = `${port}:${g.id}`;
    const p = price(g, port);
    if (qty > 0) {
      if (cash < p * qty || cargo + qty > CAP) return playSfx('error');
      setCash(cash - p * qty);
      setHold({ ...hold, [g.id]: (hold[g.id] ?? 0) + qty });
      if (adv) setMult({ ...mult, [key]: mult[key] * (1 + 0.012 * qty) }); // buying pushes price up
    } else {
      const n = Math.min(-qty, hold[g.id] ?? 0);
      if (!n) return;
      setCash(cash + p * n);
      setHold({ ...hold, [g.id]: (hold[g.id] ?? 0) - n });
      if (adv) setMult({ ...mult, [key]: mult[key] * (1 - 0.015 * n) }); // flooding the market drops price
    }
    trades.current++;
    playSfx('coin');
  };

  const sail = (to: PortId) => {
    if (to === port) return;
    let msg = `Sailed to ${PORTS.find((p) => p.id === to)!.name}. Shipping cost ${money(SHIP, { cents: false })}.`;
    let c = cash - SHIP;
    const m = { ...mult };
    // Prices drift back toward normal and wobble
    for (const k of Object.keys(m)) m[k] = 1 + (m[k] - 1) * 0.5 + rng.normal() * 0.05;
    if (rng.chance(adv ? 0.25 : 0.15)) {
      const g = rng.pick(goods);
      const p = rng.pick(ports);
      const up = rng.chance(0.5);
      m[`${p.id}:${g.id}`] *= up ? 1.35 : 0.7;
      msg += ` 📰 ${up ? `${g.name} shortage in ${p.name}, prices up!` : `${g.name} glut in ${p.name}, prices down.`}`;
    }
    if (adv && rng.chance(0.12)) {
      c -= 40;
      msg += ' ⛈️ A storm delayed you, $40 in extra costs.';
    }
    setMult(m);
    setCash(c);
    setPort(to);
    setNews(msg);
    playSfx('whoosh');
    if (turn >= params.turns) finish(c);
    else setTurn(turn + 1);
  };

  const finish = (finalCash = cash) => {
    // Unsold cargo is valued at the lowest price anywhere
    const cargoValue = goods.reduce((s, g) => s + (hold[g.id] ?? 0) * Math.min(...ports.map((p) => price(g, p.id as PortId))), 0);
    const end = finalCash + cargoValue;
    const gain = end / START - 1;
    const score = Math.max(0, Math.min(100, 30 + gain * (adv ? 120 : 150)));
    act((d, fx) => recordAnswer(d, fx, { id: 'trading', topic: 'economics' }, gain > 0));
    addReview?.({ q: 'Trading result', ok: gain > 0, answer: `${money(START, { cents: false })} → ${money(end)}`, explanation: 'Profit comes from price differences between markets minus shipping costs. Selling lots at once pushes the price down (supply and demand), so spreading sales across ports often earns more.' });
    onFinish({ score, summary: `You turned ${money(START, { cents: false })} into ${money(end)}.` });
  };

  const here = PORTS.find((p) => p.id === port)!;
  return (
    <div className="col" style={{ gap: 10 }}>
      <StatGrid>
        <Stat label="Turn" value={`${turn}/${params.turns}`} />
        <Stat label="Port" value={`${here.icon} ${here.name}`} />
        <Stat label="Cash" value={money(cash)} tone={cash >= START ? 'good' : undefined} />
        <Stat label="Cargo" value={`${cargo}/${CAP}`} />
      </StatGrid>
      <div className="card tint-gold small">
        {news} <ReadAloud text={news} />
      </div>
      <table className="kit-table">
        <thead>
          <tr>
            <th>Good</th>
            {ports.map((p) => (
              <th key={p.id}>
                {p.icon} {p.name}
              </th>
            ))}
            <th>In hold</th>
            <th>Trade here</th>
          </tr>
        </thead>
        <tbody>
          {goods.map((g) => (
            <tr key={g.id}>
              <td className="bold">
                {g.icon} {g.name}
              </td>
              {ports.map((p) => (
                <td key={p.id} className={`mono ${p.id === port ? 'bold' : ''}`}>
                  {money(price(g, p.id as PortId))}
                </td>
              ))}
              <td className="mono">{hold[g.id] ?? 0}</td>
              <td>
                <div className="row" style={{ gap: 4 }}>
                  <Button size="small" onClick={() => trade(g, 5)}>
                    Buy 5
                  </Button>
                  <Button size="small" disabled={!hold[g.id]} onClick={() => trade(g, -5)}>
                    Sell 5
                  </Button>
                  <Button size="small" disabled={!hold[g.id]} onClick={() => trade(g, -(hold[g.id] ?? 0))}>
                    Sell all
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="row wrap" style={{ gap: 8 }}>
        <b>Sail to:</b>
        {ports
          .filter((p) => p.id !== port)
          .map((p) => (
            <Button key={p.id} variant="blue" onClick={() => sail(p.id as PortId)}>
              ⛵ {p.icon} {p.name}
            </Button>
          ))}
        <Button size="small" variant="ghost" onClick={() => finish()}>
          Retire & count my money
        </Button>
      </div>
      {adv && <div className="tiny muted">Each trade moves the local price: buying pushes it up, selling pushes it down. Prices drift back over time.</div>}
    </div>
  );
}
