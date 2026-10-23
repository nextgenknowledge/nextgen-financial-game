'use client';
/**
 * Rapid-Fire Markets (Advanced). Sixty seconds of trader mental maths: percentage moves, basis
 * points, the rule of 72, current yield, P/E, currency crosses and margins. Streaks score extra,
 * wrong answers cost two seconds.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng, type Rng } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { cls } from '@/ui/format';
import { useActivityPaused } from '../paused';
import { Big, ProHead } from './pro/kit';

interface Drill {
  tag: string;
  q: string;
  answer: string;
  wrong: string[];
  why: string;
}

const fmt = (v: number, d = 2) => (+v.toFixed(d)).toLocaleString('en-US');

const MAKERS: ((r: Rng) => Drill)[] = [
  (r) => {
    const a = r.pick([40, 50, 80, 120, 200, 250]);
    const pct = r.pick([5, 10, 12.5, 20, 25, 40]) * (r.chance(0.5) ? 1 : -1);
    const b = a * (1 + pct / 100);
    return { tag: '% move', q: `A stock goes from $${a} to $${fmt(b)}. Percent change?`, answer: `${pct > 0 ? '+' : ''}${pct}%`, wrong: [`${pct > 0 ? '+' : ''}${pct * 2}%`, `${pct > 0 ? '-' : '+'}${Math.abs(pct)}%`, `${pct > 0 ? '+' : ''}${fmt(pct / 2, 1)}%`], why: `(${fmt(b)} − ${a}) ÷ ${a} = ${pct}%.` };
  },
  (r) => {
    const bp = r.pick([25, 50, 75, 125, 150]);
    return { tag: 'Basis points', q: `The central bank hikes by ${bp} basis points. In percent?`, answer: `${fmt(bp / 100)}%`, wrong: [`${bp / 10}%`, `${bp}%`, `${fmt(bp / 1000, 3)}%`], why: '1 basis point = 0.01%.' };
  },
  (r) => {
    const rate = r.pick([3, 4, 6, 8, 9, 12]);
    return { tag: 'Rule of 72', q: `Roughly how many years to double at ${rate}% a year?`, answer: `${fmt(72 / rate, 1)} years`, wrong: [`${fmt(100 / rate, 1)} years`, `${fmt(72 / rate / 2, 1)} years`, `${rate * 2} years`], why: `72 ÷ ${rate} ≈ ${fmt(72 / rate, 1)}.` };
  },
  (r) => {
    const c = r.pick([3, 4, 5, 6]);
    const px = r.pick([80, 90, 100, 120, 125]);
    const y = (c * 10) / px * 100;
    return { tag: 'Current yield', q: `A bond pays a ${c}% coupon on $1,000 face and trades at ${px}. Current yield?`, answer: `${fmt(y, 1)}%`, wrong: [`${c}%`, `${fmt(y * 1.2, 1)}%`, `${fmt((c * px) / 100, 1)}%`], why: `$${c * 10} ÷ $${px * 10} = ${fmt(y, 1)}%. Price below par → yield above coupon.` };
  },
  (r) => {
    const eps = r.pick([2, 2.5, 4, 5, 8]);
    const pe = r.pick([10, 15, 20, 25, 30]);
    return { tag: 'P/E', q: `Earnings per share $${eps}, P/E ${pe}. Share price?`, answer: `$${fmt(eps * pe)}`, wrong: [`$${fmt(eps + pe)}`, `$${fmt((pe / eps) * 10)}`, `$${fmt(eps * pe * 1.5)}`], why: `Price = P/E × EPS = ${pe} × $${eps}.` };
  },
  (r) => {
    const eu = r.pick([1.08, 1.1, 1.2]);
    const gu = r.pick([1.25, 1.3, 1.35]);
    const eg = eu / gu;
    return { tag: 'FX cross', q: `EUR/USD ${eu}, GBP/USD ${gu}. What is EUR/GBP?`, answer: fmt(eg, 3), wrong: [fmt(gu / eu, 3), fmt(eu * gu, 3), fmt(eg * 1.1, 3)], why: `EUR/GBP = EUR/USD ÷ GBP/USD = ${eu} ÷ ${gu}.` };
  },
  (r) => {
    const rev = r.pick([200, 400, 500, 800]);
    const cost = Math.round(rev * r.pick([0.6, 0.7, 0.75, 0.8]));
    const m = ((rev - cost) / rev) * 100;
    return { tag: 'Margin', q: `Revenue $${rev}M, costs $${cost}M. Profit margin?`, answer: `${fmt(m, 1)}%`, wrong: [`${fmt((cost / rev) * 100, 1)}%`, `${fmt(((rev - cost) / cost) * 100, 1)}%`, `${rev - cost}%`], why: `($${rev}M − $${cost}M) ÷ $${rev}M.` };
  },
  (r) => {
    const loss = r.pick([20, 25, 33, 50]);
    const need = (1 / (1 - loss / 100) - 1) * 100;
    return { tag: 'Recovery', q: `A fund falls ${loss}%. What gain gets it back to even?`, answer: `${fmt(need, 0)}%`, wrong: [`${loss}%`, `${fmt(loss * 1.2, 0)}%`, `${fmt(loss / 2, 0)}%`], why: `After −${loss}% you hold ${100 - loss}% and need ×${fmt(1 / (1 - loss / 100), 2)}. Losses hurt more than gains help.` };
  },
  (r) => {
    const d = r.pick([1, 1.5, 2, 3]);
    const px = r.pick([40, 50, 60, 100]);
    return { tag: 'Dividend yield', q: `A $${px} stock pays $${d} a year in dividends. Yield?`, answer: `${fmt((d / px) * 100, 2)}%`, wrong: [`${fmt((px / d) / 10, 2)}%`, `${d}%`, `${fmt((d / px) * 1000, 1)}%`], why: `$${d} ÷ $${px}.` };
  },
];

export default function RapidFire({ onFinish, addReview, seed }: KindProps) {
  const paused = useActivityPaused();
  const rng = useMemo(() => makeRng(seed * 7 + 5), [seed]);
  const make = () => {
    const d = rng.pick(MAKERS)(rng);
    const opts = rng.shuffle([d.answer, ...[...new Set(d.wrong)].filter((w) => w !== d.answer).slice(0, 3)]);
    return { ...d, opts };
  };
  const [cur, setCur] = useState(make);
  const [time, setTime] = useState(60);
  const [pts, setPts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [flash, setFlash] = useState<null | { ok: boolean; why: string }>(null);
  const stats = useRef({ right: 0, wrong: 0, best: 0 });
  const ended = useRef(false);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setTime((t) => t - 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (time > 0 || ended.current) return;
    ended.current = true;
    const s = stats.current;
    addReview?.({ q: 'Rapid-fire round', ok: s.right >= 12, answer: `${s.right} right, ${s.wrong} wrong, best streak ${s.best}`, explanation: 'Traders drill these until they are instant: basis points, percentage moves, crosses and yields come up in every conversation on a desk.' });
    onFinish({ score: Math.min(100, pts * 4), correct: s.right, total: s.right + s.wrong, summary: `${pts} points, best streak ${s.best}.` });
  }, [time, pts, addReview, onFinish]);

  const pick = (o: string) => {
    if (time <= 0) return;
    const ok = o === cur.answer;
    const s = stats.current;
    if (ok) {
      s.right++;
      const st = streak + 1;
      s.best = Math.max(s.best, st);
      setStreak(st);
      setPts((p) => p + 1 + (st >= 5 ? 1 : 0));
      playSfx('correct');
    } else {
      s.wrong++;
      setStreak(0);
      setTime((t) => Math.max(0, t - 2));
      playSfx('wrong');
      addReview?.({ q: cur.q, ok: false, answer: cur.answer, explanation: cur.why });
    }
    setFlash({ ok, why: ok ? cur.why : `Answer: ${cur.answer}. ${cur.why}` });
    setCur(make());
  };

  return (
    <div className="pro">
      <ProHead kicker={`Rapid-fire markets · ${time}s`} title={<span className="rf-tag">{cur.tag}</span>} sub="Five in a row doubles your points. Wrong answers cost 2 seconds." right={<Big label={`Points${streak >= 5 ? ' · x2 streak' : ''}`} value={pts} />} />
      <div className="rf-timer">
        <i style={{ width: `${(Math.max(0, time) / 60) * 100}%` }} />
      </div>
      <section className="pro-panel rf-card">
        <div className="rf-q">{cur.q}</div>
        <div className="pro-choices">
          {cur.opts.map((o) => (
            <button key={o} type="button" className="pro-pill rf-opt" onClick={() => pick(o)}>
              {o}
            </button>
          ))}
        </div>
      </section>
      <div className={cls('small', flash?.ok ? 'rf-ok' : 'rf-no')} style={{ minHeight: '1.4em' }}>
        {flash && `${flash.ok ? 'Correct. ' : ''}${flash.why}`}
      </div>
    </div>
  );
}
