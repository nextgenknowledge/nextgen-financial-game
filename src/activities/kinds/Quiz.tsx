'use client';
import { useMemo, useRef, useState } from 'react';
import type { KindProps } from '../types';
import { QuestionView, type AnswerOutcome } from '../QuestionView';
import { selectQuestions, correctAnswerText, type RuntimeQuestion } from '@/game/questions/engine';
import { QUESTION_BANK } from '@/game/questions/bank';
import { useGame, act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import type { LocationId, Topic } from '@/game/types';
import { Button } from '@/ui/common';
import { playSfx } from '@/engine/audio';

interface QuizParams {
  count?: number;
  cities?: LocationId[];
  buildings?: string[];
  topics?: Topic[];
  minLevel?: number;
  maxLevel?: number;
  timer?: number;
  mode?: 'normal' | 'show' | 'tower';
  floors?: number;
}

export function Quiz({ def, params, difficulty, onFinish, addReview, seed }: KindProps<QuizParams>) {
  const w = useGame((s) => s.world!);
  const entry = difficulty === 'entry';
  const avoid = useMemo(() => ((w.progress.flags.recentQ as string) ?? '').split(','), []); // eslint-disable-line react-hooks/exhaustive-deps
  const subLevel = w.progress.subLevel;
  const questions = useMemo(
    () =>
      selectQuestions(QUESTION_BANK, {
        difficulty,
        cities: params.cities ?? [def.city],
        buildings: params.buildings,
        topics: params.topics,
        minLevel: params.minLevel,
        maxLevel: params.maxLevel,
        level: entry ? subLevel : undefined,
        count: params.count ?? 6,
        seed,
        avoid,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seed],
  );
  const [i, setI] = useState(0);
  const score = useRef(0);
  const correct = useRef(0);

  if (!questions.length) return <p>No questions available yet.</p>;
  const q = questions[i];

  const answered = (o: AnswerOutcome, qq: RuntimeQuestion) => {
    score.current += o.credit;
    if (o.correct) correct.current++;
    act((d, fx) => recordAnswer(d, fx, qq, o.correct));
    addReview?.({ q: qq.prompt, ok: o.correct, answer: correctAnswerText(qq), explanation: qq.explanation });
    if (i + 1 >= questions.length) {
      onFinish({ score: (score.current / questions.length) * 100, correct: correct.current, total: questions.length });
    } else setI(i + 1);
  };

  return (
    <div className="quiz">
      <div className="quiz-dots">
        {questions.map((_, k) => (
          <span key={k} className={k < i ? 'done' : k === i ? 'now' : ''} />
        ))}
      </div>
      <QuestionView key={`${seed}-${i}`} q={q} entry={entry} allowRetry={entry} timer={params.timer} index={i} total={questions.length} onAnswered={(o) => answered(o, q)} />
    </div>
  );
}

/** Wall Street Quiz Tower: each floor is 3 questions at a rising level; get 2 right to climb. */
export function QuizTower({ def, params, difficulty, onFinish, addReview, seed }: KindProps<QuizParams>) {
  const entry = difficulty === 'entry';
  const floors = params.floors ?? 10;
  const [floor, setFloor] = useState(1);
  const [k, setK] = useState(0);
  const [right, setRight] = useState(0);
  const [between, setBetween] = useState<null | 'up' | 'fall'>(null);
  const totalRight = useRef(0);
  const totalAsked = useRef(0);
  const qs = useMemo(
    () =>
      selectQuestions(QUESTION_BANK, {
        difficulty,
        cities: params.cities ?? [def.city],
        topics: params.topics,
        level: Math.min(5, 1 + Math.floor((floor - 1) / 2)),
        count: 3,
        seed: seed + floor * 101,
      }),
    [floor, seed, difficulty, params.cities, params.topics, def.city],
  );
  const finishTower = (reached: number) => onFinish({ score: Math.min(100, (reached / floors) * 100), correct: totalRight.current, total: totalAsked.current, stats: { towerFloor: reached }, summary: `You reached floor ${reached} of ${floors}!` });

  if (between) {
    return (
      <div className="tower-between">
        <div className="tower-graphic">
          {Array.from({ length: floors }, (_, n) => (
            <div key={n} className={`tower-floor ${floors - n <= (between === 'up' ? floor : floor - 1) ? 'lit' : ''}`}>
              {floors - n}
            </div>
          ))}
        </div>
        {between === 'up' ? (
          <>
            <h3>🛗 Floor {floor - 1} cleared!</h3>
            <div className="row">
              <Button onClick={() => finishTower(floor - 1)}>Cash out here</Button>
              <Button variant="gold" size="big" onClick={() => (playSfx('whoosh'), setBetween(null))}>
                Climb to floor {floor} ▲
              </Button>
            </div>
          </>
        ) : (
          <>
            <h3>That floor was tough!</h3>
            <p>You needed 2 of 3 right. You made it to floor {floor - 1}.</p>
            <Button variant="primary" size="big" onClick={() => finishTower(floor - 1)}>
              See results
            </Button>
          </>
        )}
      </div>
    );
  }
  const q = qs[k];
  if (!q) return <p>Not enough questions.</p>;
  return (
    <div className="quiz">
      <div className="row between">
        <b className="pixel">🗼 Floor {floor}</b>
        <span className="small">
          {right}/{k} right this floor · need 2 of 3
        </span>
      </div>
      <QuestionView
        key={`${floor}-${k}`}
        q={q}
        entry={entry}
        allowRetry={false}
        index={k}
        total={3}
        onAnswered={(o) => {
          totalAsked.current++;
          if (o.correct) totalRight.current++;
          act((d, fx) => recordAnswer(d, fx, q, o.correct));
          addReview?.({ q: q.prompt, ok: o.correct, answer: correctAnswerText(q), explanation: q.explanation });
          const r = right + (o.correct ? 1 : 0);
          if (k + 1 < 3) {
            setRight(r);
            setK(k + 1);
            return;
          }
          if (r >= 2) {
            if (floor >= floors) return finishTower(floors);
            setFloor(floor + 1);
            setK(0);
            setRight(0);
            setBetween('up');
            playSfx('levelup');
          } else {
            setFloor(floor);
            setBetween('fall');
            // floor not cleared: reached = floor-1
            setFloor(floor);
          }
        }}
      />
    </div>
  );
}
