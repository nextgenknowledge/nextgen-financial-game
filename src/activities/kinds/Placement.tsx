'use client';
/**
 * Placement Test (Advanced). Eight multiple-choice questions across the topics: a right answer
 * moves you up a level, a wrong one down. It ends with a level per topic and the lessons to start with.
 */
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { QuestionView, type AnswerOutcome } from '../QuestionView';
import { correctAnswerText, instantiate, type RuntimeQuestion } from '@/game/questions/engine';
import { QUESTION_BANK } from '@/game/questions/bank';
import { makeRng } from '@/game/rng';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import { TOPIC_INFO } from '@/game/topics';
import { LESSONS } from '@/game/progress/lessons';
import { useUI } from '@/store/ui';
import { Button } from '@/ui/common';
import type { Topic } from '@/game/types';
import { Bars, C, ProHead } from './pro/kit';

const TOPICS: Topic[] = ['budgeting', 'banking', 'credit', 'investing', 'taxes', 'business', 'insurance', 'retirement', 'economics', 'interest', 'debt', 'earning'];
// Short on purpose: long tests lose players before they get to the game
const COUNT = 8;

export default function Placement({ onFinish, addReview, seed }: KindProps) {
  const rng = useMemo(() => makeRng(seed * 5 + 3), [seed]);
  const bank = useMemo(() => QUESTION_BANK.filter((q) => q.difficulty === 'advanced' && q.type === 'mc'), []);
  const order = useMemo(() => rng.shuffle([...TOPICS]), [rng]);
  const [level, setLevel] = useState(3);
  const [i, setI] = useState(0);
  const used = useRef(new Set<string>());
  const results = useRef<{ topic: Topic; level: number; ok: boolean }[]>([]);
  const score = useRef(0);
  const [done, setDone] = useState(false);

  const q = useMemo<RuntimeQuestion | null>(() => {
    if (done) return null;
    const topic = order[i % order.length];
    for (let spread = 0; spread <= 4; spread++) {
      const pool = bank.filter((x) => !used.current.has(x.id) && Math.abs(x.level - level) <= spread && (spread > 2 || x.topic === topic));
      if (pool.length) {
        const pickQ = rng.pick(pool);
        used.current.add(pickQ.id);
        return instantiate(pickQ, rng);
      }
    }
    return null;
  }, [i, done]); // eslint-disable-line react-hooks/exhaustive-deps

  const answered = (o: AnswerOutcome) => {
    if (!q) return;
    results.current.push({ topic: q.topic, level: q.level, ok: o.correct });
    score.current += o.correct ? q.level / 5 : 0;
    act((d, fx) => recordAnswer(d, fx, q, o.correct));
    addReview?.({ q: q.prompt, ok: o.correct, answer: correctAnswerText(q), explanation: q.explanation });
    setLevel((l) => Math.max(1, Math.min(5, l + (o.correct ? 1 : -1))));
    if (i + 1 >= COUNT) setDone(true);
    else setI(i + 1);
  };

  if (done) {
    const byTopic = new Map<Topic, { got: number; n: number }>();
    for (const r of results.current) {
      const t = byTopic.get(r.topic) ?? { got: 0, n: 0 };
      t.n++;
      if (r.ok) t.got += r.level;
      else t.got += Math.max(0, r.level - 2);
      byTopic.set(r.topic, t);
    }
    const rows = [...byTopic.entries()].map(([t, v]) => ({ t, lvl: Math.max(1, Math.min(5, v.got / v.n)) })).sort((a, b) => a.lvl - b.lvl);
    const overall = results.current.reduce((a, r) => a + (r.ok ? r.level : Math.max(1, r.level - 1)), 0) / results.current.length;
    const weak = rows.slice(0, 3).map((r) => LESSONS.find((l) => l.topic === r.t)).filter(Boolean);
    return (
      <div className="pro">
        <ProHead kicker="Placement test · Results" title={`Placement level ${overall.toFixed(1)} of 5`} sub="Your level in each topic you were tested on. Start with the lessons on your three weakest." />
        <section className="pro-panel">
          <Bars items={rows.map((r) => ({ label: TOPIC_INFO[r.t]?.name ?? r.t, value: r.lvl, color: r.lvl >= 4 ? C.green : r.lvl >= 2.5 ? C.blue : C.red }))} fmt={(v) => `Level ${v.toFixed(1)}`} />
        </section>
        <section className="pro-panel">
          <h4>Recommended lessons</h4>
          <div className="row wrap" style={{ gap: 8 }}>
            {weak.map((l) => (
              <Button key={l!.id} onClick={() => useUI.getState().push({ type: 'learn', lesson: l!.id })}>
                {l!.title}
              </Button>
            ))}
          </div>
        </section>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <Button variant="gold" size="big" onClick={() => onFinish({ score: Math.min(100, (score.current / COUNT) * 100 * 1.6), correct: results.current.filter((r) => r.ok).length, total: COUNT, summary: `Placement level ${overall.toFixed(1)}.` })}>
            Finish ▶
          </Button>
        </div>
      </div>
    );
  }
  if (!q) return <p>No questions available.</p>;
  return (
    <div className="pro">
      <ProHead kicker={`Placement test · Question ${i + 1} of ${COUNT}`} title={`Level ${level}`} sub="Questions get harder when you are right and easier when you are not." />
      <QuestionView key={i} q={q} entry={false} index={i} total={COUNT} onAnswered={answered} />
    </div>
  );
}
