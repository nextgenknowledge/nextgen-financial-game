'use client';
import { useRef, useState, type ReactNode } from 'react';
import type { RuntimeQuestion } from '@/game/questions/engine';
import { correctAnswerText } from '@/game/questions/engine';
import { QuestionView } from './QuestionView';
import { act } from '@/store/game';
import { recordAnswer } from '@/game/progress/activities';
import type { KindProps } from './types';
import type { Topic } from '@/game/types';

/** Build a RuntimeQuestion in code (for activities that compute their own scenarios). */
export function synthQ(p: Partial<RuntimeQuestion> & { prompt: string; topic: Topic; explanation: string }): RuntimeQuestion {
  return {
    id: p.id ?? `synth:${p.prompt.slice(0, 24)}`,
    type: p.type ?? (p.value !== undefined ? 'numeric' : 'mc'),
    topic: p.topic,
    level: p.level ?? 3,
    city: p.city ?? 'park',
    prompt: p.prompt,
    choices: p.choices ?? [],
    correct: p.correct ?? 0,
    value: p.value,
    tolAbs: p.tolAbs ?? 0.02,
    tolRel: p.tolRel ?? 0.005,
    unit: p.unit,
    format: p.format,
    explanation: p.explanation,
    hint: p.hint,
    media: p.media,
    icon: p.icon,
    computed: true,
  };
}

/** Runs a list of rounds; each round shows some context and a sequence of questions. */
export function QuestionRounds({
  rounds,
  entry,
  onFinish,
  addReview,
}: {
  rounds: { context: ReactNode; questions: RuntimeQuestion[] }[];
  entry: boolean;
  onFinish: KindProps['onFinish'];
  addReview?: KindProps['addReview'];
}) {
  const [r, setR] = useState(0);
  const [q, setQ] = useState(0);
  const score = useRef(0);
  const right = useRef(0);
  const total = rounds.reduce((s, x) => s + x.questions.length, 0);
  const round = rounds[r];
  const question = round.questions[q];
  return (
    <div className="col" style={{ gap: 10 }}>
      <div className="row between small">
        <b>
          Scenario {r + 1}/{rounds.length}
        </b>
        <span>
          Question {q + 1}/{round.questions.length}
        </span>
      </div>
      <div>{round.context}</div>
      <QuestionView
        key={`${r}-${q}`}
        q={question}
        entry={entry}
        allowRetry={entry}
        onAnswered={(o) => {
          score.current += o.credit;
          if (o.correct) right.current++;
          act((d, fx) => recordAnswer(d, fx, question, o.correct));
          addReview?.({ q: question.prompt, ok: o.correct, answer: correctAnswerText(question), explanation: question.explanation });
          if (q + 1 < round.questions.length) setQ(q + 1);
          else if (r + 1 < rounds.length) {
            setR(r + 1);
            setQ(0);
          } else onFinish({ score: (score.current / total) * 100, correct: right.current, total });
        }}
      />
    </div>
  );
}
