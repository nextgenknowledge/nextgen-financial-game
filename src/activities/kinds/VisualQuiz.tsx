'use client';
/** Runs a list of questions, each shown under its own live visual (chart, table, cap table). */
import { useRef, useState, type ReactNode } from 'react';
import type { KindProps } from '../types';
import type { RuntimeQuestion } from '@/game/questions/engine';
import { correctAnswerText } from '@/game/questions/engine';
import { QuestionView } from '../QuestionView';

export interface VisualItem {
  q: RuntimeQuestion;
  visual: ReactNode;
  /** Short scene-setting line above the visual. */
  brief?: string;
}

export function VisualQuiz({ items, kicker, onFinish, addReview }: { items: VisualItem[]; kicker: string } & Pick<KindProps, 'onFinish' | 'addReview'>) {
  const [i, setI] = useState(0);
  const score = useRef(0);
  const right = useRef(0);
  const it = items[i];
  return (
    <div className="pro">
      <div className="pro-head">
        <div>
          <div className="pro-kicker">{kicker}</div>
          {it.brief && <div className="pro-sub" style={{ fontSize: '1rem' }}>{it.brief}</div>}
        </div>
      </div>
      <section className="pro-panel">{it.visual}</section>
      <QuestionView
        key={i}
        q={it.q}
        entry={false}
        index={i}
        total={items.length}
        onAnswered={(o) => {
          score.current += o.credit;
          if (o.correct) right.current++;
          addReview?.({ q: it.q.prompt, ok: o.correct, answer: correctAnswerText(it.q), explanation: it.q.explanation });
          if (i + 1 >= items.length) onFinish({ score: (score.current / items.length) * 100, correct: right.current, total: items.length });
          else setI(i + 1);
        }}
      />
    </div>
  );
}

/** Builds a RuntimeQuestion with sensible defaults. */
export function rq(p: Partial<RuntimeQuestion> & Pick<RuntimeQuestion, 'id' | 'prompt' | 'explanation' | 'topic'>): RuntimeQuestion {
  return {
    type: 'mc',
    level: 3,
    city: 'new-york',
    choices: [],
    correct: 0,
    tolAbs: 0.01,
    tolRel: 0.01,
    computed: true,
    ...p,
  } as RuntimeQuestion;
}

/** Shuffle choices deterministically, returning the new index of the right one. */
export function shuffled(choices: string[], correct: number, r: () => number) {
  const order = choices.map((_, i) => i).sort(() => r() - 0.5);
  return { choices: order.map((k) => choices[k]), correct: order.indexOf(correct) };
}
