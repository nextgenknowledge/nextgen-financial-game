'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { Button } from '@/ui/common';
import { LineChart, Stat, StatGrid } from '@/ui/kit';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';
import { QuestionView } from '../QuestionView';
import { synthQ } from '../QuestionSeq';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';

/** Try to time the market month by month, then compare with automatic dollar-cost averaging. */
export default function Dca({ params, difficulty, onFinish, addReview, seed }: KindProps<{ months: number }>) {
  const prices = useMemo(() => {
    const rng = makeRng(seed);
    const p = [40];
    for (let i = 1; i < params.months; i++) p.push(Math.max(8, p[i - 1] * (1 + 0.007 + rng.normal() * 0.07)));
    return p.map((x) => Math.round(x * 100) / 100);
  }, [seed, params.months]);
  const [m, setM] = useState(0);
  const [cash, setCash] = useState(0);
  const [shares, setShares] = useState(0);
  const [phase, setPhase] = useState<'play' | 'compare' | 'quiz'>('play');
  const pts = useRef(0);
  const monthly = 100;
  const dcaShares = prices.reduce((s, p) => s + monthly / p, 0);
  const finalPrice = prices[prices.length - 1];

  const step = (buy: boolean) => {
    const available = cash + monthly;
    let c = available;
    let sh = shares;
    if (buy) {
      sh += available / prices[m];
      c = 0;
      playSfx('coin');
    } else playSfx('tick');
    if (m + 1 >= params.months) {
      // Unspent cash at the end is invested at the final price
      sh += c / finalPrice;
      setShares(sh);
      setCash(0);
      setPhase('compare');
    } else {
      setShares(sh);
      setCash(c);
      setM(m + 1);
    }
  };

  if (phase === 'play') {
    return (
      <div className="col" style={{ gap: 10 }}>
        <p className="small">
          Each month you get <b>{money(monthly, { cents: false })}</b> to invest in the FCX index. Buy now, or wait for a better price? (Waiting money sits as cash.)
        </p>
        <LineChart money series={[{ values: prices.slice(0, m + 1), color: '#2f6bdb' }]} labels={prices.slice(0, m + 1).map((_, i) => `M${i + 1}`)} height={170} />
        <StatGrid>
          <Stat label="Month" value={`${m + 1}/${params.months}`} />
          <Stat label="Price now" value={money(prices[m])} />
          <Stat label="Cash waiting" value={money(cash + monthly)} />
          <Stat label="Shares" value={shares.toFixed(2)} />
        </StatGrid>
        <div className="row" style={{ justifyContent: 'center', gap: 12 }}>
          <Button size="big" variant="green" onClick={() => step(true)}>
            🛒 Buy now
          </Button>
          <Button size="big" onClick={() => step(false)}>
            ⏳ Wait
          </Button>
        </div>
      </div>
    );
  }

  const yours = shares * finalPrice;
  const dca = dcaShares * finalPrice;
  const avgCost = (monthly * params.months) / dcaShares;
  if (phase === 'compare') {
    const beat = yours >= dca - 0.5;
    return (
      <div className="col" style={{ gap: 10 }}>
        <LineChart money series={[{ values: prices, color: '#2f6bdb' }]} labels={prices.map((_, i) => `M${i + 1}`)} height={160} />
        <StatGrid>
          <Stat label="Your timing" value={money(yours)} tone={beat ? 'good' : 'bad'} sub={`${shares.toFixed(2)} shares`} />
          <Stat label="Auto-invest every month (DCA)" value={money(dca)} sub={`${dcaShares.toFixed(2)} shares`} />
          <Stat label="DCA average cost / share" value={money(avgCost)} sub={`Average price was ${money(prices.reduce((a, b) => a + b, 0) / prices.length)}`} />
        </StatGrid>
        <div className="card tint-gold">
          {beat ? 'You matched or beat steady investing, nice! But it took guessing right many times.' : 'Steady monthly investing beat your timing. Most people (even pros) struggle to time the market.'} With DCA, a fixed amount buys MORE shares when prices are low and fewer when high, so your average cost is lower than the average price.
        </div>
        <Button
          variant="primary"
          size="big"
          onClick={() => {
            pts.current += beat ? 50 : 35;
            setPhase('quiz');
          }}
        >
          One more question ▶
        </Button>
      </div>
    );
  }

  const q = synthQ({
    prompt:
      difficulty === 'entry'
        ? `With DCA you invested ${money(monthly * params.months, { cents: false })} and got ${dcaShares.toFixed(2)} shares. Which is true?`
        : `DCA invested ${money(monthly * params.months, { cents: false })} and bought ${dcaShares.toFixed(4)} shares. What was the average cost per share?`,
    topic: 'investing',
    ...(difficulty === 'entry'
      ? { choices: ['Buying a little every month means you buy more shares when prices are low', 'You must always buy at the top', 'Waiting always wins', 'Prices never change'], correct: 0 }
      : { value: avgCost, format: 'money' as const }),
    explanation: `Average cost = total invested ÷ shares = ${money(monthly * params.months, { cents: false })} ÷ ${dcaShares.toFixed(4)} = ${money(avgCost)}.`,
  });
  return (
    <QuestionView
      q={q}
      entry={difficulty === 'entry'}
      allowRetry={difficulty === 'entry'}
      onAnswered={(o) => {
        act((w, fx) => recordAnswer(w, fx, q, o.correct));
        addReview?.({ q: q.prompt, ok: o.correct, answer: difficulty === 'entry' ? q.choices[0] : money(avgCost), explanation: q.explanation });
        onFinish({ score: pts.current + o.credit * 50 });
      }}
    />
  );
}
