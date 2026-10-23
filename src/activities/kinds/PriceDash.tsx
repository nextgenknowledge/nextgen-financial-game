'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useActivityPaused } from '../paused';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { playSfx } from '@/engine/audio';
import { money } from '@/ui/format';

const PRODUCTS = [
  { name: 'Apples', icon: '🍎', unit: 'apple' },
  { name: 'Juice', icon: '🧃', unit: 'box' },
  { name: 'Pencils', icon: '✏️', unit: 'pencil' },
  { name: 'Cookies', icon: '🍪', unit: 'cookie' },
  { name: 'Batteries', icon: '🔋', unit: 'battery' },
  { name: 'Eggs', icon: '🥚', unit: 'egg' },
  { name: 'Markers', icon: '🖍️', unit: 'marker' },
  { name: 'Water bottles', icon: '💧', unit: 'bottle' },
];

/** Fast "which is the better deal?", totals in Entry, unit prices in Advanced. */
export default function PriceDash({ params, onFinish, seed }: KindProps<{ time: number; unit: boolean }>) {
  const rng = useMemo(() => makeRng(seed), [seed]);
  const make = () => {
    const p = rng.pick(PRODUCTS);
    if (!params.unit) {
      const a = rng.int(10, 60) / 4;
      let b = rng.int(10, 60) / 4;
      if (b === a) b += 0.5;
      return { p, a: { price: a, qty: 1 }, b: { price: b, qty: 1 } };
    }
    const qa = rng.pick([4, 6, 8, 10, 12]);
    const qb = rng.pick([3, 5, 6, 9, 15, 18].filter((x) => x !== qa));
    const unit = rng.range(0.2, 1.5);
    const a = Math.round(qa * unit * rng.range(0.85, 1.15) * 100) / 100;
    let b = Math.round(qb * unit * rng.range(0.85, 1.15) * 100) / 100;
    if (Math.abs(a / qa - b / qb) < 0.01) b += 0.3;
    return { p, a: { price: a, qty: qa }, b: { price: b, qty: qb } };
  };
  const [cur, setCur] = useState(make);
  const [left, setLeft] = useState(params.time);
  const [flash, setFlash] = useState<null | boolean>(null);
  const right = useRef(0);
  const wrong = useRef(0);
  const ended = useRef(false);
  const paused = useActivityPaused();
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setLeft((l) => l - 1), 1000);
    return () => clearInterval(id);
  }, [paused]);
  useEffect(() => {
    if (left <= 0 && !ended.current) {
      ended.current = true;
      const net = right.current - wrong.current;
      onFinish({ score: Math.max(0, Math.min(100, (net / (params.unit ? 14 : 18)) * 100)), correct: right.current, total: right.current + wrong.current, summary: `${right.current} right, ${wrong.current} wrong.` });
    }
  }, [left, onFinish, params.unit]);
  const unitA = cur.a.price / cur.a.qty;
  const unitB = cur.b.price / cur.b.qty;
  const pick = (side: 'a' | 'b') => {
    const ok = side === 'a' ? unitA < unitB : unitB < unitA;
    if (ok) right.current++;
    else wrong.current++;
    playSfx(ok ? 'coin' : 'wrong');
    setFlash(ok);
    setTimeout(() => setFlash(null), 250);
    setCur(make());
  };
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') pick('a');
      if (e.code === 'ArrowRight' || e.code === 'KeyD') pick('b');
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });
  const Tag = ({ s, side }: { s: { price: number; qty: number }; side: 'a' | 'b' }) => (
    <button className="price-tag" onClick={() => pick(side)}>
      <span style={{ fontSize: '2.6rem' }}>{cur.p.icon}</span>
      {params.unit && (
        <b>
          {s.qty} {cur.p.name.toLowerCase()}
        </b>
      )}
      <span className="pixel" style={{ fontSize: '2rem' }}>
        {money(s.price)}
      </span>
      <span className="tiny muted">{side === 'a' ? '← or A' : '→ or D'}</span>
    </button>
  );
  return (
    <div className="col" style={{ gap: 12 }}>
      <div className="row between">
        <b>
          ✅ {right.current} · ❌ {wrong.current}
        </b>
        <b className="pixel">⏱️ {Math.max(0, left)}s</b>
      </div>
      <div className="center big bold">{params.unit ? 'Which is the better deal per item?' : 'Which costs less?'}</div>
      <div className="row" style={{ gap: 16, justifyContent: 'center', background: flash === null ? undefined : flash ? 'var(--good-bg)' : 'var(--bad-bg)', borderRadius: 18, padding: 10 }}>
        <Tag s={cur.a} side="a" />
        <span className="pixel big">VS</span>
        <Tag s={cur.b} side="b" />
      </div>
    </div>
  );
}
