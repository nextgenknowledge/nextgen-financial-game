'use client';
import { useState } from 'react';
import type { KindProps } from '../types';
import data from '@/data/allocate.json';
import { Button, ReadAloud, ProgressBar } from '@/ui/common';
import { money } from '@/ui/format';
import { playSfx } from '@/engine/audio';

interface Cat {
  id: string;
  label: string;
  icon: string;
  need?: boolean;
  min?: number;
  ideal: number[];
}
interface Scenario {
  title: string;
  intro: string;
  budget: number;
  step: number;
  categories: Cat[];
  surprises?: { text: string; covers: string[]; cost: number }[];
}

export const SCENARIOS = data.scenarios as Record<string, Scenario>;

export function scoreAllocation(s: Scenario, alloc: Record<string, number>) {
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  const notes: string[] = [];
  let score = 100;
  if (total > s.budget) {
    score -= 40;
    notes.push(`You planned ${money(total)} but only have ${money(s.budget)}. Over budget!`);
  }
  for (const c of s.categories) {
    const v = alloc[c.id] ?? 0;
    if (c.need && c.min !== undefined && v < c.min) {
      score -= 18;
      notes.push(`${c.icon} ${c.label} is a need, it needs at least ${money(c.min)}.`);
    } else if (v < c.ideal[0]) {
      score -= 5;
      notes.push(`${c.icon} ${c.label} is a bit low (aim for ${money(c.ideal[0])}–${money(c.ideal[1])}).`);
    } else if (v > c.ideal[1]) {
      score -= c.need ? 3 : 7;
      notes.push(`${c.icon} ${c.label} is more than needed (aim for ${money(c.ideal[0])}–${money(c.ideal[1])}).`);
    }
  }
  const left = s.budget - total;
  if (left > s.budget * 0.15) {
    score -= 8;
    notes.push(`${money(left)} is unplanned. Give every dollar a job, maybe savings?`);
  }
  // Surprises: covered if the listed categories have enough
  for (const sp of s.surprises ?? []) {
    const cover = sp.covers.reduce((a, id) => a + (alloc[id] ?? 0), 0) + Math.max(0, left);
    if (cover >= sp.cost) notes.push(`✅ Surprise: ${sp.text} You were ready for it!`);
    else {
      score -= 15;
      notes.push(`⚠️ Surprise: ${sp.text} Your plan couldn't cover it. A buffer or savings would help.`);
    }
  }
  return { score: Math.max(0, Math.min(100, score)), notes, total };
}

/** Slider budget allocation with needs, ideal ranges and surprise expenses. */
export default function Allocate({ params, onFinish, difficulty, addReview }: KindProps<{ scenario: string }>) {
  const s = SCENARIOS[params.scenario];
  const [alloc, setAlloc] = useState<Record<string, number>>(() => Object.fromEntries(s.categories.map((c) => [c.id, 0])));
  const [result, setResult] = useState<ReturnType<typeof scoreAllocation> | null>(null);
  const total = Object.values(alloc).reduce((a, b) => a + b, 0);
  const left = s.budget - total;
  const entry = difficulty === 'entry';
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="card tint-teal">
        <b className="pixel">{s.title}</b>
        <div>
          {s.intro} <ReadAloud text={s.intro} />
        </div>
      </div>
      <div className="row between">
        <b>Budget {money(s.budget, { cents: false })}</b>
        <b className={left < 0 ? 'bad' : left === 0 ? 'good' : ''}>{left < 0 ? `Over by ${money(-left, { cents: false })}!` : `Left to plan: ${money(left, { cents: false })}`}</b>
      </div>
      <ProgressBar value={total} max={s.budget} color={left < 0 ? 'var(--bad)' : 'var(--teal)'} height={18} />
      <div className="col" style={{ gap: 8 }}>
        {s.categories.map((c) => (
          <div key={c.id} className="alloc-row">
            <span className="bold">
              {c.icon} {c.label} {c.need && <span className="chip teal">need</span>}
            </span>
            <input
              type="range"
              min={0}
              max={s.budget}
              step={s.step}
              value={alloc[c.id]}
              disabled={!!result}
              onChange={(e) => setAlloc({ ...alloc, [c.id]: Number(e.target.value) })}
              aria-label={c.label}
            />
            <div className="row" style={{ gap: 4 }}>
              <button className="btn small icon" disabled={!!result} onClick={() => setAlloc({ ...alloc, [c.id]: Math.max(0, alloc[c.id] - s.step) })}>
                −
              </button>
              <b className="mono" style={{ minWidth: 70, textAlign: 'center' }}>
                {money(alloc[c.id], { cents: false })}
              </b>
              <button className="btn small icon" disabled={!!result} onClick={() => setAlloc({ ...alloc, [c.id]: alloc[c.id] + s.step })}>
                +
              </button>
            </div>
          </div>
        ))}
      </div>
      {!result ? (
        <Button
          variant="gold"
          size="big"
          onClick={() => {
            const r = scoreAllocation(s, alloc);
            setResult(r);
            playSfx(r.score >= 70 ? 'correct' : 'wrong');
            r.notes.forEach((n) => addReview?.({ q: s.title, ok: n.startsWith('✅'), answer: '', explanation: n }));
          }}
        >
          {entry ? '✔ Done planning!' : 'Lock in my budget'}
        </Button>
      ) : (
        <div className="card">
          <b>Narwhal checks your plan:</b>
          {result.notes.length === 0 && <div className="good bold">Perfect plan! Every dollar has a job and needs come first. 🌟</div>}
          <ul className="small">
            {result.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
          <Button variant="primary" size="big" onClick={() => onFinish({ score: result.score })}>
            See my stars
          </Button>
        </div>
      )}
    </div>
  );
}
