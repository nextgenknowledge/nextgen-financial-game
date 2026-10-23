'use client';
import { useRef, useState } from 'react';
import type { KindProps } from '../types';
import data from '@/data/stories.json';
import { Button, ReadAloud } from '@/ui/common';
import { NarwhalPortrait } from '@/ui/hud/HUD';
import type { Mood } from '@/game/effects';
import { playSfx } from '@/engine/audio';

interface StoryNode {
  speaker: string;
  mood: string;
  text: string;
  choices?: { text: string; next: string; points: number; feedback: string }[];
}
interface StoryDef {
  title: string;
  maxPoints: number;
  start: string;
  nodes: Record<string, StoryNode>;
}

export const STORIES = data.stories as Record<string, StoryDef>;

/** Branching story with scored choices and Narwhal feedback. */
export default function Story({ params, onFinish, addReview }: KindProps<{ story: string }>) {
  const s = STORIES[params.story];
  const [node, setNode] = useState(s.start);
  const [fb, setFb] = useState<null | { text: string; good: boolean; next: string }>(null);
  const points = useRef(0);
  const n = s.nodes[node];
  const end = !n.choices?.length;
  return (
    <div className="col" style={{ gap: 12 }}>
      <b className="pixel">{s.title}</b>
      <div className="row" style={{ gap: 12, alignItems: 'flex-start' }}>
        <div className="dialog-portrait" style={{ width: 90, height: 90 }}>
          {n.speaker === 'Narwhal' ? <NarwhalPortrait mood={n.mood as Mood} size={86} /> : <span style={{ fontSize: '3rem' }}>{n.speaker === 'Max' ? '🧒' : '👩‍💼'}</span>}
        </div>
        <div className="card grow">
          <b>{n.speaker === 'Narwhal' ? 'NextGen Narwhal' : n.speaker}</b>
          <p style={{ fontSize: '1.2rem', fontWeight: 700, margin: '4px 0' }}>
            {n.text} <ReadAloud text={n.text} />
          </p>
        </div>
      </div>
      {fb ? (
        <div className={`card ${fb.good ? 'tint-green' : 'tint-gold'}`}>
          {fb.good ? '✅ ' : '💡 '}
          {fb.text}
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <Button
              variant="primary"
              onClick={() => {
                setNode(fb.next);
                setFb(null);
              }}
            >
              Continue ▶
            </Button>
          </div>
        </div>
      ) : end ? (
        <Button variant="gold" size="big" onClick={() => onFinish({ score: (points.current / s.maxPoints) * 100 })}>
          The end! See my stars ⭐
        </Button>
      ) : (
        <div className="col" style={{ gap: 8 }}>
          {n.choices!.map((c) => (
            <Button
              key={c.text}
              size="big"
              block
              onClick={() => {
                points.current += c.points;
                const good = c.points >= 8;
                playSfx(good ? 'correct' : 'pop');
                addReview?.({ q: n.text, ok: good, answer: c.text, explanation: c.feedback });
                setFb({ text: c.feedback, good, next: c.next });
              }}
            >
              {c.text}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
