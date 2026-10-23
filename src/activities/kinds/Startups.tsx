'use client';
import { useMemo, useState } from 'react';
import type { KindProps } from '../types';
import { makeRng } from '@/game/rng';
import { STARTUPS, sampleOutcome, expectedMultiple, investStartup } from '@/game/finance/startups';
import { Button, ReadAloud } from '@/ui/common';
import { money } from '@/ui/format';
import { useGame, act } from '@/store/game';
import { available } from '@/game/finance/accounts';
import { playSfx } from '@/engine/audio';
import { recordAnswer } from '@/game/progress/activities';

/** Pitch Night: back startups with play money (Entry, instant results) or real money (Advanced, resolves later). */
export default function Startups({ params, onFinish, addReview, seed }: KindProps<{ pitches: number; real: boolean }>) {
  const w = useGame((s) => s.world!);
  const pitches = useMemo(() => makeRng(seed).shuffle([...STARTUPS]).slice(0, params.pitches), [seed, params.pitches]);
  const budget = params.real ? Math.min(500, Math.floor(available(w))) : 100;
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const [done, setDone] = useState<null | { results: { id: string; mult: number }[]; score: number }>(null);
  const used = Object.values(alloc).reduce((a, b) => a + b, 0);
  const step = params.real ? 25 : 10;

  const submit = () => {
    const rng = makeRng(seed + 99);
    // Score = quality of choices (expected multiple), with a diversification bonus
    const picks = Object.entries(alloc).filter(([, v]) => v > 0);
    const evSum = picks.reduce((s, [id, v]) => s + v * expectedMultiple(STARTUPS.find((x) => x.id === id)!), 0);
    const ev = used ? evSum / used : 0;
    const diversified = picks.length >= 2;
    const scams = picks.filter(([id]) => (STARTUPS.find((x) => x.id === id)?.quality ?? 1) < 0.1).length;
    const score = Math.max(0, Math.min(100, ev * 55 + (diversified ? 20 : 0) - scams * 25 + (used > 0 ? 10 : 0)));
    for (const p of pitches) {
      const q = p.quality;
      const v = alloc[p.id] ?? 0;
      addReview?.({ q: `${p.icon} ${p.name}: ${p.pitch}`, ok: q >= 0.5 ? v > 0 : v === 0, answer: q >= 0.5 ? 'Promising fundamentals' : q < 0.1 ? 'Red flags, likely a scam or fad' : 'Weak fundamentals', explanation: p.facts.join(' · ') });
      act((d, fx) => recordAnswer(d, fx, { id: `startup:${p.id}`, topic: 'investing' }, q >= 0.5 ? v > 0 : v === 0));
    }
    if (params.real) {
      act((d, fx) => {
        const r = makeRng(seed + 5);
        for (const [id, v] of picks) investStartup(d, fx, id, v, r);
        fx.push({ type: 'narwhal', text: `Your startup stakes are in! Results will arrive in 3–6 Fin City months. Remember: most startups fail, so only invest what you can afford to lose.`, mood: 'talking' });
      });
      onFinish({ score, summary: 'Results arrive in a few months, watch for Narwhal’s message!' });
      return;
    }
    const results = pitches.map((p) => ({ id: p.id, mult: sampleOutcome(p, rng) }));
    playSfx('whoosh');
    setDone({ results, score });
  };

  if (done) {
    const total = done.results.reduce((s, r) => s + (alloc[r.id] ?? 0) * r.mult, 0);
    return (
      <div className="col" style={{ gap: 10 }}>
        <b>A few years later…</b>
        {pitches.map((p) => {
          const r = done.results.find((x) => x.id === p.id)!;
          const v = alloc[p.id] ?? 0;
          return (
            <div key={p.id} className={`card ${r.mult === 0 ? 'tint-red' : r.mult >= 3 ? 'tint-green' : 'flat'}`}>
              {p.icon} <b>{p.name}</b>: {r.mult === 0 ? 'closed down 😢' : r.mult >= 3 ? `huge success! ${r.mult.toFixed(1)}× 🚀` : `did okay (${r.mult.toFixed(1)}×)`} {v > 0 && <span className="small">(your {v} → {(v * r.mult).toFixed(0)})</span>}
            </div>
          );
        })}
        <div className="card tint-gold">
          Your {used} play-coins became <b>{total.toFixed(0)}</b>. Even good startups often fail, so investors spread money over many, and never invest money they need.
        </div>
        <Button variant="primary" size="big" onClick={() => onFinish({ score: done.score })}>
          See my stars
        </Button>
      </div>
    );
  }

  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between wrap">
        <b>
          {params.real ? `Invest real money (up to ${money(budget, { cents: false })})` : 'You have 100 play-coins to invest'}
        </b>
        <span className={`bold ${used > budget ? 'bad' : ''}`}>
          Used: {params.real ? money(used, { cents: false }) : used} / {params.real ? money(budget, { cents: false }) : budget}
        </span>
      </div>
      <div className="item-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))' }}>
        {pitches.map((p) => (
          <div key={p.id} className="item-card" style={{ alignItems: 'stretch', textAlign: 'left' }}>
            <div className="row">
              <span style={{ fontSize: '2rem' }}>{p.icon}</span>
              <b>{p.name}</b>
              <ReadAloud text={`${p.name}. ${p.pitch}. ${p.facts.join('. ')}`} />
            </div>
            <i className="small">“{p.pitch}”</i>
            <ul className="tiny" style={{ margin: 0, paddingLeft: '1rem' }}>
              {p.facts.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <div className="row" style={{ justifyContent: 'center' }}>
              <Button size="small" onClick={() => setAlloc({ ...alloc, [p.id]: Math.max(0, (alloc[p.id] ?? 0) - step) })}>
                −
              </Button>
              <b className="mono">{params.real ? money(alloc[p.id] ?? 0, { cents: false }) : alloc[p.id] ?? 0}</b>
              <Button size="small" disabled={used + step > budget} onClick={() => setAlloc({ ...alloc, [p.id]: (alloc[p.id] ?? 0) + step })}>
                +
              </Button>
            </div>
          </div>
        ))}
      </div>
      <Button variant="gold" size="big" disabled={used > budget} onClick={submit}>
        {used === 0 ? 'Skip all pitches' : params.real ? 'Invest for real 💸' : 'Invest! 🚀'}
      </Button>
    </div>
  );
}
