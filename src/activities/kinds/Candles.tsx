'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { generateCandles, readChart, sma, type Candle } from '@/game/market/candles';
import { Button, ReadAloud } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import { makeRng } from '@/game/rng';
import { SECURITIES } from '@/game/market/market';

function Chart({ candles, reveal, advanced }: { candles: Candle[]; reveal: number; advanced: boolean }) {
  const W = 720;
  const H = advanced ? 300 : 240;
  const volH = advanced ? 50 : 0;
  const shown = candles.slice(0, candles.length - (3 - reveal));
  // Scale from past candles only, so the axis doesn't leak the future
  const past = candles.slice(0, candles.length - 3);
  const lo = Math.min(...past.map((c) => c.l)) * 0.92;
  const hi = Math.max(...past.map((c) => c.h)) * 1.08;
  const n = candles.length;
  const cw = (W - 50) / n;
  const x = (i: number) => 40 + i * cw + cw / 2;
  const y = (p: number) => Math.max(2, Math.min(H - volH - 6, 10 + (1 - (p - lo) / (hi - lo)) * (H - volH - 30)));
  const maxV = Math.max(...candles.map((c) => c.v));
  const closes = shown.map((c) => c.c);
  const ma20 = sma(closes, 20);
  const ma5 = sma(closes, 5);
  const line = (vals: (number | null)[]) =>
    vals
      .map((v, i) => (v === null ? null : `${x(i)},${y(v)}`))
      .filter(Boolean)
      .join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="kit-chart" role="img" aria-label="Candlestick chart">
      {[0, 0.5, 1].map((t) => {
        const p = lo + (hi - lo) * t;
        return (
          <g key={t}>
            <line x1={40} x2={W - 10} y1={y(p)} y2={y(p)} stroke="#eee3cc" />
            <text x={36} y={y(p) + 4} fontSize={11} textAnchor="end" fill="#4a5672">
              ${p.toFixed(0)}
            </text>
          </g>
        );
      })}
      <rect x={x(n - 3) - cw / 2} y={0} width={cw * 3} height={H} fill={reveal ? 'rgba(255,207,63,0.12)' : 'rgba(46,186,186,0.10)'} />
      {shown.map((c, i) => {
        const up = c.c >= c.o;
        const col = up ? '#2fae55' : '#e1553f';
        return (
          <g key={i}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={col} strokeWidth={2} />
            <rect x={x(i) - cw * 0.32} y={y(Math.max(c.o, c.c))} width={cw * 0.64} height={Math.max(2, Math.abs(y(c.o) - y(c.c)))} fill={col} rx={1.5} />
            {advanced && <rect x={x(i) - cw * 0.32} y={H - 4 - (c.v / maxV) * volH} width={cw * 0.64} height={(c.v / maxV) * volH} fill={up ? 'rgba(47,174,85,0.45)' : 'rgba(225,85,63,0.45)'} />}
          </g>
        );
      })}
      {advanced && <polyline points={line(ma20)} fill="none" stroke="#2f6bdb" strokeWidth={2.5} />}
      {advanced && <polyline points={line(ma5)} fill="none" stroke="#ff8a3d" strokeWidth={2} strokeDasharray="5 4" />}
      {!reveal && (
        <text x={x(n - 2)} y={H / 2} fontSize={34} textAnchor="middle">
          ❓
        </text>
      )}
    </svg>
  );
}

