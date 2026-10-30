'use client';
/** The Advanced course in the Learn hub: units of lessons, the lesson reader and the glossary. */
import { useMemo, useState } from 'react';
import { useGame, act } from '@/store/game';
import { Button, ReadAloud } from '@/ui/common';
import { cls } from '@/ui/format';
import { FinBucks } from '@/ui/FinBucks';
import { playSfx } from '@/engine/audio';
import { completeLesson } from '@/game/progress/lessons';
import { recordEvent } from '@/game/progress/events';
import { ADV_LESSONS, ADV_LESSON_BY_ID, CONCEPTS, UNITS, usedAt, type AdvLesson, type CourseCard } from '@/game/learn';
import { ConceptCard } from './LearnBits';

const CARD_LABEL: Record<CourseCard['kind'], string> = { idea: 'The idea', example: 'Worked example', formula: 'Formula', mistake: 'Watch out' };

export function AdvancedCourse({ onOpen }: { onOpen: (l: AdvLesson) => void }) {
  const done = useGame((s) => s.world!.progress.lessons);
  const next = ADV_LESSONS.find((l) => !done.includes(l.id));
  return (
    <div className="course">
      {UNITS.map((u) => {
        const lessons = ADV_LESSONS.filter((l) => l.unit.id === u.id);
        const n = lessons.filter((l) => done.includes(l.id)).length;
        return (
          <section key={u.id} className="unit">
            <div className="unit-head">
              <span className="unit-icon">{u.icon}</span>
              <div className="col grow" style={{ gap: 0 }}>
                <b>{u.title}</b>
                <span className="tiny muted">{u.blurb}</span>
              </div>
              <span className={cls('chip', n === lessons.length ? 'good' : undefined)}>
                {n}/{lessons.length}
              </span>
            </div>
            <div className="unit-lessons">
              {lessons.map((l) => {
                const isDone = done.includes(l.id);
                return (
                  <button key={l.id} className={cls('lesson-row', isDone && 'done', next?.id === l.id && 'next')} onClick={() => (playSfx('pop'), onOpen(l))}>
                    <span className="lesson-node">{isDone ? '✓' : l.icon}</span>
                    <span className="col grow" style={{ gap: 1, alignItems: 'flex-start' }}>
                      <b>{l.title}</b>
                      <span className="tiny muted">
                        {l.cards.length} cards · {l.checks.length} checks · +{l.reward.xp} XP{l.reward.cash ? ` · +$${l.reward.cash}` : ''}
                      </span>
                    </span>
                    {next?.id === l.id && <span className="chip teal tiny">Next</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

/**
 * Reads one Advanced lesson: its cards, the key terms, where it's used, then the checks. The lesson
 * completes (with rewards the first time) when every check is answered correctly.
 */
export function AdvLessonReader({ lesson, onDone, onNext }: { lesson: AdvLesson; onDone: () => void; onNext: (l: AdvLesson) => void }) {
  const w = useGame((s) => s.world!);
  const [wasFirst] = useState(() => !w.progress.lessons.includes(lesson.id));
  // Steps: each card, the key terms, then each check
  const steps = lesson.cards.length + 1 + lesson.checks.length;
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<(number | null)[]>(() => lesson.checks.map(() => null));
  const [result, setResult] = useState<null | boolean>(null);
  const places = useMemo(() => usedAt(lesson), [lesson]);
  const after = ADV_LESSONS[ADV_LESSONS.findIndex((l) => l.id === lesson.id) + 1];
  const cardAt = i < lesson.cards.length ? lesson.cards[i] : null;
  const atTerms = i === lesson.cards.length;
  const checkIdx = i - lesson.cards.length - 1;
  const check = checkIdx >= 0 ? lesson.checks[checkIdx] : null;
  const answered = check ? picked[checkIdx] : null;

  const pick = (k: number) => {
    if (!check || answered !== null) return;
    const right = k === check.answer;
    playSfx(right ? 'correct' : 'wrong');
    act((d, fx) => recordEvent(d, fx, { type: 'answer', correct: right, topic: lesson.unit.topic }));
    const nextPicked = picked.map((p, n) => (n === checkIdx ? k : p));
    setPicked(nextPicked);
    if (checkIdx === lesson.checks.length - 1) {
      const all = nextPicked.every((p, n) => p === lesson.checks[n].answer);
      setResult(all);
      if (all) act((d, fx) => completeLesson(d, fx, lesson.id, true));
    }
  };
  const restartChecks = () => {
    setPicked(lesson.checks.map(() => null));
    setResult(null);
    setI(0);
  };

  return (
    <div className="lesson-reader">
      <div className="row between wrap">
        <button className="link-btn" onClick={onDone}>
          ◀ Course
        </button>
        <span className="q-topic">
          <span className="q-topic-icon">{lesson.unit.icon}</span>
          {lesson.unit.title}
        </span>
      </div>
      <div className="q-progress-track lesson-track">
        {Array.from({ length: steps }, (_, k) => (
          <span key={k} className={k < i ? 'past' : k === i ? 'now' : ''} />
        ))}
      </div>

      {cardAt && (
        <div className={cls('lesson-card2', `card-${cardAt.kind}`)}>
          <div className="lesson-art">{lesson.icon}</div>
          <div className="col grow" style={{ gap: 6 }}>
            <span className="learn-kicker dark">
              {lesson.title} · {CARD_LABEL[cardAt.kind]}
              {cardAt.title ? `: ${cardAt.title}` : ''}
            </span>
            <p className={cls('lesson-text', cardAt.kind === 'formula' && 'formula-text')}>
              {cardAt.body} <ReadAloud text={cardAt.body} />
            </p>
          </div>
        </div>
      )}

      {atTerms && (
        <div className="col" style={{ gap: 8 }}>
          <span className="learn-kicker dark">Key terms</span>
          <div className="concept-grid">
            {lesson.terms.map((t) => (
              <ConceptCard key={t.id} concept={t} compact onLesson={null} />
            ))}
          </div>
          {places.length > 0 && (
            <div className="card flat col" style={{ gap: 4 }}>
              <b className="small">Where you&apos;ll use this</b>
              <span className="small muted">{places.map((a) => `${a.icon} ${a.name}`).join(' · ')}</span>
            </div>
          )}
        </div>
      )}

      {check && (
        <div className="question">
          <div className="lesson-card2">
            <div className="lesson-art">❓</div>
            <div className="col grow" style={{ gap: 6 }}>
              <span className="learn-kicker dark">
                Check {checkIdx + 1} of {lesson.checks.length}
              </span>
              <p className="lesson-text">
                {check.prompt} <ReadAloud text={check.prompt} />
              </p>
            </div>
          </div>
          <div className={cls('choices', check.choices.length <= 2 && 'two')}>
            {check.choices.map((c, k) => (
              <button
                key={k}
                className={cls('choice', answered !== null && k === check.answer && 'right', answered === k && k !== check.answer && 'wrong')}
                disabled={answered !== null}
                onClick={() => pick(k)}
              >
                <span className="choice-letter">{String.fromCharCode(65 + k)}</span>
                {c}
              </button>
            ))}
          </div>
          {answered !== null && (
            <div className={cls('q-feedback', answered === check.answer ? 'ok' : 'no')}>
              <div className="q-feedback-head">
                <b className="q-verdict grow">{answered === check.answer ? 'Correct!' : 'Not quite'}</b>
              </div>
              <div className="q-why">
                <span className="q-why-label">Why</span>
                <span>{check.explanation}</span>
              </div>
            </div>
          )}
          {result !== null && (
            <div className={cls('q-feedback', result ? 'ok' : 'no')}>
              <div className="q-feedback-head">
                <b className="q-verdict grow">{result ? (wasFirst ? 'Lesson complete!' : 'All correct!') : 'Almost there'}</b>
                {result && wasFirst && (
                  <span className="row wrap" style={{ gap: 6 }}>
                    <span className="chip teal">+{lesson.reward.xp} XP</span>
                    {lesson.reward.cash ? <FinBucks value={lesson.reward.cash} className="chip gold finbucks" /> : null}
                  </span>
                )}
              </div>
              {!result && (
                <div className="q-why">
                  <span className="q-why-label">Tip</span>
                  <span>Get every check right to finish the lesson. Have another look at the cards, then try again.</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="row wrap" style={{ justifyContent: 'flex-end', gap: 8 }}>
        {i > 0 && !check && <Button onClick={() => setI(i - 1)}>◀ Back</Button>}
        {!check && (
          <Button variant="primary" size="big" onClick={() => (playSfx('click'), setI(i + 1))}>
            {atTerms ? 'Check yourself ▶' : 'Continue ▶'}
          </Button>
        )}
        {check && answered !== null && checkIdx < lesson.checks.length - 1 && (
          <Button variant="primary" size="big" onClick={() => setI(i + 1)}>
            Next check ▶
          </Button>
        )}
        {result === false && <Button onClick={restartChecks}>↺ Review and retry</Button>}
        {result === true && after && (
          <Button variant="primary" size="big" onClick={() => onNext(after)}>
            Next lesson: {after.title} ▶
          </Button>
        )}
        {result !== null && <Button onClick={onDone}>Back to course</Button>}
      </div>
    </div>
  );
}

/** Every term in the course, searchable, grouped by unit. */
export function Glossary({ onOpen }: { onOpen: (l: AdvLesson) => void }) {
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const match = (c: (typeof CONCEPTS)[number]) => !query || `${c.term} ${(c.aka ?? []).join(' ')} ${c.def}`.toLowerCase().includes(query);
  const groups = UNITS.map((u) => ({ u, terms: ADV_LESSONS.filter((l) => l.unit.id === u.id).flatMap((l) => l.terms).filter(match) })).filter((g) => g.terms.length);
  return (
    <div className="col" style={{ gap: 10 }}>
      <input className="input" placeholder={`Search ${CONCEPTS.length} terms: APR, EBITDA, duration…`} value={q} onChange={(e) => setQ(e.target.value)} />
      {groups.map(({ u, terms }) => (
        <section key={u.id} className="col" style={{ gap: 6 }}>
          <b>
            {u.icon} {u.title}
          </b>
          <div className="concept-grid">
            {[...terms]
              .sort((a, b) => a.term.localeCompare(b.term))
              .map((c) => (
                <ConceptCard key={c.id} concept={c} compact={!query} onLesson={(id) => onOpen(ADV_LESSON_BY_ID.get(id)!)} />
              ))}
          </div>
        </section>
      ))}
      {!groups.length && <span className="small muted">No terms match &quot;{q}&quot;.</span>}
    </div>
  );
}
