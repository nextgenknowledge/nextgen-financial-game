'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import sorts from '@/data/sorts.json';
import { makeRng } from '@/game/rng';
import { Button, ReadAloud } from '@/ui/common';
import { playSfx } from '@/engine/audio';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import type { Topic } from '@/game/types';
import { cls } from '@/ui/format';

interface SortItem {
  text: string;
  icon?: string;
  bin: number;
  why: string;
}
interface SortSet {
  title: string;
  bins: { label: string; icon: string }[];
  items: SortItem[];
}

export const SORT_SETS = sorts.sets as Record<string, SortSet>;

/** Tap (or drag) each card into the right bin. */
export default function Sort({ def, params, onFinish, addReview, seed, difficulty }: KindProps<{ set: string; items?: SortItem[]; bins?: SortSet['bins']; count?: number }>) {
  const set: SortSet = params.items ? { title: def.name, bins: params.bins!, items: params.items } : SORT_SETS[params.set];
  const items = useMemo(() => {
    const r = makeRng(seed);
    return r.shuffle([...set.items]).slice(0, params.count ?? set.items.length);
  }, [seed, set, params.count]);
  const [i, setI] = useState(0);
  const [feedback, setFeedback] = useState<null | { ok: boolean; item: SortItem }>(null);
  const [drag, setDrag] = useState(false);
  const right = useRef(0);
  const entry = difficulty === 'entry';
  const item = items[i];

  const choose = (bin: number) => {
    if (feedback || !item) return;
    const ok = bin === item.bin;
    if (ok) right.current++;
    playSfx(ok ? 'correct' : 'wrong');
    act((d, fx) => recordAnswer(d, fx, { id: `${def.id}:${item.text}`, topic: def.topics[0] as Topic }, ok));
    addReview?.({ q: item.text, ok, answer: set.bins[item.bin].label, explanation: item.why });
    setFeedback({ ok, item });
  };
  const next = () => {
    setFeedback(null);
    if (i + 1 >= items.length) onFinish({ score: (right.current / items.length) * 100, correct: right.current, total: items.length });
    else setI(i + 1);
  };

  return (
    <div className="sort-game">
      <div className="row between">
        <b className="pixel">{set.title}</b>
        <span className="small">
          {i + 1}/{items.length} · ✅ {right.current}
        </span>
      </div>
      <div className="sort-card-wrap">
        {item && (
          <div
            className={cls('sort-card', feedback && (feedback.ok ? 'ok' : 'bad'))}
            draggable={!feedback}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plain', 'card');
              setDrag(true);
            }}
            onDragEnd={() => setDrag(false)}
          >
            {item.icon && <span style={{ fontSize: entry ? '3.4rem' : '2.6rem' }}>{item.icon}</span>}
            <b style={{ fontSize: entry ? '1.5rem' : '1.2rem' }}>{item.text}</b>
            <ReadAloud text={item.text} />
          </div>
        )}
      </div>
      {feedback ? (
        <div className={`card ${feedback.ok ? 'tint-green' : 'tint-red'}`}>
          <b>{feedback.ok ? '✅ Yes!' : `💡 It goes in "${set.bins[feedback.item.bin].label}".`}</b> {feedback.item.why}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 6 }}>
            <Button variant="primary" onClick={next}>
              Next ▶
            </Button>
          </div>
        </div>
      ) : (
        <div className="sort-bins" style={{ gridTemplateColumns: `repeat(${Math.min(set.bins.length, 4)}, 1fr)` }}>
          {set.bins.map((b, k) => (
            <button
              key={k}
              className={cls('sort-bin', drag && 'drop')}
              onClick={() => choose(k)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                choose(k);
              }}
            >
              <span style={{ fontSize: '2rem' }}>{b.icon}</span>
              <b>{b.label}</b>
            </button>
          ))}
        </div>
      )}
      <div className="tiny muted center">Tap a bin (or drag the card onto it).</div>
    </div>
  );
}