/** Predict the next 3 candles. Advanced adds volume, moving averages, a news event and position sizing. */
export default function Candles({ params, onFinish, addReview, seed }: KindProps<{ rounds: number; advanced: boolean }>) {
  const adv = params.advanced;
  const [round, setRound] = useState(0);
  const data = useMemo(() => {
    const r = makeRng(seed + round * 31);
    const sec = r.pick(SECURITIES.filter((s) => s.kind === 'stock'));
    const g = generateCandles(seed * 7 + round * 101, adv ? 40 : 24, 3, sec.price);
    const read = readChart(g.past);
    const news = adv && r.chance(0.35) ? (r.chance(0.5) ? { text: `${sec.name} beats earnings expectations`, dir: 1 } : { text: `${sec.name} warns sales will be weak`, dir: -1 }) : null;
    // News shifts the future path
    let future = g.future;
    if (news) future = future.map((c, i) => ({ ...c, c: c.c * (1 + news.dir * 0.03 * (i + 1)), h: Math.max(c.h, c.c * (1 + news.dir * 0.03 * (i + 1))), l: Math.min(c.l, c.c * (1 + news.dir * 0.03 * (i + 1))) }));
    return { sec, past: g.past, future, read, news };
  }, [seed, round, adv]);
  const [choice, setChoice] = useState<null | 1 | -1>(null);
  const [size, setSize] = useState(0.5);
  const [reveal, setReveal] = useState(0);
  const right = useRef(0);
  const points = useRef(0);
  const all = [...data.past, ...data.future];
  const lastPast = data.past[data.past.length - 1].c;
  const lastFuture = data.future[data.future.length - 1].c;
  const actual = lastFuture >= lastPast ? 1 : -1;
  const move = (lastFuture / lastPast - 1) * 100;

  const decide = (d: 1 | -1) => {
    setChoice(d);
    let k = 0;
    const tick = () => {
      k++;
      setReveal(k);
      if (k < 3) setTimeout(tick, 380);
      else {
        const ok = d === actual;
        if (ok) right.current++;
        points.current += (ok ? 1 : -1) * (adv ? size : 1) * Math.min(3, Math.abs(move) / 2 + 0.5);
        playSfx(ok ? 'cash' : 'wrong');
        act((w, fx) => recordAnswer(w, fx, { id: 'candles', topic: 'investing' }, ok));
        addReview?.({
          q: `${data.sec.name}: up or down?`,
          ok,
          answer: actual > 0 ? `Up ${move.toFixed(1)}%` : `Down ${Math.abs(move).toFixed(1)}%`,
          explanation: adv
            ? `Signals: ${data.read.label}${data.news ? `; news: "${data.news.text}"` : ''}. Signals tilt the odds but never guarantee the outcome.`
            : actual > 0
              ? 'The price kept climbing.'
              : 'The price went down this time.',
        });
      }
    };
    setTimeout(tick, 200);
  };

  const next = () => {
    if (round + 1 >= params.rounds) {
      const acc = right.current / params.rounds;
      const score = adv ? Math.max(0, Math.min(100, acc * 60 + Math.max(0, points.current) * 8)) : acc * 100;
      onFinish({ score, correct: right.current, total: params.rounds, summary: adv ? `Trading points: ${points.current.toFixed(1)}. Even pros are often wrong, that's why long-term investors diversify instead of guessing.` : undefined });
    } else {
      setRound(round + 1);
      setChoice(null);
      setReveal(0);
    }
  };

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between wrap">
        <b>
          {data.sec.icon} {data.sec.name} ({data.sec.symbol}) · Chart {round + 1}/{params.rounds}
        </b>
        <span className="small">
          ✅ {right.current}
          {adv && ` · Points ${points.current.toFixed(1)}`}
        </span>
      </div>
      <Chart candles={all} reveal={reveal} advanced={adv} />
      {adv && (
        <div className="tiny muted">
          <span style={{ color: '#2f6bdb' }}>━</span> 20-day moving average · <span style={{ color: '#ff8a3d' }}>╍</span> 5-day moving average · bars at the bottom = volume
        </div>
      )}
      {data.news && <div className="card tint-gold">📰 Breaking: {data.news.text}</div>}
      {choice === null ? (
        <>
          {adv && (
            <div className="row wrap" style={{ gap: 6 }}>
              <b className="small">Position size:</b>
              {[0.25, 0.5, 1].map((s) => (
                <Button key={s} size="small" variant={size === s ? 'gold' : undefined} onClick={() => setSize(s)}>
                  {s === 0.25 ? 'Small (25%)' : s === 0.5 ? 'Medium (50%)' : 'All in (100%)'}
                </Button>
              ))}
            </div>
          )}
          <div className="row" style={{ justifyContent: 'center', gap: 16 }}>
            <Button size="huge" variant="green" onClick={() => decide(1)}>
              📈 Up
            </Button>
            <Button size="huge" variant="danger" onClick={() => decide(-1)}>
              📉 Down
            </Button>
          </div>
          {!adv && (
            <div className="small muted center">
              Tip: Is the chart mostly climbing or mostly falling lately? <ReadAloud text="Look at the chart. Is it mostly going up or mostly going down lately?" />
            </div>
          )}
        </>
      ) : reveal >= 3 ? (
        <div className={`card ${choice === actual ? 'tint-green' : 'tint-red'}`}>
          <b>{choice === actual ? 'Nice call!' : 'Not this time.'}</b> The price went {actual > 0 ? 'up' : 'down'} {Math.abs(move).toFixed(1)}%.{' '}
          {adv ? `Signals: ${data.read.label}.` : actual > 0 ? 'It kept going up!' : 'It went down.'}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button variant="primary" onClick={next}>
              Next ▶
            </Button>
          </div>
        </div>
      ) : (
        <div className="center bold">Revealing…</div>
      )}
    </div>
  );
}
